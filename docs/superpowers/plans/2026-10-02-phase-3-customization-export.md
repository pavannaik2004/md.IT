# Phase 3 — Customization and export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Writers can tune how documents render, see an outline and statistics, search the project, export a document as Markdown, self-contained HTML or PDF, move whole projects in and out as .zip files, and reload md.IT with no network.

**Architecture:** Rendering settings are one workspace-wide settings row, turned into `--doc-*` CSS variables on the preview's `.md-prose` element. The pure renderer gains `analyze(markdown)` (outline and statistics from the same markdown-it token stream), and `search/` is a pure function over the store's live queries. `export/` builds the HTML export from the same `render()` + `renderDiagrams()` + CSS as the preview. Fonts, images and CSS are inlined, and PDF prints that HTML from a hidden iframe. Project zips are written and read with fflate. A store function imports a parsed zip in one transaction. vite-plugin-pwa precaches the build for offline reload.

**Tech Stack:** existing (Vite 8, React 18.3, TS 6.0, markdown-it 15, DOMPurify 3, KaTeX 0.18, Mermaid 11.17, Dexie 4, CodeMirror 6, Vitest 5 + jsdom 29 + fake-indexeddb) plus fflate 0.8.3 (zip) and vite-plugin-pwa 1.3.0.

**Spec:** `docs/superpowers/specs/2026-10-02-phase-3-customization-export-design.md` (read it with this plan). Decisions P-031…P-042 in `decisions.md`. Design system snapshot: `docs/design-system/`.

## Global Constraints

- All commands run from `frontend/` unless a step says otherwise. Shell is Git Bash on Windows; use forward slashes.
- **Progress logging (CLAUDE.md):** before a task, read `context.md` and the recent `decisions.md` entries. After it, append `2026-10-02 — Task N: <what> (<files>; <tests total>)` (use the real date) to the **Log**, update **Current state**, add any new decision to `decisions.md`, and commit those edits with the task's code.
- Branch `phase-3-customization-export`; never commit to `main`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Only `src/store/` imports `dexie` / `dexie-react-hooks` (ESLint enforces it).
- `src/renderer/`, `src/paths/` and `src/search/search.ts` are pure: no DOM access beyond DOMPurify, no CSS imports, and only type imports from other app modules.
- `src/export/` may import `store`, `renderer`, `paths`, `settings` and `preview/mermaid`. `app/` wires everything.
- UI copy: sentence case, no emoji or exclamation marks, curly quotes and apostrophes (`“” ’`), product name **md.IT**. The exact strings in this plan come from the spec; don't reword them.
- Colors, fonts and sizes come from tokens (`src/ui/tokens.css`) only. Component styles the design system lacks go in the "app extensions" block at the end of `src/ui/components.css`, and P-013 lists them. Layout styles go in `src/app/app.css`.
- Rendering defaults: serif, `0em`, `1.65`, `0px`, `48px`. Limits: letter spacing −0.05 to 0.15em step 0.01; line height 1.2 to 2.2 step 0.05; margin and padding 0 to 96px step 4.
- Zip import limits: 2,000 entries, 500 MB uncompressed in total, 5 MB per image (`MAX_IMAGE_BYTES`).
- Mermaid always runs with `securityLevel: 'strict'`. Inline `style` and `<style>` from documents stay stripped (P-020).
- Preview debounce stays 150 ms; autosave 1000 ms; settings write 200 ms; search 120 ms.
- Checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Every task ends with all four green.

## Review Focus

1. **A zip made by another tool**: backslash paths, a `__MACOSX/` folder, `.DS_Store`, everything inside one top folder, a `../` entry and a `.txt` file. It imports cleanly, unsafe and junk entries never reach the store, and the dialog lists what was skipped. Test: Task 13 `imports a zip made by another tool`.
2. **Exporting while the app is in dark mode**: the HTML export is light, including Mermaid's colours, which must come from the light tokens rather than the live dark `:root`. Test: Task 10 `colours diagrams from the light tokens even in dark mode`.
3. **Exporting right after typing**: the export contains the last keystrokes, not the 150 ms-old preview source or the last autosave. Test: Task 15 `exports the text typed just now`.
4. **Names that differ only by case inside a zip** (`Notes.md` and `notes.md` in one folder): both import, the second as `notes 2.md`, and the dialog says a name changed. Test: Task 13 `renames names that clash ignoring case`.
5. **Search text with regex characters** (`C++ (beta)`, `$x$`, `[a]`): no exception, and the literal text is found. Test: Task 6 `treats the query as plain text`.

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `src/settings/rendering.ts`, `useRenderingSettings.ts`; `src/store/settings.ts` | 1 | settings type, defaults, limits, clamp, CSS variables; hook; settings keys |
| `src/ui/RangeField.tsx`, `src/settings/SettingsPanel.tsx`, `src/preview/Preview.tsx`, `src/app/DocumentArea.tsx`, `Workspace.tsx` | 2 | slider, settings panel, settings applied to the preview |
| `src/renderer/md.ts`, `headings.ts`, `analyze.ts`, `render.ts`, `index.ts` | 3 | shared markdown-it instance, `data-line` on headings, outline + stats |
| `src/editor/Editor.tsx` | 4 | `revealLine`, `select`, `getText` on the handle |
| `src/app/SidePanel.tsx`, `src/outline/OutlinePanel.tsx`, `StatsPanel.tsx`, `src/app/Workspace.tsx`, `app.css` | 5 | right panel with outline, stats and settings |
| `src/search/search.ts` | 6 | pure project search |
| `src/search/SearchBox.tsx`, `SearchResults.tsx`, `search.css`, `src/tree/FileTree.tsx`, `src/app/Workspace.tsx` | 7 | search UI, tree reveal, select match in editor |
| `src/paths/renderContext.ts`, `src/app/useProjectFiles.ts`, `src/preview/mermaid.ts` | 8 | shared render context; Mermaid colours from a token reader |
| `src/export/base64.ts`, `files.ts`, `assets.ts` | 9 | base64, safe file names, font-face selection, CSS url inlining |
| `src/store/snapshot.ts`, `src/export/html.ts`, `exportDeps.ts` | 10 | project snapshot; self-contained HTML export |
| `src/export/print.ts` | 11 | print through a hidden iframe |
| `src/export/zip.ts`; `src/store/snapshot.test.ts` | 12 | zip export (fflate); snapshot tests |
| `src/export/importZip.ts` | 13 | zip parsing and checks |
| `src/store/importProject.ts`, `src/export/roundTrip.test.ts` | 14 | atomic import; round trip |
| `src/export/download.ts`, `actions.ts`, `src/app/ExportMenu.tsx`, `Workspace.tsx` | 15 | Export menu and actions |
| `src/app/ImportDialog.tsx`, `ProjectList.tsx` | 16 | Import project, Export .zip |
| `vite.config.ts`, `src/app/UpdateNotice.tsx`, `App.tsx`, `src/vite-env.d.ts`, `src/test/pwa-register.ts` | 17 | service worker and update notice |
| `README.md`, `context.md`, `decisions.md` | 18 | verification and docs |

---

### Task 1: Rendering settings model

**Files:**
- Create: `src/settings/rendering.ts`, `src/settings/useRenderingSettings.ts`, `src/settings/index.ts`
- Modify: `src/store/settings.ts`
- Test: `src/settings/rendering.test.ts`, `src/settings/useRenderingSettings.test.tsx`

**Interfaces:**
- Consumes: `useSetting`, `setSetting`, `SETTINGS` (`src/store`); `debounce` (`src/lib/debounce.ts`).
- Produces (from `src/settings/index.ts`):
  - `type DocFont = 'serif' | 'sans' | 'mono'`
  - `interface RenderingSettings { font: DocFont; letterSpacing: number; lineHeight: number; margin: number; padding: number }`
  - `type NumericSetting = 'letterSpacing' | 'lineHeight' | 'margin' | 'padding'`
  - `DEFAULT_RENDERING: RenderingSettings`, `RENDERING_LIMITS: Record<NumericSetting, { min: number; max: number; step: number }>`
  - `clampRendering(value: unknown): RenderingSettings`, `sameRendering(a, b): boolean`, `formatSetting(key: NumericSetting, value: number): string`, `toCssVars(s: RenderingSettings): Record<string, string>`
  - `useRenderingSettings(): [RenderingSettings, (patch: Partial<RenderingSettings>) => void, () => void]`
  - `SETTINGS.rendering = 'doc.rendering'`, `SETTINGS.panel = 'ui.panel'`, `SETTINGS.panelTab = 'ui.panelTab'`

- [ ] **Step 1: Write the failing tests** — `src/settings/rendering.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { clampRendering, DEFAULT_RENDERING, formatSetting, sameRendering, toCssVars } from './rendering';

describe('rendering settings', () => {
  it('match the design-system tokens by default', () => {
    expect(DEFAULT_RENDERING).toEqual({ font: 'serif', letterSpacing: 0, lineHeight: 1.65, margin: 0, padding: 48 });
  });

  it('fall back to the defaults for anything that is not an object', () => {
    for (const value of [undefined, null, 42, 'x', []]) expect(clampRendering(value)).toEqual(DEFAULT_RENDERING);
  });

  it('keep valid fields and replace invalid ones with defaults', () => {
    expect(clampRendering({ font: 'mono', lineHeight: 1.8, padding: 'wide', margin: Number.NaN })).toEqual({
      ...DEFAULT_RENDERING,
      font: 'mono',
      lineHeight: 1.8,
    });
    expect(clampRendering({ font: 'comic' }).font).toBe('serif');
  });

  it('clamp to the limits and snap to the step', () => {
    expect(clampRendering({ letterSpacing: 1, lineHeight: 0.5, margin: -10, padding: 1000 })).toEqual({
      ...DEFAULT_RENDERING,
      letterSpacing: 0.15,
      lineHeight: 1.2,
      margin: 0,
      padding: 96,
    });
    expect(clampRendering({ lineHeight: 1.67, padding: 49, letterSpacing: 0.013 })).toMatchObject({ lineHeight: 1.65, padding: 48, letterSpacing: 0.01 });
  });

  it('format values with their units', () => {
    expect(formatSetting('letterSpacing', 0)).toBe('0em');
    expect(formatSetting('letterSpacing', -0.05)).toBe('-0.05em');
    expect(formatSetting('lineHeight', 1.7)).toBe('1.7');
    expect(formatSetting('margin', 8)).toBe('8px');
  });

  it('become the --doc-* variables', () => {
    expect(toCssVars({ font: 'sans', letterSpacing: 0.02, lineHeight: 1.8, margin: 8, padding: 32 })).toEqual({
      '--doc-font': 'var(--font-sans)',
      '--doc-letter-spacing': '0.02em',
      '--doc-line-height': '1.8',
      '--doc-margin': '8px',
      '--doc-padding': '32px',
    });
  });

  it('compare by value', () => {
    expect(sameRendering(DEFAULT_RENDERING, { ...DEFAULT_RENDERING })).toBe(true);
    expect(sameRendering(DEFAULT_RENDERING, { ...DEFAULT_RENDERING, margin: 4 })).toBe(false);
  });
});
```

`src/settings/useRenderingSettings.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, getSetting, setSetting, SETTINGS } from '../store';
import { DEFAULT_RENDERING } from './rendering';
import { useRenderingSettings } from './useRenderingSettings';

beforeEach(clearDatabase);

describe('useRenderingSettings', () => {
  it('reads the stored settings', async () => {
    await setSetting(SETTINGS.rendering, { ...DEFAULT_RENDERING, lineHeight: 2 });
    const { result } = renderHook(() => useRenderingSettings());
    await waitFor(() => expect(result.current[0].lineHeight).toBe(2));
  });

  it('cleans a bad stored value', async () => {
    await setSetting(SETTINGS.rendering, { font: 'comic', padding: 999 });
    const { result } = renderHook(() => useRenderingSettings());
    await waitFor(() => expect(result.current[0].padding).toBe(96));
    expect(result.current[0].font).toBe('serif');
  });

  it('applies a change at once and stores it shortly after', async () => {
    const { result } = renderHook(() => useRenderingSettings());
    act(() => result.current[1]({ padding: 24 }));
    expect(result.current[0].padding).toBe(24);
    await waitFor(async () => expect(await getSetting(SETTINGS.rendering, null)).toMatchObject({ padding: 24 }));
    expect(result.current[0].padding).toBe(24);
  });

  it('resets to the defaults', async () => {
    await setSetting(SETTINGS.rendering, { ...DEFAULT_RENDERING, margin: 40 });
    const { result } = renderHook(() => useRenderingSettings());
    await waitFor(() => expect(result.current[0].margin).toBe(40));
    act(() => result.current[2]());
    expect(result.current[0]).toEqual(DEFAULT_RENDERING);
    await waitFor(async () => expect(await getSetting(SETTINGS.rendering, null)).toEqual(DEFAULT_RENDERING));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/settings`
Expected: FAIL, because `./rendering` and `./useRenderingSettings` don't exist.

- [ ] **Step 3: Implement**

`src/store/settings.ts`, the `SETTINGS` object becomes:

```ts
export const SETTINGS = {
  mode: 'ui.mode',
  theme: 'ui.theme',
  storageWarningDismissed: 'ui.storageWarningDismissed',
  panel: 'ui.panel',
  panelTab: 'ui.panelTab',
  rendering: 'doc.rendering',
} as const;
```

`src/settings/rendering.ts`:

```ts
export type DocFont = 'serif' | 'sans' | 'mono';

export interface RenderingSettings {
  font: DocFont;
  /** em */
  letterSpacing: number;
  lineHeight: number;
  /** px */
  margin: number;
  /** px */
  padding: number;
}

export type NumericSetting = Exclude<keyof RenderingSettings, 'font'>;

/** The design system's --doc-* token defaults (ui/tokens.css). */
export const DEFAULT_RENDERING: RenderingSettings = { font: 'serif', letterSpacing: 0, lineHeight: 1.65, margin: 0, padding: 48 };

export const RENDERING_LIMITS: Readonly<Record<NumericSetting, { min: number; max: number; step: number }>> = {
  letterSpacing: { min: -0.05, max: 0.15, step: 0.01 },
  lineHeight: { min: 1.2, max: 2.2, step: 0.05 },
  margin: { min: 0, max: 96, step: 4 },
  padding: { min: 0, max: 96, step: 4 },
};

const FONTS: readonly DocFont[] = ['serif', 'sans', 'mono'];
const NUMERIC: readonly NumericSetting[] = ['letterSpacing', 'lineHeight', 'margin', 'padding'];

function snap(value: number, { min, max, step }: { min: number; max: number; step: number }): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Number((min + Math.round((clamped - min) / step) * step).toFixed(4));
}

/** Anything (a stored row, an imported mdit.json) → valid settings; bad fields fall back to the defaults. */
export function clampRendering(value: unknown): RenderingSettings {
  const raw = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const result: RenderingSettings = { ...DEFAULT_RENDERING };
  if (FONTS.includes(raw.font as DocFont)) result.font = raw.font as DocFont;
  for (const key of NUMERIC) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) result[key] = snap(v, RENDERING_LIMITS[key]);
  }
  return result;
}

export function sameRendering(a: RenderingSettings, b: RenderingSettings): boolean {
  return a.font === b.font && NUMERIC.every((key) => a[key] === b[key]);
}

export function formatSetting(key: NumericSetting, value: number): string {
  const n = String(Number(value.toFixed(2)));
  if (key === 'letterSpacing') return `${n}em`;
  if (key === 'lineHeight') return n;
  return `${n}px`;
}

/** Set on the preview's .md-prose element (which defines --doc-font itself) and on exports. */
export function toCssVars(s: RenderingSettings): Record<string, string> {
  return {
    '--doc-font': `var(--font-${s.font})`,
    '--doc-letter-spacing': formatSetting('letterSpacing', s.letterSpacing),
    '--doc-line-height': formatSetting('lineHeight', s.lineHeight),
    '--doc-margin': formatSetting('margin', s.margin),
    '--doc-padding': formatSetting('padding', s.padding),
  };
}
```

`src/settings/useRenderingSettings.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { debounce } from '../lib/debounce';
import { setSetting, SETTINGS, useSetting } from '../store';
import { clampRendering, DEFAULT_RENDERING, sameRendering, type RenderingSettings } from './rendering';

export type RenderingControls = [
  settings: RenderingSettings,
  update: (patch: Partial<RenderingSettings>) => void,
  reset: () => void,
];

/** Call once per screen and pass the result down: changes show at once, the row is written 200 ms after the last one. */
export function useRenderingSettings(): RenderingControls {
  const stored = useSetting<unknown>(SETTINGS.rendering, null);
  const saved = useMemo(() => clampRendering(stored), [stored]);
  const [pending, setPending] = useState<RenderingSettings | null>(null);
  const writer = useMemo(() => debounce((next: RenderingSettings) => void setSetting(SETTINGS.rendering, next), 200), []);
  useEffect(() => () => writer.flush(), [writer]);

  // Drop the local copy once the stored row has caught up, so later changes from elsewhere show.
  useEffect(() => {
    if (pending && sameRendering(pending, saved)) setPending(null);
  }, [pending, saved]);

  const settings = pending ?? saved;
  const update = useCallback(
    (patch: Partial<RenderingSettings>) => {
      const next = clampRendering({ ...settings, ...patch });
      setPending(next);
      writer(next);
    },
    [settings, writer],
  );
  const reset = useCallback(() => {
    setPending(DEFAULT_RENDERING);
    writer(DEFAULT_RENDERING);
  }, [writer]);
  return [settings, update, reset];
}
```

`src/settings/index.ts`:

```ts
export {
  clampRendering, DEFAULT_RENDERING, formatSetting, RENDERING_LIMITS, sameRendering, toCssVars,
  type DocFont, type NumericSetting, type RenderingSettings,
} from './rendering';
export { useRenderingSettings, type RenderingControls } from './useRenderingSettings';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/settings src/store/settings.test.ts`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

Run: `npm test && npm run lint && npm run typecheck && npm run build`. Log Task 1 in `context.md`.

```bash
git add src/settings src/store/settings.ts ../context.md
git commit -m "feat(settings): rendering settings model, limits and hook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Settings panel and settings applied to the preview

**Files:**
- Create: `src/ui/RangeField.tsx`, `src/settings/SettingsPanel.tsx`, `src/settings/settings.css`
- Modify: `src/ui/index.ts`, `src/settings/index.ts`, `src/preview/Preview.tsx`, `src/app/DocumentArea.tsx`, `src/app/Workspace.tsx`
- Test: `src/ui/RangeField.test.tsx`, `src/settings/SettingsPanel.test.tsx`, `src/preview/Preview.test.tsx`, `src/app/Workspace.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`RenderingSettings`, `RENDERING_LIMITS`, `formatSetting`, `toCssVars`, `sameRendering`, `DEFAULT_RENDERING`, `useRenderingSettings`).
- Produces:
  - `RangeField(props: { label: string; min: number; max: number; step?: number; value: number; unit?: string; format?: (v: number) => string; onChange: (v: number) => void })` from `src/ui`
  - `SettingsPanel(props: { value: RenderingSettings; onChange: (patch: Partial<RenderingSettings>) => void; onReset: () => void })` from `src/settings`
  - `PreviewProps.style?: CSSProperties` and `DocumentAreaProps.proseStyle?: CSSProperties`
  - In `Workspace`: `const [rendering, updateRendering, resetRendering] = useRenderingSettings()` and `proseStyle`. Later tasks use these names.

- [ ] **Step 1: Write the failing tests**

`src/ui/RangeField.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RangeField } from './RangeField';

describe('RangeField', () => {
  it('labels the slider, shows the formatted value and reports changes as numbers', () => {
    const onChange = vi.fn();
    render(<RangeField label="Line height" min={1.2} max={2.2} step={0.05} value={1.65} format={(v) => v.toFixed(2)} onChange={onChange} />);
    const slider = screen.getByRole('slider', { name: 'Line height' });
    expect(slider).toHaveValue('1.65');
    expect(screen.getByText('1.65')).toBeInTheDocument();
    fireEvent.change(slider, { target: { value: '1.8' } });
    expect(onChange).toHaveBeenCalledWith(1.8);
  });

  it('fills the track up to the value and uses the unit without a formatter', () => {
    render(<RangeField label="Padding" min={0} max={96} step={4} value={48} unit="px" onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: 'Padding' }).style.getPropertyValue('--pct')).toBe('50%');
    expect(screen.getByText('48px')).toBeInTheDocument();
  });
});
```

`src/settings/SettingsPanel.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RENDERING, type RenderingSettings } from './rendering';
import { SettingsPanel } from './SettingsPanel';

function setup(value: RenderingSettings = DEFAULT_RENDERING) {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(<SettingsPanel value={value} onChange={onChange} onReset={onReset} />);
  return { onChange, onReset };
}

describe('SettingsPanel', () => {
  it('changes the font', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    expect(screen.getByRole('radio', { name: 'Serif' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'Mono' }));
    expect(onChange).toHaveBeenCalledWith({ font: 'mono' });
  });

  it('changes each number', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByRole('slider', { name: 'Letter spacing' }), { target: { value: '0.02' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Line height' }), { target: { value: '1.8' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Margin' }), { target: { value: '16' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Padding' }), { target: { value: '32' } });
    expect(onChange.mock.calls).toEqual([[{ letterSpacing: 0.02 }], [{ lineHeight: 1.8 }], [{ margin: 16 }], [{ padding: 32 }]]);
  });

  it('shows values with their units', () => {
    setup({ ...DEFAULT_RENDERING, letterSpacing: 0.02 });
    expect(screen.getByText('0.02em')).toBeInTheDocument();
    expect(screen.getByText('1.65')).toBeInTheDocument();
    expect(screen.getByText('0px')).toBeInTheDocument();
    expect(screen.getByText('48px')).toBeInTheDocument();
  });

  it('can’t reset when nothing changed', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled();
  });

  it('resets when something changed', async () => {
    const user = userEvent.setup();
    const { onReset } = setup({ ...DEFAULT_RENDERING, padding: 16 });
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
```

In `src/preview/Preview.test.tsx`, add `import type { CSSProperties } from 'react';` and this test inside `describe('Preview')`:

```tsx
  it('puts the rendering variables on the prose element', () => {
    render(
      <Preview html="<p>x</p>" theme="light" style={{ '--doc-padding': '12px' } as CSSProperties} onOpenDocument={vi.fn()} onNotice={vi.fn()} />,
    );
    expect(document.querySelector<HTMLElement>('.md-prose')!.style.getPropertyValue('--doc-padding')).toBe('12px');
  });
```

In `src/app/Workspace.test.tsx`, add `setSetting` to the `../store` import and this test:

```tsx
  it('applies the rendering settings to the preview', async () => {
    const { project, doc } = await projectWithDocument();
    await setSetting(SETTINGS.rendering, { font: 'sans', letterSpacing: 0, lineHeight: 2, margin: 0, padding: 16 });
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    const prose = () => container.querySelector<HTMLElement>('.md-prose')!;
    await waitFor(() => expect(prose().style.getPropertyValue('--doc-line-height')).toBe('2'));
    expect(prose().style.getPropertyValue('--doc-font')).toBe('var(--font-sans)');
    expect(prose().style.getPropertyValue('--doc-padding')).toBe('16px');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/ui/RangeField.test.tsx src/settings src/preview/Preview.test.tsx src/app/Workspace.test.tsx`
