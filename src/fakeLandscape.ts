// Fake landscape: a phone held upright (or stuck there by the iPhone rotation lock – web pages can't rotate
// or lock the screen on iOS) gets the whole app turned 90° with CSS, so the game is always played sideways.
// Hit-testing follows the CSS transform, so taps on buttons just work; only code that reads raw
// clientX/clientY needs toLocal() to get coordinates in the app's own (rotated) frame.

const portraitTouch = window.matchMedia('(orientation: portrait) and (pointer: coarse)');

export const fakeLandscape = { on: false };

function apply() {
  const root = document.documentElement;
  fakeLandscape.on = portraitTouch.matches;
  root.classList.toggle('fake-landscape', fakeLandscape.on);
  // the real viewport in px (iOS changes innerHeight as its toolbars show and hide, so no vh units)
  root.style.setProperty('--vw', `${window.innerWidth}px`);
  root.style.setProperty('--vh', `${window.innerHeight}px`);
}

/** Screen (client) coordinates → coordinates inside the app, which is rotated 90° clockwise when faked. */
export function toLocal(clientX: number, clientY: number) {
  return fakeLandscape.on ? { x: clientY, y: window.innerWidth - clientX } : { x: clientX, y: clientY };
}

export function installFakeLandscape() {
  apply();
  // iOS reports the old size while a rotation is still running – apply again once it has settled
  let settle = 0;
  const onChange = () => {
    apply();
    clearTimeout(settle);
    settle = window.setTimeout(apply, 350);
  };
  portraitTouch.addEventListener('change', onChange);
  window.addEventListener('resize', onChange);
}
