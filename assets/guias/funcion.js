// Escena «funcion»: plano cartesiano 2D para Cálculo I/II. Curvas y = f(x), paramétricas y polares, y capas
// matemáticas (tangente, secante, sumas de Riemann, área entre curvas, Taylor, banda ε-δ, Newton…) que leen
// PARÁMETROS (x0, h, n, a, b, grado, eps…) que el usuario mueve arrastrando el punto o con deslizadores nativos.
// Contrato de escena de guia.js: clave, plegar (pura), crear (+ vista/conVista/ctx para `jugar`).
//
// FORMATO. Un paso ABRE la escena con (las `f` son funciones JS puras, así que los datos son JS, no JSON):
//   funcion: {
//     x: [a,b], y: [c,d]       ventana inicial          igual?: bool   misma escala en x e y (ancho se ajusta al alto)
//     curvas: [{ id, nombre: 'f(x)' | {es,en}, f?: x => y,                        explícita
//                param?: { x: t=>, y: t=>, t: [t0,t1] },                          paramétrica
//                polar?: { r: t=>, t: [t0,t1] },                                  polar
//                hasta?: 'nombre'|número   dibuja la curva solo hasta ese valor del parámetro (param/polar)
//                color? }]                color por defecto = PALETA[posición]
//     par?: { x0: 1, h: .5, … }  parámetros iniciales (números)
//     arrastrar?: 'x0'           parámetro que se mueve arrastrando sobre la gráfica (coordenada x del puntero)
//     deslizadores?: [{ par, min, max, paso?, es, en, dec? }]   <input type=range> nativos bajo la gráfica
//     etiqueta?: {es,en}         texto accesible de la gráfica
//     capas?: [capa…]            capas iniciales
//   }
// PARCHES acumulativos (en pasos y en frames de `traza`):
//   par: {x0: 2}              mezcla parámetros (transición)      capas: [capa…]   REEMPLAZA la lista de capas
//   ver: [ids]                curvas visibles                     resaltar: id | null   (el resto se atenúa)
//   ventana: {x:[a,b], y:[c,d]}   cambia la ventana (animada)
// CAPAS (`tipo`). Los números pueden ser un valor o el NOMBRE de un parámetro ('x0'):
//   tangente {c, x}                   recta tangente a la curva c en x
//   secante {c, x, h}                 recta por (x, f(x)) y (x+h, f(x+h))
//   riemann {c, a, b, n, m?, espejo?} m: 'izq'|'der'|'medio'|'trap'|'exacta'; espejo → sección de un sólido de revolución
//   entre {c, g, a, b}                región entre dos curvas
//   taylor {c, a, grado, coef}        polinomio de Taylor de grado `grado`; coef(k) = f⁽ᵏ⁾(a)/k!
//   epsdelta {x, L, eps, delta}       banda horizontal L±eps y vertical x±delta
//   punto {c?, x, y?, abierto?}       punto sobre la curva c (o en (x,y)); abierto = círculo hueco
//   asintota {x} | {y}                recta discontinua
//   newton {c, x, n}                  n pasos de Newton-Raphson desde x
//   marca {c, u}                      punto de la curva paramétrica/polar c para el parámetro u
//   linea {x1,y1,x2,y2}   texto {x,y,s:{es,en}|string, ancla?}
// `jugar`: vista plana {…par, ver, resaltar}; ctx = {f(id,x), d(id,x), integral(id,a,b), riemann(id,a,b,n,m), fmt, nombre, par}.
// Texto: `nombre` de curva y `s` de la capa `texto` admiten `$…$` (KaTeX vía mates.js: se renderiza una sola vez por cadena
// distinta; con `$` el rótulo es HTML superpuesto y se mueve con transform; sin `$`, texto SVG).
// Interacción: al pasar el puntero, regla vertical + punto + tooltip (x, f(x)) sobre la curva más cercana (snap, un trabajo
// por fotograma). Si hay `arrastrar`, el punto de la capa que usa ese parámetro lleva un asa (role=slider: flechas, Re Pág/Av Pág,
// Inicio/Fin, foco visible) además de poder arrastrar sobre toda la gráfica; la gráfica sigue el valor con un Muelle.
// Una curva que aparece se dibuja de izquierda a derecha (`trazo`). Etiquetas de curva al final de cada una (sin solaparse).
// Animación: UN solo rAF compartido (movimiento.js: tarea/Muelle/trazo); solo atributos de geometría en SVG y transform/opacity
// en HTML; ningún fotograma lee layout. La lógica pura (muestreo, cortes, Riemann, Taylor, Newton, ventana, snap, rejilla menor)
// no toca el DOM al importar: se prueba en Node (tests/guias/test-funcion.js).
import { idioma } from './idioma.js';
import { PALETA, ticks125, formatear, separar, camino } from './grafica.js';
import { etiqueta } from './mates.js';
import { tarea, Muelle, trazo, ease } from './movimiento.js';

export const clave = 'funcion';

// ── Lógica pura ─────────────────────────────────────────────────────────────
const lim = (x, a, b) => Math.min(b, Math.max(a, x));
const GRANDE = 1e5;

/** Valor numérico o nombre de parámetro → número. */
export const num = (v, par) => (typeof v === 'string' ? par[v] : v);

/** f(x) siempre número (NaN si lanza o no devuelve número). */
export function evalF(f, x) {
  try { const y = f(x); return typeof y === 'number' ? y : NaN; } catch { return NaN; }
}

/** Derivada numérica centrada. */
export function deriv(f, x) {
  const h = 1e-5 * Math.max(1, Math.abs(x));
  return (evalF(f, x + h) - evalF(f, x - h)) / (2 * h);
}

/** Integral definida por Simpson (n par). */
export function integral(f, a, b, n = 1000) {
  if (a === b) return 0;
  n += n % 2;
  const h = (b - a) / n; let s = evalF(f, a) + evalF(f, b);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * evalF(f, a + i * h);
  return s * h / 3;
}

/** Suma de Riemann con n subintervalos. m: 'izq' | 'der' | 'medio' | 'trap'. Devuelve {suma, segs:[{x0,x1,y0,y1}]}. */
export function riemann(f, a, b, n, m = 'izq') {
  n = Math.max(1, Math.round(n));
  const h = (b - a) / n, segs = []; let suma = 0;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h, x1 = x0 + h;
    const y0 = evalF(f, m === 'der' ? x1 : m === 'medio' ? x0 + h / 2 : x0), y1 = m === 'trap' ? evalF(f, x1) : y0;
    suma += (y0 + y1) / 2 * h; segs.push({ x0, x1, y0, y1 });
  }
  return { suma, segs };
}

/** Polinomio de Taylor de grado k alrededor de a; coef(i) = f⁽ⁱ⁾(a)/i!. */
export const taylor = (coef, a, k) => x => { let s = 0, p = 1; for (let i = 0; i <= k; i++) { s += coef(i) * p; p *= x - a; } return s; };

