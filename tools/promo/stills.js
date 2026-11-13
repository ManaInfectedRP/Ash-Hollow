// Promo stills: crop a raw 480×270 game frame, upscale by a whole number (nearest), add vignette/logo, save PNG.
const RX = 'http://127.0.0.1:5199';

async function raw(id) {
  const buf = await (await fetch(`${RX}/out/raw/r${id}.png?v=${Date.now()}`)).arrayBuffer();
  return createImageBitmap(new Blob([buf], { type: 'image/png' }));
}

export function logo(x, cx, y, size, a = 1) {
  x.save();
  x.globalAlpha = a;
  x.font = `700 ${size}px Cinzel`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.letterSpacing = '0.08em';
  const g = x.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, '#f6e0a0');
  g.addColorStop(0.55, '#d8a850');
  g.addColorStop(1, '#8a5a24');
  x.shadowColor = 'rgba(0,0,0,0.9)';
  x.shadowBlur = size * 0.35;
  x.fillStyle = g;
  x.fillText('ASH & HOLLOW', cx, y);
  x.shadowColor = 'rgba(255,140,40,0.5)';
  x.shadowBlur = size * 0.3;
  x.fillText('ASH & HOLLOW', cx, y);
  x.shadowBlur = 0;
  x.fillText('ASH & HOLLOW', cx, y);
  const half = size * 2.9;
  const oy = y + size * 0.62;
  x.strokeStyle = 'rgba(216,176,96,0.75)';
  x.lineWidth = Math.max(1.5, size / 60);
  x.beginPath();
  x.moveTo(cx - half, oy);
  x.lineTo(cx - size * 0.11, oy);
  x.moveTo(cx + size * 0.11, oy);
  x.lineTo(cx + half, oy);
  x.stroke();
  const r = size * 0.06;
  x.fillStyle = '#d8b060';
  x.beginPath();
  x.moveTo(cx, oy - r);
  x.lineTo(cx + r, oy);
  x.lineTo(cx, oy + r);
  x.lineTo(cx - r, oy);
  x.fill();
  x.restore();
}

export function line(x, s, cx, y, { size = 32, color = '#c8b48a', font = 'Georgia', italic = true, weight = 500, spacing = 0.04 } = {}) {
  x.save();
  x.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.letterSpacing = `${spacing}em`;
  x.shadowColor = 'rgba(0,0,0,0.95)';
  x.shadowBlur = size * 0.5;
  x.fillStyle = color;
  x.fillText(s, cx, y);
  x.restore();
}

/** spec: { id, cx, cy, cw, ch, k (scale), out, w, h, bright, vignette, draw(x, w, h) } */
export async function render(spec) {
  const { id, cw, ch, k, w = cw * k, h = ch * k } = spec;
  const img = await raw(id);
  const sx = Math.round(Math.max(0, Math.min(480 - cw, spec.cx - cw / 2)));
  const sy = Math.round(Math.max(0, Math.min(270 - ch, spec.cy - ch / 2)));
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#000';
  x.fillRect(0, 0, w, h);
  x.filter = spec.bright && spec.bright !== 1 ? `brightness(${spec.bright})` : 'none';
  // centre the whole-pixel upscale in the output (it may be a few px larger, e.g. 1026×501 → 1024×500)
  x.drawImage(img, sx, sy, cw, ch, Math.round((w - cw * k) / 2), Math.round((h - ch * k) / 2), cw * k, ch * k);
  x.filter = 'none';
  if (spec.vignette !== false) {
    const g = x.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${spec.vignette ?? 0.45})`);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  }
  spec.draw?.(x, w, h);
  await fetch(`${RX}/save/promo/${spec.out}`, { method: 'POST', body: c.toDataURL('image/png') });
  return [spec.out, sx, sy];
}

export async function all() {
  await document.fonts.load('700 64px Cinzel');
  const top = (x, w, h, a = 0.75, frac = 0.42) => {
    const g = x.createLinearGradient(0, 0, 0, h * frac);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h * frac);
  };
  const out = [];
  // gameplay screenshots, 1920×1080
  out.push(await render({ id: '00028', cx: 240, cy: 135, cw: 480, ch: 270, k: 4, out: 'screenshot-1-hollow.png' }));
  out.push(await render({ id: '00330', cx: 250, cy: 128, cw: 320, ch: 180, k: 6, bright: 1.35, out: 'screenshot-2-flame-blade.png' }));
  out.push(await render({ id: '00446', cx: 262, cy: 128, cw: 320, ch: 180, k: 6, bright: 1.35, out: 'screenshot-3-frost-shatter.png' }));
  out.push(await render({ id: '00630', cx: 262, cy: 118, cw: 384, ch: 216, k: 5, out: 'screenshot-4-ashen-warden.png' }));
  out.push(await render({ id: '00680', cx: 240, cy: 118, cw: 320, ch: 180, k: 6, bright: 1.3, out: 'screenshot-5-bone-shepherd.png' }));
  out.push(await render({ id: '00820', cx: 240, cy: 135, cw: 480, ch: 270, k: 4, out: 'screenshot-6-molten-depths.png' }));
  out.push(await render({ id: '01123', cx: 228, cy: 132, cw: 384, ch: 216, k: 5, bright: 1.15, out: 'screenshot-7-molten-colossus.png' }));
  // key art, 1920×1080: the Colossus with the logo
  out.push(
    await render({
      id: '01123', cx: 214, cy: 112, cw: 384, ch: 216, k: 5, bright: 1.15, out: 'key-art-1920x1080.png',
      draw: (x, w, h) => {
        top(x, w, h, 0.8, 0.45);
        logo(x, w / 2, h * 0.15, 128);
        line(x, 'rest, and rise again', w / 2, h * 0.26, { size: 38 });
      },
    }),
  );
  // Google Play feature graphic, 1024×500 (342×167 ×3 = 1026×501, centred)
  out.push(
    await render({
      id: '01123', cx: 214, cy: 100, cw: 342, ch: 167, k: 3, w: 1024, h: 500, bright: 1.15, out: 'feature-graphic-1024x500.png',
      draw: (x, w, h) => {
        top(x, w, h, 0.85, 0.5);
        logo(x, w / 2, h * 0.17, 76);
        line(x, 'rest, and rise again', w / 2, h * 0.3, { size: 22 });
      },
    }),
  );
  // moonlit alternative key art from the Warden fight
  out.push(
    await render({
      id: '00630', cx: 250, cy: 105, cw: 384, ch: 216, k: 5, out: 'key-art-warden-1920x1080.png',
      draw: (x, w, h) => {
        top(x, w, h, 0.7, 0.4);
        logo(x, w / 2, h * 0.14, 120);
        line(x, 'rest, and rise again', w / 2, h * 0.245, { size: 36 });
      },
    }),
  );
  return out;
}
