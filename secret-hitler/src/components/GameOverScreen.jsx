import { useGame } from '../game/GameContext.jsx';
import { PHASES, ROLES, WIN_REASONS } from '../game/constants.js';
import { BOARDS } from '../game/config.js';

/**
 * The reckoning: who won, why, and everybody's card face up.
 *
 * `winners` is a list rather than a single party because executing Hitler wins
 * the game for the Liberals and the Communists together.
 */

const ROLE_FACE = {
  [ROLES.LIBERAL]: 'bg-liberal text-paper',
  [ROLES.FASCIST]: 'bg-fascist text-paper',
  [ROLES.HITLER]: 'bg-ink text-paper',
  [ROLES.COMMUNIST]: 'bg-communist text-paper',
};

const REASON_COPY = {
  [WIN_REASONS.HITLER_ELECTED]: 'Hitler was elected Chancellor.',
  [WIN_REASONS.HITLER_EXECUTED]: 'Hitler was executed.',
  [WIN_REASONS.POLICY_TRACK]: 'The board was completed.',
};

export default function GameOverScreen() {
  const { state, actions } = useGame();
  if (state.phase !== PHASES.GAME_OVER || !state.winners) return null;

  const { winners, winReason } = state;
  const isJoint = winners.length > 1;
  const headline = winners.map((party) => BOARDS[party].label).join(' & ');

  return (
    <div className="flex min-h-dvh flex-col bg-parchment px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]
                    pt-[calc(env(safe-area-inset-top)+2rem)] text-ink">
      <header className="text-center">
        <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.32em] text-ink/50">
          {isJoint ? 'A joint victory' : 'Victory'}
        </p>
        <h1 className="mt-2 font-display text-[clamp(2.25rem,12vw,3.5rem)] font-bold uppercase leading-none">
          {headline}
        </h1>
        <p className="mt-3 font-display text-lg text-ink/75">{REASON_COPY[winReason]}</p>
        {isJoint ? (
          <p className="mt-2 font-stencil text-[0.625rem] uppercase leading-relaxed tracking-[0.16em] text-ink/50">
            With the expansion in play, shooting Hitler wins the game for the Liberals
            and the Communists alike.
          </p>
        ) : null}
      </header>

      <section className="mt-6 min-h-0 flex-1 overflow-y-auto">
        <h2 className="font-stencil text-[0.625rem] uppercase tracking-[0.24em] text-ink/50">
          Every card, face up
        </h2>
        <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
          {state.players.map((player) => (
            <li key={player.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className={`min-w-0 truncate font-display text-lg ${player.isAlive ? '' : 'text-ink/40 line-through'}`}>
                {player.name}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {player.hasBeenRadicalised ? (
                  <span className="rounded-sm bg-communist/15 px-1.5 py-1 font-stencil text-[0.5625rem]
                                   uppercase tracking-[0.14em] text-communist">
                    Radicalised
                  </span>
                ) : null}
                <span className={`rounded-sm px-2 py-1 font-stencil text-[0.625rem] uppercase
                                 tracking-[0.16em] ${ROLE_FACE[player.role]}`}>
                  {player.role === ROLES.HITLER ? 'Hitler' : BOARDS[player.party]?.label ?? player.role}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={actions.resetGame}
        className="mt-5 h-16 w-full shrink-0 rounded-sm bg-ink font-stencil text-sm uppercase
                   tracking-[0.24em] text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)]
                   transition-transform active:translate-y-[3px] active:shadow-none"
      >
        New game
      </button>
    </div>
  );
}
