import { useCallback, useEffect, useMemo, useState } from 'react';
import { debounce } from '../lib/debounce';
import { setSetting, SETTINGS, useSetting } from '../store';
import { clampRendering, DEFAULT_RENDERING, sameRendering, type RenderingSettings } from './rendering';

export type RenderingControls = [
  settings: RenderingSettings,
  update: (patch: Partial<RenderingSettings>) => void,
  reset: () => void,
];

/** Call once per screen and pass the result down: changes show at once, the row is written 200 ms after the last one. */
export function useRenderingSettings(): RenderingControls {
  const stored = useSetting<unknown>(SETTINGS.rendering, null);
  const saved = useMemo(() => clampRendering(stored), [stored]);
  const [pending, setPending] = useState<RenderingSettings | null>(null);
  const writer = useMemo(() => debounce((next: RenderingSettings) => void setSetting(SETTINGS.rendering, next), 200), []);
  useEffect(() => () => writer.flush(), [writer]);

  // Drop the local copy once the stored row has caught up, so later changes from elsewhere show.
  useEffect(() => {
    if (pending && sameRendering(pending, saved)) setPending(null);
  }, [pending, saved]);

  const settings = pending ?? saved;
  const update = useCallback(
    (patch: Partial<RenderingSettings>) => {
      const next = clampRendering({ ...settings, ...patch });
      setPending(next);
      writer(next);
    },
    [settings, writer],
  );
  const reset = useCallback(() => {
    setPending(DEFAULT_RENDERING);
    writer(DEFAULT_RENDERING);
  }, [writer]);
  return [settings, update, reset];
}
