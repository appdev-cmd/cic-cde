# Agent Instructions

## Project

CDE CIC — a BIM-based Common Data Environment platform for Vietnam's
construction industry. See `CLAUDE.md` for full project context, tech stack,
and coding conventions.

## Before Work

1. Read `CLAUDE.md` for project overview and conventions.
2. Read `Docs/FEATURE_INTAKE.md` to classify your task.
3. Run `.\scripts\bin\harness-cli.exe query matrix` to check current proof status.
4. If normal or high-risk, also read `Docs/ARCHITECTURE.md` and relevant
   `Docs/product/*` docs.

## Key Paths

| What | Where |
| --- | --- |
| Source code | `src/` |
| Product contracts | `Docs/product/` |
| Story packets | `Docs/stories/` |
| Decision records | `Docs/decisions/` |
| Templates | `Docs/templates/` |
| Design tokens | `src/index.css` |
| Harness CLI (Windows) | `scripts/bin/harness-cli.exe` |
| Harness database | `harness.db` |

<!-- HARNESS:BEGIN -->
## Harness

This repo uses Harness. Before work, read:

- `CLAUDE.md`
- `Docs/HARNESS.md`
- `Docs/FEATURE_INTAKE.md`
- `Docs/ARCHITECTURE.md`
- `Docs/CONTEXT_RULES.md`
- `.\scripts\bin\harness-cli.exe query matrix` on Windows

Use the Rust Harness CLI at `scripts/bin/harness-cli.exe` on Windows as the
main operational tool.
<!-- HARNESS:END -->
