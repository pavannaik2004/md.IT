import { describe, expect, it } from 'vitest';
import { ValidationError } from './errors';
import { nameKey, nextAvailableName, normalizeName, stripMdExtension, withMdExtension } from './names';

describe('names', () => {
  it('trims names', () => {
    expect(normalizeName('  Notes  ')).toBe('Notes');
  });

  it.each(['', '   ', 'a/b', 'a\\b', '.', '..', 'x'.repeat(201)])('rejects %j', (raw) => {
    expect(() => normalizeName(raw)).toThrow(ValidationError);
  });

  it('explains an empty name in plain words', () => {
    expect(() => normalizeName(' ')).toThrow('Name can’t be empty.');
  });

  it('adds .md once, case-insensitively', () => {
    expect(withMdExtension('Threads')).toBe('Threads.md');
    expect(withMdExtension('Threads.md')).toBe('Threads.md');
    expect(withMdExtension('README.MD')).toBe('README.MD');
    expect(stripMdExtension('Threads.md')).toBe('Threads');
    expect(stripMdExtension('Threads')).toBe('Threads');
  });

  it('compares names case-insensitively', () => {
    expect(nameKey('Notes.MD')).toBe(nameKey('notes.md'));
  });

  it('picks the first free numbered name', () => {
    expect(nextAvailableName('Untitled', '.md', [])).toBe('Untitled.md');
    expect(nextAvailableName('Untitled', '.md', ['untitled.md'])).toBe('Untitled 2.md');
    expect(nextAvailableName('Untitled', '.md', ['Untitled.md', 'Untitled 2.md'])).toBe('Untitled 3.md');
    expect(nextAvailableName('New folder', '', ['New folder'])).toBe('New folder 2');
  });
});
