import { GameProvider, useGameState } from './game/GameContext.jsx';
import SetupScreen from './components/SetupScreen.jsx';
import RoleReveal from './components/RoleReveal.jsx';
import { PHASES } from './game/constants.js';

/**
 * Phase router. Each phase owns one screen; the interstitial screens overlay
 * whatever is underneath, which is why RoleReveal renders as a sibling rather
 * than replacing the board.
 */
function CurrentPhase() {
  const { phase } = useGameState();

  if (phase === PHASES.SETUP) return <SetupScreen />;
  if (phase === PHASES.ROLE_REVEAL) return <RoleReveal />;

  // TODO: board + nomination, ballot, legislative session, powers, game over.
  return (
    <div className="grid min-h-dvh place-items-center bg-parchment px-6 text-center text-ink">
      <p className="font-display text-xl text-ink/60">
        {phase} — screen not built yet.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <CurrentPhase />
    </GameProvider>
  );
}
