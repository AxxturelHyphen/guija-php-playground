// Generadores de trazas y helpers puros de la guía «Estructuras de datos» (data/estructuras.js).
// Todo es puro y sin DOM: se prueba en Node (tests/guias/test-estructuras.js). Un frame es un parche acumulativo de la
// escena activa más `line`, `es` y `en` (subtítulo). Las trazas se calculan ejecutando el algoritmo de verdad.
import { arbolVacio, insertarABB, buscarABB, borrarABB, recorrido, arbolDeArray, claveArista as K } from '../arbol.js';

const f = (o, es, en, line) => ({ ...o, es, en, ...(line != null && { line }) });
const val = (T, id) => T.nodos.find(n => n.id === id).val;
const nulos = ks => Object.fromEntries(ks.map(k => [k, null]));
/** Devuelve una función que, dado el mapa completo de estados deseado, genera el parche con null para lo que sobra. */
const marcador = () => { let prev = []; return nuevo => { const o = { ...nulos(prev.filter(k => !(k in nuevo))), ...nuevo }; prev = Object.keys(nuevo); return o; }; };

// ══ Lista enlazada (escena celdas) ═══════════════════════════════════════════════════════════════════════════════
// Nodos de la escena: letra n ∈ a,b,c,d; celda de dato `${n}d`, celda del enlace `${n}s`. «→bd» = puntero al nodo b.
export const NODOS_LISTA = ['a', 'b', 'c', 'd'];
const P = n => (n ? '→' + n + 'd' : '→∅');

/** Recorre la lista. ids = nodos en orden de lista; datos = {a: 10, …}. */
export function trazaRecorrer(ids, datos) {
  const F = [], out = [];
  F.push(f({ mostrar: ['act'], val: { act: P(ids[0]) } }, 'act = head: empezamos en el primer nodo.', 'act = head: we start at the first node.', 2));
  ids.forEach((n, i) => {
    out.push(datos[n]);
    F.push(f({}, `act no es nullptr: se imprime ${datos[n]}. Salida: ${out.join(' ')}`, `act is not nullptr: ${datos[n]} is printed. Output: ${out.join(' ')}`, 4));
    const s = ids[i + 1];
    F.push(f({ val: { act: P(s) } }, s ? `act = act->sig: salta al nodo ${datos[s]}.` : 'act = act->sig: era el último, act vale nullptr.',
      s ? `act = act->sig: it hops to node ${datos[s]}.` : 'act = act->sig: that was the last one, act is nullptr.', 5));
  });
  F.push(f({}, 'act == nullptr: el bucle termina.', 'act == nullptr: the loop ends.', 3));
  return { frames: F, salida: out };
}

/** Inserta al final recorriendo (sin tail): `nuevo` = letra del nodo libre, x = su valor. */
export function trazaAlFinal(ids, datos, nuevo, x) {
  const F = [];
  F.push(f({ mostrar: ['nuevo', nuevo + 'd', nuevo + 's'], val: { nuevo: P(nuevo), [nuevo + 'd']: x, [nuevo + 's']: '→∅' } },
    `new Nodo{${x}, nullptr}: se crea el nodo nuevo.`, `new Nodo{${x}, nullptr}: the new node is created.`, 2));
  F.push(f({ mostrar: ['act'], val: { act: P(ids[0]) } }, 'act = head: partimos del primer nodo.', 'act = head: we start at the first node.', 4));
  for (let i = 0; i < ids.length - 1; i++) {
    F.push(f({ val: { act: P(ids[i + 1]) } }, `act->sig no es nullptr: avanza hasta el ${datos[ids[i + 1]]}.`, `act->sig is not nullptr: move on to ${datos[ids[i + 1]]}.`, 5));
  }
  F.push(f({}, 'act->sig es nullptr: act es el último nodo.', 'act->sig is nullptr: act is the last node.', 5));
  F.push(f({ val: { [ids.at(-1) + 's']: P(nuevo) } }, 'act->sig = nuevo: el último nodo apunta al nuevo.', 'act->sig = nuevo: the last node points to the new one.', 6));
  return { frames: F, orden: [...ids, nuevo] };
}

