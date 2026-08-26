import { createInitialState } from '../../src/game/initialState.js';
import { gameReducer, actions } from '../../src/game/reducer.js';
import { getRoleIntel } from '../../src/game/selectors.js';
import { ROLES } from '../../src/game/constants.js';

let checked = 0;
for (let n = 4; n <= 20; n++) {
  for (let trial = 0; trial < 120; trial++) {
    const names = Array.from({ length: n }, (_, i) => `P${i}`);
    const s = gameReducer(createInitialState({ names }), actions.startGame());
    const fascists = s.players.filter((p) => p.role === ROLES.FASCIST);
    const communists = s.players.filter((p) => p.role === ROLES.COMMUNIST);
    const hitler = s.players.find((p) => p.role === ROLES.HITLER);

    for (const me of s.players) {
      const intel = getRoleIntel(s, me.id);
      const seen = new Set(intel.allies.map((a) => a.id));
      const expect = (set, why) => {
        const want = new Set(set.map((p) => p.id));
        if (want.size !== seen.size || [...want].some((id) => !seen.has(id))) {
          throw new Error(`n=${n} ${me.role} ${why}: saw ${[...seen]} wanted ${[...want]}`);
        }
      };
      if (me.role === ROLES.FASCIST) {
        expect([hitler, ...fascists.filter((f) => f.id !== me.id)], 'sees Hitler + co-fascists');
      } else if (me.role === ROLES.HITLER) {
        expect(n < 7 ? fascists : [], n < 7 ? 'sees fascists below 7' : 'blind at 7+');
      } else if (me.role === ROLES.COMMUNIST) {
        expect(communists.filter((c) => c.id !== me.id), 'sees the cell');
      } else {
        expect([], 'liberals see nothing');
      }
      if (intel.allies.some((a) => a.id === me.id)) throw new Error('player listed as own ally');
      checked++;
    }
  }
}
console.log(`intel rules hold across ${checked} player-reveals (n=4..20, 120 deals each)`);
