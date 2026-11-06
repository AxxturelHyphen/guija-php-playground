// Escena «arbol» (árboles y grafos): nodos redondos con aristas que se recolocan con transición suave cuando cambia la
// estructura. Sirve para árboles de llamadas, árboles por niveles (teorema maestro), ABB, montículos y grafos.
// Implementa el contrato de escena de guia.js: clave, plegar (pura), crear → {fijar, pintar, tam, arrastre}, vista/conVista/ctx.
//
// ── FORMATO ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Un paso ABRE la escena con
//   arbol: {
//     modo?:    'arbol' (def.) | 'libre'
//     nodos:    [{id, val, x?, y?}]    id = texto único SIN '-' (la clave de arista es «a-b»); val = número, texto corto
//                                      (hasta ~8 car.) u objeto {es,en}. x,y solo en modo 'libre'.
//     aristas:  [{a, b, lado?, peso?, dir?, curva?}]
//                 modo 'arbol': a = padre, b = hijo; `lado` 'i'|'d' decide izquierda/derecha (sin lado: por orden).
//                 modo 'libre': peso (número o texto) se dibuja sobre la arista; dir:true añade punta de flecha en b;
//                               curva = desvío en px (por defecto 20 si existe también b→a, para que no se solapen).
//     raiz?:    id                      (solo ordena: el árbol se deduce de las aristas; varias raíces = bosque)
//     notas?:   [{nivel, texto}]        etiquetas laterales por nivel (texto o {es,en})
//     cabida?:  {niveles, hojas, ancho?, notas?, texto?}  reserva el tamaño del árbol MÁXIMO para que la escena no salte
//                 al crecer (usa cabidaDe(arbolFinal) / cabidaMax(...)). `ancho` = ancho en ranuras (por defecto hojas-1;
//                 un ABB degenerado necesita (niveles-1)/2). notas: true | px reserva el margen derecho para `notas`.
//                 Sin cabida se usa el tamaño del estado inicial. Si el árbol real no cabe se comprime (nunca se sale).
//     lienzo?:  {W, H}                  solo modo 'libre' (por defecto 640×400)
//     radio?:   px                      radio de nodo (por defecto según el texto más largo: 16..32)
//   }
//   modo 'libre': x,y entre 0 y 1 = fracción del lienzo (con margen); mayores que 1 = px lógicos del lienzo.
//
// Parches acumulativos (en pasos y en frames de `traza`), aplicados en este orden:
//   '-nodos': [ids]              quita los nodos y sus aristas (y su est/etiqueta/val)
//   '-aristas': ['a-b', …]
//   '+nodos': [{id,val,x?,y?}]   (id existente: se sustituye)
//   '+aristas': [{a,b,lado?,peso?,dir?}]   (clave existente: se sustituye)
//   val: {id: v}                 cambia el texto del nodo
//   etiquetas: {id: texto|null}  texto pequeño bajo el nodo («h=2», «=5»); etiquetas:null borra todas
//   est: {id: estado|null}       'activo'|'visitado'|'camino'|'ok'|'mal'; null quita; est:null limpia todo
//   aristaEst: {'a-b': 'camino'|'activa'|null}   (aristaEst:null limpia todo)
//   notas: [{nivel,texto}]       sustituye la lista; notas:null la vacía
// `hl` del paso ({id: 'a'|'b'|'c', 'a-b': …}) resalta como activo/ok/mal solo en ese paso (aristas: 'activa').
// Un cambio de estructura (± nodos/aristas) recoloca TODO: los nuevos nacen en su padre con fade+escala, los que salen se
// desvanecen. Estados sin depender solo del color: activo = anillo exterior, camino = borde grueso, visitado = relleno
// tenue y texto apagado, ok = marca ✓, mal = borde discontinuo y marca ✗; aristas: camino = gruesa, activa = discontinua.
// Arrastre (jugar.arrastrables): ids === true | [ids]; al soltar el nodo se queda donde se dejó hasta el próximo cambio
// de estructura (o paso) y se llama cb(id, x, y) en px lógicos. Las aristas lo siguen en vivo.
// vista(S) = datos planos {est, val, etiquetas, aristaEst}; ctx(S) = funciones puras (altura, camino, hijos, recorrido…).
//
// INTERACCIÓN (sin cambiar el formato): tooltip al pasar el puntero o enfocar un nodo (id, clave, nivel, padre e hijos o vecinos
// con su peso, estado) y resaltado de sus aristas y vecinos; el nodo agarrado sigue al puntero a través de un Muelle (peso) y al
// soltar se asienta conservando la velocidad; teclado: Tab enfoca nodos arrastrables, las flechas los desplazan (Mayús = paso
// grande) e Intro/Espacio los «suelta» (llama a cb como al soltar con el ratón). Un pulso de aro avisa de cada cambio de estado.
// Los textos con `$…$` (valores, etiquetas y notas laterales) se dibujan con KaTeX en un <foreignObject> (mates.etiqueta, solo si cambian).

import { idioma } from './idioma.js';
import { etiqueta } from './mates.js';
import { Muelle, tarea } from './movimiento.js';
import { crearTip } from './tip.js';

export const clave = 'arbol';
const NS = 'http://www.w3.org/2000/svg';
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reducido = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const L = x => ((x && typeof x === 'object' ? x[globalThis.document ? idioma() : 'es'] : x) ?? '');
const txt = v => String(L(v));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const claveArista = (a, b) => a + '-' + b;
/** Id de nodo seguro para un valor numérico/textual (sin '-' ni espacios: la clave de arista es «a-b»). */
export const idN = (v, pref = 'n') => pref + String(v).replace('-', 'm').replace(/[.\s]/g, 'p');

// ── Estructura: padres, hijos ordenados por `lado`, raíces ─────────────────────────────────────────────────────────
function estructura(nodos, aristas, raiz) {
  const ids = new Set(nodos.map(n => n.id)), hijos = new Map(nodos.map(n => [n.id, []])), padre = new Map();
  for (const e of aristas) if (ids.has(e.a) && ids.has(e.b) && e.a !== e.b && !padre.has(e.b)) { padre.set(e.b, e.a); hijos.get(e.a).push({ id: e.b, lado: e.lado }); }
  const rango = h => (h.lado === 'i' ? 0 : h.lado === 'd' ? 2 : 1);
  for (const h of hijos.values()) h.sort((p, q) => rango(p) - rango(q));
  const raices = nodos.map(n => n.id).filter(i => !padre.has(i));
  if (raiz != null && raices.includes(raiz)) { raices.splice(raices.indexOf(raiz), 1); raices.unshift(raiz); }
  return { hijos, padre, raices };
}

// ── Diseño de árbol ordenado por contornos (compacto, sin cruces) ──────────────────────────────────────────────────
// Cada subárbol devuelve sus contornos izquierdo/derecho por profundidad (relativos a su raíz); los hermanos se separan
// lo justo (≥ 1 ranura) en el nivel donde más se acercan y el padre se centra sobre sus hijos. Un hijo único con `lado`
// se desplaza media ranura (así un ABB degenerado se ve como una diagonal y no como una columna).
function colocar(subs, fijo) {
  const pos = [fijo ?? 0], Lc = subs[0].L.map(x => x + pos[0]), Rc = subs[0].R.map(x => x + pos[0]);
  for (let i = 1; i < subs.length; i++) {
    const s = subs[i], n = Math.min(Rc.length, s.L.length);
    let p = -Infinity;
    for (let d = 0; d < n; d++) p = Math.max(p, Rc[d] - s.L[d] + 1);
    pos.push(p);
    s.L.forEach((x, d) => { if (d < Lc.length) Rc[d] = p + s.R[d]; else { Lc.push(p + x); Rc.push(p + s.R[d]); } });
  }
  return { pos, L: Lc, R: Rc };
}

