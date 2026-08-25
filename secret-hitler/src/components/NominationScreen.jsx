import { useEffect, useState } from 'react';
import { useGame } from '../game/GameContext.jsx';
import { eligibleChancellors } from '../game/reducer.js';
import { PHASES } from '../game/constants.js';

/**
 * The one public phase: the President picks in the open, so no interstitial.
 *
 * Eligibility comes straight from the reducer's `eligibleChancellors`; this
 * screen never re-derives a term limit, it only greys out what it is handed.
 */
export default function NominationScreen() {
  const { state, actions } = useGame();
  const [selectedId, setSelectedId] = useState(null);

  const isActive = state.phase === PHASES.NOMINATION;

  // A new President clears the previous President's half-made choice.
  useEffect(() => {
    setSelectedId(null);
  }, [state.government.presidentId, isActive]);

  if (!isActive) return null;

  const president = state.players.find((player) => player.id === state.government.presidentId);
  const alive = state.players.filter((player) => player.isAlive);
  const eligibleIds = new Set(eligibleChancellors(state).map((player) => player.id));

  const reasonFor = (player) => {
    if (player.id === president.id) return 'You';
    if (player.id === state.lastElectedGovernment.chancellorId) return 'Term-limited';
    if (player.id === state.lastElectedGovernment.presidentId) return 'Term-limited';
    return 'Ineligible';
  };

  return (
    <section className="shrink-0 border-t-2 border-ink/20 bg-paper/60 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
      <h2 className="font-display text-xl leading-snug">
        President <span className="font-bold">{president.name}</span>, nominate your Chancellor.
      </h2>
      <p className="mt-0.5 font-stencil text-[0.625rem] uppercase tracking-[0.18em] text-ink/50">
        Say it out loud. The table votes next.
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2">
        {alive.map((player) => {
          const isEligible = eligibleIds.has(player.id);
          const isSelected = player.id === selectedId;

          return (
            <li key={player.id}>
              <button
                type="button"
                disabled={!isEligible}
                aria-pressed={isSelected}
                onClick={() => setSelectedId(player.id)}
                className={`flex h-14 w-full flex-col items-center justify-center rounded-sm border-2 px-2
                            transition-transform active:translate-y-[1px]
                            ${isSelected
                              ? 'border-ink bg-ink text-paper'
                              : 'border-ink/25 bg-paper text-ink'}
                            disabled:border-dashed disabled:border-ink/20 disabled:bg-transparent
                            disabled:text-ink/35 disabled:active:translate-y-0`}
              >
                <span className="max-w-full truncate font-display text-base leading-tight">
                  {player.name}
                </span>
                {!isEligible ? (
                  <span className="font-stencil text-[0.5625rem] uppercase tracking-[0.14em]">
                    {reasonFor(player)}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={!selectedId}
        onClick={() => actions.nominateChancellor(selectedId)}
        className="mt-4 h-16 w-full rounded-sm bg-fascist font-stencil text-sm uppercase
                   tracking-[0.24em] text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)]
                   transition-transform active:translate-y-[3px] active:shadow-none
                   disabled:bg-ink/20 disabled:text-ink/40 disabled:shadow-none
                   disabled:active:translate-y-0"
      >
        Confirm nomination
      </button>
    </section>
  );
}
