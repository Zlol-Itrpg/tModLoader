import { useState } from 'react';
import TargetPicker, { ConfirmButton } from './TargetPicker.jsx';
import { useGame } from '../game/GameContext.jsx';
import { eligiblePowerTargets } from '../game/reducer.js';
import { BOARDS } from '../game/config.js';
import { PARTIES } from '../game/constants.js';

const PARTY_FACE = {
  [PARTIES.LIBERAL]: 'border-liberal bg-liberal/10 text-liberal',
  [PARTIES.FASCIST]: 'border-fascist bg-fascist/10 text-fascist',
  [PARTIES.COMMUNIST]: 'border-communist bg-communist/10 text-communist',
};

/**
 * Investigate Loyalty. The card shows a party membership and nothing else —
 * Hitler reads as Fascist, exactly as the physical card does.
 */
export default function InvestigateLoyaltyScreen() {
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
          prompt="Investigate one player's loyalty."
          note="Nobody may be investigated twice"
        />
        <ConfirmButton disabled={!selectedId} onClick={() => actions.resolvePower(selectedId)}>
          Investigate
        </ConfirmButton>
      </>
    );
  }

  const target = state.players.find((player) => player.id === targetId);

  return (
    <>
      <p className="text-center font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-ink/55">
        Party membership
      </p>
      <p className="mt-1 text-center font-display text-2xl leading-tight">{target?.name}</p>

      <div className={`mt-5 rounded-sm border-2 px-5 py-8 text-center ${PARTY_FACE[result.party]}`}>
        <span className="font-display text-[clamp(2rem,11vw,3rem)] font-bold uppercase leading-none">
          {BOARDS[result.party].label}
        </span>
      </div>

      <p className="mt-4 text-center font-stencil text-[0.625rem] uppercase leading-relaxed tracking-[0.14em] text-ink/50">
        This is a membership card, not a role. Say what you like about it.
      </p>

      <ConfirmButton onClick={actions.endExecutiveAction}>Acknowledge</ConfirmButton>
    </>
  );
}
