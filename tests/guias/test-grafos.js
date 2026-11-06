#!/usr/bin/env node
'use strict';
/**
 * Pruebas de la guía «Grafos» sin navegador:
 *   node tests/guias/test-grafos.js        (código de salida 0 = todo correcto)
 * Comprueba los generadores de trazas (assets/guias/data/grafos-traza.js) contra implementaciones de referencia escritas
 * aparte: distancias de BFS y de Dijkstra (por Bellman-Ford), orden topológico válido y ciclo detectado, tiempos de DFS
 * anidados, componentes, MST de Kruskal comparado por fuerza bruta (grafos pequeños aleatorios incluidos), la matriz y la
 * lista de adyacencia. Pliega los frames con las escenas reales (arbol, tabla) y ejecuta los botones, clics y lecturas de
 * todos los bloques `jugar` en es y en en (el validador común solo ejecuta los de `celdas`).
 */
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..', '..', 'assets', 'guias');
let fallos = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { fallos++; console.log('  ✗ ' + m); } };
const igual = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const seccion = n => console.log(n);
// Generador pseudoaleatorio con semilla (mulberry32): las pruebas son reproducibles.
const rng = semilla => () => { semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

(async () => {
  const imp = f => import(pathToFileURL(path.join(RAIZ, f)).href);
  const A = await imp('arbol.js'), TB = await imp('tabla.js'), T = await imp('data/grafos-traza.js'), G = (await imp('data/grafos.js')).default;
  const { vid } = T;
  const INF = Infinity;

  // ── Referencias independientes ──────────────────────────────────────────────────────────────────────────────
  /** Distancias por Bellman-Ford (peso 1 si no hay peso): sirve de referencia para BFS y para Dijkstra. */
  const bellman = (g, s, unit) => {
    const d = Array(g.n).fill(INF); d[s] = 0;
    for (let i = 0; i < g.n; i++) for (const [a, b, w0] of g.E) {
      const w = unit ? 1 : w0;
      if (d[a] + w < d[b]) d[b] = d[a] + w;
      if (!g.dir && d[b] + w < d[a]) d[a] = d[b] + w;
    }
    return d;
  };
  const componentes = g => {
    const p = Array.from({ length: g.n }, (_, i) => i), f = x => (p[x] === x ? x : (p[x] = f(p[x])));
    for (const [a, b] of g.E) p[f(a)] = f(b);
    return { k: new Set(Array.from({ length: g.n }, (_, i) => f(i))).size, rep: Array.from({ length: g.n }, (_, i) => f(i)) };
  };
  const esOrdenValido = (g, orden) => orden.length === g.n && new Set(orden).size === g.n && g.E.every(([a, b]) => orden.indexOf(a) < orden.indexOf(b));
  /** ¿Hay un ciclo dirigido? (3 colores, otra implementación) */
  const hayCicloDir = g => {
    const col = Array(g.n).fill(0), ad = Array.from({ length: g.n }, () => []);
    for (const [a, b] of g.E) ad[a].push(b);
    const rec = u => { col[u] = 1; for (const v of ad[u]) if (col[v] === 1 || (col[v] === 0 && rec(v))) return true; col[u] = 2; return false; };
    return Array.from({ length: g.n }, (_, u) => u).some(u => col[u] === 0 && rec(u));
  };
  /** MST por fuerza bruta: el subconjunto de n-1 aristas que conecta y pesa menos. */
  const mstBruto = g => {
    let mejor = INF;
    const m = g.E.length, n = g.n;
    const sub = (i, elegidas) => {
      if (elegidas.length === n - 1) {
        if (componentes({ n, E: elegidas }).k === 1) mejor = Math.min(mejor, elegidas.reduce((s, e) => s + e[2], 0));
        return;
      }
      if (i === m || elegidas.length + (m - i) < n - 1) return;
      sub(i + 1, [...elegidas, g.E[i]]);
      sub(i + 1, elegidas);
    };
    sub(0, []);
    return mejor;
  };
  const aleatorio = (r, n, p, { dir, pesos } = {}) => {
    const E = [];
    for (let a = 0; a < n; a++) for (let b = dir ? 0 : a + 1; b < n; b++) if (a !== b && r() < p) E.push(pesos ? [a, b, 1 + Math.floor(r() * 9)] : [a, b]);
    return { n, pos: [], E, ...(dir && { dir: true }) };
  };
  const plegarTodo = (S, frames) => frames.reduce((s, f) => A.plegar(s, f), S);
  const abreArbol = g => A.plegar(undefined, { arbol: T.abre(g) });
  const L = (x, lang) => (x && typeof x === 'object' ? x[lang] : x) ?? '';

  seccion('representación: lema del apretón de manos, matriz y lista');
  {
    const g = T.G_INTRO, m = T.matriz(g), l = T.ady(g);
    const grados = m.map(f => f.reduce((s, x) => s + x, 0));
    igual(grados, [2, 2, 2, 3, 1], 'grados del grafo de introducción');
    ok(grados.reduce((s, x) => s + x, 0) === 2 * g.E.length, 'suma de grados = 2|E|');
    igual(l.map(x => x.length), grados, 'la longitud de cada lista es el grado');
    igual(l[3].map(x => x.v), [1, 2, 4], 'g[3] = {1, 2, 4}');
    ok(m.every((f, i) => f[i] === 0 && f.every((x, j) => x === m[j][i])), 'matriz simétrica con diagonal 0');
    const c = T.trazaConstruir(g);
    igual(c.g, l.map(x => x.map(y => y.v)), 'arista(a, b) construye la misma lista que ady');
    ok(c.entradas === 2 * g.E.length, 'dos entradas por arista');
    const f = T.trazaFila(m, 3);
    ok(f.vecinos === 3 && f.frames.length === g.n + 1, 'recorrer la fila lee las V celdas');
    const S = plegarTodo(abreArbol(g), []);
    ok(S.nodos.length === 5 && S.aristas.length === 5, 'la escena abre con 5 nodos y 5 aristas');
    // La lista construida paso a paso acaba con todas las aristas en la escena
    const fin = plegarTodo(A.plegar(undefined, { arbol: T.abre(g) }), [{ '-aristas': G.pasos[5]['-aristas'] }, ...c.frames]);
    ok(fin.aristas.length === 5, 'la traza de construcción termina con las 5 aristas');
    // Matriz grande: 100000 vértices en char = 10^10 bytes; lista dispersa mucho menor
    ok(100000 ** 2 === 1e10, 'matriz 10^5 × 10^5 = 10^10 celdas');
  }

  seccion('BFS: distancias, camino y errores');
  {
    const comp = (g, s) => {
      const r = T.trazaBFS(g, s), ref = bellman(g, s, true);
      igual(r.dist.map(x => (x === -1 ? INF : x)), ref, `BFS desde ${s}: distancias = Bellman-Ford`);
      ok(r.orden.length === r.dist.filter(x => x >= 0).length, 'cada nodo alcanzado sale una sola vez');
      // las distancias en orden de salida no decrecen
      ok(r.orden.every((u, i) => !i || r.dist[r.orden[i - 1]] <= r.dist[u]), 'salen por capas (distancia no decreciente)');
      ok(r.frames.length <= 100, `BFS: ${r.frames.length} frames`);
      return r;
    };
    for (let s = 0; s < T.G_BFS.n; s++) comp(T.G_BFS, s);
    const r = comp(T.G_BFS, 0);
    igual(r.dist, [0, 1, 1, 2, 2, 2, 3], 'distancias del grafo de la guía');
    const S = plegarTodo(abreArbol(T.G_BFS), r.frames);
    igual(Object.fromEntries(Object.entries(S.etiquetas)), Object.fromEntries(r.dist.map((d, i) => [vid(i), `$d=${d}$`])), 'las etiquetas finales son las distancias ejecutadas');
    const ruta = T.caminoDe(r.padre, 0, 6);
    ok(ruta.length - 1 === r.dist[6] && ruta[0] === 0 && ruta.at(-1) === 6, 'camino reconstruido con la longitud de dist');
    ok(ruta.every((u, i) => !i || T.G_BFS.E.some(([a, b]) => (a === ruta[i - 1] && b === u) || (b === ruta[i - 1] && a === u))), 'el camino usa aristas del grafo');
    igual(T.caminoDe([-1, -1], 0, 1), [], 'sin camino: lista vacía');
    const rnd = rng(11);
    for (let i = 0; i < 60; i++) { const g = aleatorio(rnd, 3 + Math.floor(rnd() * 5), .3); if (g.E.length) comp({ ...g, pos: Array(g.n).fill([.5, .5]) }, 0); }
    const mal = T.trazaBFSMal(T.G_BFS, 0);
    ok(mal.pops > T.G_BFS.n && mal.repetidos === mal.pops - T.G_BFS.n, `marcar al sacar: ${mal.pops} salidas para ${T.G_BFS.n} nodos`);
    ok(new Set(mal.orden).size === T.G_BFS.n, 'aun así acaba visitando todos (solo repite trabajo)');
    ok(mal.frames.length <= 100, 'BFS erróneo ≤ 100 frames');
  }

  seccion('DFS: tiempos, aristas de árbol y retroceso, componentes');
  {
    const comp = g => {
      const r = T.trazaDFS(g), c = componentes(g);
      ok(r.comp === c.k, `componentes: ${r.comp} = ${c.k}`);
      ok(r.ent.every((e, u) => e > 0 && r.sal[u] > e), 'ent < sal en todos los nodos');
      const tiempos = [...r.ent, ...r.sal].sort((a, b) => a - b);
      igual(tiempos, Array.from({ length: 2 * g.n }, (_, i) => i + 1), 'los 2V instantes son 1..2V sin repetir');
      // intervalos anidados o disjuntos (teorema del paréntesis)
      let bien = true;
      for (let u = 0; u < g.n; u++) for (let v = 0; v < g.n; v++) if (u !== v) {
        const dentro = r.ent[u] < r.ent[v] && r.sal[v] < r.sal[u], fuera = r.sal[u] < r.ent[v] || r.sal[v] < r.ent[u];
        if (!dentro && !fuera && !(r.ent[v] < r.ent[u] && r.sal[u] < r.sal[v])) bien = false;
      }
      ok(bien, 'los intervalos ent/sal se anidan o son disjuntos');
      ok(r.arbol.length === g.n - c.k, 'aristas de árbol = V - componentes');
      ok(r.ciclo === (g.E.length > g.n - c.k), 'ciclo detectado ⇔ |E| > V - componentes');
      ok(r.retroceso.length === g.E.length - (g.n - c.k), 'aristas de retroceso = |E| - (V - componentes)');
      ok(r.retroceso.every(([u, v]) => r.ent[v] < r.ent[u] && r.sal[v] > r.sal[u]), 'cada retroceso apunta a un antecesor');
      ok(r.frames.length <= 100, `DFS: ${r.frames.length} frames`);
      return r;
    };
    const r = comp(T.G_DFS);
    igual([r.comp, r.ciclo], [2, true], 'grafo de la guía: 2 componentes y ciclo');
    igual(r.retroceso, [[2, 0]], 'única arista de retroceso: 2 → 0');
    const S = plegarTodo(abreArbol(T.G_DFS), r.frames);
    igual(S.etiquetas.v0, `${r.ent[0]}/${r.sal[0]}`, 'etiqueta final de la raíz = ent/sal ejecutados');
    const rnd = rng(5);
    for (let i = 0; i < 80; i++) { const g = aleatorio(rnd, 2 + Math.floor(rnd() * 6), .25); g.pos = Array(g.n).fill([.5, .5]); if (g.E.length) comp(g); }
    // árbol puro: sin ciclo
    ok(!T.trazaDFS({ n: 4, E: [[0, 1], [1, 2], [1, 3]], pos: [] }).ciclo, 'un árbol no tiene ciclo');
  }

  seccion('Kahn: orden topológico y ciclos');
  {
    const k = T.trazaKahn(T.G_DAG);
    ok(esOrdenValido(T.G_DAG, k.orden) && !k.ciclo, 'el orden de la guía es válido');
    igual(k.orden, [0, 1, 3, 4, 2, 5, 6], 'orden de la guía');
    igual(k.grado0, [0, 0, 2, 2, 1, 1, 2], 'grados de entrada iniciales');
    const c = T.trazaKahn(T.G_CICLO);
    ok(c.ciclo && c.orden.length < T.G_CICLO.n && hayCicloDir(T.G_CICLO), 'con la arista 6→1 hay ciclo y orden incompleto');
    igual(c.atascados, [1, 2, 3, 4, 5, 6], 'nodos atascados');
    ok(!hayCicloDir(T.G_DAG), 'referencia: el DAG no tiene ciclo');
    const S = plegarTodo(abreArbol(T.G_DAG), k.frames);
    ok(Object.values(S.est).every(e => e === 'ok'), 'al final todos están colocados');
    ok(Object.values(S.etiquetas).every(e => e === 'in:0'), 'al final todos los grados de entrada son 0');
    const rnd = rng(3);
    for (let i = 0; i < 150; i++) {
      const g = aleatorio(rnd, 2 + Math.floor(rnd() * 6), .25, { dir: true }); g.pos = Array(g.n).fill([.5, .5]);
      const r = T.trazaKahn(g), ciclo = hayCicloDir(g);
      ok(r.ciclo === ciclo, 'Kahn detecta ciclo igual que el DFS de referencia');
      if (!ciclo) ok(esOrdenValido(g, r.orden), 'orden topológico válido');
      ok(r.frames.length <= 100, 'Kahn ≤ 100 frames');
    }
    // DAG aleatorio forzado (aristas solo hacia delante): siempre válido
    for (let i = 0; i < 60; i++) {
      const n = 3 + Math.floor(rnd() * 5), E = [];
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (rnd() < .4) E.push([a, b]);
      const g = { n, dir: true, E, pos: [] }, r = T.trazaKahn(g);
      ok(!r.ciclo && esOrdenValido(g, r.orden), 'DAG de aristas hacia delante: orden válido');
    }
  }

  seccion('Dijkstra: distancias, entradas obsoletas y camino');
  {
    const comp = (g, s) => {
      const r = T.trazaDijkstra(g, s), ref = bellman(g, s, false);
      igual(r.dist, ref, `Dijkstra desde ${s} = Bellman-Ford`);
      igual(T.dijkstraDe(g, s).dist, ref, 'dijkstraDe (jugar) = Bellman-Ford');
      for (let v = 0; v < g.n; v++) if (r.padre[v] !== -1) {
        const w = Math.min(...g.E.filter(([a, b]) => (a === r.padre[v] && b === v) || (!g.dir && b === r.padre[v] && a === v)).map(e => e[2]));
        ok(r.dist[v] === r.dist[r.padre[v]] + w, `padre[${v}] es consistente con dist`);
      }
      ok(r.frames.length <= 100, `Dijkstra: ${r.frames.length} frames`);
      // las salidas válidas de la cola salen en distancia no decreciente
      const validas = r.pops.filter(p => !p.obsoleta).map(p => p.d);
      ok(validas.every((d, i) => !i || validas[i - 1] <= d), 'las salidas válidas no decrecen');
      ok(validas.length === r.dist.filter(x => x < INF).length, 'cada alcanzado se fija una vez');
      return r;
    };
    const r = comp(T.G_DIJ, 0);
    igual(r.dist, [0, 7, 9, 20, 20, 11], 'distancias de la guía');
    ok(r.pops.some(p => p.obsoleta && p.d === 14 && p.u === 5), 'sale la entrada obsoleta (14,5)');
    const S = plegarTodo(abreArbol(T.G_DIJ), r.frames);
    igual(S.etiquetas, Object.fromEntries(r.dist.map((d, i) => [vid(i), String(d)])), 'etiquetas finales = distancias ejecutadas');
    const cam = T.trazaCamino(T.G_DIJ, r.padre, r.dist, 4);
    igual(cam.ruta, [0, 2, 5, 4], 'camino 0 → 4');
    ok(cam.ruta.slice(1).reduce((s, v, i) => s + T.G_DIJ.E.find(([a, b]) => (a === cam.ruta[i] && b === v) || (b === cam.ruta[i] && a === v))[2], 0) === r.dist[4], 'el coste del camino es dist[4]');
    for (let s = 0; s < T.G_DIJ.n; s++) comp(T.G_DIJ, s);
    const rnd = rng(9);
    for (let i = 0; i < 100; i++) {
      const g = aleatorio(rnd, 3 + Math.floor(rnd() * 5), .35, { pesos: true, dir: rnd() < .5 }); g.pos = Array(g.n).fill([.5, .5]);
      if (g.E.length) comp(g, 0);
    }
  }

  seccion('Kruskal: peso mínimo frente a fuerza bruta');
  {
    const r = T.trazaKruskal(T.G_MST), bruto = mstBruto(T.G_MST);
    ok(r.total === bruto && bruto === 39, `peso de la guía ${r.total} = fuerza bruta ${bruto}`);
    ok(r.mst.length === T.G_MST.n - 1 && componentes({ n: T.G_MST.n, E: r.mst }).k === 1, 'el árbol conecta con V-1 aristas');
    ok(r.frames.length <= 100, `Kruskal: ${r.frames.length} frames`);
    igual(T.planKruskal(T.G_MST).at(-1).total, 39, 'planKruskal (jugar) llega al mismo peso');
    const S = plegarTodo(abreArbol(T.G_MST), r.frames);
    ok(Object.values(S.aristaEst).filter(e => e === 'camino').length === 6, 'la escena termina con 6 aristas gruesas');
    const rnd = rng(21);
    let n = 0;
    for (let i = 0; i < 300 && n < 80; i++) {
      const g = aleatorio(rnd, 4 + Math.floor(rnd() * 3), .6, { pesos: true }); g.pos = Array(g.n).fill([.5, .5]);
      if (componentes(g).k !== 1 || g.E.length > 14) continue;
      n++;
      const t = T.trazaKruskal(g).total;
      ok(t === mstBruto(g), `Kruskal = fuerza bruta (${t})`);
    }
    ok(n >= 30, `se probaron ${n} grafos aleatorios conexos`);
    const d = T.crearDSU(5);
    ok(d.unir(0, 1) && d.unir(1, 2) && !d.unir(0, 2) && d.encontrar(0) === d.encontrar(2) && d.encontrar(3) !== d.encontrar(0), 'Union-Find: unir devuelve false si ya estaban juntos');
  }

  seccion('frames bien formados (es/en, tamaño, escena)');
  {
    const casos = [['BFS', T.trazaBFS(T.G_BFS, 0).frames, T.G_BFS], ['BFS mal', T.trazaBFSMal(T.G_BFS, 0).frames, T.G_BFS], ['DFS', T.trazaDFS(T.G_DFS).frames, T.G_DFS],
      ['Kahn', T.trazaKahn(T.G_DAG).frames, T.G_DAG], ['Kahn ciclo', T.trazaKahn(T.G_CICLO).frames, T.G_CICLO], ['Dijkstra', T.trazaDijkstra(T.G_DIJ, 0).frames, T.G_DIJ], ['Kruskal', T.trazaKruskal(T.G_MST).frames, T.G_MST]];
    for (const [n, fr, g] of casos) {
      ok(fr.length >= 5 && fr.length <= 100, `${n}: ${fr.length} frames`);
      ok(fr.every(f => typeof f.es === 'string' && f.es && typeof f.en === 'string' && f.en), `${n}: es y en en todos los frames`);
      ok(fr.every(f => f.es.length <= 260 && f.en.length <= 260), `${n}: subtítulos breves`);
      ok(fr.every(f => f.line === undefined || Number.isInteger(f.line)), `${n}: line entero`);
      const ids = new Set(g.pos.map((_, i) => vid(i)));
      ok(fr.every(f => Object.keys({ ...f.est, ...f.etiquetas }).every(k => ids.has(k))), `${n}: ids de nodo válidos`);
      const S = plegarTodo(abreArbol(g), fr);
      ok(S.nodos.length === g.n, `${n}: se pliega sin romper la escena`);
    }
  }

  // ── Los bloques `jugar`, con las escenas reales ─────────────────────────────────────────────────────────────
  seccion('guía: estructura y bloques jugar');
  {
    const MODS = { arbol: A, tabla: TB };
    const claveEsc = p => Object.keys(MODS).find(c => p[c] !== undefined);
    /** Igual que estadoEn de guia.js: pliega los pasos 0..k. */
    const estadoEn = k => {
      let tipo = null; const S = {};
      for (let i = 0; i <= k; i++) {
        const p = G.pasos[i], nuevo = claveEsc(p);
        if (nuevo) { tipo = nuevo; S[tipo] = MODS[tipo].plegar(undefined, p); } else if (tipo) S[tipo] = MODS[tipo].plegar(S[tipo], p);
      }
      return { tipo, S: S[tipo] };
    };
    const pasos = G.pasos;
    ok(pasos.length >= 42 && pasos.length <= 52, `${pasos.length} pasos`);
    const secs = pasos.filter(p => p.sec).length;
    ok(secs >= 6 && secs <= 7, `${secs} secciones`);
    ok(pasos.filter(p => p.pregunta).length >= 4, '≥ 4 preguntas');
    ok(pasos.filter(p => p.jugar).length >= 4, '≥ 4 jugar');
    ok(pasos.filter(p => p.traza).length >= 8, '≥ 8 trazas');
    ok(G.fuentes.length >= 4 && G.fuentes.length <= 6, `${G.fuentes.length} fuentes`);
    ok(pasos.every(p => L(p.es, 'es').length <= 420 && L(p.en, 'en').length <= 420), 'texto ≤ 420 caracteres por paso');
    ok(pasos.every(p => !/(^|[^*])\*([^*]|$)/.test(p.es.replace(/\*\*/g, '').replace(/`[^`]*`/g, '')) && !/(^|[^*])\*([^*]|$)/.test(p.en.replace(/\*\*/g, '').replace(/`[^`]*`/g, ''))), 'sin asteriscos sueltos');
    ok(pasos.every(p => p.code === undefined || typeof p.code === 'string' || (L(p.code, 'es').split('\n').length === L(p.code, 'en').split('\n').length && L(p.code, 'es').split('\n').length <= 14)), 'listados de ≤ 14 líneas y mismo nº en es y en');
    // cada sección cuyo primer paso colorea lleva leyenda
    const iniciosSec = pasos.map((p, i) => (p.sec ? i : -1)).filter(i => i >= 0);
    ok(pasos.filter(p => p.leyenda).length >= 6, 'leyenda en las secciones que colorean');
    ok(pasos.filter(p => p.sec && p.leyenda).length >= 5, 'las secciones con color abren con leyenda');
    ok(iniciosSec.length === secs, 'secciones localizadas');

    for (const lang of ['es', 'en']) {
      globalThis.document = { documentElement: { lang } };
      pasos.forEach((p, i) => {
        if (!p.jugar) return;
        const { tipo, S } = estadoEn(i), M = MODS[tipo], J = p.jugar, v = M.vista(S), cx = M.ctx(S);
        const lect = () => J.lecturas(v, cx);
        const planas = () => { const r = lect(); ok(r.every(x => typeof x.expr === 'string' && ['string', 'number'].includes(typeof x.valor)), `paso ${i + 1} [${lang}]: lecturas en texto plano`); return r; };
        planas();
        for (const b of J.botones) { ok(typeof L(b.label, lang) === 'string' && L(b.label, lang), `paso ${i + 1}: botón con etiqueta`); }
        for (let ronda = 0; ronda < 6; ronda++) for (const b of J.botones) { if (!(b.off && b.off(v, cx))) b.hacer(v, cx); planas(); M.conVista(S, v); }
        // clic en todos los nodos / celdas
        if (!J.soltar) { ok(!J.arrastrables, `paso ${i + 1}: arrastrables necesita soltar`); } else if (tipo === 'arbol') {
          for (const n of S.nodos) { J.soltar(v, n.id, 0, 0, cx); planas(); }
          ok(!v.est || Object.values(v.est).every(e => ['activo', 'visitado', 'camino', 'ok', 'mal'].includes(e)), `paso ${i + 1}: estados válidos tras clic`);
          const claves = new Set(S.aristas.map(e => e.a + '-' + e.b));
          ok(Object.keys(v.aristaEst).every(k => claves.has(k)), `paso ${i + 1}: aristaEst solo con aristas existentes`);
        } else {
          for (let r = 0; r < S.def.filas; r++) for (let c = 0; c < S.def.cols; c++) { J.soltar(v, r, c, cx); planas(); }
        }
      });
    }
    delete globalThis.document;

    // Lecturas con valores concretos
    const idxJ = pasos.map((p, i) => (p.jugar ? i : -1)).filter(i => i >= 0);
    igual(idxJ.length, 5, 'cinco bloques jugar');
    const prueba = (i, f) => { const { tipo, S } = estadoEn(i), M = MODS[tipo], v = M.vista(S), cx = M.ctx(S); f(v, cx, S, pasos[i].jugar); };
    // matriz
    prueba(idxJ[0], (v, cx, S, J) => {
      const val = x => J.lecturas(v, cx).find(r => r.expr === x).valor;
      igual(val('$|V|, |E|$'), '5, 5', 'matriz: 5 vértices y 5 aristas al empezar');
      igual(val('$\\sum \\deg = 2|E|$'), '10 = 10', 'matriz: suma de grados = 2|E|');
      igual(val('listas g').includes('3:{1, 2, 4}'), true, 'matriz: lista del 3');
      J.soltar(v, 0, 4, cx);
      igual(val('$|V|, |E|$'), '5, 6', 'matriz: clic añade la arista 0–4');
      igual([TB.leer(v, 0, 4), TB.leer(v, 4, 0)], [1, 1], 'matriz: añade las dos celdas simétricas');
      igual(val('listas g').includes('4:{0, 3}'), true, 'matriz: g[4] refleja la nueva arista');
      J.soltar(v, 4, 0, cx);
      igual(val('$|V|, |E|$'), '5, 5', 'matriz: segundo clic la quita');
      J.soltar(v, 2, 2, cx);
      igual(val('$|V|, |E|$'), '5, 5', 'matriz: la diagonal no cambia');
      J.botones[1].hacer(v, cx);
      igual([val('$|V|, |E|$'), val('$\\sum \\deg = 2|E|$')], ['5, 10', '20 = 20'], 'matriz: rellenar = grafo completo K5');
      J.botones[0].hacer(v, cx);
      igual(val('$|V|, |E|$'), '5, 0', 'matriz: vaciar');
      J.botones[2].hacer(v, cx);
      igual(val('$|V|, |E|$'), '5, 5', 'matriz: volver al ejemplo');
    });
    // BFS
    prueba(idxJ[1], (v, cx, S, J) => {
      const val = x => J.lecturas(v, cx).find(r => r.expr === x).valor;
      J.soltar(v, 'v0', 0, 0, cx);
      igual(val('dist'), '[0, 1, 1, 2, 2, 2, 3]', 'BFS jugar: distancias desde 0');
      igual(val('niveles'), 4, 'BFS jugar: 4 niveles desde 0');
      igual(v.etiquetas.v6, '$d=3$', 'BFS jugar: etiqueta de v6');
      ok(Object.values(v.aristaEst).filter(e => e === 'camino').length === 6, 'BFS jugar: el árbol tiene V-1 aristas');
      J.soltar(v, 'v4', 0, 0, cx);
      igual(val('dist'), '[2, 1, 1, 2, 0, 2, 1]', 'BFS jugar: distancias desde 4');
      igual(val('niveles'), 3, 'BFS jugar: 3 niveles desde 4');
      J.botones[0].hacer(v, cx);
      ok(Object.keys(v.est).length === 0 && Object.keys(v.etiquetas).length === 0, 'BFS jugar: limpiar');
    });
    // DFS
    prueba(idxJ[2], (v, cx, S, J) => {
      const val = x => J.lecturas(v, cx).find(r => r.expr === x).valor;
      J.soltar(v, 'v0', 0, 0, cx);
      igual(val('orden de visita'), '0 → 1 → 2 → 4 → 3', 'DFS jugar: preorden desde 0');
      igual(val('alcanzados'), '5 de 7', 'DFS jugar: alcanza 5 de 7');
      igual(val('componentes del grafo'), 2, 'DFS jugar: 2 componentes');
      igual(val('¿ciclo en su componente?'), 'sí', 'DFS jugar: la componente de 0 tiene ciclo');
      J.soltar(v, 'v5', 0, 0, cx);
      igual(val('orden de visita'), '5 → 6', 'DFS jugar: desde 5 solo llega al 6');
      igual(val('¿ciclo en su componente?'), 'no', 'DFS jugar: la de 5 no tiene ciclo');
    });
    // Dijkstra
    prueba(idxJ[3], (v, cx, S, J) => {
      const val = x => J.lecturas(v, cx).find(r => r.expr === x).valor;
      J.soltar(v, 'v0', 0, 0, cx);
      igual(val('dist'), '[0, 7, 9, 20, 20, 11]', 'Dijkstra jugar: distancias desde 0');
      J.soltar(v, 'v4', 0, 0, cx);
      igual([val('coste'), val('camino')], [20, '0 → 2 → 5 → 4'], 'Dijkstra jugar: 0 → 4 cuesta 20 por 0 → 2 → 5 → 4');
      ok(v.aristaEst['v0-v2'] === 'camino' && v.aristaEst['v2-v5'] === 'camino' && v.aristaEst['v4-v5'] === 'camino', 'Dijkstra jugar: aristas del camino marcadas');
      J.soltar(v, 'v1', 0, 0, cx);
      igual(val('origen'), 1, 'Dijkstra jugar: tercer clic cambia de origen');
      J.soltar(v, 'v3', 0, 0, cx);
      igual([val('coste'), val('camino')], [15, '1 → 3'], 'Dijkstra jugar: 1 → 3 cuesta 15 directo');
      J.botones[0].hacer(v, cx);
      ok(J.lecturas(v, cx).length === 1, 'Dijkstra jugar: reiniciar');
    });
    // Kruskal manual
    prueba(idxJ[4], (v, cx, S, J) => {
      const val = x => J.lecturas(v, cx).find(r => r.expr === x).valor;
      igual(val('peso total'), 0, 'Kruskal jugar: empieza en 0');
      const bn = J.botones[0];
      let n = 0;
      while (!bn.off(v, cx)) { bn.hacer(v, cx); n++; }
      igual(n, 11, 'Kruskal jugar: 11 aristas procesadas');
      igual([val('peso total'), val('aristas en el árbol')], [39, '6 / 6'], 'Kruskal jugar: peso 39 con 6 aristas');
      J.botones[1].hacer(v, cx);
      igual(val('peso total'), 0, 'Kruskal jugar: reiniciar');
      bn.hacer(v, cx); bn.hacer(v, cx); bn.hacer(v, cx);
      ok(v.aristaEst['v0-v3'] === 'camino' && v.aristaEst['v2-v4'] === 'camino', 'Kruskal jugar: las dos primeras aristas (5, 5) entran');
    });
  }

  console.log(`${fallos ? '✗' : '✓'} grafos: ${total - fallos}/${total} comprobaciones`);
  process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
