import { Builder, type LevelData } from './builder';

/**
 * "The Hollow" – the first area of Ash & Hollow:
 * Ruined Gate → Spike Pits & upper ledge (secret) → Knight's Bridge → Bonfire 2 + merchant → Climb →
 * Warden's Arena → (door) Sunken Catacombs → (shortcut door) back to the Ruined Gate.
 */
export function buildLevel1(): LevelData {
  const b = new Builder(212, 30, 'hollow', 'The Hollow', 'outdoor');

  // world bounds
  b.fill(0, 0, 1, 29);
  b.fill(206, 0, 211, 29);

  // --- A: Ruined Gate
  b.ground(0, 40, 22);
  b.fill(16, 20, 19, 21); // rubble step
  b.fill(30, 21, 33, 21);
  b.data.spawn = b.at(6, 22);
  // shortcut from the catacombs – locked until opened from the other side
  b.door({ id: 'gate-door', to: 'catacombs', entry: 'east-door', requires: 'shortcut', lockedMsg: 'Locked. It opens from the other side.' }, 3, 22);
  b.data.bonfires.push({ id: 'gate', ...b.at(9, 22) });
  b.data.enemies.push({ type: 'hollow', ...b.at(25, 22) });
  b.data.enemies.push({ type: 'hollow', ...b.at(37, 22) });

  // --- B: spike pits + upper ledge
  b.pit(41, 43, 28);
  b.ground(44, 75, 22);
  b.plat(48, 19, 4);
  b.plat(53, 16, 4);
  b.plat(58, 13, 4);
  b.fill(62, 12, 72, 13); // upper ledge
  b.data.items.push({ id: 'ledge-rapier', item: 'rapier', qty: 1, ...b.at(71, 12) });
  b.data.items.push({ id: 'ledge-shards', item: 'titanite', qty: 2, ...b.at(64, 12) });
  b.data.items.push({ id: 'gate-herbs', item: 'ember_herb', qty: 2, ...b.at(34, 22) });
  b.data.enemies.push({ type: 'hollow', ...b.at(67, 12) });
  b.data.enemies.push({ type: 'hollow', ...b.at(56, 22) });
  b.data.enemies.push({ type: 'hollow', ...b.at(66, 22) });
  b.pit(76, 79, 28);

  // --- C: Knight's Bridge
  b.ground(80, 95, 23);
  b.pit(96, 109, 28);
  b.plat(96, 23, 14);
  b.data.enemies.push({ type: 'knight', ...b.at(103, 23) });
  b.ground(110, 131, 23);
  b.data.bonfires.push({ id: 'bridge', ...b.at(116, 23) });
  b.data.items.push({ id: 'bridge-bread', item: 'bread', qty: 3, ...b.at(84, 23) });
  b.data.items.push({ id: 'bridge-axe', item: 'greataxe', qty: 1, ...b.at(126, 23) });
  b.data.items.push({ id: 'bridge-longsword', item: 'longsword', qty: 1, ...b.at(88, 23) });
  b.data.items.push({ id: 'bridge-soul', item: 'soul_lost_knight', qty: 1, ...b.at(92, 23) });

  // --- D: the Climb
  b.ground(132, 135, 21);
  b.ground(136, 139, 19);
  b.ground(140, 165, 17);
  b.plat(146, 14, 4);
  b.plat(151, 11, 3);
  b.data.items.push({ id: 'climb-armor', item: 'knight_armor', qty: 1, ...b.at(152, 11) });
  b.data.items.push({ id: 'climb-soul', item: 'soul_nameless', qty: 1, ...b.at(147, 14) });
  b.data.items.push({ id: 'climb-flame-short', item: 'flame_shortsword', qty: 1, ...b.at(162, 17) });
  b.data.enemies.push({ type: 'hollow', ...b.at(144, 17) });
  b.data.enemies.push({ type: 'knight', ...b.at(158, 17) });

  // --- E: Warden's Arena
  b.ground(166, 205, 17);
  b.data.boss = { type: 'warden', ...b.at(194, 17), fogX: 168 * 16, flag: 'bossDefeated', banner: 'WARDEN FELLED', sub: 'The ash settles over the hollow' };
  b.door({ id: 'arena-door', to: 'catacombs', entry: 'west-door', requires: 'bossDefeated', sealed: true, lockedMsg: "Sealed by the Warden's power." }, 201, 17);
  b.data.npcs.push({ id: 'hessa', ...b.at(119, 23) });
  // up to the Frostbound Cloister: rimed shut until the forge-heart below has gone cold
  b.door(
    {
      id: 'cloister-door', to: 'cloister', entry: 'cloister-entry', requires: 'colossusDefeated', sealed: true,
      lockedMsg: 'Rime seals the door. It will not yield while the forge-heart below still burns.',
    },
    124,
    23,
  );
  // behind the Warden: his own plate, waiting for whoever fells him
  b.data.items.push({ id: 'arena-plate', item: 'warden_plate', qty: 1, ...b.at(199, 17) });

  // --- props (Pixel Art Atlas sprites)
  const prop = b.prop.bind(b);
  prop('banner', 2, 15, { hang: true });
  prop('wall_torch', 2, 19, { hang: true, light: true });
  prop('candle', 7, 22, { light: true });
  prop('tombstone', 13, 22);
  prop('tombstone_cracked', 21, 22);
  prop('skull', 23, 22);
  prop('bone', 28, 22);
  prop('pillar', 35, 22);
  prop('barrel', 46, 22);
  prop('crate', 47, 22);
  prop('glow_mushroom', 60, 22, { light: true });
  prop('bone', 70, 22);
  prop('chain', 64, 14, { hang: true });
  prop('chain', 69, 14, { hang: true });
  prop('coffin', 66, 12);
  prop('torch', 94, 23, { light: true });
  prop('torch', 111, 23, { light: true });
  prop('candle', 114, 23, { light: true });
  prop('crate', 121, 23);
  prop('barrel', 122, 23);
  prop('lantern', 129, 23, { light: true });
  prop('tombstone', 143, 17);
  prop('skull', 150, 17);
  prop('glow_mushroom', 163, 17, { light: true });
  prop('gargoyle', 166, 17);
  prop('torch', 176, 17, { light: true });
  prop('torch', 186, 17, { light: true });
  prop('torch', 198, 17, { light: true });
  prop('gargoyle', 204, 17);

  return b.build();
}
