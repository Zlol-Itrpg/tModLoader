import { createContext, useContext, useMemo, useReducer } from 'react';
import { actions as actionCreators, gameReducer } from './reducer.js';
import { createInitialState } from './initialState.js';

/**
 * The single store for the whole app.
 *
 * State and dispatch live in separate contexts on purpose: a screen that only
 * fires actions (a button row, the ballot) does not re-render when unrelated
 * state moves. The dispatch context also holds the action creators pre-bound,
 * so components never build action objects by hand.
 */

const GameStateContext = createContext(null);
const GameActionsContext = createContext(null);

export function GameProvider({ children, initialOptions }) {
  // Lazy init: createInitialState runs once, not on every render.
  const [state, dispatch] = useReducer(gameReducer, initialOptions, createInitialState);

  // Stable for the life of the provider — dispatch never changes identity.
  const boundActions = useMemo(() => {
    const bound = Object.fromEntries(
      Object.entries(actionCreators).map(([name, create]) => [
        name,
        (...args) => dispatch(create(...args)),
      ]),
    );
    return { ...bound, dispatch };
  }, []);

  return (
    <GameStateContext.Provider value={state}>
      <GameActionsContext.Provider value={boundActions}>{children}</GameActionsContext.Provider>
    </GameStateContext.Provider>
  );
}

function useRequiredContext(context, hookName) {
  const value = useContext(context);
  if (value === null) {
    throw new Error(`${hookName} must be called inside a <GameProvider>.`);
  }
  return value;
}

/** The whole game state. */
export const useGameState = () => useRequiredContext(GameStateContext, 'useGameState');

/** Pre-bound action creators, plus the raw `dispatch`. */
export const useGameActions = () => useRequiredContext(GameActionsContext, 'useGameActions');

/** Both at once, for screens that need to read and write. */
export function useGame() {
  return { state: useGameState(), actions: useGameActions() };
}

/** One player by id — the common lookup, so screens stop re-writing `.find`. */
export function usePlayer(playerId) {
  const state = useGameState();
  return state.players.find((player) => player.id === playerId) ?? null;
}

/** The player the device is currently being passed to, if any. */
export function useHandoffPlayer() {
  const state = useGameState();
  if (!state.handoff) return null;
  return state.players.find((player) => player.id === state.handoff.toPlayerId) ?? null;
}
