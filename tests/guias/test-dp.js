#!/usr/bin/env node
'use strict';
/**
 * Pruebas Node de la guía «Programación dinámica» (sin navegador):  node tests/guias/test-dp.js
 * Cada generador de data/dp-traza.js se prueba contra una referencia escrita aparte (fuerza bruta o recursión): mochila 0/1,
 * LCS, distancia de edición, monedas (mínimo, voraz y formas), LIS, fib memoizado y escaleras. Se comprueban las
 * reconstrucciones (objetos, subsecuencia, operaciones, LIS), que los frames pliegan en la escena «tabla» sin salirse, que el
 * último estado de cada traza coincide con el parche de restauración del paso siguiente y que los bloques `jugar` se pueden
 * ejecutar (clic en celda + botones) hasta resolver las tablas. Al final recorre la guía (textos, listados, fuentes, validador).
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const imp = f => import(pathToFileURL(path.join(ROOT, f)).href);
let n = 0;
const prueba = (nombre, fn) => { fn(); n++; console.log('  ok  ' + nombre); };
const lcg = seed => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
const entre = (r, a, b) => a + Math.floor(r() * (b - a + 1));

// ── Referencias (independientes de los generadores) ─────────────────────────────────────────────────────────────────
const refMochila = (items, W) => {
  let mejor = 0;
  for (let m = 0; m < 1 << items.length; m++) {
    let p = 0, v = 0;
    items.forEach((x, i) => { if (m >> i & 1) { p += x.p; v += x.v; } });
    if (p <= W && v > mejor) mejor = v;
  }
  return mejor;
};
const refLCS = (a, b) => (!a.length || !b.length ? 0 : a.at(-1) === b.at(-1) ? 1 + refLCS(a.slice(0, -1), b.slice(0, -1)) : Math.max(refLCS(a.slice(0, -1), b), refLCS(a, b.slice(0, -1))));
const esSubsec = (s, t) => { let i = 0; for (const ch of t) if (i < s.length && s[i] === ch) i++; return i === s.length; };
const refTodasLCS = (a, b) => {
  const L = refLCS(a, b), out = new Set();
  for (let m = 0; m < 1 << a.length; m++) {
    let s = ''; for (let i = 0; i < a.length; i++) if (m >> i & 1) s += a[i];
    if (s.length === L && esSubsec(s, b)) out.add(s);
  }
  return [...out].sort();
};
const refEdit = (a, b) => (!a.length ? b.length : !b.length ? a.length
  : Math.min(refEdit(a.slice(0, -1), b) + 1, refEdit(a, b.slice(0, -1)) + 1, refEdit(a.slice(0, -1), b.slice(0, -1)) + (a.at(-1) === b.at(-1) ? 0 : 1)));
const refMonedas = (m, T) => { // mínimo de monedas por recursión con memo propio (null = imposible)
  const memo = new Map();
  const f = c => {
    if (c === 0) return 0; if (memo.has(c)) return memo.get(c);
    let mejor = Infinity;
    for (const x of m) if (x <= c) mejor = Math.min(mejor, 1 + f(c - x));
    memo.set(c, mejor); return mejor;
  };
  const r = f(T); return r === Infinity ? null : r;
};
const refVoraz = (m, T) => { // la mayor moneda posible cada vez
  const orden = [...m].sort((a, b) => b - a); let resto = T, k = 0;
  while (resto > 0) { const x = orden.find(y => y <= resto); if (x === undefined) return null; resto -= x; k++; }
  return k;
};
const refCombinaciones = (m, T, desde = 0) => (T === 0 ? 1 : m.slice(desde).reduce((s, x, i) => (x <= T ? s + refCombinaciones(m, T - x, desde + i) : s), 0));
const refSecuencias = (m, T) => (T === 0 ? 1 : m.reduce((s, x) => (x <= T ? s + refSecuencias(m, T - x) : s), 0));
const refLIS = v => {
  let mejor = 0;
  for (let m = 0; m < 1 << v.length; m++) {
    const s = v.filter((_, i) => m >> i & 1);
    if (s.every((x, i) => i === 0 || s[i - 1] < x) && s.length > mejor) mejor = s.length;
  }
  return mejor;
};
const refLISterminaEn = (v, i) => { // mayor creciente que termina en i, por subconjuntos de los anteriores
  let mejor = 1;
  for (let m = 0; m < 1 << i; m++) {
    const s = v.slice(0, i).filter((_, k) => m >> k & 1); s.push(v[i]);
    if (s.every((x, k) => k === 0 || s[k - 1] < x) && s.length > mejor) mejor = s.length;
  }
  return mejor;
};
const refEscaleras = k => (k < 0 ? 0 : k === 0 ? 1 : refEscaleras(k - 1) + refEscaleras(k - 2));
const refFib = k => (k < 2 ? k : refFib(k - 1) + refFib(k - 2));

(async () => {
  const T = await imp('assets/guias/tabla.js');
  const D = await imp('assets/guias/data/dp-traza.js');
  const G = (await imp('assets/guias/data/dp.js')).default;
  const { plegar } = T;

  /** Pliega frames sobre un estado: nada se sale, valores ≤ 8 caracteres, y devuelve el estado final. */
  const plegarFrames = (S, frames, tope = 120) => {
    assert.ok(frames.length > 0 && frames.length <= tope, `frames ${frames.length}`);
    let s = S;
    for (const f of frames) {
      assert.ok(typeof f.es === 'string' && f.es && typeof f.en === 'string' && f.en, 'frame sin texto');
      const p = Object.keys(f).filter(k => !['es', 'en', 'line', 'val', 'est', 'deps', 'marcas', 'resaltar', 'formula'].includes(k));
      assert.deepEqual(p, [], 'claves de frame desconocidas');
      s = plegar(s, f);
      for (const fila of s.val) for (const x of fila) assert.ok(x === null || String(x).length <= 8, `valor «${x}»`);
      assert.equal(s.val.length, S.def.filas); assert.ok(s.val.every(fila => fila.length === S.def.cols));
    }
    return s;
  };
  const vacia = (filas, cols, val = null) => plegar(undefined, { tabla: { filas, cols, val } });

  console.log('Fibonacci y escaleras');
  prueba('fib memoizado: valores, 2n−1 llamadas, n−3 aciertos y frames que pliegan', () => {
    for (let k = 2; k <= 10; k++) {
      const r = D.fibMemoTraza(k);
      assert.deepEqual(r.fila, Array.from({ length: k + 1 }, (_, i) => refFib(i)));
      assert.equal(r.resultado, refFib(k)); assert.equal(r.llamadas, 2 * k - 1); assert.equal(r.aciertos, Math.max(0, k - 3));
      const fin = plegarFrames(vacia(1, k + 1, D.inicialFila(k, 0, 1)), r.frames);
      assert.deepEqual(fin.val, [r.fila]);
    }
    assert.equal(D.llamadasFib(6), 25); assert.equal(D.fibNum(7), 13);
  });
  prueba('tabla ascendente de dos términos: fib y escaleras contra la recursión', () => {
    for (let k = 2; k <= 12; k++) {
      const f = D.sumaDosTraza(k, 0, 1, 'fib'), e = D.sumaDosTraza(k, 1, 1, 'esc');
      assert.deepEqual(f.dp, Array.from({ length: k + 1 }, (_, i) => refFib(i)));
      assert.deepEqual(e.dp, Array.from({ length: k + 1 }, (_, i) => refEscaleras(i)));
      assert.deepEqual(plegarFrames(vacia(1, k + 1, D.inicialFila(k, 1, 1)), e.frames).val, [e.dp]);
      assert.equal(e.frames.length, 2 * (k - 1));
    }
  });
  prueba('dos variables: la respuesta es escaleras(n) y solo quedan dos celdas con valor', () => {
    for (let k = 2; k <= 12; k++) {
      const r = D.dosVariablesTraza(k);
      assert.equal(r.resultado, refEscaleras(k));
      const fin = plegarFrames(vacia(1, k + 1, D.inicialFila(k, 1, 1)), r.frames);
      assert.deepEqual(fin.val[0].map((x, i) => (x === null ? -1 : i)).filter(i => i >= 0), [k - 1, k]);
      assert.equal(fin.val[0][k], r.resultado);
    }
  });
  prueba('escaleras(92) desborda un long long con signo (y la 91 no)', () => {
    const F = k => { let a = 0n, b = 1n; for (let i = 0; i < k; i++) [a, b] = [b, a + b]; return a; };
    const MAX = 2n ** 63n - 1n;
    assert.ok(F(92) <= MAX && F(93) > MAX); // escaleras(n) = F(n+1): n = 91 cabe, n = 92 no
  });

  console.log('Mochila 0/1');
  prueba('tabla contra fuerza bruta en instancias aleatorias (todas las capacidades)', () => {
    const r = lcg(7);
    for (let t = 0; t < 40; t++) {
      const items = Array.from({ length: entre(r, 1, 7) }, () => ({ p: entre(r, 1, 6), v: entre(r, 1, 9) })), W = entre(r, 0, 13);
      const dp = D.tablaMochila(items, W), tz = D.mochilaTraza(items, W);
      assert.deepEqual(tz.dp, dp);
      for (let w = 0; w <= W; w++) assert.equal(dp[items.length][w], refMochila(items, w), `w=${w}`);
    }
    assert.deepEqual(D.tablaMochila().at(-1), [0, 1, 1, 4, 5, 7, 8, 9]);
  });
  prueba('la traza rellena la tabla y deja el estado final en hecha (sin activa ni lee)', () => {
    const r = D.mochilaTraza(), S = vacia(5, 8, r.dp.map((f, i) => (i === 0 ? f : f.map(() => null))));
    const fin = plegarFrames(S, r.frames);
    assert.deepEqual(fin.val, r.dp);
    assert.equal(r.frames.length, 2 * 4 * 8);
    assert.ok(r.frames.every(f => !f.formula || f.formula.es.length <= 90));
  });
  prueba('reconstrucción: objetos distintos, peso ≤ W y valor = dp[n][W]', () => {
    const r = lcg(11);
    for (let t = 0; t < 40; t++) {
      const items = Array.from({ length: entre(r, 1, 7) }, () => ({ p: entre(r, 1, 6), v: entre(r, 1, 9) })), W = entre(r, 0, 13);
      const dp = D.tablaMochila(items, W), c = D.caminoMochila(dp, items, W);
      assert.equal(new Set(c.elegidos).size, c.elegidos.length);
      assert.ok(c.peso <= W && c.valor === dp[items.length][W] && c.valor === refMochila(items, W));
      assert.deepEqual(c.celdas.at(0), [items.length, W]); assert.equal(c.celdas.length, items.length + 1);
      const tz = D.mochilaCaminoTraza(items, W); assert.deepEqual(tz.elegidos, c.elegidos);
      plegarFrames(vacia(items.length + 1, W + 1, dp), tz.frames);
    }
    const c = D.caminoMochila(D.tablaMochila()); assert.deepEqual([c.elegidos, c.peso, c.valor], [[2, 3], 7, 9]);
  });
  prueba('una fila: hacia atrás es la 0/1 correcta; hacia delante cuenta el objeto varias veces', () => {
    const r = lcg(13);
    for (let t = 0; t < 40; t++) {
      const item = { p: entre(r, 1, 5), v: entre(r, 1, 9) }, W = entre(r, 0, 13);
      const a = D.mochilaFilaTraza('atras', item, W), d = D.mochilaFilaTraza('adelante', item, W);
      assert.deepEqual(a.dp, Array.from({ length: W + 1 }, (_, w) => refMochila([item], w)));
      assert.deepEqual(d.dp, Array.from({ length: W + 1 }, (_, w) => Math.floor(w / item.p) * item.v));
      assert.deepEqual(a.mal, []); assert.equal(d.mal.length, d.dp.filter(x => x > item.v).length);
      if (W >= 2 * item.p) assert.ok(d.mal.length > 0);
      assert.deepEqual(plegarFrames(vacia(1, W + 1, [Array(W + 1).fill(0)]), a.frames).val, [a.dp]);
      assert.deepEqual(plegarFrames(vacia(1, W + 1, [Array(W + 1).fill(0)]), d.frames).val, [d.dp]);
    }
    assert.deepEqual(D.mochilaFilaTraza('adelante').dp, [0, 0, 0, 4, 4, 4, 8, 8]);
  });

  console.log('LCS y distancia de edición');
  prueba('LCS: tabla contra recursión, subsecuencia válida y todas las de longitud máxima contra fuerza bruta', () => {
    const r = lcg(17), al = 'ABC';
    const cad = k => Array.from({ length: k }, () => al[entre(r, 0, 2)]).join('');
    for (let t = 0; t < 40; t++) {
      const a = cad(entre(r, 0, 7)), b = cad(entre(r, 0, 7)), dp = D.tablaLCS(a, b);
      assert.equal(dp[a.length][b.length], refLCS(a, b));
      const { sub } = D.caminoLCS(a, b, dp);
      assert.equal(sub.length, refLCS(a, b)); assert.ok(esSubsec(sub, a) && esSubsec(sub, b));
      assert.deepEqual(D.todasLCS(a, b), refTodasLCS(a, b));
      if (a.length && b.length) {
        const z = D.lcsTraza(a, b); assert.deepEqual(z.dp, dp);
        assert.deepEqual(plegarFrames(vacia(a.length + 1, b.length + 1, D.bordeLCS(a, b)), z.frames, 200).val, dp);
        const c = D.lcsCaminoTraza(a, b); assert.equal(c.sub, sub);
        plegarFrames(vacia(a.length + 1, b.length + 1, dp), c.frames);
      }
    }
    const dp = D.tablaLCS(D.A_LCS, D.B_LCS); assert.equal(dp[7][6], 4); assert.deepEqual(D.todasLCS(D.A_LCS, D.B_LCS), ['BCAB', 'BCBA', 'BDAB']);
  });
  prueba('distancia de edición: tabla contra recursión; las operaciones transforman a en b con dp ops', () => {
    const r = lcg(19), al = 'abc';
    const cad = k => Array.from({ length: k }, () => al[entre(r, 0, 2)]).join('');
    for (let t = 0; t < 40; t++) {
      const a = cad(entre(r, 0, 6)), b = cad(entre(r, 0, 6)), dp = D.tablaEdicion(a, b);
      assert.equal(dp[a.length][b.length], refEdit(a, b));
      const c = D.caminoEdicion(a, b, dp);
      assert.equal(D.aplicarOps(a, c.ops), b); assert.equal(c.total, dp[a.length][b.length]);
      if (a.length && b.length) {
        const z = D.edicionTraza(a, b); assert.deepEqual(z.dp, dp);
        assert.deepEqual(plegarFrames(vacia(a.length + 1, b.length + 1, D.bordeEdicion(a, b)), z.frames, 200).val, dp);
        plegarFrames(vacia(a.length + 1, b.length + 1, dp), D.edicionCaminoTraza(a, b).frames);
      }
    }
    const dp = D.tablaEdicion('kitten', 'sitting'); assert.equal(dp[6][7], 3);
    assert.equal(D.textoOps(D.caminoEdicion('kitten', 'sitting', dp).ops), 'k→s, e→i, +g');
  });

  console.log('Cambio de monedas');
  prueba('DP de monedas contra recursión (con y sin moneda 1) y voraz contra la referencia', () => {
    const r = lcg(23);
    for (let t = 0; t < 60; t++) {
      const m = [...new Set(Array.from({ length: entre(r, 1, 4) }, () => entre(r, 1, 9)))], T = entre(r, 0, 20);
      const dp = D.dpMonedas(m, T);
      for (let c = 0; c <= T; c++) { assert.equal(dp[c], refMonedas(m, c), `${m} c=${c}`); assert.equal(D.vorazMonedas(m, c), refVoraz(m, c), `voraz ${m} c=${c}`); }
    }
    assert.equal(refMonedas([1, 3, 4], 6), 2); assert.equal(refVoraz([1, 3, 4], 6), 3);
    assert.deepEqual(D.dpMonedas([1, 5, 10, 25], 30).map((x, c) => x === D.vorazMonedas([1, 5, 10, 25], c)), Array(31).fill(true));
  });
  prueba('traza de monedas: llena la fila DP y marca mal exactamente donde el voraz difiere', () => {
    const z = D.monedasTraza([1, 3, 4], 12), [dp, vz] = D.tablaMonedas([1, 3, 4], 12);
    assert.deepEqual(z.dp, dp); assert.deepEqual(z.vz, vz);
    assert.deepEqual(Object.keys(z.mal), ['1,6', '1,10']);
    const S = vacia(2, 13, [dp.map((x, c) => (c === 0 ? 0 : null)), vz]);
    const fin = plegarFrames(S, z.frames);
    assert.deepEqual(fin.val, [dp, vz]);
    assert.equal(z.frames.length, 24);
  });
  prueba('formas de cambio: combinaciones y permutaciones contra enumeración', () => {
    const r = lcg(29);
    for (let t = 0; t < 40; t++) {
      const m = [...new Set(Array.from({ length: entre(r, 1, 3) }, () => entre(r, 1, 6)))], T = entre(r, 0, 12);
      assert.equal(D.formasTabla(m, T)[m.length][T], refCombinaciones(m, T), `${m} ${T}`);
      assert.equal(D.permutaciones(m, T), refSecuencias(m, T), `${m} ${T}`);
      const z = D.formasTraza(m, T);
      assert.deepEqual(plegarFrames(vacia(m.length + 1, T + 1, D.formasTabla(m, T).map((f, k) => (k === 0 ? f : f.map(() => null)))), z.frames, 400).val, z.dp);
    }
    assert.equal(D.formasTabla([1, 2, 5], 7)[3][7], 6); assert.equal(D.permutaciones([1, 2, 5], 7), 26);
    assert.equal(refCombinaciones([1, 2], 3), 2); assert.equal(refSecuencias([1, 2], 3), 3);
  });

  console.log('LIS');
  prueba('LIS O(n²), reconstrucción y cola O(n log n) contra fuerza bruta; dp[i] contra subconjuntos', () => {
    const r = lcg(31);
    for (let t = 0; t < 50; t++) {
      const v = Array.from({ length: entre(r, 1, 10) }, () => entre(r, 1, 9));
      const L = D.lisN2(v), ref = refLIS(v);
      assert.equal(L.mejor, ref); assert.equal(D.lisCola(v).length, ref); assert.equal(L.seq.length, ref);
      assert.ok(L.seq.every((x, i) => i === 0 || L.seq[i - 1] < x)); assert.ok(L.idx.every((x, i) => i === 0 || L.idx[i - 1] < x));
      assert.deepEqual(L.idx.map(i => v[i]), L.seq);
      L.dp.forEach((x, i) => assert.equal(x, refLISterminaEn(v, i), `${v} i=${i}`));
      const z = D.lisTraza(v); assert.deepEqual(z.dp, L.dp);
      assert.deepEqual(plegarFrames(vacia(2, v.length, [v, v.map(() => null)]), z.frames, 200).val, [v, L.dp]);
      const c = D.lisColaTraza(v); assert.deepEqual(c.cola, D.lisCola(v));
      plegarFrames(vacia(1, v.length, [v.map(() => null)]), c.frames, 200);
    }
    const L = D.lisN2(D.V_LIS); assert.deepEqual([L.mejor, L.seq], [4, [3, 4, 5, 9]]);
    const cola = D.lisCola(D.V_LIS); assert.deepEqual(cola, [1, 2, 5, 6]);
    assert.ok(!esSubsec(cola.map(String).join(''), D.V_LIS.map(String).join(''))); // la cola no es una subsecuencia de v
  });

  console.log('Guía: pasos, trazas y restauración');
  prueba('estructura: 40–50 pasos, 6–7 secciones, ≥ 4 preguntas, ≥ 4 jugar, ≥ 8 trazas, fuentes APA', () => {
    const P = G.pasos;
    assert.ok(P.length >= 40 && P.length <= 50, `pasos ${P.length}`);
    assert.ok(P.filter(p => p.sec).length >= 6 && P.filter(p => p.sec).length <= 7);
    assert.ok(P.filter(p => p.pregunta).length >= 4 && P.filter(p => p.jugar).length >= 4 && P.filter(p => p.traza).length >= 8);
    assert.ok(P[0].sec && P[0].tabla);
    assert.ok(G.fuentes.length >= 4 && G.fuentes.length <= 6);
    for (const f of G.fuentes) { assert.ok(f.length <= 600 && (f.match(/\*/g) || []).length % 2 === 0); assert.ok(/\(\d{4}\)/.test(f)); }
    for (const p of P) if (p.pregunta) for (const o of p.pregunta.opc) assert.ok(!/\$/.test(o.es + o.en), 'opciones sin KaTeX');
  });
  prueba('textos: ≤ 420 caracteres, asteriscos y símbolos pareados, listados ≤ 14 líneas con las mismas líneas en es y en', () => {
    const limpio = t => t.replace(/`[^`]*`/g, '').replace(/\$[^$]*\$/g, '');
    let code = { es: '', en: '' };
    G.pasos.forEach((p, i) => {
      if (p.code !== undefined) code = typeof p.code === 'object' ? p.code : { es: p.code, en: p.code };
      assert.ok(code.es.split('\n').length <= 14 && code.es.split('\n').length === code.en.split('\n').length, `código paso ${i + 1}`);
      for (const l of ['es', 'en']) {
        const t = p[l];
        assert.ok(t.length <= 420, `paso ${i + 1} ${l}: ${t.length}`);
        assert.equal((limpio(t).match(/\*/g) || []).length % 2, 0, `asteriscos sueltos en paso ${i + 1} ${l}`);
        assert.equal((t.match(/\$/g) || []).length % 2, 0);
        for (const m of t.match(/\$[^$]*\$/g) || []) assert.equal((m.match(/\{/g) || []).length, (m.match(/\}/g) || []).length, `llaves de ${m}`);
        assert.ok(!/[!¡]/.test(t) && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t), `sin exclamaciones ni emojis (paso ${i + 1})`);
      }
    });
  });
  prueba('cada traza termina con el mismo `val` que declara el paso siguiente (restauración) y sin lee/activa sueltas', () => {
    let S = null, abiertos = 0;
    const estados = [];
    G.pasos.forEach(p => {
      S = p.tabla !== undefined ? plegar(undefined, p) : plegar(S, p);
      estados.push(S);
    });
    G.pasos.forEach((p, i) => {
      if (!p.traza) return;
      const fin = plegarFrames(estados[i], p.traza), sig = estados[i + 1];
      assert.ok(sig, 'una traza no puede ser el último paso');
      assert.deepEqual(fin.val, sig.val, `paso ${i + 1}: la restauración del paso ${i + 2} no coincide con el final de la traza`);
      assert.ok(Object.values(fin.est).every(e => e !== 'activa' && e !== 'lee'), `paso ${i + 1}: queda una celda activa o leída`);
      abiertos++;
    });
    assert.equal(abiertos, G.pasos.filter(p => p.traza).length);
  });
  prueba('el primer paso tras cada traza restaura val y est (o abre otra tabla)', () => {
    G.pasos.forEach((p, i) => {
      if (!p.traza) return;
      const s = G.pasos[i + 1];
      assert.ok(s.tabla !== undefined || (s.val !== undefined && s.est !== undefined), `paso ${i + 2} no restaura`);
    });
  });

  console.log('Guía: bloques jugar');
  const juegos = (() => { let S = null; const out = []; G.pasos.forEach(p => { S = p.tabla !== undefined ? plegar(undefined, p) : plegar(S, p); if (p.jugar) out.push([p, S]); }); return out; })();
  assert.equal(juegos.length, 4);
  const [[pMoch, SMoch], [pCap, SCap], [pLcs, SLcs], [pMon, SMon]] = juegos;
  const lect = (J, v, cx, en = false) => {
    const doc = globalThis.document;
    if (en) globalThis.document = { documentElement: { lang: 'en' } };
    try { return J.lecturas(v, cx); } finally { globalThis.document = doc; }
  };
  const valido = (v, S) => {
    assert.equal(v.val.length, S.def.filas); assert.ok(v.val.every(f => f.length === S.def.cols));
    for (const k of Object.keys(v.est)) { const q = T.deLlave(k); assert.ok(q && q[0] < S.def.filas && q[1] < S.def.cols, `est ${k}`); assert.ok(T.ESTADOS.includes(v.est[k])); }
    for (const d of v.deps) assert.ok(d.length === 4 && d[0] < S.def.filas && d[2] < S.def.filas && d[1] < S.def.cols && d[3] < S.def.cols);
  };
  const plano = (J, v, cx) => { for (const en of [false, true]) for (const x of lect(J, v, cx, en)) { assert.ok(typeof x.expr === 'string' && x.expr, 'expr'); assert.ok(['string', 'number'].includes(typeof x.valor), 'valor plano'); } };
  const btn = (J, etiqueta) => J.botones.find(b => (typeof b.label === 'string' ? b.label : b.label.es) === etiqueta);

  prueba('jugar mochila: resolver celda a celda con la decisión correcta reproduce la tabla; los errores marcan mal y no escriben', () => {
    const J = pMoch.jugar, v = T.vista(SMoch), cx = T.ctx(SMoch), dp = D.tablaMochila();
    assert.equal(J.arrastrables, true); assert.ok(J.botones.length >= 3);
    plano(J, v, cx);
    // celda con una vecina vacía: «falta»
    J.soltar(v, 4, 7, cx); assert.ok(v.est['3,7'] === 'mal' && v.deps.length === 2);
    J.botones[1].hacer(v, cx); assert.equal(v.msg.k, 'falta'); assert.equal(T.leer(v, 4, 7), null); plano(J, v, cx);
    // decisión equivocada en 3,7: no coger vale 5 y coger 9
    J.soltar(v, 3, 7, cx); assert.equal(J.lecturas(v, cx).length >= 3, true);
    J.botones[0].hacer(v, cx); assert.equal(v.est['3,7'], 'mal'); assert.equal(T.leer(v, 3, 7), null); assert.equal(v.msg.k, 'mal'); plano(J, v, cx);
    J.soltar(v, 3, 2, cx); // no cabe el objeto 3 (peso 4): coger es erróneo
    J.botones[1].hacer(v, cx); assert.equal(v.msg.razon, 'nocabe'); assert.equal(T.leer(v, 3, 2), null);
    // resolver todas con la opción correcta
    for (let r = 3; r <= 4; r++) for (let c = 0; c <= 7; c++) {
      J.soltar(v, r, c, cx);
      const p = D.ITEMS[r - 1].p, no = dp[r - 1][c], si = c >= p ? dp[r - 1][c - p] + D.ITEMS[r - 1].v : -1;
      J.botones[si > no ? 1 : 0].hacer(v, cx);
      assert.equal(T.leer(v, r, c), dp[r][c], `dp[${r}][${c}]`); assert.equal(v.est[`${r},${c}`], 'hecha'); valido(v, SMoch); plano(J, v, cx);
    }
    assert.deepEqual(v.val, dp);
    assert.ok(btn(J, 'Rellenar el resto').off(v)); // ya está todo
    btn(J, 'Reiniciar').hacer(v, cx); assert.equal(T.leer(v, 3, 7), null); assert.equal(T.leer(v, 2, 7), dp[2][7]); assert.equal(v.est['2,7'], 'hecha'); valido(v, SMoch);
    btn(J, 'Rellenar el resto').hacer(v, cx); assert.deepEqual(v.val, dp); assert.ok(Object.values(v.est).every(e => e === 'hecha'));
    // no muta el estado de apertura
    assert.equal(SMoch.val[3][7], null);
    const S2 = T.conVista(SMoch, v); assert.deepEqual(S2.val, dp);
  });
  prueba('jugar capacidad: dp[n][W] y objetos de cada W coinciden con la fuerza bruta', () => {
    const J = pCap.jugar, v = T.vista(SCap), cx = T.ctx(SCap);
    for (let W = 0; W <= D.CAP; W++) {
      J.soltar(v, 0, W, cx); assert.equal(v.W, W);
      const lec = J.lecturas(v, cx); assert.equal(lec[1].valor, refMochila(D.ITEMS, W));
      const cam = D.caminoMochila(D.tablaMochila(), D.ITEMS, W); assert.ok(cam.peso <= W && cam.valor === refMochila(D.ITEMS, W));
      assert.equal(v.est[`${D.ITEMS.length},${W}`], 'camino'); assert.deepEqual(v.resaltar.cols, [W]); valido(v, SCap); plano(J, v, cx);
    }
    for (let i = 0; i < 12; i++) { for (const b of J.botones) if (!(b.off && b.off(v, cx))) b.hacer(v, cx); valido(v, SCap); plano(J, v, cx); }
    assert.ok(v.W >= 0 && v.W <= D.CAP);
    assert.equal(lect(J, T.vista(SCap), cx)[1].valor, 9); // arranca con W = 7
  });
  prueba('jugar LCS: ajustar el valor, comprobar (mal / bien) y resolver las filas 6 y 7', () => {
    const J = pLcs.jugar, v = T.vista(SLcs), cx = T.ctx(SLcs), dp = D.tablaLCS(D.A_LCS, D.B_LCS);
    plano(J, v, cx);
    for (let r = 6; r <= 7; r++) for (let c = 1; c <= 6; c++) {
      J.soltar(v, r, c, cx);
      const ok = dp[r][c];
      // un valor equivocado marca mal y no escribe
      v.g = ok === 0 ? 1 : 0; J.botones[2].hacer(v, cx);
      if (c === 1 && r === 6) assert.ok(v.msg.k === 'mal' || v.msg.k === 'falta');
      if (v.msg.k !== 'falta') { assert.equal(v.est[`${r},${c}`], 'mal'); assert.equal(T.leer(v, r, c), null); }
      J.soltar(v, r, c, cx);
      for (let k = 0; k < ok; k++) J.botones[1].hacer(v, cx);
      assert.equal(v.g, ok); J.botones[2].hacer(v, cx);
      assert.equal(T.leer(v, r, c), ok, `dp[${r}][${c}]`); assert.equal(v.est[`${r},${c}`], 'hecha'); valido(v, SLcs); plano(J, v, cx);
    }
    assert.deepEqual(v.val, dp);
    // los botones − y + respetan sus límites
    const w = T.vista(SLcs); J.soltar(w, 6, 1, cx); assert.ok(J.botones[0].off(w)); for (let k = 0; k < 12; k++) if (!J.botones[1].off(w)) J.botones[1].hacer(w, cx); assert.equal(w.g, 9); assert.ok(J.botones[1].off(w));
    // «falta»: una celda cuyas vecinas están vacías
    const u = T.vista(SLcs); J.soltar(u, 7, 6, cx); J.botones[2].hacer(u, cx); assert.equal(u.msg.k, 'falta'); assert.equal(T.leer(u, 7, 6), null);
    btn(J, 'Reiniciar').hacer(v, cx); assert.equal(T.leer(v, 7, 6), null); assert.equal(T.leer(v, 5, 6), dp[5][6]);
    btn(J, 'Rellenar el resto').hacer(v, cx); assert.deepEqual(v.val, dp);
    assert.equal(SLcs.val[7][6], null);
  });
  prueba('jugar monedas: el DP nunca pierde contra el voraz; {1,3,4} con T = 6 y 10 muestran la diferencia', () => {
    const J = pMon.jugar, v = T.vista(SMon), cx = T.ctx(SMon);
    assert.equal(J.botones.length, 5);
    for (let k = 0; k < 3; k++) {
      J.botones[k].hacer(v, cx);
      for (let t = 0; t < 13; t++) {
        J.soltar(v, 0, t, cx);
        const s = v.set, [dp, vz] = D.tablaMonedas(s, 12);
        assert.equal(dp[t], refMonedas(s, t)); assert.ok(vz[t] === null || vz[t] >= dp[t]);
        const lec = J.lecturas(v, cx), vor = lec.find(x => x.expr === 'voraz');
        assert.equal(vor.malo, vz[t] !== dp[t]); assert.equal(v.est[`1,${t}`] === 'mal', vz[t] !== dp[t]);
        assert.deepEqual(v.val, [dp, vz]); valido(v, SMon); plano(J, v, cx);
      }
    }
    J.botones[0].hacer(v, cx); J.soltar(v, 0, 6, cx); assert.deepEqual([...Object.keys(v.est)].filter(k => v.est[k] === 'mal'), ['1,6', '1,10']);
    assert.equal(J.lecturas(v, cx).find(x => x.expr === 'voraz').valor, 3); assert.equal(J.lecturas(v, cx).find(x => x.expr.startsWith('DP')).valor, 2);
    for (let i = 0; i < 20; i++) { for (const b of J.botones) if (!(b.off && b.off(v, cx))) b.hacer(v, cx); assert.ok(v.T >= 0 && v.T <= 12); valido(v, SMon); }
    assert.equal(lect(J, T.vista(SMon), cx)[1].valor, 6); // arranca con T = 6
  });

  console.log('Validador de datos');
  prueba('node tests/guias-datos.js dp termina sin errores', () => {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tests', 'guias-datos.js'), 'dp'], { encoding: 'utf8' });
    assert.match(out, /✓ dp/);
  });

  console.log(`\n✓ ${n} pruebas de programación dinámica`);
})().catch(e => { console.error('\n✗ ' + (e.stack || e)); process.exit(1); });
