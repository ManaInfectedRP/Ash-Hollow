import { Builder, type LevelData } from './builder';

/**
 * "The Buried Necropolis" – sandstone catacombs under the desert, through a door behind the Mire
 * Mother's pool. Dark, tight corridors and jump puzzles over spike pits; mummies lie among the dead.
 * Entry + bonfire → low corridor → the first spike hall (stepping stones) → the lower crypt →
 * the ferry hall (a moving slab) → the sunken shrine (bonfire) → the Sphinx's hall → (after) the way up
 * to the Khepri Wastes.
 *
 * Jump budget (see Player): ~3.5 tiles high, ~4 tiles across walking, ~6 sprinting.
 */
export function buildNecropolis(): LevelData {
  const b = new Builder(184, 34, 'necropolis', 'The Buried Necropolis', 'tomb');

  // bounds
  b.fill(0, 0, 1, 33);
  b.fill(182, 0, 183, 33);

  // --- A: the way in, a low corridor
  b.ground(0, 40, 24);
  b.data.spawn = b.at(6, 24);
  b.door({ id: 'necropolis-entry', to: 'mire', entry: 'necropolis-door' }, 4, 24);
  b.data.bonfires.push({ id: 'necropolis', ...b.at(10, 24) });
  b.fill(0, 0, 40, 19); // a 4-tile-high corridor
  b.enemy('mummy', 24, 24);
  b.enemy('ghoul', 34, 24);
  b.item('necro-herb', 'ember_herb', 16, 24, 2);

  // --- B: the first spike hall – stepping stones over the pit
  b.pit(41, 66, 32);
  b.fill(41, 0, 66, 13);
  // gaps of 3, never more than one tile up: a walking jump clears them with room to spare
  b.fill(43, 23, 45, 23);
  b.fill(49, 22, 51, 22);
  b.fill(55, 23, 57, 23);
  b.fill(61, 22, 63, 22);
  b.item('necro-soul-a', 'soul_lost_knight', 62, 22);

  // --- C: the lower crypt
  b.ground(67, 95, 24);
  b.fill(67, 0, 95, 18);
  b.enemy('mummy', 74, 24);
  b.enemy('ghoul', 82, 24);
  b.enemy('mummy', 90, 24);
  b.item('necro-soul-b', 'soul_nameless', 93, 24);

  // --- D: the ferry hall – a slab sliding over spikes, then stones up to the shrine
  b.pit(96, 120, 32);
  b.fill(96, 0, 120, 14);
  b.mover(97, 24, 3, 8, 0, 5.5); // ferry 97 → 105: hop on from the crypt floor
  b.fill(109, 23, 111, 23);
  b.fill(114, 21, 116, 21);
  b.item('necro-shards', 'titanite', 115, 21, 2);

  // --- E: the sunken shrine (bonfire) and the corridor to the hall
  b.ground(121, 150, 24);
  b.fill(121, 0, 150, 19);
  b.data.bonfires.push({ id: 'sunken-shrine', ...b.at(125, 24) });
  b.enemy('mummy', 136, 24);
  b.enemy('ghoul', 144, 24);
  b.item('shrine-bread', 'bread', 130, 24, 2);

  // --- F: the Sphinx's hall – tall and wide
  b.ground(151, 181, 24);
  b.pave(151, 181, 24);
  b.fill(151, 0, 181, 8);
  b.data.boss = {
    type: 'sphinx',
    ...b.at(170, 24),
    fogX: 152 * 16,
    flag: 'sphinxDefeated',
    banner: 'SPHINX FELLED',
    sub: 'The green light in her eyes goes out',
  };
  // the way up to the surface, sealed until she falls
  b.door(
    {
      id: 'wastes-door', to: 'wastes', entry: 'wastes-entry', requires: 'sphinxDefeated', sealed: true,
      lockedMsg: 'Sunlight leaks around the seal. The Sphinx guards the way up.',
    },
    179,
    24,
  );

  // --- props: torches carry the light down here
  const prop = b.prop.bind(b);
  prop('wall_torch', 2, 22, { light: true });
  prop('urn', 8, 24);
  prop('bone', 13, 24);
  prop('wall_torch', 20, 22, { light: true });
  prop('skull', 28, 24);
  prop('wall_torch', 36, 22, { light: true });
  prop('urn', 39, 24);
  prop('chain', 46, 14, { hang: true });
  prop('lantern', 53, 14, { hang: true, light: true });
  prop('chain', 61, 14, { hang: true });
  prop('wall_torch', 68, 21, { light: true });
  prop('coffin', 71, 24);
  prop('urn', 78, 24);
  prop('bone', 86, 24);
  prop('wall_torch', 88, 21, { light: true });
  prop('skull', 94, 24);
  prop('lantern', 102, 15, { hang: true, light: true });
  prop('lantern', 113, 15, { hang: true, light: true });
  prop('wall_torch', 122, 22, { light: true });
  prop('urn', 128, 24);
  prop('coffin', 133, 24);
  prop('wall_torch', 140, 22, { light: true });
  prop('bone', 147, 24);
  prop('torch', 156, 24, { light: true });
  prop('pillar', 160, 24);
  prop('torch', 166, 24, { light: true });
  prop('torch', 176, 24, { light: true });
  prop('pillar', 180, 24);
  return b.build();
}
