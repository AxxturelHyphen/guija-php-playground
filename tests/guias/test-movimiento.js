#!/usr/bin/env node
'use strict';
/** Lógica pura de assets/guias/movimiento.js (sin DOM): node tests/guias/test-movimiento.js */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
let n = 0;
const ok = (nombre, fn) => { fn(); n++; };

(async () => {
  const M = await import(pathToFileURL(path.join(__dirname, '../../assets/guias/movimiento.js')).href);

  ok('ease: extremos y simetría', () => {
    assert.strictEqual(M.ease(0), 0); assert.strictEqual(M.ease(1), 1);
    assert.ok(Math.abs(M.ease(.5) - .5) < 1e-12);
    assert.ok(M.easeOut(.5) > .5 && M.easeOut(0) === 0 && M.easeOut(1) === 1);
  });
  ok('Muelle converge y es críticamente amortiguado (sin rebote)', () => {
    const m = new M.Muelle(0, 16).ir(10);
    let max = 0, i = 0;
    for (; i < 600 && !m.quieto; i++) { m.paso(1 / 60); max = Math.max(max, m.x); }
    assert.ok(m.quieto, 'no llegó al reposo'); assert.strictEqual(m.x, 10); assert.strictEqual(m.v, 0);
    assert.ok(max <= 10 + 1e-9, `rebote: ${max}`);
    assert.ok(i < 90, `lento: ${i} fotogramas`); // w=16 → ~0,5 s
  });
  ok('Muelle: mismo resultado con dt grande y pequeño (integración exacta)', () => {
    const a = new M.Muelle(0, 12).ir(5), b = new M.Muelle(0, 12).ir(5);
    a.paso(.5); for (let i = 0; i < 500; i++) b.paso(.001);
    assert.ok(Math.abs(a.x - b.x) < 1e-6, `${a.x} vs ${b.x}`);
  });
  ok('Muelle: reapuntar a mitad conserva la velocidad (sin salto de posición ni de velocidad)', () => {
    const m = new M.Muelle(0, 16).ir(10);
    for (let i = 0; i < 10; i++) m.paso(1 / 60);
    const x = m.x, v = m.v;
    m.ir(-4);
    assert.strictEqual(m.x, x); assert.strictEqual(m.v, v);
    assert.ok(v > 0, 'iba hacia arriba');
    for (let i = 0; i < 600 && !m.quieto; i++) m.paso(1 / 60);
    assert.strictEqual(m.x, -4);
  });
  ok('Muelle.salto fija sin animar', () => { const m = new M.Muelle(3).ir(9); m.salto(7); assert.ok(m.quieto && m.x === 7 && m.a === 7); });
  console.log(`✓ test-movimiento: ${n} pruebas`);
})().catch(e => { console.error('✗', e.message); process.exit(1); });
