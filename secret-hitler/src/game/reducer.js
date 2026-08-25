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
  PRESIDENT_DISCARD: 'PRESIDENT_DISCARD',
  CHANCELLOR_ENACT: 'CHANCELLOR_ENACT',
  REQUEST_VETO: 'REQUEST_VETO',
  ANSWER_VETO: 'ANSWER_VETO',
  RESOLVE_POWER: 'RESOLVE_POWER',

  RESET_GAME: 'RESET_GAME',
};

export const actions = {
  addPlayer: (name) => ({ type: ACTIONS.ADD_PLAYER, name }),
  removePlayer: (playerId) => ({ type: ACTIONS.REMOVE_PLAYER, playerId }),
  renamePlayer: (playerId, name) => ({ type: ACTIONS.RENAME_PLAYER, playerId, name }),
  setExpansion: (communistsEnabled) => ({ type: ACTIONS.SET_EXPANSION, communistsEnabled }),
  startGame: () => ({ type: ACTIONS.START_GAME }),

  revealHandoff: () => ({ type: ACTIONS.REVEAL_HANDOFF }),
  continueHandoff: () => ({ type: ACTIONS.CONTINUE_HANDOFF }),

  nominateChancellor: (playerId) => ({ type: ACTIONS.NOMINATE_CHANCELLOR, playerId }),
  castVote: (vote) => ({ type: ACTIONS.CAST_VOTE, vote }),
  presidentDiscard: (index) => ({ type: ACTIONS.PRESIDENT_DISCARD, index }),
  chancellorEnact: (index) => ({ type: ACTIONS.CHANCELLOR_ENACT, index }),
  requestVeto: () => ({ type: ACTIONS.REQUEST_VETO }),
  answerVeto: (accepted) => ({ type: ACTIONS.ANSWER_VETO, accepted }),
  resolvePower: (targetId = null) => ({ type: ACTIONS.RESOLVE_POWER, targetId }),
  resetGame: () => ({ type: ACTIONS.RESET_GAME }),
};

/* -------------------------------------------------------------------------- */
/* Small pure helpers                                                          */
/* -------------------------------------------------------------------------- */

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
 * Legal targets for the power currently awaiting resolution.
 * The President is never a legal target, and Investigate Loyalty may not be
 * pointed at someone who has already been investigated this game.
 */
export const eligiblePowerTargets = (state) => {
  if (!state.pendingPower) return [];
  const { power, presidentId } = state.pendingPower;
  if (!POWER_INFO[power].needsTarget) return [];

  return alivePlayers(state).filter((player) => {
    if (player.id === presidentId) return false;
    if (power === POWERS.INVESTIGATE_LOYALTY && player.investigatedBy.length > 0) return false;
    if (power === POWERS.RADICALISATION && player.hasBeenRadicalised) return false;
    return true;
  });
};

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
      legislative: { drawn: [], chancellorHand: [], discarded: null, vetoRequested: false },
      pendingPower: null,
      handoff: null,
    },
    `${president.name} is the Presidential Candidate.`,
  );
}

function endGame(state, winner, reason) {
  return log(
    { ...state, phase: PHASES.GAME_OVER, winner, winReason: reason, handoff: null, pendingPower: null },
    reason === WIN_REASONS.HITLER_ELECTED
      ? 'Hitler was elected Chancellor. The Fascists win.'
      : reason === WIN_REASONS.HITLER_EXECUTED
        ? 'Hitler is dead. The Liberals win.'
        : `${BOARDS[winner].label}s complete their agenda and win.`,
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
    return endGame(next, party, WIN_REASONS.POLICY_TRACK);
  }

  const power = grantPowers ? BOARDS[party].powers[enacted] : undefined;
  if (!power) return beginNomination(next);

  return triggerPower(next, power);
}

