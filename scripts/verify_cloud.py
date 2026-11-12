"""Cloud acceptance test with synthetic IFCs and isolated test projects."""
import argparse
from concurrent.futures import ThreadPoolExecutor
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
parser.add_argument('--p1', action='store_true', help='Exercise P1 permissions, concurrency, pagination and job recovery')
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
test_projects = []
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
    test_projects.append(project)
    isolated_project = rpc('projects.create', admin, name='P0 permission isolation fixture')['id']
    test_projects.append(isolated_project)
    (LOCAL / 'p0-cloud-test-projects.json').write_text(json.dumps(test_projects))
    rpc('workspace.get', arc, isolated_project, expected=403)
    rpc('documents.list', mep, isolated_project, expected=403)
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
    pending = rpc('projects.invite', admin, projectId=project, organization='P0-REVOKE-' + uuid4().hex[:8], role='viewer', isoRole='appointed_party')
    assert any(item['id'] == pending['id'] for item in rpc('projects.invitations', admin, projectId=project))
    rpc('projects.invitations.revoke', mep, expected=403, projectId=project, invitationId=pending['id'])
    rpc('projects.invitations.revoke', admin, projectId=project, invitationId=pending['id'])
    assert not any(item['id'] == pending['id'] for item in rpc('projects.invitations', admin, projectId=project))
    account = {'username': 'p0-account-' + uuid4().hex[:10], 'password': secrets.token_urlsafe(32),
               'organization': 'P0-ACCOUNT-' + uuid4().hex[:8], 'projectId': project,
               'role': 'viewer', 'isoRole': 'appointed_party'}
    checked(manage('project.create', account, token=arc), 403)
    created = checked(manage('project.create', account, token=admin)).json()['user']
    assert created['siteAdmin'] is False
    created_token = checked(login(account)).json()['access_token']
    tokens.append(created_token)
    created_profile = rpc('projects.current', created_token, projectId=project)
    assert created_profile['role'] == 'viewer' and created_profile['isoRole'] == 'appointed_party'
    rpc('workspace.get', created_token, isolated_project, expected=403)
    print('Project account cannot elevate system rights; invitation revocation and ISO role verified', flush=True)

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
    legacy = next(d for d in rpc('documents.list', admin, project) if d['id'] == document['id'])
    assert legacy['revisionCode'] is None and legacy['revision'] == 1
    rules = {'reference': 'P0 isolated regression BEP', 'workingPrefix': 'P', 'sharedPrefix': 'P',
             'publishedPrefix': 'C', 'workingSuffix': '.01', 'digits': 2,
             'statuses': {stage: [{'code': code, 'label': stage}] for stage, code in
                          [('WIP', 'S0'), ('Shared', 'S1'), ('Review', 'S3'), ('Approved', 'S4'), ('Published', 'A1')]}}
    rpc('bep.save', mep, project, expected=403, expectedVersion=0, rules=rules)
    rpc('bep.save', arc, project, expected=403, expectedVersion=0, rules=rules)
    rpc('bep.save', admin, project, expectedVersion=0, rules=rules)
    rpc('bep.save', admin, project, expected=409, expectedVersion=0, rules=rules)
    registered = rpc('documents.register', arc, project, code='P0-BEP-001', title='BEP regression', discipline='STR', modelId=structure['id'])
    current = next(d for d in registered if d['code'] == 'P0-BEP-001')
    assert current['revisionCode'] == 'P01.01' and current['suitabilityCode'] == 'S0'
    for before, after, status_code in [('WIP', 'Shared', 'S1'), ('Shared', 'Review', 'S3'), ('Review', 'Approved', 'S4'), ('Approved', 'Published', 'A1')]:
        registered = rpc('documents.transition', admin, project, id=current['id'], expectedState=before, state=after, suitabilityCode=status_code)
    current = next(d for d in registered if d['code'] == 'P0-BEP-001')
    assert current['revisionCode'] == 'C01'
    rpc('bep.save', admin, project, expectedVersion=1, rules={**rules, 'workingPrefix': 'T'})
    after = rpc('documents.list', admin, project)
    assert next(d for d in after if d['id'] == legacy['id']) == legacy
    assert next(d for d in after if d['id'] == current['id']) == current
    print('BEP permissions, optimistic concurrency, R01 and saved-rule preservation verified', flush=True)
    services = import_ifc(arc, project, FIXTURES / 'riverside-services.ifc')
    run = run_job(arc, project, kind='checks', modelIdsA=[services['id']], modelIdsB=[structure['id']])
    assert len(run['findings']) == 42
    issue = rpc('issues.create', arc, project, runId=run['runId'], findingId=run['findings'][0]['id'])[0]
    assert rpc('issues.comment', arc, project, issueId=issue['id'], body='Kiểm thử issue cloud')[0]['comments']
    assert rpc('issues.list', mep, project) == []
    source_path = store_ifc(arc, project, smoke)
    cancelled = rpc('jobs.create', arc, project, kind='import', path=source_path, name='cancelled.ifc')['jobId']
    assert rpc('jobs.cancel', arc, project, jobId=cancelled)['phase'] == 'cancelled'
    if args.p1:
        # Live JWTs must lose project access immediately after membership revocation.
        membership = next(m for m in rpc('projects.members', admin, projectId=project) if m['organization']=='ARC')
        rpc('projects.members.update', admin, projectId=project, organization='ARC', role='reviewer', active=False,
            expectedRevision=membership['revision'], isoRole='appointed_party')
        for operation in ('documents.page','jobs.list','bep.get'):
            rpc(operation, arc, project, expected=403)
        rpc('documents.get', arc, project, expected=403, id=document['id'])
        rpc('projects.members.update', admin, projectId=project, organization='ARC', role='reviewer', active=True,
            expectedRevision=membership['revision']+1, isoRole='appointed_party')
        # A project administrator is still not a system administrator.
        account_membership = next(m for m in rpc('projects.members', admin, projectId=project) if m['organization']==account['organization'])
        rpc('projects.members.update', admin, projectId=project, organization=account['organization'], role='admin', active=True,
            expectedRevision=account_membership['revision'], isoRole='appointing_party')
        checked(manage('project.create', {**account,'username':'p1-denied-'+uuid4().hex[:10]}, token=created_token),403)
        assert not rpc('profile', created_token)['siteAdmin']
        # Compact register preserves atomic counters for simultaneous requests.
        def register_parallel(model_id):
            return rpc('documents.registerOne', arc, project, code='P1-PARALLEL',title='Concurrency fixture',discipline='STR',modelId=model_id)
        with ThreadPoolExecutor(max_workers=2) as pool:
            parallel = list(pool.map(register_parallel,[structure['id'],services['id']]))
        assert len({d['revisionCode'] for d in parallel})==2
        assert len({d['revision'] for d in parallel})==2
        untouched = parallel[0]
        rpc('documents.transitionOne',admin,project,expected=400,id=untouched['id'],expectedState='WIP',state='Shared',suitabilityCode='INVALID')
        assert rpc('documents.get',admin,project,id=untouched['id'])==untouched
        for d in parallel:
            for before,after,code in [('WIP','Shared','S1'),('Shared','Review','S3')]:
                rpc('documents.transitionOne',arc,project,id=d['id'],expectedState=before,state=after,suitabilityCode=code)
        member_state = next(m for m in rpc('projects.members',admin,projectId=project) if m['organization']=='ARC')
        rpc('projects.members.update',admin,projectId=project,organization='ARC',role='member',active=True,
            expectedRevision=member_state['revision'],isoRole='appointed_party')
        rpc('documents.transitionOne',arc,project,expected=403,id=parallel[0]['id'],expectedState='Review',state='Approved',suitabilityCode='S4')
        rpc('projects.members.update',admin,projectId=project,organization='ARC',role='reviewer',active=True,
            expectedRevision=member_state['revision']+1,isoRole='appointed_party')
        returned=rpc('documents.transitionOne',arc,project,id=parallel[0]['id'],expectedState='Review',state='WIP',note='Revise fixture')
        assert returned['revisionCode'] not in {d['revisionCode'] for d in parallel}
        for before,after,code in [('WIP','Shared','S1'),('Shared','Review','S3')]:
            rpc('documents.transitionOne',arc,project,id=returned['id'],expectedState=before,state=after,suitabilityCode=code)
        for d in parallel:
            rpc('documents.transitionOne',arc,project,id=d['id'],expectedState='Review',state='Approved',suitabilityCode='S4')
        def publish(d):
            publisher=admin if d['id']==parallel[0]['id'] else created_token
            return rpc('documents.transitionOne',publisher,project,id=d['id'],expectedState='Approved',state='Published',suitabilityCode='A1')
        with ThreadPoolExecutor(max_workers=2) as pool:
            published=list(pool.map(publish,parallel))
        assert {d['revisionCode'] for d in published}=={'C01','C02'}
        # Two decisions on the same state cannot both commit.
        def archive(_):
            return client.post(origin+'/rest/v1/rpc/cde_api',headers=headers(admin),json={'operation':'documents.transitionOne','project_id':project,
                'payload':{'id':published[0]['id'],'expectedState':'Published','state':'Archived'}}).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(archive,range(2)))==[200,400]
        assert rpc('documents.get',admin,project,id=legacy['id'])==legacy
        # Bounded pages, lazy history, exact filtering and cross-project/WIP isolation.
        for number in range(30):
            rpc('documents.registerOne',arc,project,code=f'P1-PAGE-{number:03}',title='Page fixture',discipline='STR',modelId=structure['id'])
        ids=[]
        for offset in (0,10,20):
            page=rpc('documents.page',arc,project,query='P1-PAGE-',limit=10,offset=offset)
            assert len(page['items'])==10 and page['filteredTotal']==30
            assert all(d['history']==[] and 'suitabilityOptions' not in d for d in page['items'])
            ids.extend(d['id'] for d in page['items'])
        assert len(set(ids))==30
        assert rpc('documents.get',arc,project,id=ids[0])['history']
        assert rpc('documents.page',mep,project,query='P1-PAGE-')['filteredTotal']==0
        rpc('documents.get',mep,project,expected=403,id=ids[0])
        rpc('documents.page',arc,isolated_project,expected=403)
        # Same idempotency key creates one job, including concurrent submissions.
        payload={'kind':'checks','modelIdsA':[services['id']],'modelIdsB':[structure['id']],'requestId':str(uuid4())}
        with ThreadPoolExecutor(max_workers=2) as pool:
            created_jobs=list(pool.map(lambda _:rpc('jobs.create',arc,project,**payload),range(2)))
        assert created_jobs[0]==created_jobs[1]
        job_id=created_jobs[0]['jobId']
        rpc('jobs.create',arc,project,expected=409,**{**payload,'floor':'L05'})
        claimed=rpc('jobs.claim',arc,project,jobId=job_id,workerKey=config['worker'])
        rpc('jobs.retry',arc,project,expected=409,jobId=job_id)
        rpc('jobs.fail',arc,project,jobId=job_id,workerKey=config['worker'],leaseId=claimed['leaseId'],error='P1 simulated interruption')
        rpc('jobs.retry',mep,project,expected=403,jobId=job_id)
        rpc('jobs.retry',arc,project,jobId=job_id)
        # A stale worker completion cannot overwrite the retried job.
        assert rpc('jobs.complete',arc,project,jobId=job_id,workerKey=config['worker'],leaseId=claimed['leaseId'],result={}) is None
        checked(worker.post(worker_origin+'/api/process/'+job_id,headers={**headers(arc),'X-CIC-Project':project}))
        recovered=rpc('jobs.get',arc,project,jobId=job_id)
        assert recovered['phase']=='completed' and recovered['attempts']==2 and len(recovered['result']['findings'])==42
        rpc('jobs.retry',arc,project,jobId=job_id)
        checked(worker.post(worker_origin+'/api/process/'+job_id,headers={**headers(arc),'X-CIC-Project':project}))
        assert rpc('jobs.get',arc,project,jobId=job_id)['result']==recovered['result']
        assert rpc('jobs.list',mep,project)['items']==[]
        assert 'result' not in rpc('jobs.list',arc,project)['items'][0]
        rpc('jobs.retry',arc,project,expected=409,jobId=cancelled)
        # Explicitly bound failed attempts; cancelled results stay cancelled.
        exhausted=rpc('jobs.create',arc,project,**{**payload,'requestId':str(uuid4())})['jobId']
        for attempt in range(3):
            claim=rpc('jobs.claim',arc,project,jobId=exhausted,workerKey=config['worker'])
            rpc('jobs.fail',arc,project,jobId=exhausted,workerKey=config['worker'],leaseId=claim['leaseId'],error='P1 bounded retry fixture')
            if attempt<2: rpc('jobs.retry',arc,project,jobId=exhausted)
        rpc('jobs.retry',arc,project,expected=409,jobId=exhausted)
        assert not rpc('jobs.get',arc,project,jobId=exhausted)['retryable']
        to_cancel=rpc('jobs.create',arc,project,**{**payload,'requestId':str(uuid4())})['jobId']
        claim=rpc('jobs.claim',arc,project,jobId=to_cancel,workerKey=config['worker'])
        rpc('jobs.cancel',arc,project,jobId=to_cancel)
        rpc('jobs.complete',arc,project,jobId=to_cancel,workerKey=config['worker'],leaseId=claim['leaseId'],result={})
        assert rpc('jobs.get',arc,project,jobId=to_cancel)['phase']=='cancelled'
        print('P1 passed: revocation, project-admin boundary, concurrent revisions, return/resubmit, pagination, recovery and stale/cancelled leases',flush=True)
    print(json.dumps({'status': 'passed', 'projectId': project, 'ifcBytes': len(padded), 'clashes': len(run['findings']), 'issueId': issue['id'], 'api': args.api}))
finally:
    for test_project in test_projects:
        checked(client.post(origin + '/rest/v1/rpc/cde_delete_project', headers=headers(admin),
                            json={'project_id': test_project}), 204)
    for token in tokens:
        client.post(origin + '/auth/v1/logout?scope=local', headers=headers(token))
