// Builds the teaser: mixes the logged game sound effects into sfx.wav, then muxes frames + music + sfx with ffmpeg.
// node mix.mjs <framesDir> <out.mp4>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const FF = 'C:/Users/quo/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0-full_build/bin/ffmpeg.exe';
const GAME = 'E:/repos/SoulsPlatformer/public/assets/audio';
const [, , framesDir, outFile] = process.argv;
const SR = 48000;

const SAMPLES = {
  swing: ['swing1', 'swing2'], heavy: ['heavy1', 'heavy2', 'heavy3'], hit: ['hit1'], clang: ['clang1', 'clang2', 'clang3'],
  step: ['step0', 'step2', 'step4', 'step6', 'step8'], roll: ['roll1', 'roll2', 'roll3', 'roll4'], jump: ['jump'],
  pickup: ['pickup1', 'pickup2'], souls: ['souls1', 'souls2'], doorOpen: ['door_open1', 'door_open2'], locked: ['locked1', 'locked2'],
  fire: ['fire1', 'fire2'], levelUp: ['levelup'], hurt: ['hurt1', 'hurt2'], die: ['die1'], roar: ['roar1', 'roar2'],
  monster: ['monster1', 'monster2'], stones: ['stones1', 'stones2', 'stones3'], wood: ['wood1', 'wood2'], drink: ['drink'],
};
/** per-sample mix trims (footsteps are constant, keep them low) */
const TRIM = { step: 0.3, souls: 0.5, roll: 0.7 };

const meta = JSON.parse(fs.readFileSync(path.join(framesDir, 'sound.json'), 'utf8'));
const dur = meta.frames / 30;
const mix = new Float32Array(Math.ceil((dur + 2) * SR));

const cache = new Map();
function decode(file) {
  if (cache.has(file)) return cache.get(file);
  const raw = execFileSync(FF, ['-v', 'error', '-i', `${GAME}/sfx/${file}.ogg`, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], { maxBuffer: 1 << 28 });
  const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
  cache.set(file, pcm);
  return pcm;
}

let placed = 0;
for (const ev of meta.log) {
  const files = SAMPLES[ev.name];
  if (!files) continue;
  const pcm = decode(files[Math.floor(Math.random() * files.length)]);
  const rate = (ev.rate ?? 1) * (0.95 + Math.random() * 0.1);
  const vol = (ev.vol ?? 0.6) * (TRIM[ev.name] ?? 1) * 0.9;
  const start = Math.round(ev.t * SR);
  const len = Math.floor(pcm.length / rate);
  for (let i = 0; i < len && start + i < mix.length; i++) {
    const s = i * rate;
    const k = Math.floor(s);
    const f = s - k;
    mix[start + i] += vol * (pcm[k] * (1 - f) + (pcm[k + 1] ?? 0) * f);
  }
  placed++;
}
// soft clip
for (let i = 0; i < mix.length; i++) mix[i] = Math.tanh(mix[i] * 1.1);

// write 16-bit WAV
const wav = Buffer.alloc(44 + mix.length * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + mix.length * 2, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(mix.length * 2, 40);
for (let i = 0; i < mix.length; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), 44 + i * 2);
const sfxWav = path.join(framesDir, 'sfx.wav');
fs.writeFileSync(sfxWav, wav);

// ---------------------------------------------------------------- music cues from the shot list
const at = (name) => meta.shots.find((s) => s.name === name)?.t ?? null;
const tCard = at('card-death') ?? dur * 0.35;
const death = meta.log.find((e) => e.name === 'die' && e.t >= (at('death') ?? 0))?.t ?? at('logo') ?? dur - 6;
const tLogo = at('logo') ?? dur - 6;
console.log({ dur, tCard, death, tLogo, events: meta.log.length, placed });

const f2 = (x) => x.toFixed(3);
const filter = [
  // ambient Hollow bed for the opening, fading out into the card
  `[0:a]atrim=0:${f2(tCard + 0.6)},afade=t=in:d=1.5,afade=t=out:st=${f2(tCard - 0.4)}:d=1.0,volume=1.6[a0]`,
  // the boss theme hits on the card and is cut at the death
  `[1:a]atrim=0:${f2(death - tCard + 0.25)},afade=t=in:d=0.4,afade=t=out:st=${f2(death - tCard - 0.05)}:d=0.3,volume=0.75,adelay=${Math.round(tCard * 1000)}:all=1[a1]`,
  // silence after the death, then the ambience returns under the title
  `[2:a]atrim=12:${f2(12 + dur - tLogo + 1)},asetpts=PTS-STARTPTS,afade=t=in:d=2,afade=t=out:st=${f2(dur - tLogo - 1.6)}:d=1.5,volume=4.0,adelay=${Math.round(tLogo * 1000)}:all=1[a2]`,
  `[3:a]volume=1.0[sx]`,
  `[a0][a1][a2][sx]amix=inputs=4:normalize=0:duration=longest,atrim=0:${f2(dur)},alimiter=limit=0.95[aout]`,
].join(';');

execFileSync(
  FF,
  [
    '-v', 'error', '-y',
    '-framerate', '30', '-i', path.join(framesDir, 'f%05d.jpg'),
    '-i', `${GAME}/music/hollow.ogg`,
    '-i', `${GAME}/music/boss.ogg`,
    '-i', `${GAME}/music/hollow.ogg`,
    '-i', sfxWav,
    '-filter_complex', filter.replace(/\[(\d):a\]/g, (m, n) => `[${+n + 1}:a]`),
    '-map', '0:v', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '192k', '-shortest',
    outFile,
  ],
  { stdio: 'inherit' },
);
console.log('wrote', outFile);
