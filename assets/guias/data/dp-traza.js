// Generadores de trazas y lógica de los bloques `jugar` de la guía «Programación dinámica» (data/dp.js). Todo son funciones
// puras que EJECUTAN el algoritmo (fib memoizado, escaleras, mochila 0/1, LCS, distancia de edición, monedas, LIS…) y devuelven
// los frames de la traza: los valores de la tabla que se ven en pantalla salen de ejecutar el código, no de escribirlos.
// Se prueban en Node con tests/guias/test-dp.js (cada generador contra una referencia independiente por fuerza bruta).
// Formato de los frames: cabecera de assets/guias/tabla.js (val, est, deps, marcas, resaltar, formula + line, es, en).
import { poner, estado, leer, llave } from '../tabla.js';

const esEn = () => globalThis.document?.documentElement.lang === 'en'; // idioma activo (las lecturas de `jugar` no son bilingües)
/** Texto según el idioma activo (solo para lecturas de `jugar`, que son cadenas planas). */
export const tr = (es, en) => (esEn() ? en : es);
/** Fórmula de la escena `tabla` (código inline, igual en los dos idiomas). */
export const fm = s => { const t = '`' + s + '`'; return { es: t, en: t }; };

/** Fibonacci F(0)=0, F(1)=1 (iterativo). */
export const fibNum = n => { let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; };
/** Llamadas del fib ingenuo: T(n) = 2·F(n+1) − 1. */
export const llamadasFib = n => 2 * fibNum(n + 1) - 1;

/** Parche `est` mínimo para pasar del mapa `prev` al mapa `next`; los que desaparecen van a null. */
export const difEst = (prev, next) => {
  const d = {};
  for (const k of Object.keys(prev)) if (!(k in next)) d[k] = null;
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) d[k] = v;
  return d;
};
const hechas = ks => Object.fromEntries([...ks].map(k => [k, 'hecha']));
/** Mapa `est` con todo `null` salvo `mapa`: sirve para restaurar una tabla tras una traza (est:null no admite mezclar). */
export const soloEst = (mapa, filas, cols) => {
  const d = {};
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) d[llave(r, c)] = null;
  return { ...d, ...mapa };
};
/** Mapa `est` con todas las celdas de una matriz en el mismo estado. */
export const todas = (m, e = 'hecha') => Object.fromEntries(m.flatMap((f, i) => f.map((_, j) => [llave(i, j), e])));

/** Acumula frames: cada uno lleva solo la diferencia de `est` respecto al anterior. */
class Rec {
  constructor(est0 = {}) { this.est = { ...est0 }; this.fr = []; }
  emit(f, nuevo = this.est) { this.fr.push({ ...f, est: difEst(this.est, nuevo) }); this.est = { ...nuevo }; }
}
const fila0 = n => Array.from({ length: n }, (_, c) => llave(0, c));

// ── 1. Fibonacci: descendente (memo) y ascendente (tabla) ──────────────────────────────────────────────────────────
/** Fila inicial de fib: F(0), F(1) y el resto vacío (matriz 1 × n+1). */
export const inicialFila = (n, a0, a1) => [Array.from({ length: n + 1 }, (_, i) => (i === 0 ? a0 : i === 1 ? a1 : null))];

/** fib(n) con memo, ejecutado de verdad: un frame por llamada (base, acierto en la tabla, cálculo) y uno por escritura. */
export function fibMemoTraza(n = 6) {
  const memo = Array(n + 1).fill(-1), hs = new Set([llave(0, 0), llave(0, 1)]), rec = new Rec(hechas(hs));
  let llamadas = 0, aciertos = 0;
  const est = (k, e) => ({ ...hechas(hs), [llave(0, k)]: e });
  const fib = k => {
    llamadas++;
    const marcas = { n: { col: k } };
    if (k < 2) {
      rec.emit({ line: 2, marcas, deps: null, es: `fib(${k}) es un caso base: devuelve ${k}.`, en: `fib(${k}) is a base case: it returns ${k}.` }, est(k, 'lee'));
      return k;
    }
    if (memo[k] !== -1) {
      aciertos++;
      rec.emit({ line: 3, marcas, deps: null, es: `fib(${k}) ya está en la tabla: devuelve ${memo[k]} sin llamar a nadie.`, en: `fib(${k}) is already in the table: it returns ${memo[k]} without calling anyone.` }, est(k, 'lee'));
      return memo[k];
    }
    rec.emit({ line: 4, marcas, deps: null, es: `fib(${k}) no está: se calcula con fib(${k - 1}) y fib(${k - 2}).`, en: `fib(${k}) is not there: it is computed from fib(${k - 1}) and fib(${k - 2}).` }, est(k, 'activa'));
    const a = fib(k - 1), b = fib(k - 2);
    memo[k] = a + b; hs.add(llave(0, k));
    rec.emit({ line: 4, marcas, deps: null, val: { [llave(0, k)]: memo[k] }, es: `Vuelve fib(${k}): ${a} + ${b} = ${memo[k]}. Se guarda en la tabla.`, en: `Back in fib(${k}): ${a} + ${b} = ${memo[k]}. It is stored in the table.` }, hechas(hs));
    return memo[k];
  };
  const resultado = fib(n);
  return { frames: rec.fr, fila: memo.map((x, i) => (i < 2 ? i : x)), resultado, llamadas, aciertos };
}

/**
 * Tabla 1D ascendente con dp[i] = dp[i-1] + dp[i-2] y casos base a0, a1. modo 'fib' (t[]) o 'esc' (dp[], escaleras).
 * Un frame lee (flechas a las dos celdas anteriores) y otro escribe.
 */
