import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { pretendToBeVisual: true, url: 'https://example.test' });
global.window = dom.window; global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement; global.Event = dom.window.Event;
global.localStorage = dom.window.localStorage; globalThis.localStorage = dom.window.localStorage;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { GameProvider, useGameState, useGameActions } = await import('../../src/game/GameContext.jsx');
const { Game } = await import('../../src/App.jsx');
const { SAVE_KEY, SAVE_VERSION } = await import('../../src/game/storage.js');
const { PHASES, VOTES, ROLES } = await import('../../src/game/constants.js');
const { eligibleChancellors } = await import('../../src/game/reducer.js');

const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const container = document.getElementById('root');
const $ = (s) => container.querySelector(s);
const $$ = (s) => [...container.querySelectorAll(s)];
const byText = (sel, t) => $$(sel).find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase()));
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const hold = async (el, ms = 600) => {
  await act(async () => { el.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};
const type = async (el, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};

let peek = null, act$ = null, root = null;
function Probe() { peek = useGameState(); act$ = useGameActions(); return null; }
/** Tear the app down and build it again — a browser refresh, in other words. */
async function reload() {
  if (root) await act(async () => { root.unmount(); });
  peek = null; act$ = null;
  root = createRoot(container);
  await act(async () => { root.render(<GameProvider><Probe /><Game /></GameProvider>); });
}
const saved = () => { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; };

/* ---- A fresh device ----------------------------------------------------- */
localStorage.clear();
await reload();
check('no save: starts at SETUP', peek.phase === PHASES.SETUP);
check('no save: default roster loaded', peek.players.length > 0);
check('no save: the opening state is written straight away', saved()?.version === SAVE_VERSION);

/* ---- Setup survives a refresh ------------------------------------------- */
await type($('input[aria-label="New player name"]'), 'Zola');
await click(byText('button', 'Add'));
const rosterBefore = peek.players.map((p) => p.name).join();
await act(async () => { $('input[type="checkbox"]').click(); });
check('setup: expansion toggled off', peek.config.communistsEnabled === false);

await reload();
check('refresh: still at SETUP', peek.phase === PHASES.SETUP);
check('refresh: roster restored', peek.players.map((p) => p.name).join() === rosterBefore);
check('refresh: the expansion setting came back too', peek.config.communistsEnabled === false);
await act(async () => { $('input[type="checkbox"]').click(); });

/* ---- Mid-game survives a refresh ---------------------------------------- */
await act(async () => { act$.startGame(); });
const roles = peek.players.map((p) => `${p.name}:${p.role}`).join();
const deck = peek.deck.join();
for (let i = 0; i < peek.players.length; i++) {
  await act(async () => { act$.revealHandoff(); });
  await act(async () => { act$.continueHandoff(); });
}
await act(async () => { act$.nominateChancellor(eligibleChancellors(peek)[0].id); });
const nominee = peek.government.nomineeId;
await act(async () => { act$.revealHandoff(); });
await act(async () => { act$.castVote(VOTES.JA); });
const ballotVoter = peek.handoff.toPlayerId;
check('mid-game: parked mid-ballot', peek.phase === PHASES.VOTING);

await reload();
check('refresh mid-ballot: phase restored', peek.phase === PHASES.VOTING);
check('refresh mid-ballot: secret roles intact', peek.players.map((p) => `${p.name}:${p.role}`).join() === roles);
check('refresh mid-ballot: deck order intact', peek.deck.join() === deck);
check('refresh mid-ballot: the nomination stands', peek.government.nomineeId === nominee);
check('refresh mid-ballot: the ballot resumes with the right player', peek.handoff.toPlayerId === ballotVoter);
check('refresh mid-ballot: the cast vote was not lost', Object.keys(peek.election.votes).length === 1);
check('refresh mid-ballot: the overlay comes back covered', peek.handoff.revealed === false);
const voterName = peek.players.find((p) => p.id === ballotVoter).name;
check('refresh mid-ballot: the overlay asks for that player',
  $('[role="dialog"]').textContent.includes(voterName));

/* ---- A corrupt save must not brick the app ------------------------------ */
localStorage.setItem(SAVE_KEY, '{"version":1,"state":{"phase":"NOM');
let crashed = false;
try { await reload(); } catch { crashed = true; }
check('corrupt save: the app still boots', crashed === false);
check('corrupt save: falls back to a fresh game', peek.phase === PHASES.SETUP);
check('corrupt save: the bad value was replaced, not left to re-read',
  saved()?.version === SAVE_VERSION && saved().state.phase === PHASES.SETUP);

localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 99, state: { phase: 'SETUP' } }));
await reload();
check('future save version: discarded rather than loaded', peek.phase === PHASES.SETUP);
check('future save version: replaced with a valid save', saved().version === SAVE_VERSION);

