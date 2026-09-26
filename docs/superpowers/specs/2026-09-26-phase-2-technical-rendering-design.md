# Phase 2 — Technical rendering: design

Status: draft for review · Branch: `phase-2-technical-rendering` · PRD: §5.2–5.5, §7, §12

## 1. Goal

The preview renders what technical writers need, and images are part of the project:

- Mermaid diagrams (flowchart, sequence, class, ER), KaTeX inline `$…$` and block `$$…$$`
- Code blocks in the design system's `CodeBlock` look, highlighted for Java, JavaScript, TypeScript, Python, SQL, JSON, HTML, CSS, Bash, with a working copy button
- Images stored in the project, shown in the file tree, added by drop, paste or file picker, referenced by relative path or URL, with `{width=… align=…}`
- Invalid Mermaid or LaTeX, and missing images, show an inline notice and never break the preview
- Relative links to `.md` documents open that document in the workspace

**Done when** every rule in PRD §5.2–5.5 passes (§13 of this spec), except the export-only parts of §5.5 (HTML-export copy script, PDF removal), which belong to Phase 3.

**Out of scope:** settings panel, outline, statistics, search, export/import (Phase 3); the other deferred Phase 1 minors listed in `context.md`; rewriting references when an image is renamed or moved.

## 2. Decisions this spec depends on

Agreed during brainstorming (to be logged in `decisions.md`):

| Topic | Decision |
| --- | --- |
| Where images live | Files in the tree: in folders, same sibling-name rules as folders and documents, rename / move / delete like documents |
| Image row click | Does not navigate. Row menu offers **Insert in document**, Rename, Move to…, Delete; hovering shows a thumbnail |
| Relative document links | In scope: clicking `[x](Other.md)` opens that document in the workspace |
| Rendering architecture | Two stages: a pure synchronous `render()` with post-sanitize splicing of trusted KaTeX output, then a DOM pass in the preview for Mermaid, copy buttons and link clicks |

Chosen in this spec (also logged):

- **highlight.js core** with only the nine PRD languages. It's synchronous and class-based, so colors come from tokens. Rejected: Shiki (async, needs WASM in the CSP), highlight.js auto-detect (slow and often wrong).
- **In-house markdown-it math rule** for `$…$` / `$$…$$`, rendering with **KaTeX 0.18**. `markdown-it-texmath` was last published in 2022; `@vscode/markdown-it-katex` pins KaTeX 0.16. The rule is small and emits our own placeholders.
- **In-house image-attribute rule** for `{width=… align=…}`. `markdown-it-attrs` accepts arbitrary attributes, which we'd then have to police.
- **Mermaid 11.17.x**, loaded lazily with a dynamic `import()`. 12.0 was released 2026-09-10; we'll take a new major once it has settled.
- **Image bytes stored as `ArrayBuffer` in a separate `imageData` table.** `fake-indexeddb` under jsdom can't round-trip `Blob`s; this was verified by a probe and `ArrayBuffer` works. Keeping bytes out of the `images` table means tree live queries never load image data.
- **`@noble/hashes` for SHA-256.** `crypto.subtle` is missing on plain-HTTP pages, the same problem as P-021.
- **`blob:` URLs allowed by DOMPurify.** They are same-origin and only resolve when this page created them.

## 3. Module layout (changes only)

```text
frontend/src/
  renderer/          pure: markdown → sanitized HTML (no store, no DOM beyond DOMPurify)
    render.ts          pipeline: markdown-it → DOMPurify → splice trusted math
    math.ts            $ / $$ rule + KaTeX rendering to placeholder table
    code.ts            fence rule: CodeBlock markup, highlight.js, mermaid placeholder
    highlight.ts       highlight.js core + 9 languages and aliases
    images.ts          image rule: resolve src, {width align}, missing placeholder
    links.ts           link rule: external target=_blank (moved), relative .md → data-doc-id
    context.ts         RenderContext type
  paths/             pure: project path index, resolve relative hrefs, relative path between items
  preview/           React: Preview component + DOM enhancement
    Preview.tsx        wraps Prose; runs enhance after each html change
    mermaid.ts         lazy loader, theme config, render cache, error block
    copy.ts            copy button delegation + clipboard fallback
    preview.css        mermaid, math error, missing image, notice styles
  store/
    images.ts          image CRUD, validation, naming (new)
    db.ts              schema v2
  editor/            Editor gains insert handle and image drop/paste
  tree/              image rows, menu, thumbnail, drops onto folders
  app/               Workspace wires resolver, images, Insert image button
```

