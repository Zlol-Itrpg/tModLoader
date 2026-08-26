const check = (l, c) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) process.exitCode = 1; };
const A = '../../src/utils/audio.js';
const H = '../../src/utils/haptics.js';

/* ---- 1. A bare Node environment: no window, no AudioContext, no navigator - */
{
  const audio = await import(A);
  const { haptics } = await import(H);

  check('audio: imports with no window at all', typeof audio.playStampThud === 'function');
  for (const name of ['playPaperShuffle', 'playStampThud', 'playGavel', 'playHeartbeat']) {
    let threw = false;
    let result;
    try { result = audio[name](); } catch { threw = true; }
    check(`audio: ${name}() is a silent no-op, not a throw`, !threw && result === false);
  }
  let threw = false;
  try { audio.playFanfare(['LIBERAL', 'COMMUNIST']); } catch { threw = true; }
  check('audio: playFanfare() survives a headless environment', !threw);
  check('audio: starts unmuted', audio.isMuted() === false);

  for (const name of ['light', 'medium', 'heavy', 'pattern']) {
    let hThrew = false, hResult;
    try { hResult = haptics[name](); } catch { hThrew = true; }
    check(`haptics: ${name}() no-ops without navigator.vibrate`, !hThrew && hResult === false);
  }
}

