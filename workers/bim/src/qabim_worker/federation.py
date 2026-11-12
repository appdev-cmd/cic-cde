"""Federated hard-clash checks using float64 IFC geometry in the project frame."""

import hashlib
import json
import math
from collections import Counter
from dataclasses import dataclass

import ifcopenshell
import ifcopenshell.geom
import numpy as np

from spatial import spatial_location

MAX_CLASH_PRODUCTS = 5_000
MAX_CLASH_FINDINGS = 1_000
MESH_PRECISION = 1.e-6


class ClashScopeLimitError(ValueError):
    def __init__(self, count):
        formatted_count = f"{count:,}".replace(",", ".")
        formatted_limit = f"{MAX_CLASH_PRODUCTS:,}".replace(",", ".")
        super().__init__(
            f"Phạm vi có ít nhất {formatted_count} đối tượng, vượt giới hạn {formatted_limit}. "
            "Hãy chọn một tầng hoặc giảm số mô hình rồi chạy lại."
        )
        self.details = {"reason": "clash_products", "count": count, "limit": MAX_CLASH_PRODUCTS}


@dataclass
class Mesh:
    model_id: str
    step_id: int
    element_id: str
    name: str
    storey: str
    in_a: bool
    in_b: bool
    points: np.ndarray
    faces: np.ndarray
    lower: np.ndarray
    upper: np.ndarray


def model_transform(transform):
    offset = np.asarray(transform.get("translation", [0, 0, 0]), dtype=np.float64)
    angle = math.radians(float(transform.get("rotationZDegrees", 0)))
    if offset.shape != (3,) or not np.isfinite(offset).all() or not math.isfinite(angle):
        raise ValueError("Invalid model transform")
    return offset, math.cos(angle), math.sin(angle)


def closed_mesh(faces):
    if not faces or len(faces) % 3:
        return False
    edges = Counter()
    for a, b, c in zip(faces[::3], faces[1::3], faces[2::3]):
        if a == b or b == c or c == a:
            return False
        edges[(min(a, b), max(a, b))] += 1
        edges[(min(b, c), max(b, c))] += 1
        edges[(min(c, a), max(c, a))] += 1
    return all(count == 2 for count in edges.values())


def overlapping_meshes(meshes, tolerance):
    """Keep only meshes with a distinct opposite-group 3D envelope hit."""
    keep = np.zeros(len(meshes), dtype=bool)
    a = np.flatnonzero([m.in_a for m in meshes])
    b = np.flatnonzero([m.in_b for m in meshes])
    if not len(a) or not len(b):
        return keep
    if len(b) < len(a):
        a, b = b, a
    lower = np.stack([m.lower for m in meshes])
    upper = np.stack([m.upper for m in meshes])
    # Leave a margin for transient IFC conversion and numerical roundoff.
    padding = max(tolerance, MESH_PRECISION, 8 * np.spacing(np.max(np.abs([lower, upper]))))
    lower_b, upper_b = lower[b], upper[b]
    for i in a:
        matches = (b != i) & np.all(lower_b <= upper[i] + padding, axis=1) & np.all(upper_b >= lower[i] - padding, axis=1)
        if matches.any():
            keep[i] = True
            keep[b[matches]] = True
    return keep


def best_measurements(clashes, tolerance):
    """Deduplicate physical pairs; a valid measurement supersedes fallback contact."""
    measured = {}
    unmeasured = set()
    for clash in clashes:
        aid, bid = clash.a.id(), clash.b.id()
        if aid == bid:
            continue
        key = (min(aid, bid), max(aid, bid))
        if clash.clash_type not in (0, 1) or not math.isfinite(clash.distance):
            unmeasured.add(key)
            continue
        if clash.distance < tolerance:
            continue
        previous = measured.get(key)
        if previous is None or (clash.distance, -aid) > (previous.distance, -previous.a.id()):
            measured[key] = clash
    return measured.values(), len(unmeasured - measured.keys())


