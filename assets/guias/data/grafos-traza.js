// Generadores de trazas y lógica de `jugar` de la guía «Grafos» (assets/guias/data/grafos.js).
// Cada generador EJECUTA el algoritmo (BFS, DFS, Kahn, Dijkstra, Kruskal con Union-Find…) y emite un frame por paso
// relevante; las distancias, tiempos, grados y pesos que se ven en la escena salen de esa ejecución. Se exportan para
// probarlos en Node contra implementaciones de referencia (tests/guias/test-grafos.js).
//
// Escena «arbol» en modo libre: vértice i = nodo de id «v<i>» con valor i (igual que en C++, 0-indexado). Un grafo es
//   {n, pos: [[x, y], …], E: [[a, b, peso?], …], dir?: true}
// y `abre(G)` lo convierte en la apertura de la escena. Los frames son parches acumulativos (est, etiquetas, aristaEst);
// `emisor` calcula la diferencia entre instantáneas, así cada generador solo mantiene el estado "vivo".
import { claveArista as K } from '../arbol.js';

const esEn = () => globalThis.document?.documentElement.lang === 'en'; // idioma activo (las lecturas de `jugar` son texto plano)
/** Texto según el idioma activo (solo para lecturas de `jugar`, que son cadenas planas). */
export const tr = (es, ing) => (esEn() ? ing : es);

// ── Grafos de la guía ───────────────────────────────────────────────────────────────────────────────────────────
export const vid = i => 'v' + i;
export const num = id => +String(id).slice(1);
export const LIENZO = { W: 640, H: 380 };

/** Introducción: 5 vértices, 5 aristas (rombo con cola). */
export const G_INTRO = { n: 5, pos: [[.06, .5], [.38, .1], [.38, .9], [.68, .5], [.98, .5]], E: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]] };
export const PESOS_INTRO = [4, 2, 7, 3, 5];
/** BFS: 7 vértices por capas; distancias 0,1,1,2,2,2,3. */
export const G_BFS = {
  n: 7, pos: [[.04, .5], [.24, .2], [.24, .8], [.5, .04], [.5, .5], [.5, .96], [.9, .5]],
  E: [[0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [4, 6], [5, 6]],
};
/** DFS: triángulo 0-1-2 con dos colas y una segunda componente (5-6). */
export const G_DFS = {
  n: 7, pos: [[.06, .5], [.34, .12], [.34, .88], [.66, .12], [.66, .88], [.94, .38], [.94, .72]],
  E: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [5, 6]],
};
/** DAG de dependencias (dirigido): fuentes 0 y 1, sumidero 6. */
export const G_DAG = {
  n: 7, dir: true, pos: [[.04, .2], [.04, .8], [.36, .2], [.36, .8], [.68, .2], [.68, .8], [.97, .5]],
  E: [[0, 3], [1, 3], [1, 4], [3, 2], [4, 2], [4, 5], [2, 6], [5, 6]],
};
/** El mismo DAG con la arista 6→1: ahora hay ciclos. */
export const ARISTA_CICLO = [6, 1];
export const G_CICLO = { ...G_DAG, E: [...G_DAG.E, ARISTA_CICLO] };
/** Dijkstra: 6 vértices ponderados (no dirigido). Desde 0: 0, 7, 9, 20, 20, 11. */
export const G_DIJ = {
  n: 6, pos: [[.03, .55], [.28, .08], [.4, .5], [.74, .08], [.98, .55], [.56, .92]],
  E: [[0, 1, 7], [0, 2, 9], [0, 5, 14], [1, 2, 10], [1, 3, 15], [2, 3, 11], [2, 5, 2], [3, 4, 6], [4, 5, 9]],
};
/** Kruskal: 7 vértices, 11 aristas; el árbol de expansión mínimo pesa 39. */
export const G_MST = {
  n: 7, pos: [[.03, .25], [.34, .05], [.8, .1], [.14, .86], [.52, .5], [.52, .95], [.97, .8]],
  E: [[0, 1, 7], [0, 3, 5], [1, 2, 8], [1, 3, 9], [1, 4, 7], [2, 4, 5], [3, 4, 15], [3, 5, 6], [4, 5, 8], [4, 6, 9], [5, 6, 11]],
};

