import { BOARDS } from '../game/config.js';
import haptics from '../utils/haptics.js';

/**
 * Select-then-confirm target list, shared by every targeted power.
 *
 * The caller passes the legal targets straight from the reducer, so no screen
 * re-derives who may be pointed at.
 */
export default function TargetPicker({ targets, selectedId, onSelect, prompt, note }) {
  return (
    <>
      <p className="text-center font-display text-lg leading-snug">{prompt}</p>
      {note ? (
        <p className="mt-1 text-center font-stencil text-[0.625rem] uppercase tracking-[0.18em] text-ink/50">
          {note}
        </p>
      ) : null}

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {targets.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              aria-pressed={player.id === selectedId}
              onClick={() => {
                haptics.light();
                onSelect(player.id);
              }}
              className={`flex h-14 w-full flex-col items-center justify-center rounded-sm border-2 px-2
                          transition-transform active:translate-y-[1px]
                          ${player.id === selectedId
                            ? 'border-ink bg-ink text-paper'
                            : 'border-ink/25 bg-paper text-ink'}`}
            >
              <span className="max-w-full truncate font-display text-base leading-tight">
                {player.name}
              </span>
              {player.isPartyPublic ? (
                <span className="font-stencil text-[0.5625rem] uppercase tracking-[0.14em] opacity-70">
                  Known {BOARDS[player.party].label}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The big confirm bar every power ends its selection with. */
export function ConfirmButton({ children, disabled, onClick, tone = 'ink' }) {
  const face = tone === 'danger' ? 'bg-communist text-paper' : 'bg-ink text-paper';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`mt-5 h-16 w-full rounded-sm font-stencil text-sm uppercase tracking-[0.22em]
                  shadow-[0_3px_0_rgba(20,18,16,0.5)] transition-transform
                  active:translate-y-[3px] active:shadow-none
                  disabled:bg-ink/20 disabled:text-ink/40 disabled:shadow-none
                  disabled:active:translate-y-0 ${face}`}
    >
      {children}
    </button>
  );
}
