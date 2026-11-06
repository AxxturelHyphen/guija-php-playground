// Guía demo de la escena «barras» (formato de parches en assets/guias/barras.js). Ejercita TODAS las funciones:
// barras (cajas y aux), intercambiar, poner, arr, aux, marcas, rango, est, cont, traza generada y jugar con arrastre.
// Las trazas se calculan aquí ejecutando el algoritmo y emitiendo frames; se exportan para probarlas en Node.
import { mover, reponer, ordenado } from '../barras.js';

const ET_BURB = { comparaciones: { es: 'comparaciones', en: 'comparisons' }, intercambios: { es: 'intercambios', en: 'swaps' } };

/** Parche `est` mínimo para pasar de `prev` a `next` (mapas {índice: estado}); los que desaparecen van a null. */
const difEst = (prev, next) => {
  const d = {};
  for (const k of Object.keys(prev)) if (!(k in next)) d[k] = null;
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) d[k] = v;
  return d;
};

// ── Burbuja: compara vecinos y los cruza si están al revés; tras cada pasada el mayor queda al final ──
const C_BURB = (c1) => `void ${c1[0]}(int a[], int n) {   // ${c1[1]}
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                swap(a[j], a[j + 1]);
            }
        }
    }
}`;

export function trazaBurbuja(a0) {
  const a = [...a0], n = a.length, fr = [], ok = {};
  let cmp = 0, sw = 0, est = {};
  const emite = (f, nuevo) => { fr.push({ ...f, est: difEst(est, nuevo) }); est = nuevo; };
  const cont = () => ({ comparaciones: cmp, intercambios: sw });
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      cmp++;
      emite({
        line: 4, marcas: { j }, cont: cont(),
        es: `Compara \`a[${j}]\` = ${a[j]} con \`a[${j + 1}]\` = ${a[j + 1]}.`, en: `Compare \`a[${j}]\` = ${a[j]} with \`a[${j + 1}]\` = ${a[j + 1]}.`,
      }, { ...ok, [j]: 'cmp', [j + 1]: 'cmp' });
      if (a[j] > a[j + 1]) {
        const [x, y] = [a[j], a[j + 1]];
        [a[j], a[j + 1]] = [y, x]; sw++;
        emite({
          line: 5, intercambiar: [j, j + 1], cont: cont(),
          es: `${x} > ${y}: están al revés, se intercambian.`, en: `${x} > ${y}: out of order, swap them.`,
        }, { ...ok, [j]: 'sel', [j + 1]: 'sel' });
      }
    }
    ok[n - 1 - i] = 'ok';
    emite({
      line: 7, marcas: { j: null },
      es: `Fin de la pasada: \`a[${n - 1 - i}]\` = ${a[n - 1 - i]} ya está en su sitio.`, en: `End of the pass: \`a[${n - 1 - i}]\` = ${a[n - 1 - i]} is already in place.`,
    }, { ...ok });
  }
  ok[0] = 'ok';
  emite({ line: 9, es: 'Solo queda un elemento sin ordenar: ya está todo en su sitio.', en: 'Only one element is left: everything is in place.' }, { ...ok });
  return fr;
}

// ── Merge de dos mitades ordenadas con fila auxiliar ──────────────────────────────────────────────
const C_MERGE = (c1) => `void merge(int a[], int aux[], int lo, int mid, int hi) {   // ${c1}
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
        if (a[i] <= a[j]) aux[k++] = a[i++];
        else              aux[k++] = a[j++];
    }
    while (i <= mid) aux[k++] = a[i++];
    while (j <= hi)  aux[k++] = a[j++];
    for (k = lo; k <= hi; k++) a[k] = aux[k];
}`;

