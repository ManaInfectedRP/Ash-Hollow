import { maxHpFor, maxStaminaFor, usePlayerStore } from '../../stores/playerStore';
import { useGameStore } from '../../stores/gameStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { ITEMS } from '../../game/data/items';
import { ItemIcon } from '../Inventory/Inventory';

function Bar({ value, max, width, kind }: { value: number; max: number; width: number; kind: string }) {
  const pct = `${Math.max(0, Math.min(1, value / max)) * 100}%`;
  return (
    <div className={`bar bar-${kind}`} style={{ width }}>
      <div className="bar-trail" style={{ width: pct }} />
      <div className="bar-fill" style={{ width: pct }} />
    </div>
  );
}

export function HUD() {
  const hp = usePlayerStore((s) => s.hp);
  const stamina = usePlayerStore((s) => s.stamina);
  const status = usePlayerStore((s) => s.status);
  const stats = usePlayerStore((s) => s.stats);
  const souls = usePlayerStore((s) => s.souls);
  const flasks = usePlayerStore((s) => s.flasks);
  const boss = useGameStore((s) => s.boss);
  const prompt = useGameStore((s) => s.prompt);
  const hurtFlash = useGameStore((s) => s.hurtFlash);
  const showTouch = useGameStore((s) => s.showTouch);
  const quick = useInventoryStore((s) => s.equipped.quick);
  const quickQty = useInventoryStore((s) => (s.equipped.quick ? s.items[s.equipped.quick] ?? 0 : 0));
  const weapon = useInventoryStore((s) => s.equipped.weapon);
  const menu = useGameStore((s) => s.menu);
  const maxHp = maxHpFor(stats);
  const maxSt = maxStaminaFor(stats);

  if (menu) return null;
  return (
    <div className="hud">
      <div className="bars">
        <Bar value={hp} max={maxHp} width={maxHp * 0.85} kind="hp" />
        <Bar value={stamina} max={maxSt} width={maxSt * 1.5} kind="st" />
        {(status.frost > 0 || status.frostbite) && (
          <div className={`status status-frost ${status.frostbite ? 'on' : ''}`}>
            <span className="status-label">{status.frostbite ? 'FROSTBITE' : 'Frost'}</span>
            <Bar value={status.frostbite ? 100 : status.frost} max={100} width={70} kind="frost" />
          </div>
        )}
        {(status.poison > 0 || status.poisoned) && (
          <div className={`status status-poison ${status.poisoned ? 'on' : ''}`}>
            <span className="status-label">{status.poisoned ? 'POISONED' : 'Poison'}</span>
            <Bar value={status.poisoned ? 100 : status.poison} max={100} width={70} kind="poison" />
          </div>
        )}
      </div>
      <div className="belt">
        <div className={`flask ${flasks === 0 ? 'empty' : ''}`}>
          <img className="icon flask-img" src="assets/atlas/items/flask.png" width={22} height={22} alt="Flask" />
          <span>{flasks}</span>
        </div>
        <div className={`belt-slot ${quick && quickQty === 0 ? 'empty' : ''}`}>
          <ItemIcon def={quick ? ITEMS[quick] : null} size={22} />
          {quick && <span>{quickQty}</span>}
        </div>
        <div className="belt-slot">
          <ItemIcon def={weapon ? ITEMS[weapon] : null} size={22} />
        </div>
      </div>
      <div className="souls">
        <span className="souls-icon" />
        {souls.toLocaleString('sv-SE')}
      </div>
      {boss && (
        <div className="boss">
          <div className="boss-name">{boss.name}</div>
          <Bar value={boss.hp} max={boss.maxHp} width={0} kind="boss" />
        </div>
      )}
      {prompt && (
        <div className="prompt">
          {!showTouch && <kbd>E</kbd>} {prompt}
        </div>
      )}
      {hurtFlash > 0 && <div key={hurtFlash} className="hurt-flash" />}
    </div>
  );
}
