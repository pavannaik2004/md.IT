# Decisions

Every decision taken while building md.IT, newest last. Each entry: what, why, alternatives considered. PRD open decisions (D1–D8) keep their PRD IDs; project decisions use `P-NNN`.

| ID | Date | Decision | Why | Alternatives considered |
| --- | --- | --- | --- | --- |
| P-001 | 2026-09-26 | Build in phase-sized cycles (spec → plan → build), starting with PRD Phase 1 only | One spec for all 8 phases would be huge and go stale; each phase is independently useful | Phases 1–3 in one cycle; Phases 1 + 4 together |
| P-002 | 2026-09-26 | Git flow: feature branch per cycle (e.g. `phase-1-local-editor`), pushed and opened as a PR; `main` only changes by merge | Matches PRD CI-on-PR / deploy-on-merge model; keeps `main` clean | Commit to `main` directly; commit locally only |
| P-003 | 2026-09-26 | Port the md.IT design system into typed React components under `frontend/src/ui/`; `tokens.css` built from `tokens.json`, component CSS from `bundle.css` | Typed, tree-shaken, testable; stays close to the source so changes can flow back to the design system | Vendor `bundle.js` as global `window.MdIt`; separate workspace package (YAGNI with one consumer) |
| P-004 | 2026-09-26 | Markdown pipeline: markdown-it | Synchronous and fast for live preview; mature plugins (KaTeX, task lists); token stream serves outline/stats; custom image-attribute rule is small | remark/unified (async, heavier) |
| P-005 | 2026-09-26 | State: React state + Dexie `useLiveQuery`; no Redux/Zustand | Store is the source of truth; live queries keep UI in sync without a second cache | Zustand, Redux Toolkit |
| P-006 | 2026-09-26 | Tooling: npm, Vite, React 18, TypeScript strict, Vitest + Testing Library + fake-indexeddb, ESLint | npm already installed; single JS package; Vite/Vitest share config | pnpm; Jest |
| P-007 | 2026-09-26 | Self-host Geist, Geist Mono, Source Serif 4 via Fontsource (deviation from design system's Google Fonts `@import`) | App must work offline; CSP stays `'self'`; exports (Phase 3) can embed the same files | Google Fonts at runtime |
| P-008 | 2026-09-26 | Names unique among siblings (case-insensitive, folders and documents together); documents keep `.md` in `title` | Zip export paths and relative image paths (Phases 2–3) must not collide; tree shows real filenames | Allow duplicates and disambiguate at export time |
| P-009 | 2026-09-26 | Root-level parent stored as `""` in IndexedDB, exposed as `null` by the store API | IndexedDB cannot index `null`; compound index `[projectId+parentFolderId]` needs a value | Separate `isRoot` flag; unindexed filter |
| P-010 | 2026-09-26 | Service worker for offline reload deferred to Phase 3 (`vite-plugin-pwa`) | PRD lists no phase for it; Phase 1 data already works offline once loaded | Add in Phase 1 |
| P-011 | 2026-09-26 | Theme: follows `prefers-color-scheme`, manual override (`system`/`light`/`dark`) stored in settings, applied as `data-theme` on `<html>` | Design system defines both themes with shared token names | Light only |
