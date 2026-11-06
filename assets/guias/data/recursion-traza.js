// Generadores de trazas y helpers de la guía «Recursión y complejidad» (data/recursion.js). Todo son funciones puras que
// EJECUTAN el algoritmo (suma recursiva, fib, memoización, Hanoi…) y devuelven los frames de la traza, para que los
// conteos que se ven en pantalla (15 llamadas, 9 con memo, 7 movimientos…) salgan de ejecutar el código y no de escribirlos.
// Se prueban en Node con tests/guias/test-recursion.js. Formato de los frames: cabeceras de escena.js / arbol.js / grafica.js.
import { arbolCompleto, plegar as plegarArbol } from '../arbol.js';

const f = (o, es, en, line) => ({ ...o, es, en, ...(line != null && { line }) });
const cel = (id, addr, name, type, size, col = 0, grupo) => ({ id, addr, name, type, size, col, ...(grupo && { grupo }) });
const hex = x => '0x' + x.toString(16);
const esEn = () => globalThis.document?.documentElement.lang === 'en'; // idioma activo (las lecturas de `jugar` no son bilingües)
/** Texto según el idioma activo (solo para lecturas de `jugar`, que son cadenas planas). */
export const tr = (es, ing) => (esEn() ? ing : es);

// ── Números ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Fibonacci F(0)=0, F(1)=1 (iterativo; exacto en Number hasta F(78)). */
export const fibNum = n => { let a = 0, b = 1; for (let i = 0; i < n; i++) [a, b] = [b, a + b]; return a; };
/** Llamadas del fib ingenuo: T(n) = T(n-1) + T(n-2) + 1 con T(0) = T(1) = 1  ⇒  T(n) = 2·F(n+1) − 1. */
export const llamadasFib = n => 2 * fibNum(n + 1) - 1;
/** Llamadas del fib con memoización: 1 si n < 2 y 2n − 1 si n ≥ 2. */
export const llamadasMemo = n => (n < 2 ? 1 : 2 * n - 1);

// ── Escena «celdas»: marcos de la pila ───────────────────────────────────────────────────────────────────────────
const REG = { es: 'registro', en: 'register' }, DEV = { es: 'valor devuelto', en: 'return value' };
const sumaDe = n => (n * (n + 1)) / 2;

/** Pila de `suma(n0)`: n0+1 marcos (n0 … 0), cada uno con su `n` y su valor devuelto. → {celdas, grupos, frames}. */
export function sumaPila(n0 = 3) {
  const base = 0x7ffd2e90, celdas = [cel('r', hex(base), 'r', 'int', 4, 0, 'fm')], grupos = [{ id: 'fm', titulo: 'main()' }];
  for (let i = 0; i <= n0; i++) {
    const n = n0 - i;
    celdas.push(cel('n' + i, hex(base - 0x30 * (i + 1)), 'n', 'int', 4, 0, 'f' + i), cel('v' + i, `ret · suma(${n})`, DEV, REG, 0, 0, 'f' + i));
    grupos.push({ id: 'f' + i, titulo: `suma(${n})` });
  }
  const F = [];
  F.push(f({ mostrar: ['n0', 'v0'], val: { n0, v0: '?' } }, `main llama a suma(${n0}): nace su marco, con n = ${n0}.`, `main calls suma(${n0}): its frame is born, with n = ${n0}.`, 6));
  for (let i = 1; i <= n0; i++) {
    const n = n0 - i;
    F.push(f({ mostrar: ['n' + i, 'v' + i], val: { ['n' + i]: n, ['v' + i]: '?' } },
      `suma(${n + 1}) llama a suma(${n}): otro marco encima, con su propia n.`, `suma(${n + 1}) calls suma(${n}): another frame on top, with its own n.`, 3));
  }
  F.push(f({ val: { ['v' + n0]: 0 } }, 'suma(0) es el caso base: devuelve 0 sin llamar a nadie.', 'suma(0) is the base case: it returns 0 without calling anyone.', 2));
  for (let i = n0; i >= 0; i--) {
    const n = n0 - i, v = sumaDe(n);
    if (i) F.push(f({ ocultar: ['n' + i, 'v' + i], val: { ['v' + (i - 1)]: sumaDe(n + 1) } },
      `suma(${n}) devuelve ${v} y su marco se desapila. suma(${n + 1}) calcula ${n + 1} + ${v} = ${sumaDe(n + 1)}.`,
      `suma(${n}) returns ${v} and its frame is popped. suma(${n + 1}) computes ${n + 1} + ${v} = ${sumaDe(n + 1)}.`, 3));
    else F.push(f({ ocultar: ['n0', 'v0'], val: { r: v } }, `suma(${n}) devuelve ${v}; main guarda r = ${v}. La pila vuelve a estar vacía.`, `suma(${n}) returns ${v}; main stores r = ${v}. The stack is empty again.`, 6));
  }
  return { celdas, grupos, frames: F };
}

