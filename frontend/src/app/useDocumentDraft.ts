import { useCallback, useEffect, useMemo, useState } from 'react';
import { debounce } from '../lib/debounce';
import { getDocument, NotFoundError, saveDocumentContent } from '../store';

export type SaveState = 'saved' | 'saving' | 'failed';
export type DraftStatus = 'none' | 'loading' | 'missing' | 'ready';

export interface DocumentDraft {
  status: DraftStatus;
  initialContent: string;
  previewSource: string;
  saveState: SaveState;
  onChange: (content: string) => void;
  saveNow: () => void;
}

export interface DraftOptions {
  saveDelay?: number;
  previewDelay?: number;
}

type Loaded = { id: string; found: false } | { id: string; found: true; content: string };

export function useDocumentDraft(docId: string | undefined, { saveDelay = 1000, previewDelay = 150 }: DraftOptions = {}): DocumentDraft {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [previewSource, setPreviewSource] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('saved');

  useEffect(() => {
    if (!docId) return;
    let cancelled = false;
    getDocument(docId).then(
      (doc) => {
        if (cancelled) return;
        setLoaded(doc ? { id: docId, found: true, content: doc.content } : { id: docId, found: false });
        setPreviewSource(doc?.content ?? '');
        setSaveState('saved');
      },
      () => {
        if (!cancelled) setLoaded({ id: docId, found: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // One saver per document, so a pending save always lands in the document it was typed into.
  const saver = useMemo(() => {
    if (!docId) return null;
    let latest = 0;
    const save = debounce((content: string) => {
      const ticket = ++latest;
      saveDocumentContent(docId, content).then(
        () => {
          if (ticket === latest && !save.pending()) setSaveState('saved');
        },
        (error: unknown) => {
          if (error instanceof NotFoundError) return; // deleted meanwhile; nothing left to save
          console.error(error);
          if (ticket === latest) setSaveState('failed');
        },
      );
    }, saveDelay);
    return save;
  }, [docId, saveDelay]);

  // Flush on document switch, unmount, tab hide and page unload.
  useEffect(() => {
    if (!saver) return;
    const flush = () => saver.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [saver]);

  const previewer = useMemo(() => debounce((content: string) => setPreviewSource(content), previewDelay), [previewDelay]);
  // A preview scheduled for the previous document must not overwrite the next one.
  useEffect(() => () => previewer.cancel(), [previewer, docId]);

  const onChange = useCallback(
    (content: string) => {
      if (!saver) return;
      setSaveState('saving');
      saver(content);
      previewer(content);
    },
    [saver, previewer],
  );

  const saveNow = useCallback(() => saver?.flush(), [saver]);

  const current = docId && loaded?.id === docId ? loaded : null;
  const status: DraftStatus = !docId ? 'none' : !current ? 'loading' : current.found ? 'ready' : 'missing';
  return {
    status,
    initialContent: current?.found ? current.content : '',
    previewSource,
    saveState,
    onChange,
    saveNow,
  };
}
