# Architecture

## Stack Decision

The application stack has been selected. See decisions `0006` through `0009`
in `Docs/decisions/` for rationale.

| Surface | Stack | Status |
| --- | --- | --- |
| Browser (SPA) | React 19, TypeScript 5.8, Vite 6.2, Tailwind CSS 4 | Prototype implemented |
| BIM viewer | ThatOpen Components + Three.js + web-ifc | Prototype implemented |
| GeoBIM/GIS | Leaflet/Cesium (planned full integration) | Prototype implemented |
| API Gateway | Go | Planned |
| Document services | Go (file upload, ISO 19650 workflow, notifications) | Planned |
| BIM/AI services | Python (IfcOpenShell, RAG agent, gRPC) | Planned |
| Auth | Keycloak SSO + VNeID OAuth2/OIDC | Planned |
| Database | PostgreSQL (metadata) + MinIO (object storage) | Planned |
| Infrastructure | Viettel Cloud (primary) | Planned |

## Product Surfaces

- **Browser SPA**: the primary user interface for document management, BIM
  viewing, scheduling, and collaboration.
- **API**: RESTful endpoints via Go API Gateway for all client operations.
- **gRPC services**: internal communication between Go and Python services.
- **Worker**: background jobs for IFC parsing, clash detection, report
  generation.

## Core Domains

| Domain | Description | Key Concepts |
| --- | --- | --- |
| Document Management | ISO 19650 lifecycle (WIP, SHARED, PUBLISHED, ARCHIVED) | DocumentItem, Revision, Status, Folder |
| BIM Visualization | 3D model viewing, element selection, property inspection | IFC model, Fragment, Spatial tree, Properties |
| Clash Detection | Automated conflict detection between disciplines | ClashItem, Severity, Discipline pair |
| Scheduling (4D/5D) | Gantt chart linked to BIM elements, cost tracking | Task, WBS, BIM link, Cost item |
| GeoBIM/GIS | Geographic visualization of project assets | Map layer, 3D Tiles, Project location |
| Approval Workflow | Review and sign-off process for submittals and RFIs | ApprovalItem, Deadline, Reviewer |
| AI Assistant | Context-aware BIM analysis and document Q&A | Chat message, RAG context, Gemini API |
| Auth & Identity | User authentication via Keycloak + VNeID | Session, JWT, Role, Permission |

## Current Layering

```text
src/components/     <- UI components (interface layer)
  layout/           <- application shell (Sidebar, AppHeader)
  project/          <- project selection
  bim/              <- BIM viewer (ThatOpen integration)
  gis/              <- GeoBIM map
  tabs/             <- tab content (Dashboard, Documents, Viewer, Schedule)
src/App.tsx         <- routing and state orchestration (application layer)
src/types.ts        <- shared type definitions (domain layer - thin)
```

The frontend is currently a monolithic SPA with state managed via React hooks
and persisted to localStorage. When the backend is implemented, the layering
should evolve to:

```text
domain/
  <- application/
      <- infrastructure/
          <- interface/
              <- browser SPA
```

## Dependency Rule

Inner layers must not depend on outer layers.

| Layer | May depend on | Must not depend on |
| --- | --- | --- |
| domain | nothing project-external except pure utilities | framework, database, UI, provider, process/env |
| application | domain | framework, UI, provider, database concrete clients |
| infrastructure | domain, application | interface controllers or UI |
| interface | all backend layers | UI state or platform shell assumptions |
| browser SPA | API contracts and client-facing types | domain internals directly |

## Parse-First Boundary Rule

Unknown data must be parsed at boundaries before it enters inner code.

Boundaries include:

- HTTP request bodies, params, and query strings.
- JWT claims and session payloads.
- IFC file content (parsed via web-ifc/IfcOpenShell).
- localStorage reads (JSON.parse with fallback defaults).
- Gemini API responses.
- Environment variables.

Target flow:

```text
unknown input
  -> parser / validator
  -> typed DTO or command
  -> application use case
  -> domain object / value object
```

## Observability Contract

The future backend should emit one canonical JSON log line per request with:

- timestamp
- level
- request_id
- user_id when known
- action
- duration_ms
- status_code
- message

Audit logs are product records. Application logs are operational records. Do not
use one as a substitute for the other.

## Design System

The frontend uses Material Design 3 color tokens defined in `src/index.css`:

- Surface hierarchy: `background`, `surface`, `surface-container`,
  `surface-container-low`, `surface-container-lowest`.
- Semantic colors: `primary`, `secondary`, `tertiary`, `error`, `success`.
- On-colors: `on-surface`, `on-surface-variant`, `on-primary`, etc.
- Dark mode via `.dark` class on `<html>` with separate token values.

All styling uses Tailwind CSS utility classes referencing these tokens. No
inline styles, CSS modules, or separate CSS files beyond `index.css`.
