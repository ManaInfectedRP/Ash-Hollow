import Phaser from 'phaser';
import { ACTIONS, type Action, touchInput } from './touchInput';

const BIND: Record<Action, string[]> = {
  jump: ['SPACE', 'W', 'UP'],
  light: ['J'],
  heavy: ['K'],
  roll: ['L'],
  interact: ['E'],
  flask: ['R'],
  item: ['Q'],
  block: ['U'],
};

/** Merges keyboard + touch into one per-frame input snapshot with edge detection. */
export class Controls {
  moveX = 0;
  moveY = 0;
  sprint = false;

  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private down = {} as Record<Action, boolean>;
  private prev = {} as Record<Action, boolean>;
  private just = {} as Record<Action, boolean>;
  private lastTaps = { ...touchInput.taps };

  constructor(scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    const names = new Set([...Object.values(BIND).flat(), 'A', 'D', 'S', 'LEFT', 'RIGHT', 'DOWN', 'SHIFT']);
    for (const n of names) this.keys[n] = kb.addKey(n);
    for (const a of ACTIONS) this.down[a] = this.prev[a] = this.just[a] = false;
  }

  private k(n: string) {
    return this.keys[n]?.isDown ?? false;
  }

  update() {
    const kx = (this.k('D') || this.k('RIGHT') ? 1 : 0) - (this.k('A') || this.k('LEFT') ? 1 : 0);
    const ky = this.k('S') || this.k('DOWN') ? 1 : 0;
    this.moveX = kx !== 0 ? kx : touchInput.moveX;
    this.moveY = ky !== 0 ? ky : touchInput.moveY;
    this.sprint = this.k('SHIFT') || touchInput.sprint;

    for (const a of ACTIONS) {
      // map() (not some()) so every bound key's JustDown latch is consumed this frame
      const keyJust = BIND[a].map((n) => Phaser.Input.Keyboard.JustDown(this.keys[n])).some(Boolean);
      const tapped = touchInput.taps[a] !== this.lastTaps[a];
      this.lastTaps[a] = touchInput.taps[a];
      this.just[a] = keyJust || tapped;
      this.prev[a] = this.down[a];
      this.down[a] = BIND[a].some((n) => this.k(n)) || touchInput.buttons[a] || this.just[a];
    }
  }

  held(a: Action) {
    return this.down[a];
  }
  pressed(a: Action) {
    return this.just[a];
  }
  released(a: Action) {
    return this.prev[a] && !this.down[a];
  }
}
