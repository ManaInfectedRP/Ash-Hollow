// Hand-drawn parts. Letters are palette ROLES (see docs/SPRITES.md):
//   o outline | D M L H  armor dark/mid/light/highlight | k c C cloth dark/mid/light
//   z s S skin shadow/mid/light | h hair | x b B W blade dark/mid/light/shine
//   n N leather/wood dark/light | g G gold dark/light | v visor/void | e eye glow
//   r R accent dark/light | u U bone dark/light | f F ember dark/bright
// Every grid faces RIGHT. Pivot = attachment point ([x, y] inside the grid).
import { grid } from './lib/grid.mjs';

// ------------------------------------------------------------------ heads (pivot = neck, bottom centre)
export const HEADS = {
  knightHelm: grid(
    [
      '..RR...',
      '.Rr....',
      '.LLLM..',
      'LHHLMM.',
      'LHLLMMD',
      'LLvvvvv',
      'LLMMMMD',
      'LMMvMMD',
      '.MDDDD.',
    ],
    [3, 8],
  ),
  hood: grid(
    [
      '..kkc..',
      '.kccCc.',
      'kcCCCCc',
      'kcCkzsS',
      'kcckssv',
      'kckzsss',
      '.kkkzs.',
      '..kk...',
    ],
    [3, 7],
  ),
  /** ember robes: pointed cowl, face in shadow, two coal eyes */
  cowl: grid(
    [
      '...rR..',
      '..rRRr.',
      '.rRRRRr',
      'rRvvvvR',
      'rRvevev',
      'rRvvvvv',
      '.rRvvv.',
      '..rr...',
    ],
    [3, 7],
  ),
  /** warden plate: closed great helm with a visor slit and short horns */
  greatHelm: grid(
    [
      'U.....U',
      'uU...Uu',
      '.LLLLM.',
      'LHHLLMM',
      'LHvvvvv',
      'LLMgMMD',
      'LLMMMMD',
      '.MDDDD.',
    ],
    [3, 7],
  ),
  bare: grid(
    [
      '.hhhh..',
      'hhhhhs.',
      'hhssSSs',
      'hzsssvs',
      'hzsSsss',
      '.zssss.',
      '..zzs..',
    ],
    [3, 6],
  ),
  hollow: grid(
    [
      '.h.hh.',
      'hhhssh',
      'hssSSs',
      'zssses',
      'zsSsss',
      '.zzszs',
      '..zz..',
    ],
    [3, 6],
  ),
  bruteHelm: grid(
    [
      '..rRRRr..',
      '.DLLLLMD.',
      'DLHHLLMMD',
      'DLHLLMMMD',
      'DLLLvMvMD',
      'DLLLvMvMD',
      'DLLLvMvMD',
      'DMLLMMMMD',
      '.DMMMMMD.',
      '..DDDDD..',
    ],
    [4, 9],
  ),
  ghoul: grid(
    [
      '..ssss.',
      '.sSSSss',
      'sSSssez',
      'sSsssss',
      'zsszvvv',
      '.zsvSvS',
      '..zzzz.',
    ],
    [3, 6],
  ),
  skull: grid(
    [
      '.UUUU.',
      'UUUUUU',
      'UUUvvU',
      'uUUveU',
      'uUUUUU',
      '.uvUvU',
      '..uuu.',
    ],
    [3, 6],
  ),
  /** hooded skull with a crown of antler bone, glowing eye */
  shepherd: grid(
    [
      'U.........U',
      'uU..kkk..Uu',
      '.uUkcccckUu',
      '..kcCCCcck.',
      '.kcCCuUUck.',
      '.kcCuUUUUk.',
      '.kcuUvvUek.',
      '.kcuUUUUUk.',
      '.kcuuvUvUk.',
      '.kccuuuuck.',
      '..kccccck..',
      '...kkkkk...',
    ],
    [5, 11],
  ),
  /** molten golem: craggy rock, eyes and mouth glowing from inside */
  golem: grid(
    [
      '...DDMMDD...',
      '..DLLHHLMD..',
      '.DLHLLLLMMD.',
      '.DLLLLLMMMD.',
      'DLLFFLLFFMMD',
      'DLLeFLLeFMMD',
      'DMLLLLLLMMMD',
      'DMLfffffMMD.',
      '.DMfFFFfMD..',
      '..DDDDDDD...',
    ],
    [6, 9],
  ),
  wardenHelm: grid(
    [
      'uU..........Uu',
      '.uU........Uu.',
      '..uU......Uu..',
      '..uUDDDDDDUu..',
      '...DLLHHLLMD..',
      '..DLHHHLLMMMD.',
      '..DLHLLLLMMMD.',
      '..DLLLvvvvvvv.',
      '..DLLLvveveev.',
      '..DLLLMMMMMMD.',
      '..DMLLMgMgMMD.',
      '..DMMMMMMMMMD.',
      '...DMMMMMMMD..',
      '....DDDDDDD...',
    ],
    [7, 13],
  ),
};

