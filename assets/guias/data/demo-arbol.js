// Guía demo de la escena «arbol» (assets/guias/arbol.js). Ejercita todos los parches (+nodos, +aristas, -nodos, -aristas,
// val, etiquetas, est, aristaEst, notas), los dos modos (arbol y libre), cabida, trazas generadas ejecutando el algoritmo
// (fib, ABB, montículo, Dijkstra) y un `jugar` con nodos arrastrables. Formato completo en la cabecera de arbol.js.
import { arbolVacio, arbolCompleto, arbolDeArray, insertarABB, buscarABB, borrarABB, cabidaDe, cabidaMax, claveArista as K } from '../arbol.js';

const f = (o, es, en, line) => ({ ...o, es, en, ...(line != null && { line }) });
const val = (T, id) => T.nodos.find(n => n.id === id).val;

// ── 1. Árbol de llamadas de fib: se ejecuta la recursión de verdad y cada llamada es un frame ─────────────────────
const C_FIB = `int fib(int n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}`;

/** Ejecuta fib(n0) y devuelve {frames, arbol (final)}. Llamada = nodo; activo = en curso, camino = pila, ok = terminada. */
function fibLlamadas(n0) {
  const F = [], T = { nodos: [{ id: 'c0', val: `fib(${n0})` }], aristas: [], raiz: 'c0' };
  let k = 1;
  const llamar = (m, lado, padre, n) => {
    const id = 'c' + k++, nodo = { id, val: `fib(${m})` }, arista = { a: padre, b: id, lado };
    T.nodos.push(nodo); T.aristas.push(arista);
    F.push(f({ '+nodos': [nodo], '+aristas': [arista], est: { [padre]: 'camino', [id]: 'activo' } }, `fib(${n}) llama a fib(${m}).`, `fib(${n}) calls fib(${m}).`, 3));
    return id;
  };
  const volver = (id, padre, n, v, es, en, line) =>
    F.push(f({ est: { [id]: 'ok', ...(padre && { [padre]: 'activo' }) }, etiquetas: { [id]: '=' + v } }, es, en, line));
  const rec = (n, id, padre) => {
    if (n < 2) { volver(id, padre, n, n, `fib(${n}) es un caso base: devuelve ${n}.`, `fib(${n}) is a base case: it returns ${n}.`, 2); return n; }
    const a = rec(n - 1, llamar(n - 1, 'i', id, n), id), b = rec(n - 2, llamar(n - 2, 'd', id, n), id), v = a + b;
    volver(id, padre, n, v, `fib(${n}) = ${a} + ${b} = ${v}.`, `fib(${n}) = ${a} + ${b} = ${v}.`, 3);
    return v;
  };
  F.push(f({ est: { c0: 'activo' } }, `Llamamos a fib(${n0}).`, `We call fib(${n0}).`, 1));
  rec(n0, 'c0', null);
  return { frames: F, arbol: T };
}
const FIB4 = fibLlamadas(4), FIB5 = fibLlamadas(5);
// Llamadas repetidas (mismo texto, no hoja): las marcamos como trabajo repetido
const repetidas = T => {
  const por = {};
  for (const n of T.nodos) (por[n.val] ??= []).push(n.id);
  return Object.entries(por).filter(([v, ids]) => ids.length > 1 && !/\((0|1)\)/.test(v)).flatMap(([, ids]) => ids);
};
const resultados = T => Object.fromEntries(T.nodos.map(n => [n.id, '=' + fibNum(T, n.id)]));
const fibNum = (T, id) => { const n = +val(T, id).match(/\d+/)[0], fib = x => (x < 2 ? x : fib(x - 1) + fib(x - 2)); return fib(n); };

