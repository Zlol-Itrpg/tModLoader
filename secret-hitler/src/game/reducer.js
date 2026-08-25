import {
  HANDOFF,
  PARTIES,
  PHASES,
  POWERS,
  POWER_INFO,
  ROLES,
  ROLE_PARTY,
  VOTES,
  WIN_REASONS,
} from './constants.js';
import {
  BOARDS,
  CHAOS_AT,
  HITLER_CHANCELLOR_DANGER_AT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PRESIDENT_TERM_LIMIT_ABOVE,
  VETO_UNLOCKS_AT,
  getBoardPowers,
  getRoleComposition,
} from './config.js';
import { drawPolicies, generateDeck, peekPolicies, shuffle } from './deck.js';
import { createInitialState, createPlayer } from './initialState.js';

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

export const ACTIONS = {
  // Setup
  ADD_PLAYER: 'ADD_PLAYER',
  REMOVE_PLAYER: 'REMOVE_PLAYER',
  RENAME_PLAYER: 'RENAME_PLAYER',
  SET_EXPANSION: 'SET_EXPANSION',
  START_GAME: 'START_GAME',

  // The pass-and-play overlay
  REVEAL_HANDOFF: 'REVEAL_HANDOFF',
  CONTINUE_HANDOFF: 'CONTINUE_HANDOFF',

  // Turn loop
  NOMINATE_CHANCELLOR: 'NOMINATE_CHANCELLOR',
  CAST_VOTE: 'CAST_VOTE',
  RESOLVE_ELECTION: 'RESOLVE_ELECTION',
  DISCARD_POLICY: 'DISCARD_POLICY',
  ENACT_POLICY: 'ENACT_POLICY',
  REQUEST_VETO: 'REQUEST_VETO',
  ANSWER_VETO: 'ANSWER_VETO',
  RESOLVE_POWER: 'RESOLVE_POWER',
  END_EXECUTIVE_ACTION: 'END_EXECUTIVE_ACTION',

  RESET_GAME: 'RESET_GAME',
};

export const actions = {
  addPlayer: (name) => ({ type: ACTIONS.ADD_PLAYER, payload: { name } }),
  removePlayer: (playerId) => ({ type: ACTIONS.REMOVE_PLAYER, payload: { playerId } }),
  renamePlayer: (playerId, name) => ({ type: ACTIONS.RENAME_PLAYER, payload: { playerId, name } }),
  setExpansion: (communistsEnabled) => ({
    type: ACTIONS.SET_EXPANSION,
    payload: { communistsEnabled },
  }),
  startGame: () => ({ type: ACTIONS.START_GAME }),

  revealHandoff: () => ({ type: ACTIONS.REVEAL_HANDOFF }),
  continueHandoff: () => ({ type: ACTIONS.CONTINUE_HANDOFF }),

  nominateChancellor: (chancellorId) => ({
    type: ACTIONS.NOMINATE_CHANCELLOR,
    payload: { chancellorId },
  }),
  castVote: (vote) => ({ type: ACTIONS.CAST_VOTE, payload: { vote } }),
  resolveElection: () => ({ type: ACTIONS.RESOLVE_ELECTION }),
  discardPolicy: (policyId) => ({ type: ACTIONS.DISCARD_POLICY, payload: { policyId } }),
  enactPolicy: (policyId) => ({ type: ACTIONS.ENACT_POLICY, payload: { policyId } }),
  requestVeto: () => ({ type: ACTIONS.REQUEST_VETO }),
  answerVeto: (accepted) => ({ type: ACTIONS.ANSWER_VETO, payload: { accepted } }),
  resolvePower: (targetId = null) => ({ type: ACTIONS.RESOLVE_POWER, payload: { targetId } }),
  endExecutiveAction: () => ({ type: ACTIONS.END_EXECUTIVE_ACTION }),
  /** `keepRoster: false` empties the table as well as the game. */
  resetGame: ({ keepRoster = true } = {}) => ({ type: ACTIONS.RESET_GAME, payload: { keepRoster } }),
};

/* -------------------------------------------------------------------------- */
/* Small pure helpers                                                          */
/* -------------------------------------------------------------------------- */

