#!/usr/bin/env node
'use strict';
/**
 * Recorrido completo por cada lenguaje, como lo haría una persona:
 *   elegir (pantalla de inicio) -> abrir una lección con ejercicios -> Ejecutar -> Medir -> Comparar.
 * Falla (código 1) ante cualquier error de consola, excepción de la página o respuesta 4xx/5xx.
 * Python 08 (NumPy y matplotlib) debe mostrar una imagen en Salida.
 * Capturas (deviceScaleFactor 1) en var/e2e/. Arranca su propio servidor en un puerto libre.
 *
 *   node tests/e2e/recorrido.js
 */
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, startServer, launch, cacheExternal } = require('./lib.js');

const OUT = path.join(ROOT, 'var', 'e2e');
const TEMARIO = require('../../contenido/temario.json').lecciones;
const leccion = (id, lang) => TEMARIO.find(l => l.id === id)[lang].archivo;
const IDLE = () => { const b = document.querySelector('#btn-run'); return !b.classList.contains('running') && !b.disabled; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await launch();
  const fallos = [];
  try {
    for (const lang of ['php', 'python', 'java', 'cpp']) {
      const ctx = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: 1280, height: 800 } });
      await cacheExternal(ctx);
      const page = await ctx.newPage();
      const problemas = [];
      page.on('console', m => { if (m.type() === 'error') problemas.push(`[${lang}] consola: ${m.text()}`); });
      page.on('pageerror', e => problemas.push(`[${lang}] excepción: ${e.message}`));
      page.on('response', r => { if (r.status() >= 400) problemas.push(`[${lang}] HTTP ${r.status()} ${r.request().method()} ${r.url()}`); });
      const foto = name => page.screenshot({ path: path.join(OUT, `${lang}-${name}.png`) });
      const paso = async (nombre, fn) => {
        const t0 = Date.now();
        try { await fn(); console.log(`ok   ${lang.padEnd(6)} ${nombre} (${Date.now() - t0} ms)`); }
        catch (e) { problemas.push(`[${lang}] ${nombre}: ${e.message.split('\n')[0]}`); console.log(`FALLA ${lang.padEnd(6)} ${nombre}`); await foto('fallo-' + nombre.replace(/\W+/g, '-')).catch(() => {}); }
      };
      const abrir = async file => {
        await page.click(`#tree .tree-item[data-name="${file}"]`);
        await page.waitForFunction(f => document.querySelector('.tab.active')?.title.endsWith('/' + f), file);
        await page.waitForTimeout(400);
      };

      await paso('elegir', async () => {
        await page.goto(server.base + '/');
        await page.waitForFunction(() => [...document.querySelectorAll('[data-status]')].every(s => !/Comprobando/.test(s.textContent)));
        await foto('1-inicio');
        await Promise.all([page.waitForURL('**/' + lang), page.click(`.lang-card[data-lang="${lang}"]`)]);
        await page.waitForSelector('#editor .monaco-editor .view-line', { timeout: 60000 });
        await page.waitForSelector('#tree .tree-item');
      });
      const file = leccion('recursion', lang);
      await paso('abrir lección', async () => {
        await abrir(file);
        if (!(await page.$('.tab.active'))) throw new Error('sin pestaña activa');
        await foto('2-leccion');
      });
      await paso('ejecutar', async () => {
        await page.click('#editor .monaco-editor .view-lines');
        await page.keyboard.press('Control+Enter');
        await page.waitForFunction(IDLE, null, { timeout: 60000 });
        await page.waitForSelector('#panel-salida .out-pre, #tool-tabs .tool-tab.active[data-panel="pruebas"]');
        await foto('3-ejecutar');
      });
      await paso('medir', async () => {
        await page.keyboard.press('Control+Alt+Enter');
        await page.waitForFunction(IDLE, null, { timeout: 90000 });
        await page.waitForTimeout(300);
        await foto('4-medir');
      });
      await paso('comparar', async () => {
        if (await page.$eval('#btn-compare', b => b.disabled)) throw new Error('Comparar está desactivado: la lección no tiene solución');
        await page.keyboard.press('Control+Shift+Enter');
        await page.waitForFunction(IDLE, null, { timeout: 90000 });
        await page.waitForSelector('#panel-solucion:not([hidden]) *', { timeout: 10000 });
        await page.waitForTimeout(500);
        await foto('5-comparar');
      });

      if (lang === 'python') {
        await paso('08 NumPy y matplotlib: imagen en Salida', async () => {
          await abrir(leccion('numpy', 'python'));
          await page.click('#editor .monaco-editor .view-lines');
          await page.keyboard.press('Control+Enter');
          await page.waitForFunction(IDLE, null, { timeout: 60000 });
          await page.click('.tool-tab[data-panel="salida"]');   // con ejercicios, tras ejecutar se abre «Pruebas»
          await page.waitForSelector('#panel-salida figure.out-img img', { state: 'visible', timeout: 15000 });
          const ok = await page.$eval('#panel-salida figure.out-img img', async i => { await i.decode().catch(() => {}); return i.naturalWidth > 0; });
          if (!ok) throw new Error('la imagen no se decodifica');
          await foto('6-numpy');
        });
      }
      fallos.push(...problemas);
      await ctx.close();
    }
  } catch (e) {
    fallos.push('error del test: ' + e.message);
  } finally {
    await browser.close().catch(() => {});
    server.stop();
  }
  if (fallos.length) { console.log('\n' + fallos.join('\n') + '\n\nRECORRIDO CON ERRORES'); process.exit(1); }
  console.log(`\nRECORRIDO OK (capturas en ${path.relative(ROOT, OUT)}/)`);
  process.exit(0);
})();
