import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { DEFAULT_RENDERING } from '../settings';
import { MAX_IMAGE_BYTES } from '../store';
import { IMPORT_ERRORS, MAX_ENTRIES, parseProjectZip } from './importZip';

const zip = (files: Record<string, string | Uint8Array>) =>
  zipSync(Object.fromEntries(Object.entries(files).map(([name, value]) => [name, typeof value === 'string' ? strToU8(value) : value])));

const manifest = (extra: object = {}) =>
  JSON.stringify({ format: 'mdit-project', version: 1, name: 'Notes', description: 'About', exportedAt: '', rendering: { ...DEFAULT_RENDERING, padding: 24 }, ...extra });

describe('parseProjectZip', () => {
  it('reads an md.IT export', async () => {
    const parsed = await parseProjectZip(
      zip({
        'Notes/mdit.json': manifest(),
        'Notes/Intro.md': '# Hi',
        'Notes/Guides/': '',
        'Notes/Guides/Setup.md': 'x',
        'Notes/Guides/images/a.png': new Uint8Array([1, 2, 3]),
        'Notes/Empty/': '',
      }),
      'whatever.zip',
    );
    expect(parsed.name).toBe('Notes');
    expect(parsed.description).toBe('About');
    expect(parsed.rendering).toEqual({ ...DEFAULT_RENDERING, padding: 24 });
    expect(parsed.folders).toEqual([['Guides'], ['Empty'], ['Guides', 'images']]);
    expect(parsed.documents).toEqual([
      { folder: [], title: 'Intro.md', content: '# Hi' },
      { folder: ['Guides'], title: 'Setup.md', content: 'x' },
    ]);
    expect(parsed.images.map((i) => [i.folder, i.name, i.contentType, Array.from(new Uint8Array(i.bytes))])).toEqual([
      [['Guides', 'images'], 'a.png', 'image/png', [1, 2, 3]],
    ]);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.renamed).toEqual([]);
  });

  it('imports a zip made by another tool', async () => {
    const parsed = await parseProjectZip(
      zip({
        'Export\\Docs\\Read me.markdown': '﻿# Hello',
        'Export/__MACOSX/._Read me.markdown': 'junk',
        'Export/.DS_Store': 'junk',
        'Export/../evil.md': 'x',
        'Export/notes.txt': 'x',
        'Export/pic.JPG': new Uint8Array([1]),
      }),
      'My export.zip',
    );
    expect(parsed.name).toBe('My export');
    expect(parsed.rendering).toBeNull();
    expect(parsed.folders).toEqual([['Docs']]);
    expect(parsed.documents).toEqual([{ folder: ['Docs'], title: 'Read me.md', content: '# Hello' }]);
    expect(parsed.images.map((i) => [i.folder, i.name, i.contentType])).toEqual([[[], 'pic.JPG', 'image/jpeg']]);
    expect(parsed.skipped).toEqual([
      { path: 'Export/../evil.md', reason: 'Unsafe path' },
      { path: 'Export/notes.txt', reason: 'Not a Markdown document or image' },
    ]);
  });

  it('renames names that clash ignoring case', async () => {
    const parsed = await parseProjectZip(
      zip({ 'Notes.md': 'a', 'notes.md': 'b', 'Pics/a.png': new Uint8Array([1]), 'pics/b.png': new Uint8Array([2]) }),
      'x.zip',
    );
    expect(parsed.documents.map((d) => d.title)).toEqual(['Notes.md', 'notes 2.md']);
    expect(parsed.folders).toEqual([['Pics'], ['pics 2']]);
    expect(parsed.images.map((i) => i.folder)).toEqual([['Pics'], ['pics 2']]);
    expect(parsed.renamed).toEqual([
      { from: 'pics', to: 'pics 2' },
      { from: 'notes.md', to: 'notes 2.md' },
    ]);
  });

  it('skips images over 5 MB', async () => {
    const parsed = await parseProjectZip(zip({ 'big.png': new Uint8Array(MAX_IMAGE_BYTES + 1), 'a.md': 'x' }), 'x.zip');
    expect(parsed.images).toEqual([]);
    expect(parsed.skipped).toEqual([{ path: 'big.png', reason: 'Larger than 5 MB' }]);
  });

  it('ignores a manifest that isn’t md.IT’s, and cleans a bad rendering block', async () => {
    const foreign = await parseProjectZip(zip({ 'mdit.json': '{"format":"other","name":"X"}', 'a.md': 'x' }), 'Mine.zip');
    expect(foreign.name).toBe('Mine');
    expect(foreign.rendering).toBeNull();
    const bad = await parseProjectZip(zip({ 'mdit.json': manifest({ rendering: { padding: 999, font: 'comic' } }), 'a.md': 'x' }), 'x.zip');
    expect(bad.rendering).toEqual({ ...DEFAULT_RENDERING, padding: 96 });
  });

  it('rejects files that aren’t zips', async () => {
    await expect(parseProjectZip(strToU8('hello'), 'x.zip')).rejects.toThrow(IMPORT_ERRORS.notZip);
  });

  it('rejects zips with too many entries', async () => {
    const files = Object.fromEntries(Array.from({ length: MAX_ENTRIES + 1 }, (_, n) => [`d${n}.md`, 'x']));
    await expect(parseProjectZip(zip(files), 'x.zip')).rejects.toThrow(IMPORT_ERRORS.tooLarge);
  });

  it('keeps names that start with a dot, ignoring only system clutter', async () => {
    const parsed = await parseProjectZip(
      zip({ '.todo.md': 'a', '.archive/old.md': 'b', '.DS_Store': 'x', '._.todo.md': 'x', 'Thumbs.db': 'x', '.git/config': 'x' }),
      'x.zip',
    );
    expect(parsed.folders).toEqual([['.archive']]);
    expect(parsed.documents.map((d) => [d.folder, d.title])).toEqual([
      [[], '.todo.md'],
      [['.archive'], 'old.md'],
    ]);
    expect(parsed.skipped).toEqual([]);
  });

  it('stores Windows line endings as \\n', async () => {
    const parsed = await parseProjectZip(zip({ 'a.md': '# A\r\nb\rc\r\n' }), 'x.zip');
    expect(parsed.documents[0]!.content).toBe('# A\nb\nc\n');
  });

  it('uses trimmed names, so a name with stray spaces clashes and is renamed instead of failing the import', async () => {
    const parsed = await parseProjectZip(zip({ 'Docs /a.md': 'x', 'Docs/b.md': 'y' }), 'x.zip');
    expect(parsed.folders).toEqual([['Docs'], ['Docs 2']]);
    expect(parsed.documents.map((d) => d.folder)).toEqual([['Docs'], ['Docs 2']]);
    expect(parsed.renamed).toEqual([{ from: 'Docs', to: 'Docs 2' }]);
  });

  it('rejects zips with nothing to import', async () => {
    await expect(parseProjectZip(zip({ 'a.txt': 'x', 'Empty/': '' }), 'x.zip')).rejects.toThrow(IMPORT_ERRORS.empty);
  });
});
