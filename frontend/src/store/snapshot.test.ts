import { beforeEach, describe, expect, it } from 'vitest';
import { addImage, clearDatabase, createDocument, createFolder, createProject, readProjectSnapshot, saveDocumentContent } from '.';

beforeEach(clearDatabase);

describe('readProjectSnapshot', () => {
  it('reads a whole project with image bytes', async () => {
    const project = await createProject('P');
    const folder = await createFolder(project.id, null, 'Docs');
    const doc = await createDocument(project.id, folder.id, 'Intro');
    await saveDocumentContent(doc.id, '# Hi');
    await addImage(project.id, folder.id, { name: 'a.png', type: 'image/png', bytes: new Uint8Array([1, 2, 3]).buffer });
    const snapshot = (await readProjectSnapshot(project.id))!;
    expect(snapshot.project.name).toBe('P');
    expect(snapshot.folders.map((f) => f.name)).toEqual(['Docs']);
    expect(snapshot.documents.map((d) => [d.title, d.content, d.folderId])).toEqual([['Intro.md', '# Hi', folder.id]]);
    expect(Array.from(new Uint8Array(snapshot.images[0]!.bytes))).toEqual([1, 2, 3]);
  });

  it('returns null for a project that isn’t stored', async () => {
    expect(await readProjectSnapshot('nope')).toBeNull();
  });
});
