import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;

global.HTMLElement = dom.window.HTMLElement;
global.Event = dom.window.Event;

global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { GameProvider, useGameState } = await import('../../src/game/GameContext.jsx');
const SetupScreen = (await import('../../src/components/SetupScreen.jsx')).default;
const RoleReveal = (await import('../../src/components/RoleReveal.jsx')).default;
const { PHASES, ROLES } = await import('../../src/game/constants.js');

let peek = null;
function Probe() { peek = useGameState(); return null; }
function App() {
  const state = useGameState();
  return state.phase === PHASES.SETUP ? <SetupScreen /> : <RoleReveal />;
}

const container = document.getElementById('root');
const root = createRoot(container);
await act(async () => {
  root.render(<GameProvider initialOptions={{ names: [] }}><Probe /><App /></GameProvider>);
});

const $ = (sel) => container.querySelector(sel);
const $$ = (sel) => [...container.querySelectorAll(sel)];
const byText = (sel, text) => $$(sel).find((el) => el.textContent.trim().toLowerCase().includes(text.toLowerCase()));
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const type = async (el, value) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};
const hold = async (el, ms = 700) => {
  await act(async () => { el.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
};
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) process.exitCode = 1; };

// --- Empty roster ---------------------------------------------------------
const dealBtn = () => byText('button', 'Deal roles');
check('empty roster: Deal disabled', dealBtn().disabled === true);
check('empty roster: prompts for 4', container.textContent.includes('Add 4 more players'));
check('empty roster: shows the 4-player breakdown', container.textContent.includes('At 4 players'));

// --- Add three players; still blocked -------------------------------------
for (const name of ['Braden', 'Dawson', 'Danielle']) {
  await type($('input[aria-label="New player name"]'), name);
  await click(byText('button', 'Add'));
}
check('3 players: roster rendered', $$('input[aria-label^="Name of player"]').length === 3);
check('3 players: input cleared after add', $('input[aria-label="New player name"]').value === '');
check('3 players: Deal still disabled', dealBtn().disabled === true);
check('3 players: asks for 1 more', container.textContent.includes('Add 1 more player'));

// --- Fourth player unlocks it ---------------------------------------------
await type($('input[aria-label="New player name"]'), 'Marguerite');
await click(byText('button', 'Add'));
check('4 players: Deal enabled', dealBtn().disabled === false);
check('4 players: house-rule warning shown', container.textContent.includes('house rule'));
check('4 players XL breakdown', container.textContent.includes('1 Liberal, 1 Fascist, 1 Communist, Hitler'));

// --- Expansion toggle -----------------------------------------------------
const toggle = $('input[type="checkbox"]');
await act(async () => { toggle.click(); });
check('expansion off: state updated', peek.config.communistsEnabled === false);
check('expansion off: 4p = 2 Liberals, 1 Fascist, Hitler', container.textContent.includes('2 Liberals, 1 Fascist, Hitler'));
await act(async () => { toggle.click(); });
check('expansion back on', peek.config.communistsEnabled === true);

// --- Rename + remove ------------------------------------------------------
await type($$('input[aria-label^="Name of player"]')[0], 'Bradley');
check('rename dispatched', peek.players[0].name === 'Bradley');
await click($$('button[aria-label^="Remove"]')[3]);
check('remove dispatched', peek.players.length === 3 && peek.players.every((p) => p.name !== 'Marguerite'));
check('after remove: Deal disabled again', dealBtn().disabled === true);
check('after remove: ids reseated', peek.players.map((p) => p.id).join() === 'p0,p1,p2');

// --- Grow to 7 and deal ---------------------------------------------------
for (const name of ['Marguerite', 'Ellis', 'Ines', 'Osric']) {
  await type($('input[aria-label="New player name"]'), name);
  await click(byText('button', 'Add'));
}
check('7 players breakdown', container.textContent.includes('At 7 players'));
await click(dealBtn());
check('deal: phase is ROLE_REVEAL', peek.phase === PHASES.ROLE_REVEAL);
check('deal: everyone has a role', peek.players.every((p) => p.role && p.party));
check('deal: handoff to seat 0', peek.handoff.toPlayerId === 'p0' && peek.handoff.revealed === false);

// --- Walk the reveals -----------------------------------------------------
const hitler = peek.players.find((p) => p.role === ROLES.HITLER);
const fascists = peek.players.filter((p) => p.role === ROLES.FASCIST);
const communists = peek.players.filter((p) => p.role === ROLES.COMMUNIST);
console.log('  roles:', peek.players.map((p) => `${p.name}=${p.role}`).join(' '));

for (let i = 0; i < 7; i++) {
  const player = peek.players[i];
  check(`seat ${i}: covered screen names ${player.name}`, container.textContent.includes(player.name));
  const others = peek.players.filter((p) => p.id !== player.id);
  check(`seat ${i}: nothing leaks before reveal`, !others.some((o) => container.textContent.includes(o.name)));
  check(`seat ${i}: role hidden before reveal`, !container.textContent.toLowerCase().includes('you are'));
  check(`seat ${i}: counter reads ${i + 1} of 7`, container.textContent.includes(`Player ${i + 1} of 7`));

  const revealBtn = $(`button[aria-label="I am ${player.name} — reveal my role"]`);
  check(`seat ${i}: reveal button is a hold target`, revealBtn.textContent.includes('Hold to reveal'));
  await hold(revealBtn);
  check(`seat ${i}: role card shown after hold`, container.textContent.includes('You are'));

  // Intel rules, checked against the actual deal.
  const text = container.textContent;
  if (player.role === ROLES.FASCIST) {
    const expected = [hitler, ...fascists.filter((f) => f.id !== player.id)];
    check(`  fascist ${player.name} sees Hitler + co-fascists`, expected.every((a) => text.includes(a.name)) && text.includes('Hitler'));
  } else if (player.role === ROLES.HITLER) {
    check(`  hitler at 7p is blind`, !fascists.some((f) => text.includes(f.name)) && text.includes('do not learn'));
  } else if (player.role === ROLES.COMMUNIST) {
    const peers = communists.filter((c) => c.id !== player.id);
    check(`  communist ${player.name} sees ${peers.length} peer(s)`, peers.every((c) => text.includes(c.name)));
    check(`  communist sees no fascists`, !fascists.some((f) => text.includes(f.name)) && !text.includes(hitler.name));
  } else {
    check(`  liberal ${player.name} learns nothing`, !peek.players.filter((p) => p.id !== player.id).some((o) => text.includes(o.name)));
  }

  const done = byText('button', i === 6 ? 'begin the first nomination' : 'pass on');
  check(`seat ${i}: correct done label`, Boolean(done));
  await click(done);
}

check('after last reveal: phase NOMINATION', peek.phase === PHASES.NOMINATION);
check('after last reveal: handoff cleared', peek.handoff === null);
check('after last reveal: president is seat 0', peek.government.presidentId === 'p0');
check('after last reveal: RoleReveal unmounts', container.textContent.trim() === '');
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nall UI checks passed');
