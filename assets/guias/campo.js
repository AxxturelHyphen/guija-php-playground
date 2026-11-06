// Escena «campo»: funciones de dos variables z = f(x, y) para Cálculo multivariable. Dibuja en <canvas> (rendimiento):
// modo 'nivel' = mapa de color + curvas de nivel (marching squares); modo 'superficie' = malla en proyección ortográfica,
// rotable arrastrando. Las capas (punto, gradiente, corte, campo vectorial, restricción, región, camino…) leen PARÁMETROS
// que se mueven arrastrando o con deslizadores nativos. Contrato de escena de guia.js: clave, plegar (pura), crear (+ vista/conVista/ctx).
// El fondo (mapa, contornos, barra de color) se calcula UNA vez por apertura y se cachea en canvas; al mover solo se repintan las capas.
//
// SUPERFICIE = WebGL propio (campo-gl.js, import perezoso solo si un paso usa 'superficie'; sin librerías): malla con normales, luz
// lambert + ambiente, caja y ejes con rótulos KaTeX en HTML. Render bajo demanda (un único trabajo por fotograma, movimiento.js).
// Las capas se reproyectan con la misma cámara sobre el canvas 2D transparente. Sin WebGL o con el contexto perdido, cae al canvas 2D.
// Entrada: órbita con arrastre + inercia (Muelle) y con flechas; en modo nivel, lectura (x, y, z) al pasar el puntero y arrastre suave.
// Una capa `texto` con `$…$` se renderiza con KaTeX en HTML; las etiquetas de los deslizadores también admiten `$…$`.
//
// FORMATO. Un paso ABRE la escena con:
//   campo: {
//     f: (x, y) => z            x: [a,b], y: [c,d]       ventana       z?: [zmin,zmax]  (def. automático)
//     modo?: 'nivel' | 'superficie' (def. 'nivel')       niveles?: número de curvas de nivel (def. 9) o [valores]
//     par?: { x0: 1, y0: 1, … }  parámetros (números). En superficie existen además rot (acimut, rad) y elev (elevación, rad)
//     arrastrar?: ['x0','y0']    en modo nivel, parámetros que mueve el puntero (coordenadas x e y)
//     deslizadores?: [{ par, min, max, paso?, es, en, dec? }]      etiqueta?: {es,en}      capas?: [capa…]
//   }
// PARCHES acumulativos: par: {…} · capas: […] (reemplaza) · modo: 'nivel' | 'superficie'.
// CAPAS (`tipo`), números = valor o NOMBRE de parámetro:
//   punto {x,y}   gradiente {x,y,k?}   corte {eje:'x'|'y', v}   campo {F: (x,y)=>[u,v] | grad:true, n?}   (campo solo en 'nivel')
//   restriccion {g, c}   region {x:[a,b], y:[c,d], n?}   camino {x: t=>, y: t=>, t:[a,b], hasta?}   texto {x,y,s}
// `jugar`: vista plana {…par}; ctx = {f(x,y), grad(x,y), integral(a,b,c,d,n) (suma de Riemann doble), fmt, par}.
// La lógica pura (rampa, malla, contornos, proyección, gradiente, plegar) no toca el DOM al importar (tests/guias/test-campo.js).
import { idioma } from './idioma.js';
import { ticks125, formatear } from './grafica.js';
import { etiqueta } from './mates.js';
import { tarea, Muelle, ease } from './movimiento.js';

export const clave = 'campo';

// ── Lógica pura ─────────────────────────────────────────────────────────────
export const lim = (x, a, b) => Math.min(b, Math.max(a, x));
export const num = (v, par) => (typeof v === 'string' ? par[v] : v);
export const NG = 72; // celdas por lado del muestreo (mapa y contornos); la malla de superficie usa 1 de cada 2

/** Elevación de la cámara acotada: ni desde abajo (< 0,1 rad) ni el polo exacto (> 1,45 rad). */
export const limitarElev = e => lim(e, .1, 1.45);

export function evalF(f, x, y) { try { const z = f(x, y); return typeof z === 'number' ? z : NaN; } catch { return NaN; } }

// Rampa secuencial de 5 paradas (azul oscuro → verde azulado → amarillo), legible sobre fondo oscuro y apta para daltonismo
const PARADAS = [[43, 47, 107], [47, 111, 154], [31, 161, 135], [126, 208, 123], [242, 230, 107]];
export function rampa(t) {
  t = lim(Number.isFinite(t) ? t : 0, 0, 1) * (PARADAS.length - 1);
  const i = Math.min(PARADAS.length - 2, Math.floor(t)), k = t - i, a = PARADAS[i], b = PARADAS[i + 1];
  return [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
}

/** Valores de f en la malla (N+1)² (fila = y, columna = x), y su rango finito. */
export function malla(f, [x0, x1], [y0, y1], N = NG) {
  const z = new Float64Array((N + 1) * (N + 1)); let mn = Infinity, mx = -Infinity;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const v = evalF(f, x0 + (x1 - x0) * i / N, y0 + (y1 - y0) * j / N); z[j * (N + 1) + i] = v;
    if (Number.isFinite(v)) { if (v < mn) mn = v; if (v > mx) mx = v; }
  }
  if (!(mx > mn)) { mn = Number.isFinite(mn) ? mn - 1 : 0; mx = Number.isFinite(mx) ? mx + 1 : 1; }
  return { z, N, mn, mx };
}

/** Rectángulo {x,y,w,h} dentro de pw×ph con la misma proporción que la ventana [x0,x1,y0,y1] (centrado). */
export function ajustar(win, pw, ph) {
  const ar = (win[1] - win[0]) / (win[3] - win[2]), ancho = ar > pw / ph, w = ancho ? pw : ph * ar, h = ancho ? pw / ar : ph;
  return { w, h, x: (pw - w) / 2, y: (ph - h) / 2 };
}

/** Valores «bonitos» de curvas de nivel entre mn y mx (1-2-5) con como mucho k curvas. */
export function niveles(mn, mx, k = 9) { return ticks125(mn, mx, k).filter(v => v > mn && v < mx); }

