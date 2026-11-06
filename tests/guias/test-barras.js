#!/usr/bin/env node
'use strict';
/**
 * Pruebas Node de la lógica pura de la escena «barras» (sin navegador):  node tests/guias/test-barras.js
 * Plegar pura y acumulativa, identidad de los elementos, geometría, apilado de punteros, arrastre, vista/conVista y
 * las trazas generadas por la guía demo (burbuja, merge, búsqueda binaria) terminan como deben.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const imp = f => import(pathToFileURL(path.join(ROOT, f)).href);
let n = 0;
const prueba = (nombre, fn) => { fn(); n++; console.log('  ok  ' + nombre); };
const congelar = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };

(async () => {
  const B = await imp('assets/guias/barras.js');
  const D = await imp('assets/guias/data/demo-barras.js');
  const { plegar, defDe, geom, vista, conVista, mover, cambiar, reponer, reconciliar, posTrasMover, moverEn, colocarMarcas, indiceDeX, ordenado } = B;
  const abre = (extra = {}, def = { arr: [5, 2, 8, 1], aux: 4 }) => plegar(undefined, { barras: def, ...extra });

  console.log('plegar');
  prueba('clave y estado inicial', () => {
    assert.equal(B.clave, 'barras');
    const s = abre();
    assert.deepEqual(s.arr, [5, 2, 8, 1]); assert.deepEqual(s.ord, [0, 1, 2, 3]); assert.deepEqual(s.aux, [null, null, null, null]);
    assert.deepEqual([s.marcas, s.est, s.cont, s.rango], [{}, {}, {}, null]);
    assert.equal(s.def.max, 8); assert.equal(s.def.estilo, 'barras');
  });
  prueba('el mismo objeto barras da el mismo def (identidad estable)', () => {
    const b = { arr: [1, 2, 3] };
    assert.equal(plegar(undefined, { barras: b }).def, plegar(undefined, { barras: b }).def);
    assert.equal(defDe(b), defDe(b)); assert.notEqual(defDe({ arr: [1, 2, 3] }), defDe(b));
  });
  prueba('plegar es pura: no muta el estado (congelado) ni el parche', () => {
    const s = congelar(abre()), p = congelar({
      arr: [9, 9, 9, 9], poner: { 0: 7 }, intercambiar: [0, 3], aux: { 1: 5 }, marcas: { i: 1 }, rango: [1, 2], est: { 2: 'cmp' }, cont: { c: 1 },
    });
    const antes = JSON.stringify(s);
    const t = plegar(s, p);
    assert.equal(JSON.stringify(s), antes);
    assert.notEqual(t, s); assert.equal(t.def, s.def);
    for (const k of ['arr', 'ord', 'aux', 'marcas', 'est', 'cont']) assert.notEqual(t[k], s[k], k + ' debe ser copia');
  });
  prueba('intercambiar cruza valores e identidades; acepta varios pares', () => {
    let s = plegar(abre(), { intercambiar: [0, 2] });
    assert.deepEqual(s.arr, [8, 2, 5, 1]); assert.deepEqual(s.ord, [2, 1, 0, 3]);
    s = plegar(s, { intercambiar: [[0, 1], [2, 3]] });
    assert.deepEqual(s.arr, [2, 8, 1, 5]); assert.deepEqual(s.ord, [1, 2, 3, 0]);
    s = plegar(s, { intercambiar: [0, 99] }); // fuera de rango: se ignora
    assert.deepEqual(s.arr, [2, 8, 1, 5]);
  });
  prueba('poner y arr (reemplazo duro) acumulan; la identidad no cambia', () => {
    let s = plegar(abre(), { poner: { 1: 6, 3: 4 } });
    assert.deepEqual(s.arr, [5, 6, 8, 4]);
    s = plegar(s, { arr: [1, 2, 3, 4] }); assert.deepEqual(s.arr, [1, 2, 3, 4]); assert.deepEqual(s.ord, [0, 1, 2, 3]);
    s = plegar(s, { poner: { 9: 1 } }); assert.equal(s.arr.length, 4);
  });
  prueba('aux: escribir, vaciar un hueco y vaciar todo', () => {
    let s = plegar(abre(), { aux: { 0: 3, 2: 7 } });
    assert.deepEqual(s.aux, [3, null, 7, null]);
    s = plegar(s, { aux: { 0: null } }); assert.deepEqual(s.aux, [null, null, 7, null]);
    s = plegar(s, { aux: { 9: 1 } }); assert.equal(s.aux.length, 4);
    assert.deepEqual(plegar(s, { aux: null }).aux, [null, null, null, null]);
  });
  prueba('marcas, rango, est y cont acumulan; null limpia', () => {
    let s = plegar(abre(), { marcas: { i: 0, j: 1 }, est: { 0: 'cmp', 1: 'cmp' }, rango: [1, 3], cont: { comparaciones: 2 } });
    s = plegar(s, { marcas: { i: null, lo: 2 }, est: { 0: null, 2: 'piv' }, cont: { intercambios: 1 } });
    assert.deepEqual(s.marcas, { j: 1, lo: 2 }); assert.deepEqual(s.est, { 1: 'cmp', 2: 'piv' });
    assert.deepEqual(s.cont, { comparaciones: 2, intercambios: 1 }); assert.deepEqual(s.rango, [1, 3]);
    s = plegar(s, { cont: { comparaciones: 3 } }); assert.equal(s.cont.comparaciones, 3);
    s = plegar(s, {}); assert.deepEqual(s.rango, [1, 3]); // un parche vacío conserva todo
    s = plegar(s, { rango: null, est: null, marcas: null, cont: null });
    assert.deepEqual([s.rango, s.est, s.marcas, s.cont], [null, {}, {}, {}]);
  });
  prueba('un paso con barras y parches a la vez: abre y aplica', () => {
    const s = abre({ marcas: { lo: 0 }, rango: [0, 2], cont: { c: 0 } });
    assert.deepEqual([s.marcas, s.rango, s.cont], [{ lo: 0 }, [0, 2], { c: 0 }]);
  });
  prueba('desordenado + intercambios (selección) = orden esperado y cada id sigue a su valor', () => {
    const a0 = [4, 3, 5, 1, 2];
    let s = plegar(undefined, { barras: { arr: a0 } });
    for (let i = 0; i < a0.length - 1; i++) {
      let m = i; for (let j = i + 1; j < a0.length; j++) if (s.arr[j] < s.arr[m]) m = j;
      if (m !== i) s = plegar(s, { intercambiar: [i, m] });
    }
    assert.deepEqual(s.arr, [1, 2, 3, 4, 5]);
    assert.deepEqual(s.ord.map(id => a0[id]), s.arr); // identidad estable: ord[p] es el id inicial del elemento en p
    assert.deepEqual([...s.ord].sort(), [0, 1, 2, 3, 4]);
  });

  console.log('geometría y helpers');
  prueba('geom: todas las columnas dentro de la escena (hasta 32 + aux)', () => {
    for (const [nn, aux, estilo] of [[1, 0, 'barras'], [8, 0, 'barras'], [32, 0, 'barras'], [32, 32, 'cajas'], [5, 9, 'barras']]) {
      const g = geom(defDe({ arr: Array(nn).fill(1), aux, estilo, etiquetas: true }));
      assert.ok(g.x0 >= 0 && g.x0 + g.sw * g.cols <= B.W + 1e-9, `${nn}/${aux}`);
      assert.ok(g.bw > 0 && g.bw <= g.sw && g.H > g.base && (aux ? g.H > g.auxY + g.hr : true));
    }
    assert.ok(geom(defDe({ arr: [1], aux: 1 })).H > geom(defDe({ arr: [1] })).H);
  });
  prueba('escalaBarra: proporcional, mínimo visible, acotada', () => {
    assert.equal(B.escalaBarra(0, 10), 0); assert.equal(B.escalaBarra(5, 10), .5);
    assert.equal(B.escalaBarra(20, 10), 1); assert.ok(B.escalaBarra(.01, 10) >= .03);
  });
  prueba('colocarMarcas apila los nombres de un mismo índice sin solaparse', () => {
    const m = colocarMarcas({ i: 2, j: 2, piv: 2, lo: 0, hi: 5 });
    const claves = m.map(x => x.i + ':' + x.nivel);
    assert.equal(new Set(claves).size, claves.length);
    assert.deepEqual(m.filter(x => x.i === 2).map(x => x.nivel), [0, 1, 2]);
    assert.deepEqual(m.filter(x => x.i !== 2).map(x => x.nivel), [0, 0]);
  });
  prueba('xMarca e indiceDeX', () => {
    const g = geom(defDe({ arr: [1, 2, 3, 4] }));
    assert.equal(indiceDeX(g, -50), 0); assert.equal(indiceDeX(g, 1e6), 3); assert.equal(indiceDeX(g, g.x0 + g.sw * 2.5), 2);
    assert.ok(B.xMarca(g, -1) >= 24 && B.xMarca(g, 4) <= B.W - 24);
  });
  prueba('moverEn y posTrasMover: inserción que deja hueco', () => {
    assert.deepEqual(moverEn([0, 1, 2, 3, 4], 1, 3), [0, 2, 3, 1, 4]);
    assert.deepEqual(moverEn([0, 1, 2, 3, 4], 3, 0), [3, 0, 1, 2, 4]);
    for (const [d, h] of [[0, 4], [4, 0], [2, 2], [1, 3]]) {
      const np = posTrasMover(5, d, h);
      assert.equal(np[d], h); assert.deepEqual([...np].sort(), [0, 1, 2, 3, 4]);
    }
    assert.deepEqual(posTrasMover(4, 0, 2), [2, 0, 1, 3]);
  });
  prueba('reconciliar: cada id sigue a su valor aunque solo se mute arr', () => {
    assert.deepEqual(reconciliar([0, 1, 2, 3], [4, 2, 5, 1], [1, 2, 4, 5]), [3, 1, 0, 2]);
    assert.deepEqual(reconciliar([0, 1, 2], [3, 3, 1], [1, 3, 3]), [2, 1, 0]); // repetidos: lo que no cambia conserva su id
    assert.deepEqual(reconciliar([0, 1], [5, 6], [5, 7]), [0, 1]); // valor nuevo: conserva identidad
    const ord = [2, 0, 1]; assert.deepEqual(reconciliar(ord, [9, 8, 7], [9, 8, 7]), ord);
  });
  prueba('vista/conVista/mover/cambiar/reponer: mutables y pintables sin tocar S', () => {
    const S = congelar(plegar(undefined, { barras: { arr: [4, 2, 5, 1, 3] }, cont: { m: 0 } }));
    const v = vista(S);
    mover(v, 4, 0); assert.deepEqual(v.arr, [3, 4, 2, 5, 1]); assert.deepEqual(v.ord, [4, 0, 1, 2, 3]);
    cambiar(v, 0, 1); assert.deepEqual(v.arr, [4, 3, 2, 5, 1]); assert.deepEqual(v.ord, [0, 4, 1, 2, 3]);
    v.cont.m = 2; v.est[0] = 'ok';
    let P = conVista(S, v);
    assert.deepEqual(P.arr, v.arr); assert.deepEqual(P.ord, v.ord); assert.equal(P.def, S.def); assert.deepEqual(P.cont, { m: 2 });
    v.arr.sort((a, b) => a - b); // mutación directa: la identidad se deduce por valores
    P = conVista(S, v);
    assert.deepEqual(P.arr, [1, 2, 3, 4, 5]); assert.deepEqual(P.ord.map(id => S.arr[id]), P.arr);
    mover(v, 0, 4); P = conVista(S, v); assert.deepEqual(P.ord.map(id => S.arr[id]), P.arr); // sigue consistente
    reponer(v, B.ctx(S).inicial); P = conVista(S, v);
    assert.deepEqual(P.arr, [4, 2, 5, 1, 3]); assert.deepEqual(P.ord, [0, 1, 2, 3, 4]);
    assert.deepEqual(S.arr, [4, 2, 5, 1, 3]); assert.equal(B.ctx(S).n, 5);
    assert.ok(ordenado([1, 2, 2, 3]) && !ordenado([2, 1]));
  });

  console.log('guía demo');
  const ordenada = a => [...a].sort((x, y) => x - y);
  const pliega = (s, frames) => frames.reduce(plegar, s);
  prueba('burbuja: la traza termina con el array ordenado y todo en verde; los intercambios son los de la traza', () => {
    const fr = D.trazaBurbuja(D.A_BURB), s0 = plegar(undefined, { barras: { arr: D.A_BURB } });
    const s = pliega(s0, fr);
    assert.deepEqual(s.arr, ordenada(D.A_BURB));
    assert.deepEqual(s.ord.map(id => D.A_BURB[id]), s.arr);
    assert.deepEqual(s.est, Object.fromEntries(D.A_BURB.map((_, i) => [i, 'ok'])));
    assert.deepEqual(s.marcas, {});
    const nn = D.A_BURB.length, ult = fr.findLast(f => f.cont).cont;
    assert.equal(ult.comparaciones, nn * (nn - 1) / 2);
    assert.equal(ult.intercambios, fr.filter(f => f.intercambiar).length);
    for (const f of fr) assert.ok(f.es && f.en && f.line >= 1);
  });
  prueba('burbuja con otros arrays (ordenado, inverso, repetidos, 1 elemento)', () => {
    for (const a of [[1, 2, 3, 4], [4, 3, 2, 1], [3, 1, 3, 2, 1], [7], [2, 2]]) {
      const s = pliega(plegar(undefined, { barras: { arr: a } }), D.trazaBurbuja(a));
      assert.deepEqual(s.arr, ordenada(a), JSON.stringify(a));
    }
  });
  prueba('merge: aux se llena y se vacía; la fila principal termina ordenada', () => {
    const a = D.A_MERGE, fr = D.trazaMerge(a, 0, 2, 5);
    let s = plegar(undefined, { barras: { arr: a, aux: a.length }, marcas: { i: 0, j: 3 } }), maxAux = 0;
    for (const f of fr) { s = plegar(s, f); maxAux = Math.max(maxAux, s.aux.filter(x => x !== null).length); }
    assert.deepEqual(s.arr, ordenada(a));
    assert.ok(s.aux.every(x => x === null));
    assert.equal(maxAux, a.length); // llegó a tener las 6 copias antes de devolverlas
    assert.deepEqual(s.marcas, {});
    assert.equal(fr.findLast(f => f.cont).cont.copias, a.length);
  });
  prueba('merge con subrango (lo..hi) deja el resto intacto', () => {
    const a = [9, 1, 4, 2, 3, 8], s = pliega(plegar(undefined, { barras: { arr: a, aux: 6 }, marcas: { i: 1, j: 3 } }), D.trazaMerge(a, 1, 2, 4));
    assert.deepEqual(s.arr, [9, 1, 2, 3, 4, 8]);
  });
  prueba('búsqueda binaria: encuentra el índice (o termina sin él) y mantiene lo/mid/hi válidos', () => {
    const a = D.A_BIN;
    for (const x of [...a, 1, 100, 10]) {
      const fr = D.trazaBinaria(a, x);
      let s = plegar(undefined, { barras: { arr: a, estilo: 'cajas' }, marcas: { lo: 0, hi: a.length - 1 }, rango: [0, a.length - 1] });
      for (const f of fr) {
        s = plegar(s, f);
        for (const i of Object.values(s.marcas)) assert.ok(i >= -1 && i <= a.length, `marca ${i}`);
        if (s.rango) assert.ok(s.rango[0] <= s.rango[1]);
      }
      const idx = a.indexOf(x);
      if (idx >= 0) { assert.equal(s.est[idx], 'ok'); assert.equal(s.marcas.mid, idx); } else assert.deepEqual(s.est, {});
      assert.ok(fr.length <= 3 * Math.ceil(Math.log2(a.length + 1)) + 1);
    }
  });
  prueba('la guía demo: todos los pasos pliegan sin salirse de la escena', () => {
    let s = null, aperturas = 0;
    for (const p of D.default.pasos) {
      if (p.barras) aperturas++;
      s = p.barras ? plegar(undefined, p) : plegar(s, p);
      let t = s; // los frames de una traza no pasan al paso siguiente
      for (const f of [null, ...(p.traza || [])]) {
        if (f) t = plegar(t, f);
        assert.ok(t.arr.every(Number.isFinite) && t.arr.length === t.def.arr.length);
        for (const v of [...t.arr, ...t.aux.filter(x => x !== null)]) assert.ok(v >= 0 && v <= t.def.max);
      }
    }
    assert.ok(aperturas >= 4);
  });

  console.log('tooltip y accesibilidad');
  prueba('describirBarra: valor, estado (hl manda), punteros y rango', () => {
    const e = abre({ est: { 2: 'cmp' }, marcas: { i: 2, j: 2, lo: 0 }, rango: [1, 3] }, { arr: [5, 2, 8, 1, 7], aux: 2 });
    const d = B.describirBarra(e, 2);
    assert.deepEqual([d.pos, d.valor, d.est, d.marcas, d.fuera], [2, 8, 'cmp', ['i', 'j'], false]);
    assert.equal(B.describirBarra(e, 0).fuera, true); assert.deepEqual(B.describirBarra(e, 0).marcas, ['lo']);
    assert.equal(B.describirBarra({ ...e, hl: { 2: 'ok' } }, 2).est, 'ok', 'hl se superpone a est');
    assert.equal(B.describirBarra(e, 9), null); assert.equal(B.describirBarra(e, -1), null); assert.equal(B.describirBarra(e, 1.5), null);
  });
  prueba('describirAux: solo huecos ocupados', () => {
    const e = abre({ aux: { 1: 4 } }, { arr: [5, 2, 8, 1], aux: 4 });
    assert.deepEqual(B.describirAux(e, 1), { hueco: 1, valor: 4 });
    assert.equal(B.describirAux(e, 0), null); assert.equal(B.describirAux(e, 7), null);
  });
  prueba('NOMBRE_EST cubre todos los estados y es bilingüe', () => {
    for (const k of B.ESTADOS) assert.ok(B.NOMBRE_EST[k].es && B.NOMBRE_EST[k].en, k);
  });
  const { colocarTip, TIP_ANCHO } = await imp('assets/guias/tip.js');
  prueba('colocarTip: centrado, acotado al panel y con volteo si no cabe arriba', () => {
    const a = colocarTip({ x: 20, y: 200, y2: 260 }, { s: 1, left: 0, top: 0, vw: 800 });
    assert.ok(a.x >= TIP_ANCHO / 2 && a.arriba && a.y === 200, 'x acotado por la izquierda');
    const b = colocarTip({ x: 790, y: 200, y2: 260 }, { s: 1, left: 0, top: 0, vw: 800 });
    assert.ok(b.x <= 800 - TIP_ANCHO / 2, 'no se sale por la derecha');
    const c = colocarTip({ x: 300, y: 30, y2: 90 }, { s: 1.5, left: 10, top: 5, vw: 800 });
    assert.equal(c.arriba, false); assert.equal(c.y, 90, 'sin sitio arriba: bajo y2');
    assert.equal(colocarTip({ x: 300, y: 30 }, { s: 1, vw: 800 }).arriba, true, 'sin y2 siempre arriba');
    assert.equal(colocarTip({ x: 100, y: 50, y2: 80 }, { s: 2, left: 40, top: 0, vw: 0 }).x, 100, 'sin ancho de panel no se acota');
  });

  console.log(`\n✓ ${n} pruebas de barras`);
})().catch(e => { console.error('\n✗ ' + (e.stack || e)); process.exit(1); });
