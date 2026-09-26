import { db, now, toFolder, toKey, type FolderRow } from './db';
import { InvalidMoveError } from './errors';
import { assertNameFree, requireFolder, requireFolderIn, requireProject, siblingNames, touchProject } from './guards';
import { descendantFolderIds } from './hierarchy';
import { newId } from './ids';
import { nextAvailableName, normalizeName } from './names';
import type { Folder } from './types';

const tables = () => [db.projects, db.folders, db.documents];

export async function listFolders(projectId: string): Promise<Folder[]> {
  const rows = await db.folders.where('projectId').equals(projectId).toArray();
  return rows.map(toFolder);
}

export async function createFolder(projectId: string, parentFolderId: string | null, name?: string): Promise<Folder> {
  const requested = name === undefined ? undefined : normalizeName(name);
  return db.transaction('rw', tables(), async () => {
    await requireProject(projectId);
    if (parentFolderId !== null) await requireFolderIn(projectId, parentFolderId);
    const parentKey = toKey(parentFolderId);
    const taken = await siblingNames(projectId, parentKey);
    const finalName = requested ?? nextAvailableName('New folder', '', taken);
    assertNameFree(finalName, taken);
    const at = now();
    const row: FolderRow = { id: newId(), projectId, parentFolderId: parentKey, name: finalName, createdAt: at, updatedAt: at };
    await db.folders.add(row);
    await touchProject(projectId, at);
    return toFolder(row);
  });
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const clean = normalizeName(name);
  return db.transaction('rw', tables(), async () => {
    const folder = await requireFolder(id);
    assertNameFree(clean, await siblingNames(folder.projectId, folder.parentFolderId, id));
    const updated: FolderRow = { ...folder, name: clean, updatedAt: now() };
    await db.folders.put(updated);
    await touchProject(folder.projectId, updated.updatedAt);
    return toFolder(updated);
  });
}

export async function moveFolder(id: string, newParentId: string | null): Promise<Folder> {
  return db.transaction('rw', tables(), async () => {
    const folder = await requireFolder(id);
    if (newParentId !== null) {
      await requireFolderIn(folder.projectId, newParentId);
      const all = await listFolders(folder.projectId);
      if (newParentId === id || descendantFolderIds(all, id).includes(newParentId)) {
        throw new InvalidMoveError('A folder can’t be moved into itself.');
      }
    }
    const parentKey = toKey(newParentId);
    assertNameFree(folder.name, await siblingNames(folder.projectId, parentKey, id));
    const updated: FolderRow = { ...folder, parentFolderId: parentKey, updatedAt: now() };
    await db.folders.put(updated);
    await touchProject(folder.projectId, updated.updatedAt);
    return toFolder(updated);
  });
}

export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const folder = await requireFolder(id);
    const all = await listFolders(folder.projectId);
    const ids = [id, ...descendantFolderIds(all, id)];
    await db.documents
      .where('[projectId+folderId]')
      .anyOf(ids.map((folderId) => [folder.projectId, folderId]))
      .delete();
    await db.folders.bulkDelete(ids);
    await touchProject(folder.projectId);
  });
}
