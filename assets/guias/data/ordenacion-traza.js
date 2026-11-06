// Generadores de trazas de la guía «Ordenación y búsqueda» (data/ordenacion.js).
//
// Cada generador EJECUTA el algoritmo sobre una copia del array y emite un frame por paso observable, en el formato
// de parches de la escena «barras» (assets/guias/barras.js) más `line` (línea del listado C++ de CODIGO/LINEAS) y los
// subtítulos `es`/`en`. Todos devuelven un objeto:
//   { frames, inicial, arr, cont, …extras }
//   frames   parches acumulativos sobre el estado del paso que abre la traza
//   inicial  parche con el estado de partida (marcas, rango, est, cont a cero…): el paso lo esparce junto a `barras`
//   arr      resultado (el array tras ejecutar el algoritmo)    cont  contadores finales (los de los frames)
// Convenciones: `comparaciones` cuenta evaluaciones de la comparación entre elementos del propio algoritmo;
// `intercambios` solo cuenta swaps entre posiciones distintas (los que se ven). Sin DOM ni imports: se prueba en Node.

// ── Infraestructura: la Cinta emite frames como diferencias respecto al estado absoluto anterior ─────────────────
const dif = (prev, next) => {
  const d = {};
  for (const k of Object.keys(prev)) if (!(k in next)) d[k] = null;
  for (const [k, v] of Object.entries(next)) if (prev[k] !== v) d[k] = v;
  return d;
};
const sinNulos = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null));
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export class Cinta {
  /** cont = contadores (se mutan: T.cont.comparaciones++); ini = {marcas, rango, est} de partida. */
  constructor(cont, ini = {}) {
    this.frames = []; this.cont = cont;
    this.est = { ...ini.est }; this.marcas = sinNulos(ini.marcas ?? {}); this.rango = ini.rango ?? null;
    this.visto = { ...cont };
    this.inicial = { cont: { ...cont }, ...(ini.est && { est: { ...ini.est } }), ...(ini.marcas && { marcas: { ...ini.marcas } }), ...(ini.rango && { rango: [...ini.rango] }) };
  }

  /** f = {line, es, en, intercambiar?, poner?, aux?} + estado ABSOLUTO opcional {est, marcas, rango} (lo omitido se conserva). */
  emite(f) {
    const { est, marcas, rango, ...p } = f;
    if (est) { const d = dif(this.est, est); this.est = { ...est }; if (Object.keys(d).length) p.est = d; }
    if (marcas) { const m = sinNulos(marcas), d = dif(this.marcas, m); this.marcas = m; if (Object.keys(d).length) p.marcas = d; }
    if (rango !== undefined) { if (!igual(rango, this.rango)) p.rango = rango; this.rango = rango; }
    if (!igual(this.cont, this.visto)) { p.cont = { ...this.cont }; this.visto = { ...this.cont }; }
    this.frames.push(p);
  }

  /** Cierra la traza: { frames, inicial, arr, cont, …extra }. */
  fin(arr, extra = {}) { return { frames: this.frames, inicial: this.inicial, arr, cont: { ...this.cont }, ...extra }; }
}

