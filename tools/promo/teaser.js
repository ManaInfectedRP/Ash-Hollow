// The teaser: ~45 s of shots, recorded through director.js. run(D) from the game page.
export async function run(D, only = null) {
  const { shot, goto, equip, move, walk, tap, fighter, text, logo, bossBar, youDied, fade, scene, steps, cue, st, X, W, H } = D;
  const want = (n) => !only || only.includes(n);
  const blackIn = (i, n = 14) => i < n && blk(1 - i / n);
  const blackOut = (i, total, n = 14) => i > total - n && blk((i - (total - n)) / n);
  function blk(a) {
    X.save();
    X.globalAlpha = Math.max(0, Math.min(1, a));
    X.fillStyle = '#000';
    X.fillRect(0, 0, W, H);
    X.restore();
  }
  const teleport = (x, y) => {
    const p = scene().player;
    p.sprite.setPosition(x, y);
    p.body.reset(x, y);
  };
  const KNIGHT = { armor: 'knight_armor', shield: 'kite_shield' };

  // 1 + 2 ── night in the Hollow, then the first fight (one continuous take)
  if (want(1)) {
    equip({ weapon: 'longsword', ...KNIGHT });
    goto('hollow', 200, 352, 60);
    scene().player.facing = 1;
    st.zoom = 1.25;
    await shot('intro', 120, {
      each: (k) => walk(k > 40 ? 0.5 : 0),
      draw: (x, i, n) => {
        text('The last fire is fading.', { y: 230, size: 60, a: Math.min(fade(i - 24, n - 24, 24, 20), 1) });
        blackIn(i, 30);
      },
    });
    const f = fighter({ rate: 24, reach: 26, range: 500, walk: 0.6 });
    st.zoom = 1.5;
    await shot('hollow-fight', 130, { each: () => f(), draw: (x, i, n) => blackOut(i, n, 8) });
  }

  // 3 ── a flame blade in the catacombs dark
  if (want(3)) {
    equip({ weapon: 'flame_longsword', ...KNIGHT });
    goto('catacombs', 360, 352, 40);
    scene().player.facing = 1;
    const f = fighter({ rate: 26, heavy: 0.3, reach: 28, range: 500, walk: 0.6 });
    st.zoom = 1.5;
    st.bright = 1.35;
    await shot('flame', 120, {
      each: () => f(),
      draw: (x, i, n) => {
        blackIn(i, 8);
        text('Light the dark.', { y: 200, size: 52, a: fade(i - 30, n - 30, 16, 14) });
        blackOut(i, n, 8);
      },
    });
  }

  // 4 ── frost: the ghoul shatters
  if (want(4)) {
    equip({ weapon: 'frost_greataxe', ...KNIGHT });
    goto('catacombs', 880, 336, 40);
    scene().player.facing = 1;
    const f = fighter({ rate: 34, reach: 30 });
    let lowered = false;
    st.zoom = 1.5;
    st.bright = 1.35;
    await shot('frost', 100, {
      each: (k) => {
        f();
        // make sure a ghoul breaks inside the shot
        if (k > 70 && !lowered) {
          const p = scene().player;
          const e = scene().enemies.filter((e) => e.alive).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
          if (e && Math.abs(e.x - p.x) < 40) {
            e.hp = 1;
            lowered = true;
          }
        }
      },
      draw: (x, i, n) => {
        blackIn(i, 8);
        blackOut(i, n, 10);
      },
    });
  }

  // 5 ── card
  if (want(5)) {
    st.bright = 1;
    cue('clang', 0.5, 0.6);
    await shot('card-death', 66, {
      game: false,
      draw: (x, i, n) => text('Every death is a lesson.', { size: 64, a: fade(i, n, 14, 14) }),
    });
  }

  // 6 ── the Ashen Warden
  if (want(6)) {
    equip({ weapon: 'longsword', ...KNIGHT });
    goto('hollow', 2960, 272, 30);
    st.pair = true;
    scene().player.facing = 1;
    const f = fighter({ rate: 22, reach: 34, rollRange: 110, rollLead: 0.24, dy: 120, range: 1000, boss: true });
    st.zoom = 1.25;
    await shot('warden', 170, {
      each: () => (scene().boss?.active ? f() : move(1)),
      draw: (x, i, n) => {
        bossBar(1);
        blackIn(i, 6);
        blackOut(i, n, 6);
      },
    });
  }

  // 7 ── the Bone Shepherd
  if (want(7)) {
    equip({ weapon: 'venom_rapier', ...KNIGHT });
    goto('ossuary', 540, 352, 30);
    scene().player.facing = 1;
    const f = fighter({ rate: 18, reach: 34, rollRange: 110, dy: 120, range: 1000, boss: true });
    let forced = false;
    st.zoom = 1.25;
    st.bright = 1.35;
    await shot('shepherd', 140, {
      each: (k) => {
        const b = scene().boss;
        if (!b?.active) return move(1);
        if (k > 60 && !forced && !b.atk) {
          forced = true;
          b.startAttack(b.cfg.attacks.rain);
        }
        f();
      },
      draw: (x, i, n) => {
        bossBar(1);
        blackIn(i, 6);
        blackOut(i, n, 6);
      },
    });
  }

  // 8 ── the Molten Depths: riding the ferry over lava
  if (want(8)) {
    equip({ weapon: 'flame_greataxe', armor: 'ember_robes', shield: 'obsidian_shield' });
    const gs = goto('depths', 104, 384, 10);
    const m = gs.movers[0];
    teleport(m.body.center.x, m.body.top - 1);
    gs.player.facing = 1;
    steps(40);
    st.bright = 1;
    st.pair = false;
    st.zoom = 1.25;
    await shot('depths', 115, {
      each: () => move(0),
      draw: (x, i, n) => {
        blackIn(i, 8);
        text('Descend.', { y: 210, size: 64, a: fade(i - 20, n - 20, 16, 14) });
        blackOut(i, n, 8);
      },
    });
  }

  // 9 + 10 ── the Molten Colossus: the arena falls into the lava… and you die
  if (want(9)) {
    equip({ weapon: 'frost_longsword', armor: 'ember_robes', shield: 'obsidian_shield' });
    goto('depths', 2740, 288, 30);
    st.pair = true;
    scene().player.facing = 1;
    const f = fighter({ rate: 24, reach: 40, rollRange: 140, rollLead: 0.3, dy: 140, range: 1000, boss: true });
    let collapsed = false;
    st.zoom = 1.25;
    st.bright = 1.2;
    await shot('colossus', 220, {
      each: (k) => {
        const gs = scene();
        if (!gs.boss?.active) return move(1);
        if (k > 150 && !collapsed) {
          collapsed = true;
          gs.debugBossHp(0.42);
        }
        f();
      },
      draw: (x, i, n) => {
        bossBar(1);
        blackIn(i, 6);
      },
    });
    // death
    const dbg = await import(location.origin + '/src/game/debugState.ts');
    dbg.debugState.god = false;
    let diedAt = -1;
    const p = () => scene().player;
    const g = fighter({ rate: 24, reach: 40, roll: false, dy: 140, range: 1000, boss: true });
    await shot('death', 130, {
      each: (k, i) => {
        if (diedAt < 0 && p().state === 'dead') {
          diedAt = i;
          cue('die', 0.7);
        }
        if (diedAt < 0) {
          g();
          if (k === 2) p().hp = Math.min(p().hp, 20);
          if (k === 70) p().takeDamage(999, 1, 120, 99, { blockable: false });
        } else move(0);
      },
      draw: (x, i, n) => {
        if (diedAt < 0) bossBar(1);
        else {
          youDied(Math.min(1, (i - diedAt - 6) / 22));
        }
        blackOut(i, n, 14);
      },
    });
    dbg.debugState.god = true;
    st.bright = 1;
  }

  // 11 ── title
  if (want(11)) {
    equip({ weapon: 'longsword', ...KNIGHT });
    goto('hollow', 180, 352, 60);
    scene().player.facing = -1;
    st.dim = 0.4;
    cue('fire', 0.7, 0.8);
    st.pair = false;
    st.zoom = 1;
    await shot('logo', 180, {
      each: () => move(0),
      draw: (x, i, n) => {
        blackIn(i, 24);
        logo(fade(i - 10, n - 10, 30, 22), H * 0.4);
        text('rest, and rise again', { y: H * 0.56, size: 34, weight: 500, italic: true, spacing: 0.04, font: 'Georgia', color: '#c8b48a', a: fade(i - 45, n - 45, 24, 22) });
        text('Coming soon to Android', { y: H * 0.8, size: 30, weight: 500, spacing: 0.2, color: '#a89878', a: fade(i - 75, n - 75, 24, 22) });
        blackOut(i, n, 22);
      },
    });
    st.dim = 1;
  }
  await D.flush();
  return st.shots;
}
