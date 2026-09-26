# Phase 1 — Local editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-only md.IT workspace in its own Nginx container: projects, nested folders and Markdown documents stored in IndexedDB, a CodeMirror editor with a live sanitized preview, three view modes, autosave with a visible save status — all surviving a reload.

**Architecture:** One Vite + React 18 + TypeScript app in `frontend/`. Modules with one job each: `ui/` (md.IT design system ported to typed React), `store/` (the only Dexie importer), `renderer/` (pure markdown-it + DOMPurify), `editor/` (CodeMirror 6), `tree/` (hierarchy UI), `dialogs/` (shared dialogs), `app/` (routing, screens, autosave wiring), `lib/` (tiny pure helpers). Components read the store through `useLiveQuery` hooks and mutate it through plain async functions.

**Tech Stack:** Node 22, npm, Vite 8, React 18.3, TypeScript 6.0, React Router 7 (`react-router`), Dexie 4 + dexie-react-hooks, markdown-it 15 + markdown-it-task-lists, DOMPurify 3, CodeMirror 6, Fontsource (Geist, Geist Mono, Source Serif 4), Vitest 5 + Testing Library + jsdom + fake-indexeddb, ESLint 10 + typescript-eslint, Docker (node:22-alpine → nginx:1.28-alpine), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-phase-1-local-editor-design.md` (read it with this plan). PRD: `PRD_v3_Technical_Markdown_Workspace (1).md`. Design system snapshot: `docs/design-system/` (created in Task 2).

## Global Constraints

- All commands run from `frontend/` unless a step says otherwise. Shell is Git Bash on Windows; use forward slashes.
- **Progress logging (user requirement):** before starting a task, read `context.md`; after finishing it, append a dated line to its **Log** (`2026-09-26 — Task N: <what> (<files>, <commit>)`), update **Current state**, and add any new decision to `decisions.md`. Commit those edits together with the task's code.
- Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `phase-1-local-editor`; never commit to `main`.
- Only files under `frontend/src/store/` may import `dexie` or `dexie-react-hooks` (enforced by ESLint in Task 1).
- `renderer/` is pure: no imports from other app modules, no side effects beyond DOMPurify.
- UI uses design-system tokens as CSS variables only — no hard-coded colors, font families, or sizes outside `ui/tokens.css` (layout px values for the app shell are allowed where the spec gives them).
- Voice: sentence case, verb-first actions, no emoji, no exclamation marks, curly quotes and apostrophes in UI copy (`“”`, `’`), product name **md.IT**. Avoid "sync", "server", "IndexedDB" in UI text.
- Every interactive element keeps a visible 2px `--focus` ring; motion respects `prefers-reduced-motion`.
- Timestamps are `number` (ms since epoch). IDs are `crypto.randomUUID()`.
- Autosave delay 1000 ms; preview debounce 150 ms.
- Sibling names (folders and documents together, same parent) are unique case-insensitively; documents always end in `.md`.
- Tests: `npm test` (= `vitest run`). Lint: `npm run lint`. Types: `npm run typecheck`. Build: `npm run build`.

## Review Focus

1. **Switching documents while an autosave is pending** — the pending text must be written to the document it was typed into, never to the newly opened one, and nothing is lost. Test: Task 8 `saves pending edits to the previous document when switching`.
2. **Names differing only by case or surrounding spaces** (`"  notes.md "`, `"Notes.md"`) — trimmed, then rejected as a duplicate with “… already exists here.” Test: Task 5 `rejects names that differ only by case or spaces`.
3. **Deleting the open document (or a folder containing it) with an autosave pending** — the workspace returns to the project, no “Couldn’t save” appears, and the deleted document is not recreated. Tests: Task 8 `ignores a save for a document deleted meanwhile`, Task 12 `returns to the project when the open document is deleted`.
4. **Moving an item into a folder that already has an item of that name** (by menu or drag) — rejected with the conflict message; nothing moves. Test: Task 5 `rejects a move into a folder with a same-named item`, Task 11 shows the message.
5. **Stale links** — opening `/p/<deleted-id>` or `/p/<id>/d/<deleted-id>` shows a plain explanation with a way back, not a blank page or crash. Tests: Task 12 `says so when the project is not in this browser` and `says so when the document is missing`.

---

## File map

```text
.gitattributes                              Task 1
frontend/
  package.json, package-lock.json           Task 1
  index.html                                Task 1
  vite.config.ts                            Task 1
  tsconfig.json, tsconfig.node.json         Task 1
  eslint.config.js                          Task 1
  .dockerignore, Dockerfile                 Task 13
  nginx/default.conf, nginx/security-headers.conf   Task 13
  src/
    main.tsx                                Task 1 (stub) → Task 10 (final)
    vite-env.d.ts                           Task 1
    test/setup.ts                           Task 1 (+ CodeMirror polyfills Task 9)
    lib/debounce.ts (+test)                 Task 1
    lib/text.ts (+test)                     Task 10
    lib/time.ts (+test)                     Task 10
    ui/                                     Task 2
      tokens.css, components.css, styles.ts, cx.ts, icons.ts
      Icon.tsx, Wordmark.tsx, Button.tsx, IconButton.tsx, SegmentedControl.tsx,
      Menu.tsx, MenuButton.tsx, Input.tsx, TreeItem.tsx, SaveStatus.tsx,
      EmptyState.tsx, Prose.tsx, Callout.tsx, Badge.tsx, Kbd.tsx, Dialog.tsx,
      index.ts, ui.test.tsx
    store/
      types.ts, errors.ts, names.ts, db.ts, hierarchy.ts, guards.ts   Task 3
      projects.ts, folders.ts                                          Task 4
      documents.ts, settings.ts, hooks.ts, index.ts                    Task 5
      *.test.ts
    renderer/render.ts, markdown-it-task-lists.d.ts, render.test.ts   Task 6
    dialogs/ConfirmDialog.tsx, TextFieldDialog.tsx, dialogs.test.tsx  Task 7
    app/useDocumentDraft.ts (+test)                                    Task 8
    editor/theme.ts, extensions.ts, Editor.tsx, Editor.test.tsx        Task 9
    app/App.tsx, theme.ts, storage.ts, ThemeMenu.tsx, StorageWarning.tsx,
        MissingPage.tsx, ProjectList.tsx, app.css (+tests)             Task 10
    tree/buildTree.ts, messages.ts, FileTree.tsx, RenameField.tsx,
        MoveDialog.tsx, tree.css (+tests)                              Task 11
    app/Workspace.tsx, DocumentArea.tsx (+test)                        Task 12
.github/workflows/ci.yml                                               Task 14
docs/design-system/                                                    Task 2
```

---

### Task 1: Frontend scaffold, tooling, and `debounce`

**Files:**
- Create: `.gitattributes`, `frontend/package.json`, `frontend/index.html`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/eslint.config.js`, `frontend/src/main.tsx`, `frontend/src/vite-env.d.ts`, `frontend/src/test/setup.ts`, `frontend/src/lib/debounce.ts`
- Test: `frontend/src/lib/debounce.test.ts`

**Interfaces:**
- Produces: `debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A>` where `Debounced<A>` is callable with `flush(): void`, `cancel(): void`, `pending(): boolean`. npm scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`.

- [ ] **Step 1: Line endings**

Create `.gitattributes` at the repo root:

```gitattributes
* text=auto eol=lf
*.png binary
*.jpg binary
*.gif binary
*.webp binary
*.woff binary
*.woff2 binary
*.ico binary
```

Run from repo root: `git add --renormalize . && git status --short` (expect the existing files to show as modified only if their endings changed).

- [ ] **Step 2: `frontend/package.json`**

```json
{
  "name": "mdit-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc -p tsconfig.json && tsc -p tsconfig.node.json",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Install dependencies**

```bash
cd frontend
npm install react@18.3.1 react-dom@18.3.1 react-router@^7.18 dexie@^4.4 dexie-react-hooks@^4.4 \
  markdown-it@^15 markdown-it-task-lists@^2.1 dompurify@^3.4 \
  @codemirror/state@^6.7 @codemirror/view@^6.43 @codemirror/commands@^6.11 @codemirror/language@^6.12 \
  @codemirror/lang-markdown@^6.5 @lezer/highlight@^1.2 \
  @fontsource-variable/geist@^5.3 @fontsource-variable/geist-mono@^5.3 @fontsource-variable/source-serif-4@^5.3
npm install -D typescript@~6.0.3 vite@^8 @vitejs/plugin-react@^6 vitest@^5 jsdom@^30 \
  @testing-library/react@^16 @testing-library/dom@^10 @testing-library/user-event@^14 @testing-library/jest-dom@^7 \
  fake-indexeddb@^6 @types/react@18.3.31 @types/react-dom@18.3.7 @types/markdown-it@^14 @types/node@^22 \
  eslint@^10 @eslint/js@^10 typescript-eslint@^8.70 eslint-plugin-react-hooks@^7 globals@^17
```

Expected: installs without `ERESOLVE` errors. If a peer conflict appears, resolve it by adjusting the conflicting version (not `--force`) and record the change in `decisions.md`.

- [ ] **Step 4: Config files**

`frontend/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>md.IT</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

`frontend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

`frontend/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

`frontend/eslint.config.js`:

```js
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const dexieOnlyInStore = {
  paths: [
    { name: 'dexie', message: 'Only src/store/ may import Dexie (PRD §7).' },
    { name: 'dexie-react-hooks', message: 'Only src/store/ may import Dexie (PRD §7).' },
  ],
};

export default defineConfig(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-imports': ['error', dexieOnlyInStore],
    },
  },
  {
    files: ['src/store/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
```

`frontend/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`frontend/src/main.tsx` (stub, replaced in Task 10):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <p>md.IT</p>
  </StrictMode>,
);
```

`frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
```

- [ ] **Step 5: Write the failing test** — `frontend/src/lib/debounce.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('calls once with the latest arguments after the delay', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d('b');
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('flush runs a pending call immediately and only once', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('x');
    expect(d.pending()).toBe(true);
    d.flush();
    expect(fn).toHaveBeenCalledWith('x');
    expect(d.pending()).toBe(false);
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending does nothing', () => {
    const fn = vi.fn();
    debounce(fn, 100).flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel drops a pending call', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('x');
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    expect(d.pending()).toBe(false);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- src/lib/debounce.test.ts`
Expected: FAIL — cannot resolve `./debounce`.

- [ ] **Step 7: Implement** — `frontend/src/lib/debounce.ts`

```ts
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  /** Run the pending call now, if there is one. */
  flush(): void;
  /** Drop the pending call. */
  cancel(): void;
  pending(): boolean;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const run = () => {
    timer = undefined;
    const args = lastArgs;
    lastArgs = undefined;
    if (args) fn(...args);
  };

  const debounced = ((...args: A) => {
    lastArgs = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(run, ms);
  }) as Debounced<A>;

  debounced.flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    run();
  };
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    lastArgs = undefined;
  };
  debounced.pending = () => timer !== undefined;
  return debounced;
}
```

- [ ] **Step 8: Verify everything passes**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: 4 tests pass; lint and typecheck clean; `dist/` produced.

- [ ] **Step 9: Update logs and commit**

Update `context.md` (Log + Current state: "Task 1 done") and record resolved package versions in the log line. From repo root:

```bash
git add .gitattributes frontend context.md decisions.md
git commit -m "feat(frontend): scaffold Vite React TS app with tooling and debounce

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Design system port (`ui/`)

**Files:**
- Create: `docs/design-system/{README.md,tokens.json,index.d.ts,bundle.css,bundle.js}` (snapshot)
- Create: `frontend/src/ui/tokens.css`, `components.css`, `styles.ts`, `cx.ts`, `icons.ts`, `Icon.tsx`, `Wordmark.tsx`, `Button.tsx`, `IconButton.tsx`, `SegmentedControl.tsx`, `Menu.tsx`, `MenuButton.tsx`, `Input.tsx`, `TreeItem.tsx`, `SaveStatus.tsx`, `EmptyState.tsx`, `Prose.tsx`, `Callout.tsx`, `Badge.tsx`, `Kbd.tsx`, `Dialog.tsx`, `index.ts`
- Test: `frontend/src/ui/ui.test.tsx`

**Interfaces:**
- Produces (all exported from `src/ui/index.ts`):
  - `type IconName = 'file' | 'folder' | 'folder-open' | 'chevron-right' | 'chevron-down' | 'plus' | 'search' | 'copy' | 'check' | 'x' | 'more' | 'columns' | 'pencil' | 'eye' | 'history' | 'cloud' | 'alert' | 'info' | 'trash' | 'download' | 'image' | 'sliders' | 'sidebar' | 'user'`
  - `Icon({ name, size?=16, label?, className? })`, `Wordmark({ size?: 'md'|'lg', className? })`
  - `Button(props: ButtonHTMLAttributes & { variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'; icon?; iconRight? })`
  - `IconButton` (forwardRef `<HTMLButtonElement>`; `{ icon; label; active?; size?: 'sm'|'md' } & ButtonHTMLAttributes`)
  - `SegmentedControl<T extends string>({ options: {value: T; label?; icon?}[]; value: T; onChange(v: T); label: string })`
  - `type MenuItem = 'separator' | { label; icon?; shortcut?; danger?; disabled?; onSelect?(): void }`, `Menu({ items, className? })`
  - `MenuButton({ items: MenuItem[]; label: string; icon?: IconName = 'more'; size?: 'sm'|'md' })`
  - `Input(InputHTMLAttributes & { label?; hint?; error?; icon?; shortcut? })`
  - `TreeItem(HTMLAttributes<div> & { kind: 'folder'|'file'|'image'; name; depth?; open?; active?; dirty?; dropTarget?; trailing?: ReactNode; onClick?(): void })`
  - `type SaveStatusState = 'saved'|'saving'|'failed'|'cloud'`, `SaveStatus({ state?; detail?; children? })`
  - `EmptyState({ icon?; title; children?; action? })`, `Prose(HTMLAttributes & { html?: string })`, `Callout({ tone?: 'info'|'positive'|'warning'|'danger'; title?; children?; actions? })`, `Badge({ tone?; children })`, `Kbd({ children })`
  - `Dialog({ title; children?; actions?; onClose?(); tone?: 'danger'; inline?; open?=true })`
  - `src/ui/styles.ts` side-effect module importing fonts + CSS.

- [ ] **Step 1: Snapshot the design system into the repo**

Copy the five source files into `docs/design-system/`. They were saved during brainstorming under the session scratchpad at `artifact-files/25c3c0a9-885a-4ec7-897b-9bd2901081a5/project/` (`README.md`, `tokens.json`, `components/index.d.ts`, `components/bundle.css`, `components/bundle.js`). If that folder is gone, fetch them again with the Artifact tool: `action: "read_file"`, `url: "https://claude.ai/code/artifact/25c3c0a9-885a-4ec7-897b-9bd2901081a5"`, `paths: ["project/README.md","project/tokens.json","project/components/index.d.ts","project/components/bundle.css","project/components/bundle.js"]`. Add `docs/design-system/SOURCE.md`:

```markdown
# Design system snapshot

Copied 2026-09-26 from the md.IT design system artifact
(https://claude.ai/code/artifact/25c3c0a9-885a-4ec7-897b-9bd2901081a5, version 1790418393-3ef6).
The artifact is the source of truth; this snapshot is a reference for the port in `frontend/src/ui/`.
App-side extensions that should be upstreamed are listed in `decisions.md` (P-013).
```

- [ ] **Step 2: `frontend/src/ui/tokens.css`**

```css
/* md.IT design tokens — generated by hand from docs/design-system/tokens.json. */
:root {
  color-scheme: light;
  --paper: #faf9f7;
  --paper-raised: #ffffff;
  --paper-sunken: #f3f1ed;
  --paper-code: #f5f3ef;
  --line: #e7e4de;
  --line-strong: #8d877d;
  --ink: #1b1a18;
  --ink-muted: #5f5a52;
  --ink-faint: #8a847a;
  --accent: #0d6b62;
  --accent-hover: #0a5952;
  --accent-soft: #e2f0ed;
  --on-accent: #ffffff;
  --marker: #fbecb8;
  --positive: #1f5fad;
  --positive-soft: #e6eef9;
  --warning: #8a5300;
  --warning-soft: #fbf0dc;
  --danger: #b3261e;
  --danger-soft: #fbe9e7;
  --link: var(--accent);
  --focus: var(--accent);
  --shadow-pop: 0 1px 2px rgba(27, 26, 24, 0.06), 0 8px 24px rgba(27, 26, 24, 0.1);

  /* Fontsource registers the variable faces as "<Family> Variable". */
  --font-sans: "Geist Variable", "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-serif: "Source Serif 4 Variable", "Source Serif 4", "Iowan Old Style", Georgia, serif;
  --font-mono: "Geist Mono Variable", "Geist Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-full: 999px;

  --control-sm: 28px;
  --control-md: 32px;
  --toolbar-height: 44px;
  --sidebar-width: 264px;
  --doc-measure: 720px;

  --doc-letter-spacing: 0em;
  --doc-line-height: 1.65;
  --doc-margin: 0px;
  --doc-padding: 48px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --paper: #141413;
    --paper-raised: #1c1c1a;
    --paper-sunken: #101010;
    --paper-code: #1a1a18;
    --line: #2c2b28;
    --line-strong: #6e6961;
    --ink: #edebe7;
    --ink-muted: #a9a49b;
    --ink-faint: #7f7a72;
    --accent: #5cc4b8;
    --accent-hover: #7fd3c9;
    --accent-soft: #12302c;
    --on-accent: #0c1a18;
    --marker: #4a3c12;
    --positive: #8ab6f2;
    --positive-soft: #15243a;
    --warning: #e8b04b;
    --warning-soft: #34260c;
    --danger: #f2908a;
    --danger-soft: #3a1714;
    --shadow-pop: 0 1px 2px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.45);
  }
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --paper: #141413;
  --paper-raised: #1c1c1a;
  --paper-sunken: #101010;
  --paper-code: #1a1a18;
  --line: #2c2b28;
  --line-strong: #6e6961;
  --ink: #edebe7;
  --ink-muted: #a9a49b;
  --ink-faint: #7f7a72;
  --accent: #5cc4b8;
  --accent-hover: #7fd3c9;
  --accent-soft: #12302c;
  --on-accent: #0c1a18;
  --marker: #4a3c12;
  --positive: #8ab6f2;
  --positive-soft: #15243a;
  --warning: #e8b04b;
  --warning-soft: #34260c;
  --danger: #f2908a;
  --danger-soft: #3a1714;
  --shadow-pop: 0 1px 2px rgba(0, 0, 0, 0.5), 0 8px 24px rgba(0, 0, 0, 0.45);
}
```

