import Phaser from 'phaser';
import { makeCanvas, outline, Pix, rng } from './pixel';

/** Generates tiles, parallax backgrounds, props and particle textures. */
export function buildEnvironment(scene: Phaser.Scene) {
  tiles(scene);
  sky(scene);
  mountains(scene);
  ruins(scene);
  fogBands(scene);
  bonfire(scene);
  glow(scene, 'glow', 96, [255, 170, 80]);
  glow(scene, 'glow-soul', 32, [170, 230, 255]);
  lightBrush(scene);
  small(scene);
  fogWall(scene);
  shockwave(scene);
  door(scene);
  arrow(scene);
  crypt(scene);
  lavaArt(scene);
  frostArt(scene);
  mireArt(scene);
  desertArt(scene);
  skyArt(scene);
  shrineArt(scene);
  caveFar(scene);
  caveNear(scene);
}

/** Lava surface strip, moving platform slab, lava glob, lava wave crest and a warm backdrop glow. */
function lavaArt(scene: Phaser.Scene) {
  // animated surface (tiles horizontally, scrolled in-game)
  {
    const W = 64;
    const H = 8;
    const { c, ctx } = makeCanvas(W, H);
    const p = new Pix(ctx);
    for (let x = 0; x < W; x++) {
      const h = 3 + Math.round(Math.sin((x / W) * Math.PI * 4) * 1.5 + Math.sin((x / W) * Math.PI * 10) * 0.8);
      p.rect(x, H - h - 1, 1, h + 1, '#ff8a1e');
      p.rect(x, H - h - 1, 1, 1, '#ffe08a');
    }
    for (let i = 0; i < 6; i++) p.disc(6 + i * 11, H - 2, 1, '#fff1b0');
    scene.textures.addCanvas('lava-surface', c);
  }
  // moving platform: dark slab with glowing runes, one-tile tall look (drawn 16 px wide, stretched by width)
  {
    const { c, ctx } = makeCanvas(16, 8);
    const p = new Pix(ctx);
    p.rect(0, 0, 16, 8, '#3a3442');
    p.rect(0, 0, 16, 2, '#6a6276');
    p.rect(0, 7, 16, 1, '#1c1922');
    p.rect(3, 4, 2, 1, '#ff9a3a');
    p.rect(10, 3, 3, 1, '#ff9a3a');
    outline(ctx, 0, 0, 16, 8, '#110d16');
    scene.textures.addCanvas('mover', c);
  }
  // lava glob projectile
  {
    const { c, ctx } = makeCanvas(9, 9);
    const p = new Pix(ctx);
    p.disc(4, 4, 4, '#c8360e');
    p.disc(4, 4, 3, '#ff8a1e');
    p.disc(3, 3, 1, '#ffe08a');
    scene.textures.addCanvas('glob', c);
  }
  // lava wave crest: 2 frames, 20×44
  {
    const FW = 20;
    const FH = 44;
    const { c, ctx } = makeCanvas(FW * 2, FH);
    const p = new Pix(ctx);
    for (let f = 0; f < 2; f++) {
      const ox = f * FW;
      const r = rng(60 + f);
      for (let x = 0; x < FW; x++) {
        const t = x / (FW - 1);
        const h = Math.round(Math.sin(t * Math.PI) * 38 + 4 + r() * 4);
        p.rect(ox + x, FH - h, 1, h, '#a8240a');
        p.rect(ox + x, FH - Math.round(h * 0.8), 1, Math.round(h * 0.8), '#e0501a');
        p.rect(ox + x, FH - Math.round(h * 0.45), 1, Math.round(h * 0.45), '#ff9a2a');
        p.rect(ox + x, FH - Math.round(h * 0.15), 1, Math.round(h * 0.15), '#ffe08a');
      }
    }
    const tex = scene.textures.addCanvas('lava-wave', c)!;
    tex.add('w0', 0, 0, 0, FW, FH);
    tex.add('w1', 0, FW, 0, FW, FH);
  }
  // backdrop glow from the lava below (screen-sized gradient)
  {
    const W = 64;
    const H = 270;
    const { c, ctx } = makeCanvas(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,90,20,0)');
    g.addColorStop(0.6, 'rgba(255,90,20,0.05)');
    g.addColorStop(1, 'rgba(255,110,30,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    scene.textures.addCanvas('bg-lavaglow', c);
  }
}

/**
 * The desert acts: a sandstone tileset (same tile indices as 'tiles', picked per theme), a daytime sky
 * and sun, cactus / dead scrub / urn props, gladiator ground spikes and a thrown pilum.
 */
function desertArt(scene: Phaser.Scene) {
  // sandstone tileset: 0 sand over sandstone, 1 sandstone blocks, 2 plank; 3..6 copied from the base set
  {
    const S = 16;
    const { c, ctx } = makeCanvas(S * 7, S);
    const p = new Pix(ctx);
    const r = rng(91);
    const blocks = (ox: number) => {
      p.rect(ox, 0, S, S, '#b8864e');
      for (let row = 0; row < 2; row++) {
        const y = row * 8;
        p.rect(ox, y + 7, S, 1, '#7a5430');
        const off = row % 2 === 0 ? 2 : 9;
        for (let bx = off; bx < S; bx += 14) p.rect(ox + bx, y, 1, 7, '#7a5430');
        p.rect(ox, y, S, 1, '#d4a468');
      }
      for (let i = 0; i < 12; i++) p.px(ox + Math.floor(r() * S), Math.floor(r() * S), r() > 0.5 ? '#c8985c' : '#9a6c3c');
    };
    blocks(0);
    // drifted sand on top
    for (let x = 0; x < S; x++) {
      const h = 3 + Math.round(Math.sin(x * 0.7) * 0.8 + (r() > 0.7 ? 1 : 0));
      p.rect(x, 0, 1, h, '#e8c47c');
      p.px(x, 0, '#f8e0a0');
      p.px(x, h, '#c09858');
    }
    blocks(S);
    // 2: weathered plank
    const ox = S * 2;
    p.rect(ox, 0, S, 4, '#8a6238');
    p.rect(ox, 0, S, 1, '#b08450');
    p.rect(ox, 3, S, 1, '#5a3c20');
    p.rect(ox + 2, 4, 2, 5, '#6a4a2a');
    p.rect(ox + 12, 4, 2, 5, '#6a4a2a');
    const base = scene.textures.get('tiles').getSourceImage() as HTMLCanvasElement;
    ctx.drawImage(base, S * 3, 0, S * 4, S, S * 3, 0, S * 4, S);
    // tint the copied spikes to bronze
    scene.textures.addCanvas('tiles-sand', c);
  }
  // daytime sky: deep blue at the top fading to a hot pale haze on the horizon
  {
    const W = 64;
    const H = 270;
    const { c, ctx } = makeCanvas(W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#3a78c0');
    g.addColorStop(0.55, '#8cc0e8');
    g.addColorStop(0.85, '#f4dca8');
    g.addColorStop(1, '#f8e8c0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    scene.textures.addCanvas('bg-daysky', c);
  }
  {
    const { c, ctx } = makeCanvas(40, 40);
    const g = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(0.35, 'rgba(255,248,200,1)');
    g.addColorStop(0.45, 'rgba(255,220,140,0.5)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
    scene.textures.addCanvas('sun', c);
  }
  // rolling dunes for the desert backdrop: a pale far range and a warmer near one with wind ripples
  const dunes = (key: string, W: number, base: number, waves: [number, number][], body: string, crest: string, shade: string, seed: number) => {
    const H = 270;
    const { c, ctx } = makeCanvas(W, H);
    const p = new Pix(ctx);
    const r = rng(seed);
    const heights: number[] = [];
    for (let x = 0; x < W; x++) {
      let h = base;
      for (const [period, amp] of waves) h += Math.sin((x / W) * Math.PI * 2 * period + period * 1.7) * amp;
      heights.push(Math.round(h));
    }
    for (let x = 0; x < W; x++) {
      const h = heights[x];
      const slope = heights[(x + 1) % W] - heights[(x + W - 1) % W];
      // one even body of sand; only the skin of each dune shows which way it faces the sun
      p.rect(x, H - h, 1, h, body);
      const skin = Math.min(h, 4 + Math.abs(slope) * 3);
      if (slope < 0) p.rect(x, H - h, 1, skin, shade);
      p.px(x, H - h, crest);
    }
    // wind ripples
    for (let i = 0; i < W / 6; i++) {
      const x = Math.floor(r() * W);
      const y = H - heights[x] + 6 + Math.floor(r() * (heights[x] - 8));
      if (y < H) p.rect(x, y, 3 + Math.floor(r() * 4), 1, shade);
    }
    scene.textures.addCanvas(key, c);
  };
  dunes('bg-dunes-far', 512, 152, [[2, 14], [5, 6], [9, 2]], '#e8c890', '#f8e4b8', '#d4ac74', 71);
  dunes('bg-dunes-near', 512, 128, [[3, 12], [7, 5], [13, 2]], '#d8a868', '#f0cc90', '#b88850', 72);

  // props (drawn at in-game size: PROP_SCALE 1)
  {
    const { c, ctx } = makeCanvas(14, 24);
    const p = new Pix(ctx);
    const trunk = (x: number, y: number, w: number, h: number) => {
      p.rect(x, y, w, h, '#4a8a3a');
      p.rect(x, y, 1, h, '#6aa84a');
      p.rect(x + w - 1, y, 1, h, '#2e5a24');
      for (let yy = y + 2; yy < y + h; yy += 3) p.px(x + Math.floor(w / 2), yy, '#d8e8a0');
    };
    trunk(5, 2, 4, 22);
    trunk(1, 8, 3, 7);
    p.rect(1, 14, 5, 2, '#4a8a3a');
    trunk(10, 5, 3, 8);
    p.rect(8, 12, 4, 2, '#4a8a3a');
    p.rect(6, 1, 2, 1, '#f080a0');
    outline(ctx, 0, 0, 14, 24, '#1a2a12');
    scene.textures.addCanvas('prop:cactus', c);
  }
  {
    const { c, ctx } = makeCanvas(16, 10);
    const p = new Pix(ctx);
    const r = rng(33);
    for (let i = 0; i < 9; i++) {
      const x0 = 8 + Math.round((r() - 0.5) * 4);
      p.line(x0, 9, Math.round(1 + r() * 14), Math.round(r() * 5), r() > 0.5 ? '#8a6a40' : '#6a4e2e');
    }
    scene.textures.addCanvas('prop:scrub', c);
  }
  {
    const { c, ctx } = makeCanvas(10, 12);
    const p = new Pix(ctx);
    p.rect(3, 0, 4, 2, '#a85a30');
    p.disc(5, 7, 4, '#b8643a');
    p.disc(4, 6, 2, '#d08050');
    p.rect(2, 7, 6, 1, '#e8c47c');
    p.rect(3, 11, 4, 1, '#7a3a20');
    outline(ctx, 0, 0, 10, 12, '#2a140a');
    scene.textures.addCanvas('prop:urn', c);
  }
  // ground spike (rises out of the sand; origin bottom-centre): 8×22
  {
    const { c, ctx } = makeCanvas(8, 22);
    const p = new Pix(ctx);
    for (let y = 0; y < 22; y++) {
      const w = Math.max(1, Math.round((y / 22) * 6) + 1);
      const x0 = Math.floor((8 - w) / 2);
      p.rect(x0, y, w, 1, '#c8985c');
      p.px(x0, y, '#f0d090');
      if (w > 2) p.px(x0 + w - 1, y, '#7a5430');
    }
    outline(ctx, 0, 0, 8, 22, '#2a1a0a');
    scene.textures.addCanvas('gspike', c);
  }
  // pilum (thrown javelin, points right): 18×3
  {
    const { c, ctx } = makeCanvas(18, 3);
    const p = new Pix(ctx);
    p.rect(0, 1, 12, 1, '#7a5430');
    p.rect(12, 1, 5, 1, '#c8c8d0');
    p.px(17, 1, '#ffffff');
    p.px(12, 0, '#9a9aa8');
    p.px(12, 2, '#9a9aa8');
    scene.textures.addCanvas('pilum', c);
  }
}

/**
 * The Sky Reaches: a cloud tileset (same indices as 'tiles'), cloud-bank backdrops, cloud slabs for
 * the moving / dissolving platforms, the cloud portal, wind bolts and puffs.
 */
function skyArt(scene: Phaser.Scene) {
  const r = rng(131);
  // cloud tileset: 0 cloud top (bright, billowing), 1 cloud body, 2 a thin wisp (one-way)
  {
    const S = 16;
    const { c, ctx } = makeCanvas(S * 7, S);
    const p = new Pix(ctx);
    const body = (ox: number) => {
      p.rect(ox, 0, S, S, '#dce8f6');
      for (let i = 0; i < 6; i++) p.disc(ox + 2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), 2, '#cbdcf0');
      for (let i = 0; i < 5; i++) p.disc(ox + 2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), 1, '#eef4fc');
    };
    body(0);
    // billowing top edge
    for (let x = 0; x < S; x++) {
      const h = 3 + Math.round(Math.sin((x / S) * Math.PI * 2) * 1.2);
      p.rect(x, 0, 1, h, '#ffffff');
      p.px(x, h, '#eef4fc');
    }
    body(S);
    // 2: wisp – a narrow streak of cloud you can drop through
    const ox = S * 2;
    p.rect(ox, 0, S, 4, '#f4f8fe');
    p.rect(ox, 0, S, 1, '#ffffff');
    p.rect(ox, 3, S, 1, '#c8d8ec');
    p.px(ox + 3, 4, '#dce8f6');
    p.px(ox + 11, 4, '#dce8f6');
    const base = scene.textures.get('tiles').getSourceImage() as HTMLCanvasElement;
    ctx.drawImage(base, S * 3, 0, S * 4, S, S * 3, 0, S * 4, S);
    scene.textures.addCanvas('tiles-cloud', c);
  }
  // cloud banks for the backdrop (bottom-aligned, the tops billow)
  const bank = (key: string, W: number, base: number, lumps: number, body: string, lit: string, shade: string, seed: number) => {
    const H = 270;
    const { c, ctx } = makeCanvas(W, H);
    const p = new Pix(ctx);
    const rr = rng(seed);
    const blobs = Array.from({ length: lumps }, (_, i) => ({ x: (i + rr() * 0.6) * (W / lumps), r: 14 + rr() * 22 }));
    for (const b of [...blobs, ...blobs.map((b) => ({ ...b, x: b.x + W }))]) {
      for (const off of [-W, 0]) {
        const cx = b.x + off;
        const cy = H - base;
        p.disc(Math.round(cx), Math.round(cy), Math.round(b.r), body);
        p.disc(Math.round(cx - b.r * 0.25), Math.round(cy - b.r * 0.3), Math.round(b.r * 0.6), lit);
      }
    }
    p.rect(0, H - base, W, base, body);
    for (let i = 0; i < W / 5; i++) p.rect(Math.floor(rr() * W), H - base + 4 + Math.floor(rr() * (base - 6)), 6, 1, shade);
    scene.textures.addCanvas(key, c);
  };
  bank('bg-clouds-far', 512, 120, 14, '#c4d8f0', '#dce8f8', '#b0c8e6', 141);
  bank('bg-clouds-near', 512, 70, 9, '#e8f0fa', '#ffffff', '#d0e0f2', 142);
  // a slab of cloud for moving platforms (stretched by width)
  {
    const { c, ctx } = makeCanvas(16, 8);
    const p = new Pix(ctx);
    p.rect(0, 1, 16, 6, '#e8f0fa');
    p.rect(0, 0, 16, 2, '#ffffff');
    p.rect(0, 6, 16, 2, '#c8d8ec');
    p.disc(4, 3, 2, '#ffffff');
    p.disc(12, 3, 2, '#f4f8fe');
    scene.textures.addCanvas('mover-cloud', c);
  }
  // a thin cloud that dissolves under you
  {
    const { c, ctx } = makeCanvas(16, 6);
    const p = new Pix(ctx);
    p.rect(0, 1, 16, 4, '#f0f4fa');
    p.rect(0, 0, 16, 1, '#ffffff');
    p.rect(0, 4, 16, 2, '#d4e0ee');
    for (let i = 0; i < 4; i++) p.px(2 + i * 4, 5, '#ffffff');
    scene.textures.addCanvas('crumble-cloud', c);
  }
  // the cloud portal: 3 frames like the door (closed / open / sealed), a ring of cloud around a bright eye
  {
    const FW = 26;
    const FH = 40;
    const { c, ctx } = makeCanvas(FW * 3, FH);
    const p = new Pix(ctx);
    ['closed', 'open', 'sealed'].forEach((kind, f) => {
      const ox = f * FW;
      const cx = ox + 13;
      const cy = 22;
      for (let a = 0; a < 18; a++) {
        const t = (a / 18) * Math.PI * 2;
        p.disc(Math.round(cx + Math.cos(t) * 9), Math.round(cy + Math.sin(t) * 13), 3, '#e8f0fa');
      }
      for (let a = 0; a < 18; a++) {
        const t = (a / 18) * Math.PI * 2 + 0.2;
        p.disc(Math.round(cx + Math.cos(t) * 8), Math.round(cy + Math.sin(t) * 12) - 1, 2, '#ffffff');
      }
      const inner = kind === 'open' ? '#8ad0ff' : '#9aa8bc';
      for (let y = -10; y <= 10; y++)
        for (let x = -6; x <= 6; x++) if ((x * x) / 36 + (y * y) / 100 <= 1) p.px(cx + x, cy + y, inner);
      if (kind === 'open') {
        for (let y = -7; y <= 7; y++) for (let x = -3; x <= 3; x++) if ((x * x) / 9 + (y * y) / 49 <= 1) p.px(cx + x, cy + y, '#e8f8ff');
        // a spiral streak
        for (let k = 0; k < 14; k++) {
          const t = k * 0.5;
          p.px(Math.round(cx + Math.cos(t) * (k * 0.4)), Math.round(cy + Math.sin(t) * (k * 0.6)), '#ffffff');
        }
      }
    });
    const tex = scene.textures.addCanvas('portal', c)!;
    ['closed', 'open', 'sealed'].forEach((n, i) => tex.add(n, 0, i * FW, 0, FW, FH));
  }
  // wind bolt (points right) and a cloud puff projectile
  {
    const { c, ctx } = makeCanvas(12, 5);
    const p = new Pix(ctx);
    p.rect(0, 2, 12, 1, '#ffffff');
    p.rect(3, 1, 7, 3, '#c8e4ff');
    p.rect(5, 2, 6, 1, '#ffffff');
    p.px(1, 1, '#c8e4ff');
    p.px(2, 3, '#c8e4ff');
    scene.textures.addCanvas('windbolt', c);
  }
  {
    const { c, ctx } = makeCanvas(11, 11);
    const p = new Pix(ctx);
    p.disc(5, 5, 5, '#b8d0ec');
    p.disc(5, 5, 4, '#e8f0fa');
    p.disc(4, 4, 2, '#ffffff');
    scene.textures.addCanvas('puff', c);
  }
}

/**
 * The Weeping Shrine: a tileset of mossy stone pavers and dark temple wood, night backdrops (temple roofs,
 * bamboo), paper and stone lanterns, a torii gate, bamboo, hair bursting from the floor, spirit fire and
 * a soft shadow for Ayame (only the real one casts it).
 */
function shrineArt(scene: Phaser.Scene) {
  const r = rng(171);
  {
    const S = 16;
    const { c, ctx } = makeCanvas(S * 7, S);
    const p = new Pix(ctx);
    const pavers = (ox: number) => {
      p.rect(ox, 0, S, S, '#3e4256');
      p.rect(ox, 7, S, 1, '#262838');
      p.rect(ox, 15, S, 1, '#262838');
      p.rect(ox + 5, 0, 1, 7, '#262838');
      p.rect(ox + 12, 8, 1, 7, '#262838');
      p.rect(ox, 0, S, 1, '#565a72');
      p.rect(ox, 8, S, 1, '#4c5068');
      for (let i = 0; i < 8; i++) p.px(ox + Math.floor(r() * S), Math.floor(r() * S), r() > 0.5 ? '#4a4e64' : '#32354a');
    };
    pavers(0);
    // moss creeping over the top edge
    for (let x = 0; x < S; x++) {
      if (r() > 0.45) p.px(x, 0, '#4e6a48');
      if (r() > 0.7) p.px(x, 1, '#3a5236');
    }
    pavers(S);
    // 2: a dark lacquered plank (bridges, walkways)
    const ox = S * 2;
    p.rect(ox, 0, S, 4, '#5a2a26');
    p.rect(ox, 0, S, 1, '#8a3c32');
    p.rect(ox, 3, S, 1, '#341614');
    p.rect(ox + 2, 4, 2, 5, '#3e1c18');
    p.rect(ox + 12, 4, 2, 5, '#3e1c18');
    const base = scene.textures.get('tiles').getSourceImage() as HTMLCanvasElement;
    ctx.drawImage(base, S * 3, 0, S * 4, S, S * 3, 0, S * 4, S);
    scene.textures.addCanvas('tiles-shrine', c);
  }
  // far temple roofs: curved eaves in silhouette
  {
    const W = 512;
    const H = 270;
    const { c, ctx } = makeCanvas(W, H);
    const p = new Pix(ctx);
    const col = '#1a1c30';
    p.rect(0, H - 60, W, 60, col);
    for (const [x0, w, h] of [[30, 90, 70], [170, 120, 95], [330, 80, 60], [430, 70, 80]] as const) {
      const top = H - 60 - h;
      p.rect(x0 + 10, top + 18, w - 20, h - 18, col);
      // the eave: a long roof that sweeps up at both tips
      for (let x = -12; x < w + 12; x++) {
        const u = (x + 12) / (w + 24);
        const lift = Math.round(Math.pow(Math.abs(u - 0.5) * 2, 3) * 8);
        p.rect(x0 + x, top + 10 - lift, 1, 8 + lift, col);
      }
      p.rect(x0 + w / 2 - 6, top, 12, 12, col);
      // a lit window or two
      p.rect(x0 + 20, top + 30, 6, 8, '#e8b860');
      if (w > 85) p.rect(x0 + w - 28, top + 34, 6, 8, '#c89040');
    }
    scene.textures.addCanvas('bg-shrine-roofs', c);
  }
  // nearer bamboo stalks
  {
    const W = 512;
    const H = 270;
    const { c, ctx } = makeCanvas(W, H);
    const p = new Pix(ctx);
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(r() * W);
      const w = 3 + Math.floor(r() * 3);
      const top = 20 + Math.floor(r() * 80);
      const col = r() > 0.5 ? '#16241e' : '#1c2c24';
      p.rect(x, top, w, H - top, col);
      for (let y = top + 10; y < H; y += 14 + Math.floor(r() * 6)) p.rect(x - 1, y, w + 2, 1, '#0e1814');
      // a few leaves
      for (let k = 0; k < 3; k++) {
        const ly = top + Math.floor(r() * 60);
        const dir = r() > 0.5 ? 1 : -1;
        p.line(x + w / 2, ly, x + w / 2 + dir * 10, ly + 4, '#1e3428');
      }
    }
    scene.textures.addCanvas('bg-bamboo', c);
  }
  // props (drawn at in-game size)
  {
    const { c, ctx } = makeCanvas(10, 16);
    const p = new Pix(ctx);
    p.rect(4, 0, 2, 2, '#2a1a14');
    p.disc(5, 8, 5, '#c84a30');
    p.disc(5, 8, 4, '#f08848');
    p.disc(5, 7, 2, '#ffd890');
    p.rect(1, 6, 8, 1, '#9a3020');
    p.rect(1, 10, 8, 1, '#9a3020');
    p.rect(3, 13, 4, 2, '#2a1a14');
    outline(ctx, 0, 0, 10, 16, '#140a08');
    scene.textures.addCanvas('prop:paperlantern', c);
  }
  {
    const { c, ctx } = makeCanvas(12, 18);
    const p = new Pix(ctx);
    p.rect(1, 0, 10, 3, '#6a6e80');
    p.rect(0, 2, 12, 1, '#565a6c');
    p.rect(2, 3, 8, 6, '#585c70');
    p.rect(4, 4, 4, 4, '#ffcf70');
    p.rect(4, 9, 4, 6, '#4c5064');
    p.rect(2, 15, 8, 3, '#5a5e72');
    outline(ctx, 0, 0, 12, 18, '#14141e');
    scene.textures.addCanvas('prop:stonelantern', c);
  }
  {
    const { c, ctx } = makeCanvas(40, 34);
    const p = new Pix(ctx);
    const red = '#a82a22';
    p.rect(0, 2, 40, 3, red);
    p.rect(0, 1, 3, 1, red);
    p.rect(37, 1, 3, 1, red);
    p.rect(0, 0, 2, 1, red);
    p.rect(38, 0, 2, 1, red);
    p.rect(0, 2, 40, 1, '#202020');
    p.rect(3, 8, 34, 2, red);
    p.rect(18, 5, 4, 3, red);
    p.rect(6, 5, 3, 29, red);
    p.rect(31, 5, 3, 29, red);
    p.rect(6, 31, 3, 3, '#202020');
    p.rect(31, 31, 3, 3, '#202020');
    outline(ctx, 0, 0, 40, 34, '#140808');
    scene.textures.addCanvas('prop:torii', c);
  }
  {
    const { c, ctx } = makeCanvas(12, 30);
    const p = new Pix(ctx);
    for (const [x, top] of [[2, 0], [7, 6]]) {
      p.rect(x, top, 3, 30 - top, '#4a7a3a');
      p.rect(x, top, 1, 30 - top, '#6a9a4a');
      for (let y = top + 6; y < 30; y += 7) p.rect(x, y, 3, 1, '#2e4e24');
    }
    p.line(3, 4, 0, 8, '#4a7a3a');
    p.line(9, 10, 11, 14, '#4a7a3a');
    outline(ctx, 0, 0, 12, 30, '#0e1a0c');
    scene.textures.addCanvas('prop:bamboo', c);
  }
  // hair lashing up from the floor (origin bottom-centre): 8×24
  {
    const { c, ctx } = makeCanvas(8, 24);
    const p = new Pix(ctx);
    for (let k = 0; k < 3; k++) {
      for (let y = 0; y < 24; y++) {
        const x = Math.round(3 + k - 1 + Math.sin(y * 0.5 + k * 2) * (1 + (24 - y) / 12));
        p.px(x, y, y < 3 ? '#4a3a5a' : k === 1 ? '#2a2234' : '#16121e');
      }
    }
    scene.textures.addCanvas('hairspike', c);
  }
  // spirit fire: a pale blue flame (points right)
  {
    const { c, ctx } = makeCanvas(10, 8);
    const p = new Pix(ctx);
    p.disc(6, 4, 3, '#6aa8ff');
    p.disc(6, 4, 2, '#c8e4ff');
    p.rect(1, 3, 4, 2, '#6aa8ff');
    p.px(0, 4, '#3a70d0');
    p.px(7, 4, '#ffffff');
    scene.textures.addCanvas('spiritfire', c);
  }
  // a soft shadow ellipse
  {
    const { c, ctx } = makeCanvas(28, 6);
    const g = ctx.createRadialGradient(14, 3, 0, 14, 3, 14);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.scale(1, 6 / 28);
    ctx.fillRect(0, 0, 28, 28);
    ctx.restore();
    scene.textures.addCanvas('shadow', c);
  }
}

/** Icicles, ice shards, snowflakes and a pale backdrop haze for the Frostbound Cloister. */
function frostArt(scene: Phaser.Scene) {
  // hanging icicle (origin top-centre in game): 7×16 tapering spike
  {
    const { c, ctx } = makeCanvas(7, 16);
    const p = new Pix(ctx);
    for (let y = 0; y < 16; y++) {
      const w = Math.max(1, Math.round(7 * (1 - y / 16)));
      const x0 = Math.floor((7 - w) / 2);
      p.rect(x0, y, w, 1, '#8ac0e8');
      if (w > 2) p.px(x0, y, '#e8f8ff');
      if (w > 3) p.px(x0 + w - 1, y, '#5a88b8');
    }
    p.rect(1, 0, 5, 2, '#c8e8ff');
    outline(ctx, 0, 0, 7, 16, '#14202e');
    scene.textures.addCanvas('icicle', c);
  }
  // ice shard projectile (points right): 10×5
  {
    const { c, ctx } = makeCanvas(10, 5);
    const p = new Pix(ctx);
    p.rect(0, 2, 10, 1, '#d8f4ff');
    p.rect(1, 1, 6, 3, '#8ac0e8');
    p.rect(2, 2, 6, 1, '#ffffff');
    p.px(9, 2, '#ffffff');
    scene.textures.addCanvas('shard', c);
  }
}

/** Bog sheen, toxic glob, low mire wave and rotten planks for the Rotting Mire. */
function mireArt(scene: Phaser.Scene) {
  // bog surface strip (tiles horizontally, scrolled in-game): a scummy sheen with bubbles
  {
    const W = 64;
    const H = 6;
    const { c, ctx } = makeCanvas(W, H);
    const p = new Pix(ctx);
    for (let x = 0; x < W; x++) {
      const h = 2 + Math.round(Math.sin((x / W) * Math.PI * 4) * 0.8 + 0.6);
      p.rect(x, H - h, 1, h, '#4a6a2a');
      p.px(x, H - h, '#7a9a3e');
    }
    for (let i = 0; i < 5; i++) p.disc(5 + i * 13, H - 3, 1, '#a8c860');
    scene.textures.addCanvas('bog-surface', c);
  }
  // toxic glob
  {
    const { c, ctx } = makeCanvas(9, 9);
    const p = new Pix(ctx);
    p.disc(4, 4, 4, '#3a6a1e');
    p.disc(4, 4, 3, '#7ac040');
    p.disc(3, 3, 1, '#d8ff9a');
    scene.textures.addCanvas('toxglob', c);
  }
  // low mire wave: 2 frames 18×22 – low enough to jump over
  {
    const FW = 18;
    const FH = 22;
    const { c, ctx } = makeCanvas(FW * 2, FH);
    const p = new Pix(ctx);
    for (let f = 0; f < 2; f++) {
      const ox = f * FW;
      const r = rng(80 + f);
      for (let x = 0; x < FW; x++) {
        const h = Math.round(Math.sin((x / (FW - 1)) * Math.PI) * 17 + 3 + r() * 3);
        p.rect(ox + x, FH - h, 1, h, '#24361a');
        p.rect(ox + x, FH - Math.round(h * 0.8), 1, Math.round(h * 0.8), '#3e5e22');
        p.rect(ox + x, FH - Math.round(h * 0.45), 1, Math.round(h * 0.45), '#6a9a34');
        p.px(ox + x, FH - h, '#a8d060');
      }
    }
    const tex = scene.textures.addCanvas('bog-wave', c)!;
    tex.add('w0', 0, 0, 0, FW, FH);
    tex.add('w1', 0, FW, 0, FW, FH);
  }
  // rotten plank (stretched by width in game)
  {
    const { c, ctx } = makeCanvas(16, 6);
    const p = new Pix(ctx);
    p.rect(0, 0, 16, 4, '#4a3a24');
    p.rect(0, 0, 16, 1, '#6a5434');
    p.rect(0, 3, 16, 1, '#2a2016');
    p.px(4, 1, '#2a3a1a');
    p.px(5, 2, '#3a5a22');
    p.px(11, 1, '#2a2016');
    p.rect(2, 4, 2, 2, '#3a2c1c');
    p.rect(12, 4, 2, 2, '#3a2c1c');
    scene.textures.addCanvas('crumble', c);
  }
}

/** Far cave wall: irregular stone blocks, cracks and stalactites. Tiles horizontally (256 px). */
function caveFar(scene: Phaser.Scene) {
  const W = 256;
  const H = 270;
  const { c, ctx } = makeCanvas(W, H);
  const p = new Pix(ctx);
  const r = rng(77);
  p.rect(0, 0, W, H, '#26222d');
  // stones: wrapped horizontally so the texture tiles seamlessly
  const tones = ['#2e2a36', '#332e3c', '#2a2631', '#383241', '#2c2834'];
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * H);
    const rad = 3 + Math.floor(r() * 9);
    const col = tones[Math.floor(r() * tones.length)];
    for (const ox of [0, -W, W]) {
      p.disc(x + ox, y, rad, col);
      p.disc(x + ox - 1, y - 1, Math.max(1, rad - 3), '#3d3747');
    }
  }
  // cracks
  for (let i = 0; i < 26; i++) {
    let x = Math.floor(r() * W);
    let y = Math.floor(r() * H);
    for (let k = 0; k < 12; k++) {
      const nx = x + Math.floor(r() * 7) - 3;
      const ny = y + 2 + Math.floor(r() * 4);
      p.line(x, y, nx, ny, '#18151d');
      x = ((nx % W) + W) % W;
      y = ny;
    }
  }
  // stalactites hanging from the top
  for (let x = 4; x < W; x += 9 + Math.floor(r() * 14)) {
    const len = 8 + Math.floor(r() * 30);
    for (let k = 0; k < len; k++) {
      const w = Math.max(1, Math.round((1 - k / len) * 5));
      p.rect(x - Math.floor(w / 2), k, w, 1, k < len * 0.3 ? '#1d1a23' : '#2f2a37');
    }
    p.px(x, len, '#4a4456');
  }
  scene.textures.addCanvas('bg-cave-far', c);
}

