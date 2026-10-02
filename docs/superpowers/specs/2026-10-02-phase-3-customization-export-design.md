# Phase 3 — Customization and export: design

Status: approved 2026-10-02 · Branch: `phase-3-customization-export` · PRD: §5.6, §5.7, §5.9, §7, §13

## 1. Goal

The workspace gets the tools writers use around a document, and work can leave and re-enter the browser:

- Rendering settings (font, letter spacing, line height, margin, padding) that change the preview live and are reused by every export
- A live heading outline (click to scroll), document statistics, and case-insensitive search across the project with snippets
- Export of the open document as Markdown, as one self-contained HTML file, or as PDF through the browser's print dialog
- Export of a whole project as a .zip (folders, Markdown files, images, settings), and import of a .zip as a new project
- The app reloads with no network: a service worker precaches the build (P-010 moved this to Phase 3)

**Done when:** (PRD §13) an HTML export opened offline looks like the preview with the same settings, and a project zip-exported and re-imported comes back with the same tree, contents, image bytes, description and rendering settings. Every item in §14 of this spec passes.

**Out of scope:** formatting toolbar, find and replace, scroll sync (PRD §5.3 "later"); per-document settings; custom uploaded fonts; installing the app (web manifest); the deferred Phase 1 and Phase 2 minors listed in `context.md`.

## 2. Decisions this spec depends on

Recorded in `decisions.md`:

- **P-031** One spec → plan → PR cycle for all of Phase 3.
- **P-032** Service worker via vite-plugin-pwa `generateSW`, `registerType: 'prompt'`, no manifest; replaces P-010.
- **P-033** Search at the top of the tree sidebar; a right panel toggled from the toolbar with Outline · Stats · Settings.
- **P-034** Rendering settings are one workspace-wide settings row (resolves D2); three self-hosted font families; applied as `--doc-*` inline variables on `.md-prose`.
- **P-035** Exports use the light theme; HTML export is a single self-contained file.
- **P-036** PDF is the HTML export printed through the browser print dialog (resolves D3).
- **P-037** Markdown export is the raw `.md` source.
- **P-038** Zip layout with a top folder and `mdit.json`.
- **P-039** Import accepts any zip of Markdown and images, always creates a new project, all or nothing, with limits.
- **P-040** Outline and statistics come from markdown-it tokens; headings carry `data-line`.
- **P-041** `createRenderContext` moves to `paths/`.
- **P-042** Zips are written and read with fflate (sync API) instead of the PRD's JSZip.

## 3. Module layout (changes only)

```
frontend/src/
  settings/   rendering.ts, useRenderingSettings.ts, SettingsPanel.tsx          (new; talks to store)
  outline/    OutlinePanel.tsx, StatsPanel.tsx                                  (new; UI over renderer/analyze)
  search/     search.ts (pure), SearchBox.tsx, SearchResults.tsx               (new)
  export/     download.ts, markdown.ts, html.ts, assets.ts, print.ts,
              zip.ts, importZip.ts                                             (new; talks to store, renderer, paths, preview/mermaid)
  renderer/   md.ts (shared markdown-it instance), analyze.ts, headings rule    (pure)
  paths/      renderContext.ts (moved from app/useProjectFiles.ts)            (pure)
  store/      snapshot.ts, importProject.ts; SETTINGS keys                      (only module that imports dexie)
  editor/     EditorHandle gains revealLine and select
  ui/         RangeField.tsx (ported from the design system)
  app/        SidePanel.tsx, ExportMenu.tsx, ImportDialog.tsx, UpdateNotice.tsx; Workspace, ProjectList, main.tsx wiring
```

`renderer/` and `paths/` stay pure. `search/search.ts` is pure. Only `store/` touches IndexedDB.

## 4. Data model

No Dexie schema change. New rows in `settings`:

| Key | Value |
| --- | --- |
| `doc.rendering` | `{ font: 'serif' \| 'sans' \| 'mono', letterSpacing: number /* em */, lineHeight: number, margin: number /* px */, padding: number /* px */ }` |
| `ui.panel` | `boolean`, right panel open |
| `ui.panelTab` | `'outline' \| 'stats' \| 'settings'` |

## 5. Rendering settings (`settings/`)

