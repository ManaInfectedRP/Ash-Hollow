// The Weeping Shrine: Ayame, the Pale Maiden, the Faceless Servant, the Lantern Spirit, Grasping Hair and gear.
// Frame names are the contract with the game code (Enemy.ts / Boss.ts).
import { grid, stampRotated } from './lib/grid.mjs';
import { makeSword } from './parts.mjs';

let BASE = {};
export function setShrineBase(b) {
  BASE = b;
}

const D2R = Math.PI / 180;

function fdisc(cv, cx, cy, r, col) {
  const R = Math.ceil(r);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const px = Math.round(cx) + x;
      const py = Math.round(cy) + y;
      if ((px - cx) * (px - cx) + (py - cy) * (py - cy) <= r * r + 0.25) cv.px(px, py, col);
    }
}

// ------------------------------------------------------------------ parts
const HEADS = {
  /** Ayame: hair hanging over half her face, a white ornament standing up from the crown */
  ayame: grid(
    [
      '....UU...',
      '...UUu...',
      '..hhhhh..',
      '.hhhhhhh.',
      'hhhhsSSs.',
      'hhhhsvSS.',
      'hhhhsSSs.',
      'hhhhszss.',
      'hhh..ss..',
      'hh.......',
    ],
    [4, 9],
  ),
  /** the maiden: the same hair, no ornament, a little smaller */
  maiden: grid(
    [
      '..hhhh..',
      '.hhhhhh.',
      'hhhsSSs.',
      'hhhsvSS.',
      'hhhsSSs.',
      'hhh.ss..',
      'hh......',
    ],
    [4, 6],
  ),
  /** the faceless: a smooth white oval under a black hood */
  faceless: grid(
    [
      '..kkkk..',
      '.kcccck.',
      'kcUUUUck',
      'kcUUUUUk',
      'kcUUUUUk',
      'kcUUUUck',
      '.kcUUck.',
      '..kkkk..',
    ],
    [4, 7],
  ),
};

const KNIFE = makeSword({ len: 6, width: 2, grip: 2, guard: 1 });
const ROD = grid(['gnNnNnNnNnNnNnNnNnNnNnG', 'gnNnNnNnNnNnNnNnNnNnNnG'], [4, 1]);

const KIMONO = {
  // sleeves (the rig paints arms in the D/M/L ramp)
  D: '#a8a8c4', M: '#d8d8ec', L: '#f4f4fc', H: '#ffffff',
  k: '#8a8ab0', c: '#d8d8ec', C: '#f4f4fc', r: '#b8b8d4', R: '#f4f4fc', g: '#4e4e78', F: '#8a8ab8',
  s: '#a8b0d0', S: '#c8d0e8', z: '#7a80a8', v: '#1a1428', h: '#1c1626', U: '#f0f0f8', u: '#b8b8d0',
  x: '#5a6070', b: '#c8ccd8', B: '#eef0f6', W: '#ffffff', n: '#3a2a2a', N: '#5a4040',
};

/**
 * Long black hair hanging down the back (drawn after the body), streaming back when she runs;
 * and red eyes when the pose says she is angry.
 */
const hairAndEyes = (rig, size) => (cv, pose, cx, baseY) => {
  if (pose.kind === 'dead') return;
  const by = pose.by ?? 0;
  const lean = pose.lean ?? 0;
  const hipY = baseY - 1 - rig.legLen + by;
  const top = hipY - rig.torsoH + 1;
  const hx = cx + lean - 1;
  const hy = top - Math.round(size * 0.55);
  const strands = Math.round(5 * size / 6);
  for (let k = 0; k < strands; k++) {
    const x0 = hx - 2 - Math.floor(k / 2);
    const len = Math.round((rig.torsoH * 0.95 + (k % 3) * 2) * (pose.hairBack ? 0.8 : 1));
    for (let j = 0; j < len; j++) {
      const t = j / len;
      const x = pose.hairBack ? x0 - Math.round(t * len * 0.9) : x0 - Math.round(Math.sin(t * 2 + k) * 1.2 + t * 2);
      const y = pose.hairBack ? hy + Math.round(t * 4 + Math.sin(t * 6 + k) * 1.5) : hy + j;
      cv.px(x, y, k % 3 === 1 ? '#2e2638' : '#1c1626');
    }
  }
  if (pose.angry) {
    // the eye showing through the hair burns red
    const ex = cx + lean + 1;
    const ey = top - Math.round(size * 0.35);
    cv.px(ex, ey, '#ff3040');
    cv.px(ex + 1, ey, '#ff8a90');
  }
};

