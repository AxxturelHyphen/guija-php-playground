// Guía demo de la escena «tabla» (formato de parches en assets/guias/tabla.js). Ejercita: apertura con cabeceras, val (matriz,
// ternas y mapa), est (todos los estados), deps animadas, marcas sobre cabeceras, formula, resaltar, trazas generadas
// (LCS con traceback, mochila 0/1), matriz de adyacencia y `jugar` con clic en celda.
// Las trazas se calculan aquí ejecutando el algoritmo y emitiendo frames; se exportan para probarlas en Node.
import { poner, estado, leer, llave } from '../tabla.js';

/** Parche `est` mínimo para pasar de `prev` a `next` (mapas {"r,c": estado}); los que desaparecen van a null. */
export const difEst = (prev, next) => {
  const d = {};
  for (const k of Object.keys(prev)) if (!(k in next)) d[k] = null;
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) d[k] = v;
  return d;
};

// ── LCS: subsecuencia común más larga ──────────────────────────────────────────────────────────────
const C_LCS = c1 => `int lcs(string a, string b) {   // ${c1}
    int n = a.size(), m = b.size();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= m; j++) {
            if (a[i - 1] == b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
            else dp[i][j] = max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    return dp[n][m];
}`;

export const A_LCS = 'ABCB', B_LCS = 'BDCB';
const cabLCS = (a, b) => ({ filas: ['', ...a], cols: ['', ...b], esq: 'i\\j' });
/** Tabla de LCS completa (matriz (n+1)×(m+1)). */
export function tablaLCS(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}
/** Celdas leídas por (i,j): si las letras coinciden, la diagonal; si no, la de arriba y la de la izquierda. */
export const leeLCS = (a, b, i, j) => (a[i - 1] === b[j - 1] ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]]);

/** Frames que calculan la tabla celda a celda: (1) se lee de las vecinas, (2) se escribe el valor. */
export function trazaLCS(a, b) {
  const dp = tablaLCS(a, b), fr = [], hechas = new Set();
  for (let i = 0; i <= a.length; i++) hechas.add(llave(i, 0));
  for (let j = 0; j <= b.length; j++) hechas.add(llave(0, j));
  let est = {};
  const emite = (f, nuevo) => { fr.push({ ...f, est: difEst(est, nuevo) }); est = nuevo; };
  const base = () => Object.fromEntries([...hechas].map(k => [k, 'hecha']));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const igual = a[i - 1] === b[j - 1], lee = leeLCS(a, b, i, j), k = llave(i, j);
      const lect = { ...base(), ...Object.fromEntries(lee.map(([r, c]) => [llave(r, c), 'lee'])), [k]: 'activa' };
      const f = igual ? `dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1` : `dp[${i}][${j}] = max(dp[${i - 1}][${j}], dp[${i}][${j - 1}])`;
      emite({
        line: igual ? 6 : 7, marcas: { i: { fila: i }, j: { col: j } }, deps: lee.map(([r, c]) => [r, c, i, j]), formula: { es: '`' + f + '`', en: '`' + f + '`' },
        es: igual ? `\`a[${i - 1}]\` = ${a[i - 1]} y \`b[${j - 1}]\` = ${b[j - 1]} coinciden: se lee la diagonal.` : `\`a[${i - 1}]\` = ${a[i - 1]} y \`b[${j - 1}]\` = ${b[j - 1]} son distintas: se lee la de arriba y la de la izquierda.`,
        en: igual ? `\`a[${i - 1}]\` = ${a[i - 1]} and \`b[${j - 1}]\` = ${b[j - 1]} match: read the diagonal.` : `\`a[${i - 1}]\` = ${a[i - 1]} and \`b[${j - 1}]\` = ${b[j - 1]} differ: read the cell above and the one to the left.`,
      }, lect);
      hechas.add(k);
      emite({
        line: igual ? 6 : 7, val: [[i, j, dp[i][j]]], deps: null,
        es: `Se escribe \`dp[${i}][${j}]\` = ${dp[i][j]}.`, en: `\`dp[${i}][${j}]\` = ${dp[i][j]} is written.`,
      }, base());
    }
  }
  return fr;
}

