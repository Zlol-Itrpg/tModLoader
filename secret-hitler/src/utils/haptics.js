/**
 * Vibration, where the device has it.
 *
 * `navigator.vibrate` is unimplemented on iOS Safari and on desktop, and some
 * browsers expose it but ignore calls made outside a user gesture. All of those
 * are fine: the call is best-effort and silently does nothing, which is why
 * nothing here reports success.
 */

/** Durations in milliseconds; `pattern` alternates vibrate/pause/vibrate. */
export const PATTERNS = {
  light: 15,
  medium: 40,
  heavy: 100,
  pattern: [40, 60, 40],
};

/**
 * Two cues can land in the same commit — a policy is enacted and the handoff
 * that follows is revealed — and `navigator.vibrate` *replaces* whatever is
 * playing rather than queueing it. Back-to-back calls therefore truncate each
 * other into a stutter that reads as a rattle rather than two events.
 *
 * Inside this window only the stronger pulse survives, so the important one is
 * the one you feel.
 */
const COALESCE_MS = 120;

const weigh = (pattern) =>
  Array.isArray(pattern) ? pattern.reduce((total, ms) => total + ms, 0) : pattern;

let lastAt = -Infinity;
let lastWeight = 0;

function supported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

const now = () =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

function fire(pattern) {
  if (!supported()) return false;

  const at = now();
  const weight = weigh(pattern);
  if (at - lastAt < COALESCE_MS && weight <= lastWeight) return false;

  try {
    const fired = navigator.vibrate(pattern) === true;
    if (fired) {
      lastAt = at;
      lastWeight = weight;
    }
    return fired;
  } catch {
    // Some engines throw when called from a non-gesture context.
    return false;
  }
}

/** Test seam: forget the coalescing window. */
export function resetHaptics() {
  lastAt = -Infinity;
  lastWeight = 0;
}

/** Button taps, card selections. */
export const light = () => fire(PATTERNS.light);
/** Committing a vote. */
export const medium = () => fire(PATTERNS.medium);
/** A policy landing, an execution. */
export const heavy = () => fire(PATTERNS.heavy);
/** Game over, or Hitler revealed. */
export const pattern = () => fire(PATTERNS.pattern);

export const haptics = { light, medium, heavy, pattern };
export default haptics;
