import { Editor } from '../editor';
import { EmptyState, Prose } from '../ui';
import type { DocumentDraft } from './useDocumentDraft';

export function DocumentArea({ docId, draft, html }: { docId: string | undefined; draft: DocumentDraft; html: string }) {
  if (draft.status === 'none') {
    return (
      <div className="ws-empty">
        <EmptyState icon="file" title="No document open">
          Open a document from the tree, or create one.
        </EmptyState>
      </div>
    );
  }
  if (draft.status === 'missing') {
    return (
      <div className="ws-empty">
        <EmptyState icon="info" title="This document isn’t in this project">
          It may have been deleted or moved to another project.
        </EmptyState>
      </div>
    );
  }
  if (draft.status === 'loading') return <div className="ws-empty" aria-busy="true" />;
  return (
    <>
      <section className="ws-editor" aria-label="Editor">
        <Editor key={docId} initialContent={draft.initialContent} onChange={draft.onChange} onSave={draft.saveNow} />
      </section>
      <section className="ws-preview" aria-label="Preview">
        <Prose html={html} />
      </section>
    </>
  );
}
