import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ConfirmDialog, TextFieldDialog } from '../dialogs';
import { exportProject } from '../export';
import { plural } from '../lib/text';
import { formatRelativeTime } from '../lib/time';
import {
  createProject, deleteProject, renameProject, setProjectDescription, useProjectSummaries, userMessage, type ProjectSummary,
} from '../store';
import { Badge, Button, Callout, EmptyState, Icon, IconButton, Input, MenuButton, Wordmark } from '../ui';
import { AccountMenu } from './AccountMenu';
import { CloudProjects } from './CloudProjects';
import { ImportDialog } from './ImportDialog';
import { createSampleProject, samplePath } from './sampleProject';
import { StorageWarning } from './StorageWarning';
import { ThemeMenu } from './ThemeMenu';

type ProjectDialog =
  | { kind: 'create' }
  | { kind: 'rename'; project: ProjectSummary }
  | { kind: 'describe'; project: ProjectSummary }
  | { kind: 'delete'; project: ProjectSummary }
  | { kind: 'import'; file: File }
  | null;

function deleteMessage(project: ProjectSummary): string {
  const contents = project.documentCount > 0 ? ` and its ${plural(project.documentCount, 'document')}` : '';
  return `Delete “${project.name}”${contents}? This can’t be undone.`;
}

/** Above this many projects the list gets a filter field. */
const FILTER_FROM = 7;

export function ProjectList() {
  const projects = useProjectSummaries();
  const navigate = useNavigate();
  const location = useLocation();
  // "Start writing" on the landing page arrives with { create: true } (P-100).
  const [dialog, setDialog] = useState<ProjectDialog>(() => ((location.state as { create?: boolean } | null)?.create ? { kind: 'create' } : null));
  useEffect(() => {
    // Forget the request so a reload doesn't open the dialog again.
    if ((location.state as { create?: boolean } | null)?.create) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  const close = () => setDialog(null);
  const open = (id: string) => navigate(`/p/${id}`);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [creatingSample, setCreatingSample] = useState(false);
  const exportZip = (project: ProjectSummary) =>
    void exportProject(project.id).catch((err: unknown) => setError(`Couldn’t export: ${userMessage(err)}`));
  const trySample = async () => {
    setCreatingSample(true);
    try {
      navigate(samplePath(await createSampleProject()));
    } catch (err) {
      setError(`Couldn’t create the sample project: ${userMessage(err)}`);
      setCreatingSample(false);
    }
  };
  const newProjectButton = (
    <Button variant="primary" icon="plus" onClick={() => setDialog({ kind: 'create' })}>
      New project
    </Button>
  );
  const query = filter.trim().toLocaleLowerCase();
  const shown = projects?.filter(
    (p) => query === '' || p.name.toLocaleLowerCase().includes(query) || p.description.toLocaleLowerCase().includes(query),
  );

  return (
    <div className="page">
      <header className="app-toolbar">
        <Link to="/" className="home-link" aria-label="md.IT home">
          <Wordmark />
        </Link>
        <span className="app-toolbar-spacer" />
        <AccountMenu />
        <ThemeMenu />
      </header>
      <main className="projects">
        <StorageWarning />
        <div className="projects-head">
          <div className="projects-title">
            <h1>Projects</h1>
            {projects && projects.length > 0 && <span className="projects-count">{plural(projects.length, 'project')} in this browser</span>}
          </div>
          <div className="projects-actions">
            <Button onClick={() => importInputRef.current?.click()}>Import project</Button>
            {projects && projects.length > 0 && newProjectButton}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            tabIndex={-1}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) setDialog({ kind: 'import', file });
            }}
          />
        </div>
        {error && (
          <Callout tone="danger" actions={<IconButton icon="x" label="Dismiss" onClick={() => setError(null)} />}>
            {error}
          </Callout>
        )}
        {projects?.length === 0 && (
          <div className="projects-empty">
            <EmptyState
              icon="folder"
              title="No projects yet"
              action={
                <div className="projects-empty-actions">
                  {newProjectButton}
                  <Button disabled={creatingSample} onClick={() => void trySample()}>
                    {creatingSample ? 'Creating the sample…' : 'Try a sample project'}
                  </Button>
                </div>
              }
            >
              Projects live in this browser. Create one to start writing, or open a short tour of what md.IT can do.
            </EmptyState>
          </div>
        )}
        {projects && projects.length >= FILTER_FROM && (
          <Input
            className="projects-filter"
            icon="search"
            type="search"
            aria-label="Filter projects"
            placeholder="Filter projects"
            value={filter}
            onChange={(event) => setFilter(event.currentTarget.value)}
          />
        )}
        {shown && projects && projects.length > 0 && shown.length === 0 && (
          <p className="projects-none">No project matches “{filter.trim()}”.</p>
        )}
        {shown && shown.length > 0 && (
          <ul className="project-list">
            {shown.map((project) => (
              <li key={project.id} className="project-row">
                <button type="button" className="project-open" onClick={() => open(project.id)}>
                  <span className="project-tile" aria-hidden="true">
                    <Icon name="folder" />
                  </span>
                  <span className="project-text">
                    <span className="project-name">{project.name}</span>
                    {project.description && <span className="project-desc">{project.description}</span>}
                    <span className="project-meta">
                      {plural(project.documentCount, 'document')} · Updated {formatRelativeTime(project.updatedAt)}
                    </span>
                  </span>
                  {project.cloudProjectId !== undefined && <Badge tone="accent">In the cloud</Badge>}
                </button>
                <MenuButton
                  label={`Actions for ${project.name}`}
                  items={[
                    { label: 'Open', icon: 'folder-open', onSelect: () => open(project.id) },
                    { label: 'Rename', icon: 'pencil', onSelect: () => setDialog({ kind: 'rename', project }) },
                    { label: 'Edit description', onSelect: () => setDialog({ kind: 'describe', project }) },
                    { label: 'Export .zip', icon: 'download', onSelect: () => exportZip(project) },
                    'separator',
                    { label: 'Delete', icon: 'trash', danger: true, onSelect: () => setDialog({ kind: 'delete', project }) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
        <CloudProjects onDownloaded={(projectId, notice) => navigate(`/p/${projectId}`, { state: { notice } })} />
      </main>

      {dialog?.kind === 'create' && (
        <TextFieldDialog
          title="New project"
          label="Name"
          submitLabel="Create project"
          onClose={close}
          onSubmit={async (name) => {
            const project = await createProject(name);
            open(project.id);
          }}
        />
      )}
      {dialog?.kind === 'rename' && (
        <TextFieldDialog
          title="Rename project"
          label="Name"
          submitLabel="Rename"
          initialValue={dialog.project.name}
          onClose={close}
          onSubmit={async (name) => {
            await renameProject(dialog.project.id, name);
          }}
        />
      )}
      {dialog?.kind === 'describe' && (
        <TextFieldDialog
          title="Edit description"
          label="Description"
          submitLabel="Save description"
          initialValue={dialog.project.description}
          onClose={close}
          onSubmit={async (text) => {
            await setProjectDescription(dialog.project.id, text);
          }}
        />
      )}
      {dialog?.kind === 'import' && (
        <ImportDialog
          file={dialog.file}
          onClose={close}
          onImported={(id, notice) => {
            close();
            navigate(`/p/${id}`, { state: { notice } });
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete project"
          message={deleteMessage(dialog.project)}
          confirmLabel="Delete project"
          onClose={close}
          onConfirm={() => deleteProject(dialog.project.id)}
        />
      )}
    </div>
  );
}
