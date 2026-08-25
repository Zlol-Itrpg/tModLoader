import { GameProvider, useGameState } from './game/GameContext.jsx';
import SetupScreen from './components/SetupScreen.jsx';
import RoleReveal from './components/RoleReveal.jsx';
import GameHUD from './components/GameHUD.jsx';
import NominationScreen from './components/NominationScreen.jsx';
import VotingScreen from './components/VotingScreen.jsx';
import VoteResults from './components/VoteResults.jsx';
import LegislativePresident from './components/LegislativePresident.jsx';
import LegislativeChancellor from './components/LegislativeChancellor.jsx';
import VetoScreen from './components/VetoScreen.jsx';
import { PHASES } from './game/constants.js';

const BUILT = new Set([
  PHASES.NOMINATION,
  PHASES.VOTING,
  PHASES.VOTE_REVEAL,
  PHASES.LEGISLATIVE_PRESIDENT,
  PHASES.LEGISLATIVE_CHANCELLOR,
  PHASES.VETO_PRESIDENT_CONSIDER,
]);

/** Placeholder for the phases whose screens are still to come. */
function PhaseStub() {
  const { phase } = useGameState();
  if (phase === PHASES.SETUP || phase === PHASES.ROLE_REVEAL || BUILT.has(phase)) return null;

  return (
    <section className="shrink-0 border-t-2 border-ink/20 bg-paper/60 px-4 py-8 text-center">
      <p className="font-display text-lg text-ink/55">{phase} — screen not built yet.</p>
    </section>
  );
}

/**
 * Phase router.
 *
 * Every screen guards its own phase and returns null otherwise, so this stays a
 * flat list rather than a switch. The HUD is always mounted underneath; the
 * interstitials are fixed overlays that cover it while the device is in transit.
 */
function Game() {
  const { phase } = useGameState();

  if (phase === PHASES.SETUP) return <SetupScreen />;

  return (
    <>
      <div className="flex min-h-dvh flex-col bg-parchment text-ink">
        <GameHUD />
        <NominationScreen />
        <VoteResults />
        <PhaseStub />
      </div>
      <RoleReveal />
      <VotingScreen />
      <LegislativePresident />
      <LegislativeChancellor />
      <VetoScreen />
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Game />
    </GameProvider>
  );
}
