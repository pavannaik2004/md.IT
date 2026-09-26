export type LinkAction = { kind: 'open'; docId: string } | { kind: 'notice'; message: string } | { kind: 'default' };

const EXTERNAL = /^[a-z][a-z0-9+.-]*:|^\/\//i;

function displayName(href: string): string {
  const path = href.split(/[?#]/, 1)[0] ?? '';
  const last = path.split('/').filter(Boolean).pop() ?? href;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** What a click on a preview link should do. Relative links never navigate the browser away from the app. */
export function linkAction(link: Element): LinkAction {
  const docId = link.getAttribute('data-doc-id');
  if (docId) return { kind: 'open', docId };
  const href = link.getAttribute('href') ?? '';
  if (link.getAttribute('data-missing') === 'true') return { kind: 'notice', message: `“${displayName(href)}” isn’t in this project.` };
  if (href === '' || href.startsWith('#') || EXTERNAL.test(href)) return { kind: 'default' };
  return { kind: 'notice', message: 'Only links to documents in this project open here.' };
}
