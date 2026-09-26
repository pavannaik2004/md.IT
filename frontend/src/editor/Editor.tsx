import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { createExtensions } from './extensions';

export interface EditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

/** Uncontrolled CodeMirror editor. Give it a `key` per document to load different content. */
export function Editor({ initialContent, onChange, onSave }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onSave });
  useEffect(() => {
    callbacks.current = { onChange, onSave };
  });

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: initialContent,
        extensions: createExtensions({
          onChange: (content) => callbacks.current.onChange(content),
          onSave: () => callbacks.current.onSave(),
        }),
      }),
    });
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uncontrolled: content is read once per mount
  }, []);

  return <div className="editor-host" ref={hostRef} />;
}
