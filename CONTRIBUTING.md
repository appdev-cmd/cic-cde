# Contributing

## Development Workflow

This project follows the `repository-harness` methodology. Every change goes
through the harness task loop defined in `Docs/HARNESS.md`.

### Before You Start

1. Read `AGENTS.md` and `CLAUDE.md` for project context.
2. Run `scripts/bin/harness-cli.exe query matrix` to see current proof status.
3. Classify your work using `Docs/FEATURE_INTAKE.md`.

### Making Changes

1. **Intake**: classify the request and choose a lane (tiny/normal/high-risk).
2. **Plan**: create or update a story packet if normal or high-risk.
3. **Implement**: work inside the selected lane's requirements.
4. **Validate**: run `npm run lint` and test affected features in the browser.
5. **Trace**: record what happened with `scripts/bin/harness-cli.exe trace`.

### Commit Messages

Use conventional commit format:

```text
feat: add document upload dialog
fix: correct IFC model orientation in viewer
docs: update architecture decision for auth flow
refactor: extract BIM toolbar into separate component
```

### Branch Strategy

- `main` — stable, deployable code
- `feature/<story-id>-<short-name>` — feature branches tied to stories
- `fix/<issue>` — bug fix branches

### Code Style

- TypeScript strict mode (`tsc --noEmit` must pass).
- Tailwind CSS utility classes; no inline styles or CSS modules.
- Vietnamese for UI text; English for code.
- Functional React components with hooks.

### Story Workflow

Normal stories use `Docs/templates/story.md`. High-risk stories use the
`Docs/templates/high-risk-story/` folder structure with overview, design,
execution plan, and validation docs.

Update proof status after implementation:

```bash
scripts/bin/harness-cli.exe story update --id US-XXX --unit 1 --integration 0 --e2e 0 --platform 0
```

### Decision Records

When changing architecture, auth, data model, API shape, or validation
requirements, add a decision record:

1. Copy `Docs/templates/decision.md` to `Docs/decisions/NNNN-short-name.md`.
2. Register with `scripts/bin/harness-cli.exe decision add --id NNNN-short-name --title "Title" --doc Docs/decisions/NNNN-short-name.md`.
