import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { imageFiles } from './files';
import { editorTheme, markdownHighlight } from './theme';

export interface EditorCallbacks {
  onChange: (content: string) => void;
  onSave: () => void;
  onImageFiles: (files: File[], at: number | null) => void;
  onFocus: () => void;
}

export function createExtensions({ onChange, onSave, onImageFiles, onFocus }: EditorCallbacks): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }), // GFM
    syntaxHighlighting(markdownHighlight),
    keymap.of([
      { key: 'Mod-s', preventDefault: true, run: () => (onSave(), true) },
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange(update.state.doc.toString());
    }),
    EditorView.contentAttributes.of({ 'aria-label': 'Markdown source' }),
    EditorView.domEventHandlers({
      focus: () => {
        onFocus();
        return false;
      },
      drop: (event, view) => {
        const files = imageFiles(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        onImageFiles(files, view.posAtCoords({ x: event.clientX, y: event.clientY }));
        return true;
      },
      paste: (event) => {
        const files = imageFiles(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        onImageFiles(files, null);
        return true;
      },
    }),
    editorTheme,
  ];
}
