# CDE CIC — Product Overview

## Vision

A Common Data Environment platform purpose-built for Vietnam's construction
industry, enabling BIM-based collaboration under ISO 19650 standards with
integration to national digital identity (VNeID) and domestic cloud
infrastructure (Viettel Cloud).

## Target Users

| Role | Primary Use |
| --- | --- |
| BIM Manager | Model coordination, clash detection, approval workflow |
| Architect / Engineer | Document upload, model viewing, design review |
| Project Manager | Dashboard KPIs, scheduling, progress tracking |
| Contractor | Document access, submittal review, field coordination |
| Government Inspector | Audit access, compliance verification |

## Product Modules

### 1. Document Management (ISO 19650)

Standard-compliant document lifecycle with status workflow:

- **WIP (S0)**: work in progress, visible only to originator team.
- **SHARED (S1)**: shared for coordination across disciplines.
- **PUBLISHED (S2)**: approved and published for construction.
- **ARCHIVED (S3)**: historical record, read-only.

Document naming follows ISO 19650 convention:
`[Project]-[Originator]-[Volume]-[Level]-[Type]-[Discipline]-[Number]`.

### 2. BIM Viewer (3D/4D/5D)

Web-based IFC model viewer with:

- 3D navigation (orbit, pan, zoom, section planes).
- Element selection and property inspection.
- Spatial tree browsing (building, storey, element).
- 4D scheduling: link Gantt tasks to BIM elements for time-based visualization.
- 5D cost tracking: associate cost items with BIM quantities (planned).

### 3. Clash Detection

Automated conflict detection between building disciplines:

- Structure vs MEP (ST-MEP).
- Architecture vs Structure (AR-ST).
- MEP vs MEP cross-discipline.
- Severity classification: High, Medium, Low.
- Status tracking: Unresolved, In Review, Resolved.

### 4. GeoBIM / GIS Dashboard

Geographic visualization of project portfolios:

- Project locations on interactive map.
- 3D Tiles integration for city-scale BIM.
- OGC-compliant data layers.

### 5. Approval Workflow

Structured review process for:

- RFIs (Requests for Information).
- Submittals (design documents, shop drawings).
- Material approvals.
- Deadline tracking and notification.

### 6. AI Assistant

Context-aware assistant powered by Gemini:

- BIM model analysis and Q&A.
- Document summarization.
- Regulation lookup and compliance checking.

### 7. Auth & Identity

- Keycloak SSO for enterprise authentication.
- VNeID integration for government officials.
- Role-based access control (RBAC) per project.