- [ ] **Step 3: `frontend/src/ui/components.css`**

Copy `docs/design-system/bundle.css` to `frontend/src/ui/components.css`, then delete its first line (the `@import url('https://fonts.googleapis.com/...')`) — fonts are self-hosted (P-007). Append this block at the end:

```css
/* ---------- md.IT app extensions (upstream to the design system: decisions P-013) ---------- */
.md-field-error { font: 400 12px/16px var(--font-sans); color: var(--danger); }
.md-input:has(input[aria-invalid="true"]) { border-color: var(--danger); }
.md-menu-popover { position: fixed; z-index: 30; }
.md-tree-item { outline-offset: -2px; }
.md-tree-item:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.md-tree-item.is-drop-target { background: var(--accent-soft); box-shadow: inset 0 0 0 1px var(--accent); color: var(--ink); }
.md-tree-trailing { display: inline-flex; margin-left: auto; }
.md-tree-trailing .md-iconbtn { width: 22px; height: 22px; }
.md-dialog.is-danger .md-dialog-title { color: var(--ink); }
.md-dialog:focus { outline: none; }
```

- [ ] **Step 4: `frontend/src/ui/styles.ts`**

First confirm the Fontsource entry points exist: `ls node_modules/@fontsource-variable/source-serif-4/` must list `wght.css` and `wght-italic.css`; if the names differ, use the ones present and note it in `decisions.md`.

```ts
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@fontsource-variable/source-serif-4/wght.css';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import './tokens.css';
import './components.css';
```

- [ ] **Step 5: Write the failing tests** — `frontend/src/ui/ui.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, Input, MenuButton, SaveStatus, SegmentedControl, TreeItem, Wordmark } from './index';

describe('ui', () => {
  it('Wordmark is labelled md.IT', () => {
    render(<Wordmark />);
    expect(screen.getByLabelText('md.IT')).toBeInTheDocument();
  });

  it('SegmentedControl marks the current option and reports changes', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="View"
        value="split"
        onChange={onChange}
        options={[
          { value: 'split', label: 'Split', icon: 'columns' },
          { value: 'preview', label: 'Preview', icon: 'eye' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Split' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Preview' }));
    expect(onChange).toHaveBeenCalledWith('preview');
  });

  it('MenuButton opens, runs an item, and closes', async () => {
    const onSelect = vi.fn();
    render(<MenuButton label="Actions for Notes" items={[{ label: 'Rename', onSelect }, 'separator', { label: 'Delete', danger: true }]} />);
    const trigger = screen.getByRole('button', { name: 'Actions for Notes' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('MenuButton closes on Escape and on an outside click', async () => {
    render(
      <div>
        <p>outside</p>
        <MenuButton label="More" items={[{ label: 'Rename' }]} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('MenuButton item clicks do not reach ancestors', async () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <MenuButton label="More" items={[{ label: 'Rename' }]} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('Dialog is labelled by its title, focuses its first field, and closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Rename project" onClose={onClose}>
        <Input label="Name" defaultValue="OS" />
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Rename project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Input shows an error as an alert and marks the field invalid', () => {
    render(<Input label="Name" error="Name can’t be empty." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Name can’t be empty.');
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('TreeItem is focusable, named, and activates with Enter', () => {
    const onClick = vi.fn();
    render(<TreeItem kind="file" name="Threads.md" onClick={onClick} />);
    const item = screen.getByRole('treeitem', { name: 'Threads.md' });
    expect(item).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('SaveStatus names where work is saved', () => {
    render(<SaveStatus state="saved" />);
    expect(screen.getByRole('status')).toHaveTextContent('Saved locally');
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- src/ui`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 7: Implement the components**

`frontend/src/ui/cx.ts`:

```ts
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
```

`frontend/src/ui/icons.ts` (paths copied from `bundle.js`; `[path, strokeWidth?]`):

```ts
export type IconName =
  | 'file' | 'folder' | 'folder-open' | 'chevron-right' | 'chevron-down' | 'plus' | 'search' | 'copy'
  | 'check' | 'x' | 'more' | 'columns' | 'pencil' | 'eye' | 'history' | 'cloud' | 'alert' | 'info'
  | 'trash' | 'download' | 'image' | 'sliders' | 'sidebar' | 'user';

type IconPath = readonly [d: string, strokeWidth?: number];

export const ICONS: Record<IconName, readonly IconPath[]> = {
  file: [['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'], ['M14 3v5h5']],
  folder: [['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z']],
  'folder-open': [
    ['M3 17V7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1'],
    ['M3 17l2.3-5.8A2 2 0 0 1 7.2 10H21l-2.5 7.6A2 2 0 0 1 16.6 19H5a2 2 0 0 1-2-2z'],
  ],
  'chevron-right': [['M9.5 6.5l5.5 5.5-5.5 5.5']],
  'chevron-down': [['M6.5 9.5l5.5 5.5 5.5-5.5']],
  plus: [['M12 5v14M5 12h14']],
  search: [['M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0z'], ['M20 20l-4.3-4.3']],
  copy: [
    ['M10 8h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z'],
    ['M15 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4'],
  ],
  check: [['M5 12.5l4.5 4.5L19 7.5']],
  x: [['M6.5 6.5l11 11M17.5 6.5l-11 11']],
  more: [['M6 12h.01M12 12h.01M18 12h.01', 2.6]],
  columns: [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'], ['M12 4v16']],
  pencil: [['M4 20h4L19.3 8.7a2.1 2.1 0 0 0-3-3L5 17v3'], ['M14.5 7.5l2 2']],
  eye: [
    ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'],
    ['M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
  ],
  history: [['M3.5 12A8.5 8.5 0 1 0 6 6'], ['M3.5 3.5V8H8'], ['M12 8v4l3 2']],
  cloud: [['M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 9.3 4.6 4.6 0 0 0 7 18.5z']],
  alert: [
    ['M10.3 4.9a2 2 0 0 1 3.4 0l7.1 12.4a2 2 0 0 1-1.7 3H4.9a2 2 0 0 1-1.7-3z'],
    ['M12 10v4'],
    ['M12 17h.01', 2.4],
  ],
  info: [['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'], ['M12 11v5'], ['M12 8h.01', 2.4]],
  trash: [['M4 7h16'], ['M10 11v6M14 11v6'], ['M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12'], ['M9 7V4h6v3']],
  download: [['M12 4v11'], ['M7 10l5 5 5-5'], ['M5 20h14']],
  image: [
    ['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'],
    ['M4 16l5-5 4 4 2-2 5 5'],
    ['M16 8.5h.01', 2.6],
  ],
  sliders: [['M4 7h10M18 7h2M4 17h4M12 17h8'], ['M16 5v4M10 15v4']],
  sidebar: [['M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'], ['M9.5 4v16']],
  user: [['M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z'], ['M4.5 20.5a7.5 7.5 0 0 1 15 0']],
};
```

`frontend/src/ui/Icon.tsx`:

```tsx
import { cx } from './cx';
import { ICONS, type IconName } from './icons';

export interface IconProps {
  name: IconName;
  size?: number;
  label?: string;
  className?: string;
}

export function Icon({ name, size = 16, label, className }: IconProps) {
  return (
    <svg
      className={cx('md-icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {ICONS[name].map(([d, width], i) => (
        <path key={i} d={d} strokeWidth={width} />
      ))}
    </svg>
  );
}
```

`frontend/src/ui/Wordmark.tsx`:

```tsx
import { cx } from './cx';

export function Wordmark({ size = 'md', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <span className={cx('md-wordmark', size === 'lg' && 'md-wordmark-lg', className)} aria-label="md.IT" role="img">
      md<span className="md-wordmark-dot">.</span>IT
    </span>
  );
}
```

`frontend/src/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: IconName;
  iconRight?: IconName;
}

export function Button({ variant = 'secondary', size, icon, iconRight, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} {...rest} className={cx('md-btn', `md-btn-${variant}`, size === 'sm' && 'md-btn-sm', className)}>
      {icon && <Icon name={icon} />}
      {children != null && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} />}
    </button>
  );
}
```

`frontend/src/ui/IconButton.tsx`:

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, active, size, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cx('md-iconbtn', active && 'is-active', size === 'md' && 'md-iconbtn-md', className)}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      <Icon name={icon} />
    </button>
  );
});
```

`frontend/src/ui/SegmentedControl.tsx`:

```tsx
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: IconName;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div className="md-seg" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={cx('md-seg-item', on && 'is-on')}
            onClick={() => onChange(option.value)}
          >
            {option.icon && <Icon name={option.icon} />}
            {option.label && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

`frontend/src/ui/Menu.tsx`:

```tsx
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type MenuItem =
  | 'separator'
  | { label: string; icon?: IconName; shortcut?: string; danger?: boolean; disabled?: boolean; onSelect?: () => void };

export function Menu({ items, className }: { items: readonly MenuItem[]; className?: string }) {
  return (
    <div className={cx('md-menu', className)} role="menu">
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="md-menu-sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={cx('md-menu-item', item.danger && 'is-danger')}
            onClick={item.onSelect}
          >
            <span className="md-menu-icon">{item.icon && <Icon name={item.icon} />}</span>
            <span className="md-menu-label">{item.label}</span>
            {item.shortcut && <span className="md-menu-kbd">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}
```

`frontend/src/ui/MenuButton.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';
import type { IconName } from './icons';
import { Menu, type MenuItem } from './Menu';

const MENU_WIDTH = 208;

export interface MenuButtonProps {
  items: readonly MenuItem[];
  label: string;
  icon?: IconName;
  size?: 'sm' | 'md';
}

/** An IconButton that opens a Menu in a fixed-position popover (never clipped by scrolling panels). */
export function MenuButton({ items, label, icon = 'more', size }: MenuButtonProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPosition(null), []);

  useEffect(() => {
    if (!position) return;
    popoverRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const onPointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [position, close]);

  const toggle = (event: MouseEvent) => {
    event.stopPropagation();
    if (position) return close();
    const rect = buttonRef.current!.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: Math.max(8, rect.right - MENU_WIDTH) });
  };

  const wrapped = items.map((item): MenuItem =>
    item === 'separator'
      ? item
      : {
          ...item,
          onSelect: () => {
            close();
            item.onSelect?.();
          },
        },
  );

  return (
    <>
      <IconButton
        ref={buttonRef}
        icon={icon}
        label={label}
        size={size}
        aria-haspopup="menu"
        aria-expanded={position !== null}
        onClick={toggle}
      />
      {position &&
        createPortal(
          // React events bubble through portals; stop them so a row behind the menu never activates.
          <div
            ref={popoverRef}
            className="md-menu-popover"
            style={{ top: position.top, left: position.left }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Menu items={wrapped} />
          </div>,
          document.body,
        )}
    </>
  );
}
```

`frontend/src/ui/Kbd.tsx`:

```tsx
import type { ReactNode } from 'react';

export function Kbd({ children }: { children?: ReactNode }) {
  return <kbd className="md-kbd">{children}</kbd>;
}
```

`frontend/src/ui/Input.tsx`:

```tsx
import { useId, type InputHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Kbd } from './Kbd';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  shortcut?: string;
}

export function Input({ label, hint, error, icon, shortcut, className, id, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;
  return (
    <label className={cx('md-field', className)} htmlFor={inputId}>
      {label && <span className="md-field-label">{label}</span>}
      <span className={cx('md-input', icon && 'has-icon')}>
        {icon && <Icon name={icon} />}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          {...rest}
        />
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </span>
      {error ? (
        <span id={messageId} className="md-field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className="md-field-hint">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
```

`frontend/src/ui/TreeItem.tsx`:

```tsx
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';

export interface TreeItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  kind: 'folder' | 'file' | 'image';
  name: string;
  depth?: number;
  open?: boolean;
  active?: boolean;
  dirty?: boolean;
  dropTarget?: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
}

export function TreeItem({
  kind, name, depth = 0, open, active, dirty, dropTarget, trailing, onClick, onKeyDown, className, ...rest
}: TreeItemProps) {
  const isFolder = kind === 'folder';
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      event.preventDefault();
      onClick?.();
    }
    onKeyDown?.(event);
  };
  return (
    <div
      aria-label={name}
      {...rest}
      className={cx('md-tree-item', active && 'is-active', dirty && 'is-dirty', dropTarget && 'is-drop-target', className)}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={isFolder ? Boolean(open) : undefined}
      aria-selected={Boolean(active)}
      tabIndex={0}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <span className="md-tree-chev">
        {isFolder && <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} />}
      </span>
      <Icon name={isFolder ? (open ? 'folder-open' : 'folder') : kind === 'image' ? 'image' : 'file'} />
      <span className="md-tree-name">{name}</span>
      {dirty && <span className="md-tree-dirty" title="Changed since last saved version" />}
      {trailing && <span className="md-tree-trailing">{trailing}</span>}
    </div>
  );
}
```

`frontend/src/ui/SaveStatus.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type SaveStatusState = 'saved' | 'saving' | 'failed' | 'cloud';

const COPY: Record<SaveStatusState, { icon: IconName | null; text: string }> = {
  saved: { icon: 'check', text: 'Saved locally' },
  saving: { icon: null, text: 'Saving…' },
  failed: { icon: 'alert', text: 'Couldn’t save' },
  cloud: { icon: 'cloud', text: 'Version saved' },
};

export function SaveStatus({ state = 'saved', detail, children }: { state?: SaveStatusState; detail?: string; children?: ReactNode }) {
  const copy = COPY[state];
  return (
    <span className={cx('md-save', `md-save-${state}`)} role="status" aria-live="polite">
      {copy.icon ? <Icon name={copy.icon} size={14} /> : <span className="md-save-spin" aria-hidden="true" />}
      <span>{children ?? copy.text}</span>
      {detail && <span className="md-save-detail">· {detail}</span>}
    </span>
  );
}
```

`frontend/src/ui/EmptyState.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './icons';

export function EmptyState({ icon, title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="md-empty">
      {icon && (
        <span className="md-empty-icon">
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="md-empty-title">{title}</div>
      {children && <p className="md-empty-text">{children}</p>}
      {action}
    </div>
  );
}
```

`frontend/src/ui/Prose.tsx`:

```tsx
import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface ProseProps extends HTMLAttributes<HTMLElement> {
  /** Already-sanitized HTML from the renderer. */
  html?: string;
}

export function Prose({ html, className, children, ...rest }: ProseProps) {
  if (html !== undefined) {
    return <article {...rest} className={cx('md-prose', className)} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <article {...rest} className={cx('md-prose', className)}>
      {children}
    </article>
  );
}
```

`frontend/src/ui/Callout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

type Tone = 'info' | 'positive' | 'warning' | 'danger';
const ICON: Record<Tone, IconName> = { info: 'info', positive: 'check', warning: 'alert', danger: 'alert' };

export function Callout({ tone = 'info', title, children, actions }: { tone?: Tone; title?: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cx('md-callout', `md-callout-${tone}`)} role={tone === 'danger' ? 'alert' : 'note'}>
      <Icon name={ICON[tone]} size={18} />
      <div className="md-callout-body">
        {title && <div className="md-callout-title">{title}</div>}
        {children && <div className="md-callout-text">{children}</div>}
        {actions && <div className="md-callout-actions">{actions}</div>}
      </div>
    </div>
  );
}
```

`frontend/src/ui/Badge.tsx`:

```tsx
import type { ReactNode } from 'react';

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'positive' | 'warning' | 'danger'; children?: ReactNode }) {
  return <span className={`md-badge md-badge-${tone}`}>{children}</span>;
}
```

`frontend/src/ui/Dialog.tsx`:

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';
import { IconButton } from './IconButton';

export interface DialogProps {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  tone?: 'danger';
  inline?: boolean;
  open?: boolean;
}

const FIRST_FOCUS = 'input, textarea, select, .md-dialog-actions button';

export function Dialog({ title, children, actions, onClose, tone, inline, open = true }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || inline) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>(FIRST_FOCUS) ?? panelRef.current;
    first?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.();
    };
  }, [open, inline]);

  if (!open) return null;
  const panel = (
    <div
      ref={panelRef}
      className={cx('md-dialog', tone === 'danger' && 'is-danger')}
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div className="md-dialog-head">
        <h2 id={titleId} className="md-dialog-title">
          {title}
        </h2>
        {onClose && <IconButton icon="x" label="Close" onClick={onClose} />}
      </div>
      <div className="md-dialog-body">{children}</div>
      {actions && <div className="md-dialog-actions">{actions}</div>}
    </div>
  );
  if (inline) return panel;
  return (
    <div
      className="md-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.();
      }}
    >
      {panel}
    </div>
  );
}
```

`frontend/src/ui/index.ts`:

```ts
export { Badge } from './Badge';
export { Button, type ButtonProps } from './Button';
export { Callout } from './Callout';
export { cx } from './cx';
export { Dialog, type DialogProps } from './Dialog';
export { EmptyState } from './EmptyState';
export { Icon, type IconProps } from './Icon';
export { IconButton, type IconButtonProps } from './IconButton';
export { ICONS, type IconName } from './icons';
export { Input, type InputProps } from './Input';
export { Kbd } from './Kbd';
export { Menu, type MenuItem } from './Menu';
export { MenuButton, type MenuButtonProps } from './MenuButton';
export { Prose, type ProseProps } from './Prose';
export { SaveStatus, type SaveStatusState } from './SaveStatus';
export { SegmentedControl, type SegmentedControlProps, type SegmentedOption } from './SegmentedControl';
export { TreeItem, type TreeItemProps } from './TreeItem';
export { Wordmark } from './Wordmark';
```

- [ ] **Step 8: Run tests**

Run: `npm test -- src/ui`
Expected: 9 tests pass.

- [ ] **Step 9: Wire styles into the stub entry and verify**

Add `import './ui/styles';` as the first line of `frontend/src/main.tsx`. Run `npm run lint && npm run typecheck && npm run build` — expected clean; `dist/assets/` contains `.woff2` files.

- [ ] **Step 10: Update logs and commit**

Decision P-013 (design-system extensions to upstream) was recorded during planning; add to it any further deviation made while porting. Update `context.md`.

```bash
git add docs/design-system frontend context.md decisions.md
git commit -m "feat(ui): port md.IT design system tokens and components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Store foundation — types, errors, names, database, hierarchy helpers