/** Camino de vuelta desde dp[n][m]: celdas visitadas, cuáles son coincidencias y la subsecuencia resultante. */
export function caminoLCS(a, b, dp = tablaLCS(a, b)) {
  let i = a.length, j = b.length;
  const celdas = [[i, j]], coincide = [];
  let sub = '';
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { sub = a[i - 1] + sub; coincide.push(celdas.length - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
    celdas.push([i, j]);
  }
  return { celdas, coincide, sub };
}
export function trazaVuelta(a, b) {
  const dp = tablaLCS(a, b), { celdas, coincide, sub } = caminoLCS(a, b, dp), fr = [];
  const act = celdas.map(([i, j]) => llave(i, j));
  celdas.forEach(([i, j], n) => {
    const par = coincide.includes(n), fin = n === celdas.length - 1;
    fr.push({
      marcas: { i: { fila: i }, j: { col: j } }, est: { [act[n]]: 'camino' },
      es: fin ? `Llegamos al borde: el camino marcado construye «${sub}».` : par ? `\`a[${i - 1}]\` = \`b[${j - 1}]\` = ${a[i - 1]}: esta letra está en la subsecuencia; subimos en diagonal.` : `No coinciden: nos movemos hacia la vecina con mayor valor.`,
      en: fin ? `We reached the edge: the marked path builds «${sub}».` : par ? `\`a[${i - 1}]\` = \`b[${j - 1}]\` = ${a[i - 1]}: this letter is in the subsequence; move diagonally.` : `They differ: move to the neighbour with the larger value.`,
    });
  });
  return fr;
}

// ── Mochila 0/1 ────────────────────────────────────────────────────────────────────────────────────
const C_MOCH = c1 => `int mochila(vector<int> p, vector<int> v, int W) {   // ${c1}
    int n = p.size();
    vector<vector<int>> dp(n + 1, vector<int>(W + 1, 0));
    for (int i = 1; i <= n; i++) {
        for (int w = 0; w <= W; w++) {
            dp[i][w] = dp[i - 1][w];
            if (w >= p[i - 1])
                dp[i][w] = max(dp[i][w], dp[i - 1][w - p[i - 1]] + v[i - 1]);
        }
    }
    return dp[n][W];
}`;
export const ITEMS = [{ p: 2, v: 3 }, { p: 3, v: 4 }, { p: 4, v: 5 }, { p: 5, v: 6 }], CAP = 7;
export function tablaMochila(items = ITEMS, W = CAP) {
  const dp = Array.from({ length: items.length + 1 }, () => Array(W + 1).fill(0));
  for (let i = 1; i <= items.length; i++) for (let w = 0; w <= W; w++) {
    dp[i][w] = dp[i - 1][w];
    if (w >= items[i - 1].p) dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - items[i - 1].p] + items[i - 1].v);
  }
  return dp;
}
const cabMoch = (items, W) => ({ filas: ['—', ...items.map(x => 'p' + x.p)], cols: Array.from({ length: W + 1 }, (_, w) => String(w)), esq: 'i\\W' });
/** Un frame por celda (i, w): lee dp[i-1][w] y, si cabe, dp[i-1][w-p]; la celda se rellena a la vez. */
export function trazaMochila(items = ITEMS, W = CAP) {
  const dp = tablaMochila(items, W), fr = [], hechas = new Set();
  for (let w = 0; w <= W; w++) hechas.add(llave(0, w));
  let est = {};
  for (let i = 1; i <= items.length; i++) {
    for (let w = 0; w <= W; w++) {
      const { p, v } = items[i - 1], cabe = w >= p, k = llave(i, w);
      const lee = [[i - 1, w], ...(cabe ? [[i - 1, w - p]] : [])];
      const nuevo = { ...Object.fromEntries([...hechas].map(h => [h, 'hecha'])), ...Object.fromEntries(lee.map(([r, c]) => [llave(r, c), 'lee'])), [k]: 'activa' };
      const f = cabe ? `max(${dp[i - 1][w]}, ${dp[i - 1][w - p]} + ${v}) = ${dp[i][w]}` : `${dp[i - 1][w]}  (no cabe: ${w} < ${p})`;
      fr.push({
        line: cabe ? 7 : 6, val: [[i, w, dp[i][w]]], est: difEst(est, nuevo), deps: lee.map(([r, c]) => [r, c, i, w]),
        marcas: { i: { fila: i }, w: { col: w } }, formula: { es: '`' + f + '`', en: '`' + f + '`' },
        es: cabe ? `Con capacidad ${w} cabe el objeto de peso ${p}: se compara no cogerlo con cogerlo (valor ${v}).` : `Con capacidad ${w} no cabe el objeto de peso ${p}: se copia lo de arriba.`,
        en: cabe ? `With capacity ${w} the item of weight ${p} fits: compare skipping it with taking it (value ${v}).` : `With capacity ${w} the item of weight ${p} does not fit: copy the cell above.`,
      });
      est = nuevo; hechas.add(k);
    }
  }
  return fr;
}