/**
 * `suma` SIN caso base, llamada con n0: se apilan `reales` marcos y el siguiente (fantasma) ya no cabe. El dibujo es
 * corto a propósito: en un programa real son miles o millones de marcos antes de agotar la pila.
 */
export function sumaSinBase(n0 = 2, reales = 5) {
  const base = 0x7ffd3ab0, celdas = [cel('r', hex(base), 'r', 'int', 4, 0, 'fm')], grupos = [{ id: 'fm', titulo: 'main()' }];
  for (let i = 0; i <= reales; i++) { // `reales` marcos vivos y uno más, el que no cabe
    celdas.push(cel('n' + i, hex(base - 0x20 * (i + 1)), 'n', 'int', 4, 0, 'g' + i));
    grupos.push({ id: 'g' + i, titulo: `suma(${n0 - i})` });
  }
  const F = [f({ mostrar: ['n0'], val: { n0 } }, `main llama a suma(${n0}): primer marco.`, `main calls suma(${n0}): first frame.`, 5)];
  for (let i = 1; i < reales; i++) {
    const n = n0 - i;
    F.push(f({ mostrar: ['n' + i], val: { ['n' + i]: n } },
      n === 0 ? 'n llega a 0, pero nada lo comprueba: la función sigue llamándose con -1.' : `suma(${n + 1}) llama a suma(${n}): otro marco.`,
      n === 0 ? 'n reaches 0, but nothing checks it: the function keeps calling itself with -1.' : `suma(${n + 1}) calls suma(${n}): another frame.`, 2));
  }
  F.push(f({ fantasma: ['n' + reales], val: { ['n' + reales]: n0 - reales } },
    'Esto sigue miles o millones de veces. Al final, el siguiente marco (borde discontinuo) ya no cabe en la pila.',
    'This goes on thousands or millions of times. In the end, the next frame (dashed border) no longer fits on the stack.', 2));
  F.push(f({}, 'Desbordamiento de pila (stack overflow): el programa termina con un error. Un caso base habría cortado la cadena.',
    'Stack overflow: the program ends with an error. A base case would have cut the chain.', 2));
  return { celdas, grupos, frames: F, reales };
}

