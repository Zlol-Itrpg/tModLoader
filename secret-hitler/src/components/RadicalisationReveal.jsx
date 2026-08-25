import InterstitialScreen from './InterstitialScreen.jsx';
import { useGame } from '../game/GameContext.jsx';
import { PARTIES } from '../game/constants.js';
import { BOARDS } from '../game/config.js';

/**
 * Radicalisation, target's half.
 *
 * Its own interstitial, because the device leaves the President's hands. The
 * conversion has already been applied (or refused, for Hitler) by the time this
 * renders — acknowledging it is what ends the executive action.
 */
export default function RadicalisationReveal() {
  const { state, actions } = useGame();
  const { handoff, pendingPower } = state;

  const target = state.players.find((player) => player.id === handoff.toPlayerId);
  if (!target) return null;

  const succeeded = pendingPower.result?.succeeded;

  return (
    <InterstitialScreen
      playerName={target.name}
      title="You have been targeted"
      kicker="Pass the device to"
      instruction="The President has used Radicalisation on you. Only you see the outcome."
      warning="Nobody reads this over your shoulder."
      confirmLabel={`I am ${target.name} — reveal`}
      revealed={handoff.revealed}
      onReveal={actions.revealHandoff}
      onDone={actions.endExecutiveAction}
      doneLabel="Acknowledge & pass on"
      holdMs={350}
      tone={succeeded ? 'communist' : 'fascist'}
    >
      {succeeded ? (
        <>
          <div className="rounded-sm border-2 border-communist bg-communist/10 px-5 py-8 text-center">
            <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-communist/80">
              You have been radicalised
            </p>
            <p className="mt-2 font-display text-[clamp(2rem,11vw,3rem)] font-bold uppercase leading-none text-communist">
              {BOARDS[PARTIES.COMMUNIST].label}
            </p>
          </div>
          <p className="mt-4 font-display text-base leading-snug text-ink/80">
            Your party membership is now Communist. An investigation or a Confession will
            say so. Your secret role has not changed — only the card you carry.
          </p>
        </>
      ) : (
        <>
          <div className="rounded-sm border-2 border-fascist bg-fascist/10 px-5 py-8 text-center">
            <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-fascist/80">
              The conversion failed
            </p>
            <p className="mt-2 font-display text-[clamp(2rem,11vw,3rem)] font-bold uppercase leading-none text-fascist">
              {BOARDS[PARTIES.FASCIST].label}
            </p>
          </div>
          <p className="mt-4 font-display text-base leading-snug text-ink/80">
            Because you are Hitler, your party membership remains Fascist. Nobody else
            is told — not even the President who tried.
          </p>
        </>
      )}
    </InterstitialScreen>
  );
}
