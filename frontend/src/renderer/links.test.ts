import { describe, expect, it } from 'vitest';
import type { LinkResolution, RenderContext } from './context';
import { render } from './render';

const ctx = (links: Record<string, LinkResolution>): RenderContext => ({
  resolveImage: () => ({ missing: true }),
  resolveLink: (href) => links[href] ?? { unsupported: true },
});

describe('links', () => {
  it('marks a relative link to a document with its id', () => {
    expect(render('[Next](Threads.md)', ctx({ 'Threads.md': { docId: 'd2' } }))).toContain('data-doc-id="d2"');
  });

  it('marks a link to a missing document', () => {
    expect(render('[Gone](Gone.md)', ctx({ 'Gone.md': { missing: true } }))).toContain('data-missing="true"');
  });

  it('leaves unsupported and external links unmarked; external ones open in a new tab', () => {
    const html = render('[img](a.png) [site](https://example.com)', ctx({}));
    expect(html).not.toContain('data-doc-id');
    expect(html).not.toContain('data-missing');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('leaves relative links alone without a context', () => {
    const html = render('[next](Threads.md)');
    expect(html).toContain('href="Threads.md"');
    expect(html).not.toContain('data-');
  });
});
