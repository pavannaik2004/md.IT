import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApi, setApi } from '../api';
import { AuthProvider } from '../auth';
import { clearDatabase, createProject, setSetting, SETTINGS } from '../store';
import { createFakeApi } from '../test/fakeApi';
import { Home } from './Home';

const TAGLINE = 'A calm place to write technical documents.';

function ProjectsPage() {
  const { search } = useLocation();
  return <p>Project list{search}</p>;
}

function renderHome(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<ProjectsPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await clearDatabase();
});

describe('Home', () => {
  it('shows the landing page to a new visitor', async () => {
    renderHome();
    expect(await screen.findByText(TAGLINE)).toBeInTheDocument();
    expect(screen.queryByText(/Project list/)).not.toBeInTheDocument();
  });

  it('opens the project list when this browser has projects', async () => {
    await createProject('OS');
    renderHome();
    expect(await screen.findByText('Project list')).toBeInTheDocument();
    expect(screen.queryByText(TAGLINE)).not.toBeInTheDocument();
  });

  it('opens the project list once the landing page has been left for the app', async () => {
    await setSetting(SETTINGS.welcomed, true);
    renderHome();
    expect(await screen.findByText('Project list')).toBeInTheDocument();
  });

  it('opens the project list for a signed-in user, where their account’s projects are', async () => {
    const fake = createFakeApi();
    fake.signIn();
    setApi(createApi(fake.fetch));
    renderHome();
    expect(await screen.findByText('Project list')).toBeInTheDocument();
  });

  it('keeps the query string on the way, so a sign-in error is still shown', async () => {
    await createProject('OS');
    renderHome('/?login_error=state');
    expect(await screen.findByText('Project list?login_error=state')).toBeInTheDocument();
  });

  it('shows neither page while it is still finding out', () => {
    renderHome();
    expect(screen.queryByText(TAGLINE)).not.toBeInTheDocument();
    expect(screen.queryByText(/Project list/)).not.toBeInTheDocument();
  });
});
