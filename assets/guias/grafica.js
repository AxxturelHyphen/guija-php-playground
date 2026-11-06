// Escena «grafica»: gráfica interactiva de crecimiento de coste (notación O grande). Curvas f(n) con ejes 1-2-5,
// escala lineal/logarítmica con transición, etiquetas directas al final de cada curva (con anticolisión), marcador
// de n arrastrable (puntero) con lectura de valores, deslizador nativo opcional y tabla opcional.
// Implementa el contrato de escena de guia.js: clave, plegar (pura), crear (+ vista/conVista/ctx para `jugar`).
//
// FORMATO. Un paso ABRE la escena con (las `f` son funciones JS puras, así que los datos son JS, no JSON):
//   grafica: {
//     curvas: [{ id, nombre: 'O(n)' | {es,en}, f: n => número, color? }],   color por defecto = PALETA[posición]
//     nmax: número          dominio del eje x: n ∈ [0, nmax]
//     ymax?: número | {lin?, log?} | null     techo del eje y (null/ausente = automático, estable: usa todas las curvas)
//     escala?: 'lin' | 'log'   (def. 'lin')   n?: número (def. nmax/3)   ver?: [ids] (def. todas)
//     deslizador?: bool        <input type=range> nativo bajo la gráfica
//     tabla?: bool             tabla con n actual y tres hitos (nmax/4, /2, nmax); sustituye a leyenda y panel de lectura
//   }
// PARCHES acumulativos (en pasos y en frames de `traza`; aceptan también `grafica:{…}` anidados como parche inicial):
//   n: número                  mueve el marcador (se recorta a [0, nmax]; transición)
//   ver: [ids]                 curvas visibles; las que entran se dibujan con trazo animado, las que salen se desvanecen
//   escala: 'lin' | 'log'      transición del eje y (las curvas se re-dibujan interpolando)
//   resaltar: id | null        curva en primer plano; el resto atenuadas
//   ymax: número | {lin,log} | null      techo del eje y (animado)
//   zoom: { nmax }             cambia el dominio del eje x (animado)
// `jugar`: la vista es plana {n, nmax, escala, ver, resaltar, ymax}; ctx = {f(id,n), valores(n), fmt(v), nombre(id), curvas}.
// Valores enormes (2ⁿ): la curva se recorta en el borde del área con un triángulo ▲ y su etiqueta sobre el borde;
// en las lecturas se formatean con sufijos (1,2 k · 3,4 M · 5,6e12) o «∞» fuera de rango.
// Animación: solo transform/opacity, stroke-dashoffset y la geometría de las curvas, con UN requestAnimationFrame.
// La lógica pura (escalas, ticks, formato, muestreo, recorte, plegar) no toca el DOM al importar: se prueba en Node
// (tests/guias/test-grafica.js).
import { idioma } from './idioma.js';

export const clave = 'grafica';

// Paleta categórica en orden fijo (nunca se cicla por visibilidad: el color sigue a la curva). Validada con
// validate_palette.js contra --island (#1E1F22), modo oscuro: banda L ok, croma ok, ΔE CVD adyacente ≥ 8,4,
// ΔE visión normal adyacente ≥ 19,3, contraste ≥ 3:1. La identidad no depende solo del color: etiqueta directa + tabla/leyenda.
export const PALETA = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

// ── Lógica pura ─────────────────────────────────────────────────────────────
const limitar = (x, a, b) => Math.min(b, Math.max(a, x));
const GRANDE = 1e6; // los píxeles «infinitos» se sustituyen por esto para poder interpolar el recorte
const nClamp = x => limitar(x, -GRANDE, GRANDE);
export const LOGLO = 0.5; // suelo del eje logarítmico: así O(1) = 1 queda por encima del eje

/** Valor de una curva en x, siempre número (NaN si f lanza o no devuelve número). */
export function valor(c, x) {
  try { const y = c.f(x); return typeof y === 'number' ? y : NaN; } catch { return NaN; }
}

/** Redondea hacia arriba a 1-2-5·10^k. */
export function techo125(v) {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/** Escala de dominio [d0,d1] a rango [r0,r1]. tipo 'lin' | 'log'. En log, v ≤ 0 → NaN. */
export function crearEscala(tipo, [d0, d1], [r0, r1]) {
  if (tipo === 'log') {
    const a = Math.log10(d0), b = Math.log10(d1);
    return v => (v > 0 ? r0 + (Math.log10(v) - a) / (b - a) * (r1 - r0) : NaN);
  }
  return v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
}

/** Mezcla de la escala lineal y la logarítmica (k=0 lin, k=1 log) para la transición. Valores ≤ 0 en log quedan bajo el eje. */
export function escalaMezcla(sl, sg, k, alto) {
  return v => {
    if (Number.isNaN(v)) return NaN;
    const l = nClamp(sl(v)), g = v > 0 ? nClamp(sg(v)) : alto * 3;
    return k <= 0 ? l : k >= 1 ? g : l + (g - l) * k;
  };
}

/** Ticks 1-2-5 en [lo,hi] (como mucho `max`). */
export function ticks125(lo, hi, max = 6) {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  const raw = span / max, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(lo / paso - 1e-9) * paso; v <= hi + paso * 1e-9; v += paso) out.push(Number(v.toPrecision(12)));
  return out;
}

