#!/usr/bin/env node
'use strict';
/**
 * Pruebas Node de la guía «Ordenación y búsqueda» (sin navegador):  node tests/guias/test-ordenacion.js
 * Cada generador de data/ordenacion-traza.js se prueba contra una implementación de referencia escrita aparte:
 * la traza, aplicada a un array, lo deja ordenado; los contadores coinciden; los frames pliegan en la escena «barras»
 * sin salirse (marcas, rango, est, valores ≤ max); búsquedas, dos punteros, ventana y counting sort dan el resultado
 * correcto; n = 0, 1, 2 y duplicados no rompen. Al final recorre la guía (frames ≤ 150, `jugar` sin excepciones).
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const imp = f => import(pathToFileURL(path.join(ROOT, f)).href);
let n = 0;
const prueba = (nombre, fn) => { fn(); n++; console.log('  ok  ' + nombre); };
const ordenada = a => [...a].sort((x, y) => x - y);

// ── Referencias (independientes de los generadores) ─────────────────────────────────────────────────────────────
const refBurbuja = a0 => {
  const a = [...a0]; let c = 0, s = 0;
  for (let i = 0; i < a.length - 1; i++) {
    let hubo = false;
    for (let j = 0; j < a.length - 1 - i; j++) { c++; if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; s++; hubo = true; } }
    if (!hubo) break;
  }
  return { a, c, s };
};
// Inserción clásica (desplaza la clave): comparaciones iguales; cada desplazamiento equivale a un intercambio
const refInsercion = (a0, K = x => x) => {
  const a = [...a0]; let c = 0, s = 0;
  for (let i = 1; i < a.length; i++) {
    const clave = a[i]; let j = i - 1;
    while (j >= 0) { c++; if (K(a[j]) > K(clave)) { a[j + 1] = a[j]; j--; s++; } else break; }
    a[j + 1] = clave;
  }
  return { a, c, s };
};
const refSeleccion = (a0, K = x => x) => {
  const a = [...a0]; let c = 0, s = 0;
  for (let i = 0; i < a.length - 1; i++) {
    let m = i;
    for (let j = i + 1; j < a.length; j++) { c++; if (K(a[j]) < K(a[m])) m = j; }
    if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; s++; }
  }
  return { a, c, s };
};
const refMerge = a0 => {
  const a = [...a0], aux = Array(a.length); let c = 0, cop = 0;
  const ms = (lo, hi) => {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1; ms(lo, mid); ms(mid + 1, hi);
    let i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) { c++; aux[k++] = a[i] <= a[j] ? a[i++] : a[j++]; cop++; }
    while (i <= mid) { aux[k++] = a[i++]; cop++; }
    while (j <= hi) { aux[k++] = a[j++]; cop++; }
    for (k = lo; k <= hi; k++) { a[k] = aux[k]; cop++; }
  };
  ms(0, a.length - 1);
  return { a, c, cop };
};
const refQuick = (a0, mediana = false) => {
  const a = [...a0]; let c = 0, s = 0;
  const sw = (i, j) => { if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; s++; } };
  const q = (lo, hi) => {
    if (lo >= hi) return;
    if (mediana && hi - lo >= 2) {
      const mid = lo + ((hi - lo) >> 1);
      c++; if (a[mid] < a[lo]) sw(mid, lo);
      c++; if (a[hi] < a[lo]) sw(hi, lo);
      c++; if (a[hi] < a[mid]) sw(hi, mid);
      sw(mid, hi);
    }
    const piv = a[hi]; let i = lo;
    for (let j = lo; j < hi; j++) { c++; if (a[j] < piv) { sw(i, j); i++; } }
    sw(i, hi); q(lo, i - 1); q(i + 1, hi);
  };
  q(0, a.length - 1);
  return { a, c, s };
};
const refHoare = (a0, lo, hi) => {
  const a = [...a0], piv = a[lo + ((hi - lo) >> 1)]; let i = lo - 1, j = hi + 1, c = 0, s = 0;
  for (;;) {
    do { i++; c++; } while (a[i] < piv);
    do { j--; c++; } while (a[j] > piv);
    if (i >= j) return { a, c, s, j };
    [a[i], a[j]] = [a[j], a[i]]; s++;
  }
};
const refLower = (a, x, sup) => { let lo = 0, hi = a.length, it = 0; while (lo < hi) { const m = (lo + hi) >> 1; it++; if (sup ? a[m] <= x : a[m] < x) lo = m + 1; else hi = m; } return { pos: lo, it }; };
const refBin = (a, x) => { let lo = 0, hi = a.length - 1, it = 0; while (lo <= hi) { const m = (lo + hi) >> 1; it++; if (a[m] === x) return { idx: m, it }; if (a[m] < x) lo = m + 1; else hi = m - 1; } return { idx: -1, it }; };
const refPar = (a, t) => { let i = 0, j = a.length - 1, it = 0; while (i < j) { it++; const s = a[i] + a[j]; if (s === t) return { par: [i, j], it }; if (s < t) i++; else j--; } return { par: null, it }; };

// ── Entradas de prueba ──────────────────────────────────────────────────────────────────────────────────────────
const lcg = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
const azar = (len, max, sem) => { const r = lcg(sem); return Array.from({ length: len }, () => 1 + Math.floor(r() * max)); };
const ENTRADAS = [[], [5], [2, 1], [1, 2], [3, 3], [1, 1, 1, 1], [4, 2, 4, 2, 4], [1, 2, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1], [5, 2, 8, 1, 7, 3, 6, 4],
  ...[2, 3, 5, 8, 10, 12, 16].flatMap(len => [1, 2, 3, 4].map(s => azar(len, len, s * 31 + len))),
  ...[6, 12].map(len => azar(len, 3, len)), // muchos duplicados
];

(async () => {
  const B = await imp('assets/guias/barras.js');
  const AR = await imp('assets/guias/arbol.js');
  const GR = await imp('assets/guias/grafica.js');
  const T = await imp('assets/guias/data/ordenacion-traza.js');
  const G = (await imp('assets/guias/data/ordenacion.js')).default;
  const { plegar, ordenado } = B;

  /** Reproduce una traza en la escena real: valida cada estado y devuelve el estado final. */
  const reproduce = (arr, res, { aux = 0, max = Math.max(1, ...arr), ordena = true } = {}) => {
    let s = plegar(undefined, { barras: { arr, aux, max } });
    s = plegar(s, res.inicial);
    const N = arr.length, estados = ['cmp', 'ok', 'piv', 'sel'];
    res.frames.forEach((f, k) => {
      for (const clave of Object.keys(f)) assert.ok(['line', 'es', 'en', 'intercambiar', 'poner', 'aux', 'marcas', 'rango', 'est', 'cont'].includes(clave), `clave de frame «${clave}»`);
      assert.ok(typeof f.es === 'string' && typeof f.en === 'string' && f.es && f.en, `frame ${k}: textos`);
      assert.ok(Number.isInteger(f.line) && f.line >= 1, `frame ${k}: line`);
      s = plegar(s, f);
      assert.equal(s.arr.length, N);
      for (const v of [...s.arr, ...s.aux.filter(x => x !== null)]) assert.ok(Number.isFinite(v) && v >= 0 && v <= max, `frame ${k}: valor ${v}`);
      const por = {};
      for (const [nom, i] of Object.entries(s.marcas)) { assert.ok(Number.isInteger(i) && i >= -1 && i <= N, `frame ${k}: marca ${nom}=${i}`); por[i] = (por[i] ?? 0) + 1; assert.ok(por[i] <= 3); }
      if (s.rango) assert.ok(s.rango[0] <= s.rango[1] && s.rango[0] >= 0 && s.rango[1] < N, `frame ${k}: rango ${s.rango}`);
      for (const [i, v] of Object.entries(s.est)) assert.ok(+i >= 0 && +i < N && estados.includes(v), `frame ${k}: est ${i}=${v}`);
      if (f.intercambiar) for (const [i, j] of Array.isArray(f.intercambiar[0]) ? f.intercambiar : [f.intercambiar]) assert.notEqual(i, j);
    });
    assert.deepEqual(s.arr, T.aplicar(arr, res.frames), 'plegar y aplicar() coinciden');
    assert.deepEqual(s.arr, res.arr, 'el estado final es el resultado del generador');
    if (res.frames.length) assert.deepEqual(s.cont, res.cont, 'el contador de la escena es el final');
    if (ordena) assert.deepEqual(s.arr, ordenada(arr), 'ordenado');
    return s;
  };

  console.log('ordenación por comparación');
  prueba('burbuja: ordena y los contadores coinciden con la referencia', () => {
    for (const a of ENTRADAS) {
      const r = T.trazaBurbuja(a), q = refBurbuja(a);
      reproduce(a, r);
      assert.deepEqual(r.cont, { comparaciones: q.c, intercambios: q.s }, JSON.stringify(a));
      assert.deepEqual(r.arr, q.a);
    }
  });
  prueba('burbuja: ya ordenado = n-1 comparaciones y ningún intercambio (con la bandera)', () => {
    const r = T.trazaBurbuja([1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(r.cont, { comparaciones: 7, intercambios: 0 });
  });
  prueba('inserción: ordena, comparaciones e intercambios = referencia (desplazando); casi ordenado es O(n + I)', () => {
    for (const a of ENTRADAS) {
      const r = T.trazaInsercion(a), q = refInsercion(a);
      reproduce(a, r);
      assert.deepEqual(r.cont, { comparaciones: q.c, intercambios: q.s }, JSON.stringify(a));
      if (a.length) assert.ok(r.cont.comparaciones <= a.length - 1 + r.cont.intercambios);
    }
    assert.deepEqual(T.trazaInsercion([1, 2, 4, 3, 5, 6, 8, 7]).cont, { comparaciones: 9, intercambios: 2 });
    assert.equal(T.trazaInsercion([1, 2, 3, 4, 5, 6, 7, 8]).cont.comparaciones, 7);
  });
  prueba('selección: ordena, siempre n(n-1)/2 comparaciones y ≤ n-1 intercambios', () => {
    for (const a of ENTRADAS) {
      const r = T.trazaSeleccion(a), q = refSeleccion(a);
      reproduce(a, r);
      assert.deepEqual(r.cont, { comparaciones: q.c, intercambios: q.s }, JSON.stringify(a));
      assert.equal(r.cont.comparaciones, (a.length * (a.length - 1) / 2) || 0);
      assert.ok(r.cont.intercambios <= Math.max(0, a.length - 1));
    }
  });
  prueba('estabilidad: inserción y merge conservan el orden de los iguales; selección y quicksort no siempre', () => {
    const K = x => Math.floor(x / 10), reg = [21, 12, 23, 14, 25, 16];
    const esta = r => r.every((x, i) => i === 0 || K(r[i - 1]) < K(x) || (K(r[i - 1]) === K(x) && r[i - 1] % 10 < x % 10));
    assert.ok(esta(T.trazaInsercion(reg, { clave: K }).arr));
    assert.deepEqual(T.trazaInsercion(reg, { clave: K }).arr, [12, 14, 16, 21, 23, 25]);
    assert.ok(!esta(T.trazaSeleccion(reg, { clave: K }).arr));
    assert.deepEqual(T.trazaSeleccion(reg, { clave: K }).arr, [12, 14, 16, 21, 25, 23]);
    assert.deepEqual(T.trazaInsercion(reg, { clave: K }).cont.comparaciones, refInsercion(reg, K).c);
    assert.deepEqual(T.trazaSeleccion(reg, { clave: K }).cont.comparaciones, refSeleccion(reg, K).c);
    // merge con `<=` es estable: ordenar pares (clave, llegada) por clave con la misma lógica de mezcla
    const estable = a => { const b = a.map((x, i) => [x, i]); const m = (lo, hi) => { if (lo >= hi) return; const mid = (lo + hi) >> 1; m(lo, mid); m(mid + 1, hi); const t = []; let i = lo, j = mid + 1; while (i <= mid && j <= hi) t.push(b[i][0] <= b[j][0] ? b[i++] : b[j++]); while (i <= mid) t.push(b[i++]); while (j <= hi) t.push(b[j++]); t.forEach((x, k) => { b[lo + k] = x; }); }; m(0, a.length - 1); return b; };
    const e = estable([2, 1, 2, 1, 2]); assert.deepEqual(e.map(x => x[1]), [1, 3, 0, 2, 4]);
    // quicksort (Lomuto, pivote final): {2a, 2b, 1} → {1, 2b, 2a}
    const q = [2, 2, 1].map((x, i) => [x, i]); const piv = q[2][0]; assert.equal(q.slice(0, 2).filter(x => x[0] < piv).length, 0); [q[0], q[2]] = [q[2], q[0]];
    assert.deepEqual(q.map(x => x[1]), [2, 1, 0]);
  });
  prueba('merge sort: ordena, comparaciones y copias = referencia, ≤ n·⌈log2 n⌉ comparaciones, fila aux vacía al final', () => {
    for (const a of ENTRADAS) {
      const r = T.trazaMergesort(a), q = refMerge(a);
      const s = reproduce(a, r, { aux: a.length });
      assert.deepEqual(r.cont, a.length > 1 ? { comparaciones: q.c, copias: q.cop } : { comparaciones: 0, copias: 0 }, JSON.stringify(a));
      assert.ok(s.aux.every(x => x === null));
      if (a.length > 1) assert.ok(r.cont.comparaciones <= a.length * Math.ceil(Math.log2(a.length)));
    }
    const r = T.trazaMergesort([5, 2, 8, 1, 7, 3, 6, 4]);
    assert.equal(r.cont.copias, 2 * 8 * 3); // 2·n·log2 n
  });
  prueba('quicksort (último / mediana de tres): ordena y los contadores coinciden con la referencia', () => {
    for (const a of ENTRADAS) {
      for (const [piv, med] of [['ultimo', false], ['mediana3', true]]) {
        const r = T.trazaQuicksort(a, { pivote: piv }), q = refQuick(a, med);
        reproduce(a, r);
        assert.deepEqual(r.cont, { comparaciones: q.c, intercambios: q.s }, `${piv} ${JSON.stringify(a)}`);
      }
    }
  });
  prueba('quicksort con pivote al azar (semilla fija): ordena y es reproducible', () => {
    for (const a of ENTRADAS) {
      const r = T.trazaQuicksort(a, { pivote: 'azar', semilla: 5 });
      reproduce(a, r);
      assert.deepEqual(T.trazaQuicksort(a, { pivote: 'azar', semilla: 5 }).frames, r.frames);
    }
  });
  prueba('quicksort: peor caso (ordenado, pivote final) = n(n-1)/2 y mediana de tres lo evita', () => {
    for (const len of [8, 12, 16]) {
      const a = Array.from({ length: len }, (_, i) => i + 1);
      assert.equal(T.trazaQuicksort(a).cont.comparaciones, len * (len - 1) / 2);
      assert.ok(T.trazaQuicksort(a, { pivote: 'mediana3' }).cont.comparaciones < len * (len - 1) / 2);
    }
  });
  prueba('partición de Lomuto: izquierda < pivote ≤ derecha y p es la posición final', () => {
    for (const a of ENTRADAS.filter(x => x.length > 1)) {
      const r = T.trazaLomuto(a), p = r.p, v = r.arr[p];
      reproduce(a, r, { ordena: false });
      assert.ok(r.arr.slice(0, p).every(x => x < v) && r.arr.slice(p + 1).every(x => x >= v));
      assert.equal(v, a[a.length - 1]);
      assert.deepEqual([...r.arr].sort((x, y) => x - y), ordenada(a));
    }
  });
  prueba('partición de Hoare: contadores y j = referencia; a[lo..j] ≤ pivote ≤ a[j+1..hi]', () => {
    for (const a of ENTRADAS.filter(x => x.length > 1)) {
      const r = T.trazaHoare(a), q = refHoare(a, 0, a.length - 1), piv = a[(a.length - 1) >> 1];
      reproduce(a, r, { ordena: false });
      assert.equal(r.j, q.j); assert.deepEqual(r.cont, { comparaciones: q.c, intercambios: q.s }); assert.deepEqual(r.arr, q.a);
      assert.ok(r.arr.slice(0, r.j + 1).every(x => x <= piv) && r.arr.slice(r.j + 1).every(x => x >= piv));
    }
  });
  prueba('n = 0, 1 y duplicados no rompen ningún generador', () => {
    for (const a of [[], [7], [3, 3, 3]]) {
      for (const f of [T.trazaBurbuja, T.trazaInsercion, T.trazaSeleccion, T.trazaMergesort, T.trazaQuicksort, T.trazaLomuto, T.trazaHoare]) {
        const r = f(a); assert.ok(Array.isArray(r.frames)); assert.deepEqual(T.aplicar(a, r.frames).length, a.length);
      }
      assert.ok(T.trazaBinaria(a, 3).frames.length >= 0 && T.trazaLimite(a, 3).frames.length >= 0 && T.trazaDosPunteros(a, 6).frames.length >= 0);
    }
    assert.equal(T.trazaBurbuja([]).frames.length, 0);
    assert.deepEqual(T.trazaMergesort([]).arr, []);
  });

  console.log('búsquedas');
  prueba('búsqueda binaria: encuentra el índice correcto (o -1) con las iteraciones de la referencia', () => {
    for (const base of ENTRADAS) {
      const a = ordenada(base);
      for (const x of [...a, 0, 100, 2.5 | 0, ...(a.length ? [a[0] + 1, a[a.length - 1] + 1] : [])]) {
        const r = T.trazaBinaria(a, x), q = refBin(a, x);
        reproduce(a, r, { ordena: false });
        assert.equal(r.idx, q.idx === -1 ? -1 : r.idx); assert.equal(r.cont.iteraciones, q.it);
        if (r.idx >= 0) assert.equal(a[r.idx], x); else assert.ok(!a.includes(x));
        assert.ok(r.cont.iteraciones <= Math.floor(Math.log2(Math.max(1, a.length))) + 1);
      }
    }
    const a = [3, 8, 12, 15, 21, 27, 34, 41, 49, 56, 63, 72];
    assert.equal(T.trazaBinaria(a, 41).idx, 7); assert.equal(T.trazaBinaria(a, 30).idx, -1);
  });
  prueba('lower_bound / upper_bound a mano = std (primera posición ≥ x / > x) con duplicados', () => {
    const lower = (a, x) => a.findIndex(v => v >= x) < 0 ? a.length : a.findIndex(v => v >= x);
    const upper = (a, x) => a.findIndex(v => v > x) < 0 ? a.length : a.findIndex(v => v > x);
    for (const base of ENTRADAS) {
      const a = ordenada(base);
      for (const x of [0, 1, 2, 3, 4, 5, 9, 100]) for (const sup of [false, true]) {
        const r = T.trazaLimite(a, x, sup), q = refLower(a, x, sup);
        reproduce(a, r, { ordena: false });
        assert.equal(r.pos, sup ? upper(a, x) : lower(a, x), `${JSON.stringify(a)} x=${x} sup=${sup}`);
        assert.equal(r.cont.iteraciones, q.it);
      }
    }
    const d = [2, 4, 4, 4, 7, 9, 9, 12, 15, 15, 18, 21];
    assert.deepEqual([T.trazaLimite(d, 4, false).pos, T.trazaLimite(d, 4, true).pos], [1, 4]);
  });
  prueba('dos punteros: encuentra el par (si existe) y es O(n) iteraciones', () => {
    for (const base of ENTRADAS) {
      const a = ordenada(base);
      for (let t = 0; t <= 2 * (a.at(-1) ?? 0) + 1; t++) {
        const r = T.trazaDosPunteros(a, t), q = refPar(a, t), hay = a.some((x, i) => a.some((y, j) => i < j && x + y === t));
        reproduce(a, r, { ordena: false });
        assert.equal(r.par !== null, hay, `${JSON.stringify(a)} t=${t}`);
        if (r.par) assert.equal(a[r.par[0]] + a[r.par[1]], t);
        assert.equal(r.cont.iteraciones, q.it); assert.ok(r.cont.iteraciones <= Math.max(0, a.length - 1));
      }
    }
  });
  prueba('ventana deslizante: mayor suma de k seguidos (fuerza bruta) y n-k pasos', () => {
    for (const a of ENTRADAS.filter(x => x.length >= 2)) {
      for (let k = 1; k <= a.length; k++) {
        const r = T.trazaVentana(a, k);
        let mejor = -1, desde = 0;
        for (let i = 0; i + k <= a.length; i++) { const s = a.slice(i, i + k).reduce((x, y) => x + y, 0); if (s > mejor) { mejor = s; desde = i; } }
        assert.equal(r.mejor, mejor); assert.equal(r.desde, desde); assert.equal(r.cont.mejor, mejor);
        assert.equal(r.frames.length, a.length - k + 1);
        let s = plegar(undefined, { barras: { arr: a, max: Math.max(...a) } }); s = plegar(s, r.inicial);
        for (const f of r.frames) { s = plegar(s, f); if (s.rango) assert.equal(s.rango[1] - s.rango[0] + 1, k); }
        assert.deepEqual(Object.keys(s.est).map(Number), Array.from({ length: k }, (_, i) => desde + i));
      }
    }
  });
  prueba('counting sort: ordena sin comparar; la fila aux es la cuenta', () => {
    for (const a of [[3, 7, 1, 3, 9, 2, 7, 3, 5, 1], [0, 0, 0], [5], [], [2, 1, 0, 1, 2], azar(12, 9, 3)]) {
      const M = 10, r = T.trazaConteo(a, M);
      const s = reproduce(a, r, { aux: M, max: Math.max(M, ...a, 1) });
      assert.equal(r.cont.comparaciones, 0); assert.equal(r.cont.escrituras, 2 * a.length);
      assert.deepEqual(r.arr, ordenada(a));
      const cuenta = Array(M).fill(0); a.forEach(v => cuenta[v]++);
      assert.deepEqual(s.aux, Array(M).fill(0), 'tras escribir todo, la cuenta queda a 0');
      assert.ok(cuenta.reduce((x, y) => x + y, 0) === a.length);
    }
  });

  console.log('laboratorio');
  prueba('costes(): los contadores de cada forma y algoritmo salen de las referencias', () => {
    const C = T.costes(16);
    for (const forma of ['aleatorio', 'ordenado', 'inverso', 'casi']) {
      const a = T.datos(forma, 16);
      assert.deepEqual(ordenada(a), Array.from({ length: 16 }, (_, i) => i + 1), 'permutación de 1..16');
      assert.equal(C[forma].burbuja.comparaciones, refBurbuja(a).c);
      assert.equal(C[forma].insercion.comparaciones, refInsercion(a).c);
      assert.equal(C[forma].seleccion.comparaciones, refSeleccion(a).c);
      assert.equal(C[forma].merge.comparaciones, refMerge(a).c);
      assert.equal(C[forma].quick.comparaciones, refQuick(a).c);
      assert.equal(C[forma].quick3.comparaciones, refQuick(a, true).c);
    }
    assert.equal(C.ordenado.insercion.comparaciones, 15); assert.equal(C.ordenado.quick.comparaciones, 120);
    assert.deepEqual(T.datos('casi', 16).filter((x, i) => x !== i + 1).length, 6);
  });
  prueba('minIntercambios (n − ciclos) y minArrastres (n − LIS) coinciden con búsqueda exhaustiva (BFS) en n ≤ 6', () => {
    const perms = p => (p.length <= 1 ? [p] : p.flatMap((x, i) => perms([...p.slice(0, i), ...p.slice(i + 1)]).map(r => [x, ...r])));
    const bfs = (ini, vecinos) => {
      const meta = ini.map((_, i) => i + 1).join(), visto = new Map([[ini.join(), 0]]); let cola = [ini];
      while (cola.length) { const nueva = []; for (const a of cola) { if (a.join() === meta) return visto.get(meta); for (const b of vecinos(a)) if (!visto.has(b.join())) { visto.set(b.join(), visto.get(a.join()) + 1); nueva.push(b); } } cola = nueva; }
    };
    const swaps = a => a.flatMap((_, i) => a.slice(i + 1).map((__, k) => { const b = [...a]; [b[i], b[i + 1 + k]] = [b[i + 1 + k], b[i]]; return b; }));
    const mueve = a => a.flatMap((_, i) => a.map((__, j) => (i === j ? null : B.moverEn(a, i, j))).filter(Boolean));
    for (const len of [1, 2, 3, 4, 5, 6]) for (const p of perms(Array.from({ length: len }, (_, i) => i + 1))) {
      assert.equal(T.minIntercambios(p), bfs(p, swaps), `swaps ${p}`);
      assert.equal(T.minArrastres(p), bfs(p, mueve), `arrastres ${p}`);
      const fuera = T.fueraDeCreciente(p), resto = p.filter((_, i) => !fuera.includes(i));
      assert.equal(fuera.length, T.minArrastres(p)); assert.ok(resto.every((x, i) => i === 0 || resto[i - 1] < x));
    }
  });

  console.log('la guía');
  prueba('estructura: 38–48 pasos, 6–7 secciones, ≥3 preguntas, ≥2 interactivos, trazas ≤ 150 frames', () => {
    const P = G.pasos;
    assert.ok(P.length >= 38 && P.length <= 48, `pasos ${P.length}`);
    assert.ok(P.filter(p => p.sec).length >= 6 && P.filter(p => p.sec).length <= 7);
    assert.ok(P.filter(p => p.pregunta).length >= 3 && P.filter(p => p.jugar).length >= 2);
    assert.ok(P[0].sec && P[0].barras);
    for (const p of P.filter(p => p.traza)) assert.ok(p.traza.length >= 1 && p.traza.length <= 150, `traza de ${p.traza.length} frames`);
    for (const lang of ['es', 'en']) for (const p of P) { assert.ok(p[lang].length <= 420, p[lang]); const prosa = p[lang].replace(/\$[^$]*\$/g, '').replace(/`[^`]*`/g, ''); assert.ok(!/[!¡]/.test(prosa), `exclamación: ${p[lang]}`); assert.ok(!/\*/.test(prosa.replace(/\*\*/g, '')), `asterisco suelto: ${p[lang]}`); }
    const barrasMax = Math.max(...P.filter(p => p.barras).map(p => p.barras.arr.length));
    assert.ok(barrasMax <= 32);
  });
  prueba('todos los pasos pliegan en su escena; cada traza reproduce hasta el final sin salirse', () => {
    const mods = { barras: B, arbol: AR, grafica: GR };
    let tipo = null, s = null, trazas = 0;
    for (const p of G.pasos) {
      const nuevo = Object.keys(mods).find(k => p[k] !== undefined);
      if (nuevo) { tipo = nuevo; s = mods[tipo].plegar(undefined, p); } else s = mods[tipo].plegar(s, p);
      if (!p.traza) continue;
      trazas++; assert.equal(tipo, 'barras');
      let t = s;
      for (const f of p.traza) {
        t = plegar(t, f);
        for (const v of [...t.arr, ...t.aux.filter(x => x !== null)]) assert.ok(v >= 0 && v <= t.def.max, `valor ${v} > max ${t.def.max}`);
        if (t.rango) assert.ok(t.rango[0] <= t.rango[1]);
      }
      assert.ok(t.arr.length === t.def.arr.length);
    }
    assert.ok(trazas >= 15);
  });
  prueba('jugar «ordénalo tú»: botones y arrastre no rompen; los mínimos de las lecturas son correctos', () => {
    const p = G.pasos.find(x => x.jugar?.arrastrables), J = p.jugar, S = plegar(undefined, p), v = B.vista(S), cx = B.ctx(S);
    const val = (nombre) => J.lecturas(v, cx).find(r => r.expr === nombre).valor;
    assert.equal(val('mín. arrastres'), T.minArrastres(cx.inicial)); assert.equal(val('mín. intercambios'), T.minIntercambios(cx.inicial));
    const r = lcg(9);
    for (let k = 0; k < 60; k++) {
      const i = Math.floor(r() * cx.n), j = Math.floor(r() * cx.n);
      if (k % 7 === 0) J.botones[k % 3].hacer(v, cx); else if (i !== j) J.soltar(v, i, j, cx);
      assert.deepEqual(ordenada(v.arr), ordenada(cx.inicial)); J.lecturas(v, cx); J.hl(v, cx);
      assert.deepEqual(ordenada(B.conVista(S, v).ord), Array.from({ length: cx.n }, (_, x) => x), 'identidad intacta');
    }
    // Resolver con los mínimos: insertar fuera de la subsecuencia creciente deja ordenado en n − LIS arrastres
    B.reponer(v, cx.inicial); v.base = [...cx.inicial]; v.cont = { movimientos: 0 };
    let guardia = 0;
    while (!ordenado(v.arr) && guardia++ < 20) {
      const fuera = T.fueraDeCreciente(v.arr)[0], x = v.arr[fuera], resto = v.arr.filter((_, i) => i !== fuera);
      let destino = resto.findIndex(y => y > x); if (destino < 0) destino = resto.length;
      J.soltar(v, fuera, destino, cx);
    }
    assert.ok(ordenado(v.arr)); assert.equal(v.cont.movimientos, T.minArrastres(cx.inicial));
    assert.equal(J.lecturas(v, cx).find(x => x.expr === 'movimientos').malo, false);
  });
  prueba('jugar «carrera»: las lecturas son las comparaciones de los generadores con n = 16', () => {
    const p = G.pasos.filter(x => x.jugar).at(-1), J = p.jugar, S = plegar(undefined, p), v = B.vista(S), cx = B.ctx(S);
    const formas = ['aleatorio', 'ordenado', 'inverso', 'casi ordenado'], C = T.costes(16);
    for (let f = 0; f < 4; f++) {
      J.botones[f].hacer(v, cx);
      assert.deepEqual(ordenada(v.arr), Array.from({ length: 16 }, (_, i) => i + 1));
      const lec = J.lecturas(v, cx), id = ['aleatorio', 'ordenado', 'inverso', 'casi'][f];
      assert.equal(lec[0].valor, formas[f]);
      Object.keys(T.ALGORITMOS).forEach((alg, i) => assert.equal(parseInt(lec[i + 1].valor), C[id][alg].comparaciones, `${id} ${alg}`));
      for (let a = 0; a < Object.keys(T.ALGORITMOS).length; a++) {
        J.botones[4 + a].hacer(v, cx);
        assert.ok(ordenado(v.arr)); const c = B.conVista(S, v); assert.ok(c.arr.length === 16);
        assert.equal(v.cont.comparaciones, C[id][Object.keys(T.ALGORITMOS)[a]].comparaciones);
        assert.deepEqual(ordenada(c.ord), Array.from({ length: 16 }, (_, x) => x));
        J.hl?.(v, cx);
      }
    }
  });

  console.log(`\n✓ ${n} pruebas de ordenación`);
})().catch(e => { console.error('\n✗ ' + (e.stack || e)); process.exit(1); });
