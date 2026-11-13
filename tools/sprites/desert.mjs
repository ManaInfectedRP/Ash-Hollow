// The Buried Necropolis + the Khepri Wastes: mummy, legionary, the gladiator Varro, the Sphinx and gear.
// Frame names are the contract with the game code (Enemy.ts / Boss.ts).
import { grid, stampRotated } from './lib/grid.mjs';
import { makeSword, PAULDRONS } from './parts.mjs';

let BASE = {};
export function setDesertBase(b) {
  BASE = b;
}

const D2R = Math.PI / 180;

const walk = (s, a, extra = {}) => ({
  walk0: { fx: 2 * s, bx: -2 * s, a, ba: 120, ...extra },
  walk1: { fx: s, fl: 1, bx: -s, by: -1, a: a + 4, ba: 100, ...extra },
  walk2: { fx: -2 * s, bx: 2 * s, a, ba: 75, ...extra },
  walk3: { fx: -s, bx: s, bl: 1, by: -1, a: a + 4, ba: 100, ...extra },
});

/** filled circle with a fractional radius */
function fdisc(cv, cx, cy, r, col) {
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const px = Math.round(cx) + x;
      const py = Math.round(cy) + y;
      if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r + 0.25) cv.px(px, py, col);
    }
}

/** tapered limb through points: dark rim, then fill */
function limbPath(cv, pts, w0, w1, fill, rim) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(l);
    total += l;
  }
  for (const pass of [0, 1]) {
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const n = Math.max(1, Math.ceil(segs[i - 1] * 2));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const r = (w0 + (w1 - w0) * ((run + segs[i - 1] * t) / total)) / 2;
        fdisc(cv, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, pass ? Math.max(0.5, r - 0.7) : r + 0.5, pass ? fill : rim);
      }
      run += segs[i - 1];
    }
  }
}

// ------------------------------------------------------------------ parts
export const DS_HEADS = {
  /** wrapped skull, one green eye showing through the linen */
  mummy: grid(
    [
      '..UuU..',
      '.UUuUU.',
      'uUUuUUu',
      'UuvvUeU',
      'uUUUuUU',
      'UuUvvvu',
      '.uUUUU.',
      '..uuu..',
    ],
    [3, 7],
  ),
  /** bronze galea with a red crest over a grinning skull */
  legion: grid(
    [
      '..RRRR..',
      '.RRRRRR.',
      '..gGGGg.',
      '.gGGGGGg',
      '.gUUvUUg',
      '.gUveUeg',
      '..UUUUU.',
      '..uvuvu.',
      '...uuu..',
    ],
    [4, 8],
  ),
  /** Varro: a heavy crested helm with a grille visor */
  gladiator: grid(
    [
      '....RRRR...',
      '...RRRRRR..',
      '..RR.gg.RR.',
      '..gGGGGGGg.',
      '.gGHHGGGGGg',
      '.gGHvGvGvGg',
      '.gGGvGvGvGg',
      '.gGGGGGGGGg',
      '..gGGGGGGg.',
      '...ggggggg.',
    ],
    [5, 9],
  ),
};

export const DS_WEAPONS = {
  gladius: makeSword({ len: 8, width: 2, grip: 2, guard: 2 }),
  bigGladius: makeSword({ len: 15, width: 3, grip: 3, guard: 2 }),
  /** sandstone mace: a carved head with a green gem on a bronze-bound haft */
  scepter: grid(
    [
      '...........LLL.',
      '..........LHHLD',
      'gnNnNnNnNgLHeLD',
      '..........LLLLD',
      '...........DDD.',
    ],
    [3, 2],
  ),
};

const BRONZE = { g: '#7a5420', G: '#c8963e', D: '#6a4a20', M: '#9a6e30', L: '#c8963e', H: '#ecc478' };
const STEEL = { x: '#5a6070', b: '#b0b8c4', B: '#e4e8f0', W: '#ffffff' };

// ------------------------------------------------------------------ Mummy (rigged)