**Files:**
- Create: `frontend/src/store/types.ts`, `errors.ts`, `names.ts`, `db.ts`, `hierarchy.ts`, `guards.ts`
- Test: `frontend/src/store/names.test.ts`, `frontend/src/store/hierarchy.test.ts`

**Interfaces:**
- Produces:
  - Types: `Project`, `Folder` (`parentFolderId: string | null`), `MdDocument` (`folderId: string | null`), `ImageAsset`, `Setting`; internal rows `FolderRow`, `DocumentRow` (root stored as `''`).
  - Errors: `StoreError` (base) and `NotFoundError`, `NameConflictError(name)`, `InvalidMoveError`, `ValidationError`; `userMessage(error: unknown): string`.
  - Names: `normalizeName(raw): string` (throws `ValidationError`), `withMdExtension(name)`, `stripMdExtension(name)`, `nameKey(name)`, `nextAvailableName(stem, ext, taken: readonly string[])`.
  - DB: `db` (Dexie instance, tables `projects, folders, documents, images, settings`), `ROOT = ''`, `toKey(id|null)`, `fromKey(key)`, `toFolder(row)`, `toDocument(row)`, `now()`, `clearDatabase()`.
  - Hierarchy (pure): `descendantFolderIds(folders, rootId): string[]`, `ancestorFolderIds(folders, folderId|null): string[]` (self first, then parents).
  - Guards (used inside transactions): `requireProject(id)`, `requireFolder(id)`, `requireFolderIn(projectId, id)`, `requireDocument(id)`, `touchProject(id, at?)`, `siblingNames(projectId, parentKey, excludeId?)`, `assertNameFree(name, taken)`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/store/names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';
import { nameKey, nextAvailableName, normalizeName, stripMdExtension, withMdExtension } from './names';

describe('names', () => {
  it('trims names', () => {
    expect(normalizeName('  Notes  ')).toBe('Notes');
  });

  it.each(['', '   ', 'a/b', 'a\\b', '.', '..', 'x'.repeat(201)])('rejects %j', (raw) => {
    expect(() => normalizeName(raw)).toThrow(ValidationError);
  });

  it('explains an empty name in plain words', () => {
    expect(() => normalizeName(' ')).toThrow('Name can’t be empty.');
  });

  it('adds .md once, case-insensitively', () => {
    expect(withMdExtension('Threads')).toBe('Threads.md');
    expect(withMdExtension('Threads.md')).toBe('Threads.md');
    expect(withMdExtension('README.MD')).toBe('README.MD');
    expect(stripMdExtension('Threads.md')).toBe('Threads');
    expect(stripMdExtension('Threads')).toBe('Threads');
  });

  it('compares names case-insensitively', () => {
    expect(nameKey('Notes.MD')).toBe(nameKey('notes.md'));
  });

  it('picks the first free numbered name', () => {
    expect(nextAvailableName('Untitled', '.md', [])).toBe('Untitled.md');
    expect(nextAvailableName('Untitled', '.md', ['untitled.md'])).toBe('Untitled 2.md');
    expect(nextAvailableName('Untitled', '.md', ['Untitled.md', 'Untitled 2.md'])).toBe('Untitled 3.md');
    expect(nextAvailableName('New folder', '', ['New folder'])).toBe('New folder 2');
  });
});
```

`frontend/src/store/hierarchy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ancestorFolderIds, descendantFolderIds } from './hierarchy';

const folders = [
  { id: 'a', parentFolderId: null },
  { id: 'b', parentFolderId: 'a' },
  { id: 'c', parentFolderId: 'b' },
  { id: 'd', parentFolderId: null },
];

describe('hierarchy', () => {
  it('lists every descendant of a folder', () => {
    expect(descendantFolderIds(folders, 'a').sort()).toEqual(['b', 'c']);
    expect(descendantFolderIds(folders, 'c')).toEqual([]);
  });

  it('lists a folder and its ancestors, nearest first', () => {
    expect(ancestorFolderIds(folders, 'c')).toEqual(['c', 'b', 'a']);
    expect(ancestorFolderIds(folders, null)).toEqual([]);
  });

  it('stops on a corrupted cycle instead of looping forever', () => {
    const cyclic = [
      { id: 'x', parentFolderId: 'y' },
      { id: 'y', parentFolderId: 'x' },
    ];
    expect(ancestorFolderIds(cyclic, 'x')).toEqual(['x', 'y']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/store`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`frontend/src/store/types.ts`:

```ts
export interface Project {
  id: string;
  name: string;
  description: string;
  cloudProjectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  projectId: string;
  parentFolderId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Named MdDocument to avoid clashing with the DOM's global Document type. */
export interface MdDocument {
  id: string;
  projectId: string;
  folderId: string | null;
  /** File name including the .md extension. */
  title: string;
  content: string;
  cloudDocumentId?: string;
  headVersionId?: string;
  /** Changed since the last cloud version. Always true until Phase 5 adds versions. */
  dirty: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ImageAsset {
  id: string;
  projectId: string;
  path: string;
  contentType: string;
  bytes: Blob;
  sha256: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface ProjectSummary extends Project {
  documentCount: number;
}
```

`frontend/src/store/errors.ts`:

```ts
/** Base class; every message is written for the person using md.IT. */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends StoreError {}

export class NameConflictError extends StoreError {
  readonly conflictingName: string;
  constructor(name: string) {
    super(`“${name}” already exists here.`);
    this.conflictingName = name;
  }
}

export class InvalidMoveError extends StoreError {}

export class ValidationError extends StoreError {}

export function userMessage(error: unknown): string {
  if (error instanceof StoreError) return error.message;
  console.error(error);
  return 'Something went wrong. Try again.';
}
```

`frontend/src/store/names.ts`:

```ts
import { ValidationError } from './errors';

const MAX_NAME_LENGTH = 200;

export function normalizeName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new ValidationError('Name can’t be empty.');
  if (name.includes('/') || name.includes('\\')) throw new ValidationError('Names can’t contain / or \\.');
  if (name === '.' || name === '..') throw new ValidationError('Choose a name other than . or ..');
  if (name.length > MAX_NAME_LENGTH) throw new ValidationError(`Names can be at most ${MAX_NAME_LENGTH} characters.`);
  return name;
}

export function withMdExtension(name: string): string {
  return /\.md$/i.test(name) ? name : `${name}.md`;
}

export function stripMdExtension(name: string): string {
  return name.replace(/\.md$/i, '');
}

export function nameKey(name: string): string {
  return name.toLocaleLowerCase();
}

/** "Untitled.md", then "Untitled 2.md", "Untitled 3.md", … — the first not in `taken`. */
export function nextAvailableName(stem: string, ext: string, taken: readonly string[]): string {
  const used = new Set(taken.map(nameKey));
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${stem}${ext}` : `${stem} ${n}${ext}`;
    if (!used.has(nameKey(candidate))) return candidate;
  }
}
```

`frontend/src/store/db.ts`:

```ts
import Dexie, { type EntityTable } from 'dexie';
import type { Folder, ImageAsset, MdDocument, Project, Setting } from './types';

/** IndexedDB cannot index null, so "at the project root" is stored as ''. */
export const ROOT = '';

export interface FolderRow extends Omit<Folder, 'parentFolderId'> {
  parentFolderId: string;
}

export interface DocumentRow extends Omit<MdDocument, 'folderId'> {
  folderId: string;
}

class MdItDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  folders!: EntityTable<FolderRow, 'id'>;
  documents!: EntityTable<DocumentRow, 'id'>;
  images!: EntityTable<ImageAsset, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('mdit');
    this.version(1).stores({
      projects: 'id, updatedAt',
      folders: 'id, projectId, [projectId+parentFolderId]',
      documents: 'id, projectId, [projectId+folderId]',
      images: 'id, projectId, [projectId+path]',
      settings: 'key',
    });
  }
}

export const db = new MdItDatabase();

export const now = (): number => Date.now();
export const toKey = (id: string | null): string => id ?? ROOT;
export const fromKey = (key: string): string | null => (key === ROOT ? null : key);
export const toFolder = (row: FolderRow): Folder => ({ ...row, parentFolderId: fromKey(row.parentFolderId) });
export const toDocument = (row: DocumentRow): MdDocument => ({ ...row, folderId: fromKey(row.folderId) });

/** Test helper: empty every table. */
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
```

`frontend/src/store/hierarchy.ts`:

```ts
type FolderLink = { id: string; parentFolderId: string | null };

export function descendantFolderIds(folders: readonly FolderLink[], rootId: string): string[] {
  const children = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentFolderId === null) continue;
    const list = children.get(folder.parentFolderId) ?? [];
    list.push(folder.id);
    children.set(folder.parentFolderId, list);
  }
  const result: string[] = [];
  const stack = [...(children.get(rootId) ?? [])];
  const seen = new Set<string>([rootId]);
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    stack.push(...(children.get(id) ?? []));
  }
  return result;
}

export function ancestorFolderIds(folders: readonly FolderLink[], folderId: string | null): string[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const result: string[] = [];
  const seen = new Set<string>();
  let current = folderId;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    result.push(current);
    current = byId.get(current)?.parentFolderId ?? null;
  }
  return result;
}
```

`frontend/src/store/guards.ts`:

```ts
import { db, now, type DocumentRow, type FolderRow } from './db';
import { InvalidMoveError, NameConflictError, NotFoundError } from './errors';
import { nameKey } from './names';
import type { Project } from './types';

export async function requireProject(id: string): Promise<Project> {
  const project = await db.projects.get(id);
  if (!project) throw new NotFoundError('This project isn’t in this browser.');
  return project;
}

export async function requireFolder(id: string): Promise<FolderRow> {
  const folder = await db.folders.get(id);
  if (!folder) throw new NotFoundError('This folder no longer exists.');
  return folder;
}

export async function requireFolderIn(projectId: string, id: string): Promise<FolderRow> {
  const folder = await requireFolder(id);
  if (folder.projectId !== projectId) throw new InvalidMoveError('That folder belongs to another project.');
  return folder;
}

export async function requireDocument(id: string): Promise<DocumentRow> {
  const document = await db.documents.get(id);
  if (!document) throw new NotFoundError('This document no longer exists.');
  return document;
}

export async function touchProject(projectId: string, at: number = now()): Promise<void> {
  await db.projects.update(projectId, { updatedAt: at });
}

/** Names of every folder and document directly under `parentKey`, optionally excluding one item. */
export async function siblingNames(projectId: string, parentKey: string, excludeId?: string): Promise<string[]> {
  const [folders, documents] = await Promise.all([
    db.folders.where('[projectId+parentFolderId]').equals([projectId, parentKey]).toArray(),
    db.documents.where('[projectId+folderId]').equals([projectId, parentKey]).toArray(),
  ]);
  return [
    ...folders.filter((f) => f.id !== excludeId).map((f) => f.name),
    ...documents.filter((d) => d.id !== excludeId).map((d) => d.title),
  ];
}

export function assertNameFree(name: string, taken: readonly string[]): void {
  const key = nameKey(name);
  if (taken.some((existing) => nameKey(existing) === key)) throw new NameConflictError(name);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/store && npm run lint && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Update logs and commit**

```bash
git add frontend/src/store context.md
git commit -m "feat(store): add IndexedDB schema, typed errors and naming rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Store — projects and folders

**Files:**
- Create: `frontend/src/store/projects.ts`, `frontend/src/store/folders.ts`
- Test: `frontend/src/store/projects.test.ts`, `frontend/src/store/folders.test.ts`

**Interfaces:**
- Consumes: Task 3 (`db`, guards, names, errors, hierarchy).
- Produces:
  - `listProjectSummaries(): Promise<ProjectSummary[]>` (newest `updatedAt` first), `getProject(id): Promise<Project | null>`, `createProject(name): Promise<Project>`, `renameProject(id, name): Promise<Project>`, `setProjectDescription(id, text): Promise<Project>`, `deleteProject(id): Promise<void>` (cascades folders, documents, images).
  - `listFolders(projectId): Promise<Folder[]>`, `createFolder(projectId, parentFolderId: string | null, name?): Promise<Folder>`, `renameFolder(id, name): Promise<Folder>`, `moveFolder(id, newParentId: string | null): Promise<Folder>`, `deleteFolder(id): Promise<void>` (cascades descendant folders and their documents).

- [ ] **Step 1: Write the failing tests**

`frontend/src/store/projects.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase } from './db';
import { NotFoundError, ValidationError } from './errors';
import { createProject, deleteProject, getProject, listProjectSummaries, renameProject, setProjectDescription } from './projects';

beforeEach(clearDatabase);

describe('projects', () => {
  it('creates a project with a trimmed name and empty description', async () => {
    const project = await createProject('  Operating Systems Notes ');
    expect(project).toMatchObject({ name: 'Operating Systems Notes', description: '' });
    expect(await getProject(project.id)).toEqual(project);
  });

  it('rejects an empty name', async () => {
    await expect(createProject('   ')).rejects.toBeInstanceOf(ValidationError);
  });

  it('returns null for a project that is not stored', async () => {
    expect(await getProject('missing')).toBeNull();
  });

  it('renames, describes, and bumps updatedAt', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const project = await createProject('OS');
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const renamed = await renameProject(project.id, 'Operating systems');
    expect(renamed).toMatchObject({ name: 'Operating systems', updatedAt: 2000 });
    const described = await setProjectDescription(project.id, '  Lecture notes  ');
    expect(described.description).toBe('Lecture notes');
    vi.restoreAllMocks();
  });

  it('lists projects newest first with document counts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const older = await createProject('Older');
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const newer = await createProject('Newer');
    vi.restoreAllMocks();
    const summaries = await listProjectSummaries();
    expect(summaries.map((p) => p.id)).toEqual([newer.id, older.id]);
    expect(summaries[0]?.documentCount).toBe(0);
  });

  it('throws NotFoundError when renaming or deleting a missing project', async () => {
    await expect(renameProject('missing', 'x')).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteProject('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
```

`frontend/src/store/folders.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { InvalidMoveError, NameConflictError } from './errors';
import { createFolder, deleteFolder, listFolders, moveFolder, renameFolder } from './folders';
import { createProject } from './projects';

beforeEach(clearDatabase);

async function setup() {
  const project = await createProject('OS');
  return project.id;
}

describe('folders', () => {
  it('creates root and nested folders, exposing root as null', async () => {
    const pid = await setup();
    const root = await createFolder(pid, null, 'Scheduling');
    const nested = await createFolder(pid, root.id, 'Old');
    expect(root.parentFolderId).toBeNull();
    expect(nested.parentFolderId).toBe(root.id);
    expect((await listFolders(pid)).map((f) => f.name).sort()).toEqual(['Old', 'Scheduling']);
  });

  it('names new folders "New folder", "New folder 2", …', async () => {
    const pid = await setup();
    expect((await createFolder(pid, null)).name).toBe('New folder');
    expect((await createFolder(pid, null)).name).toBe('New folder 2');
  });

  it('rejects a sibling with the same name, ignoring case', async () => {
    const pid = await setup();
    await createFolder(pid, null, 'Notes');
    await expect(createFolder(pid, null, 'notes')).rejects.toBeInstanceOf(NameConflictError);
  });

  it('allows the same name under different parents', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    await expect(createFolder(pid, a.id, 'A')).resolves.toBeDefined();
  });

  it('renames, keeping the name free check but allowing a case-only change of itself', async () => {
    const pid = await setup();
    const folder = await createFolder(pid, null, 'notes');
    expect((await renameFolder(folder.id, 'Notes')).name).toBe('Notes');
  });

  it('refuses to move a folder into itself or its descendants', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    await expect(moveFolder(a.id, a.id)).rejects.toBeInstanceOf(InvalidMoveError);
    await expect(moveFolder(a.id, b.id)).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it('moves a folder to the root and to another folder', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    expect((await moveFolder(b.id, null)).parentFolderId).toBeNull();
    const c = await createFolder(pid, null, 'C');
    expect((await moveFolder(b.id, c.id)).parentFolderId).toBe(c.id);
  });

  it('refuses to move into a folder from another project', async () => {
    const pid = await setup();
    const other = await createProject('Other');
    const a = await createFolder(pid, null, 'A');
    const foreign = await createFolder(other.id, null, 'F');
    await expect(moveFolder(a.id, foreign.id)).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it('deletes a folder with all nested folders', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    await createFolder(pid, b.id, 'C');
    await createFolder(pid, null, 'Keep');
    await deleteFolder(a.id);
    expect((await listFolders(pid)).map((f) => f.name)).toEqual(['Keep']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/store/projects.test.ts src/store/folders.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`frontend/src/store/projects.ts`:

```ts
import { db, now } from './db';
import { requireProject } from './guards';
import { normalizeName } from './names';
import type { Project, ProjectSummary } from './types';

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      documentCount: await db.documents.where('projectId').equals(project.id).count(),
    })),
  );
}

export async function getProject(id: string): Promise<Project | null> {
  return (await db.projects.get(id)) ?? null;
}

export async function createProject(name: string): Promise<Project> {
  const at = now();
  const project: Project = { id: crypto.randomUUID(), name: normalizeName(name), description: '', createdAt: at, updatedAt: at };
  await db.projects.add(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<Project> {
  const clean = normalizeName(name);
  return db.transaction('rw', db.projects, async () => {
    const project = await requireProject(id);
    const updated = { ...project, name: clean, updatedAt: now() };
    await db.projects.put(updated);
    return updated;
  });
}

export async function setProjectDescription(id: string, text: string): Promise<Project> {
  return db.transaction('rw', db.projects, async () => {
    const project = await requireProject(id);
    const updated = { ...project, description: text.trim(), updatedAt: now() };
    await db.projects.put(updated);
    return updated;
  });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.folders, db.documents, db.images], async () => {
    await requireProject(id);
    await db.documents.where('projectId').equals(id).delete();
    await db.folders.where('projectId').equals(id).delete();
    await db.images.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}
```

`frontend/src/store/folders.ts`:

```ts
import { db, now, toFolder, toKey, type FolderRow } from './db';
import { InvalidMoveError } from './errors';
import { assertNameFree, requireFolder, requireFolderIn, requireProject, siblingNames, touchProject } from './guards';
import { descendantFolderIds } from './hierarchy';
import { nextAvailableName, normalizeName } from './names';
import type { Folder } from './types';

const tables = () => [db.projects, db.folders, db.documents];

export async function listFolders(projectId: string): Promise<Folder[]> {
  const rows = await db.folders.where('projectId').equals(projectId).toArray();
  return rows.map(toFolder);
}

export async function createFolder(projectId: string, parentFolderId: string | null, name?: string): Promise<Folder> {
  const requested = name === undefined ? undefined : normalizeName(name);
  return db.transaction('rw', tables(), async () => {
    await requireProject(projectId);
    if (parentFolderId !== null) await requireFolderIn(projectId, parentFolderId);
    const parentKey = toKey(parentFolderId);
    const taken = await siblingNames(projectId, parentKey);
    const finalName = requested ?? nextAvailableName('New folder', '', taken);
    assertNameFree(finalName, taken);
    const at = now();
    const row: FolderRow = { id: crypto.randomUUID(), projectId, parentFolderId: parentKey, name: finalName, createdAt: at, updatedAt: at };
    await db.folders.add(row);
    await touchProject(projectId, at);
    return toFolder(row);
  });
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const clean = normalizeName(name);
  return db.transaction('rw', tables(), async () => {
    const folder = await requireFolder(id);
    assertNameFree(clean, await siblingNames(folder.projectId, folder.parentFolderId, id));
    const updated: FolderRow = { ...folder, name: clean, updatedAt: now() };
    await db.folders.put(updated);
    await touchProject(folder.projectId, updated.updatedAt);
    return toFolder(updated);
  });
}

export async function moveFolder(id: string, newParentId: string | null): Promise<Folder> {
  return db.transaction('rw', tables(), async () => {
    const folder = await requireFolder(id);
    if (newParentId !== null) {
      await requireFolderIn(folder.projectId, newParentId);
      const all = await listFolders(folder.projectId);
      if (newParentId === id || descendantFolderIds(all, id).includes(newParentId)) {
        throw new InvalidMoveError('A folder can’t be moved into itself.');
      }
    }
    const parentKey = toKey(newParentId);
    assertNameFree(folder.name, await siblingNames(folder.projectId, parentKey, id));
    const updated: FolderRow = { ...folder, parentFolderId: parentKey, updatedAt: now() };
    await db.folders.put(updated);
    await touchProject(folder.projectId, updated.updatedAt);
    return toFolder(updated);
  });
}

export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const folder = await requireFolder(id);
    const all = await listFolders(folder.projectId);
    const ids = [id, ...descendantFolderIds(all, id)];
    await db.documents
      .where('[projectId+folderId]')
      .anyOf(ids.map((folderId) => [folder.projectId, folderId]))
      .delete();
    await db.folders.bulkDelete(ids);
    await touchProject(folder.projectId);
  });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/store && npm run lint && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Update logs and commit**

```bash
git add frontend/src/store context.md
git commit -m "feat(store): projects and folders with cascades and move checks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Store — documents, settings, cascades, React hooks, public API

**Files:**
- Create: `frontend/src/store/documents.ts`, `settings.ts`, `hooks.ts`, `index.ts`
- Test: `frontend/src/store/documents.test.ts`, `settings.test.ts`, `cascade.test.ts`, `hooks.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–4.
- Produces:
  - `listDocuments(projectId): Promise<MdDocument[]>`, `getDocument(id): Promise<MdDocument | null>`, `createDocument(projectId, folderId: string | null, title?): Promise<MdDocument>`, `renameDocument(id, title): Promise<MdDocument>`, `duplicateDocument(id): Promise<MdDocument>`, `moveDocument(id, folderId: string | null): Promise<MdDocument>`, `deleteDocument(id): Promise<void>`, `saveDocumentContent(id, content): Promise<void>` (throws `NotFoundError` if gone).
  - `SETTINGS = { mode: 'ui.mode', theme: 'ui.theme', storageWarningDismissed: 'ui.storageWarningDismissed' }`, `getSetting<T>(key, fallback): Promise<T>`, `setSetting<T>(key, value): Promise<void>`.
  - Hooks: `useProjectSummaries(): ProjectSummary[] | undefined`, `useProject(id): Project | null | undefined` (undefined = loading, null = not stored), `useFolders(projectId): Folder[] | undefined`, `useDocuments(projectId): MdDocument[] | undefined`, `useSetting<T>(key, fallback): T | undefined`, `useSettingState<T>(key, fallback): [T, (value: T) => void]`.
  - `src/store/index.ts` re-exports everything public above plus types, errors, `userMessage`, `descendantFolderIds`, `ancestorFolderIds`, `clearDatabase`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/store/documents.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import {
  createDocument, deleteDocument, duplicateDocument, getDocument, listDocuments, moveDocument, renameDocument, saveDocumentContent,
} from './documents';
import { InvalidMoveError, NameConflictError, NotFoundError } from './errors';
import { createFolder } from './folders';
import { createProject } from './projects';

beforeEach(clearDatabase);

async function setup() {
  return (await createProject('OS')).id;
}

describe('documents', () => {
  it('creates "Untitled.md", then "Untitled 2.md"', async () => {
    const pid = await setup();
    expect((await createDocument(pid, null)).title).toBe('Untitled.md');
    expect((await createDocument(pid, null)).title).toBe('Untitled 2.md');
  });

  it('adds .md to a given title and starts empty', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null, 'Processes');
    expect(doc).toMatchObject({ title: 'Processes.md', content: '', folderId: null, dirty: true });
  });

  it('rejects names that differ only by case or spaces', async () => {
    const pid = await setup();
    await createDocument(pid, null, 'Notes');
    await expect(createDocument(pid, null, '  notes.md ')).rejects.toBeInstanceOf(NameConflictError);
  });

  it('shares the namespace with folders', async () => {
    const pid = await setup();
    await createFolder(pid, null, 'Notes.md');
    await expect(createDocument(pid, null, 'Notes')).rejects.toBeInstanceOf(NameConflictError);
  });

  it('renames, keeping the .md extension', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null, 'A');
    expect((await renameDocument(doc.id, 'Threads')).title).toBe('Threads.md');
  });

  it('duplicates as "X copy.md" with the same content', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null, 'Threads');
    await saveDocumentContent(doc.id, '# Threads');
    const copy = await duplicateDocument(doc.id);
    expect(copy).toMatchObject({ title: 'Threads copy.md', content: '# Threads', folderId: null });
    expect((await duplicateDocument(doc.id)).title).toBe('Threads copy 2.md');
  });

  it('saves content and marks the document dirty', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null);
    await saveDocumentContent(doc.id, 'hello');
    expect(await getDocument(doc.id)).toMatchObject({ content: 'hello', dirty: true });
  });

  it('refuses to save a document that was deleted', async () => {
    const pid = await setup();
    const doc = await createDocument(pid, null);
    await deleteDocument(doc.id);
    await expect(saveDocumentContent(doc.id, 'late')).rejects.toBeInstanceOf(NotFoundError);
    expect(await getDocument(doc.id)).toBeNull();
  });

  it('moves between root and folders', async () => {
    const pid = await setup();
    const folder = await createFolder(pid, null, 'Scheduling');
    const doc = await createDocument(pid, null, 'RR');
    expect((await moveDocument(doc.id, folder.id)).folderId).toBe(folder.id);
    expect((await moveDocument(doc.id, null)).folderId).toBeNull();
  });

  it('rejects a move into a folder with a same-named item', async () => {
    const pid = await setup();
    const folder = await createFolder(pid, null, 'Scheduling');
    await createDocument(pid, folder.id, 'RR');
    const doc = await createDocument(pid, null, 'rr');
    await expect(moveDocument(doc.id, folder.id)).rejects.toBeInstanceOf(NameConflictError);
    expect((await getDocument(doc.id))?.folderId).toBeNull();
  });

  it('refuses to create in a folder of another project', async () => {
    const pid = await setup();
    const other = await createProject('Other');
    const foreign = await createFolder(other.id, null, 'F');
    await expect(createDocument(pid, foreign.id)).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it('lists only the project’s documents', async () => {
    const pid = await setup();
    const other = await createProject('Other');
    await createDocument(pid, null, 'Mine');
    await createDocument(other.id, null, 'Theirs');
    expect((await listDocuments(pid)).map((d) => d.title)).toEqual(['Mine.md']);
  });
});
```

`frontend/src/store/cascade.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { createDocument, listDocuments } from './documents';
import { createFolder, deleteFolder, listFolders } from './folders';
import { createProject, deleteProject, getProject, listProjectSummaries } from './projects';