/** Mezcla a0[lo..mid] y a0[mid+1..hi] (ya ordenadas) pasando por aux; parte de marcas {i:lo, j:mid+1}. */
export function trazaMerge(a0, lo, mid, hi) {
  const a = [...a0], aux = Array(a.length).fill(null), fr = [];
  let i = lo, j = mid + 1, k = lo, cmp = 0, cop = 0, est = {};
  const cont = () => ({ comparaciones: cmp, copias: cop });
  const emite = (f, nuevo = est) => { fr.push({ ...f, est: difEst(est, nuevo) }); est = nuevo; };
  const copia = (de, line, txtEs, txtEn) => {
    aux[k] = a[de]; cop++;
    const m = de === i ? { i: ++i > mid ? null : i } : { j: ++j > hi ? null : j };
    emite({ line, aux: { [k]: aux[k] }, marcas: m, cont: cont(), es: txtEs, en: txtEn }, { [de]: 'sel' });
    k++;
  };
  while (i <= mid && j <= hi) {
    cmp++;
    emite({ line: 3, cont: cont(), es: `Compara \`a[${i}]\` = ${a[i]} con \`a[${j}]\` = ${a[j]}.`, en: `Compare \`a[${i}]\` = ${a[i]} with \`a[${j}]\` = ${a[j]}.` }, { [i]: 'cmp', [j]: 'cmp' });
    if (a[i] <= a[j]) copia(i, 4, `${a[i]} es menor o igual: pasa a \`aux[${k}]\`.`, `${a[i]} is smaller or equal: it goes to \`aux[${k}]\`.`);
    else copia(j, 5, `${a[j]} es menor: pasa a \`aux[${k}]\`.`, `${a[j]} is smaller: it goes to \`aux[${k}]\`.`);
  }
  while (i <= mid) copia(i, 7, `Sobra la mitad izquierda: \`a[${i}]\` = ${a[i]} pasa a \`aux[${k}]\`.`, `Left half leftover: \`a[${i}]\` = ${a[i]} goes to \`aux[${k}]\`.`);
  while (j <= hi) copia(j, 8, `Sobra la mitad derecha: \`a[${j}]\` = ${a[j]} pasa a \`aux[${k}]\`.`, `Right half leftover: \`a[${j}]\` = ${a[j]} goes to \`aux[${k}]\`.`);
  for (k = lo; k <= hi; k++) {
    a[k] = aux[k]; aux[k] = null;
    emite({ line: 9, poner: { [k]: a[k] }, aux: { [k]: null }, es: `Devuelve ${a[k]} a \`a[${k}]\`.`, en: `Copy ${a[k]} back to \`a[${k}]\`.` }, { ...est, [k]: 'ok' });
  }
  return fr;
}

// ── Búsqueda binaria con lo / mid / hi (parte de marcas {lo:0, hi:n-1}, rango [0,n-1]) ──────────────
const C_BIN = (c1) => `int buscar(int a[], int n, int x) {   // ${c1}
    int lo = 0, hi = n - 1;
    while (lo <= hi) {
        int mid = (lo + hi) / 2;
        if (a[mid] == x) return mid;
        if (a[mid] < x) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`;

export function trazaBinaria(a, x) {
  const fr = [];
  let lo = 0, hi = a.length - 1, cmp = 0, est = {};
  const emite = (f, nuevo) => { fr.push({ ...f, est: difEst(est, nuevo) }); est = nuevo; };
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; cmp++;
    emite({
      line: 4, marcas: { mid }, cont: { comparaciones: cmp },
      es: `\`mid\` = (${lo} + ${hi}) / 2 = ${mid}; \`a[${mid}]\` = ${a[mid]}.`, en: `\`mid\` = (${lo} + ${hi}) / 2 = ${mid}; \`a[${mid}]\` = ${a[mid]}.`,
    }, { [mid]: 'cmp' });
    if (a[mid] === x) {
      emite({ line: 5, es: `${a[mid]} == ${x}: encontrado en la posición ${mid}.`, en: `${a[mid]} == ${x}: found at position ${mid}.` }, { [mid]: 'ok' });
      return fr;
    }
    const rango = (l, h) => (l <= h ? [l, h] : null);
    if (a[mid] < x) {
      lo = mid + 1;
      emite({ line: 6, marcas: { lo }, rango: rango(lo, hi), es: `${a[mid]} < ${x}: la mitad izquierda sobra, \`lo\` = ${lo}.`, en: `${a[mid]} < ${x}: drop the left half, \`lo\` = ${lo}.` }, {});
    } else {
      hi = mid - 1;
      emite({ line: 7, marcas: { hi }, rango: rango(lo, hi), es: `${a[mid]} > ${x}: la mitad derecha sobra, \`hi\` = ${hi}.`, en: `${a[mid]} > ${x}: drop the right half, \`hi\` = ${hi}.` }, {});
    }
  }
  emite({ line: 9, marcas: { mid: null }, es: `\`lo\` > \`hi\`: ${x} no está en el array.`, en: `\`lo\` > \`hi\`: ${x} is not in the array.` }, {});
  return fr;
}

