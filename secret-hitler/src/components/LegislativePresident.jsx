import { useEffect, useState } from 'react';
import InterstitialScreen from './InterstitialScreen.jsx';
import PolicyCard from './PolicyCard.jsx';
import { useGame } from '../game/GameContext.jsx';
import { HANDOFF, PHASES } from '../game/constants.js';

/**
 * The President's half of the session: draw three, bin one.
 *
 * The cards arrive already dealt — the reducer draws them when the election
 * resolves, reshuffling the discard pile back in if the deck is short, so this
 * screen never has to think about the deck at all.
 *
 * Discarding is select-then-confirm rather than a single tap: the choice is
 * irreversible, invisible to the table, and often decides the game, so a
 * mis-tap while the phone changes hands is not something to leave on the table.
 */
export default function LegislativePresident() {
  const { state, actions } = useGame();
  const [selectedId, setSelectedId] = useState(null);
  const { handoff } = state;

  const isActive = state.phase === PHASES.LEGISLATIVE_PRESIDENT
    && handoff?.kind === HANDOFF.PRESIDENT_LEGISLATIVE;

  useEffect(() => {
    if (!isActive) setSelectedId(null);
  }, [isActive]);

  if (!isActive) return null;

  const president = state.players.find((player) => player.id === handoff.toPlayerId);
  const chancellor = state.players.find((player) => player.id === state.government.chancellorId);
  if (!president) return null;

  return (
    <InterstitialScreen
      playerName={president.name}
      title="Your legislative session"
      kicker="Pass the device to President"
      instruction="Three policies were drawn. You will discard one and pass the other two on."
      warning="Only you see these three."
      confirmLabel={`I am ${president.name} — show the policies`}
      revealed={handoff.revealed}
      onReveal={actions.revealHandoff}
      holdMs={350}
      tone="neutral"
    >
      <p className="text-center font-display text-lg leading-snug">
        Select one policy to discard.
      </p>
      <p className="mt-1 text-center font-stencil text-[0.625rem] uppercase tracking-[0.18em] text-ink/50">
        The other two go to {chancellor?.name}
      </p>

      <div className="perspective-card stagger mt-5 flex gap-2 [--stagger:90ms]">
        {state.legislative.cards.map((card, index) => (
          <PolicyCard
            key={card.id}
            party={card.party}
            selected={card.id === selectedId}
            onSelect={() => setSelectedId(card.id)}
            className="animate-flip-in"
            style={{ '--i': index }}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!selectedId}
        onClick={() => actions.discardPolicy(selectedId)}
        className="mt-6 h-16 w-full rounded-sm bg-ink font-stencil text-sm uppercase tracking-[0.22em]
                   text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)] transition-transform
                   active:translate-y-[3px] active:shadow-none
                   disabled:bg-ink/20 disabled:text-ink/40 disabled:shadow-none
                   disabled:active:translate-y-0"
      >
        Discard &amp; pass on
      </button>
    </InterstitialScreen>
  );
}