/** `sumaAcc(n, acc)` con recursión de cola, tal como queda tras la optimización: un solo marco cuyo contenido se actualiza. */
export function sumaCola(n0 = 3) {
  const base = 0x7ffc91d0;
  const celdas = [cel('r', hex(base), 'r', 'int', 4, 0, 'fm'), cel('n', hex(base - 0x30), 'n', 'int', 4, 0, 'fa'), cel('acc', hex(base - 0x34), 'acc', 'int', 4, 0, 'fa')];
  const grupos = [{ id: 'fm', titulo: 'main()' }, { id: 'fa', titulo: 'sumaAcc(n, acc)' }];
  const F = [f({ mostrar: ['n', 'acc'], val: { n: n0, acc: 0 } }, `main llama a sumaAcc(${n0}, 0): un marco con n = ${n0} y acc = 0.`, `main calls sumaAcc(${n0}, 0): one frame with n = ${n0} and acc = 0.`, 6)];
  let acc = 0;
  for (let k = n0; k >= 1; k--) {
    acc += k;
    F.push(f({ val: { n: k - 1, acc } }, `Llamada de cola sumaAcc(${k - 1}, ${acc}): el compilador puede reutilizar el marco; solo cambian n y acc.`,
      `Tail call sumaAcc(${k - 1}, ${acc}): the compiler may reuse the frame; only n and acc change.`, 3));
  }
  F.push(f({}, `n == 0: caso base. Devuelve acc = ${acc}.`, `n == 0: base case. It returns acc = ${acc}.`, 2));
  F.push(f({ ocultar: ['n', 'acc'], val: { r: acc } }, `main recibe ${acc}. Hubo un solo marco en toda la ejecución.`, `main receives ${acc}. There was a single frame in the whole run.`, 6));
  return { celdas, grupos, frames: F, resultado: acc };
}

// ── Plegado de «celdas» (para restaurar el estado tras una traza y para probarlas en Node) ───────────────────────
/** Pliega frames/parches de celdas sobre {st, val}. Misma lógica que escena.js (que no se puede importar sin DOM). */
export function plegarCeldas(ini, frames) {
  const s = { st: { ...ini.st }, val: { ...ini.val } };
  for (const p of frames) {
    for (const id of p.mostrar || []) s.st[id] = 'vivo';
    for (const id of p.ocultar || []) delete s.st[id];
    for (const id of p.fantasma || []) s.st[id] = 'fantasma';
    Object.assign(s.val, p.val);
  }
  return s;
}
/** Parche (mostrar/ocultar/fantasma/val) que lleva el estado `de` al estado `a`. */
export function parcheHacia(de, a) {
  const ids = (est, t) => Object.keys(est.st).filter(k => est.st[k] === t);
  return {
    mostrar: ids(a, 'vivo'), fantasma: ids(a, 'fantasma'),
    ocultar: Object.keys(de.st).filter(k => !(k in a.st)),
    val: Object.fromEntries(Object.entries(a.val).filter(([k, v]) => de.val[k] !== v)),
  };
}

// ── Escena «arbol»: árbol de llamadas de fib ─────────────────────────────────────────────────────────────────────
const valDe = (T, id) => T.nodos.find(n => n.id === id).val;
const numDe = (T, id) => +valDe(T, id).match(/-?\d+/)[0];

/** Ejecuta fib(n0) ingenuo: cada llamada es un nodo y un frame; cada devolución, otro. → {frames, arbol (final), llamadas}. */
export function fibLlamadas(n0) {
  const F = [], T = { nodos: [{ id: 'c0', val: `fib(${n0})` }], aristas: [], raiz: 'c0' };
  let k = 1; // llamadas hechas hasta ahora (la raíz es la primera)
  const llamar = (m, lado, padre, n) => {
    const id = 'c' + k++, nodo = { id, val: `fib(${m})` }, arista = { a: padre, b: id, lado };
    T.nodos.push(nodo); T.aristas.push(arista);
    F.push(f({ '+nodos': [nodo], '+aristas': [arista], est: { [padre]: 'camino', [id]: 'activo' } }, `Llamada ${k}: fib(${n}) llama a fib(${m}).`, `Call ${k}: fib(${n}) calls fib(${m}).`, 3));
    return id;
  };
  const volver = (id, padre, es, en, line) => F.push(f({ est: { [id]: 'ok', ...(padre && { [padre]: 'activo' }) } }, es, en, line));
  const rec = (n, id, padre) => {
    if (n < 2) { volver(id, padre, `fib(${n}) es un caso base: devuelve ${n}.`, `fib(${n}) is a base case: it returns ${n}.`, 2); F.at(-1).etiquetas = { [id]: '=' + n }; return n; }
    const a = rec(n - 1, llamar(n - 1, 'i', id, n), id), b = rec(n - 2, llamar(n - 2, 'd', id, n), id), v = a + b;
    const fin = padre === null;
    volver(id, padre, fin ? `fib(${n}) = ${a} + ${b} = ${v}. En total: ${k} llamadas.` : `fib(${n}) = ${a} + ${b} = ${v}.`, fin ? `fib(${n}) = ${a} + ${b} = ${v}. In total: ${k} calls.` : `fib(${n}) = ${a} + ${b} = ${v}.`, 3);
    F.at(-1).etiquetas = { [id]: '=' + v };
    return v;
  };
  F.push(f({ est: { c0: 'activo' } }, `Llamada 1: llamamos a fib(${n0}).`, `Call 1: we call fib(${n0}).`, 1));
  rec(n0, 'c0', null);
  return { frames: F, arbol: T, llamadas: k };
}

