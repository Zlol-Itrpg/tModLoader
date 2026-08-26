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
const LegislativePresident = (await import('../../src/components/LegislativePresident.jsx')).default;
const LegislativeChancellor = (await import('../../src/components/LegislativeChancellor.jsx')).default;
const VetoScreen = (await import('../../src/components/VetoScreen.jsx')).default;
const { PHASES, PARTIES, ROLES, VOTES } = await import('../../src/game/constants.js');
const { eligibleChancellors } = await import('../../src/game/reducer.js');
const { BOARDS } = await import('../../src/game/config.js');

let peek = null, act$ = null;
function Probe() { peek = useGameState(); act$ = useGameActions(); return null; }
function Tree() { return (<><Probe /><GameHUD /><LegislativePresident /><LegislativeChancellor /><VetoScreen /></>); }

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const container = document.getElementById('root');
const root = createRoot(container);
await act(async () => { root.render(<GameProvider initialOptions={{ names: NAMES }}><Tree /></GameProvider>); });

const $ = (s) => container.querySelector(s);
const $$ = (s) => [...container.querySelectorAll(s)];
const byText = (sel, t) => $$(sel).find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase()));
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const hold = async (el, ms = 600) => {
  await act(async () => { el.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, ms)); });
};
const D = async (fn) => { await act(async () => { fn(); }); };
const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const cards = () => $$('button[aria-label$="policy"]');
const total = () => peek.deck.length + peek.discard.length + peek.legislative.cards.length
  + Object.values(peek.boards).reduce((a, b) => a + b.enacted, 0);

await D(() => act$.startGame());
for (let i = 0; i < NAMES.length; i++) { await D(() => act$.revealHandoff()); await D(() => act$.continueHandoff()); }
async function elect() {
  const pick = eligibleChancellors(peek).find((p) => p.role !== ROLES.HITLER) ?? eligibleChancellors(peek)[0];
  await D(() => act$.nominateChancellor(pick.id));
  for (let i = 0; i < peek.players.filter((p) => p.isAlive).length; i++) {
    await D(() => act$.revealHandoff()); await D(() => act$.castVote(VOTES.JA));
  }
  await D(() => act$.resolveElection());
}

/* ---- President ---------------------------------------------------------- */
await elect();
const startCards = total();
check('president: phase is LEGISLATIVE_PRESIDENT', peek.phase === PHASES.LEGISLATIVE_PRESIDENT);
const pres = peek.players.find((p) => p.id === peek.government.presidentId);
const chan = peek.players.find((p) => p.id === peek.government.chancellorId);
check('president: overlay names the President', $('[role="dialog"]').textContent.includes(pres.name));
check('president: no policies visible before reveal', cards().length === 0);
await hold($(`button[aria-label="I am ${pres.name} — show the policies"]`));
check('president: three cards face up', cards().length === 3);
check('president: cards carry their party styling',
  cards().every((c) => ['bg-liberal', 'bg-fascist', 'bg-communist'].some((cls) => c.className.includes(cls))));
check('president: card labels match the dealt hand',
  cards().map((c) => c.getAttribute('aria-label')).join() ===
    peek.legislative.cards.map((c) => `${BOARDS[c.party].label} policy`).join());
check('president: prompt shown', container.textContent.includes('Select one policy to discard.'));
check('president: names the chancellor', container.textContent.includes(chan.name));
const discardBtn = byText('button', 'Discard & pass on');
check('president: confirm disabled until a card is picked', discardBtn.disabled === true);
const binned = peek.legislative.cards[1];
await click(cards()[1]);
check('president: selection marks the card', cards()[1].getAttribute('aria-pressed') === 'true');
check('president: nothing dispatched on select', peek.phase === PHASES.LEGISLATIVE_PRESIDENT && peek.legislative.cards.length === 3);
await click(byText('button', 'Discard & pass on'));
check('president: handed to the Chancellor', peek.phase === PHASES.LEGISLATIVE_CHANCELLOR);
check('president: hand down to two', peek.legislative.cards.length === 2);
check('president: binned card is in the discard pile', peek.discard.includes(binned.party));
check('president: conservation holds', total() === startCards);

