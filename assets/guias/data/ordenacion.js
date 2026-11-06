// Guía «Ordenación y búsqueda». Escenas: barras (casi todo), arbol (recursión de merge y árbol de decisión) y grafica.
// Formato de paso: ver data/punteros.js y la cabecera de assets/guias/barras.js. Las TRAZAS no se escriben a mano: las
// genera data/ordenacion-traza.js ejecutando cada algoritmo; las cifras de los textos y de las lecturas salen de ahí.
// Tras una traza el estado de la escena no persiste: el paso siguiente lo restaura con `fin(...)` si lo necesita.
import { mover, reponer, ordenado } from '../barras.js';
import { cabidaDe } from '../arbol.js';
import {
  CODIGO, ETIQ, ALGORITMOS, costes, datos, permutacion, minIntercambios, minArrastres, fueraDeCreciente, todosOk,
  trazaBurbuja, trazaInsercion, trazaSeleccion, trazaMergesort, trazaQuicksort, trazaLomuto, trazaHoare,
  trazaBinaria, trazaLimite, trazaDosPunteros, trazaVentana, trazaConteo,
} from './ordenacion-traza.js';

const lang = () => (globalThis.document?.documentElement.lang === 'en' ? 'en' : 'es');
const et = (...ks) => Object.fromEntries(ks.map(k => [k, ETIQ[k]]));
const barras = (arr, ks, o = {}) => ({ arr, etiquetas: true, etiquetasCont: et(...ks), ...o });
/** Parche que deja la escena como tras ejecutar la traza `r` (array ordenado, todo en verde, contadores finales). */
const fin = (r, extra = {}) => ({ arr: r.arr, est: todosOk(r.arr.length), marcas: null, rango: null, cont: r.cont, line: null, ...extra });
const miles = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ── Datos y trazas (todas se calculan aquí, ejecutando los generadores) ─────────────────────────────────────────
const A8 = [5, 2, 8, 1, 7, 3, 6, 4];
const CASI8 = [1, 2, 4, 3, 5, 6, 8, 7];
const ORD8 = [1, 2, 3, 4, 5, 6, 7, 8];
const Q10 = [7, 3, 9, 1, 6, 2, 8, 4, 10, 5];
const GRP = [21, 12, 23, 14, 25, 16]; // decena = grupo (clave), unidad = orden de llegada
const grupo = x => Math.floor(x / 10);
const CNT = [3, 7, 1, 3, 9, 2, 7, 3, 5, 1];
const BIN = [3, 8, 12, 15, 21, 27, 34, 41, 49, 56, 63, 72];
const DUP = [2, 4, 4, 4, 7, 9, 9, 12, 15, 15, 18, 21];
const DP = [1, 3, 4, 6, 8, 10, 13, 15, 19, 22];
const VEN = [2, 1, 5, 1, 3, 2, 6, 2, 4, 1];
const N_LAB = 8, N_CARRERA = 16;

const rBurb = trazaBurbuja(A8), rIns = trazaInsercion(A8), rInsCasi = trazaInsercion(CASI8), rSel = trazaSeleccion(A8);
const rMerge = trazaMergesort(A8);
const rLom = trazaLomuto(Q10), rQuick = trazaQuicksort(Q10), rHoare = trazaHoare(Q10);
const rPeor = trazaQuicksort(ORD8), rMed = trazaQuicksort(ORD8, { pivote: 'mediana3' });
const rInsG = trazaInsercion(GRP, { clave: grupo }), rSelG = trazaSeleccion(GRP, { clave: grupo });
const rCnt = trazaConteo(CNT, 10);
const rB1 = trazaBinaria(BIN, 41), rB2 = trazaBinaria(BIN, 30), rLow = trazaLimite(DUP, 4, false), rUp = trazaLimite(DUP, 4, true);
const rDP = trazaDosPunteros(DP, 21), rVen = trazaVentana(VEN, 3);
const c8 = costes(8), COSTES = costes(N_CARRERA);
const maxIter = Math.max(...[...BIN, 1, 30, 100].map(x => trazaBinaria(BIN, x).cont.iteraciones));
const choque = (1500000000 + 2000000000) | 0; // lo que suele salir al desbordar un int de 32 bits (en C++ es comportamiento indefinido)
const lgFact = n => { let s = 0; for (let k = 2; k <= Math.floor(n); k++) s += Math.log2(k); return s + (n % 1) * Math.log2(Math.floor(n) + 1); };
const lg = n => Math.log2(Math.max(1, n));

// ── Árboles ────────────────────────────────────────────────────────────────────────────────────────────────────
// Árbol de la recursión de merge sort con n = 8: el valor de cada nodo es el tamaño del tramo
const T_MERGE = (() => {
  const nodos = [], aristas = [];
  const r = (id, n) => { nodos.push({ id, val: n }); if (n > 1) { r(id + 'a', n / 2); r(id + 'b', n / 2); aristas.push({ a: id, b: id + 'a', lado: 'i' }, { a: id, b: id + 'b', lado: 'd' }); } };
  r('m', 8);
  return { nodos, aristas, raiz: 'm' };
})();
const NOTA = [
  { nivel: 0, texto: { es: 'mezcla 8', en: 'merge 8' } },
  { nivel: 1, texto: { es: '2 × 4 = 8', en: '2 × 4 = 8' } },
  { nivel: 2, texto: { es: '4 × 2 = 8', en: '4 × 2 = 8' } },
  { nivel: 3, texto: { es: '8 × 1: sin mezcla', en: '8 × 1: no merge' } },
];

