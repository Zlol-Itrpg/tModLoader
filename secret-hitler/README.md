# Secret Hitler XL — pass-and-play

A local, single-device version of Secret Hitler with the fan-made Communist
(XL) expansion. One phone gets passed around the room; the app is responsible
for making sure only the right person ever sees the hidden information.

## Running it

```
npm install
npm run dev      # dev server
npm run build    # production build into dist/
npm run preview  # serve dist/ over http://localhost:4173
npm run icons    # re-render the icon PNGs from public/icon.svg
```

Vite + React + Tailwind 3. The service worker only exists in a production
build, so install and offline behaviour must be checked against `preview`, not
`dev`.

## Installable and offline

The app is a PWA: installed to a home screen it opens without browser chrome,
locked to portrait, and plays with the radio off.

| | |
| --- | --- |
| Name / short name | Secret Hitler XL / Secret Hitler |
| Display | `standalone` — no URL bar to navigate away from mid-handoff |
| Orientation | `portrait` — a rotation would reflow every fixed overlay |
| Theme colour | `#7f1d1d` (status bar) |
| Background colour | `#1c1917` (install splash) |

Everything the app needs — HTML, JS, CSS, fonts, icons — is precached at
install time, which in Workbox *is* cache-first: a precached URL is served from
the cache and never hits the network. The app makes no requests of its own, so
once the precache is populated there is nothing left to fail offline. Fonts are
self-hosted via `@fontsource` for exactly this reason; a webfont from a CDN is
one more thing that breaks on a phone with no signal. Latin subsets only, which
takes the precache from 740 KiB to 444 KiB.

The worker is registered in **prompt** mode, not `autoUpdate`. A new deploy
downloads in the background and then waits: reloading the page mid-handoff would
be worse than running a stale build for another ten minutes. `UpdatePrompt`
shows a toast, and the table taps Refresh when the round ends.

Icons are committed PNGs rendered from `public/icon.svg` by `npm run icons`, so
a plain `npm install && npm run build` needs no image toolchain. Edit the SVG,
re-run the script, commit the output.

**Deploying under a subpath** (a GitHub Pages project site) needs `base` set in
`vite.config.js` *and* `start_url`/`scope` changed to match, or the installed
app launches to a 404 and the worker never controls the page.

## What is in this first drop

| File | What it is |
| --- | --- |
| `src/game/constants.js` | Phases, parties, roles, powers, handoff kinds, win reasons |
| `src/game/config.js` | Every tunable table: board thresholds, power slots, deck and role composition |
| `src/game/deck.js` | Policy deck generator, shuffle, draw-with-reshuffle, peek |
| `src/game/initialState.js` | The store shape and its mock roster |
| `src/game/reducer.js` | The state machine — the full turn loop |
| `src/game/selectors.js` | View derivations: role distribution, reveal intel |
| `src/game/GameContext.jsx` | `GameProvider` + the hooks screens read from |
| `src/game/storage.js` | localStorage save/load/clear, total by construction |
| `src/components/InterstitialScreen.jsx` | The pass-the-device privacy gate |
| `src/components/SetupScreen.jsx` | Roster, expansion toggle, deal |
| `src/components/RoleReveal.jsx` | The first handoff: one card per player |
| `src/components/GameHUD.jsx` | Persistent rail: boards, tracker, deck, roster |
| `src/components/NominationScreen.jsx` | The President picks, in the open |
| `src/components/VotingScreen.jsx` | The secret ballot, one player at a time |
| `src/components/VoteResults.jsx` | The simultaneous reveal |
| `src/components/PolicyCard.jsx` | One policy card, face up |
| `src/components/LegislativePresident.jsx` | Draw three, bin one |
| `src/components/LegislativeChancellor.jsx` | Two in, one enacted |
| `src/components/VetoScreen.jsx` | The veto exchange |
| `src/components/ExecutiveActionScreen.jsx` | Router for the six powers |
| `src/components/TargetPicker.jsx` | Shared select-then-confirm target list |
| `src/components/{PolicyPeek,InvestigateLoyalty,SpecialElection,Execution,Confession,Radicalisation}Screen.jsx` | One per power |
| `src/components/RadicalisationReveal.jsx` | The target's half of Radicalisation |
| `src/components/GameOverScreen.jsx` | Winners, reason, every card face up |
| `src/components/AbandonGameButton.jsx` | End a game in progress, behind a confirm |
| `src/App.jsx` | Phase router |
| `src/main.jsx` | Entry point: fonts, styles, service worker |
| `src/components/UpdatePrompt.jsx` | "New version ready" toast |
| `vite.config.js` | Build + PWA manifest and precache |
| `scripts/generate-icons.mjs` | Renders the icon PNGs from the SVG |
| `tailwind.config.js` | 1930s palette and type scale |

