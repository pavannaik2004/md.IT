import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { EditorHandle } from '../editor';
import { render } from '../renderer';
import { IMAGE_ACCEPT, SETTINGS, useProject, useSettingState, type ImageAsset } from '../store';
import { FileTree } from '../tree';
import { IconButton, SaveStatus, SegmentedControl, Wordmark, type SegmentedOption } from '../ui';
import { DocumentArea } from './DocumentArea';
import { addImagesNextTo, imageMarkdown } from './imageInsert';
import { MissingPage } from './MissingPage';
import { Notice, type NoticeMessage } from './Notice';
import { useResolvedTheme } from './theme';
import { ThemeMenu } from './ThemeMenu';
import { useDocumentDraft } from './useDocumentDraft';
import { useProjectFiles } from './useProjectFiles';

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
  const theme = useResolvedTheme();
  const { saveNow } = draft;
  const files = useProjectFiles(projectId, docId);
  const { index, docFolderId, imageUrls } = files;
  const html = useMemo(() => render(draft.previewSource, files.context), [draft.previewSource, files.context]);
  const editorRef = useRef<EditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docReady = draft.status === 'ready';

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

  const insertFiles = useCallback(
    async (list: File[], at: number | null) => {
      if (list.length === 0) return;
      const { markdown, errors } = await addImagesNextTo(projectId, docFolderId, list);
      if (markdown) editorRef.current?.insertBlock(markdown, at);
      if (errors.length > 0) showNotice(errors.join(' '));
    },
    [projectId, docFolderId, showNotice],
  );

  const insertImage = useCallback(
    (image: ImageAsset) => {
      const href = index.relativeHref(docFolderId, { kind: 'image', id: image.id });
      if (href) editorRef.current?.insertBlock(imageMarkdown(image.name, href));
    },
    [index, docFolderId],
  );

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
          <IconButton icon="image" label="Insert image" disabled={!docReady} onClick={() => fileInputRef.current?.click()} />
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            tabIndex={-1}
            onChange={(event) => {
              const list = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              void insertFiles(list, null);
            }}
          />
          {draft.status === 'ready' && (
            <SaveStatus state={draft.saveState} detail={draft.saveState === 'failed' ? 'your last changes are only in this tab' : undefined} />
          )}
          <ThemeMenu />
        </div>
      </header>
      <div className="ws-body">
        <aside className="ws-tree" aria-label="Project files">
          <FileTree
            projectId={projectId}
            activeDocId={docId}
            onOpen={openDocument}
            onActiveDeleted={closeDocument}
            onInsertImage={docReady ? insertImage : undefined}
            imageUrls={imageUrls}
          />
        </aside>
        <main className={`ws-main mode-${mode}`}>
          <DocumentArea
            docId={docId}
            draft={draft}
            html={html}
            theme={theme}
            editorRef={editorRef}
            onImageFiles={(list, at) => void insertFiles(list, at)}
            onOpenDocument={openDocument}
            onNotice={showNotice}
          />
          <Notice notice={notice} onDismiss={dismissNotice} />
        </main>
      </div>
    </div>
  );
}