Expected: FAIL. `RangeField` and `SettingsPanel` don't exist, and the prose element has no variables.

- [ ] **Step 3: Implement**

`src/ui/RangeField.tsx` (ported from `docs/design-system/bundle.js:122`, typed and controlled):

```tsx
import { useId, type CSSProperties } from 'react';

export interface RangeFieldProps {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export function RangeField({ label, min, max, step = 1, value, unit = '', format, onChange }: RangeFieldProps) {
  const id = useId();
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  const text = format ? format(value) : `${value}${unit}`;
  return (
    <div className="md-range">
      <div className="md-range-head">
        <label htmlFor={id} className="md-field-label">
          {label}
        </label>
        <output htmlFor={id} className="md-range-value">
          {text}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(event) => onChange(parseFloat(event.currentTarget.value))}
      />
    </div>
  );
}
```

Add to `src/ui/index.ts` (keep alphabetical order): `export { RangeField, type RangeFieldProps } from './RangeField';`

`src/settings/SettingsPanel.tsx`:

```tsx
import { Button, RangeField, SegmentedControl, type SegmentedOption } from '../ui';
import { DEFAULT_RENDERING, formatSetting, RENDERING_LIMITS, sameRendering, type DocFont, type NumericSetting, type RenderingSettings } from './rendering';
import './settings.css';

const FONT_OPTIONS: ReadonlyArray<SegmentedOption<DocFont>> = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans' },
  { value: 'mono', label: 'Mono' },
];

const FIELDS: ReadonlyArray<[NumericSetting, string]> = [
  ['letterSpacing', 'Letter spacing'],
  ['lineHeight', 'Line height'],
  ['margin', 'Margin'],
  ['padding', 'Padding'],
];

export interface SettingsPanelProps {
  value: RenderingSettings;
  onChange: (patch: Partial<RenderingSettings>) => void;
  onReset: () => void;
}

export function SettingsPanel({ value, onChange, onReset }: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <h3 className="panel-heading">Rendering</h3>
      <div className="settings-font">
        <span className="md-field-label" aria-hidden="true">
          Font
        </span>
        <SegmentedControl label="Font" value={value.font} options={FONT_OPTIONS} onChange={(font) => onChange({ font })} />
      </div>
      {FIELDS.map(([key, label]) => (
        <RangeField
          key={key}
          label={label}
          {...RENDERING_LIMITS[key]}
          value={value[key]}
          format={(v) => formatSetting(key, v)}
          onChange={(v) => onChange({ [key]: v } as Partial<RenderingSettings>)}
        />
      ))}
      <p className="panel-caption">Applies to every document in this browser and to exports.</p>
      <div>
        <Button size="sm" disabled={sameRendering(value, DEFAULT_RENDERING)} onClick={onReset}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
```

`src/settings/settings.css`:

```css
.settings-panel { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-4); }
.settings-font { display: flex; flex-direction: column; gap: var(--space-2); }
.panel-heading { margin: 0; font: 600 14px/20px var(--font-sans); color: var(--ink); }
.panel-caption { margin: 0; font: 400 12px/16px var(--font-sans); color: var(--ink-muted); }
```

Add to `src/settings/index.ts`: `export { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';`

`src/preview/Preview.tsx`: add `style?: CSSProperties;` to `PreviewProps` (import `type CSSProperties` from `react`), take `style` in the props, and render `<Prose html={html} style={style} />`.

`src/app/DocumentArea.tsx`: add `proseStyle?: CSSProperties;` to `DocumentAreaProps` (import `type CSSProperties` from `react`), take it in the function's props, and pass `style={proseStyle}` to `<Preview … />`.

`src/app/Workspace.tsx`:
- imports: `type CSSProperties` and the existing names from `react`; `{ toCssVars, useRenderingSettings }` from `../settings`
- after `const theme = useResolvedTheme();` add:

```tsx
  const [rendering] = useRenderingSettings();
  const proseStyle = useMemo(() => toCssVars(rendering) as CSSProperties, [rendering]);
```

- pass `proseStyle={proseStyle}` to `<DocumentArea … />`

(Task 5 changes the first line to `const [rendering, updateRendering, resetRendering] = useRenderingSettings();` once the settings panel uses them.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/ui src/settings src/preview src/app/Workspace.test.tsx`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

Run all four checks. Log Task 2. (RangeField, a controlled port with `aria-valuetext`, is added to P-013's list of app extensions in Task 18.)

```bash
git add src ../context.md ../decisions.md
git commit -m "feat(settings): settings panel, RangeField, and settings applied to the preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Renderer — headings carry their line; outline and statistics

**Files:**
- Create: `src/renderer/md.ts`, `src/renderer/headings.ts`, `src/renderer/analyze.ts`
- Modify: `src/renderer/render.ts`, `src/renderer/index.ts`
- Test: `src/renderer/analyze.test.ts`, `src/renderer/render.test.ts`

**Interfaces:**
- Consumes: the existing rules (`links`, `images`, `codeBlocks`, `math`, task lists).
- Produces (from `src/renderer/index.ts`):
  - `analyze(markdown: string): Analysis`
  - `interface OutlineHeading { level: number; text: string; line: number }` (line is 0-based)
  - `interface DocumentStats { words: number; characters: number; headings: number; codeBlocks: number; diagrams: number; math: number; images: number; links: number; readingMinutes: number }`
  - `interface Analysis { headings: OutlineHeading[]; stats: DocumentStats }`
  - `escapeHtml(text: string): string` (now exported from the index)
  - rendered headings look like `<h2 data-line="4">…</h2>`

- [ ] **Step 1: Write the failing tests** — `src/renderer/analyze.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';

describe('analyze', () => {
  it('lists headings with level, plain text and source line', () => {
    expect(analyze('# Intro\n\nText\n\n## Use `npm` *now*\n\n### \n').headings).toEqual([
      { level: 1, text: 'Intro', line: 0 },
      { level: 2, text: 'Use npm now', line: 4 },
      { level: 3, text: '', line: 6 },
    ]);
  });

  it('counts words in prose and inline code, not in code blocks, diagrams or math', () => {
    const source = [
      '# Two words',
      '',
      'Three more `words` here.',
      '',
      '```js',
      'skip me',
      '```',
      '',
      '```mermaid',
      'flowchart TD',
      '```',
      '',
      'x $a + b$ y',
      '',
      'It’s well-known.',
    ].join('\n');
    expect(analyze(source).stats.words).toBe(10);
  });

  it('counts headings, code blocks, diagrams, math, images and links', () => {
    const source = [
      '# A',
      '## B',
      '',
      '```js',
      'x',
      '```',
      '',
      '    indented',
      '',
      '```mermaid',
      'flowchart TD',
      '```',
      '',
      '$x$ and $y$',
      '',
      '$$',
      'z',
      '$$',
      '',
      '![one](a.png) ![two](https://example.com/b.png)',
      '',
      '[link](Other.md) and https://example.com',
    ].join('\n');
    expect(analyze(source).stats).toMatchObject({ headings: 2, codeBlocks: 2, diagrams: 1, math: 3, images: 2, links: 2 });
  });

  it('counts characters as code points of the source', () => {
    expect(analyze('héllo 👋').stats.characters).toBe(7);
  });

  it('estimates reading time at 225 words a minute', () => {
    expect(analyze('').stats.readingMinutes).toBe(0);
    expect(analyze('word '.repeat(225)).stats.readingMinutes).toBe(1);
    expect(analyze('word '.repeat(226)).stats.readingMinutes).toBe(2);
  });

  it('returns empty results for an empty document', () => {
    expect(analyze('')).toEqual({
      headings: [],
      stats: { words: 0, characters: 0, headings: 0, codeBlocks: 0, diagrams: 0, math: 0, images: 0, links: 0, readingMinutes: 0 },
    });
  });
});
```

In `src/renderer/render.test.ts`, add:

```ts
  it('marks headings with their source line', () => {
    const html = render('# One\n\ntext\n\n## Two');
    expect(html).toContain('<h1 data-line="0">One</h1>');
    expect(html).toContain('<h2 data-line="4">Two</h2>');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/renderer`
Expected: FAIL. `./analyze` is missing, and headings have no `data-line`.

- [ ] **Step 3: Implement**

`src/renderer/headings.ts`:

```ts
import type { MarkdownIt } from 'markdown-it';

/** `data-line` = 0-based source line, so the outline can scroll the preview to a heading without ids (P-040). */
export function headings(md: MarkdownIt): void {
  const base = md.renderer.rules.heading_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    if (token.map) token.attrSet('data-line', String(token.map[0]));
    return base(tokens, idx, options, env, self);
  };
}
```

`src/renderer/md.ts` (the instance moves here from `render.ts`):

```ts
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import { codeBlocks } from './code';
import { headings } from './headings';
import { images } from './images';
import { links } from './links';
import { math } from './math';

/** The one markdown-it instance: render() and analyze() must parse identically. */
export const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(taskLists, { enabled: false });
md.use(links);
md.use(images);
md.use(codeBlocks);
md.use(math);
md.use(headings);
```

`src/renderer/render.ts`: delete the `MarkdownIt`, `taskLists`, `codeBlocks`, `images` and `links` imports, the `const md = …` line and the five `md.use(…)` lines. Add `import { md } from './md';`, and change `import { math, spliceMath } from './math';` to `import { spliceMath } from './math';`. The rest stays unchanged.

`src/renderer/analyze.ts`:

```ts
import { md } from './md';

type Token = ReturnType<typeof md.parse>[number];

export interface OutlineHeading {
  level: number;
  text: string;
  /** 0-based source line, the same as the heading's data-line in the preview. */
  line: number;
}

export interface DocumentStats {
  words: number;
  characters: number;
  headings: number;
  codeBlocks: number;
  diagrams: number;
  math: number;
  images: number;
  links: number;
  readingMinutes: number;
}

export interface Analysis {
  headings: OutlineHeading[];
  stats: DocumentStats;
}

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const WORDS_PER_MINUTE = 225;

const countWords = (text: string) => text.match(WORD)?.length ?? 0;

/** Plain text of an inline token's children: text, inline code and inline math, without markup. */
function inlineText(children: readonly Token[]): string {
  return children.map((child) => (['text', 'code_inline', 'math_inline'].includes(child.type) ? child.content : '')).join('');
}

function emptyStats(markdown: string): DocumentStats {
  return { words: 0, characters: [...markdown].length, headings: 0, codeBlocks: 0, diagrams: 0, math: 0, images: 0, links: 0, readingMinutes: 0 };
}

/** Outline and statistics from the same token stream the preview renders. Never throws. */
export function analyze(markdown: string): Analysis {
  const stats = emptyStats(markdown);
  const headings: OutlineHeading[] = [];
  let tokens: Token[];
  try {
    tokens = md.parse(markdown, {});
  } catch {
    return { headings, stats };
  }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    switch (token.type) {
      case 'heading_open': {
        const inline = tokens[i + 1];
        headings.push({
          level: Number(token.tag.slice(1)),
          text: inline?.type === 'inline' ? inlineText(inline.children ?? []).trim() : '',
          line: token.map?.[0] ?? 0,
        });
        stats.headings++;
        break;
      }
      case 'fence':
        if ((token.info.trim().split(/\s+/)[0] ?? '').toLowerCase() === 'mermaid') stats.diagrams++;
        else stats.codeBlocks++;
        break;
      case 'code_block':
        stats.codeBlocks++;
        break;
      case 'math_block':
        stats.math++;
        break;
      case 'inline':
        for (const child of token.children ?? []) {
          if (child.type === 'text' || child.type === 'code_inline') stats.words += countWords(child.content);
          else if (child.type === 'math_inline') stats.math++;
          else if (child.type === 'image') stats.images++;
          else if (child.type === 'link_open') stats.links++;
        }
        break;
    }
  }
  stats.readingMinutes = stats.words === 0 ? 0 : Math.ceil(stats.words / WORDS_PER_MINUTE);
  return { headings, stats };
}
```

`src/renderer/index.ts`:

```ts
export type { ImageResolution, LinkResolution, RenderContext } from './context';
export { analyze, type Analysis, type DocumentStats, type OutlineHeading } from './analyze';
export { escapeHtml } from './escape';
export { render } from './render';
export { readDiagramSource } from './code';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/renderer`
Expected: PASS, including every existing renderer test (the instance moved, but its behaviour didn't change).

- [ ] **Step 5: All checks, log, commit**

```bash
git add src/renderer ../context.md
git commit -m "feat(renderer): headings carry their source line; analyze() for outline and stats

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Editor — reveal a line, select a range, read the text

**Files:**
- Modify: `src/editor/Editor.tsx`
- Test: `src/editor/Editor.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EditorHandle` gains
  - `revealLine(line: number): void` (0-based line; clamped; cursor at its start, scrolled to the top, focused)
  - `select(from: number, to: number): void` (clamped to the document; scrolled into view, focused)
  - `getText(): string` (the current document text, including edits not yet saved or previewed)

- [ ] **Step 1: Write the failing tests** — add to `src/editor/Editor.test.tsx` (it already imports `createRef`, `act`, `render`, `EditorView`, `vi`)

```tsx
function setupWithHandle(initialContent: string) {
  const ref = createRef<EditorHandle>();
  const { container } = render(<Editor ref={ref} initialContent={initialContent} onChange={vi.fn()} onSave={vi.fn()} />);
  const view = EditorView.findFromDOM(container.querySelector<HTMLElement>('.cm-editor')!)!;
  return { handle: () => ref.current!, view };
}

describe('Editor handle navigation', () => {
  it('reveals a line with the cursor at its start', () => {
    const { handle, view } = setupWithHandle('a\nbb\nccc');
    act(() => handle().revealLine(2));
    expect(view.state.selection.main.head).toBe(5);
  });

  it('clamps a line past either end', () => {
    const { handle, view } = setupWithHandle('a\nbb\nccc');
    act(() => handle().revealLine(99));
    expect(view.state.selection.main.head).toBe(5);
    act(() => handle().revealLine(-3));
    expect(view.state.selection.main.head).toBe(0);
  });

  it('selects a range, clamped to the document', () => {
    const { handle, view } = setupWithHandle('hello world');
    act(() => handle().select(6, 11));
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('world');
    act(() => handle().select(6, 500));
    expect(view.state.selection.main.to).toBe(11);
  });

  it('returns the text typed so far', () => {
    const { handle, view } = setupWithHandle('a');
    act(() => view.dispatch({ changes: { from: 1, insert: 'bc' } }));
    expect(handle().getText()).toBe('abc');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/editor/Editor.test.tsx`
Expected: FAIL with "revealLine is not a function" (or the equivalent for `select` / `getText`).

- [ ] **Step 3: Implement** — in `src/editor/Editor.tsx`

Extend the interface:

```ts
export interface EditorHandle {
  /** Insert `text` as its own block at `at`, or at the cursor (the end if the editor never had focus). One undo step. */
  insertBlock(text: string, at?: number | null): void;
  /** Put the cursor at the start of 0-based `line` (clamped) and scroll it to the top. */
  revealLine(line: number): void;
  /** Select [from, to) (clamped) and scroll it into view. */
  select(from: number, to: number): void;
  /** The current text, including edits not yet saved. */
  getText(): string;
}
```

In `useImperativeHandle`, after `insertBlock`, add:

```ts
    revealLine(line) {
      const view = viewRef.current;
      if (!view) return;
      const { doc } = view.state;
      const pos = doc.line(Math.min(Math.max(line + 1, 1), doc.lines)).from;
      view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'start' }) });
      view.focus();
      focusedRef.current = true;
    },
    select(from, to) {
      const view = viewRef.current;
      if (!view) return;
      const clamp = (n: number) => Math.min(Math.max(n, 0), view.state.doc.length);
      const anchor = clamp(from);
      view.dispatch({ selection: { anchor, head: clamp(to) }, effects: EditorView.scrollIntoView(anchor, { y: 'center' }) });
      view.focus();
      focusedRef.current = true;
    },
    getText() {
      return viewRef.current?.state.doc.toString() ?? '';
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/editor`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src/editor ../context.md
git commit -m "feat(editor): revealLine, select and getText on the editor handle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Side panel — outline, stats and settings

**Files:**
- Create: `src/outline/OutlinePanel.tsx`, `src/outline/StatsPanel.tsx`, `src/outline/outline.css`, `src/outline/index.ts`, `src/app/SidePanel.tsx`
- Modify: `src/app/Workspace.tsx`, `src/app/app.css`, `src/test/setup.ts`
- Test: `src/outline/outline.test.tsx`, `src/app/Workspace.test.tsx`

**Interfaces:**
- Consumes: `analyze`, `Analysis`, `OutlineHeading`, `DocumentStats` (Task 3); `EditorHandle.revealLine` (Task 4); `SettingsPanel`, `useRenderingSettings` (Tasks 1–2); `SETTINGS.panel`, `SETTINGS.panelTab` (Task 1).
- Produces:
  - `OutlinePanel(props: { headings: readonly OutlineHeading[] | null; onSelect: (line: number) => void })`. `null` means no document is open.
  - `StatsPanel(props: { stats: DocumentStats | null })`
  - `type PanelTab = 'outline' | 'stats' | 'settings'`; `SidePanel(props: SidePanelProps)` from `src/app/SidePanel.tsx`
  - `Workspace` has `mainRef` on `<main>`, `panelOpen`, `panelTab` and `revealHeading(line)`. Later tasks keep these names.
  - The test setup gives jsdom a no-op `Element.prototype.scrollIntoView` that tests can spy on.

- [ ] **Step 1: Write the failing tests**

`src/test/setup.ts`, append:

```ts
// jsdom has no scrolling; components call scrollIntoView and tests spy on it.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
```

`src/outline/outline.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OutlinePanel } from './OutlinePanel';
import { StatsPanel } from './StatsPanel';

describe('OutlinePanel', () => {
  it('lists headings indented below the shallowest level and reports clicks', async () => {
    const onSelect = vi.fn();
    render(<OutlinePanel headings={[{ level: 2, text: 'Setup', line: 3 }, { level: 3, text: 'Install', line: 7 }]} onSelect={onSelect} />);
    expect(screen.getByRole('navigation', { name: 'Outline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Setup' }).style.paddingLeft).toBe('8px');
    expect(screen.getByRole('button', { name: 'Install' }).style.paddingLeft).toBe('20px');
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onSelect).toHaveBeenCalledWith(7);
  });

  it('names an empty heading', () => {
    render(<OutlinePanel headings={[{ level: 1, text: '', line: 0 }]} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Untitled heading' })).toBeInTheDocument();
  });

  it('says when no document is open', () => {
    render(<OutlinePanel headings={null} onSelect={vi.fn()} />);
    expect(screen.getByText('No document open')).toBeInTheDocument();
    expect(screen.getByText('Open a document to see its outline.')).toBeInTheDocument();
  });

  it('says when there are no headings', () => {
    render(<OutlinePanel headings={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('No headings yet')).toBeInTheDocument();
    expect(screen.getByText('Headings you write appear here.')).toBeInTheDocument();
  });
});

describe('StatsPanel', () => {
  const stats = { words: 1234, characters: 5678, headings: 3, codeBlocks: 2, diagrams: 1, math: 4, images: 5, links: 6, readingMinutes: 6 };
  const value = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

  it('shows every statistic', () => {
    render(<StatsPanel stats={stats} />);
    expect(value('Words')).toBe((1234).toLocaleString());
    expect(value('Characters')).toBe((5678).toLocaleString());
    expect(value('Reading time')).toBe('6 min');
    expect(value('Headings')).toBe('3');
    expect(value('Code blocks')).toBe('2');
    expect(value('Diagrams')).toBe('1');
    expect(value('Math')).toBe('4');
    expect(value('Images')).toBe('5');
    expect(value('Links')).toBe('6');
  });

  it('says “Under a minute” when there are no words', () => {
    render(<StatsPanel stats={{ ...stats, words: 0, readingMinutes: 0 }} />);
    expect(value('Reading time')).toBe('Under a minute');
  });

  it('says when no document is open', () => {
    render(<StatsPanel stats={null} />);
    expect(screen.getByText('No document open')).toBeInTheDocument();
  });
});
```

`src/app/Workspace.test.tsx`: add `vi` to the vitest import and `within` to the testing-library import, then add:

```tsx
  it('shows the outline in the side panel and scrolls the preview to a heading', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument('# Hello\n\nWorld\n\n## Next');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    await user.click(screen.getByRole('button', { name: 'Show panel' }));
    const outline = await screen.findByRole('navigation', { name: 'Outline' });
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    await user.click(within(outline).getByRole('button', { name: 'Next' }));
    expect(scroll.mock.contexts).toContain(container.querySelector('.ws-preview [data-line="4"]'));
    scroll.mockRestore();
    expect(screen.getByRole('button', { name: 'Hide panel' })).toBeInTheDocument();
    await waitFor(async () => expect(await getSetting(SETTINGS.panel, false)).toBe(true));
  });

  it('changes the rendering settings from the side panel', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument();
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    await user.click(screen.getByRole('button', { name: 'Show panel' }));
    await user.click(await screen.findByRole('radio', { name: 'Settings' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Padding' }), { target: { value: '16' } });
    expect(container.querySelector<HTMLElement>('.md-prose')!.style.getPropertyValue('--doc-padding')).toBe('16px');
    await waitFor(async () => expect(await getSetting(SETTINGS.rendering, null)).toMatchObject({ padding: 16 }));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/outline src/app/Workspace.test.tsx`
Expected: FAIL. The outline modules are missing, and there is no "Show panel" button.

- [ ] **Step 3: Implement**

`src/outline/OutlinePanel.tsx`:

```tsx
import type { OutlineHeading } from '../renderer';
import { EmptyState } from '../ui';

export interface OutlinePanelProps {
  /** null = no document open. */
  headings: readonly OutlineHeading[] | null;
  onSelect: (line: number) => void;
}

export function OutlinePanel({ headings, onSelect }: OutlinePanelProps) {
  if (headings === null) {
    return (
      <EmptyState icon="file" title="No document open">
        Open a document to see its outline.
      </EmptyState>
    );
  }
  if (headings.length === 0) {
    return (
      <EmptyState icon="info" title="No headings yet">
        Headings you write appear here.
      </EmptyState>
    );
  }
  const top = Math.min(...headings.map((h) => h.level));
  return (
    <nav aria-label="Outline">
      <ul className="outline-list">
        {headings.map((heading) => (
          <li key={heading.line}>
            <button
              type="button"
              className="outline-item"
              style={{ paddingLeft: `${8 + (heading.level - top) * 12}px` }}
              onClick={() => onSelect(heading.line)}
            >
              {heading.text || 'Untitled heading'}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

`src/outline/StatsPanel.tsx`:

```tsx
import type { DocumentStats } from '../renderer';
import { EmptyState } from '../ui';