/** Invierte la lista con ant/act/prox. Devuelve también el nuevo head y el modelo de enlaces final. */
export function trazaInvertir(ids, datos) {
  const F = [], sigDe = {};
  ids.forEach((n, i) => { sigDe[n] = ids[i + 1] ?? null; });
  let ant = null, act = ids[0];
  F.push(f({ mostrar: ['ant'], val: { ant: P(null) } }, 'ant = nullptr: aún no hay parte invertida.', 'ant = nullptr: no reversed part yet.', 2));
  F.push(f({ mostrar: ['act'], val: { act: P(act) } }, 'act = head: el primer nodo por procesar.', 'act = head: the first node to process.', 3));
  while (act) {
    const prox = sigDe[act];
    F.push(f({ mostrar: ['prox'], val: { prox: P(prox) } }, 'prox = act->sig: guarda el siguiente antes de romper el enlace.', 'prox = act->sig: saves the next one before breaking the link.', 5));
    sigDe[act] = ant;
    F.push(f({ val: { [act + 's']: P(ant) } }, `act->sig = ant: el ${datos[act]} apunta ahora hacia atrás.`, `act->sig = ant: ${datos[act]} now points backwards.`, 6));
    ant = act;
    F.push(f({ val: { ant: P(ant) } }, 'ant = act: la parte invertida crece un nodo.', 'ant = act: the reversed part grows by one node.', 7));
    act = prox;
    F.push(f({ val: { act: P(act) } }, act ? 'act = prox: seguimos con el siguiente.' : 'act = prox: era nullptr, no quedan nodos.',
      act ? 'act = prox: on to the next one.' : 'act = prox: it was nullptr, no nodes left.', 8));
  }
  F.push(f({ val: { head: P(ant) } }, 'return ant: es el nuevo primer nodo; head = invertir(head).', 'return ant: it is the new first node; head = invertir(head).', 10));
  return { frames: F, nuevoHead: ant, sig: sigDe };
}

const apunta = x => (typeof x === 'string' && x[0] === '→' && x !== '→∅' ? x[1] : null);
/** Estudia la lista desde head en una vista de valores: {orden, ciclo, perdidos (nodos inalcanzables desde head)}. */
export function analizarLista(v) {
  const orden = [], visto = new Set();
  let ciclo = false;
  for (let c = apunta(v.head); c;) {
    if (visto.has(c)) { ciclo = true; break; }
    visto.add(c); orden.push(c); c = apunta(v[c + 's']);
  }
  return { orden, ciclo, perdidos: NODOS_LISTA.filter(n => !visto.has(n)) };
}
/** Suelta el puntero `origen` (head o `xs`) sobre la celda `destino`: sobre un nodo lo apunta; sobre `nul`, a nullptr. */
export function recablear(v, origen, destino) {
  if (!(origen === 'head' || /^[abcd]s$/.test(origen))) return;
  if (destino === 'nul') v[origen] = '→∅';
  else if (/^[abcd][ds]$/.test(destino)) v[origen] = '→' + destino[0] + 'd';
}

// ══ Pila y cola sobre array (escena barras, estilo cajas) ════════════════════════════════════════════════════════
// v = vista de barras: arr, est, marcas (top | head, tail), cont (tam | n, overflow, underflow). Los errores no tocan el array.
export const CAP = 6;
const err = (v, k) => { v.cont[k] = (v.cont[k] ?? 0) + 1; return false; };
const recalcPila = v => { v.est = {}; for (let i = 0; i <= v.marcas.top; i++) v.est[i] = 'ok'; v.cont.tam = v.marcas.top + 1; };
export function pilaPush(v, x) {
  if (v.marcas.top >= CAP - 1) return err(v, 'overflow');
  v.arr[++v.marcas.top] = x; recalcPila(v); return true;
}
export function pilaPop(v) {
  if (v.marcas.top < 0) return err(v, 'underflow');
  v.marcas.top--; recalcPila(v); return true;
}
export const pilaCima = v => (v.marcas.top >= 0 ? v.arr[v.marcas.top] : null);

