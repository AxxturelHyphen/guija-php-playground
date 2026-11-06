// Generadores de trazas y helpers puros de la guía «Hashing y técnicas» (data/hashing.js). Todo EJECUTA el algoritmo de verdad
// (tabla hash con encadenamiento y rehash, sondeo lineal, sumas prefijas, diferencias, Union-Find, Kruskal, conjunto hash,
// dos sumas) y devuelve los frames: colisiones, factor de carga α, alturas y sumas salen de ejecutar, no de escribirlas.
// Sin DOM: se prueba en Node con tests/guias/test-hashing.js. Un frame es un parche acumulativo de la escena activa más
// `line`, `es` y `en` (subtítulo). Formatos: cabeceras de escena.js (celdas), barras.js, arbol.js.
import { disenar } from '../arbol.js';

const f = (o, es, en, line) => ({ ...o, es, en, ...(line != null && { line }) });
const esEn = () => globalThis.document?.documentElement.lang === 'en'; // idioma activo (las lecturas de `jugar` no son bilingües)
/** Texto según el idioma activo (solo para lecturas de `jugar`, que son cadenas planas). */
export const tr = (es, ing) => (esEn() ? ing : es);
const cel = (id, addr, name, type, size, col = 0, grupo) => ({ id, addr, name, type, size, col, ...(grupo && { grupo }) });
const hex = x => '0x' + x.toString(16);
const nulos = ks => Object.fromEntries(ks.map(k => [k, null]));
const redondea = (x, d = 2) => (Math.round(x * 10 ** d) / 10 ** d).toString();

// ══ Estado de «celdas» como (vis, val) y parches mínimos entre dos estados ═════════════════════════════════════════
const copia = e => ({ vis: new Set(e.vis), val: { ...e.val } });
/** Parche de «celdas» que lleva el estado `a` al `b` (a, b = {vis:Set, val:{}}). */
export function parche(a, b) {
  const p = {}, mos = [...b.vis].filter(x => !a.vis.has(x)), oc = [...a.vis].filter(x => !b.vis.has(x)), val = {};
  if (mos.length) p.mostrar = mos;
  if (oc.length) p.ocultar = oc;
  for (const [k, v] of Object.entries(b.val)) if (a.val[k] !== v) val[k] = v;
  if (Object.keys(val).length) p.val = val;
  return p;
}
const VACIO = { vis: new Set(), val: {} };
/** Aplica un parche de celdas a un estado (para las pruebas y para encadenar). */
export function aplica(e, p) {
  const r = copia(e);
  for (const x of p.mostrar || []) r.vis.add(x);
  for (const x of p.ocultar || []) r.vis.delete(x);
  Object.assign(r.val, p.val);
  return r;
}

// ══ 1. Tabla hash con encadenamiento ═══════════════════════════════════════════════════════════════════════════════
export const CLAVES = [12, 9, 7, 19, 26, 14, 31]; // una celda-nodo por clave que pueda entrar
export const NB = 7;                               // cubos reservados en la escena (m = 3, tras el rehash m = 7)
export const M0 = 3;
const ptr = x => (x == null ? '→∅' : '→k' + x);

/** Modelo de referencia de la tabla de la guía: m cubos, cada uno una cadena (lista, la clave nueva va DELANTE). */
export class TablaHash {
  constructor(m = M0) { this.m = m; this.n = 0; this.c = Array.from({ length: m }, () => []); }
  clon() { const t = new TablaHash(this.m); t.n = this.n; t.c = this.c.map(x => [...x]); return t; }
  get alfa() { return this.n / this.m; }
  h(k) { return k % this.m; }
  /** → {hallado, comparaciones (nodos mirados), cubo} */
  buscar(k) {
    const cubo = this.h(k), ch = this.c[cubo], i = ch.indexOf(k);
    return { hallado: i >= 0, comparaciones: i >= 0 ? i + 1 : ch.length, cubo };
  }
  /** Coloca sin rehash (como mucho hasta que n > m). → {nuevo, cubo, colision (el cubo ya tenía nodos)} */
  colocar(k) {
    const cubo = this.h(k), colision = this.c[cubo].length > 0;
    if (this.c[cubo].includes(k)) return { nuevo: false, cubo, colision };
    this.c[cubo].unshift(k); this.n++;
    return { nuevo: true, cubo, colision };
  }
  /** Recoloca todas las claves en m2 cubos (recorre los cubos viejos en orden, cadena de cabeza a cola). */
  rehash(m2) {
    const viejo = this.c.flat(); this.m = m2; this.c = Array.from({ length: m2 }, () => []);
    for (const k of viejo) this.c[k % m2].unshift(k);
  }
  /** insertar de la guía: sin repetidos; si tras insertar n > m, rehash a 2m+1. → {nuevo, cubo, colision, rehash} */
  insertar(k) {
    const r = this.colocar(k); let reh = false;
    if (r.nuevo && this.n > this.m) { this.rehash(2 * this.m + 1); reh = true; }
    return { ...r, rehash: reh };
  }
  borrar(k) {
    const ch = this.c[this.h(k)], i = ch.indexOf(k);
    if (i < 0) return false;
    ch.splice(i, 1); this.n--; return true;
  }
  claves() { return new Set(this.c.flat()); }
  maxCadena() { return Math.max(0, ...this.c.map(x => x.length)); }
}