const TABLA = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[0, 1], [2, 3]], [[0, 2]], [[3, 2]], [[3, 2]], [[0, 2]], [[3, 0], [1, 2]], [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], []];
/** Marching squares: segmentos [x1,y1,x2,y2,…] en coordenadas de datos para el valor `nivel`. */
export function contorno(M, [x0, x1], [y0, y1], nivel) {
  const { z, N } = M, out = [], W = N + 1, dx = (x1 - x0) / N, dy = (y1 - y0) / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = z[j * W + i], b = z[j * W + i + 1], c = z[(j + 1) * W + i + 1], d = z[(j + 1) * W + i];
    if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
    const caso = (a > nivel ? 1 : 0) | (b > nivel ? 2 : 0) | (c > nivel ? 4 : 0) | (d > nivel ? 8 : 0), xi = x0 + i * dx, yj = y0 + j * dy;
    for (const par of TABLA[caso]) {
      const p = par.map(e => {
        if (e === 0) return [xi + dx * (nivel - a) / (b - a), yj];
        if (e === 1) return [xi + dx, yj + dy * (nivel - b) / (c - b)];
        if (e === 2) return [xi + dx + (-dx) * (nivel - c) / (d - c), yj + dy];
        return [xi, yj + dy + (-dy) * (nivel - d) / (a - d)];
      });
      out.push(p[0][0], p[0][1], p[1][0], p[1][1]);
    }
  }
  return out;
}

/** Punto [x,y] (datos) donde rotular una curva de nivel: segmento más cercano a la diagonal de la ventana y lejos del borde. */
export function etiquetaDe(segs, [x0, x1], [y0, y1]) {
  let mejor = null, mp = Infinity;
  for (let i = 0; i < segs.length; i += 4) {
    const mx = (segs[i] + segs[i + 2]) / 2, my = (segs[i + 1] + segs[i + 3]) / 2, nx = (mx - (x0 + x1) / 2) / ((x1 - x0) / 2), ny = (my - (y0 + y1) / 2) / ((y1 - y0) / 2);
    const p = Math.abs(nx - ny) + (Math.abs(nx) > .9 || Math.abs(ny) > .9 ? 10 : 0);
    if (p < mp) { mp = p; mejor = [mx, my]; }
  }
  return mejor;
}

/** Gradiente numérico (derivadas parciales centradas). */
export function gradiente(f, x, y) {
  const h = 1e-5 * Math.max(1, Math.abs(x), Math.abs(y));
  return [(evalF(f, x + h, y) - evalF(f, x - h, y)) / (2 * h), (evalF(f, x, y + h) - evalF(f, x, y - h)) / (2 * h)];
}

/** Suma de Riemann doble (punto medio) en [a,b]×[c,d] con n×n celdas. */
export function integralDoble(f, a, b, c, d, n) {
  n = Math.max(1, Math.round(n)); const hx = (b - a) / n, hy = (d - c) / n; let s = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += evalF(f, a + (i + .5) * hx, c + (j + .5) * hy);
  return s * hx * hy;
}

/** Proyección ortográfica de un punto normalizado (nx, ny ∈ [-1,1], nz) con acimut rot y elevación elev → {sx, sy (arriba +), prof (mayor = más lejos)}. */
export function proyectar(nx, ny, nz, rot, elev) {
  const c = Math.cos(rot), s = Math.sin(rot), xr = nx * c - ny * s, yr = nx * s + ny * c;
  return { sx: xr, sy: nz * Math.cos(elev) + yr * Math.sin(elev), prof: yr * Math.cos(elev) - nz * Math.sin(elev) };
}

// ── Estado: plegar (pura) ───────────────────────────────────────────────────
const defs = new WeakMap();
function crearDef(g) {
  if (!defs.has(g)) defs.set(g, { f: g.f, x: g.x, y: g.y, z: g.z ?? null, niveles: g.niveles ?? 9, arrastrar: g.arrastrar ?? null, deslizadores: g.deslizadores ?? [], etiqueta: g.etiqueta ?? null });
  return defs.get(g);
}
function aplicar(s, p) {
  const r = { ...s };
  if (p.par) r.par = { ...r.par, ...p.par };
  if (Array.isArray(p.capas)) r.capas = p.capas;
  if (p.modo === 'nivel' || p.modo === 'superficie') r.modo = p.modo;
  return r;
}
/** Estado nuevo = previo + parche. Pura. Estado: {def, par, capas, modo}. */
export function plegar(s, p) {
  if (p.campo === undefined) return aplicar(s, p);
  const g = p.campo, def = crearDef(g);
  return aplicar({ def, par: { rot: .75, elev: .6, ...(g.par ?? {}) }, capas: g.capas ?? [], modo: g.modo ?? 'nivel' }, p);
}
export const vista = s => ({ ...s.par });
export const conVista = (s, v) => aplicar(s, { par: { ...v } });
const lang = () => (globalThis.document ? idioma() : 'es');
const L = x => (x && typeof x === 'object' ? x[lang()] : x) ?? '';
export function ctx(s) {
  const f = s.def.f;
  return { par: s.par, fmt: v => formatear(v, lang()), f: (x, y) => evalF(f, x, y), grad: (x, y) => gradiente(f, x, y).map(v => (Math.abs(v) < 1e-7 ? 0 : v)), integral: (a, b, c, d, n) => integralDoble(f, a, b, c, d, n) };
}

