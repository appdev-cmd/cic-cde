# CLAUDE.md — CDE CIC Platform

## Project Overview

CDE CIC (Common Data Environment - Construction Information Center) is a BIM-based
document management and collaboration platform for Vietnam's construction industry.
It implements ISO 19650 document lifecycle management, 3D/4D/5D BIM visualization,
GeoBIM/GIS integration, and AI-assisted analysis.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend framework | React 19 + TypeScript 5.8 |
| Build tool | Vite 6.2 |
| Styling | Tailwind CSS 4 (Material Design 3 tokens) |
| BIM engine | ThatOpen Components (@thatopen/components, @thatopen/fragments) |
| 3D rendering | Three.js 0.184 + camera-controls |
| IFC parser | web-ifc 0.77 |
| Icons | lucide-react |
| Animation | motion (Framer Motion) |
| AI integration | Google Gemini (@google/genai) |
| State management | React useState + localStorage persistence |
| Backend (planned) | Go (API Gateway, document services) + Python (BIM/AI services via gRPC) |
| Auth (planned) | Keycloak SSO + VNeID integration |
| Database (planned) | PostgreSQL + MinIO object storage |

## Quick Start

```bash
npm install
npm run dev          # starts at http://localhost:3000
npm run build        # production build to dist/
npm run lint         # TypeScript type check (tsc --noEmit)
```

Requires `GEMINI_API_KEY` in `.env.local` for AI assistant features.

## Project Structure

```text
src/
  App.tsx                          # root component, routing, state
  main.tsx                         # React entry point
  index.css                        # Tailwind + MD3 design tokens
  types.ts                         # shared TypeScript interfaces
  components/
    layout/
      Sidebar.tsx                  # navigation drawer
      AppHeader.tsx                # top bar with tab navigation
    project/
      ProjectList.tsx              # project selection grid
    bim/
      BimViewer.tsx                # ThatOpen IFC viewer
    gis/
      GeoBimMap.tsx                # Cesium/Leaflet GeoBIM map
    tabs/
      DashboardTab.tsx             # project dashboard with KPIs
      DocumentsTab.tsx             # ISO 19650 document explorer
      ViewerTab.tsx                # BIM model viewer wrapper
      ScheduleTab.tsx              # 4D Gantt scheduling
```

## Coding Conventions

- Vietnamese for UI strings and user-facing content.
- English for code identifiers, comments, and technical docs.
- Tailwind CSS utility classes with Material Design 3 color tokens
  (e.g., `bg-surface`, `text-on-surface`, `text-primary`).
- Functional components with hooks only; no class components.
- State persistence via localStorage with `cic_cde_` prefix for keys.
- ISO 19650 document naming: `[Project]-[Originator]-[Volume]-[Level]-[Type]-[Discipline]-[Number]`.

## Harness Integration

This project uses `repository-harness`. Before work, read:

- `AGENTS.md`
- `Docs/HARNESS.md`
- `Docs/FEATURE_INTAKE.md`
- `Docs/ARCHITECTURE.md`
- `Docs/CONTEXT_RULES.md`

Use the Harness CLI at `scripts/bin/harness-cli.exe` (Windows) for operational
records: intake classification, story tracking, decision logging, and trace
recording. The durable layer lives in `harness.db` (SQLite, gitignored).

## Key Decisions

Recorded in `Docs/decisions/`:

- `0006-polyglot-backend.md` — Go + Python polyglot architecture
- `0007-openbim-viewer-engine.md` — ThatOpen as BIM viewer engine
- `0008-dual-cloud-infrastructure.md` — Viettel Cloud + backup strategy
- `0009-geobim-gis-architecture.md` — GeoBIM/GIS integration approach

## Important Notes

- The `Docs/` folder (capital D) contains both harness docs and project-specific
  documents (legal references, feasibility reports, business plans).
- The frontend is currently a high-fidelity prototype with mock data in
  localStorage. Backend services are planned but not implemented.
- BIM viewer uses IFC files loaded via URL; local file upload is supported.
- Dark mode is persisted in localStorage under `cic_cde_theme`.
