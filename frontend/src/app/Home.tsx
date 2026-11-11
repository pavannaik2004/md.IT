import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../auth';
import { Landing } from '../landing';
import { SETTINGS, useProjectSummaries, useSetting } from '../store';

/**
 * `/` (P-100): the landing page for a new visitor — no projects in this browser, not signed in, and the landing page
 * never left for the app — otherwise the project list. The query string goes along so `?login_error=` still shows.
 */
export function Home() {
  const projects = useProjectSummaries();
  const welcomed = useSetting(SETTINGS.welcomed, false);
  const auth = useAuth();
  const { search } = useLocation();

  if (projects === undefined || welcomed === undefined || auth.state === 'loading') return <div className="page" aria-busy="true" />;
  const isNew = projects.length === 0 && !welcomed && auth.state !== 'signed-in';
  return isNew ? <Landing /> : <Navigate to={{ pathname: '/projects', search }} replace />;
}