beforeEach(clearDatabase);

describe('cascading deletes', () => {
  it('deleting a folder removes documents at every depth and leaves the rest', async () => {
    const pid = (await createProject('OS')).id;
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    await createDocument(pid, a.id, 'one');
    await createDocument(pid, b.id, 'two');
    await createDocument(pid, null, 'keep');
    await deleteFolder(a.id);
    expect((await listDocuments(pid)).map((d) => d.title)).toEqual(['keep.md']);
  });

  it('deleting a project removes its folders and documents only', async () => {
    const pid = (await createProject('OS')).id;
    const other = (await createProject('Other')).id;
    const folder = await createFolder(pid, null, 'A');
    await createDocument(pid, folder.id, 'one');
    await createDocument(other, null, 'keep');
    await deleteProject(pid);
    expect(await getProject(pid)).toBeNull();
    expect(await listFolders(pid)).toEqual([]);
    expect(await listDocuments(pid)).toEqual([]);
    expect(await listDocuments(other)).toHaveLength(1);
  });

  it('counts documents in project summaries', async () => {
    const pid = (await createProject('OS')).id;
    await createDocument(pid, null);
    await createDocument(pid, null);
    expect((await listProjectSummaries())[0]?.documentCount).toBe(2);
  });
});
```

`frontend/src/store/settings.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { getSetting, setSetting, SETTINGS } from './settings';

beforeEach(clearDatabase);

describe('settings', () => {
  it('returns the fallback until a value is stored', async () => {
    expect(await getSetting(SETTINGS.mode, 'split')).toBe('split');
    await setSetting(SETTINGS.mode, 'preview');
    expect(await getSetting(SETTINGS.mode, 'split')).toBe('preview');
  });

  it('stores falsy values faithfully', async () => {
    await setSetting(SETTINGS.storageWarningDismissed, false);
    expect(await getSetting(SETTINGS.storageWarningDismissed, true)).toBe(false);
  });
});
```

`frontend/src/store/hooks.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { useProject, useSettingState } from './hooks';
import { createProject, renameProject } from './projects';

beforeEach(clearDatabase);

describe('store hooks', () => {
  it('useProject is undefined while loading, null when missing, and live after changes', async () => {
    const { result: missing } = renderHook(() => useProject('nope'));
    await waitFor(() => expect(missing.current).toBeNull());

    const project = await createProject('OS');
    const { result } = renderHook(() => useProject(project.id));
    await waitFor(() => expect(result.current?.name).toBe('OS'));
    await act(async () => {
      await renameProject(project.id, 'Operating systems');
    });
    await waitFor(() => expect(result.current?.name).toBe('Operating systems'));
  });

  it('useSettingState returns the fallback, then the stored value', async () => {
    const { result } = renderHook(() => useSettingState('ui.mode', 'split'));
    expect(result.current[0]).toBe('split');
    act(() => result.current[1]('editor'));
    await waitFor(() => expect(result.current[0]).toBe('editor'));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/store`
Expected: FAIL — `./documents`, `./settings`, `./hooks` not found.

- [ ] **Step 3: Implement**

`frontend/src/store/documents.ts`:

```ts
import { db, now, toDocument, toKey, type DocumentRow } from './db';
import { assertNameFree, requireDocument, requireFolderIn, requireProject, siblingNames, touchProject } from './guards';
import { nextAvailableName, normalizeName, stripMdExtension, withMdExtension } from './names';
import type { MdDocument } from './types';

const tables = () => [db.projects, db.folders, db.documents];

export async function listDocuments(projectId: string): Promise<MdDocument[]> {
  const rows = await db.documents.where('projectId').equals(projectId).toArray();
  return rows.map(toDocument);
}

export async function getDocument(id: string): Promise<MdDocument | null> {
  const row = await db.documents.get(id);
  return row ? toDocument(row) : null;
}

export async function createDocument(projectId: string, folderId: string | null, title?: string): Promise<MdDocument> {
  const requested = title === undefined ? undefined : withMdExtension(normalizeName(title));
  return db.transaction('rw', tables(), async () => {
    await requireProject(projectId);
    if (folderId !== null) await requireFolderIn(projectId, folderId);
    const parentKey = toKey(folderId);
    const taken = await siblingNames(projectId, parentKey);
    const finalTitle = requested ?? nextAvailableName('Untitled', '.md', taken);
    assertNameFree(finalTitle, taken);
    const at = now();
    const row: DocumentRow = {
      id: crypto.randomUUID(), projectId, folderId: parentKey, title: finalTitle, content: '', dirty: true, createdAt: at, updatedAt: at,
    };
    await db.documents.add(row);
    await touchProject(projectId, at);
    return toDocument(row);
  });
}

export async function renameDocument(id: string, title: string): Promise<MdDocument> {
  const clean = withMdExtension(normalizeName(title));
  return db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    assertNameFree(clean, await siblingNames(doc.projectId, doc.folderId, id));
    const updated: DocumentRow = { ...doc, title: clean, updatedAt: now() };
    await db.documents.put(updated);
    await touchProject(doc.projectId, updated.updatedAt);
    return toDocument(updated);
  });
}

export async function duplicateDocument(id: string): Promise<MdDocument> {
  return db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    const taken = await siblingNames(doc.projectId, doc.folderId);
    const at = now();
    const row: DocumentRow = {
      id: crypto.randomUUID(),
      projectId: doc.projectId,
      folderId: doc.folderId,
      title: nextAvailableName(`${stripMdExtension(doc.title)} copy`, '.md', taken),
      content: doc.content,
      dirty: true,
      createdAt: at,
      updatedAt: at,
    };
    await db.documents.add(row);
    await touchProject(doc.projectId, at);
    return toDocument(row);
  });
}

export async function moveDocument(id: string, folderId: string | null): Promise<MdDocument> {
  return db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    if (folderId !== null) await requireFolderIn(doc.projectId, folderId);
    const parentKey = toKey(folderId);
    assertNameFree(doc.title, await siblingNames(doc.projectId, parentKey, id));
    const updated: DocumentRow = { ...doc, folderId: parentKey, updatedAt: now() };
    await db.documents.put(updated);
    await touchProject(doc.projectId, updated.updatedAt);
    return toDocument(updated);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    await db.documents.delete(id);
    await touchProject(doc.projectId);
  });
}

export async function saveDocumentContent(id: string, content: string): Promise<void> {
  await db.transaction('rw', db.projects, db.documents, async () => {
    const doc = await requireDocument(id);
    const at = now();
    await db.documents.update(id, { content, dirty: true, updatedAt: at });
    await touchProject(doc.projectId, at);
  });
}
```

`frontend/src/store/settings.ts`:

```ts
import { db } from './db';

export const SETTINGS = {
  mode: 'ui.mode',
  theme: 'ui.theme',
  storageWarningDismissed: 'ui.storageWarningDismissed',
} as const;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
```

`frontend/src/store/hooks.ts`:

```ts
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { listDocuments } from './documents';
import { listFolders } from './folders';
import { getProject, listProjectSummaries } from './projects';
import { getSetting, setSetting } from './settings';

export function useProjectSummaries() {
  return useLiveQuery(() => listProjectSummaries(), []);
}

/** undefined while loading; null when the project is not stored in this browser. */
export function useProject(id: string | undefined) {
  return useLiveQuery(async () => (id ? getProject(id) : null), [id]);
}

export function useFolders(projectId: string) {
  return useLiveQuery(() => listFolders(projectId), [projectId]);
}

export function useDocuments(projectId: string) {
  return useLiveQuery(() => listDocuments(projectId), [projectId]);
}

/** Pass primitive fallbacks only; the fallback is not a dependency of the query. */
export function useSetting<T>(key: string, fallback: T): T | undefined {
  return useLiveQuery(() => getSetting(key, fallback), [key]);
}

export function useSettingState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSetting(key, fallback);
  const set = useCallback((next: T) => {
    void setSetting(key, next);
  }, [key]);
  return [value ?? fallback, set];
}
```

`frontend/src/store/index.ts`:

```ts
export { clearDatabase } from './db';
export {
  createDocument, deleteDocument, duplicateDocument, getDocument, listDocuments, moveDocument, renameDocument, saveDocumentContent,
} from './documents';
export { InvalidMoveError, NameConflictError, NotFoundError, StoreError, ValidationError, userMessage } from './errors';
export { createFolder, deleteFolder, listFolders, moveFolder, renameFolder } from './folders';
export { ancestorFolderIds, descendantFolderIds } from './hierarchy';
export { useDocuments, useFolders, useProject, useProjectSummaries, useSetting, useSettingState } from './hooks';
export { createProject, deleteProject, getProject, listProjectSummaries, renameProject, setProjectDescription } from './projects';
export { getSetting, setSetting, SETTINGS } from './settings';
export type { Folder, MdDocument, Project, ProjectSummary } from './types';
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/store && npm run lint && npm run typecheck`
Expected: all store tests pass.

- [ ] **Step 5: Update logs and commit**

```bash
git add frontend/src/store context.md
git commit -m "feat(store): documents, settings, live-query hooks and public API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Renderer

**Files:**
- Create: `frontend/src/renderer/render.ts`, `frontend/src/renderer/markdown-it-task-lists.d.ts`, `frontend/src/renderer/index.ts`
- Test: `frontend/src/renderer/render.test.ts`

**Interfaces:**
- Produces: `render(markdown: string): string` — sanitized HTML; never throws (errors become `<div class="md-render-error">…</div>`).

- [ ] **Step 1: Write the failing test** — `frontend/src/renderer/render.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { render } from './render';

describe('render', () => {
  it('renders GFM headings, tables, strikethrough', () => {
    expect(render('# Title')).toContain('<h1>Title</h1>');
    const table = render('| a | b |\n|---|---|\n| 1 | 2 |');
    expect(table).toContain('<table>');
    expect(table).toContain('<td>1</td>');
    expect(render('~~gone~~')).toContain('<s>gone</s>');
  });

  it('renders task lists as disabled checkboxes', () => {
    const html = render('- [x] done\n- [ ] todo');
    expect(html).toMatch(/<input[^>]*type="checkbox"/);
    expect(html).toMatch(/checked/);
    expect(html).toMatch(/disabled/);
  });

  it('opens external links in a new tab safely, but not relative links', () => {
    const external = render('https://example.com');
    expect(external).toContain('href="https://example.com"');
    expect(external).toContain('target="_blank"');
    expect(external).toContain('rel="noopener noreferrer"');
    expect(render('[next](Threads.md)')).not.toContain('target=');
  });

  it.each([
    ['<script>alert(1)</script>', /<script/i],
    ['<img src="x" onerror="alert(1)">', /onerror/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript:/i],
    ['[x](javascript:alert(1))', /javascript:/i],
    ['<iframe src="https://evil.example"></iframe>', /<iframe/i],
    ['<div style="background:url(javascript:alert(1))">x</div>', /javascript:/i],
  ])('strips dangerous markup: %s', (source, forbidden) => {
    expect(render(source)).not.toMatch(forbidden);
  });

  it('keeps harmless inline HTML', () => {
    expect(render('H<sub>2</sub>O')).toContain('<sub>2</sub>');
  });

  it('turns a failure into a visible error block instead of throwing', () => {
    const html = render(null as unknown as string);
    expect(html).toContain('class="md-render-error"');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/renderer`
