#!/usr/bin/env node
'use strict';
/**
 * Pruebas Node de la escena «tabla» (assets/guias/tabla.js), sin navegador:  node tests/guias/test-tabla.js
 * Plegar pura y acumulativa (val en sus tres formas, est, deps, marcas, resaltar, formula), geometría hasta 14×14, flechas,
 * marcas apiladas, vista/conVista/ctx, el ejemplo LCS de «ABCB»/«BDCB» recorrido con trazas generadas aquí (y con las de la
 * guía demo), el validador de datos y la escena DOM completa sobre un DOM de mentira (pintar, clic, teclado, flechas).
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const imp = f => import(pathToFileURL(path.join(ROOT, f)).href);
let n = 0;
const prueba = (nombre, fn) => { const r = fn(); n++; console.log('  ok  ' + nombre); return r; };
const congelar = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };

// ── DOM de mentira: lo justo para ejecutar la escena ───────────────────────────────────────────────
function montarDom() {
  class Nodo {
    constructor(tag) {
      this.tag = tag; this.hijos = []; this.padre = null; this.attrs = {}; this.dataset = {}; this.oyentes = {}; this._cls = new Set();
      this.style = { setProperty: (k, v) => { this.style[k] = v; } }; this.texto = ''; this.html = ''; this.anims = [];
      this.classList = {
        add: (...c) => c.forEach(x => this._cls.add(x)), remove: (...c) => c.forEach(x => this._cls.delete(x)), contains: c => this._cls.has(c),
        toggle: (c, f) => { const on = f ?? !this._cls.has(c); on ? this._cls.add(c) : this._cls.delete(c); return on; },
      };
    }
    get className() { return [...this._cls].join(' '); }
    set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get textContent() { return this.texto; }
    set textContent(v) { this.texto = String(v); }
    get innerHTML() { return this.html; }
    set innerHTML(v) { this.html = String(v); }
    get tabIndex() { return +this.attrs.tabindex; }
    set tabIndex(v) { this.attrs.tabindex = String(v); }
    append(...ns) { for (const x of ns) { x.padre = this; this.hijos.push(x); } }
    replaceChildren(...ns) { this.hijos = []; this.append(...ns); }
    remove() { if (this.padre) this.padre.hijos = this.padre.hijos.filter(x => x !== this); this.padre = null; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k]; }
    removeAttribute(k) { delete this.attrs[k]; }
    hasAttribute(k) { return k in this.attrs; }
    addEventListener(t, f) { (this.oyentes[t] ??= []).push(f); }
    closest(sel) { const cs = sel.split('.').filter(Boolean); for (let e = this; e; e = e.padre) if (cs.every(c => e._cls.has(c))) return e; return null; }
    focus() { dom.foco = this; }
    animate(kf, op) { const a = { kf, op, onfinish: null, cancel() { a.cancelado = true; } }; this.anims.push(a); return a; }
    getAnimations() { return this.anims; }
    desc() { return [this, ...this.hijos.flatMap(h => h.desc())]; }
  }
  const dom = { Nodo, foco: null, punto: null };
  const stage = new Nodo('div');
  globalThis.document = {
    createElement: t => new Nodo(t), createElementNS: (_, t) => new Nodo(t), getElementById: () => ({}), head: { append() {} },
    documentElement: { lang: 'es' }, elementFromPoint: () => dom.punto,
  };
  globalThis.matchMedia = () => ({ matches: false });
  dom.stage = stage;
  dom.dispara = (nodo, tipo, ev = {}) => (nodo.oyentes[tipo] || []).forEach(f => f({ target: nodo, preventDefault() {}, stopPropagation() {}, button: 0, pointerId: 1, ...ev }));
  return dom;
}

(async () => {
  const T = await imp('assets/guias/tabla.js'); // sin DOM: debe poder importarse
  const D = await imp('assets/guias/data/demo-tabla.js');
  const { plegar, defDe, geom, flecha, colocarMarcas, vista, conVista, ctx, poner, leer, estado, llave, aplicarVal, esMatriz, tamCelda, centro } = T;
  const abre = (extra = {}, def = { filas: 3, cols: 4 }) => plegar(undefined, { tabla: def, ...extra });

  console.log('plegar');
  prueba('clave, estado inicial y cabeceras por defecto', () => {
    assert.equal(T.clave, 'tabla');
    const s = abre();
    assert.deepEqual(s.val, [[null, null, null, null], [null, null, null, null], [null, null, null, null]]);
    assert.deepEqual([s.est, s.deps, s.marcas, s.formula, s.resaltar], [{}, [], {}, null, { filas: [], cols: [] }]);
    assert.deepEqual(s.def.cabF, [0, 1, 2]); assert.deepEqual(s.def.cabC, [0, 1, 2, 3]);
    const t = abre({}, { filas: 2, cols: 2, cab: { filas: ['a', 'b'], cols: [{ es: 'uno', en: 'one' }, 'y'], esq: 'i\\j' }, val: [[1, 2], ['x']] });
    assert.deepEqual(t.val, [[1, 2], ['x', null]]); assert.equal(t.def.esq, 'i\\j');
  });
  prueba('dimensiones acotadas a 1..14 y mismo objeto = mismo def', () => {
    assert.equal(defDe({ filas: 99, cols: 0 }).filas, T.MAXN); assert.equal(defDe({ filas: 99, cols: 0 }).cols, 1);
    const b = { filas: 2, cols: 2 };
    assert.equal(plegar(undefined, { tabla: b }).def, plegar(undefined, { tabla: b }).def);
    assert.notEqual(defDe({ filas: 2, cols: 2 }), defDe(b));
  });
  prueba('plegar es pura: no muta estado (congelado) ni parche', () => {
    const s = congelar(abre({ est: { '0,0': 'hecha' }, deps: [[0, 0, 1, 1]], marcas: { i: { fila: 0 } }, formula: 'x', resaltar: { filas: [0] } }));
    const p = congelar({ val: [[1, 1, 7]], est: { '1,1': 'activa' }, deps: [[1, 1, 2, 2]], marcas: { i: { fila: 2 }, j: { col: 1 } }, resaltar: { cols: [1] }, formula: null });
    const antes = JSON.stringify(s), t = plegar(s, p);
    assert.equal(JSON.stringify(s), antes);
    assert.equal(t.def, s.def); assert.notEqual(t, s);
    assert.equal(t.val[1][1], 7); assert.equal(s.val[1][1], null);
    for (const k of ['val', 'est', 'marcas', 'deps', 'resaltar']) assert.notEqual(t[k], s[k], k + ' debe ser nuevo');
    assert.equal(t.formula, null); assert.deepEqual(t.est, { '0,0': 'hecha', '1,1': 'activa' });
  });
  prueba('val: ternas, mapa y matriz; null y \'\' vacían; lo de fuera se ignora', () => {
    let s = plegar(abre(), { val: [[0, 0, 5], [2, 3, 'ab'], [9, 9, 1], [0, 1, undefined]] });
    assert.equal(s.val[0][0], 5); assert.equal(s.val[2][3], 'ab'); assert.equal(s.val[0][1], null);
    s = plegar(s, { val: { '1,1': 3, '0,0': null, '7,7': 1, malo: 2 } });
    assert.deepEqual([s.val[1][1], s.val[0][0]], [3, null]);
    s = plegar(s, { val: [[1, 2, 3, 4], [undefined, undefined, undefined, undefined], [null, null, null, null]] });
    assert.deepEqual(s.val, [[1, 2, 3, 4], [null, 3, null, null], [null, null, null, null]].map((f, r) => (r === 1 ? [null, 3, null, null] : f)).map((f, r) => (r === 2 ? [null, null, null, 'ab'].map((x, c) => (c === 3 ? null : x)) : f)));
    s = plegar(s, { val: { '0,0': '' } }); assert.equal(s.val[0][0], null);
    assert.deepEqual(plegar(s, { val: [] }).val, s.val);
  });
  prueba('val: una lista de ternas con justo `filas` elementos y 3 columnas se lee como matriz', () => {
    const m = plegar(undefined, { tabla: { filas: 3, cols: 3 }, val: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] });
    assert.deepEqual(m.val, [[0, 1, 2], [3, 4, 5], [6, 7, 8]]);
    assert.ok(esMatriz([[1, 2], [3, 4]], 2, 2)); assert.ok(!esMatriz([[1, 2, 3]], 2, 3));
    const dos = plegar(m, { val: [[0, 0, 9], [1, 1, 9]] }); assert.equal(dos.val[0][0], 9); assert.equal(dos.val[1][1], 9);
    assert.deepEqual(aplicarVal([[0]], { '0,0': 4 }), [[4]]);
  });
  prueba('est, deps, marcas, resaltar y formula: semántica de cada parche', () => {
    let s = abre({ est: { '0,0': 'lee', '1,1': 'activa', '5,5': 'lee', x: 'lee' } });
    assert.deepEqual(s.est, { '0,0': 'lee', '1,1': 'activa' });
    s = plegar(s, { est: { '0,0': null, '2,2': 'camino' } }); assert.deepEqual(s.est, { '1,1': 'activa', '2,2': 'camino' });
    s = plegar(s, {}); assert.deepEqual(s.est, { '1,1': 'activa', '2,2': 'camino' }); // un parche vacío conserva todo
    s = plegar(s, { est: null }); assert.deepEqual(s.est, {});
    s = plegar(s, { deps: [[0, 0, 1, 1], [0, 0, 0, 0], [0, 0, 9, 9], [1, 2]] }); assert.deepEqual(s.deps, [[0, 0, 1, 1]]);
    s = plegar(s, { deps: [[1, 1, 2, 2]] }); assert.deepEqual(s.deps, [[1, 1, 2, 2]]); // reemplaza
    s = plegar(s, {}); assert.equal(s.deps.length, 1);
    s = plegar(s, { deps: null }); assert.deepEqual(s.deps, []);
    s = plegar(s, { marcas: { i: { fila: 1 }, j: { col: 2 } } }); s = plegar(s, { marcas: { i: { fila: 2 } } });
    assert.deepEqual(s.marcas, { i: { fila: 2 }, j: { col: 2 } });
    s = plegar(s, { marcas: { j: null } }); assert.deepEqual(s.marcas, { i: { fila: 2 } });
    s = plegar(s, { marcas: null }); assert.deepEqual(s.marcas, {});
    s = plegar(s, { resaltar: { filas: [0, 7], cols: [3] } }); assert.deepEqual(s.resaltar, { filas: [0], cols: [3] });
    s = plegar(s, { resaltar: { filas: [1] } }); assert.deepEqual(s.resaltar, { filas: [1], cols: [] }); // reemplaza
    s = plegar(s, { resaltar: null }); assert.deepEqual(s.resaltar, { filas: [], cols: [] });
    s = plegar(s, { formula: { es: 'a', en: 'b' } }); assert.deepEqual(s.formula, { es: 'a', en: 'b' });
    s = plegar(s, { est: { '0,0': 'hecha' } }); assert.deepEqual(s.formula, { es: 'a', en: 'b' }); // se conserva
    s = plegar(s, { formula: null }); assert.equal(s.formula, null);
  });
  prueba('un paso con tabla y parches a la vez: abre y aplica', () => {
    const s = abre({ val: [[0, 0, 1]], est: { '0,0': 'hecha' }, resaltar: { filas: [0] }, formula: 'f' });
    assert.deepEqual([s.val[0][0], s.est, s.resaltar.filas, s.formula], [1, { '0,0': 'hecha' }, [0], 'f']);
  });

  console.log('geometría y flechas');
  prueba('geom: la rejilla cabe en la escena para todos los tamaños hasta 14×14', () => {
    for (let f = 1; f <= 14; f++) for (let c = 1; c <= 14; c++) for (const formula of [true, false]) {
      const g = geom(defDe({ filas: f, cols: c, cab: { filas: Array(f).fill('abcdefgh'), cols: Array(c).fill('x') }, formula: formula ? undefined : false }));
      assert.ok(g.x0 - g.hw - T.MKW >= 0 && g.x0 + g.gw <= g.W, `${f}×${c} horizontal`);
      assert.ok(g.y0 - g.hh - T.MKH >= 0 && g.y0 + g.gh <= g.H, `${f}×${c} vertical`);
      assert.ok(g.cs >= 34 && g.caja > 0 && g.W >= T.MINW && (!formula || g.fy + T.FH <= g.H));
    }
    assert.ok(geom(defDe({ filas: 2, cols: 2 })).H > geom(defDe({ filas: 2, cols: 2, formula: false })).H);
  });
  prueba('tamaño de celda adaptado: pocas celdas = grandes, monótono; tam estable entre pasos', () => {
    let ant = Infinity;
    for (let k = 1; k <= 14; k++) { assert.ok(tamCelda(k) <= ant); ant = tamCelda(k); }
    assert.ok(tamCelda(3) > tamCelda(14));
    const s = abre({}, { filas: 5, cols: 5 }), g = geom(s.def);
    assert.deepEqual(geom(plegar(s, { est: { '1,1': 'activa' }, formula: 'x' }).def), g);
  });
  prueba('flecha: sale y llega por el borde de las celdas, dentro de la escena, para todos los pares', () => {
    const g = geom(defDe({ filas: 6, cols: 6 })), h = g.caja / 2;
    let k = 0;
    for (let r1 = 0; r1 < 6; r1++) for (let c1 = 0; c1 < 6; c1++) for (let r2 = 0; r2 < 6; r2++) for (let c2 = 0; c2 < 6; c2++) {
      const f = flecha(g, [r1, c1, r2, c2]);
      if (r1 === r2 && c1 === c2) { assert.equal(f, null); continue; }
      const nums = (f.d + ' ' + f.cabeza).match(/-?\d+(\.\d+)?/g).map(Number);
      assert.ok(nums.every(Number.isFinite) && f.cabeza.split(' ').length === 3);
      const [ax, ay] = f.d.match(/M(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number), s = centro(g, r1, c1), t = centro(g, r2, c2);
      assert.ok(Math.max(Math.abs(ax - s.x), Math.abs(ay - s.y)) >= h - 1e-6, 'sale de la celda de origen');
      assert.ok(Math.max(Math.abs(f.punta.x - t.x), Math.abs(f.punta.y - t.y)) <= h + 2, 'la punta toca la celda de destino');
      assert.ok(f.punta.x >= 0 && f.punta.x <= g.W && f.punta.y >= 0 && f.punta.y <= g.H); k++;
    }
    assert.ok(k > 1000);
  });
  prueba('colocarMarcas apila los nombres de una cabecera y descarta las inválidas', () => {
    const def = defDe({ filas: 4, cols: 4 });
    const m = colocarMarcas({ i: { fila: 1 }, k: { fila: 1 }, j: { col: 2 }, x: { fila: 9 }, y: {}, z: null }, def);
    assert.deepEqual(m.map(x => x.nombre), ['i', 'k', 'j']);
    assert.deepEqual(m.filter(x => x.i === 1 && x.tipo === 'fila').map(x => [x.nivel, x.de]), [[0, 2], [1, 2]]);
    assert.deepEqual(m.find(x => x.nombre === 'j'), { nombre: 'j', tipo: 'col', i: 2, nivel: 0, de: 1 });
  });

  console.log('jugar: vista, conVista, ctx y helpers');
  prueba('vista es copia mutable; conVista la devuelve pintable; ctx expone las dimensiones', () => {
    const s = congelar(abre({ val: [[1, 2, 3, 4]], est: { '0,0': 'lee' }, deps: [[0, 0, 1, 1]], marcas: { i: { fila: 1 } }, resaltar: { filas: [1] } }));
    const v = vista(s);
    poner(v, 2, 3, 9); estado(v, 0, 1, 'activa'); estado(v, 0, 0, null); v.deps.push([1, 1, 2, 2]); v.marcas.j = { col: 0 }; v.resaltar.cols.push(2);
    assert.equal(leer(v, 2, 3), 9); assert.equal(leer(v, 9, 9), null); assert.equal(s.val[2][3], null);
    assert.deepEqual(v.est, { '0,1': 'activa' }); assert.equal(s.deps.length, 1);
    poner(v, 9, 9, 1); poner(v, 0, 9, 1); // fuera: ignorado
    const P = conVista(s, v);
    assert.equal(P.def, s.def); assert.equal(P.val[2][3], 9); assert.equal(P.deps.length, 2); assert.deepEqual(P.resaltar.cols, [2]);
    const cx = ctx(s);
    assert.deepEqual([cx.filas, cx.cols], [3, 4]); assert.deepEqual(cx.inicial, s.def.val); assert.notEqual(cx.inicial, s.def.val);
    assert.equal(llave(2, 3), '2,3');
  });

  console.log('LCS «ABCB» / «BDCB»');
  const A = 'ABCB', B = 'BDCB';
  /** Referencia independiente: recursión con memo (no comparte código con la guía). */
  const lcsRef = (a, b) => { const memo = new Map(), f = (i, j) => (i === 0 || j === 0 ? 0 : memo.get(i + ',' + j) ?? (memo.set(i + ',' + j, a[i - 1] === b[j - 1] ? f(i - 1, j - 1) + 1 : Math.max(f(i - 1, j), f(i, j - 1))), memo.get(i + ',' + j))); return Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => f(i, j))); };
  prueba('recorrer la tabla con una traza generada aquí rellena exactamente la tabla de referencia', () => {
    const ref = lcsRef(A, B), abierta = plegar(undefined, { tabla: { filas: 5, cols: 5, cab: { filas: ['', ...A], cols: ['', ...B] }, val: ref.map((f, i) => f.map((x, j) => (i === 0 || j === 0 ? x : null))) } });
    let s = abierta;
    const hechas = new Set(), calculadas = [];
    for (let i = 1; i <= 4; i++) for (let j = 1; j <= 4; j++) {
      const lee = A[i - 1] === B[j - 1] ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]];
      s = plegar(s, { est: { [llave(i, j)]: 'activa', ...Object.fromEntries(lee.map(([r, c]) => [llave(r, c), 'lee'])) }, deps: lee.map(([r, c]) => [r, c, i, j]) });
      assert.equal(Object.values(s.est).filter(e => e === 'activa').length, 1);
      for (const [r, c, r2, c2] of s.deps) { assert.ok(r === 0 || c === 0 || hechas.has(llave(r, c)), `lee ${r},${c} sin calcular`); assert.equal(s.val[r2][c2], null); }
      s = plegar(s, { val: [[i, j, ref[i][j]]], est: Object.fromEntries([[llave(i, j), 'hecha'], ...lee.map(([r, c]) => [llave(r, c), 'hecha'])]), deps: null });
      hechas.add(llave(i, j)); calculadas.push(ref[i][j]);
    }
    assert.deepEqual(s.val, ref); assert.equal(s.val[4][4], 3); assert.equal(calculadas.length, 16);
    assert.deepEqual(s.val.map(f => f.join('')), ['00000', '00000', '01111', '01122', '01123']);
    assert.deepEqual(s.deps, []);
  });
  prueba('traceback: «BCB» y las celdas del camino quedan marcadas como camino', () => {
    const ref = lcsRef(A, B), { celdas, sub } = D.caminoLCS(A, B, ref);
    assert.equal(sub, 'BCB'); assert.deepEqual(celdas[0], [4, 4]); assert.deepEqual(celdas.at(-1).some(x => x === 0), true);
    let s = plegar(undefined, { tabla: { filas: 5, cols: 5 }, val: ref });
    for (const [i, j] of celdas) s = plegar(s, { est: { [llave(i, j)]: 'camino' }, marcas: { i: { fila: i }, j: { col: j } } });
    assert.equal(Object.keys(s.est).length, celdas.length);
    const [fi, fj] = celdas.at(-1); assert.deepEqual(s.marcas, { i: { fila: fi }, j: { col: fj } });
    for (const [i, j] of celdas) assert.equal(s.est[llave(i, j)], 'camino');
    // las letras de las coincidencias recorridas en orden inverso dan la subsecuencia
    assert.equal(celdas.slice(0, -1).filter(([i, j], k) => A[i - 1] === B[j - 1] && celdas[k + 1][0] === i - 1 && celdas[k + 1][1] === j - 1).map(([i]) => A[i - 1]).reverse().join(''), 'BCB');
  });
  prueba('las trazas de la guía demo (celda a celda y vuelta) producen la misma tabla y el mismo camino', () => {
    const ref = lcsRef(A, B);
    assert.deepEqual(D.tablaLCS(A, B), ref);
    let s = plegar(undefined, { tabla: { filas: 5, cols: 5 }, val: ref.map((f, i) => f.map((x, j) => (i === 0 || j === 0 ? x : null))) });
    const fr = D.trazaLCS(A, B);
    assert.equal(fr.length, 32);
    for (const f of fr) { s = plegar(s, f); assert.ok(Object.values(s.est).filter(e => e === 'activa').length <= 1); }
    assert.deepEqual(s.val, ref);
    assert.ok(Object.values(s.est).every(e => e === 'hecha') && Object.keys(s.est).length === 25);
    let t = plegar(undefined, { tabla: { filas: 5, cols: 5 }, val: ref });
    for (const f of D.trazaVuelta(A, B)) t = plegar(t, f);
    assert.equal(Object.keys(t.est).length, D.caminoLCS(A, B).celdas.length);
  });
  prueba('mochila: la traza de la guía deja la tabla de referencia y la respuesta es dp[n][W]', () => {
    const dp = D.tablaMochila(), items = D.ITEMS, W = D.CAP;
    // referencia por fuerza bruta sobre subconjuntos
    let mejor = 0;
    for (let m = 0; m < 1 << items.length; m++) { let p = 0, v = 0; items.forEach((x, i) => { if (m >> i & 1) { p += x.p; v += x.v; } }); if (p <= W) mejor = Math.max(mejor, v); }
    assert.equal(dp.at(-1)[W], mejor);
    let s = plegar(undefined, { tabla: { filas: items.length + 1, cols: W + 1 }, val: dp.map((f, i) => f.map(x => (i === 0 ? x : null))) });
    for (const f of D.trazaMochila()) { s = plegar(s, f); assert.ok(s.deps.length === 1 || s.deps.length === 2); }
    assert.deepEqual(s.val, dp);
  });
  prueba('la guía demo se pliega entera sin salirse de la rejilla', () => {
    let s = null, aperturas = 0;
    for (const p of D.default.pasos) {
      if (p.tabla) aperturas++;
      s = p.tabla ? plegar(undefined, p) : plegar(s, p);
      let t = s;
      for (const f of [null, ...(p.traza || [])]) {
        if (f) t = plegar(t, f);
        assert.equal(t.val.length, t.def.filas); assert.ok(t.val.every(r => r.length === t.def.cols));
        for (const k of Object.keys(t.est)) { const [r, c] = k.split(',').map(Number); assert.ok(r < t.def.filas && c < t.def.cols); assert.ok(T.ESTADOS.includes(t.est[k])); }
      }
    }
    assert.equal(aperturas, 4);
  });
  prueba('el elegir de la guía demo: celdas leídas y fórmula correctas, y sin tocar el estado original', () => {
    const s = plegar(undefined, { tabla: { filas: 5, cols: 5, cab: { filas: ['', ...A], cols: ['', ...B] }, val: lcsRef(A, B) } }), cx = ctx(s);
    const v = D.elegirLCS(vista(s), 4, 4, cx); // B = B: diagonal
    assert.deepEqual(v.deps, [[3, 3, 4, 4]]); assert.equal(v.est['4,4'], 'activa'); assert.equal(v.est['3,3'], 'lee');
    assert.match(v.formula.es, /dp\[4\]\[4\] = dp\[3\]\[3\] \+ 1 = 3/);
    const w = D.elegirLCS(vista(s), 2, 1, cx); // B ≠ B? a[1]=B,b[0]=B → coincide; probamos una distinta
    assert.equal(w.deps.length, 1);
    const x = D.elegirLCS(vista(s), 1, 2, cx); // A vs D: distintas → arriba e izquierda
    assert.deepEqual(x.deps, [[0, 2, 1, 2], [1, 1, 1, 2]]);
    const y = D.elegirLCS(vista(s), 0, 3, cx); assert.deepEqual(y.deps, []); assert.match(y.formula.es, /caso base/);
    assert.equal(s.est['4,4'], undefined);
  });

  console.log('validador de datos');
  prueba('tests/guias-datos.js valida la demo (✓)', () => {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tests', 'guias-datos.js'), 'demo-tabla'], { encoding: 'utf8' });
    assert.match(out, /✓ demo-tabla/);
  });
  prueba('el validador detecta datos mal formados', () => {
    const fabrica = require('./validar-tabla.js');
    const errores = (...ps) => {
      const v = fabrica(), e = [];
      ps.forEach((p, i) => v(p, m => e.push(`${i}: ${m}`), { frame: false }));
      return e.join('\n');
    };
    const base = { tabla: { filas: 3, cols: 3 } };
    assert.equal(errores(base, { val: [[0, 0, 1]], est: { '1,1': 'activa' }, deps: [[0, 0, 1, 1]], marcas: { i: { fila: 1 } }, resaltar: { cols: [2] }, formula: 'a `b`' }), '');
    assert.match(errores({ tabla: { filas: 15, cols: 3 } }), /tabla\.filas/);
    assert.match(errores({ tabla: { filas: 3, cols: 3, cab: { filas: ['a'] } } }), /cab\.filas/);
    assert.match(errores({ tabla: { filas: 2, cols: 2, cab: { cols: ['abcdefghijk', 'b'] } } }), /demasiado largo/);
    assert.match(errores(base, { est: { '5,5': 'lee' } }), /fuera de la rejilla/);
    assert.match(errores(base, { est: { '0,0': 'rojo' } }), /no es activa/);
    assert.match(errores(base, { val: [[7, 0, 1]] }), /fuera de la rejilla/);
    assert.match(errores(base, { val: [[0, 0, 'demasiado largo']] }), /máx\. 8/);
    assert.match(errores(base, { deps: [[0, 0, 0, 0]] }), /misma celda/);
    assert.match(errores(base, { deps: [[0, 0, 1]] }), /enteros/);
    assert.match(errores(base, { marcas: { nombreLargo: { fila: 0 } } }), /nombre/);
    assert.match(errores(base, { marcas: { i: { fila: 5 } } }), /fuera de la rejilla/);
    assert.match(errores(base, { marcas: { i: 1 } }), /\{fila: i\}/);
    assert.match(errores(base, { resaltar: { filas: [9] } }), /resaltar\.filas/);
    assert.match(errores(base, { formula: 'a `b' }), /backticks/);
    assert.match(errores(base, { formula: 'x'.repeat(100) }), /máx\. 90/);
    assert.match(errores(base, { texto: 'x' }), /texto/);
    assert.match(errores(base, { arr: [1] }), /clave desconocida/);
    assert.match(errores(base, { jugar: { arrastrables: true } }), /soltar/);
    assert.match(errores(base, { jugar: { arrastrables: ['9,9'], soltar() {} } }), /arrastrables/);
    assert.equal(errores(base, { jugar: { arrastrables: ['1,1', [2, 2]], soltar() {} } }), '');
    assert.match(errores(base, { tabla: { filas: 1, cols: 1 } }) + errores({ val: [] }), /^$/); // sin escena abierta: no valida nada
  });

  console.log('escena DOM (sobre un DOM de mentira)');
  const dom = montarDom();
  const E = new T.Escena(dom.stage);
  const sc = prueba('fijar/pintar construyen la rejilla, los estados y la fórmula', () => {
    const s = plegar(undefined, { tabla: { filas: 5, cols: 5, cab: { filas: ['', ...A], cols: ['', ...B], esq: 'i\\j' }, val: lcsRef(A, B).map((f, i) => f.map((x, j) => (i === 0 || j === 0 ? x : null))) } });
    E.pintar(s, false);
    const celdas = dom.stage.desc().filter(x => x.hasClass?.('tb-c') || x._cls.has('tb-c'));
    assert.equal(celdas.length, 25); assert.deepEqual(E.tam, { W: geom(s.def).W, H: geom(s.def).H });
    assert.equal(E.celdas[0].v.texto, '0'); assert.equal(E.celdas[6].v.texto, ''); assert.ok(E.celdas[6].el._cls.has('vacia'));
    assert.deepEqual([E.hf[1].texto, E.hc[2].texto, E.esq.texto], ['A', 'D', 'i\\j']);
    const t = plegar(s, { est: { '1,1': 'activa', '0,1': 'lee', '4,4': 'mal', '2,2': 'camino', '3,3': 'hecha', '1,2': 'elegida' }, deps: [[0, 1, 1, 1]], formula: { es: '`dp[1][1]` < 5 & x', en: 'en' }, marcas: { i: { fila: 1 }, j: { col: 1 } }, resaltar: { filas: [1], cols: [1] }, val: [[1, 1, 7]] });
    E.pintar({ ...t, hl: { '2,1': 'lee' } }, true);
    for (const [k, e] of [[6, 'activa'], [1, 'lee'], [24, 'mal'], [12, 'camino'], [18, 'hecha'], [7, 'elegida'], [11, 'lee']]) assert.ok(E.celdas[k].el._cls.has('e-' + e), `${k} ${e}`);
    assert.equal(E.celdas[6].v.texto, '7'); assert.ok(E.celdas[6].v.anims.length === 1, 'el valor brota al escribirse con animación');
    assert.equal(E.sv.hijos.length, 1); assert.equal(E.sv.hijos[0].hijos[0].anims.length, 1);
    assert.equal(E.fo.html, '<code>dp[1][1]</code> &lt; 5 &amp; x'); assert.ok(E.fo._cls.has('on'));
    assert.ok(E.bf[1]._cls.has('on') && E.bc[1]._cls.has('on') && !E.bf[0]._cls.has('on'));
    assert.equal([...E.mk.keys()].join(), 'i,j'); assert.ok(!E.mk.get('i').el._cls.has('oculta') && E.mk.get('i').el._cls.has('mf') && E.mk.get('j').el._cls.has('mc'));
    return t;
  });
  prueba('idioma: cabeceras y fórmula {es,en} se reescriben al cambiar de idioma', () => {
    const s = plegar(undefined, { tabla: { filas: 2, cols: 2, cab: { filas: [{ es: 'uno', en: 'one' }, 'b'], cols: ['x', 'y'] } }, formula: { es: 'hola', en: 'hello' } });
    const F = new T.Escena(new dom.Nodo('div'));
    F.pintar(s, false); assert.equal(F.hf[0].texto, 'uno'); assert.equal(F.fo.html, 'hola');
    document.documentElement.lang = 'en'; F.pintar(s, false);
    assert.equal(F.hf[0].texto, 'one'); assert.equal(F.fo.html, 'hello');
    document.documentElement.lang = 'es';
  });
  prueba('las flechas que sobran se desvanecen y se retiran; las nuevas se dibujan', () => {
    const F = new T.Escena(new dom.Nodo('div')), s = plegar(undefined, { tabla: { filas: 3, cols: 3 }, deps: [[0, 0, 1, 1], [0, 1, 1, 1]] });
    F.pintar(s, false); assert.equal(F.sv.hijos.length, 2);
    F.pintar(plegar(s, { deps: [[0, 1, 1, 1], [1, 0, 1, 1]] }), 300);
    assert.equal(F.sv.hijos.length, 3); // una sale (animando), una nueva entra
    const saliente = [...F.deps.values()].find(x => x.saliendo); assert.ok(saliente);
    saliente.el.anims.at(-1).onfinish(); assert.equal(F.sv.hijos.length, 2);
    F.pintar(plegar(s, { deps: null }), false); assert.equal(F.sv.hijos.length, 0);
  });
  prueba('clic en celda (Pointer Events): soltar recibe (r, c); sin arrastre activo no pasa nada', () => {
    const E2 = new T.Escena(new dom.Nodo('div')), s = plegar(undefined, { tabla: { filas: 3, cols: 3 }, val: [[1, 2, 3], [4, 5, 6], [7, 8, 9]] });
    E2.pintar(s, false);
    const llamadas = [], celda = (r, c) => E2.celdas[r * 3 + c].el;
    dom.punto = celda(1, 2); dom.dispara(E2.root, 'pointerdown', { target: celda(1, 2) }); dom.dispara(E2.root, 'pointerup', { target: celda(1, 2) });
    assert.equal(llamadas.length, 0);
    E2.arrastre(true, (r, c) => llamadas.push([r, c]));
    assert.ok(celda(1, 1)._cls.has('jg') && celda(0, 0).attrs.tabindex === '0' && celda(2, 2).attrs.tabindex === '-1', 'foco itinerante: una sola parada de tabulador');
    dom.punto = celda(1, 2); dom.dispara(E2.root, 'pointerdown', { target: celda(1, 2) }); dom.dispara(E2.root, 'pointerup', { target: celda(1, 2) });
    assert.deepEqual(llamadas, [[1, 2]]);
    dom.dispara(E2.root, 'pointerdown', { target: celda(0, 0) }); dom.punto = celda(2, 2); dom.dispara(E2.root, 'pointerup', { target: celda(0, 0) }); // arrastra fuera: no cuenta
    dom.dispara(E2.root, 'pointerdown', { target: celda(0, 0), button: 2 }); dom.dispara(E2.root, 'pointerup', { target: celda(0, 0) });
    dom.dispara(E2.root, 'pointerdown', { target: celda(2, 0) }); dom.punto = celda(2, 0); dom.dispara(E2.root, 'pointercancel', {}); dom.dispara(E2.root, 'pointerup', { target: celda(2, 0) });
    assert.equal(llamadas.length, 1);
    E2.arrastre(['0,1', [2, 2]], (r, c) => llamadas.push([r, c]));
    assert.ok(celda(0, 1)._cls.has('jg') && celda(2, 2)._cls.has('jg') && !celda(1, 1)._cls.has('jg'));
    assert.equal(celda(0, 1).attrs.tabindex, '0'); assert.equal(celda(1, 1).attrs.tabindex, undefined);
    dom.punto = celda(1, 1); dom.dispara(E2.root, 'pointerdown', { target: celda(1, 1) }); dom.dispara(E2.root, 'pointerup', { target: celda(1, 1) });
    assert.equal(llamadas.length, 1); // celda no elegible
    E2.arrastre(null, null);
    assert.ok(!celda(0, 1)._cls.has('jg') && celda(0, 1).attrs.tabindex === undefined);
  });
  prueba('teclado: Enter/Espacio eligen, las flechas mueven el foco entre celdas elegibles', () => {
    const E3 = new T.Escena(new dom.Nodo('div')), s = plegar(undefined, { tabla: { filas: 3, cols: 3 } }), llamadas = [], celda = (r, c) => E3.celdas[r * 3 + c].el;
    E3.pintar(s, false); E3.arrastre(['0,0', '0,2', '2,2'], (r, c) => llamadas.push([r, c]));
    let parado = 0; const ev = { preventDefault() {}, stopPropagation() { parado++; } };
    dom.dispara(E3.root, 'keydown', { target: celda(0, 0), key: 'Enter', ...ev }); dom.dispara(E3.root, 'keydown', { target: celda(0, 0), key: ' ', ...ev });
    assert.deepEqual(llamadas, [[0, 0], [0, 0]]); assert.equal(parado, 2);
    dom.foco = null; dom.dispara(E3.root, 'keydown', { target: celda(0, 0), key: 'ArrowRight', ...ev }); // salta a 0,2 (la 0,1 no es elegible)
    assert.equal(dom.foco, celda(0, 2));
    dom.dispara(E3.root, 'focusin', { target: celda(0, 2) });
    assert.equal(celda(0, 2).attrs.tabindex, '0'); assert.equal(celda(0, 0).attrs.tabindex, '-1');
    dom.foco = null; dom.dispara(E3.root, 'keydown', { target: celda(0, 2), key: 'ArrowDown', ...ev }); assert.equal(dom.foco, celda(2, 2));
    dom.foco = null; dom.dispara(E3.root, 'keydown', { target: celda(2, 2), key: 'ArrowDown', ...ev }); assert.equal(dom.foco, null); // no hay más
    dom.dispara(E3.root, 'keydown', { target: celda(0, 0), key: 'a', ...ev }); assert.equal(llamadas.length, 2);
    assert.ok(parado >= 5, 'las flechas no se propagan a guia.js (cambian de paso con ← →)');
  });
  prueba('repintar tras clic: jugar actualiza vista → pintar con conVista conserva el foco y las clases', () => {
    const E4 = new T.Escena(new dom.Nodo('div')), s = plegar(undefined, { tabla: { filas: 5, cols: 5, cab: { filas: ['', ...A], cols: ['', ...B] }, val: lcsRef(A, B) } });
    E4.pintar(s, false);
    const v = vista(s), cx = ctx(s);
    E4.arrastre(true, (r, c) => { D.elegirLCS(v, r, c, cx); E4.pintar({ ...conVista(s, v), hl: undefined }, true); });
    dom.punto = E4.celdas[4 * 5 + 4].el; dom.dispara(E4.root, 'pointerdown', { target: dom.punto }); dom.dispara(E4.root, 'pointerup', { target: dom.punto });
    assert.ok(E4.celdas[24].el._cls.has('e-activa') && E4.celdas[18].el._cls.has('e-lee') && E4.celdas[24].el._cls.has('jg'));
    assert.equal(E4.sv.hijos.length, 1); assert.deepEqual([...E4.mk.keys()], ['i', 'j']);
    assert.match(E4.fo.html, /<code>dp\[4\]\[4\]/);
  });
  prueba('reabrir otra escena reconstruye y no hereda interacción ni flechas', () => {
    const F = new T.Escena(new dom.Nodo('div'));
    F.pintar(plegar(undefined, { tabla: { filas: 2, cols: 2 }, deps: [[0, 0, 1, 1]] }), false); F.arrastre(true, () => {});
    F.pintar(plegar(undefined, { tabla: { filas: 3, cols: 3 } }), true);
    assert.equal(F.celdas.length, 9); assert.equal(F.ids, null); assert.equal(F.sv.hijos.length, 0);
    assert.ok(F.celdas.every(k => !k.el._cls.has('jg')));
  });

  prueba('relaciones: qué lee una celda y a quién alimenta (sin repetidos, orden de deps)', () => {
    const deps = [[0, 1, 1, 1], [1, 0, 1, 1], [0, 0, 1, 1], [0, 1, 1, 1], [1, 1, 2, 2]];
    assert.deepEqual(T.relaciones(deps, 1, 1), { de: [[0, 1], [1, 0], [0, 0]], a: [[2, 2]] });
    assert.deepEqual(T.relaciones(deps, 0, 1), { de: [], a: [[1, 1]] });
    assert.deepEqual(T.relaciones(deps, 2, 0), { de: [], a: [] }, 'sin dependencias → vacías (no hay tooltip)');
    assert.deepEqual(T.relaciones(null, 0, 0), { de: [], a: [] });
    assert.deepEqual(T.relaciones([[1, 1, 1, 1]], 1, 1), { de: [[1, 1]], a: [] }, 'una auto-dependencia cuenta una vez');
  });

  console.log(`\n✓ ${n} pruebas de tabla`);
})().catch(e => { console.error('\n✗ ' + (e.stack || e)); process.exit(1); });