/* ---- Abandoning a game in progress -------------------------------------- */
await act(async () => { act$.startGame(); });
for (let i = 0; i < peek.players.length; i++) {
  await act(async () => { act$.revealHandoff(); });
  await act(async () => { act$.continueHandoff(); });
}
check('abandon: a game is running', peek.phase === PHASES.NOMINATION);
const rosterDuring = peek.players.map((p) => p.name).join();

check('abandon: no dialog until asked', !byText('h2', 'End this game?'));
await click(byText('button', 'End game'));
check('abandon: dialog opened', Boolean(byText('h2', 'End this game?')));
check('abandon: warns it cannot be undone',
  container.textContent.includes('Are you sure you want to end this game? This cannot be undone'));
check('abandon: dialog is modal', $('[aria-labelledby="abandon-title"]')?.getAttribute('aria-modal') === 'true');

await click(byText('button', 'Keep playing'));
check('abandon: cancelling closes the dialog', !byText('h2', 'End this game?'));
check('abandon: cancelling changed nothing', peek.phase === PHASES.NOMINATION);

await act(async () => { $('[aria-labelledby="abandon-title"]'); });
await click(byText('button', 'End game'));
await click(byText('button', 'End game & start over'));
check('abandon: confirming returns to SETUP', peek.phase === PHASES.SETUP);
check('abandon: roles are gone', peek.players.every((p) => p.role === null));
check('abandon: the board is cleared',
  Object.values(peek.boards).every((b) => b.enacted === 0) && peek.deck.length === 0);
check('abandon: the roster is kept so they can deal again',
  peek.players.map((p) => p.name).join() === rosterDuring);
check('abandon: the save now holds the fresh game', saved().state.phase === PHASES.SETUP);
await reload();
check('abandon: refresh confirms it', peek.phase === PHASES.SETUP && peek.players.every((p) => p.role === null));

/* ---- Play again from the end screen ------------------------------------- */
{
  const { createInitialState } = await import('../../src/game/initialState.js');
  const { gameReducer, actions: A } = await import('../../src/game/reducer.js');
  const { PHASES: P, POWERS, HANDOFF } = await import('../../src/game/constants.js');

  // Build a finished game the honest way: arm an execution and shoot Hitler.
  let s = createInitialState({ names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] });
  s = gameReducer(s, A.startGame());
  for (let i = 0; i < 9; i++) { s = gameReducer(s, A.revealHandoff()); s = gameReducer(s, A.continueHandoff()); }
  const theHitler = s.players.find((p) => p.role === ROLES.HITLER);
  const shooter = s.players.find((p) => p.role !== ROLES.HITLER);
  s = {
    ...s,
    phase: P.EXECUTIVE_ACTION,
    government: { ...s.government, presidentId: shooter.id },
    pendingPower: { power: POWERS.EXECUTION, presidentId: shooter.id, targetId: null, result: null },
    handoff: { kind: HANDOFF.EXECUTIVE_ACTION, toPlayerId: shooter.id, revealed: true, payload: {} },
  };
  s = gameReducer(s, A.resolvePower(theHitler.id));
  check('game over: reached by shooting Hitler', s.phase === P.GAME_OVER);

  // Save it, then "reopen the app" — a finished game must restore too.
  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: s }));
  await reload();
  check('game over: a finished game is restored from the save', peek.phase === PHASES.GAME_OVER);
  check('game over: the joint victory is shown', container.textContent.includes('Liberal & Communist'));

  const playAgain = byText('button', 'Play again');
  check('game over: offers Play again', Boolean(playAgain));
  await click(playAgain);
  check('play again: back to SETUP', peek.phase === PHASES.SETUP);
  check('play again: roles cleared', peek.players.every((p) => p.role === null));
  check('play again: winners cleared', peek.winners === null);
  check('play again: the board is empty',
    Object.values(peek.boards).every((b) => b.enacted === 0));
  check('play again: the same nine are still at the table',
    peek.players.map((p) => p.name).join() === 'A,B,C,D,E,F,G,H,I');
  check('play again: the finished game is gone from storage',
    saved().state.phase === PHASES.SETUP && saved().state.winners === null);
  await reload();
  check('play again: and stays gone after a refresh',
    peek.phase === PHASES.SETUP && peek.winners === null);
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\npersistence + reset checks passed');
