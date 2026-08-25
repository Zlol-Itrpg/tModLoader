/**
 * Secret Hitler XL — shared enums.
 *
 * Everything in the game module is a plain serialisable value so the whole
 * store can be snapshotted (localStorage resume, time-travel debugging, tests).
 */

/** Top-level state machine phases. */
export const PHASES = {
  SETUP: 'SETUP',
  ROLE_REVEAL: 'ROLE_REVEAL',
  NOMINATION: 'NOMINATION',
  VOTING: 'VOTING',
  LEGISLATIVE_PRESIDENT: 'LEGISLATIVE_PRESIDENT',
  LEGISLATIVE_CHANCELLOR: 'LEGISLATIVE_CHANCELLOR',
  EXECUTIVE_ACTION: 'EXECUTIVE_ACTION',
  GAME_OVER: 'GAME_OVER',
};

/** Policy card / board tracks. Also used as party colours. */
export const PARTIES = {
  LIBERAL: 'LIBERAL',
  FASCIST: 'FASCIST',
  COMMUNIST: 'COMMUNIST',
};

/** Secret roles dealt at setup. `party` is what an investigation reveals. */
export const ROLES = {
  LIBERAL: 'LIBERAL',
  FASCIST: 'FASCIST',
  HITLER: 'HITLER',
  COMMUNIST: 'COMMUNIST',
};

/** Membership card shown by Investigate / Confession. Hitler reads as Fascist. */
export const ROLE_PARTY = {
  [ROLES.LIBERAL]: PARTIES.LIBERAL,
  [ROLES.FASCIST]: PARTIES.FASCIST,
  [ROLES.HITLER]: PARTIES.FASCIST,
  [ROLES.COMMUNIST]: PARTIES.COMMUNIST,
};

/** Executive powers. Fascist powers are canon; communist powers are XL. */
export const POWERS = {
  // Fascist track
  INVESTIGATE_LOYALTY: 'INVESTIGATE_LOYALTY',
  SPECIAL_ELECTION: 'SPECIAL_ELECTION',
  POLICY_PEEK: 'POLICY_PEEK',
  EXECUTION: 'EXECUTION',
  // Communist track (XL)
  CONFESSION: 'CONFESSION',
  RADICALISATION: 'RADICALISATION',
  CONGRESS: 'CONGRESS',
};

/** Human-readable power copy, kept next to the enum so the UI stays dumb. */
export const POWER_INFO = {
  [POWERS.INVESTIGATE_LOYALTY]: {
    label: 'Investigate Loyalty',
    blurb: 'Look at one player’s party membership card.',
    needsTarget: true,
  },
  [POWERS.SPECIAL_ELECTION]: {
    label: 'Special Election',
    blurb: 'Pick the next Presidential Candidate. The seat returns to normal order afterwards.',
    needsTarget: true,
  },
  [POWERS.POLICY_PEEK]: {
    label: 'Policy Peek',
    blurb: 'Look at the top three policy cards.',
    needsTarget: false,
  },
  [POWERS.EXECUTION]: {
    label: 'Execution',
    blurb: 'Kill a player. They lose their vote and their voice.',
    needsTarget: true,
  },
  [POWERS.CONFESSION]: {
    label: 'Confession',
    blurb: 'Force a player to reveal their party membership to the whole table.',
    needsTarget: true,
  },
  [POWERS.RADICALISATION]: {
    label: 'Radicalisation',
    blurb: 'Convert a player to the Communist party. Hitler cannot be converted.',
    needsTarget: true,
  },
  [POWERS.CONGRESS]: {
    label: 'Congress',
    blurb: 'The Communists learn who else is Communist — including anyone radicalised since.',
    needsTarget: false,
  },
};

/** Votes are recorded per player id so a re-vote is a plain overwrite. */
export const VOTES = { JA: 'JA', NEIN: 'NEIN' };

/**
 * Handoff kinds — what the InterstitialScreen is currently guarding.
 * A non-null `handoff` always means "the device is in transit; show the overlay".
 */
export const HANDOFF = {
  ROLE_REVEAL: 'ROLE_REVEAL',
  VOTE: 'VOTE',
  PRESIDENT_LEGISLATIVE: 'PRESIDENT_LEGISLATIVE',
  CHANCELLOR_LEGISLATIVE: 'CHANCELLOR_LEGISLATIVE',
  EXECUTIVE_ACTION: 'EXECUTIVE_ACTION',
  POWER_RESULT: 'POWER_RESULT',
};

/** Why the game ended — drives the GAME_OVER copy. */
export const WIN_REASONS = {
  POLICY_TRACK: 'POLICY_TRACK',
  HITLER_ELECTED: 'HITLER_ELECTED',
  HITLER_EXECUTED: 'HITLER_EXECUTED',
};