export function sumaDosTraza(n, a0, a1, modo = 'fib') {
  const dp = [a0, a1], hs = new Set([llave(0, 0), llave(0, 1)]), rec = new Rec(hechas(hs));
  const nom = modo === 'fib' ? 't' : 'dp';
  for (let i = 2; i <= n; i++) {
    const x = dp[i - 2], y = dp[i - 1], z = x + y;
    rec.emit({
      line: 5, marcas: { i: { col: i } }, deps: [[0, i - 2, 0, i], [0, i - 1, 0, i]],
      formula: fm(`${nom}[${i}] = ${nom}[${i - 1}] + ${nom}[${i - 2}] = ${y} + ${x}`),
      es: modo === 'fib' ? `\`t[${i}]\` se calcula con las dos celdas anteriores: ${y} + ${x}.` : `Al peldaño ${i} se llega desde el ${i - 1} (un paso) o desde el ${i - 2} (dos pasos): ${y} + ${x} formas.`,
      en: modo === 'fib' ? `\`t[${i}]\` is computed from the two previous cells: ${y} + ${x}.` : `You reach step ${i} from step ${i - 1} (one step) or from step ${i - 2} (two steps): ${y} + ${x} ways.`,
    }, { ...hechas(hs), [llave(0, i - 2)]: 'lee', [llave(0, i - 1)]: 'lee', [llave(0, i)]: 'activa' });
    dp[i] = z; hs.add(llave(0, i));
    rec.emit({ line: 5, val: { [llave(0, i)]: z }, deps: null, es: `\`${nom}[${i}]\` = ${z}.`, en: `\`${nom}[${i}]\` = ${z}.` }, hechas(hs));
  }
  return { frames: rec.fr, dp };
}

/** Escaleras con dos variables (a, b): la banda `resaltar` es lo único que se guarda; la celda que sale de la ventana se vacía. */
export function dosVariablesTraza(n = 8) {
  let a = 1, b = 1;
  const vivas = new Set([0, 1]), cel = c => llave(0, c);
  const hv = extra => ({ ...Object.fromEntries([...vivas].map(c => [cel(c), 'hecha'])), ...extra });
  const rec = new Rec(hv());
  for (let i = 2; i <= n; i++) {
    const c = a + b, a0 = a, b0 = b;
    rec.emit({
      line: 4, deps: [[0, i - 2, 0, i], [0, i - 1, 0, i]], marcas: { a: { col: i - 2 }, b: { col: i - 1 } }, resaltar: { cols: [i - 2, i - 1] },
      formula: fm(`c = a + b = ${a0} + ${b0} = ${c}`),
      es: `\`c = a + b\`: ${a0} + ${b0} = ${c}, el valor del peldaño ${i}.`, en: `\`c = a + b\`: ${a0} + ${b0} = ${c}, the value for step ${i}.`,
    }, hv({ [cel(i - 2)]: 'lee', [cel(i - 1)]: 'lee', [cel(i)]: 'activa' }));
    a = b; b = c; vivas.delete(i - 2); vivas.add(i);
    rec.emit({
      line: 5, val: { [cel(i)]: c, [cel(i - 2)]: null }, deps: null, marcas: { a: { col: i - 1 }, b: { col: i } }, resaltar: { cols: [i - 1, i] },
      formula: fm(`a = ${a}; b = ${b}`),
      es: `\`a = b; b = c\`: la ventana avanza. La celda ${i - 2} ya no se lee y se olvida.`, en: `\`a = b; b = c\`: the window moves on. Cell ${i - 2} is no longer read and is forgotten.`,
    }, hv());
  }
  rec.emit({ line: 8, deps: null, marcas: null, resaltar: null, formula: fm(`return b = ${b}`), es: `Respuesta: \`b\` = ${b}. Solo se guardaron dos valores a la vez.`, en: `Answer: \`b\` = ${b}. Only two values were kept at any time.` }, hv({ [cel(n)]: 'camino' }));
  return { frames: rec.fr, resultado: b };
}

// ── 2. Mochila 0/1 ─────────────────────────────────────────────────────────────────────────────────────────────────
export const ITEMS = [{ p: 1, v: 1 }, { p: 3, v: 4 }, { p: 4, v: 5 }, { p: 5, v: 7 }], CAP = 7;
/** Tabla de la mochila 0/1 (matriz (n+1)×(W+1)). */
export function tablaMochila(items = ITEMS, W = CAP) {
  const dp = Array.from({ length: items.length + 1 }, () => Array(W + 1).fill(0));
  for (let i = 1; i <= items.length; i++) for (let w = 0; w <= W; w++) {
    dp[i][w] = dp[i - 1][w];
    if (w >= items[i - 1].p) dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - items[i - 1].p] + items[i - 1].v);
  }
  return dp;
}
/** Celdas que lee (i,w): la de arriba (no coger) y, si cabe, la de arriba restando el peso (coger). */
export const leeMochila = (items, i, w) => (w >= items[i - 1].p ? [[i - 1, w], [i - 1, w - items[i - 1].p]] : [[i - 1, w]]);
export const cabMochila = (items = ITEMS, W = CAP) => ({ filas: ['—', ...items.map(x => `p${x.p}·v${x.v}`)], cols: Array.from({ length: W + 1 }, (_, w) => String(w)), esq: 'i\\w' });

/** Rellena la tabla celda a celda: un frame lee las celdas (flechas) y otro escribe el máximo. */
export function mochilaTraza(items = ITEMS, W = CAP) {
  const n = items.length, dp = Array.from({ length: n + 1 }, () => Array(W + 1).fill(0));
  const hs = new Set(fila0(W + 1)), rec = new Rec(hechas(hs));
  for (let i = 1; i <= n; i++) {
    const { p, v } = items[i - 1];
    for (let w = 0; w <= W; w++) {
      const cabe = w >= p, no = dp[i - 1][w], si = cabe ? dp[i - 1][w - p] + v : -Infinity, k = llave(i, w);
      const lee = leeMochila(items, i, w);
      const marcas = { i: { fila: i }, w: { col: w } };
      rec.emit({
        line: cabe ? 8 : 6, marcas, deps: lee.map(([r, c]) => [r, c, i, w]),
        formula: fm(cabe ? `dp[${i}][${w}] = max(dp[${i - 1}][${w}], dp[${i - 1}][${w - p}] + ${v})` : `dp[${i}][${w}] = dp[${i - 1}][${w}]`),
        es: cabe ? `Objeto ${i} (peso ${p}, valor ${v}), capacidad ${w}: no cogerlo (arriba) o cogerlo y quedan ${w - p} de capacidad.` : `Con capacidad ${w} no cabe el objeto ${i} (peso ${p}): se copia la celda de arriba.`,
        en: cabe ? `Item ${i} (weight ${p}, value ${v}), capacity ${w}: skip it (above) or take it, leaving ${w - p} of capacity.` : `With capacity ${w} item ${i} (weight ${p}) does not fit: the cell above is copied.`,
      }, { ...hechas(hs), ...Object.fromEntries(lee.map(([r, c]) => [llave(r, c), 'lee'])), [k]: 'activa' });
      dp[i][w] = Math.max(no, si); hs.add(k);
      rec.emit({
        line: cabe ? 8 : 6, val: { [k]: dp[i][w] }, deps: null,
        formula: fm(cabe ? `dp[${i}][${w}] = max(${no}, ${dp[i - 1][w - p]} + ${v}) = ${dp[i][w]}` : `dp[${i}][${w}] = ${dp[i][w]}`),
        es: `\`dp[${i}][${w}]\` = ${dp[i][w]}.`, en: `\`dp[${i}][${w}]\` = ${dp[i][w]}.`,
      }, hechas(hs));
    }
  }
  return { frames: rec.fr, dp };
}

