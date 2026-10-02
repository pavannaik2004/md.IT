import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { db, now, toImage, toKey, type ImageRow } from './db';
import { userMessage } from './errors';
import { assertNameFree, hierarchyTables, requireFolderIn, requireImage, requireProject, siblingNames, touchProject } from './guards';
import { newId } from './ids';
import { checkImageFile, cleanImageName, withImageExtension } from './imageRules';
import { nextAvailableName, normalizeName } from './names';
import type { ImageAsset } from './types';

export interface NewImageFile {
  name: string;
  type: string;
  bytes: ArrayBuffer;
}

export async function listImages(projectId: string): Promise<ImageAsset[]> {
  const rows = await db.images.where('projectId').equals(projectId).toArray();
  return rows.map(toImage);
}

export async function getImageBytes(id: string): Promise<ArrayBuffer | null> {
  return (await db.imageData.get(id))?.bytes ?? null;
}

export async function addImage(projectId: string, folderId: string | null, file: NewImageFile): Promise<ImageAsset> {
  const type = checkImageFile(file.name, file.type, file.bytes.byteLength);
  const { stem, ext } = cleanImageName(file.name, type);
  // crypto.subtle is missing on plain-HTTP pages, so hash in JS (P-026).
  const hash = bytesToHex(sha256(new Uint8Array(file.bytes)));
  return db.transaction('rw', hierarchyTables(), async () => {
    await requireProject(projectId);
    if (folderId !== null) await requireFolderIn(projectId, folderId);
    const parentKey = toKey(folderId);
    const name = nextAvailableName(stem, ext, await siblingNames(projectId, parentKey), '-');
    const at = now();
    const row: ImageRow = {
      id: newId(), projectId, folderId: parentKey, name, contentType: type, size: file.bytes.byteLength, sha256: hash, createdAt: at, updatedAt: at,
    };
    await db.images.add(row);
    await db.imageData.add({ id: row.id, bytes: file.bytes });
    await touchProject(projectId, at);
    return toImage(row);
  });
}

/** Adds each file in order; files that fail are reported, the rest are still added. */
export async function addImageFiles(
  projectId: string,
  folderId: string | null,
  files: readonly File[],
): Promise<{ added: ImageAsset[]; errors: string[] }> {
  const added: ImageAsset[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      checkImageFile(file.name, file.type, file.size); // before reading a large file into memory
      added.push(await addImage(projectId, folderId, { name: file.name, type: file.type, bytes: await file.arrayBuffer() }));
    } catch (error) {
      errors.push(userMessage(error));
    }
  }
  return { added, errors };
}

export async function renameImage(id: string, name: string): Promise<ImageAsset> {
  const clean = normalizeName(name);
  return db.transaction('rw', hierarchyTables(), async () => {
    const image = await requireImage(id);
    const finalName = withImageExtension(clean, image.contentType);
    assertNameFree(finalName, await siblingNames(image.projectId, image.folderId, id));
    const updated: ImageRow = { ...image, name: finalName, updatedAt: now() };
    await db.images.put(updated);
    await touchProject(image.projectId, updated.updatedAt);
    return toImage(updated);
  });
}

export async function moveImage(id: string, folderId: string | null): Promise<ImageAsset> {
  return db.transaction('rw', hierarchyTables(), async () => {
    const image = await requireImage(id);
    if (folderId !== null) await requireFolderIn(image.projectId, folderId);
    const parentKey = toKey(folderId);
    assertNameFree(image.name, await siblingNames(image.projectId, parentKey, id));
    const updated: ImageRow = { ...image, folderId: parentKey, updatedAt: now() };
    await db.images.put(updated);
    await touchProject(image.projectId, updated.updatedAt);
    return toImage(updated);
  });
}

export async function deleteImage(id: string): Promise<void> {
  await db.transaction('rw', hierarchyTables(), async () => {
    const image = await requireImage(id);
    await db.images.delete(id);
    await db.imageData.delete(id);
    await touchProject(image.projectId);
  });
}
