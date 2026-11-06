// Guía «Programación dinámica». Todos los pasos usan la escena «tabla» (formato de parches en assets/guias/tabla.js; formato de
// paso en data/punteros.js). Las trazas se generan EJECUTANDO el algoritmo (data/dp-traza.js, probado en tests/guias/test-dp.js)
// y los números que aparecen en los textos (llamadas, objetos elegidos, subsecuencias…) también salen de ahí. Un paso con
// `traza` reproduce frames que NO persisten al pasar al siguiente: el paso que sigue a una traza restaura el estado con un parche.
// Continúa la guía de recursión (fib memoizado) sin repetirla: aquí la memoización se convierte en tabla y en método.
import {
  tr, fm, soloEst, todas, inicialFila, fibNum, llamadasFib, fibMemoTraza, sumaDosTraza, dosVariablesTraza,
  ITEMS, CAP, tablaMochila, cabMochila, mochilaTraza, caminoMochila, mochilaCaminoTraza, mochilaFilaTraza,
  A_LCS, B_LCS, cabLCS, tablaLCS, bordeLCS, lcsTraza, caminoLCS, todasLCS, lcsCaminoTraza,
  A_ED, B_ED, tablaEdicion, bordeEdicion, edicionTraza, caminoEdicion, textoOps, edicionCaminoTraza,
  tablaMonedas, mapaMal, monedasTraza, formasTabla, cabFormas, formasTraza, permutaciones,
  V_LIS, lisN2, lisTraza, lisColaTraza,
  limpiarTemp, elegirMochila, decidirMochila, autoRellenar, fijarCapacidad, elegirLCS, ajustarValor, comprobarLCS, aplicarMonedas,
} from './dp-traza.js';
import { leer } from '../tabla.js';