const ROWS: ReadonlyArray<[string, (stats: DocumentStats) => string]> = [
  ['Words', (s) => s.words.toLocaleString()],
  ['Characters', (s) => s.characters.toLocaleString()],
  ['Reading time', (s) => (s.readingMinutes === 0 ? 'Under a minute' : `${s.readingMinutes.toLocaleString()} min`)],
  ['Headings', (s) => s.headings.toLocaleString()],
  ['Code blocks', (s) => s.codeBlocks.toLocaleString()],
  ['Diagrams', (s) => s.diagrams.toLocaleString()],
  ['Math', (s) => s.math.toLocaleString()],
  ['Images', (s) => s.images.toLocaleString()],
  ['Links', (s) => s.links.toLocaleString()],
];

export function StatsPanel({ stats }: { stats: DocumentStats | null }) {
  if (stats === null) {
    return (
      <EmptyState icon="file" title="No document open">
        Open a document to see its outline.
      </EmptyState>
    );
  }
  return (
    <dl className="stats-list">
      {ROWS.map(([label, value]) => (
        <div key={label} className="stats-row">
          <dt>{label}</dt>
          <dd>{value(stats)}</dd>
        </div>
      ))}
    </dl>
  );
}
```

`src/outline/outline.css`:

```css
.outline-list { list-style: none; margin: 0; padding: var(--space-2); }
.outline-item { display: block; width: 100%; padding-block: var(--space-1); padding-right: var(--space-2); border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--ink); font: 400 13px/18px var(--font-sans); text-align: left; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.outline-item:hover { background: var(--paper); }
.outline-item:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.stats-list { margin: 0; padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.stats-row { display: flex; justify-content: space-between; gap: var(--space-3); font: 400 13px/18px var(--font-sans); }
.stats-row dt { color: var(--ink-muted); }
.stats-row dd { margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; }
```

`src/outline/index.ts`:

```ts
import './outline.css';

export { OutlinePanel, type OutlinePanelProps } from './OutlinePanel';
export { StatsPanel } from './StatsPanel';
```

`src/app/SidePanel.tsx`:

```tsx
import { OutlinePanel, StatsPanel } from '../outline';
import type { Analysis } from '../renderer';
import { SettingsPanel, type RenderingSettings } from '../settings';
import { SegmentedControl, type SegmentedOption } from '../ui';

export type PanelTab = 'outline' | 'stats' | 'settings';

const TABS: ReadonlyArray<SegmentedOption<PanelTab>> = [
  { value: 'outline', label: 'Outline' },
  { value: 'stats', label: 'Stats' },
  { value: 'settings', label: 'Settings' },
];

export interface SidePanelProps {
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  /** null when no document is ready, or the tab doesn't need it. */
  analysis: Analysis | null;
  onHeading: (line: number) => void;
  rendering: RenderingSettings;
  onRenderingChange: (patch: Partial<RenderingSettings>) => void;
  onRenderingReset: () => void;
}

export function SidePanel({ tab, onTab, analysis, onHeading, rendering, onRenderingChange, onRenderingReset }: SidePanelProps) {
  const current: PanelTab = TABS.some((option) => option.value === tab) ? tab : 'outline';
  return (
    <aside className="ws-panel" aria-label="Document panel">
      <div className="ws-panel-head">
        <SegmentedControl label="Panel" value={current} onChange={onTab} options={TABS} />
      </div>
      <div className="ws-panel-body">
        {current === 'outline' && <OutlinePanel headings={analysis?.headings ?? null} onSelect={onHeading} />}
        {current === 'stats' && <StatsPanel stats={analysis?.stats ?? null} />}
        {current === 'settings' && <SettingsPanel value={rendering} onChange={onRenderingChange} onReset={onRenderingReset} />}
      </div>
    </aside>
  );
}
```

`src/app/app.css`, append:

```css
.ws-panel { width: var(--sidebar-width); flex: none; display: flex; flex-direction: column; min-height: 0; background: var(--paper-sunken); border-left: 1px solid var(--line); }
.ws-panel-head { flex: none; display: flex; justify-content: center; padding: var(--space-2); border-bottom: 1px solid var(--line); }
.ws-panel-body { flex: 1; min-height: 0; overflow: auto; }
```

`src/app/Workspace.tsx`, complete file after this task:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { EditorHandle } from '../editor';
import { analyze, render } from '../renderer';
import { toCssVars, useRenderingSettings } from '../settings';
import { IMAGE_ACCEPT, SETTINGS, useProject, useSettingState, type ImageAsset } from '../store';
import { FileTree } from '../tree';
import { IconButton, SaveStatus, SegmentedControl, Wordmark, type SegmentedOption } from '../ui';
import { DocumentArea } from './DocumentArea';
import { addImagesNextTo, imageMarkdown } from './imageInsert';
import { MissingPage } from './MissingPage';
import { Notice, type NoticeMessage } from './Notice';
import { SidePanel, type PanelTab } from './SidePanel';
import { useResolvedTheme } from './theme';
import { ThemeMenu } from './ThemeMenu';
import { useDocumentDraft } from './useDocumentDraft';
import { useProjectFiles } from './useProjectFiles';

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
  const [panelOpen, setPanelOpen] = useSettingState<boolean>(SETTINGS.panel, false);
  const [panelTab, setPanelTab] = useSettingState<PanelTab>(SETTINGS.panelTab, 'outline');
  const draft = useDocumentDraft(docId);
  const theme = useResolvedTheme();
  const [rendering, updateRendering, resetRendering] = useRenderingSettings();
  const proseStyle = useMemo(() => toCssVars(rendering) as CSSProperties, [rendering]);
  const { saveNow } = draft;
  const files = useProjectFiles(projectId, docId);
  const { index, docFolderId, imageUrls } = files;
  const html = useMemo(() => render(draft.previewSource, files.context), [draft.previewSource, files.context]);
  const editorRef = useRef<EditorHandle>(null);
  const mainRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docReady = draft.status === 'ready';
  const analysis = useMemo(
    () => (panelOpen && panelTab !== 'settings' && docReady ? analyze(draft.previewSource) : null),
    [panelOpen, panelTab, docReady, draft.previewSource],
  );

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
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const showNotice = useCallback((text: string) => setNotice({ id: Date.now() + Math.random(), text }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const insertFiles = useCallback(
    async (list: File[], at: number | null) => {
      if (list.length === 0) return;
      const { markdown, errors } = await addImagesNextTo(projectId, docFolderId, list);
      if (markdown) editorRef.current?.insertBlock(markdown, at);
      if (errors.length > 0) showNotice(errors.join(' '));
    },
    [projectId, docFolderId, showNotice],
  );

  const insertImage = useCallback(
    (image: ImageAsset) => {
      const href = index.relativeHref(docFolderId, { kind: 'image', id: image.id });
      if (href) editorRef.current?.insertBlock(imageMarkdown(image.name, href));
    },
    [index, docFolderId],
  );

  // Outline clicks scroll whichever panes are visible to the heading.
  const revealHeading = useCallback(
    (line: number) => {
      if (mode !== 'editor') mainRef.current?.querySelector<HTMLElement>(`.ws-preview [data-line="${line}"]`)?.scrollIntoView({ block: 'start' });
      if (mode !== 'preview') editorRef.current?.revealLine(line);
    },
    [mode],
  );

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
          <IconButton icon="image" label="Insert image" disabled={!docReady} onClick={() => fileInputRef.current?.click()} />
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            tabIndex={-1}
            onChange={(event) => {
              const list = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              void insertFiles(list, null);
            }}
          />
          {draft.status === 'ready' && (
            <SaveStatus state={draft.saveState} detail={draft.saveState === 'failed' ? 'your last changes are only in this tab' : undefined} />
          )}
          <IconButton icon="sidebar" label={panelOpen ? 'Hide panel' : 'Show panel'} active={panelOpen} onClick={() => setPanelOpen(!panelOpen)} />
          <ThemeMenu />
        </div>
      </header>
      <div className="ws-body">
        <aside className="ws-tree" aria-label="Project files">
          <FileTree
            projectId={projectId}
            activeDocId={docId}
            onOpen={openDocument}
            onActiveDeleted={closeDocument}
            onInsertImage={docReady ? insertImage : undefined}
            imageUrls={imageUrls}
          />
        </aside>
        <main ref={mainRef} className={`ws-main mode-${mode}`}>
          <DocumentArea
            docId={docId}
            draft={draft}
            html={html}
            theme={theme}
            proseStyle={proseStyle}
            editorRef={editorRef}
            onImageFiles={(list, at) => void insertFiles(list, at)}
            onOpenDocument={openDocument}
            onNotice={showNotice}
          />
          <Notice notice={notice} onDismiss={dismissNotice} />
        </main>
        {panelOpen && (
          <SidePanel
            tab={panelTab}
            onTab={setPanelTab}
            analysis={analysis}
            onHeading={revealHeading}
            rendering={rendering}
            onRenderingChange={updateRendering}
            onRenderingReset={resetRendering}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/outline src/app`
Expected: PASS. If the scroll assertion fails because the preview was re-rendered between the click and the query, look the element up after the click (as written); never hold an element from before the click.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src ../context.md
git commit -m "feat(app): side panel with outline, stats and rendering settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Search core

**Files:**
- Create: `src/search/search.ts`
- Test: `src/search/search.test.ts`

**Interfaces:**
- Consumes: types `Folder`, `MdDocument`, `ImageAsset` (`src/store`, type-only).
- Produces:
  - `type Range = readonly [start: number, end: number]` (UTF-16 offsets into the shown text)
  - `interface NameResult { kind: 'folder' | 'document' | 'image'; id: string; name: string; path: string; ranges: Range[] }`
  - `interface Snippet { line: number; from: number; to: number; text: string; ranges: Range[] }`. `line` is 0-based; `from`/`to` are offsets of the line's first match in the document content.
  - `interface ContentResult { kind: 'content'; id: string; name: string; path: string; count: number; snippets: Snippet[] }`
  - `type SearchResult = NameResult | ContentResult`
  - `searchProject(query: string, source: { folders: readonly Folder[]; documents: readonly MdDocument[]; images: readonly ImageAsset[] }): SearchResult[]`
  - `MAX_RESULTS = 100`

- [ ] **Step 1: Write the failing tests** — `src/search/search.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Folder, ImageAsset, MdDocument } from '../store';
import { MAX_RESULTS, searchProject, type ContentResult } from './search';

const folder = (id: string, name: string, parentFolderId: string | null = null): Folder => ({
  id, projectId: 'p', parentFolderId, name, createdAt: 0, updatedAt: 0,
});
const doc = (id: string, title: string, content: string, folderId: string | null = null): MdDocument => ({
  id, projectId: 'p', folderId, title, content, dirty: true, createdAt: 0, updatedAt: 0,
});
const image = (id: string, name: string, folderId: string | null = null): ImageAsset => ({
  id, projectId: 'p', folderId, name, contentType: 'image/png', size: 1, sha256: '', createdAt: 0, updatedAt: 0,
});

const folders = [folder('g', 'Guides'), folder('i', 'images', 'g')];
const documents = [
  doc('setup', 'Setup.md', 'Run the setup script.\nThen restart.', 'g'),
  doc('notes', 'Notes.md', 'line one\nsetup again\nand setup twice: setup\nfourth setup\nfifth setup'),
];
const images = [image('shot', 'setup-shot.png', 'i')];
const source = { folders, documents, images };

describe('searchProject', () => {
  it('returns nothing for an empty or blank query', () => {
    expect(searchProject('', source)).toEqual([]);
    expect(searchProject('   ', source)).toEqual([]);
  });

  it('lists name matches first, by path, with their ranges', () => {
    const results = searchProject('SETUP', source);
    // localeCompare puts "Guides/images/…" before "Guides/Setup.md".
    expect(results.slice(0, 2)).toEqual([
      { kind: 'image', id: 'shot', name: 'setup-shot.png', path: 'Guides/images/setup-shot.png', ranges: [[0, 5]] },
      { kind: 'document', id: 'setup', name: 'Setup.md', path: 'Guides/Setup.md', ranges: [[0, 5]] },
    ]);
    expect(results.slice(2).every((r) => r.kind === 'content')).toBe(true);
  });

  it('lists content matches by count, at most three snippets each', () => {
    const content = searchProject('setup', source).filter((r): r is ContentResult => r.kind === 'content');
    expect(content.map((r) => [r.id, r.count])).toEqual([
      ['notes', 5],
      ['setup', 1],
    ]);
    const notes = content[0]!;
    expect(notes.snippets.map((s) => s.line)).toEqual([1, 2, 3]);
    expect(notes.snippets[1]).toEqual({ line: 2, from: 25, to: 30, text: 'and setup twice: setup', ranges: [[4, 9], [17, 22]] });
  });

  it('cuts long lines around the first match', () => {
    const line = `${'a'.repeat(50)}NEEDLE${'b'.repeat(100)}`;
    const [result] = searchProject('needle', { folders: [], documents: [doc('d', 'D.md', line)], images: [] }) as ContentResult[];
    expect(result!.snippets[0]!.text).toBe(`…${'a'.repeat(40)}NEEDLE${'b'.repeat(80)}…`);
    expect(result!.snippets[0]!.ranges).toEqual([[41, 47]]);
    expect(result!.snippets[0]!.from).toBe(50);
  });

  it('matches case-insensitively beyond ASCII', () => {
    const results = searchProject('ÜBER', { folders: [], documents: [doc('d', 'D.md', 'Alles über uns')], images: [] });
    expect(results).toHaveLength(1);
  });

  it('treats the query as plain text', () => {
    const text = 'Use C++ (beta) with $x$ and [a] or a.b';
    const docs = [doc('d', 'D.md', text)];
    for (const query of ['C++ (beta)', '$x$', '[a]', 'a.b']) {
      expect(searchProject(query, { folders: [], documents: docs, images: [] })).toHaveLength(1);
    }
    expect(searchProject('a*b', { folders: [], documents: docs, images: [] })).toEqual([]);
  });

  it('stops at the result limit', () => {
    const many = Array.from({ length: 150 }, (_, n) => doc(`d${n}`, `Doc ${n}.md`, 'word'));
    expect(searchProject('word', { folders: [], documents: many, images: [] })).toHaveLength(MAX_RESULTS);
  });
});
```

Offsets in the `notes` case: `line one\n` is 9 characters and `setup again\n` is 12, so line 2 starts at offset 21 and its first `setup` is at 21 + 4 = 25.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/search`
Expected: FAIL. `./search` doesn't exist.

- [ ] **Step 3: Implement** — `src/search/search.ts`

```ts
import type { Folder, ImageAsset, MdDocument } from '../store';

export type Range = readonly [start: number, end: number];

export interface NameResult {
  kind: 'folder' | 'document' | 'image';
  id: string;
  name: string;
  /** Full path from the project root, e.g. "Guides/Setup.md". */
  path: string;
  ranges: Range[];
}

export interface Snippet {
  /** 0-based line in the document. */
  line: number;
  /** The line's first match, as offsets in the document content (for selecting it in the editor). */
  from: number;
  to: number;
  text: string;
  /** Matches as offsets in `text`. */
  ranges: Range[];
}

export interface ContentResult {
  kind: 'content';
  id: string;
  name: string;
  path: string;
  count: number;
  snippets: Snippet[];
}

export type SearchResult = NameResult | ContentResult;

export interface SearchSource {
  folders: readonly Folder[];
  documents: readonly MdDocument[];
  images: readonly ImageAsset[];
}

export const MAX_RESULTS = 100;
const MAX_SNIPPETS = 3;
const BEFORE = 40;
const AFTER = 80;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function rangesIn(text: string, pattern: RegExp): Range[] {
  return Array.from(text.matchAll(pattern), (m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as const);
}

function folderPaths(folders: readonly Folder[]): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const paths = new Map<string, string>();
  const pathOf = (id: string, seen: Set<string>): string => {
    const known = paths.get(id);
    if (known !== undefined) return known;
    const f = byId.get(id);
    if (!f || seen.has(id)) return '';
    seen.add(id);
    const parent = f.parentFolderId ? pathOf(f.parentFolderId, seen) : '';
    const path = parent ? `${parent}/${f.name}` : f.name;
    paths.set(id, path);
    return path;
  };
  for (const f of folders) pathOf(f.id, new Set());
  return paths;
}

function snippetFor(text: string, found: readonly Range[], line: number, lineStart: number): Snippet {
  const [firstStart, firstEnd] = found[0]!;
  const cutStart = Math.max(0, firstStart - BEFORE);
  const cutEnd = Math.min(text.length, firstEnd + AFTER);
  const prefix = cutStart > 0 ? '…' : '';
  const suffix = cutEnd < text.length ? '…' : '';
  const shift = prefix.length - cutStart;
  const ranges = found
    .filter(([start]) => start >= cutStart && start < cutEnd)
    .map(([start, end]) => [start + shift, Math.min(end, cutEnd) + shift] as const);
  return { line, from: lineStart + firstStart, to: lineStart + firstEnd, text: `${prefix}${text.slice(cutStart, cutEnd)}${suffix}`, ranges };
}

function contentMatches(content: string, pattern: RegExp): { count: number; snippets: Snippet[] } {
  let count = 0;
  const snippets: Snippet[] = [];
  let lineStart = 0;
  for (let line = 0; ; line++) {
    const newline = content.indexOf('\n', lineStart);
    const lineEnd = newline === -1 ? content.length : newline;
    const text = content.slice(lineStart, lineEnd);
    const found = rangesIn(text, pattern);
    if (found.length > 0) {
      count += found.length;
      if (snippets.length < MAX_SNIPPETS) snippets.push(snippetFor(text, found, line, lineStart));
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }
  return { count, snippets };
}

/** Case-insensitive plain-text search over names and document contents (PRD §5.7). */
export function searchProject(query: string, { folders, documents, images }: SearchSource): SearchResult[] {
  const needle = query.trim();
  if (needle === '') return [];
  const pattern = new RegExp(escapeRegExp(needle), 'giu');
  const paths = folderPaths(folders);
  const pathOf = (folderId: string | null, name: string) => {
    const dir = folderId ? (paths.get(folderId) ?? '') : '';
    return dir ? `${dir}/${name}` : name;
  };

  const names: NameResult[] = [];
  const addName = (kind: NameResult['kind'], id: string, name: string, path: string) => {
    const ranges = rangesIn(name, pattern);
    if (ranges.length > 0) names.push({ kind, id, name, path, ranges });
  };
  for (const f of folders) addName('folder', f.id, f.name, paths.get(f.id) ?? f.name);
  for (const d of documents) addName('document', d.id, d.title, pathOf(d.folderId, d.title));
  for (const i of images) addName('image', i.id, i.name, pathOf(i.folderId, i.name));
  names.sort((a, b) => a.path.localeCompare(b.path));

  const content: ContentResult[] = [];
  for (const d of documents) {
    const { count, snippets } = contentMatches(d.content, pattern);
    if (count > 0) content.push({ kind: 'content', id: d.id, name: d.title, path: pathOf(d.folderId, d.title), count, snippets });
  }
  content.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));

  return [...names, ...content].slice(0, MAX_RESULTS);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/search`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src/search ../context.md
git commit -m "feat(search): case-insensitive project search with snippets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Search UI, tree reveal, and opening a match

**Files:**
- Create: `src/search/SearchBox.tsx`, `src/search/SearchResults.tsx`, `src/search/search.css`, `src/search/index.ts`
- Modify: `src/tree/FileTree.tsx`, `src/app/Workspace.tsx`, `src/app/app.css`, `src/ui/components.css`
- Test: `src/search/SearchResults.test.tsx`, `src/tree/FileTree.test.tsx`, `src/app/Workspace.test.tsx`

**Interfaces:**
- Consumes: `searchProject`, `Range` (Task 6); `EditorHandle.select` (Task 4); `useFolders`, `useDocuments`, `useImages` (`src/store`).
- Produces:
  - `SEARCH_INPUT_ID = 'project-search'`; `SearchBox(props: { value: string; onChange: (value: string) => void })`
  - `interface SearchMatch { from: number; to: number }`
  - `SearchResults(props: { projectId: string; query: string; onOpenDocument: (docId: string, match?: SearchMatch) => void; onReveal: (id: string) => void })`
  - `FileTreeProps` gains `revealId?: string | null` and `onRevealed?: () => void`. Every `TreeItem` gets `data-id={node.id}`.
  - `.md-mark` (marker highlight) in the app extensions block of `components.css`

- [ ] **Step 1: Write the failing tests**

`src/search/SearchResults.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addImage, clearDatabase, createDocument, createFolder, createProject, saveDocumentContent } from '../store';
import { SearchResults } from './SearchResults';

beforeEach(clearDatabase);

async function project() {
  const p = await createProject('P');
  const guides = await createFolder(p.id, null, 'Guides');
  const doc = await createDocument(p.id, guides.id, 'Setup');
  await saveDocumentContent(doc.id, 'first\nrun setup now');
  const pic = await addImage(p.id, guides.id, { name: 'setup.png', type: 'image/png', bytes: new Uint8Array([1]).buffer });
  return { p, guides, doc, pic };
}

describe('SearchResults', () => {
  it('shows name and content matches with marked text', async () => {
    const { p } = await project();
    render(<SearchResults projectId={p.id} query="setup" onOpenDocument={vi.fn()} onReveal={vi.fn()} />);
    expect(await screen.findByText('3 results')).toBeInTheDocument();
    const snippet = screen.getByRole('button', { name: /Line 2/ });
    expect(within(snippet).getByText('setup').tagName).toBe('MARK');
    expect(screen.getByRole('button', { name: /setup\.png/ })).toBeInTheDocument();
  });

  it('opens a document at the match, and reveals other items', async () => {
    const user = userEvent.setup();
    const { p, doc, pic } = await project();
    const onOpenDocument = vi.fn();
    const onReveal = vi.fn();
    render(<SearchResults projectId={p.id} query="setup" onOpenDocument={onOpenDocument} onReveal={onReveal} />);
    await user.click(await screen.findByRole('button', { name: /Line 2/ }));
    expect(onOpenDocument).toHaveBeenLastCalledWith(doc.id, { from: 10, to: 15 });
    // The name result and the content result's header both start with "Setup.md"; both open the document.
    await user.click(screen.getAllByRole('button', { name: /^Setup\.md/ })[0]!);
    expect(onOpenDocument).toHaveBeenLastCalledWith(doc.id);
    await user.click(screen.getByRole('button', { name: /setup\.png/ }));
    expect(onReveal).toHaveBeenCalledWith(pic.id);
  });

  it('says when nothing matches', async () => {
    const { p } = await project();
    render(<SearchResults projectId={p.id} query="zzz" onOpenDocument={vi.fn()} onReveal={vi.fn()} />);
    expect(await screen.findByText('No matches for “zzz”')).toBeInTheDocument();
  });
});
```

(`first\nrun setup now`: line 2 starts at offset 6, and `setup` begins 4 characters in, so `{ from: 10, to: 15 }`. There are three results: the document name, the image name (`addImage` keeps `setup.png`), and the document content.)

`src/tree/FileTree.test.tsx`, add:

```tsx
  it('reveals an item that search asked for', async () => {
    const project = await createProject('OS');
    const outer = await createFolder(project.id, null, 'Outer');
    const inner = await createFolder(project.id, outer.id, 'Inner');
    const image = await addImage(project.id, inner.id, png('pic.png'));
    const onRevealed = vi.fn();
    renderTree(project.id, undefined, { revealId: image.id, onRevealed });
    const row = await screen.findByRole('treeitem', { name: 'pic.png' });
    await waitFor(() => expect(row).toHaveFocus());
    expect(onRevealed).toHaveBeenCalled();
  });
