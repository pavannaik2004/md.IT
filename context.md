# Context — md.IT progress log

Single source of truth for project progress. **Read before starting any work; update after every piece of work.** Decisions and their reasons live in `decisions.md`.

## Current state

- **Phase:** 3 (customization and export) — building natively from the plan; see the log for the last finished task
- **Branch:** `phase-3-customization-export` (from `main` at a8ca095, the PR #2 merge)
- **Next step:** continue the plan task by task (ledger: `.superpowers/sdd/2026-10-02-phase-3-customization-export/progress.md`)
- **Deferred minors from Phase 2 review:** editor drop of images mixed with other files silently ignores the others; an async image insert can land in another document after a switch, and the drop position isn’t clamped; every autosave rebuilds the path index and re-renders; a link to a folder says “isn’t in this project” instead of “Only links to documents…”; an image whose bytes are missing shows “Loading image…” forever; a raw-HTML `data-doc-id` isn’t escaped in the route or checked against the project; the hover thumbnail isn’t clamped to the viewport or moved on tree scroll
- **Deferred minors from Phase 1 review:** document from another project opens via hand-edited URL; collapsed folder with the open document re-opens on autosave; keyboard gaps (dialog focus trap, arrow keys in menus/tree, SaveStatus announces every save); theme/mode flash on load; nginx gzip; tests for failed-save-then-switch and real-store NotFound path

## Key references

- PRD: `PRD_v3_Technical_Markdown_Workspace (1).md`
- Design system (source of truth for UI): https://claude.ai/code/artifact/25c3c0a9-885a-4ec7-897b-9bd2901081a5 (`project/README.md`, `project/tokens.json`, `project/components/bundle.css`, `project/components/bundle.js`, `project/components/index.d.ts`)
- Remote: https://github.com/pavannaik2004/md.IT.git

## Phase checklist

| Phase | Status |
| --- | --- |
| 1. Local editor | Done — merged 2026-09-26 (PR #1) |
| 2. Technical rendering | Done — merged 2026-10-02 (PR #2) |
| 3. Customization and export | In progress |
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
- 2026-09-26 — Task 14: CI workflow (.github/workflows/ci.yml: lint, typecheck, test, build, docker build on PRs touching frontend/), README run instructions. Final check from clean `npm ci`: lint ✓, typecheck ✓, 144/144 tests ✓, build ✓; no Dexie import outside src/store/. Spec acceptance: 1 ✓, 2 ✓ (container serves app), 3 covered by component tests — manual browser check pending with user, 4 ✓.
- 2026-09-26 — Task 14: whole-branch review (fresh reviewer): 1 Critical, 3 Important (+1 re-graded), 8 Minor. Fixed with tests first: reopening a document after Back reused stale content and could overwrite saved text; `<style>` blocks now stripped; Ctrl+S retries a failed save and leaving the page asks while changes are unconfirmed; IDs work over plain HTTP (`newId`); dropping onto a document moves into its folder. 152 tests. Decisions P-020 (extended), P-021, P-022.
- 2026-09-26 — Pushed `main` and `phase-1-local-editor`; user opened and merged PR #1 (merge commit 613fe27). CI (`frontend` job) passed in 57 s on first run. Deleted local phase-1 branch; created `phase-2-technical-rendering` from `main`.
- 2026-09-26 — Browser check done: user tried the container at localhost:8080 and confirmed it works. Also verified with headless Edge (Playwright) against both the container and the dev server: live preview renders headings/bold/lists, content persists across reload, no console errors.
- 2026-09-26 — Phase 2 brainstorming: images as tree files, no-navigate image rows with Insert in document, relative .md links open in workspace, two-stage rendering. Probed fake-indexeddb: Blob does not round-trip under jsdom, ArrayBuffer does. Wrote Phase 2 design spec. Decisions P-023…P-027.
- 2026-09-26 — User approved the Phase 2 spec. Wrote the 11-task implementation plan. Settled while planning (spec updated): design-system class `md-img-missing`, a loading state for images whose bytes haven't loaded, notices owned by the Workspace, links to non-documents marked unsupported, editor `insertBlock` (images always on their own lines), no fallback folder (nothing else can be named `images`). Probed jsdom: `File.arrayBuffer` works; `execCommand`, `matchMedia`, `clipboard` are absent.
- 2026-09-26 — Task 1: image storage — schema v2 (images metadata + imageData ArrayBuffer), image rules, add/rename/move/delete, shared sibling namespace, cascades, findOrCreateFolder, useImages (src/store/*; 169 tests).
- 2026-09-26 — Task 2: paths module — resolve relative hrefs (., .., /, case-insensitive, percent-decoding) and build relative hrefs (src/paths/; 177 tests).
- 2026-09-26 — Task 3: renderer context, link rule (data-doc-id / data-missing), image rule ({width align}, missing and loading placeholders), blob: allowed by DOMPurify (src/renderer/; 200 tests).
- 2026-09-26 — Task 4: CodeBlock markup (copy button, language label) with highlight.js for the nine PRD languages; --syntax-* tokens; mermaid placeholder with URI-encoded source (DOMPurify drops attribute values containing -->) (src/renderer/, ui/tokens.css, ui/components.css; 220 tests).
- 2026-09-26 — Task 5: KaTeX math — in-house $ / $$ rules, inline and block errors, output spliced in after sanitizing at nonce placeholders (src/renderer/math.ts; 235 tests).
- 2026-09-26 — Task 6: preview wrapper (copy buttons with plain-HTTP fallback, relative links kept in the app), workspace Notice (src/preview/, app/Notice.tsx, DocumentArea, Workspace; 252 tests).
- 2026-09-27 — Task 7: lazy Mermaid (strict, cached per theme+source, stale results dropped, load failure notice), useResolvedTheme, theme passed to the preview (src/preview/mermaid.ts, app/theme.ts; 263 tests). Mermaid is its own chunk; main bundle 1.28 MB (434 kB gzip).
- 2026-09-27 — Task 8: editor insertBlock handle (adds only missing blank lines, one undo step) and image drop/paste hand-off (src/editor/; 269 tests).
- 2026-09-27 — Task 9: tree image rows — Insert in document, rename/move/delete, drag moves, hover thumbnail, image files dropped from the computer, folder-delete counts images (src/tree/; 283 tests).
- 2026-09-27 — Task 10: workspace wiring — object URLs per image, render context (stored images, loading state, document links), Insert image button, editor drops/pastes and tree inserts land in images/ next to the document (src/app/; 297 tests, stable over 3 runs).
- 2026-09-27 — Task 11: verification. Clean `npm ci`: lint ✓, typecheck ✓, 297/297 tests ✓, build ✓. Main bundle 1,296 kB (440 kB gzip; KaTeX + highlight.js), Mermaid in lazy chunks (mermaid.core 94 kB + diagram chunks), none in the main bundle. Container: image builds, / 200. Headless Edge against the container: 4 diagrams (flowchart, sequence, class, ER) + 1 inline diagram error; 2 KaTeX + 1 math error; 9/9 languages highlighted; copy button copies; uploaded image width=50% align=right; missing-image placeholder; survives reload; renaming the image shows the placeholder; Mermaid not requested for a plain document; no console or CSP errors. Decisions P-028, P-029.
- 2026-09-27 — Final whole-branch review (fresh reviewer): with fixes; fixed inline math swallowing a later code span and # / ? left unencoded in inserted image paths (tests first; 300 tests). Theme-colour race not reproducible in Edge (ruling). 7 minors deferred (listed under Current state).
- 2026-10-02 — Added root `CLAUDE.md`: `context.md` is the single source of truth for progress (read before any work, log every event with its date after it), and every decision goes in `decisions.md`. (decision P-030)
- 2026-10-02 — Gave the user a Phase 2 manual test document (in chat, not saved to the repo): code blocks in all 9 languages plus plain and unregistered ones, inline/display/invalid math and text that must stay plain, 4 Mermaid diagrams plus a broken one, stored/missing/external images, document/missing/folder/external links, and sanitizer cases. It needs an `images/diagram.png` and a `Notes.md` in the project. No code changes; 300 tests unchanged.
- 2026-10-02 — Started Phase 3. Re-ran lint ✓, typecheck ✓, 300/300 tests ✓, then pushed `phase-2-technical-rendering` and opened PR #2 (https://github.com/pavannaik2004/md.IT/pull/2) at the user's request. User chose one cycle for all of Phase 3 (decision P-031). Brainstorming began: read PRD §5.6, §5.7, §5.9, §7, §13 and the existing settings, preview and workspace code.
- 2026-10-02 — PR #2 merged (merge commit a8ca095, CI `frontend` green). Created `phase-3-customization-export` from it; local `main` fast-forwarded, local Phase 2 branch deleted. User asked to include the service worker and chose search-left / right panel (Outline · Stats · Settings) and PDF via the print dialog. Wrote the Phase 3 design spec (`docs/superpowers/specs/2026-10-02-phase-3-customization-export-design.md`), approved by the user. Decisions P-032…P-041.
- 2026-10-02 — Wrote the Phase 3 implementation plan (18 tasks, `docs/superpowers/plans/2026-10-02-phase-3-customization-export.md`). Probed while planning: fflate 0.8.3 (dir entries, Unicode names, sizes before inflating; pre-1980 dates throw), jsdom 29 (keeps CSS custom properties; no scrollIntoView/document.fonts/img.decode; srcdoc iframe fires load with a stubbable print), Fontsource `./*.css` exports. Found that `renderDiagrams` reads colours from the live `:root`, so exports pass a light-token reader. Spec updated with what planning settled (fflate, parse signature, Escape keeps focus, snippet click leaves Preview-only mode, light diagram tokens). Decision P-042.
- 2026-10-02 — Phase 3 Task 1: rendering settings model (defaults, limits, clamp, CSS variables) and useRenderingSettings hook; settings keys doc.rendering, ui.panel, ui.panelTab (frontend/src/settings/, store/settings.ts; 311 tests).
- 2026-10-02 — Phase 3 Task 2: RangeField (ported, controlled), SettingsPanel, and rendering settings applied as --doc-* variables on the preview's .md-prose (ui/RangeField.tsx, settings/SettingsPanel.tsx, preview/Preview.tsx, app/DocumentArea.tsx, app/Workspace.tsx; 320 tests).
- 2026-10-02 — Phase 3 Task 3: shared markdown-it instance (renderer/md.ts), headings carry data-line, analyze() for outline and statistics; escapeHtml exported (renderer/; 327 tests).
- 2026-10-02 — Phase 3 Task 4: editor handle gains revealLine, select and getText (editor/Editor.tsx; 331 tests).
- 2026-10-02 — Phase 3 Task 5: side panel (toolbar toggle, Outline · Stats · Settings, remembered) with outline clicks scrolling preview and editor (app/SidePanel.tsx, outline/, app/Workspace.tsx, app.css, test/setup.ts; 340 tests).
- 2026-10-02 — Phase 3 Task 6: pure project search (names first, content by match count, ≤3 snippets, ≤100 results; query is plain text) (search/search.ts; 347 tests).
- 2026-10-02 — Phase 3 Task 7: search box (Ctrl/Cmd+Shift+F, Escape clears), results with marked snippets replacing the tree, snippet click opens the document with the match selected, folder/image results reveal the tree row (search/, tree/FileTree.tsx, app/Workspace.tsx; 353 tests).
- 2026-10-02 — Phase 3 Task 8: createRenderContext moved to paths/renderContext.ts (tests moved with it); renderDiagrams takes a token reader for diagram colours (paths/, app/useProjectFiles.ts, preview/mermaid.ts, preview/index.ts; 354 tests).
