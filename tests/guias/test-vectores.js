#!/usr/bin/env node
'use strict';
/** Lógica pura de assets/guias/vectores.js (sin DOM): node tests/guias/test-vectores.js */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
let n = 0;
const ok = (nombre, fn) => { try { fn(); n++; } catch (e) { console.error(`✗ ${nombre}: ${e.message}`); process.exitCode = 1; } };

(async () => {
  const V = await import(pathToFileURL(path.join(__dirname, '../../assets/guias/vectores.js')).href);
  const c = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

  ok('clave', () => assert.strictEqual(V.clave, 'vectores'));
  ok('num y vecDe: valores, parámetros y nombres', () => {
    assert.strictEqual(V.num('a', { a: 3 }), 3); assert.strictEqual(V.num(2, {}), 2);
    assert.deepStrictEqual(V.vecDe('u', { u: [1, 2] }, {}), [1, 2]);
    assert.deepStrictEqual(V.vecDe(['a', 4], {}, { a: -1 }), [-1, 4]);
    assert.ok(V.vecDe('nada', {}, {}).every(Number.isNaN));
  });
  ok('det: signo según orientación', () => { assert.strictEqual(V.det([1, 0], [0, 1]), 1); assert.strictEqual(V.det([0, 1], [1, 0]), -1); assert.strictEqual(V.det([2, 4], [1, 2]), 0); });
  ok('comb: combinación lineal', () => assert.deepStrictEqual(V.comb([2, -1], [[1, 0], [1, 3]]), [1, -3]));
  ok('dim: punto, recta, plano', () => {
    assert.strictEqual(V.dim([[0, 0]]), 0); assert.strictEqual(V.dim([]), 0);
    assert.strictEqual(V.dim([[1, 2], [-2, -4], [0, 0]]), 1);
    assert.strictEqual(V.dim([[1, 2], [3, 1]]), 2);
    assert.strictEqual(V.dim([[1e-3, 0], [0, 1e-3]]), 2); // escala pequeña pero independientes
  });
  ok('resolver: única, ninguna, infinitas', () => {
    const r = V.resolver(1, 1, 3, 1, -1, 1); assert.strictEqual(r.tipo, 'unica'); c(r.x, 2); c(r.y, 1);
    assert.strictEqual(V.resolver(1, 2, 3, 2, 4, 7).tipo, 'ninguna');
    assert.strictEqual(V.resolver(1, 2, 3, 2, 4, 6).tipo, 'infinitas');
    assert.strictEqual(V.resolver(0, 0, 0, 1, 1, 2).tipo, 'infinitas');
    assert.strictEqual(V.resolver(0, 0, 1, 1, 1, 2).tipo, 'ninguna');
  });
  ok('ajustar a rejilla', () => { assert.strictEqual(V.ajustar(1.26, .5), 1.5); assert.strictEqual(V.ajustar(-0.74, .25), -0.75); assert.strictEqual(V.ajustar(1.2345, 0), 1.23); });
  ok('ventanaEf: misma escala y contiene la región', () => {
    const [x0, x1, y0, y1] = V.ventanaEf({ x: [-4, 4], y: [-1, 1] }, 560, 360);
    c((x1 - x0) / 560, (y1 - y0) / 360); assert.ok(x0 <= -4 && x1 >= 4 && y0 <= -1 && y1 >= 1); c(x0 + x1, 0); c(y0 + y1, 0);
  });
  ok('segRecta: puntos sobre la recta, vertical y degenerada', () => {
    const w = [-5, 5, -5, 5], s = V.segRecta(1, 2, 3, w);
    c(s[0] + 2 * s[1], 3); c(s[2] + 2 * s[3], 3);
    const v = V.segRecta(2, 0, 4, w); c(v[0], 2); c(v[2], 2);
    assert.strictEqual(V.segRecta(0, 0, 1, w), null);
  });
  ok('rotulo en negrita', () => { assert.strictEqual(V.rotulo('u'), '$\\boldsymbol{u}$'); assert.strictEqual(V.rotulo('b12'), '$\\boldsymbol{b}_{12}$'); });
  ok('mezclaI: de identidad a M', () => {
    const M = [[2, 1], [0, 3]]; assert.deepStrictEqual(V.mezclaI(M, 0), [[1, 0], [0, 1]]); assert.deepStrictEqual(V.mezclaI(M, 1), M);
  });
  ok('nombresEn: recoge parámetros de capas anidadas', () => {
    const s = new Set(V.nombresEn([{ tipo: 'rejilla', m: [['a', 1], [0, 'd']] }, { tipo: 'comb', coef: ['k', 2], vecs: ['u', 'v'], nombre: 'x' }]));
    for (const k of ['a', 'd', 'k']) assert.ok(s.has(k)); assert.ok(!s.has('rejilla') && !s.has('x'));
  });
  ok('plegar: abrir, parches acumulativos y pureza', () => {
    const g = { x: [-3, 3], y: [-3, 3], vec: { u: [1, 0], v: [0, 1] }, par: { a: 1 }, capas: [] };
    const s0 = V.plegar({}, { vectores: g });
    assert.deepStrictEqual(s0.vec, { u: [1, 0], v: [0, 1] }); assert.strictEqual(s0.def.color.u !== s0.def.color.v, true);
    const s1 = V.plegar(s0, { vec: { u: [2, 2], z: [9, 9] }, par: { a: 3 } });
    assert.deepStrictEqual(s1.vec.u, [2, 2]); assert.ok(!('z' in s1.vec)); assert.strictEqual(s1.par.a, 3);
    assert.deepStrictEqual(s0.vec.u, [1, 0]); assert.strictEqual(s0.par.a, 1); // s0 intacto
    assert.strictEqual(V.plegar(s1, {}).def, s0.def);
    g.vec.u[0] = 99; assert.strictEqual(s0.vec.u[0], 1); // copia de los datos de la guía
  });
  ok('vista/conVista: ida y vuelta sin compartir arrays', () => {
    const s = V.plegar({}, { vectores: { vec: { u: [1, 2] }, par: { a: 1 } } }), v = V.vista(s);
    v.vec.u[0] = 5; v.a = 2; assert.strictEqual(s.vec.u[0], 1);
    const t = V.conVista(s, v); assert.deepStrictEqual(t.vec.u, [5, 2]); assert.strictEqual(t.par.a, 2);
  });
  ok('ctx: helpers', () => {
    const cx = V.ctx(V.plegar({}, { vectores: { vec: {} } }));
    assert.strictEqual(cx.det([1, 2], [3, 4]), -2); assert.strictEqual(cx.resolver(1, 0, 1, 0, 1, 2).y, 2); assert.strictEqual(cx.fmt(1e-12), '0');
  });
  // ── elipse / propios (cap. 4) ──
  const esPropio = (m, v, l) => { const w = V.mul(m, v); c(w[0], l * v[0], 1e-9); c(w[1], l * v[1], 1e-9); c(Math.hypot(...v), 1, 1e-12); };
  ok('eig2: distintos, simétrica, negativa', () => {
    const m = [[2, 1], [1, 2]], E = V.eig2(m); assert.ok(E.reales && !E.doble); c(E.l1, 3); c(E.l2, 1); esPropio(m, E.v1, 3); esPropio(m, E.v2, 1);
    c(E.v1[0] * E.v2[0] + E.v1[1] * E.v2[1], 0); // simétrica → ortogonales
    const n = [[1, 2], [0, -3]], F = V.eig2(n); c(F.l1, 1); c(F.l2, -3); esPropio(n, F.v1, 1); esPropio(n, F.v2, -3);
    c(F.l1 + F.l2, V.traza(n)); c(F.l1 * F.l2, V.detM(n));
  });
  ok('eig2: complejos, defectuosa, λI, diagonal', () => {
    const R = V.eig2([[0, -1], [1, 0]]); assert.strictEqual(R.reales, false); c(R.re, 0); c(R.im, 1);
    const S = V.eig2([[2, 1], [0, 2]]); assert.ok(S.doble && S.defectuosa && S.v2 === null); esPropio([[2, 1], [0, 2]], S.v1, 2);
    const I = V.eig2([[3, 0], [0, 3]]); assert.ok(I.doble && !I.defectuosa); assert.deepStrictEqual(I.v2, [0, 1]);
    const D = V.eig2([[4, 0], [0, -1]]); esPropio([[4, 0], [0, -1]], D.v1, 4); esPropio([[4, 0], [0, -1]], D.v2, -1);
  });
  ok('svd2: reconstruye A = Σ σᵢ uᵢ vᵢᵀ, ortonormal, σ1 ≥ σ2 ≥ 0', () => {
    for (const m of [[[3, 0], [4, 5]], [[1, 2], [2, 4]], [[0, -1], [1, 0]], [[2, 0], [0, -3]], [[0, 0], [0, 0]], [[1e-3, 2], [0, 1e-3]]]) {
      const S = V.svd2(m); assert.ok(S.s1 >= S.s2 - 1e-12 && S.s2 >= 0);
      for (const [i, j] of [[0, 0], [0, 1], [1, 0], [1, 1]]) c(S.s1 * S.u1[i] * S.v1[j] + S.s2 * S.u2[i] * S.v2[j], m[i][j], 1e-9);
      c(S.u1[0] * S.u2[0] + S.u1[1] * S.u2[1], 0, 1e-9); c(S.v1[0] * S.v2[0] + S.v1[1] * S.v2[1], 0, 1e-12);
      c(S.s1 * S.s2, Math.abs(V.detM(m)), 1e-9);
    }
    const S = V.svd2([[3, 0], [4, 5]]); c(S.s1, 3 * Math.sqrt(5)); c(S.s2, Math.sqrt(5));
  });
  // ── proyeccion / bola (MML §3.1–3.8) ──
  ok('dot, defPos, norma: producto escalar, ⟨·,·⟩_A y ℓ1/ℓ2/ℓ∞/A', () => {
    const A = [[2, 0], [0, 1]];
    assert.strictEqual(V.dot([1, 1], [-1, 1]), 0); assert.strictEqual(V.dot([1, 1], [-1, 1], A), -1); // ec. 3.27: ⊥ con ·, no con A
    assert.ok(V.defPos(A) && V.defPos(undefined) && !V.defPos([[9, 6], [6, 3]]) && V.defPos([[9, 6], [6, 5]]) && !V.defPos([[1, 2], [0, 1]]));
    c(V.norma([3, -4], 1), 7); c(V.norma([3, -4]), 5); c(V.norma([3, -4], 'inf'), 4);
    c(V.norma([1, 1], [[1, -.5], [-.5, 1]]), 1); // MML ej. 3.5: ‖x‖ = 1 con ese producto interno
  });
  ok('angulo: 18° del ej. 3.6, 109,5° con A del ej. 3.7, NaN con el nulo', () => {
    c(Math.cos(V.angulo([1, 1], [1, 2])), 3 / Math.sqrt(10)); c(Math.cos(V.angulo([1, 1], [-1, 1], [[2, 0], [0, 1]])), -1 / 3);
    assert.ok(Number.isNaN(V.angulo([0, 0], [1, 0])));
  });
  ok('proyectar: recta, ⟨·,·⟩_A, plano entero, nulo; idempotente y error ⊥ b', () => {
    const r = V.proyectar([1, 3], [[2, 0]]); assert.strictEqual(r.d, 1); c(r.p[0], 1); c(r.p[1], 0); c(r.l[0], .5);
    const x = [2, 1], b = [1, 2], q = V.proyectar(x, [b]).p; c(V.dot([x[0] - q[0], x[1] - q[1]], b), 0);
    const qq = V.proyectar(q, [b]).p; c(qq[0], q[0]); c(qq[1], q[1]); // P² = P
    const A = [[2, 1], [1, 3]], qa = V.proyectar(x, [b], A).p; c(V.dot([x[0] - qa[0], x[1] - qa[1]], b, A), 0);
    assert.deepStrictEqual(V.proyectar(x, [[1, 0], [0, 1]]).p, x); assert.strictEqual(V.proyectar(x, [[0, 0]]).d, 0);
    assert.strictEqual(V.proyectar(x, [[1, 1], [2, 2]]).d, 1);
  });
  ok('contornoBola: puntos con norma r; A no DP → null', () => {
    for (const p of [1, 2, 3, .5]) for (const q of V.contornoBola(p, 2)) c(V.norma(q, p), 2, 1e-6);
    for (const q of V.contornoBola('inf', 1.5)) c(V.norma(q, 'inf'), 1.5);
    const A = [[2, 1], [1, 3]]; for (const q of V.contornoBola(0, 1, A)) c(V.norma(q, A), 1, 1e-9);
    assert.strictEqual(V.contornoBola(0, 1, [[1, 2], [2, 1]]), null); assert.strictEqual(V.contornoBola(-1, 1), null);
  });
  console.log(`${process.exitCode ? '✗' : '✓'} vectores: ${n} pruebas correctas`);
})();
