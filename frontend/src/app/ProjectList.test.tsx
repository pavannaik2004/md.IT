import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { strToU8, zipSync } from 'fflate';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, createDocument, createProject, getSetting, linkProject, listProjectSummaries, SETTINGS } from '../store';
import { ProjectList } from './ProjectList';

function Opened() {
  const { projectId } = useParams();
  return <p>Opened {projectId}</p>;
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/p/:projectId" element={<Opened />} />
        <Route path="/p/:projectId/d/:docId" element={<Opened />} />
      </Routes>
    </MemoryRouter>,
  );
}

const saved = vi.hoisted(() => [] as Array<{ name: string; blob: Blob }>);
vi.mock('../export/download', () => ({
  download: (name: string, blob: Blob) => saved.push({ name, blob }),
  bytesBlob: (bytes: Uint8Array, type: string) => new Blob([new Uint8Array(bytes)], { type }),
}));

beforeEach(async () => {
  saved.length = 0;
  await clearDatabase();
});

describe('ProjectList', () => {
  it('imports a project zip and opens it', async () => {
    const user = userEvent.setup();
    const { container } = renderList();
    await screen.findByText('No projects yet');
    const data = zipSync({ 'Notes/a.md': strToU8('# A') });
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [new File([new Uint8Array(data)], 'Notes.zip', { type: 'application/zip' })] },
    });
    await user.click(await screen.findByRole('button', { name: 'Import' }));
    expect(await screen.findByText(/^Opened /)).toBeInTheDocument();
    expect((await listProjectSummaries()).map((p) => p.name)).toEqual(['Notes']);
  });

  it('exports a project as a zip from its menu', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null, 'Intro');
    renderList();
    await user.click(await screen.findByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export .zip' }));
    await waitFor(() => expect(saved.map((s) => s.name)).toEqual(['OS.zip']));
  });

  it('creates a project from the empty state and opens it', async () => {
    const user = userEvent.setup();
    renderList();
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Name'), 'Operating Systems Notes');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText(/^Opened /)).toBeInTheDocument();
    expect((await listProjectSummaries())[0]?.name).toBe('Operating Systems Notes');
  });

  it('keeps the dialog open with a message when the name is empty', async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name can’t be empty.');
  });

  it('lists projects with document counts and renames one', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null);
    renderList();
    expect(await screen.findByText(/1 document · Updated/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'Operating systems{Enter}');
    expect(await screen.findByText('Operating systems')).toBeInTheDocument();
  });

  it('edits the description', async () => {
    const user = userEvent.setup();
    await createProject('OS');
    renderList();
    await user.click(await screen.findByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit description' }));
    await user.type(screen.getByLabelText('Description'), 'Lecture notes{Enter}');
    expect(await screen.findByText('Lecture notes')).toBeInTheDocument();
  });

  it('asks before deleting and says how many documents go with it', async () => {
    const user = userEvent.setup();
    const project = await createProject('OS');
    await createDocument(project.id, null);
    await createDocument(project.id, null);
    renderList();
    await user.click(await screen.findByRole('button', { name: 'Actions for OS' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Delete “OS” and its 2 documents? This can’t be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('offers the sample project when there are none, and opens it at its first document', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('No projects yet');
    await user.click(screen.getByRole('button', { name: 'Try a sample project' }));
    expect(await screen.findByText(/^Opened /)).toBeInTheDocument();
    expect((await listProjectSummaries()).map((p) => p.name)).toEqual(['Welcome to md.IT']);
  });

  it('opens the New project dialog when asked to by the landing page', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { create: true } }]}>
        <Routes>
          <Route path="/" element={<ProjectList />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('dialog', { name: 'New project' })).toBeInTheDocument();
  });

  it('marks projects that are linked to the cloud', async () => {
    const project = await createProject('OS');
    await createProject('Thesis');
    await linkProject(project.id, 'p-cloud');
    renderList();
    await waitFor(() => expect(screen.getByText('OS').closest('li')).toHaveTextContent('In the cloud'));
    expect(screen.getByText('Thesis').closest('li')).not.toHaveTextContent('In the cloud');
    expect(screen.getByText('2 projects in this browser')).toBeInTheDocument();
  });

  it('filters a long list by name or description', async () => {
    const user = userEvent.setup();
    for (const name of ['OS', 'Networks', 'Compilers', 'Databases', 'Graphics', 'Security']) await createProject(name);
    renderList();
    await screen.findByText('Security');
    expect(screen.queryByRole('searchbox', { name: 'Filter projects' })).not.toBeInTheDocument();
    await createProject('Thesis');
    const filter = await screen.findByRole('searchbox', { name: 'Filter projects' });
    await user.type(filter, 'net');
    expect(screen.getByText('Networks')).toBeInTheDocument();
    expect(screen.queryByText('OS')).not.toBeInTheDocument();
    await user.clear(filter);
    await user.type(filter, 'zzz');
    expect(screen.getByText('No project matches “zzz”.')).toBeInTheDocument();
  });

  it('shows the storage warning until dismissed', async () => {
    const user = userEvent.setup();
    renderList();
    expect(await screen.findByText(/Clearing browser data deletes it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByText(/Clearing browser data/)).not.toBeInTheDocument());
    expect(await getSetting(SETTINGS.storageWarningDismissed, false)).toBe(true);
  });
});
