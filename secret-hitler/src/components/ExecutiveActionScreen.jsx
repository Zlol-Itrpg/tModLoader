import InterstitialScreen from './InterstitialScreen.jsx';
import RadicalisationReveal from './RadicalisationReveal.jsx';
import PolicyPeekScreen from './PolicyPeekScreen.jsx';
import InvestigateLoyaltyScreen from './InvestigateLoyaltyScreen.jsx';
import SpecialElectionScreen from './SpecialElectionScreen.jsx';
import ExecutionScreen from './ExecutionScreen.jsx';
import ConfessionScreen from './ConfessionScreen.jsx';
import RadicalisationScreen from './RadicalisationScreen.jsx';
import { useGame } from '../game/GameContext.jsx';
import { HANDOFF, PHASES, POWERS, POWER_INFO } from '../game/constants.js';

/**
 * Router for the executive phase.
 *
 * Two shapes of handoff land here. Almost every power is resolved by the
 * President under one interstitial, so the body swaps and the wrapper does not.
 * Radicalisation is the exception: its result belongs to the target, so it
 * brings its own interstitial and this screen steps aside.
 */

const BODIES = {
  [POWERS.POLICY_PEEK]: PolicyPeekScreen,
  [POWERS.INVESTIGATE_LOYALTY]: InvestigateLoyaltyScreen,
  [POWERS.SPECIAL_ELECTION]: SpecialElectionScreen,
  [POWERS.EXECUTION]: ExecutionScreen,
  [POWERS.CONFESSION]: ConfessionScreen,
  [POWERS.RADICALISATION]: RadicalisationScreen,
};

export default function ExecutiveActionScreen() {
  const { state, actions } = useGame();
  const { handoff, pendingPower } = state;

  if (state.phase !== PHASES.EXECUTIVE_ACTION || !pendingPower || !handoff) return null;

  if (handoff.kind === HANDOFF.RADICALISATION) return <RadicalisationReveal />;
  if (handoff.kind !== HANDOFF.EXECUTIVE_ACTION) return null;

  const president = state.players.find((player) => player.id === handoff.toPlayerId);
  const Body = BODIES[pendingPower.power];
  if (!president || !Body) return null;

  const info = POWER_INFO[pendingPower.power];

  return (
    <InterstitialScreen
      playerName={president.name}
      title={info.label}
      kicker="Pass the device to President"
      instruction={info.blurb}
      warning={
        pendingPower.power === POWERS.CONFESSION
          ? 'You will be asked to show the result to everyone.'
          : 'Only you see what happens next.'
      }
      confirmLabel={`I am ${president.name} — use ${info.label}`}
      revealed={handoff.revealed}
      onReveal={actions.revealHandoff}
      holdMs={350}
      tone="neutral"
    >
      <Body />
    </InterstitialScreen>
  );
}
