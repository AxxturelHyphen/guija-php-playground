// Guía «Recursión y complejidad». Mismo formato de paso que data/punteros.js (celdas), arbol.js (árboles de llamadas y por
// niveles) y grafica.js (curvas de coste). Cada escena abre con su clave; un paso con `traza` reproduce frames que NO
// persisten al pasar al paso siguiente, así que el paso que sigue a una traza restaura el estado con un parche.
// Las trazas se generan EJECUTANDO el algoritmo (data/recursion-traza.js, probado en tests/guias/test-recursion.js).
import { cabidaDe } from '../arbol.js';
import {
  tr, fibNum, llamadasFib, llamadasMemo, sumaPila, sumaSinBase, sumaCola, plegarCeldas, parcheHacia,
  fibLlamadas, tamanosSubarbol, marcasRepetidas, memoPoda, finalArbol, hanoiLlamadas, etiquetasHanoi,
  TM, NOTAS_TM, estTodoOk, framesNiveles, cadena, maestro, textoRecurrencia, fmt2, OPS, duracion,
} from './recursion-traza.js';

const C = (es, en) => ({ es, en }); // listado con comentarios bilingües (mismo nº de líneas)
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = n => String(n).replace(/\d/g, d => SUP[d]);

// ── 1. Pila de llamadas ──────────────────────────────────────────────────────────────────────────────────────────
const ZP = [{ col: 0, titulo: { es: 'Pila (stack)', en: 'Stack' }, tono: 'pila' }];
const C_SUMA = C(`int suma(int n) {
    if (n == 0) return 0;          // caso base
    return n + suma(n - 1);        // caso recursivo
}
int main() {
    int r = suma(3);
}`, `int suma(int n) {
    if (n == 0) return 0;          // base case
    return n + suma(n - 1);        // recursive case
}
int main() {
    int r = suma(3);
}`);
const SP = sumaPila(3);
const INI = { st: { r: 'vivo' }, val: { r: '?' } }; // estado tras abrir cualquiera de las escenas de pila
const PROFUNDO = parcheHacia(INI, plegarCeldas(INI, SP.frames.slice(0, 3 + 2))); // hasta el caso base, con los 4 marcos vivos

const C_SIN = C(`int suma(int n) {
    return n + suma(n - 1);   // sin caso base
}
int main() {
    int r = suma(2);
}`, `int suma(int n) {
    return n + suma(n - 1);   // no base case
}
int main() {
    int r = suma(2);
}`);
const SB = sumaSinBase(2, 3);
const FIN_SB = parcheHacia(INI, plegarCeldas(INI, SB.frames));

const C_COLA = C(`int sumaAcc(int n, int acc) {
    if (n == 0) return acc;
    return sumaAcc(n - 1, acc + n);   // la llamada es lo último que se hace
}
int main() {
    int r = sumaAcc(3, 0);
}`, `int sumaAcc(int n, int acc) {
    if (n == 0) return acc;
    return sumaAcc(n - 1, acc + n);   // the call is the last thing done
}
int main() {
    int r = sumaAcc(3, 0);
}`);
const SC = sumaCola(3);
const C_BUCLE = `int sumaBucle(int n) {
    int acc = 0;
    while (n > 0) { acc += n; n--; }
    return acc;
}`;

// ── 2. Árboles de llamadas ───────────────────────────────────────────────────────────────────────────────────────
const C_FIB = `long long fib(int n) {
    if (n < 2) return n;
    return fib(n - 1) + fib(n - 2);
}`;
const FIB = fibLlamadas(5);
const MEMO = memoPoda(FIB.arbol);
const C_MEMO = C(`long long memo[64];          // 0 = aún sin calcular
long long fib(int n) {
    if (n < 2) return n;
    if (memo[n]) return memo[n];
    return memo[n] = fib(n - 1) + fib(n - 2);
}`, `long long memo[64];          // 0 = not computed yet
long long fib(int n) {
    if (n < 2) return n;
    if (memo[n]) return memo[n];
    return memo[n] = fib(n - 1) + fib(n - 2);
}`);
const C_ITER = `long long fib(int n) {
    long long a = 0, b = 1;      // fib(0), fib(1)
    for (int i = 0; i < n; i++) {
        long long t = a + b;
        a = b;
        b = t;
    }
    return a;
}`;
const tam = tamanosSubarbol(FIB.arbol);
const etiquetasTam = Object.fromEntries(Object.entries(tam).map(([id, n]) => [id, String(n)]));
const FIN_MEMO = finalArbol({ nodos: [FIB.arbol.nodos[0]], aristas: [], raiz: 'c0' }, [
  { '+nodos': FIB.arbol.nodos.slice(1), '+aristas': FIB.arbol.aristas }, { est: null, etiquetas: null },
], MEMO.frames);

const C_HANOI = `void hanoi(int n, char de, char a, char por) {
    if (n == 1) { mover(de, a); return; }
    hanoi(n - 1, de, por, a);
    mover(de, a);
    hanoi(n - 1, por, a, de);
}`;
const HAN = hanoiLlamadas(3);

// Gráfica de llamadas: ingenuo, con memo, iterativo
const CURVAS_FIB = [
  { id: 'ing', nombre: { es: 'ingenuo', en: 'naive' }, f: llamadasFib },
  { id: 'memo', nombre: { es: 'con memo', en: 'memoized' }, f: llamadasMemo },
  { id: 'iter', nombre: { es: 'iterativo', en: 'iterative' }, f: n => n },
];