```

`src/app/Workspace.test.tsx`: add `import { EditorView } from '@codemirror/view';` and:

```tsx
  it('searches the project and opens a match selected in the editor', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const alpha = await createDocument(project.id, null, 'Alpha');
    await saveDocumentContent(alpha.id, '# Alpha\n\nnothing here');
    const beta = await createDocument(project.id, null, 'Beta');
    await saveDocumentContent(beta.id, 'intro\n\nfind the needle here');
    const { container } = renderAt(`/p/${project.id}/d/${alpha.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Alpha' });
    await user.type(screen.getByRole('searchbox', { name: 'Search project' }), 'needle');
    await user.click(await screen.findByRole('button', { name: /Line 3/ }));
    await waitFor(() => expect(editorText(container)).toContain('find the needle here'));
    const view = EditorView.findFromDOM(container.querySelector<HTMLElement>('.cm-editor')!)!;
    await waitFor(() => expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe('needle'));
  });

  it('focuses search with Ctrl+Shift+F and clears it with Escape', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument();
    renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true });
    const box = screen.getByRole('searchbox', { name: 'Search project' });
    expect(box).toHaveFocus();
    await user.type(box, 'zzz');
    expect(await screen.findByText('No matches for “zzz”')).toBeInTheDocument();
    expect(screen.queryByRole('tree')).toBeNull();
    await user.keyboard('{Escape}');
    expect(box).toHaveValue('');
    expect(await screen.findByRole('tree', { name: 'Files' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/search src/tree src/app/Workspace.test.tsx`
Expected: FAIL. The components are missing, `revealId` is unknown, and there is no search box.

- [ ] **Step 3: Implement**

`src/ui/components.css`, add at the end of the app extensions block:

```css
.md-mark { background: var(--marker); color: var(--ink); border-radius: 2px; padding: 0 1px; }
```

`src/search/SearchBox.tsx`:

```tsx
import { Input } from '../ui';

export const SEARCH_INPUT_ID = 'project-search';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const SEARCH_SHORTCUT = isMac ? '⌘ Shift F' : 'Ctrl Shift F';

export function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="search-box">
      <Input
        id={SEARCH_INPUT_ID}
        type="search"
        icon="search"
        placeholder="Search project"
        aria-label="Search project"
        shortcut={value ? undefined : SEARCH_SHORTCUT}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onChange('');
          }
        }}
      />
    </div>
  );
}
```

`src/search/SearchResults.tsx`:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { plural } from '../lib/text';
import { useDocuments, useFolders, useImages } from '../store';
import { Icon, type IconName } from '../ui';
import { searchProject, type NameResult, type Range } from './search';

export interface SearchMatch {
  from: number;
  to: number;
}

export interface SearchResultsProps {
  projectId: string;
  query: string;
  onOpenDocument: (docId: string, match?: SearchMatch) => void;
  onReveal: (id: string) => void;
}

const DELAY = 120;
const ICON: Record<NameResult['kind'], IconName> = { folder: 'folder', document: 'file', image: 'image' };

function Highlighted({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(
      <mark key={i} className="md-mark">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

const parentPath = (path: string, name: string) => (path.length > name.length ? path.slice(0, path.length - name.length - 1) : '');

export function SearchResults({ projectId, query, onOpenDocument, onReveal }: SearchResultsProps) {
  const folders = useFolders(projectId);
  const documents = useDocuments(projectId);
  const images = useImages(projectId);
  const [settled, setSettled] = useState(query);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query), DELAY);
    return () => window.clearTimeout(timer);
  }, [query]);
  const results = useMemo(
    () => (folders && documents && images ? searchProject(settled, { folders, documents, images }) : null),
    [settled, folders, documents, images],
  );
  if (!results) return null;

  return (
    <div className="search-results">
      <p className="search-summary" role="status">
        {results.length === 0 ? `No matches for “${settled.trim()}”` : plural(results.length, 'result')}
      </p>
      <ul className="search-list">
        {results.map((result) => (
          <li key={`${result.kind}:${result.id}`}>
            {result.kind === 'content' ? (
              <>
                <button type="button" className="search-row" onClick={() => onOpenDocument(result.id)}>
                  <Icon name="file" />
                  <span className="search-name">{result.name}</span>
                  <span className="search-path">{parentPath(result.path, result.name)}</span>
                </button>
                <ul className="search-snippets">
                  {result.snippets.map((snippet) => (
                    <li key={snippet.from}>
                      <button
                        type="button"
                        className="search-snippet"
                        onClick={() => onOpenDocument(result.id, { from: snippet.from, to: snippet.to })}
                      >
                        <span className="search-line">Line {snippet.line + 1}</span>
                        <span className="search-text">
                          <Highlighted text={snippet.text} ranges={snippet.ranges} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <button
                type="button"
                className="search-row"
                onClick={() => (result.kind === 'document' ? onOpenDocument(result.id) : onReveal(result.id))}
              >
                <Icon name={ICON[result.kind]} />
                <span className="search-name">
                  <Highlighted text={result.name} ranges={result.ranges} />
                </span>
                <span className="search-path">{parentPath(result.path, result.name)}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`src/search/search.css`:

```css
.search-box { flex: none; padding: var(--space-3) var(--space-2) var(--space-1); }
.search-results { flex: 1; min-height: 0; overflow: auto; padding: 0 var(--space-2) var(--space-4); }
.search-summary { margin: var(--space-2); font: 400 12px/16px var(--font-sans); color: var(--ink-muted); }
.search-list, .search-snippets { list-style: none; margin: 0; padding: 0; }
.search-row, .search-snippet { display: flex; align-items: center; gap: var(--space-2); width: 100%; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--ink); text-align: left; cursor: pointer; font: 400 13px/18px var(--font-sans); }
.search-row { height: var(--control-sm); padding: 0 var(--space-2); }
.search-snippet { align-items: baseline; padding: 2px var(--space-2) 2px 30px; color: var(--ink-muted); font-size: 12px; line-height: 16px; }
.search-row:hover, .search-snippet:hover { background: var(--paper); }
.search-row:focus-visible, .search-snippet:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
.search-name { flex: none; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.search-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-faint); font-size: 12px; }
.search-line { flex: none; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.search-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

`src/search/index.ts`:

```ts
import './search.css';

export { searchProject, MAX_RESULTS, type ContentResult, type NameResult, type Range, type SearchResult, type Snippet } from './search';
export { SEARCH_INPUT_ID, SearchBox } from './SearchBox';
export { SearchResults, type SearchMatch, type SearchResultsProps } from './SearchResults';
```

`src/tree/FileTree.tsx`:
- Add to `FileTreeProps`:

```ts
  /** Open the folders above this item, then focus and scroll to its row (search results). */
  revealId?: string | null;
  /** Called once a reveal has been handled. */
  onRevealed?: () => void;
```

- Take `revealId, onRevealed` in the function's props.
- After `const thumbTimer = useRef…`, add:

```tsx
  const rootRef = useRef<HTMLDivElement>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
```

- After the "Keep the active document visible" effect, add:

```tsx
  // Search asked to show an item: open the folders above it, then focus its row once it is rendered.
  useEffect(() => {
    if (!revealId || !folders || !documents || !images) return;
    const folder = folders.find((f) => f.id === revealId);
    const item = folder ?? documents.find((d) => d.id === revealId) ?? images.find((i) => i.id === revealId);
    if (item) {
      const parentId = folder ? folder.parentFolderId : (item as { folderId: string | null }).folderId;
      setOpen((prev) => withAll(prev, ancestorFolderIds(folders, parentId)));
      setFocusId(revealId);
    }
    onRevealed?.();
  }, [revealId, folders, documents, images, onRevealed]);

  useEffect(() => {
    if (!focusId) return;
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-id="${focusId}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest' });
    row.focus();
    setFocusId(null);
  });
```

- `<div className="tree">` becomes `<div className="tree" ref={rootRef}>`.
- On `<TreeItem …>`, add `data-id={node.id}`.

`src/app/app.css`, append:

```css
.ws-tree-files { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ws-tree-files[hidden] { display: none; }
```

`src/app/Workspace.tsx` (on top of the Task 5 file):
- Import `{ SEARCH_INPUT_ID, SearchBox, SearchResults, type SearchMatch } from '../search'`.
- After the `analysis` memo, add state:

```tsx
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const [revealId, setRevealId] = useState<string | null>(null);
  const [pendingSelect, setPendingSelect] = useState<({ docId: string } & SearchMatch) | null>(null);
```

- Replace the keyboard effect with:

```tsx
  // Ctrl/Cmd+S saves now (never the browser's "Save page"); Ctrl/Cmd+Shift+F focuses project search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 's') {
        event.preventDefault();
        saveNow();
      } else if (key === 'f' && event.shiftKey) {
        event.preventDefault();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);
```

- After `revealHeading`, add:

```tsx
  const openFromSearch = useCallback(
    (id: string, match?: SearchMatch) => {
      if (match) {
        setPendingSelect({ docId: id, ...match });
        if (mode === 'preview') setMode('split'); // the match is selected in the editor, so show it
      }
      openDocument(id);
    },
    [mode, setMode, openDocument],
  );
  const revealFromSearch = useCallback((id: string) => {
    setQuery('');
    setRevealId(id);
  }, []);
  const clearReveal = useCallback(() => setRevealId(null), []);

  // Select a search match once its document's editor is mounted.
  useEffect(() => {
    if (!pendingSelect || pendingSelect.docId !== docId || !docReady) return;
    editorRef.current?.select(pendingSelect.from, pendingSelect.to);
    setPendingSelect(null);
  }, [pendingSelect, docId, docReady]);
```

- The tree `<aside>` becomes:

```tsx
        <aside className="ws-tree" aria-label="Project files">
          <SearchBox value={query} onChange={setQuery} />
          {searching && <SearchResults projectId={projectId} query={query} onOpenDocument={openFromSearch} onReveal={revealFromSearch} />}
          <div className="ws-tree-files" hidden={searching}>
            <FileTree
              projectId={projectId}
              activeDocId={docId}
              onOpen={openDocument}
              onActiveDeleted={closeDocument}
              onInsertImage={docReady ? insertImage : undefined}
              imageUrls={imageUrls}
              revealId={revealId}
              onRevealed={clearReveal}
            />
          </div>
        </aside>
```

The tree stays mounted while searching (only hidden), so its open folders survive a search.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/search src/tree src/app`
Expected: PASS, including every existing tree and workspace test. Existing tests that look up the `tree` role still find it, because the query is empty.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src ../context.md
git commit -m "feat(search): search box, results with marked snippets, tree reveal and match selection

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Shared render context and Mermaid token reader

**Files:**
- Create: `src/paths/renderContext.ts`
- Move: `src/app/useProjectFiles.test.ts` → `src/paths/renderContext.test.ts`
- Modify: `src/paths/index.ts`, `src/app/useProjectFiles.ts`, `src/preview/mermaid.ts`, `src/preview/index.ts`
- Test: `src/paths/renderContext.test.ts`, `src/preview/mermaid.test.ts`

**Interfaces:**
- Consumes: `createPathIndex`, `isExternalHref`, `PathIndex` (`src/paths`); type `RenderContext` (`src/renderer`).
- Produces:
  - `createRenderContext(input: RenderContextInput): RenderContext` and `interface RenderContextInput { loaded: boolean; index: PathIndex; docFolderId: string | null; imageUrls: ReadonlyMap<string, string> }` from `src/paths`
  - `type TokenReader = (name: string) => string` and `renderDiagrams(root, theme, load = loadMermaid, tokens: TokenReader = documentTokens): Promise<void>` from `src/preview/mermaid.ts`. `src/preview/index.ts` exports `renderDiagrams`, `loadMermaid`, `type MermaidApi`, `type TokenReader`.

- [ ] **Step 1: Move the tests and write the new failing test**

```bash
git mv src/app/useProjectFiles.test.ts src/paths/renderContext.test.ts
```

In `src/paths/renderContext.test.ts`, change the imports to:

```ts
import { describe, expect, it } from 'vitest';
import { createPathIndex } from './paths';
import { createRenderContext } from './renderContext';
```

In `src/preview/mermaid.test.ts`, add inside `describe('renderDiagrams')`:

```ts
  it('takes diagram colours from the given token reader', async () => {
    const { api, load } = fakeApi();
    await renderDiagrams(host('graph A'), 'light', load, (name) => (name === '--paper' ? '#fffffe' : ''));
    expect(api.initialize).toHaveBeenCalledWith(expect.objectContaining({ themeVariables: { background: '#fffffe' } }));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/paths src/preview/mermaid.test.ts`
Expected: FAIL. `./renderContext` doesn't exist, and `renderDiagrams` ignores a fourth argument.

- [ ] **Step 3: Implement**

`src/paths/renderContext.ts`. Move the code unchanged from `src/app/useProjectFiles.ts`:

```ts
import type { RenderContext } from '../renderer';
import { isExternalHref, type PathIndex } from './paths';

export interface RenderContextInput {
  loaded: boolean;
  index: PathIndex;
  docFolderId: string | null;
  /** Image id → URL: object URLs in the preview, data: URIs in exports. */
  imageUrls: ReadonlyMap<string, string>;
}

/** Until the tree and the image's URL are ready, stored images show "Loading image…", never "not found". */
export function createRenderContext({ loaded, index, docFolderId, imageUrls }: RenderContextInput): RenderContext {
  return {
    resolveImage(href) {
      if (isExternalHref(href)) return { src: href };
      if (!loaded) return { pending: true };
      const found = index.resolve(docFolderId, href);
      if (found.kind !== 'image') return { missing: true };
      const url = imageUrls.get(found.id);
      return url ? { src: url } : { pending: true };
    },
    resolveLink(href) {
      if (isExternalHref(href)) return { external: true };
      if (!loaded) return { unsupported: true };
      const found = index.resolve(docFolderId, href);
      if (found.kind === 'document') return { docId: found.id };
      if (found.kind === 'missing') return { missing: true };
      return { unsupported: true };
    },
  };
}
```

`src/paths/index.ts`, add: `export { createRenderContext, type RenderContextInput } from './renderContext';`

`src/app/useProjectFiles.ts`: delete `ContextInput` and `createRenderContext`. Import `createRenderContext` with `createPathIndex` from `../paths`, and drop the now-unused `isExternalHref` import. Nothing else changes.

`src/preview/mermaid.ts`:
- After the `MermaidApi` type, add:

```ts
/** Reads a design token, e.g. '--paper'. Exports pass the light theme's values (P-035). */
export type TokenReader = (name: string) => string;

const documentTokens: TokenReader = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
```

- `function themeVariables(): Record<string, string>` becomes `function themeVariables(token: TokenReader): Record<string, string>`. Delete its first two lines (`const style = …` and `const token = …`); the body already calls `token(name)`.
- `configure(api: MermaidApi, theme: Theme)` becomes `configure(api: MermaidApi, theme: Theme, tokens: TokenReader)`, and it passes `themeVariables: themeVariables(tokens)`.
- `renderDiagrams(root, theme, load = loadMermaid)` becomes `renderDiagrams(root: HTMLElement, theme: Theme, load: () => Promise<MermaidApi> = loadMermaid, tokens: TokenReader = documentTokens)`, and it calls `configure(api, theme, tokens)`.

`src/preview/index.ts`, make sure it exports: `export { loadMermaid, renderDiagrams, type MermaidApi, type Theme, type TokenReader } from './mermaid';` (keep its existing exports).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/paths src/preview src/app`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

```bash
git add -A src ../context.md
git commit -m "refactor: share createRenderContext from paths; Mermaid colours from a token reader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Export helpers — base64, file names, fonts and CSS inlining

**Files:**
- Create: `src/export/base64.ts`, `src/export/files.ts`, `src/export/assets.ts`
- Test: `src/export/base64.test.ts`, `src/export/files.test.ts`, `src/export/assets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `toBase64(bytes: Uint8Array): string`, `dataUri(type: string, bytes: Uint8Array): string`
  - `safeFileName(name: string): string`. It replaces `\ / : * ? " < > |` and control characters with `-`, trims, limits to 120 characters, drops leading dots, and returns `'untitled'` when the result is empty.
  - `fileStem(title: string): string`, e.g. `"Intro.md"` → `"Intro"`
  - `type FetchBytes = (url: string) => Promise<Uint8Array>`
  - `parseUnicodeRange(value: string): Array<[number, number]>`, `pickFontFaces(css: string, text: string): string`, `inlineCssUrls(css: string, fetchBytes: FetchBytes): Promise<string>`

- [ ] **Step 1: Write the failing tests**

`src/export/base64.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dataUri, toBase64 } from './base64';

describe('base64', () => {
  it('encodes bytes', () => {
    expect(toBase64(new Uint8Array([1, 2, 3]))).toBe('AQID');
    expect(toBase64(new Uint8Array([137, 80, 78, 71]))).toBe('iVBORw==');
  });

  it('encodes large inputs without overflowing the call stack', () => {
    const bytes = Uint8Array.from({ length: 200_000 }, (_, i) => i % 256);
    const decoded = Uint8Array.from(atob(toBase64(bytes)), (c) => c.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });

  it('builds data URIs', () => {
    expect(dataUri('image/png', new Uint8Array([1, 2, 3]))).toBe('data:image/png;base64,AQID');
  });
});
```

`src/export/files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fileStem, safeFileName } from './files';

describe('file names', () => {
  it('replace characters that file systems reject', () => {
    expect(safeFileName('a/b:c*?.md')).toBe('a-b-c--.md');
    expect(safeFileName('tab\there')).toBe('tab-here');
  });

  it('are never empty or hidden, and never too long', () => {
    expect(safeFileName('   ')).toBe('untitled');
    expect(safeFileName('...')).toBe('untitled');
    expect(safeFileName('.env')).toBe('env');
    expect(safeFileName('x'.repeat(300))).toHaveLength(120);
  });

  it('drop the .md extension for a stem', () => {
    expect(fileStem('Intro.md')).toBe('Intro');
    expect(fileStem('Notes.MD')).toBe('Notes');
    expect(fileStem('plain')).toBe('plain');
  });
});
```

`src/export/assets.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { inlineCssUrls, parseUnicodeRange, pickFontFaces } from './assets';

describe('parseUnicodeRange', () => {
  it('reads single code points, ranges and wildcards', () => {
    expect(parseUnicodeRange('U+0000-00FF, U+0131,U+1F??')).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x1f00, 0x1fff],
    ]);
  });
});

describe('pickFontFaces', () => {
  const css = [
    '/* latin */',
    '@font-face { font-family: X; src: url(/a.woff2); unicode-range: U+0000-00FF; }',
    '/* cyrillic */',
    '@font-face { font-family: X; src: url(/b.woff2); unicode-range: U+0400-045F; }',
    '@font-face { font-family: K; src: url(/k.woff2); }',
    'p { color: red; }',
  ].join('\n');

  it('keeps faces whose range covers the text, and faces without a range', () => {
    const out = pickFontFaces(css, 'Hello');
    expect(out).toContain('/a.woff2');
    expect(out).not.toContain('/b.woff2');
    expect(out).toContain('/k.woff2');
    expect(out).toContain('p { color: red; }');
  });

  it('keeps a subset as soon as one character needs it', () => {
    expect(pickFontFaces(css, 'Hello Привет')).toContain('/b.woff2');
  });
});

describe('inlineCssUrls', () => {
  it('inlines every url as a data URI of the right type', async () => {
    const fetchBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const out = await inlineCssUrls("a { background: url('/i.png') } @font-face { src: url(/f.woff2) format('woff2') }", fetchBytes);
    expect(out).toContain('url("data:image/png;base64,AQID")');
    expect(out).toContain('url("data:font/woff2;base64,AQID")');
  });

  it('keeps only woff2 sources in a src list', async () => {
    const out = await inlineCssUrls(
      '@font-face{src:url(/k.woff2) format("woff2"),url(/k.woff) format("woff"),url(/k.ttf) format("truetype")}',
      async () => new Uint8Array([0]),
    );
    expect(out).toContain('font/woff2');
    expect(out).not.toContain('font/woff;');
    expect(out).not.toContain('truetype');
  });

  it('fetches each url once and leaves data URIs alone', async () => {
    const fetchBytes = vi.fn(async () => new Uint8Array([0]));
    await inlineCssUrls('a{background:url(/x.png)} b{background:url(/x.png)} c{background:url(data:image/png;base64,AA==)}', fetchBytes);
    expect(fetchBytes).toHaveBeenCalledTimes(1);
    expect(fetchBytes).toHaveBeenCalledWith('/x.png');
  });

  it('keeps the original url when a fetch fails', async () => {
    const out = await inlineCssUrls('a{background:url(/x.png)}', async () => {
      throw new Error('offline');
    });
    expect(out).toContain('url(/x.png)');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/export`
Expected: FAIL. The modules don't exist.

- [ ] **Step 3: Implement**

`src/export/base64.ts`:

```ts
const CHUNK = 0x8000;

/** btoa over chunks: String.fromCharCode(...bytes) on a whole image would overflow the call stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function dataUri(type: string, bytes: Uint8Array): string {
  return `data:${type};base64,${toBase64(bytes)}`;
}
```

`src/export/files.ts`:

```ts
const RESERVED = '\\/:*?"<>|';
const MAX_LENGTH = 120;

/** A name every common file system accepts: reserved and control characters become "-". */
export function safeFileName(name: string): string {
  const replaced = Array.from(name, (ch) => (ch.charCodeAt(0) < 32 || RESERVED.includes(ch) ? '-' : ch)).join('');
  return replaced.trim().slice(0, MAX_LENGTH).replace(/^\.+/, '') || 'untitled';
}

export function fileStem(title: string): string {
  return title.replace(/\.md$/i, '');
}
```

`src/export/assets.ts`:

```ts
import { toBase64 } from './base64';

export type FetchBytes = (url: string) => Promise<Uint8Array>;

const FONT_FACE = /@font-face\s*\{[^}]*\}/g;
const URL_REF = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const MIME: Record<string, string> = {
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
};

const mimeOf = (url: string) => MIME[(/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(url)?.[1] ?? '').toLowerCase()] ?? 'application/octet-stream';

/** "U+0000-00FF, U+0131, U+1F??" → [[0, 255], [305, 305], [7936, 8191]] */
export function parseUnicodeRange(value: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const part of value.split(',')) {
    const token = part.trim().replace(/^u\+/i, '');
    if (token === '') continue;
    if (token.includes('?')) {
      ranges.push([parseInt(token.replace(/\?/g, '0'), 16), parseInt(token.replace(/\?/g, 'F'), 16)]);
      continue;
    }
    const [startHex = '', endHex = startHex] = token.split('-');
    const start = parseInt(startHex, 16);
    const end = parseInt(endHex.replace(/^u\+/i, ''), 16);
    if (Number.isFinite(start) && Number.isFinite(end)) ranges.push([start, end]);
  }
  return ranges;
}

/** Drop @font-face blocks whose unicode-range covers no character of `text` (P-035). */
export function pickFontFaces(css: string, text: string): string {
  const codePoints = new Set<number>();
  for (const ch of text) codePoints.add(ch.codePointAt(0)!);
  return css.replace(FONT_FACE, (block) => {
    const match = /unicode-range\s*:\s*([^;}]+)/i.exec(block);
    if (!match) return block;
    const ranges = parseUnicodeRange(match[1]!);
    for (const cp of codePoints) if (ranges.some(([a, b]) => cp >= a && cp <= b)) return block;
    return '';
  });
}

/** In `src:` lists keep only the woff2 sources: every browser that opens the export reads woff2. */
function keepWoff2(css: string): string {
  return css.replace(/src\s*:\s*([^;}]+)/gi, (decl, list: string) => {
    const sources = list.split(',').map((s) => s.trim());
    const woff2 = sources.filter((s) => /woff2/i.test(s));
    return woff2.length > 0 && woff2.length < sources.length ? `src: ${woff2.join(', ')}` : decl;
  });
}

/** Replace every url(...) with a base64 data URI; a url that can't be fetched stays as it was. */
export async function inlineCssUrls(css: string, fetchBytes: FetchBytes): Promise<string> {
  const trimmed = keepWoff2(css);
  const urls = new Set<string>();
  for (const match of trimmed.matchAll(URL_REF)) {
    const url = match[2]!.trim();
    if (!/^data:/i.test(url)) urls.add(url);
  }
  const inlined = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        inlined.set(url, `data:${mimeOf(url)};base64,${toBase64(await fetchBytes(url))}`);
      } catch {
        // keep the original url
      }
    }),
  );
  return trimmed.replace(URL_REF, (whole, _quote: string, url: string) => {
    const data = inlined.get(url.trim());
    return data ? `url("${data}")` : whole;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/export`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src/export ../context.md
git commit -m "feat(export): base64, safe file names, font subset selection and CSS url inlining

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Self-contained HTML export

**Files:**
- Create: `src/store/snapshot.ts` (type and reader; the reader's tests are in Task 12), `src/export/html.ts`, `src/export/exportDeps.ts`
- Modify: `src/store/index.ts`
- Test: `src/export/html.test.ts`

**Interfaces:**
- Consumes: `render`, `escapeHtml` (Task 3); `createPathIndex`, `createRenderContext` (Task 8); `renderDiagrams`, `MermaidApi`, `TokenReader` from `src/preview/mermaid.ts` (Task 8); `toCssVars`, `RenderingSettings` (Task 1); `pickFontFaces`, `inlineCssUrls`, `FetchBytes`, `dataUri`, `fileStem` (Task 9).
- Produces:
  - store: `interface ImageWithBytes extends ImageAsset { bytes: ArrayBuffer }`, `interface ProjectSnapshot { project: Project; folders: Folder[]; documents: MdDocument[]; images: ImageWithBytes[] }`, `readProjectSnapshot(projectId: string): Promise<ProjectSnapshot | null>`
  - `type ExportMode = 'html' | 'pdf'`
  - `interface ExportDeps { baseCss: string; mathCss: string; fontCss: string; fetchBytes: FetchBytes; loadMermaid?: () => Promise<MermaidApi> }`
  - `interface ExportInput { markdown: string; title: string; folderId: string | null; snapshot: ProjectSnapshot; rendering: RenderingSettings; mode: ExportMode }`
  - `buildExportHtml(input: ExportInput, deps: ExportDeps): Promise<string>`; `lightTokens(css: string): TokenReader`
  - `exportDeps: ExportDeps` (the real CSS and `fetch`) from `src/export/exportDeps.ts`

- [ ] **Step 1: Write the failing tests** — `src/export/html.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMermaid, type MermaidApi } from '../preview/mermaid';
import { DEFAULT_RENDERING } from '../settings';
import type { ImageWithBytes, ProjectSnapshot } from '../store';
import { buildExportHtml, lightTokens, type ExportDeps, type ExportInput } from './html';

const PNG = new Uint8Array([137, 80, 78, 71]);
const png = (id: string, name: string): ImageWithBytes => ({
  id, projectId: 'p', folderId: 'img', name, contentType: 'image/png', size: 4, sha256: '', createdAt: 0, updatedAt: 0, bytes: PNG.slice().buffer,
});
const snapshot: ProjectSnapshot = {
  project: { id: 'p', name: 'P', description: '', createdAt: 0, updatedAt: 0 },
  folders: [{ id: 'img', projectId: 'p', parentFolderId: null, name: 'images', createdAt: 0, updatedAt: 0 }],
  documents: [{ id: 'd', projectId: 'p', folderId: null, title: 'Intro.md', content: '', dirty: true, createdAt: 0, updatedAt: 0 }],
  images: [png('a', 'a.png'), png('b', 'unused.png')],
};

const BASE_CSS = ':root { --paper: #faf9f7; --ink: #1b1a18; }\n:root[data-theme="dark"] { --paper: #000; }\n.md-prose { color: var(--ink); }';

function deps(extra: Partial<ExportDeps> = {}): ExportDeps {
  return {
    baseCss: BASE_CSS,
    mathCss: '.katex { font: normal 1.21em KaTeX_Main; }',
    fontCss: '@font-face { font-family: X; src: url(/x.woff2) format("woff2"); unicode-range: U+0000-00FF; }',
    fetchBytes: async () => new Uint8Array([1]),
    ...extra,
  };
}

const input = (markdown: string, extra: Partial<ExportInput> = {}): ExportInput => ({
  markdown, title: 'Intro.md', folderId: null, snapshot, rendering: DEFAULT_RENDERING, mode: 'html', ...extra,
});

function fakeMermaid(svg = '<svg data-test="diagram"></svg>') {
  const api = { initialize: vi.fn(), render: vi.fn(async () => ({ svg })) };
  return { api, loadMermaid: async () => api as unknown as MermaidApi };
}

beforeEach(() => resetMermaid());

describe('buildExportHtml', () => {
  it('is a light, self-contained document titled after the file', async () => {
    const html = await buildExportHtml(input('# Hello'), deps());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toContain('<title>Intro</title>');
    expect(html).toContain('<h1 data-line="0">Hello</h1>');
    expect(html).toContain('url("data:font/woff2;base64,AQ==")');
  });

  it('escapes the title', async () => {
    expect(await buildExportHtml(input('x', { title: '<b>&.md' }), deps())).toContain('<title>&lt;b&gt;&amp;</title>');
  });

  it('embeds only the stored images the document uses, as data URIs', async () => {
    const html = await buildExportHtml(input('![a](images/a.png)'), deps());
    expect(html).toContain('src="data:image/png;base64,iVBORw=="');
    expect(html.match(/data:image\/png/g)).toHaveLength(1);
    expect(html).not.toContain('blob:');
  });

  it('keeps external images as links and missing ones as placeholders', async () => {
    const html = await buildExportHtml(input('![x](https://example.com/x.png)\n\n![y](images/gone.png)'), deps());
    expect(html).toContain('src="https://example.com/x.png"');
    expect(html).toContain('Image not found: images/gone.png');
  });

  it('adds the KaTeX styles only when there is math', async () => {
    expect(await buildExportHtml(input('$x^2$'), deps())).toContain('KaTeX_Main');
    expect(await buildExportHtml(input('plain'), deps())).not.toContain('KaTeX_Main');
  });

  it('carries the rendering settings', async () => {
    const html = await buildExportHtml(input('x', { rendering: { ...DEFAULT_RENDERING, font: 'mono', lineHeight: 2 } }), deps());
    expect(html).toContain(
      '<article class="md-prose" style="--doc-font: var(--font-mono); --doc-letter-spacing: 0em; --doc-line-height: 2; --doc-margin: 0px; --doc-padding: 48px">',
    );
  });

  it('has a copy script in HTML mode, and neither copy buttons nor script in PDF mode', async () => {
    const md = '```js\nx\n```';
    const html = await buildExportHtml(input(md), deps());
    expect(html).toContain('class="md-code-copy"');
    expect(html).toContain('<script>');
    const pdf = await buildExportHtml(input(md, { mode: 'pdf' }), deps());
    expect(pdf).not.toContain('md-code-copy');
    expect(pdf).not.toContain('<script>');
  });

  it('removes the in-app link markers', async () => {
    const html = await buildExportHtml(input('[me](Intro.md) and [gone](Gone.md)'), deps());
    expect(html).toContain('href="Intro.md"');
    expect(html).not.toContain('data-doc-id');
    expect(html).not.toContain('data-missing');
  });

  it('renders diagrams to SVG and leaves nothing behind in the page', async () => {
    const { loadMermaid } = fakeMermaid();
    const html = await buildExportHtml(input('```mermaid\nflowchart TD\n  A-->B\n```'), deps({ loadMermaid }));
    expect(html).toContain('<svg data-test="diagram"></svg>');
    expect(document.querySelector('[data-export-host]')).toBeNull();
  });

  it('colours diagrams from the light tokens even in dark mode', async () => {
    document.documentElement.dataset.theme = 'dark';
    const { api, loadMermaid } = fakeMermaid('<svg></svg>');
    await buildExportHtml(input('```mermaid\nflowchart TD\n```'), deps({ loadMermaid }));
    expect(api.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ themeVariables: expect.objectContaining({ background: '#faf9f7', primaryTextColor: '#1b1a18' }) }),
    );
    delete document.documentElement.dataset.theme;
  });
});

describe('lightTokens', () => {
  it('reads the first :root block only', () => {
    const read = lightTokens(BASE_CSS);
    expect(read('--paper')).toBe('#faf9f7');
    expect(read('--missing')).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/export/html.test.ts`
Expected: FAIL. `./html` doesn't exist, and `ImageWithBytes` / `ProjectSnapshot` aren't exported from the store.

- [ ] **Step 3: Implement**

`src/store/snapshot.ts`:

```ts
import { db, toDocument, toFolder, toImage } from './db';
import { hierarchyTables } from './guards';
import type { Folder, ImageAsset, MdDocument, Project } from './types';

export interface ImageWithBytes extends ImageAsset {
  bytes: ArrayBuffer;
}

/** Everything in one project, read in one transaction (exports read from this, never from live queries). */
export interface ProjectSnapshot {
  project: Project;
  folders: Folder[];
  documents: MdDocument[];
  images: ImageWithBytes[];
}

export async function readProjectSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  return db.transaction('r', hierarchyTables(), async () => {
    const project = await db.projects.get(projectId);
    if (!project) return null;
    const [folders, documents, images] = await Promise.all([
      db.folders.where('projectId').equals(projectId).toArray(),
      db.documents.where('projectId').equals(projectId).toArray(),
      db.images.where('projectId').equals(projectId).toArray(),
    ]);
    const data = await db.imageData.bulkGet(images.map((image) => image.id));
    return {
      project,
      folders: folders.map(toFolder),
      documents: documents.map(toDocument),
      images: images.map((row, i) => ({ ...toImage(row), bytes: data[i]?.bytes ?? new ArrayBuffer(0) })),
    };
  });
}
```

`src/store/index.ts`, add: `export { readProjectSnapshot, type ImageWithBytes, type ProjectSnapshot } from './snapshot';`

`src/export/html.ts`:

```ts
import { createPathIndex, createRenderContext, type PathIndex } from '../paths';
import { renderDiagrams, type MermaidApi, type TokenReader } from '../preview/mermaid';
import { escapeHtml, render, type RenderContext } from '../renderer';
import { toCssVars, type RenderingSettings } from '../settings';
import type { ProjectSnapshot } from '../store';
import { inlineCssUrls, pickFontFaces, type FetchBytes } from './assets';
import { dataUri } from './base64';
import { fileStem } from './files';

export type ExportMode = 'html' | 'pdf';

export interface ExportDeps {
  /** tokens.css + components.css + preview.css */
  baseCss: string;
  /** KaTeX's stylesheet; included only when the document has math. */
  mathCss: string;
  /** @font-face rules of the self-hosted fonts. */
  fontCss: string;
  fetchBytes: FetchBytes;
  loadMermaid?: () => Promise<MermaidApi>;
}

export interface ExportInput {
  markdown: string;
  /** The document's file name, e.g. "Intro.md". */
  title: string;
  folderId: string | null;
  snapshot: ProjectSnapshot;
  rendering: RenderingSettings;
  mode: ExportMode;
}

const EXPORT_CSS = `
body.mdit-export { margin: 0; background: var(--paper); color: var(--ink); }
@media print {
  @page { margin: 16mm; }
  body.mdit-export { background: none; }
  .mdit-export .md-prose { max-width: none; margin: 0; padding-block: 0; }
  .mdit-export figure.md-code, .mdit-export img, .mdit-export .md-mermaid, .mdit-export .katex-display, .mdit-export table { break-inside: avoid; }
  .mdit-export h1, .mdit-export h2, .mdit-export h3, .mdit-export h4, .mdit-export h5, .mdit-export h6 { break-after: avoid; }
  .mdit-export pre { white-space: pre-wrap; }
}`;

/** Copy buttons in the exported file: the clipboard API, or a hidden textarea where it is missing. */
const COPY_SCRIPT = `document.addEventListener('click', function (event) {
  var button = event.target instanceof Element ? event.target.closest('.md-code-copy') : null;
  if (!button) return;
  var figure = button.closest('.md-code');
  var pre = figure ? figure.querySelector('pre') : null;
  var text = pre ? pre.textContent : '';
  var label = button.querySelector('span');
  function done(ok) {
    if (!label) return;
    label.textContent = ok ? 'Copied' : 'Couldn’t copy';
    setTimeout(function () { label.textContent = 'Copy'; }, 1400);
  }
  function fallback() {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    area.remove();
    done(ok);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
  else fallback();
});`;

/** Values of the first `:root { … }` block of tokens.css, which is the light theme. */
export function lightTokens(css: string): TokenReader {
  const block = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const values = new Map<string, string>();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) values.set(match[1]!, match[2]!.trim());
  return (name) => values.get(name) ?? '';
}

/** Ids of the stored images the document resolves to, so only those are embedded. */
function usedImages(input: ExportInput, index: PathIndex): Set<string> {
  const used = new Set<string>();
  const probe: RenderContext = {
    resolveImage(href) {
      const found = index.resolve(input.folderId, href);
      if (found.kind === 'image') used.add(found.id);
      return { missing: true };
    },
    resolveLink: () => ({ unsupported: true }),
  };
  render(input.markdown, probe);
  return used;
}

/** Mermaid lays diagrams out in the DOM, so they are rendered in an attached, offscreen container. */
async function renderDiagramsToHtml(body: string, deps: ExportDeps): Promise<string> {
  const host = document.createElement('div');
  host.dataset.exportHost = '';
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:720px;';
  host.innerHTML = body;
  document.body.append(host);
  try {
    await renderDiagrams(host, 'light', deps.loadMermaid, lightTokens(deps.baseCss));
    return host.innerHTML;
  } finally {
    host.remove();
  }
}

function finishBody(html: string, mode: ExportMode): string {
  const template = document.createElement('template');
  template.innerHTML = html;
  for (const el of template.content.querySelectorAll('[data-doc-id], [data-missing]')) {
    el.removeAttribute('data-doc-id');
    el.removeAttribute('data-missing');
  }
  if (mode === 'pdf') for (const button of template.content.querySelectorAll('.md-code-copy')) button.remove();
  return template.innerHTML;
}

/** One HTML file that looks like the preview with the same settings, and needs no network (P-035). */
export async function buildExportHtml(input: ExportInput, deps: ExportDeps): Promise<string> {
  const { snapshot } = input;
  const index = createPathIndex(snapshot.folders, snapshot.documents, snapshot.images);
  const used = usedImages(input, index);
  const imageUrls = new Map(
    snapshot.images.filter((image) => used.has(image.id)).map((image) => [image.id, dataUri(image.contentType, new Uint8Array(image.bytes))] as const),
  );
  let body = render(input.markdown, createRenderContext({ loaded: true, index, docFolderId: input.folderId, imageUrls }));
  if (body.includes('md-mermaid')) body = await renderDiagramsToHtml(body, deps);
  body = finishBody(body, input.mode);

  const hasMath = body.includes('class="katex');
  const fonts = pickFontFaces(deps.fontCss, `${input.title}\n${input.markdown}`);
  const css = await inlineCssUrls([deps.baseCss, hasMath ? deps.mathCss : '', fonts, EXPORT_CSS].join('\n'), deps.fetchBytes);
  const vars = Object.entries(toCssVars(input.rendering))
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');
  const script = input.mode === 'html' ? `<script>${COPY_SCRIPT}</script>` : '';
  return [
    '<!doctype html>',
    '<html lang="en" data-theme="light">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(fileStem(input.title))}</title>`,
    `<style>${css}</style>`,
    '</head>',
    `<body class="mdit-export"><main class="md-preview"><article class="md-prose" style="${escapeHtml(vars)}">${body}</article></main>${script}</body>`,
    '</html>',
  ].join('\n');
}
```

`renderDiagrams(host, 'light', deps.loadMermaid, …)`: when `deps.loadMermaid` is `undefined`, the parameter default (`loadMermaid`) applies.

`src/export/exportDeps.ts`:

```ts
import geistCss from '@fontsource-variable/geist/index.css?inline';
import geistMonoCss from '@fontsource-variable/geist-mono/index.css?inline';
import serifCss from '@fontsource-variable/source-serif-4/wght.css?inline';
import serifItalicCss from '@fontsource-variable/source-serif-4/wght-italic.css?inline';
import katexCss from 'katex/dist/katex.min.css?inline';
import previewCss from '../preview/preview.css?inline';
import componentsCss from '../ui/components.css?inline';
import tokensCss from '../ui/tokens.css?inline';
import type { ExportDeps } from './html';

/** Vite rewrites url(...) inside these strings to built asset URLs; fetching them works offline once precached. */
async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

export const exportDeps: ExportDeps = {
  baseCss: [tokensCss, componentsCss, previewCss].join('\n'),
  mathCss: katexCss,
  fontCss: [geistCss, geistMonoCss, serifCss, serifItalicCss].join('\n'),
  fetchBytes,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/export src/store`
Expected: PASS.

- [ ] **Step 5: Confirm the built CSS strings carry asset URLs**

Run: `npm run build && grep -o 'KaTeX_Main-Regular[^")]*\.woff2' dist/assets/*.js | head -3 && grep -o 'geist-latin-wght-normal[^")]*\.woff2' dist/assets/*.js | head -3`
Expected: both print hashed `/assets/…woff2` paths. That shows Vite rewrote the `url()`s inside the `?inline` CSS, so `fetchBytes` can load them.

- [ ] **Step 6: All checks, log, commit**

```bash
git add src ../context.md
git commit -m "feat(export): self-contained HTML export with embedded fonts, images and diagrams

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Print to PDF

**Files:**
- Create: `src/export/print.ts`
- Test: `src/export/print.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `printHtml(html: string, title: string): Promise<void>`. It resolves after `print()` was called, and rejects with `Error('The print view couldn’t open.')` when the frame has no window.

- [ ] **Step 1: Write the failing test** — `src/export/print.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { printHtml } from './print';

const frame = () => document.querySelector<HTMLIFrameElement>('iframe.print-frame');

afterEach(() => {
  frame()?.remove();
  document.title = '';
});

describe('printHtml', () => {
  it('prints the HTML from a hidden frame titled for the PDF, then cleans up', async () => {
    document.title = 'md.IT';
    const done = printHtml('<p>Hi</p>', 'Notes');
    const el = frame()!;
    expect(el.srcdoc).toBe('<p>Hi</p>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    const print = vi.spyOn(el.contentWindow!, 'print').mockImplementation(() => {});
    await done;
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('Notes');
    el.contentWindow!.dispatchEvent(new Event('afterprint'));
    expect(frame()).toBeNull();
    expect(document.title).toBe('md.IT');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/export/print.test.ts`
Expected: FAIL. `./print` doesn't exist.

- [ ] **Step 3: Implement** — `src/export/print.ts`

```ts
const READY_TIMEOUT = 5_000;
const CLEANUP_TIMEOUT = 60_000;

/** Fonts loaded and images decoded, or 5 s, whichever comes first. */
async function whenReady(doc: Document): Promise<void> {
  const fonts = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  const images = Array.from(doc.images, (img) => (typeof img.decode === 'function' ? img.decode().catch(() => undefined) : undefined));
  await Promise.race([Promise.all([fonts?.ready, ...images]), new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT))]);
}

/** Opens the browser's print dialog for `html` (P-036); "Save as PDF" names the file after `title`. */
export function printHtml(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.className = 'print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    const originalTitle = document.title;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      document.title = originalTitle;
      frame.remove();
    };
    frame.addEventListener(
      'load',
      () => {
        void (async () => {
          const win = frame.contentWindow;
          const doc = frame.contentDocument;
          if (!win || !doc) {
            finish();
            reject(new Error('The print view couldn’t open.'));
            return;
          }
          await whenReady(doc);
          document.title = title; // Chrome and Edge suggest the top page's title as the PDF name
          win.addEventListener('afterprint', finish, { once: true });
          timer = setTimeout(finish, CLEANUP_TIMEOUT);
          win.focus();
          win.print();
          resolve();
        })();
      },
      { once: true },
    );
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/export/print.test.ts`
Expected: PASS. (A jsdom 29 probe while planning showed a `srcdoc` iframe firing one `load` event and keeping the same `contentWindow`, so the spy installed before `load` is on the window that prints.)

- [ ] **Step 5: All checks, log, commit**

```bash
git add src/export ../context.md
git commit -m "feat(export): print the export through a hidden frame for PDF

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Project snapshot and zip export

**Files:**
- Create: `src/export/zip.ts`
- Modify: `package.json`, `package-lock.json` (add `fflate`)
- Test: `src/store/snapshot.test.ts`, `src/export/zip.test.ts`

**Interfaces:**
- Consumes: `readProjectSnapshot`, `ProjectSnapshot` (Task 10); `safeFileName` (Task 9); `RenderingSettings` (Task 1).
- Produces:
  - `MANIFEST_NAME = 'mdit.json'`
  - `interface ProjectManifest { format: 'mdit-project'; version: 1; name: string; description: string; exportedAt: string; rendering: RenderingSettings }`
  - `folderSegments(folders: readonly Folder[]): Map<string, string[]>` (folder id → names from the root)
  - `exportProjectZip(snapshot: ProjectSnapshot, rendering: RenderingSettings, now?: Date): Promise<Uint8Array>`

- [ ] **Step 1: Install fflate**

Run: `npm install fflate@^0.8.3`
Expected: `fflate` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

`src/store/snapshot.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { addImage, clearDatabase, createDocument, createFolder, createProject, readProjectSnapshot, saveDocumentContent } from '.';

beforeEach(clearDatabase);

describe('readProjectSnapshot', () => {
  it('reads a whole project with image bytes', async () => {
    const project = await createProject('P');
    const folder = await createFolder(project.id, null, 'Docs');
    const doc = await createDocument(project.id, folder.id, 'Intro');
    await saveDocumentContent(doc.id, '# Hi');
    await addImage(project.id, folder.id, { name: 'a.png', type: 'image/png', bytes: new Uint8Array([1, 2, 3]).buffer });
    const snapshot = (await readProjectSnapshot(project.id))!;
    expect(snapshot.project.name).toBe('P');
    expect(snapshot.folders.map((f) => f.name)).toEqual(['Docs']);
    expect(snapshot.documents.map((d) => [d.title, d.content, d.folderId])).toEqual([['Intro.md', '# Hi', folder.id]]);
    expect(Array.from(new Uint8Array(snapshot.images[0]!.bytes))).toEqual([1, 2, 3]);
  });

  it('returns null for a project that isn’t stored', async () => {
    expect(await readProjectSnapshot('nope')).toBeNull();
  });
});
```

`src/export/zip.test.ts`:

```ts
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RENDERING } from '../settings';
import type { ProjectSnapshot } from '../store';
import { exportProjectZip, folderSegments } from './zip';

const at = { createdAt: 0, updatedAt: 0 };
const snapshot: ProjectSnapshot = {
  project: { id: 'p', name: 'Notes', description: 'd', ...at },
  folders: [
    { id: 'g', projectId: 'p', parentFolderId: null, name: 'Guides', ...at },
    { id: 'gi', projectId: 'p', parentFolderId: 'g', name: 'images', ...at },
    { id: 'e', projectId: 'p', parentFolderId: null, name: 'Empty', ...at },
  ],
  documents: [
    { id: 'i', projectId: 'p', folderId: null, title: 'Intro.md', content: '# Hi 👋', dirty: true, ...at },
    { id: 's', projectId: 'p', folderId: 'g', title: 'Setup.md', content: 'Run.', dirty: true, ...at },
  ],
  images: [
    { id: 'a', projectId: 'p', folderId: 'gi', name: 'a.png', contentType: 'image/png', size: 3, sha256: '', ...at, bytes: new Uint8Array([1, 2, 3]).buffer },
  ],
};

describe('exportProjectZip', () => {
  it('writes the folder tree under a top folder, with empty folders and a manifest', async () => {
    const files = unzipSync(await exportProjectZip(snapshot, DEFAULT_RENDERING, new Date('2026-10-02T00:00:00Z')));
    expect(Object.keys(files).sort()).toEqual([
      'Notes/Empty/',
      'Notes/Guides/',
      'Notes/Guides/Setup.md',
      'Notes/Guides/images/',
      'Notes/Guides/images/a.png',
      'Notes/Intro.md',
      'Notes/mdit.json',
    ]);
    expect(strFromU8(files['Notes/Intro.md']!)).toBe('# Hi 👋');
    expect(Array.from(files['Notes/Guides/images/a.png']!)).toEqual([1, 2, 3]);
    expect(JSON.parse(strFromU8(files['Notes/mdit.json']!))).toEqual({
      format: 'mdit-project',
      version: 1,
      name: 'Notes',
      description: 'd',
      exportedAt: '2026-10-02T00:00:00.000Z',
      rendering: DEFAULT_RENDERING,
    });
  });

  it('makes the top folder name safe', async () => {
    const files = unzipSync(await exportProjectZip({ ...snapshot, project: { ...snapshot.project, name: 'A: B?' } }, DEFAULT_RENDERING));
    expect(Object.keys(files).every((name) => name.startsWith('A- B-/'))).toBe(true);
  });
});

describe('folderSegments', () => {
  it('maps folders to their names from the root', () => {
    expect(folderSegments(snapshot.folders).get('gi')).toEqual(['Guides', 'images']);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/store/snapshot.test.ts src/export/zip.test.ts`
Expected: the snapshot test PASSES (the reader came with Task 10), and the zip test FAILS because `./zip` is missing.

- [ ] **Step 4: Implement** — `src/export/zip.ts`

```ts
import type { ZipOptions } from 'fflate';
import type { RenderingSettings } from '../settings';
import type { Folder, ProjectSnapshot } from '../store';
import { safeFileName } from './files';

export const MANIFEST_NAME = 'mdit.json';

export interface ProjectManifest {
  format: 'mdit-project';
  version: 1;
  name: string;
  description: string;
  exportedAt: string;
  rendering: RenderingSettings;
}

/** Zip dates must be 1980 or later. */
const zipDate = (ms: number) => new Date(Math.max(ms, Date.UTC(1980, 0, 2)));

/** Folder id → folder names from the project root down to it. */
export function folderSegments(folders: readonly Folder[]): Map<string, string[]> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const result = new Map<string, string[]>();
  const segmentsOf = (id: string, seen: Set<string>): string[] => {
    const known = result.get(id);
    if (known) return known;
    const folder = byId.get(id);
    if (!folder || seen.has(id)) return [];
    seen.add(id);
    const segments = [...(folder.parentFolderId ? segmentsOf(folder.parentFolderId, seen) : []), folder.name];
    result.set(id, segments);
    return segments;
  };
  for (const folder of folders) segmentsOf(folder.id, new Set());
  return result;
}

/** `<Project name>/…` with every folder, document and image, plus mdit.json (P-038). */
export async function exportProjectZip(snapshot: ProjectSnapshot, rendering: RenderingSettings, now: Date = new Date()): Promise<Uint8Array> {
  const { strToU8, zipSync } = await import('fflate');
  const root = safeFileName(snapshot.project.name);
  const segments = folderSegments(snapshot.folders);
  const dir = (folderId: string | null) => (folderId ? (segments.get(folderId) ?? []) : []);
  const path = (parts: readonly string[]) => [root, ...parts].join('/');
  const manifest: ProjectManifest = {
    format: 'mdit-project',
    version: 1,
    name: snapshot.project.name,
    description: snapshot.project.description,
    exportedAt: now.toISOString(),
    rendering,
  };

  const entries: Record<string, [Uint8Array, ZipOptions]> = {};
  entries[path([MANIFEST_NAME])] = [strToU8(JSON.stringify(manifest, null, 2)), { mtime: zipDate(now.getTime()) }];
  for (const folder of snapshot.folders) entries[`${path(dir(folder.id))}/`] = [new Uint8Array(0), { mtime: zipDate(folder.updatedAt) }];
  for (const doc of snapshot.documents) {
    entries[path([...dir(doc.folderId), doc.title])] = [strToU8(doc.content), { mtime: zipDate(doc.updatedAt) }];
  }
  for (const image of snapshot.images) {
    // Already compressed formats: store them.
    entries[path([...dir(image.folderId), image.name])] = [new Uint8Array(image.bytes), { mtime: zipDate(image.updatedAt), level: 0 }];
  }
  return zipSync(entries, { level: 6 });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/store/snapshot.test.ts src/export/zip.test.ts`
Expected: PASS.

- [ ] **Step 6: All checks, log, commit**

(fflate over JSZip is decision P-042, recorded with this plan.)

```bash
git add package.json package-lock.json src ../context.md
git commit -m "feat(export): project snapshot and zip export (fflate)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Reading project zips

**Files:**
- Create: `src/export/importZip.ts`
- Modify: `src/store/types.ts`, `src/store/index.ts`
- Test: `src/export/importZip.test.ts`

**Interfaces:**
- Consumes: `MANIFEST_NAME` (Task 12); `clampRendering` (Task 1); from `src/store`: `ValidationError`, `userMessage`, `MAX_IMAGE_BYTES`, plus new exports `normalizeName`, `nextAvailableName`, `nameKey`, `imageTypeOf`, `extensionOf`.
- Produces:
  - store type: `interface ProjectImportData { name: string; description: string; folders: string[][]; documents: Array<{ folder: string[]; title: string; content: string }>; images: Array<{ folder: string[]; name: string; contentType: ImageType; bytes: ArrayBuffer }> }`. `folders` lists parents before children; every `folder` is a path of folder names from the root (`[]` = root).
  - `interface ParsedProjectZip extends ProjectImportData { rendering: RenderingSettings | null; skipped: Array<{ path: string; reason: string }>; renamed: Array<{ from: string; to: string }> }`
  - `parseProjectZip(data: Uint8Array, fileName: string): Promise<ParsedProjectZip>`. It throws `ValidationError` with one of `IMPORT_ERRORS.notZip | tooLarge | empty`.
  - `MAX_ENTRIES = 2000`, `MAX_TOTAL_BYTES = 500 * 1024 * 1024`, `IMPORT_ERRORS`, `SKIP_REASONS`

- [ ] **Step 1: Write the failing tests** — `src/export/importZip.test.ts`

```ts
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RENDERING } from '../settings';
import { MAX_IMAGE_BYTES } from '../store';
import { IMPORT_ERRORS, MAX_ENTRIES, parseProjectZip } from './importZip';

const zip = (files: Record<string, string | Uint8Array>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, typeof value === 'string' ? strToU8(value) : value])));

const manifest = (extra: object = {}) =>
  JSON.stringify({ format: 'mdit-project', version: 1, name: 'Notes', description: 'About', exportedAt: '', rendering: { ...DEFAULT_RENDERING, padding: 24 }, ...extra });

describe('parseProjectZip', () => {
  it('reads an md.IT export', async () => {
    const parsed = await parseProjectZip(
      zip({
        'Notes/mdit.json': manifest(),
        'Notes/Intro.md': '# Hi',
        'Notes/Guides/': '',
        'Notes/Guides/Setup.md': 'x',
        'Notes/Guides/images/a.png': new Uint8Array([1, 2, 3]),
        'Notes/Empty/': '',
      }),
      'whatever.zip',
    );
    expect(parsed.name).toBe('Notes');
    expect(parsed.description).toBe('About');
    expect(parsed.rendering).toEqual({ ...DEFAULT_RENDERING, padding: 24 });
    expect(parsed.folders).toEqual([['Guides'], ['Empty'], ['Guides', 'images']]);
    expect(parsed.documents).toEqual([
      { folder: [], title: 'Intro.md', content: '# Hi' },
      { folder: ['Guides'], title: 'Setup.md', content: 'x' },
    ]);
    expect(parsed.images.map((i) => [i.folder, i.name, i.contentType, Array.from(new Uint8Array(i.bytes))])).toEqual([
      [['Guides', 'images'], 'a.png', 'image/png', [1, 2, 3]],
    ]);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.renamed).toEqual([]);
  });

  it('imports a zip made by another tool', async () => {
    const parsed = await parseProjectZip(
      zip({
        'Export\\Docs\\Read me.markdown': '﻿# Hello',
        'Export/__MACOSX/._Read me.markdown': 'junk',
        'Export/.DS_Store': 'junk',
        'Export/../evil.md': 'x',
        'Export/notes.txt': 'x',
        'Export/pic.JPG': new Uint8Array([1]),
      }),
      'My export.zip',
    );
    expect(parsed.name).toBe('My export');
    expect(parsed.rendering).toBeNull();
    expect(parsed.folders).toEqual([['Docs']]);
    expect(parsed.documents).toEqual([{ folder: ['Docs'], title: 'Read me.md', content: '# Hello' }]);
    expect(parsed.images.map((i) => [i.folder, i.name, i.contentType])).toEqual([[[], 'pic.JPG', 'image/jpeg']]);
    expect(parsed.skipped).toEqual([
      { path: 'Export/../evil.md', reason: 'Unsafe path' },
      { path: 'Export/notes.txt', reason: 'Not a Markdown document or image' },
    ]);
  });

  it('renames names that clash ignoring case', async () => {
    const parsed = await parseProjectZip(
      zip({ 'Notes.md': 'a', 'notes.md': 'b', 'Pics/a.png': new Uint8Array([1]), 'pics/b.png': new Uint8Array([2]) }),
      'x.zip',
    );
    expect(parsed.documents.map((d) => d.title)).toEqual(['Notes.md', 'notes 2.md']);
    expect(parsed.folders).toEqual([['Pics'], ['pics 2']]);
    expect(parsed.images.map((i) => i.folder)).toEqual([['Pics'], ['pics 2']]);
    expect(parsed.renamed).toEqual([
      { from: 'pics', to: 'pics 2' },
      { from: 'notes.md', to: 'notes 2.md' },
    ]);
  });

  it('skips images over 5 MB', async () => {
    const parsed = await parseProjectZip(zip({ 'big.png': new Uint8Array(MAX_IMAGE_BYTES + 1), 'a.md': 'x' }), 'x.zip');
    expect(parsed.images).toEqual([]);
    expect(parsed.skipped).toEqual([{ path: 'big.png', reason: 'Larger than 5 MB' }]);
  });

  it('ignores a manifest that isn’t md.IT’s, and cleans a bad rendering block', async () => {
    const foreign = await parseProjectZip(zip({ 'mdit.json': '{"format":"other","name":"X"}', 'a.md': 'x' }), 'Mine.zip');
    expect(foreign.name).toBe('Mine');
    expect(foreign.rendering).toBeNull();
    const bad = await parseProjectZip(zip({ 'mdit.json': manifest({ rendering: { padding: 999, font: 'comic' } }), 'a.md': 'x' }), 'x.zip');
    expect(bad.rendering).toEqual({ ...DEFAULT_RENDERING, padding: 96 });
  });

  it('rejects files that aren’t zips', async () => {
    await expect(parseProjectZip(strToU8('hello'), 'x.zip')).rejects.toThrow(IMPORT_ERRORS.notZip);
  });

  it('rejects zips with too many entries', async () => {
    const files = Object.fromEntries(Array.from({ length: MAX_ENTRIES + 1 }, (_, n) => [`d${n}.md`, 'x']));
    await expect(parseProjectZip(zip(files), 'x.zip')).rejects.toThrow(IMPORT_ERRORS.tooLarge);
  });

  it('rejects zips with nothing to import', async () => {
    await expect(parseProjectZip(zip({ 'a.txt': 'x', 'Empty/': '' }), 'x.zip')).rejects.toThrow(IMPORT_ERRORS.empty);
  });
});
```

Order of `renamed` in the clash test: folders are placed before documents (folders first, then documents, then images), so the folder rename is listed first.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/export/importZip.test.ts`
Expected: FAIL. `./importZip` doesn't exist.

- [ ] **Step 3: Implement**

`src/store/types.ts`, append:

```ts
/** A whole project to create in one go (zip import). Folder paths are names from the project root; [] is the root. */
export interface ProjectImportData {
  name: string;
  description: string;
  /** Parents before children. */
  folders: string[][];
  documents: Array<{ folder: string[]; title: string; content: string }>;
  images: Array<{ folder: string[]; name: string; contentType: ImageType; bytes: ArrayBuffer }>;
}
```

`src/store/index.ts`:
- add `ProjectImportData` to the `export type { … } from './types'` line
- extend the `imageRules` export with `extensionOf, imageTypeOf`
- add `export { nameKey, nextAvailableName, normalizeName } from './names';`

`src/export/importZip.ts`:

```ts
import { clampRendering, type RenderingSettings } from '../settings';
import {
  extensionOf, imageTypeOf, MAX_IMAGE_BYTES, nameKey, nextAvailableName, normalizeName, userMessage, ValidationError,
  type ProjectImportData,
} from '../store';
import { MANIFEST_NAME } from './zip';

export const MAX_ENTRIES = 2000;
export const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

export const IMPORT_ERRORS = {
  notZip: 'This file isn’t a zip.',
  tooLarge: 'This zip is too large to import (over 2,000 files or 500 MB).',
  empty: 'This zip has no Markdown documents or images.',
} as const;

export const SKIP_REASONS = {
  unsafe: 'Unsafe path',
  other: 'Not a Markdown document or image',
  large: 'Larger than 5 MB',
} as const;

export interface ParsedProjectZip extends ProjectImportData {
  rendering: RenderingSettings | null;
  skipped: Array<{ path: string; reason: string }>;
  renamed: Array<{ from: string; to: string }>;
}

type Split = { segments: string[]; dir: boolean };

/** Zip entry name → path segments; 'unsafe' for anything that could escape the project, 'ignore' for OS clutter. */
function splitPath(raw: string): Split | 'unsafe' | 'ignore' {
  const path = raw.replace(/\\/g, '/');
  const dir = path.endsWith('/');
  const segments = path.split('/');
  if (dir) segments.pop();
  if (path.startsWith('/') || /^[a-z]:/i.test(path) || segments.some((s) => s === '' || s === '.' || s === '..')) return 'unsafe';
  if (segments.some((s) => s === '__MACOSX' || s.startsWith('.'))) return 'ignore';
  if (/^(thumbs\.db|desktop\.ini)$/i.test(segments[segments.length - 1] ?? '')) return 'ignore';
  return { segments, dir };
}

type Kind = 'manifest' | 'document' | 'image' | 'other';

function classify(name: string): Kind {
  if (name.toLowerCase() === MANIFEST_NAME) return 'manifest';
  if (/\.(md|markdown)$/i.test(name)) return 'document';
  return imageTypeOf(name, '') ? 'image' : 'other';
}

const keyOf = (segments: readonly string[]) => segments.join('/');

/** Reads a zip of Markdown and images into data for importProject (P-039). Nothing is written. */
export async function parseProjectZip(data: Uint8Array, fileName: string): Promise<ParsedProjectZip> {
  const { strFromU8, unzipSync } = await import('fflate');
  const skipped: ParsedProjectZip['skipped'] = [];
  let count = 0;
  let total = 0;
  let tooLarge = false;
  let files: Record<string, Uint8Array>;
  try {
    // The filter sees each entry's sizes before it is inflated: limits and skips cost nothing.
    files = unzipSync(data, {
      filter(file) {
        count += 1;
        total += file.originalSize;
        if (count > MAX_ENTRIES || total > MAX_TOTAL_BYTES) {
          tooLarge = true;
          throw new Error('too large');
        }
        const split = splitPath(file.name);
        if (split === 'ignore') return false;
        if (split === 'unsafe') {
          skipped.push({ path: file.name, reason: SKIP_REASONS.unsafe });
          return false;
        }
        if (split.dir) return true;
        const kind = classify(split.segments[split.segments.length - 1]!);
        if (kind === 'other') {
          skipped.push({ path: file.name, reason: SKIP_REASONS.other });
          return false;
        }
        if (kind === 'image' && file.originalSize > MAX_IMAGE_BYTES) {
          skipped.push({ path: file.name, reason: SKIP_REASONS.large });
          return false;
        }
        return true;
      },
    });
  } catch {
    throw new ValidationError(tooLarge ? IMPORT_ERRORS.tooLarge : IMPORT_ERRORS.notZip);
  }

  const entries = Object.entries(files).map(([name, bytes]) => ({ name, bytes, ...(splitPath(name) as Split) }));

  // A single folder holding everything (how most tools zip a folder) is not part of the project.
  const top = entries[0]?.segments[0];
  if (top !== undefined && entries.every((e) => e.segments[0] === top && (e.dir || e.segments.length > 1))) {
    for (const e of entries) e.segments = e.segments.slice(1);
  }
  const kept = entries.filter((e) => e.segments.length > 0);

  let name = fileName.replace(/\.zip$/i, '');
  let description = '';
  let rendering: RenderingSettings | null = null;
  const manifestEntry = kept.find((e) => !e.dir && e.segments.length === 1 && classify(e.segments[0]!) === 'manifest');
  if (manifestEntry) {
    try {
      const manifest = JSON.parse(strFromU8(manifestEntry.bytes)) as Record<string, unknown> | null;
      if (manifest?.format === 'mdit-project') {
        if (typeof manifest.name === 'string') name = manifest.name;
        if (typeof manifest.description === 'string') description = manifest.description;
        if ('rendering' in manifest) rendering = clampRendering(manifest.rendering);
      }
    } catch {
      // Not our manifest: the zip is imported without it.
    }
  }
  try {
    name = normalizeName(name);
  } catch {
    name = 'Imported project';
  }

  // Sibling names are unique ignoring case (P-008); later clashes get "name 2", like the store does.
  const taken = new Map<string, Set<string>>();
  const renamed: ParsedProjectZip['renamed'] = [];
  const place = (parent: readonly string[], wanted: string, stem: string, ext: string, separator: string, original: string) => {
    const k = keyOf(parent);
    const used = taken.get(k) ?? new Set<string>();
    taken.set(k, used);
    const finalName = used.has(nameKey(wanted)) ? nextAvailableName(stem, ext, [...used], separator) : wanted;
    used.add(nameKey(finalName));
    if (finalName !== wanted) renamed.push({ from: original, to: keyOf([...parent, finalName]) });
    return finalName;
  };
  const valid = (segment: string, path: string): boolean => {
    try {
      normalizeName(segment);
      return true;
    } catch (error) {
      skipped.push({ path, reason: userMessage(error) });
      return false;
    }
  };

  // Folders: from directory entries and from the parents of kept files; parents first.
  const folderPaths = new Map<string, string[]>();
  const addFolder = (segments: readonly string[]) => {
    for (let depth = 1; depth <= segments.length; depth++) {
      const path = segments.slice(0, depth);
      if (!folderPaths.has(keyOf(path))) folderPaths.set(keyOf(path), path);
    }
  };
  for (const e of kept) {
    if (e.dir) addFolder(e.segments);
    else if (classify(e.segments[e.segments.length - 1]!) !== 'manifest' || e.segments.length > 1) addFolder(e.segments.slice(0, -1));
  }
  const finalFolder = new Map<string, string[]>([['', []]]);
  const folders: string[][] = [];
  for (const path of [...folderPaths.values()].sort((a, b) => a.length - b.length)) {
    const parent = finalFolder.get(keyOf(path.slice(0, -1)));
    const folderName = path[path.length - 1]!;
    if (!parent || !valid(folderName, `${keyOf(path)}/`)) continue;
    const placed = [...parent, place(parent, folderName, folderName, '', ' ', keyOf(path))];
    finalFolder.set(keyOf(path), placed);
    folders.push(placed);
  }

  const documents: ProjectImportData['documents'] = [];
  const images: ProjectImportData['images'] = [];
  for (const e of kept) {
    if (e.dir) continue;
    const raw = e.segments[e.segments.length - 1]!;
    const kind = classify(raw);
    if (kind === 'manifest' && e.segments.length === 1) continue;
    const parent = finalFolder.get(keyOf(e.segments.slice(0, -1)));
    if (!parent) continue; // its folder was skipped and listed
    if (kind === 'document') {
      const title = raw.replace(/\.markdown$/i, '.md');
      if (!valid(title, e.name)) continue;
      const finalTitle = place(parent, title, title.slice(0, -3), title.slice(-3), ' ', e.name.replace(/\\/g, '/'));
      documents.push({ folder: parent, title: finalTitle, content: new TextDecoder('utf-8').decode(e.bytes) });
    } else if (kind === 'image') {
      if (!valid(raw, e.name)) continue;
      const ext = extensionOf(raw);
      const finalName = place(parent, raw, raw.slice(0, raw.length - ext.length), ext, '-', e.name.replace(/\\/g, '/'));
      images.push({ folder: parent, name: finalName, contentType: imageTypeOf(raw, '')!, bytes: e.bytes.slice().buffer as ArrayBuffer });
    } else {
      skipped.push({ path: e.name, reason: SKIP_REASONS.other }); // a mdit.json below the root
    }
  }

  if (documents.length === 0 && images.length === 0) throw new ValidationError(IMPORT_ERRORS.empty);
  return { name, description, rendering, folders, documents, images, skipped, renamed };
}
```

Check against the clash test: `renamed` for `notes.md` records `from: 'notes.md'` (the entry name). For the folder `pics`, `from` is `'pics'`, the original folder path.

`TextDecoder('utf-8')` removes a leading BOM and replaces invalid bytes instead of throwing.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/export/importZip.test.ts`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src ../context.md
git commit -m "feat(export): read project zips safely, with limits, skips and renames

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Import into the store, and the round trip

**Files:**
- Create: `src/store/importProject.ts`
- Modify: `src/store/index.ts`
- Test: `src/store/importProject.test.ts`, `src/export/roundTrip.test.ts`

**Interfaces:**
- Consumes: `ProjectImportData` (Task 13); store internals (`db`, `ROOT`, `hierarchyTables`, `assertNameFree`, `newId`, `normalizeName`, `withMdExtension`, `checkImageFile`, `withImageExtension`).
- Produces: `importProject(data: ProjectImportData): Promise<Project>` from `src/store`.

- [ ] **Step 1: Write the failing tests**

`src/store/importProject.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, importProject, listDocuments, listFolders, listImages, listProjectSummaries, NameConflictError, readProjectSnapshot } from '.';
import type { ProjectImportData } from './types';

beforeEach(clearDatabase);

const data = (extra: Partial<ProjectImportData> = {}): ProjectImportData => ({
  name: 'Imported',
  description: 'From a zip',
  folders: [['Guides'], ['Guides', 'images'], ['Empty']],
  documents: [
    { folder: [], title: 'Intro.md', content: '# Hi' },
    { folder: ['Guides'], title: 'Setup.md', content: 'Run.' },
  ],
  images: [{ folder: ['Guides', 'images'], name: 'a.png', contentType: 'image/png', bytes: new Uint8Array([1, 2, 3]).buffer }],
  ...extra,
});

describe('importProject', () => {
  it('creates a new project with every folder, document and image', async () => {
    const project = await importProject(data());
    expect(project).toMatchObject({ name: 'Imported', description: 'From a zip' });
    const folders = await listFolders(project.id);
    const guides = folders.find((f) => f.name === 'Guides')!;
    expect(folders.map((f) => f.name).sort()).toEqual(['Empty', 'Guides', 'images']);
    expect(folders.find((f) => f.name === 'images')!.parentFolderId).toBe(guides.id);
    expect((await listDocuments(project.id)).map((d) => [d.title, d.content, d.folderId]).sort()).toEqual([
      ['Intro.md', '# Hi', null],
      ['Setup.md', 'Run.', guides.id],
    ]);
    const [image] = await listImages(project.id);
    expect(image).toMatchObject({ name: 'a.png', contentType: 'image/png', size: 3 });
    expect(image!.sha256).toBe('039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81');
    const snapshot = await readProjectSnapshot(project.id);
    expect(Array.from(new Uint8Array(snapshot!.images[0]!.bytes))).toEqual([1, 2, 3]);
  });

  it('writes nothing when any part fails', async () => {
    const clash = data({ documents: [{ folder: [], title: 'A.md', content: '' }, { folder: [], title: 'a.md', content: '' }] });
    await expect(importProject(clash)).rejects.toBeInstanceOf(NameConflictError);
    expect(await listProjectSummaries()).toEqual([]);
  });

  it('refuses a document whose folder isn’t in the import', async () => {
    await expect(importProject(data({ documents: [{ folder: ['Nowhere'], title: 'A.md', content: '' }] }))).rejects.toThrow('“Nowhere” is missing');
    expect(await listProjectSummaries()).toEqual([]);
  });

  it('allows a name another project already has', async () => {
    await importProject(data());
    await importProject(data());
    expect((await listProjectSummaries()).map((p) => p.name)).toEqual(['Imported', 'Imported']);
  });
});
```

(`039058c6…fb81` is the SHA-256 of the bytes `01 02 03`, checked with Node's `crypto` while planning.)

`src/export/roundTrip.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RENDERING, type RenderingSettings } from '../settings';
import {
  addImage, clearDatabase, createDocument, createFolder, createProject, importProject, readProjectSnapshot, saveDocumentContent,
  setProjectDescription, type ProjectSnapshot,
} from '../store';
import { parseProjectZip } from './importZip';
import { exportProjectZip, folderSegments } from './zip';

beforeEach(clearDatabase);

/** Everything that must survive, independent of ids and order. */
function describeTree(snapshot: ProjectSnapshot): string[] {
  const segments = folderSegments(snapshot.folders);
  const dir = (id: string | null) => (id ? `${segments.get(id)!.join('/')}/` : '');
  return [
    ...snapshot.folders.map((f) => `folder ${dir(f.id)}`),
    ...snapshot.documents.map((d) => `doc ${dir(d.folderId)}${d.title} ${d.content}`),
    ...snapshot.images.map((i) => `image ${dir(i.folderId)}${i.name} ${i.contentType} ${i.sha256} ${Array.from(new Uint8Array(i.bytes)).join(',')}`),
  ].sort();
}

describe('project zip round trip', () => {
  it('brings back the same tree, contents, images, description and settings', async () => {
    const project = await createProject('Round trip');
    await setProjectDescription(project.id, 'Everything, twice');
    const guides = await createFolder(project.id, null, 'Guides');
    const deep = await createFolder(project.id, guides.id, 'Über');
    await createFolder(project.id, null, 'Empty');
    const intro = await createDocument(project.id, null, 'Intro');
    await saveDocumentContent(intro.id, '# Hi 👋\n\n![a](Guides/%C3%9Cber/a.png)');
    const setup = await createDocument(project.id, deep.id, 'Setup');
    await saveDocumentContent(setup.id, 'Run it.');
    await addImage(project.id, deep.id, { name: 'a.png', type: 'image/png', bytes: new Uint8Array([137, 80, 78, 71, 1, 2]).buffer });
    const rendering: RenderingSettings = { ...DEFAULT_RENDERING, font: 'sans', padding: 24 };

    const before = (await readProjectSnapshot(project.id))!;
    const parsed = await parseProjectZip(await exportProjectZip(before, rendering), 'ignored.zip');
    expect(parsed.rendering).toEqual(rendering);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.renamed).toEqual([]);

    const copy = await importProject(parsed);
    const after = (await readProjectSnapshot(copy.id))!;
    expect(after.project).toMatchObject({ name: 'Round trip', description: 'Everything, twice' });
    expect(describeTree(after)).toEqual(describeTree(before));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/store/importProject.test.ts src/export/roundTrip.test.ts`
Expected: FAIL. `importProject` isn't exported.

- [ ] **Step 3: Implement** — `src/store/importProject.ts`

```ts
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { db, now, ROOT, type DocumentRow, type FolderRow, type ImageRow } from './db';
import { ValidationError } from './errors';
import { assertNameFree, hierarchyTables } from './guards';
import { newId } from './ids';
import { checkImageFile, withImageExtension } from './imageRules';
import { normalizeName, withMdExtension } from './names';
import type { Project, ProjectImportData } from './types';

/** Creates a new project from imported data in one transaction: all of it, or nothing (P-039). */
export async function importProject(data: ProjectImportData): Promise<Project> {
  const name = normalizeName(data.name);
  // crypto.subtle is missing on plain-HTTP pages, so hash in JS (P-026), before the transaction.
  const hashes = data.images.map((image) => bytesToHex(sha256(new Uint8Array(image.bytes))));
  return db.transaction('rw', hierarchyTables(), async () => {
    const at = now();
    const project: Project = { id: newId(), name, description: data.description, createdAt: at, updatedAt: at };
    await db.projects.add(project);

    const folderIds = new Map<string, string>([['', ROOT]]);
    const taken = new Map<string, string[]>();
    const parentOf = (path: readonly string[]): string => {
      const id = folderIds.get(path.join('/'));
      if (id === undefined) throw new ValidationError(`The folder “${path.join('/')}” is missing from this import.`);
      return id;
    };
    const claim = (parent: string, itemName: string) => {
      const names = taken.get(parent) ?? [];
      assertNameFree(itemName, names);
      names.push(itemName);
      taken.set(parent, names);
    };

    for (const path of data.folders) {
      const parent = parentOf(path.slice(0, -1));
      const folderName = normalizeName(path[path.length - 1] ?? '');
      claim(parent, folderName);
      const row: FolderRow = { id: newId(), projectId: project.id, parentFolderId: parent, name: folderName, createdAt: at, updatedAt: at };
      await db.folders.add(row);
      folderIds.set(path.join('/'), row.id);
    }
    for (const doc of data.documents) {
      const folderId = parentOf(doc.folder);
      const title = withMdExtension(normalizeName(doc.title));
      claim(folderId, title);
      const row: DocumentRow = { id: newId(), projectId: project.id, folderId, title, content: doc.content, dirty: true, createdAt: at, updatedAt: at };
      await db.documents.add(row);
    }
    for (const [i, image] of data.images.entries()) {
      const folderId = parentOf(image.folder);
      const type = checkImageFile(image.name, image.contentType, image.bytes.byteLength);
      const imageName = withImageExtension(normalizeName(image.name), type);
      claim(folderId, imageName);
      const row: ImageRow = {
        id: newId(), projectId: project.id, folderId, name: imageName, contentType: type, size: image.bytes.byteLength, sha256: hashes[i]!,
        createdAt: at, updatedAt: at,
      };
      await db.images.add(row);
      await db.imageData.add({ id: row.id, bytes: image.bytes });
    }
    return project;
  });
}
```

`src/store/index.ts`, add: `export { importProject } from './importProject';`

The "missing folder" test expects the message to contain `“Nowhere” is missing`. The message is `The folder “Nowhere” is missing from this import.`

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/store src/export`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src ../context.md
git commit -m "feat(store): atomic project import; zip round trip test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Export menu and export actions

**Files:**
- Create: `src/export/download.ts`, `src/export/actions.ts`, `src/export/index.ts`, `src/app/ExportMenu.tsx`
- Modify: `src/app/Workspace.tsx`
- Test: `src/export/actions.test.ts`, `src/app/ExportMenu.test.tsx`, `src/app/Workspace.test.tsx`

**Interfaces:**
- Consumes: `buildExportHtml`, `ExportDeps`, `exportDeps` (Task 10); `printHtml` (Task 11); `exportProjectZip` (Task 12); `parseProjectZip`, `ParsedProjectZip` (Task 13); `safeFileName`, `fileStem` (Task 9); `readProjectSnapshot`, `getSetting`, `SETTINGS`, `ValidationError` (store); `clampRendering`, `RenderingSettings` (Task 1); `EditorHandle.getText` (Task 4).
- Produces:
  - `download(fileName: string, blob: Blob): void`, `bytesBlob(bytes: Uint8Array, type: string): Blob`
  - `type DocumentExportKind = 'markdown' | 'html' | 'pdf'`
  - `interface ExportEnv { save: (fileName: string, blob: Blob) => void; print: (html: string, title: string) => Promise<void>; deps: ExportDeps }`
  - `exportDocument(kind: DocumentExportKind, args: { projectId: string; docId: string; text: string; rendering: RenderingSettings }, env?: ExportEnv): Promise<void>`
  - `exportProject(projectId: string, env?: Pick<ExportEnv, 'save'>): Promise<void>` (reads the stored rendering settings)
  - `src/export/index.ts` exports the above, plus `parseProjectZip`, `ParsedProjectZip`, `IMPORT_ERRORS`
  - `type ExportKind = DocumentExportKind | 'zip'`; `ExportMenu(props: { canExportDocument: boolean; onExport: (kind: ExportKind) => void })`

- [ ] **Step 1: Write the failing tests**

`src/export/actions.test.ts`:

```ts
import { strFromU8, unzipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RENDERING } from '../settings';
import { clearDatabase, createDocument, createProject, saveDocumentContent } from '../store';
import { exportDocument, exportProject, type ExportEnv } from './actions';

beforeEach(clearDatabase);

function testEnv() {
  const saved: Array<{ name: string; blob: Blob }> = [];
  const env: ExportEnv = {
    save: (name, blob) => saved.push({ name, blob }),
    print: vi.fn(async () => {}),
    deps: { baseCss: '', mathCss: '', fontCss: '', fetchBytes: async () => new Uint8Array() },
  };
  return { saved, env };
}

async function setup() {
  const project = await createProject('OS');
  const doc = await createDocument(project.id, null, 'Intro');
  await saveDocumentContent(doc.id, 'saved text');
  return { project, doc };
}

describe('exportDocument', () => {
  it('saves the given text as Markdown, named after the document', async () => {
    const { project, doc } = await setup();
    const { saved, env } = testEnv();
    await exportDocument('markdown', { projectId: project.id, docId: doc.id, text: '# Typed', rendering: DEFAULT_RENDERING }, env);
    expect(saved[0]!.name).toBe('Intro.md');
    expect(saved[0]!.blob.type).toBe('text/markdown;charset=utf-8');
    expect(await saved[0]!.blob.text()).toBe('# Typed');
  });

  it('saves HTML with the given settings', async () => {
    const { project, doc } = await setup();
    const { saved, env } = testEnv();
    await exportDocument('html', { projectId: project.id, docId: doc.id, text: '# Typed', rendering: { ...DEFAULT_RENDERING, padding: 16 } }, env);
    expect(saved[0]!.name).toBe('Intro.html');
    const html = await saved[0]!.blob.text();
    expect(html).toContain('<title>Intro</title>');
    expect(html).toContain('--doc-padding: 16px');
  });

  it('prints PDF without copy buttons', async () => {
    const { project, doc } = await setup();
    const { env } = testEnv();
    await exportDocument('pdf', { projectId: project.id, docId: doc.id, text: '```js\nx\n```', rendering: DEFAULT_RENDERING }, env);
    expect(env.print).toHaveBeenCalledWith(expect.not.stringContaining('md-code-copy'), 'Intro');
  });

  it('says so when the document is gone', async () => {
    const { project } = await setup();
    const { env } = testEnv();
    await expect(exportDocument('markdown', { projectId: project.id, docId: 'nope', text: '', rendering: DEFAULT_RENDERING }, env)).rejects.toThrow(
      'This document no longer exists.',
    );
  });
});

describe('exportProject', () => {
  it('saves a zip named after the project', async () => {
    const { project } = await setup();
    const { saved, env } = testEnv();
    await exportProject(project.id, env);
    expect(saved[0]!.name).toBe('OS.zip');
    expect(saved[0]!.blob.type).toBe('application/zip');
    const files = unzipSync(new Uint8Array(await saved[0]!.blob.arrayBuffer()));
    expect(strFromU8(files['OS/Intro.md']!)).toBe('saved text');
  });
});
```

`src/app/ExportMenu.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExportMenu } from './ExportMenu';

describe('ExportMenu', () => {
  it('offers document exports only when a document is ready', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportMenu canExportDocument={false} onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    for (const name of ['Export Markdown', 'Export HTML', 'Export PDF']) expect(screen.getByRole('menuitem', { name })).toBeDisabled();
    await user.click(screen.getByRole('menuitem', { name: 'Export project (.zip)' }));
    expect(onExport).toHaveBeenCalledWith('zip');
  });

  it('reports the chosen document export', async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ExportMenu canExportDocument onExport={onExport} />);
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export HTML' }));
    expect(onExport).toHaveBeenCalledWith('html');
  });
});
```

`src/app/Workspace.test.tsx`. After the imports, add:

```tsx
const saved = vi.hoisted(() => [] as Array<{ name: string; blob: Blob }>);
vi.mock('../export/download', () => ({
  download: (name: string, blob: Blob) => saved.push({ name, blob }),
  bytesBlob: (bytes: Uint8Array, type: string) => new Blob([new Uint8Array(bytes)], { type }),
}));
```

Change `beforeEach(clearDatabase);` to:

```tsx
beforeEach(async () => {
  saved.length = 0;
  await clearDatabase();
});
```

Add `act` to the testing-library import, and add the test:

```tsx
  it('exports the text typed just now', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument('# Hello');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    const view = EditorView.findFromDOM(container.querySelector<HTMLElement>('.cm-editor')!)!;
    act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: '\n\nJust typed' } }));
    await user.click(screen.getByRole('button', { name: 'Export' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export Markdown' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]!.name).toBe('Intro.md');
    expect(await saved[0]!.blob.text()).toBe('# Hello\n\nJust typed');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/export/actions.test.ts src/app/ExportMenu.test.tsx src/app/Workspace.test.tsx`
Expected: FAIL. The modules are missing, and there is no Export button.

- [ ] **Step 3: Implement**

`src/export/download.ts`:

```ts
/** Save a file through a temporary <a download>; the object URL is released a second later. */
export function download(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Blob parts must be backed by an ArrayBuffer; copying also detaches the blob from the caller's buffer. */
export function bytesBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}
```

`src/export/actions.ts`:

```ts
import { clampRendering, type RenderingSettings } from '../settings';
import { getSetting, readProjectSnapshot, SETTINGS, ValidationError } from '../store';
import { bytesBlob, download } from './download';
import { exportDeps } from './exportDeps';
import { fileStem, safeFileName } from './files';
import { buildExportHtml, type ExportDeps } from './html';
import { printHtml } from './print';
import { exportProjectZip } from './zip';

export type DocumentExportKind = 'markdown' | 'html' | 'pdf';

export interface ExportEnv {
  save: (fileName: string, blob: Blob) => void;
  print: (html: string, title: string) => Promise<void>;
  deps: ExportDeps;
}

const defaultEnv: ExportEnv = { save: download, print: printHtml, deps: exportDeps };

export interface DocumentExportArgs {
  projectId: string;
  docId: string;
  /** The editor's current text: includes keystrokes not yet saved or previewed. */
  text: string;
  rendering: RenderingSettings;
}

export async function exportDocument(kind: DocumentExportKind, args: DocumentExportArgs, env: ExportEnv = defaultEnv): Promise<void> {
  const snapshot = await readProjectSnapshot(args.projectId);
  const doc = snapshot?.documents.find((d) => d.id === args.docId);
  if (!snapshot || !doc) throw new ValidationError('This document no longer exists.');
  const stem = safeFileName(fileStem(doc.title));
  if (kind === 'markdown') {
    env.save(`${stem}.md`, new Blob([args.text], { type: 'text/markdown;charset=utf-8' }));
    return;
  }
  const html = await buildExportHtml(
    { markdown: args.text, title: doc.title, folderId: doc.folderId, snapshot, rendering: args.rendering, mode: kind },
    env.deps,
  );
  if (kind === 'html') env.save(`${stem}.html`, new Blob([html], { type: 'text/html;charset=utf-8' }));
  else await env.print(html, stem);
}

export async function exportProject(projectId: string, env: Pick<ExportEnv, 'save'> = defaultEnv): Promise<void> {
  const snapshot = await readProjectSnapshot(projectId);
  if (!snapshot) throw new ValidationError('This project isn’t in this browser.');
  const rendering = clampRendering(await getSetting<unknown>(SETTINGS.rendering, null));
  env.save(`${safeFileName(snapshot.project.name)}.zip`, bytesBlob(await exportProjectZip(snapshot, rendering), 'application/zip'));
}
```

`src/export/index.ts`:

```ts
export { exportDocument, exportProject, type DocumentExportArgs, type DocumentExportKind, type ExportEnv } from './actions';
export { IMPORT_ERRORS, parseProjectZip, type ParsedProjectZip } from './importZip';
```

`src/app/ExportMenu.tsx`:

```tsx
import type { DocumentExportKind } from '../export';
import { MenuButton, type MenuItem } from '../ui';

export type ExportKind = DocumentExportKind | 'zip';

export function ExportMenu({ canExportDocument, onExport }: { canExportDocument: boolean; onExport: (kind: ExportKind) => void }) {
  const documentItem = (label: string, kind: DocumentExportKind): MenuItem => ({ label, disabled: !canExportDocument, onSelect: () => onExport(kind) });
  return (
    <MenuButton
      icon="download"
      label="Export"
      items={[
        documentItem('Export Markdown', 'markdown'),
        documentItem('Export HTML', 'html'),
        documentItem('Export PDF', 'pdf'),
        'separator',
        { label: 'Export project (.zip)', onSelect: () => onExport('zip') },
      ]}
    />
  );
}
```

`src/app/Workspace.tsx`:
- import `{ exportDocument, exportProject } from '../export'` and `{ ExportMenu, type ExportKind } from './ExportMenu'`
- after `clearReveal`, add:

```tsx
  const runExport = useCallback(
    async (kind: ExportKind) => {
      try {
        if (kind === 'zip') {
          await exportProject(projectId);
          return;
        }
        if (!docId) return;
        saveNow();
        // The editor's text, not the debounced preview: the export includes the last keystroke.
        const text = editorRef.current?.getText() ?? draft.previewSource;
        await exportDocument(kind, { projectId, docId, text, rendering });
      } catch (error) {
        showNotice(`Couldn’t export: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [projectId, docId, saveNow, draft.previewSource, rendering, showNotice],
  );
```

- in `.ws-right`, put `<ExportMenu canExportDocument={docReady} onExport={(kind) => void runExport(kind)} />` right after the hidden image `<input>`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/export src/app`
Expected: PASS.

- [ ] **Step 5: All checks, log, commit**

```bash
git add src ../context.md
git commit -m "feat(app): Export menu for Markdown, HTML, PDF and project zip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Import project, and Export .zip from the project list

**Files:**
- Create: `src/app/ImportDialog.tsx`
- Modify: `src/app/ProjectList.tsx`, `src/app/app.css`, `src/ui/components.css`
- Test: `src/app/ImportDialog.test.tsx`, `src/app/ProjectList.test.tsx`

**Interfaces:**
- Consumes: `parseProjectZip`, `ParsedProjectZip`, `exportProject` (`src/export`); `importProject`, `getSetting`, `setSetting`, `SETTINGS`, `userMessage` (store); `clampRendering`, `sameRendering` (settings); `plural` (`src/lib/text.ts`).
- Produces: `ImportDialog(props: { file: File; onClose: () => void; onImported: (projectId: string) => void })`; `.md-check` (checkbox row) in the app extensions block.

- [ ] **Step 1: Write the failing tests**

`src/app/ImportDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { strToU8, zipSync } from 'fflate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RENDERING } from '../settings';
import { clearDatabase, getSetting, listDocuments, listProjectSummaries, setSetting, SETTINGS } from '../store';
import { ImportDialog } from './ImportDialog';

beforeEach(clearDatabase);

const zipFile = (files: Record<string, string>, name = 'Notes.zip') =>
  new File([new Uint8Array(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))))], name, { type: 'application/zip' });

const manifest = (padding: number) =>
  JSON.stringify({ format: 'mdit-project', version: 1, name: 'Notes', description: '', exportedAt: '', rendering: { ...DEFAULT_RENDERING, padding } });

describe('ImportDialog', () => {
  it('summarises the zip, lists what was skipped and imports on request', async () => {
    const user = userEvent.setup();
    const onImported = vi.fn();
    const files: Record<string, string> = { 'Notes/mdit.json': manifest(16), 'Notes/a.md': '# A' };
    for (let n = 1; n <= 7; n++) files[`Notes/junk${n}.txt`] = 'x';
    render(<ImportDialog file={zipFile(files)} onClose={vi.fn()} onImported={onImported} />);
    expect(await screen.findByRole('dialog', { name: 'Import “Notes”' })).toBeInTheDocument();
    expect(screen.getByText('1 document, 0 images, 0 folders')).toBeInTheDocument();
    expect(screen.getByText('7 files weren’t imported:')).toBeInTheDocument();
    expect(screen.getByText('Notes/junk1.txt — Not a Markdown document or image')).toBeInTheDocument();
    expect(screen.getByText('and 2 more')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Use its rendering settings' }));
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await vi.waitFor(() => expect(onImported).toHaveBeenCalled());
    const [project] = await listProjectSummaries();
    expect(onImported).toHaveBeenCalledWith(project!.id);
    expect((await listDocuments(project!.id)).map((d) => d.title)).toEqual(['a.md']);
    expect(await getSetting(SETTINGS.rendering, null)).toMatchObject({ padding: 16 });
  });

  it('leaves the settings alone unless asked, and hides the choice when they match', async () => {
    const user = userEvent.setup();
    await setSetting(SETTINGS.rendering, { ...DEFAULT_RENDERING, padding: 16 });
    render(<ImportDialog file={zipFile({ 'mdit.json': manifest(16), 'a.md': 'x' })} onClose={vi.fn()} onImported={vi.fn()} />);
    await screen.findByRole('dialog', { name: 'Import “Notes”' });
    expect(screen.queryByRole('checkbox')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await vi.waitFor(async () => expect(await listProjectSummaries()).toHaveLength(1));
    expect(await getSetting(SETTINGS.rendering, null)).toMatchObject({ padding: 16 });
  });

  it('explains a file that isn’t a zip', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImportDialog file={new File(['hello'], 'notes.txt')} onClose={onClose} onImported={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: 'Couldn’t import notes.txt' })).toBeInTheDocument();
    expect(screen.getByText('This file isn’t a zip.')).toBeInTheDocument();
    // Two buttons are named "Close": the header's IconButton and the action; the action comes last.
    await user.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });
});
```

`src/app/ProjectList.test.tsx`: add `fireEvent` to the testing-library import, then add after the imports:

```tsx
const saved = vi.hoisted(() => [] as Array<{ name: string; blob: Blob }>);
vi.mock('../export/download', () => ({
  download: (name: string, blob: Blob) => saved.push({ name, blob }),
  bytesBlob: (bytes: Uint8Array, type: string) => new Blob([new Uint8Array(bytes)], { type }),
}));
```

(`vi` joins the vitest import.) Then add these tests:

```tsx
  it('imports a project zip and opens it', async () => {
    const user = userEvent.setup();
    const { container } = renderList();
    await screen.findByText('No projects yet');
    const data = zipSync({ 'Notes/a.md': strToU8('# A') });
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [new File([new Uint8Array(data)], 'Notes.zip', { type: 'application/zip' })] },
    });
    await user.click(await screen.findByRole('button', { name: 'Import' }));
    expect(await screen.findByText(/^Opened /)).toBeInTheDocument();
    expect((await listProjectSummaries()).map((p) => p.name)).toEqual(['Notes']);
  });

  it('exports a project as a zip from its menu', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Intro');
    renderList();
    await user.click(await screen.findByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export .zip' }));
    await waitFor(() => expect(saved.map((s) => s.name)).toEqual(['OS.zip']));
  });
