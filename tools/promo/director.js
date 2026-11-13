// Promo director: drives the running game frame by frame (60 fps sim, 30 fps video), composes 1920×1080
// frames (4× nearest-neighbour + overlays) and posts them to the local receiver (server.mjs).
const S = window.__souls;
const G = S.game;
const W = 1920;
const H = 1080;
const RX = 'http://127.0.0.1:5199/save';
const C = Object.assign(document.createElement('canvas'), { width: W, height: H });
const X = C.getContext('2d');
const GOLD = '#d8b060';

let now = performance.now();
export const st = { vf: 0, sub: 0, rec: false, log: [], inflight: 0, dir: 'teaser', shots: [], dim: 1, bright: 1, zoom: 1, lift: 30, focus: null, pair: false };
/** crop sizes that scale to 1920×1080 by a whole number */
const CROPS = { 1: [480, 270], 1.25: [384, 216], 1.5: [320, 180] };
const releases = [];
/** buttons held for a number of sim steps (a full jump needs the button held) */
const holds = [];
const T = () => (st.vf + st.sub / 2) / 30;

export const scene = () => G.scene.getScene('Game');
const dbg = await import(location.origin + '/src/game/debugState.ts');

// ---------------------------------------------------------------- sound: log samples instead of playing them
S.sfx.sample = function (name, vol = 0.6, rate = 1, delay = 0) {
  if (st.rec) st.log.push({ t: +(T() + delay).toFixed(3), name, vol, rate });
  return true;
};
export function cue(name, vol = 0.6, rate = 1) {
  st.log.push({ t: +T().toFixed(3), name, vol, rate });
}

// ---------------------------------------------------------------- stepping + input
export function init() {
  G.loop.stop();
  G.scale.setGameSize(480, 270);
  dbg.debugState.hitboxes = false;
  dbg.debugState.god = true;
  S.stores.game.setState({ menu: null, showTouch: false });
  document.fonts.load('700 64px Cinzel');
}
export function step1() {
  // the pane's aspect drives the game width; the promo is always 480×270 (16:9)
  if (G.scale.width !== 480 || G.scale.height !== 270) G.scale.setGameSize(480, 270);
  now += 1000 / 60;
  G.loop.step(now);
  for (const a of releases.splice(0)) S.pressTouch(a, false);
  for (let i = holds.length - 1; i >= 0; i--) {
    if (--holds[i].t > 0) continue;
    S.pressTouch(holds[i].a, false);
    holds.splice(i, 1);
  }
}
export const steps = (n) => { for (let i = 0; i < n; i++) step1(); };
export function hold(a, ticks) {
  S.pressTouch(a, true);
  holds.push({ a, t: ticks });
}
/** walk one step toward dir; jump (full height) over walls and ledges, or when stuck */
const walker = { lastX: 0, stuck: 0, cd: 0 };
export function walk(dir) {
  const p = scene().player;
  move(dir);
  walker.cd--;
  if (!dir) return;
  walker.stuck = Math.abs(p.x - walker.lastX) < 0.25 ? walker.stuck + 1 : 0;
  walker.lastX = p.x;
  const blocked = dir > 0 ? p.body.blocked.right : p.body.blocked.left;
  if (p.body.blocked.down && walker.cd <= 0 && (blocked || walker.stuck > 5)) {
    hold('jump', 18);
    walker.cd = 30;
    walker.stuck = 0;
  }
}
export function tap(a) {
  S.pressTouch(a, true);
  releases.push(a);
}
export const move = (x) => (S.touchInput.moveX = x);
export function equip(e) {
  S.stores.inventory.setState((s) => ({ equipped: { ...s.equipped, ...e } }));
}
export function goto(area, x, y, settle = 30) {
  move(0);
  const gs = scene();
  if (!gs.sys.isActive()) {
    G.scene.stop('Title');
    G.scene.start('Game', { area, at: { x, y } });
  } else gs.scene.restart({ area, at: { x, y } });
  S.stores.game.setState({ menu: null });
  steps(settle);
  return scene();
}

