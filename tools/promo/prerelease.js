// The pre-release teaser: ~60 s across the new zones and bosses, ending on the title and a QR code.
// Record from the game page (see README):  const P = await import('http://127.0.0.1:5199/prerelease.js');
//   D.st.dir = 'prerelease'; await P.run(D);
// Shot names 'card-death', 'death' and 'logo' are the music cues mix.mjs looks for.
const SITE = 'unseenworldsunveiled.com/games/ash-and-hollow';
const BOSS_FLAGS = [
  'bossDefeated', 'shepherdDefeated', 'colossusDefeated', 'matriarchDefeated', 'motherDefeated',
  'sphinxDefeated', 'gladiatorDefeated', 'leviathanDefeated', 'ayameDefeated', 'kingDefeated',
];

/** the QR code for the outro, from the receiver (CORS-enabled, so the canvas stays exportable) */
function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = fail;
    img.src = src;
  });
}

export async function run(D, only = null) {
  const { shot, goto, equip, move, walk, fighter, text, logo, bossBar, youDied, fade, scene, steps, cue, st, X, W, H } = D;
  const want = (n) => !only || only.includes(n);
  const blk = (a) => {
    X.save();
    X.globalAlpha = Math.max(0, Math.min(1, a));
    X.fillStyle = '#000';
    X.fillRect(0, 0, W, H);
    X.restore();
  };
  const blackIn = (i, n = 10) => i < n && blk(1 - i / n);
  const blackOut = (i, total, n = 10) => i > total - n && blk((i - (total - n)) / n);
  const qr = await loadImage('http://127.0.0.1:5199/qr-site.png');

  // every boss alive again, so each arena has someone in it
  {
    const gs = scene();
    if (gs?.sys.isActive()) for (const f of BOSS_FLAGS) gs.debugSetFlag(f, false);
    else {
      const key = 'ashen-hollow-save-v1';
      const save = JSON.parse(localStorage.getItem(key) ?? '{}');
      save.flags = Object.fromEntries(Object.entries(save.flags ?? {}).filter(([k]) => !BOSS_FLAGS.includes(k)));
      save.bossDefeated = false;
      localStorage.setItem(key, JSON.stringify(save));
    }
  }
  /** walk into a boss arena: just past the fog gate (tile column), on its floor (tile row) */
  const arena = (area, col, row) => {
    const gs = goto(area, col * 16 + 8, row * 16, 30);
    gs.player.facing = 1;
    return gs;
  };
  /** a boss fight with the camera framing both, and an optional event at tick `at` */
  const bossShot = async (name, frames, o = {}) => {
    const f = fighter({ rate: 20, reach: 34, rollRange: 120, rollLead: 0.26, dy: 160, range: 1200, boss: true, ...o.fight });
    let fired = false;
    st.pair = true;
    st.zoom = o.zoom ?? 1.25;
    st.bright = o.bright ?? 1;
    await shot(name, frames, {
      each: (k) => {
        const gs = scene();
        if (!gs.boss?.active) return move(1);
        if (o.at && !fired && k >= o.at) {
          fired = true;
          o.event(gs, gs.boss);
        }
        f();
      },
      draw: (x, i, n) => {
        bossBar(1);
        o.draw?.(i, n);
        blackIn(i, 6);
        blackOut(i, n, 6);
      },
    });
  };
  /** a walk through a zone with a line of copy */
  const zoneShot = async (name, frames, line, o = {}) => {
    st.pair = false;
    st.zoom = o.zoom ?? 1.25;
    st.bright = o.bright ?? 1;
    await shot(name, frames, {
      each: (k) => (o.fight ? o.fight() : walk(k > (o.wait ?? 10) ? (o.speed ?? 0.6) : 0)),
      draw: (x, i, n) => {
        blackIn(i, 12);
        text(line, { y: 210, size: 58, a: fade(i - 18, n - 18, 18, 16) });
        blackOut(i, n, 10);
      },
    });
  };

  // 1 ── the Frostbound Cloister: snow, ice, icicles overhead
  if (want(1)) {
    equip({ weapon: 'frost_spear', armor: 'frostbound_mantle', shield: null });
    goto('cloister', 12 * 16, 24 * 16, 40);
    scene().player.facing = 1;
    await zoneShot('cloister', 110, 'Beyond the Hollow, the world goes on.', { speed: 0.55 });
  }

  // 2 ── the Frost Matriarch, the floor freezing under her
  if (want(2)) {
    arena('cloister', 191, 22);
    await bossShot('matriarch', 130, { at: 70, event: (gs) => gs.debugBossHp(0.49) });
  }

  // 3 ── the Rotting Mire: wading through poison water
  if (want(3)) {
    equip({ weapon: 'venom_longsword', armor: 'mire_leathers', shield: null });
    goto('mire', 22 * 16, 20 * 16, 30);
    scene().player.facing = 1;
    await zoneShot('mire', 100, 'Wade through rot.', { speed: 0.5 });
  }

  // 4 ── the Mire Mother
  if (want(4)) {
    arena('mire', 182, 20);
    await bossShot('mother', 120, { zoom: 1, fight: { reach: 50 } });
  }

  // 5 ── card: the boss theme hits here
  if (want(5)) {
    st.bright = 1;
    cue('clang', 0.5, 0.6);
    await shot('card-death', 60, {
      game: false,
      draw: (x, i, n) => text('Ten great souls stand in your way.', { size: 60, a: fade(i, n, 12, 12) }),
    });
  }

  // 6 ── the Sandstone Sphinx: her sandstorm rolls in
  if (want(6)) {
    equip({ weapon: 'sand_scepter', armor: 'mummy_wraps', shield: 'kite_shield' });
    arena('necropolis', 156, 24);
    await bossShot('sphinx', 120, { zoom: 1, bright: 1.25, at: 55, event: (gs) => gs.debugBossHp(0.24) });
  }

  // 7 ── Varro, the Undying Gladiator: the hunting spin
  if (want(7)) {
    equip({ weapon: 'gladiator_blades', armor: 'legion_plate', shield: null });
    arena('wastes', 344, 27);
    await bossShot('varro', 120, {
      at: 30,
      event: (gs, b) => {
        gs.debugBossHp(0.7);
        b.cooldown = 0;
        b.atk = null;
        b.startAttack(b.cfg.attacks.spin);
      },
    });
  }

  // 8 ── the Sky Reaches: islands of cloud, a drifting platform
  if (want(8)) {
    equip({ weapon: 'cloudbreaker', armor: 'white_cloak', shield: null });
    goto('sky', 8 * 16, 26 * 16, 30);
    scene().player.facing = 1;
    await zoneShot('sky', 110, 'Climb above the clouds.', { speed: 0.6 });
  }

  // 9 ── the Sky Leviathan
  if (want(9)) {
    arena('sky', 236, 24);
    await bossShot('leviathan', 130, { zoom: 1, fight: { reach: 60 } });
  }

  // 10 ── the Weeping Shrine: moonlight, bamboo, a torii gate
  if (want(10)) {
    equip({ weapon: 'bridal_knife', armor: 'white_kimono', shield: 'buckler' });
    goto('shrine', 10 * 16, 24 * 16, 30);
    scene().player.facing = 1;
    await zoneShot('shrine', 100, 'Something weeps in the dark.', { speed: 0.5, bright: 1.2 });
  }

  // 11 ── Ayame, the Weeping Bride: the lanterns go out
  if (want(11)) {
    arena('shrine', 182, 17);
    await bossShot('ayame', 140, { bright: 1.3, at: 80, event: (gs) => gs.debugBossHp(0.49) });
  }

  // 12 + 13 ── the Ashen King: his eruption… and you die
  if (want(12)) {
    equip({ weapon: 'ashen_greatsword', armor: 'ashen_regalia', shield: null });
    arena('throne', 106, 22);
    await bossShot('king', 140, {
      zoom: 1,
      bright: 1.15,
      at: 40,
      event: (gs, b) => {
        gs.debugBossHp(0.7);
        b.cooldown = 0;
        b.atk = null;
        b.startAttack(b.cfg.attacks.eruption);
      },
    });
    const dbg = await import(location.origin + '/src/game/debugState.ts');
    dbg.debugState.god = false;
    let diedAt = -1;
    const p = () => scene().player;
    const g = fighter({ rate: 24, reach: 40, roll: false, dy: 160, range: 1200, boss: true });
    await shot('death', 120, {
      each: (k, i) => {
        if (diedAt < 0 && p().state === 'dead') {
          diedAt = i;
          cue('die', 0.7);
        }
        if (diedAt < 0) {
          g();
          if (k === 2) p().hp = Math.min(p().hp, 20);
          if (k === 60) p().takeDamage(999, 1, 120, 99, { blockable: false });
        } else move(0);
      },
      draw: (x, i, n) => {
        if (diedAt < 0) bossBar(1);
        else youDied(Math.min(1, (i - diedAt - 6) / 22));
        blackOut(i, n, 14);
      },
    });
    dbg.debugState.god = true;
    st.bright = 1;
  }

  // 14 ── title: Pre-Release
  if (want(14)) {
    equip({ weapon: 'longsword', armor: 'knight_armor', shield: 'kite_shield' });
    goto('hollow', 180, 352, 60);
    scene().player.facing = -1;
    st.dim = 0.4;
    st.pair = false;
    st.zoom = 1;
    cue('fire', 0.7, 0.8);
    await shot('logo', 150, {
      each: () => move(0),
      draw: (x, i, n) => {
        blackIn(i, 24);
        logo(fade(i - 8, n + 40, 28, 1), H * 0.38);
        text('PRE-RELEASE', { y: H * 0.55, size: 46, spacing: 0.3, color: '#e8c070', a: fade(i - 36, n + 40, 22, 1) });
        text('12 zones  ·  10 bosses  ·  play it now', { y: H * 0.64, size: 32, weight: 500, spacing: 0.08, color: '#c8b48a', a: fade(i - 60, n + 40, 22, 1) });
        blackOut(i, n, 16);
      },
    });
  }

  // 15 ── outro: the QR code and the link
  if (want(15)) {
    st.dim = 0.25;
    await shot('outro', 165, {
      each: () => move(0),
      draw: (x, i, n) => {
        const a = fade(i, n, 18, 26);
        logo(a, H * 0.16, 0.55);
        // the QR on a soft parchment card
        const s = 420;
        const qx = (W - s) / 2;
        const qy = H * 0.27;
        X.save();
        X.globalAlpha = a;
        X.shadowColor = 'rgba(255,170,80,0.35)';
        X.shadowBlur = 50;
        X.fillStyle = '#f4ead8';
        X.fillRect(qx - 16, qy - 16, s + 32, s + 32);
        X.shadowBlur = 0;
        X.imageSmoothingEnabled = false;
        X.drawImage(qr, qx, qy, s, s);
        X.restore();
        text('Play the Pre-Release', { y: qy + s + 74, size: 50, a });
        text(SITE, { y: qy + s + 132, size: 34, weight: 500, spacing: 0.04, font: 'Georgia', color: '#e8dcc0', a });
        blackOut(i, n, 20);
      },
    });
    st.dim = 1;
  }
  await D.flush();
  return st.shots;
}
