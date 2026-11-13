import { Builder, type LevelData } from './builder';

/**
 * "The Ashen Throne" – the keep at the end of the Ash Road. The hall of knights → the antechamber
 * (bonfire) → a door sealed by every great soul still living → the throne room of the Ashen King.
 * The throne room is walled off: the sealed door is the only way in.
 */
export function buildThrone(): LevelData {
  const b = new Builder(140, 30, 'throne', 'The Ashen Throne', 'keep');

  // bounds
  b.fill(0, 0, 1, 29);
  b.fill(138, 0, 139, 29);

  // --- A: the gate
  b.ground(0, 30, 22);
  b.data.spawn = b.at(8, 22);
  b.door({ id: 'throne-entry', to: 'ashroad', entry: 'throne-door' }, 4, 22);
  b.data.bonfires.push({ id: 'keep', ...b.at(10, 22) });

  // --- B: the hall of knights
  b.ground(31, 80, 22);
  b.fill(48, 18, 56, 18); // a gallery
  b.enemy('knight', 40, 22);
  b.enemy('archer', 52, 18);
  b.enemy('knight', 60, 22);
  b.enemy('legionary', 68, 22);
  b.enemy('monk', 76, 22);
  b.item('hall-soul', 'soul_nameless', 55, 18);

  // --- C: the antechamber and the sealed door
  b.ground(81, 95, 22);
  b.data.bonfires.push({ id: 'antechamber', ...b.at(85, 22) });
  b.door(
    {
      id: 'king-door', to: 'throne', entry: 'king-hall', requires: 'allBosses', sealed: true,
      lockedMsg: 'Sealed by the great souls that still live.',
    },
    93,
    22,
  );
  b.fill(96, 0, 97, 29); // the throne room's wall

  // --- D: the throne room
  b.ground(98, 137, 22);
  b.door({ id: 'king-hall', to: 'throne', entry: 'king-door' }, 100, 22);
  b.data.boss = {
    type: 'king',
    ...b.at(126, 22),
    fogX: 103 * 16,
    flag: 'kingDefeated',
    banner: 'THE ASHEN KING FALLS',
    sub: 'The ash settles. Thank you for playing.',
  };

  // the roof of the keep
  b.fill(0, 0, 137, 11);

  // --- props
  const prop = b.prop.bind(b);
  prop('wall_torch', 2, 19, { light: true });
  prop('banner', 14, 12, { hang: true });
  prop('pillar', 20, 22);
  prop('wall_torch', 28, 19, { light: true });
  prop('banner', 36, 12, { hang: true });
  prop('pillar', 45, 22);
  prop('chain', 52, 12, { hang: true });
  prop('pillar', 63, 22);
  prop('banner', 70, 12, { hang: true });
  prop('wall_torch', 79, 19, { light: true });
  prop('candle', 88, 22, { light: true });
  prop('gargoyle', 91, 22);
  prop('torch', 106, 22, { light: true });
  prop('banner', 112, 12, { hang: true });
  prop('torch', 118, 22, { light: true });
  prop('banner', 124, 12, { hang: true });
  prop('torch', 130, 22, { light: true });
  prop('gargoyle', 136, 22);
  return b.build();
}
