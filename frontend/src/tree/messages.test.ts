import { describe, expect, it } from 'vitest';
import { deleteMessage } from './messages';

describe('deleteMessage', () => {
  it('names a single document', () => {
    expect(deleteMessage({ kind: 'file', name: 'A.md' })).toBe('Delete “A.md”? This can’t be undone.');
  });

  it('names an empty folder', () => {
    expect(deleteMessage({ kind: 'folder', name: 'OS' }, { folders: 0, documents: 0 })).toBe('Delete “OS”? This can’t be undone.');
  });

  it('lists what goes with a folder', () => {
    expect(deleteMessage({ kind: 'folder', name: 'OS' }, { folders: 1, documents: 2 })).toBe(
      'Delete “OS” and the 2 documents and 1 folder inside it? This can’t be undone.',
    );
    expect(deleteMessage({ kind: 'folder', name: 'OS' }, { folders: 0, documents: 1 })).toBe(
      'Delete “OS” and the 1 document inside it? This can’t be undone.',
    );
  });
});