/** Reaplica los parches de datos (arr, poner, intercambiar) de unos frames a un array: el resultado de la traza. */
export function aplicar(arr0, frames) {
  const a = [...arr0];
  for (const f of frames) {
    if (f.arr) f.arr.forEach((v, i) => { a[i] = v; });
    for (const [i, v] of Object.entries(f.poner || {})) a[+i] = v;
    if (f.intercambiar) for (const [i, j] of Array.isArray(f.intercambiar[0]) ? f.intercambiar : [f.intercambiar]) [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** {0:'ok', 1:'ok', …} para las posiciones desde..n-1. */
export const todosOk = (n, desde = 0) => Object.fromEntries(Array.from({ length: Math.max(0, n - desde) }, (_, i) => [i + desde, 'ok']));
/** {desde:'ok', …} para k posiciones seguidas desde `desde`. */
const ventanaOk = (desde, k) => Object.fromEntries(Array.from({ length: k }, (_, i) => [desde + i, 'ok']));

/** Etiquetas de contador (barras.etiquetasCont) de todos los generadores. */
export const ETIQ = {
  comparaciones: { es: 'comparaciones', en: 'comparisons' },
  intercambios: { es: 'intercambios', en: 'swaps' },
  copias: { es: 'copias', en: 'copies' },
  iteraciones: { es: 'iteraciones', en: 'iterations' },
  escrituras: { es: 'escrituras', en: 'writes' },
  suma: { es: 'suma', en: 'sum' },
  mejor: { es: 'mejor', en: 'best' },
  movimientos: { es: 'movimientos', en: 'moves' },
};

// ── Listados C++ (mismo nº de líneas en es y en: solo cambia el comentario de la primera línea) ─────────────────
const cod = (plantilla, c) => ({ es: plantilla.replace('@@', c[0]), en: plantilla.replace('@@', c[1]) });

const burbuja = c => cod(`void burbuja(int a[], int n) {   // @@
    for (int i = 0; i < n - 1; i++) {
        bool hubo = false;
        for (int j = 0; j < n - 1 - i; j++) {
            if (a[j] > a[j + 1]) {
                swap(a[j], a[j + 1]);
                hubo = true;
            }
        }
        if (!hubo) break;
    }
}`, c);

/** cmp = expresión de la comparación (por defecto a[j - 1] > a[j]; con otra clave se ve en el listado). */
const insercion = (c, cmp = 'a[j - 1] > a[j]') => cod(`void insercion(int a[], int n) {   // @@
    for (int i = 1; i < n; i++) {
        int j = i;
        while (j > 0 && ${cmp}) {
            swap(a[j - 1], a[j]);
            j--;
        }
    }
}`, c);

const seleccion = (c, cmp = 'a[j] < a[m]') => cod(`void seleccion(int a[], int n) {   // @@
    for (int i = 0; i < n - 1; i++) {
        int m = i;
        for (int j = i + 1; j < n; j++)
            if (${cmp}) m = j;
        if (m != i) swap(a[i], a[m]);
    }
}`, c);

const mergesort = c => cod(`void mezcla(int a[], int aux[], int lo, int mid, int hi) {   // @@
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi)
        aux[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];
    while (i <= mid) aux[k++] = a[i++];
    while (j <= hi)  aux[k++] = a[j++];
    for (k = lo; k <= hi; k++) a[k] = aux[k];
}

void mergesort(int a[], int aux[], int lo, int hi) {
    if (lo >= hi) return;
    int mid = lo + (hi - lo) / 2;
    mergesort(a, aux, lo, mid);
    mergesort(a, aux, mid + 1, hi);
    mezcla(a, aux, lo, mid, hi);
}`, c);

const quicksort = c => cod(`int particion(int a[], int lo, int hi) {   // @@
    swap(a[elegir(a, lo, hi)], a[hi]);
    int piv = a[hi], i = lo;
    for (int j = lo; j < hi; j++) {
        if (a[j] < piv) {
            swap(a[i], a[j]);
            i++;
        }
    }
    swap(a[i], a[hi]);
    return i;
}

void quicksort(int a[], int lo, int hi) {
    if (lo >= hi) return;
    int p = particion(a, lo, hi);
    quicksort(a, lo, p - 1);
    quicksort(a, p + 1, hi);
}`, c);

const mediana3 = c => cod(`int mediana3(int a[], int lo, int hi) {   // @@
    int mid = lo + (hi - lo) / 2;
    if (a[mid] < a[lo]) swap(a[mid], a[lo]);
    if (a[hi]  < a[lo]) swap(a[hi],  a[lo]);
    if (a[hi]  < a[mid]) swap(a[hi], a[mid]);
    return mid;   // ahora a[lo] <= a[mid] <= a[hi]
}`, c);

const hoare = c => cod(`int hoare(int a[], int lo, int hi) {   // @@
    int piv = a[lo + (hi - lo) / 2];
    int i = lo - 1, j = hi + 1;
    while (true) {
        do i++; while (a[i] < piv);
        do j--; while (a[j] > piv);
        if (i >= j) return j;
        swap(a[i], a[j]);
    }
}`, c);

const binaria = c => cod(`int buscar(const int a[], int n, int x) {   // @@
    int lo = 0, hi = n - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] == x) return mid;
        if (a[mid] < x) lo = mid + 1;
        else            hi = mid - 1;
    }
    return -1;
}`, c);

/** cmp = condición de «seguir a la derecha»: a[mid] < x (lower_bound) o a[mid] <= x (upper_bound). */
const limite = (nombre, c, cmp) => cod(`int ${nombre}(const int a[], int n, int x) {   // @@
    int lo = 0, hi = n;   // intervalo [lo, hi)
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (${cmp}) lo = mid + 1;
        else        hi = mid;
    }
    return lo;
}`, c);

const dosPunteros = c => cod(`bool parConSuma(const int a[], int n, int objetivo) {   // @@
    int i = 0, j = n - 1;
    while (i < j) {
        int s = a[i] + a[j];
        if (s == objetivo) return true;
        if (s < objetivo) i++;
        else              j--;
    }
    return false;
}`, c);

const ventana = c => cod(`int sumaMaxima(const int a[], int n, int k) {   // @@
    int s = 0;
    for (int i = 0; i < k; i++) s += a[i];
    int mejor = s;
    for (int i = k; i < n; i++) {
        s += a[i] - a[i - k];
        mejor = max(mejor, s);
    }
    return mejor;
}`, c);

const conteo = c => cod(`void ordenaConteo(int a[], int n, int M) {   // @@
    vector<int> cuenta(M, 0);
    for (int i = 0; i < n; i++) cuenta[a[i]]++;
    int k = 0;
    for (int v = 0; v < M; v++)
        while (cuenta[v]-- > 0) a[k++] = v;
}`, c);

export const CODIGO = {
  burbuja: burbuja(['ordena a[0..n-1]', 'sorts a[0..n-1]']),
  insercion: insercion(['ordena a[0..n-1]', 'sorts a[0..n-1]']),
  seleccion: seleccion(['ordena a[0..n-1]', 'sorts a[0..n-1]']),
  mergesort: mergesort(['mezcla a[lo..mid] y a[mid+1..hi]', 'merges a[lo..mid] and a[mid+1..hi]']),
  quicksort: quicksort(['deja el pivote en su sitio', 'puts the pivot in its place']),
  mediana3: mediana3(['pivote: mediana de tres', 'pivot: median of three']),
  hoare: hoare(['otra partición: dos índices', 'another partition: two indices']),
  binaria: binaria(['busca x en a (ordenado)', 'looks for x in sorted a']),
  lowerBound: limite('lowerBound', ['primer i con a[i] >= x', 'first i with a[i] >= x'], 'a[mid] < x'),
  upperBound: limite('upperBound', ['primer i con a[i] > x', 'first i with a[i] > x'], 'a[mid] <= x'),
  dosPunteros: dosPunteros(['¿hay a[i] + a[j] == objetivo?', 'is there a[i] + a[j] == objetivo?']),
  ventana: ventana(['mayor suma de k seguidos', 'largest sum of k consecutive']),
  conteo: conteo(['valores en 0..M-1', 'values in 0..M-1']),
  /** Variantes con otra clave de comparación (estabilidad): a[x] / 10 = «grupo». */
  insercionPorGrupo: insercion(['ordena por a[i] / 10', 'sorts by a[i] / 10'], 'a[j - 1] / 10 > a[j] / 10'),
  seleccionPorGrupo: seleccion(['ordena por a[i] / 10', 'sorts by a[i] / 10'], 'a[j] / 10 < a[m] / 10'),
};

/** Línea (1..) de cada acción relevante en el listado correspondiente de CODIGO. */
export const LINEAS = {
  burbuja: { cmp: 5, swap: 6, pasada: 10, fin: 12 },
  insercion: { ini: 3, cmp: 4, swap: 5, fin: 9 },
  seleccion: { ini: 3, cmp: 5, swap: 6, fin: 8 },
  mergesort: { while: 3, copia: 4, sobraI: 5, sobraD: 6, vuelta: 7, base: 11, mid: 12, izq: 13, der: 14, mezcla: 15, fin: 16 },
  quicksort: { elegir: 2, piv: 3, cmp: 5, swap: 6, ultimo: 10, ret: 11, base: 15, llama: 16, fin: 19 },
  mediana3: { fin: 6 },
  hoare: { piv: 2, ini: 3, scanI: 5, scanJ: 6, cruce: 7, swap: 8 },
  binaria: { ini: 2, mid: 4, igual: 5, menor: 6, mayor: 7, fuera: 9 },
  limite: { ini: 2, mid: 4, sube: 5, baja: 6, ret: 8 },
  dosPunteros: { ini: 2, suma: 4, igual: 5, sube: 6, baja: 7, fuera: 9 },
  ventana: { primera: 3, mejor: 4, desliza: 6, fin: 9 },
  conteo: { ini: 2, cuenta: 3, escribe: 6 },
};

/** Texto de una relación entre dos elementos: «5 > 3» o, con clave propia, «clave 2 > clave 1». */
const rel = (clave, x, y, op, lang) => (clave ? `${lang === 'es' ? 'clave' : 'key'} ${clave(x)} ${op} ${lang === 'es' ? 'clave' : 'key'} ${clave(y)}` : `${x} ${op} ${y}`);

// ── Burbuja ───────────────────────────────────────────────────────────────────────────────────────────────────────
export function trazaBurbuja(a0) {
  const a = [...a0], n = a.length, T = new Cinta({ comparaciones: 0, intercambios: 0 }), L = LINEAS.burbuja, ok = {};
  for (let i = 0; i < n - 1; i++) {
    let hubo = false;
    for (let j = 0; j < n - 1 - i; j++) {
      T.cont.comparaciones++;
      const [x, y] = [a[j], a[j + 1]];
      T.emite({
        line: L.cmp, marcas: { j }, est: { ...ok, [j]: 'cmp', [j + 1]: 'cmp' },
        es: `Compara \`a[${j}]\` = ${x} con \`a[${j + 1}]\` = ${y}.`, en: `Compare \`a[${j}]\` = ${x} with \`a[${j + 1}]\` = ${y}.`,
      });
      if (x > y) {
        [a[j], a[j + 1]] = [y, x]; T.cont.intercambios++; hubo = true;
        T.emite({
          line: L.swap, intercambiar: [j, j + 1], est: { ...ok, [j]: 'sel', [j + 1]: 'sel' },
          es: `${x} > ${y}: están al revés, se intercambian.`, en: `${x} > ${y}: out of order, swap them.`,
        });
      }
    }
    if (!hubo) {
      T.emite({
        line: L.pasada, marcas: {}, est: todosOk(n - i),
        es: 'Pasada sin intercambios: el tramo ya está ordenado y el bucle termina.', en: 'A pass with no swaps: the range is sorted and the loop stops.',
      });
      return T.fin(a);
    }
    ok[n - 1 - i] = 'ok';
    T.emite({
      line: L.pasada, marcas: {}, est: { ...ok },
      es: `Fin de la pasada: \`a[${n - 1 - i}]\` = ${a[n - 1 - i]} queda en su sitio.`, en: `End of the pass: \`a[${n - 1 - i}]\` = ${a[n - 1 - i]} is in place.`,
    });
  }
  if (n > 0) T.emite({ line: L.fin, est: todosOk(n), es: 'Solo queda un elemento sin ordenar: todo está en su sitio.', en: 'Only one element is left: everything is in place.' });
  return T.fin(a);
}

// ── Inserción (versión con intercambios: la clave «baja» hasta su sitio; mismas comparaciones que desplazando) ───────
/** o.clave: función que da la clave de comparación (por defecto, el propio valor). Estable: solo intercambia si es estrictamente mayor. */
export function trazaInsercion(a0, o = {}) {
  const a = [...a0], n = a.length, K = o.clave ?? (x => x), T = new Cinta({ comparaciones: 0, intercambios: 0 }), L = LINEAS.insercion;
  for (let i = 1; i < n; i++) {
    let j = i;
    T.emite({
      line: L.ini, rango: [0, i], marcas: { i, j }, est: {},
      es: `Toma \`a[${i}]\` = ${a[i]}: baja mientras el de su izquierda sea mayor.`, en: `Take \`a[${i}]\` = ${a[i]}: it moves down while its left neighbour is greater.`,
    });
    while (j > 0) {
      T.cont.comparaciones++;
      const [x, y] = [a[j - 1], a[j]], mayor = K(x) > K(y);
      T.emite({
        line: L.cmp, est: { [j - 1]: 'cmp', [j]: 'cmp' },
        es: `${rel(o.clave, x, y, mayor ? '>' : '<=', 'es')}: ${mayor ? 'hay que bajarlo' : 'ya está en su sitio'}.`,
        en: `${rel(o.clave, x, y, mayor ? '>' : '<=', 'en')}: ${mayor ? 'move it down' : 'it is in place'}.`,
      });
      if (!mayor) break;
      [a[j - 1], a[j]] = [y, x]; T.cont.intercambios++; j--;
      T.emite({
        line: L.swap, intercambiar: [j, j + 1], marcas: { i, j }, est: { [j]: 'sel', [j + 1]: 'sel' },
        es: `Intercambia: ${y} baja a la posición ${j}.`, en: `Swap: ${y} moves down to position ${j}.`,
      });
    }
  }
  if (n > 0) T.emite({ line: L.fin, rango: null, marcas: {}, est: todosOk(n), es: 'Todos los elementos han sido insertados: ordenado.', en: 'Every element has been inserted: sorted.' });
  return T.fin(a);
}

// ── Selección (inestable: el intercambio a larga distancia salta por encima de iguales) ───────────────────────────
export function trazaSeleccion(a0, o = {}) {
  const a = [...a0], n = a.length, K = o.clave ?? (x => x), T = new Cinta({ comparaciones: 0, intercambios: 0 }), L = LINEAS.seleccion, ok = {};
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    T.emite({
      line: L.ini, marcas: { i, min: m }, est: { ...ok },
      es: `Busca el menor de \`a[${i}..${n - 1}]\`. De momento, \`min\` = ${i}.`, en: `Look for the smallest of \`a[${i}..${n - 1}]\`. For now, \`min\` = ${i}.`,
    });
    for (let j = i + 1; j < n; j++) {
      T.cont.comparaciones++;
      const [x, y] = [a[j], a[m]], menor = K(x) < K(y), mAnt = m;
      if (menor) m = j;
      T.emite({
        line: L.cmp, marcas: { i, j, min: m }, est: { ...ok, [mAnt]: 'cmp', [j]: 'cmp' },
        es: `${rel(o.clave, x, y, menor ? '<' : '>=', 'es')}: ${menor ? `nuevo mínimo, \`min\` = ${j}` : 'sigue el mismo mínimo'}.`,
        en: `${rel(o.clave, x, y, menor ? '<' : '>=', 'en')}: ${menor ? `new minimum, \`min\` = ${j}` : 'same minimum'}.`,
      });
    }
    ok[i] = 'ok';
    if (m !== i) {
      const [x, y] = [a[i], a[m]];
      [a[i], a[m]] = [y, x]; T.cont.intercambios++;
      T.emite({
        line: L.swap, intercambiar: [i, m], marcas: { i, min: m }, est: { ...ok, [m]: 'sel' },
        es: `Intercambia \`a[${i}]\` = ${x} con el mínimo \`a[${m}]\` = ${y}.`, en: `Swap \`a[${i}]\` = ${x} with the minimum \`a[${m}]\` = ${y}.`,
      });
    } else {
      T.emite({
        line: L.swap, marcas: { i, min: m }, est: { ...ok },
        es: `El mínimo ya está en \`a[${i}]\`: no hay intercambio.`, en: `The minimum is already at \`a[${i}]\`: no swap.`,
      });
    }
  }
  if (n > 0) T.emite({ line: L.fin, marcas: {}, est: todosOk(n), es: 'El último elemento queda solo y en su sitio: ordenado.', en: 'The last element is alone and in place: sorted.' });
  return T.fin(a);
}

// ── Merge sort (de arriba abajo, con fila auxiliar; estable gracias a `<=`) ─────────────────────────────────────
export function trazaMergesort(a0) {
  const a = [...a0], n = a.length, aux = Array(n).fill(null), L = LINEAS.mergesort;
  const T = new Cinta({ comparaciones: 0, copias: 0 });

  function mezcla(lo, mid, hi) {
    let i = lo, j = mid + 1, k = lo;
    const copia = (izq, line, es, en) => {
      const de = izq ? i : j;
      aux[k] = a[de]; T.cont.copias++;
      if (izq) i++; else j++;
      T.emite({ line, aux: { [k]: aux[k] }, marcas: { i: i > mid ? null : i, j: j > hi ? null : j }, est: { [de]: 'sel' }, es, en });
      k++;
    };
    T.emite({
      line: L.mezcla, rango: [lo, hi], marcas: { i, j }, est: {},
      es: `Mezcla \`a[${lo}..${mid}]\` y \`a[${mid + 1}..${hi}]\`, ya ordenadas.`, en: `Merge \`a[${lo}..${mid}]\` and \`a[${mid + 1}..${hi}]\`, both sorted.`,
    });
    while (i <= mid && j <= hi) {
      T.cont.comparaciones++;
      const [x, y] = [a[i], a[j]];
      T.emite({ line: L.while, est: { [i]: 'cmp', [j]: 'cmp' }, es: `Compara \`a[${i}]\` = ${x} con \`a[${j}]\` = ${y}.`, en: `Compare \`a[${i}]\` = ${x} with \`a[${j}]\` = ${y}.` });
      if (x <= y) copia(true, L.copia, `${x} <= ${y}: ${x} pasa a \`aux[${k}]\`.`, `${x} <= ${y}: ${x} goes to \`aux[${k}]\`.`);
      else copia(false, L.copia, `${x} > ${y}: ${y} pasa a \`aux[${k}]\`.`, `${x} > ${y}: ${y} goes to \`aux[${k}]\`.`);
    }
    while (i <= mid) copia(true, L.sobraI, `Sobra la izquierda: ${a[i]} pasa a \`aux[${k}]\`.`, `Left leftovers: ${a[i]} goes to \`aux[${k}]\`.`);
    while (j <= hi) copia(false, L.sobraD, `Sobra la derecha: ${a[j]} pasa a \`aux[${k}]\`.`, `Right leftovers: ${a[j]} goes to \`aux[${k}]\`.`);
    const poner = {}, vaciar = {};
    for (k = lo; k <= hi; k++) { a[k] = aux[k]; aux[k] = null; poner[k] = a[k]; vaciar[k] = null; T.cont.copias++; }
    T.emite({
      line: L.vuelta, poner, aux: vaciar, marcas: {}, est: {},
      es: `Devuelve el tramo ordenado a \`a[${lo}..${hi}]\`.`, en: `Copy the sorted range back to \`a[${lo}..${hi}]\`.`,
    });
  }

  function rec(lo, hi) {
    if (lo >= hi) {
      T.emite({
        line: L.base, rango: [lo, lo], marcas: { lo, hi: lo }, est: {},
        es: `\`a[${lo}]\` solo: un elemento ya está ordenado.`, en: `\`a[${lo}]\` alone: one element is already sorted.`,
      });
      return;
    }
    const mid = lo + ((hi - lo) >> 1);
    T.emite({
      line: L.mid, rango: [lo, hi], marcas: { lo, mid, hi }, est: {},
      es: `Divide \`a[${lo}..${hi}]\` por \`mid\` = ${mid}.`, en: `Split \`a[${lo}..${hi}]\` at \`mid\` = ${mid}.`,
    });
    rec(lo, mid); rec(mid + 1, hi);
    mezcla(lo, mid, hi);
  }

  if (n > 0) {
    rec(0, n - 1);
    T.emite({ line: L.fin, rango: null, marcas: {}, est: todosOk(n), es: 'Todo el array está ordenado.', en: 'The whole array is sorted.' });
  }
  return T.fin(a);
}

// ── Quicksort (partición de Lomuto; el pivote se elige con `pivote`: 'ultimo' | 'mediana3' | 'azar') ───────────
/** Generador pseudoaleatorio determinista (mulberry32): las trazas «al azar» son reproducibles. */
export function aleatorio(semilla = 1) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const PIVOTES = {
  ultimo: { es: 'último elemento', en: 'last element' },
  mediana3: { es: 'mediana de tres', en: 'median of three' },
  azar: { es: 'elemento al azar', en: 'random element' },
};

/** Una partición de Lomuto sobre a[lo..hi]; devuelve la posición final p del pivote. Emite frames en T. */
function particionar(T, a, lo, hi, pivote, ok, azar) {
  const L = LINEAS.quicksort;
  let pi = hi;
  const [fx, fy] = [PIVOTES[pivote].es, PIVOTES[pivote].en];
  if (pivote === 'mediana3' && hi - lo >= 2) {
    const mid = lo + ((hi - lo) >> 1), antes = [a[lo], a[mid], a[hi]], pares = [];
    for (const [x, y] of [[mid, lo], [hi, lo], [hi, mid]]) {
      T.cont.comparaciones++;
      if (a[x] < a[y]) { [a[x], a[y]] = [a[y], a[x]]; T.cont.intercambios++; pares.push([x, y]); }
    }
    pi = mid;
    T.emite({
      line: L.elegir, ...(pares.length && { intercambiar: pares }), marcas: { lo, mid, hi }, est: { ...ok, [lo]: 'cmp', [mid]: 'cmp', [hi]: 'cmp' },
      es: `Mediana de tres: (${antes.join(', ')}) se ordena como (${a[lo]}, ${a[mid]}, ${a[hi]}). El pivote es ${a[mid]}.`,
      en: `Median of three: (${antes.join(', ')}) becomes (${a[lo]}, ${a[mid]}, ${a[hi]}). The pivot is ${a[mid]}.`,
    });
  } else if (pivote === 'azar') pi = lo + Math.floor(azar() * (hi - lo + 1));
  const piv = a[pi];
  if (pi !== hi) {
    [a[pi], a[hi]] = [a[hi], a[pi]]; T.cont.intercambios++;
    T.emite({
      line: L.elegir, intercambiar: [pi, hi], marcas: { piv: hi }, est: { ...ok, [hi]: 'piv' },
      es: `Pivote (${fx}) = ${piv}: se lleva al final con un intercambio.`, en: `Pivot (${fy}) = ${piv}: moved to the end with a swap.`,
    });
  } else {
    T.emite({
      line: L.elegir, marcas: { piv: hi }, est: { ...ok, [hi]: 'piv' },
      es: `Pivote (${fx}) = ${piv}: ya está al final.`, en: `Pivot (${fy}) = ${piv}: already at the end.`,
    });
  }
  const base = extra => ({ ...ok, [hi]: 'piv', ...extra });
  let i = lo;
  T.emite({
    line: L.piv, marcas: { piv: hi, i, j: lo }, est: base(),
    es: `\`i\` = ${i}: aquí irá el próximo elemento menor que ${piv}.`, en: `\`i\` = ${i}: the next element smaller than ${piv} goes here.`,
  });
  for (let j = lo; j < hi; j++) {
    T.cont.comparaciones++;
    const v = a[j], menor = v < piv;
    T.emite({
      line: L.cmp, marcas: { piv: hi, i, j }, est: base({ [j]: 'cmp' }),
      es: `\`a[${j}]\` = ${v} ${menor ? '<' : '>='} ${piv}: ${menor ? 'va a la zona de menores' : 'se queda a la derecha'}.`,
      en: `\`a[${j}]\` = ${v} ${menor ? '<' : '>='} ${piv}: ${menor ? 'goes to the smaller zone' : 'stays on the right'}.`,
    });
    if (!menor) continue;
    if (i !== j) {
      [a[i], a[j]] = [a[j], a[i]]; T.cont.intercambios++;
      T.emite({
        line: L.swap, intercambiar: [i, j], marcas: { piv: hi, i: i + 1, j }, est: base({ [i]: 'sel', [j]: 'sel' }),
        es: `Intercambia \`a[${i}]\` y \`a[${j}]\`; \`i\` avanza.`, en: `Swap \`a[${i}]\` and \`a[${j}]\`; \`i\` moves on.`,
      });
    } else {
      T.emite({
        line: L.swap, marcas: { piv: hi, i: i + 1, j }, est: base(),
        es: '`i` = `j`: no hay nada que mover; `i` avanza.', en: '`i` = `j`: nothing to move; `i` moves on.',
      });
    }
    i++;
  }
  if (i !== hi) {
    [a[i], a[hi]] = [a[hi], a[i]]; T.cont.intercambios++;
    ok[i] = 'ok';
    T.emite({
      line: L.ultimo, intercambiar: [i, hi], marcas: {}, est: { ...ok },
      es: `Intercambia el pivote con \`a[${i}]\`: ${piv} queda en su posición definitiva.`, en: `Swap the pivot with \`a[${i}]\`: ${piv} is now in its final position.`,
    });
  } else {
    ok[i] = 'ok';
    T.emite({
      line: L.ultimo, marcas: {}, est: { ...ok },
      es: `Todos eran menores: ${piv} ya estaba en su posición definitiva.`, en: `All were smaller: ${piv} was already in its final position.`,
    });
  }
  return i;
}

/** Quicksort completo. o.pivote: 'ultimo' (por defecto) | 'mediana3' | 'azar'; o.semilla para 'azar'. */
export function trazaQuicksort(a0, o = {}) {
  const a = [...a0], n = a.length, pivote = o.pivote ?? 'ultimo', azar = aleatorio(o.semilla ?? 1), ok = {};
  const T = new Cinta({ comparaciones: 0, intercambios: 0 }), L = LINEAS.quicksort;
  function rec(lo, hi) {
    if (lo > hi) return;
    if (lo === hi) {
      ok[lo] = 'ok';
      T.emite({
        line: L.base, rango: [lo, lo], marcas: {}, est: { ...ok },
        es: `\`a[${lo}]\` solo: un elemento ya está en su sitio.`, en: `\`a[${lo}]\` alone: one element is already in place.`,
      });
      return;
    }
    T.emite({
      line: L.llama, rango: [lo, hi], marcas: { lo, hi }, est: { ...ok },
      es: `Ordena \`a[${lo}..${hi}]\`: primero se particiona.`, en: `Sort \`a[${lo}..${hi}]\`: partition first.`,
    });
    const p = particionar(T, a, lo, hi, pivote, ok, azar);
    rec(lo, p - 1); rec(p + 1, hi);
  }
  rec(0, n - 1);
  if (n > 0) T.emite({ line: L.fin, rango: null, marcas: {}, est: todosOk(n), es: 'Todo el array está ordenado.', en: 'The whole array is sorted.' });
  return T.fin(a);
}

/** Una sola partición de Lomuto sobre a[lo..hi] (para explicarla despacio). Extra: p = posición final del pivote. */
export function trazaLomuto(a0, lo = 0, hi = a0.length - 1, o = {}) {
  const a = [...a0], ok = {}, T = new Cinta({ comparaciones: 0, intercambios: 0 }, { rango: hi > lo ? [lo, hi] : null });
  if (hi <= lo) return T.fin(a, { p: lo });
  const p = particionar(T, a, lo, hi, o.pivote ?? 'ultimo', ok, aleatorio(o.semilla ?? 1));
  T.emite({
    line: LINEAS.quicksort.ret, marcas: { piv: p },
    es: `Devuelve ${p}: a la izquierda, menores que ${a[p]}; a la derecha, mayores o iguales.`, en: `Returns ${p}: smaller than ${a[p]} on the left, greater or equal on the right.`,
  });
  return T.fin(a, { p });
}

// ── Partición de Hoare (dos índices que se acercan; el pivote NO queda necesariamente en su sitio) ──────────────
export function trazaHoare(a0, lo = 0, hi = a0.length - 1) {
  const a = [...a0], L = LINEAS.hoare, T = new Cinta({ comparaciones: 0, intercambios: 0 }, { rango: hi > lo ? [lo, hi] : null });
  if (hi <= lo) return T.fin(a, { j: lo });
  const mid = lo + ((hi - lo) >> 1), piv = a[mid];
  let pp = mid, i = lo - 1, j = hi + 1;
  const est = extra => ({ [pp]: 'piv', ...extra });
  T.emite({
    line: L.piv, marcas: { piv: pp }, est: est(),
    es: `Pivote = \`a[${mid}]\` = ${piv}, el elemento del medio.`, en: `Pivot = \`a[${mid}]\` = ${piv}, the middle element.`,
  });
  T.emite({
    line: L.ini, marcas: { piv: pp, i, j }, est: est(),
    es: `\`i\` = ${i} y \`j\` = ${j}: empiezan fuera, uno a cada lado.`, en: `\`i\` = ${i} and \`j\` = ${j}: they start outside, one on each side.`,
  });
  for (;;) {
    do {
      i++; T.cont.comparaciones++;
      const v = a[i], sigue = v < piv;
      T.emite({
        line: L.scanI, marcas: { piv: pp, i, j }, est: est({ [i]: 'cmp' }),
        es: `\`i\` = ${i}: ${v} ${sigue ? '<' : '>='} ${piv}${sigue ? ', sigue' : ': se detiene'}.`, en: `\`i\` = ${i}: ${v} ${sigue ? '<' : '>='} ${piv}${sigue ? ', keeps going' : ': stops'}.`,
      });
    } while (a[i] < piv);
    do {
      j--; T.cont.comparaciones++;
      const v = a[j], sigue = v > piv;
      T.emite({
        line: L.scanJ, marcas: { piv: pp, i, j }, est: est({ [i]: 'cmp', [j]: 'cmp' }),
        es: `\`j\` = ${j}: ${v} ${sigue ? '>' : '<='} ${piv}${sigue ? ', sigue' : ': se detiene'}.`, en: `\`j\` = ${j}: ${v} ${sigue ? '>' : '<='} ${piv}${sigue ? ', keeps going' : ': stops'}.`,
      });
    } while (a[j] > piv);
    if (i >= j) {
      T.emite({
        line: L.cruce, est: est(),
        es: `\`i\` = ${i} >= \`j\` = ${j}: se han cruzado. Devuelve ${j}: \`a[${lo}..${j}]\` <= pivote <= \`a[${j + 1}..${hi}]\`.`,
        en: `\`i\` = ${i} >= \`j\` = ${j}: they crossed. Returns ${j}: \`a[${lo}..${j}]\` <= pivot <= \`a[${j + 1}..${hi}]\`.`,
      });
      return T.fin(a, { j });
    }
    [a[i], a[j]] = [a[j], a[i]]; T.cont.intercambios++;
    if (pp === i) pp = j; else if (pp === j) pp = i;
    T.emite({
      line: L.swap, intercambiar: [i, j], marcas: { piv: pp, i, j }, est: est({ [i]: 'sel', [j]: 'sel' }),
      es: `Intercambia \`a[${i}]\` y \`a[${j}]\`: cada uno pasa a su lado.`, en: `Swap \`a[${i}]\` and \`a[${j}]\`: each one goes to its side.`,
    });
  }
}

// ── Búsqueda binaria (y lower/upper bound): contador `iteraciones` ───────────────────────────────────────────────
const tramo = (lo, hi) => (lo <= hi ? [lo, hi] : null);

/** Busca x en a (ordenado). Extra: idx = posición o -1. */
export function trazaBinaria(a, x) {
  const n = a.length, L = LINEAS.binaria, T = new Cinta({ iteraciones: 0 }, { marcas: { lo: 0, hi: n - 1 }, rango: tramo(0, n - 1), est: {} });
  let lo = 0, hi = n - 1;
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    T.cont.iteraciones++;
    T.emite({
      line: L.mid, marcas: { lo, mid, hi }, est: { [mid]: 'cmp' },
      es: `\`mid\` = ${lo} + (${hi} - ${lo}) / 2 = ${mid}; \`a[${mid}]\` = ${a[mid]}.`, en: `\`mid\` = ${lo} + (${hi} - ${lo}) / 2 = ${mid}; \`a[${mid}]\` = ${a[mid]}.`,
    });
    if (a[mid] === x) {
      T.emite({ line: L.igual, est: { [mid]: 'ok' }, es: `${a[mid]} == ${x}: encontrado en la posición ${mid}.`, en: `${a[mid]} == ${x}: found at position ${mid}.` });
      return T.fin([...a], { idx: mid });
    }
    if (a[mid] < x) {
      lo = mid + 1;
      T.emite({ line: L.menor, marcas: { lo, hi }, rango: tramo(lo, hi), est: {}, es: `${a[mid]} < ${x}: la mitad izquierda sobra, \`lo\` = ${lo}.`, en: `${a[mid]} < ${x}: drop the left half, \`lo\` = ${lo}.` });
    } else {
      hi = mid - 1;
      T.emite({ line: L.mayor, marcas: { lo, hi }, rango: tramo(lo, hi), est: {}, es: `${a[mid]} > ${x}: la mitad derecha sobra, \`hi\` = ${hi}.`, en: `${a[mid]} > ${x}: drop the right half, \`hi\` = ${hi}.` });
    }
  }
  T.emite({ line: L.fuera, marcas: {}, rango: null, est: {}, es: `\`lo\` = ${lo} > \`hi\` = ${hi}: no quedan candidatos; ${x} no está.`, en: `\`lo\` = ${lo} > \`hi\` = ${hi}: no candidates left; ${x} is not there.` });
  return T.fin([...a], { idx: -1 });
}