/** Posiciones en ranuras: {X: Map id→x, D: Map id→nivel, min, max, niveles, hojas}. Ignora ciclos y segundos padres. */
function unidades(nodos, aristas, raiz) {
  const { hijos, raices } = estructura(nodos, aristas, raiz), visto = new Set(), X = new Map(), D = new Map();
  let hojas = 0;
  const sub = id => {
    visto.add(id);
    const hs = [];
    for (const k of hijos.get(id)) if (!visto.has(k.id)) hs.push({ id: k.id, lado: k.lado, s: sub(k.id) });
    if (!hs.length) { hojas++; return { id, L: [0], R: [0], hs }; }
    const solo = hs.length === 1, c = colocar(hs.map(h => h.s), solo ? (hs[0].lado === 'i' ? -.5 : hs[0].lado === 'd' ? .5 : 0) : undefined);
    const centro = solo ? 0 : (c.pos[0] + c.pos.at(-1)) / 2;
    hs.forEach((h, i) => { h.off = c.pos[i] - centro; });
    return { id, L: [0, ...c.L.map(x => x - centro)], R: [0, ...c.R.map(x => x - centro)], hs };
  };
  const rs = [];
  for (const id of [...raices, ...nodos.map(n => n.id)]) if (!visto.has(id)) rs.push(sub(id));
  const asignar = (s, x, d) => { X.set(s.id, x); D.set(s.id, d); for (const h of s.hs) asignar(h.s, x + h.off, d + 1); };
  if (rs.length) colocar(rs).pos.forEach((p, i) => asignar(rs[i], p, 0));
  const xs = [...X.values()], niveles = rs.length ? Math.max(...D.values()) + 1 : 0;
  return { X, D, min: xs.length ? Math.min(...xs) : 0, max: xs.length ? Math.max(...xs) : 0, niveles, hojas };
}

const R0 = 18;
const geo = r => ({ r, dx: 2 * r + 14, dy: 2 * r + 26, mx: r + 10, my: r + 8, mb: r + 20 });

/**
 * Diseño completo: {pos: {id: {x,y}}, W, H, niveles, hojas, ancho, y(nivel)}. o = {r, W, H}: con W/H dados el árbol se
 * centra en esa caja y se comprime si no cabe; sin ellos devuelve su tamaño natural. modo 'libre': x,y del nodo
 * (0..1 = fracción de la caja, >1 = px).
 */
export function trazar(nodos, aristas, modo = 'arbol', o = {}) {
  const g = geo(o.r ?? R0), pos = {};
  if (modo === 'libre') {
    const W = o.W ?? 640, H = o.H ?? 400, p = (v, tam, m) => (v <= 1 ? m + v * (tam - 2 * m) : v);
    for (const n of nodos) pos[n.id] = { x: p(n.x ?? .5, W, g.mx), y: p(n.y ?? .5, H, g.mb) };
    return { pos, W, H, niveles: 0, hojas: 0, ancho: 0, y: () => 0 };
  }
  const U = unidades(nodos, aristas, o.raiz), ancho = U.max - U.min, cx = (U.min + U.max) / 2;
  const W = o.W ?? Math.max(ancho, 1) * g.dx + 2 * g.mx;
  const dx = o.W ? Math.min(g.dx, (o.W - 2 * g.mx) / Math.max(ancho, 1)) : g.dx;
  const dy = o.H ? Math.min(g.dy, (o.H - g.my - g.mb) / Math.max(U.niveles - 1, 1)) : g.dy;
  const H = o.H ?? g.my + Math.max(U.niveles - 1, 0) * dy + g.mb, y = n => g.my + n * dy;
  for (const n of nodos) pos[n.id] = { x: W / 2 + (U.X.get(n.id) - cx) * dx, y: y(U.D.get(n.id)) };
  return { pos, W, H, niveles: U.niveles, hojas: U.hojas, ancho, y };
}
/** Solo posiciones {id: {x,y}} (px lógicos). */
export const disenar = (nodos, aristas, modo = 'arbol', o = {}) => trazar(nodos, aristas, modo, o).pos;
/** Medidas del árbol: {niveles, hojas, ancho (ranuras), W, H} (tamaño natural con radio o.r). */
export function medida(nodos, aristas, o = {}) { const { niveles, hojas, ancho, W, H } = trazar(nodos, aristas, 'arbol', o); return { niveles, hojas, ancho, W, H }; }
/** Valor para `arbol.cabida` que reserva sitio para el árbol dado ({nodos, aristas, raiz?}). */
export function cabidaDe(T) { const { niveles, hojas, min, max } = unidades(T.nodos, T.aristas, T.raiz); return { niveles, hojas, ancho: max - min }; }
/** Cabida que admite varios árboles (el máximo de cada medida): para trazas donde el árbol crece y cambia de forma. */
export const cabidaMax = (...ts) => ts.map(cabidaDe).reduce((m, c) => ({ niveles: Math.max(m.niveles, c.niveles), hojas: Math.max(m.hojas, c.hojas), ancho: Math.max(m.ancho, c.ancho) }), { niveles: 0, hojas: 0, ancho: 0 });

// ── Parche de estado ───────────────────────────────────────────────────────────────────────────────────────────────
const sin = (o, f) => Object.fromEntries(Object.entries(o).filter(([k]) => !f(k)));
const fusion = (o, p) => { const r = { ...o }; for (const [k, v] of Object.entries(p)) if (v == null || v === '') delete r[k]; else r[k] = v; return r; };

/** Parte estructural de un parche sobre {nodos, aristas}: devuelve {nodos, aristas, ids (quitados), claves (aristas quitadas)}. */
function estructural(nodos, aristas, p) {
  const ids = new Set(p['-nodos'] || []), claves = new Set(p['-aristas'] || []);
  if (ids.size) for (const e of aristas) if (ids.has(e.a) || ids.has(e.b)) claves.add(claveArista(e.a, e.b));
  if (ids.size) nodos = nodos.filter(n => !ids.has(n.id));
  if (claves.size) aristas = aristas.filter(e => !claves.has(claveArista(e.a, e.b)));
  if (p['+nodos']?.length) { const nuevos = new Map(p['+nodos'].map(n => [n.id, n])); nodos = [...nodos.map(n => nuevos.get(n.id) ?? n), ...p['+nodos'].filter(n => !nodos.some(m => m.id === n.id))]; }
  if (p['+aristas']?.length) { const k = e => claveArista(e.a, e.b), nuevas = new Map(p['+aristas'].map(e => [k(e), e])); aristas = [...aristas.map(e => nuevas.get(k(e)) ?? e), ...p['+aristas'].filter(e => !aristas.some(f => k(f) === k(e)))]; }
  return { nodos, aristas, ids, claves };
}