// ------------------------------------------------------------------ shoulder plates (pivot = shoulder)
export const PAULDRONS = {
  small: grid(['.LH.', 'LHLM', 'DMMD'], [2, 1]),
  brute: grid(['..LHH.', '.LHHLM', 'LHLLMM', 'DMMMMD', '.D..D.'], [3, 1]),
  warden: grid(
    ['...gGGg..', '..LHHHLM.', '.LHHLLMMD', 'LHLLLMMMD', 'DMMMMMMMD', '.DgDgDgD.'],
    [4, 2],
  ),
};

// ------------------------------------------------------------------ weapons (pivot = grip)
/** Procedural sword: bevelled blade, crossguard, wrapped grip. Points right. */
export function makeSword({ len, width = 2, grip = 3, guard = 2, chipped = false, runes = false, seed = 1 }) {
  const rows = Math.max(width, guard * 2 + 1);
  const c = Math.floor(rows / 2);
  const W = 1 + grip + 1 + len;
  const g = Array.from({ length: rows }, () => Array(W).fill('.'));
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const top = c - Math.floor((width - 1) / 2);
  // pommel + grip
  g[c][0] = 'g';
  for (let x = 1; x <= grip; x++) {
    g[c][x] = x % 2 ? 'n' : 'N';
    if (width >= 4) g[c + 1][x] = x % 2 ? 'N' : 'n';
  }
  // guard
  for (let y = c - guard; y <= c + guard; y++) g[y][grip + 1] = y < c ? 'G' : 'g';
  // blade
  const ramp = width === 1 ? ['B'] : width === 2 ? ['B', 'b'] : width === 3 ? ['B', 'b', 'x'] : width === 4 ? ['B', 'W', 'b', 'x'] : ['B', 'b', 'W', 'b', 'x'];
  for (let i = 0; i < len; i++) {
    const x = grip + 2 + i;
    const fromTip = len - 1 - i;
    for (let k = 0; k < width; k++) {
      // taper the last few pixels into a point
      if (width >= 3 && fromTip < Math.ceil(width / 2) && Math.abs(k - (width - 1) / 2) > fromTip) continue;
      let l = ramp[k];
      if (chipped && (k === 0 || k === width - 1) && rnd() < 0.18) continue;
      if (runes && k === Math.floor(width / 2) && i > 3 && i < len - 4 && i % 3 === 0) l = rnd() < 0.5 ? 'f' : 'F';
      g[top + k][x] = l;
    }
  }
  g[c][W - 1] = 'W';
  return grid(
    g.map((r) => r.join('')),
    [Math.floor(grip / 2) + 1, c],
  );
}

/**
 * Procedural scythe: haft pointing right, bone blade hanging from the tip and curving back toward
 * the grip (inner edge lit). Pivot = grip.
 */
export function makeScythe({ haft, blade, depth, thick = 1, bladeW = 2 }) {
  const W = haft + 2;
  const H = thick + depth + bladeW + 1;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  for (let y = 0; y < thick; y++)
    for (let x = 0; x <= haft; x++) g[y][x] = x === 0 ? 'g' : (x + y) % 2 ? 'n' : 'N';
  for (let y = 0; y < thick; y++) g[y][haft + 1] = 'U';
  const steps = blade * 4;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const x = Math.round(haft - blade * s);
    const y = Math.round(thick + depth * Math.sin((s * Math.PI) / 2));
    const w = Math.max(1, Math.round((1 - s) * bladeW) + 1);
    for (let k = 0; k < w; k++) {
      const yy = y - k;
      if (yy < thick || yy >= H) continue;
      g[yy][x] = k === w - 1 ? 'U' : k === 0 ? 'x' : 'u';
    }
  }
  return grid(
    g.map((r) => r.join('')),
    [Math.floor(haft / 6), Math.floor(thick / 2)],
  );
}

