import { createInitialState } from '../../src/game/initialState.js';
import { gameReducer, actions, alivePlayers, eligibleChancellors, eligiblePowerTargets, isVetoUnlocked } from '../../src/game/reducer.js';
import { PHASES, HANDOFF, VOTES, POWER_INFO } from '../../src/game/constants.js';
import { getRoleComposition } from '../../src/game/config.js';

const NAMES = Array.from({length:20},(_,i)=>`P${i}`);
const outcomes = {}; const powersSeen = new Set(); let chaos=0, vetoes=0, reshuffles=0;

for (let game = 0; game < 600; game++) {
  const n = 4 + (game % 17);
  let s = createInitialState({ names: NAMES.slice(0, n) });
  const d = (a) => { s = gameReducer(s, a); };
  d(actions.startGame());
  const total = s.deck.length;

  // role composition sanity
  const comp = getRoleComposition(n, true);
  const counts = s.players.reduce((a,p)=>({...a,[p.role]:(a[p.role]??0)+1}),{});
  if ((counts.HITLER??0)!==1) throw new Error(`hitler count ${counts.HITLER} at n=${n}`);
  if ((counts.FASCIST??0)!==comp.fascists) throw new Error(`fascist count at n=${n}`);
  if ((counts.COMMUNIST??0)!==comp.communists) throw new Error(`communist count at n=${n}`);
  if (s.players.some(p=>!p.role||!p.party)) throw new Error('undealt role');

  for (let i=0;i<n;i++){ d(actions.revealHandoff()); d(actions.continueHandoff()); }
  if (s.phase !== PHASES.NOMINATION) throw new Error('bad phase after reveals');

  let guard = 0;
  while (s.phase !== PHASES.GAME_OVER) {
    if (guard++ > 3000) throw new Error(`livelock at n=${n} phase=${s.phase}`);
    const before = s;
    if (s.phase === PHASES.NOMINATION) {
      const opts = eligibleChancellors(s);
      if (!opts.length) throw new Error(`no eligible chancellor n=${n} alive=${alivePlayers(s).length}`);
      const pick = opts[Math.floor(Math.random()*opts.length)];
      if (pick.id === s.government.presidentId) throw new Error('self-nomination');
      d(actions.nominateChancellor(pick.id));
    } else if (s.phase === PHASES.VOTING) {
      const before2 = s.election.tracker;
      const k = alivePlayers(s).length;
      for (let i=0;i<k && s.phase===PHASES.VOTING;i++){
        d(actions.revealHandoff());
        d(actions.castVote(Math.random()<0.6?VOTES.JA:VOTES.NEIN));
      }
      if (s.phase !== PHASES.VOTE_REVEAL) throw new Error('ballots did not park at VOTE_REVEAL');
      if (!s.election.result) throw new Error('no tally at VOTE_REVEAL');
      if (s.handoff) throw new Error('handoff still up at VOTE_REVEAL');
      d(actions.resolveElection());
      if (s.election.tracker === 0 && before2 === 2) chaos++;
    } else if (s.phase === PHASES.VETO_PRESIDENT_CONSIDER) {
      d(actions.revealHandoff());
      d(actions.answerVeto(Math.random() < 0.5));
    } else if (s.phase === PHASES.VOTE_REVEAL) {
      d(actions.resolveElection());
    } else if (s.phase === PHASES.LEGISLATIVE_PRESIDENT) {
      if (s.legislative.cards.length !== 3) throw new Error('president hand != 3');
      if (new Set(s.legislative.cards.map((c) => c.id)).size !== 3) throw new Error('duplicate policy ids');
      d(actions.revealHandoff());
      d(actions.discardPolicy(s.legislative.cards[Math.floor(Math.random() * 3)].id));
      if (s.legislative.cards.length !== 2) throw new Error('chancellor hand != 2');
    } else if (s.phase === PHASES.LEGISLATIVE_CHANCELLOR) {
      d(actions.revealHandoff());
      if (isVetoUnlocked(s) && !s.legislative.vetoRejected && Math.random() < 0.4) {
        vetoes++;
        const held = s.legislative.cards.map((c) => c.party).join();
        d(actions.requestVeto());
        if (s.phase !== PHASES.VETO_PRESIDENT_CONSIDER) throw new Error('veto did not open its sub-phase');
        if (s.handoff?.toPlayerId !== s.government.presidentId) throw new Error('veto not handed to the President');
        d(actions.revealHandoff());
        const consent = Math.random() < 0.5;
        d(actions.answerVeto(consent));
        if (!consent) {
          if (s.phase !== PHASES.LEGISLATIVE_CHANCELLOR) throw new Error('refusal did not return to the Chancellor');
          if (!s.legislative.vetoRejected) throw new Error('refusal did not lock the veto button');
          if (s.legislative.cards.map((c) => c.party).join() !== held) throw new Error('refusal altered the hand');
          const blocked = s;
          if (gameReducer(s, actions.requestVeto()) !== blocked) throw new Error('veto re-proposable after refusal');
          d(actions.revealHandoff());
          d(actions.enactPolicy(s.legislative.cards[Math.floor(Math.random() * 2)].id));
        }
      } else {
        d(actions.enactPolicy(s.legislative.cards[Math.floor(Math.random() * 2)].id));
      }
    } else if (s.phase === PHASES.EXECUTIVE_ACTION) {
      const power = s.pendingPower.power; powersSeen.add(power);
      if (s.pendingPower.result === null) {
        d(actions.revealHandoff());
        const t = eligiblePowerTargets(s);
        if (POWER_INFO[power].needsTarget) {
          if (!t.length) throw new Error(`${power} reached EXECUTIVE_ACTION with no legal target`);
          d(actions.resolvePower(t[Math.floor(Math.random() * t.length)].id));
        }
        if (s.phase === PHASES.GAME_OVER) break;
        if (s.phase === PHASES.EXECUTIVE_ACTION && s.pendingPower.result === null) {
          throw new Error(`${power} produced no result`);
        }
      }
      if (s.phase !== PHASES.EXECUTIVE_ACTION) continue;
      // Radicalisation hands off to its target; everyone else reads it in place.
      if (power === 'RADICALISATION' && s.handoff?.toPlayerId !== s.pendingPower.targetId) {
        throw new Error('radicalisation did not reach its target');
      }
      if (!s.handoff?.revealed) d(actions.revealHandoff());
      const stuck = s;
      d(actions.endExecutiveAction());
      if (s === stuck) throw new Error(`${power} could not be ended`);
    } else throw new Error('unknown phase '+s.phase);

    if (s === before) throw new Error(`no-op transition in ${s.phase} (n=${n})`);
    if (s.phase === PHASES.GAME_OVER) break;

    const enacted = Object.values(s.boards).reduce((a,b)=>a+b.enacted,0);
    const seen = s.deck.length + s.discard.length + enacted + s.legislative.cards.length;
    if (seen !== total) throw new Error(`card leak: ${seen} != ${total} in ${s.phase}`);
    if (alivePlayers(s).length < 5 && s.phase !== PHASES.GAME_OVER) { /* small tables still legal */ }
    if (s.handoff && !s.players.find(p=>p.id===s.handoff.toPlayerId)?.isAlive) throw new Error('handoff to dead player');
  }
  outcomes[`${s.winners}/${s.winReason}`] = (outcomes[`${s.winners}/${s.winReason}`]??0)+1;
}
console.log('outcomes:', outcomes);
console.log('powers exercised:', [...powersSeen].join(', '));
console.log('chaos rounds:', chaos, '| veto attempts:', vetoes);
console.log('600 games, 4-20 players: no invariant violations');