/** Estado nuevo = estado previo `s` + parche `p` (paso o frame). PURA: no muta `s` ni `p`. Si `p.arbol` existe abre escena. */
export function plegar(s, p) {
  if (p.arbol) {
    const d = p.arbol, nodos = [...(d.nodos || [])];
    s = { def: d, nodos, aristas: [...(d.aristas || [])], val: Object.fromEntries(nodos.map(n => [n.id, n.val])), etiquetas: {}, est: {}, aristaEst: {}, notas: [...(d.notas || [])] };
  } else s = { ...s };
  const e = estructural(s.nodos, s.aristas, p);
  s.nodos = e.nodos; s.aristas = e.aristas;
  if (e.ids.size || e.claves.size) {
    s.val = sin(s.val, k => e.ids.has(k)); s.etiquetas = sin(s.etiquetas, k => e.ids.has(k)); s.est = sin(s.est, k => e.ids.has(k));
    s.aristaEst = sin(s.aristaEst, k => e.claves.has(k));
  }
  for (const n of p['+nodos'] || []) s.val = { ...s.val, [n.id]: n.val };
  if (p.val) s.val = { ...s.val, ...p.val };
  if (p.etiquetas !== undefined) s.etiquetas = p.etiquetas === null ? {} : fusion(s.etiquetas, p.etiquetas);
  if (p.est !== undefined) s.est = p.est === null ? {} : fusion(s.est, p.est);
  if (p.aristaEst !== undefined) s.aristaEst = p.aristaEst === null ? {} : fusion(s.aristaEst, p.aristaEst);
  if (p.notas !== undefined) s.notas = p.notas === null ? [] : [...p.notas];
  return s;
}

// ── Helpers de árboles para los autores de guías (puros) ───────────────────────────────────────────────────────────
// Un árbol es {nodos:[{id,val}], aristas:[{a,b,lado}], raiz?}. Las funciones de ABB devuelven también un `parche`
// listo para usar como frame/paso: {'+nodos', '+aristas', '-nodos', val}.
export const arbolVacio = () => ({ nodos: [], aristas: [], raiz: null });
const raizDe = T => T.raiz ?? T.nodos[0]?.id ?? null;
const hijoDe = (T, id, lado) => T.aristas.find(e => e.a === id && e.lado === lado)?.b;
const nodoDe = (T, id) => T.nodos.find(n => n.id === id);

/** Aplica un parche estructural a un árbol {nodos, aristas, raiz} y devuelve otro (val: {id: v} cambia valores). */
export function parchar(T, p) {
  const e = estructural(T.nodos, T.aristas, p);
  const nodos = p.val ? e.nodos.map(n => (n.id in p.val ? { ...n, val: p.val[n.id] } : n)) : e.nodos;
  return { ...T, nodos, aristas: e.aristas, raiz: T.raiz != null && e.ids.has(T.raiz) ? null : T.raiz };
}

/** Busca `valor`: {encontrado, id (del nodo hallado), camino: ids desde la raíz hasta el último nodo visitado}. */
export function buscarABB(T, valor) {
  const camino = [];
  for (let cur = raizDe(T); cur != null;) {
    camino.push(cur);
    const v = nodoDe(T, cur).val;
    if (valor === v) return { encontrado: true, id: cur, camino };
    cur = hijoDe(T, cur, valor < v ? 'i' : 'd');
  }
  return { encontrado: false, id: null, camino };
}

/** Inserta en un ABB (sin duplicados): {arbol, nodo, arista|null, camino (ids hasta el padre), repetido, parche}. */
export function insertarABB(T, valor) {
  const nodo = { id: idN(valor), val: valor }, b = buscarABB(T, valor);
  if (b.encontrado) return { arbol: T, nodo: nodoDe(T, b.id), arista: null, camino: b.camino, repetido: true, parche: {} };
  const padre = b.camino.at(-1) ?? null, arista = padre == null ? null : { a: padre, b: nodo.id, lado: valor < nodoDe(T, padre).val ? 'i' : 'd' };
  const parche = { '+nodos': [nodo], ...(arista && { '+aristas': [arista] }) };
  return { arbol: { ...parchar(T, parche), raiz: T.raiz ?? nodo.id }, nodo, arista, camino: b.camino, repetido: false, parche };
}

/**
 * Borra `valor` de un ABB. Dos hijos: el nodo conserva su id y toma el valor del sucesor (el menor de la derecha), que es
 * el que desaparece. → {encontrado, caso (0|1|2 hijos), id, sucesor, camino (hasta el nodo), caminoSucesor, arbol, parche}.
 */
export function borrarABB(T, valor) {
  const b = buscarABB(T, valor);
  if (!b.encontrado) return { encontrado: false, arbol: T, camino: b.camino, parche: {} };
  const id = b.id, padreE = T.aristas.find(e => e.b === id), hs = T.aristas.filter(e => e.a === id), res = { encontrado: true, id, camino: b.camino, sucesor: null, caminoSucesor: [] };
  let parche, raiz = raizDe(T);
  if (hs.length < 2) {
    res.caso = hs.length;
    parche = { '-nodos': [id], ...(hs.length && padreE && { '+aristas': [{ a: padreE.a, b: hs[0].b, lado: padreE.lado }] }) };
    if (id === raiz) raiz = hs[0]?.b ?? null;
  } else {
    res.caso = 2;
    let s = hijoDe(T, id, 'd'); res.caminoSucesor = [s];
    for (let i = hijoDe(T, s, 'i'); i != null; i = hijoDe(T, s, 'i')) { s = i; res.caminoSucesor.push(s); }
    const padreS = T.aristas.find(e => e.b === s).a, r = hijoDe(T, s, 'd');
    res.sucesor = s;
    parche = { '-nodos': [s], val: { [id]: nodoDe(T, s).val }, ...(r != null && { '+aristas': [{ a: padreS, b: r, lado: padreS === id ? 'd' : 'i' }] }) };
  }
  return { ...res, arbol: { ...parchar(T, parche), raiz }, parche };
}

/** Árbol completo (mismo nº de hijos en todos los niveles) de `niveles` niveles; val(nivel, i) da el texto de cada nodo. */
export function arbolCompleto(niveles, val = (nv, i) => `${nv}.${i}`, pref = 'm') {
  const nodos = [], aristas = [];
  for (let i = 0; i < 2 ** niveles - 1; i++) {
    const nv = Math.floor(Math.log2(i + 1));
    nodos.push({ id: pref + i, val: val(nv, i - (2 ** nv - 1)) });
    if (i) aristas.push({ a: pref + ((i - 1) >> 1), b: pref + i, lado: i % 2 ? 'i' : 'd' });
  }
  return { nodos, aristas, raiz: pref + '0' };
}

/** Montículo binario en vista de árbol: nodo i = arr[i] (id pref+i), hijos 2i+1 (izq.) y 2i+2 (der.). */
export function arbolDeArray(arr, pref = 'h') {
  const nodos = arr.map((v, i) => ({ id: pref + i, val: v })), aristas = [];
  for (let i = 1; i < arr.length; i++) aristas.push({ a: pref + ((i - 1) >> 1), b: pref + i, lado: i % 2 ? 'i' : 'd' });
  return { nodos, aristas, raiz: arr.length ? pref + '0' : null };
}