// ---------------------------------------------------------------- autopilot
/** walk to the nearest foe and fight it; roll through its swings */
export function fighter(o = {}) {
  let cd = 0;
  let rollCd = 0;
  return () => {
    const gs = scene();
    const p = gs.player;
    cd--;
    rollCd--;
    const foes = o.boss && gs.boss?.alive ? [gs.boss] : gs.enemies.filter((e) => e.alive && Math.abs(e.y - p.y) < (o.dy ?? 50));
    foes.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    const e = foes[0];
    move(0);
    if (!e || Math.abs(e.x - p.x) > (o.range ?? 220)) return walk(o.walk ?? 0);
    const dx = e.x - p.x;
    const d = Math.abs(dx);
    const a = e.atk;
    if (o.roll !== false && a && rollCd <= 0 && a.t > a.def.startup - (o.rollLead ?? 0.2) && a.t < a.def.startup && d < (o.rollRange ?? 70)) {
      move(Math.sign(dx) || 1);
      tap('roll');
      rollCd = 40;
      cd = Math.max(cd, 16);
      return;
    }
    if (d > (o.reach ?? 24)) walk(Math.sign(dx));
    else if (cd <= 0 && p.state !== 'roll') {
      p.facing = dx < 0 ? -1 : 1;
      tap(o.heavy && Math.random() < o.heavy ? 'heavy' : 'light');
      cd = o.rate ?? 20;
    }
  };
}

// ---------------------------------------------------------------- drawing
export const fade = (i, n, fin = 8, fout = 8) => Math.max(0, Math.min(1, i / fin, (n - 1 - i) / fout));

export function text(s, { size = 56, y = H / 2, a = 1, color = GOLD, weight = 700, spacing = 0.12, italic = false, font = 'Cinzel' } = {}) {
  if (a <= 0) return;
  X.save();
  X.globalAlpha = a;
  X.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  X.textAlign = 'center';
  X.textBaseline = 'middle';
  X.letterSpacing = `${spacing}em`;
  X.shadowColor = 'rgba(0,0,0,0.95)';
  X.shadowBlur = size * 0.5;
  X.fillStyle = color;
  X.fillText(s, W / 2, y);
  X.shadowBlur = size * 0.2;
  X.fillText(s, W / 2, y);
  X.restore();
}

export function logo(a = 1, y = H * 0.42, scale = 1) {
  if (a <= 0) return;
  const size = 132 * scale;
  X.save();
  X.globalAlpha = a;
  X.font = `700 ${size}px Cinzel`;
  X.textAlign = 'center';
  X.textBaseline = 'middle';
  X.letterSpacing = '0.08em';
  const g = X.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, '#f4dc9a');
  g.addColorStop(0.55, '#d8a850');
  g.addColorStop(1, '#8a5a24');
  X.shadowColor = 'rgba(255,140,40,0.55)';
  X.shadowBlur = 40 * scale;
  X.fillStyle = g;
  X.fillText('ASH & HOLLOW', W / 2, y);
  X.shadowBlur = 0;
  X.fillText('ASH & HOLLOW', W / 2, y);
  // ornament
  X.strokeStyle = 'rgba(216,176,96,0.7)';
  X.lineWidth = 2 * scale;
  const half = 380 * scale;
  const oy = y + size * 0.62;
  X.beginPath();
  X.moveTo(W / 2 - half, oy);
  X.lineTo(W / 2 - 14 * scale, oy);
  X.moveTo(W / 2 + 14 * scale, oy);
  X.lineTo(W / 2 + half, oy);
  X.stroke();
  X.fillStyle = GOLD;
  X.beginPath();
  X.moveTo(W / 2, oy - 8 * scale);
  X.lineTo(W / 2 + 8 * scale, oy);
  X.lineTo(W / 2, oy + 8 * scale);
  X.lineTo(W / 2 - 8 * scale, oy);
  X.fill();
  X.restore();
}

/** souls-style boss bar along the bottom */
export function bossBar(a = 1) {
  const b = scene().boss;
  if (!b || a <= 0 || !b.active) return;
  const w = 1100;
  const x = (W - w) / 2;
  const y = H - 120;
  const frac = Math.max(0, b.hp / b.cfg.hp);
  X.save();
  X.globalAlpha = a;
  X.font = '500 34px Cinzel';
  X.textAlign = 'left';
  X.textBaseline = 'bottom';
  X.letterSpacing = '0.06em';
  X.shadowColor = 'rgba(0,0,0,0.9)';
  X.shadowBlur = 10;
  X.fillStyle = '#e8dcc0';
  X.fillText(b.cfg.name, x, y - 10);
  X.shadowBlur = 0;
  X.fillStyle = 'rgba(0,0,0,0.75)';
  X.fillRect(x - 3, y - 3, w + 6, 22);
  X.fillStyle = '#5a0a0a';
  X.fillRect(x, y, w, 16);
  const g = X.createLinearGradient(0, y, 0, y + 16);
  g.addColorStop(0, '#c83a22');
  g.addColorStop(1, '#7a140c');
  X.fillStyle = g;
  X.fillRect(x, y, w * frac, 16);
  X.restore();
}

