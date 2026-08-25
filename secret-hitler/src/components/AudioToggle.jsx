import { useEffect, useState } from 'react';
import { isMuted, onMuteChange, toggleMuted } from '../utils/audio.js';
import haptics from '../utils/haptics.js';

/**
 * The mute switch. Reads its initial value from localStorage via the audio
 * module, and stays in step with any other copy of itself through the module's
 * change subscription.
 */
export default function AudioToggle() {
  const [muted, setMuted] = useState(isMuted);

  useEffect(() => onMuteChange(setMuted), []);

  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Sound off' : 'Sound on'}
      onClick={() => {
        toggleMuted();
        haptics.light();
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-ink/20
                 text-ink/45 transition-transform active:translate-y-[1px] active:bg-ink/10"
    >
      {/* Monochrome glyphs, to match the board's power icons. */}
      <span aria-hidden="true" className="font-display text-sm leading-none">
        {muted ? '✕' : '♪'}
      </span>
    </button>
  );
}
