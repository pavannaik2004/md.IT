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

class MdItDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  folders!: EntityTable<FolderRow, 'id'>;
  documents!: EntityTable<DocumentRow, 'id'>;
  images!: EntityTable<ImageAsset, 'id'>;
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
  }
}

export const db = new MdItDatabase();

export const now = (): number => Date.now();
export const toKey = (id: string | null): string => id ?? ROOT;
export const fromKey = (key: string): string | null => (key === ROOT ? null : key);
export const toFolder = (row: FolderRow): Folder => ({ ...row, parentFolderId: fromKey(row.parentFolderId) });
export const toDocument = (row: DocumentRow): MdDocument => ({ ...row, folderId: fromKey(row.folderId) });

/** Test helper: empty every table. */
export async function clearDatabase(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