/** Ticks de eje logarítmico: décadas (con 2 y 5 si hay pocas); si hay muchas, una de cada `salto`. */
export function ticksLog(lo, hi, max = 7) {
  const e0 = Math.ceil(Math.log10(lo) - 1e-9), e1 = Math.floor(Math.log10(hi) + 1e-9), out = [];
  const salto = Math.max(1, Math.ceil((e1 - e0 + 1) / max)), poco = e1 - e0 + 1 <= 3;
  for (let e = Math.floor(Math.log10(lo)); e <= e1; e++) {
    if (e % salto && e !== e0) continue;
    for (const m of poco ? [1, 2, 5] : [1]) { const v = Number((m * 10 ** e).toPrecision(12)); if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) out.push(v); }
  }
  return out;
}

/** Formatea una magnitud: 12 · 4,9 · 1,23 k · 3,4 M · 5,6e12 · «∞» (fuera de rango) · «—» (no definido). */
export function formatear(v, lang = 'es') {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  const dec = s => (lang === 'es' ? s.replace('.', ',') : s), a = Math.abs(v), sg = v < 0 ? '−' : '';
  if (a === 0) return '0';
  if (a < 1e-3 || Number(a.toPrecision(3)) >= 1e9) { // notación científica: mantisa de 2 cifras
    const [m, e] = a.toExponential(1).split('e');
    return sg + dec(m.replace(/\.0$/, '')) + 'e' + Number(e);
  }
  const r = Number(a.toPrecision(3));
  if (r < 1e3) return sg + dec(String(r));
  const [u, s] = r < 1e6 ? [1e3, ' k'] : [1e6, ' M'];
  return sg + dec(String(Number((a / u).toPrecision(3)))) + s;
}

/** Muestrea fn(x) en N+1 puntos de [0, nmax]. Valores no numéricos → NaN; se conservan ±Infinity. */
export function muestrear(fn, nmax, N = 160) {
  const xs = new Array(N + 1), vs = new Array(N + 1);
  for (let i = 0; i <= N; i++) { xs[i] = nmax * i / N; const y = fn(xs[i]); vs[i] = typeof y === 'number' ? y : NaN; }
  return { xs, vs };
}

/**
 * Camino SVG de una curva recortado a la banda vertical [0, alto]. px/py: valor → píxel (py puede dar ±Infinity/±1e6).
 * Devuelve {d, fin, arriba, abajo}: fin = punto final si la curva termina dentro; arriba = {x} de la primera salida por el
 * borde superior (marca ▲); abajo = hay salida por el borde inferior. Los saltos (NaN) rompen el trazo. Nunca emite NaN.
 */
export function camino(xs, vs, px, py, alto) {
  const r = v => +v.toFixed(2);
  let d = '', pluma = false, hay = false, ax = 0, ay = 0, fin = null, arriba = null, abajo = false;
  for (let i = 0; i < xs.length; i++) {
    const bx = px(xs[i]); let by = py(vs[i]);
    if (Number.isNaN(by) || Number.isNaN(bx)) { hay = pluma = false; continue; }
    by = nClamp(by);
    const dentro = by >= 0 && by <= alto;
    if (!hay) {
      if (dentro) { d += `M${r(bx)} ${r(by)}`; pluma = true; }
    } else {
      const dy = by - ay;
      let t0 = 0, t1 = 1;
      if (dy === 0) { if (ay < 0 || ay > alto) t0 = 2; }
      else { const ta = -ay / dy, tb = (alto - ay) / dy; t0 = Math.max(0, Math.min(ta, tb)); t1 = Math.min(1, Math.max(ta, tb)); }
      if (t0 <= t1) {
        const x0 = ax + (bx - ax) * t0, y0 = ay + dy * t0, x1 = ax + (bx - ax) * t1, y1 = ay + dy * t1;
        if (!pluma || t0 > 0) d += `M${r(x0)} ${r(y0)}`;
        d += `L${r(x1)} ${r(y1)}`;
        pluma = t1 === 1;
        if (t1 < 1) { if (by < 0) arriba ??= { x: x1 }; else abajo = true; }
      } else pluma = false;
    }
    if (dentro && i === xs.length - 1) fin = { x: bx, y: by };
    ax = bx; ay = by; hay = true;
  }
  return { d, fin, arriba, abajo };
}