const recalcCola = v => { v.est = {}; for (let k = 0; k < v.cont.n; k++) v.est[(v.marcas.head + k) % CAP] = 'ok'; };
export function colaEnq(v, x) {
  if (v.cont.n >= CAP) return err(v, 'overflow');
  v.arr[v.marcas.tail] = x; v.marcas.tail = (v.marcas.tail + 1) % CAP; v.cont.n++; recalcCola(v); return true;
}
export function colaDeq(v) {
  if (v.cont.n <= 0) { err(v, 'underflow'); return undefined; }
  const x = v.arr[v.marcas.head]; v.marcas.head = (v.marcas.head + 1) % CAP; v.cont.n--; recalcCola(v); return x;
}
export const colaFrente = v => (v.cont.n > 0 ? v.arr[v.marcas.head] : null);
const colaVista = ini => { const v = { arr: [...ini.arr], marcas: { head: ini.head, tail: (ini.head + ini.n) % CAP }, cont: { n: ini.n }, est: {} }; recalcCola(v); return v; };

/** Ejecuta operaciones sobre una cola circular desde `ini` = {arr, head, n}; ops = [['E', x], ['D']]. */
export function trazaCola(ini, ops) {
  const v = colaVista(ini), F = [], salida = [];
  for (const [op, x] of ops) {
    if (op === 'E') {
      const t = v.marcas.tail;
      if (!colaEnq(v, x)) { F.push(f({ cont: { overflow: v.cont.overflow } }, `enqueue(${x}) con n = ${CAP}: overflow, se rechaza.`, `enqueue(${x}) with n = ${CAP}: overflow, rejected.`, 3)); continue; }
      const nt = v.marcas.tail, llena = v.cont.n === CAP;
      F.push(f({ poner: { [t]: x }, est: { [t]: 'ok' }, marcas: { tail: nt }, cont: { n: v.cont.n } },
        `enqueue(${x}): datos[${t}] = ${x}; tail = (${t} + 1) % ${CAP} = ${nt}.${t + 1 === CAP ? ' Da la vuelta.' : ''}${llena ? ' Cola llena: head == tail.' : ''}`,
        `enqueue(${x}): datos[${t}] = ${x}; tail = (${t} + 1) % ${CAP} = ${nt}.${t + 1 === CAP ? ' It wraps around.' : ''}${llena ? ' Queue full: head == tail.' : ''}`, 3));
    } else {
      const h = v.marcas.head, y = colaDeq(v);
      if (y === undefined) { F.push(f({ cont: { underflow: v.cont.underflow } }, 'dequeue() con n = 0: underflow, se rechaza.', 'dequeue() with n = 0: underflow, rejected.', 4)); continue; }
      salida.push(y);
      F.push(f({ est: { [h]: null }, marcas: { head: v.marcas.head }, cont: { n: v.cont.n } },
        `dequeue() devuelve ${y}; head = (${h} + 1) % ${CAP} = ${v.marcas.head}.`, `dequeue() returns ${y}; head = (${h} + 1) % ${CAP} = ${v.marcas.head}.`, 4));
    }
  }
  return { frames: F, salida, final: v };
}

/** v.erase(v.begin()) sobre un vector de `arr.length` elementos: n-1 desplazamientos. */
export function trazaBorrarInicio(arr) {
  const a = [...arr], n = a.length, F = [];
  for (let k = 0; k < n - 1; k++) {
    a[k] = a[k + 1];
    F.push(f({ poner: { [k]: a[k] }, est: { [k]: 'sel', ...(k && { [k - 1]: 'ok' }) }, cont: { movimientos: k + 1 } },
      `v[${k}] = v[${k + 1}]: el ${a[k]} se corre un hueco a la izquierda.`, `v[${k}] = v[${k + 1}]: ${a[k]} shifts one slot to the left.`, 2));
  }
  F.push(f({ est: { [n - 2]: 'ok', [n - 1]: null } }, `size baja a ${n - 1}. En total, ${n - 1} desplazamientos: O(n).`, `size drops to ${n - 1}. In total, ${n - 1} shifts: O(n).`, 2));
  return { frames: F, resultado: a.slice(0, n - 1) };
}

