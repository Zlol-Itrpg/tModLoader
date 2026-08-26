const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'https://example.test', pretendToBeVisual: true });
global.window = dom.window; global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement; global.Event = dom.window.Event;
global.localStorage = dom.window.localStorage; globalThis.localStorage = dom.window.localStorage;
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
global.IS_REACT_ACT_ENVIRONMENT = true;

/* ---- 1. Audio graph hygiene + idle suspend ------------------------------ */
{
  let created = 0, disconnected = 0;
  const ended = [];
  class P { constructor(){this.value=0;} setValueAtTime(){return this;} exponentialRampToValueAtTime(){return this;} }
  class N { connect(t){ return t; } disconnect(){ disconnected += 1; } }
  const source = () => {
    const n = new N(); n.start = () => {};
    n.stop = () => { ended.push(n); };
    return n;
  };
  let suspended = 0, resumed = 0;
  class FakeCtx {
    constructor(){
      this.state = 'running'; this.sampleRate = 48000; this.destination = new N();
      // A real context's clock advances while it runs and freezes when
      // suspended. A frozen clock would make the idle check reschedule forever.
      this._origin = Date.now(); this._frozen = null;
    }
    get currentTime() {
      return this._frozen ?? (Date.now() - this._origin) / 1000;
    }
    createGain(){ created += 1; const n=new N(); n.gain=new P(); return n; }
    createOscillator(){ const n=source(); n.frequency=new P(); n.detune=new P(); return n; }
    createBufferSource(){ return source(); }
    createBuffer(c,f){ const d=new Float32Array(f); return {getChannelData:()=>d}; }
    createBiquadFilter(){ const n=new N(); n.frequency=new P(); n.Q=new P(); return n; }
    suspend(){ suspended += 1; this.state='suspended'; this._frozen = this.currentTime; return Promise.resolve(); }
    resume(){ resumed += 1; this.state='running'; this._origin = Date.now() - (this._frozen ?? 0) * 1000; this._frozen = null; return Promise.resolve(); }
    close(){ return Promise.resolve(); }
  }
  globalThis.AudioContext = FakeCtx;

  const audio = await import('../../src/utils/audio.js');
  for (let i = 0; i < 100; i++) { audio.playPaperShuffle(); audio.playStampThud(); audio.playGavel(); }
  audio.playFanfare(['LIBERAL', 'COMMUNIST']);
  check('audio: voices are scheduled', created > 300);
  check('audio: nothing disconnected while still playing', disconnected === 0);

  // Every source reports ended, as the browser does when stop() elapses.
  ended.forEach((node) => node.onended?.());
  check('audio: every finished voice tears itself out of the graph', disconnected >= created);
  check('audio: no gain node is left wired to the master bus', disconnected - created >= 0);

  // Idle suspend. Start from a clean context so the wait is bounded by one
  // short voice rather than the fanfare's long tail.
  audio.resetAudio();
  audio.playGavel();
  check('audio: the context is running while in use', audio.audioState() === 'running');
  await new Promise((r) => setTimeout(r, 4800));
  check('audio: parks itself once idle', audio.audioState() === 'suspended' && suspended >= 1);
  audio.playGavel();
  check('audio: wakes on the next sound', resumed >= 1);
  audio.resetAudio();
  check('audio: reset clears the idle timer and closes', audio.audioState() === 'closed');
}

/* ---- 2. Haptic coalescing ----------------------------------------------- */
{
  const calls = [];
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    configurable: true, value: (p) => { calls.push(p); return true; },
  });
  const { haptics, resetHaptics } = await import('../../src/utils/haptics.js');

  resetHaptics();
  // A policy enacting and its handoff revealing land in the same commit.
  haptics.heavy();
  haptics.light();
  haptics.light();
  check('haptics: a weaker pulse cannot truncate a stronger one', calls.length === 1 && calls[0] === 100);

  resetHaptics(); calls.length = 0;
  haptics.light();
  haptics.heavy();
  check('haptics: a stronger pulse still gets through', calls.length === 2 && calls[1] === 100);

  resetHaptics(); calls.length = 0;
  haptics.pattern();
  haptics.heavy();
  check('haptics: game over is never truncated by a later cue',
    calls.length === 1 && Array.isArray(calls[0]));

  resetHaptics(); calls.length = 0;
  haptics.light();
  await new Promise((r) => setTimeout(r, 160));
  haptics.light();
  check('haptics: outside the window everything fires normally', calls.length === 2);
}