def run_federation(params):
    sources = params["sources"]
    source_ids = {s["modelId"] for s in sources}
    if not 1 <= len(sources) <= 12 or len(source_ids) != len(sources):
        raise ValueError("Select 1 to 12 distinct model snapshots")
    allowed = {"IfcBeam", "IfcColumn", "IfcSlab", "IfcWall", "IfcDuctSegment", "IfcPipeSegment"}
    class_a, class_b = params.get("classA", "IfcDuctSegment"), params.get("classB", "IfcBeam")
    tolerance = float(params.get("tolerance", .002))
    if class_a not in allowed or class_b not in allowed:
        raise ValueError("Unsupported IFC class")
    if not math.isfinite(tolerance) or not .0001 <= tolerance <= 1:
        raise ValueError("Invalid tolerance")
    scope_a, scope_b = set(params["modelIdsA"]), set(params["modelIdsB"])
    if not scope_a or not scope_b or not (scope_a | scope_b) <= source_ids:
        raise ValueError("Invalid model scope")
    floor = params.get("floor", "all")

    expected = 0
    missing, snapshots, meshes = [], [], []
    check_origin = None
    for source in sources:
        model_id = source["modelId"]
        with open(source["path"], "rb") as file:
            digest = hashlib.file_digest(file, "sha256").hexdigest()
        if source.get("sourceHash") and digest != source["sourceHash"]:
            raise ValueError("STALE_SNAPSHOT")
        transform = source.get("transform", {})
        offset, cos, sin = model_transform(transform)
        snapshots.append({"modelId": model_id, "sourceHash": digest, "transform": transform})
        model = ifcopenshell.open(source["path"])
        a = {p.id() for p in model.by_type(class_a)} if model_id in scope_a else set()
        b = {p.id() for p in model.by_type(class_b)} if model_id in scope_b else set()
        products = {}
        for step_id in sorted(a | b):
            product = model.by_id(step_id)
            storey, _ = spatial_location(product)
            if floor == "all" or storey == floor:
                products[step_id] = (product, storey)
        expected += len(products)
        if expected > MAX_CLASH_PRODUCTS:
            raise ClashScopeLimitError(expected)

        represented = [p for p, _ in products.values() if p.Representation is not None]
        settings = ifcopenshell.geom.settings()
        settings.set("use-world-coords", True)
        iterator = ifcopenshell.geom.iterator(settings, model, 1, include=represented) if represented else None
        generated = set()
        if iterator and iterator.initialize():
            while True:
                shape = iterator.get()
                step_id = shape.id
                generated.add(step_id)
                product, storey = products[step_id]
                geometry = shape.geometry
                faces = geometry.faces
                points = np.array(geometry.verts, dtype=np.float64).reshape((-1, 3))
                reason = None
                if not len(points) or not np.isfinite(points).all():
                    reason = "invalid_vertices"
                elif not closed_mesh(faces):
                    reason = "non_manifold"
                else:
                    if sin != 0 or cos != 1:
                        x, y = points[:, 0].copy(), points[:, 1].copy()
                        points[:, 0] = cos*x - sin*y
                        points[:, 1] = sin*x + cos*y
                    points += offset
                    if check_origin is None:
                        check_origin = points[0].copy()
                    points -= check_origin
                    if not np.isfinite(points).all():
                        raise ValueError("Non-finite transformed geometry")
                    meshes.append(Mesh(
                        model_id, step_id, source.get("idPrefix", "") + digest[:16] + ":" + str(step_id),
                        product.Name or product.is_a(), storey, step_id in a, step_id in b,
                        points, np.array(faces, dtype=np.int32).reshape((-1, 3)) + 1,
                        points.min(axis=0), points.max(axis=0),
                    ))
                if reason:
                    missing.append({"modelId": model_id, "stepId": step_id, "reason": reason})
                if not iterator.next():
                    break
        missing.extend({"modelId": model_id, "stepId": step_id,
                        "reason": "tessellation_failed" if product.Representation is not None else "no_representation"}
                       for step_id, (product, _) in products.items() if step_id not in generated)

    keep = overlapping_meshes(meshes, tolerance)
    pruned = len(meshes) - int(keep.sum())
    group_a, group_b, refs, failed = [], [], {}, set()
    clashes = []
    if keep.any():
        merged = ifcopenshell.file(schema="IFC4")
        origin = merged.createIfcAxis2Placement3D(merged.createIfcCartesianPoint((0., 0., 0.)), None, None)
        context = merged.createIfcGeometricRepresentationContext(None, "Model", 3, MESH_PRECISION, origin, None)
        merged.createIfcProject(ifcopenshell.guid.new(), None, "Transient federation", None, None, None, None, [context],
                                merged.createIfcUnitAssignment([merged.createIfcSIUnit(None, "LENGTHUNIT", None, "METRE")]))
        for i in np.flatnonzero(keep):
            mesh = meshes[i]
            coords = merged.createIfcCartesianPointList3D(mesh.points.tolist())
            face_set = merged.createIfcTriangulatedFaceSet(coords, None, True, mesh.faces.tolist(), None)
            rep = merged.createIfcShapeRepresentation(context, "Body", "Tessellation", [face_set])
            proxy = merged.create_entity("IfcBuildingElementProxy", GlobalId=ifcopenshell.guid.new(), Name=mesh.name,
                                         Representation=merged.createIfcProductDefinitionShape(None, None, [rep]))
            refs[proxy.id()] = i

        tree = ifcopenshell.geom.tree()
        it = ifcopenshell.geom.iterator(ifcopenshell.geom.settings(), merged, 1)
        converted = set()
        if it.initialize():
            while True:
                shape = it.get()
                tree.add_element(shape)
                converted.add(shape.id)
                if not it.next():
                    break
        for proxy_id, i in refs.items():
            mesh = meshes[i]
            if proxy_id not in converted:
                failed.add(i)
                missing.append({"modelId": mesh.model_id, "stepId": mesh.step_id, "reason": "check_mesh_conversion_failed"})
                continue
            proxy = merged.by_id(proxy_id)
            if mesh.in_a:
                group_a.append(proxy)
            if mesh.in_b:
                group_b.append(proxy)
        if group_a and group_b:
            clashes = tree.clash_intersection_many(group_a, group_b, tolerance=tolerance, check_all=True)

    measured, unmeasured = best_measurements(clashes, tolerance)
    findings = []
    for clash in measured:
        a, b = meshes[refs[clash.a.id()]], meshes[refs[clash.b.id()]]
        findings.append({
            "a": a.element_id, "b": b.element_id, "modelAId": a.model_id, "modelBId": b.model_id,
            "title": a.name + " × " + b.name, "storey": a.storey, "severity": "high", "status": "new",
            "rule": f"{class_a} × {class_b}", "demo": False, "distance": clash.distance,
            "measurementKind": "protrusion" if clash.clash_type == 0 else "pierce",
            "pointA": (np.asarray(clash.p1) + check_origin).tolist(),
            "pointB": (np.asarray(clash.p2) + check_origin).tolist(),
        })
    findings.sort(key=lambda f: (-f["distance"], f["modelAId"], f["modelBId"], f["a"], f["b"]))
    for i, finding in enumerate(findings[:MAX_CLASH_FINDINGS], 1):
        finding["id"] = f"H-{i:04d}"
    usable = [mesh for i, mesh in enumerate(meshes) if i not in failed]
    count_a, count_b = sum(m.in_a for m in usable), sum(m.in_b for m in usable)
    has_candidate_groups = bool(count_a and count_b and len(usable) > 1)
    limit_reached = len(findings) > MAX_CLASH_FINDINGS
    return {
        "findings": findings[:MAX_CLASH_FINDINGS], "snapshots": snapshots,
        "sourceHash": hashlib.sha256(json.dumps(snapshots, sort_keys=True).encode()).hexdigest(),
        "engineVersion": ifcopenshell.version,
        "method": "IfcOpenShell triangle intersection; float64 canonical geometry; rigid transforms; 3D envelope prefilter",
        "rule": {"classA": class_a, "classB": class_b, "floor": floor, "toleranceMetres": tolerance,
                 "modelIdsA": sorted(scope_a), "modelIdsB": sorted(scope_b)},
        "coverage": {"expected": expected, "generated": len(usable), "missing": missing, "groupA": count_a, "groupB": count_b,
                     "limitReached": limit_reached, "complete": has_candidate_groups and not missing and not unmeasured and not limit_reached,
                     "hasCandidateGroups": has_candidate_groups, "unmeasuredCollisionPairs": unmeasured,
                     "prunedByBounds": pruned, "totalMeasuredPairs": len(findings)},
    }
