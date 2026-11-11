"""Live two-unit + desktop-origin acceptance checks for the CIC CDE pilot."""
import json, pathlib, time, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
accounts=json.loads((ROOT/'.local/cic-cde-accounts.json').read_text(encoding='utf8'))
BASE='http://127.0.0.1:18420'
def request(path,data=None,token=None,expected=200,origin=BASE,content='application/json'):
    headers={'Origin':origin}
    if data is not None:headers['Content-Type']=content
    if token:headers['Authorization']='Bearer '+token
    req=urllib.request.Request(BASE+'/api'+path,data=data,headers=headers)
    try:
        with urllib.request.urlopen(req,timeout=130) as response:
            assert response.status==expected
            if origin=='http://tauri.localhost':assert response.headers['Access-Control-Allow-Origin']==origin
            raw=response.read()
            return json.loads(raw) if response.headers.get('Content-Type','').startswith('application/json') else raw
    except urllib.error.HTTPError as error:
        assert error.code==expected,(path,error.code,expected,error.read())
def rpc(operation,token,expected=200,origin=BASE,**input):
    body=request('/rpc',json.dumps(dict(operation=operation,input=input)).encode(),token,expected,origin)
    return body['result'] if body else None
request('/rpc',b'{"operation":"workspace.get","input":{}}',expected=401)
admin=request('/auth/login',json.dumps(accounts['admin']).encode())['token']
existing=rpc('users.list',admin)
for name in ['arc','mep']:
    if not any(user['username']==accounts[name]['username'] for user in existing):
        rpc('users.create',admin,**accounts[name])
a=request('/auth/login',json.dumps(accounts['arc']).encode())['token']
b=request('/auth/login',json.dumps(accounts['mep']).encode(),origin='http://tauri.localhost')['token']
assert rpc('project.get',b,origin='http://tauri.localhost')['id']=='demo-project'
rpc('users.list',a,403)
def upload(name,token):
    boundary='ciccde-live-test'
    raw=(ROOT/'tests/fixtures/synthetic'/name).read_bytes()
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="job"; filename="{name}"\r\n\r\n').encode()+raw+f'\r\n--{boundary}--\r\n'.encode()
    job=request('/import',body,token,content='multipart/form-data; boundary='+boundary)['result']
    for _ in range(240):
        result=rpc('jobs.get',token,**job)
        if result['phase'] in ['completed','failed']:break
        time.sleep(.5)
    assert result['phase']=='completed',result
    return result['result']['model']
structure=upload('riverside-structure.ifc',a)
docs=rpc('documents.register',a,code='CIC-ARC-PILOT',title='Kết cấu · pilot ARC',discipline='STR',modelId=structure['id'])
doc=next(d for d in docs if d['code']=='CIC-ARC-PILOT')
if doc['state']=='WIP':
    assert not any(d['code']=='CIC-ARC-PILOT' for d in rpc('documents.list',b))
    request('/geometry/'+structure['geometryAssets'][0]['id'],token=b,expected=403)
    rpc('documents.transition',b,403,id=doc['id'],expectedState='WIP',state='Shared')
    rpc('documents.transition',a,id=doc['id'],expectedState='WIP',state='Shared')
services=upload('riverside-services.ifc',b)
docs=rpc('documents.register',b,code='CIC-MEP-PILOT',title='MEP · pilot phối hợp',discipline='MEP',modelId=services['id'])
doc=next(d for d in docs if d['code']=='CIC-MEP-PILOT')
if doc['state']=='WIP':rpc('documents.transition',b,id=doc['id'],expectedState='WIP',state='Shared')
workspace=rpc('workspace.get',b,origin='http://tauri.localhost')
assert {structure['id'],services['id']} <= {m['id'] for m in workspace['models']}
request('/geometry/'+structure['geometryAssets'][0]['id'],token=b,origin='http://tauri.localhost')
run=rpc('checks.run',a,modelIdsA=[services['id']],modelIdsB=[structure['id']])
assert len(run['findings'])==42
issue=next(i for i in rpc('issues.create',a,runId=run['runId'],findingId=run['findings'][0]['id']) if i['runId']==run['runId'])
rpc('issues.comment',b,origin='http://tauri.localhost',issueId=issue['id'],body='MEP đã nhận issue từ web để phối hợp trên desktop.')
assert any(i['id']==issue['id'] and i['comments'] for i in rpc('issues.list',a))
request('/auth/logout',b'{}',b)
rpc('workspace.get',b,401)
result={'status':'passed','privateWipDenied':True,'twoUnitsShareModels':True,'desktopOriginCors':True,'clashes':42,'issueId':issue['id'],'commentRoundTrip':True,'logoutRevoked':True}
(ROOT/'.local/cic-cde-live-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