export const MUMMY_SHEET = () => ({
  key: 'mummy',
  fw: 48,
  fh: 32,
  def: {
    rig: { legLen: 8, legW: 3, torsoW: 8, torsoH: 9, armW: 2, armLen: 6 },
    head: DS_HEADS.mummy,
    headDy: 0,
    torso: 'rags',
    weapon: null,
    bareHands: true,
    legs: { back: '#8a7c62', front: '#b4a684', lit: '#d8ccac' },
    pal: {
      ...BASE,
      U: '#e4d8bc', u: '#a8987a', v: '#140c08', e: '#7aff7a',
      s: '#d0c2a0', z: '#8a7a5c', S: '#ece0c4', k: '#6a5a40', c: '#b4a484', C: '#d8ccac',
    },
  },
  poses: {
    idle0: { lean: 1, by: 1, a: 20, r: 5, ba: 30 },
    idle1: { lean: 1, by: 2, a: 22, r: 5, ba: 32 },
    ...walk(1.5, 15, { lean: 2, r: 5 }),
    wind: { lean: -1, a: -120, r: 4, fx: 2, bx: -3, ba: -100 },
    strike: { lean: 3, a: 30, r: 6, fx: 4, bx: -4, ba: 40 },
    rec: { lean: 2, a: 50, r: 5, fx: 3, bx: -3, ba: 60 },
    wind2: { lean: -1, a: 150, r: 3, fx: 2, bx: -3, ba: 160 },
    strike2: { lean: 4, a: 5, r: 7, fx: 5, bx: -5, ba: 10 },
    rise0: { lean: 4, by: 6, a: 80, r: 3, fx: 3, bx: -4, ba: 100 },
    rise1: { lean: 2, by: 3, a: 40, r: 4, fx: 2, bx: -3, ba: 60 },
    hurt: { lean: -2, a: -40, r: 2, bx: -3, ba: 210 },
    dead: { kind: 'dead' },
  },
});

// ------------------------------------------------------------------ Fallen Legionary (rigged, scutum in front)

function scutum(cv, pose, cx, baseY) {
  if (pose.kind === 'dead') return;
  const x = cx + 4 + (pose.shx ?? 0);
  const y = baseY - 19 + (pose.by ?? 0) + (pose.shy ?? 0);
  const w = 5;
  const h = 14;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1;
      let col = '#8a2020';
      if (edge) col = '#2a0a0a';
      else if (i === 1 || j === 1 || i === w - 2 || j === h - 2) col = '#d8a840';
      else if (j === Math.floor(h / 2) && i === 2) col = '#f0d070'; // boss
      cv.px(x + i, y + j, col);
    }
}

export const LEGIONARY_SHEET = () => ({
  key: 'legionary',
  fw: 48,
  fh: 32,
  def: {
    rig: { legLen: 8, legW: 2, torsoW: 8, torsoH: 8, armW: 2, armLen: 5, taper: 1 },
    head: DS_HEADS.legion,
    headDy: 1,
    torso: 'plate',
    cape: { w: 4 },
    weapon: DS_WEAPONS.gladius,
    bareHands: true,
    legs: { back: '#8a7e66', front: '#b8ac90', lit: '#e8dcc0' },
    after: scutum,
    pal: {
      ...BASE,
      ...BRONZE,
      ...STEEL,
      R: '#c02a2a', U: '#e8dcc0', u: '#a89a80', v: '#100808', e: '#ff6a3a',
      k: '#4a1010', c: '#8a2020', C: '#b03030', n: '#4a3420', N: '#6a4a2a', z: '#8a7e66', s: '#d8ccb0',
    },
  },
  poses: {
    idle0: { a: 70, r: 3, ba: 100 },
    idle1: { a: 72, r: 3, by: 1, ba: 102 },
    ...walk(1.5, 65, { r: 3 }),
    wind: { lean: -1, a: 175, r: 2, fx: 2, bx: -3, ba: 100, shx: -2 },
    strike: { lean: 3, a: 0, r: 6, fx: 5, bx: -5, ba: 120, shx: -3 },
    rec: { lean: 1, a: 30, r: 4, fx: 3, bx: -3, ba: 110 },
    wind2: { lean: -2, a: 90, r: 2, fx: 2, bx: -4, ba: 100, shx: -3 },
    strike2: { lean: 4, a: 80, r: 3, fx: 5, bx: -5, ba: 100, shx: 5 },
    throwW: { lean: -2, a: -160, r: 5, fx: 2, bx: -4, ba: 90, shx: -2, noWeapon: true },
    throwS: { lean: 3, a: -15, r: 7, fx: 5, bx: -5, ba: 100, noWeapon: true },
    hurt: { lean: -2, a: -40, r: 2, bx: -3, ba: 210, shx: -3, shy: 2 },
    dead: { kind: 'dead' },
  },
});

