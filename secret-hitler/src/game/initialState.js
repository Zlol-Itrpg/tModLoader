import { PARTIES, PHASES } from './constants.js';
import { BOARDS } from './config.js';

/**
 * Mock roster for development. Real games edit this list on the SETUP screen.
 * Five is the legal minimum, so the default table is playable on first load.
 */
export const MOCK_PLAYER_NAMES = [
  'Braden',
  'Dawson',
  'Danielle',
  'Marguerite',
  'Ellis',
  'Ines',
  'Osric',
];

/**
 * A player record.
 *
 * `role` is the dealt secret role; `party` is the membership card an
 * investigation or Confession exposes, and is what Radicalisation rewrites —
 * a radicalised Fascist keeps `role: FASCIST` but flips `party` to COMMUNIST,
 * which is what makes the power interesting.
 */
export function createPlayer(name, seat) {
  return {
    id: `p${seat}`,
    seat,
    name,
    role: null,
    party: null,
    isAlive: true,
    // Confession makes a membership card permanently public to the table.
    isPartyPublic: false,
    // Ids of players who have used Investigate Loyalty on this player.
    investigatedBy: [],
    hasBeenRadicalised: false,
  };
}

const createBoards = () =>
  Object.fromEntries(
    Object.values(BOARDS).map((board) => [
      board.id,
      { id: board.id, enacted: 0, lastPowerSlot: 0 },
    ]),
  );

/**
 * @param {{names?: string[], communistsEnabled?: boolean}} [options]
 * @returns {typeof initialState}
 */
export function createInitialState(options = {}) {
  const { names = MOCK_PLAYER_NAMES, communistsEnabled = true } = options;

  return {
    phase: PHASES.SETUP,

    /** Seat order is turn order; index 0 is the first Presidential Candidate. */
    players: names.map(createPlayer),

    /** Enacted policy counters, keyed by party. Win/power thresholds live in config. */
    boards: createBoards(),

    /** Top of `deck` is index 0. Seeded by START_GAME once the roster is locked. */
    deck: [],
    discard: [],

    /** Whose turn it is. `presidentId` is the sitting President for this round. */
    government: {
      presidentId: null,
      chancellorId: null,
      nomineeId: null,
    },

    /** Term limits are computed from the last *successfully elected* government. */
    lastElectedGovernment: {
      presidentId: null,
      chancellorId: null,
    },

    /** Rotation cursor over `players` (by seat), plus the special-election detour. */
    rotation: {
      presidentIndex: 0,
      /** Set by Special Election; the seat the rotation returns to afterwards. */
      returnToIndex: null,
      isSpecialElection: false,
    },

    /** Secret ballot in progress. `votes` is playerId -> VOTES.JA | VOTES.NEIN. */
    election: {
      votes: {},
      /** Index into the alive-player list of whoever is voting next. */
      ballotIndex: 0,
      /** Populated on resolution so the table can see the tally. */
      result: null,
      /** Failed elections since the last enacted policy; CHAOS_AT triggers chaos. */
      tracker: 0,
    },

    /**
     * The hand in flight, and nothing else.
     *
     * One ephemeral array carries the policies from the deck through the
     * President's discard to the Chancellor's enactment, so a card can never be
     * duplicated into a second list or dropped between handoffs. Each entry is
     * `{ id, party }`; the id is unique within the hand and is what the UI
     * dispatches back, so nothing depends on array position.
     */
    legislative: {
      cards: [],
      /** What the President binned, kept for the public log. */
      discarded: null,
      vetoRequested: false,
      /** Set when the President refuses; locks the Chancellor's veto button. */
      vetoRejected: false,
    },

    /** Set when a board slot fires a power; cleared when the President resolves it. */
    pendingPower: null,

    /**
     * The device-passing overlay. Non-null means the InterstitialScreen is up and
     * the app body is hidden. `revealed` flips on tap confirmation.
     * @type {null | {kind: string, toPlayerId: string, revealed: boolean, payload: object}}
     */
    handoff: null,

    /** Terminal state. */
    winner: null,
    winReason: null,

    /** Append-only public record; safe to render to the whole table. */
    log: [],

    config: {
      communistsEnabled,
      /** Cached at START_GAME so mid-game deaths don't change the deck maths. */
      playerCount: names.length,
    },
  };
}

/** Default store seed. */
export const initialState = createInitialState();

/** Convenience for the board rail: the tracks in display order. */
export const BOARD_ORDER = [PARTIES.LIBERAL, PARTIES.COMMUNIST, PARTIES.FASCIST];
