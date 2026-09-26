import { db, now, toFolder, toKey, type FolderRow } from './db';
import { InvalidMoveError } from './errors';
import { assertNameFree, hierarchyTables, requireFolder, requireFolderIn, requireProject, siblingNames, touchProject } from './guards';
import { descendantFolderIds } from './hierarchy';
import { newId } from './ids';
import { nameKey, nextAvailableName, normalizeName } from './names';
import type { Folder } from './types';

export async function listFolders(projectId: string): Promise<Folder[]> {
  const rows = await db.folders.where('projectId').equals(projectId).toArray();
  return rows.map(toFolder);
}

export async function createFolder(projectId: string, parentFolderId: string | null, name?: string): Promise<Folder> {
  const requested = name === undefined ? undefined : normalizeName(name);
  return db.transaction('rw', hierarchyTables(), async () => {
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
  return db.transaction('rw', hierarchyTables(), async () => {
    const folder = await requireFolder(id);
    assertNameFree(clean, await siblingNames(folder.projectId, folder.parentFolderId, id));
    const updated: FolderRow = { ...folder, name: clean, updatedAt: now() };
    await db.folders.put(updated);
    await touchProject(folder.projectId, updated.updatedAt);
    return toFolder(updated);
  });
}

export async function moveFolder(id: string, newParentId: string | null): Promise<Folder> {
  return db.transaction('rw', hierarchyTables(), async () => {
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
  await db.transaction('rw', hierarchyTables(), async () => {
    const folder = await requireFolder(id);
    const all = await listFolders(folder.projectId);
    const ids = [id, ...descendantFolderIds(all, id)];
    const keys = ids.map((folderId) => [folder.projectId, folderId]);
    await db.documents.where('[projectId+folderId]').anyOf(keys).delete();
    const imageIds = await db.images.where('[projectId+folderId]').anyOf(keys).primaryKeys();
    await db.images.bulkDelete(imageIds);
    await db.imageData.bulkDelete(imageIds);
    await db.folders.bulkDelete(ids);
    await touchProject(folder.projectId);
  });
}

/** The folder called `name` (any case) under the parent, created when missing. Throws NameConflictError if a non-folder has the name. */
export async function findOrCreateFolder(projectId: string, parentFolderId: string | null, name: string): Promise<Folder> {
  const clean = normalizeName(name);
  return db.transaction('rw', hierarchyTables(), async () => {
    await requireProject(projectId);
    if (parentFolderId !== null) await requireFolderIn(projectId, parentFolderId);
    const parentKey = toKey(parentFolderId);
    const siblings = await db.folders.where('[projectId+parentFolderId]').equals([projectId, parentKey]).toArray();
    const existing = siblings.find((f) => nameKey(f.name) === nameKey(clean));
    if (existing) return toFolder(existing);
    assertNameFree(clean, await siblingNames(projectId, parentKey));
    const at = now();
    const row: FolderRow = { id: newId(), projectId, parentFolderId: parentKey, name: clean, createdAt: at, updatedAt: at };
    await db.folders.add(row);
    await touchProject(projectId, at);
    return toFolder(row);
  });
}