/** Arista de la escena (a→b con flecha si el grafo es dirigido; peso si lo lleva). */
export const arista = (G, [a, b, w], pesoExtra) => ({ a: vid(a), b: vid(b), ...((w ?? pesoExtra) !== undefined && { peso: w ?? pesoExtra }), ...(G.dir && { dir: true }) });
/** Apertura de la escena `arbol` (modo libre) para G. */
export const abre = (G, extra = {}) => ({
  modo: 'libre', lienzo: LIENZO,
  nodos: G.pos.map(([x, y], i) => ({ id: vid(i), val: i, x, y })),
  aristas: G.E.map(e => arista(G, e)), ...extra,
});
/** Clave «a-b» de la arista que une u y v (en el sentido definido, o cualquiera si no es dirigido). */
export const claveE = (G, u, v) => {
  const e = G.E.find(([a, b]) => (a === u && b === v) || (!G.dir && a === v && b === u));
  return e && K(vid(e[0]), vid(e[1]));
};
/** Lista de adyacencia [{v, w}]: vecinos en el orden en que aparecen las aristas (como construirGrafo de la lección). */
export const ady = G => {
  const g = Array.from({ length: G.n }, () => []);
  for (const [a, b, w] of G.E) { g[a].push({ v: b, w }); if (!G.dir) g[b].push({ v: a, w }); }
  return g;
};
/** Matriz de adyacencia (0/1) de un grafo no dirigido o dirigido. */
export const matriz = G => {
  const m = Array.from({ length: G.n }, () => Array(G.n).fill(0));
  for (const [a, b] of G.E) { m[a][b] = 1; if (!G.dir) m[b][a] = 1; }
  return m;
};
/** Grafo {n, E, dir} a partir del estado vivo de la escena (ctx().arbol): para `jugar`. */
export const grafoDe = T => ({
  n: T.nodos.length, pos: [], dir: T.aristas.some(e => e.dir),
  E: T.aristas.map(e => [num(e.a), num(e.b), ...(e.peso !== undefined ? [e.peso] : [])]),
});

// ── Emisor de frames: diferencia entre instantáneas ─────────────────────────────────────────────────────────────
const dif = (p, n) => {
  const d = {};
  for (const k of Object.keys(p)) if (!(k in n)) d[k] = null;
  for (const [k, v] of Object.entries(n)) if (p[k] !== v) d[k] = v;
  return d;
};
function emisor() {
  const S = { est: {}, etiquetas: {}, aristaEst: {} }, F = [];
  /** Añade un frame. `nuevo` = instantáneas completas {est, etiquetas, aristaEst} (las que falten no cambian). */
  const fr = (line, es, en, nuevo = {}, extra = {}) => {
    const f = { ...(line != null && { line }), es, en, ...extra };
    for (const k of Object.keys(S)) if (nuevo[k]) {
      const d = dif(S[k], nuevo[k]);
      if (Object.keys(d).length) f[k] = d;
      S[k] = { ...nuevo[k] };
    }
    F.push(f);
    return f;
  };
  return { F, fr };
}
const Q = q => '[' + q.join(', ') + ']';
const QP = q => '[' + q.map(([d, u]) => `(${d},${u})`).join(', ') + ']';

// ── Construir la lista de adyacencia ────────────────────────────────────────────────────────────────────────────
/** Arranca sin aristas (el paso las quita) y las va añadiendo con arista(a, b): dos entradas por arista. */
export function trazaConstruir(G) {
  const g = Array.from({ length: G.n }, () => []), est = {}, { F, fr } = emisor();
  const lista = u => `g[${u}] = {${g[u].join(', ')}}`;
  for (const [a, b] of G.E) {
    g[a].push(b);
    est[vid(a)] = 'activo';
    fr(3, `\`arista(${a}, ${b})\`: \`g[${a}].push_back(${b})\` → ${lista(a)}.`, `\`arista(${a}, ${b})\`: \`g[${a}].push_back(${b})\` → ${lista(a)}.`, { est });
    g[b].push(a);
    est[vid(b)] = 'activo';
    fr(4, `\`g[${b}].push_back(${a})\` → ${lista(b)}. La arista queda guardada dos veces.`, `\`g[${b}].push_back(${a})\` → ${lista(b)}. The edge is stored twice.`, { est }, { '+aristas': [arista(G, [a, b])] });
    delete est[vid(a)]; delete est[vid(b)];
  }
  const entradas = g.reduce((s, l) => s + l.length, 0);
  fr(null, `${G.E.length} aristas, ${entradas} entradas en las listas: la suma de longitudes es 2|E|.`, `${G.E.length} edges, ${entradas} entries in the lists: the sum of the lengths is 2|E|.`, { est });
  return { frames: F, g, entradas };
}

