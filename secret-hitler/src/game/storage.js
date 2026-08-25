import { PHASES } from './constants.js';

/**
 * localStorage persistence for a single in-progress game.
 *
 * A pass-and-play session lives entirely on one device, so an accidental
 * refresh, a locked screen, or a browser tab reaped in the background would
 * otherwise lose the whole game. The store is plain serialisable data, so the
 * save is just the state object with a version stamp on it.
 *
 * Every entry point is total: a malformed, truncated, or older save must never
 * be able to crash the app, because a crash on load is a crash loop — the app
 * would be unopenable until someone cleared their browser data by hand, which
 * is exactly what this is meant to prevent. Anything unrecognised is thrown
 * away and the group starts fresh.
 */

export const SAVE_KEY = 'secret-hitler-save';

/**
 * Bump this whenever the state shape changes in a way an older save cannot
 * satisfy — a renamed slice, a field that stops being optional. Saves stamped
 * with anything else are discarded rather than migrated.
 */
export const SAVE_VERSION = 1;

/** Slices the reducer reads unconditionally; a save without them is not a save. */
const REQUIRED_KEYS = [
  'phase', 'players', 'boards', 'deck', 'discard', 'government',
  'lastElectedGovernment', 'rotation', 'election', 'legislative', 'config',
];

/** localStorage throws on access under some privacy settings, not just on use. */
function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** @returns {boolean} false if the save could not be written (quota, private mode) */
export function writeSave(state) {
  const localStore = store();
  if (!localStore) return false;

  try {
    localStore.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
    return true;
  } catch {
    // Quota exceeded or storage disabled. The game continues in memory; losing
    // the ability to save is not a reason to interrupt play.
    return false;
  }
}

export function clearSave() {
  const localStore = store();
  if (!localStore) return;
  try {
    localStore.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do — there is no fallback for a storage that refuses writes.
  }
}

/**
 * @returns {object|null} the saved state, or null if there was nothing usable.
 *   Anything unusable is deleted on the way out, so a bad save is only ever
 *   read once.
 */
export function loadSave() {
  const localStore = store();
  if (!localStore) return null;

  let raw;
  try {
    raw = localStore.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  // Nothing stored at all is the ordinary first-run case, not a bad save.
  if (raw === null || raw === undefined) return null;

  try {
    // Anything else falsy is a stray value: fall through so it gets cleaned up.
    if (!raw) throw new Error('empty save');

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== SAVE_VERSION) throw new Error('unrecognised save version');

    const state = parsed.state;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error('save is not a state object');
    }
    if (REQUIRED_KEYS.some((key) => !(key in state))) throw new Error('save is missing slices');
    if (!Array.isArray(state.players) || !Array.isArray(state.deck)) {
      throw new Error('save has the wrong shape');
    }
    if (!Object.values(PHASES).includes(state.phase)) throw new Error('save has an unknown phase');

    return state;
  } catch {
    clearSave();
    return null;
  }
}
