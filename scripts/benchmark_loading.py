"""Reproducible in-process benchmark; no production-size performance claim."""
import importlib.util
import json
import os
from pathlib import Path
import platform
import statistics
import tempfile
import time

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("worker_bench",ROOT/"workers/bim/src/qabim_worker/main.py")
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)
source=ROOT/"tests/fixtures/synthetic/riverside-demo.ifc"
cold_times=[];warm_times=[];baseline_times=[]
with tempfile.TemporaryDirectory(prefix="qb-") as temp:
    for repeat in range(3):
        worker.DATA=Path(temp)/str(repeat)
        cold=worker.import_model(str(source));warm=worker.import_model(str(source))
        cold_times.append(cold["timings"]["totalMs"]);warm_times.append(warm["timings"]["totalMs"])
        started=time.perf_counter();model=worker.ifcopenshell.open(str(source))
        settings=worker.ifcopenshell.geom.settings();settings.set("use-world-coords",True)
        legacy=[]
        for p in model.by_type("IfcProduct"):
            if not getattr(p,"Representation",None):continue
            shape=worker.ifcopenshell.geom.create_shape(settings,p)
            legacy.append({"id":p.id(),"vertices":list(shape.geometry.verts),"indices":list(shape.geometry.faces)})
        legacy_bytes=len(json.dumps(legacy).encode())
        baseline_times.append((time.perf_counter()-started)*1000)
    report={"fixture":str(source.relative_to(ROOT)),"sourceHash":cold["model"]["hash"],"products":len(cold["elements"]),
        "python":platform.python_version(),"engine":worker.ifcopenshell.version,"platform":platform.platform(),"logicalCpus":os.cpu_count(),
        "repeats":3,"legacyPerElementGeometryAndJsonMedianMs":statistics.median(baseline_times),
        "newColdImportMedianMs":statistics.median(cold_times),"warmCacheReadMedianMs":statistics.median(warm_times),
        "legacyGeometryJSONBytes":legacy_bytes,"binaryGeometryBytes":sum(a["bytes"] for a in cold["model"]["geometryAssets"]),
        "metadataBytes":len(json.dumps(cold).encode()),"chunks":len(cold["model"]["geometryAssets"]),
        "scope":"In-process worker timings on synthetic 399-product IFC. Legacy measures geometry + JSON only; new cold includes metadata and cache write. Excludes process startup, HTTP, GPU upload and real project datasets."}
    (ROOT/"docs/research/loading-benchmark.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report))