/** Iterados de Newton-Raphson (se detiene si la derivada se anula). */
export function newton(f, x0, n) {
  const xs = [x0];
  for (let i = 0; i < n; i++) {
    const d = deriv(f, xs[i]), y = evalF(f, xs[i]);
    if (!d || !Number.isFinite(d) || !Number.isFinite(y)) break;
    xs.push(xs[i] - y / d);
  }
  return xs;
}

/** N+1 muestras de g en [t0,t1] → {xs, ys}. */
export function muestrear(gx, gy, t0, t1, N) {
  const xs = new Array(N + 1), ys = new Array(N + 1);
  for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N; xs[i] = gx(t); ys[i] = gy(t); }
  return { xs, ys };
}

/** Inserta NaN (rompe el trazo) en los saltos mayores que `salto` y donde y no es finita. */
export function cortar(xs, ys, salto) {
  const X = [], Y = [];
  for (let i = 0; i < xs.length; i++) {
    const y = Number.isFinite(ys[i]) ? ys[i] : NaN;
    if (i && Number.isFinite(y) && Number.isFinite(Y.at(-1)) && Math.abs(y - Y.at(-1)) > salto) { X.push(xs[i]); Y.push(NaN); }
    X.push(xs[i]); Y.push(y);
  }
  return { xs: X, ys: Y };
}

/** Ventana efectiva [x0,x1,y0,y1]; con `igual` el ancho se ajusta al alto del área para que x e y tengan la misma escala. */
export function ventanaEf(v, pw, ph, igual) {
  let [x0, x1] = v.x; const [y0, y1] = v.y;
  if (igual) { const c = (x0 + x1) / 2, h = (y1 - y0) * pw / ph / 2; x0 = c - h; x1 = c + h; }
  return [x0, x1, y0, y1];
}

/** Muestra (xs,ys en unidades del plano) más cercana a (mx,my) en píxeles → {j, x, y, d} (x,y,d en px) o null. Ignora NaN. */
export function puntoMasCercano(xs, ys, px, py, mx, my) {
  let mejor = null, md = Infinity;
  for (let j = 0; j < xs.length; j++) {
    const x = px(xs[j]), y = py(ys[j]); if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const d = (x - mx) * (x - mx) + (y - my) * (y - my);
    if (d < md) { md = d; mejor = { j, x, y, d: 0 }; }
  }
  if (mejor) mejor.d = Math.sqrt(md);
  return mejor;
}

/** De una lista de candidatos {i, x, y, d, …} (d = distancia en px al puntero) el más cercano con d ≤ r, o null. */
export function cercana(cands, r = 30) {
  let mejor = null;
  for (const c of cands) if (c.d <= r && (!mejor || c.d < mejor.d)) mejor = c;
  return mejor;
}

/** Subdivisiones de la rejilla menor para un paso mayor 1·10ᵏ, 2·10ᵏ o 5·10ᵏ (2 → 4 de 0,5; 1 y 5 → 5). */
export const subdiv = paso => (Math.round(paso / 10 ** Math.floor(Math.log10(paso) + 1e-9)) === 2 ? 4 : 5);

/** Valores de la rejilla menor en [lo,hi]: paso/m, sin los múltiplos del paso mayor (índices enteros: sin deriva). */
export function menores(lo, hi, paso, m = 5) {
  const s = paso / m, k0 = Math.ceil(lo / s - 1e-9), k1 = Math.floor(hi / s + 1e-9), out = [];
  if (!(s > 0) || k1 - k0 > 400) return out;
  for (let k = k0; k <= k1; k++) if (k % m !== 0) out.push(k * s);
  return out;
}

/** Punto de una curva paramétrica/polar para el parámetro u. */
export function puntoCurva(c, u) {
  if (c.param) return [evalF(c.param.x, u), evalF(c.param.y, u)];
  const r = evalF(c.polar.r, u); return [r * Math.cos(u), r * Math.sin(u)];
}

// ── Estado: plegar (pura) ───────────────────────────────────────────────────
const defs = new WeakMap();
function crearDef(g) {
  if (!defs.has(g)) defs.set(g, {
    curvas: g.curvas.map((c, i) => ({ id: c.id, nombre: c.nombre ?? c.id, f: c.f, param: c.param, polar: c.polar, hasta: c.hasta, color: c.color ?? PALETA[i % PALETA.length] })),
    deslizadores: g.deslizadores ?? [], arrastrar: g.arrastrar ?? null, igual: !!g.igual, etiqueta: g.etiqueta ?? null,
  });
  return defs.get(g);
}

function aplicar(s, p) {
  const r = { ...s }, ids = new Set(s.def.curvas.map(c => c.id));
  if (p.par) r.par = { ...r.par, ...p.par };
  if (Array.isArray(p.capas)) r.capas = p.capas;
  if (Array.isArray(p.ver)) r.ver = p.ver.filter(id => ids.has(id));
  if ('resaltar' in p) r.resaltar = ids.has(p.resaltar) ? p.resaltar : null;
  if (p.ventana) r.ventana = { x: p.ventana.x ?? r.ventana.x, y: p.ventana.y ?? r.ventana.y };
  return r;
}

/** Estado nuevo = previo + parche. Pura. Estado: {def, par, capas, ver, resaltar, ventana}. */
export function plegar(s, p) {
  if (p.funcion === undefined) return aplicar(s, p);
  const g = p.funcion, def = crearDef(g);
  const base = { def, par: { ...(g.par ?? {}) }, capas: g.capas ?? [], ver: def.curvas.map(c => c.id), resaltar: null, ventana: { x: g.x ?? [-5, 5], y: g.y ?? [-5, 5] } };
  return aplicar(base, p);
}

// Para los bloques `jugar`
export const vista = s => ({ ...s.par, ver: [...s.ver], resaltar: s.resaltar });
export const conVista = (s, v) => { const { ver, resaltar, ...par } = v; return aplicar(s, { par, ver, resaltar }); };
const lang = () => (globalThis.document ? idioma() : 'es');
const L = x => (x && typeof x === 'object' ? x[lang()] : x) ?? '';
export function ctx(s) {
  const por = new Map(s.def.curvas.map(c => [c.id, c])), fn = id => por.get(id)?.f ?? (() => NaN);
  return {
    par: s.par, fmt: v => formatear(v, lang()), nombre: id => L(por.get(id)?.nombre ?? id),
    f: (id, x) => evalF(fn(id), x), d: (id, x) => { const v = deriv(fn(id), x); return Math.abs(v) < 1e-7 ? 0 : v; },
    integral: (id, a, b) => integral(fn(id), a, b), riemann: (id, a, b, n, m) => riemann(fn(id), a, b, n, m).suma,
  };
}

