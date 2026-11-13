import { Builder, type LevelData } from './builder';

/**
 * "Sunken Catacombs" – reached through the Warden's arena.
 * West door → bonfire + Ser Corvin → ghoul corridor → archer ledge → spike pit →
 * ossuary hall with an archer balcony → low crypt (knight) → east door = shortcut to the Ruined Gate.
 */
export function buildCatacombs(): LevelData {
  const b = new Builder(150, 30, 'catacombs', 'Sunken Catacombs', 'crypt');

  // bounds
  b.fill(0, 0, 1, 29);
  b.fill(148, 0, 149, 29);

  // --- entrance hall
  b.ground(0, 35, 22);
  b.data.spawn = b.at(6, 22);
  b.door({ id: 'west-door', to: 'hollow', entry: 'arena-door' }, 4, 22);
  b.data.bonfires.push({ id: 'catacombs', ...b.at(11, 22) });
  b.data.npcs.push({ id: 'corvin', ...b.at(18, 22) });
  b.enemy('ghoul', 29, 22);

  // --- archer ledge + spike pit
  b.ground(36, 47, 19);
  b.enemy('archer', 44, 19);
  b.item('ledge-frost-short', 'frost_shortsword', 46, 19);
  b.pit(48, 51, 28, 9);
  b.ground(52, 82, 21);
  // down to the Rotting Mire: held shut by the Shepherd's choir
  b.door(
    {
      id: 'mire-door', to: 'mire', entry: 'mire-entry', requires: 'shepherdDefeated', sealed: true,
      lockedMsg: 'Rot seeps through the seal. The choir of bones holds back the mire.',
    },
    61,
    21,
  );
  b.enemy('ghoul', 58, 21);
  b.enemy('ghoul', 66, 21);
  b.enemy('hollow', 76, 21);

  // --- ossuary balcony (one-way steps up), archers above the hall
  b.plat(70, 18, 3);
  b.plat(74, 15, 3);
  b.fill(78, 14, 92, 14);
  b.enemy('archer', 84, 14);
  b.enemy('archer', 90, 14);
  b.item('balcony-shards', 'titanite', 91, 14, 2);
  b.item('balcony-venom', 'venom_rapier', 80, 14);
  b.ground(83, 100, 21);
  b.enemy('hollow', 95, 21);

  // --- low crypt (+ second bonfire and the way down to the Ossuary)
  b.ground(101, 132, 23);
  b.data.bonfires.push({ id: 'crypt', ...b.at(103, 23) });
  b.door({ id: 'ossuary-door', to: 'ossuary', entry: 'ossuary-entry' }, 112, 23);
  b.enemy('ghoul', 107, 23);
  b.enemy('knight', 117, 23);
  b.enemy('ghoul', 125, 23);
  b.item('crypt-soul', 'soul_nameless', 128, 23);
  b.item('crypt-shard', 'flask_shard', 130, 23);
  b.item('crypt-kite', 'kite_shield', 121, 23);
  b.item('crypt-frost-axe', 'frost_greataxe', 126, 23);

  // --- exit to the surface (shortcut)
  b.ground(133, 147, 21);
  b.enemy('archer', 139, 21);
  b.door({ id: 'east-door', to: 'hollow', entry: 'gate-door', sets: 'shortcut' }, 144, 21);

  // ceilings last so they are not cleared by the pit
  b.fill(0, 0, 147, 8);
  b.fill(101, 0, 132, 14);

  // --- props
  const prop = b.prop.bind(b);
  prop('chain', 6, 9, { hang: true });
  prop('coffin', 8, 22);
  prop('candle', 14, 22, { light: true });
  prop('skull', 21, 22);
  prop('chain', 26, 9, { hang: true });
  prop('banner', 31, 9, { hang: true });
  prop('lantern', 40, 19, { light: true });
  prop('bone', 55, 21);
  prop('candle', 62, 21, { light: true });
  prop('coffin', 64, 21);
  prop('skull', 72, 21);
  prop('chain', 80, 9, { hang: true });
  prop('candle', 86, 14, { light: true });
  prop('glow_mushroom', 98, 21, { light: true });
  prop('gargoyle', 104, 23);
  prop('chain', 112, 15, { hang: true });
  prop('coffin', 120, 23);
  prop('candle', 122, 23, { light: true });
  prop('bone', 127, 23);
  prop('tombstone_cracked', 136, 21);
  prop('wall_torch', 141, 18, { hang: true, light: true });

  return b.build();
}
