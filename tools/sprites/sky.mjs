// The Sky Reaches: Sky Wisp, Cloud Slime, the Sky Leviathan and the whale's gear.
// Frame names are the contract with the game code (Enemy.ts / Boss.ts).
import { grid } from './lib/grid.mjs';
import { PAULDRONS } from './parts.mjs';

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

// ------------------------------------------------------------------ Sky Wisp: a haloed sheet-ghost, bones showing through

function drawWisp(cv, pose, fx, fy, fw, fh) {
  const P = {
    rim: '#3e3c58', shade: '#8e8cb0', sheet: '#b8b6d4', light: '#d6d4ec', hi: '#eeeefa',
    bone: '#76749a', boneD: '#5a587c', socket: '#2a2840', halo: '#e8f0ff', haloD: '#a8b8e0', glow: '#ffffff', eye: '#ff5a6a',
  };
  const cx = fx + Math.floor(fw / 2) + (pose.lean ?? 0);
  const bottom = fy + fh - 3;
  if (pose.kind === 'dead') {
    // the sheet collapses into a heap, a skull rolled out in front
    for (let x = -10; x <= 10; x++) {
      const h = Math.max(1, Math.round(4 - Math.abs(x) / 3));
      for (let j = 0; j < h; j++) cv.px(cx + x, fy + fh - 1 - j, j === h - 1 ? P.light : x % 3 ? P.sheet : P.shade);
    }
    fdisc(cv, cx + 9, fy + fh - 4, 2.5, P.bone);
    cv.px(cx + 9, fy + fh - 5, P.socket);
    cv.px(cx + 11, fy + fh - 5, P.socket);
    return;
  }
  const H = 22;
  const top = bottom - H + (pose.bob ?? 0);
  const sway = pose.sway ?? 0;
  // ---- the sheet: a rounded dome, straight sides flaring a little, a ragged dripping hem
  for (let y = 0; y < H; y++) {
    const t = y / H;
    let half;
    if (y < 7) half = Math.round(Math.sqrt(Math.max(0, 1 - ((7 - y) / 7) ** 2)) * 7);
    else half = 7 + Math.round((t - 0.32) * 3);
    const drift = Math.round(Math.sin(t * 4 + sway) * t * 1.5);
    for (let x = -half; x <= half; x++) {
      // tendrils: the hem breaks into drips of different lengths
      if (t > 0.78) {
        const lane = ((x + 20) % 4 + 4) % 4;
        const len = [3, 1, 4, 2][lane] + (Math.abs(x) > half - 2 ? -1 : 0);
        if (y > H - 5 + len - 4 + (lane === 0 ? 0 : 1)) continue;
        if (lane === 3 && y > H - 4) continue;
      }
      const edge = Math.abs(x) === half;
      let col = edge ? P.rim : x < -half * 0.35 ? P.shade : x > half * 0.45 && t < 0.6 ? P.light : P.sheet;
      if (y === 1 && Math.abs(x) < 4) col = P.hi;
      cv.px(cx + x + drift, top + y, col);
    }
  }
  // ---- bones seen through the sheet
  const sk = top + 3;
  // skull
  for (let y = 0; y < 6; y++)
    for (let x = -3; x <= 3; x++) {
      if (y === 5 && Math.abs(x) === 3) continue;
      cv.px(cx + x, sk + y, y < 4 ? P.bone : P.boneD);
    }
  // eye sockets (they flare red when it attacks), nose, teeth
  const eyeCol = pose.angry ? P.eye : P.socket;
  cv.rect(cx - 2, sk + 2, 2, 2, eyeCol);
  cv.rect(cx + 1, sk + 2, 2, 2, eyeCol);
  cv.px(cx, sk + 4, P.socket);
  for (const x of [-2, 0, 2]) cv.px(cx + x, sk + 5, P.socket);
  // spine and ribs
  for (let y = sk + 7; y < top + 17; y++) cv.px(cx, y, (y & 1) ? P.bone : P.boneD);
  for (let r = 0; r < 4; r++) {
    const ry = sk + 8 + r * 2;
    const w = 3 - Math.floor(r / 2);
    cv.rect(cx - w, ry, w, 1, P.bone);
    cv.rect(cx + 1, ry, w, 1, P.bone);
  }
  // pelvis smudge
  cv.rect(cx - 2, top + 17, 5, 1, P.boneD);

  // ---- little arms: hanging, raised to call the wind, or thrust forward
  const arm = pose.arm ?? 0;
  const ay = top + 9;
  const stub = (side, dx, dy) => {
    const x0 = cx + side * 7;
    for (let k = 0; k <= 3; k++) {
      const x = Math.round(x0 + side * Math.max(0, dx) * (k / 3) + (side > 0 ? 0 : 0));
      const y = Math.round(ay + dy * (k / 3));
      cv.px(x, y, P.sheet);
      cv.px(x, y + 1, P.shade);
    }
    cv.px(Math.round(x0 + side * Math.max(0, dx)), Math.round(ay + dy) - 1, P.rim);
  };
  if (arm === 1) {
    stub(-1, 2, -5);
    stub(1, 2, -5);
  } else if (arm === 2) {
    stub(-1, 1, 1);
    stub(1, 5, -1);
  } else {
    stub(-1, 3, 2);
    stub(1, 3, 2);
  }

  // ---- the halo: a tilted ring above the head with a bright spark
  const hy = top - 4 + (pose.bob ?? 0) * 0.5;
  const hr = 7 + (pose.haloGrow ?? 0);
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(t) * hr);
    const y = Math.round(hy + Math.sin(t) * 1.6);
    cv.px(x, y, Math.sin(t) > 0 ? P.halo : P.haloD);
  }
  const sp = pose.spark ?? 0;
  const sx = Math.round(cx + Math.cos(sp) * hr);
  const sy = Math.round(hy + Math.sin(sp) * 1.6);
  cv.px(sx, sy - 1, P.glow);
  cv.px(sx - 1, sy, P.glow);
  cv.px(sx + 1, sy, P.glow);
  cv.px(sx, sy + 1, P.glow);
  cv.px(sx, sy - 2, P.halo);
}