/* ---- 2. A browser-shaped environment with a recording AudioContext -------- */
{
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test' });
  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  globalThis.localStorage = dom.window.localStorage;

  const log = { oscillators: [], buffers: [], filters: [], gains: 0, closed: false };
  class FakeParam {
    constructor() { this.value = 0; this.events = []; }
    setValueAtTime(v, t) { this.value = v; this.events.push(['set', v, t]); return this; }
    exponentialRampToValueAtTime(v, t) { this.events.push(['ramp', v, t]); return this; }
  }
  class FakeNode {
    constructor() { this.connections = []; }
    connect(target) { this.connections.push(target); return target; }
    disconnect() { this.connections = []; }
  }
  class FakeAudioContext {
    constructor() { this.state = 'running'; this.sampleRate = 48000; this.currentTime = 0; this.destination = new FakeNode(); }
    createGain() { log.gains += 1; const n = new FakeNode(); n.gain = new FakeParam(); return n; }
    createOscillator() {
      const n = new FakeNode();
      n.frequency = new FakeParam(); n.detune = new FakeParam(); n.type = 'sine';
      n.start = (t) => { n.startedAt = t; }; n.stop = (t) => { n.stoppedAt = t; };
      log.oscillators.push(n); return n;
    }
    createBufferSource() {
      const n = new FakeNode();
      n.start = (t) => { n.startedAt = t; }; n.stop = (t) => { n.stoppedAt = t; };
      log.buffers.push(n); return n;
    }
    createBuffer(channels, frames, rate) {
      const data = new Float32Array(frames);
      return { length: frames, sampleRate: rate, getChannelData: () => data };
    }
    createBiquadFilter() {
      const n = new FakeNode();
      n.frequency = new FakeParam(); n.Q = new FakeParam(); n.type = 'lowpass';
      log.filters.push(n); return n;
    }
    close() { log.closed = true; }
    resume() { return Promise.resolve(); }
  }
  global.AudioContext = FakeAudioContext;
  globalThis.AudioContext = FakeAudioContext;

  const audio = await import(`${A}?browser`);
  const reset = () => { log.oscillators.length = 0; log.buffers.length = 0; log.filters.length = 0; };

  reset();
  check('paper shuffle: plays', audio.playPaperShuffle() === true);
  check('paper shuffle: is noise, not tone', log.buffers.length === 2 && log.oscillators.length === 0);
  check('paper shuffle: high-passed', log.filters.every((f) => f.type === 'highpass'));
  check('paper shuffle: short', log.buffers.every((b) => b.stoppedAt - b.startedAt < 0.25));

  reset();
  audio.playStampThud();
  check('stamp: has a low body', log.oscillators.some((o) => o.frequency.value <= 150));
  check('stamp: drops in pitch',
    log.oscillators.some((o) => o.frequency.events.some(([kind, v]) => kind === 'ramp' && v < 60)));
  check('stamp: has a contact transient', log.buffers.length === 1);

  reset();
  audio.playGavel();
  check('gavel: two knocks', log.oscillators.length === 2 && log.buffers.length === 2);
  const knocks = log.oscillators.map((o) => o.startedAt).sort((a, b) => a - b);
  check('gavel: the second lands after the first', knocks[1] - knocks[0] > 0.05);

  reset();
  audio.playHeartbeat(2);
  check('heartbeat: lub-dub, twice', log.oscillators.length === 4);
  check('heartbeat: sub-bass only', log.oscillators.every((o) => o.frequency.value < 80));

  for (const [winner, label] of [
    ['LIBERAL', 'liberal'], ['FASCIST', 'fascist'], ['COMMUNIST', 'communist'],
    [['LIBERAL', 'COMMUNIST'], 'joint'],
  ]) {
    reset();
    audio.playFanfare(winner);
    check(`fanfare (${label}): sounds`, log.oscillators.length >= 3);
    check(`fanfare (${label}): shaped by a lowpass`, log.filters.some((f) => f.type === 'lowpass'));
    check(`fanfare (${label}): plays as a sequence`,
      new Set(log.oscillators.map((o) => o.startedAt)).size >= 2);
  }
  reset();
  audio.playFanfare('FASCIST');
  const fascistVoices = log.oscillators.map((o) => o.frequency.value);
  reset();
  audio.playFanfare('LIBERAL');
  const liberalVoices = log.oscillators.map((o) => o.frequency.value);
  check('fanfare: the fascist win is pitched lower than the liberal one',
    Math.min(...fascistVoices) < Math.min(...liberalVoices));

  /* ---- Mute ---------------------------------------------------------- */
  reset();
  audio.setMuted(true);
  check('mute: reported', audio.isMuted() === true);
  check('mute: persisted', localStorage.getItem('secret-hitler-muted') === 'true');
  check('mute: nothing plays', audio.playStampThud() === false && log.oscillators.length === 0);
  audio.playFanfare('LIBERAL');
  check('mute: not even the fanfare', log.oscillators.length === 0);

  let notified = null;
  const off = audio.onMuteChange((v) => { notified = v; });
  audio.toggleMuted();
  check('mute: subscribers are told', notified === false);
  check('mute: toggling restores sound', audio.playGavel() === true);
  off();
  audio.toggleMuted();
  check('mute: unsubscribed listeners stop hearing', notified === false);
  audio.setMuted(false);

  /* ---- A hostile context --------------------------------------------- */
  audio.resetAudio();
  globalThis.AudioContext = class { constructor() { throw new Error('blocked'); } };
  check('audio: a constructor that throws is survived', audio.playGavel() === false);

  audio.resetAudio();
  globalThis.AudioContext = class extends FakeAudioContext {
    createOscillator() { throw new Error('node limit'); }
  };
  check('audio: a failure mid-voice is contained', audio.playStampThud() === false);

  globalThis.AudioContext = FakeAudioContext;
  audio.resetAudio();
  check('audio: recovers afterwards', audio.playPaperShuffle() === true);

  /* ---- Haptics with a vibrate implementation -------------------------- */
  // Node 22 exposes a getter-only global navigator; add vibrate onto it rather
  // than replacing it, which is also what a real browser looks like.
  const calls = [];
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    configurable: true,
    value: (p) => { calls.push(p); return true; },
  });
  const { haptics, PATTERNS } = await import(`${H}?browser`);
  haptics.light(); haptics.medium(); haptics.heavy(); haptics.pattern();
  check('haptics: light is 15ms', calls[0] === PATTERNS.light && calls[0] === 15);
  check('haptics: medium is 40ms', calls[1] === 40);
  check('haptics: heavy is 100ms', calls[2] === 100);
  check('haptics: pattern double-pulses', JSON.stringify(calls[3]) === JSON.stringify([40, 60, 40]));

  Object.defineProperty(globalThis.navigator, 'vibrate', {
    configurable: true,
    value: () => { throw new Error('needs a user gesture'); },
  });
  check('haptics: a throwing vibrate is contained', haptics.light() === false);
}
console.log(process.exitCode ? '\nFAILURES ABOVE' : '\naudio + haptics verified, and safe in a headless environment');