// ── BFS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Ejecuta bfs(g, s). Estados: gris = en la cola (marcado al encolar), anillo = sale, verde = procesado; aristas gruesas = árbol BFS. */
export function trazaBFS(G, s = 0) {
  const g = ady(G), dist = Array(G.n).fill(-1), padre = Array(G.n).fill(-1), q = [], orden = [];
  const est = {}, et = {}, ar = {}, { F, fr } = emisor();
  const f = (l, a, b) => fr(l, a, b, { est, etiquetas: et, aristaEst: ar });
  let tmp = null;
  const limpia = () => { if (tmp) { delete ar[tmp]; tmp = null; } };
  dist[s] = 0; q.push(s); est[vid(s)] = 'visitado'; et[vid(s)] = '$d=0$';
  f(4, `Origen ${s}: \`dist[${s}] = 0\` y entra en la cola. Cola: ${Q(q)}.`, `Source ${s}: \`dist[${s}] = 0\` and it enters the queue. Queue: ${Q(q)}.`);
  while (q.length) {
    const u = q.shift(); orden.push(u); limpia();
    for (const k of Object.keys(est)) if (est[k] === 'activo') est[k] = 'ok';
    est[vid(u)] = 'activo';
    f(6, `Sale ${u} de la cola (distancia ${dist[u]}). Cola: ${Q(q)}.`, `${u} leaves the queue (distance ${dist[u]}). Queue: ${Q(q)}.`);
    for (const { v } of g[u]) {
      limpia();
      const k = claveE(G, u, v);
      if (dist[v] === -1) {
        dist[v] = dist[u] + 1; padre[v] = u; q.push(v);
        est[vid(v)] = 'visitado'; et[vid(v)] = `$d=${dist[v]}$`; ar[k] = 'camino';
        f(9, `${v} sin visitar: \`dist[${v}] = ${dist[v]}\`, \`padre[${v}] = ${u}\` y a la cola. Cola: ${Q(q)}.`, `${v} unvisited: \`dist[${v}] = ${dist[v]}\`, \`padre[${v}] = ${u}\` and into the queue. Queue: ${Q(q)}.`);
      } else if (ar[k] === 'camino') {
        f(8, `${v} ya tiene distancia ${dist[v]} (es la arista por la que llegamos a ${u}): se ignora.`, `${v} already has distance ${dist[v]} (it is the edge we used to reach ${u}): ignored.`);
      } else {
        ar[k] = 'activa'; tmp = k;
        f(8, `${v} ya tiene distancia ${dist[v]}: se ignora. No se vuelve a encolar.`, `${v} already has distance ${dist[v]}: ignored. It is not queued again.`);
      }
    }
  }
  limpia();
  for (const k of Object.keys(est)) est[k] = 'ok';
  f(13, `Cola vacía. \`dist\` = ${Q(dist)}. Las aristas gruesas forman el árbol de BFS.`, `Queue empty. \`dist\` = ${Q(dist)}. The thick edges form the BFS tree.`);
  return { frames: F, orden, dist, padre, final: { est: { ...est }, etiquetas: { ...et }, aristaEst: { ...ar } } };
}

/** BFS que marca `visto` al SACAR de la cola (error típico): los nodos entran, y se procesan, varias veces. */
export function trazaBFSMal(G, s = 0) {
  const g = ady(G), visto = Array(G.n).fill(false), veces = Array(G.n).fill(0), q = [s], orden = [];
  const est = {}, et = {}, { F, fr } = emisor();
  const f = (l, a, b) => fr(l, a, b, { est, etiquetas: et });
  veces[s] = 1; est[vid(s)] = 'visitado';
  f(1, `Se encola el ${s}. Cola: ${Q(q)}.`, `${s} is queued. Queue: ${Q(q)}.`);
  let repetidos = 0;
  while (q.length) {
    const u = q.shift(), otra = visto[u];
    for (const k of Object.keys(est)) if (est[k] === 'activo' || est[k] === 'mal') est[k] = 'ok';
    visto[u] = true; orden.push(u);
    const nuevos = [];
    for (const { v } of g[u]) if (!visto[v]) { q.push(v); veces[v]++; nuevos.push(v); }
    for (const v of nuevos) { if (veces[v] > 1) et[vid(v)] = '×' + veces[v]; if (est[vid(v)] === undefined) est[vid(v)] = 'visitado'; }
    if (otra) repetidos++;
    est[vid(u)] = otra ? 'mal' : 'activo';
    const mete = nuevos.length ? `Encola ${Q(nuevos)}.` : 'No encola nada.';
    const meteEn = nuevos.length ? `Queues ${Q(nuevos)}.` : 'Queues nothing.';
    f(nuevos.length ? 6 : 4, `Sale ${u}${otra ? ': ya se había procesado, trabajo repetido.' : '.'} ${mete} Cola: ${Q(q)}.`, `${u} leaves${otra ? ': it was already processed, repeated work.' : '.'} ${meteEn} Queue: ${Q(q)}.`);
  }
  for (const k of Object.keys(est)) if (est[k] === 'activo' || est[k] === 'mal') est[k] = 'ok';
  const pops = orden.length;
  f(null, `${pops} salidas de la cola para ${G.n} nodos: ${repetidos} repetidas. Marcando al encolar serían ${G.n}.`, `${pops} pops for ${G.n} nodes: ${repetidos} repeated. Marking when queueing it would be ${G.n}.`);
  return { frames: F, orden, pops, repetidos, veces };
}

