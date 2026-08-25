import { useState } from 'react';
import TargetPicker, { ConfirmButton } from './TargetPicker.jsx';
import { useGame } from '../game/GameContext.jsx';
import { eligiblePowerTargets } from '../game/reducer.js';

/**
 * Execution.
 *
 * If the target is Hitler the reducer ends the game outright, so this screen's
 * result view is only ever reached when someone else was shot.
 */
export default function ExecutionScreen() {
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
          prompt="Execute one player."
          note="They lose their vote and their voice for the rest of the game"
        />
        <ConfirmButton
          tone="danger"
          disabled={!selectedId}
          onClick={() => actions.resolvePower(selectedId)}
        >
          Execute
        </ConfirmButton>
      </>
    );
  }

  const target = state.players.find((player) => player.id === targetId);

  return (
    <>
      <p className="text-center font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-ink/55">
        Executed
      </p>
      <p className="mt-3 text-center font-display text-[clamp(2rem,11vw,3rem)] font-bold leading-none text-communist line-through">
        {target?.name}
      </p>
      <p className="mt-4 text-center font-display text-base leading-snug text-ink/75">
        They were not Hitler. Their role stays secret.
      </p>

      <ConfirmButton onClick={actions.endExecutiveAction}>Acknowledge</ConfirmButton>
    </>
  );
}
