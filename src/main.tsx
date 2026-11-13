import { createRoot } from 'react-dom/client';
import App from './App';
import { sfx } from './game/systems/Sfx';
import './index.css';

// Audio can only start after a user gesture. On touch devices we also try
// fullscreen + landscape lock (works on Android/PWA; iOS shows the rotate hint instead).
const unlock = (e: Event) => {
  sfx.resume();
  // the Android app is already immersive fullscreen (MainActivity) – only the browser needs this
  const native =
    !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ||
    // Capacitor serves the bundled app from https://localhost
    (location.protocol === 'https:' && location.hostname === 'localhost');
  if (!native && e.type === 'pointerdown' && (e as PointerEvent).pointerType === 'touch' && !document.fullscreenElement) {
    document.documentElement
      .requestFullscreen?.()
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
      .catch(() => {});
  }
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// No StrictMode: it double-mounts effects, which would boot Phaser twice in dev.
createRoot(document.getElementById('root')!).render(<App />);