export const CELDAS_TABLA = [
  cel('n', '0x7ffd5c30', 'n', 'int', 4, 0, 'gt'),
  cel('m', '0x7ffd5c34', 'm', 'int', 4, 0, 'gt'),
  cel('it', '0x7ffd5c38', 'it', { es: 'nodo que se mira', en: 'node being read' }, 8, 0, 'gt'),
  ...Array.from({ length: NB }, (_, i) => cel('b' + i, hex(0x55d3a0e1c0 + 8 * i), { es: `cubo [${i}]`, en: `bucket [${i}]` }, { es: '→ primer nodo', en: '→ first node' }, 8)),
  ...CLAVES.map((k, i) => cel('k' + k, hex([0x55d3a1f340, 0x55d3a1f9d0, 0x55d3a1f410, 0x55d3a1f8a0, 0x55d3a1f520, 0x55d3a1f7b0, 0x55d3a1f630][i]), { es: `nodo ${k}`, en: `node ${k}` }, { es: 'clave+sig.', en: 'key+next' }, 16, 1)),
];
export const GRUPOS_TABLA = [{ id: 'gt', titulo: 'TablaHash t' }];
export const ZONAS_TABLA = [{ col: 0, titulo: { es: 'cubos (array en el heap)', en: 'buckets (array in the heap)' }, tono: 'heap' }, { col: 1, titulo: { es: 'nodos de las cadenas', en: 'chain nodes' }, tono: 'heap' }];

/** Estado (vis, val) de la escena para una tabla; `act` = '→kX' | '→∅' muestra el nodo que se está mirando. */
export function estadoTabla(t, act) {
  const vis = new Set(['n', 'm']), val = { n: t.n, m: t.m, it: '→∅' };
  for (let i = 0; i < NB; i++) {
    const c = t.c[i];
    if (i < t.m) vis.add('b' + i);
    val['b' + i] = i >= t.m ? '—' : ptr(c[0]);
  }
  for (const k of CLAVES) val['k' + k] = '—';
  for (const c of t.c) c.forEach((k, j) => { vis.add('k' + k); val['k' + k] = ptr(c[j + 1]); });
  if (act !== undefined) { vis.add('it'); val.it = act; }
  return { vis, val };
}
/** Valores de TODAS las celdas con todo visible (para `jugar`, que no puede mostrar ni ocultar): lo libre = «—». */
export function valTabla(t) {
  const { val } = estadoTabla(t); delete val.it; return val;
}
/** Reconstruye la tabla leyendo los valores de la escena (cubos → cadenas de punteros). */
export function tablaDe(v) {
  const t = new TablaHash(v.m);
  for (let i = 0; i < v.m; i++) {
    for (let p = v['b' + i], g = 0; typeof p === 'string' && p.startsWith('→k') && g <= NB; p = v[p.slice(1)], g++) { t.c[i].push(+p.slice(2)); t.n++; }
  }
  return t;
}

/** Parche (mostrar / val) que lleva la escena del estado `ant` al de la tabla `t`. */
export const parcheTabla = (ant, t) => parche(ant ? estadoTabla(ant) : VACIO, estadoTabla(t));

/** buscar(k): recorre la cadena del cubo h(k). Líneas del listado C1 (6 = bucle, 7 = return false). */
export function trazaBuscar(t, k) {
  const E = estadoTabla(t), j = k % t.m, ch = t.c[j], F = [];
  let prev = E;
  const con = a => { const e = copia(E); e.vis.add('it'); e.val.it = a; return e; };
  const push = (e, es, en, line) => { F.push(f(parche(prev, e), es, en, line)); prev = e; };
  if (!ch.length) {
    push(con('→∅'), `h(${k}) = ${k} mod ${t.m} = ${j}: el cubo ${j} está vacío.`, `h(${k}) = ${k} mod ${t.m} = ${j}: bucket ${j} is empty.`, 6);
    push(con('→∅'), `No hay nodos que mirar: ${k} no está, devuelve false.`, `No nodes to read: ${k} is not there, returns false.`, 7);
    return { frames: F, hallado: false, comparaciones: 0, cubo: j };
  }
  push(con(ptr(ch[0])), `h(${k}) = ${k} mod ${t.m} = ${j}: se recorre la cadena del cubo ${j}, desde su primer nodo.`, `h(${k}) = ${k} mod ${t.m} = ${j}: walk the chain of bucket ${j}, from its first node.`, 6);
  let comp = 0, hallado = false;
  for (let i = 0; i < ch.length; i++) {
    comp++;
    if (ch[i] === k) {
      push(con(ptr(ch[i])), `${ch[i]} == ${k}: encontrado tras mirar ${comp} nodo${comp > 1 ? 's' : ''}. Devuelve true.`, `${ch[i]} == ${k}: found after reading ${comp} node${comp > 1 ? 's' : ''}. Returns true.`, 6);
      hallado = true; break;
    }
    push(con(ptr(ch[i + 1])), `${ch[i]} != ${k}: pasa al siguiente nodo.`, `${ch[i]} != ${k}: move on to the next node.`, 6);
  }
  if (!hallado) push(con('→∅'), `Fin de la cadena sin encontrar ${k}: devuelve false (${comp} comparaciones).`, `End of the chain without finding ${k}: returns false (${comp} comparisons).`, 7);
  return { frames: F, hallado, comparaciones: comp, cubo: j };
}

