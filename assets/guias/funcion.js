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
// Animación: un solo requestAnimationFrame; solo atributos de geometría. La lógica pura (muestreo, cortes, Riemann,
// Taylor, Newton, ventana) no toca el DOM al importar: se prueba en Node (tests/guias/test-funcion.js).
import { idioma } from './idioma.js';
import { PALETA, ticks125, formatear, separar, camino } from './grafica.js';

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
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const UI = { es: { graf: 'Gráfica de funciones' }, en: { graf: 'Function graph' } };
const CSS = `
.fn { font-family: var(--ui); }
.fn svg { position: absolute; left: 0; top: 0; overflow: visible; }
.fn svg text { font: 11px var(--ui); fill: var(--muted); font-variant-numeric: tabular-nums; }
.fn .grid { stroke: var(--line); stroke-width: 1; opacity: .55; }
.fn .eje { stroke: var(--line2); stroke-width: 1.25; }
.fn .cv { fill: none; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
.fn .cv.res { stroke-width: 3.4; }
.fn .et text, .fn text.tx { fill: var(--text); font: italic 400 13px var(--display); }
.fn .et .ld { fill: none; stroke-width: 1; opacity: .7; }
.fn .tg, .fn .sc, .fn .nw, .fn .ln { fill: none; stroke-width: 2; stroke-linecap: round; }
.fn .tg { stroke: var(--g-activo); } .fn .sc { stroke: var(--g-compara); stroke-dasharray: 7 4; } .fn .nw { stroke: var(--g-hecho); stroke-width: 1.6; } .fn .ln { stroke: var(--muted); stroke-dasharray: 3 4; }
.fn .asn { stroke: var(--g-mal); stroke-width: 1.25; stroke-dasharray: 6 5; }
.fn .ar { fill: color-mix(in srgb, var(--g-camino) 24%, transparent); stroke: var(--g-camino); stroke-width: 1; stroke-linejoin: round; }
.fn .ar.sf { stroke: none; }
.fn .ent { fill: color-mix(in srgb, var(--g-aux) 24%, transparent); stroke: var(--g-aux); stroke-width: 1; }
.fn .ty { fill: none; stroke: var(--g-aux); stroke-width: 2.25; stroke-dasharray: 2 5; stroke-linecap: round; }
.fn .ban.eps { fill: color-mix(in srgb, var(--g-compara) 18%, transparent); stroke: var(--g-compara); stroke-dasharray: 5 4; stroke-width: 1; }
.fn .ban.del { fill: color-mix(in srgb, var(--g-activo) 16%, transparent); stroke: var(--g-activo); stroke-width: 1; }
.fn .lim { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 2 4; }
.fn .pt { fill: var(--g-activo); stroke: var(--island); stroke-width: 2; }
.fn .pt.ab { fill: var(--island); stroke: var(--text); stroke-width: 2; }
.fn .pt.sc { fill: var(--g-compara); stroke: var(--island); stroke-width: 2; stroke-dasharray: none; }
.fn .hit { fill: transparent; pointer-events: all; touch-action: none; }
.fn .hit.arr { cursor: ew-resize; }
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
const attr = (e, o) => { for (const k in o) e.setAttribute(k, typeof o[k] === 'number' ? +o[k].toFixed(2) : o[k]); };
const ocultar = (e, oc) => e.setAttribute('display', oc ? 'none' : 'inline');
const cl = v => lim(v, -GRANDE, GRANDE);

// Capas: crear(spec, g) añade sus nodos a `g` y devuelve upd(c); c = {px,py,wx0,wx1,wy0,wy1,par,F,fn}
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
  texto(s, g) {
    const t = nodo('text', 'tx', { 'text-anchor': s.ancla ?? 'start' }); t.textContent = L(s.s); g.append(t);
    return c => attr(t, { x: c.px(num(s.x, c.par)), y: c.py(num(s.y, c.par)) });
  },
};

export const crear = stage => new Funcion(stage);

export class Funcion {
  constructor(stage) {
    this.stage = stage; stage.classList.add('fn');
    this.def = null; this.cur = null; this.tw = null; this.raf = 0; this.cb = null; this.W = W; this.H = SH;
    this.reducido = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  get tam() { return { W: this.W, H: this.H }; }

  fijar(def) {
    if (def === this.def) return;
    cancelAnimationFrame(this.raf); inyectarCss();
    this.def = def; this.cur = this.to = this.tw = null; this.capasRef = null; this.capasKey = ''; this.cache = new Map(); this.ticksX = []; this.ticksY = [];
    this.uid = (Funcion.n = (Funcion.n || 0) + 1);
    this.H = SH + def.deslizadores.length * FILA + 6;
    this.stage.replaceChildren();
    const svg = this.svg = nodo('svg', '', { width: W, height: SH, viewBox: `0 0 ${W} ${SH}`, role: 'img' });
    const clip = nodo('clipPath', '', { id: `fcl${this.uid}` }); clip.append(nodo('rect', '', { x: 0, y: 0, width: PW, height: PH }));
    const dfs = nodo('defs'); dfs.append(clip);
    const plot = nodo('g', '', { transform: `translate(${ML},${MT})` });
    this.gGrid = nodo('g'); this.ejeX = nodo('line', 'eje'); this.ejeY = nodo('line', 'eje');
    const gc = nodo('g', '', { 'clip-path': `url(#fcl${this.uid})` });
    this.gCapas = nodo('g'); this.gCurvas = nodo('g'); gc.append(this.gCapas, this.gCurvas);
    this.curvas = def.curvas.map(c => {
      const path = nodo('path', 'cv', { stroke: c.color }); this.gCurvas.append(path);
      const er = nodo('g', 'et'), ky = nodo('line', '', { stroke: c.color, 'stroke-width': 2.5, 'stroke-linecap': 'round' }), ldr = nodo('path', 'ld', { stroke: c.color }), tx = nodo('text', '', { x: PW + 24, dy: '.35em' });
      er.append(ldr, ky, tx);
      return { path, er, ky, ldr, tx, c };
    });
    this.gEtq = nodo('g'); this.gEtq.append(...this.curvas.map(o => o.er));
    this.hit = nodo('rect', 'hit', { x: 0, y: 0, width: PW, height: PH });
    plot.append(this.gGrid, this.ejeX, this.ejeY, gc, this.gEtq, this.hit);
    svg.append(dfs, plot); this.stage.append(svg);
    // Deslizadores nativos
    this.desl = def.deslizadores.map((d, i) => {
      const row = document.createElement('div'); row.className = 'desl'; row.style.top = SH + 2 + i * FILA + 'px';
      const lab = document.createElement('label'), inp = document.createElement('input'), out = document.createElement('output');
      inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.paso ?? (d.max - d.min) / 200;
      inp.addEventListener('input', () => this.entrada(d.par, +inp.value));
      row.append(lab, inp, out); this.stage.append(row);
      return { d, lab, inp, out, row };
    });
    // Arrastre sobre la gráfica: mueve el parámetro `arrastrar` (coordenada x del puntero)
    this.hit.classList.toggle('arr', !!def.arrastrar); this.arr = false;
    const mover = e => {
      if (!def.arrastrar || !this.cur) return;
      const r = this.svg.getBoundingClientRect(), [x0, x1] = this.cur.win, x = x0 + lim((e.clientX - r.left) / (r.width / W) - ML, 0, PW) / PW * (x1 - x0);
      const sl = def.deslizadores.find(d => d.par === def.arrastrar);
      this.entrada(def.arrastrar, +lim(x, sl ? sl.min : -Infinity, sl ? sl.max : Infinity).toFixed(2));
    };
    this.hit.addEventListener('pointerdown', e => { if (!def.arrastrar) return; e.preventDefault(); this.hit.setPointerCapture(e.pointerId); this.arr = true; mover(e); });
    this.hit.addEventListener('pointermove', e => { if (this.arr) mover(e); });
    const fin = e => { this.arr = false; if (this.hit.hasPointerCapture(e.pointerId)) this.hit.releasePointerCapture(e.pointerId); };
    this.hit.addEventListener('pointerup', fin); this.hit.addEventListener('pointercancel', fin);
  }

  /** ids truthy: avisa cb(par, valor) en cada movimiento del puntero o deslizador; null: sin aviso. */
  arrastre(ids, cb) { this.cb = ids ? cb : null; }

  entrada(par, v) {
    if (!this.cur || this.cur.par[par] === v) return;
    this.cur.par[par] = v; if (this.to) this.to.par[par] = v; if (this.tw) this.tw.from.par[par] = this.tw.to.par[par] = v;
    this.dibujar(); this.cb?.(par, v);
  }

  pintar(S, animar = true) {
    const dur = animar === true ? 460 : +animar || 0, anim = dur > 0 && !this.reducido(), D = this.def;
    const win = ventanaEf(S.ventana, PW, PH, D.igual), idi = lang();
    const numeros = Object.fromEntries(Object.entries(S.par).filter(([, v]) => typeof v === 'number'));
    const to = { win, par: { ...S.par, ...numeros }, op: {} };
    for (const c of D.curvas) to.op[c.id] = !S.ver.includes(c.id) ? 0 : S.resaltar && S.resaltar !== c.id ? ATENUADA : 1;
    if (!this.cur) this.cur = { win: [...win], par: { ...to.par }, op: { ...to.op } };
    // capas: se reconstruyen si cambia la lista (o el idioma, por los textos)
    if (S.capas !== this.capasRef || idi !== this.capasIdi) {
      this.capasRef = S.capas; this.capasIdi = idi; this.gCapas.replaceChildren();
      this.capas = S.capas.map(sp => { const g = nodo('g'); this.gCapas.append(g); return CAPAS[sp.tipo]?.(sp, g); }).filter(Boolean);
      if (anim) this.gCapas.animate({ opacity: [0, 1] }, { duration: 260 });
    }
    this.nombres(idi);
    this.svg.setAttribute('aria-label', L(D.etiqueta) || UI[idi].graf);
    // un deslizador solo se ve si alguna capa (o `hasta` de una curva) usa su parámetro
    const usados = new Set([...S.capas.flatMap(sp => Object.values(sp)), ...D.curvas.map(c => c.hasta)].filter(v => typeof v === 'string'));
    this.desl.forEach(({ d, lab, inp, row }) => { lab.textContent = L(d); inp.setAttribute('aria-label', L(d)); row.style.visibility = usados.has(d.par) ? '' : 'hidden'; });
    this.to = to;
    cancelAnimationFrame(this.raf);
    const igual = this.cur.win.every((v, i) => v === win[i]) && Object.keys(to.par).every(k => typeof to.par[k] !== 'number' || this.cur.par[k] === to.par[k]) && D.curvas.every(c => this.cur.op[c.id] === to.op[c.id]);
    if (!anim || igual) { this.cur = { win: [...win], par: { ...to.par }, op: { ...to.op } }; this.tw = null; this.dibujar(); return; }
    this.tw = { t0: performance.now(), dur, from: { win: [...this.cur.win], par: { ...this.cur.par }, op: { ...this.cur.op } }, to };
    this.frame(this.tw.t0);
  }

  frame = now => {
    const T = this.tw, k = Math.min(1, (now - T.t0) / T.dur), e = ease(k), c = this.cur, a = T.from, b = T.to;
    c.win = a.win.map((v, i) => v + (b.win[i] - v) * e);
    for (const key in b.par) c.par[key] = typeof b.par[key] === 'number' && typeof a.par[key] === 'number' ? a.par[key] + (b.par[key] - a.par[key]) * e : b.par[key];
    for (const id in b.op) c.op[id] = a.op[id] + (b.op[id] - a.op[id]) * e;
    this.dibujar();
    if (k < 1) this.raf = requestAnimationFrame(this.frame); else this.tw = null;
  };

  nombres(idi) { this.curvas.forEach(o => { o.tx.textContent = L(o.c.nombre); o.w = L(o.c.nombre).length * 6.4; }); }

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
    const c = this.cur, [wx0, wx1, wy0, wy1] = c.win, D = this.def;
    const px = x => (x - wx0) / (wx1 - wx0) * PW, py = y => (wy1 - y) / (wy1 - wy0) * PH;
    // rejilla y etiquetas de ejes (nodos reutilizados)
    const tx = ticks125(wx0, wx1, 8), ty = ticks125(wy0, wy1, 6);
    this.actTicks(this.ticksX, tx, 'x', (v, e) => { const x = px(v); attr(e.l, { x1: x, x2: x, y1: 0, y2: PH }); attr(e.t, { x, y: PH + 16, 'text-anchor': 'middle' }); });
    this.actTicks(this.ticksY, ty, 'y', (v, e) => { const y = py(v); attr(e.l, { x1: 0, x2: PW, y1: y, y2: y }); attr(e.t, { x: -8, y, dy: '.32em', 'text-anchor': 'end' }); });
    const x0 = lim(px(0), 0, PW), y0 = lim(py(0), 0, PH);
    attr(this.ejeX, { x1: 0, x2: PW, y1: y0, y2: y0 }); attr(this.ejeY, { x1: x0, x2: x0, y1: 0, y2: PH });
    const cx = {
      px, py, wx0, wx1, wy0, wy1, par: c.par, fn: id => D.curvas.find(k => k.id === id)?.f ?? (() => NaN), curva: id => D.curvas.find(k => k.id === id),
      F: (id, x) => evalF(D.curvas.find(k => k.id === id)?.f ?? (() => NaN), x),
    };
    for (const u of this.capas) u(cx);
    const der = [];
    this.curvas.forEach((o, i) => {
      const op = c.op[o.c.id], vis = op > .004; ocultar(o.path, !vis); ocultar(o.er, !vis);
      if (!vis) return;
      const m = this.muestras(i, o, c.win), cam = camino(m.xs, m.ys, px, py, PH);
      o.path.setAttribute('d', cam.d); o.path.style.opacity = op; o.er.style.opacity = op; o.path.classList.toggle('res', !!this.to && this.to.op[o.c.id] === 1 && Object.values(this.to.op).some(v => v === ATENUADA));
      if (cam.fin && !o.c.param && !o.c.polar) der.push({ o, y: cam.fin.y }); else ocultar(o.er, true);
    });
    const ys = separar(der.map(d => d.y), 15, 8, PH);
    der.forEach(({ o, y }, j) => {
      const ly = ys[j]; attr(o.ky, { x1: PW + 6, x2: PW + 18, y1: ly, y2: ly }); attr(o.tx, { y: ly });
      o.ldr.setAttribute('d', Math.abs(ly - y) > 2 ? `M${PW} ${y.toFixed(1)}L${PW + 6} ${ly.toFixed(1)}` : '');
    });
    this.desl.forEach(({ d, inp, out }) => { const v = c.par[d.par]; if (typeof v === 'number') { if (+inp.value !== v) inp.value = v; out.textContent = formatear(+v.toFixed(d.dec ?? 2), lang()); } });
  }

  actTicks(pool, vals, eje, pos) {
    while (pool.length < vals.length) {
      const l = nodo('line', 'grid'), t = nodo('text'); this.gGrid.append(l, t); pool.push({ l, t });
    }
    pool.forEach((e, i) => {
      const v = vals[i]; ocultar(e.l, v === undefined); ocultar(e.t, v === undefined);
      if (v === undefined) return;
      pos(v, e); e.t.textContent = formatear(v, lang());
    });
  }
}