// ── 2. Memoización: partimos del árbol completo y se podan las ramas que ya están en la tabla ──────────────────────
const C_MEMO = `int memo[64];            // 0 = aún sin calcular
int fib(int n) {
    if (n < 2) return n;
    if (memo[n]) return memo[n];
    return memo[n] = fib(n - 1) + fib(n - 2);
}`;
function memoPoda(T) {
  const hijos = id => T.aristas.filter(e => e.a === id).map(e => e.b), desc = id => hijos(id).flatMap(c => [c, ...desc(c)]);
  const memo = new Map(), F = [];
  const vis = (id, padre) => {
    const n = +val(T, id).match(/\d+/)[0], d = desc(id);
    const marca = { [id]: 'activo', ...(padre && { [padre]: 'camino' }) };
    if (n < 2) { F.push(f({ est: { ...marca, [id]: 'ok' }, etiquetas: { [id]: '=' + n } }, `fib(${n}) es un caso base: devuelve ${n}.`, `fib(${n}) is a base case: it returns ${n}.`, 3)); return n; }
    if (memo.has(n)) {
      const v = memo.get(n);
      if (!d.length) F.push(f({ est: { ...marca, [id]: 'visitado' }, etiquetas: { [id]: '=' + v } }, `fib(${n}) ya está en la tabla: devuelve ${v} sin llamar a nadie.`, `fib(${n}) is already in the table: it returns ${v} without calling anyone.`, 4));
      else {
        F.push(f({ est: marca, etiquetas: { [id]: '=' + v } }, `fib(${n}) ya está en la tabla (${v}): no hace falta calcularlo otra vez.`, `fib(${n}) is already in the table (${v}): no need to compute it again.`, 4));
        F.push(f({ '-nodos': d, est: { [id]: 'visitado' } }, `Se podan sus ${d.length} llamadas: ese trabajo ya no se hace.`, `Its ${d.length} calls are pruned: that work is no longer done.`, 4));
      }
      return v;
    }
    F.push(f({ est: marca }, `Calculamos fib(${n}) por primera vez.`, `We compute fib(${n}) for the first time.`, 5));
    const v = hijos(id).reduce((s, c) => s + vis(c, id), 0);
    memo.set(n, v);
    F.push(f({ est: { [id]: 'ok' }, etiquetas: { [id]: '=' + v } }, `fib(${n}) = ${v}; se guarda en la tabla.`, `fib(${n}) = ${v}; it is stored in the table.`, 5));
    return v;
  };
  vis(T.raiz, null);
  return F;
}

// ── 3. Árbol por niveles (teorema maestro): T(n) = 2T(n/2) + n ─────────────────────────────────────────────────────
const TM = arbolCompleto(4, nv => ['n', 'n/2', 'n/4', 'n/8'][nv]);
const nivelIds = nv => TM.nodos.filter((_, i) => Math.floor(Math.log2(i + 1)) === nv).map(n => n.id);
const NOTAS_TM = [
  { nivel: 0, texto: { es: 'nivel 0: n', en: 'level 0: n' } },
  { nivel: 1, texto: { es: 'nivel 1: n/2 + n/2 = n', en: 'level 1: n/2 + n/2 = n' } },
  { nivel: 2, texto: { es: 'nivel 2: 4 · n/4 = n', en: 'level 2: 4 · n/4 = n' } },
  { nivel: 3, texto: { es: 'nivel 3: 8 · n/8 = n', en: 'level 3: 8 · n/8 = n' } },
];
const activarNivel = nv => ({ est: { ...Object.fromEntries(TM.nodos.map(n => [n.id, 'ok']).slice(0, 2 ** nv - 1)), ...Object.fromEntries(nivelIds(nv).map(id => [id, 'activo'])) } });
const TRAZA_TM = [
  f({ est: { m0: 'activo' } }, 'En la raíz se divide el problema y se combinan los resultados: cuesta n.', 'At the root the problem is split and the results combined: it costs n.'),
  ...[1, 2, 3].map(nv => f({ ...activarNivel(nv), notas: NOTAS_TM.slice(0, nv + 1) },
    [`Nivel 1: 2 subproblemas de tamaño n/2; el trabajo de combinar suma n/2 + n/2 = n.`, 'Nivel 2: 4 subproblemas de tamaño n/4; cada uno cuesta n/4, en total n.', 'Nivel 3: 8 subproblemas de tamaño n/8; otra vez n en total.'][nv - 1],
    ['Level 1: 2 subproblems of size n/2; the combine work adds up to n/2 + n/2 = n.', 'Level 2: 4 subproblems of size n/4; each costs n/4, n in total.', 'Level 3: 8 subproblems of size n/8; n in total again.'][nv - 1])),
  f({ est: Object.fromEntries(TM.nodos.map(n => [n.id, 'ok'])), etiquetas: { m0: 'n log n' } }, 'Cada nivel cuesta n y hay log n niveles: T(n) = n · log n.', 'Every level costs n and there are log n levels: T(n) = n · log n.'),
];