/** The hand between legislative sessions: empty, with no veto in flight. */
const EMPTY_HAND = Object.freeze({
  cards: [],
  discarded: null,
  vetoRequested: false,
  vetoRejected: false,
});

const getPlayer = (state, playerId) =>
  state.players.find((player) => player.id === playerId) ?? null;

const nameOf = (state, playerId) => getPlayer(state, playerId)?.name ?? 'Unknown';

export const alivePlayers = (state) => state.players.filter((player) => player.isAlive);

const updatePlayer = (state, playerId, patch) => ({
  ...state,
  players: state.players.map((player) =>
    player.id === playerId ? { ...player, ...patch } : player,
  ),
});

const log = (state, text) => ({
  ...state,
  log: [...state.log, { id: state.log.length, text }],
});

/** Raise the overlay. Every piece of hidden information routes through here. */
const handOffTo = (state, kind, toPlayerId, payload = {}) => ({
  ...state,
  handoff: { kind, toPlayerId, revealed: false, payload },
});

/** Next living seat after `fromIndex`, wrapping around the table. */
const nextAliveIndex = (players, fromIndex) => {
  for (let step = 1; step <= players.length; step += 1) {
    const index = (fromIndex + step) % players.length;
    if (players[index].isAlive) return index;
  }
  return fromIndex;
};

/** Players the sitting President may nominate this round. */
export const eligibleChancellors = (state) => {
  const { presidentId } = state.government;
  const { presidentId: lastPresident, chancellorId: lastChancellor } =
    state.lastElectedGovernment;
  const aliveCount = alivePlayers(state).length;

  const candidates = alivePlayers(state).filter((player) => {
    if (player.id === presidentId) return false;
    if (player.id === lastChancellor) return false;
    // With a small table the previous President becomes eligible again.
    if (aliveCount > PRESIDENT_TERM_LIMIT_ABOVE && player.id === lastPresident) return false;
    return true;
  });

  // Down to two survivors the term limit can lock out everyone. The table is
  // still owed a nomination, so the limit yields rather than the game stalling.
  if (candidates.length > 0) return candidates;
  return alivePlayers(state).filter((player) => player.id !== presidentId);
};

export const isVetoUnlocked = (state) =>
  state.boards[PARTIES.FASCIST].enacted >= VETO_UNLOCKS_AT;

/**
 * Legal targets for a power. The President is never one, Investigate Loyalty
 * may not be pointed at someone already investigated, and Radicalisation may
 * not be pointed at someone already converted.
 */
export const powerTargets = (state, power, presidentId) => {
  if (!POWER_INFO[power].needsTarget) return [];

  return alivePlayers(state).filter((player) => {
    if (player.id === presidentId) return false;
    // A player may only be investigated once per game.
    if (power === POWERS.INVESTIGATE_LOYALTY && player.investigatedBy.length > 0) return false;
    if (power === POWERS.RADICALISATION && player.hasBeenRadicalised) return false;
    return true;
  });
};

/** Legal targets for the power currently awaiting resolution. */
export const eligiblePowerTargets = (state) =>
  state.pendingPower
    ? powerTargets(state, state.pendingPower.power, state.pendingPower.presidentId)
    : [];

/* -------------------------------------------------------------------------- */
/* Turn-loop transitions                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Hand the presidency on and open nominations.
 *
 * @param {object} state
 * @param {null | {seatIndex: number, returnToIndex: number|null}} override
 *   Seats a specific player instead of advancing the rotation. `returnToIndex`
 *   is the seat the normal rotation resumes from once that term ends, which is
 *   what makes a Special Election a one-turn detour rather than a re-order.
 */
function beginNomination(state, override = null) {
  const { presidentIndex, returnToIndex } = state.rotation;

  // A pending return seat means last turn was a special election; resume there.
  const nextIndex = override
    ? override.seatIndex
    : nextAliveIndex(state.players, returnToIndex ?? presidentIndex);
  const nextReturn = override ? override.returnToIndex : null;
  const president = state.players[nextIndex];

  return log(
    {
      ...state,
      phase: PHASES.NOMINATION,
      rotation: {
        presidentIndex: nextIndex,
        returnToIndex: nextReturn,
        isSpecialElection: nextReturn !== null,
      },
      government: { presidentId: president.id, chancellorId: null, nomineeId: null },
      election: { ...state.election, votes: {}, ballotIndex: 0, result: null },
      legislative: { ...EMPTY_HAND },
      pendingPower: null,
      handoff: null,
    },
    `${president.name} is the Presidential Candidate.`,
  );
}

