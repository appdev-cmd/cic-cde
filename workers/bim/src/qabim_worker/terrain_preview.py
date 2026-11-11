"""Preview cutout for the surveyed SVDSP terrain and its paved surfaces."""

SVDSP_TERRAIN_HASH = "811a0992f450468a2ec6974b196784ce081553fe82bfd23d62067262b429d8c8"
SVDSP_GRADE_ID = "1jj2pcgxH4OP_gtm_Wbdej"
SVDSP_PREVIEW_VERSION = 5


def pavement_footprint(model, settings):
    import ifcopenshell.geom
    from shapely import Polygon, union_all

    footprints = []
    for product in model.by_type("IfcGeographicElement"):
        if not (product.Name or "").startswith("Toposolid:Topo_Pave-"):
            continue
        shape = ifcopenshell.geom.create_shape(settings, product)
        mesh = shape.geometry
        vertices = list(mesh.verts)
        faces = list(mesh.faces)
        for triangle in triangles(vertices, faces):
            polygon = Polygon([(x, y) for x, y, _ in triangle])
            if polygon.is_valid and polygon.exterior.is_ccw:
                footprints.append(polygon)
    return union_all(footprints)


def triangles(vertices, faces):
    for start in range(0, len(faces), 3):
        yield [vertices[3 * index:3 * index + 3] for index in faces[start:start + 3]]


def trim_grade(vertices, faces, material_ids, footprint):
    from shapely import Polygon, constrained_delaunay_triangles, prepare

    # The pavement owns its plan footprint. Keep grade triangles outside that
    # footprint and all back and side faces, with the original vertex elevations.
    prepare(footprint)
    output_faces = []
    output_materials = []
    for i, triangle in enumerate(triangles(vertices, faces)):
        polygon = Polygon([(x, y) for x, y, _ in triangle])
        material = material_ids[i] if i < len(material_ids) else -1
        if not polygon.is_valid or not polygon.exterior.is_ccw or not footprint.intersects(polygon):
            output_faces.extend(faces[i * 3:i * 3 + 3])
            output_materials.append(material)
            continue
        exposed = polygon.difference(footprint)
        a, b, c = triangle
        ux, uy, uz = (b[k] - a[k] for k in range(3))
        vx, vy, vz = (c[k] - a[k] for k in range(3))
        determinant = ux * vy - uy * vx
        for piece in constrained_delaunay_triangles(exposed).geoms:
            if piece.area < 1e-10:
                continue
            ring = list(piece.exterior.coords)[:3]
            if not piece.exterior.is_ccw:
                ring.reverse()
            for x, y in ring:
                t = ((x - a[0]) * vy - (y - a[1]) * vx) / determinant
                u = (ux * (y - a[1]) - uy * (x - a[0])) / determinant
                output_faces.append(len(vertices) // 3)
                vertices.extend((x, y, a[2] + t * uz + u * vz))
            output_materials.append(material)
    return output_faces, output_materials