/** Camino con menos aristas de s a t desde el vector padre (-1 = sin padre); vacío si no hay. */
export function caminoDe(padre, s, t) {
  const r = [];
  for (let v = t; v !== -1; v = padre[v]) r.unshift(v);
  return r[0] === s ? r : [];
}

// ── DFS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Ejecuta dfs(u, padre) para cada componente. Anillo = u actual, borde grueso = pila de llamadas, verde = cerrado. */
export function trazaDFS(G) {
  const g = ady(G), ent = Array(G.n).fill(0), sal = Array(G.n).fill(0), pila = [];
  const est = {}, et = {}, ar = {}, { F, fr } = emisor();
  const f = (l, a, b) => fr(l, a, b, { est, etiquetas: et, aristaEst: ar });
  let reloj = 0, ciclo = false, comp = 0;
  const arbol = [], retroceso = [];
  function dfs(u, p) {
    ent[u] = ++reloj; pila.push(u);
    for (const x of pila) est[vid(x)] = 'camino';
    est[vid(u)] = 'activo'; et[vid(u)] = `${ent[u]}/`;
    f(3, `\`dfs(${u}, ${p})\`: \`ent[${u}] = ${ent[u]}\`. ${u} entra en la pila de llamadas.`, `\`dfs(${u}, ${p})\`: \`ent[${u}] = ${ent[u]}\`. ${u} enters the call stack.`);
    for (const { v } of g[u]) {
      const k = claveE(G, u, v);
      if (v === p) {
        f(5, `${v} es el padre de ${u}: se salta, es la arista por la que llegamos.`, `${v} is the parent of ${u}: skipped, it is the edge we arrived by.`);
      } else if (!ent[v]) {
        ar[k] = 'camino'; arbol.push([u, v]);
        f(6, `${v} sin visitar: ${u}-${v} es una arista de árbol. Se llama a \`dfs(${v}, ${u})\`.`, `${v} unvisited: ${u}-${v} is a tree edge. \`dfs(${v}, ${u})\` is called.`);
        dfs(v, u);
      } else if (!sal[v]) {
        ciclo = true; ar[k] = 'activa'; retroceso.push([u, v]);
        f(7, `${v} ya entró y sigue abierto: ${u}-${v} es una arista de retroceso. Hay un ciclo.`, `${v} already entered and is still open: ${u}-${v} is a back edge. There is a cycle.`);
      } else {
        f(6, `${v} ya está cerrado: esa arista se vio desde ${v} como retroceso. No se repite.`, `${v} is already closed: that edge was seen from ${v} as a back edge. Not repeated.`);
      }
    }
    sal[u] = ++reloj; pila.pop();
    est[vid(u)] = 'ok'; et[vid(u)] = `${ent[u]}/${sal[u]}`;
    if (pila.length) est[vid(pila.at(-1))] = 'activo';
    f(9, `\`sal[${u}] = ${sal[u]}\`: ${u} se cierra. ${pila.length ? `Volvemos a ${pila.at(-1)}.` : 'La pila queda vacía.'}`, `\`sal[${u}] = ${sal[u]}\`: ${u} closes. ${pila.length ? `Back to ${pila.at(-1)}.` : 'The stack is empty.'}`);
  }
  for (let u = 0; u < G.n; u++) if (!ent[u]) {
    comp++;
    f(13, `Bucle externo: ${u} sin visitar, nueva componente. \`dfs(${u}, -1)\`, \`comp = ${comp}\`.`, `Outer loop: ${u} unvisited, a new component. \`dfs(${u}, -1)\`, \`comp = ${comp}\`.`);
    dfs(u, -1);
  }
  f(13, `Todos visitados: ${comp} componentes${ciclo ? ' y al menos un ciclo' : ''}. Tiempos \`ent/sal\` en cada nodo.`, `All visited: ${comp} components${ciclo ? ' and at least one cycle' : ''}. \`ent/sal\` times on each node.`);
  return { frames: F, ent, sal, ciclo, comp, arbol, retroceso, final: { est: { ...est }, etiquetas: { ...et }, aristaEst: { ...ar } } };
}