/**
 * @param {string[]} winners one party, or both of them — executing Hitler wins
 *   the game for the Liberals *and* the Communists when the expansion is on.
 */
function endGame(state, winners, reason) {
  const named = winners.map((party) => `${BOARDS[party].label}s`).join(' and the ');

  return log(
    {
      ...state,
      phase: PHASES.GAME_OVER,
      winners,
      winReason: reason,
      handoff: null,
      pendingPower: null,
    },
    reason === WIN_REASONS.HITLER_ELECTED
      ? 'Hitler was elected Chancellor. The Fascists win.'
      : reason === WIN_REASONS.HITLER_EXECUTED
        ? `Hitler is dead. The ${named} win.`
        : `The ${named} complete their agenda and win.`,
  );
}

/**
 * Put one policy on its track, then decide what happens next: a win, an
 * executive power, or the next nomination.
 *
 * @param {boolean} grantPowers false for policies enacted by chaos, which never
 *   grant a power.
 */
function enactPolicy(state, party, { grantPowers = true } = {}) {
  const board = state.boards[party];
  const enacted = board.enacted + 1;
  const next = log(
    {
      ...state,
      boards: { ...state.boards, [party]: { ...board, enacted } },
      election: { ...state.election, tracker: 0 },
    },
    `A ${BOARDS[party].label} policy is enacted (${enacted}/${BOARDS[party].slots}).`,
  );

  if (enacted >= BOARDS[party].winAt) {
    return endGame(next, [party], WIN_REASONS.POLICY_TRACK);
  }

  const power = grantPowers
    ? getBoardPowers(party, next.config.playerCount)[enacted]
    : undefined;
  if (!power) return beginNomination(next);

  return triggerPower(next, power);
}

/**
 * Move into EXECUTIVE_ACTION and hand the device to the sitting President.
 *
 * Policy Peek has nothing to choose, so its result is computed here and the
 * President's screen simply displays it. A targeted power with no legal target
 * left — every survivor already investigated, say — is skipped rather than
 * stranding the game in a phase nobody can leave.
 */
function triggerPower(state, power) {
  const presidentId = state.government.presidentId;

  if (POWER_INFO[power].needsTarget && powerTargets(state, power, presidentId).length === 0) {
    return beginNomination(
      log(state, `${POWER_INFO[power].label} has no legal target and is skipped.`),
    );
  }

  let announced = log(
    {
      ...state,
      phase: PHASES.EXECUTIVE_ACTION,
      pendingPower: { power, presidentId, targetId: null, result: null },
    },
    `${nameOf(state, presidentId)} must use ${POWER_INFO[power].label}.`,
  );

  if (power === POWERS.POLICY_PEEK) {
    const { peeked, deck, discard } = peekPolicies(announced.deck, announced.discard, 3);
    announced = {
      ...announced,
      deck,
      discard,
      pendingPower: { ...announced.pendingPower, result: { cards: peeked } },
    };
  }

  return handOffTo(announced, HANDOFF.EXECUTIVE_ACTION, presidentId, { power });
}

/** A failed third election: the country acts on its own. */
function resolveChaos(state) {
  const { drawn, deck, discard } = drawPolicies(state.deck, state.discard, 1);
  const chaos = log(
    { ...state, deck, discard, lastElectedGovernment: { presidentId: null, chancellorId: null } },
    'Three failed elections. The country is in chaos — the top policy is enacted.',
  );
  // Chaos also clears term limits, which beginNomination reads back.
  return enactPolicy(chaos, drawn[0], { grantPowers: false });
}

function failElection(state, reason) {
  const tracker = state.election.tracker + 1;
  const failed = log(
    { ...state, election: { ...state.election, tracker } },
    `${reason} Election tracker: ${tracker}/${CHAOS_AT}.`,
  );
  return tracker >= CHAOS_AT ? resolveChaos(failed) : beginNomination(failed);
}

