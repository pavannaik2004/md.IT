import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { createDocument } from './documents';
import { NameConflictError } from './errors';
import { createFolder, findOrCreateFolder, listFolders, renameFolder } from './folders';
import { addImage, addImageFiles, deleteImage, getImageBytes, listImages, moveImage, renameImage } from './images';
import { createProject } from './projects';

const bytes = (text = 'img') => new TextEncoder().encode(text).buffer as ArrayBuffer;
const png = (name: string, text?: string) => ({ name, type: 'image/png', bytes: bytes(text) });
const text = async (id: string) => new TextDecoder().decode((await getImageBytes(id)) ?? new ArrayBuffer(0));

beforeEach(clearDatabase);

describe('images', () => {
  it('adds an image with a cleaned name, size, hash and bytes', async () => {
    const pid = (await createProject('OS')).id;
    const image = await addImage(pid, null, png('Screen Shot.png', 'abc'));
    expect(image).toMatchObject({
      projectId: pid, folderId: null, name: 'screen-shot.png', contentType: 'image/png', size: 3,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    });
    expect(await text(image.id)).toBe('abc');
    expect(await listImages(pid)).toEqual([image]);
  });

  it('numbers clashing names with -2, -3', async () => {
    const pid = (await createProject('OS')).id;
    await addImage(pid, null, png('a.png'));
    expect((await addImage(pid, null, png('A.png'))).name).toBe('a-2.png');
    expect((await addImage(pid, null, png('a.png'))).name).toBe('a-3.png');
  });

  it('shares the sibling namespace with folders and documents', async () => {
    const pid = (await createProject('OS')).id;
    await createFolder(pid, null, 'b.png');
    expect((await addImage(pid, null, png('b.png'))).name).toBe('b-2.png');
    const image = await addImage(pid, null, png('c.png'));
    await expect(createFolder(pid, null, 'C.PNG')).rejects.toBeInstanceOf(NameConflictError);
    await expect(renameImage(image.id, 'B.PNG')).rejects.toThrow('“B.PNG” already exists here.');
  });

  it('rejects unsupported and oversized files', async () => {
    const pid = (await createProject('OS')).id;
    await expect(addImage(pid, null, { name: 'screen.bmp', type: 'image/bmp', bytes: bytes() })).rejects.toThrow(
      '“screen.bmp” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).',
    );
    await expect(addImage(pid, null, { name: 'big.png', type: 'image/png', bytes: new ArrayBuffer(Math.round(7.2 * 1024 * 1024)) })).rejects.toThrow(
      '“big.png” is 7.2 MB; images can be up to 5 MB.',
    );
    expect(await listImages(pid)).toEqual([]);
  });

  it('renames, keeping the extension', async () => {
    const pid = (await createProject('OS')).id;
    const image = await addImage(pid, null, png('a.png'));
    expect((await renameImage(image.id, 'diagram')).name).toBe('diagram.png');
    expect((await renameImage(image.id, 'final.png')).name).toBe('final.png');
  });

  it('moves into a folder unless the name is taken there', async () => {
    const pid = (await createProject('OS')).id;
    const folder = await createFolder(pid, null, 'images');
    const image = await addImage(pid, null, png('a.png'));
    expect((await moveImage(image.id, folder.id)).folderId).toBe(folder.id);
    const other = await addImage(pid, null, png('a.png'));
    await expect(moveImage(other.id, folder.id)).rejects.toBeInstanceOf(NameConflictError);
  });

  it('deletes the image and its bytes', async () => {
    const pid = (await createProject('OS')).id;
    const image = await addImage(pid, null, png('a.png'));
    await deleteImage(image.id);
    expect(await listImages(pid)).toEqual([]);
    expect(await getImageBytes(image.id)).toBeNull();
  });

  it('adds a batch of files and reports the ones it could not add', async () => {
    const pid = (await createProject('OS')).id;
    const files = [new File(['x'], 'One.png', { type: 'image/png' }), new File(['y'], 'notes.txt', { type: 'text/plain' })];
    const result = await addImageFiles(pid, null, files);
    expect(result.added.map((image) => image.name)).toEqual(['one.png']);
    expect(result.errors).toEqual(['“notes.txt” isn’t a supported image (PNG, JPEG, GIF, WebP or SVG).']);
  });

  it('finds or creates a folder by name, case-insensitively', async () => {
    const pid = (await createProject('OS')).id;
    const created = await findOrCreateFolder(pid, null, 'images');
    const again = await findOrCreateFolder(pid, null, 'Images');
    expect(again.id).toBe(created.id);
    await renameFolder(created.id, 'Images');
    expect((await findOrCreateFolder(pid, null, 'images')).id).toBe(created.id);
    expect(await listFolders(pid)).toHaveLength(1);
    await createDocument(pid, null, 'x');
    await expect(findOrCreateFolder(pid, null, 'x.md')).rejects.toBeInstanceOf(NameConflictError);
  });
});