Dependency rules unchanged: only `store/` touches Dexie. `renderer/` and `paths/` import nothing from the app. `preview/` may import `renderer/` types and `ui/`.

## 4. Data model (Dexie schema version 2)

```text
images     id, projectId, [projectId+folderId]
           { id, projectId, folderId ('' = root), name, contentType, size, sha256, createdAt, updatedAt }
imageData  id
           { id, bytes: ArrayBuffer }
```

- This changes the PRD's `images(id, projectId, path, …)`. A stored path would need rewriting on every folder rename or move; the path is computed from `folderId` + `name` instead (logged as a decision).
- The v1 `images` table was never written. The v2 upgrade clears it and changes its indexes.
- `ImageAsset` type becomes the metadata row above; `getImageBytes(id): Promise<ArrayBuffer | null>` reads `imageData`.

## 5. Store API (additions)

```ts
addImage(projectId, folderId, file: { name: string; type: string; bytes: ArrayBuffer }): Promise<ImageAsset>
renameImage(id, name): Promise<ImageAsset>
moveImage(id, folderId): Promise<ImageAsset>
deleteImage(id): Promise<void>
listImages(projectId): Promise<ImageAsset[]>
getImageBytes(id): Promise<ArrayBuffer | null>
findOrCreateFolder(projectId, parentId, name): Promise<Folder>   // one transaction
useImages(projectId)                                              // live query, metadata only
```

Rules:

- **Types:** PNG, JPEG, GIF, WebP, SVG, taken from `file.type` or, when that's empty, from the extension. Anything else throws `ValidationError("“screen.bmp” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).")`.
- **Size:** at most 5 MB (5 × 1024 × 1024 bytes). Larger files throw `ValidationError("“screen.png” is 7.2 MB; images can be up to 5 MB.")`.
- **Names on add:** the name is cleaned up. It's lowercased, runs of anything other than letters, digits, `.`, `_` or `-` become `-`, and dashes are trimmed. An empty result becomes `image`. The extension is kept when valid, otherwise taken from the type (`.jpg` for JPEG). A clash gets `-2`, `-3`, … before the extension: `screen-shot.png`, then `screen-shot-2.png`.
- **Names on rename:** the sibling namespace is shared with folders and documents (case-insensitive, P-008). The extension is re-added if the user drops it, the same way documents keep `.md`. Otherwise the same validation as document names applies.
- **Cascade:** `deleteFolder` and `deleteProject` remove images and their `imageData` in the same transaction. The folder-delete confirmation counts images alongside documents and folders.
- **Hash:** `sha256` is the hex SHA-256 of the bytes (`@noble/hashes`). It's unused until Phase 5.

## 6. Project paths (`paths/`)

Pure functions over `{ folders, documents, images }`:

- `folderPath(folderId)` → `['OS', 'images']`
- `resolveHref(fromFolderId, href)` → `{ kind: 'document' | 'image', id } | { kind: 'missing' } | { kind: 'external' }`:
  - `http:`, `https:`, `mailto:`, `data:` hrefs are external; `#…` fragment-only hrefs are external too.
  - A leading `/` resolves from the project root. Otherwise the href resolves from `fromFolderId`, with `.` and `..` supported.
  - Each segment is percent-decoded; a malformed escape means missing.
  - Names match case-insensitively. Climbing above the root means missing.
- `relativeHref(fromFolderId, target)` → e.g. `images/a.png`, `../Assets/a.png`. Space, `(`, `)`, `<`, `>` and `%` in segments are percent-encoded so the result is a valid Markdown link destination.

Used by the app (resolver and inserts) and the tree (Insert in document), and by Phase 3's zip export.

## 7. Renderer

### 7.1 Interface

```ts
interface RenderContext {
  resolveImage(href: string): { src: string } | { missing: true } | { pending: true };  // external hrefs return { src: href }
  resolveLink(href: string): { docId: string } | { missing: true } | { external: true } | { unsupported: true };  // unsupported = an image or folder
}
render(markdown: string, context?: RenderContext): string   // still never throws
```

Without a context (tests, future export), relative images count as missing and relative links are left as they are.