// ------------------------------------------------------------------ Varro, the gladiator (rigged, a blade in each hand)

export const GLADIATOR_SHEET = () => {
  const rig = { legLen: 18, legW: 4, torsoW: 16, torsoH: 18, armW: 4, armLen: 10, taper: 3 };
  const pal = {
    ...BASE,
    ...BRONZE,
    ...STEEL,
    R: '#c02a2a', v: '#0c0806',
    s: '#b47a52', S: '#d89a6c', z: '#7a4a2e', k: '#3a2414', c: '#6a4426', C: '#8a5a32',
    n: '#4a3420', N: '#6a4a2a',
  };
  /** the off-hand gladius, held in the back hand (drawn after the body) */
  const offBlade = (cv, pose, cx, baseY) => {
    if (pose.kind === 'dead') return;
    const by = pose.by ?? 0;
    const lean = pose.lean ?? 0;
    const hipY = baseY - 1 - rig.legLen + by;
    const top = hipY - rig.torsoH + 1;
    const torsoX = cx - Math.floor(rig.torsoW / 2);
    const bsh = [torsoX + lean + 1, top + 2];
    const ba = (pose.ba ?? 100) * D2R;
    const hand = [bsh[0] + Math.cos(ba) * rig.armLen, bsh[1] + Math.sin(ba) * rig.armLen];
    stampRotated(cv, DS_WEAPONS.bigGladius, Math.round(hand[0]), Math.round(hand[1]), pose.oa ?? pose.ba ?? 100, pal);
  };
  const spin = (k) => {
    const a = k * 90;
    return { lean: 0, a, r: 10, ba: a + 180, oa: a + 180, by: 1, fx: k % 2 ? 4 : -4, bx: k % 2 ? -4 : 4 };
  };
  return {
    key: 'gladiator',
    fw: 96,
    fh: 80,
    def: {
      rig,
      head: DS_HEADS.gladiator,
      headDy: 2,
      torso: 'gladiator',
      pauldron: PAULDRONS.brute,
      kneePad: true,
      weapon: DS_WEAPONS.bigGladius,
      bareHands: true,
      legs: { back: '#4a3020', front: '#6a4a2e', lit: '#8a6440' },
      after: offBlade,
      pal,
    },
    poses: {
      idle0: { a: 60, r: 6, ba: 120 },
      idle1: { a: 62, r: 6, by: 1, ba: 122 },
      ...walk(3.5, 55, { r: 6 }),
      slashW: { lean: -3, a: -140, r: 6, by: 1, fx: 4, bx: -6, ba: 150 },
      slashS: { lean: 5, a: 30, r: 10, by: 3, fx: 8, bx: -8, ba: 110 },
      slashR: { lean: 3, a: 60, r: 8, by: 2, fx: 6, bx: -6, ba: 130 },
      slash2W: { lean: -2, a: 150, r: 6, by: 2, fx: 4, bx: -6, ba: -120 },
      slash2S: { lean: 5, a: -25, r: 10, by: 3, fx: 8, bx: -8, ba: 20 },
      crossW: { lean: -4, a: 185, r: 3, by: 3, fx: 6, bx: -8, ba: 175 },
      crossS: { lean: 6, a: 5, r: 12, by: 3, fx: 9, bx: -9, ba: 0 },
      raise: { lean: -1, a: -80, r: 10, by: -1, fx: 3, bx: -4, ba: -100 },
      spinW: { lean: -2, a: 170, r: 10, by: 2, fx: 5, bx: -6, ba: 10 },
      spin0: spin(0),
      spin1: spin(1),
      spin2: spin(2),
      spin3: spin(3),
      dizzy: { lean: -3, a: 110, r: 4, by: 3, fx: 2, bx: -5, ba: 70 },
      hurt: { lean: -4, a: -50, r: 4, bx: -6, by: 3, ba: 210 },
      dead: { kind: 'dead' },
    },
  };
};

