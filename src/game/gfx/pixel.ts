/** Tiny pixel-art canvas helpers. Everything is drawn on integer pixels, no smoothing. */

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

export class Pix {
  constructor(public ctx: CanvasRenderingContext2D) {}

  rect(x: number, y: number, w: number, h: number, col: string) {
    w = Math.round(w);
    h = Math.round(h);
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = col;
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  px(x: number, y: number, col: string) {
    this.rect(x, y, 1, 1, col);
  }

  /** Bresenham line stamped with a t×t square. */
  line(x0: number, y0: number, x1: number, y1: number, col: string, t = 1) {
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
    this.ctx.fillStyle = col;
    for (let guard = 0; guard < 512; guard++) {
      this.ctx.fillRect(x0 - o, y0 - o, t, t);
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

  disc(cx: number, cy: number, r: number, col: string) {
    this.ctx.fillStyle = col;
    const rr = r * r + r * 0.8;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= rr) this.ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Adds a 1px outline around every opaque shape within the region. */
export function outline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  const img = ctx.getImageData(x, y, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const [r, g, b] = hexToRgb(col);
  const a = (i: number, j: number) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : src[(j * w + i) * 4 + 3]);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (a(i, j) > 0) continue;
      if (a(i - 1, j) || a(i + 1, j) || a(i, j - 1) || a(i, j + 1)) {
        const k = (j * w + i) * 4;
        out[k] = r;
        out[k + 1] = g;
        out[k + 2] = b;
        out[k + 3] = 255;
      }
    }
  ctx.putImageData(new ImageData(out, w, h), x, y);
}

/** Deterministic PRNG so generated art is identical every run. */
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