The turn loop, both legislative halves, the veto exchange, all six powers and
the game-over screen are built, and a game in progress survives a refresh. The reducer is complete enough to drive all of them.

## Player counts

Four to twenty. Four is below the official minimum and is a house rule: the
standard homebrew deal is 2 Liberals, 1 Fascist and Hitler. With the expansion
on there is no room for that, so a Liberal becomes the lone Communist —
1/1/1/1. `SetupScreen` prints the live breakdown either way and labels four
players as a house rule, so nothing about it is silent.

One consequence of small tables: once executions bring the survivors down to
two, the term limit can lock out every possible Chancellor. `eligibleChancellors`
lets the limit yield in that case rather than stalling the game.

## The turn loop

```
SETUP ──START_GAME──▶ ROLE_REVEAL (one interstitial per player)
  │
  ▼
NOMINATION ──NOMINATE_CHANCELLOR──▶ VOTING ──CAST_VOTE ×N──▶ VOTE_REVEAL
  ▲                                                               │ RESOLVE_ELECTION
  │                                       ┌─ rejected ─▶ tracker+1 ┤   (3 ⇒ chaos policy)
  │◀──────────────────────────────────────┘                       │
  │                                                        elected │
  │                                            LEGISLATIVE_PRESIDENT ◀┘
  │                                                    │ DISCARD_POLICY
  │                                                    ▼
  │                             LEGISLATIVE_CHANCELLOR ⇄ VETO_PRESIDENT_CONSIDER
  │                                       │ ENACT_POLICY   (reject returns the hand)
  │                                                                              │ PRESIDENT_DISCARD
  │                                                                              ▼
  │                                                                    LEGISLATIVE_CHANCELLOR
  │                                                                              │ CHANCELLOR_ENACT
  │                                        ┌─── no power ─────────────────────────┤
  └────────────────────────────────────────┘                                      │ power slot hit
                                            EXECUTIVE_ACTION ◀────────────────────┘
```
`GAME_OVER` is reachable from any policy enactment (a track completes), from a
vote (Hitler elected Chancellor with 3+ fascist policies), and from an
execution (Hitler is shot).

## Actions

Every action is `{ type, payload }`, and components never build one by hand —
`useGameActions()` hands back the creators pre-bound to dispatch:

```js
actions.nominateChancellor(playerId);  // { type: 'NOMINATE_CHANCELLOR', payload: { chancellorId } }
actions.castVote(VOTES.JA);            // { type: 'CAST_VOTE', payload: { vote } }
actions.resolveElection();             // { type: 'RESOLVE_ELECTION' }
```

## The legislative session

One ephemeral array, `legislative.cards`, carries the hand from the deck to the
board. Entries are `{ id, party }`; the id is unique within the hand and is what
the UI dispatches back, so nothing depends on array position and a policy can
never sit in two lists at once. The array empties in the same step that puts a
card on a track.

The hand is dealt when the election resolves. `drawPolicies` reshuffles the
discard pile back in whenever the deck holds fewer than three, so the President
is always dealt a full hand and the reshuffle is announced in the public log.