const walk = (s, a, extra = {}) => ({
  walk0: { fx: 2 * s, bx: -2 * s, a, ba: 100, ...extra },
  walk1: { fx: s, fl: 1, bx: -s, by: -1, a: a + 3, ba: 96, ...extra },
  walk2: { fx: -2 * s, bx: 2 * s, a, ba: 92, ...extra },
  walk3: { fx: -s, bx: s, bl: 1, by: -1, a: a + 3, ba: 96, ...extra },
});

// ------------------------------------------------------------------ Ayame

export const AYAME_SHEET = () => {
  const rig = { legLen: 18, legW: 4, torsoW: 11, torsoH: 20, armW: 3, armLen: 10, taper: -2 };
  const run = (k) => ({ lean: 6, by: 3, a: 175, r: 4, ba: 185, hairBack: true, angry: true, fx: k % 2 ? 6 : -4, bx: k % 2 ? -6 : 4, fl: k % 2 ? 2 : 0, bl: k % 2 ? 0 : 2 });
  return {
    key: 'ayame',
    fw: 96,
    fh: 80,
    def: {
      rig,
      head: HEADS.ayame,
      headDy: 1,
      torso: 'robe',
      weapon: KNIFE,
      bareHands: true,
      legs: { back: '#b8b8d0', front: '#e0e0ee', lit: '#f4f4fc' },
      after: hairAndEyes(rig, 10),
      pal: { ...BASE, ...KIMONO },
    },
    poses: {
      idle0: { a: 95, r: 3, ba: 95 },
      idle1: { a: 97, r: 3, ba: 97, by: 1 },
      ...walk(2, 92, { r: 3 }),
      stabW: { lean: -2, a: 165, r: 3, fx: 3, bx: -4, ba: 100, angry: true },
      stabS: { lean: 4, a: 2, r: 12, fx: 6, bx: -6, ba: 120, angry: true },
      stabR: { lean: 2, a: 25, r: 8, fx: 4, bx: -4, ba: 110 },
      slashW: { lean: -2, a: -110, r: 10, by: -1, fx: 2, bx: -3, ba: 100, angry: true },
      slashS: { lean: 4, a: 55, r: 11, by: 2, fx: 5, bx: -5, ba: 120, angry: true },
      slashR: { lean: 3, a: 80, r: 8, by: 1, fx: 4, bx: -4, ba: 110 },
      runW: { lean: 4, by: 5, a: 170, r: 3, ba: 175, fx: 4, bx: -5, hairBack: true, angry: true },
      run0: run(0),
      run1: run(1),
      run2: run(2),
      run3: run(3),
      weep: { lean: 2, a: -125, r: 5, ba: -115, by: 1, angry: true },
      hurt: { lean: -4, a: -50, r: 4, bx: -5, by: 3, ba: 200 },
      dead: { kind: 'dead' },
    },
  };
};

// ------------------------------------------------------------------ Pale Maiden