// ══ ABB (escena arbol) ═══════════════════════════════════════════════════════════════════════════════════════════
const lado = (x, v) => (x < v ? { es: 'izquierda', en: 'left' } : { es: 'derecha', en: 'right' });

/** Inserta `valores` uno a uno bajando por el camino (líneas del código: 2 base, 3 izquierda, 4 derecha). */
export function trazaInsertar(valores, T0 = arbolVacio()) {
  const F = [], E = marcador(), A = marcador();
  let T = T0;
  for (const x of valores) {
    const r = insertarABB(T, x);
    if (r.repetido) { F.push(f({}, `El ${x} ya está: los duplicados se ignoran.`, `${x} is already there: duplicates are ignored.`, 5)); continue; }
    if (!r.camino.length) F.push(f({ ...r.parche, est: E({ [r.nodo.id]: 'ok' }), aristaEst: A({}) }, `El árbol está vacío: el ${x} es la raíz.`, `The tree is empty: ${x} becomes the root.`, 2));
    else {
      r.camino.forEach((id, i) => {
        const v = val(T, id), d = lado(x, v), ant = r.camino[i - 1];
        F.push(f({ est: E({ ...(ant && { [ant]: 'camino' }), [id]: 'activo' }), aristaEst: A(ant ? { [K(ant, id)]: 'camino' } : {}) },
          `${x} ${x < v ? '<' : '>'} ${v}: bajamos por la ${d.es}.`, `${x} ${x < v ? '<' : '>'} ${v}: we go ${d.en}.`, x < v ? 3 : 4));
      });
      F.push(f({ ...r.parche, est: E({ [r.camino.at(-1)]: 'camino', [r.nodo.id]: 'ok' }), aristaEst: A({ [K(r.arista.a, r.arista.b)]: 'camino' }) },
        `Hueco libre: aquí se cuelga el ${x}.`, `Free slot: ${x} is attached here.`, 2));
    }
    T = r.arbol;
  }
  F.push(f({ est: E({}), aristaEst: A({}) }, 'Árbol terminado: el camino de cada inserción dependía del orden.', 'Tree done: each insertion path depended on the order.'));
  return { frames: F, arbol: T };
}

/** Busca x siguiendo el camino. L = líneas del código {hallado, izq, der, nulo}. */
export function trazaBuscar(T, x, L = { hallado: 2, izq: 3, der: 4, nulo: 2 }) {
  const b = buscarABB(T, x), F = [];
  b.camino.forEach((id, i) => {
    const v = val(T, id), ant = b.camino[i - 1], hallado = v === x, d = lado(x, v);
    F.push(f({ est: { ...(ant && { [ant]: 'camino' }), [id]: hallado ? 'ok' : 'activo' }, ...(ant && { aristaEst: { [K(ant, id)]: 'camino' } }) },
      hallado ? `${v} = ${x}: encontrado.` : `${x} ${x < v ? '<' : '>'} ${v}: seguimos por la ${d.es}.`,
      hallado ? `${v} = ${x}: found.` : `${x} ${x < v ? '<' : '>'} ${v}: we continue ${d.en}.`, hallado ? L.hallado : x < v ? L.izq : L.der));
  });
  if (!b.encontrado) {
    F.push(f({ est: { [b.camino.at(-1)]: 'mal' } }, `No hay hijo por ahí (nullptr): el ${x} no está.`, `No child there (nullptr): ${x} is not in the tree.`, L.nulo));
  }
  return { frames: F, ...b };
}

