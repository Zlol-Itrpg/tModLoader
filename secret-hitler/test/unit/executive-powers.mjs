import { createInitialState } from '../../src/game/initialState.js';
import { gameReducer, actions, alivePlayers, eligibleChancellors, powerTargets } from '../../src/game/reducer.js';
import { PHASES, PARTIES, POWERS, ROLES, VOTES, HANDOFF, WIN_REASONS } from '../../src/game/constants.js';
import { getBoardPowers } from '../../src/game/config.js';

const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const names = (n) => Array.from({ length: n }, (_, i) => `P${i}`);

function dealt(n = 9, communistsEnabled = true) {
  let s = createInitialState({ names: names(n), communistsEnabled });
  s = gameReducer(s, actions.startGame());
  for (let i = 0; i < n; i++) { s = gameReducer(s, actions.revealHandoff()); s = gameReducer(s, actions.continueHandoff()); }
  return s;
}
/** Put a specific power on the table with the President holding a revealed screen. */
function armed(s, power) {
  // Seat a President who is not Hitler, so Hitler is always a legal target.
  const presidentId = s.players.find((p) => p.role !== ROLES.HITLER).id;
  return {
    ...s,
    phase: PHASES.EXECUTIVE_ACTION,
    government: { ...s.government, presidentId },
    pendingPower: { power, presidentId, targetId: null, result: null },
    handoff: { kind: HANDOFF.EXECUTIVE_ACTION, toPlayerId: presidentId, revealed: true, payload: { power } },
  };
}
const totalCards = (s) => s.deck.length + s.discard.length + s.legislative.cards.length
  + Object.values(s.boards).reduce((a, b) => a + b.enacted, 0);

/* ---- Schedule wiring ---------------------------------------------------- */
{
  for (const [n, expect] of [
    [4, { 3: POWERS.POLICY_PEEK, 4: POWERS.EXECUTION, 5: POWERS.EXECUTION }],
    [6, { 3: POWERS.POLICY_PEEK, 4: POWERS.EXECUTION, 5: POWERS.EXECUTION }],
    [7, { 2: POWERS.INVESTIGATE_LOYALTY, 3: POWERS.SPECIAL_ELECTION, 4: POWERS.EXECUTION, 5: POWERS.EXECUTION }],
    [9, { 1: POWERS.INVESTIGATE_LOYALTY, 2: POWERS.INVESTIGATE_LOYALTY, 3: POWERS.SPECIAL_ELECTION, 4: POWERS.EXECUTION, 5: POWERS.EXECUTION }],
    [20, { 1: POWERS.INVESTIGATE_LOYALTY, 2: POWERS.INVESTIGATE_LOYALTY, 3: POWERS.SPECIAL_ELECTION, 4: POWERS.EXECUTION, 5: POWERS.EXECUTION }],
  ]) {
    check(`schedule: fascist track at ${n} players`,
      JSON.stringify(getBoardPowers(PARTIES.FASCIST, n)) === JSON.stringify(expect));
  }
  check('schedule: communist track does not scale',
    [4, 9, 20].every((n) => JSON.stringify(getBoardPowers(PARTIES.COMMUNIST, n)) ===
      JSON.stringify({ 1: POWERS.CONFESSION, 2: POWERS.CONFESSION, 3: POWERS.RADICALISATION })));
  check('schedule: liberal track grants nothing',
    Object.keys(getBoardPowers(PARTIES.LIBERAL, 9)).length === 0);

  // The schedule follows the size the game *started* at, not the survivors.
  let s = dealt(9);
  s = { ...s, players: s.players.map((p, i) => (i > 4 ? { ...p, isAlive: false } : p)) };
  check('schedule: executions do not re-tune the board',
    getBoardPowers(PARTIES.FASCIST, s.config.playerCount)[1] === POWERS.INVESTIGATE_LOYALTY);
}

