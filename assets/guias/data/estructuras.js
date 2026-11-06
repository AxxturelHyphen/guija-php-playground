// Guía «Estructuras de datos»: lista enlazada, pila, cola, árbol binario de búsqueda y montículo en vista de árbol.
// Mezcla cuatro escenas (cada paso que abre otra clave de escena sustituye a la anterior): celdas (lista y comparativa),
// barras (pila y cola sobre array), arbol (ABB y montículo). Las trazas se generan ejecutando los algoritmos de verdad
// (data/estructuras-traza.js, probado en tests/guias/test-estructuras.js). Formato de paso: ver data/punteros.js.
import { arbolVacio, arbolCompleto, arbolDeArray, insertarABB, parchar, altura, cabidaDe, cabidaMax } from '../arbol.js';
import {
  trazaRecorrer, trazaAlFinal, trazaInvertir, analizarLista, recablear,
  pilaPush, pilaPop, pilaCima, colaEnq, colaDeq, colaFrente, trazaCola, trazaBorrarInicio,
  trazaInsertar, trazaBuscar, trazaBorrar, trazaRecorrido,
  subir, bajar, trazaSubir, trazaBajar, parcheHeap, etiquetasHeap,
} from './estructuras-traza.js';

const cod = (es, en) => ({ es, en });
const d = (base, off) => '0x' + (base + off).toString(16);
const fila = (ids, valores) => Object.fromEntries(ids.map((id, i) => [id, valores[i]]));

// ══ 1. Lista enlazada (escena celdas) ════════════════════════════════════════════════════════════════════════════
const cel = (id, addr, name, type, size, col = 0, grupo) => ({ id, addr, name, type, size, col, ...(grupo && { grupo }) });
const STK = 0x7ffd5e2c1a40;
const BASE = { a: 0x55b2c4e712a0, b: 0x55b2c4e73f50, c: 0x55b2c4e71c10, d: 0x55b2c4e78830 };
const VARS = ['head', 'tail', 'nuevo', 'p', 'borrado', 'ant', 'act', 'prox'];
const NODOS = ['a', 'b', 'c', 'd'];
const LL = [
  ...VARS.map((id, i) => cel(id, d(STK, 8 * i), id, 'Nodo*', 8)),
  cel('nul', '0x0', 'nullptr', '—', 0),
  ...NODOS.flatMap(n => [cel(n + 'd', d(BASE[n], 0), 'dato', 'int', 4, 1, 'g' + n), cel(n + 's', d(BASE[n], 8), 'sig', 'Nodo*', 8, 1, 'g' + n)]),
];
const GLL = NODOS.map(n => ({ id: 'g' + n, titulo: { es: `nodo ${n.toUpperCase()}`, en: `node ${n.toUpperCase()}` } }));
const ZLL = [{ col: 0, titulo: { es: 'Pila (variables)', en: 'Stack (variables)' }, tono: 'pila' }, { col: 1, titulo: { es: 'Heap (nodos)', en: 'Heap (nodes)' }, tono: 'heap' }];
const L3 = { mostrar: ['head', 'ad', 'as', 'bd', 'bs', 'cd', 'cs'], val: { head: '→ad', ad: 10, as: '→bd', bd: 20, bs: '→cd', cd: 30, cs: '→∅' } };
const INIT4 = { head: '→ad', ad: 10, as: '→bd', bd: 20, bs: '→cd', cd: 30, cs: '→dd', dd: 40, ds: '→∅' };
const L4 = { mostrar: ['head', 'ad', 'as', 'bd', 'bs', 'cd', 'cs', 'dd', 'ds'], val: INIT4 };
const abre = (L, extra = {}) => ({ celdas: LL, zonas: ZLL, grupos: GLL, mostrar: [...L.mostrar, ...(extra.mostrar || [])], val: { ...L.val, ...extra.val } });

const C_NODO = cod(`struct Nodo {
    int dato;
    Nodo* sig;
};
Nodo* head;     // primer nodo (o nullptr)`, `struct Nodo {
    int dato;
    Nodo* sig;
};
Nodo* head;     // first node (or nullptr)`);
const C_RECORRER = `void recorrer(Nodo* head) {
    Nodo* act = head;
    while (act != nullptr) {
        cout << act->dato << ' ';
        act = act->sig;
    }
}`;
const C_FRENTE = `void alPrincipio(Nodo*& head, int x) {
    Nodo* nuevo = new Nodo{x, head};
    head = nuevo;
}`;
const C_FINAL = `void alFinal(Nodo*& head, int x) {
    Nodo* nuevo = new Nodo{x, nullptr};
    if (!head) { head = nuevo; return; }
    Nodo* act = head;
    while (act->sig) act = act->sig;
    act->sig = nuevo;
}`;
const C_TAIL = `void alFinal(Nodo*& head, Nodo*& tail, int x) {
    Nodo* nuevo = new Nodo{x, nullptr};
    if (tail) tail->sig = nuevo; else head = nuevo;
    tail = nuevo;
}`;
const C_TRAS = `void insertarTras(Nodo* p, int x) {
    Nodo* nuevo = new Nodo{x, nullptr};
    nuevo->sig = p->sig;
    p->sig = nuevo;
}`;
const C_BORRAR = `void borrarTras(Nodo* p) {
    Nodo* borrado = p->sig;
    p->sig = borrado->sig;
    delete borrado;
}`;
const C_INVERTIR = `Nodo* invertir(Nodo* head) {
    Nodo* ant = nullptr;
    Nodo* act = head;
    while (act) {
        Nodo* prox = act->sig;
        act->sig = ant;
        ant = act;
        act = prox;
    }
    return ant;
}`;
const DATOS = { a: 10, b: 20, c: 30, d: 40 };
const REC = trazaRecorrer(['a', 'b', 'c'], DATOS);
const FIN = trazaAlFinal(['a', 'b', 'c'], DATOS, 'd', 40);
const INV = trazaInvertir(NODOS, DATOS);

// ══ 2. Pila y cola (escena barras, cajas) ════════════════════════════════════════════════════════════════════════
const BPILA = { arr: [0, 0, 0, 0, 0, 0], estilo: 'cajas', max: 99, etiquetas: true, etiquetasCont: { tam: { es: 'tamaño', en: 'size' }, overflow: 'overflow', underflow: 'underflow' } };
const BCOLA = { arr: [0, 0, 0, 0, 0, 0], estilo: 'cajas', max: 99, etiquetas: true, etiquetasCont: { n: { es: 'elementos', en: 'elements' }, overflow: 'overflow', underflow: 'underflow' } };
const A_VEC = [4, 8, 6, 5, 2];
const BVEC = { arr: A_VEC, estilo: 'cajas', max: 99, etiquetas: true, etiquetasCont: { movimientos: { es: 'desplazamientos', en: 'shifts' } } };
const okHasta = n => Object.fromEntries(Array.from({ length: n + 1 }, (_, i) => [i, 'ok']));
const C_PILA = cod(`int datos[6];
int top = -1;                         // -1: pila vacía
void push(int x) { datos[++top] = x; }
void pop()       { top--; }
int  cima()      { return datos[top]; }`, `int datos[6];
int top = -1;                         // -1: empty stack
void push(int x) { datos[++top] = x; }
void pop()       { top--; }
int  cima()      { return datos[top]; }`);
const C_COLA = cod(`int datos[6];
int head = 0, tail = 0, n = 0;        // n: nº de elementos
void enqueue(int x) { datos[tail] = x; tail = (tail + 1) % 6; n++; }
int  dequeue()      { int x = datos[head]; head = (head + 1) % 6; n--; return x; }`, `int datos[6];
int head = 0, tail = 0, n = 0;        // n: number of elements
void enqueue(int x) { datos[tail] = x; tail = (tail + 1) % 6; n++; }
int  dequeue()      { int x = datos[head]; head = (head + 1) % 6; n--; return x; }`);
const C_VEC = cod(`vector<int> v = {4, 8, 6, 5, 2};
v.erase(v.begin());     // quita el primero y desplaza el resto`, `vector<int> v = {4, 8, 6, 5, 2};
v.erase(v.begin());     // removes the first one and shifts the rest`);
const C_STD = cod(`stack<int> pila;                       // LIFO
pila.push(7);  pila.top();  pila.pop();   // pop() no devuelve nada
queue<int> cola;                       // FIFO
cola.push(7);  cola.front();  cola.pop();`, `stack<int> pila;                       // LIFO
pila.push(7);  pila.top();  pila.pop();   // pop() returns nothing
queue<int> cola;                       // FIFO
cola.push(7);  cola.front();  cola.pop();`);
const C_BALANCE = `bool balanceado(const string& s) {
    stack<char> pila;
    for (char c : s) {
        if (c == '(') pila.push(c);
        else if (c == ')') {
            if (pila.empty()) return false;
            pila.pop();
        }
    }
    return pila.empty();
}`;
const COLA_INI = { arr: [4, 8, 6, 0, 0, 0], head: 1, n: 2 };
const COLA_OPS = [['E', 5], ['E', 2], ['E', 7], ['E', 1], ['D'], ['E', 9], ['D'], ['D']];
const COLA = trazaCola(COLA_INI, COLA_OPS);
const VEC = trazaBorrarInicio(A_VEC);

