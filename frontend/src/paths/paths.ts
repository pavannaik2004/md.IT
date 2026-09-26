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
  // encodeURIComponent leaves ( and ) alone, so ASCII characters are encoded by hand.
  // # and ? too: resolve() cuts hrefs at them, and names like "C#" are allowed.
  return segment.replace(/[%\s()<>#?]/g, (c) =>
    c.charCodeAt(0) < 0x80 ? `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}` : encodeURIComponent(c),
  );
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