// ── 3. Cómo crece el coste ───────────────────────────────────────────────────────────────────────────────────────
const lg = n => Math.log2(Math.max(1, n));
const CURVAS = [
  { id: 'c1', nombre: '$O(1)$', f: () => 1 },
  { id: 'log', nombre: '$O(\\log n)$', f: lg },
  { id: 'n', nombre: '$O(n)$', f: n => n },
  { id: 'nlogn', nombre: '$O(n \\log n)$', f: n => n * lg(n) },
  { id: 'n2', nombre: '$O(n^2)$', f: n => n * n },
  { id: 'exp', nombre: '$O(2^n)$', f: n => 2 ** n },
];
const TODAS = CURVAS.map(c => c.id);
const BASE = { curvas: CURVAS, nmax: 30 };
const CLASES = [['c1', '$O(1)$'], ['log', '$O(\\log n)$'], ['n', '$O(n)$'], ['nlogn', '$O(n \\log n)$'], ['n2', '$O(n^2)$'], ['exp', '$O(2^n)$']];

// Tiempo según n: n = 10^k, velocidad = 10^vel operaciones por segundo (el estado extra vive en la vista `v`)
const K = v => v.k ?? 6, VEL = v => v.vel ?? 9;
const TIEMPOS = [['log', '$O(\\log n)$'], ['n', '$O(n)$'], ['nlogn', '$O(n \\log n)$'], ['n2', '$O(n^2)$'], ['exp', '$O(2^n)$']];

const CURVAS_T = [
  { id: 't', nombre: '$3n^2+5n+20$', f: n => 3 * n * n + 5 * n + 20 },
  { id: 'n2', nombre: '$n^2$', f: n => n * n },
  { id: 'c28', nombre: '$28n^2$', f: n => 28 * n * n },
];

// ── 4. Recurrencias ──────────────────────────────────────────────────────────────────────────────────────────────
const C_MERGE = `void mergeSort(vector<int>& v, int lo, int hi) {
    if (hi - lo < 2) return;
    int mid = (lo + hi) / 2;
    mergeSort(v, lo, mid);       // T(n/2)
    mergeSort(v, mid, hi);       // T(n/2)
    merge(v, lo, mid, hi);       // O(n)
}`;
const C_ORD = C(`void ordenar(vector<int>& v, int n) {      // los n primeros
    if (n <= 1) return;
    ordenar(v, n - 1);                     // T(n-1)
    int x = v[n - 1], j = n - 2;
    while (j >= 0 && v[j] > x) { v[j + 1] = v[j]; j--; }   // hasta n pasos
    v[j + 1] = x;
}`, `void ordenar(vector<int>& v, int n) {      // the first n
    if (n <= 1) return;
    ordenar(v, n - 1);                     // T(n-1)
    int x = v[n - 1], j = n - 2;
    while (j >= 0 && v[j] > x) { v[j + 1] = v[j]; j--; }   // up to n steps
    v[j + 1] = x;
}`);
const C_BUS = `int buscar(const vector<int>& v, int x, int lo, int hi) {
    if (lo > hi) return -1;
    int mid = lo + (hi - lo) / 2;
    if (v[mid] == x) return mid;
    if (x < v[mid]) return buscar(v, x, lo, mid - 1);
    return buscar(v, x, mid + 1, hi);
}`;
const CAD_RESTA = cadena(['n', 'n-1', 'n-2', '…', '1'],
  [C('n', 'n'), C('n−1', 'n−1'), C('n−2', 'n−2'), C('…', '…'), C('1', '1')].map((x, i) => ({ es: `nivel ${i}: ${x.es}`, en: `level ${i}: ${x.en}` })),
  i => [['', 'Nivel 1: la llamada con n-1 elementos cuesta n-1.', 'Nivel 2: n-2.', 'Los niveles siguientes bajan de uno en uno…', 'Último nivel: 1.'][i],
    ['', 'Level 1: the call with n-1 elements costs n-1.', 'Level 2: n-2.', 'The next levels go down one by one…', 'Last level: 1.'][i]],
  { etiqueta: '≈ n²/2', es: 'n + (n-1) + … + 1 = n(n+1)/2: cuadrático.', en: 'n + (n-1) + … + 1 = n(n+1)/2: quadratic.' });
const CAD_MITAD = cadena(['n', 'n/2', 'n/4', 'n/8', '1'],
  ['n', 'n/2', 'n/4', 'n/8', '1'].map((t, i) => ({ es: `nivel ${i}: tamaño ${t}, coste 1`, en: `level ${i}: size ${t}, cost 1` })),
  () => ['', ''], { etiqueta: 'log n', es: '', en: '' });

const ajusta = (k, d, lo, hi, def) => ({
  label: `${k} ${d > 0 ? '+' : '−'} 1`,
  hacer: v => { v[k] = Math.min(hi, Math.max(lo, (v[k] ?? def) + d)); },
  off: v => { const x = v[k] ?? def; return d > 0 ? x >= hi : x <= lo; },
});
const abc = v => [v.a ?? 2, v.b ?? 2, v.c ?? 1];