// ── Utilidades ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Listado C++ bilingüe: filas [código, comentario es, comentario en]; los comentarios se alinean (mismo nº de líneas en es y en). */
const listado = filas => {
  const w = Math.max(0, ...filas.filter(f => f[1]).map(f => f[0].length)) + 3;
  const lado = i => filas.map(f => (f[1] ? f[0].padEnd(w) + '// ' + f[i] : f[0])).join('\n');
  return { es: lado(1), en: lado(2) };
};
const nums = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
/** Parche que restaura una tabla (valores completos y estados) tras una traza. */
const reset = (val, est, filas, cols) => ({ val, est: soloEst(est, filas, cols), deps: null, marcas: null, resaltar: null, formula: null });
const celdasHechas = (fila, ks) => Object.fromEntries(ks.map(c => [`${fila},${c}`, 'hecha']));
const listaY = (xs, y = 'y') => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${y} ${xs.at(-1)}` : xs.join(''));

// ── Listados ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const C_FIB_MEMO = listado([
  ['long long fib(int n) {'],
  ['    if (n < 2) return n;', 'caso base', 'base case'],
  ['    if (memo[n] != -1) return memo[n];', 'ya calculado', 'already computed'],
  ['    return memo[n] = fib(n - 1) + fib(n - 2);', 'calcula y guarda', 'compute and store'],
  ['}'],
]);
const C_FIB_TAB = listado([
  ['long long fib(int n) {'],
  ['    vector<long long> t(max(n + 1, 2), 0);'],
  ['    t[1] = 1;', 'casos base: t[0] = 0, t[1] = 1', 'base cases: t[0] = 0, t[1] = 1'],
  ['    for (int i = 2; i <= n; i++)'],
  ['        t[i] = t[i - 1] + t[i - 2];', 'transición', 'transition'],
  ['    return t[n];'],
  ['}'],
]);
const C_ESC = listado([
  ['long long escaleras(int n) {'],
  ['    vector<long long> dp(max(n + 1, 2), 0);'],
  ['    dp[0] = dp[1] = 1;', 'base', 'base'],
  ['    for (int i = 2; i <= n; i++)'],
  ['        dp[i] = dp[i - 1] + dp[i - 2];', 'desde i-1 (1 paso) o i-2 (2 pasos)', 'from i-1 (1 step) or i-2 (2 steps)'],
  ['    return dp[n];'],
  ['}'],
]);
const C_ESC2 = listado([
  ['long long escaleras(int n) {'],
  ['    long long a = 1, b = 1;', 'a = dp[i-2], b = dp[i-1]', 'a = dp[i-2], b = dp[i-1]'],
  ['    for (int i = 2; i <= n; i++) {'],
  ['        long long c = a + b;'],
  ['        a = b;'],
  ['        b = c;'],
  ['    }'],
  ['    return b;'],
  ['}'],
]);
const C_MOCH = listado([
  ['int mochila(vector<int> p, vector<int> v, int W) {'],
  ['    int n = p.size();'],
  ['    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));'],
  ['    for (int i = 1; i <= n; i++) {'],
  ['        for (int w = 0; w <= W; w++) {'],
  ['            dp[i][w] = dp[i - 1][w];', 'no coger el objeto i', 'skip item i'],
  ['            if (w >= p[i - 1])', 'coger, si cabe', 'take it, if it fits'],
  ['                dp[i][w] = max(dp[i][w], dp[i - 1][w - p[i - 1]] + v[i - 1]);'],
  ['        }'],
  ['    }'],
  ['    return dp[n][W];'],
  ['}'],
]);
const C_MOCH_REC = listado([
  ['vector<int> elegidos;'],
  ['int w = W;'],
  ['for (int i = n; i >= 1; i--) {'],
  ['    if (dp[i][w] != dp[i - 1][w]) {', 'el objeto i se cogió', 'item i was taken'],
  ['        elegidos.push_back(i);'],
  ['        w -= p[i - 1];'],
  ['    }'],
  ['}'],
]);
const C_MOCH_FILA = listado([
  ['vector<int> dp(W + 1, 0);'],
  ['for (int i = 0; i < n; i++)'],
  ['    for (int w = W; w >= p[i]; w--)', 'de MAYOR a menor', 'from LARGEST to smallest'],
  ['        dp[w] = max(dp[w], dp[w - p[i]] + v[i]);'],
  ['return dp[W];'],
]);
const C_LCS = listado([
  ['int lcs(string a, string b) {'],
  ['    int n = a.size(), m = b.size();'],
  ['    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));'],
  ['    for (int i = 1; i <= n; i++)'],
  ['        for (int j = 1; j <= m; j++)'],
  ['            if (a[i - 1] == b[j - 1])'],
  ['                dp[i][j] = dp[i - 1][j - 1] + 1;', 'coinciden: extiende la diagonal', 'match: extend the diagonal'],
  ['            else'],
  ['                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);', 'descarta una letra', 'drop one letter'],
  ['    return dp[n][m];'],
  ['}'],
]);
const C_LCS_REC = listado([
  ['string sub;'],
  ['int i = n, j = m;'],
  ['while (i > 0 && j > 0) {'],
  ['    if (a[i - 1] == b[j - 1]) { sub += a[i - 1]; i--; j--; }'],
  ['    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;', 'sube', 'move up'],
  ['    else j--;', 'izquierda', 'move left'],
  ['}'],
  ['reverse(sub.begin(), sub.end());', 'se recogió al revés', 'collected backwards'],
]);
const C_EDIT = listado([
  ['int edicion(string a, string b) {'],
  ['    int n = a.size(), m = b.size();'],
  ['    vector<vector<int>> dp(n + 1, vector<int>(m + 1));'],
  ['    for (int i = 0; i <= n; i++) dp[i][0] = i;', 'borrar i letras', 'delete i letters'],
  ['    for (int j = 0; j <= m; j++) dp[0][j] = j;', 'insertar j letras', 'insert j letters'],
  ['    for (int i = 1; i <= n; i++)'],
  ['        for (int j = 1; j <= m; j++)'],
  ['            dp[i][j] = min({dp[i - 1][j] + 1,', 'borrar', 'delete'],
  ['                            dp[i][j - 1] + 1,', 'insertar', 'insert'],
  ['                            dp[i - 1][j - 1] + (a[i - 1] != b[j - 1])});', 'sustituir (o igual)', 'substitute (or match)'],
  ['    return dp[n][m];'],
  ['}'],
]);
const C_EDIT_REC = listado([
  ['while (i > 0 || j > 0) {'],
  ['    if (i > 0 && j > 0 && dp[i][j] == dp[i - 1][j - 1] + (a[i - 1] != b[j - 1])) { i--; j--; }'],
  ['    else if (i > 0 && dp[i][j] == dp[i - 1][j] + 1) i--;', 'borrar a[i-1]', 'delete a[i-1]'],
  ['    else j--;', 'insertar b[j-1]', 'insert b[j-1]'],
  ['}'],
]);
const C_MON = listado([
  ['int monedas(vector<int> m, int T) {'],
  ['    const int INF = T + 1;', '"infinito" que se puede sumar', '"infinity" that can be added'],
  ['    vector<int> dp(T + 1, INF);'],
  ['    dp[0] = 0;'],
  ['    for (int c = 1; c <= T; c++)'],
  ['        for (int x : m)'],
  ['            if (x <= c)', 'x como última moneda', 'x as the last coin'],
  ['                dp[c] = min(dp[c], dp[c - x] + 1);'],
  ['    return dp[T] >= INF ? -1 : dp[T];'],
  ['}'],
]);
const C_FORMAS = listado([
  ['long long formas(vector<int> m, int T) {'],
  ['    vector<long long> f(T + 1, 0);'],
  ['    f[0] = 1;', 'una forma de sumar 0', 'one way to make 0'],
  ['    for (int x : m)', 'monedas por FUERA: combinaciones', 'coins on the OUTSIDE: combinations'],
  ['        for (int c = x; c <= T; c++)'],
  ['            f[c] += f[c - x];'],
  ['    return f[T];'],
  ['}'],
]);
const C_LIS = listado([
  ['int lis(vector<int> v) {'],
  ['    int n = v.size(), mejor = 0;'],
  ['    vector<int> dp(n, 1);', 'termina en i: al menos 1', 'ends at i: at least 1'],
  ['    for (int i = 0; i < n; i++) {'],
  ['        for (int j = 0; j < i; j++)'],
  ['            if (v[j] < v[i])'],
  ['                dp[i] = max(dp[i], dp[j] + 1);'],
  ['        mejor = max(mejor, dp[i]);'],
  ['    }'],
  ['    return mejor;'],
  ['}'],
]);
const C_COLA = listado([
  ['vector<int> cola;', 'cola[k]: menor final de una creciente de largo k+1', 'cola[k]: smallest end of an increasing run of length k+1'],
  ['for (int x : v) {'],
  ['    auto it = lower_bound(cola.begin(), cola.end(), x);'],
  ['    if (it == cola.end()) cola.push_back(x);', 'alarga', 'extend'],
  ['    else *it = x;', 'mejora un final', 'improve an end'],
  ['}'],
  ['return cola.size();'],
]);

// ── Datos calculados (ejecutando los algoritmos) ───────────────────────────────────────────────────────────────────
// 1. fib
const NF = 6, FM = fibMemoTraza(NF), FILA_FIB = FM.fila;
const BASE_FIB = ['0,0', '0,1'];
// 2. escaleras
const NE = 8, ESC = sumaDosTraza(NE, 1, 1, 'esc'), DOS = dosVariablesTraza(NE);
// 3. mochila
const MOCH = mochilaTraza(), DPM = MOCH.dp, CAM = caminoMochila(DPM), MCAM = mochilaCaminoTraza();
const MF_ATRAS = mochilaFilaTraza('atras'), MF_ADEL = mochilaFilaTraza('adelante');
const FILA0 = Array(CAP + 1).fill(0);
const INI_JUEGO = DPM.map((f, i) => (i <= 2 ? [...f] : f.map(() => null)));
const EST_JUEGO = todas(DPM.slice(0, 3));
const CAM7 = Object.fromEntries(CAM.celdas.map(([i, w]) => [`${i},${w}`, 'camino']));
const TXT_ITEMS = listaY(CAM.elegidos.map(i => `${i}`));
// 4. LCS y edición
const LC = lcsTraza(), DPL = LC.dp, CL = caminoLCS(A_LCS, B_LCS, DPL), TODAS_LCS = todasLCS(A_LCS, B_LCS), LCV = lcsCaminoTraza();
const INI_LCS = DPL.map((f, i) => (i <= 5 ? [...f] : f.map((_, j) => (j === 0 ? 0 : null)))); // filas 0 a 5 hechas; en 6 y 7 solo el borde
const EST_INI_LCS = Object.fromEntries(INI_LCS.flatMap((f, i) => f.map((x, j) => (x === null ? null : [`${i},${j}`, 'hecha'])).filter(Boolean)));
const nl = DPL.length - 1, ml = DPL[0].length - 1;
const ED = edicionTraza(), DPE = ED.dp, CE = caminoEdicion(A_ED, B_ED, DPE), EDV = edicionCaminoTraza();
const borde = m => Object.fromEntries(m.flatMap((f, i) => f.map((_, j) => (i === 0 || j === 0 ? [`${i},${j}`, 'hecha'] : null)).filter(Boolean)));
const EST_BORDE_LCS = borde(DPL), EST_BORDE_ED = borde(DPE);
const cabEd = { filas: ['', ...A_ED], cols: ['', ...B_ED], esq: 'i\\j' };
// 5. monedas
const SETS = [[1, 3, 4], [1, 5, 10, 25], [1, 6, 10]], COLS_M = 13;
const MON = monedasTraza([1, 3, 4], COLS_M - 1), [DPMON, VZMON] = tablaMonedas([1, 3, 4], COLS_M - 1), MAL_MON = mapaMal(DPMON, VZMON);
const DIF_MON = Object.keys(MAL_MON).map(k => k.split(',')[1]);
const FOR = formasTraza(), FORM_PERM = permutaciones([1, 2, 5], 7);
const cabMon = { filas: ['DP', 'voraz'], cols: nums(0, COLS_M - 1), esq: 'T' };
// 6. LIS
const LI = lisTraza(), LN = lisN2(V_LIS), COLA = lisColaTraza();
const PREFIJO = LI.dp.map((_, i) => Math.max(...LI.dp.slice(0, i + 1)));

export default {
  titulo: { es: 'Programación dinámica', en: 'Dynamic programming' },
  fuentes: [
    'Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). *Introduction to algorithms* (4.ª ed.). The MIT Press. Capítulo 14: Dynamic programming.',
    'Dasgupta, S., Papadimitriou, C. H., & Vazirani, U. V. (2008). *Algorithms*. McGraw-Hill. Capítulo 6: Dynamic programming.',
    'Erickson, J. (2019). *Algorithms*. http://jeffe.cs.illinois.edu/teaching/algorithms/ Capítulo 3: Dynamic programming.',
    'Kleinberg, J., & Tardos, É. (2006). *Algorithm design*. Pearson. Capítulo 6: Dynamic programming.',
    'Skiena, S. S. (2020). *The algorithm design manual* (3.ª ed.). Springer. https://doi.org/10.1007/978-3-030-54256-6',
  ],
  pasos: [
    // ═══ 1. Cuándo hay DP ═══
    { sec: { es: 'Cuándo hay programación dinámica', en: 'When dynamic programming applies' }, leyenda: ['activo', 'compara', 'hecho'],
      tabla: { filas: 1, cols: NF + 1, cab: { filas: ['F(n)'], cols: nums(0, NF), esq: 'n' }, val: inicialFila(NF, 0, 1) }, est: celdasHechas(0, [0, 1]),
      code: C_FIB_MEMO, line: 1,
      es: 'La **programación dinámica** (DP) sirve cuando un problema se parte en subproblemas que **se repiten** y la mejor solución del grande se construye con las mejores de los pequeños (**subestructura óptima**). Es el `fib` de la guía de recursión, ahora con una tabla: una celda por subproblema, resuelto una sola vez.',
      en: 'A **dynamic programming** (DP) approach fits when a problem splits into subproblems that **repeat** and the best solution of the big one is built from the best ones of the small ones (**optimal substructure**). This is the `fib` from the recursion guide, now with a table: one cell per subproblem, solved only once.' },
    { ...reset(inicialFila(NF, 0, 1), celdasHechas(0, [0, 1]), 1, NF + 1), line: 1, traza: FM.frames,
      es: 'Versión **descendente** (*top-down*, memoización): la recursión de siempre más una tabla `memo`. Reproduce la traza de `fib(6)`: cada subproblema se calcula la primera vez y las repeticiones (borde discontinuo) se responden mirando la tabla.',
      en: '**Top-down** version (memoization): the usual recursion plus a `memo` table. Play the `fib(6)` trace: each subproblem is computed the first time and repeats (dashed border) are answered by looking at the table.' },
    { ...reset([FILA_FIB], todas([FILA_FIB]), 1, NF + 1), line: null,
      es: `Resultado: ${NF - 1} estados nuevos y ${FM.llamadas} llamadas, de las que ${FM.aciertos} solo consultan la tabla. El \`fib(${NF})\` ingenuo hacía ${llamadasFib(NF)}. Cada estado se calcula una vez: el coste es **nº de estados × coste de cada transición**, aquí ${NF + 1} × $O(1)$.`,
      en: `Result: ${NF - 1} new states and ${FM.llamadas} calls, ${FM.aciertos} of which only look at the table. The naive \`fib(${NF})\` made ${llamadasFib(NF)}. Each state is computed once: the cost is **number of states × cost of each transition**, here ${NF + 1} × $O(1)$.` },
    { ...reset(inicialFila(NF, 0, 1), celdasHechas(0, [0, 1]), 1, NF + 1), code: C_FIB_TAB, line: 4, traza: sumaDosTraza(NF, 0, 1, 'fib').frames,
      es: 'Versión **ascendente** (*bottom-up*, tabulación): se parte de los casos base y un bucle rellena la tabla en un orden tal que lo que una celda necesita ya está calculado. Sin recursión ni pila, y el orden de llenado es explícito.',
      en: '**Bottom-up** version (tabulation): start from the base cases and a loop fills the table in an order such that what a cell needs is already computed. No recursion or stack, and the fill order is explicit.' },
    { ...reset([FILA_FIB], todas([FILA_FIB]), 1, NF + 1), line: null,
      es: 'Las dos versiones dan lo mismo. La descendente es más fácil de escribir y solo visita los estados necesarios; la ascendente es más rápida (sin llamadas) y permite ahorrar memoria. La DP exige subproblemas **solapados**: ¿en cuál de estos casos no merece la pena guardar resultados?',
      en: 'Both versions give the same result. Top-down is easier to write and only visits the states that are needed; bottom-up is faster (no calls) and allows saving memory. DP requires **overlapping** subproblems: in which of these cases is storing results not worth it?',
      pregunta: {
        opc: [
          { es: 'Fibonacci: `fib(n-1)` y `fib(n-2)` comparten subproblemas', en: 'Fibonacci: `fib(n-1)` and `fib(n-2)` share subproblems' },
          { es: 'Mergesort: cada mitad del array es un subproblema distinto', en: 'Mergesort: each half of the array is a different subproblem', ok: 1 },
          { es: 'Caminos en una rejilla: llegar a (i, j) pasa por (i-1, j) o (i, j-1)', en: 'Paths in a grid: reaching (i, j) goes through (i-1, j) or (i, j-1)' },
        ],
        why: {
          es: 'En mergesort las dos mitades son disjuntas: nunca se repite un subproblema, así que guardar resultados no ahorra nada (es divide y vencerás). La DP aporta cuando la misma entrada reaparece, como en Fibonacci o en la rejilla.',
          en: 'In mergesort the two halves are disjoint: no subproblem ever repeats, so storing results saves nothing (it is divide and conquer). DP pays off when the same input shows up again, as in Fibonacci or in the grid.',
        },
      } },
    { tabla: { filas: 4, cols: 3, cab: { filas: ['Fib', 'Mochila', 'LCS', 'Monedas'], cols: ['Estados', 'Transic.', 'Total'], esq: '' }, val: [['n', 'O(1)', 'O(n)'], ['n·W', 'O(1)', 'O(nW)'], ['n·m', 'O(1)', 'O(nm)'], ['T', 'k', 'O(Tk)']] },
      code: '', line: null,
      es: 'La receta: define el **estado** (qué identifica un subproblema), la **transición** (cómo se calcula con otros), los **casos base** y el **orden** de llenado. El coste sale de contar. Una mochila con 100 objetos y capacidad 10 000: ¿cuántas celdas tiene su tabla, aproximadamente?',
      en: 'The recipe: define the **state** (what identifies a subproblem), the **transition** (how it is computed from others), the **base cases** and the fill **order**. The cost comes from counting. A knapsack with 100 items and capacity 10,000: roughly how many cells does its table have?',
      pregunta: {
        opc: [
          { es: 'Unas 10 000', en: 'About 10,000' },
          { es: 'Unas 1 000 000', en: 'About 1,000,000', ok: 1 },
          { es: 'Unas 2^100', en: 'About 2^100' },
        ],
        why: {
          es: 'Una celda por pareja (objeto, capacidad): $100\\cdot10\\,000\\approx10^6$ estados, con $O(1)$ cada uno. La tabla de la derecha resume el coste de los problemas de esta guía; en monedas, `T` es el objetivo y `k` el número de monedas.',
          en: 'One cell per (item, capacity) pair: $100\\cdot10{,}000\\approx10^6$ states, $O(1)$ each. The table above summarizes the cost of the problems in this guide; for coins, `T` is the target and `k` the number of coins.',
        },
      } },

    // ═══ 2. Escaleras y memoria ═══
    { sec: { es: 'Escaleras y ahorro de memoria', en: 'Stairs and saving memory' }, leyenda: ['activo', 'compara', 'hecho'],
      tabla: { filas: 1, cols: NE + 1, cab: { filas: ['dp'], cols: nums(0, NE), esq: 'i' }, val: inicialFila(NE, 1, 1) }, est: celdasHechas(0, [0, 1]),
      code: C_ESC, line: 3,
      es: '**Escaleras**: ¿de cuántas formas se suben `n` peldaños dando pasos de 1 o 2? **Estado**: `dp[i]` = formas de llegar al peldaño `i`. **Base**: `dp[0] = dp[1] = 1`. **Transición**: se llega desde `i-1` o desde `i-2`, luego `dp[i] = dp[i-1] + dp[i-2]`. **Orden**: `i` creciente.',
      en: '**Stairs**: in how many ways can you climb `n` steps taking 1 or 2 at a time? **State**: `dp[i]` = ways to reach step `i`. **Base**: `dp[0] = dp[1] = 1`. **Transition**: you arrive from `i-1` or from `i-2`, so `dp[i] = dp[i-1] + dp[i-2]`. **Order**: increasing `i`.' },
    { ...reset(inicialFila(NE, 1, 1), celdasHechas(0, [0, 1]), 1, NE + 1), line: 4, traza: ESC.frames,
      es: 'Reproduce la traza. Cada celda lee las dos anteriores (flechas) y las suma. Salen los números de Fibonacci: la misma recurrencia que `fib`, con otros casos base.',
      en: 'Play the trace. Each cell reads the two previous ones (arrows) and adds them. The Fibonacci numbers come out: the same recurrence as `fib`, with different base cases.' },
    { ...reset([ESC.dp], todas([ESC.dp]), 1, NE + 1), resaltar: { cols: [NE - 1, NE] }, code: C_ESC2, line: 2,
      es: 'Mira las flechas: `dp[i]` solo lee las dos celdas anteriores. El resto de la tabla ya no hace falta, así que bastan dos variables: la memoria baja de $O(n)$ a $O(1)$ y el tiempo sigue siendo $O(n)$. Regla general: guarda solo la «ventana» de estados que todavía se leerán.',
      en: 'Look at the arrows: `dp[i]` only reads the two previous cells. The rest of the table is no longer needed, so two variables are enough: memory drops from $O(n)$ to $O(1)$ and time stays $O(n)$. General rule: keep only the “window” of states that will still be read.' },
    { ...reset(inicialFila(NE, 1, 1), celdasHechas(0, [0, 1]), 1, NE + 1), marcas: { a: { col: 0 }, b: { col: 1 } }, resaltar: { cols: [0, 1] }, line: 4, traza: DOS.frames,
      es: 'Reproduce la traza con `a` y `b`. La banda es lo único que se guarda: al avanzar la ventana, la celda que sale se vacía. La respuesta es `b`.',
      en: 'Play the trace with `a` and `b`. The band is all that is kept: when the window moves on, the cell that leaves it is emptied. The answer is `b`.' },
    { ...reset([[...Array(NE - 1).fill(null), ESC.dp[NE - 1], ESC.dp[NE]]], celdasHechas(0, [NE - 1, NE]), 1, NE + 1), marcas: null, resaltar: { cols: [NE - 1, NE] }, line: null,
      es: 'Quedan solo las dos últimas celdas. Contrapartida: si después necesitas **reconstruir** cómo se llegó al resultado, ya no tienes la tabla. Si la transición fuese `dp[i] = dp[i-1] + dp[i-2] + dp[i-3]` (pasos de 1, 2 o 3), ¿cuántas variables harían falta?',
      en: 'Only the last two cells remain. Trade-off: if you later need to **reconstruct** how the result was reached, the table is gone. If the transition were `dp[i] = dp[i-1] + dp[i-2] + dp[i-3]` (steps of 1, 2 or 3), how many variables would be needed?',
      pregunta: {
        opc: [
          { es: 'Dos', en: 'Two' },
          { es: 'Tres', en: 'Three', ok: 1 },
          { es: 'Una tabla de `n` celdas', en: 'A table of `n` cells' },
        ],
        why: {
          es: 'La ventana tiene el tamaño de la dependencia más lejana: tres celdas anteriores, tres variables. La memoria sigue siendo $O(1)$, independiente de `n`.',
          en: 'The window has the size of the farthest dependency: three previous cells, three variables. Memory stays $O(1)$, independent of `n`.',
        },
      } },

    // ═══ 3. Mochila 0/1 ═══
    { sec: { es: 'Mochila 0/1', en: '0/1 knapsack' }, leyenda: ['activo', 'compara', 'hecho', 'camino', 'mal'],
      tabla: { filas: ITEMS.length + 1, cols: CAP + 1, cab: cabMochila(), val: DPM.map((f, i) => (i === 0 ? f : f.map(() => null))) }, est: celdasHechas(0, FILA0.map((_, w) => w)),
      code: C_MOCH, line: 3,
      es: '**Mochila 0/1**: cada objeto se coge entero o no se coge. Las filas son los objetos (cabecera: peso `p` y valor `v`) y las columnas, la capacidad `w`. **Estado**: `dp[i][w]` = mayor valor usando solo los `i` primeros objetos con capacidad `w`. Con 0 objetos vale 0.',
      en: '**0/1 knapsack**: each item is taken whole or not at all. Rows are the items (header: weight `p` and value `v`) and columns are the capacity `w`. **State**: `dp[i][w]` = best value using only the first `i` items with capacity `w`. With 0 items it is 0.' },
    { ...reset(DPM.map((f, i) => (i === 0 ? f : f.map(() => null))), celdasHechas(0, FILA0.map((_, w) => w)), ITEMS.length + 1, CAP + 1), line: 4, traza: MOCH.frames,
      es: 'Reproduce la traza. Cada celda lee **dos** de la fila anterior (flechas): la de arriba (no coger el objeto) y, si cabe, la que queda al restar su peso (cogerlo y sumar su valor). Se queda con el máximo.',
      en: 'Play the trace. Each cell reads **two** from the previous row (arrows): the one above (skip the item) and, if it fits, the one left after subtracting its weight (take it and add its value). It keeps the maximum.' },
    { ...reset(DPM, { ...todas(DPM), '3,7': 'activa', '2,7': 'lee', '2,3': 'lee' }, ITEMS.length + 1, CAP + 1), deps: [[2, 7, 3, 7], [2, 3, 3, 7]], marcas: { i: { fila: 3 }, w: { col: 7 } }, resaltar: { filas: [3] },
      formula: fm('dp[3][7] = max(dp[2][7], dp[2][3] + 5) = 9'), line: 8,
      es: 'Ejemplo: `dp[3][7]`, objeto de peso 4 y valor 5, capacidad 7. No cogerlo vale 5 (`dp[2][7]`). Cogerlo deja capacidad 3 y suma 5: `dp[2][3] + 5 = 9`. Gana coger. Hay $(n+1)(W+1)$ celdas con $O(1)$ cada una: $O(nW)$ de tiempo y de memoria.',
      en: 'Example: `dp[3][7]`, item of weight 4 and value 5, capacity 7. Skipping it is worth 5 (`dp[2][7]`). Taking it leaves capacity 3 and adds 5: `dp[2][3] + 5 = 9`. Taking wins. There are $(n+1)(W+1)$ cells at $O(1)$ each: $O(nW)$ time and memory.' },
    { ...reset(INI_JUEGO, EST_JUEGO, ITEMS.length + 1, CAP + 1), code: C_MOCH, line: 6,
      jugar: {
        arrastrables: true,
        botones: [
          { label: { es: 'No coger', en: 'Skip' }, hacer: v => decidirMochila(v, 'no'), off: v => !v.sel || v.sel[0] === 0 || leer(v, v.sel[0], v.sel[1]) !== null },
          { label: { es: 'Coger', en: 'Take' }, hacer: v => decidirMochila(v, 'coger'), off: v => !v.sel || v.sel[0] === 0 || leer(v, v.sel[0], v.sel[1]) !== null },
          { label: { es: 'Rellenar el resto', en: 'Fill the rest' }, hacer: v => autoRellenar(v, DPM), off: v => v.val.every(f => f.every(x => x !== null)) },
          { label: { es: 'Reiniciar', en: 'Reset' }, hacer: v => { INI_JUEGO.forEach((f, r) => f.forEach((x, c) => { v.val[r][c] = x; })); v.est = { ...EST_JUEGO }; limpiarTemp(v); v.sel = null; v.msg = null; } },
        ],
        soltar: (v, r, c) => elegirMochila(v, r, c),
        lecturas: v => {
          if (!v.sel) return [{ expr: tr('celda', 'cell'), valor: tr('elige una celda vacía de la tabla', 'pick an empty cell in the table') }];
          const [r, c] = v.sel, q = x => (x === null ? '?' : x);
          if (r === 0) return [{ expr: `dp[0][${c}]`, valor: tr('0 (caso base)', '0 (base case)') }];
          const { p, v: val } = ITEMS[r - 1], cabe = c >= p, arriba = leer(v, r - 1, c), izq = cabe ? leer(v, r - 1, c - p) : null;
          const out = [
            { expr: tr('objeto', 'item') + ' ' + r, valor: tr(`peso ${p}, valor ${val}`, `weight ${p}, value ${val}`) },
            { expr: tr('no coger', 'skip'), valor: `dp[${r - 1}][${c}] = ${q(arriba)}` },
            { expr: tr('coger', 'take'), valor: cabe ? `dp[${r - 1}][${c - p}] + ${val} = ${izq === null ? '?' : izq + val}` : tr('no cabe', 'does not fit'), malo: !cabe },
          ];
          const m = v.msg;
          if (m?.k === 'ok') out.push({ expr: tr('resultado', 'result'), valor: tr(`Correcto: dp[${r}][${c}] = ${m.valor}${m.empate ? ' (empate: valen igual)' : ''}`, `Correct: dp[${r}][${c}] = ${m.valor}${m.empate ? ' (tie: both are equal)' : ''}`) });
          else if (m?.k === 'mal') out.push({ expr: tr('resultado', 'result'), valor: m.razon === 'nocabe' ? tr('No cabe: no se puede coger', 'It does not fit: it cannot be taken') : tr('No exactamente: esa opción vale menos', 'Not quite: that option is worth less'), malo: true });
          else if (m?.k === 'falta') out.push({ expr: tr('resultado', 'result'), valor: tr('Primero calcula las celdas que se leen (en rojo)', 'First compute the cells that are read (in red)'), malo: true });
          else if (m?.k === 'hecha') out.push({ expr: tr('resultado', 'result'), valor: tr('Ya calculada', 'Already computed') });
          return out;
        },
      },
      es: 'Calcula tú. Haz clic en una celda vacía: se marcan las dos celdas que lee. Elige **No coger** o **Coger**; si aciertas se rellena, si no se marca en rojo. Las filas 0 a 2 ya están hechas. También puedes moverte con las flechas y pulsar Enter.',
      en: 'Compute it yourself. Click an empty cell: the two cells it reads are marked. Choose **Skip** or **Take**; if you are right it fills in, otherwise it turns red. Rows 0 to 2 are already done. You can also move with the arrow keys and press Enter.' },
    { ...reset(DPM, { ...todas(DPM), ...CAM7 }, ITEMS.length + 1, CAP + 1), marcas: { W: { col: CAP } }, resaltar: { cols: [CAP] }, formula: fm(`dp[${ITEMS.length}][${CAP}] = ${DPM[ITEMS.length][CAP]}`), line: null,
      jugar: {
        arrastrables: true,
        botones: [
          { label: 'W − 1', hacer: v => fijarCapacidad(v, (v.W ?? CAP) - 1), off: v => (v.W ?? CAP) <= 0 },
          { label: 'W + 1', hacer: v => fijarCapacidad(v, (v.W ?? CAP) + 1), off: v => (v.W ?? CAP) >= CAP },
        ],
        soltar: (v, r, c) => fijarCapacidad(v, c),
        lecturas: v => {
          const W = v.W ?? CAP, cam = caminoMochila(DPM, ITEMS, W);
          return [
            { expr: tr('capacidad W', 'capacity W'), valor: W },
            { expr: tr('mejor valor', 'best value'), valor: DPM[ITEMS.length][W] },
            { expr: tr('objetos', 'items'), valor: cam.elegidos.length ? cam.elegidos.join(', ') : '—' },
            { expr: tr('peso total', 'total weight'), valor: `${cam.peso} ≤ ${W}` },
          ];
        },
      },
      es: 'La tabla completa responde **todas** las capacidades hasta 7: la última fila da el mejor valor para cada una. Cambia `W` con los botones o haciendo clic en una columna; el camino violeta marca qué objetos se cogen. Con `W = 4` el mejor valor es 5, y con `W = 5`, 7.',
      en: 'The full table answers **every** capacity up to 7: the last row gives the best value for each one. Change `W` with the buttons or by clicking a column; the violet path marks which items are taken. With `W = 4` the best value is 5, and with `W = 5`, 7.' },
    { ...reset(DPM, todas(DPM), ITEMS.length + 1, CAP + 1), code: C_MOCH_REC, line: 2, traza: MCAM.frames,
      es: 'Para saber **qué** objetos entran, se vuelve desde `dp[4][7]`: si `dp[i][w]` ≠ `dp[i-1][w]`, el objeto `i` se cogió y se resta su peso; si son iguales, no hizo falta. El camino violeta marca las celdas visitadas. Reproduce la traza.',
      en: 'To find **which** items are taken, walk back from `dp[4][7]`: if `dp[i][w]` ≠ `dp[i-1][w]`, item `i` was taken and its weight is subtracted; if they are equal, it was not needed. The violet path marks the visited cells. Play the trace.' },
    { ...reset(DPM, { ...todas(DPM), ...CAM7 }, ITEMS.length + 1, CAP + 1), line: null,
      es: `Se cogen los objetos ${TXT_ITEMS}: peso ${CAM.peso} y valor ${CAM.valor}, justo la capacidad y el valor de la esquina. Reconstruir exige conservar la tabla entera: la versión de abajo ahorra memoria, pero solo devuelve el valor.`,
      en: `Items ${TXT_ITEMS} are taken: weight ${CAM.peso} and value ${CAM.valor}, exactly the capacity and the corner value. Reconstructing requires keeping the whole table: the version below saves memory, but only returns the value.` },
    { tabla: { filas: 1, cols: CAP + 1, cab: { filas: ['dp'], cols: nums(0, CAP), esq: 'w' }, val: [FILA0] }, est: celdasHechas(0, FILA0.map((_, w) => w)), code: C_MOCH_FILA, line: 3, traza: MF_ATRAS.frames,
      es: 'Cada fila solo lee la anterior, así que basta **una** fila `dp[w]` actualizada en el sitio. Hay que recorrer `w` de **mayor a menor**: así `dp[w - p]` aún vale lo de antes de este objeto. Ejemplo con un solo objeto (peso 3, valor 4): reproduce la traza.',
      en: 'Each row only reads the previous one, so **one** row `dp[w]` updated in place is enough. `w` must go from **largest to smallest**: that way `dp[w - p]` still holds the value from before this item. Example with a single item (weight 3, value 4): play the trace.' },
    { ...reset([MF_ATRAS.dp], todas([MF_ATRAS.dp]), 1, CAP + 1), line: null,
      es: `Queda \`dp = [${MF_ATRAS.dp.join(', ')}]\`: el objeto se usa una sola vez. La memoria baja de $O(nW)$ a $O(W)$. ¿Qué pasaría si recorrieras \`w\` de menor a mayor?`,
      en: `This leaves \`dp = [${MF_ATRAS.dp.join(', ')}]\`: the item is used only once. Memory drops from $O(nW)$ to $O(W)$. What would happen if you went through \`w\` from smallest to largest?`,
      pregunta: {
        opc: [
          { es: 'Lo mismo: el orden no importa', en: 'The same: order does not matter' },
          { es: 'El objeto se contaría dos veces en las capacidades mayores', en: 'The item would be counted twice at the larger capacities', ok: 1 },
          { es: 'No compilaría', en: 'It would not compile' },
        ],
        why: {
          es: 'Al ir hacia arriba, `dp[w - 3]` ya contiene el objeto cuando se lee para `dp[6]`, y se suma otra vez. Es justo lo que se quiere con monedas ilimitadas y un error en la mochila 0/1.',
          en: 'Going upwards, `dp[w - 3]` already contains the item when it is read for `dp[6]`, and it is added again. That is exactly what you want with unlimited coins and a bug in the 0/1 knapsack.',
        },
      } },
    { ...reset([FILA0], todas([FILA0]), 1, CAP + 1), line: 3, traza: MF_ADEL.frames,
      es: 'Compruébalo: el mismo objeto con `w` creciente. Los bordes rojos son lecturas de celdas que **ya** incluyen el objeto en esta pasada.',
      en: 'Check it: the same item with increasing `w`. Red borders are reads of cells that **already** include the item in this pass.' },
    { ...reset([MF_ADEL.dp], { ...todas([MF_ADEL.dp]), ...Object.fromEntries(MF_ADEL.mal.map(w => [`0,${w}`, 'mal'])) }, 1, CAP + 1), line: null,
      es: `Resultado erróneo: ${MF_ADEL.dp[MF_ADEL.mal[0]]} con un solo objeto de valor 4. Ojo con otra cosa: $O(nW)$ es *pseudopolinómico*, depende del **valor** de \`W\` y no de los bits que ocupa. Con $W=10^9$ la tabla no cabe aunque \`n\` sea pequeño.`,
      en: `Wrong result: ${MF_ADEL.dp[MF_ADEL.mal[0]]} with a single item of value 4. Mind another thing: $O(nW)$ is *pseudo-polynomial*, it depends on the **value** of \`W\` and not on the bits it takes. With $W=10^9$ the table does not fit even if \`n\` is small.` },

    // ═══ 4. LCS y distancia de edición ═══
    { sec: { es: 'LCS y distancia de edición', en: 'LCS and edit distance' }, leyenda: ['activo', 'compara', 'hecho', 'camino'],
      tabla: { filas: nl + 1, cols: ml + 1, cab: cabLCS(A_LCS, B_LCS), val: bordeLCS(A_LCS, B_LCS) }, est: EST_BORDE_LCS,
      code: C_LCS, line: 3,
      es: `Una **subsecuencia** conserva el orden pero puede saltar letras. \`dp[i][j]\` = longitud de la subsecuencia común más larga (LCS) de los \`i\` primeros caracteres de «${A_LCS}» y los \`j\` primeros de «${B_LCS}». Con un prefijo vacío vale 0. La respuesta es \`dp[n][m]\`.`,
      en: `A **subsequence** keeps the order but may skip letters. \`dp[i][j]\` = length of the longest common subsequence (LCS) of the first \`i\` characters of «${A_LCS}» and the first \`j\` of «${B_LCS}». With an empty prefix it is 0. The answer is \`dp[n][m]\`.` },
    { ...reset(bordeLCS(A_LCS, B_LCS), EST_BORDE_LCS, nl + 1, ml + 1), line: 4, traza: LC.frames,
      es: 'Si las letras coinciden (`a[i-1] == b[j-1]`), se **extiende** la diagonal: `dp[i-1][j-1] + 1`. Si no, se descarta una de las dos letras y gana la mejor de arriba o de la izquierda. Reproduce la traza.',
      en: 'If the letters match (`a[i-1] == b[j-1]`), the diagonal is **extended**: `dp[i-1][j-1] + 1`. Otherwise one of the two letters is dropped and the better of above or left wins. Play the trace.' },
    { ...reset(DPL, { ...todas(DPL), [`${nl},${ml}`]: 'activa', [`${nl - 1},${ml}`]: 'lee', [`${nl},${ml - 1}`]: 'lee' }, nl + 1, ml + 1), deps: [[nl - 1, ml, nl, ml], [nl, ml - 1, nl, ml]], marcas: { i: { fila: nl }, j: { col: ml } },
      formula: fm(`${A_LCS[nl - 1]} ≠ ${B_LCS[ml - 1]}: dp[${nl}][${ml}] = max(${DPL[nl - 1][ml]}, ${DPL[nl][ml - 1]}) = ${DPL[nl][ml]}`), line: 9,
      es: `En fórmulas: $L_{i,j}=L_{i-1,j-1}+1$ si $a_i=b_j$, y $L_{i,j}=\\max(L_{i-1,j},\\,L_{i,j-1})$ si no. Hay $nm$ estados con $O(1)$ cada uno: $O(nm)$. La esquina da ${DPL[nl][ml]}: la LCS de «${A_LCS}» y «${B_LCS}» tiene longitud ${DPL[nl][ml]}.`,
      en: `In formulas: $L_{i,j}=L_{i-1,j-1}+1$ if $a_i=b_j$, and $L_{i,j}=\\max(L_{i-1,j},\\,L_{i,j-1})$ otherwise. There are $nm$ states at $O(1)$ each: $O(nm)$. The corner gives ${DPL[nl][ml]}: the LCS of «${A_LCS}» and «${B_LCS}» has length ${DPL[nl][ml]}.` },
    { ...reset(INI_LCS, EST_INI_LCS, nl + 1, ml + 1), line: 6,
      jugar: {
        arrastrables: true,
        botones: [
          { label: '− 1', hacer: v => ajustarValor(v, -1), off: v => !v.sel || leer(v, v.sel[0], v.sel[1]) !== null || (v.g ?? 0) <= 0 },
          { label: '+ 1', hacer: v => ajustarValor(v, 1), off: v => !v.sel || leer(v, v.sel[0], v.sel[1]) !== null || (v.g ?? 0) >= 9 },
          { label: { es: 'Comprobar', en: 'Check' }, hacer: v => comprobarLCS(v), off: v => !v.sel || leer(v, v.sel[0], v.sel[1]) !== null },
          { label: { es: 'Rellenar el resto', en: 'Fill the rest' }, hacer: v => autoRellenar(v, DPL), off: v => v.val.every(f => f.every(x => x !== null)) },
          { label: { es: 'Reiniciar', en: 'Reset' }, hacer: v => { INI_LCS.forEach((f, r) => f.forEach((x, c) => { v.val[r][c] = x; })); v.est = { ...EST_INI_LCS }; limpiarTemp(v); v.sel = null; v.msg = null; v.g = 0; } },
        ],
        soltar: (v, r, c) => elegirLCS(v, r, c),
        lecturas: v => {
          if (!v.sel) return [{ expr: tr('celda', 'cell'), valor: tr('elige una celda vacía de las filas 6 y 7', 'pick an empty cell in rows 6 and 7') }];
          const [r, c] = v.sel;
          if (r === 0 || c === 0) return [{ expr: `dp[${r}][${c}]`, valor: tr('0 (caso base)', '0 (base case)') }];
          const igual = A_LCS[r - 1] === B_LCS[c - 1], q = x => (x === null ? '?' : x);
          const out = [
            { expr: tr('letras', 'letters'), valor: `${A_LCS[r - 1]} / ${B_LCS[c - 1]}  ${igual ? tr('coinciden', 'match') : tr('difieren', 'differ')}` },
            { expr: tr('regla', 'rule'), valor: igual ? `dp[${r - 1}][${c - 1}] + 1 = ${q(leer(v, r - 1, c - 1)) === '?' ? '?' : leer(v, r - 1, c - 1) + 1}` : `max(${q(leer(v, r - 1, c))}, ${q(leer(v, r, c - 1))})` },
            { expr: tr('tu valor', 'your value'), valor: v.g ?? 0 },
          ];
          const m = v.msg;
          if (m?.k === 'ok') out.push({ expr: tr('resultado', 'result'), valor: tr(`Correcto: dp[${r}][${c}] = ${m.valor}`, `Correct: dp[${r}][${c}] = ${m.valor}`) });
          else if (m?.k === 'mal') out.push({ expr: tr('resultado', 'result'), valor: tr(`No exactamente: ${m.valor} no es el valor. Revisa las celdas leídas`, `Not quite: ${m.valor} is not the value. Check the cells read`), malo: true });
          else if (m?.k === 'falta') out.push({ expr: tr('resultado', 'result'), valor: tr('Primero calcula las celdas que se leen (en rojo)', 'First compute the cells that are read (in red)'), malo: true });
          else if (m?.k === 'hecha') out.push({ expr: tr('resultado', 'result'), valor: tr('Ya calculada', 'Already computed') });
          return out;
        },
      },
      es: 'Rellena tú las filas 6 y 7. Haz clic en una celda vacía: se resaltan las letras y se marcan las celdas que lee. Ajusta el valor con − y + y pulsa **Comprobar**. Si fallas, la celda se marca en rojo.',
      en: 'Fill in rows 6 and 7 yourself. Click an empty cell: the letters are highlighted and the cells it reads are marked. Adjust the value with − and + and press **Check**. If you are wrong, the cell turns red.' },
    { ...reset(DPL, todas(DPL), nl + 1, ml + 1), code: C_LCS_REC, line: 2, traza: LCV.frames,
      es: 'Para saber **cuál** es la subsecuencia, se vuelve desde `dp[7][6]`: si las letras coinciden, esa letra entra y se sube en diagonal; si no, se va a la vecina mayor. Las filas y columnas resaltadas son las letras elegidas. Reproduce la traza.',
      en: 'To find **which** subsequence it is, walk back from `dp[7][6]`: if the letters match, that letter is in and you move diagonally; otherwise go to the larger neighbour. Highlighted rows and columns are the chosen letters. Play the trace.' },
    { ...reset(DPL, { ...todas(DPL), ...Object.fromEntries(CL.celdas.map(([i, j]) => [`${i},${j}`, 'camino'])) }, nl + 1, ml + 1), resaltar: { filas: CL.pasos.filter(p => p.tipo === 'coincide').map(p => p.i), cols: CL.pasos.filter(p => p.tipo === 'coincide').map(p => p.j) }, line: null,
      es: `Sale «${CL.sub}», de longitud ${CL.sub.length}. Hay ${TODAS_LCS.length} subsecuencias comunes de esa longitud (${listaY(TODAS_LCS.map(s => `«${s}»`))}); el desempate «arriba si empata» elige una. La longitud es única; la subsecuencia, no.`,
      en: `It gives «${CL.sub}», of length ${CL.sub.length}. There are ${TODAS_LCS.length} common subsequences of that length (${listaY(TODAS_LCS.map(s => `«${s}»`), 'and')}); the tie-break “up if equal” picks one. The length is unique; the subsequence is not.` },
    { tabla: { filas: A_ED.length + 1, cols: B_ED.length + 1, cab: cabEd, val: bordeEdicion(A_ED, B_ED) }, code: C_EDIT, line: 4,
      est: EST_BORDE_ED,
      es: `La **distancia de edición** (Levenshtein) es el mínimo de operaciones (insertar, borrar o sustituir una letra) para convertir «${A_ED}» en «${B_ED}». \`dp[i][j]\` = distancia entre los \`i\` primeros de uno y los \`j\` primeros del otro. Los bordes valen \`i\` y \`j\`: borrar o insertar todo.`,
      en: `The **edit distance** (Levenshtein) is the minimum number of operations (insert, delete or substitute a letter) to turn «${A_ED}» into «${B_ED}». \`dp[i][j]\` = distance between the first \`i\` letters of one and the first \`j\` of the other. The borders are \`i\` and \`j\`: delete or insert everything.` },
    { ...reset(bordeEdicion(A_ED, B_ED), EST_BORDE_ED, A_ED.length + 1, B_ED.length + 1), line: 8, traza: ED.frames,
      es: 'Cada celda lee **tres** vecinas: arriba (borrar, +1), izquierda (insertar, +1) y la diagonal (sustituir, +1, o +0 si las letras son iguales). Se queda con el mínimo. Reproduce la traza.',
      en: 'Each cell reads **three** neighbours: above (delete, +1), left (insert, +1) and the diagonal (substitute, +1, or +0 if the letters are equal). It keeps the minimum. Play the trace.' },
    { ...reset(DPE, todas(DPE), A_ED.length + 1, B_ED.length + 1), line: null,
      es: `En fórmulas: $E_{i,j}=\\min\\bigl(E_{i-1,j}+1,\\;E_{i,j-1}+1,\\;E_{i-1,j-1}+[a_i\\ne b_j]\\bigr)$. La respuesta es \`dp[${A_ED.length}][${B_ED.length}]\` = ${DPE[A_ED.length][B_ED.length]}. Coste $O(nm)$. Si solo quieres la distancia, dos filas bastan: $O(m)$ de memoria.`,
      en: `In formulas: $E_{i,j}=\\min\\bigl(E_{i-1,j}+1,\\;E_{i,j-1}+1,\\;E_{i-1,j-1}+[a_i\\ne b_j]\\bigr)$. The answer is \`dp[${A_ED.length}][${B_ED.length}]\` = ${DPE[A_ED.length][B_ED.length]}. Cost $O(nm)$. If you only want the distance, two rows are enough: $O(m)$ memory.` },
    { ...reset(DPE, todas(DPE), A_ED.length + 1, B_ED.length + 1), code: C_EDIT_REC, line: 1, traza: EDV.frames,
      es: 'Y las **operaciones**: se vuelve desde la esquina eligiendo la vecina de la que salió el valor (diagonal primero, luego arriba, luego izquierda). Cada movimiento es una operación; las diagonales de coste 0 son letras que se conservan. Reproduce la traza.',
      en: 'And the **operations**: walk back from the corner choosing the neighbour the value came from (diagonal first, then up, then left). Each move is an operation; the cost-0 diagonals are letters that stay. Play the trace.' },
    { ...reset(DPE, { ...todas(DPE), ...Object.fromEntries(CE.celdas.map(([i, j]) => [`${i},${j}`, 'camino'])) }, A_ED.length + 1, B_ED.length + 1), line: null,
      es: `De «${A_ED}» a «${B_ED}» en ${CE.total} operaciones: ${textoOps(CE.ops)}. El camino violeta es la secuencia de operaciones, de la esquina al origen. Aquí el camino óptimo es único; en general puede haber varios de igual coste.`,
      en: `From «${A_ED}» to «${B_ED}» in ${CE.total} operations: ${textoOps(CE.ops)}. The violet path is the sequence of operations, from the corner to the origin. Here the optimal path is unique; in general there may be several of equal cost.` },

    // ═══ 5. Cambio de monedas ═══
    { sec: { es: 'Cambio de monedas', en: 'Coin change' }, leyenda: ['activo', 'compara', 'hecho', 'mal'],
      tabla: { filas: 2, cols: COLS_M, cab: cabMon, val: [DPMON.map((x, c) => (c === 0 ? 0 : null)), VZMON] }, est: celdasHechas(0, [0]),
      code: C_MON, line: 5,
      es: 'Con monedas {1, 3, 4}, ¿mínimo de monedas para sumar `T`? El **voraz** (la mayor posible cada vez) parece razonable, pero para 6 da 4+1+1 = 3 monedas y 3+3 son 2. La fila de abajo es lo que da el voraz para cada `T`. Veamos qué da la DP.',
      en: 'With coins {1, 3, 4}, what is the minimum number of coins to make `T`? **Greedy** (the largest possible each time) looks reasonable, but for 6 it gives 4+1+1 = 3 coins while 3+3 is 2. The bottom row is what greedy gives for each `T`. Let us see what DP gives.' },
    { ...reset([DPMON.map((x, c) => (c === 0 ? 0 : null)), VZMON], celdasHechas(0, [0]), 2, COLS_M), line: 5, traza: MON.frames,
      es: '**Estado**: `dp[c]` = mínimo de monedas para sumar `c`. **Transición**: `dp[c] = 1 + min(dp[c-x])` sobre las monedas `x ≤ c` (cada una como última). **Base**: `dp[0] = 0`. Reproduce la traza: en rojo, donde el voraz se queda corto.',
      en: '**State**: `dp[c]` = minimum coins to make `c`. **Transition**: `dp[c] = 1 + min(dp[c-x])` over the coins `x ≤ c` (each one as the last). **Base**: `dp[0] = 0`. Play the trace: in red, where greedy falls short.' },
    { ...reset([DPMON, VZMON], { ...celdasHechas(0, DPMON.map((_, c) => c)), ...MAL_MON }, 2, COLS_M), line: null,
      es: `La DP prueba **todas** las últimas monedas y se queda con la mejor; el voraz se compromete con la mayor y no puede rectificar. Difieren en T = ${listaY(DIF_MON)}. Con sistemas como el euro el voraz sí es óptimo, pero hay que demostrarlo para cada sistema. Coste de la DP: $O(Tk)$.`,
      en: `DP tries **every** last coin and keeps the best; greedy commits to the largest and cannot backtrack. They differ at T = ${listaY(DIF_MON, 'and')}. With systems like the euro, greedy is optimal, but this must be proved for each system. DP cost: $O(Tk)$.` },
    { tabla: { filas: 4, cols: 8, cab: cabFormas([1, 2, 5], 7), val: formasTabla([1, 2, 5], 7).map((f, k) => (k === 0 ? f : f.map(() => null))) }, est: celdasHechas(0, [0, 1, 2, 3, 4, 5, 6, 7]),
      code: C_FORMAS, line: 4, traza: FOR.frames,
      es: 'Ahora **contar**: ¿de cuántas formas se suma `T` con {1, 2, 5}? La fila `k` es el estado tras considerar las `k` primeras monedas: `dp[k][c] = dp[k-1][c] + dp[k][c-x]` (sin usar la moneda, o usándola al menos una vez). Base: una forma de sumar 0. Reproduce la traza.',
      en: 'Now **counting**: in how many ways can `T` be made with {1, 2, 5}? Row `k` is the state after considering the first `k` coins: `dp[k][c] = dp[k-1][c] + dp[k][c-x]` (without the coin, or using it at least once). Base: one way to make 0. Play the trace.' },
    { ...reset(formasTabla([1, 2, 5], 7), { ...todas(formasTabla([1, 2, 5], 7)), '3,7': 'camino' }, 4, 8), line: 4,
      es: `Salen ${FOR.total} formas. El orden de los bucles decide qué cuentas: monedas por **fuera** y cantidades por dentro cuenta **combinaciones**; al revés cuenta **permutaciones**, y con T = 7 saldrían ${FORM_PERM}. Con {1, 2} y T = 3, ¿cuántas formas hay sin orden y con orden?`,
      en: `It gives ${FOR.total} ways. The loop order decides what you count: coins on the **outside** and amounts inside counts **combinations**; the other way round counts **permutations**, and with T = 7 you would get ${FORM_PERM}. With {1, 2} and T = 3, how many ways are there without order and with order?`,
      pregunta: {
        opc: [
          { es: 'Sin orden 2, con orden 3', en: 'Without order 2, with order 3', ok: 1 },
          { es: 'Sin orden 2, con orden 2', en: 'Without order 2, with order 2' },
          { es: 'Sin orden 3, con orden 3', en: 'Without order 3, with order 3' },
        ],
        why: {
          es: 'Sin orden: 1+1+1 y 1+2. Con orden también cuenta 2+1: son tres. Con la moneda por fuera cada conjunto se genera en un único orden; con la cantidad por fuera, en todos.',
          en: 'Without order: 1+1+1 and 1+2. With order, 2+1 also counts: three. With the coin on the outside each set is generated in a single order; with the amount on the outside, in all of them.',
        },
      } },
    { tabla: { filas: 2, cols: COLS_M, cab: cabMon, val: tablaMonedas([1, 3, 4], COLS_M - 1) }, est: { ...celdasHechas(0, DPMON.map((_, c) => c)), ...MAL_MON },
      marcas: { T: { col: 6 } }, resaltar: { cols: [6] }, formula: fm(`T = 6:  DP = ${DPMON[6]},  voraz = ${VZMON[6]}`), code: C_MON, line: 8,
      jugar: {
        arrastrables: true,
        botones: [
          ...SETS.map(s => ({ label: `{${s.join(', ')}}`, hacer: v => aplicarMonedas(v, s, v.T ?? 6, COLS_M) })),
          { label: 'T − 1', hacer: v => aplicarMonedas(v, v.set ?? SETS[0], (v.T ?? 6) - 1, COLS_M), off: v => (v.T ?? 6) <= 0 },
          { label: 'T + 1', hacer: v => aplicarMonedas(v, v.set ?? SETS[0], (v.T ?? 6) + 1, COLS_M), off: v => (v.T ?? 6) >= COLS_M - 1 },
        ],
        soltar: (v, r, c) => aplicarMonedas(v, v.set ?? SETS[0], c, COLS_M),
        lecturas: v => {
          const s = v.set ?? SETS[0], T = v.T ?? 6, [dp, vz] = tablaMonedas(s, T);
          return [
            { expr: tr('monedas', 'coins'), valor: `{${s.join(', ')}}` },
            { expr: tr('objetivo T', 'target T'), valor: T },
            { expr: tr('DP (óptimo)', 'DP (optimal)'), valor: dp[T] },
            { expr: tr('voraz', 'greedy'), valor: vz[T], malo: vz[T] !== dp[T] },
          ];
        },
      },
      es: 'Compara tú: elige un conjunto de monedas y un objetivo `T` (con los botones o haciendo clic en una columna). Mira cuándo el voraz iguala a la DP y cuándo no: en rojo, las diferencias. {1, 5, 10, 25} es un sistema donde el voraz acierta.',
      en: 'Compare yourself: pick a coin set and a target `T` (with the buttons or by clicking a column). See when greedy matches DP and when it does not: differences are in red. {1, 5, 10, 25} is a system where greedy is right.' },

    // ═══ 6. LIS y errores típicos ═══
    { sec: { es: 'LIS y errores típicos', en: 'LIS and typical mistakes' }, leyenda: ['activo', 'compara', 'hecho', 'camino'],
      tabla: { filas: 2, cols: V_LIS.length, cab: { filas: ['v', 'dp'], cols: nums(0, V_LIS.length - 1), esq: 'i' }, val: [V_LIS, V_LIS.map(() => null)] },
      code: C_LIS, line: 3,
      es: `**LIS**: subsecuencia estrictamente creciente más larga de ${V_LIS.join(', ')}. Cuidado con el estado: \`dp[i]\` = longitud de la mejor subsecuencia creciente que **termina** en \`v[i]\`. Transición: \`dp[i] = 1 + max(dp[j])\` sobre los \`j < i\` con \`v[j] < v[i]\`, o 1 si no hay ninguno.`,
      en: `**LIS**: longest strictly increasing subsequence of ${V_LIS.join(', ')}. Mind the state: \`dp[i]\` = length of the best increasing subsequence that **ends** at \`v[i]\`. Transition: \`dp[i] = 1 + max(dp[j])\` over the \`j < i\` with \`v[j] < v[i]\`, or 1 if there is none.` },
    { ...reset([V_LIS, V_LIS.map(() => null)], {}, 2, V_LIS.length), line: 4, traza: LI.frames,
      es: 'Cada celda mira **todas** las anteriores: $O(n)$ por celda y $n$ celdas, luego $O(n^2)$. Las flechas van a los `j` con `v[j] < v[i]`. Reproduce la traza.',
      en: 'Each cell looks at **all** the earlier ones: $O(n)$ per cell and $n$ cells, so $O(n^2)$. Arrows go to the `j` with `v[j] < v[i]`. Play the trace.' },
    { ...reset([V_LIS, LI.dp], { ...Object.fromEntries(LI.dp.map((_, i) => [`1,${i}`, 'hecha'])), ...Object.fromEntries(LN.idx.map(i => [`1,${i}`, 'camino'])) }, 2, V_LIS.length), line: 10,
      es: `La respuesta no es \`dp[n-1]\` sino el **máximo** de la fila: ${LI.mejor}. Si para cada \`i\` guardas también el \`j\` que dio el máximo, se reconstruye una secuencia: aquí ${LN.seq.join(', ')} (celdas violeta).`,
      en: `The answer is not \`dp[n-1]\` but the **maximum** of the row: ${LI.mejor}. If for each \`i\` you also store the \`j\` that gave the maximum, a sequence can be rebuilt: here ${LN.seq.join(', ')} (violet cells).` },
    { tabla: { filas: 1, cols: V_LIS.length, cab: { filas: ['cola'], cols: nums(1, V_LIS.length), esq: 'largo' }, val: [V_LIS.map(() => null)] }, code: C_COLA, line: 1, traza: COLA.frames,
      es: 'Con una idea más fina baja a $O(n\\log n)$: `cola[k]` = menor valor final de una creciente de largo `k+1`. Cada `x` se coloca con `lower_bound` (búsqueda binaria): alarga la cola o mejora un final. Su **longitud** es la LIS. Reproduce la traza.',
      en: 'A finer idea brings it down to $O(n\\log n)$: `cola[k]` = smallest last value of an increasing run of length `k+1`. Each `x` is placed with `lower_bound` (binary search): it extends the queue or improves an end. Its **length** is the LIS. Play the trace.' },
    { ...reset([[...COLA.cola, ...Array(V_LIS.length - COLA.cola.length).fill(null)]], celdasHechas(0, COLA.cola.map((_, k) => k)), 1, V_LIS.length), marcas: { p: null }, line: null,
      es: `La cola acaba con longitud ${COLA.cola.length}, igual que la LIS. Pero \`cola\` no es una subsecuencia de \`v\`: aquí es [${COLA.cola.join(', ')}] y el 2 aparece después del 5 en \`v\`. Para reconstruir una LIS real hay que guardar también los predecesores. Coste: $n$ búsquedas de $O(\\log n)$.`,
      en: `The queue ends with length ${COLA.cola.length}, the same as the LIS. But \`cola\` is not a subsequence of \`v\`: here it is [${COLA.cola.join(', ')}] and the 2 appears after the 5 in \`v\`. To rebuild a real LIS you must also store the predecessors. Cost: $n$ searches of $O(\\log n)$.` },
    { tabla: { filas: 3, cols: V_LIS.length, cab: { filas: ['v', 'dp', 'prefijo'], cols: nums(0, V_LIS.length - 1), esq: 'i' }, val: [V_LIS, LI.dp, PREFIJO] },
      est: { '0,6': 'lee', '1,6': 'activa', '2,6': 'mal' }, leyenda: ['activo', 'compara', 'mal'], code: C_LIS, line: 3,
      es: 'Error 1: **estado mal definido**. Si `dp[i]` fuese «la mejor LIS en los primeros `i` elementos» (fila `prefijo`), en `i = 6` valdría 4, pero eso no dice si el 2 puede extenderla: hace falta saber en qué valor **termina**. Si la transición no sale, al estado le falta información.',
      en: 'Mistake 1: **badly defined state**. If `dp[i]` were “the best LIS among the first `i` elements” (row `prefijo`), at `i = 6` it would be 4, but that does not say whether the 2 can extend it: you need to know which value it **ends** at. If the transition does not come out, the state is missing information.' },
    { tabla: { filas: 1, cols: 4, cab: { filas: ['dp'], cols: nums(0, 3), esq: 'c' }, val: [[0, 'INT_MAX', 1, 'INT_MIN']] }, est: { '0,3': 'mal', '0,1': 'lee' }, deps: [[0, 1, 0, 3]], marcas: { c: { col: 3 } },
      formula: fm('dp[3] = min(INT_MAX, dp[1] + 1)'), code: C_MON, line: 8, leyenda: ['compara', 'mal'],
      es: 'Error 2: **desbordes**. Monedas {2} y T = 3, con `dp` inicializado a `INT_MAX`. `dp[1]` sigue en `INT_MAX` y `dp[1] + 1` desborda un `int` con signo: comportamiento indefinido (en la práctica da `INT_MIN`, que «gana» el `min`). ¿Qué corrige el código del listado?',
      en: 'Mistake 2: **overflows**. Coins {2} and T = 3, with `dp` initialized to `INT_MAX`. `dp[1]` stays at `INT_MAX` and `dp[1] + 1` overflows a signed `int`: undefined behavior (in practice it gives `INT_MIN`, which “wins” the `min`). What does the listing code fix?',
      pregunta: {
        opc: [
          { es: 'Usa `INF = T + 1`, un valor que se puede sumar sin desbordar', en: 'It uses `INF = T + 1`, a value that can be added without overflowing', ok: 1 },
          { es: 'Captura la excepción de desbordamiento', en: 'It catches the overflow exception' },
          { es: 'Nada: con `INT_MAX` también funciona', en: 'Nothing: it also works with `INT_MAX`' },
        ],
        why: {
          es: 'Un desbordamiento de `int` con signo no lanza ninguna excepción: es comportamiento indefinido. Con `T + 1` (ninguna respuesta válida llega a tanto) la suma `INF + 1` no desborda y `min` descarta ese valor.',
          en: 'A signed `int` overflow throws no exception: it is undefined behavior. With `T + 1` (no valid answer reaches that high) the sum `INF + 1` does not overflow and `min` discards that value.',
        },
      } },
    { est: null, deps: null, marcas: null, formula: null, code: '', line: null,
      es: 'Error 3: **orden de llenado**. Leer una celda antes de calcularla, o recorrer `w` hacia arriba en la mochila de una fila. Error 4: tablas de conteo que crecen rápido: `escaleras(92)` ya no cabe en un `long long` con signo (desborda), y a veces el enunciado pide el resultado módulo $10^9+7$. Antes de codificar, escribe el orden y el rango de los valores.',
      en: 'Mistake 3: **fill order**. Reading a cell before computing it, or going upwards in `w` in the one-row knapsack. Mistake 4: counting tables that grow fast: `escaleras(92)` no longer fits in a signed `long long` (it overflows), and sometimes the statement asks for the result modulo $10^9+7$. Before coding, write down the order and the range of the values.' },

    // ═══ 7. Cierre ═══
    { sec: { es: 'Cierre: cómo atacar un problema', en: 'Wrap-up: how to attack a problem' },
      tabla: { filas: 5, cols: 3, cab: { filas: ['Estado', 'Transic.', 'Base', 'Orden', 'Result.'], cols: ['Mochila', 'LCS', 'Monedas'], esq: '' },
        val: [['i, w', 'i, j', 'c'], ['no/coger', 'igual?', 'min + 1'], ['fila 0', 'bordes 0', 'dp[0]=0'], ['i↑ w↑', 'i↑ j↑', 'c↑'], ['dp[n][W]', 'dp[n][m]', 'dp[T]']] },
      code: '', line: null,
      es: 'La receta en cinco preguntas, aplicada a tres problemas. ¿Qué **estado** identifica un subproblema? ¿Cuál es la **transición**? ¿Cuáles son los **casos base**? ¿En qué **orden** se rellena? ¿Qué celda es la **respuesta**? Si no puedes escribir el estado en una frase, todavía no tienes el problema planteado.',
      en: 'The recipe in five questions, applied to three problems. What **state** identifies a subproblem? What is the **transition**? What are the **base cases**? In what **order** is it filled? Which cell is the **answer**? If you cannot write the state in one sentence, you do not have the problem set up yet.' },
    { code: '', line: null,
      es: 'Para elegir método: **DP** si hay subproblemas solapados y pocos estados; **voraz** solo si la elección local se demuestra óptima; **fuerza bruta** si `n` es pequeño. Una mochila 0/1 con 20 objetos, pesos arbitrarios y capacidad $10^9$: ¿qué usarías?',
      en: 'To choose a method: **DP** if there are overlapping subproblems and few states; **greedy** only if the local choice is proved optimal; **brute force** if `n` is small. A 0/1 knapsack with 20 items, arbitrary weights and capacity $10^9$: what would you use?',
      pregunta: {
        opc: [
          { es: 'DP con tabla por capacidad: unos 2·10^10 celdas', en: 'DP with a table per capacity: about 2·10^10 cells' },
          { es: 'Fuerza bruta sobre los 2^20 subconjuntos (≈ un millón)', en: 'Brute force over the 2^20 subsets (about one million)', ok: 1 },
          { es: 'Voraz por valor/peso: siempre da el óptimo', en: 'Greedy by value/weight: it always gives the optimum' },
        ],
        why: {
          es: 'Con $W=10^9$ la tabla no cabe, pero con 20 objetos hay solo $2^{20}\\approx10^6$ subconjuntos: la fuerza bruta es barata. El voraz por valor/peso no es óptimo en la mochila 0/1. El método depende de los tamaños: cuenta estados y alternativas antes de elegir.',
          en: 'With $W=10^9$ the table does not fit, but with 20 items there are only $2^{20}\\approx10^6$ subsets: brute force is cheap. Greedy by value/weight is not optimal for the 0/1 knapsack. The method depends on the sizes: count states and alternatives before choosing.',
        },
      } },
  ],
};