```

Add `import { strToU8, zipSync } from 'fflate';` to the file. Reset `saved.length = 0` in a `beforeEach` (combine it with the existing `beforeEach(clearDatabase)` as in Task 15).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/ImportDialog.test.tsx src/app/ProjectList.test.tsx`
Expected: FAIL. `ImportDialog` is missing, and there is no file input or "Export .zip".

- [ ] **Step 3: Implement**

`src/ui/components.css`, app extensions block:

```css
.md-check { display: flex; align-items: center; gap: var(--space-2); font: 400 14px/20px var(--font-sans); color: var(--ink); cursor: pointer; }
.md-check input { margin: 0; accent-color: var(--accent); }
.md-check input:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
```

`src/app/app.css`, append:

```css
.projects-actions { display: flex; align-items: center; gap: var(--space-2); }
.import-skipped { margin: 0 0 var(--space-3); padding-left: 1.2em; font: 400 13px/20px var(--font-sans); overflow-wrap: anywhere; }
```

`src/app/ImportDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { parseProjectZip, type ParsedProjectZip } from '../export';
import { plural } from '../lib/text';
import { clampRendering, sameRendering } from '../settings';
import { getSetting, importProject, setSetting, SETTINGS, userMessage } from '../store';
import { Button, Dialog } from '../ui';

type State = { status: 'reading' } | { status: 'ready'; parsed: ParsedProjectZip; differs: boolean } | { status: 'failed'; message: string };

export interface ImportDialogProps {
  file: File;
  onClose: () => void;
  onImported: (projectId: string) => void;
}

const SHOWN_SKIPS = 5;

export function ImportDialog({ file, onClose, onImported }: ImportDialogProps) {
  const [state, setState] = useState<State>({ status: 'reading' });
  const [useSettings, setUseSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const parsed = await parseProjectZip(new Uint8Array(await file.arrayBuffer()), file.name);
        const current = clampRendering(await getSetting<unknown>(SETTINGS.rendering, null));
        const differs = parsed.rendering !== null && !sameRendering(parsed.rendering, current);
        if (!cancelled) setState({ status: 'ready', parsed, differs });
      } catch (err) {
        if (!cancelled) setState({ status: 'failed', message: userMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (state.status === 'reading') {
    return (
      <Dialog title="Import project" onClose={onClose}>
        <p aria-busy="true">Reading “{file.name}”…</p>
      </Dialog>
    );
  }
  if (state.status === 'failed') {
    return (
      <Dialog title={`Couldn’t import ${file.name}`} onClose={onClose} actions={<Button onClick={onClose}>Close</Button>}>
        <p>{state.message}</p>
      </Dialog>
    );
  }

  const { parsed, differs } = state;
  const skipped = parsed.skipped.length;
  const renamed = parsed.renamed.length;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const project = await importProject(parsed);
      if (useSettings && parsed.rendering) await setSetting(SETTINGS.rendering, parsed.rendering);
      onImported(project.id);
    } catch (err) {
      setError(userMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={`Import “${parsed.name}”`}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            Import
          </Button>
        </>
      }
    >
      <p>{`${plural(parsed.documents.length, 'document')}, ${plural(parsed.images.length, 'image')}, ${plural(parsed.folders.length, 'folder')}`}</p>
      {skipped > 0 && (
        <>
          <p>{skipped === 1 ? '1 file wasn’t imported:' : `${skipped} files weren’t imported:`}</p>
          <ul className="import-skipped">
            {parsed.skipped.slice(0, SHOWN_SKIPS).map((s) => (
              <li key={s.path}>{`${s.path} — ${s.reason}`}</li>
            ))}
          </ul>
          {skipped > SHOWN_SKIPS && <p>{`and ${skipped - SHOWN_SKIPS} more`}</p>}
        </>
      )}
      {renamed > 0 && <p>{renamed === 1 ? '1 name was changed to avoid duplicates.' : `${renamed} names were changed to avoid duplicates.`}</p>}
      {differs && (
        <label className="md-check">
          <input type="checkbox" checked={useSettings} onChange={(event) => setUseSettings(event.currentTarget.checked)} />
          Use its rendering settings
        </label>
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

`src/app/ProjectList.tsx`:
- Imports: `useRef` with `useState`; `{ exportProject } from '../export'`; add `userMessage` to the store import; add `Callout`, `IconButton` to the `../ui` import; `{ ImportDialog } from './ImportDialog'`.
- `ProjectDialog` gains `| { kind: 'import'; file: File }`.
- In the component, add:

```tsx
  const importInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const exportZip = (project: ProjectSummary) =>
    void exportProject(project.id).catch((err: unknown) => setError(`Couldn’t export: ${userMessage(err)}`));
