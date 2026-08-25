import { PARTIES, POWERS } from './constants.js';

/**
 * Tunable game configuration.
 *
 * Every table below is data, not logic — the reducer never hard-codes a
 * threshold. Swap a table here to retune balance without touching the machine.
 */

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;

const clampPlayerCount = (playerCount) =>
  Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, playerCount));

/** Board definitions. Powers are scaled by player count — see POWER_SCHEDULE. */
export const BOARDS = {
  [PARTIES.LIBERAL]: { id: PARTIES.LIBERAL, label: 'Liberal', slots: 5, winAt: 5 },
  [PARTIES.FASCIST]: { id: PARTIES.FASCIST, label: 'Fascist', slots: 6, winAt: 6 },
  [PARTIES.COMMUNIST]: { id: PARTIES.COMMUNIST, label: 'Communist', slots: 5, winAt: 5 },
};

/**
 * Which slot on which track grants which power, keyed by table size.
 *
 * The fascist track tightens as the table grows: a small table gets a peek and
 * two executions, a large one opens with two investigations. Keys are slot
 * numbers — the nth policy of that colour to reach the board.
 */
export const FASCIST_POWER_SCHEDULE = [
  {
    maxPlayers: 6,
    powers: {
      3: POWERS.POLICY_PEEK,
      4: POWERS.EXECUTION,
      5: POWERS.EXECUTION,
    },
  },
  {
    maxPlayers: 8,
    powers: {
      2: POWERS.INVESTIGATE_LOYALTY,
      3: POWERS.SPECIAL_ELECTION,
      4: POWERS.EXECUTION,
      5: POWERS.EXECUTION,
    },
  },
  {
    maxPlayers: MAX_PLAYERS,
    powers: {
      1: POWERS.INVESTIGATE_LOYALTY,
      2: POWERS.INVESTIGATE_LOYALTY,
      3: POWERS.SPECIAL_ELECTION,
      4: POWERS.EXECUTION,
      5: POWERS.EXECUTION,
    },
  },
];

/** The communist track does not scale. */
export const COMMUNIST_POWERS = {
  1: POWERS.CONFESSION,
  2: POWERS.CONFESSION,
  3: POWERS.RADICALISATION,
};

/**
 * Slot -> power for one track at one table size.
 *
 * `playerCount` is the size the game *started* at (cached on `config` at deal
 * time), so executions never re-tune the board mid-game.
 *
 * @returns {Record<number, string>} empty for tracks that grant no powers
 */
export function getBoardPowers(party, playerCount) {
  if (party === PARTIES.COMMUNIST) return COMMUNIST_POWERS;
  if (party !== PARTIES.FASCIST) return {};

  const count = clampPlayerCount(playerCount);
  const row =
    FASCIST_POWER_SCHEDULE.find((entry) => count <= entry.maxPlayers) ??
    FASCIST_POWER_SCHEDULE[FASCIST_POWER_SCHEDULE.length - 1];
  return row.powers;
}

/** Fascists gain the veto power once this many fascist policies are enacted. */
export const VETO_UNLOCKS_AT = 5;

/** Below this player count Hitler is shown the Fascists at the role reveal. */
export const HITLER_KNOWS_FASCISTS_BELOW = 7;

/** Hitler being elected Chancellor loses the game from this fascist count up. */
export const HITLER_CHANCELLOR_DANGER_AT = 3;

/** Three consecutive failed elections send the country into chaos. */
export const CHAOS_AT = 3;

/**
 * Deck composition by player count (upper bound, inclusive).
 *
 * Placeholder balance derived from the base game's 6L/11F, with fascist cards
 * traded out for communist ones. Replace with the published XL table when the
 * group settles on a printing — the reducer only reads `generateDeck`.
 */
export const DECK_COMPOSITION = [
  { maxPlayers: 4, liberal: 5, fascist: 9, communist: 7 },
  { maxPlayers: 6, liberal: 5, fascist: 10, communist: 8 },
  { maxPlayers: 8, liberal: 6, fascist: 10, communist: 8 },
  { maxPlayers: 10, liberal: 6, fascist: 11, communist: 8 },
  { maxPlayers: 14, liberal: 7, fascist: 12, communist: 9 },
  { maxPlayers: MAX_PLAYERS, liberal: 8, fascist: 13, communist: 10 },
];

/** Base game (no communists) deck, for when the expansion is switched off. */
export const BASE_DECK_COMPOSITION = { liberal: 6, fascist: 11, communist: 0 };

/**
 * Role counts by player count. `fascists` excludes Hitler, who is always dealt.
 * Liberals fill whatever is left over.
 */
export const ROLE_COMPOSITION = {
  // Four is below the official minimum. The standard homebrew is 2 Liberals,
  // 1 Fascist and Hitler; with the expansion on, a Liberal becomes the lone
  // Communist. Both are house rules — see README.
  4: { fascists: 1, communists: 1 },
  5: { fascists: 1, communists: 1 },
  6: { fascists: 1, communists: 1 },
  7: { fascists: 2, communists: 1 },
  8: { fascists: 2, communists: 1 },
  9: { fascists: 2, communists: 2 },
  10: { fascists: 3, communists: 2 },
  11: { fascists: 3, communists: 2 },
  12: { fascists: 3, communists: 3 },
  13: { fascists: 4, communists: 3 },
  14: { fascists: 4, communists: 3 },
  15: { fascists: 4, communists: 4 },
  16: { fascists: 5, communists: 4 },
  17: { fascists: 5, communists: 4 },
  18: { fascists: 5, communists: 5 },
  19: { fascists: 6, communists: 5 },
  20: { fascists: 6, communists: 5 },
};

/** Base-game fascist counts, used when the communist expansion is off. */
export const BASE_ROLE_COMPOSITION = {
  4: 1,
  5: 1, 6: 1, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3, 12: 4,
  13: 4, 14: 4, 15: 5, 16: 5, 17: 5, 18: 6, 19: 6, 20: 6,
};

/** @returns {{liberal:number, fascist:number, communist:number}} */
export function getDeckComposition(playerCount, communistsEnabled = true) {
  if (!communistsEnabled) return { ...BASE_DECK_COMPOSITION };
  const count = clampPlayerCount(playerCount);
  const row =
    DECK_COMPOSITION.find((entry) => count <= entry.maxPlayers) ??
    DECK_COMPOSITION[DECK_COMPOSITION.length - 1];
  return { liberal: row.liberal, fascist: row.fascist, communist: row.communist };
}

/** @returns {{liberals:number, fascists:number, communists:number, hitler:number}} */
export function getRoleComposition(playerCount, communistsEnabled = true) {
  const count = clampPlayerCount(playerCount);
  const fascists = communistsEnabled
    ? ROLE_COMPOSITION[count].fascists
    : BASE_ROLE_COMPOSITION[count];
  const communists = communistsEnabled ? ROLE_COMPOSITION[count].communists : 0;
  return {
    fascists,
    communists,
    hitler: 1,
    liberals: count - fascists - communists - 1,
  };
}

/**
 * The previous President is only term-limited while enough players are alive;
 * with five or fewer left only the previous Chancellor is locked out.
 */
export const PRESIDENT_TERM_LIMIT_ABOVE = 5;
