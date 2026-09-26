export interface Project {
  id: string;
  name: string;
  description: string;
  cloudProjectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  projectId: string;
  parentFolderId: string | null;
  name: string;
  createdAt: number;
  updatedAt: number;
}

/** Named MdDocument to avoid clashing with the DOM's global Document type. */
export interface MdDocument {
  id: string;
  projectId: string;
  folderId: string | null;
  /** File name including the .md extension. */
  title: string;
  content: string;
  cloudDocumentId?: string;
  headVersionId?: string;
  /** Changed since the last cloud version. Always true until Phase 5 adds versions. */
  dirty: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ImageAsset {
  id: string;
  projectId: string;
  path: string;
  contentType: string;
  bytes: Blob;
  sha256: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface ProjectSummary extends Project {
  documentCount: number;
}
