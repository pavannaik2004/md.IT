import { db, now, toDocument, toKey, type DocumentRow } from './db';
import { assertNameFree, requireDocument, requireFolderIn, requireProject, siblingNames, touchProject } from './guards';
import { nextAvailableName, normalizeName, stripMdExtension, withMdExtension } from './names';
import type { MdDocument } from './types';

const tables = () => [db.projects, db.folders, db.documents];

export async function listDocuments(projectId: string): Promise<MdDocument[]> {
  const rows = await db.documents.where('projectId').equals(projectId).toArray();
  return rows.map(toDocument);
}

export async function getDocument(id: string): Promise<MdDocument | null> {
  const row = await db.documents.get(id);
  return row ? toDocument(row) : null;
}

export async function createDocument(projectId: string, folderId: string | null, title?: string): Promise<MdDocument> {
  const requested = title === undefined ? undefined : withMdExtension(normalizeName(title));
  return db.transaction('rw', tables(), async () => {
    await requireProject(projectId);
    if (folderId !== null) await requireFolderIn(projectId, folderId);
    const parentKey = toKey(folderId);
    const taken = await siblingNames(projectId, parentKey);
    const finalTitle = requested ?? nextAvailableName('Untitled', '.md', taken);
    assertNameFree(finalTitle, taken);
    const at = now();
    const row: DocumentRow = {
      id: crypto.randomUUID(), projectId, folderId: parentKey, title: finalTitle, content: '', dirty: true, createdAt: at, updatedAt: at,
    };
    await db.documents.add(row);
    await touchProject(projectId, at);
    return toDocument(row);
  });
}

export async function renameDocument(id: string, title: string): Promise<MdDocument> {
  const clean = withMdExtension(normalizeName(title));
  return db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    assertNameFree(clean, await siblingNames(doc.projectId, doc.folderId, id));
    const updated: DocumentRow = { ...doc, title: clean, updatedAt: now() };
    await db.documents.put(updated);
    await touchProject(doc.projectId, updated.updatedAt);
    return toDocument(updated);
  });
}

export async function duplicateDocument(id: string): Promise<MdDocument> {
  return db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    const taken = await siblingNames(doc.projectId, doc.folderId);
    const at = now();
    const row: DocumentRow = {
      id: crypto.randomUUID(),
      projectId: doc.projectId,
      folderId: doc.folderId,
      title: nextAvailableName(`${stripMdExtension(doc.title)} copy`, '.md', taken),
      content: doc.content,
      dirty: true,
      createdAt: at,
      updatedAt: at,
    };
    await db.documents.add(row);
    await touchProject(doc.projectId, at);
    return toDocument(row);
  });
}

export async function moveDocument(id: string, folderId: string | null): Promise<MdDocument> {
  return db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    if (folderId !== null) await requireFolderIn(doc.projectId, folderId);
    const parentKey = toKey(folderId);
    assertNameFree(doc.title, await siblingNames(doc.projectId, parentKey, id));
    const updated: DocumentRow = { ...doc, folderId: parentKey, updatedAt: now() };
    await db.documents.put(updated);
    await touchProject(doc.projectId, updated.updatedAt);
    return toDocument(updated);
  });
}

export async function deleteDocument(id: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const doc = await requireDocument(id);
    await db.documents.delete(id);
    await touchProject(doc.projectId);
  });
}

export async function saveDocumentContent(id: string, content: string): Promise<void> {
  await db.transaction('rw', db.projects, db.documents, async () => {
    const doc = await requireDocument(id);
    const at = now();
    await db.documents.update(id, { content, dirty: true, updatedAt: at });
    await touchProject(doc.projectId, at);
  });
}