/** Ids en el orden de recorrido: 'pre' | 'in' | 'post' | 'niveles' (anchura). Para grafos (modo libre) usa 'niveles' (BFS dirigido). */
export function recorrido(T, tipo = 'in') {
  const { hijos, raices } = estructura(T.nodos, T.aristas, raizDe(T)), out = [], hs = id => hijos.get(id).map(h => h.id);
  // in-orden: un hijo único va a la izquierda salvo que su lado sea 'd'; con varios, el primero a la izquierda y el resto a la derecha
  const lados = id => { const h = hijos.get(id); return h.length === 1 ? (h[0].lado === 'd' ? [[], [h[0].id]] : [[h[0].id], []]) : [hs(id).slice(0, 1), hs(id).slice(1)]; };
  const dfs = id => { const [i, d] = lados(id); if (tipo === 'pre') out.push(id); i.forEach(dfs); if (tipo === 'in') out.push(id); d.forEach(dfs); if (tipo === 'post') out.push(id); };
  if (tipo === 'niveles') for (const cola = [...raices]; cola.length;) { const id = cola.shift(); out.push(id); cola.push(...hs(id)); }
  else raices.forEach(dfs);
  return out;
}
/** Recorrido de un grafo (modo libre) desde `desde`: 'niveles' (anchura) | 'pre' (profundidad). Con dir:true solo en su sentido. */
export function recorridoGrafo(T, desde = T.nodos[0]?.id, tipo = 'niveles') {
  const vecinos = id => T.aristas.flatMap(e => (e.a === id ? [e.b] : e.b === id && !e.dir ? [e.a] : [])), visto = new Set(), out = [];
  if (desde == null) return out;
  const cola = [desde]; visto.add(desde);
  while (cola.length) {
    const id = tipo === 'niveles' ? cola.shift() : cola.pop();
    out.push(id);
    for (const v of tipo === 'niveles' ? vecinos(id) : vecinos(id).reverse()) if (!visto.has(v)) { visto.add(v); cola.push(v); }
  }
  return out;
}
/** Altura = aristas del camino más largo (nodo suelto 0, árbol vacío -1). */
export function altura(T) { const { hijos, raices } = estructura(T.nodos, T.aristas, raizDe(T)), h = id => 1 + Math.max(-1, ...hijos.get(id).map(c => h(c.id))); return raices.length ? Math.max(...raices.map(h)) : -1; }
/** Ids desde la raíz hasta `id` (vacío si no existe). */
export function camino(T, id) { const { padre } = estructura(T.nodos, T.aristas, raizDe(T)), r = []; for (let c = id; c != null && !r.includes(c); c = padre.get(c)) r.unshift(c); return nodoDe(T, id) ? r : []; }

// ── Para los bloques `jugar` ───────────────────────────────────────────────────────────────────────────────────────
export const vista = s => ({ est: { ...s.est }, val: { ...s.val }, etiquetas: { ...s.etiquetas }, aristaEst: { ...s.aristaEst } });
export const conVista = (s, v) => ({ ...s, est: v.est, val: v.val, etiquetas: v.etiquetas, aristaEst: v.aristaEst });
export const ctx = s => {
  const T = { nodos: s.nodos, aristas: s.aristas, raiz: s.def.raiz }, { hijos, padre } = estructura(T.nodos, T.aristas, T.raiz);
  return {
    arbol: T, altura: () => altura(T), camino: id => camino(T, id), recorrido: t => (s.def.modo === 'libre' ? recorridoGrafo(T, s.def.raiz, t) : recorrido(T, t)), nivel: id => camino(T, id).length - 1,
    hijos: id => (hijos.get(id) || []).map(h => h.id), padre: id => padre.get(id) ?? null, hojas: () => T.nodos.filter(n => !hijos.get(n.id).length).map(n => n.id),
    valor: id => nodoDe(T, id)?.val ?? s.val[id],
  };
};

// ── Tooltip (lógica pura) ─────────────────────────────────────────────────────────────────────────────────────────────
export const NOMBRE_EST = {
  activo: { es: 'activo', en: 'active' }, visitado: { es: 'visitado', en: 'visited' }, camino: { es: 'en el camino', en: 'on the path' },
  ok: { es: 'correcto', en: 'done' }, mal: { es: 'error', en: 'error' },
};
/** Datos del nodo `id` para el tooltip: {id, val, etiqueta, est, nivel, padre, hijos, vecinos}; null si no existe. PURA. */
export function describirNodo(S, id, modo = 'arbol', hl = {}) {
  if (!S.nodos.some(m => m.id === id)) return null;
  const val = x => txt(S.val[x] ?? S.nodos.find(m => m.id === x)?.val ?? x), peso = e => (e.peso != null ? txt(e.peso) : null);
  const est = (hl[id] && { a: 'activo', b: 'ok', c: 'mal' }[hl[id]]) || S.est[id] || null;
  const r = { id, val: val(id), etiqueta: txt(S.etiquetas[id] ?? ''), est, nivel: null, padre: null, hijos: [], vecinos: [] };
  if (modo === 'libre') {
    for (const e of S.aristas) {
      if (e.a === id) r.vecinos.push({ id: e.b, val: val(e.b), peso: peso(e), dir: e.dir ? 'sale' : null });
      else if (e.b === id) r.vecinos.push({ id: e.a, val: val(e.a), peso: peso(e), dir: e.dir ? 'llega' : null });
    }
  } else {
    const padreDe = new Map(S.aristas.map(e => [e.b, e.a])), p = padreDe.get(id);
    if (p != null) r.padre = { id: p, val: val(p) };
    r.hijos = S.aristas.filter(e => e.a === id).map(e => ({ id: e.b, val: val(e.b), lado: e.lado || null }));
    let nv = 0;
    for (let c = id; padreDe.has(c) && nv <= S.nodos.length; c = padreDe.get(c)) nv++;
    r.nivel = nv;
  }
  return r;
}

