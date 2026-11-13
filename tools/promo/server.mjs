// Tiny local receiver for the promo capture: serves director.js to the game page and saves frames it POSTs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
fs.mkdirSync(OUT, { recursive: true });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Cache-Control': 'no-store',
};

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET') {
      const f = path.join(ROOT, path.normalize(url.pathname).replace(/^[\\/]+/, ''));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) return res.writeHead(404, cors).end();
      const type = { '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' }[path.extname(f)] ?? 'text/javascript';
      return res.writeHead(200, { ...cors, 'Content-Type': type }).end(fs.readFileSync(f));
    }
    // POST /save/<dir>/<file>  body: data URL or text
    const m = url.pathname.match(/^\/save\/([\w-]+)\/([\w.-]+)$/);
    if (req.method !== 'POST' || !m) return res.writeHead(400, cors).end();
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const dir = path.join(OUT, m[1]);
      fs.mkdirSync(dir, { recursive: true });
      const comma = body.startsWith('data:') ? body.indexOf(',') : -1;
      const data = comma >= 0 ? Buffer.from(body.slice(comma + 1), 'base64') : Buffer.from(body, 'utf8');
      fs.writeFileSync(path.join(dir, m[2]), data);
      res.writeHead(200, cors).end('ok');
    });
  })
  .listen(5199, '127.0.0.1', () => console.log('promo receiver on 5199'));