/** Separa posiciones (etiquetas) al menos `gap` entre sí dentro de [lo,hi]; conserva el orden por posición. */
export function separar(pos, gap, lo, hi) {
  const idx = pos.map((_, i) => i).sort((a, b) => pos[a] - pos[b]), m = idx.length, out = pos.slice();
  for (let i = 1; i < m; i++) out[idx[i]] = Math.max(out[idx[i]], out[idx[i - 1]] + gap);
  for (let i = m - 1; i >= 0; i--) out[idx[i]] = Math.min(out[idx[i]], hi - (m - 1 - i) * gap);
  for (let i = 0; i < m; i++) out[idx[i]] = Math.max(out[idx[i]], lo + i * gap);
  return out;
}

/** n entero en [0,nmax] a partir de la coordenada x (en px del área) de un puntero. */
export const nDesdeX = (x, ancho, nmax) => Math.round(limitar(x / ancho, 0, 1) * nmax);

/** Dominios de y {lin:[0,hi], log:[LOGLO,hi]}. Automático = depende de TODAS las curvas (no salta al mostrar/ocultar). */
export function dominioY(curvas, nmax, ymax) {
  const fin = curvas.map(c => valor(c, nmax)).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => b - a);
  const yo = typeof ymax === 'object' && ymax ? ymax : { lin: ymax, log: ymax };
  const ok = v => (typeof v === 'number' && v > 0 && Number.isFinite(v) ? v : null);
  // lineal: la 2.ª mayor con holgura (la mayor suele ser la exponencial, que se recorta a propósito)
  const lin = ok(yo.lin) ?? techo125((fin.length > 1 ? fin[1] : fin[0] ?? 1) * 1.08);
  const log = ok(yo.log) ?? 10 ** limitar(Math.ceil(Math.log10((fin[0] ?? 1) * 1.0001)), 1, 30);
  return { lin: [0, lin], log: [LOGLO, Math.max(log, LOGLO * 4)] };
}

// ── Estado: plegar (pura) ───────────────────────────────────────────────────
const defs = new WeakMap(); // misma identidad de `def` mientras sea el mismo paso de apertura (guia.js compara por ===)
function crearDef(g) {
  if (!defs.has(g)) defs.set(g, {
    curvas: g.curvas.map((c, i) => ({ id: c.id, nombre: c.nombre ?? c.id, f: c.f, color: c.color ?? PALETA[i % PALETA.length] })),
    deslizador: !!g.deslizador, tabla: !!g.tabla,
  });
  return defs.get(g);
}

function aplicar(s, p) {
  const ids = new Set(s.def.curvas.map(c => c.id)), r = { ...s };
  if (p.zoom && Number.isFinite(+p.zoom.nmax) && +p.zoom.nmax > 0) r.nmax = +p.zoom.nmax;
  if (Array.isArray(p.ver)) r.ver = p.ver.filter(id => ids.has(id));
  if (p.escala === 'lin' || p.escala === 'log') r.escala = p.escala;
  if ('resaltar' in p) r.resaltar = ids.has(p.resaltar) ? p.resaltar : null;
  if ('ymax' in p) r.ymax = p.ymax ?? null;
  if (typeof p.n === 'number' && Number.isFinite(p.n)) r.n = p.n;
  r.n = limitar(r.n, 0, r.nmax);
  return r;
}

/** Estado nuevo = estado previo + parche. Pura. Estado: {def, nmax, n, ver, escala, resaltar, ymax}. */
export function plegar(s, p) {
  if (p.grafica === undefined) return aplicar(s, p);
  const g = p.grafica, def = crearDef(g), nmax = +g.nmax > 0 ? +g.nmax : 1;
  const base = { def, nmax, n: Math.round(nmax / 3), ver: def.curvas.map(c => c.id), escala: 'lin', resaltar: null, ymax: null };
  return aplicar(aplicar(base, g), p);
}

// Para los bloques `jugar`: los botones mutan una copia plana
export const vista = s => ({ n: s.n, nmax: s.nmax, escala: s.escala, ver: [...s.ver], resaltar: s.resaltar, ymax: s.ymax });
export const conVista = (s, v) => aplicar(s, { n: v.n, zoom: { nmax: v.nmax }, ver: v.ver, escala: v.escala, resaltar: v.resaltar, ymax: v.ymax });
const lang = () => (globalThis.document ? idioma() : 'es');
const L = x => (x && typeof x === 'object' ? x[lang()] : x) ?? '';
export function ctx(s) {
  const por = new Map(s.def.curvas.map(c => [c.id, c])), f = (id, n) => (por.has(id) ? valor(por.get(id), n) : NaN);
  return {
    curvas: s.def.curvas, f, fmt: v => formatear(v, lang()), nombre: id => L(por.get(id)?.nombre ?? id),
    valores: n => Object.fromEntries(s.def.curvas.map(c => [c.id, f(c.id, n)])),
  };
}