/** borrar(k) (listado C_BORRAR: 2 = cadena, 3 = bucle, 4 = erase). → {frames, tabla (ya sin k), borrado} */
export function trazaBorrar(t, k) {
  const E = estadoTabla(t), j = k % t.m, ch = t.c[j], F = [], t2 = t.clon();
  let prev = E;
  const con = a => { const e = copia(E); e.vis.add('it'); e.val.it = a; return e; };
  const push = (e, es, en, line) => { F.push(f(parche(prev, e), es, en, line)); prev = e; };
  push(con(ptr(ch[0])), `cadena = cubo ${j} (${k} mod ${t.m}). El iterador empieza en su primer nodo.`, `cadena = bucket ${j} (${k} mod ${t.m}). The iterator starts at its first node.`, 2);
  for (let i = 0; i < ch.length; i++) {
    if (ch[i] === k) {
      t2.borrar(k);
      const quien = i === 0 ? `el cubo ${j}` : `el nodo ${ch[i - 1]}`, who = i === 0 ? `bucket ${j}` : `node ${ch[i - 1]}`;
      push(estadoTabla(t2), `${k} encontrado: ${quien} salta al siguiente nodo y el ${k} sale de la cadena. n baja a ${t2.n}.`, `${k} found: ${who} skips to the next node and ${k} leaves the chain. n drops to ${t2.n}.`, 4);
      return { frames: F, tabla: t2, borrado: true };
    }
    push(con(ptr(ch[i + 1])), `${ch[i]} != ${k}: siguiente.`, `${ch[i]} != ${k}: next.`, 3);
  }
  push(con('→∅'), `Fin de la cadena: ${k} no estaba, no se borra nada.`, `End of the chain: ${k} was not there, nothing is erased.`, 3);
  return { frames: F, tabla: t2, borrado: false };
}

/** rehash a 2m+1 cubos (listado C_REHASH: 2 = reservar, 4 = tomar, 5 = push_front, 7 = fin). → {frames, tabla} */
export function trazaRehash(t) {
  const m2 = 2 * t.m + 1, F = [], nuevo = Array.from({ length: m2 }, () => []), orden = t.c.flat();
  let prev = estadoTabla(t);
  const push = (e, es, en, line) => { F.push(f(parche(prev, e), es, en, line)); prev = e; };
  const A = copia(prev);
  for (let i = 0; i < m2; i++) { A.vis.add('b' + i); A.val['b' + i] = '→∅'; }
  for (const k of orden) A.val['k' + k] = '→∅';
  push(A, `nuevos(${m2}): ${m2} cubos vacíos. Cada clave se volverá a colocar con k mod ${m2}; las cadenas viejas se descartan.`, `nuevos(${m2}): ${m2} empty buckets. Every key will be placed again with k mod ${m2}; the old chains are dropped.`, 2);
  for (const k of orden) {
    const j = k % m2, B = copia(prev);
    B.vis.add('it'); B.val.it = ptr(k);
    push(B, `Se toma el ${k}: ${k} mod ${m2} = ${j}.`, `Take ${k}: ${k} mod ${m2} = ${j}.`, 4);
    const cabeza = nuevo[j][0];
    nuevo[j].unshift(k);
    const C = copia(B); C.val['b' + j] = ptr(k); C.val['k' + k] = ptr(cabeza);
    push(C, cabeza == null ? `push_front(${k}) en el cubo ${j}, que estaba vacío.` : `push_front(${k}) en el cubo ${j}: colisión con el ${cabeza}, que pasa a ser el siguiente.`,
      cabeza == null ? `push_front(${k}) into bucket ${j}, which was empty.` : `push_front(${k}) into bucket ${j}: collision with ${cabeza}, which becomes the next node.`, 5);
  }
  const t2 = new TablaHash(m2); t2.n = t.n; t2.c = nuevo;
  push(estadoTabla(t2), `m = ${m2}: ahora α = ${t.n}/${m2} = ${redondea(t2.alfa)}. Cadena más larga: ${t2.maxCadena()}. Coste del rehash: una pasada, O(n).`, `m = ${m2}: now α = ${t.n}/${m2} = ${redondea(t2.alfa)}. Longest chain: ${t2.maxCadena()}. Cost of the rehash: one pass, O(n).`, 7);
  return { frames: F, tabla: t2 };
}

// ══ 2. Distribución, cumpleaños, sondeo lineal ═════════════════════════════════════════════════════════════════════
/** Histograma de cubos: inserta `claves` con k mod m y cuenta. Escena barras (arr de m ceros, `max` ≥ el mayor). */
export function trazaHistograma(m, claves) {
  const cuentas = Array(m).fill(0), F = [];
  let ult = null;
  claves.forEach((k, i) => {
    const j = k % m; cuentas[j]++;
    const vacios = cuentas.filter(c => !c).length;
    F.push(f({ poner: { [j]: cuentas[j] }, marcas: { k: j }, est: { ...(ult != null && ult !== j && { [ult]: null }), [j]: 'cmp' }, cont: { claves: i + 1, vacios } },
      `${k} mod ${m} = ${j}: el cubo ${j} tiene ahora ${cuentas[j]}.`, `${k} mod ${m} = ${j}: bucket ${j} now holds ${cuentas[j]}.`));
    ult = j;
  });
  const usados = cuentas.filter(c => c).length, mayor = Math.max(...cuentas);
  F.push(f({ marcas: null, est: nulos([ult]) }, `Resultado: ${usados} cubo${usados > 1 ? 's' : ''} usado${usados > 1 ? 's' : ''} de ${m}; el más cargado tiene ${mayor} claves.`,
    `Result: ${usados} of ${m} buckets used; the fullest one holds ${mayor} keys.`));
  return { frames: F, cuentas, usados, mayor };
}

