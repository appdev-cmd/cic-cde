"""G1 worker. stdout is JSON-RPC only; one-shot mode is used by the Rust supervisor."""
import argparse
import hashlib
import json
import os
import math
import pathlib
import sys

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.element

ROOT = pathlib.Path(__file__).resolve().parents[4]
DATA = pathlib.Path(os.environ.get("QABIM_DATA_DIR", str(ROOT / ".local")))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from geometry_cache import ChunkWriter, cache_valid, decode_element, VERSION, SETTINGS
from federation import run_federation

COLORS = {"STR": "#c7cbd2", "HVAC": "#56a7ae", "PLUM": "#7291ce", "ARC": "#d9cbb8"}


def import_model(path: str, display_name=None):
    import time
    started=time.perf_counter()
    source=pathlib.Path(path).resolve()
    if source.suffix.lower() != ".ifc" or source.stat().st_size > 100*1024*1024:
        raise ValueError("G1 supports IFC STEP files up to 100 MB")
    source_bytes=source.read_bytes()
    digest=hashlib.sha256(source_bytes).hexdigest()
    model_id=digest[:16]
    store=DATA/"models"/digest
    store.mkdir(parents=True,exist_ok=True)
    snapshot=store/"source.ifc"
    if not snapshot.exists():
        temp=store/"source.staging.ifc";temp.write_bytes(source_bytes);temp.replace(snapshot)
    if hashlib.sha256(snapshot.read_bytes()).hexdigest()!=digest:
        raise ValueError("Snapshot hash mismatch")
    manifest=store/"preview.json"
    if manifest.exists():
        try:
            result=json.loads(manifest.read_text(encoding="utf-8"))
            if cache_valid(result,store,ifcopenshell.version):
                result["model"]["name"]=display_name or source.name
                result["timings"]={"cacheHit":True,"totalMs":(time.perf_counter()-started)*1000}
                return result
        except (ValueError,KeyError,OSError):
            pass
    model=ifcopenshell.open(str(snapshot))
    settings=ifcopenshell.geom.settings();settings.set("use-world-coords",True)
    products=[p for p in model.by_type("IfcProduct") if getattr(p,"Representation",None)]
    if len(products)>2000:
        raise ValueError("G1 preview is limited to 2,000 represented products; no partial silent import")
    elements=[];generated=set();float_count=0
    writer=ChunkWriter(store,model_id,ifcopenshell.version)
    if products:
        iterator=ifcopenshell.geom.iterator(settings,model,max(1,min(4,os.cpu_count() or 1)),include=products)
        if iterator.initialize():
            while True:
                shape=iterator.get();product=model.by_id(shape.id)
                vertices=list(shape.geometry.verts);faces=list(shape.geometry.faces)
                if any(not math.isfinite(v) for v in vertices):
                    raise ValueError("Non-finite geometry coordinates")
                float_count+=len(vertices)+len(faces)
                if float_count>2_000_000:
                    raise MemoryError("Preview geometry budget exceeded")
                kind=product.is_a()
                discipline="HVAC" if "Duct" in kind else "PLUM" if "Pipe" in kind else "ARC" if "Wall" in kind else "STR"
                container=ifcopenshell.util.element.get_container(product)
                element={"id":f"{model_id}:{product.id()}","globalId":product.GlobalId,"name":product.Name or kind,
                    "ifcClass":kind,"modelId":model_id,"discipline":discipline,"storey":container.Name if container else "Unassigned",
                    "color":COLORS[discipline],"properties":{"IFC GUID":product.GlobalId,"STEP ID":str(product.id()),
                    "IFC Class":kind,"Name":product.Name or kind,"Schema":model.schema}}
                writer.add(element,vertices,faces);elements.append(element);generated.add(product.id())
                if not iterator.next():break
    assets=writer.finish()
    failures=[{"stepId":p.id(),"message":"Geometry iterator did not produce this represented product"} for p in products if p.id() not in generated]
    result={"model":{"id":model_id,"name":display_name or source.name,"discipline":"IFC","schema":model.schema,
        "count":len(elements),"hash":digest,"status":"warnings" if failures else "ready","geometryAssets":assets,
        "renderOrigin":writer.origin or [0,0,0],"transform":{"translation":[0,0,0],"rotationZDegrees":0,"revision":0}},
        "elements":elements,"coverage":{"expected":len(products),"generated":len(elements),"failed":failures},
        "coordinateSystem":"IFC world coordinates, metres, Z-up","previewFormat":"QBM1 little-endian chunks",
        "cacheVersion":VERSION,"engineVersion":ifcopenshell.version,"geometrySettings":SETTINGS,
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
        container = ifcopenshell.util.element.get_container(product)
        return bool(getattr(product,"Representation",None)) and (floor == "all" or (container.Name if container else "Unassigned") == floor)
    group_a = [p for p in model.by_type(class_a) if in_scope(p)]
    group_b = [p for p in model.by_type(class_b) if in_scope(p)]
    products = {p.id():p for p in group_a + group_b}
    if len(products) > 2000:
        raise ValueError("G1 check is limited to 2,000 represented products")
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords",True)
    tree = ifcopenshell.geom.tree()
    generated = set()
    if products:
        iterator = ifcopenshell.geom.iterator(settings, model, 1, include=list(products.values()))
        if iterator.initialize():
            while True:
                shape = iterator.get()
                tree.add_element(shape)
                generated.add(shape.id)
                if not iterator.next():
                    break
    clashes = tree.clash_intersection_many(group_a,group_b,tolerance=tolerance,check_all=True) if group_a and group_b else []
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
        container=ifcopenshell.util.element.get_container(a)
        findings.append({"id":f"H-{len(findings)+1:04d}","a":prefix+str(aid),"b":prefix+str(bid),
            "title":f"{a.Name or class_a} × {b.Name or class_b}","storey":container.Name if container else "Unassigned",
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
                    "complete":not missing and len(findings)<=1000 and unmeasured==0,
                    "hasCandidateGroups":bool(group_a and group_b),"unmeasuredCollisionPairs":unmeasured}}


def respond(method, params, request_id=1):
    try:
        return {"jsonrpc":"2.0","id":request_id,"result":dispatch(method,params)}
    except Exception as error:
        return {"jsonrpc":"2.0","id":request_id,"error":{"code":-32000,"message":str(error)}}


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
