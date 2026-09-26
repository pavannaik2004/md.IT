# Context — md.IT progress log

Single source of truth for project progress. **Read before starting any work; update after every piece of work.** Decisions and their reasons live in `decisions.md`.

## Current state

- **Phase:** 1 — Local editor (PRD §13)
- **Branch:** `phase-1-local-editor`
- **Stage:** executing plan inline (user chose Native); ledger at `.superpowers/sdd/2026-09-26-phase-1-local-editor/progress.md` (git-ignored)
- **Spec:** `docs/superpowers/specs/2026-09-26-phase-1-local-editor-design.md`
- **Plan:** `docs/superpowers/plans/2026-09-26-phase-1-local-editor.md` (14 tasks)
- **Done:** Tasks 1–13
- **Next step:** Task 14 (CI, README, push, PR) — needs `gh auth login`
- **Blockers to clear before Task 14:** `gh` token for `pavannaik2004` invalid (needs `gh auth login`). Docker Desktop now starts fine.

## Key references

- PRD: `PRD_v3_Technical_Markdown_Workspace (1).md`
- Design system (source of truth for UI): https://claude.ai/code/artifact/25c3c0a9-885a-4ec7-897b-9bd2901081a5 (`project/README.md`, `project/tokens.json`, `project/components/bundle.css`, `project/components/bundle.js`, `project/components/index.d.ts`)
- Remote: https://github.com/pavannaik2004/md.IT.git

## Phase checklist

| Phase | Status |
| --- | --- |
| 1. Local editor | In progress — implementing (Task 13/14 done) |
| 2. Technical rendering | Not started |
| 3. Customization and export | Not started |
| 4. Backend foundation | Not started |
| 5. Login and versions | Not started |
| 6. Kubernetes locally | Not started |
| 7. Azure | Not started |
| 8. Stretch | Not started |

## Log

Newest last. Format: `YYYY-MM-DD — what was done (files / commits)`.

- 2026-09-26 — Read PRD v3 and the md.IT design system artifact. Agreed with user: Phase 1 first; feature branches + PRs; design-system port to typed React; markdown-it; React state + Dexie. (decisions P-001…P-011)
- 2026-09-26 — `git init`, remote `origin` added. Created `context.md`, `decisions.md`, `README.md`, `.gitignore`. Wrote Phase 1 design spec.
- 2026-09-26 — User approved spec. Checked current package versions (Vite 8, Vitest 5, React 18.3, TS 6.0, Dexie 4.4, CodeMirror 6) and nginx tags. Wrote Phase 1 implementation plan (14 tasks); updated spec (dialogs module, `listProjectSummaries`, nginx 1.28, `npm test`). Decisions P-012…P-018.
- 2026-09-26 — User chose Native (inline) execution. Task 1: frontend scaffold (Vite 8.3, React 18.3.1, TS 6.0, Vitest 5.0, jsdom 29.1, ESLint 10, Dexie 4.4, CodeMirror 6), `.gitattributes` (LF), `debounce` + 4 tests; lint/typecheck/build clean.
- 2026-09-26 — Task 2: design system ported to `frontend/src/ui/` (tokens.css, components.css, 17 components incl. new MenuButton), snapshot in `docs/design-system/`, self-hosted fonts; 9 ui tests. Input now uses a separate <label> so hint/error text is not part of the field name (added to P-013).
- 2026-09-26 — Task 3: store foundation: types, typed errors + userMessage, naming rules, Dexie schema v1 (root parent stored as ''), hierarchy helpers, transaction guards; 15 tests.
- 2026-09-26 — Task 4: projects (summaries, CRUD, cascade delete) and folders (create/rename/move with cycle + cross-project checks, cascade delete); 15 tests. Store errors now named `MdIt*` because Dexie rewraps errors named like IndexedDB errors (`NotFoundError`).
- 2026-09-26 — Task 5: documents (create/rename/duplicate/move/delete/save, shared sibling namespace), settings, live-query hooks, store public API; 19 new tests (62 total).
- 2026-09-26 — Task 6: renderer: markdown-it (GFM, task lists, linkify, external links open safely) + DOMPurify, inline style stripped (P-020); 11 tests.
- 2026-09-26 — Task 7: shared ConfirmDialog and TextFieldDialog (store errors shown in plain words); 3 tests (76 total).
- 2026-09-26 — Task 8: useDocumentDraft: load, 1 s autosave, 150 ms preview debounce, flush on switch/unmount/hide/unload, failure + recovery, deleted-doc save ignored; 12 tests (88 total).
- 2026-09-26 — Task 9: CodeMirror 6 editor (GFM Markdown, history, Mod-s save, tokens theme, muted highlight) + jsdom polyfills for tests; 6 tests (94 total).
- 2026-09-26 — Task 10: app shell (router, theme applied from settings, persistent-storage request), project list (create/rename/describe/delete with confirmation, storage warning), MissingPage, text/time helpers, final main.tsx + app.css; 21 tests (115 total). Dev server serves `/` and deep links.
- 2026-09-26 — Task 11: file tree: nested rows (folders first, natural sort), inline rename with conflict errors, duplicate, Move to… dialog, drag-and-drop, delete confirmation listing contents, closes open doc when deleted; 20 tests (135 total).
- 2026-09-26 — Task 12: workspace: toolbar (wordmark, project, Split/Editor/Preview remembered, save status, theme), tree + editor + live sanitized preview, Ctrl/Cmd+S anywhere, missing project/document pages; 9 tests (144 total, stable over 3 runs).
- 2026-09-26 — Task 13: frontend container (node:22-alpine build → nginx:1.28-alpine), SPA fallback, CSP + security headers on every location, immutable asset caching. Verified: image builds; / 200 with CSP/no-cache; deep link 200; hashed asset immutable; missing asset 404; fonts served as font/woff2; built HTML has no inline scripts or eval.