// ── 4. ABB: inserción, búsqueda y borrado ejecutando el algoritmo ──────────────────────────────────────────────────
const C_INS = `Nodo* insertar(Nodo* t, int x) {
    if (!t) return new Nodo(x);
    if (x < t->val) t->izq = insertar(t->izq, x);
    else if (x > t->val) t->der = insertar(t->der, x);
    return t;
}`;
const C_BUS = `Nodo* buscar(Nodo* t, int x) {
    if (!t || t->val == x) return t;
    if (x < t->val) return buscar(t->izq, x);
    return buscar(t->der, x);
}`;
const C_BOR = `// borrar x del ABB: según sus hijos
// 0 hijos: se quita la hoja
// 1 hijo: el hijo ocupa su lugar
// 2 hijos: copia el sucesor (el menor de la derecha) y bórralo`;
const VALORES = [8, 4, 12, 2, 6, 10, 14, 5];
const lado = (x, v) => (x < v ? { es: 'izquierda', en: 'left' } : { es: 'derecha', en: 'right' });

/** Frames de insertar `valores` uno a uno: baja resaltando el camino (est + aristaEst) y engancha el nodo nuevo. */
function trazaInsertar(valores, T0 = arbolVacio()) {
  const F = []; let T = T0, previo = { est: [], ar: [] };
  for (const x of valores) {
    const r = insertarABB(T, x), nulos = ks => Object.fromEntries(ks.map(k => [k, null])), cur = { est: [], ar: [] };
    const marca = (est, ar) => { cur.est.push(...Object.keys(est)); cur.ar.push(...Object.keys(ar || {})); return { est, ...(ar && { aristaEst: ar }) }; };
    if (r.camino.length === 0) {
      F.push(f({ ...r.parche, ...marca({ [r.nodo.id]: 'ok' }), est: { ...nulos(previo.est), [r.nodo.id]: 'ok' } }, `El árbol está vacío: el ${x} es la raíz.`, `The tree is empty: ${x} becomes the root.`, 2));
    } else {
      r.camino.forEach((id, i) => {
        const v = val(T, id), d = lado(x, v), ant = r.camino[i - 1];
        F.push(f({
          est: { ...(i ? {} : nulos(previo.est)), ...(ant && { [ant]: 'camino' }), [id]: 'activo' },
          aristaEst: { ...(i ? {} : nulos(previo.ar)), ...(ant && { [K(ant, id)]: 'camino' }) },
        }, `${x} ${x < v ? '<' : '>'} ${v}: bajamos por la ${d.es}.`, `${x} ${x < v ? '<' : '>'} ${v}: we go ${d.en}.`, x < v ? 3 : 4));
        cur.est.push(id); if (ant) cur.ar.push(K(ant, id));
      });
      F.push(f({ ...r.parche, est: { [r.camino.at(-1)]: 'camino', [r.nodo.id]: 'ok' }, aristaEst: { [K(r.arista.a, r.arista.b)]: 'camino' } },
        `Hueco libre: aquí se cuelga el ${x}.`, `Free slot: ${x} is attached here.`, 2));
      cur.est.push(r.nodo.id); cur.ar.push(K(r.arista.a, r.arista.b));
    }
    previo = cur; T = r.arbol;
  }
  return { frames: F, arbol: T };
}
const ABB = trazaInsertar(VALORES);
const ABB_PARCHE = { '+nodos': ABB.arbol.nodos, '+aristas': ABB.arbol.aristas }; // «así queda»: el paso siguiente restablece el estado

