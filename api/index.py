"""Vercel Function for IfcOpenShell jobs. Persistent data stays in Supabase."""
import json
import logging
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
from urllib.parse import quote
from uuid import UUID

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import httpx

ROOT = Path(__file__).resolve().parents[1]
MAX_IFC_BYTES = 500_000_000
WORKER_SECONDS = 255
logger = logging.getLogger(__name__)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://tauri.localhost', 'tauri://localhost', 'http://127.0.0.1:1420'],
    allow_methods=['GET', 'POST'],
    allow_headers=['Authorization', 'X-CIC-Project', 'Content-Type'],
    allow_credentials=True,
)


class Cloud:
    def __init__(self, request: Request, client: httpx.Client):
        self.url = os.environ['VITE_SUPABASE_URL'].rstrip('/')
        self.client = client
        token = request.headers.get('authorization', '')
        if not token.startswith('Bearer '):
            raise HTTPException(401, 'Vui lòng đăng nhập')
        self.headers = {'apikey': os.environ['VITE_SUPABASE_PUBLISHABLE_KEY'], 'Authorization': token}
        self.project = request.headers.get('x-cic-project', 'demo-project')

    def rpc(self, operation, **payload):
        response = self.client.post(self.url + '/rest/v1/rpc/cde_api', headers=self.headers,
            json={'operation': operation, 'payload': payload, 'project_id': self.project})
        if response.status_code in (401, 403):
            raise HTTPException(response.status_code, 'Bạn không có quyền thực hiện tác vụ')
        response.raise_for_status()
        return response.json()

    def download(self, path: str, target: Path):
        url = self.url + '/storage/v1/object/authenticated/cde-files/' + quote(path, safe='/')
        with self.client.stream('GET', url, headers=self.headers) as response, target.open('wb') as file:
            response.raise_for_status()
            length = 0
            for chunk in response.iter_bytes():
                length += len(chunk)
                if length > MAX_IFC_BYTES:
                    raise ValueError('IFC vượt quá 500 MB')
                file.write(chunk)

    def upload_geometry(self, path: str, source: Path):
        headers = {**self.headers, 'Content-Type': 'application/octet-stream',
                   'Content-Length': str(source.stat().st_size), 'x-upsert': 'false'}
        with source.open('rb') as file:
            response = self.client.post(self.url + '/storage/v1/object/cde-files/' + quote(path, safe='/'),
                                        headers=headers, content=file)
            response.raise_for_status()

    def signed_geometry(self, path: str):
        response = self.client.post(self.url + '/storage/v1/object/sign/cde-files/' + quote(path, safe='/'),
                                    headers=self.headers, json={'expiresIn': 60})
        response.raise_for_status()
        signed = response.json()['signedURL']
        if signed.startswith('/object/sign/'):
            return self.url + '/storage/v1' + signed
        if signed.startswith('/storage/v1/object/sign/'):
            return self.url + signed
        raise ValueError('Đường dẫn geometry không hợp lệ')


class Cancelled(Exception):
    pass


def run_worker(cloud: Cloud, job_id: str, folder: Path, operation: str, inputs: dict, deadline: float):
    # Vercel adds its vendored dependencies to the handler's sys.path at startup.
    # Forward those paths when starting a separate, cancellable Python worker.
    python_paths = [str(ROOT / 'workers/bim/src'), *(path for path in sys.path if path)]
    env = {**os.environ, 'QABIM_DATA_DIR': str(folder), 'PYTHONPATH': os.pathsep.join(python_paths)}
    output = folder / 'result.json'
    diagnostics = folder / 'worker.stderr'
    with output.open('wb') as stream, diagnostics.open('wb') as stderr, subprocess.Popen(
        [sys.executable, '-m', 'qabim_worker.main', '--once', operation, json.dumps(inputs)],
        env=env, stdout=stream, stderr=stderr,
    ) as worker:
        try:
            while worker.poll() is None:
                try:
                    worker.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    if time.monotonic() > deadline:
                        raise TimeoutError('IfcOpenShell vượt thời gian xử lý của pilot')
                    if cloud.rpc('jobs.get', jobId=job_id)['phase'] == 'cancelled':
                        raise Cancelled
        finally:
            if worker.poll() is None:
                worker.kill()
                worker.wait()
    if worker.returncode:
        lines = diagnostics.read_text(encoding='utf-8', errors='replace').splitlines()
        # Keep native dependency errors useful without logging model contents or credentials.
        module_error = next((line for line in reversed(lines) if line.startswith(('ModuleNotFoundError:', 'ImportError:'))), '')
        logger.warning('IfcOpenShell child exit=%s %s', worker.returncode, module_error[:200])
        raise RuntimeError('IfcOpenShell worker exited')
    reply = json.loads(output.read_text(encoding='utf-8'))
    if 'error' in reply:
        details = reply['error'].get('data', {})
        reason = details.get('reason')
        if reason == 'preview_products':
            count = f"{int(details['count']):,}".replace(',', '.')
            limit = f"{int(details['limit']):,}".replace(',', '.')
            raise ValueError(f'Mô hình có {count} đối tượng hình học, vượt giới hạn {limit}. Hãy chia mô hình rồi tải lại.')
        if reason == 'preview_geometry':
            raise ValueError('Hình học của mô hình vượt giới hạn xử lý. Hãy chia mô hình rồi tải lại.')
        raise ValueError('IfcOpenShell không thể đọc hoặc tạo hình học từ file này.')
    return reply['result']


