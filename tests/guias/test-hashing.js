#!/usr/bin/env node
'use strict';
/**
 * Pruebas Node de la guía «Hashing y técnicas» (sin navegador):  node tests/guias/test-hashing.js   (código 0 = todo bien)
 * Cada generador de data/hashing-traza.js se contrasta con una referencia escrita aparte: la tabla hash con un Map de JS tras
 * secuencias aleatorias de inserciones y borrados (con rehash); las sumas prefijas con la suma directa; Union-Find con las
 * componentes por BFS; la probabilidad del cumpleaños con la fórmula exacta (BigInt) y con enumeración; Kruskal con fuerza bruta;
 * dos sumas y conjunto hash con recuentos directos. Los frames se pliegan en las escenas reales (celdas, barras, arbol) y se ejecutan
 * los botones de `jugar` (también en inglés). Al final se recorre la guía: límites de texto, líneas de código, preguntas, trazas.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
const imp = f => import(pathToFileURL(path.join(ROOT, f)).href);
let n = 0;
const prueba = (nombre, fn) => { fn(); n++; console.log('  ok  ' + nombre); };
const lcg = s => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const rnd = (r, a, b) => a + Math.floor(r() * (b - a + 1));
const ordenada = a => [...a].sort((x, y) => x - y);

(async () => {
  globalThis.matchMedia = () => ({ matches: false }); // escena.js lo lee al importar
  const E = await imp('assets/guias/escena.js'), B = await imp('assets/guias/barras.js'), A = await imp('assets/guias/arbol.js');
  const T = await imp('assets/guias/data/hashing-traza.js'), G = (await imp('assets/guias/data/hashing.js')).default;
  const MODS = { celdas: E, barras: B, arbol: A };
  const { TablaHash, estadoTabla, valTabla, tablaDe, aplica, CLAVES, UF } = T;

  // Estado de la escena en el paso k (como estadoEn de guia.js: la apertura de cada paso se plega una sola vez)
  const aperturas = new Map();
  const estadoEn = k => {
    let tipo = null, S = null;
    for (let i = 0; i <= k; i++) {
      const p = G.pasos[i], nuevo = Object.keys(MODS).find(c => p[c] !== undefined);
      if (nuevo) { if (!aperturas.has(p)) aperturas.set(p, MODS[nuevo].plegar(undefined, p)); tipo = nuevo; S = aperturas.get(p); }
      else if (tipo) S = MODS[tipo].plegar(S, p);
    }
    return { tipo, S };
  };
  const idx = pred => G.pasos.findIndex(pred);
  const celdasEstado = S => ({ vis: new Set(Object.keys(S.st)), val: S.val });
  const mismoEstado = (S, e, claves) => {
    for (const c of claves) {
      assert.equal(!!S.st[c], e.vis.has(c), `visible ${c}`);
      if (e.vis.has(c)) assert.equal(S.val[c], e.val[c], `valor ${c}`);
    }
  };
  const idsCeldas = ['n', 'm', ...Array.from({ length: 7 }, (_, i) => 'b' + i), ...CLAVES.map(k => 'k' + k)];
  const foldCeldas = (S, frames) => frames.reduce((s, f) => E.plegar(s, f), S);

  // ── 1. Tabla hash ───────────────────────────────────────────────────────────────────────────────────────────
  prueba('TablaHash == Map de JS tras secuencias aleatorias de insertar/borrar/buscar (con rehash)', () => {
    const r = lcg(7);
    for (let ronda = 0; ronda < 60; ronda++) {
      const t = new TablaHash(3), ref = new Set(); let rehashes = 0;
      for (let paso = 0; paso < 120; paso++) {
        const k = rnd(r, 0, 80), op = r();
        if (op < .55) {
          const m0 = t.m, res = t.insertar(k);
          assert.equal(res.nuevo, !ref.has(k)); ref.add(k);
          if (res.rehash) { rehashes++; assert.equal(t.m, 2 * m0 + 1); }
          assert.ok(t.n <= t.m, 'tras insertar, α ≤ 1');
        } else if (op < .8) assert.equal(t.borrar(k), ref.delete(k));
        else { const b = t.buscar(k); assert.equal(b.hallado, ref.has(k)); assert.equal(b.cubo, k % t.m); }
        assert.equal(t.n, ref.size);
        assert.deepEqual(ordenada([...t.claves()]), ordenada([...ref]));
        t.c.forEach((c, i) => c.forEach(x => assert.equal(x % t.m, i, 'clave en su cubo')));
      }
      assert.ok(rehashes >= 1 || ref.size < 4);
    }
  });
  prueba('insertar 12, 9, 7, 19 con m = 3: colisiones, α y rehash como dice la guía', () => {
    const t = new TablaHash(3), r = [12, 9, 7, 19].map(k => t.insertar(k));
    assert.deepEqual(r.map(x => x.colision), [false, true, false, true]);
    assert.deepEqual(r.map(x => x.rehash), [false, false, false, true]);
    assert.equal(t.m, 7); assert.equal(t.n, 4); assert.ok(Math.abs(t.alfa - 4 / 7) < 1e-12);
    assert.deepEqual(t.c[5], [19, 12], '12 y 19 comparten cubo tras el rehash');
    assert.equal(t.maxCadena(), 2);
  });
  const t3 = new TablaHash(3); [12, 9, 7].forEach(k => t3.insertar(k));
  prueba('trazaBuscar: resultado y comparaciones = modelo; el estado final del puntero es coherente', () => {
    for (const k of [12, 9, 7, 19, 5, 30]) {
      const t = t3.clone?.() ?? t3.clon(), ref = t.buscar(k), tr = T.trazaBuscar(t, k);
      assert.equal(tr.hallado, ref.hallado); assert.equal(tr.comparaciones, ref.comparaciones); assert.equal(tr.cubo, ref.cubo);
      assert.ok(tr.frames.length <= 100);
      let e = estadoTabla(t);
      for (const f of tr.frames) { e = aplica(e, f); for (const v of Object.values(e.val)) if (typeof v === 'string' && v.startsWith('→k')) assert.ok(e.vis.has(v.slice(1)), 'puntero a nodo visible'); }
      assert.equal(JSON.stringify(t.c), JSON.stringify(t3.c), 'la búsqueda no cambia la tabla');
    }
  });
  prueba('trazaBorrar: la escena final = estadoTabla de la tabla sin la clave', () => {
    for (const k of [12, 9, 7, 5]) {
      const tr = T.trazaBorrar(t3, k), ref = t3.clon(); const okb = ref.borrar(k);
      assert.equal(tr.borrado, okb); assert.deepEqual(tr.tabla.c, ref.c); assert.equal(tr.tabla.n, ref.n);
      const fin = tr.frames.reduce(aplica, estadoTabla(t3)), esp = estadoTabla(ref);
      for (const c of idsCeldas) { assert.equal(fin.vis.has(c), esp.vis.has(c), 'vis ' + c); if (esp.vis.has(c)) assert.equal(fin.val[c], esp.val[c], 'val ' + c); }
    }
  });
  prueba('trazaRehash: cada clave en el cubo k mod 2m+1, escena final = estadoTabla, un frame por paso ≤ 100', () => {
    const r = lcg(3);
    for (let i = 0; i < 20; i++) {
      const t = new TablaHash(3), ks = new Set();
      while (ks.size < 3) ks.add(CLAVES[rnd(r, 0, 6)]);
      [...ks].forEach(k => t.insertar(k));
      let extra; do extra = CLAVES[rnd(r, 0, 6)]; while (ks.has(extra));
      t.colocar(extra);                                 // n = 4 > m = 3
      const ref = t.clon(); ref.rehash(7);
      const tr = T.trazaRehash(t);
      assert.deepEqual(tr.tabla.c, ref.c); assert.equal(tr.tabla.m, 7);
      tr.tabla.c.forEach((c, j) => c.forEach(k => assert.equal(k % 7, j)));
      assert.ok(tr.frames.length <= 100);
      const fin = tr.frames.reduce(aplica, estadoTabla(t)), esp = estadoTabla(ref);
      for (const c of idsCeldas) { assert.equal(fin.vis.has(c), esp.vis.has(c), 'vis ' + c); if (esp.vis.has(c)) assert.equal(fin.val[c], esp.val[c], 'val ' + c); }
    }
  });
  prueba('valTabla / tablaDe: ida y vuelta con todas las claves', () => {
    const r = lcg(5);
    for (let i = 0; i < 40; i++) {
      const t = new TablaHash(3);
      for (const k of CLAVES.filter(() => r() < .7)) t.insertar(k);
      const v = valTabla(t), t2 = tablaDe(v);
      assert.deepEqual(t2.c, t.c); assert.equal(t2.m, t.m); assert.equal(t2.n, t.n);
      for (const [k, x] of Object.entries(v)) if (typeof x === 'string' && x.startsWith('→k')) assert.ok(k in v && x.slice(1) in v);
    }
  });
  prueba('jugar «tabla hash»: botones en orden aleatorio = modelo; rehash exacto al pasar α > 1; lecturas es/en', () => {
    const i = idx(p => p.jugar && p.celdas === undefined && p.val && 'b0' in p.val), p = G.pasos[i], J = p.jugar, { S } = estadoEn(i), cx = E.ctx(S);
    const r = lcg(11);
    for (const lang of ['es', 'en']) {
      globalThis.document = { documentElement: { lang } };
      for (let ronda = 0; ronda < 40; ronda++) {
        const v = E.vista(S), ref = new Map(); let ult = null, reh = 0;
        for (let paso = 0; paso < 14; paso++) {
          const b = J.botones[rnd(r, 0, J.botones.length - 1)];
          if (b.off && b.off(v, cx)) continue;
          const nombre = typeof b.label === 'string' ? b.label : b.label.es;
          if (nombre === 'Reiniciar') { b.hacer(v, cx); ref.clear(); reh = 0; ult = null; }
          else {
            const k = +/\((\d+)\)/.exec(nombre)[1], m0 = tablaDe(v).m, n0 = tablaDe(v).n;
            b.hacer(v, cx); ref.set(k, true); ult = k;
            const t = tablaDe(v); assert.equal(t.n, ref.size);
            const debio = n0 + 1 > m0; if (debio) reh++;
            assert.equal(t.m, debio ? 2 * m0 + 1 : m0, 'rehash cuando n > m');
            assert.ok(t.n <= t.m);
          }
          const t = tablaDe(v);
          assert.deepEqual(ordenada([...t.claves()]), ordenada([...ref.keys()]));
          t.c.forEach((c, j) => c.forEach(k => assert.equal(k % t.m, j)));
          const c = E.conVista(S, v), lec = J.lecturas(v, cx), h = J.hl(v, cx);
          for (const x of Object.keys(h)) assert.ok(x in cx.cel, 'hl: celda existente ' + x);
          for (const [id, x] of Object.entries(c.val)) if (typeof x === 'string' && x.startsWith('→k')) assert.ok(id in cx.cel && x.slice(1) in cx.cel);
          assert.equal(lec.length, 4); for (const x of lec) { assert.ok(String(x.expr).length && String(x.valor).length); }
          assert.ok(lec[0].valor.startsWith(`${t.n} / ${t.m} = ${t.alfa.toFixed(2)}`));
          assert.equal(lec[3].valor, reh);
          if (ult != null) assert.ok(String(lec[2].valor).startsWith(`${ult} mod `));
        }
      }
    }
    delete globalThis.document;
  });

  // ── 2. Distribución, cumpleaños, sondeo ──────────────────────────────────────────────────────────────────────
  prueba('histograma: los recuentos son los de contar k mod m; el cuadro final de la traza lo dice', () => {
    const claves = Array.from({ length: 16 }, (_, i) => 4 * (i + 1));
    for (const m of [8, 7]) {
      const h = T.trazaHistograma(m, claves), ref = Array(m).fill(0); claves.forEach(k => ref[k % m]++);
      assert.deepEqual(h.cuentas, ref);
      const S0 = B.plegar(undefined, { barras: { arr: Array(m).fill(0), max: 8, etiquetas: true } });
      const S = h.frames.reduce((s, f) => B.plegar(s, f), S0);
      assert.deepEqual(S.arr, ref); assert.ok(Math.max(...S.arr) <= 8);
      assert.equal(h.usados, ref.filter(x => x).length); assert.equal(h.mayor, Math.max(...ref));
      assert.ok(h.frames.length <= 100);
    }
    assert.deepEqual(T.trazaHistograma(8, claves).cuentas, [8, 0, 0, 0, 8, 0, 0, 0], 'm = 8 usa 2 cubos de 8');
    assert.ok(Math.max(...T.trazaHistograma(7, claves).cuentas) <= 3, 'm = 7 reparte (máx. 3)');
    assert.deepEqual(T.trazaHistograma(8, [8, 16, 24, 32, 40]).cuentas.filter(x => x), [5], 'múltiplos de 8: un solo cubo');
  });
  prueba('cumpleaños: pColision = fórmula exacta (BigInt) y = enumeración de todas las asignaciones', () => {
    // conocido: 23 personas, 365 días → 0,5072972343…
    assert.ok(T.pColisionExacta(365, 23).startsWith('0.50729723432398'));
    assert.ok(Math.abs(T.pColision(365, 23) - 0.5072972343239857) < 1e-13);
    for (const [m, nn] of [[365, 5], [365, 40], [1000, 38], [1000, 100], [1e6, 1178], [10007, 123], [2 ** 16, 300]]) {
      const ex = Number(T.pColisionExacta(m, nn, 15));
      assert.ok(Math.abs(T.pColision(m, nn) - ex) < 1e-12, `m=${m} n=${nn}: ${T.pColision(m, nn)} vs ${ex}`);
    }
    // enumeración: cuenta las m^n asignaciones con alguna colisión
    for (const [m, nn] of [[4, 3], [5, 3], [6, 4], [7, 3], [3, 4], [2, 2]]) {
      let con = 0; const total = m ** nn;
      for (let c = 0; c < total; c++) {
        const usados = new Set(); let x = c, dup = false;
        for (let i = 0; i < nn; i++) { const b = x % m; x = Math.floor(x / m); if (usados.has(b)) dup = true; usados.add(b); }
        if (dup) con++;
      }
      assert.ok(Math.abs(T.pColision(m, nn) - con / total) < 1e-12, `enumeración m=${m} n=${nn}`);
    }
    assert.equal(T.pColision(10, 11), 1); assert.equal(T.pColision(10, 1), 0); assert.equal(T.pColisionExacta(10, 11), '1');
    for (const m of [365, 1000]) { let ant = 0; for (let nn = 1; nn <= 120; nn++) { const p = T.pColision(m, nn); assert.ok(p >= ant); ant = p; } }
    assert.equal(T.nMediana(365), 23); assert.equal(T.nMediana(1e6), 1178);
    assert.ok(T.pColision(1e6, 1178) >= 0.5 && T.pColision(1e6, 1177) < 0.5, 'la pregunta de la guía: ~1 200 claves');
    for (const m of [365, 1000, 1e6]) { const nn = T.nDe(m, 1.25); assert.ok(Math.abs(T.pColision(m, nn) - T.pCumpleAprox(m, nn)) < 0.01, 'cota ≈ exacta'); }
    const b = T.barrasCumple(365); assert.equal(b.length, 8); assert.deepEqual(b, [...b].sort((x, y) => x - y)); assert.ok(b[7] >= 98 && b.every(x => x >= 0 && x <= 100));
    assert.ok(T.pColision(2 ** 32, T.nDe(2 ** 32, 1.25)) > 0.5);
  });
  prueba('sondeo lineal: igual que una tabla de direccionamiento abierto de referencia', () => {
    const ref = (m, ks) => { const a = Array(m).fill(null); for (const k of ks) { let i = k % m; while (a[i] !== null) i = (i + 1) % m; a[i] = k; } return a; };
    const r = lcg(2);
    for (let i = 0; i < 50; i++) {
      const ks = []; while (ks.length < rnd(r, 1, 6)) { const k = rnd(r, 0, 90); if (!ks.includes(k)) ks.push(k); }
      const tr = T.trazaSondeo(7, ks);
      assert.deepEqual(tr.ranuras, ref(7, ks));
      let e = { vis: new Set(), val: Object.fromEntries(Array.from({ length: 7 }, (_, j) => ['s' + j, '·'])) };
      e = tr.frames.reduce(aplica, e);
      tr.ranuras.forEach((x, j) => assert.equal(e.val['s' + j], x ?? '·'));
    }
    const g = T.trazaSondeo(7, [12, 19, 26]); assert.deepEqual(g.sondeos, [0, 1, 2]); assert.equal(g.ranuras[0], 26, '26 da la vuelta al principio');
  });

  // ── 3. Prefijas y diferencias ────────────────────────────────────────────────────────────────────────────────
  prueba('sumas prefijas: P[r+1] − P[l] = suma directa para todo l ≤ r; la traza llena el aux', () => {
    const r = lcg(9);
    for (let t = 0; t < 60; t++) {
      const a = Array.from({ length: rnd(r, 1, 12) }, () => rnd(r, 0, 9)), P = T.prefijas(a);
      assert.equal(P.length, a.length + 1); assert.equal(P[0], 0);
      for (let l = 0; l < a.length; l++) for (let h = l; h < a.length; h++) assert.equal(T.sumaRango(P, l, h), a.slice(l, h + 1).reduce((s, x) => s + x, 0));
      const tr = T.trazaPrefijas(a), S0 = B.plegar(undefined, { barras: { arr: a, aux: a.length + 1, max: Math.max(1, ...P), estilo: 'cajas' } });
      const S = tr.frames.reduce((s, f) => B.plegar(s, f), S0);
      assert.deepEqual(S.aux, P); assert.deepEqual(tr.P, P); assert.ok(tr.frames.length <= 100);
    }
    assert.deepEqual(T.prefijas(T.ARR_PREF), [0, 3, 4, 8, 9, 14, 23, 25, 31]);
    assert.equal(T.sumaRango(T.prefijas(T.ARR_PREF), 1, 3), 6); assert.equal(T.sumaRango(T.prefijas(T.ARR_PREF), 2, 5), 19);
  });
  prueba('diferencias: reconstruir con prefijas = aplicar cada actualización a mano', () => {
    const r = lcg(13);
    for (let t = 0; t < 60; t++) {
      const nn = rnd(r, 3, 8), ops = Array.from({ length: rnd(r, 1, 4) }, () => { const l = rnd(r, 0, nn - 1), h = rnd(r, l, nn - 1); return { l, r: h, x: rnd(r, 1, 9) }; });
      const tr = T.trazaDiferencias(nn, ops);
      assert.deepEqual(tr.a, T.aplicaDirecto(nn, ops)); assert.ok(tr.frames.length <= 100);
    }
    const tr = T.trazaDiferencias(8, [{ l: 2, r: 5, x: 5 }, { l: 4, r: 7, x: 3 }]);
    assert.deepEqual(tr.a, [0, 0, 5, 5, 8, 8, 3, 3]); assert.deepEqual(tr.d, [0, 0, 5, 0, 3, 0, -5, 0, -3]);
    // el parche del paso siguiente de la guía lleva exactamente esos valores
    const p = G.pasos[idx(q => q.val && 'd6' in q.val && q.val.d6 === -5)];
    for (let i = 0; i < 9; i++) if (('d' + i) in p.val) assert.equal(p.val['d' + i], tr.d[i]);
    for (let i = 0; i < 8; i++) assert.equal(p.val['a' + i], tr.a[i]);
    const S0 = E.plegar(undefined, { celdas: T.CELDAS_DIF, mostrar: [...Array.from({ length: 9 }, (_, i) => 'd' + i), ...Array.from({ length: 8 }, (_, i) => 'a' + i)], val: Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['d' + i, 0])) });
    const S = foldCeldas(S0, tr.frames);
    tr.d.forEach((x, i) => assert.equal(S.val['d' + i], x)); tr.a.forEach((x, i) => assert.equal(S.val['a' + i], x));
  });
  prueba('jugar «sumas prefijas»: l y r por botones y por arrastre; lecturas = suma directa', () => {
    const i = idx(p => p.jugar && p.jugar.arrastrables === true && p.marcas && p.marcas.l === 2), p = G.pasos[i], J = p.jugar, { S } = estadoEn(i), v = B.vista(S), cx = B.ctx(S);
    const r = lcg(21), P = T.prefijas(T.ARR_PREF);
    for (const lang of ['es', 'en']) {
      globalThis.document = { documentElement: { lang } };
      for (let k = 0; k < 200; k++) {
        if (r() < .3) { const a = rnd(r, 0, 7), b = rnd(r, 0, 7); if (a !== b) J.soltar(v, a, b, cx); }
        else { const b = J.botones[rnd(r, 0, J.botones.length - 1)]; if (!(b.off && b.off(v, cx))) b.hacer(v, cx); }
        const { l, r: h } = v.marcas;
        assert.ok(0 <= l && l <= h && h < 8);
        assert.deepEqual(v.rango, [l, h]);
        const dentro = Object.entries(v.est).filter(([, e]) => e === 'ok').map(([x]) => +x);
        assert.deepEqual(dentro, Array.from({ length: h - l + 1 }, (_, x) => l + x));
        const lec = J.lecturas(v, cx), s = P[h + 1] - P[l];
        assert.ok(lec[1].valor.endsWith('= ' + s)); assert.ok(lec[2].valor.endsWith('= ' + s));
        assert.equal(T.ARR_PREF.slice(l, h + 1).reduce((x, y) => x + y, 0), s);
        const c = B.conVista(S, v); assert.equal(c.arr.length, 8);
      }
    }
    delete globalThis.document;
  });
  prueba('jugar «cumpleaños»: m y c por botones; lecturas = fórmula exacta; las barras no se salen de max', () => {
    const i = idx(p => p.jugar && p.jugar.botones.some(b => b.label === 'c ◀')), p = G.pasos[i], J = p.jugar, { S } = estadoEn(i), v = B.vista(S), cx = B.ctx(S);
    const r = lcg(31);
    for (const lang of ['es', 'en']) {
      globalThis.document = { documentElement: { lang } };
      for (let k = 0; k < 120; k++) {
        const b = J.botones[rnd(r, 0, J.botones.length - 1)]; if (!(b.off && b.off(v, cx))) b.hacer(v, cx);
        const m = v.cont.m, ix = v.marcas.n, nn = T.nDe(m, T.FACTORES[ix]);
        assert.equal(v.cont.n, nn); assert.ok(ix >= 0 && ix < 8); assert.deepEqual(Object.keys(v.est), [String(ix)]);
        assert.deepEqual(v.arr, T.barrasCumple(m)); assert.ok(v.arr.every(x => x >= 0 && x <= cx.max));
        const p100 = T.pColision(m, nn); assert.ok(Math.abs(v.cont.p - 100 * p100) <= 0.051);
        const lec = J.lecturas(v, cx); assert.ok(lec[1].valor.startsWith((100 * p100).toFixed(2)));
        if (m <= 1e6) assert.ok(Math.abs(p100 - Number(T.pColisionExacta(m, nn, 15))) < 1e-12);
        const c = B.conVista(S, v); assert.equal(c.arr.length, 8);
        assert.deepEqual(ordenada(c.ord), [0, 1, 2, 3, 4, 5, 6, 7]);
      }
    }
    delete globalThis.document;
  });

  // ── 4. Union-Find ────────────────────────────────────────────────────────────────────────────────────────────
  const bfs = (nn, pares) => {
    const ady = Array.from({ length: nn }, () => []); for (const [a, b] of pares) { ady[a].push(b); ady[b].push(a); }
    const comp = Array(nn).fill(-1); let c = 0;
    for (let s = 0; s < nn; s++) if (comp[s] < 0) { comp[s] = c; const cola = [s]; while (cola.length) { const x = cola.shift(); for (const y of ady[x]) if (comp[y] < 0) { comp[y] = c; cola.push(y); } } c++; }
    return { comp, n: c };
  };
  const mismaParticion = (u, nn, pares) => {
    const { comp, n: nc } = bfs(nn, pares), r = u.raices();
    assert.equal(u.conjuntos(), nc);
    for (let i = 0; i < nn; i++) for (let j = 0; j < nn; j++) assert.equal(r[i] === r[j], comp[i] === comp[j], `${i} y ${j}`);
  };
  const padresDeS = S => { const p = Array.from({ length: T.NUF }, (_, i) => i); for (const e of S.aristas) p[+e.b.slice(1)] = +e.a.slice(1); return p; };
  prueba('Union-Find (ingenua y por tamaño, con y sin compresión) = componentes por BFS; altura ≤ log2 n por tamaño', () => {
    const r = lcg(17);
    for (let ronda = 0; ronda < 200; ronda++) {
      const nn = 8, tam = r() < .5, comp = r() < .5, u = new UF(nn), pares = [];
      for (let k = 0; k < rnd(r, 1, 14); k++) {
        const a = rnd(r, 0, nn - 1), b = rnd(r, 0, nn - 1); pares.push([a, b]);
        const ya = u.subir(a).raiz === u.subir(b).raiz, res = u.unir(a, b, tam);
        assert.equal(res.unido, !ya);
        if (comp) u.encontrar(rnd(r, 0, nn - 1));
        mismaParticion(u, nn, pares);
        if (tam) assert.ok(u.altura() <= Math.log2(nn), `altura ${u.altura()} ≤ log2 ${nn}`);
        for (let i = 0; i < nn; i++) if (u.p[i] === i) assert.equal(u.t[i], u.raices().filter(x => x === i).length, 'tamaño de la raíz');
      }
    }
    const ing = new UF(); for (let i = 0; i < 7; i++) ing.unir(i, i + 1, false); assert.equal(ing.altura(), 7); assert.equal(ing.subir(0).camino.length - 1, 7);
    const tam = new UF(); for (let i = 0; i < 7; i++) tam.unir(i, i + 1, true); assert.equal(tam.altura(), 1, 'la pregunta de la guía: estrella de altura 1');
    const sec = new UF(); for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [4, 6], [0, 4]]) sec.unir(a, b, true); assert.equal(sec.altura(), 3);
  });
  prueba('trazaUnir y trazaFind: pliegan en la escena arbol hasta el bosque que dicen; ≤ 100 frames; ids y aristas válidos', () => {
    const ident = new UF(), S0 = A.plegar(undefined, { arbol: T.abreBosque(ident.p) });
    const seqs = [[Array.from({ length: 7 }, (_, i) => [i, i + 1]), false], [[[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [4, 6], [0, 4]], true], [[[0, 1], [0, 1], [3, 2], [1, 3]], true], [[[0, 1], [2, 1], [5, 6]], false]];
    for (const [pares, tam] of seqs) {
      const tr = T.trazaUnir(ident, pares, tam), ref = new UF(); pares.forEach(([a, b]) => ref.unir(a, b, tam));
      assert.deepEqual(tr.uf.p, ref.p); assert.ok(tr.frames.length <= 100);
      let S = S0;
      for (const f of tr.frames) {
        S = A.plegar(S, f);
        const hijos = S.aristas.map(e => e.b); assert.equal(new Set(hijos).size, hijos.length, 'un solo padre');
      }
      assert.deepEqual(padresDeS(S), ref.p);
      if (tam) for (let i = 0; i < 8; i++) if (ref.p[i] === i && ref.t[i] > 1) assert.equal(S.etiquetas[T.idU(i)], `t=${ref.t[i]}`);
    }
    // find con compresión: el camino acaba apuntando a la raíz y el resto del bosque no cambia
    const cad = T.trazaUnir(ident, Array.from({ length: 7 }, (_, i) => [i, i + 1]), false).uf;
    for (const x of [0, 3, 7]) {
      const fr = T.trazaFind(cad, x), u = cad.clon(), { camino } = u.subir(x); u.encontrar(x);
      assert.deepEqual(fr.uf.p, u.p); assert.ok(fr.frames.length <= 100); assert.equal(fr.saltos, camino.length - 1);
      let S = A.plegar(undefined, { arbol: T.abreBosque(cad.p) }); for (const f of fr.frames) S = A.plegar(S, f);
      assert.deepEqual(padresDeS(S), u.p); for (const y of camino) assert.equal(u.p[y], camino.at(-1));
    }
    assert.equal(T.trazaFind(cad, 0).saltos, 7);
    // parcheHacia: de cualquier bosque a otro
    const r = lcg(41);
    for (let k = 0; k < 40; k++) {
      const u0 = new UF(), u1 = new UF(); for (let j = 0; j < 6; j++) { u0.unir(rnd(r, 0, 7), rnd(r, 0, 7), r() < .5); u1.unir(rnd(r, 0, 7), rnd(r, 0, 7), r() < .5); }
      const S = A.plegar(A.plegar(undefined, { arbol: T.abreBosque(u0.p) }), T.parcheHacia(u0, u1, true));
      assert.deepEqual(padresDeS(S), u1.p);
    }
  });
  prueba('nodoEn: soltar un nodo sobre otro lo encuentra (geometría replicada de arbol.js) y lejos devuelve −1', () => {
    for (const p of [new UF().p, T.trazaUnir(new UF(), [[0, 1], [2, 3], [0, 2]], true).uf.p]) {
      const pos = A.disenar(T.nodosUF(), T.aristasUF(p), 'arbol', { r: T.UF_RADIO, W: T.UF_MEDIDA.W, H: T.UF_MEDIDA.H });
      for (let i = 0; i < 8; i++) {
        assert.equal(T.nodoEn(p, pos['n' + i].x + 5, pos['n' + i].y - 4, (i + 1) % 8), i);
        assert.notEqual(T.nodoEn(p, pos['n' + i].x, pos['n' + i].y, i), i, 'se excluye a sí mismo');
      }
      assert.equal(T.nodoEn(p, -500, -500), -1);
      for (const q of Object.values(pos)) assert.ok(q.x >= 0 && q.x <= T.UF_MEDIDA.W && q.y >= 0 && q.y <= T.UF_MEDIDA.H, 'dentro del lienzo');
    }
    // el peor bosque (una lista de 8 niveles) cabe en la cabida declarada
    const lista = T.trazaUnir(new UF(), Array.from({ length: 7 }, (_, i) => [i, i + 1]), false).uf;
    const m = A.medida(T.nodosUF(), T.aristasUF(lista.p), { r: T.UF_RADIO });
    assert.ok(m.niveles <= T.UF_CAB.niveles && m.hojas <= T.UF_CAB.hojas);
  });
  prueba('jugar «Union-Find»: botones y soltar nodos = BFS; compresión conserva la partición; Reiniciar; método ingenua/tamaño', () => {
    const i = idx(p => p.jugar && p.jugar.arrastrables === true && p.arbol), p = G.pasos[i], J = p.jugar, { S } = estadoEn(i), cx = A.ctx(S), r = lcg(51);
    for (const lang of ['es', 'en']) {
      globalThis.document = { documentElement: { lang } };
      for (let ronda = 0; ronda < 60; ronda++) {
        const v = A.vista(S); cx.arbol.aristas.length = 0; delete v.metodo; delete v._u;
        let pares = [];
        for (let paso = 0; paso < 12; paso++) {
          const q = r();
          if (q < .25) {
            const a = rnd(r, 0, 7), pos = A.disenar(T.nodosUF(), S.aristas.length ? T.aristasUF(padresDeS(S)) : [], 'arbol', { r: T.UF_RADIO, W: T.UF_MEDIDA.W, H: T.UF_MEDIDA.H }), b = rnd(r, 0, 7);
            if (a !== b) { J.soltar(v, 'n' + a, pos['n' + b].x + 3, pos['n' + b].y + 2, cx); pares.push([a, b]); }
          } else {
            const bt = J.botones[rnd(r, 0, J.botones.length - 1)], nombre = typeof bt.label === 'string' ? bt.label : bt.label.es;
            const m = /^unir\((\d), (\d)\)$/.exec(nombre);
            bt.hacer(v, cx);
            if (m) pares.push([+m[1], +m[2]]);
            if (nombre === 'Reiniciar') { pares = []; assert.equal(cx.arbol.aristas.length, 0); }
          }
          const pd = padresDeS(S); assert.equal(new Set(S.aristas.map(e => e.b)).size, S.aristas.length);
          const u = new UF(); u.p = pd; mismaParticion(u, 8, pares);
          const lec = J.lecturas(v, cx); assert.equal(lec.length, 4); assert.equal(lec[0].valor, bfs(8, pares).n); assert.equal(lec[1].valor, u.altura());
          for (const x of lec) assert.ok(String(x.expr).length && String(x.valor).length);
          const c = A.conVista(S, v); for (const id of Object.keys(c.etiquetas)) assert.ok(c.nodos.some(nn => nn.id === id));
          for (const id of Object.keys(c.est)) assert.ok(c.nodos.some(nn => nn.id === id));
        }
      }
    }
    delete globalThis.document;
    // con unión por tamaño la lista no aparece; con la ingenua sí (mismos botones)
    const v = A.vista(S); cx.arbol.aristas.length = 0;
    const un = J.botones.filter(b => typeof b.label === 'string' && b.label.startsWith('unir'));
    const cambia = J.botones.find(b => b.label.es === 'cambiar método');
    cambia.hacer(v, cx); assert.equal(v.metodo, 'ing');
    for (const b of un.slice(0, 3)) b.hacer(v, cx);
    assert.equal(new UF().constructor === UF && (() => { const u = new UF(); u.p = padresDeS(S); return u.altura(); })(), 3, 'ingenua: cadena 0→1→2→3');
    cx.arbol.aristas.length = 0; cambia.hacer(v, cx); assert.equal(v.metodo, 'tam');
    for (const b of un.slice(0, 3)) b.hacer(v, cx);
    const u = new UF(); u.p = padresDeS(S); assert.equal(u.altura(), 1);
  });

  // ── 5. Kruskal, conjunto hash, dos sumas ─────────────────────────────────────────────────────────────────────
  prueba('Kruskal: peso = fuerza bruta, n − 1 aristas que conectan, aristas descartadas = las que cierran ciclo', () => {
    const k = T.trazaKruskal(T.G_NODOS, T.G_ARISTAS);
    assert.equal(k.peso, T.mstFuerzaBruta(T.G_NODOS, T.G_ARISTAS)); assert.equal(k.peso, 13);
    assert.equal(k.mst.length, 5); assert.equal(k.conjuntos, 1); assert.ok(k.frames.length <= 100);
    assert.equal(T.componentesUF(T.G_NODOS, k.mst).length, 1);
    const r = lcg(61);
    for (let t = 0; t < 30; t++) {
      const nodos = 'abcdef'.split(''), as = [];
      for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) if (r() < .45) as.push([nodos[i], nodos[j], rnd(r, 1, 9)]);
      if (as.length > 14) as.length = 14;
      const comps = T.componentesUF(nodos, as), kr = T.trazaKruskal(nodos, as);
      assert.equal(kr.conjuntos, comps.length);
      assert.equal(kr.mst.length, 6 - comps.length);
      if (comps.length === 1) assert.equal(kr.peso, T.mstFuerzaBruta(nodos, as));
      assert.equal(T.componentesUF(nodos, kr.mst).length, comps.length);
    }
    const g2 = T.G_ARISTAS.filter(e => !(e[0] === 'c' && e[1] === 'd') && !(e[0] === 'b' && e[1] === 'd'));
    assert.deepEqual(T.componentesUF(T.G_NODOS, g2).map(c => c.sort().join('')).sort(), ['abc', 'def']);
    // los frames pliegan en la escena sin tocar nodos ni aristas inexistentes
    const abre = { modo: 'libre', nodos: T.nodosG(), aristas: T.G_ARISTAS.map(T.aristaG), lienzo: { W: 560, H: 300 } };
    let S = A.plegar(undefined, { arbol: abre }); for (const f of k.frames) S = A.plegar(S, f);
    assert.equal(Object.values(S.aristaEst).filter(x => x === 'camino').length, 5);
    assert.ok(Object.values(S.etiquetas).every(x => x === 'r=' + Object.values(S.etiquetas)[0].slice(2)), 'una sola raíz al final');
  });
  prueba('conjunto hash y dos sumas: resultados = recuento directo y fuerza bruta; las trazas pliegan en barras', () => {
    const r = lcg(71);
    for (let t = 0; t < 80; t++) {
      const v = Array.from({ length: rnd(r, 1, 8) }, () => rnd(r, 1, 5)), d = T.trazaDistintos(v), max = Math.max(...v);
      assert.equal(d.distintos, new Set(v).size); assert.ok(d.frames.length <= 100);
      const S = d.frames.reduce((s, f) => B.plegar(s, f), B.plegar(undefined, { barras: { arr: v, aux: v.length, max, estilo: 'cajas' }, cont: { distintos: 0 } }));
      assert.equal(S.cont.distintos, new Set(v).size); assert.deepEqual(S.aux.filter(x => x != null), [...new Set(v)]);
      const w = Array.from({ length: rnd(r, 1, 7) }, () => rnd(r, 1, 9)), obj = rnd(r, 2, 16), ds = T.trazaDosSumas(w, obj);
      let hay = false; for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) if (w[i] + w[j] === obj) hay = true;
      assert.equal(!!ds.par, hay);
      if (ds.par) { const [a, b] = ds.par; assert.ok(a < b && w[a] + w[b] === obj); }
      assert.ok(ds.frames.length <= 100);
      B.plegar(B.plegar(undefined, { barras: { arr: w, aux: w.length, max: 9, estilo: 'cajas' } }), ds.frames.reduce((acc, f) => ({ ...acc, ...f }), {}));
      ds.frames.reduce((s, f) => B.plegar(s, f), B.plegar(undefined, { barras: { arr: w, aux: w.length, max: 9, estilo: 'cajas' } }));
    }
    assert.deepEqual(T.trazaDosSumas([4, 9, 2, 7, 5], 12).par, [3, 4]); assert.equal(T.trazaDistintos([3, 1, 3, 2, 1, 3, 4]).distintos, 4);
  });
  prueba('el desbordo de la guía: con int la tercera suma pasa de 2³¹ − 1', () => {
    let s = 0, primera = -1;
    for (let i = 1; i <= 5; i++) { s += 1e9; if (s > 2 ** 31 - 1 && primera < 0) primera = i; }
    assert.equal(primera, 3);
    assert.ok(1e5 * 1e9 <= Number.MAX_SAFE_INTEGER && 1e5 * 1e9 === 1e14);
  });

  // ── La guía entera ───────────────────────────────────────────────────────────────────────────────────────────
  prueba('estados de la escena de la tabla en cada paso = tablas esperadas (parches y restauraciones)', () => {
    const i0 = 0, t0 = new TablaHash(3), t1 = t0.clon(); t1.insertar(12); const t2 = t1.clon(); t2.insertar(9); const t3 = t2.clon(); t3.insertar(7);
    const t4 = t3.clon(); t4.colocar(19); const t5 = t4.clon(); t5.rehash(7);
    const esperadas = [t0, t1, t2, t3, t3, t3, t3, t3, t4, t4, t5, t5];
    esperadas.forEach((t, k) => { const { tipo, S } = estadoEn(i0 + k); assert.equal(tipo, 'celdas'); mismoEstado(S, estadoTabla(t), idsCeldas); });
    // lo que deja cada traza es lo que el paso siguiente restaura
    const traRehash = G.pasos[9].traza, { S: S9 } = estadoEn(9), fin = foldCeldas(S9, traRehash);
    mismoEstado(fin, estadoTabla(t5), idsCeldas);
  });
  prueba('el bosque en cada paso de Union-Find y lo que deja cada traza', () => {
    const ident = new UF(), cad = T.trazaUnir(ident, Array.from({ length: 7 }, (_, i) => [i, i + 1]), false), comp = T.trazaFind(cad.uf, 0), tam = T.trazaUnir(ident, [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [4, 6], [0, 4]], true);
    const i = idx(p => p.sec?.es === 'Union-Find: conjuntos disjuntos');
    const esperados = [ident, ident, cad.uf, cad.uf, cad.uf, comp.uf, ident, tam.uf, tam.uf];
    esperados.forEach((u, k) => assert.deepEqual(padresDeS(estadoEn(i + k).S), u.p, `paso ${i + k + 1}`));
    for (const [k, u] of [[1, cad.uf], [4, comp.uf], [6, tam.uf]]) {
      const fin = G.pasos[i + k].traza.reduce((s, f) => A.plegar(s, f), estadoEn(i + k).S);
      assert.deepEqual(padresDeS(fin), u.p, `traza del paso ${i + k + 1}`);
    }
  });
  prueba('guía: 42–52 pasos, 6–7 secciones, ≥ 4 preguntas, ≥ 4 interactivos, ≥ 8 trazas ≤ ~100 frames, textos ≤ 420, código de es/en igual', () => {
    const P = G.pasos;
    assert.ok(P.length >= 42 && P.length <= 52, `${P.length} pasos`);
    const secs = P.filter(p => p.sec); assert.ok(secs.length >= 6 && secs.length <= 7); assert.ok(P[0].sec);
    assert.ok(P.filter(p => p.pregunta).length >= 4); assert.ok(P.filter(p => p.jugar).length >= 4); assert.ok(P.filter(p => p.traza).length >= 8);
    for (const p of P.filter(p => p.traza)) assert.ok(p.traza.length <= 100, `traza de ${p.traza.length} frames`);
    P.forEach((p, i) => {
      for (const l of ['es', 'en']) {
        const t = p[l]; assert.ok(typeof t === 'string' && t.trim() && t.length <= 420, `paso ${i + 1} ${l}: ${t?.length}`);
        assert.equal((t.match(/`/g) || []).length % 2, 0, `paso ${i + 1} ${l}: backticks`); assert.equal((t.match(/\$/g) || []).length % 2, 0, `paso ${i + 1} ${l}: $`);
        assert.ok(!/\*/.test(t.replace(/\*\*[^*]+\*\*/g, '').replace(/`[^`]*`/g, '').replace(/\$[^$]*\$/g, '')), `paso ${i + 1} ${l}: asterisco suelto`);
        assert.ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(t) && !t.replace(/!=/g, '').includes('!'), `paso ${i + 1} ${l}: emojis o exclamaciones`);
        for (const f of p.traza || []) {
          assert.ok(typeof f[l] === 'string' && f[l].length > 0 && f[l].length <= 220, `paso ${i + 1} frame ${l}: «${f[l]}»`);
          assert.ok(!f[l].replace(/!=/g, '').includes('!') && !/undefined|NaN|\[object/.test(f[l]), `frame ${f[l]}`);
        }
        if (p.pregunta) for (const o of p.pregunta.opc) assert.ok(!/\$/.test(o[l]), `paso ${i + 1}: opciones sin KaTeX`);
      }
      if (p.code !== undefined && typeof p.code === 'object') assert.equal(p.code.es.split('\n').length, p.code.en.split('\n').length);
      const cs = typeof p.code === 'object' ? p.code.es : p.code; if (cs) assert.ok(cs.split('\n').length <= 14, `paso ${i + 1}: listado de ${cs.split('\n').length} líneas`);
      if (p.leyenda) for (const x of p.leyenda) assert.ok(['activo', 'compara', 'hecho', 'mal', 'camino', 'aux'].includes(x));
    });
    for (const p of secs) assert.ok(p.sec.es && p.sec.en);
    assert.ok(G.fuentes.length >= 4 && G.fuentes.length <= 6); for (const f of G.fuentes) assert.ok(f.length > 0 && f.length <= 600);
    assert.equal(G.titulo.es, 'Hashing y técnicas'); assert.equal(G.titulo.en, 'Hashing and techniques');
    // las líneas del listado en vigor existen en cada paso con `line`
    let code = '';
    P.forEach((p, i) => {
      if (p.code !== undefined) code = typeof p.code === 'object' ? p.code.es : p.code;
      const nl = code.split('\n').length;
      if (typeof p.line === 'number') assert.ok(p.line >= 1 && p.line <= nl, `paso ${i + 1}: line ${p.line} de ${nl}`);
      for (const f of p.traza || []) if (typeof f.line === 'number') assert.ok(f.line >= 1 && f.line <= nl, `paso ${i + 1} frame: line ${f.line} de ${nl}`);
    });
  });
  prueba('las fuentes son cadenas APA con URL/DOI https y sin «undefined»', () => {
    for (const f of G.fuentes) { assert.ok(/\(\d{4}\)|\(s\. f\.\)/.test(f), f); assert.ok(!/undefined/.test(f)); }
    assert.ok(G.fuentes.some(f => f.includes('10.1145/321879.321884')) && G.fuentes.some(f => f.includes('10.1016/0022-0000(79)90044-8')));
  });

  console.log(`\n✓ ${n} pruebas de hashing`);
})().catch(e => { console.error('\n✗ ' + (e.stack || e)); process.exit(1); });
