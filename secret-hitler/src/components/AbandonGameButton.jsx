import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/GameContext.jsx';

/**
 * The escape hatch: end a game in progress and go back to setup.
 *
 * Deliberately small and low-contrast — it sits on screen for the whole game
 * and must never compete with the phase controls — but behind a real
 * confirmation, because one stray tap would destroy the table's game.
 *
 * The dialog is in-app rather than window.confirm: a native dialog is styled by
 * the OS, is suppressed outright in some mobile browsers, and blocks the main
 * thread while it is up.
 */
export default function AbandonGameButton() {
  const { actions } = useGame();
  const [isOpen, setIsOpen] = useState(false);
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="shrink-0 rounded-sm border border-ink/20 px-2.5 py-1.5 font-stencil
                   text-[0.5625rem] uppercase tracking-[0.16em] text-ink/45
                   active:bg-ink/10 active:text-ink"
      >
        End game
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="abandon-title"
          className="fixed inset-0 z-40 flex items-end justify-center bg-ink/70 px-4
                     pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6"
        >
          <div className="w-full max-w-sm rounded-sm border-2 border-ink bg-parchment px-5 py-6">
            <h2 id="abandon-title" className="font-display text-2xl font-bold leading-tight">
              End this game?
            </h2>
            <p className="mt-2 font-display text-base leading-snug text-ink/75">
              Are you sure you want to end this game? This cannot be undone — the board,
              the roles and the policy deck are all discarded.
            </p>
            <p className="mt-2 font-stencil text-[0.625rem] uppercase leading-relaxed tracking-[0.14em] text-ink/50">
              The player list is kept, so you can deal again straight away.
            </p>

            <div className="mt-6 space-y-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-16 w-full rounded-sm bg-ink font-stencil text-sm uppercase
                           tracking-[0.22em] text-paper shadow-[0_3px_0_rgba(20,18,16,0.5)]
                           transition-transform active:translate-y-[3px] active:shadow-none"
              >
                Keep playing
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  actions.newGame();
                }}
                className="h-14 w-full rounded-sm border-2 border-communist bg-transparent
                           font-stencil text-xs uppercase tracking-[0.2em] text-communist
                           transition-transform active:translate-y-[2px]"
              >
                End game &amp; start over
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