Expected: FAIL — `./render` not found.

- [ ] **Step 3: Implement**

`frontend/src/renderer/markdown-it-task-lists.d.ts`:

```ts
declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it';
  const taskLists: PluginWithOptions<{ enabled?: boolean; label?: boolean; labelAfter?: boolean }>;
  export default taskLists;
}
```

`frontend/src/renderer/render.ts`:

```ts
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(taskLists, { enabled: false });

const renderLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!;
  if (/^https?:\/\//i.test(token.attrGet('href') ?? '')) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return renderLinkOpen(tokens, idx, options, env, self);
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Markdown → sanitized HTML. Pure apart from DOMPurify; never throws. */
export function render(markdown: string): string {
  try {
    return DOMPurify.sanitize(md.render(markdown), { ADD_ATTR: ['target'] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="md-render-error">Couldn’t render this document: ${escapeHtml(message)}</div>`;
  }
}
```

`frontend/src/renderer/index.ts`:

```ts
export { render } from './render';
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/renderer && npm run lint && npm run typecheck`
Expected: all pass. If the inline-style case fails because DOMPurify keeps `style` with `javascript:`, add `FORBID_ATTR: ['style']` to the sanitize options and record the decision in `decisions.md` under the next free P-number (inline `style` stripped from documents).

- [ ] **Step 5: Update logs and commit**

```bash
git add frontend/src/renderer context.md decisions.md
git commit -m "feat(renderer): markdown-it GFM rendering sanitized with DOMPurify

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Shared dialogs

**Files:**
- Create: `frontend/src/dialogs/ConfirmDialog.tsx`, `frontend/src/dialogs/TextFieldDialog.tsx`, `frontend/src/dialogs/index.ts`
- Test: `frontend/src/dialogs/dialogs.test.tsx`

**Interfaces:**
- Consumes: `ui` (`Dialog`, `Button`, `Input`), `store.userMessage`.
- Produces:
  - `ConfirmDialog({ title, message, confirmLabel, onConfirm: () => Promise<void>, onClose })` — danger dialog; closes itself after `onConfirm` resolves; shows `userMessage(error)` if it rejects.
  - `TextFieldDialog({ title, label, submitLabel, initialValue?, onSubmit: (value: string) => Promise<void>, onClose })` — form dialog; Enter submits; closes after `onSubmit` resolves; shows the error under the field if it rejects.

- [ ] **Step 1: Write the failing test** — `frontend/src/dialogs/dialogs.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '../store';
import { ConfirmDialog, TextFieldDialog } from './index';

describe('TextFieldDialog', () => {
  it('submits the value with Enter and closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<TextFieldDialog title="New project" label="Name" submitLabel="Create project" onSubmit={onSubmit} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText('Name'), 'OS{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('OS');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a store error under the field and stays open', async () => {
    const onClose = vi.fn();
    render(
      <TextFieldDialog
        title="New project"
        label="Name"
        submitLabel="Create project"
        onSubmit={() => Promise.reject(new ValidationError('Name can’t be empty.'))}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name can’t be empty.');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog', () => {
  it('focuses Cancel first and confirms on request', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ConfirmDialog title="Delete document" message="Delete “A.md”? This can’t be undone." confirmLabel="Delete document" onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/dialogs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`frontend/src/dialogs/ConfirmDialog.tsx`:

```tsx
import { useState } from 'react';
import { userMessage } from '../store';
import { Button, Dialog } from '../ui';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={title}
      tone="danger"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon="trash" disabled={busy} onClick={() => void confirm()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
      {error && (
        <p className="md-field-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
```

`frontend/src/dialogs/TextFieldDialog.tsx`:

```tsx
import { useId, useState, type FormEvent } from 'react';
import { userMessage } from '../store';
import { Button, Dialog, Input } from '../ui';

export interface TextFieldDialogProps {
  title: string;
  label: string;
  submitLabel: string;
  initialValue?: string;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}

export function TextFieldDialog({ title, label, submitLabel, initialValue = '', onSubmit, onClose }: TextFieldDialogProps) {
  const formId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(value);
      onClose();
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" disabled={busy}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => void submit(event)}>
        <Input
          label={label}
          value={value}
          error={error}
          onChange={(event) => {
            setValue(event.target.value);
            setError(undefined);
          }}
        />
      </form>
    </Dialog>
  );
}
```

`frontend/src/dialogs/index.ts`:

```ts
export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog';
export { TextFieldDialog, type TextFieldDialogProps } from './TextFieldDialog';
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/dialogs && npm run lint && npm run typecheck`
Expected: 3 tests pass.

- [ ] **Step 5: Update logs and commit**

```bash
git add frontend/src/dialogs context.md
git commit -m "feat(dialogs): confirm and text-field dialogs with store error messages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `useDocumentDraft` — loading, autosave, preview debounce

**Files:**
- Create: `frontend/src/app/useDocumentDraft.ts`
- Test: `frontend/src/app/useDocumentDraft.test.ts`

**Interfaces:**
- Consumes: `debounce` (Task 1); `getDocument`, `saveDocumentContent`, `NotFoundError` from `../store`.
- Produces:
  ```ts
  type SaveState = 'saved' | 'saving' | 'failed';
  type DraftStatus = 'none' | 'loading' | 'missing' | 'ready';
  interface DocumentDraft {
    status: DraftStatus;
    initialContent: string;   // content when loaded; the editor is uncontrolled after that
    previewSource: string;    // debounced latest content for the preview
    saveState: SaveState;
    onChange: (content: string) => void;
    saveNow: () => void;      // flush the pending save immediately (Ctrl/Cmd+S)
  }
  function useDocumentDraft(docId: string | undefined, options?: { saveDelay?: number; previewDelay?: number }): DocumentDraft
  ```

- [ ] **Step 1: Write the failing test** — `frontend/src/app/useDocumentDraft.test.ts`

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument, NotFoundError, saveDocumentContent, type MdDocument } from '../store';
import { useDocumentDraft } from './useDocumentDraft';

vi.mock('../store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../store')>();
  return { ...actual, getDocument: vi.fn(), saveDocumentContent: vi.fn() };
});

const getDocumentMock = vi.mocked(getDocument);
const saveMock = vi.mocked(saveDocumentContent);

function fakeDoc(id: string): MdDocument {
  return { id, projectId: 'p', folderId: null, title: `${id}.md`, content: `content of ${id}`, dirty: true, createdAt: 0, updatedAt: 0 };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  getDocumentMock.mockImplementation(async (id) => (id === 'gone' ? null : fakeDoc(id)));
  saveMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useDocumentDraft', () => {
  it('is "none" without a document', () => {
    const { result } = renderHook(() => useDocumentDraft(undefined));
    expect(result.current.status).toBe('none');
  });

  it('loads the document content', async () => {
    const { result } = renderHook(() => useDocumentDraft('a'));
    expect(result.current.status).toBe('loading');
    await advance(0);
    expect(result.current).toMatchObject({ status: 'ready', initialContent: 'content of a', previewSource: 'content of a', saveState: 'saved' });
  });

  it('reports a missing document', async () => {
    const { result } = renderHook(() => useDocumentDraft('gone'));
    await advance(0);
    expect(result.current.status).toBe('missing');
  });

  it('saves once, 1 s after the last edit, and shows saving until then', async () => {
    const { result } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('one'));
    act(() => result.current.onChange('two'));
    expect(result.current.saveState).toBe('saving');
    await advance(999);
    expect(saveMock).not.toHaveBeenCalled();
    await advance(1);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith('a', 'two');
    expect(result.current.saveState).toBe('saved');
  });

  it('updates the preview 150 ms after an edit', async () => {
    const { result } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('# New'));
    await advance(149);
    expect(result.current.previewSource).toBe('content of a');
    await advance(1);
    expect(result.current.previewSource).toBe('# New');
  });

  it('saveNow writes immediately', async () => {
    const { result } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('now'));
    await act(async () => result.current.saveNow());
    expect(saveMock).toHaveBeenCalledWith('a', 'now');
  });

  it('saves pending edits to the previous document when switching', async () => {
    const { result, rerender } = renderHook(({ id }) => useDocumentDraft(id), { initialProps: { id: 'a' } });
    await advance(0);
    act(() => result.current.onChange('typed into a'));
    rerender({ id: 'b' });
    await advance(0);
    expect(saveMock).toHaveBeenCalledWith('a', 'typed into a');
    expect(saveMock).not.toHaveBeenCalledWith('b', expect.anything());
    expect(result.current).toMatchObject({ status: 'ready', initialContent: 'content of b', previewSource: 'content of b' });
    await advance(2000);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('saves pending edits on unmount', async () => {
    const { result, unmount } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('bye'));
    unmount();
    expect(saveMock).toHaveBeenCalledWith('a', 'bye');
  });

  it('saves pending edits when the tab is hidden', async () => {
    const { result } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('hidden'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(saveMock).toHaveBeenCalledWith('a', 'hidden');
  });

  it('shows a failure, then recovers on the next edit', async () => {
    saveMock.mockRejectedValueOnce(new Error('quota'));
    const { result } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('x'));
    await advance(1000);
    expect(result.current.saveState).toBe('failed');
    act(() => result.current.onChange('xy'));
    await advance(1000);
    expect(result.current.saveState).toBe('saved');
  });

  it('ignores a save for a document deleted meanwhile', async () => {
    saveMock.mockRejectedValueOnce(new NotFoundError('This document no longer exists.'));
    const { result } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('late'));
    await advance(1000);
    expect(result.current.saveState).not.toBe('failed');
  });

  it('keeps showing saving while a newer edit is still pending', async () => {
    let resolveFirst!: () => void;
    saveMock.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve; }));
    const { result } = renderHook(() => useDocumentDraft('a'));
    await advance(0);
    act(() => result.current.onChange('first'));
    await advance(1000);
    act(() => result.current.onChange('second'));
    await act(async () => resolveFirst());
    expect(result.current.saveState).toBe('saving');
    await advance(1000);
    expect(result.current.saveState).toBe('saved');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/app/useDocumentDraft.test.ts`
Expected: FAIL — `./useDocumentDraft` not found.

- [ ] **Step 3: Implement** — `frontend/src/app/useDocumentDraft.ts`

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { debounce } from '../lib/debounce';
import { getDocument, NotFoundError, saveDocumentContent } from '../store';

export type SaveState = 'saved' | 'saving' | 'failed';
export type DraftStatus = 'none' | 'loading' | 'missing' | 'ready';

export interface DocumentDraft {
  status: DraftStatus;
  initialContent: string;
  previewSource: string;
  saveState: SaveState;
  onChange: (content: string) => void;
  saveNow: () => void;
}

export interface DraftOptions {
  saveDelay?: number;
  previewDelay?: number;
}

type Loaded = { id: string; found: false } | { id: string; found: true; content: string };

export function useDocumentDraft(docId: string | undefined, { saveDelay = 1000, previewDelay = 150 }: DraftOptions = {}): DocumentDraft {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [previewSource, setPreviewSource] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    getDocument(docId).then(
      (doc) => {
        if (cancelled) return;
        setLoaded(doc ? { id: docId, found: true, content: doc.content } : { id: docId, found: false });
        setPreviewSource(doc?.content ?? '');
        setSaveState('saved');
      },
      () => {
        if (!cancelled) setLoaded({ id: docId, found: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // One saver per document, so a pending save always lands in the document it was typed into.
  const saver = useMemo(() => {
    if (!docId) return null;
    let latest = 0;
    const save = debounce((content: string) => {
      const ticket = ++latest;
      saveDocumentContent(docId, content).then(
        () => {
          if (ticket === latest && !save.pending()) setSaveState('saved');
        },
        (error: unknown) => {
          if (error instanceof NotFoundError) return; // deleted meanwhile; nothing left to save
          console.error(error);
          if (ticket === latest) setSaveState('failed');
        },
      );
    }, saveDelay);
    return save;
  }, [docId, saveDelay]);

  // Flush on document switch, unmount, tab hide and page unload.
  useEffect(() => {
    if (!saver) return;
    const flush = () => saver.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [saver]);

  const previewer = useMemo(() => debounce((content: string) => setPreviewSource(content), previewDelay), [previewDelay]);
  // A preview scheduled for the previous document must not overwrite the next one.
  useEffect(() => () => previewer.cancel(), [previewer, docId]);

  const onChange = useCallback(
    (content: string) => {
      if (!saver) return;
      setSaveState('saving');
      saver(content);
      previewer(content);
    },
    [saver, previewer],
  );

  const saveNow = useCallback(() => saver?.flush(), [saver]);

  const current = docId && loaded?.id === docId ? loaded : null;
  const status: DraftStatus = !docId ? 'none' : !current ? 'loading' : current.found ? 'ready' : 'missing';
  return {
    status,
    initialContent: current?.found ? current.content : '',
    previewSource,
    saveState,
    onChange,
    saveNow,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/app/useDocumentDraft.test.ts && npm run lint && npm run typecheck`
Expected: 12 tests pass.

- [ ] **Step 5: Update logs and commit**

```bash
git add frontend/src/app context.md
git commit -m "feat(app): document draft hook with debounced autosave and preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: CodeMirror editor

**Files:**
- Create: `frontend/src/editor/theme.ts`, `frontend/src/editor/extensions.ts`, `frontend/src/editor/Editor.tsx`, `frontend/src/editor/index.ts`
- Modify: `frontend/src/test/setup.ts` (jsdom polyfills CodeMirror needs)
- Test: `frontend/src/editor/Editor.test.tsx`

**Interfaces:**
- Produces: `Editor({ initialContent: string; onChange(content: string): void; onSave(): void })` — uncontrolled; remount with `key` to load a different document.

- [ ] **Step 1: Add jsdom polyfills** — append to `frontend/src/test/setup.ts`:

```ts
// CodeMirror measures text with Range geometry that jsdom does not implement.
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}
```

- [ ] **Step 2: Write the failing test** — `frontend/src/editor/Editor.test.tsx`

```tsx
import { act, fireEvent, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

function setup(initialContent = '# Hello') {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const { container, unmount } = render(<Editor initialContent={initialContent} onChange={onChange} onSave={onSave} />);
  const editorEl = container.querySelector<HTMLElement>('.cm-editor')!;
  const view = EditorView.findFromDOM(editorEl)!;
  return { container, view, onChange, onSave, unmount };
}

describe('Editor', () => {
  it('shows the initial content', () => {
    const { container } = setup();
    expect(container.querySelector('.cm-content')?.textContent).toContain('# Hello');
  });

  it('reports the full document on every edit', () => {
    const { view, onChange } = setup();
    act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: '\nWorld' } }));
    expect(onChange).toHaveBeenLastCalledWith('# Hello\nWorld');
  });

  it('does not report a change when nothing changed', () => {
    const { view, onChange } = setup();
    act(() => view.dispatch({ selection: { anchor: 0 } }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves on Ctrl+S', () => {
    const { container, onSave } = setup();
    fireEvent.keyDown(container.querySelector('.cm-content')!, { key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('supports undo', () => {
    const { container, view, onChange } = setup('a');
    act(() => view.dispatch({ changes: { from: 1, insert: 'b' }, userEvent: 'input' }));
    fireEvent.keyDown(container.querySelector('.cm-content')!, { key: 'z', ctrlKey: true });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('cleans up on unmount', () => {
    const { container, unmount } = setup();
    unmount();
    expect(container.querySelector('.cm-editor')).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/editor`
Expected: FAIL — `./Editor` not found.

- [ ] **Step 4: Implement**

`frontend/src/editor/theme.ts`:

```ts
import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/** Editor chrome from design tokens (code-editor type style: 14/24 Geist Mono). */
export const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--paper-raised)', color: 'var(--ink)' },
  '&.cm-focused': { outline: '2px solid var(--focus)', outlineOffset: '-2px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '14px', lineHeight: '24px', overflow: 'auto' },
  '.cm-content': { padding: 'var(--space-6) var(--space-6) var(--space-16)', caretColor: 'var(--accent)', maxWidth: 'var(--doc-measure)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
});

/** Muted Markdown syntax colors: structure in ink, markup characters faint. */
export const markdownHighlight = HighlightStyle.define([
  { tag: t.heading, fontWeight: '600', color: 'var(--ink)' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--link)' },
  { tag: t.monospace, color: 'var(--ink-muted)' },
  { tag: t.quote, color: 'var(--ink-muted)' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: 'var(--ink-faint)' },
]);
```

`frontend/src/editor/extensions.ts`:

```ts
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { editorTheme, markdownHighlight } from './theme';

export interface EditorCallbacks {
  onChange: (content: string) => void;
  onSave: () => void;
}

export function createExtensions({ onChange, onSave }: EditorCallbacks): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }), // GFM
    syntaxHighlighting(markdownHighlight),
    keymap.of([
      { key: 'Mod-s', preventDefault: true, run: () => (onSave(), true) },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown source' }),
    editorTheme,
  ];
}
```

`frontend/src/editor/Editor.tsx`:

```tsx
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { createExtensions } from './extensions';

export interface EditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

/** Uncontrolled CodeMirror editor. Give it a `key` per document to load different content. */
export function Editor({ initialContent, onChange, onSave }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onSave });
  useEffect(() => {
    callbacks.current = { onChange, onSave };
  });

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: initialContent,
        extensions: createExtensions({
          onChange: (content) => callbacks.current.onChange(content),
          onSave: () => callbacks.current.onSave(),
        }),
      }),
    });
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uncontrolled: content is read once per mount
  }, []);

  return <div className="editor-host" ref={hostRef} />;
}
```

`frontend/src/editor/index.ts`:

```ts
export { Editor, type EditorProps } from './Editor';
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/editor && npm run lint && npm run typecheck`
Expected: 6 tests pass. If jsdom still throws inside CodeMirror measuring, add the missing API to the polyfill block in `setup.ts` (it is test-only) and note it in the commit message.

- [ ] **Step 6: Update logs and commit**

```bash
git add frontend/src/editor frontend/src/test/setup.ts context.md
git commit -m "feat(editor): CodeMirror 6 Markdown editor with tokens theme and Mod-s

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: App shell, theme, storage safety, project list

