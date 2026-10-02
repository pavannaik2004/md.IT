import { useMemo } from 'react';
import { createPathIndex, createRenderContext, type PathIndex } from '../paths';
import type { RenderContext } from '../renderer';
import { useDocuments, useFolders, useImages } from '../store';
import { useImageUrls } from './useImageUrls';

export interface ProjectFiles {
  index: PathIndex;
  imageUrls: ReadonlyMap<string, string>;
  /** Folder of the open document (null = project root). */
  docFolderId: string | null;
  context: RenderContext;
}

export function useProjectFiles(projectId: string, docId: string | undefined): ProjectFiles {
  const folders = useFolders(projectId);
  const documents = useDocuments(projectId);
  const images = useImages(projectId);
  const imageUrls = useImageUrls(images);
  const loaded = folders !== undefined && documents !== undefined && images !== undefined;
  const index = useMemo(() => createPathIndex(folders ?? [], documents ?? [], images ?? []), [folders, documents, images]);
  const docFolderId = documents?.find((d) => d.id === docId)?.folderId ?? null;
  const context = useMemo(() => createRenderContext({ loaded, index, docFolderId, imageUrls }), [loaded, index, docFolderId, imageUrls]);
  return { index, imageUrls, docFolderId, context };
}
