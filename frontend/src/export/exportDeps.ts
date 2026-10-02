import geistCss from '@fontsource-variable/geist/index.css?inline';
import geistMonoCss from '@fontsource-variable/geist-mono/index.css?inline';
import serifCss from '@fontsource-variable/source-serif-4/wght.css?inline';
import serifItalicCss from '@fontsource-variable/source-serif-4/wght-italic.css?inline';
import katexCss from 'katex/dist/katex.min.css?inline';
import previewCss from '../preview/preview.css?inline';
import componentsCss from '../ui/components.css?inline';
import tokensCss from '../ui/tokens.css?inline';
import type { ExportDeps } from './html';

/** Vite rewrites url(...) inside these strings to built asset URLs; fetching them works offline once precached. */
async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}

export const exportDeps: ExportDeps = {
  baseCss: [tokensCss, componentsCss, previewCss].join('\n'),
  mathCss: katexCss,
  fontCss: [geistCss, geistMonoCss, serifCss, serifItalicCss].join('\n'),
  fetchBytes,
};
