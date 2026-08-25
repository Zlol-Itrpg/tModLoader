import InterstitialScreen from './InterstitialScreen.jsx';
import { useGame } from '../game/GameContext.jsx';
import { HANDOFF, PHASES, VOTES } from '../game/constants.js';

/**
 * The secret ballot.
 *
 * The reducer owns the loop: it seats the first voter when the nomination is
 * confirmed, and each CAST_VOTE either hands off to the next living player or
 * parks the machine at VOTE_REVEAL. This screen just renders whoever
 * `state.handoff.toPlayerId` names, so the loop is not duplicated here.
 *
 * There is no "done" button — casting the vote *is* the acknowledgement.
 */
export default function VotingScreen() {
  const { state, actions } = useGame();
  const { handoff } = state;

  if (state.phase !== PHASES.VOTING || handoff?.kind !== HANDOFF.VOTE) return null;

  const voter = state.players.find((player) => player.id === handoff.toPlayerId);
  if (!voter) return null;

  const alive = state.players.filter((player) => player.isAlive);
  const ballotNumber = alive.findIndex((player) => player.id === voter.id) + 1;
  const president = state.players.find((player) => player.id === state.government.presidentId);
  const nominee = state.players.find((player) => player.id === state.government.nomineeId);

  return (
    <InterstitialScreen
      playerName={voter.name}
      title="Your ballot"
      kicker={`Ballot ${ballotNumber} of ${alive.length} — pass the device to`}
      instruction="Vote in secret. The whole table sees every ballot once the last one is in."
      warning="Nobody watches you tap."
      confirmLabel={`I am ${voter.name} — show my ballot`}
      revealed={handoff.revealed}
      onReveal={actions.revealHandoff}
      holdMs={350}
      tone="neutral"
    >
      <div className="flex min-h-full flex-col">
        <div className="text-center">
          <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-ink/55">
            Vote on this government
          </p>
          <dl className="mt-3 space-y-2">
            <div className="rounded-sm border border-ink/20 bg-paper/70 px-4 py-3">
              <dt className="font-stencil text-[0.625rem] uppercase tracking-[0.2em] text-ink/50">
                President
              </dt>
              <dd className="font-display text-2xl leading-tight">{president?.name}</dd>
            </div>
            <div className="rounded-sm border border-ink/20 bg-paper/70 px-4 py-3">
              <dt className="font-stencil text-[0.625rem] uppercase tracking-[0.2em] text-ink/50">
                Chancellor
              </dt>
              <dd className="font-display text-2xl leading-tight">{nominee?.name}</dd>
            </div>
          </dl>
        </div>

        {/* Two targets, each a third of the screen — no mis-taps. */}
        <div className="mt-6 grid flex-1 grid-rows-2 gap-3">
          <button
            type="button"
            onClick={() => actions.castVote(VOTES.JA)}
            className="min-h-[7rem] rounded-sm border-2 border-ink/30 bg-gold font-display text-5xl
                       font-bold uppercase tracking-wide text-ink
                       shadow-[0_3px_0_rgba(20,18,16,0.5)] transition-transform
                       active:translate-y-[3px] active:shadow-none"
          >
            Ja!
          </button>
          <button
            type="button"
            onClick={() => actions.castVote(VOTES.NEIN)}
            className="min-h-[7rem] rounded-sm border-2 border-ink/30 bg-communist font-display text-5xl
                       font-bold uppercase tracking-wide text-paper
                       shadow-[0_3px_0_rgba(20,18,16,0.5)] transition-transform
                       active:translate-y-[3px] active:shadow-none"
          >
            Nein!
          </button>
        </div>
      </div>
    </InterstitialScreen>
  );
}
