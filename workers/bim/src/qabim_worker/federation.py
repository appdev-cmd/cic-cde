"""Federated checks in a transient, metre-based IFC4 mesh model.

Source meshes are tessellated by IfcOpenShell in float64, transformed into the
project frame, then fed to its intersection kernel. Render-cache float32 data is
never used. Source IDs and GUIDs are kept out of the transient identity space.
"""
import hashlib
import math
from collections import Counter

import ifcopenshell
import ifcopenshell.geom

from spatial import spatial_location

MAX_CLASH_PRODUCTS = 5_000


class ClashScopeLimitError(ValueError):
    def __init__(self, count):
        formatted_count = f"{count:,}".replace(",", ".")
        formatted_limit = f"{MAX_CLASH_PRODUCTS:,}".replace(",", ".")
        super().__init__(
            f"Phạm vi có ít nhất {formatted_count} đối tượng, vượt giới hạn {formatted_limit}. "
            "Hãy chọn một tầng hoặc giảm số mô hình rồi chạy lại."
        )
        self.details = {"reason": "clash_products", "count": count, "limit": MAX_CLASH_PRODUCTS}


def transform_point(point, transform):
    offset=transform.get("translation",[0,0,0]);angle=math.radians(transform.get("rotationZDegrees",0))
    if len(offset)!=3 or any(not math.isfinite(float(v)) for v in [*offset,angle]):
        raise ValueError("Invalid model transform")
    c,s=math.cos(angle),math.sin(angle);x,y,z=point
    return (c*x-s*y+offset[0],s*x+c*y+offset[1],z+offset[2])


