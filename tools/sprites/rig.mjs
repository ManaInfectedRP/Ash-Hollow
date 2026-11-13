// The rig: draws one frame of a character from its definition + a pose.
// Order (back to front): cape, back arm, back leg, torso, front leg, head,
// front arm + weapon, pauldron, hand. Then an outline pass.
import { Canvas } from './lib/canvas.mjs';
import { stamp, stampRotated } from './lib/grid.mjs';
import { FLASK } from './parts.mjs';

const D2R = Math.PI / 180;

/** Two-bone leg: knee bends forward when the foot is closer than the leg length. */
function knee(hx, hy, fx, fy, len) {
  const dx = fx - hx;
  const dy = fy - hy;
  const d = Math.hypot(dx, dy);
  const half = len / 2;
  const mx = (hx + fx) / 2;
  const my = (hy + fy) / 2;
  if (d >= len) return [mx, my];
  const bend = Math.sqrt(half * half - (d / 2) * (d / 2));
  // perpendicular pointing forward (+x)
  let px = -dy / d;
  let py = dx / d;
  if (px < 0) {
    px = -px;
    py = -py;
  }
  return [mx + px * bend, my + py * bend];
}

/** Thick limb segment with a 1px lit edge (light comes from the upper left). */
function limb(cv, x0, y0, x1, y1, w, base, lit) {
  cv.line(x0, y0, x1, y1, base, w);
  if (w >= 2 && lit) {
    const o = Math.floor((w - 1) / 2);
    cv.line(x0 - o, y0, x1 - o, y1, lit, 1);
  }
}

function drawLeg(cv, def, hip, foot, back) {
  const p = def.pal;
  const r = def.rig;
  const [kx, ky] = knee(hip[0], hip[1], foot[0], foot[1], r.legLen);
  // legs may use their own ramp (trousers, bare skin) so they read apart from the torso
  const lg = def.legs ?? { back: p.D, front: p.M, lit: p.L };
  const base = back ? lg.back : lg.front;
  const lit = back ? lg.front : lg.lit;
  limb(cv, hip[0], hip[1], kx, ky, r.legW, base, lit);
  limb(cv, kx, ky, foot[0], foot[1] - 1, r.legW, base, lit);
  if (def.kneePad) cv.px(kx + 1, ky, back ? p.M : p.H);
  // boot: toe points forward
  const bw = r.legW + 1;
  const bx = Math.round(foot[0] - Math.floor(r.legW / 2));
  cv.rect(bx, foot[1] - 1, bw, 1, back ? p.n : p.N);
  cv.rect(bx, foot[1], bw + 1, 1, p.n);
}