/* ---- Chancellor + veto refusal ------------------------------------------ */
check('chancellor: covered until revealed', cards().length === 0);
check('chancellor: overlay names the Chancellor', $('[role="dialog"]').textContent.includes(chan.name));
await hold($(`button[aria-label="I am ${chan.name} — show the policies"]`));
check('chancellor: two cards face up', cards().length === 2);
check('chancellor: prompt shown', container.textContent.includes('Select one policy to enact.'));
check('chancellor: veto locked below 5 fascist policies', !byText('button', 'Propose veto'));
check('chancellor: veto threshold explained', container.textContent.includes('Veto unlocks at 5 Fascist policies'));

// Reset through the reducer (re-rendering the same provider reconciles rather
// than remounts, so its state would survive), then drive the fascist track to 5.
// A run can end early — a rival track completes, or an execution ends it — so
// retry the climb rather than silently skipping the veto checks.
const { eligiblePowerTargets } = await import('../../src/game/reducer.js');
const { POWER_INFO } = await import('../../src/game/constants.js');

for (let attempt = 0; attempt < 12; attempt++) {
  await D(() => act$.resetGame());
  if (attempt === 0) check('reset: back to SETUP', peek.phase === PHASES.SETUP);
  await D(() => act$.startGame());
  for (let i = 0; i < NAMES.length; i++) { await D(() => act$.revealHandoff()); await D(() => act$.continueHandoff()); }

  for (let round = 0; round < 25; round++) {
    if (peek.boards[PARTIES.FASCIST].enacted >= 5 || peek.phase === PHASES.GAME_OVER) break;
    await elect();
    if (peek.phase !== PHASES.LEGISLATIVE_PRESIDENT) continue;
    await D(() => act$.revealHandoff());
    const hand = peek.legislative.cards;
    const toBin = hand.find((c) => c.party !== PARTIES.FASCIST) ?? hand[0];
    await D(() => act$.discardPolicy(toBin.id));
    await D(() => act$.revealHandoff());
    const held = peek.legislative.cards;
    const fascist = held.find((c) => c.party === PARTIES.FASCIST);
    const safest = [...held].sort((a, b) => peek.boards[a.party].enacted - peek.boards[b.party].enacted)[0];
    await D(() => act$.enactPolicy((fascist ?? safest).id));
    while (peek.phase === PHASES.EXECUTIVE_ACTION) {
      if (!peek.handoff.revealed) await D(() => act$.revealHandoff());
      if (peek.pendingPower.result === null) {
        await D(() => act$.resolvePower(eligiblePowerTargets(peek)[0].id));
      }
      if (peek.phase !== PHASES.EXECUTIVE_ACTION) break;
      if (!peek.handoff.revealed) await D(() => act$.revealHandoff());
      await D(() => act$.endExecutiveAction());
    }
  }
  if (peek.boards[PARTIES.FASCIST].enacted >= 5 && peek.phase !== PHASES.GAME_OVER) break;
}
console.log('  fascist track:', peek.boards[PARTIES.FASCIST].enacted, '| phase:', peek.phase);

check('setup: fascist track reached 5 so the veto is live',
  peek.boards[PARTIES.FASCIST].enacted >= 5 && peek.phase !== PHASES.GAME_OVER);