**Files:**
- Create: `frontend/src/lib/text.ts`, `frontend/src/lib/time.ts`, `frontend/src/app/App.tsx`, `theme.ts`, `storage.ts`, `ThemeMenu.tsx`, `StorageWarning.tsx`, `MissingPage.tsx`, `ProjectList.tsx`, `app.css`
- Modify: `frontend/src/main.tsx` (final version)
- Test: `frontend/src/lib/text.test.ts`, `frontend/src/lib/time.test.ts`, `frontend/src/app/storage.test.ts`, `frontend/src/app/App.test.tsx`, `frontend/src/app/ProjectList.test.tsx`

**Interfaces:**
- Consumes: `ui`, `dialogs`, `store`.
- Produces:
  - `plural(count: number, noun: string): string` ("1 document", "3 documents"), `listPhrase(parts: string[]): string` ("a", "a and b", "a, b and c").
  - `formatRelativeTime(timestamp: number, now?: number): string`.
  - `type ThemeChoice = 'system' | 'light' | 'dark'`; `useApplyTheme(): void`; `ThemeMenu()`.
  - `requestPersistentStorage(): Promise<boolean>`.
  - `StorageWarning()`, `MissingPage({ title, text })`, `ProjectList()`, `App()` (routes `/` and `*`; Task 12 adds workspace routes).

- [ ] **Step 1: Write the failing tests**

`frontend/src/lib/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { listPhrase, plural } from './text';

describe('text', () => {
  it('pluralizes with numerals', () => {
    expect(plural(0, 'document')).toBe('0 documents');
    expect(plural(1, 'document')).toBe('1 document');
    expect(plural(3, 'folder')).toBe('3 folders');
  });

  it('joins phrases', () => {
    expect(listPhrase(['a'])).toBe('a');
    expect(listPhrase(['a', 'b'])).toBe('a and b');
    expect(listPhrase(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
```

`frontend/src/lib/time.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './time';

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);

describe('formatRelativeTime', () => {
  it.each([
    [NOW - 10_000, 'just now'],
    [NOW - 5 * 60_000, '5 min ago'],
    [NOW - 3 * 3_600_000, '3 h ago'],
    [NOW - 24 * 3_600_000, 'yesterday'],
    [NOW - 3 * 24 * 3_600_000, '3 days ago'],
  ])('formats %d', (timestamp, expected) => {
    expect(formatRelativeTime(timestamp, NOW)).toBe(expected);
  });

  it('uses a date for older times', () => {
    expect(formatRelativeTime(NOW - 30 * 24 * 3_600_000, NOW)).toMatch(/2026/);
  });

  it('treats future timestamps (clock skew) as just now', () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe('just now');
  });
});
```

`frontend/src/app/storage.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './storage';

function stubStorage(value: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { ...navigator, storage: value });
}

afterEach(() => vi.unstubAllGlobals());

describe('requestPersistentStorage', () => {
  it('asks only when not already persisted', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persisted: vi.fn().mockResolvedValue(false), persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not ask again when already persisted', async () => {
    const persist = vi.fn();
    stubStorage({ persisted: vi.fn().mockResolvedValue(true), persist });
    expect(await requestPersistentStorage()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns false when the browser has no storage manager or it throws', async () => {
    stubStorage(undefined);
    expect(await requestPersistentStorage()).toBe(false);
    stubStorage({ persisted: vi.fn().mockRejectedValue(new Error('nope')), persist: vi.fn() });
    expect(await requestPersistentStorage()).toBe(false);
  });
});
```

`frontend/src/app/App.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, setSetting, SETTINGS } from '../store';
import { App } from './App';

beforeEach(async () => {
  await clearDatabase();
  delete document.documentElement.dataset.theme;
});

describe('App', () => {
  it('shows the project list at /', async () => {
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  });

  it('explains unknown paths', async () => {
    render(<MemoryRouter initialEntries={['/nowhere']}><App /></MemoryRouter>);
    expect(await screen.findByText('This page doesn’t exist')).toBeInTheDocument();
  });

  it('applies the stored theme to the document root', async () => {
    await setSetting(SETTINGS.theme, 'dark');
    render(<MemoryRouter><App /></MemoryRouter>);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    await setSetting(SETTINGS.theme, 'system');
    await waitFor(() => expect(document.documentElement.dataset.theme).toBeUndefined());
  });
});
```

`frontend/src/app/ProjectList.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createDocument, createProject, getSetting, listProjectSummaries, SETTINGS } from '../store';
import { ProjectList } from './ProjectList';

function Opened() {
  const { projectId } = useParams();
  return <p>Opened {projectId}</p>;
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/p/:projectId" element={<Opened />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(clearDatabase);

describe('ProjectList', () => {
  it('creates a project from the empty state and opens it', async () => {
    const user = userEvent.setup();
    renderList();
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Name'), 'Operating Systems Notes');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText(/^Opened /)).toBeInTheDocument();
    expect((await listProjectSummaries())[0]?.name).toBe('Operating Systems Notes');
  });

  it('keeps the dialog open with a message when the name is empty', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name can’t be empty.');
  });

  it('lists projects with document counts and renames one', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null);
    renderList();
    expect(await screen.findByText(/1 document · Updated/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'Operating systems{Enter}');
    expect(await screen.findByText('Operating systems')).toBeInTheDocument();
  });

  it('edits the description', async () => {
    const user = userEvent.setup();
    await createProject('OS');
    renderList();
    await user.click(await screen.findByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit description' }));
    await user.type(screen.getByLabelText('Description'), 'Lecture notes{Enter}');
    expect(await screen.findByText('Lecture notes')).toBeInTheDocument();
  });

  it('asks before deleting and says how many documents go with it', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null);
    await createDocument(project.id, null);
    renderList();
    await user.click(await screen.findByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “OS” and its 2 documents? This can’t be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('shows the storage warning until dismissed', async () => {
    const user = userEvent.setup();
    renderList();
    expect(await screen.findByText(/Clearing browser data deletes it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByText(/Clearing browser data/)).not.toBeInTheDocument());
    expect(await getSetting(SETTINGS.storageWarningDismissed, false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib src/app/storage.test.ts src/app/App.test.tsx src/app/ProjectList.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement helpers**

`frontend/src/lib/text.ts`:

```ts
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export function listPhrase(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
```

`frontend/src/lib/time.ts`:

```ts
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
```

`frontend/src/app/storage.ts`:

```ts
/** Ask the browser not to evict our IndexedDB data (PRD §5.8). Returns whether storage is persistent. */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = navigator.storage;
  if (!storage?.persist || !storage.persisted) return false;
  try {
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}
```

`frontend/src/app/theme.ts`:

```ts
import { useEffect } from 'react';
import { SETTINGS, useSetting } from '../store';

export type ThemeChoice = 'system' | 'light' | 'dark';

/** Mirror the stored theme onto <html data-theme>; "system" leaves it to prefers-color-scheme. */
export function useApplyTheme(): void {
  const theme = useSetting<ThemeChoice>(SETTINGS.theme, 'system');
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [theme]);
}
```

- [ ] **Step 4: Implement components**

`frontend/src/app/ThemeMenu.tsx`:

```tsx
import { SETTINGS, useSettingState } from '../store';
import { MenuButton, type MenuItem } from '../ui';
import type { ThemeChoice } from './theme';

export function ThemeMenu() {
  const [theme, setTheme] = useSettingState<ThemeChoice>(SETTINGS.theme, 'system');
  const item = (value: ThemeChoice, label: string): MenuItem => ({
    label,
    icon: theme === value ? 'check' : undefined,
    onSelect: () => setTheme(value),
  });
  return (
    <MenuButton
      icon="sliders"
      label="Display"
      items={[item('system', 'Match system theme'), item('light', 'Light theme'), item('dark', 'Dark theme')]}
    />
  );
}
```

`frontend/src/app/StorageWarning.tsx`:

```tsx
import { setSetting, SETTINGS, useSetting } from '../store';
import { Button, Callout } from '../ui';

export function StorageWarning() {
  const dismissed = useSetting(SETTINGS.storageWarningDismissed, false);
  if (dismissed !== false) return null;
  return (
    <Callout
      tone="warning"
      title="Your work is saved in this browser"
      actions={
        <Button size="sm" onClick={() => void setSetting(SETTINGS.storageWarningDismissed, true)}>
          Got it
        </Button>
      }
    >
      Clearing browser data deletes it.
    </Callout>
  );
}
```

`frontend/src/app/MissingPage.tsx`:

```tsx
import { useNavigate } from 'react-router';
import { Button, EmptyState, Wordmark } from '../ui';
import { ThemeMenu } from './ThemeMenu';

export function MissingPage({ title, text }: { title: string; text: string }) {
  const navigate = useNavigate();
  return (
    <div className="page">
      <header className="app-toolbar">
        <Wordmark />
        <span className="app-toolbar-spacer" />
        <ThemeMenu />
      </header>
      <main className="page-center">
        <EmptyState icon="info" title={title} action={<Button variant="primary" onClick={() => navigate('/')}>Back to projects</Button>}>
          {text}
        </EmptyState>
      </main>
    </div>
  );
}
```

`frontend/src/app/ProjectList.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ConfirmDialog, TextFieldDialog } from '../dialogs';
import { plural } from '../lib/text';
import { formatRelativeTime } from '../lib/time';
import {
  createProject, deleteProject, renameProject, setProjectDescription, useProjectSummaries, type ProjectSummary,
} from '../store';
import { Button, EmptyState, MenuButton, Wordmark } from '../ui';
import { StorageWarning } from './StorageWarning';
import { ThemeMenu } from './ThemeMenu';

type ProjectDialog =
  | { kind: 'create' }
  | { kind: 'rename'; project: ProjectSummary }
  | { kind: 'describe'; project: ProjectSummary }
  | { kind: 'delete'; project: ProjectSummary }
  | null;

function deleteMessage(project: ProjectSummary): string {
  const contents = project.documentCount > 0 ? ` and its ${plural(project.documentCount, 'document')}` : '';
  return `Delete “${project.name}”${contents}? This can’t be undone.`;
}