/** Vuelta atrás: ¿qué objetos entran? celdas visitadas (de dp[n][W] a la fila 0), objetos (1..n), peso y valor. */
export function caminoMochila(dp, items = ITEMS, W = CAP) {
  const celdas = [[items.length, W]], elegidos = [], pasos = [];
  let w = W;
  for (let i = items.length; i >= 1; i--) {
    const coge = dp[i][w] !== dp[i - 1][w];
    pasos.push({ i, w, coge });
    if (coge) { elegidos.push(i); w -= items[i - 1].p; }
    celdas.push([i - 1, w]);
  }
  elegidos.sort((a, b) => a - b);
  return { celdas, elegidos, pasos, peso: elegidos.reduce((s, i) => s + items[i - 1].p, 0), valor: elegidos.reduce((s, i) => s + items[i - 1].v, 0) };
}
export function mochilaCaminoTraza(items = ITEMS, W = CAP) {
  const dp = tablaMochila(items, W), cam = caminoMochila(dp, items, W), rec = new Rec(todas(dp));
  const visit = [];
  const lista = e => `${e.join(' y ')}`;
  cam.celdas.forEach(([i, w], k) => {
    visit.push(llave(i, w));
    const paso = cam.pasos[k - 1], fin = k === cam.celdas.length - 1;
    const est = { ...todas(dp), ...Object.fromEntries(visit.map(x => [x, 'camino'])) };
    let es, en, line = 4;
    if (k === 0) { es = `Se empieza en \`dp[${i}][${w}]\` = ${dp[i][w]}, el mejor valor con capacidad ${W}.`; en = `Start at \`dp[${i}][${w}]\` = ${dp[i][w]}, the best value with capacity ${W}.`; line = 2; }
    else if (paso.coge) {
      es = `\`dp[${paso.i}][${paso.w}]\` ≠ \`dp[${paso.i - 1}][${paso.w}]\`: el objeto ${paso.i} se cogió. Queda capacidad ${w}.`;
      en = `\`dp[${paso.i}][${paso.w}]\` ≠ \`dp[${paso.i - 1}][${paso.w}]\`: item ${paso.i} was taken. Capacity left: ${w}.`; line = 5;
    } else { es = `\`dp[${paso.i}][${paso.w}]\` = \`dp[${paso.i - 1}][${paso.w}]\`: el objeto ${paso.i} no hizo falta. Se sube.`; en = `\`dp[${paso.i}][${paso.w}]\` = \`dp[${paso.i - 1}][${paso.w}]\`: item ${paso.i} was not needed. Move up.`; }
    if (fin) { es += ` Fin: objetos ${lista(cam.elegidos)}.`; en += ` Done: items ${lista(cam.elegidos)}.`; }
    rec.emit({ line, marcas: { i: { fila: i }, w: { col: w } }, es, en }, est);
  });
  return { frames: rec.fr, dp, ...cam };
}

/**
 * Mochila con UNA fila y UN objeto: orden 'atras' (w de mayor a menor, correcto para 0/1) o 'adelante' (de menor a mayor: el objeto
 * se cuenta varias veces). En 'adelante', leer una celda ya actualizada en esta pasada se marca `mal`.
 */
export function mochilaFilaTraza(orden = 'atras', item = { p: 3, v: 4 }, W = CAP) {
  const dp = Array(W + 1).fill(0), hs = new Set(fila0(W + 1)), rec = new Rec(hechas(hs));
  const { p, v } = item, ws = [];
  if (orden === 'atras') for (let w = W; w >= p; w--) ws.push(w); else for (let w = p; w <= W; w++) ws.push(w);
  const tocadas = new Set();
  for (const w of ws) {
    const ya = tocadas.has(w - p), lee = llave(0, w - p), k = llave(0, w), antes = dp[w], nuevo = Math.max(antes, dp[w - p] + v);
    rec.emit({
      line: 3, marcas: { w: { col: w } }, deps: [[0, w - p, 0, w]], formula: fm(`dp[${w}] = max(dp[${w}], dp[${w - p}] + ${v})`),
      es: ya ? `Se lee \`dp[${w - p}]\`, que ya contiene el objeto en esta pasada: se sumará dos veces.` : `Se lee \`dp[${w - p}]\`: todavía vale lo de antes de este objeto.`,
      en: ya ? `\`dp[${w - p}]\` is read, and it already contains the item in this pass: it will be added twice.` : `\`dp[${w - p}]\` is read: it still holds the value from before this item.`,
    }, { ...hechas(hs), [lee]: ya ? 'mal' : 'lee', [k]: 'activa' });
    dp[w] = nuevo; tocadas.add(w);
    rec.emit({ line: 4, val: { [k]: nuevo }, deps: null, formula: fm(`dp[${w}] = max(${antes}, ${dp[w - p]} + ${v}) = ${nuevo}`), es: `\`dp[${w}]\` = ${nuevo}.`, en: `\`dp[${w}]\` = ${nuevo}.` }, hechas(hs));
  }
  const mal = dp.map((x, w) => (x > v ? w : -1)).filter(w => w >= 0); // con un solo objeto, valer más que v es imposible
  rec.emit({
    line: 5, deps: null, marcas: null, formula: null,
    es: mal.length ? `Resultado erróneo: \`dp[${mal[0]}]\` = ${dp[mal[0]]} con un solo objeto de valor ${v}. Se usó dos veces.` : `Resultado correcto: el objeto se usa una sola vez (valor máximo ${v}).`,
    en: mal.length ? `Wrong result: \`dp[${mal[0]}]\` = ${dp[mal[0]]} with a single item of value ${v}. It was used twice.` : `Correct result: the item is used only once (maximum value ${v}).`,
  }, { ...hechas(hs), ...Object.fromEntries(mal.map(w => [llave(0, w), 'mal'])) });
  return { frames: rec.fr, dp, mal };
}