// ── Orden topológico (Kahn) ─────────────────────────────────────────────────────────────────────────────────────
/** Ejecuta ordenTopologico por Kahn. Etiqueta in:k = aristas que aún le llegan; gris = en la cola; rojo = atascado por un ciclo. */
export function trazaKahn(G) {
  const g = ady(G), n = G.n, grado = Array(n).fill(0), orden = [], q = [];
  const est = {}, et = {}, ar = {}, { F, fr } = emisor();
  const f = (l, a, b) => fr(l, a, b, { est, etiquetas: et, aristaEst: ar });
  for (let u = 0; u < n; u++) for (const { v } of g[u]) grado[v]++;
  const grado0 = [...grado];
  for (let u = 0; u < n; u++) et[vid(u)] = `in:${grado[u]}`;
  f(5, `Se cuenta el grado de entrada de cada nodo: cuántas aristas le llegan. \`grado\` = ${Q(grado)}.`, `The in-degree of every node is counted: how many edges arrive. \`grado\` = ${Q(grado)}.`);
  for (let u = 0; u < n; u++) if (!grado[u]) { q.push(u); est[vid(u)] = 'visitado'; }
  f(7, `Los de grado 0 no dependen de nadie: entran en la cola. Cola: ${Q(q)}.`, `Those with degree 0 depend on nobody: they enter the queue. Queue: ${Q(q)}.`);
  let anterior = null;
  while (q.length) {
    const u = q.shift(); orden.push(u);
    for (const k of Object.keys(ar)) delete ar[k];
    if (anterior !== null) est[vid(anterior)] = 'ok';
    est[vid(u)] = 'activo'; anterior = u;
    f(10, `Sale ${u}: va al orden. \`orden\` = ${Q(orden)}. Cola: ${Q(q)}.`, `${u} leaves: it goes to the order. \`orden\` = ${Q(orden)}. Queue: ${Q(q)}.`);
    for (const { v } of g[u]) {
      grado[v]--; et[vid(v)] = `in:${grado[v]}`; ar[claveE(G, u, v)] = 'activa';
      if (grado[v] === 0) { q.push(v); est[vid(v)] = 'visitado'; }
      f(11, `Se quita la arista ${u}→${v}: el grado de ${v} baja a ${grado[v]}.${grado[v] === 0 ? ` Ya no espera a nadie: a la cola. Cola: ${Q(q)}.` : ''}`, `Edge ${u}→${v} is removed: the degree of ${v} drops to ${grado[v]}.${grado[v] === 0 ? ` It waits for nobody: into the queue. Queue: ${Q(q)}.` : ''}`);
    }
  }
  for (const k of Object.keys(ar)) delete ar[k];
  const atascados = [];
  for (let u = 0; u < n; u++) if (!orden.includes(u)) { est[vid(u)] = 'mal'; atascados.push(u); }
  for (const u of orden) est[vid(u)] = 'ok';
  const ciclo = orden.length < n;
  f(13, ciclo
    ? `\`orden.size()\` = ${orden.length} < ${n}: los nodos en rojo siguen esperando una arista que nunca se quita. Hay un ciclo.`
    : `\`orden.size()\` = ${n}: todos colocados. Orden válido: ${Q(orden)}.`,
  ciclo
    ? `\`orden.size()\` = ${orden.length} < ${n}: the red nodes still wait for an edge that is never removed. There is a cycle.`
    : `\`orden.size()\` = ${n}: all placed. Valid order: ${Q(orden)}.`);
  return { frames: F, orden, ciclo, atascados, grado0 };
}