export const WISP_SHEET = {
  // not 'wisp': that texture key is the soul wisp (environment.ts)
  key: 'skywisp',
  fw: 48,
  fh: 40,
  draw: drawWisp,
  outline: '#1c1a2e',
  poses: {
    idle0: { sway: 0, spark: 0.5 },
    idle1: { sway: 1.5, bob: 1, spark: 2 },
    walk0: { sway: 0, lean: 1, spark: 0.5 },
    walk1: { sway: 1, lean: 1, bob: 1, spark: 1.5 },
    walk2: { sway: 2, lean: 1, spark: 2.5 },
    walk3: { sway: 3, lean: 1, bob: 1, spark: 3.5 },
    wind: { arm: 1, angry: true, haloGrow: 2, spark: 4.7, bob: -1 },
    strike: { arm: 2, angry: true, lean: 2, spark: 0 },
    rec: { arm: 0, sway: 1, spark: 1 },
    hurt: { lean: -3, sway: 2, bob: 1, spark: 3 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ Cloud Slime

function drawCloudSlime(cv, pose, fx, fy, fw, fh) {
  const P = { rim: '#8aa4c8', body: '#e8f0fa', bright: '#ffffff', shade: '#c4d4ea', core: '#fff4d0', eye: '#2e4a78' };
  const cx = fx + fw / 2;
  const base = fy + fh - 1;
  if (pose.kind === 'dead') {
    for (let i = 0; i < 5; i++) fdisc(cv, cx - 8 + i * 4, base - 2, 2.2, i % 2 ? P.body : P.shade);
    return;
  }
  const rx = 8 * (pose.sx ?? 1);
  const ry = 7 * (pose.sy ?? 1);
  const lean = pose.lean ?? 0;
  const cy = base - ry - (pose.lift ?? 0);
  // a lumpy cloud body: a few overlapping puffs
  const puffs = [[0, 0, 1], [-rx * 0.55, ry * 0.3, 0.65], [rx * 0.55, ry * 0.3, 0.65], [-rx * 0.2, -ry * 0.55, 0.6], [rx * 0.3, -ry * 0.45, 0.55]];
  for (const [px, py, k] of puffs) fdisc(cv, cx + px + lean * (1 - (py + ry) / (2 * ry)), cy + py, Math.max(rx, ry) * k + 0.8, P.rim);
  for (const [px, py, k] of puffs) fdisc(cv, cx + px + lean * (1 - (py + ry) / (2 * ry)), cy + py, Math.max(rx, ry) * k, py > 0 ? P.shade : P.body);
  fdisc(cv, cx - rx * 0.25 + lean, cy - ry * 0.35, Math.max(1, ry * 0.35), P.bright);
  fdisc(cv, cx + lean * 0.5, cy + 1, Math.max(1, ry * 0.25), P.core);
  const ex = cx + rx * 0.35 + lean * 0.6;
  const ey = cy - ry * 0.15;
  cv.rect(Math.round(ex), Math.round(ey), 2, 2, P.eye);
  cv.rect(Math.round(ex) - 4, Math.round(ey), 2, 2, P.eye);
  if (pose.mouth) cv.rect(Math.round(ex) - 3, Math.round(ey) + 3, 4, Math.max(1, Math.round(pose.mouth * 2)), P.eye);
}

export const CLOUDSLIME_SHEET = {
  key: 'cloudslime',
  fw: 48,
  fh: 32,
  draw: drawCloudSlime,
  outline: '#4a6488',
  poses: {
    idle0: { sx: 1, sy: 1 },
    idle1: { sx: 1.06, sy: 0.94 },
    walk0: { sx: 1.15, sy: 0.82 },
    walk1: { sx: 0.88, sy: 1.15, lift: 4, lean: 2 },
    walk2: { sx: 0.92, sy: 1.08, lift: 2, lean: 1 },
    walk3: { sx: 1.2, sy: 0.78 },
    wind: { sx: 1.25, sy: 0.72, lean: -2 },
    strike: { sx: 0.9, sy: 1.12, lean: 3, mouth: 1 },
    rec: { sx: 1.05, sy: 0.95, mouth: 0.4 },
    wind2: { sx: 1.3, sy: 0.65, lean: -1 },
    strike2: { sx: 0.8, sy: 1.25, lean: 4, lift: 6, mouth: 0.6 },
    hurt: { sx: 1.25, sy: 0.75, lean: -3 },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ The Sky Leviathan

/** the whale is drawn this far right of the frame centre so the tail and flukes fit on the left */
const LEVI_SHIFT = 22;

function drawLeviathan(cv, pose, fx, fy, fw, fh) {
  const P = {
    rim: '#141e30', dark: '#2a3c5a', back: '#3e5678', mid: '#5a7498', light: '#84a0c0', hi: '#b8cce2',
    belly: '#dce6f0', bellyD: '#b4c4d6', groove: '#8c9eb4', scar: '#9ab0c8', eye: '#ffe08a', mouth: '#1a1018',
    cloud: '#ffffff', cloudD: '#e0ecf8', barn: '#c8d0d8',
  };
  const cx = fx + Math.floor(fw / 2) + LEVI_SHIFT;
  const by = fy + 66 + (pose.dy ?? 0);
  const tilt = pose.tilt ?? 0; // + = nose down
  const rx = 66;
  const ry = 20;
  const yOf = (x) => Math.round(tilt * (x / rx) * 8);

  if (pose.kind === 'dead') {
    // drifting belly-up, the grooved belly to the sky
    for (let y = -14; y <= 14; y++)
      for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / 196;
        if (d > 1) continue;
        cv.px(cx + x, fy + fh - 16 + y, d > 0.86 ? P.rim : y < -2 ? (x % 5 === 0 ? P.groove : P.belly) : P.mid);
      }
    return;
  }

  // ---- tail stock and flukes (behind the body)
  const tailAngle = pose.tail ?? 0; // -1 raised high … +1 slammed down
  const t0 = [cx - rx + 8, by + yOf(-rx + 8)];
  const t1 = [cx - rx - 22, by - 4 + tailAngle * 18 + yOf(-rx - 22)];
  const t2 = [cx - rx - 40, by - 8 + tailAngle * 40 + yOf(-rx - 40)];
  const along = (u) => [
    u < 0.5 ? t0[0] + (t1[0] - t0[0]) * u * 2 : t1[0] + (t2[0] - t1[0]) * (u - 0.5) * 2,
    u < 0.5 ? t0[1] + (t1[1] - t0[1]) * u * 2 : t1[1] + (t2[1] - t1[1]) * (u - 0.5) * 2,
  ];
  // three passes over the whole stock (rim, body, belly light) so it reads as one smooth limb, not rings
  for (const pass of [0, 1, 2])
    for (let s = 0; s <= 40; s++) {
      const u = s / 40;
      const [x, y] = along(u);
      const r = 13 - u * 9;
      if (pass === 0) fdisc(cv, x, y, r + 0.8, P.rim);
      else if (pass === 1) fdisc(cv, x, y, r, P.back);
      else fdisc(cv, x + 1, y + r * 0.45, r * 0.45, P.mid);
    }
  // flukes: two broad lobes spreading from the tip
  const lobes = [[-16, -13 + tailAngle * 4], [-16, 13 + tailAngle * 4]];
  for (const pass of [0, 1])
    for (const [dx, dy] of lobes)
      for (let s = 0; s <= 16; s++) {
        const u = s / 16;
        const r = 5.5 - u * 3.5;
        fdisc(cv, t2[0] + dx * u, t2[1] + dy * u, pass ? r : r + 0.8, pass ? (u < 0.5 ? P.mid : P.light) : P.rim);
      }

  // ---- the great body: dark back, pale grooved belly
  for (let y = -ry - 2; y <= ry + 2; y++)
    for (let x = -rx; x <= rx; x++) {
      // the head end is blunt and a little deeper, the rear tapers
      const k = x > 0 ? 1 + (x / rx) * 0.15 : 1 - (-x / rx) * 0.35;
      const yy = y - yOf(x);
      const d = (x * x) / (rx * rx) + (yy * yy) / (ry * ry * k * k);
      if (d > 1) continue;
      const rel = yy / (ry * k); // -1 top … +1 bottom
      let col;
      if (d > 0.9) col = P.rim;
      else if (rel > 0.3) {
        col = (x + 400) % 4 === 0 && x > -rx * 0.2 ? P.groove : P.belly; // throat grooves
        if (rel > 0.7) col = P.bellyD;
      } else if (rel < -0.55) col = P.dark;
      else if (rel < -0.1) col = x > rx * 0.2 && rel < -0.35 ? P.light : P.back;
      else col = P.mid;
      if (rel < 0.3 && (x * 7 + yy * 11) % 37 === 0) col = P.scar; // old scars
      if (rel < -0.3 && (x * 13 + yy * 5) % 61 === 0) col = P.barn; // barnacles
      cv.px(cx + x, by + y, col);
    }
  // a highlight along the back
  for (let x = -rx * 0.5; x < rx * 0.6; x += 1) cv.px(Math.round(cx + x), Math.round(by - ry * 0.78 + yOf(x) - Math.sin((x / rx) * 1.5) * 1), P.hi);
  // cloud clinging to its back
  for (const [ox, oy, r] of [[-30, -ry + 1, 4], [-24, -ry - 1, 5], [-17, -ry + 1, 3.5], [20, -ry + 2, 3], [26, -ry, 4]]) {
    fdisc(cv, cx + ox, by + oy + yOf(ox), r, P.cloudD);
    fdisc(cv, cx + ox - 1, by + oy - 1 + yOf(ox), r - 1.2, P.cloud);
  }

  // ---- head: blowhole, eye, the long mouth line, the jaw dropping open
  const hx = cx + rx - 18;
  const hyEye = by + 2 + yOf(rx - 18);
  cv.rect(cx + 18, by - ry + 1 + yOf(18), 4, 1, P.rim); // blowhole
  if (pose.spray) for (let i = 0; i < 6; i++) fdisc(cv, cx + 20 + (i % 2 ? 2 : -2), by - ry - 3 - i * 3 + yOf(18), 2 + (i % 3) * 0.5, i % 2 ? P.cloud : P.cloudD);
  fdisc(cv, hx, hyEye, 2.2, P.rim);
  cv.px(hx, hyEye, P.eye);
  cv.px(hx + 1, hyEye - 1, P.eye);
  if (pose.squint) cv.rect(hx - 2, hyEye - 1, 5, 1, P.dark);
  // mouth: a line sweeping from the snout back under the eye
  const open = pose.open ?? 0;
  for (let x = -24; x <= 8; x++) {
    const mx = hx + x;
    const my = by + 7 + yOf(rx - 18 + x) + Math.round(Math.sin(((x + 24) / 32) * Math.PI) * 1.5);
    cv.px(mx, my, P.mouth);
    if (open > 0) {
      const drop = Math.round(open * 9 * ((x + 24) / 32));
      for (let j = 1; j <= drop; j++) cv.px(mx, my + j, j === drop ? P.bellyD : j < 3 ? '#5a2030' : P.mouth);
      if (x % 3 === 0 && drop > 2) cv.px(mx, my + 1, P.barn); // baleen
    }
  }
  // pectoral fin
  const fa = pose.fin ?? 0;
  for (let s = 0; s <= 14; s++) {
    const u = s / 14;
    const x = cx + 10 - u * 10;
    const y = by + ry - 2 + u * (10 + fa * 6) + yOf(10);
    fdisc(cv, x, y, 4.5 - u * 3 + 0.8, P.rim);
  }
  for (let s = 0; s <= 14; s++) {
    const u = s / 14;
    fdisc(cv, cx + 10 - u * 10, by + ry - 2 + u * (10 + fa * 6) + yOf(10), 4.5 - u * 3, u < 0.5 ? P.back : P.mid);
  }
}

export const LEVIATHAN_SHEET = {
  key: 'leviathan',
  fw: 240,
  fh: 96,
  draw: drawLeviathan,
  outline: '#0c1220',
  poses: {
    idle0: { tail: -0.2, fin: 0 },
    idle1: { tail: 0.2, fin: 0.5, dy: 1 },
    walk0: { tail: -0.4, fin: -0.3 },
    walk1: { tail: 0, fin: 0.3, dy: 1 },
    walk2: { tail: 0.4, fin: 0.6, dy: 1 },
    walk3: { tail: 0, fin: 0.2 },
    biteW: { tilt: -1.2, open: 0.4, tail: 0.5, fin: -0.5 },
    biteS: { tilt: 1.2, open: 1, tail: -0.5, fin: 0.8 },
    low: { tilt: 0.2, open: 0.2, tail: 0.6, fin: 1, squint: true, dy: 2 },
    tailW: { tilt: 0.6, tail: -0.95, fin: 0.3 },
    tailS: { tilt: -0.3, tail: 0.85, fin: 0.9 },
    mouthW: { open: 0.5, tail: 0.2, spray: true },
    mouthS: { open: 0.9, tail: -0.2, spray: true, tilt: 0.3 },
    hurt: { tilt: -0.6, tail: 0.8, fin: -0.6, squint: true },
    dead: { kind: 'dead' },
  },
};

// ------------------------------------------------------------------ player gear

const BONE = { x: '#5a6a80', b: '#a8b8cc', B: '#dce8f4', W: '#ffffff', g: '#6a7a90', n: '#3a4252', N: '#5a6474' };

export const SKY_WEAPONS = {
  /** a whalebone-and-storm-iron maul on a long haft */
  cloudbreaker: grid(
    [
      '............xxxx..',
      '...........xbBBbx.',
      'gnNnNnNnNnNgbBWBbx',
      '...........xbBBbx.',
      '............xxxx..',
    ],
    [3, 2],
  ),
};

export const SKY_PLAYER_WEAPONS = {
  cloudbreaker: { grid: SKY_WEAPONS.cloudbreaker, pal: BONE },
};
export const SKY_WEAPON_PAL = BONE;

export const SKY_ARMORS = (HEADS) => ({
  /** blue-grey plates of whale hide */
  whale_scale: {
    head: HEADS.greatHelm,
    torso: 'plate',
    pauldron: PAULDRONS.small,
    kneePad: true,
    cape: { w: 4 },
    taper: 1,
    legs: { back: '#24304a', front: '#3a4a66', lit: '#56688a' },
    pal: {
      D: '#2a3c5a', M: '#4a6488', L: '#7a96b8', H: '#b8cce2',
      k: '#1e2a40', c: '#34486a', C: '#4e6890', u: '#b4c4d6', U: '#dce6f0',
    },
  },
  /** cloud-white robe with a thread of gold */
  white_cloak: {
    head: HEADS.hood,
    torso: 'robe',
    cape: { w: 5 },
    legs: { back: '#b8c8dc', front: '#d8e4f0', lit: '#f0f6fc' },
    pal: {
      k: '#c4d4e8', c: '#e4ecf6', C: '#ffffff', r: '#c4d4e8', R: '#ffffff', g: '#d8b050', F: '#fff0b0',
      D: '#b8c8dc', M: '#d8e4f0', L: '#f0f6fc', H: '#ffffff',
    },
  },
});
