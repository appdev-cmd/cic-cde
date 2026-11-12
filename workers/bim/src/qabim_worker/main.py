"""G1 worker. stdout is JSON-RPC only; one-shot mode is used by the Rust supervisor."""
import argparse
import hashlib
import json
import os
import math
import pathlib
import shutil
import sys

import ifcopenshell
import ifcopenshell.geom
from ifcopenshell.util.shape import get_shape_vertices

ROOT = pathlib.Path(__file__).resolve().parents[4]
DATA = pathlib.Path(os.environ.get("QABIM_DATA_DIR", str(ROOT / ".local")))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from geometry_cache import ChunkWriter, cache_valid, decode_element, VERSION, SETTINGS
from federation import ClashScopeLimitError, MAX_CLASH_PRODUCTS, run_federation
from spatial import spatial_location
from terrain_preview import SVDSP_GRADE_ID, SVDSP_PREVIEW_VERSION, SVDSP_TERRAIN_HASH, pavement_footprint, trim_grade

COLORS = {"STR": "#c7cbd2", "HVAC": "#56a7ae", "PLUM": "#7291ce", "ARC": "#d9cbb8"}
MAX_PREVIEW_PRODUCTS = 25_000
MAX_PREVIEW_COORDINATES_AND_INDICES = 24_000_000
MAX_IFC_BYTES = 500_000_000
REUSE_GEOMETRY_AFTER_PRODUCTS = 12_000


class PreviewLimitError(ValueError):
    def __init__(self, message, reason, **details):
        super().__init__(message)
        self.details = {"reason": reason, **details}


