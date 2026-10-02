import { describe, expect, it, vi } from 'vitest';
import { inlineCssUrls, parseUnicodeRange, pickFontFaces } from './assets';

describe('parseUnicodeRange', () => {
  it('reads single code points, ranges and wildcards', () => {
    expect(parseUnicodeRange('U+0000-00FF, U+0131,U+1F??')).toEqual([
      [0, 0xff],
      [0x131, 0x131],
      [0x1f00, 0x1fff],
    ]);
  });
});

describe('pickFontFaces', () => {
  const css = [
    '/* latin */',
    '@font-face { font-family: X; src: url(/a.woff2); unicode-range: U+0000-00FF; }',
    '/* cyrillic */',
    '@font-face { font-family: X; src: url(/b.woff2); unicode-range: U+0400-045F; }',
    '@font-face { font-family: K; src: url(/k.woff2); }',
    'p { color: red; }',
  ].join('\n');

  it('keeps faces whose range covers the text, and faces without a range', () => {
    const out = pickFontFaces(css, 'Hello');
    expect(out).toContain('/a.woff2');
    expect(out).not.toContain('/b.woff2');
    expect(out).toContain('/k.woff2');
    expect(out).toContain('p { color: red; }');
  });

  it('keeps a subset as soon as one character needs it', () => {
    expect(pickFontFaces(css, 'Hello Привет')).toContain('/b.woff2');
  });
});

describe('inlineCssUrls', () => {
  it('inlines every url as a data URI of the right type', async () => {
    const fetchBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const out = await inlineCssUrls("a { background: url('/i.png') } @font-face { src: url(/f.woff2) format('woff2') }", fetchBytes);
    expect(out).toContain('url("data:image/png;base64,AQID")');
    expect(out).toContain('url("data:font/woff2;base64,AQID")');
  });

  it('keeps only woff2 sources in a src list', async () => {
    const out = await inlineCssUrls(
      '@font-face{src:url(/k.woff2) format("woff2"),url(/k.woff) format("woff"),url(/k.ttf) format("truetype")}',
      async () => new Uint8Array([0]),
    );
    expect(out).toContain('font/woff2');
    expect(out).not.toContain('font/woff;');
    expect(out).not.toContain('truetype');
  });

  it('fetches each url once and leaves data URIs alone', async () => {
    const fetchBytes = vi.fn(async () => new Uint8Array([0]));
    await inlineCssUrls('a{background:url(/x.png)} b{background:url(/x.png)} c{background:url(data:image/png;base64,AA==)}', fetchBytes);
    expect(fetchBytes).toHaveBeenCalledTimes(1);
    expect(fetchBytes).toHaveBeenCalledWith('/x.png');
  });

  it('keeps the original url when a fetch fails', async () => {
    const out = await inlineCssUrls('a{background:url(/x.png)}', async () => {
      throw new Error('offline');
    });
    expect(out).toContain('url(/x.png)');
  });
});
