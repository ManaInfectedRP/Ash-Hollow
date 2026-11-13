# Promo capture

Records the teaser and promo stills straight from the running game (frame-stepped, so the video is
smooth regardless of machine speed).

1. `npm run dev` (game on :5180) and `node tools/promo/server.mjs` (receiver on :5199, frames land in
   `tools/promo/out/`).
2. Open `http://127.0.0.1:5180/?debug` and in the console:
   ```js
   const D = await import('http://127.0.0.1:5199/director.js'); D.init();
   const T = await import('http://127.0.0.1:5199/teaser.js');
   D.st.dir = 'teaser'; await T.run(D);              // 1920×1080 JPEG frames + sound.json
   ```
   For stills: run again with `D.st.rawEvery = 4; D.st.noVideo = true` (raw 480×270 PNGs in `out/raw`),
   pick frame numbers, set them in `stills.js` and run `(await import('http://127.0.0.1:5199/stills.js')).all()`.
3. `node tools/promo/mix.mjs tools/promo/out/teaser promo/teaser.mp4` – rebuilds the logged sound
   effects, lays the music (Hollow ambience → boss theme from the card → silence at the death →
   ambience under the title) and encodes H.264/AAC. Needs ffmpeg (path at the top of `mix.mjs`).

Shots, copy and timings live in `teaser.js`; overlays (text, logo, boss bar, YOU DIED) in `director.js`.
All audio is CC0 (see docs/AUDIO.md).
