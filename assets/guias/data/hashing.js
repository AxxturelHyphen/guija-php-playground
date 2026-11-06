// Guía «Hashing y técnicas» (lecciones 06 §4–5 y 07 §6: tablas hash, sumas prefijas, Union-Find). Mismo formato de paso que
// data/punteros.js; escenas: celdas (tabla hash, sondeo, diferencias, tarjetas), barras (histograma, cumpleaños, prefijas,
// conjunto hash, dos sumas) y arbol (Union-Find en modo 'arbol'; grafo de Kruskal en modo 'libre').
// Las trazas salen de data/hashing-traza.js, que EJECUTA los algoritmos; los `jugar` también (modelo en hashing-traza.js).
// Convenciones: `—` = sin memoria / nodo libre · `·` = hueco vacío · tras una traza el estado NO persiste: el paso siguiente
// restaura con un parche (parcheTabla / parcheHacia).
import { reponer } from '../barras.js';
import {
  tr, CLAVES, M0, TablaHash, CELDAS_TABLA, GRUPOS_TABLA, ZONAS_TABLA, parcheTabla, valTabla, tablaDe, trazaBuscar, trazaBorrar, trazaRehash,
  trazaHistograma, pColision, pCumpleAprox, FACTORES, nDe, barrasCumple, trazaSondeo, CELDAS_SONDEO,
  ARR_PREF, prefijas, trazaPrefijas, CELDAS_DIF, trazaDiferencias,
  NUF, idU, aristasUF, abreBosque, UF, parcheHacia, trazaUnir, trazaFind, nodoEn,
  nodosG, aristaG, G_ARISTAS, trazaKruskal, trazaDistintos, trazaDosSumas, CELDAS_TARJETAS,
} from './hashing-traza.js';

const ids = (pre, n) => Array.from({ length: n }, (_, i) => pre + i);
const resalta = (k, lista) => Object.fromEntries(lista.map(i => [i, k]));

// ══ 1. Tabla hash con encadenamiento ═══════════════════════════════════════════════════════════════════════════════
const C1 = {
  es: `struct TablaHash {
    vector<list<int>> cubos;           // m cubos, cada uno con su cadena
    int n = 0, m;                      // claves guardadas y nº de cubos
    TablaHash(int m) : cubos(m), m(m) {}
    bool buscar(int k) const {
        for (int x : cubos[k % m]) if (x == k) return true;
        return false;
    }
    void insertar(int k) {
        if (buscar(k)) return;           // sin repetidos
        cubos[k % m].push_front(k);      // h(k) = k mod m
        if (++n > m) rehash(2 * m + 1);  // α > 1 (rehash, más abajo)
    }
};`,
  en: `struct TablaHash {
    vector<list<int>> cubos;           // m buckets, each with its chain
    int n = 0, m;                      // stored keys and number of buckets
    TablaHash(int m) : cubos(m), m(m) {}
    bool buscar(int k) const {
        for (int x : cubos[k % m]) if (x == k) return true;
        return false;
    }
    void insertar(int k) {
        if (buscar(k)) return;           // no repeated keys
        cubos[k % m].push_front(k);      // h(k) = k mod m
        if (++n > m) rehash(2 * m + 1);  // α > 1 (rehash, below)
    }
};`,
};
const C_BORRAR = {
  es: `void borrar(int k) {
    auto& cadena = cubos[k % m];
    for (auto it = cadena.begin(); it != cadena.end(); ++it)
        if (*it == k) { cadena.erase(it); n--; return; }
}`,
  en: `void borrar(int k) {
    auto& cadena = cubos[k % m];
    for (auto it = cadena.begin(); it != cadena.end(); ++it)
        if (*it == k) { cadena.erase(it); n--; return; }
}`,
};
const C_REHASH = {
  es: `void rehash(int m2) {
    vector<list<int>> nuevos(m2);        // m2 cubos vacíos
    for (auto& cubo : cubos)
        for (int k : cubo)
            nuevos[k % m2].push_front(k);   // con el módulo NUEVO
    cubos = move(nuevos);
    m = m2;
}`,
  en: `void rehash(int m2) {
    vector<list<int>> nuevos(m2);        // m2 empty buckets
    for (auto& cubo : cubos)
        for (int k : cubo)
            nuevos[k % m2].push_front(k);   // with the NEW modulus
    cubos = move(nuevos);
    m = m2;
}`,
};

const t0 = new TablaHash(M0);
const t1 = new TablaHash(M0); t1.insertar(12);
const t2 = t1.clon(); t2.insertar(9);
const t3 = t2.clon(); t3.insertar(7);
const t4 = t3.clon(); t4.colocar(19);          // n = 4 > m = 3: el rehash va en la traza siguiente
const t5 = trazaRehash(t4).tabla;
const J0 = new TablaHash(M0);
const TODOS = ['n', 'm', ...ids('b', 7), ...CLAVES.map(k => 'k' + k)];

// jugar: el modelo se lee de los valores de la escena y se vuelve a escribir (los botones solo mutan `v`)
function inserta(v, k) {
  const t = tablaDe(v), u = v._u, r = t.insertar(k);
  Object.assign(v, valTabla(t));
  v._u = { k, cubo: r.cubo, colision: r.colision, rehash: r.rehash, m0: r.rehash ? (t.m - 1) / 2 : t.m, reh: (u?.reh || 0) + (r.rehash ? 1 : 0) };
}
const juegoTabla = {
  botones: [
    ...CLAVES.map(k => ({ label: `insertar(${k})`, hacer: v => inserta(v, k), off: v => v['k' + k] !== '—' })),
    { label: { es: 'Reiniciar', en: 'Reset' }, hacer: v => { Object.assign(v, valTabla(new TablaHash(M0))); v._u = null; } },
  ],
  lecturas: v => {
    const t = tablaDe(v), u = v._u, largo = t.maxCadena();
    return [
      { expr: 'α = n / m', valor: `${t.n} / ${t.m} = ${(t.alfa).toFixed(2)}` },
      { expr: tr('cadena más larga (peor búsqueda)', 'longest chain (worst lookup)'), valor: `${largo} ${tr(largo === 1 ? 'nodo' : 'nodos', largo === 1 ? 'node' : 'nodes')}`, malo: largo >= 3 },
      { expr: tr('última clave', 'last key'), valor: u ? `${u.k} mod ${u.m0} = ${u.cubo}${u.colision ? tr(' · colisión', ' · collision') : tr(' · sin colisión', ' · no collision')}${u.rehash ? tr(` · rehash → m = ${t.m}`, ` · rehash → m = ${t.m}`) : ''}` : '—', malo: !!u?.colision },
      { expr: tr('rehashes hechos', 'rehashes so far'), valor: u?.reh || 0 },
    ];
  },
  hl: v => {
    const u = v._u, h = {};
    if (!u) return h;
    const t = tablaDe(v), j = u.k % t.m, ch = t.c[j];
    h['b' + j] = 'a'; h['k' + u.k] = 'b';
    if (ch.length > 1) for (const x of ch) if (x !== u.k) h['k' + x] = 'c';
    if (u.rehash) h.m = 'c';
    return h;
  },
};