// ── 3. LCS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const A_LCS = 'ABCBDAB', B_LCS = 'BDCABA';
export const cabLCS = (a, b) => ({ filas: ['', ...a], cols: ['', ...b], esq: 'i\\j' });
export function tablaLCS(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}
export const leeLCS = (a, b, i, j) => (a[i - 1] === b[j - 1] ? [[i - 1, j - 1]] : [[i - 1, j], [i, j - 1]]);
/** Bordes (fila 0 y columna 0) de una tabla de ceros: matriz con null en el interior. */
export const bordeLCS = (a, b) => Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 || j === 0 ? 0 : null)));

export function lcsTraza(a = A_LCS, b = B_LCS) {
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const hs = new Set([...Array.from({ length: n + 1 }, (_, i) => llave(i, 0)), ...Array.from({ length: m + 1 }, (_, j) => llave(0, j))]), rec = new Rec(hechas(hs));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const igual = a[i - 1] === b[j - 1], lee = leeLCS(a, b, i, j), k = llave(i, j);
    rec.emit({
      line: igual ? 7 : 9, marcas: { i: { fila: i }, j: { col: j } }, deps: lee.map(([r, c]) => [r, c, i, j]),
      formula: fm(igual ? `dp[${i}][${j}] = dp[${i - 1}][${j - 1}] + 1` : `dp[${i}][${j}] = max(dp[${i - 1}][${j}], dp[${i}][${j - 1}])`),
      es: igual ? `\`a[${i - 1}]\` = ${a[i - 1]} y \`b[${j - 1}]\` = ${b[j - 1]} coinciden: se extiende la diagonal.` : `\`a[${i - 1}]\` = ${a[i - 1]} y \`b[${j - 1}]\` = ${b[j - 1]} difieren: se mira arriba e izquierda.`,
      en: igual ? `\`a[${i - 1}]\` = ${a[i - 1]} and \`b[${j - 1}]\` = ${b[j - 1]} match: extend the diagonal.` : `\`a[${i - 1}]\` = ${a[i - 1]} and \`b[${j - 1}]\` = ${b[j - 1]} differ: look above and left.`,
    }, { ...hechas(hs), ...Object.fromEntries(lee.map(([r, c]) => [llave(r, c), 'lee'])), [k]: 'activa' });
    dp[i][j] = igual ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]); hs.add(k);
    rec.emit({
      line: igual ? 7 : 9, val: { [k]: dp[i][j] }, deps: null,
      formula: fm(igual ? `dp[${i}][${j}] = ${dp[i - 1][j - 1]} + 1 = ${dp[i][j]}` : `dp[${i}][${j}] = max(${dp[i - 1][j]}, ${dp[i][j - 1]}) = ${dp[i][j]}`),
      es: `\`dp[${i}][${j}]\` = ${dp[i][j]}.`, en: `\`dp[${i}][${j}]\` = ${dp[i][j]}.`,
    }, hechas(hs));
  }
  return { frames: rec.fr, dp };
}

/** Vuelta atrás de la LCS: celdas visitadas, pasos (coincidencia o dirección) y la subsecuencia. Desempate: arriba si empata. */
export function caminoLCS(a, b, dp = tablaLCS(a, b)) {
  let i = a.length, j = b.length, sub = '';
  const celdas = [[i, j]], pasos = [];
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pasos.push({ i, j, tipo: 'coincide', letra: a[i - 1] }); sub = a[i - 1] + sub; i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) { pasos.push({ i, j, tipo: 'arriba' }); i--; }
    else { pasos.push({ i, j, tipo: 'izq' }); j--; }
    celdas.push([i, j]);
  }
  return { celdas, pasos, sub };
}
/** Todas las subsecuencias comunes de longitud máxima (conjunto de cadenas). */
export function todasLCS(a, b) {
  const dp = tablaLCS(a, b), memo = new Map();
  const f = (i, j) => {
    if (i === 0 || j === 0) return new Set(['']);
    const k = i + ',' + j; if (memo.has(k)) return memo.get(k);
    let r = new Set();
    if (a[i - 1] === b[j - 1]) for (const s of f(i - 1, j - 1)) r.add(s + a[i - 1]);
    else { if (dp[i - 1][j] >= dp[i][j - 1]) for (const s of f(i - 1, j)) r.add(s); if (dp[i][j - 1] >= dp[i - 1][j]) for (const s of f(i, j - 1)) r.add(s); }
    memo.set(k, r); return r;
  };
  return [...f(a.length, b.length)].sort();
}
export function lcsCaminoTraza(a = A_LCS, b = B_LCS) {
  const dp = tablaLCS(a, b), { celdas, pasos, sub } = caminoLCS(a, b, dp), rec = new Rec(todas(dp));
  const visit = [], filas = [], cols = [];
  celdas.forEach(([i, j], k) => {
    visit.push(llave(i, j));
    const p = pasos[k - 1], fin = k === celdas.length - 1;
    let es, en, line = 4;
    if (k === 0) { es = `Se empieza en \`dp[${i}][${j}]\` = ${dp[i][j]}: la longitud de la LCS.`; en = `Start at \`dp[${i}][${j}]\` = ${dp[i][j]}: the length of the LCS.`; line = 2; }
    else if (p.tipo === 'coincide') {
      filas.push(p.i); cols.push(p.j); line = 4;
      es = `\`a[${p.i - 1}]\` = \`b[${p.j - 1}]\` = ${p.letra}: la letra entra en la subsecuencia. Diagonal.`; en = `\`a[${p.i - 1}]\` = \`b[${p.j - 1}]\` = ${p.letra}: the letter is in the subsequence. Diagonal.`;
    } else if (p.tipo === 'arriba') { line = 5; es = 'No coinciden y arriba vale lo mismo o más: se sube.'; en = 'No match and the cell above is at least as large: move up.'; }
    else { line = 6; es = 'No coinciden y la izquierda vale más: se va a la izquierda.'; en = 'No match and the left cell is larger: move left.'; }
    if (fin) { es += ` Se invierte lo recogido: «${sub}».`; en += ` The collected letters are reversed: «${sub}».`; line = 8; }
    rec.emit({ line, marcas: { i: { fila: i }, j: { col: j } }, resaltar: { filas: [...filas], cols: [...cols] }, es, en },
      { ...todas(dp), ...Object.fromEntries(visit.map(x => [x, 'camino'])) });
  });
  return { frames: rec.fr, dp, sub, celdas, pasos };
}