def file_hash(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def apply_surface_styles(element, materials, material_ids, faces):
    styles = []
    for style in materials:
        color = element["color"]
        rgb = style.get_color()
        channels = (rgb.r(), rgb.g(), rgb.b())
        if all(math.isfinite(channel) for channel in channels):
            color = "#" + "".join(f"{round(255 * min(1, max(0, channel))):02x}" for channel in channels)
        transparency = style.transparency if style.has_transparency() else 0
        opacity = round(1 - min(1, max(0, transparency)), 4) if math.isfinite(transparency) else 1
        styles.append((color, opacity))

    if not styles or not faces or len(material_ids) * 3 != len(faces):
        return faces
    fallback = (element["color"], 1)
    groups = {}
    for triangle, index in enumerate(material_ids):
        style = styles[index] if 0 <= index < len(styles) else fallback
        groups.setdefault(style, []).extend(faces[triangle * 3:triangle * 3 + 3])
    if len(groups) == 1:
        color, opacity = next(iter(groups))
        if any(index >= 0 for index in material_ids):
            element.update(color=color, surfaceOpacity=opacity)
        return faces

    grouped_faces = []
    ranges = []
    for (color, opacity), indices in groups.items():
        ranges.append({"start": len(grouped_faces), "count": len(indices), "color": color, "opacity": opacity})
        grouped_faces.extend(indices)
    element["surfaceMaterials"] = ranges
    return grouped_faces


def import_model(path: str, display_name=None):
    import time
    started=time.perf_counter()
    source=pathlib.Path(path).resolve()
    if source.suffix.lower() != ".ifc" or source.stat().st_size > MAX_IFC_BYTES:
        raise ValueError("IFC STEP files must be at most 500 MB")
    digest=file_hash(source)
    model_id=digest[:16]
    terrain_preview = digest == SVDSP_TERRAIN_HASH
    preview_version = SVDSP_PREVIEW_VERSION if terrain_preview else VERSION
    store=DATA/"models"/digest
    store.mkdir(parents=True,exist_ok=True)
    snapshot=store/"source.ifc"
    if not snapshot.exists():
        temp = store / "source.staging.ifc"
        if source.parent == DATA.resolve():
            # The cloud worker owns this temporary download on the same volume.
            os.link(source, temp)
        else:
            shutil.copyfile(source, temp)
        temp.replace(snapshot)
    if file_hash(snapshot)!=digest:
        raise ValueError("Snapshot hash mismatch")
    manifest=store/"preview.json"
    if manifest.exists():
        try:
            result=json.loads(manifest.read_text(encoding="utf-8"))
            if cache_valid(result,store,ifcopenshell.version,preview_version):
                result["model"]["name"]=display_name or source.name
                result["timings"]={"cacheHit":True,"totalMs":(time.perf_counter()-started)*1000}
                return result
        except (ValueError,KeyError,OSError):
            pass
    model=ifcopenshell.open(str(snapshot))
    settings=ifcopenshell.geom.settings();settings.set("use-world-coords",True)
    settings.set("apply-default-materials", False)
    footprint = pavement_footprint(model, settings) if terrain_preview else None
    products=[p for p in model.by_type("IfcProduct") if getattr(p,"Representation",None)]
    if len(products) > MAX_PREVIEW_PRODUCTS:
        raise PreviewLimitError(
            f"Preview product limit: {len(products)} > {MAX_PREVIEW_PRODUCTS}",
            "preview_products", count=len(products), limit=MAX_PREVIEW_PRODUCTS,
        )
    # Local geometry lets the iterator reuse shared IFC representations. Keep
    # the preview in world coordinates by applying each product's placement.
    reuse_geometry = len(products) > REUSE_GEOMETRY_AFTER_PRODUCTS and not terrain_preview
    if reuse_geometry:
        settings.set("use-world-coords", False)
    elements=[];generated=set();float_count=0
    writer=ChunkWriter(store,model_id,ifcopenshell.version)
    if products:
        iterator=ifcopenshell.geom.iterator(settings,model,max(1,min(4,os.cpu_count() or 1)),include=products)
        if iterator.initialize():
            while True:
                shape=iterator.get();product=model.by_id(shape.id)
                vertices = (
                    get_shape_vertices(shape, shape.geometry).ravel().tolist()
                    if reuse_geometry else list(shape.geometry.verts)
                )
                faces=list(shape.geometry.faces)
                material_ids = shape.geometry.material_ids
                if footprint is not None and product.GlobalId == SVDSP_GRADE_ID:
                    faces, material_ids = trim_grade(vertices, faces, material_ids, footprint)
                if any(not math.isfinite(v) for v in vertices):
                    raise ValueError("Non-finite geometry coordinates")
                float_count+=len(vertices)+len(faces)
                if float_count > MAX_PREVIEW_COORDINATES_AND_INDICES:
                    raise PreviewLimitError("Preview geometry budget exceeded", "preview_geometry")
                kind=product.is_a()
                discipline="HVAC" if "Duct" in kind else "PLUM" if "Pipe" in kind else "ARC" if "Wall" in kind else "STR"
                storey, space = spatial_location(product)
                element={"id":f"{model_id}:{product.id()}","globalId":product.GlobalId,"name":product.Name or kind,
                    "ifcClass":kind,"modelId":model_id,"discipline":discipline,"storey":storey,
                    "color":COLORS[discipline],"properties":{"IFC GUID":product.GlobalId,"STEP ID":str(product.id()),
                    "IFC Class":kind,"Name":product.Name or kind,"Schema":model.schema}}
                if space is not None:
                    element["space"] = space
                faces = apply_surface_styles(element, shape.geometry.materials, material_ids, faces)
                writer.add(element,vertices,faces);elements.append(element);generated.add(product.id())
                if not iterator.next():break
    assets=writer.finish()
    failures=[{"stepId":p.id(),"message":"Geometry iterator did not produce this represented product"} for p in products if p.id() not in generated]
    result={"model":{"id":model_id,"name":display_name or source.name,"discipline":"IFC","schema":model.schema,
        "count":len(elements),"hash":digest,"status":"warnings" if failures else "ready","geometryAssets":assets,
        "renderOrigin":writer.origin or [0,0,0],"previewVersion":preview_version,"transform":{"translation":[0,0,0],"rotationZDegrees":0,"revision":0}},
        "elements":elements,"coverage":{"expected":len(products),"generated":len(elements),"failed":failures},
        "coordinateSystem":"IFC world coordinates, metres, Z-up","previewFormat":"QBM1 little-endian chunks",
        "cacheVersion":preview_version,"engineVersion":ifcopenshell.version,"geometrySettings":SETTINGS,
        "timings":{"cacheHit":False,"totalMs":(time.perf_counter()-started)*1000}}
    staging=store/"preview.staging.json";staging.write_text(json.dumps(result,ensure_ascii=False),encoding="utf-8");staging.replace(manifest)
    return result


def dispatch(method, params):
    if method == "worker.hello":
        return {"protocolVersion":1,"engine":"IfcOpenShell","engineVersion":ifcopenshell.version,
                "capabilities":["metadata","preview_mesh","clash_intersection"],"stage":"G1-spike"}
    if method == "model.import":
        return import_model(params["path"], params.get("name"))
    if method == "checks.run":
        return run_federation(params) if "sources" in params else run_check(params)
    raise ValueError(f"Unsupported method: {method}")


def run_check(params):
    """Single-snapshot intersection spike. All distances and tolerance are in metres."""
    allowed = {"IfcBeam", "IfcColumn", "IfcSlab", "IfcWall", "IfcDuctSegment", "IfcPipeSegment"}
    class_a, class_b = params.get("classA", "IfcDuctSegment"), params.get("classB", "IfcBeam")
    if class_a not in allowed or class_b not in allowed:
        raise ValueError("Unsupported IFC class for this check")
    tolerance = float(params.get("tolerance", .002))
    if not math.isfinite(tolerance) or not .0001 <= tolerance <= 1:
        raise ValueError("Tolerance must be between 0.1 and 1000 mm")
    source = pathlib.Path(params["path"])
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if params.get("sourceHash") and params["sourceHash"] != digest:
        raise ValueError("STALE_SNAPSHOT: source hash mismatch")
    model = ifcopenshell.open(str(source))
    floor = params.get("floor", "all")
    def in_scope(product):
        return floor == "all" or spatial_location(product)[0] == floor
    group_a = [p for p in model.by_type(class_a) if in_scope(p)]
    group_b = [p for p in model.by_type(class_b) if in_scope(p)]
    products = {p.id():p for p in group_a + group_b}
    if len(products) > MAX_CLASH_PRODUCTS:
        raise ClashScopeLimitError(len(products))
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords",True)
    tree = ifcopenshell.geom.tree()
    generated = set()
    represented = [product for product in products.values() if product.Representation is not None]
    if represented:
        iterator = ifcopenshell.geom.iterator(settings, model, 1, include=represented)
        if iterator.initialize():
            while True:
                shape = iterator.get()
                tree.add_element(shape)
                generated.add(shape.id)
                if not iterator.next():
                    break
    group_a = [product for product in group_a if product.id() in generated]
    group_b = [product for product in group_b if product.id() in generated]
    has_candidate_groups = bool(group_a and group_b)
    clashes = tree.clash_intersection_many(group_a,group_b,tolerance=tolerance,check_all=True) if has_candidate_groups else []
    prefix = params.get("idPrefix", "") + digest[:16] + ":"
    findings,seen = [],set()
    for clash in clashes:
        aid,bid=clash.a.id(),clash.b.id()
        key=tuple(sorted((aid,bid)))
        if aid==bid or key in seen:
            continue
        seen.add(key)
        # Non-manifold fallback collision is not reported as a measured hard intersection.
        if clash.clash_type not in (0,1):
            continue
        a,b=products[aid],products[bid]
        storey, _ = spatial_location(a)
        findings.append({"id":f"H-{len(findings)+1:04d}","a":prefix+str(aid),"b":prefix+str(bid),
            "title":f"{a.Name or class_a} × {b.Name or class_b}","storey":storey,
            "severity":"high","status":"new","rule":f"{class_a} × {class_b}","demo":False,
            "distance":clash.distance,"measurementKind":"protrusion" if clash.clash_type==0 else "pierce",
            "pointA":list(clash.p1),"pointB":list(clash.p2)})
    findings.sort(key=lambda f:(f["a"],f["b"]))
    for index,finding in enumerate(findings):
        finding["id"]=f"H-{index+1:04d}"
    missing=sorted(set(products)-generated)
    unmeasured=sum(1 for c in clashes if c.clash_type not in (0,1))
    return {"findings":findings[:1000],"sourceHash":digest,"engineVersion":ifcopenshell.version,
        "rule":{"classA":class_a,"classB":class_b,"floor":floor,"toleranceMetres":tolerance},
        "coverage":{"expected":len(products),"generated":len(generated),"missingStepIds":missing,
                    "groupA":len(group_a),"groupB":len(group_b),"limitReached":len(findings)>1000,
                    "complete":has_candidate_groups and not missing and len(findings)<=1000 and unmeasured==0,
                    "hasCandidateGroups":has_candidate_groups,"unmeasuredCollisionPairs":unmeasured}}


def respond(method, params, request_id=1):
    try:
        return {"jsonrpc":"2.0","id":request_id,"result":dispatch(method,params)}
    except Exception as error:
        detail = {"code": -32000, "message": str(error)}
        if isinstance(error, (PreviewLimitError, ClashScopeLimitError)):
            detail["data"] = error.details
        return {"jsonrpc": "2.0", "id": request_id, "error": detail}


if __name__ == "__main__":
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser=argparse.ArgumentParser()
    parser.add_argument("--once",nargs=2,metavar=("METHOD","PARAMS"))
    args=parser.parse_args()
    if args.once:
        print(json.dumps(respond(args.once[0],json.loads(args.once[1])),ensure_ascii=False))
    else:
        for line in sys.stdin:
            try:
                request=json.loads(line)
                result=respond(request["method"],request.get("params",{}),request.get("id"))
            except Exception as error:
                result={"jsonrpc":"2.0","id":None,"error":{"code":-32700,"message":str(error)}}
            print(json.dumps(result,ensure_ascii=False),flush=True)