// Árbol de decisión de ordenar (a, b, c) por comparaciones: izquierda = «sí», derecha = «no»
const T_DEC = {
  nodos: [
    { id: 'r', val: 'a<b?' }, { id: 's', val: 'b<c?' }, { id: 't', val: 'a<c?' },
    { id: 'h1', val: 'abc' }, { id: 'u', val: 'a<c?' }, { id: 'h2', val: 'acb' }, { id: 'h3', val: 'cab' },
    { id: 'h4', val: 'bac' }, { id: 'v', val: 'b<c?' }, { id: 'h5', val: 'bca' }, { id: 'h6', val: 'cba' },
  ],
  aristas: [
    { a: 'r', b: 's', lado: 'i' }, { a: 'r', b: 't', lado: 'd' },
    { a: 's', b: 'h1', lado: 'i' }, { a: 's', b: 'u', lado: 'd' }, { a: 'u', b: 'h2', lado: 'i' }, { a: 'u', b: 'h3', lado: 'd' },
    { a: 't', b: 'h4', lado: 'i' }, { a: 't', b: 'v', lado: 'd' }, { a: 'v', b: 'h5', lado: 'i' }, { a: 'v', b: 'h6', lado: 'd' },
  ],
  raiz: 'r',
};
const SI_NO = { s: 'sí', t: 'no', h1: 'sí', u: 'no', h2: 'sí', h3: 'no', h4: 'sí', v: 'no', h5: 'sí', h6: 'no' };
const HOJAS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// ── Laboratorio ─────────────────────────────────────────────────────────────────────────────────────────────────
const L8 = permutacion(N_LAB, 3);
const FORMAS = [
  { id: 'aleatorio', label: { es: 'aleatorio', en: 'random' } },
  { id: 'ordenado', label: { es: 'ordenado', en: 'sorted' } },
  { id: 'inverso', label: { es: 'inverso', en: 'reversed' } },
  { id: 'casi', label: { es: 'casi ordenado', en: 'nearly sorted' } },
];

