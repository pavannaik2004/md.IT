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
