import { useEffect, useRef, useState } from 'react';
import { getImageBytes, type ImageAsset } from '../store';

/** One object URL per stored image. Bytes never change, so the id is the key; URLs are revoked when the image goes and on unmount. */
export function useImageUrls(images: readonly ImageAsset[] | undefined): ReadonlyMap<string, string> {
  const made = useRef(new Map<string, string>());
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    if (!images) return;
    let cancelled = false;
    const current = made.current;
    const publish = () => setUrls(new Map(current));
    const wanted = new Set(images.map((image) => image.id));
    let removed = false;
    for (const [id, url] of current) {
      if (!wanted.has(id)) {
        URL.revokeObjectURL(url);
        current.delete(id);
        removed = true;
      }
    }
    if (removed) publish();
    const missing = images.filter((image) => !current.has(image.id));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map(async (image) => {
        const bytes = await getImageBytes(image.id).catch(() => null);
        if (cancelled || !bytes || current.has(image.id)) return;
        current.set(image.id, URL.createObjectURL(new Blob([bytes], { type: image.contentType })));
      }),
    ).then(() => {
      if (!cancelled) publish();
    });
    return () => {
      cancelled = true;
    };
  }, [images]);

  useEffect(() => {
    const current = made.current;
    return () => {
      for (const url of current.values()) URL.revokeObjectURL(url);
      current.clear();
    };
  }, []);

  return urls;
}
