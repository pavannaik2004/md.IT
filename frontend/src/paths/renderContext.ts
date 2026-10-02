import type { RenderContext } from '../renderer';
import { isExternalHref, type PathIndex } from './paths';

export interface RenderContextInput {
  loaded: boolean;
  index: PathIndex;
  docFolderId: string | null;
  /** Image id → URL: object URLs in the preview, data: URIs in exports. */
  imageUrls: ReadonlyMap<string, string>;
}

/** Until the tree and the image's URL are ready, stored images show "Loading image…", never "not found". */
export function createRenderContext({ loaded, index, docFolderId, imageUrls }: RenderContextInput): RenderContext {
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
