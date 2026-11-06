#!/usr/bin/env node
'use strict';
/** Lógica pura de assets/guias/funcion.js (sin DOM): node tests/guias/test-funcion.js */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
let n = 0;
const ok = (nombre, fn) => { fn(); n++; };

(async () => {
  const F = await import(pathToFileURL(path.join(__dirname, '../../assets/guias/funcion.js')).href);
  const c = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

  ok('clave', () => assert.strictEqual(F.clave, 'funcion'));
  ok('num: valor o parámetro', () => { assert.strictEqual(F.num(3, {}), 3); assert.strictEqual(F.num('x0', { x0: 7 }), 7); });
  ok('evalF protege de excepciones y no números', () => { assert.ok(Number.isNaN(F.evalF(() => { throw 1; }, 0))); assert.ok(Number.isNaN(F.evalF(() => 'a', 0))); });
  ok('derivada numérica', () => { c(F.deriv(x => x * x, 3), 6, 1e-5); c(F.deriv(Math.sin, 0), 1, 1e-6); });
  ok('integral Simpson', () => { c(F.integral(x => x * x, 0, 3), 9, 1e-8); c(F.integral(Math.sin, 0, Math.PI), 2, 1e-8); c(F.integral(x => x, 2, 2), 0); });
  ok('Riemann: izq/der/medio/trap convergen y se ordenan', () => {
    const f = x => x * x, I = 1 / 3, r = m => F.riemann(f, 0, 1, 4, m).suma;
    assert.ok(r('izq') < I && I < r('der'));
    assert.ok(Math.abs(r('medio') - I) < Math.abs(r('izq') - I));
    assert.ok(r('trap') > I);
    c(F.riemann(f, 0, 1, 1000, 'medio').suma, I, 1e-6);
    assert.strictEqual(F.riemann(f, 0, 1, 7, 'izq').segs.length, 7);
    assert.strictEqual(F.riemann(f, 0, 1, 0.2, 'izq').segs.length, 1);
  });
  ok('Taylor de sin', () => {
    const coef = k => [0, 1, 0, -1 / 6, 0, 1 / 120, 0, -1 / 5040][k] ?? 0;
    c(F.taylor(coef, 0, 7)(1), Math.sin(1), 1e-4);
    assert.ok(Math.abs(F.taylor(coef, 0, 3)(2) - Math.sin(2)) > Math.abs(F.taylor(coef, 0, 7)(2) - Math.sin(2)));
    assert.strictEqual(F.taylor(coef, 0, 0)(5), 0);
  });
  ok('Newton converge a √2 y se detiene con derivada 0', () => {
    const xs = F.newton(x => x * x - 2, 1, 6); c(xs.at(-1), Math.SQRT2, 1e-9);
    assert.strictEqual(F.newton(x => x * x, 0, 5).length, 1);
  });
  ok('cortar rompe en asíntotas y saltos', () => {
    const xs = [-2, -1, -.1, .1, 1, 2], ys = xs.map(x => 1 / x), r = F.cortar(xs, ys, 5);
    assert.ok(r.ys.some(Number.isNaN)); assert.strictEqual(r.xs.length, r.ys.length);
    const sin = F.cortar([0, 1, 2], [0, 1, 2], 5); assert.ok(!sin.ys.some(Number.isNaN));
    assert.ok(F.cortar([0, 1], [0, Infinity], 5).ys.some(Number.isNaN));
  });
  ok('ventana: igual ajusta el ancho', () => {
    assert.deepStrictEqual(F.ventanaEf({ x: [-1, 1], y: [-2, 2] }, 400, 200, false), [-1, 1, -2, 2]);
    const [a, b] = F.ventanaEf({ x: [-1, 1], y: [-2, 2] }, 400, 200, true); c(b - a, 8);
  });
  ok('puntoCurva: paramétrica y polar', () => {
    const p = F.puntoCurva({ param: { x: t => t, y: t => t * t } }, 3); assert.deepStrictEqual(p, [3, 9]);
    const q = F.puntoCurva({ polar: { r: () => 2 } }, Math.PI / 2); c(q[0], 0); c(q[1], 2);
  });
  ok('plegar: abre, parchea y no muta', () => {
    const g = { x: [-3, 3], y: [-2, 2], par: { x0: 1 }, curvas: [{ id: 'f', f: x => x }, { id: 'g', f: x => -x }], capas: [{ tipo: 'tangente', c: 'f', x: 'x0' }] };
    const s0 = F.plegar({}, { funcion: g });
    assert.deepStrictEqual(s0.ver, ['f', 'g']); assert.strictEqual(s0.par.x0, 1); assert.strictEqual(s0.capas.length, 1);
    const s1 = F.plegar(s0, { par: { x0: 2, h: .5 }, ver: ['f', 'zz'], resaltar: 'f', ventana: { y: [-1, 1] } });
    assert.strictEqual(s0.par.x0, 1); assert.deepStrictEqual(s1.par, { x0: 2, h: .5 }); assert.deepStrictEqual(s1.ver, ['f']);
    assert.strictEqual(s1.resaltar, 'f'); assert.deepStrictEqual(s1.ventana, { x: [-3, 3], y: [-1, 1] });
    assert.strictEqual(F.plegar(s1, { resaltar: 'nope' }).resaltar, null);
    assert.strictEqual(F.plegar(s0, { funcion: g }).def, s0.def); // mismo `g` → misma identidad de def
  });
  ok('vista/conVista/ctx', () => {
    const g = { curvas: [{ id: 'f', f: x => x * x }], par: { x0: 2, n: 4 } }, s = F.plegar({}, { funcion: g }), v = F.vista(s);
    v.x0 = 3; const s2 = F.conVista(s, v); assert.strictEqual(s2.par.x0, 3); assert.strictEqual(s.par.x0, 2);
    const cx = F.ctx(s2); c(cx.f('f', 3), 9); c(cx.d('f', 3), 6, 1e-5); c(cx.integral('f', 0, 3), 9, 1e-8); assert.ok(Number.isNaN(cx.f('zz', 1)));
  });
  console.log(`test-funcion: ${n} pruebas OK`);
})().catch(e => { console.error(e); process.exit(1); });