/** Move into EXECUTIVE_ACTION and hand the device to the sitting President. */
function triggerPower(state, power) {
  const presidentId = state.government.presidentId;
  const withPower = log(
    { ...state, phase: PHASES.EXECUTIVE_ACTION, pendingPower: { power, presidentId, targetId: null } },
    `${nameOf(state, presidentId)} must use ${POWER_INFO[power].label}.`,
  );

  // Targetless powers still need a private screen for their result.
  return handOffTo(withPower, HANDOFF.EXECUTIVE_ACTION, presidentId, { power });
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
    { ...state, election: { ...state.election, tracker, result: 'FAILED' } },
    `${reason} Election tracker: ${tracker}/${CHAOS_AT}.`,
  );
  return tracker >= CHAOS_AT ? resolveChaos(failed) : beginNomination(failed);
}

/** Tally the secret ballot once every living player has voted. */
function resolveElection(state) {
  const voters = alivePlayers(state);
  const ja = voters.filter((player) => state.election.votes[player.id] === VOTES.JA).length;
  const passed = ja > voters.length / 2;

  const tallied = log(
    state,
    `Vote: ${ja} Ja / ${voters.length - ja} Nein — ${passed ? 'the government is elected' : 'the government is rejected'}.`,
  );

  if (!passed) return failElection(tallied, 'The government was rejected.');

  const chancellor = getPlayer(state, state.government.nomineeId);

  // Fascists win outright if Hitler takes the chancellery late in the game.
  if (
    chancellor.role === ROLES.HITLER &&
    state.boards[PARTIES.FASCIST].enacted >= HITLER_CHANCELLOR_DANGER_AT
  ) {
    return endGame(tallied, PARTIES.FASCIST, WIN_REASONS.HITLER_ELECTED);
  }

  const elected = {
    ...tallied,
    phase: PHASES.LEGISLATIVE_PRESIDENT,
    government: { ...tallied.government, chancellorId: chancellor.id, nomineeId: null },
    lastElectedGovernment: {
      presidentId: tallied.government.presidentId,
      chancellorId: chancellor.id,
    },
    election: { ...tallied.election, result: 'PASSED', tracker: 0 },
  };

  const { drawn, deck, discard } = drawPolicies(elected.deck, elected.discard, 3);
  const dealt = log(
    { ...elected, deck, discard, legislative: { ...elected.legislative, drawn } },
    `${nameOf(elected, elected.government.presidentId)} draws three policies.`,
  );

  return handOffTo(dealt, HANDOFF.PRESIDENT_LEGISLATIVE, dealt.government.presidentId);
}

/* -------------------------------------------------------------------------- */
/* Executive powers                                                            */
/* -------------------------------------------------------------------------- */

