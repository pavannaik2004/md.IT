import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMermaid, type MermaidApi } from '../preview/mermaid';
import { DEFAULT_RENDERING } from '../settings';
import type { ImageWithBytes, ProjectSnapshot } from '../store';
import { buildExportHtml, lightTokens, type ExportDeps, type ExportInput } from './html';

const PNG = new Uint8Array([137, 80, 78, 71]);
const png = (id: string, name: string): ImageWithBytes => ({
  id, projectId: 'p', folderId: 'img', name, contentType: 'image/png', size: 4, sha256: '', createdAt: 0, updatedAt: 0, bytes: PNG.slice().buffer,
});
const snapshot: ProjectSnapshot = {
  project: { id: 'p', name: 'P', description: '', createdAt: 0, updatedAt: 0 },
  folders: [{ id: 'img', projectId: 'p', parentFolderId: null, name: 'images', createdAt: 0, updatedAt: 0 }],
  documents: [{ id: 'd', projectId: 'p', folderId: null, title: 'Intro.md', content: '', dirty: true, createdAt: 0, updatedAt: 0 }],
  images: [png('a', 'a.png'), png('b', 'unused.png')],
};

const BASE_CSS = ':root { --paper: #faf9f7; --ink: #1b1a18; }\n:root[data-theme="dark"] { --paper: #000; }\n.md-prose { color: var(--ink); }';

function deps(extra: Partial<ExportDeps> = {}): ExportDeps {
  return {
    baseCss: BASE_CSS,
    mathCss: '.katex { font: normal 1.21em KaTeX_Main; }',
    fontCss: '@font-face { font-family: X; src: url(/x.woff2) format("woff2"); unicode-range: U+0000-00FF; }',
    fetchBytes: async () => new Uint8Array([1]),
    ...extra,
  };
}

const input = (markdown: string, extra: Partial<ExportInput> = {}): ExportInput => ({
  markdown, title: 'Intro.md', folderId: null, snapshot, rendering: DEFAULT_RENDERING, mode: 'html', ...extra,
});

function fakeMermaid(svg = '<svg data-test="diagram"></svg>') {
  const api = { initialize: vi.fn(), render: vi.fn(async () => ({ svg })) };
  return { api, loadMermaid: async () => api as unknown as MermaidApi };
}

beforeEach(() => resetMermaid());

describe('buildExportHtml', () => {
  it('is a light, self-contained document titled after the file', async () => {
    const html = await buildExportHtml(input('# Hello'), deps());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en" data-theme="light">');
    expect(html).toContain('<title>Intro</title>');
    expect(html).toContain('<h1 data-line="0">Hello</h1>');
    expect(html).toContain('url("data:font/woff2;base64,AQ==")');
  });

  it('escapes the title', async () => {
    expect(await buildExportHtml(input('x', { title: '<b>&.md' }), deps())).toContain('<title>&lt;b&gt;&amp;</title>');
  });

  it('embeds only the stored images the document uses, as data URIs', async () => {
    const html = await buildExportHtml(input('![a](images/a.png)'), deps());
    expect(html).toContain('src="data:image/png;base64,iVBORw=="');
    expect(html.match(/data:image\/png/g)).toHaveLength(1);
    expect(html).not.toContain('blob:');
  });

  it('keeps external images as links and missing ones as placeholders', async () => {
    const html = await buildExportHtml(input('![x](https://example.com/x.png)\n\n![y](images/gone.png)'), deps());
    expect(html).toContain('src="https://example.com/x.png"');
    expect(html).toContain('Image not found: images/gone.png');
  });

  it('adds the KaTeX styles only when there is math', async () => {
    expect(await buildExportHtml(input('$x^2$'), deps())).toContain('KaTeX_Main');
    expect(await buildExportHtml(input('plain'), deps())).not.toContain('KaTeX_Main');
  });

  it('carries the rendering settings', async () => {
    const html = await buildExportHtml(input('x', { rendering: { ...DEFAULT_RENDERING, font: 'mono', lineHeight: 2 } }), deps());
    expect(html).toContain(
      '<article class="md-prose" style="--doc-font: var(--font-mono); --doc-letter-spacing: 0em; --doc-line-height: 2; --doc-margin: 0px; --doc-padding: 48px">',
    );
  });

  it('has a copy script in HTML mode, and neither copy buttons nor script in PDF mode', async () => {
    const md = '```js\nx\n```';
    const html = await buildExportHtml(input(md), deps());
    expect(html).toContain('class="md-code-copy"');
    expect(html).toContain('<script>');
    const pdf = await buildExportHtml(input(md, { mode: 'pdf' }), deps());
    expect(pdf).not.toContain('md-code-copy');
    expect(pdf).not.toContain('<script>');
  });

  it('removes the in-app link markers', async () => {
    const html = await buildExportHtml(input('[me](Intro.md) and [gone](Gone.md)'), deps());
    expect(html).toContain('href="Intro.md"');
    expect(html).not.toContain('data-doc-id');
    expect(html).not.toContain('data-missing');
  });

  it('renders diagrams to SVG and leaves nothing behind in the page', async () => {
    const { loadMermaid } = fakeMermaid();
    const html = await buildExportHtml(input('```mermaid\nflowchart TD\n  A-->B\n```'), deps({ loadMermaid }));
    expect(html).toContain('<svg data-test="diagram"></svg>');
    expect(document.querySelector('[data-export-host]')).toBeNull();
  });

  it('colours diagrams from the light tokens even in dark mode', async () => {
    document.documentElement.dataset.theme = 'dark';
    const { api, loadMermaid } = fakeMermaid('<svg></svg>');
    await buildExportHtml(input('```mermaid\nflowchart TD\n```'), deps({ loadMermaid }));
    expect(api.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ themeVariables: expect.objectContaining({ background: '#faf9f7', primaryTextColor: '#1b1a18' }) }),
    );
    delete document.documentElement.dataset.theme;
  });
});

describe('lightTokens', () => {
  it('reads the first :root block only', () => {
    const read = lightTokens(BASE_CSS);
    expect(read('--paper')).toBe('#faf9f7');
    expect(read('--missing')).toBe('');
  });
});
