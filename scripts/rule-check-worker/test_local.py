"""Test cục bộ engine kiểm tra (không cần Supabase):
  - Nạp 2 file IFC thật (resources/), dựng hình học world-coords
  - Chạy rule clash: MEP (ống gió/ống nước) vs Kết cấu (dầm/cột/sàn/tường)
  - Chạy rule clearance mẫu
Cách chạy:  .venv/Scripts/python test_local.py
"""
import sys
import time

import ifcopenshell

from ifc_loader import build_geometry, model_bbox
from checks.clash import run_clash
from checks.clearance import run_clearance

BASE = "../../resources/25120-BVNND2_TrinhThamDinh-LOD300/IFC"
# EELV (7,8MB) để test nhanh; đổi sang HVAC/PLUM cho test tải nặng
MODEL_MEP = f"{BASE}/25120-BVNND2_CIC_EELV_CTC_ZZ.ifc"
MODEL_STR = f"{BASE}/25120-BVNND2_CIC_STRU_CTC_ZZ.ifc"

MEP_CATS = {"IFCCABLECARRIERSEGMENT", "IFCCABLECARRIERFITTING",
            "IFCDUCTSEGMENT", "IFCDUCTFITTING", "IFCPIPESEGMENT", "IFCPIPEFITTING"}
STR_CATS = {"IFCBEAM", "IFCCOLUMN", "IFCSLAB", "IFCWALL", "IFCWALLSTANDARDCASE"}


def main() -> int:
    t0 = time.time()
    print("Nạp HVAC ...")
    ifc_mep = ifcopenshell.open(MODEL_MEP)
    mep, skip_a = build_geometry(ifc_mep, "HVAC", MEP_CATS)
    print(f"  → {len(mep)} cấu kiện MEP (bỏ qua {skip_a}), bbox={model_bbox(mep)}")

    print("Nạp STRU ...")
    ifc_str = ifcopenshell.open(MODEL_STR)
    stru, skip_b = build_geometry(ifc_str, "STRU", STR_CATS)
    print(f"  → {len(stru)} cấu kiện kết cấu (bỏ qua {skip_b}), bbox={model_bbox(stru)}")
    t1 = time.time()
    print(f"Thời gian dựng hình học: {t1 - t0:.1f}s")

    print("\n--- CLASH: MEP xuyên kết cấu (tolerance 0.01m) ---")
    clashes = run_clash(mep, stru, tolerance=0.01, max_results=200)
    t2 = time.time()
    print(f"  → {len(clashes)} va chạm, mất {t2 - t1:.1f}s")
    for v in clashes[:5]:
        print(f"    · {v.element_a.category} '{v.element_a.name[:36]}' × "
              f"{v.element_b.category} '{v.element_b.name[:36]}' — xuyên {v.measured_value}m "
              f"tại {v.position} [{v.method}]")

    print("\n--- CLEARANCE: ống gió ↔ sàn ≥ 0.3m ---")
    ducts = [e for e in mep if e.category in ("IFCDUCTSEGMENT", "IFCCABLECARRIERSEGMENT")]
    slabs = [e for e in stru if e.category == "IFCSLAB"]
    clr = run_clearance(ducts, slabs, min_distance=0.3, max_results=100)
    t3 = time.time()
    print(f"  → {len(clr)} vi phạm khoảng hở, mất {t3 - t2:.1f}s")
    for v in clr[:5]:
        print(f"    · '{v.element_a.name[:36]}' cách '{v.element_b.name[:36]}' "
              f"{v.measured_value}m (< 0.3m) tại {v.position}")

    print(f"\nTổng thời gian: {t3 - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
