import { PARTIES } from '../game/constants.js';
import haptics from '../utils/haptics.js';
import { playPaperShuffle } from '../utils/audio.js';
import { BOARDS } from '../game/config.js';

/**
 * One policy card, face up. Used by both halves of the legislative session so
 * the President and the Chancellor are looking at the same object.
 */

const CARD = {
  [PARTIES.LIBERAL]: { face: 'bg-liberal', ring: 'ring-liberal' },
  [PARTIES.FASCIST]: { face: 'bg-fascist', ring: 'ring-fascist' },
  [PARTIES.COMMUNIST]: { face: 'bg-communist', ring: 'ring-communist' },
};

export default function PolicyCard({
  party,
  selected = false,
  onSelect,
  disabled = false,
  className = '',
  style,
}) {
  const face = CARD[party];
  const label = BOARDS[party].label;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${label} policy`}
      onClick={() => {
        haptics.light();
        playPaperShuffle();
        onSelect?.();
      }}
      style={style}
      className={`flex min-h-[9rem] flex-1 flex-col items-center justify-center gap-2 rounded-sm
                  border-2 border-ink/40 px-2 py-4 text-paper transition-transform
                  ${face.face}
                  ${selected ? `ring-4 ring-offset-2 ring-offset-parchment ${face.ring} -translate-y-1` : ''}
                  disabled:opacity-40 active:translate-y-[1px] ${className}`}
    >
      <span aria-hidden="true" className="font-display text-4xl font-bold leading-none">
        {label[0]}
      </span>
      <span className="font-stencil text-[0.625rem] uppercase tracking-[0.18em]">{label}</span>
      {selected ? (
        <span className="font-stencil text-[0.5625rem] uppercase tracking-[0.16em] opacity-90">
          Selected
        </span>
      ) : null}
    </button>
  );
}
