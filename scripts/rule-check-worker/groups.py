"""Phân giải nhóm cấu kiện từ params rule (categories + propertyFilters).

Đường nhanh: đọc bảng `elements` (đã trích xuất bởi converter) để lọc thuộc tính.
Fallback: đọc pset trực tiếp từ IFC bằng ifcopenshell.util.element.get_psets.
"""
from typing import Any

import ifcopenshell
import ifcopenshell.util.element

from ifc_loader import ElementGeom
import db


def _match_op(actual: Any, op: str, expected: Any) -> bool:
    if op == "exists":
        return actual is not None
    if actual is None:
        return False
    try:
        if op == "eq":
            return str(actual).strip().lower() == str(expected).strip().lower()
        if op == "neq":
            return str(actual).strip().lower() != str(expected).strip().lower()
        if op == "contains":
            return str(expected).strip().lower() in str(actual).lower()
        if op == "gt":
            return float(actual) > float(expected)
        if op == "lt":
            return float(actual) < float(expected)
    except (ValueError, TypeError):
        return False
    return False


def _find_prop_db(properties: dict, pset: str, name: str) -> Any:
    """Tìm thuộc tính trong jsonb `elements.properties` (converter làm phẳng theo pset)."""
    if not isinstance(properties, dict):
        return None
    # Dạng lồng: {"Pset_X": {"Prop": val}}
    ps = properties.get(pset)
    if isinstance(ps, dict) and name in ps:
        v = ps[name]
        return v.get("value") if isinstance(v, dict) else v
    # Dạng phẳng: {"Pset_X.Prop": val} hoặc {"Prop": val}
    for key in (f"{pset}.{name}", name):
        if key in properties:
            v = properties[key]
            return v.get("value") if isinstance(v, dict) else v
    return None


def _find_prop_ifc(ifc_file: ifcopenshell.file, express_id: int, pset: str, name: str) -> Any:
    try:
        el = ifc_file.by_id(express_id)
        psets = ifcopenshell.util.element.get_psets(el)
        ps = psets.get(pset)
        if isinstance(ps, dict):
            return ps.get(name)
    except Exception:
        pass
    return None


def resolve_group(
    elems: list[ElementGeom],
    group_params: dict,
    document_id: str | None,
    ifc_file: ifcopenshell.file | None,
) -> list[ElementGeom]:
    """Lọc danh sách ElementGeom (đã mesh) theo categories + propertyFilters."""
    categories = {c.upper() for c in group_params.get("categories", [])}
    filters = group_params.get("propertyFilters", []) or []

    pool = [e for e in elems if e.category in categories]
    if not filters:
        return pool

    # Đường nhanh: bảng elements
    props_by_express: dict[int, dict] = {}
    if document_id:
        try:
            rows = db.fetch_elements(document_id, list(categories))
            props_by_express = {r["express_id"]: (r.get("properties") or {}) for r in rows}
        except Exception as e:
            print(f"[groups] Không đọc được bảng elements ({e}) — fallback đọc pset từ IFC.")

    result = []
    for el in pool:
        ok = True
        for f in filters:
            pset, name, op = f.get("pset", ""), f.get("name", ""), f.get("op", "eq")
            expected = f.get("value")
            actual = None
            if el.express_id in props_by_express:
                actual = _find_prop_db(props_by_express[el.express_id], pset, name)
            if actual is None and ifc_file is not None:
                actual = _find_prop_ifc(ifc_file, el.express_id, pset, name)
            if not _match_op(actual, op, expected):
                ok = False
                break
        if ok:
            result.append(el)
    return result
