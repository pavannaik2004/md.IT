import { Link, useNavigate } from 'react-router';
import { Button, EmptyState, Wordmark } from '../ui';
import { ThemeMenu } from './ThemeMenu';

export function MissingPage({ title, text }: { title: string; text: string }) {
  const navigate = useNavigate();
  return (
    <div className="page">
      <header className="app-toolbar">
        <Link to="/" className="home-link" aria-label="md.IT home">
          <Wordmark />
        </Link>
        <span className="app-toolbar-spacer" />
        <ThemeMenu />
      </header>
      <main className="page-center">
        <EmptyState icon="info" title={title} action={<Button variant="primary" onClick={() => navigate('/projects')}>Back to projects</Button>}>
          {text}
        </EmptyState>
      </main>
    </div>
  );
}
