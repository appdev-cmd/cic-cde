"""Create a redistributable, deterministic IFC4 coordination fixture and its preview."""
import hashlib
import importlib.util
import json
from pathlib import Path
import uuid
import shutil
import ifcopenshell

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/"tests/fixtures/synthetic"
OUT.mkdir(parents=True,exist_ok=True)
f=ifcopenshell.file(schema="IFC4")
f.header.file_name.time_stamp="2026-11-05T00:00:00"
def guid(name): return ifcopenshell.guid.compress(uuid.uuid5(uuid.NAMESPACE_URL,"qabim/"+name).hex)
def point(v): return f.createIfcCartesianPoint(tuple(float(x) for x in v))
def axis(v=(0.,0.,0.)): return f.createIfcAxis2Placement3D(point(v),None,None)
context=f.createIfcGeometricRepresentationContext(None,"Model",3,1.e-6,axis(),None)
units=f.createIfcUnitAssignment([f.createIfcSIUnit(None,"LENGTHUNIT",None,"METRE")])
project=f.create_entity("IfcProject",GlobalId=guid("project"),Name="QA BIM coordination fixture",RepresentationContexts=[context],UnitsInContext=units)
building=f.create_entity("IfcBuilding",GlobalId=guid("building"),Name="Riverside Tower — synthetic")
f.create_entity("IfcRelAggregates",GlobalId=guid("aggregate"),RelatingObject=project,RelatedObjects=[building])
storeys=[]
for floor in range(7):
    level=f.create_entity("IfcBuildingStorey",GlobalId=guid(f"level{floor}"),Name=f"L{floor+1:02d}",Elevation=float(floor*3.6))
    storeys.append(level)
f.create_entity("IfcRelAggregates",GlobalId=guid("levels"),RelatingObject=building,RelatedObjects=storeys)
contents={i:[] for i in range(7)}
def box(kind,name,pos,size,floor):
    dx,dy,dz=map(float,size)
    profile=f.createIfcRectangleProfileDef("AREA",None,None,dx,dy)
    solid=f.createIfcExtrudedAreaSolid(profile,axis(),f.createIfcDirection((0.,0.,1.)),dz)
    rep=f.createIfcShapeRepresentation(context,"Body","SweptSolid",[solid])
    shape=f.createIfcProductDefinitionShape(None,None,[rep])
    placement=f.createIfcLocalPlacement(None,axis((pos[0]+dx/2,pos[1]+dy/2,pos[2])))
    element=f.create_entity(kind,GlobalId=guid(name),Name=name,ObjectPlacement=placement,Representation=shape)
    contents[floor].append(element)
    return element

for level in range(7):
    z=level*3.6
    box("IfcSlab",f"Slab · L{level+1:02d}",(-.4,-.4,z),(30.8,20.8,.22),level)
    for x in range(0,31,6):
        for y in range(0,21,5):
            box("IfcColumn",f"C{x//6+1}{y//5+1} · L{level+1:02d}",(x-.22,y-.22,z),(.44,.44,3.6),level)
    for y in range(0,21,5):
        box("IfcBeam",f"B{y//5+1} · L{level+1:02d}",(-.22,y-.18,z+3.05),(30.44,.36,.55),level)
    for x in [0,12,24,30]:
        box("IfcBeam",f"Crossbeam {x} · L{level+1:02d}",(x-.18,0,z+3.05),(.36,20,.55),level)
    # Three exposed services corridors per floor; one route deliberately intersects a beam.
    for i,y in enumerate([2.0,8.0,16.5]):
        box("IfcDuctSegment",f"SA-{level+1:02d}{i+1} Supply duct",(1,y,z+2.65),(28,.65,.45),level)
        box("IfcPipeSegment",f"CHW-{level+1:02d}{i+1} Chilled water",(1,y+1.1,z+2.85),(28,.13,.13),level)
        for x in [6,18,25]:
            box("IfcDuctSegment",f"Branch {level}-{i}-{x}",(x,y,z+2.65),(.38,2.0,.28),level)
    box("IfcWall",f"Core west · L{level+1:02d}",(12,8,z),(.25,4,3.6),level)
    box("IfcWall",f"Core east · L{level+1:02d}",(17,8,z),(.25,4,3.6),level)
    f.create_entity("IfcRelContainedInSpatialStructure",GlobalId=guid(f"contains{level}"),RelatingStructure=storeys[level],RelatedElements=contents[level])

