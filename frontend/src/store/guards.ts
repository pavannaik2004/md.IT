import { db, now, type DocumentRow, type FolderRow, type ImageRow } from './db';
import { InvalidMoveError, NameConflictError, NotFoundError } from './errors';
import { nameKey } from './names';
import type { Project } from './types';

export async function requireProject(id: string): Promise<Project> {
  const project = await db.projects.get(id);
  if (!project) throw new NotFoundError('This project isn’t in this browser.');
  return project;
}

export async function requireFolder(id: string): Promise<FolderRow> {
  const folder = await db.folders.get(id);
  if (!folder) throw new NotFoundError('This folder no longer exists.');
  return folder;
}

export async function requireFolderIn(projectId: string, id: string): Promise<FolderRow> {
  const folder = await requireFolder(id);
  if (folder.projectId !== projectId) throw new InvalidMoveError('That folder belongs to another project.');
  return folder;
}

export async function requireDocument(id: string): Promise<DocumentRow> {
  const document = await db.documents.get(id);
  if (!document) throw new NotFoundError('This document no longer exists.');
  return document;
}

export async function requireImage(id: string): Promise<ImageRow> {
  const image = await db.images.get(id);
  if (!image) throw new NotFoundError('This image no longer exists.');
  return image;
}

/** Every table a tree change may read or write: sibling names span folders, documents and images. */
export const hierarchyTables = () => [db.projects, db.folders, db.documents, db.images, db.imageData];

export async function touchProject(projectId: string, at: number = now()): Promise<void> {
  await db.projects.update(projectId, { updatedAt: at });
}

/** Names of every folder, document and image directly under `parentKey`, optionally excluding one item. */
export async function siblingNames(projectId: string, parentKey: string, excludeId?: string): Promise<string[]> {
  const [folders, documents, images] = await Promise.all([
    db.folders.where('[projectId+parentFolderId]').equals([projectId, parentKey]).toArray(),
    db.documents.where('[projectId+folderId]').equals([projectId, parentKey]).toArray(),
    db.images.where('[projectId+folderId]').equals([projectId, parentKey]).toArray(),
  ]);
  return [
    ...folders.filter((f) => f.id !== excludeId).map((f) => f.name),
    ...documents.filter((d) => d.id !== excludeId).map((d) => d.title),
    ...images.filter((i) => i.id !== excludeId).map((i) => i.name),
  ];
}

export function assertNameFree(name: string, taken: readonly string[]): void {
  const key = nameKey(name);
  if (taken.some((existing) => nameKey(existing) === key)) throw new NameConflictError(name);
}
