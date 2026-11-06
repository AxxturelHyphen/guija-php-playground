// Guía «Grafos» (lección 08): representación (lista y matriz de adyacencia), BFS, DFS, orden topológico (Kahn), Dijkstra y
// árbol de expansión mínima (Kruskal). Mezcla dos escenas (cada paso que abre otra clave de escena sustituye a la anterior):
// tabla (matriz de adyacencia) y arbol en modo libre (todo lo demás). Las trazas se generan ejecutando los algoritmos de
// verdad (data/grafos-traza.js, probado en tests/guias/test-grafos.js). Formato de paso: ver data/punteros.js.
// Los frames de una traza NO persisten: el paso siguiente restablece el estado con un parche (mapas `final` de cada generador).
import { poner, leer, estado } from '../tabla.js';
import {
  tr, vid, num, abre, arista, claveE, matriz, grafoDe,
  G_INTRO, PESOS_INTRO, G_BFS, G_DFS, G_DAG, ARISTA_CICLO, G_CICLO, G_DIJ, G_MST,
  trazaConstruir, trazaFila, trazaBFS, trazaBFSMal, caminoDe, trazaDFS, trazaKahn, trazaDijkstra, trazaCamino, trazaKruskal,
  bfsDe, dfsDe, componentesDe, cicloEn, dijkstraDe, planKruskal,
} from './grafos-traza.js';

/** Listado bilingüe: `t` lleva marcadores @0, @1… que se sustituyen por los comentarios de es / en (mismo nº de líneas). */
const cod = (t, es, en) => ({ es: t.replace(/@(\d)/g, (_, i) => es[i]), en: t.replace(/@(\d)/g, (_, i) => en[i]) });
/** Mapa {id: valor} para todos los nodos de G con f(i). */
const sobreNodos = (G, f) => Object.fromEntries(Array.from({ length: G.n }, (_, i) => [vid(i), f(i)]));
const claves = G => G.E.map(([a, b]) => claveE(G, a, b));

// ══ Listados C++ (≤ 14 líneas) ═══════════════════════════════════════════════════════════════════════════════════
const C_CONSTRUIR = cod(`Grafo g(5);                        // @0
void arista(int a, int b) {        // @1
    g[a].push_back(b);
    g[b].push_back(a);
}`, ['5 vértices (0..4), sin aristas', 'no dirigido: dos entradas por arista'], ['5 vertices (0..4), no edges', 'undirected: two entries per edge']);
const C_FILA = cod(`// @0
for (int v = 0; v < n; v++)
    if (m[u][v]) cout << v << ' ';`, ['vecinos de u con la matriz m (V × V)'], ['neighbours of u with the matrix m (V × V)']);
const C_BFS = cod(`vector<int> bfs(const Grafo& g, int s) {
    vector<int> dist(g.size(), -1), padre(g.size(), -1);
    queue<int> q;
    dist[s] = 0;  q.push(s);          // @0
    while (!q.empty()) {
        int u = q.front();  q.pop();
        for (int v : g[u])
            if (dist[v] == -1) {      // @1
                dist[v] = dist[u] + 1;  padre[v] = u;
                q.push(v);
            }
    }
    return dist;
}`, ['se marca al ENCOLAR', 'sin visitar'], ['marked when QUEUED', 'unvisited']);
const C_CAMINO = cod(`vector<int> camino(const vector<int>& padre, int t) {
    vector<int> ruta;
    for (int v = t; v != -1; v = padre[v])
        ruta.push_back(v);
    reverse(ruta.begin(), ruta.end());
    return ruta;                      // @0
}`, ['del origen a t'], ['from the source to t']);
const C_DFS = cod(`int reloj = 0;  bool ciclo = false;
void dfs(int u, int padre) {
    ent[u] = ++reloj;
    for (int v : g[u]) {
        if (v == padre) continue;
        if (!ent[v]) dfs(v, u);       // @0
        else if (!sal[v]) ciclo = true;   // @1
    }
    sal[u] = ++reloj;
}
int comp = 0;
for (int u = 0; u < n; u++)
    if (!ent[u]) { dfs(u, -1); comp++; }`, ['arista de árbol', 'retroceso: v sigue abierto'], ['tree edge', 'back edge: v is still open']);
const C_KAHN = cod(`vector<int> ordenTopologico(const Grafo& g) {
    int n = g.size();
    vector<int> grado(n, 0), orden;
    for (int u = 0; u < n; u++)
        for (int v : g[u]) grado[v]++;    // @0
    queue<int> q;
    for (int u = 0; u < n; u++) if (!grado[u]) q.push(u);
    while (!q.empty()) {
        int u = q.front();  q.pop();
        orden.push_back(u);
        for (int v : g[u]) if (--grado[v] == 0) q.push(v);
    }
    return orden;                     // @1
}`, ['grado de entrada', 'si orden.size() < n, hay un ciclo'], ['in-degree', 'if orden.size() < n, there is a cycle']);
const C_DIJ = cod(`vector<long long> dijkstra(const GrafoPonderado& g, int s) {
    vector<long long> dist(g.size(), LLONG_MAX);  vector<int> padre(g.size(), -1);
    priority_queue<pair<long long,int>, vector<pair<long long,int>>, greater<>> pq;
    dist[s] = 0;  pq.push({0, s});
    while (!pq.empty()) {
        auto [d, u] = pq.top();  pq.pop();
        if (d > dist[u]) continue;            // @0
        for (auto [v, w] : g[u])
            if (d + w < dist[v]) {            // @1
                dist[v] = d + w;  padre[v] = u;  pq.push({dist[v], v});
            }
    }
    return dist;
}`, ['entrada obsoleta: se descarta', 'relajar u → v'], ['stale entry: discarded', 'relax u → v']);
const C_DSU = cod(`struct ConjuntosDisjuntos {
    vector<int> padre;
    ConjuntosDisjuntos(int n) : padre(n) { iota(padre.begin(), padre.end(), 0); }
    int encontrar(int x) {            // @0
        return padre[x] == x ? x : padre[x] = encontrar(padre[x]);
    }
    bool unir(int a, int b) {
        a = encontrar(a);  b = encontrar(b);
        if (a == b) return false;     // @1
        padre[a] = b;  return true;
    }
};`, ['raíz del grupo (con compresión de caminos)', 'mismo grupo: cerraría un ciclo'], ['root of the group (with path compression)', 'same group: it would close a cycle']);
const C_KRUSKAL = cod(`long long kruskal(int n, AristasP aristas) {
    sort(aristas.begin(), aristas.end(),
         [](auto& x, auto& y) { return get<2>(x) < get<2>(y); });
    ConjuntosDisjuntos dsu(n);
    long long total = 0;
    for (auto [a, b, w] : aristas)
        if (dsu.unir(a, b)) total += w;   // @0
    return total;
}`, ['une dos grupos: entra en el árbol'], ['joins two groups: enters the tree']);
const C_BFS_MAL = cod(`queue<int> q;  q.push(s);
while (!q.empty()) {
    int u = q.front();  q.pop();
    visto[u] = 1;                     // @0
    for (int v : g[u])
        if (!visto[v]) q.push(v);
}`, ['MAL: tarde, ya pudo entrar varias veces'], ['WRONG: too late, it may have entered several times']);
const C_PILA = cod(`void dfsIterativo(const Grafo& g, int s) {
    vector<char> visto(g.size(), 0);
    stack<int> pila;                  // @0
    pila.push(s);
    while (!pila.empty()) {
        int u = pila.top();  pila.pop();
        if (visto[u]) continue;
        visto[u] = 1;
        for (int v : g[u])
            if (!visto[v]) pila.push(v);
    }
}`, ['en el heap, no en la pila de llamadas'], ['on the heap, not on the call stack']);
const C_INDICE = cod(`int n, m;  cin >> n >> m;          // @0
Grafo g(n);                        // @1
for (int i = 0; i < m; i++) {
    int a, b;  cin >> a >> b;
    g[a - 1].push_back(b - 1);     // @2
    g[b - 1].push_back(a - 1);
}`, ['el enunciado numera los nodos 1..n', 'pero g solo tiene posiciones 0..n-1', 'restar 1 al leer (o Grafo g(n + 1) sin restar)'],
['the statement numbers the nodes 1..n', 'but g only has positions 0..n-1', 'subtract 1 when reading (or Grafo g(n + 1) with no subtraction)']);

