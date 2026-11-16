// Keeps mobile browsers from zooming the game. The viewport meta (user-scalable=no) and touch-action in
// index.css cover most browsers, but iOS Safari ignores user-scalable=no and can still zoom on a pinch or a
// quick double tap – and once zoomed in, the touch controls end up off-screen.

const DOUBLE_TAP_MS = 350;
// a quick second tap on these must still produce a click (menus, dialogue, shop), so they are left alone
const CLICKABLE = 'button, a, input, select, textarea, label, .dialogue';

let lastTap = 0;

export function installZoomGuard() {
  document.addEventListener(
    'touchend',
    (e) => {
      const now = e.timeStamp;
      const quick = now - lastTap < DOUBLE_TAP_MS;
      lastTap = now;
      if (!quick || e.touches.length > 0) return;
      if (e.target instanceof Element && e.target.closest(CLICKABLE)) return;
      e.preventDefault(); // cancels the browser's double-tap zoom; pointer events have already fired
    },
    { passive: false },
  );

  // Safari's pinch-zoom gesture events
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener('dblclick', (e) => e.preventDefault());
}
