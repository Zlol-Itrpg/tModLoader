import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement; global.Event = dom.window.Event;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { GameProvider, useGameState, useGameActions } = await import('../../src/game/GameContext.jsx');
const GameHUD = (await import('../../src/components/GameHUD.jsx')).default;
const RoleReveal = (await import('../../src/components/RoleReveal.jsx')).default;
const NominationScreen = (await import('../../src/components/NominationScreen.jsx')).default;
const VotingScreen = (await import('../../src/components/VotingScreen.jsx')).default;
const VoteResults = (await import('../../src/components/VoteResults.jsx')).default;
const { PHASES, VOTES } = await import('../../src/game/constants.js');

let peek = null;
function Probe() { peek = useGameState(); return null; }
let ctxActions = null;
function Grab() { ctxActions = useGameActions(); return null; }
function Tree() {
  return (<><Probe /><Grab /><GameHUD /><NominationScreen /><VoteResults /><RoleReveal /><VotingScreen /></>);
}
const NAMES = ['Braden', 'Dawson', 'Danielle', 'Marguerite', 'Ellis', 'Ines'];
const container = document.getElementById('root');
const root = createRoot(container);
await act(async () => { root.render(<GameProvider initialOptions={{ names: NAMES }}><Tree /></GameProvider>); });

