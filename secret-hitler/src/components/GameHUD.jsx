import { useGameState } from '../game/GameContext.jsx';
import AbandonGameButton from './AbandonGameButton.jsx';
import { BOARDS, CHAOS_AT, getBoardPowers } from '../game/config.js';
import { PARTIES, POWERS, POWER_INFO } from '../game/constants.js';
import { BOARD_ORDER } from '../game/initialState.js';

/**
 * The persistent rail: three tracks, the election tracker, the deck counters
 * and the roster. Reads state, decides nothing.
 *
 * Slots are plain divs, not SVG — six of them per row on a phone, so the DOM
 * stays cheap and the tracks reflow with the viewport.
 */

/** Monochrome glyphs, so the board reads as printed card stock, not emoji. */
const POWER_GLYPH = {
  [POWERS.INVESTIGATE_LOYALTY]: '?',
  [POWERS.SPECIAL_ELECTION]: '⚑',
  [POWERS.POLICY_PEEK]: '◔',
  [POWERS.EXECUTION]: '✖',
  [POWERS.CONFESSION]: '◉',
  [POWERS.RADICALISATION]: '↺',
};

const TRACK = {
  [PARTIES.LIBERAL]: { fill: 'bg-liberal', edge: 'border-liberal/40', text: 'text-liberal' },
  [PARTIES.FASCIST]: { fill: 'bg-fascist', edge: 'border-fascist/40', text: 'text-fascist' },
  [PARTIES.COMMUNIST]: { fill: 'bg-communist', edge: 'border-communist/40', text: 'text-communist' },
};

function PolicyTrack({ party, enacted, playerCount }) {
  const board = BOARDS[party];
  const style = TRACK[party];
  const slots = Array.from({ length: board.slots }, (_, index) => index + 1);
  // Fascist powers scale with the table, so the rail has to ask, not assume.
  const powers = getBoardPowers(party, playerCount);

  const nextPowerSlot = slots.find((slot) => powers[slot] && slot > enacted);
  const nextPower = nextPowerSlot ? powers[nextPowerSlot] : null;

  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={`font-stencil text-[0.6875rem] uppercase tracking-[0.24em] ${style.text}`}>
          {board.label}
        </h3>
        <span className="font-stencil text-[0.625rem] tabular-nums tracking-[0.14em] text-ink/45">
          {enacted}/{board.winAt} to win
        </span>
      </div>

      <div className="mt-1 flex gap-1 overflow-x-auto pb-0.5">
        {slots.map((slot) => {
          const isFilled = slot <= enacted;
          const power = powers[slot];
          return (
            <div
              key={slot}
              title={power ? `Slot ${slot}: ${POWER_INFO[power].label}` : `Slot ${slot}`}
              className={`grid h-16 w-12 shrink-0 place-items-center rounded-sm border-2 ${
                isFilled ? `${style.fill} border-transparent` : `${style.edge} bg-paper/40`
              }`}
            >
              {isFilled ? (
                <span className="font-display text-2xl font-bold text-paper">{board.label[0]}</span>
              ) : power ? (
                <span
                  aria-label={POWER_INFO[power].label}
                  className={`font-display text-xl leading-none ${style.text} opacity-70`}
                >
                  {POWER_GLYPH[power]}
                </span>
              ) : (
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink/15" />
              )}
            </div>
          );
        })}
      </div>

      {nextPower ? (
        <p className="mt-1 font-stencil text-[0.625rem] uppercase tracking-[0.14em] text-ink/50">
          Slot {nextPowerSlot}: {POWER_INFO[nextPower].label}
        </p>
      ) : null}
    </section>
  );
}

function Badge({ children, className = '' }) {
  return (
    <span
      className={`shrink-0 rounded-sm px-1.5 py-0.5 font-stencil text-[0.5625rem] uppercase
                  leading-none tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

export default function GameHUD() {
  const state = useGameState();
  const { boards, deck, discard, election, government, lastElectedGovernment, config } = state;

  const tracks = BOARD_ORDER.filter(
    (party) => party !== PARTIES.COMMUNIST || config.communistsEnabled,
  );
  const alive = state.players.filter((player) => player.isAlive);
  const dead = state.players.filter((player) => !player.isAlive);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-stencil text-[0.5625rem] uppercase tracking-[0.28em] text-ink/40">
          Secret Hitler XL
        </p>
        <AbandonGameButton />
      </div>

      {/* ---- The three boards ------------------------------------------- */}
      <div className="space-y-3">
        {tracks.map((party) => (
          <PolicyTrack
            key={party}
            party={party}
            enacted={boards[party].enacted}
            playerCount={config.playerCount}
          />
        ))}
      </div>

      {/* ---- Tracker + deck --------------------------------------------- */}
      <div className="mt-4 flex items-end justify-between gap-4 border-t border-ink/15 pt-3">
        <div>
          <h3 className="font-stencil text-[0.625rem] uppercase tracking-[0.2em] text-ink/50">
            Election tracker
          </h3>
          <div className="mt-1 flex items-center gap-1.5">
            {Array.from({ length: CHAOS_AT }, (_, index) => (
              <span
                key={index}
                aria-hidden="true"
                className={`h-3 w-8 rounded-sm border ${
                  index < election.tracker ? 'border-transparent bg-fascist' : 'border-ink/25 bg-paper/40'
                }`}
              />
            ))}
            <span className="ml-1 font-stencil text-[0.625rem] tabular-nums text-ink/45">
              {election.tracker}/{CHAOS_AT}
            </span>
          </div>
        </div>

        <p className="text-right font-stencil text-[0.625rem] uppercase leading-relaxed tracking-[0.14em] text-ink/50">
          Draw <span className="tabular-nums text-ink/80">{deck.length}</span>
          <br />
          Discard <span className="tabular-nums text-ink/80">{discard.length}</span>
        </p>
      </div>

      {/* ---- Roster ------------------------------------------------------ */}
      <div className="mt-4 border-t border-ink/15 pt-3">
        <h3 className="font-stencil text-[0.625rem] uppercase tracking-[0.2em] text-ink/50">
          At the table
        </h3>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {alive.map((player) => {
            const isPresident = player.id === government.presidentId;
            const isChancellor = player.id === government.chancellorId;
            const wasPresident = player.id === lastElectedGovernment.presidentId;
            const wasChancellor = player.id === lastElectedGovernment.chancellorId;

            return (
              <li
                key={player.id}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-1.5 ${
                  isPresident ? 'border-ink bg-ink text-paper' : 'border-ink/20 bg-paper/50'
                }`}
              >
                <span className="font-display text-sm leading-none">{player.name}</span>
                {isPresident ? <Badge className="bg-paper text-ink">President</Badge> : null}
                {isChancellor ? <Badge className="bg-liberal text-paper">Chancellor</Badge> : null}
                {/* Term limits, visible before anyone starts nominating. */}
                {!isPresident && wasPresident ? (
                  <Badge className="bg-ink/10 text-ink/55">Prev Pres</Badge>
                ) : null}
                {!isChancellor && wasChancellor ? (
                  <Badge className="bg-ink/10 text-ink/55">Prev Chan</Badge>
                ) : null}
                {player.isPartyPublic ? (
                  <Badge className="bg-communist text-paper">{BOARDS[player.party].label}</Badge>
                ) : null}
              </li>
            );
          })}
        </ul>

        {dead.length > 0 ? (
          <p className="mt-2 font-stencil text-[0.625rem] uppercase tracking-[0.14em] text-ink/40">
            Executed: {dead.map((player) => player.name).join(', ')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