/** Near cave layer: rock columns and stalagmites, transparent between them (512 px). */
function caveNear(scene: Phaser.Scene) {
  const W = 512;
  const H = 270;
  const { c, ctx } = makeCanvas(W, H);
  const p = new Pix(ctx);
  const r = rng(91);
  const col = '#1a1720';
  const edge = '#2b2633';
  for (const cx of [40, 170, 300, 430]) {
    const w0 = 18 + Math.floor(r() * 16);
    for (let y = 0; y < H; y++) {
      // columns pinch in the middle like old stone pillars
      const pinch = Math.sin((y / H) * Math.PI) * (w0 * 0.35);
      const wob = Math.round(Math.sin(y * 0.21 + cx) * 2 + Math.sin(y * 0.05 + cx * 0.3) * 3);
      const w = Math.max(6, Math.round(w0 - pinch));
      p.rect(cx - w / 2 + wob, y, w, 1, col);
      p.px(cx - w / 2 + wob, y, edge);
    }
  }
  // stalagmites rising from the bottom
  for (let x = 10; x < W; x += 14 + Math.floor(r() * 26)) {
    const h = 10 + Math.floor(r() * 40);
    for (let k = 0; k < h; k++) {
      const w = Math.max(1, Math.round((1 - k / h) * 7));
      p.rect(x - Math.floor(w / 2), H - 1 - k, w, 1, col);
    }
  }
  scene.textures.addCanvas('bg-cave-near', c);
}