/** lower_bound (o.superior = false) / upper_bound (true) a mano: primera posición con a[i] >= x (o > x). Extra: pos. */
export function trazaLimite(a, x, superior = false) {
  const n = a.length, L = LINEAS.limite, T = new Cinta({ iteraciones: 0 }, { marcas: { lo: 0, hi: n }, rango: tramo(0, n - 1), est: {} });
  const op = superior ? '<=' : '<', no = superior ? '>' : '>=';
  let lo = 0, hi = n;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1), sube = superior ? a[mid] <= x : a[mid] < x;
    T.cont.iteraciones++;
    T.emite({
      line: L.mid, marcas: { lo, mid, hi }, est: { [mid]: 'cmp' },
      es: `\`mid\` = ${mid}: ${a[mid]} ${sube ? op : no} ${x}.`, en: `\`mid\` = ${mid}: ${a[mid]} ${sube ? op : no} ${x}.`,
    });
    if (sube) lo = mid + 1; else hi = mid;
    T.emite({
      line: sube ? L.sube : L.baja, marcas: { lo, hi }, rango: tramo(lo, hi - 1), est: {},
      es: sube ? `Sube: \`lo\` = ${lo}. El primer candidato está a la derecha de \`mid\`.` : `Baja: \`hi\` = ${hi}. \`mid\` sigue siendo candidato.`,
      en: sube ? `Up: \`lo\` = ${lo}. The first candidate is to the right of \`mid\`.` : `Down: \`hi\` = ${hi}. \`mid\` is still a candidate.`,
    });
  }
  T.emite({
    line: L.ret, marcas: { lo, hi }, rango: null, est: lo < n ? { [lo]: 'ok' } : {},
    es: `\`lo\` = \`hi\` = ${lo}: ${lo < n ? `\`a[${lo}]\` = ${a[lo]} es el primero ${superior ? '> ' : '>= '}${x}` : `ningún elemento es ${superior ? '> ' : '>= '}${x}; devuelve n`}.`,
    en: `\`lo\` = \`hi\` = ${lo}: ${lo < n ? `\`a[${lo}]\` = ${a[lo]} is the first ${superior ? '> ' : '>= '}${x}` : `no element is ${superior ? '> ' : '>= '}${x}; returns n`}.`,
  });
  return T.fin([...a], { pos: lo });
}

// ── Dos punteros sobre array ordenado ────────────────────────────────────────────────────────────────────────────
/** ¿Hay i < j con a[i] + a[j] == objetivo? Extra: par = [i, j] o null. Contador `iteraciones`. */
export function trazaDosPunteros(a, objetivo) {
  const n = a.length, L = LINEAS.dosPunteros, T = new Cinta({ iteraciones: 0 }, { marcas: { i: 0, j: n - 1 }, rango: tramo(0, n - 1), est: {} });
  let i = 0, j = n - 1;
  while (i < j) {
    const s = a[i] + a[j];
    T.cont.iteraciones++;
    if (s === objetivo) {
      T.emite({ line: L.igual, est: { [i]: 'ok', [j]: 'ok' }, es: `${a[i]} + ${a[j]} = ${s} = ${objetivo}: par encontrado en (${i}, ${j}).`, en: `${a[i]} + ${a[j]} = ${s} = ${objetivo}: pair found at (${i}, ${j}).` });
      return T.fin([...a], { par: [i, j] });
    }
    if (s < objetivo) {
      const x = a[i]; i++;
      T.emite({ line: L.sube, marcas: { i, j }, rango: tramo(i, j), est: { [i - 1]: 'cmp', [j]: 'cmp' }, es: `${x} + ${a[j]} = ${s} < ${objetivo}: hace falta más, \`i\` avanza.`, en: `${x} + ${a[j]} = ${s} < ${objetivo}: we need more, \`i\` moves right.` });
    } else {
      const y = a[j]; j--;
      T.emite({ line: L.baja, marcas: { i, j }, rango: tramo(i, j), est: { [i]: 'cmp', [j + 1]: 'cmp' }, es: `${a[i]} + ${y} = ${s} > ${objetivo}: sobra, \`j\` retrocede.`, en: `${a[i]} + ${y} = ${s} > ${objetivo}: too much, \`j\` moves left.` });
    }
  }
  T.emite({ line: L.fuera, marcas: {}, rango: null, est: {}, es: `\`i\` ha alcanzado a \`j\`: no hay ningún par que sume ${objetivo}.`, en: `\`i\` has met \`j\`: no pair adds up to ${objetivo}.` });
  return T.fin([...a], { par: null });
}

