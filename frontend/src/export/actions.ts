import { clampRendering, type RenderingSettings } from '../settings';
import { getSetting, readProjectSnapshot, SETTINGS, ValidationError } from '../store';
import { bytesBlob, download } from './download';
import { exportDeps } from './exportDeps';
import { fileStem, safeFileName } from './files';
import { buildExportHtml, type ExportDeps } from './html';
import { printHtml } from './print';
import { exportProjectZip } from './zip';

export type DocumentExportKind = 'markdown' | 'html' | 'pdf';

export interface ExportEnv {
  save: (fileName: string, blob: Blob) => void;
  print: (html: string, title: string) => Promise<void>;
  deps: ExportDeps;
}

const defaultEnv: ExportEnv = { save: download, print: printHtml, deps: exportDeps };

export interface DocumentExportArgs {
  projectId: string;
  docId: string;
  /** The editor's current text: includes keystrokes not yet saved or previewed. */
  text: string;
  rendering: RenderingSettings;
}

export async function exportDocument(kind: DocumentExportKind, args: DocumentExportArgs, env: ExportEnv = defaultEnv): Promise<void> {
  const snapshot = await readProjectSnapshot(args.projectId);
  const doc = snapshot?.documents.find((d) => d.id === args.docId);
  if (!snapshot || !doc) throw new ValidationError('This document no longer exists.');
  const stem = safeFileName(fileStem(doc.title));
  if (kind === 'markdown') {
    env.save(`${stem}.md`, new Blob([args.text], { type: 'text/markdown;charset=utf-8' }));
    return;
  }
  const html = await buildExportHtml(
    { markdown: args.text, title: doc.title, folderId: doc.folderId, snapshot, rendering: args.rendering, mode: kind },
    env.deps,
  );
  if (kind === 'html') env.save(`${stem}.html`, new Blob([html], { type: 'text/html;charset=utf-8' }));
  else await env.print(html, stem);
}

/** The open document's editor text, which may be newer than what autosave has written. */
export interface OpenDocumentText {
  docId: string;
  text: string;
}

export async function exportProject(projectId: string, env: Pick<ExportEnv, 'save'> = defaultEnv, open?: OpenDocumentText): Promise<void> {
  const stored = await readProjectSnapshot(projectId);
  if (!stored) throw new ValidationError('This project isn’t in this browser.');
  const snapshot = open
    ? { ...stored, documents: stored.documents.map((d) => (d.id === open.docId ? { ...d, content: open.text } : d)) }
    : stored;
  const rendering = clampRendering(await getSetting<unknown>(SETTINGS.rendering, null));
  env.save(`${safeFileName(snapshot.project.name)}.zip`, bytesBlob(await exportProjectZip(snapshot, rendering), 'application/zip'));
}