def run_federation(params):
    sources=params["sources"]
    if not 1<=len(sources)<=12 or len({s["modelId"] for s in sources})!=len(sources):
        raise ValueError("Select 1 to 12 distinct model snapshots")
    allowed={"IfcBeam","IfcColumn","IfcSlab","IfcWall","IfcDuctSegment","IfcPipeSegment"}
    class_a,class_b=params.get("classA","IfcDuctSegment"),params.get("classB","IfcBeam")
    tolerance=float(params.get("tolerance",.002))
    if class_a not in allowed or class_b not in allowed:raise ValueError("Unsupported IFC class")
    if not math.isfinite(tolerance) or not .0001<=tolerance<=1:raise ValueError("Invalid tolerance")
    scope_a=set(params["modelIdsA"]);scope_b=set(params["modelIdsB"])
    if not scope_a or not scope_b or not (scope_a|scope_b)<=set(s["modelId"] for s in sources):raise ValueError("Invalid model scope")
    floor = params.get("floor", "all")
    merged=ifcopenshell.file(schema="IFC4")
    origin=merged.createIfcAxis2Placement3D(merged.createIfcCartesianPoint((0.,0.,0.)),None,None)
    context=merged.createIfcGeometricRepresentationContext(None,"Model",3,1.e-6,origin,None)
    merged.createIfcProject(ifcopenshell.guid.new(),None,"Transient federation",None,None,None,None,[context],
        merged.createIfcUnitAssignment([merged.createIfcSIUnit(None,"LENGTHUNIT",None,"METRE")]))
    group_a,group_b,refs=[],[],{}
    expected=0;missing=[];snapshots=[]
    # Rebase the check frame near the first generated point, retaining double precision.
    check_origin=None
    source_handles=[]
    for source in sources:
        content=open(source["path"],"rb").read();digest=hashlib.sha256(content).hexdigest()
        if source.get("sourceHash") and digest!=source["sourceHash"]:raise ValueError("STALE_SNAPSHOT")
        model=ifcopenshell.open(source["path"]);source_handles.append(model)
        transform=source.get("transform",{})
        snapshots.append({"modelId":source["modelId"],"sourceHash":digest,"transform":transform})
        a=model.by_type(class_a) if source["modelId"] in scope_a else []
        b=model.by_type(class_b) if source["modelId"] in scope_b else []
        def eligible(p):
            return floor == "all" or spatial_location(p)[0] == floor
        a={p.id() for p in a if eligible(p)};b={p.id() for p in b if eligible(p)}
        products=[model.by_id(i) for i in sorted(a|b)];expected+=len(products)
        if expected > MAX_CLASH_PRODUCTS:
            raise ClashScopeLimitError(expected)
        generated=set();settings=ifcopenshell.geom.settings();settings.set("use-world-coords",True)
        represented = [p for p in products if p.Representation is not None]
        iterator=ifcopenshell.geom.iterator(settings,model,1,include=represented) if represented else None
        if iterator and iterator.initialize():
            while True:
                shape=iterator.get();p=model.by_id(shape.id);generated.add(p.id())
                values=shape.geometry.verts;faces=shape.geometry.faces
                edges=Counter(tuple(sorted((faces[i+j],faces[i+(j+1)%3]))) for i in range(0,len(faces),3) for j in range(3))
                if not edges or any(count!=2 for count in edges.values()):
                    missing.append({"modelId":source["modelId"],"stepId":p.id(),"message":"Non-manifold source mesh is not a measured solid intersection"})
                    if not iterator.next():break
                    continue
                points=[transform_point(values[i:i+3],transform) for i in range(0,len(values),3)]
                if any(not math.isfinite(v) for point in points for v in point):raise ValueError("Non-finite geometry")
                if check_origin is None:check_origin=points[0]
                points=[tuple(v-check_origin[j] for j,v in enumerate(point)) for point in points]
                coords=merged.createIfcCartesianPointList3D(points)
                mesh=merged.createIfcTriangulatedFaceSet(coords,None,True,
                    [tuple(int(faces[i+j])+1 for j in range(3)) for i in range(0,len(faces),3)],None)
                rep=merged.createIfcShapeRepresentation(context,"Body","Tessellation",[mesh])
                proxy=merged.create_entity("IfcBuildingElementProxy",GlobalId=ifcopenshell.guid.new(),Name=p.Name,
                    Representation=merged.createIfcProductDefinitionShape(None,None,[rep]))
                storey, _ = spatial_location(p)
                refs[proxy.id()]={"id":source.get("idPrefix","")+digest[:16]+":"+str(p.id()),"name":p.Name or p.is_a(),
                    "storey":storey,"modelId":source["modelId"]}
                if p.id() in a:group_a.append(proxy)
                if p.id() in b:group_b.append(proxy)
                if not iterator.next():break
        missing.extend({"modelId":source["modelId"],"stepId":p.id()} for p in products if p.id() not in generated)
    tree=ifcopenshell.geom.tree();it=ifcopenshell.geom.iterator(ifcopenshell.geom.settings(),merged,1)
    check_generated=set()
    if it.initialize():
        while True:
            shape=it.get();tree.add_element(shape);check_generated.add(shape.id)
            if not it.next():break
    missing.extend({"transientId":i,"message":"Check mesh conversion failed"} for i in refs if i not in check_generated)
    group_a = [p for p in group_a if p.id() in check_generated]
    group_b = [p for p in group_b if p.id() in check_generated]
    has_candidate_groups = bool(group_a and group_b)
    clashes=tree.clash_intersection_many(group_a,group_b,tolerance=tolerance,check_all=True) if has_candidate_groups else []
    findings=[];seen=set();unmeasured=0
    for clash in clashes:
        a,b=refs[clash.a.id()],refs[clash.b.id()];pair=tuple(sorted([a["id"],b["id"]]))
        if pair[0]==pair[1] or pair in seen:continue
        seen.add(pair)
        if clash.clash_type not in (0,1):unmeasured+=1;continue
        findings.append({"a":a["id"],"b":b["id"],"title":a["name"]+" × "+b["name"],"storey":a["storey"],
            "severity":"high","status":"new","rule":f"{class_a} × {class_b}","demo":False,"distance":clash.distance,
            "measurementKind":"protrusion" if clash.clash_type==0 else "pierce",
            "pointA":[v+check_origin[i] for i,v in enumerate(clash.p1)],"pointB":[v+check_origin[i] for i,v in enumerate(clash.p2)]})
    findings.sort(key=lambda f:(f["a"],f["b"]))
    for i,finding in enumerate(findings):finding["id"]=f"H-{i+1:04d}"
    import json
    return {"findings":findings[:1000],"snapshots":snapshots,"sourceHash":hashlib.sha256(json.dumps(snapshots,sort_keys=True).encode()).hexdigest(),
        "engineVersion":ifcopenshell.version,"method":"IfcOpenShell triangle intersection; float64 canonical geometry; rigid transforms",
        "rule":{"classA":class_a,"classB":class_b,"floor":floor,"toleranceMetres":tolerance,
            "modelIdsA":sorted(scope_a),"modelIdsB":sorted(scope_b)},
        "coverage":{"expected":expected,"generated":len(check_generated),"missing":missing,"groupA":len(group_a),"groupB":len(group_b),
            "limitReached":len(findings)>1000,"complete":has_candidate_groups and not missing and not unmeasured and len(findings)<=1000,
            "hasCandidateGroups":has_candidate_groups,"unmeasuredCollisionPairs":unmeasured}}
