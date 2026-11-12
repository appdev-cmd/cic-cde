"""Regression test for authenticated pilot boundaries using an isolated workspace."""
import json, os, pathlib, secrets, shutil, socket, subprocess, tempfile, time, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
BINARY=ROOT/'target/debug'/('qabim-local.exe' if os.name=='nt' else 'qabim-local')
with tempfile.TemporaryDirectory(prefix='ciccde-auth-') as temporary:
    folder=pathlib.Path(temporary)
    shutil.copytree(ROOT/'apps/desktop/public',folder/'apps/desktop/public')
    shutil.copytree(ROOT/'workers/bim/src',folder/'workers/bim/src',ignore=shutil.ignore_patterns('__pycache__'))
    (folder/'tests/fixtures/synthetic').mkdir(parents=True)
    shutil.copy(ROOT/'tests/fixtures/synthetic/riverside-demo.ifc',folder/'tests/fixtures/synthetic')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    env={**os.environ,'QABIM_ROOT':temporary,'QABIM_DATA_DIR':str(folder/'.local'),'QABIM_AUTH_REQUIRED':'1','QABIM_BIND':f'127.0.0.1:{port}','QABIM_PILOT_ORIGIN':base}
    public_origin='https://cde.cic.com.vn'
    env['QABIM_PUBLIC_ORIGIN']=public_origin
    password=secrets.token_urlsafe(24)
    for username,organization,role in [('admin','CIC','admin'),('unit-a','ARC','member'),('unit-b','MEP','member')]:
        result=subprocess.run([str(BINARY),'--create-user'],input=json.dumps(dict(username=username,organization=organization,role=role,password=password)),env=env,capture_output=True,text=True,encoding='utf8',check=True)
        assert password not in result.stdout
    process=subprocess.Popen([str(BINARY)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    def request(path,data=None,token=None,expected=200,content_type='application/json',project='demo-project',origin=base):
        headers={'Origin':origin,'X-CIC-Project':project}
        if data is not None:headers['Content-Type']=content_type
        if token:headers['Authorization']='Bearer '+token
        req=urllib.request.Request(base+path,data=data,headers=headers)
        try:
            with urllib.request.urlopen(req,timeout=30) as response:
                assert response.status==expected,(path,response.status,expected)
                raw=response.read()
                return json.loads(raw) if response.headers.get('Content-Type','').startswith('application/json') else raw
        except urllib.error.HTTPError as error:
            assert error.code==expected,(path,error.code,expected,error.read())
    def rpc(op,credential,expected=200,project="demo-project",**args):
        result=request('/rpc',json.dumps(dict(operation=op,input=args)).encode(),credential,expected,project=project)
        return result['result'] if result else None
    try:
        for _ in range(100):
            try:request('/health');break
            except urllib.error.URLError:time.sleep(.1)
        request('/rpc',b'{"operation":"workspace.get"}',expected=401)
        request('/geometry/anything',expected=401)
        request('/auth/login',b'{}',expected=403,origin='https://untrusted.example')
        public_session=request('/auth/login',json.dumps(dict(username='unit-a',password=password)).encode(),origin=public_origin)
        request('/auth/logout',b'{}',public_session['token'],origin=public_origin)
        tokens={user:request('/auth/login',json.dumps(dict(username=user,password=password)).encode())['token'] for user in ['admin','unit-a','unit-b']}
        admin,a,b=(tokens[u] for u in ['admin','unit-a','unit-b'])
        for unit,token in [('ARC',a),('MEP',b)]:
            invitation=rpc('projects.invite',admin,projectId='demo-project',organization=unit,role='member')
            rpc('projects.accept',token,token=invitation['token'])
        rpc('users.create',a,403,username='bad',password=password,organization='MEP',role='admin')
        assert rpc('workspace.get',b)['models']==[]
        data=(ROOT/'tests/fixtures/synthetic/import-smoke.ifc').read_bytes()
        def upload(token):
            boundary='ciccde-security-test'
            body=(f'--{boundary}\r\nContent-Disposition: form-data; name="job"; filename="security.ifc"\r\n\r\n').encode()+data+f'\r\n--{boundary}--\r\n'.encode()
            job=request('/import',body,token,content_type='multipart/form-data; boundary='+boundary)['result']
            return job
        job=upload(a)
        rpc('jobs.get',b,403,**job)
        for _ in range(100):
            status=rpc('jobs.get',a,**job)
            if status['phase'] in ['completed','failed']:break
            time.sleep(.1)
        assert status['phase']=='completed',status
        model=status['result']['model'];asset=model['geometryAssets'][0]['id']
        doc=rpc('documents.register',a,code='ARC-001',title='WIP riêng ARC',discipline='ARC',modelId=model['id'])[0]
        assert rpc('documents.list',b)==[]
        request('/geometry/'+asset,token=b,expected=403)
        rpc('checks.run',b,403,modelIdsA=[model['id']],modelIdsB=[model['id']])
        rpc('documents.transition',b,403,id=doc['id'],expectedState='WIP',state='Shared')
        docs=rpc('documents.transition',a,id=doc['id'],expectedState='WIP',state='Shared')
        assert rpc('documents.list',b)[0]['code']=='ARC-001'
        request('/geometry/'+asset,token=b)
        rpc('documents.transition',a,id=doc['id'],expectedState='Shared',state='Review')
        rpc('documents.transition',a,403,id=doc['id'],expectedState='Review',state='Approved')
        rpc('documents.transition',admin,id=doc['id'],expectedState='Review',state='WIP',note='Cần chỉnh sửa.')
        request('/geometry/'+asset,token=b,expected=403)
        # Uploading identical content grants access to that file, but not another unit's WIP metadata.
        second=upload(b)
        for _ in range(100):
            status=rpc('jobs.get',b,**second)
            if status['phase'] in ['completed','failed']:break
            time.sleep(.1)
        assert status['phase']=='completed'
        assert rpc('documents.list',b)==[]
        rpc('documents.register',b,403,code='ARC-001',title='Ghi đè đơn vị khác',discipline='MEP',modelId=model['id'])
        p1=rpc('projects.create',admin,name='Dự án A')
        p2=rpc('projects.create',admin,name='Dự án B')
        # A unit can be a manager in one project and a viewer in another.
        invite=rpc('projects.invite',admin,projectId=p1['id'],organization='ARC',role='admin')
        rpc('projects.accept',b,403,token=invite['token'])
        rpc('projects.accept',a,token=invite['token'])
        rpc('projects.accept',a,400,token=invite['token'])
        invite=rpc('projects.invite',admin,projectId=p2['id'],organization='ARC',role='viewer')
        rpc('projects.accept',a,token=invite['token'])
        assert rpc('projects.current',a,projectId=p1['id'])['role']=='admin'
        assert rpc('projects.current',a,projectId=p2['id'])['role']=='viewer'
        assert rpc('workspace.get',a,project=p1['id'])['models']==[]
        assert rpc('workspace.get',a,project=p2['id'])['models']==[]
        rpc('workspace.get',b,403,project=p1['id'])
        rpc('projects.create',a,403,name='Escalation')
        rpc('users.list',a,403,project=p1['id'])
        rpc('projects.accounts.create',a,403,projectId=p1['id'],organization='ARC',role='admin',username='forbidden',password=password)
        rpc('projects.invitations',a,403,projectId=p2['id'])
        invite=rpc('projects.invite',a,projectId=p1['id'],organization='STRUCTURE',role='reviewer')
        pending=rpc('projects.invitations',a,projectId=p1['id'])
        assert [item['id'] for item in pending]==[invite['id']] and 'token' not in pending[0]
        rpc('projects.invitations.revoke',admin,400,projectId=p2['id'],invitationId=invite['id'])
        rpc('projects.invitations.revoke',a,projectId=p1['id'],invitationId=invite['id'])
        request('/auth/join',json.dumps(dict(token=invite['token'],username='revoked',password=password)).encode(),expected=400)
        existing=rpc('projects.invite',a,projectId=p1['id'],organization='MEP',role='member')
        request('/auth/join',json.dumps(dict(token=existing['token'],username='mep-unverified',password=password)).encode(),expected=400)
        rpc('projects.accept',b,token=existing['token'])
        account=dict(username='second-mep',password=password)
        rpc('projects.accounts.create',admin,projectId=p1['id'],organization='MEP',role='admin',**account)
        second_mep=request('/auth/login',json.dumps(account).encode())['token']
        assert rpc('projects.current',second_mep,projectId=p1['id'])['role']=='member'
        rpc('projects.current',second_mep,403,projectId=p2['id'])
        account=dict(username='project-viewer',password=password)
        rpc('projects.accounts.create',admin,projectId=p2['id'],organization='FIELD',role='viewer',isoRole='appointed_party',**account)
        viewer=request('/auth/login',json.dumps(account).encode())['token']
        current=rpc('projects.current',viewer,projectId=p2['id'])
        assert current['role']=='viewer' and current['isoRole']=='appointed_party'
        assert [project['id'] for project in rpc('projects.list',viewer)]==[p2['id']]
        def project_upload(project):
            boundary='ciccde-project-check'
            body=(f'--{boundary}\r\nContent-Disposition: form-data; name="job"; filename="project.ifc"\r\n\r\n').encode()+data+f'\r\n--{boundary}--\r\n'.encode()
            job=request('/import',body,a,content_type='multipart/form-data; boundary='+boundary,project=project)['result']
            for _ in range(100):
                status=rpc('jobs.get',a,project=project,**job)
                if status['phase'] in ['completed','failed']:break
                time.sleep(.1)
            assert status['phase']=='completed',status
            return status['result']['model'],job
        project_model,project_job=project_upload(p1['id'])
        # Identical model hashes must still be isolated by project, including binary assets and job results.
        assert project_model['id']==model['id']
        assert rpc('workspace.get',a,project=p2['id'])['models']==[]
        request('/geometry/'+asset,token=a,expected=403,project=p2['id'])
        rpc('jobs.get',a,403,project=p2['id'],**project_job)
        rpc('documents.register',a,403,project=p2['id'],code='X',title='X',discipline='ARC',modelId=model['id'])
        docs=rpc('documents.register',a,project=p1['id'],code='ARC-001',title='Mã trùng hợp lệ ở dự án khác',discipline='ARC',modelId=model['id'])
        assert docs[0]['revision']==1 and len(docs)==1
        assert all(d['title']!='Mã trùng hợp lệ ở dự án khác' for d in rpc('documents.list',a))
        member=next(m for m in rpc('projects.members',admin,projectId=p1['id']) if m['organization']=='ARC')
        rpc('projects.members.update',admin,projectId=p1['id'],organization='ARC',role='viewer',active=False,expectedRevision=member['revision'])
        rpc('workspace.get',a,403,project=p1['id'])
        request('/geometry/'+asset,token=a,expected=403,project=p1['id'])
        rpc('projects.members.update',admin,400,projectId=p1['id'],organization='ARC',role='viewer',active=True,expectedRevision=member['revision'])
        # A new unit may create an account using the one-time invitation, with only the invited project.
        invitation=rpc('projects.invite',admin,projectId=p1['id'],organization='CONSULTANT',role='reviewer')
        joined=request('/auth/join',json.dumps({'token':invitation['token'],'username':'consultant','password':password}).encode())
        consultant=joined['token']
        assert [p['id'] for p in rpc('projects.list',consultant)]==[p1['id']]
        assert rpc('projects.current',consultant,projectId=p1['id'])['role']=='reviewer'
        rpc('workspace.get',consultant,403)
        request('/auth/join',json.dumps({'token':invitation['token'],'username':'replay','password':password}).encode(),expected=400)
        assert rpc('projects.members',admin,projectId=p1['id'])
        item=docs[0]
        assert rpc('documents.list',consultant,project=p1['id'])==[]
        rpc('documents.transition',admin,project=p1['id'],id=item['id'],expectedState='WIP',state='Shared')
        rpc('documents.transition',admin,project=p1['id'],id=item['id'],expectedState='Shared',state='Review')
        rpc('documents.transition',consultant,project=p1['id'],id=item['id'],expectedState='Review',state='Approved')
        rpc('documents.transition',consultant,403,project=p1['id'],id=item['id'],expectedState='Approved',state='Published')
        rpc('documents.transition',admin,project=p1['id'],id=item['id'],expectedState='Approved',state='Published')
        process.terminate();process.wait(timeout=10)
        process=subprocess.Popen([str(BINARY)],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:request('/health');break
            except urllib.error.URLError:time.sleep(.1)
        assert rpc('workspace.get',consultant,project=p1['id'])['models'][0]['id']==model['id']
        assert rpc('documents.list',consultant,project=p1['id'])[0]['state']=='Published'
        assert rpc('workspace.get',a,project=p2['id'])['models']==[]
        request('/auth/logout',b'{}',a)
        rpc('workspace.get',a,401)
        print(json.dumps({'status':'passed','anonymousBlocked':True,'privateGeometryBlocked':True,'jobIsolation':True,'sharedVisible':True,'approvalAdminOnly':True,'identicalUploadKeepsWipPrivate':True,'logoutRevokesSession':True,'projectsIsolated':True,'independentProjectRoles':True,'membershipRevocation':True,'oneTimeInvitation':True,'reviewPublishSeparation':True,'persistedAfterRestart':True}))
    finally:
        process.terminate();process.wait(timeout=10)
