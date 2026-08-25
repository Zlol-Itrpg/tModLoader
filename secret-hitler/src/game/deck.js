import { PARTIES } from './constants.js';
import { getDeckComposition } from './config.js';

/**
 * Policy deck helpers.
 *
 * The deck is a plain array of party strings, top of deck at index 0. Every
 * function here is pure and takes an optional `rng` so tests can seed it.
 */

/** Fisher–Yates. Returns a new array; never mutates the input. */
export function shuffle(cards, rng = Math.random) {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Seed a fresh, shuffled policy deck for the table size.
 *
 * @param {number} playerCount
 * @param {{communistsEnabled?: boolean, rng?: () => number}} [options]
 * @returns {string[]} shuffled policy cards, top of deck first
 */
export function generateDeck(playerCount, options = {}) {
  const { communistsEnabled = true, rng = Math.random } = options;
  const composition = getDeckComposition(playerCount, communistsEnabled);
  const cards = [
    ...Array(composition.liberal).fill(PARTIES.LIBERAL),
    ...Array(composition.fascist).fill(PARTIES.FASCIST),
    ...Array(composition.communist).fill(PARTIES.COMMUNIST),
  ];
  return shuffle(cards, rng);
}

/**
 * Draw from the top of the deck, reshuffling the discard pile in first if the
 * deck is short — exactly as the physical rules require.
 *
 * @returns {{drawn: string[], deck: string[], discard: string[], reshuffled: boolean}}
 */
export function drawPolicies(deck, discard, count, rng = Math.random) {
  let workingDeck = deck;
  let workingDiscard = discard;
  let reshuffled = false;

  if (workingDeck.length < count) {
    workingDeck = shuffle([...workingDeck, ...workingDiscard], rng);
    workingDiscard = [];
    reshuffled = true;
  }

  return {
    drawn: workingDeck.slice(0, count),
    deck: workingDeck.slice(count),
    discard: workingDiscard,
    reshuffled,
  };
}

/** Non-destructive look at the top `count` cards, reshuffling if needed. */
export function peekPolicies(deck, discard, count, rng = Math.random) {
  const result = drawPolicies(deck, discard, count, rng);
  return {
    peeked: result.drawn,
    // Put the peeked cards back on top — a peek never consumes them.
    deck: [...result.drawn, ...result.deck],
    discard: result.discard,
    reshuffled: result.reshuffled,
  };
}

/** Count remaining cards by party, for the "cards left" readout. */
export function countByParty(cards) {
  return cards.reduce(
    (acc, card) => ({ ...acc, [card]: (acc[card] ?? 0) + 1 }),
    { [PARTIES.LIBERAL]: 0, [PARTIES.FASCIST]: 0, [PARTIES.COMMUNIST]: 0 },
  );
}