// ── Datos de las escenas ─────────────────────────────────────────────────────────────────────────
export const A_BURB = [5, 1, 4, 2, 8, 3, 7];
export const A_MERGE = [3, 6, 8, 1, 2, 7];
export const A_BIN = [2, 5, 8, 12, 16, 23, 38, 56, 72];
export const X_BIN = 23;
const A_INTRO = [5, 2, 8, 1, 9, 3, 7, 4];
const A_JUGAR = [4, 2, 5, 1, 3];
const ordenada = a => [...a].sort((x, y) => x - y);
const todoOk = a => Object.fromEntries(a.map((_, i) => [i, 'ok']));
const FB = trazaBurbuja(A_BURB), contFinal = FB.findLast(f => f.cont).cont;

export default {
  titulo: { es: 'Demo barras', en: 'Bars demo' },
  pasos: [
    // ── Fundamentos de la escena ──
    {
      sec: { es: 'La escena', en: 'The scene' },
      barras: { arr: A_INTRO, etiquetas: true, etiquetasCont: ET_BURB },
      es: 'Cada **barra** es un elemento del array: su altura es proporcional al valor y el número de debajo es su índice.',
      en: 'Each **bar** is an array element: its height is proportional to the value and the number below is its index.',
    },
    {
      marcas: { i: 0, j: 1 }, est: { 0: 'cmp', 1: 'cmp' }, cont: { comparaciones: 1, intercambios: 0 },
      es: 'Los **punteros** `i` y `j` marcan posiciones bajo las barras. Las que se comparan llevan rayas amarillas y un cuadro en el valor.',
      en: 'The **pointers** `i` and `j` mark positions under the bars. Bars being compared get yellow stripes and a box around the value.',
    },
    {
      intercambiar: [0, 1], est: { 0: 'sel', 1: 'sel' }, cont: { intercambios: 1 },
      es: '`intercambiar` cruza dos barras. Las rojas con franjas y círculo son las que se acaban de mover; los contadores suben arriba a la derecha.',
      en: '`intercambiar` swaps two bars. The red striped ones with a circle just moved; the counters go up at the top right.',
    },
    {
      poner: { 3: 6 }, est: { 0: null, 1: null, 3: 'piv' }, marcas: { i: null, j: null, piv: 3 },
      es: '`poner` escribe un valor y la barra crece o encoge. Así se marca un **pivote**: azul con puntos y doble borde.',
      en: '`poner` writes a value and the bar grows or shrinks. This is how a **pivot** is marked: blue with dots and a double border.',
    },
    {
      rango: [2, 5], marcas: { piv: null, lo: 2, hi: 5 }, est: { 3: null, 2: 'ok', 5: 'ok' },
      es: 'El **rango** atenúa lo que queda fuera: ahora solo importan las posiciones `lo`..`hi`. El verde con subrayado indica «en su sitio».',
      en: 'The **range** dims whatever is outside: now only positions `lo`..`hi` matter. Green with an underline means «in place».',
    },
    {
      arr: A_INTRO, rango: null, marcas: null, est: null, cont: null,
      es: '`arr` reemplaza todos los valores de golpe y `est:null`, `marcas:null` y `cont:null` limpian el resto. Empecemos con un algoritmo.',
      en: '`arr` replaces every value at once, and `est:null`, `marcas:null` and `cont:null` clear the rest. Let us start with an algorithm.',
    },

    // ── Burbuja con traza generada ──
    {
      sec: { es: 'Burbuja', en: 'Bubble sort' },
      barras: { arr: A_BURB, etiquetas: true, etiquetasCont: ET_BURB },
      code: { es: C_BURB(['burbuja', 'ordena a[0..n-1]']), en: C_BURB(['bubbleSort', 'sorts a[0..n-1]']) }, line: 2,
      traza: FB,
      es: 'La **burbuja** compara vecinos y los cruza si están al revés. Tras cada pasada el mayor «sube» al final. Reproduce la traza.',
      en: '**Bubble sort** compares neighbours and swaps them if they are out of order. After each pass the largest one «floats» to the end. Play the trace.',
    },
    {
      arr: ordenada(A_BURB), est: todoOk(A_BURB), cont: contFinal, line: null,
      pregunta: {
        opc: [
          { es: 'Hace las mismas comparaciones, pero ningún intercambio.', en: 'It makes the same comparisons, but no swaps.', ok: true },
          { es: 'No compara nada: ya sabe que está ordenado.', en: 'It compares nothing: it already knows it is sorted.' },
          { es: 'Intercambia todos los pares igualmente.', en: 'It swaps every pair anyway.' },
        ],
        why: {
          es: 'Esta versión no se entera de que ya está ordenado: recorre igual `n(n-1)/2` pares, pero `a[j] > a[j+1]` nunca se cumple. Un `bool` «hubo intercambio» lo evita.',
          en: 'This version never notices it is already sorted: it still walks `n(n-1)/2` pairs, but `a[j] > a[j+1]` never holds. A «swapped» `bool` avoids that.',
        },
      },
      es: 'El array queda ordenado y los contadores suman todo el trabajo. Una pregunta rápida sobre este código.',
      en: 'The array ends up sorted and the counters add up all the work. A quick question about this code.',
    },

    // ── Merge con fila auxiliar ──
    {
      sec: { es: 'Merge con auxiliar', en: 'Merge with auxiliary row' },
      barras: { arr: A_MERGE, aux: A_MERGE.length, etiquetas: true, etiquetasCont: { comparaciones: { es: 'comparaciones', en: 'comparisons' }, copias: { es: 'copias', en: 'copies' } } },
      marcas: { i: 0, j: 3 }, rango: null,
      code: { es: C_MERGE('mezcla a[lo..mid] y a[mid+1..hi]'), en: C_MERGE('merges a[lo..mid] and a[mid+1..hi]') }, line: 2,
      traza: trazaMerge(A_MERGE, 0, 2, 5),
      es: 'El **merge** mezcla dos mitades ya ordenadas. Va copiando el menor de las dos cabezas (`i`, `j`) a la fila **aux** y al final lo devuelve a la principal.',
      en: '**Merge** combines two sorted halves. It copies the smaller of the two heads (`i`, `j`) into the **aux** row and finally copies it back to the main row.',
    },

    // ── Búsqueda binaria ──
    {
      sec: { es: 'Búsqueda binaria', en: 'Binary search' },
      barras: { arr: A_BIN, estilo: 'cajas', etiquetas: true, etiquetasCont: { comparaciones: { es: 'comparaciones', en: 'comparisons' } } },
      marcas: { lo: 0, hi: A_BIN.length - 1 }, rango: [0, A_BIN.length - 1], cont: { comparaciones: 0 },
      code: { es: C_BIN(`busca ${X_BIN} en a (ordenado)`), en: C_BIN(`looks for ${X_BIN} in sorted a`) }, line: 2,
      traza: trazaBinaria(A_BIN, X_BIN),
      es: `Con el array ordenado miramos el elemento del medio (\`mid\`) y descartamos la mitad que no puede contener el ${X_BIN}. Fuera de \`lo\`..\`hi\` se atenúa.`,
      en: `With a sorted array we look at the middle element (\`mid\`) and discard the half that cannot contain ${X_BIN}. Outside \`lo\`..\`hi\` is dimmed.`,
    },

    // ── Ordénalo tú ──
    {
      sec: { es: 'Ordénalo tú', en: 'Sort it yourself' },
      barras: { arr: A_JUGAR, etiquetas: true, etiquetasCont: { movimientos: { es: 'movimientos', en: 'moves' } } },
      code: '', line: null,
      jugar: {
        arrastrables: true,
        botones: [
          { label: { es: 'Mezclar', en: 'Shuffle' }, hacer: (v, cx) => { mover(v, cx.n - 1, 0); } },
          { label: { es: 'Ordenar', en: 'Sort' }, hacer: v => { v.arr.sort((x, y) => x - y); } },
          { label: { es: 'Reiniciar', en: 'Reset' }, hacer: (v, cx) => { reponer(v, cx.inicial); v.cont = {}; } },
        ],
        soltar: (v, desde, hasta) => { mover(v, desde, hasta); v.cont.movimientos = (v.cont.movimientos ?? 0) + 1; },
        lecturas: v => [{ expr: 'a', valor: v.arr.join(', ') }, { expr: 'sorted', valor: ordenado(v.arr) }],
        hl: v => (ordenado(v.arr) ? todoOk(v.arr) : {}),
      },
      es: 'Arrastra las barras (o enfoca una y usa las flechas) para dejarlas de menor a mayor: las demás se apartan para hacerte hueco. Al ordenarlas se ponen verdes.',
      en: 'Drag the bars (or focus one and use the arrow keys) to arrange them from smallest to largest: the others move aside to make room. They turn green once sorted.',
    },
  ],
};
