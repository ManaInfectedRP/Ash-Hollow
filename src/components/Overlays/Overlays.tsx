import { useEffect, useRef, useState } from 'react';
import { EventBus } from '../../game/EventBus';
import { sfx } from '../../game/systems/Sfx';
import { levelCost, maxHpFor, maxLoadFor, maxStaminaFor, type StatKey, usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { ITEMS, MAX_UPGRADE, upgradeCost } from '../../game/data/items';
import { computeEquip } from '../../game/systems/equipment';
import { Inventory, ItemIcon } from '../Inventory/Inventory';
import { Dialogue, Shop } from '../Dialogue/Dialogue';
import { OptionsList } from '../Menu/MainMenu';
import { useGameStore } from '../../stores/gameStore';

function YouDied() {
  const dead = useGameStore((s) => s.dead);
  if (!dead) return null;
  return (
    <div className="you-died">
      <div className="you-died-band">
        <span>YOU DIED</span>
      </div>
    </div>
  );
}

function BannerView() {
  const banner = useGameStore((s) => s.banner);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!banner) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [banner]);
  if (!banner || !visible) return null;
  return (
    <div className={`banner tone-${banner.tone}`} key={banner.id}>
      <div className="banner-text">{banner.text}</div>
      {banner.sub && <div className="banner-sub">{banner.sub}</div>}
    </div>
  );
}

