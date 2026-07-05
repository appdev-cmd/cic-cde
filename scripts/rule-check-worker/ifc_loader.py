"""Nạp IFC từ Supabase Storage và dựng hình học world-coords (mét) bằng IfcOpenShell."""
import io
import multiprocessing
import tempfile
import zipfile
from dataclasses import dataclass, field

import numpy as np
import trimesh

import ifcopenshell
import ifcopenshell.geom
import ifcopenshell.util.unit

import db

# Loại trừ mặc định khỏi kiểm tra hình học (giao cắt hợp lệ / không phải cấu kiện vật lý)
DEFAULT_EXCLUDED = {"IFCOPENINGELEMENT", "IFCSPACE"}


@dataclass
class ElementGeom:
    doc_code: str
    guid: str
    express_id: int
    name: str
    category: str  # viết hoa, ví dụ 'IFCWALL'
    mesh: trimesh.Trimesh
    aabb: np.ndarray = field(default=None)  # (2,3) min/max — cache

    def __post_init__(self):
        if self.aabb is None:
            self.aabb = self.mesh.bounds.copy()


def extract_ifc_bytes(buffer: bytes, name: str = "") -> bytes:
    """Giải nén .ifczip/.zip nếu cần (chữ ký 'PK'), trả về bytes IFC thô."""
    is_zip = name.lower().endswith((".ifczip", ".zip")) or buffer[:2] == b"PK"
    if not is_zip:
        return buffer
    with zipfile.ZipFile(io.BytesIO(buffer)) as z:
        entry = next((n for n in z.namelist() if n.lower().endswith(".ifc")), None)
        if not entry:
            raise ValueError("Không tìm thấy tệp .ifc bên trong file nén.")
        return z.read(entry)


def load_ifc_file(file_url: str) -> ifcopenshell.file:
    raw = db.download_storage_file(file_url)
    ifc_bytes = extract_ifc_bytes(raw, file_url)
    # ifcopenshell cần đường dẫn file — ghi ra file tạm
    with tempfile.NamedTemporaryFile(suffix=".ifc", delete=False) as f:
        f.write(ifc_bytes)
        tmp_path = f.name
    return ifcopenshell.open(tmp_path)


def build_geometry(
    ifc_file: ifcopenshell.file,
    doc_code: str,
    include_categories: set[str],
) -> tuple[list[ElementGeom], int]:
    """
    Dựng mesh world-coords cho các cấu kiện thuộc include_categories.
    Trả về (danh sách ElementGeom, số cấu kiện bị bỏ qua vì không có hình học).
    Đơn vị: iterator của IfcOpenShell mặc định trả về MÉT (SI); có sanity check.
    """
    cats = {c.upper() for c in include_categories} - DEFAULT_EXCLUDED
    if not cats:
        return [], 0

    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)

    # Lọc thực thể theo class IFC (tên class dạng 'IfcWall' — chuyển từ 'IFCWALL')
    include_entities = []
    for cat in cats:
        try:
            ents = ifc_file.by_type(cat)
            include_entities.extend(ents)
        except Exception:
            continue  # class không tồn tại trong schema của file

    if not include_entities:
        return [], 0

    elems: list[ElementGeom] = []
    skipped = 0

    iterator = ifcopenshell.geom.iterator(
        settings, ifc_file, multiprocessing.cpu_count(), include=include_entities
    )
    if not iterator.initialize():
        return [], len(include_entities)

    while True:
        shape = iterator.get()
        try:
            verts = np.array(shape.geometry.verts, dtype=np.float64).reshape(-1, 3)
            faces = np.array(shape.geometry.faces, dtype=np.int64).reshape(-1, 3)
            if len(verts) == 0 or len(faces) == 0:
                skipped += 1
            else:
                mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
                el = ifc_file.by_id(shape.id)
                elems.append(ElementGeom(
                    doc_code=doc_code,
                    guid=getattr(el, "GlobalId", "") or "",
                    express_id=shape.id,
                    name=(getattr(el, "Name", None) or ""),
                    category=el.is_a().upper(),
                    mesh=mesh,
                ))
        except Exception:
            skipped += 1
        if not iterator.next():
            break

    # Sanity check đơn vị: bbox toàn mô hình > 5000 → nghi rò rỉ mm
    if elems:
        all_bounds = np.array([e.aabb for e in elems])
        extent = all_bounds[:, 1, :].max(axis=0) - all_bounds[:, 0, :].min(axis=0)
        if extent.max() > 5000:
            scale = ifcopenshell.util.unit.calculate_unit_scale(ifc_file)
            print(f"[CẢNH BÁO] Kích thước mô hình {doc_code} = {extent.max():.0f} — "
                  f"nghi đơn vị chưa về mét (unit scale khai báo: {scale}).")

    return elems, skipped


def model_bbox(elems: list[ElementGeom]) -> list[list[float]] | None:
    if not elems:
        return None
    bounds = np.array([e.aabb for e in elems])
    mn = bounds[:, 0, :].min(axis=0)
    mx = bounds[:, 1, :].max(axis=0)
    return [mn.tolist(), mx.tolist()]
