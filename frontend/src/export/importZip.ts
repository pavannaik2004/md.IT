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
  // Only operating-system and tool clutter is ignored: md.IT names may start with "." (P-008).
  if (segments.some((s) => s === '__MACOSX' || s === '.git')) return 'ignore';
  if (/^(\.ds_store|thumbs\.db|desktop\.ini|\._.*)$/i.test(segments[segments.length - 1] ?? '')) return 'ignore';
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
  /** The name the store will keep (trimmed), or null after listing why it can't be used. */
  const clean = (segment: string, path: string): string | null => {
    try {
      return normalizeName(segment);
    } catch (error) {
      skipped.push({ path, reason: userMessage(error) });
      return null;
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
    if (!parent) continue;
    const folderName = clean(path[path.length - 1]!, `${keyOf(path)}/`);
    if (folderName === null) continue;
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
      const title = clean(raw.replace(/\.markdown$/i, '.md'), e.name);
      if (title === null) continue;
      const finalTitle = place(parent, title, title.slice(0, -3), title.slice(-3), ' ', e.name.replace(/\\/g, '/'));
      // The editor works in \n; Windows (\r\n) and old Mac (\r) line endings are converted on the way in.
      const content = new TextDecoder('utf-8').decode(e.bytes).replace(/\r\n?/g, '\n');
      documents.push({ folder: parent, title: finalTitle, content });
    } else if (kind === 'image') {
      const imageName = clean(raw, e.name);
      if (imageName === null) continue;
      const ext = extensionOf(imageName);
      const finalName = place(parent, imageName, imageName.slice(0, imageName.length - ext.length), ext, '-', e.name.replace(/\\/g, '/'));
      images.push({ folder: parent, name: finalName, contentType: imageTypeOf(imageName, '')!, bytes: e.bytes.slice().buffer as ArrayBuffer });
    } else {
      skipped.push({ path: e.name, reason: SKIP_REASONS.other }); // a mdit.json below the root
    }
  }

  if (documents.length === 0 && images.length === 0) throw new ValidationError(IMPORT_ERRORS.empty);
  return { name, description, rendering, folders, documents, images, skipped, renamed };
}
