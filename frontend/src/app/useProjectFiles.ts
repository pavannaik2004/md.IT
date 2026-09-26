import { useMemo } from 'react';
import { createPathIndex, isExternalHref, type PathIndex } from '../paths';
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

interface ContextInput {
  loaded: boolean;
  index: PathIndex;
  docFolderId: string | null;
  imageUrls: ReadonlyMap<string, string>;
}

/** Until the tree and the image's object URL are ready, stored images show "Loading image…", never "not found". */
export function createRenderContext({ loaded, index, docFolderId, imageUrls }: ContextInput): RenderContext {
  return {
    resolveImage(href) {
      if (isExternalHref(href)) return { src: href };
      if (!loaded) return { pending: true };
      const found = index.resolve(docFolderId, href);
      if (found.kind !== 'image') return { missing: true };
      const url = imageUrls.get(found.id);
      return url ? { src: url } : { pending: true };
    },
    resolveLink(href) {
      if (isExternalHref(href)) return { external: true };
      if (!loaded) return { unsupported: true };
      const found = index.resolve(docFolderId, href);
      if (found.kind === 'document') return { docId: found.id };
      if (found.kind === 'missing') return { missing: true };
      return { unsupported: true };
    },
  };
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
