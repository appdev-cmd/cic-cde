"""Integration checks for background upload/import cancellation against the local core."""
import json, pathlib, time, urllib.request, sqlite3
ROOT=pathlib.Path(__file__).resolve().parents[1]
API="http://127.0.0.1:4318"
def rpc(operation, payload):
    request=urllib.request.Request(API+"/rpc",data=json.dumps({"operation":operation,"input":payload}).encode(),headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(request,timeout=15) as response: return json.load(response)["result"]
def start(content,name):
    boundary="qabim-import-job"
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="job"; filename="{name}"\r\n\r\n').encode()+content+f'\r\n--{boundary}--\r\n'.encode()
    request=urllib.request.Request(API+"/import",data=body,headers={"Content-Type":f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(request,timeout=15) as response:return json.load(response)["result"]
def audit_count():
    with sqlite3.connect(ROOT/".local/workspace.sqlite") as db: return db.execute("select count(*) from audit_entries").fetchone()[0]
source=(ROOT/"tests/fixtures/synthetic/riverside-services.ifc").read_bytes()
before=rpc("workspace.get",{}); audit=audit_count()
job=start(source,"cancelled-import.ifc")
time.sleep(.15)
phase=rpc("jobs.get",job)["phase"]
assert phase in ("queued","processing"),phase
assert rpc("jobs.cancel",job)["phase"]=="cancelled"
time.sleep(1)
assert rpc("jobs.get",job)["phase"]=="cancelled"
assert rpc("workspace.get",{})==before
assert audit_count()==audit
bad=start(b"ISO-10303-21; invalid", "invalid.ifc")
for _ in range(150):
    result=rpc("jobs.get",bad)
    if result["phase"]=="failed":break
    time.sleep(.1)
assert result["phase"]=="failed",result
job=start(source,"riverside-services.ifc")
for _ in range(150):
    result=rpc("jobs.get",job)
    if result["phase"] in ("completed","failed"):break
    time.sleep(.1)
assert result["phase"]=="completed",result
assert len(result["result"]["elements"])==105
assert rpc("jobs.cancel",job)["phase"]=="completed"
assert rpc("jobs.get",bad)["phase"]=="failed"
print(json.dumps({"status":"passed","cancelledDuring":phase,"cancelLeavesWorkspaceAndAuditUnchanged":True,"failureSurfaced":True,"completedElements":105,"terminalCancelIdempotent":True}))