/** Nº de nodos del subárbol de cada nodo (él incluido): {id: tamaño}. */
export function tamanosSubarbol(T) {
  const hijos = id => T.aristas.filter(e => e.a === id).map(e => e.b), tam = id => 1 + hijos(id).reduce((s, c) => s + tam(c), 0);
  return Object.fromEntries(T.nodos.map(n => [n.id, tam(n.id)]));
}

/** Cuántas veces aparece cada «fib(m)» en el árbol: {m: veces}. */
export function repeticiones(T) {
  const r = {};
  for (const n of T.nodos) r[numDe(T, n.id)] = (r[numDe(T, n.id)] ?? 0) + 1;
  return r;
}

/** Parche con etiquetas «×k» y borde discontinuo («mal») para el trabajo repetido (llamadas no base que aparecen más de una vez). */
export function marcasRepetidas(T) {
  const rep = repeticiones(T), etiquetas = {}, est = {};
  for (const n of T.nodos) {
    const m = numDe(T, n.id);
    if (rep[m] > 1) { etiquetas[n.id] = '×' + rep[m]; if (m >= 2) est[n.id] = 'mal'; }
  }
  return { etiquetas, est };
}

/**
 * Ejecuta fib con memoización sobre el árbol ingenuo `T`: una llamada que ya está en la tabla devuelve el valor y su rama
 * se poda. → {frames, llamadas (nodos que quedan), podados (ids quitados), arbol (final)}.
 */
export function memoPoda(T) {
  const hijos = id => T.aristas.filter(e => e.a === id).map(e => e.b), desc = id => hijos(id).flatMap(c => [c, ...desc(c)]);
  const memo = new Map(), F = [], podados = [];
  let llamadas = 0;
  const vis = (id, padre) => {
    const n = numDe(T, id), d = desc(id), marca = { [id]: 'activo', ...(padre && { [padre]: 'camino' }) }, L = ++llamadas;
    if (n < 2) {
      F.push(f({ est: { ...marca, [id]: 'ok' }, etiquetas: { [id]: '=' + n } }, `Llamada ${L}: fib(${n}) es un caso base y devuelve ${n}.`, `Call ${L}: fib(${n}) is a base case and returns ${n}.`, 3));
      return n;
    }
    if (memo.has(n)) {
      const v = memo.get(n);
      F.push(f({ est: { ...marca, [id]: 'visitado' }, etiquetas: { [id]: '=' + v } }, `Llamada ${L}: fib(${n}) ya está en memo (${v}). Se devuelve sin llamar a nadie.`, `Call ${L}: fib(${n}) is already in memo (${v}). It is returned without calling anyone.`, 4));
      if (d.length) {
        podados.push(...d);
        F.push(f({ '-nodos': d }, `Se podan sus ${d.length} llamadas: ese trabajo ya no se hace.`, `Its ${d.length} calls are pruned: that work is no longer done.`, 4));
      }
      return v;
    }
    F.push(f({ est: marca }, `Llamada ${L}: calculamos fib(${n}) por primera vez.`, `Call ${L}: we compute fib(${n}) for the first time.`, 5));
    const v = hijos(id).reduce((s, c) => s + vis(c, id), 0);
    memo.set(n, v);
    F.push(f({ est: { [id]: 'ok', ...(padre && { [padre]: 'activo' }) }, etiquetas: { [id]: '=' + v } }, `fib(${n}) = ${v}. Se guarda en memo.`, `fib(${n}) = ${v}. It is stored in memo.`, 5));
    return v;
  };
  vis(T.raiz, null);
  const quitados = new Set(podados), arbol = { ...T, nodos: T.nodos.filter(n => !quitados.has(n.id)), aristas: T.aristas.filter(e => !quitados.has(e.a) && !quitados.has(e.b)) };
  return { frames: F, llamadas, podados, arbol };
}

