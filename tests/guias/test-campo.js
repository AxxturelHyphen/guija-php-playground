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
  // ── Superficie WebGL: lógica pura de campo-gl.js ──
  const G = await import(pathToFileURL(path.join(__dirname, '../../assets/guias/campo-gl.js')).href);
  ok('limitarElev: acota la elevación', () => { c(C.limitarElev(-1), .1); c(C.limitarElev(9), 1.45); c(C.limitarElev(.7), .7); });
  ok('alturas: normaliza a ±ZS, acota fuera de rango y conserva NaN', () => {
    const M = C.malla((x, y) => x, [0, 1], [0, 1], 4), h = G.alturas(M, 0, 1);
    c(h[0], -C.ZS); c(h[4], C.ZS); c(h[2], 0);
    const A = G.alturas(M, .25, .75); c(A[0], -C.ZS); c(A[4], C.ZS); // z acotada al rango dado
    assert.ok(Number.isNaN(G.alturas({ z: new Float64Array([NaN, 1]) }, 0, 1)[0]));
  });
  ok('normales: unitarias; plano horizontal → (0,0,1); plano inclinado → inclinación correcta; hueco → arriba', () => {
    const N = 6, plano = G.normales(new Float32Array(49), N);
    for (let k = 0; k < 49; k++) { c(plano[3 * k], 0); c(plano[3 * k + 1], 0); c(plano[3 * k + 2], 1); }
    const h = new Float32Array(49); for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) h[j * 7 + i] = .5 * (-1 + 2 * i / N); // z = 0,5·nx
    const n = G.normales(h, N), k = 3 * (3 * 7 + 3), l = Math.hypot(.5, 1);
    c(n[k], -.5 / l, 1e-6); c(n[k + 1], 0, 1e-6); c(n[k + 2], 1 / l, 1e-6);
    for (let q = 0; q < 49; q++) c(Math.hypot(n[3 * q], n[3 * q + 1], n[3 * q + 2]), 1, 1e-5);
    h[24] = NaN; const m = G.normales(h, N); c(m[3 * 24 + 2], 1); // vértice no finito
  });
  ok('índices: 2 triángulos por celda, se saltan celdas con NaN; la malla fina incluye bordes', () => {
    const N = 8, h = new Float32Array(81); assert.strictEqual(G.indicesRelleno(h, N).length, N * N * 6);
    h[4 * 9 + 4] = NaN; assert.strictEqual(G.indicesRelleno(h, N).length, (N * N - 4) * 6);
    assert.ok(Math.max(...G.indicesRelleno(h, N)) <= 80 && !G.indicesRelleno(h, N).includes(40));
    const L = G.indicesMalla(new Float32Array(81), N, 4); assert.strictEqual(L.length, 2 * 2 * N * 3); // líneas 0, 4 y 8 en cada sentido
    assert.strictEqual(G.indicesMalla(new Float32Array(81), N, 3).length % 2, 0);
  });
  ok('matriz: coincide con proyectar() y con la posición en píxeles de campo.js (CAM, TAM)', () => {
    for (const [rot, el, nx, ny, nz] of [[.75, .6, .3, -.8, .2], [2.2, 1.2, -1, 1, -C.ZS], [0, .1, 0, 0, C.ZS]]) {
      const m = G.matriz(rot, el), p = C.proyectar(nx, ny, nz, rot, el);
      const X = m[0] * nx + m[4] * ny + m[8] * nz + m[12], Y = m[1] * nx + m[5] * ny + m[9] * nz + m[13], Z = m[2] * nx + m[6] * ny + m[10] * nz + m[14];
      c((X + 1) / 2 * C.TAM.W, C.CAM.cx + p.sx * C.CAM.sc, 1e-3); c((1 - Y) / 2 * C.TAM.H, C.CAM.cy - p.sy * C.CAM.sc, 1e-3); c(Z, p.prof / 3, 1e-6);
      assert.ok(Math.abs(Z) < 1, 'dentro del volumen de recorte');
    }
  });
  ok('caja: esquina trasera = la de mayor profundidad; aristas del suelo más cercanas', () => {
    for (const rot of [0, .75, 2.2, 4, 5.5]) {
      const cj = G.caja(rot, .6), prof = (a, b) => C.proyectar(a, b, 0, rot, .6).prof, mx = Math.max(prof(1, 1), prof(1, -1), prof(-1, 1), prof(-1, -1));
      c(prof(cj.ax, cj.ay), mx, 1e-9);
      assert.ok(prof(0, cj.yf) <= prof(0, -cj.yf) + 1e-9 && prof(cj.xf, 0) <= prof(-cj.xf, 0) + 1e-9);
      const sx = (a, b) => C.proyectar(a, b, 0, rot, .6).sx; assert.ok(sx(cj.ix, cj.iy) <= Math.min(sx(1, 1), sx(1, -1), sx(-1, 1), sx(-1, -1)) + 1e-2);
    }
  });
  ok('lineasCaja: segmentos completos y dentro del búfer', () => {
    const t = { x: [-1, 0, 1], y: [-.5, .5], z: [-.3, .3] }, out = new Float32Array(G.MAX_VERT_CAJA * 3), [vp, vs] = G.lineasCaja(G.caja(.75, .6), t, out);
    assert.strictEqual(vp, 10); assert.strictEqual(vs, 8 + 2 * (3 + 2 + 2)); assert.ok(vp + vs <= G.MAX_VERT_CAJA);
    for (let i = 0; i < (vp + vs) * 3; i++) assert.ok(Number.isFinite(out[i]) && Math.abs(out[i]) <= 1.08 + 1e-6);
  });
  ok('colores por vértice: la rampa de campo.js', () => {
    const M = C.malla((x, y) => x, [0, 1], [0, 1], 2), col = G.colores(M, 0, 1);
    assert.deepStrictEqual([...col.slice(0, 3)], C.rampa(0)); assert.deepStrictEqual([...col.slice(6, 9)], C.rampa(1)); // vértices 0 (x=0) y 2 (x=1)
  });
  ok('colorGL: hex, rgb() y valor por defecto', () => {
    assert.deepStrictEqual(G.colorGL('#fff'), [1, 1, 1, 1]); c(G.colorGL('#3A3D42')[0], 58 / 255); c(G.colorGL('#00000080')[3], 128 / 255);
    assert.deepStrictEqual(G.colorGL('rgba(255, 0, 0, .5)'), [1, 0, 0, .5]); assert.deepStrictEqual(G.colorGL('rarito', [0, 0, 0, 1]), [0, 0, 0, 1]);
  });
  console.log(`test-campo: ${n} pruebas OK`);
})().catch(e => { console.error(e); process.exit(1); });