// ── Escena (DOM + canvas + WebGL) ───────────────────────────────────────────
const W = 640, ML = 46, PW = 480, MT = 12, PH = 340, AB = 26, SH = MT + PH + AB, FILA = 34, CB = ML + PW + 22;
export const TAM = { W, H: SH }; // tamaño lógico base de la escena (sin deslizadores): lo comparte campo-gl.js
export const ZS = .75; // semialtura normalizada de la superficie
export const CAM = { cx: ML + PW / 2, cy: MT + PH / 2 + 12, sc: PH * .34 }; // centro y escala de la proyección de la superficie
const MUELLE = { rot: 13, elev: 13 }; // frecuencias (rad/s) del suavizado de la órbita; el resto de parámetros arrastrables usa 26
const UI = {
  es: { graf: 'Superficie z = f(x, y)', arrastra: 'Arrastra o usa las flechas para rotar', teclaRot: 'Flechas: rotar la superficie', teclaPos: 'Flechas: mover el punto' },
  en: { graf: 'Surface z = f(x, y)', arrastra: 'Drag or use the arrow keys to rotate', teclaRot: 'Arrow keys: rotate the surface', teclaPos: 'Arrow keys: move the point' },
};
const CSS = `
.cp { font-family: var(--ui); }
.cp canvas { position: absolute; left: 0; top: 0; touch-action: none; }
.cp canvas.gl { opacity: 0; pointer-events: none; transition: opacity .28s; }
.cp canvas.gl.ver { opacity: 1; }
.cp canvas.cv { border-radius: 4px; }
.cp canvas.cv:focus-visible { outline: 2px solid var(--g-activo); outline-offset: 2px; }
.cp canvas.rot { cursor: grab; } .cp canvas.rot.arr { cursor: grabbing; } .cp canvas.pos { cursor: crosshair; }
.cp .capa-html { position: absolute; left: 0; top: 0; width: ${W}px; height: ${SH}px; pointer-events: none; overflow: hidden; }
.cp .eje-marca, .cp .eje-titulo, .cp .rotulo { position: absolute; left: 0; top: 0; white-space: nowrap; line-height: 1; }
.cp .eje-marca { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.cp .eje-titulo { font-size: 14px; color: var(--text); }
.cp .rotulo { font-size: 14px; font-family: var(--display); font-style: italic; color: var(--text); text-shadow: 0 0 3px var(--island), 0 0 3px var(--island), 0 0 5px var(--island); }
.cp .hov { position: absolute; left: 0; top: 0; visibility: hidden; pointer-events: none; }
.cp .hov .ring { position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.55); }
.cp .hov.arr .ring { display: none; }
.cp .hov .tip { position: absolute; left: 12px; top: 12px; padding: 4px 8px; border-radius: 6px; white-space: nowrap; font-size: 12px; font-variant-numeric: tabular-nums;
  color: var(--text); background: color-mix(in srgb, var(--island) 90%, transparent); border: 1px solid var(--line2); }
.cp .hov .tip i { font-family: var(--display); color: var(--muted); margin: 0 3px 0 6px; } .cp .hov .tip i:first-child { margin-left: 0; }
.cp .hov.izq .tip { left: auto; right: 12px; } .cp .hov.aba .tip { top: auto; bottom: 12px; }
.cp .desl { position: absolute; left: ${ML - 8}px; width: ${PW + 16}px; height: ${FILA}px; display: grid; grid-template-columns: 1fr 70px; align-items: center; column-gap: 10px; font-size: 13px; color: var(--code); }
.cp .desl label { grid-column: 1 / -1; line-height: 1; margin-bottom: -6px; }
.cp .desl input { width: 100%; margin: 0; accent-color: var(--g-activo); cursor: pointer; }
.cp .desl output { font-variant-numeric: tabular-nums; color: var(--text); text-align: right; }
@media (prefers-reduced-motion: reduce) { .cp canvas.gl { transition: none; } }
`;
const inyectarCss = () => {
  if (document.getElementById('css-campo')) return;
  const s = document.createElement('style'); s.id = 'css-campo'; s.textContent = CSS; document.head.append(s);
};
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

// Capas: crear(spec) → dibujar(ctx2d, c) con c = {pt(x,y,z?), lift(x,y), par, f, modo, win, tk, rotulo(texto, x, y)}
const flecha = (g, [ax, ay], [bx, by], col) => {
  g.strokeStyle = g.fillStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  const a = Math.atan2(by - ay, bx - ax); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - 8 * Math.cos(a - .4), by - 8 * Math.sin(a - .4)); g.lineTo(bx - 8 * Math.cos(a + .4), by - 8 * Math.sin(a + .4)); g.closePath(); g.fill();
};
const trazo = (g, pts, col, ancho = 2, dash = []) => {
  g.strokeStyle = col; g.lineWidth = ancho; g.setLineDash(dash); g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
};
const CAPAS = {
  punto: s => (g, c) => { const x = num(s.x, c.par), y = num(s.y, c.par), [px, py] = c.pt(x, y, c.lift(x, y)); g.fillStyle = c.col.activo; g.strokeStyle = c.col.isla; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 5.5, 0, 6.2832); g.fill(); g.stroke(); },
  gradiente: s => (g, c) => {
    const x = num(s.x, c.par), y = num(s.y, c.par), [fx, fy] = gradiente(c.f, x, y), m = Math.hypot(fx, fy); if (!(m > 1e-9)) return;
    const k = (s.k ?? 1) * .16 * (c.win[1] - c.win[0]) * Math.min(1, m / (c.gmax || m)) / m, z = c.lift(x, y);
    flecha(g, c.pt(x, y, z), c.pt(x + fx * k, y + fy * k, z), c.col.hecho);
  },
  corte: s => (g, c) => {
    const v = num(s.v, c.par), pts = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, x = s.eje === 'x' ? v : c.win[0] + (c.win[1] - c.win[0]) * t, y = s.eje === 'x' ? c.win[2] + (c.win[3] - c.win[2]) * t : v; pts.push(c.pt(x, y, c.lift(x, y))); }
    trazo(g, pts, c.col.compara, 2.5);
  },
  campo: s => (g, c) => {
    if (c.modo !== 'nivel') return;
    const n = s.n ?? 9, F = s.F ?? ((x, y) => gradiente(c.f, x, y)); let mx = 0; const flechas = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = c.win[0] + (c.win[1] - c.win[0]) * (i + .5) / n, y = c.win[2] + (c.win[3] - c.win[2]) * (j + .5) / n, v = F(x, y);
      if (Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1])) { flechas.push([x, y, v[0], v[1]]); mx = Math.max(mx, Math.hypot(v[0], v[1])); }
    }
    const k = .8 * (c.win[1] - c.win[0]) / n / (mx || 1);
    for (const [x, y, u, v] of flechas) flecha(g, c.pt(x - u * k / 2, y - v * k / 2), c.pt(x + u * k / 2, y + v * k / 2), c.col.blanco);
  },
  restriccion: s => {
    let key = '', segs = [];
    return (g, c) => {
      const cc = num(s.c, c.par), k = String(cc), M = s.M ??= malla(s.g, c.win.slice(0, 2), c.win.slice(2), 48);
      if (k !== key) { key = k; segs = contorno(M, c.win.slice(0, 2), c.win.slice(2), cc); }
      g.strokeStyle = c.col.mal; g.lineWidth = 2.5; g.beginPath();
      for (let i = 0; i < segs.length; i += 4) {
        const a = c.pt(segs[i], segs[i + 1], c.lift(segs[i], segs[i + 1])), b = c.pt(segs[i + 2], segs[i + 3], c.lift(segs[i + 2], segs[i + 3]));
        g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      }
      g.stroke();
    };
  },
  region: s => (g, c) => {
    const [a, b] = s.x, [d0, d1] = s.y, n = s.n ? Math.round(num(s.n, c.par)) : 0;
    const base = c.modo === 'superficie' ? c.zmin : 0, esq = [[a, d0], [b, d0], [b, d1], [a, d1]].map(([x, y]) => c.pt(x, y, base));
    g.fillStyle = c.col.camino + '33'; g.strokeStyle = c.col.camino; g.lineWidth = 1.5; g.beginPath(); esq.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.stroke();
    if (n) {
      const hx = (b - a) / n, hy = (d1 - d0) / n;
      if (c.modo === 'nivel') { g.lineWidth = 1; g.globalAlpha = .6; for (let i = 1; i < n; i++) { trazo(g, [c.pt(a + i * hx, d0), c.pt(a + i * hx, d1)], c.col.camino, 1); trazo(g, [c.pt(a, d0 + i * hy), c.pt(b, d0 + i * hy)], c.col.camino, 1); } g.globalAlpha = 1; }
      else for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = a + (i + .5) * hx, y = d0 + (j + .5) * hy, z = c.f(x, y); if (!Number.isFinite(z)) continue;
        trazo(g, [c.pt(x, y, c.zmin), c.pt(x, y, z)], c.col.camino, 1.5); g.fillStyle = c.col.camino; const [px, py] = c.pt(x, y, z); g.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
    }
  },
  camino: s => (g, c) => {
    const [t0, t1] = s.t, h = s.hasta === undefined ? t1 : lim(num(s.hasta, c.par), t0, t1), pts = [];
    for (let i = 0; i <= 120; i++) { const t = t0 + (h - t0) * i / 120, x = s.x(t), y = s.y(t); if (Number.isFinite(x) && Number.isFinite(y)) pts.push(c.pt(x, y, c.lift(x, y))); }
    trazo(g, pts, c.col.compara, 3);
  },
  texto: s => (g, c) => {
    const x = num(s.x, c.par), y = num(s.y, c.par), [px, py] = c.pt(x, y, c.lift(x, y)), t = L(s.s);
    if (t.includes('$')) return c.rotulo(t, px + 8, py - 8); // fórmula: KaTeX en HTML sobre el canvas
    g.font = 'italic 400 14px "Source Serif 4", Georgia, serif'; g.fillStyle = c.col.texto; g.textAlign = 'left'; g.lineWidth = 3; g.strokeStyle = c.col.isla; g.strokeText(t, px + 8, py - 8); g.fillText(t, px + 8, py - 8);
  },
};

