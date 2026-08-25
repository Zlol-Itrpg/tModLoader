import { PARTIES, ROLES } from './constants.js';
import { BOARDS, HITLER_KNOWS_FASCISTS_BELOW, getRoleComposition } from './config.js';

/**
 * View-facing derivations. Nothing here mutates or decides — the reducer stays
 * the single source of truth; these just answer questions the screens ask.
 */

/** Table of contents for the SETUP breakdown. */
export function getRoleDistribution(playerCount, communistsEnabled) {
  const composition = getRoleComposition(playerCount, communistsEnabled);
  const parts = [
    { label: composition.liberals === 1 ? 'Liberal' : 'Liberals', count: composition.liberals, party: PARTIES.LIBERAL },
    { label: composition.fascists === 1 ? 'Fascist' : 'Fascists', count: composition.fascists, party: PARTIES.FASCIST },
    { label: 'Hitler', count: 1, party: PARTIES.FASCIST },
  ];
  if (composition.communists > 0) {
    parts.splice(2, 0, {
      label: composition.communists === 1 ? 'Communist' : 'Communists',
      count: composition.communists,
      party: PARTIES.COMMUNIST,
    });
  }
  return {
    ...composition,
    parts: parts.filter((part) => part.count > 0),
    summary: parts
      .filter((part) => part.count > 0)
      .map((part) => (part.label === 'Hitler' ? 'Hitler' : `${part.count} ${part.label}`))
      .join(', '),
  };
}

/**
 * What one player learns at the reveal, beyond their own card.
 *
 * Fascists see each other and Hitler. Hitler sees the Fascists only on a small
 * table — from seven players up he is on his own and has to be found. Communists
 * see their own cell. Liberals see nothing, which is the whole game.
 *
 * @returns {{headline: string|null, allies: Array<{id,name,role,isHitler:boolean}>, note: string|null}}
 */
export function getRoleIntel(state, playerId) {
  const me = state.players.find((player) => player.id === playerId);
  if (!me) return { headline: null, allies: [], note: null };

  const others = state.players.filter((player) => player.id !== playerId);
  const describe = (player) => ({
    id: player.id,
    name: player.name,
    role: player.role,
    isHitler: player.role === ROLES.HITLER,
  });

  switch (me.role) {
    case ROLES.FASCIST: {
      const allies = others
        .filter((player) => player.role === ROLES.FASCIST || player.role === ROLES.HITLER)
        .map(describe);
      return {
        headline: allies.length === 1 ? 'Your ally' : 'Your fellow Fascists',
        allies,
        note: 'They know you too. Nobody else does.',
      };
    }

    case ROLES.HITLER: {
      if (state.players.length >= HITLER_KNOWS_FASCISTS_BELOW) {
        return {
          headline: null,
          allies: [],
          note: `With ${HITLER_KNOWS_FASCISTS_BELOW} or more players you do not learn who your Fascists are. They know you — find them without being found.`,
        };
      }
      const allies = others.filter((player) => player.role === ROLES.FASCIST).map(describe);
      return {
        headline: allies.length === 1 ? 'Your Fascist' : 'Your Fascists',
        allies,
        note: 'They know you. Never let the table hear you say so.',
      };
    }

    case ROLES.COMMUNIST: {
      const allies = others.filter((player) => player.role === ROLES.COMMUNIST).map(describe);
      return {
        headline: allies.length === 1 ? 'Your fellow Communist' : 'Your fellow Communists',
        allies,
        note: allies.length
          ? 'They know you too. The Fascists do not.'
          : 'You are the only Communist at this table. Radicalisation is how you get company.',
      };
    }

    default:
      return {
        headline: null,
        allies: [],
        note: 'Liberals know nothing at all. Everything you learn, you learn at the table.',
      };
  }
}

/** Party colour token for a role or party, for tone-matching the UI. */
export function partyTone(party) {
  return BOARDS[party] ? party.toLowerCase() : 'neutral';
}