const TORSO_STYLES = {
  plate(i, r, W, H) {
    if (r === H - 2) return i === Math.floor(W / 2) ? 'g' : 'n';
    if (r === 0) return i === W - 1 ? 'M' : 'H';
    if (i === 0) return 'L';
    if (i === W - 1) return 'D';
    if (r > H * 0.5 && (H - 2 - r) % 3 === 0) return 'D';
    if (r <= H * 0.45 && i <= W * 0.5) return r === 1 && i <= 2 ? 'H' : 'L';
    return 'M';
  },
  cloth(i, r, W, H) {
    if (r === H - 2) return i === Math.floor(W / 2) ? 'g' : 'n';
    if (Math.abs(i - (W - 1 - (r * (W - 1)) / (H - 3))) < 0.8 && r < H - 2) return 'n'; // bandolier strap
    if (r === 0) return 'C';
    if (i === 0) return 'C';
    if (i === W - 1) return 'k';
    return r < H / 2 && i < W / 2 ? 'C' : 'c';
  },
  /** cloth layout but in the armor ramp (leather tunic under a cloth hood/cape) */
  leather(i, r, W, H) {
    const l = TORSO_STYLES.cloth(i, r, W, H);
    return { k: 'D', c: 'M', C: 'L' }[l] ?? l;
  },
  rags(i, r, W, H) {
    if (r >= H - 2 && (i + r) % 2 === 0) return null; // tattered hem
    if (r > 1 && r < H - 3 && i > 1 && i < W - 2 && r % 2 === 0) return 'z'; // ribs through the rags
    if (r > 1 && r < H - 3 && i > 1 && i < W - 2) return 's';
    if (i === W - 1) return 'k';
    return 'c';
  },
  /** skeleton: spine + ribs, gaps between */
  bones(i, r, W, H) {
    const spine = Math.floor(W / 2) - 1;
    if (r >= H - 2) return i === 0 || i === W - 1 ? null : 'u'; // pelvis
    if (i === spine) return 'U';
    if (r % 2 === 0 && i > 0 && i < W - 1) return i < spine ? 'u' : 'U';
    return null;
  },
  skin(i, r, W, H) {
    if (r >= H - 2) return i === W - 1 ? 'k' : 'c'; // loincloth
    if (i === 0 || r === 0) return 'S';
    if (i === W - 1) return 'z';
    return 's';
  },
  /** bare-chested fighter: pecs and abs shaded, a leather strap across the chest, a studded belt */
  gladiator(i, r, W, H) {
    const mid = Math.floor(W / 2);
    if (r >= H - 4) {
      if (r === H - 4) return i % 3 === 1 ? 'G' : 'n'; // studded belt
      return i === W - 1 ? 'k' : (i + r) % 4 === 0 ? 'k' : 'c'; // leather skirt strips
    }
    if (Math.abs(i - (W - 1 - (r * (W - 1)) / (H - 5))) < 1) return 'n'; // the baldric
    if (i === 0 || r === 0) return 'S';
    if (i === W - 1) return 'z';
    if (r === Math.round(H * 0.32) && i > 1 && i < W - 2 && i !== mid) return 'z'; // under the pecs
    if (i === mid && r > 2) return 'z'; // the line down the middle
    if (r > H * 0.4 && (r - Math.round(H * 0.4)) % 3 === 0 && i > 2 && i < W - 3) return 'z'; // abs
    return r < H * 0.32 && i < mid ? 'S' : 's';
  },
  /** rock hide split by glowing magma veins, molten core in the chest */
  magma(i, r, W, H) {
    const mid = W / 2;
    const vein = (k) => Math.abs(i - (mid + Math.sin(r * 0.55 + k) * W * 0.32)) < 0.8;
    if (Math.hypot(i - mid, r - H * 0.32) < Math.max(2, W * 0.11)) return (i + r) % 2 ? 'F' : 'e';
    if (vein(0) || vein(2.4)) return r % 3 ? 'f' : 'F';
    if (r === 0) return 'L';
    if (i === 0) return 'L';
    if (i === W - 1) return 'D';
    return (i * 7 + r * 3) % 11 === 0 ? 'D' : r < H * 0.4 && i < mid ? 'L' : 'M';
  },
  /** long robe in the cape ramp (k/c/C): gold trim down the front with ember runes, hem band */
  robe(i, r, W, H) {
    const mid = Math.floor(W / 2);
    if (i === mid && r > 0) return r % 3 === 1 ? 'F' : 'g';
    if (r === H - 3) return 'g';
    if (r === 0 || i === 0) return 'R';
    if (i === W - 1) return 'k';
    return r < H / 2 && i < mid ? 'C' : 'c';
  },
  warden(i, r, W, H) {
    const mid = Math.floor(W / 2);
    if (r === 0 || r === H - 3) return 'g';
    if (r === H - 2) return i === mid ? 'G' : 'n';
    // smouldering crack in the chest
    if (r > 2 && r < H * 0.55 && Math.abs(i - mid - Math.round(Math.sin(r * 1.3))) < 1) return r % 2 ? 'F' : 'f';
    return TORSO_STYLES.plate(i, r, W, H);
  },
};

function drawTorso(cv, def, x0, top, lean) {
  const { torsoW: W, torsoH: H, taper = 0 } = def.rig;
  const style = TORSO_STYLES[def.torso];
  for (let r = 0; r < H; r++) {
    const off = Math.round(lean * (1 - r / (H - 1)));
    // broad shoulders, narrower waist
    const inset = Math.round((taper * r) / (H - 1));
    const w = W - inset * 2;
    for (let i = 0; i < w; i++) {
      const l = style(i, r, w, H);
      if (l) cv.px(x0 + off + inset + i, top + r, def.pal[l]);
    }
  }
}