/** P(al menos una colisión) con n claves en m cubos (hash uniforme): 1 − ∏_{i<n}(1 − i/m). Con log1p para m grande. */
export function pColision(m, n) {
  if (n > m) return 1;
  let s = 0;
  for (let i = 1; i < n; i++) s += Math.log1p(-i / m);
  return 0 - Math.expm1(s); // (0 − x y no −x: evita un −0 cuando n ≤ 1)
}
/** Lo mismo con aritmética EXACTA (BigInt): P = 1 − m!/((m−n)!·mⁿ), como cadena decimal de `dec` cifras (para pruebas). */
export function pColisionExacta(m, n, dec = 15) {
  if (n > m) return '1';
  let num = 1n, den = 1n;
  for (let i = 0; i < n; i++) { num *= BigInt(m - i); den *= BigInt(m); }
  const esc = 10n ** BigInt(dec), x = ((den - num) * esc) / den, s = x.toString().padStart(dec + 1, '0');
  return s.slice(0, -dec) + '.' + s.slice(-dec);
}
/** Cota 1 − e^{−n(n−1)/2m} (la que da el orden √m). */
export const pCumpleAprox = (m, n) => 1 - Math.exp(-(n * (n - 1)) / (2 * m));
/** Factores c: n = ⌈c·√m⌉ (así la escena sirve para cualquier m). */
export const FACTORES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
export const nDe = (m, c) => Math.max(2, Math.ceil(c * Math.sqrt(m)));
/** Alturas de las barras (probabilidad en %, redondeada) para cada factor. */
export const barrasCumple = m => FACTORES.map(c => Math.round(100 * pColision(m, nDe(m, c))));
/** Menor n con P ≥ 0,5 (búsqueda lineal; solo para m moderados). */
export function nMediana(m) { for (let n = 1; n <= m + 1; n++) if (pColision(m, n) >= 0.5) return n; return m + 1; }

/** Sondeo lineal (open addressing): inserta cada clave en la primera ranura libre desde k mod m. Listado C_SONDEO. */
export function trazaSondeo(m, claves) {
  const ran = Array(m).fill(null), F = [], sondeos = [];
  for (const k of claves) {
    let i = k % m, s = 0;
    F.push(f({ mostrar: ['q', 'i'], val: { q: k, i } }, `Insertar ${k}: h(${k}) = ${k} mod ${m} = ${i}.`, `Insert ${k}: h(${k}) = ${k} mod ${m} = ${i}.`, 2));
    while (ran[i] !== null) {
      const sig = (i + 1) % m;
      F.push(f({ val: { i: sig } }, `La ranura ${i} está ocupada (${ran[i]}): se prueba la ${sig}${sig === 0 ? ', volviendo al principio' : ''}.`, `Slot ${i} is taken (${ran[i]}): try ${sig}${sig === 0 ? ', wrapping around' : ''}.`, 4));
      i = sig; s++;
    }
    ran[i] = k; sondeos.push(s);
    F.push(f({ val: { ['s' + i]: k } }, `La ranura ${i} está libre: se guarda el ${k}${s ? ` (tras ${s} sondeo${s > 1 ? 's' : ''})` : ''}.`, `Slot ${i} is free: ${k} is stored${s ? ` (after ${s} probe${s > 1 ? 's' : ''})` : ''}.`, 5));
  }
  return { frames: F, ranuras: ran, sondeos };
}
export const CELDAS_SONDEO = [
  cel('q', '0x7ffd5c50', 'k', 'int', 4, 0), cel('i', '0x7ffd5c54', 'i', 'int', 4, 0),
  ...Array.from({ length: 7 }, (_, i) => cel('s' + i, hex(0x55d3a2c100 + 4 * i), { es: `ranura [${i}]`, en: `slot [${i}]` }, 'int', 4, 0)),
];

