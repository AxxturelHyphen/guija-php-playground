#!/usr/bin/env node
'use strict';
/**
 * Pruebas de la lógica pura de assets/guias/grafica.js (sin navegador ni DOM):
 *   node tests/guias/test-grafica.js
 * Escalas, ticks 1-2-5, formato de magnitudes, muestreo, recorte de valores enormes, anticolisión y plegar (pura).
 */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

let n = 0;
const ok = (nombre, fn) => { fn(); n++; };

(async () => {
  const G = await import(pathToFileURL(path.join(__dirname, '../../assets/guias/grafica.js')).href);
  const { formatear, ticks125, ticksLog, crearEscala, escalaMezcla, muestrear, camino, separar, plegar, vista, conVista, ctx, dominioY, nDesdeX, techo125, PALETA } = G;
  const cercano = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} ≉ ${b}`);

  ok('clave y paleta', () => { assert.strictEqual(G.clave, 'grafica'); assert.strictEqual(new Set(PALETA).size, PALETA.length); });

  ok('escala lineal y logarítmica', () => {
    const l = crearEscala('lin', [0, 100], [300, 0]);
    cercano(l(0), 300); cercano(l(100), 0); cercano(l(50), 150);
    const g = crearEscala('log', [1, 1000], [300, 0]);
    cercano(g(1), 300); cercano(g(1000), 0); cercano(g(10), 200); cercano(g(100), 100);
    assert.ok(Number.isNaN(g(0)) && Number.isNaN(g(-5)), 'log de v ≤ 0 → NaN');
    const m = escalaMezcla(l, g, 0.5, 300);
    cercano(m(10), (l(10) + g(10)) / 2);
    cercano(escalaMezcla(l, g, 0, 300)(10), l(10)); cercano(escalaMezcla(l, g, 1, 300)(10), g(10));
    assert.strictEqual(escalaMezcla(l, g, 1, 300)(0), 900, 'v ≤ 0 en log queda bajo el eje');
    assert.ok(Number.isFinite(escalaMezcla(l, g, 0.5, 300)(Infinity)), 'Infinity se acota');
    assert.ok(Number.isNaN(m(NaN)));
  });

  ok('ticks 1-2-5', () => {
    assert.deepStrictEqual(ticks125(0, 100, 5), [0, 20, 40, 60, 80, 100]);
    assert.deepStrictEqual(ticks125(0, 30, 6), [0, 5, 10, 15, 20, 25, 30]);
    assert.deepStrictEqual(ticks125(0, 1000, 5), [0, 200, 400, 600, 800, 1000]);
    assert.deepStrictEqual(ticks125(0, 7, 6), [0, 2, 4, 6]);
    assert.deepStrictEqual(ticks125(0, 0.5, 5), [0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    for (const hi of [3, 17, 99, 250, 1234, 5e5, 1.3e9]) {
      const t = ticks125(0, hi, 6);
      assert.ok(t.length >= 2 && t.length <= 7, `${hi}: ${t.length} ticks`);
      assert.ok(t.every(v => v >= 0 && v <= hi));
      const paso = t[1] - t[0], m = paso / 10 ** Math.floor(Math.log10(paso));
      assert.ok([1, 2, 5].some(x => Math.abs(m - x) < 1e-6), `paso ${paso} no es 1-2-5`);
    }
    assert.deepStrictEqual(ticksLog(0.5, 10), [0.5, 1, 2, 5, 10]);
    assert.deepStrictEqual(ticksLog(0.5, 1000), [1, 10, 100, 1000]);
    const t = ticksLog(0.5, 1e10);
    assert.ok(t.length <= 7 && t.every(v => Math.log10(v) % 1 === 0), `décadas ralas: ${t}`);
    assert.strictEqual(techo125(972), 1000); assert.strictEqual(techo125(1.08), 2); assert.strictEqual(techo125(0), 1);
  });

  ok('formato de magnitudes', () => {
    assert.strictEqual(formatear(2 ** 40), '1,1e12');
    assert.strictEqual(formatear(2 ** 40, 'en'), '1.1e12');
    assert.strictEqual(formatear(1e15), '1e15');
    assert.strictEqual(formatear(Infinity), '∞');
    assert.strictEqual(formatear(-Infinity), '−∞');
    assert.strictEqual(formatear(NaN), '—');
    assert.strictEqual(formatear(undefined), '—');
    assert.strictEqual(formatear(0), '0');
    assert.strictEqual(formatear(12), '12');
    assert.strictEqual(formatear(4.9), '4,9');
    assert.strictEqual(formatear(147.2), '147');
    assert.strictEqual(formatear(1234), '1,23 k');
    assert.strictEqual(formatear(999.9), '1 k');
    assert.strictEqual(formatear(12500), '12,5 k');
    assert.strictEqual(formatear(3.4e6), '3,4 M');
    assert.strictEqual(formatear(999999), '1 M');
    assert.strictEqual(formatear(5.6e12), '5,6e12');
    assert.strictEqual(formatear(2 ** 30), '1,1e9');
    assert.strictEqual(formatear(1e300), '1e300');
    assert.strictEqual(formatear(-1234), '−1,23 k');
    assert.strictEqual(formatear(0.5), '0,5');
    for (const v of [0, 1, 1e-9, 123456789, 2 ** 100, 1e308, Number.MAX_VALUE, 0.999999]) assert.ok(!/NaN|undefined/.test(formatear(v)), String(v));
  });

  ok('muestreo', () => {
    const { xs, vs } = muestrear(x => x * 2, 10, 20);
    assert.strictEqual(xs.length, 21); assert.strictEqual(xs[0], 0); assert.strictEqual(xs[20], 10); assert.strictEqual(vs[20], 20);
    const raro = muestrear(x => (x > 5 ? 'no' : x), 10, 10);
    assert.ok(Number.isNaN(raro.vs[10]) && raro.vs[0] === 0);
    assert.strictEqual(muestrear(() => Infinity, 3, 3).vs[0], Infinity);
  });

  ok('recorte de valores enormes (2^n)', () => {
    const PH = 286, PW = 482, nmax = 1000;
    const sl = crearEscala('lin', [0, 1000], [PH, 0]), sg = crearEscala('log', [0.5, 1e10], [PH, 0]);
    const px = x => x / nmax * PW;
    for (const k of [0, 0.5, 1]) {
      const py = escalaMezcla(sl, sg, k, PH);
      const { xs, vs } = muestrear(x => 2 ** x, nmax, 160); // 2^1000 y más allá: Infinity a partir de n≈1024
      const c = camino(xs, vs, px, py, PH);
      assert.ok(!/NaN|Infinity|undefined/.test(c.d), `k=${k}: camino con valores no finitos`);
      const ys = [...c.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(m => +m[2]);
      assert.ok(ys.length > 1 && ys.every(y => y >= -1e-6 && y <= PH + 1e-6), `k=${k}: puntos fuera del área`);
      if (k !== 1) assert.ok(c.arriba && c.arriba.x >= 0 && c.arriba.x <= PW && !c.fin, 'recortada arriba con marca');
    }
    // curva que cabe: termina dentro y no tiene marca
    const py = escalaMezcla(sl, sg, 0, PH), m = muestrear(x => x, 100, 100), c = camino(m.xs, m.vs, x => x / 100 * PW, py, PH);
    assert.ok(c.fin && !c.arriba && !c.abajo && c.fin.x === PW);
    // la salida está en el borde superior y entre la última muestra dentro y la primera fuera
    const m2 = muestrear(x => x * x, 10, 10), c2 = camino(m2.xs, m2.vs, x => x * 10, v => 100 - v, 100); // y=100-x², sale en x=10 → no sale
    assert.ok(c2.fin);
    const c3 = camino([0, 1, 2], [0, 50, 500], x => x * 10, v => 100 - v, 100); // 100-500 = -400 → sale por arriba entre x=10 y 20
    assert.ok(c3.arriba && c3.arriba.x > 10 && c3.arriba.x < 20 && !c3.fin);
    cercano(c3.arriba.x, 10 + 10 * (50 / 450), 0.02);
    // saltos NaN rompen el trazo
    const c4 = camino([0, 1, 2, 3], [1, NaN, 2, 3], x => x * 10, v => 100 - v, 100);
    assert.strictEqual((c4.d.match(/M/g) || []).length, 2);
    // vacía por completo (todo bajo el eje)
    const c5 = camino([0, 1], [-5, -9], x => x, v => 100 - v, 50);
    assert.strictEqual(c5.d, ''); assert.ok(!c5.fin);
  });

  ok('anticolisión de etiquetas', () => {
    const o = separar([100, 102, 104, 300], 14, 6, 286).sort((a, b) => a - b);
    for (let i = 1; i < o.length; i++) assert.ok(o[i] - o[i - 1] >= 14 - 1e-9, `separación ${o}`);
    assert.ok(o[0] >= 6 && o[o.length - 1] <= 286);
    assert.strictEqual(separar([50, 200], 14, 6, 286).join(), '50,200', 'sin colisión no se mueve');
    const pegadas = separar([284, 285, 286, 290], 14, 6, 286), op = pegadas.slice().sort((a, b) => a - b);
    assert.ok(op[3] <= 286 && op.every((v, i) => i === 0 || v - op[i - 1] >= 14 - 1e-9), `contra el borde: ${op}`);
    assert.deepStrictEqual(separar([], 14, 0, 10), []);
  });

  ok('nDesdeX', () => {
    assert.strictEqual(nDesdeX(0, 480, 30), 0); assert.strictEqual(nDesdeX(480, 480, 30), 30);
    assert.strictEqual(nDesdeX(-50, 480, 30), 0); assert.strictEqual(nDesdeX(9999, 480, 30), 30);
    assert.strictEqual(nDesdeX(240, 480, 30), 15);
  });

  const curvas = [
    { id: 'a', nombre: 'O(1)', f: () => 1 }, { id: 'b', nombre: { es: 'lineal', en: 'linear' }, f: n => n },
    { id: 'c', nombre: 'O(n²)', f: n => n * n }, { id: 'd', nombre: 'O(2ⁿ)', f: n => 2 ** n, color: '#123456' },
  ];

  ok('dominio y automático', () => {
    const d = dominioY(curvas, 30, null);
    assert.deepStrictEqual(d.lin, [0, 1000]); // 2.ª mayor = 900 → ×1,08 → 1000
    assert.strictEqual(d.log[1], 1e10); assert.strictEqual(d.log[0], 0.5);
    assert.deepStrictEqual(dominioY(curvas, 30, 50).lin, [0, 50]);
    assert.deepStrictEqual(dominioY(curvas, 30, { lin: 200 }).lin, [0, 200]);
    assert.strictEqual(dominioY(curvas, 30, { lin: 200 }).log[1], 1e10);
    assert.strictEqual(dominioY([{ id: 'x', f: () => NaN }], 10, null).lin[1], 2);
    assert.ok(dominioY([{ id: 'x', f: n => 2 ** n }], 5000, null).log[1] <= 1e30);
  });

  ok('plegar es pura y acumulativa', () => {
    const g = { curvas, nmax: 30, n: 10, ver: ['a'] };
    const S0 = plegar(undefined, { grafica: g });
    const copiaS0 = JSON.stringify({ ...S0, def: undefined });
    assert.strictEqual(S0.n, 10); assert.deepStrictEqual(S0.ver, ['a']); assert.strictEqual(S0.escala, 'lin'); assert.strictEqual(S0.nmax, 30);
    assert.strictEqual(S0.def.curvas[3].color, '#123456'); assert.strictEqual(S0.def.curvas[0].color, PALETA[0]);
    const S1 = plegar(S0, { n: 20, ver: ['a', 'b', 'zzz'], escala: 'log', resaltar: 'c', ymax: 500 });
    assert.strictEqual(JSON.stringify({ ...S0, def: undefined }), copiaS0, 'no muta el estado previo');
    assert.notStrictEqual(S1, S0); assert.strictEqual(S1.def, S0.def, 'misma identidad de def');
    assert.deepStrictEqual(S1.ver, ['a', 'b'], 'ids desconocidos se descartan');
    assert.strictEqual(S1.n, 20); assert.strictEqual(S1.escala, 'log'); assert.strictEqual(S1.resaltar, 'c'); assert.strictEqual(S1.ymax, 500);
    const S2 = plegar(S1, { resaltar: null, ymax: null });
    assert.strictEqual(S2.resaltar, null); assert.strictEqual(S2.ymax, null); assert.strictEqual(S2.n, 20, 'lo no parcheado se conserva');
    assert.strictEqual(plegar(S0, { n: 999 }).n, 30, 'n se recorta a nmax'); assert.strictEqual(plegar(S0, { n: -4 }).n, 0);
    const Z = plegar(S1, { zoom: { nmax: 8 } });
    assert.strictEqual(Z.nmax, 8); assert.strictEqual(Z.n, 8, 'zoom recorta n'); assert.strictEqual(S1.nmax, 30);
    assert.strictEqual(plegar(S1, { escala: 'x' }).escala, 'log', 'escala inválida se ignora');
    assert.strictEqual(plegar(S1, { es: 'solo texto', en: 'text only', line: 3 }).n, 20, 'campos ajenos no cambian nada');
    // plegar dos veces el mismo paso de apertura da el mismo def (guia.js compara por ===)
    assert.strictEqual(plegar(undefined, { grafica: g }).def, S0.def);
    // defaults: todas visibles, n = nmax/3
    const D = plegar(undefined, { grafica: { curvas, nmax: 30 } });
    assert.strictEqual(D.ver.length, 4); assert.strictEqual(D.n, 10);
    // el parche inicial puede acompañar al paso que abre
    assert.strictEqual(plegar(undefined, { grafica: g, n: 3 }).n, 3);
    // el orden de parches importa igual que en guia.js: replegar da lo mismo
    const a = [{ n: 5 }, { ver: ['b'] }, { escala: 'log' }].reduce(plegar, S0), b = [{ n: 5 }, { ver: ['b'] }, { escala: 'log' }].reduce(plegar, S0);
    assert.deepStrictEqual({ ...a, def: 0 }, { ...b, def: 0 });
  });

  ok('vista / conVista / ctx para jugar', () => {
    const S = plegar(undefined, { grafica: { curvas, nmax: 30, n: 10, ver: ['a', 'b'] } });
    const v = vista(S);
    assert.deepStrictEqual(Object.keys(v).sort(), ['escala', 'n', 'nmax', 'resaltar', 'ver', 'ymax']);
    v.n = 99; v.ver.push('c'); v.escala = 'log';
    assert.strictEqual(S.n, 10); assert.deepStrictEqual(S.ver, ['a', 'b'], 'la vista es una copia');
    const S2 = conVista(S, v);
    assert.strictEqual(S2.n, 30, 'conVista recorta n'); assert.deepStrictEqual(S2.ver, ['a', 'b', 'c']); assert.strictEqual(S2.escala, 'log'); assert.strictEqual(S2.def, S.def);
    const cx = ctx(S);
    assert.strictEqual(cx.f('c', 7), 49); assert.ok(Number.isNaN(cx.f('nope', 7)));
    assert.deepStrictEqual(cx.valores(3), { a: 1, b: 3, c: 9, d: 8 });
    assert.strictEqual(cx.fmt(2 ** 40), '1,1e12'); assert.strictEqual(cx.nombre('b'), 'lineal');
  });

  ok('plano: etiquetas con $…$ a texto plano (aria-label, anchos)', () => {
    assert.strictEqual(G.plano('$O(n \\log n)$'), 'O(n log n)');
    assert.strictEqual(G.plano('$O(2^n)$'), 'O(2ⁿ)');
    assert.strictEqual(G.plano('$3n^2+5n+20$'), '3n²+5n+20');
    assert.strictEqual(G.plano('$\\log_2(n!)$'), 'log₂(n!)');
    assert.strictEqual(G.plano('$n^{10}$'), 'n¹⁰');
    assert.strictEqual(G.plano('O(1)'), 'O(1)', 'texto plano intacto');
    assert.strictEqual(G.plano(undefined), '');
  });

  console.log(`✓ test-grafica: ${n} grupos de pruebas correctos`);
})().catch(e => { console.error('✗ test-grafica:', e.message); console.error(e.stack.split('\n').slice(1, 4).join('\n')); process.exit(1); });