// ── CSS (se inyecta una vez, al crear la primera escena) ────────────────────────────────────────────────────────────
const CSS = `
.ar-svg { position: absolute; left: 0; top: 0; overflow: visible; }
.ar-svg.arrastra { touch-action: none; }
.ar-nota { transition: opacity .3s; }
.ar-nota line { stroke: var(--line2); stroke-width: 1; stroke-dasharray: 2 5; }
.ar-nota text { font: 12px var(--ui); fill: var(--muted); }
.ar-a .ar-l { fill: none; stroke: var(--line2); stroke-width: 2; stroke-linecap: round; transition: stroke .3s, stroke-width .3s; }
.ar-a .ar-h { fill: var(--line2); transition: fill .3s; }
.ar-a .ar-p { font: 600 11px var(--ui); fill: var(--text); text-anchor: middle; paint-order: stroke; stroke: var(--island); stroke-width: 4px; stroke-linejoin: round; }
.ar-a.e-camino .ar-l { stroke: var(--g-camino); stroke-width: 3.6; } .ar-a.e-camino .ar-h { fill: var(--g-camino); }
.ar-a.e-activa .ar-l { stroke: var(--g-activo); stroke-width: 3; stroke-dasharray: 7 4; } .ar-a.e-activa .ar-h { fill: var(--g-activo); }
.ar-n .ar-c { fill: var(--cell); stroke: var(--line2); stroke-width: 1.5; transition: fill .3s, stroke .3s, stroke-width .3s; }
.ar-n .ar-v { font-family: var(--ui); font-weight: 600; fill: var(--text); text-anchor: middle; pointer-events: none; }
.ar-n .ar-e { font: 600 11px var(--ui); fill: var(--g-aux); text-anchor: middle; paint-order: stroke; stroke: var(--island); stroke-width: 3.5px; stroke-linejoin: round; pointer-events: none; }
.ar-n .ar-aro { fill: none; stroke: var(--g-activo); stroke-width: 2; opacity: 0; transition: opacity .3s; pointer-events: none; transform-box: fill-box; transform-origin: center; }
@media (hover: hover) { .ar-n:hover .ar-aro { opacity: .3; } }
.ar-n.vec .ar-c { stroke: var(--g-aux); stroke-width: 2.5; }
.ar-a.hov .ar-l { stroke: var(--g-aux); stroke-width: 3; } .ar-a.hov .ar-h { fill: var(--g-aux); }
.ar-n:focus, .ar-n:focus-visible { outline: none; }
.ar-n:focus-visible .ar-c { stroke: var(--g-activo); stroke-width: 3.5; } .ar-n:focus-visible .ar-aro { opacity: .75; }
.ar-fo { overflow: visible; pointer-events: none; }
.ar-fo > div { width: 100%; height: 100%; white-space: pre; font-family: var(--ui); }
.ar-fo.v > div { text-align: center; font-weight: 600; color: var(--text); }
.ar-fo.v.e-visitado > div { color: var(--muted); }
.ar-fo.e > div { text-align: center; font-weight: 600; font-size: 11px; color: var(--g-aux); text-shadow: 0 0 3px var(--island), 0 0 3px var(--island), 0 0 3px var(--island); }
.ar-fo.n > div { font-size: 12px; color: var(--muted); }
.ar-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.ar-n .ar-ins { opacity: 0; transition: opacity .3s; pointer-events: none; }
.ar-n .ar-ins circle { fill: var(--g-hecho); } .ar-n .ar-ins path { fill: none; stroke: var(--island); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.ar-n .ar-xx { display: none; }
.ar-n.e-activo .ar-c { stroke: var(--g-activo); stroke-width: 3; fill: var(--g-activo-bg); } .ar-n.e-activo .ar-aro { opacity: .45; }
.ar-n.e-visitado .ar-c { fill: rgba(134, 138, 145, .22); stroke: var(--muted); } .ar-n.e-visitado .ar-v { fill: var(--muted); }
.ar-n.e-camino .ar-c { stroke: var(--g-camino); stroke-width: 3.6; fill: var(--g-camino-bg); }
.ar-n.e-camino .ar-aro { stroke: var(--g-camino); } .ar-n.e-ok .ar-aro { stroke: var(--g-hecho); } .ar-n.e-mal .ar-aro { stroke: var(--g-mal); }
.ar-n.e-ok .ar-c { stroke: var(--g-hecho); stroke-width: 3; fill: var(--g-hecho-bg); } .ar-n.e-ok .ar-ins { opacity: 1; }
.ar-n.e-mal .ar-c { stroke: var(--g-mal); stroke-width: 3; fill: var(--g-mal-bg); stroke-dasharray: 4 3; } .ar-n.e-mal .ar-ins { opacity: 1; }
.ar-n.e-mal .ar-ins circle { fill: var(--g-mal); } .ar-n.e-mal .ar-ck { display: none; } .ar-n.e-mal .ar-xx { display: inline; }
.ar-n.arrastrable { cursor: grab; touch-action: none; } .ar-n.arrastrable .ar-c { stroke-dasharray: none; }
.ar-n.arrastrable:not([class*=" e-"]) .ar-c { stroke: var(--g-activo); }
.ar-n.arrastrable:hover .ar-c { fill: var(--g-activo-bg); }
.ar-n.agarrado { cursor: grabbing; } .ar-n.agarrado .ar-aro { opacity: .7; }
`;
function inyectarCss() {
  if (typeof document === 'undefined' || document.getElementById('css-arbol')) return;
  const s = document.createElement('style'); s.id = 'css-arbol'; s.textContent = CSS; document.head.append(s);
}

// ── Tamaño lógico de la escena abierta (solo depende de `def`) ─────────────────────────────────────────────────────
const radioDe = def => def.radio ?? clamp(Math.round(3.9 * Math.max(2, def.cabida?.texto ?? 0, ...(def.nodos || []).map(n => txt(n.val).replace(/[$\\{}]/g, '').length))), 16, 32);
function medidaDef(def, R) {
  const g = geo(R), c = def.cabida, NG = c?.notas ? (c.notas > 1 ? c.notas : 250) : def.notas?.length ? 250 : 0;
  let Wt, H;
  if (def.modo === 'libre') { Wt = def.lienzo?.W ?? 640; H = def.lienzo?.H ?? 400; }
  else {
    const m = c ? { niveles: c.niveles, ancho: c.ancho ?? Math.max((c.hojas ?? 2 ** (c.niveles - 1)) - 1, 1) } : trazar(def.nodos || [], def.aristas || [], 'arbol', { r: R, raiz: def.raiz });
    Wt = Math.max(m.ancho, 1) * g.dx + 2 * g.mx; H = g.my + Math.max(m.niveles - 1, 0) * g.dy + g.mb;
  }
  Wt = Math.max(Wt, 240);
  return { Wt, NG, W: Wt + NG, H: Math.max(H, 140) };
}

const TXT = {
  es: { nodo: 'Nodo', clave: 'Clave', etiqueta: 'Etiqueta', nivel: 'Nivel', padre: 'Padre', hijos: 'Hijos', vecinos: 'Vecinos', sale: 'Sale a', llega: 'Llega de', estado: 'Estado', izq: 'izq.', der: 'der.', peso: 'peso', ninguno: 'ninguno', mover: 'nodo: flechas para moverlo, Intro para soltarlo' },
  en: { nodo: 'Node', clave: 'Key', etiqueta: 'Label', nivel: 'Level', padre: 'Parent', hijos: 'Children', vecinos: 'Neighbors', sale: 'Goes to', llega: 'Comes from', estado: 'State', izq: 'left', der: 'right', peso: 'weight', ninguno: 'none', mover: 'node: arrow keys to move it, Enter to drop it' },
};
/** Texto SVG que admite `$…$`: sin fórmula es el <text> de siempre; con ella, un <foreignObject> hermano (se crea al primer uso con `mk`). */
function ponerSvg(t, s, mk) {
  const mate = s.includes('$');
  if (mate) {
    if (!t._fo) { t._fo = mk(); t.after(t._fo); }
    if (t._s !== s || t._m !== true) { etiqueta(t._fo.firstChild, s); t.textContent = ''; }
    t._fo.style.display = '';
  } else {
    if (t._fo && t._m) t._fo.style.display = 'none';
    if (t._s !== s || t._m) t.textContent = s;
  }
  t._s = s; t._m = mate;
}
/** <foreignObject> centrado en (x, y) con `w`×`h` px lógicos para una etiqueta con fórmula. */
function creaFo(clase, x, y, w, h) {
  const fo = svg('foreignObject', 'ar-fo ' + clase);
  fo.setAttribute('x', x); fo.setAttribute('y', y); fo.setAttribute('width', w); fo.setAttribute('height', h);
  const d = document.createElement('div'); d.style.lineHeight = h + 'px'; fo.append(d); return fo;
}

export const crear = stage => new EscenaArbol(stage);
const svg = (tag, cls) => { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); return e; };

export class EscenaArbol {
  constructor(stage) {
    inyectarCss();
    this.stage = stage; this.def = null; this.W = this.H = this.Wt = 0; this.R = R0; this.modo = 'arbol';
    this.svg = svg('svg', 'ar-svg'); stage.append(this.svg);
    this.raf = 0; this.T = null; this.drag = null; this.vivo = null; this.cbSoltar = null;
    this.nd = new Map(); this.ed = new Map(); this.nt = new Map(); this.manual = new Map(); this.firma = '';
    this.asent = null; this.ult = null; this.hov = null; this.hlUlt = {};
    this.sr = Object.assign(document.createElement('div'), { className: 'ar-sr' }); this.sr.setAttribute('role', 'status'); this.sr.setAttribute('aria-live', 'polite'); stage.append(this.sr);
    this.tip = crearTip(stage, { objetivo: n => this.tipClave(n), datos: id => this.tipDatos(id), sobre: id => { this.hov = id; this.aplicarHover(); } });
    this.svg.addEventListener('pointerdown', e => this.arrancar(e));
    this.svg.addEventListener('pointermove', e => this.mover(e));
    this.svg.addEventListener('pointerup', e => this.soltar(e));
    this.svg.addEventListener('pointercancel', e => this.soltar(e, true));
    this.svg.addEventListener('keydown', e => this.tecla(e));
  }