export const MAIDEN_SHEET = () => {
  const rig = { legLen: 8, legW: 3, torsoW: 7, torsoH: 9, armW: 2, armLen: 6, taper: -1 };
  return {
    key: 'maiden',
    fw: 48,
    fh: 32,
    def: {
      rig,
      head: HEADS.maiden,
      headDy: 0,
      torso: 'robe',
      weapon: null,
      bareHands: true,
      legs: { back: '#b8b8d0', front: '#e0e0ee', lit: '#f4f4fc' },
      after: hairAndEyes(rig, 7),
      pal: { ...BASE, ...KIMONO },
    },
    poses: {
      idle0: { a: 100, r: 3, ba: 100, lean: 1 },
      idle1: { a: 102, r: 3, ba: 102, by: 1, lean: 1 },
      ...walk(1, 95, { r: 3, lean: 1 }),
      wind: { lean: -1, a: -60, r: 5, fx: 2, bx: -3, ba: -50, angry: true },
      strike: { lean: 3, a: 5, r: 7, fx: 4, bx: -4, ba: 10, angry: true, hairBack: true },
      rec: { lean: 2, a: 40, r: 5, fx: 3, bx: -3, ba: 50 },
      wind2: { lean: -1, a: -120, r: 4, fx: 2, bx: -3, ba: -110, angry: true },
      strike2: { lean: 4, a: 20, r: 7, fx: 5, bx: -5, ba: 30, angry: true, hairBack: true },
      hurt: { lean: -2, a: -40, r: 2, bx: -3, ba: 210 },
      dead: { kind: 'dead' },
    },
  };
};

// ------------------------------------------------------------------ Faceless Servant

export const FACELESS_SHEET = () => ({
  key: 'faceless',
  fw: 64,
  fh: 48,
  def: {
    rig: { legLen: 12, legW: 4, torsoW: 12, torsoH: 14, armW: 3, armLen: 9, taper: 1 },
    head: HEADS.faceless,
    headDy: 1,
    torso: 'robe',
    cape: { w: 6 },
    weapon: ROD,
    bareHands: true,
    legs: { back: '#141218', front: '#24202c', lit: '#36303e' },
    pal: {
      ...BASE,
      k: '#0e0c12', c: '#1e1a24', C: '#2e2836', r: '#1e1a24', R: '#3a3444', g: '#6a1a1a', F: '#a03030',
      D: '#141218', M: '#24202c', L: '#36303e', H: '#4a4454',
      U: '#ecece8', u: '#c8c8c0', s: '#d8d8d0', S: '#ecece8', z: '#a8a8a0',
      n: '#2a2a30', N: '#4a4a52', G: '#6a6a72',
    },
  },
  poses: {
    idle0: { a: 85, r: 4, ba: 95, lean: 1 },
    idle1: { a: 87, r: 4, ba: 97, by: 1, lean: 1 },
    ...walk(2, 80, { r: 4, lean: 1 }),
    wind: { lean: -2, a: -150, r: 5, by: 1, fx: 3, bx: -4, ba: 60 },
    strike: { lean: 3, a: 30, r: 9, by: 2, fx: 6, bx: -6, cape: 3, ba: 150 },
    rec: { lean: 2, a: 70, r: 7, by: 1, fx: 4, bx: -4, ba: 120 },
    wind2: { lean: -3, a: -95, r: 9, by: -1, fx: 2, bx: -3, ba: -90 },
    strike2: { lean: 4, a: 80, r: 9, by: 3, fx: 6, bx: -6, ba: 80 },
    hurt: { lean: -3, a: -40, r: 3, bx: -4, ba: 200 },
    dead: { kind: 'dead' },
  },
});

// ------------------------------------------------------------------ Lantern Spirit (drawn)

function drawLantern(cv, pose, fx, fy, fw, fh) {
  const P = { rim: '#2a0e08', paper: '#e86a3a', paperL: '#ffb070', rib: '#9a3420', glow: '#ffe8a0', mouth: '#3a0a06', eye: '#1a0806', cap: '#2a1a14' };
  const cx = fx + Math.floor(fw / 2) + (pose.lean ?? 0);
  const cy = fy + fh - 12 + (pose.bob ?? 0);
  if (pose.kind === 'dead') {
    // a crumpled, burnt-out lantern
    for (let x = -6; x <= 6; x++) cv.px(cx + x, fy + fh - 2, x % 2 ? '#5a2a1a' : '#2a1a14');
    for (let x = -4; x <= 4; x++) cv.px(cx + x, fy + fh - 3, '#7a3a20');
    return;
  }
  const rx = 6 + (pose.swell ?? 0);
  const ry = 8;
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (d > 1) continue;
      let col = d > 0.82 ? P.rim : d < 0.3 ? P.glow : x > 1 ? P.paperL : P.paper;
      if ((y + ry) % 4 === 0 && d > 0.15) col = P.rib;
      cv.px(cx + x, cy + y, col);
    }
  // caps top and bottom, the hanging cord
  cv.rect(cx - 3, cy - ry - 2, 7, 2, P.cap);
  cv.rect(cx - 3, cy + ry, 7, 2, P.cap);
  cv.rect(cx, cy - ry - 5, 1, 3, P.cap);
  // one big eye and a torn grin
  const open = pose.mouth ?? 0.3;
  cv.rect(cx, cy - 3, 3, 3, P.eye);
  cv.px(cx + 1, cy - 2, '#ffffff');
  for (let x = -4; x <= 4; x++) cv.px(cx + x, cy + 3 + Math.round(Math.abs(x) * -0.3), P.mouth);
  if (open > 0.5) cv.rect(cx - 3, cy + 3, 7, 2, P.mouth);
  // a tongue of flame licking out when it spits
  if (pose.fire) for (let i = 0; i < 4; i++) cv.px(cx + 5 + i, cy + 3 - (i % 2), i < 2 ? '#ffd060' : '#ff7030');
}