// ══ Datos derivados de ejecutar los algoritmos ═══════════════════════════════════════════════════════════════════
const MI = matriz(G_INTRO);
const GRADOS = MI.map(f => f.reduce((s, x) => s + x, 0));
const UNOS = m => Object.fromEntries(m.flatMap((f, r) => f.map((x, c) => (x ? [r + ',' + c, 'hecha'] : null)).filter(Boolean)));
const CONSTRUIR = trazaConstruir(G_INTRO);
const FILA = trazaFila(MI, 3);
const BFS = trazaBFS(G_BFS, 0), BFS_MAL = trazaBFSMal(G_BFS, 0);
const RUTA_BFS = caminoDe(BFS.padre, 0, 6);
const ARISTAS_RUTA = new Set(RUTA_BFS.slice(1).map((b, k) => claveE(G_BFS, RUTA_BFS[k], b)));
const DFS = trazaDFS(G_DFS);
const KAHN = trazaKahn(G_DAG), KAHN_CICLO = trazaKahn(G_CICLO);
const DIJ = trazaDijkstra(G_DIJ, 0), CAM = trazaCamino(G_DIJ, DIJ.padre, DIJ.dist, 4);
const KRU = trazaKruskal(G_MST);
const DIR_PESOS = { ...G_INTRO, dir: true };
const lista = (v, u) => v.val[u].map((x, c) => (x ? c : null)).filter(c => c !== null).join(', ');

// Estados «de reposo» para volver al grafo sin colores entre pasos
const aristasVerdes = (G, mapa) => Object.fromEntries(claves(G).map(k => [k, mapa[k] ?? null]));

// ══ Bloques `jugar` ══════════════════════════════════════════════════════════════════════════════════════════════
/** Matriz: clic en (r, c) añade o quita la arista r–c (se cambian las dos celdas simétricas). */
const jugarMatriz = {
  arrastrables: true,
  botones: [
    { label: { es: 'Vaciar', en: 'Clear' }, hacer: v => { for (let r = 0; r < v.val.length; r++) for (let c = 0; c < v.val.length; c++) { poner(v, r, c, 0); estado(v, r, c, null); } } },
    { label: { es: 'Rellenar', en: 'Fill' }, hacer: v => { for (let r = 0; r < v.val.length; r++) for (let c = 0; c < v.val.length; c++) if (r !== c) { poner(v, r, c, 1); estado(v, r, c, 'hecha'); } } },
    { label: { es: 'Volver al ejemplo', en: 'Back to the example' }, hacer: (v, cx) => { for (let r = 0; r < v.val.length; r++) for (let c = 0; c < v.val.length; c++) { poner(v, r, c, cx.inicial[r][c]); estado(v, r, c, cx.inicial[r][c] ? 'hecha' : null); } } },
  ],
  soltar: (v, r, c) => {
    if (r === c) return; // sin bucles: la diagonal vale 0
    const x = leer(v, r, c) ? 0 : 1;
    poner(v, r, c, x); poner(v, c, r, x);
    estado(v, r, c, x ? 'hecha' : null); estado(v, c, r, x ? 'hecha' : null);
  },
  lecturas: v => {
    const n = v.val.length, suma = v.val.flat().reduce((s, x) => s + (x ? 1 : 0), 0), E = suma / 2, max = n * (n - 1) / 2;
    return [
      { expr: '$|V|, |E|$', valor: `${n}, ${E}` },
      { expr: '$\\sum \\deg = 2|E|$', valor: `${suma} = ${2 * E}` },
      { expr: tr('densidad', 'density'), valor: `${Math.round(100 * E / max)} %  (|E| / ${max})` },
      { expr: tr('listas g', 'lists g'), valor: Array.from({ length: n }, (_, u) => `${u}:{${lista(v, u)}}`).join('  ') },
    ];
  },
};

