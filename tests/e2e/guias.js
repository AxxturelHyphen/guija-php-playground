#!/usr/bin/env node
'use strict';
/**
 * Guías visuales (/guias): recorre cada guía publicada en ES y EN sin errores de consola, pulsa los bloques
 * interactivos y las preguntas, mide el peor frame durante las transiciones y comprueba que el botón «Guías»
 * del IDE de C++ abre una pestaña nueva.
 *
 *   node tests/e2e/guias.js [--solo=punteros] [--fotos]    (--fotos: capturas en var/e2e/guias-<id>-<lang>-<paso>.png)
 *
 * Arranca su propio servidor en un puerto libre. Sale con código 1 si algo falla.
 */
const fs = require('fs');
const path = require('path');
const { ROOT, startServer, launch, cacheExternal } = require('./lib.js');

const SOLO = (process.argv.find(a => a.startsWith('--solo=')) || '').slice(7);
const FOTOS = process.argv.includes('--fotos');
const OUT = path.join(ROOT, 'var', 'e2e');
const GUIAS = require('../../contenido/guias.json').guias
  .map(g => g.id).filter(id => fs.existsSync(path.join(ROOT, 'assets', 'guias', 'data', id + '.js')) && (!SOLO || id === SOLO));

const fallos = [];
const fallo = (msg) => { fallos.push(msg); console.log('  ✗ ' + msg); };

/** Peor intervalo entre frames (ms) mientras se ejecuta `accion` y durante `ms` después. */
async function peorFrame(page, accion, ms = 700) {
  await page.evaluate(() => { window.__f = { max: 0, last: performance.now(), on: true };
    const tick = t => { if (!window.__f.on) return; window.__f.max = Math.max(window.__f.max, t - window.__f.last); window.__f.last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick); });
  await accion();
  await page.waitForTimeout(ms);
  return page.evaluate(() => { window.__f.on = false; return Math.round(window.__f.max); });
}

async function recorrer(browser, base, id, lang) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1280, height: 800 } });
  await cacheExternal(ctx);
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errores.push('console: ' + m.text()); });
  await page.goto(`${base}/guias/${id}?lang=${lang}#1`);
  await page.waitForSelector('body.listo', { timeout: 20000 });
  const total = await page.locator('#pista button').count();
  let peor = 0, interactivos = 0, preguntas = 0;
  for (let i = 1; i <= total; i++) {
    if (i > 1) peor = Math.max(peor, await peorFrame(page, () => page.keyboard.press('ArrowRight')));
    else await page.waitForTimeout(600);
    const txt = (await page.locator('#texto').innerText()).trim();
    if (!txt || /undefined|\[object|NaN/.test(txt)) fallo(`${id}/${lang} paso ${i}: texto vacío o roto («${txt.slice(0, 40)}»)`);
    if (await page.locator('#codigo').isVisible() && !(await page.locator('#codigo .ln').count())) fallo(`${id}/${lang} paso ${i}: código vacío`);
    if (!(await page.locator('#viewport .cel:not(.oculta)').count()) && i > 1) fallo(`${id}/${lang} paso ${i}: ninguna celda visible`);
    for (const b of await page.locator('#jugar .botones .btn').all()) {
      for (let k = 0; k < 6 && await b.isEnabled(); k++) await b.click();
      interactivos++;
    }
    if (await page.locator('#jugar .opc').count()) {
      await page.locator('#jugar .opc:not([data-ok])').first().click();
      if (!(await page.locator('#jugar .opc.ok').count())) fallo(`${id}/${lang} paso ${i}: la pregunta no marca la correcta`);
      preguntas++;
    }
    if (FOTOS && (i === 1 || i === 3 || i === Math.ceil(total / 2) || i === total)) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: path.join(OUT, `guias-${id}-${lang}-${i}.png`) }); }
  }
  // Volver atrás y por la barra de progreso
  await page.keyboard.press('Home');
  if (!/1 \/ /.test(await page.locator('#meta').innerText())) fallo(`${id}/${lang}: Home no vuelve al paso 1`);
  await page.locator('#pista button').nth(total - 1).click();
  if (!new RegExp(`${total} / ${total}`).test(await page.locator('#meta').innerText())) fallo(`${id}/${lang}: la barra de progreso no salta al último paso`);
  if (errores.length) fallo(`${id}/${lang}: ${errores.length} error(es) de consola: ${errores[0]}`);
  console.log(`  ${id}/${lang}: ${total} pasos, ${interactivos} botones, ${preguntas} preguntas, peor frame ${peor} ms`);
  if (peor > 100) fallo(`${id}/${lang}: peor frame ${peor} ms (> 100 ms: la animación no es fluida)`);
  await ctx.close();
}

(async () => {
  const srv = await startServer();
  const browser = await launch();
  try {
    console.log('Índice y rutas');
    const idx = await fetch(srv.base + '/guias');
    if (idx.status !== 200) fallo('/guias no responde 200');
    for (const bad of ['/guias/nope', '/guias/PUNTEROS', '/guias/punteros/x']) if ((await fetch(srv.base + bad)).status !== 404) fallo(`${bad} debería dar 404`);

    console.log('Botón del IDE');
    const ctx = await browser.newContext();
    const ide = await ctx.newPage();
    await ide.goto(srv.base + '/cpp', { waitUntil: 'commit' });
    await ide.waitForSelector('#btn-guias', { timeout: 20000 });
    const [pop] = await Promise.all([ide.waitForEvent('popup', { timeout: 10000 }), ide.click('#btn-guias')]);
    if (!pop.url().endsWith('/guias')) fallo('el botón Guías no abre /guias en otra pestaña');
    await ctx.close();

    for (const id of GUIAS) { console.log(`Guía ${id}`); for (const lang of ['es', 'en']) await recorrer(browser, srv.base, id, lang); }
  } finally {
    await browser.close(); srv.stop();
  }
  console.log(fallos.length ? `\n${fallos.length} fallo(s)` : '\nTodo bien');
  process.exit(fallos.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