export default {
  titulo: { es: 'Ordenación y búsqueda', en: 'Sorting and searching' },
  fuentes: [
    'Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). *Introduction to algorithms* (4th ed.). MIT Press.',
    'Hoare, C. A. R. (1962). Quicksort. *The Computer Journal*, *5*(1), 10–16. https://doi.org/10.1093/comjnl/5.1.10',
    'Knuth, D. E. (1998). *The art of computer programming: Vol. 3. Sorting and searching* (2nd ed.). Addison-Wesley.',
    'Musser, D. R. (1997). Introspective sorting and selection algorithms. *Software: Practice and Experience*, *27*(8), 983–993. https://doi.org/10.1002/(SICI)1097-024X(199708)27:8%3C983::AID-SPE117%3E3.0.CO;2-%23',
    'Sedgewick, R., & Wayne, K. (2011). *Algorithms* (4th ed.). Addison-Wesley. https://algs4.cs.princeton.edu/home/',
    '*std::sort*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/algorithm/sort',
  ],
  pasos: [
    // ═══ 1 · Burbuja, inserción y selección ═══
    {
      sec: { es: 'Burbuja, inserción y selección', en: 'Bubble, insertion and selection' }, leyenda: ['compara', 'hecho'],
      barras: barras(A8, ['comparaciones', 'intercambios']), cont: { comparaciones: 0, intercambios: 0 }, code: CODIGO.burbuja, line: null,
      es: 'Ordenar es dejar `a[0] <= a[1] <= …`. Los tres algoritmos sencillos hacen del orden de `n²` comparaciones en el peor caso, pero se portan muy distinto según los datos. En cada traza contaremos **comparaciones** e **intercambios**.',
      en: 'To sort is to reach `a[0] <= a[1] <= …`. The three simple algorithms make on the order of `n²` comparisons in the worst case, but behave very differently depending on the data. In every trace we count **comparisons** and **swaps**.',
    },
    {
      ...rBurb.inicial, line: null, traza: rBurb.frames,
      es: 'La **burbuja** compara vecinos y los cruza si están al revés: tras cada pasada, el mayor del tramo queda al final. Si una pasada no intercambia nada, ya está ordenado y paramos. Pulsa ▶ para reproducir la traza.',
      en: '**Bubble sort** compares neighbours and swaps them if they are out of order: after each pass, the largest of the range ends up at the end. If a pass swaps nothing, it is sorted and we stop. Press ▶ to play the trace.',
    },
    {
      ...fin(rBurb),
      es: `Resultado: ${rBurb.cont.comparaciones} comparaciones y ${rBurb.cont.intercambios} intercambios, uno por cada pareja fuera de orden (**inversión**). Y con el array ya ordenado y \`n\` = 8, ¿cuántas comparaciones hará este código?`,
      en: `Result: ${rBurb.cont.comparaciones} comparisons and ${rBurb.cont.intercambios} swaps, one per out-of-order pair (**inversion**). And with an already sorted array and \`n\` = 8, how many comparisons will this code make?`,
      pregunta: {
        opc: [
          { es: String(c8.ordenado.burbuja.comparaciones), en: String(c8.ordenado.burbuja.comparaciones), ok: true },
          { es: String(c8.ordenado.seleccion.comparaciones), en: String(c8.ordenado.seleccion.comparaciones) },
          { es: '0', en: '0' },
        ],
        why: {
          es: `Una sola pasada: compara los ${c8.ordenado.burbuja.comparaciones} pares, no intercambia nada y \`hubo\` sigue en \`false\`, así que el \`break\` corta. Sin esa bandera haría las ${c8.ordenado.seleccion.comparaciones} comparaciones de siempre.`,
          en: `A single pass: it compares the ${c8.ordenado.burbuja.comparaciones} pairs, swaps nothing and \`hubo\` stays \`false\`, so the \`break\` stops it. Without that flag it would make the usual ${c8.ordenado.seleccion.comparaciones} comparisons.`,
        },
      },
    },
    {
      barras: barras(A8, ['comparaciones', 'intercambios']), ...rIns.inicial, code: CODIGO.insercion, line: null, traza: rIns.frames,
      es: 'La **inserción** mantiene a la izquierda un tramo ordenado y hace bajar el siguiente elemento hasta su sitio, como al ordenar cartas. Aquí baja intercambiándose; la versión clásica desplaza y hace las mismas comparaciones. Lo atenuado aún no se ha leído.',
      en: '**Insertion sort** keeps a sorted range on the left and moves the next element down to its place, like sorting cards. Here it moves by swapping; the classic version shifts and makes the same comparisons. The dimmed part has not been read yet.',
    },
    {
      barras: barras(CASI8, ['comparaciones', 'intercambios']), ...rInsCasi.inicial, line: null, traza: rInsCasi.frames,
      es: `Ahora el array está **casi ordenado**: solo dos parejas están al revés. La inserción apenas trabaja: ${rInsCasi.cont.comparaciones} comparaciones y ${rInsCasi.cont.intercambios} intercambios, frente a ${c8.inverso.insercion.comparaciones} comparaciones con los datos al revés.`,
      en: `Now the array is **nearly sorted**: only two pairs are reversed. Insertion sort hardly works: ${rInsCasi.cont.comparaciones} comparisons and ${rInsCasi.cont.intercambios} swaps, against ${c8.inverso.insercion.comparaciones} comparisons with reversed data.`,
    },
    {
      ...fin(rInsCasi),
      es: `Cada intercambio corrige una inversión y cada elemento añade como mucho una comparación fallida: $T\\le(n-1)+I$, con $I$ las inversiones. Con pocas, es casi lineal. La selección sobre este mismo array, ¿cuántas comparaciones hará?`,
      en: `Each swap fixes one inversion and each element adds at most one failed comparison: $T\\le(n-1)+I$, with $I$ the inversions. With few of them it is almost linear. Selection sort on this same array, how many comparisons will it make?`,
      pregunta: {
        opc: [
          { es: String(c8.casi.seleccion.comparaciones), en: String(c8.casi.seleccion.comparaciones), ok: true },
          { es: String(c8.casi.insercion.comparaciones), en: String(c8.casi.insercion.comparaciones) },
          { es: '7', en: '7' },
        ],
        why: {
          es: `Siempre busca el mínimo en todo el resto: 7 + 6 + … + 1 = ${c8.casi.seleccion.comparaciones}, esté como esté el array. No se aprovecha de que esté casi ordenado.`,
          en: `It always looks for the minimum in the whole rest: 7 + 6 + … + 1 = ${c8.casi.seleccion.comparaciones}, whatever the array looks like. It does not take advantage of the array being nearly sorted.`,
        },
      },
    },
    {
      barras: barras(A8, ['comparaciones', 'intercambios']), ...rSel.inicial, code: CODIGO.seleccion, line: null, traza: rSel.frames,
      es: `La **selección** busca el menor del resto y lo lleva a su sitio con un único intercambio por vuelta: como mucho \`n - 1\` (aquí ${rSel.cont.intercambios}). Pero siempre hace \`n(n-1)/2\` comparaciones. Es inestable: el intercambio salta por encima de elementos iguales.`,
      en: `**Selection sort** looks for the smallest of the rest and puts it in place with a single swap per round: at most \`n - 1\` (here ${rSel.cont.intercambios}). But it always makes \`n(n-1)/2\` comparisons. It is unstable: the swap jumps over equal elements.`,
    },

    // ═══ 2 · Merge sort ═══
    {
      sec: { es: 'Merge sort', en: 'Merge sort' }, leyenda: ['compara', 'hecho'],
      barras: barras(A8, ['comparaciones', 'copias'], { aux: A8.length }), cont: { comparaciones: 0, copias: 0 }, code: CODIGO.mergesort, line: null,
      es: '**Divide y vencerás**: parte el array por la mitad, ordena cada mitad con la misma función y **mezcla** las dos mitades ya ordenadas. Un tramo de un solo elemento ya está ordenado, y ahí termina la recursión. Debajo hay una fila auxiliar para mezclar.',
      en: '**Divide and conquer**: split the array in half, sort each half with the same function and **merge** the two sorted halves. A range of one element is already sorted, and the recursion stops there. Below there is an auxiliary row for merging.',
    },
    {
      ...rMerge.inicial, line: null, traza: rMerge.frames,
      es: 'Primero se baja dividiendo (`lo`, `mid`, `hi`; lo de fuera del rango se atenúa). Al volver, cada `mezcla` copia el menor de las dos cabezas (`i`, `j`) a la fila **aux** y después devuelve el tramo a su sitio. Es larga: usa el control de velocidad.',
      en: 'First it goes down splitting (`lo`, `mid`, `hi`; what is outside the range is dimmed). On the way back, each `mezcla` copies the smaller of the two heads (`i`, `j`) to the **aux** row and then copies the range back. It is long: use the speed control.',
    },
    {
      ...fin(rMerge, { aux: null }),
      es: 'Mezclar `m` elementos cuesta como mucho `m - 1` comparaciones y `2m` copias. Merge sort es **estable**: con `<=`, ante un empate sale primero el elemento de la izquierda. Su precio es la fila auxiliar: memoria extra $O(n)$.',
      en: 'Merging `m` elements costs at most `m - 1` comparisons and `2m` copies. Merge sort is **stable**: with `<=`, on a tie the left element comes out first. Its price is the auxiliary row: $O(n)$ extra memory.',
    },
    {
      arbol: { nodos: T_MERGE.nodos, aristas: T_MERGE.aristas, raiz: 'm', cabida: { ...cabidaDe(T_MERGE), notas: true }, notas: NOTA.slice(0, 1) }, code: '', line: null,
      es: 'El árbol de la recursión para `n` = 8: cada nodo es un tramo y su valor, su tamaño. Hay 7 nodos con hijos, es decir, 7 mezclas. Veamos cuánto trabajo hay en cada nivel.',
      en: 'The recursion tree for `n` = 8: each node is a range and its value, its size. There are 7 nodes with children, that is, 7 merges. Let us see how much work there is at each level.',
    },
    {
      notas: NOTA,
      es: 'Cada nivel mezcla en total `n` elementos. Con $\\log_2 n$ niveles de mezcla, $T(n)=2T(n/2)+n$ da $O(n\\log n)$, igual en el mejor y en el peor caso. Con `n` = 8: 3 niveles × 8 = 24 copias a aux (48 con la vuelta).',
      en: 'Each level merges `n` elements in total. With $\\log_2 n$ merge levels, $T(n)=2T(n/2)+n$ gives $O(n\\log n)$, the same in the best and worst case. With `n` = 8: 3 levels × 8 = 24 copies to aux (48 with the copy back).',
    },
    {
      es: 'Si en la mezcla se escribe `a[i] < a[j]` en lugar de `a[i] <= a[j]`, ¿qué cambia?',
      en: 'If the merge uses `a[i] < a[j]` instead of `a[i] <= a[j]`, what changes?',
      pregunta: {
        opc: [
          { es: 'Sigue ordenando bien, pero deja de ser estable', en: 'It still sorts correctly, but it stops being stable', ok: true },
          { es: 'Deja de ordenar correctamente', en: 'It no longer sorts correctly' },
          { es: 'Pasa a ser $O(n^2)$', en: 'It becomes $O(n^2)$' },
        ],
        why: {
          es: 'Con `<`, ante un empate sale primero el de la derecha: los iguales se cruzan. El resultado sigue ordenado y el coste no cambia.',
          en: 'With `<`, on a tie the right one comes out first: equal elements swap places. The result is still sorted and the cost does not change.',
        },
      },
    },

    // ═══ 3 · Quicksort ═══
    {
      sec: { es: 'Quicksort', en: 'Quicksort' }, leyenda: ['activo', 'compara', 'hecho'],
      barras: barras(Q10, ['comparaciones', 'intercambios']), cont: { comparaciones: 0, intercambios: 0 }, code: CODIGO.quicksort, line: null,
      es: '**Quicksort** elige un **pivote** y reparte: a su izquierda quedan los menores, a su derecha los demás. Entonces el pivote ya está en su posición definitiva y solo falta ordenar cada lado igual. Trabaja sobre el propio array, sin fila auxiliar.',
      en: '**Quicksort** picks a **pivot** and distributes: the smaller elements end up on its left, the rest on its right. Then the pivot is already in its final position and each side only needs to be sorted the same way. It works in place, with no auxiliary row.',
    },
    {
      ...rLom.inicial, line: null, traza: rLom.frames,
      es: 'Partición de **Lomuto** con el último elemento como pivote. `j` recorre el tramo; `i` marca dónde irá el próximo menor. Al terminar, el pivote se intercambia con `a[i]`: ahí queda para siempre.',
      en: '**Lomuto** partition with the last element as pivot. `j` walks the range; `i` marks where the next smaller element goes. At the end the pivot is swapped with `a[i]`: it stays there for good.',
    },
    {
      arr: rLom.arr, est: { [rLom.p]: 'ok' }, marcas: null, rango: null, cont: rLom.cont, line: null,
      es: `Tras la partición, el pivote (${rLom.arr[rLom.p]}) está en la posición ${rLom.p}. ¿Qué sabemos ya del array?`,
      en: `After the partition, the pivot (${rLom.arr[rLom.p]}) is at position ${rLom.p}. What do we already know about the array?`,
      pregunta: {
        opc: [
          { es: 'A su izquierda todo es menor y a su derecha mayor o igual; falta ordenar cada lado', en: 'Everything on its left is smaller and on its right greater or equal; each side still needs sorting', ok: true },
          { es: 'Los dos lados ya están ordenados', en: 'Both sides are already sorted' },
          { es: 'Solo sabemos que el pivote era el mayor', en: 'We only know that the pivot was the largest' },
        ],
        why: {
          es: 'La partición reparte, no ordena. Pero el pivote ya no se mueve más, y los dos lados son problemas independientes y más pequeños.',
          en: 'Partitioning distributes, it does not sort. But the pivot never moves again, and the two sides are independent, smaller problems.',
        },
      },
    },
    {
      barras: barras(Q10, ['comparaciones', 'intercambios']), ...rQuick.inicial, line: null, traza: rQuick.frames,
      es: 'Quicksort repite lo mismo en cada lado. Con datos revueltos los tramos salen más o menos parejos: unos $\\log_2 n$ niveles de partición, cada uno con `n` comparaciones como mucho. Los verdes ya están en su sitio definitivo.',
      en: 'Quicksort repeats the same on each side. With shuffled data the ranges come out roughly even: about $\\log_2 n$ partition levels, each with at most `n` comparisons. The green ones are already in their final place.',
    },
    {
      barras: barras(Q10, ['comparaciones', 'intercambios']), ...rHoare.inicial, code: CODIGO.hoare, line: null, traza: rHoare.frames,
      es: 'La partición de **Hoare** usa dos índices que se acercan desde los extremos y cruzan lo que está en el lado equivocado. Suele hacer menos intercambios que Lomuto, pero el pivote no queda necesariamente en su sitio: devuelve `j` y se ordena `a[lo..j]` y `a[j+1..hi]`.',
      en: 'The **Hoare** partition uses two indices closing in from the ends and swapping what is on the wrong side. It usually makes fewer swaps than Lomuto, but the pivot does not necessarily end in its place: it returns `j` and `a[lo..j]` and `a[j+1..hi]` are sorted.',
    },
    {
      barras: barras(ORD8, ['comparaciones', 'intercambios']), ...rPeor.inicial, code: CODIGO.quicksort, line: null, traza: rPeor.frames,
      es: `Peor caso: datos **ya ordenados** y pivote al final. Todo es menor que el pivote, así que cada partición aparta un solo elemento: $T(n)=T(n-1)+n$, es decir $n(n-1)/2$ comparaciones, aquí ${rPeor.cont.comparaciones}. Es $O(n^2)$ y la recursión llega a profundidad \`n\`.`,
      en: `Worst case: **already sorted** data and the pivot at the end. Everything is smaller than the pivot, so each partition sets aside a single element: $T(n)=T(n-1)+n$, that is $n(n-1)/2$ comparisons, here ${rPeor.cont.comparaciones}. It is $O(n^2)$ and the recursion reaches depth \`n\`.`,
    },
    {
      code: CODIGO.mediana3, line: null,
      es: 'Para evitar ese caso se elige mejor el pivote. **Mediana de tres**: ordena `a[lo]`, `a[mid]`, `a[hi]` y usa el del medio. **Al azar**: ningún dato concreto es malo siempre y el coste **esperado** es $O(n\\log n)$. Ninguno elimina el peor caso, solo lo hace improbable.',
      en: 'To avoid that case the pivot is chosen better. **Median of three**: sort `a[lo]`, `a[mid]`, `a[hi]` and use the middle one. **Random**: no particular input is always bad and the **expected** cost is $O(n\\log n)$. Neither removes the worst case, they only make it unlikely.',
    },
    {
      barras: barras(ORD8, ['comparaciones', 'intercambios']), ...rMed.inicial, code: CODIGO.quicksort, line: null, traza: rMed.frames,
      es: `El mismo array ordenado con mediana de tres: el pivote es el elemento central y los tramos salen parejos. ${rMed.cont.comparaciones} comparaciones en vez de ${rPeor.cont.comparaciones} (incluye las 3 de cada mediana).`,
      en: `The same sorted array with median of three: the pivot is the central element and the ranges come out even. ${rMed.cont.comparaciones} comparisons instead of ${rPeor.cont.comparaciones} (including the 3 of each median).`,
    },
    {
      ...fin(rMed),
      es: 'Quicksort: $O(n\\log n)$ en el caso medio, $O(n^2)$ en el peor. No es estable: `{2a, 2b, 1}` con pivote final pasa a `{1, 2b, 2a}`. Y `std::sort` no puede ser quicksort a secas. ¿Qué garantiza?',
      en: 'Quicksort: $O(n\\log n)$ on average, $O(n^2)$ in the worst case. It is not stable: `{2a, 2b, 1}` with the last element as pivot becomes `{1, 2b, 2a}`. And `std::sort` cannot be plain quicksort. What does it guarantee?',
      pregunta: {
        opc: [
          { es: '$O(n\\log n)$ en el peor caso: usa introsort, un quicksort con salvaguarda', en: '$O(n\\log n)$ in the worst case: it uses introsort, a quicksort with a safeguard', ok: true },
          { es: 'Que es estable', en: 'That it is stable' },
          { es: '$O(n^2)$ con datos ordenados', en: '$O(n^2)$ on sorted data' },
        ],
        why: {
          es: 'Desde C++11 el estándar exige $O(n\\log n)$ comparaciones en el peor caso. Las implementaciones usan **introsort**: quicksort que pasa a heapsort si la recursión se hace demasiado profunda (y suele rematar con inserción en tramos pequeños; los detalles varían). No es estable: para eso está `std::stable_sort`.',
          en: 'Since C++11 the standard requires $O(n\\log n)$ comparisons in the worst case. Implementations use **introsort**: quicksort that switches to heapsort if the recursion gets too deep (and often finishes with insertion sort on small ranges; details vary). It is not stable: that is what `std::stable_sort` is for.',
        },
      },
    },

    // ═══ 4 · ¿Cuánto cuesta ordenar? ═══
    {
      sec: { es: '¿Cuánto cuesta ordenar?', en: 'How much does sorting cost?' },
      arbol: { nodos: T_DEC.nodos, aristas: T_DEC.aristas, raiz: 'r', cabida: cabidaDe(T_DEC) }, etiquetas: SI_NO, code: '', line: null,
      es: '¿Se puede ordenar con menos de `n log n` comparaciones? Un algoritmo que solo compara es un **árbol de decisión**: cada nodo es una comparación y cada hoja, un orden final. Este es el de `a, b, c`: izquierda = sí, derecha = no (bajo cada nodo, la respuesta que lleva a él).',
      en: 'Can we sort with fewer than `n log n` comparisons? An algorithm that only compares is a **decision tree**: each node is a comparison and each leaf, a final order. This one is for `a, b, c`: left = yes, right = no (under each node, the answer leading to it).',
    },
    {
      est: { r: 'camino', t: 'camino', h4: 'ok' }, aristaEst: { 'r-t': 'camino', 't-h4': 'camino' },
      es: 'Entrada `(a, b, c)` = `(5, 2, 9)`: `a<b?` no; `a<c?` sí; hoja `bac`, o sea 2, 5, 9. Cada entrada recorre un camino de la raíz a una hoja, y el número de comparaciones es la longitud de ese camino.',
      en: 'Input `(a, b, c)` = `(5, 2, 9)`: `a<b?` no; `a<c?` yes; leaf `bac`, that is 2, 5, 9. Each input follows a path from the root to a leaf, and the number of comparisons is the length of that path.',
    },
    {
      est: { r: null, t: null, h4: null, ...Object.fromEntries(HOJAS.map(h => [h, 'ok'])) }, aristaEst: null,
      es: 'Hay $3!=6$ hojas, una por cada orden posible. Un árbol de altura $h$ tiene como mucho $2^h$ hojas: $2^h\\ge6$ obliga a $h\\ge3$. Cuatro hojas están a profundidad 3: alguna entrada necesita 3 comparaciones, y con 2 solo se distinguirían 4 casos.',
      en: 'There are $3!=6$ leaves, one per possible order. A tree of height $h$ has at most $2^h$ leaves: $2^h\\ge6$ forces $h\\ge3$. Four leaves are at depth 3: some input needs 3 comparisons, and with 2 only 4 cases could be told apart.',
    },
    {
      es: 'Con `n` elementos hay $n!$ hojas, así que $h\\ge\\log_2(n!)$. Como $n!\\ge(n/2)^{n/2}$, resulta $\\log_2(n!)\\ge\\frac n2\\log_2\\frac n2$, que es $\\Omega(n\\log n)$. Ningún algoritmo que solo compare puede ser asintóticamente mejor que merge sort.',
      en: 'With `n` elements there are $n!$ leaves, so $h\\ge\\log_2(n!)$. Since $n!\\ge(n/2)^{n/2}$, we get $\\log_2(n!)\\ge\\frac n2\\log_2\\frac n2$, which is $\\Omega(n\\log n)$. No algorithm that only compares can be asymptotically better than merge sort.',
    },
    {
      grafica: {
        curvas: [
          { id: 'n', nombre: 'n', f: n => n },
          { id: 'lgfact', nombre: 'log₂(n!)', f: lgFact },
          { id: 'nlogn', nombre: 'n log₂ n', f: n => n * lg(n) },
        ],
        nmax: 64, n: 64, escala: 'lin',
      },
      code: '', line: null,
      es: `La cota $\\log_2(n!)$ crece como $n\\log_2 n$: la diferencia es lineal, unos $1{,}44\\,n$. Con \`n\` = 64: $\\log_2(64!)\\approx${Math.round(lgFact(64))}$ comparaciones como mínimo, frente a $n\\log_2 n=${64 * 6}$.`,
      en: `The bound $\\log_2(n!)$ grows like $n\\log_2 n$: the difference is linear, about $1.44\\,n$. With \`n\` = 64: $\\log_2(64!)\\approx${Math.round(lgFact(64))}$ comparisons at least, against $n\\log_2 n=${64 * 6}$.`,
    },
    {
      barras: barras(GRP, ['comparaciones', 'intercambios'], { estilo: 'cajas' }), ...rInsG.inicial, code: CODIGO.insercionPorGrupo, line: null, traza: rInsG.frames,
      es: 'Un orden es **estable** si los elementos con la misma clave conservan su orden de llegada. Cada caja es un registro: la decena es el **grupo** (la clave) y la unidad, el orden de llegada. Ordenamos por grupo con inserción.',
      en: 'A sort is **stable** if elements with the same key keep their arrival order. Each box is a record: the tens digit is the **group** (the key) and the units digit, the arrival order. We sort by group with insertion sort.',
    },
    {
      barras: barras(GRP, ['comparaciones', 'intercambios'], { estilo: 'cajas' }), ...rSelG.inicial, code: CODIGO.seleccionPorGrupo, line: null, traza: rSelG.frames,
      es: `La misma entrada con selección. Ordena bien por grupo, pero el intercambio a distancia cambia el orden dentro de un grupo: el ${rSelG.arr[4]} acaba antes que el ${rSelG.arr[5]}. Es correcta, pero **no estable**; la inserción dio ${rInsG.arr.join(', ')}.`,
      en: `The same input with selection sort. It sorts by group correctly, but the long-distance swap changes the order inside a group: ${rSelG.arr[4]} ends up before ${rSelG.arr[5]}. It is correct but **not stable**; insertion sort gave ${rInsG.arr.join(', ')}.`,
    },
    {
      ...fin(rSelG),
      es: 'Quieres los alumnos por curso y, dentro de cada curso, por nota. Con un orden **estable**, ¿cómo lo consigues con dos ordenaciones?',
      en: 'You want students by year and, within each year, by grade. With a **stable** sort, how do you do it with two sorts?',
      pregunta: {
        opc: [
          { es: 'Primero por nota y después por curso', en: 'First by grade, then by year', ok: true },
          { es: 'Primero por curso y después por nota', en: 'First by year, then by grade' },
          { es: 'Una sola ordenación por curso basta', en: 'A single sort by year is enough' },
        ],
        why: {
          es: 'La última ordenación manda; la estabilidad hace que los empates de curso conserven el orden por nota de la pasada anterior. Con `std::stable_sort`: primero por nota, luego por curso.',
          en: 'The last sort wins; stability makes ties in year keep the grade order of the previous pass. With `std::stable_sort`: first by grade, then by year.',
        },
      },
    },
    {
      barras: barras(CNT, ['comparaciones', 'escrituras'], { aux: 10 }), ...rCnt.inicial, code: CODIGO.conteo, line: null, traza: rCnt.frames,
      es: 'Counting sort no compara: usa cada valor como **índice** en una fila de contadores (aux) y luego reescribe el array leyéndola. Cuesta $O(n+M)$, con `M` el rango de valores, y `comparaciones` se queda en 0.',
      en: 'Counting sort does not compare: it uses each value as an **index** into a row of counters (aux) and then rewrites the array reading it. It costs $O(n+M)$, with `M` the range of values, and `comparisons` stays at 0.',
    },
    {
      es: 'La cota $\\Omega(n\\log n)$ vale para ordenar **solo comparando**. Counting sort la esquiva porque no compara, pero exige claves enteras en un rango `M` pequeño: si `M` es enorme, deja de compensar. Su variante estable es la base de **radix sort**.',
      en: 'The $\\Omega(n\\log n)$ bound holds for sorting **by comparing only**. Counting sort sidesteps it because it does not compare, but it needs integer keys in a small range `M`: if `M` is huge, it no longer pays off. Its stable variant is the basis of **radix sort**.',
    },

    // ═══ 5 · Búsqueda binaria ═══
    {
      sec: { es: 'Búsqueda binaria', en: 'Binary search' }, leyenda: ['compara', 'aux'],
      barras: barras(BIN, ['iteraciones'], { estilo: 'cajas' }), ...rB1.inicial, code: CODIGO.binaria, line: null, traza: rB1.frames,
      es: 'Con el array **ordenado**, mirar el elemento del medio (`mid`) descarta la mitad que no puede contener el valor. Busca el 41: lo de fuera de `lo`..`hi` se atenúa. Cada vuelta del bucle es una iteración.',
      en: 'With a **sorted** array, looking at the middle element (`mid`) discards the half that cannot contain the value. Look for 41: what is outside `lo`..`hi` is dimmed. Each loop round is one iteration.',
    },
    {
      barras: barras(BIN, ['iteraciones'], { estilo: 'cajas' }), ...rB2.inicial, line: null, traza: rB2.frames,
      es: 'Si no está, el intervalo se vacía: `lo` supera a `hi` y devuelve -1. Cada vuelta deja la mitad de candidatos: como mucho $\\lfloor\\log_2 n\\rfloor+1$ iteraciones, es decir $O(\\log n)$. Con $n=10^9$, unas 30.',
      en: 'If it is not there, the interval becomes empty: `lo` exceeds `hi` and it returns -1. Each round leaves half of the candidates: at most $\\lfloor\\log_2 n\\rfloor+1$ iterations, that is $O(\\log n)$. With $n=10^9$, about 30.',
    },
    {
      es: `El error clásico: \`int mid = (lo + hi) / 2;\` suma antes de dividir. Con \`lo\` = 1 500 000 000 y \`hi\` = 2 000 000 000 la suma es 3 500 000 000 y no cabe en un \`int\` de 32 bits (máx. 2 147 483 647): desbordamiento, comportamiento indefinido; suele salir ${miles(choque)}. \`lo + (hi - lo) / 2\` no pasa de \`hi\`.`,
      en: `The classic bug: \`int mid = (lo + hi) / 2;\` adds before dividing. With \`lo\` = 1,500,000,000 and \`hi\` = 2,000,000,000 the sum is 3,500,000,000 and does not fit in a 32-bit \`int\` (max 2,147,483,647): overflow, undefined behaviour; it usually yields ${choque}. \`lo + (hi - lo) / 2\` never exceeds \`hi\`.`,
    },
    {
      es: '¿Por qué `lo + (hi - lo) / 2` no desborda?',
      en: 'Why does `lo + (hi - lo) / 2` not overflow?',
      pregunta: {
        opc: [
          { es: 'Porque `hi - lo` no supera a `hi` y el resultado nunca pasa de `hi`', en: 'Because `hi - lo` does not exceed `hi` and the result never goes past `hi`', ok: true },
          { es: 'Porque divide antes de sumar', en: 'Because it divides before adding' },
          { es: 'Porque el compilador usa `long long` por dentro', en: 'Because the compiler uses `long long` internally' },
        ],
        why: {
          es: 'Con `0 <= lo <= hi` todos los resultados parciales están entre 0 y `hi`, y `hi` ya cabe en un `int`. No hay división previa ni tipos más anchos: solo no se hace la suma peligrosa.',
          en: 'With `0 <= lo <= hi` every partial result is between 0 and `hi`, and `hi` already fits in an `int`. There is no earlier division or wider type: the dangerous sum is simply never made.',
        },
      },
    },
    {
      barras: barras(DUP, ['iteraciones'], { estilo: 'cajas' }), ...rLow.inicial, code: CODIGO.lowerBound, line: null, traza: rLow.frames,
      es: 'Con repetidos, `lower_bound` devuelve la **primera** posición con `a[i] >= x`. El intervalo es `[lo, hi)`: `hi` puede valer `n`. En la biblioteca: `lower_bound(v.begin(), v.end(), x)`, que devuelve un iterador.',
      en: 'With repeated values, `lower_bound` returns the **first** position with `a[i] >= x`. The interval is `[lo, hi)`: `hi` may be `n`. In the library: `lower_bound(v.begin(), v.end(), x)`, which returns an iterator.',
    },
    {
      barras: barras(DUP, ['iteraciones'], { estilo: 'cajas' }), ...rUp.inicial, code: CODIGO.upperBound, line: null, traza: rUp.frames,
      es: `\`upper_bound\` devuelve la primera posición con \`a[i] > x\`. Entre las dos están todas las apariciones: aquí \`[${rLow.pos}, ${rUp.pos})\`, ${rUp.pos - rLow.pos} cuatros. \`equal_range\` devuelve ambas; \`binary_search\` solo dice si está. Todas exigen el rango ordenado.`,
      en: `\`upper_bound\` returns the first position with \`a[i] > x\`. Between the two are all the occurrences: here \`[${rLow.pos}, ${rUp.pos})\`, ${rUp.pos - rLow.pos} fours. \`equal_range\` returns both; \`binary_search\` only tells whether it is there. All require a sorted range.`,
    },
    {
      es: 'Búsqueda binaria **sobre la respuesta**: si `ok(x)` es falso hasta cierto valor y verdadero desde él, el mismo bucle encuentra el primer `x` con `ok(x)` sin necesidad de array. Ejemplo: el menor `x` con `x * x >= n` es la raíz cuadrada entera por exceso.',
      en: 'Binary search **on the answer**: if `ok(x)` is false up to some value and true from it on, the same loop finds the first `x` with `ok(x)` without any array. Example: the smallest `x` with `x * x >= n` is the integer square root rounded up.',
    },

    // ═══ 6 · Dos punteros y ventana deslizante ═══
    {
      sec: { es: 'Dos punteros y ventana deslizante', en: 'Two pointers and sliding window' },
      barras: barras(DP, ['iteraciones']), ...rDP.inicial, code: CODIGO.dosPunteros, line: null, traza: rDP.frames,
      es: 'En un array **ordenado**, ¿hay dos elementos que sumen 21? Un puntero en cada extremo: si la suma se queda corta, `i` avanza; si se pasa, `j` retrocede. El rango entre ambos es lo que aún puede contener el par.',
      en: 'In a **sorted** array, are there two elements adding up to 21? One pointer at each end: if the sum falls short, `i` moves right; if it overshoots, `j` moves left. The range between them is what can still hold the pair.',
    },
    {
      es: 'Descartar es correcto porque el array está ordenado: si `a[i] + a[j]` es menor que el objetivo, `a[i]` tampoco sirve con ningún elemento a la izquierda de `j` (son menores). Cada vuelta descarta un candidato: como mucho `n - 1` vueltas, $O(n)$. ¿Y si el array no estuviera ordenado?',
      en: 'Discarding is correct because the array is sorted: if `a[i] + a[j]` is below the target, `a[i]` does not work with any element left of `j` either (they are smaller). Each round discards one candidate: at most `n - 1` rounds, $O(n)$. And if the array were not sorted?',
      pregunta: {
        opc: [
          { es: 'El método deja de ser correcto: el argumento de descarte necesita el orden', en: 'The method is no longer correct: the discard argument needs the order', ok: true },
          { es: 'Sigue siendo correcto, pero más lento', en: 'It is still correct, only slower' },
          { es: 'Sigue siendo correcto y $O(n)$', en: 'It is still correct and $O(n)$' },
        ],
        why: {
          es: 'Sin orden, descartar `a[i]` puede perder un par válido. Habría que ordenar antes ($O(n\\log n)$) o usar una tabla hash.',
          en: 'Without order, discarding `a[i]` can lose a valid pair. You would sort first ($O(n\\log n)$) or use a hash table.',
        },
      },
    },
    {
      barras: barras(VEN, ['suma', 'mejor']), ...rVen.inicial, code: CODIGO.ventana, line: null, traza: rVen.frames,
      es: 'Ventana deslizante: la mayor suma de `k` = 3 elementos seguidos. Se calcula la primera ventana y después se desliza: entra un elemento, sale otro. El rango atenuado deja ver la ventana; en verde, la mejor hasta ahora.',
      en: 'Sliding window: the largest sum of `k` = 3 consecutive elements. The first window is computed and then it slides: one element comes in, another goes out. The dimmed range shows the window; green marks the best so far.',
    },
    {
      es: `Recalcular cada ventana costaría $O(nk)$. Deslizando, cada paso es una suma y una resta: $O(1)$, en total $O(n)$ (aquí ${VEN.length - 3} pasos). Con \`n\` elementos y ventana \`k\`, ¿cuántas veces se desliza?`,
      en: `Recomputing every window would cost $O(nk)$. Sliding, each step is an addition and a subtraction: $O(1)$, $O(n)$ in total (here ${VEN.length - 3} steps). With \`n\` elements and window \`k\`, how many times does it slide?`,
      pregunta: {
        opc: [
          { es: '`n - k` veces', en: '`n - k` times', ok: true },
          { es: '`n * k` veces', en: '`n * k` times' },
          { es: '`k` veces', en: '`k` times' },
        ],
        why: {
          es: 'Tras la primera ventana (`k` elementos) el índice `i` va de `k` a `n - 1`: `n - k` pasos. Es lineal porque cada índice solo avanza, igual que `i` y `j` en dos punteros.',
          en: 'After the first window (`k` elements) the index `i` goes from `k` to `n - 1`: `n - k` steps. It is linear because each index only moves forward, like `i` and `j` in two pointers.',
        },
      },
    },

    // ═══ 7 · Laboratorio ═══
    {
      sec: { es: 'Laboratorio', en: 'Lab' },
      barras: barras(L8, ['movimientos']), cont: { movimientos: 0 }, code: '', line: null,
      jugar: {
        arrastrables: true,
        botones: [
          { label: { es: 'Mezclar', en: 'Shuffle' }, hacer: (v, cx) => { v.sem = (v.sem ?? 0) + 1; reponer(v, permutacion(cx.n, 100 + v.sem)); v.base = [...v.arr]; v.cont = { movimientos: 0 }; v.est = {}; } },
          { label: { es: 'Pista', en: 'Hint' }, hacer: v => { v.est = Object.fromEntries(fueraDeCreciente(v.arr).map(i => [i, 'sel'])); }, off: v => ordenado(v.arr) },
          { label: { es: 'Reiniciar', en: 'Reset' }, hacer: (v, cx) => { reponer(v, cx.inicial); v.base = [...cx.inicial]; v.cont = { movimientos: 0 }; v.est = {}; } },
        ],
        soltar: (v, desde, hasta) => { mover(v, desde, hasta); v.cont.movimientos = (v.cont.movimientos ?? 0) + 1; v.est = {}; },
        lecturas: (v, cx) => {
          const en = lang() === 'en', base = v.base ?? cx.inicial, movs = v.cont.movimientos ?? 0, minA = minArrastres(base), ok = ordenado(v.arr);
          return [
            { expr: en ? 'moves' : 'movimientos', valor: movs, malo: ok && movs > minA },
            { expr: en ? 'min. drags' : 'mín. arrastres', valor: minA },
            { expr: en ? 'min. swaps' : 'mín. intercambios', valor: minIntercambios(base) },
            { expr: en ? 'sorted' : 'ordenado', valor: ok },
          ];
        },
        hl: v => (ordenado(v.arr) ? todosOk(v.arr.length) : {}),
      },
      es: 'Ordena arrastrando barras (o enfoca una y usa las flechas). Arrastrar equivale a sacar un elemento y reinsertarlo: el mínimo son `n` menos la subsecuencia creciente más larga. Con intercambios entre dos posiciones el mínimo es `n` menos los ciclos. «Pista» marca las barras que habrá que mover.',
      en: 'Sort by dragging bars (or focus one and use the arrow keys). Dragging is like taking an element out and reinserting it: the minimum is `n` minus the longest increasing subsequence. With swaps of two positions the minimum is `n` minus the cycles. «Hint» marks the bars that must move.',
    },
    {
      barras: barras(datos('aleatorio', N_CARRERA), ['comparaciones', 'intercambios', 'copias']), cont: {}, code: '', line: null,
      jugar: {
        botones: [
          ...FORMAS.map(f => ({ label: f.label, hacer: v => { v.forma = f.id; v.alg = null; reponer(v, datos(f.id, N_CARRERA)); v.est = {}; v.cont = {}; } })),
          ...Object.entries(ALGORITMOS).map(([id, A]) => ({
            label: A.nombre,
            hacer: v => { const r = A.traza(datos(v.forma ?? 'aleatorio', N_CARRERA)); v.alg = id; v.arr = [...r.arr]; v.est = todosOk(N_CARRERA); v.cont = { ...r.cont }; },
          })),
        ],
        lecturas: v => {
          const en = lang() === 'en', forma = v.forma ?? 'aleatorio', fila = COSTES[forma], tope = Math.max(...Object.values(fila).map(c => c.comparaciones));
          return [
            { expr: en ? 'data' : 'datos', valor: FORMAS.find(f => f.id === forma).label[lang()] },
            ...Object.entries(ALGORITMOS).map(([id, A]) => ({
              expr: (v.alg === id ? '▸ ' : '') + A.nombre[lang()],
              valor: fila[id].comparaciones + (en ? ' comparisons' : ' comparaciones'),
              malo: fila[id].comparaciones === tope,
            })),
          ];
        },
      },
      es: `Carrera con ${N_CARRERA} elementos: elige la forma de los datos y pulsa un algoritmo; ordena la fila y muestra su coste. La tabla da las comparaciones de **cada** algoritmo con esos datos (ejecutados de verdad); en rojo, el que más hace. Prueba «ordenado» e «inverso».`,
      en: `Race with ${N_CARRERA} elements: pick the data shape and press an algorithm; it sorts the row and shows its cost. The table gives the comparisons of **each** algorithm on that data (actually run); in red, the one that does the most. Try «sorted» and «reversed».`,
    },
    {
      es: 'Resumen. Por defecto, `std::sort`; con empates que deben conservar su orden, `std::stable_sort`. Para buscar en un rango ordenado, `lower_bound`. Inserción para pocos datos o casi ordenados; counting sort si las claves son enteros pequeños. Tienes 10⁶ registros y debes conservar el orden previo de los empates. ¿Qué eliges?',
      en: 'Summary. By default, `std::sort`; when ties must keep their order, `std::stable_sort`. To search a sorted range, `lower_bound`. Insertion sort for few or nearly sorted data; counting sort if keys are small integers. You have 10⁶ records and must keep the previous order of ties. What do you pick?',
      pregunta: {
        opc: [
          { es: '`std::stable_sort`', en: '`std::stable_sort`', ok: true },
          { es: '`std::sort`', en: '`std::sort`' },
          { es: 'Selección: es la más simple', en: 'Selection sort: it is the simplest' },
        ],
        why: {
          es: '`std::sort` no garantiza la estabilidad y la selección es $O(n^2)$: con 10⁶ registros serían del orden de 10¹² comparaciones. `stable_sort` es $O(n\\log n)$ (si hay memoria extra) y estable.',
          en: '`std::sort` does not guarantee stability and selection sort is $O(n^2)$: with 10⁶ records that is around 10¹² comparisons. `stable_sort` is $O(n\\log n)$ (if extra memory is available) and stable.',
        },
      },
    },
  ],
};