- Defaults equal the design-system tokens: serif, `0em`, `1.65`, `0px`, `48px`.
- Limits: letter spacing −0.05 to 0.15em (step 0.01); line height 1.2 to 2.2 (step 0.05); margin 0 to 96px (step 4); padding 0 to 96px (step 4).
- `clampRendering(value: unknown): RenderingSettings` accepts anything (stored rows, `mdit.json`). Missing or invalid fields fall back to their defaults, and numbers are clamped to the limits and rounded to the step.
- `toCssVars(settings)` returns `{ '--doc-font': 'var(--font-serif)', '--doc-letter-spacing': '0em', '--doc-line-height': '1.65', '--doc-margin': '0px', '--doc-padding': '48px' }`. It is set as the `style` of the preview's `.md-prose` article, and the same values are used in exports.
- `useRenderingSettings()` returns `[settings, update, reset]`. While a slider is dragged, local state changes immediately and the row is written 200 ms after the last change.

**Panel (Settings tab):** heading "Rendering"; "Font" SegmentedControl with Serif · Sans · Mono; RangeFields "Letter spacing" (`0.01em`), "Line height" (`1.65`), "Margin" (`0px`), "Padding" (`48px`); caption "Applies to every document in this browser and to exports."; Button (secondary, sm) "Reset to defaults", disabled when the settings equal the defaults.

`RangeField` is ported from the design-system bundle: label and value in the head, a range input with `--pct` for the filled track, and the id from `useId`.

## 6. Outline and statistics

`renderer/analyze.ts` → `analyze(markdown): { headings: OutlineHeading[]; stats: DocumentStats }`, from `md.parse` on the shared instance (`renderer/md.ts`), never throws (returns empty results on error).

- `OutlineHeading = { level: 1–6, text: string, line: number }`. `text` is the inline content as plain text; `line` is `token.map[0]` (0-based source line).
- A `heading_open` renderer rule adds `data-line="<line>"` to every heading in the rendered HTML (DOMPurify keeps `data-*`).
- `DocumentStats`:
  - `words`: words in prose text and inline code (fenced code, Mermaid and math excluded); a word is a run of letters, digits, `'` or `-` (`/[\p{L}\p{N}'’-]+/gu`)
  - `characters`: code points in the Markdown source
  - `headings`, `codeBlocks` (fences other than Mermaid, plus indented code), `diagrams` (Mermaid fences), `math` (inline and block), `images`, `links`
  - `readingMinutes`: ⌈words / 225⌉, 0 for an empty document

**Right panel (`app/SidePanel.tsx`):** width `--sidebar-width`, `paper-sunken`, a `line` on its left. A SegmentedControl labelled "Panel" offers Outline · Stats · Settings. The toolbar IconButton (`sidebar` icon) is labelled "Show panel" when closed and "Hide panel" when open, with `active` when open. The open state and the tab are remembered.

**Outline tab:** one button per heading, indented 12px per level below the shallowest one. Clicking scrolls the preview to `[data-line="<line>"]` (when the preview is visible) and calls `editor.revealLine(line)` (when the editor is visible). Empty states: "No document open" / "Open a document to see its outline." and "No headings yet" / "Headings you write appear here."

**Stats tab:** a definition list: Words, Characters, Reading time ("1 min", "12 min"; "Under a minute" when 0 with content), Headings, Code blocks, Diagrams, Math, Images, Links. Numbers use `toLocaleString()`. It shows the same empty state as the outline when no document is open.

Both tabs analyze `draft.previewSource`, which is already debounced to 150 ms.

## 7. Search (`search/`)

`searchProject(query, { folders, documents, images }): SearchResult[]` is pure.

- The query is trimmed; empty → `[]`. Matching is a regex built from the escaped query with the flags `giu` (case-insensitive, Unicode-aware).
- **Name results** (folders, documents, images whose name matches): `{ kind, id, name, path, ranges }`, sorted by path.
- **Content results** (documents whose content matches): `{ kind: 'content', id, name, path, count, snippets }`. Each document gets up to 3 snippets, one per matching line, each `{ line (0-based), from (offset in content), text, ranges }`: the line cut to 40 characters before the first match and 80 after, with "…" where it was cut.
- Name results come first, then content results by match count (desc), then path. At most 100 results in total.

**UI:** at the top of the tree sidebar, an `Input` with the `search` icon, placeholder "Search project", accessible name "Search project", and the shortcut hint `Ctrl Shift F` (`⌘ Shift F` on Mac). Ctrl/Cmd+Shift+F focuses it from anywhere in the workspace, and Escape clears it (focus stays in the field). The tree stays mounted but hidden while searching, so its open folders survive a search. While the trimmed query is non-empty, the results replace the tree. Results are computed 120 ms after the last keystroke, over the same live queries the tree uses. Saved content only; the open document is saved within 1 s.

