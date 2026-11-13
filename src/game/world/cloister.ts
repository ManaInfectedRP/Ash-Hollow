import { Builder, type LevelData } from './builder';

/**
 * "The Frostbound Cloister" – a monastery high in the peaks, through a rimed door in the Hollow that only
 * yields once the Molten Colossus has fallen.
 * Gatehouse + bonfire (icicles overhead) → the frozen stair (ice, a spike gap, wraiths) → the bell tower
 * climb (planks + a lift, the Frostbound Mantle on a hidden shelf) → the iced rampart under a roof of
 * icicles → steps down to the belfry bonfire → the Frost Matriarch's hall.
 *
 * Jump budget (see Player): ~3.5 tiles high, ~4 tiles across walking, ~6 sprinting. Ice (b.ice) is
 * slippery: you build speed slowly and slide on.
 */
export function buildCloister(): LevelData {
  const b = new Builder(230, 34, 'cloister', 'Frostbound Cloister', 'frost');

  // bounds
  b.fill(0, 0, 1, 33);
  b.fill(228, 0, 229, 33);

  // --- A: gatehouse (roofed – mind the icicles)
  b.ground(0, 30, 24);
  b.data.spawn = b.at(6, 24);
  b.door({ id: 'cloister-entry', to: 'hollow', entry: 'cloister-door' }, 4, 24);
  b.data.bonfires.push({ id: 'cloister', ...b.at(10, 24) });
  b.fill(0, 0, 30, 14);
  b.icicle(18, 15);
  b.icicle(23, 15);
  b.icicle(27, 15);
  b.enemy('monk', 26, 24);
  b.item('cloister-herb', 'ember_herb', 14, 24, 2);

  // --- B: the frozen stair, out in the open
  b.ground(31, 40, 22);
  b.ice(31, 40, 22);
  b.ground(41, 53, 20);
  b.ice(41, 53, 20);
  b.enemy('wraith', 47, 20);
  b.pit(54, 57, 30);
  b.ground(58, 76, 19);
  b.ice(58, 66, 19);
  b.enemy('wraith', 63, 19);
  b.enemy('monk', 72, 19);
  b.item('cloister-soul', 'soul_nameless', 75, 19);

  // --- C: the bell tower – planks up the left, a lift on the right, the mantle on a shelf up top
  b.ground(77, 100, 19);
  b.fill(77, 0, 100, 3); // tower roof
  b.fill(77, 4, 77, 15); // left wall (doorway below)
  b.fill(100, 8, 100, 18); // right wall (opening at the top onto the rampart)
  b.plat(80, 16, 4);
  b.plat(85, 13, 4);
  b.plat(80, 10, 4);
  b.plat(79, 7, 5);
  b.item('cloister-mantle', 'frostbound_mantle', 80, 7);
  b.plat(86, 7, 4);
  b.mover(94, 19, 3, 0, -12, 7); // lift: flush with the floor (row 19) → row 7
  b.enemy('wraith', 90, 19);

  // --- D: the rampart: iced walkway along the wall top, a roofed stretch hung with icicles
  b.ground(99, 150, 7);
  b.ice(99, 150, 7);
  b.fill(110, 0, 132, 2);
  b.icicle(113, 3);
  b.icicle(118, 3);
  b.icicle(123, 3);
  b.icicle(128, 3);
  b.enemy('monk', 120, 7);
  b.enemy('wraith', 138, 7);
  b.enemy('monk', 146, 7);
  b.item('rampart-shards', 'titanite', 131, 7, 2);

  // --- E: steps down into the courtyard + the belfry bonfire
  b.ground(151, 154, 10);
  b.ground(155, 158, 13);
  b.ground(159, 162, 16);
  b.ground(163, 166, 19);
  b.ground(167, 186, 22);
  b.fill(166, 0, 229, 5); // the hall's roof
  b.data.bonfires.push({ id: 'belfry', ...b.at(170, 22) });
  b.item('belfry-soul', 'soul_lost_knight', 177, 22);
  b.item('belfry-bread', 'bread', 182, 22, 2);
  b.enemy('wraith', 180, 22);

  // --- F: the Matriarch's hall
  b.ground(187, 227, 22);
  b.data.boss = {
    type: 'matriarch',
    ...b.at(214, 22),
    fogX: 188 * 16,
    flag: 'matriarchDefeated',
    banner: 'MATRIARCH FELLED',
    sub: 'The cloister bells fall still',
  };

  // --- props
  const prop = b.prop.bind(b);
  prop('wall_torch', 2, 21, { light: true });
  prop('banner', 8, 15, { hang: true });
  prop('candle', 12, 24, { light: true });
  prop('pillar', 20, 24);
  prop('gargoyle', 30, 24);
  prop('tombstone', 36, 22);
  prop('lantern', 44, 20, { light: true });
  prop('tombstone_cracked', 50, 20);
  prop('skull', 60, 19);
  prop('lantern', 70, 19, { light: true });
  prop('gargoyle', 76, 19);
  prop('chain', 83, 4, { hang: true });
  prop('lantern', 88, 4, { hang: true, light: true });
  prop('chain', 96, 4, { hang: true });
  prop('candle', 82, 19, { light: true });
  prop('banner', 104, 4, { hang: true });
  prop('lantern', 115, 7, { light: true });
  prop('lantern', 126, 7, { light: true });
  prop('gargoyle', 140, 7);
  prop('tombstone', 157, 13);
  prop('wall_torch', 168, 19, { light: true });
  prop('candle', 174, 22, { light: true });
  prop('banner', 184, 6, { hang: true });
  prop('torch', 194, 22, { light: true });
  prop('chain', 199, 6, { hang: true });
  prop('torch', 206, 22, { light: true });
  prop('chain', 212, 6, { hang: true });
  prop('torch', 220, 22, { light: true });
  prop('gargoyle', 226, 22);
  return b.build();
}
