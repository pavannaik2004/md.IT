import { useState } from 'react';
import { formatSize } from '../store';

/** Hover preview for an image row (app extension of TreeItem, P-013). */
export function ImageThumb({ anchor, url, size }: { anchor: DOMRect; url: string; size: number }) {
  const [dimensions, setDimensions] = useState<string | null>(null);
  return (
    <div className="tree-thumb" role="tooltip" style={{ top: anchor.top, left: anchor.right + 8 }}>
      <img src={url} alt="" onLoad={(event) => setDimensions(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)} />
      <span className="tree-thumb-meta">{dimensions ? `${dimensions} · ${formatSize(size)}` : formatSize(size)}</span>
    </div>
  );
}
