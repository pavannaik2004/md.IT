import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/** Editor chrome from design tokens (code-editor type style: 14/24 Geist Mono). */
export const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--paper-raised)', color: 'var(--ink)' },
  '&.cm-focused': { outline: '2px solid var(--focus)', outlineOffset: '-2px' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', fontSize: '14px', lineHeight: '24px', overflow: 'auto' },
  '.cm-content': { padding: 'var(--space-6) var(--space-6) var(--space-16)', caretColor: 'var(--accent)', maxWidth: 'var(--doc-measure)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
});

/** Muted Markdown syntax colors: structure in ink, markup characters faint. */
export const markdownHighlight = HighlightStyle.define([
  { tag: t.heading, fontWeight: '600', color: 'var(--ink)' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--link)' },
  { tag: t.monospace, color: 'var(--ink-muted)' },
  { tag: t.quote, color: 'var(--ink-muted)' },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName], color: 'var(--ink-faint)' },
]);
