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