// ------------------------------------------------------------------ The Sandstone Sphinx (drawn)

function drawSphinx(cv, pose, fx, fy, fw, fh) {
  const P = {
    rim: '#24140a', dark: '#5e3e1e', shade: '#8c6436', stone: '#ba905a', light: '#d8b47a', hi: '#efd29a',
    seam: '#9c7446', chip: '#f6e2b4',
    blue: '#28467e', blueL: '#4a70ac', gold: '#c89a34', goldL: '#f0cc68', goldD: '#8a6420',
    eye: '#7aff8a', eyeL: '#d8ffd8', eyeD: '#1e8a30', kohl: '#140a06', lip: '#6a3a22',
  };
  const cx = fx + Math.floor(fw / 2) - 8 + (pose.lean ?? 0);
  const base = fy + fh - 1;
  const crouch = pose.crouch ?? 0;
  const rear = pose.rear ?? 0;
  const step = pose.step ?? 0;

  /** lighting ramp: l = how much the surface faces the light (upper right) */
  const ramp = (l) => (l > 0.95 ? P.hi : l > 0.4 ? P.light : l > -0.15 ? P.stone : l > -0.6 ? P.shade : P.dark);

  // --------------------------------------------------------------- dead: toppled and crumbled
  if (pose.kind === 'dead') {
    const blocks = [[-44, 7, 12], [-33, 9, 14], [-20, 11, 12], [-8, 12, 13], [5, 10, 12], [16, 8, 10], [-27, 6, 9], [-12, 6, 10]];
    blocks.forEach(([bx, h, w], i) => {
      const y = base - (i > 5 ? 10 : 0);
      cv.rect(cx + bx, y - h + 1, w, h, i % 2 ? P.stone : P.shade);
      cv.rect(cx + bx, y - h + 1, w, 1, P.light);
      cv.rect(cx + bx + w - 1, y - h + 1, 1, h, P.dark);
      cv.px(cx + bx + 3, y - h + 3, P.chip);
    });
    // the head, fallen on its side in front
    const hx = cx + 40;
    const hy = base - 9;
    for (let y = -9; y <= 9; y++)
      for (let x = -11; x <= 11; x++) {
        const d = (x * x) / 121 + (y * y) / 81;
        if (d > 1) continue;
        cv.px(hx + x, hy + y, d > 0.85 ? P.rim : (y + 20) % 3 === 0 ? P.gold : P.blue);
      }
    for (let y = -4; y <= 6; y++) for (let x = -2; x <= 8; x++) cv.px(hx + x, hy + y, x > 5 ? P.light : P.stone);
    cv.rect(hx + 1, hy - 1, 2, 1, P.eyeD);
    cv.rect(hx + 5, hy - 1, 2, 1, P.eyeD);
    return;
  }

  // --------------------------------------------------------------- the body: haunch + belly + deep chest
  const by = base - 30 + crouch;
  // rearing lifts the front: offset grows from the haunch (left) to the chest (right)
  const tilt = (x) => -Math.round(rear * Math.min(1.2, Math.max(0, (x + 30) / 60)));
  const parts = [
    { ex: cx - 2, ey: by + 2, rx: 27, ry: 12 }, // belly / barrel
    { ex: cx - 24, ey: by - 1, rx: 16, ry: 15 }, // haunch
    { ex: cx + 18, ey: by - 3, rx: 17, ry: 17 }, // chest and shoulder
  ];
  const W = 90;
  const H = 70;
  const ox = cx - 45;
  const oy = by - 45;
  const mask = Array.from({ length: H }, () => Array(W).fill(-1));
  parts.forEach((pt, k) => {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const wx = ox + x;
        const wy = oy + y;
        const dx = wx - pt.ex;
        const dy = wy - (pt.ey + tilt(dx + (pt.ex - cx)));
        if ((dx * dx) / (pt.rx * pt.rx) + (dy * dy) / (pt.ry * pt.ry) <= 1 && wy <= base) mask[y][x] = k;
      }
  });
  const inside = (x, y) => y >= 0 && y < H && x >= 0 && x < W && mask[y][x] >= 0;

  // tail first (behind): sweeps down from the haunch and curls up, ending in a tuft
  const tail0 = [cx - 38, by - 6 + tilt(-38 - cx + cx)];
  const tc = pose.tail ?? 0;
  limbPath(cv, [tail0, [tail0[0] - 9, tail0[1] + 8], [tail0[0] - 16, tail0[1] + 4 - tc], [tail0[0] - 17, tail0[1] - 6 - tc]], 4, 2, P.shade, P.rim);
  fdisc(cv, tail0[0] - 17, tail0[1] - 8 - tc, 2.6, P.dark);
  cv.px(tail0[0] - 18, tail0[1] - 9 - tc, P.shade);

  // far legs (behind the body, in shadow)
  limbPath(cv, [[cx - 20, by + 4], [cx - 26 - step, by + 12], [cx - 30 - step, base - 9], [cx - 25 - step, base - 2]], 9, 6, P.dark, P.rim);
  const ffX = cx + 26 + (pose.farX ?? 0) + step;
  const ffY = base - 2 + (pose.farY ?? 0);
  const fsh = [cx + 22, by + 4 + tilt(22)];
  limbPath(cv, [fsh, [(fsh[0] + ffX) / 2 + 2, (fsh[1] + ffY) / 2 + 2], [ffX, ffY]], 10, 7, P.dark, P.rim);
  fdisc(cv, ffX + 2, ffY, 3.5, P.dark);

  // fill the body
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = mask[y][x];
      if (k < 0) continue;
      const wx = ox + x;
      const wy = oy + y;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let col;
      if (edge) col = P.rim;
      else {
        const pt = parts[k];
        const l = ((wx - pt.ex) / pt.rx) * 0.55 - ((wy - (pt.ey + tilt(wx - cx))) / pt.ry) * 1.0;
        col = ramp(l);
        // the belly always sits in shadow, the back catches the sun
        if (wy > by + 8 + tilt(wx - cx) && k === 0) col = l > 0.3 ? P.stone : P.shade;
        // sandstone courses: a seam every few rows, staggered joints
        const row = wy - (by - 40) - tilt(wx - cx);
        if (row % 7 === 0 && col !== P.hi) col = P.seam;
        else if (row % 7 > 0 && (wx + Math.floor(row / 7) * 9) % 17 === 0 && col !== P.hi) col = P.seam;
        // weathering chips
        if ((wx * 13 + wy * 7) % 53 === 0) col = P.chip;
      }
      cv.px(wx, wy, col);
    }
  // shoulder muscle + the line of the ribcage
  limbPath(cv, [[cx + 10, by - 10 + tilt(10)], [cx + 16, by + 2 + tilt(16)]], 2, 1, P.shade, P.shade);
  for (let k = 0; k < 3; k++) cv.line(cx - 6 + k * 6, by - 4 + tilt(k * 6 - 6), cx - 8 + k * 6, by + 7 + tilt(k * 6 - 8), P.seam);

  // near hind leg: the haunch carries down into a bent hock and a broad paw
  const hk = [cx - 34 + step, base - 10];
  limbPath(cv, [[cx - 22, by + 6], [cx - 30 + step, by + 14], hk, [cx - 27 + step, base - 2]], 11, 7, P.stone, P.rim);
  cv.line(cx - 24, by + 8, hk[0] + 2, hk[1], P.light);
  paw(cx - 25 + step, base - 1, false);

  // near foreleg: thick, straight column of a leg, a great paw at the end
  const shX = cx + 24;
  const shY = by + 2 + tilt(24);
  const pX = cx + 32 + (pose.pawX ?? 0) - step;
  const pY = base - 2 + (pose.pawY ?? 0);
  limbPath(cv, [[shX, shY], [(shX + pX) / 2 + 2, (shY + pY) / 2], [pX, pY]], 13, 9, P.stone, P.rim);
  cv.line(shX + 3, shY + 2, pX + 2, pY - 4, P.light);
  paw(pX + 2, pY + 1, !!pose.claws);

  function paw(x, y, claws) {
    for (let j = -3; j <= 0; j++)
      for (let i = -6; i <= 6; i++) {
        const d = (i * i) / 42 + (j * j) / 12;
        if (d > 1) continue;
        cv.px(x + i, y + j, d > 0.75 ? P.rim : j < -1 ? P.hi : P.light);
      }
    for (const t of [-2, 1, 4]) cv.px(x + t, y - 1, P.seam); // toes
    if (claws) for (let k = 0; k < 3; k++) cv.line(x + 6, y - 3 + k * 1.5, x + 10, y - 1 + k * 1.5, P.chip);
  }

  // --------------------------------------------------------------- the head: nemes, a calm stone face, green fire in the eyes
  const hx = cx + 33 + (pose.headX ?? 0);
  const hy = by - 26 + tilt(33) + (pose.headY ?? 0);
  // the queue of the headdress falling behind the head
  for (let y = 0; y < 12; y++) {
    const w = 4 - Math.floor(y / 4);
    for (let x = 0; x < w; x++) cv.px(hx - 12 - x + Math.floor(y / 3), hy + y, y % 2 ? P.gold : P.blue);
  }
  // lappets flaring down over the shoulders, striped
  for (let y = 0; y < 20; y++) {
    const spread = Math.min(13, 9 + Math.floor(y / 3));
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const x = hx + side * (spread - k);
        const edge = k === 0 || y === 19;
        cv.px(x, hy + y, edge ? P.rim : y % 3 === 2 ? P.goldL : y % 3 === 1 ? P.gold : side > 0 ? P.blueL : P.blue);
      }
    }
  }
  // the dome of the headdress
  for (let y = -10; y <= 1; y++)
    for (let x = -11; x <= 11; x++) {
      const d = (x * x) / 121 + ((y + 1) * (y + 1)) / 100;
      if (d > 1) continue;
      const edge = d > 0.86;
      cv.px(hx + x, hy + y, edge ? P.rim : (y + 12) % 3 === 0 ? (x > 2 ? P.goldL : P.gold) : x > 3 ? P.blueL : P.blue);
    }
  // gold brow band
  cv.rect(hx - 9, hy, 19, 2, P.gold);
  cv.rect(hx - 9, hy, 19, 1, P.goldL);
  // the face
  for (let y = 2; y <= 14; y++) {
    const half = y > 11 ? 6 - (y - 11) : 7;
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) === half || y === 14;
      cv.px(hx + x, hy + y, edge ? P.rim : x > 2 ? P.hi : x < -3 ? P.shade : P.light);
    }
  }
  // brows, kohl-lined eyes burning green
  cv.rect(hx - 5, hy + 4, 4, 1, P.shade);
  cv.rect(hx + 2, hy + 4, 4, 1, P.shade);
  for (const ex of [hx - 5, hx + 2]) {
    cv.rect(ex, hy + 5, 4, 2, P.eye);
    cv.px(ex + 1, hy + 5, P.eyeL);
    cv.rect(ex, hy + 7, 4, 1, P.eyeD);
    cv.px(ex + (ex < hx ? -1 : 4), hy + 6, P.kohl); // the kohl wing
  }
  if (pose.glow) {
    cv.px(hx - 6, hy + 5, P.eye);
    cv.px(hx + 6, hy + 5, P.eye);
    cv.px(hx - 4, hy + 3, P.eyeL);
    cv.px(hx + 4, hy + 3, P.eyeL);
  }
  // nose and its shadow, lips
  cv.rect(hx, hy + 6, 2, 4, P.hi);
  cv.px(hx - 1, hy + 9, P.shade);
  cv.px(hx + 2, hy + 9, P.shade);
  const open = pose.mouth ? 2 : 0;
  cv.rect(hx - 2, hy + 11, 6, 1 + open, open ? P.kohl : P.lip);
  if (open) cv.rect(hx - 1, hy + 11, 4, 1, P.chip);
  // the false beard: braided gold and stone, curling forward at the tip
  for (let y = 0; y < 8; y++) {
    cv.rect(hx - 1 + Math.floor(y / 5), hy + 15 + y, 3, 1, y % 2 ? P.gold : P.goldD);
  }
  cv.px(hx + 3, hy + 22, P.gold);
  cv.px(hx + 3, hy + 21, P.goldD);
  // the uraeus: a gold cobra rearing on the brow, green-eyed
  cv.rect(hx, hy - 4, 2, 4, P.gold);
  cv.rect(hx - 1, hy - 5, 4, 2, P.goldL);
  cv.px(hx + 1, hy - 5, P.eye);
}