```

- The `projects-head` block becomes:

```tsx
        <div className="projects-head">
          <h1>Projects</h1>
          <div className="projects-actions">
            <Button onClick={() => importInputRef.current?.click()}>Import project</Button>
            {projects && projects.length > 0 && newProjectButton}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            tabIndex={-1}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) setDialog({ kind: 'import', file });
            }}
          />
        </div>
        {error && (
          <Callout tone="danger" actions={<IconButton icon="x" label="Dismiss" onClick={() => setError(null)} />}>
            {error}
          </Callout>
        )}
```

- In the row menu, after "Edit description", add `{ label: 'Export .zip', icon: 'download', onSelect: () => exportZip(project) },`.
- After the other dialogs, add:

```tsx
      {dialog?.kind === 'import' && (
        <ImportDialog
          file={dialog.file}
          onClose={close}
          onImported={(id) => {
            close();
            open(id);
          }}
        />
      )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app`
Expected: PASS, including the existing ProjectList tests. The empty state still shows its own "New project" button; the head now also has "Import project".

- [ ] **Step 5: All checks, log, commit**

```bash
git add src ../context.md
git commit -m "feat(app): import a project zip, and export .zip from the project list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Offline reload (service worker)

**Files:**
- Create: `src/app/UpdateNotice.tsx`, `src/test/pwa-register.ts`
- Modify: `package.json`, `package-lock.json`, `vite.config.ts`, `src/vite-env.d.ts`, `src/app/App.tsx`, `src/app/app.css`
- Test: `src/app/UpdateNotice.test.tsx`

**Interfaces:**
- Consumes: `registerSW` from `virtual:pwa-register` (vite-plugin-pwa).
- Produces: `UpdateNotice(props: { enabled?: boolean; register?: RegisterFn })`, where `RegisterFn = (options: { onNeedRefresh?: () => void }) => (reloadPage?: boolean) => Promise<void>`. `dist/sw.js` precaches the build.

- [ ] **Step 1: Install**

Run: `npm install -D vite-plugin-pwa@^1.3.0`
Expected: added to `devDependencies`; npm also installs its `workbox-*` peers.

- [ ] **Step 2: Write the failing test** — `src/app/UpdateNotice.test.tsx`

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UpdateNotice } from './UpdateNotice';

