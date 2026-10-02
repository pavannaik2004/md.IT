import { db, toDocument, toFolder, toImage } from './db';
import { hierarchyTables } from './guards';
import type { Folder, ImageAsset, MdDocument, Project } from './types';

export interface ImageWithBytes extends ImageAsset {
  bytes: ArrayBuffer;
}

/** Everything in one project, read in one transaction (exports read from this, never from live queries). */
export interface ProjectSnapshot {
  project: Project;
  folders: Folder[];
  documents: MdDocument[];
  images: ImageWithBytes[];
}

export async function readProjectSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  return db.transaction('r', hierarchyTables(), async () => {
    const project = await db.projects.get(projectId);
    if (!project) return null;
    const [folders, documents, images] = await Promise.all([
      db.folders.where('projectId').equals(projectId).toArray(),
      db.documents.where('projectId').equals(projectId).toArray(),
      db.images.where('projectId').equals(projectId).toArray(),
    ]);
    const data = await db.imageData.bulkGet(images.map((image) => image.id));
    return {
      project,
      folders: folders.map(toFolder),
      documents: documents.map(toDocument),
      images: images.map((row, i) => ({ ...toImage(row), bytes: data[i]?.bytes ?? new ArrayBuffer(0) })),
    };
  });
}
