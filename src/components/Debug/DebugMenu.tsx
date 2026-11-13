import { useEffect, useMemo, useState } from 'react';
import type Phaser from 'phaser';
import { EventBus } from '../../game/EventBus';
import { DEBUG, debugState } from '../../game/debugState';
import { AREAS } from '../../game/world/areas';
import { ITEMS, MAX_UPGRADE, type ItemDef } from '../../game/data/items';
import type { GameScene } from '../../game/scenes/GameScene';
import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { ItemIcon } from '../Inventory/Inventory';

/**
 * Developer menu, only with `?debug` in the URL. Toggle with the 🐞 button or F1.
 * World: start / jump to any area at its spawn, bonfires, doors or boss gate (works from the title too).
 * Items: give anything. Player: souls, god mode, heal, kill enemies, boss HP. Flags: world progress.
 */

interface Spot {
  label: string;
  x: number;
  y: number;
}

/** every place worth jumping to in an area */
function spotsFor(id: string): { name: string; spots: Spot[] } {
  const L = AREAS[id]();
  const spots: Spot[] = [{ label: 'Start', ...L.spawn }];
  for (const b of L.bonfires) spots.push({ label: `🔥 ${b.id}`, x: b.x + 16, y: b.y });
  for (const d of L.doors) spots.push({ label: `🚪 ${d.id}`, x: d.x, y: d.y });
  if (L.boss) spots.push({ label: `💀 ${L.boss.type} gate`, x: L.boss.fogX - 40, y: L.boss.y });
  return { name: L.name, spots };
}

const KNOWN_FLAGS = ['bossDefeated', 'shepherdDefeated', 'colossusDefeated', 'matriarchDefeated', 'motherDefeated', 'sphinxDefeated', 'gladiatorDefeated', 'leviathanDefeated', 'ayameDefeated', 'kingDefeated', 'shortcut'];
const KINDS: ItemDef['kind'][] = ['weapon', 'shield', 'armor', 'consumable', 'material'];
type Tab = 'world' | 'items' | 'player' | 'flags';

function game(): Phaser.Game | null {
  return (window as unknown as { __souls?: { game: Phaser.Game } }).__souls?.game ?? null;
}

/** the running game scene, or null on the title screen */
function scene(): GameScene | null {
  const s = game()?.scene.getScene('Game') as GameScene | undefined;
  return s && (s.scene.isActive() || s.scene.isPaused()) ? s : null;
}

