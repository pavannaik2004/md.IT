import 'katex/dist/katex.min.css';
import type { MouseEvent } from 'react';
import { Prose } from '../ui';
import { copyCode } from './copy';
import { linkAction } from './links';
import './preview.css';

export interface PreviewProps {
  /** Sanitized HTML from the renderer. */
  html: string;
  onOpenDocument: (docId: string) => void;
  onNotice: (message: string) => void;
}

export function Preview({ html, onOpenDocument, onNotice }: PreviewProps) {
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('.md-code-copy');
    if (button instanceof HTMLButtonElement) {
      void copyCode(button);
      return;
    }
    const link = event.target.closest('a[href]');
    if (!link) return;
    const action = linkAction(link);
    if (action.kind === 'default') return;
    event.preventDefault();
    if (action.kind === 'open') onOpenDocument(action.docId);
    else onNotice(action.message);
  };
  return (
    <div className="md-preview" onClick={onClick}>
      <Prose html={html} />
    </div>
  );
}