// ── 4. Distancia de edición ────────────────────────────────────────────────────────────────────────────────────────
export const A_ED = 'kitten', B_ED = 'sitting';
export function tablaEdicion(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
  return dp;
}
export const bordeEdicion = (a, b) => Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : null)));
const NOMBRE_ED = { diag: ['sustituir o igualar', 'substituting or matching'], borrar: ['borrar', 'deleting'], insertar: ['insertar', 'inserting'] };
export function edicionTraza(a = A_ED, b = B_ED) {
  const n = a.length, m = b.length, dp = bordeEdicion(a, b).map(f => f.map(x => x ?? 0));
  const hs = new Set([...Array.from({ length: n + 1 }, (_, i) => llave(i, 0)), ...Array.from({ length: m + 1 }, (_, j) => llave(0, j))]), rec = new Rec(hechas(hs));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const c = a[i - 1] !== b[j - 1] ? 1 : 0, k = llave(i, j);
    const opc = [['diag', dp[i - 1][j - 1] + c], ['borrar', dp[i - 1][j] + 1], ['insertar', dp[i][j - 1] + 1]];
    const mejor = opc.reduce((x, y) => (y[1] < x[1] ? y : x));
    rec.emit({
      line: 8, marcas: { i: { fila: i }, j: { col: j } }, deps: [[i - 1, j, i, j], [i, j - 1, i, j], [i - 1, j - 1, i, j]],
      formula: fm(`dp[${i}][${j}] = min(${dp[i - 1][j]}+1, ${dp[i][j - 1]}+1, ${dp[i - 1][j - 1]}+${c})`),
      es: `\`a[${i - 1}]\` = ${a[i - 1]}, \`b[${j - 1}]\` = ${b[j - 1]}: ${c ? 'distintas, sustituir cuesta 1' : 'iguales, la diagonal no cuesta nada'}. Se compara borrar, insertar y sustituir.`,
      en: `\`a[${i - 1}]\` = ${a[i - 1]}, \`b[${j - 1}]\` = ${b[j - 1]}: ${c ? 'different, substituting costs 1' : 'equal, the diagonal is free'}. Delete, insert and substitute are compared.`,
    }, { ...hechas(hs), [llave(i - 1, j)]: 'lee', [llave(i, j - 1)]: 'lee', [llave(i - 1, j - 1)]: 'lee', [k]: 'activa' });
    dp[i][j] = mejor[1]; hs.add(k);
    rec.emit({
      line: 8, val: { [k]: dp[i][j] }, deps: null, formula: fm(`dp[${i}][${j}] = ${dp[i][j]}`),
      es: `Gana ${NOMBRE_ED[mejor[0]][0]}: \`dp[${i}][${j}]\` = ${dp[i][j]}.`, en: `The best is ${NOMBRE_ED[mejor[0]][1]}: \`dp[${i}][${j}]\` = ${dp[i][j]}.`,
    }, hechas(hs));
  }
  return { frames: rec.fr, dp };
}
/** Vuelta atrás de la distancia de edición: celdas, pasos (en orden de recorrido) y operaciones en orden de la cadena. */
export function caminoEdicion(a, b, dp = tablaEdicion(a, b)) {
  let i = a.length, j = b.length;
  const celdas = [[i, j]], pasos = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0)) {
      pasos.push({ tipo: a[i - 1] === b[j - 1] ? 'igual' : 'sustituir', de: a[i - 1], a: b[j - 1], i, j }); i--; j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { pasos.push({ tipo: 'borrar', de: a[i - 1], i, j }); i--; }
    else { pasos.push({ tipo: 'insertar', a: b[j - 1], i, j }); j--; }
    celdas.push([i, j]);
  }
  const ops = [...pasos].reverse();
  return { celdas, pasos, ops, total: ops.filter(o => o.tipo !== 'igual').length };
}
/** Aplica las operaciones (en orden de la cadena) a `a`: debe dar `b`. */
export function aplicarOps(a, ops) {
  let ia = 0, out = '';
  for (const o of ops) {
    if (o.tipo === 'igual') { if (a[ia] !== o.de) throw new Error('igual: letra distinta'); out += a[ia++]; }
    else if (o.tipo === 'sustituir') { if (a[ia] !== o.de) throw new Error('sustituir: letra distinta'); out += o.a; ia++; }
    else if (o.tipo === 'borrar') { if (a[ia] !== o.de) throw new Error('borrar: letra distinta'); ia++; }
    else out += o.a;
  }
  if (ia !== a.length) throw new Error('quedan letras sin tratar');
  return out;
}
/** Texto de las operaciones sin las que no cambian nada, p. ej. «k→s, e→i, +g». */
export const textoOps = ops => ops.filter(o => o.tipo !== 'igual').map(o => (o.tipo === 'sustituir' ? `${o.de}→${o.a}` : o.tipo === 'borrar' ? `−${o.de}` : `+${o.a}`)).join(', ');
export function edicionCaminoTraza(a = A_ED, b = B_ED) {
  const dp = tablaEdicion(a, b), cam = caminoEdicion(a, b, dp), rec = new Rec(todas(dp)), visit = [];
  cam.celdas.forEach(([i, j], k) => {
    visit.push(llave(i, j));
    const p = cam.pasos[k - 1];
    let es, en, line = 2;
    if (k === 0) { line = 1; es = `Se empieza en \`dp[${i}][${j}]\` = ${dp[i][j]}: la distancia total.`; en = `Start at \`dp[${i}][${j}]\` = ${dp[i][j]}: the total distance.`; }
    else if (p.tipo === 'igual') { es = `Letras iguales (${p.de}): coste 0, diagonal.`; en = `Equal letters (${p.de}): cost 0, diagonal.`; }
    else if (p.tipo === 'sustituir') { es = `Sustituir ${p.de} por ${p.a}: coste 1, diagonal.`; en = `Substitute ${p.de} with ${p.a}: cost 1, diagonal.`; }
    else if (p.tipo === 'borrar') { line = 3; es = `Borrar ${p.de}: coste 1, se sube.`; en = `Delete ${p.de}: cost 1, move up.`; }
    else { line = 4; es = `Insertar ${p.a}: coste 1, se va a la izquierda.`; en = `Insert ${p.a}: cost 1, move left.`; }
    rec.emit({ line, marcas: { i: { fila: i }, j: { col: j } }, es, en }, { ...todas(dp), ...Object.fromEntries(visit.map(x => [x, 'camino'])) });
  });
  return { frames: rec.fr, dp, ...cam };
}

