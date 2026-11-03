// Utilidades comunes de los tests E2E: servidor propio en un puerto libre, navegador y caché del CDN de Monaco.
'use strict';
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function startServer() {
  const port = await freePort();
  const env = { ...process.env };
  const child = spawn('php', ['-S', `127.0.0.1:${port}`, 'index.php'], { cwd: ROOT, env, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(base + '/', { signal: AbortSignal.timeout(1000) }); if (r.ok) break; } catch { /* aún no */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return { base, stop: () => { try { child.kill('SIGKILL'); } catch { /* ya parado */ } } };
}

/** Lanza Chromium. 127.0.0.1 va siempre directo; el CDN (Monaco) usa el proxy del entorno si lo hay. */
async function launch() {
  const { chromium } = require('playwright');
  const p = process.env.HTTPS_PROXY || process.env.https_proxy;
  const opts = {};
  if (p) {
    const u = new URL(p);
    opts.proxy = { server: `${u.protocol}//${u.host}`, bypass: '127.0.0.1,localhost', ...(u.username ? { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } : {}) };
  } else {
    opts.proxy = { server: 'direct://' };
  }
  return chromium.launch(opts);
}

/** Sirve los recursos externos (Monaco, fuentes) desde memoria tras la primera descarga: así la red no ensucia las medidas. */
const cache = new Map();
async function cacheExternal(context) {
  await context.route(url => !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url.href), async route => {
    const key = route.request().url();
    let hit = cache.get(key);
    if (!hit) {
      try {
        const res = await route.fetch();
        hit = { status: res.status(), headers: res.headers(), body: await res.body() };
        if (hit.status === 200) cache.set(key, hit);
      } catch { return route.abort(); }
    }
    return route.fulfill(hit);
  });
  return cache;
}

function p50(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
}

module.exports = { ROOT, startServer, launch, cacheExternal, p50 };