/* ---- 3. matchMedia is absent in jsdom, and nothing may throw ------------- */
{
  check('jsdom: matchMedia really is missing', typeof dom.window.matchMedia === 'undefined');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { useReducedMotion } = await import('../../src/hooks/useReducedMotion.js');

  let value = 'unset';
  function Probe() { value = useReducedMotion(); return null; }
  const root = createRoot(document.getElementById('root'));
  let threw = false;
  try {
    await act(async () => { root.render(<Probe />); });
  } catch { threw = true; }
  check('useReducedMotion: renders without matchMedia', !threw && value === false);
  await act(async () => { root.unmount(); });

  // And with one, it must register exactly once.
  const registered = [];
  dom.window.matchMedia = (query) => ({
    matches: true,
    media: query,
    addEventListener: (t, f) => registered.push(['addEventListener', f]),
    removeEventListener: (t, f) => {
      const i = registered.findIndex(([k, fn]) => k === 'addEventListener' && fn === f);
      if (i >= 0) registered.splice(i, 1);
    },
    addListener: (f) => registered.push(['addListener', f]),
    removeListener: (f) => {
      const i = registered.findIndex(([k, fn]) => k === 'addListener' && fn === f);
      if (i >= 0) registered.splice(i, 1);
    },
  });
  const root2 = createRoot(document.createElement('div'));
  await act(async () => { root2.render(<Probe />); });
  check('useReducedMotion: reads the preference', value === true);
  check('useReducedMotion: registers exactly one listener, not two', registered.length === 1);
  await act(async () => { root2.unmount(); });
  check('useReducedMotion: unregisters on unmount', registered.length === 0);
  delete dom.window.matchMedia;
}

/* ---- 4. Hydration re-covers hidden information -------------------------- */
{
  const { createInitialState } = await import('../../src/game/initialState.js');
  const { gameReducer, actions } = await import('../../src/game/reducer.js');
  const { SAVE_KEY, SAVE_VERSION, loadSave } = await import('../../src/game/storage.js');
  const { HANDOFF } = await import('../../src/game/constants.js');

  let s = createInitialState({ names: ['A', 'B', 'C', 'D', 'E'] });
  s = gameReducer(s, actions.startGame());
  s = gameReducer(s, actions.revealHandoff());
  check('setup: the save is taken with a secret on screen',
    s.handoff.revealed === true && s.handoff.kind === HANDOFF.ROLE_REVEAL);

  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: s }));
  const restored = loadSave();
  check('hydration: the handoff is restored', restored.handoff.kind === HANDOFF.ROLE_REVEAL);
  check('hydration: but re-covered, so the secret needs a fresh tap',
    restored.handoff.revealed === false);
  check('hydration: the recipient is unchanged', restored.handoff.toPlayerId === s.handoff.toPlayerId);
  check('hydration: roles survive intact',
    restored.players.map((p) => p.role).join() === s.players.map((p) => p.role).join());

  // The re-covered state is still a legal machine state: guards hold.
  const blocked = gameReducer(restored, actions.continueHandoff());
  check('hydration: acting on a re-covered handoff is refused until revealed', blocked === restored);
  const revealed = gameReducer(restored, actions.revealHandoff());
  check('hydration: one tap puts the game back where it was', revealed.handoff.revealed === true);

  // A save with no handoff at all must pass through untouched.
  const plain = { ...restored, handoff: null };
  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: plain }));
  check('hydration: a save with no handoff is untouched', loadSave().handoff === null);
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\naudit fixes verified');
