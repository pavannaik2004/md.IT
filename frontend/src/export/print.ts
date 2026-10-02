const READY_TIMEOUT = 5_000;
const CLEANUP_TIMEOUT = 60_000;

/** Fonts loaded and images decoded, or 5 s, whichever comes first. */
async function whenReady(doc: Document): Promise<void> {
  const fonts = (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
  const images = Array.from(doc.images, (img) => (typeof img.decode === 'function' ? img.decode().catch(() => undefined) : undefined));
  await Promise.race([Promise.all([fonts?.ready, ...images]), new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT))]);
}

/** Opens the browser's print dialog for `html` (P-036); "Save as PDF" names the file after `title`. */
export function printHtml(html: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.className = 'print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    const originalTitle = document.title;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      document.title = originalTitle;
      frame.remove();
    };
    frame.addEventListener(
      'load',
      () => {
        void (async () => {
          const win = frame.contentWindow;
          const doc = frame.contentDocument;
          if (!win || !doc) {
            finish();
            reject(new Error('The print view couldn’t open.'));
            return;
          }
          await whenReady(doc);
          document.title = title; // Chrome and Edge suggest the top page's title as the PDF name
          win.addEventListener('afterprint', finish, { once: true });
          timer = setTimeout(finish, CLEANUP_TIMEOUT);
          win.focus();
          win.print();
          resolve();
        })();
      },
      { once: true },
    );
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
