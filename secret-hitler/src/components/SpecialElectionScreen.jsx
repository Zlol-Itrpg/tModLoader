import { useState } from 'react';
import TargetPicker, { ConfirmButton } from './TargetPicker.jsx';
import { useGame } from '../game/GameContext.jsx';
import { eligiblePowerTargets } from '../game/reducer.js';

/**
 * Special Election. The seat change is applied by END_EXECUTIVE_ACTION, so the
 * President reads the confirmation before the device moves on.
 */
export default function SpecialElectionScreen() {
  const { state, actions } = useGame();
  const [selectedId, setSelectedId] = useState(null);
  const { result, targetId } = state.pendingPower;

  if (!result) {
    return (
      <>
        <TargetPicker
          targets={eligiblePowerTargets(state)}
          selectedId={selectedId}
          onSelect={setSelectedId}
          prompt="Choose the next Presidential Candidate."
          note="One turn only — the rotation resumes from your seat"
        />
        <ConfirmButton disabled={!selectedId} onClick={() => actions.resolvePower(selectedId)}>
          Call special election
        </ConfirmButton>
      </>
    );
  }

  const target = state.players.find((player) => player.id === targetId);

  return (
    <>
      <p className="text-center font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-ink/55">
        Special election called
      </p>
      <p className="mt-3 text-center font-display text-[clamp(2rem,11vw,3rem)] font-bold leading-none">
        {target?.name}
      </p>
      <p className="mt-4 text-center font-display text-base leading-snug text-ink/75">
        {target?.name} nominates next. After that turn the presidency returns to the
        seat after yours.
      </p>

      <ConfirmButton onClick={actions.endExecutiveAction}>Acknowledge</ConfirmButton>
    </>
  );
}
