export type ImageResolution = { src: string } | { missing: true } | { pending: true };
/** unsupported = the href points at something that isn't a document (an image or a folder). */
export type LinkResolution = { docId: string } | { missing: true } | { external: true } | { unsupported: true };

/** Supplied by the app: turns hrefs written in the open document into image sources and document ids. */
export interface RenderContext {
  resolveImage(href: string): ImageResolution;
  resolveLink(href: string): LinkResolution;
}

/** markdown-it env shared by the rules during one render. */
export interface RenderEnv {
  [key: string | symbol]: unknown;
  context?: RenderContext;
  /** Random per render; only placeholders carrying it are replaced with trusted math HTML. */
  nonce: string;
  /** KaTeX output by placeholder index. */
  math: string[];
}
