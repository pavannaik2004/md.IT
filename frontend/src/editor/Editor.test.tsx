import { act, fireEvent, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { describe, expect, it, vi } from 'vitest';
import { Editor } from './Editor';

function setup(initialContent = '# Hello') {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const { container, unmount } = render(<Editor initialContent={initialContent} onChange={onChange} onSave={onSave} />);
  const editorEl = container.querySelector<HTMLElement>('.cm-editor')!;
  const view = EditorView.findFromDOM(editorEl)!;
  return { container, view, onChange, onSave, unmount };
}

describe('Editor', () => {
  it('shows the initial content', () => {
    const { container } = setup();
    expect(container.querySelector('.cm-content')?.textContent).toContain('# Hello');
  });

  it('reports the full document on every edit', () => {
    const { view, onChange } = setup();
    act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: '\nWorld' } }));
    expect(onChange).toHaveBeenLastCalledWith('# Hello\nWorld');
  });

  it('does not report a change when nothing changed', () => {
    const { view, onChange } = setup();
    act(() => view.dispatch({ selection: { anchor: 0 } }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('saves on Ctrl+S', () => {
    const { container, onSave } = setup();
    fireEvent.keyDown(container.querySelector('.cm-content')!, { key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('supports undo', () => {
    const { container, view, onChange } = setup('a');
    act(() => view.dispatch({ changes: { from: 1, insert: 'b' }, userEvent: 'input' }));
    fireEvent.keyDown(container.querySelector('.cm-content')!, { key: 'z', ctrlKey: true });
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('cleans up on unmount', () => {
    const { container, unmount } = setup();
    unmount();
    expect(container.querySelector('.cm-editor')).toBeNull();
  });
});
