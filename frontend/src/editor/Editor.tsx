import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createExtensions } from './extensions';

export interface EditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onSave: () => void;
  /** Image files dropped (at = document position) or pasted (at = null). */
  onImageFiles?: (files: File[], at: number | null) => void;
}

export interface EditorHandle {
  /** Insert `text` as its own block at `at`, or at the cursor (the end if the editor never had focus). One undo step. */
  insertBlock(text: string, at?: number | null): void;
}

/** Uncontrolled CodeMirror editor. Give it a `key` per document to load different content. */
export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ initialContent, onChange, onSave, onImageFiles }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const focusedRef = useRef(false);
  const callbacks = useRef({ onChange, onSave, onImageFiles });
  useEffect(() => {
    callbacks.current = { onChange, onSave, onImageFiles };
  });

  useImperativeHandle(ref, () => ({
    insertBlock(text, at = null) {
      const view = viewRef.current;
      if (!view) return;
      const doc = view.state.doc;
      const from = at ?? (focusedRef.current ? view.state.selection.main.head : doc.length);
      const before = doc.sliceString(Math.max(0, from - 2), from);
      const after = doc.sliceString(from, Math.min(doc.length, from + 2));
      const prefix = from === 0 || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
      const suffix = from === doc.length || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
      view.dispatch({
        changes: { from, insert: `${prefix}${text}${suffix}` },
        selection: { anchor: from + prefix.length + text.length },
        scrollIntoView: true,
        userEvent: 'input.paste',
      });
      focusedRef.current = true; // later inserts follow this one
    },
  }), []);

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: initialContent,
        extensions: createExtensions({
          onChange: (content) => callbacks.current.onChange(content),
          onSave: () => callbacks.current.onSave(),
          onImageFiles: (files, at) => callbacks.current.onImageFiles?.(files, at),
          onFocus: () => {
            focusedRef.current = true;
          },
        }),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uncontrolled: content is read once per mount
  }, []);

  return <div className="editor-host" ref={hostRef} />;
});