function trazaBuscar(T, x) {
  const b = buscarABB(T, x), F = [];
  b.camino.forEach((id, i) => {
    const v = val(T, id), ant = b.camino[i - 1], hallado = v === x;
    F.push(f({
      est: { ...(ant && { [ant]: 'camino' }), [id]: hallado ? 'ok' : 'activo' },
      ...(ant && { aristaEst: { [K(ant, id)]: 'camino' } }),
    }, hallado ? `${v} = ${x}: ¡encontrado!` : `${x} ${x < v ? '<' : '>'} ${v}: seguimos por la ${lado(x, v).es}.`, hallado ? `${v} = ${x}: found!` : `${x} ${x < v ? '<' : '>'} ${v}: we continue ${lado(x, v).en}.`, hallado ? 2 : x < v ? 3 : 4));
  });
  return F;
}

function trazaBorrar(T, x) {
  const d = borrarABB(T, x), F = trazaBuscar(T, x).slice(0, -1);
  F.push(f({ est: { [d.camino.at(-2)]: 'camino', [d.id]: 'mal' }, aristaEst: { [K(d.camino.at(-2), d.id)]: 'camino' } }, `Encontramos el ${x}, pero tiene dos hijos: no se puede quitar sin más.`, `We found ${x}, but it has two children: it cannot simply be removed.`, 4));
  d.caminoSucesor.forEach((id, i) => F.push(f({
    est: { ...(i ? { [d.caminoSucesor[i - 1]]: 'camino' } : {}), [id]: 'activo' },
    aristaEst: { [K(i ? d.caminoSucesor[i - 1] : d.id, id)]: 'camino' },
  }, i + 1 < d.caminoSucesor.length ? `Buscamos el sucesor: el menor de la derecha. Bajamos siempre a la izquierda.` : `El sucesor es el ${val(T, d.sucesor)}: no tiene hijo izquierdo.`,
  i + 1 < d.caminoSucesor.length ? 'We look for the successor: the smallest on the right. Always go left.' : `The successor is ${val(T, d.sucesor)}: it has no left child.`, 4)));
  F.push(f({ val: d.parche.val, est: { [d.id]: 'ok', [d.sucesor]: 'mal' } }, `Copiamos el ${val(T, d.sucesor)} en el nodo del ${x}: el orden se mantiene.`, `We copy ${val(T, d.sucesor)} into the node of ${x}: the order is kept.`, 4));
  F.push(f({ '-nodos': d.parche['-nodos'], ...(d.parche['+aristas'] && { '+aristas': d.parche['+aristas'] }) }, `Y quitamos la hoja del sucesor, que sí es fácil de borrar.`, `And we remove the successor leaf, which is easy to delete.`, 4));
  F.push(f({ est: null, aristaEst: null }, 'El árbol sigue siendo un ABB.', 'The tree is still a BST.'));
  return { frames: F, parche: d.parche, arbol: d.arbol };
}
const BORRADO = trazaBorrar(ABB.arbol, 4);

// Degenerado: valores ya ordenados
const DEG = (() => {
  const F = []; let T = arbolVacio();
  for (let x = 1; x <= 7; x++) {
    const r = insertarABB(T, x), id = r.nodo.id;
    F.push(f({ ...r.parche, est: { ...(x > 1 && { [T.nodos.at(-1).id]: 'visitado' }), [id]: 'activo' }, etiquetas: { n1: `h=${x - 1}` } },
      x === 1 ? 'Empezamos con el 1: la raíz.' : `${x} es mayor que todos: baja siempre por la derecha. La altura sube a ${x - 1}.`,
      x === 1 ? 'We start with 1: the root.' : `${x} is larger than all of them: it always goes right. The height grows to ${x - 1}.`, x === 1 ? 2 : 4));
    T = r.arbol;
  }
  return { frames: F, arbol: T };
})();

