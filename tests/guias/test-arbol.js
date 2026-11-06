#!/usr/bin/env node
'use strict';
/**
 * Pruebas de la lógica pura de la escena «arbol» (assets/guias/arbol.js) sin navegador:
 *   node tests/guias/test-arbol.js        (código de salida 0 = todo correcto)
 * Comprueba plegar (pura), diseño (sin solapes ni cruces, también en árboles completos y degenerados), helpers de
 * ABB/montículo y que la guía demo se pliega entera (pasos, frames de traza y botones de `jugar`).
 */
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..', '..', 'assets', 'guias');
let fallos = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { fallos++; console.log('  ✗ ' + m); } };
const igual = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const seccion = n => console.log(n);
const congelar = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(congelar); } return o; };
// Segmentos que se cruzan en su interior (no cuenta compartir un extremo)
const cruzan = (p, q, r, s) => {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return o(p, q, r) * o(p, q, s) < 0 && o(r, s, p) * o(r, s, q) < 0;
};

(async () => {
  const A = await import(pathToFileURL(path.join(RAIZ, 'arbol.js')).href); // sin DOM: debe poder importarse
  const { plegar, disenar, trazar, arbolVacio, insertarABB, borrarABB, buscarABB, arbolDeArray, arbolCompleto, recorrido, altura, camino, cabidaDe, cabidaMax, ctx, vista, conVista } = A;
  const r = 18, minDist = 2 * r;

  /** Comprueba que ningún par de nodos solapa y que ninguna arista cruza a otra; devuelve la distancia mínima. */
  const sinSolapes = (T, nombre, o = { r }) => {
    const pos = disenar(T.nodos, T.aristas, 'arbol', o), ids = T.nodos.map(n => n.id);
    let min = Infinity;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) min = Math.min(min, Math.hypot(pos[ids[i]].x - pos[ids[j]].x, pos[ids[i]].y - pos[ids[j]].y));
    ok(min >= minDist, `${nombre}: nodos solapados (distancia mínima ${min.toFixed(1)} < ${minDist})`);
    const seg = T.aristas.map(e => [pos[e.a], pos[e.b], e]);
    let cruces = 0;
    for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) if (cruzan(seg[i][0], seg[i][1], seg[j][0], seg[j][1])) cruces++;
    ok(cruces === 0, `${nombre}: ${cruces} aristas se cruzan`);
    ok(ids.every(i => Number.isFinite(pos[i].x) && Number.isFinite(pos[i].y)), `${nombre}: posiciones no finitas`);
    return min;
  };

  seccion('plegar es pura');
  {
    const base = { nodos: [{ id: 'a', val: 1 }, { id: 'b', val: 2 }], aristas: [{ a: 'a', b: 'b', lado: 'i' }], notas: [{ nivel: 0, texto: 'x' }], cabida: { niveles: 3, hojas: 4 } };
    const s0 = congelar(plegar(undefined, { arbol: base }));
    const p = congelar({ '+nodos': [{ id: 'c', val: 3 }], '+aristas': [{ a: 'a', b: 'c', lado: 'd' }], val: { a: 9 }, etiquetas: { c: 'h=0' }, est: { a: 'activo', c: 'ok' }, aristaEst: { 'a-c': 'camino' }, notas: null });
    const s1 = plegar(s0, p); // si mutara algo congelado, lanzaría (módulo estricto)
    igual(s0.nodos.map(n => n.id), ['a', 'b'], 'el estado previo no cambia (nodos)');
    igual(s0.est, {}, 'el estado previo no cambia (est)');
    igual(s1.nodos.map(n => n.id), ['a', 'b', 'c'], '+nodos');
    igual(s1.aristas.length, 2, '+aristas');
    igual(s1.val.a, 9, 'val');
    igual(s1.etiquetas, { c: 'h=0' }, 'etiquetas');
    igual(s1.est, { a: 'activo', c: 'ok' }, 'est');
    igual(s1.notas, [], 'notas:null vacía');
    igual(s0.notas.length, 1, 'notas previas intactas');
    ok(s1.def === s0.def && s1.def === base, 'def estable (identidad) mientras no se abre otra escena');
    ok(plegar(undefined, { arbol: base }).def === base, 'def = p.arbol: fijar() no reconstruye entre pasos');
    const s2 = plegar(s1, { est: { a: null }, etiquetas: { c: null }, aristaEst: null });
    igual(s2.est, { c: 'ok' }, 'est:{id:null} quita uno');
    igual(s2.etiquetas, {}, 'etiquetas:{id:null} quita una');
    igual(s2.aristaEst, {}, 'aristaEst:null limpia');
    igual(plegar(s1, { est: null }).est, {}, 'est:null limpia todo');
    // sustituir nodo/arista existentes
    const s3 = plegar(s1, { '+nodos': [{ id: 'b', val: 'B' }], '+aristas': [{ a: 'a', b: 'b', lado: 'i', peso: 5 }] });
    igual([s3.nodos.length, s3.val.b, s3.aristas.find(e => e.b === 'b').peso], [3, 'B', 5], 'id/arista existente se sustituyen');
  }

  seccion('quitar nodos quita sus aristas');
  {
    const base = arbolCompleto(3), s0 = congelar(plegar(undefined, { arbol: { nodos: base.nodos, aristas: base.aristas, raiz: base.raiz } }));
    const s = plegar(plegar(s0, { est: { m1: 'ok', m3: 'ok' }, etiquetas: { m1: 'x' }, aristaEst: { 'm0-m1': 'camino', 'm1-m3': 'camino', 'm0-m2': 'camino' } }), { '-nodos': ['m1'] });
    igual(s.nodos.length, 6, '-nodos quita el nodo');
    ok(!s.aristas.some(e => e.a === 'm1' || e.b === 'm1'), 'sin aristas colgando de m1');
    igual(s.aristas.length, 3, 'quedan 3 aristas (de 6, -3 de m1: padre y dos hijos)');
    igual(Object.keys(s.est), ['m3'], 'est de m1 se va con él');
    igual(Object.keys(s.aristaEst), ['m0-m2'], 'aristaEst de sus aristas se va con ellas');
    igual(s.etiquetas, {}, 'etiquetas de m1 se van');
    const t = plegar(s0, { '-aristas': ['m0-m1'] });
    igual([t.nodos.length, t.aristas.length], [7, 5], '-aristas solo quita la arista');
  }

  seccion('diseño: sin solapes ni cruces');
  {
    const c5 = arbolCompleto(5);
    igual(c5.nodos.length, 31, 'árbol completo de 5 niveles = 31 nodos');
    const m5 = sinSolapes(c5, 'completo 5 niveles');
    const t5 = trazar(c5.nodos, c5.aristas, 'arbol', { r });
    igual([t5.niveles, t5.hojas], [5, 16], 'niveles/hojas del completo de 5');
    ok(t5.ancho === 15, `compacto: 16 hojas pegadas (ancho ${t5.ancho} ranuras)`);
    // padre centrado sobre sus hijos
    const pos = t5.pos;
    ok(c5.nodos.every(n => { const h = c5.aristas.filter(e => e.a === n.id); return !h.length || Math.abs(pos[n.id].x - (pos[h[0].b].x + pos[h[1].b].x) / 2) < 1e-9; }), 'padre centrado sobre sus dos hijos');
    ok(c5.aristas.every(e => pos[e.b].y > pos[e.a].y), 'los hijos están más abajo que su padre');
    ok(c5.aristas.every(e => (e.lado === 'i') === (pos[e.b].x < pos[e.a].x)), 'lado i a la izquierda, d a la derecha');

    let deg = arbolVacio();
    for (let v = 1; v <= 12; v++) deg = insertarABB(deg, v).arbol;
    igual(altura(deg), 11, 'degenerado de 12: altura 11');
    sinSolapes(deg, 'degenerado de 12');
    const u = deg.nodos.map(n => n.id), pd = disenar(deg.nodos, deg.aristas, 'arbol', { r });
    ok(u.every((id, i) => !i || (pd[id].y > pd[u[i - 1]].y && pd[id].x > pd[u[i - 1]].x)), 'degenerado: diagonal descendente hacia la derecha');
    let izq = arbolVacio();
    for (let v = 12; v >= 1; v--) izq = insertarABB(izq, v).arbol;
    sinSolapes(izq, 'degenerado a la izquierda');

    // n-arios y bosque
    const nario = { nodos: ['r', 'a', 'b', 'c', 'a1', 'a2', 'c1', 'c2', 'c3'].map(id => ({ id, val: id })), aristas: [['r', 'a'], ['r', 'b'], ['r', 'c'], ['a', 'a1'], ['a', 'a2'], ['c', 'c1'], ['c', 'c2'], ['c', 'c3']].map(([a, b]) => ({ a, b })) };
    sinSolapes(nario, 'n-ario');
    const bosque = { nodos: ['p', 'q', 'p1', 'q1', 'q2'].map(id => ({ id, val: id })), aristas: [{ a: 'p', b: 'p1' }, { a: 'q', b: 'q1' }, { a: 'q', b: 'q2' }] };
    sinSolapes(bosque, 'bosque de 2 árboles');
    // aleatorios (generador determinista)
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let k = 0; k < 40; k++) {
      let T = arbolVacio();
      for (let i = 0, n = 1 + Math.floor(rnd() * 30); i < n; i++) T = insertarABB(T, Math.floor(rnd() * 99)).arbol;
      sinSolapes(T, `ABB aleatorio #${k}`);
    }
    // cabe en la caja reservada y no se sale aunque haya que comprimir
    const med = trazar(c5.nodos, c5.aristas, 'arbol', { r, W: 300, H: 200 });
    ok(Object.values(med.pos).every(p => p.x >= 0 && p.x <= 300 && p.y >= 0 && p.y <= 200), 'con W/H pequeños todo queda dentro de la caja');
    // modo libre
    const lib = disenar([{ id: 'a', val: 1, x: 0, y: 0 }, { id: 'b', val: 2, x: 1, y: 1 }, { id: 'c', val: 3, x: 200, y: 100 }], [], 'libre', { r, W: 640, H: 400 });
    ok(lib.a.x < lib.b.x && lib.a.y < lib.b.y && lib.b.x < 640 && lib.c.x === 200 && lib.c.y === 100, 'modo libre: 0..1 relativo, >1 px');
  }

  seccion('insertarABB / buscarABB / borrarABB mantienen el orden');
  {
    let T = arbolVacio();
    const orden = [8, 4, 12, 2, 6, 10, 14, 5, 7, 4, 13];
    for (const v of orden) {
      const antes = JSON.stringify(T), res = insertarABB(T, v);
      ok(JSON.stringify(T) === antes, `insertarABB(${v}) no muta la entrada`);
      if (v === 4 && T.nodos.length > 8) ok(res.repetido && res.arista === null, 'duplicado: no inserta');
      T = res.arbol;
    }
    igual(T.nodos.length, 10, '10 valores distintos');
    const ordenado = recorrido(T, 'in').map(id => T.nodos.find(n => n.id === id).val);
    igual(ordenado, [2, 4, 5, 6, 7, 8, 10, 12, 13, 14], 'in-orden = ordenado');
    igual(recorrido(T, 'pre').slice(0, 3).map(id => T.nodos.find(n => n.id === id).val), [8, 4, 2], 'pre-orden');
    igual(recorrido(T, 'niveles').slice(0, 4).map(id => T.nodos.find(n => n.id === id).val), [8, 4, 12, 2], 'por niveles');
    igual(recorrido(T, 'post').at(-1), 'n8', 'post-orden acaba en la raíz');
    const b = buscarABB(T, 7);
    igual([b.encontrado, b.camino], [true, ['n8', 'n4', 'n6', 'n7']], 'buscar 7');
    igual(buscarABB(T, 11).encontrado, false, 'buscar 11 no está');
    igual(buscarABB(T, 11).camino, ['n8', 'n12', 'n10'], 'camino de la búsqueda fallida');
    igual(camino(T, 'n7'), ['n8', 'n4', 'n6', 'n7'], 'camino(T,id)');
    igual(altura(T), 3, 'altura');
    const ins = insertarABB(T, 11);
    igual([ins.arista.a, ins.arista.lado, ins.camino], ['n10', 'd', ['n8', 'n12', 'n10']], 'inserta 11 como hijo derecho de 10');
    igual(Object.keys(ins.parche), ['+nodos', '+aristas'], 'parche listo para frame');

    // Borrar: hoja (2), un hijo (6 tras quitar 5 y 7... ), dos hijos (4, raíz)
    const vals = U => recorrido(U, 'in').map(id => U.nodos.find(n => n.id === id).val);
    const valida = (U, esperado, m) => {
      igual(vals(U), esperado, m);
      ok(U.aristas.every(e => U.nodos.some(n => n.id === e.a) && U.nodos.some(n => n.id === e.b)), `${m}: sin aristas huérfanas`);
      ok(U.nodos.length - 1 === U.aristas.length, `${m}: n-1 aristas`);
    };
    const d1 = borrarABB(T, 2); igual(d1.caso, 0, 'borrar hoja'); valida(d1.arbol, [4, 5, 6, 7, 8, 10, 12, 13, 14], 'tras borrar 2');
    const d2 = borrarABB(d1.arbol, 5); valida(d2.arbol, [4, 6, 7, 8, 10, 12, 13, 14], 'tras borrar 5'); igual(d2.caso, 0, 'borrar hoja 5');
    const d3 = borrarABB(d2.arbol, 4); igual(d3.caso, 1, 'borrar con un hijo'); valida(d3.arbol, [6, 7, 8, 10, 12, 13, 14], 'tras borrar 4 (un hijo)');
    const d4 = borrarABB(T, 4); igual([d4.caso, d4.sucesor, d4.caminoSucesor], [2, 'n5', ['n6', 'n5']], 'borrar con dos hijos usa el sucesor');
    valida(d4.arbol, [2, 5, 6, 7, 8, 10, 12, 13, 14], 'tras borrar 4 (dos hijos)');
    igual(d4.arbol.nodos.find(n => n.id === 'n4').val, 5, 'el nodo conserva el id y toma el valor del sucesor');
    const d5 = borrarABB(T, 8); valida(d5.arbol, [2, 4, 5, 6, 7, 10, 12, 13, 14], 'tras borrar la raíz (dos hijos)');
    let U = T;
    const todos = [8, 12, 4, 14, 2, 10, 6, 13, 5, 7];
    todos.forEach((v, i) => {
      const d = borrarABB(U, v); ok(d.encontrado, `borrar ${v}`); U = d.arbol;
      igual(vals(U), vals(T).filter(x => !todos.slice(0, i + 1).includes(x)), `orden tras borrar ${v}`);
    });
    igual(U.nodos.length, 0, 'se vacía');
    // borrar raíz con un hijo
    let R1 = arbolVacio(); for (const v of [5, 3]) R1 = insertarABB(R1, v).arbol;
    const d6 = borrarABB(R1, 5); ok(d6.arbol.raiz === 'n3' && d6.arbol.nodos.length === 1, 'borrar raíz con un hijo: el hijo es la nueva raíz');
    igual(borrarABB(T, 99).encontrado, false, 'borrar ausente');
    // el parche, aplicado con plegar, da el mismo árbol que devuelve el helper
    let S = plegar(undefined, { arbol: { nodos: T.nodos, aristas: T.aristas, raiz: T.raiz } });
    S = plegar(S, d4.parche);
    igual(S.nodos.map(n => [n.id, S.val[n.id]]).sort(), d4.arbol.nodos.map(n => [n.id, n.val]).sort(), 'plegar(parche) = arbol del helper (nodos y valores)');
    igual(S.aristas.map(e => e.a + e.b + e.lado).sort(), d4.arbol.aristas.map(e => e.a + e.b + e.lado).sort(), 'plegar(parche) = arbol del helper (aristas)');
  }

  seccion('montículo, cabida y ctx');
  {
    const h = arbolDeArray([1, 3, 2, 7, 4, 5, 9]);
    igual([h.nodos.length, h.aristas.length, h.raiz], [7, 6, 'h0'], 'arbolDeArray');
    igual(recorrido(h, 'niveles').map(id => h.nodos.find(n => n.id === id).val), [1, 3, 2, 7, 4, 5, 9], 'por niveles = el array');
    igual(h.aristas.find(e => e.b === 'h4'), { a: 'h1', b: 'h4', lado: 'd' }, 'hijo derecho de h1 = h4');
    sinSolapes(arbolDeArray(Array.from({ length: 15 }, (_, i) => i)), 'montículo de 15');
    igual(cabidaDe(arbolCompleto(4)), { niveles: 4, hojas: 8, ancho: 7 }, 'cabidaDe(completo 4)');
    let deg = arbolVacio(); for (let v = 1; v <= 7; v++) deg = insertarABB(deg, v).arbol;
    igual(cabidaMax(arbolCompleto(3), deg), { niveles: 7, hojas: 4, ancho: 3 }, 'cabidaMax');
    const S = plegar(undefined, { arbol: { nodos: h.nodos, aristas: h.aristas, raiz: h.raiz } }), c = ctx(S);
    igual([c.altura(), c.camino('h4'), c.padre('h4'), c.hijos('h1'), c.nivel('h6'), c.hojas().length], [2, ['h0', 'h1', 'h4'], 'h1', ['h3', 'h4'], 2, 4], 'ctx');
    const v = vista(S); v.est.h0 = 'activo'; v.val.h0 = 99;
    igual([S.est.h0, S.val.h0, conVista(S, v).est.h0, conVista(S, v).nodos === S.nodos], [undefined, 1, 'activo', true], 'vista es una copia; conVista la devuelve a estado pintable');
    sinSolapes({ nodos: [], aristas: [] }, 'vacío');
  }

  seccion('guía demo: se pliega entera');
  {
    const G = (await import(pathToFileURL(path.join(RAIZ, 'data', 'demo-arbol.js')).href)).default;
    let frames = 0, jugadas = 0;
    // Estado por paso exactamente como lo hace guia.js (plegar 0..k, sin los frames)
    let est = null;
    for (const [i, p] of G.pasos.entries()) {
      frames += (p.traza || []).length;
      est = p.arbol ? plegar(undefined, p) : plegar(est, p);
      ok(est.nodos.every(n => n.id in est.val), `paso ${i + 1}: todos los nodos tienen val`);
      ok(est.aristas.every(e => est.nodos.some(n => n.id === e.a) && est.nodos.some(n => n.id === e.b)), `paso ${i + 1}: aristas entre nodos existentes`);
      if (p.arbol && p.arbol.modo !== 'libre') sinSolapes(est, `demo paso ${i + 1} (apertura)`, { r: 16 });
      if (p.traza) {
        let f = est;
        p.traza.forEach((fr, k) => {
          f = plegar(f, fr);
          ok(f.nodos.every(n => n.id in f.val) && f.aristas.every(e => f.nodos.some(n => n.id === e.a) && f.nodos.some(n => n.id === e.b)), `paso ${i + 1} frame ${k + 1}: estructura coherente`);
        });
      }
      if (p.jugar) {
        const v = vista(est), cx = ctx(est);
        for (let k = 0; k < 40; k++) for (const b of p.jugar.botones) { if (!(b.off && b.off(v, cx))) { b.hacer(v, cx); jugadas++; } p.jugar.lecturas(v, cx); p.jugar.hl?.(v, cx); }
        if (p.jugar.arrastrables) p.jugar.soltar?.(v, est.nodos[0].id, 10, cx);
      }
    }
    ok(frames > 40, `la demo trae trazas generadas (${frames} frames)`);
    ok(jugadas > 0, 'los botones de jugar se ejecutan sin errores');
  }

  // ── Tooltip: describirNodo (pura) ──
  {
    const B = A.arbolCompleto(3, (nv, i) => 'v' + nv + i), s = plegar(undefined, { arbol: { nodos: B.nodos, aristas: B.aristas, raiz: B.raiz } });
    const n1 = A.describirNodo({ ...s, est: { m1: 'ok' }, etiquetas: { m1: 'h=1' } }, 'm1', 'arbol');
    igual([n1.id, n1.val, n1.etiqueta, n1.est, n1.nivel], ['m1', 'v10', 'h=1', 'ok', 1], 'describirNodo: nodo interno');
    igual([n1.padre.id, n1.hijos.map(h => h.id), n1.hijos.map(h => h.lado)], ['m0', ['m3', 'm4'], ['i', 'd']], 'describirNodo: padre e hijos con su lado');
    const r = A.describirNodo(s, 'm0', 'arbol'); ok(r.padre === null && r.nivel === 0 && r.hijos.length === 2, 'describirNodo: raíz sin padre, nivel 0');
    igual(A.describirNodo({ ...s }, 'm0', 'arbol', { m0: 'c' }).est, 'mal', 'describirNodo: hl a/b/c → activo/ok/mal');
    ok(A.describirNodo(s, 'no-existe', 'arbol') === null, 'describirNodo: id desconocido → null');
    const G = plegar(undefined, { arbol: { modo: 'libre', nodos: [{ id: 'a', val: 0, x: .2, y: .2 }, { id: 'b', val: 1, x: .8, y: .2 }, { id: 'c', val: 2, x: .5, y: .8 }], aristas: [{ a: 'a', b: 'b', peso: 4, dir: true }, { a: 'c', b: 'a', peso: 7 }] } });
    const g = A.describirNodo(G, 'a', 'libre');
    igual(g.vecinos.map(v => [v.id, v.peso, v.dir]), [['b', '4', 'sale'], ['c', '7', null]], 'describirNodo (grafo): vecinos con peso y sentido');
    ok(g.nivel === null && g.padre === null && g.hijos.length === 0, 'describirNodo (grafo): sin nivel ni jerarquía');
    const ciclo = plegar(undefined, { arbol: { nodos: [{ id: 'x', val: 1 }, { id: 'y', val: 2 }], aristas: [{ a: 'x', b: 'y' }, { a: 'y', b: 'x' }] } });
    ok(Number.isInteger(A.describirNodo(ciclo, 'x', 'arbol').nivel), 'describirNodo: un ciclo no cuelga el cálculo del nivel');
    for (const k of ['activo', 'visitado', 'camino', 'ok', 'mal']) ok(A.NOMBRE_EST[k].es && A.NOMBRE_EST[k].en, 'NOMBRE_EST.' + k);
  }

  console.log(`${fallos ? '✗' : '✓'} test-arbol: ${total - fallos}/${total} comprobaciones`);
  process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.log('✗ test-arbol: ' + (e.stack || e)); process.exitCode = 1; });
