"""Split the generated project into two independently serialized IFC files."""
from pathlib import Path
import hashlib
import json
import uuid
import ifcopenshell
import ifcopenshell.util.element

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/"tests/fixtures/synthetic"
source=ifcopenshell.open(str(OUT/"riverside-demo.ifc"))
def guid(name):return ifcopenshell.guid.compress(uuid.uuid5(uuid.NAMESPACE_URL,"qabim-federation/"+name).hex)
manifest=[]
for name,classes in [("riverside-structure",["IfcBeam","IfcColumn","IfcSlab"]),("riverside-services",["IfcDuctSegment","IfcPipeSegment"])]:
    model=ifcopenshell.file(schema="IFC4");model.header.file_name.time_stamp="2026-11-05T00:00:00"
    project=model.add(source.by_type("IfcProject")[0]);building=model.add(source.by_type("IfcBuilding")[0])
    levels={level.id():model.add(level) for level in source.by_type("IfcBuildingStorey")}
    model.createIfcRelAggregates(guid(name+"-building"),None,None,None,project,[building])
    model.createIfcRelAggregates(guid(name+"-levels"),None,None,None,building,list(levels.values()))
    contained={key:[] for key in levels}
    for product in source.by_type("IfcProduct"):
        if product.is_a() not in classes:continue
        copy=model.add(product);level=ifcopenshell.util.element.get_container(product)
        contained[level.id()].append(copy)
    for key,products in contained.items():
        if products:model.createIfcRelContainedInSpatialStructure(guid(name+str(key)),None,None,None,products,levels[key])
    path=OUT/(name+".ifc");model.write(str(path))
    manifest.append({"file":path.name,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"elements":sum(map(len,contained.values())),"license":"CC0-1.0"})
(OUT.parent/"federation-manifest.json").write_text(json.dumps({"sources":manifest,"expectedDuctBeamIntersections":42,"expectedL05":6},indent=2),encoding="utf-8")
print(json.dumps(manifest))