// ── Hanoi ────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Ejecuta hanoi(n0) (caso base n == 1: mueve un disco). Cada llamada hace exactamente un movimiento: el del caso base o
 * el que va entre sus dos llamadas, así que los movimientos salen en in-orden del árbol. → {frames, arbol, movimientos[]}.
 */
export function hanoiLlamadas(n0, [A, B, C] = ['A', 'B', 'C']) {
  const F = [], movs = [], T = { nodos: [{ id: 'c0', val: `hanoi(${n0})` }], aristas: [], raiz: 'c0' };
  let k = 1;
  const discos = m => (m === 1 ? '1 disco' : `${m} discos`), disks = m => (m === 1 ? '1 disk' : `${m} disks`);
  const llamar = (m, lado, padre, de, a, line) => {
    const id = 'c' + k++, nodo = { id, val: `hanoi(${m})` }, arista = { a: padre, b: id, lado };
    T.nodos.push(nodo); T.aristas.push(arista);
    F.push(f({ '+nodos': [nodo], '+aristas': [arista], est: { [padre]: 'camino', [id]: 'activo' } }, `Se llama a hanoi(${m}): mover ${discos(m)} de ${de} a ${a}.`, `hanoi(${m}) is called: move ${disks(m)} from ${de} to ${a}.`, line));
    return id;
  };
  const mover = (id, de, a, line) => {
    movs.push([de, a]);
    F.push(f({ etiquetas: { [id]: `${movs.length}:${de}→${a}` }, est: { [id]: 'activo' } }, `Movimiento ${movs.length}: un disco de ${de} a ${a}.`, `Move ${movs.length}: one disk from ${de} to ${a}.`, line));
  };
  const rec = (n, id, de, a, por, padre) => {
    if (n === 1) { mover(id, de, a, 2); F.at(-1).est = { [id]: 'ok', ...(padre && { [padre]: 'activo' }) }; return; }
    rec(n - 1, llamar(n - 1, 'i', id, de, por, 3), de, por, a, id);
    mover(id, de, a, 4);
    rec(n - 1, llamar(n - 1, 'd', id, por, a, 5), por, a, de, id);
    F.push(f({ est: { [id]: 'ok', ...(padre && { [padre]: 'activo' }) } }, `hanoi(${n}) termina: ${discos(n)} ya están en ${a}.`, `hanoi(${n}) ends: ${disks(n)} are now on ${a}.`, 6));
  };
  F.push(f({ est: { c0: 'activo' } }, `Llamamos a hanoi(${n0}): mover ${discos(n0)} de ${A} a ${C}, con ${B} de apoyo.`, `We call hanoi(${n0}): move ${disks(n0)} from ${A} to ${C}, using ${B} as the spare peg.`, 1));
  rec(n0, 'c0', A, C, B, null);
  return { frames: F, arbol: T, movimientos: movs };
}

/** Etiquetas finales de Hanoi: movimiento de cada nodo en in-orden → {id: '3:A→B'}. */
export function etiquetasHanoi(H) {
  const eti = {};
  for (const fr of H.frames) if (fr.etiquetas) Object.assign(eti, fr.etiquetas);
  return eti;
}

