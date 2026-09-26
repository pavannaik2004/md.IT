md.IT is a local-first workspace for technical writing: Markdown on the left, a rendered document on the right, a project tree beside them. The interface should feel like good paper and a good pen — quiet, exact, and out of the way. The document is the loudest thing on screen; the chrome around it is small, neutral and consistent.

## Principles

- **The document leads.** Chrome uses `ui-*` styles at 12–14px in `ink-muted`; only the preview gets large type. Never put color in the chrome that competes with a document's own links or highlights.
- **One accent, used sparingly.** `accent` marks the single primary action in a view, the active item and keyboard focus. Everything else is ink on paper.
- **Borders, not shadows.** Structure comes from `line` hairlines and the step between `paper`, `paper-sunken` and `paper-raised`. `shadow-pop` is only for things that float: menus, dialogs.
- **Say where the work is.** Local vs cloud is the product's core idea — `SaveStatus`, badges and callouts always name it in words ("Saved locally", "Version saved").
- **Obvious over clever.** Every control has a visible label or a tooltip; destructive actions always ask first; nothing important hides behind hover.

## Voice

- Plain, calm, second person. Sentence case everywhere — buttons, titles, menu items.
- Verbs first on actions: "Save version", "Load latest", "Export HTML", "New document".
- Say what happened and what to do next, in one or two short sentences: "A newer version exists. Load it, or save yours as a copy."
- Name the place: "in this browser", "in the cloud". Avoid "sync", "server", "IndexedDB" in the interface.
- No exclamation marks, no emoji, no "Oops". Numbers as numerals ("3 documents").
- The product name is **md.IT** — lowercase `md`, uppercase `IT`.

## Color

Two themes, Light (first, the fallback) and Dark, share every token name.

- Grounds: `paper` for the page and preview; `paper-sunken` for side panels (tree, outline, history); `paper-raised` for inputs, menus, dialogs and the editor pane; `paper-code` for code.
- Text: `ink` for primary text, `ink-muted` for metadata and inactive rows (6:1+ on every paper in both themes). `ink-faint` is for disabled states and chevrons only — never text someone needs to read.
- Lines: `line` for decorative hairlines; `line-strong` for the edge of any control (holds 3:1).
- Accent: `accent` fill with `on-accent` text for the primary button; `accent-soft` behind the active tree row and selected states; `accent` text on either. Links use `link` (an alias of accent).
- `marker` is the only warm hue: search matches and `==highlight==` in documents. Nothing else.
- Status: `positive` (blue, so it is never told apart from `danger` by hue alone), `warning`, `danger`, each with a `-soft` ground. Every status also carries an icon or a word.
- Focus: `focus` — a 2px solid ring, 2px offset, on every interactive element. Never remove it.

## Type

Three families, all from Google Fonts (loaded by `bundle.css`):

- **Geist** (`--font-sans`) — the entire interface and document headings.
- **Source Serif 4** (`--font-serif`) — document prose. A reading face for long technical text; users can switch it in rendering settings through `--doc-font`.
- **Geist Mono** (`--font-mono`) — the editor, code, keyboard keys, version numbers and the wordmark.

Interface: `ui-title` for dialog titles, `ui-heading` for panel headings, `ui-body` default, `ui-label` for tree rows and controls, `ui-caption` for timestamps and status. Document: `doc-h1`–`doc-h3`, `doc-body` at 17/28, `doc-small` for captions and tables. Code: `code-editor` (14/24, roomy so Markdown source reads like prose), `code-block` (13.5/22), `code-label`.

Keep the document column at `doc-measure` (720px, ≈68 characters). Don't bold whole sentences; use `**strong**` for terms.

## Space, radius, layout

- A 4px grid: `space-1` … `space-16`. Interface density lives in `space-1`–`space-4`; the document breathes at `space-6` and up.
- Radii: `radius-sm` for small things (badges, kbd, inline code, tree rows), `radius-md` for controls, `radius-lg` for containers (code blocks, callouts, menus, dialogs). `radius-full` only for dots and the range thumb.
- Controls are `control-sm` (28px, toolbars and tree) or `control-md` (32px, forms and dialogs). Toolbar is `toolbar-height`; tree is `sidebar-width`.
- Workspace layout: toolbar across the top (wordmark, project name, mode switch centered, `SaveStatus` and "Save version" on the right); tree on the left on `paper-sunken`; editor and preview split 50/50 with a single `line` between them.

## Rendering settings

The preview root carries `--doc-font`, `--doc-letter-spacing`, `--doc-line-height`, `--doc-margin` and `--doc-padding` (PRD 5.6). Their defaults are the `doc-*` tokens; the settings panel (`RangeField`s) overrides them on the root and exports read the same values. Wrap rendered HTML in `Prose` so headings, lists, tables, blockquotes, inline code, `mark` and aligned images all follow the system.

## Code blocks

Use `CodeBlock`: `line` border, `radius-lg`, `paper-code` ground, copy button top-left, language label top-right in `code-label`. Syntax colors come from the highlighter theme; keep them muted — one step of saturation below the accent — so code never outshouts prose. The copy button is hidden in print/PDF.

## Motion

Short and functional: 120ms ease-out on hover and press colors; no entrance animations, no bouncing. The only continuous motion is the `SaveStatus` "Saving…" spinner, which stops under `prefers-reduced-motion`.

## Iconography

md.IT has its own small line-icon set (`assets/Icons`, also built into `Icon`): 24px grid, 1.5 stroke, round caps and joins, no fills. Use 16px in controls, 14px in dense rows, 18–20px in callouts and empty states. Icons inherit `currentColor` — usually `ink-muted`, `ink` on hover, `accent` when active. No emoji, no brand logos inside the product UI other than the provider name on "Sign in with GitHub / Google" buttons.

## Logo

There is no drawn mark. The wordmark is the name set in Geist Mono 600 with tight tracking and the dot in `accent` — use the `Wordmark` component. Don't recolor the letters, don't add a symbol, don't place it on an accent fill.
