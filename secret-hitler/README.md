# Secret Hitler XL — pass-and-play

A local, single-device version of Secret Hitler with the fan-made Communist
(XL) expansion. One phone gets passed around the room; the app is responsible
for making sure only the right person ever sees the hidden information.

## What is in this first drop

| File | What it is |
| --- | --- |
| `src/game/constants.js` | Phases, parties, roles, powers, handoff kinds, win reasons |
| `src/game/config.js` | Every tunable table: board thresholds, power slots, deck and role composition |
| `src/game/deck.js` | Policy deck generator, shuffle, draw-with-reshuffle, peek |
| `src/game/initialState.js` | The store shape and its mock roster |
| `src/game/reducer.js` | The state machine — the full turn loop |
| `src/components/InterstitialScreen.jsx` | The pass-the-device privacy gate |
| `tailwind.config.js` | 1930s palette and type scale |

Not built yet: the `GameProvider` context, the SETUP / board / nomination /
ballot / legislative / power screens, and persistence. The reducer is complete
enough to drive all of them.

## The turn loop

```
SETUP ──START_GAME──▶ role reveals (one interstitial per player)
  │
  ▼
NOMINATION ──NOMINATE_CHANCELLOR──▶ VOTING ──CAST_VOTE ×N──┬─ rejected ─▶ tracker+1 ─▶ NOMINATION
  ▲                                                        │              (3 ⇒ chaos policy)
  │                                                        └─ elected ──▶ LEGISLATIVE_PRESIDENT
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

## Boards

Thresholds follow the brief and all live in `config.js`:

| Track | Wins at | Powers |
| --- | --- | --- |
| Liberal | 5 | — |
| Fascist | 6 | 3 Special Election · 4 Execution · 5 Execution |
| Communist | 5 | 1 Confession · 2 Radicalisation · 3 Congress |

Veto unlocks at 5 fascist policies. Hitler elected Chancellor at 3+ fascist
policies ends the game.

## Known stubs

- **Radicalisation** flips the target's `party` to Communist while leaving
  `role` alone, so a radicalised Fascist reads as Communist to an
  investigation. Hitler is immune and the attempt fails privately — the
  canonical reveal rule still needs confirming (`TODO(xl)` in `reducer.js`).
- **Congress** logs and resolves immediately; it still needs to walk the device
  through each living Communist.
- `DECK_COMPOSITION` is placeholder balance derived from the base game's
  6L/11F. Drop in the published XL table when the group picks a printing.
- `INVESTIGATE_LOYALTY` and `POLICY_PEEK` are implemented but unused, since the
  brief fixed the fascist powers at slots 3/4/5.

## Verification so far

The reducer was fuzzed over 600 games at 5–20 players. All five win conditions
occur, every power fires, the chaos and veto branches are exercised, and across
every transition: no card is created or lost, no game livelocks, no nomination
runs out of legal candidates, and no handoff ever addresses a dead player.

## Wiring it up

`react`, `react-dom`, `vite`, and `tailwindcss` are not installed yet. Once
they are, `tailwind.config.js` expects `./index.html` and `./src/**/*.{js,jsx}`
in its content globs, and the two font families fall back to Georgia and Arial
Narrow if Playfair Display and Oswald are not loaded.