const lecErrores = v => `${v.cont.overflow ?? 0} overflow, ${v.cont.underflow ?? 0} underflow`;
const hayError = v => (v.cont.overflow ?? 0) + (v.cont.underflow ?? 0) > 0;

// ══ 3. ABB (escena arbol) ════════════════════════════════════════════════════════════════════════════════════════
const VALORES = [8, 4, 12, 2, 6, 10, 14, 5];
const ABB = trazaInsertar(VALORES);
const T_ABB = ABB.arbol;
const abre_ABB = (T, extra = {}) => ({ arbol: { nodos: T.nodos, aristas: T.aristas, raiz: T.raiz, cabida: cabidaMax(T_ABB), ...extra } });
const PARCHE_ABB = { '+nodos': T_ABB.nodos, '+aristas': T_ABB.aristas };
const D1 = trazaBorrar(T_ABB, 2), D2 = trazaBorrar(D1.arbol, 6), D3 = trazaBorrar(D2.arbol, 8);
const T_MAL = { nodos: [8, 4, 12, 9].map(v => ({ id: 'n' + v, val: v })), aristas: [{ a: 'n8', b: 'n4', lado: 'i' }, { a: 'n8', b: 'n12', lado: 'd' }, { a: 'n4', b: 'n9', lado: 'd' }], raiz: 'n8' };

const C_ABB = `struct Nodo {
    int val;
    Nodo* izq;
    Nodo* der;
};`;
const C_INS = `Nodo* insertar(Nodo* t, int x) {
    if (!t) return new Nodo{x, nullptr, nullptr};
    if (x < t->val) t->izq = insertar(t->izq, x);
    else if (x > t->val) t->der = insertar(t->der, x);
    return t;
}`;
const C_BUS = `Nodo* buscar(Nodo* t, int x) {
    if (!t || t->val == x) return t;
    if (x < t->val) return buscar(t->izq, x);
    return buscar(t->der, x);
}`;
const C_BOR = cod(`Nodo* borrar(Nodo* t, int x) {
    if (!t) return nullptr;
    if (x < t->val) { t->izq = borrar(t->izq, x); return t; }
    if (x > t->val) { t->der = borrar(t->der, x); return t; }
    if (!t->izq) { Nodo* d = t->der; delete t; return d; }
    if (!t->der) { Nodo* i = t->izq; delete t; return i; }
    Nodo* s = t->der;                 // sucesor: el menor de la derecha
    while (s->izq) s = s->izq;
    t->val = s->val;
    t->der = borrar(t->der, s->val);
    return t;
}`, `Nodo* borrar(Nodo* t, int x) {
    if (!t) return nullptr;
    if (x < t->val) { t->izq = borrar(t->izq, x); return t; }
    if (x > t->val) { t->der = borrar(t->der, x); return t; }
    if (!t->izq) { Nodo* d = t->der; delete t; return d; }
    if (!t->der) { Nodo* i = t->izq; delete t; return i; }
    Nodo* s = t->der;                 // successor: the smallest on the right
    while (s->izq) s = s->izq;
    t->val = s->val;
    t->der = borrar(t->der, s->val);
    return t;
}`);
const C_IN = `void inorden(Nodo* t) {
    if (!t) return;
    inorden(t->izq);
    cout << t->val << ' ';
    inorden(t->der);
}`;
const C_PRE = `void preorden(Nodo* t) {
    if (!t) return;
    cout << t->val << ' ';
    preorden(t->izq);
    preorden(t->der);
}`;
const C_POST = `void postorden(Nodo* t) {
    if (!t) return;
    postorden(t->izq);
    postorden(t->der);
    cout << t->val << ' ';
}`;
const C_NIVELES = `void niveles(Nodo* raiz) {
    queue<Nodo*> q;
    q.push(raiz);
    while (!q.empty()) {
        Nodo* t = q.front(); q.pop();
        cout << t->val << ' ';
        if (t->izq) q.push(t->izq);
        if (t->der) q.push(t->der);
    }
}`;

// ══ 4. Altura y coste ════════════════════════════════════════════════════════════════════════════════════════════
/** Añade a cada frame que inserta nodos la etiqueta h = nº de niveles bajo la raíz. */
function conNiveles(tr) {
  let T = arbolVacio();
  return tr.frames.map(fr => {
    if (!fr['+nodos']) return fr;
    T = parchar(T, { '+nodos': fr['+nodos'], ...(fr['+aristas'] && { '+aristas': fr['+aristas'] }) });
    return { ...fr, etiquetas: { [T.nodos[0].id]: `$h=${altura(T) + 1}$` } };
  });
}
const DEG = trazaInsertar([1, 2, 3, 4, 5, 6, 7]), BAL = trazaInsertar([4, 2, 6, 1, 3, 5, 7]);
const CAB_DEG = cabidaMax(DEG.arbol, BAL.arbol);
let degJuego = arbolVacio();
for (let v = 1; v <= 10; v++) degJuego = insertarABB(degJuego, v).arbol;
const CAB_JUEGO = cabidaMax(degJuego, arbolCompleto(4));
const MAX_JUEGO = 10;
const nivelesMin = n => (n ? Math.ceil(Math.log2(n + 1)) : 0);
/** Inserta en el árbol vivo del estado (la escena `arbol` no deja a `vista` cambiar la estructura: se muta en sitio). */
function insertaVivo(cx, x) {
  const T = cx.arbol, r = insertarABB(T, x);
  if (r.repetido) return false;
  T.nodos.push(...r.parche['+nodos']);
  if (r.parche['+aristas']) T.aristas.push(...r.parche['+aristas']);
  return true;
}
const juegoBotones = [
  { label: { es: 'insertar mayor + 1', en: 'insert max + 1' }, hacer: (v, cx) => insertaVivo(cx, Math.max(0, ...cx.arbol.nodos.map(n => n.val)) + 1), off: (v, cx) => cx.arbol.nodos.length >= MAX_JUEGO },
  { label: { es: 'insertar al azar', en: 'insert random' }, hacer: (v, cx) => { let x; do x = 1 + Math.floor(Math.random() * 99); while (cx.arbol.nodos.some(n => n.val === x)); insertaVivo(cx, x); }, off: (v, cx) => cx.arbol.nodos.length >= MAX_JUEGO },
  { label: { es: 'Reiniciar', en: 'Reset' }, hacer: (v, cx) => { cx.arbol.nodos.length = 0; cx.arbol.aristas.length = 0; v.est = {}; v.etiquetas = {}; } },
];
const juegoLecturas = (v, cx) => {
  const n = cx.arbol.nodos.length, h = altura(cx.arbol) + 1, min = nivelesMin(n);
  return [
    { expr: 'n', valor: n },
    { expr: 'h', valor: h },
    { expr: '$\\lceil \\log_2(n+1) \\rceil$', valor: min || '—' },
    { expr: 'h / mín', valor: n ? (h / min).toFixed(1) : '—', malo: n > 3 && h >= 2 * min },
  ];
};