// ── Dijkstra ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Ejecuta dijkstra(g, s) con cola de pares (distancia, nodo) y entradas obsoletas. Verde = definitivo, gris = provisional. */
export function trazaDijkstra(G, s = 0) {
  const g = ady(G), INF = Infinity, dist = Array(G.n).fill(INF), padre = Array(G.n).fill(-1), pq = [], pops = [];
  const est = {}, et = {}, ar = {}, { F, fr } = emisor();
  const f = (l, a, b) => fr(l, a, b, { est, etiquetas: et, aristaEst: ar });
  const lab = u => (dist[u] === INF ? '∞' : String(dist[u]));
  const push = (d, u) => { pq.push([d, u]); pq.sort((x, y) => x[0] - y[0] || x[1] - y[1]); };
  for (let u = 0; u < G.n; u++) et[vid(u)] = '∞';
  dist[s] = 0; et[vid(s)] = '0'; est[vid(s)] = 'visitado'; push(0, s);
  f(4, `Todas las distancias valen ∞ salvo \`dist[${s}] = 0\`. Cola de prioridad: ${QP(pq)}.`, `All distances are ∞ except \`dist[${s}] = 0\`. Priority queue: ${QP(pq)}.`);
  let anterior = null, tmp = null;
  while (pq.length) {
    const [d, u] = pq.shift();
    if (tmp) { delete ar[tmp]; tmp = null; }
    for (const k of Object.keys(est)) if (est[k] === 'mal') est[k] = 'ok';
    if (d > dist[u]) {
      pops.push({ d, u, obsoleta: true });
      est[vid(u)] = 'mal';
      f(7, `Sale (${d},${u}) pero \`dist[${u}]\` = ${dist[u]} < ${d}: entrada obsoleta, se descarta. Cola: ${QP(pq)}.`, `(${d},${u}) pops but \`dist[${u}]\` = ${dist[u]} < ${d}: stale entry, discarded. Queue: ${QP(pq)}.`);
      continue;
    }
    pops.push({ d, u, obsoleta: false });
    if (anterior !== null) est[vid(anterior)] = 'ok';
    est[vid(u)] = 'activo'; anterior = u;
    for (const k of Object.keys(ar)) if (ar[k] === 'activa') delete ar[k];
    f(6, `Sale (${d},${u}): ${u} es el pendiente más cercano y su distancia ${d} ya es definitiva. Cola: ${QP(pq)}.`, `(${d},${u}) pops: ${u} is the closest pending node and its distance ${d} is final. Queue: ${QP(pq)}.`);
    for (const { v, w } of g[u]) {
      if (tmp) { delete ar[tmp]; tmp = null; }
      const k = claveE(G, u, v), nd = d + w;
      if (nd < dist[v]) {
        const antes = lab(v), viejo = padre[v] === -1 ? null : claveE(G, padre[v], v);
        if (viejo) delete ar[viejo];
        dist[v] = nd; padre[v] = u; push(nd, v);
        et[vid(v)] = String(nd); ar[k] = 'camino';
        if (est[vid(v)] === undefined) est[vid(v)] = 'visitado';
        f(10, `${u}→${v} cuesta ${w}: ${d} + ${w} = ${nd} < ${antes}. Relajación: \`dist[${v}] = ${nd}\`, \`padre[${v}] = ${u}\`. Cola: ${QP(pq)}.`, `${u}→${v} costs ${w}: ${d} + ${w} = ${nd} < ${antes}. Relaxation: \`dist[${v}] = ${nd}\`, \`padre[${v}] = ${u}\`. Queue: ${QP(pq)}.`);
      } else {
        if (ar[k] !== 'camino') { ar[k] = 'activa'; tmp = k; }
        f(9, `${u}→${v} cuesta ${w}: ${d} + ${w} = ${nd} no mejora \`dist[${v}]\` = ${lab(v)}.`, `${u}→${v} costs ${w}: ${d} + ${w} = ${nd} does not improve \`dist[${v}]\` = ${lab(v)}.`);
      }
    }
  }
  if (tmp) delete ar[tmp];
  for (const k of Object.keys(est)) est[k] = 'ok';
  f(13, `Cola vacía. \`dist\` = ${Q(dist.map(x => (x === INF ? '∞' : x)))}. Las aristas gruesas son los \`padre\`: el árbol de caminos mínimos.`, `Queue empty. \`dist\` = ${Q(dist.map(x => (x === INF ? '∞' : x)))}. The thick edges are the \`padre\` links: the shortest-path tree.`);
  return { frames: F, dist, padre, pops, final: { est: { ...est }, etiquetas: { ...et }, aristaEst: { ...ar } } };
}