function Toast() {
  const toast = useGameStore((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div className="toast" key={toast.id}>
      {toast.text}
    </div>
  );
}

const STAT_ROWS: { key: StatKey; label: string; effect: string }[] = [
  { key: 'vigor', label: 'Vigor', effect: 'HP' },
  { key: 'endurance', label: 'Endurance', effect: 'Stamina · Load' },
  { key: 'strength', label: 'Strength', effect: 'Attack' },
  { key: 'dexterity', label: 'Dexterity', effect: 'Attack' },
];

function LevelUp() {
  const souls = usePlayerStore((s) => s.souls);
  const level = usePlayerStore((s) => s.level);
  const stats = usePlayerStore((s) => s.stats);
  const levelUp = usePlayerStore((s) => s.levelUp);
  const equipped = useInventoryStore((s) => s.equipped);
  const upgrades = useInventoryStore((s) => s.upgrades);
  const cost = levelCost(level);
  const eq = computeEquip(stats, equipped, upgrades);
  const effect = (k: StatKey) =>
    k === 'vigor' ? maxHpFor(stats) : k === 'endurance' ? `${maxStaminaFor(stats)} · ${maxLoadFor(stats)}` : eq.ar;
  return (
    <>
      <div className="rest-meta">
        <span>Level {level}</span>
        <span>Souls {souls.toLocaleString('sv-SE')}</span>
        <span className={souls >= cost ? 'ok' : 'no'}>Cost {cost}</span>
      </div>
      {STAT_ROWS.map((r) => (
        <div className="stat-row" key={r.key}>
          <span className="stat-name">{r.label}</span>
          <span className="stat-val">{stats[r.key]}</span>
          <span className="stat-eff">
            {r.effect} {effect(r.key)}
          </span>
          <button
            disabled={souls < cost}
            onClick={() => {
              if (levelUp(r.key)) sfx.levelUp();
            }}
          >
            +
          </button>
        </div>
      ))}
    </>
  );
}

function Upgrade() {
  const souls = usePlayerStore((s) => s.souls);
  const stats = usePlayerStore((s) => s.stats);
  const items = useInventoryStore((s) => s.items);
  const upgrades = useInventoryStore((s) => s.upgrades);
  const upgradeWeapon = useInventoryStore((s) => s.upgradeWeapon);
  const weapons = Object.keys(items).filter((id) => ITEMS[id]?.kind === 'weapon');
  const shards = items.titanite ?? 0;
  return (
    <>
      <div className="rest-meta">
        <span>Titanite {shards}</span>
        <span>Souls {souls.toLocaleString('sv-SE')}</span>
      </div>
      {weapons.length === 0 && <p className="detail-desc dim">No weapons to reinforce.</p>}
      {weapons.map((id) => {
        const lvl = upgrades[id] ?? 0;
        const maxed = lvl >= MAX_UPGRADE;
        const c = upgradeCost(lvl);
        const can = !maxed && souls >= c.souls && shards >= c.shards;
        const now = computeEquip(stats, { weapon: id, armor: null, quick: null }, upgrades).ar;
        const next = computeEquip(stats, { weapon: id, armor: null, quick: null }, { ...upgrades, [id]: lvl + 1 }).ar;
        return (
          <div className="stat-row upg-row" key={id}>
            <span className="stat-name">
              <ItemIcon def={ITEMS[id]} size={20} /> {ITEMS[id].name} +{lvl}
            </span>
            <span className="stat-eff">{maxed ? `Attack ${now} · max` : `Attack ${now} → ${next}`}</span>
            <span className="stat-eff">{maxed ? '' : `${c.shards} shard · ${c.souls}`}</span>
            <button
              disabled={!can}
              onClick={() => {
                if (upgradeWeapon(id)) sfx.levelUp();
              }}
            >
              +
            </button>
          </div>
        );
      })}
    </>
  );
}

function RestMenu() {
  const open = useGameStore((s) => s.restOpen);
  const [tab, setTab] = useState<'level' | 'upgrade'>('level');
  if (!open) return null;
  return (
    <div className="panel-wrap">
      <div className="panel">
        <h2>Bonfire</h2>
        <nav className="inv-tabs">
          <button className={tab === 'level' ? 'on' : ''} onClick={() => setTab('level')}>
            Level Up
          </button>
          <button className={tab === 'upgrade' ? 'on' : ''} onClick={() => setTab('upgrade')}>
            Reinforce Weapon
          </button>
        </nav>
        {tab === 'level' ? <LevelUp /> : <Upgrade />}
        <button className="primary" onClick={() => EventBus.emit('ui:rest-leave')}>
          Leave
        </button>
      </div>
    </div>
  );
}

/** shown once the Ashen King falls: the end of the pre-release, back to the main menu */
function PreReleaseEnd() {
  const ending = useGameStore((s) => s.ending);
  const level = usePlayerStore((s) => s.level);
  if (!ending) return null;
  return (
    <div className="panel-wrap ending-wrap">
      <div className="panel ending">
        <h2>The Ash Settles</h2>
        <p className="ending-lead">You have felled the Ashen King – and reached the end of the Pre-Release.</p>
        <p>
          Thank you for playing this early version of Ash &amp; Hollow. The full release will bring many more
          monsters, bosses and zones to explore.
        </p>
        <p className="ending-stats">Level {level} · 10 great souls felled</p>
        <button
          className="primary"
          onClick={() => {
            // like Quit to Title: the title screen clears `ending` itself – closing the card first would
            // resume a game scene that is already shutting down
            EventBus.emit('ui:quit');
          }}
        >
          Main Menu
        </button>
      </div>
    </div>
  );
}

function PauseMenu() {
  const paused = useGameStore((s) => s.paused);
  if (!paused) return null;
  const resume = () => useGameStore.setState({ paused: false });
  return (
    <div className="panel-wrap">
      <div className="panel">
        <h2>Paused</h2>
        <table className="keys">
          <tbody>
            <tr><td>Move</td><td>A / D · ← →</td></tr>
            <tr><td>Jump</td><td>Space / W</td></tr>
            <tr><td>Light / Heavy (hold = charge)</td><td>J / K</td></tr>
            <tr><td>Roll · Sprint</td><td>L · Shift</td></tr>
            <tr><td>Shield: tap = parry, hold = block</td><td>U</td></tr>
            <tr><td>Riposte (after a parry)</td><td>J</td></tr>
            <tr><td>Drop through platform</td><td>S + Jump</td></tr>
            <tr><td>Flask · Quick item · Interact</td><td>R · Q · E</td></tr>
            <tr><td>Inventory</td><td>I / Tab</td></tr>
          </tbody>
        </table>
        <OptionsList />
        <button
          onClick={() => {
            // the scene clears `paused` itself once it has handed over to the title screen –
            // resuming here would wake a scene that is already shutting down
            EventBus.emit('ui:quit');
          }}
        >
          Quit to Title
        </button>
        <button className="primary" onClick={resume}>
          Resume
        </button>
      </div>
    </div>
  );
}

export function Overlays() {
  const paused = useGameStore((s) => s.paused);
  const invOpen = useGameStore((s) => s.invOpen);
  const menu = useGameStore((s) => s.menu);
  const talking = useGameStore((s) => !!s.dialogue || !!s.shop);
  const ending = useGameStore((s) => s.ending);
  const halted = paused || invOpen || talking || ending;

  // the store is the source of truth; forward pause changes to Phaser
  useEffect(() => {
    EventBus.emit(halted ? 'ui:pause' : 'ui:resume');
    sfx.duck(halted);
  }, [halted]);

  // page-turn sound for the inventory / pause menu
  const menuOpen = paused || invOpen;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    sfx.menu(menuOpen);
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGameStore.getState();
      if (s.menu) return; // main menu is mouse/touch driven
      if (s.ending) return; // the ending card only closes through its button
      if (s.dialogue) return; // the dialogue box handles its own keys
      if (s.shop) {
        if (e.key === 'Escape') {
          useGameStore.setState({ shop: null });
          EventBus.emit('ui:dialogue-end');
        }
        return;
      }
      if (e.key === 'i' || e.key === 'I' || e.key === 'Tab') {
        e.preventDefault();
        if (!s.dead && !s.restOpen && !s.paused) useGameStore.setState({ invOpen: !s.invOpen });
        return;
      }
      if (e.key !== 'Escape') return;
      if (s.invOpen) useGameStore.setState({ invOpen: false });
      else if (s.restOpen) EventBus.emit('ui:rest-leave');
      else if (!s.dead) useGameStore.setState({ paused: !s.paused });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {!menu && !ending && <div className="top-btns">
        <button
          className="round-btn"
          aria-label="Inventory"
          onClick={() => {
            const st = useGameStore.getState();
            if (!st.dead && !st.restOpen && !st.paused) useGameStore.setState({ invOpen: !st.invOpen });
          }}
        >
          <ItemIcon def={ITEMS.garb} size={20} />
        </button>
        <button className="round-btn" aria-label="Pause" onClick={() => useGameStore.setState({ paused: !paused })}>
          ❚❚
        </button>
      </div>}
      <BannerView />
      <Toast />
      <YouDied />
      <RestMenu />
      <Inventory />
      <Dialogue />
      <Shop />
      <PauseMenu />
      <PreReleaseEnd />
    </>
  );
}
