import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { type Action, pressTouch, touchInput } from '../../game/input/touchInput';
import { useGameStore } from '../../stores/gameStore';

const RADIUS = 52;
const SPRINT_AT = 0.9;

/** Floating joystick: it appears wherever the thumb lands in the left zone. */
function Joystick() {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);

  const move = (e: RPointerEvent, o: { x: number; y: number }) => {
    let dx = e.clientX - o.x;
    let dy = e.clientY - o.y;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    touchInput.moveX = Math.abs(nx) < 0.18 ? 0 : nx;
    touchInput.moveY = Math.abs(ny) < 0.4 ? 0 : ny;
    touchInput.sprint = Math.abs(nx) > SPRINT_AT;
  };

  const end = () => {
    id.current = null;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    touchInput.moveX = touchInput.moveY = 0;
    touchInput.sprint = false;
  };

  return (
    <div
      className="joy-zone"
      onPointerDown={(e) => {
        if (id.current !== null) return;
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        const o = { x: e.clientX, y: e.clientY };
        setOrigin(o);
        move(e, o);
      }}
      onPointerMove={(e) => e.pointerId === id.current && origin && move(e, origin)}
      onPointerUp={(e) => e.pointerId === id.current && end()}
      onPointerCancel={(e) => e.pointerId === id.current && end()}
    >
      {origin ? (
        <div className="joy-base" style={{ left: origin.x, top: origin.y }}>
          <div className="joy-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      ) : (
        <div className="joy-hint" />
      )}
    </div>
  );
}

function Btn({ action, label, className }: { action: Action; label: string; className: string }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => {
    setDown(v);
    pressTouch(action, v);
  };
  return (
    <div
      className={`tbtn ${className} ${down ? 'down' : ''}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
    >
      {label}
    </div>
  );
}

export function TouchControls() {
  const show = useGameStore((s) => s.showTouch);
  const blocked = useGameStore((s) => s.paused || s.restOpen || s.invOpen || !!s.dialogue || !!s.shop || !!s.menu);
  if (!show || blocked) return null;
  return (
    <div className="touch">
      <Joystick />
      <div className="btn-cluster">
        <Btn action="light" label="⚔" className="b-light" />
        <Btn action="heavy" label="⚔⚔" className="b-heavy" />
        <Btn action="roll" label="⟲" className="b-roll" />
        <Btn action="jump" label="▲" className="b-jump" />
        <Btn action="interact" label="✋" className="b-interact" />
        <Btn action="block" label="🛡" className="b-block" />
      </div>
      <Btn action="flask" label="✚" className="b-flask" />
      <Btn action="item" label="◆" className="b-item" />
    </div>
  );
}