Veto is its own phase, `VETO_PRESIDENT_CONSIDER`, not a flag on the session:

- **Consent** discards both policies, advances the election tracker, and rotates
  to the next President. Reaching three failures fires a chaos policy off the
  top of the deck **with no power granted** — the same path a rejected
  government takes.
- **Rejection** returns the hand untouched and sets `legislative.vetoRejected`,
  which locks the button for the rest of the session; a second `REQUEST_VETO` is
  a no-op in the reducer, not just a disabled button in the UI.

The Hitler-as-Chancellor loss is checked **only** when an election resolves.
Enacting a third fascist policy during his term does not end the game — verified
in both directions.

Both legislative screens are select-then-confirm rather than single-tap. The
choice is irreversible, invisible to the table, and often decides the game, so a
mis-tap while the phone is changing hands is not worth the saved tap.

## The ballot loop

The loop lives entirely in the reducer; `VotingScreen` renders whoever
`state.handoff.toPlayerId` names and dispatches one `CAST_VOTE`.

`election.ballotIndex` indexes the **alive** list, not the seat list. Corpses
are skipped, cast no ballot, and are excluded from the majority — `CAST_VOTE`
resolves the next voter as `alivePlayers(state)[ballotIndex + 1]`, and the alive
set cannot change mid-ballot because executions only happen in
EXECUTIVE_ACTION. A majority is `ja > alive / 2`, so an exact tie fails.

When the last ballot lands the machine **stops** at `VOTE_REVEAL` with the tally
on `election.result` and the overlay down. It does not resolve. `VoteResults`
shows every ballot at once, and `RESOLVE_ELECTION` — the Continue button — is
what seats the government, advances the tracker, or ends the game.

## Persistence

The whole store is plain serialisable data, so a save is just the state with a
version stamp. `GameProvider` writes it back on every transition and reads it on
mount; the opening state comes from a `resumeState` prop if given, then a usable
save, then a fresh game.

`storage.js` is **total**: no stored value can throw out of it. A save that is
truncated, not JSON, stamped with a different `SAVE_VERSION`, missing a slice,
or carrying an unknown phase is deleted and treated as absent. That matters more
than it sounds — a throw during the initialiser is a crash on every load, and
the app would be unopenable until someone cleared their browser data by hand,
which is the exact thing this feature exists to avoid. Storage that is blocked
outright, or full, is handled the same way: `writeSave` returns `false` and play
continues in memory.

Bump `SAVE_VERSION` whenever the state shape changes in a way an older save
cannot satisfy. Old saves are discarded, not migrated.

Two things worth knowing:

- **The save holds every secret role.** It is a local file readable from
  devtools. That is inherent to persisting a hidden-role game on the device it
  is played on, but it does mean the save is not tamper-proof — a determined
  player with the phone unlocked can read the deal.
- **One device, one game.** There is a single save key, so a second game
  overwrites the first.

## Resetting

`RESET_GAME` rebuilds the state from `createInitialState`. The roster and the
expansion setting carry over by default, because the same people are usually
still in the room and the setup screen is right there to edit them; pass
`{ keepRoster: false }` for a completely empty table.

Both entry points go through `actions.newGame()`, which drops the save *before*
dispatching so nothing of the finished game can outlive it even if the
write-back effect never runs:

- **Play again**, on the game-over screen.
- **End game**, a deliberately quiet control in the HUD, behind an in-app
  confirmation. Not `window.confirm` — that is styled by the OS, blocks the main
  thread, and is suppressed outright in some mobile browsers.

## Reading the state

```jsx
<GameProvider>          // useReducer(gameReducer, createInitialState())
  <YourScreen />
</GameProvider>
```

State and dispatch sit in separate contexts, so a screen that only fires
actions does not re-render when unrelated state moves:

| Hook | Gives you |
| --- | --- |
| `useGameState()` | the whole state |
| `useGameActions()` | every action creator pre-bound, plus raw `dispatch` |
| `useGame()` | both, for screens that read and write |
| `usePlayer(id)` / `useHandoffPlayer()` | the common lookups |

`useGameActions()` also returns `newGame(options)`, which clears the save and
resets, and the raw `dispatch`.

## What each player learns at the reveal

| Role | Sees |
| --- | --- |
| Fascist | Hitler and the other Fascists |
| Hitler | the Fascists — but only below 7 players; from 7 up he is blind |
| Communist | the rest of the cell |
| Liberal | nothing |

Fascists never see Communists and Communists never see Fascists. The rules live
in `getRoleIntel`; the UI only renders what it is handed.

## The privacy rule

Hidden information only ever reaches the screen through `state.handoff`:

```js
handoff = { kind, toPlayerId, revealed, payload } | null
```

Non-null means the overlay is up and the app body is hidden. `revealed` flips
on tap confirmation (`REVEAL_HANDOFF`). `InterstitialScreen` does not render
its `children` at all until then, so the secret is never in the DOM early —
there is nothing to glimpse from across the table.

Handoffs closed by their own action: `VOTE` (→ `CAST_VOTE`),
`PRESIDENT_LEGISLATIVE` (→ `PRESIDENT_DISCARD`), `CHANCELLOR_LEGISLATIVE`
(→ `CHANCELLOR_ENACT`), `EXECUTIVE_ACTION` (→ `RESOLVE_POWER`). Handoffs with
nothing to decide — `ROLE_REVEAL`, `POWER_RESULT` — close with
`CONTINUE_HANDOFF`.

Confession is deliberately *not* behind an interstitial: making a membership
card public to the whole table is the entire point of the power.

## Boards and powers

All thresholds live in `config.js`. The fascist track scales with the table;
the communist track does not.

| Track | Wins at | Powers |
| --- | --- | --- |
| Liberal | 5 | — |
| Fascist (4–6) | 6 | 3 Policy Peek · 4 Execution · 5 Execution |
| Fascist (7–8) | 6 | 2 Investigate · 3 Special Election · 4–5 Execution |
| Fascist (9–20) | 6 | 1–2 Investigate · 3 Special Election · 4–5 Execution |
| Communist | 5 | 1 Confession · 2 Confession · 3 Radicalisation |

`getBoardPowers(party, playerCount)` is the only way to ask, and it reads the
size the game *started* at (cached on `config` at deal time), so executions
never re-tune the board mid-game.

Veto unlocks at 5 fascist policies. Hitler elected Chancellor at 3+ fascist
policies ends the game.

## The executive phase

Every power resolves in two steps, so nobody's result vanishes when the phone
moves:

1. `RESOLVE_POWER` applies the effect and writes what happened to
   `pendingPower.result`. It never advances the turn.
2. `END_EXECUTIVE_ACTION` clears the power and rotates to the next nomination.

Policy Peek has nothing to choose, so its cards are turned over when the power
*triggers* and the President's screen simply displays them. A targeted power
with no legal target left — every survivor already investigated — is skipped
with a log line rather than stranding the game in a phase nobody can leave.

Two powers break the usual shape:

- **Confession** is public. The device stays with the President and the screen
  says to show it to the table; the membership stays public for the rest of the
  game and the HUD badges it.
- **Radicalisation** hands the device to its *target*, who is the only one told
  whether it worked. Hitler is immune, and only Hitler learns that — the
  President never finds out, which is what makes the power a gamble. A
  radicalised player's `party` flips to Communist while their secret `role` is
  untouched, so they still win with whoever they started with.

Executing Hitler ends the game immediately. With the expansion on that is a
**joint Liberal and Communist victory** — `state.winners` is a list, not a
single party, and `GameOverScreen` renders it as one.

## Known stubs and house rules

