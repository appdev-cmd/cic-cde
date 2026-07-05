"""Worker kiểm tra mô hình theo rules (clash + clearance) — CDE CIC.

Pattern giống converter-worker: poll bảng check_runs mỗi POLLING_INTERVAL ms,
claim run pending (optimistic lock), tải IFC từ Storage, dựng hình học,
chạy từng rule, ghi check_results theo lô, cập nhật progress + summary.

Chạy:  python main.py   (cần .env — xem .env.example)
"""
import os
import time
import traceback

from dotenv import load_dotenv

load_dotenv()

import db
import groups
from ifc_loader import build_geometry, load_ifc_file, model_bbox, ElementGeom
from checks.clash import run_clash
from checks.clearance import run_clearance

POLLING_INTERVAL = int(os.environ.get("POLLING_INTERVAL", "5000")) / 1000.0
MAX_VIOLATIONS_PER_RULE = int(os.environ.get("MAX_VIOLATIONS_PER_RULE", "2000"))


def elem_ref(e: ElementGeom) -> dict:
    return {
        "doc_code": e.doc_code,
        "guid": e.guid,
        "express_id": e.express_id,
        "name": e.name,
        "category": e.category,
    }


def process_run(run: dict) -> None:
    run_id = run["id"]
    project_id = run["project_id"]
    doc_codes: list[str] = run.get("document_codes") or []
    rule_set_id = run.get("rule_set_id")

    print(f"[RUN {run_id[:8]}] Bắt đầu — dự án {project_id}, {len(doc_codes)} mô hình.")

    rules = db.fetch_rules_of_set(rule_set_id) if rule_set_id else []
    if not rules:
        db.fail_run(run_id, "Bộ quy tắc trống hoặc không tồn tại.")
        return

    documents = db.fetch_documents(project_id, doc_codes)
    if not documents:
        db.fail_run(run_id, "Không tìm thấy tài liệu mô hình nào khớp mã đã chọn.")
        return
    missing = [d["code"] for d in documents if not d.get("file_url")]
    if missing:
        db.fail_run(run_id, f"Tài liệu thiếu tệp IFC: {', '.join(missing)}")
        return

    # Union categories của mọi rule → chỉ mesh cấu kiện cần thiết
    union_cats: set[str] = set()
    for r in rules:
        p = r.get("params") or {}
        union_cats |= {c.upper() for c in (p.get("groupA", {}).get("categories") or [])}
        union_cats |= {c.upper() for c in (p.get("groupB", {}).get("categories") or [])}

    # Nạp và mesh từng mô hình (bước nặng nhất)
    all_elems: list[ElementGeom] = []
    ifc_files: dict[str, object] = {}   # doc_code -> ifcopenshell.file (cho fallback pset)
    doc_ids: dict[str, str] = {}        # doc_code -> documents.id (uuid)
    skipped_total = 0
    bboxes: dict[str, list] = {}

    for idx, doc in enumerate(documents):
        code = doc["code"]
        print(f"[RUN {run_id[:8]}] Nạp IFC {code} ...")
        ifc = load_ifc_file(doc["file_url"])
        elems, skipped = build_geometry(ifc, code, union_cats)
        print(f"[RUN {run_id[:8]}]   → {len(elems)} cấu kiện có hình học, bỏ qua {skipped}.")
        all_elems.extend(elems)
        ifc_files[code] = ifc
        doc_ids[code] = doc["id"]
        skipped_total += skipped
        bb = model_bbox(elems)
        if bb:
            bboxes[code] = bb
        # Nạp mô hình chiếm 50% progress
        db.update_progress(run_id, int((idx + 1) / len(documents) * 50))

    # Cảnh báo lệch hệ tọa độ giữa các mô hình (>1km)
    if len(bboxes) >= 2:
        import numpy as np
        centers = {c: (np.array(b[0]) + np.array(b[1])) / 2 for c, b in bboxes.items()}
        vals = list(centers.values())
        max_gap = max(float(np.linalg.norm(v - vals[0])) for v in vals)
        if max_gap > 1000:
            print(f"[CẢNH BÁO] Các mô hình cách nhau {max_gap:.0f}m — nghi lệch hệ tọa độ (georeferencing).")

    # Chạy từng rule
    total_violations = 0
    total_checked = 0
    by_rule: dict[str, dict] = {}

    for r_idx, rule in enumerate(rules):
        p = rule.get("params") or {}
        rule_name = rule.get("name", "?")
        print(f"[RUN {run_id[:8]}] Rule: {rule_name}")

        # Phân giải nhóm trên từng mô hình rồi gộp (nhóm có thể trải nhiều mô hình)
        group_a: list[ElementGeom] = []
        group_b: list[ElementGeom] = []
        for code, ifc in ifc_files.items():
            elems_of_doc = [e for e in all_elems if e.doc_code == code]
            group_a += groups.resolve_group(elems_of_doc, p.get("groupA", {}), doc_ids.get(code), ifc)
            group_b += groups.resolve_group(elems_of_doc, p.get("groupB", {}), doc_ids.get(code), ifc)

        checked = len(group_a) * len(group_b)
        total_checked += checked

        if rule.get("rule_type") == "clash":
            found = run_clash(group_a, group_b,
                              tolerance=float(p.get("tolerance", 0.01)),
                              max_results=MAX_VIOLATIONS_PER_RULE)
        else:
            found = run_clearance(group_a, group_b,
                                  min_distance=float(p.get("minDistance", 1.0)),
                                  max_results=MAX_VIOLATIONS_PER_RULE)

        rows = [{
            "run_id": run_id,
            "rule_id": rule["id"],
            "status": "violation",
            "element_a": elem_ref(v.element_a),
            "element_b": elem_ref(v.element_b),
            "measured_value": v.measured_value,
            "position": v.position,
            "details": {"method": v.method, "rule_type": rule.get("rule_type")},
        } for v in found]
        if rows:
            db.insert_results_batch(rows)

        total_violations += len(found)
        by_rule[rule["id"]] = {"name": rule_name, "violations": len(found), "checked": checked}
        print(f"[RUN {run_id[:8]}]   → {len(found)} vi phạm / {checked} cặp xét.")

        db.update_progress(run_id, 50 + int((r_idx + 1) / len(rules) * 50))

    db.finish_run(run_id, {
        "violations": total_violations,
        "checked": total_checked,
        "skipped": skipped_total,
        "byRule": by_rule,
        "modelBboxes": bboxes,
    })
    print(f"[RUN {run_id[:8]}] HOÀN THÀNH — {total_violations} vi phạm.")


def poll_loop() -> None:
    print("=== CDE CIC Rule-Check Worker ===")
    print(f"    Chu kỳ quét: {POLLING_INTERVAL:.1f}s · Giới hạn: {MAX_VIOLATIONS_PER_RULE} vi phạm/rule")
    while True:
        try:
            run = db.fetch_pending_run()
            if run and db.claim_run(run["id"]):
                try:
                    process_run(run)
                except Exception as e:
                    traceback.print_exc()
                    db.fail_run(run["id"], str(e))
        except Exception:
            traceback.print_exc()
        time.sleep(POLLING_INTERVAL)


if __name__ == "__main__":
    poll_loop()