function drawCape(cv, def, x0, top, bottom, flutter) {
  const p = def.pal;
  const cw = def.cape.w;
  const fl = flutter ?? 1;
  const pts = [
    [x0 - 1, top + 1],
    [x0 + cw - 1, top + 1],
    [x0 + cw - 2 - fl, bottom],
    [x0 - 2 - fl * 2, bottom],
  ];
  cv.poly(pts, (x, y) => {
    if (y === bottom - 1 && (x + y) % 2) return null;
    const t = (x - (x0 - 2 - fl * 2)) / (cw + fl);
    return t < 0.25 ? p.k : t > 0.6 ? p.C : p.c;
  });
}

function drawWeapon(cv, def, hand, deg) {
  if (!def.weapon) return;
  stampRotated(cv, def.weapon, Math.round(hand[0]), Math.round(hand[1]), deg, def.pal);
}

/** Standing / attacking poses. */
function drawBody(cv, def, pose, cx, baseY) {
  const p = def.pal;
  const r = def.rig;
  const by = pose.by ?? 0;
  const lean = pose.lean ?? 0;
  const hipY = baseY - 1 - r.legLen + by;
  const torsoX = cx - Math.floor(r.torsoW / 2);
  const top = hipY - r.torsoH + 1;

  if (def.cape) drawCape(cv, def, torsoX + lean, top, Math.min(baseY - 1, hipY + Math.round(r.legLen * 0.75)), pose.cape);

  // back arm (off hand) – hangs and swings opposite to the legs
  const bsh = [torsoX + lean + 1, top + 2];
  const ba = (pose.ba ?? 100) * D2R;
  const bhand = [bsh[0] + Math.cos(ba) * r.armLen, bsh[1] + Math.sin(ba) * r.armLen];
  limb(cv, bsh[0], bsh[1], bhand[0], bhand[1], r.armW, p.D, p.M);
  cv.rect(bhand[0] - 1, bhand[1] - 1, r.armW, r.armW, def.bareHands ? p.z : p.n);

  const hipB = [cx - 1 + Math.round(lean * 0.3), hipY];
  const hipF = [cx + 1 + Math.round(lean * 0.3), hipY];
  drawLeg(cv, def, hipB, [cx - 1 + (pose.bx ?? 0), baseY - 1 - (pose.bl ?? 0)], true);
  drawTorso(cv, def, torsoX, top, lean);
  drawLeg(cv, def, hipF, [cx + 1 + (pose.fx ?? 0), baseY - 1 - (pose.fl ?? 0)], false);

  // head sits on the leaned torso top
  stamp(cv, def.head, cx + lean + (def.headDx ?? 1), top + (def.headDy ?? 1), p);

  // front arm + weapon
  const sh = [cx + lean + 1, top + Math.max(2, Math.floor(r.torsoH / 4))];
  const a = (pose.a ?? 60) * D2R;
  const reach = pose.r ?? 3;
  const hand = [sh[0] + Math.cos(a) * reach, sh[1] + Math.sin(a) * reach];
  limb(cv, sh[0], sh[1], hand[0], hand[1], r.armW, p.M, p.L);
  if (pose.kind === 'drink') stamp(cv, FLASK, Math.round(hand[0]), Math.round(hand[1]), p);
  else if (!pose.noWeapon) drawWeapon(cv, def, hand, pose.a ?? 60);
  if (def.pauldron) stamp(cv, def.pauldron, sh[0], sh[1], p);
  cv.rect(Math.round(hand[0]) - Math.floor(r.armW / 2), Math.round(hand[1]) - Math.floor(r.armW / 2), r.armW, r.armW, def.bareHands ? p.s : p.n);
  // the weapon bone: where an attached weapon's grip goes, and at which angle; plus the off-hand (shield) bone
  return {
    x: Math.round(hand[0]),
    y: Math.round(hand[1]),
    a: pose.a ?? 60,
    show: pose.kind !== 'drink' && !pose.noWeapon,
    sx: Math.round(bhand[0]),
    sy: Math.round(bhand[1]),
    /** shield in front of the body (raised) rather than hanging behind it */
    front: !!pose.shieldFront,
    /** off-hand angle (degrees) – for an off-hand weapon such as the second dagger */
    sa: pose.ba ?? 100,
  };
}