  // ── Tooltip: clave = id del nodo; se ancla en su posición lógica actual (sin medir el DOM) ──
  tipClave(n) {
    const g = n.closest?.('.ar-n');
    return g && this.svg.contains(g) ? g.dataset.id : null;
  }

  tipDatos(id) {
    const S = this.ult, r = this.nd.get(id);
    if (!S || !r || !r.vivo) return null;
    const d = describirNodo(S, id, this.modo, this.hlUlt), u = TXT[idioma()], filas = [];
    if (!d) return null;
    filas.push([u.clave, d.val]);
    if (d.etiqueta) filas.push([u.etiqueta, d.etiqueta]);
    if (d.nivel != null) filas.push([u.nivel, String(d.nivel)]);
    if (d.padre) filas.push([u.padre, d.padre.val]);
    if (this.modo === 'arbol') filas.push([u.hijos, d.hijos.length ? d.hijos.map(h => h.val + (h.lado ? ` (${h.lado === 'i' ? u.izq : u.der})` : '')).join(', ') : u.ninguno]);
    else if (d.vecinos.length) {
      const dirs = d.vecinos.some(v => v.dir);
      const f = v => `${v.val}${v.peso != null ? ` (${u.peso} ${v.peso})` : ''}`;
      if (dirs) {
        const s = d.vecinos.filter(v => v.dir === 'sale').map(f), l = d.vecinos.filter(v => v.dir === 'llega').map(f), n = d.vecinos.filter(v => !v.dir).map(f);
        if (s.length) filas.push([u.sale, s.join(', ')]); if (l.length) filas.push([u.llega, l.join(', ')]); if (n.length) filas.push([u.vecinos, n.join(', ')]);
      } else filas.push([u.vecinos, d.vecinos.map(f).join(', ')]);
    } else filas.push([u.vecinos, u.ninguno]);
    if (d.est) filas.push([u.estado, L(NOMBRE_EST[d.est]) || d.est]);
    return { titulo: `${u.nodo} ${id}`, filas, x: r.x, y: r.y - this.R * r.sc - 6, y2: r.y + this.R * r.sc + (d.etiqueta ? 22 : 8) };
  }

  /** Resalta las aristas del nodo con el puntero encima y a sus vecinos. */
  aplicarHover() {
    const S = this.ult, h = this.hov, vec = new Set(), ar = new Set();
    if (S && h != null) for (const e of S.aristas) { if (e.a === h) { vec.add(e.b); ar.add(claveArista(e.a, e.b)); } else if (e.b === h) { vec.add(e.a); ar.add(claveArista(e.a, e.b)); } }
    for (const [id, r] of this.nd) r.g.classList.toggle('vec', vec.has(id));
    for (const [k, r] of this.ed) r.g.classList.toggle('hov', ar.has(k));
  }

  get tam() { return { W: this.W, H: this.H }; }

  fijar(def) {
    if (def === this.def) return;
    cancelAnimationFrame(this.raf); this.T = null; this.finVivo(); this.tip.ocultar(); this.ult = null; this.hov = null;
    this.svg.replaceChildren(this.gQ = svg('g'), this.gE = svg('g'), this.gN = svg('g'));
    this.def = def; this.modo = def.modo === 'libre' ? 'libre' : 'arbol'; this.R = radioDe(def);
    const m = medidaDef(def, this.R);
    this.W = m.W; this.H = m.H; this.Wt = m.Wt;
    this.svg.setAttribute('width', this.W); this.svg.setAttribute('height', this.H);
    this.nd = new Map(); this.ed = new Map(); this.nt = new Map(); this.manual = new Map(); this.firma = '';
  }

  nuevoNodo(id) {
    const R = this.R, g = svg('g', 'ar-n'), aro = svg('circle', 'ar-aro'), c = svg('circle', 'ar-c'), t = svg('text', 'ar-v'), lb = svg('text', 'ar-e'), ins = svg('g', 'ar-ins');
    g.dataset.id = id; aro.setAttribute('r', R + 5); c.setAttribute('r', R); t.setAttribute('dy', '.35em'); lb.setAttribute('y', R + 12);
    ins.setAttribute('transform', `translate(${(R * .74).toFixed(1)} ${(-R * .74).toFixed(1)})`);
    const marca = (cls, d) => { const p = svg('path', cls); p.setAttribute('d', d); return p; };
    const disco = svg('circle'); disco.setAttribute('r', 7);
    ins.append(disco, marca('ar-ck', 'M-3 .2L-.8 2.6L3.2-2.4'), marca('ar-xx', 'M-2.6-2.6L2.6 2.6M2.6-2.6L-2.6 2.6'));
    g.append(aro, c, t, lb, ins); this.gN.append(g);
    const r = { g, t, lb, aro, x: 0, y: 0, op: 0, sc: .35, vivo: true, txt: undefined, est: undefined, tab: false };
    this.nd.set(id, r); return r;
  }

  nuevaArista(k) {
    const g = svg('g', 'ar-a'), r = { g, l: svg('path', 'ar-l'), h: svg('path', 'ar-h'), p: svg('text', 'ar-p'), op: 0, vivo: true };
    r.p.setAttribute('dy', '.35em'); g.append(r.l, r.h, r.p); this.gE.append(g);
    this.ed.set(k, r); return r;
  }

  /** S = {nodos, aristas, val, etiquetas, est, aristaEst, notas} (+ hl); animar: false | true | milisegundos */
  pintar(S, animar = true) {
    const dur = animar === true ? 520 : +animar || 0, anim = dur > 0 && !reducido(), hl = S.hl || {}, R = this.R;
    const firma = S.nodos.map(n => n.id).join() + '|' + S.aristas.map(e => e.a + '-' + e.b + (e.lado || '')).join();
    if (firma !== this.firma) { this.manual.clear(); this.firma = firma; } // el arrastre solo dura hasta el próximo cambio de estructura
    const tr = trazar(S.nodos, S.aristas, this.modo, { r: R, W: this.Wt, H: this.H, raiz: this.def.raiz }), pos = tr.pos;
    for (const [id, p] of this.manual) if (pos[id]) pos[id] = p;

    // Nodos
    const vivos = new Set(S.nodos.map(n => n.id)), padreDe = new Map(S.aristas.map(e => [e.b, e.a])), estDe = { a: 'activo', b: 'ok', c: 'mal' };
    for (const n of S.nodos) {
      let r = this.nd.get(n.id);
      if (!r) {
        r = this.nuevoNodo(n.id);
        const p = this.nd.get(padreDe.get(n.id)), o = p?.vivo ? p : pos[n.id]; // nacen en su padre
        r.x = o.x; r.y = o.y; this.ponerNodo(r);
      }
      r.vivo = true; r.a = { x: pos[n.id].x, y: pos[n.id].y, op: 1, sc: 1 };
      const v = txt(S.val[n.id] ?? n.val), est = (hl[n.id] && estDe[hl[n.id]]) || S.est[n.id];
      if (v !== r.txt) {
        const fs = clamp(2.93 * R / Math.max(v.replace(/[$\\{}^_]/g, '').length, 1), 9, 14).toFixed(1);
        r.t.setAttribute('font-size', fs);
        ponerSvg(r.t, v, () => creaFo('v', -R, -R, 2 * R, 2 * R));
        if (r.t._fo) r.t._fo.firstChild.style.fontSize = fs + 'px';
        const vis = r.t._m ? r.t._fo : r.t;
        if (anim && r.txt !== undefined) vis.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(320, dur), easing: 'ease-out' });
        r.txt = v;
      }
      ponerSvg(r.lb, txt(S.etiquetas[n.id] ?? ''), () => creaFo('e', -80, R + 3, 160, 18));
      if (r.t._fo) r.t._fo.classList.toggle('e-visitado', est === 'visitado');
      r.g.setAttribute('class', 'ar-n' + (est ? ' e-' + est : '') + (this.puede(n.id) ? ' arrastrable' : ''));
      // pulso del aro al entrar en un estado (solo transform/opacity; el primer pintado no pulsa)
      const e = est ?? null;
      if (e !== r.est) { if (e && e !== 'visitado' && anim && r.est !== undefined) r.aro.animate([{ transform: 'scale(.9)', opacity: .9 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: Math.min(560, dur * 1.1), easing: 'ease-out' }); r.est = e; }
      this.tabNodo(n.id, r);
    }
    for (const [id, r] of this.nd) if (!vivos.has(id)) { r.vivo = false; r.a = { x: r.x, y: r.y, op: 0, sc: .6 }; r.g.classList.remove('arrastrable'); }

