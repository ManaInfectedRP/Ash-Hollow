// Hand-drawn part grids: arrays of strings where each letter is a palette ROLE
// (resolved per character), '.' = transparent. Grids are drawn facing RIGHT.

/** Parse rows into { w, h, at(x,y) -> letter|null }. Rows are right-padded. */
export function grid(rows, pivot = [0, 0]) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cells = rows.map((r) => r.padEnd(w, '.'));
  return {
    w,
    h,
    pivot,
    at(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const c = cells[y][x];
      return c === '.' || c === ' ' ? null : c;
    },
  };
}

/** Stamp a grid with its pivot at (x, y). `pal` maps letters to colours. */
export function stamp(cv, g, x, y, pal, { flipX = false } = {}) {
  const [px, py] = g.pivot;
  for (let j = 0; j < g.h; j++)
    for (let i = 0; i < g.w; i++) {
      const l = g.at(flipX ? g.w - 1 - i : i, j);
      if (!l) continue;
      const col = pal[l];
      if (col === undefined) throw new Error(`palette has no role '${l}'`);
      cv.px(x - px + i, y - py + j, col);
    }
}

/**
 * Stamp a grid rotated by `deg` around its pivot, placed at (x, y).
 * Uses 3× supersampled nearest-neighbour inverse mapping, which keeps thin
 * blades connected far better than plain nearest-neighbour.
 */
export function stampRotated(cv, g, x, y, deg, pal) {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const [px, py] = g.pivot;
  const R = Math.ceil(Math.hypot(Math.max(px, g.w - px), Math.max(py, g.h - py))) + 1;
  const S = 3;
  for (let j = -R; j <= R; j++)
    for (let i = -R; i <= R; i++) {
      // vote among sub-samples; take the most common non-empty letter if ≥ 3 of 9 hit
      const votes = new Map();
      for (let sj = 0; sj < S; sj++)
        for (let si = 0; si < S; si++) {
          const dx = i + (si + 0.5) / S - 0.5;
          const dy = j + (sj + 0.5) / S - 0.5;
          const sx = Math.floor(dx * cos + dy * sin + px + 0.5);
          const sy = Math.floor(-dx * sin + dy * cos + py + 0.5);
          const l = g.at(sx, sy);
          if (l) votes.set(l, (votes.get(l) ?? 0) + 1);
        }
      let best = null;
      let n = 0;
      let total = 0;
      for (const [l, v] of votes) {
        total += v;
        if (v > n) {
          n = v;
          best = l;
        }
      }
      if (best && total >= 3) cv.px(x + i, y + j, pal[best]);
    }
}
