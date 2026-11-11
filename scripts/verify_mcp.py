"""Integration smoke test against the actual rmcp stdio binary and running local core."""
import json
import pathlib
import subprocess
import threading
import queue

root = pathlib.Path(__file__).resolve().parents[1]
p = subprocess.Popen([str(root / "target/debug/qabim-mcp.exe")], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8")
responses = queue.Queue()


def reader():
    for line in p.stdout:
        responses.put(json.loads(line))


threading.Thread(target=reader, daemon=True).start()


def send(payload):
    p.stdin.write(json.dumps(payload) + "\n")
    p.stdin.flush()


def request(request_id, method, params):
    send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
    while True:
        response = responses.get(timeout=15)
        if response.get("id") == request_id:
            assert "error" not in response, response
            return response["result"]


try:
    init = request(1, "initialize", {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "qabim-smoke", "version": "0.1"}})
    send({"jsonrpc": "2.0", "method": "notifications/initialized"})
    tools = request(2, "tools/list", {})
    assert {t["name"] for t in tools["tools"]} == {"project_get", "models_list", "elements_search", "checks_run"}
    project = request(3, "tools/call", {"name": "project_get", "arguments": {}})
    body = json.loads(project["content"][0]["text"])
    assert body["result"]["id"] == "demo-project", body
    elements = request(4, "tools/call", {"name": "elements_search", "arguments": {"query": "IfcBeam"}})
    query = json.loads(elements["content"][0]["text"])
    assert query["result"]["total"] > 0
    check=request(5,"tools/call",{"name":"checks_run","arguments":{"floor":"L05"}})
    run=json.loads(check["content"][0]["text"])["result"]
    assert len(run["findings"])==6 and run["coverage"]["complete"]
    print(json.dumps({"status": "passed", "protocol": init["protocolVersion"], "tools": len(tools["tools"]), "project": body["result"]["name"], "beams": query["result"]["total"],"L05Intersections":len(run["findings"])}, ensure_ascii=False))
finally:
    p.terminate()
    p.wait(timeout=5)
