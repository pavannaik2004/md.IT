import { describe, expect, it } from 'vitest';
import { listPhrase, plural } from './text';

describe('text', () => {
  it('pluralizes with numerals', () => {
    expect(plural(0, 'document')).toBe('0 documents');
    expect(plural(1, 'document')).toBe('1 document');
    expect(plural(3, 'folder')).toBe('3 folders');
  });

  it('joins phrases', () => {
    expect(listPhrase(['a'])).toBe('a');
    expect(listPhrase(['a', 'b'])).toBe('a and b');
    expect(listPhrase(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