/**
 * Count the ballots and stop.
 *
 * Secret Hitler reveals votes simultaneously, so the machine parks in
 * VOTE_REVEAL with the tally on `election.result` and waits. The table reads
 * the grid together and taps once; only then does RESOLVE_ELECTION run.
 */
function tallyElection(state) {
  const voters = alivePlayers(state);
  const ja = voters.filter((player) => state.election.votes[player.id] === VOTES.JA).length;
  const nein = voters.length - ja;
  const passed = ja > voters.length / 2;

  return log(
    {
      ...state,
      phase: PHASES.VOTE_REVEAL,
      handoff: null,
      election: { ...state.election, result: { passed, ja, nein } },
    },
    `Vote: ${ja} Ja / ${nein} Nein — ${passed ? 'the government is elected' : 'the government is rejected'}.`,
  );
}

/** Act on the tally the table has now seen. */
function resolveElection(state) {
  if (!state.election.result.passed) {
    return failElection(state, 'The government was rejected.');
  }

  const chancellor = getPlayer(state, state.government.nomineeId);

  // Fascists win outright if Hitler takes the chancellery late in the game.
  if (
    chancellor.role === ROLES.HITLER &&
    state.boards[PARTIES.FASCIST].enacted >= HITLER_CHANCELLOR_DANGER_AT
  ) {
    return endGame(state, [PARTIES.FASCIST], WIN_REASONS.HITLER_ELECTED);
  }

  const elected = {
    ...state,
    phase: PHASES.LEGISLATIVE_PRESIDENT,
    government: { ...state.government, chancellorId: chancellor.id, nomineeId: null },
    lastElectedGovernment: {
      presidentId: state.government.presidentId,
      chancellorId: chancellor.id,
    },
    election: { ...state.election, tracker: 0 },
  };

  // drawPolicies reshuffles the discard pile back in when the deck is short,
  // so the President is always dealt a full hand of three.
  const { drawn, deck, discard, reshuffled } = drawPolicies(elected.deck, elected.discard, 3);
  const dealt = log(
    {
      ...elected,
      deck,
      discard,
      legislative: {
        ...EMPTY_HAND,
        cards: drawn.map((party, index) => ({ id: `policy-${index}`, party })),
      },
    },
    `${nameOf(elected, elected.government.presidentId)} draws three policies${
      reshuffled ? ' (the discard pile was reshuffled back in)' : ''
    }.`,
  );

  return handOffTo(dealt, HANDOFF.PRESIDENT_LEGISLATIVE, dealt.government.presidentId);
}

/* -------------------------------------------------------------------------- */
/* Executive powers                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Apply a targeted power and record its outcome on `pendingPower.result`.
 *
 * Nothing here advances the turn: every power ends with END_EXECUTIVE_ACTION,
 * so the President (or, for Radicalisation, the target) gets to read the result
 * before the device moves on. The one exception is shooting Hitler, which ends
 * the game outright and has no result to read.
 */
