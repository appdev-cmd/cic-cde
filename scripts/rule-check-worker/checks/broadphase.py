"""Broad-phase AABB: tìm cặp ứng viên giữa 2 nhóm bằng numpy vector hóa (chia khối)."""
import numpy as np

from ifc_loader import ElementGeom

CHUNK = 2048  # giới hạn bộ nhớ ma trận boolean


def candidate_pairs(
    group_a: list[ElementGeom],
    group_b: list[ElementGeom],
    inflate: float = 0.0,
) -> list[tuple[int, int]]:
    """Trả về cặp chỉ số (i, j) có AABB giao nhau (nới rộng `inflate` mét mỗi phía)."""
    if not group_a or not group_b:
        return []

    a_min = np.array([e.aabb[0] for e in group_a]) - inflate
    a_max = np.array([e.aabb[1] for e in group_a]) + inflate
    b_min = np.array([e.aabb[0] for e in group_b])
    b_max = np.array([e.aabb[1] for e in group_b])

    pairs: list[tuple[int, int]] = []
    for i0 in range(0, len(group_a), CHUNK):
        i1 = min(i0 + CHUNK, len(group_a))
        for j0 in range(0, len(group_b), CHUNK):
            j1 = min(j0 + CHUNK, len(group_b))
            # (na,1,3) so với (1,nb,3) → (na,nb)
            overlap = np.all(
                (a_min[i0:i1, None, :] <= b_max[None, j0:j1, :])
                & (b_min[None, j0:j1, :] <= a_max[i0:i1, None, :]),
                axis=2,
            )
            ii, jj = np.nonzero(overlap)
            pairs.extend(zip((ii + i0).tolist(), (jj + j0).tolist()))
    return pairs
