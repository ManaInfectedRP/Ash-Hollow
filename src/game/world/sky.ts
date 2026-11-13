import { Builder, type LevelData } from './builder';

/**
 * "The Sky Reaches" – islands of cloud high above the world, reached through a cloud that settles over
 * Varro's arena once he falls. There is no ground: only cloud isles, thin wisps you can jump up through,
 * drifting cloud slabs and clouds that dissolve under you. Falling is death.
 * Arrival isle (bonfire) → hopping isles → a drifting cloud → dissolving steps up to a high isle →
 * down to Cloudrest (bonfire) → a rising cloud → the long crossing → the Leviathan's gate (bonfire) →
 * the floating white platform where the Sky Leviathan swims.
 *
 * Jump budget (see Player): ~3.5 tiles high, ~4 tiles across walking, ~6 sprinting. Up-jumps here are
 * at most 2 up with a gap of 2; down-jumps at most 3 across.
 */
export function buildSky(): LevelData {
  const b = new Builder(304, 40, 'sky', 'The Sky Reaches', 'sky');

  // bounds (the edges of the world)
  b.fill(0, 0, 1, 39);
  b.fill(302, 0, 303, 39);

  // --- A: the arrival isle
  b.fill(2, 26, 22, 28);
  b.data.spawn = b.at(8, 26);
  b.door({ id: 'sky-entry', to: 'wastes', entry: 'sky-portal', look: 'portal' }, 5, 26);
  b.data.bonfires.push({ id: 'sky', ...b.at(12, 26) });
  b.item('sky-herb', 'ember_herb', 19, 26, 2);

  // --- B: hopping isles
  b.fill(25, 25, 28, 27);
  b.fill(31, 24, 34, 26);
  b.plat(37, 22, 4);
  b.fill(43, 23, 49, 25);
  b.enemy('cloudslime', 46, 23);

  // --- C: a drifting cloud to the next isle
  b.mover(51, 23, 3, 8, 0, 5); // 51 → 59: one-tile hops on and off
  b.fill(63, 23, 70, 25);
  b.enemy('wisp', 67, 23);
  b.item('sky-soul-a', 'soul_lost_knight', 69, 23);

  // --- D: dissolving clouds up to the high isle
  b.crumble(73, 21, 3);
  b.crumble(78, 19, 3);
  b.crumble(83, 17, 3);
  b.fill(88, 17, 100, 19);
  b.enemy('cloudslime', 94, 17);
  b.item('sky-shards', 'titanite', 99, 17, 2);

  // --- E: down to Cloudrest
  b.fill(104, 20, 108, 22);
  b.fill(112, 23, 116, 25);
  b.fill(120, 24, 140, 26);
  b.data.bonfires.push({ id: 'cloudrest', ...b.at(125, 24) });
  b.enemy('wisp', 132, 24);
  b.enemy('cloudslime', 137, 24);
  b.item('cloudrest-soul', 'soul_nameless', 139, 24);

  // --- F: a rising cloud to the upper isle
  b.mover(142, 24, 3, 0, -8, 5.5); // row 24 → 16
  b.fill(146, 16, 160, 18);
  b.enemy('wisp', 155, 16);
  b.item('sky-flask', 'flask_shard', 159, 16);

  // --- G: the long crossing
  b.mover(162, 16, 3, 9, 0, 5.5); // 162 → 171
  b.fill(175, 17, 180, 19);
  b.plat(184, 18, 3);
  b.plat(190, 19, 3);
  b.fill(196, 20, 210, 22);
  b.enemy('wisp', 200, 20);
  b.enemy('cloudslime', 206, 20);
  b.item('crossing-bread', 'bread', 208, 20, 2);

  // --- H: the Leviathan's gate
  b.fill(214, 23, 224, 25);
  b.data.bonfires.push({ id: 'leviathan-gate', ...b.at(218, 23) });

  // --- I: the floating white platform
  b.fill(227, 24, 299, 25);
  b.data.boss = {
    type: 'leviathan',
    ...b.at(272, 24),
    fogX: 229 * 16,
    flag: 'leviathanDefeated',
    banner: 'LEVIATHAN FELLED',
    sub: 'Its song fades into the wind',
  };
  // once it falls, a cloud gathers at the far end of the platform: the way down to the Weeping Shrine
  b.door(
    {
      id: 'shrine-portal', to: 'shrine', entry: 'shrine-entry', requires: 'leviathanDefeated', sealed: true, look: 'portal',
      lockedMsg: 'A grey cloud, heavy with the smell of incense. It will not carry you while the Leviathan swims.',
    },
    297,
    24,
  );

  // --- props: what's left of a city that once stood up here
  const prop = b.prop.bind(b);
  prop('pillar', 4, 26);
  prop('pillar', 21, 26);
  prop('pillar', 89, 17);
  prop('lantern', 123, 24, { light: true });
  prop('pillar', 139, 24);
  prop('pillar', 149, 16);
  prop('pillar', 215, 23);
  prop('pillar', 228, 24);
  prop('pillar', 298, 24);
  return b.build();
}