const $ = (s) => container.querySelector(s);
const $$ = (s) => [...container.querySelectorAll(s)];
const byText = (sel, t) => $$(sel).find((el) => el.textContent.trim().toLowerCase().includes(t.toLowerCase()));
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const hold = async (el, ms = 600) => {
  await act(async () => { el.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) process.exitCode = 1; };

// --- Deal and clear the role reveals --------------------------------------
await act(async () => { ctxActions.startGame(); });
for (let i = 0; i < NAMES.length; i++) {
  await hold($(`button[aria-label="I am ${peek.players[i].name} — reveal my role"]`));
  await click(byText('button', i === NAMES.length - 1 ? 'begin the first nomination' : 'pass on'));
}
check('reveals done -> NOMINATION', peek.phase === PHASES.NOMINATION);

// --- HUD ------------------------------------------------------------------
const slots = $$('[title^="Slot "]');
check('HUD: 16 policy slots (5 lib + 6 fas + 5 com)', slots.length === 16);
// Six players: the fascist track gets a peek and two executions.
check('HUD: fascist slot 3 is Policy Peek at 6 players', slots.some((s) => s.title === 'Slot 3: Policy Peek'));
check('HUD: fascist slots 4 & 5 are Execution', slots.filter((s) => s.title.endsWith('Execution')).length === 2);
check('HUD: no investigation on a six-player fascist track',
  !slots.some((s) => s.title.endsWith('Investigate Loyalty')));
check('HUD: communist slots 1 & 2 are Confession',
  slots.filter((s) => s.title.endsWith('Confession')).length === 2);
check('HUD: communist slot 3 is Radicalisation', slots.some((s) => s.title === 'Slot 3: Radicalisation'));
check('HUD: no slot is filled yet', $$('.bg-liberal, .bg-fascist, .bg-communist').filter((e) => e.textContent === 'L' || e.textContent === 'F' || e.textContent === 'C').length === 0);
check('HUD: deck counters', container.textContent.includes('Draw 23') && container.textContent.includes('Discard 0'));
check('HUD: tracker reads 0/3', container.textContent.includes('0/3'));
check('HUD: president badged', byText('li', 'President')?.textContent.includes(peek.players[0].name));
check('HUD: no prev-government badges on turn one', !container.textContent.includes('Prev Pres') && !container.textContent.includes('Prev Chan'));

// --- Nomination -----------------------------------------------------------
// Scoped to the picker list: the HUD's mute toggle is an aria-pressed button too.
const nomButtons = () => $$('li button[aria-pressed]');
check('nomination: prompts the president', container.textContent.includes(`President ${peek.players[0].name}, nominate your Chancellor.`));
check('nomination: one button per alive player', nomButtons().length === 6);
check('nomination: only the president is disabled', nomButtons().filter((b) => b.disabled).length === 1);
check('nomination: the disabled one is the president', nomButtons().find((b) => b.disabled).textContent.includes(peek.players[0].name));
check('nomination: Confirm starts disabled', byText('button', 'Confirm nomination').disabled === true);
await click(nomButtons()[2]);
check('nomination: selection enables Confirm', byText('button', 'Confirm nomination').disabled === false);
check('nomination: no dispatch until Confirm', peek.phase === PHASES.NOMINATION);
await click(byText('button', 'Confirm nomination'));
check('nomination: Confirm dispatches', peek.phase === PHASES.VOTING);
check('nomination: nominee is the picked player', peek.government.nomineeId === peek.players[2].id);

// --- The ballot loop ------------------------------------------------------
const order = [];
const votePlan = [VOTES.JA, VOTES.JA, VOTES.NEIN, VOTES.JA, VOTES.NEIN, VOTES.NEIN];
for (let i = 0; i < 6; i++) {
  const voter = peek.players.find((p) => p.id === peek.handoff.toPlayerId);
  order.push(voter.name);
  check(`ballot ${i + 1}: counter reads ${i + 1} of 6`, container.textContent.includes(`Ballot ${i + 1} of 6`));
  const overlay = $('[role="dialog"]');
  const others = peek.players.filter((p) => p.id !== voter.id).map((p) => p.name);
  check(`ballot ${i + 1}: overlay is opaque and full-screen`,
    overlay.className.includes('fixed inset-0') && overlay.className.includes('bg-parchment'));
  check(`ballot ${i + 1}: overlay names only ${voter.name}`,
    overlay.textContent.includes(voter.name) && !others.some((n) => overlay.textContent.includes(n)));
  check(`ballot ${i + 1}: no Ja/Nein before reveal`, !byText('button', 'Ja!'));

  await hold($(`button[aria-label="I am ${voter.name} — show my ballot"]`));
  check(`ballot ${i + 1}: names the government`,
    container.textContent.includes(peek.players[0].name) && container.textContent.includes(peek.players[2].name));
  check(`ballot ${i + 1}: both vote buttons present`, Boolean(byText('button', 'Ja!')) && Boolean(byText('button', 'Nein!')));
  await click(byText('button', votePlan[i] === VOTES.JA ? 'Ja!' : 'Nein!'));
}
check('ballot loop: visited every alive player in seat order', order.join() === NAMES.join());
check('ballot loop: parks at VOTE_REVEAL, no auto-resolve', peek.phase === PHASES.VOTE_REVEAL);
check('ballot loop: overlay is down', peek.handoff === null);
check('ballot loop: every ballot recorded', Object.keys(peek.election.votes).length === 6);
check('ballot loop: votes match what was tapped',
  NAMES.every((n, i) => peek.election.votes[peek.players[i].id] === votePlan[i]));

// --- Vote reveal ----------------------------------------------------------
check('reveal: 3 Ja / 3 Nein tallied', peek.election.result.ja === 3 && peek.election.result.nein === 3);
check('reveal: a tie is a rejection', peek.election.result.passed === false);
check('reveal: headline says rejected', container.textContent.includes('Government rejected'));
check('reveal: grid shows every voter', NAMES.every((n) => container.textContent.includes(n)));
const jaCells = $$('li').filter((li) => li.textContent.trim().endsWith('Ja'));
check('reveal: 3 Ja cells rendered', jaCells.length === 3);
check('reveal: tracker still 0 until Continue', peek.election.tracker === 0);
await click(byText('button', 'Continue'));
check('continue: tracker advanced to 1', peek.election.tracker === 1);
check('continue: back to NOMINATION', peek.phase === PHASES.NOMINATION);
check('continue: presidency moved to seat 1', peek.government.presidentId === peek.players[1].id);
check('continue: HUD tracker now 1/3', container.textContent.includes('1/3'));
check('continue: still no prev-gov badges (nothing was elected)', !container.textContent.includes('Prev Pres'));

// --- A passing vote, to see the elected path ------------------------------
await click(nomButtons()[3]);
await click(byText('button', 'Confirm nomination'));
for (let i = 0; i < 6; i++) {
  const voter = peek.players.find((p) => p.id === peek.handoff.toPlayerId);
  await hold($(`button[aria-label="I am ${voter.name} — show my ballot"]`));
  await click(byText('button', 'Ja!'));
}
check('second vote: elected', peek.election.result.passed === true && container.textContent.includes('Government elected'));
await click(byText('button', 'Continue'));
check('second vote: legislative session begins', peek.phase === PHASES.LEGISLATIVE_PRESIDENT);
check('second vote: president drew three', peek.legislative.cards.length === 3);
check('second vote: deck down to 20', peek.deck.length === 20);
check('second vote: tracker reset', peek.election.tracker === 0);
check('HUD: sitting pair badged President + Chancellor while legislating',
  container.textContent.includes('President') && container.textContent.includes('Chancellor'));
check('HUD: no Prev badges while that pair still holds office',
  !container.textContent.includes('Prev Pres') && !container.textContent.includes('Prev Chan'));

// --- Run the legislative session through to the next nomination -----------
const electedPres = peek.players.find((p) => p.id === peek.government.presidentId).name;
const electedChan = peek.players.find((p) => p.id === peek.government.chancellorId).name;
await act(async () => { ctxActions.revealHandoff(); });
await act(async () => { ctxActions.discardPolicy(peek.legislative.cards[0].id); });
await act(async () => { ctxActions.revealHandoff(); });
await act(async () => { ctxActions.enactPolicy(peek.legislative.cards[0].id); });
if (peek.phase === PHASES.EXECUTIVE_ACTION) {
  const { eligiblePowerTargets } = await import('../../src/game/reducer.js');
  const { POWER_INFO } = await import('../../src/game/constants.js');
  const power = peek.pendingPower.power;
  await act(async () => { ctxActions.revealHandoff(); });
  const target = POWER_INFO[power].needsTarget ? eligiblePowerTargets(peek)[0].id : null;
  await act(async () => { ctxActions.resolvePower(target); });
  if (peek.handoff) { await act(async () => { ctxActions.revealHandoff(); }); await act(async () => { ctxActions.continueHandoff(); }); }
}
check('next turn: back at NOMINATION', peek.phase === PHASES.NOMINATION);
check('HUD: a policy slot is now filled',
  Object.values(peek.boards).reduce((a, b) => a + b.enacted, 0) === 1);
check('HUD: Prev Pres badge on last turn\'s president',
  byText('li', 'Prev Pres')?.textContent.includes(electedPres));
check('HUD: Prev Chan badge on last turn\'s chancellor',
  byText('li', 'Prev Chan')?.textContent.includes(electedChan));
const disabledNow = nomButtons().filter((b) => b.disabled).map((b) => b.textContent);
check('nomination: term-limited players disabled and labelled',
  disabledNow.some((t) => t.includes('Term-limited')));
check('nomination: eligible set matches the reducer',
  nomButtons().filter((b) => !b.disabled).length ===
    (await import('../../src/game/reducer.js')).eligibleChancellors(peek).length);
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nall HUD / nomination / ballot / reveal checks passed');