/** Borra x (líneas del código de borrar: 3 izq, 4 der, 5 sin izq, 6 sin der, 7-10 dos hijos). */
export function trazaBorrar(T, x) {
  const d = borrarABB(T, x), B = trazaBuscar(T, x, { hallado: 5, izq: 3, der: 4, nulo: 2 }), F = B.frames.slice(0, -1);
  const ant = d.camino.at(-2), aEst = ant ? { aristaEst: { [K(ant, d.id)]: 'camino' } } : {};
  if (d.caso === 0) {
    F.push(f({ est: { [d.id]: 'mal' }, ...aEst }, `El ${x} es una hoja: no tiene hijos.`, `${x} is a leaf: it has no children.`, 5));
    F.push(f({ ...d.parche, est: null, aristaEst: null }, 'Se quita sin más: su padre pierde ese hijo.', 'It is simply removed: its parent loses that child.', 5));
  } else if (d.caso === 1) {
    const hijo = T.aristas.find(e => e.a === d.id), hv = val(T, hijo.b), linea = hijo.lado === 'd' ? 5 : 6;
    F.push(f({ est: { [d.id]: 'mal' }, ...aEst }, `El ${x} tiene un solo hijo, el ${hv}.`, `${x} has a single child, ${hv}.`, linea));
    F.push(f({ ...d.parche, est: null, aristaEst: null }, `El ${hv} ocupa su lugar y se libera el nodo.`, `${hv} takes its place and the node is freed.`, linea));
  } else {
    F.push(f({ est: { [d.id]: 'mal' }, ...aEst }, `El ${x} tiene dos hijos: no se puede quitar sin más.`, `${x} has two children: it cannot simply be removed.`, 7));
    d.caminoSucesor.forEach((s, i) => {
      const ultimo = i + 1 === d.caminoSucesor.length, previo = i ? d.caminoSucesor[i - 1] : d.id;
      F.push(f({ est: { ...(i && { [previo]: 'camino' }), [s]: 'activo' }, aristaEst: { [K(previo, s)]: 'camino' } },
        ultimo ? `El sucesor es el ${val(T, s)}: no tiene hijo izquierdo.` : 'Sucesor: el menor de la derecha, siempre a la izquierda.',
        ultimo ? `The successor is ${val(T, s)}: it has no left child.` : 'Successor: the smallest on the right, always going left.', 8));
    });
    const vs = val(T, d.sucesor);
    F.push(f({ val: d.parche.val, est: { [d.id]: 'ok', [d.sucesor]: 'mal' } }, `Se copia el ${vs} en el nodo del ${x}: el orden se mantiene.`, `${vs} is copied into the node of ${x}: the order is kept.`, 9));
    F.push(f({ '-nodos': d.parche['-nodos'], ...(d.parche['+aristas'] && { '+aristas': d.parche['+aristas'] }), est: null, aristaEst: null },
      'Se borra el nodo original del sucesor: tiene como mucho un hijo.', 'The successor original node is removed: it has at most one child.', 10));
  }
  return { frames: F, parche: d.parche, arbol: d.arbol, caso: d.caso };
}

/** Recorrido ('in' | 'pre' | 'post' | 'niveles'); `linea` = línea del código donde se visita el nodo. */
export function trazaRecorrido(T, tipo, linea) {
  const orden = recorrido(T, tipo), F = [], out = [];
  const hijos = id => T.aristas.filter(e => e.a === id).sort((p, q) => (p.lado === 'i' ? 0 : 1) - (q.lado === 'i' ? 0 : 1)).map(e => e.b);
  const cola = tipo === 'niveles' ? [orden[0]] : null;
  orden.forEach((id, k) => {
    const v = val(T, id);
    out.push(v);
    let es = `Se visita el ${v}. Salida: ${out.join(' ')}`, en = `${v} is visited. Output: ${out.join(' ')}`;
    if (cola) {
      cola.shift(); cola.push(...hijos(id));
      const q = cola.map(c => val(T, c)).join(' ') || '(vacía)', qe = cola.map(c => val(T, c)).join(' ') || '(empty)';
      es = `Sale el ${v}. Cola: ${q}. Salida: ${out.join(' ')}`; en = `${v} comes out. Queue: ${qe}. Output: ${out.join(' ')}`;
    }
    F.push(f({ est: { ...(k && { [orden[k - 1]]: 'visitado' }), [id]: 'activo' }, etiquetas: { [id]: String(k + 1) } }, es, en, linea));
  });
  F.push(f({ est: Object.fromEntries(orden.map(id => [id, 'visitado'])) }, `Recorrido completo: ${out.join(' ')}.`, `Traversal complete: ${out.join(' ')}.`));
  return { frames: F, salida: out, orden };
}

