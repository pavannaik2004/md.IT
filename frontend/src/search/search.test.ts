import { describe, expect, it } from 'vitest';
import type { Folder, ImageAsset, MdDocument } from '../store';
import { MAX_RESULTS, searchProject, type ContentResult } from './search';

const folder = (id: string, name: string, parentFolderId: string | null = null): Folder => ({
  id, projectId: 'p', parentFolderId, name, createdAt: 0, updatedAt: 0,
});
const doc = (id: string, title: string, content: string, folderId: string | null = null): MdDocument => ({
  id, projectId: 'p', folderId, title, content, dirty: true, createdAt: 0, updatedAt: 0,
});
const image = (id: string, name: string, folderId: string | null = null): ImageAsset => ({
  id, projectId: 'p', folderId, name, contentType: 'image/png', size: 1, sha256: '', createdAt: 0, updatedAt: 0,
});

const folders = [folder('g', 'Guides'), folder('i', 'images', 'g')];
const documents = [
  doc('setup', 'Setup.md', 'Run the setup script.\nThen restart.', 'g'),
  doc('notes', 'Notes.md', 'line one\nsetup again\nand setup twice: setup\nfourth setup\nfifth setup'),
];
const images = [image('shot', 'setup-shot.png', 'i')];
const source = { folders, documents, images };

describe('searchProject', () => {
  it('returns nothing for an empty or blank query', () => {
    expect(searchProject('', source)).toEqual([]);
    expect(searchProject('   ', source)).toEqual([]);
  });

  it('lists name matches first, by path, with their ranges', () => {
    const results = searchProject('SETUP', source);
    // localeCompare puts "Guides/images/…" before "Guides/Setup.md".
    expect(results.slice(0, 2)).toEqual([
      { kind: 'image', id: 'shot', name: 'setup-shot.png', path: 'Guides/images/setup-shot.png', ranges: [[0, 5]] },
      { kind: 'document', id: 'setup', name: 'Setup.md', path: 'Guides/Setup.md', ranges: [[0, 5]] },
    ]);
    expect(results.slice(2).every((r) => r.kind === 'content')).toBe(true);
  });

  it('lists content matches by count, at most three snippets each', () => {
    const content = searchProject('setup', source).filter((r): r is ContentResult => r.kind === 'content');
    expect(content.map((r) => [r.id, r.count])).toEqual([
      ['notes', 5],
      ['setup', 1],
    ]);
    const notes = content[0]!;
    expect(notes.snippets.map((s) => s.line)).toEqual([1, 2, 3]);
    expect(notes.snippets[1]).toEqual({ line: 2, from: 25, to: 30, text: 'and setup twice: setup', ranges: [[4, 9], [17, 22]] });
  });

  it('cuts long lines around the first match', () => {
    const line = `${'a'.repeat(50)}NEEDLE${'b'.repeat(100)}`;
    const [result] = searchProject('needle', { folders: [], documents: [doc('d', 'D.md', line)], images: [] }) as ContentResult[];
    expect(result!.snippets[0]!.text).toBe(`…${'a'.repeat(40)}NEEDLE${'b'.repeat(80)}…`);
    expect(result!.snippets[0]!.ranges).toEqual([[41, 47]]);
    expect(result!.snippets[0]!.from).toBe(50);
  });

  it('matches case-insensitively beyond ASCII', () => {
    const results = searchProject('ÜBER', { folders: [], documents: [doc('d', 'D.md', 'Alles über uns')], images: [] });
    expect(results).toHaveLength(1);
  });

  it('treats the query as plain text', () => {
    const text = 'Use C++ (beta) with $x$ and [a] or a.b';
    const docs = [doc('d', 'D.md', text)];
    for (const query of ['C++ (beta)', '$x$', '[a]', 'a.b']) {
      expect(searchProject(query, { folders: [], documents: docs, images: [] })).toHaveLength(1);
    }
    expect(searchProject('a*b', { folders: [], documents: docs, images: [] })).toEqual([]);
  });

  it('stops at the result limit', () => {
    const many = Array.from({ length: 150 }, (_, n) => doc(`d${n}`, `Doc ${n}.md`, 'word'));
    expect(searchProject('word', { folders: [], documents: many, images: [] })).toHaveLength(MAX_RESULTS);
  });
});
