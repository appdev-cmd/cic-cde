"""Cloud acceptance test with synthetic IFCs and isolated test projects."""
import argparse
import json
import os
from pathlib import Path
import secrets
import sys
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local'
FIXTURES = ROOT / 'tests/fixtures/synthetic'
parser = argparse.ArgumentParser()
parser.add_argument('--api', default='local', help='local ASGI app or deployed HTTPS origin')
args = parser.parse_args()
public = json.loads((LOCAL / 'cde-cloud-public.json').read_text())
credentials = json.loads((LOCAL / 'cic-cde-accounts.json').read_text(encoding='utf-8'))
config = json.loads((LOCAL / 'cde-cloud-secrets.json').read_text())
origin, key = public['url'], public['key']
client = httpx.Client(timeout=300)
if args.api == 'local':
    from fastapi.testclient import TestClient
    sys.path.insert(0, str(ROOT))
    from api.index import app
    os.environ.update(VITE_SUPABASE_URL=origin, VITE_SUPABASE_PUBLISHABLE_KEY=key, CDE_WORKER_KEY=config['worker'])
    worker = TestClient(app)
    worker_origin = ''
else:
    worker = client
    worker_origin = args.api.rstrip('/')


def checked(response, expected=200):
    if response.status_code != expected:
        try:
            error = response.json()
            message = error.get('error_description') or error.get('error') or error.get('message') or error.get('detail')
            code = error.get('code')
        except (ValueError, AttributeError):
            message = response.headers.get('x-vercel-error', 'Unexpected non-JSON response')
            code = None
        raise AssertionError((response.request.method, response.request.url.path, response.status_code, expected, code, message))
    return response


def headers(token=None):
    return {'apikey': key, **({'Authorization': 'Bearer ' + token} if token else {})}


def login(account):
    return client.post(origin + '/auth/v1/token?grant_type=password', headers=headers(),
                       json={'email': account['username'] + '@pilot.cde.cic.com.vn', 'password': account['password']})


def manage(action, account, token=None, code=None):
    body = {**account, 'action': action, 'token': code}
    return client.post(origin + '/functions/v1/cde-accounts', headers=headers(token), json=body)


def rpc(operation, credential=None, project='demo-project', expected=200, **payload):
    response = client.post(origin + '/rest/v1/rpc/cde_api', headers=headers(credential),
                           json={'operation': operation, 'project_id': project, 'payload': payload})
    return checked(response, expected).json()


def store_ifc(token, project, data):
    path = f'{project}/uploads/{uuid4()}.ifc'
    checked(client.post(origin + '/storage/v1/object/cde-files/' + path,
                        headers={**headers(token), 'Content-Type': 'application/octet-stream', 'x-upsert': 'false'}, content=data))
    return path


def run_job(token, project, **payload):
    job = rpc('jobs.create', token, project, **payload)['jobId']
    checked(worker.post(worker_origin + '/api/process/' + job,
                        headers={**headers(token), 'X-CIC-Project': project}))
    status = rpc('jobs.get', token, project, jobId=job)
    assert status['phase'] == 'completed', (payload['kind'], status['phase'], status.get('error'))
    return status['result']


def import_ifc(token, project, file, data=None):
    path = store_ifc(token, project, file.read_bytes() if data is None else data)
    return run_job(token, project, kind='import', path=path, name=file.name)['model']


checked(worker.get(worker_origin + '/api/health'))
admin_login = login(credentials['admin'])
if admin_login.status_code == 400:
    checked(manage('bootstrap', credentials['admin'], code=config['bootstrap']))
    admin_login = login(credentials['admin'])