// ══ 3. Sumas prefijas y diferencias ════════════════════════════════════════════════════════════════════════════════
export const ARR_PREF = [3, 1, 4, 1, 5, 9, 2, 6];
export const prefijas = a => a.reduce((P, x) => (P.push(P.at(-1) + x), P), [0]);
export const sumaRango = (P, l, r) => P[r + 1] - P[l];
/** Construcción de P: hueco k del `aux` = P[k]. Líneas del listado C_PREF (2 = P(n+1,0), 4 = P[i+1] = P[i] + a[i]). */
export function trazaPrefijas(a) {
  const P = prefijas(a), F = [];
  F.push(f({ aux: { 0: 0 } }, 'P[0] = 0: la suma de nada. Es el truco que evita casos especiales.', 'P[0] = 0: the sum of nothing. This trick avoids special cases.', 2));
  a.forEach((x, i) => F.push(f({ aux: { [i + 1]: P[i + 1] }, marcas: { i }, est: { ...(i > 0 && { [i - 1]: null }), [i]: 'cmp' } },
    `P[${i + 1}] = P[${i}] + a[${i}] = ${P[i]} + ${x} = ${P[i + 1]}.`, `P[${i + 1}] = P[${i}] + a[${i}] = ${P[i]} + ${x} = ${P[i + 1]}.`, 4)));
  F.push(f({ marcas: null, est: nulos([a.length - 1]) }, `Listo en una pasada, O(n): P[${a.length}] = ${P[a.length]} es la suma de todo.`, `Done in one pass, O(n): P[${a.length}] = ${P[a.length]} is the sum of everything.`, 5));
  return { frames: F, P };
}
export const CELDAS_DIF = [
  ...Array.from({ length: 9 }, (_, i) => cel('d' + i, hex(0x55d3a3a000 + 8 * i), `d[${i}]`, 'long long', 8, 0)),
  ...Array.from({ length: 8 }, (_, i) => cel('a' + i, hex(0x55d3a3b000 + 8 * i), `a[${i}]`, 'long long', 8, 1)),
];
/** Actualizaciones de rango con diferencias: cada (l, r, x) toca dos huecos de d; al final a[i] = d[0]+…+d[i]. Listado C_DIF. */
export function trazaDiferencias(n, ops) {
  const d = Array(n + 1).fill(0), F = [], a = [];
  for (const { l, r, x } of ops) {
    d[l] += x;
    F.push(f({ val: { ['d' + l]: d[l] } }, `d[${l}] += ${x}: a partir del índice ${l}, todo sube ${x}.`, `d[${l}] += ${x}: from index ${l} on, everything goes up by ${x}.`, 2));
    d[r + 1] -= x;
    F.push(f({ val: { ['d' + (r + 1)]: d[r + 1] } }, `d[${r + 1}] -= ${x}: a partir del ${r + 1} se anula. El rango [${l}, ${r}] cuesta O(1).`, `d[${r + 1}] -= ${x}: from ${r + 1} on it is cancelled. The range [${l}, ${r}] costs O(1).`, 3));
  }
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += d[i]; a.push(s);
    const ant = s - d[i], t = i ? `a[${i}] = a[${i - 1}] + d[${i}] = ${ant} + ${d[i]} = ${s}.` : `a[0] = d[0] = ${s}.`;
    F.push(f({ val: { ['a' + i]: s } }, t, t, 5));
  }
  return { frames: F, d, a };
}
/** Referencia: aplica las actualizaciones una a una sobre un array de ceros. */
export const aplicaDirecto = (n, ops) => { const a = Array(n).fill(0); for (const { l, r, x } of ops) for (let i = l; i <= r; i++) a[i] += x; return a; };

// ══ 4. Union-Find (escena arbol, modo 'arbol': el bosque se recoloca solo) ═════════════════════════════════════════
export const NUF = 8;
export const idU = i => 'n' + i;
export const nodosUF = () => Array.from({ length: NUF }, (_, i) => ({ id: idU(i), val: i }));
/** Aristas padre → hijo de un array de padres (la raíz se apunta a sí misma). */
export const aristasUF = p => p.flatMap((q, i) => (q === i ? [] : [{ a: idU(q), b: idU(i) }]));
const kE = (q, i) => `${idU(q)}-${idU(i)}`;
/** Cabida y radio de la escena (replican medidaDef de arbol.js: radio 16 → dx 46, dy 58, mx 26, my 24, mb 36). */
export const UF_CAB = { niveles: NUF, hojas: NUF };
export const UF_RADIO = 16;
export const UF_MEDIDA = (() => { const r = UF_RADIO, dx = 2 * r + 14, dy = 2 * r + 26, mx = r + 10, my = r + 8, mb = r + 20; return { W: Math.max((UF_CAB.hojas - 1) * dx + 2 * mx, 240), H: Math.max(my + (UF_CAB.niveles - 1) * dy + mb, 140) }; })();
/** Apertura de la escena arbol para un bosque dado (p = array de padres). */
export const abreBosque = p => ({ nodos: nodosUF(), aristas: aristasUF(p), cabida: UF_CAB, radio: UF_RADIO });

export class UF {
  constructor(n = NUF) { this.p = Array.from({ length: n }, (_, i) => i); this.t = Array(n).fill(1); }
  clon() { const u = new UF(this.p.length); u.p = [...this.p]; u.t = [...this.t]; return u; }
  /** Raíz sin tocar nada → {raiz, camino [x … raíz]} */
  subir(x) { const c = [x]; while (this.p[c.at(-1)] !== c.at(-1)) c.push(this.p[c.at(-1)]); return { raiz: c.at(-1), camino: c }; }
  /** find con compresión de caminos (recursivo como el listado). → {raiz, saltos (aristas subidas)} */
  encontrar(x) {
    const { raiz, camino } = this.subir(x);
    for (const y of camino) this.p[y] = raiz;
    return { raiz, saltos: camino.length - 1 };
  }
  /** unir. tamano=true → por tamaño (el pequeño cuelga del grande); false → ingenua: padre[find(a)] = find(b). Sin compresión. */
  unir(a, b, tamano = true) {
    let ra = this.subir(a).raiz, rb = this.subir(b).raiz;
    if (ra === rb) return { unido: false, ra, rb };
    if (tamano && this.t[ra] < this.t[rb]) [ra, rb] = [rb, ra];
    // ingenua: cuelga la raíz de a de la de b; por tamaño: rb (el pequeño) cuelga de ra
    const hijo = tamano ? rb : ra, padre = tamano ? ra : rb;
    this.p[hijo] = padre; this.t[padre] += this.t[hijo];
    return { unido: true, ra, rb, hijo, padre };
  }
  altura() { let h = 0; for (let i = 0; i < this.p.length; i++) h = Math.max(h, this.subir(i).camino.length - 1); return h; }
  conjuntos() { return this.p.filter((q, i) => q === i).length; }
  raices() { return this.p.map((_, i) => this.subir(i).raiz); }
}
/** Etiquetas «t=3» bajo cada raíz con más de un nodo (el resto, null para limpiar). */
const etiquetasTam = u => Object.fromEntries(u.p.map((q, i) => [idU(i), q === i && u.t[i] > 1 ? `t=${u.t[i]}` : null]));
const difE = (a, b) => { const o = {}; for (const [k, v] of Object.entries(b)) if (a[k] !== v) o[k] = v; return o; };
/** Parche estructural de arbol (-aristas / +aristas) entre dos arrays de padres. */
export function parcheBosque(p0, p1) {
  const A = aristasUF(p0), B = aristasUF(p1), k = e => e.a + '-' + e.b, ka = new Set(A.map(k)), kb = new Set(B.map(k));
  const p = {}, quita = A.filter(e => !kb.has(k(e))).map(k), pon = B.filter(e => !ka.has(k(e)));
  if (quita.length) p['-aristas'] = quita;
  if (pon.length) p['+aristas'] = pon;
  return p;
}
/** Parche completo para llevar el bosque a `u` desde `u0` (estructura + etiquetas de tamaño si `tam`), limpiando est. */
export function parcheHacia(u0, u, tam = false) {
  const p = { ...parcheBosque(u0.p, u.p), est: null, aristaEst: null };
  if (tam) { const e = difE(etiquetasTam(u0), etiquetasTam(u)); if (Object.keys(e).length) p.etiquetas = e; } else p.etiquetas = null;
  return p;
}