// ══ 2. Distribución, cumpleaños, sondeo lineal ═════════════════════════════════════════════════════════════════════
const C_STR = {
  es: `size_t h(const string& s, size_t m) {
    size_t x = 0;
    for (char c : s) x = x * 31 + c;     // mezcla todos los caracteres
    return x % m;                        // el módulo elige el cubo
}`,
  en: `size_t h(const string& s, size_t m) {
    size_t x = 0;
    for (char c : s) x = x * 31 + c;     // mixes every character
    return x % m;                        // the modulus picks the bucket
}`,
};
const PATRON = Array.from({ length: 16 }, (_, i) => 4 * (i + 1));    // 4, 8, 12 … 64
const H8 = trazaHistograma(8, PATRON), H7 = trazaHistograma(7, PATRON);
const CONT_HIST = { claves: { es: 'claves', en: 'keys' }, vacios: { es: 'cubos vacíos', en: 'empty buckets' } };
const CONT_CUMPLE = { m: 'm', n: 'n', p: { es: 'P(colisión) %', en: 'P(collision) %' } };
const CUMPLE_M = [365, 1000, 1e6, 2 ** 32];
const estadoCumple = (v, m, i) => {
  const n = nDe(m, FACTORES[i]);
  reponer(v, barrasCumple(m));
  v.marcas = { n: i }; v.est = { [i]: 'piv' }; v.cont = { m, n, p: +(100 * pColision(m, n)).toFixed(1) };
};
const selCumple = v => v.marcas.n;
const fmtM = m => (m === 2 ** 32 ? '2³²' : m === 1e6 ? '10⁶' : m === 1000 ? '1 000' : String(m));
const juegoCumple = {
  botones: [
    ...CUMPLE_M.map(m => ({ label: `m = ${fmtM(m)}`, hacer: v => estadoCumple(v, m, selCumple(v)), off: v => v.cont.m === m })),
    { label: 'c ◀', hacer: v => estadoCumple(v, v.cont.m, selCumple(v) - 1), off: v => selCumple(v) <= 0 },
    { label: 'c ▶', hacer: v => estadoCumple(v, v.cont.m, selCumple(v) + 1), off: v => selCumple(v) >= FACTORES.length - 1 },
  ],
  lecturas: v => {
    const m = v.cont.m, i = selCumple(v), c = FACTORES[i], n = nDe(m, c), p = pColision(m, n);
    return [
      { expr: 'n = ⌈c·√m⌉', valor: `${c} · √${fmtM(m)} → n = ${n}` },
      { expr: tr('P(colisión)', 'P(collision)'), valor: `${(100 * p).toFixed(2)} %`, malo: p >= 0.5 },
      { expr: tr('cota 1 − e^(−n(n−1)/2m)', 'bound 1 − e^(−n(n−1)/2m)'), valor: `${(100 * pCumpleAprox(m, n)).toFixed(2)} %` },
      { expr: tr('pares que chocan (esperado)', 'colliding pairs (expected)'), valor: (n * (n - 1) / (2 * m)).toFixed(2) },
    ];
  },
};
const C_SONDEO = {
  es: `void insertar(int k) {
    int i = k % m;
    while (ranura[i] != VACIO)      // ocupada: probar la siguiente
        i = (i + 1) % m;            // con vuelta al principio
    ranura[i] = k;
}`,
  en: `void insertar(int k) {
    int i = k % m;
    while (ranura[i] != VACIO)      // taken: try the next one
        i = (i + 1) % m;            // wrapping around
    ranura[i] = k;
}`,
};
const C_MAPAS = {
  es: `map<string, int> ord;              // árbol rojo-negro: O(log n), ordenado
unordered_map<string, int> hs;     // tabla hash: O(1) de media
for (string w : {"pera", "uva", "kiwi"}) { ord[w]++; hs[w]++; }
for (auto& [w, c] : ord) cout << w;   // kiwi pera uva (siempre ordenado)
for (auto& [w, c] : hs)  cout << w;   // orden no especificado`,
  en: `map<string, int> ord;              // red-black tree: O(log n), ordered
unordered_map<string, int> hs;     // hash table: O(1) on average
for (string w : {"pera", "uva", "kiwi"}) { ord[w]++; hs[w]++; }
for (auto& [w, c] : ord) cout << w;   // kiwi pera uva (always ordered)
for (auto& [w, c] : hs)  cout << w;   // order not specified`,
};

// ══ 3. Sumas prefijas y diferencias ════════════════════════════════════════════════════════════════════════════════
const C_PREF = {
  es: `vector<long long> construir(const vector<int>& a) {
    vector<long long> P(a.size() + 1, 0);
    for (size_t i = 0; i < a.size(); i++)
        P[i + 1] = P[i] + a[i];
    return P;
}

long long suma(const vector<long long>& P, int l, int r) {
    return P[r + 1] - P[l];          // a[l] + ... + a[r]
}`,
  en: `vector<long long> construir(const vector<int>& a) {
    vector<long long> P(a.size() + 1, 0);
    for (size_t i = 0; i < a.size(); i++)
        P[i + 1] = P[i] + a[i];
    return P;
}

long long suma(const vector<long long>& P, int l, int r) {
    return P[r + 1] - P[l];          // a[l] + ... + a[r]
}`,
};
const C_DIF = {
  es: `void sumarRango(vector<long long>& d, int l, int r, int x) {
    d[l] += x;
    d[r + 1] -= x;               // O(1) por actualización
}
// al final: a[i] = d[0] + ... + d[i]   (sumas prefijas de d)`,
  en: `void sumarRango(vector<long long>& d, int l, int r, int x) {
    d[l] += x;
    d[r + 1] -= x;               // O(1) per update
}
// at the end: a[i] = d[0] + ... + d[i]   (prefix sums of d)`,
};
const C_2D = {
  es: `// p[f][c] = suma del rectángulo (0,0)..(f-1,c-1)
long long rect(const vector<vector<long long>>& p, int f1, int c1, int f2, int c2) {
    return p[f2 + 1][c2 + 1] - p[f1][c2 + 1] - p[f2 + 1][c1] + p[f1][c1];
}`,
  en: `// p[f][c] = sum of the rectangle (0,0)..(f-1,c-1)
long long rect(const vector<vector<long long>>& p, int f1, int c1, int f2, int c2) {
    return p[f2 + 1][c2 + 1] - p[f1][c2 + 1] - p[f2 + 1][c1] + p[f1][c1];
}`,
};
const P0 = prefijas(ARR_PREF), L0 = 2, R0 = 5;
const auxCompleto = Object.fromEntries(P0.map((x, i) => [i, x]));
const rangoEst = (l, r, n = ARR_PREF.length) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, i >= l && i <= r ? 'ok' : null]));
const ponRango = (v, l, r) => { v.marcas = { l, r }; v.rango = [l, r]; v.est = Object.fromEntries(Array.from({ length: ARR_PREF.length }, (_, i) => [i, i >= l && i <= r ? 'ok' : null])); };
const lecRango = v => v.marcas;
const juegoPref = {
  arrastrables: true,
  soltar: (v, desde, hasta) => ponRango(v, Math.min(desde, hasta), Math.max(desde, hasta)),
  botones: [
    { label: 'l −', hacer: v => ponRango(v, lecRango(v).l - 1, lecRango(v).r), off: v => lecRango(v).l <= 0 },
    { label: 'l +', hacer: v => ponRango(v, lecRango(v).l + 1, lecRango(v).r), off: v => lecRango(v).l >= lecRango(v).r },
    { label: 'r −', hacer: v => ponRango(v, lecRango(v).l, lecRango(v).r - 1), off: v => lecRango(v).r <= lecRango(v).l },
    { label: 'r +', hacer: v => ponRango(v, lecRango(v).l, lecRango(v).r + 1), off: v => lecRango(v).r >= ARR_PREF.length - 1 },
    { label: { es: 'Reiniciar', en: 'Reset' }, hacer: v => ponRango(v, L0, R0) },
  ],
  lecturas: v => {
    const { l, r } = lecRango(v), s = P0[r + 1] - P0[l], n = r - l + 1;
    return [
      { expr: '[l, r]', valor: `[${l}, ${r}]` },
      { expr: 'P[r+1] − P[l]', valor: `P[${r + 1}] − P[${l}] = ${P0[r + 1]} − ${P0[l]} = ${s}` },
      { expr: tr('suma directa', 'direct sum'), valor: `${ARR_PREF.slice(l, r + 1).join(' + ')} = ${s}` },
      { expr: tr('lecturas de P frente a sumandos', 'reads of P versus terms'), valor: `2 ${tr('frente a', 'vs')} ${n}` },
    ];
  },
};

