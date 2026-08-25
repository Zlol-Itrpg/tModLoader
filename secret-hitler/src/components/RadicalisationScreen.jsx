import { useState } from 'react';
import TargetPicker, { ConfirmButton } from './TargetPicker.jsx';
import { useGame } from '../game/GameContext.jsx';
import { eligiblePowerTargets } from '../game/reducer.js';

/**
 * Radicalisation, President's half: pick someone and hand the phone over.
 *
 * The President never learns whether it worked — the result screen goes to the
 * target alone, which is the whole gamble of the power.
 */
export default function RadicalisationScreen() {
  const { state, actions } = useGame();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <>
      <TargetPicker
        targets={eligiblePowerTargets(state)}
        selectedId={selectedId}
        onSelect={setSelectedId}
        prompt="Radicalise one player."
        note="Hand them the device afterwards — you will not be told the outcome"
      />
      <ConfirmButton disabled={!selectedId} onClick={() => actions.resolvePower(selectedId)}>
        Radicalise
      </ConfirmButton>
    </>
  );
}