/** Secuencia de uniones sobre `u0` (copia). tamano=false: ingenua (listado C_UF0, línea 6); true: por tamaño (listado C_UF, 8–11). */
export function trazaUnir(u0, pares, tamano) {
  const u = u0.clon(), F = [];
  for (const [a, b] of pares) {
    const ra = u.subir(a).raiz, rb = u.subir(b).raiz, antes = u.clon();
    F.push(f({ est: { [idU(ra)]: 'activo', [idU(rb)]: 'activo' } },
      ra === rb ? `unir(${a}, ${b}): las dos raíces son ${ra}. Ya estaban en el mismo conjunto.` : `unir(${a}, ${b}): la raíz de ${a} es ${ra} y la de ${b} es ${rb}.`,
      ra === rb ? `unir(${a}, ${b}): both roots are ${ra}. They were already in the same set.` : `unir(${a}, ${b}): the root of ${a} is ${ra} and the root of ${b} is ${rb}.`, tamano ? (ra === rb ? 9 : 8) : 6));
    const r = u.unir(a, b, tamano);
    if (!r.unido) { F.push(f({ est: nulos([idU(ra)]) }, 'No hay nada que unir: el bosque no cambia.', 'Nothing to merge: the forest does not change.', tamano ? 9 : 6)); continue; }
    const p = { ...parcheBosque(antes.p, u.p), est: nulos([idU(ra), idU(rb)]) };
    if (tamano) { const e = difE(etiquetasTam(antes), etiquetasTam(u)); if (Object.keys(e).length) p.etiquetas = e; }
    const txt = tamano
      ? [`Gana el árbol de ${antes.t[r.padre]} nodos${antes.t[r.padre] === antes.t[r.hijo] ? ' (empate: cuelga el segundo)' : ''}: la raíz ${r.hijo} cuelga de la ${r.padre}. Altura del bosque: ${u.altura()}.`,
        `The tree with ${antes.t[r.padre]} node${antes.t[r.padre] > 1 ? 's' : ''} wins${antes.t[r.padre] === antes.t[r.hijo] ? ' (tie: the second one hangs)' : ''}: root ${r.hijo} hangs from ${r.padre}. Forest height: ${u.altura()}.`]
      : [`padre[${r.hijo}] = ${r.padre}: la raíz de ${a} cuelga de la de ${b}. Altura del bosque: ${u.altura()}.`, `padre[${r.hijo}] = ${r.padre}: the root of ${a} hangs from the root of ${b}. Forest height: ${u.altura()}.`];
    F.push(f(p, txt[0], txt[1], tamano ? 11 : 6));
  }
  return { frames: F, uf: u };
}

