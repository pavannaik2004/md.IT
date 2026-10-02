import { describe, expect, it } from 'vitest';
import { createPathIndex, encodeSegment, isExternalHref } from './paths';

// Root: OS/ (images/diagram.png, Intro.md), Assets/logo.svg, Threads.md, My notes.md, a (1).png
const folders = [
  { id: 'os', parentFolderId: null, name: 'OS' },
  { id: 'osimg', parentFolderId: 'os', name: 'images' },
  { id: 'assets', parentFolderId: null, name: 'Assets' },
];
const documents = [
  { id: 'intro', folderId: 'os', title: 'Intro.md' },
  { id: 'threads', folderId: null, title: 'Threads.md' },
  { id: 'notes', folderId: null, title: 'My notes.md' },
];
const images = [
  { id: 'diagram', folderId: 'osimg', name: 'diagram.png' },
  { id: 'logo', folderId: 'assets', name: 'logo.svg' },
  { id: 'paren', folderId: null, name: 'a (1).png' },
];
const index = createPathIndex(folders, documents, images);

describe('paths', () => {
  it('resolves from the document folder, with . and ..', () => {
    expect(index.resolve('os', 'images/diagram.png')).toEqual({ kind: 'image', id: 'diagram' });
    expect(index.resolve('os', './images/diagram.png')).toEqual({ kind: 'image', id: 'diagram' });
    expect(index.resolve('os', '../Assets/logo.svg')).toEqual({ kind: 'image', id: 'logo' });
    expect(index.resolve('os', '../Threads.md')).toEqual({ kind: 'document', id: 'threads' });
    expect(index.resolve(null, 'OS/Intro.md')).toEqual({ kind: 'document', id: 'intro' });
  });

  it('resolves a leading / from the project root', () => {
    expect(index.resolve('osimg', '/Threads.md')).toEqual({ kind: 'document', id: 'threads' });
  });

  it('matches case-insensitively and ignores ?query and #fragment', () => {
    expect(index.resolve('os', 'IMAGES/Diagram.PNG')).toEqual({ kind: 'image', id: 'diagram' });
    expect(index.resolve(null, 'Threads.md#intro')).toEqual({ kind: 'document', id: 'threads' });
  });

  it('percent-decodes segments', () => {
    expect(index.resolve(null, 'My%20notes.md')).toEqual({ kind: 'document', id: 'notes' });
    expect(index.resolve(null, 'a%20%281%29.png')).toEqual({ kind: 'image', id: 'paren' });
    expect(index.resolve(null, 'bad%E0%A4%A.png')).toEqual({ kind: 'missing' });
  });

  it('reports missing items, folders and paths above the root as missing', () => {
    expect(index.resolve('os', 'images/gone.png')).toEqual({ kind: 'missing' });
    expect(index.resolve(null, 'OS')).toEqual({ kind: 'missing' });
    expect(index.resolve(null, '../Threads.md')).toEqual({ kind: 'missing' });
    expect(index.resolve('os', 'Intro.md/x.png')).toEqual({ kind: 'missing' });
    expect(index.resolve(null, '')).toEqual({ kind: 'missing' });
  });

  it('treats schemes, protocol-relative and fragment-only hrefs as external', () => {
    for (const href of ['https://example.com/a.png', 'mailto:a@b.c', 'data:image/png;base64,AA', '//cdn.example/a.png', '#top']) {
      expect(isExternalHref(href)).toBe(true);
      expect(index.resolve(null, href)).toEqual({ kind: 'external' });
    }
  });

  it('builds relative hrefs that resolve back to the same item', () => {
    const cases: Array<[string | null, { kind: 'document' | 'image'; id: string }, string]> = [
      ['os', { kind: 'image', id: 'diagram' }, 'images/diagram.png'],
      ['os', { kind: 'image', id: 'logo' }, '../Assets/logo.svg'],
      ['osimg', { kind: 'document', id: 'threads' }, '../../Threads.md'],
      [null, { kind: 'image', id: 'paren' }, 'a%20%281%29.png'],
      [null, { kind: 'document', id: 'notes' }, 'My%20notes.md'],
    ];
    for (const [from, target, href] of cases) {
      expect(index.relativeHref(from, target)).toBe(href);
      expect(index.resolve(from, href)).toEqual(target);
    }
    expect(index.relativeHref(null, { kind: 'image', id: 'nope' })).toBeNull();
  });

  it('encodes # and ? so names like "C#" round-trip', () => {
    const odd = createPathIndex([{ id: 'cs', parentFolderId: null, name: 'C#' }], [], [{ id: 'fig', folderId: 'cs', name: 'fig #1?.png' }]);
    const href = odd.relativeHref(null, { kind: 'image', id: 'fig' });
    expect(href).toBe('C%23/fig%20%231%3F.png');
    expect(odd.resolve(null, href!)).toEqual({ kind: 'image', id: 'fig' });
  });

  it('encodes only what breaks a Markdown link destination', () => {
    expect(encodeSegment('a b(1)<x>%.png')).toBe('a%20b%281%29%3Cx%3E%25.png');
    expect(encodeSegment('äpfel.png')).toBe('äpfel.png');
  });
});
