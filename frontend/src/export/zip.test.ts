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