/** Stone archway with a wooden door. Frames: closed, open (dark passage), sealed (glowing runes). */
function door(scene: Phaser.Scene) {
  const FW = 26;
  const FH = 40;
  const { c, ctx } = makeCanvas(FW * 3, FH);
  const p = new Pix(ctx);
  ['closed', 'open', 'sealed'].forEach((kind, f) => {
    const ox = f * FW;
    // arch stones
    p.rect(ox + 1, 6, 24, 34, '#4a4658');
    p.disc(ox + 13, 13, 11, '#4a4658');
    for (let y = 8; y < FH; y += 5) {
      p.rect(ox + 1, y, 3, 1, '#2a2834');
      p.rect(ox + 22, y + 2, 3, 1, '#2a2834');
    }
    p.rect(ox + 1, 6, 1, 34, '#5c586c');
    // opening
    const inner = kind === 'open' ? '#07060a' : '#5a3c24';
    p.rect(ox + 5, 14, 16, 26, inner);
    p.disc(ox + 13, 14, 8, inner);
    p.rect(ox + 5, 22, 16, 18, inner);
    if (kind !== 'open') {
      for (let x = 7; x < 21; x += 4) p.rect(ox + x, 9, 1, 31, '#3e2a18');
      p.rect(ox + 5, 24, 16, 2, '#2a2a30');
      p.rect(ox + 5, 33, 16, 2, '#2a2a30');
      p.rect(ox + 16, 28, 2, 2, '#c0a050');
    }
    if (kind === 'sealed') {
      for (const [x, y] of [[9, 16], [13, 12], [17, 16], [11, 20], [15, 20], [13, 28]]) p.rect(ox + x, y, 2, 2, '#ffa030');
    }
  });
  outline(ctx, 0, 0, FW * 3, FH, '#110d16');
  const tex = scene.textures.addCanvas('door', c)!;
  ['closed', 'open', 'sealed'].forEach((n, i) => tex.add(n, 0, i * FW, 0, FW, FH));
}