// ── Escena (DOM) ────────────────────────────────────────────────────────────
// Geometría lógica fija: W×H; la columna visible mide ~650 px y guia.js escala el stage.
const W = 640, ML = 54, MR = 104, PW = W - ML - MR, MT = 28, PH = 286, AB = 34, SH = MT + PH + AB;
const LEG = 30, SLIDER = 34, TABLA_H = 24 + 4 * 22 + 8;
const NS = 'http://www.w3.org/2000/svg', ATENUADA = 0.2;
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const salida = t => 1 - (1 - t) ** 3;
const UI = {
  es: { coste: 'coste', n: 'Tamaño de entrada n', graf: 'Gráfica de coste', cada: 'Operaciones según n', fuera: 'fuera de la gráfica' },
  en: { coste: 'cost', n: 'Input size n', graf: 'Cost chart', cada: 'Operations by n', fuera: 'off the chart' },
};
const CSS = `
.gf { font-family: var(--ui); }
.gf svg { position: absolute; left: 0; overflow: visible; }
.gf svg text { font: 11px var(--ui); fill: var(--muted); }
.gf .grid { stroke: var(--line); stroke-width: 1; }
.gf .eje { stroke: var(--line2); stroke-width: 1; }
.gf .cv path { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.gf .cv.res path { stroke-width: 3.2; }
.gf .mk { stroke: var(--muted); stroke-width: 1; }
.gf .dot { stroke: var(--island); stroke-width: 2; }
.gf .chip rect { fill: var(--g-activo); }
.gf .chip text { fill: var(--backdrop); font-weight: 600; text-anchor: middle; }
.gf .et text { fill: var(--text); }
.gf .et .ld { fill: none; stroke-width: 1; opacity: .7; }
.gf .et .ky { stroke-width: 2; stroke-linecap: round; }
.gf .pn .bg { fill: var(--island); fill-opacity: .92; stroke: var(--line2); }
.gf .pn .hd { fill: var(--text); font-weight: 600; }
.gf .pn .vl { fill: var(--text); text-anchor: end; }
.gf .hit { fill: transparent; pointer-events: all; touch-action: none; cursor: ew-resize; }
.gf .hit.pasivo { cursor: crosshair; }
.gf .leg { position: absolute; left: ${ML}px; right: 12px; top: 0; height: ${LEG}px; display: flex; align-items: center; gap: 16px; font: 12px var(--ui); color: var(--text); white-space: nowrap; }
.gf .leg .it { display: flex; align-items: center; gap: 6px; transition: opacity .25s; }
.gf .leg .it.dim, .gf .tabla th.dim { opacity: .4; }
.gf .leg .k, .gf .tabla .k { flex: none; display: inline-block; width: 14px; height: 0; border-top: 3px solid; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
.gf .leg .k { margin: 0; }
.gf .tabla .k { width: 10px; margin-right: 4px; }
.gf .desl { position: absolute; left: ${ML}px; width: ${PW}px; height: 28px; margin: 0; accent-color: var(--g-activo); cursor: pointer; }
.gf .tabla { position: absolute; left: 12px; width: ${W - 24}px; border-collapse: collapse; table-layout: fixed; font: 12px var(--ui); color: var(--muted); }
.gf .tabla th, .gf .tabla td { height: 22px; padding: 0 4px; text-align: right; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; font-weight: 400; }
.gf .tabla thead th { height: 24px; color: var(--text); font-size: 11px; font-weight: 600; transition: opacity .25s; }
.gf .tabla th:first-child { width: 48px; text-align: left; }
.gf .tabla tr.act td, .gf .tabla tr.act th { color: var(--text); background: var(--cell); }
.gf .tabla tr.act th { color: var(--g-activo); font-weight: 600; }
@media (prefers-reduced-motion: reduce) { .gf * { transition: none !important; animation: none !important; } }
`;
const inyectarCss = () => {
  if (document.getElementById('css-grafica')) return;
  const s = document.createElement('style'); s.id = 'css-grafica'; s.textContent = CSS; document.head.append(s);
};
const nodo = (tag, cls, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  if (cls) e.setAttribute('class', cls);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const html = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const mover = (e, x, y) => e.setAttribute('transform', `translate(${+x.toFixed(2)},${+y.toFixed(2)})`);
const copia = o => ({ ...o, op: { ...o.op }, tr: { ...o.tr } });
const ocultar = (e, oculto) => e.setAttribute('display', oculto ? 'none' : 'inline');
const iguales = (a, b) => ['n', 'nmax', 'k', 'yl', 'lg'].every(p => a[p] === b[p]) && Object.keys(b.op).every(id => a.op[id] === b.op[id] && a.tr[id] === b.tr[id]);
const hitos = nmax => [...new Set([nmax / 4, nmax / 2, nmax].map(x => Math.max(1, Math.round(x))))];

export const crear = stage => new Grafica(stage);

export class Grafica {
  constructor(stage) {
    this.stage = stage; stage.classList.add('gf');
    this.def = null; this.cur = null; this.obj = null; this.tw = null; this.raf = 0; this.cb = null;
    this.W = W; this.H = 400; this.cache = new Map(); this.sKey = this.tKey = '';
    this.reducido = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  get tam() { return { W: this.W, H: this.H }; }

  // (Re)construye todo el DOM al abrirse una escena nueva; los parches posteriores solo cambian atributos.
  fijar(def) {
    if (def === this.def) return;
    cancelAnimationFrame(this.raf);
    inyectarCss();
    this.def = def; this.cur = this.obj = this.tw = null; this.cache.clear(); this.sKey = this.tKey = ''; this.A = this.B = null; this.fil = this.filaAct = null; this.vis = [];
    this.uid = (Grafica.n = (Grafica.n || 0) + 1);
    const y0 = def.tabla ? 4 : LEG, ySl = y0 + SH, yTab = ySl + (def.deslizador ? SLIDER : 4);
    this.H = yTab + (def.tabla ? TABLA_H : 0) + 6;
    this.stage.replaceChildren();
    // Leyenda (sin tabla) / tabla / deslizador: HTML
    this.leg = html('div', 'leg'); if (!def.tabla) this.stage.append(this.leg);
    const svg = this.svg = nodo('svg', '', { width: W, height: SH, viewBox: `0 0 ${W} ${SH}`, role: 'img' });
    svg.style.top = y0 + 'px';
    const plot = nodo('g', '', { transform: `translate(${ML},${MT})` });
    const clip = nodo('clipPath', '', { id: `gcl${this.uid}` }); clip.append(nodo('rect', '', { x: 0, y: 0, width: PW, height: PH }));
    const defsEl = nodo('defs'); defsEl.append(clip);
    this.ejes = nodo('g');
    this.ejes.append(nodo('line', 'eje', { x1: 0, y1: PH, x2: PW, y2: PH }), nodo('line', 'eje', { x1: 0, y1: 0, x2: 0, y2: PH }));
    this.tit = nodo('text', '', { x: -8, y: -12, 'text-anchor': 'end' });
    this.ejeN = nodo('text', '', { x: PW + 8, y: PH + 4 }); this.ejeN.textContent = 'n';
    this.capaT = nodo('g'); // conjuntos de ticks (A actual, B saliente)
    this.ejes.append(this.capaT, this.tit, this.ejeN);
    const gc = nodo('g', '', { 'clip-path': `url(#gcl${this.uid})` });
    this.curvas = def.curvas.map(c => {
      const cv = nodo('g', 'cv'), path = nodo('path', '', { stroke: c.color, pathLength: 1 }); cv.append(path);
      const er = nodo('g', 'et'), ky = nodo('line', 'ky', { stroke: c.color }), ldr = nodo('path', 'ld', { stroke: c.color }), tx = nodo('text', '', { x: PW + 24, dy: '.35em' });
      er.append(ldr, ky, tx);
      const ea = nodo('g', 'et'), tri = nodo('path', '', { fill: c.color }), lda = nodo('path', 'ld', { stroke: c.color }), ta = nodo('text', '', { 'text-anchor': 'middle', dy: '.35em' });
      ea.append(lda, tri, ta);
      const dot = nodo('circle', 'dot', { r: 4.5, fill: c.color });
      gc.append(cv);
      return { cv, path, er, ky, ldr, tx, ea, tri, lda, ta, dot };
    });
    this.mk = nodo('line', 'mk', { y1: 0, y2: PH });
    this.chip = nodo('g', 'chip'); this.chipR = nodo('rect', '', { y: 3, height: 18, rx: 4 }); this.chipT = nodo('text', '', { y: 16 });
    this.chip.append(this.chipR, this.chipT);
    const marca = nodo('g'); marca.append(this.mk, ...this.curvas.map(o => o.dot), this.chip);
    const etq = nodo('g'); etq.append(...this.curvas.flatMap(o => [o.er, o.ea]));
    this.pn = nodo('g', 'pn', { transform: 'translate(10,8)', 'pointer-events': 'none' }); if (def.tabla) ocultar(this.pn, true);
    this.hit = nodo('rect', 'hit', { x: -8, y: -4, width: PW + 16, height: PH + 8 });
    plot.append(this.ejes, gc, marca, etq, this.pn, this.hit);
    svg.append(defsEl, plot); this.stage.append(svg);
    if (def.deslizador) {
      const s = this.slider = html('input', 'desl'); s.type = 'range'; s.min = 0; s.max = 1; s.step = 1; s.style.top = ySl + 'px';
      s.addEventListener('input', () => this.entrada(+s.value, true));
      this.stage.append(s);
    } else this.slider = null;
    if (def.tabla) { this.tabla = html('table', 'tabla'); this.tabla.style.top = yTab + 'px'; this.stage.append(this.tabla); } else this.tabla = null;
    // Puntero: hover (ratón) y arrastre mueven n. Táctil: touch-action:none en .hit + captura del puntero.
    this.arr = false; this.arrastre(null);
    this.hit.addEventListener('pointerdown', e => { e.preventDefault(); this.hit.setPointerCapture(e.pointerId); this.arr = true; this.punto(e); });
    this.hit.addEventListener('pointermove', e => { if (this.arr || e.pointerType === 'mouse') this.punto(e); });
    const fin = e => { this.arr = false; if (this.hit.hasPointerCapture(e.pointerId)) this.hit.releasePointerCapture(e.pointerId); };
    this.hit.addEventListener('pointerup', fin); this.hit.addEventListener('pointercancel', fin);
    this.hit.addEventListener('pointerleave', e => { // vista previa de ratón: al salir vuelve al n del estado
      if (!this.arr && e.pointerType === 'mouse' && !this.cb && this.obj) this.tween({ ...copia(this.obj) }, 200);
    });
  }

  /** Activa (ids truthy) o desactiva (null) el arrastre hacia el estado: cb(n) en cada movimiento del puntero o del deslizador. */
  arrastre(ids, cb) { this.cb = ids ? cb : null; this.hit?.classList.toggle('pasivo', !this.cb); }

  // n llega de un puntero o del deslizador: se aplica ya (sin transición) y, si hay arrastre, se notifica
  punto(e) {
    if (!this.cur) return;
    const r = this.svg.getBoundingClientRect();
    this.entrada(nDesdeX((e.clientX - r.left) / (r.width / W) - ML, PW, this.cur.nmax), false);
  }
  entrada(n, persistente) {
    if (!this.cur || (n === this.cur.n && !this.tw)) return;
    this.cur.n = n; if (this.tw) this.tw.from.n = this.tw.to.n = n;
    if (persistente && this.obj) this.obj.n = n; // el deslizador cambia el n «de base»; el hover de ratón es transitorio
    this.dibujar();
    if (this.cb) this.cb(n);
    else if (!this.tw) this.etiquetaAria();
  }

  /** S = estado de plegar + `hl` (ignorado); animar = false | true | ms. */
  pintar(S, animar = true) {
    const dur = animar === true ? 520 : +animar || 0, anim = dur > 0 && !this.reducido();
    const D = this.def, idi = lang(), dom = dominioY(D.curvas, S.nmax, S.ymax);
    const to = { n: S.n, nmax: S.nmax, k: S.escala === 'log' ? 1 : 0, yl: dom.lin[1], lg: Math.log10(dom.log[1]), op: {}, tr: {} };
    if (!this.cur) this.cur = { ...copia(to), op: Object.fromEntries(D.curvas.map(c => [c.id, 0])), tr: Object.fromEntries(D.curvas.map(c => [c.id, 0])) };
    for (const c of D.curvas) {
      const v = S.ver.includes(c.id);
      to.op[c.id] = !v ? 0 : S.resaltar && S.resaltar !== c.id ? ATENUADA : 1;
      if (v && this.cur.op[c.id] < .05) this.cur.tr[c.id] = anim ? 0 : 1; // entra: el trazo se dibuja
      to.tr[c.id] = v ? 1 : this.cur.tr[c.id];
    }
    this.S = S; this.obj = to;
    this.estructura(S, dom, idi, anim);
    this.tween(copia(to), anim ? dur : 0);
  }

  // Leyenda/tabla/panel/etiquetas dependientes del conjunto visible, el idioma y los ticks (no cambian cada frame)
  estructura(S, dom, idi, anim) {
    const D = this.def, u = UI[idi], vis = D.curvas.filter(c => S.ver.includes(c.id));
    this.vis = vis;
    this.svg.setAttribute('aria-label', u.graf);
    this.tit.textContent = u.coste;
    this.curvas.forEach((o, i) => { const t = L(D.curvas[i].nombre); o.tx.textContent = o.ta.textContent = t; o.w = t.length * 6.7; o.cv.classList.toggle('res', S.resaltar === D.curvas[i].id); });
    if (this.slider) { this.slider.max = Math.floor(S.nmax); this.slider.setAttribute('aria-label', u.n); }
    const key = [idi, vis.map(c => c.id), D.tabla ? S.nmax : ''].join('|');
    if (key !== this.sKey) { this.sKey = key; this.listas(vis, S, idi); }
    vis.forEach((c, j) => {
      const dim = !!S.resaltar && S.resaltar !== c.id;
      this.leg.children[j]?.classList.toggle('dim', dim);
      this.tabla?.tHead.rows[0].cells[j + 1]?.classList.toggle('dim', dim);
    });
    // Ticks: si cambia el dominio objetivo, el conjunto anterior se desvanece y entra el nuevo
    const spec = { xs: ticks125(0, S.nmax, 6).filter(Number.isInteger), ys: S.escala === 'log' ? ticksLog(LOGLO, dom.log[1]) : ticks125(0, dom.lin[1], 5), log: S.escala === 'log' };
    const tk = JSON.stringify([spec.ys, spec.xs, spec.log]);
    if (tk !== this.tKey) {
      const primero = !this.tKey; this.tKey = tk;
      const ant = this.A; this.A = this.ticks(spec); this.capaT.append(this.A.g);
      if (ant) { this.B?.g.remove(); this.B = ant; if (anim) { ant.g.animate({ opacity: [1, 0] }, { duration: 300, fill: 'forwards' }).onfinish = () => { if (this.B === ant) { ant.g.remove(); this.B = null; } }; } else { ant.g.remove(); this.B = null; } }
      if (anim && !primero) this.A.g.animate({ opacity: [0, 1] }, { duration: 300 });
    }
  }

  ticks(spec) {
    const g = nodo('g'), ys = spec.ys.map(v => { const t = nodo('g'), l = nodo('line', 'grid', { x1: 0, x2: PW }), tx = nodo('text', '', { x: -8, 'text-anchor': 'end', dy: '.32em' }); tx.textContent = formatear(v, lang()); t.append(l, tx); g.append(t); return { t, v }; });
    const xs = spec.xs.map(v => { const t = nodo('g'), l = nodo('line', 'grid', { y1: 0, y2: PH }), tx = nodo('text', '', { y: PH + 16, 'text-anchor': 'middle' }); tx.textContent = String(v); t.append(l, tx); g.append(t); return { t, v }; });
    return { g, ys, xs };
  }

  listas(vis, S, idi) {
    const D = this.def, u = UI[idi], nom = c => L(c.nombre);
    // Leyenda (solo sin tabla)
    this.leg.replaceChildren(...vis.map(c => { const it = html('span', 'it'), k = html('i', 'k'); k.style.borderTopColor = c.color; it.append(k, nom(c)); return it; }));
    // Panel de lectura en la gráfica (solo sin tabla): encabezado «n = …» y una fila por curva visible
    const pn = this.pn; pn.replaceChildren();
    if (!D.tabla) {
      const bg = nodo('rect', 'bg', { width: 160, height: 28 + vis.length * 16, rx: 6 }), hd = nodo('text', 'hd', { x: 10, y: 17 });
      pn.append(bg, hd);
      this.fil = vis.map((c, i) => {
        const y = 36 + i * 16, ky = nodo('line', 'ky', { x1: 10, x2: 22, y1: y - 4, y2: y - 4, stroke: c.color, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
        const n = nodo('text', '', { x: 28, y }), v = nodo('text', 'vl', { x: 150, y });
        n.textContent = nom(c); pn.append(ky, n, v); return { c, v };
      });
      this.hd = hd; ocultar(pn, !vis.length);
    }
    // Tabla: n actual (en vivo) + hitos
    if (D.tabla) {
      const t = this.tabla, hs = hitos(S.nmax);
      t.replaceChildren(); t.setAttribute('aria-label', u.cada);
      const cab = t.createTHead().insertRow(); cab.append(html('th', '', 'n'));
      for (const c of vis) { const th = html('th'), k = html('i', 'k'); k.style.borderTopColor = c.color; th.append(k, nom(c)); cab.append(th); }
      const cu = t.createTBody();
      const fila = (n, cls) => { const r = cu.insertRow(); if (cls) r.className = cls; const h = html('th', '', String(n)); r.append(h); const cs = vis.map(c => { const td = html('td', '', formatear(valor(c, n), idi)); r.append(td); return { c, td }; }); return { r, h, cs }; };
      this.filaAct = fila(Math.round(this.cur?.n ?? S.n), 'act');
      for (const h of hs) fila(h);
    }
  }

  // ── Animación: un único rAF interpola n, dominio, escala y opacidad/trazo de cada curva ──
  tween(to, dur) {
    cancelAnimationFrame(this.raf);
    if (!dur || iguales(this.cur, to)) { this.cur = to; this.tw = null; this.dibujar(); this.etiquetaAria(); return; }
    this.tw = { t0: performance.now(), dur, from: copia(this.cur), to };
    this.frame(this.tw.t0);
  }
  frame = now => {
    const T = this.tw, k = Math.min(1, (now - T.t0) / T.dur), e = ease(k), s = salida(k), c = this.cur, a = T.from, b = T.to;
    for (const p of ['n', 'nmax', 'k', 'yl', 'lg']) c[p] = a[p] + (b[p] - a[p]) * e;
    for (const id in b.op) { c.op[id] = a.op[id] + (b.op[id] - a.op[id]) * e; c.tr[id] = a.tr[id] + (b.tr[id] - a.tr[id]) * s; }
    this.dibujar();
    if (k < 1) this.raf = requestAnimationFrame(this.frame); else { this.tw = null; this.etiquetaAria(); }
  };

  muestras(i, nmax) {
    let m = this.cache.get(i);
    if (!m || m.nmax !== nmax) { m = { nmax, ...muestrear(x => valor(this.def.curvas[i], x), nmax) }; this.cache.set(i, m); }
    return m;
  }

  // Pinta el estado interpolado `cur` (n, dominio, escala, opacidades): solo toca atributos, sin medir el DOM
  dibujar() {
    const c = this.cur, D = this.def, nmax = c.nmax, idi = lang();
    const sl = crearEscala('lin', [0, c.yl], [PH, 0]), sg = crearEscala('log', [LOGLO, 10 ** c.lg], [PH, 0]);
    const py = escalaMezcla(sl, sg, c.k, PH), px = x => x / nmax * PW, nr = Math.round(c.n), xn = px(c.n);
    // ticks (siguen a la curva: se recolocan con la escala interpolada)
    for (const set of [this.A, this.B]) if (set) {
      for (const { t, v } of set.ys) { const y = py(v); ocultar(t, !(y >= -.5 && y <= PH + .5)); if (y === y) mover(t, 0, y); }
      for (const { t, v } of set.xs) { const x = px(v); ocultar(t, x > PW + .5); mover(t, x, 0); }
    }
    const der = [], top = [];
    this.curvas.forEach((o, i) => {
      const cu = D.curvas[i], op = c.op[cu.id], tr = c.tr[cu.id], vis = op > .004;
      for (const e of [o.cv, o.er, o.ea, o.dot]) ocultar(e, !vis);
      if (!vis) return;
      const m = this.muestras(i, nmax), cam = camino(m.xs, m.vs, px, py, PH), fl = op * limitar((tr - .7) / .3, 0, 1);
      o.path.setAttribute('d', cam.d); o.path.setAttribute('stroke-dasharray', tr >= .999 ? 'none' : '1 1'); o.path.setAttribute('stroke-dashoffset', 1 - tr);
      o.cv.style.opacity = op; o.er.style.opacity = o.ea.style.opacity = o.dot.style.opacity = fl;
      ocultar(o.er, !cam.fin); ocultar(o.ea, !cam.arriba);
      if (cam.fin) der.push({ o, y: cam.fin.y });
      else if (cam.arriba) top.push({ o, x: cam.arriba.x });
      // punto en n (oculto si queda fuera del área: la curva está recortada)
      const y = py(valor(cu, c.n));
      ocultar(o.dot, !(y >= 0 && y <= PH)); if (y === y) { o.dot.setAttribute('cx', +xn.toFixed(2)); o.dot.setAttribute('cy', +limitar(y, -1, PH + 1).toFixed(2)); }
    });
    // etiquetas directas: a la derecha con anticolisión y guía; las recortadas, sobre el borde con ▲
    const ys = separar(der.map(d => d.y), 14, 6, PH);
    der.forEach(({ o, y }, j) => {
      const ly = ys[j]; o.ky.setAttribute('x1', PW + 6); o.ky.setAttribute('x2', PW + 18); o.ky.setAttribute('y1', ly); o.ky.setAttribute('y2', ly);
      o.tx.setAttribute('y', ly); o.ldr.setAttribute('d', Math.abs(ly - y) > 2 ? `M${PW} ${y.toFixed(1)}L${PW + 6} ${ly.toFixed(1)}` : '');
    });
    const gap = Math.max(40, ...top.map(t => t.o.w)) + 14, xs = separar(top.map(t => t.x), gap, gap / 2, PW + MR - gap / 2);
    top.forEach(({ o, x }, j) => {
      const lx = xs[j]; o.tri.setAttribute('d', `M${(x - 5).toFixed(1)} -2L${(x + 5).toFixed(1)} -2L${x.toFixed(1)} -10z`);
      o.ta.setAttribute('x', lx.toFixed(1)); o.ta.setAttribute('y', -19);
      o.lda.setAttribute('d', Math.abs(lx - x) > 4 ? `M${x.toFixed(1)} -10L${lx.toFixed(1)} -15` : '');
    });
    // marcador de n
    this.mk.setAttribute('x1', xn); this.mk.setAttribute('x2', xn);
    const txt = `n = ${nr}`, wc = txt.length * 6.8 + 14;
    this.chipT.textContent = txt; this.chipR.setAttribute('width', wc); this.chipR.setAttribute('x', -wc / 2); mover(this.chip, limitar(xn, wc / 2, PW - wc / 2), PH);
    // lectura: panel en la gráfica o tabla
    if (this.fil) { this.hd.textContent = txt; for (const { c: cu, v } of this.fil) v.textContent = formatear(valor(cu, nr), idi); }
    if (this.filaAct) {
      this.filaAct.h.textContent = String(nr);
      for (const { c: cu, td } of this.filaAct.cs) td.textContent = formatear(valor(cu, nr), idi);
    }
    if (this.slider && +this.slider.value !== nr) this.slider.value = nr;
  }

  // Texto accesible: valores al terminar cada movimiento (no en cada frame)
  etiquetaAria() {
    const c = this.cur, idi = lang(), nr = Math.round(c.n), u = UI[idi];
    const l = (this.vis || []).map(cu => `${L(cu.nombre)} = ${formatear(valor(cu, nr), idi)}`).join('; ');
    this.svg.setAttribute('aria-label', `${u.graf}. n = ${nr}${l ? ': ' + l : ''}`);
    this.slider?.setAttribute('aria-valuetext', `n = ${nr}`);
  }
}