// ── Escena (DOM) ────────────────────────────────────────────────────────────
const W = 640, ML = 52, MR = 84, PW = W - ML - MR, MT = 16, PH = 300, AB = 30, SH = MT + PH + AB, FILA = 34;
const NS = 'http://www.w3.org/2000/svg', ATENUADA = 0.2, N = 420;
const UI = { es: { graf: 'Gráfica de funciones', asa: 'Parámetro' }, en: { graf: 'Function graph', asa: 'Parameter' } };
const CSS = `
.fn { font-family: var(--ui); }
.fn svg { position: absolute; left: 0; top: 0; overflow: visible; }
.fn svg text { font: 11px var(--ui); fill: var(--muted); font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.fn .gm, .fn .gM, .fn .eje, .fn .marco, .fn .cruz { vector-effect: non-scaling-stroke; fill: none; }
.fn .gm { stroke: var(--line); stroke-width: 1; opacity: .4; }
.fn .gM { stroke: var(--line); stroke-width: 1; opacity: .9; }
.fn .marco { stroke: var(--line2); stroke-width: 1; opacity: .7; }
.fn .eje { stroke: var(--line2); stroke-width: 1.5; }
.fn .cv { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.fn .cv.res { stroke-width: 3; }
.fn text.tx { fill: var(--text); font: italic 400 13px var(--display); }
.fn .et .ld { fill: none; stroke-width: 1; opacity: .7; }
.fn .tg, .fn .sc, .fn .nw, .fn .ln { fill: none; stroke-width: 1.5; stroke-linecap: round; }
.fn .tg { stroke: var(--g-activo); } .fn .sc { stroke: var(--g-compara); stroke-dasharray: 7 4; } .fn .nw { stroke: var(--g-hecho); } .fn .ln { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 4; }
.fn .asn { stroke: var(--g-mal); stroke-width: 1; stroke-dasharray: 6 5; }
.fn .ar { fill: color-mix(in srgb, var(--g-camino) 24%, transparent); stroke: var(--g-camino); stroke-width: 1; stroke-linejoin: round; }
.fn .ar.sf { stroke: none; }
.fn .ent { fill: color-mix(in srgb, var(--g-aux) 24%, transparent); stroke: var(--g-aux); stroke-width: 1; }
.fn .ty { fill: none; stroke: var(--g-aux); stroke-width: 2; stroke-dasharray: 2 5; stroke-linecap: round; }
.fn .ban.eps { fill: color-mix(in srgb, var(--g-compara) 18%, transparent); stroke: var(--g-compara); stroke-dasharray: 5 4; stroke-width: 1; }
.fn .ban.del { fill: color-mix(in srgb, var(--g-activo) 16%, transparent); stroke: var(--g-activo); stroke-width: 1; }
.fn .lim { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 2 4; }
.fn .pt { fill: var(--g-activo); stroke: var(--island); stroke-width: 2; }
.fn .pt.ab { fill: var(--island); stroke: var(--text); stroke-width: 2; }
.fn .pt.sc { fill: var(--g-compara); stroke: var(--island); stroke-width: 2; stroke-dasharray: none; }
.fn .hit { fill: transparent; pointer-events: all; touch-action: none; }
.fn .hit.arr { cursor: ew-resize; }
.fn .cruz { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; pointer-events: none; }
.fn .mira { stroke: var(--island); stroke-width: 2; pointer-events: none; }
.fn .asa { cursor: grab; outline: none; touch-action: none; }
.fn .asa .zona { fill: transparent; pointer-events: all; }
.fn .asa .halo { fill: color-mix(in srgb, var(--g-activo) 14%, transparent); stroke: var(--g-activo); stroke-width: 1.5; opacity: 0; transition: opacity .14s; pointer-events: none; }
.fn .asa:hover .halo, .fn .asa:focus-visible .halo, .fn.drag .asa .halo { opacity: 1; }
.fn .asa:focus-visible .halo { stroke-width: 2.5; }
.fn.drag, .fn.drag .asa, .fn.drag .hit.arr { cursor: grabbing; }
.fn .ov { position: absolute; left: 0; top: 0; width: ${W}px; height: ${SH}px; pointer-events: none; overflow: visible; }
.fn .fe { position: absolute; left: 0; top: 0; white-space: nowrap; font: italic 400 13px/1.15 var(--display); color: var(--text); }
.fn .fe .katex { font-size: 1.02em; }
.fn .fe .tex-raw { font-style: italic; }
.fn .tip { position: absolute; left: 0; top: 0; padding: 3px 8px 3px 7px; background: var(--cell); border: 1px solid var(--line2); border-left: 3px solid var(--muted); border-radius: 6px; white-space: nowrap; font: 12px/1.35 var(--ui); font-variant-numeric: tabular-nums; color: var(--text); opacity: 0; transition: opacity .12s; box-shadow: 0 2px 8px rgba(0,0,0,.35); }
.fn .tip.on { opacity: 1; }
.fn .tip .nom { display: block; font: italic 400 13px/1.2 var(--display); color: var(--text); }
.fn .tip .xy { color: var(--code); }
.fn .desl { position: absolute; left: ${ML - 8}px; width: ${PW + 16}px; height: ${FILA}px; display: grid; grid-template-columns: 1fr ${MR + 4}px; align-items: center; column-gap: 10px; font-size: 13px; color: var(--code); }
.fn .desl label { grid-column: 1 / -1; line-height: 1; margin-bottom: -6px; font-style: italic; font-family: var(--display); }
.fn .desl input { width: 100%; margin: 0; accent-color: var(--g-activo); cursor: pointer; }
.fn .desl output { font-variant-numeric: tabular-nums; color: var(--text); text-align: right; }
@media (prefers-reduced-motion: reduce) { .fn * { transition: none !important; animation: none !important; } }
`;
const inyectarCss = () => {
  if (document.getElementById('css-funcion')) return;
  const s = document.createElement('style'); s.id = 'css-funcion'; s.textContent = CSS; document.head.append(s);
};
const nodo = (tag, cls, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  if (cls) e.setAttribute('class', cls);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const div = (cls, txt) => { const e = document.createElement('div'); e.className = cls; if (txt != null) e.textContent = txt; return e; };
const attr = (e, o) => { for (const k in o) e.setAttribute(k, typeof o[k] === 'number' ? +o[k].toFixed(2) : o[k]); };
const ocultar = (e, oc) => e.setAttribute('display', oc ? 'none' : 'inline');
const cl = v => lim(v, -GRANDE, GRANDE);

// Capas: crear(spec, g, ov) añade sus nodos a `g` (SVG) o a `ov` (HTML superpuesto) y devuelve upd(c); c = {px,py,wx0,wx1,wy0,wy1,par,F,fn}
const CAPAS = {
  tangente(s, g) {
    const ln = nodo('line', 'tg'), pt = nodo('circle', 'pt', { r: 4.5 }); g.append(ln, pt);
    return c => {
      const x = num(s.x, c.par), y = c.F(s.c, x), m = deriv(c.fn(s.c), x), ok = Number.isFinite(y) && Number.isFinite(m);
      ocultar(ln, !ok); ocultar(pt, !ok); if (!ok) return;
      attr(ln, { x1: c.px(c.wx0), y1: cl(c.py(y + m * (c.wx0 - x))), x2: c.px(c.wx1), y2: cl(c.py(y + m * (c.wx1 - x))) }); attr(pt, { cx: c.px(x), cy: c.py(y) });
    };
  },
  secante(s, g) {
    const ln = nodo('line', 'sc'), p1 = nodo('circle', 'pt', { r: 4.5 }), p2 = nodo('circle', 'pt sc', { r: 4.5 }); g.append(ln, p1, p2);
    return c => {
      const x = num(s.x, c.par), h = num(s.h, c.par), y1 = c.F(s.c, x), y2 = c.F(s.c, x + h), ok = Number.isFinite(y1) && Number.isFinite(y2) && h !== 0;
      for (const e of [ln, p1, p2]) ocultar(e, !ok); if (!ok) return;
      const m = (y2 - y1) / h;
      attr(ln, { x1: c.px(c.wx0), y1: cl(c.py(y1 + m * (c.wx0 - x))), x2: c.px(c.wx1), y2: cl(c.py(y1 + m * (c.wx1 - x))) });
      attr(p1, { cx: c.px(x), cy: c.py(y1) }); attr(p2, { cx: c.px(x + h), cy: c.py(y2) });
    };
  },
  riemann(s, g) {
    const p = nodo('path', 'ar'); g.append(p);
    return c => {
      const a = num(s.a, c.par), b = num(s.b, c.par), n = num(s.n, c.par), m = s.m ?? 'izq', f = c.fn(s.c); let d = '';
      const base = c.py(0), esp = !!s.espejo;
      if (m === 'exacta') {
        const K = 120; d = `M${c.px(a).toFixed(1)} ${base.toFixed(1)}`;
        for (let i = 0; i <= K; i++) { const x = a + (b - a) * i / K, y = evalF(f, x); if (Number.isFinite(y)) d += `L${c.px(x).toFixed(1)} ${cl(c.py(y)).toFixed(1)}`; }
        d += `L${c.px(b).toFixed(1)} ${base.toFixed(1)}Z`;
        if (esp) { d += `M${c.px(a).toFixed(1)} ${base.toFixed(1)}`; for (let i = 0; i <= K; i++) { const x = a + (b - a) * i / K, y = evalF(f, x); if (Number.isFinite(y)) d += `L${c.px(x).toFixed(1)} ${cl(c.py(-y)).toFixed(1)}`; } d += `L${c.px(b).toFixed(1)} ${base.toFixed(1)}Z`; }
      } else {
        for (const { x0, x1, y0, y1 } of riemann(f, a, b, n, m).segs) {
          if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
          const X0 = c.px(x0).toFixed(1), X1 = c.px(x1).toFixed(1);
          d += `M${X0} ${base.toFixed(1)}L${X0} ${cl(c.py(y0)).toFixed(1)}L${X1} ${cl(c.py(y1)).toFixed(1)}L${X1} ${base.toFixed(1)}Z`;
          if (esp) d += `M${X0} ${base.toFixed(1)}L${X0} ${cl(c.py(-y0)).toFixed(1)}L${X1} ${cl(c.py(-y1)).toFixed(1)}L${X1} ${base.toFixed(1)}Z`;
        }
      }
      p.setAttribute('d', d); p.classList.toggle('sf', Math.round(n) > 60 && m !== 'exacta');
    };
  },
  entre(s, g) {
    const p = nodo('path', 'ent'); g.append(p);
    return c => {
      const a = num(s.a, c.par), b = num(s.b, c.par), K = 100, F = c.fn(s.c), G = c.fn(s.g); let d = '';
      for (let i = 0; i <= K; i++) { const x = a + (b - a) * i / K, y = evalF(F, x); d += `${i ? 'L' : 'M'}${c.px(x).toFixed(1)} ${cl(c.py(Number.isFinite(y) ? y : 0)).toFixed(1)}`; }
      for (let i = K; i >= 0; i--) { const x = a + (b - a) * i / K, y = evalF(G, x); d += `L${c.px(x).toFixed(1)} ${cl(c.py(Number.isFinite(y) ? y : 0)).toFixed(1)}`; }
      p.setAttribute('d', d + 'Z');
    };
  },
  taylor(s, g) {
    const p = nodo('path', 'ty'); g.append(p);
    return c => {
      const T = taylor(s.coef, num(s.a, c.par), Math.round(num(s.grado, c.par))), xs = [], ys = [];
      for (let i = 0; i <= 200; i++) { const x = c.wx0 + (c.wx1 - c.wx0) * i / 200; xs.push(x); ys.push(evalF(T, x)); }
      p.setAttribute('d', camino(xs, ys, c.px, c.py, PH).d);
    };
  },
  epsdelta(s, g) {
    const hb = nodo('rect', 'ban eps'), vb = nodo('rect', 'ban del'), hl = nodo('line', 'lim'); g.append(hb, vb, hl);
    return c => {
      const x0 = num(s.x, c.par), Lm = num(s.L, c.par), e = num(s.eps, c.par), dl = num(s.delta, c.par);
      attr(hb, { x: 0, width: PW, y: cl(c.py(Lm + e)), height: Math.max(0, cl(c.py(Lm - e)) - cl(c.py(Lm + e))) });
      attr(vb, { y: 0, height: PH, x: c.px(x0 - dl), width: Math.max(0, c.px(x0 + dl) - c.px(x0 - dl)) });
      attr(hl, { x1: 0, x2: PW, y1: c.py(Lm), y2: c.py(Lm) });
    };
  },
  punto(s, g) {
    const pt = nodo('circle', 'pt' + (s.abierto ? ' ab' : ''), { r: 5 }); g.append(pt);
    return c => {
      const x = num(s.x, c.par), y = s.c ? c.F(s.c, x) : num(s.y, c.par), ok = Number.isFinite(x) && Number.isFinite(y);
      ocultar(pt, !ok); if (ok) attr(pt, { cx: c.px(x), cy: c.py(y) });
    };
  },
  asintota(s, g) {
    const ln = nodo('line', 'asn'); g.append(ln);
    return c => {
      if ('x' in s) { const x = c.px(num(s.x, c.par)); attr(ln, { x1: x, x2: x, y1: 0, y2: PH }); }
      else { const y = c.py(num(s.y, c.par)); attr(ln, { x1: 0, x2: PW, y1: y, y2: y }); }
    };
  },
  newton(s, g) {
    const p = nodo('path', 'nw'), pts = nodo('g'); g.append(p, pts);
    return c => {
      const xs = newton(c.fn(s.c), num(s.x, c.par), Math.round(num(s.n, c.par))), by = c.py(0); let d = '';
      xs.forEach((x, i) => { const y = c.F(s.c, x); d += `M${c.px(x).toFixed(1)} ${by.toFixed(1)}L${c.px(x).toFixed(1)} ${cl(c.py(y)).toFixed(1)}`; if (i < xs.length - 1) d += `L${c.px(xs[i + 1]).toFixed(1)} ${by.toFixed(1)}`; });
      p.setAttribute('d', d);
    };
  },
  marca(s, g) {
    const pt = nodo('circle', 'pt', { r: 5 }); g.append(pt);
    return c => { const cv = c.curva(s.c), [x, y] = cv ? puntoCurva(cv, num(s.u, c.par)) : [NaN, NaN], ok = Number.isFinite(x) && Number.isFinite(y); ocultar(pt, !ok); if (ok) attr(pt, { cx: c.px(x), cy: c.py(y) }); };
  },
  linea(s, g) {
    const ln = nodo('line', 'ln'); g.append(ln);
    return c => attr(ln, { x1: c.px(num(s.x1, c.par)), y1: cl(c.py(num(s.y1, c.par))), x2: c.px(num(s.x2, c.par)), y2: cl(c.py(num(s.y2, c.par))) });
  },
  texto(s, g, ov) {
    const txt = L(s.s);
    if (String(txt).includes('$')) { // con fórmulas: HTML (KaTeX), colocado con transform; el texto se compone una sola vez
      const d = div('fe'), dx = { start: '0%', middle: '-50%', end: '-100%' }[s.ancla ?? 'start'] ?? '0%'; etiqueta(d, txt); ov.append(d);
      let ant = '';
      return c => {
        const x = c.px(num(s.x, c.par)), y = c.py(num(s.y, c.par)), t = `translate(${(ML + x).toFixed(1)}px,${(MT + y).toFixed(1)}px) translate(${dx},-70%)`;
        if (t !== ant) { ant = t; d.style.transform = t; }
      };
    }
    const t = nodo('text', 'tx', { 'text-anchor': s.ancla ?? 'start' }); t.textContent = txt; g.append(t);
    return c => attr(t, { x: c.px(num(s.x, c.par)), y: c.py(num(s.y, c.par)) });
  },
};


export const crear = stage => new Funcion(stage);

export class Funcion {
  constructor(stage) {
    this.stage = stage; stage.classList.add('fn');
    this.def = null; this.cur = this.to = this.tw = null; this.cb = null; this.W = W; this.H = SH;
    this.mu = new Map(); this.rect = null; this.hov = null; this.arr = false; this.parar = this.sp = null;
    this.reducido = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // El rectángulo del SVG (para pasar de clientX/Y a coordenadas del plano) se lee UNA vez al entrar y se invalida al
    // desplazar o redimensionar: nunca se lee layout en pointermove ni en los fotogramas.
    addEventListener('scroll', () => { this.rect = null; }, { passive: true, capture: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { this.rect = null; }).observe(stage.parentElement || stage);
  }

  get tam() { return { W: this.W, H: this.H }; }

  fijar(def) {
    if (def === this.def) return;
    this.parar?.(); this.sp?.(); this.parar = this.sp = null; inyectarCss();
    this.def = def; this.cur = this.to = this.tw = null; this.capasRef = null; this.capasKey = ''; this.cache = new Map(); this.ticksX = []; this.ticksY = [];
    this.mu = new Map(); this.hov = null; this.rect = null; this.arr = false; this.lecOn = false; this.tipK = ''; this.asaV = NaN; this.specs = [];
    this.stage.classList.remove('drag');
    this.uid = (Funcion.n = (Funcion.n || 0) + 1);
    this.H = SH + def.deslizadores.length * FILA + 6;
    this.stage.replaceChildren();
    const svg = this.svg = nodo('svg', '', { width: W, height: SH, viewBox: `0 0 ${W} ${SH}`, role: 'img' });
    const clip = nodo('clipPath', '', { id: `fcl${this.uid}` }); clip.append(nodo('rect', '', { x: 0, y: 0, width: PW, height: PH }));
    const dfs = nodo('defs'); dfs.append(clip);
    const plot = nodo('g', '', { transform: `translate(${ML},${MT})` });
    this.gMen = nodo('path', 'gm'); this.gMay = nodo('path', 'gM'); this.gTicks = nodo('g');
    this.marco = nodo('rect', 'marco', { x: 0, y: 0, width: PW, height: PH });
    this.ejeX = nodo('line', 'eje'); this.ejeY = nodo('line', 'eje');
    const gc = nodo('g', '', { 'clip-path': `url(#fcl${this.uid})` });
    this.gCapas = nodo('g'); this.gCurvas = nodo('g'); gc.append(this.gCapas, this.gCurvas);
    // Capa HTML superpuesta (etiquetas con `$…$`, lectura al pasar el puntero): se mueve solo con transform/opacity
    const ov = this.ov = div('ov'), ovFijas = this.ovCapas = div('ovc');
    ov.append(ovFijas);
    this.curvas = def.curvas.map(c => {
      const path = nodo('path', 'cv', { stroke: c.color }); this.gCurvas.append(path);
      const er = nodo('g', 'et'), ky = nodo('line', '', { stroke: c.color, 'stroke-width': 2, 'stroke-linecap': 'round' }), ldr = nodo('path', 'ld', { stroke: c.color });
      er.append(ldr, ky);
      const fe = div('fe'); fe.style.opacity = 0; ov.append(fe);
      return { path, er, ky, ldr, fe, c, nom: null, vis: false, po: -1, fo: 0, tf: '', res: false };
    });
    this.gEtq = nodo('g'); this.gEtq.append(...this.curvas.map(o => o.er));
    this.hit = nodo('rect', 'hit', { x: 0, y: 0, width: PW, height: PH });
    this.cruz = nodo('line', 'cruz', { display: 'none' }); this.mira = nodo('circle', 'mira', { r: 4.5, display: 'none' });
    plot.append(this.gMen, this.gMay, this.gTicks, this.marco, this.ejeX, this.ejeY, gc, this.gEtq, this.hit, this.cruz, this.mira);
    // Lectura al pasar el puntero (tooltip HTML)
    const tip = this.tip = div('tip'), nom = this.tipNom = document.createElement('span'), xy = this.tipXY = document.createElement('span');
    nom.className = 'nom'; xy.className = 'xy'; tip.append(nom, xy); ov.append(tip);
    // Asa arrastrable (role=slider) del parámetro `arrastrar`: posición en dibujar()
    const par = typeof def.arrastrar === 'string' ? def.arrastrar : null, sl = def.deslizadores.find(d => d.par === par);
    this.asa = null;
    if (par) {
      const g = nodo('g', 'asa', { tabindex: 0, role: 'slider', 'aria-orientation': 'horizontal', display: 'none' });
      g.append(nodo('circle', 'zona', { r: 18 }), nodo('circle', 'halo', { r: 11 }));
      plot.append(g); this.asa = { g, zona: g.firstChild, halo: g.lastChild, sl };
    }
    svg.append(dfs, plot); this.stage.append(svg, ov);
    // Deslizadores nativos
    this.desl = def.deslizadores.map((d, i) => {
      const row = document.createElement('div'); row.className = 'desl'; row.style.top = SH + 2 + i * FILA + 'px';
      const lab = document.createElement('label'), inp = document.createElement('input'), out = document.createElement('output');
      inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.paso ?? (d.max - d.min) / 200;
      inp.addEventListener('input', () => this.entrada(d.par, +inp.value));
      row.append(lab, inp, out); this.stage.append(row);
      return { d, lab, inp, out, row, ls: null };
    });
    // Arrastre (sobre la gráfica o por el asa): mueve el parámetro `arrastrar` (coordenada x del puntero)
    this.hit.classList.toggle('arr', !!par);
    const valor = e => {
      const r = this.rect, [x0, x1] = this.cur.win, x = x0 + lim((e.clientX - r.left) / (r.width / W) - ML, 0, PW) / PW * (x1 - x0);
      return +lim(x, sl ? sl.min : -Infinity, sl ? sl.max : Infinity).toFixed(2);
    };
    const mover = (e, suave) => { if (par && this.cur && this.rect) this.entrada(par, valor(e), suave); };
    const abajo = e => {
      if (!par || e.button) return;
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      this.rect = this.svg.getBoundingClientRect(); this.arr = true; this.stage.classList.add('drag'); this.hov = null; this.verLectura(null);
      this.asa?.g.focus({ preventScroll: true }); mover(e, true); // el primer salto (clic lejos del punto) se suaviza con el muelle
    };
    const mueve = e => {
      if (this.arr) return mover(e, false);
      if (e.pointerType === 'touch') return;
      if (!this.rect) this.rect = this.svg.getBoundingClientRect();
      this.hov = { x: e.clientX, y: e.clientY };
      if (!this.hpend) { this.hpend = true; tarea(() => { this.hpend = false; this.lectura(); return false; }); } // un trabajo por fotograma
    };
    const fin = e => {
      if (!this.arr) return;
      this.arr = false; this.stage.classList.remove('drag');
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
      if (e.pointerType !== 'touch') { this.hov = { x: e.clientX, y: e.clientY }; this.lectura(); }
    };
    const entra = () => { this.rect = null; }; // se relee una sola vez, en el primer pointermove de la visita
    const sale = () => { if (this.arr) return; this.hov = null; this.verLectura(null); };
    for (const el of [this.hit, this.asa?.g].filter(Boolean)) {
      el.addEventListener('pointerdown', abajo); el.addEventListener('pointermove', mueve);
      el.addEventListener('pointerup', fin); el.addEventListener('pointercancel', fin);
      el.addEventListener('pointerenter', entra); el.addEventListener('pointerleave', sale);
    }
    if (this.asa) this.asa.g.addEventListener('keydown', e => {
      const lo = sl ? sl.min : this.cur.win[0], hi = sl ? sl.max : this.cur.win[1], st = (sl?.paso ?? (hi - lo) / 100) * (e.shiftKey ? 10 : 1);
      const v0 = this.mu.get(par)?.a ?? this.cur.par[par]; let v;
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp': v = v0 + st; break;
        case 'ArrowLeft': case 'ArrowDown': v = v0 - st; break;
        case 'PageUp': v = v0 + st * 5; break;
        case 'PageDown': v = v0 - st * 5; break;
        case 'Home': v = lo; break;
        case 'End': v = hi; break;
        default: return;
      }
      e.preventDefault(); e.stopPropagation(); // las flechas no deben pasar de paso mientras el asa tiene el foco
      this.entrada(par, +lim(v, lo, hi).toFixed(4), true);
    });
  }

  /** ids truthy: avisa cb(par, valor) en cada movimiento del puntero o deslizador; null: sin aviso. */
  arrastre(ids, cb) { this.cb = ids ? cb : null; }

  /**
   * Fija el parámetro `par` a `v`. La gráfica lo sigue con un Muelle (conserva la velocidad si el objetivo cambia a mitad de
   * movimiento, así clics lejanos, flechas y deslizadores con `paso` no dan saltos); los controles y el aviso `cb` usan ya
   * el valor final. Con movimiento reducido, salto directo.
   */
  entrada(par, v, suave = false) {
    if (!this.cur) return;
    const m0 = this.mu.get(par);
    if ((m0 ? m0.a : this.cur.par[par]) === v) return;
    if (this.to) this.to.par[par] = v;
    if (this.tw) this.tw.from.par[par] = this.tw.to.par[par] = v;
    if (this.reducido() || typeof this.cur.par[par] !== 'number') { this.mu.delete(par); this.cur.par[par] = v; this.dibujar(); }
    else {
      const d = this.def.deslizadores.find(s => s.par === par), rango = d ? d.max - d.min : 10;
      const m = m0 ?? new Muelle(this.cur.par[par], 26, Math.max(1e-6, rango * 2e-4));
      m.w = suave ? 14 : 26; m.ir(v); this.mu.set(par, m);
      this.sp ??= tarea((_, dt) => this.pasoMuelles(dt));
    }
    this.cb?.(par, v);
  }

  pasoMuelles(dt) {
    const c = this.cur;
    if (c) {
      for (const [k, m] of this.mu) { c.par[k] = m.paso(dt); if (m.quieto) this.mu.delete(k); }
      this.dibujar();
    } else this.mu.clear();
    if (this.mu.size) return true;
    this.sp = null; return false;
  }

  pintar(S, animar = true) {
    const dur = animar === true ? 460 : +animar || 0, anim = dur > 0 && !this.reducido(), D = this.def;
    const win = ventanaEf(S.ventana, PW, PH, D.igual), idi = lang();
    const numeros = Object.fromEntries(Object.entries(S.par).filter(([, v]) => typeof v === 'number'));
    const to = { win, par: { ...S.par, ...numeros }, op: {} };
    for (const c of D.curvas) to.op[c.id] = !S.ver.includes(c.id) ? 0 : S.resaltar && S.resaltar !== c.id ? ATENUADA : 1;
    if (!this.cur) this.cur = { win: [...win], par: { ...to.par }, op: { ...to.op } };
    // Un parámetro que el muelle aún está siguiendo conserva su animación si el estado lleva su mismo objetivo (eco de `jugar`);
    // si el estado trae OTRO valor (un botón lo cambió), el muelle se descarta y manda la transición normal.
    const sig = [...this.mu.keys()].filter(k => { if (S.par[k] === this.mu.get(k).a) return true; this.mu.delete(k); return false; });
    // capas: se reconstruyen si cambia la lista (o el idioma, por los textos)
    if (S.capas !== this.capasRef || idi !== this.capasIdi) {
      this.capasRef = S.capas; this.capasIdi = idi; this.specs = S.capas; this.gCapas.replaceChildren(); this.ovCapas.replaceChildren();
      this.capas = S.capas.map(sp => { const g = nodo('g'); this.gCapas.append(g); return CAPAS[sp.tipo]?.(sp, g, this.ovCapas); }).filter(Boolean);
      if (anim) { this.gCapas.animate({ opacity: [0, 1] }, { duration: 260 }); this.ovCapas.animate({ opacity: [0, 1] }, { duration: 260 }); }
    }
    this.nombres();
    this.svg.setAttribute('aria-label', L(D.etiqueta) || UI[idi].graf);
    // un deslizador solo se ve si alguna capa (o `hasta` de una curva) usa su parámetro
    const usados = new Set([...S.capas.flatMap(sp => Object.values(sp)), ...D.curvas.map(c => c.hasta)].filter(v => typeof v === 'string'));
    this.desl.forEach(o => {
      const { d, lab, inp, row } = o, s = L(d);
      if (o.ls !== s) { o.ls = s; etiqueta(lab, s); inp.setAttribute('aria-label', s.replace(/\$/g, '')); }
      row.style.visibility = usados.has(d.par) ? '' : 'hidden';
    });
    if (this.asa) {
      const par = D.arrastrar, d = this.asa.sl;
      this.asa.g.setAttribute('aria-label', (d ? L(d) : `${UI[idi].asa} ${par}`).replace(/\$/g, ''));
      this.asa.g.setAttribute('aria-valuemin', d ? d.min : win[0]); this.asa.g.setAttribute('aria-valuemax', d ? d.max : win[1]); this.asaV = NaN;
    }
    this.to = to;
    this.parar?.(); this.parar = null;
    const iguales = k => this.cur.par[k] === to.par[k];
    const igual = this.cur.win.every((v, i) => v === win[i]) && Object.keys(to.par).every(k => typeof to.par[k] !== 'number' || sig.includes(k) || iguales(k)) && D.curvas.every(c => this.cur.op[c.id] === to.op[c.id]);
    if (!anim || igual) {
      const guardado = Object.fromEntries(sig.map(k => [k, this.cur.par[k]]));
      this.cur = { win: [...win], par: { ...to.par, ...guardado }, op: { ...to.op } }; this.tw = null; this.dibujar(); return;
    }
    this.tw = { t0: performance.now(), dur, from: { win: [...this.cur.win], par: { ...this.cur.par }, op: { ...this.cur.op } }, to };
    if (this.frame(this.tw.t0)) this.parar = tarea(now => this.frame(now));
  }

  /** Un fotograma de la transición de ventana/parámetros/opacidades; devuelve true mientras siga viva (contrato de `tarea`). */
  frame = now => {
    const T = this.tw; if (!T) return false;
    const k = Math.min(1, (now - T.t0) / T.dur), e = ease(k), c = this.cur, a = T.from, b = T.to;
    c.win = a.win.map((v, i) => v + (b.win[i] - v) * e);
    for (const key in b.par) {
      if (this.mu.has(key)) continue; // lo sigue el muelle
      c.par[key] = typeof b.par[key] === 'number' && typeof a.par[key] === 'number' ? a.par[key] + (b.par[key] - a.par[key]) * e : b.par[key];
    }
    for (const id in b.op) c.op[id] = a.op[id] + (b.op[id] - a.op[id]) * e;
    this.dibujar();
    if (k < 1) return true;
    this.tw = null; return false;
  };

  /** Rótulos de curva (HTML, admiten `$…$`): solo se reescriben cuando cambia el texto (idioma incluido), nunca por fotograma. */
  nombres() { for (const o of this.curvas) { const s = L(o.c.nombre); if (o.nom !== s) { o.nom = s; etiqueta(o.fe, s); } } }

  muestras(i, o, win) {
    const c = o.c, key = c.param || c.polar ? `${c.hasta}|${this.cur.par[c.hasta] ?? ''}` : win.join('|');
    const k = this.cache.get(i);
    if (k && k.key === key) return k;
    let m;
    if (c.param || c.polar) {
      const [t0, t1] = (c.param ?? c.polar).t, h = typeof c.hasta === 'string' ? this.cur.par[c.hasta] : c.hasta, tf = Number.isFinite(h) ? lim(h, t0, t1) : t1;
      m = c.param ? muestrear(c.param.x, c.param.y, t0, tf, N) : muestrear(u => evalF(c.polar.r, u) * Math.cos(u), u => evalF(c.polar.r, u) * Math.sin(u), t0, tf, N);
      m = { ...m, ys: m.ys.map(y => (Number.isFinite(y) ? y : NaN)) };
    } else {
      const xs = [], ys = []; for (let j = 0; j <= N; j++) { const x = win[0] + (win[1] - win[0]) * j / N; xs.push(x); ys.push(evalF(c.f, x)); }
      m = cortar(xs, ys, (win[3] - win[2]) * 0.5);
    }
    const r = { key, ...m }; this.cache.set(i, r); return r;
  }

  dibujar() {
    const c = this.cur, [wx0, wx1, wy0, wy1] = c.win, D = this.def, idi = lang();
    const px = this.px = x => (x - wx0) / (wx1 - wx0) * PW, py = this.py = y => (wy1 - y) / (wy1 - wy0) * PH;
    // rejilla mayor/menor (un <path> cada una) y numerales de los ejes (nodos reutilizados)
    const tx = ticks125(wx0, wx1, 8), ty = ticks125(wy0, wy1, 6);
    let M = '', m = '';
    for (const v of tx) M += `M${px(v).toFixed(1)} 0V${PH}`;
    for (const v of ty) M += `M0 ${py(v).toFixed(1)}H${PW}`;
    if (tx.length > 1) for (const v of menores(wx0, wx1, tx[1] - tx[0], subdiv(tx[1] - tx[0]))) m += `M${px(v).toFixed(1)} 0V${PH}`;
    if (ty.length > 1) for (const v of menores(wy0, wy1, ty[1] - ty[0], subdiv(ty[1] - ty[0]))) m += `M0 ${py(v).toFixed(1)}H${PW}`;
    this.gMay.setAttribute('d', M); this.gMen.setAttribute('d', m);
    this.actTicks(this.ticksX, tx, idi, (v, t) => attr(t, { x: px(v), y: PH + 16, 'text-anchor': 'middle' }));
    this.actTicks(this.ticksY, ty, idi, (v, t) => attr(t, { x: -8, y: py(v), dy: '.32em', 'text-anchor': 'end' }));
    const x0 = lim(px(0), 0, PW), y0 = lim(py(0), 0, PH);
    attr(this.ejeX, { x1: 0, x2: PW, y1: y0, y2: y0 }); attr(this.ejeY, { x1: x0, x2: x0, y1: 0, y2: PH });
    const cx = {
      px, py, wx0, wx1, wy0, wy1, par: c.par, fn: id => D.curvas.find(k => k.id === id)?.f ?? (() => NaN), curva: id => D.curvas.find(k => k.id === id),
      F: (id, x) => evalF(D.curvas.find(k => k.id === id)?.f ?? (() => NaN), x),
    };
    for (const u of this.capas) u(cx);
    const der = [], atenuando = !!this.to && Object.values(this.to.op).some(v => v === ATENUADA), wk = c.win.join('|');
    this.curvas.forEach((o, i) => {
      const op = c.op[o.c.id], vis = op > .004; ocultar(o.path, !vis); ocultar(o.er, !vis);
      if (vis !== o.vis) {
        o.vis = vis;
        // Una curva que aparece se dibuja de izquierda a derecha (salvo las que ya crecen con su parámetro `hasta`)
        if (vis && o.c.hasta === undefined) { o.path.getAnimations().forEach(a => a.cancel()); trazo(o.path, 700); }
      }
      if (!vis) { if (o.fo) { o.fe.style.opacity = o.fo = 0; } return; }
      // El trazo solo cambia si cambian las muestras o la ventana: al mover un parámetro (tangente, deslizador…) no se
      // reconstruye la cadena ni el navegador vuelve a parsear el `d` (era lo más caro de dibujar() y generaba basura)
      const mu = this.muestras(i, o, c.win);
      let cam = o.cam;
      if (o.camMu !== mu || o.camWin !== wk) { cam = o.cam = camino(mu.xs, mu.ys, px, py, PH); o.camMu = mu; o.camWin = wk; o.path.setAttribute('d', cam.d); }
      if (o.po !== op) { o.path.style.opacity = o.po = op; o.er.style.opacity = op; }
      const res = !!this.to && this.to.op[o.c.id] === 1 && atenuando; if (res !== o.res) { o.res = res; o.path.classList.toggle('res', res); }
      if (cam.fin && !o.c.param && !o.c.polar) der.push({ o, y: cam.fin.y, op }); else { ocultar(o.er, true); if (o.fo) { o.fe.style.opacity = o.fo = 0; } }
    });
    // Rótulos al final de cada curva, sin solaparse (separar conserva el orden por altura)
    const ys = separar(der.map(d => d.y), 17, 9, PH);
    der.forEach(({ o, y, op }, j) => {
      const ly = ys[j]; attr(o.ky, { x1: PW + 6, x2: PW + 16, y1: ly, y2: ly });
      o.ldr.setAttribute('d', Math.abs(ly - y) > 2 ? `M${PW} ${y.toFixed(1)}L${PW + 6} ${ly.toFixed(1)}` : '');
      const t = `translate(${ML + PW + 21}px,${(MT + ly).toFixed(1)}px) translateY(-50%)`;
      if (o.tf !== t) { o.tf = t; o.fe.style.transform = t; }
      if (o.fo !== op) { o.fe.style.opacity = o.fo = op; }
    });
    this.posAsa(cx);
    this.desl.forEach(({ d, inp, out }) => {
      const v = this.mu.get(d.par)?.a ?? c.par[d.par]; // el control muestra el valor final; la gráfica lo alcanza con el muelle
      if (typeof v === 'number') { if (+inp.value !== v) inp.value = v; const s = formatear(+v.toFixed(d.dec ?? 2), idi); if (out.textContent !== s) out.textContent = s; }
    });
    if (this.hov) this.lectura();
  }

  /** Asa del parámetro arrastrable: sobre el punto de la capa que lo usa (tangente, secante, punto, Taylor…) o sobre el eje x. */
  posAsa(cx) {
    const A = this.asa; if (!A) return;
    const par = this.def.arrastrar, x = cx.par[par];
    if (!Number.isFinite(x) || !this.capas.length && !this.specs.length) { A.g.setAttribute('display', 'none'); return; }
    const sp = this.specs.find(s => (s.c && (s.x === par || s.a === par)) || (s.tipo === 'marca' && s.u === par));
    let X = x, Y = 0;
    if (sp?.tipo === 'marca') { const cv = cx.curva(sp.c); [X, Y] = cv ? puntoCurva(cv, x) : [NaN, NaN]; } else if (sp?.c) Y = cx.F(sp.c, x);
    const sx = cx.px(X), ok = Number.isFinite(sx) && sx >= -2 && sx <= PW + 2;
    A.g.setAttribute('display', ok ? 'inline' : 'none'); if (!ok) return;
    const sy = Number.isFinite(Y) ? lim(cx.py(Y), 0, PH) : lim(cx.py(0), 0, PH);
    attr(A.zona, { cx: sx, cy: sy }); attr(A.halo, { cx: sx, cy: sy });
    const v = this.mu.get(par)?.a ?? x;
    if (v !== this.asaV) { this.asaV = v; A.g.setAttribute('aria-valuenow', v); A.g.setAttribute('aria-valuetext', formatear(+v.toFixed(2), lang())); }
  }

  /** Lectura al pasar el puntero: la curva más cercana (snap), regla vertical, punto y tooltip con (x, f(x)). */
  lectura() {
    const h = this.hov, c = this.cur;
    if (!h || this.arr || !c || !this.rect || !this.px) return this.verLectura(null);
    const s = this.rect.width / W, lx = (h.x - this.rect.left) / s - ML, ly = (h.y - this.rect.top) / s - MT;
    if (lx < 0 || lx > PW || ly < 0 || ly > PH) return this.verLectura(null);
    const [wx0, wx1] = c.win, px = this.px, py = this.py, wx = wx0 + lx / PW * (wx1 - wx0), cands = [];
    this.def.curvas.forEach((k, i) => {
      if ((c.op[k.id] ?? 0) < .5) return;
      if (k.f) {
        const y = evalF(k.f, wx), yy = py(y);
        if (Number.isFinite(y) && yy >= -4 && yy <= PH + 4) cands.push({ i, x: lx, y: yy, d: Math.abs(yy - ly), wx, wy: y });
      } else {
        const mu = this.cache.get(i), p = mu && puntoMasCercano(mu.xs, mu.ys, px, py, lx, ly);
        if (p) cands.push({ i, x: p.x, y: p.y, d: p.d, wx: mu.xs[p.j], wy: mu.ys[p.j] });
      }
    });
    this.verLectura(cercana(cands, 30));
  }

  verLectura(b) {
    if (!b) {
      if (this.lecOn) { this.lecOn = false; ocultar(this.cruz, true); ocultar(this.mira, true); this.tip.classList.remove('on'); }
      return;
    }
    const idi = lang();
    if (!this.lecOn) { this.lecOn = true; ocultar(this.cruz, false); ocultar(this.mira, false); this.tip.classList.add('on'); }
    const o = this.curvas[b.i], k = `${b.i}|${idi}`;
    if (k !== this.tipK) {
      this.tipK = k; etiqueta(this.tipNom, L(o.c.nombre)); this.tip.style.borderLeftColor = o.c.color; this.mira.setAttribute('fill', o.c.color);
    }
    attr(this.cruz, { x1: b.x, x2: b.x, y1: 0, y2: PH }); attr(this.mira, { cx: b.x, cy: b.y });
    const txt = `(${formatear(b.wx, idi)}${idi === 'es' ? ' ; ' : ', '}${formatear(b.wy, idi)})`;
    if (this.tipXY.textContent !== txt) this.tipXY.textContent = txt;
    // A la derecha del punto, salvo cerca del borde derecho; encima, salvo cerca del borde superior
    const X = ML + b.x, Y = MT + b.y, izq = b.x > PW * .6, abajo = b.y < 46;
    this.tip.style.transform = `translate(${(izq ? X - 12 : X + 12).toFixed(1)}px,${(abajo ? Y + 12 : Y - 12).toFixed(1)}px) translate(${izq ? '-100%' : '0'},${abajo ? '0' : '-100%'})`;
  }

  actTicks(pool, vals, idi, pos) {
    while (pool.length < vals.length) { const t = nodo('text'); this.gTicks.append(t); pool.push({ t, s: '', oc: false }); }
    pool.forEach((e, i) => {
      const v = vals[i], oc = v === undefined;
      if (oc !== e.oc) { e.oc = oc; ocultar(e.t, oc); }
      if (oc) return;
      pos(v, e.t); const s = formatear(v, idi); if (s !== e.s) { e.s = s; e.t.textContent = s; }
    });
  }
}