### 7.2 Pipeline

1. markdown-it (existing options and task lists) plus the rules below produce HTML. Math and Mermaid produce placeholders rather than final output.
2. DOMPurify sanitizes the whole string, with the existing options plus `blob:` added to the allowed URI schemes. `style` attributes and `<style>` blocks are still removed (P-020).
3. Math placeholders are replaced by KaTeX output. Each render uses a fresh random nonce, and placeholders look like `<span data-mdit-math="NONCE:3"></span>`. A document can't predict the nonce, so it can't inject a placeholder that pulls trusted HTML. KaTeX output is inserted after sanitizing because it depends on inline `style`.

### 7.3 Math (`math.ts`)

- **Inline `$…$`:** the opening `$` must not be followed by a space, and the closing `$` must not be preceded by a space or followed by a digit. So `$5 and $10` stays text. `\$` is a literal dollar sign. Math doesn't span a blank line. `$` inside code spans and code blocks is never math (the rule runs after markdown-it's backticks rule).
- **Block `$$…$$`:** `$$` opens a line, and the math ends at a line whose last characters are `$$`. The closing `$$` may sit on the opening line. A block without a closing `$$` is treated as text.
- **KaTeX options:** `throwOnError: true`, `trust: false`, `strict: 'ignore'`, `output: 'htmlAndMathml'` (screen readers get MathML), `displayMode` for blocks.
- **On error:** `<code class="md-math-error" title="…">$source$</code>` inline, or a `<div class="md-render-error">Couldn’t render math: {KaTeX message}</div>` for blocks. This error markup is produced *before* sanitizing, not spliced in.
- **Styles and fonts:** KaTeX CSS and fonts are imported from the `katex` package and bundled (self-hosted, `font-src 'self'` unchanged).

### 7.4 Code blocks (`code.ts`, `highlight.ts`)

Fenced and indented code render as the design system's CodeBlock markup:

```html
<figure class="md-code">
  <div class="md-code-bar">
    <button type="button" class="md-code-copy" aria-label="Copy code"><svg…copy icon/><span>Copy</span></button>
    <span class="md-code-lang">python</span>   <!-- omitted when the fence has no language -->
  </div>
  <pre><code class="hljs language-python">…</code></pre>
</figure>
```

- **Languages:** java, javascript (js), typescript (ts), python (py), sql, json, html (xml), css, bash (sh, shell). The label shows the name as written in the fence. An unknown language is escaped plain text with its label. There's no auto-detect.
- **Colors:** new tokens `--syntax-keyword`, `--syntax-string`, `--syntax-number`, `--syntax-comment`, `--syntax-title`, `--syntax-attr`, `--syntax-meta` for light and dark. They're muted (one step of saturation below the accent). `.hljs-*` classes map to them. These tokens are an app-side design-system extension, recorded under P-013.
- **Mermaid fences** (a fence whose language is `mermaid`) render `<div class="md-mermaid" data-source="…escaped source…"></div>` instead of a code block.

### 7.5 Images (`images.ts`)

- **Attribute block:** `![alt](src){width=400 align=left}`. A `{…}` immediately after an image token is consumed only when every key is `width` or `align` with a valid value; otherwise it stays as visible text, so typos show.
- **`width`:** a bare number (px), `Npx`, or `N%` with 1 ≤ N ≤ 100. It's written as the `width` attribute; the existing `.md-prose img { max-width:100%; height:auto }` keeps the aspect ratio.
- **`align`:** `left | center | right`, written as `data-align` (the design system already styles `img[data-align]` with `margin-inline`). The default is center.
- **Source resolution:** `context.resolveImage(src)` gives the `src`, or the missing placeholder `<span class="md-img-missing" role="img" aria-label="Missing image: images/a.png">Image not found: images/a.png</span>` (the design system already styles `.md-img-missing` as a dashed block). While a stored image's bytes are still loading, the resolver returns `{ pending: true }` and the same box shows "Loading image…" (`md-img-missing is-pending`), so a reload never flashes "not found".
- **Block display:** images always display as blocks (existing CSS).

### 7.6 Links (`links.ts`)

