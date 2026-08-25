import { useRef, useState } from 'react';
import { useGame } from '../game/GameContext.jsx';
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/config.js';
import { getRoleDistribution } from '../game/selectors.js';
import { PARTIES } from '../game/constants.js';

/**
 * The pre-game roster.
 *
 * Everything here is a dispatch into the reducer — this screen holds one piece
 * of local state, the half-typed name in the input, which is not game state.
 */

const PARTY_DOT = {
  [PARTIES.LIBERAL]: 'bg-liberal',
  [PARTIES.FASCIST]: 'bg-fascist',
  [PARTIES.COMMUNIST]: 'bg-communist',
};

export default function SetupScreen() {
  const { state, actions } = useGame();
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const { players, config } = state;
  const count = players.length;
  const isFull = count >= MAX_PLAYERS;
  const canDeal = count >= MIN_PLAYERS && count <= MAX_PLAYERS;

  const distribution = getRoleDistribution(
    Math.max(MIN_PLAYERS, count),
    config.communistsEnabled,
  );

  const duplicateNames = players
    .map((player) => player.name.trim().toLowerCase())
    .filter((name, index, all) => name && all.indexOf(name) !== index);

  const submitName = (event) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name || isFull) return;
    actions.addPlayer(name);
    setDraft('');
    // Keep the keyboard up — rosters get typed in one burst.
    inputRef.current?.focus();
  };

  const shortfall = MIN_PLAYERS - count;
  const validationMessage = count < MIN_PLAYERS
    ? `Add ${shortfall} more ${shortfall === 1 ? 'player' : 'players'} — ${MIN_PLAYERS} is the minimum.`
    : count > MAX_PLAYERS
      ? `Too many players. ${MAX_PLAYERS} is the maximum.`
      : null;

  return (
    <div className="flex min-h-dvh flex-col bg-parchment text-ink">
      <header className="shrink-0 border-b border-brass/40 px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.32em] text-ink/50">
          Pass-and-play
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Secret Hitler</h1>
        <p className="font-stencil text-xs uppercase tracking-[0.2em] text-fascist">
          with the Communist expansion
        </p>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5">
        {/* ---- Add a player ------------------------------------------- */}
        <form onSubmit={submitName} className="flex gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={isFull ? 'Table is full' : 'Player name'}
            disabled={isFull}
            aria-label="New player name"
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="words"
            className="h-14 min-w-0 flex-1 rounded-sm border border-ink/25 bg-paper px-4
                       font-display text-lg placeholder:text-ink/35
                       focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink/20
                       disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || isFull}
            className="h-14 shrink-0 rounded-sm bg-ink px-6 font-stencil text-sm uppercase
                       tracking-[0.18em] text-paper shadow-[0_2px_0_rgba(20,18,16,0.5)]
                       transition-transform active:translate-y-[2px] active:shadow-none
                       disabled:opacity-30 disabled:shadow-none disabled:active:translate-y-0"
          >
            Add
          </button>
        </form>

        {/* ---- The roster ---------------------------------------------- */}
        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="font-stencil text-xs uppercase tracking-[0.28em] text-ink/55">
            The table
          </h2>
          <span className="font-stencil text-xs tabular-nums tracking-[0.18em] text-ink/45">
            {count} / {MAX_PLAYERS}
          </span>
        </div>

        {count === 0 ? (
          <p className="mt-4 rounded-sm border border-dashed border-ink/25 px-4 py-8 text-center
                        font-display text-ink/50">
            Nobody at the table yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
            {players.map((player, index) => (
              <li key={player.id} className="flex items-center gap-3 py-1.5">
                <span className="w-6 shrink-0 text-center font-stencil text-xs tabular-nums text-ink/40">
                  {index + 1}
                </span>
                <input
                  value={player.name}
                  onChange={(event) => actions.renamePlayer(player.id, event.target.value)}
                  aria-label={`Name of player ${index + 1}`}
                  autoComplete="off"
                  className="h-12 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-2
                             font-display text-lg focus:border-ink/30 focus:bg-paper focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => actions.removePlayer(player.id)}
                  aria-label={`Remove ${player.name || `player ${index + 1}`}`}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-sm text-2xl
                             leading-none text-ink/40 active:bg-ink/10 active:text-fascist"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        )}

        {duplicateNames.length > 0 ? (
          <p className="mt-3 font-stencil text-[0.6875rem] uppercase tracking-[0.16em] text-fascist">
            Two players share a name — the pass screen will be ambiguous.
          </p>
        ) : null}

        {/* ---- Expansion toggle ---------------------------------------- */}
        <label className="mt-7 flex cursor-pointer items-center justify-between gap-4 rounded-sm
                          border border-ink/20 bg-paper/60 px-4 py-4">
          <span className="min-w-0">
            <span className="block font-display text-lg leading-tight">
              Communist expansion
            </span>
            <span className="block font-stencil text-[0.6875rem] uppercase tracking-[0.16em] text-ink/50">
              Adds a third board, third deck and the XL powers
            </span>
          </span>
          <input
            type="checkbox"
            checked={config.communistsEnabled}
            onChange={(event) => actions.setExpansion(event.target.checked)}
            className="peer sr-only"
          />
          {/* Switch track. The knob is a descendant, so `peer-checked:` cannot
              reach it — both halves read the flag directly instead. */}
          <span
            aria-hidden="true"
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors
                        peer-focus-visible:ring-2 peer-focus-visible:ring-ink/40
                        ${config.communistsEnabled ? 'bg-communist' : 'bg-ink/25'}`}
          >
            <span
              className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-paper shadow transition-transform
                          ${config.communistsEnabled ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </span>
        </label>

        {/* ---- Live role breakdown ------------------------------------- */}
        <section className="mt-5 rounded-sm border border-brass/50 bg-paper/60 px-4 py-4">
          <h2 className="font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-ink/55">
            {count >= MIN_PLAYERS ? `At ${count} players` : `At ${MIN_PLAYERS} players`}
          </h2>
          <p className="mt-1 font-display text-lg leading-snug">{distribution.summary}</p>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {distribution.parts.map((part) => (
              <li key={part.label} className="flex items-center gap-2">
                <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${PARTY_DOT[part.party]}`} />
                <span className="font-stencil text-xs uppercase tracking-[0.14em] text-ink/70">
                  {part.count}&times; {part.label}
                </span>
              </li>
            ))}
          </ul>
          {count === MIN_PLAYERS ? (
            <p className="mt-3 font-stencil text-[0.625rem] uppercase leading-relaxed tracking-[0.14em] text-ink/45">
              Four players is a house rule, not an official count.
            </p>
          ) : null}
        </section>
      </main>

      {/* ---- Deal ------------------------------------------------------ */}
      <footer className="shrink-0 border-t border-ink/15 bg-parchment px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
        {validationMessage ? (
          <p className="mb-2 text-center font-stencil text-[0.6875rem] uppercase tracking-[0.16em] text-ink/55">
            {validationMessage}
          </p>
        ) : null}
        <button
          type="button"
          onClick={actions.startGame}
          disabled={!canDeal}
          className="h-16 w-full rounded-sm bg-fascist font-stencil text-sm uppercase tracking-[0.24em]
                     text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)] transition-transform
                     active:translate-y-[3px] active:shadow-none
                     disabled:bg-ink/20 disabled:text-ink/40 disabled:shadow-none
                     disabled:active:translate-y-0"
        >
          Deal roles
        </button>
      </footer>
    </div>
  );
}
