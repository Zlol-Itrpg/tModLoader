import InterstitialScreen from './InterstitialScreen.jsx';
import PolicyCard from './PolicyCard.jsx';
import { useGame } from '../game/GameContext.jsx';
import { HANDOFF, PHASES } from '../game/constants.js';
import { CHAOS_AT } from '../game/config.js';

/**
 * The veto exchange: the device goes back to the President for one decision.
 *
 * Its own phase rather than a flag on the legislative session, so the screen
 * guard is the same shape as every other phase and the reducer has one obvious
 * place to reject a stray answer.
 */
export default function VetoScreen() {
  const { state, actions } = useGame();
  const { handoff } = state;

  const isActive = state.phase === PHASES.VETO_PRESIDENT_CONSIDER
    && handoff?.kind === HANDOFF.VETO_CONSIDER;
  if (!isActive) return null;

  const president = state.players.find((player) => player.id === handoff.toPlayerId);
  const chancellor = state.players.find((player) => player.id === state.government.chancellorId);
  if (!president) return null;

  const nextTracker = state.election.tracker + 1;
  const wouldTripChaos = nextTracker >= CHAOS_AT;

  return (
    <InterstitialScreen
      playerName={president.name}
      title="Veto proposed"
      kicker="Pass the device back to President"
      instruction={`${chancellor?.name} has proposed a veto. Your call.`}
      warning="Only you answer this."
      confirmLabel={`I am ${president.name} — hear the proposal`}
      revealed={handoff.revealed}
      onReveal={actions.revealHandoff}
      holdMs={350}
      tone="fascist"
    >
      <p className="text-center font-display text-lg leading-snug">
        Chancellor <span className="font-bold">{chancellor?.name}</span> has proposed a veto.
      </p>
      <p className="mt-2 text-center font-stencil text-[0.6875rem] uppercase leading-relaxed tracking-[0.14em] text-ink/60">
        Both policies will be discarded and the election tracker will advance to{' '}
        {nextTracker} of {CHAOS_AT}.
      </p>
      {wouldTripChaos ? (
        <p className="mt-2 text-center font-stencil text-[0.6875rem] uppercase leading-relaxed tracking-[0.14em] text-fascist">
          That is the third failure — the country falls into chaos and the top policy
          is enacted with no power granted.
        </p>
      ) : null}

      <div className="mt-5 flex gap-3 opacity-90">
        {state.legislative.cards.map((card) => (
          <PolicyCard key={card.id} party={card.party} disabled />
        ))}
      </div>

      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={() => actions.answerVeto(true)}
          className="h-16 w-full rounded-sm bg-communist font-stencil text-sm uppercase
                     tracking-[0.22em] text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)]
                     transition-transform active:translate-y-[3px] active:shadow-none"
        >
          Consent to veto
        </button>
        <button
          type="button"
          onClick={() => actions.answerVeto(false)}
          className="h-16 w-full rounded-sm border-2 border-ink bg-transparent font-stencil text-sm
                     uppercase tracking-[0.22em] text-ink transition-transform
                     active:translate-y-[2px]"
        >
          Reject veto
        </button>
      </div>
    </InterstitialScreen>
  );
}
