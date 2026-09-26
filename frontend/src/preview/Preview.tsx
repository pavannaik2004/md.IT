import 'katex/dist/katex.min.css';
import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { Prose } from '../ui';
import { copyCode } from './copy';
import { linkAction } from './links';
import { renderDiagrams, type Theme } from './mermaid';
import './preview.css';

export interface PreviewProps {
  /** Sanitized HTML from the renderer. */
  html: string;
  theme: Theme;
  onOpenDocument: (docId: string) => void;
  onNotice: (message: string) => void;
}

export function Preview({ html, theme, onOpenDocument, onNotice }: PreviewProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  // After React has written the new HTML: fill diagram placeholders (cached ones synchronously).
  useLayoutEffect(() => {
    if (rootRef.current) void renderDiagrams(rootRef.current, theme);
  }, [html, theme]);

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
    <div className="md-preview" ref={rootRef} onClick={onClick}>
      <Prose html={html} />
    </div>
  );
}
