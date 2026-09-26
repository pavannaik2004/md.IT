import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createFolder, createProject, listFolders, listImages } from '../store';
import { addImagesNextTo, imageMarkdown } from './imageInsert';

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

beforeEach(clearDatabase);

describe('image insert', () => {
  it('writes Markdown with the name as alt text', () => {
    expect(imageMarkdown('screen-shot.png', 'images/screen-shot.png')).toBe('![screen-shot](images/screen-shot.png)');
    expect(imageMarkdown('[a].png', 'a.png')).toBe('![\\[a\\]](a.png)');
  });

  it('stores files in an images folder next to the document', async () => {
    const pid = (await createProject('OS')).id;
    const docFolder = await createFolder(pid, null, 'Notes');
    const result = await addImagesNextTo(pid, docFolder.id, [png('One.png'), png('Two.png')]);
    expect(result).toEqual({ markdown: '![one](images/one.png)\n\n![two](images/two.png)', errors: [] });
    const folders = await listFolders(pid);
    const imagesFolder = folders.find((f) => f.name === 'images')!;
    expect(imagesFolder.parentFolderId).toBe(docFolder.id);
    expect((await listImages(pid)).every((i) => i.folderId === imagesFolder.id)).toBe(true);
  });

  it('reuses an existing folder whatever its case', async () => {
    const pid = (await createProject('OS')).id;
    await createFolder(pid, null, 'Images');
    expect((await addImagesNextTo(pid, null, [png('a.png')])).markdown).toBe('![a](Images/a.png)');
    expect(await listFolders(pid)).toHaveLength(1);
  });

  it('adds valid files and reports the rest together', async () => {
    const pid = (await createProject('OS')).id;
    const result = await addImagesNextTo(pid, null, [png('a.png'), new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(result.markdown).toBe('![a](images/a.png)');
    expect(result.errors).toEqual(['“notes.txt” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).']);
  });

  it('creates no folder when every file is refused', async () => {
    const pid = (await createProject('OS')).id;
    const result = await addImagesNextTo(pid, null, [new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    expect(result.markdown).toBe('');
    expect(result.errors).toHaveLength(1);
    expect(await listFolders(pid)).toEqual([]);
  });
});