// ══ Montículo máximo (escena arbol, nodo i = h + i) ══════════════════════════════════════════════════════════════
export const padre = i => (i - 1) >> 1;
export const esMonticulo = a => a.every((x, i) => !i || a[padre(i)] >= x);
/** push: devuelve el array resultante (sift-up). */
export function subir(arr, x) {
  const h = [...arr, x];
  for (let i = h.length - 1; i > 0 && h[padre(i)] < h[i]; i = padre(i)) [h[i], h[padre(i)]] = [h[padre(i)], h[i]];
  return h;
}
/** pop: {arr, tope} (sift-down con el hijo mayor). */
export function bajar(arr) {
  const h = [...arr], tope = h[0];
  h[0] = h.at(-1); h.pop();
  const n = h.length;
  for (let i = 0; 2 * i + 1 < n;) {
    let m = 2 * i + 1;
    if (m + 1 < n && h[m + 1] > h[m]) m++;
    if (h[i] >= h[m]) break;
    [h[i], h[m]] = [h[m], h[i]]; i = m;
  }
  return { arr: h, tope };
}
const etiq = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ['h' + i, `[${i}]`]));
export const etiquetasHeap = etiq;

/** push con sift-up (líneas: 2 push_back, 4 comparar, 5 intercambiar). */
export function trazaSubir(arr0, x) {
  const h = [...arr0, x], n = arr0.length, F = [], E = marcador(), A = marcador(), nuevo = { id: 'h' + n, val: x };
  F.push(f({ '+nodos': [nuevo], '+aristas': [{ a: 'h' + padre(n), b: nuevo.id, lado: n % 2 ? 'i' : 'd' }], etiquetas: { [nuevo.id]: `[${n}]` }, est: E({ [nuevo.id]: 'activo' }) },
    `push_back(${x}): al final, índice ${n}. Su padre es el índice ${padre(n)} (${h[padre(n)]}).`, `push_back(${x}): at the end, index ${n}. Its parent is index ${padre(n)} (${h[padre(n)]}).`, 2));
  let i = n;
  for (; i > 0 && h[padre(i)] < h[i]; i = padre(i)) {
    const p = padre(i), a = 'h' + i, b = 'h' + p;
    F.push(f({ aristaEst: A({ [K(b, a)]: 'activa' }), est: E({ [a]: 'activo', [b]: 'mal' }) }, `${h[i]} > ${h[p]}: el hijo supera a su padre, rompe la regla.`, `${h[i]} > ${h[p]}: the child exceeds its parent, which breaks the rule.`, 4));
    [h[i], h[p]] = [h[p], h[i]];
    F.push(f({ val: { [a]: h[i], [b]: h[p] }, aristaEst: A({}), est: E({ [a]: 'visitado', [b]: 'activo' }) }, `Se intercambian: el ${h[p]} sube un nivel.`, `They swap: ${h[p]} moves up one level.`, 5));
  }
  F.push(f({ aristaEst: A({}), est: E({ ['h' + i]: 'ok' }) },
    i ? `El padre (${h[padre(i)]}) es mayor o igual: se para.` : 'Ha llegado a la raíz: se para.', i ? `The parent (${h[padre(i)]}) is greater or equal: it stops.` : 'It reached the root: it stops.', 4));
  return { frames: F, arr: h };
}

