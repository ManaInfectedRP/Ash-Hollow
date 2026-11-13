// A small, dependency-free QR code generator (byte mode, versions 1–10, error correction L/M/Q/H),
// written to a PNG with pngjs (already a dev dependency). Follows ISO/IEC 18004.
//
//   node tools/qr/make-qr.mjs <url> <out.png> [--ecl M] [--scale 12] [--dark #120c08] [--light #f4ead8]
import fs from 'node:fs';
import { PNG } from 'pngjs';

// ------------------------------------------------------------------ tables (versions 1–10)
/** error-correction codewords per block, by ecl then version (index 0 unused) */
const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};
/** number of error-correction blocks, by ecl then version */
const NUM_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};
const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

const size = (v) => v * 4 + 17;

/** total data + ecc modules available for codewords */
function rawDataModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const n = Math.floor(v / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (v >= 7) r -= 36;
  }
  return r;
}
const dataCodewords = (v, ecl) => Math.floor(rawDataModules(v) / 8) - ECC_PER_BLOCK[ecl][v] * NUM_BLOCKS[ecl][v];

function alignmentPositions(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size(v) - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

// ------------------------------------------------------------------ Reed–Solomon over GF(256), poly 0x11D
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree) {
  const r = new Array(degree).fill(0);
  r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      r[j] = gfMul(r[j], root);
      if (j + 1 < degree) r[j] ^= r[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, divisor) {
  const r = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ r.shift();
    r.push(0);
    divisor.forEach((d, i) => (r[i] ^= gfMul(d, factor)));
  }
  return r;
}

// ------------------------------------------------------------------ encode
export function encode(text, ecl = 'M') {
  const bytes = [...Buffer.from(text, 'utf8')];
  let v = 1;
  for (; v <= 10; v++) {
    const cap = dataCodewords(v, ecl) * 8;
    const need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
    if (need <= cap) break;
  }
  if (v > 10) throw new Error('text too long for versions 1–10');

  // bit stream: byte mode, count, data, terminator, padding
  const bits = [];
  const put = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const capBits = dataCodewords(v, ecl) * 8;
  put(0, Math.min(4, capBits - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // split into blocks, add ecc, interleave
  const numBlocks = NUM_BLOCKS[ecl][v];
  const eccLen = ECC_PER_BLOCK[ecl][v];
  const rawCodewords = Math.floor(rawDataModules(v) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((blk, j) => {
      if (i !== shortLen - eccLen || j >= numShort) codewords.push(blk[i]);
    });

  // ------------------------------------------------------------------ the matrix
  const n = size(v);
  const mod = Array.from({ length: n }, () => Array(n).fill(false));
  const fn = Array.from({ length: n }, () => Array(n).fill(false));
  const setF = (x, y, dark) => {
    mod[y][x] = dark;
    fn[y][x] = true;
  };
  for (let i = 0; i < n; i++) {
    setF(6, i, i % 2 === 0);
    setF(i, 6, i % 2 === 0);
  }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < n && y >= 0 && y < n) setF(x, y, d !== 2 && d !== 4);
      }
  };
  finder(3, 3);
  finder(n - 4, 3);
  finder(3, n - 4);
  const al = alignmentPositions(v);
  for (let i = 0; i < al.length; i++)
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  const drawFormat = (mask) => {
    const d = (FORMAT_BITS[ecl] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((d << 10) | rem) ^ 0x5412;
    const bit = (i) => ((fb >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
    setF(8, 7, bit(6));
    setF(8, 8, bit(7));
    setF(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setF(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setF(8, n - 15 + i, bit(i));
    setF(8, n - 8, true); // the dark module
  };
  drawFormat(0); // reserve the format areas
  if (v >= 7) throw new Error('version info not implemented (only needed for v ≥ 7)');

  // codewords, zig-zagging up and down in two-module columns from the right
  let bi = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? n - 1 - vert : vert;
        if (!fn[y][x] && bi < codewords.length * 8) {
          mod[y][x] = ((codewords[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1;
          bi++;
        }
      }
  }

  const masks = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (m) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && masks[m](x, y)) mod[y][x] = !mod[y][x];
  };
  // penalty: long runs, 2×2 blocks, finder-like patterns, dark/light balance
  const penalty = () => {
    let p = 0;
    for (const line of [mod, mod[0].map((_, x) => mod.map((r) => r[x]))]) {
      for (const row of line) {
        let run = 1;
        for (let i = 1; i <= n; i++) {
          if (i < n && row[i] === row[i - 1]) run++;
          else {
            if (run >= 5) p += 3 + (run - 5);
            run = 1;
          }
        }
        const s = row.map((b) => (b ? 1 : 0)).join('');
        for (const pat of ['10111010000', '00001011101']) for (let k = s.indexOf(pat); k >= 0; k = s.indexOf(pat, k + 1)) p += 40;
      }
    }
    for (let y = 0; y < n - 1; y++)
      for (let x = 0; x < n - 1; x++) {
        const c = mod[y][x];
        if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
      }
    const dark = mod.flat().filter(Boolean).length;
    p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
    return p;
  };
  let best = 0;
  let bestScore = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m);
    drawFormat(m);
    const sc = penalty();
    if (sc < bestScore) {
      bestScore = sc;
      best = m;
    }
    applyMask(m); // undo (xor)
  }
  applyMask(best);
  drawFormat(best);
  return { version: v, size: n, mask: best, modules: mod };
}

// ------------------------------------------------------------------ PNG
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function writePng(qr, file, { scale = 12, quiet = 4, dark = '#120c08', light = '#f4ead8' } = {}) {
  const px = (qr.size + quiet * 2) * scale;
  const png = new PNG({ width: px, height: px });
  const [dr, dg, db] = hex(dark);
  const [lr, lg, lb] = hex(light);
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const my = Math.floor(y / scale) - quiet;
      const on = mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx];
      const i = (y * px + x) * 4;
      png.data[i] = on ? dr : lr;
      png.data[i + 1] = on ? dg : lg;
      png.data[i + 2] = on ? db : lb;
      png.data[i + 3] = 255;
    }
  fs.writeFileSync(file, PNG.sync.write(png));
  return px;
}

// ------------------------------------------------------------------ cli
if (process.argv[1] && process.argv[1].endsWith('make-qr.mjs')) {
  const [, , text, out = 'qr.png', ...rest] = process.argv;
  if (!text) {
    console.error('usage: node tools/qr/make-qr.mjs <text> <out.png> [--ecl M] [--scale 12] [--dark #hex] [--light #hex]');
    process.exit(1);
  }
  const opt = (k, d) => {
    const i = rest.indexOf(`--${k}`);
    return i >= 0 ? rest[i + 1] : d;
  };
  const qr = encode(text, opt('ecl', 'M'));
  const px = writePng(qr, out, { scale: Number(opt('scale', 12)), dark: opt('dark', '#120c08'), light: opt('light', '#f4ead8') });
  console.log(`QR v${qr.version} (${qr.size}×${qr.size}, mask ${qr.mask}) → ${out} (${px}px)`);
}

/** internals for the self-test (tools/qr/verify.mjs) */
export const internals = { ECC_PER_BLOCK, NUM_BLOCKS, rawDataModules, alignmentPositions };
