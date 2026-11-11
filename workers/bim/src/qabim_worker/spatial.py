"""Resolve IFC products to their containing building storey and room."""
from ifcopenshell.util.element import get_parent


def spatial_location(product):
    space = None
    current = product
    visited = set()
    while current is not None and current.id() not in visited:
        visited.add(current.id())
        if space is None and current.is_a("IfcSpace"):
            space = {
                "id": current.GlobalId,
                "number": current.Name or "",
                "name": current.LongName or "",
            }
        if current.is_a("IfcBuildingStorey"):
            return current.Name or current.LongName or current.GlobalId, space
        current = get_parent(current)
    return "Unassigned", space