export function DebugMenu() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('world');
  const [msg, setMsg] = useState('');
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const menu = useGameStore((s) => s.menu);
  const items = useInventoryStore((s) => s.items);
  const equipped = useInventoryStore((s) => s.equipped);
  const upgrades = useInventoryStore((s) => s.upgrades);
  const souls = usePlayerStore((s) => s.souls);
  const maxFlasks = usePlayerStore((s) => s.maxFlasks);
  const areas = useMemo(() => Object.keys(AREAS).map((id) => ({ id, ...spotsFor(id) })), []);

  useEffect(() => {
    if (!DEBUG) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the game holds still while the menu is open
  useEffect(() => {
    if (!DEBUG || !scene()) return;
    EventBus.emit(open ? 'ui:pause' : 'ui:resume');
  }, [open]);

  if (!DEBUG || menu === 'boot') return null;
  const s = scene();
  const onTitle = !s;
  const say = (m: string) => setMsg(m);

  const goto = (area: string, spot: Spot) => {
    const at = { x: spot.x, y: spot.y };
    setOpen(false);
    if (onTitle) {
      // start from the save (or a fresh world), dropped at the chosen spot
      useGameStore.setState({ menu: null });
      EventBus.emit('ui:start', { area, at });
    } else {
      EventBus.emit('ui:resume');
      scene()?.debugGoto(area, at);
    }
  };

  const give = (id: string, n: number) => {
    useInventoryStore.getState().add(id, n);
    say(`+${n} ${ITEMS[id].name}`);
  };

  const giveAllGear = () => {
    const inv = useInventoryStore.getState();
    for (const it of Object.values(ITEMS)) if (['weapon', 'shield', 'armor'].includes(it.kind) && !inv.items[it.id]) inv.add(it.id, 1);
    say('All gear added');
  };

  const upgradeWeapon = (delta: number) => {
    const w = equipped.weapon;
    if (!w) return;
    const lvl = Math.max(0, Math.min(MAX_UPGRADE, (upgrades[w] ?? 0) + delta));
    useInventoryStore.setState({ upgrades: { ...upgrades, [w]: lvl } });
    say(`${ITEMS[w].name} +${lvl}`);
  };

  const tabs: Tab[] = onTitle ? ['world'] : ['world', 'items', 'player', 'flags'];
  const cur = onTitle ? 'world' : tab;
  const flags = s?.debugFlags() ?? {};
  const flagNames = [...new Set([...KNOWN_FLAGS, ...Object.keys(flags)])];

  return (
    <>
      <button className="dbg-btn" title="Debug menu (F1)" onClick={() => setOpen((o) => !o)}>
        🐞
      </button>
      {open && (
        <div className="dbg-wrap" onPointerDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="dbg-panel">
            <div className="dbg-head">
              {tabs.map((t) => (
                <button key={t} className={t === cur ? 'on' : ''} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
              <span className="dbg-msg">{msg}</span>
              <button className="dbg-close" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>

            {cur === 'world' && (
              <div className="dbg-body">
                {onTitle && <p className="dbg-note">Starts from your save (or a fresh game) at the chosen spot.</p>}
                {areas.map((a) => (
                  <div key={a.id} className="dbg-area">
                    <div className="dbg-area-name">
                      {a.name} {s?.area === a.id && <em>(here)</em>}
                    </div>
                    <div className="dbg-chips">
                      {a.spots.map((sp) => (
                        <button key={sp.label} onClick={() => goto(a.id, sp)}>
                          {sp.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cur === 'items' && (
              <div className="dbg-body">
                <div className="dbg-chips">
                  <button onClick={giveAllGear}>Give all gear</button>
                  <button onClick={() => give('titanite', 10)}>+10 Titanite</button>
                  <button onClick={() => upgradeWeapon(1)}>Weapon +1</button>
                  <button onClick={() => upgradeWeapon(-1)}>Weapon −1</button>
                </div>
                {KINDS.map((k) => (
                  <div key={k} className="dbg-area">
                    <div className="dbg-area-name">{k}</div>
                    {Object.values(ITEMS)
                      .filter((it) => it.kind === k)
                      .map((it) => (
                        <div key={it.id} className="dbg-row">
                          <ItemIcon def={it} size={18} />
                          <span className="dbg-name">{it.name}</span>
                          <span className="dbg-qty">{items[it.id] ?? 0}</span>
                          <button onClick={() => give(it.id, 1)}>+1</button>
                          {(k === 'consumable' || k === 'material') && <button onClick={() => give(it.id, 5)}>+5</button>}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}

            {cur === 'player' && s && (
              <div className="dbg-body">
                <div className="dbg-area-name">Souls: {souls.toLocaleString('sv-SE')}</div>
                <div className="dbg-chips">
                  {[1000, 10000, 100000].map((n) => (
                    <button key={n} onClick={() => usePlayerStore.getState().addSouls(n)}>
                      +{n.toLocaleString('sv-SE')}
                    </button>
                  ))}
                  <button onClick={() => usePlayerStore.setState({ souls: 0 })}>0</button>
                </div>
                <div className="dbg-chips">
                  <label className="dbg-check">
                    <input
                      type="checkbox"
                      checked={debugState.god}
                      onChange={(e) => {
                        debugState.god = e.target.checked;
                        rerender();
                      }}
                    />
                    God mode
                  </label>
                  <label className="dbg-check">
                    <input
                      type="checkbox"
                      checked={debugState.hitboxes}
                      onChange={(e) => {
                        debugState.hitboxes = e.target.checked;
                        rerender();
                      }}
                    />
                    Hitboxes
                  </label>
                </div>
                <div className="dbg-chips">
                  <button onClick={() => (s.debugHeal(), say('Healed, flasks refilled'))}>Heal + flasks</button>
                  <button onClick={() => (usePlayerStore.setState({ maxFlasks: maxFlasks + 1, flasks: maxFlasks + 1 }), say(`Max flasks ${maxFlasks + 1}`))}>
                    +1 max flask
                  </button>
                  <button onClick={() => (s.debugKillEnemies(), say('Enemies killed'))}>Kill enemies</button>
                  <button onClick={() => (s.debugSave(), say('Saved'))}>Save</button>
                </div>
                <div className="dbg-area-name">Boss</div>
                <div className="dbg-chips">
                  <button onClick={() => say(s.debugBossHp(0.5))}>50%</button>
                  <button onClick={() => say(s.debugBossHp(0.25))}>25%</button>
                  <button onClick={() => say(s.debugBossHp(0.1))}>10%</button>
                  <button onClick={() => say(s.debugBossHp(0))}>Kill</button>
                </div>
              </div>
            )}

            {cur === 'flags' && s && (
              <div className="dbg-body">
                <div className="dbg-chips">
                  <button onClick={() => (s.debugLightBonfires(), say('Bonfires lit'))}>Light bonfires here</button>
                </div>
                {flagNames.map((f) => (
                  <label key={f} className="dbg-check dbg-row">
                    <input
                      type="checkbox"
                      checked={!!flags[f]}
                      onChange={(e) => {
                        s.debugSetFlag(f, e.target.checked);
                        rerender();
                      }}
                    />
                    {f}
                  </label>
                ))}
                <p className="dbg-note">Boss flags take effect next time the area loads.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
