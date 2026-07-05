"""Kiểm tra va chạm cứng (hard clash) giữa 2 nhóm cấu kiện.

Phương pháp (không phụ thuộc fcl):
  1. Broad phase: giao AABB (nới thêm tolerance).
  2. Narrow phase: lấy mẫu điểm trên bề mặt + đỉnh của A, kiểm tra điểm nằm TRONG B
     (ray casting — mesh IFC là solid kín). Độ xuyên = khoảng cách lớn nhất từ các
     điểm bên trong tới bề mặt B. Fallback khi contains lỗi: độ xuyên AABB.
"""
from dataclasses import dataclass

import numpy as np
import trimesh

from ifc_loader import ElementGeom
from checks.broadphase import candidate_pairs

SAMPLES_PER_MESH = 128


@dataclass
class Violation:
    element_a: ElementGeom
    element_b: ElementGeom
    measured_value: float          # độ xuyên (m)
    position: list[float]          # [x,y,z]
    method: str


def _sample_points(mesh: trimesh.Trimesh, count: int = SAMPLES_PER_MESH) -> np.ndarray:
    """Điểm mẫu = đỉnh mesh + điểm rải trên bề mặt (đủ dày cho cấu kiện dài)."""
    pts = [np.asarray(mesh.vertices)]
    try:
        surf, _ = trimesh.sample.sample_surface(mesh, count)
        pts.append(np.asarray(surf))
    except Exception:
        pass
    return np.vstack(pts)


def _aabb_penetration(a: ElementGeom, b: ElementGeom) -> tuple[float, list[float]]:
    """Fallback: độ xuyên nhỏ nhất giữa 2 AABB + tâm vùng giao."""
    lo = np.maximum(a.aabb[0], b.aabb[0])
    hi = np.minimum(a.aabb[1], b.aabb[1])
    depth = float(max(0.0, (hi - lo).min()))
    center = ((lo + hi) / 2).tolist()
    return depth, center


def run_clash(
    group_a: list[ElementGeom],
    group_b: list[ElementGeom],
    tolerance: float = 0.01,
    max_results: int = 2000,
) -> list[Violation]:
    violations: list[Violation] = []
    pairs = candidate_pairs(group_a, group_b, inflate=0.0)

    checked_b_contains: dict[int, trimesh.proximity.ProximityQuery] = {}

    for i, j in pairs:
        if len(violations) >= max_results:
            break
        a, b = group_a[i], group_b[j]
        if a.doc_code == b.doc_code and a.express_id == b.express_id:
            continue  # cùng một cấu kiện

        try:
            pts = _sample_points(a.mesh)
            inside = b.mesh.contains(pts)
            if not inside.any():
                # Kiểm tra chiều ngược lại (B nhỏ nằm gọn trong A)
                pts_b = _sample_points(b.mesh)
                inside_b = a.mesh.contains(pts_b)
                if not inside_b.any():
                    continue
                pts, inside, host = pts_b, inside_b, a
            else:
                host = b

            inner = pts[inside]
            # Độ xuyên = khoảng cách lớn nhất từ điểm bên trong tới bề mặt vật chủ
            if host.express_id not in checked_b_contains:
                checked_b_contains[host.express_id] = trimesh.proximity.ProximityQuery(host.mesh)
            _, dists, _ = checked_b_contains[host.express_id].on_surface(inner)
            depth = float(np.max(dists))
            if depth < tolerance:
                continue
            position = inner[int(np.argmax(dists))].tolist()
            method = "point_containment"
        except Exception:
            depth, position = _aabb_penetration(a, b)
            if depth < tolerance:
                continue
            method = "aabb_fallback"

        violations.append(Violation(
            element_a=a, element_b=b,
            measured_value=round(depth, 4),
            position=[round(v, 3) for v in position],
            method=method,
        ))

    return violations