/** pop con sift-down (líneas: 2 tope, 3 mover último, 4 pop_back, 7-8 hijo mayor, 9 comparar, 10 intercambiar). */
export function trazaBajar(arr0) {
  const h = [...arr0], tope = h[0], F = [], E = marcador(), A = marcador(), ult = h.length - 1;
  F.push(f({ est: E({ h0: 'activo' }) }, `tope = ${tope}: se guarda la raíz, que es lo que devuelve pop().`, `tope = ${tope}: the root is saved, it is what pop() returns.`, 2));
  h[0] = h[ult];
  F.push(f({ val: { h0: h[0] }, est: E({ h0: 'activo', ['h' + ult]: 'visitado' }) }, `h[0] = h.back(): el último (${h[0]}) pasa a la raíz.`, `h[0] = h.back(): the last one (${h[0]}) moves to the root.`, 3));
  h.pop();
  const n = h.length;
  F.push(f({ '-nodos': ['h' + ult], est: null, aristaEst: null }, `pop_back(): size baja a ${n}. Ahora la raíz puede romper la regla.`, `pop_back(): size drops to ${n}. Now the root may break the rule.`, 4));
  let i = 0, E2 = marcador(), A2 = marcador();
  for (; 2 * i + 1 < n;) {
    let m = 2 * i + 1;
    if (m + 1 < n && h[m + 1] > h[m]) m++;
    const a = 'h' + i, b = 'h' + m;
    const hijos = 2 * i + 2 < n ? `${h[2 * i + 1]} y ${h[2 * i + 2]}` : `${h[2 * i + 1]}`;
    if (h[i] >= h[m]) {
      F.push(f({ est: E2({ [a]: 'ok' }), aristaEst: A2({}) }, `${h[i]} >= ${h[m]}: ya es mayor o igual que su hijo mayor. Se para.`, `${h[i]} >= ${h[m]}: already greater or equal to its larger child. It stops.`, 9));
      return { frames: F, arr: h, tope };
    }
    F.push(f({ est: E2({ [a]: 'activo', [b]: 'camino' }), aristaEst: A2({ [K(a, b)]: 'activa' }) }, `Hijos: ${hijos}. El mayor es ${h[m]} > ${h[i]}: hay que bajar.`, `Children: ${hijos}. The larger is ${h[m]} > ${h[i]}: it has to go down.`, 8));
    [h[i], h[m]] = [h[m], h[i]];
    F.push(f({ val: { [a]: h[i], [b]: h[m] }, est: E2({ [a]: 'visitado', [b]: 'activo' }), aristaEst: A2({}) }, `Se intercambian: el ${h[i]} sube y el ${h[m]} baja.`, `They swap: ${h[i]} goes up and ${h[m]} goes down.`, 10));
    i = m;
  }
  F.push(f({ est: E2({ ['h' + i]: 'ok' }), aristaEst: A2({}) }, `El ${h[i]} ya no tiene hijos dentro del array. Se para.`, `${h[i]} has no children inside the array. It stops.`, 6));
  return { frames: F, arr: h, tope };
}

/** Parche que lleva el estado de arbolDeArray(a0) al de arbolDeArray(a1) (mismos ids h0…): para restaurar tras una traza. */
export function parcheHeap(a0, a1) {
  const T1 = arbolDeArray(a1), p = { est: null, aristaEst: null }, v = {};
  const nuevos = T1.nodos.slice(a0.length);
  if (nuevos.length) { p['+nodos'] = nuevos; p['+aristas'] = T1.aristas.filter(e => nuevos.some(n => n.id === e.b)); p.etiquetas = Object.fromEntries(nuevos.map(n => [n.id, `[${n.id.slice(1)}]`])); }
  if (a1.length < a0.length) p['-nodos'] = a0.slice(a1.length).map((_, k) => 'h' + (a1.length + k));
  for (let i = 0; i < Math.min(a0.length, a1.length); i++) if (a0[i] !== a1[i]) v['h' + i] = a1[i];
  if (Object.keys(v).length) p.val = v;
  return p;
}
