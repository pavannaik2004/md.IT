import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { render } from '../renderer';
import { SETTINGS, useProject, useSettingState } from '../store';
import { FileTree } from '../tree';
import { SaveStatus, SegmentedControl, Wordmark, type SegmentedOption } from '../ui';
import { DocumentArea } from './DocumentArea';
import { MissingPage } from './MissingPage';
import { Notice, type NoticeMessage } from './Notice';
import { ThemeMenu } from './ThemeMenu';
import { useDocumentDraft } from './useDocumentDraft';

export type ViewMode = 'split' | 'editor' | 'preview';

const VIEW_OPTIONS: ReadonlyArray<SegmentedOption<ViewMode>> = [
  { value: 'split', label: 'Split', icon: 'columns' },
  { value: 'editor', label: 'Editor', icon: 'pencil' },
  { value: 'preview', label: 'Preview', icon: 'eye' },
];

export function Workspace() {
  const { projectId = '', docId } = useParams();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const [mode, setMode] = useSettingState<ViewMode>(SETTINGS.mode, 'split');
  const draft = useDocumentDraft(docId);
  const { saveNow } = draft;
  const html = useMemo(() => render(draft.previewSource), [draft.previewSource]);

  // Ctrl/Cmd+S anywhere saves now and never opens the browser's "Save page" dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveNow]);

  const openDocument = useCallback((id: string) => navigate(`/p/${projectId}/d/${id}`), [navigate, projectId]);
  const closeDocument = useCallback(() => navigate(`/p/${projectId}`, { replace: true }), [navigate, projectId]);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const showNotice = useCallback((text: string) => setNotice({ id: Date.now() + Math.random(), text }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  if (project === undefined) return <div className="ws" aria-busy="true" />;
  if (project === null) {
    return <MissingPage title="This project isn’t in this browser" text="It may have been deleted, or it was created in another browser." />;
  }

  return (
    <div className="ws">
      <header className="app-toolbar ws-toolbar">
        <div className="ws-left">
          <Link to="/" className="home-link" aria-label="All projects">
            <Wordmark />
          </Link>
          <span className="ws-crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="ws-project" title={project.name}>
            {project.name}
          </span>
        </div>
        <SegmentedControl label="View" value={mode} onChange={setMode} options={VIEW_OPTIONS} />
        <div className="ws-right">
          {draft.status === 'ready' && (
            <SaveStatus state={draft.saveState} detail={draft.saveState === 'failed' ? 'your last changes are only in this tab' : undefined} />
          )}
          <ThemeMenu />
        </div>
      </header>
      <div className="ws-body">
        <aside className="ws-tree" aria-label="Project files">
          <FileTree projectId={projectId} activeDocId={docId} onOpen={openDocument} onActiveDeleted={closeDocument} />
        </aside>
        <main className={`ws-main mode-${mode}`}>
          <DocumentArea docId={docId} draft={draft} html={html} onOpenDocument={openDocument} onNotice={showNotice} />
          <Notice notice={notice} onDismiss={dismissNotice} />
        </main>
      </div>
    </div>
  );
}
