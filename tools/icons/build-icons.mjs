// App icons (PWA + Android): a coiled sword in a bonfire, drawn at 32×32 and scaled up crisply.
//   npm run icons
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { Canvas } from '../sprites/lib/canvas.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'public/icons');

function art(pad) {
  // pad = transparent safe-zone margin (maskable icons need ~10%)
  const S = 32;
  const cv = new Canvas(S, S);
  const bg = '#0b0910';
  cv.rect(0, 0, S, S, bg);
  // glow
  for (let r = 13; r > 0; r--) {
    const a = Math.round(255 * (1 - r / 13) * 0.55);
    cv.disc(16, 21, r, `#ff8a30${a.toString(16).padStart(2, '0')}`);
  }
  const o = Math.round(pad);
  const y = (v) => Math.round(o + v * ((S - 2 * o) / S));
  // ash + stones
  cv.rect(8, y(27), 16, 2, '#3a3634');
  cv.rect(10, y(26), 12, 1, '#57514c');
  // flames
  const flame = (cx, h, w, col) => {
    for (let i = 0; i < h; i++) {
      const ww = Math.max(1, Math.round(w * (1 - i / h)));
      cv.rect(cx - Math.floor(ww / 2), y(26) - i, ww, 1, col);
    }
  };
  flame(16, 11, 11, '#ff6a1a');
  flame(16, 8, 7, '#ffa030');
  flame(16, 5, 3, '#ffe08a');
  // coiled sword
  cv.rect(15, y(6), 2, y(20) - y(6), '#c8ccd8');
  cv.rect(15, y(6), 1, y(20) - y(6), '#ffffff');
  cv.rect(12, y(10), 8, 1, '#c0a050');
  cv.rect(15, y(3), 2, 3, '#6b4a2f');
  cv.px(15, y(2), '#c0a050');
  return cv;
}

for (const [name, size, pad] of [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['maskable-512.png', 512, 3],
  ['apple-touch-icon.png', 180, 0],
]) {
  const cv = art(pad);
  const k = Math.floor(size / 32);
  const big = cv.scaled(k);
  // centre in the exact size (180 is not a multiple of 32)
  const out = new Canvas(size, size);
  out.rect(0, 0, size, size, '#0b0910');
  out.draw(big, Math.floor((size - big.w) / 2), Math.floor((size - big.h) / 2));
  out.save(path.join(OUT, name));
}
// Android launcher icons (only when the Capacitor android/ project exists)
const RES = path.join(ROOT, 'android/app/src/main/res');
if (fs.existsSync(RES)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, m] of Object.entries(dens)) {
    const legacy = Math.round(48 * m);
    const fg = Math.round(108 * m);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png']) {
      const cv = art(0);
      const k = Math.max(1, Math.floor(legacy / 32));
      const big = cv.scaled(k);
      const out = new Canvas(legacy, legacy);
      out.rect(0, 0, legacy, legacy, '#0b0910');
      out.draw(big, Math.floor((legacy - big.w) / 2), Math.floor((legacy - big.h) / 2));
      out.save(path.join(RES, `mipmap-${d}`, name));
    }
    // adaptive foreground: art inside the 66% safe zone on a transparent canvas
    const cv = art(0);
    const k = Math.max(1, Math.floor((fg * 0.62) / 32));
    const big = cv.scaled(k);
    const out = new Canvas(fg, fg);
    out.draw(big, Math.floor((fg - big.w) / 2), Math.floor((fg - big.h) / 2));
    out.save(path.join(RES, `mipmap-${d}`, 'ic_launcher_foreground.png'));
  }
  console.log('icons -> android mipmaps');
}
console.log('icons -> public/icons');
