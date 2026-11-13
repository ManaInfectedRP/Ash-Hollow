# Mobile

## Quick test in the phone's browser (USB tethering)

1. Phone: enable **USB tethering** (Delning via USB).
2. PC: `npm run dev` (Vite listens on all interfaces).
3. Find the PC's address on the tethering adapter ("Remote NDIS…"): `ipconfig` → e.g. `192.168.42.185`.
4. Phone browser: `http://192.168.42.185:5180` (or the dev port you use). Rotate to landscape; the
   first tap enables audio and fullscreen.

If it doesn't load, Windows Firewall is blocking Node.js on that network – allow it when Windows asks
(or in Windows Security → Firewall → Allow an app).

Note: the service worker (offline/PWA install) only registers on `https://` or `localhost`, so it is
not active in this setup. Use the Android app below for the full experience.

## Android app (Capacitor)

The `android/` folder is a Capacitor 8 project (`capacitor.config.ts`, app id `se.ashenhollow.game`):
locked to landscape (`sensorLandscape`), immersive fullscreen (`MainActivity.java`), launcher icons
from `npm run icons`.

```bash
npm run android            # vite build + npx cap sync android
```

Build a debug APK (uses Android Studio's bundled JDK 21):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android; .\gradlew.bat assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

Install on the phone over USB: enable **Developer options → USB debugging** (USB tethering alone does
not give adb access), accept the RSA prompt on the phone, then:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r android\app\build\outputs\apk\debug\app-debug.apk
```

Or open `android/` in Android Studio and press Run.

## PWA

`vite-plugin-pwa` generates a service worker that precaches the game (~1.9 MB + audio streamed) and a
manifest (fullscreen, landscape, icons in `public/icons`). Serve `dist/` over HTTPS and "Add to Home
screen" to install.
