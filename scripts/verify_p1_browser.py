"""Cloud-backed browser acceptance using only a new synthetic project.

Requires private .local pilot configuration and Playwright Chrome.
The fixture project is soft-deleted in finally; no customer project is modified.
"""
import argparse,json
from pathlib import Path
from uuid import uuid4
import httpx
from playwright.sync_api import sync_playwright,expect

root=Path(__file__).resolve().parents[1]
local=root/'.local'
parser=argparse.ArgumentParser()
parser.add_argument('--url',required=True)
parser.add_argument('--api',default='https://cic-cde.vercel.app')
args=parser.parse_args()
config=json.loads((local/'cde-cloud-public.json').read_text(encoding='utf-8'))
account=json.loads((local/'cic-cde-accounts.json').read_text(encoding='utf-8'))['admin']
client=httpx.Client(timeout=300)
headers={'apikey':config['key']}
login=client.post(config['url']+'/auth/v1/token?grant_type=password',headers=headers,
                  json={'email':account['username']+'@pilot.cde.cic.com.vn','password':account['password']})
assert login.status_code==200
headers['Authorization']='Bearer '+login.json()['access_token']
project=None
def rpc(op,**payload):
    r=client.post(config['url']+'/rest/v1/rpc/cde_api',headers=headers,json={'operation':op,'project_id':project or 'demo-project','payload':payload})
    assert r.status_code==200,(op,r.status_code)
    return r.json()
try:
    project=rpc('projects.create',name='P1 browser fixture')['id']
    (local/'p1-browser-project.json').write_text(json.dumps({'projectId':project}),encoding='utf-8')
    path=f'{project}/uploads/{uuid4()}.ifc'
    r=client.post(config['url']+'/storage/v1/object/cde-files/'+path,headers={**headers,'Content-Type':'application/octet-stream'},
                  content=(root/'tests/fixtures/synthetic/riverside-demo.ifc').read_bytes())
    assert r.status_code==200
    job=rpc('jobs.create',kind='import',path=path,name='P1-browser.ifc')['jobId']
    r=client.post(args.api+'/api/process/'+job,headers={**headers,'X-CIC-Project':project})
    assert r.status_code==200
    imported=rpc('jobs.get',jobId=job)
    assert imported['phase']=='completed'
    model=imported['result']['model']['id']
    for n in range(27):
        rpc('documents.registerOne',code=f'P1-BROWSER-{n:03}',title='Browser fixture',discipline='STR',modelId=model)
    check=rpc('jobs.create',kind='checks',modelIdsA=[model],modelIdsB=[model])['jobId']
    r=client.post(args.api+'/api/process/'+check,headers={**headers,'X-CIC-Project':project})
    assert r.status_code==200 and rpc('jobs.get',jobId=check)['phase']=='completed'
    print('Browser fixture prepared',flush=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1050})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(args.url+f'/?project={project}&tab=files&file=ifc')
        page.get_by_label('Email hoặc tên đăng nhập',exact=True).fill(account['username'])
        page.get_by_label('Mật khẩu',exact=True).fill(account['password'])
        page.get_by_role('button',name='Đăng nhập',exact=True).click()
        expect(page.locator('.cde-versions tbody tr')).to_have_count(25,timeout=30000)
        page.get_by_role('button',name='Trang sau',exact=True).click()
        expect(page.locator('.cde-versions tbody tr')).to_have_count(2)
        page.get_by_label('Tìm phiên bản IFC').fill('P1-BROWSER-026')
        page.get_by_role('button',name='Tìm kiếm',exact=True).click()
        expect(page.locator('.cde-versions tbody tr')).to_have_count(1)
        page.get_by_role('button',name='P1-BROWSER-026',exact=True).click()
        expect(page.get_by_role('heading',name='Lịch sử chuyển trạng thái')).to_be_visible()
        expect(page.locator('.cde-detail')).to_contain_text('R01')
        page.screenshot(path=str(local/'p1-register.png'))
        page.get_by_role('button',name='Tác vụ cloud',exact=True).click()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.get_by_role('link',name='Mở kết quả va chạm',exact=True).click()
        page.wait_for_url('**&job='+check)
        expect(page.get_by_text('Đã mở kết quả đã lưu',exact=False)).to_be_visible(timeout=45000)
        page.screenshot(path=str(local/'p1-recovered-check.png'))
        page.get_by_role('button',name='Tác vụ cloud',exact=True).click()
        expect(page.get_by_role('link',name='Mở kết quả va chạm',exact=True)).to_be_visible()
        page.screenshot(path=str(local/'p1-jobs.png'))
        page.get_by_role('button',name='Đóng',exact=True).click()
        assert not errors,errors
        page.locator('details.account-menu > summary').click()
        page.get_by_role('button',name='Đăng xuất',exact=True).click()
        expect(page.get_by_role('button',name='Đăng nhập',exact=True)).to_be_visible()
        browser.close()
    print('PASS: cloud pagination, search, lazy history, job inbox, restored clash result, logout')
finally:
    if project:
        # App sign-out revokes all sessions for this fixture account, including this API session.
        renewed=client.post(config['url']+'/auth/v1/token?grant_type=password',headers={'apikey':config['key']},
            json={'email':account['username']+'@pilot.cde.cic.com.vn','password':account['password']})
        assert renewed.status_code==200
        headers['Authorization']='Bearer '+renewed.json()['access_token']
        r=client.post(config['url']+'/rest/v1/rpc/cde_delete_project',headers=headers,json={'project_id':project})
        assert r.status_code==204
    client.post(config['url']+'/auth/v1/logout?scope=local',headers=headers)
    client.close()
