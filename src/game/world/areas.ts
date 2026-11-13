import type { LevelData } from './builder';
import { buildLevel1 } from './level1';
import { buildCatacombs } from './catacombs';
import { buildOssuary } from './ossuary';
import { buildDepths } from './depths';
import { buildCloister } from './cloister';
import { buildMire } from './mire';
import { buildNecropolis } from './necropolis';
import { buildWastes } from './wastes';
import { buildSky } from './sky';
import { buildShrine } from './shrine';
import { buildAshRoad } from './ashroad';
import { buildThrone } from './throne';

/** Every area of the interconnected world, by id. Doors reference these ids. */
export const AREAS: Record<string, () => LevelData> = {
  hollow: buildLevel1,
  catacombs: buildCatacombs,
  ossuary: buildOssuary,
  depths: buildDepths,
  cloister: buildCloister,
  mire: buildMire,
  necropolis: buildNecropolis,
  wastes: buildWastes,
  sky: buildSky,
  shrine: buildShrine,
  ashroad: buildAshRoad,
  throne: buildThrone,
};

export const START_AREA = 'hollow';
