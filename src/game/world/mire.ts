import { Builder, type LevelData } from './builder';

/**
 * "The Rotting Mire" – a drowned cave beneath the Sunken Catacombs, through a door that stays sealed
 * until the Bone Shepherd falls.
 * Entry + bonfire → the first pools (leeches hide in the water) → a bridge of rotten planks over a
 * spike pit → the long mire under one-way planks → the sunken hut (bonfire) → the Mire Mother's pool.
 *
 * Mire water (b.bog) is one tile deep: you wade through it slowly while poison builds up.
 * Rotten planks (b.crumble) give way a moment after you land on them and grow back later.
 */
export function buildMire(): LevelData {
  const b = new Builder(220, 32, 'mire', 'The Rotting Mire', 'mire');

  // bounds
  b.fill(0, 0, 1, 31);
  b.fill(218, 0, 219, 31);

  // --- A: the way in
  b.ground(0, 22, 20);
  b.data.spawn = b.at(6, 20);
  b.door({ id: 'mire-entry', to: 'catacombs', entry: 'mire-door' }, 4, 20);
  b.data.bonfires.push({ id: 'mire', ...b.at(10, 20) });
  b.item('mire-herb', 'ember_herb', 17, 20, 2);

  // --- B: the first pools, a hummock in the middle
  b.bog(23, 40, 20);
  b.ground(30, 32, 18);
  b.enemy('leech', 26, 21);
  b.enemy('leech', 37, 21);
  b.ground(41, 58, 20);
  b.enemy('carrier', 51, 20);

  // --- C: rotten planks over a spike pit
  b.pit(59, 72, 28);
  b.crumble(59, 20, 4);
  b.crumble(64, 19, 4);
  b.crumble(69, 20, 4);
  b.ground(73, 90, 20);
  b.enemy('carrier', 80, 20);
  b.enemy('ghoul', 87, 20);
  b.item('mire-soul-a', 'soul_lost_knight', 89, 20);

  // --- D: the long mire – planks above it, if you can keep your footing
  b.bog(91, 120, 20);
  b.plat(93, 17, 4);
  b.plat(99, 15, 4);
  b.crumble(105, 15, 4);
  b.plat(111, 17, 4);
  b.item('mire-soul-b', 'soul_nameless', 100, 15);
  b.enemy('leech', 97, 21);
  b.enemy('leech', 106, 21);
  b.enemy('leech', 116, 21);

  // --- E: the sunken hut
  b.ground(121, 140, 20);
  b.data.bonfires.push({ id: 'sunken-hut', ...b.at(125, 20) });
  b.item('mire-shards', 'titanite', 133, 20, 2);
  b.enemy('carrier', 137, 20);

  // --- F: last pool, a step up to the Mother's grotto
  b.bog(141, 150, 20);
  b.enemy('leech', 146, 21);
  b.ground(151, 157, 18);
  b.item('mire-bread', 'bread', 154, 18, 2);

  // --- G: the Mire Mother's pool
  b.ground(158, 217, 20);
  b.fill(158, 18, 158, 19); // lip of the grotto (fog gate behind it)
  b.bog(171, 177, 20);
  b.bog(196, 213, 20);
  b.data.boss = {
    type: 'mother',
    ...b.at(205, 20),
    fogX: 160 * 16,
    flag: 'motherDefeated',
    banner: 'MOTHER FELLED',
    sub: 'The mire grows still',
  };
  // behind her pool: a way down into the sand-buried tombs, held shut while she lives
  b.door(
    {
      id: 'necropolis-door', to: 'necropolis', entry: 'necropolis-entry', requires: 'motherDefeated', sealed: true,
      lockedMsg: 'Dry sand trickles from the seal. The mire holds it shut.',
    },
    215,
    20,
  );

  // ceiling last so the pools don't clear it
  b.fill(0, 0, 219, 5);

  // --- props: rot-light mushrooms do most of the lighting down here
  const prop = b.prop.bind(b);
  prop('wall_torch', 2, 17, { light: true });
  prop('skull', 7, 20);
  prop('glow_mushroom', 14, 20, { light: true });
  prop('barrel', 20, 20);
  prop('glow_mushroom', 31, 18, { light: true });
  prop('chain', 35, 6, { hang: true });
  prop('bone', 44, 20);
  prop('glow_mushroom', 48, 20, { light: true });
  prop('crate', 56, 20);
  prop('chain', 66, 6, { hang: true });
  prop('glow_mushroom', 75, 20, { light: true });
  prop('tombstone_cracked', 83, 20);
  prop('glow_mushroom', 90, 20, { light: true });
  prop('lantern', 101, 6, { hang: true, light: true });
  prop('glow_mushroom', 113, 17, { light: true });
  prop('candle', 123, 20, { light: true });
  prop('coffin', 130, 20);
  prop('lantern', 128, 6, { hang: true, light: true });
  prop('glow_mushroom', 139, 20, { light: true });
  prop('skull', 152, 18);
  prop('glow_mushroom', 156, 18, { light: true });
  prop('glow_mushroom', 166, 20, { light: true });
  prop('bone', 181, 20);
  prop('glow_mushroom', 186, 20, { light: true });
  prop('chain', 190, 6, { hang: true });
  prop('skull', 193, 20);
  prop('glow_mushroom', 215, 20, { light: true });
  return b.build();
}