// ── 5. Montículo en vista de árbol: subir un elemento (sift-up) ────────────────────────────────────────────────────
const C_HEAP = `void subir(vector<int>& h, int i) {
    while (i > 0 && h[(i - 1) / 2] > h[i]) {
        swap(h[(i - 1) / 2], h[i]);
        i = (i - 1) / 2;
    }
}`;
const HEAP0 = [2, 5, 3, 9, 6, 8, 4];
const trazaHeap = (arr0, x) => {
  const h = [...arr0, x], F = [], n = arr0.length, nuevo = { id: 'h' + n, val: x };
  F.push(f({ '+nodos': [nuevo], '+aristas': [{ a: 'h' + ((n - 1) >> 1), b: nuevo.id, lado: n % 2 ? 'i' : 'd' }], etiquetas: { [nuevo.id]: `[${n}]` }, est: { [nuevo.id]: 'activo' } },
    `Insertamos el ${x} al final del array, posición ${n}: es hoja, hijo del nodo ${h[(n - 1) >> 1]}.`, `We insert ${x} at the end of the array, position ${n}: a leaf, child of node ${h[(n - 1) >> 1]}.`, 1));
  for (let i = n; i > 0 && h[(i - 1) >> 1] > h[i];) {
    const p = (i - 1) >> 1, a = 'h' + i, b = 'h' + p;
    F.push(f({ aristaEst: { [K(b, a)]: 'activa' }, est: { [b]: 'mal' } }, `${h[i]} < ${h[p]}: el hijo es menor que su padre, rompe la regla del montículo.`, `${h[i]} < ${h[p]}: the child is smaller than its parent, which breaks the heap rule.`, 2));
    [h[i], h[p]] = [h[p], h[i]];
    F.push(f({ val: { [a]: h[i], [b]: h[p] }, aristaEst: null, est: { [a]: 'visitado', [b]: p ? 'activo' : 'ok' } }, `Los intercambiamos: el ${h[p]} sube un nivel.`, `We swap them: ${h[p]} moves up one level.`, 3));
    i = p;
  }
  F.push(f({ est: null }, 'El padre ya es menor o igual: el montículo vuelve a cumplir la regla.', 'The parent is already smaller or equal: the heap rule holds again.', 5));
  return F;
};
const HEAP_FINAL = arbolDeArray([...HEAP0, 0]);

// ── 6. Grafo en modo libre: pesos, dirección y Dijkstra ───────────────────────────────────────────────────────────
const P = (id, v, x, y) => ({ id, val: v, x, y });
const GRAFO = {
  modo: 'libre', lienzo: { W: 640, H: 380 },
  nodos: [P('a', 'A', 0, .5), P('b', 'B', .33, 0), P('c', 'C', .33, 1), P('d', 'D', .67, .5), P('e', 'E', 1, .5)],
  aristas: [['a', 'b', 4], ['a', 'c', 2], ['c', 'b', 1], ['b', 'd', 5], ['c', 'd', 8], ['d', 'e', 3], ['e', 'd', 3]].map(([a, b, peso]) => ({ a, b, peso, dir: true })),
};
const NOMBRE = Object.fromEntries(GRAFO.nodos.map(n => [n.id, n.val]));
function trazaDijkstra(G, origen) {
  const dist = Object.fromEntries(G.nodos.map(n => [n.id, Infinity])), prev = {}, hecho = new Set(), F = [];
  dist[origen] = 0;
  let anterior = null;
  while (true) {
    const u = G.nodos.map(n => n.id).filter(i => !hecho.has(i) && dist[i] < Infinity).sort((p, q) => dist[p] - dist[q])[0];
    if (!u) break;
    hecho.add(u);
    F.push(f({ est: { ...(anterior && { [anterior]: 'visitado' }), [u]: 'activo' }, aristaEst: null }, `Sacamos ${NOMBRE[u]}, el pendiente más cercano (distancia ${dist[u]}).`, `We take ${NOMBRE[u]}, the closest pending node (distance ${dist[u]}).`));
    for (const e of G.aristas.filter(e => e.a === u && !hecho.has(e.b))) {
      const nd = dist[u] + e.peso, mejora = nd < dist[e.b];
      if (mejora) { dist[e.b] = nd; prev[e.b] = u; }
      F.push(f({ aristaEst: { [K(u, e.b)]: 'activa' }, ...(mejora && { etiquetas: { [e.b]: String(nd) } }) },
        mejora ? `${NOMBRE[u]} → ${NOMBRE[e.b]} cuesta ${e.peso}: ${NOMBRE[e.b]} baja a ${nd}.` : `${NOMBRE[u]} → ${NOMBRE[e.b]} cuesta ${e.peso}: ${nd} no mejora ${dist[e.b]}.`,
        mejora ? `${NOMBRE[u]} → ${NOMBRE[e.b]} costs ${e.peso}: ${NOMBRE[e.b]} drops to ${nd}.` : `${NOMBRE[u]} → ${NOMBRE[e.b]} costs ${e.peso}: ${nd} does not improve ${dist[e.b]}.`));
    }
    anterior = u;
  }
  const destino = 'e', ruta = [];
  for (let c = destino; c; c = prev[c]) ruta.unshift(c);
  const usadas = ruta.slice(1).map((c, i) => K(ruta[i], c));
  F.push(f({ est: { ...Object.fromEntries(G.nodos.map(n => [n.id, 'visitado'])), ...Object.fromEntries(ruta.map(i => [i, 'camino'])) }, aristaEst: Object.fromEntries(usadas.map(k => [k, 'camino'])) },
    `El camino más corto hasta ${NOMBRE[destino]} cuesta ${dist[destino]}: ${ruta.map(i => NOMBRE[i]).join(' → ')}.`, `The shortest path to ${NOMBRE[destino]} costs ${dist[destino]}: ${ruta.map(i => NOMBRE[i]).join(' → ')}.`));
  F.push(f({ '-aristas': G.aristas.map(e => K(e.a, e.b)).filter(k => !usadas.includes(k)) }, 'Nos quedamos solo con las aristas del camino: el resto desaparece y el grafo no se mueve.', 'We keep only the path edges: the rest disappear and the graph does not move.'));
  return F;
}
const nodosEn = (est, v) => Object.fromEntries(Object.keys(est).map(k => [k, v]));

