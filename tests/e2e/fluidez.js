#!/usr/bin/env node
'use strict';
/**
 * Fluidez del front + back vistos desde el navegador, por lenguaje y frente a PHP (referencia).
 *
 *   node tests/e2e/fluidez.js [--veces=3]   (vueltas sobre las 6 lecciones comunes; 7 cargas de página por lenguaje)
 *
 * p50 de: interactivo (carga de /<lang>), abrir una lección del árbol, cambiar de pestaña,
 * pulsar una tecla -> marcadores del lint, y Ctrl+Enter -> salida visible.
 * Objetivo: cada medida <= max(PHP x 1,2, PHP + 30 ms); ejecutar en Java <= PHP + 400 ms.
 * Arranca su propio servidor en un puerto libre. Sale con código 1 si algo no se cumple.
 */
const { startServer, launch, cacheExternal, p50 } = require('./lib.js');

const ROUNDS = Math.max(1, parseInt((process.argv.find(a => a.startsWith('--veces=')) || '--veces=3').slice(8), 10));
const REPS = 7; // cargas completas de la página por lenguaje
const LANGS = ['php', 'python', 'java', 'cpp'];
// Mismas lecciones en los tres lenguajes (las que existen en todos y no dependen de bibliotecas externas)
const TEMAS = ['colecciones', 'recursion', 'ordenacion', 'busqueda', 'estructuras', 'grafos-dp'];
const TEMARIO = require('../../contenido/temario.json').lecciones;
const FILES = Object.fromEntries(LANGS.map(l => [l, TEMAS.map(t => TEMARIO.find(x => x.id === t)[l].archivo)]));
const METRICS = [
  ['interactivo', 'interactivo'],
  ['abrir', 'abrir lección'],
  ['pestaña', 'cambiar pestaña'],
  ['lint', 'tecla -> lint'],
  ['ejecutar', 'Ctrl+Enter -> salida'],
];

const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
const now = () => performance.now();

/** Una carga completa de /<lang> hasta que el árbol, la pestaña y el editor están listos. */
async function loadOnce(browser, base, lang) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1280, height: 800 } });
  await cacheExternal(ctx);
  const page = await ctx.newPage();
  const t0 = now();
  await page.goto(`${base}/${lang}`, { waitUntil: 'commit' });
  await page.waitForFunction(() =>
    document.querySelector('#tree .tree-item') && document.querySelector('.tab.active') &&
    document.querySelector('#editor .monaco-editor .view-line') && !document.querySelector('#editor-island.is-empty'), null, { polling: 'raf', timeout: 60000 });
  const ms = now() - t0;
  await ctx.close();
  return ms;
}

async function measureInteraction(browser, base, lang) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1280, height: 800 } });
  await cacheExternal(ctx);
  const page = await ctx.newPage();
  await page.goto(`${base}/${lang}`);
  await page.waitForSelector('#editor .monaco-editor .view-line', { timeout: 60000 });
  await page.waitForSelector('#tree .tree-item');
  const res = { abrir: [], pestaña: [], lint: [], ejecutar: [] };
  const activate = async file => {
    await page.click(`.tab[title$="/${file}"]`);
    await page.waitForFunction(f => document.querySelector('.tab.active')?.title.endsWith('/' + f), file, { polling: 'raf' });
  };

  // Abrir lección: clic en el árbol -> pestaña activa con el texto pintado
  for (const file of FILES[lang]) {
    const t0 = now();
    await page.click(`#tree .tree-item[data-name="${file}"]`);
    await page.waitForFunction(f => document.querySelector('.tab.active')?.title.endsWith('/' + f) && document.querySelector('#editor .monaco-editor .view-line'), file, { polling: 'raf' });
    await frames(page);
    res.abrir.push(now() - t0);
    await page.waitForTimeout(700); // deja pasar el lint de la pestaña nueva
  }

  // Cambiar de pestaña
  for (let r = 0; r < ROUNDS; r++) {
    for (const file of FILES[lang]) {
      const t0 = now();
      await activate(file);
      await frames(page);
      res.pestaña.push(now() - t0);
      await page.waitForTimeout(150);
    }
  }
  await page.waitForTimeout(700);

  // Lint: tecla -> respuesta de api?action=lint -> marcadores pintados
  for (let r = 0; r < ROUNDS; r++) {
    for (const file of FILES[lang]) {
      await activate(file);
      await page.waitForTimeout(700);
      await page.click('#editor .monaco-editor .view-lines');
      await page.keyboard.press('Control+End');
      for (const key of ['Space', 'Backspace']) {
        const wait = page.waitForResponse(x => x.url().includes('action=lint'), { timeout: 15000 });
        const t0 = now();
        await page.keyboard.press(key);
        await wait;
        await frames(page);
        res.lint.push(now() - t0);
        await page.waitForTimeout(150);
      }
    }
  }

  // Ejecutar: Ctrl+Enter -> salida visible
  for (let r = 0; r < ROUNDS; r++) {
    for (const file of FILES[lang]) {
      await activate(file);
      await page.waitForTimeout(700);
      await page.evaluate(() => document.querySelector('#panel-salida').replaceChildren());
      const t0 = now();
      await page.keyboard.press('Control+Enter');
      await page.waitForFunction(() => document.querySelector('#panel-salida .out-pre, #panel-salida .diag') && !document.querySelector('#btn-run.running'), null, { polling: 'raf', timeout: 60000 });
      await frames(page);
      res.ejecutar.push(now() - t0);
    }
  }
  await ctx.close();
  return res;
}

(async () => {
  const server = await startServer();
  const browser = await launch();
  let code = 0;
  try {
    const data = {};
    // Las cargas se alternan entre lenguajes (PHP, Python, Java, PHP...) para que la deriva de la máquina no favorezca a ninguno
    const inter = { php: [], python: [], java: [], cpp: [] };
    await loadOnce(browser, server.base, 'php'); // calentamiento: llena la caché del CDN
    for (let i = 0; i < REPS; i++) for (const lang of LANGS) inter[lang].push(await loadOnce(browser, server.base, lang));
    for (const lang of LANGS) {
      const rest = await measureInteraction(browser, server.base, lang);
      data[lang] = { interactivo: p50(inter[lang]), abrir: p50(rest.abrir), pestaña: p50(rest.pestaña), lint: p50(rest.lint), ejecutar: p50(rest.ejecutar) };
    }
    const f = x => x.toFixed(0).padStart(5) + ' ms';
    console.log('p50 (ms) y límite frente a PHP');
    for (const lang of LANGS) {
      for (const [key, label] of METRICS) {
        const v = data[lang][key];
        const ref = data.php[key];
        let line = `${lang.padEnd(7)} ${label.padEnd(22)} ${f(v)}`;
        if (lang !== 'php') {
          const limit = key === 'ejecutar' && lang === 'java' ? ref + 400 : key === 'ejecutar' && lang === 'cpp' ? ref + 2500 : Math.max(ref * 1.2, ref + 30);
          const ok = v <= limit;
          if (!ok) code = 1;
          line += `   PHP ${f(ref)}  límite ${f(limit)}  ${ok ? 'ok' : 'FALLA'}`;
        }
        console.log(line);
      }
    }
    console.log(code ? '\nFLUIDEZ FUERA DE OBJETIVO' : '\nFLUIDEZ OK');
  } catch (e) {
    console.error(e);
    code = 1;
  } finally {
    await browser.close().catch(() => {});
    server.stop();
  }
  process.exit(code);
})();
