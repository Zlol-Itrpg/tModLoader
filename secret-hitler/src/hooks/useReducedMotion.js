import { useEffect, useState } from 'react';

/**
 * The CSS layer already neuters every animation under
 * `prefers-reduced-motion: reduce`. This is for the handful of places where JS
 * has to make the same decision — skipping a timed sequence rather than a
 * transition, say — so the two never disagree.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    let query;
    try {
      query = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }

    const onChange = (event) => setReduced(event.matches);
    // Safari below 14 only has the deprecated listener API.
    query.addEventListener?.('change', onChange) ?? query.addListener?.(onChange);
    return () => {
      query.removeEventListener?.('change', onChange) ?? query.removeListener?.(onChange);
    };
  }, []);

  return reduced;
}

export default useReducedMotion;
