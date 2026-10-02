import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RENDERING, type RenderingSettings } from '../settings';
import {
  addImage, clearDatabase, createDocument, createFolder, createProject, importProject, readProjectSnapshot, saveDocumentContent,
  setProjectDescription, type ProjectSnapshot,
} from '../store';
import { parseProjectZip } from './importZip';
import { exportProjectZip, folderSegments } from './zip';

beforeEach(clearDatabase);

/** Everything that must survive, independent of ids and order. */
function describeTree(snapshot: ProjectSnapshot): string[] {
  const segments = folderSegments(snapshot.folders);
  const dir = (id: string | null) => (id ? `${segments.get(id)!.join('/')}/` : '');
  return [
    ...snapshot.folders.map((f) => `folder ${dir(f.id)}`),
    ...snapshot.documents.map((d) => `doc ${dir(d.folderId)}${d.title} ${d.content}`),
    ...snapshot.images.map((i) => `image ${dir(i.folderId)}${i.name} ${i.contentType} ${i.sha256} ${Array.from(new Uint8Array(i.bytes)).join(',')}`),
  ].sort();
}

describe('project zip round trip', () => {
  it('brings back the same tree, contents, images, description and settings', async () => {
    const project = await createProject('Round trip');
    await setProjectDescription(project.id, 'Everything, twice');
    const guides = await createFolder(project.id, null, 'Guides');
    const deep = await createFolder(project.id, guides.id, 'Über');
    await createFolder(project.id, null, 'Empty');
    const intro = await createDocument(project.id, null, 'Intro');
    await saveDocumentContent(intro.id, '# Hi 👋\n\n![a](Guides/%C3%9Cber/a.png)');
    const setup = await createDocument(project.id, deep.id, 'Setup');
    await saveDocumentContent(setup.id, 'Run it.');
    await addImage(project.id, deep.id, { name: 'a.png', type: 'image/png', bytes: new Uint8Array([137, 80, 78, 71, 1, 2]).buffer });
    const rendering: RenderingSettings = { ...DEFAULT_RENDERING, font: 'sans', padding: 24 };

    const before = (await readProjectSnapshot(project.id))!;
    const parsed = await parseProjectZip(await exportProjectZip(before, rendering), 'ignored.zip');
    expect(parsed.rendering).toEqual(rendering);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.renamed).toEqual([]);

    const copy = await importProject(parsed);
    const after = (await readProjectSnapshot(copy.id))!;
    expect(after.project).toMatchObject({ name: 'Round trip', description: 'Everything, twice' });
    expect(describeTree(after)).toEqual(describeTree(before));
  });
});
