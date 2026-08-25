/**
 * Synthesised sound effects, built from oscillators and noise buffers.
 *
 * Nothing here is fetched. That is not a purity exercise: an offline-first PWA
 * would otherwise need every sample in the precache and a cache-busting story
 * for each one, and `<audio>` elements on older phones stall for tens of
 * milliseconds before the first sample plays — long enough that a tap and its
 * sound stop feeling connected. Oscillators start on the next audio frame.
 *
 * Every entry point is a no-op rather than a throw when there is no
 * AudioContext (jsdom, a locked-down browser) or when the table has muted the
 * game. Sound is decoration; it must never be able to interrupt a game.
 */

const MUTE_KEY = 'secret-hitler-muted';

let context = null;
let master = null;
let noise = null;
let muted = readMuted();
const listeners = new Set();

/** When the last scheduled voice finishes, in context time. */
let scheduledUntil = 0;
/** Pending idle-suspend timer. */
let idleTimer = null;

/**
 * How long after the last voice to park the context. An AudioContext in the
 * `running` state holds the output device open, which on a phone keeps the
 * audio hardware powered for a game that makes a noise every thirty seconds.
 */
const IDLE_SUSPEND_MS = 4000;

/* -------------------------------------------------------------------------- */
/* Plumbing                                                                    */
/* -------------------------------------------------------------------------- */

function readMuted() {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Park the context once everything scheduled has finished playing. */
function scheduleIdleSuspend() {
  if (typeof setTimeout !== 'function') return;
  if (idleTimer !== null) clearTimeout(idleTimer);

  // Wait out whatever is still sounding, then the idle margin. Clamped, and
  // deliberately *not* re-armed by re-reading the clock when it fires: a
  // context whose clock does not advance would otherwise loop forever. Any
  // genuinely newer sound arms its own timer through this same function.
  const remaining = context ? Math.max(0, scheduledUntil - context.currentTime) * 1000 : 0;
  const delay = Math.min(remaining, 10000) + IDLE_SUSPEND_MS;

  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (context?.state === 'running') context.suspend?.().catch(() => {});
  }, delay);

  // Node only: an idle-audio timer must never be the reason a test run or a
  // CLI process refuses to exit. A no-op in the browser.
  idleTimer?.unref?.();
}

/**
 * Lazily build the context. Browsers refuse to start audio before a user
 * gesture, so this is called from inside handlers rather than at import time.
 * @returns {AudioContext|null}
 */
function ctx() {
  if (muted) return null;
  if (context) {
    // Both the autoplay policy and our own idle suspend park the context; a
    // call from inside a gesture is exactly when it is allowed to wake up.
    if (context.state === 'suspended') context.resume?.().catch(() => {});
    return context;
  }

  const Ctor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (typeof Ctor !== 'function') return null;

  try {
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    return context;
  } catch {
    context = null;
    return null;
  }
}

/** Shared white-noise source material — cheaper than rebuilding it per hit. */
function noiseBuffer(audio) {
  if (noise) return noise;
  const frames = Math.floor(audio.sampleRate * 0.6);
  noise = audio.createBuffer(1, frames, audio.sampleRate);
  const channel = noise.getChannelData(0);
  for (let i = 0; i < frames; i += 1) channel[i] = Math.random() * 2 - 1;
  return noise;
}

/** Percussive envelope: near-instant attack, exponential tail. */
function envelope(audio, { peak = 0.3, attack = 0.004, decay = 0.2, at = 0, output = null }) {
  const gain = audio.createGain();
  const t = audio.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  gain.connect(output ?? master);

  const stop = t + attack + decay + 0.02;
  scheduledUntil = Math.max(scheduledUntil, stop);
  return { gain, start: t, stop };
}

/**
 * Tear a finished voice out of the graph.
 *
 * Without this every effect leaves its gain node wired to the master bus
 * forever. They are silent, but they are still nodes on a live graph, and a
 * long game schedules them in the hundreds.
 */
function releaseOnEnd(source, ...nodes) {
  source.onended = () => {
    for (const node of [source, ...nodes]) {
      try {
        node.disconnect();
      } catch {
        // Already torn down.
      }
    }
  };
}

function tone(audio, { type = 'sine', from, to, ...env }) {
  const { gain, start, stop } = envelope(audio, env);
  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, stop);
  osc.connect(gain);
  releaseOnEnd(osc, gain);
  osc.start(start);
  osc.stop(stop);
  return osc;
}

function hiss(audio, { filter = 'highpass', frequency = 2000, q = 0.7, ...env }) {
  const { gain, start, stop } = envelope(audio, env);
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer(audio);
  source.loop = true;
  const band = audio.createBiquadFilter();
  band.type = filter;
  band.frequency.value = frequency;
  band.Q.value = q;
  source.connect(band).connect(gain);
  releaseOnEnd(source, band, gain);
  source.start(start);
  source.stop(stop);
  return source;
}

/** Wrap a voice so a synthesis failure can never surface as a game error. */
function play(voice) {
  const audio = ctx();
  if (!audio) return false;
  try {
    voice(audio);
    scheduleIdleSuspend();
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Mute                                                                        */
/* -------------------------------------------------------------------------- */

export const isMuted = () => muted;

export function setMuted(next) {
  muted = Boolean(next);
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, String(muted));
  } catch {
    // A device that will not persist the preference still honours it in memory.
  }
  if (muted && context) {
    try {
      master.gain.setValueAtTime(0.0001, context.currentTime);
    } catch {
      // Nothing playing; nothing to silence.
    }
  } else if (!muted && master && context) {
    try {
      master.gain.setValueAtTime(0.5, context.currentTime);
    } catch {
      // The next voice will set it anyway.
    }
  }
  listeners.forEach((listener) => listener(muted));
  return muted;
}

