import { useEffect, useRef, useState } from 'react';

/** True once the element comes within `margin` of the viewport, and stays true. False where IntersectionObserver is missing. */
export function useNearViewport<T extends Element>(margin = '200px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: margin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near, margin]);
  return [ref, near] as const;
}
