"""Exercise upload, binary assets, federated checking and persisted alignment."""
import json
import pathlib
import struct
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
API="http://127.0.0.1:4318"
def rpc(operation,input):
    request=urllib.request.Request(API+"/rpc",data=json.dumps({"operation":operation,"input":input}).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(request,timeout=120) as response:return json.load(response)["result"]
def upload(name):
    path=ROOT/"tests/fixtures/synthetic"/name;boundary="qabim-federation-upload"
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/octet-stream\r\n\r\n').encode()+path.read_bytes()+f'\r\n--{boundary}--\r\n'.encode()
    request=urllib.request.Request(API+"/import",data=body,headers={"Content-Type":f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(request,timeout=120) as response:return json.load(response)["result"]
structure=upload("riverside-structure.ifc");services=upload("riverside-services.ifc")
assert len(structure["elements"])==280 and len(services["elements"])==105
assert all("vertices" not in e and "geometry" in e for e in services["elements"])
asset=services["model"]["geometryAssets"][0]
with urllib.request.urlopen(API+"/geometry/"+asset["id"],timeout=15) as response:
    binary=response.read();assert response.headers["Cache-Control"].endswith("immutable")
magic,version,nv,ni=struct.unpack_from("<4sIII",binary)
assert magic==b"QBM1" and version==1 and len(binary)==16+4*(nv+ni)
params={"modelIdsA":[services["model"]["id"]],"modelIdsB":[structure["model"]["id"]],"classA":"IfcDuctSegment","classB":"IfcBeam","floor":"all","tolerance":.002}
current=services["model"]
def align(offset):
    global current
    current=rpc("models.transform",{"modelId":current["id"],"expectedRevision":current["transform"]["revision"],"translation":offset,"rotationZDegrees":0})
try:
    align([0,0,0]);full=rpc("checks.run",params);assert len(full["findings"])==42 and full["coverage"]["complete"]
    align([100,0,0]);separated=rpc("checks.run",params);assert not separated["findings"] and separated["coverage"]["complete"]
finally:
    align([0,0,0])
level=rpc("checks.run",{**params,"floor":"L05"});assert len(level["findings"])==6
print(json.dumps({"status":"passed","models":[structure["model"]["id"],services["model"]["id"]],"full":42,"translated":0,"L05":6,"coverage":full["coverage"],"binaryAssetBytes":len(binary)}))
