import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addImage, clearDatabase, createDocument, createFolder, createProject, saveDocumentContent } from '../store';
import { SearchResults } from './SearchResults';

beforeEach(clearDatabase);

async function project() {
  const p = await createProject('P');
  const guides = await createFolder(p.id, null, 'Guides');
  const doc = await createDocument(p.id, guides.id, 'Setup');
  await saveDocumentContent(doc.id, 'first\nrun setup now');
  const pic = await addImage(p.id, guides.id, { name: 'setup.png', type: 'image/png', bytes: new Uint8Array([1]).buffer });
  return { p, guides, doc, pic };
}

describe('SearchResults', () => {
  it('shows name and content matches with marked text', async () => {
    const { p } = await project();
    render(<SearchResults projectId={p.id} query="setup" onOpenDocument={vi.fn()} onReveal={vi.fn()} />);
    expect(await screen.findByText('3 results')).toBeInTheDocument();
    const snippet = screen.getByRole('button', { name: /Line 2/ });
    expect(within(snippet).getByText('setup').tagName).toBe('MARK');
    expect(screen.getByRole('button', { name: /setup\.png/ })).toBeInTheDocument();
  });

  it('opens a document at the match, and reveals other items', async () => {
    const user = userEvent.setup();
    const { p, doc, pic } = await project();
    const onOpenDocument = vi.fn();
    const onReveal = vi.fn();
    render(<SearchResults projectId={p.id} query="setup" onOpenDocument={onOpenDocument} onReveal={onReveal} />);
    await user.click(await screen.findByRole('button', { name: /Line 2/ }));
    expect(onOpenDocument).toHaveBeenLastCalledWith(doc.id, { from: 10, to: 15 });
    // The name result and the content result's header both start with "Setup.md"; both open the document.
    await user.click(screen.getAllByRole('button', { name: /^Setup\.md/ })[0]!);
    expect(onOpenDocument).toHaveBeenLastCalledWith(doc.id);
    await user.click(screen.getByRole('button', { name: /setup\.png/ }));
    expect(onReveal).toHaveBeenCalledWith(pic.id);
  });

  it('says when nothing matches', async () => {
    const { p } = await project();
    render(<SearchResults projectId={p.id} query="zzz" onOpenDocument={vi.fn()} onReveal={vi.fn()} />);
    expect(await screen.findByText('No matches for “zzz”')).toBeInTheDocument();
  });
});