export function youDied(a) {
  if (a <= 0) return;
  X.save();
  X.globalAlpha = a;
  const g = X.createLinearGradient(0, H / 2 - 110, 0, H / 2 + 110);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, 'rgba(0,0,0,0.78)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.78)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  X.fillStyle = g;
  X.fillRect(0, H / 2 - 110, W, 220);
  X.restore();
  text('YOU DIED', { size: 120, a, color: '#a8201a', weight: 500, spacing: 0.1 });
}

function vignette() {
  const g = X.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  X.fillStyle = g;
  X.fillRect(0, 0, W, H);
}

function compose(game, draw, i, n) {
  X.imageSmoothingEnabled = false;
  X.globalAlpha = 1;
  X.fillStyle = '#000';
  X.fillRect(0, 0, W, H);
  if (game) {
    X.globalAlpha = st.dim;
    const [cw, ch] = CROPS[st.zoom] ?? CROPS[1];
    let sx = 0;
    let sy = 0;
    if (cw < 480) {
      // follow the player smoothly inside the game frame
      const gs = scene();
      const cam = gs.cameras.main;
      const p = gs.player;
      const b = gs.boss;
      const tx = (st.pair && b?.alive && b.active ? (p.x + b.x) / 2 : p.x + p.facing * 20) - cam.scrollX;
      const ty = p.y - cam.scrollY - st.lift;
      if (!st.focus) st.focus = { x: tx, y: ty };
      st.focus.x += (tx - st.focus.x) * 0.12;
      st.focus.y += (ty - st.focus.y) * 0.12;
      sx = Math.round(Math.max(0, Math.min(480 - cw, st.focus.x - cw / 2)));
      sy = Math.round(Math.max(0, Math.min(270 - ch, st.focus.y - ch / 2)));
    }
    X.filter = st.bright !== 1 ? `brightness(${st.bright})` : 'none';
    X.drawImage(G.canvas, sx, sy, cw, ch, 0, 0, W, H);
    X.filter = 'none';
    X.globalAlpha = 1;
    vignette();
  }
  draw?.(X, i, n);
}

async function emit(dir, name, q = 0.93) {
  const url = C.toDataURL('image/jpeg', q);
  st.inflight++;
  fetch(`${RX}/${dir}/${name}`, { method: 'POST', body: url }).finally(() => st.inflight--);
  while (st.inflight > 6) await new Promise((r) => setTimeout(r, 4));
}

// ---------------------------------------------------------------- shots
/** record n video frames (2 sim steps each) */
export async function shot(name, n, { each, draw, game = true, black = false } = {}) {
  st.shots.push({ name, start: st.vf, frames: n, t: +(st.vf / 30).toFixed(3) });
  st.focus = null;
  st.rec = true;
  for (let i = 0; i < n; i++) {
    for (st.sub = 0; st.sub < 2; st.sub++) {
      each?.(i * 2 + st.sub, i, n);
      if (game) step1();
    }
    st.sub = 0;
    if (st.rawEvery && game && i % st.rawEvery === 0) {
      st.inflight++;
      const meta = { shot: name, i };
      fetch(`${RX}/raw/r${String(st.vf).padStart(5, '0')}.png`, { method: 'POST', body: G.canvas.toDataURL('image/png') }).finally(() => st.inflight--);
    }
    if (st.noVideo) {
      st.vf++;
      continue;
    }
    compose(game && !black, draw, i, n);
    // fade from/to black
    await emit(st.dir, `f${String(st.vf).padStart(5, '0')}.jpg`);
    st.vf++;
  }
  st.rec = false;
}

/** one still (preview / promo image): the current game frame plus overlays, PNG */
export async function still(dir, name, draw, { game = true, png = true } = {}) {
  step1();
  compose(game, draw, 0, 1);
  if (png) {
    st.inflight++;
    fetch(`${RX}/${dir}/${name}`, { method: 'POST', body: C.toDataURL('image/png') }).finally(() => st.inflight--);
  } else await emit(dir, name, 0.9);
}

/** a still at a custom size, cropped from the 480×270 game frame (scale = whole-pixel upscale) */
export function rawCanvas() {
  return G.canvas;
}

export async function flush() {
  while (st.inflight > 0) await new Promise((r) => setTimeout(r, 10));
  await fetch(`${RX}/${st.dir}/sound.json`, { method: 'POST', body: JSON.stringify({ log: st.log, shots: st.shots, frames: st.vf }) });
}

export { X, C, W, H, GOLD };
