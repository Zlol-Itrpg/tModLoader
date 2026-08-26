import { createInitialState } from '../../src/game/initialState.js';
import { gameReducer, actions, alivePlayers, eligibleChancellors } from '../../src/game/reducer.js';
import { PHASES, PARTIES, ROLES, VOTES, HANDOFF, WIN_REASONS } from '../../src/game/constants.js';

const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

function dealt() {
  let s = gameReducer(createInitialState({ names: NAMES }), actions.startGame());
  for (let i = 0; i < NAMES.length; i++) {
    s = gameReducer(s, actions.revealHandoff());
    s = gameReducer(s, actions.continueHandoff());
  }
  return s;
}
/** Elect a government unanimously and land on LEGISLATIVE_PRESIDENT. */
function elect(s) {
  // Never seat Hitler here: past three fascist policies that ends the game
  // before a hand is ever dealt, which is a different test.
  const options = eligibleChancellors(s);
  const pick = options.find((p) => p.role !== ROLES.HITLER) ?? options[0];
  s = gameReducer(s, actions.nominateChancellor(pick.id));
  for (let i = 0; i < alivePlayers(s).length; i++) {
    s = gameReducer(s, actions.revealHandoff());
    s = gameReducer(s, actions.castVote(VOTES.JA));
  }
  return gameReducer(s, actions.resolveElection());
}
const total = (s) => s.deck.length + s.discard.length + s.legislative.cards.length
  + Object.values(s.boards).reduce((a, b) => a + b.enacted, 0);

/* ---- 1. Draw guard: reshuffle on entry to LEGISLATIVE_PRESIDENT --------- */
{
  let s = dealt();
  const cards = total(s);
  s = { ...s, deck: [PARTIES.LIBERAL, PARTIES.FASCIST], discard: Array(cards - 2).fill(PARTIES.COMMUNIST) };
  check('draw guard: deck starts short (2 cards)', s.deck.length === 2);
  s = elect(s);
  check('draw guard: President still got three', s.legislative.cards.length === 3);
  check('draw guard: discard pile was consumed', s.discard.length === 0);
  check('draw guard: deck refilled from the discards', s.deck.length === cards - 3);
  check('draw guard: no cards conjured or lost', total(s) === cards);
  check('draw guard: the reshuffle is announced in the public log',
    s.log.some((e) => e.text.includes('reshuffled back in')));
}

/* ---- 2. Card conservation through the hand ------------------------------ */
{
  let s = elect(dealt());
  const cards = total(s);
  const hand = s.legislative.cards.map((c) => c.party);
  check('hand: three distinct ids', new Set(s.legislative.cards.map((c) => c.id)).size === 3);

  s = gameReducer(s, actions.revealHandoff());
  const binned = s.legislative.cards[1];
  s = gameReducer(s, actions.discardPolicy(binned.id));
  check('discard: hand down to two', s.legislative.cards.length === 2);
  check('discard: the binned card reached the discard pile',
    s.discard.filter((p) => p === binned.party).length === 1);
  check('discard: the other two are untouched',
    s.legislative.cards.map((c) => c.party).join() === hand.filter((_, i) => i !== 1).join());
  check('discard: conservation holds', total(s) === cards);
  check('discard: handed to the Chancellor',
    s.phase === PHASES.LEGISLATIVE_CHANCELLOR &&
    s.handoff.kind === HANDOFF.CHANCELLOR_LEGISLATIVE &&
    s.handoff.toPlayerId === s.government.chancellorId &&
    s.handoff.revealed === false);

  // A stale id, a second discard, or acting before the reveal must all no-op.
  check('discard: rejected before the Chancellor reveals',
    gameReducer(s, actions.enactPolicy(s.legislative.cards[0].id)) === s);
  s = gameReducer(s, actions.revealHandoff());
  check('enact: unknown policy id is a no-op', gameReducer(s, actions.enactPolicy('nope')) === s);
  check('enact: the already-binned id is a no-op', gameReducer(s, actions.discardPolicy(binned.id)) === s);

  const chosen = s.legislative.cards[0];
  const other = s.legislative.cards[1];
  s = gameReducer(s, actions.enactPolicy(chosen.id));
  check('enact: the chosen policy went on its track', s.boards[chosen.party].enacted === 1);
  check('enact: the loser went to the discard pile', s.discard.includes(other.party));
  check('enact: the hand is empty', s.legislative.cards.length === 0);
  check('enact: conservation holds', total(s) === cards);
  check('enact: election tracker reset', s.election.tracker === 0);
}