// ── Ventana deslizante de tamaño k ───────────────────────────────────────────────────────────────────────────────
/** Mayor suma de k elementos seguidos (k <= n). Extra: mejor, desde. Contadores = valores `suma` y `mejor`. */
export function trazaVentana(a, k) {
  const n = a.length, L = LINEAS.ventana;
  let s = 0;
  for (let i = 0; i < k; i++) s += a[i];
  let mejor = s, desde = 0;
  const T = new Cinta({ suma: s, mejor }, { rango: [0, k - 1], est: todosOk(k), marcas: {} });
  for (let i = k; i < n; i++) {
    const [entra, sale] = [a[i], a[i - k]];
    s += entra - sale;
    const sube = s > mejor;
    if (sube) { mejor = s; desde = i - k + 1; }
    T.cont.suma = s; T.cont.mejor = mejor;
    T.emite({
      line: L.desliza, rango: [i - k + 1, i], marcas: { i }, est: ventanaOk(desde, k),
      es: `Entra ${entra}, sale ${sale}: suma = ${s}${sube ? `, nuevo mejor (${mejor})` : `, el mejor sigue siendo ${mejor}`}.`,
      en: `${entra} comes in, ${sale} goes out: sum = ${s}${sube ? `, new best (${mejor})` : `, the best is still ${mejor}`}.`,
    });
  }
  T.emite({
    line: L.fin, rango: null, marcas: {}, est: ventanaOk(desde, k),
    es: `La mejor ventana es \`a[${desde}..${desde + k - 1}]\`, con suma ${mejor}.`, en: `The best window is \`a[${desde}..${desde + k - 1}]\`, with sum ${mejor}.`,
  });
  return T.fin([...a], { mejor, desde });
}

