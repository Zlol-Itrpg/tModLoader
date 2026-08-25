import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Service worker registration, and the only UI it needs.
 *
 * The worker is registered in `prompt` mode, so a newly deployed version
 * downloads in the background and then *waits*. Reloading a phone mid-handoff
 * would be worse than running a stale build for another ten minutes, so the
 * table decides when to take it.
 *
 * Mounted from main.jsx rather than App.jsx: `virtual:pwa-register/react` is a
 * Vite virtual module, so anything importing this file only builds under the
 * bundler.
 */
export default function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const dismiss = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    // Above the interstitials (z-50) — an update notice must not be buried
    // under a handoff overlay.
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div className="mx-auto flex max-w-sm items-center gap-3 rounded-sm border-2 border-ink
                      bg-parchment px-4 py-3 shadow-[0_4px_0_rgba(20,18,16,0.5)]">
        <p className="min-w-0 flex-1 font-display text-sm leading-snug text-ink">
          {needRefresh ? 'A new version is ready.' : 'Ready to play offline.'}
          {needRefresh ? (
            <span className="mt-0.5 block font-stencil text-[0.5625rem] uppercase tracking-[0.14em] text-ink/55">
              Finish the round first — this can wait
            </span>
          ) : null}
        </p>

        {needRefresh ? (
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="h-11 shrink-0 rounded-sm bg-ink px-3 font-stencil text-[0.625rem] uppercase
                       tracking-[0.16em] text-paper transition-transform active:translate-y-[1px]"
          >
            Refresh
          </button>
        ) : null}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-sm text-2xl leading-none
                     text-ink/45 active:bg-ink/10"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
