import type { IconKey } from '../data/items';
import { makeCanvas, outline, Pix } from './pixel';

/** 16×16 pixel icons for the React UI, drawn once and cached as data URLs. */
const cache = new Map<IconKey, string>();

const DRAW: Record<IconKey, (p: Pix) => void> = {
  sword: (p) => {
    p.line(3, 12, 12, 3, '#c9ced8', 2);
    p.line(4, 12, 12, 4, '#ffffff', 1);
    p.line(2, 10, 5, 13, '#c0a050', 1);
    p.line(1, 14, 3, 12, '#6b4a2f', 2);
  },
  axe: (p) => {
    p.line(3, 14, 11, 3, '#6b4a2f', 2);
    p.rect(9, 2, 5, 6, '#9aa0ac');
    p.rect(13, 2, 1, 6, '#e8ecf4');
    p.rect(8, 3, 1, 4, '#9aa0ac');
  },
  rapier: (p) => {
    p.line(4, 11, 14, 1, '#d8dce4', 1);
    p.line(2, 13, 4, 11, '#6b4a2f', 2);
    p.rect(3, 9, 3, 3, '#c0a050');
    p.rect(4, 10, 1, 1, '#00000000');
  },
  fist: (p) => {
    p.rect(4, 5, 8, 7, '#c8a888');
    p.rect(4, 5, 8, 1, '#e0c4a4');
    for (let i = 0; i < 4; i++) p.px(5 + i * 2, 7, '#8a6a52');
  },
  garb: (p) => {
    p.rect(4, 3, 8, 10, '#6a5a48');
    p.rect(2, 4, 3, 5, '#6a5a48');
    p.rect(11, 4, 3, 5, '#6a5a48');
    p.rect(6, 3, 4, 2, '#7a2430');
    p.rect(4, 10, 8, 1, '#3e2a1a');
  },
  plate: (p) => {
    p.rect(4, 3, 8, 10, '#6b7385');
    p.rect(2, 3, 3, 4, '#a3acbf');
    p.rect(11, 3, 3, 4, '#a3acbf');
    p.rect(7, 4, 2, 8, '#a3acbf');
    p.rect(4, 12, 8, 1, '#454b5a');
  },
  rags: (p) => {
    p.rect(4, 4, 8, 9, '#5a4a3c');
    p.px(5, 12, '#00000000');
  },
  bread: (p) => {
    p.disc(8, 9, 5, '#b07a3a');
    p.disc(8, 8, 4, '#d09a52');
    p.line(5, 7, 7, 9, '#8a5a28');
    p.line(8, 6, 10, 8, '#8a5a28');
  },
  herb: (p) => {
    p.line(8, 14, 8, 6, '#3d5a28', 1);
    p.disc(5, 7, 2, '#5a8a3a');
    p.disc(11, 6, 2, '#5a8a3a');
    p.disc(8, 4, 2, '#6aa048');
    p.px(8, 3, '#ffa030');
    p.px(11, 5, '#ff6a1a');
  },
  soul: (p) => {
    p.disc(8, 8, 5, '#5ab0e8');
    p.disc(8, 8, 3, '#a8e0ff');
    p.disc(8, 8, 1, '#ffffff');
  },
  shard: (p) => {
    for (let y = 0; y < 12; y++) {
      const w = Math.round((1 - Math.abs(y - 6) / 6) * 5) + 1;
      p.rect(8 - Math.floor(w / 2), 2 + y, w, 1, y < 6 ? '#d8f0ff' : '#8ac0e0');
    }
  },
  flaskShard: (p) => {
    for (let y = 0; y < 11; y++) {
      const w = Math.round((1 - Math.abs(y - 4) / 7) * 6) + 1;
      p.rect(7 - Math.floor(w / 2), 3 + y, w, 1, y < 4 ? '#ffd27a' : '#e8892b');
    }
  },
};

export function iconUrl(key: IconKey) {
  let url = cache.get(key);
  if (!url) {
    const { c, ctx } = makeCanvas(16, 16);
    DRAW[key](new Pix(ctx));
    outline(ctx, 0, 0, 16, 16, '#0b0910');
    url = c.toDataURL();
    cache.set(key, url);
  }
  return url;
}