function applyPower(state, power, targetId) {
  const presidentId = state.government.presidentId;
  const target = getPlayer(state, targetId);
  const settle = (next, result, patch = {}) => ({
    ...next,
    ...patch,
    pendingPower: { ...next.pendingPower, targetId, result },
  });

  switch (power) {
    case POWERS.INVESTIGATE_LOYALTY: {
      const marked = updatePlayer(state, targetId, {
        investigatedBy: [...target.investigatedBy, presidentId],
      });
      // Public: that an investigation happened. Private: what it found.
      const noted = log(marked, `${nameOf(state, presidentId)} investigated ${target.name}.`);
      return settle(noted, { party: target.party });
    }

    case POWERS.SPECIAL_ELECTION: {
      const seatIndex = state.players.findIndex((player) => player.id === targetId);
      const noted = log(
        state,
        `${nameOf(state, presidentId)} calls a Special Election: ${target.name} is the next Presidential Candidate.`,
      );
      // The seat change is applied by END_EXECUTIVE_ACTION, so the President can
      // read the confirmation first. Rotation resumes from the calling seat.
      return settle(noted, { seatIndex, returnToIndex: state.rotation.presidentIndex });
    }

    case POWERS.EXECUTION: {
      const killed = log(
        updatePlayer(state, targetId, { isAlive: false }),
        `${nameOf(state, presidentId)} executed ${target.name}.`,
      );
      if (target.role === ROLES.HITLER) {
        // XL: shooting Hitler is a joint Liberal and Communist victory.
        const winners = state.config.communistsEnabled
          ? [PARTIES.LIBERAL, PARTIES.COMMUNIST]
          : [PARTIES.LIBERAL];
        return endGame(killed, winners, WIN_REASONS.HITLER_EXECUTED);
      }
      return settle(killed, { wasHitler: false });
    }

    case POWERS.CONFESSION: {
      // Public by design: the whole table reads this off the screen.
      const confessed = log(
        updatePlayer(state, targetId, { isPartyPublic: true }),
        `Confession: ${target.name} is a ${BOARDS[target.party].label}.`,
      );
      return settle(confessed, { party: target.party });
    }

    case POWERS.RADICALISATION: {
      // Hitler cannot be converted, and only he is told that it failed — the
      // President never learns the outcome, which is what makes it a gamble.
      const immune = target.role === ROLES.HITLER;
      const converted = immune
        ? state
        : updatePlayer(state, targetId, {
            party: PARTIES.COMMUNIST,
            hasBeenRadicalised: true,
          });
      const noted = log(
        converted,
        `${nameOf(state, presidentId)} radicalised ${target.name}.`,
      );
      // The device goes to the target, not back to the table.
      return handOffTo(
        settle(noted, { succeeded: !immune }),
        HANDOFF.RADICALISATION,
        targetId,
        { power },
      );
    }

    default:
      return settle(state, {});
  }
}

/* -------------------------------------------------------------------------- */
/* Setup                                                                       */
/* -------------------------------------------------------------------------- */

function dealRoles(players, communistsEnabled, rng = Math.random) {
  const composition = getRoleComposition(players.length, communistsEnabled);
  const deck = shuffle(
    [
      ROLES.HITLER,
      ...Array(composition.fascists).fill(ROLES.FASCIST),
      ...Array(composition.communists).fill(ROLES.COMMUNIST),
      ...Array(Math.max(0, composition.liberals)).fill(ROLES.LIBERAL),
    ],
    rng,
  );

  return players.map((player, index) => ({
    ...player,
    role: deck[index],
    party: ROLE_PARTY[deck[index]],
  }));
}

function startGame(state) {
  const count = state.players.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) return state;

  const { communistsEnabled } = state.config;
  const players = dealRoles(state.players, communistsEnabled);

  const started = log(
    {
      ...state,
      players,
      deck: generateDeck(count, { communistsEnabled }),
      discard: [],
      config: { ...state.config, playerCount: count },
      log: [],
    },
    `A new game begins with ${count} players.`,
  );

  // Roles are revealed one player at a time; the phase holds at ROLE_REVEAL
  // until the last player has handed the device back.
  return handOffTo({ ...started, phase: PHASES.ROLE_REVEAL }, HANDOFF.ROLE_REVEAL, players[0].id);
}

/** Walk the role-reveal chain, then open the first nomination. */
function continueRoleReveal(state) {
  const seat = state.players.findIndex((player) => player.id === state.handoff.toPlayerId);
  const next = state.players[seat + 1];
  if (next) return handOffTo(state, HANDOFF.ROLE_REVEAL, next.id);

  return beginNomination({ ...state, handoff: null }, { seatIndex: 0, returnToIndex: null });
}

/* -------------------------------------------------------------------------- */
/* Reducer                                                                     */
/* -------------------------------------------------------------------------- */

