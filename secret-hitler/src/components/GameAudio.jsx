import { useEffect, useRef } from 'react';
import { useGameState } from '../game/GameContext.jsx';
import {
  playFanfare,
  playGavel,
  playHeartbeat,
  playPaperShuffle,
  playStampThud,
} from '../utils/audio.js';
import haptics from '../utils/haptics.js';

/**
 * Sound and vibration, driven from state rather than from click handlers.
 *
 * Cues fire on *transitions* — a policy count going up, the ballot closing —
 * so a cue cannot be attached to one button and then missed when the same
 * transition is reached another way (chaos enacting a policy, say, which no
 * button dispatches). It also keeps the components free of effects entirely.
 *
 * Renders nothing.
 */
export default function GameAudio() {
  const state = useGameState();
  const previous = useRef(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (!before) return; // First render is not a transition.

    const enacted = (s) => Object.values(s.boards).reduce((total, b) => total + b.enacted, 0);
    const alive = (s) => s.players.filter((p) => p.isAlive).length;

    // A policy hitting the board, however it got there.
    if (enacted(state) > enacted(before)) {
      playStampThud();
      haptics.heavy();
    }

    // Someone was executed.
    if (alive(state) < alive(before)) {
      playHeartbeat(1);
      haptics.heavy();
    }

    // A ballot was cast.
    const votes = (s) => Object.keys(s.election.votes).length;
    if (votes(state) > votes(before)) haptics.medium();

    // The tally landing, and the gavel only if the government stands.
    if (state.election.result && !before.election.result) {
      if (state.election.result.passed) playGavel();
    }

    // Hidden information coming into view.
    if (state.handoff?.revealed && !before.handoff?.revealed) {
      playPaperShuffle();
      // A role reveal is the tense one; the rest are just paper.
      if (state.handoff.kind === 'ROLE_REVEAL') playHeartbeat(2);
    }

    // The reckoning.
    if (state.winners && !before.winners) {
      playFanfare(state.winners);
      haptics.pattern();
    }
  }, [state]);

  return null;
}