// ══ 4. Union-Find ══════════════════════════════════════════════════════════════════════════════════════════════════
const C_UF0 = {
  es: `int encontrar(int x) {
    while (padre[x] != x) x = padre[x];     // subir hasta la raíz
    return x;
}
void unirIngenua(int a, int b) {
    padre[encontrar(a)] = encontrar(b);     // la raíz de a cuelga de la de b
}`,
  en: `int encontrar(int x) {
    while (padre[x] != x) x = padre[x];     // climb up to the root
    return x;
}
void unirIngenua(int a, int b) {
    padre[encontrar(a)] = encontrar(b);     // a's root hangs from b's root
}`,
};
const C_FIND = {
  es: `int encontrar(int x) {
    if (padre[x] == x) return x;
    padre[x] = encontrar(padre[x]);   // el camino queda apuntando a la raíz
    return padre[x];
}`,
  en: `int encontrar(int x) {
    if (padre[x] == x) return x;
    padre[x] = encontrar(padre[x]);   // the path ends up pointing to the root
    return padre[x];
}`,
};
const C_UF = {
  es: `struct UnionFind {
    vector<int> padre, tam;
    UnionFind(int n) : padre(n), tam(n, 1) { iota(padre.begin(), padre.end(), 0); }
    int encontrar(int x) {
        return padre[x] == x ? x : padre[x] = encontrar(padre[x]);   // compresión de caminos
    }
    bool unir(int a, int b) {
        a = encontrar(a); b = encontrar(b);
        if (a == b) return false;               // ya estaban juntos
        if (tam[a] < tam[b]) swap(a, b);        // el pequeño cuelga del grande
        padre[b] = a; tam[a] += tam[b];
        return true;
    }
};`,
  en: `struct UnionFind {
    vector<int> padre, tam;
    UnionFind(int n) : padre(n), tam(n, 1) { iota(padre.begin(), padre.end(), 0); }
    int encontrar(int x) {
        return padre[x] == x ? x : padre[x] = encontrar(padre[x]);   // path compression
    }
    bool unir(int a, int b) {
        a = encontrar(a); b = encontrar(b);
        if (a == b) return false;               // already together
        if (tam[a] < tam[b]) swap(a, b);        // the small one hangs from the big one
        padre[b] = a; tam[a] += tam[b];
        return true;
    }
};`,
};
const IDENT = new UF();
const CADENA = trazaUnir(IDENT, Array.from({ length: NUF - 1 }, (_, i) => [i, i + 1]), false);
const COMPRIMIDA = trazaFind(CADENA.uf, 0);
const PAREJAS = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [4, 6], [0, 4]];
const POR_TAM = trazaUnir(IDENT, PAREJAS, true);

// jugar: la escena `arbol` no deja a `vista` cambiar la estructura; se muta en sitio (el paso abre su propia escena).
const padresDe = cx => { const p = IDENT.p.slice(); for (const e of cx.arbol.aristas) p[+e.b.slice(1)] = +e.a.slice(1); return p; };
const ufDe = p => {
  const u = new UF(); u.p = [...p];
  const raiz = i => { while (p[i] !== i) i = p[i]; return i; };
  u.t = p.map((q, i) => (q === i ? p.filter((_, j) => raiz(j) === i).length : 1));  // tamaño del árbol de cada raíz
  return u;
};
const escribe = (cx, u) => { cx.arbol.aristas.length = 0; cx.arbol.aristas.push(...aristasUF(u.p)); };
const etiquetas = u => Object.fromEntries(u.p.flatMap((q, i) => (q === i && u.t[i] > 1 ? [[idU(i), `t=${u.t[i]}`]] : [])));
const unirJuego = (v, cx, a, b) => {
  const u = ufDe(padresDe(cx)), r = u.unir(a, b, v.metodo !== 'ing');
  escribe(cx, u); v.est = r.unido ? { [idU(r.padre)]: 'ok' } : {}; v.etiquetas = etiquetas(u);
  v._u = r.unido ? { es: `unir(${a}, ${b}): la raíz ${r.hijo} cuelga de la ${r.padre}`, en: `unir(${a}, ${b}): root ${r.hijo} hangs from ${r.padre}` } : { es: `unir(${a}, ${b}): ya estaban juntos`, en: `unir(${a}, ${b}): already together` };
};
const juegoUF = {
  arrastrables: true,
  soltar: (v, id, x, y, cx) => {
    const a = +id.slice(1), b = nodoEn(padresDe(cx), x, y, a);
    if (b >= 0) unirJuego(v, cx, a, b);
  },
  botones: [
    ...[[0, 1], [1, 2], [2, 3], [4, 5], [5, 6], [3, 6]].map(([a, b]) => ({ label: `unir(${a}, ${b})`, hacer: (v, cx) => unirJuego(v, cx, a, b) })),
    { label: { es: 'cambiar método', en: 'switch method' }, hacer: v => { v.metodo = v.metodo === 'ing' ? 'tam' : 'ing'; } },
    { label: { es: 'comprimir (encontrar(0))', en: 'compress (encontrar(0))' }, hacer: (v, cx) => {
      const u = ufDe(padresDe(cx)), { camino } = u.subir(0), r = u.encontrar(0);
      escribe(cx, u); v.etiquetas = etiquetas(u); v.est = resalta('camino', camino.map(idU));
      v._u = { es: `encontrar(0): ${r.saltos} salto${r.saltos === 1 ? '' : 's'}; el camino queda en 1 salto por nodo`, en: `encontrar(0): ${r.saltos} hop${r.saltos === 1 ? '' : 's'}; the path is left at 1 hop per node` };
    } },
    { label: { es: 'Reiniciar', en: 'Reset' }, hacer: (v, cx) => { cx.arbol.aristas.length = 0; v.est = {}; v.etiquetas = {}; v._u = null; } },
  ],
  lecturas: (v, cx) => {
    const u = ufDe(padresDe(cx)), h = u.altura();
    return [
      { expr: tr('conjuntos', 'sets'), valor: u.conjuntos() },
      { expr: tr('altura del bosque', 'forest height'), valor: h, malo: h >= 4 },
      { expr: tr('método de unión', 'union method'), valor: v.metodo === 'ing' ? tr('ingenua', 'naive') : tr('por tamaño', 'by size') },
      { expr: tr('última operación', 'last operation'), valor: v._u ? tr(v._u.es, v._u.en) : '—' },
    ];
  },
};

// ══ 5. Aplicaciones ════════════════════════════════════════════════════════════════════════════════════════════════
const C_COMP = `UnionFind uf(n);
for (auto [a, b] : aristas) uf.unir(a, b);
int componentes = 0;
for (int i = 0; i < n; i++)
    if (uf.encontrar(i) == i) componentes++;     // una raíz por componente`;
const C_KRUSKAL = {
  es: `sort(aristas.begin(), aristas.end());          // tuplas (peso, a, b)
UnionFind uf(n);
long long total = 0;
for (auto [peso, a, b] : aristas)
    if (uf.unir(a, b)) total += peso;            // solo si no cierra un ciclo`,
  en: `sort(aristas.begin(), aristas.end());          // tuples (weight, a, b)
UnionFind uf(n);
long long total = 0;
for (auto [peso, a, b] : aristas)
    if (uf.unir(a, b)) total += peso;            // only if it closes no cycle`,
};
const C_SET = `unordered_set<int> vistos;
for (int x : v) vistos.insert(x);       // insert ignora repetidos
cout << vistos.size();`;
const C_DOS = {
  es: `unordered_map<int, int> vistos;                 // valor → índice
for (int i = 0; i < n; i++) {
    int falta = objetivo - v[i];
    auto it = vistos.find(falta);
    if (it != vistos.end()) return {it->second, i};
    vistos[v[i]] = i;
}`,
  en: `unordered_map<int, int> vistos;                 // value → index
for (int i = 0; i < n; i++) {
    int falta = objetivo - v[i];
    auto it = vistos.find(falta);
    if (it != vistos.end()) return {it->second, i};
    vistos[v[i]] = i;
}`,
};
const G2 = G_ARISTAS.filter(e => !(['c-d', 'b-d'].includes(e[0] + '-' + e[1])));    // dos componentes
const G_ABRE = { modo: 'libre', nodos: nodosG(), aristas: G2.map(aristaG), lienzo: { W: 560, H: 300 } };
const KR = trazaKruskal('abcdef'.split(''), G_ARISTAS);
const V_DIST = [3, 1, 3, 2, 1, 3, 4], V_DOS = [4, 9, 2, 7, 5];

