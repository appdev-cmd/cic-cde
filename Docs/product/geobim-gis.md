# GeoBIM / GIS — Product Contract

## Purpose

Geographic visualization of construction project portfolios, enabling
spatial context for BIM data at city and regional scale.

## Map Features

### Base Map

- CartoDB Dark Matter tile layer (current).
- Satellite imagery option (planned).
- Vietnam administrative boundary overlay (planned).

### Project Markers

- Interactive markers for each project location.
- Click to view project summary and navigate to project detail.
- Color-coded by project status/progress.

### 3D Tiles (Planned)

- OGC 3D Tiles (b3dm format) for city-scale BIM visualization.
- Integration with Cesium or deck.gl for 3D rendering.
- LOD (Level of Detail) streaming for large datasets.

## Architecture Decision

See `Docs/decisions/0009-geobim-gis-architecture.md` for the integration
approach decision.

## Current Prototype

`src/components/gis/GeoBimMap.tsx` renders an interactive map with project
locations. Full 3D Tiles integration is planned for the backend phase.