export const LANTERN_SHEET = {
  key: 'lantern',
  fw: 48,
  fh: 32,
  draw: drawLantern,
  outline: '#140604',
  poses: {
    idle0: {},
    idle1: { bob: 1 },
    walk0: { lean: 1 },
    walk1: { lean: 1, bob: 1 },
    walk2: { lean: 1 },
    walk3: { lean: 1, bob: 1 },
    wind: { swell: 1, mouth: 1 },
    strike: { mouth: 1, fire: true, lean: 2 },
    rec: { mouth: 0.4 },
    hurt: { lean: -3, bob: 1 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ Grasping Hair (drawn)

function drawHair(cv, pose, fx, fy, fw, fh) {
  const P = { crack: '#0a0810', dark: '#16121e', mid: '#2a2234', lit: '#4a3a5a' };
  const cx = fx + Math.floor(fw / 2);
  const base = fy + fh - 1;
  // the crack in the paving it lives in
  cv.rect(cx - 8, base, 17, 1, P.crack);
  if (pose.kind === 'dead') {
    for (let x = -7; x <= 7; x++) cv.px(cx + x, base - 1, x % 2 ? P.dark : P.mid);
    return;
  }
  const h = pose.h ?? 3;
  const lean = pose.lean ?? 0;
  const strands = 7;
  for (let k = 0; k < strands; k++) {
    const x0 = cx - 6 + k * 2;
    for (let j = 0; j < h; j++) {
      const t = j / Math.max(1, h);
      const x = Math.round(x0 + lean * t * t * 8 + Math.sin(t * 5 + k) * (1 + t * 1.5));
      cv.px(x, base - 1 - j, j > h - 3 ? P.lit : k % 2 ? P.mid : P.dark);
    }
  }
}

export const HAIR_SHEET = {
  key: 'hair',
  fw: 48,
  fh: 32,
  draw: drawHair,
  outline: '#050308',
  poses: {
    idle0: { h: 3 },
    idle1: { h: 4, lean: 0.3 },
    walk0: { h: 3 },
    walk1: { h: 4 },
    walk2: { h: 3 },
    walk3: { h: 4 },
    wind: { h: 10, lean: -0.6 },
    strike: { h: 28, lean: 1.4 },
    rec: { h: 16, lean: 0.6 },
    hurt: { h: 6, lean: -1 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ player gear

export const SHRINE_PLAYER_WEAPONS = {
  bridal_knife: { grid: KNIFE, pal: { x: '#6a7080', b: '#d8dce6', B: '#f4f6fa', W: '#ffffff', g: '#e8e8f0', G: '#ffffff', n: '#f0f0f8', N: '#c8c8d8' } },
};
export const SHRINE_WEAPONS = { knife: KNIFE };

export const SHRINE_ARMORS = (H) => ({
  /** the burial kimono: white, a dark obi */
  white_kimono: {
    head: H.hood,
    torso: 'robe',
    legs: { back: '#b8b8d0', front: '#e0e0ee', lit: '#f4f4fc' },
    pal: { ...KIMONO },
  },
});
