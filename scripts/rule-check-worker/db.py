"""Lớp truy cập Supabase cho worker kiểm tra rules (SERVICE_ROLE — bỏ qua RLS)."""
import os
import time
from supabase import create_client, Client, ClientOptions

_client: Client | None = None

# Timeout mặc định của storage client (supabase-py) chỉ 20s — quá ngắn để tải
# file IFC lớn (có thể vài trăm MB) qua mạng. Nâng lên 10 phút.
STORAGE_TIMEOUT_SECONDS = 600


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env")
        _client = create_client(
            url, key,
            options=ClientOptions(storage_client_timeout=STORAGE_TIMEOUT_SECONDS),
        )
    return _client


def fetch_pending_run() -> dict | None:
    """Lấy 1 run pending cũ nhất."""
    res = (
        get_client()
        .table("check_runs")
        .select("*")
        .eq("status", "pending")
        .order("created_at")
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def claim_run(run_id: str) -> bool:
    """Optimistic lock: chỉ nhận run nếu vẫn còn pending (tránh 2 worker xử lý trùng)."""
    res = (
        get_client()
        .table("check_runs")
        .update({"status": "processing", "started_at": _now_iso(), "progress": 0})
        .eq("id", run_id)
        .eq("status", "pending")
        .execute()
    )
    return bool(res.data)


def update_progress(run_id: str, progress: int) -> None:
    get_client().table("check_runs").update({"progress": min(99, max(0, progress))}).eq("id", run_id).execute()


def finish_run(run_id: str, summary: dict) -> None:
    get_client().table("check_runs").update({
        "status": "done", "progress": 100, "summary": summary, "finished_at": _now_iso(),
    }).eq("id", run_id).execute()


def fail_run(run_id: str, message: str) -> None:
    get_client().table("check_runs").update({
        "status": "error", "error_message": message[:500], "finished_at": _now_iso(),
    }).eq("id", run_id).execute()


def fetch_rules_of_set(rule_set_id: str) -> list[dict]:
    res = (
        get_client()
        .table("rules")
        .select("*")
        .eq("rule_set_id", rule_set_id)
        .eq("enabled", True)
        .order("sort_order")
        .execute()
    )
    return res.data or []


def fetch_documents(project_id: str, codes: list[str]) -> list[dict]:
    res = (
        get_client()
        .table("documents")
        .select("id, code, name, file_url")
        .eq("project_id", project_id)
        .in_("code", codes)
        .execute()
    )
    return res.data or []


def fetch_elements(document_id: str, categories: list[str]) -> list[dict]:
    """Đọc cấu kiện đã trích xuất sẵn (bảng elements) — đường nhanh cho lọc thuộc tính."""
    res = (
        get_client()
        .table("elements")
        .select("express_id, global_id, name, category, properties")
        .eq("document_id", document_id)
        .in_("category", categories)
        .limit(100000)
        .execute()
    )
    return res.data or []


def insert_results_batch(rows: list[dict], batch_size: int = 500) -> None:
    client = get_client()
    for i in range(0, len(rows), batch_size):
        client.table("check_results").insert(rows[i:i + batch_size]).execute()


def download_storage_file(file_url: str) -> bytes:
    """Tải file từ bucket cde-files, parse path từ public URL (giống converter-worker)."""
    marker = "/storage/v1/object/public/cde-files/"
    idx = file_url.find(marker)
    if idx < 0:
        raise ValueError(f"URL không thuộc bucket cde-files: {file_url}")
    path = file_url[idx + len(marker):]
    # Bỏ query string nếu có
    path = path.split("?")[0]
    from urllib.parse import unquote
    return get_client().storage.from_("cde-files").download(unquote(path))


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S+00:00", time.gmtime())