function applyPower(state, power, targetId) {
  const presidentId = state.government.presidentId;

  switch (power) {
    case POWERS.INVESTIGATE_LOYALTY: {
      const target = getPlayer(state, targetId);
      const marked = updatePlayer(state, targetId, {
        investigatedBy: [...target.investigatedBy, presidentId],
      });
      const noted = log(
        marked,
        `${nameOf(state, presidentId)} investigated ${target.name}.`,
      );
      // The card itself is private — only the President sees it.
      return handOffTo(noted, HANDOFF.POWER_RESULT, presidentId, {
        power,
        targetId,
        party: target.party,
      });
    }

    case POWERS.POLICY_PEEK: {
      const { peeked, deck, discard } = peekPolicies(state.deck, state.discard, 3);
      const noted = log(
        { ...state, deck, discard },
        `${nameOf(state, presidentId)} peeked at the top three policies.`,
      );
      return handOffTo(noted, HANDOFF.POWER_RESULT, presidentId, { power, cards: peeked });
    }

    case POWERS.SPECIAL_ELECTION: {
      const targetIndex = state.players.findIndex((player) => player.id === targetId);
      const called = log(
        state,
        `${nameOf(state, presidentId)} calls a Special Election: ${nameOf(state, targetId)} is the next Presidential Candidate.`,
      );
      return beginNomination({ ...called, pendingPower: null, handoff: null }, {
        seatIndex: targetIndex,
        returnToIndex: state.rotation.presidentIndex,
      });
    }

    case POWERS.EXECUTION: {
      const target = getPlayer(state, targetId);
      const killed = log(
        updatePlayer(state, targetId, { isAlive: false }),
        `${nameOf(state, presidentId)} executed ${target.name}.`,
      );
      if (target.role === ROLES.HITLER) {
        return endGame(killed, PARTIES.LIBERAL, WIN_REASONS.HITLER_EXECUTED);
      }
      return beginNomination({ ...killed, pendingPower: null, handoff: null });
    }

    /* ---- Communist powers (XL) ------------------------------------------ */

    case POWERS.CONFESSION: {
      // Public by design: the whole table sees the card, so no interstitial.
      const target = getPlayer(state, targetId);
      const confessed = log(
        updatePlayer(state, targetId, { isPartyPublic: true }),
        `Confession: ${target.name} is a ${BOARDS[target.party].label}.`,
      );
      return beginNomination({ ...confessed, pendingPower: null, handoff: null });
    }

    case POWERS.RADICALISATION: {
      // TODO(xl): confirm the canonical Hitler-immunity reveal — right now the
      // attempt fails silently to the table and only the President is told.
      const target = getPlayer(state, targetId);
      const immune = target.role === ROLES.HITLER;
      const converted = immune
        ? state
        : updatePlayer(state, targetId, {
            party: PARTIES.COMMUNIST,
            hasBeenRadicalised: true,
          });
      const noted = log(
        converted,
        `${nameOf(state, presidentId)} attempted to radicalise ${target.name}.`,
      );
      return handOffTo(noted, HANDOFF.POWER_RESULT, presidentId, {
        power,
        targetId,
        succeeded: !immune,
      });
    }

    case POWERS.CONGRESS: {
      // TODO(xl): walk the device through every living Communist so each one
      // privately sees the updated cell, including anyone radicalised since.
      const noted = log(state, 'Congress: the Communists reconvene and identify each other.');
      return beginNomination({ ...noted, pendingPower: null, handoff: null });
    }

    default:
      return beginNomination({ ...state, pendingPower: null, handoff: null });
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
  switch (action.type) {
    /* ---- Setup --------------------------------------------------------- */

    case ACTIONS.ADD_PLAYER: {
      if (state.phase !== PHASES.SETUP || state.players.length >= MAX_PLAYERS) return state;
      const name = action.name?.trim();
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
        .filter((player) => player.id !== action.playerId)
        .map((player, index) => ({ ...player, id: `p${index}`, seat: index }));
      return { ...state, players: remaining };
    }

    case ACTIONS.RENAME_PLAYER: {
      if (state.phase !== PHASES.SETUP) return state;
      return updatePlayer(state, action.playerId, { name: action.name });
    }

    case ACTIONS.SET_EXPANSION: {
      if (state.phase !== PHASES.SETUP) return state;
      return { ...state, config: { ...state.config, communistsEnabled: action.communistsEnabled } };
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

      if (state.handoff.kind === HANDOFF.POWER_RESULT) {
        return beginNomination({ ...state, pendingPower: null, handoff: null });
      }

      return state;
    }

    /* ---- Nomination ---------------------------------------------------- */

    case ACTIONS.NOMINATE_CHANCELLOR: {
      if (state.phase !== PHASES.NOMINATION) return state;
      if (!eligibleChancellors(state).some((player) => player.id === action.playerId)) return state;

      const nominated = log(
        {
          ...state,
          phase: PHASES.VOTING,
          government: { ...state.government, nomineeId: action.playerId },
          election: { ...state.election, votes: {}, ballotIndex: 0, result: null },
        },
        `${nameOf(state, state.government.presidentId)} nominates ${nameOf(state, action.playerId)} for Chancellor.`,
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
          votes: { ...state.election.votes, [voterId]: action.vote },
          ballotIndex,
        },
      };

      const nextVoter = voters[ballotIndex];
      if (nextVoter) return handOffTo(recorded, HANDOFF.VOTE, nextVoter.id);

      return resolveElection({ ...recorded, handoff: null });
    }

    /* ---- Legislative session ------------------------------------------- */

    case ACTIONS.PRESIDENT_DISCARD: {
      if (state.phase !== PHASES.LEGISLATIVE_PRESIDENT || !state.handoff?.revealed) return state;

      const { drawn } = state.legislative;
      const discarded = drawn[action.index];
      if (!discarded) return state;

      const passed = log(
        {
          ...state,
          phase: PHASES.LEGISLATIVE_CHANCELLOR,
          discard: [...state.discard, discarded],
          legislative: {
            ...state.legislative,
            drawn: [],
            discarded,
            chancellorHand: drawn.filter((_, index) => index !== action.index),
          },
        },
        `${nameOf(state, state.government.presidentId)} passes two policies to ${nameOf(state, state.government.chancellorId)}.`,
      );

      return handOffTo(passed, HANDOFF.CHANCELLOR_LEGISLATIVE, passed.government.chancellorId);
    }

    case ACTIONS.CHANCELLOR_ENACT: {
      if (state.phase !== PHASES.LEGISLATIVE_CHANCELLOR || !state.handoff?.revealed) return state;

      const { chancellorHand } = state.legislative;
      const enacted = chancellorHand[action.index];
      if (!enacted) return state;

      const spent = {
        ...state,
        discard: [...state.discard, ...chancellorHand.filter((_, i) => i !== action.index)],
        legislative: { drawn: [], chancellorHand: [], discarded: null, vetoRequested: false },
        handoff: null,
      };

      return enactPolicy(spent, enacted);
    }

    case ACTIONS.REQUEST_VETO: {
      if (state.phase !== PHASES.LEGISLATIVE_CHANCELLOR || !isVetoUnlocked(state)) return state;
      const requested = log(
        { ...state, legislative: { ...state.legislative, vetoRequested: true } },
        `${nameOf(state, state.government.chancellorId)} moves to veto this agenda.`,
      );
      return handOffTo(requested, HANDOFF.PRESIDENT_LEGISLATIVE, requested.government.presidentId, {
        vetoVote: true,
      });
    }

    case ACTIONS.ANSWER_VETO: {
      if (!state.legislative.vetoRequested) return state;

      if (!action.accepted) {
        const refused = log(
          { ...state, legislative: { ...state.legislative, vetoRequested: false } },
          `${nameOf(state, state.government.presidentId)} refuses the veto — a policy must be enacted.`,
        );
        return handOffTo(refused, HANDOFF.CHANCELLOR_LEGISLATIVE, refused.government.chancellorId);
      }

      const vetoed = log(
        {
          ...state,
          discard: [...state.discard, ...state.legislative.chancellorHand],
          legislative: { drawn: [], chancellorHand: [], discarded: null, vetoRequested: false },
          handoff: null,
        },
        'The veto carries. The agenda is discarded.',
      );
      return failElection(vetoed, 'The government vetoed its own agenda.');
    }

    /* ---- Executive action ---------------------------------------------- */

    case ACTIONS.RESOLVE_POWER: {
      if (state.phase !== PHASES.EXECUTIVE_ACTION || !state.pendingPower) return state;
      if (!state.handoff?.revealed) return state;

      const { power } = state.pendingPower;

      if (
        POWER_INFO[power].needsTarget &&
        !eligiblePowerTargets(state).some((player) => player.id === action.targetId)
      ) {
        return state;
      }

      return applyPower(state, power, action.targetId);
    }

    /* ---- Lifecycle ------------------------------------------------------ */

    case ACTIONS.RESET_GAME:
      return createInitialState({
        names: state.players.map((player) => player.name),
        communistsEnabled: state.config.communistsEnabled,
      });

    default:
      return state;
  }
}

export default gameReducer;
