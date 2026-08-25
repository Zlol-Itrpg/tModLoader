import { useState } from 'react';
import TargetPicker, { ConfirmButton } from './TargetPicker.jsx';
import { useGame } from '../game/GameContext.jsx';
import { eligiblePowerTargets } from '../game/reducer.js';
import { BOARDS } from '../game/config.js';
import { PARTIES } from '../game/constants.js';

const BANNER = {
  [PARTIES.LIBERAL]: 'bg-liberal text-paper',
  [PARTIES.FASCIST]: 'bg-fascist text-paper',
  [PARTIES.COMMUNIST]: 'bg-communist text-paper',
};

/**
 * Confession. The only power whose result is public — the President holds the
 * screen up and the whole table reads it, so it is deliberately loud.
 */
export default function ConfessionScreen() {
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
          prompt="Force one player to confess."
          note="Their party membership becomes public, permanently"
        />
        <ConfirmButton disabled={!selectedId} onClick={() => actions.resolvePower(selectedId)}>
          Demand confession
        </ConfirmButton>
      </>
    );
  }

  const target = state.players.find((player) => player.id === targetId);

  return (
    <>
      <p className="rounded-sm border-2 border-ink bg-ink px-3 py-2 text-center font-stencil
                    text-[0.6875rem] uppercase tracking-[0.2em] text-paper">
        Show this screen to the table
      </p>

      <div className={`mt-3 rounded-sm px-4 py-10 text-center ${BANNER[result.party]}`}>
        <p className="font-display text-2xl leading-tight">{target?.name}</p>
        <p className="mt-2 font-stencil text-[0.6875rem] uppercase tracking-[0.28em] opacity-80">
          Party membership
        </p>
        <p className="mt-1 font-display text-[clamp(2.5rem,14vw,4rem)] font-bold uppercase leading-none">
          {BOARDS[result.party].label}
        </p>
      </div>

      <p className="mt-4 text-center font-stencil text-[0.625rem] uppercase leading-relaxed tracking-[0.14em] text-ink/50">
        This stays public for the rest of the game.
      </p>

      <ConfirmButton onClick={actions.endExecutiveAction}>Continue</ConfirmButton>
    </>
  );
}