    // Aristas
    const claves = new Set();
    for (const e of S.aristas) {
      const k = claveArista(e.a, e.b); claves.add(k);
      const r = this.ed.get(k) ?? this.nuevaArista(k), est = hl[k] ? 'activa' : S.aristaEst[k];
      r.e = e; r.vivo = true; r.a = 1; r.curva = e.curva ?? (S.aristas.some(f => f.a === e.b && f.b === e.a) ? 20 : 0);
      r.g.setAttribute('class', 'ar-a' + (est ? ' e-' + est : '') + (e.dir ? ' dir' : ''));
      r.p.textContent = e.peso != null ? txt(e.peso) : '';
    }
    for (const [k, r] of this.ed) if (!claves.has(k)) { r.vivo = false; r.a = 0; }

    this.notas(S.notas || [], tr);
    cancelAnimationFrame(this.raf);
    for (const r of this.nd.values()) r.de = { x: r.x, y: r.y, op: r.op, sc: r.sc };
    for (const r of this.ed.values()) r.de = r.op;
    // un nodo que aún se asienta (o se sostiene) sigue con sus muelles, ahora hacia su posición actual del diseño; la transición no lo toca (r.libre)
    const A = this.asent;
    if (A) {
      const p = pos[A.id];
      if (!p || this.nd.get(A.id) !== A.r || !A.r.vivo) this.finAsiento();
      else if (this.vivo !== A) { A.tx = p.x; A.ty = p.y; A.mx.ir(p.x); A.my.ir(p.y); A.ms.ir(1); this.tareaNodo(A); }
    }
    this.T = { t0: performance.now(), dur: anim ? dur : 0 };
    this.frame(this.T.t0);
    this.ult = S; this.hlUlt = hl; this.aplicarHover(); this.tip.refrescar();
  }

  /** Etiquetas laterales por nivel (en el margen derecho reservado): se desvanecen al entrar y salir. */
  notas(lista, tr) {
    const por = new Map(lista.map(n => [n.nivel, n]));
    for (const [nv, n] of por) {
      let q = this.nt.get(nv);
      if (!q) {
        q = { g: svg('g', 'ar-nota'), ln: svg('line'), t: svg('text') };
        q.t.setAttribute('dy', '.35em'); q.g.append(q.ln, q.t); this.gQ.append(q.g); this.nt.set(nv, q);
        if (!reducido()) q.g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      }
      const y = tr.y(nv);
      q.vivo = true;
      ponerSvg(q.t, txt(n.texto), () => creaFo('n', 0, 0, Math.max(60, this.W - this.Wt - 18), 20));
      if (q.t._fo) { q.t._fo.setAttribute('x', this.Wt + 14); q.t._fo.setAttribute('y', y - 10); }
      q.ln.setAttribute('x1', 6); q.ln.setAttribute('x2', this.Wt + 4); q.ln.setAttribute('y1', y); q.ln.setAttribute('y2', y);
      q.t.setAttribute('x', this.Wt + 14); q.t.setAttribute('y', y);
    }
    for (const [nv, q] of this.nt) if (!por.has(nv)) {
      this.nt.delete(nv);
      if (reducido()) q.g.remove(); else q.g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250 }).onfinish = () => q.g.remove();
    }
  }

  ponerNodo(r) {
    r.g.setAttribute('transform', `translate(${r.x.toFixed(1)} ${r.y.toFixed(1)}) scale(${r.sc.toFixed(3)})`);
    r.g.style.opacity = r.op.toFixed(3);
  }

  // Un único requestAnimationFrame mueve nodos, opacidades y aristas
  frame = now => {
    const T = this.T, k = T.dur ? Math.min(1, (now - T.t0) / T.dur) : 1, e = ease(k);
    for (const r of this.nd.values()) {
      for (const c of ['x', 'y', 'op', 'sc']) if (!r.libre || c === 'op') r[c] = r.de[c] + (r.a[c] - r.de[c]) * e;
      this.ponerNodo(r);
    }
    for (const r of this.ed.values()) r.op = r.de + (r.a - r.de) * e;
    this.dibujarAristas();
    if (k < 1) this.raf = requestAnimationFrame(this.frame);
    else this.limpiar();
  };

  /** Al terminar la transición se retiran del DOM los nodos y aristas que ya salieron. */
  limpiar() {
    for (const [id, r] of this.nd) if (!r.vivo) { r.g.remove(); this.nd.delete(id); this.manual.delete(id); }
    for (const [k, r] of this.ed) if (!r.vivo) { r.g.remove(); this.ed.delete(k); }
  }

  dibujarAristas() {
    const R = this.R;
    for (const r of this.ed.values()) {
      const A = this.nd.get(r.e.a), B = this.nd.get(r.e.b);
      if (!A || !B) { r.g.style.opacity = 0; continue; }
      const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1, c = r.curva || 0;
      const cx = (A.x + B.x) / 2 - (dy / len) * 2 * c, cy = (A.y + B.y) / 2 + (dx / len) * 2 * c; // punto de control (c = desvío máximo)
      const hacia = (P, Q, d) => { const vx = Q.x - P.x, vy = Q.y - P.y, l = Math.hypot(vx, vy) || 1; return [P.x + vx / l * d, P.y + vy / l * d]; };
      const [sx, sy] = hacia(A, { x: cx, y: cy }, R * A.sc), [ex, ey] = hacia(B, { x: cx, y: cy }, R * B.sc + 1.5);
      r.l.setAttribute('d', `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
      if (r.e.dir) {
        const ux = ex - cx, uy = ey - cy, l = Math.hypot(ux, uy) || 1, bx = ex - ux / l * 10, by = ey - uy / l * 10, nx = -uy / l * 5, ny = ux / l * 5;
        r.h.setAttribute('d', `M${ex.toFixed(1)} ${ey.toFixed(1)}L${(bx + nx).toFixed(1)} ${(by + ny).toFixed(1)}L${(bx - nx).toFixed(1)} ${(by - ny).toFixed(1)}Z`);
      } else r.h.removeAttribute('d');
      if (r.p.textContent) { r.p.setAttribute('x', ((sx + 2 * cx + ex) / 4).toFixed(1)); r.p.setAttribute('y', ((sy + 2 * cy + ey) / 4).toFixed(1)); }
      r.g.style.opacity = (r.op * Math.min(A.op, B.op)).toFixed(3);
    }
  }

  // ── Arrastre de nodos (Pointer Events con captura) ──
  // El nodo agarrado sigue al puntero a través de Muelle (x, y) y de escala (se «levanta» un 12 %); al soltar los muelles
  // siguen hasta el reposo conservando la velocidad (asentamiento). Un único trabajo por fotograma (tarea compartida) mueve
  // el nodo y recalcula sus aristas; mientras dura, la transición de pintar() no toca ese nodo (r.libre). El rectángulo del
  // stage se mide UNA vez al agarrar.
  puede(id) { return !!(this.drag && (this.drag === true || this.drag.has(id))); }

  /** Foco por teclado y etiqueta accesible solo en los nodos que se pueden mover. */
  tabNodo(id, r) {
    const pd = !!(r.vivo && this.puede(id));
    if (pd !== r.tab) {
      r.tab = pd;
      if (pd) { r.g.setAttribute('tabindex', '0'); r.g.setAttribute('role', 'button'); } else { r.g.removeAttribute('tabindex'); r.g.removeAttribute('role'); r.g.removeAttribute('aria-label'); }
    }
    if (pd) r.g.setAttribute('aria-label', `${r.txt ?? id}, ${TXT[idioma()].mover}`);
  }

  /** Activa (true | [ids]) o desactiva (null) el arrastre; cb(id, x, y) al soltar (px lógicos). Desactivar devuelve los nodos a su sitio. */
  arrastre(ids, cb) {
    this.drag = ids === true ? true : ids && ids.length ? new Set(ids) : null; this.cbSoltar = cb;
    if (!this.drag) { this.manual.clear(); this.finVivo(); }
    this.svg.classList.toggle('arrastra', !!this.drag);
    for (const [id, r] of this.nd) { r.g.classList.toggle('arrastrable', r.vivo && this.puede(id)); this.tabNodo(id, r); }
  }

  /** Muelles de un nodo (posición y escala) a partir de donde esté ahora. */
  asiento(id, r) {
    const v = { id, r, mx: new Muelle(r.x, 30), my: new Muelle(r.y, 30), ms: new Muelle(r.sc, 22), cancela: null, tx: r.x, ty: r.y };
    r.libre = true; this.asent = v; return v;
  }

  /** Un único trabajo por fotograma mientras los muelles se mueven; al reposar (y sin puntero encima) termina el asentamiento. */
  tareaNodo(v) {
    const r = v.r, poner = () => { r.x = r.a.x = v.mx.x; r.y = r.a.y = v.my.x; r.sc = r.a.sc = v.ms.x; this.ponerNodo(r); this.dibujarAristas(); };
    if (reducido()) { v.mx.salto(v.mx.a); v.my.salto(v.my.a); v.ms.salto(v.ms.a); poner(); if (this.vivo !== v) this.finAsiento(); return; }
    if (v.cancela) return;
    v.cancela = tarea((_, dt) => {
      v.mx.paso(dt); v.my.paso(dt); v.ms.paso(dt); poner();
      if (!(v.mx.quieto && v.my.quieto && v.ms.quieto)) return true;
      v.cancela = null; if (this.vivo !== v) this.finAsiento();
      return false;
    });
  }

  /** Termina el asentamiento: el nodo vuelve a ser cosa de la transición de pintar(). */
  finAsiento() {
    const v = this.asent;
    if (!v) return;
    this.asent = null; v.cancela?.(); v.cancela = null; v.r.libre = false;
  }

  /** Suelta cualquier arrastre en curso (cambio de escena o arrastre desactivado). */
  finVivo() {
    const v = this.vivo;
    if (v) { this.vivo = null; v.r.g.classList.remove('agarrado'); this.tip.pausa(false); }
    this.finAsiento();
  }

  arrancar(e) {
    const g = e.target.closest?.('.ar-n.arrastrable'), r = g && this.nd.get(g.dataset.id);
    if (!r || this.vivo) return;
    e.preventDefault(); this.svg.setPointerCapture(e.pointerId);
    cancelAnimationFrame(this.raf); if (this.T) this.frame(Infinity); // termina la transición en curso para arrastrar sobre posiciones finales
    this.finAsiento();
    const b = this.stage.getBoundingClientRect(), k = b.width / this.W || 1, px = (e.clientX - b.left) / k, py = (e.clientY - b.top) / k;
    const v = this.asiento(g.dataset.id, r);
    Object.assign(v, { b, k, ox: r.x - px, oy: r.y - py, pid: e.pointerId });
    v.ms.ir(1.12); this.vivo = v; this.tip.pausa(true);
    g.classList.add('agarrado'); this.gN.append(g); g.focus({ preventScroll: true }); // appendChild lo trae al frente (y le quita el foco: se devuelve)
    this.tareaNodo(v);
  }

  mover(e) {
    const v = this.vivo;
    if (!v || e.pointerId !== v.pid) return;
    const R = this.R;
    v.tx = clamp((e.clientX - v.b.left) / v.k + v.ox, R, this.W - R); v.ty = clamp((e.clientY - v.b.top) / v.k + v.oy, R, this.H - R);
    v.mx.ir(v.tx); v.my.ir(v.ty); this.tareaNodo(v);
  }

  soltar(e, cancelado = false) {
    const v = this.vivo;
    if (!v) return;
    this.vivo = null; v.r.g.classList.remove('agarrado'); this.tip.pausa(false);
    if (this.svg.hasPointerCapture(e.pointerId)) this.svg.releasePointerCapture(e.pointerId);
    this.manual.set(v.id, { x: v.tx, y: v.ty });
    v.ms.ir(1); this.tareaNodo(v);
    if (!cancelado && this.cbSoltar) this.cbSoltar(v.id, Math.round(v.tx), Math.round(v.ty));
  }

  // ── Teclado: flechas desplazan el nodo enfocado (Mayús = paso grande); Intro/Espacio lo «suelta» (llama a cb) ──
  tecla(e) {
    const g = e.target.closest?.('.ar-n.arrastrable'), r = g && this.nd.get(g.dataset.id);
    if (!r || this.vivo) return;
    const id = g.dataset.id, k = e.key, R = this.R;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
    if (!d && k !== 'Enter' && k !== ' ') return;
    e.preventDefault(); e.stopPropagation();
    if (d) {
      let v = this.asent?.id === id ? this.asent : null;
      if (!v) { this.finAsiento(); v = this.asiento(id, r); }
      const paso = e.shiftKey ? 40 : 10;
      v.tx = clamp(v.tx + d[0] * paso, R, this.W - R); v.ty = clamp(v.ty + d[1] * paso, R, this.H - R);
      v.mx.ir(v.tx); v.my.ir(v.ty); this.manual.set(id, { x: v.tx, y: v.ty }); this.tareaNodo(v);
      this.sr.textContent = `${Math.round(v.tx)}, ${Math.round(v.ty)}`;
    } else if (this.cbSoltar) {
      const v = this.asent?.id === id ? this.asent : null;
      this.manual.set(id, { x: v?.tx ?? r.x, y: v?.ty ?? r.y });
      this.cbSoltar(id, Math.round(v?.tx ?? r.x), Math.round(v?.ty ?? r.y));
    }
  }
}