/* ---- Policy Peek -------------------------------------------------------- */
{
  let s = dealt(6);
  const before = totalCards(s);
  const top3 = s.deck.slice(0, 3);
  s = gameReducer(armed(s, POWERS.POLICY_PEEK), { type: 'noop' });
  // Peek is pre-resolved at trigger time, so arm it through the real path.
  let t = dealt(6);
  t = { ...t, boards: { ...t.boards, [PARTIES.FASCIST]: { ...t.boards[PARTIES.FASCIST], enacted: 2 } } };
  const topOf = t.deck.slice(0, 3);
  t = {
    ...t, phase: PHASES.LEGISLATIVE_CHANCELLOR,
    government: { ...t.government, presidentId: t.players[0].id, chancellorId: t.players[1].id },
    legislative: { cards: [{ id: 'a', party: PARTIES.FASCIST }, { id: 'b', party: PARTIES.LIBERAL }], discarded: null, vetoRequested: false, vetoRejected: false },
    handoff: { kind: HANDOFF.CHANCELLOR_LEGISLATIVE, toPlayerId: t.players[1].id, revealed: true, payload: {} },
  };
  const cardsBefore = totalCards(t);
  t = gameReducer(t, actions.enactPolicy('a'));
  check('peek: third fascist policy at 6 players triggers Policy Peek',
    t.phase === PHASES.EXECUTIVE_ACTION && t.pendingPower.power === POWERS.POLICY_PEEK);
  check('peek: cards are ready before the President even reveals', t.pendingPower.result.cards.length === 3);
  check('peek: shows the true top of the deck',
    t.pendingPower.result.cards.join() === t.deck.slice(0, 3).join());
  check('peek: does not consume the cards', totalCards(t) === cardsBefore);
  check('peek: cannot end before it is read', gameReducer(t, actions.endExecutiveAction()) === t);
  t = gameReducer(t, actions.revealHandoff());
  const peeked = t.pendingPower.result.cards.join();
  t = gameReducer(t, actions.endExecutiveAction());
  check('peek: acknowledging returns to NOMINATION', t.phase === PHASES.NOMINATION);
  check('peek: deck order preserved after the turn', t.deck.slice(0, 3).join() === peeked);
  check('peek: pendingPower cleared', t.pendingPower === null);
}

/* ---- Investigate Loyalty ------------------------------------------------ */
{
  let s = armed(dealt(9), POWERS.INVESTIGATE_LOYALTY);
  const president = s.players.find((p) => p.id === s.government.presidentId);
  check('investigate: President is not a legal target',
    !powerTargets(s, POWERS.INVESTIGATE_LOYALTY, president.id).some((p) => p.id === president.id));
  const target = powerTargets(s, POWERS.INVESTIGATE_LOYALTY, president.id)[0];
  s = gameReducer(s, actions.resolvePower(target.id));
  check('investigate: reports the party membership', s.pendingPower.result.party === target.party);
  check('investigate: reports a party, never a role',
    Object.values(PARTIES).includes(s.pendingPower.result.party) && !('role' in s.pendingPower.result));
  check('investigate: Hitler would read as Fascist',
    s.players.find((p) => p.role === ROLES.HITLER).party === PARTIES.FASCIST);
  check('investigate: target marked, so nobody is investigated twice',
    !powerTargets(s, POWERS.INVESTIGATE_LOYALTY, president.id).some((p) => p.id === target.id));
  check('investigate: a second resolve is ignored', gameReducer(s, actions.resolvePower(
    powerTargets(s, POWERS.INVESTIGATE_LOYALTY, president.id)[0].id)) === s);
  s = gameReducer(s, actions.endExecutiveAction());
  check('investigate: ends to NOMINATION', s.phase === PHASES.NOMINATION && s.pendingPower === null);
}

