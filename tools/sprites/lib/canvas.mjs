// Minimal RGBA pixel canvas for the sprite build (Node, no DOM).
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const cache = new Map();
/** '#rrggbb' or '#rrggbbaa' -> [r,g,b,a] */
export function rgba(col) {
  if (Array.isArray(col)) return col;
  let v = cache.get(col);
  if (!v) {
    const h = col.replace('#', '');
    v = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    v.push(h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255);
    cache.set(col, v);
  }
  return v;
}

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
    this.clip = { x: 0, y: 0, w, h };
  }

  setClip(x, y, w, h) {
    this.clip = { x, y, w, h };
  }
  clearClip() {
    this.clip = { x: 0, y: 0, w: this.w, h: this.h };
  }

  inClip(x, y) {
    const c = this.clip;
    return x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h;
  }

  px(x, y, col) {
    if (col == null) return;
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inClip(x, y)) return;
    const [r, g, b, a] = rgba(col);
    if (a === 0) return;
    const k = (y * this.w + x) * 4;
    this.data[k] = r;
    this.data[k + 1] = g;
    this.data[k + 2] = b;
    this.data[k + 3] = a;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0];
    const k = (y * this.w + x) * 4;
    return [this.data[k], this.data[k + 1], this.data[k + 2], this.data[k + 3]];
  }

  alpha(x, y) {
    return this.get(x, y)[3];
  }

  rect(x, y, w, h, col) {
    for (let j = 0; j < Math.round(h); j++) for (let i = 0; i < Math.round(w); i++) this.px(Math.round(x) + i, Math.round(y) + j, col);
  }

  /** Bresenham line stamped with a t×t square; `shade(i, n)` may return a colour per step. */
  line(x0, y0, x1, y1, col, t = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor((t - 1) / 2);
    for (let guard = 0; guard < 1024; guard++) {
      this.rect(x0 - o, y0 - o, t, t, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  disc(cx, cy, r, col) {
    const rr = r * r + r * 0.8;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= rr) this.px(cx + x, cy + y, col);
  }

  /** Scanline polygon fill. `colAt(x, y)` may return a colour per pixel. */
  poly(pts, colAt) {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.floor(Math.min(...ys));
    const y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++)
          this.px(x, y, typeof colAt === 'function' ? colAt(x, y) : colAt);
    }
  }

  /** Draw another canvas on top (alpha > 0 pixels only). */
  draw(src, dx, dy) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(x, y);
        if (c[3]) this.px(dx + x, dy + y, c);
      }
  }

  /** 1px outline around opaque shapes inside a region. */
  outline(x, y, w, h, col) {
    const a = (i, j) => (i < x || j < y || i >= x + w || j >= y + h ? 0 : this.alpha(i, j));
    const mark = [];
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (!a(i, j) && (a(i - 1, j) || a(i + 1, j) || a(i, j - 1) || a(i, j + 1))) mark.push([i, j]);
    for (const [i, j] of mark) this.px(i, j, col);
  }

  /** New canvas scaled by an integer factor (for previews). */
  scaled(k) {
    const out = new Canvas(this.w * k, this.h * k);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        if (c[3]) out.rect(x * k, y * k, k, k, c);
      }
    return out;
  }

  save(file) {
    const png = new PNG({ width: this.w, height: this.h });
    png.data = Buffer.from(this.data);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, PNG.sync.write(png));
  }
}