- `DECK_COMPOSITION` is placeholder balance derived from the base game's
  6L/11F. Drop in the published XL table when the group picks a printing.
- Four-player games are a house rule, as described above.
- `POWERS.CONGRESS` was retired when the communist schedule became
  1/2 Confession, 3 Radicalisation. Nothing references it.

## Verification so far

**Reducer** — fuzzed over 600 games at 4–20 players. All five win conditions
occur, every power fires, the chaos and veto branches are exercised, and across
every transition: no card is created or lost, no game livelocks, no nomination
runs out of legal candidates, and no handoff ever addresses a dead player.

**Reveal intel** — 24,480 player-reveals across 4–20 players: every role sees
exactly the allies it should and nothing else, and no player is ever listed as
their own ally.

**Ballot loop** — with two players executed out of seven: ballots visit exactly
the living in seat order, `ballotIndex` walks 0..4 over the alive list, the dead
record no vote, and a vote dispatched after the loop closes is ignored. Majority
boundaries checked at 5 and 6 alive, including the exact tie.

**Legislative + veto** — 44 checks: the reshuffle guard with a two-card deck,
card conservation through discard and enactment, stale and duplicate policy ids
rejected, both veto branches, a veto that trips chaos granting no power, and the
Hitler-Chancellor check firing on election but not on legislation.

**Executive powers** — 59 reducer checks: every schedule row at 4/6/7/9/20
players, the schedule holding steady as players are executed, Policy Peek not
consuming the deck, investigations reporting a party and never a role,
one-investigation-per-player, the special-election detour returning to the
calling seat, a skipped power when no legal target remains, Confession going
public, Radicalisation flipping party but not role, Hitler's immunity being told
only to Hitler, and the joint victory firing with the expansion on and the
Liberal-only win with it off.

**Storage** — 44 checks. A mid-game save round-trips exactly, roles and deck
order included. Seventeen kinds of unusable save — truncated, not JSON, empty,
`null`, a bare array, no version, an older version, a newer version, a missing
slice, wrong types, an unknown phase, and the state shape from an earlier build
of this app — are each rejected *and* deleted, so a bad save is only ever read
once. Storage that throws on access and a full quota are both survived.

**Persistence + reset** — 45 jsdom checks across real unmount/remount cycles:
setup and a half-finished ballot both come back intact with the overlay still
covered, a corrupt save boots to a fresh game rather than crashing, and both
reset paths clear the save and stay clear after a refresh.

**UI** — driven through jsdom end to end: setup validation at four and twenty,
add/rename/remove/toggle, the seven role reveals, the HUD (slot counts, power
labels on fascist 3/4/5 and communist 1/2/3, tracker, deck counters, President
and Prev Pres / Prev Chan badges), nomination eligibility matching
`eligibleChancellors` exactly, six ballots, the reveal grid, and the full
legislative session including both veto answers, and all six powers plus the
joint-victory screen. At every handoff the overlay is full-screen and opaque and
its subtree names only the recipient — the payload enters the DOM only after the
hold completes.

**PWA** — the production build driven in Chromium at Pixel 8 size: manifest
fields, the iOS home-screen meta tags, every icon served, and the worker
registering and activating. Then the network is cut and the page reloaded — the
app boots, fonts resolve from the cache, a cold navigation still reaches the app
shell, and a full deal-and-reveal plays through with the game saving to
localStorage. Browser-initiated favicon fetches abort offline because they never
enter a worker client; the same URLs return 200 when fetched through it.

Suite totals: 600 fuzzed games, 24,480 role-reveals, and 511 assertions across
eleven files.

## Wiring it up

`react`, `react-dom`, `vite`, and `tailwindcss` are not installed yet. Once
they are, `tailwind.config.js` expects `./index.html` and `./src/**/*.{js,jsx}`
in its content globs, and the two font families fall back to Georgia and Arial
Narrow if Playfair Display and Oswald are not loaded.
