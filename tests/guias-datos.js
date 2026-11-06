#!/usr/bin/env node
'use strict';
/**
 * Valida la estructura de los datos de cada guía (assets/guias/data/<id>.js) sin navegador:
 * textos en es y en, líneas dentro del código, ids que existen en la escena, punteros '→id' válidos,
 * zonas/grupos coherentes, trazas bien formadas, una sola respuesta correcta por pregunta, `jugar` completo…
 *
 *   node tests/guias-datos.js [id…]      (sin ids: todas las guías de contenido/guias.json que tengan datos)
 *
 * Cada tipo de escena distinto de «celdas» aporta sus reglas en tests/guias/validar-<clave>.js:
 *   module.exports = () => (p, w, info) => { … }     (la fábrica se llama una vez por guía)
 * Se invoca con cada paso y cada frame de traza cuya escena activa sea de ese tipo; w(msg) registra un error;
 * info = { frame: boolean, code: {es, en}, G }.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const CLAVES = ['celdas', 'barras', 'arbol', 'grafica', 'tabla', 'funcion', 'campo'];
const LEYENDA = ['activo', 'compara', 'hecho', 'mal', 'camino', 'aux']; // claves de `leyenda` (ver cabecera de assets/guias/guia.js)
const todas = require('../contenido/guias.json').guias.map(g => g.id);
const ids = (process.argv.slice(2).length ? process.argv.slice(2) : todas)
  .filter(id => fs.existsSync(path.join(ROOT, 'assets/guias/data', id + '.js')));
const L = (x, lang) => (x && typeof x === 'object' && 'es' in x ? x[lang] : x) ?? '';
const validadorDe = tipo => {
  const f = path.join(__dirname, 'guias', `validar-${tipo}.js`);
  return fs.existsSync(f) ? require(f)() : null;
};

async function validar(id) {
  const err = [];
  const G = (await import(pathToFileURL(path.join(ROOT, 'assets/guias/data', id + '.js')).href)).default, pasos = G.pasos ?? [];
  if (!G.titulo?.es || !G.titulo?.en) err.push('titulo {es,en} requerido');
  if (G.fuentes !== undefined) {
    if (!Array.isArray(G.fuentes) || !G.fuentes.length) err.push('fuentes: lista no vacía de cadenas (APA 7)');
    else G.fuentes.forEach((f, k) => {
      if (typeof f !== 'string' || !f.trim()) err.push(`fuentes[${k}]: cadena no vacía requerida`);
      else if (f.length > 600) err.push(`fuentes[${k}]: ${f.length} caracteres (máx. 600)`);
    });
  }
  if (!pasos.length) err.push('sin pasos');
  let tipo = null, def = null, st = {}, val = {}, code = { es: '', en: '' };
  const ext = {};
  const ex = x => def && def.celdas.some(c => c.id === x);
  const nl = () => L(code, 'es').split('\n').length;

  // Parche de escena «celdas» (paso o frame): ids que existen, punteros válidos, énfasis a/b/c
  const parcheCeldas = (p, w) => {
    for (const k of ['mostrar', 'ocultar', 'fantasma']) for (const x of p[k] || []) if (!ex(x)) w(`${k}: celda desconocida «${x}»`);
    for (const [x, v] of Object.entries(p.val || {})) {
      if (!ex(x)) w(`val: celda desconocida «${x}»`);
      if (typeof v === 'string' && v[0] === '→' && v !== '→∅' && !ex(v.slice(1))) w(`val ${x}: puntero a «${v.slice(1)}» que no existe`);
    }
    const grupos = new Set((def.grupos || []).map(g => g.id));
    for (const [x, c] of Object.entries(p.hl || {})) {
      if (!ex(x) && !grupos.has(x)) w(`hl: celda o grupo desconocido «${x}»`);
      if (c.length !== 1 || !'abc'.includes(c)) w(`hl ${x}: usa 'a','b' o 'c'`);
    }
    for (const x of p.mostrar || []) st[x] = 'vivo';
    for (const x of p.ocultar || []) delete st[x];
    for (const x of p.fantasma || []) st[x] = 'fantasma';
    Object.assign(val, p.val);
  };
  const nuevaCeldas = (p, w) => {
    def = { celdas: p.celdas, cols: p.cols ?? null, zonas: p.zonas ?? null, grupos: p.grupos ?? null }; st = {}; val = {};
    const cid = new Set(), dirs = new Set(), ncols = 1 + Math.max(...p.celdas.map(c => c.col || 0)), grupos = new Set((p.grupos || []).map(g => g.id));
    let abierto = {};
    const cerrados = new Set();
    for (const c of p.celdas) {
      if (!c.id || cid.has(c.id)) w(`id de celda repetido o vacío (${c.id})`);
      if (dirs.has(c.addr)) w(`dirección repetida ${c.addr}`);
      cid.add(c.id); dirs.add(c.addr);
      if ((c.col || 0) > 1) w(`celda ${c.id}: col máx. 1 (dos columnas)`);
      const col = c.col || 0, g = c.grupo || null;
      if (g !== (abierto[col] ?? null)) {
        if (abierto[col]) cerrados.add(abierto[col]);
        if (g && cerrados.has(g)) w(`grupo «${g}»: sus celdas deben ser consecutivas en la columna`);
        abierto[col] = g;
      }
      if (g && !grupos.has(g)) w(`celda ${c.id}: grupo «${g}» no está en grupos[]`);
    }
    if (p.cols && p.cols.length !== ncols) w('cols no coincide con el nº de columnas usadas');
    for (const z of p.zonas || []) {
      if ((z.col || 0) >= ncols) w(`zona: col ${z.col} no existe`);
      if (!['pila', 'heap', 'datos'].includes(z.tono || 'datos')) w(`zona: tono «${z.tono}» (pila|heap|datos)`);
      if (!z.titulo?.es && typeof z.titulo !== 'string') w('zona: falta titulo');
    }
    for (const g of p.grupos || []) if (!g.id || !g.titulo) w('grupos[]: cada grupo necesita id y titulo');
  };

  pasos.forEach((p, i) => {
    const w = m => err.push(`paso ${i + 1}: ${m}`);
    const nuevo = CLAVES.find(c => p[c] !== undefined);
    if (nuevo) { tipo = nuevo; if (nuevo === 'celdas') nuevaCeldas(p, w); }
    if (p.code !== undefined) code = typeof p.code === 'object' ? p.code : { es: p.code, en: p.code };
    for (const lang of ['es', 'en']) {
      const t = p[lang];
      if (typeof t !== 'string' || !t.trim()) w(`falta el texto «${lang}»`);
      else {
        if ((t.match(/`/g) || []).length % 2) w(`${lang}: backticks desparejados`);
        if ((t.match(/\$/g) || []).length % 2) w(`${lang}: $ desparejados`);
        if (t.length > 420) w(`${lang}: texto largo (${t.length} car.); el panel muestra ~6 líneas, divide el paso`);
      }
    }
    if (typeof p.line === 'number' && (p.line < 1 || p.line > nl())) w(`line ${p.line} fuera del código (${nl()} líneas)`);
    if (p.leyenda !== undefined) {
      if (!Array.isArray(p.leyenda) || !p.leyenda.length) w('leyenda: lista no vacía de claves');
      else {
        for (const k of p.leyenda) if (!LEYENDA.includes(k)) w(`leyenda: clave desconocida «${k}» (${LEYENDA.join('|')})`);
        if (new Set(p.leyenda).size !== p.leyenda.length) w('leyenda: claves repetidas');
      }
    }
    if (L(code, 'es').split('\n').length !== L(code, 'en').split('\n').length) w('el código es y en tiene distinto nº de líneas');
    if (!tipo) w('el primer paso debe abrir una escena (celdas, barras, arbol o grafica)');
    if (tipo && tipo !== 'celdas' && !(tipo in ext)) ext[tipo] = validadorDe(tipo);
    const info = frame => ({ frame, code, G });
    if (tipo === 'celdas') parcheCeldas(p, w);
    else if (tipo && ext[tipo]) { const { leyenda, ...resto } = p; ext[tipo](resto, w, info(false)); } // `leyenda` es genérica: se valida arriba

    if (p.traza !== undefined) {
      if (!Array.isArray(p.traza) || !p.traza.length) w('traza: array de frames no vacío');
      else {
        if (p.traza.length > 2000) w(`traza: ${p.traza.length} frames (máx. 2000)`);
        p.traza.forEach((f, k) => {
          const wf = m => w(`traza frame ${k + 1}: ${m}`);
          if (typeof f.line === 'number' && (f.line < 1 || f.line > nl())) wf(`line ${f.line} fuera del código`);
          for (const lang of ['es', 'en']) if (f[lang] !== undefined && typeof f[lang] !== 'string') wf(`${lang} debe ser texto`);
          if (tipo === 'celdas') parcheCeldas(f, wf);
          else if (tipo && ext[tipo]) ext[tipo](f, wf, info(true));
        });
      }
    }
    if (p.pregunta) {
      const ok = (p.pregunta.opc || []).filter(o => o.ok).length;
      if (ok !== 1) w(`pregunta: debe haber exactamente 1 opción ok (hay ${ok})`);
      for (const o of p.pregunta.opc || []) if (!o.es || !o.en) w('pregunta: opción sin es/en');
      if (!p.pregunta.why?.es || !p.pregunta.why?.en) w('pregunta: falta why {es,en}');
    }
    if (p.jugar) {
      const J = p.jugar;
      if (!Array.isArray(J.botones) || !J.botones.length || typeof J.lecturas !== 'function') w('jugar: necesita botones[] y lecturas()');
      else if (tipo === 'celdas') {
        // Ejecuta los botones sobre una copia para detectar excepciones y estados inválidos
        const v = { ...val }, cx = { cel: Object.fromEntries(def.celdas.map(c => [c.id, c])) };
        try {
          for (let r = 0; r < 12; r++) for (const b of J.botones) {
            if (!(b.off && b.off(v, cx))) b.hacer(v, cx);
            for (const x of Object.values(v)) if (typeof x === 'string' && x[0] === '→' && x !== '→∅' && !ex(x.slice(1))) throw new Error(`apunta a «${x.slice(1)}»`);
            J.lecturas(v, cx); J.hl && J.hl(v, cx);
          }
          for (const a of J.arrastrables || []) if (!ex(a)) throw new Error(`arrastrables: celda desconocida «${a}»`);
          if (J.arrastrables?.length && typeof J.soltar !== 'function') throw new Error('arrastrables necesita soltar(v, origen, destino)');
        } catch (e) { w('jugar: ' + e.message); }
      }
    }
  });
  if (pasos.length && !pasos[0].sec) err.push('el primer paso debe llevar sec {es,en}');
  pasos.forEach((p, i) => { if (p.sec && (!p.sec.es || !p.sec.en)) err.push(`paso ${i + 1}: sec necesita es y en`); });
  const q = pasos.filter(p => p.pregunta).length, j = pasos.filter(p => p.jugar).length, t = pasos.filter(p => p.traza).length;
  console.log(`${err.length ? '✗' : '✓'} ${id}: ${pasos.length} pasos, ${q} preguntas, ${j} interactivos${t ? `, ${t} trazas` : ''}`);
  for (const e of err) console.log('    ' + e);
  return err.length;
}

(async () => {
  let fallos = 0;
  for (const id of ids) fallos += await validar(id).catch(e => { console.log(`✗ ${id}: no se pudo cargar: ${e.message}`); return 1; });
  process.exitCode = fallos ? 1 : 0;
})();
