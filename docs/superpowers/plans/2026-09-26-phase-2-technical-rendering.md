# Phase 2 — Technical rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The md.IT preview renders Mermaid, KaTeX and highlighted code blocks with a working copy button, and images are project files in the tree that can be dropped, pasted or picked, referenced by relative path with `{width=… align=…}`.

**Architecture:** Two-stage rendering. `renderer/` stays a pure synchronous `render(markdown, context)`: markdown-it with in-house rules (math, code blocks, image attributes, link/image resolution through a `RenderContext`), DOMPurify over everything, then KaTeX output spliced in at nonce placeholders. `preview/` then runs a DOM pass: lazy Mermaid (cached), copy buttons, link clicks. Images live in Dexie (`images` metadata + `imageData` bytes); `paths/` resolves relative hrefs over the folder tree; `app/` turns stored bytes into object URLs and builds the context.

**Tech Stack:** existing (Vite 8, React 18.3, TS 6.0, markdown-it 15, DOMPurify 3, Dexie 4, CodeMirror 6, Vitest 5 + jsdom 29 + fake-indexeddb) plus highlight.js 11.12, KaTeX 0.18.9, Mermaid 11.17.x, @noble/hashes 2.4.

**Spec:** `docs/superpowers/specs/2026-09-26-phase-2-technical-rendering-design.md` (read it with this plan). Decisions P-023…P-027 in `decisions.md`. Design system snapshot: `docs/design-system/`.

## Global Constraints

- All commands run from `frontend/` unless a step says otherwise. Shell is Git Bash on Windows; use forward slashes.
- **Progress logging (user requirement):** before a task, read `context.md`; after it, append `2026-09-26 — Task N: <what> (<files>, <tests total>)` to its **Log**, update **Current state**, add new decisions to `decisions.md`, and commit those edits with the task's code.
- Branch `phase-2-technical-rendering`; never commit to `main`. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Only `src/store/` imports `dexie` / `dexie-react-hooks` (ESLint enforces it).
- `src/renderer/` and `src/paths/` are pure: no imports from other app modules, no DOM access beyond DOMPurify, no CSS imports. `renderer/` may import `markdown-it`, `dompurify`, `katex`, `highlight.js`.
- `src/preview/` may import `renderer/` and `ui/`; `app/` wires everything.
- UI copy: sentence case, no emoji or exclamation marks, curly quotes/apostrophes (`“” ’`), product name **md.IT**. Exact strings used in this plan are the spec's strings; don't reword them.
- Colors, fonts and sizes come from tokens (`src/ui/tokens.css`) only. New tokens and component styles that the design system lacks go in the "app extensions" block of `src/ui/components.css` (or `tokens.css` for tokens) and are listed under P-013.
- Images: PNG, JPEG, GIF, WebP, SVG only; at most `5 * 1024 * 1024` bytes. Bytes stored as `ArrayBuffer` (jsdom can't clone `Blob`).
- Sibling names (folders, documents, images, same parent) are unique case-insensitively.
- Mermaid always runs with `securityLevel: 'strict'`; KaTeX with `trust: false`. Inline `style` and `<style>` from documents stay stripped (P-020).
- Preview debounce stays 150 ms; autosave 1000 ms.
- Checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Every task ends with all four green.

## Review Focus

1. **A browser that already holds Phase 1 data** opens after the schema v2 upgrade with every project, folder and document intact. Test: Task 1 `upgrades a Phase 1 database without losing documents`.
2. **Dollar amounts in prose** (`It costs $5 and $10.`) stay plain text, never math. Test: Task 5 `leaves dollar amounts alone`.
3. **Reloading a document with stored images** never flashes “Image not found” while bytes load; it shows “Loading image…” until the object URL exists. Test: Task 10 `shows a loading box, not “not found”, before image bytes load`.
4. **Dropping a mixed batch** (one PNG, one `.txt`): the PNG is added and inserted, the error names the `.txt`, and a batch of only bad files creates no empty `images` folder. Test: Task 10 `adds valid files and reports the rest together`.
5. **Editing while a diagram renders**: a late Mermaid result never overwrites a placeholder whose source changed, and cached diagrams are filled synchronously so typing elsewhere doesn't flicker them. Tests: Task 7 `drops a stale result` and `fills cached diagrams without re-rendering`.

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `src/store/types.ts`, `db.ts` | 1 | `ImageAsset` metadata type; schema v2 (`images`, `imageData`) |
| `src/store/imageRules.ts` | 1 | pure: supported types, size limit, name cleaning, size text |
| `src/store/images.ts` | 1 | image CRUD, `addImageFiles` |
| `src/store/guards.ts`, `documents.ts`, `folders.ts`, `projects.ts`, `names.ts`, `hooks.ts`, `index.ts` | 1 | shared namespace incl. images, cascades, `findOrCreateFolder`, `useImages` |
| `src/paths/paths.ts`, `index.ts` | 2 | pure: resolve relative hrefs, relative href between items |
| `src/renderer/context.ts`, `escape.ts`, `links.ts`, `images.ts` | 3 | render context, link and image rules |
| `src/renderer/highlight.ts`, `code.ts`, `icons.ts` | 4 | CodeBlock markup, highlight.js, mermaid placeholder |
| `src/renderer/math.ts` | 5 | `$`/`$$` rules, KaTeX, nonce splice |
| `src/renderer/render.ts` | 3–5 | pipeline |
| `src/preview/Preview.tsx`, `copy.ts`, `links.ts`, `preview.css` | 6 | preview wrapper, copy, link clicks |
| `src/app/Notice.tsx` | 6 | workspace notice |
| `src/preview/mermaid.ts`, `src/app/theme.ts` | 7 | lazy Mermaid + cache; resolved theme |
| `src/editor/Editor.tsx`, `extensions.ts`, `files.ts` | 8 | `insertText` handle, image drop/paste |
| `src/tree/buildTree.ts`, `messages.ts`, `FileTree.tsx`, `ImageThumb.tsx`, `tree.css` | 9 | image rows, menu, thumbnail, OS file drops |
| `src/app/useImageUrls.ts`, `useProjectFiles.ts`, `imageInsert.ts`, `Workspace.tsx`, `DocumentArea.tsx` | 10 | object URLs, render context, Insert image, wiring |
| `README.md`, `context.md`, `decisions.md` | 11 | verification and docs |

---

### Task 1: Image storage

**Files:**
- Modify: `src/store/types.ts`, `src/store/db.ts`, `src/store/names.ts`, `src/store/guards.ts`, `src/store/documents.ts`, `src/store/folders.ts`, `src/store/projects.ts`, `src/store/hooks.ts`, `src/store/index.ts`
- Create: `src/store/imageRules.ts`, `src/store/images.ts`
- Test: `src/store/imageRules.test.ts`, `src/store/images.test.ts`, `src/store/db.test.ts`, extend `src/store/cascade.test.ts`

**Interfaces:**
- Consumes: existing store (`db`, guards, `newId`, `normalizeName`, `nextAvailableName`, errors).
- Produces (exported from `src/store/index.ts`):
  - `type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/svg+xml'`
  - `interface ImageAsset { id: string; projectId: string; folderId: string | null; name: string; contentType: ImageType; size: number; sha256: string; createdAt: number; updatedAt: number }`
  - `interface NewImageFile { name: string; type: string; bytes: ArrayBuffer }`
  - `addImage(projectId: string, folderId: string | null, file: NewImageFile): Promise<ImageAsset>`
  - `addImageFiles(projectId: string, folderId: string | null, files: readonly File[]): Promise<{ added: ImageAsset[]; errors: string[] }>`
  - `renameImage(id: string, name: string): Promise<ImageAsset>`, `moveImage(id: string, folderId: string | null): Promise<ImageAsset>`, `deleteImage(id: string): Promise<void>`
  - `listImages(projectId: string): Promise<ImageAsset[]>`, `getImageBytes(id: string): Promise<ArrayBuffer | null>`, `useImages(projectId: string): ImageAsset[] | undefined`
  - `findOrCreateFolder(projectId: string, parentFolderId: string | null, name: string): Promise<Folder>`
  - `checkImageFile(name: string, type: string, size: number): ImageType` (throws `ValidationError`), `formatSize(bytes: number): string`, `IMAGE_ACCEPT: string`, `MAX_IMAGE_BYTES: number`

- [ ] **Step 1: Install the hash library**

```bash
npm install @noble/hashes@^2.4.0
```

- [ ] **Step 2: Write the failing rule tests** — `src/store/imageRules.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { checkImageFile, cleanImageName, formatSize, imageTypeOf, MAX_IMAGE_BYTES, withImageExtension } from './imageRules';

describe('image rules', () => {
  it('takes the type from the file, or from the extension when the file has none', () => {
    expect(imageTypeOf('a.png', 'image/png')).toBe('image/png');
    expect(imageTypeOf('a.svg', '')).toBe('image/svg+xml');
    expect(imageTypeOf('a.JPEG', '')).toBe('image/jpeg');
    expect(imageTypeOf('a.bmp', 'image/bmp')).toBeNull();
    expect(imageTypeOf('a.png', 'text/plain')).toBeNull();
    expect(imageTypeOf('notes', '')).toBeNull();
  });

  it('rejects unsupported and oversized files with plain messages', () => {
    expect(() => checkImageFile('screen.bmp', 'image/bmp', 10)).toThrow('“screen.bmp” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).');
    expect(() => checkImageFile('screen.png', 'image/png', Math.round(7.2 * 1024 * 1024))).toThrow('“screen.png” is 7.2 MB; images can be up to 5 MB.');
    expect(checkImageFile('ok.png', 'image/png', MAX_IMAGE_BYTES)).toBe('image/png');
  });

  it('cleans names into link-friendly stems and keeps a matching extension', () => {
    expect(cleanImageName('Screen Shot.PNG', 'image/png')).toEqual({ stem: 'screen-shot', ext: '.png' });
    expect(cleanImageName('photo.JPEG', 'image/jpeg')).toEqual({ stem: 'photo', ext: '.jpeg' });
    expect(cleanImageName('photo', 'image/jpeg')).toEqual({ stem: 'photo', ext: '.jpg' });
    expect(cleanImageName('Äpfel & Birnen (1).webp', 'image/webp')).toEqual({ stem: 'äpfel-birnen-1', ext: '.webp' });
    expect(cleanImageName('???.png', 'image/png')).toEqual({ stem: 'image', ext: '.png' });
    expect(cleanImageName('diagram.png', 'image/svg+xml')).toEqual({ stem: 'diagram', ext: '.svg' });
  });

  it('re-adds the extension on rename when it is dropped', () => {
    expect(withImageExtension('diagram', 'image/png')).toBe('diagram.png');
    expect(withImageExtension('final.PNG', 'image/png')).toBe('final.PNG');
    expect(withImageExtension('photo.jpeg', 'image/jpeg')).toBe('photo.jpeg');
  });

  it('formats sizes', () => {
    expect(formatSize(900)).toBe('900 bytes');
    expect(formatSize(340 * 1024)).toBe('340 KB');
    expect(formatSize(Math.round(7.2 * 1024 * 1024))).toBe('7.2 MB');
  });
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `npx vitest run src/store/imageRules.test.ts`
Expected: FAIL — cannot resolve `./imageRules`.

- [ ] **Step 4: Replace `ImageAsset` in `src/store/types.ts`**

Replace the existing `ImageAsset` interface with:

```ts
export type ImageType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/svg+xml';

/** Image metadata. The bytes live in the separate imageData table (see getImageBytes). */
export interface ImageAsset {
  id: string;
  projectId: string;
  folderId: string | null;
  /** File name including its extension, e.g. "diagram.png". */
  name: string;
  contentType: ImageType;
  size: number;
  /** Hex SHA-256 of the bytes; used for de-duplication from Phase 5. */
  sha256: string;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 5: Write `src/store/imageRules.ts`**

```ts
import { ValidationError } from './errors';
import type { ImageType } from './types';

/** Extensions per supported type; the first is used when a name has none. */
export const IMAGE_EXTENSIONS: Readonly<Record<ImageType, readonly string[]>> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** For <input type="file" accept>. */
export const IMAGE_ACCEPT = Object.keys(IMAGE_EXTENSIONS).join(',');

const TYPES = Object.keys(IMAGE_EXTENSIONS) as ImageType[];

export function extensionOf(name: string): string {
  const match = /\.[^./\\]+$/.exec(name);
  return match ? match[0].toLowerCase() : '';
}

/** The declared type wins; only an empty type falls back to the extension. */
export function imageTypeOf(name: string, type: string): ImageType | null {
  const declared = type.toLowerCase();
  if (declared !== '') return TYPES.includes(declared as ImageType) ? (declared as ImageType) : null;
  const ext = extensionOf(name);
  return TYPES.find((candidate) => IMAGE_EXTENSIONS[candidate].includes(ext)) ?? null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Returns the image type, or throws a ValidationError written for the user. */
export function checkImageFile(name: string, type: string, size: number): ImageType {
  const imageType = imageTypeOf(name, type);
  if (!imageType) throw new ValidationError(`“${name}” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).`);
  if (size > MAX_IMAGE_BYTES) throw new ValidationError(`“${name}” is ${formatSize(size)}; images can be up to 5 MB.`);
  return imageType;
}

/** "Screen Shot.PNG" → { stem: 'screen-shot', ext: '.png' }: no spaces, so inserted paths need no escaping. */
export function cleanImageName(name: string, type: ImageType): { stem: string; ext: string } {
  const given = extensionOf(name);
  const base = given ? name.slice(0, -given.length) : name;
  const stem =
    base
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/-{2,}/g, '-')
      .slice(0, 100)
      .replace(/^[-.]+|[-.]+$/g, '') || 'image';
  const allowed = IMAGE_EXTENSIONS[type];
  return { stem, ext: allowed.includes(given) ? given : allowed[0]! };
}

/** Renamed images keep an extension for their type, the way documents keep .md. */
export function withImageExtension(name: string, type: ImageType): string {
  return IMAGE_EXTENSIONS[type].includes(extensionOf(name)) ? name : `${name}${IMAGE_EXTENSIONS[type][0]}`;
}
```

- [ ] **Step 6: Run the rule tests**

Run: `npx vitest run src/store/imageRules.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Write the failing store tests** — `src/store/images.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { createDocument } from './documents';
import { NameConflictError } from './errors';
import { createFolder, findOrCreateFolder, listFolders, renameFolder } from './folders';
import { addImage, addImageFiles, deleteImage, getImageBytes, listImages, moveImage, renameImage } from './images';
import { createProject } from './projects';

const bytes = (text = 'img') => new TextEncoder().encode(text).buffer as ArrayBuffer;
const png = (name: string, text?: string) => ({ name, type: 'image/png', bytes: bytes(text) });
const text = async (id: string) => new TextDecoder().decode((await getImageBytes(id)) ?? new ArrayBuffer(0));

beforeEach(clearDatabase);

describe('images', () => {
  it('adds an image with a cleaned name, size, hash and bytes', async () => {
    const pid = (await createProject('OS')).id;
    const image = await addImage(pid, null, png('Screen Shot.png', 'abc'));
    expect(image).toMatchObject({
      projectId: pid, folderId: null, name: 'screen-shot.png', contentType: 'image/png', size: 3,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
    expect(await text(image.id)).toBe('abc');
    expect(await listImages(pid)).toEqual([image]);
  });

  it('numbers clashing names with -2, -3', async () => {
    const pid = (await createProject('OS')).id;
    await addImage(pid, null, png('a.png'));
    expect((await addImage(pid, null, png('A.png'))).name).toBe('a-2.png');
    expect((await addImage(pid, null, png('a.png'))).name).toBe('a-3.png');
  });

  it('shares the sibling namespace with folders and documents', async () => {
    const pid = (await createProject('OS')).id;
    await createFolder(pid, null, 'b.png');
    expect((await addImage(pid, null, png('b.png'))).name).toBe('b-2.png');
    const image = await addImage(pid, null, png('c.png'));
    await expect(createFolder(pid, null, 'C.PNG')).rejects.toBeInstanceOf(NameConflictError);
    await expect(renameImage(image.id, 'B.PNG')).rejects.toThrow('“B.PNG” already exists here.');
  });

  it('rejects unsupported and oversized files', async () => {
    const pid = (await createProject('OS')).id;
    await expect(addImage(pid, null, { name: 'screen.bmp', type: 'image/bmp', bytes: bytes() })).rejects.toThrow(
      '“screen.bmp” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).',
    );
    await expect(addImage(pid, null, { name: 'big.png', type: 'image/png', bytes: new ArrayBuffer(Math.round(7.2 * 1024 * 1024)) })).rejects.toThrow(
      '“big.png” is 7.2 MB; images can be up to 5 MB.',
    );
    expect(await listImages(pid)).toEqual([]);
  });

  it('renames, keeping the extension', async () => {
    const pid = (await createProject('OS')).id;
    const image = await addImage(pid, null, png('a.png'));
    expect((await renameImage(image.id, 'diagram')).name).toBe('diagram.png');
    expect((await renameImage(image.id, 'final.png')).name).toBe('final.png');
  });

  it('moves into a folder unless the name is taken there', async () => {
    const pid = (await createProject('OS')).id;
    const folder = await createFolder(pid, null, 'images');
    const image = await addImage(pid, null, png('a.png'));
    expect((await moveImage(image.id, folder.id)).folderId).toBe(folder.id);
    const other = await addImage(pid, null, png('a.png'));
    await expect(moveImage(other.id, folder.id)).rejects.toBeInstanceOf(NameConflictError);
  });

  it('deletes the image and its bytes', async () => {
    const pid = (await createProject('OS')).id;
    const image = await addImage(pid, null, png('a.png'));
    await deleteImage(image.id);
    expect(await listImages(pid)).toEqual([]);
    expect(await getImageBytes(image.id)).toBeNull();
  });

  it('adds a batch of files and reports the ones it could not add', async () => {
    const pid = (await createProject('OS')).id;
    const files = [new File(['x'], 'One.png', { type: 'image/png' }), new File(['y'], 'notes.txt', { type: 'text/plain' })];
    const result = await addImageFiles(pid, null, files);
    expect(result.added.map((image) => image.name)).toEqual(['one.png']);
    expect(result.errors).toEqual(['“notes.txt” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).']);
  });

  it('finds or creates a folder by name, case-insensitively', async () => {
    const pid = (await createProject('OS')).id;
    const created = await findOrCreateFolder(pid, null, 'images');
    const again = await findOrCreateFolder(pid, null, 'Images');
    expect(again.id).toBe(created.id);
    await renameFolder(created.id, 'Images');
    expect((await findOrCreateFolder(pid, null, 'images')).id).toBe(created.id);
    expect(await listFolders(pid)).toHaveLength(1);
    await createDocument(pid, null, 'x');
    await expect(findOrCreateFolder(pid, null, 'x.md')).rejects.toBeInstanceOf(NameConflictError);
  });
});
```

- [ ] **Step 8: Add the Phase 1 upgrade test** — `src/store/db.test.ts`

```ts
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { db } from './db';
import { getDocument } from './documents';
import { listImages } from './images';

describe('database upgrade', () => {
  it('upgrades a Phase 1 database without losing documents', async () => {
    db.close();
    await Dexie.delete('mdit');
    const v1 = new Dexie('mdit');
    v1.version(1).stores({
      projects: 'id, updatedAt',
      folders: 'id, projectId, [projectId+parentFolderId]',
      documents: 'id, projectId, [projectId+folderId]',
      images: 'id, projectId, [projectId+path]',
      settings: 'key',
    });
    await v1.table('projects').add({ id: 'p1', name: 'OS', description: '', createdAt: 1, updatedAt: 1 });
    await v1.table('documents').add({ id: 'd1', projectId: 'p1', folderId: '', title: 'A.md', content: 'hi', dirty: true, createdAt: 1, updatedAt: 1 });
    await v1.table('images').add({ id: 'i1', projectId: 'p1', path: 'images/a.png', contentType: 'image/png', sha256: '' });
    v1.close();

    await db.open();
    expect(await getDocument('d1')).toMatchObject({ title: 'A.md', content: 'hi' });
    expect(await listImages('p1')).toEqual([]);
  });
});
```

- [ ] **Step 9: Extend `src/store/cascade.test.ts`**

Add these imports: `import { addImage, getImageBytes, listImages } from './images';` and add inside the `describe`:

```ts
  it('deleting a folder removes images at every depth and their bytes', async () => {
    const pid = (await createProject('OS')).id;
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    const bytes = new TextEncoder().encode('x').buffer as ArrayBuffer;
    const inner = await addImage(pid, b.id, { name: 'in.png', type: 'image/png', bytes });
    await addImage(pid, null, { name: 'keep.png', type: 'image/png', bytes });
    await deleteFolder(a.id);
    expect((await listImages(pid)).map((i) => i.name)).toEqual(['keep.png']);
    expect(await getImageBytes(inner.id)).toBeNull();
  });

  it('deleting a project removes its images and their bytes only', async () => {
    const pid = (await createProject('OS')).id;
    const other = (await createProject('Other')).id;
    const bytes = new TextEncoder().encode('x').buffer as ArrayBuffer;
    const gone = await addImage(pid, null, { name: 'a.png', type: 'image/png', bytes });
    await addImage(other, null, { name: 'a.png', type: 'image/png', bytes });
    await deleteProject(pid);
    expect(await listImages(pid)).toEqual([]);
    expect(await getImageBytes(gone.id)).toBeNull();
    expect(await listImages(other)).toHaveLength(1);
  });
```

- [ ] **Step 10: Run the store tests and see them fail**

Run: `npx vitest run src/store`
Expected: FAIL — `./images` doesn't exist, `findOrCreateFolder` isn't exported.

- [ ] **Step 11: Schema v2 in `src/store/db.ts`**

Change the type import to `import type { Folder, ImageAsset, MdDocument, Project, Setting } from './types';` (unchanged names) and add after `DocumentRow`:

```ts
export interface ImageRow extends Omit<ImageAsset, 'folderId'> {
  folderId: string;
}

export interface ImageDataRow {
  id: string;
  bytes: ArrayBuffer;
}
```

In the class, replace `images!: EntityTable<ImageAsset, 'id'>;` with:

```ts
  images!: EntityTable<ImageRow, 'id'>;
  imageData!: EntityTable<ImageDataRow, 'id'>;
```

After the existing `this.version(1).stores({...});` add:

```ts
    // v2: images are tree items (folderId + name) and their bytes move to imageData. v1 never stored an image.
    this.version(2)
      .stores({ images: 'id, projectId, [projectId+folderId]', imageData: 'id' })
      .upgrade((tx) => tx.table('images').clear());
```

After `toDocument` add:

```ts
export const toImage = (row: ImageRow): ImageAsset => ({ ...row, folderId: fromKey(row.folderId) });
```

- [ ] **Step 12: `nextAvailableName` separator in `src/store/names.ts`**

```ts
/** "Untitled.md", then "Untitled 2.md", … — the first not in `taken`. Images use "-" ("a-2.png"). */
export function nextAvailableName(stem: string, ext: string, taken: readonly string[], separator = ' '): string {
  const used = new Set(taken.map(nameKey));
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `${stem}${ext}` : `${stem}${separator}${n}${ext}`;
    if (!used.has(nameKey(candidate))) return candidate;
  }
}
```

- [ ] **Step 13: Guards include images — `src/store/guards.ts`**

Change the first import to `import { db, now, type DocumentRow, type FolderRow, type ImageRow } from './db';` and add/replace:

```ts
/** Every table a tree change may read or write: sibling names span folders, documents and images. */
export const hierarchyTables = () => [db.projects, db.folders, db.documents, db.images, db.imageData];

export async function requireImage(id: string): Promise<ImageRow> {
  const image = await db.images.get(id);
  if (!image) throw new NotFoundError('This image no longer exists.');
  return image;
}

/** Names of every folder, document and image directly under `parentKey`, optionally excluding one item. */
export async function siblingNames(projectId: string, parentKey: string, excludeId?: string): Promise<string[]> {
  const [folders, documents, images] = await Promise.all([
    db.folders.where('[projectId+parentFolderId]').equals([projectId, parentKey]).toArray(),
    db.documents.where('[projectId+folderId]').equals([projectId, parentKey]).toArray(),
    db.images.where('[projectId+folderId]').equals([projectId, parentKey]).toArray(),
  ]);
  return [
    ...folders.filter((f) => f.id !== excludeId).map((f) => f.name),
    ...documents.filter((d) => d.id !== excludeId).map((d) => d.title),
    ...images.filter((i) => i.id !== excludeId).map((i) => i.name),
  ];
}
```

- [ ] **Step 14: Use `hierarchyTables` in documents and folders**

In `src/store/documents.ts` delete `const tables = () => [db.projects, db.folders, db.documents];`, add `hierarchyTables` to the `./guards` import, and replace every `tables()` with `hierarchyTables()`.

In `src/store/folders.ts` do the same, add `nameKey` to the `./names` import. Replace `deleteFolder` and add `findOrCreateFolder`:

```ts
export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', hierarchyTables(), async () => {
    const folder = await requireFolder(id);
    const all = await listFolders(folder.projectId);
    const ids = [id, ...descendantFolderIds(all, id)];
    const keys = ids.map((folderId) => [folder.projectId, folderId]);
    await db.documents.where('[projectId+folderId]').anyOf(keys).delete();
    const imageIds = await db.images.where('[projectId+folderId]').anyOf(keys).primaryKeys();
    await db.images.bulkDelete(imageIds);
    await db.imageData.bulkDelete(imageIds);
    await db.folders.bulkDelete(ids);
    await touchProject(folder.projectId);
  });
}