source=OUT/"riverside-demo.ifc"
f.write(str(source))
smoke=ifcopenshell.file(schema="IFC4")
smoke.add(f.by_type("IfcProject")[0]);smoke.add(f.by_type("IfcColumn")[0]);smoke.add(f.by_type("IfcSlab")[0])
smoke.header.file_name.time_stamp="2026-11-05T00:00:00"
smoke.write(str(OUT/"import-smoke.ifc"))
spec=importlib.util.spec_from_file_location("worker",ROOT/"workers/bim/src/qabim_worker/main.py")
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)
result=worker.import_model(str(source))
public=ROOT/"apps/desktop/public";public.mkdir(parents=True,exist_ok=True)
assets=[]
for asset in result["model"]["geometryAssets"]:
    entry={**asset,"id":"demo-"+asset["id"],"file":"demo-"+asset["id"]+".qmesh"}
    (public/"geometry").mkdir(exist_ok=True)
    shutil.copyfile(worker.DATA/"models"/result["model"]["hash"]/asset["file"],public/"geometry"/entry["file"])
    assets.append(entry)
elements=result["elements"]
models=[]
for discipline,name in [("STR","RVT_STR_Riverside_R03.ifc"),("HVAC","RVT_HVAC_Riverside_R02.ifc"),("PLUM","RVT_PLUM_Riverside_R02.ifc"),("ARC","RVT_ARC_Riverside_R04.ifc")]:
    mid=f"demo-{discipline.lower()}"
    members=[e for e in elements if e["discipline"]==discipline]
    for e in members:
        e["modelId"]=mid
        e["id"]="demo:"+e["id"]
    models.append({"id":mid,"name":name,"discipline":discipline,"schema":"IFC4","count":len(members),"status":"ready","synthetic":True,"geometryAssets":assets,"renderOrigin":result["model"]["renderOrigin"]})
findings=[]
for n,level in enumerate(["L05","L03","L06","L02","L07","L04"]):
    a=next(e for e in elements if e["storey"]==level and "Duct" in e["ifcClass"])
    b=next(e for e in elements if e["storey"]==level and e["ifcClass"]=="IfcBeam")
    findings.append({"id":f"CL-{n+1:03d}","title":"Ống gió cấp × Dầm kết cấu" if n%2==0 else "Khoảng hở tuyến MEP cần rà soát","a":a["id"],"b":b["id"],"storey":level,"severity":"high" if n%2==0 else "medium","status":"new" if n<3 else "reviewed","rule":"HVAC × Structure","demo":True})
data={"models":models,"elements":elements,"findings":findings,"coverage":result["coverage"],"synthetic":True}
public=ROOT/"apps/desktop/public";public.mkdir(parents=True,exist_ok=True)
(public/"demo.json").write_text(json.dumps(data,ensure_ascii=False),encoding="utf-8")
# This directory is owned by this generator; remove only its obsolete demo chunks.
active={asset["file"] for asset in assets}
owned=(public/"geometry").resolve()
for obsolete in owned.glob("demo-*.qmesh"):
    if not obsolete.is_symlink() and obsolete.name not in active and obsolete.resolve().parent==owned:
        obsolete.unlink()
manifest={"schemaVersion":1,"fixtures":[{"path":"synthetic/riverside-demo.ifc","sha256":hashlib.sha256(source.read_bytes()).hexdigest(),"license":"CC0-1.0","generatedBy":"workers/bim/scripts/create_fixture.py","schema":"IFC4","expectedElements":len(elements),"purpose":"Viewer geometry and identity. Finding rows are explicitly synthetic UX examples, not clash engine output."}]}
(OUT.parent/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
print(json.dumps({"elements":len(elements),"failures":len(result["coverage"]["failed"]),"previewBytes":(public/"demo.json").stat().st_size}))