function arrow(scene: Phaser.Scene) {
  const { c, ctx } = makeCanvas(14, 5);
  const p = new Pix(ctx);
  p.rect(2, 2, 9, 1, '#8a6a44');
  p.rect(0, 1, 2, 1, '#d8d0c0');
  p.rect(0, 3, 2, 1, '#d8d0c0');
  p.rect(11, 1, 2, 3, '#a8b0be');
  p.px(13, 2, '#e8ecf4');
  scene.textures.addCanvas('arrow', c);
}

/** Catacomb backdrop: dark brick wall with arched niches (tiles horizontally). */
function crypt(scene: Phaser.Scene) {
  const W = 256;
  const H = 270;
  const { c, ctx } = makeCanvas(W, H);
  const p = new Pix(ctx);
  p.rect(0, 0, W, H, '#100e16');
  const r = rng(21);
  for (let y = 0; y < H; y += 8) {
    const off = (y / 8) % 2 ? 6 : 0;
    p.rect(0, y, W, 1, '#0a0910');
    for (let x = off; x < W; x += 12) p.rect(x, y, 1, 8, '#0a0910');
  }
  for (let i = 0; i < 120; i++) p.px(Math.floor(r() * W), Math.floor(r() * H), '#17141f');
  for (let ax = 20; ax < W; ax += 64) {
    p.rect(ax, 120, 28, 90, '#07060a');
    p.disc(ax + 14, 120, 14, '#07060a');
    p.rect(ax - 3, 205, 34, 5, '#1a1724');
    // skull rows in the ossuary niches
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) p.rect(ax + 4 + j * 8, 150 + k * 18, 4, 3, '#2a2630');
  }
  scene.textures.addCanvas('bg-crypt', c);
}

