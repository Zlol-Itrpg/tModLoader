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

function supported() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function fire(pattern) {
  if (!supported()) return false;
  try {
    return navigator.vibrate(pattern) === true;
  } catch {
    // Some engines throw when called from a non-gesture context.
    return false;
  }
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
