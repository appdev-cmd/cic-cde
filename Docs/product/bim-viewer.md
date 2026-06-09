# BIM Viewer — Product Contract

## Engine

ThatOpen Components v3 with Three.js rendering and web-ifc for IFC parsing.

## Capabilities

### Model Loading

- Load IFC files from URL or local file upload.
- Fragment-based rendering for performance.
- Support for IFC2x3 and IFC4 schemas.

### Navigation

- Orbit, pan, zoom via mouse/touch.
- Camera controls via camera-controls library.
- Fit-to-selection and fit-to-model.

### Element Interaction

- Click to select elements.
- Highlight selected elements.
- Multi-select support via highlight IDs.

### Spatial Tree

- Hierarchical browsing: Project > Site > Building > Storey > Element.
- Expand/collapse tree nodes.
- Click tree node to select and zoom to element.

### Property Inspector

- Display IFC properties for selected elements.
- Property sets (Pset) and quantity sets (Qto).
- Material information.

### Section Planes (Planned)

- Create horizontal and vertical section planes.
- Toggle section plane visibility.
- Move section planes interactively.

### Measurement (Planned)

- Point-to-point distance measurement.
- Area measurement.
- Volume measurement from quantity takeoff.

## 4D Integration

BIM elements can be linked to scheduling tasks. When a task is selected in the
Gantt chart, linked BIM elements are highlighted in the viewer. The viewer tab
switches automatically when viewing scheduled elements.

## 5D Integration (Planned)

Cost items linked to BIM element quantities. Automatic quantity extraction from
IFC property sets to support cost estimation.
