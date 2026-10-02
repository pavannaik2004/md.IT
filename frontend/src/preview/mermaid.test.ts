import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDiagrams, resetMermaid, type MermaidApi } from './mermaid';

type RenderFn = (id: string, source: string) => Promise<{ svg: string }>;

function fakeApi(render: RenderFn = async (id, source) => ({ svg: `<svg data-id="${id}"><text>${source}</text></svg>` })) {
  const api = { initialize: vi.fn(), render: vi.fn(render) };
  return { api, load: () => Promise.resolve(api as unknown as MermaidApi) };
}

/** Placeholders as the renderer writes them: URI-encoded source (see readDiagramSource). */
function host(...sources: string[]) {
  const el = document.createElement('div');
  for (const source of sources) {
    const placeholder = document.createElement('div');
    placeholder.className = 'md-mermaid';
    placeholder.dataset.source = encodeURIComponent(source);
    el.append(placeholder);
  }
  document.body.append(el);
  return el;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  resetMermaid();
  document.body.innerHTML = '';
});

describe('renderDiagrams', () => {
  it('never loads Mermaid for a document without diagrams', async () => {
    const load = vi.fn();
    await renderDiagrams(host(), 'light', load);
    expect(load).not.toHaveBeenCalled();
  });

  it('shows a pending box at once, then the diagram, with strict security', async () => {
    const { api, load } = fakeApi();
    const root = host('graph TD\nA-->B');
    const done = renderDiagrams(root, 'light', load);
    const placeholder = root.querySelector<HTMLElement>('.md-mermaid')!;
    expect(placeholder.textContent).toBe('Rendering diagram…');
    expect(placeholder.dataset.state).toBe('pending');
    await done;
    expect(placeholder.querySelector('svg')).not.toBeNull();
    expect(placeholder.dataset.state).toBe('done');
    expect(api.render).toHaveBeenCalledWith(expect.any(String), 'graph TD\nA-->B');
    expect(api.initialize).toHaveBeenCalledWith(expect.objectContaining({ securityLevel: 'strict', startOnLoad: false, suppressErrorRendering: true }));
  });

  it('fills cached diagrams without re-rendering', async () => {
    const { api, load } = fakeApi();
    await renderDiagrams(host('graph A'), 'light', load);
    const second = host('graph A');
    void renderDiagrams(second, 'light', load);
    expect(second.querySelector('svg')).not.toBeNull(); // synchronously: no flicker while typing elsewhere
    expect(api.render).toHaveBeenCalledTimes(1);
  });

  it('renders again for another theme', async () => {
    const { api, load } = fakeApi();
    await renderDiagrams(host('graph A'), 'light', load);
    await renderDiagrams(host('graph A'), 'dark', load);
    expect(api.render).toHaveBeenCalledTimes(2);
    expect(api.initialize).toHaveBeenCalledTimes(2);
  });

  it('shows a diagram error inline', async () => {
    const { load } = fakeApi(() => Promise.reject(new Error('Parse error on line 1')));
    const root = host('graph ???');
    await renderDiagrams(root, 'light', load);
    expect(root.querySelector('.md-render-error')?.textContent).toBe('Couldn’t render diagram: Parse error on line 1');
  });

  it('says when the diagram renderer can’t load, and tries again next time', async () => {
    const root = host('graph A');
    await renderDiagrams(root, 'light', () => Promise.reject(new Error('offline')));
    expect(root.querySelector('.md-render-error')?.textContent).toBe('Couldn’t load the diagram renderer.');
    const { load } = fakeApi();
    const again = host('graph A');
    await renderDiagrams(again, 'light', load);
    expect(again.querySelector('svg')).not.toBeNull();
  });

  it('drops a stale result', async () => {
    const gate = deferred<{ svg: string }>();
    const { load } = fakeApi(() => gate.promise);
    const root = host('graph A');
    const done = renderDiagrams(root, 'light', load);
    const placeholder = root.querySelector<HTMLElement>('.md-mermaid')!;
    placeholder.dataset.source = encodeURIComponent('graph B'); // the document changed while rendering
    gate.resolve({ svg: '<svg id="old"></svg>' });
    await done;
    expect(placeholder.querySelector('svg')).toBeNull();
  });
});