// ══ 5. Montículo ═════════════════════════════════════════════════════════════════════════════════════════════════
const HEAP0 = [50, 30, 40, 10, 20, 35, 15];
const HEAP1 = subir(HEAP0, 45);
const HEAP2 = bajar(HEAP1).arr;
const SUBIR = trazaSubir(HEAP0, 45), BAJAR = trazaBajar(HEAP1);
const CAB_HEAP = cabidaMax(arbolDeArray(HEAP1), arbolDeArray(HEAP0));
const C_HEAP0 = `vector<int> h = {50, 30, 40, 10, 20, 35, 15};
int padre(int i) { return (i - 1) / 2; }
int izq(int i)   { return 2 * i + 1; }   // der(i) = 2 * i + 2`;
const C_SUBIR = `void push(vector<int>& h, int x) {
    h.push_back(x);
    int i = h.size() - 1;
    while (i > 0 && h[(i - 1) / 2] < h[i]) {
        swap(h[(i - 1) / 2], h[i]);
        i = (i - 1) / 2;
    }
}`;
const C_BAJAR = `int pop(vector<int>& h) {
    int tope = h[0];
    h[0] = h.back();
    h.pop_back();
    int i = 0, n = h.size();
    while (2 * i + 1 < n) {
        int m = 2 * i + 1;
        if (m + 1 < n && h[m + 1] > h[m]) m++;
        if (h[i] >= h[m]) break;
        swap(h[i], h[m]);
        i = m;
    }
    return tope;
}`;
const C_PQ = cod(`priority_queue<int> pq;                // montículo máximo
pq.push(45);  pq.top();  pq.pop();
vector<int> v = {10, 30, 20, 50};
make_heap(v.begin(), v.end());         // heapify: O(n)
priority_queue<int, vector<int>, greater<int>> mn;   // mínimo arriba`, `priority_queue<int> pq;                // max-heap
pq.push(45);  pq.top();  pq.pop();
vector<int> v = {10, 30, 20, 50};
make_heap(v.begin(), v.end());         // heapify: O(n)
priority_queue<int, vector<int>, greater<int>> mn;   // min on top`);

// ══ 6. Comparativa (celdas «tarjeta») ════════════════════════════════════════════════════════════════════════════
const TARJ = [
  cel('cv', '#1', 'vector', { es: 'array dinámico', en: 'dynamic array' }, 0),
  cel('cl', '#2', 'list', { es: 'nodos enlazados', en: 'linked nodes' }, 0),
  cel('cp', '#3', { es: 'pila / cola', en: 'stack / queue' }, { es: 'solo los extremos', en: 'ends only' }, 0),
  cel('ca', '#4', 'ABB / map', { es: 'árbol de búsqueda', en: 'search tree' }, 0),
  cel('ch', '#5', 'heap', 'priority_queue', 0),
];
const TID = TARJ.map(c => c.id);

