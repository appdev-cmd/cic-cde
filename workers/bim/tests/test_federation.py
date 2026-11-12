import hashlib
import importlib.util
from pathlib import Path

import ifcopenshell
import pytest

ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location("worker_federation_test",ROOT/"workers/bim/src/qabim_worker/main.py")
worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)


def source_file(path, name, position, millimetres=False):
    original=ifcopenshell.open(str(ROOT/"tests/fixtures/synthetic/riverside-demo.ifc"))
    model=ifcopenshell.file(schema="IFC4")
    model.add(original.by_type("IfcProject")[0]);product=model.add(original.by_type("IfcColumn")[0])
    product.Name=name
    product.ObjectPlacement.RelativePlacement.Location.Coordinates=tuple(map(float,position))
    if millimetres:
        model.by_type("IfcSIUnit")[0].Prefix="MILLI"
        for point in model.by_type("IfcCartesianPoint"):point.Coordinates=tuple(v*1000 for v in point.Coordinates)
        for profile in model.by_type("IfcRectangleProfileDef"):profile.XDim*=1000;profile.YDim*=1000
        for solid in model.by_type("IfcExtrudedAreaSolid"):solid.Depth*=1000
    model.write(str(path))
    return product.GlobalId,product.id()


@pytest.mark.parametrize("translation,expected", [([0,0,0],1),([10,0,0],0)])
def test_independent_files_with_same_guids_and_step_ids(tmp_path,translation,expected):
    a=tmp_path/"a.ifc";b=tmp_path/"b.ifc"
    assert source_file(a,"Structure",[0,0,0])==source_file(b,"MEP",[.15,.13,.17])
    result=worker.run_federation({"sources":[{"modelId":"a","path":str(a)},{"modelId":"b","path":str(b),"transform":{"translation":translation}}],
        "modelIdsA":["a"],"modelIdsB":["b"],"classA":"IfcColumn","classB":"IfcColumn"})
    assert result["coverage"]["complete"] and result["coverage"]["generated"]==2
    assert len(result["findings"])==expected
    if expected:assert result["findings"][0]["a"]!=result["findings"][0]["b"]


def test_units_rotation_and_large_coordinates(tmp_path):
    a=tmp_path/"a.ifc";b=tmp_path/"b.ifc"
    source_file(a,"Structure",[6000000,1000000,0])
    source_file(b,"Services mm",[3,0,0],millimetres=True)
    result=worker.run_federation({"sources":[{"modelId":"a","path":str(a)},
        {"modelId":"b","path":str(b),"transform":{"translation":[6000000.15,999997.13,.17],"rotationZDegrees":90,"revision":1}}],
        "modelIdsA":["a"],"modelIdsB":["b"],"classA":"IfcColumn","classB":"IfcColumn"})
    assert len(result["findings"])==1
    assert result["coverage"]["complete"]
    assert result["findings"][0]["pointA"][0]>5999999
    with pytest.raises(ValueError,match="STALE_SNAPSHOT"):
        worker.run_federation({"sources":[{"modelId":"a","path":str(a),"sourceHash":"bad"}],"modelIdsA":["a"],"modelIdsB":["a"]})


def test_multiple_models_in_each_group(tmp_path):
    sources=[]
    for name,pos in [("a",[0,0,0]),("b",[.15,.13,.17]),("c",[20,0,0])]:
        path=tmp_path/(name+".ifc");source_file(path,name,pos);sources.append({"modelId":name,"path":str(path)})
    result=worker.run_federation({"sources":sources,"modelIdsA":["a","c"],"modelIdsB":["b"],"classA":"IfcColumn","classB":"IfcColumn"})
    assert len(result["findings"])==1 and result["coverage"]["generated"]==3


@pytest.mark.parametrize("include_unrepresented_beam", [False, True])
def test_check_with_no_measurable_target_is_incomplete(tmp_path, include_unrepresented_beam):
    path = tmp_path / "no-target-geometry.ifc"
    source_file(path, "Column", [0, 0, 0])
    if include_unrepresented_beam:
        model = ifcopenshell.open(str(path))
        model.create_entity("IfcBeam", GlobalId=ifcopenshell.guid.new(), Name="Beam without geometry")
        model.write(str(path))

    classes = {"classA": "IfcColumn", "classB": "IfcBeam"}
    results = [
        worker.run_check({"path": str(path), **classes}),
        worker.run_federation({
            "sources": [{"modelId": "a", "path": str(path)}],
            "modelIdsA": ["a"], "modelIdsB": ["a"], **classes,
        }),
    ]
    for result in results:
        coverage = result["coverage"]
        assert not result["findings"]
        assert not coverage["complete"] and not coverage["hasCandidateGroups"]
        assert (coverage["groupA"], coverage["groupB"]) == (1, 0)
        assert coverage["expected"] == 1 + include_unrepresented_beam
        assert coverage["generated"] == 1


def test_oversized_clash_scope_returns_actionable_error(tmp_path):
    path = tmp_path / "large-scope.ifc"
    model = ifcopenshell.file(schema="IFC4")
    for _ in range(worker.MAX_CLASH_PRODUCTS + 1):
        model.create_entity("IfcBeam", GlobalId=ifcopenshell.guid.new())
    model.write(str(path))

    reply = worker.respond("checks.run", {
        "sources": [{"modelId": "a", "path": str(path)}],
        "modelIdsA": ["a"], "modelIdsB": ["a"],
        "classA": "IfcBeam", "classB": "IfcBeam",
    })
    assert reply["error"]["data"] == {
        "reason": "clash_products",
        "count": worker.MAX_CLASH_PRODUCTS + 1,
        "limit": worker.MAX_CLASH_PRODUCTS,
    }
    assert "chọn một tầng" in reply["error"]["message"]


def test_warm_cache_and_corrupt_binary_rebuild(tmp_path,monkeypatch):
    monkeypatch.setattr(worker,"DATA",tmp_path/"cache")
    path=tmp_path/"cache-source.ifc";source_file(path,"Cache",[6000000,1000000,0])
    cold=worker.import_model(str(path));warm=worker.import_model(str(path))
    assert not cold["timings"]["cacheHit"] and warm["timings"]["cacheHit"]
    assert warm["elements"]==cold["elements"]
    folder=worker.DATA/"models"/cold["model"]["hash"]
    positions,_=worker.decode_element(cold,cold["elements"][0],folder)
    assert min(positions[::3])==pytest.approx(5999999.78,abs=1e-5)
    asset=cold["model"]["geometryAssets"][0]
    (folder/asset["file"]).write_bytes(b"corrupt")
    rebuilt=worker.import_model(str(path))
    assert not rebuilt["timings"]["cacheHit"]
    asset=rebuilt["model"]["geometryAssets"][0]
    assert hashlib.sha256((folder/asset["file"]).read_bytes()).hexdigest()==asset["sha256"]