function tiles(scene: Phaser.Scene) {
  const S = 16;
  const { c, ctx } = makeCanvas(S * 7, S);
  const p = new Pix(ctx);
  const r = rng(7);
  const stone = (ox: number) => {
    p.rect(ox, 0, S, S, '#4a4658');
    // bricks
    for (let row = 0; row < 2; row++) {
      const y = row * 8;
      p.rect(ox, y + 7, S, 1, '#2a2834');
      const off = row % 2 === 0 ? 0 : 6;
      for (let bx = off; bx < S + 6; bx += 11) p.rect(ox + ((bx % S) + S) % S, y, 1, 7, '#2a2834');
      p.rect(ox, y, S, 1, '#5c586c');
    }
    for (let i = 0; i < 10; i++) p.px(ox + Math.floor(r() * S), Math.floor(r() * S), r() > 0.5 ? '#56526a' : '#3a3746');
  };
  // 0: top (moss) stone
  stone(0);
  p.rect(0, 0, S, 3, '#3d4a2f');
  p.rect(0, 0, S, 1, '#5c6e3e');
  for (let x = 0; x < S; x++) {
    if (r() > 0.6) p.px(x, 3, '#3d4a2f');
    if (r() > 0.85) p.px(x, 4, '#2f3a24');
  }
  // 1: stone
  stone(S);
  // 2: plank (one-way)
  const ox = S * 2;
  p.rect(ox, 0, S, 4, '#6b4a2f');
  p.rect(ox, 0, S, 1, '#8c6640');
  p.rect(ox, 3, S, 1, '#3e2a1a');
  p.px(ox + 5, 1, '#3e2a1a');
  p.px(ox + 12, 2, '#3e2a1a');
  p.rect(ox + 2, 4, 2, 5, '#4a321f');
  p.rect(ox + 12, 4, 2, 5, '#4a321f');
  p.line(ox + 3, 8, ox + 12, 5, '#3e2a1a');
  // 3: spikes
  const sx = S * 3;
  p.rect(sx, 12, S, 4, '#1c1b22');
  for (let i = 0; i < 4; i++) {
    const bx = sx + i * 4;
    for (let h = 0; h < 9; h++) {
      const w = Math.max(1, Math.round(((9 - h) / 9) * 3));
      p.rect(bx + 2 - Math.floor(w / 2), 12 - h, w, 1, h > 6 ? '#d8d8e0' : '#7d7d8a');
    }
  }
  // 4: lava (molten body; the animated surface is a separate sprite)
  const lx = S * 4;
  p.rect(lx, 0, S, S, '#c8360e');
  for (let i = 0; i < 14; i++) {
    const x = lx + Math.floor(r() * S);
    const y = Math.floor(r() * S);
    p.rect(x, y, 2, 1, r() > 0.5 ? '#ff7a1a' : '#8a1e08');
  }
  p.rect(lx, 0, S, 2, '#ffb43a');
  // 5: ice – frozen stone under a glassy sheet, bright rim
  const ix = S * 5;
  p.rect(ix, 0, S, S, '#5a7090');
  for (let row = 0; row < 2; row++) {
    const y = row * 8;
    p.rect(ix, y + 7, S, 1, '#3a4a66');
    for (let bx = row ? 6 : 0; bx < S; bx += 11) p.rect(ix + bx, y, 1, 7, '#3a4a66');
  }
  p.rect(ix, 0, S, 5, '#9ac8ec');
  p.rect(ix, 0, S, 1, '#eaf8ff');
  p.rect(ix, 5, S, 1, '#6a90b8');
  for (let i = 0; i < 4; i++) p.rect(ix + 2 + i * 4, 1 + (i % 2), 2, 1, '#ffffff');
  for (let x = 0; x < S; x++) if (r() > 0.6) p.px(ix + x, 6, '#9ac8ec');
  // 6: bog – murky water over silt (the surface sheen is a separate sprite)
  const bx = S * 6;
  p.rect(bx, 0, S, S, '#1e2a16');
  p.rect(bx, 0, S, 6, '#2e3e1e');
  for (let i = 0; i < 12; i++) {
    const x = bx + Math.floor(r() * S);
    const y = Math.floor(r() * S);
    p.rect(x, y, 2, 1, r() > 0.5 ? '#3a5022' : '#141c0e');
  }
  scene.textures.addCanvas('tiles', c);
}