/** The folder called `name` (any case) under the parent, created when missing. Throws NameConflictError if a non-folder has the name. */
export async function findOrCreateFolder(projectId: string, parentFolderId: string | null, name: string): Promise<Folder> {
  const clean = normalizeName(name);
  return db.transaction('rw', hierarchyTables(), async () => {
    await requireProject(projectId);
    if (parentFolderId !== null) await requireFolderIn(projectId, parentFolderId);
    const parentKey = toKey(parentFolderId);
    const siblings = await db.folders.where('[projectId+parentFolderId]').equals([projectId, parentKey]).toArray();
    const existing = siblings.find((f) => nameKey(f.name) === nameKey(clean));
    if (existing) return toFolder(existing);
    assertNameFree(clean, await siblingNames(projectId, parentKey));
    const at = now();
    const row: FolderRow = { id: newId(), projectId, parentFolderId: parentKey, name: clean, createdAt: at, updatedAt: at };
    await db.folders.add(row);
    await touchProject(projectId, at);
    return toFolder(row);
  });
}
```

- [ ] **Step 15: Project delete removes image bytes — `src/store/projects.ts`**

```ts
export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.folders, db.documents, db.images, db.imageData], async () => {
    await requireProject(id);
    await db.documents.where('projectId').equals(id).delete();
    await db.folders.where('projectId').equals(id).delete();
    const imageIds = await db.images.where('projectId').equals(id).primaryKeys();
    await db.images.bulkDelete(imageIds);
    await db.imageData.bulkDelete(imageIds);
    await db.projects.delete(id);
  });
}
```

- [ ] **Step 16: Write `src/store/images.ts`**

```ts
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { db, now, toImage, toKey, type ImageRow } from './db';
import { userMessage } from './errors';
import { assertNameFree, hierarchyTables, requireFolderIn, requireImage, requireProject, siblingNames, touchProject } from './guards';
import { newId } from './ids';
import { checkImageFile, cleanImageName, withImageExtension } from './imageRules';
import { nextAvailableName, normalizeName } from './names';
import type { ImageAsset } from './types';

export interface NewImageFile {
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

export async function listImages(projectId: string): Promise<ImageAsset[]> {
  const rows = await db.images.where('projectId').equals(projectId).toArray();
  return rows.map(toImage);
}

export async function getImageBytes(id: string): Promise<ArrayBuffer | null> {
  return (await db.imageData.get(id))?.bytes ?? null;
}

export async function addImage(projectId: string, folderId: string | null, file: NewImageFile): Promise<ImageAsset> {
  const type = checkImageFile(file.name, file.type, file.bytes.byteLength);
  const { stem, ext } = cleanImageName(file.name, type);
  // crypto.subtle is missing on plain-HTTP pages, so hash in JS (P-026).
  const hash = bytesToHex(sha256(new Uint8Array(file.bytes)));
  return db.transaction('rw', hierarchyTables(), async () => {
    await requireProject(projectId);
    if (folderId !== null) await requireFolderIn(projectId, folderId);
    const parentKey = toKey(folderId);
    const name = nextAvailableName(stem, ext, await siblingNames(projectId, parentKey), '-');
    const at = now();
    const row: ImageRow = {
      id: newId(), projectId, folderId: parentKey, name, contentType: type, size: file.bytes.byteLength, sha256: hash, createdAt: at, updatedAt: at,
    };
    await db.images.add(row);
    await db.imageData.add({ id: row.id, bytes: file.bytes });
    await touchProject(projectId, at);
    return toImage(row);
  });
}

/** Adds each file in order; files that fail are reported, the rest are still added. */
export async function addImageFiles(
  projectId: string,
  folderId: string | null,
  files: readonly File[],
): Promise<{ added: ImageAsset[]; errors: string[] }> {
  const added: ImageAsset[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      checkImageFile(file.name, file.type, file.size); // before reading a large file into memory
      added.push(await addImage(projectId, folderId, { name: file.name, type: file.type, bytes: await file.arrayBuffer() }));
    } catch (error) {
      errors.push(userMessage(error));
    }
  }
  return { added, errors };
}

export async function renameImage(id: string, name: string): Promise<ImageAsset> {
  const clean = normalizeName(name);
  return db.transaction('rw', hierarchyTables(), async () => {
    const image = await requireImage(id);
    const finalName = withImageExtension(clean, image.contentType);
    assertNameFree(finalName, await siblingNames(image.projectId, image.folderId, id));
    const updated: ImageRow = { ...image, name: finalName, updatedAt: now() };
    await db.images.put(updated);
    await touchProject(image.projectId, updated.updatedAt);
    return toImage(updated);
  });
}

export async function moveImage(id: string, folderId: string | null): Promise<ImageAsset> {
  return db.transaction('rw', hierarchyTables(), async () => {
    const image = await requireImage(id);
    if (folderId !== null) await requireFolderIn(image.projectId, folderId);
    const parentKey = toKey(folderId);
    assertNameFree(image.name, await siblingNames(image.projectId, parentKey, id));
    const updated: ImageRow = { ...image, folderId: parentKey, updatedAt: now() };
    await db.images.put(updated);
    await touchProject(image.projectId, updated.updatedAt);
    return toImage(updated);
  });
}

export async function deleteImage(id: string): Promise<void> {
  await db.transaction('rw', hierarchyTables(), async () => {
    const image = await requireImage(id);
    await db.images.delete(id);
    await db.imageData.delete(id);
    await touchProject(image.projectId);
  });
}
```

Note: `userMessage` logs unexpected (non-`StoreError`) errors with `console.error`; that's intended.

- [ ] **Step 17: Hook and exports**

`src/store/hooks.ts` — add `import { listImages } from './images';` and:

```ts
/** Image metadata only; bytes are read with getImageBytes. */
export function useImages(projectId: string) {
  return useLiveQuery(() => listImages(projectId), [projectId]);
}
```

`src/store/index.ts` — update to:

```ts
export { clearDatabase } from './db';
export {
  createDocument, deleteDocument, duplicateDocument, getDocument, listDocuments, moveDocument, renameDocument, saveDocumentContent,
} from './documents';
export { InvalidMoveError, NameConflictError, NotFoundError, StoreError, ValidationError, userMessage } from './errors';
export { createFolder, deleteFolder, findOrCreateFolder, listFolders, moveFolder, renameFolder } from './folders';
export { ancestorFolderIds, descendantFolderIds } from './hierarchy';
export { useDocuments, useFolders, useImages, useProject, useProjectSummaries, useSetting, useSettingState } from './hooks';
export { checkImageFile, formatSize, IMAGE_ACCEPT, MAX_IMAGE_BYTES } from './imageRules';
export { addImage, addImageFiles, deleteImage, getImageBytes, listImages, moveImage, renameImage, type NewImageFile } from './images';
export { createProject, deleteProject, getProject, listProjectSummaries, renameProject, setProjectDescription } from './projects';
export { getSetting, setSetting, SETTINGS } from './settings';
export type { Folder, ImageAsset, ImageType, MdDocument, Project, ProjectSummary } from './types';
```

- [ ] **Step 18: Run all tests and checks**

Run: `npm test && npm run lint && npm run typecheck`
Expected: all pass (152 Phase 1 tests + the new ones). If `db.test.ts` fails because Dexie refuses to reopen after `close()`, call `db.close({ disableAutoOpen: false })` in the test instead of `db.close()`.

- [ ] **Step 19: Log progress and commit**

Update `context.md` (Log + Current state). Then:

```bash
git add -A
git commit -m "feat(store): images as tree items with bytes in imageData (schema v2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Project paths

**Files:**
- Create: `src/paths/paths.ts`, `src/paths/index.ts`
- Test: `src/paths/paths.test.ts`

**Interfaces:**
- Consumes: nothing (structural types only; pure module).
- Produces (from `src/paths/index.ts`):
  - `createPathIndex(folders: readonly PathFolder[], documents: readonly PathDocument[], images: readonly PathImage[]): PathIndex`
  - `interface PathIndex { resolve(fromFolderId: string | null, href: string): Resolved; relativeHref(fromFolderId: string | null, target: PathTarget): string | null }`
  - `type Resolved = { kind: 'document' | 'image'; id: string } | { kind: 'missing' } | { kind: 'external' }`
  - `type PathTarget = { kind: 'document' | 'image' | 'folder'; id: string }`
  - `isExternalHref(href: string): boolean`, `encodeSegment(segment: string): string`
  - `PathFolder = { id; parentFolderId: string | null; name }`, `PathDocument = { id; folderId: string | null; title }`, `PathImage = { id; folderId: string | null; name }` — `Folder`, `MdDocument`, `ImageAsset` satisfy these.

- [ ] **Step 1: Write the failing tests** — `src/paths/paths.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createPathIndex, encodeSegment, isExternalHref } from './paths';

// Root: OS/ (images/diagram.png, Intro.md), Assets/logo.svg, Threads.md, My notes.md, a (1).png
const folders = [
  { id: 'os', parentFolderId: null, name: 'OS' },
  { id: 'osimg', parentFolderId: 'os', name: 'images' },
  { id: 'assets', parentFolderId: null, name: 'Assets' },
];
const documents = [
  { id: 'intro', folderId: 'os', title: 'Intro.md' },
  { id: 'threads', folderId: null, title: 'Threads.md' },
  { id: 'notes', folderId: null, title: 'My notes.md' },
];
const images = [
  { id: 'diagram', folderId: 'osimg', name: 'diagram.png' },
  { id: 'logo', folderId: 'assets', name: 'logo.svg' },
  { id: 'paren', folderId: null, name: 'a (1).png' },
];
const index = createPathIndex(folders, documents, images);

describe('paths', () => {
  it('resolves from the document folder, with . and ..', () => {
    expect(index.resolve('os', 'images/diagram.png')).toEqual({ kind: 'image', id: 'diagram' });
    expect(index.resolve('os', './images/diagram.png')).toEqual({ kind: 'image', id: 'diagram' });
    expect(index.resolve('os', '../Assets/logo.svg')).toEqual({ kind: 'image', id: 'logo' });
    expect(index.resolve('os', '../Threads.md')).toEqual({ kind: 'document', id: 'threads' });
    expect(index.resolve(null, 'OS/Intro.md')).toEqual({ kind: 'document', id: 'intro' });
  });

  it('resolves a leading / from the project root', () => {
    expect(index.resolve('osimg', '/Threads.md')).toEqual({ kind: 'document', id: 'threads' });
  });

  it('matches case-insensitively and ignores ?query and #fragment', () => {
    expect(index.resolve('os', 'IMAGES/Diagram.PNG')).toEqual({ kind: 'image', id: 'diagram' });
    expect(index.resolve(null, 'Threads.md#intro')).toEqual({ kind: 'document', id: 'threads' });
  });

  it('percent-decodes segments', () => {
    expect(index.resolve(null, 'My%20notes.md')).toEqual({ kind: 'document', id: 'notes' });
    expect(index.resolve(null, 'a%20%281%29.png')).toEqual({ kind: 'image', id: 'paren' });
    expect(index.resolve(null, 'bad%E0%A4%A.png')).toEqual({ kind: 'missing' });
  });

  it('reports missing items, folders and paths above the root as missing', () => {
    expect(index.resolve('os', 'images/gone.png')).toEqual({ kind: 'missing' });
    expect(index.resolve(null, 'OS')).toEqual({ kind: 'missing' });
    expect(index.resolve(null, '../Threads.md')).toEqual({ kind: 'missing' });
    expect(index.resolve('os', 'Intro.md/x.png')).toEqual({ kind: 'missing' });
    expect(index.resolve(null, '')).toEqual({ kind: 'missing' });
  });

  it('treats schemes, protocol-relative and fragment-only hrefs as external', () => {
    for (const href of ['https://example.com/a.png', 'mailto:a@b.c', 'data:image/png;base64,AA', '//cdn.example/a.png', '#top']) {
      expect(isExternalHref(href)).toBe(true);
      expect(index.resolve(null, href)).toEqual({ kind: 'external' });
    }
  });

  it('builds relative hrefs that resolve back to the same item', () => {
    const cases: Array<[string | null, { kind: 'document' | 'image'; id: string }, string]> = [
      ['os', { kind: 'image', id: 'diagram' }, 'images/diagram.png'],
      ['os', { kind: 'image', id: 'logo' }, '../Assets/logo.svg'],
      ['osimg', { kind: 'document', id: 'threads' }, '../../Threads.md'],
      [null, { kind: 'image', id: 'paren' }, 'a%20%281%29.png'],
      [null, { kind: 'document', id: 'notes' }, 'My%20notes.md'],
    ];
    for (const [from, target, href] of cases) {
      expect(index.relativeHref(from, target)).toBe(href);
      expect(index.resolve(from, href)).toEqual(target);
    }
    expect(index.relativeHref(null, { kind: 'image', id: 'nope' })).toBeNull();
  });

  it('encodes only what breaks a Markdown link destination', () => {
    expect(encodeSegment('a b(1)<x>%.png')).toBe('a%20b%281%29%3Cx%3E%25.png');
    expect(encodeSegment('äpfel.png')).toBe('äpfel.png');
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `npx vitest run src/paths`
Expected: FAIL — cannot resolve `./paths`.

- [ ] **Step 3: Write `src/paths/paths.ts`**

```ts
export interface PathFolder { id: string; parentFolderId: string | null; name: string }
export interface PathDocument { id: string; folderId: string | null; title: string }
export interface PathImage { id: string; folderId: string | null; name: string }