// ══ 6. Errores típicos ═════════════════════════════════════════════════════════════════════════════════════════════
const C_E1 = {
  es: `unordered_map<int, int> m = {{1, 10}, {2, 20}, {3, 30}};
for (auto& [k, v] : m)
    if (v == 20) m.erase(k);             // MAL: invalida el iterador del for

for (auto it = m.begin(); it != m.end(); ) {
    if (it->second == 20) it = m.erase(it);   // BIEN: erase devuelve el siguiente
    else ++it;
}`,
  en: `unordered_map<int, int> m = {{1, 10}, {2, 20}, {3, 30}};
for (auto& [k, v] : m)
    if (v == 20) m.erase(k);             // WRONG: invalidates the for's iterator

for (auto it = m.begin(); it != m.end(); ) {
    if (it->second == 20) it = m.erase(it);   // RIGHT: erase returns the next one
    else ++it;
}`,
};
const C_E2 = {
  es: `unordered_map<string, int> stock = {{"pan", 3}};
if (stock["leche"] > 0) { /* ... */ }      // crea "leche" con valor 0
cout << stock.size();                       // 2, no 1

if (stock.count("huevos")) { /* ... */ }    // consulta sin insertar
auto it = stock.find("pan");                // end() si no está`,
  en: `unordered_map<string, int> stock = {{"pan", 3}};
if (stock["leche"] > 0) { /* ... */ }      // creates "leche" with value 0
cout << stock.size();                       // 2, not 1

if (stock.count("huevos")) { /* ... */ }    // lookup without inserting
auto it = stock.find("pan");                // end() if absent`,
};
const C_E3 = {
  es: `vector<int> a(100000, 1000000000);
vector<int> P(a.size() + 1, 0);                  // MAL: int
vector<long long> Q(a.size() + 1, 0);            // BIEN
for (size_t i = 0; i < a.size(); i++) {
    P[i + 1] = P[i] + a[i];                      // desborda en la 3.ª suma
    Q[i + 1] = Q[i] + a[i];                      // llega a 10^14 sin problema
}`,
  en: `vector<int> a(100000, 1000000000);
vector<int> P(a.size() + 1, 0);                  // WRONG: int
vector<long long> Q(a.size() + 1, 0);            // RIGHT
for (size_t i = 0; i < a.size(); i++) {
    P[i + 1] = P[i] + a[i];                      // overflows at the 3rd sum
    Q[i + 1] = Q[i] + a[i];                      // reaches 10^14 with no problem
}`,
};