// ── 5. Cambio de monedas ───────────────────────────────────────────────────────────────────────────────────────────
/** Mínimo de monedas para cada cantidad 0..T (INF = T+1 si no se puede; aquí siempre hay moneda 1). */
export function dpMonedas(m, T) {
  const INF = T + 1, dp = Array(T + 1).fill(INF); dp[0] = 0;
  for (let c = 1; c <= T; c++) for (const x of m) if (x <= c) dp[c] = Math.min(dp[c], dp[c - x] + 1);
  return dp.map(x => (x >= INF ? null : x));
}
/** Nº de monedas del algoritmo voraz (siempre la mayor posible), o null si se queda sin poder completar. */
export function vorazMonedas(m, T) {
  let resto = T, n = 0;
  for (const x of [...m].sort((a, b) => b - a)) { n += Math.floor(resto / x); resto %= x; }
  return resto === 0 ? n : null;
}
export const filaVoraz = (m, T) => Array.from({ length: T + 1 }, (_, c) => vorazMonedas(m, c));
/** Tabla de 2 filas (DP y voraz) × T+1 para los conjuntos de monedas. */
export const tablaMonedas = (m, T) => [dpMonedas(m, T), filaVoraz(m, T)];
export const mapaMal = (dp, vz) => Object.fromEntries(dp.map((x, c) => (vz[c] !== x ? [llave(1, c), 'mal'] : null)).filter(Boolean));

export function monedasTraza(m = [1, 3, 4], T = 12) {
  const vz = filaVoraz(m, T), dp = Array(T + 1).fill(null); dp[0] = 0;
  const hs = new Set([llave(0, 0)]), mal = {}, rec = new Rec({ [llave(0, 0)]: 'hecha' });
  const INF = T + 1, tmp = Array(T + 1).fill(INF); tmp[0] = 0;
  const lista = xs => xs.join(', ');
  for (let c = 1; c <= T; c++) {
    const usa = m.filter(x => x <= c);
    const k = llave(0, c);
    rec.emit({
      line: 7, marcas: { c: { col: c } }, deps: usa.map(x => [0, c - x, 0, c]),
      formula: fm(`dp[${c}] = 1 + min(${usa.map(x => `dp[${c - x}]`).join(', ')})`),
      es: `Para sumar ${c}: se prueba cada moneda x ≤ ${c} (${lista(usa)}) como la última y se mira \`dp[${c} - x]\`.`,
      en: `To make ${c}: each coin x ≤ ${c} (${lista(usa)}) is tried as the last one, looking at \`dp[${c} - x]\`.`,
    }, { ...hechas(hs), ...mal, ...Object.fromEntries(usa.map(x => [llave(0, c - x), 'lee'])), [k]: 'activa' });
    for (const x of usa) tmp[c] = Math.min(tmp[c], tmp[c - x] + 1);
    dp[c] = tmp[c]; hs.add(k);
    const mejorX = usa.find(x => tmp[c - x] + 1 === dp[c]);
    const dif = vz[c] !== dp[c];
    if (dif) mal[llave(1, c)] = 'mal';
    rec.emit({
      line: 8, val: { [k]: dp[c] }, deps: null, formula: fm(`dp[${c}] = 1 + min(${usa.map(x => tmp[c - x]).join(', ')}) = ${dp[c]}`),
      es: `Mejor última moneda: ${mejorX}. \`dp[${c}]\` = ${dp[c]}.${dif ? ` El voraz daba ${vz[c]}: se queda corto.` : ''}`,
      en: `Best last coin: ${mejorX}. \`dp[${c}]\` = ${dp[c]}.${dif ? ` Greedy gave ${vz[c]}: it falls short.` : ''}`,
    }, { ...hechas(hs), ...mal });
  }
  return { frames: rec.fr, dp, vz, mal };
}

/** Tabla de formas de sumar c con las k primeras monedas: dp[k][c] = dp[k-1][c] + dp[k][c-x]. Fila 0: [1,0,0…]. */
export function formasTabla(m, T) {
  const dp = Array.from({ length: m.length + 1 }, () => Array(T + 1).fill(0)); dp[0][0] = 1;
  for (let k = 1; k <= m.length; k++) for (let c = 0; c <= T; c++) dp[k][c] = dp[k - 1][c] + (c >= m[k - 1] ? dp[k][c - m[k - 1]] : 0);
  return dp;
}
export const cabFormas = (m, T) => ({ filas: ['—', ...m.map(x => `mon ${x}`)], cols: Array.from({ length: T + 1 }, (_, c) => String(c)), esq: 'k\\c' });
/** Permutaciones (el orden importa): bucle de cantidades por fuera. */
export function permutaciones(m, T) {
  const f = Array(T + 1).fill(0); f[0] = 1;
  for (let c = 1; c <= T; c++) for (const x of m) if (x <= c) f[c] += f[c - x];
  return f[T];
}
export function formasTraza(m = [1, 2, 5], T = 7) {
  const K = m.length, dp = Array.from({ length: K + 1 }, () => Array(T + 1).fill(0)); dp[0][0] = 1;
  const hs = new Set(fila0(T + 1)), rec = new Rec(hechas(hs));
  for (let k = 1; k <= K; k++) for (let c = 0; c <= T; c++) {
    const x = m[k - 1], cabe = c >= x, kk = llave(k, c), lee = cabe ? [[k - 1, c], [k, c - x]] : [[k - 1, c]];
    rec.emit({
      line: 6, marcas: { k: { fila: k }, c: { col: c } }, deps: lee.map(([r, q]) => [r, q, k, c]),
      formula: fm(cabe ? `dp[${k}][${c}] = dp[${k - 1}][${c}] + dp[${k}][${c - x}]` : `dp[${k}][${c}] = dp[${k - 1}][${c}]`),
      es: cabe ? `Sumar ${c} con las monedas hasta la de ${x}: sin usarla (arriba) más usándola al menos una vez (izquierda, ${c - x}).` : `La moneda ${x} es mayor que ${c}: no puede usarse, se copia la celda de arriba.`,
      en: cabe ? `Making ${c} with the coins up to ${x}: without it (above) plus using it at least once (left, ${c - x}).` : `Coin ${x} is larger than ${c}: it cannot be used, the cell above is copied.`,
    }, { ...hechas(hs), ...Object.fromEntries(lee.map(([r, q]) => [llave(r, q), 'lee'])), [kk]: 'activa' });
    dp[k][c] = dp[k - 1][c] + (cabe ? dp[k][c - x] : 0); hs.add(kk);
    rec.emit({ line: 6, val: { [kk]: dp[k][c] }, deps: null, formula: fm(`dp[${k}][${c}] = ${dp[k][c]}`), es: `\`dp[${k}][${c}]\` = ${dp[k][c]}.`, en: `\`dp[${k}][${c}]\` = ${dp[k][c]}.` }, hechas(hs));
  }
  return { frames: rec.fr, dp, total: dp[K][T] };
}