- External links keep `target="_blank" rel="noopener noreferrer"` (moved from `render.ts`).
- **Relative links:** `context.resolveLink(href)` adds `data-doc-id="…"` or `data-missing="true"` to the anchor. Relative links are left alone when there's no context.
- A hand-written `data-doc-id` in raw HTML can only point at a document ID, which the router checks against the project, so it isn't a security concern.

## 8. Preview (`preview/`)

`<Preview html theme onOpenDocument onNotice>` renders `Prose` and, in a `useLayoutEffect` after every `html` or `theme` change, runs the enhancement pass on its root.

**Mermaid**

- **Loading and setup:** `import('mermaid')` runs on first need, which keeps it out of the main bundle. `initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'base', themeVariables })`, with colors read from the computed token values (`--paper`, `--ink`, `--line`, `--accent`) so diagrams follow the light and dark themes.
- **Rendering:** each `.md-mermaid` placeholder gets `mermaid.render(uniqueId, source)`. Results, whether SVG or error, are cached in a map keyed by `theme + source`, capped at 50 entries (least recently used dropped).
- **Flicker and races:**
  - Cached diagrams are filled synchronously, so typing elsewhere in the document doesn't flicker them.
  - An async result is written only if its placeholder is still in the document with the same source.
  - Any temporary element Mermaid leaves in `document.body` after a failure is removed.
- **Errors:** a diagram error renders `<div class="md-render-error">Couldn’t render diagram: {message}</div>`. If the Mermaid chunk fails to load, the notice reads "Couldn’t load the diagram renderer."
- **While rendering:** a pending placeholder shows a `line`-bordered box, 120 px tall, with the caption "Rendering diagram…".

**Copy buttons.** Handled by one delegated click listener on the root.

- **Clipboard:** it uses `navigator.clipboard.writeText` when available (secure pages only). Otherwise it falls back to a hidden textarea and `document.execCommand('copy')`.
- **Feedback:** the label becomes "Copied" with the check icon for 1.4 s. A failure shows "Couldn’t copy" for the same time.

**Links.** One delegated listener handles link clicks.

- **`data-doc-id`:** calls `preventDefault` and navigates to `/p/:projectId/d/:docId`. Unsaved edits flush through the existing draft switching.
- **`data-missing`:** calls `preventDefault` and `onNotice('“Threads.md” isn’t in this project.')`.
- **Other relative non-fragment links:** call `preventDefault` and `onNotice('Only links to documents in this project open here.')`.
- **External and fragment links:** behave normally.

**Notices.** Owned by the Workspace, so image-add errors show in every view mode: a dismissible `Callout tone="warning"` pinned to the bottom centre of the document area. It's announced (`role="status"`) and disappears after 5 s.

## 9. Adding and inserting images

**Editor**

- **Handle:** `Editor` exposes `insertBlock(text, at?)` through a ref. The text goes at `at`, or at the cursor (the end if the editor never had focus), as its own block: blank lines are added before and after where missing, so an image never joins a heading or paragraph. The cursor moves after the text.
- **Drop:** dropping files inserts at the drop position (`posAtCoords`).
- **Paste:** pasting files uses the cursor.
- **Handoff:** image files go to `onImageFiles(files, pos)`; other files are ignored and the drop or paste falls through as before.

**Workspace**

- **Toolbar:** a new icon button **Insert image** (icon `image`) opens a hidden `<input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" multiple>`. It's enabled only while a document is open.
- **Where files go:** the open document's folder, in a subfolder named `images`. It's created with `findOrCreateFolder` if it doesn't exist, and matched case-insensitively (an existing `Images` folder is reused). No other item can take that name: documents always end in `.md` and images always carry an image extension. The folder is only created when at least one file passes the type and size checks.
- **What's inserted:** one line per image, `![{name without extension}]({relativeHref})`, separated by blank lines, inserted as a single editor change so one undo removes them all.
- **Failures:** failed files (type, size, storage) are reported together in one notice; valid files in the same batch are still added.

**Tree**

- **Rows:** image rows show the `image` icon, sorted with files by natural sort after folders.
- **Click or Enter:** does not navigate; the open document stays open, and the row stays focusable for its menu.
- **Menu:** **Insert in document** (disabled with no open document) inserts `![name](relative path)` via the editor handle. Rename, Move to… and Delete follow the document behaviour; Delete confirms by name.
- **Thumbnail:** hovering or focusing an image row for 400 ms shows a fixed-position popover with a thumbnail (max 160 × 120 px, `line` border, `radius-md`) and "{width} × {height} · {size}". It's an app-side design-system extension (`TreeItem` preview), recorded under P-013.
- **Moving:** drag-and-drop moves images like documents, and dropping an image row onto a document row moves it into that document's folder (the existing rule).
- **Adding from the tree:** dropping image files from the OS onto a folder row, or onto the tree background for the root, adds them there without inserting anything.