// ── Matriz de adyacencia ───────────────────────────────────────────────────────────────────────────
export const NODOS = ['A', 'B', 'C', 'D', 'E'];
export const ARISTAS = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]];
export const adyacencia = (n = NODOS.length, aristas = ARISTAS) => {
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  for (const [a, b] of aristas) { m[a][b] = 1; m[b][a] = 1; }
  return m;
};

// ── Jugar: clic en una celda de LCS y ver de dónde sale ────────────────────────────────────────────
/** Efecto de elegir la celda (r,c) en la vista v de una tabla LCS: muestra qué lee y cómo se calcula. */
export function elegirLCS(v, r, c, cx) {
  const a = cx.cabF.slice(1).join(''), b = cx.cabC.slice(1).join('');
  v.est = {}; v.deps = [];
  estado(v, r, c, 'activa'); v.marcas = { i: { fila: r }, j: { col: c } };
  if (r === 0 || c === 0) {
    v.formula = { es: '`dp[i][0] = dp[0][j] = 0`  (caso base)', en: '`dp[i][0] = dp[0][j] = 0`  (base case)' };
    return v;
  }
  const lee = leeLCS(a, b, r, c);
  for (const [i, j] of lee) { estado(v, i, j, 'lee'); v.deps.push([i, j, r, c]); }
  const f = a[r - 1] === b[c - 1] ? `dp[${r}][${c}] = dp[${r - 1}][${c - 1}] + 1 = ${leer(v, r, c)}` : `dp[${r}][${c}] = max(${leer(v, r - 1, c)}, ${leer(v, r, c - 1)}) = ${leer(v, r, c)}`;
  v.formula = { es: '`' + f + '`', en: '`' + f + '`' };
  return v;
}

const DP = tablaLCS(A_LCS, B_LCS), DPM = tablaMochila();
const bordeLCS = DP.map((f, i) => f.map((x, j) => (i === 0 || j === 0 ? x : null)));
const todasHechas = m => Object.fromEntries(m.flatMap((f, i) => f.map((_, j) => [llave(i, j), 'hecha'])));

