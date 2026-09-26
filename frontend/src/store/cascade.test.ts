import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { createDocument, listDocuments } from './documents';
import { createFolder, deleteFolder, listFolders } from './folders';
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

  it('counts documents in project summaries', async () => {
    const pid = (await createProject('OS')).id;
    await createDocument(pid, null);
    await createDocument(pid, null);
    expect((await listProjectSummaries())[0]?.documentCount).toBe(2);
  });
});