/* ---- Investigate with no legal targets left ----------------------------- */
{
  let s = dealt(9);
  s = { ...s, players: s.players.map((p, i) => (i === 0 ? p : { ...p, investigatedBy: ['p0'] })) };
  s = { ...s, boards: { ...s.boards, [PARTIES.FASCIST]: { ...s.boards[PARTIES.FASCIST], enacted: 0 } },
    government: { presidentId: s.players[0].id, chancellorId: s.players[1].id, nomineeId: null },
    phase: PHASES.LEGISLATIVE_CHANCELLOR,
    legislative: { cards: [{ id: 'a', party: PARTIES.FASCIST }, { id: 'b', party: PARTIES.LIBERAL }], discarded: null, vetoRequested: false, vetoRejected: false },
    handoff: { kind: HANDOFF.CHANCELLOR_LEGISLATIVE, toPlayerId: s.players[1].id, revealed: true, payload: {} } };
  s = gameReducer(s, actions.enactPolicy('a'));
  check('dead end: a power with no legal target is skipped, not stranded',
    s.phase === PHASES.NOMINATION && s.pendingPower === null);
  check('dead end: the skip is announced', s.log.some((e) => e.text.includes('no legal target')));
}

/* ---- Special Election --------------------------------------------------- */
{
  let s = armed(dealt(9), POWERS.SPECIAL_ELECTION);
  const presidentSeat = s.players.findIndex((p) => p.id === s.government.presidentId);
  s = { ...s, rotation: { presidentIndex: presidentSeat, returnToIndex: null, isSpecialElection: false } };
  const targetSeat = (presidentSeat + 4) % s.players.length;
  const target = s.players[targetSeat];
  const sittingPresident = s.government.presidentId;
  s = gameReducer(s, actions.resolvePower(target.id));
  check('special election: seat recorded, not yet applied',
    s.pendingPower.result.seatIndex === targetSeat && s.government.presidentId === sittingPresident);
  s = gameReducer(s, actions.endExecutiveAction());
  check('special election: target now holds the presidency', s.government.presidentId === target.id);
  check('special election: flagged as a detour', s.rotation.isSpecialElection === true);
  check('special election: return seat cached', s.rotation.returnToIndex === presidentSeat);

  // Play the detour turn out; the rotation must resume from seat 1.
  s = gameReducer(s, actions.nominateChancellor(eligibleChancellors(s)[0].id));
  for (let i = 0; i < alivePlayers(s).length; i++) {
    s = gameReducer(s, actions.revealHandoff());
    s = gameReducer(s, actions.castVote(VOTES.NEIN));
  }
  s = gameReducer(s, actions.resolveElection());
  check('special election: rotation resumes from the calling seat',
    s.government.presidentId === s.players[(presidentSeat + 1) % s.players.length].id &&
    s.rotation.isSpecialElection === false);
}

/* ---- Execution ---------------------------------------------------------- */
{
  let s = armed(dealt(9), POWERS.EXECUTION);
  const president = s.players.find((p) => p.id === s.government.presidentId);
  const victim = s.players.find((p) => p.id !== president.id && p.role !== ROLES.HITLER);
  const aliveBefore = alivePlayers(s).length;
  const t = gameReducer(s, actions.resolvePower(victim.id));
  check('execution: target is dead', t.players.find((p) => p.id === victim.id).isAlive === false);
  check('execution: one fewer at the table', alivePlayers(t).length === aliveBefore - 1);
  check('execution: game continues', t.phase === PHASES.EXECUTIVE_ACTION && t.winners === null);
  check('execution: role stays secret', t.pendingPower.result.wasHitler === false);
  const ended = gameReducer(t, actions.endExecutiveAction());
  check('execution: ends to NOMINATION', ended.phase === PHASES.NOMINATION);
  check('execution: a corpse is never the next President',
    ended.players.find((p) => p.id === ended.government.presidentId).isAlive);

  // Shooting Hitler, expansion on: joint victory, no acknowledgement needed.
  const hitler = s.players.find((p) => p.role === ROLES.HITLER);
  const shot = gameReducer(s, actions.resolvePower(hitler.id));
  check('execution: shooting Hitler ends the game at once', shot.phase === PHASES.GAME_OVER);
  check('execution: reason recorded', shot.winReason === WIN_REASONS.HITLER_EXECUTED);
  check('execution: Liberals AND Communists win together',
    shot.winners.length === 2 && shot.winners.includes(PARTIES.LIBERAL) && shot.winners.includes(PARTIES.COMMUNIST));
  check('execution: the joint win is in the public log',
    shot.log.at(-1).text.includes('Liberals and the Communists'));

  // Expansion off: Liberals alone.
  let base = armed(dealt(9, false), POWERS.EXECUTION);
  const baseHitler = base.players.find((p) => p.role === ROLES.HITLER);
  const shotBase = gameReducer(base, actions.resolvePower(baseHitler.id));
  check('execution: without the expansion only the Liberals win',
    shotBase.winners.length === 1 && shotBase.winners[0] === PARTIES.LIBERAL);
}