// ── Counting sort (no compara: `comparaciones` se queda en 0) ───────────────────────────────────────────────────
/** a con valores enteros en 0..M-1. La fila aux hace de `cuenta` (M huecos). */
export function trazaConteo(a0, M) {
  const a = [...a0], n = a.length, cuenta = Array(M).fill(0), L = LINEAS.conteo;
  const T = new Cinta({ comparaciones: 0, escrituras: 0 }, { marcas: {}, est: {} });
  T.inicial.aux = Object.fromEntries(cuenta.map((c, v) => [v, c]));
  for (let i = 0; i < n; i++) {
    const v = a[i]; cuenta[v]++; T.cont.escrituras++;
    T.emite({
      line: L.cuenta, aux: { [v]: cuenta[v] }, marcas: { i }, est: { [i]: 'cmp' },
      es: `Lee \`a[${i}]\` = ${v}: \`cuenta[${v}]\` pasa a ${cuenta[v]}. Sin comparar.`, en: `Read \`a[${i}]\` = ${v}: \`cuenta[${v}]\` becomes ${cuenta[v]}. No comparison.`,
    });
  }
  let k = 0;
  for (let v = 0; v < M; v++) {
    while (cuenta[v] > 0) {
      cuenta[v]--; a[k] = v; T.cont.escrituras++;
      T.emite({
        line: L.escribe, poner: { [k]: v }, aux: { [v]: cuenta[v] }, marcas: { k }, est: todosOk(k + 1),
        es: `Escribe ${v} en \`a[${k}]\`; quedan ${cuenta[v]} por escribir de ese valor.`, en: `Write ${v} to \`a[${k}]\`; ${cuenta[v]} left to write of that value.`,
      });
      k++;
    }
  }
  if (n > 0) T.emite({ line: L.escribe, marcas: {}, es: 'Ordenado sin hacer una sola comparación entre elementos.', en: 'Sorted without a single comparison between elements.' });
  return T.fin(a);
}