export default {
  titulo: { es: 'Estructuras de datos', en: 'Data structures' },
  fuentes: [
    'Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). *Introduction to algorithms* (4th ed.). MIT Press.',
    'Knuth, D. E. (1997). *The art of computer programming: Vol. 1. Fundamental algorithms* (3rd ed.). Addison-Wesley.',
    'Sedgewick, R., & Wayne, K. (2011). *Algorithms* (4th ed.). Addison-Wesley. https://algs4.cs.princeton.edu/home/',
    '*std::map*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/map',
    '*std::priority_queue*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/priority_queue',
  ],
  pasos: [
    // ── 1. Lista enlazada ──
    { sec: { es: 'Lista enlazada', en: 'Linked list' }, leyenda: ['activo', 'hecho'], ...abre(L3), code: C_NODO, line: 1, hl: { head: 'a', ad: 'b' },
      es: 'Una **lista enlazada** guarda cada elemento en un nodo del heap: el dato y un puntero `sig` al siguiente. La lista se reconoce por `head`, el puntero al primer nodo; en el último, `sig` es `nullptr` (`→∅`). El orden lo dan los punteros, no las direcciones: los nodos pueden estar en cualquier sitio.',
      en: 'A **linked list** stores each element in a heap node: the data and a pointer `sig` to the next one. The list is known through `head`, the pointer to the first node; in the last one, `sig` is `nullptr` (`→∅`). Pointers give the order, not addresses: nodes can be anywhere.' },
    { code: C_RECORRER, line: 2, traza: REC.frames,
      es: 'Recorrerla es seguir los enlaces: `act` parte de `head` y avanza con `act = act->sig` hasta `nullptr`. Cuesta $O(n)$. No existe `l[i]`: llegar al elemento `i` exige `i` saltos, mientras que en un `vector` es una cuenta de direcciones, $O(1)$.',
      en: 'Walking it means following the links: `act` starts at `head` and advances with `act = act->sig` until `nullptr`. It costs $O(n)$. There is no `l[i]`: reaching element `i` takes `i` hops, whereas in a `vector` it is address arithmetic, $O(1)$.' },
    { code: C_FRENTE, line: 2, mostrar: ['nuevo', 'dd', 'ds'], val: { nuevo: '→dd', dd: 5, ds: '→ad' }, hl: { nuevo: 'a', gd: 'b' },
      es: '**Insertar al principio.** `new Nodo{x, head}` crea un nodo cuyo `sig` ya apunta al primer nodo actual. Todavía solo lo conoce `nuevo`: `head` sigue apuntando al 10. El nodo nuevo cae en otra dirección del heap, y da igual.',
      en: '**Insert at the front.** `new Nodo{x, head}` creates a node whose `sig` already points to the current first node. Only `nuevo` knows it so far: `head` still points to 10. The new node lands at another heap address, and that does not matter.' },
    { line: 3, val: { head: '→dd' }, hl: { head: 'a', gd: 'b' },
      es: '`head = nuevo` termina la inserción. Fueron dos asignaciones y ningún dato se movió: coste $O(1)$, tenga la lista 3 o 3 millones de nodos. La lista es ahora 5, 10, 20, 30.',
      en: '`head = nuevo` completes the insertion. Two assignments and no data moved: cost $O(1)$, whether the list has 3 or 3 million nodes. The list is now 5, 10, 20, 30.' },
    { ...abre(L3), code: C_FINAL, line: 2, traza: FIN.frames,
      es: '**Insertar al final** sin más información: hay que llegar al último nodo (el que tiene `sig == nullptr`) recorriendo toda la lista, $O(n)$. Reproduce la traza.',
      en: '**Insert at the end** with no extra information: you must reach the last node (the one with `sig == nullptr`) by walking the whole list, $O(n)$. Play the trace.' },
    { code: C_TAIL, line: 3, mostrar: ['tail', 'nuevo', 'dd', 'ds'], val: { tail: '→dd', nuevo: '→dd', dd: 40, ds: '→∅', cs: '→dd' }, hl: { tail: 'a', cs: 'b' },
      es: 'Con un puntero `tail` al último nodo no hace falta recorrer nada: `tail->sig = nuevo` enlaza el nodo y `tail = nuevo` lo marca como último. Insertar al final es $O(1)$. Quitar el último sigue siendo $O(n)$: hay que llegar al penúltimo, y los enlaces solo van hacia delante.',
      en: 'With a `tail` pointer to the last node nothing needs walking: `tail->sig = nuevo` links the node and `tail = nuevo` marks it as the last. Insertion at the end is $O(1)$. Removing the last one is still $O(n)$: you must reach the second-to-last, and links only go forward.' },
    { ...abre(L3, { mostrar: ['p', 'nuevo', 'dd', 'ds'], val: { p: '→bd', nuevo: '→dd', dd: 25, ds: '→cd' } }), code: C_TRAS, line: 3, hl: { p: 'a', ds: 'b', cd: 'b' },
      es: '**Insertar tras `p`** (el 20). Se crea el nodo del 25 y primero se copia el enlace: `nuevo->sig = p->sig`. Ahora el 25 ya apunta al 30, y el 30 tiene dos enlaces de entrada: todavía no se ha perdido nada.',
      en: '**Insert after `p`** (the 20). The node for 25 is created and the link is copied first: `nuevo->sig = p->sig`. Now 25 already points to 30, and 30 has two incoming links: nothing has been lost yet.' },
    { line: 4, val: { bs: '→dd' }, hl: { bs: 'a', gd: 'b' },
      es: 'Después `p->sig = nuevo`: el 20 apunta al 25. Solo cambiaron dos punteros y ningún dato se movió. Con `p` en la mano cuesta $O(1)$; encontrar `p` es lo que cuesta $O(n)$. La lista es 10, 20, 25, 30.',
      en: 'Then `p->sig = nuevo`: the 20 points to the 25. Only two pointers changed and no data moved. With `p` in hand it costs $O(1)$; finding `p` is what costs $O(n)$. The list is 10, 20, 25, 30.' },
    { line: null, hl: { p: 'a', bs: 'a', ds: 'a' },
      es: 'Si se intercambiaran las dos líneas (primero `p->sig = nuevo;`), ¿qué pasaría?',
      en: 'If the two lines were swapped (`p->sig = nuevo;` first), what would happen?',
      pregunta: {
        opc: [
          { es: 'Nada: el resultado sería el mismo', en: 'Nothing: the result would be the same' },
          { es: 'El nodo nuevo se apuntaría a sí mismo y el 30 quedaría inalcanzable', en: 'The new node would point to itself and the 30 would become unreachable', ok: 1 },
          { es: 'No compilaría', en: 'It would not compile' },
        ],
        why: {
          es: 'Con `p->sig = nuevo` primero, `p->sig` ya vale `nuevo`, así que `nuevo->sig = p->sig` copia `nuevo` en sí mismo: un ciclo. Y la única ruta hacia el 30 se perdió: fuga.',
          en: 'With `p->sig = nuevo` first, `p->sig` already equals `nuevo`, so `nuevo->sig = p->sig` copies `nuevo` into itself: a cycle. And the only route to 30 was lost: a leak.',
        },
      } },
    { ...abre(L3, { mostrar: ['p', 'borrado'], val: { p: '→ad', borrado: '→bd', as: '→cd' } }), code: C_BORRAR, line: 3, hl: { as: 'a', bd: 'c' },
      es: '**Borrar el 20.** Hace falta `p`, el nodo anterior (el 10): hay que recablear a quien apuntaba al borrado. `borrado` guarda el nodo a eliminar y `p->sig = borrado->sig` salta sobre él. La lista ya es 10, 30; el nodo del 20 sigue en el heap, desconectado.',
      en: '**Delete the 20.** You need `p`, the previous node (the 10): whoever pointed to the deleted one must be rewired. `borrado` holds the node to remove and `p->sig = borrado->sig` skips over it. The list is already 10, 30; the node for 20 is still in the heap, disconnected.' },
    { line: 4, fantasma: ['bd', 'bs'], val: { bd: '', bs: '' }, hl: { borrado: 'c' },
      es: '`delete borrado` devuelve el nodo al heap. `borrado` conserva la dirección vieja: es un puntero colgante (flecha roja) y no hay que usarlo. Si se olvida el `delete`, el nodo queda perdido: una fuga. Para liberar toda una lista, guarda `sig` **antes** de cada `delete`.',
      en: '`delete borrado` returns the node to the heap. `borrado` keeps the old address: it is a dangling pointer (red arrow) and must not be used. Forgetting the `delete` leaves the node lost: a leak. To free a whole list, save `sig` **before** each `delete`.' },
    { line: null, hl: {},
      es: 'Si `delete borrado;` se ejecutara **antes** de `p->sig = borrado->sig;`, ¿qué pasaría?',
      en: 'If `delete borrado;` ran **before** `p->sig = borrado->sig;`, what would happen?',
      pregunta: {
        opc: [
          { es: 'Se leería `borrado->sig` de un nodo ya liberado: comportamiento indefinido', en: '`borrado->sig` would be read from an already freed node: undefined behavior', ok: 1 },
          { es: 'Funcionaría igual: solo cambia el orden', en: 'It would work the same: only the order changes' },
          { es: 'El compilador lo detectaría y no compilaría', en: 'The compiler would catch it and refuse to compile' },
        ],
        why: {
          es: 'Tras el `delete`, `*borrado` ya no es tuyo: leer `borrado->sig` es un use-after-free. Lo que necesites del nodo hay que leerlo antes de liberarlo. El compilador no avisa.',
          en: 'After the `delete`, `*borrado` is no longer yours: reading `borrado->sig` is a use-after-free. Whatever you need from the node must be read before freeing it. The compiler does not warn.',
        },
      } },
    { ...abre(L4), code: C_INVERTIR, line: 2, traza: INV.frames,
      es: '**Invertir la lista** sin crear nodos nuevos: tres punteros, `ant`, `act` y `prox`. En cada vuelta `prox` guarda el siguiente, `act->sig` se da la vuelta hacia `ant` y los dos avanzan. $O(n)$ de tiempo y $O(1)$ de memoria extra. Reproduce la traza.',
      en: '**Reverse the list** without creating new nodes: three pointers, `ant`, `act` and `prox`. In each pass `prox` saves the next one, `act->sig` is turned back toward `ant` and both advance. $O(n)$ time and $O(1)$ extra memory. Play the trace.' },
    { ...abre(L4, { mostrar: ['nul'] }), code: C_NODO, line: null,
      es: 'Pruébalo: **arrastra** un `sig` (o `head`) sobre otro nodo para recablearlo, o sobre `nullptr` para cortarlo. Intenta perder parte de la lista y crear un ciclo, y mira las lecturas. Los nodos que `head` ya no alcanza quedan en rojo: sin ningún puntero, no se pueden liberar.',
      en: 'Try it: **drag** a `sig` (or `head`) onto another node to rewire it, or onto `nullptr` to cut it. Try losing part of the list and creating a cycle, and watch the readings. Nodes that `head` no longer reaches turn red: with no pointer left, they cannot be freed.',
      jugar: {
        botones: [
          { label: 'head = head->sig', hacer: v => { const n = analizarLista(v).orden[0]; if (n) v.head = v[n + 's']; }, off: v => v.head === '→∅' },
          { label: { es: 'Reiniciar', en: 'Reset' }, hacer: v => { Object.assign(v, INIT4); } },
        ],
        lecturas: v => {
          const a = analizarLista(v), vals = a.orden.map(n => v[n + 'd']);
          return [
            { expr: 'recorrer(head)', valor: vals.join(' → ') + (a.ciclo ? ' → … (ciclo)' : ' → ∅'), malo: a.ciclo },
            { expr: 'inalcanzables', valor: a.perdidos.length ? a.perdidos.map(n => v[n + 'd']).join(', ') : '—', malo: a.perdidos.length > 0 },
            { expr: 'ciclo', valor: String(a.ciclo), malo: a.ciclo },
          ];
        },
        hl: v => ({ head: 'a', ...Object.fromEntries(analizarLista(v).perdidos.map(n => ['g' + n, 'c'])) }),
        arrastrables: ['head', 'as', 'bs', 'cs', 'ds'],
        soltar: (v, origen, destino) => recablear(v, origen, destino),
      } },

    // ── 2. Pila y cola ──
    { sec: { es: 'Pila y cola', en: 'Stack and queue' }, leyenda: ['hecho'], barras: BPILA, marcas: { top: -1 }, cont: { tam: 0 }, code: C_PILA, line: 2,
      es: 'Una **pila** es LIFO («last in, first out»): lo último en entrar es lo primero en salir. Se implementa sobre un array con un índice `top` que marca la cima; `top = -1` es la pila vacía. Los huecos libres muestran 0 aquí; en verde, lo que pertenece a la pila.',
      en: 'A **stack** is LIFO («last in, first out»): the last one in is the first one out. It is built on an array with an index `top` marking the peak; `top = -1` is the empty stack. Free slots show 0 here; in green, what belongs to the stack.' },
    { line: 3, poner: { 0: 7, 1: 3, 2: 9 }, est: okHasta(2), marcas: { top: 2 }, cont: { tam: 3 },
      es: '`push(7)`, `push(3)` y `push(9)`: `++top` sube la cima y se escribe ahí. Cada `push` cuesta $O(1)$. Con `top = 2` la pila tiene 3 elementos y el 9, el último en entrar, será el primero en salir.',
      en: '`push(7)`, `push(3)` and `push(9)`: `++top` raises the peak and the value is written there. Each `push` costs $O(1)$. With `top = 2` the stack has 3 elements and the 9, the last one in, will be the first one out.' },
    { line: 4, est: { 2: null }, marcas: { top: 1 }, cont: { tam: 2 }, hl: { 1: 'piv' },
      es: '`pop()` solo hace `top--`: no borra nada. El 9 sigue en el array, pero ya no cuenta (sin verde) y el próximo `push` lo sobrescribirá. `cima()` lee `datos[top]`, aquí el 3, sin quitarlo. Todo es $O(1)$.',
      en: '`pop()` only does `top--`: it erases nothing. The 9 is still in the array, but it no longer counts (no green) and the next `push` will overwrite it. `cima()` reads `datos[top]`, here the 3, without removing it. All of it is $O(1)$.' },
    { line: null, poner: { 2: 2, 3: 6, 4: 5, 5: 8 }, est: okHasta(5), marcas: { top: 5 }, cont: { tam: 6 },
      es: 'Dos errores clásicos. Con `top = 5` la pila está llena: otro `push` escribiría en `datos[6]`, fuera del array (**overflow**, comportamiento indefinido). Con `top = -1`, un `pop` dejaría `top` en -2 y `cima()` leería fuera (**underflow**). Hay que comprobarlo antes, o usar un contenedor que crezca.',
      en: 'Two classic errors. With `top = 5` the stack is full: another `push` would write to `datos[6]`, outside the array (**overflow**, undefined behavior). With `top = -1`, a `pop` would leave `top` at -2 and `cima()` would read outside (**underflow**). Check first, or use a container that grows.' },
    { barras: BPILA, marcas: { top: -1 }, cont: { tam: 0, overflow: 0, underflow: 0 }, code: C_PILA, line: null,
      es: 'Pruébalo: apila y desapila. Fíjate en cómo `pop` deja el valor viejo en su hueco. Si apilas con la pila llena o desapilas con la vacía, la guía no toca el array y cuenta el error; en C++ sería comportamiento indefinido.',
      en: 'Try it: push and pop. Notice how `pop` leaves the old value in its slot. If you push onto a full stack or pop an empty one, the guide leaves the array alone and counts the error; in C++ it would be undefined behavior.',
      jugar: {
        botones: [
          { label: 'push(7)', hacer: v => pilaPush(v, 7) },
          { label: 'push(3)', hacer: v => pilaPush(v, 3) },
          { label: 'pop()', hacer: v => pilaPop(v) },
        ],
        lecturas: v => [
          { expr: 'top', valor: v.marcas.top },
          { expr: 'cima()', valor: v.marcas.top >= 0 ? pilaCima(v) : 'UB', malo: v.marcas.top < 0 },
          { expr: 'errores', valor: lecErrores(v), malo: hayError(v) },
        ],
        hl: v => (v.marcas.top >= 0 ? { [v.marcas.top]: 'piv' } : {}),
      } },
    { barras: BCOLA, marcas: { head: 0, tail: 0 }, cont: { n: 0 }, code: C_COLA, line: 2,
      es: 'Una **cola** es FIFO («first in, first out»): se atiende por orden de llegada. Con un array hacen falta dos índices: `head` (el siguiente en salir) y `tail` (dónde entrará el próximo). Se añade por detrás y se saca por delante; `n` cuenta los elementos.',
      en: 'A **queue** is FIFO («first in, first out»): service is in order of arrival. With an array you need two indices: `head` (the next one out) and `tail` (where the next one will go in). You add at the back and remove at the front; `n` counts the elements.' },
    { line: 3, poner: { 0: 4, 1: 8, 2: 6 }, est: okHasta(2), marcas: { tail: 3 }, cont: { n: 3 },
      es: '`enqueue(4)`, `enqueue(8)` y `enqueue(6)` escriben en `tail` y lo avanzan. `head` no se mueve: apunta al 4, que saldrá el primero. Insertar es $O(1)$.',
      en: '`enqueue(4)`, `enqueue(8)` and `enqueue(6)` write at `tail` and advance it. `head` does not move: it points to the 4, which will leave first. Insertion is $O(1)$.' },
    { line: 4, est: { 0: null }, marcas: { head: 1 }, cont: { n: 2 },
      es: '`dequeue()` devuelve `datos[head]`, el 4, y avanza `head`. Nada se desplaza: sacar también es $O(1)$. Pero la cola «camina» hacia la derecha, y el hueco de la izquierda no se aprovecha si `tail` solo crece.',
      en: '`dequeue()` returns `datos[head]`, the 4, and advances `head`. Nothing shifts: removing is $O(1)$ too. But the queue «walks» to the right, and the free slot on the left is not reused if `tail` only grows.' },
    { line: null, traza: COLA.frames,
      es: 'La solución es **circular**: los índices dan la vuelta con el módulo, `tail = (tail + 1) % 6`, y se reutiliza el hueco del principio. Reproduce la traza: `tail` llega al final, vuelve a 0 y la cola se llena. Con `head == tail` no se sabe si está llena o vacía: por eso existe `n`.',
      en: 'The solution is **circular**: indices wrap around with the modulo, `tail = (tail + 1) % 6`, and the free slot at the start is reused. Play the trace: `tail` reaches the end, comes back to 0 and the queue fills up. With `head == tail` you cannot tell full from empty: that is why `n` exists.' },
    { barras: BCOLA, marcas: { head: 0, tail: 0 }, cont: { n: 0, overflow: 0, underflow: 0 }, code: C_COLA, line: null,
      es: 'Pruébalo: llena la cola, saca algún elemento y vuelve a llenarla para ver cómo `tail` da la vuelta. El valor sacado queda en su hueco hasta que se sobrescribe. Los errores se cuentan sin tocar el array.',
      en: 'Try it: fill the queue, remove a few and fill it again to watch `tail` wrap around. The removed value stays in its slot until overwritten. Errors are counted without touching the array.',
      jugar: {
        botones: [
          { label: 'enqueue(7)', hacer: v => colaEnq(v, 7) },
          { label: 'enqueue(3)', hacer: v => colaEnq(v, 3) },
          { label: 'dequeue()', hacer: v => colaDeq(v) },
        ],
        lecturas: v => [
          { expr: 'head, tail', valor: `${v.marcas.head}, ${v.marcas.tail}` },
          { expr: 'front()', valor: v.cont.n > 0 ? colaFrente(v) : 'UB', malo: v.cont.n <= 0 },
          { expr: 'errores', valor: lecErrores(v), malo: hayError(v) },
        ],
        hl: v => (v.cont.n > 0 ? { [v.marcas.head]: 'piv' } : {}),
      } },
    { barras: BVEC, est: okHasta(4), cont: { movimientos: 0 }, code: C_VEC, line: 2, traza: VEC.frames,
      es: 'Un `vector` como cola tiene un problema: no tiene `pop_front`, y su equivalente `erase(begin())` borra el primero y **desplaza** los demás un hueco a la izquierda. Con $n$ elementos son $n-1$ movimientos: $O(n)$ por cada salida. La cola circular o `std::queue` sacan en $O(1)$.',
      en: 'A `vector` as a queue has a problem: it has no `pop_front`, and its equivalent `erase(begin())` removes the first one and **shifts** the rest one slot to the left. With $n$ elements that is $n-1$ moves: $O(n)$ per removal. The circular queue or `std::queue` remove in $O(1)$.' },
    { code: C_STD, line: null,
      es: 'En la práctica se usan `std::stack` y `std::queue`: adaptadores que por defecto se apoyan en un `deque`. `push`, `top`/`front` y `pop` cuestan $O(1)$; `pop()` no devuelve el elemento (se lee antes). Llamar a `top()`, `front()` o `pop()` con el contenedor vacío es comportamiento indefinido.',
      en: 'In practice you use `std::stack` and `std::queue`: adapters that by default sit on top of a `deque`. `push`, `top`/`front` and `pop` cost $O(1)$; `pop()` does not return the element (read it first). Calling `top()`, `front()` or `pop()` on an empty container is undefined behavior.' },
    { code: C_BALANCE, line: 5,
      es: 'Usos típicos. **Pila**: paréntesis balanceados (el último que se abre es el primero que se cierra), deshacer, la pila de llamadas. **Cola**: recorrido en anchura (BFS) de un grafo o de un árbol, y turnos de procesos. Este código apila cada `(` y desapila con cada `)`.',
      en: 'Typical uses. **Stack**: balanced parentheses (the last one opened is the first one closed), undo, the call stack. **Queue**: breadth-first search (BFS) of a graph or a tree, and process turns. This code pushes each `(` and pops on each `)`.',
      pregunta: {
        opc: [
          { es: '`true`', en: '`true`' },
          { es: '`false`: el segundo `)` encuentra la pila vacía', en: '`false`: the second `)` finds the stack empty', ok: 1 },
          { es: '`false`, pero solo porque sobra un `(` al final', en: '`false`, but only because a `(` is left over at the end' },
        ],
        why: {
          es: 'Con "())(": el primer `(` se apila, el primer `)` lo desapila y el segundo `)` encuentra la pila vacía: devuelve `false` en ese punto. El `(` final también sobraría, pero ni se llega a mirar.',
          en: 'With "())(": the first `(` is pushed, the first `)` pops it and the second `)` finds the stack empty: it returns `false` right there. The final `(` would also be left over, but it is never reached.',
        },
      } },

    // ── 3. Árbol binario de búsqueda ──
    { sec: { es: 'Árbol binario de búsqueda', en: 'Binary search tree' }, ...abre_ABB(T_ABB), code: C_ABB, line: null, hl: { n8: 'a' },
      es: 'Un **árbol binario de búsqueda** (ABB) guarda en cada nodo un valor y dos punteros, `izq` y `der`. Regla: todo lo del subárbol izquierdo es **menor** que el nodo y todo lo del derecho es **mayor**. Gracias a ella, en cada nodo se descarta una rama entera al buscar.',
      en: 'A **binary search tree** (BST) stores in each node a value and two pointers, `izq` and `der`. Rule: everything in the left subtree is **smaller** than the node and everything in the right one is **larger**. Thanks to it, each node discards a whole branch when searching.' },
    { arbol: { nodos: T_MAL.nodos, aristas: T_MAL.aristas, raiz: T_MAL.raiz, cabida: cabidaDe(T_MAL) }, est: { n9: 'mal' }, line: null,
      es: 'Mira este árbol. Cada nodo es mayor que su hijo izquierdo y menor que su hijo derecho. ¿Es un ABB?',
      en: 'Look at this tree. Each node is larger than its left child and smaller than its right child. Is it a BST?',
      pregunta: {
        opc: [
          { es: 'Sí: cada nodo cumple la regla con sus hijos', en: 'Yes: each node follows the rule with its children' },
          { es: 'No: el 9 está en el subárbol izquierdo del 8 y es mayor que 8', en: 'No: the 9 is in the left subtree of 8 and is larger than 8', ok: 1 },
          { es: 'No: un ABB no puede tener nodos con un solo hijo', en: 'No: a BST cannot have nodes with a single child' },
        ],
        why: {
          es: 'La regla vale para el **subárbol** entero, no solo para los hijos directos. Buscar el 9 iría a la derecha en el 8, luego a la izquierda en el 12, y no lo encontraría nunca.',
          en: 'The rule holds for the whole **subtree**, not just direct children. Searching for 9 would go right at 8, then left at 12, and never find it.',
        },
      } },
    { ...abre_ABB(arbolVacio()), code: C_INS, line: null, est: null, traza: ABB.frames,
      es: '**Insertar** es buscar el sitio: se baja comparando, a la izquierda si es menor y a la derecha si es mayor, hasta un hueco libre (`nullptr`), y ahí se cuelga el nodo. Se ignoran los duplicados. Cuesta lo que mida el camino: $O(h)$, con $h$ el número de niveles. Traza con 8, 4, 12, 2, 6, 10, 14 y 5.',
      en: '**Inserting** is finding the spot: you go down comparing, left if smaller and right if larger, until a free slot (`nullptr`), and the node is attached there. Duplicates are ignored. The cost is the path length: $O(h)$, with $h$ the number of levels. Trace with 8, 4, 12, 2, 6, 10, 14 and 5.' },
    { ...PARCHE_ABB, code: C_BUS, line: null, traza: trazaBuscar(T_ABB, 10).frames,
      es: '**Buscar** sigue el mismo camino que seguiría la inserción: en cada nodo se descarta un subárbol entero. Aquí buscamos el 10: 8, 12, 10. Si se llega a un `nullptr`, el valor no está. También cuesta $O(h)$.',
      en: '**Searching** follows the same path an insertion would: at each node a whole subtree is discarded. Here we look for 10: 8, 12, 10. Reaching a `nullptr` means the value is not there. It also costs $O(h)$.' },
    { code: C_BOR, line: null, traza: D1.frames,
      es: '**Borrar** depende de los hijos del nodo. Sin hijos (hoja): se quita. Con un hijo: ese hijo ocupa su lugar. Con dos: se copia el **sucesor in-order** (el menor de la derecha) y se borra su nodo original. Empezamos con la hoja 2.',
      en: '**Deleting** depends on the node children. No children (leaf): it is removed. One child: that child takes its place. Two: the **in-order successor** (the smallest on the right) is copied and its original node is removed. We start with the leaf 2.' },
    { ...D1.parche, est: null, traza: D2.frames,
      es: 'Con un solo hijo, el hijo sube. Borramos el 6: su único hijo, el 5, pasa a colgar del 4. No hace falta tocar nada más: el 5 sigue siendo mayor que el 4 y menor que el 8.',
      en: 'With a single child, the child moves up. We delete 6: its only child, the 5, now hangs from the 4. Nothing else needs touching: 5 is still larger than 4 and smaller than 8.' },
    { ...D2.parche, est: null, traza: D3.frames,
      es: 'Con dos hijos no se puede quitar el nodo sin dejar un hueco. Se busca el **sucesor in-order**: el menor del subárbol derecho (se baja siempre a la izquierda). Para el 8 es el 10. Se copia en la raíz y se borra el nodo original del 10, que tiene como mucho un hijo.',
      en: 'With two children the node cannot be removed without leaving a gap. We look for the **in-order successor**: the smallest of the right subtree (always go left). For 8 it is 10. It is copied to the root and the original node of 10, which has at most one child, is removed.' },
    { ...D3.parche, est: null, hl: { n8: 'a' },
      es: 'El árbol sigue siendo un ABB. En este árbol, ¿cuál es el sucesor in-order de la raíz (10)?',
      en: 'The tree is still a BST. In this tree, which is the in-order successor of the root (10)?',
      pregunta: {
        opc: [
          { es: 'El 12: el menor de su subárbol derecho', en: 'The 12: the smallest of its right subtree', ok: 1 },
          { es: 'El 14: el mayor de todos', en: 'The 14: the largest of all' },
          { es: 'El 4: su hijo izquierdo', en: 'The 4: its left child' },
        ],
        why: {
          es: 'El sucesor es el siguiente valor en orden creciente. Está en el subárbol derecho (12 y 14) y es el menor de ellos: el 12, que no tiene hijo izquierdo.',
          en: 'The successor is the next value in increasing order. It lies in the right subtree (12 and 14) and is the smallest of them: the 12, which has no left child.',
        },
      } },
    { ...abre_ABB(T_ABB), est: null, code: C_IN, line: null, traza: trazaRecorrido(T_ABB, 'in', 4).frames,
      es: 'El recorrido **in-order** visita izquierda, nodo, derecha. En un ABB da los valores **ordenados** de menor a mayor: 2, 4, 5, 6, 8, 10, 12, 14. Cuesta $O(n)$: visita cada nodo una vez. Así recorre sus claves un `map`.',
      en: 'The **in-order** traversal visits left, node, right. In a BST it yields the values **sorted** from smallest to largest: 2, 4, 5, 6, 8, 10, 12, 14. It costs $O(n)$: each node is visited once. This is how a `map` walks its keys.' },
    { code: C_PRE, line: null, traza: trazaRecorrido(T_ABB, 'pre', 3).frames,
      es: '**Pre-order**: nodo, izquierda, derecha. Cada nodo sale antes que sus hijos, así que la raíz es la primera: sirve para copiar un árbol o guardarlo y reconstruirlo.',
      en: '**Pre-order**: node, left, right. Each node comes out before its children, so the root is first: it is used to copy a tree or save and rebuild it.' },
    { code: C_POST, line: null, traza: trazaRecorrido(T_ABB, 'post', 5).frames,
      es: '**Post-order**: izquierda, derecha, nodo. Los hijos salen antes que su padre, y la raíz es la última. Es el orden para liberar un árbol con `delete`: no se borra un nodo hasta haber borrado sus hijos.',
      en: '**Post-order**: left, right, node. Children come out before their parent, and the root is last. It is the order to free a tree with `delete`: a node is not deleted until its children are.' },
    { code: C_NIVELES, line: null, traza: trazaRecorrido(T_ABB, 'niveles', 6).frames,
      es: 'El recorrido **por niveles** visita la raíz, luego sus hijos, luego los nietos… Es la búsqueda en anchura (BFS) y usa una **cola**: sale un nodo y entran sus hijos. Es la misma cola FIFO de antes.',
      en: 'The **level-order** traversal visits the root, then its children, then the grandchildren… It is breadth-first search (BFS) and uses a **queue**: a node comes out and its children go in. It is the same FIFO queue as before.' },

    // ── 4. Altura y coste ──
    { sec: { es: 'Altura y coste', en: 'Height and cost' }, arbol: { ...arbolVacio(), cabida: CAB_DEG }, code: C_INS, line: null, est: null, traza: conNiveles(DEG),
      es: 'Si los datos llegan **ya ordenados** (1, 2, 3…), cada valor nuevo es el mayor y baja siempre por la derecha: el ABB se convierte en una lista. Con $n$ nodos tiene $h=n$ niveles, y buscar, insertar o borrar cuesta $O(n)$. La forma del árbol depende del orden de inserción.',
      en: 'If the data arrives **already sorted** (1, 2, 3…), each new value is the largest and always goes right: the BST turns into a list. With $n$ nodes it has $h=n$ levels, and searching, inserting or deleting costs $O(n)$. The tree shape depends on the insertion order.' },
    { arbol: { ...arbolVacio(), cabida: CAB_DEG }, code: C_INS, line: null, traza: conNiveles(BAL),
      es: 'Los mismos 7 valores en otro orden (4, 2, 6, 1, 3, 5, 7) dan un árbol **equilibrado**: 3 niveles. Buscar cuesta como mucho 3 comparaciones en lugar de 7.',
      en: 'The same 7 values in another order (4, 2, 6, 1, 3, 5, 7) give a **balanced** tree: 3 levels. A search costs at most 3 comparisons instead of 7.' },
    { '+nodos': BAL.arbol.nodos, '+aristas': BAL.arbol.aristas, est: null, etiquetas: { n4: '$h=3$' }, line: null,
      es: 'Con $n$ nodos, un ABB tiene $h$ niveles con $\\lceil \\log_2(n+1) \\rceil \\le h \\le n$. Las operaciones cuestan $O(h)$: entre $O(\\log n)$ y $O(n)$. Con $n=10^6$, eso son 20 niveles frente a un millón.',
      en: 'With $n$ nodes, a BST has $h$ levels with $\\lceil \\log_2(n+1) \\rceil \\le h \\le n$. Operations cost $O(h)$: between $O(\\log n)$ and $O(n)$. With $n=10^6$, that is 20 levels versus a million.' },
    { line: null,
      es: 'Por eso existen los árboles **equilibrados** (AVL, rojo-negro): tras cada inserción o borrado se reajustan con rotaciones locales para que la altura sea siempre $O(\\log n)$. `std::map` y `std::set` suelen ser árboles rojo-negro: así `find`, `insert` y `erase` cuestan $O(\\log n)$ garantizado.',
      en: 'That is why **balanced** trees exist (AVL, red-black): after each insertion or deletion they readjust with local rotations so the height is always $O(\\log n)$. `std::map` and `std::set` are usually red-black trees: that is how `find`, `insert` and `erase` cost a guaranteed $O(\\log n)$.',
      pregunta: {
        opc: [
          { es: '`O(log n)`: unas 10 comparaciones', en: '`O(log n)`: about 10 comparisons' },
          { es: '`O(n)`: unas 1000 comparaciones', en: '`O(n)`: about 1000 comparisons', ok: 1 },
          { es: '`O(1)`', en: '`O(1)`' },
        ],
        why: {
          es: 'Insertar 1, 2, 3… en orden degenera el árbol en una lista de 1000 niveles; el 1000 es el último. Un ABB sin equilibrar no garantiza $O(\\log n)$: depende del orden de entrada.',
          en: 'Inserting 1, 2, 3… in order degenerates the tree into a list of 1000 levels; the 1000 is the last one. An unbalanced BST does not guarantee $O(\\log n)$: it depends on the input order.',
        },
      } },
    { arbol: { ...arbolVacio(), cabida: CAB_JUEGO }, code: C_INS, line: null,
      es: 'Inserta valores y compara. Con «mayor + 1» el árbol siempre degenera. Con valores al azar suele quedar mucho más bajo que $n$, aunque sin garantía. Compara $h$ con el mínimo $\\lceil \\log_2(n+1) \\rceil$. (Máximo 10 nodos.)',
      en: 'Insert values and compare. With «insert max + 1» the tree always degenerates. With random values it is usually much lower than $n$, though with no guarantee. Compare $h$ with the minimum $\\lceil \\log_2(n+1) \\rceil$. (At most 10 nodes.)',
      jugar: { botones: juegoBotones, lecturas: juegoLecturas } },

    // ── 5. Montículo en vista de árbol ──
    { sec: { es: 'Montículo en vista de árbol', en: 'Heap as a tree' }, arbol: { ...arbolDeArray(HEAP0), cabida: CAB_HEAP }, etiquetas: etiquetasHeap(7), code: C_HEAP0, line: null, hl: { h0: 'b' },
      es: 'Un **montículo** (heap) es un array leído como árbol: el elemento `i` tiene como padre $\\lfloor (i-1)/2 \\rfloor$ y como hijos $2i+1$ y $2i+2$. No hay punteros: bastan los índices. Regla (montículo máximo): cada nodo es mayor o igual que sus hijos, así que el mayor está en la raíz.',
      en: 'A **heap** is an array read as a tree: element `i` has parent $\\lfloor (i-1)/2 \\rfloor$ and children $2i+1$ and $2i+2$. There are no pointers: indices are enough. Rule (max-heap): every node is greater than or equal to its children, so the largest is at the root.' },
    { hl: { h6: 'a' }, line: null,
      es: 'El elemento en la posición 6 del array es el 15. ¿En qué posición está su padre?',
      en: 'The element at position 6 of the array is 15. At which position is its parent?',
      pregunta: {
        opc: [
          { es: 'En la 2 (el 40)', en: 'At 2 (the 40)', ok: 1 },
          { es: 'En la 3 (el 10)', en: 'At 3 (the 10)' },
          { es: 'En la 5 (el 35)', en: 'At 5 (the 35)' },
        ],
        why: {
          es: 'El padre de `i` es $\\lfloor (i-1)/2 \\rfloor$: para $i=6$, $\\lfloor 5/2 \\rfloor = 2$. En C++ `(6 - 1) / 2` da 2 por la división entera. Los hijos de la posición 2 son la 5 y la 6.',
          en: 'The parent of `i` is $\\lfloor (i-1)/2 \\rfloor$: for $i=6$, $\\lfloor 5/2 \\rfloor = 2$. In C++ `(6 - 1) / 2` gives 2 thanks to integer division. The children of position 2 are 5 and 6.',
        },
      } },
    { code: C_SUBIR, line: null, est: null, traza: SUBIR.frames,
      es: '`push(45)` añade el valor al final del array (el primer hueco libre del árbol) y lo **sube** («sift-up») mientras sea mayor que su padre. Como mucho un intercambio por nivel, y hay $\\lfloor \\log_2 n \\rfloor$ niveles bajo la raíz: $O(\\log n)$.',
      en: '`push(45)` appends the value at the end of the array (the first free spot of the tree) and **moves it up** («sift-up») while it is larger than its parent. At most one swap per level, and there are $\\lfloor \\log_2 n \\rfloor$ levels below the root: $O(\\log n)$.' },
    { ...parcheHeap(HEAP0, HEAP1), code: C_BAJAR, line: null, traza: BAJAR.frames,
      es: '`pop()` quita la raíz. El **último** elemento ocupa su lugar y se **baja** («sift-down»), intercambiándolo siempre con el hijo mayor, hasta que sea mayor o igual que sus hijos. También $O(\\log n)$. `top()` solo lee `h[0]`: $O(1)$.',
      en: '`pop()` removes the root. The **last** element takes its place and **moves down** («sift-down»), always swapping with the larger child, until it is greater than or equal to its children. Also $O(\\log n)$. `top()` just reads `h[0]`: $O(1)$.' },
    { ...parcheHeap(HEAP1, HEAP2), code: C_PQ, line: null,
      es: '`priority_queue` es este montículo dentro de un `vector`: máximo por defecto, mínimo con `greater<int>`. `make_heap` convierte un array cualquiera en montículo en $O(n)$, mejor que $n$ inserciones ($O(n \\log n)$). Un montículo **no** es un ABB: no sirve para buscar un valor cualquiera.',
      en: '`priority_queue` is this heap inside a `vector`: max by default, min with `greater<int>`. `make_heap` turns any array into a heap in $O(n)$, better than $n$ insertions ($O(n \\log n)$). A heap is **not** a BST: it is no good for finding an arbitrary value.' },
    { line: null,
      es: '¿Dónde puede estar el valor más pequeño de un montículo máximo?',
      en: 'Where can the smallest value of a max-heap be?',
      pregunta: {
        opc: [
          { es: 'En la raíz', en: 'At the root' },
          { es: 'En alguna hoja: hay que mirarlas todas', en: 'In some leaf: you have to check them all', ok: 1 },
          { es: 'Siempre en la última posición del array', en: 'Always at the last position of the array' },
        ],
        why: {
          es: 'Un nodo con hijos es mayor o igual que ellos, así que alguna hoja tiene el valor mínimo. Pero el montículo no ordena entre ramas: puede estar en cualquiera, y encontrarlo cuesta $O(n)$.',
          en: 'A node with children is greater than or equal to them, so some leaf holds the minimum value. But the heap does not order across branches: it can be in any of them, and finding it costs $O(n)$.',
        },
      } },

    // ── 6. Comparativa de costes ──
    { sec: { es: 'Comparativa de costes', en: 'Cost comparison' }, celdas: TARJ, mostrar: TID, code: '', line: null,
      val: fila(TID, ['O(1)', 'O(n)', '—', '—', 'top: O(1)']), hl: { cv: 'b', cl: 'c' },
      es: '**Acceso por posición.** El `vector` calcula la dirección: $O(1)$. La `list` debe recorrer: $O(n)$. Pila y cola solo ven sus extremos; el ABB y el montículo no se indexan (del montículo solo interesa la raíz).',
      en: '**Access by position.** The `vector` computes the address: $O(1)$. The `list` must walk: $O(n)$. Stack and queue only see their ends; the BST and the heap are not indexed (only the root matters in the heap).' },
    { val: fila(TID, ['O(n)', 'O(n)', 'O(n)', 'O(h)', 'O(n)']), hl: { ca: 'b' },
      es: '**Buscar un valor.** En `vector`, `list`, pila, cola y montículo hay que mirar elementos uno a uno: $O(n)$ (un `vector` ordenado admite búsqueda binaria, $O(\\log n)$). El ABB cuesta $O(h)$: $O(\\log n)$ si está equilibrado y $O(n)$ si degenera.',
      en: '**Finding a value.** In `vector`, `list`, stack, queue and heap you must look at elements one by one: $O(n)$ (a sorted `vector` allows binary search, $O(\\log n)$). The BST costs $O(h)$: $O(\\log n)$ if balanced and $O(n)$ if degenerate.' },
    { val: fila(TID, ['O(1) amort.', 'O(1) con nodo', 'O(1)', 'O(h)', 'O(log n)']), hl: { ch: 'b', cl: 'a' },
      es: '**Insertar.** `push_back` en `vector`: $O(1)$ amortizado (en medio, $O(n)$ por los desplazamientos). `list`: $O(1)$ con el nodo en la mano. Pila y cola: $O(1)$. ABB: $O(h)$. Montículo: $O(\\log n)$.',
      en: '**Inserting.** `push_back` on `vector`: $O(1)$ amortized (in the middle, $O(n)$ because of shifting). `list`: $O(1)$ with the node in hand. Stack and queue: $O(1)$. BST: $O(h)$. Heap: $O(\\log n)$.' },
    { hl: { cv: 'b' },
      es: 'En la práctica el `vector` suele ganar a la `list` aunque la teoría diga otra cosa: sus elementos son contiguos, hay una sola asignación y la caché los aprovecha. Lista, ABB y `map` pagan un nodo por elemento (al menos un puntero extra) y saltos por memoria. Si dudas, mide con `medir()`.',
      en: 'In practice the `vector` usually beats the `list` even where theory says otherwise: its elements are contiguous, there is a single allocation and the cache takes advantage of it. List, BST and `map` pay one node per element (at least one extra pointer) and memory jumps. If in doubt, measure with `medir()`.' },
    { hl: { ch: 'a' },
      es: 'Un planificador recibe tareas con prioridad y siempre debe atender la de mayor prioridad entre las pendientes, mientras llegan tareas nuevas. ¿Qué estructura eliges?',
      en: 'A scheduler receives tasks with a priority and must always serve the highest-priority pending one, while new tasks keep arriving. Which structure do you pick?',
      pregunta: {
        opc: [
          { es: '`priority_queue` (montículo)', en: '`priority_queue` (heap)', ok: 1 },
          { es: 'Un `vector` ordenado, insertando cada tarea en su sitio', en: 'A sorted `vector`, inserting each task in its place' },
          { es: 'Una `queue`', en: 'A `queue`' },
        ],
        why: {
          es: '`push` y `pop` del mayor cuestan $O(\\log n)$. El `vector` ordenado paga $O(n)$ por insertar en medio. La `queue` atiende por orden de llegada e ignora la prioridad.',
          en: '`push` and `pop` of the largest cost $O(\\log n)$. The sorted `vector` pays $O(n)$ to insert in the middle. The `queue` serves in order of arrival and ignores priority.',
        },
      } },
  ],
};