export default {
  titulo: { es: 'Recursión y complejidad', en: 'Recursion and complexity' },
  fuentes: [
    'Bryant, R. E., & O\'Hallaron, D. R. (2016). *Computer systems: A programmer\'s perspective* (3rd ed.). Pearson.',
    'Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). *Introduction to algorithms* (4th ed.). MIT Press.',
    'Sedgewick, R., & Wayne, K. (2011). *Algorithms* (4th ed.). Addison-Wesley. https://algs4.cs.princeton.edu/home/',
  ],
  pasos: [
    // ═══ 1. La pila de llamadas ═══
    { sec: { es: 'La pila de llamadas', en: 'The call stack' }, celdas: SP.celdas, zonas: ZP, grupos: SP.grupos, code: C_SUMA, line: 3,
      mostrar: ['r'], val: { r: '?' },
      es: 'Una función **recursiva** se llama a sí misma. Necesita un **caso base**, que se resuelve sin llamarse (`n == 0`), y un **caso recursivo**, que reduce el problema y se llama con una entrada más pequeña (`n - 1`). Cada llamada pendiente tiene su propio marco en la pila.',
      en: 'A **recursive** function calls itself. It needs a **base case**, solved without calling itself (`n == 0`), and a **recursive case**, which shrinks the problem and calls itself on a smaller input (`n - 1`). Every pending call has its own frame on the stack.' },
    { line: 6, traza: SP.frames,
      es: 'Reproduce la traza de `suma(3)`. Cada llamada **apila** un marco con su propia `n`. Al llegar al caso base empiezan las devoluciones y cada marco se **desapila**: el último en entrar es el primero en salir.',
      en: 'Play the trace of `suma(3)`. Every call **pushes** a frame with its own `n`. At the base case the returns begin and each frame is **popped**: the last one in is the first one out.' },
    { ...PROFUNDO, line: 2, hl: { n3: 'a' },
      es: 'En el punto más profundo hay cuatro marcos de `suma` vivos a la vez, además del de `main`. La recursión gasta pila proporcional a su profundidad: $O(n)$ de memoria extra, aunque no declares ningún array. (El valor devuelto suele viajar en un registro; aquí se dibuja en el marco para seguir las cuentas.)',
      en: 'At the deepest point four `suma` frames are alive at once, besides the one of `main`. Recursion uses stack proportional to its depth: $O(n)$ extra memory, even if you declare no array. (The return value usually travels in a register; here it is drawn in the frame to follow the arithmetic.)' },
    { celdas: SB.celdas, zonas: ZP, grupos: SB.grupos, code: C_SIN, line: 5, mostrar: ['r'], val: { r: '?' }, traza: SB.frames,
      es: 'Quitamos el caso base. Nada detiene la cadena: `n` baja a 0, a -1, a -2… y cada llamada apila otro marco. La pila es finita, así que tarde o temprano se agota. Reproduce la traza.',
      en: 'We remove the base case. Nothing stops the chain: `n` goes down to 0, -1, -2… and every call pushes another frame. The stack is finite, so sooner or later it runs out. Play the trace.' },
    { ...FIN_SB, line: 2,
      es: 'El motor C++ del playground ejecuta `main` en un hilo con una pila de 256 MB; en un sistema típico son unos pocos MB (8 MB en Linux). Se agota más tarde, pero se agota. ¿Qué ocurre al ejecutar este `suma(2)` sin caso base?',
      en: 'The playground\'s C++ engine runs `main` in a thread with a 256 MB stack; a typical system gives a few MB (8 MB on Linux). It runs out later, but it does run out. What happens when this `suma(2)` without a base case runs?',
      pregunta: {
        opc: [
          { es: 'Devuelve 0 al llegar a `n = 0`', en: 'It returns 0 on reaching `n = 0`' },
          { es: 'Apila marcos hasta agotar la pila y el programa termina con un error', en: 'It pushes frames until the stack is exhausted and the program ends with an error', ok: 1 },
          { es: 'No compila: C++ exige un caso base', en: 'It does not compile: C++ requires a base case' },
        ],
        why: {
          es: 'Nada detiene las llamadas. El compilador puede avisar, pero el código es válido; al ejecutarlo la pila se agota (*stack overflow*). El caso base es lo que garantiza que la recursión termina.',
          en: 'Nothing stops the calls. The compiler may warn, but the code is valid; when run, the stack runs out (*stack overflow*). The base case is what guarantees that recursion ends.',
        },
      } },
    { celdas: SC.celdas, zonas: ZP, grupos: SC.grupos, code: C_COLA, line: 6, mostrar: ['r'], val: { r: '?' }, traza: SC.frames,
      es: 'Aquí la llamada recursiva es lo **último** que hace la función (recursión de cola): el resultado parcial viaja en `acc`. Un compilador con optimización **puede** convertirla en un bucle y reutilizar un solo marco; el estándar de C++ no lo garantiza.',
      en: 'Here the recursive call is the **last** thing the function does (tail recursion): the partial result travels in `acc`. An optimizing compiler **may** turn it into a loop and reuse a single frame; the C++ standard does not guarantee it.' },
    { mostrar: ['n', 'acc'], val: { n: 0, acc: 6 }, code: C_BUCLE, line: 3,
      es: 'Equivale a este bucle: un solo marco, memoria constante. Si la profundidad puede ser grande, no cuentes con que el compilador optimice: escribe el bucle o usa una pila propia (`vector`). Con profundidades pequeñas, la versión recursiva suele ser más clara.',
      en: 'It is equivalent to this loop: a single frame, constant memory. If the depth can be large, do not count on the compiler optimizing: write the loop or use your own stack (`vector`). With small depths, the recursive version is usually clearer.' },

    // ═══ 2. Árbol de llamadas ═══
    { sec: { es: 'Árbol de llamadas', en: 'Call tree' }, leyenda: ['activo', 'camino', 'hecho'],
      arbol: { nodos: [FIB.arbol.nodos[0]], aristas: [], raiz: 'c0', cabida: cabidaDe(FIB.arbol) },
      code: C_FIB, line: 1, hl: { c0: 'a' }, traza: FIB.frames,
      es: 'Cada llamada recursiva es un nodo del **árbol de llamadas** y las llamadas que hace son sus hijos. Reproduce la traza de `fib(5)`: el árbol crece con cada llamada y cada nodo anota lo que devuelve.',
      en: 'Each recursive call is a node of the **call tree** and the calls it makes are its children. Play the `fib(5)` trace: the tree grows with every call and each node notes what it returns.' },
    { '+nodos': FIB.arbol.nodos.slice(1), '+aristas': FIB.arbol.aristas, ...marcasRepetidas(FIB.arbol), line: null,
      es: 'Fíjate en las repeticiones: `fib(3)` aparece 2 veces y `fib(2)` 3 veces (borde discontinuo); `fib(1)` sale 5 veces. Cada repetición recalcula un subárbol entero. Con `fib(40)` son unos 331 millones de llamadas para solo 41 valores distintos.',
      en: 'Look at the repetitions: `fib(3)` appears 2 times and `fib(2)` 3 times (dashed border); `fib(1)` shows up 5 times. Each repetition recomputes a whole subtree. With `fib(40)` there are about 331 million calls for just 41 distinct values.' },
    { est: null, etiquetas: etiquetasTam,
      es: 'Cada nodo indica cuántas llamadas contiene su subárbol, él incluido. Un nodo vale 1 más la suma de sus dos hijos: $T(n)=T(n-1)+T(n-2)+1$, con $T(0)=T(1)=1$. Salen 1, 1, 3, 5, 9, 15, 25… (la raíz de `fib(5)` vale 15).',
      en: 'Each node shows how many calls its subtree contains, itself included. A node is worth 1 plus the sum of its two children: $T(n)=T(n-1)+T(n-2)+1$, with $T(0)=T(1)=1$. It gives 1, 1, 3, 5, 9, 15, 25… (the root of `fib(5)` is 15).' },
    { hl: { c0: 'a' },
      es: 'Cada nodo hace como mucho dos llamadas y la altura es $n$, así que $T(n)=O(2^n)$. El valor exacto es $T(n)=2F_{n+1}-1=\\Theta(\\varphi^n)$, con $\\varphi=\\frac{1+\\sqrt5}{2}\\approx1{,}618$: menos que $2^n$, pero igualmente exponencial. Si `fib(5)` hace 15 llamadas y `fib(4)` 9, ¿cuántas hace `fib(6)`?',
      en: 'Each node makes at most two calls and the height is $n$, so $T(n)=O(2^n)$. The exact value is $T(n)=2F_{n+1}-1=\\Theta(\\varphi^n)$, with $\\varphi=\\frac{1+\\sqrt5}{2}\\approx1.618$: less than $2^n$, but still exponential. If `fib(5)` makes 15 calls and `fib(4)` 9, how many does `fib(6)` make?',
      pregunta: {
        opc: [
          { es: '21', en: '21' },
          { es: '25', en: '25', ok: 1 },
          { es: '30', en: '30' },
        ],
        why: {
          es: '$T(6)=T(5)+T(4)+1=15+9+1=25$. No es el doble ni la suma sin más: hay que contar también la propia llamada.',
          en: '$T(6)=T(5)+T(4)+1=15+9+1=25$. It is neither double nor the plain sum: the call itself must be counted too.',
        },
      } },
    { est: null, etiquetas: null, code: C_MEMO, line: 4, traza: MEMO.frames,
      es: 'Guardamos cada resultado en la tabla `memo`. Si `fib(n)` ya está, se devuelve sin llamar a nadie y toda su rama se **poda**. Reproduce la traza: el árbol de `fib(5)` pasa de 15 llamadas a 9.',
      en: 'We store every result in the `memo` table. If `fib(n)` is already there, it is returned without calling anyone and its whole branch is **pruned**. Play the trace: the `fib(5)` tree goes from 15 calls to 9.' },
    { '-nodos': MEMO.podados, est: FIN_MEMO.est, etiquetas: FIN_MEMO.etiquetas, line: null,
      es: 'Quedan 9 llamadas. Cada valor se calcula una sola vez y las demás visitas cuestan $O(1)$: $2n-1$ llamadas en total, tiempo $O(n)$. El precio es memoria: la tabla, $O(n)$, además de la pila.',
      en: '9 calls remain. Each value is computed once and the other visits cost $O(1)$: $2n-1$ calls in total, time $O(n)$. The price is memory: the table, $O(n)$, besides the stack.' },
    { grafica: { curvas: CURVAS_FIB, nmax: 30, n: 20, ymax: { lin: 60 }, deslizador: true }, code: '', line: null,
      es: 'Llamadas según `n`: ingenuo, con memo e iterativo. Con `n = 30` el ingenuo hace unos 2,7 millones; los otros, menos de 60. Mueve `n` y prueba la escala logarítmica: ahí el ingenuo es casi una recta (crecimiento exponencial) y los otros, curvas que se aplanan.',
      en: 'Calls by `n`: naive, memoized and iterative. With `n = 30` the naive one makes about 2.7 million; the others, fewer than 60. Move `n` and try the log scale: there the naive one is almost a straight line (exponential growth) and the others are flattening curves.',
      jugar: {
        botones: [
          { label: 'n − 5', hacer: v => { v.n = Math.max(0, v.n - 5); }, off: v => v.n <= 0 },
          { label: 'n + 5', hacer: v => { v.n = Math.min(v.nmax, v.n + 5); }, off: v => v.n >= v.nmax },
          { label: { es: 'lineal / log', en: 'linear / log' }, hacer: v => { v.escala = v.escala === 'lin' ? 'log' : 'lin'; } },
        ],
        lecturas: (v, cx) => {
          const a = cx.f('ing', v.n), b = cx.f('memo', v.n);
          return [
            { expr: 'n', valor: v.n },
            { expr: tr('ingenuo', 'naive'), valor: cx.fmt(a), malo: a > 1000 },
            { expr: tr('con memo', 'memoized'), valor: cx.fmt(b) },
            { expr: tr('iterativo', 'iterative'), valor: cx.fmt(cx.f('iter', v.n)) },
            { expr: tr('ingenuo / memo', 'naive / memo'), valor: cx.fmt(b ? a / b : 0), malo: a / b > 10 },
          ];
        },
        arrastrables: true,
        soltar: (v, n) => { v.n = n; },
      } },
    { code: C_ITER, line: 3,
      es: 'El bucle hace lo mismo en $n$ iteraciones y con memoria $O(1)$: sin pila ni tabla, porque cada valor solo depende de los dos anteriores. Memoizar es la receta general; cuando el orden de cálculo es evidente, el bucle gana. Es la idea de la programación dinámica.',
      en: 'The loop does the same in $n$ iterations and $O(1)$ memory: no stack, no table, because each value only depends on the previous two. Memoization is the general recipe; when the order of computation is obvious, the loop wins. This is the idea of dynamic programming.' },
    { arbol: { nodos: [HAN.arbol.nodos[0]], aristas: [], raiz: 'c0', cabida: cabidaDe(HAN.arbol) }, code: C_HANOI, line: 1, hl: { c0: 'a' },
      es: 'Torres de Hanoi: mover $n$ discos de A a C, de uno en uno y sin poner uno grande sobre uno pequeño. Idea recursiva: pasar $n-1$ discos a B, mover el mayor a C y pasar los $n-1$ de B a C. Cada llamada hace un movimiento.',
      en: 'Towers of Hanoi: move $n$ disks from A to C, one at a time and never a larger disk on a smaller one. Recursive idea: move $n-1$ disks to B, move the largest to C and move the $n-1$ from B to C. Each call makes one move.' },
    { line: 1, traza: HAN.frames,
      es: 'Reproduce la traza de `hanoi(3)`. Las etiquetas numeran los movimientos: salen en el orden en que se recorre el árbol (in-orden): hijo izquierdo, movimiento del nodo, hijo derecho.',
      en: 'Play the `hanoi(3)` trace. The labels number the moves: they come out in the order the tree is walked (in-order): left child, the node\'s own move, right child.' },
    { '+nodos': HAN.arbol.nodos.slice(1), '+aristas': HAN.arbol.aristas, etiquetas: etiquetasHanoi(HAN), est: Object.fromEntries(HAN.arbol.nodos.map(n => [n.id, 'ok'])), line: null,
      es: 'Cada llamada hace un movimiento: movimientos = llamadas = $1+2+4=2^3-1=7$. En general $M(n)=2M(n-1)+1$, que da $M(n)=2^n-1$, y no existe una solución más corta. Con 64 discos serían más de $1{,}8\\cdot10^{19}$ movimientos. ¿Cuántos hacen falta con 5 discos?',
      en: 'Each call makes one move: moves = calls = $1+2+4=2^3-1=7$. In general $M(n)=2M(n-1)+1$, which gives $M(n)=2^n-1$, and no shorter solution exists. With 64 disks it would be over $1.8\\cdot10^{19}$ moves. How many are needed with 5 disks?',
      pregunta: {
        opc: [{ es: '25', en: '25' }, { es: '31', en: '31', ok: 1 }, { es: '32', en: '32' }],
        why: {
          es: 'Añadir un disco duplica los movimientos y suma uno: $2^5-1=31$. Crecimiento exponencial, como en el árbol del `fib` ingenuo.',
          en: 'Adding a disk doubles the moves and adds one: $2^5-1=31$. Exponential growth, as in the tree of the naive `fib`.',
        },
      } },

    // ═══ 3. Cómo crece el coste ═══
    { sec: { es: 'Cómo crece el coste', en: 'How cost grows' }, grafica: { ...BASE, n: 10, ver: ['c1'], ymax: 4 }, code: '', line: null,
      es: 'El **coste** de un algoritmo es el número de operaciones que hace en función del tamaño `n` de la entrada, no los segundos que tarda. Empezamos por **O(1)**: no depende de `n` (leer `v[0]`). Mueve el ratón por la gráfica para leer valores.',
      en: 'The **cost** of an algorithm is the number of operations it performs as a function of the input size `n`, not the seconds it takes. We start with **O(1)**: it does not depend on `n` (reading `v[0]`). Move the mouse over the chart to read values.' },
    { traza: [
      { ver: ['c1', 'log'], ymax: 8, n: 16, es: 'O(log n): cada paso descarta la mitad de los datos. Es la búsqueda binaria.', en: 'O(log n): each step discards half of the data. This is binary search.' },
      { ver: ['c1', 'log', 'n'], ymax: 40, n: 20, es: 'O(n): una operación por elemento. `suma(n)` hace n + 1 llamadas.', en: 'O(n): one operation per element. `suma(n)` makes n + 1 calls.' },
      { ver: ['c1', 'log', 'n', 'nlogn'], ymax: 160, es: 'O(n log n): ordenar con mergesort o `std::sort`.', en: 'O(n log n): sorting with mergesort or `std::sort`.' },
      { ver: ['c1', 'log', 'n', 'nlogn', 'n2'], ymax: 1000, es: 'O(n²): dos bucles anidados. Con n = 20 ya son 400 operaciones.', en: 'O(n²): two nested loops. With n = 20 that is already 400 operations.' },
      { ver: TODAS, es: 'O(2ⁿ): probar subconjuntos, Hanoi. Sale del recuadro: la curva se recorta con una marca ▲.', en: 'O(2ⁿ): trying subsets, Hanoi. It leaves the frame: the curve is clipped with a ▲ mark.' },
    ],
      es: 'Reproduce: las curvas van apareciendo de menor a mayor crecimiento. El eje vertical se reajusta cada vez; fíjate en cómo se separan.',
      en: 'Play: the curves appear from slowest to fastest growth. The vertical axis rescales each time; notice how they pull apart.' },
    { ver: TODAS, ymax: 1000, n: 20,
      es: 'Las recursiones de antes caben aquí: `suma(n)` es O(n); `hanoi(n)`, O(2ⁿ); `fib(n)` ingenuo, Θ(φⁿ) con φ ≈ 1,618, también exponencial; mergesort, O(n log n); la búsqueda binaria, O(log n). La clase importa más que los detalles.',
      en: 'The recursions from before fit here: `suma(n)` is O(n); `hanoi(n)`, O(2ⁿ); naive `fib(n)`, Θ(φⁿ) with φ ≈ 1.618, also exponential; mergesort, O(n log n); binary search, O(log n). The class matters more than the details.' },
    { escala: 'log', ymax: null, n: 30,
      es: 'Con escala **logarítmica** cada marca vale 10 veces la anterior y cabe todo: con `n = 30`, 2ⁿ ronda los 1,1e9. Una recta en esta escala es crecimiento exponencial; cuanto más pendiente, mayor la base.',
      en: 'With a **logarithmic** scale each tick is 10 times the previous one and everything fits: with `n = 30`, 2ⁿ is about 1.1e9. A straight line on this scale is exponential growth; the steeper, the larger the base.' },
    { grafica: { ...BASE, n: 12, ver: TODAS, escala: 'lin', deslizador: true }, code: '', line: null,
      es: 'Mueve `n` con el deslizador, los botones o **arrastrando** sobre la gráfica. Las lecturas dan el coste de cada clase; en rojo, más de un millón de operaciones. ¿Desde qué `n` supera 2ⁿ a n² para siempre?',
      en: 'Move `n` with the slider, the buttons or by **dragging** on the chart. The readings give the cost of each class; in red, more than a million operations. From which `n` does 2ⁿ stay above n² for good?',
      jugar: {
        botones: [
          { label: 'n − 5', hacer: v => { v.n = Math.max(0, v.n - 5); }, off: v => v.n <= 0 },
          { label: 'n + 5', hacer: v => { v.n = Math.min(v.nmax, v.n + 5); }, off: v => v.n >= v.nmax },
          { label: 'n × 2', hacer: v => { v.n = Math.min(v.nmax, Math.max(1, v.n * 2)); }, off: v => v.n >= v.nmax },
          { label: { es: 'lineal / log', en: 'linear / log' }, hacer: v => { v.escala = v.escala === 'lin' ? 'log' : 'lin'; } },
          { label: { es: 'ver / ocultar 2ⁿ', en: 'show / hide 2ⁿ' }, hacer: v => { v.ver = v.ver.includes('exp') ? v.ver.filter(i => i !== 'exp') : [...v.ver, 'exp']; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'n', valor: v.n },
          ...CLASES.map(([id, nombre]) => { const y = cx.f(id, v.n); return { expr: nombre, valor: cx.fmt(y), malo: y > 1e6 }; }),
        ],
        arrastrables: true,
        soltar: (v, n) => { v.n = n; },
      } },
    { grafica: { ...BASE, n: 30, ver: ['n', 'nlogn', 'n2', 'exp'], escala: 'log' }, code: '', line: null,
      es: 'Supón 10⁹ operaciones simples por segundo (un orden de magnitud optimista). Cambia `n` ×10 y la velocidad y mira cuánto tarda cada clase: con n = 10⁶, O(n²) son minutos; con n = 10⁹, años. La gráfica de fondo es la misma, solo para `n` pequeño.',
      en: 'Assume 10⁹ simple operations per second (an optimistic order of magnitude). Change `n` ×10 and the speed and see how long each class takes: with n = 10⁶, O(n²) takes minutes; with n = 10⁹, years. The chart behind is the same one, for small `n` only.',
      jugar: {
        botones: [
          { label: 'n × 10', hacer: v => { v.k = Math.min(9, K(v) + 1); }, off: v => K(v) >= 9 },
          { label: 'n ÷ 10', hacer: v => { v.k = Math.max(1, K(v) - 1); }, off: v => K(v) <= 1 },
          { label: { es: '10⁹ / 10⁸ op/s', en: '10⁹ / 10⁸ op/s' }, hacer: v => { v.vel = VEL(v) === 9 ? 8 : 9; } },
        ],
        lecturas: v => {
          const n = 10 ** K(v);
          return [
            { expr: 'n', valor: '10' + sup(K(v)) },
            { expr: tr('velocidad', 'speed'), valor: '10' + sup(VEL(v)) + ' op/s' },
            ...TIEMPOS.map(([id, nombre]) => { const s = OPS[id](n) / 10 ** VEL(v); return { expr: nombre, valor: duracion(s), malo: s > 3600 }; }),
          ];
        },
      } },
    { grafica: { curvas: CURVAS_T, nmax: 20, n: 10, ver: ['t', 'n2'], ymax: { lin: 1500 } }, code: '', line: null,
      es: 'Formalmente, $f(n)=O(g(n))$ si existen $c>0$ y $n_0$ tales que $f(n)\\le c\\,g(n)$ para todo $n\\ge n_0$. Ejemplo: $T(n)=3n^2+5n+20$. Para $n\\ge1$ se cumple $T(n)\\le 28n^2$, así que $T(n)=O(n^2)$.',
      en: 'Formally, $f(n)=O(g(n))$ if there exist $c>0$ and $n_0$ such that $f(n)\\le c\\,g(n)$ for all $n\\ge n_0$. Example: $T(n)=3n^2+5n+20$. For $n\\ge1$ we have $T(n)\\le 28n^2$, so $T(n)=O(n^2)$.' },
    { ver: ['t', 'n2', 'c28'], escala: 'log', ymax: null, n: 20,
      es: 'En escala logarítmica las tres curvas acaban casi paralelas: difieren en una constante, no en la forma. Por eso se descartan las constantes (el 3) y los términos menores ($5n$ y 20): para $n$ grande manda el cuadrado. Para `n` pequeño, en la práctica, las constantes sí importan.',
      en: 'On a log scale the three curves end up almost parallel: they differ by a constant, not in shape. That is why constants (the 3) and lower-order terms ($5n$ and 20) are dropped: for large $n$ the square rules. For small `n`, in practice, constants do matter.' },
    { ver: ['t', 'n2', 'c28'],
      es: '¿Qué $\\Theta$ describe $T(n)=5n^2+100n+7$?',
      en: 'Which $\\Theta$ describes $T(n)=5n^2+100n+7$?',
      pregunta: {
        opc: [{ es: 'Θ(n)', en: 'Θ(n)' }, { es: 'Θ(n²)', en: 'Θ(n²)', ok: 1 }, { es: 'Θ(n³)', en: 'Θ(n³)' }],
        why: {
          es: 'El término dominante es $5n^2$; se descarta la constante 5 y lo menor ($100n$ y 7). Θ(n³) sería una cota demasiado grande: $T$ no crece tanto.',
          en: 'The dominant term is $5n^2$; the constant 5 and the lower terms ($100n$ and 7) are dropped. Θ(n³) would be too large: $T$ does not grow that much.',
        },
      } },

    // ═══ 4. Recurrencias y teorema maestro ═══
    { sec: { es: 'Recurrencias y teorema maestro', en: 'Recurrences and the master theorem' },
      arbol: { ...TM, cabida: { ...cabidaDe(TM), notas: true }, notas: [] }, code: C_MERGE, line: 1, traza: framesNiveles(),
      es: 'Mergesort cuesta $T(n)=2T(n/2)+n$: dos mitades y un `merge` lineal. Dibujamos el árbol de llamadas **por niveles** y sumamos lo que se hace en cada nivel, sin contar lo de sus hijos. Reproduce la traza.',
      en: 'Mergesort costs $T(n)=2T(n/2)+n$: two halves and a linear `merge`. We draw the call tree **by levels** and add up the work done at each level, not counting that of its children. Play the trace.' },
    { est: estTodoOk(), etiquetas: { m0: 'n log n' }, notas: NOTAS_TM, line: null,
      es: 'Cada nivel aporta $n$ y hay $\\log_2 n+1$ niveles: $T(n)=\\sum_{i=0}^{\\log_2 n} n = n(\\log_2 n+1)=\\Theta(n\\log n)$. Para esta recurrencia basta sumar niveles.',
      en: 'Each level contributes $n$ and there are $\\log_2 n+1$ levels: $T(n)=\\sum_{i=0}^{\\log_2 n} n = n(\\log_2 n+1)=\\Theta(n\\log n)$. For this recurrence, adding up levels is enough.' },
    { arbol: CAD_RESTA.abre, code: C_ORD, line: 3, traza: CAD_RESTA.frames,
      es: 'Otra recurrencia: $T(n)=T(n-1)+n$ (insertion sort recursivo, en el peor caso). El árbol es una cadena y cada nivel cuesta un poco menos. Suma: $n+(n-1)+\\dots+1=\\frac{n(n+1)}{2}=\\Theta(n^2)$. Reproduce la traza.',
      en: 'Another recurrence: $T(n)=T(n-1)+n$ (recursive insertion sort, worst case). The tree is a chain and each level costs a little less. Sum: $n+(n-1)+\\dots+1=\\frac{n(n+1)}{2}=\\Theta(n^2)$. Play the trace.' },
    { arbol: { nodos: CAD_MITAD.nodos, aristas: CAD_MITAD.aristas, raiz: 'p0', cabida: CAD_MITAD.abre.cabida, notas: CAD_MITAD.completo.notas },
      est: Object.fromEntries(CAD_MITAD.nodos.map(n => [n.id, 'ok'])), etiquetas: { p0: 'log n' }, code: C_BUS, line: 5,
      es: 'Si el problema se reduce a la mitad con trabajo constante, $T(n)=T(n/2)+1$. La cadena tiene $\\log_2 n+1$ niveles de coste 1: $T(n)=\\Theta(\\log n)$. Es la búsqueda binaria.',
      en: 'If the problem is halved with constant work, $T(n)=T(n/2)+1$. The chain has $\\log_2 n+1$ levels of cost 1: $T(n)=\\Theta(\\log n)$. This is binary search.' },
    { code: '', line: null,
      es: 'Versión ligera del **teorema maestro**: $T(n)=aT(n/b)+n^c$. Compara $c$ con $\\log_b a$. Si $c<\\log_b a$ dominan las hojas: $\\Theta(n^{\\log_b a})$. Si son iguales, todos los niveles pesan lo mismo: $\\Theta(n^c\\log n)$. Si $c>\\log_b a$ domina la raíz: $\\Theta(n^c)$.',
      en: 'Light version of the **master theorem**: $T(n)=aT(n/b)+n^c$. Compare $c$ with $\\log_b a$. If $c<\\log_b a$ the leaves dominate: $\\Theta(n^{\\log_b a})$. If equal, every level weighs the same: $\\Theta(n^c\\log n)$. If $c>\\log_b a$ the root dominates: $\\Theta(n^c)$.' },
    { code: '',
      es: 'Cambia $a$, $b$ y $c$ con los botones. Mergesort es $a=2,\\ b=2,\\ c=1$; la búsqueda binaria, $a=1,\\ b=2,\\ c=0$. Fíjate en qué caso cae cada combinación.',
      en: 'Change $a$, $b$ and $c$ with the buttons. Mergesort is $a=2,\\ b=2,\\ c=1$; binary search, $a=1,\\ b=2,\\ c=0$. Notice which case each combination falls into.',
      jugar: {
        botones: [ajusta('a', 1, 1, 8, 2), ajusta('a', -1, 1, 8, 2), ajusta('b', 1, 2, 6, 2), ajusta('b', -1, 2, 6, 2), ajusta('c', 1, 0, 4, 1), ajusta('c', -1, 0, 4, 1)],
        lecturas: v => {
          const [a, b, c] = abc(v), m = maestro(a, b, c);
          return [
            { expr: tr('recurrencia', 'recurrence'), valor: 'T(n) = ' + textoRecurrencia(a, b, c) },
            { expr: 'log_b a', valor: fmt2(m.lg) },
            { expr: 'c  vs  log_b a', valor: `${c} ${m.cmp} ${fmt2(m.lg)}` },
            { expr: 'T(n)', valor: m.res },
          ];
        },
      } },
    { code: '',
      es: '¿Cuánto vale $T(n)=4T(n/2)+n$?',
      en: 'What is $T(n)=4T(n/2)+n$?',
      pregunta: {
        opc: [{ es: 'Θ(n)', en: 'Θ(n)' }, { es: 'Θ(n log n)', en: 'Θ(n log n)' }, { es: 'Θ(n²)', en: 'Θ(n²)', ok: 1 }],
        why: {
          es: 'Aquí $a=4$, $b=2$, $c=1$ y $\\log_2 4=2>1$: dominan las hojas, $\\Theta(n^2)$. El teorema no sirve para $T(n)=T(n-1)+n$ ni para la de `fib`: ahí se suman niveles o se resuelve a mano.',
          en: 'Here $a=4$, $b=2$, $c=1$ and $\\log_2 4=2>1$: the leaves dominate, $\\Theta(n^2)$. The theorem does not apply to $T(n)=T(n-1)+n$ or to the `fib` one: there you add up levels or solve by hand.',
        },
      } },

    // ═══ 5. Medir en el playground ═══
    { sec: { es: 'Medir en el playground', en: 'Measuring in the playground' },
      grafica: { curvas: CURVAS, nmax: 32, n: 16, ver: ['n', 'nlogn', 'n2', 'exp'], tabla: true }, code: '', line: null,
      es: 'Medir sirve para comprobar el modelo. Truco: **duplica** `n` y mira cuánto se multiplica el coste. O(n) se multiplica por 2; O(n²), por 4; O(n log n), por algo más de 2; O(2ⁿ) se eleva al cuadrado. La tabla muestra `n` y los hitos 8, 16 y 32.',
      en: 'Measuring is a way to check the model. Trick: **double** `n` and see how much the cost is multiplied. O(n) doubles; O(n²) is multiplied by 4; O(n log n) by a bit more than 2; O(2ⁿ) is squared. The table shows `n` and the milestones 8, 16 and 32.' },
    { traza: [
      { n: 4, es: 'Con n = 4 todo cuesta poco y casi igual.', en: 'With n = 4 everything is cheap and almost the same.' },
      { n: 8, es: 'n = 8: O(n) 8, O(n log n) 24, O(n²) 64, O(2ⁿ) 256.', en: 'n = 8: O(n) 8, O(n log n) 24, O(n²) 64, O(2ⁿ) 256.' },
      { n: 16, es: 'De 8 a 16: O(n) ×2, O(n log n) ×2,7, O(n²) ×4, O(2ⁿ) ×256.', en: 'From 8 to 16: O(n) ×2, O(n log n) ×2.7, O(n²) ×4, O(2ⁿ) ×256.' },
      { n: 32, es: 'De 16 a 32: ×2, ×2,5, ×4 y, para 2ⁿ, ×65 536.', en: 'From 16 to 32: ×2, ×2.5, ×4 and, for 2ⁿ, ×65,536.' },
    ],
      es: 'Reproduce el barrido: `n` se duplica en cada salto. El factor por el que se multiplica el coste delata la clase.',
      en: 'Play the sweep: `n` doubles at each jump. The factor by which the cost is multiplied reveals the class.' },
    { code: `medirCon("fibonacci", [](int n) { return n; }, [](auto& n) {
    noOptimizar(fibonacci(n));
}, "lineal", rango(5, 35, 5));`, line: 1,
      es: 'En el playground, `medir()` y `medirCon()` ejecutan tu función con varios tamaños, la cronometran y ajustan el modelo (O(1), O(log n), O(n), O(n log n), O(n²), O(n³) u O(2ⁿ)) cuyo cociente tiempo/f(n) es más constante. Se ve al pulsar Medir.',
      en: 'In the playground, `medir()` and `medirCon()` run your function with several sizes, time it and fit the model (O(1), O(log n), O(n), O(n log n), O(n²), O(n³) or O(2ⁿ)) whose time/f(n) ratio is the most constant. You see it by pressing Measure.' },
    { line: null,
      es: 'Una medida es una **estimación**, no una demostración. El reloj no distingue llamadas de microsegundos del ruido (repite la operación dentro de la medida), el compilador puede eliminar un cálculo cuyo resultado no se usa (`noOptimizar`) y con `n` pequeño pesan las constantes. Mide y razona con el árbol.',
      en: 'A measurement is an **estimate**, not a proof. The clock cannot tell microsecond calls from noise (repeat the operation inside the measurement), the compiler may remove a computation whose result is unused (`noOptimizar`) and with small `n` constants weigh in. Measure and reason with the tree.' },
    { line: null,
      es: 'Un programa tarda 40 ms con n = 100 000 y 160 ms con n = 200 000. ¿Qué modelo sugiere?',
      en: 'A program takes 40 ms with n = 100,000 and 160 ms with n = 200,000. Which model does it suggest?',
      pregunta: {
        opc: [{ es: 'O(n)', en: 'O(n)' }, { es: 'O(n log n)', en: 'O(n log n)' }, { es: 'O(n²)', en: 'O(n²)', ok: 1 }],
        why: {
          es: 'Al duplicar `n` el tiempo se multiplica por 4: es la huella de O(n²). Una sola pareja de medidas es poca evidencia: confírmalo con más tamaños.',
          en: 'When `n` doubles, the time is multiplied by 4: the footprint of O(n²). A single pair of measurements is weak evidence: confirm it with more sizes.',
        },
      } },
  ],
};