export type PathTarget = { kind: 'document' | 'image' | 'folder'; id: string };
export type Resolved = { kind: 'document' | 'image'; id: string } | { kind: 'missing' } | { kind: 'external' };

export interface PathIndex {
  /** Resolve an href written in a document that lives in `fromFolderId` (null = project root). */
  resolve(fromFolderId: string | null, href: string): Resolved;
  /** The href a document in `fromFolderId` should use for `target`; null when the target is unknown. */
  relativeHref(fromFolderId: string | null, target: PathTarget): string | null;
}

type Entry = PathTarget & { name: string; parentId: string | null };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function isExternalHref(href: string): boolean {
  return SCHEME.test(href) || href.startsWith('//') || href.startsWith('#');
}

/** Percent-encode what would break a Markdown link destination; everything else stays readable. */
export function encodeSegment(segment: string): string {
  return segment.replace(/[%\s()<>]/g, (c) => encodeURIComponent(c));
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

const key = (name: string) => name.toLocaleLowerCase();

export function createPathIndex(
  folders: readonly PathFolder[],
  documents: readonly PathDocument[],
  images: readonly PathImage[],
): PathIndex {
  const folderIds = new Set(folders.map((f) => f.id));
  // An item whose parent is missing (should not happen) is treated as being at the root, like the tree does.
  const parentOf = (id: string | null) => (id !== null && folderIds.has(id) ? id : null);
  const entries = new Map<string, Entry>();
  const children = new Map<string, Map<string, Entry>>(); // parent id ('' = root) → name key → entry

  const add = (entry: Entry) => {
    entries.set(entry.id, entry);
    const bucketKey = entry.parentId ?? '';
    const bucket = children.get(bucketKey) ?? new Map<string, Entry>();
    bucket.set(key(entry.name), entry);
    children.set(bucketKey, bucket);
  };
  for (const f of folders) add({ kind: 'folder', id: f.id, name: f.name, parentId: parentOf(f.parentFolderId) });
  for (const d of documents) add({ kind: 'document', id: d.id, name: d.title, parentId: parentOf(d.folderId) });
  for (const i of images) add({ kind: 'image', id: i.id, name: i.name, parentId: parentOf(i.folderId) });

  /** Folder entries from the root down to `folderId`. */
  const chain = (folderId: string | null): Entry[] => {
    const result: Entry[] = [];
    const seen = new Set<string>();
    let current = parentOf(folderId);
    while (current !== null && !seen.has(current)) {
      seen.add(current);
      const entry = entries.get(current)!;
      result.unshift(entry);
      current = entry.parentId;
    }
    return result;
  };

  return {
    resolve(fromFolderId, href) {
      if (isExternalHref(href)) return { kind: 'external' };
      const path = href.split(/[?#]/, 1)[0] ?? '';
      const parts = path.split('/').filter((part) => part !== '' && part !== '.');
      let current: string | null = path.startsWith('/') ? null : parentOf(fromFolderId);
      for (let i = 0; i < parts.length; i++) {
        const name = decodeSegment(parts[i]!);
        if (name === null) return { kind: 'missing' };
        if (name === '..') {
          if (current === null) return { kind: 'missing' };
          current = entries.get(current)?.parentId ?? null;
          continue;
        }
        const entry = children.get(current ?? '')?.get(key(name));
        if (!entry) return { kind: 'missing' };
        if (i === parts.length - 1) return entry.kind === 'folder' ? { kind: 'missing' } : { kind: entry.kind, id: entry.id };
        if (entry.kind !== 'folder') return { kind: 'missing' };
        current = entry.id;
      }
      return { kind: 'missing' };
    },

    relativeHref(fromFolderId, target) {
      const entry = entries.get(target.id);
      if (!entry || entry.kind !== target.kind) return null;
      const from = chain(fromFolderId);
      const to = chain(entry.parentId);
      let common = 0;
      while (common < from.length && common < to.length && from[common]!.id === to[common]!.id) common++;
      const ups = Array.from({ length: from.length - common }, () => '..');
      const names = [...to.slice(common).map((f) => f.name), entry.name].map(encodeSegment);
      return [...ups, ...names].join('/');
    },
  };
}
```

`src/paths/index.ts`:

```ts
export {
  createPathIndex, encodeSegment, isExternalHref,
  type PathDocument, type PathFolder, type PathImage, type PathIndex, type PathTarget, type Resolved,
} from './paths';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/paths`
Expected: PASS (8 tests).

- [ ] **Step 5: Checks, log, commit**

Run: `npm test && npm run lint && npm run typecheck` — all pass. Update `context.md`.

```bash
git add -A
git commit -m "feat(paths): resolve relative hrefs over the project tree

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Renderer — context, links and images

**Files:**
- Create: `src/renderer/context.ts`, `src/renderer/escape.ts`, `src/renderer/links.ts`, `src/renderer/images.ts`
- Modify: `src/renderer/render.ts`, `src/renderer/index.ts`
- Test: `src/renderer/images.test.ts`, `src/renderer/links.test.ts` (existing `render.test.ts` must keep passing unchanged)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type ImageResolution = { src: string } | { missing: true } | { pending: true }`
  - `type LinkResolution = { docId: string } | { missing: true } | { external: true } | { unsupported: true }`
  - `interface RenderContext { resolveImage(href: string): ImageResolution; resolveLink(href: string): LinkResolution }`
  - `render(markdown: string, context?: RenderContext): string` (still never throws)
  - `interface RenderEnv { context?: RenderContext }` (internal; Task 5 adds fields)
  - `escapeHtml(text: string): string` (internal, `renderer/escape.ts`)
  - Output contract used by Tasks 6 and 10: resolved links carry `data-doc-id="<id>"`, missing ones `data-missing="true"`; missing images render `<span class="md-img-missing" role="img" …>Image not found: <path></span>`, pending ones `<span class="md-img-missing is-pending" …>Loading image…</span>`; images get `width="…"` and `data-align="…"`.

- [ ] **Step 1: Write the failing tests** — `src/renderer/images.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { ImageResolution, RenderContext } from './context';
import { render } from './render';

const ctx = (images: Record<string, ImageResolution> = {}): RenderContext => ({
  resolveImage: (href) => images[href] ?? { missing: true },
  resolveLink: () => ({ unsupported: true }),
});

describe('images', () => {
  it('resolves a relative image through the context and keeps blob: sources', () => {
    const html = render('![Diagram](images/a.png)', ctx({ 'images/a.png': { src: 'blob:http://localhost/123' } }));
    expect(html).toContain('src="blob:http://localhost/123"');
    expect(html).toContain('alt="Diagram"');
  });

  it('applies width and align from the attribute block and hides the block', () => {
    const html = render('![a](x.png){width=400 align=left}', ctx({ 'x.png': { src: 'blob:x' } }));
    expect(html).toContain('width="400"');
    expect(html).toContain('data-align="left"');
    expect(html).not.toContain('{width');
  });

  it.each([
    ['400', '400'],
    ['400px', '400'],
    ['50%', '50%'],
    ['100%', '100%'],
  ])('accepts width=%s', (value, attr) => {
    expect(render(`![a](x.png){width=${value}}`, ctx({ 'x.png': { src: 'blob:x' } }))).toContain(`width="${attr}"`);
  });

  it.each(['{width=0}', '{width=101%}', '{width=abc}', '{align=middle}', '{height=4}', '{width=4 width=5}', '{}', '{width=400 onerror=alert(1)}'])(
    'leaves an invalid block visible: %s',
    (block) => {
      const html = render(`![a](x.png)${block}`, ctx({ 'x.png': { src: 'blob:x' } }));
      expect(html).not.toMatch(/<img[^>]*(width=|data-align=|onerror)/);
      expect(html).toContain(block);
    },
  );

  it('only reads a block that directly follows the image', () => {
    const html = render('![a](x.png) {width=400}', ctx({ 'x.png': { src: 'blob:x' } }));
    expect(html).not.toContain('width="400"');
    expect(html).toContain('{width=400}');
  });

  it('shows a placeholder for a missing image', () => {
    const html = render('![a](images/gone.png)', ctx());
    expect(html).toContain('class="md-img-missing"');
    expect(html).toContain('Image not found: images/gone.png');
    expect(html).not.toContain('<img');
  });

  it('shows a loading box while bytes are still loading', () => {
    const html = render('![a](a.png)', ctx({ 'a.png': { pending: true } }));
    expect(html).toContain('md-img-missing is-pending');
    expect(html).toContain('Loading image…');
  });

  it('without a context renders external images and treats relative ones as missing', () => {
    expect(render('![a](https://example.com/a.png)')).toContain('src="https://example.com/a.png"');
    expect(render('![a](a.png)')).toContain('Image not found: a.png');
  });

  it('never produces a javascript: image', () => {
    expect(render('![a](javascript:alert(1))', ctx())).not.toMatch(/<img[^>]*javascript:/i);
  });
});
```

`src/renderer/links.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LinkResolution, RenderContext } from './context';
import { render } from './render';

const ctx = (links: Record<string, LinkResolution>): RenderContext => ({
  resolveImage: () => ({ missing: true }),
  resolveLink: (href) => links[href] ?? { unsupported: true },
});

describe('links', () => {
  it('marks a relative link to a document with its id', () => {
    expect(render('[Next](Threads.md)', ctx({ 'Threads.md': { docId: 'd2' } }))).toContain('data-doc-id="d2"');
  });

  it('marks a link to a missing document', () => {
    expect(render('[Gone](Gone.md)', ctx({ 'Gone.md': { missing: true } }))).toContain('data-missing="true"');
  });

  it('leaves unsupported and external links unmarked; external ones open in a new tab', () => {
    const html = render('[img](a.png) [site](https://example.com)', ctx({}));
    expect(html).not.toContain('data-doc-id');
    expect(html).not.toContain('data-missing');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('leaves relative links alone without a context', () => {
    const html = render('[next](Threads.md)');
    expect(html).toContain('href="Threads.md"');
    expect(html).not.toContain('data-');
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run src/renderer`
Expected: FAIL — `./context` is missing.

- [ ] **Step 3: Write the small modules**

`src/renderer/context.ts`:

```ts
export type ImageResolution = { src: string } | { missing: true } | { pending: true };
/** unsupported = the href points at something that isn't a document (an image or a folder). */
export type LinkResolution = { docId: string } | { missing: true } | { external: true } | { unsupported: true };

/** Supplied by the app: turns hrefs written in the open document into image sources and document ids. */
export interface RenderContext {
  resolveImage(href: string): ImageResolution;
  resolveLink(href: string): LinkResolution;
}

/** markdown-it env shared by the rules during one render. */
export interface RenderEnv {
  context?: RenderContext;
}
```

`src/renderer/escape.ts`:

```ts
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
```

`src/renderer/links.ts`:

```ts
import type MarkdownIt from 'markdown-it';
import type { RenderEnv } from './context';

export function links(md: MarkdownIt): void {
  const base = md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env: RenderEnv, self) => {
    const token = tokens[idx]!;
    const href = token.attrGet('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    } else if (env.context) {
      const link = env.context.resolveLink(href);
      if ('docId' in link) token.attrSet('data-doc-id', link.docId);
      else if ('missing' in link) token.attrSet('data-missing', 'true');
    }
    return base(tokens, idx, options, env, self);
  };
}
```

`src/renderer/images.ts`:

```ts
import type MarkdownIt from 'markdown-it';
import type { ImageResolution, RenderEnv } from './context';
import { escapeHtml } from './escape';

export type ImageAlign = 'left' | 'center' | 'right';
export interface ImageAttrs { width?: string; align?: ImageAlign }

const ATTR_BLOCK = /^\{([^{}\n]*)\}/;
const EXTERNAL = /^[a-z][a-z0-9+.-]*:|^\/\//i;
const ALIGNS: readonly string[] = ['left', 'center', 'right'];

function parseWidth(value: string): string | null {
  const px = /^(\d{1,5})(?:px)?$/.exec(value);
  if (px && Number(px[1]) > 0) return String(Number(px[1]));
  const pct = /^(\d{1,3})%$/.exec(value);
  if (pct && Number(pct[1]) >= 1 && Number(pct[1]) <= 100) return `${Number(pct[1])}%`;
  return null;
}

/** `width=400 align=left` → attrs; null unless every key is known and valid, so typos stay visible. */
export function parseImageAttrs(body: string): ImageAttrs | null {
  const parts = body.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const attrs: ImageAttrs = {};
  for (const part of parts) {
    const match = /^(width|align)=(.+)$/.exec(part);
    if (!match) return null;
    const [, name, value] = match;
    if (name === 'width') {
      const width = parseWidth(value!);
      if (!width || attrs.width) return null;
      attrs.width = width;
    } else {
      if (!ALIGNS.includes(value!) || attrs.align) return null;
      attrs.align = value as ImageAlign;
    }
  }
  return attrs;
}

function resolve(env: RenderEnv, src: string): ImageResolution {
  if (env.context) return env.context.resolveImage(src);
  return EXTERNAL.test(src) ? { src } : { missing: true };
}

function displayPath(src: string): string {
  try {
    return decodeURI(src);
  } catch {
    return src;
  }
}

export function images(md: MarkdownIt): void {
  // `![a](b){width=400}`: the block arrives as plain text right after the image token; move it onto the image.
  md.core.ruler.after('inline', 'image_attrs', (state) => {
    for (const block of state.tokens) {
      const children = block.type === 'inline' ? block.children : null;
      if (!children) continue;
      for (let i = 0; i < children.length - 1; i++) {
        const image = children[i]!;
        const next = children[i + 1]!;
        if (image.type !== 'image' || next.type !== 'text') continue;
        const match = ATTR_BLOCK.exec(next.content);
        const attrs = match ? parseImageAttrs(match[1]!) : null;
        if (!match || !attrs) continue;
        image.meta = { ...(image.meta ?? {}), attrs };
        next.content = next.content.slice(match[0].length);
      }
    }
  });

  const base = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env: RenderEnv, self) => {
    const token = tokens[idx]!;
    const src = token.attrGet('src') ?? '';
    const resolved = resolve(env, src);
    if ('missing' in resolved || 'pending' in resolved) {
      const path = escapeHtml(displayPath(src));
      return 'pending' in resolved
        ? `<span class="md-img-missing is-pending" role="img" aria-label="Loading image: ${path}">Loading image…</span>`
        : `<span class="md-img-missing" role="img" aria-label="Missing image: ${path}">Image not found: ${path}</span>`;
    }
    token.attrSet('src', resolved.src);
    const attrs = (token.meta as { attrs?: ImageAttrs } | null)?.attrs;
    if (attrs?.width) token.attrSet('width', attrs.width);
    if (attrs?.align) token.attrSet('data-align', attrs.align);
    return base(tokens, idx, options, env, self);
  };
}
```

- [ ] **Step 4: Update `src/renderer/render.ts`**

```ts
import DOMPurify, { type Config } from 'dompurify';
import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import type { RenderContext, RenderEnv } from './context';
import { escapeHtml } from './escape';
import { images } from './images';
import { links } from './links';

const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
md.use(taskLists, { enabled: false });
md.use(links);
md.use(images);

// DOMPurify's default URI allow-list plus blob:, the object URLs of images stored in this browser.
const ALLOWED_URI = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// Inline style and <style> blocks are dropped: they can smuggle url(javascript:…), and a <style> block would restyle the whole app.
const SANITIZE: Config = { ADD_ATTR: ['target'], FORBID_ATTR: ['style'], FORBID_TAGS: ['style'], ALLOWED_URI_REGEXP: ALLOWED_URI };

/** Markdown → sanitized HTML. Pure apart from DOMPurify; never throws. */
export function render(markdown: string, context?: RenderContext): string {
  try {
    const env: RenderEnv = { context };
    return DOMPurify.sanitize(md.render(markdown, env), SANITIZE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="md-render-error">Couldn’t render this document: ${escapeHtml(message)}</div>`;
  }
}
```

`src/renderer/index.ts`:

```ts
export type { ImageResolution, LinkResolution, RenderContext } from './context';
export { render } from './render';
```

- [ ] **Step 5: Run the renderer tests**

Run: `npx vitest run src/renderer`
Expected: PASS — the new tests and every existing `render.test.ts` case (sanitization included).

- [ ] **Step 6: Checks, log, commit**

Run: `npm test && npm run lint && npm run typecheck`. Update `context.md`.

```bash
git add -A
git commit -m "feat(renderer): resolve images and document links, image width/align block

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Renderer — code blocks and highlighting

**Files:**
- Create: `src/renderer/highlight.ts`, `src/renderer/code.ts`, `src/renderer/icons.ts`
- Modify: `src/renderer/render.ts`, `src/ui/tokens.css`, `src/ui/components.css`
- Test: `src/renderer/code.test.ts`

**Interfaces:**
- Consumes: `escapeHtml` (Task 3).
- Produces:
  - Code: `<figure class="md-code"><div class="md-code-bar"><button type="button" class="md-code-copy" aria-label="Copy code">{COPY_ICON}<span>Copy</span></button>[<span class="md-code-lang">{lang as written}</span>]</div><pre><code[ class="hljs language-{lang}"]>…</code></pre></figure>`
  - Mermaid fences: `<div class="md-mermaid" data-source="{escaped source}"></div>`
  - `COPY_ICON`, `CHECK_ICON` (SVG markup strings) from `src/renderer/icons.ts`; Task 6 imports them from `../renderer/icons`.
  - Tokens `--syntax-keyword`, `--syntax-string`, `--syntax-number`, `--syntax-comment`, `--syntax-title`, `--syntax-attr`, `--syntax-meta`.

- [ ] **Step 1: Install highlight.js**

```bash
npm install highlight.js@^11.12.0
```

- [ ] **Step 2: Write the failing tests** — `src/renderer/code.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { render } from './render';

const parse = (html: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host;
};

describe('code blocks', () => {
  it('renders a fence as the design system CodeBlock', () => {
    const figure = parse(render('```python\nprint(1)\n```')).querySelector('figure.md-code');
    expect(figure).not.toBeNull();
    const button = figure!.querySelector('button.md-code-copy');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Copy code');
    expect(button?.querySelector('svg')).not.toBeNull();
    expect(button?.textContent).toBe('Copy');
    expect(figure!.querySelector('.md-code-lang')?.textContent).toBe('python');
    expect(figure!.querySelector('pre > code')?.className).toBe('hljs language-python');
    expect(figure!.querySelector('pre > code')?.textContent).toBe('print(1)\n');
  });

  it.each([
    ['java', 'class A { int x = 1; }'],
    ['javascript', 'const a = 1;'],
    ['js', 'let b = "x";'],
    ['typescript', 'let a: number = 1;'],
    ['ts', 'interface A { b: string }'],
    ['python', 'def f():\n    return 1'],
    ['py', 'import os'],
    ['sql', 'SELECT * FROM t WHERE id = 1;'],
    ['json', '{"a": 1}'],
    ['html', '<p class="x">hi</p>'],
    ['css', 'a { color: red; }'],
    ['bash', 'echo "hi"'],
    ['sh', 'if true; then ls; fi'],
    ['shell', 'if true; then cd /tmp; fi'],
  ])('highlights %s', (lang, code) => {
    const html = render(`\`\`\`${lang}\n${code}\n\`\`\``);
    expect(html).toMatch(/<span class="hljs-[a-z_]+/);
    expect(html).toContain(`<span class="md-code-lang">${lang}</span>`);
  });

  it('keeps an unknown language as escaped plain text with its label', () => {
    const host = parse(render('```brainfuck\n<+>\n```'));
    expect(host.querySelector('.md-code-lang')?.textContent).toBe('brainfuck');
    expect(host.querySelector('pre > code')?.className).toBe('');
    expect(host.querySelector('pre > code')?.textContent).toBe('<+>\n');
    expect(host.innerHTML).not.toContain('hljs');
  });

  it('omits the label without a language and handles indented code', () => {
    const host = parse(render('```\nplain\n```\n\n    indented'));
    expect(host.querySelectorAll('figure.md-code')).toHaveLength(2);
    expect(host.querySelector('.md-code-lang')).toBeNull();
  });

  it('escapes code instead of running it', () => {
    const html = render('```\n<script>alert(1)</script>\n```');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('turns a mermaid fence into a diagram placeholder with its source', () => {
    const host = parse(render('```mermaid\ngraph TD\n  A-->B\n```'));
    expect(host.querySelector('figure')).toBeNull();
    expect(host.querySelector('.md-mermaid')?.getAttribute('data-source')).toBe('graph TD\n  A-->B\n');
  });
});
```

- [ ] **Step 3: Run and see them fail**

Run: `npx vitest run src/renderer/code.test.ts`
Expected: FAIL — no `figure.md-code` in the output.

- [ ] **Step 4: Write the modules**

`src/renderer/highlight.ts`:

```ts
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

// Only the PRD's languages (§5.4), which keeps the bundle small. xml covers html; bash covers sh and shell.
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('css', css);
hljs.registerLanguage('java', java);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerAliases(['shell', 'sh'], { languageName: 'bash' });
hljs.registerAliases(['html'], { languageName: 'xml' });

/** Highlighted HTML (class-based spans), or null for a language we don't highlight. No auto-detect. */
export function highlight(code: string, language: string): string | null {
  const name = language.toLowerCase();
  if (!name || !hljs.getLanguage(name)) return null;
  return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
}
```

`src/renderer/icons.ts`:

```ts
// The design system's copy and check icons as markup for rendered HTML (paths match src/ui/icons.ts).
const svg = (paths: readonly string[]) =>
  `<svg class="md-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths
    .map((d) => `<path d="${d}"></path>`)
    .join('')}</svg>`;

export const COPY_ICON = svg([
  'M10 8h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
  'M15 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4',
]);

export const CHECK_ICON = svg(['M5 12.5l4.5 4.5L19 7.5']);
```

`src/renderer/code.ts`:

```ts
import type MarkdownIt from 'markdown-it';
import { escapeHtml } from './escape';
import { highlight } from './highlight';
import { COPY_ICON } from './icons';

function codeFigure(code: string, lang: string): string {
  const highlighted = highlight(code, lang);
  const body = highlighted ?? escapeHtml(code);
  const cls = highlighted !== null ? ` class="hljs language-${escapeHtml(lang.toLowerCase())}"` : '';
  const label = lang ? `<span class="md-code-lang">${escapeHtml(lang)}</span>` : '';
  const copy = `<button type="button" class="md-code-copy" aria-label="Copy code">${COPY_ICON}<span>Copy</span></button>`;
  return `<figure class="md-code"><div class="md-code-bar">${copy}${label}</div><pre><code${cls}>${body}</code></pre></figure>\n`;
}

/** Code renders as the design system's CodeBlock; ```mermaid becomes a placeholder the preview fills. */
export function codeBlocks(md: MarkdownIt): void {
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]!;
    const lang = token.info.trim().split(/\s+/)[0] ?? '';
    if (lang.toLowerCase() === 'mermaid') return `<div class="md-mermaid" data-source="${escapeHtml(token.content)}"></div>\n`;
    return codeFigure(token.content, lang);
  };
  md.renderer.rules.code_block = (tokens, idx) => codeFigure(tokens[idx]!.content, '');
}
```

In `src/renderer/render.ts` add `import { codeBlocks } from './code';` and `md.use(codeBlocks);` after `md.use(images);`.

- [ ] **Step 5: Syntax tokens** — `src/ui/tokens.css`

Add to the light `:root` block, after `--paper-code`:

```css
  /* Syntax (app extension, P-013): muted, one step below the accent's saturation. */
  --syntax-keyword: #7b4a8c;
  --syntax-string: #4d7a3a;
  --syntax-number: #9a5b13;
  --syntax-comment: #756f65;
  --syntax-title: #2f5f8f;
  --syntax-attr: #8a4b3c;
  --syntax-meta: #5f5a52;
```

Add to **both** dark blocks (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and `:root[data-theme="dark"] {…}`):

```css
    --syntax-keyword: #c49bd6;
    --syntax-string: #a3c98f;
    --syntax-number: #e0b27a;
    --syntax-comment: #8a857c;
    --syntax-title: #92b7dc;
    --syntax-attr: #d9a08f;
    --syntax-meta: #a9a49b;
```

- [ ] **Step 6: Highlight classes** — append to the app extensions block of `src/ui/components.css`

```css
.md-code .hljs-keyword, .md-code .hljs-literal, .md-code .hljs-selector-tag, .md-code .hljs-type { color: var(--syntax-keyword); }
.md-code .hljs-string, .md-code .hljs-regexp, .md-code .hljs-symbol, .md-code .hljs-template-variable, .md-code .hljs-addition { color: var(--syntax-string); }
.md-code .hljs-number { color: var(--syntax-number); }
.md-code .hljs-comment, .md-code .hljs-quote, .md-code .hljs-deletion { color: var(--syntax-comment); font-style: italic; }
.md-code .hljs-title, .md-code .hljs-section, .md-code .hljs-built_in, .md-code .hljs-name, .md-code .hljs-selector-id, .md-code .hljs-selector-class { color: var(--syntax-title); }
.md-code .hljs-attr, .md-code .hljs-attribute, .md-code .hljs-variable, .md-code .hljs-params, .md-code .hljs-property { color: var(--syntax-attr); }
.md-code .hljs-meta, .md-code .hljs-doctag, .md-code .hljs-tag, .md-code .hljs-punctuation { color: var(--syntax-meta); }
.md-code .hljs-emphasis { font-style: italic; }
.md-code .hljs-strong { font-weight: 600; }
```

- [ ] **Step 7: Run tests and checks**

Run: `npx vitest run src/renderer && npm test && npm run lint && npm run typecheck`
Expected: PASS. If one `it.each` row fails because highlight.js emits no span for that snippet, swap in a snippet containing a keyword of that language: the requirement is that highlighting happens, not a particular class.

- [ ] **Step 8: Log and commit**

Update `context.md`; in `decisions.md` extend P-013's list with "`--syntax-*` tokens and `.md-code .hljs-*` colors".

```bash
git add -A
git commit -m "feat(renderer): CodeBlock markup with highlight.js for the nine PRD languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Renderer — math

**Files:**
- Create: `src/renderer/math.ts`
- Modify: `src/renderer/context.ts`, `src/renderer/render.ts`
- Test: `src/renderer/math.test.ts`

**Interfaces:**
- Consumes: `RenderEnv`, `escapeHtml`.
- Produces:
  - `RenderEnv` becomes `{ context?: RenderContext; nonce: string; math: string[] }`
  - `math(md: MarkdownIt): void`, `spliceMath(html: string, env: RenderEnv): string`
  - Output: KaTeX HTML (`.katex`, block math in `.katex-display`); inline errors `<code class="md-math-error" title="{message}">$…$</code>`; block errors `<div class="md-render-error">Couldn’t render math: {message}</div>`.
  - Task 6 imports `katex/dist/katex.min.css` in the preview.

- [ ] **Step 1: Install KaTeX**

```bash
npm install katex@^0.18.9
```

- [ ] **Step 2: Write the failing tests** — `src/renderer/math.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { render } from './render';

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('math', () => {
  it('renders inline math', () => {
    const html = render('Euler: $e^{i\\pi}+1=0$');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('data-mdit-math');
  });

  it('renders block math over several lines and on one line', () => {
    expect(render('$$\n\\int_0^1 x\\,dx\n$$')).toContain('katex-display');
    expect(render('$$x^2$$')).toContain('katex-display');
  });

  it('keeps KaTeX layout styles even though document styles are stripped', () => {
    expect(render('$\\frac{1}{2}$')).toMatch(/class="katex[\s\S]*style="/);
    expect(render('<span style="color:red">x</span>')).not.toContain('style=');
  });

  it('leaves dollar amounts alone', () => {
    const html = render('It costs $5 and $10.');
    expect(html).not.toContain('katex');
    expect(html).toContain('$5 and $10.');
  });

  it.each(['$ x$', '$x $', '$x$5', '\\$x$', '`$x$`', '```\n$x$\n```'])('does not treat %s as math', (source) => {
    expect(render(source)).not.toContain('katex');
  });

  it('treats an unclosed block as text', () => {
    const html = render('$$\nx');
    expect(html).not.toContain('katex');
    expect(html).toContain('$$');
  });

  it('shows invalid inline math as an inline error and keeps rendering', () => {
    const html = render('$\\foo$ and **bold**');
    expect(html).toContain('class="md-math-error"');
    expect(html).toContain('Undefined control sequence');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('shows invalid block math as an error block', () => {
    expect(render('$$\n\\foo\n$$')).toContain('Couldn’t render math: ');
  });

  it('does not trust links inside math', () => {
    expect(render('$\\href{javascript:alert(1)}{x}$')).not.toMatch(/href="javascript:/i);
  });

  it('ignores forged placeholders', () => {
    const forged = render('<span data-mdit-math="abc:0"></span>');
    expect(forged).not.toContain('katex');
    expect(forged).not.toContain('data-mdit-math');
    expect(count(render('<span data-mdit-math="abc:0"></span> $x$'), 'class="katex"')).toBe(1);
  });
});
```

- [ ] **Step 3: Run and see them fail**

Run: `npx vitest run src/renderer/math.test.ts`
Expected: FAIL — no `katex` in the output.

- [ ] **Step 4: Extend `RenderEnv`** in `src/renderer/context.ts`

```ts
/** markdown-it env shared by the rules during one render. */
export interface RenderEnv {
  context?: RenderContext;
  /** Random per render; only placeholders carrying it are replaced with trusted math HTML. */
  nonce: string;
  /** KaTeX output by placeholder index. */
  math: string[];
}
```

Update Task 3's `render()` body temporarily if typecheck complains before Step 6 (Step 6 replaces it anyway).

- [ ] **Step 5: Write `src/renderer/math.ts`**

```ts
import katex from 'katex';
import type MarkdownIt from 'markdown-it';
import type { RenderEnv } from './context';
import { escapeHtml } from './escape';

type InlineRule = Parameters<MarkdownIt['inline']['ruler']['push']>[1];
type BlockRule = Parameters<MarkdownIt['block']['ruler']['before']>[2];

const DOLLAR = 0x24;
const SPACE = /\s/;

/** `$…$`: no space just inside either `$`, and the closing `$` isn't followed by a digit, so "$5 and $10" stays text. */
const mathInline: InlineRule = (state, silent) => {
  const { src, pos, posMax } = state;
  if (src.charCodeAt(pos) !== DOLLAR || src.charCodeAt(pos + 1) === DOLLAR) return false;
  const first = src[pos + 1];
  if (first === undefined || pos + 1 >= posMax || SPACE.test(first)) return false;
  for (let end = src.indexOf('$', pos + 1); end !== -1 && end < posMax; end = src.indexOf('$', end + 1)) {
    const before = src[end - 1]!;
    if (before === '\\' || SPACE.test(before) || /\d/.test(src[end + 1] ?? '')) continue;
    if (!silent) {
      const token = state.push('math_inline', 'math', 0);
      token.markup = '$';
      token.content = src.slice(pos + 1, end);
    }
    state.pos = end + 1;
    return true;
  }
  return false;
};

/** `$$` opens a line; the math ends at a line ending in `$$` (possibly the same line). A blank line or no closer means text. */
const mathBlock: BlockRule = (state, startLine, endLine, silent) => {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  if (!state.src.startsWith('$$', start)) return false;
  const firstLine = state.src.slice(start + 2, max).trimEnd();
  let content: string;
  let last = startLine;
  if (firstLine.length >= 2 && firstLine.endsWith('$$')) {
    content = firstLine.slice(0, -2);
  } else {
    const lines = [firstLine];
    let closed = false;
    for (let line = startLine + 1; line < endLine; line++) {
      const text = state.src.slice(state.bMarks[line]! + state.tShift[line]!, state.eMarks[line]!).trimEnd();
      if (text === '' || state.sCount[line]! < state.blkIndent) break;
      if (text.endsWith('$$')) {
        lines.push(text.slice(0, -2));
        last = line;
        closed = true;
        break;
      }
      lines.push(text);
    }
    if (!closed) return false;
    content = lines.join('\n');
  }
  if (silent) return true;
  state.line = last + 1;
  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.markup = '$$';
  token.content = content.trim();
  token.map = [startLine, state.line];
  return true;
};

function mathHtml(env: RenderEnv, tex: string, display: boolean): string {
  try {
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: true, trust: false, strict: 'ignore', output: 'htmlAndMathml' });
    const index = env.math.push(html) - 1;
    const tag = display ? 'div' : 'span';
    return `<${tag} data-mdit-math="${env.nonce}:${index}"></${tag}>`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return display
      ? `<div class="md-render-error">Couldn’t render math: ${escapeHtml(message)}</div>`
      : `<code class="md-math-error" title="${escapeHtml(message)}">$${escapeHtml(tex)}$</code>`;
  }
}

export function math(md: MarkdownIt): void {
  md.inline.ruler.after('escape', 'math_inline', mathInline);
  md.block.ruler.before('fence', 'math_block', mathBlock, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.renderer.rules.math_inline = (tokens, idx, _options, env: RenderEnv) => mathHtml(env, tokens[idx]!.content, false);
  md.renderer.rules.math_block = (tokens, idx, _options, env: RenderEnv) => `${mathHtml(env, tokens[idx]!.content, true)}\n`;
}

const PLACEHOLDER = /<(span|div) data-mdit-math="([0-9a-f]+):(\d+)"><\/\1>/g;

/** After sanitizing: swap this render's placeholders for KaTeX HTML and drop any others (forged by the document). */
export function spliceMath(html: string, env: RenderEnv): string {
  return html.replace(PLACEHOLDER, (_whole, _tag: string, nonce: string, index: string) =>
    nonce === env.nonce ? (env.math[Number(index)] ?? '') : '',
  );
}
```

- [ ] **Step 6: Wire it into `src/renderer/render.ts`**

Add `import { math, spliceMath } from './math';` and `md.use(math);` after `md.use(codeBlocks);`, then replace `render` with:

```ts
function newNonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Markdown → sanitized HTML. Pure apart from DOMPurify; never throws. */
export function render(markdown: string, context?: RenderContext): string {
  try {
    const env: RenderEnv = { context, nonce: newNonce(), math: [] };
    const clean = DOMPurify.sanitize(md.render(markdown, env), SANITIZE);
    // KaTeX output needs inline styles, which SANITIZE strips, so it goes in after sanitizing (P-025).
    return spliceMath(clean, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<div class="md-render-error">Couldn’t render this document: ${escapeHtml(message)}</div>`;
  }
}
```

- [ ] **Step 7: Run tests and checks**

Run: `npx vitest run src/renderer && npm test && npm run lint && npm run typecheck`
Expected: PASS. (If KaTeX throws on `\href` with `trust: false` instead of rendering it as text, it becomes an inline error; the assertion still holds.)

- [ ] **Step 8: Log and commit**

Update `context.md`.

```bash
git add -A
git commit -m "feat(renderer): KaTeX inline and block math spliced in after sanitizing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Preview — copy buttons, link clicks, notices

**Files:**
- Create: `src/preview/Preview.tsx`, `src/preview/copy.ts`, `src/preview/links.ts`, `src/preview/preview.css`, `src/preview/index.ts`, `src/app/Notice.tsx`
- Modify: `src/app/DocumentArea.tsx`, `src/app/Workspace.tsx`, `src/app/app.css`
- Test: `src/preview/links.test.ts`, `src/preview/copy.test.ts`, `src/preview/Preview.test.tsx`, `src/app/Notice.test.tsx`, extend `src/app/Workspace.test.tsx`

**Interfaces:**
- Consumes: `COPY_ICON`, `CHECK_ICON` from `../renderer/icons` (Task 4); link attributes from Task 3.
- Produces:
  - `Preview(props: { html: string; onOpenDocument: (docId: string) => void; onNotice: (message: string) => void })` (Task 7 adds `theme`)
  - `linkAction(link: Element): LinkAction` with `type LinkAction = { kind: 'open'; docId: string } | { kind: 'notice'; message: string } | { kind: 'default' }`
  - `copyText(text: string): Promise<boolean>`, `copyCode(button: HTMLButtonElement): Promise<void>`
  - `Notice({ notice, onDismiss }: { notice: NoticeMessage | null; onDismiss: () => void })`, `interface NoticeMessage { id: number; text: string }`
  - Workspace keeps `showNotice(text: string)`; Task 10 uses it for image errors.

- [ ] **Step 1: Write the failing unit tests**

`src/preview/links.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { linkAction } from './links';

const link = (attrs: Record<string, string>) => {
  const a = document.createElement('a');
  for (const [name, value] of Object.entries(attrs)) a.setAttribute(name, value);
  return a;
};

describe('linkAction', () => {
  it('opens a resolved document', () => {
    expect(linkAction(link({ href: 'Threads.md', 'data-doc-id': 'd2' }))).toEqual({ kind: 'open', docId: 'd2' });
  });

  it('names a missing document', () => {
    expect(linkAction(link({ href: 'OS/My%20notes.md#top', 'data-missing': 'true' }))).toEqual({ kind: 'notice', message: '“My notes.md” isn’t in this project.' });
  });

  it('keeps external and fragment links as they are', () => {
    for (const href of ['https://example.com', 'mailto:a@b.c', '#intro', '//cdn.example/x']) {
      expect(linkAction(link({ href }))).toEqual({ kind: 'default' });
    }
  });

  it('stops other relative links from leaving the app', () => {
    for (const href of ['notes.txt', '/p/other', '../x']) {
      expect(linkAction(link({ href }))).toEqual({ kind: 'notice', message: 'Only links to documents in this project open here.' });
    }
  });
});
```

`src/preview/copy.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyCode, copyText } from './copy';

function stubClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: writeText ? { writeText } : undefined, configurable: true });
}
function stubExecCommand(result: boolean) {
  const execCommand = vi.fn(() => result);
  Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
  return execCommand;
}

afterEach(() => {
  vi.useRealTimers();
  stubClipboard();
  Reflect.deleteProperty(document, 'execCommand');
});

describe('copy', () => {
  it('uses the clipboard API when there is one', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    expect(await copyText('abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  it('falls back to a hidden textarea on plain-HTTP pages', async () => {
    const execCommand = stubExecCommand(true);
    expect(await copyText('abc')).toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('reports failure when nothing can copy', async () => {
    expect(await copyText('abc')).toBe(false);
  });

  it('copies a code block and shows Copied, then Copy again', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    document.body.innerHTML =
      '<figure class="md-code"><div class="md-code-bar"><button class="md-code-copy" aria-label="Copy code"><span>Copy</span></button></div><pre><code><span>const</span> a = 1;\n</code></pre></figure>';
    const button = document.querySelector('button')!;
    await copyCode(button);
    expect(writeText).toHaveBeenCalledWith('const a = 1;\n');
    expect(button.getAttribute('aria-label')).toBe('Copied');
    expect(button.textContent).toBe('Copied');
    vi.advanceTimersByTime(1400);
    expect(button.getAttribute('aria-label')).toBe('Copy code');
    expect(button.textContent).toBe('Copy');
  });

  it('says so when copying fails', async () => {
    document.body.innerHTML = '<figure class="md-code"><button class="md-code-copy"></button><pre><code>x</code></pre></figure>';
    const button = document.querySelector('button')!;
    await copyCode(button);
    expect(button.textContent).toBe('Couldn’t copy');
  });
});
```

`src/preview/Preview.test.tsx`:

```tsx
import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render as renderMarkdown } from '../renderer';
import { Preview } from './Preview';

function setup(html: string) {
  const onOpenDocument = vi.fn();
  const onNotice = vi.fn();
  render(<Preview html={html} onOpenDocument={onOpenDocument} onNotice={onNotice} />);
  return { onOpenDocument, onNotice };
}

describe('Preview', () => {
  it('opens a linked document instead of navigating the browser', () => {
    const { onOpenDocument } = setup('<p><a href="Threads.md" data-doc-id="d2">Next</a></p>');
    const link = screen.getByRole('link', { name: 'Next' });
    const event = createEvent.click(link);
    fireEvent(link, event);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenDocument).toHaveBeenCalledWith('d2');
  });

  it('gives a notice for a missing document', () => {
    const { onNotice, onOpenDocument } = setup('<p><a href="Gone.md" data-missing="true">Gone</a></p>');
    fireEvent.click(screen.getByRole('link', { name: 'Gone' }));
    expect(onNotice).toHaveBeenCalledWith('“Gone.md” isn’t in this project.');
    expect(onOpenDocument).not.toHaveBeenCalled();
  });

  it('lets external links through', () => {
    const { onNotice } = setup('<p><a href="https://example.com" target="_blank">Site</a></p>');
    const link = screen.getByRole('link', { name: 'Site' });
    const event = createEvent.click(link);
    fireEvent(link, event);
    expect(event.defaultPrevented).toBe(false);
    expect(onNotice).not.toHaveBeenCalled();
  });

  it('copies code from a rendered code block', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    setup(renderMarkdown('```js\nconst a = 1;\n```'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('const a = 1;\n');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
});
```

`src/app/Notice.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Notice } from './Notice';

describe('Notice', () => {
  it('announces the message and can be dismissed', () => {
    const onDismiss = vi.fn();
    render(<Notice notice={{ id: 1, text: 'Hello there.' }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status')).toHaveTextContent('Hello there.');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('dismisses itself after 5 seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Notice notice={{ id: 1, text: 'Hello.' }} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(4999));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('keeps an empty live region when there is nothing to say', () => {
    render(<Notice notice={null} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run src/preview src/app/Notice.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write the preview modules**

`src/preview/links.ts`:

```ts
export type LinkAction = { kind: 'open'; docId: string } | { kind: 'notice'; message: string } | { kind: 'default' };

const EXTERNAL = /^[a-z][a-z0-9+.-]*:|^\/\//i;

function displayName(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? '';
  const last = path.split('/').filter(Boolean).pop() ?? href;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** What a click on a preview link should do. Relative links never navigate the browser away from the app. */
export function linkAction(link: Element): LinkAction {
  const docId = link.getAttribute('data-doc-id');
  if (docId) return { kind: 'open', docId };
  const href = link.getAttribute('href') ?? '';
  if (link.getAttribute('data-missing') === 'true') return { kind: 'notice', message: `“${displayName(href)}” isn’t in this project.` };
  if (href === '' || href.startsWith('#') || EXTERNAL.test(href)) return { kind: 'default' };
  return { kind: 'notice', message: 'Only links to documents in this project open here.' };
}
```

`src/preview/copy.ts`:

```ts
import { CHECK_ICON, COPY_ICON } from '../renderer/icons';

/** Clipboard API on secure pages; a hidden textarea and execCommand on plain HTTP (P-021's LAN case). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea
  }
  if (typeof document.execCommand !== 'function') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'md-copy-buffer';
  document.body.append(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

function setButton(button: HTMLButtonElement, label: string, icon: string, ariaLabel = label): void {
  button.innerHTML = `${icon}<span>${label}</span>`;
  button.setAttribute('aria-label', ariaLabel);
}

export async function copyCode(button: HTMLButtonElement): Promise<void> {
  const code = button.closest('.md-code')?.querySelector('pre')?.textContent ?? '';
  const copied = await copyText(code);
  setButton(button, copied ? 'Copied' : 'Couldn’t copy', copied ? CHECK_ICON : COPY_ICON);
  window.setTimeout(() => setButton(button, 'Copy', COPY_ICON, 'Copy code'), 1400);
}
```

`src/preview/Preview.tsx`:

```tsx
import 'katex/dist/katex.min.css';
import type { MouseEvent } from 'react';
import { Prose } from '../ui';
import { copyCode } from './copy';
import { linkAction } from './links';
import './preview.css';

export interface PreviewProps {
  /** Sanitized HTML from the renderer. */
  html: string;
  onOpenDocument: (docId: string) => void;
  onNotice: (message: string) => void;
}

export function Preview({ html, onOpenDocument, onNotice }: PreviewProps) {
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('.md-code-copy');
    if (button instanceof HTMLButtonElement) {
      void copyCode(button);
      return;
    }
    const link = event.target.closest('a[href]');
    if (!link) return;
    const action = linkAction(link);
    if (action.kind === 'default') return;
    event.preventDefault();
    if (action.kind === 'open') onOpenDocument(action.docId);
    else onNotice(action.message);
  };
  return (
    <div className="md-preview" onClick={onClick}>
      <Prose html={html} />
    </div>
  );
}
```

`src/preview/index.ts`:

```ts
export { Preview, type PreviewProps } from './Preview';
```

`src/preview/preview.css`:

```css
.md-preview { min-height: 100%; }
.md-prose .md-math-error { color: var(--danger); background: var(--danger-soft); border-color: transparent; }
.md-prose .katex-display { overflow-x: auto; overflow-y: hidden; padding: var(--space-1) 0; }
.md-prose .md-img-missing.is-pending { border-style: solid; border-color: var(--line); }
.md-copy-buffer { position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; }
```

`src/app/Notice.tsx`:

```tsx
import { useEffect } from 'react';
import { Callout, IconButton } from '../ui';

export interface NoticeMessage {
  id: number;
  text: string;
}

/** A short-lived message at the bottom of the document area; the live region stays mounted so screen readers hear it. */
export function Notice({ notice, onDismiss }: { notice: NoticeMessage | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, onDismiss]);
  return (
    <div className="ws-notice" role="status">
      {notice && (
        <Callout tone="warning" actions={<IconButton icon="x" label="Dismiss" onClick={onDismiss} />}>
          {notice.text}
        </Callout>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run src/preview src/app/Notice.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing Workspace test** — add to `src/app/Workspace.test.tsx`

```tsx
  it('keeps relative links inside the app and says why', async () => {
    const { project, doc } = await projectWithDocument('<a href="/elsewhere">Away</a>');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    fireEvent.click(await screen.findByRole('link', { name: 'Away' }));
    // SaveStatus is also role="status", so address the notice region directly.
    const notice = () => container.querySelector('.ws-notice')!;
    await waitFor(() => expect(notice()).toHaveTextContent('Only links to documents in this project open here.'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(notice()).toBeEmptyDOMElement();
  });
```

Run: `npx vitest run src/app/Workspace.test.tsx`
Expected: FAIL — no notice.

- [ ] **Step 6: Wire Preview and Notice into the workspace**

`src/app/DocumentArea.tsx` — change the import `import { EmptyState, Prose } from '../ui';` to `import { EmptyState } from '../ui';`, add `import { Preview } from '../preview';`, and change the signature and preview section:

```tsx
export interface DocumentAreaProps {
  docId: string | undefined;
  draft: DocumentDraft;
  html: string;
  onOpenDocument: (docId: string) => void;
  onNotice: (message: string) => void;
}

export function DocumentArea({ docId, draft, html, onOpenDocument, onNotice }: DocumentAreaProps) {
```

```tsx
      <section className="ws-preview" aria-label="Preview">
        <Preview html={html} onOpenDocument={onOpenDocument} onNotice={onNotice} />
      </section>
```

`src/app/Workspace.tsx` — add `useState` to the React import, `import { Notice, type NoticeMessage } from './Notice';`, and inside `Workspace` after `closeDocument`:

```tsx
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const showNotice = useCallback((text: string) => setNotice({ id: Date.now() + Math.random(), text }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);
```

Replace the `<main>` element with:

```tsx
        <main className={`ws-main mode-${mode}`}>
          <DocumentArea docId={docId} draft={draft} html={html} onOpenDocument={openDocument} onNotice={showNotice} />
          <Notice notice={notice} onDismiss={dismissNotice} />
        </main>
```

Keep the hooks above the early returns (`project === undefined` / `null`), as the existing ones are.

`src/app/app.css` — append to the Workspace section:

```css
.ws-main { position: relative; }
.ws-notice { position: absolute; left: 50%; bottom: var(--space-4); transform: translateX(-50%); width: min(480px, calc(100% - var(--space-8))); z-index: 5; }
.ws-notice:empty { display: none; }
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS (including the existing Workspace tests).

- [ ] **Step 8: Log and commit**

Update `context.md`.

```bash
git add -A
git commit -m "feat(preview): copy buttons, in-app document links and workspace notices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Preview — Mermaid

**Files:**
- Create: `src/preview/mermaid.ts`
- Modify: `src/preview/Preview.tsx`, `src/preview/preview.css`, `src/app/theme.ts`, `src/app/DocumentArea.tsx`, `src/app/Workspace.tsx`
- Test: `src/preview/mermaid.test.ts`, `src/preview/Preview.mermaid.test.tsx`, `src/app/theme.test.tsx`

**Interfaces:**
- Consumes: `.md-mermaid[data-source]` placeholders (Task 4).
- Produces:
  - `type Theme = 'light' | 'dark'`
  - `type MermaidApi = Pick<(typeof import('mermaid'))['default'], 'initialize' | 'render'>`
  - `renderDiagrams(root: HTMLElement, theme: Theme, load?: () => Promise<MermaidApi>): Promise<void>`
  - `resetMermaid(): void` (tests only)
  - `useResolvedTheme(): Theme` in `src/app/theme.ts`
  - `Preview` gains `theme: Theme`; `DocumentArea` gains `theme: Theme`.

- [ ] **Step 1: Install Mermaid**

```bash
npm install mermaid@~11.17.2
```

- [ ] **Step 2: Write the failing tests** — `src/preview/mermaid.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDiagrams, resetMermaid, type MermaidApi } from './mermaid';

type RenderFn = (id: string, source: string) => Promise<{ svg: string }>;

function fakeApi(render: RenderFn = async (id, source) => ({ svg: `<svg data-id="${id}"><text>${source}</text></svg>` })) {
  const api = { initialize: vi.fn(), render: vi.fn(render) };
  return { api, load: () => Promise.resolve(api as unknown as MermaidApi) };
}

function host(...sources: string[]) {
  const el = document.createElement('div');
  for (const source of sources) {
    const placeholder = document.createElement('div');
    placeholder.className = 'md-mermaid';
    placeholder.dataset.source = source;
    el.append(placeholder);
  }
  document.body.append(el);
  return el;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  resetMermaid();
  document.body.innerHTML = '';
});

describe('renderDiagrams', () => {
  it('never loads Mermaid for a document without diagrams', async () => {
    const load = vi.fn();
    await renderDiagrams(host(), 'light', load);
    expect(load).not.toHaveBeenCalled();
  });

  it('shows a pending box at once, then the diagram, with strict security', async () => {
    const { api, load } = fakeApi();
    const root = host('graph TD\nA-->B');
    const done = renderDiagrams(root, 'light', load);
    const placeholder = root.querySelector<HTMLElement>('.md-mermaid')!;
    expect(placeholder.textContent).toBe('Rendering diagram…');
    expect(placeholder.dataset.state).toBe('pending');
    await done;
    expect(placeholder.querySelector('svg')).not.toBeNull();
    expect(placeholder.dataset.state).toBe('done');
    expect(api.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict', startOnLoad: false, suppressErrorRendering: true }));
  });

  it('fills cached diagrams without re-rendering', async () => {
    const { api, load } = fakeApi();
    await renderDiagrams(host('graph A'), 'light', load);
    const second = host('graph A');
    void renderDiagrams(second, 'light', load);
    expect(second.querySelector('svg')).not.toBeNull(); // synchronously: no flicker while typing elsewhere
    expect(api.render).toHaveBeenCalledTimes(1);
  });

  it('renders again for another theme', async () => {
    const { api, load } = fakeApi();
    await renderDiagrams(host('graph A'), 'light', load);
    await renderDiagrams(host('graph A'), 'dark', load);
    expect(api.render).toHaveBeenCalledTimes(2);
    expect(api.initialize).toHaveBeenCalledTimes(2);
  });

  it('shows a diagram error inline', async () => {
    const { load } = fakeApi(() => Promise.reject(new Error('Parse error on line 1')));
    const root = host('graph ???');
    await renderDiagrams(root, 'light', load);
    expect(root.querySelector('.md-render-error')?.textContent).toBe('Couldn’t render diagram: Parse error on line 1');
  });

  it('says when the diagram renderer can’t load, and tries again next time', async () => {
    const root = host('graph A');
    await renderDiagrams(root, 'light', () => Promise.reject(new Error('offline')));
    expect(root.querySelector('.md-render-error')?.textContent).toBe('Couldn’t load the diagram renderer.');
    const { load } = fakeApi();
    const again = host('graph A');
    await renderDiagrams(again, 'light', load);
    expect(again.querySelector('svg')).not.toBeNull();
  });

  it('drops a stale result', async () => {
    const gate = deferred<{ svg: string }>();
    const { load } = fakeApi(() => gate.promise);
    const root = host('graph A');
    const done = renderDiagrams(root, 'light', load);
    const placeholder = root.querySelector<HTMLElement>('.md-mermaid')!;
    placeholder.dataset.source = 'graph B'; // the document changed while rendering
    gate.resolve({ svg: '<svg id="old"></svg>' });
    await done;
    expect(placeholder.querySelector('svg')).toBeNull();
  });
});
```

`src/preview/Preview.mermaid.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderDiagrams } from './mermaid';
import { Preview } from './Preview';

vi.mock('./mermaid', () => ({ renderDiagrams: vi.fn(() => Promise.resolve()) }));

describe('Preview diagrams', () => {
  it('renders diagrams after each change and when the theme changes', () => {
    const html = '<div class="md-mermaid" data-source="graph A"></div>';
    const props = { onOpenDocument: vi.fn(), onNotice: vi.fn() };
    const { rerender } = render(<Preview html={html} theme="light" {...props} />);
    expect(renderDiagrams).toHaveBeenCalledTimes(1);
    expect(vi.mocked(renderDiagrams).mock.calls[0]![1]).toBe('light');
    rerender(<Preview html={html} theme="dark" {...props} />);
    expect(renderDiagrams).toHaveBeenCalledTimes(2);
    rerender(<Preview html={`${html}<p>more</p>`} theme="dark" {...props} />);
    expect(renderDiagrams).toHaveBeenCalledTimes(3);
  });
});
```

`src/app/theme.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, setSetting, SETTINGS } from '../store';
import { useResolvedTheme } from './theme';

beforeEach(clearDatabase);
afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useResolvedTheme', () => {
  it('uses the stored choice', async () => {
    await setSetting(SETTINGS.theme, 'dark');
    const { result } = renderHook(() => useResolvedTheme());
    await waitFor(() => expect(result.current).toBe('dark'));
  });

  it('follows the system preference for "system"', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    const { result } = renderHook(() => useResolvedTheme());
    await waitFor(() => expect(result.current).toBe('dark'));
  });

  it('falls back to light when the browser can’t say', () => {
    const { result } = renderHook(() => useResolvedTheme());
    expect(result.current).toBe('light');
  });
});
```

Run: `npx vitest run src/preview src/app/theme.test.tsx`
Expected: FAIL — `./mermaid` missing, `useResolvedTheme` missing.

- [ ] **Step 3: Write `src/preview/mermaid.ts`**

```ts
export type Theme = 'light' | 'dark';
export type MermaidApi = Pick<(typeof import('mermaid'))['default'], 'initialize' | 'render'>;

type Outcome = { svg: string } | { message: string };

const MAX_CACHED = 50;
const cache = new Map<string, Outcome>(); // insertion order = least recently used first
let queue: Promise<void> = Promise.resolve(); // Mermaid renders one diagram at a time
let configuredTheme: Theme | null = null;
let sequence = 0;

/** Lazy: Mermaid (~2 MB) becomes its own chunk, fetched only for documents with a diagram. */
export const loadMermaid = (): Promise<MermaidApi> => import('mermaid').then((module) => module.default);

export function resetMermaid(): void {
  cache.clear();
  queue = Promise.resolve();
  configuredTheme = null;
}

const cacheKey = (theme: Theme, source: string) => `${theme}\n${source}`;

function recall(key: string): Outcome | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function remember(key: string, outcome: Outcome): void {
  cache.delete(key);
  cache.set(key, outcome);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}

function show(el: HTMLElement, outcome: Outcome): void {
  if ('svg' in outcome) {
    el.innerHTML = outcome.svg;
    el.dataset.state = 'done';
    return;
  }
  const box = document.createElement('div');
  box.className = 'md-render-error';
  box.textContent = outcome.message;
  el.replaceChildren(box);
  el.dataset.state = 'error';
}

/** Diagram colors from the current design tokens, so diagrams follow the light and dark themes. */
function themeVariables(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const vars: Record<string, string> = {
    background: token('--paper'),
    primaryColor: token('--paper-raised'),
    primaryTextColor: token('--ink'),
    primaryBorderColor: token('--line-strong'),
    secondaryColor: token('--paper-sunken'),
    tertiaryColor: token('--paper-code'),
    lineColor: token('--ink-muted'),
    textColor: token('--ink'),
    fontFamily: token('--font-sans'),
  };
  return Object.fromEntries(Object.entries(vars).filter(([, value]) => value !== ''));
}

function configure(api: MermaidApi, theme: Theme): void {
  if (configuredTheme === theme) return;
  api.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme: 'base', themeVariables: themeVariables() });
  configuredTheme = theme;
}

/** Fill every `.md-mermaid` placeholder under `root`. Cached results are placed synchronously. */
export function renderDiagrams(root: HTMLElement, theme: Theme, load: () => Promise<MermaidApi> = loadMermaid): Promise<void> {
  const pending: Array<{ el: HTMLElement; source: string }> = [];
  for (const el of root.querySelectorAll<HTMLElement>('.md-mermaid')) {
    const source = el.dataset.source ?? '';
    const hit = recall(cacheKey(theme, source));
    if (hit) {
      show(el, hit);
    } else {
      el.dataset.state = 'pending';
      el.textContent = 'Rendering diagram…';
      pending.push({ el, source });
    }
  }
  if (pending.length === 0) return Promise.resolve();

  const work = queue.then(async () => {
    let api: MermaidApi;
    try {
      api = await load();
    } catch {
      for (const { el } of pending) if (el.isConnected) show(el, { message: 'Couldn’t load the diagram renderer.' });
      return;
    }
    configure(api, theme);
    for (const { el, source } of pending) {
      if (!el.isConnected || el.dataset.source !== source) continue;
      const key = cacheKey(theme, source);
      let outcome = recall(key);
      if (!outcome) {
        const id = `mdit-mermaid-${++sequence}`;
        try {
          outcome = { svg: (await api.render(id, source)).svg };
        } catch (error) {
          outcome = { message: `Couldn’t render diagram: ${error instanceof Error ? error.message : String(error)}` };
          document.getElementById(`d${id}`)?.remove(); // Mermaid's temporary wrapper, in case it was left behind
          document.getElementById(id)?.remove();
        }
        remember(key, outcome);
      }
      if (el.isConnected && el.dataset.source === source) show(el, outcome);
    }
  });
  queue = work.catch(() => undefined);
  return work;
}
```

- [ ] **Step 4: Preview runs the diagrams** — `src/preview/Preview.tsx`

Change the React import to `import { useLayoutEffect, useRef, type MouseEvent } from 'react';`, add `import { renderDiagrams, type Theme } from './mermaid';`, add `theme: Theme;` to `PreviewProps`, and update the component:

```tsx
export function Preview({ html, theme, onOpenDocument, onNotice }: PreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // After React has written the new HTML: fill diagram placeholders (cached ones synchronously).
  useLayoutEffect(() => {
    if (rootRef.current) void renderDiagrams(rootRef.current, theme);
  }, [html, theme]);
```

and put `ref={rootRef}` on the `.md-preview` div. Keep `onClick` as in Task 6.

In `src/preview/Preview.test.tsx` add `theme="light"` to the `<Preview …/>` in `setup`.

Export the type from `src/preview/index.ts`:

```ts
export type { Theme } from './mermaid';
export { Preview, type PreviewProps } from './Preview';
```

- [ ] **Step 5: Diagram styles** — append to `src/preview/preview.css`

```css
.md-prose .md-mermaid { display: flex; justify-content: center; margin: var(--space-6) 0; }
.md-prose .md-mermaid svg { max-width: 100%; height: auto; }
.md-prose .md-mermaid[data-state="pending"] { align-items: center; height: 120px; border: 1px solid var(--line); border-radius: var(--radius-lg); font: 400 13px/20px var(--font-sans); color: var(--ink-muted); }
.md-prose .md-mermaid[data-state="error"] { display: block; }
```

- [ ] **Step 6: Resolved theme** — add to `src/app/theme.ts`

Change the React import to `import { useEffect, useState } from 'react';` and add:

```ts
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** The theme actually shown: the stored choice, or the system preference for "system". */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useSetting<ThemeChoice>(SETTINGS.theme, 'system') ?? 'system';
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.(DARK_QUERY).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return;
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}
```

- [ ] **Step 7: Pass the theme through**

`src/app/DocumentArea.tsx`: add `import type { Theme } from '../preview';`, add `theme: Theme;` to `DocumentAreaProps`, destructure `theme`, and render `<Preview html={html} theme={theme} onOpenDocument={onOpenDocument} onNotice={onNotice} />`.

`src/app/Workspace.tsx`: `import { useResolvedTheme } from './theme';`, add `const theme = useResolvedTheme();` next to the other hooks, and pass `theme={theme}` to `DocumentArea`.

- [ ] **Step 8: Run everything**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: PASS. In the build output, Mermaid appears as separate chunk files (names containing `mermaid` or diagram names such as `flowDiagram`), not inside the main `index-*.js`.

- [ ] **Step 9: Log and commit**

Update `context.md`.

```bash
git add -A
git commit -m "feat(preview): lazy Mermaid diagrams, cached per theme, strict security

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Editor — insert handle, image drop and paste

**Files:**
- Create: `src/editor/files.ts`
- Modify: `src/editor/Editor.tsx`, `src/editor/extensions.ts`, `src/editor/index.ts`
- Test: extend `src/editor/Editor.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `interface EditorHandle { insertBlock(text: string, at?: number | null): void }` — inserts `text` as its own block: a blank line is added before it (unless at the start or already there) and after it (unless at the end or already there), so `# Hello` + an image never becomes `# Hello![…]`. `at` null/omitted = the cursor, or the end of the document if the editor never had focus; the cursor moves to the end of `text`; one undo step.
  - `Editor` is a `forwardRef<EditorHandle, EditorProps>`; `EditorProps` gains `onImageFiles?: (files: File[], at: number | null) => void` (`at` = drop position, null for paste).
  - `imageFiles(list: FileList | readonly File[] | null | undefined): File[]`

- [ ] **Step 1: Write the failing tests** — add to `src/editor/Editor.test.tsx`

Add imports `import { act, createRef } from 'react';` (or `act` from `@testing-library/react`, whichever the file already uses), `import { fireEvent, render } from '@testing-library/react';` if missing, and `import { Editor, type EditorHandle } from './Editor';`. Then:

```tsx
describe('Editor insert and images', () => {
  const setup = (content = 'hello') => {
    const ref = createRef<EditorHandle>();
    const onChange = vi.fn();
    const onImageFiles = vi.fn();
    const { container } = render(<Editor ref={ref} initialContent={content} onChange={onChange} onSave={() => {}} onImageFiles={onImageFiles} />);
    return { ref, onChange, onImageFiles, content: container.querySelector<HTMLElement>('.cm-content')! };
  };

  it('inserts a block at the end before the editor has had focus, then at the cursor', () => {
    const { ref, onChange } = setup('# Hello');
    act(() => ref.current!.insertBlock('![a](a.png)'));
    expect(onChange).toHaveBeenLastCalledWith('# Hello

![a](a.png)');
    act(() => ref.current!.insertBlock('![b](b.png)'));
    // the cursor sits after the first insert, which is the end
    expect(onChange).toHaveBeenLastCalledWith('# Hello

![a](a.png)

![b](b.png)');
  });

  it('inserts at an explicit position, separated by blank lines', () => {
    const { ref, onChange } = setup('hello
world');
    act(() => ref.current!.insertBlock('X', 0));
    expect(onChange).toHaveBeenLastCalledWith('X

hello
world');
  });

  it('adds only the newlines that are missing', () => {
    const { ref, onChange } = setup('a

b');
    act(() => ref.current!.insertBlock('X', 3)); // start of "b", right after a blank line
    expect(onChange).toHaveBeenLastCalledWith('a

X

b');
  });

  it('uses the cursor once the editor has had focus', () => {
    const { ref, onChange, content } = setup('hello');
    fireEvent.focus(content);
    act(() => ref.current!.insertBlock('X'));
    // CodeMirror starts with the cursor at 0
    expect(onChange).toHaveBeenLastCalledWith('X

hello');
  });

  it('hands dropped and pasted images to onImageFiles', () => {
    const { onImageFiles, content } = setup();
    const png = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.drop(content, { dataTransfer: { files: [png], types: ['Files'] } });
    expect(onImageFiles).toHaveBeenCalledTimes(1);
    expect(onImageFiles.mock.calls[0]![0]).toEqual([png]);
    fireEvent.paste(content, { clipboardData: { files: [png], types: ['Files'] } });
    expect(onImageFiles).toHaveBeenCalledTimes(2);
    expect(onImageFiles.mock.calls[1]).toEqual([[png], null]);
  });

  it('ignores files that aren’t images', () => {
    const { onImageFiles, content } = setup();
    fireEvent.paste(content, { clipboardData: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })], types: ['Files'] } });
    expect(onImageFiles).not.toHaveBeenCalled();
  });
});
```

Run: `npx vitest run src/editor`
Expected: FAIL — `EditorHandle` isn't exported; `ref` isn't accepted.

- [ ] **Step 2: Write `src/editor/files.ts`**

```ts
const IMAGE_NAME = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic|avif)$/i;

/** Files that look like images. Unsupported image types still go through, so the app can say why they were refused. */
export function imageFiles(list: FileList | readonly File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) => file.type.startsWith('image/') || (file.type === '' && IMAGE_NAME.test(file.name)));
}
```

- [ ] **Step 3: Extensions** — `src/editor/extensions.ts`

Add `import { imageFiles } from './files';`, extend the callbacks and add the handlers:

```ts
export interface EditorCallbacks {
  onChange: (content: string) => void;
  onSave: () => void;
  onImageFiles: (files: File[], at: number | null) => void;
  onFocus: () => void;
}

export function createExtensions({ onChange, onSave, onImageFiles, onFocus }: EditorCallbacks): Extension[] {
  return [
    // …existing extensions unchanged…
    EditorView.domEventHandlers({
      focus: () => {
        onFocus();
        return false;
      },
      drop: (event, view) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        onImageFiles(files, view.posAtCoords({ x: event.clientX, y: event.clientY }));
        return true;
      },
      paste: (event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        onImageFiles(files, null);
        return true;
      },
    }),
  ];
}
```

(Put the `domEventHandlers` entry after `EditorView.contentAttributes.of(…)` and before `editorTheme`.)

- [ ] **Step 4: Editor with a handle** — replace `src/editor/Editor.tsx`

```tsx
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createExtensions } from './extensions';

export interface EditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onSave: () => void;
  /** Image files dropped (at = document position) or pasted (at = null). */
  onImageFiles?: (files: File[], at: number | null) => void;
}

export interface EditorHandle {
  /** Insert `text` as its own block at `at`, or at the cursor (the end if the editor never had focus). One undo step. */
  insertBlock(text: string, at?: number | null): void;
}

/** Uncontrolled CodeMirror editor. Give it a `key` per document to load different content. */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialContent, onChange, onSave, onImageFiles }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const focusedRef = useRef(false);
  const callbacks = useRef({ onChange, onSave, onImageFiles });
  useEffect(() => {
    callbacks.current = { onChange, onSave, onImageFiles };
  });

  useImperativeHandle(ref, () => ({
    insertBlock(text, at = null) {
      const view = viewRef.current;
      if (!view) return;
      const doc = view.state.doc;
      const from = at ?? (focusedRef.current ? view.state.selection.main.head : doc.length);
      const before = doc.sliceString(Math.max(0, from - 2), from);
      const after = doc.sliceString(from, Math.min(doc.length, from + 2));
      const prefix = from === 0 || before.endsWith('

') ? '' : before.endsWith('
') ? '
' : '

';
      const suffix = from === doc.length || after.startsWith('

') ? '' : after.startsWith('
') ? '
' : '

';
      view.dispatch({
        changes: { from, insert: `${prefix}${text}${suffix}` },
        selection: { anchor: from + prefix.length + text.length },
        scrollIntoView: true,
        userEvent: 'input.paste',
      });
      focusedRef.current = true; // later inserts follow this one
    },
  }), []);

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: initialContent,
        extensions: createExtensions({
          onChange: (content) => callbacks.current.onChange(content),
          onSave: () => callbacks.current.onSave(),
          onImageFiles: (files, at) => callbacks.current.onImageFiles?.(files, at),
          onFocus: () => {
            focusedRef.current = true;
          },
        }),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uncontrolled: content is read once per mount
  }, []);

  return <div className="editor-host" ref={hostRef} />;
});
```

`src/editor/index.ts`:

```ts
export { Editor, type EditorHandle, type EditorProps } from './Editor';
```

- [ ] **Step 5: Run everything**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS. If `fireEvent.focus` doesn't reach CodeMirror's `focus` handler in jsdom, use `content.focus()` inside `act` instead.

- [ ] **Step 6: Log and commit**

Update `context.md`.

```bash
git add -A
git commit -m "feat(editor): insertBlock handle and image drop/paste hand-off

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Tree — image rows

**Files:**
- Create: `src/tree/ImageThumb.tsx`
- Modify: `src/tree/buildTree.ts`, `src/tree/messages.ts`, `src/tree/FileTree.tsx`, `src/tree/tree.css`
- Test: extend `src/tree/buildTree.test.ts`, `src/tree/messages.test.ts`, `src/tree/FileTree.test.tsx`

**Interfaces:**
- Consumes: `useImages`, `addImageFiles`, `renameImage`, `moveImage`, `deleteImage`, `formatSize`, `ImageAsset` (Task 1). `TreeItem` already supports `kind: 'image'`.
- Produces:
  - `TreeNode` gains `{ kind: 'image'; id; name; parentId; depth }`
  - `buildTree(folders, documents, images?: readonly ImageAsset[])`, `folderContents(folderId, folders, documents, images?)` → `{ folders; documents; images }`
  - `deleteMessage(node: { kind: 'folder' | 'file' | 'image'; name }, contents?: { folders; documents; images? })`
  - `FileTreeProps` gains `onInsertImage?: (image: ImageAsset) => void` (omit when no document is open) and `imageUrls?: ReadonlyMap<string, string>`.

- [ ] **Step 1: Write the failing tests**

`src/tree/buildTree.test.ts` — update the existing `folderContents` expectation to `{ folders: 1, documents: 2, images: 0 }` and add:

```ts
describe('images in the tree', () => {
  const image = (id: string, folderId: string | null, name: string) =>
    ({ id, projectId: 'p', folderId, name, contentType: 'image/png', size: 1, sha256: '', createdAt: 0, updatedAt: 0 }) as const;

  it('lists images among files, sorted by name, after folders', () => {
    const tree = buildTree(
      [{ id: 'f', projectId: 'p', parentFolderId: null, name: 'Z folder', createdAt: 0, updatedAt: 0 }],
      [{ id: 'd', projectId: 'p', folderId: null, title: 'b.md', content: '', dirty: true, createdAt: 0, updatedAt: 0 }],
      [image('i', null, 'a.png'), image('j', 'f', 'inner.png')],
    );
    expect(tree.map((node) => [node.kind, node.name])).toEqual([['folder', 'Z folder'], ['image', 'a.png'], ['file', 'b.md']]);
    const folder = tree[0]!;
    expect(folder.kind === 'folder' && folder.children.map((node) => node.name)).toEqual(['inner.png']);
  });

  it('counts images inside a folder', () => {
    const folders = [{ id: 'f', projectId: 'p', parentFolderId: null, name: 'F', createdAt: 0, updatedAt: 0 }];
    expect(folderContents('f', folders, [], [image('i', 'f', 'a.png'), image('j', null, 'b.png')])).toEqual({ folders: 0, documents: 0, images: 1 });
  });
});
```

`src/tree/messages.test.ts` — add:

```ts
  it('lists images that go with a folder', () => {
    expect(deleteMessage({ kind: 'folder', name: 'OS' }, { folders: 1, documents: 2, images: 1 })).toBe(
      'Delete “OS” and the 2 documents, 1 image and 1 folder inside it? This can’t be undone.',
    );
  });

  it('names a single image', () => {
    expect(deleteMessage({ kind: 'image', name: 'a.png' })).toBe('Delete “a.png”? This can’t be undone.');
  });
```

`src/tree/FileTree.test.tsx` — extend the imports (`addImage`, `listImages` from `../store`; `type FileTreeProps` from `./FileTree`), change the helper so tests can pass extra props:

```tsx
function renderTree(projectId: string, activeDocId?: string, extra: Partial<FileTreeProps> = {}) {
  const onOpen = vi.fn();
  const onActiveDeleted = vi.fn();
  render(<FileTree projectId={projectId} activeDocId={activeDocId} onOpen={onOpen} onActiveDeleted={onActiveDeleted} {...extra} />);
  return { onOpen, onActiveDeleted };
}

const png = (name: string) => ({ name, type: 'image/png', bytes: new TextEncoder().encode('x').buffer as ArrayBuffer });
```

and add a `describe` block:

```tsx
describe('FileTree images', () => {
  it('lists images with files and does not open anything on click', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'B');
    await addImage(project.id, null, png('a.png'));
    const { onOpen } = renderTree(project.id);
    await user.click(await screen.findByRole('treeitem', { name: 'a.png' }));
    expect(screen.getAllByRole('treeitem').map((row) => row.getAttribute('aria-label'))).toEqual(['a.png', 'B.md']);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('inserts an image into the open document from its menu', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    const onInsertImage = vi.fn();
    renderTree(project.id, undefined, { onInsertImage });
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    await user.click(screen.getByRole('menuitem', { name: 'Insert in document' }));
    expect(onInsertImage).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.png' }));
  });

  it('disables Insert in document when no document is open', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    expect(screen.getByRole('menuitem', { name: 'Insert in document' })).toBeDisabled();
  });

  it('renames an image, keeping its extension', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename a.png' });
    await user.clear(input);
    await user.type(input, 'diagram{Enter}');
    expect(await screen.findByRole('treeitem', { name: 'diagram.png' })).toBeInTheDocument();
  });

  it('deletes an image after confirming', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “a.png”? This can’t be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete image' }));
    await waitFor(async () => expect(await listImages(project.id)).toEqual([]));
  });

  it('counts images when deleting a folder', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Scheduling');
    await createDocument(project.id, folder.id, 'A');
    await addImage(project.id, folder.id, png('a.png'));
    renderTree(project.id);
    await user.click(await screen.findByRole('button', { name: 'Actions for Scheduling' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “Scheduling” and the 1 document and 1 image inside it? This can’t be undone.');
  });

  it('moves an image by dragging it onto a folder', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Pics');
    const image = await addImage(project.id, null, png('a.png'));
    renderTree(project.id);
    const row = await screen.findByRole('treeitem', { name: 'a.png' });
    const target = screen.getByRole('treeitem', { name: 'Pics' });
    fireEvent.dragStart(row);
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(async () => expect((await listImages(project.id)).find((i) => i.id === image.id)?.folderId).toBe(folder.id));
  });

  it('adds image files dropped from the computer onto a folder', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'Pics');
    renderTree(project.id);
    const target = await screen.findByRole('treeitem', { name: 'Pics' });
    const files = [new File(['x'], 'Shot 1.png', { type: 'image/png' })];
    fireEvent.dragOver(target, { dataTransfer: { types: ['Files'], files } });
    fireEvent.drop(target, { dataTransfer: { types: ['Files'], files } });
    expect(await screen.findByRole('treeitem', { name: 'shot-1.png' })).toBeInTheDocument();
    expect((await listImages(project.id))[0]?.folderId).toBe(folder.id);
  });

  it('reports dropped files it could not add', async () => {
    const project = await createProject('OS');
    await createDocument(project.id, null, 'A');
    renderTree(project.id);
    const tree = await screen.findByRole('tree', { name: 'Files' });
    const files = [new File(['x'], 'notes.txt', { type: 'text/plain' })];
    fireEvent.dragOver(tree, { dataTransfer: { types: ['Files'], files } });
    fireEvent.drop(tree, { dataTransfer: { types: ['Files'], files } });
    expect(await screen.findByText('“notes.txt” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).')).toBeInTheDocument();
  });

  it('shows a thumbnail after hovering an image', async () => {
    const project = await createProject('OS');
    const image = await addImage(project.id, null, png('a.png'));
    renderTree(project.id, undefined, { imageUrls: new Map([[image.id, 'blob:test/thumb']]) });
    const row = await screen.findByRole('treeitem', { name: 'a.png' });
    fireEvent.mouseEnter(row);
    const tip = await screen.findByRole('tooltip', {}, { timeout: 1500 });
    expect(tip.querySelector('img')?.getAttribute('src')).toBe('blob:test/thumb');
    expect(tip).toHaveTextContent('1 byte');
    fireEvent.mouseLeave(row);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
```

Run: `npx vitest run src/tree`
Expected: FAIL — images aren't listed, `images` count missing.

- [ ] **Step 2: `src/tree/buildTree.ts`**

Change the import to `import { ancestorFolderIds, descendantFolderIds, type Folder, type ImageAsset, type MdDocument } from '../store';` and replace `TreeNode`, `buildTree` and `folderContents`:

```ts
export type TreeNode =
  | { kind: 'folder'; id: string; name: string; parentId: string | null; depth: number; children: TreeNode[] }
  | { kind: 'file' | 'image'; id: string; name: string; parentId: string | null; depth: number };

export function buildTree(folders: readonly Folder[], documents: readonly MdDocument[], images: readonly ImageAsset[] = []): TreeNode[] {
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
    const childFiles: TreeNode[] = [
      ...documents.filter((d) => parentOf(d.folderId) === parentId).map((d) => ({ kind: 'file' as const, id: d.id, name: d.title, parentId, depth })),
      ...images.filter((i) => parentOf(i.folderId) === parentId).map((i) => ({ kind: 'image' as const, id: i.id, name: i.name, parentId, depth })),
    ].sort(byName);
    return [...childFolders, ...childFiles];
  };
  return build(null, 0, new Set());
}
```

```ts
export function folderContents(folderId: string, folders: readonly Folder[], documents: readonly MdDocument[], images: readonly ImageAsset[] = []) {
  const nested = descendantFolderIds(folders, folderId);
  const inside = new Set([folderId, ...nested]);
  const within = (parent: string | null) => parent !== null && inside.has(parent);
  return {
    folders: nested.length,
    documents: documents.filter((d) => within(d.folderId)).length,
    images: images.filter((i) => within(i.folderId)).length,
  };
}
```

- [ ] **Step 3: `src/tree/messages.ts`**

```ts
import { listPhrase, plural } from '../lib/text';

export function deleteMessage(
  node: { kind: 'folder' | 'file' | 'image'; name: string },
  contents?: { folders: number; documents: number; images?: number },
): string {
  const parts: string[] = [];
  if (contents?.documents) parts.push(plural(contents.documents, 'document'));
  if (contents?.images) parts.push(plural(contents.images, 'image'));
  if (contents?.folders) parts.push(plural(contents.folders, 'folder'));
  const inside = parts.length > 0 ? ` and the ${listPhrase(parts)} inside it` : '';
  return `Delete “${node.name}”${inside}? This can’t be undone.`;
}
```

- [ ] **Step 4: `src/tree/ImageThumb.tsx`**

```tsx
import { useState } from 'react';
import { formatSize } from '../store';

/** Hover preview for an image row (app extension of TreeItem, P-013). */
export function ImageThumb({ anchor, url, size }: { anchor: DOMRect; url: string; size: number }) {
  const [dimensions, setDimensions] = useState<string | null>(null);
  return (
    <div className="tree-thumb" role="tooltip" style={{ top: anchor.top, left: anchor.right + 8 }}>
      <img src={url} alt="" onLoad={(event) => setDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)} />
      <span className="tree-thumb-meta">{dimensions ? `${dimensions} · ${formatSize(size)}` : formatSize(size)}</span>
    </div>
  );
}
```

Append to `src/tree/tree.css`:

```css
.tree-thumb { position: fixed; z-index: 30; display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-2); background: var(--paper-raised); border: 1px solid var(--line); border-radius: var(--radius-md); box-shadow: var(--shadow-pop); pointer-events: none; }
.tree-thumb img { display: block; max-width: 160px; max-height: 120px; object-fit: contain; }
.tree-thumb-meta { font: 400 12px/16px var(--font-sans); color: var(--ink-muted); }
```

- [ ] **Step 5: `src/tree/FileTree.tsx`**

Apply these changes (everything not mentioned stays as it is):

Imports:

```tsx
import { useEffect, useRef, useState, type DragEvent, type FocusEvent, type MouseEvent } from 'react';
import { ConfirmDialog } from '../dialogs';
import {
  addImageFiles, ancestorFolderIds, createDocument, createFolder, deleteDocument, deleteFolder, deleteImage, duplicateDocument,
  moveDocument, moveFolder, moveImage, renameDocument, renameFolder, renameImage, useDocuments, useFolders, useImages, userMessage,
  type ImageAsset,
} from '../store';
import { Button, Callout, EmptyState, IconButton, MenuButton, TreeItem, cx, type MenuItem } from '../ui';
import { buildTree, canMoveTo, flattenVisible, folderContents, isInsideFolder, type TreeNode } from './buildTree';
import { ImageThumb } from './ImageThumb';
import { deleteMessage } from './messages';
import { MoveDialog } from './MoveDialog';
import { RenameField } from './RenameField';
import './tree.css';
```

Props and constants:

```tsx
export interface FileTreeProps {
  projectId: string;
  activeDocId?: string;
  onOpen: (docId: string) => void;
  /** Called after the open document was deleted (directly or with its folder). */
  onActiveDeleted: () => void;
  /** Insert a reference to this image into the open document; omit when no document is open. */
  onInsertImage?: (image: ImageAsset) => void;
  /** Object URLs by image id, for hover thumbnails. */
  imageUrls?: ReadonlyMap<string, string>;
}

const DELETE_LABEL = { folder: 'Delete folder', file: 'Delete document', image: 'Delete image' } as const;
const THUMB_DELAY = 400;

/** Files dragged in from the computer (not a row being moved). */
function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
```

Inside the component — new hooks next to the existing ones (before `if (!folders …) return null`):

```tsx
  const images = useImages(projectId);
  const [thumb, setThumb] = useState<{ id: string; rect: DOMRect } | null>(null);
  const thumbTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(thumbTimer.current), []);
```

Change the guard and rows:

```tsx
  if (!folders || !documents || !images) return null;

  const rows = flattenVisible(buildTree(folders, documents, images), open);
```

Replace `move` and `remove`, and add `rename`, `addFiles`, thumbnail helpers:

```tsx
  const move = (node: TreeNode, targetId: string | null) =>
    node.kind === 'folder' ? moveFolder(node.id, targetId) : node.kind === 'image' ? moveImage(node.id, targetId) : moveDocument(node.id, targetId);

  const rename = (node: TreeNode, value: string) =>
    node.kind === 'folder' ? renameFolder(node.id, value) : node.kind === 'image' ? renameImage(node.id, value) : renameDocument(node.id, value);

  const remove = async (node: TreeNode) => {
    const active = documents.find((d) => d.id === activeDocId);
    const activeGone = node.kind === 'file' ? node.id === activeDocId : node.kind === 'folder' && isInsideFolder(active, node.id, folders);
    if (node.kind === 'folder') await deleteFolder(node.id);
    else if (node.kind === 'image') await deleteImage(node.id);
    else await deleteDocument(node.id);
    if (activeGone) onActiveDeleted();
  };

  const addFiles = (folderId: string | null, files: File[]) =>
    run(async () => {
      const { errors } = await addImageFiles(projectId, folderId, files);
      if (folderId) openFolders([folderId]);
      if (errors.length > 0) setError(errors.join(' '));
    });

  const showThumbLater = (id: string) => (event: MouseEvent<HTMLDivElement> | FocusEvent<HTMLDivElement>) => {
    window.clearTimeout(thumbTimer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    thumbTimer.current = window.setTimeout(() => setThumb({ id, rect }), THUMB_DELAY);
  };
  const hideThumb = () => {
    window.clearTimeout(thumbTimer.current);
    setThumb(null);
  };
```

Replace `menuFor`:

```tsx
  const menuFor = (node: TreeNode): MenuItem[] => {
    const tail: MenuItem[] = [
      { label: 'Move to…', onSelect: () => setDialog({ kind: 'move', node }) },
      'separator',
      { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', node }) },
    ];
    const renameItem: MenuItem = { label: 'Rename', icon: 'pencil', onSelect: () => setRenamingId(node.id) };
    if (node.kind === 'folder') {
      return [
        { label: 'New document', icon: 'file', onSelect: () => void newDocument(node.id) },
        { label: 'New folder', icon: 'folder', onSelect: () => void newFolder(node.id) },
        'separator',
        renameItem,
        ...tail,
      ];
    }
    if (node.kind === 'image') {
      const insert = () => {
        const image = images.find((i) => i.id === node.id);
        if (image) onInsertImage?.(image);
      };
      return [{ label: 'Insert in document', icon: 'image', disabled: !onInsertImage, onSelect: insert }, 'separator', renameItem, ...tail];
    }
    return [
      renameItem,
      { label: 'Duplicate', icon: 'copy', onSelect: () => void run(async () => onOpen((await duplicateDocument(node.id)).id)) },
      ...tail,
    ];
  };
```

Replace `dragOver` and `drop`:

```tsx
  const dragOver = (targetId: string | null) => (event: DragEvent) => {
    const fromComputer = dragging === null && hasFiles(event);
    if (!fromComputer && !canDrop(targetId)) return;
    event.preventDefault();
    event.stopPropagation();
    setDropTarget(targetId);
  };
  const drop = (targetId: string | null) => (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const node = dragging;
    endDrag();
    if (node) {
      if (canMoveTo(node, targetId, folders)) void run(() => move(node, targetId));
      return;
    }
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) void addFiles(targetId, files);
  };
```

In the rows, change the `RenameField` commit and the `TreeItem` props:

```tsx
                onCommit={async (value) => {
                  await rename(node, value);
                  setRenamingId(null);
                }}
```

```tsx
              <TreeItem
                key={node.id}
                kind={node.kind}
                name={node.name}
                depth={node.depth}
                open={node.kind === 'folder' ? open.has(node.id) : undefined}
                active={node.kind === 'file' && node.id === activeDocId}
                dropTarget={node.kind === 'folder' && dropTarget === node.id}
                onClick={node.kind === 'folder' ? () => toggleFolder(node.id) : node.kind === 'file' ? () => onOpen(node.id) : undefined}
                {...(node.kind === 'image'
                  ? { onMouseEnter: showThumbLater(node.id), onMouseLeave: hideThumb, onFocus: showThumbLater(node.id), onBlur: hideThumb }
                  : {})}
                draggable
                onDragStart={(event) => {
                  hideThumb();
                  event.dataTransfer?.setData('text/plain', node.name);
                  setDragging(node);
                }}
                onDragEnd={endDrag}
                // Dropping onto a document or image means "into the folder that holds it".
                onDragOver={dragOver(node.kind === 'folder' ? node.id : node.parentId)}
                onDrop={drop(node.kind === 'folder' ? node.id : node.parentId)}
                trailing={<MenuButton size="sm" label={`Actions for ${node.name}`} items={menuFor(node)} />}
              />
```

Replace the delete dialog and add the thumbnail after the dialogs:

```tsx
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={DELETE_LABEL[dialog.node.kind]}
          message={deleteMessage(dialog.node, dialog.node.kind === 'folder' ? folderContents(dialog.node.id, folders, documents, images) : undefined)}
          confirmLabel={DELETE_LABEL[dialog.node.kind]}
          onClose={() => setDialog(null)}
          onConfirm={() => remove(dialog.node)}
        />
      )}
      {thumb && thumbImage && thumbUrl && <ImageThumb anchor={thumb.rect} url={thumbUrl} size={thumbImage.size} />}
```

with, just before `return (`:

```tsx
  const thumbImage = thumb ? images.find((i) => i.id === thumb.id) : undefined;
  const thumbUrl = thumb ? imageUrls?.get(thumb.id) : undefined;
```

- [ ] **Step 6: `formatSize` says "1 byte"** — in `src/store/imageRules.ts`

```ts
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS. If the OS-file drop tests can't set `dataTransfer.types` through `fireEvent`, build the event with `createEvent.drop(target)` and `Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } })`, then `fireEvent(target, event)`.

- [ ] **Step 8: Log and commit**

Update `context.md`; add "TreeItem image thumbnail popover (`.tree-thumb`)" to P-013's list in `decisions.md`.

```bash
git add -A
git commit -m "feat(tree): image rows with insert, rename, move, delete, thumbnails and file drops

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Workspace — images in the preview and Insert image

**Files:**
- Create: `src/app/useImageUrls.ts`, `src/app/useProjectFiles.ts`, `src/app/imageInsert.ts`
- Modify: `src/app/Workspace.tsx`, `src/app/DocumentArea.tsx`, `src/test/setup.ts`
- Test: `src/app/useImageUrls.test.tsx`, `src/app/useProjectFiles.test.ts`, `src/app/imageInsert.test.ts`, extend `src/app/Workspace.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–9 (`useImages`, `getImageBytes`, `addImageFiles`, `findOrCreateFolder`, `checkImageFile`, `IMAGE_ACCEPT`; `createPathIndex`, `isExternalHref`, `encodeSegment`; `RenderContext`; `EditorHandle.insertBlock`; `FileTree` `onInsertImage`/`imageUrls`; Workspace `showNotice`).
- Produces:
  - `useImageUrls(images: readonly ImageAsset[] | undefined): ReadonlyMap<string, string>`
  - `createRenderContext(input: { loaded: boolean; index: PathIndex; docFolderId: string | null; imageUrls: ReadonlyMap<string, string> }): RenderContext`
  - `useProjectFiles(projectId: string, docId: string | undefined): ProjectFiles` with `interface ProjectFiles { index: PathIndex; imageUrls: ReadonlyMap<string, string>; docFolderId: string | null; context: RenderContext }`
  - `imageMarkdown(name: string, href: string): string`, `addImagesNextTo(projectId: string, docFolderId: string | null, files: readonly File[]): Promise<{ markdown: string; errors: string[] }>`

- [ ] **Step 1: Object URLs in tests** — append to `src/test/setup.ts`

```ts
// jsdom can't make object URLs for its own Blobs; tests only need unique strings.
let objectUrls = 0;
URL.createObjectURL = () => `blob:test/${++objectUrls}`;
URL.revokeObjectURL = () => {};
```

- [ ] **Step 2: Write the failing unit tests**

`src/app/useImageUrls.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addImage, clearDatabase, createProject, type ImageAsset } from '../store';
import { useImageUrls } from './useImageUrls';

const png = (name: string) => ({ name, type: 'image/png', bytes: new TextEncoder().encode('x').buffer as ArrayBuffer });

beforeEach(clearDatabase);

describe('useImageUrls', () => {
  it('makes one URL per image and revokes it when the image goes or on unmount', async () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const pid = (await createProject('OS')).id;
    const a = await addImage(pid, null, png('a.png'));
    const b = await addImage(pid, null, png('b.png'));
    const { result, rerender, unmount } = renderHook(({ images }: { images: ImageAsset[] }) => useImageUrls(images), {
      initialProps: { images: [a, b] },
    });
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(create).toHaveBeenCalledTimes(2);
    const urlA = result.current.get(a.id)!;
    const urlB = result.current.get(b.id)!;

    rerender({ images: [a] });
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(revoke).toHaveBeenCalledWith(urlB);

    rerender({ images: [{ ...a, name: 'renamed.png' }] }); // bytes never change: same URL
    expect(create).toHaveBeenCalledTimes(2);

    unmount();
    expect(revoke).toHaveBeenCalledWith(urlA);
  });
});
```

`src/app/useProjectFiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPathIndex } from '../paths';
import { createRenderContext } from './useProjectFiles';

const index = createPathIndex(
  [{ id: 'img', parentFolderId: null, name: 'images' }],
  [{ id: 'd1', folderId: null, title: 'Intro.md' }, { id: 'd2', folderId: null, title: 'Other.md' }],
  [{ id: 'i1', folderId: 'img', name: 'a.png' }],
);

describe('createRenderContext', () => {
  it('shows a loading box, not “not found”, before image bytes load', () => {
    const loading = createRenderContext({ loaded: false, index, docFolderId: null, imageUrls: new Map() });
    expect(loading.resolveImage('images/a.png')).toEqual({ pending: true });
    const noUrlYet = createRenderContext({ loaded: true, index, docFolderId: null, imageUrls: new Map() });
    expect(noUrlYet.resolveImage('images/a.png')).toEqual({ pending: true });
  });

  it('resolves stored images, external images and missing ones', () => {
    const ctx = createRenderContext({ loaded: true, index, docFolderId: null, imageUrls: new Map([['i1', 'blob:test/1']]) });
    expect(ctx.resolveImage('images/a.png')).toEqual({ src: 'blob:test/1' });
    expect(ctx.resolveImage('https://example.com/x.png')).toEqual({ src: 'https://example.com/x.png' });
    expect(ctx.resolveImage('images/gone.png')).toEqual({ missing: true });
    expect(ctx.resolveImage('Intro.md')).toEqual({ missing: true });
  });

  it('resolves links to documents, missing documents and other files', () => {
    const ctx = createRenderContext({ loaded: true, index, docFolderId: null, imageUrls: new Map() });
    expect(ctx.resolveLink('Other.md')).toEqual({ docId: 'd2' });
    expect(ctx.resolveLink('Gone.md')).toEqual({ missing: true });
    expect(ctx.resolveLink('images/a.png')).toEqual({ unsupported: true });
    expect(ctx.resolveLink('https://example.com')).toEqual({ external: true });
  });
});
```

`src/app/imageInsert.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createFolder, createProject, listFolders, listImages } from '../store';
import { addImagesNextTo, imageMarkdown } from './imageInsert';

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

beforeEach(clearDatabase);

describe('image insert', () => {
  it('writes Markdown with the name as alt text', () => {
    expect(imageMarkdown('screen-shot.png', 'images/screen-shot.png')).toBe('![screen-shot](images/screen-shot.png)');
    expect(imageMarkdown('[a].png', 'a.png')).toBe('![\\[a\\]](a.png)');
  });

  it('stores files in an images folder next to the document', async () => {
    const pid = (await createProject('OS')).id;
    const docFolder = await createFolder(pid, null, 'Notes');
    const result = await addImagesNextTo(pid, docFolder.id, [png('One.png'), png('Two.png')]);
    expect(result).toEqual({ markdown: '![one](images/one.png)\n\n![two](images/two.png)', errors: [] });
    const folders = await listFolders(pid);
    const imagesFolder = folders.find((f) => f.name === 'images')!;
    expect(imagesFolder.parentFolderId).toBe(docFolder.id);
    expect((await listImages(pid)).every((i) => i.folderId === imagesFolder.id)).toBe(true);
  });

  it('reuses an existing folder whatever its case', async () => {
    const pid = (await createProject('OS')).id;
    await createFolder(pid, null, 'Images');
    expect((await addImagesNextTo(pid, null, [png('a.png')])).markdown).toBe('![a](Images/a.png)');
    expect(await listFolders(pid)).toHaveLength(1);
  });

  it('adds valid files and reports the rest together', async () => {
    const pid = (await createProject('OS')).id;
    const result = await addImagesNextTo(pid, null, [png('a.png'), new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(result.markdown).toBe('![a](images/a.png)');
    expect(result.errors).toEqual(['“notes.txt” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).']);
  });

  it('creates no folder when every file is refused', async () => {
    const pid = (await createProject('OS')).id;
    const result = await addImagesNextTo(pid, null, [new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(result.markdown).toBe('');
    expect(result.errors).toHaveLength(1);
    expect(await listFolders(pid)).toEqual([]);
  });
});
```

Run: `npx vitest run src/app/useImageUrls.test.tsx src/app/useProjectFiles.test.ts src/app/imageInsert.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write the modules**

`src/app/useImageUrls.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { getImageBytes, type ImageAsset } from '../store';

/** One object URL per stored image. Bytes never change, so the id is the key; URLs are revoked when the image goes and on unmount. */
export function useImageUrls(images: readonly ImageAsset[] | undefined): ReadonlyMap<string, string> {
  const made = useRef(new Map<string, string>());
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    if (!images) return;
    let cancelled = false;
    const current = made.current;
    const publish = () => setUrls(new Map(current));
    const wanted = new Set(images.map((image) => image.id));
    let removed = false;
    for (const [id, url] of current) {
      if (!wanted.has(id)) {
        URL.revokeObjectURL(url);
        current.delete(id);
        removed = true;
      }
    }
    if (removed) publish();
    const missing = images.filter((image) => !current.has(image.id));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map(async (image) => {
        const bytes = await getImageBytes(image.id).catch(() => null);
        if (cancelled || !bytes || current.has(image.id)) return;
        current.set(image.id, URL.createObjectURL(new Blob([bytes], { type: image.contentType })));
      }),
    ).then(() => {
      if (!cancelled) publish();
    });
    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(() => {
    const current = made.current;
    return () => {
      for (const url of current.values()) URL.revokeObjectURL(url);
      current.clear();
    };
  }, []);

  return urls;
}
```

`src/app/useProjectFiles.ts`:

```ts
import { useMemo } from 'react';
import { createPathIndex, isExternalHref, type PathIndex } from '../paths';
import type { RenderContext } from '../renderer';
import { useDocuments, useFolders, useImages } from '../store';
import { useImageUrls } from './useImageUrls';

export interface ProjectFiles {
  index: PathIndex;
  imageUrls: ReadonlyMap<string, string>;
  /** Folder of the open document (null = project root). */
  docFolderId: string | null;
  context: RenderContext;
}

interface ContextInput {
  loaded: boolean;
  index: PathIndex;
  docFolderId: string | null;
  imageUrls: ReadonlyMap<string, string>;
}

/** Until the tree and the image's object URL are ready, stored images show "Loading image…", never "not found". */
export function createRenderContext({ loaded, index, docFolderId, imageUrls }: ContextInput): RenderContext {
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

export function useProjectFiles(projectId: string, docId: string | undefined): ProjectFiles {
  const folders = useFolders(projectId);
  const documents = useDocuments(projectId);
  const images = useImages(projectId);
  const imageUrls = useImageUrls(images);
  const loaded = folders !== undefined && documents !== undefined && images !== undefined;
  const index = useMemo(() => createPathIndex(folders ?? [], documents ?? [], images ?? []), [folders, documents, images]);
  const docFolderId = documents?.find((d) => d.id === docId)?.folderId ?? null;
  const context = useMemo(() => createRenderContext({ loaded, index, docFolderId, imageUrls }), [loaded, index, docFolderId, imageUrls]);
  return { index, imageUrls, docFolderId, context };
}
```

`src/app/imageInsert.ts`:

```ts
import { encodeSegment } from '../paths';
import { addImageFiles, checkImageFile, findOrCreateFolder, userMessage } from '../store';

/** `![alt](href)`, with the file name (no extension) as alt text. */
export function imageMarkdown(name: string, href: string): string {
  const alt = name.replace(/\.[^.]+$/, '').replace(/[[\]\\]/g, '\\$&');
  return `![${alt}](${href})`;
}

/**
 * Store dropped, pasted or picked files in an `images` folder next to the document (created on first use, any case)
 * and return the Markdown to insert plus every error, in file order. No folder is created if every file is refused.
 */
export async function addImagesNextTo(projectId: string, docFolderId: string | null, files: readonly File[]): Promise<{ markdown: string; errors: string[] }> {
  const errors: string[] = [];
  const valid = files.filter((file) => {
    try {
      checkImageFile(file.name, file.type, file.size);
      return true;
    } catch (error) {
      errors.push(userMessage(error));
      return false;
    }
  });
  if (valid.length === 0) return { markdown: '', errors };
  try {
    const folder = await findOrCreateFolder(projectId, docFolderId, 'images');
    const result = await addImageFiles(projectId, folder.id, valid);
    const markdown = result.added.map((image) => imageMarkdown(image.name, `${encodeSegment(folder.name)}/${encodeSegment(image.name)}`)).join('\n\n');
    return { markdown, errors: [...errors, ...result.errors] };
  } catch (error) {
    return { markdown: '', errors: [...errors, userMessage(error)] };
  }
}
```

Run the three unit test files again. Expected: PASS.

- [ ] **Step 4: Write the failing Workspace tests** — add to `src/app/Workspace.test.tsx`

Extend imports with `addImage`, `createFolder`, `listFolders` from `../store`. Add helpers and tests:

```tsx
const pngFile = (name: string) => new File(['x'], name, { type: 'image/png' });
const pngBytes = (name: string) => ({ name, type: 'image/png', bytes: new TextEncoder().encode('x').buffer as ArrayBuffer });
const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;
const editorText = (container: HTMLElement) => container.querySelector('.cm-content')?.textContent ?? '';

  it('Insert image stores the file next to the document and writes Markdown', async () => {
    const { project, doc } = await projectWithDocument('# Hello');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    expect(screen.getByRole('button', { name: 'Insert image' })).toBeEnabled();
    fireEvent.change(fileInput(container), { target: { files: [pngFile('Screen Shot.png')] } });
    expect(await screen.findByRole('treeitem', { name: 'images' })).toBeInTheDocument();
    await waitFor(() => expect(editorText(container)).toContain('![screen-shot](images/screen-shot.png)'));
    await waitFor(() => expect(container.querySelector('.md-prose img')?.getAttribute('src')).toMatch(/^blob:test\//));
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument(); // the image didn't join the heading
  });

  it('reports refused files in a notice and creates no folder', async () => {
    const { project, doc } = await projectWithDocument('# Hello');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    fireEvent.change(fileInput(container), { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(container.querySelector('.ws-notice')).toHaveTextContent('“notes.txt” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).'));
    expect(await listFolders(project.id)).toEqual([]);
  });

  it('shows a stored image referenced by a relative path, and a placeholder for a missing one', async () => {
    const project = await createProject('OS');
    const folder = await createFolder(project.id, null, 'images');
    await addImage(project.id, folder.id, pngBytes('a.png'));
    const doc = await createDocument(project.id, null, 'Intro');
    await saveDocumentContent(doc.id, '![A](images/a.png){width=50% align=right}\n\n![B](images/gone.png)');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await waitFor(() => expect(container.querySelector('.md-prose img')?.getAttribute('src')).toMatch(/^blob:test\//));
    const img = container.querySelector('.md-prose img')!;
    expect(img.getAttribute('width')).toBe('50%');
    expect(img.getAttribute('data-align')).toBe('right');
    expect(await screen.findByText('Image not found: images/gone.png')).toBeInTheDocument();
  });

  it('opens a relative link to another document, and explains a missing one', async () => {
    const project = await createProject('OS');
    const other = await createDocument(project.id, null, 'Other');
    await saveDocumentContent(other.id, '# Other page');
    const doc = await createDocument(project.id, null, 'Intro');
    await saveDocumentContent(doc.id, '[Go](Other.md) and [Gone](Gone.md)');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    fireEvent.click(await screen.findByRole('link', { name: 'Gone' }));
    await waitFor(() => expect(container.querySelector('.ws-notice')).toHaveTextContent('“Gone.md” isn’t in this project.'));
    fireEvent.click(screen.getByRole('link', { name: 'Go' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Other page' })).toBeInTheDocument();
  });

  it('inserts an image from the tree at the editor cursor', async () => {
    const project = await createProject('OS');
    await addImage(project.id, null, pngBytes('a.png'));
    const doc = await createDocument(project.id, null, 'Intro');
    await saveDocumentContent(doc.id, 'Text');
    const user = userEvent.setup();
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await user.click(await screen.findByRole('button', { name: 'Actions for a.png' }));
    await user.click(screen.getByRole('menuitem', { name: 'Insert in document' }));
    await waitFor(() => expect(editorText(container)).toContain('![a](a.png)'));
  });
```

Run: `npx vitest run src/app/Workspace.test.tsx`
Expected: FAIL — no file input, no image support in the preview.

- [ ] **Step 5: Wire the workspace**

`src/app/DocumentArea.tsx` — add `import type { Ref } from 'react';` and `import { Editor, type EditorHandle } from '../editor';` (replacing the plain `Editor` import), extend the props and pass them to the editor:

```tsx
export interface DocumentAreaProps {
  docId: string | undefined;
  draft: DocumentDraft;
  html: string;
  theme: Theme;
  editorRef: Ref<EditorHandle>;
  onImageFiles: (files: File[], at: number | null) => void;
  onOpenDocument: (docId: string) => void;
  onNotice: (message: string) => void;
}
```

```tsx
        <Editor
          ref={editorRef}
          key={docId}
          initialContent={draft.initialContent}
          onChange={draft.onChange}
          onSave={draft.saveNow}
          onImageFiles={onImageFiles}
        />
```

`src/app/Workspace.tsx` — imports:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditorHandle } from '../editor';
import { IMAGE_ACCEPT, SETTINGS, useProject, useSettingState, type ImageAsset } from '../store';
import { IconButton, SaveStatus, SegmentedControl, Wordmark, type SegmentedOption } from '../ui';
import { addImagesNextTo, imageMarkdown } from './imageInsert';
import { useProjectFiles } from './useProjectFiles';
```

Replace the `html` line with the project files, and add the image handlers after `showNotice` (all before the early returns):

```tsx
  const files = useProjectFiles(projectId, docId);
  const { index, docFolderId, imageUrls } = files;
  const html = useMemo(() => render(draft.previewSource, files.context), [draft.previewSource, files.context]);
  const editorRef = useRef<EditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docReady = draft.status === 'ready';
```

```tsx
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
```

In the toolbar's `ws-right`, before `SaveStatus`:

```tsx
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
```

Tree and document area:

```tsx
          <FileTree
            projectId={projectId}
            activeDocId={docId}
            onOpen={openDocument}
            onActiveDeleted={closeDocument}
            onInsertImage={docReady ? insertImage : undefined}
            imageUrls={imageUrls}
          />
```

```tsx
          <DocumentArea
            docId={docId}
            draft={draft}
            html={html}
            theme={theme}
            editorRef={editorRef}
            onImageFiles={(list, at) => void insertFiles(list, at)}
            onOpenDocument={openDocument}
            onNotice={showNotice}
          />
```

- [ ] **Step 6: Run everything**

Run: `npm test && npm run lint && npm run typecheck && npm run build`
Expected: PASS. Run `npm test` twice more to check the new Workspace tests are stable (they wait on live queries and object URLs).

- [ ] **Step 7: Log and commit**

Update `context.md`.

```bash
git add -A
git commit -m "feat(app): stored images in the preview, Insert image, drops, and in-app document links

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Verification and docs

**Files:**
- Modify: `README.md`, `context.md`, `decisions.md`
- Scratch (not committed): a Playwright script in the session scratchpad

**Interfaces:**
- Consumes: the whole branch.
- Produces: evidence for spec §13 acceptance, updated docs.

- [ ] **Step 1: Clean install and all checks**

```bash
rm -rf node_modules && npm ci
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all green. Record the test count.

- [ ] **Step 2: Mermaid is a separate, lazy chunk**

```bash
ls -S dist/assets | head -20
grep -l "flowchart-v2" dist/assets/index-*.js || echo "main bundle has no Mermaid code"
```

Expected: the second command prints "main bundle has no Mermaid code"; Mermaid's code is in other chunks. Note the size of `index-*.js` in the log.

- [ ] **Step 3: Container**

From the repo root:

```bash
docker build -t mdit-frontend frontend
docker run --rm -d -p 8080:80 --name mdit-p2 mdit-frontend
```

- [ ] **Step 4: Browser check (headless Edge, as in Phase 1)**

In the scratchpad directory: `npm init -y && npm install playwright-core@latest`, save a 1×1 PNG as `pixel.png` (e.g. `node -e "require('fs').writeFileSync('pixel.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'))"`), and write `check.mjs`:

```js
import { chromium } from 'playwright-core';

const BASE = process.env.BASE ?? 'http://localhost:8080';
const SAMPLE = [
  '# Check',
  '```mermaid\nflowchart TD\n  A-->B\n```',
  '```mermaid\nsequenceDiagram\n  A->>B: hi\n```',
  '```mermaid\nclassDiagram\n  class A\n```',
  '```mermaid\nerDiagram\n  A ||--o{ B : has\n```',
  '```mermaid\nflowchart TD\n  A-->\n```',
  'Inline $e^{i\\pi}+1=0$ and bad $\\foo$.',
  '$$\n\\int_0^1 x\\,dx\n$$',
  ...['java', 'javascript', 'typescript', 'python', 'sql', 'json', 'html', 'css', 'bash'].map((l) => '```' + l + '\nx\n```'),
  '![missing](images/gone.png)',
].join('\n\n');

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
const requests = [];
page.on('request', (r) => requests.push(r.url()));

await page.goto(BASE);
await page.getByRole('button', { name: 'New project' }).first().click();
await page.getByLabel('Name').fill('Phase 2 check');
await page.keyboard.press('Enter');
await page.getByRole('button', { name: 'Create document' }).click();
await page.keyboard.press('Enter'); // keep "Untitled.md"
await page.locator('.cm-content').click();
await page.keyboard.insertText('Plain text only.');
await page.waitForTimeout(1500);
const mermaidBefore = requests.filter((u) => /mermaid/i.test(u)).length;

await page.locator('.cm-content').click();
await page.keyboard.press('Control+A');
await page.keyboard.insertText(SAMPLE);
await page.waitForSelector('.md-mermaid[data-state="done"] svg', { timeout: 20000 });
await page.waitForTimeout(3000);

await page.locator('input[type="file"]').setInputFiles('pixel.png');
await page.waitForSelector('.md-prose img[src^="blob:"]');
await page.locator('.cm-content').press('Control+End');
await page.keyboard.insertText('{width=50% align=right}');
await page.waitForTimeout(500);

const result = await page.evaluate(() => ({
  diagrams: document.querySelectorAll('.md-mermaid[data-state="done"] svg').length,
  diagramErrors: document.querySelectorAll('.md-mermaid[data-state="error"]').length,
  katex: document.querySelectorAll('.katex').length,
  mathErrors: document.querySelectorAll('.md-math-error').length,
  highlighted: [...document.querySelectorAll('figure.md-code')].filter((f) => f.querySelector('[class^="hljs-"]')).length,
  missing: document.querySelectorAll('.md-img-missing').length,
  image: (() => { const i = document.querySelector('.md-prose img[src^="blob:"]'); return i && { width: i.getAttribute('width'), align: i.dataset.align }; })(),
  tree: [...document.querySelectorAll('[role="treeitem"]')].map((r) => r.getAttribute('aria-label')),
}));

await page.locator('.md-code-copy').first().click();
const copied = await page.evaluate(() => navigator.clipboard.readText());
await page.reload();
await page.waitForSelector('.md-prose img[src^="blob:"]');
const survivedReload = true;

console.log(JSON.stringify({ result, copied, survivedReload, mermaidBefore, mermaidAfter: requests.filter((u) => /mermaid/i.test(u)).length, problems }, null, 2));
await browser.close();
```

Run: `node check.mjs`
Expected: `diagrams` 4, `diagramErrors` 1, `katex` ≥ 2, `mathErrors` 1, `highlighted` ≥ 8 (a lone `x` may not produce a span in every language; open the page and check the ones that don't), `missing` 1, `image` `{ width: '50%', align: 'right' }`, `tree` includes `images` and `pixel.png` (open the folder if needed), `copied` is the first code block's text, `mermaidBefore` 0, `mermaidAfter` > 0, and `problems` has no Content-Security-Policy violations. If labels in the script don't match the UI (e.g. the project dialog's confirm button), adjust the script, not the app. Also rename `pixel.png` in the tree and confirm the preview shows the "Image not found" placeholder, then rename it back.

If a CSP violation appears, fix `frontend/nginx/security-headers.conf` with the narrowest change and log it as a decision.

Stop the container: `docker stop mdit-p2`.

- [ ] **Step 5: Docs**

- `README.md` Status: "Phase 2 (technical rendering) complete: Mermaid diagrams, KaTeX math, highlighted code blocks with copy, images stored in the project and shown in the tree." 
- `decisions.md`: make sure P-013 lists the Phase 2 app extensions (`--syntax-*` tokens and `.hljs` colors, `.md-img-missing.is-pending`, `.tree-thumb`, `.ws-notice`), and add any decision taken during the build.
- `context.md`: log the verification results (test count, bundle sizes, browser check numbers), set **Current state** to "Phase 2 built; PR pending", and tick Phase 2 in the checklist as "Built — PR pending".

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: record Phase 2 verification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then use superpowers:finishing-a-development-branch (push and open the PR only when the user asks).
