import { useEffect, useState } from 'react';

/**
 * True while the element matched by `selector` is not wholly in view below the sticky header.
 * A state that follows what the player can see, not a scroll effect: it drives an opacity, never
 * a displacement. `watch` re-subscribes when what the element holds may have changed.
 */
export default function useOutOfView(selector: string, active: boolean, watch?: unknown): boolean {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const target = active ? document.querySelector(selector) : null;
    if (!target) {
      setOut(false);
      return undefined;
    }
    const header = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0;
    const observer = new IntersectionObserver(([entry]) => setOut(entry.intersectionRatio < 0.98), {
      rootMargin: `-${Math.round(header)}px 0px 0px 0px`,
      threshold: [0, 0.98, 1],
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [selector, active, watch]);
  return out;
}
