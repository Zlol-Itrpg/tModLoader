import { chromium } from 'playwright';
import { createInitialState } from '../../src/game/initialState.js';
import { gameReducer, actions } from '../../src/game/reducer.js';
import { PHASES, PARTIES, POWERS, ROLES, HANDOFF, WIN_REASONS } from '../../src/game/constants.js';

const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const URL = process.env.PREVIEW_URL || 'http://localhost:4173/';
// Undefined lets Playwright use its own managed download (what CI does).
const EXE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

/** A finished game with a given outcome, valid enough for the save loader. */
function finished(winners, winReason) {
  let s = createInitialState({ names: ['Braden', 'Dawson', 'Danielle', 'Marguerite', 'Ellis', 'Ines', 'Osric'] });
  s = gameReducer(s, actions.startGame());
  for (let i = 0; i < 7; i++) { s = gameReducer(s, actions.revealHandoff()); s = gameReducer(s, actions.continueHandoff()); }
  return {
    ...s,
    phase: PHASES.GAME_OVER,
    winners,
    winReason,
    handoff: null,
    boards: { ...s.boards, [winners[0]]: { ...s.boards[winners[0]], enacted: 5 } },
  };
}

const browser = await chromium.launch({ executablePath: EXE });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});

// Record every AudioContext the page constructs, and every vibrate call.
await context.addInitScript(() => {
  window.__audio = { contexts: 0, oscillators: 0 };
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(...args) { super(...args); window.__audio.contexts += 1; }
    createOscillator() { window.__audio.oscillators += 1; return super.createOscillator(); }
  };
  window.__vibrations = [];
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: (p) => { window.__vibrations.push(p); return true; },
  });
});

const page = await context.newPage();

/* ---- Sound, haptics and the animation classes --------------------------- */
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });

/** Back to a fresh setup screen, keeping the mute preference. */
async function restart() {
  await page.evaluate(() => localStorage.removeItem('secret-hitler-save'));
  await page.reload({ waitUntil: 'networkidle' });
}
/** Deal, then hold to reveal the first player's role. */
async function dealAndReveal() {
  await page.evaluate(() => { window.__audio.oscillators = 0; window.__vibrations.length = 0; });
  await page.getByRole('button', { name: 'Deal roles' }).click();
  const reveal = page.locator('button[aria-label*="reveal my role"]').first();
  await reveal.dispatchEvent('pointerdown');
  await page.waitForTimeout(900);
}

// The mute switch has to be reachable *before* the first reveal: once a game is
// under way the interstitials cover the HUD.
const muteButton = page.locator('button[aria-label="Mute sound"]');
check('setup: the mute switch is reachable before dealing', await muteButton.isVisible());
await muteButton.click();
check('mute: the preference persists', await page.evaluate(() => localStorage.getItem('secret-hitler-muted')) === 'true');

await restart();
await dealAndReveal();
check('mute: a muted reveal makes no sound', (await page.evaluate(() => window.__audio.oscillators)) === 0);
check('mute: haptics are independent of it',
  (await page.evaluate(() => window.__vibrations.length)) > 0);

await restart();
await page.locator('button[aria-label="Unmute sound"]').click();
check('mute: unmuting persists too', await page.evaluate(() => localStorage.getItem('secret-hitler-muted')) === 'false');

await restart();
await page.getByRole('button', { name: 'Deal roles' }).click();
check('role reveal: the curtain animates in',
  await page.locator('[role="dialog"]').evaluate((el) => getComputedStyle(el).animationName) === 'curtain-in');
await page.evaluate(() => { window.__audio.oscillators = 0; window.__vibrations.length = 0; });
await page.locator('button[aria-label*="reveal my role"]').first().dispatchEvent('pointerdown');
await page.waitForTimeout(900);

check('role reveal: the payload flips in',
  await page.locator('[role="dialog"] main > div').evaluate((el) => getComputedStyle(el).animationName) === 'flip-in');
check('role reveal: the parent carries 3D perspective',
  await page.locator('[role="dialog"] main').evaluate((el) => getComputedStyle(el).perspective) !== 'none');

const audioAfterReveal = await page.evaluate(() => window.__audio);
check('audio: a context was built on a gesture', audioAfterReveal.contexts >= 1);
check('audio: unmuted, voices are scheduled', audioAfterReveal.oscillators > 0);
const buzzed = await page.evaluate(() => window.__vibrations);
check('haptics: the reveal buzzed at 15ms', buzzed.length > 0 && buzzed[0] === 15);

