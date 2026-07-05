"""Kiểm tra khoảng cách tối thiểu (clearance) giữa 2 nhóm cấu kiện.

Phương pháp: lấy mẫu điểm trên bề mặt A, đo khoảng cách tới bề mặt B bằng
ProximityQuery (xấp xỉ theo mẫu — ghi rõ trong details.method).
"""
from dataclasses import dataclass

import numpy as np
import trimesh

from ifc_loader import ElementGeom
from checks.broadphase import candidate_pairs

SAMPLES = 256

# Cặp cấu kiện chạm nhau (khoảng cách ~0) coi là LIÊN KẾT (ví dụ cửa gắn trong tường
# chủ) — không phải vi phạm khoảng hở. Ngưỡng "chạm" mặc định 1cm.
TOUCH_EPSILON = 0.01


@dataclass
class Violation:
    element_a: ElementGeom
    element_b: ElementGeom
    measured_value: float          # khoảng cách nhỏ nhất đo được (m)
    position: list[float]          # trung điểm cặp điểm gần nhất
    method: str


def run_clearance(
    group_a: list[ElementGeom],
    group_b: list[ElementGeom],
    min_distance: float,
    max_results: int = 2000,
) -> list[Violation]:
    violations: list[Violation] = []
    # Broad phase: chỉ xét cặp có AABB cách nhau dưới min_distance
    pairs = candidate_pairs(group_a, group_b, inflate=min_distance)

    pq_cache: dict[int, trimesh.proximity.ProximityQuery] = {}

    for i, j in pairs:
        if len(violations) >= max_results:
            break
        a, b = group_a[i], group_b[j]
        if a.doc_code == b.doc_code and a.express_id == b.express_id:
            continue

        try:
            try:
                pts, _ = trimesh.sample.sample_surface(a.mesh, SAMPLES)
                pts = np.vstack([np.asarray(pts), np.asarray(a.mesh.vertices)])
            except Exception:
                pts = np.asarray(a.mesh.vertices)

            if b.express_id not in pq_cache:
                pq_cache[b.express_id] = trimesh.proximity.ProximityQuery(b.mesh)
            closest, dists, _ = pq_cache[b.express_id].on_surface(pts)

            k = int(np.argmin(dists))
            dmin = float(dists[k])
            if dmin >= min_distance:
                continue
            if dmin < TOUCH_EPSILON:
                continue  # cấu kiện liên kết/chạm nhau — không tính vi phạm khoảng hở

            midpoint = ((pts[k] + closest[k]) / 2).tolist()
            violations.append(Violation(
                element_a=a, element_b=b,
                measured_value=round(dmin, 4),
                position=[round(v, 3) for v in midpoint],
                method="surface_sampling",
            ))
        except Exception:
            continue

    return violations
