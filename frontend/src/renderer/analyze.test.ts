import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';

describe('analyze', () => {
  it('lists headings with level, plain text and source line', () => {
    expect(analyze('# Intro\n\nText\n\n## Use `npm` *now*\n\n### \n').headings).toEqual([
      { level: 1, text: 'Intro', line: 0 },
      { level: 2, text: 'Use npm now', line: 4 },
      { level: 3, text: '', line: 6 },
    ]);
  });

  it('counts words in prose and inline code, not in code blocks, diagrams or math', () => {
    const source = [
      '# Two words',
      '',
      'Three more `words` here.',
      '',
      '```js',
      'skip me',
      '```',
      '',
      '```mermaid',
      'flowchart TD',
      '```',
      '',
      'x $a + b$ y',
      '',
      'It’s well-known.',
    ].join('\n');
    expect(analyze(source).stats.words).toBe(10);
  });

  it('counts headings, code blocks, diagrams, math, images and links', () => {
    const source = [
      '# A',
      '## B',
      '',
      '```js',
      'x',
      '```',
      '',
      '    indented',
      '',
      '```mermaid',
      'flowchart TD',
      '```',
      '',
      '$x$ and $y$',
      '',
      '$$',
      'z',
      '$$',
      '',
      '![one](a.png) ![two](https://example.com/b.png)',
      '',
      '[link](Other.md) and https://example.com',
    ].join('\n');
    expect(analyze(source).stats).toMatchObject({ headings: 2, codeBlocks: 2, diagrams: 1, math: 3, images: 2, links: 2 });
  });

  it('counts characters as code points of the source', () => {
    expect(analyze('héllo 👋').stats.characters).toBe(7);
  });

  it('estimates reading time at 225 words a minute', () => {
    expect(analyze('').stats.readingMinutes).toBe(0);
    expect(analyze('word '.repeat(225)).stats.readingMinutes).toBe(1);
    expect(analyze('word '.repeat(226)).stats.readingMinutes).toBe(2);
  });

  it('returns empty results for an empty document', () => {
    expect(analyze('')).toEqual({
      headings: [],
      stats: { words: 0, characters: 0, headings: 0, codeBlocks: 0, diagrams: 0, math: 0, images: 0, links: 0, readingMinutes: 0 },
    });
  });
});
