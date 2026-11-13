import { useState } from 'react';
import { EventBus } from '../../game/EventBus';
import { ITEMS, type ItemDef, type ItemKind } from '../../game/data/items';
import { iconUrl } from '../../game/gfx/icons';
import { itemSpriteUrl } from '../../game/gfx/sprites';
import { WEAPONS } from '../../game/systems/attacks';
import { computeEquip } from '../../game/systems/equipment';
import { sfx } from '../../game/systems/Sfx';
import { useInventoryStore, type Equipped, type EquipSlot } from '../../stores/inventoryStore';
import { maxHpFor, maxStaminaFor, usePlayerStore } from '../../stores/playerStore';
import { useGameStore } from '../../stores/gameStore';

const TABS: { kind: ItemKind; label: string }[] = [
  { kind: 'weapon', label: 'Weapons' },
  { kind: 'shield', label: 'Shields' },
  { kind: 'armor', label: 'Armor' },
  { kind: 'consumable', label: 'Items' },
  { kind: 'material', label: 'Materials' },
];

export function ItemIcon({ def, size = 32 }: { def: ItemDef | null; size?: number }) {
  if (!def) return <div className="icon empty" style={{ width: size, height: size }} />;
  // Pixel Art Atlas sprite when we have one, otherwise the generated fallback icon
  const src = itemSpriteUrl(def.id) ?? iconUrl(def.icon);
  return <img className="icon" src={src} width={size} height={size} alt={def.name} draggable={false} />;
}