/* ---- Confession --------------------------------------------------------- */
{
  let s = armed(dealt(9), POWERS.CONFESSION);
  const target = powerTargets(s, POWERS.CONFESSION, s.government.presidentId)[0];
  s = gameReducer(s, actions.resolvePower(target.id));
  check('confession: reports the party', s.pendingPower.result.party === target.party);
  check('confession: membership is now public',
    s.players.find((p) => p.id === target.id).isPartyPublic === true);
  check('confession: it is announced to everyone', s.log.some((e) => e.text.startsWith('Confession:')));
  check('confession: the device stays with the President — it is public',
    s.handoff.toPlayerId === s.government.presidentId);
  s = gameReducer(s, actions.endExecutiveAction());
  check('confession: ends to NOMINATION', s.phase === PHASES.NOMINATION);
  check('confession: stays public afterwards',
    s.players.find((p) => p.id === target.id).isPartyPublic === true);
}

/* ---- Radicalisation ----------------------------------------------------- */
{
  let s = armed(dealt(9), POWERS.RADICALISATION);
  const president = s.government.presidentId;
  const victim = s.players.find((p) => p.id !== president && p.role !== ROLES.HITLER);
  let t = gameReducer(s, actions.resolvePower(victim.id));
  check('radicalisation: party flipped to Communist',
    t.players.find((p) => p.id === victim.id).party === PARTIES.COMMUNIST);
  check('radicalisation: secret role untouched',
    t.players.find((p) => p.id === victim.id).role === victim.role);
  check('radicalisation: device goes to the TARGET, not back to the table',
    t.handoff.kind === HANDOFF.RADICALISATION && t.handoff.toPlayerId === victim.id);
  check('radicalisation: target must reveal before it can end',
    gameReducer(t, actions.endExecutiveAction()) === t);
  check('radicalisation: result says it worked', t.pendingPower.result.succeeded === true);
  t = gameReducer(t, actions.revealHandoff());
  t = gameReducer(t, actions.endExecutiveAction());
  check('radicalisation: target acknowledging returns to NOMINATION', t.phase === PHASES.NOMINATION);
  check('radicalisation: nobody may be converted twice',
    !powerTargets(t, POWERS.RADICALISATION, president).some((p) => p.id === victim.id));

  // Hitler is immune, and only he is told.
  const hitler = s.players.find((p) => p.role === ROLES.HITLER);
  let h = gameReducer(s, actions.resolvePower(hitler.id));
  check('radicalisation: Hitler keeps his Fascist card',
    h.players.find((p) => p.id === hitler.id).party === PARTIES.FASCIST);
  check('radicalisation: Hitler is not flagged as converted',
    h.players.find((p) => p.id === hitler.id).hasBeenRadicalised === false);
  check('radicalisation: the failure is reported only to him',
    h.pendingPower.result.succeeded === false && h.handoff.toPlayerId === hitler.id);
  check('radicalisation: the public log does not say it failed',
    h.log.at(-1).text.includes('radicalised') && !h.log.at(-1).text.toLowerCase().includes('fail'));
  h = gameReducer(h, actions.revealHandoff());
  h = gameReducer(h, actions.endExecutiveAction());
  check('radicalisation: Hitler acknowledging still ends the turn', h.phase === PHASES.NOMINATION);
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nall executive power checks passed');
