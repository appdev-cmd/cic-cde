import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import ifcopenshell
import ifcopenshell.util.element

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("worker", ROOT / "workers/bim/src/qabim_worker/main.py")
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


def test_fixture_has_complete_geometry_and_unique_identity(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "DATA", tmp_path)
    result = worker.import_model(str(ROOT / "tests/fixtures/synthetic/riverside-demo.ifc"))
    manifest = json.loads((ROOT / "tests/fixtures/manifest.json").read_text())
    assert result["model"]["hash"] == manifest["fixtures"][0]["sha256"]
    assert result["coverage"]["generated"] == result["coverage"]["expected"] == 399
    assert result["coverage"]["failed"] == []
    assert len({e["id"] for e in result["elements"]}) == 399
    assert len({e["globalId"] for e in result["elements"]}) == 399
    for element in result["elements"]:
        vertices,indices=worker.decode_element(result,element,tmp_path/"models"/result["model"]["hash"])
        assert vertices and indices
        assert max(indices)<len(vertices)//3
        assert "vertices" not in element and "indices" not in element
    assert {e["storey"] for e in result["elements"]} == {f"L{i:02d}" for i in range(1, 8)}


def test_room_containment_keeps_the_ifc_storey(tmp_path, monkeypatch):
    monkeypatch.setattr(worker, "DATA", tmp_path / "cache")
    model = ifcopenshell.open(str(ROOT / "tests/fixtures/synthetic/riverside-demo.ifc"))
    product = model.by_type("IfcColumn")[0]
    relation = product.ContainedInStructure[0]
    storey = relation.RelatingStructure
    space = model.create_entity("IfcSpace", GlobalId=ifcopenshell.guid.new(),
                                Name="106", LongName="WC VĐV NAM")
    model.create_entity("IfcRelAggregates", GlobalId=ifcopenshell.guid.new(),
                        RelatingObject=storey, RelatedObjects=[space])
    remaining = [element for element in relation.RelatedElements if element != product]
    if remaining:
        relation.RelatedElements = remaining
    else:
        model.remove(relation)
    model.create_entity("IfcRelContainedInSpatialStructure", GlobalId=ifcopenshell.guid.new(),
                        RelatingStructure=space, RelatedElements=[product])
    path = tmp_path / "with-room.ifc"
    model.write(str(path))

    result = worker.import_model(str(path))
    element = next(element for element in result["elements"] if element["globalId"] == product.GlobalId)
    assert element["storey"] == storey.Name
    assert element["space"] == {"id": space.GlobalId, "number": "106", "name": "WC VĐV NAM"}


def test_protocol_errors_and_capabilities_are_explicit():
    response = worker.respond("worker.hello", {})
    assert response["result"]["protocolVersion"] == 1
    assert "preview_mesh" in response["result"]["capabilities"]
    assert "clash" not in response["result"]["capabilities"]
    assert "error" in worker.respond("shell.execute", {})


def test_non_ifc_input_is_rejected(tmp_path):
    file = tmp_path / "model.txt"
    file.write_text("not IFC")
    with pytest.raises(ValueError, match="IFC STEP"):
        worker.import_model(str(file))


def test_windows_protocol_is_utf8_for_vietnamese_names(tmp_path):
    result = subprocess.run([sys.executable, str(ROOT / "workers/bim/src/qabim_worker/main.py"),
        "--once", "model.import", json.dumps({"path":str(ROOT / "tests/fixtures/synthetic/import-smoke.ifc"), "name":"Kiểm tra · Hà Nội.ifc"})],
        capture_output=True, check=True, timeout=30, env={**os.environ,"QABIM_DATA_DIR":str(tmp_path)})
    response = json.loads(result.stdout.decode("utf-8"))
    assert response["result"]["model"]["name"] == "Kiểm tra · Hà Nội.ifc"


@pytest.mark.parametrize("offset,expected", [((.15,.13,.17),1),((3.,3.,0.),0),((.44,0.,0.),0)])
def test_exact_intersection_distinguishes_overlap_separation_and_touch(tmp_path, offset, expected):
    original=ifcopenshell.open(str(ROOT / "tests/fixtures/synthetic/riverside-demo.ifc"))
    model=ifcopenshell.file(schema="IFC4")
    model.add(original.by_type("IfcProject")[0])
    a=model.add(original.by_type("IfcColumn")[0])
    b=ifcopenshell.util.element.copy_deep(model,a)
    b.GlobalId=ifcopenshell.guid.new()
    b.ObjectPlacement.RelativePlacement.Location.Coordinates=offset
    path=tmp_path/"pair.ifc";model.write(str(path))
    result=worker.run_check({"path":str(path),"classA":"IfcColumn","classB":"IfcColumn","tolerance":.002})
    assert result["coverage"]["complete"]
    assert result["coverage"]["generated"]==2
    assert len(result["findings"])==expected
    if expected:
        assert result["findings"][0]["distance"]>0
        assert result["findings"][0]["demo"] is False


def test_check_scope_and_snapshot_are_explicit():
    params={"path":str(ROOT / "tests/fixtures/synthetic/riverside-demo.ifc"),"floor":"L05"}
    result=worker.run_check(params)
    assert len(result["findings"])==6
    assert result["coverage"]["groupA"]==12
    assert result["coverage"]["groupB"]==9
    assert all(f["storey"]=="L05" for f in result["findings"])
    with pytest.raises(ValueError,match="STALE_SNAPSHOT"):
        worker.run_check({**params,"sourceHash":"bad-hash"})
    with pytest.raises(ValueError,match="Tolerance"):
        worker.run_check({**params,"tolerance":float('nan')})
