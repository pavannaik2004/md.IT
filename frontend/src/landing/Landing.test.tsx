import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, getDocument, listProjectSummaries } from '../store';
import { Landing } from './Landing';

function ProjectsPage() {
  const { state } = useLocation();
  return <p>Project list{(state as { create?: boolean } | null)?.create ? ' (create)' : ''}</p>;
}

function Opened() {
  const { projectId, docId } = useParams();
  return <p data-project={projectId} data-doc={docId}>Opened</p>;
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/p/:projectId/d/:docId" element={<Opened />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await clearDatabase();
});

describe('Landing', () => {
  it('says what md.IT is', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1, name: 'md.IT' })).toBeInTheDocument();
    expect(screen.getByText('A calm place to write technical documents.')).toBeInTheDocument();
    for (const name of ['Your work stays in this browser', 'Code, math and diagrams render as you write', 'Save versions to the cloud when it matters', 'Take it anywhere']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
  });

  it('keeps the pictures of the app out of the accessibility tree and the tab order', () => {
    const { container } = renderLanding();
    const pictures = container.querySelectorAll('.landing-frame, .landing-vignette');
    expect(pictures.length).toBe(5);
    for (const picture of pictures) {
      expect(picture).toHaveAttribute('aria-hidden', 'true');
      expect(picture).toHaveAttribute('inert');
    }
  });

  it('Start writing opens the project list ready to create a project', async () => {
    renderLanding();
    await userEvent.click(screen.getAllByRole('button', { name: 'Start writing' })[0]!);
    expect(await screen.findByText('Project list (create)')).toBeInTheDocument();
  });

  it('Open workspace opens the project list', async () => {
    renderLanding();
    await userEvent.click(screen.getByRole('button', { name: 'Open workspace' }));
    expect(await screen.findByText('Project list')).toBeInTheDocument();
  });

  it('Try a sample project creates the tour and opens its first document', async () => {
    renderLanding();
    await userEvent.click(screen.getAllByRole('button', { name: 'Try a sample project' })[0]!);
    const opened = await screen.findByText('Opened');
    const [project] = await listProjectSummaries();
    expect(opened).toHaveAttribute('data-project', project!.id);
    expect((await getDocument(opened.getAttribute('data-doc')!))?.title).toBe('Start here.md');
  });
});
