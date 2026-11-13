export type Action = 'jump' | 'light' | 'heavy' | 'roll' | 'interact' | 'flask' | 'item' | 'block';
export const ACTIONS: Action[] = ['jump', 'light', 'heavy', 'roll', 'interact', 'flask', 'item', 'block'];

const blank = () => Object.fromEntries(ACTIONS.map((a) => [a, false])) as Record<Action, boolean>;
const zero = () => Object.fromEntries(ACTIONS.map((a) => [a, 0])) as Record<Action, number>;

/**
 * Written by the React touch controls, read by Phaser every frame.
 * Deliberately a plain mutable object (not a store): it changes at input rate
 * and nothing in React needs to re-render from it.
 */
export const touchInput = {
  moveX: 0,
  moveY: 0,
  sprint: false,
  buttons: blank(),
  /** Incremented on every press so taps shorter than a frame are never lost. */
  taps: zero(),
};

export function pressTouch(a: Action, down: boolean) {
  if (down && !touchInput.buttons[a]) touchInput.taps[a]++;
  touchInput.buttons[a] = down;
}

export function resetTouchInput() {
  touchInput.moveX = 0;
  touchInput.moveY = 0;
  touchInput.sprint = false;
  for (const a of ACTIONS) touchInput.buttons[a] = false;
}
