import { describe, expect, it } from 'vitest';
import type { ImageResolution, RenderContext } from './context';
import { render } from './render';

const ctx = (images: Record<string, ImageResolution> = {}): RenderContext => ({
  resolveImage: (href) => images[href] ?? { missing: true },
  resolveLink: () => ({ unsupported: true }),
});

describe('images', () => {
  it('resolves a relative image through the context and keeps blob: sources', () => {
    const html = render('![Diagram](images/a.png)', ctx({ 'images/a.png': { src: 'blob:http://localhost/123' } }));
    expect(html).toContain('src="blob:http://localhost/123"');
    expect(html).toContain('alt="Diagram"');
  });

  it('applies width and align from the attribute block and hides the block', () => {
    const html = render('![a](x.png){width=400 align=left}', ctx({ 'x.png': { src: 'blob:x' } }));
    expect(html).toContain('width="400"');
    expect(html).toContain('data-align="left"');
    expect(html).not.toContain('{width');
  });

  it.each([
    ['400', '400'],
    ['400px', '400'],
    ['50%', '50%'],
    ['100%', '100%'],
  ])('accepts width=%s', (value, attr) => {
    expect(render(`![a](x.png){width=${value}}`, ctx({ 'x.png': { src: 'blob:x' } }))).toContain(`width="${attr}"`);
  });

  it.each(['{width=0}', '{width=101%}', '{width=abc}', '{align=middle}', '{height=4}', '{width=4 width=5}', '{}', '{width=400 onerror=alert(1)}'])(
    'leaves an invalid block visible: %s',
    (block) => {
      const html = render(`![a](x.png)${block}`, ctx({ 'x.png': { src: 'blob:x' } }));
      expect(html).not.toMatch(/<img[^>]*(width=|data-align=|onerror)/);
      expect(html).toContain(block);
    },
  );

  it('only reads a block that directly follows the image', () => {
    const html = render('![a](x.png) {width=400}', ctx({ 'x.png': { src: 'blob:x' } }));
    expect(html).not.toContain('width="400"');
    expect(html).toContain('{width=400}');
  });

  it('shows a placeholder for a missing image', () => {
    const html = render('![a](images/gone.png)', ctx());
    expect(html).toContain('class="md-img-missing"');
    expect(html).toContain('Image not found: images/gone.png');
    expect(html).not.toContain('<img');
  });

  it('shows a loading box while bytes are still loading', () => {
    const html = render('![a](a.png)', ctx({ 'a.png': { pending: true } }));
    expect(html).toContain('md-img-missing is-pending');
    expect(html).toContain('Loading image…');
  });

  it('without a context renders external images and treats relative ones as missing', () => {
    expect(render('![a](https://example.com/a.png)')).toContain('src="https://example.com/a.png"');
    expect(render('![a](a.png)')).toContain('Image not found: a.png');
  });

  it('never produces a javascript: image', () => {
    expect(render('![a](javascript:alert(1))', ctx())).not.toMatch(/<img[^>]*javascript:/i);
  });
});
