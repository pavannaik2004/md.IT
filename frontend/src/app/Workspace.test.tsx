import { createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createDocument, createProject, getSetting, saveDocumentContent, SETTINGS } from '../store';
import { Workspace } from './Workspace';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Project list</p>} />
        <Route path="/p/:projectId" element={<Workspace />} />
        <Route path="/p/:projectId/d/:docId" element={<Workspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function projectWithDocument(content = '# Hello\n\nWorld') {
  const project = await createProject('OS');
  const doc = await createDocument(project.id, null, 'Intro');
  await saveDocumentContent(doc.id, content);
  return { project, doc };
}

beforeEach(clearDatabase);

describe('Workspace', () => {
  it('says so when the project is not in this browser', async () => {
    renderAt('/p/nope');
    expect(await screen.findByText('This project isn’t in this browser')).toBeInTheDocument();
  });

  it('shows the project name and an empty main area with no document open', async () => {
    const project = await createProject('OS');
    renderAt(`/p/${project.id}`);
    expect(await screen.findByText('OS')).toBeInTheDocument();
    expect(await screen.findByText('No document open')).toBeInTheDocument();
  });

  it('renders the open document in the preview and says it is saved locally', async () => {
    const { project, doc } = await projectWithDocument();
    renderAt(`/p/${project.id}/d/${doc.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Saved locally');
    expect(await screen.findByRole('treeitem', { name: 'Intro.md' })).toHaveAttribute('aria-selected', 'true');
  });

  it('says so when the document is missing', async () => {
    const project = await createProject('OS');
    renderAt(`/p/${project.id}/d/nope`);
    expect(await screen.findByText('This document isn’t in this project')).toBeInTheDocument();
  });

  it('opens a document from the tree', async () => {
    const user = userEvent.setup();
    const { project } = await projectWithDocument('# From tree');
    renderAt(`/p/${project.id}`);
    await user.click(await screen.findByRole('treeitem', { name: 'Intro.md' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'From tree' })).toBeInTheDocument();
  });

  it('switches to preview-only and remembers it', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument();
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await user.click(await screen.findByRole('radio', { name: 'Preview' }));
    await waitFor(() => expect(container.querySelector('.ws-main')).toHaveClass('mode-preview'));
    expect(await getSetting(SETTINGS.mode, 'split')).toBe('preview');
  });

  it('returns to the project when the open document is deleted', async () => {
    const user = userEvent.setup();
    const { project, doc } = await projectWithDocument();
    renderAt(`/p/${project.id}/d/${doc.id}`);
    await user.click(await screen.findByRole('button', { name: 'Actions for Intro.md' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete document' }));
    expect(await screen.findByText('No document open')).toBeInTheDocument();
  });

  it('keeps Ctrl+S from reaching the browser anywhere on the page', async () => {
    const { project, doc } = await projectWithDocument();
    renderAt(`/p/${project.id}/d/${doc.id}`);
    await screen.findByRole('heading', { level: 1, name: 'Hello' });
    const event = createEvent.keyDown(window, { key: 's', ctrlKey: true });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('never renders unsafe HTML from a document', async () => {
    const { project, doc } = await projectWithDocument('<img src="x" onerror="window.__pwned = true">');
    const { container } = renderAt(`/p/${project.id}/d/${doc.id}`);
    await waitFor(() => expect(container.querySelector('.md-prose img')).not.toBeNull());
    expect(container.querySelector('.md-prose img')?.getAttribute('onerror')).toBeNull();
  });
});
