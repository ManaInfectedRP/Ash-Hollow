import { Builder, type LevelData } from './builder';

/**
 * "The Molten Depths" – below the Ossuary, opened by felling the Bone Shepherd.
 * Entry hall + bonfire → stone pillars and a ferry slab over a lava lake → rest island →
 * a lift up to a high shelf → planks and a second ferry → the forge gate (bonfire) →
 * the Molten Colossus' arena.
 *
 * Jump budget (see Player): ~3.5 tiles high, ~4 tiles across walking, ~6 sprinting.
 * Lava surface is row 30; anything that falls in dies.
 */
export function buildDepths(): LevelData {
  const b = new Builder(200, 34, 'depths', 'The Molten Depths', 'lava');

  // bounds
  b.fill(0, 0, 1, 33);
  b.fill(198, 0, 199, 33);

  // --- entry hall
  b.ground(0, 22, 24);
  b.data.spawn = b.at(6, 24);
  b.door({ id: 'depths-entry', to: 'ossuary', entry: 'depths-door' }, 4, 24);
  b.data.bonfires.push({ id: 'depths', ...b.at(10, 24) });
  b.enemy('slime', 20, 24);
  b.item('depths-obsidian', 'obsidian_shield', 15, 24);

  // --- the first lava lake: pillars and a ferry
  b.lava(23, 59, 30);
  b.pillar(26, 28, 24);
  b.pillar(32, 33, 23);
  b.mover(35, 23, 3, 9, 0, 5.2); // ferry 35 → 44
  b.pillar(48, 52, 23);
  b.enemy('slime', 51, 23);
  b.item('depths-robes', 'ember_robes', 49, 23);
  b.pillar(56, 57, 21);
  b.item('depths-herb', 'ember_herb', 56, 21, 2);

  // --- rest island
  b.ground(60, 80, 20);
  b.enemy('ghoul', 66, 20);
  b.enemy('ghoul', 74, 20);
  b.item('depths-soul', 'soul_lost_knight', 78, 20);
  b.item('depths-flame-axe', 'flame_greataxe', 71, 20);

  // --- second lake: a lift up to the high shelf, planks, another ferry
  b.lava(81, 125, 30);
  b.mover(81, 20, 3, 0, -9, 6.5); // lift: row 20 → row 11
  b.fill(85, 11, 100, 13);
  b.enemy('slime', 91, 11);
  b.enemy('ghoul', 97, 11);
  b.item('depths-shards', 'titanite', 99, 11, 2);
  b.item('depths-frost-long', 'frost_longsword', 94, 11);
  b.plat(103, 12, 3);
  b.plat(108, 12, 3);
  b.mover(113, 12, 3, 8, 0, 5, 0.25); // ferry 113 → 121

  // --- the forge gate + the Colossus' arena (solid floor: the lava wave needs ground to roll on)
  b.ground(126, 199, 18);
  b.data.bonfires.push({ id: 'forge', ...b.at(130, 18) });
  b.item('forge-flame-long', 'flame_longsword', 135, 18);
  b.enemy('ghoul', 139, 18);
  b.enemy('slime', 145, 18);
  b.data.boss = {
    type: 'colossus',
    ...b.at(182, 18),
    fogX: 152 * 16,
    flag: 'colossusDefeated',
    banner: 'COLOSSUS FELLED',
    sub: 'The forge-heart cools to stone',
  };
  // behind the Colossus: with the forge-heart cold, the old stair climbs straight up to the Frostbound Cloister
  // (the same door the Hollow's rimed gate leads to – no walking back through the lakes)
  b.door(
    {
      id: 'forge-stair', to: 'cloister', entry: 'cloister-entry', requires: 'colossusDefeated', sealed: true,
      lockedMsg: 'Heat pours from the stair beyond. Nothing passes while the forge-heart burns.',
    },
    194,
    18,
  );

  // ceiling last so the lakes don't clear it
  b.fill(0, 0, 199, 4);

  // --- props
  const prop = b.prop.bind(b);
  prop('skull', 7, 24);
  prop('wall_torch', 2, 20, { light: true });
  prop('bone', 15, 24);
  prop('chain', 30, 5, { hang: true });
  prop('skull', 63, 20);
  prop('wall_torch', 70, 16, { light: true });
  prop('bone', 88, 11);
  prop('chain', 105, 5, { hang: true });
  prop('skull', 133, 18);
  prop('wall_torch', 148, 14, { light: true });
  // arena: keep props on the middle of the floor – both ends sink into lava in phase 2
  prop('torch', 165, 18, { light: true });
  prop('chain', 170, 5, { hang: true });
  prop('torch', 175, 18, { light: true });
  prop('chain', 180, 5, { hang: true });
  prop('torch', 185, 18, { light: true });
  return b.build();
}