export function ProjectList() {
  const projects = useProjectSummaries();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<ProjectDialog>(null);
  const close = () => setDialog(null);
  const open = (id: string) => navigate(`/p/${id}`);
  const newProjectButton = (
    <Button variant="primary" icon="plus" onClick={() => setDialog({ kind: 'create' })}>
      New project
    </Button>
  );

  return (
    <div className="page">
      <header className="app-toolbar">
        <Wordmark />
        <span className="app-toolbar-spacer" />
        <ThemeMenu />
      </header>
      <main className="projects">
        <StorageWarning />
        <div className="projects-head">
          <h1>Projects</h1>
          {projects && projects.length > 0 && newProjectButton}
        </div>
        {projects?.length === 0 && (
          <EmptyState icon="folder" title="No projects yet" action={newProjectButton}>
            Projects live in this browser. Create one to start writing.
          </EmptyState>
        )}
        {projects && projects.length > 0 && (
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id} className="project-row">
                <button type="button" className="project-open" onClick={() => open(project.id)}>
                  <span className="project-name">{project.name}</span>
                  {project.description && <span className="project-desc">{project.description}</span>}
                  <span className="project-meta">
                    {plural(project.documentCount, 'document')} · Updated {formatRelativeTime(project.updatedAt)}
                  </span>
                </button>
                <MenuButton
                  label={`Actions for ${project.name}`}
                  items={[
                    { label: 'Open', icon: 'folder-open', onSelect: () => open(project.id) },
                    { label: 'Rename', icon: 'pencil', onSelect: () => setDialog({ kind: 'rename', project }) },
                    { label: 'Edit description', onSelect: () => setDialog({ kind: 'describe', project }) },
                    'separator',
                    { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', project }) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      {dialog?.kind === 'create' && (
        <TextFieldDialog
          title="New project"
          label="Name"
          submitLabel="Create project"
          onClose={close}
          onSubmit={async (name) => {
            const project = await createProject(name);
            open(project.id);
          }}
        />
      )}
      {dialog?.kind === 'rename' && (
        <TextFieldDialog
          title="Rename project"
          label="Name"
          submitLabel="Rename"
          initialValue={dialog.project.name}
          onClose={close}
          onSubmit={async (name) => {
            await renameProject(dialog.project.id, name);
          }}
        />
      )}
      {dialog?.kind === 'describe' && (
        <TextFieldDialog
          title="Edit description"
          label="Description"
          submitLabel="Save description"
          initialValue={dialog.project.description}
          onClose={close}
          onSubmit={async (text) => {
            await setProjectDescription(dialog.project.id, text);
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete project"
          message={deleteMessage(dialog.project)}
          confirmLabel="Delete project"
          onClose={close}
          onConfirm={() => deleteProject(dialog.project.id)}
        />
      )}
    </div>
  );
}
```

`frontend/src/app/App.tsx`:

```tsx
import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { MissingPage } from './MissingPage';
import { ProjectList } from './ProjectList';
import { requestPersistentStorage } from './storage';
import { useApplyTheme } from './theme';

export function App() {
  useApplyTheme();
  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<ProjectList />} />
      <Route path="*" element={<MissingPage title="This page doesn’t exist" text="Check the address, or go back to your projects." />} />
    </Routes>
  );
}
```

`frontend/src/main.tsx` (final):

```tsx
import './ui/styles';
import './app/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

`frontend/src/app/app.css`:

```css
html, body, #root { height: 100%; }

.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

.page { min-height: 100%; display: flex; flex-direction: column; }
.page-center { flex: 1; display: grid; place-items: center; }

.app-toolbar { height: var(--toolbar-height); flex: none; display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-3) 0 var(--space-4); border-bottom: 1px solid var(--line); background: var(--paper); box-sizing: border-box; }
.app-toolbar-spacer { flex: 1; }
.home-link { display: inline-flex; align-items: center; height: var(--control-sm); padding: 0 var(--space-1); border-radius: var(--radius-sm); text-decoration: none; }
.home-link:focus-visible, .project-open:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* Project list */
.projects { width: 100%; max-width: var(--doc-measure); margin: 0 auto; padding: var(--space-12) var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); box-sizing: border-box; }
.projects-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.projects-head h1 { margin: 0; font: 600 20px/28px var(--font-sans); letter-spacing: -0.01em; }
.project-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.project-row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid var(--line); }
.project-open { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: var(--space-2); border: 0; border-radius: var(--radius-md); background: transparent; color: var(--ink); text-align: left; font: inherit; cursor: pointer; transition: background-color .12s ease-out; }
.project-open:hover { background: var(--paper-sunken); }
.project-name { font: 600 14px/20px var(--font-sans); }
.project-desc { font: 400 13px/20px var(--font-sans); color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project-meta { font: 400 12px/16px var(--font-sans); color: var(--ink-muted); }

/* Workspace (Task 12) */
.ws { height: 100%; display: flex; flex-direction: column; }
.ws-toolbar { display: grid; grid-template-columns: 1fr auto 1fr; }
.ws-left, .ws-right { display: flex; align-items: center; gap: var(--space-2); min-width: 0; }
.ws-right { justify-content: flex-end; }
.ws-crumb-sep { color: var(--ink-faint); }
.ws-project { font: 500 13px/18px var(--font-sans); color: var(--ink-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ws-body { flex: 1; min-height: 0; display: flex; }
.ws-tree { width: var(--sidebar-width); flex: none; display: flex; flex-direction: column; background: var(--paper-sunken); border-right: 1px solid var(--line); overflow: auto; }
.ws-main { flex: 1; min-width: 0; display: grid; grid-template-columns: 1fr 1fr; }
.ws-main.mode-editor, .ws-main.mode-preview { grid-template-columns: 1fr; }
.ws-main.mode-editor .ws-preview, .ws-main.mode-preview .ws-editor { display: none; }
.ws-editor { min-width: 0; min-height: 0; overflow: hidden; background: var(--paper-raised); }
.ws-main.mode-split .ws-editor { border-right: 1px solid var(--line); }
.editor-host, .editor-host .cm-editor { height: 100%; }
.ws-preview { min-width: 0; overflow: auto; background: var(--paper); }
.ws-empty { grid-column: 1 / -1; display: grid; place-items: center; }
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all tests pass (ui, store, renderer, dialogs, draft, editor, lib, app).

- [ ] **Step 6: Manual smoke check**

Run: `npm run dev`, open the printed URL. Expect: toolbar with md.IT wordmark (teal dot), storage warning, "No projects yet" empty state in Geist; creating a project navigates to `/p/<id>` which shows "This page doesn’t exist" (workspace arrives in Task 12). Toggle Display → Dark theme: colors switch. Stop the server.

- [ ] **Step 7: Update logs and commit**

```bash
git add frontend/src context.md
git commit -m "feat(app): app shell, theme, storage request and project list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: File tree

**Files:**
- Create: `frontend/src/tree/buildTree.ts`, `messages.ts`, `RenameField.tsx`, `MoveDialog.tsx`, `FileTree.tsx`, `tree.css`, `index.ts`
- Test: `frontend/src/tree/buildTree.test.ts`, `frontend/src/tree/messages.test.ts`, `frontend/src/tree/FileTree.test.tsx`

**Interfaces:**
- Consumes: `store` (hooks, mutations, `ancestorFolderIds`, `descendantFolderIds`, `userMessage`), `ui`, `dialogs`, `lib/text`.
- Produces:
  - `type TreeNode = { kind: 'folder'; id; name; parentId: string | null; depth: number; children: TreeNode[] } | { kind: 'file'; id; name; parentId: string | null; depth: number }`
  - `buildTree(folders: Folder[], documents: MdDocument[]): TreeNode[]` (folders first, then files; each group sorted case-insensitively, numeric-aware)
  - `flattenVisible(nodes: TreeNode[], open: ReadonlySet<string>): TreeNode[]`
  - `type MoveTarget = { id: string | null; label: string; depth: number }`; `moveTargets(node: { kind; id; parentId }, folders: Folder[]): MoveTarget[]` (root labelled "Project root"; excludes the current parent, the node itself and, for folders, its descendants)
  - `folderContents(folderId, folders, documents): { folders: number; documents: number }` (all depths)
  - `deleteMessage(node: { kind; name }, contents?: { folders; documents }): string`
  - `FileTree({ projectId: string; activeDocId?: string; onOpen(docId: string): void; onActiveDeleted(): void })`

- [ ] **Step 1: Write the failing tests**

`frontend/src/tree/buildTree.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Folder, MdDocument } from '../store';
import { buildTree, flattenVisible, folderContents, moveTargets } from './buildTree';

const folder = (id: string, parentFolderId: string | null, name: string): Folder => ({ id, projectId: 'p', parentFolderId, name, createdAt: 0, updatedAt: 0 });
const doc = (id: string, folderId: string | null, title: string): MdDocument => ({ id, projectId: 'p', folderId, title, content: '', dirty: true, createdAt: 0, updatedAt: 0 });

const folders = [folder('f1', null, 'b-folder'), folder('f2', null, 'A-folder'), folder('f3', 'f1', 'inner')];
const documents = [doc('d1', null, 'z.md'), doc('d2', 'f1', 'c.md'), doc('d3', null, 'a.md'), doc('d4', 'f3', 'deep.md')];

describe('buildTree', () => {
  it('puts folders first, sorts case-insensitively, and nests with depth', () => {
    const tree = buildTree(folders, documents);
    expect(tree.map((n) => n.name)).toEqual(['A-folder', 'b-folder', 'a.md', 'z.md']);
    const b = tree[1]!;
    expect(b.kind === 'folder' && b.children.map((n) => `${n.name}@${n.depth}`)).toEqual(['inner@1', 'c.md@1']);
  });

  it('sorts numbers naturally', () => {
    const tree = buildTree([], [doc('1', null, 'Part 10.md'), doc('2', null, 'Part 2.md')]);
    expect(tree.map((n) => n.name)).toEqual(['Part 2.md', 'Part 10.md']);
  });

  it('shows children only of open folders', () => {
    const tree = buildTree(folders, documents);
    expect(flattenVisible(tree, new Set()).map((n) => n.name)).toEqual(['A-folder', 'b-folder', 'a.md', 'z.md']);
    expect(flattenVisible(tree, new Set(['f1'])).map((n) => n.name)).toEqual(['A-folder', 'b-folder', 'inner', 'c.md', 'a.md', 'z.md']);
  });

  it('keeps items whose parent folder is missing at the root instead of hiding them', () => {
    const tree = buildTree([], [doc('x', 'ghost', 'orphan.md')]);
    expect(tree.map((n) => n.name)).toEqual(['orphan.md']);
  });
});

describe('moveTargets', () => {
  it('excludes a folder, its descendants and its current parent', () => {
    expect(moveTargets({ kind: 'folder', id: 'f1', parentId: null }, folders).map((t) => t.id)).toEqual(['f2']);
  });

  it('offers the root and every other folder for a document', () => {
    const targets = moveTargets({ kind: 'file', id: 'd2', parentId: 'f1' }, folders);
    expect(targets.map((t) => t.id)).toEqual([null, 'f2', 'f3']);
    expect(targets[0]).toEqual({ id: null, label: 'Project root', depth: 0 });
    expect(targets.find((t) => t.id === 'f3')?.depth).toBe(2);
  });
});

describe('folderContents', () => {
  it('counts nested folders and documents', () => {
    expect(folderContents('f1', folders, documents)).toEqual({ folders: 1, documents: 2 });
  });
});
```

`frontend/src/tree/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deleteMessage } from './messages';

describe('deleteMessage', () => {
  it('names a single document', () => {
    expect(deleteMessage({ kind: 'file', name: 'A.md' })).toBe('Delete “A.md”? This can’t be undone.');
  });

  it('names an empty folder', () => {
    expect(deleteMessage({ kind: 'folder', name: 'OS' }, { folders: 0, documents: 0 })).toBe('Delete “OS”? This can’t be undone.');
  });

  it('lists what goes with a folder', () => {
    expect(deleteMessage({ kind: 'folder', name: 'OS' }, { folders: 1, documents: 2 })).toBe(
      'Delete “OS” and the 2 documents and 1 folder inside it? This can’t be undone.',
    );
    expect(deleteMessage({ kind: 'folder', name: 'OS' }, { folders: 0, documents: 1 })).toBe(
      'Delete “OS” and the 1 document inside it? This can’t be undone.',
    );
  });
});
```

`frontend/src/tree/FileTree.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, createDocument, createFolder, createProject, getDocument, listDocuments } from '../store';
import { FileTree } from './FileTree';

beforeEach(clearDatabase);

function renderTree(projectId: string, activeDocId?: string) {
  const onOpen = vi.fn();
  const onActiveDeleted = vi.fn();
  render(<FileTree projectId={projectId} activeDocId={activeDocId} onOpen={onOpen} onActiveDeleted={onActiveDeleted} />);
  return { onOpen, onActiveDeleted };
}

describe('FileTree', () => {
  it('creates a document from the empty state and names it', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const { onOpen } = renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Create document' }));
    const input = await screen.findByRole('textbox', { name: 'Rename Untitled.md' });
    await user.clear(input);
    await user.type(input, 'Processes{Enter}');
    expect(await screen.findByRole('treeitem', { name: 'Processes.md' })).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens a document on click', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const doc = await createDocument(project.id, null, 'Threads');
    const { onOpen } = renderTree(project.id);
    await user.click(await screen.findByRole('treeitem', { name: 'Threads.md' }));
    expect(onOpen).toHaveBeenCalledWith(doc.id);
  });

  it('creates a document inside a folder from the folder’s menu and opens the folder', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createFolder(project.id, null, 'Scheduling');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Scheduling' }));
    await user.click(screen.getByRole('menuitem', { name: 'New document' }));
    await screen.findByRole('textbox', { name: 'Rename Untitled.md' });
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('treeitem', { name: 'Untitled.md' })).toHaveAttribute('aria-level', '2');
    expect(screen.getByRole('treeitem', { name: 'Scheduling' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('rejects a duplicate name inline', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Processes');
    await createDocument(project.id, null, 'Threads');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Threads.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename Threads.md' });
    await user.clear(input);
    await user.type(input, 'processes.md{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('“processes.md” already exists here.');
  });

  it('cancels a rename with Escape', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Threads');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Threads.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    await user.type(screen.getByRole('textbox', { name: 'Rename Threads.md' }), 'xyz{Escape}');
    expect(await screen.findByRole('treeitem', { name: 'Threads.md' })).toBeInTheDocument();
  });

  it('duplicates a document', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Threads');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Threads.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(await screen.findByRole('treeitem', { name: 'Threads copy.md' })).toBeInTheDocument();
  });

  it('confirms before deleting a folder, reports what goes with it, and closes the open document inside', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    const inner = await createFolder(project.id, folder.id, 'Old');
    const active = await createDocument(project.id, folder.id, 'A');
    await createDocument(project.id, inner.id, 'B');
    const { onActiveDeleted } = renderTree(project.id, active.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Scheduling' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “Scheduling” and the 2 documents and 1 folder inside it? This can’t be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete folder' }));
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'Scheduling' })).not.toBeInTheDocument());
    expect(onActiveDeleted).toHaveBeenCalledTimes(1);
    expect(await listDocuments(project.id)).toHaveLength(0);
  });

  it('moves a document with Move to…', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    const doc = await createDocument(project.id, null, 'RR');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for RR.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    await user.click(screen.getByRole('radio', { name: 'Scheduling' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await waitFor(async () => expect((await getDocument(doc.id))?.folderId).toBe(folder.id));
  });

  it('shows a conflict when moving onto a same-named item and moves nothing', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    await createDocument(project.id, folder.id, 'RR');
    const doc = await createDocument(project.id, null, 'RR');
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for RR.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    await user.click(screen.getByRole('radio', { name: 'Scheduling' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('“RR.md” already exists here.');
    expect((await getDocument(doc.id))?.folderId).toBeNull();
  });

  it('moves a document by dragging it onto a folder', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    const doc = await createDocument(project.id, null, 'RR');
    renderTree(project.id);
    const row = await screen.findByRole('treeitem', { name: 'RR.md' });
    const target = screen.getByRole('treeitem', { name: 'Scheduling' });
    fireEvent.dragStart(row);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(async () => expect((await getDocument(doc.id))?.folderId).toBe(folder.id));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/tree`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the pure helpers**

`frontend/src/tree/buildTree.ts`:

```ts
import { ancestorFolderIds, descendantFolderIds, type Folder, type MdDocument } from '../store';

export type TreeNode =
  | { kind: 'folder'; id: string; name: string; parentId: string | null; depth: number; children: TreeNode[] }
  | { kind: 'file'; id: string; name: string; parentId: string | null; depth: number };

export type NodeRef = Pick<TreeNode, 'kind' | 'id' | 'parentId'>;

export interface MoveTarget {
  id: string | null;
  label: string;
  depth: number;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const byName = (a: { name: string }, b: { name: string }) => collator.compare(a.name, b.name);

export function buildTree(folders: readonly Folder[], documents: readonly MdDocument[]): TreeNode[] {
  const known = new Set(folders.map((f) => f.id));
  // An item whose parent is missing (should not happen) is shown at the root rather than lost.
  const parentOf = (id: string | null) => (id !== null && known.has(id) ? id : null);

  const build = (parentId: string | null, depth: number, seen: Set<string>): TreeNode[] => {
    const childFolders = folders
      .filter((f) => parentOf(f.parentFolderId) === parentId && !seen.has(f.id))
      .sort(byName)
      .map((f): TreeNode => ({
        kind: 'folder', id: f.id, name: f.name, parentId, depth,
        children: build(f.id, depth + 1, new Set([...seen, f.id])),
      }));
    const childFiles = documents
      .filter((d) => parentOf(d.folderId) === parentId)
      .map((d) => ({ kind: 'file' as const, id: d.id, name: d.title, parentId, depth }))
      .sort(byName);
    return [...childFolders, ...childFiles];
  };
  return build(null, 0, new Set());
}

export function flattenVisible(nodes: readonly TreeNode[], open: ReadonlySet<string>): TreeNode[] {
  const rows: TreeNode[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const node of list) {
      rows.push(node);
      if (node.kind === 'folder' && open.has(node.id)) walk(node.children);
    }
  };
  walk(nodes);
  return rows;
}

export function moveTargets(node: NodeRef, folders: readonly Folder[]): MoveTarget[] {
  const excluded = new Set<string>(node.kind === 'folder' ? [node.id, ...descendantFolderIds(folders, node.id)] : []);
  const all = flattenVisible(buildTree(folders, []), new Set(folders.map((f) => f.id)));
  const targets: MoveTarget[] = [{ id: null, label: 'Project root', depth: 0 }];
  for (const row of all) {
    if (!excluded.has(row.id)) targets.push({ id: row.id, label: row.name, depth: row.depth + 1 });
  }
  return targets.filter((target) => target.id !== node.parentId);
}

export function canMoveTo(node: NodeRef, targetId: string | null, folders: readonly Folder[]): boolean {
  return moveTargets(node, folders).some((target) => target.id === targetId);
}

export function folderContents(folderId: string, folders: readonly Folder[], documents: readonly MdDocument[]) {
  const nested = descendantFolderIds(folders, folderId);
  const inside = new Set([folderId, ...nested]);
  return { folders: nested.length, documents: documents.filter((d) => d.folderId !== null && inside.has(d.folderId)).length };
}

export function isInsideFolder(document: MdDocument | undefined, folderId: string, folders: readonly Folder[]): boolean {
  return document !== undefined && ancestorFolderIds(folders, document.folderId).includes(folderId);
}
```

`frontend/src/tree/messages.ts`:

```ts
import { listPhrase, plural } from '../lib/text';

export function deleteMessage(node: { kind: 'folder' | 'file'; name: string }, contents?: { folders: number; documents: number }): string {
  const parts: string[] = [];
  if (contents?.documents) parts.push(plural(contents.documents, 'document'));
  if (contents?.folders) parts.push(plural(contents.folders, 'folder'));
  const inside = parts.length > 0 ? ` and the ${listPhrase(parts)} inside it` : '';
  return `Delete “${node.name}”${inside}? This can’t be undone.`;
}
```

- [ ] **Step 4: Implement the components**

`frontend/src/tree/RenameField.tsx`:

```tsx
import { useRef, useState } from 'react';
import { userMessage } from '../store';
import { Input } from '../ui';

export interface RenameFieldProps {
  name: string;
  depth: number;
  onCommit: (value: string) => Promise<void>;
  onCancel: () => void;
}

/** Inline rename: Enter or blur saves, Escape cancels, errors stay visible under the field. */
export function RenameField({ name, depth, onCommit, onCancel }: RenameFieldProps) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string>();
  const finished = useRef(false);

  const commit = async () => {
    if (finished.current) return;
    finished.current = true;
    if (value.trim() === name) return onCancel();
    try {
      await onCommit(value);
    } catch (err) {
      finished.current = false;
      setError(userMessage(err));
    }
  };

  const cancel = () => {
    finished.current = true;
    onCancel();
  };

  return (
    <div className="tree-rename" style={{ paddingLeft: `${8 + depth * 16}px` }}>
      <Input
        aria-label={`Rename ${name}`}
        value={value}
        error={error}
        autoFocus
        onFocus={(event) => {
          const el = event.currentTarget;
          const end = /\.md$/i.test(el.value) ? el.value.length - 3 : el.value.length;
          el.setSelectionRange(0, end);
        }}
        onChange={(event) => {
          setValue(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void commit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cancel();
          }
        }}
        onBlur={() => void commit()}
      />
    </div>
  );
}
```

`frontend/src/tree/MoveDialog.tsx`:

```tsx
import { useState } from 'react';
import { userMessage, type Folder } from '../store';
import { Button, Dialog, Icon } from '../ui';
import { moveTargets, type NodeRef } from './buildTree';

export interface MoveDialogProps {
  node: NodeRef & { name: string };
  folders: readonly Folder[];
  onMove: (targetId: string | null) => Promise<void>;
  onClose: () => void;
}

export function MoveDialog({ node, folders, onMove, onClose }: MoveDialogProps) {
  const targets = moveTargets(node, folders);
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const move = async () => {
    if (target === undefined) return;
    setBusy(true);
    setError(undefined);
    try {
      await onMove(target);
      onClose();
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Move “${node.name}”`}
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={target === undefined || busy} onClick={() => void move()}>
            Move
          </Button>
        </>
      }
    >
      {targets.length === 0 ? (
        <p>There’s nowhere else to move this.</p>
      ) : (
        <fieldset className="move-targets">
          <legend className="sr-only">Destination</legend>
          {targets.map((option) => (
            <label key={option.id ?? 'root'} className="move-target" style={{ paddingLeft: `${4 + option.depth * 16}px` }}>
              <input type="radio" name="move-target" checked={target === option.id} onChange={() => setTarget(option.id)} />
              <Icon name="folder" />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p className="md-field-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
```

`frontend/src/tree/FileTree.tsx`:

```tsx
import { useEffect, useState, type DragEvent } from 'react';
import { ConfirmDialog } from '../dialogs';
import {
  ancestorFolderIds, createDocument, createFolder, deleteDocument, deleteFolder, duplicateDocument, moveDocument, moveFolder,
  renameDocument, renameFolder, useDocuments, useFolders, userMessage,
} from '../store';
import { Button, Callout, EmptyState, IconButton, MenuButton, TreeItem, cx, type MenuItem } from '../ui';
import { buildTree, canMoveTo, flattenVisible, folderContents, isInsideFolder, type TreeNode } from './buildTree';
import { deleteMessage } from './messages';
import { MoveDialog } from './MoveDialog';
import { RenameField } from './RenameField';
import './tree.css';

export interface FileTreeProps {
  projectId: string;
  activeDocId?: string;
  onOpen: (docId: string) => void;
  /** Called after the open document was deleted (directly or with its folder). */
  onActiveDeleted: () => void;
}

type TreeDialog = { kind: 'move'; node: TreeNode } | { kind: 'delete'; node: TreeNode } | null;
/** undefined = no drop target; null = project root. */
type DropTarget = string | null | undefined;

function withAll(set: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  return ids.every((id) => set.has(id)) ? set : new Set([...set, ...ids]);
}

export function FileTree({ projectId, activeDocId, onOpen, onActiveDeleted }: FileTreeProps) {
  const folders = useFolders(projectId);
  const documents = useDocuments(projectId);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<TreeDialog>(null);
  const [dragging, setDragging] = useState<TreeNode | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(undefined);
  const [error, setError] = useState<string | null>(null);

  const openFolders = (ids: readonly string[]) => setOpen((prev) => withAll(prev, ids));

  // Keep the active document visible.
  useEffect(() => {
    if (!activeDocId || !folders || !documents) return;
    const doc = documents.find((d) => d.id === activeDocId);
    if (doc) setOpen((prev) => withAll(prev, ancestorFolderIds(folders, doc.folderId)));
  }, [activeDocId, folders, documents]);

  if (!folders || !documents) return null;

  const rows = flattenVisible(buildTree(folders, documents), open);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(userMessage(err));
    }
  };

  const toggleFolder = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const newDocument = (folderId: string | null) =>
    run(async () => {
      const doc = await createDocument(projectId, folderId);
      if (folderId) openFolders([folderId]);
      setRenamingId(doc.id);
      onOpen(doc.id);
    });

  const newFolder = (parentId: string | null) =>
    run(async () => {
      const folder = await createFolder(projectId, parentId);
      if (parentId) openFolders([parentId]);
      setRenamingId(folder.id);
    });

  const move = (node: TreeNode, targetId: string | null) =>
    node.kind === 'folder' ? moveFolder(node.id, targetId) : moveDocument(node.id, targetId);

  const remove = async (node: TreeNode) => {
    const active = documents.find((d) => d.id === activeDocId);
    const activeGone = node.kind === 'file' ? node.id === activeDocId : isInsideFolder(active, node.id, folders);
    if (node.kind === 'folder') await deleteFolder(node.id);
    else await deleteDocument(node.id);
    if (activeGone) onActiveDeleted();
  };

  const menuFor = (node: TreeNode): MenuItem[] =>
    node.kind === 'folder'
      ? [
          { label: 'New document', icon: 'file', onSelect: () => void newDocument(node.id) },
          { label: 'New folder', icon: 'folder', onSelect: () => void newFolder(node.id) },
          'separator',
          { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(node.id) },
          { label: 'Move to…', onSelect: () => setDialog({ kind: 'move', node }) },
          'separator',
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', node }) },
        ]
      : [
          { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(node.id) },
          { label: 'Duplicate', icon: 'copy', onSelect: () => void run(async () => onOpen((await duplicateDocument(node.id)).id)) },
          { label: 'Move to…', onSelect: () => setDialog({ kind: 'move', node }) },
          'separator',
          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', node }) },
        ];

  const canDrop = (targetId: string | null) => dragging !== null && canMoveTo(dragging, targetId, folders);
  const endDrag = () => {
    setDragging(null);
    setDropTarget(undefined);
  };
  const dragOver = (targetId: string | null) => (event: DragEvent) => {
    if (!canDrop(targetId)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(targetId);
  };
  const drop = (targetId: string | null) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const node = dragging;
    endDrag();
    if (node && canMoveTo(node, targetId, folders)) void run(() => move(node, targetId));
  };

  return (
    <div className="tree">
      <div className="tree-head">
        <h2>Files</h2>
        <div className="tree-head-actions">
          <IconButton icon="plus" label="New document" onClick={() => void newDocument(null)} />
          <IconButton icon="folder" label="New folder" onClick={() => void newFolder(null)} />
        </div>
      </div>

      {error && (
        <div className="tree-message">
          <Callout tone="danger">{error}</Callout>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="file"
          title="No documents yet"
          action={
            <Button variant="primary" icon="plus" onClick={() => void newDocument(null)}>
              Create document
            </Button>
          }
        >
          Create a document to start writing.
        </EmptyState>
      ) : (
        <div
          className={cx('tree-rows', dropTarget === null && 'is-drop-root')}
          role="tree"
          aria-label="Files"
          onDragOver={dragOver(null)}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDropTarget(undefined);
          }}
          onDrop={drop(null)}
        >
          {rows.map((node) =>
            node.id === renamingId ? (
              <RenameField
                key={node.id}
                name={node.name}
                depth={node.depth}
                onCancel={() => setRenamingId(null)}
                onCommit={async (value) => {
                  if (node.kind === 'folder') await renameFolder(node.id, value);
                  else await renameDocument(node.id, value);
                  setRenamingId(null);
                }}
              />
            ) : (
              <TreeItem
                key={node.id}
                kind={node.kind}
                name={node.name}
                depth={node.depth}
                open={node.kind === 'folder' ? open.has(node.id) : undefined}
                active={node.kind === 'file' && node.id === activeDocId}
                dropTarget={node.kind === 'folder' && dropTarget === node.id}
                onClick={() => (node.kind === 'folder' ? toggleFolder(node.id) : onOpen(node.id))}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer?.setData('text/plain', node.name);
                  setDragging(node);
                }}
                onDragEnd={endDrag}
                onDragOver={node.kind === 'folder' ? dragOver(node.id) : undefined}
                onDrop={node.kind === 'folder' ? drop(node.id) : undefined}
                trailing={<MenuButton size="sm" label={`Actions for ${node.name}`} items={menuFor(node)} />}
              />
            ),
          )}
        </div>
      )}

      {dialog?.kind === 'move' && (
        <MoveDialog node={dialog.node} folders={folders} onClose={() => setDialog(null)} onMove={(targetId) => move(dialog.node, targetId).then(() => undefined)} />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={dialog.node.kind === 'folder' ? 'Delete folder' : 'Delete document'}
          message={deleteMessage(dialog.node, dialog.node.kind === 'folder' ? folderContents(dialog.node.id, folders, documents) : undefined)}
          confirmLabel={dialog.node.kind === 'folder' ? 'Delete folder' : 'Delete document'}
          onClose={() => setDialog(null)}
          onConfirm={() => remove(dialog.node)}
        />
      )}
    </div>
  );
}
```

`frontend/src/tree/tree.css`:

```css
.tree { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.tree-head { display: flex; align-items: center; justify-content: space-between; height: 40px; flex: none; padding: 0 var(--space-2) 0 var(--space-4); }
.tree-head h2 { margin: 0; font: 600 14px/20px var(--font-sans); color: var(--ink); }
.tree-head-actions { display: flex; gap: 2px; }
.tree-rows { flex: 1; padding: 0 var(--space-2) var(--space-4); border-radius: var(--radius-md); }
.tree-rows.is-drop-root { box-shadow: inset 0 0 0 1px var(--accent); }
.tree-rename { padding: 2px var(--space-2) 2px 0; }
.tree-rename .md-input { height: var(--control-sm); }
.tree-message { padding: 0 var(--space-2) var(--space-2); }
.move-targets { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; max-height: 280px; overflow: auto; }
.move-target { display: flex; align-items: center; gap: var(--space-2); height: var(--control-sm); padding-right: var(--space-2); border-radius: var(--radius-sm); color: var(--ink); cursor: pointer; }
.move-target:hover { background: var(--paper-sunken); }
.move-target input { margin: 0; accent-color: var(--accent); }
.move-target input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

`frontend/src/tree/index.ts`:

```ts
export { FileTree, type FileTreeProps } from './FileTree';
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/tree && npm run lint && npm run typecheck`
Expected: all tree tests pass. The `useEffect` in `FileTree` runs before the early return, satisfying rules-of-hooks — keep it above `if (!folders || !documents) return null;`.

- [ ] **Step 6: Update logs and commit**

```bash
git add frontend/src/tree context.md
git commit -m "feat(tree): project file tree with rename, duplicate, move, drag and delete

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Workspace screen

**Files:**
- Create: `frontend/src/app/Workspace.tsx`, `frontend/src/app/DocumentArea.tsx`
- Modify: `frontend/src/app/App.tsx` (add workspace routes)
- Test: `frontend/src/app/Workspace.test.tsx`

**Interfaces:**
- Consumes: `useDocumentDraft` (Task 8), `Editor` (Task 9), `render` (Task 6), `FileTree` (Task 11), `ThemeMenu`, `MissingPage` (Task 10), `store` hooks/settings, `ui`.
- Produces: `Workspace()` for routes `/p/:projectId` and `/p/:projectId/d/:docId`; `type ViewMode = 'split' | 'editor' | 'preview'`.

- [ ] **Step 1: Write the failing test** — `frontend/src/app/Workspace.test.tsx`

```tsx
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createDocument, createProject, getSetting, saveDocumentContent, SETTINGS } from '../store';
import { Workspace } from './Workspace';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Project list</p>} />
        <Route path="/p/:projectId" element={<Workspace />} />
        <Route path="/p/:projectId/d/:docId" element={<Workspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function projectWithDocument(content = '# Hello\n\nWorld') {
  const project = await createProject('OS');
  const doc = await createDocument(project.id, null, 'Intro');
  await saveDocumentContent(doc.id, content);
  return { project, doc };
}

beforeEach(clearDatabase);

describe('Workspace', () => {
  it('says so when the project is not in this browser', async () => {
    renderAt('/p/nope');
    expect(await screen.findByText('This project isn’t in this browser')).toBeInTheDocument();
  });

  it('shows the project name and an empty main area with no document open', async () => {
    const project = await createProject('OS');
    renderAt(`/p/${project.id}`);
    expect(await screen.findByText('OS')).toBeInTheDocument();
    expect(await screen.findByText('No document open')).toBeInTheDocument();
  });

  it('renders the open document in the preview and says it is saved locally', async () => {
    const { project, doc } = await projectWithDocument();
    renderAt(`/p/${project.id}/d/${doc.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Saved locally');
    expect(screen.getByRole('treeitem', { name: 'Intro.md' })).toHaveAttribute('aria-selected', 'true');
  });

  it('says so when the document is missing', async () => {
    const project = await createProject('OS');
    renderAt(`/p/${project.id}/d/nope`);
    expect(await screen.findByText('This document isn’t in this project')).toBeInTheDocument();
  });

  it('opens a document from the tree', async () => {
    const user = userEvent.setup();
    const { project } = await projectWithDocument('# From tree');
    renderAt(`/p/${project.id}`);
    await user.click(await screen.findByRole('treeitem', { name: 'Intro.md' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'From tree' })).toBeInTheDocument();
  });

  it('switches to preview-only and remembers it', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument();
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await user.click(await screen.findByRole('radio', { name: 'Preview' }));
    await waitFor(() => expect(container.querySelector('.ws-main')).toHaveClass('mode-preview'));
    expect(await getSetting(SETTINGS.mode, 'split')).toBe('preview');
  });

  it('returns to the project when the open document is deleted', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument();
    renderAt(`/p/${project.id}/d/${doc.id}`);
    await user.click(await screen.findByRole('button', { name: 'Actions for Intro.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(await screen.findByText('No document open')).toBeInTheDocument();
  });

  it('keeps Ctrl+S from reaching the browser anywhere on the page', async () => {
    const { project, doc } = await projectWithDocument();
    renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    const event = createEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('never renders unsafe HTML from a document', async () => {
    const { project, doc } = await projectWithDocument('<img src="x" onerror="window.__pwned = true">');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await waitFor(() => expect(container.querySelector('.md-prose img')).not.toBeNull());
    expect(container.querySelector('.md-prose img')?.getAttribute('onerror')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/app/Workspace.test.tsx`
Expected: FAIL — `./Workspace` not found.

- [ ] **Step 3: Implement**

`frontend/src/app/DocumentArea.tsx`:

```tsx
import { Editor } from '../editor';
import { EmptyState, Prose } from '../ui';
import type { DocumentDraft } from './useDocumentDraft';

export function DocumentArea({ docId, draft, html }: { docId: string | undefined; draft: DocumentDraft; html: string }) {
  if (draft.status === 'none') {
    return (
      <div className="ws-empty">
        <EmptyState icon="file" title="No document open">
          Open a document from the tree, or create one.
        </EmptyState>
      </div>
    );
  }
  if (draft.status === 'missing') {
    return (
      <div className="ws-empty">
        <EmptyState icon="info" title="This document isn’t in this project">
          It may have been deleted or moved to another project.
        </EmptyState>
      </div>
    );
  }
  if (draft.status === 'loading') return <div className="ws-empty" aria-busy="true" />;
  return (
    <>
      <section className="ws-editor" aria-label="Editor">
        <Editor key={docId} initialContent={draft.initialContent} onChange={draft.onChange} onSave={draft.saveNow} />
      </section>
      <section className="ws-preview" aria-label="Preview">
        <Prose html={html} />
      </section>
    </>
  );
}
```

`frontend/src/app/Workspace.tsx`:

```tsx
import { useCallback, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { render } from '../renderer';
import { SETTINGS, useProject, useSettingState } from '../store';
import { FileTree } from '../tree';
import { SaveStatus, SegmentedControl, Wordmark, type SegmentedOption } from '../ui';
import { DocumentArea } from './DocumentArea';
import { MissingPage } from './MissingPage';
import { ThemeMenu } from './ThemeMenu';
import { useDocumentDraft } from './useDocumentDraft';

export type ViewMode = 'split' | 'editor' | 'preview';

const VIEW_OPTIONS: ReadonlyArray<SegmentedOption<ViewMode>> = [
  { value: 'split', label: 'Split', icon: 'columns' },
  { value: 'editor', label: 'Editor', icon: 'pencil' },
  { value: 'preview', label: 'Preview', icon: 'eye' },
];

export function Workspace() {
  const { projectId = '', docId } = useParams();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const [mode, setMode] = useSettingState<ViewMode>(SETTINGS.mode, 'split');
  const draft = useDocumentDraft(docId);
  const { saveNow } = draft;
  const html = useMemo(() => render(draft.previewSource), [draft.previewSource]);

  // Ctrl/Cmd+S anywhere saves now and never opens the browser's "Save page" dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);

  const openDocument = useCallback((id: string) => navigate(`/p/${projectId}/d/${id}`), [navigate, projectId]);
  const closeDocument = useCallback(() => navigate(`/p/${projectId}`, { replace: true }), [navigate, projectId]);

  if (project === undefined) return <div className="ws" aria-busy="true" />;
  if (project === null) {
    return <MissingPage title="This project isn’t in this browser" text="It may have been deleted, or it was created in another browser." />;
  }

  return (
    <div className="ws">
      <header className="app-toolbar ws-toolbar">
        <div className="ws-left">
          <Link to="/" className="home-link" aria-label="All projects">
            <Wordmark />
          </Link>
          <span className="ws-crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="ws-project" title={project.name}>
            {project.name}
          </span>
        </div>
        <SegmentedControl label="View" value={mode} onChange={setMode} options={VIEW_OPTIONS} />
        <div className="ws-right">
          {draft.status === 'ready' && (
            <SaveStatus state={draft.saveState} detail={draft.saveState === 'failed' ? 'your last changes are only in this tab' : undefined} />
          )}
          <ThemeMenu />
        </div>
      </header>
      <div className="ws-body">
        <aside className="ws-tree" aria-label="Project files">
          <FileTree projectId={projectId} activeDocId={docId} onOpen={openDocument} onActiveDeleted={closeDocument} />
        </aside>
        <main className={`ws-main mode-${mode}`}>
          <DocumentArea docId={docId} draft={draft} html={html} />
        </main>
      </div>
    </div>
  );
}
```

Modify `frontend/src/app/App.tsx` — add the import and two routes above the `*` route:

```tsx
import { Workspace } from './Workspace';
```

```tsx
      <Route path="/p/:projectId" element={<Workspace />} />
      <Route path="/p/:projectId/d/:docId" element={<Workspace />} />
```

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: everything passes; build succeeds.

- [ ] **Step 5: Manual check in the dev server**

Run `npm run dev`. Create project "Operating Systems Notes" → folder "Scheduling" → document "Round-robin". Type:

```markdown
# Round-robin

- [x] quantum
- [ ] aging

| Process | Burst |
|---|---|
| P1 | 10 |
```

Expect: preview updates within ~150 ms; status shows "Saving…" then "Saved locally" about 1 s after typing stops; Ctrl+S saves at once with no browser dialog; Split / Editor / Preview switch; reload (F5) — the same document, content and view mode come back; delete the folder → confirmation names the document, workspace returns to "No document open". Stop the server.

- [ ] **Step 6: Update logs and commit**

```bash
git add frontend/src context.md
git commit -m "feat(app): workspace with tree, editor, live preview, modes and save status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Frontend container

**Files:**
- Create: `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx/default.conf`, `frontend/nginx/security-headers.conf`

**Interfaces:**
- Produces: image serving the SPA on port 80 with CSP and caching rules. Build: `docker build -t mdit-frontend frontend`.

- [ ] **Step 1: Write the files**

`frontend/.dockerignore`:

```text
node_modules
dist
coverage
*.log
.env*
```

`frontend/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.28-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`frontend/nginx/security-headers.conf` (included in every location because `add_header` in a location replaces inherited headers):

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
```

`frontend/nginx/default.conf`:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;
  server_tokens off;

  # Hashed build assets never change.
  location /assets/ {
    include /etc/nginx/snippets/security-headers.conf;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    try_files $uri =404;
  }

  # SPA: unknown paths fall back to index.html, which is always revalidated.
  location / {
    include /etc/nginx/snippets/security-headers.conf;
    add_header Cache-Control "no-cache" always;
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 2: Build and run**

Docker Desktop must be running (`docker info` must print a server version; if not, start Docker Desktop and retry). From the repo root:

```bash
docker build -t mdit-frontend:dev frontend
docker run -d --rm --name mdit-frontend -p 8080:80 mdit-frontend:dev
curl -sI http://localhost:8080/ | grep -iE "^(HTTP|content-security-policy|cache-control|x-content-type-options)"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/p/some-project/d/some-doc
```

Expected: `HTTP/1.1 200 OK`, the CSP header, `Cache-Control: no-cache`, `X-Content-Type-Options: nosniff`; deep link returns `200` (SPA fallback).

- [ ] **Step 3: Verify in a browser against the container**

Open http://localhost:8080. Repeat Task 12 Step 5 (create project → folder → document, type, reload, persists). Open DevTools Console: expect **no CSP violations** (fonts load from `/assets/`, CodeMirror styles apply). Then `docker stop mdit-frontend`.

If the console shows CSP violations, fix the policy minimally, re-run, and record the change in `decisions.md`.

- [ ] **Step 4: Update logs and commit**

```bash
git add frontend/Dockerfile frontend/.dockerignore frontend/nginx context.md decisions.md
git commit -m "feat(frontend): Nginx container with SPA fallback, CSP and caching

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: CI workflow, docs, push, pull request

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`, `context.md`, `decisions.md`

- [ ] **Step 1: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    paths:
      - 'frontend/**'
      - '.github/workflows/ci.yml'

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: Build image (no push)
        run: docker build -t mdit-frontend:ci .
```

- [ ] **Step 2: README**

Replace the `Status:` line in `README.md` with:

````markdown
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
````

- [ ] **Step 3: Final verification**

From `frontend/`: `npm ci && npm run lint && npm run typecheck && npm test && npm run build` — all green. Confirm no module outside `src/store/` imports Dexie: `grep -rn "from 'dexie" src | grep -v "^src/store/"` prints nothing. Confirm acceptance items 1–4 of the spec (§14) and write the evidence (command + result) into the `context.md` log.

- [ ] **Step 4: Logs**

In `context.md`: mark Phase 1 "Done — PR open" in the phase checklist, set **Current state** to "Phase 1 complete; awaiting PR review/merge; next: Phase 2 brainstorming", add the log line. Make sure `decisions.md` contains P-012…P-018 (recorded during planning) plus anything added during execution.

- [ ] **Step 5: Commit, push, open PR**

```bash
git add .github README.md context.md decisions.md
git commit -m "ci: frontend lint, typecheck, test, build and image build on PRs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin main
git push -u origin phase-1-local-editor
```

`gh auth status` must succeed first (at planning time the stored token for `pavannaik2004` was invalid — ask the user to run `gh auth login` if it still fails). Then:

```bash
gh pr create --base main --head phase-1-local-editor --title "Phase 1: local editor" --body "$(cat <<'EOF'
## Summary
- Browser-only md.IT workspace: projects, nested folders and Markdown documents in IndexedDB (Dexie)
- CodeMirror 6 editor, live markdown-it preview sanitized with DOMPurify, split/editor/preview modes
- Autosave (1 s) with "Saved locally" status, Ctrl/Cmd+S, persistent-storage request and warning
- md.IT design system ported to typed React components; light and dark themes
- Nginx container with CSP; CI runs lint, typecheck, tests, build and image build

Spec: docs/superpowers/specs/2026-09-26-phase-1-local-editor-design.md
Plan: docs/superpowers/plans/2026-09-26-phase-1-local-editor.md

## Test plan
- [ ] CI green
- [ ] `docker run -p 8080:80` image: create project → folder → document, edit, reload, content persists
- [ ] Delete a folder containing the open document: confirmation lists contents, workspace returns to "No document open"

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Add it to the `context.md` log and commit + push that one-line change.