export const toggleMuted = () => setMuted(!muted);

/** Subscribe to mute changes; returns an unsubscribe. */
export function onMuteChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* -------------------------------------------------------------------------- */
/* Voices                                                                      */
/* -------------------------------------------------------------------------- */

/** Card drawn, card selected: a short filtered noise brush. */
export const playPaperShuffle = () =>
  play((audio) => {
    hiss(audio, { frequency: 2600, peak: 0.16, attack: 0.006, decay: 0.13 });
    hiss(audio, { frequency: 4200, q: 1.2, peak: 0.07, attack: 0.01, decay: 0.09, at: 0.045 });
  });

/** A policy hitting the board: low punch plus the click of the stamp. */
export const playStampThud = () =>
  play((audio) => {
    tone(audio, { type: 'sine', from: 150, to: 42, peak: 0.55, decay: 0.34 });
    tone(audio, { type: 'triangle', from: 96, to: 38, peak: 0.28, decay: 0.2 });
    // The wooden contact, a hair before the body of the thud.
    hiss(audio, { filter: 'bandpass', frequency: 1500, q: 1.4, peak: 0.2, attack: 0.002, decay: 0.05 });
  });

/** Government elected: two crisp wooden knocks. */
export const playGavel = () =>
  play((audio) => {
    for (const at of [0, 0.13]) {
      tone(audio, { type: 'triangle', from: 420, to: 180, peak: 0.3, attack: 0.002, decay: 0.09, at });
      hiss(audio, { filter: 'bandpass', frequency: 2200, q: 2.4, peak: 0.22, attack: 0.001, decay: 0.06, at });
    }
  });

/** Dread: a sub-bass lub-dub, optionally repeated. */
export const playHeartbeat = (beats = 2) =>
  play((audio) => {
    for (let beat = 0; beat < beats; beat += 1) {
      const at = beat * 0.86;
      tone(audio, { type: 'sine', from: 62, to: 40, peak: 0.5, attack: 0.012, decay: 0.24, at });
      tone(audio, { type: 'sine', from: 54, to: 34, peak: 0.34, attack: 0.014, decay: 0.3, at: at + 0.3 });
    }
  });

/* Victory music. Frequencies in Hz; roughly A3-centred so it sits under speech. */
const CHORDS = {
  // Bright major arpeggio into a full triad: brass-ish saws through a lowpass.
  LIBERAL: { type: 'sawtooth', cutoff: 2400, steps: [[220], [277.18], [329.63], [220, 277.18, 329.63, 440]] },
  // A low minor-second cluster that just sits there. Deliberately unpleasant.
  FASCIST: { type: 'sawtooth', cutoff: 900, steps: [[110, 116.54], [110, 116.54], [110, 116.54, 164.81]] },
  // Minor opening resolving up to the major: anthem shape.
  COMMUNIST: { type: 'square', cutoff: 1800, steps: [[220, 261.63], [246.94, 293.66], [220, 277.18, 329.63]] },
  // Both at once: the communist anthem with the liberal triad on top.
  JOINT: { type: 'sawtooth', cutoff: 2200, steps: [[220, 261.63], [246.94, 311.13], [220, 277.18, 329.63, 440]] },
};

/**
 * @param {string|string[]} winner one party, or the joint Liberal+Communist win
 */
export function playFanfare(winner) {
  const parties = Array.isArray(winner) ? winner : [winner];
  const key = parties.length > 1 ? 'JOINT' : parties[0];
  const chart = CHORDS[key] ?? CHORDS.LIBERAL;

  return play((audio) => {
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = chart.cutoff;
    filter.connect(master);

    const beat = key === 'FASCIST' ? 0.55 : 0.26;
    let lastVoice = null;
    chart.steps.forEach((chord, index) => {
      const at = index * beat;
      const last = index === chart.steps.length - 1;
      chord.forEach((frequency) => {
        const { gain, start, stop } = envelope(audio, {
          peak: 0.2 / Math.sqrt(chord.length),
          attack: key === 'FASCIST' ? 0.14 : 0.02,
          decay: last ? 1.5 : beat * 0.9,
          at,
          output: filter,
        });

        const osc = audio.createOscillator();
        osc.type = chart.type;
        osc.frequency.setValueAtTime(frequency, start);
        // A touch of detune so the chord has some width.
        osc.detune.setValueAtTime(index % 2 ? 6 : -6, start);
        osc.connect(gain);
        releaseOnEnd(osc, gain);
        osc.start(start);
        osc.stop(stop);
        lastVoice = osc;
      });
    });

    // The filter is shared by the whole fanfare, so it goes with the last note.
    if (lastVoice) {
      const releaseVoice = lastVoice.onended;
      lastVoice.onended = () => {
        releaseVoice?.();
        try {
          filter.disconnect();
        } catch {
          // Already torn down.
        }
      };
    }
  });
}

/** Test seam: drop the context so the next call rebuilds it. */
export function resetAudio() {
  if (idleTimer !== null) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  try {
    context?.close?.();
  } catch {
    // Already closed.
  }
  context = null;
  master = null;
  noise = null;
  scheduledUntil = 0;
}

/** Test seam: what the context is doing right now. */
export const audioState = () => context?.state ?? 'closed';
