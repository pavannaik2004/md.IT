import { describe, expect, it } from 'vitest';
import { linkAction } from './links';

const link = (attrs: Record<string, string>) => {
  const a = document.createElement('a');
  for (const [name, value] of Object.entries(attrs)) a.setAttribute(name, value);
  return a;
};

describe('linkAction', () => {
  it('opens a resolved document', () => {
    expect(linkAction(link({ href: 'Threads.md', 'data-doc-id': 'd2' }))).toEqual({ kind: 'open', docId: 'd2' });
  });

  it('names a missing document', () => {
    expect(linkAction(link({ href: 'OS/My%20notes.md#top', 'data-missing': 'true' }))).toEqual({ kind: 'notice', message: '“My notes.md” isn’t in this project.' });
  });

  it('keeps external and fragment links as they are', () => {
    for (const href of ['https://example.com', 'mailto:a@b.c', '#intro', '//cdn.example/x']) {
      expect(linkAction(link({ href }))).toEqual({ kind: 'default' });
    }
  });

  it('stops other relative links from leaving the app', () => {
    for (const href of ['notes.txt', '/p/other', '../x']) {
      expect(linkAction(link({ href }))).toEqual({ kind: 'notice', message: 'Only links to documents in this project open here.' });
    }
  });
});
