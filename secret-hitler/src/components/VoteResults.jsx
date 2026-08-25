import { useGame } from '../game/GameContext.jsx';
import { PHASES, VOTES } from '../game/constants.js';

/**
 * The simultaneous reveal.
 *
 * The reducer stops here on purpose: the last ballot tallies the vote and parks
 * at VOTE_REVEAL rather than resolving it, so the table reads every ballot at
 * once — which is the whole social point of the game. Continue is what actually
 * resolves the election.
 */
export default function VoteResults() {
  const { state, actions } = useGame();

  if (state.phase !== PHASES.VOTE_REVEAL || !state.election.result) return null;

  const { passed, ja, nein } = state.election.result;
  const president = state.players.find((player) => player.id === state.government.presidentId);
  const nominee = state.players.find((player) => player.id === state.government.nomineeId);
  const voters = state.players.filter((player) => player.isAlive);

  return (
    <section className="shrink-0 border-t-2 border-ink/20 bg-paper/60 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
      <header className="text-center">
        <p className="font-stencil text-[0.625rem] uppercase tracking-[0.2em] text-ink/50">
          {president?.name} &amp; {nominee?.name}
        </p>
        <h2
          className={`animate-stamp-in font-display text-3xl font-bold leading-tight ${
            passed ? 'text-liberal' : 'text-communist'
          }`}
        >
          {passed ? 'Government elected' : 'Government rejected'}
        </h2>
        <p className="mt-0.5 font-stencil text-xs uppercase tracking-[0.2em] text-ink/60">
          <span className="tabular-nums">{ja}</span> Ja &middot;{' '}
          <span className="tabular-nums">{nein}</span> Nein
        </p>
      </header>

      {/* Every ballot turns at once, fanned out by a beat each — the table
          reads the shape of the vote before it reads the names. */}
      <ul className="perspective-card stagger mt-4 grid grid-cols-2 gap-1.5 [--stagger:50ms]">
        {voters.map((player, index) => {
          const votedJa = state.election.votes[player.id] === VOTES.JA;
          return (
            <li
              key={player.id}
              style={{ '--i': index }}
              className={`flex animate-flip-in items-center justify-between gap-2 rounded-sm border-2 px-2.5 py-2 ${
                votedJa ? 'border-transparent bg-gold text-ink' : 'border-transparent bg-communist text-paper'
              }`}
            >
              <span className="min-w-0 truncate font-display text-sm leading-none">{player.name}</span>
              <span className="shrink-0 font-stencil text-[0.625rem] uppercase tracking-[0.16em]">
                {votedJa ? 'Ja' : 'Nein'}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={actions.resolveElection}
        className="mt-4 h-16 w-full rounded-sm bg-ink font-stencil text-sm uppercase tracking-[0.24em]
                   text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)] transition-transform
                   active:translate-y-[3px] active:shadow-none"
      >
        Continue
      </button>
    </section>
  );
}