describe('UpdateNotice', () => {
  it('offers a reload once a new version is waiting', async () => {
    const updateSW = vi.fn(async () => {});
    let onNeedRefresh: (() => void) | undefined;
    const register = vi.fn((options: { onNeedRefresh?: () => void }) => {
      onNeedRefresh = options.onNeedRefresh;
      return updateSW;
    });
    render(<UpdateNotice enabled register={register} />);
    expect(screen.queryByText('A new version of md.IT is ready.')).toBeNull();
    act(() => onNeedRefresh!());
    expect(screen.getByText('A new version of md.IT is ready.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(updateSW).toHaveBeenCalledWith(true);
  });

  it('registers nothing when disabled (development and tests)', () => {
    const register = vi.fn();
    render(<UpdateNotice enabled={false} register={register} />);
    expect(register).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/app/UpdateNotice.test.tsx`
Expected: FAIL. `./UpdateNotice` doesn't exist.

- [ ] **Step 4: Implement**

`vite.config.ts`:

```ts
/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Offline reload (P-032): precache the build; a waiting update is announced, never forced.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/test/pwa-register.ts', import.meta.url)) },
  },
});
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

`src/test/pwa-register.ts`:

```ts
/** Stand-in for vite-plugin-pwa's virtual module in tests. */
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
```

`src/app/UpdateNotice.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { Button, Callout } from '../ui';

type UpdateFn = (reloadPage?: boolean) => Promise<void>;
export type RegisterFn = (options: { onNeedRefresh?: () => void }) => UpdateFn;

/** Registers the service worker (production only) and offers a reload when a new version is waiting (P-032). */
export function UpdateNotice({ enabled = import.meta.env.PROD, register = registerSW }: { enabled?: boolean; register?: RegisterFn }) {
  const [update, setUpdate] = useState<UpdateFn | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const updateSW = register({ onNeedRefresh: () => setUpdate(() => updateSW) });
  }, [enabled, register]);
  if (!update) return null;
  return (
    <div className="update-notice" role="status">
      <Callout
        tone="info"
        actions={
          <Button size="sm" onClick={() => void update(true)}>
            Reload
          </Button>
        }
      >
        A new version of md.IT is ready.
      </Callout>
    </div>
  );
}
```

`src/app/App.tsx`: import `UpdateNotice`. Wrap the returned `<Routes>…</Routes>` in a fragment, with `<UpdateNotice />` after it.

`src/app/app.css`, append:

```css
.update-notice { position: fixed; left: 50%; bottom: var(--space-4); transform: translateX(-50%); width: min(480px, calc(100% - var(--space-8))); z-index: 40; }
```

- [ ] **Step 5: Run the tests and build**

Run: `npx vitest run src/app && npm run build && ls dist/sw.js dist/workbox-*.js && grep -o '"url":"[^"]*index.html"' dist/sw.js | head -1 && grep -c 'woff2' dist/sw.js`
Expected: tests PASS; `sw.js` and a `workbox-*.js` exist; the precache list has `index.html`, and `woff2` appears in it. If the build warns that some asset is over the precache size limit, note its name and size in the log and raise `maximumFileSizeToCacheInBytes` only as far as needed.

- [ ] **Step 6: nginx check**

`frontend/nginx/*.conf` serves everything outside `/assets/` from `location /` with `Cache-Control: no-cache`, which covers `sw.js` and `workbox-*.js`. Confirm by reading the file. Nothing changes unless that's not the case. The CSP has no `worker-src`, so it falls back to `script-src 'self'`, which allows `/sw.js`.

- [ ] **Step 7: All checks, log, commit**

```bash
git add package.json package-lock.json vite.config.ts src ../context.md
git commit -m "feat(app): service worker for offline reload, with an update notice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Verification and docs

**Files:**
- Modify: `README.md`, `context.md`, `decisions.md`
- Scratch (not committed): a Playwright script in the session scratchpad

**Interfaces:**
- Consumes: the whole branch.
- Produces: evidence for spec §14 acceptance, and updated docs.

- [ ] **Step 1: Clean install and all checks**

```bash
rm -rf node_modules && npm ci
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all green. Record the test count.

- [ ] **Step 2: Bundle check**

```bash
ls -S dist/assets | head -20
grep -l "flowchart-v2" dist/assets/index-*.js || echo "main bundle has no Mermaid code"
grep -l "invalid zip data" dist/assets/index-*.js || echo "main bundle has no fflate code"
```

Expected: both "no … code" lines print. Note the size of `index-*.js` in the log.

- [ ] **Step 3: Container**

From the repo root:

```bash
docker build -t mdit-frontend frontend
docker run --rm -d -p 8080:80 --name mdit-p3 mdit-frontend
curl -sI http://localhost:8080/sw.js | grep -i -E "^(HTTP|cache-control|content-security-policy)"
```

Expected: `200`, `Cache-Control: no-cache`, CSP present.

- [ ] **Step 4: Browser check (headless Edge, as in Phase 2)**

In the scratchpad directory: `npm init -y && npm install playwright-core@latest`, save a 1×1 PNG as `pixel.png` (as in the Phase 2 plan), and write `check.mjs`:

```js
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const SAMPLE = [
  '# Check',
  'Plain words with `code`, a [link](https://example.com) and Привет.',
  '## Diagram',
  '```mermaid\nflowchart TD\n  A-->B\n```',
  '## Math',
  'Inline $e^{i\\pi}+1=0$.',
  '$$\n\\int_0^1 x\\,dx\n$$',
  '## Code',
  '```js\nconst needle = 1;\n```',
].join('\n\n');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));

// Project, document, image
await page.goto(BASE);
await page.getByRole('button', { name: 'New project' }).first().click();
await page.getByLabel('Name').fill('Phase 3 check');
await page.keyboard.press('Enter');
await page.getByRole('button', { name: 'Create document' }).click();
await page.keyboard.press('Enter');
await page.locator('.cm-content').click();
await page.keyboard.insertText(SAMPLE);
await page.locator('input[type="file"][accept^="image"]').setInputFiles('pixel.png');
await page.waitForSelector('.md-prose img[src^="blob:"]');
await page.waitForSelector('.md-mermaid[data-state="done"] svg', { timeout: 20000 });

// Settings, outline, stats
await page.getByRole('button', { name: 'Show panel' }).click();
await page.getByRole('radio', { name: 'Settings' }).click();
await page.getByRole('radio', { name: 'Sans' }).click();
await page.getByRole('slider', { name: 'Padding' }).fill('24');
const proseVars = await page.locator('.md-prose').evaluate((el) => ({ font: el.style.getPropertyValue('--doc-font'), padding: el.style.getPropertyValue('--doc-padding') }));
await page.getByRole('radio', { name: 'Outline' }).click();
const outline = await page.getByRole('navigation', { name: 'Outline' }).getByRole('button').allTextContents();
await page.getByRole('radio', { name: 'Stats' }).click();
const stats = await page.locator('.stats-list').innerText();
await page.reload();
await page.waitForSelector('.md-prose');
const settingsAfterReload = await page.locator('.md-prose').evaluate((el) => el.style.getPropertyValue('--doc-padding'));

// Search
await page.keyboard.press('Control+Shift+F');
await page.keyboard.type('needle');
const snippet = page.getByRole('button', { name: /Line \d+/ }).first();
await snippet.waitFor();
const marked = await snippet.locator('mark').innerText();
await snippet.click();
const selection = await page.evaluate(() => window.getSelection()?.toString());
await page.keyboard.press('Escape');

// HTML export, opened with no network
const [htmlDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export' }).click().then(() => page.getByRole('menuitem', { name: 'Export HTML' }).click()),
]);
const htmlPath = await htmlDownload.path();
await page.locator('.md-prose').screenshot({ path: 'preview.png' });
const offline = await browser.newContext({ offline: true, viewport: { width: 1400, height: 900 } });
const exported = await offline.newPage();
await exported.goto(`file:///${htmlPath.replace(/\\/g, '/')}`);
await exported.evaluate(() => document.fonts.ready);
const exportCheck = await exported.evaluate(() => ({
  katex: document.querySelectorAll('.katex').length,
  diagrams: document.querySelectorAll('.md-mermaid svg').length,
  dataImages: document.querySelectorAll('img[src^="data:"]').length,
  copyButtons: document.querySelectorAll('.md-code-copy').length,
  font: getComputedStyle(document.querySelector('.md-prose p')).fontFamily,
  sansLoaded: document.fonts.check('16px "Geist Variable"'),
}));
await exported.locator('.md-prose').screenshot({ path: 'export.png' });

// PDF: the print frame appears without CSP errors
await page.getByRole('button', { name: 'Export' }).click();
await page.getByRole('menuitem', { name: 'Export PDF' }).click();
await page.waitForSelector('iframe.print-frame', { state: 'attached', timeout: 10000 }).catch(() => {});

// Zip round trip
const [zipDownload] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export' }).click().then(() => page.getByRole('menuitem', { name: 'Export project (.zip)' }).click()),
]);
const zipPath = await zipDownload.path();
await page.goto(BASE);
await page.locator('input[type="file"][accept=".zip,application/zip"]').setInputFiles({ name: 'Phase 3 check.zip', mimeType: 'application/zip', buffer: readFileSync(zipPath) });
await page.getByRole('button', { name: 'Import' }).click();
await page.waitForURL(/\/p\//);
const importedTree = await page.locator('[role="treeitem"]').evaluateAll((rows) => rows.map((r) => r.getAttribute('aria-label')));

// Offline reload
await page.evaluate(() => navigator.serviceWorker.ready);
const deepLink = page.url();
await context.setOffline(true);
await page.reload();
const offlineReload = await page.locator('.ws').isVisible();
await page.goto(deepLink);
const offlineDeepLink = await page.locator('.ws').isVisible();
await context.setOffline(false);

console.log(JSON.stringify({ proseVars, settingsAfterReload, outline, stats, marked, selection, exportCheck, importedTree, offlineReload, offlineDeepLink, problems }, null, 2));
await browser.close();
```

Run: `node check.mjs`

Expected:
- `proseVars` is `{ font: 'var(--font-sans)', padding: '24px' }`, and `settingsAfterReload` is `'24px'`
- `outline` is `['Check', 'Diagram', 'Math', 'Code']`, and `stats` lists every label
- `marked` is `'needle'`; `selection` contains `needle` (CodeMirror's own selection may not be the DOM selection; if it's empty, check visually)
- `exportCheck`: `katex` ≥ 2, `diagrams` 1, `dataImages` 1, `copyButtons` 1, `font` starts with `"Geist Variable"`, `sansLoaded` true
- `importedTree` includes `Untitled.md`, `images` (open the folder if needed)
- `offlineReload` and `offlineDeepLink` true
- `problems` has no Content-Security-Policy violations

Open `preview.png` and `export.png` (Read tool) and compare them: same fonts, spacing, code block, diagram and math. Differences beyond the copy-button hover state and scrollbars are bugs.

If a label in the script doesn't match the UI, adjust the script, not the app. If a CSP violation appears (for example, the print iframe), fix it with the narrowest change to `frontend/nginx/security-headers.conf`, or use the print fallback from spec §8.2, and log it as a decision.

Ask the user to try Export PDF → "Save as PDF" in their browser and confirm the PDF looks like the preview without copy buttons.

Stop the container: `docker stop mdit-p3`.

- [ ] **Step 5: Docs**

- `README.md` Status: "Phase 3 (customization and export) complete: rendering settings, outline, statistics, project search, Markdown/HTML/PDF export, project zip export and import, offline reload."
- `decisions.md`: extend P-013's list of app extensions with `RangeField` (controlled, `aria-valuetext`), `.md-mark`, `.md-check`. Add any decision taken during the build.
- `context.md`: log the verification results (test count, bundle sizes, browser check numbers, PDF check by the user). Set **Current state** to "Phase 3 built; PR pending", and set Phase 3 in the checklist to "Built — PR pending".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: record Phase 3 verification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then use superpowers:requesting-code-review for a whole-branch review by a fresh reviewer. Fix its findings with tests first, log the minor items you defer, and then use superpowers:finishing-a-development-branch (push and open the PR only when the user asks).