const etiquetasDist = (G, r) => { const o = {}; r.dist.forEach((d, i) => { if (d >= 0 && d !== Infinity) o[vid(i)] = String(d); }); return o; };
/** BFS: clic en un nodo = origen. Muestra distancias, niveles y árbol de BFS. */
const jugarBFS = {
  arrastrables: true,
  botones: [{ label: { es: 'Limpiar', en: 'Clear' }, hacer: v => { v.est = {}; v.etiquetas = {}; v.aristaEst = {}; v.r = null; v.o = null; } }],
  soltar: (v, id, x, y, cx) => {
    const G = grafoDe(cx.arbol), s = num(id), r = bfsDe(G, s);
    v.o = s; v.r = r; v.est = {}; v.etiquetas = {}; v.aristaEst = {};
    r.dist.forEach((d, i) => { if (d >= 0) { v.est[vid(i)] = i === s ? 'activo' : 'ok'; v.etiquetas[vid(i)] = `$d=${d}$`; } });
    r.padre.forEach((p, i) => { if (p >= 0) v.aristaEst[claveE(G, p, i)] = 'camino'; });
  },
  lecturas: v => v.r ? [
    { expr: tr('origen', 'source'), valor: v.o },
    { expr: tr('orden de salida', 'dequeue order'), valor: v.r.orden.join(' → ') },
    { expr: 'dist', valor: '[' + v.r.dist.join(', ') + ']' },
    { expr: tr('niveles', 'levels'), valor: Math.max(...v.r.dist) + 1 },
  ] : [{ expr: tr('origen', 'source'), valor: tr('haz clic en un nodo', 'click a node') }],
};
/** DFS: clic en un nodo = origen. Muestra el orden de visita, su componente y si esta tiene ciclo. */
const jugarDFS = {
  arrastrables: true,
  botones: [{ label: { es: 'Limpiar', en: 'Clear' }, hacer: v => { v.est = {}; v.etiquetas = {}; v.aristaEst = {}; v.r = null; v.o = null; } }],
  soltar: (v, id, x, y, cx) => {
    const G = grafoDe(cx.arbol), s = num(id), r = dfsDe(G, s);
    v.o = s; v.r = r; v.est = {}; v.etiquetas = {}; v.aristaEst = {};
    r.orden.forEach((u, k) => { v.est[vid(u)] = u === s ? 'activo' : 'ok'; v.etiquetas[vid(u)] = '#' + (k + 1); });
    for (const [a, b] of r.arbol) v.aristaEst[claveE(G, a, b)] = 'camino';
    v.G = G;
  },
  lecturas: v => v.r ? [
    { expr: tr('origen', 'source'), valor: v.o },
    { expr: tr('orden de visita', 'visit order'), valor: v.r.orden.join(' → ') },
    { expr: tr('alcanzados', 'reached'), valor: tr(`${v.r.orden.length} de ${v.G.n}`, `${v.r.orden.length} of ${v.G.n}`) },
    { expr: tr('componentes del grafo', 'components of the graph'), valor: componentesDe(v.G).k },
    { expr: tr('¿ciclo en su componente?', 'cycle in its component?'), valor: cicloEn(v.G, v.r.orden) ? tr('sí', 'yes') : 'no', malo: cicloEn(v.G, v.r.orden) },
  ] : [{ expr: tr('origen', 'source'), valor: tr('haz clic en un nodo', 'click a node') }],
};
/** Dijkstra: 1.er clic = origen, 2.º = destino, 3.º = nuevo origen. Muestra el coste y el camino. */
const jugarDijkstra = {
  arrastrables: true,
  botones: [{ label: { es: 'Reiniciar', en: 'Restart' }, hacer: v => { v.est = {}; v.etiquetas = {}; v.aristaEst = {}; v.o = null; v.d = null; v.r = null; } }],
  soltar: (v, id, x, y, cx) => {
    const G = grafoDe(cx.arbol), u = num(id);
    if (v.o == null || v.d != null) { v.o = u; v.d = null; } else if (u !== v.o) v.d = u;
    v.r = dijkstraDe(G, v.o); v.G = G;
    v.est = {}; v.etiquetas = {}; v.aristaEst = {};
    v.r.dist.forEach((d, i) => { v.etiquetas[vid(i)] = String(d); v.est[vid(i)] = 'visitado'; });
    v.est[vid(v.o)] = 'activo';
    if (v.d != null) {
      const ruta = caminoDe(v.r.padre, v.o, v.d);
      ruta.forEach(i => { v.est[vid(i)] = i === v.o ? 'activo' : 'camino'; });
      ruta.slice(1).forEach((b, k) => { v.aristaEst[claveE(G, ruta[k], b)] = 'camino'; });
      v.ruta = ruta;
    }
  },
  lecturas: v => v.r ? [
    { expr: tr('origen', 'source'), valor: v.o },
    { expr: tr('destino', 'destination'), valor: v.d ?? tr('haz clic en otro nodo', 'click another node') },
    { expr: tr('coste', 'cost'), valor: v.d != null ? v.r.dist[v.d] : '—' },
    { expr: tr('camino', 'path'), valor: v.d != null ? v.ruta.join(' → ') : '—' },
    { expr: 'dist', valor: '[' + v.r.dist.join(', ') + ']' },
  ] : [{ expr: tr('origen', 'source'), valor: tr('haz clic en un nodo', 'click a node') }],
};
/** Kruskal a mano: cada pulsación procesa la siguiente arista ordenada. */
const PLAN = planKruskal(G_MST);
const pintaKruskal = v => {
  v.aristaEst = {}; v.est = {}; v.etiquetas = {};
  PLAN.slice(0, v.k ?? 0).forEach(p => { if (p.entra) v.aristaEst[claveE(G_MST, p.e[0], p.e[1])] = 'camino'; });
  const u = PLAN[(v.k ?? 0) - 1];
  if (u && !u.entra) { v.est[vid(u.e[0])] = 'mal'; v.est[vid(u.e[1])] = 'mal'; }
  if (u && u.entra) v.est[vid(u.e[0])] = v.est[vid(u.e[1])] = 'activo';
};
const jugarKruskal = {
  botones: [
    { label: { es: 'Siguiente arista', en: 'Next edge' }, hacer: v => { v.k = (v.k ?? 0) + 1; pintaKruskal(v); }, off: v => (v.k ?? 0) >= PLAN.length },
    { label: { es: 'Reiniciar', en: 'Restart' }, hacer: v => { v.k = 0; pintaKruskal(v); } },
  ],
  lecturas: v => {
    const k = v.k ?? 0, u = PLAN[k - 1], dentro = PLAN.slice(0, k).filter(p => p.entra).length;
    return [
      { expr: tr('arista', 'edge'), valor: u ? `${u.e[0]}-${u.e[1]} (${tr('peso', 'weight')} ${u.e[2]})` : '—' },
      { expr: tr('decisión', 'decision'), valor: u ? (u.entra ? tr('entra en el árbol', 'joins the tree') : tr('se descarta: cerraría un ciclo', 'discarded: it would close a cycle')) : '—', malo: !!u && !u.entra },
      { expr: tr('aristas en el árbol', 'edges in the tree'), valor: `${dentro} / ${G_MST.n - 1}` },
      { expr: tr('peso total', 'total weight'), valor: k ? PLAN[k - 1].total : 0 },
    ];
  },
};

// ══ Guía ═════════════════════════════════════════════════════════════════════════════════════════════════════════
const RESET = { est: null, etiquetas: null, aristaEst: null };