// Barra de color: 1 × PH píxeles con la rampa (de zmax arriba a zmin abajo); se estira al dibujarla
const barraDeColor = () => {
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = PH; const g = cv.getContext('2d'), im = g.createImageData(1, PH);
  for (let k = 0; k < PH; k++) { const [r, gg, b] = rampa(1 - k / (PH - 1)); im.data.set([r, gg, b, 255], 4 * k); }
  g.putImageData(im, 0, 0); return cv;
};

export const crear = stage => new Campo(stage);

export class Campo {
  constructor(stage) {
    this.stage = stage; stage.classList.add('cp');
    this.def = null; this.cur = this.to = this.tw = null; this.cb = null; this.W = W; this.H = SH;
    this.cancelar = null; this.sucio = false; this.mu = {}; this.gl = this.glcv = this.glMod = this.ejes = this.ro = this.ac = null; this.glEstado = 'no';
    this.reducido = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  get tam() { return { W: this.W, H: this.H }; }
  sup() { return this.modo === 'superficie'; }

  fijar(def) {
    if (def === this.def) return;
    this.cancelar?.(); this.cancelar = null; this.soltarGL(); this.ac?.abort(); inyectarCss();
    this.def = def; this.cur = this.to = this.tw = null; this.capasRef = null; this.fondo = null; this.mu = {}; this.fondos = {}; this.quads = null;
    this.dx = this.dy = 0; this.vrot = this.velev = 0; this.arr = this.suelta = this.hayPtr = this.hov = false; this.rc = null; this.hovVis = false; this.hx = undefined; this.hdentro = false; this.rl = []; this.rlN = 0;
    this.H = SH + def.deslizadores.length * FILA + 6;
    const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    this.col = { activo: v('--g-activo') || '#6BA4FF', compara: v('--g-compara') || '#E0BB65', hecho: v('--g-hecho') || '#5FB865', mal: v('--g-mal') || '#FF6B78', camino: v('--g-camino') || '#2FB6C4', texto: v('--text') || '#DFE1E5', isla: v('--island') || '#1E1F22', muted: v('--muted') || '#9A9EA5', linea: v('--line2') || '#3A3D42', blanco: '#FFFFFFD9' };
    this.stage.replaceChildren();
    this.dpr = Math.min(2, globalThis.devicePixelRatio || 1) * 1.25;
    const cv = this.cv = el('canvas', 'cv'); cv.width = Math.round(W * this.dpr); cv.height = Math.round(SH * this.dpr); cv.style.width = W + 'px'; cv.style.height = SH + 'px';
    cv.setAttribute('role', 'img'); this.g = cv.getContext('2d'); this.stage.append(cv);
    // capas HTML sobre el canvas: rótulos de ejes (solo con WebGL), rótulos de capas con KaTeX y lectura al pasar el puntero
    this.ejesEl = el('div', 'capa-html'); this.ejesEl.style.visibility = 'hidden';
    this.txtEl = el('div', 'capa-html');
    const hov = this.hovEl = el('div', 'hov'), tip = el('div', 'tip'), ring = el('span', 'ring');
    this.hovV = ['x', 'y', 'z'].map(n => { const i = el('i'), b = el('b'); i.textContent = n; b.style.fontWeight = 400; tip.append(i, b); return b; });
    hov.append(ring, tip); this.stage.append(this.ejesEl, this.txtEl, hov);
    this.desl = def.deslizadores.map((d, i) => {
      const row = el('div', 'desl'); row.style.top = SH + 2 + i * FILA + 'px';
      const lab = el('label'), inp = el('input'), out = el('output');
      inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.paso ?? (d.max - d.min) / 200;
      inp.addEventListener('input', () => this.entrada(d.par, +inp.value));
      row.append(lab, inp, out); this.stage.append(row); return { d, lab, inp, out, row };
    });
    // Puntero: modo nivel → mueve (arrastrar[0], arrastrar[1]) y lee (x, y, z); modo superficie → órbita (rot, elev).
    // Los eventos solo anotan; el trabajo se hace UNA vez por fotograma en `tic` (pointermove llega varias veces por fotograma).
    const ac = this.ac = new AbortController();
    addEventListener('scroll', () => { this.rc = null; }, { passive: true, capture: true, signal: ac.signal });
    cv.addEventListener('pointerdown', e => {
      if (e.button > 0) return; e.preventDefault(); cv.setPointerCapture(e.pointerId); this.rc = null;
      this.arr = true; this.ult = [e.clientX, e.clientY]; this.vrot = this.velev = 0; this.suelta = false; cv.classList.add('arr');
      if (!this.sup()) this.apuntar(e);
    });
    cv.addEventListener('pointermove', e => {
      if (this.sup()) { if (this.arr) { this.dx += e.clientX - this.ult[0]; this.dy += e.clientY - this.ult[1]; this.ult[0] = e.clientX; this.ult[1] = e.clientY; this.pedir(); } return; }
      this.apuntar(e);
    });
    const fin = e => {
      if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
      if (!this.arr) return;
      this.arr = false; cv.classList.remove('arr'); this.suelta = this.sup(); if (e.pointerType === 'touch') this.hov = false; this.pedir();
    };
    cv.addEventListener('pointerup', fin); cv.addEventListener('pointercancel', fin);
    cv.addEventListener('pointerleave', () => { if (!this.arr && this.hov) { this.hov = false; this.pedir(false); } });
    cv.addEventListener('keydown', e => this.teclas(e));
  }

  // ── Entrada ───────────────────────────────────────────────────────────────
  apuntar(e) {
    const rc = this.rc ??= this.cv.getBoundingClientRect(), k = rc.width / W || 1;
    this.plx = (e.clientX - rc.left) / k; this.ply = (e.clientY - rc.top) / k; this.hayPtr = true; this.hov = this.arr || e.pointerType !== 'touch'; this.pedir(false);
  }

  objetivo(par) { const m = this.mu[par]; return m ? m.a : this.cur.par[par]; }

  /** Órbita: incrementos de acimut y elevación (rad) sobre el objetivo actual. `dt` > 0 → mide la velocidad para la inercia. */
  orbitar(dr, de, dt) {
    const te = limitarElev(this.objetivo('elev') + de), tr = this.objetivo('rot') + dr;
    if (dt > 0) { this.vrot = .55 * (dr / dt) + .45 * this.vrot; this.velev = .55 * (de / dt) + .45 * this.velev; this.tOrb = performance.now(); }
    this.entrada('rot', tr, true); this.entrada('elev', te, true);
  }

  teclas(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !this.cur) return;
    const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0, dy = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!dx && !dy) return;
    const f = e.shiftKey ? .3 : 1, D = this.def;
    if (this.sup()) { e.preventDefault(); e.stopPropagation(); this.orbitar(dx * .12 * f, dy * .08 * f, 0); }
    else if (D.arrastrar) {
      e.preventDefault(); e.stopPropagation();
      const [x0, x1, y0, y1] = this.win, [px, py] = D.arrastrar, r2 = v => +v.toFixed(2);
      this.entrada(px, r2(lim(this.objetivo(px) + dx * (x1 - x0) / 40 * f, x0, x1)), true); this.entrada(py, r2(lim(this.objetivo(py) + dy * (y1 - y0) / 40 * f, y0, y1)), true);
    }
  }

  arrastre(ids, cb) { this.cb = ids ? cb : null; }

  /** `suave`: el valor mostrado sigue al objetivo con un Muelle (arrastre y teclado); si no, salto directo (deslizadores). */
  entrada(par, v, suave = false) {
    if (!this.cur) return;
    const ex = this.mu[par];
    if ((ex ? ex.a : this.cur.par[par]) === v) return;
    if (this.to) this.to.par[par] = v;
    if (this.tw) this.tw.from.par[par] = this.tw.to.par[par] = v;
    if (suave && !this.reducido()) (this.mu[par] ??= new Muelle(this.cur.par[par], MUELLE[par] ?? 26)).ir(v);
    else { this.cur.par[par] = v; ex?.salto(v); }
    this.cb?.(par, v); this.pedir();
  }

  // ── Planificador: un único trabajo por fotograma (tween + muelles + entrada + hover + dibujo) ──
  pedir(sucio = true) { if (sucio) this.sucio = true; if (!this.cancelar) this.cancelar = tarea(this.tic); }

  tic = (now, dt) => {
    this.flush(dt);
    let vivo = false;
    if (this.tw && this.pasoTween(now)) vivo = true;
    if (this.pasoMuelles(dt)) vivo = true;
    if (this.sucio || vivo) { this.sucio = false; this.dibujar(); }
    this.pintarHover();
    if (!vivo) this.cancelar = null;
    return vivo;
  };

  flush(dt) {
    const D = this.def;
    if (this.dx || this.dy) { const dr = this.dx * .01, de = -this.dy * .008; this.dx = this.dy = 0; this.orbitar(dr, de, dt); }
    if (this.suelta) { // inercia: el objetivo se adelanta lo que el gesto llevaba; el Muelle lo recorre suavemente
      this.suelta = false;
      if (!this.reducido() && performance.now() - (this.tOrb ?? 0) < 90) {
        const T = .24, c = v => lim(v, -9, 9);
        this.entrada('rot', this.objetivo('rot') + c(this.vrot) * T, true); this.entrada('elev', limitarElev(this.objetivo('elev') + c(this.velev) * T), true);
      }
      this.vrot = this.velev = 0;
    }
    if (this.hayPtr) {
      this.hayPtr = false;
      const R = this.R, [x0, x1, y0, y1] = this.win, fx = lim((this.plx - R.x) / R.w, 0, 1), fy = lim((this.ply - R.y) / R.h, 0, 1);
      this.hx = x0 + fx * (x1 - x0); this.hy = y1 - fy * (y1 - y0);
      this.hdentro = this.plx >= R.x && this.plx <= R.x + R.w && this.ply >= R.y && this.ply <= R.y + R.h;
      if (this.arr && D.arrastrar && !this.sup()) { this.entrada(D.arrastrar[0], +this.hx.toFixed(2), true); this.entrada(D.arrastrar[1], +this.hy.toFixed(2), true); }
    }
  }

  pasoTween(now) {
    const T = this.tw, k = lim((now - T.t0) / T.dur, 0, 1), e = ease(k), a = T.from.par, b = T.to.par;
    for (const key in b) {
      const m = this.mu[key]; if (m && !m.quieto) continue; // el usuario lo está moviendo: manda el Muelle
      const v = typeof b[key] === 'number' && typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * e : b[key];
      this.cur.par[key] = v; if (m && typeof v === 'number') m.salto(v);
    }
    if (k >= 1) { this.tw = null; return false; }
    return true;
  }

  pasoMuelles(dt) {
    let vivo = false;
    for (const k in this.mu) { const m = this.mu[k]; if (m.quieto) continue; this.cur.par[k] = m.paso(dt); if (!m.quieto) vivo = true; }
    return vivo;
  }

  pintar(S, animar = true) {
    const dur = animar === true ? 460 : +animar || 0, anim = dur > 0 && !this.reducido(), D = this.def, idi = lang();
    this.modo = S.modo; this.win = [...D.x, ...D.y]; this.rc = null;
    const a = ajustar(this.win, PW, PH); this.R = { x: ML + a.x, y: MT + a.y, w: a.w, h: a.h };
    if (!this.fondo) this.preparar();
    if (S.capas !== this.capasRef) { this.capasRef = S.capas; this.capas = S.capas.map(sp => CAPAS[sp.tipo]?.(sp)).filter(Boolean); }
    if (this.sup()) this.activarGL();
    if (this.ejes && this.ejes.lang !== idi) { this.ejes.fijar(this.win, this.zmin, this.zmax, idi); this.gl?.cargar(this.M, this.zmin, this.zmax, this.ejes.t); }
    const interactivo = this.sup() || !!D.arrastrar;
    this.cv.classList.toggle('rot', this.sup()); this.cv.classList.toggle('pos', !this.sup() && !!D.arrastrar);
    this.cv.tabIndex = interactivo ? 0 : -1;
    this.cv.setAttribute('aria-label', L(D.etiqueta) || UI[idi].graf);
    if (interactivo) this.cv.setAttribute('aria-description', UI[idi][this.sup() ? 'teclaRot' : 'teclaPos']); else this.cv.removeAttribute('aria-description');
    const usados = new Set(S.capas.flatMap(sp => Object.values(sp)).filter(v => typeof v === 'string'));
    this.desl.forEach(({ d, lab, inp, row }) => { const t = L(d); if (lab._t !== t) { lab._t = t; etiqueta(lab, t); } inp.setAttribute('aria-label', t.replace(/\$/g, '')); row.style.visibility = usados.has(d.par) ? '' : 'hidden'; });
    const to = { par: { ...S.par } }, mov = k => !!this.mu[k] && !this.mu[k].quieto;
    for (const k in this.mu) if (mov(k)) to.par[k] = this.mu[k].a; // lo que el usuario mueve ahora lo sigue el Muelle, no el parche
    if (!this.cur) this.cur = { par: { ...to.par } };
    this.to = to;
    const igual = Object.keys(to.par).every(k => this.cur.par[k] === to.par[k] || mov(k));
    if (!anim || igual) {
      this.tw = null;
      for (const k in to.par) if (!mov(k)) { this.cur.par[k] = to.par[k]; if (this.mu[k]) this.mu[k].salto(to.par[k]); }
      this.dibujar(); return;
    }
    this.tw = { t0: performance.now(), dur, from: { par: { ...this.cur.par } }, to };
    this.dibujar(); this.pedir();
  }

  // ── WebGL (modo superficie) ───────────────────────────────────────────────
  activarGL() {
    if (this.glEstado === 'reutil') return this.montarGL(); // el contexto WebGL sobrevive a las reconstrucciones: solo se sube la malla nueva
    if (this.glEstado !== 'no') return;
    this.glEstado = 'cargando'; const def = this.def;
    import('./campo-gl.js').then(m => {
      if (this.def !== def || this.glEstado !== 'cargando') return;
      const cv = el('canvas', 'gl'); cv.style.width = W + 'px'; cv.style.height = SH + 'px'; cv.setAttribute('aria-hidden', 'true');
      const gl = m.SuperficieGL.crear(cv);
      if (!gl) { this.glEstado = 'fallo'; this.pedir(); return; }
      this.glMod = m; this.gl = gl; this.glcv = cv; this.glD = this.glDpr(1);
      gl.tamano(Math.round(W * this.glD), Math.round(SH * this.glD)); gl.tema(this.col.muted, this.col.linea);
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); this.gl = null; this.glEstado = 'fallo'; this.ejesEl.style.visibility = 'hidden'; this.pedir(); });
      cv.addEventListener('webglcontextrestored', () => { const d = this.def; this.liberarGL(); if (this.def === d && this.sup()) this.activarGL(); this.pedir(); });
      this.montarGL();
    }).catch(() => { this.glEstado = 'fallo'; this.pedir(); });
  }

  /** Engancha el canvas GL a la escena actual: rótulos de ejes, malla nueva y observación del panel. */
  montarGL() {
    const m = this.glMod, gl = this.gl; this.glEstado = 'listo'; this.glVer = false;
    this.glcv.classList.remove('ver'); this.stage.prepend(this.glcv);
    this.ejes = new m.Ejes(this.ejesEl); this.ejes.fijar(this.win, this.zmin, this.zmax, lang());
    gl.cargar(this.M, this.zmin, this.zmax, this.ejes.t);
    // Resolución: el stage se escala con CSS (guia.js); la observación del panel da esa escala sin leer layout por fotograma
    const p = this.stage.parentElement;
    if (p && globalThis.ResizeObserver) {
      this.ro = new ResizeObserver(es => {
        this.rc = null; const d = this.glDpr(lim(es[0].contentRect.width / W, .5, 1.5));
        if (this.gl && Math.abs(d - this.glD) > .08) { this.glD = d; this.gl.tamano(Math.round(W * d), Math.round(SH * d)); if (this.sup()) this.dibujar(); }
      });
      this.ro.observe(p);
    }
    this.pedir();
  }

  glDpr(esc) { return lim(Math.min(2, globalThis.devicePixelRatio || 1) * Math.max(1, esc), 1, 3); }

  /** Al reconstruir la escena: el contexto y el canvas se conservan (crear uno nuevo cuesta ms y puede fallar). */
  soltarGL() {
    this.ro?.disconnect(); this.ro = null; this.ejes = null; this.glVer = false; this.glEstado = this.gl ? 'reutil' : 'no';
  }

  liberarGL() {
    this.ro?.disconnect(); this.ro = null; this.gl?.liberar(); this.gl = null; this.glcv?.remove(); this.glcv = null; this.ejes = null; this.glEstado = 'no'; this.glVer = false;
  }

  // Cálculo único por apertura: malla, rango, contornos, mapa de color y gradiente máximo
  preparar() {
    const D = this.def, M = this.M = malla(D.f, D.x, D.y, NG), [zmin, zmax] = D.z ?? [M.mn, M.mx];
    this.zmin = zmin; this.zmax = zmax;
    const nv = Array.isArray(D.niveles) ? D.niveles : niveles(zmin, zmax, D.niveles);
    this.curv = nv.map(v => ({ v, segs: contorno(M, D.x, D.y, v) }));
    for (const c of this.curv) c.lab = etiquetaDe(c.segs, D.x, D.y);
    const N = NG, W1 = N + 1, off = document.createElement('canvas'); off.width = off.height = W1;
    const og = off.getContext('2d'), im = og.createImageData(W1, W1);
    for (let j = 0; j < W1; j++) for (let i = 0; i < W1; i++) {
      const z = M.z[(N - j) * W1 + i], [r, gg, b] = rampa((z - zmin) / (zmax - zmin)), o = (j * W1 + i) * 4;
      im.data[o] = r; im.data[o + 1] = gg; im.data[o + 2] = b; im.data[o + 3] = Number.isFinite(z) ? 255 : 0;
    }
    og.putImageData(im, 0, 0); this.mapa = off;
    let gm = 0; for (let j = 0; j <= N; j += 6) for (let i = 0; i <= N; i += 6) { const [a, b] = gradiente(D.f, D.x[0] + (D.x[1] - D.x[0]) * i / N, D.y[0] + (D.y[1] - D.y[0]) * j / N); if (Number.isFinite(a) && Number.isFinite(b)) gm = Math.max(gm, Math.hypot(a, b)); }
    this.gmax = gm; this.fondo = true;
  }

  // quads de la superficie para el renderizador 2D de reserva (1 de cada 2 muestras) con su color
  hacerQuads() {
    const M = this.M, N = NG, W1 = N + 1, S = N / 2, quads = [], { zmin, zmax } = this;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const z = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([di, dj]) => M.z[(2 * (j + dj)) * W1 + 2 * (i + di)]);
      if (z.some(v => !Number.isFinite(v))) continue;
      const zm = (z[0] + z[1] + z[2] + z[3]) / 4, [r, gg, b] = rampa((zm - zmin) / (zmax - zmin));
      quads.push({ i, j, z, col: `rgb(${r},${gg},${b})` });
    }
    return quads;
  }

  lift(x, y) { const z = evalF(this.def.f, x, y); return Number.isFinite(z) ? lim(z, this.zmin, this.zmax) : this.zmin; }

  // Fondos cacheados (por idioma y resolución): el mapa de nivel con sus curvas, ejes y barra de color; o solo la barra de color
  fondoDe(tipo) {
    const clave = lang() + '|' + this.dpr + '|' + this.col.muted, F = this.fondos[tipo];
    if (F && F.clave === clave) return F.cv;
    const cv = document.createElement('canvas'); cv.width = Math.round(W * this.dpr); cv.height = Math.round(SH * this.dpr);
    const g = cv.getContext('2d'), col = this.col, [x0, x1, y0, y1] = this.win, idi = lang();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.font = '11px "Atkinson Hyperlegible Next", system-ui, sans-serif'; g.textBaseline = 'alphabetic';
    if (tipo === 'nivel') {
      const R = this.R, px = x => R.x + (x - x0) / (x1 - x0) * R.w, py = y => R.y + (y1 - y) / (y1 - y0) * R.h;
      g.imageSmoothingEnabled = true; g.drawImage(this.mapa, R.x, R.y, R.w, R.h);
      g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath();
      for (const { segs } of this.curv) for (let i = 0; i < segs.length; i += 4) { g.moveTo(px(segs[i]), py(segs[i + 1])); g.lineTo(px(segs[i + 2]), py(segs[i + 3])); }
      g.stroke();
      g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.55)'; g.fillStyle = '#fff';
      for (const { v, lab } of this.curv) if (lab) { const t = formatear(v, idi); g.strokeText(t, px(lab[0]), py(lab[1]) + 4); g.fillText(t, px(lab[0]), py(lab[1]) + 4); }
      g.strokeStyle = col.linea; g.lineWidth = 1; g.strokeRect(R.x + .5, R.y + .5, R.w - 1, R.h - 1);
      g.fillStyle = col.muted; g.textAlign = 'center'; for (const v of ticks125(x0, x1, 7)) g.fillText(formatear(v, idi), px(v), R.y + R.h + 16);
      g.textAlign = 'right'; for (const v of ticks125(y0, y1, 6)) g.fillText(formatear(v, idi), R.x - 6, py(v) + 4);
    }
    g.imageSmoothingEnabled = false; g.drawImage(this.barra ??= barraDeColor(), CB, MT, 10, PH);
    g.fillStyle = col.muted; g.textAlign = 'left'; g.fillText(formatear(this.zmax, idi), CB + 14, MT + 9); g.fillText(formatear(this.zmin, idi), CB + 14, MT + PH);
    g.fillText('z', CB + 14, MT + PH / 2 + 4);
    this.fondos[tipo] = { clave, cv }; return cv;
  }

  /** Rótulo HTML de una capa (texto con `$…$`): un <div> reutilizado; el texto solo se renderiza si cambió. */
  rotulo(t, x, y) {
    const d = this.rl[this.rlN] ??= this.txtEl.appendChild(el('div', 'rotulo')); this.rlN++;
    if (d._t !== t) { d._t = t; etiqueta(d, t); }
    const s = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(0,-100%)`;
    if (d._s !== s) { d._s = s; d.style.transform = s; }
    if (d._o) { d._o = false; d.style.visibility = ''; }
  }

  pintarHover() {
    const h = this.hovEl, ver = this.hov && !this.sup() && this.hdentro && this.hx !== undefined;
    if (!ver) { if (this.hovVis) { this.hovVis = false; h.style.visibility = 'hidden'; } return; }
    const idi = lang(), z = evalF(this.def.f, this.hx, this.hy), t = [formatear(+this.hx.toFixed(2), idi), formatear(+this.hy.toFixed(2), idi), Number.isFinite(z) ? formatear(+z.toFixed(2), idi) : '—'];
    this.hovV.forEach((b, i) => { if (b._t !== t[i]) { b._t = t[i]; b.textContent = t[i]; } });
    const s = `translate(${this.plx.toFixed(1)}px,${this.ply.toFixed(1)}px)`; if (h._s !== s) { h._s = s; h.style.transform = s; }
    const izq = this.plx > W - 190, aba = this.ply > SH - 56; if (h._i !== izq) { h._i = izq; h.classList.toggle('izq', izq); } if (h._a !== aba) { h._a = aba; h.classList.toggle('aba', aba); }
    if (h._r !== this.arr) { h._r = this.arr; h.classList.toggle('arr', this.arr); }
    if (!this.hovVis) { this.hovVis = true; h.style.visibility = 'visible'; }
  }

  dibujar() {
    const g = this.g, D = this.def, par = this.cur.par, col = this.col, [x0, x1, y0, y1] = this.win, sup = this.sup(), idi = lang();
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, W, SH);
    this.rlN = 0;
    const usaGL = sup && !!this.gl, cargando = sup && this.glEstado === 'cargando';
    if (this.glcv && !usaGL && this.glVer) { this.glVer = false; this.glcv.classList.remove('ver'); } // al salir de la superficie se atenúa
    if (this.ejesEl.style.visibility !== (usaGL ? '' : 'hidden')) this.ejesEl.style.visibility = usaGL ? '' : 'hidden';
    let pt;
    if (!sup) {
      const R = this.R;
      g.drawImage(this.fondoDe('nivel'), 0, 0, W, SH);
      pt = (x, y) => [R.x + (x - x0) / (x1 - x0) * R.w, R.y + (y1 - y) / (y1 - y0) * R.h];
    } else {
      const rot = par.rot, el = par.elev, c = Math.cos(rot), s = Math.sin(rot), ce = Math.cos(el), se = Math.sin(el), { cx, cy, sc } = CAM;
      const kx = 2 / (x1 - x0), ky = 2 / (y1 - y0), zr = this.zmax - this.zmin || 1, zmin = this.zmin;
      pt = (x, y, z = zmin) => {
        const nx = kx * (x - x0) - 1, ny = ky * (y - y0) - 1, nz = ZS * (2 * (z - zmin) / zr - 1), yr = nx * s + ny * c;
        return [cx + (nx * c - ny * s) * sc, cy - (nz * ce + yr * se) * sc];
      };
      if (usaGL) {
        const cj = this.glMod.caja(rot, el, this.cj ??= {});
        this.gl.dibujar(rot, el, cj); this.ejes.colocar(rot, el, cj);
        if (!this.glVer) { this.glVer = true; this.glcv.classList.add('ver'); }
      } else if (!cargando) this.superficie2D(g, pt, rot, el);
      g.drawImage(this.fondoDe('barra'), 0, 0, W, SH);
      g.font = '11px "Atkinson Hyperlegible Next", system-ui, sans-serif'; g.fillStyle = col.muted; g.textAlign = 'left'; g.fillText(UI[idi].arrastra, ML, MT + 10);
    }
    if (!cargando) {
      const c = { pt, lift: (x, y) => this.lift(x, y), par, f: D.f, modo: this.modo, win: this.win, col, zmin: this.zmin, gmax: this.gmax, rotulo: (t, x, y) => this.rotulo(t, x, y) };
      g.save(); g.beginPath(); g.rect(ML - 4, MT - 4, PW + 8, PH + 8); g.clip();
      for (const u of this.capas) u(g, c);
      g.restore();
    }
    for (let i = this.rlN; i < this.rl.length; i++) { const d = this.rl[i]; if (!d._o) { d._o = true; d.style.visibility = 'hidden'; } }
    this.desl.forEach(({ d, inp, out }) => { const v = par[d.par]; if (typeof v === 'number') { if (+inp.value !== v) inp.value = v; const t = formatear(+v.toFixed(d.dec ?? 2), idi); if (out._t !== t) { out._t = t; out.textContent = t; } } });
  }

  // Reserva sin WebGL: caja base + quads ordenados por profundidad en canvas 2D (el renderizador original)
  superficie2D(g, pt, rot, el) {
    const [x0, x1, y0, y1] = this.win, col = this.col;
    g.strokeStyle = col.linea; g.lineWidth = 1.25; g.beginPath();
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([X, Y], k) => { const [a, b] = pt(X, Y, this.zmin); k ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.stroke();
    const S = NG / 2, ord = (this.quads ??= this.hacerQuads()).map(q => { const p = proyectar(2 * (q.i + .5) / S - 1, 2 * (q.j + .5) / S - 1, 0, rot, el); return [p.prof, q]; }).sort((a, b) => b[0] - a[0]);
    g.lineJoin = 'round'; g.lineWidth = .6; g.strokeStyle = 'rgba(20,21,23,.55)';
    for (const [, q] of ord) {
      g.fillStyle = q.col; g.beginPath();
      [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([di, dj], k) => { const X = x0 + (x1 - x0) * (q.i + di) / S, Y = y0 + (y1 - y0) * (q.j + dj) / S, [a, b] = pt(X, Y, q.z[k]); k ? g.lineTo(a, b) : g.moveTo(a, b); });
      g.closePath(); g.fill(); g.stroke();
    }
  }
}