function drawRoll(cv, def, pose, cx, baseY) {
  const p = def.pal;
  const r = def.rig;
  const rad = Math.round((r.torsoH + def.head.h) / 2.6);
  const cy = baseY - rad - 1;
  const rot = pose.rot ?? 0;
  cv.disc(cx, cy, rad, p.D);
  cv.disc(cx, cy, rad - 1, p.M);
  cv.disc(cx - 1, cy - 1, Math.max(1, rad - 3), p.L);
  for (let k = 0; k < 9; k++) {
    const t = rot + k * 0.2;
    cv.rect(cx + Math.cos(t) * (rad - 1) - 1, cy + Math.sin(t) * (rad - 1) - 1, 2, 2, def.cape ? p.c : p.D);
  }
  const ht = rot + Math.PI;
  stampRotated(cv, def.head, Math.round(cx + Math.cos(ht) * (rad - 2)), Math.round(cy + Math.sin(ht) * (rad - 2)), (rot * 180) / Math.PI, p);
}

/** Dead = the hurt pose rendered upright, then rotated 90° onto its back. */
function drawDead(cv, def, cx, baseY, fw, fh) {
  const tmp = new Canvas(fw, fh);
  drawBody(tmp, def, { lean: -1, a: 100, r: 2, bx: -1, fx: 1, noWeapon: true, cape: 0 }, Math.floor(fw / 2), fh - 1);
  // bounding box of the figure
  let x0 = fw, x1 = 0, y0 = fh, y1 = 0;
  for (let y = 0; y < fh; y++)
    for (let x = 0; x < fw; x++)
      if (tmp.alpha(x, y)) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  // rotate CCW: head ends up on the left
  const ox = cx - Math.floor(bh / 2);
  const oy = baseY - bw + 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const c = tmp.get(x, y);
      if (c[3]) cv.px(ox + (y - y0), oy + (x1 - x), c);
    }
  if (def.weapon) stampRotated(cv, def.weapon, cx + Math.floor(bh / 2) + 2, baseY - 1, 175, def.pal);
}

/** Render one pose into the frame cell at (fx, fy) of size fw×fh. */
export function renderFrame(cv, def, pose, fx, fy, fw, fh) {
  cv.setClip(fx, fy, fw, fh);
  const cx = fx + Math.floor(fw / 2);
  const baseY = fy + fh - 1;
  let bone = { x: 0, y: 0, a: 0, show: false, sx: 0, sy: 0, front: false, sa: 0 };
  if (pose.kind === 'roll') drawRoll(cv, def, pose, cx, baseY);
  else if (pose.kind === 'dead') drawDead(cv, def, cx, baseY, fw, fh);
  else {
    const b = drawBody(cv, def, pose, cx, baseY);
    bone = { ...b, x: b.x - fx, y: b.y - fy, sx: b.sx - fx, sy: b.sy - fy };
  }
  cv.outline(fx, fy, fw, fh, def.pal.o);
  if (def.after) def.after(cv, pose, cx, baseY);
  cv.clearClip();
  return bone;
}

/** One-frame sheet for a shield grid; the grip pivot is at the frame centre. */
export function renderShield(shield, pal) {
  const [px, py] = shield.pivot;
  const R = Math.max(px, shield.w - px, py, shield.h - py) + 1;
  const size = R * 2 + 1;
  const cv = new Canvas(size, size);
  stamp(cv, shield, R, R, pal);
  cv.outline(0, 0, size, size, pal.o);
  return { cv, size };
}

/** Pre-rotated weapon sheet: frame `r<i>` = weapon at i×step degrees, grip at the frame centre. */
export function renderWeaponSheet(weapon, pal, step = 5, cols = 12) {
  const [px, py] = weapon.pivot;
  const R = Math.ceil(Math.hypot(Math.max(px, weapon.w - px), Math.max(py, weapon.h - py))) + 2;
  const size = R * 2 + 1;
  const n = Math.round(360 / step);
  const rows = Math.ceil(n / cols);
  const cv = new Canvas(size * cols, size * rows);
  const frames = [];
  for (let i = 0; i < n; i++) {
    const fx = (i % cols) * size;
    const fy = Math.floor(i / cols) * size;
    cv.setClip(fx, fy, size, size);
    stampRotated(cv, weapon, fx + R, fy + R, i * step, pal);
    cv.outline(fx, fy, size, size, pal.o);
    cv.clearClip();
    frames.push({ name: `r${i}`, x: fx, y: fy, w: size, h: size });
  }
  return { cv, frames, size, step };
}