/** find(x) con compresión de caminos sobre `u0` (listado C_FIND: 2 = raíz, 3 = recursión/asignación, 4 = return). */
export function trazaFind(u0, x) {
  const u = u0.clon(), { raiz, camino } = u.subir(x), F = [];
  camino.forEach((y, i) => {
    const est = { [idU(y)]: i === camino.length - 1 ? 'ok' : 'activo', ...(i > 0 && { [idU(camino[i - 1])]: 'camino' }) };
    if (i === camino.length - 1) F.push(f({ est }, `${y} es su propio padre: la raíz es ${y}. Se subieron ${i} aristas.`, `${y} is its own parent: the root is ${y}. ${i} edges were climbed.`, 2));
    else F.push(f({ est }, i === 0 ? `encontrar(${y}): padre[${y}] = ${u.p[y]}, hay que subir.` : `padre[${y}] = ${u.p[y]}: sigue subiendo.`, i === 0 ? `encontrar(${y}): padre[${y}] = ${u.p[y]}, climb up.` : `padre[${y}] = ${u.p[y]}: keep climbing.`, 3));
  });
  // Al volver de la recursión, cada nodo del camino apunta directamente a la raíz (de abajo arriba)
  for (let i = camino.length - 3; i >= 0; i--) {
    const y = camino[i], antes = u.p[y];
    u.p[y] = raiz;
    F.push(f({ '-aristas': [kE(antes, y)], '+aristas': [{ a: idU(raiz), b: idU(y) }], aristaEst: { [`${idU(raiz)}-${idU(y)}`]: 'camino' } },
      `padre[${y}] = ${raiz}: ${y} cuelga ahora directamente de la raíz.`, `padre[${y}] = ${raiz}: ${y} now hangs directly from the root.`, 3));
  }
  F.push(f({ est: null, aristaEst: null }, camino.length > 2 ? `El camino de ${camino.length - 1} saltos queda en 1 salto por nodo. La próxima encontrar(${x}) cuesta ${camino.length > 1 ? 1 : 0}.` : 'El camino ya era corto: no hay nada que comprimir.', camino.length > 2 ? `The ${camino.length - 1}-hop path is now 1 hop per node. The next encontrar(${x}) costs ${camino.length > 1 ? 1 : 0}.` : 'The path was already short: nothing to compress.', 4));
  return { frames: F, uf: u, saltos: camino.length - 1, raiz };
}

/** Nodo (índice) bajo el punto lógico (x, y) del lienzo del bosque, o -1. Para soltar un nodo sobre otro en `jugar`. */
export function nodoEn(p, x, y, excluir = -1) {
  const pos = disenar(nodosUF(), aristasUF(p), 'arbol', { r: UF_RADIO, W: UF_MEDIDA.W, H: UF_MEDIDA.H }), tope = 2 * UF_RADIO + 4;
  let mejor = -1, d0 = tope;
  for (let i = 0; i < p.length; i++) {
    if (i === excluir) continue;
    const q = pos[idU(i)], d = Math.hypot(q.x - x, q.y - y);
    if (d < d0) { d0 = d; mejor = i; }
  }
  return mejor;
}

// ══ 5. Kruskal (escena arbol, modo 'libre'), conjunto hash y dos sumas (barras) ════════════════════════════════════
export const G_NODOS = ['a', 'b', 'c', 'd', 'e', 'f'];
export const G_POS = { a: [0.07, 0.5], b: [0.3, 0.14], c: [0.3, 0.86], d: [0.62, 0.5], e: [0.93, 0.14], f: [0.93, 0.86] };
export const G_ARISTAS = [['a', 'b', 2], ['b', 'c', 3], ['a', 'c', 4], ['c', 'd', 1], ['d', 'e', 5], ['e', 'f', 2], ['d', 'f', 6], ['b', 'd', 7]];
export const aristaG = ([a, b, peso]) => ({ a, b, peso });
export const nodosG = () => G_NODOS.map(id => ({ id, val: id, x: G_POS[id][0], y: G_POS[id][1] }));
const kG = ([a, b]) => `${a}-${b}`;
/** Componentes conexas con Union-Find (por tamaño): lista de listas de ids, en orden de aparición. */
export function componentesUF(nodos, aristas) {
  const ix = Object.fromEntries(nodos.map((id, i) => [id, i])), u = new UF(nodos.length);
  for (const [a, b] of aristas) u.unir(ix[a], ix[b]);
  const g = new Map();
  nodos.forEach((id, i) => { const r = u.subir(i).raiz; g.set(r, [...(g.get(r) || []), id]); });
  return [...g.values()];
}
/** Kruskal con Union-Find: ordena por peso (estable), acepta la arista si une dos raíces distintas. */
export function trazaKruskal(nodos, aristas) {
  const ix = Object.fromEntries(nodos.map((id, i) => [id, i])), u = new UF(nodos.length), F = [], mst = [];
  const orden = aristas.map((e, i) => [e, i]).sort((x, y) => x[0][2] - y[0][2] || x[1] - y[1]).map(x => x[0]);
  const etiq = () => Object.fromEntries(nodos.map((id, i) => [id, `r=${nodos[u.subir(i).raiz]}`]));
  let e0 = {};
  const lab = () => { const e = etiq(), d = difE(e0, e); e0 = e; return Object.keys(d).length ? { etiquetas: d } : {}; };
  F.push(f({ ...lab() }, 'Cada nodo es su propio conjunto: r es la raíz de su conjunto. Se miran las aristas de menor a mayor peso.', 'Every node is its own set: r is the root of its set. Edges are read from lowest to highest weight.', 1));
  for (const e of orden) {
    const [a, b, w] = e, ra = u.subir(ix[a]).raiz, rb = u.subir(ix[b]).raiz, k = kG(e);
    F.push(f({ aristaEst: { [k]: 'activa' } }, `Arista ${a}-${b} (peso ${w}): raíces ${nodos[ra]} y ${nodos[rb]}.`, `Edge ${a}-${b} (weight ${w}): roots ${nodos[ra]} and ${nodos[rb]}.`, 4));
    if (ra !== rb) {
      u.unir(ix[a], ix[b]); mst.push(e);
      F.push(f({ aristaEst: { [k]: 'camino' }, ...lab() }, `Raíces distintas: se acepta y se unen los conjuntos. Peso acumulado: ${mst.reduce((s, x) => s + x[2], 0)}.`, `Different roots: accepted, the sets merge. Total weight so far: ${mst.reduce((s, x) => s + x[2], 0)}.`, 5));
    } else {
      F.push(f({ aristaEst: { [k]: null }, est: { [a]: 'mal', [b]: 'mal' } }, `Misma raíz (${nodos[ra]}): ${a} y ${b} ya están conectados. La arista cerraría un ciclo y se descarta.`, `Same root (${nodos[ra]}): ${a} and ${b} are already connected. The edge would close a cycle and is discarded.`, 5));
      F.push(f({ est: null }, 'Se sigue con la siguiente arista.', 'On to the next edge.', 4));
    }
  }
  const peso = mst.reduce((s, x) => s + x[2], 0);
  F.push(f({ est: null }, `Árbol generador mínimo: ${mst.length} aristas (n − 1) y peso total ${peso}.`, `Minimum spanning tree: ${mst.length} edges (n − 1) and total weight ${peso}.`, 5));
  return { frames: F, mst, peso, conjuntos: u.conjuntos() };
}
/** Peso del árbol generador mínimo por fuerza bruta (todos los subconjuntos de n−1 aristas que conectan). Solo para pruebas. */
export function mstFuerzaBruta(nodos, aristas) {
  const n = nodos.length; let mejor = Infinity;
  for (let mask = 0; mask < 1 << aristas.length; mask++) {
    const es = aristas.filter((_, i) => mask >> i & 1);
    if (es.length !== n - 1) continue;
    if (componentesUF(nodos, es).length === 1) mejor = Math.min(mejor, es.reduce((s, e) => s + e[2], 0));
  }
  return mejor;
}

