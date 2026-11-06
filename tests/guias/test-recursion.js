#!/usr/bin/env node
'use strict';
/**
 * Pruebas de los generadores de la guía «Recursión y complejidad» (assets/guias/data/recursion-traza.js) y de que
 * la guía entera (data/recursion.js) se pliega sin DOM:
 *   node tests/guias/test-recursion.js        (código de salida 0 = todo correcto)
 * Conteos que se ven en pantalla (fib(5): 15 llamadas, con memo 9; hanoi(3): 7 movimientos…), pilas de `suma`,
 * teorema maestro, duraciones, y recorrido de pasos/frames/botones de `jugar` con las escenas arbol y grafica.
 */
const path = require('path');
const { pathToFileURL } = require('url');

const DATA = path.join(__dirname, '..', '..', 'assets', 'guias');
let fallos = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { fallos++; console.log('  ✗ ' + m); } };
const igual = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const seccion = n => console.log(n);
const congelar = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };

(async () => {
  const imp = f => import(pathToFileURL(path.join(DATA, f)).href);
  const T = await imp('data/recursion-traza.js'), A = await imp('arbol.js'), G = await imp('grafica.js');
  const guia = (await imp('data/recursion.js')).default;

  // ── Números ──
  seccion('Números');
  igual([0, 1, 2, 3, 4, 5, 6, 10].map(T.fibNum), [0, 1, 1, 2, 3, 5, 8, 55], 'fibNum');
  igual([0, 1, 2, 3, 4, 5, 6].map(T.llamadasFib), [1, 1, 3, 5, 9, 15, 25], 'llamadasFib: 1, 1, 3, 5, 9, 15, 25');
  ok(T.llamadasFib(40) === 331160281, 'fib(40) ingenuo: 331 160 281 llamadas');
  // La recurrencia T(n) = T(n-1) + T(n-2) + 1 coincide con la fórmula cerrada
  const Trec = n => (n < 2 ? 1 : Trec(n - 1) + Trec(n - 2) + 1);
  for (let n = 0; n <= 20; n++) ok(Trec(n) === T.llamadasFib(n), `T(${n}) por recurrencia = 2F(n+1)-1`);

  // ── Árbol de llamadas de fib ──
  seccion('fib ingenuo');
  const F5 = T.fibLlamadas(5);
  ok(F5.arbol.nodos.length === 15 && F5.llamadas === 15, `fib(5): 15 llamadas (hay ${F5.arbol.nodos.length})`);
  for (let n = 0; n <= 10; n++) {
    const r = T.fibLlamadas(n);
    ok(r.arbol.nodos.length === T.llamadasFib(n) && r.llamadas === T.llamadasFib(n), `fib(${n}): nodos = llamadas = ${T.llamadasFib(n)}`);
    ok(r.arbol.aristas.length === r.arbol.nodos.length - 1, `fib(${n}): árbol (aristas = nodos - 1)`);
  }
  ok(F5.frames.length === 30 && F5.frames.length <= 120, `fib(5): 30 frames (hay ${F5.frames.length})`);
  const rep = T.repeticiones(F5.arbol);
  igual(rep, { 0: 3, 1: 5, 2: 3, 3: 2, 4: 1, 5: 1 }, 'repeticiones en fib(5)');
  const tam = T.tamanosSubarbol(F5.arbol);
  ok(tam.c0 === 15 && tam.c1 === 9 && tam.c2 === 5, 'subárbol: 15 = 9 + 5 + 1');
  const marcas = T.marcasRepetidas(F5.arbol);
  const malos = Object.keys(marcas.est), valDe = id => F5.arbol.nodos.find(n => n.id === id).val;
  ok(malos.length === 5 && malos.every(id => ['fib(3)', 'fib(2)'].includes(valDe(id))), 'marcas «mal»: 2 de fib(3) y 3 de fib(2)');
  ok(Object.values(marcas.etiquetas).filter(e => e === '×5').length === 5 && Object.values(marcas.etiquetas).includes('×3'), 'etiquetas ×k');
  // El resultado de la raíz sale de ejecutar: etiqueta final «=5»
  const finF5 = T.finalArbol({ nodos: [F5.arbol.nodos[0]], aristas: [], raiz: 'c0' }, [], F5.frames);
  ok(finF5.etiquetas.c0 === '=5' && finF5.ids.length === 15, 'tras la traza: raíz «=5» y 15 nodos');
  ok(finF5.est.c0 === 'ok', 'la raíz acaba terminada (ok)');

  // ── Memoización ──
  seccion('Memoización');
  const M5 = T.memoPoda(F5.arbol);
  ok(M5.llamadas === 9 && M5.arbol.nodos.length === 9, `fib(5) con memo: 9 llamadas (hay ${M5.llamadas} / ${M5.arbol.nodos.length} nodos)`);
  ok(M5.podados.length === 15 - 9, 'se podan 6 nodos');
  ok(M5.frames.length <= 120, `memo fib(5): ${M5.frames.length} frames`);
  // Referencia independiente: contar llamadas ejecutando fib con tabla
  const llamadasMemoReal = n => { let c = 0; const memo = {}; const fib = k => { c++; if (k < 2) return k; if (memo[k]) return memo[k]; return (memo[k] = fib(k - 1) + fib(k - 2)); }; fib(n); return c; };
  for (let n = 2; n <= 12; n++) {
    const r = T.memoPoda(T.fibLlamadas(n).arbol);
    ok(r.llamadas === llamadasMemoReal(n) && r.llamadas === T.llamadasMemo(n) && r.llamadas === 2 * n - 1 && r.arbol.nodos.length === r.llamadas, `memo fib(${n}) = 2n-1 = ${2 * n - 1} llamadas`);
  }
  const hijosDe = new Set(M5.arbol.aristas.map(e => e.b));
  ok(M5.arbol.nodos.filter(n => !hijosDe.has(n.id)).length === 1, 'el árbol podado sigue siendo un árbol (una raíz)');
  const finM = T.finalArbol({ nodos: [F5.arbol.nodos[0]], aristas: [], raiz: 'c0' }, [{ '+nodos': F5.arbol.nodos.slice(1), '+aristas': F5.arbol.aristas }, { est: null, etiquetas: null }], M5.frames);
  igual(finM.ids.sort(), M5.arbol.nodos.map(n => n.id).sort(), 'estado final de la traza = árbol podado');
  ok(finM.etiquetas.c0 === '=5', 'raíz «=5» también con memo');

  // ── Hanoi ──
  seccion('Hanoi');
  for (let n = 1; n <= 6; n++) {
    const H = T.hanoiLlamadas(n), m = 2 ** n - 1;
    ok(H.arbol.nodos.length === m && H.movimientos.length === m, `hanoi(${n}): ${m} llamadas y ${m} movimientos`);
    // Simula los movimientos: legales y todos los discos acaban en C
    const peg = { A: [...Array(n).keys()].map(i => n - i), B: [], C: [] };
    let legal = true;
    for (const [de, a] of H.movimientos) {
      const d = peg[de].pop();
      if (d === undefined || (peg[a].length && peg[a].at(-1) < d)) legal = false;
      peg[a].push(d);
    }
    ok(legal && peg.C.length === n && peg.A.length === 0 && peg.B.length === 0, `hanoi(${n}): movimientos legales y torre en C`);
  }
  const H3 = T.hanoiLlamadas(3), E3 = T.etiquetasHanoi(H3);
  ok(H3.frames.length <= 120, `hanoi(3): ${H3.frames.length} frames`);
  igual(H3.movimientos.map(x => x.join('')), ['AC', 'AB', 'CB', 'AC', 'BA', 'BC', 'AC'], 'hanoi(3): los 7 movimientos clásicos');
  // Los movimientos salen en in-orden del árbol
  const ordenIn = A.recorrido({ nodos: H3.arbol.nodos, aristas: H3.arbol.aristas, raiz: 'c0' }, 'in');
  igual(ordenIn.map(id => E3[id]), ['1:A→C', '2:A→B', '3:C→B', '4:A→C', '5:B→A', '6:B→C', '7:A→C'], 'etiquetas en in-orden');
  ok(Object.keys(E3).length === 7, 'una etiqueta por nodo');
  ok(T.hanoiLlamadas(5).movimientos.length === 31, 'hanoi(5): 31 movimientos');

  // ── Pila de suma ──
  seccion('Pila de suma');
  for (let n0 = 1; n0 <= 5; n0++) {
    const P = T.sumaPila(n0), ini = { st: { r: 'vivo' }, val: { r: '?' } };
    ok(P.frames.length === 2 * n0 + 3, `suma(${n0}): ${2 * n0 + 3} frames`);
    let s = ini, maxVivos = 0;
    for (const f of P.frames) { s = T.plegarCeldas(s, [f]); maxVivos = Math.max(maxVivos, Object.keys(s.st).filter(k => k[0] === 'n').length); }
    ok(maxVivos === n0 + 1, `suma(${n0}): ${n0 + 1} marcos vivos a la vez (hay ${maxVivos})`);
    ok(Object.keys(s.st).join() === 'r' && s.val.r === (n0 * (n0 + 1)) / 2, `suma(${n0}): al final solo queda r = ${(n0 * (n0 + 1)) / 2}`);
    const ids = new Set(P.celdas.map(c => c.id));
    ok(P.frames.every(f => [...(f.mostrar || []), ...(f.ocultar || []), ...Object.keys(f.val || {})].every(x => ids.has(x))), `suma(${n0}): ids de celdas válidos`);
    ok(new Set(P.celdas.map(c => c.addr)).size === P.celdas.length, `suma(${n0}): direcciones únicas`);
  }
  {
    const P = T.sumaPila(3), ini = { st: { r: 'vivo' }, val: { r: '?' } };
    const prof = T.plegarCeldas(ini, P.frames.slice(0, 5)), parche = T.parcheHacia(ini, prof);
    igual(T.plegarCeldas(ini, [parche]), prof, 'parcheHacia reproduce el estado');
    igual(Object.keys(prof.st).filter(k => k[0] === 'n').length, 4, 'caso base: 4 marcos');
    const SB = T.sumaSinBase(2, 5), fin = T.plegarCeldas(ini, SB.frames);
    ok(Object.values(fin.st).filter(x => x === 'fantasma').length === 1 && Object.values(fin.st).filter(x => x === 'vivo').length === 6, 'sin base: 5 marcos reales + r + 1 fantasma');
    ok(SB.frames.length === 7 && SB.celdas.length === 7, 'sin base: 7 frames y 7 celdas');
    const SC = T.sumaCola(3), fc = T.plegarCeldas({ st: { r: 'vivo' }, val: { r: '?' } }, SC.frames);
    ok(SC.resultado === 6 && fc.val.r === 6 && SC.celdas.length === 3, 'cola: resultado 6 con un solo marco (n, acc)');
    igual(SC.frames.slice(1, 4).map(f => [f.val.n, f.val.acc]), [[2, 3], [1, 5], [0, 6]], 'cola: (n, acc) = (2,3), (1,5), (0,6)');
  }

  // ── Teorema maestro ──
  seccion('Teorema maestro');
  const mm = (a, b, c) => T.maestro(a, b, c);
  igual([mm(2, 2, 1).res, mm(2, 2, 1).caso], ['Θ(n log n)', 2], 'mergesort');
  igual([mm(1, 2, 0).res, mm(1, 2, 0).caso], ['Θ(log n)', 2], 'búsqueda binaria');
  igual([mm(4, 2, 1).res, mm(4, 2, 1).caso], ['Θ(n²)', 1], 'T(n) = 4T(n/2) + n');
  igual([mm(1, 2, 1).res, mm(1, 2, 1).caso], ['Θ(n)', 3], 'T(n) = T(n/2) + n');
  igual([mm(2, 2, 2).res, mm(2, 2, 2).caso], ['Θ(n²)', 3], 'T(n) = 2T(n/2) + n²');
  igual([mm(8, 2, 3).res, mm(8, 2, 3).caso], ['Θ(n³ log n)', 2], 'a = 8, b = 2, c = 3');
  igual([mm(3, 2, 1).res, mm(3, 2, 1).cmp], ['Θ(n^1,58)', '<'], 'a = 3, b = 2 (Karatsuba): exponente log₂3');
  igual([mm(1, 3, 0).res, mm(8, 4, 1).res], ['Θ(log n)', 'Θ(n^1,50)'], 'log_b a no entero');
  for (let a = 1; a <= 8; a++) for (let b = 2; b <= 6; b++) for (let c = 0; c <= 4; c++) {
    const r = mm(a, b, c);
    ok([1, 2, 3].includes(r.caso) && r.res.startsWith('Θ(') && Number.isFinite(r.lg), `maestro(${a},${b},${c}) válido`);
    ok((r.caso === 1) === (c < r.lg - 1e-9) && (r.caso === 3) === (c > r.lg + 1e-9), `maestro(${a},${b},${c}): caso coherente`);
  }

  // ── Duraciones ──
  seccion('Duraciones');
  const dur = (id, n, vel = 9) => T.duracion(T.OPS[id](n) / 10 ** vel);
  igual(dur('n', 1e6), '1 ms', 'O(n) con n = 10⁶');
  igual(dur('nlogn', 1e6), '19,9 ms', 'O(n log n) con n = 10⁶');
  igual(dur('n2', 1e6), '16,7 min', 'O(n²) con n = 10⁶: minutos');
  igual(dur('n', 1e9), '1 s', 'O(n) con n = 10⁹');
  igual(dur('n2', 1e9), '31,7 años', 'O(n²) con n = 10⁹: años');
  igual(dur('log', 1e9), '29,9 ns', 'O(log n) con n = 10⁹');
  igual(dur('n2', 1e6, 8), '2,78 h', 'O(n²) con n = 10⁶ a 10⁸ op/s');
  ok(/años$/.test(dur('exp', 1000)) && /e\d+/.test(dur('exp', 1000)), 'O(2ⁿ) con n = 1000: exponente enorme en años');
  igual(dur('exp', 1e4), '∞', 'O(2ⁿ) con n = 10⁴ no cabe: ∞');
  igual(T.duracion(0.5), '500 ms', '0,5 s');
  igual(T.duracion(90), '1,5 min', '90 s');
  igual(T.duracion(4 * 86400), '4 días', '4 días');
  globalThis.document = { documentElement: { lang: 'en' } };
  igual(T.duracion(1e18 / 1e9), '31.7 years', 'inglés: years y punto decimal');
  igual(T.maestro(3, 2, 1).res, 'Θ(n^1.58)', 'inglés: n^1.58');
  igual(T.fmt2(1.585), '1.58', 'fmt2 en inglés');
  delete globalThis.document;
  igual(T.fmt2(1.585), '1,58', 'fmt2 en español');

  // ── Niveles y cadenas ──
  seccion('Niveles y cadenas');
  ok(T.TM.nodos.length === 15 && T.nivelIds(3).length === 8, 'árbol por niveles: 15 nodos, 8 en el último nivel');
  const fn = T.framesNiveles();
  ok(fn.length === 5 && fn.every(f => f.es && f.en), 'trazas de niveles: 5 frames con es/en');
  const cad = T.cadena(['n', 'n-1', '…'], ['a', 'b', 'c'].map(t => ({ es: t, en: t })), i => ['x' + i, 'y' + i], { etiqueta: 'e', es: 'fin', en: 'end' });
  ok(cad.frames.length === 3 && cad.abre.cabida.niveles === 3 && cad.abre.notas.length === 1 && cad.completo.notas.length === 3, 'cadena: frames, cabida y notas');

  // ── La guía entera: estructura, textos y plegado ──
  seccion('Guía completa');
  const pasos = congelar(guia.pasos);
  const secs = pasos.filter(p => p.sec).length, nq = pasos.filter(p => p.pregunta).length, nj = pasos.filter(p => p.jugar).length, nt = pasos.filter(p => p.traza).length;
  ok(pasos.length >= 34 && pasos.length <= 44, `34–44 pasos (hay ${pasos.length})`);
  ok(secs === 5, `5 secciones (hay ${secs})`);
  ok(nq >= 3 && nj >= 2 && nt >= 3, `≥3 preguntas, ≥2 interactivos, ≥3 trazas (${nq}, ${nj}, ${nt})`);
  ok(guia.titulo.es === 'Recursión y complejidad' && guia.titulo.en === 'Recursion and complexity', 'título bilingüe');
  const textos = [];
  const recoger = (x, donde) => { if (typeof x === 'string') textos.push([donde, x]); else if (Array.isArray(x)) x.forEach(y => recoger(y, donde)); else if (x && typeof x === 'object') Object.values(x).forEach(y => recoger(y, donde)); };
  pasos.forEach((p, i) => { recoger(p.es, `paso ${i + 1} es`); recoger(p.en, `paso ${i + 1} en`); recoger(p.pregunta, `paso ${i + 1} pregunta`); (p.traza || []).forEach((f, k) => { recoger(f.es, `paso ${i + 1} frame ${k + 1} es`); recoger(f.en, `paso ${i + 1} frame ${k + 1} en`); }); });
  for (const [d, t] of textos) {
    ok(!/[\f\b\t\v\r]/.test(t), `${d}: carácter de control (¿falta duplicar \\ en LaTeX?)`);
    ok(!/[\u{1F300}-\u{1FAFF}✅❌]/u.test(t), `${d}: emoji`);
    ok(!/!/.test(t.replace(/`[^`]*`/g, '').replace(/\$[^$]*\$/g, '')), `${d}: exclamación`);
    ok((t.replace(/`[^`]*`/g, '').replace(/\$[^$]*\$/g, '').match(/\*/g) || []).length % 2 === 0, `${d}: asteriscos sin cerrar`);
  }
  ok(pasos.filter(p => p.es.length > 420 || p.en.length > 420).length === 0, 'textos de paso ≤ 420 caracteres');
  // subtítulos de frame cortos (≤ 140)
  for (const [d, t] of textos) if (/frame/.test(d)) ok(t.length <= 140, `${d}: subtítulo largo (${t.length})`);
  for (const p of pasos) for (const f of p.traza || []) ok((p.traza.length <= 120), `traza ≤ 120 frames (${p.traza.length})`);

  // Plegado paso a paso con las escenas reales (arbol y grafica) y con el plegado de celdas
  const MODS = { arbol: A, grafica: G };
  let tipo = null, S = null, celdas = null, pasoNum = 0, tiposVistos = new Set(), nodos9 = false;
  const arbolOk = (s, d) => {
    const ids = new Set(s.nodos.map(n => n.id));
    for (const k of Object.keys(s.est)) ok(ids.has(k), `${d}: est de nodo inexistente «${k}»`);
    for (const k of Object.keys(s.etiquetas)) ok(ids.has(k), `${d}: etiqueta de nodo inexistente «${k}»`);
    for (const e of s.aristas) ok(ids.has(e.a) && ids.has(e.b), `${d}: arista huérfana ${e.a}-${e.b}`);
  };
  const lecturasOk = (filas, d) => { ok(Array.isArray(filas) && filas.length > 0, `${d}: lecturas`); for (const f of filas) ok(f.valor !== undefined && !/NaN|undefined/.test(String(f.valor)), `${d}: lectura «${f.expr}» = ${f.valor}`); };
  for (const p of pasos) {
    pasoNum++;
    const d = `paso ${pasoNum}`;
    const nuevo = p.celdas ? 'celdas' : Object.keys(MODS).find(k => p[k] !== undefined);
    if (nuevo === 'celdas') { tipo = 'celdas'; celdas = T.plegarCeldas({ st: {}, val: {} }, [p]); S = celdas; }
    else if (nuevo) { tipo = nuevo; S = MODS[nuevo].plegar(undefined, p); }
    else if (tipo === 'celdas') { celdas = T.plegarCeldas(celdas, [p]); S = celdas; }
    else S = MODS[tipo].plegar(S, p);
    tiposVistos.add(tipo);
    if (tipo === 'arbol') { arbolOk(S, d); if (S.nodos.length === 9 && p['-nodos']) nodos9 = true; }
    if (p.traza) {
      let s = S;
      p.traza.forEach((f, k) => {
        if (tipo === 'celdas') s = T.plegarCeldas(s, [f]); else s = MODS[tipo].plegar(s, f);
        if (tipo === 'arbol') arbolOk(s, `${d} frame ${k + 1}`);
      });
      // los frames NO persisten: el estado del paso siguiente parte de S, no de `s`
    }
    if (p.jugar) {
      const J = p.jugar, mod = MODS[tipo];
      ok(mod && mod.vista, `${d}: jugar sobre una escena con vista`);
      if (mod) {
        const v = mod.vista(S), cx = mod.ctx ? mod.ctx(S) : {};
        for (let r = 0; r < 14; r++) for (const b of J.botones) {
          if (!(b.off && b.off(v, cx))) b.hacer(v, cx);
          lecturasOk(J.lecturas(v, cx), `${d} «${typeof b.label === 'object' ? b.label.es : b.label}»`);
          if (J.hl) J.hl(v, cx);
          mod.conVista(S, v);
        }
        if (J.soltar && tipo === 'grafica') { J.soltar(v, S.nmax, undefined, cx); J.soltar(v, 0, undefined, cx); lecturasOk(J.lecturas(v, cx), `${d} soltar`); }
        // en inglés también
        globalThis.document = { documentElement: { lang: 'en' } };
        const w = mod.vista(S), cy = mod.ctx ? mod.ctx(S) : {};
        for (const b of J.botones) { if (!(b.off && b.off(w, cy))) b.hacer(w, cy); lecturasOk(J.lecturas(w, cy), `${d} (en)`); }
        delete globalThis.document;
      }
    }
  }
  ok(nodos9, 'tras la poda de la memoización quedan 9 nodos en el paso de restauración');
  ok(tiposVistos.has('celdas') && tiposVistos.has('arbol') && tiposVistos.has('grafica'), 'la guía usa celdas, arbol y grafica');

  // Estado tras la traza de fib(5): el paso siguiente restaura el árbol completo (15 nodos) con el parche
  const iFib = pasos.findIndex(p => p.arbol && p.traza && p.code && /fib/.test(String(p.code)));
  let sf = A.plegar(undefined, pasos[iFib]); sf = A.plegar(sf, pasos[iFib + 1]);
  ok(sf.nodos.length === 15, `paso ${iFib + 2}: restaura los 15 nodos de fib(5)`);
  const iH = pasos.findIndex(p => p.arbol && p.arbol.nodos[0]?.val === 'hanoi(3)');
  let sh = A.plegar(undefined, pasos[iH]); sh = A.plegar(sh, pasos[iH + 2]);
  ok(sh.nodos.length === 7 && Object.keys(sh.etiquetas).length === 7, 'hanoi(3): 7 nodos y 7 movimientos etiquetados tras restaurar');

  console.log(`${fallos ? '✗' : '✓'} test-recursion: ${total - fallos}/${total} comprobaciones`);
  process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.log('✗ excepción: ' + (e.stack || e)); process.exitCode = 1; });