/** Frames de `camino(padre, t)`: sube por padre desde t y al final marca la ruta ya invertida. */
export function trazaCamino(G, padre, dist, t) {
  const est = {}, ar = {}, ruta = [], { F, fr } = emisor();
  const f = (l, a, b) => fr(l, a, b, { est, aristaEst: ar });
  let prev = null;
  for (let v = t; v !== -1; v = padre[v]) {
    ruta.push(v); est[vid(v)] = 'camino';
    if (prev !== null) ar[claveE(G, v, prev)] = 'camino';
    const p = padre[v];
    f(4, `\`ruta.push_back(${v})\`${p === -1 ? `: \`padre[${v}] = -1\`, hemos llegado al origen.` : `. Subimos: \`padre[${v}] = ${p}\`.`}`, `\`ruta.push_back(${v})\`${p === -1 ? `: \`padre[${v}] = -1\`, we reached the source.` : `. Going up: \`padre[${v}] = ${p}\`.`}`);
    prev = v;
  }
  const dir = [...ruta].reverse();
  f(5, `\`reverse\`: ${dir.join(' → ')}. Coste total: \`dist[${t}]\` = ${dist[t]}.`, `\`reverse\`: ${dir.join(' → ')}. Total cost: \`dist[${t}]\` = ${dist[t]}.`);
  return { frames: F, ruta: dir };
}

// ── Kruskal con Union-Find ──────────────────────────────────────────────────────────────────────────────────────
/** Union-Find mínimo (el de la guía): compresión de caminos y union sin tamaño. unir devuelve false si ya estaban juntos. */
export function crearDSU(n) {
  const padre = Array.from({ length: n }, (_, i) => i);
  const encontrar = x => (padre[x] === x ? x : (padre[x] = encontrar(padre[x])));
  const unir = (a, b) => { a = encontrar(a); b = encontrar(b); if (a === b) return false; padre[a] = b; return true; };
  return { padre, encontrar, unir };
}
/** Aristas ordenadas por peso (estable: empates en el orden de la lista). */
export const ordenadas = G => G.E.map((e, i) => [e, i]).sort((x, y) => x[0][2] - y[0][2] || x[1] - y[1]).map(x => x[0]);
/** Ejecuta kruskal(n, aristas). Rojo = los dos extremos ya estaban unidos; etiqueta g<r> = representante del grupo. */
export function trazaKruskal(G) {
  const dsu = crearDSU(G.n), ord = ordenadas(G), est = {}, et = {}, ar = {}, mst = [], { F, fr } = emisor();
  const f = (l, a, b) => fr(l, a, b, { est, etiquetas: et, aristaEst: ar });
  let total = 0;
  const etiquetar = () => { for (let u = 0; u < G.n; u++) et[vid(u)] = 'g' + dsu.encontrar(u); };
  etiquetar();
  f(3, `Se ordenan las aristas por peso: ${ord.map(e => e[2]).join(', ')}. Cada nodo empieza en su propio grupo (etiqueta g).`, `The edges are sorted by weight: ${ord.map(e => e[2]).join(', ')}. Each node starts in its own group (g label).`);
  let ant = null;
  for (const [a, b, w] of ord) {
    const k = claveE(G, a, b);
    if (ant) { delete est[vid(ant[0])]; delete est[vid(ant[1])]; if (ar[ant[2]] === 'activa') delete ar[ant[2]]; }
    const ra = dsu.encontrar(a), rb = dsu.encontrar(b);
    ar[k] = 'activa'; ant = [a, b, k];
    f(6, `Arista ${a}-${b}, peso ${w}: \`encontrar(${a})\` = ${ra} y \`encontrar(${b})\` = ${rb}.`, `Edge ${a}-${b}, weight ${w}: \`encontrar(${a})\` = ${ra} and \`encontrar(${b})\` = ${rb}.`);
    if (dsu.unir(a, b)) {
      total += w; mst.push([a, b, w]); ar[k] = 'camino'; etiquetar();
      f(7, `Grupos distintos: \`unir\` los fusiona y la arista entra en el árbol. \`total\` = ${total}.`, `Different groups: \`unir\` merges them and the edge joins the tree. \`total\` = ${total}.`);
    } else {
      delete ar[k]; est[vid(a)] = 'mal'; est[vid(b)] = 'mal';
      f(7, `Mismo grupo (${ra}): ${a} y ${b} ya están conectados, esta arista cerraría un ciclo. Se descarta.`, `Same group (${ra}): ${a} and ${b} are already connected, this edge would close a cycle. Discarded.`);
    }
  }
  if (ant) { delete est[vid(ant[0])]; delete est[vid(ant[1])]; }
  f(8, `Fin: ${mst.length} aristas (V - 1 = ${G.n - 1}) y peso total ${total}.`, `Done: ${mst.length} edges (V - 1 = ${G.n - 1}) and total weight ${total}.`);
  return { frames: F, mst, total, orden: ord };
}

