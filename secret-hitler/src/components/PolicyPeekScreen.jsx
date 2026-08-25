import PolicyCard from './PolicyCard.jsx';
import { ConfirmButton } from './TargetPicker.jsx';
import { useGame } from '../game/GameContext.jsx';

/**
 * Policy Peek. Nothing to choose — the reducer turned the cards over when the
 * power triggered, so this only displays them.
 */
export default function PolicyPeekScreen() {
  const { state, actions } = useGame();
  const cards = state.pendingPower.result?.cards ?? [];

  return (
    <>
      <p className="text-center font-display text-lg leading-snug">
        The next three policies, in order.
      </p>
      <p className="mt-1 text-center font-stencil text-[0.625rem] uppercase tracking-[0.18em] text-ink/50">
        They stay on top of the deck
      </p>

      <ol className="mt-5 flex gap-2">
        {cards.map((party, index) => (
          <li key={index} className="flex flex-1 flex-col items-center gap-1">
            <span className="font-stencil text-[0.625rem] uppercase tracking-[0.18em] text-ink/45">
              {index === 0 ? 'Next' : `+${index}`}
            </span>
            <PolicyCard party={party} disabled />
          </li>
        ))}
      </ol>

      <ConfirmButton onClick={actions.endExecutiveAction}>Acknowledge</ConfirmButton>
    </>
  );
}
