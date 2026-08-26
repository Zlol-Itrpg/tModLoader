import { createInitialState } from '../../src/game/initialState.js';
import { gameReducer, actions, alivePlayers, eligibleChancellors } from '../../src/game/reducer.js';
import { PHASES, VOTES, HANDOFF } from '../../src/game/constants.js';

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };

// Deal, clear reveals, then kill seats 1 and 4 so the alive list is gappy.
let s = createInitialState({ names: NAMES });
const d = (a) => { s = gameReducer(s, a); };
d(actions.startGame());
for (let i = 0; i < NAMES.length; i++) { d(actions.revealHandoff()); d(actions.continueHandoff()); }
s = { ...s, players: s.players.map((p) => (['p1', 'p4'].includes(p.id) ? { ...p, isAlive: false } : p)) };
check('setup: 5 of 7 alive, gaps at seats 1 and 4', alivePlayers(s).map((p) => p.name).join() === 'A,C,D,F,G');

d(actions.nominateChancellor(eligibleChancellors(s)[0].id));
check('nomination: never offers a dead player', eligibleChancellors(s).every((p) => p.isAlive));

const visited = [];
const indices = [];
const plan = [VOTES.JA, VOTES.NEIN, VOTES.JA, VOTES.JA, VOTES.NEIN];
for (let i = 0; i < 5; i++) {
  check(`ballot ${i + 1}: handoff is a VOTE`, s.handoff?.kind === HANDOFF.VOTE);
  const voter = s.players.find((p) => p.id === s.handoff.toPlayerId);
  check(`ballot ${i + 1}: voter is alive`, voter.isAlive);
  visited.push(voter.name);
  indices.push(s.election.ballotIndex);
  d(actions.revealHandoff());
  d(actions.castVote(plan[i]));
}

check('loop: visited every living player, seat order, no repeats', visited.join() === 'A,C,D,F,G');
check('loop: skipped both corpses', !visited.includes('B') && !visited.includes('E'));
check('loop: ballotIndex walks 0..4 over the ALIVE list', indices.join() === '0,1,2,3,4');
check('loop: no ballot recorded for the dead',
  !('p1' in s.election.votes) && !('p4' in s.election.votes));
check('loop: five ballots recorded', Object.keys(s.election.votes).length === 5);
check('loop: parked at VOTE_REVEAL with the overlay down',
  s.phase === PHASES.VOTE_REVEAL && s.handoff === null);
check('tally: majority is over the living, not the seated',
  s.election.result.ja === 3 && s.election.result.nein === 2 && s.election.result.passed === true);

// A dead player cannot be revived into the tally by a stray dispatch.
const before = s;
s = gameReducer(s, actions.castVote(VOTES.JA));
check('a vote after the loop closes is ignored', s === before);

d(actions.resolveElection());
check('continue: government seated', s.phase === PHASES.LEGISLATIVE_PRESIDENT);

// Exact-tie and exact-majority boundaries, over the living only.
const tally = (jaCount, aliveCount) => {
  let t = createInitialState({ names: NAMES.slice(0, aliveCount) });
  t = gameReducer(t, actions.startGame());
  for (let i = 0; i < aliveCount; i++) { t = gameReducer(t, actions.revealHandoff()); t = gameReducer(t, actions.continueHandoff()); }
  t = gameReducer(t, actions.nominateChancellor(eligibleChancellors(t)[0].id));
  for (let i = 0; i < aliveCount; i++) {
    t = gameReducer(t, actions.revealHandoff());
    t = gameReducer(t, actions.castVote(i < jaCount ? VOTES.JA : VOTES.NEIN));
  }
  return t.election.result;
};
check('6 alive, 3 Ja: tie fails', tally(3, 6).passed === false);
check('6 alive, 4 Ja: passes', tally(4, 6).passed === true);
check('5 alive, 3 Ja: passes', tally(3, 5).passed === true);
check('5 alive, 2 Ja: fails', tally(2, 5).passed === false);
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nballot loop mapping verified');
