import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase } from './db';
import { InvalidMoveError, NameConflictError } from './errors';
import { createFolder, deleteFolder, listFolders, moveFolder, renameFolder } from './folders';
import { createProject } from './projects';

beforeEach(clearDatabase);

async function setup() {
  const project = await createProject('OS');
  return project.id;
}

describe('folders', () => {
  it('creates root and nested folders, exposing root as null', async () => {
    const pid = await setup();
    const root = await createFolder(pid, null, 'Scheduling');
    const nested = await createFolder(pid, root.id, 'Old');
    expect(root.parentFolderId).toBeNull();
    expect(nested.parentFolderId).toBe(root.id);
    expect((await listFolders(pid)).map((f) => f.name).sort()).toEqual(['Old', 'Scheduling']);
  });

  it('names new folders "New folder", "New folder 2", …', async () => {
    const pid = await setup();
    expect((await createFolder(pid, null)).name).toBe('New folder');
    expect((await createFolder(pid, null)).name).toBe('New folder 2');
  });

  it('rejects a sibling with the same name, ignoring case', async () => {
    const pid = await setup();
    await createFolder(pid, null, 'Notes');
    await expect(createFolder(pid, null, 'notes')).rejects.toBeInstanceOf(NameConflictError);
  });

  it('allows the same name under different parents', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    await expect(createFolder(pid, a.id, 'A')).resolves.toBeDefined();
  });

  it('renames, keeping the name free check but allowing a case-only change of itself', async () => {
    const pid = await setup();
    const folder = await createFolder(pid, null, 'notes');
    expect((await renameFolder(folder.id, 'Notes')).name).toBe('Notes');
  });

  it('refuses to move a folder into itself or its descendants', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    await expect(moveFolder(a.id, a.id)).rejects.toBeInstanceOf(InvalidMoveError);
    await expect(moveFolder(a.id, b.id)).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it('moves a folder to the root and to another folder', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    expect((await moveFolder(b.id, null)).parentFolderId).toBeNull();
    const c = await createFolder(pid, null, 'C');
    expect((await moveFolder(b.id, c.id)).parentFolderId).toBe(c.id);
  });

  it('refuses to move into a folder from another project', async () => {
    const pid = await setup();
    const other = await createProject('Other');
    const a = await createFolder(pid, null, 'A');
    const foreign = await createFolder(other.id, null, 'F');
    await expect(moveFolder(a.id, foreign.id)).rejects.toBeInstanceOf(InvalidMoveError);
  });

  it('deletes a folder with all nested folders', async () => {
    const pid = await setup();
    const a = await createFolder(pid, null, 'A');
    const b = await createFolder(pid, a.id, 'B');
    await createFolder(pid, b.id, 'C');
    await createFolder(pid, null, 'Keep');
    await deleteFolder(a.id);
    expect((await listFolders(pid)).map((f) => f.name)).toEqual(['Keep']);
  });
});