export const SPHINX_SHEET = {
  key: 'sphinx',
  fw: 160,
  fh: 96,
  draw: drawSphinx,
  outline: '#1a0e04',
  poses: {
    idle0: {},
    idle1: { crouch: 1, tail: 2 },
    walk0: { step: 3 },
    walk1: { step: 1, crouch: -1 },
    walk2: { step: -3 },
    walk3: { step: -1, crouch: -1 },
    pawW: { lean: -4, pawX: -12, pawY: -14, rear: 6, crouch: 2, glow: true },
    pawS: { lean: 6, pawX: 22, pawY: 0, claws: true, crouch: 4, headX: 3 },
    pawR: { lean: 3, pawX: 12, crouch: 3 },
    maulW: { lean: -6, rear: 16, pawX: 4, pawY: -30, farX: 6, farY: -26, glow: true, headY: 1 },
    maulS: { lean: 6, rear: -4, pawX: 18, pawY: 0, farX: 12, farY: 0, claws: true, crouch: 6, mouth: true },
    maulR: { lean: 4, pawX: 12, farX: 6, crouch: 5 },
    rear: { lean: -8, rear: 21, pawX: 2, pawY: -36, farX: 4, farY: -32, glow: true, headY: 2, mouth: true },
    crouch: { crouch: 9, lean: -4, pawX: -4, glow: true, tail: 4 },
    air: { lean: 4, rear: 8, pawX: 20, pawY: -14, farX: 16, farY: -12, step: 6, claws: true, crouch: -4 },
    hurt: { lean: -5, crouch: 3, headY: 2 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ player gear

export const DS_ARMORS = (HEADS) => ({
  /** embalmed linen wrapped over everything */
  mummy_wraps: {
    head: HEADS.hood,
    torso: 'cloth',
    cape: { w: 3 },
    legs: { back: '#8a7c62', front: '#b4a684', lit: '#d8ccac' },
    pal: {
      D: '#8a7c62', M: '#b4a684', L: '#d8ccac', H: '#ece0c4',
      k: '#8a7c62', c: '#b4a684', C: '#d8ccac', n: '#6a5a40',
    },
  },
  /** bronze lorica, red tunic and cape, crested helm */
  legion_plate: {
    head: HEADS.knightHelm,
    torso: 'plate',
    pauldron: PAULDRONS.small,
    kneePad: true,
    cape: { w: 4 },
    taper: 1,
    legs: { back: '#4a2a1a', front: '#6a3e24', lit: '#8a5432' },
    pal: {
      D: '#6a4a20', M: '#9a6e30', L: '#c8963e', H: '#ecc478',
      k: '#4a1010', c: '#8a2020', C: '#b03030', R: '#c02a2a', r: '#8a1a1a',
    },
  },
});

export const DS_PLAYER_WEAPONS = {
  sand_scepter: { grid: DS_WEAPONS.scepter, pal: { L: '#c49c64', H: '#e8c88a', D: '#7a5430', e: '#7aff8a', g: '#7a5420', n: '#4a3420', N: '#6a4a2a' } },
  gladius: { grid: DS_WEAPONS.gladius, pal: STEEL },
};
