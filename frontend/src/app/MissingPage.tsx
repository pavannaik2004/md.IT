import { useNavigate } from 'react-router';
import { Button, EmptyState, Wordmark } from '../ui';
import { ThemeMenu } from './ThemeMenu';

export function MissingPage({ title, text }: { title: string; text: string }) {
  const navigate = useNavigate();
  return (
    <div className="page">
      <header className="app-toolbar">
        <Wordmark />
        <span className="app-toolbar-spacer" />
        <ThemeMenu />
      </header>
      <main className="page-center">
        <EmptyState icon="info" title={title} action={<Button variant="primary" onClick={() => navigate('/')}>Back to projects</Button>}>
          {text}
        </EmptyState>
      </main>
    </div>
  );
}
