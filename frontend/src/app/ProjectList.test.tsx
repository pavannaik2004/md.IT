import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, createDocument, createProject, getSetting, listProjectSummaries, SETTINGS } from '../store';
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
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(clearDatabase);

describe('ProjectList', () => {
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

  it('shows the storage warning until dismissed', async () => {
    const user = userEvent.setup();
    renderList();
    expect(await screen.findByText(/Clearing browser data deletes it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await waitFor(() => expect(screen.queryByText(/Clearing browser data/)).not.toBeInTheDocument());
    expect(await getSetting(SETTINGS.storageWarningDismissed, false)).toBe(true);
  });
});