**Object URLs.** `useImageUrls(projectId)` in `app/`:

- **Creation:** reads bytes for each image, creates one object URL per image ID and `updatedAt`, and keeps them in a map.
- **Cleanup:** revokes URLs for removed or changed images, and all of them on unmount.
- **Resolver:** Workspace builds the `RenderContext` from `paths/` + this map + the open document's folder, memoized so the preview re-renders when images or the tree change.

## 10. Security

- DOMPurify still sanitizes every byte of user-authored HTML. The only content inserted after sanitizing is KaTeX output (from TeX source with `trust: false`) at nonce-matched placeholders, plus Mermaid SVG (strict security level, which sanitizes labels itself).
- **SVG images:** SVG images are shown only through `<img>`, where scripts and external loads don't run.
- **CSP:** no change is expected (`script-src 'self'`; the Mermaid chunk is same-origin; the existing `style-src 'unsafe-inline'` covers Mermaid's SVG `<style>`; KaTeX fonts are `'self'`). The container check in §13 confirms no CSP violations. If one appears, it's fixed and logged as a decision rather than loosened silently.
- `render.test.ts` keeps every Phase 1 sanitization case, and adds forged math placeholders, forged `data-mdit-math` attributes, and `javascript:` in image `src` and attribute blocks.

## 11. Performance

- **Main bundle:** KaTeX and highlight.js core with 9 languages are in it (render is synchronous). Mermaid is a separate lazy chunk and is never fetched for a document without a Mermaid fence. The production build output is checked for this.
- **Preview debounce:** stays at 150 ms. Cached Mermaid diagrams are placed synchronously.

## 12. Testing

| Area | Tests (Vitest, jsdom) |
| --- | --- |
| `paths/` | nested resolve, `..` and `/`, case-insensitive, escaping the root, percent-decoding, `relativeHref` round-trips with `resolveHref` |
| `store/images` | add (naming, clash suffix, type and size rules, hash), rename keeps extension, shared namespace conflicts, move, delete, cascades from folder and project, `findOrCreateFolder` |
| `renderer/` | math inline and block, `$` edge cases, KaTeX errors, nonce forging; each language highlighted and unknown language plain; CodeBlock markup; mermaid placeholder; image attributes valid and invalid, width forms, align, missing placeholder, `blob:` kept; links resolved and missing; all Phase 1 sanitization cases |
| `preview/` | Mermaid mocked: placeholder filled, cache reuse without re-render, stale result dropped, error block, load failure; copy uses the clipboard and falls back; link clicks navigate and give notices |
| `editor/` | `insertBlock` at cursor, at end and at a position, adding only missing blank lines; image drop and paste call `onImageFiles`; other files ignored |
| `tree/` | image rows, Insert in document, rename, move, delete confirmation, OS file drop onto a folder |
| `app/` | Insert image button stores the file in `images/` and inserts Markdown; failures shown; preview shows the stored image |

A browser check (Playwright, headless Edge, like Phase 1) covers the parts jsdom can't: real Mermaid rendering of the four diagram types, KaTeX layout, and blob images displaying.

## 13. Acceptance

1. All §12 tests pass. Lint, typecheck and build are clean. CI is green on the PR.
2. In the container (`docker run … :8080`), one document shows:
   - a flowchart, sequence, class and ER diagram;
   - inline and block math;
   - one code block per PRD language, highlighted, with a working copy button;
   - an invalid diagram and invalid math, each showing an inline error while the rest renders;
   - an uploaded image at `width=50%` `align=right`, and a missing image placeholder.

   The browser console shows no CSP violations.
3. An image dropped on the editor appears in `images/` in the tree and in the preview. It survives a reload. Renaming it shows the missing placeholder until the reference is fixed.
4. A relative link to another document opens it; a link to a missing one shows the notice.
5. The Mermaid chunk isn't requested for a document without diagrams (checked in the network panel or the Playwright request log).