// ── Árbol por niveles de T(n) = 2T(n/2) + n ──────────────────────────────────────────────────────────────────────
export const TM = arbolCompleto(4, nv => ['n', 'n/2', 'n/4', 'n/8'][nv]);
export const nivelIds = nv => TM.nodos.filter((_, i) => Math.floor(Math.log2(i + 1)) === nv).map(n => n.id);
export const NOTAS_TM = [
  { nivel: 0, texto: { es: 'nivel 0: n', en: 'level 0: n' } },
  { nivel: 1, texto: { es: 'nivel 1: n/2 + n/2 = n', en: 'level 1: n/2 + n/2 = n' } },
  { nivel: 2, texto: { es: 'nivel 2: 4 · n/4 = n', en: 'level 2: 4 · n/4 = n' } },
  { nivel: 3, texto: { es: 'nivel 3: 8 · n/8 = n', en: 'level 3: 8 · n/8 = n' } },
];
/** Estado `est` con los niveles 0..nv-1 terminados (ok) y el nivel nv en curso (activo). */
export const estNivel = nv => ({ ...Object.fromEntries(TM.nodos.slice(0, 2 ** nv - 1).map(n => [n.id, 'ok'])), ...Object.fromEntries(nivelIds(nv).map(id => [id, 'activo'])) });
export const estTodoOk = () => Object.fromEntries(TM.nodos.map(n => [n.id, 'ok']));
export const framesNiveles = () => [
  f({ est: estNivel(0), notas: NOTAS_TM.slice(0, 1) }, 'Nivel 0: una sola llamada con n elementos. Su merge cuesta n.', 'Level 0: a single call with n elements. Its merge costs n.', 6),
  f({ est: estNivel(1), notas: NOTAS_TM.slice(0, 2) }, 'Nivel 1: dos llamadas de tamaño n/2. Sus merge suman n/2 + n/2 = n.', 'Level 1: two calls of size n/2. Their merges add up to n/2 + n/2 = n.', 4),
  f({ est: estNivel(2), notas: NOTAS_TM.slice(0, 3) }, 'Nivel 2: cuatro llamadas de tamaño n/4. Otra vez n en total.', 'Level 2: four calls of size n/4. Again n in total.', 4),
  f({ est: estNivel(3), notas: NOTAS_TM }, 'Nivel 3: ocho llamadas de tamaño n/8. Sigue costando n por nivel.', 'Level 3: eight calls of size n/8. Still n per level.', 4),
  f({ est: estTodoOk(), etiquetas: { m0: 'n log n' } }, 'Se llega a tamaño 1 tras log n divisiones: log n niveles de coste n cada uno. Total: n log n.', 'Size 1 is reached after log n halvings: log n levels costing n each. Total: n log n.'),
];

// ── Cadenas de llamadas (T(n-1)+n y T(n/2)+1) ────────────────────────────────────────────────────────────────────
/**
 * Árbol que es una cadena (un hijo por nodo) con una nota por nivel. `abre` = estado inicial (solo la raíz); `frames` añaden
 * el nodo siguiente con su nota; `completo` = parche que deja la cadena entera. texto(i) = [es, en] del frame del nodo i.
 */
export function cadena(vals, notas, texto, cierre) {
  const nodos = vals.map((v, i) => ({ id: 'p' + i, val: v })), aristas = vals.slice(1).map((_, i) => ({ a: 'p' + i, b: 'p' + (i + 1) }));
  const nt = k => notas.slice(0, k + 1).map((t, i) => ({ nivel: i, texto: t }));
  const frames = vals.slice(1).map((_, j) => {
    const i = j + 1, [es, en] = texto(i);
    return f({ '+nodos': [nodos[i]], '+aristas': [aristas[j]], est: { ['p' + (i - 1)]: 'visitado', ['p' + i]: 'activo' }, notas: nt(i) }, es, en);
  });
  frames.push(f({ est: Object.fromEntries(nodos.map(n => [n.id, 'ok'])), etiquetas: { p0: cierre.etiqueta } }, cierre.es, cierre.en));
  return {
    nodos, aristas, frames,
    abre: { nodos: [nodos[0]], aristas: [], raiz: 'p0', cabida: { niveles: vals.length, hojas: 1, ancho: 0, notas: true }, notas: nt(0) },
    completo: { '+nodos': nodos.slice(1), '+aristas': aristas, notas: nt(vals.length - 1) },
  };
}

