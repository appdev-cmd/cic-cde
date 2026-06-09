# Test Matrix

This file maps product behavior to proof.

## Status Values

| Status | Meaning |
| --- | --- |
| planned | Accepted as intended behavior, not implemented |
| in_progress | Actively being built |
| implemented | Implemented and proof exists |
| changed | Contract changed after earlier implementation |
| retired | No longer part of the product contract |

## Matrix

### Backend Stories

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-001 | API Gateway & VNeID SSO | no | no | no | no | planned | none |
| US-002 | ISO 19650 Document Services | no | no | no | no | planned | none |
| US-003 | BIM Viewer Integration | no | no | no | no | planned | none |
| US-004 | GeoBIM/GIS Dashboard | no | no | no | no | planned | none |
| US-005 | Cost & Schedule 5D | no | no | no | no | planned | none |

### Frontend Stories

| Story | Contract | Unit | Integration | E2E | Platform | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US-FE-001 | ThatOpen BIM Viewer | no | no | no | no | in_progress | Prototype with IFC loading and element selection |
| US-FE-002 | Documents Explorer | no | no | no | no | in_progress | Prototype with ISO 19650 status workflow |
| US-FE-003 | Cesium/GeoBIM Dashboard | no | no | no | no | in_progress | Prototype with map markers |
| US-FE-004 | 4D Gantt Chart | no | no | no | no | in_progress | Prototype with BIM element linking |

## Evidence Rules

- Unit proof covers pure domain and application rules.
- Integration proof covers backend enforcement, data integrity, provider
  behavior, jobs, or service contracts.
- E2E proof covers user-visible browser flows.
- Platform proof covers only shell, deployment, mobile, desktop, or runtime
  behavior that cannot be proven in lower layers.
- A story can be implemented without every proof column if the story packet
  explains why.
- Frontend prototype features are marked `in_progress` until test coverage
  exists.
