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
const ExecutiveActionScreen = (await import('../../src/components/ExecutiveActionScreen.jsx')).default;
const GameOverScreen = (await import('../../src/components/GameOverScreen.jsx')).default;
const GameHUD = (await import('../../src/components/GameHUD.jsx')).default;
const { createInitialState } = await import('../../src/game/initialState.js');
const { gameReducer, actions, powerTargets } = await import('../../src/game/reducer.js');
const { PHASES, PARTIES, POWERS, ROLES, HANDOFF } = await import('../../src/game/constants.js');
const { BOARDS } = await import('../../src/game/config.js');

const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const container = document.getElementById('root');
const root = createRoot(container);
let peek = null, act$ = null;
function Probe() { peek = useGameState(); act$ = useGameActions(); return null; }

const $ = (s) => container.querySelector(s);
const $$ = (s) => [...container.querySelectorAll(s)];
const byText = (sel, t) => $$(sel).find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase()));
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const hold = async (el, ms = 600) => {
  await act(async () => { el.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};
// Scoped to the picker list: the HUD's mute toggle is an aria-pressed button too.
const picks = () => $$('li button[aria-pressed]');

function seed(n = 9) {
  let s = createInitialState({ names: Array.from({ length: n }, (_, i) => `P${i}`) });
  s = gameReducer(s, actions.startGame());
  for (let i = 0; i < n; i++) { s = gameReducer(s, actions.revealHandoff()); s = gameReducer(s, actions.continueHandoff()); }
  return s;
}
function armed(s, power, extra = {}) {
  const presidentId = s.players.find((p) => p.role !== ROLES.HITLER).id;
  let armedState = {
    ...s,
    phase: PHASES.EXECUTIVE_ACTION,
    government: { ...s.government, presidentId },
    pendingPower: { power, presidentId, targetId: null, result: null },
    handoff: { kind: HANDOFF.EXECUTIVE_ACTION, toPlayerId: presidentId, revealed: false, payload: { power } },
    ...extra,
  };
  if (power === POWERS.POLICY_PEEK) {
    armedState = { ...armedState, pendingPower: { ...armedState.pendingPower, result: { cards: s.deck.slice(0, 3) } } };
  }
  return armedState;
}
let mounted = 0;
async function mount(state) {
  mounted += 1;
  await act(async () => {
    root.render(
      <GameProvider key={mounted} resumeState={state}>
        <Probe /><GameHUD /><ExecutiveActionScreen /><GameOverScreen />
      </GameProvider>,
    );
  });
}
const president = () => peek.players.find((p) => p.id === peek.government.presidentId);
const revealPresident = async () => {
  await hold($(`button[aria-label^="I am ${president().name} — use"]`));
};

/* ---- Policy Peek -------------------------------------------------------- */
{
  const base = seed(6);
  await mount(armed(base, POWERS.POLICY_PEEK));
  check('peek: overlay names the President before reveal', $('[role="dialog"]').textContent.includes(president().name));
  check('peek: cards hidden before reveal', $$('button[aria-label$="policy"]').length === 0);
  await revealPresident();
  const shown = $$('button[aria-label$="policy"]');
  check('peek: three cards shown', shown.length === 3);
  check('peek: in deck order',
    shown.map((c) => c.getAttribute('aria-label')).join() ===
      peek.pendingPower.result.cards.map((p) => `${BOARDS[p].label} policy`).join());
  check('peek: cards are not tappable', shown.every((c) => c.disabled));
  check('peek: "Next" marks the top card', container.textContent.includes('Next'));
  await click(byText('button', 'Acknowledge'));
  check('peek: acknowledging ends the action', peek.phase === PHASES.NOMINATION && peek.pendingPower === null);
}

/* ---- Investigate Loyalty ------------------------------------------------ */
{
  const base = seed(9);
  await mount(armed(base, POWERS.INVESTIGATE_LOYALTY));
  await revealPresident();
  const legal = powerTargets(peek, POWERS.INVESTIGATE_LOYALTY, peek.government.presidentId);
  check('investigate: picker offers exactly the legal targets', picks().length === legal.length);
  check('investigate: President is not offered',
    !picks().some((b) => b.textContent.includes(president().name)));
  const confirm = byText('button', 'Investigate');
  check('investigate: confirm disabled until a pick', confirm.disabled === true);
  await click(picks()[0]);
  check('investigate: nothing dispatched on select', peek.pendingPower.result === null);
  await click(byText('button', 'Investigate'));
  const target = peek.players.find((p) => p.id === peek.pendingPower.targetId);
  check('investigate: shows the party membership',
    container.textContent.includes(BOARDS[target.party].label));
  // Scoped to the overlay: the HUD underneath is titled "Secret Hitler XL".
  check('investigate: never names the role',
    target.role !== ROLES.HITLER || !$('[role="dialog"]').textContent.includes('Hitler'));
  check('investigate: says it is a card, not a role',
    container.textContent.includes('membership card, not a role'));
  await click(byText('button', 'Acknowledge'));
  check('investigate: ends the action', peek.phase === PHASES.NOMINATION);
}

/* ---- Special Election --------------------------------------------------- */
{
  const base = seed(9);
  await mount(armed(base, POWERS.SPECIAL_ELECTION));
  await revealPresident();
  const before = president().name;
  await click(picks()[3]);
  await click(byText('button', 'Call special election'));
  const chosen = peek.players.find((p) => p.id === peek.pendingPower.targetId);
  check('special election: confirms the chosen candidate', container.textContent.includes(chosen.name));
  check('special election: not applied until acknowledged', president().name === before);
  await click(byText('button', 'Acknowledge'));
  check('special election: seats the chosen player', peek.government.presidentId === chosen.id);
  check('special election: HUD badges the new President',
    byText('li', 'President')?.textContent.includes(chosen.name));
}

/* ---- Execution, ordinary victim ----------------------------------------- */
{
  const base = seed(9);
  await mount(armed(base, POWERS.EXECUTION));
  await revealPresident();
  // Deliberately not Hitler — shooting him ends the game, which the next block covers.
  const notHitler = peek.players.find((p) => p.role === ROLES.HITLER).name;
  await click(picks().find((b) => !b.textContent.includes(notHitler)));
  await click(byText('button', 'Execute'));
  const victim = peek.players.find((p) => p.id === peek.pendingPower.targetId);
  check('execution: victim marked dead', victim.isAlive === false);
  check('execution: result names them', container.textContent.includes(victim.name));
  check('execution: says they were not Hitler', container.textContent.includes('They were not Hitler'));
  check('execution: HUD lists them as executed', container.textContent.includes(`Executed: ${victim.name}`));
  await click(byText('button', 'Acknowledge'));
  check('execution: ends the action', peek.phase === PHASES.NOMINATION);
}

/* ---- Execution of Hitler: joint victory --------------------------------- */
{
  const base = seed(9);
  await mount(armed(base, POWERS.EXECUTION));
  await revealPresident();
  const hitler = peek.players.find((p) => p.role === ROLES.HITLER);
  const hitlerButton = picks().find((b) => b.textContent.includes(hitler.name));
  await click(hitlerButton);
  await click(byText('button', 'Execute'));
  check('hitler shot: game over immediately', peek.phase === PHASES.GAME_OVER);
  check('hitler shot: both parties recorded as winners',
    peek.winners.includes(PARTIES.LIBERAL) && peek.winners.includes(PARTIES.COMMUNIST));
  check('hitler shot: joint victory headline', container.textContent.includes('Liberal & Communist'));
  check('hitler shot: labelled a joint victory', container.textContent.includes('A joint victory'));
  check('hitler shot: reason shown', container.textContent.includes('Hitler was executed'));
  check('hitler shot: every role revealed',
    peek.players.every((p) => container.textContent.includes(p.name)));
  check('hitler shot: Hitler badged', container.textContent.includes('Hitler'));
  check('hitler shot: offers Play again', Boolean(byText('button', 'Play again')));
}

/* ---- Confession --------------------------------------------------------- */
{
  const base = seed(9);
  await mount(armed(base, POWERS.CONFESSION));
  await revealPresident();
  await click(picks()[2]);
  await click(byText('button', 'Demand confession'));
  const target = peek.players.find((p) => p.id === peek.pendingPower.targetId);
  check('confession: tells the President to show the table',
    container.textContent.includes('Show this screen to the table'));
  check('confession: banner names the target', container.textContent.includes(target.name));
  check('confession: banner states the party membership',
    container.textContent.includes(BOARDS[target.party].label));
  check('confession: membership now public', target.isPartyPublic === true);
  await click(byText('button', 'Continue'));
  check('confession: ends the action', peek.phase === PHASES.NOMINATION);
  check('confession: HUD badges the exposed player',
    byText('li', BOARDS[target.party].label)?.textContent.includes(target.name));
}

/* ---- Radicalisation, ordinary target ------------------------------------ */
{
  const base = seed(9);
  await mount(armed(base, POWERS.RADICALISATION));
  await revealPresident();
  const hitler = peek.players.find((p) => p.role === ROLES.HITLER);
  const victimButton = picks().find((b) => !b.textContent.includes(hitler.name));
  await click(victimButton);
  await click(byText('button', 'Radicalise'));
  const victim = peek.players.find((p) => p.id === peek.pendingPower.targetId);
  check('radicalisation: device handed to the target', peek.handoff.toPlayerId === victim.id);
  check('radicalisation: target overlay names them', $('[role="dialog"]').textContent.includes(victim.name));
  check('radicalisation: outcome hidden until the target reveals',
    !container.textContent.includes('You have been radicalised'));
  check('radicalisation: the President is not shown the outcome',
    !$('[role="dialog"]').textContent.includes('COMMUNIST'));
  await hold($(`button[aria-label="I am ${victim.name} — reveal"]`));
  check('radicalisation: target told they were converted',
    container.textContent.includes('You have been radicalised'));
  check('radicalisation: target told the role is unchanged',
    container.textContent.includes('secret role has not changed'));
  await click(byText('button', 'Acknowledge & pass on'));
  check('radicalisation: ends to NOMINATION', peek.phase === PHASES.NOMINATION);
}

/* ---- Radicalisation aimed at Hitler ------------------------------------- */
{
  const base = seed(9);
  await mount(armed(base, POWERS.RADICALISATION));
  await revealPresident();
  const hitler = peek.players.find((p) => p.role === ROLES.HITLER);
  await click(picks().find((b) => b.textContent.includes(hitler.name)));
  await click(byText('button', 'Radicalise'));
  check('hitler radicalised: state did not mutate',
    peek.players.find((p) => p.id === hitler.id).party === PARTIES.FASCIST);
  await hold($(`button[aria-label="I am ${hitler.name} — reveal"]`));
  check('hitler radicalised: told the conversion failed',
    container.textContent.includes('The conversion failed'));
  check('hitler radicalised: told his card stays Fascist',
    container.textContent.includes('your party membership remains Fascist') ||
    container.textContent.includes('party membership remains Fascist'));
  check('hitler radicalised: told nobody else knows',
    container.textContent.includes('not even the President'));
  await click(byText('button', 'Acknowledge & pass on'));
  check('hitler radicalised: ends to NOMINATION', peek.phase === PHASES.NOMINATION);
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nall executive UI checks passed');