// ── Matriz de adyacencia (escena tabla) ─────────────────────────────────────────────────────────────────────────
/** Frames que recorren la fila u de la matriz para listar sus vecinos: V lecturas aunque haya pocos vecinos. */
export function trazaFila(m, u) {
  const n = m.length, est = {}, { F, fr } = emisor();
  let vecinos = 0;
  for (let c = 0; c < n; c++) {
    const prev = est[u + ',' + (c - 1)];
    if (c > 0 && prev === 'activa') { if (m[u][c - 1]) est[u + ',' + (c - 1)] = 'hecha'; else delete est[u + ',' + (c - 1)]; }
    est[u + ',' + c] = 'activa';
    const es1 = m[u][c] === 1;
    if (es1) vecinos++;
    fr(3, `\`m[${u}][${c}]\` = ${m[u][c]}: ${es1 ? `${c} es vecino de ${u}.` : `${c} no es vecino.`} Celdas leídas: ${c + 1}.`, `\`m[${u}][${c}]\` = ${m[u][c]}: ${es1 ? `${c} is a neighbour of ${u}.` : `${c} is not a neighbour.`} Cells read: ${c + 1}.`,
      { est }, { marcas: { u: { fila: u }, v: { col: c } }, formula: { es: '`m[' + u + '][' + c + '] = ' + m[u][c] + '`', en: '`m[' + u + '][' + c + '] = ' + m[u][c] + '`' } });
  }
  if (m[u][n - 1]) est[u + ',' + (n - 1)] = 'hecha'; else delete est[u + ',' + (n - 1)];
  fr(null, `${vecinos} vecinos, pero se leyeron las ${n} celdas de la fila: O(V). La lista \`g[${u}]\` solo tiene ${vecinos} entradas.`, `${vecinos} neighbours, but all ${n} cells of the row were read: O(V). The list \`g[${u}]\` only has ${vecinos} entries.`, { est }, { marcas: null, formula: null });
  return { frames: F, vecinos };
}

// ── Lógica de los bloques `jugar` ───────────────────────────────────────────────────────────────────────────────
/** BFS sobre G desde s: {orden, dist (-1 = inalcanzable), padre}. */
export function bfsDe(G, s) {
  const g = ady(G), dist = Array(G.n).fill(-1), padre = Array(G.n).fill(-1), q = [s], orden = [];
  dist[s] = 0;
  while (q.length) {
    const u = q.shift(); orden.push(u);
    for (const { v } of g[u]) if (dist[v] === -1) { dist[v] = dist[u] + 1; padre[v] = u; q.push(v); }
  }
  return { orden, dist, padre };
}
/** DFS recursivo desde s: {orden (preorden), arbol (aristas de árbol), alcanzados}. */
export function dfsDe(G, s) {
  const g = ady(G), visto = Array(G.n).fill(false), orden = [], arbol = [];
  const rec = u => { visto[u] = true; orden.push(u); for (const { v } of g[u]) if (!visto[v]) { arbol.push([u, v]); rec(v); } };
  rec(s);
  return { orden, arbol };
}
/** Nº de componentes conexas (no dirigido) y, para cada vértice, el índice de su componente. */
export function componentesDe(G) {
  const g = ady(G), c = Array(G.n).fill(-1);
  let k = 0;
  for (let s = 0; s < G.n; s++) if (c[s] === -1) { const st = [s]; c[s] = k; while (st.length) { const u = st.pop(); for (const { v } of g[u]) if (c[v] === -1) { c[v] = k; st.push(v); } } k++; }
  return { k, c };
}
/** ¿La componente que contiene a los vértices `vs` tiene ciclo? (aristas internas > vértices - 1; solo no dirigido). */
export const cicloEn = (G, vs) => G.E.filter(([a, b]) => vs.includes(a) && vs.includes(b)).length > vs.length - 1;
/** Dijkstra de referencia sencillo (selección lineal del mínimo): {dist (Infinity = inalcanzable), padre}. */
export function dijkstraDe(G, s) {
  const g = ady(G), dist = Array(G.n).fill(Infinity), padre = Array(G.n).fill(-1), hecho = Array(G.n).fill(false);
  dist[s] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < G.n; i++) if (!hecho[i] && dist[i] < Infinity && (u === -1 || dist[i] < dist[u])) u = i;
    if (u === -1) break;
    hecho[u] = true;
    for (const { v, w } of g[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; padre[v] = u; }
  }
  return { dist, padre };
}
/** Plan de Kruskal para el modo manual: por cada arista ordenada, si entra o se descarta. */
export function planKruskal(G) {
  const dsu = crearDSU(G.n);
  let total = 0;
  return ordenadas(G).map(e => { const entra = dsu.unir(e[0], e[1]); if (entra) total += e[2]; return { e, entra, total }; });
}