@app.exception_handler(HTTPException)
def handle_http_error(_request, error):
    return JSONResponse({'error': error.detail}, status_code=error.status_code)


@app.get('/api/health')
def health():
    ready = all(os.environ.get(name) for name in ('VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'CDE_WORKER_KEY'))
    return JSONResponse({'status': 'ready' if ready else 'unconfigured', 'mode': 'cloud'}, status_code=200 if ready else 503)


@app.get('/api/geometry/{asset_id}')
def geometry(asset_id: str, request: Request):
    with httpx.Client(timeout=20) as client:
        cloud = Cloud(request, client)
        asset = cloud.rpc('geometry.get', id=asset_id)
        return RedirectResponse(cloud.signed_geometry(asset['storagePath']), status_code=302, headers={'Cache-Control': 'private, no-store'})


@app.post('/api/process/{job_id}')
def process(job_id: UUID, request: Request):
    worker_key = os.environ['CDE_WORKER_KEY']
    job_id = str(job_id)
    deadline = time.monotonic() + WORKER_SECONDS
    with httpx.Client(timeout=25) as client:
        cloud = Cloud(request, client)
        job = cloud.rpc('jobs.claim', jobId=job_id, workerKey=worker_key)
        if not job:
            return {'ok': True}
        lease = {'jobId': job_id, 'workerKey': worker_key, 'leaseId': job['leaseId']}
        try:
            with TemporaryDirectory(prefix='ciccde-') as temp:
                folder = Path(temp)
                inputs = job['input']
                if job['kind'] == 'import':
                    source = folder / 'source.ifc'
                    cloud.download(inputs['path'], source)
                    result = run_worker(cloud, job_id, folder, 'model.import', {'path': str(source), 'name': inputs['name']}, deadline)
                    uploaded_assets = set()
                    for asset in result['model']['geometryAssets']:
                        asset['storagePath'] = f"{cloud.project}/jobs/{job_id}/{job['leaseId']}/{asset['id']}.qbm"
                        if asset['id'] in uploaded_assets:
                            continue
                        cloud.upload_geometry(asset['storagePath'], folder / 'models' / result['model']['hash'] / asset['file'])
                        uploaded_assets.add(asset['id'])
                else:
                    ids = list(set(inputs['modelIdsA'] + inputs['modelIdsB']))
                    if len(ids) > 12:
                        raise ValueError('Chọn tối đa 12 mô hình')
                    sources = cloud.rpc('models.sources', ids=ids)
                    if {source['modelId'] for source in sources} != set(ids):
                        raise HTTPException(403, 'Mô hình không còn trong phạm vi truy cập')
                    for index, source in enumerate(sources):
                        path = folder / f'{index}.ifc'
                        cloud.download(source.pop('sourcePath'), path)
                        source['path'] = str(path)
                    result = run_worker(cloud, job_id, folder, 'checks.run', {**inputs, 'sources': sources}, deadline)
                cloud.rpc('jobs.complete', **lease, result=result)
        except Cancelled:
            return {'ok': True, 'cancelled': True}
        except Exception as error:
            logger.warning('CDE job %s failed: %s', job_id, type(error).__name__)
            message = str(error) if isinstance(error, (ValueError, TimeoutError)) and not isinstance(error, json.JSONDecodeError) else 'Không thể xử lý IFC trên worker cloud'
            cloud.rpc('jobs.fail', **lease, error=message)
        return {'ok': True}