// ── Teorema maestro (versión ligera): T(n) = a·T(n/b) + n^c ──────────────────────────────────────────────────────
const SUP = ['', '', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const dec = s => (esEn() ? s : s.replace('.', ','));
const pol = p => (Math.abs(p - Math.round(p)) < 1e-9 ? (Math.round(p) === 0 ? '1' : Math.round(p) === 1 ? 'n' : 'n' + (SUP[Math.round(p)] || '^' + Math.round(p))) : 'n^' + dec(p.toFixed(2)));
/** Clasifica la recurrencia: {lg: log_b a, caso: 1|2|3, cmp: '<'|'='|'>' (c frente a log_b a), res: 'Θ(…)'}. a ≥ 1, b ≥ 2, c ≥ 0. */
export function maestro(a, b, c) {
  const lg = Math.log(a) / Math.log(b), caso = Math.abs(c - lg) < 1e-9 ? 2 : c < lg ? 1 : 3;
  const res = caso === 1 ? `Θ(${pol(lg)})` : caso === 2 ? (c === 0 ? 'Θ(log n)' : `Θ(${pol(c)} log n)`) : `Θ(${pol(c)})`;
  return { lg, caso, cmp: ['<', '=', '>'][caso - 1], res };
}
/** Número con 2 decimales como máximo y la coma/punto del idioma activo. */
export const fmt2 = x => dec(String(+x.toFixed(2)));
/** Texto de la recurrencia a·T(n/b) + n^c. */
export const textoRecurrencia = (a, b, c) => `${a === 1 ? '' : a + ' · '}T(n/${b}) + ${pol(c)}`;

// ── Cuánto tarda: operaciones y duraciones ───────────────────────────────────────────────────────────────────────
export const OPS = { log: n => Math.log2(Math.max(1, n)), n: n => n, nlogn: n => n * Math.log2(Math.max(1, n)), n2: n => n * n, exp: n => 2 ** n };
const cifra = x => {
  if (x >= 1e6) { const e = Math.floor(Math.log10(x)), m = x / 10 ** e; return dec(`${+m.toPrecision(2)}e${e}`); }
  if (x >= 1000) return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec(String(+x.toPrecision(3)));
};
/** Duración legible de `seg` segundos (ns, µs, ms, s, min, h, días, años) o «∞» si no cabe en un número. */
export function duracion(seg) {
  if (!Number.isFinite(seg)) return '∞';
  const U = [[1e-6, 1e-9, 'ns', 'ns'], [1e-3, 1e-6, 'µs', 'µs'], [1, 1e-3, 'ms', 'ms'], [60, 1, 's', 's'], [3600, 60, 'min', 'min'], [86400, 3600, 'h', 'h'], [31557600, 86400, 'días', 'days']];
  for (const [lim, u, es, ing] of U) if (seg < lim) return `${cifra(seg / u)} ${tr(es, ing)}`;
  return `${cifra(seg / 31557600)} ${tr('años', 'years')}`;
}

/** Estado final {est, etiquetas, ids} de una traza de «arbol»: abre con `apertura`, aplica los parches `previos` y luego los frames. */
export function finalArbol(apertura, previos, frames) {
  let s = plegarArbol(undefined, { arbol: apertura });
  for (const p of [...previos, ...frames]) s = plegarArbol(s, p);
  return { est: s.est, etiquetas: s.etiquetas, ids: s.nodos.map(n => n.id) };
}
