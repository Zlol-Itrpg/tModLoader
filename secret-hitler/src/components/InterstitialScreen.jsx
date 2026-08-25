import { useCallback, useEffect, useRef, useState } from 'react';
import haptics from '../utils/haptics.js';

/**
 * The pass-and-play privacy gate.
 *
 * Every time the game needs to show one player something the rest of the table
 * must not see — a role card, a ballot, a policy hand, the result of an
 * investigation — it goes behind this screen. The overlay covers the entire
 * app, names the player the device must reach, and refuses to render `children`
 * at all until that player confirms. Hidden content is never mounted early, so
 * there is nothing to catch a glimpse of, no matter how the screen is tilted.
 *
 * Controlled or uncontrolled: pass `revealed` + `onReveal` to drive it from the
 * reducer (the normal case), or omit both and let it manage its own stage.
 */

const TONES = {
  neutral: { accent: 'text-brass', rule: 'border-brass/40', button: 'bg-ink text-paper' },
  liberal: { accent: 'text-liberal', rule: 'border-liberal/50', button: 'bg-liberal text-paper' },
  fascist: { accent: 'text-fascist', rule: 'border-fascist/50', button: 'bg-fascist text-paper' },
  communist: { accent: 'text-communist', rule: 'border-communist/50', button: 'bg-communist text-paper' },
};

export default function InterstitialScreen({
  playerName,
  kicker = 'Pass the device to',
  title = 'Eyes only',
  instruction,
  warning = 'Make sure nobody else can see the screen.',
  confirmLabel,
  doneLabel = 'Hide and pass on',
  onDone,
  revealed: revealedProp,
  onReveal,
  /** Milliseconds of press-and-hold required to reveal. 0 = a single tap. */
  holdMs = 0,
  tone = 'neutral',
  children,
}) {
  const isControlled = revealedProp !== undefined;
  const [innerRevealed, setInnerRevealed] = useState(false);
  const revealed = isControlled ? revealedProp : innerRevealed;

  const [holdProgress, setHoldProgress] = useState(0);
  const holdFrame = useRef(null);
  const revealButtonRef = useRef(null);

  const palette = TONES[tone] ?? TONES.neutral;

  // A new recipient always starts covered again, even if the component is reused.
  useEffect(() => {
    if (!isControlled) setInnerRevealed(false);
    setHoldProgress(0);
  }, [playerName, title, isControlled]);

  // The overlay owns the viewport while it is up: no background scrolling, and
  // no stray focus left on whatever is underneath.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    revealButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const commitReveal = useCallback(() => {
    haptics.light();
    if (isControlled) onReveal?.();
    else setInnerRevealed(true);
    setHoldProgress(0);
  }, [isControlled, onReveal]);

  const cancelHold = useCallback(() => {
    if (holdFrame.current !== null) cancelAnimationFrame(holdFrame.current);
    holdFrame.current = null;
    setHoldProgress(0);
  }, []);

  const startHold = useCallback(() => {
    if (holdMs <= 0) return;
    // Anchor to the first frame's own timestamp rather than a second clock:
    // rAF timestamps and performance.now() need not share a time origin.
    let startedAt = null;
    const tick = (now) => {
      if (startedAt === null) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / holdMs);
      setHoldProgress(progress);
      if (progress >= 1) {
        holdFrame.current = null;
        commitReveal();
        return;
      }
      holdFrame.current = requestAnimationFrame(tick);
    };
    holdFrame.current = requestAnimationFrame(tick);
  }, [holdMs, commitReveal]);

  useEffect(() => cancelHold, [cancelHold]);

  const holdHandlers = holdMs > 0
    ? {
        onPointerDown: startHold,
        onPointerUp: cancelHold,
        onPointerLeave: cancelHold,
        onPointerCancel: cancelHold,
        onContextMenu: (event) => event.preventDefault(),
      }
    : { onClick: commitReveal };

  const label = confirmLabel ?? `I am ${playerName} — reveal`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={revealed ? title : `${kicker} ${playerName}`}
      className="fixed inset-0 z-50 flex flex-col bg-parchment text-ink animate-curtain-in
                 [background-image:repeating-linear-gradient(0deg,rgba(20,18,16,.035)_0px,rgba(20,18,16,.035)_1px,transparent_1px,transparent_3px)]"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {revealed ? (
        /* ---- Stage two: the secret itself ------------------------------ */
        <>
          <header className={`shrink-0 border-b px-5 pb-3 pt-5 ${palette.rule}`}>
            <p className="font-stencil text-[0.6875rem] uppercase tracking-[0.28em] text-ink/50">
              {playerName}
            </p>
            <h1 className="font-display text-2xl leading-tight">{title}</h1>
          </header>

          <main className="perspective-card min-h-0 flex-1 overflow-y-auto px-5 py-6">
            <div className="animate-flip-in preserve-3d">{children}</div>
          </main>

          {onDone ? (
            <footer className="shrink-0 px-5 pb-5 pt-3">
              <button
                type="button"
                onClick={onDone}
                className={`h-16 w-full rounded-sm font-stencil text-sm uppercase tracking-[0.22em]
                            shadow-[0_2px_0_rgba(20,18,16,0.5)] transition-transform
                            active:translate-y-[2px] active:shadow-none ${palette.button}`}
              >
                {doneLabel}
              </button>
            </footer>
          ) : null}
        </>
      ) : (
        /* ---- Stage one: the handoff ------------------------------------ */
        <>
          <div className="flex min-h-0 flex-1 animate-fade-up flex-col items-center justify-center px-6 text-center">
            <p className="font-stencil text-xs uppercase tracking-[0.32em] text-ink/55">{kicker}</p>

            <h1
              className={`mt-3 font-display text-[clamp(2.5rem,14vw,4.5rem)] font-bold leading-[1.05]
                          break-words ${palette.accent}`}
            >
              {playerName}
            </h1>

            <div className={`mt-5 w-24 border-t-2 ${palette.rule}`} aria-hidden="true" />

            <p className="mt-5 max-w-xs font-display text-lg leading-snug text-ink/80">
              {instruction ?? `${title} — for ${playerName} alone.`}
            </p>

            {warning ? (
              <p className="mt-3 max-w-xs font-stencil text-[0.6875rem] uppercase tracking-[0.18em] text-ink/45">
                {warning}
              </p>
            ) : null}
          </div>

          {/* Anchored low so the confirm button sits under the thumb. */}
          <div className="shrink-0 px-5 pb-6 pt-2">
            <button
              ref={revealButtonRef}
              type="button"
              aria-label={label}
              className={`relative h-20 w-full overflow-hidden rounded-sm font-stencil text-sm
                          uppercase tracking-[0.22em] shadow-[0_3px_0_rgba(20,18,16,0.5)]
                          transition-transform select-none touch-manipulation
                          active:translate-y-[3px] active:shadow-none ${palette.button}`}
              {...holdHandlers}
            >
              {holdMs > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-paper/25 transition-[width] duration-75"
                  style={{ width: `${holdProgress * 100}%` }}
                />
              ) : null}
              <span className="relative">
                {holdMs > 0 && holdProgress === 0 ? `Hold to reveal — ${playerName}` : label}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