// ── Guía ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export default {
  titulo: { es: 'Demo árbol', en: 'Tree demo' },
  pasos: [
    // ── Árbol de llamadas ──
    { sec: { es: 'Árbol de llamadas', en: 'Call tree' },
      arbol: { nodos: [FIB4.arbol.nodos[0]], aristas: [], raiz: 'c0', cabida: cabidaDe(FIB4.arbol) },
      code: C_FIB, line: null, hl: { c0: 'a' },
      es: 'Cada llamada recursiva es un **nodo** y cada llamada que hace es una arista hacia sus hijos. Así se ve *qué* hace `fib(4)` y cuánto trabajo cuesta.',
      en: 'Every recursive call is a **node** and each call it makes is an edge to its children. This shows *what* `fib(4)` does and how much work it costs.' },
    { traza: FIB4.frames,
      es: 'Reproduce la traza: el árbol **crece** con cada llamada. El anillo marca la llamada en curso, el borde grueso la pila de llamadas y la marca verde las ya terminadas.',
      en: 'Play the trace: the tree **grows** with every call. The ring marks the running call, the thick border the call stack and the green mark the finished ones.' },
    { '+nodos': FIB4.arbol.nodos.slice(1), '+aristas': FIB4.arbol.aristas, etiquetas: resultados(FIB4.arbol),
      est: { ...nodosEn(resultados(FIB4.arbol), 'ok'), ...nodosEn(Object.fromEntries(repetidas(FIB4.arbol).map(i => [i, 1])), 'mal') }, line: null,
      es: 'Mira `fib(2)`: se calcula **dos veces** (borde discontinuo) y `fib(1)` tres. Con `fib(40)` el árbol tiene más de 300 millones de nodos: casi todo es trabajo repetido.',
      en: 'Look at `fib(2)`: it is computed **twice** (dashed border) and `fib(1)` three times. With `fib(40)` the tree has over 300 million nodes: nearly all of it is repeated work.' },

    // ── Memoización ──
    { sec: { es: 'Memoización', en: 'Memoization' },
      arbol: { nodos: FIB5.arbol.nodos, aristas: FIB5.arbol.aristas, raiz: 'c0', cabida: cabidaDe(FIB5.arbol) },
      code: C_MEMO, line: null, traza: memoPoda(FIB5.arbol),
      es: 'Si guardamos cada resultado en una tabla, una llamada repetida **corta la rama**: devuelve el valor guardado y no genera hijos. Mira cómo el árbol de `fib(5)` se poda.',
      en: 'If we store every result in a table, a repeated call **cuts the branch**: it returns the stored value and creates no children. Watch the `fib(5)` tree get pruned.',
      pregunta: {
        opc: [
          { es: 'Unas 2n llamadas: crece de forma lineal', en: 'About 2n calls: it grows linearly', ok: 1 },
          { es: 'Sigue siendo exponencial, solo más rápida', en: 'Still exponential, just faster' },
          { es: 'Unas n² llamadas', en: 'About n² calls' },
        ],
        why: { es: 'Cada valor distinto se calcula una vez (n valores) y cada cálculo hace a lo sumo 2 llamadas: O(n) en lugar de O(2ⁿ).', en: 'Each distinct value is computed once (n values) and each computation makes at most 2 calls: O(n) instead of O(2ⁿ).' } } },

    // ── Teorema maestro ──
    { sec: { es: 'Árbol por niveles', en: 'Level tree' },
      arbol: { ...TM, cabida: { ...cabidaDe(TM), notas: true }, notas: NOTAS_TM.slice(0, 1) },
      code: '', line: null, traza: TRAZA_TM,
      es: 'Para $T(n)=2T(n/2)+n$ dibujamos el árbol por **niveles** y sumamos el coste de cada uno. A la derecha se anota el trabajo de cada nivel.',
      en: 'For $T(n)=2T(n/2)+n$ we draw the tree by **levels** and add up the cost of each one. The work of every level is noted on the right.' },

    // ── ABB ──
    { sec: { es: 'Árbol binario de búsqueda', en: 'Binary search tree' },
      arbol: { ...arbolVacio(), cabida: cabidaMax(ABB.arbol) },
      code: C_INS, line: null, traza: ABB.frames,
      es: 'En un **ABB** lo menor va a la izquierda y lo mayor a la derecha. Insertar es bajar comparando hasta encontrar un hueco: el camino queda resaltado.',
      en: 'In a **BST** smaller values go left and larger ones go right. Inserting is walking down comparing until a free slot is found: the path stays highlighted.' },
    { ...ABB_PARCHE, code: C_BUS, line: null, traza: trazaBuscar(ABB.arbol, 6),
      es: 'Buscar sigue el mismo camino. En cada nodo se descarta **medio árbol**, igual que en la búsqueda binaria, mientras el árbol esté equilibrado.',
      en: 'Searching follows the same path. At each node **half the tree** is discarded, as in binary search, as long as the tree is balanced.' },
    { code: C_BOR, line: null, traza: BORRADO.frames,
      es: 'Borrar un nodo con dos hijos: se copia el **sucesor** (el menor de la derecha) y se quita su hoja. Los demás nodos se recolocan solos.',
      en: 'Deleting a node with two children: copy its **successor** (the smallest on the right) and remove that leaf. The other nodes reposition themselves.' },
    { ...BORRADO.parche, est: null, line: null, code: '',
      jugar: {
        arrastrables: true,
        botones: [
          { label: { es: 'Siguiente (in-orden)', en: 'Next (in-order)' },
            hacer: (v, cx) => { const o = cx.recorrido('in'), n = Object.keys(v.est).length; for (const k of Object.keys(v.est)) v.est[k] = 'visitado'; if (n < o.length) v.est[o[n]] = 'activo'; },
            off: (v, cx) => Object.keys(v.est).length >= cx.recorrido('in').length },
          { label: { es: 'Reiniciar', en: 'Restart' }, hacer: v => { for (const k of Object.keys(v.est)) delete v.est[k]; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'visitados', valor: cx.recorrido('in').filter(i => v.est[i]).map(i => v.val[i]).join(', ') || '-' },
          { expr: 'h', valor: cx.altura() },
        ],
        soltar: (v, id) => { v.etiquetas[id] = 'movido'; },
      },
      es: 'Recorre el árbol **in-orden** con el botón: sale ordenado. Puedes **arrastrar** cualquier nodo; vuelve a su sitio cuando cambia la estructura o pasas de paso.',
      en: 'Walk the tree **in-order** with the button: it comes out sorted. You can **drag** any node; it returns to its place when the structure changes or you move on.' },

    // ── Degenerado ──
    { sec: { es: 'Degenerado frente a equilibrado', en: 'Degenerate vs balanced' },
      arbol: { ...arbolVacio(), cabida: cabidaDe(DEG.arbol) },
      code: C_INS, line: null, traza: DEG.frames,
      es: 'Si los datos llegan **ya ordenados**, cada valor es el mayor y el ABB se convierte en una lista: altura n-1. Mira cómo crece `h` en la raíz.',
      en: 'If the data arrives **already sorted**, every value is the largest and the BST turns into a list: height n-1. Watch `h` grow at the root.',
      pregunta: {
        opc: [
          { es: 'O(n): hay que recorrerlo entero', en: 'O(n): it has to be walked entirely', ok: 1 },
          { es: 'O(log n), como siempre', en: 'O(log n), as always' },
          { es: 'O(1)', en: 'O(1)' },
        ],
        why: { es: 'Buscar cuesta tanto como la altura. Equilibrado la altura es log n; degenerado es n. Por eso existen los árboles AVL y rojo-negro.', en: 'A search costs as much as the height. Balanced it is log n; degenerate it is n. That is why AVL and red-black trees exist.' } },
    },

    // ── Montículo ──
    { sec: { es: 'Montículo', en: 'Heap' },
      arbol: { ...arbolDeArray(HEAP0), cabida: cabidaDe(HEAP_FINAL) },
      etiquetas: Object.fromEntries(HEAP0.map((_, i) => ['h' + i, `[${i}]`])), code: C_HEAP, line: null, traza: trazaHeap(HEAP0, 1),
      es: 'Un **montículo** es un array que se lee como árbol: los hijos de `i` están en `2i+1` y `2i+2`. El menor siempre está en la raíz. Insertamos un 1 y sube.',
      en: 'A **heap** is an array read as a tree: the children of `i` are at `2i+1` and `2i+2`. The smallest is always at the root. We insert a 1 and it bubbles up.' },

    // ── Grafo ──
    { sec: { es: 'Grafos', en: 'Graphs' },
      arbol: GRAFO, code: '', line: null,
      etiquetas: { a: '0', b: '∞', c: '∞', d: '∞', e: '∞' }, traza: trazaDijkstra(GRAFO, 'a'),
      es: 'En modo **libre** los nodos tienen posición propia y las aristas llevan **peso** y **dirección** (la pareja D↔E se curva para no solaparse). Dijkstra, paso a paso.',
      en: 'In **free** mode nodes have their own position and edges carry a **weight** and a **direction** (the D↔E pair curves so they do not overlap). Dijkstra, step by step.' },
    { etiquetas: null, est: null, aristaEst: null,
      jugar: {
        arrastrables: true,
        botones: [
          { label: { es: 'Siguiente (anchura)', en: 'Next (breadth)' },
            hacer: (v, cx) => { const o = cx.recorrido('niveles'), n = Object.keys(v.est).length; for (const k of Object.keys(v.est)) v.est[k] = 'visitado'; if (n < o.length) v.est[o[n]] = 'activo'; },
            off: (v, cx) => Object.keys(v.est).length >= cx.recorrido('niveles').length },
          { label: { es: 'Reiniciar', en: 'Restart' }, hacer: v => { for (const k of Object.keys(v.est)) delete v.est[k]; v.etiquetas = {}; } },
        ],
        lecturas: (v, cx) => [{ expr: 'BFS', valor: cx.recorrido('niveles').filter(i => v.est[i]).map(i => v.val[i]).join(' → ') || '-' }],
        soltar: (v, id) => { v.etiquetas[id] = 'movido'; },
      },
      es: '**Arrastra** los nodos para reorganizar el grafo: las aristas, con su peso y su flecha, los siguen. El botón recorre el grafo en anchura desde A.',
      en: '**Drag** the nodes to rearrange the graph: the edges, with their weight and arrow, follow them. The button walks the graph breadth-first from A.' },
  ],
};