function sky(scene: Phaser.Scene) {
  const W = 256;
  const H = 270;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07060c');
  g.addColorStop(0.55, '#221a32');
  g.addColorStop(1, '#4a2c3c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const p = new Pix(ctx);
  const r = rng(3);
  for (let i = 0; i < 70; i++) p.px(Math.floor(r() * W), Math.floor(r() * H * 0.6), r() > 0.8 ? '#d8d4ff' : '#6a6488');
  scene.textures.addCanvas('bg-sky', c);
  // moon
  const m = makeCanvas(40, 40);
  const mp = new Pix(m.ctx);
  mp.disc(20, 20, 15, '#e8dcc4');
  mp.disc(25, 16, 12, '#00000000');
  m.ctx.globalCompositeOperation = 'destination-out';
  mp.disc(27, 15, 12, '#000');
  m.ctx.globalCompositeOperation = 'source-over';
  scene.textures.addCanvas('moon', m.c);
}

/** Seamless silhouettes made from sines with integer periods over the width. */
function silhouette(W: number, H: number, base: number, amps: [number, number][], col: string) {
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = col;
  for (let x = 0; x < W; x++) {
    let h = base;
    for (const [period, amp] of amps) h += Math.sin((x / W) * Math.PI * 2 * period + period) * amp;
    ctx.fillRect(x, Math.round(H - h), 1, Math.ceil(h));
  }
  return { c, ctx };
}

function mountains(scene: Phaser.Scene) {
  const { c } = silhouette(512, 270, 95, [[2, 30], [5, 14], [11, 6], [23, 2]], '#271f35');
  scene.textures.addCanvas('bg-mount', c);
}

function ruins(scene: Phaser.Scene) {
  const W = 512;
  const H = 270;
  const { c, ctx } = silhouette(W, H, 55, [[3, 8], [7, 4]], '#1a1424');
  const p = new Pix(ctx);
  const col = '#1a1424';
  const r = rng(11);
  const towers = [40, 130, 175, 300, 420, 470];
  for (const tx of towers) {
    const th = 70 + Math.floor(r() * 70);
    const tw = 14 + Math.floor(r() * 12);
    p.rect(tx, H - 55 - th, tw, th + 10, col);
    for (let i = 0; i < tw; i += 4) p.rect(tx + i, H - 55 - th - 4, 2, 4, col);
    if (r() > 0.4) {
      p.rect(tx + tw / 2 - 2, H - 55 - th - 22, 4, 18, col);
      p.rect(tx + tw / 2 - 5, H - 55 - th - 14, 10, 2, col);
    }
    p.rect(tx + 4, H - 55 - th + 12, 2, 5, '#3a2a30');
  }
  // broken arches
  for (let ax = 220; ax < 290; ax += 22) {
    p.rect(ax, H - 110, 4, 60, col);
    for (let t = 0; t <= 10; t++) p.rect(ax + t * 2, H - 110 - Math.sin((t / 10) * Math.PI) * 10, 3, 3, col);
  }
  scene.textures.addCanvas('bg-ruins', c);
}

function fogBands(scene: Phaser.Scene) {
  const W = 512;
  const H = 270;
  const { c, ctx } = makeCanvas(W, H);
  for (let x = 0; x < W; x++) {
    const h = 40 + Math.sin((x / W) * Math.PI * 4) * 10 + Math.sin((x / W) * Math.PI * 10) * 5;
    const g = ctx.createLinearGradient(0, H - h - 20, 0, H);
    g.addColorStop(0, 'rgba(120,110,140,0)');
    g.addColorStop(1, 'rgba(120,110,140,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(x, H - h - 20, 1, h + 20);
  }
  scene.textures.addCanvas('bg-fog', c);
}

function bonfire(scene: Phaser.Scene) {
  const FW = 24;
  const FH = 32;
  const { c, ctx } = makeCanvas(FW * 5, FH);
  const p = new Pix(ctx);
  for (let f = 0; f < 5; f++) {
    const ox = f * FW;
    // ash mound + stones
    p.rect(ox + 4, FH - 4, 16, 4, '#3a3634');
    p.rect(ox + 6, FH - 6, 12, 2, '#57514c');
    p.rect(ox + 3, FH - 3, 3, 3, '#4a4644');
    p.rect(ox + 18, FH - 3, 3, 3, '#4a4644');
    // coiled sword
    p.rect(ox + 11, FH - 22, 2, 17, '#9a9aa6');
    p.rect(ox + 11, FH - 22, 1, 17, '#c8c8d4');
    p.rect(ox + 9, FH - 23, 6, 1, '#6b4a2f');
    p.rect(ox + 11, FH - 27, 2, 4, '#4a321f');
    for (let i = 0; i < 4; i++) p.px(ox + (i % 2 ? 13 : 10), FH - 8 - i * 3, '#6b4a2f');
    if (f === 0) continue;
    // flames
    const r = rng(f * 13);
    const cols = ['#ff6a1a', '#ffa030', '#ffd27a'];
    for (let layer = 0; layer < 3; layer++) {
      const w = 9 - layer * 3;
      const h = 13 - layer * 4 + Math.floor(r() * 3);
      for (let y = 0; y < h; y++) {
        const ww = Math.max(1, Math.round(w * (1 - y / h)));
        const sway = Math.round(Math.sin(f * 1.7 + y * 0.6) * (y / h) * 2);
        p.rect(ox + 12 - Math.floor(ww / 2) + sway, FH - 6 - y, ww, 1, cols[layer]);
      }
    }
  }
  const tex = scene.textures.addCanvas('bonfire', c)!;
  for (let f = 0; f < 5; f++) tex.add(`f${f}`, 0, f * FW, 0, FW, FH);
}

/** Soft white radial brush used to erase light holes out of the darkness layer. */
function lightBrush(scene: Phaser.Scene) {
  const S = 128;
  const { c, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.2)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  scene.textures.addCanvas('light', c);
}

function glow(scene: Phaser.Scene, key: string, size: number, rgb: [number, number, number]) {
  const { c, ctx } = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb.join(',')},0.9)`);
  g.addColorStop(0.35, `rgba(${rgb.join(',')},0.35)`);
  g.addColorStop(1, `rgba(${rgb.join(',')},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  scene.textures.addCanvas(key, c);
}

function small(scene: Phaser.Scene) {
  const px = makeCanvas(2, 2);
  px.ctx.fillStyle = '#fff';
  px.ctx.fillRect(0, 0, 2, 2);
  scene.textures.addCanvas('px', px.c);

  const sp = makeCanvas(3, 3);
  const spp = new Pix(sp.ctx);
  spp.rect(1, 0, 1, 3, '#fff');
  spp.rect(0, 1, 3, 1, '#fff');
  scene.textures.addCanvas('spark', sp.c);

  // soul wisp
  const w = makeCanvas(8, 8);
  const wp = new Pix(w.ctx);
  wp.disc(4, 4, 3, '#8fd8ff');
  wp.disc(4, 4, 1, '#ffffff');
  scene.textures.addCanvas('wisp', w.c);

  // bloodstain / item glow core
  const b = makeCanvas(10, 10);
  const bp = new Pix(b.ctx);
  bp.disc(5, 5, 4, '#3ad06a');
  bp.disc(5, 5, 2, '#d8ffe0');
  outline(b.ctx, 0, 0, 10, 10, '#0b2a14');
  scene.textures.addCanvas('stain', b.c);
}

function fogWall(scene: Phaser.Scene) {
  const W = 20;
  const H = 64;
  const { c, ctx } = makeCanvas(W, H);
  const r = rng(5);
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(r() * W);
    const y = Math.floor(r() * H);
    const s = 1 + Math.floor(r() * 3);
    ctx.fillStyle = `rgba(220,215,235,${0.15 + r() * 0.35})`;
    ctx.fillRect(x, y, s, s * 2);
  }
  scene.textures.addCanvas('fogwall', c);
}

function shockwave(scene: Phaser.Scene) {
  const FW = 16;
  const FH = 20;
  const { c, ctx } = makeCanvas(FW * 2, FH);
  const p = new Pix(ctx);
  for (let f = 0; f < 2; f++) {
    const ox = f * FW;
    const r = rng(40 + f);
    for (let x = 0; x < FW; x++) {
      const h = Math.round((x / FW) * 14 + r() * 5);
      p.rect(ox + x, FH - h, 1, h, '#ff6a1a');
      p.rect(ox + x, FH - Math.round(h * 0.6), 1, Math.round(h * 0.6), '#ffa030');
      p.rect(ox + x, FH - Math.round(h * 0.25), 1, Math.round(h * 0.25), '#ffe8a0');
    }
  }
  const tex = scene.textures.addCanvas('wave', c)!;
  tex.add('w0', 0, 0, 0, FW, FH);
  tex.add('w1', 0, FW, 0, FW, FH);
}