export function gameReducer(state, action) {
  const payload = action.payload ?? {};

  switch (action.type) {
    /* ---- Setup --------------------------------------------------------- */

    case ACTIONS.ADD_PLAYER: {
      if (state.phase !== PHASES.SETUP || state.players.length >= MAX_PLAYERS) return state;
      const name = payload.name?.trim();
      if (!name) return state;
      return {
        ...state,
        players: [...state.players, createPlayer(name, state.players.length)],
      };
    }

    case ACTIONS.REMOVE_PLAYER: {
      if (state.phase !== PHASES.SETUP) return state;
      // Reseat so ids stay dense and seat order keeps matching the array index.
      const remaining = state.players
        .filter((player) => player.id !== payload.playerId)
        .map((player, index) => ({ ...player, id: `p${index}`, seat: index }));
      return { ...state, players: remaining };
    }

    case ACTIONS.RENAME_PLAYER: {
      if (state.phase !== PHASES.SETUP) return state;
      return updatePlayer(state, payload.playerId, { name: payload.name });
    }

    case ACTIONS.SET_EXPANSION: {
      if (state.phase !== PHASES.SETUP) return state;
      return { ...state, config: { ...state.config, communistsEnabled: payload.communistsEnabled } };
    }

    case ACTIONS.START_GAME:
      return state.phase === PHASES.SETUP && !state.handoff ? startGame(state) : state;

    /* ---- The pass-and-play overlay ------------------------------------- */

    case ACTIONS.REVEAL_HANDOFF:
      if (!state.handoff || state.handoff.revealed) return state;
      return { ...state, handoff: { ...state.handoff, revealed: true } };

    case ACTIONS.CONTINUE_HANDOFF: {
      // Only handoffs with no follow-up action of their own end here; a vote or
      // a discard closes its own overlay by dispatching the real action.
      if (!state.handoff?.revealed) return state;

      if (state.handoff.kind === HANDOFF.ROLE_REVEAL) return continueRoleReveal(state);

      return state;
    }

    /* ---- Nomination ---------------------------------------------------- */

    case ACTIONS.NOMINATE_CHANCELLOR: {
      if (state.phase !== PHASES.NOMINATION) return state;
      if (!eligibleChancellors(state).some((player) => player.id === payload.chancellorId)) return state;

      const nominated = log(
        {
          ...state,
          phase: PHASES.VOTING,
          government: { ...state.government, nomineeId: payload.chancellorId },
          election: { ...state.election, votes: {}, ballotIndex: 0, result: null },
        },
        `${nameOf(state, state.government.presidentId)} nominates ${nameOf(state, payload.chancellorId)} for Chancellor.`,
      );

      return handOffTo(nominated, HANDOFF.VOTE, alivePlayers(nominated)[0].id);
    }

    /* ---- Voting -------------------------------------------------------- */

    case ACTIONS.CAST_VOTE: {
      if (state.phase !== PHASES.VOTING || !state.handoff?.revealed) return state;

      const voters = alivePlayers(state);
      const voterId = state.handoff.toPlayerId;
      const ballotIndex = state.election.ballotIndex + 1;

      const recorded = {
        ...state,
        election: {
          ...state.election,
          votes: { ...state.election.votes, [voterId]: payload.vote },
          ballotIndex,
        },
      };

      const nextVoter = voters[ballotIndex];
      if (nextVoter) return handOffTo(recorded, HANDOFF.VOTE, nextVoter.id);

      return tallyElection({ ...recorded, handoff: null });
    }

    case ACTIONS.RESOLVE_ELECTION:
      if (state.phase !== PHASES.VOTE_REVEAL || !state.election.result) return state;
      return resolveElection(state);

    /* ---- Legislative session ------------------------------------------- */

    case ACTIONS.DISCARD_POLICY: {
      if (state.phase !== PHASES.LEGISLATIVE_PRESIDENT || !state.handoff?.revealed) return state;

      const { cards } = state.legislative;
      const binned = cards.find((card) => card.id === payload.policyId);
      if (!binned || cards.length !== 3) return state;

      const passed = log(
        {
          ...state,
          phase: PHASES.LEGISLATIVE_CHANCELLOR,
          discard: [...state.discard, binned.party],
          legislative: {
            ...state.legislative,
            // The same array carries on to the Chancellor, one card lighter.
            cards: cards.filter((card) => card.id !== binned.id),
            discarded: binned.party,
          },
        },
        `${nameOf(state, state.government.presidentId)} passes two policies to ${nameOf(state, state.government.chancellorId)}.`,
      );

      return handOffTo(passed, HANDOFF.CHANCELLOR_LEGISLATIVE, passed.government.chancellorId);
    }

    case ACTIONS.ENACT_POLICY: {
      if (state.phase !== PHASES.LEGISLATIVE_CHANCELLOR || !state.handoff?.revealed) return state;

      const { cards } = state.legislative;
      const chosen = cards.find((card) => card.id === payload.policyId);
      if (!chosen || cards.length !== 2) return state;

      const spent = {
        ...state,
        // The card not enacted is binned; the hand empties in the same step, so
        // no policy exists in two places at once.
        discard: [
          ...state.discard,
          ...cards.filter((card) => card.id !== chosen.id).map((card) => card.party),
        ],
        legislative: { ...EMPTY_HAND },
        handoff: null,
      };

      return enactPolicy(spent, chosen.party);
    }

    case ACTIONS.REQUEST_VETO: {
      if (state.phase !== PHASES.LEGISLATIVE_CHANCELLOR) return state;
      if (!isVetoUnlocked(state) || state.legislative.vetoRejected) return state;

      const requested = log(
        {
          ...state,
          phase: PHASES.VETO_PRESIDENT_CONSIDER,
          legislative: { ...state.legislative, vetoRequested: true },
        },
        `${nameOf(state, state.government.chancellorId)} moves to veto this agenda.`,
      );
      return handOffTo(requested, HANDOFF.VETO_CONSIDER, requested.government.presidentId);
    }

    case ACTIONS.ANSWER_VETO: {
      if (state.phase !== PHASES.VETO_PRESIDENT_CONSIDER || !state.handoff?.revealed) return state;

      if (!payload.accepted) {
        // The hand goes back untouched; the Chancellor must now enact, and the
        // veto button stays locked for the rest of this session.
        const refused = log(
          {
            ...state,
            phase: PHASES.LEGISLATIVE_CHANCELLOR,
            legislative: { ...state.legislative, vetoRequested: false, vetoRejected: true },
          },
          `${nameOf(state, state.government.presidentId)} refuses the veto — a policy must be enacted.`,
        );
        return handOffTo(refused, HANDOFF.CHANCELLOR_LEGISLATIVE, refused.government.chancellorId);
      }

      const vetoed = log(
        {
          ...state,
          discard: [...state.discard, ...state.legislative.cards.map((card) => card.party)],
          legislative: { ...EMPTY_HAND },
          handoff: null,
        },
        'The veto carries. The agenda is discarded.',
      );
      // A successful veto is a failed government: the tracker advances, and
      // reaching three triggers a chaos policy with no power attached.
      return failElection(vetoed, 'The government vetoed its own agenda.');
    }

    /* ---- Executive action ---------------------------------------------- */

    case ACTIONS.RESOLVE_POWER: {
      if (state.phase !== PHASES.EXECUTIVE_ACTION || !state.pendingPower) return state;
      // The President must be holding a revealed screen, and may only act once.
      if (!state.handoff?.revealed || state.pendingPower.result) return state;

      const { power } = state.pendingPower;
      if (!POWER_INFO[power].needsTarget) return state;
      if (!eligiblePowerTargets(state).some((player) => player.id === payload.targetId)) {
        return state;
      }

      return applyPower(state, power, payload.targetId);
    }

    case ACTIONS.END_EXECUTIVE_ACTION: {
      if (state.phase !== PHASES.EXECUTIVE_ACTION || !state.pendingPower) return state;
      // Nothing ends before its outcome exists, or before it has been read.
      if (!state.pendingPower.result || !state.handoff?.revealed) return state;

      const { power, result } = state.pendingPower;
      const cleared = { ...state, pendingPower: null, handoff: null };

      // A Special Election seats its target for one turn, then the rotation
      // resumes from the seat that called it.
      if (power === POWERS.SPECIAL_ELECTION) {
        return beginNomination(cleared, {
          seatIndex: result.seatIndex,
          returnToIndex: result.returnToIndex,
        });
      }

      return beginNomination(cleared);
    }

    /* ---- Lifecycle ------------------------------------------------------ */

    case ACTIONS.RESET_GAME:
      // The same people are usually still in the room, so the roster and the
      // expansion setting carry over by default; everything else is discarded.
      return createInitialState({
        names: payload.keepRoster === false ? [] : state.players.map((player) => player.name),
        communistsEnabled: state.config.communistsEnabled,
      });

    default:
      return state;
  }
}

export default gameReducer;
