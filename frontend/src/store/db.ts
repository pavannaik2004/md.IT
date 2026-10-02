import Dexie, { type EntityTable } from 'dexie';
import type { Folder, ImageAsset, MdDocument, Project, Setting } from './types';

/** IndexedDB cannot index null, so "at the project root" is stored as ''. */
export const ROOT = '';

export interface FolderRow extends Omit<Folder, 'parentFolderId'> {
  parentFolderId: string;
}

export interface DocumentRow extends Omit<MdDocument, 'folderId'> {
  folderId: string;
}

export interface ImageRow extends Omit<ImageAsset, 'folderId'> {
  folderId: string;
}

export interface ImageDataRow {
  id: string;
  bytes: ArrayBuffer;
}

class MdItDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  folders!: EntityTable<FolderRow, 'id'>;
  documents!: EntityTable<DocumentRow, 'id'>;
  images!: EntityTable<ImageRow, 'id'>;
  imageData!: EntityTable<ImageDataRow, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor() {
    super('mdit');
    this.version(1).stores({
      projects: 'id, updatedAt',
      folders: 'id, projectId, [projectId+parentFolderId]',
      documents: 'id, projectId, [projectId+folderId]',
      images: 'id, projectId, [projectId+path]',
      settings: 'key',
    });
    // v2: images are tree items (folderId + name) and their bytes move to imageData. v1 never stored an image.
    this.version(2)
      .stores({ images: 'id, projectId, [projectId+folderId]', imageData: 'id' })
      .upgrade((tx) => tx.table('images').clear());
  }
}

export const db = new MdItDatabase();

export const now = (): number => Date.now();
export const toKey = (id: string | null): string => id ?? ROOT;
export const fromKey = (key: string): string | null => (key === ROOT ? null : key);
export const toFolder = (row: FolderRow): Folder => ({ ...row, parentFolderId: fromKey(row.parentFolderId) });
export const toDocument = (row: DocumentRow): MdDocument => ({ ...row, folderId: fromKey(row.folderId) });
export const toImage = (row: ImageRow): ImageAsset => ({ ...row, folderId: fromKey(row.folderId) });

/** Test helper: empty every table. */
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