export default {
  titulo: { es: 'Hashing y técnicas', en: 'Hashing and techniques' },
  fuentes: [
    'Cormen, T. H., Leiserson, C. E., Rivest, R. L. y Stein, C. (2022). *Introduction to algorithms* (4.ª ed.). The MIT Press. (cap. 11, «Hash tables»; cap. 19, «Data structures for disjoint sets»).',
    'Sedgewick, R. y Wayne, K. (2011). *Algorithms* (4.ª ed.). Addison-Wesley. https://algs4.cs.princeton.edu/ (sec. 1.5, «Case study: Union-Find»; sec. 3.4, «Hash tables»).',
    'Tarjan, R. E. (1975). Efficiency of a good but not linear set union algorithm. *Journal of the ACM, 22*(2), 215–225. https://doi.org/10.1145/321879.321884',
    'Carter, J. L. y Wegman, M. N. (1979). Universal classes of hash functions. *Journal of Computer and System Sciences, 18*(2), 143–154. https://doi.org/10.1016/0022-0000(79)90044-8',
    'cppreference.com. (s. f.). *std::unordered_map*. Recuperado el 6 de noviembre de 2026, de https://en.cppreference.com/w/cpp/container/unordered_map',
  ],
  pasos: [
    // ── 1. Tabla hash con encadenamiento ──
    { sec: { es: 'Tabla hash con encadenamiento', en: 'Hash table with chaining' }, leyenda: ['activo', 'hecho', 'mal'],
      celdas: CELDAS_TABLA, zonas: ZONAS_TABLA, grupos: GRUPOS_TABLA, code: C1, line: null, ...parcheTabla(null, t0),
      es: 'Una **tabla hash** guarda claves en un array de **cubos**. Una función hash elige el cubo: $h(k) = k \\bmod m$, con $m$ cubos. Si dos claves caen en el mismo cubo (**colisión**), se **encadenan** en una lista. Aquí $m = 3$ y la tabla está vacía.',
      en: 'A **hash table** stores keys in an array of **buckets**. A hash function picks the bucket: $h(k) = k \\bmod m$, with $m$ buckets. If two keys land in the same bucket (a **collision**), they are **chained** in a list. Here $m = 3$ and the table is empty.' },
    { line: 11, ...parcheTabla(t0, t1), hl: { b0: 'a', k12: 'b' },
      es: '`insertar(12)`: $12 \\bmod 3 = 0$, así que va al cubo 0. La clave nueva se pone **delante** de la cadena, sin recorrerla: $O(1)$.',
      en: '`insertar(12)`: $12 \\bmod 3 = 0$, so it goes to bucket 0. The new key is put at the **front** of the chain, without walking it: $O(1)$.' },
    { line: 11, ...parcheTabla(t1, t2), hl: { b0: 'a', k9: 'b', k12: 'c' },
      es: '`insertar(9)`: $9 \\bmod 3 = 0$, el mismo cubo. **Colisión**: el 9 se enlaza delante del 12 y el cubo 0 pasa a tener una cadena de dos nodos. Buscar el 12 ahora cuesta dos comparaciones.',
      en: '`insertar(9)`: $9 \\bmod 3 = 0$, the same bucket. **Collision**: 9 is linked in front of 12 and bucket 0 now holds a chain of two nodes. Looking up 12 now takes two comparisons.' },
    { line: 11, ...parcheTabla(t2, t3), hl: { b1: 'a', k7: 'b' },
      es: '`insertar(7)`: $7 \\bmod 3 = 1$, cubo vacío, sin colisión. Ya hay $n = 3$ claves en $m = 3$ cubos.',
      en: '`insertar(7)`: $7 \\bmod 3 = 1$, empty bucket, no collision. There are now $n = 3$ keys in $m = 3$ buckets.' },
    { line: null, hl: { n: 'a', m: 'a' },
      es: 'El **factor de carga** es $\\alpha = n/m$: ahora $3/3 = 1$, una clave por cubo de media. Con una buena función hash, buscar cuesta $O(1+\\alpha)$ esperado: llegar al cubo y recorrer su cadena. Si todas cayeran en un cubo, $O(n)$ (peor caso).',
      en: 'The **load factor** is $\\alpha = n/m$: now $3/3 = 1$, one key per bucket on average. With a good hash function a lookup costs $O(1+\\alpha)$ expected: reach the bucket and walk its chain. If all keys fell into one bucket, $O(n)$ (worst case).' },
    { line: null, hl: { n: 'a', m: 'a' },
      es: 'Una tabla tiene $m = 1000$ cubos y $n = 2000$ claves repartidas de forma uniforme. ¿Cuántas claves tiene cada cadena de media?',
      en: 'A table has $m = 1000$ buckets and $n = 2000$ keys spread uniformly. How many keys does each chain hold on average?',
      pregunta: {
        opc: [
          { es: 'Unas 0,5', en: 'About 0.5' },
          { es: 'Unas 2', en: 'About 2', ok: 1 },
          { es: 'Unas 2000', en: 'About 2000' },
        ],
        why: {
          es: 'Es $\\alpha = n/m = 2$. Una búsqueda mira unos $1+\\alpha = 3$ nodos: sigue siendo constante, pero $\\alpha$ no puede crecer sin límite. De ahí el rehash.',
          en: 'It is $\\alpha = n/m = 2$. A lookup reads about $1+\\alpha = 3$ nodes: still constant, but $\\alpha$ cannot grow without bound. Hence the rehash.',
        },
      } },
    { line: 6, traza: trazaBuscar(t3, 12).frames, hl: { b0: 'a' },
      es: '`buscar(12)` paso a paso. El 12 está detrás del 9 en la cadena del cubo 0: dos comparaciones. Lo que cuesta una búsqueda es la **longitud de la cadena**, no el tamaño de la tabla.',
      en: '`buscar(12)` step by step. The 12 sits behind the 9 in the chain of bucket 0: two comparisons. What a lookup costs is the **chain length**, not the table size.' },
    { code: C_BORRAR, line: 2, traza: trazaBorrar(t3, 9).frames, hl: { b0: 'a' },
      es: '`borrar(9)`: se busca igual y se desenlaza el nodo. Borrar el 9 cuesta lo mismo que buscarlo: $O(1+\\alpha)$ esperado. En una lista enlazada no hay huecos que reordenar.',
      en: '`borrar(9)`: it searches the same way and unlinks the node. Erasing 9 costs the same as looking it up: $O(1+\\alpha)$ expected. In a linked list there are no gaps to rearrange.' },
    { code: C1, line: 12, ...parcheTabla(t3, t4), hl: { b1: 'a', k19: 'b', k7: 'c', n: 'c', m: 'c' },
      es: '`insertar(19)`: $19 \\bmod 3 = 1$, otra colisión (con el 7). Ahora $n = 4 > m = 3$, es decir $\\alpha = 4/3 > 1$. `unordered_map` usa 1 como máximo por defecto (`max_load_factor`): toca **rehash**.',
      en: '`insertar(19)`: $19 \\bmod 3 = 1$, another collision (with 7). Now $n = 4 > m = 3$, that is $\\alpha = 4/3 > 1$. `unordered_map` uses 1 as the default maximum (`max_load_factor`): time to **rehash**.' },
    { code: C_REHASH, line: 2, traza: trazaRehash(t4).frames,
      es: '**Rehash**: se reservan $2m+1 = 7$ cubos y cada clave se coloca otra vez con $k \\bmod 7$. Hay que recalcular el cubo de todas porque $m$ ha cambiado: una pasada, $O(n)$. (Aquí «2m+1» es solo el modelo; cada implementación elige su tamaño.)',
      en: '**Rehash**: $2m+1 = 7$ buckets are reserved and every key is placed again with $k \\bmod 7$. Every bucket must be recomputed because $m$ changed: one pass, $O(n)$. (Here «2m+1» is just the model; each implementation picks its own size.)' },
    { code: C1, line: null, ...parcheTabla(t4, t5), hl: { b5: 'c', m: 'a' },
      es: 'Tras el rehash: $m = 7$ y $\\alpha = 4/7 \\approx 0{,}57$. Siguen existiendo colisiones: el 12 y el 19 comparten cubo ($19 \\bmod 7 = 5$). Al **duplicar** el tamaño los rehashes son cada vez más raros: repartidos entre todas las inserciones dan $O(1)$ **amortizado**.',
      en: 'After the rehash: $m = 7$ and $\\alpha = 4/7 \\approx 0.57$. Collisions still exist: 12 and 19 share a bucket ($19 \\bmod 7 = 5$). By **doubling** the size, rehashes get rarer: spread over all insertions they give $O(1)$ **amortized**.' },
    { line: null,
      es: 'Para hacer menos rehashes, la tabla podría crecer solo de $m$ a $m+1$ cubos cada vez que $\\alpha$ pase del umbral, en vez de duplicarse. ¿Qué pasaría?',
      en: 'To do fewer rehashes, the table could grow only from $m$ to $m+1$ buckets whenever $\\alpha$ passes the threshold, instead of doubling. What would happen?',
      pregunta: {
        opc: [
          { es: 'Nada: el coste total sería el mismo', en: 'Nothing: the total cost would be the same' },
          { es: 'Insertar n claves costaría O(n²) en total', en: 'Inserting n keys would cost O(n²) in total', ok: 1 },
          { es: 'Cada búsqueda pasaría a costar O(n)', en: 'Every lookup would cost O(n)' },
        ],
        why: {
          es: 'Con $m+1$, casi cada inserción recoloca todas las claves: $O(n)$ por inserción y $O(n^2)$ en total. Al duplicar, los rehashes suman $1+2+4+\\dots \\le 2n$: $O(1)$ amortizado por inserción.',
          en: 'With $m+1$, almost every insertion places all keys again: $O(n)$ per insertion and $O(n^2)$ in total. By doubling, rehashes add up to $1+2+4+\\dots \\le 2n$: $O(1)$ amortized per insertion.',
        },
      } },
    { code: C1, line: null, mostrar: TODOS, val: valTabla(J0), ocultar: ['it'],
      es: 'Pruébalo tú: inserta las claves en cualquier orden y mira las colisiones, $\\alpha$ y cuándo salta el rehash (al pasar de 3 a 4 claves, $m$ pasa de 3 a 7). `—` = sin memoria o nodo libre. Tope: 7 claves.',
      en: 'Your turn: insert the keys in any order and watch the collisions, $\\alpha$ and when the rehash happens (going from 3 to 4 keys, $m$ goes from 3 to 7). `—` = no memory or free node. Limit: 7 keys.',
      jugar: juegoTabla },

    // ── 2. Función hash, cumpleaños, sondeo lineal ──
    { sec: { es: 'Qué hace buena a una función hash', en: 'What makes a good hash function' }, leyenda: ['compara'],
      barras: { arr: Array(8).fill(0), max: 8, etiquetas: true, etiquetasCont: CONT_HIST }, cont: { claves: 0, vacios: 8 }, code: C_STR, line: 4, traza: H8.frames,
      es: 'Una buena función hash es **determinista**, barata y **reparte** las claves de forma uniforme. Si las claves siguen un patrón, el módulo importa: aquí, 16 claves múltiplos de 4 con $m = 8$ (potencia de 2).',
      en: 'A good hash function is **deterministic**, cheap and **spreads** keys uniformly. If keys follow a pattern, the modulus matters: here, 16 keys that are multiples of 4 with $m = 8$ (a power of 2).' },
    { barras: { arr: Array(7).fill(0), max: 8, etiquetas: true, etiquetasCont: CONT_HIST }, cont: { claves: 0, vacios: 7 }, line: 4, traza: H7.frames,
      es: 'Las mismas 16 claves con $m = 7$ (primo): un primo no comparte factores con el patrón de las claves y el reparto es casi uniforme. Por eso algunas implementaciones (libstdc++) usan cubos primos; con potencia de 2 hay que mezclar bien los bits de la clave.',
      en: 'The same 16 keys with $m = 7$ (prime): a prime shares no factors with the key pattern and the spread is nearly uniform. That is why some implementations (libstdc++) use prime bucket counts; with a power of 2 the key bits must be mixed well.' },
    { line: null,
      es: 'Con $m = 8$ cubos, ¿en cuántos cubos distintos caen las claves 8, 16, 24, 32, 40…?',
      en: 'With $m = 8$ buckets, how many different buckets do the keys 8, 16, 24, 32, 40… fall into?',
      pregunta: {
        opc: [
          { es: 'En uno solo', en: 'Just one', ok: 1 },
          { es: 'En cuatro', en: 'Four' },
          { es: 'En los ocho', en: 'All eight' },
        ],
        why: {
          es: 'Todas son múltiplos de 8, así que $k \\bmod 8 = 0$: una sola cadena de $n$ nodos y búsqueda $O(n)$. Con un primo ($m = 7$) se repartirían por los siete cubos.',
          en: 'They are all multiples of 8, so $k \\bmod 8 = 0$: a single chain of $n$ nodes and $O(n)$ lookup. With a prime ($m = 7$) they would spread over all seven buckets.',
        },
      } },
    { leyenda: ['activo'], barras: { arr: barrasCumple(365), max: 100, etiquetasCont: CONT_CUMPLE }, marcas: { n: 3 }, est: { 3: 'piv' }, cont: { m: 365, n: nDe(365, 1), p: +(100 * pColision(365, nDe(365, 1))).toFixed(1) }, code: '', line: null,
      es: 'Aunque la función sea perfecta, las colisiones llegan antes de lo que parece. Con $n$ claves en $m$ cubos uniformes: $P = 1 - \\prod_{i=0}^{n-1}\\left(1-\\frac{i}{m}\\right) \\approx 1 - e^{-n(n-1)/2m}$. Con $n \\approx 1{,}18\\sqrt{m}$ ya vale 0,5. Cada barra es un $n$ distinto; su altura es $P$ en %.',
      en: 'Even with a perfect function, collisions arrive sooner than they seem to. With $n$ keys in $m$ uniform buckets: $P = 1 - \\prod_{i=0}^{n-1}\\left(1-\\frac{i}{m}\\right) \\approx 1 - e^{-n(n-1)/2m}$. With $n \\approx 1.18\\sqrt{m}$ it is already 0.5. Each bar is a different $n$; its height is $P$ in %.' },
    { line: null,
      es: 'Elige $m$ y un tamaño $n = \\lceil c\\sqrt{m}\\,\\rceil$ (cada barra es un $c$ distinto, de 0,25 a 3). Compara la probabilidad de colisión con la cota. El 50 % llega con $c \\approx 1{,}18$ sea cual sea $m$.',
      en: 'Pick $m$ and a size $n = \\lceil c\\sqrt{m}\\,\\rceil$ (each bar is a different $c$, from 0.25 to 3). Compare the collision probability with the bound. 50 % arrives at $c \\approx 1.18$ whatever $m$ is.',
      jugar: juegoCumple },
    { line: null,
      es: 'Una tabla tiene $m = 10^6$ cubos y una función hash perfectamente uniforme. ¿Con cuántas claves es más probable tener al menos una colisión que no tenerla?',
      en: 'A table has $m = 10^6$ buckets and a perfectly uniform hash function. With how many keys is it more likely to have at least one collision than none?',
      pregunta: {
        opc: [
          { es: 'Unas 1 200', en: 'About 1,200', ok: 1 },
          { es: 'Unas 500 000', en: 'About 500,000' },
          { es: 'Casi 1 000 000', en: 'Almost 1,000,000' },
        ],
        why: {
          es: 'Con $n = 1178 \\approx 1{,}18\\sqrt{m}$ claves ya es $P \\ge 0{,}5$. Las colisiones aparecen con $O(\\sqrt{m})$ claves: hay que contar con ellas, no evitarlas.',
          en: 'With $n = 1178 \\approx 1.18\\sqrt{m}$ keys it is already $P \\ge 0.5$. Collisions appear with $O(\\sqrt{m})$ keys: you must plan for them, not avoid them.',
        },
      } },
    { celdas: CELDAS_SONDEO, zonas: [{ col: 0, titulo: { es: 'array de ranuras (sin cadenas)', en: 'array of slots (no chains)' }, tono: 'datos' }], code: C_SONDEO, line: null,
      mostrar: ids('s', 7), val: Object.fromEntries(ids('s', 7).map(s => [s, '·'])), traza: trazaSondeo(7, [12, 19, 26]).frames,
      es: 'Alternativa al encadenamiento: **sondeo lineal** (direccionamiento abierto). Todo vive en el propio array: si la ranura está ocupada, se prueba la siguiente. Con 12, 19 y 26 (los tres dan $k \\bmod 7 = 5$) se forma un grupo contiguo que sigue creciendo.',
      en: 'An alternative to chaining: **linear probing** (open addressing). Everything lives in the array itself: if the slot is taken, try the next one. With 12, 19 and 26 (all give $k \\bmod 7 = 5$) a contiguous cluster forms and keeps growing.' },
    { line: null,
      es: 'Con sondeo lineal $\\alpha$ no puede pasar de 1, y cuanto más se acerca, más largos los grupos: conviene mantenerlo bien por debajo. Borrar exige dejar una marca («lápida»), no un hueco: un hueco cortaría la búsqueda de claves que pasaron por esa ranura.',
      en: 'With linear probing $\\alpha$ cannot exceed 1, and the closer it gets, the longer the clusters: keep it well below. Erasing needs a marker («tombstone»), not a gap: a gap would cut the search for keys that passed through that slot.' },
    { code: C_MAPAS, line: null,
      es: '`unordered_map` (tabla hash): búsqueda, inserción y borrado en $O(1)$ de media y $O(n)$ en el peor caso, recorrido en orden no especificado. `map` (árbol): $O(\\log n)$ garantizado y claves **ordenadas** (`lower_bound`, rangos). Sin necesidad de orden, el hash.',
      en: '`unordered_map` (hash table): lookup, insertion and erasure in $O(1)$ on average and $O(n)$ in the worst case, traversal in unspecified order. `map` (tree): guaranteed $O(\\log n)$ and **sorted** keys (`lower_bound`, ranges). If you do not need order, use the hash.',
      pregunta: {
        opc: [
          { es: '`map`', en: '`map`', ok: 1 },
          { es: '`unordered_map`', en: '`unordered_map`' },
          { es: 'Da igual, cuestan lo mismo', en: 'It does not matter, same cost' },
        ],
        why: {
          es: 'Listar las palabras en orden alfabético y usar `lower_bound` pide claves ordenadas: es el caso de `map`. En un `unordered_map` habría que volcarlas a un vector y ordenarlas.',
          en: 'Listing words alphabetically and using `lower_bound` needs sorted keys: that is `map`. With an `unordered_map` you would have to copy them into a vector and sort.',
        },
      } },
    { line: null,
      es: 'Una función hash **predecible** es un riesgo: se pueden preparar claves que caigan todas en un cubo y convertir $O(1)$ en $O(n)$ (en los concursos se hace). Defensas: hash con semilla aleatoria (familias universales, Carter y Wegman, 1979) o `map` si el peor caso importa.',
      en: 'A **predictable** hash function is a risk: keys can be crafted to land in a single bucket, turning $O(1)$ into $O(n)$ (it happens in contests). Defenses: a hash with a random seed (universal families, Carter and Wegman, 1979) or `map` if the worst case matters.' },

    // ── 3. Sumas prefijas ──
    { sec: { es: 'Sumas prefijas', en: 'Prefix sums' }, leyenda: ['compara', 'hecho'],
      barras: { arr: ARR_PREF, aux: 9, max: 31, estilo: 'cajas', etiquetas: true }, code: C_PREF, line: 2, traza: trazaPrefijas(ARR_PREF).frames,
      es: 'Muchas consultas «suma de $a_l$ a $a_r$» sobre un array fijo: sumar cada vez cuesta $O(n)$. Truco: precalcular $P[i]$ = suma de los primeros $i$ elementos (fila `aux`). Se construye una vez en $O(n)$ y cada consulta cuesta $O(1)$.',
      en: 'Many «sum of $a_l$ to $a_r$» queries over a fixed array: summing every time costs $O(n)$. Trick: precompute $P[i]$ = sum of the first $i$ elements (the `aux` row). It is built once in $O(n)$ and each query costs $O(1)$.' },
    { code: C_PREF, line: 9, aux: auxCompleto, marcas: { l: L0, r: R0 }, rango: [L0, R0], est: rangoEst(L0, R0),
      es: 'La suma de $a_l$ a $a_r$ es $\\sum_{i=l}^{r} a_i = P[r+1]-P[l]$: del total hasta $r$ quitas lo anterior a $l$. Con $l=2$, $r=5$: $P[6]-P[2] = 23-4 = 19$, que es $4+1+5+9$.',
      en: 'The sum of $a_l$ to $a_r$ is $\\sum_{i=l}^{r} a_i = P[r+1]-P[l]$: from the total up to $r$ you remove what comes before $l$. With $l=2$, $r=5$: $P[6]-P[2] = 23-4 = 19$, which is $4+1+5+9$.' },
    { line: 9, marcas: { l: 1, r: 3 }, rango: [1, 3], est: rangoEst(1, 3),
      es: 'Con $P = [0, 3, 4, 8, 9, 14, 23, 25, 31]$, ¿cuánto suman $a[1]$, $a[2]$ y $a[3]$?',
      en: 'With $P = [0, 3, 4, 8, 9, 14, 23, 25, 31]$, how much do $a[1]$, $a[2]$ and $a[3]$ add up to?',
      pregunta: {
        opc: [{ es: '6', en: '6', ok: 1 }, { es: '8', en: '8' }, { es: '9', en: '9' }],
        why: {
          es: '$P[4]-P[1] = 9-3 = 6 = 1+4+1$. El 8 sería $P[3]$ (falta el último) y el 9 es $P[4]$ (sobra $a[0]$, que está antes de $l$).',
          en: '$P[4]-P[1] = 9-3 = 6 = 1+4+1$. The 8 would be $P[3]$ (the last one is missing) and 9 is $P[4]$ (it includes $a[0]$, which comes before $l$).',
        },
      } },
    { line: 9, marcas: { l: L0, r: R0 }, rango: [L0, R0], est: rangoEst(L0, R0),
      es: 'Pruébalo tú: mueve $l$ y $r$ con los botones, o arrastra una caja sobre otra (el rango va de una a otra). Lee los dos prefijos que se usan y la suma. A mano serían $r-l+1$ sumas; con $P$ son siempre dos lecturas.',
      en: 'Your turn: move $l$ and $r$ with the buttons, or drag one box onto another (the range goes from one to the other). Read the two prefixes used and the sum. By hand it would be $r-l+1$ additions; with $P$ it is always two reads.',
      jugar: juegoPref },
    { celdas: CELDAS_DIF, zonas: [{ col: 0, titulo: { es: 'd: diferencias', en: 'd: differences' }, tono: 'datos' }, { col: 1, titulo: { es: 'a: resultado', en: 'a: result' }, tono: 'datos' }],
      code: C_DIF, line: null, mostrar: [...ids('d', 9), ...ids('a', 8)], val: { ...Object.fromEntries(ids('d', 9).map(k => [k, 0])), ...Object.fromEntries(ids('a', 8).map(k => [k, '·'])) },
      traza: trazaDiferencias(8, [{ l: 2, r: 5, x: 5 }, { l: 4, r: 7, x: 3 }]).frames,
      es: 'Al revés: muchas **actualizaciones** de rango («suma $x$ a $a_l, \\dots, a_r$») y una sola lectura al final. Con un array de **diferencias** $d$, cada actualización toca solo dos huecos: `d[l] += x` y `d[r+1] -= x`. Después, $a$ son las sumas prefijas de $d$.',
      en: 'The other way round: many range **updates** («add $x$ to $a_l, \\dots, a_r$») and a single read at the end. With a **difference** array $d$, each update touches only two slots: `d[l] += x` and `d[r+1] -= x`. Afterwards, $a$ is the prefix sums of $d$.' },
    { line: null, val: { d2: 5, d4: 3, d6: -5, d8: -3, a0: 0, a1: 0, a2: 5, a3: 5, a4: 8, a5: 8, a6: 3, a7: 3 },
      es: 'Tras las dos actualizaciones, $a = [0, 0, 5, 5, 8, 8, 3, 3]$, igual que aplicar cada una a mano. Coste: $O(1)$ por actualización y $O(n)$ una sola vez para reconstruir, en lugar de $O(n)$ por actualización.',
      en: 'After the two updates, $a = [0, 0, 5, 5, 8, 8, 3, 3]$, the same as applying each one by hand. Cost: $O(1)$ per update and $O(n)$ once to rebuild, instead of $O(n)$ per update.' },
    { code: C_2D, line: 3,
      es: 'En 2D es la misma idea: $p[f][c]$ acumula el rectángulo desde $(0,0)$ y cualquier rectángulo sale por inclusión-exclusión con cuatro lecturas, $O(1)$. Y usa `long long`: con $10^5$ valores de hasta $10^9$ la suma llega a $10^{14}$ y un `int` desborda sin avisar.',
      en: 'In 2D it is the same idea: $p[f][c]$ accumulates the rectangle from $(0,0)$ and any rectangle comes from inclusion-exclusion with four reads, $O(1)$. And use `long long`: with $10^5$ values up to $10^9$ the sum reaches $10^{14}$ and an `int` overflows silently.' },

    // ── 4. Union-Find ──
    { sec: { es: 'Union-Find: conjuntos disjuntos', en: 'Union-Find: disjoint sets' }, leyenda: ['activo', 'camino', 'hecho'],
      arbol: abreBosque(IDENT.p), code: C_UF0, line: null,
      es: 'Union-Find mantiene una partición de $\\{0,\\dots,7\\}$ en conjuntos. Cada elemento guarda su **padre**; la raíz (su propio padre) es el **representante**. `encontrar(x)` sube hasta la raíz; `unir(a, b)` junta dos conjuntos. Al inicio, 8 conjuntos de un elemento.',
      en: 'Union-Find keeps a partition of $\\{0,\\dots,7\\}$ into sets. Each element stores its **parent**; the root (its own parent) is the **representative**. `encontrar(x)` climbs to the root; `unir(a, b)` joins two sets. At the start, 8 one-element sets.' },
    { line: 6, traza: CADENA.frames,
      es: 'Unión **ingenua**: la raíz de $a$ cuelga de la raíz de $b$. Uniendo (0,1), (1,2), (2,3)… cada paso es barato, pero mira la forma que sale.',
      en: '**Naive** union: the root of $a$ hangs from the root of $b$. Joining (0,1), (1,2), (2,3)… each step is cheap, but look at the shape that comes out.' },
    { line: 2, ...parcheHacia(IDENT, CADENA.uf),
      es: 'El bosque es una **lista**: altura 7. `encontrar(0)` sube 7 aristas: $O(n)$. Con $n-1$ uniones así, $n$ búsquedas cuestan $O(n^2)$ en total.',
      en: 'The forest is a **list**: height 7. `encontrar(0)` climbs 7 edges: $O(n)$. With $n-1$ unions like this, $n$ lookups cost $O(n^2)$ in total.' },
    { line: 2,
      es: 'En esa cadena de $n$ nodos, ¿cuántas aristas sube `encontrar` desde el nodo más lejano de la raíz?',
      en: 'In that chain of $n$ nodes, how many edges does `encontrar` climb from the node farthest from the root?',
      pregunta: {
        opc: [
          { es: 'Una', en: 'One' },
          { es: 'Unas log n', en: 'About log n' },
          { es: 'n − 1', en: 'n − 1', ok: 1 },
        ],
        why: {
          es: 'Cada nodo apunta solo al siguiente: hay que seguir los $n-1$ enlaces hasta la raíz. Una de las dos optimizaciones (o las dos) evita esto.',
          en: 'Each node points only to the next one: all $n-1$ links must be followed up to the root. One of the two optimizations (or both) avoids this.',
        },
      } },
    { code: C_FIND, line: 3, traza: COMPRIMIDA.frames,
      es: '**Compresión de caminos**: al volver de `encontrar`, cada nodo del camino pasa a colgar directamente de la raíz. Esta primera búsqueda sube 7 aristas, pero deja el árbol casi plano.',
      en: '**Path compression**: on the way back from `encontrar`, every node of the path is re-pointed to hang directly from the root. This first lookup climbs 7 edges but leaves the tree almost flat.' },
    { line: 4, ...parcheHacia(CADENA.uf, COMPRIMIDA.uf),
      es: 'Tras `encontrar(0)` todos cuelgan de la raíz 7: las siguientes búsquedas cuestan 1 salto. El camino largo se paga una vez y no se repite.',
      en: 'After `encontrar(0)` everything hangs from root 7: the next lookups cost 1 hop. The long path is paid once and never repeated.' },
    { code: C_UF, line: 8, ...parcheHacia(COMPRIMIDA.uf, IDENT, true), traza: POR_TAM.frames,
      es: 'Unión **por tamaño**: el árbol pequeño cuelga del grande, y `t` es el tamaño de cada raíz. Uniones: (0,1), (2,3), (4,5), (6,7), (0,2), (4,6), (0,4). La altura solo crece al unir árboles igual de grandes.',
      en: 'Union **by size**: the small tree hangs from the big one, and `t` is the size of each root. Unions: (0,1), (2,3), (4,5), (6,7), (0,2), (4,6), (0,4). The height grows only when equal-sized trees are joined.' },
    { line: 11, ...parcheHacia(IDENT, POR_TAM.uf, true),
      es: 'Con 8 elementos la altura queda en 3 = $\\log_2 8$. Con unión por tamaño la altura es siempre $O(\\log n)$: un nodo solo baja un nivel cuando su árbol se une a otro al menos igual de grande, y su tamaño al menos se duplica.',
      en: 'With 8 elements the height is 3 = $\\log_2 8$. With union by size the height is always $O(\\log n)$: a node only goes one level deeper when its tree joins one at least as large, and its size at least doubles.' },
    { line: null,
      es: 'Con las dos optimizaciones, $m$ operaciones sobre $n$ elementos cuestan $O(m\\,\\alpha(n))$ en total (Tarjan, 1975). $\\alpha$ es la inversa de la función de Ackermann: crece tan despacio que $\\alpha(n) \\le 4$ para cualquier $n$ razonable. En la práctica, constante.',
      en: 'With both optimizations, $m$ operations on $n$ elements cost $O(m\\,\\alpha(n))$ in total (Tarjan, 1975). $\\alpha$ is the inverse of the Ackermann function: it grows so slowly that $\\alpha(n) \\le 4$ for any reasonable $n$. In practice, constant.' },
    { arbol: abreBosque(IDENT.p), code: C_UF, line: null,
      es: 'Une tú los nodos: arrastra uno sobre otro o usa los botones. Cambia entre unión ingenua y por tamaño y compara la altura del bosque. `comprimir` ejecuta `encontrar(0)` con compresión.',
      en: 'Join the nodes yourself: drag one onto another or use the buttons. Switch between naive and by-size union and compare the forest height. `compress` runs `encontrar(0)` with compression.',
      jugar: juegoUF },
    { arbol: abreBosque(IDENT.p), code: C_UF, line: 10,
      es: 'Se unen siempre en este orden: 0-1, 1-2, 2-3, … 6-7, con **unión por tamaño**. ¿Qué altura tiene el bosque al final?',
      en: 'They are always joined in this order: 0-1, 1-2, 2-3, … 6-7, with **union by size**. What height does the forest end up with?',
      pregunta: {
        opc: [
          { es: '7, una lista', en: '7, a list' },
          { es: '3', en: '3' },
          { es: '1, una estrella', en: '1, a star', ok: 1 },
        ],
        why: {
          es: 'Cada elemento nuevo es un árbol de tamaño 1 y la raíz 0 siempre es mayor: es el nuevo el que cuelga de 0. Queda una estrella de altura 1; la unión ingenua daba 7.',
          en: 'Each new element is a tree of size 1 and root 0 is always larger: it is the new one that hangs from 0. A star of height 1 remains; naive union gave 7.',
        },
      } },

    // ── 5. Aplicaciones ──
    { sec: { es: 'Aplicaciones', en: 'Applications' }, leyenda: ['hecho', 'camino', 'mal'],
      arbol: G_ABRE, est: { a: 'ok', b: 'ok', c: 'ok', d: 'camino', e: 'camino', f: 'camino' }, code: C_COMP, line: null,
      es: '**Componentes conexas**: se unen los extremos de cada arista y se cuentan las raíces. Aquí hay dos: {a, b, c} y {d, e, f}. `encontrar(x) == encontrar(y)` responde «¿están conectados?» en casi $O(1)$, sin recorrer el grafo.',
      en: '**Connected components**: join the endpoints of every edge and count the roots. Here there are two: {a, b, c} and {d, e, f}. `encontrar(x) == encontrar(y)` answers «are they connected?» in almost $O(1)$, without walking the graph.' },
    { est: { a: 'mal', b: null, c: 'mal', d: null, e: null, f: null }, aristaEst: { 'a-b': 'camino', 'b-c': 'camino', 'a-c': 'activa' }, line: null,
      es: 'Detectar **ciclos** en un grafo no dirigido: si `unir` devuelve `false`, los extremos ya estaban conectados y esa arista cierra un ciclo. Tras `a-b` y `b-c`, la arista `a-c` falla: es la tercera del triángulo.',
      en: 'Detecting **cycles** in an undirected graph: if `unir` returns `false`, the endpoints were already connected and that edge closes a cycle. After `a-b` and `b-c`, the edge `a-c` fails: it is the third one of the triangle.' },
    { est: null, aristaEst: null, '+aristas': [aristaG(['c', 'd', 1]), aristaG(['b', 'd', 7])], code: C_KRUSKAL, line: null, traza: KR.frames,
      es: '**Kruskal** (árbol generador mínimo; lo verás en la guía de grafos): ordena las aristas por peso y acepta cada una si `unir` tiene éxito. Union-Find hace cada comprobación en casi $O(1)$; el coste lo domina el orden, $O(E\\log E)$.',
      en: '**Kruskal** (minimum spanning tree; you will see it in the graphs guide): sort the edges by weight and accept each one if `unir` succeeds. Union-Find does each check in almost $O(1)$; the cost is dominated by the sort, $O(E\\log E)$.' },
    { leyenda: ['compara', 'hecho'], barras: { arr: V_DIST, aux: V_DIST.length, max: 4, estilo: 'cajas', etiquetasCont: { distintos: { es: 'distintos', en: 'distinct' } } }, cont: { distintos: 0 }, code: C_SET, line: 1, traza: trazaDistintos(V_DIST).frames,
      es: 'Contar elementos **distintos**: un conjunto hash (`unordered_set`) ignora los repetidos y su `size()` es la respuesta. Una pasada, $O(n)$ esperado, frente a ordenar y comparar vecinos, $O(n\\log n)$. La fila `aux` es el conjunto.',
      en: 'Counting **distinct** elements: a hash set (`unordered_set`) ignores repeats and its `size()` is the answer. One pass, $O(n)$ expected, versus sorting and comparing neighbors, $O(n\\log n)$. The `aux` row is the set.' },
    { barras: { arr: V_DOS, aux: V_DOS.length, max: 9, estilo: 'cajas', etiquetas: true }, code: C_DOS, line: 1, traza: trazaDosSumas(V_DOS, 12).frames,
      es: '**Dos sumas** ($v_i + v_j = 12$): en una pasada, para cada $x$ se pregunta si $12 - x$ ya está en la tabla. $O(n)$ esperado y $O(n)$ de memoria. Alternativa: ordenar y usar dos punteros, $O(n\\log n)$ y sin memoria extra.',
      en: '**Two sum** ($v_i + v_j = 12$): in one pass, for each $x$ ask whether $12 - x$ is already in the table. $O(n)$ expected and $O(n)$ memory. Alternative: sort and use two pointers, $O(n\\log n)$ with no extra memory.' },

    // ── 6. Cierre ──
    { sec: { es: 'Cierre: qué estructura uso', en: 'Wrap-up: which structure do I use' },
      celdas: CELDAS_TARJETAS, code: '', line: null, mostrar: CELDAS_TARJETAS.map(c => c.id),
      val: { cu: 'O(1)', cm: 'O(log n)', cp: 'O(1)', cf: 'O(α(n))', cs: 'O(n log n)' }, hl: { cu: 'b' },
      es: 'Cada técnica cambia memoria por tiempo. `unordered_map`/`set` para «¿lo he visto?» y para contar; `map`/`set` si importa el orden; sumas prefijas para rangos sin cambios; Union-Find para grupos que se fusionan; ordenar y dos punteros si no quieres memoria extra.',
      en: 'Each technique trades memory for time. `unordered_map`/`set` for «have I seen it?» and for counting; `map`/`set` if order matters; prefix sums for ranges with no updates; Union-Find for groups that merge; sort and two pointers if you want no extra memory.' },
    { line: null, hl: { cf: 'b' },
      es: 'Se van añadiendo carreteras entre ciudades y, tras cada una, hay que decir si dos ciudades concretas están ya conectadas. ¿Qué estructura usas?',
      en: 'Roads are added between cities one by one and, after each one, you must tell whether two given cities are already connected. Which structure do you use?',
      pregunta: {
        opc: [
          { es: '`unordered_map`', en: '`unordered_map`' },
          { es: 'Sumas prefijas', en: 'Prefix sums' },
          { es: 'Union-Find', en: 'Union-Find', ok: 1 },
        ],
        why: {
          es: 'Cada carretera es un `unir` y cada pregunta un `encontrar(a) == encontrar(b)`, ambos en casi $O(1)$. Con un grafo normal habría que recorrerlo (BFS) tras cada carretera: $O(n+E)$ por pregunta.',
          en: 'Each road is a `unir` and each question an `encontrar(a) == encontrar(b)`, both in almost $O(1)$. With a plain graph you would have to traverse it (BFS) after every road: $O(n+E)$ per question.',
        },
      } },
    { code: C_E1, line: 3,
      es: '**Error típico 1**: modificar el contenedor mientras lo recorres. `m.erase(k)` dentro de un `for (auto& …)` invalida el iterador en uso: comportamiento indefinido. Usa el iterador que devuelve `erase` o, desde C++20, `erase_if`.',
      en: '**Typical mistake 1**: modifying the container while iterating it. `m.erase(k)` inside a `for (auto& …)` invalidates the iterator in use: undefined behavior. Use the iterator that `erase` returns or, since C++20, `erase_if`.' },
    { code: C_E2, line: 2,
      es: '**Error típico 2**: `operator[]` **inserta** la clave si no existe (con valor 0), aunque solo quisieras mirarla. Para consultar sin tocar la tabla usa `find`, `count` o, desde C++20, `contains`. ¿Qué imprime el `size()` del listado?',
      en: '**Typical mistake 2**: `operator[]` **inserts** the key if it is missing (with value 0), even if you only wanted to look. To query without touching the table use `find`, `count` or, since C++20, `contains`. What does the `size()` in the listing print?',
      pregunta: {
        opc: [{ es: '1', en: '1' }, { es: '2', en: '2', ok: 1 }, { es: '0', en: '0' }],
        why: {
          es: '`stock["leche"]` creó la entrada «leche» con valor 0, así que hay dos: «pan» y «leche». Una simple consulta con `[]` modificó la tabla.',
          en: '`stock["leche"]` created the «leche» entry with value 0, so there are two: «pan» and «leche». A plain lookup with `[]` modified the table.',
        },
      } },
    { code: C_E3, line: 5,
      es: '**Error típico 3**: acumular sumas prefijas en `int`. Con $10^5$ valores de $10^9$, `P` desborda (comportamiento indefinido) en la tercera suma y las consultas devuelven basura. Usa `long long` para $P$, aunque los datos sean `int`.',
      en: '**Typical mistake 3**: accumulating prefix sums in `int`. With $10^5$ values of $10^9$, `P` overflows (undefined behavior) at the third sum and queries return garbage. Use `long long` for $P$, even if the data are `int`.' },
  ],
};
