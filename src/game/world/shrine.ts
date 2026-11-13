import { Builder, type LevelData } from './builder';

/**
 * "The Weeping Shrine" – a mountain shrine on a still, moonlit night, reached through the cloud that
 * settles on the Leviathan's platform once it falls. Paper lanterns, bamboo, hair in the cracks of the
 * paving. Courtyard + bonfire → the bamboo path → the lacquered bridge over nothing (a rotten span in
 * the middle) → the shrine hall (bonfire) → the steps → Ayame's hall under the open sky.
 *
 * Jump budget (see Player): ~3.5 tiles high, ~4 tiles across walking, ~6 sprinting.
 */
export function buildShrine(): LevelData {
  const b = new Builder(240, 34, 'shrine', 'The Weeping Shrine', 'shrine');

  // bounds
  b.fill(0, 0, 1, 33);
  b.fill(238, 0, 239, 33);

  // --- A: the courtyard
  b.ground(0, 30, 24);
  b.data.spawn = b.at(8, 24);
  b.door({ id: 'shrine-entry', to: 'sky', entry: 'shrine-portal', look: 'portal' }, 4, 24);
  b.data.bonfires.push({ id: 'shrine', ...b.at(11, 24) });
  b.enemy('maiden', 26, 24);
  b.item('shrine-herb', 'ember_herb', 22, 24, 2);

  // --- B: the bamboo path (hair waits in the cracks)
  b.ground(31, 44, 23);
  b.ground(45, 58, 22);
  b.ground(59, 70, 23);
  b.enemy('hair', 39, 23);
  b.enemy('maiden', 49, 22);
  b.enemy('hair', 54, 22);
  b.enemy('lantern', 62, 23);
  b.enemy('hair', 67, 23);
  b.item('path-soul', 'soul_lost_knight', 57, 22);

  // --- C: the lacquered bridge over nothing, rotten in the middle
  // the rotten span is short enough to walk across – just don't stop on it
  b.plat(71, 22, 8);
  b.crumble(79, 22, 2);
  b.plat(81, 22, 12);
  b.enemy('lantern', 76, 22);
  b.enemy('lantern', 88, 22);

  // --- D: the shrine hall (roofed)
  b.ground(93, 150, 23);
  b.fill(93, 0, 150, 15);
  b.data.bonfires.push({ id: 'inner-shrine', ...b.at(98, 23) });
  b.enemy('faceless', 110, 23);
  b.enemy('maiden', 121, 23);
  b.enemy('hair', 129, 23);
  b.enemy('faceless', 139, 23);
  b.item('hall-shards', 'titanite', 116, 23, 2);
  b.item('hall-soul', 'soul_nameless', 147, 23);

  // --- E: the steps up
  b.ground(151, 156, 21);
  b.ground(157, 162, 19);
  b.ground(163, 175, 17);
  b.enemy('maiden', 168, 17);
  b.item('steps-bread', 'bread', 173, 17, 2);

  // --- F: Ayame's hall, open to the sky
  b.ground(176, 237, 17);
  b.data.boss = {
    type: 'ayame',
    ...b.at(222, 17),
    fogX: 178 * 16,
    flag: 'ayameDefeated',
    banner: 'BRIDE FELLED',
    sub: 'Her weeping stops at last',
  };
  // behind her hall, the road home – through what burned
  b.door(
    {
      id: 'ash-gate', to: 'ashroad', entry: 'ashroad-entry', requires: 'ayameDefeated', sealed: true,
      lockedMsg: 'Ash drifts under the door. Her weeping holds it shut.',
    },
    235,
    17,
  );

  // --- props: lanterns carry the light (they all go out in her third phase)
  const prop = b.prop.bind(b);
  prop('stonelantern', 6, 24, { light: true });
  prop('torii', 17, 24);
  prop('stonelantern', 28, 24, { light: true });
  for (const c of [33, 42, 47, 60, 66]) prop('bamboo', c, 23);
  prop('paperlantern', 44, 16, { hang: true, light: true });
  prop('stonelantern', 69, 23, { light: true });
  prop('stonelantern', 94, 23, { light: true });
  for (const c of [104, 116, 128, 140]) prop('paperlantern', c, 16, { hang: true, light: true });
  prop('stonelantern', 149, 23, { light: true });
  prop('stonelantern', 160, 19, { light: true });
  prop('torii', 177, 17);
  for (const c of [186, 198, 210, 222, 234]) prop('stonelantern', c, 17, { light: true });
  return b.build();
}
