import { Builder, type LevelData } from './builder';

/** "The Ossuary" – the Bone Shepherd's arena, below the low crypt of the catacombs. */
export function buildOssuary(): LevelData {
  const b = new Builder(60, 30, 'ossuary', 'The Ossuary', 'crypt');
  b.fill(0, 0, 1, 29);
  b.fill(58, 0, 59, 29);
  b.ground(0, 59, 22);
  b.data.spawn = b.at(5, 22);
  b.door({ id: 'ossuary-entry', to: 'catacombs', entry: 'ossuary-door' }, 4, 22);
  // the way down: sealed until the Shepherd falls
  b.door(
    {
      id: 'depths-door', to: 'depths', entry: 'depths-entry', requires: 'shepherdDefeated', sealed: true,
      lockedMsg: 'Heat seeps through the seal. The choir of bones holds it shut.',
    },
    54,
    22,
  );
  b.data.boss = {
    type: 'shepherd',
    ...b.at(44, 22),
    fogX: 11 * 16,
    flag: 'shepherdDefeated',
    banner: 'SHEPHERD FELLED',
    sub: 'The choir of bones falls silent',
  };
  // tall vault: room for the bone rain
  b.fill(0, 0, 59, 6);

  const prop = b.prop.bind(b);
  b.item('ossuary-venom', 'venom_longsword', 9, 22);
  prop('candle', 7, 22, { light: true });
  prop('gargoyle', 13, 22);
  prop('chain', 18, 7, { hang: true });
  prop('coffin', 22, 22);
  prop('lantern', 27, 22, { light: true });
  prop('chain', 31, 7, { hang: true });
  prop('skull', 35, 22);
  prop('chain', 40, 7, { hang: true });
  prop('lantern', 48, 22, { light: true });
  prop('coffin', 50, 22);
  prop('gargoyle', 57, 22);
  return b.build();
}
