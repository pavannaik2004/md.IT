# md.IT

A local-first technical writing workspace: Markdown editor, live preview, and a project/folder hierarchy, all in the browser. No account needed; signing in (later phases) adds cloud version history.

- Product requirements: `PRD_v3_Technical_Markdown_Workspace (1).md`
- Progress log: `context.md`
- Decision log: `decisions.md`
- Specs and plans: `docs/superpowers/`

## Run it

Requirements: Node 22+, npm, Docker (for the container).

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173
npm test           # unit and component tests
npm run lint && npm run typecheck && npm run build
```

Container (same image as production):

```bash
docker build -t mdit-frontend frontend
docker run --rm -p 8080:80 mdit-frontend   # http://localhost:8080
```

## Status

Phase 1 (local editor) complete: projects, folders and documents stored in this browser; CodeMirror editor; live preview; split/editor/preview modes; autosave. See `context.md` for progress.