export default {
  titulo: { es: 'Grafos', en: 'Graphs' },
  fuentes: [
    'Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). *Introduction to algorithms* (4th ed.). MIT Press.',
    'Sedgewick, R., & Wayne, K. (2011). *Algorithms* (4th ed.). Addison-Wesley. https://algs4.cs.princeton.edu/40graphs/',
    'Skiena, S. S. (2020). *The algorithm design manual* (3rd ed.). Springer. https://doi.org/10.1007/978-3-030-54256-6',
    'Lehman, E., Leighton, F. T., & Meyer, A. R. (n.d.). *Mathematics for computer science* [Course textbook, 6.042J, Spring 2015]. MIT OpenCourseWare. https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-spring-2015/',
    '*std::priority_queue*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/priority_queue',
  ],
  pasos: [
    // ── 1. Qué es un grafo y cómo se guarda ──
    { sec: { es: 'Qué es un grafo y cómo se guarda', en: 'What a graph is and how it is stored' }, arbol: abre(G_INTRO), code: '', line: null,
      es: 'Un **grafo** $G = (V, E)$ es un conjunto de **vértices** y de **aristas** que los unen. Modela relaciones: carreteras, amistades, dependencias entre paquetes, estados de un puzzle. Aquí, $|V| = 5$ vértices y $|E| = 5$ aristas, numerados desde 0 como en C++.',
      en: 'A **graph** $G = (V, E)$ is a set of **vertices** and **edges** joining them. It models relations: roads, friendships, package dependencies, puzzle states. Here, $|V| = 5$ vertices and $|E| = 5$ edges, numbered from 0 as in C++.' },
    { '-aristas': claves(G_INTRO), '+aristas': G_INTRO.E.map((e, i) => arista(DIR_PESOS, e, PESOS_INTRO[i])),
      es: 'Si las aristas tienen sentido (A → B no implica B → A) el grafo es **dirigido** y se dibuja con flechas. Si llevan un número (distancia, coste, tiempo) es **ponderado**. Puede ser ambas cosas, como este. Dijkstra y Kruskal usan pesos; el orden topológico necesita aristas dirigidas.',
      en: 'If edges have a direction (A → B does not imply B → A) the graph is **directed** and drawn with arrows. If they carry a number (distance, cost, time) it is **weighted**. It can be both, like this one. Dijkstra and Kruskal use weights; topological order needs directed edges.' },
    { '-aristas': claves(G_INTRO), '+aristas': G_INTRO.E.map(e => arista(G_INTRO, e)), etiquetas: sobreNodos(G_INTRO, i => 'deg=' + GRADOS[i]),
      es: 'El **grado** $\\deg(v)$ de un vértice es el número de aristas que le tocan: aquí 2, 2, 2, 3 y 1. Sumando: $\\sum_v \\deg(v) = 10 = 2|E|$. Es el **lema del apretón de manos**: cada arista aporta un extremo a dos vértices, así que se cuenta dos veces.',
      en: 'The **degree** $\\deg(v)$ of a vertex is the number of edges touching it: here 2, 2, 2, 3 and 1. Adding up: $\\sum_v \\deg(v) = 10 = 2|E|$. This is the **handshake lemma**: each edge gives one end to two vertices, so it is counted twice.' },
    { line: null,
      es: 'Un grafo no dirigido tiene 5 vértices con grados 3, 3, 2, 2 y 1. ¿Qué podemos decir?',
      en: 'An undirected graph has 5 vertices with degrees 3, 3, 2, 2 and 1. What can we say?',
      pregunta: {
        opc: [
          { es: 'No puede existir: la suma de grados es 11, impar, y debería ser 2|E|', en: 'It cannot exist: the sum of degrees is 11, odd, and it should be 2|E|', ok: 1 },
          { es: 'Existe y tiene 11 aristas, una por cada grado', en: 'It exists and has 11 edges, one per degree' },
          { es: 'Existe y tiene 6 aristas', en: 'It exists and has 6 edges' },
        ],
        why: {
          es: 'La suma de grados cuenta cada arista dos veces, así que siempre es par. Con 11 saldrían 5,5 aristas. Corolario: el número de vértices de grado impar es siempre par.',
          en: 'The sum of degrees counts every edge twice, so it is always even. 11 would give 5.5 edges. Corollary: the number of odd-degree vertices is always even.',
        },
      } },
    { etiquetas: null, code: C_CONSTRUIR, line: 1, hl: { v3: 'a', v1: 'b', v2: 'b', v4: 'b' },
      es: 'La **lista de adyacencia** guarda para cada vértice sus vecinos: el grafo es un `vector<vector<int>>` y `g[u]` son los vecinos de `u`. Para el 3 es `{1, 2, 4}`. Ocupa $O(V+E)$. Saber si existe la arista $(u, v)$ obliga a recorrer `g[u]`: $O(\\deg(u))$.',
      en: 'The **adjacency list** stores each vertex\'s neighbours: the graph is a `vector<vector<int>>` and `g[u]` holds the neighbours of `u`. For 3 it is `{1, 2, 4}`. It takes $O(V+E)$. Checking whether edge $(u, v)$ exists means walking `g[u]`: $O(\\deg(u))$.' },
    { '-aristas': claves(G_INTRO), line: 2, traza: CONSTRUIR.frames,
      es: 'Así se construye con `arista(a, b)`. En un grafo no dirigido cada arista se guarda **dos veces**, una en cada lista: por eso la suma de las longitudes es $2|E|$. Reproduce la traza.',
      en: 'This is how it is built with `arista(a, b)`. In an undirected graph each edge is stored **twice**, once in each list: that is why the lengths add up to $2|E|$. Play the trace.' },
    { tabla: { filas: 5, cols: 5, cab: { filas: [0, 1, 2, 3, 4], cols: [0, 1, 2, 3, 4], esq: 'u\\v' }, val: MI, formula: false }, est: UNOS(MI), code: C_FILA, line: null, leyenda: ['hecho', 'activo'],
      es: 'La **matriz de adyacencia** es una tabla $V \\times V$: `m[u][v] = 1` si hay arista $u$–$v$. Si no es dirigido es simétrica y la diagonal vale 0. Comprobar una arista es **una lectura**, $O(1)$, pero ocupa $V^2$ celdas aunque casi no haya aristas.',
      en: 'The **adjacency matrix** is a $V \\times V$ table: `m[u][v] = 1` if there is an edge $u$–$v$. If undirected it is symmetric and the diagonal is 0. Checking an edge is **one read**, $O(1)$, but it takes $V^2$ cells even if there are hardly any edges.' },
    { marcas: null, resaltar: null, line: 3, traza: FILA.frames,
      es: 'Listar los vecinos del 3 obliga a leer **toda la fila**: $O(V)$, aunque solo tenga 3. Con la lista bastaba recorrer `g[3]`: $O(\\deg)$. Reproduce la traza y cuenta las celdas leídas.',
      en: 'Listing the neighbours of 3 forces reading the **whole row**: $O(V)$, even if it only has 3. With the list, walking `g[3]` was enough: $O(\\deg)$. Play the trace and count the cells read.' },
    { code: '', line: null,
      es: '**Lista**: memoria $O(V+E)$, vecinos $O(\\deg)$, arista $O(\\deg)$. **Matriz**: $O(V^2)$, vecinos $O(V)$, arista $O(1)$. En grafos **dispersos** ($E$ del orden de $V$) manda la lista; la matriz compensa si $V$ es pequeño, el grafo es denso o hace falta $O(1)$ por arista (Floyd-Warshall).',
      en: '**List**: memory $O(V+E)$, neighbours $O(\\deg)$, edge $O(\\deg)$. **Matrix**: $O(V^2)$, neighbours $O(V)$, edge $O(1)$. For **sparse** graphs ($E$ of the order of $V$) the list wins; the matrix pays off if $V$ is small, the graph is dense or you need $O(1)$ per edge (Floyd-Warshall).',
      pregunta: {
        opc: [
          { es: '10^10 celdas: unos 10 GB', en: '10^10 cells: about 10 GB', ok: 1 },
          { es: '10^6 celdas: unos 1 MB', en: '10^6 cells: about 1 MB' },
          { es: '3·10^5 celdas: unos 300 KB', en: '3·10^5 cells: about 300 KB' },
        ],
        why: {
          es: 'Una matriz de char de 100 000 × 100 000 tiene 10^10 bytes. La lista guarda unas 2·300 000 entradas más los 100 000 vectores: del orden de unos pocos MB.',
          en: 'A 100,000 × 100,000 char matrix has 10^10 bytes. The list stores about 2·300,000 entries plus the 100,000 vectors: a few MB.',
        },
      } },
    { code: '', line: null, jugar: jugarMatriz,
      es: 'Haz clic en una celda (o muévete con las flechas y pulsa Enter) para añadir o quitar la arista $u$–$v$: se cambian `m[u][v]` y `m[v][u]`. Las lecturas dan $|V|$, $|E|$, la comprobación $\\sum \\deg = 2|E|$, la densidad y la lista de adyacencia equivalente. Prueba a rellenarla.',
      en: 'Click a cell (or move with the arrow keys and press Enter) to add or remove edge $u$–$v$: `m[u][v]` and `m[v][u]` both change. The readings give $|V|$, $|E|$, the check $\\sum \\deg = 2|E|$, the density and the equivalent adjacency list. Try filling it.' },

    // ── 2. BFS ──
    { sec: { es: 'Búsqueda en anchura (BFS)', en: 'Breadth-first search (BFS)' }, arbol: abre(G_BFS), code: C_BFS, line: 1, leyenda: ['activo', 'hecho', 'camino', 'aux'],
      es: '**BFS** explora por capas: el origen, sus vecinos, los vecinos de estos… Usa una **cola** (`queue<int>`): sale el más antiguo, así que ningún nodo a distancia $d+1$ sale antes que uno a distancia $d$. Por eso da el camino con **menos aristas** en grafos sin pesos.',
      en: '**BFS** explores by layers: the source, its neighbours, their neighbours… It uses a **queue** (`queue<int>`): the oldest leaves first, so no node at distance $d+1$ leaves before one at distance $d$. That is why it gives the path with the **fewest edges** in unweighted graphs.' },
    { line: 4, hl: { v0: 'a' },
      es: 'Cada nodo recibe `dist` y `padre` al **encolarse**, no al salir: `dist[v] == -1` hace de «visitado». En la escena, gris = en la cola, anillo = el que sale, verde = procesado; la etiqueta `d=` es la distancia y las aristas gruesas forman el árbol de BFS.',
      en: 'Each node gets `dist` and `padre` when it is **queued**, not when it leaves: `dist[v] == -1` works as "visited". In the scene, grey = in the queue, ring = the one leaving, green = processed; the `d=` label is the distance and the thick edges form the BFS tree.' },
    { line: 4, traza: BFS.frames,
      es: 'Reproduce BFS desde el 0 y sigue la cola en el subtítulo. Cuando sale el 1 entran el 3 y el 4; cuando sale el 2, el 4 ya está marcado y no se vuelve a meter: así nadie entra dos veces.',
      en: 'Play BFS from 0 and follow the queue in the subtitle. When 1 leaves, 3 and 4 enter; when 2 leaves, 4 is already marked and is not queued again: nobody enters twice.' },
    { ...BFS.final, line: null,
      es: '¿Por qué BFS encuentra el camino con menos aristas?',
      en: 'Why does BFS find the path with the fewest edges?',
      pregunta: {
        opc: [
          { es: 'Porque los nodos salen por capas: todos los de distancia d antes que cualquiera de d + 1', en: 'Because nodes leave by layers: all those at distance d before any at d + 1', ok: 1 },
          { es: 'Porque siempre sigue el vecino más cercano', en: 'Because it always follows the closest neighbour' },
          { es: 'Porque usa menos memoria que DFS', en: 'Because it uses less memory than DFS' },
        ],
        why: {
          es: 'La cola es FIFO: al empezar a procesar la capa d + 1 ya se han vaciado todas las de distancia d, y cada nodo se encola la primera vez que se alcanza, que es por un camino mínimo. En grafos con pesos no vale.',
          en: 'The queue is FIFO: when layer d + 1 starts being processed, all those at distance d are done, and each node is queued the first time it is reached, which is along a shortest path. It does not hold with weights.',
        },
      } },
    { est: sobreNodos(G_BFS, i => (RUTA_BFS.includes(i) ? 'camino' : 'visitado')),
      aristaEst: Object.fromEntries(claves(G_BFS).map(k => [k, ARISTAS_RUTA.has(k) ? 'camino' : null])),
      code: C_CAMINO, line: 3,
      es: 'Para recuperar el camino se sube por `padre` desde el destino y se invierte. De 0 a 6: 0 → 1 → 4 → 6, tres aristas. Hay otro igual de corto (0 → 2 → 5 → 6): BFS devuelve el que descubre primero. Todas las aristas del árbol de BFS son caminos mínimos desde el origen.',
      en: 'To recover the path you climb `padre` from the destination and reverse it. From 0 to 6: 0 → 1 → 4 → 6, three edges. There is another equally short one (0 → 2 → 5 → 6): BFS returns the one it discovers first. Every edge of the BFS tree is a shortest path from the source.' },
    { ...RESET, code: C_BFS, line: null, jugar: jugarBFS,
      es: 'Haz clic en un nodo para lanzar BFS desde él. Las etiquetas `d=` son las distancias y las aristas gruesas, el árbol de BFS. Las lecturas dan el orden de salida de la cola y los niveles. ¿Qué origen da menos niveles?',
      en: 'Click a node to run BFS from it. The `d=` labels are the distances and the thick edges the BFS tree. The readings give the queue order and the levels. Which source gives the fewest levels?' },
    { line: 1,
      es: 'Cada vértice entra en la cola una vez y de cada lista se lee cada arista una vez (dos en no dirigidos): $O(V+E)$ de tiempo y $O(V)$ de memoria extra. En una cuadrícula o laberinto los vecinos son las 4 celdas contiguas y el coste es lineal en el número de celdas.',
      en: 'Each vertex enters the queue once and each list is read once per edge (twice if undirected): $O(V+E)$ time and $O(V)$ extra memory. On a grid or maze the neighbours are the 4 adjacent cells and the cost is linear in the number of cells.' },

    // ── 3. DFS ──
    { sec: { es: 'Búsqueda en profundidad (DFS)', en: 'Depth-first search (DFS)' }, arbol: abre(G_DFS), code: C_DFS, line: 2, leyenda: ['activo', 'camino', 'hecho'],
      es: '**DFS** se mete por un camino hasta el fondo y solo entonces retrocede. Es recursión: la **pila de llamadas** hace de pila. `ent[u]` guarda el instante de entrada y `sal[u]` el de salida, con un reloj compartido.',
      en: '**DFS** goes down one path to the end and only then backtracks. It is recursion: the **call stack** is the stack. `ent[u]` stores the entry time and `sal[u]` the exit time, with a shared clock.' },
    { line: 3, hl: { v0: 'a' },
      es: 'En la escena, el anillo es el nodo actual, el borde grueso los nodos abiertos (la pila de llamadas) y el verde, los cerrados. Un nodo $v$ es descendiente de $u$ si y solo si $ent[u] < ent[v] < sal[v] < sal[u]$: los intervalos de tiempo se anidan, nunca se cruzan.',
      en: 'In the scene, the ring is the current node, the thick border the open nodes (the call stack) and green the closed ones. A node $v$ is a descendant of $u$ if and only if $ent[u] < ent[v] < sal[v] < sal[u]$: the time intervals nest, they never cross.' },
    { line: 3, traza: DFS.frames,
      es: 'Reproduce el DFS desde el 0, con los vecinos en el orden de `g[u]`. Fíjate en el 2: ve al 0, que sigue abierto. Esa arista es de **retroceso**. Al final, el bucle externo salta a otra componente.',
      en: 'Play DFS from 0, with neighbours in the order of `g[u]`. Look at 2: it sees 0, which is still open. That edge is a **back edge**. At the end, the outer loop jumps to another component.' },
    { ...DFS.final, line: null,
      es: 'Las aristas de **árbol** (gruesas) forman el árbol de DFS. Las de **retroceso** (discontinuas) llevan a un antecesor aún abierto y cada una cierra un ciclo: aquí 0–2 cierra 0–1–2–0. Un grafo no dirigido tiene un ciclo si y solo si DFS encuentra alguna.',
      en: '**Tree** edges (thick) form the DFS tree. **Back** edges (dashed) lead to an ancestor that is still open and each one closes a cycle: here 0–2 closes 0–1–2–0. An undirected graph has a cycle if and only if DFS finds one.' },
    { line: 7,
      es: 'En un DFS sobre un grafo **no dirigido** llegas a un vértice que ya entró, sigue abierto y no es el padre. ¿Qué significa?',
      en: 'In a DFS over an **undirected** graph you reach a vertex that already entered, is still open and is not the parent. What does it mean?',
      pregunta: {
        opc: [
          { es: 'Que el grafo tiene un ciclo', en: 'That the graph has a cycle', ok: 1 },
          { es: 'Que el grafo no es conexo', en: 'That the graph is not connected' },
          { es: 'Que hay un nodo aislado', en: 'That there is an isolated node' },
        ],
        why: {
          es: 'Hay un camino de árbol del antecesor abierto hasta el nodo actual, y esa arista lo cierra: es un ciclo. Que el grafo no sea conexo se nota en el bucle externo, no en las aristas.',
          en: 'There is a tree path from the open ancestor to the current node, and that edge closes it: a cycle. A disconnected graph shows up in the outer loop, not in the edges.',
        },
      } },
    { line: 13,
      es: 'El bucle externo llama a `dfs` desde cada nodo sin visitar: cada llamada nueva descubre una **componente conexa**. Aquí `comp` = 2: {0, 1, 2, 3, 4} y {5, 6}. Coste total $O(V+E)$: cada nodo se abre una vez y cada arista se mira dos veces.',
      en: 'The outer loop calls `dfs` from every unvisited node: each new call discovers a **connected component**. Here `comp` = 2: {0, 1, 2, 3, 4} and {5, 6}. Total cost $O(V+E)$: each node is opened once and each edge is looked at twice.' },
    { ...RESET, code: C_DFS, line: null, jugar: jugarDFS,
      es: 'Haz clic en un nodo para lanzar DFS desde él: las etiquetas `#k` son el orden de visita y los nodos verdes, su componente. Prueba el 5: solo llega al 6. Las lecturas dicen cuántas componentes hay y si la del nodo tiene ciclo.',
      en: 'Click a node to run DFS from it: the `#k` labels are the visit order and the green nodes its component. Try 5: it only reaches 6. The readings say how many components there are and whether the node\'s one has a cycle.' },

    // ── 4. Orden topológico ──
    { sec: { es: 'Orden topológico', en: 'Topological order' }, arbol: abre(G_DAG), code: C_KAHN, line: 1, leyenda: ['activo', 'hecho', 'mal', 'aux'],
      es: 'Un **orden topológico** coloca los nodos de un grafo dirigido de modo que cada arista $u \\to v$ lleve a $u$ antes que a $v$. Es el orden de compilación, de un plan de estudios o de las tareas de un `Makefile`. Solo existe si el grafo es un **DAG**: dirigido y sin ciclos.',
      en: 'A **topological order** places the nodes of a directed graph so that every edge $u \\to v$ puts $u$ before $v$. It is the build order, a study plan or the tasks of a `Makefile`. It only exists if the graph is a **DAG**: directed and acyclic.' },
    { line: 5, traza: KAHN.frames,
      es: '**Kahn**: cuenta el **grado de entrada** (aristas que llegan) de cada nodo. Los de grado 0 no esperan a nadie y entran en la cola. Al sacar uno se le quitan las aristas salientes: si un vecino llega a 0, ya puede salir. Reproduce la traza.',
      en: '**Kahn**: count the **in-degree** (incoming edges) of every node. Those with degree 0 wait for nobody and enter the queue. When one leaves, its outgoing edges are removed: if a neighbour reaches 0, it can leave too. Play the trace.' },
    { est: Object.fromEntries(KAHN.orden.map(u => [vid(u), 'ok'])), etiquetas: Object.fromEntries(KAHN.orden.map((u, k) => [vid(u), '#' + (k + 1)])), line: 13,
      es: '¿Es único el orden topológico?',
      en: 'Is the topological order unique?',
      pregunta: {
        opc: [
          { es: 'No: 0, 1, 3, 4, 2, 5, 6 y 1, 0, 3, 4, 2, 5, 6 son válidos', en: 'No: 0, 1, 3, 4, 2, 5, 6 and 1, 0, 3, 4, 2, 5, 6 are both valid', ok: 1 },
          { es: 'Sí, siempre hay exactamente uno', en: 'Yes, there is always exactly one' },
          { es: 'Sí, si el grafo es conexo', en: 'Yes, if the graph is connected' },
        ],
        why: {
          es: 'Los nodos 0 y 1 no dependen entre sí, así que pueden ir en cualquier orden. Hay un único orden solo si cada nodo está unido al siguiente por una arista. La cola decide cuál sale, y la guía pinta `#k` = posición en el orden obtenido.',
          en: 'Nodes 0 and 1 do not depend on each other, so they can go in either order. The order is unique only if every node is joined to the next by an edge. The queue decides which one comes out; the scene paints `#k` = position in the order obtained.',
        },
      } },
    { ...RESET, '+aristas': [arista(G_DAG, ARISTA_CICLO)], line: 13, traza: KAHN_CICLO.frames,
      es: 'Añadimos la arista 6 → 1: ahora hay ciclos (1 → 3 → 2 → 6 → 1). Nadie del ciclo puede salir, porque cada uno espera a otro del ciclo. Kahn lo delata sin buscarlo: saca solo el 0 y queda `orden.size() < n`. Reproduce la traza.',
      en: 'We add edge 6 → 1: now there are cycles (1 → 3 → 2 → 6 → 1). Nobody in a cycle can leave, because each waits for another in the cycle. Kahn exposes it without looking for it: it takes out only 0 and `orden.size() < n` remains. Play the trace.' },
    { line: 13,
      es: 'Kahn termina con `orden.size() = 3` y `n = 7`. ¿Qué indica?',
      en: 'Kahn ends with `orden.size() = 3` and `n = 7`. What does it indicate?',
      pregunta: {
        opc: [
          { es: 'Que el grafo tiene un ciclo: hay nodos que nunca llegan a grado 0', en: 'That the graph has a cycle: some nodes never reach degree 0', ok: 1 },
          { es: 'Que el grafo no es conexo', en: 'That the graph is not connected' },
          { es: 'Que hay que repetir el algoritmo desde otro nodo', en: 'That the algorithm must be repeated from another node' },
        ],
        why: {
          es: 'Todo nodo de un ciclo conserva al menos una arista entrante del ciclo, así que su grado nunca llega a 0 y no entra en la cola. Un grafo desconexo no es problema: sus fuentes empiezan todas en la cola.',
          en: 'Every node on a cycle keeps at least one incoming edge from the cycle, so its degree never reaches 0 and it never enters the queue. A disconnected graph is no problem: all its sources start in the queue.',
        },
      } },
    { '-aristas': [claveE(G_CICLO, ...ARISTA_CICLO)], line: 1,
      es: 'Quitamos la arista 6 → 1 y volvemos al DAG. Cada nodo entra y sale de la cola una vez y cada arista se quita una vez: $O(V+E)$. Si necesitas el menor orden lexicográfico, usa una `priority_queue` de mínimos en vez de la `queue`. Alternativa: DFS y ordenar por `sal` decreciente.',
      en: 'We remove edge 6 → 1 and go back to the DAG. Each node enters and leaves the queue once and each edge is removed once: $O(V+E)$. If you need the lexicographically smallest order, use a min `priority_queue` instead of the `queue`. Alternative: DFS and sort by decreasing `sal`.' },

    // ── 5. Dijkstra ──
    { sec: { es: 'Dijkstra: caminos mínimos', en: 'Dijkstra: shortest paths' }, arbol: abre(G_DIJ), code: C_DIJ, line: 1, leyenda: ['activo', 'hecho', 'camino', 'aux'],
      es: 'Con pesos, el camino con menos aristas ya no es el más barato. **Dijkstra** calcula la distancia mínima desde un origen a todos los nodos si **ningún peso es negativo**. Idea: el nodo pendiente más cercano al origen ya no puede mejorarse, así que se **fija** y se usa para mejorar a sus vecinos.',
      en: 'With weights, the path with the fewest edges is no longer the cheapest. **Dijkstra** computes the minimum distance from a source to every node if **no weight is negative**. Idea: the pending node closest to the source can no longer be improved, so it is **fixed** and used to improve its neighbours.' },
    { line: 3,
      es: 'Para sacar siempre el pendiente más cercano se usa una `priority_queue` de pares `(distancia, nodo)` con `greater<>`: un montículo de **mínimos** (por defecto es de máximos). No se puede bajar la prioridad de una entrada: se inserta otra nueva y las viejas se descartan al salir.',
      en: 'To always take out the closest pending node, a `priority_queue` of `(distance, node)` pairs with `greater<>` is used: a **min**-heap (the default is a max-heap). An entry\'s priority cannot be lowered: a new one is inserted and the old ones are discarded when they come out.' },
    { line: 9, traza: DIJ.frames,
      es: '**Relajar** $u \\to v$ es probar si pasar por $u$ mejora a $v$: $dist[u] + w < dist[v]$. Reproduce la traza: gris = distancia provisional, verde = definitiva y aristas gruesas = el `padre` actual. Atento a las entradas obsoletas.',
      en: '**Relaxing** $u \\to v$ means testing whether going through $u$ improves $v$: $dist[u] + w < dist[v]$. Play the trace: grey = tentative distance, green = final and thick edges = the current `padre`. Watch for stale entries.' },
    { ...DIJ.final, line: 7,
      es: 'En la traza sale `(14,5)` cuando `dist[5]` ya vale 11. ¿Qué hace el código?',
      en: 'In the trace `(14,5)` comes out when `dist[5]` is already 11. What does the code do?',
      pregunta: {
        opc: [
          { es: 'La descarta con `continue`: es una entrada obsoleta, ya hay una mejor', en: 'It discards it with `continue`: it is a stale entry, a better one exists', ok: 1 },
          { es: 'Relaja otra vez los vecinos del 5 con distancia 14', en: 'It relaxes the neighbours of 5 again with distance 14' },
          { es: 'Sube `dist[5]` a 14', en: 'It raises `dist[5]` to 14' },
        ],
        why: {
          es: '`d > dist[u]` es cierto (14 > 11), así que esa entrada quedó vieja cuando se encontró un camino mejor. Descartarla evita repetir trabajo; `dist` solo puede bajar, nunca subir.',
          en: '`d > dist[u]` is true (14 > 11), so that entry went stale when a better path was found. Discarding it avoids repeated work; `dist` can only go down, never up.',
        },
      } },
    { ...RESET, etiquetas: DIJ.final.etiquetas, code: C_CAMINO, line: 3, traza: CAM.frames,
      es: 'Para el **camino** se guarda `padre[v]` en cada relajación. Desde el destino se sube por `padre` hasta el origen (`-1`) y se invierte. De 0 a 4: 0 → 2 → 5 → 4, con coste 20. Reproduce la traza.',
      en: 'For the **path**, `padre[v]` is stored at every relaxation. From the destination you climb `padre` to the source (`-1`) and reverse it. From 0 to 4: 0 → 2 → 5 → 4, with cost 20. Play the trace.' },
    { est: sobreNodos(G_DIJ, i => (CAM.ruta.includes(i) ? 'camino' : 'visitado')),
      aristaEst: Object.fromEntries(CAM.ruta.slice(1).map((b, k) => [claveE(G_DIJ, CAM.ruta[k], b), 'camino'])), code: C_DIJ, line: 8,
      es: 'Coste: $O((V+E)\\log V)$, porque cada relajación que mejora hace un `push` de $O(\\log V)$ y hay como mucho una por arista (dos si no es dirigido). Con pesos **negativos** deja de valer que lo que sale de la cola sea definitivo. Para eso está Bellman-Ford, $O(V \\cdot E)$.',
      en: 'Cost: $O((V+E)\\log V)$, because each improving relaxation does a `push` of $O(\\log V)$ and there is at most one per edge (two if undirected). With **negative** weights, what leaves the queue is no longer guaranteed final. That is what Bellman-Ford is for, $O(V \\cdot E)$.' },
    { line: 8,
      es: '¿Por qué Dijkstra necesita pesos no negativos?',
      en: 'Why does Dijkstra need non-negative weights?',
      pregunta: {
        opc: [
          { es: 'Porque su prueba se apoya en que añadir aristas nunca acorta un camino: lo que sale de la cola ya no puede mejorar', en: 'Because its proof relies on adding edges never shortening a path: what leaves the queue can no longer improve', ok: 1 },
          { es: 'Porque `priority_queue` no admite números negativos', en: 'Because `priority_queue` does not accept negative numbers' },
          { es: 'Porque el montículo se desordenaría', en: 'Because the heap would get out of order' },
        ],
        why: {
          es: 'La cola admite negativos sin problema. Lo que falla es la garantía: con una arista negativa, un nodo ya fijado podría mejorarse después, y con un ciclo negativo alcanzable las distancias bajarían sin fin.',
          en: 'The queue handles negatives fine. What fails is the guarantee: with a negative edge, an already fixed node could improve later, and with a reachable negative cycle distances would drop forever.',
        },
      } },
    { ...RESET, line: null, jugar: jugarDijkstra,
      es: 'Haz clic en un nodo para elegir el **origen** y en otro para el **destino**; un tercer clic cambia de origen. Las etiquetas son las distancias mínimas; el camino se marca en azul. Las lecturas dan el coste y la ruta. ¿Cuál es el nodo más lejano del 0?',
      en: 'Click a node to pick the **source** and another for the **destination**; a third click changes the source. The labels are the minimum distances; the path is marked in blue. The readings give the cost and the route. Which node is farthest from 0?' },

    // ── 6. Árbol de expansión mínima ──
    { sec: { es: 'Árbol de expansión mínima', en: 'Minimum spanning tree' }, arbol: abre(G_MST), code: C_KRUSKAL, line: 1, leyenda: ['activo', 'camino', 'mal', 'aux'],
      es: 'Un **árbol de expansión** de un grafo conexo conecta todos los vértices con $V-1$ aristas y sin ciclos. El de **peso mínimo** sirve para tender cable o carreteras al menor coste. **Kruskal**: ordena las aristas por peso y coge cada una si no cierra un ciclo.',
      en: 'A **spanning tree** of a connected graph joins all vertices with $V-1$ edges and no cycles. The **minimum-weight** one is what you want to lay cable or roads at the least cost. **Kruskal**: sort the edges by weight and take each one if it does not close a cycle.' },
    { code: C_DSU, line: 4,
      es: '¿Cómo saber si una arista cierra un ciclo? Con **Union-Find**: cada grupo tiene un representante. `encontrar(x)` sube por `padre` hasta la raíz; `unir(a, b)` cuelga una raíz de la otra y devuelve `false` si ya eran la misma. Con unión por tamaño y compresión es casi $O(1)$; el detalle está en la guía de hashing y Union-Find.',
      en: 'How do we know whether an edge closes a cycle? With **Union-Find**: each group has a representative. `encontrar(x)` climbs `padre` to the root; `unir(a, b)` hangs one root under the other and returns `false` if they were the same. With union by size and compression it is almost $O(1)$; the detail is in the hashing and Union-Find guide.' },
    { code: C_KRUSKAL, line: 6, traza: KRU.frames,
      es: 'Reproduce Kruskal. La etiqueta `g` es el representante del grupo. Arista gruesa = entra en el árbol; extremos en rojo = ya estaban unidos y se descarta. Fíjate en 1–2 (peso 8): el 1 y el 2 ya están conectados a través del 4.',
      en: 'Play Kruskal. The `g` label is the group representative. Thick edge = it joins the tree; red ends = already joined and discarded. Look at 1–2 (weight 8): 1 and 2 are already connected through 4.' },
    { aristaEst: aristasVerdes(G_MST, Object.fromEntries(KRU.mst.map(([a, b]) => [claveE(G_MST, a, b), 'camino']))), etiquetas: null, line: 7,
      es: `Resultado: ${KRU.mst.length} aristas y peso ${KRU.total}. Es correcto por la **propiedad del corte**: si repartes los vértices en dos grupos, una arista de peso mínimo entre ellos pertenece a algún árbol mínimo. Coste: ordenar domina, $O(E \\log E)$; como $E \\le V^2$, es $O(E \\log V)$.`,
      en: `Result: ${KRU.mst.length} edges and weight ${KRU.total}. It is correct by the **cut property**: if you split the vertices into two groups, a minimum-weight edge between them belongs to some minimum tree. Cost: sorting dominates, $O(E \\log E)$; since $E \\le V^2$, that is $O(E \\log V)$.` },
    { line: null,
      es: 'El grafo tiene 7 vértices y es conexo. ¿Cuántas aristas tiene cualquiera de sus árboles de expansión?',
      en: 'The graph has 7 vertices and is connected. How many edges does any of its spanning trees have?',
      pregunta: {
        opc: [
          { es: '6', en: '6', ok: 1 },
          { es: '7', en: '7' },
          { es: 'Depende de los pesos', en: 'It depends on the weights' },
        ],
        why: {
          es: 'Un árbol con $n$ vértices tiene siempre $n-1$ aristas: con menos no conecta y con más hay un ciclo. Los pesos solo deciden cuáles; por eso Kruskal puede parar al llegar a $V-1$ aristas.',
          en: 'A tree with $n$ vertices always has $n-1$ edges: with fewer it does not connect and with more there is a cycle. Weights only decide which ones; that is why Kruskal can stop at $V-1$ edges.',
        },
      } },
    { ...RESET, code: C_KRUSKAL, line: 6, jugar: jugarKruskal,
      es: 'Ahora el algoritmo lo mueves tú: cada pulsación de **Siguiente arista** procesa la siguiente de la lista ordenada. Las lecturas dicen si entra o se descarta y cuánto pesa el árbol hasta ahora. ¿En qué arista se completa el árbol?',
      en: 'Now you drive the algorithm: each press of **Next edge** processes the next one in the sorted list. The readings say whether it joins or is discarded and how much the tree weighs so far. At which edge is the tree complete?' },

    // ── 7. Elegir algoritmo y errores típicos ──
    { sec: { es: 'Elegir algoritmo y errores típicos', en: 'Choosing an algorithm and typical mistakes' }, arbol: abre(G_BFS), code: '', line: null,
      es: '**Sin pesos, menos aristas**: BFS. **Ciclos, componentes, explorar todo**: DFS. **Dependencias**: Kahn. **Camino mínimo con pesos ≥ 0**: Dijkstra. **Con pesos negativos**: Bellman-Ford. **Conectar todo al menor coste**: Kruskal. BFS, DFS y Kahn cuestan $O(V+E)$; Dijkstra añade un $\\log V$ y Kruskal ordena.',
      en: '**No weights, fewest edges**: BFS. **Cycles, components, exploring everything**: DFS. **Dependencies**: Kahn. **Shortest path with weights ≥ 0**: Dijkstra. **With negative weights**: Bellman-Ford. **Connect everything at least cost**: Kruskal. BFS, DFS and Kahn cost $O(V+E)$; Dijkstra adds a $\\log V$ and Kruskal sorts.' },
    { line: null,
      es: 'Tienes un mapa de carreteras con la distancia en km de cada tramo. ¿Qué algoritmo usas para la ruta más corta entre dos ciudades?',
      en: 'You have a road map with the distance in km of each section. Which algorithm do you use for the shortest route between two cities?',
      pregunta: {
        opc: [
          { es: 'Dijkstra', en: 'Dijkstra', ok: 1 },
          { es: 'BFS', en: 'BFS' },
          { es: 'Kruskal', en: 'Kruskal' },
        ],
        why: {
          es: 'Los km son pesos no negativos: Dijkstra. BFS cuenta aristas (tramos), no km. Kruskal conecta todas las ciudades con el menor coste total, que no es lo mismo que la ruta más corta entre dos.',
          en: 'Kilometres are non-negative weights: Dijkstra. BFS counts edges (sections), not km. Kruskal connects all cities at the least total cost, which is not the same as the shortest route between two.',
        },
      } },
    { line: null,
      es: 'Un plan de estudios lista asignaturas con prerrequisitos. Quieres un orden para cursarlas todas, o saber si los requisitos son imposibles. ¿Qué usas?',
      en: 'A study plan lists courses with prerequisites. You want an order to take them all, or to know whether the requirements are impossible. What do you use?',
      pregunta: {
        opc: [
          { es: 'Orden topológico (Kahn): si no saca todas, hay un ciclo', en: 'Topological order (Kahn): if it does not take out all of them, there is a cycle', ok: 1 },
          { es: 'Kruskal sobre los prerrequisitos', en: 'Kruskal over the prerequisites' },
          { es: 'BFS desde la primera asignatura', en: 'BFS from the first course' },
        ],
        why: {
          es: 'Los prerrequisitos son aristas dirigidas y lo que se pide es un orden compatible con todas: un orden topológico. Kahn lo da y, si queda alguna asignatura sin colocar, los requisitos forman un ciclo.',
          en: 'Prerequisites are directed edges and what is asked is an order compatible with all of them: a topological order. Kahn gives it and, if some course is left unplaced, the requirements form a cycle.',
        },
      } },
    { code: C_BFS_MAL, line: 4, traza: BFS_MAL.frames, leyenda: ['activo', 'hecho', 'mal'],
      es: '**Error 1: marcar al sacar, no al encolar.** Un nodo que llega por dos caminos entra dos veces en la cola y se procesa dos veces; en un grafo denso la cola crece hasta $O(E)$. Reproduce la traza: el 4 y el 6 se procesan de más (`×k` = veces encolado).',
      en: '**Mistake 1: marking when dequeuing, not when queuing.** A node reached by two paths enters the queue twice and is processed twice; in a dense graph the queue grows up to $O(E)$. Play the trace: 4 and 6 are processed extra times (`×k` = times queued).' },
    { code: C_PILA, line: 3,
      es: '**Error 2: DFS recursivo en grafos enormes.** Una cadena de $10^6$ nodos hace $10^6$ llamadas anidadas: en C++ no hay `StackOverflowError`, el programa se cae. Aquí la pila es grande (256 MB), pero en concursos suele ser de 1 a 8 MB. Solución: pila explícita en el heap. El orden de visita puede cambiar.',
      en: '**Mistake 2: recursive DFS on huge graphs.** A chain of $10^6$ nodes makes $10^6$ nested calls: C++ has no `StackOverflowError`, the program crashes. Here the stack is big (256 MB), but in contests it is usually 1 to 8 MB. Fix: an explicit stack on the heap. The visit order may change.' },
    { code: C_INDICE, line: 2,
      es: '**Error 3: mezclar 0 y 1.** Los enunciados numeran los nodos de 1 a $n$, pero `g[n]` ya está fuera de `Grafo g(n)`: comportamiento indefinido, sin excepción. Elige una convención (restar 1 al leer, o reservar `n + 1` posiciones) y no la mezcles.',
      en: '**Mistake 3: mixing 0 and 1.** Statements number nodes from 1 to $n$, but `g[n]` is already outside `Grafo g(n)`: undefined behaviour, no exception. Pick one convention (subtract 1 when reading, or reserve `n + 1` slots) and do not mix them.' },
    { code: '', line: null,
      es: 'Resumen: casi siempre, lista de adyacencia (`vector<vector<int>>`); BFS, DFS y Kahn en $O(V+E)$; Dijkstra en $O((V+E)\\log V)$; Kruskal en $O(E\\log E)$. Muchos problemas son grafos disfrazados: laberintos, dependencias, redes, estados de un puzzle.',
      en: 'Summary: almost always, an adjacency list (`vector<vector<int>>`); BFS, DFS and Kahn in $O(V+E)$; Dijkstra in $O((V+E)\\log V)$; Kruskal in $O(E\\log E)$. Many problems are graphs in disguise: mazes, dependencies, networks, puzzle states.' },
  ],
};
