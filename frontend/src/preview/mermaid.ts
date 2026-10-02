import { readDiagramSource } from '../renderer';

export type Theme = 'light' | 'dark';
export type MermaidApi = Pick<(typeof import('mermaid'))['default'], 'initialize' | 'render'>;

/** Reads a design token, e.g. '--paper'. Exports pass the light theme's values (P-035). */
export type TokenReader = (name: string) => string;

const documentTokens: TokenReader = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

type Outcome = { svg: string } | { message: string };

const MAX_CACHED = 50;
const cache = new Map<string, Outcome>(); // insertion order = least recently used first
let queue: Promise<void> = Promise.resolve(); // Mermaid renders one diagram at a time
let configuredTheme: Theme | null = null;
let sequence = 0;

/** Lazy: Mermaid (~2 MB) becomes its own chunk, fetched only for documents with a diagram. */
export const loadMermaid = (): Promise<MermaidApi> => import('mermaid').then((module) => module.default);

export function resetMermaid(): void {
  cache.clear();
  queue = Promise.resolve();
  configuredTheme = null;
}

const cacheKey = (theme: Theme, source: string) => `${theme}\n${source}`;

function recall(key: string): Outcome | undefined {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function remember(key: string, outcome: Outcome): void {
  cache.delete(key);
  cache.set(key, outcome);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}

function show(el: HTMLElement, outcome: Outcome): void {
  if ('svg' in outcome) {
    el.innerHTML = outcome.svg;
    el.dataset.state = 'done';
    return;
  }
  const box = document.createElement('div');
  box.className = 'md-render-error';
  box.textContent = outcome.message;
  el.replaceChildren(box);
  el.dataset.state = 'error';
}

/** Diagram colors from the current design tokens, so diagrams follow the light and dark themes. */
function themeVariables(token: TokenReader): Record<string, string> {
  const vars: Record<string, string> = {
    background: token('--paper'),
    primaryColor: token('--paper-raised'),
    primaryTextColor: token('--ink'),
    primaryBorderColor: token('--line-strong'),
    secondaryColor: token('--paper-sunken'),
    tertiaryColor: token('--paper-code'),
    lineColor: token('--ink-muted'),
    textColor: token('--ink'),
    fontFamily: token('--font-sans'),
  };
  return Object.fromEntries(Object.entries(vars).filter(([, value]) => value !== ''));
}

function configure(api: MermaidApi, theme: Theme, tokens: TokenReader): void {
  if (configuredTheme === theme) return;
  api.initialize({ startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true, theme: 'base', themeVariables: themeVariables(tokens) });
  configuredTheme = theme;
}

/** Fill every `.md-mermaid` placeholder under `root`. Cached results are placed synchronously. */
export function renderDiagrams(
  root: HTMLElement,
  theme: Theme,
  load: () => Promise<MermaidApi> = loadMermaid,
  tokens: TokenReader = documentTokens,
): Promise<void> {
  const pending: Array<{ el: HTMLElement; raw: string | null; source: string }> = [];
  for (const el of root.querySelectorAll<HTMLElement>('.md-mermaid')) {
    const source = readDiagramSource(el);
    const hit = recall(cacheKey(theme, source));
    if (hit) {
      show(el, hit);
    } else {
      el.dataset.state = 'pending';
      el.textContent = 'Rendering diagram…';
      pending.push({ el, raw: el.getAttribute('data-source'), source });
    }
  }
  if (pending.length === 0) return Promise.resolve();

  // Still the same placeholder with the same source? A result for anything else is stale.
  const current = (el: HTMLElement, raw: string | null) => el.isConnected && el.getAttribute('data-source') === raw;

  const work = queue.then(async () => {
    let api: MermaidApi;
    try {
      api = await load();
    } catch {
      for (const { el } of pending) if (el.isConnected) show(el, { message: 'Couldn’t load the diagram renderer.' });
      return;
    }
    configure(api, theme, tokens);
    for (const { el, raw, source } of pending) {
      if (!current(el, raw)) continue;
      const key = cacheKey(theme, source);
      let outcome = recall(key);
      if (!outcome) {
        const id = `mdit-mermaid-${++sequence}`;
        try {
          outcome = { svg: (await api.render(id, source)).svg };
        } catch (error) {
          outcome = { message: `Couldn’t render diagram: ${error instanceof Error ? error.message : String(error)}` };
          document.getElementById(`d${id}`)?.remove(); // Mermaid's temporary wrapper, in case it was left behind
          document.getElementById(id)?.remove();
        }
        remember(key, outcome);
      }
      if (current(el, raw)) show(el, outcome);
    }
  });
  queue = work.catch(() => undefined);
  return work;
}
