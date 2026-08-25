import { useEffect, useState } from 'react';
import InterstitialScreen from './InterstitialScreen.jsx';
import PolicyCard from './PolicyCard.jsx';
import { useGame } from '../game/GameContext.jsx';
import { isVetoUnlocked } from '../game/reducer.js';
import { HANDOFF, PHASES } from '../game/constants.js';
import { VETO_UNLOCKS_AT } from '../game/config.js';

/**
 * The Chancellor's half: two cards in, one policy out.
 *
 * Veto eligibility comes from the reducer's `isVetoUnlocked`, and whether the
 * button is still available comes from `legislative.vetoRejected` — this screen
 * decides neither, it only renders them.
 */
export default function LegislativeChancellor() {
  const { state, actions } = useGame();
  const [selectedId, setSelectedId] = useState(null);
  const { handoff, legislative } = state;

  const isActive = state.phase === PHASES.LEGISLATIVE_CHANCELLOR
    && handoff?.kind === HANDOFF.CHANCELLOR_LEGISLATIVE;

  useEffect(() => {
    if (!isActive) setSelectedId(null);
  }, [isActive]);

  if (!isActive) return null;

  const chancellor = state.players.find((player) => player.id === handoff.toPlayerId);
  const president = state.players.find((player) => player.id === state.government.presidentId);
  if (!chancellor) return null;

  const vetoAvailable = isVetoUnlocked(state) && !legislative.vetoRejected;

  return (
    <InterstitialScreen
      playerName={chancellor.name}
      title="Your legislative session"
      kicker="Pass the device to Chancellor"
      instruction={
        legislative.vetoRejected
          ? `${president?.name} refused the veto. You must enact one of these.`
          : 'The President passed you two policies. One of them becomes law.'
      }
      warning="Only you see these two."
      confirmLabel={`I am ${chancellor.name} — show the policies`}
      revealed={handoff.revealed}
      onReveal={actions.revealHandoff}
      holdMs={350}
      tone="neutral"
    >
      {legislative.vetoRejected ? (
        <p
          role="status"
          className="mb-4 rounded-sm border-2 border-fascist/60 bg-fascist/10 px-3 py-2.5 text-center
                     font-stencil text-[0.6875rem] uppercase leading-relaxed tracking-[0.14em] text-fascist"
        >
          President {president?.name} rejected the veto. You must enact a policy.
        </p>
      ) : null}

      <p className="text-center font-display text-lg leading-snug">
        Select one policy to enact.
      </p>
      <p className="mt-1 text-center font-stencil text-[0.625rem] uppercase tracking-[0.18em] text-ink/50">
        The other is discarded
      </p>

      <div className="perspective-card stagger mt-5 flex gap-3 [--stagger:90ms]">
        {legislative.cards.map((card, index) => (
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
        onClick={() => actions.enactPolicy(selectedId)}
        className="mt-6 h-16 w-full rounded-sm bg-ink font-stencil text-sm uppercase tracking-[0.22em]
                   text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)] transition-transform
                   active:translate-y-[3px] active:shadow-none
                   disabled:bg-ink/20 disabled:text-ink/40 disabled:shadow-none
                   disabled:active:translate-y-0"
      >
        Enact this policy
      </button>

      {isVetoUnlocked(state) ? (
        <button
          type="button"
          disabled={!vetoAvailable}
          onClick={actions.requestVeto}
          className="mt-2 h-14 w-full rounded-sm border-2 border-ink/40 bg-transparent font-stencil
                     text-xs uppercase tracking-[0.2em] text-ink transition-transform
                     active:translate-y-[1px]
                     disabled:border-dashed disabled:border-ink/20 disabled:text-ink/35
                     disabled:active:translate-y-0"
        >
          {legislative.vetoRejected ? 'Veto rejected' : 'Propose veto'}
        </button>
      ) : (
        <p className="mt-3 text-center font-stencil text-[0.625rem] uppercase tracking-[0.14em] text-ink/40">
          Veto unlocks at {VETO_UNLOCKS_AT} Fascist policies
        </p>
      )}
    </InterstitialScreen>
  );
}
