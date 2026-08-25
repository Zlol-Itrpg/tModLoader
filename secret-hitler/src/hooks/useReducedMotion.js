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

    // `a?.() ?? b?.()` looks like a fallback but is not: addEventListener
    // returns undefined, so the right-hand side runs too and the handler ends
    // up registered twice on every browser that has both APIs.
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    // Safari below 14 only has the deprecated API.
    if (typeof query.addListener === 'function') {
      query.addListener(onChange);
      return () => query.removeListener(onChange);
    }
    return undefined;
  }, []);

  return reduced;
}

export default useReducedMotion;
