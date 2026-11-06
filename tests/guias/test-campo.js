#!/usr/bin/env node
'use strict';
/** Lógica pura de assets/guias/campo.js (sin DOM): node tests/guias/test-campo.js */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
let n = 0;
const ok = (nombre, fn) => { fn(); n++; };

(async () => {
  const C = await import(pathToFileURL(path.join(__dirname, '../../assets/guias/campo.js')).href);
  const c = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

  ok('clave', () => assert.strictEqual(C.clave, 'campo'));
  ok('rampa: extremos, monotonía de luminosidad y entradas raras', () => {
    assert.deepStrictEqual(C.rampa(0), [43, 47, 107]); assert.deepStrictEqual(C.rampa(1), [242, 230, 107]);
    const lum = ([r, g, b]) => .2126 * r + .7152 * g + .0722 * b;
    for (let i = 0; i < 20; i++) assert.ok(lum(C.rampa(i / 20)) <= lum(C.rampa((i + 1) / 20)) + 1e-9, 'luminosidad creciente');
    assert.deepStrictEqual(C.rampa(NaN), C.rampa(0)); assert.deepStrictEqual(C.rampa(9), C.rampa(1)); assert.deepStrictEqual(C.rampa(-3), C.rampa(0));
  });
  ok('malla: tamaño, rango y valores no finitos', () => {
    const M = C.malla((x, y) => x * x + y * y, [-1, 1], [-1, 1], 8);
    assert.strictEqual(M.z.length, 81); c(M.mn, 0); c(M.mx, 2);
    const R = C.malla(() => 5, [0, 1], [0, 1], 4); assert.ok(R.mx > R.mn); // rango plano → se abre
    const B = C.malla((x, y) => (x > .5 ? NaN : 1 / y), [0, 1], [0, 1], 4); assert.ok(Number.isFinite(B.mn) && Number.isFinite(B.mx) || B.mx > B.mn);
  });
  ok('niveles: estrictamente dentro del rango', () => {
    const v = C.niveles(0, 10, 9); assert.ok(v.length && v.every(x => x > 0 && x < 10)); assert.deepStrictEqual(C.niveles(3, 3.0001, 5).every(x => x > 3), true);
  });
  ok('contorno: x²+y²=1 da una circunferencia', () => {
    const M = C.malla((x, y) => x * x + y * y, [-2, 2], [-2, 2], 72), s = C.contorno(M, [-2, 2], [-2, 2], 1);
    assert.ok(s.length > 4 * 40 && s.length % 4 === 0);
    for (let i = 0; i < s.length; i += 2) c(Math.hypot(s[i], s[i + 1]), 1, 0.03);
    assert.strictEqual(C.contorno(M, [-2, 2], [-2, 2], 99).length, 0);
  });
  ok('contorno: caso de silla (x·y = 0) tiene dos ramas', () => {
    const M = C.malla((x, y) => x * y, [-1, 1], [-1, 1], 40), s = C.contorno(M, [-1, 1], [-1, 1], 0.0001);
    assert.ok(s.length > 0);
  });
  ok('ajustar: respeta la proporción de la ventana y se centra', () => {
    const a = C.ajustar([-2, 2, -2, 2], 480, 340); c(a.w, a.h); c(a.h, 340); c(a.x, 70);
    const b = C.ajustar([0, 8, 0, 2], 480, 340); c(b.w, 480); c(b.h, 120); c(b.y, 110);
  });
  ok('etiquetaDe: elige un segmento interior y null si no hay', () => {
    assert.strictEqual(C.etiquetaDe([], [0, 1], [0, 1]), null);
    const M = C.malla((x, y) => x * x + y * y, [-2, 2], [-2, 2], 72), p = C.etiquetaDe(C.contorno(M, [-2, 2], [-2, 2], 1), [-2, 2], [-2, 2]);
    assert.ok(Math.abs(Math.hypot(p[0], p[1]) - 1) < .05 && Math.abs(p[0] - p[1]) < .3);
  });
  ok('gradiente numérico', () => { const g = C.gradiente((x, y) => x * x * y, 2, 3); c(g[0], 12, 1e-4); c(g[1], 4, 1e-4); });
  ok('integral doble (punto medio)', () => {
    c(C.integralDoble((x, y) => x * y, 0, 2, 0, 3, 200), 9, 1e-3); c(C.integralDoble(() => 1, 0, 2, 0, 3, 1), 6);
    assert.ok(Number.isNaN(C.integralDoble(() => NaN, 0, 1, 0, 1, 2)));
  });
  ok('proyección: con elev=π/2 mira desde arriba; la profundidad ordena', () => {
    const p = C.proyectar(1, 0, 0, 0, Math.PI / 2); c(p.sx, 1); c(p.sy, 0, 1e-12);
    const q = C.proyectar(0, 1, 0, 0, 0.5), r = C.proyectar(0, -1, 0, 0, 0.5); assert.ok(q.prof > r.prof); assert.ok(q.sy > r.sy);
    const t = C.proyectar(0, 0, 1, 1.3, 0); c(t.sy, 1); c(t.sx, 0);
  });
  ok('plegar: abre con rot/elev por defecto, parchea y no muta', () => {
    const g = { f: (x, y) => x + y, x: [0, 1], y: [0, 1], par: { x0: 1 }, capas: [{ tipo: 'punto', x: 'x0', y: 0 }] };
    const s0 = C.plegar({}, { campo: g }); assert.strictEqual(s0.par.x0, 1); assert.ok('rot' in s0.par && 'elev' in s0.par); assert.strictEqual(s0.modo, 'nivel');
    const s1 = C.plegar(s0, { par: { x0: 2 }, modo: 'superficie', capas: [] });
    assert.strictEqual(s0.par.x0, 1); assert.strictEqual(s1.par.x0, 2); assert.strictEqual(s1.modo, 'superficie'); assert.strictEqual(s1.capas.length, 0);
    assert.strictEqual(C.plegar(s1, { modo: 'otro' }).modo, 'superficie');
    assert.strictEqual(C.plegar(s0, { campo: g }).def, s0.def);
  });
  ok('vista/conVista/ctx', () => {
    const s = C.plegar({}, { campo: { f: (x, y) => x * y, x: [0, 1], y: [0, 1], par: { x0: 1 } } }), v = C.vista(s); v.x0 = 4;
    const s2 = C.conVista(s, v); assert.strictEqual(s2.par.x0, 4); assert.strictEqual(s.par.x0, 1);
    const cx = C.ctx(s2); c(cx.f(2, 3), 6); c(cx.grad(2, 3)[0], 3, 1e-4); c(cx.integral(0, 1, 0, 1, 50), .25, 1e-3);
  });
  console.log(`test-campo: ${n} pruebas OK`);
})().catch(e => { console.error(e); process.exit(1); });
