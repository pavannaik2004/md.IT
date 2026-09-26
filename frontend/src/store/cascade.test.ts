import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { createDocument, listDocuments } from './documents';
import { createFolder, deleteFolder, listFolders } from './folders';
import { addImage, getImageBytes, listImages } from './images';
import { createProject, deleteProject, getProject, listProjectSummaries } from './projects';

beforeEach(clearDatabase);

describe('cascading deletes', () => {
  it('deleting a folder removes documents at every depth and leaves the rest', async () => {
    const pid = (await createProject('OS')).id;
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    await createDocument(pid, a.id, 'one');
    await createDocument(pid, b.id, 'two');
    await createDocument(pid, null, 'keep');
    await deleteFolder(a.id);
    expect((await listDocuments(pid)).map((d) => d.title)).toEqual(['keep.md']);
  });

  it('deleting a project removes its folders and documents only', async () => {
    const pid = (await createProject('OS')).id;
    const other = (await createProject('Other')).id;
    const folder = await createFolder(pid, null, 'A');
    await createDocument(pid, folder.id, 'one');
    await createDocument(other, null, 'keep');
    await deleteProject(pid);
    expect(await getProject(pid)).toBeNull();
    expect(await listFolders(pid)).toEqual([]);
    expect(await listDocuments(pid)).toEqual([]);
    expect(await listDocuments(other)).toHaveLength(1);
  });

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

  it('counts documents in project summaries', async () => {
    const pid = (await createProject('OS')).id;
    await createDocument(pid, null);
    await createDocument(pid, null);
    expect((await listProjectSummaries())[0]?.documentCount).toBe(2);
  });
});
