import { PARTIES } from '../game/constants.js';

/**
 * The decorative layer behind the game-over headline.
 *
 * Confined to the headline banner rather than the whole page: these are
 * high-contrast marks, and stretched over the roster they turn the one thing
 * everybody actually wants to read — who was what — into a legibility problem. — one treatment per kind
 * of victory. Purely presentational and `aria-hidden`: everything it says is
 * already in the text underneath, so a screen reader gains nothing from it.
 *
 * Under `prefers-reduced-motion` the CSS layer freezes these on their first
 * frame, which is why each one is composed to read as a static graphic too.
 */
export default function VictoryFlourish({ winners }) {
  const joint = winners.length > 1;
  const party = winners[0];

  if (joint) {
    // Two halves meeting in the middle: teal from the left, crimson from the
    // right, splitting the banner the way the win itself is split.
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1/2 animate-split-left bg-gradient-to-r
                        from-liberal/40 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-1/2 animate-split-right bg-gradient-to-l
                        from-communist/40 to-transparent" />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-ink/20" />
      </div>
    );
  }

  if (party === PARTIES.LIBERAL) {
    // A slow gold sweep, with two ribbons cutting across the banner.
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 animate-shimmer bg-[length:220%_100%]
                     bg-gradient-to-r from-transparent via-gold/30 to-transparent"
        />
        <div className="absolute left-[-15%] top-[24%] h-5 w-[130%] animate-ribbon-in bg-liberal/55
                        [animation-delay:120ms]" />
        <div className="absolute left-[-15%] top-[72%] h-2 w-[130%] animate-ribbon-in bg-liberal/35
                        [animation-delay:260ms]" />
      </div>
    );
  }

  if (party === PARTIES.FASCIST) {
    // A propaganda stamp slammed across the banner, off-square and overprinted.
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-fascist/10" />
        <div className="absolute inset-x-[-12%] top-1/2 -translate-y-1/2 animate-stamp-in
                        border-y-4 border-fascist/70 bg-fascist/15 py-3 text-center">
          <span className="font-stencil text-2xl uppercase tracking-[0.4em] text-fascist/45">
            Ordnung
          </span>
        </div>
      </div>
    );
  }

  // Communist: a crimson flare going off behind the headline.
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2">
        {[0, 200, 400].map((delay) => (
          <span
            key={delay}
            style={{ animationDelay: `${delay}ms` }}
            className="absolute inset-0 animate-burst bg-communist/35
                       [clip-path:polygon(50%_0%,61%_35%,98%_35%,68%_57%,79%_91%,50%_70%,21%_91%,32%_57%,2%_35%,39%_35%)]"
          />
        ))}
      </div>
    </div>
  );
}