if (peek.boards[PARTIES.FASCIST].enacted >= 5 && peek.phase !== PHASES.GAME_OVER) {
  /* ---- Veto, consented -------------------------------------------------- */
  await elect();
  const presA = peek.players.find((p) => p.id === peek.government.presidentId);
  const chanA = peek.players.find((p) => p.id === peek.government.chancellorId);
  const cardsA = total();
  const trackerA = peek.election.tracker;
  const fascistA = peek.boards[PARTIES.FASCIST].enacted;
  await hold($(`button[aria-label="I am ${presA.name} — show the policies"]`));
  await click(cards()[0]);
  await click(byText('button', 'Discard & pass on'));
  await hold($(`button[aria-label="I am ${chanA.name} — show the policies"]`));
  await click(byText('button', 'Propose veto'));
  await hold($(`button[aria-label="I am ${presA.name} — hear the proposal"]`));
  await click(byText('button', 'Consent to veto'));
  check('consent: hand emptied', peek.legislative.cards.length === 0);
  check('consent: no policy enacted', peek.boards[PARTIES.FASCIST].enacted === fascistA);
  check('consent: tracker advanced by one', peek.election.tracker === trackerA + 1);
  check('consent: rotated to the next nomination', peek.phase === PHASES.NOMINATION);
  check('consent: overlay is down', peek.handoff === null);
  check('consent: conservation holds', total() === cardsA);
  check('consent: HUD shows the advanced tracker',
    container.textContent.includes(`${trackerA + 1}/3`));

  /* ---- Veto, rejected --------------------------------------------------- */
  await elect();
  const pres2 = peek.players.find((p) => p.id === peek.government.presidentId);
  const chan2 = peek.players.find((p) => p.id === peek.government.chancellorId);
  const cardCount = total();
  await hold($(`button[aria-label="I am ${pres2.name} — show the policies"]`));
  await click(cards()[0]);
  await click(byText('button', 'Discard & pass on'));
  await hold($(`button[aria-label="I am ${chan2.name} — show the policies"]`));
  const held = peek.legislative.cards.map((c) => c.party).join();
  check('veto: Propose veto button appears at 5 fascist policies', Boolean(byText('button', 'Propose veto')));
  await click(byText('button', 'Propose veto'));
  check('veto: sub-phase entered', peek.phase === PHASES.VETO_PRESIDENT_CONSIDER);
  check('veto: overlay addresses the President', $('[role="dialog"]').textContent.includes(pres2.name));
  check('veto: buttons hidden before reveal', !byText('button', 'Consent to veto'));
  await hold($(`button[aria-label="I am ${pres2.name} — hear the proposal"]`));
  check('veto: names the proposing Chancellor', container.textContent.includes(chan2.name));
  check('veto: warns about the tracker', container.textContent.includes('election tracker will advance'));
  check('veto: shows the two policies, untappable', cards().length === 2 && cards().every((c) => c.disabled));
  check('veto: both answers offered', Boolean(byText('button', 'Consent to veto')) && Boolean(byText('button', 'Reject veto')));

  await click(byText('button', 'Reject veto'));
  check('reject: back to the Chancellor', peek.phase === PHASES.LEGISLATIVE_CHANCELLOR);
  check('reject: hand unchanged', peek.legislative.cards.map((c) => c.party).join() === held);
  check('reject: conservation holds', total() === cardCount);
  await hold($(`button[aria-label="I am ${chan2.name} — show the policies"]`));
  check('reject: banner shown to the Chancellor',
    container.textContent.includes(`President ${pres2.name} rejected the veto. You must enact a policy.`));
  const vetoBtn = byText('button', 'Veto rejected');
  check('reject: veto button now disabled', vetoBtn && vetoBtn.disabled === true);

  const trackerBefore = peek.election.tracker;
  await click(cards()[0]);
  await click(byText('button', 'Enact this policy'));
  check('reject: a policy was enacted', peek.phase !== PHASES.LEGISLATIVE_CHANCELLOR);
  check('reject: tracker reset by the enactment', peek.election.tracker === 0 || trackerBefore === 0);
  check('reject: conservation holds after enactment', total() === cardCount);
} else {
  console.log('  (skipped veto UI: run did not reach 5 fascist policies)');
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nlegislative UI checks passed');
