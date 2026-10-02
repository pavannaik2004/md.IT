import { describe, expect, it } from 'vitest';
import { createPathIndex } from './paths';
import { createRenderContext } from './renderContext';

const index = createPathIndex(
  [{ id: 'img', parentFolderId: null, name: 'images' }],
  [{ id: 'd1', folderId: null, title: 'Intro.md' }, { id: 'd2', folderId: null, title: 'Other.md' }],
  [{ id: 'i1', folderId: 'img', name: 'a.png' }],
);

describe('createRenderContext', () => {
  it('shows a loading box, not “not found”, before image bytes load', () => {
    const loading = createRenderContext({ loaded: false, index, docFolderId: null, imageUrls: new Map() });
    expect(loading.resolveImage('images/a.png')).toEqual({ pending: true });
    const noUrlYet = createRenderContext({ loaded: true, index, docFolderId: null, imageUrls: new Map() });
    expect(noUrlYet.resolveImage('images/a.png')).toEqual({ pending: true });
  });

  it('resolves stored images, external images and missing ones', () => {
    const ctx = createRenderContext({ loaded: true, index, docFolderId: null, imageUrls: new Map([['i1', 'blob:test/1']]) });
    expect(ctx.resolveImage('images/a.png')).toEqual({ src: 'blob:test/1' });
    expect(ctx.resolveImage('https://example.com/x.png')).toEqual({ src: 'https://example.com/x.png' });
    expect(ctx.resolveImage('images/gone.png')).toEqual({ missing: true });
    expect(ctx.resolveImage('Intro.md')).toEqual({ missing: true });
  });

  it('resolves links to documents, missing documents and other files', () => {
    const ctx = createRenderContext({ loaded: true, index, docFolderId: null, imageUrls: new Map() });
    expect(ctx.resolveLink('Other.md')).toEqual({ docId: 'd2' });
    expect(ctx.resolveLink('Gone.md')).toEqual({ missing: true });
    expect(ctx.resolveLink('images/a.png')).toEqual({ unsupported: true });
    expect(ctx.resolveLink('https://example.com')).toEqual({ external: true });
  });
});