export default {
  titulo: { es: 'Demo tabla', en: 'Table demo' },
  pasos: [
    // ── LCS ──
    {
      sec: { es: 'LCS', en: 'LCS' },
      tabla: { filas: A_LCS.length + 1, cols: B_LCS.length + 1, cab: cabLCS(A_LCS, B_LCS), val: bordeLCS },
      code: { es: C_LCS('subsecuencia común más larga'), en: C_LCS('longest common subsequence') }, line: 3,
      es: `Cada **celda** \`dp[i][j]\` guarda la longitud de la subsecuencia común de los primeros \`i\` caracteres de «${A_LCS}» y los primeros \`j\` de «${B_LCS}». La fila y la columna 0 valen 0; el resto está **vacío**: aún sin calcular.`,
      en: `Each **cell** \`dp[i][j]\` holds the length of the longest common subsequence of the first \`i\` characters of «${A_LCS}» and the first \`j\` of «${B_LCS}». Row and column 0 are 0; the rest is **empty**: not computed yet.`,
    },
    {
      est: { '1,1': 'activa', '0,0': 'lee', '0,1': 'lee', '1,0': 'lee' }, deps: [[0, 1, 1, 1], [1, 0, 1, 1]],
      marcas: { i: { fila: 1 }, j: { col: 1 } }, resaltar: { filas: [1], cols: [1] },
      formula: { es: 'A ≠ B: `dp[1][1] = max(dp[0][1], dp[1][0])`', en: 'A ≠ B: `dp[1][1] = max(dp[0][1], dp[1][0])`' }, line: 7,
      es: 'La celda **activa** (anillo azul) se calcula a partir de las que **lee** (borde amarillo discontinuo); las flechas van de la celda leída a la calculada. Los punteros `i` y `j` marcan fila y columna, y la fórmula aparece debajo.',
      en: 'The **active** cell (blue ring) is computed from the cells it **reads** (dashed yellow border); arrows go from the cell read to the cell computed. Pointers `i` and `j` mark row and column, and the formula appears below.',
    },
    {
      est: null, deps: null, marcas: null, resaltar: null, formula: null, line: 4,
      traza: trazaLCS(A_LCS, B_LCS),
      es: 'Pulsa ▶ y mira cómo se rellena la tabla: cada celda lee a sus vecinas, brota el valor y pasa a **hecha** (verde con esquina marcada).',
      en: 'Press ▶ and watch the table fill in: each cell reads its neighbours, the value pops in and it becomes **done** (green with a marked corner).',
    },
    {
      sec: { es: 'Recuperar la solución', en: 'Recovering the solution' },
      val: DP, est: todasHechas(DP), deps: null, marcas: null, formula: null, line: 9,
      traza: trazaVuelta(A_LCS, B_LCS),
      es: 'El valor de abajo a la derecha es la longitud. Para saber **cuál** es la subsecuencia se vuelve desde esa celda: el **camino** (doble borde violeta) sigue las coincidencias en diagonal.',
      en: 'The bottom-right value is the length. To find **which** subsequence it is, walk back from that cell: the **path** (violet double border) follows the matches diagonally.',
    },
    {
      est: { '3,2': 'elegida', '2,3': 'mal' }, resaltar: { filas: [3], cols: [2] }, marcas: { i: { fila: 3 }, j: { col: 2 } }, formula: null,
      es: 'Se pueden **resaltar** filas y columnas: aquí la fila de `C` y la columna de `D`; su cruce compara esas dos letras. El contorno es una celda **elegida** y la de rayas rojas, un estado **mal** (por ejemplo, un error común).',
      en: 'You can **highlight** rows and columns: here the row of `C` and the column of `D`; their crossing compares those two letters. The outline is a **chosen** cell and the red striped one is a **wrong** state (a common mistake, for example).',
    },

    // ── Mochila ──
    {
      sec: { es: 'Mochila 0/1', en: '0/1 knapsack' },
      tabla: { filas: ITEMS.length + 1, cols: CAP + 1, cab: cabMoch(ITEMS, CAP), val: DPM.map((f, i) => f.map(x => (i === 0 ? x : null))) },
      code: { es: C_MOCH('valor máximo con capacidad W'), en: C_MOCH('maximum value with capacity W') }, line: 4,
      est: Object.fromEntries(DPM[0].map((_, w) => [llave(0, w), 'hecha'])),
      es: 'En la mochila, las filas son los objetos disponibles (cabecera: su peso `p`) y las columnas, la capacidad `W` de 0 a 7. Con una tabla más ancha que alta, las celdas se ajustan solas.',
      en: 'In the knapsack, rows are the available items (header: its weight `p`) and columns are the capacity `W` from 0 to 7. With a table wider than tall, the cells adjust on their own.',
    },
    {
      val: DPM, est: { ...todasHechas(DPM), '3,7': 'activa', '2,7': 'lee', '2,3': 'lee' }, hl: { '3,2': 'mal' },
      deps: [[2, 7, 3, 7], [2, 3, 3, 7]], marcas: { i: { fila: 3 }, w: { col: 7 } }, resaltar: { filas: [3] }, line: 7,
      formula: { es: '`dp[3][7] = max(dp[2][7], dp[2][3] + 5)`', en: '`dp[3][7] = max(dp[2][7], dp[2][3] + 5)`' },
      es: 'Con capacidad 7 y el objeto de peso 4 (valor 5): o no se coge (`dp[2][7]`) o se coge y queda capacidad 3 (`dp[2][3] + 5`). La celda roja muestra que con capacidad 2 el objeto de peso 4 **no cabe**.',
      en: 'With capacity 7 and the weight-4 item (value 5): either skip it (`dp[2][7]`) or take it, leaving capacity 3 (`dp[2][3] + 5`). The red cell shows that with capacity 2 the weight-4 item **does not fit**.',
    },
    {
      val: DPM.map((f, i) => f.map(x => (i === 0 ? x : null))), est: null, deps: null, marcas: null, resaltar: null, formula: null, line: 5,
      traza: trazaMochila(),
      es: 'Y la tabla completa, celda a celda. Fíjate en que cada fila solo mira a la anterior.',
      en: 'And the whole table, cell by cell. Notice that each row only looks at the previous one.',
    },

    // ── Matriz de adyacencia ──
    {
      sec: { es: 'Matriz de adyacencia', en: 'Adjacency matrix' },
      tabla: { filas: NODOS.length, cols: NODOS.length, cab: { filas: NODOS, cols: NODOS, esq: '' }, val: adyacencia(), formula: false },
      est: Object.fromEntries(adyacencia().flatMap((f, i) => f.map((x, j) => (x ? [llave(i, j), 'hecha'] : null)).filter(Boolean))),
      resaltar: { filas: [3] }, marcas: { v: { fila: 3 } }, code: '', line: null,
      es: 'La misma escena sirve para una **matriz de adyacencia**: un 1 en fila `D`, columna `B` es la arista D–B. Resaltar la fila de `D` muestra todos sus vecinos de una vez. Aquí se abrió con `formula:false` y sin línea de fórmula.',
      en: 'The same scene works for an **adjacency matrix**: a 1 in row `D`, column `B` is the edge D–B. Highlighting the row of `D` shows all its neighbours at once. Here it was opened with `formula:false` and no formula line.',
    },

    // ── Pruébalo tú ──
    {
      sec: { es: 'Pruébalo tú', en: 'Try it yourself' },
      tabla: { filas: A_LCS.length + 1, cols: B_LCS.length + 1, cab: cabLCS(A_LCS, B_LCS), val: DP },
      code: '', line: null,
      jugar: {
        arrastrables: true,
        botones: [
          { label: { es: 'Limpiar', en: 'Clear' }, hacer: v => { v.est = {}; v.deps = []; v.marcas = {}; v.formula = null; } },
          { label: { es: 'Poner a 0 la última', en: 'Zero the last' }, hacer: v => { poner(v, 4, 4, 0); }, off: v => leer(v, 4, 4) === 0 },
        ],
        soltar: (v, r, c, cx) => elegirLCS(v, r, c, cx),
        lecturas: (v, cx) => {
          const i = v.marcas.i?.fila, j = v.marcas.j?.col;
          if (i === undefined || j === undefined) return [{ expr: 'dp[i][j]', valor: '—' }];
          const a = cx.cabF.slice(1).join(''), b = cx.cabC.slice(1).join('');
          return [{ expr: `dp[${i}][${j}]`, valor: leer(v, i, j) }, { expr: 'regla', valor: i === 0 || j === 0 ? '0' : a[i - 1] === b[j - 1] ? 'a[i-1] == b[j-1]' : 'a[i-1] != b[j-1]' }];
        },
      },
      es: 'Haz clic en cualquier celda (o muévete con las flechas y pulsa Enter) para ver de qué celdas sale su valor y con qué fórmula. Pasa el ratón por encima: el contorno azul indica la celda **elegida**.',
      en: 'Click any cell (or move with the arrow keys and press Enter) to see which cells its value comes from and with which formula. Hover over a cell: the blue outline marks the **chosen** cell.',
    },
  ],
};
