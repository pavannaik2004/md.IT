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

function contentMatches(raw: string, pattern: RegExp): { count: number; snippets: Snippet[] } {
  // Offsets must match the editor, which counts any line break as one "\n".
  const content = raw.replace(/\r\n?/g, '\n');
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