/* ---- 3. Veto: refusal, then consent ------------------------------------- */
{
  let s = dealt();
  s = { ...s, boards: { ...s.boards, [PARTIES.FASCIST]: { ...s.boards[PARTIES.FASCIST], enacted: 5 } } };
  s = elect(s);
  const cards = total(s);
  s = gameReducer(s, actions.revealHandoff());
  s = gameReducer(s, actions.discardPolicy(s.legislative.cards[0].id));
  s = gameReducer(s, actions.revealHandoff());
  const held = s.legislative.cards.map((c) => c.party).join();

  check('veto: locked before 5 fascist policies',
    gameReducer({ ...s, boards: { ...s.boards, FASCIST: { ...s.boards.FASCIST, enacted: 4 } } },
      actions.requestVeto()).phase === PHASES.LEGISLATIVE_CHANCELLOR);

  s = gameReducer(s, actions.requestVeto());
  check('veto: enters its own sub-phase', s.phase === PHASES.VETO_PRESIDENT_CONSIDER);
  check('veto: device goes back to the President',
    s.handoff.kind === HANDOFF.VETO_CONSIDER && s.handoff.toPlayerId === s.government.presidentId);
  check('veto: President cannot answer before revealing',
    gameReducer(s, actions.answerVeto(true)) === s);

  s = gameReducer(s, actions.revealHandoff());
  const refused = gameReducer(s, actions.answerVeto(false));
  check('refusal: back to the Chancellor', refused.phase === PHASES.LEGISLATIVE_CHANCELLOR);
  check('refusal: hand returned untouched', refused.legislative.cards.map((c) => c.party).join() === held);
  check('refusal: veto button locked', refused.legislative.vetoRejected === true);
  check('refusal: re-proposing is a no-op', gameReducer(refused, actions.requestVeto()) === refused);
  check('refusal: conservation holds', total(refused) === cards);
  check('refusal: tracker untouched', refused.election.tracker === 0);

  const consented = gameReducer(s, actions.answerVeto(true));
  check('consent: both policies discarded', consented.legislative.cards.length === 0);
  check('consent: conservation holds', total(consented) === cards);
  check('consent: tracker advanced by one', consented.election.tracker === 1);
  check('consent: rotates to the next President', consented.phase === PHASES.NOMINATION);
  check('consent: no policy was enacted',
    Object.values(consented.boards).reduce((a, b) => a + b.enacted, 0) === 5);
}

/* ---- 4. Veto that trips chaos grants no power --------------------------- */
{
  let s = dealt();
  s = { ...s, boards: { ...s.boards, [PARTIES.FASCIST]: { ...s.boards[PARTIES.FASCIST], enacted: 5 } } };
  s = elect(s);
  // Stack the chaos draw *after* the hand is dealt, so the marked card is the
  // one chaos turns over. Communist slot 1 is Confession, so this would grant a
  // power if chaos wrongly granted them.
  s = { ...s, deck: [PARTIES.COMMUNIST, ...s.deck], election: { ...s.election, tracker: 2 } };
  const cards = total(s);
  s = gameReducer(s, actions.revealHandoff());
  s = gameReducer(s, actions.discardPolicy(s.legislative.cards[0].id));
  s = gameReducer(s, actions.revealHandoff());
  s = gameReducer(s, actions.requestVeto());
  s = gameReducer(s, actions.revealHandoff());
  s = gameReducer(s, actions.answerVeto(true));

  check('chaos: tracker reset after firing', s.election.tracker === 0);
  check('chaos: a policy was force-enacted',
    Object.values(s.boards).reduce((a, b) => a + b.enacted, 0) === 6);
  check('chaos: the marked communist policy is what landed', s.boards[PARTIES.COMMUNIST].enacted === 1);
  check('chaos: no executive power granted', s.phase === PHASES.NOMINATION && s.pendingPower === null);
  check('chaos: Confession was not handed to anyone', s.handoff === null);
  check('chaos: term limits cleared',
    s.lastElectedGovernment.presidentId === null && s.lastElectedGovernment.chancellorId === null);
  check('chaos: conservation holds', total(s) === cards);
}

/* ---- 5. Hitler as Chancellor: win check stays in the election ----------- */
{
  let s = dealt();
  const hitler = s.players.find((p) => p.role === ROLES.HITLER);
  const president = s.players.find((p) => p.id !== hitler.id);
  // Two fascist policies down, Hitler seated as Chancellor, a third about to land.
  s = {
    ...s,
    boards: { ...s.boards, [PARTIES.FASCIST]: { ...s.boards[PARTIES.FASCIST], enacted: 2 } },
    government: { presidentId: president.id, chancellorId: hitler.id, nomineeId: null },
    phase: PHASES.LEGISLATIVE_CHANCELLOR,
    legislative: { cards: [{ id: 'a', party: PARTIES.FASCIST }, { id: 'b', party: PARTIES.LIBERAL }], discarded: null, vetoRequested: false, vetoRejected: false },
    handoff: { kind: HANDOFF.CHANCELLOR_LEGISLATIVE, toPlayerId: hitler.id, revealed: true, payload: {} },
  };
  s = gameReducer(s, actions.enactPolicy('a'));
  check('hitler: third fascist policy enacted during his term', s.boards[PARTIES.FASCIST].enacted === 3);
  check('hitler: legislating does NOT trigger the elected-Hitler loss', s.winReason !== WIN_REASONS.HITLER_ELECTED);
  check('hitler: game continues into the power', s.phase === PHASES.EXECUTIVE_ACTION);

  // The same board state, reached by *electing* him, must end the game.
  let t = dealt();
  const h = t.players.find((p) => p.role === ROLES.HITLER);
  t = { ...t, boards: { ...t.boards, [PARTIES.FASCIST]: { ...t.boards[PARTIES.FASCIST], enacted: 3 } } };
  t = gameReducer(t, actions.nominateChancellor(h.id));
  for (let i = 0; i < alivePlayers(t).length; i++) {
    t = gameReducer(t, actions.revealHandoff());
    t = gameReducer(t, actions.castVote(VOTES.JA));
  }
  t = gameReducer(t, actions.resolveElection());
  check('hitler: electing him at 3 fascist policies still loses the game',
    t.phase === PHASES.GAME_OVER && t.winReason === WIN_REASONS.HITLER_ELECTED);
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nlegislative + veto edge cases verified');
