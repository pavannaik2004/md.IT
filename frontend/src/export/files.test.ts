import { describe, expect, it } from 'vitest';
import { fileStem, safeFileName } from './files';

describe('file names', () => {
  it('replace characters that file systems reject', () => {
    expect(safeFileName('a/b:c*?.md')).toBe('a-b-c--.md');
    expect(safeFileName('tab\there')).toBe('tab-here');
  });

  it('are never empty or hidden, and never too long', () => {
    expect(safeFileName('   ')).toBe('untitled');
    expect(safeFileName('...')).toBe('untitled');
    expect(safeFileName('.env')).toBe('env');
    expect(safeFileName('x'.repeat(300))).toHaveLength(120);
  });

  it('drop the .md extension for a stem', () => {
    expect(fileStem('Intro.md')).toBe('Intro');
    expect(fileStem('Notes.MD')).toBe('Notes');
    expect(fileStem('plain')).toBe('plain');
  });
});
