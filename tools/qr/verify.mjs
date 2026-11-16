// Self-test: encode, then read the matrix back the way a scanner does (unmask, zig-zag, de-interleave),
// check every block is a valid Reed–Solomon codeword and that the payload decodes to the input.
//   node tools/qr/verify.mjs <text> [ecl]
import { encode, internals } from './make-qr.mjs';

const [, , text, ecl = 'Q'] = process.argv;
const { ECC_PER_BLOCK, NUM_BLOCKS, rawDataModules, alignmentPositions } = internals;
const q = encode(text, ecl);
const { size: n, version: v, modules: m, mask } = q;

// function-module map, independent of the encoder's bookkeeping
const fn = Array.from({ length: n }, () => Array(n).fill(false));
for (let i = 0; i < n; i++) fn[i][6] = fn[6][i] = true;
for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]])
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x >= 0 && y >= 0 && x < n && y < n) fn[y][x] = true;
  }
const al = alignmentPositions(v);
for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
  if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn[al[j] + dy][al[i] + dx] = true;
}
for (let i = 0; i < 9; i++) fn[8][i] = fn[i][8] = true;
for (let i = 0; i < 8; i++) { fn[8][n - 1 - i] = true; fn[n - 1 - i][8] = true; }

const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
const bits = [];
for (let right = n - 1; right >= 1; right -= 2) {
  if (right === 6) right = 5;
  for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) {
    const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - k : k;
    if (!fn[y][x]) bits.push(m[y][x] !== masks[mask](x, y) ? 1 : 0);
  }
}
const cw = [];
for (let i = 0; i + 8 <= bits.length; i += 8) cw.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

// de-interleave into blocks (short blocks first, long blocks have one more data codeword)
const nb = NUM_BLOCKS[ecl][v], ecc = ECC_PER_BLOCK[ecl][v], raw = Math.floor(rawDataModules(v) / 8);
const numShort = nb - (raw % nb), shortData = Math.floor(raw / nb) - ecc;
const data = Array.from({ length: nb }, () => []), par = Array.from({ length: nb }, () => []);
let k = 0;
for (let i = 0; i <= shortData; i++) for (let b = 0; b < nb; b++) if (i < shortData || b >= numShort) data[b].push(cw[k++]);
for (let i = 0; i < ecc; i++) for (let b = 0; b < nb; b++) par[b].push(cw[k++]);

const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
const rsOk = data.every((d, b) => {
  const poly = d.concat(par[b]);
  let a = 1;
  for (let r = 0; r < ecc; r++) { let s = 0; for (const c of poly) s = mul(s, a) ^ c; if (s !== 0) return false; a = mul(a, 2); }
  return true;
});
const flat = data.flat().flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (b >> i) & 1));
const rd = (o, l) => flat.slice(o, o + l).reduce((a, b) => (a << 1) | b, 0);
const len = rd(4, v < 10 ? 8 : 16), off = v < 10 ? 12 : 20;
const out = Buffer.from([...Array(len)].map((_, i) => rd(off + i * 8, 8))).toString();
console.log({ version: v, ecl, blocks: `${numShort}×${shortData}+${nb - numShort}×${shortData + 1}`, mask, decoded: out, matches: out === text, reedSolomonValid: rsOk });
process.exit(out === text && rsOk ? 0 : 1);