/** Contar distintos con un conjunto hash: `aux` guarda el conjunto en orden de llegada. Listado C_SET (2 = insert, 3 = size). */
export function trazaDistintos(v) {
  const vistos = new Set(), F = [];
  v.forEach((x, i) => {
    const nuevo = !vistos.has(x), antes = vistos.size;
    if (nuevo) vistos.add(x);
    F.push(f({ marcas: { i }, est: { ...(i > 0 && { [i - 1]: null }), [i]: nuevo ? 'ok' : 'cmp' }, ...(nuevo && { aux: { [antes]: x } }), cont: { distintos: vistos.size } },
      nuevo ? `${x} no estaba en el conjunto: se inserta (distintos: ${vistos.size}).` : `${x} ya estaba: insert no cambia nada (distintos: ${vistos.size}).`,
      nuevo ? `${x} was not in the set: inserted (distinct: ${vistos.size}).` : `${x} was already there: insert changes nothing (distinct: ${vistos.size}).`, 2));
  });
  F.push(f({ marcas: null, est: nulos([v.length - 1]) }, `vistos.size() = ${vistos.size}: una pasada y O(1) por elemento (esperado).`, `vistos.size() = ${vistos.size}: one pass and O(1) per element (expected).`, 3));
  return { frames: F, distintos: vistos.size };
}

/** Dos sumas con tabla hash (valor → índice): una pasada. `aux` guarda `vistos`. Listado C_DOS (2 = for, 3 = falta, 4 = find, 5 = if, 6 = guardar). */
export function trazaDosSumas(v, obj) {
  const vistos = new Map(), F = [];
  let par = null;
  for (let i = 0; i < v.length; i++) {
    const x = v[i], falta = obj - x, j = vistos.get(falta), ult = i > 0 ? { [i - 1]: null } : {};
    F.push(f({ marcas: { i }, est: { ...ult, [i]: 'cmp' } }, `v[${i}] = ${x}: falta ${obj} − ${x} = ${falta}. ¿Está en vistos?`, `v[${i}] = ${x}: we need ${obj} − ${x} = ${falta}. Is it in vistos?`, 3));
    if (j !== undefined) {
      par = [j, i];
      F.push(f({ est: { [j]: 'ok', [i]: 'ok' } }, `Sí: ${falta} está en el índice ${j}. Solución: v[${j}] + v[${i}] = ${v[j]} + ${x} = ${obj}.`, `Yes: ${falta} is at index ${j}. Solution: v[${j}] + v[${i}] = ${v[j]} + ${x} = ${obj}.`, 5));
      break;
    }
    const k = vistos.size; vistos.set(x, i);
    F.push(f({ aux: { [k]: x } }, `No: se guarda ${x} (índice ${i}) en vistos y se sigue.`, `No: ${x} (index ${i}) is stored in vistos and we move on.`, 6));
  }
  if (!par) F.push(f({ est: null }, 'Sin solución: se recorrió todo el array.', 'No solution: the whole array was read.', 2));
  return { frames: F, par };
}

// ══ 6. Tarjetas de decisión (escena celdas) ═══════════════════════════════════════════════════════════════════════
export const CELDAS_TARJETAS = [
  cel('cu', '#1', 'unordered_map / set', { es: '¿lo he visto? · contar', en: 'seen it? · count' }, 0),
  cel('cm', '#2', 'map / set', { es: 'ordenado · rangos', en: 'ordered · ranges' }, 0),
  cel('cp', '#3', { es: 'sumas prefijas', en: 'prefix sums' }, { es: 'rangos · sin cambios', en: 'ranges · no updates' }, 0),
  cel('cf', '#4', 'Union-Find', { es: 'grupos que se fusionan', en: 'groups that merge' }, 0),
  cel('cs', '#5', { es: 'sort + dos punteros', en: 'sort + two pointers' }, { es: 'pares · sin memoria extra', en: 'pairs · no extra memory' }, 0),
];