function Slot({ label, id, onClick }: { label: string; id: string | null; onClick: () => void }) {
  const qty = useInventoryStore((s) => (id ? s.items[id] : 0));
  const upg = useInventoryStore((s) => (id ? s.upgrades[id] : 0));
  const def = id ? ITEMS[id] : null;
  return (
    <button className="eq-slot" onClick={onClick}>
      <ItemIcon def={def} size={36} />
      <div className="eq-text">
        <span className="eq-label">{label}</span>
        <span className="eq-name">
          {def ? def.name : '—'}
          {upg ? ` +${upg}` : ''}
          {def?.kind === 'consumable' ? ` ×${qty ?? 0}` : ''}
        </span>
      </div>
    </button>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const gripName = (h: 1 | 2 | 'dual') => (h === 2 ? 'two-handed' : h === 'dual' ? 'dual' : 'one-handed');

/** "weapon · two-handed · fire" */
function kindLine(def: ItemDef) {
  if (def.kind !== 'weapon') return def.kind;
  const w = WEAPONS[def.weapon ?? ''];
  if (!w) return def.kind;
  return [def.kind, gripName(w.hands ?? 1), w.element?.type].filter(Boolean).join(' · ');
}

export function Inventory() {
  const open = useGameStore((s) => s.invOpen);
  const items = useInventoryStore((s) => s.items);
  const equipped = useInventoryStore((s) => s.equipped);
  const upgrades = useInventoryStore((s) => s.upgrades);
  const equip = useInventoryStore((s) => s.equip);
  const stats = usePlayerStore((s) => s.stats);
  const level = usePlayerStore((s) => s.level);
  const [tab, setTab] = useState<ItemKind>('weapon');
  const [sel, setSel] = useState<string | null>(null);
  if (!open) return null;

  const eq = computeEquip(stats, equipped, upgrades);
  const list = Object.entries(items).filter(([id]) => ITEMS[id]?.kind === tab);
  const def = sel && items[sel] ? ITEMS[sel] : null;
  const close = () => useGameStore.setState({ invOpen: false });

  const slotFor = (d: ItemDef): EquipSlot | null =>
    d.kind === 'weapon' ? 'weapon' : d.kind === 'shield' ? 'shield' : d.kind === 'armor' ? 'armor' : d.kind === 'consumable' ? 'quick' : null;
  const isEquipped = (id: string) => Object.values(equipped).includes(id);

  // what equipping the selected item would change
  let preview: { label: string; from: string; to: string }[] = [];
  if (def && (def.kind === 'weapon' || def.kind === 'armor' || def.kind === 'shield')) {
    const next: Equipped = { ...equipped, [def.kind]: def.id };
    const after = computeEquip(stats, next, upgrades);
    preview =
      def.kind === 'shield'
        ? [
            { label: 'Block', from: eq.shield ? pct(eq.shield.absorb) : '—', to: after.shield ? pct(after.shield.absorb) : '—' },
            { label: 'Stability', from: eq.shield ? pct(eq.shield.stability) : '—', to: after.shield ? pct(after.shield.stability) : '—' },
            { label: 'Load', from: `${eq.load}/${eq.maxLoad}`, to: `${after.load}/${after.maxLoad}` },
            { label: 'Roll', from: eq.roll, to: after.roll },
          ]
        : def.kind === 'weapon'
        ? [
            { label: 'Attack', from: String(eq.ar), to: String(after.ar) },
            { label: 'Grip', from: gripName(eq.hands), to: gripName(after.hands) },
            { label: 'Element', from: eq.element?.type ?? '—', to: after.element?.type ?? '—' },
            { label: 'Block', from: eq.shield ? pct(eq.shield.absorb) : '—', to: after.shield ? pct(after.shield.absorb) : '—' },
            { label: 'Load', from: `${eq.load}/${eq.maxLoad}`, to: `${after.load}/${after.maxLoad}` },
            { label: 'Roll', from: eq.roll, to: after.roll },
          ]
        : [
            { label: 'Defense', from: pct(eq.defense), to: pct(after.defense) },
            { label: 'Poise', from: String(eq.poise), to: String(after.poise) },
            { label: 'Fire res.', from: pct(eq.fireRes), to: pct(after.fireRes) },
            { label: 'Frost res.', from: pct(eq.frostRes), to: pct(after.frostRes) },
            { label: 'Poison res.', from: pct(eq.poisonRes), to: pct(after.poisonRes) },
            { label: 'Load', from: `${eq.load}/${eq.maxLoad}`, to: `${after.load}/${after.maxLoad}` },
            { label: 'Roll', from: eq.roll, to: after.roll },
          ];
  }

  const jumpTo = (kind: ItemKind, id: string | null) => {
    setTab(kind);
    setSel(id);
  };

  return (
    <div className="panel-wrap inv-wrap" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="inv">
        <header className="inv-head">
          <h2>Inventory</h2>
          <button className="inv-close" onClick={close}>
            ✕
          </button>
        </header>

        <section className="inv-left">
          <Slot label="Weapon" id={equipped.weapon} onClick={() => jumpTo('weapon', equipped.weapon)} />
          <Slot
            label={eq.hands === 2 ? 'Shield · unused (two-handed)' : eq.hands === 'dual' ? 'Shield · unused (dual blades)' : 'Shield'}
            id={equipped.shield ?? null}
            onClick={() => jumpTo('shield', equipped.shield ?? null)}
          />
          <Slot label="Armor" id={equipped.armor} onClick={() => jumpTo('armor', equipped.armor)} />
          <Slot label="Quick item" id={equipped.quick} onClick={() => jumpTo('consumable', equipped.quick)} />
          <dl className="inv-stats">
            <dt>Level</dt>
            <dd>{level}</dd>
            <dt>HP / Stamina</dt>
            <dd>
              {maxHpFor(stats)} / {maxStaminaFor(stats)}
            </dd>
            <dt>Attack ({eq.weapon.name})</dt>
            <dd>{eq.ar}</dd>
            <dt>Defense</dt>
            <dd>{pct(eq.defense)}</dd>
            <dt>Shield block</dt>
            <dd>{eq.shield ? pct(eq.shield.absorb) : '—'}</dd>
            <dt>Poise</dt>
            <dd>{eq.poise}</dd>
            <dt>Equip load</dt>
            <dd className={`roll-${eq.roll}`}>
              {eq.load}/{eq.maxLoad} · {eq.roll} roll
            </dd>
          </dl>
        </section>

        <section className="inv-mid">
          <nav className="inv-tabs">
            {TABS.map((t) => (
              <button key={t.kind} className={tab === t.kind ? 'on' : ''} onClick={() => jumpTo(t.kind, null)}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="inv-grid">
            {list.length === 0 && <div className="inv-empty">Nothing here.</div>}
            {list.map(([id, qty]) => (
              <button key={id} className={`inv-cell ${sel === id ? 'sel' : ''}`} onClick={() => setSel(id)}>
                <ItemIcon def={ITEMS[id]} />
                {qty > 1 && <span className="qty">{qty}</span>}
                {isEquipped(id) && <span className="eq-mark">E</span>}
                {upgrades[id] ? <span className="upg">+{upgrades[id]}</span> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="inv-right">
          {def ? (
            <>
              <div className="detail-head">
                <ItemIcon def={def} size={40} />
                <div>
                  <div className="detail-name">
                    {def.name}
                    {upgrades[def.id] ? ` +${upgrades[def.id]}` : ''}
                  </div>
                  <div className="detail-kind">{kindLine(def)}</div>
                </div>
              </div>
              <p className="detail-desc">{def.desc}</p>
              {preview.length > 0 && (
                <table className="preview">
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.label}>
                        <td>{r.label}</td>
                        <td>{r.from}</td>
                        <td>→</td>
                        <td className={r.from === r.to ? '' : 'chg'}>{r.to}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="detail-actions">
                {(def.kind === 'weapon' || def.kind === 'armor' || def.kind === 'shield') &&
                  (equipped[def.kind] === def.id ? (
                    <button onClick={() => equip(def.kind as EquipSlot, null)}>Unequip</button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => {
                        equip(slotFor(def)!, def.id);
                        sfx.swing(false);
                      }}
                    >
                      Equip
                    </button>
                  ))}
                {def.kind === 'consumable' && (
                  <>
                    <button className="primary" onClick={() => EventBus.emit('ui:use-item', def.id)}>
                      Use
                    </button>
                    {equipped.quick === def.id ? (
                      <button onClick={() => equip('quick', null)}>Clear quick slot</button>
                    ) : (
                      <button onClick={() => equip('quick', def.id)}>Set as quick item</button>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="detail-desc dim">Select an item.</p>
          )}
        </section>
      </div>
    </div>
  );
}