// ── Utilidades para el laboratorio ──────────────────────────────────────────────────────────────────────────────
/** Los algoritmos de la carrera: nombre → generador (todos devuelven `cont.comparaciones` e `intercambios` o `copias`). */
export const ALGORITMOS = {
  burbuja: { nombre: { es: 'burbuja', en: 'bubble' }, traza: trazaBurbuja },
  insercion: { nombre: { es: 'inserción', en: 'insertion' }, traza: trazaInsercion },
  seleccion: { nombre: { es: 'selección', en: 'selection' }, traza: trazaSeleccion },
  merge: { nombre: { es: 'merge', en: 'merge' }, traza: trazaMergesort },
  quick: { nombre: { es: 'quicksort (último)', en: 'quicksort (last)' }, traza: a => trazaQuicksort(a) },
  quick3: { nombre: { es: 'quicksort (mediana de 3)', en: 'quicksort (median of 3)' }, traza: a => trazaQuicksort(a, { pivote: 'mediana3' }) },
};

/** Permutación pseudoaleatoria de 1..n (Fisher-Yates con semilla). */
export function permutacion(n, semilla = 7) {
  const r = aleatorio(semilla), a = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Datos de una forma dada: 'aleatorio' | 'ordenado' | 'inverso' | 'casi' (ordenado con unos pocos pares vecinos cruzados). */
export function datos(forma, n, semilla = 7) {
  const a = Array.from({ length: n }, (_, i) => i + 1);
  if (forma === 'ordenado') return a;
  if (forma === 'inverso') return a.reverse();
  if (forma === 'casi') { for (let i = 2; i + 1 < n; i += Math.max(4, Math.round(n / 3))) [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; }
  return permutacion(n, semilla);
}

/** Contadores de cada algoritmo sobre cada forma de datos con n elementos: { forma: { alg: cont } } (se ejecutan los generadores). */
export function costes(n = 16, formas = ['aleatorio', 'ordenado', 'inverso', 'casi']) {
  return Object.fromEntries(formas.map(f => [f, Object.fromEntries(Object.entries(ALGORITMOS).map(([id, A]) => [id, A.traza(datos(f, n)).cont]))]));
}

/** Mínimo de intercambios (de dos posiciones cualesquiera) para ordenar una permutación de valores distintos: n − ciclos. */
export function minIntercambios(a) {
  const orden = [...a].sort((x, y) => x - y), destino = a.map(x => orden.indexOf(x)), visto = Array(a.length).fill(false);
  let ciclos = 0;
  for (let i = 0; i < a.length; i++) if (!visto[i]) { ciclos++; for (let j = i; !visto[j]; j = destino[j]) visto[j] = true; }
  return a.length - ciclos;
}

/** Mínimo de movimientos de «sacar un elemento y reinsertarlo en otro sitio» (lo que hace arrastrar una barra): n − subsecuencia creciente más larga. */
export function minArrastres(a) {
  const cola = [];
  for (const x of a) { let lo = 0, hi = cola.length; while (lo < hi) { const m = (lo + hi) >> 1; if (cola[m] < x) lo = m + 1; else hi = m; } cola[lo] = x; }
  return a.length - cola.length;
}

/** Posiciones de UNA subsecuencia creciente (estricta) más larga de a (DP O(n²): n ≤ 32). */
export function subsecuenciaCreciente(a) {
  const n = a.length, len = Array(n).fill(1), prev = Array(n).fill(-1);
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (a[j] < a[i] && len[j] + 1 > len[i]) { len[i] = len[j] + 1; prev[i] = j; }
  let fin = 0;
  for (let i = 1; i < n; i++) if (len[i] > len[fin]) fin = i;
  const r = [];
  for (let i = n ? fin : -1; i >= 0; i = prev[i]) r.unshift(i);
  return r;
}

/** Posiciones que habrá que mover como mínimo al arrastrar (las que no están en la subsecuencia creciente elegida). */
export function fueraDeCreciente(a) {
  const dentro = new Set(subsecuenciaCreciente(a));
  return a.map((_, i) => i).filter(i => !dentro.has(i));
}
