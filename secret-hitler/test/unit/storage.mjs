import { JSDOM } from 'jsdom';
const dom = new JSDOM('', { url: 'https://example.test' });
global.window = dom.window;
global.localStorage = dom.window.localStorage;
globalThis.localStorage = dom.window.localStorage;

const { SAVE_KEY, SAVE_VERSION, loadSave, writeSave, clearSave } =
  await import('../../src/game/storage.js');
const { createInitialState } = await import('../../src/game/initialState.js');
const { gameReducer, actions } = await import('../../src/game/reducer.js');

const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const raw = () => localStorage.getItem(SAVE_KEY);

/* ---- Round trip --------------------------------------------------------- */
{
  localStorage.clear();
  check('empty storage reads as no save', loadSave() === null);

  let s = createInitialState({ names: ['A', 'B', 'C', 'D', 'E', 'F'] });
  s = gameReducer(s, actions.startGame());
  for (let i = 0; i < 6; i++) { s = gameReducer(s, actions.revealHandoff()); s = gameReducer(s, actions.continueHandoff()); }
  check('write reports success', writeSave(s) === true);

  const back = loadSave();
  check('a mid-game save round-trips exactly', JSON.stringify(back) === JSON.stringify(s));
  check('secret roles survive the round trip',
    back.players.every((p, i) => p.role === s.players[i].role && p.party === s.players[i].party));
  check('the deck order survives', back.deck.join() === s.deck.join());
  check('the save carries a version stamp', JSON.parse(raw()).version === SAVE_VERSION);

  clearSave();
  check('clearSave removes the key', raw() === null && loadSave() === null);
}

/* ---- Every way a save can be unusable ----------------------------------- */
{
  const good = createInitialState({ names: ['A', 'B', 'C', 'D'] });
  const cases = [
    ['not JSON at all', '{ this is not json'],
    ['truncated JSON', JSON.stringify({ version: SAVE_VERSION, state: good }).slice(0, 80)],
    ['empty string', ''],
    ['JSON null', 'null'],
    ['a bare array', '[]'],
    ['no version stamp', JSON.stringify({ state: good })],
    ['an older version', JSON.stringify({ version: SAVE_VERSION - 1, state: good })],
    ['a newer version', JSON.stringify({ version: SAVE_VERSION + 1, state: good })],
    ['no state', JSON.stringify({ version: SAVE_VERSION })],
    ['state is a string', JSON.stringify({ version: SAVE_VERSION, state: 'nope' })],
    ['state is an array', JSON.stringify({ version: SAVE_VERSION, state: [] })],
    ['a slice went missing', JSON.stringify({ version: SAVE_VERSION, state: { ...good, boards: undefined } })],
    ['players is not an array', JSON.stringify({ version: SAVE_VERSION, state: { ...good, players: {} } })],
    ['deck is not an array', JSON.stringify({ version: SAVE_VERSION, state: { ...good, deck: 17 } })],
    ['an unknown phase', JSON.stringify({ version: SAVE_VERSION, state: { ...good, phase: 'LEGISLATIVE_TRIBUNAL' } })],
    // The shape from an earlier build of this app, before the hand was merged.
    ['a genuinely older state shape', JSON.stringify({
      version: SAVE_VERSION,
      state: { phase: 'NOMINATION', players: [], boards: {}, deck: [], discard: [],
        government: {}, legislative: { drawn: [], chancellorHand: [] }, config: {} },
    })],
  ];

  for (const [label, payload] of cases) {
    localStorage.setItem(SAVE_KEY, payload);
    let result, threw = false;
    try { result = loadSave(); } catch { threw = true; }
    check(`rejects ${label}`, !threw && result === null);
    check(`  and deletes it, so it is only read once`, raw() === null);
  }
}

/* ---- Storage that refuses to work --------------------------------------- */
{
  const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('blocked by privacy settings'); },
  });
  let threw = false;
  try {
    check('load survives storage that throws on access', loadSave() === null);
    check('write survives storage that throws on access', writeSave({}) === false);
    clearSave();
  } catch { threw = true; }
  check('clearSave survives storage that throws on access', threw === false);

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem() { return null; },
      setItem() { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; },
      removeItem() {},
    },
  });
  check('a full quota is reported, not thrown', writeSave({ phase: 'SETUP' }) === false);

  Object.defineProperty(globalThis, 'localStorage', real);
  localStorage.clear();
  check('storage works again afterwards', writeSave(createInitialState({ names: ['A'] })) === true);
  clearSave();
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\nstorage is total: no input crashes it');