/* ---- prefers-reduced-motion --------------------------------------------- */
const reducedPage = await context.newPage();
await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
await reducedPage.goto(URL, { waitUntil: 'networkidle' });
// The context shares storage with the page above, which is mid-game.
await reducedPage.evaluate(() => localStorage.removeItem('secret-hitler-save'));
await reducedPage.reload({ waitUntil: 'networkidle' });
await reducedPage.getByRole('button', { name: 'Deal roles' }).click();
const duration = await reducedPage.locator('[role="dialog"]').evaluate((el) => getComputedStyle(el).animationDuration);
check('reduced motion: animations are neutered', parseFloat(duration) < 0.001);
await reducedPage.close();

/* ---- Every victory flourish renders ------------------------------------- */
const outcomes = [
  [[PARTIES.LIBERAL], WIN_REASONS.POLICY_TRACK, 'liberal'],
  [[PARTIES.FASCIST], WIN_REASONS.POLICY_TRACK, 'fascist'],
  [[PARTIES.COMMUNIST], WIN_REASONS.POLICY_TRACK, 'communist'],
  [[PARTIES.LIBERAL, PARTIES.COMMUNIST], WIN_REASONS.HITLER_EXECUTED, 'joint'],
];
for (const [winners, reason, label] of outcomes) {
  const save = JSON.stringify({ version: 1, state: finished(winners, reason) });
  const victory = await context.newPage();
  await victory.addInitScript((s) => localStorage.setItem('secret-hitler-save', s), save);
  await victory.goto(`${URL}?v=${label}`, { waitUntil: 'networkidle' });
  await victory.waitForTimeout(700);

  const text = await victory.textContent('body');
  check(`${label}: game-over screen shown`, text.includes('Play again'));
  check(`${label}: headline names the winner`,
    winners.every((w) => text.includes(w.charAt(0) + w.slice(1).toLowerCase())));
  const flourish = await victory.locator('div[aria-hidden="true"].pointer-events-none').first();
  check(`${label}: a flourish layer rendered`, await flourish.count() > 0);
  // Reopening a finished game is not a transition, so it must stay silent —
  // nobody wants a fanfare because they reloaded the tab an hour later.
  check(`${label}: reopening a finished game does not replay the fanfare`,
    (await victory.evaluate(() => window.__audio.oscillators)) === 0);

  await victory.screenshot({ path: `/tmp/victory-${label}.png` });
  await victory.close();
}

/* ---- The fanfare, on a real transition ---------------------------------- */
{
  // A game one tap from over: the President is holding a loaded Execution.
  // Distinct multi-letter names: a single letter matches half the UI by accident.
  let s = createInitialState({ names: ['Ada', 'Bram', 'Cleo', 'Dov', 'Esme', 'Fen', 'Gita', 'Hal', 'Iris'] });
  s = gameReducer(s, actions.startGame());
  for (let i = 0; i < 9; i++) { s = gameReducer(s, actions.revealHandoff()); s = gameReducer(s, actions.continueHandoff()); }
  const shooter = s.players.find((p) => p.role !== ROLES.HITLER);
  const hitler = s.players.find((p) => p.role === ROLES.HITLER);
  s = {
    ...s,
    phase: PHASES.EXECUTIVE_ACTION,
    government: { ...s.government, presidentId: shooter.id },
    pendingPower: { power: POWERS.EXECUTION, presidentId: shooter.id, targetId: null, result: null },
    handoff: { kind: HANDOFF.EXECUTIVE_ACTION, toPlayerId: shooter.id, revealed: false, payload: {} },
  };

  const live = await context.newPage();
  await live.addInitScript((save) => localStorage.setItem('secret-hitler-save', save),
    JSON.stringify({ version: 1, state: s }));
  await live.goto(`${URL}?live=1`, { waitUntil: 'networkidle' });

  await live.locator(`button[aria-label*="use Execution"]`).dispatchEvent('pointerdown');
  await live.waitForTimeout(800);
  await live.evaluate(() => { window.__audio.oscillators = 0; window.__vibrations.length = 0; });

  // Scoped to the picker list, so the HUD's controls cannot match by accident.
  await live.locator('li button[aria-pressed]').filter({ hasText: hitler.name }).first().click();
  await live.getByRole('button', { name: 'Execute', exact: true }).click();
  await live.waitForTimeout(500);

  const text = await live.textContent('body');
  check('live: shooting Hitler ends the game', text.includes('Play again'));
  check('live: the joint victory is announced', text.includes('A joint victory'));
  check('live: a fanfare played on the transition',
    (await live.evaluate(() => window.__audio.oscillators)) > 0);
  const vibes = await live.evaluate(() => window.__vibrations);
  check('live: game over double-pulsed',
    vibes.some((v) => Array.isArray(v) && v.join() === '40,60,40'));
  await live.screenshot({ path: '/tmp/victory-live-joint.png' });
  await live.close();
}

await browser.close();
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\njuice verified in a real browser');
