import { useEffect, useState } from 'react';
import { EventBus } from '../../game/EventBus';
import { NPCS, type DialogueChoice } from '../../game/data/npcs';
import { ITEMS } from '../../game/data/items';
import { sfx } from '../../game/systems/Sfx';
import { useGameStore } from '../../stores/gameStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { ItemIcon } from '../Inventory/Inventory';

const CHARS_PER_SEC = 55;

/** Bottom dialogue box: typewriter lines, tap/Enter to advance, choices at the end of a node. */
export function Dialogue() {
  const dialogue = useGameStore((s) => s.dialogue);
  const [line, setLine] = useState(0);
  const [shown, setShown] = useState(0);

  const npc = dialogue ? NPCS[dialogue.npc] : null;
  const node = npc && dialogue ? npc.nodes[dialogue.node] : null;
  const text = node?.lines[line] ?? '';
  const atEnd = !!node && line >= node.lines.length - 1 && shown >= text.length;

  // entering a node: reset and let Phaser apply its one-time effects (flags, gifts)
  useEffect(() => {
    if (!dialogue) return;
    setLine(0);
    setShown(0);
    EventBus.emit('ui:dialogue-node', dialogue.npc, dialogue.node);
  }, [dialogue]);

  // typewriter
  useEffect(() => {
    if (!node || shown >= text.length) return;
    const id = setTimeout(() => setShown((n) => Math.min(text.length, n + 2)), 2000 / CHARS_PER_SEC);
    return () => clearTimeout(id);
  }, [node, shown, text]);

  const close = () => {
    useGameStore.setState({ dialogue: null });
    EventBus.emit('ui:dialogue-end');
  };

  const choose = (c: DialogueChoice) => {
    if (!dialogue) return;
    sfx.souls();
    if (c.action.type === 'goto') useGameStore.setState({ dialogue: { npc: dialogue.npc, node: c.action.node } });
    else if (c.action.type === 'shop') useGameStore.setState({ dialogue: null, shop: dialogue.npc });
    else close();
  };

  const advance = () => {
    if (!node) return;
    if (shown < text.length) return setShown(text.length); // finish the line first
    if (line < node.lines.length - 1) {
      setLine(line + 1);
      setShown(0);
    } else if (!node.choices?.length) close();
  };

  // keyboard: Enter/Space/E advance, 1-9 pick a choice, Esc closes
  useEffect(() => {
    if (!dialogue) return;
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'e', 'E'].includes(e.key)) {
        e.preventDefault();
        advance();
      } else if (atEnd && node?.choices && /^[1-9]$/.test(e.key)) {
        const c = node.choices[Number(e.key) - 1];
        if (c) choose(c);
      } else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!dialogue || !npc || !node) return null;
  return (
    <div className="dialogue-wrap" onPointerDown={(e) => e.target === e.currentTarget && advance()}>
      <div className="dialogue" onClick={advance}>
        <div className="dialogue-name">{npc.name}</div>
        <p className="dialogue-text">
          {text.slice(0, shown)}
          {shown >= text.length && !atEnd && <span className="dialogue-more">▼</span>}
        </p>
        {atEnd && node.choices && (
          <div className="dialogue-choices" onClick={(e) => e.stopPropagation()}>
            {node.choices.map((c, i) => (
              <button key={c.label} onClick={() => choose(c)}>
                <span className="num">{i + 1}</span> {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Merchant shop: buy with souls. */
export function Shop() {
  const shopId = useGameStore((s) => s.shop);
  const souls = usePlayerStore((s) => s.souls);
  const items = useInventoryStore((s) => s.items);
  if (!shopId) return null;
  const npc = NPCS[shopId];
  const close = () => {
    useGameStore.setState({ shop: null });
    EventBus.emit('ui:dialogue-end');
  };
  const buy = (item: string, price: number) => {
    const ps = usePlayerStore.getState();
    if (ps.souls < price) return;
    usePlayerStore.setState({ souls: ps.souls - price });
    useInventoryStore.getState().add(item, 1);
    sfx.souls();
    EventBus.emit('ui:save');
  };
  return (
    <div className="panel-wrap">
      <div className="panel shop">
        <h2>{npc.name.split(',')[0]}&rsquo;s Wares</h2>
        <div className="rest-meta">
          <span>Souls {souls.toLocaleString('sv-SE')}</span>
        </div>
        {(npc.shop ?? []).map((e) => (
          <div className="shop-row" key={e.item}>
            <ItemIcon def={ITEMS[e.item]} size={28} />
            <div className="shop-info">
              <span className="shop-name">{ITEMS[e.item].name}</span>
              <span className="stat-eff">{ITEMS[e.item].desc}</span>
            </div>
            <span className="shop-owned">×{items[e.item] ?? 0}</span>
            <button disabled={souls < e.price} onClick={() => buy(e.item, e.price)}>
              {e.price}
            </button>
          </div>
        ))}
        <button className="primary" onClick={close}>
          Leave
        </button>
      </div>
    </div>
  );
}