- The header reads "N results" or "No matches for “query”".
- Result rows use the tree row style. A content result shows the document name and path, then its snippets, each with "Line N". Matches are wrapped in `<mark class="md-mark">` (`marker` background, the design system's only warm hue).
- Clicking a document or a snippet opens that document. For a snippet, the view switches from Preview to Split if needed, and the editor selects the match: Workspace keeps a pending reveal `{ docId, from, to }` and applies it with `editor.select(from, to)` once that document's editor is mounted.
- Clicking a folder or an image clears the search and reveals the row: `FileTree` gets `revealId`, opens its ancestor folders, focuses the row and scrolls it into view.

## 8. Export of a document (`export/`)

The toolbar gets an "Export" `MenuButton` (`download` icon) with these items:

- "Export Markdown", "Export HTML" and "Export PDF", disabled until a document is ready
- a separator, then "Export project (.zip)"

Before a document export the Workspace calls `saveNow()` and exports the current draft text. Failures show the workspace Notice "Couldn’t export: <reason>".

- **Markdown:** the raw source as `<title>` (already ends in `.md`), `text/markdown;charset=utf-8`.
- **HTML:** `buildExportHtml(...)` → `<stem>.html`, `text/html;charset=utf-8`.
- **PDF:** `buildExportHtml(..., mode: 'pdf')` → `printHtml(html, stem)`.

`download(filename, blob)` creates an object URL, clicks a temporary `<a download>`, and revokes the URL a second later. Filenames are made safe: `\ / : * ? " < > |` and control characters are replaced with `-`, and the length is limited to 120 characters.

### 8.1 `buildExportHtml({ markdown, title, folderId, snapshot, rendering, mode })`

1. **Images.** A first `render` with a collecting context records which stored images the document resolves. Their bytes (from the snapshot) become `data:<type>;base64,…` URIs. A second `render` uses `createRenderContext({ loaded: true, index, docFolderId: folderId, imageUrls: dataUris })`. Missing images keep their placeholder. External images keep their URL.
2. **Diagrams.** The HTML is placed in an offscreen container attached to the document (`position: fixed; left: -10000px; width: 720px`). `renderDiagrams(container, 'light', load, lightTokens(baseCss))` fills the Mermaid placeholders, and the container's `innerHTML` is read back. Diagram colours come from the light theme's token values (the first `:root` block of `tokens.css`), not from the live page, which may be dark. Diagram errors keep their inline error box.
3. **CSS.** These files, imported with `?inline`:
   - `ui/tokens.css`, `ui/components.css`, `preview/preview.css`
   - `katex/dist/katex.min.css`, only when the document contains math
   - the export rules: body margin 0, `paper` background, and the print rules below
4. **Fonts.** `assets.ts`:
   - `pickFontFaces(css, text)` keeps the `@font-face` blocks of the Fontsource CSS (Geist, Geist Mono, Source Serif 4 roman and italic) whose `unicode-range` covers at least one code point in the document text. Blocks without a `unicode-range` are always kept. KaTeX's blocks are kept as a whole when there is math.
   - `inlineCssUrls(css, fetchBytes)` replaces every `url(...)` with a base64 `data:` URI. In `src:` lists, only `woff2` sources are kept.
   - Font bytes are fetched from the built asset URLs, which the service worker has precached.
5. **Shell.**
   ```html
   <!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width, initial-scale=1"><title>{stem}</title><style>{css}</style></head>
   <body class="mdit-export"><main class="md-preview"><article class="md-prose" style="{--doc-* vars}">{html}</article></main>{script}</body></html>
   ```
   The title is HTML-escaped. `data-doc-id` and `data-missing` attributes are removed. Links keep the href that was written.
6. **Mode.** `html` adds a small inline script for the copy buttons (`navigator.clipboard.writeText`, falling back to a hidden textarea and `execCommand('copy')`, with the same "Copied" feedback as the preview). `pdf` removes every `.md-code-copy` and adds no script.

**Print rules** (inside `@media print`):
- `@page { margin: 16mm }`
- `.md-prose { max-width: none; margin: 0; padding-block: 0 }`
- `figure.md-code, img, .md-mermaid, .katex-display, table { break-inside: avoid }`
- `h1–h6 { break-after: avoid }`
- `pre { white-space: pre-wrap }`

### 8.2 `printHtml(html, title)`

1. Append a hidden `<iframe srcdoc>` (0×0, `aria-hidden`).
2. Wait for `load`, `document.fonts.ready`, and `decode()` on every image (5 s cap).
3. Set the top document's title to `title`, then call `iframe.contentWindow.print()`.
4. On `afterprint`, or after 60 s, restore the title and remove the iframe.

If the iframe can't load (for example, a CSP problem found during verification), fall back to the same HTML in a print-only container in the main document, with `@media print` hiding the app.

## 9. Project zip (`export/zip.ts`, `export/importZip.ts`)

**Snapshot.** `readProjectSnapshot(projectId): Promise<ProjectSnapshot | null>` reads the project, folders, documents and images with bytes in one read transaction.

**Export.** `exportProjectZip(snapshot, rendering): Promise<Uint8Array>`, with fflate (P-042) loaded by `import('fflate')` (its own chunk). The download is named `<safe project name>.zip`. Zip dates before 1980 are raised to 1980, the earliest a zip can store.

```
<Project name>/
  mdit.json                 { "format": "mdit-project", "version": 1, "name", "description", "exportedAt": ISO, "rendering": {...} }
  notes.md
  guides/
    setup.md
    images/diagram.png
  empty-folder/             (directory entry)
```

Paths come from the folder tree; names are already unique among siblings (P-008). Entries use DEFLATE, and file dates are the item's `updatedAt`.

**Parse.** `parseProjectZip(data: Uint8Array, fileName: string): Promise<ParsedProjectZip>`, where the store type `ProjectImportData = { name, description, folders: string[][], documents: { folder: string[], title, content }[], images: { folder: string[], name, contentType, bytes }[] }` and `ParsedProjectZip = ProjectImportData & { rendering: RenderingSettings | null, skipped: { path, reason }[], renamed: { from, to }[] }`. Errors are the store's `ValidationError`, so `userMessage` shows them as written.

1. Not readable as a zip → "This file isn’t a zip."
2. Over 2,000 entries, or a total uncompressed size over 500 MB → "This zip is too large to import (over 2,000 files or 500 MB)." fflate's `unzipSync` filter sees each entry's sizes before inflating it, so skipped and oversized entries are never read.
3. **Paths.** `\` becomes `/`. Entries with an empty, `.` or `..` segment, or an absolute path, are skipped ("Unsafe path"). Only system and tool clutter is ignored silently: `__MACOSX/`, `.git/`, `.DS_Store`, `._*` (AppleDouble), `Thumbs.db` and `desktop.ini`. Other names starting with `.` are kept, because md.IT allows them (P-008) and the zip must round-trip (amended after the final review).
4. If every remaining entry shares one top folder, it is removed.
5. **Manifest.** If a root `mdit.json` has `format: "mdit-project"`, its `name`, `description` and `rendering` (through `clampRendering`) are used. Without it, the name is the zip file name minus `.zip`.
6. **Documents.** `.md` and `.markdown` files (case-insensitive) become documents, decoded as UTF-8 with the BOM removed, with `\r\n` and `\r` line endings converted to `\n` (the editor's form, so search offsets match); `.markdown` is renamed to `.md`. Names are trimmed by the store's rules before clashes are checked.
7. **Images.** Files with a supported image extension (PNG, JPEG, GIF, WebP, SVG) are images, typed by their extension; those over 5 MB are skipped as "Larger than 5 MB".
8. **Everything else** is skipped as "Not a Markdown document or image".
9. **Folders.** They come from the paths of kept entries and from directory entries, so empty folders are kept.
10. **Names.** Each name goes through the store's naming rules. A case-insensitive clash between siblings is renamed with `nextAvailableName` and listed in `renamed`.
11. No documents and no images → "This zip has no Markdown documents or images."

**Import.** `importProject(input: ProjectImport): Promise<Project>` (store) runs one `rw` transaction over projects, folders, documents, images and imageData:
- it creates the project, then the folders (parents first), documents and images, with image `sha256` computed as `addImage` does
- any error rolls everything back
- the project name may equal an existing project's name (project names aren't unique)

**UI.**
- **Project list:** a secondary Button "Import project" next to "New project" opens a `.zip` file picker. Each project row's menu gets "Export .zip".
- **Import dialog**, titled "Import “<name>”":
  - Summary: "12 documents, 4 images, 3 folders".
  - When something was skipped: "3 files weren’t imported:", then the first 5 as "path — reason", and "and 2 more" for the rest.
  - When names changed: "2 names were changed to avoid duplicates."
  - A checkbox "Use its rendering settings", unchecked by default, shown only when the zip's rendering differs from the current settings.
  - Actions: Cancel / Import. Import shows busy state, then navigates to the new project. Errors appear in the dialog through `userMessage`.
- **Parse failures** open the same dialog titled "Couldn’t import <file name>", with the message and a Close button.

## 10. Offline reload (service worker)

- `vite-plugin-pwa` (`^1.3.0`), `strategies: 'generateSW'`, `registerType: 'prompt'`, `injectRegister: false`, `manifest: false`, dev mode off.
- Workbox: `globPatterns: ['**/*.{js,css,html,woff2,svg,png}']`, `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024`, `navigateFallback: '/index.html'`, `navigateFallbackDenylist: [/^\/api\//]`, `cleanupOutdatedCaches: true`.
- `app/UpdateNotice.tsx` calls `registerSW({ onNeedRefresh })` from `virtual:pwa-register`, and only in production builds. When an update is waiting, it shows a Callout at the bottom of every page: "A new version of md.IT is ready." with Button "Reload", which calls `updateSW(true)`. The `beforeunload` guard from P-022 still protects unconfirmed changes.
- nginx: `sw.js` and `workbox-*.js` are served by `location /` with `Cache-Control: no-cache`. The CSP is unchanged: `worker-src` falls back to `script-src 'self'`.
- Vitest aliases `virtual:pwa-register` to a test stub.

## 11. Security

- Exported HTML contains the same sanitized HTML as the preview (P-020: no inline `style` or `<style>` from documents). The only script is md.IT's copy script, and the only inline styles are md.IT's (`--doc-*`, KaTeX, Mermaid SVG).
- Stored images are embedded as `data:image/*` in `<img>` only. SVG in `<img>` cannot run script.
- Zip import never trusts paths: no `..`, no absolute paths, names go through the store rules, the size and count limits are checked before anything is inflated, and text is decoded with a non-fatal UTF-8 decoder.
- The print iframe has no `allow-*` flags beyond what printing needs. It is `srcdoc` with our own HTML and inherits the app's CSP.

## 12. Performance

- `analyze` runs on the debounced preview source. Search is debounced 120 ms and capped at 100 results.
- fflate loads only on zip export or import. Mermaid stays lazy and loads for export only when the document has diagrams.
- HTML exports embed only the font subsets the document uses, and KaTeX fonts only when there is math.

## 13. Testing

Vitest + Testing Library + fake-indexeddb, as before; tests are written first.

- **`settings/rendering`:** clamping of bad, partial and out-of-range values; `toCssVars`.
- **`renderer/analyze`:** a fixture document with every construct; empty and invalid input.
- **`search`:** case and Unicode matching, regex characters in the query, snippet cutting, ordering, the cap.
- **`export/assets`:** unicode-range selection, url inlining, woff2-only `src`.
- **`export/html`:** data-URI images, no `blob:`, diagram SVG (Mermaid mocked), KaTeX CSS only with math, escaped title, `--doc-*` values, script only in `html` mode.
- **`export/zip` + `importZip` + `store/importProject`:**
  - zip layout
  - foreign zip (nested top folder, `__MACOSX`, junk, `..` entry, oversized image, name clash)
  - limits
  - an atomic failure leaves nothing behind
  - **round trip** snapshot → zip → parse → import → snapshot is equal
- **UI:** RangeField; SettingsPanel; SidePanel (toggle and tab remembered); outline click calls `revealLine` and scrolls the preview; search box shortcut and Escape; result click opens the document and selects the match; ExportMenu disabled states; ImportDialog summary and checkbox; UpdateNotice.

## 14. Acceptance

1. Changing font, letter spacing, line height, margin or padding updates the preview at once and survives a reload. "Reset to defaults" restores the tokens.
2. The outline lists H1–H6 live, and clicking a heading scrolls the preview and the editor to it.
3. Stats show words, characters, headings, code blocks, diagrams, math, images, links and reading time, and they match a fixture document.
4. Searching finds folder, document and image names and document text case-insensitively, with highlighted snippets. Clicking a snippet opens the document with the match selected.
5. Export Markdown downloads the source.
6. Export HTML downloads one file that, opened with no network, shows highlighted code, KaTeX, Mermaid, stored images, the chosen font and settings, and working copy buttons, and looks like the preview.
7. Export PDF opens the print dialog with the same content, without copy buttons.
8. Export project (.zip), then Import project, gives a new project with the same tree (including empty folders), contents, image bytes and description. Ticking "Use its rendering settings" restores the settings.
9. A zip made by another tool imports, and its summary lists what was skipped or renamed.
10. After one online visit, reloading `/` and a deep link with the network off loads the app. A new build shows the update notice.
11. Lint, typecheck, tests and build are clean. There are no console or CSP errors in Edge against the container.
