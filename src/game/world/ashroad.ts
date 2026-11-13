import { Builder, type LevelData } from './builder';

/**
 * "The Ash Road" – the road back toward the Hollow, through a city that burned. Ash falls without end;
 * cracks in the street still glow with lava; the foes of the whole journey come back as ash.
 * The way in (bonfire) → the burnt street → over the collapsed rooftops → the market square (bonfire)
 * → across the lava river on old pillars → up the ash wall to the gate of the Ashen Throne.
 *
 * Jump budget (see Player): ~3.5 tiles high, ~4 tiles across walking, ~6 sprinting. Lava cracks are two
 * tiles wide: jump them.
 */
export function buildAshRoad(): LevelData {
  const b = new Builder(230, 32, 'ashroad', 'The Ash Road', 'ash');

  // bounds
  b.fill(0, 0, 1, 31);
  b.fill(228, 0, 229, 31);

  // --- A: the way in
  b.ground(0, 24, 23);
  b.data.spawn = b.at(8, 23);
  b.door({ id: 'ashroad-entry', to: 'shrine', entry: 'ash-gate' }, 4, 23);
  b.data.bonfires.push({ id: 'ashroad', ...b.at(11, 23) });
  b.item('ash-herb', 'ember_herb', 19, 23, 2);

  // --- B: the burnt street
  b.ground(25, 60, 23);
  b.lava(31, 32, 23);
  b.lava(51, 52, 23); // clear of where you land stepping off the beam
  b.plat(41, 20, 5); // a fallen beam: jump up through it
  b.enemy('hollow', 28, 23);
  b.enemy('hollow', 38, 23);
  b.enemy('archer', 43, 20);
  b.enemy('knight', 58, 23); // well clear of the crack: a knock-back shouldn't throw you into lava
  b.item('street-soul', 'soul_lost_knight', 44, 20);

  // --- C: over the collapsed rooftops, down into the market
  b.ground(61, 66, 21);
  b.ground(67, 74, 19);
  b.plat(76, 17, 4);
  b.fill(82, 16, 96, 18);
  b.ground(75, 96, 26); // the sunken alley under the roofs: a miss costs a detour, not a life
  b.enemy('legionary', 89, 16);
  b.enemy('wraith', 94, 16);
  b.item('roof-shards', 'titanite', 95, 16, 2);
  b.ground(97, 130, 23);
  b.data.bonfires.push({ id: 'ash-market', ...b.at(102, 23) });
  b.lava(112, 113, 23);
  b.enemy('knight', 118, 23);
  b.enemy('legionary', 124, 23);
  b.enemy('ghoul', 128, 23);
  b.item('market-flask', 'flask_shard', 107, 23);

  // --- D: the lava river and its old pillars
  b.lava(131, 150, 28);
  b.pillar(133, 135, 24);
  b.pillar(138, 140, 23);
  b.pillar(143, 145, 24);
  b.pillar(148, 150, 23);
  b.ground(151, 175, 23);
  b.enemy('hollow', 157, 23);
  b.enemy('archer', 166, 23);
  b.enemy('monk', 171, 23);
  b.item('river-soul', 'soul_nameless', 174, 23);

  // --- E: up the ash wall to the gate
  b.ground(176, 180, 21);
  b.ground(181, 185, 19);
  b.ground(186, 227, 19);
  b.enemy('knight', 195, 19);
  b.enemy('legionary', 205, 19);
  b.enemy('wraith', 212, 19);
  b.door({ id: 'throne-door', to: 'throne', entry: 'throne-entry' }, 224, 19);

  // --- props: what's left of the city
  const prop = b.prop.bind(b);
  prop('tombstone_cracked', 15, 23);
  prop('torch', 22, 23, { light: true });
  prop('skull', 35, 23);
  prop('pillar', 51, 23);
  prop('banner', 58, 16, { hang: true });
  prop('barrel', 64, 21);
  prop('torch', 72, 19, { light: true });
  prop('crate', 86, 16);
  prop('torch', 99, 23, { light: true });
  prop('gargoyle', 110, 23);
  prop('bone', 121, 23);
  prop('torch', 129, 23, { light: true });
  prop('skull', 155, 23);
  prop('pillar', 162, 23);
  prop('torch', 175, 23, { light: true });
  prop('tombstone', 190, 19);
  prop('torch', 200, 19, { light: true });
  prop('gargoyle', 218, 19);
  prop('torch', 222, 19, { light: true });
  return b.build();
}