// ── 6. LIS ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const V_LIS = [3, 1, 4, 1, 5, 9, 2, 6];
/** LIS en O(n²): dp[i] = mayor subsecuencia creciente que TERMINA en i; ant[i] = el j que dio el máximo (o -1). */
export function lisN2(v) {
  const dp = Array(v.length).fill(1), ant = Array(v.length).fill(-1);
  for (let i = 0; i < v.length; i++) for (let j = 0; j < i; j++) if (v[j] < v[i] && dp[j] + 1 > dp[i]) { dp[i] = dp[j] + 1; ant[i] = j; }
  const mejor = v.length ? Math.max(...dp) : 0, fin = dp.indexOf(mejor);
  const idx = []; for (let i = fin; i >= 0 && v.length; i = ant[i]) idx.unshift(i);
  return { dp, ant, mejor, idx, seq: idx.map(i => v[i]) };
}
export function lisTraza(v = V_LIS) {
  const dp = Array(v.length).fill(1), hs = new Set(), rec = new Rec({});
  for (let i = 0; i < v.length; i++) {
    const js = []; for (let j = 0; j < i; j++) if (v[j] < v[i]) js.push(j);
    const k = llave(1, i);
    rec.emit({
      line: js.length ? 7 : 4, marcas: { i: { col: i } }, resaltar: { cols: [i] }, deps: js.map(j => [1, j, 1, i]),
      formula: fm(js.length ? `dp[${i}] = 1 + max(${js.map(j => `dp[${j}]`).join(', ')})` : `dp[${i}] = 1`),
      es: js.length ? `\`v[${i}]\` = ${v[i]}: los anteriores menores son ${js.map(j => v[j]).join(', ')}. Se alarga la mejor de sus subsecuencias.` : `\`v[${i}]\` = ${v[i]}: ningún anterior es menor. Solo puede empezar de cero: vale 1.`,
      en: js.length ? `\`v[${i}]\` = ${v[i]}: the smaller earlier ones are ${js.map(j => v[j]).join(', ')}. The best of their subsequences is extended.` : `\`v[${i}]\` = ${v[i]}: no earlier element is smaller. It can only start fresh: it is 1.`,
    }, { ...hechas(hs), ...Object.fromEntries(js.map(j => [llave(1, j), 'lee'])), [k]: 'activa' });
    for (const j of js) dp[i] = Math.max(dp[i], dp[j] + 1);
    hs.add(k);
    rec.emit({ line: 8, val: { [k]: dp[i] }, deps: null, es: `\`dp[${i}]\` = ${dp[i]}.`, en: `\`dp[${i}]\` = ${dp[i]}.` }, hechas(hs));
  }
  return { frames: rec.fr, dp, mejor: Math.max(...dp) };
}
/** LIS en O(n log n): cola[k] = menor final de una creciente de largo k+1; lower_bound = primer índice con cola[idx] >= x. */
export function lisCola(v) {
  const cola = [];
  for (const x of v) {
    let lo = 0, hi = cola.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cola[mid] < x) lo = mid + 1; else hi = mid; }
    if (lo === cola.length) cola.push(x); else cola[lo] = x;
  }
  return cola;
}
export function lisColaTraza(v = V_LIS) {
  const cola = [], rec = new Rec({});
  const vivas = () => Object.fromEntries(cola.map((_, k) => [llave(0, k), 'hecha']));
  for (const x of v) {
    let lo = 0, hi = cola.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cola[mid] < x) lo = mid + 1; else hi = mid; }
    const alarga = lo === cola.length;
    rec.emit({
      line: 3, marcas: { p: { col: lo } }, deps: null, formula: fm(`x = ${x}: lower_bound en la posición ${lo}`),
      es: `x = ${x}: la búsqueda binaria da la posición ${lo}, el primer final que no es menor que ${x}.`, en: `x = ${x}: binary search gives position ${lo}, the first end that is not smaller than ${x}.`,
    }, { ...vivas(), [llave(0, lo)]: 'activa' });
    if (alarga) cola.push(x); else cola[lo] = x;
    rec.emit({
      line: alarga ? 4 : 5, val: { [llave(0, lo)]: x }, deps: null, formula: fm(`cola = [${cola.join(', ')}]`),
      es: alarga ? `Ningún final lo supera: la cola se alarga con ${x}.` : `Se mejora el final ${lo + 1}: ahora es ${x}, más pequeño o igual y más fácil de extender.`,
      en: alarga ? `No end exceeds it: the queue grows with ${x}.` : `End number ${lo + 1} is improved: it becomes ${x}, smaller or equal and easier to extend.`,
    }, vivas());
  }
  return { frames: rec.fr, cola };
}

// ── Lógica de los bloques `jugar` (puras sobre la vista `v` de tabla.js) ───────────────────────────────────────────
const TEMP = new Set(['activa', 'lee', 'mal', 'elegida']);
/** Quita estados temporales, flechas, marcas y fórmula; toda celda con valor queda `hecha`. */
export function limpiarTemp(v) {
  for (const k of Object.keys(v.est)) if (TEMP.has(v.est[k])) delete v.est[k];
  v.val.forEach((f, r) => f.forEach((x, c) => { if (x !== null) estado(v, r, c, 'hecha'); }));
  v.deps = []; v.marcas = {}; v.resaltar = { filas: [], cols: [] }; v.formula = null;
  return v;
}
const TXT_BASE = { es: 'Fila 0: caso base, vale 0.', en: 'Row 0: base case, it is 0.' };

