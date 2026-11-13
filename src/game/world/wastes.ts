import { Builder, type LevelData } from './builder';

/**
 * "The Khepri Wastes" – the desert above the Necropolis, out in the open at high noon. Twice the size of
 * the other areas: rolling dunes, a ruined legion camp, an oasis, a canyon of stepping stones and the
 * old arena where Varro still fights. Mummies and the fallen legion walk the sand.
 *
 * Jump budget (see Player): ~3.5 tiles high, ~4 tiles across walking, ~6 sprinting.
 */
export function buildWastes(): LevelData {
  const b = new Builder(400, 40, 'wastes', 'The Khepri Wastes', 'desert');

  // bounds
  b.fill(0, 0, 1, 39);
  b.fill(398, 0, 399, 39);

  // --- A: out of the tomb
  b.ground(0, 26, 28);
  b.data.spawn = b.at(8, 28);
  b.door({ id: 'wastes-entry', to: 'necropolis', entry: 'wastes-door' }, 4, 28);
  b.data.bonfires.push({ id: 'wastes', ...b.at(12, 28) });

  // --- B: rolling dunes (steps of one or two tiles)
  const dunes: [number, number, number][] = [
    [27, 38, 27], [39, 52, 26], [53, 60, 25], [61, 74, 26], [75, 88, 27], [89, 100, 28], [101, 112, 27], [113, 124, 26],
  ];
  for (const [x1, x2, top] of dunes) b.ground(x1, x2, top);
  b.enemy('mummy', 34, 27);
  b.enemy('legionary', 58, 25);
  b.enemy('mummy', 82, 27);
  b.item('dune-herb', 'ember_herb', 56, 25, 2);
  b.item('dune-soul', 'soul_lost_knight', 110, 27);

  // --- C: the ruined legion camp (a raised platform of old stone, steps up to a watch post)
  b.ground(125, 170, 26);
  b.pave(130, 166, 26);
  b.fill(140, 21, 152, 22); // the watch post
  b.pave(140, 152, 21);
  b.plat(135, 24, 3);
  b.enemy('legionary', 134, 26);
  b.enemy('legionary', 148, 21);
  b.enemy('legionary', 160, 26);
  b.enemy('mummy', 155, 26);
  b.item('camp-shards', 'titanite', 151, 21, 2);
  b.item('camp-soul', 'soul_nameless', 164, 26);

  // --- D: the oasis (bonfire)
  b.ground(171, 205, 27);
  b.data.bonfires.push({ id: 'oasis', ...b.at(186, 27) });
  b.item('oasis-bread', 'bread', 192, 27, 3);
  b.enemy('mummy', 200, 27);

  // --- E: the canyon – stones over a spike floor
  b.pit(206, 242, 38);
  // up-jumps have gaps of at most 2 (a walking jump clears 2 up / 2 across with room), down-jumps 3
  b.fill(208, 26, 210, 26);
  b.fill(213, 24, 215, 24);
  b.fill(219, 25, 221, 25);
  b.fill(224, 23, 226, 23);
  b.item('canyon-flask', 'flask_shard', 225, 23);
  b.fill(230, 25, 232, 25);
  b.mover(234, 26, 3, 6, 0, 4.5); // hop on from the last stone; it carries you to the far side
  b.ground(243, 290, 27);
  b.enemy('legionary', 252, 27);
  b.enemy('mummy', 262, 27);
  b.enemy('legionary', 274, 27);
  b.enemy('mummy', 284, 27);

  // --- F: the dunes before the arena
  b.ground(291, 310, 26);
  b.ground(311, 336, 27);
  b.data.bonfires.push({ id: 'arena-gate', ...b.at(328, 27) });
  b.enemy('legionary', 304, 26);
  b.item('gate-soul', 'soul_nameless', 315, 27);

  // --- G: Varro's arena (paved sandstone)
  b.ground(337, 397, 27);
  b.pave(337, 397, 27);
  b.data.boss = {
    type: 'gladiator',
    ...b.at(384, 27),
    fogX: 340 * 16,
    flag: 'gladiatorDefeated',
    banner: 'GLADIATOR FELLED',
    sub: 'The crowd of the dead falls silent',
  };
  // once he falls, a small cloud settles over the arena: the way up to the Sky Reaches
  b.door(
    {
      id: 'sky-portal', to: 'sky', entry: 'sky-entry', requires: 'gladiatorDefeated', sealed: true, look: 'portal',
      lockedMsg: 'A wisp of cloud hangs over the sand, thin as breath. The arena is not yet won.',
    },
    394,
    27,
  );

  // --- props
  const prop = b.prop.bind(b);
  for (const c of [20, 45, 70, 96, 118, 178, 198, 248, 268, 296, 318]) prop(c % 2 ? 'cactus' : 'scrub', c, 28);
  for (const c of [31, 64, 86, 107, 173, 256, 280, 307]) prop('scrub', c, 28);
  prop('skull', 40, 26);
  prop('bone', 92, 28);
  prop('pillar', 128, 26);
  prop('banner', 142, 18);
  prop('pillar', 146, 21);
  prop('urn', 158, 26);
  prop('pillar', 168, 26);
  prop('urn', 182, 27);
  prop('cactus', 189, 27);
  prop('skull', 246, 27);
  prop('pillar', 338, 27);
  prop('pillar', 352, 27);
  prop('pillar', 368, 27);
  prop('bone', 375, 27);
  prop('pillar', 396, 27);
  return b.build();
}