admin = checked(admin_login).json()['access_token']
assert rpc('profile', admin)['siteAdmin']
print('Admin and cloud health verified', flush=True)
tokens = [admin]
try:
    for unit in ('arc', 'mep'):
        account = credentials[unit]
        response = login(account)
        if response.status_code == 400:
            checked(manage('create', account, token=admin))
            response = login(account)
        tokens.append(checked(response).json()['access_token'])
    _, arc, mep = tokens
    project = rpc('projects.create', admin, name=f'Kiểm thử CIC CDE Cloud {args.api == "local" and "nội bộ" or "Vercel"}')['id']
    rpc('workspace.get', arc, project, expected=403)
    for unit, role, member in [('ARC', 'reviewer', arc), ('MEP', 'viewer', mep)]:
        invitation = rpc('projects.invite', admin, projectId=project, organization=unit, role=role)
        if unit == 'ARC':
            rpc('projects.accept', mep, expected=403, token=invitation['token'])
        rpc('projects.accept', member, token=invitation['token'])
        rpc('projects.accept', member, expected=400, token=invitation['token'])
        assert rpc('projects.current', member, projectId=project)['role'] == role
    # Join as a new account using the same one-time link flow used by the UI.
    invite = rpc('projects.invite', admin, projectId=project, organization='CLOUD-TEST-' + uuid4().hex[:10], role='viewer')
    account = {'username': 'cloud-test-' + uuid4().hex[:10], 'password': secrets.token_urlsafe(32)}
    joined = checked(manage('join', account, code=invite['token'])).json()['session']['access_token']
    tokens.append(joined)
    assert rpc('projects.current', joined, projectId=project)['role'] == 'viewer'
    checked(manage('join', account, code=invite['token']), 400)
    print('Project invitation, signup and role isolation verified', flush=True)

    smoke = (FIXTURES / 'import-smoke.ifc').read_bytes()
    # Valid STEP comment keeps the model small while exercising uploads beyond 4.5 MB.
    padded = smoke.replace(b'ISO-10303-21;', b'ISO-10303-21;\n/*' + b' ' * (5 * 1024 * 1024) + b'*/', 1)
    model = import_ifc(arc, project, FIXTURES / 'import-smoke.ifc', padded)
    assert model['count'] == 2
    asset = model['geometryAssets'][0]
    signed = checked(worker.get(worker_origin + '/api/geometry/' + asset['id'],
                                headers={**headers(arc), 'X-CIC-Project': project}, follow_redirects=False), 302)
    assert checked(client.get(signed.headers['location'])).content.startswith(b'QBM1')
    rpc('geometry.get', mep, project, expected=403, id=asset['id'])
    rpc('geometry.get', admin, 'demo-project', expected=403, id=asset['id'])
    rpc('jobs.create', mep, project, expected=403, kind='import', path='invalid')
    document = rpc('documents.register', arc, project, code='CLOUD-IFC-001', title='IFC thử nghiệm cloud', discipline='ARC', modelId=model['id'])[0]
    assert rpc('documents.list', mep, project) == []
    for before, after in [('WIP', 'Shared'), ('Shared', 'Review'), ('Review', 'Approved')]:
        rpc('documents.transition', arc, project, id=document['id'], expectedState=before, state=after)
    rpc('documents.transition', arc, project, expected=403, id=document['id'], expectedState='Approved', state='Published')
    rpc('documents.transition', admin, project, id=document['id'], expectedState='Approved', state='Published')
    assert rpc('documents.list', mep, project)[0]['state'] == 'Published'
    assert rpc('geometry.get', mep, project, id=asset['id'])['id'] == asset['id']
    print('IFC upload over 5 MB, geometry and document approvals verified', flush=True)

    structure = import_ifc(arc, project, FIXTURES / 'riverside-structure.ifc')
    services = import_ifc(arc, project, FIXTURES / 'riverside-services.ifc')
    run = run_job(arc, project, kind='checks', modelIdsA=[services['id']], modelIdsB=[structure['id']])
    assert len(run['findings']) == 42
    issue = rpc('issues.create', arc, project, runId=run['runId'], findingId=run['findings'][0]['id'])[0]
    assert rpc('issues.comment', arc, project, issueId=issue['id'], body='Kiểm thử issue cloud')[0]['comments']
    assert rpc('issues.list', mep, project) == []
    source_path = store_ifc(arc, project, smoke)
    cancelled = rpc('jobs.create', arc, project, kind='import', path=source_path, name='cancelled.ifc')['jobId']
    assert rpc('jobs.cancel', arc, project, jobId=cancelled)['phase'] == 'cancelled'
    print(json.dumps({'status': 'passed', 'projectId': project, 'ifcBytes': len(padded), 'clashes': len(run['findings']), 'issueId': issue['id'], 'api': args.api}))
finally:
    for token in tokens:
        client.post(origin + '/auth/v1/logout?scope=local', headers=headers(token))
