import InterstitialScreen from './InterstitialScreen.jsx';
import { useGame } from '../game/GameContext.jsx';
import { getRoleIntel } from '../game/selectors.js';
import { HANDOFF, PARTIES, PHASES, ROLES, ROLE_PARTY } from '../game/constants.js';
import { BOARDS } from '../game/config.js';

/**
 * The first handoff: every player sees their own card, one at a time.
 *
 * This component decides nothing. It reads `state.handoff.toPlayerId`, renders
 * the interstitial for that player, and dispatches the two acknowledgements the
 * reducer is waiting for. Walking to the next player — and, after the last one,
 * opening the first nomination — is the reducer's job.
 */

const ROLE_COPY = {
  [ROLES.LIBERAL]: {
    title: 'Liberal',
    objective: 'Enact five Liberal policies, or execute Hitler.',
  },
  [ROLES.FASCIST]: {
    title: 'Fascist',
    objective: 'Enact six Fascist policies, or get Hitler elected Chancellor after the third.',
  },
  [ROLES.HITLER]: {
    title: 'Hitler',
    objective: 'You win with the Fascists. Play like a Liberal until it is safe not to.',
  },
  [ROLES.COMMUNIST]: {
    title: 'Communist',
    objective: 'Enact five Communist policies.',
  },
};

const PARTY_CARD = {
  [PARTIES.LIBERAL]: 'border-liberal/60 bg-liberal/10 text-liberal',
  [PARTIES.FASCIST]: 'border-fascist/60 bg-fascist/10 text-fascist',
  [PARTIES.COMMUNIST]: 'border-communist/60 bg-communist/10 text-communist',
};

const PARTY_TONE = {
  [PARTIES.LIBERAL]: 'liberal',
  [PARTIES.FASCIST]: 'fascist',
  [PARTIES.COMMUNIST]: 'communist',
};

export default function RoleReveal() {
  const { state, actions } = useGame();
  const { handoff } = state;

  // Dumb by design: no phase logic, just "is this screen the one on duty?".
  if (state.phase !== PHASES.ROLE_REVEAL || handoff?.kind !== HANDOFF.ROLE_REVEAL) return null;

  const player = state.players.find((candidate) => candidate.id === handoff.toPlayerId);
  if (!player) return null;

  const seat = state.players.indexOf(player);
  const isLast = seat === state.players.length - 1;
  const party = ROLE_PARTY[player.role];
  const copy = ROLE_COPY[player.role];
  const intel = getRoleIntel(state, player.id);

  return (
    <InterstitialScreen
      playerName={player.name}
      title="Your secret role"
      kicker={`Player ${seat + 1} of ${state.players.length} — pass the device to`}
      instruction="Your role and your allies are on the next screen. Only you may see them."
      warning="Hold the phone flat. Nobody reads over your shoulder."
      confirmLabel={`I am ${player.name} — reveal my role`}
      doneLabel={isLast ? 'Hide & begin the first nomination' : 'Hide & pass on'}
      revealed={handoff.revealed}
      onReveal={actions.revealHandoff}
      onDone={actions.continueHandoff}
      holdMs={450}
      tone={PARTY_TONE[party]}
    >
      {/* ---- The role card ---------------------------------------------- */}
      <section className={`rounded-sm border-2 px-5 py-6 text-center ${PARTY_CARD[party]}`}>
        <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.3em] opacity-70">
          You are
        </p>
        <h2 className="mt-1 font-display text-[clamp(2.25rem,12vw,3.5rem)] font-bold uppercase leading-none">
          {copy.title}
        </h2>
        <p className="mt-4 font-display text-base leading-snug text-ink/80">{copy.objective}</p>
      </section>

      {/* ---- The membership card ---------------------------------------- */}
      <section className="mt-4 flex items-center justify-between gap-4 rounded-sm border border-ink/25
                          bg-paper/70 px-4 py-3">
        <div className="min-w-0">
          <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.24em] text-ink/50">
            Party membership
          </p>
          <p className="font-display text-xl leading-tight">{BOARDS[party].label}</p>
        </div>
        <span
          aria-hidden="true"
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-sm border-2 font-display
                      text-2xl font-bold ${PARTY_CARD[party]}`}
        >
          {BOARDS[party].label[0]}
        </span>
      </section>

      {player.role === ROLES.HITLER ? (
        <p className="mt-2 font-stencil text-[0.6875rem] uppercase leading-relaxed tracking-[0.14em] text-ink/55">
          Your membership card reads Fascist. An investigation cannot tell you apart from one.
        </p>
      ) : null}

      {/* ---- Who you know ------------------------------------------------ */}
      {intel.headline ? (
        <section className="mt-6">
          <h3 className="font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-ink/55">
            {intel.headline}
          </h3>
          <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
            {intel.allies.map((ally) => (
              <li key={ally.id} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 truncate font-display text-lg">{ally.name}</span>
                {ally.isHitler ? (
                  <span className="shrink-0 rounded-sm bg-fascist px-2 py-1 font-stencil text-[0.625rem]
                                   uppercase tracking-[0.18em] text-paper">
                    Hitler
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {intel.note ? (
        <p className="mt-4 font-display text-base leading-snug text-ink/70">{intel.note}</p>
      ) : null}
    </InterstitialScreen>
  );
}