/** Mochila (jugar): elegir la celda (r,c). Marca las celdas que lee y prepara la fórmula. */
export function elegirMochila(v, r, c, items = ITEMS) {
  limpiarTemp(v); v.sel = [r, c]; v.msg = null;
  estado(v, r, c, 'activa'); v.marcas = { i: { fila: r }, w: { col: c } };
  if (r === 0) { v.formula = TXT_BASE; v.msg = { k: 'base' }; return v; }
  const { p, v: val } = items[r - 1];
  for (const [i, w] of leeMochila(items, r, c)) { estado(v, i, w, leer(v, i, w) === null ? 'mal' : 'lee'); v.deps.push([i, w, r, c]); }
  v.formula = fm(c >= p ? `dp[${r}][${c}] = max(dp[${r - 1}][${c}], dp[${r - 1}][${c - p}] + ${val})` : `dp[${r}][${c}] = dp[${r - 1}][${c}]  (no cabe)`);
  if (leer(v, r, c) !== null) v.msg = { k: 'hecha' };
  return v;
}
/** Mochila (jugar): decide 'coger' o 'noCoger' para la celda elegida; si acierta la rellena, si no la marca `mal`. */
export function decidirMochila(v, opcion, items = ITEMS) {
  if (!v.sel) return v;
  const [r, c] = v.sel;
  if (r === 0 || leer(v, r, c) !== null) return v;
  const { p, v: val } = items[r - 1], cabe = c >= p;
  const arriba = leer(v, r - 1, c), izq = cabe ? leer(v, r - 1, c - p) : null;
  if (arriba === null || (cabe && izq === null)) { v.msg = { k: 'falta' }; return v; }
  const no = arriba, si = cabe ? izq + val : null, mejor = cabe ? Math.max(no, si) : no;
  const elegido = opcion === 'coger' ? si : no, ok = elegido !== null && elegido === mejor;
  limpiarTemp(v); v.sel = [r, c];
  v.marcas = { i: { fila: r }, w: { col: c } };
  if (ok) { poner(v, r, c, mejor); estado(v, r, c, 'hecha'); v.msg = { k: 'ok', valor: mejor, opcion, empate: cabe && no === si }; v.formula = fm(`dp[${r}][${c}] = ${cabe ? `max(${no}, ${si})` : no} = ${mejor}`); }
  else { estado(v, r, c, 'mal'); v.msg = { k: 'mal', opcion, razon: elegido === null ? 'nocabe' : 'menor' }; }
  return v;
}
/** Rellena todas las celdas con los valores correctos. */
export function autoRellenar(v, dp) {
  dp.forEach((f, r) => f.forEach((x, c) => poner(v, r, c, x)));
  limpiarTemp(v); v.sel = null; v.msg = { k: 'auto' };
  return v;
}
/** Capacidad (jugar sobre la tabla completa): muestra dp[n][W] y el camino de objetos. */
export function fijarCapacidad(v, W, items = ITEMS, cap = CAP) {
  W = Math.max(0, Math.min(cap, Math.round(W))); v.W = W;
  const dp = tablaMochila(items, cap), cam = caminoMochila(dp, items, W);
  v.est = { ...todas(dp), ...Object.fromEntries(cam.celdas.map(([i, w]) => [llave(i, w), 'camino'])) };
  v.marcas = { W: { col: W } }; v.resaltar = { filas: [], cols: [W] }; v.deps = [];
  v.formula = fm(`dp[${items.length}][${W}] = ${dp[items.length][W]}`);
  v.cam = cam;
  return v;
}

/** LCS (jugar): elegir la celda (r,c); marca las letras (resaltar), las celdas leídas y las flechas. */
export function elegirLCS(v, r, c, a = A_LCS, b = B_LCS) {
  limpiarTemp(v); v.sel = [r, c]; v.msg = null; v.g = 0;
  estado(v, r, c, 'activa'); v.marcas = { i: { fila: r }, j: { col: c } }; v.resaltar = { filas: [r], cols: [c] };
  if (r === 0 || c === 0) { v.formula = { es: '`dp[i][0] = dp[0][j] = 0`  (caso base)', en: '`dp[i][0] = dp[0][j] = 0`  (base case)' }; v.msg = { k: 'base' }; return v; }
  for (const [i, j] of leeLCS(a, b, r, c)) { estado(v, i, j, leer(v, i, j) === null ? 'mal' : 'lee'); v.deps.push([i, j, r, c]); }
  const igual = a[r - 1] === b[c - 1];
  v.formula = fm(igual ? `${a[r - 1]} = ${b[c - 1]}:  dp[${r}][${c}] = dp[${r - 1}][${c - 1}] + 1` : `${a[r - 1]} ≠ ${b[c - 1]}:  dp[${r}][${c}] = max(dp[${r - 1}][${c}], dp[${r}][${c - 1}])`);
  if (leer(v, r, c) !== null) { v.msg = { k: 'hecha' }; v.g = leer(v, r, c); }
  return v;
}
export function ajustarValor(v, d) { if (v.sel && leer(v, v.sel[0], v.sel[1]) === null) v.g = Math.max(0, Math.min(9, (v.g ?? 0) + d)); return v; }
/** LCS (jugar): comprueba el valor propuesto (`v.g`) contra la tabla real. */
export function comprobarLCS(v, a = A_LCS, b = B_LCS, dp = tablaLCS(a, b)) {
  if (!v.sel) return v;
  const [r, c] = v.sel;
  if (r === 0 || c === 0 || leer(v, r, c) !== null) return v;
  for (const [i, j] of leeLCS(a, b, r, c)) if (leer(v, i, j) === null) { v.msg = { k: 'falta' }; return v; }
  const g = v.g ?? 0, ok = g === dp[r][c];
  limpiarTemp(v); v.sel = [r, c]; v.g = g; v.marcas = { i: { fila: r }, j: { col: c } };
  if (ok) { poner(v, r, c, g); estado(v, r, c, 'hecha'); v.msg = { k: 'ok', valor: g }; v.resaltar = { filas: [r], cols: [c] }; }
  else { estado(v, r, c, 'mal'); v.msg = { k: 'mal', valor: g }; }
  return v;
}

/** Monedas (jugar): conjunto, objetivo y filas DP / voraz. Las celdas en que difieren se marcan `mal`. */
export function aplicarMonedas(v, conjunto, T, cols = 13) {
  T = Math.max(0, Math.min(cols - 1, Math.round(T)));
  v.set = conjunto; v.T = T;
  const [dp, vz] = tablaMonedas(conjunto, cols - 1);
  dp.forEach((x, c) => { poner(v, 0, c, x); poner(v, 1, c, vz[c]); });
  v.est = { ...hechas(dp.map((_, c) => llave(0, c))), ...mapaMal(dp, vz) };
  v.marcas = { T: { col: T } }; v.resaltar = { filas: [], cols: [T] }; v.deps = [];
  v.formula = fm(`T = ${T}:  DP = ${dp[T]},  voraz = ${vz[T]}`);
  return v;
}