export const WEAPONS = {
  longsword: makeSword({ len: 13, width: 2, grip: 3, guard: 2 }),
  rapier: grid(['.Gg..............', 'gnnGBBBBBBBBBBBBW', '.gg..............'], [2, 1]),
  greataxe: grid(
    [
      '..............xx..',
      '.............xbBx.',
      '............xbBBBx',
      'gnNnNnNnNnNnNnbbbn',
      '............xbbbbx',
      '.............xbbx.',
      '..............xx..',
    ],
    [2, 3],
  ),
  shortsword: makeSword({ len: 9, width: 2, grip: 2, guard: 2 }),
  dagger: makeSword({ len: 6, width: 2, grip: 2, guard: 1 }),
  rusty: makeSword({ len: 10, width: 2, grip: 2, guard: 1, chipped: true, seed: 7 }),
  knightSword: makeSword({ len: 18, width: 3, grip: 4, guard: 3 }),
  greatsword: makeSword({ len: 38, width: 5, grip: 7, guard: 5, runes: true, seed: 3 }),
  boneScythe: makeScythe({ haft: 18, blade: 9, depth: 6, thick: 1, bladeW: 2 }),
  shepherdScythe: makeScythe({ haft: 40, blade: 20, depth: 13, thick: 3, bladeW: 5 }),
};

/** Bow, string on the left, limb bulging forward; pivot = grip. */
export const BOW = grid(
  [
    'Nn.....',
    'U.N....',
    'U..N...',
    'U...N..',
    'U...gN.',
    'U...gN.',
    'U...N..',
    'U..N...',
    'U.N....',
    'Nn.....',
  ],
  [4, 5],
);

/** Merchant's walking staff with a hanging lantern; pivot = grip. */
export const STAFF = grid(
  ['.............GG.', 'nNnNnNnNnNnNnNfG', '.............FF.', '.............ff.'],
  [3, 1],
);

/** Shields seen face-on (held in the off hand). Pivot = grip. */
export const SHIELDS = {
  wooden_shield: grid(
    ['..nnn..', '.nNNNn.', 'nNNgNNn', 'nNgGgNn', 'nNNgNNn', 'nNNNNNn', '.nNNNn.', '..nnn..'],
    [3, 4],
  ),
  kite_shield: grid(
    ['DLLLLLD', 'DLHRHLD', 'DLRRRLD', 'DLHRHLD', 'DLLRLLD', '.DLRLD.', '.DLLLD.', '..DLD..', '..DLD..', '...D...'],
    [3, 4],
  ),
  /** small round steel buckler */
  buckler: grid(['.DLD.', 'DLHLD', 'LHgHL', 'DLHLD', '.DLD.'], [2, 2]),
  /** a wall of iron-banded wood */
  tower_shield: grid(
    [
      'DDDDDDD',
      'DNNNNND',
      'DnNgNnD',
      'DNNNNND',
      'DLLLLLD',
      'DnNNNnD',
      'DNNgNND',
      'DnNNNnD',
      'DLLLLLD',
      'DNNNNND',
      'DnNgNnD',
      'DDDDDDD',
    ],
    [3, 5],
  ),
  /** volcanic glass with a vein of cooling lava */
  obsidian_shield: grid(
    ['vxxxxxv', 'vxbxxxv', 'vxxfxxv', 'vxxFfxv', 'vxxxfxv', '.vxfxv.', '.vxxxv.', '..vxv..', '...v...'],
    [3, 4],
  ),
};

/** shield-specific palette overrides (on top of the shared shield palette) */
export const SHIELD_PALS = {
  obsidian_shield: { v: '#120c18', x: '#2c2436', b: '#5a4c6e' },
  tower_shield: { D: '#2c2c34' },
};

export const FLASK = grid(['.G.', 'fFf', 'fFf', 'ffF', '.f.'], [1, 3]);
