// Escena «vectores»: plano ℝ² con la MISMA escala en los dos ejes para álgebra lineal. Vectores con nombre que el usuario
// arrastra por su extremo (puntero o teclado), combinaciones lineales cabeza-cola, subespacio generado, paralelogramo con su
// área con signo (= determinante), rejilla transformada por una matriz 2×2 y rectas a·x + b·y = c (sistemas 2×2).
// Contrato de escena de guia.js: clave, plegar (pura), crear (+ vista/conVista/ctx para `jugar`).
//
// FORMATO. Un paso ABRE la escena con (datos JS, no JSON):
//   vectores: {
//     x: [a,b], y: [c,d]        región que DEBE verse; se encaja con la misma escala en x e y (sobra margen en un eje)
//     vec: { u: [2,1], v: [-1,1.5] }   vectores con nombre (componentes numéricas). Color = PALETA[posición en `vec`]
//     arrastrar?: ['u','v']     vectores cuyo extremo se arrastra (asa accesible: Tab + flechas ←→ mueven x, ↑↓ mueven y,
//                               Mayús = paso ×4)
//     paso?: 0.5                ajuste a rejilla al arrastrar y paso del teclado (por defecto 0,25 con teclado y 0,01 al arrastrar)
//     par?: { a: 1, b: 1 }      parámetros numéricos (coeficientes, entradas de matriz…)
//     deslizadores?: [{ par, min, max, paso?, es, en, dec? }]   <input type=range> nativos bajo el plano; solo se ven si alguna
//                               capa usa ese parámetro
//     etiqueta?: {es,en}        texto accesible del plano
//     capas?: [capa…]
//   }
// PARCHES acumulativos (pasos y frames de `traza`):
//   vec: { u: [x,y] }  mezcla vectores (transición)    par: { a: 2 }  mezcla parámetros (transición)
//   capas: [capa…]     REEMPLAZA la lista              ventana: { x:[a,b], y:[c,d] }   cambia la región (animada)
// CAPAS (`tipo`). Un NÚMERO puede ser un valor o el nombre de un parámetro ('a'). Un VECTOR puede ser el nombre de un vector
// ('u') o un par [x, y] cuyas entradas son números o nombres de parámetro. `nombre` admite `$…$` ('' = sin rótulo):
//   flecha {a, de?, nombre?, color?}       vector a dibujado desde `de` (por defecto el origen). Si `a` es un nombre y no hay
//                                          `nombre`, el rótulo es el nombre en negrita ('b1' → 𝐛₁)
//   comb {coef:[…], vecs:[…], nombre?}     Σ coefᵢ·vecᵢ: cada término cabeza-cola (discontinuo, color de su vector) y el resultado
//                                          resaltado (color «camino»)
//   span {vecs:[…]}                        subespacio generado: punto (todos nulos), recta por el origen (dependientes) o todo
//                                          el plano sombreado (dos independientes)
//   paralelogramo {u, v, det?}             paralelogramo 0, u, u+v, v; color «camino» si det > 0, «mal» si det < 0;
//                                          det: false oculta el rótulo «det = …»
//   rejilla {m: [[a,b],[c,d]], base?}      rejilla de ℝ² transformada por la matriz (entradas número o parámetro) y las imágenes
//                                          A𝐞₁, A𝐞₂ (base: false las oculta). Al aparecer, interpola desde la identidad
//   imagen {m, a, nombre?, color?}         el vector m·a (a = vector); rótulo por defecto A𝐱 si a = 'x'; color «camino»
//   elipse {m, ejes?, v?, circulo?}        imagen del círculo unidad bajo m (elipse; interpola desde la identidad al aparecer);
//                                          circulo: false oculta el círculo de partida; ejes: true dibuja σ1𝐮1, σ2𝐮2 (SVD) y,
//                                          salvo v: false, los vectores singulares derechos 𝐯1, 𝐯2 sobre el círculo
//   propios {m, vecs?}                     rectas propias reales de m con 𝐯 unitario (discontinuo), A𝐯 = λ𝐯 y «λᵢ = …»;
//                                          λ complejos → sin rectas + aviso; λ doble defectuoso → una recta + aviso;
//                                          A = λI → plano sombreado + aviso. vecs: false deja solo las rectas
//   proyeccion {x, sobre, A?, de?, nombre?, recta?}   proyección ortogonal πU(x) sobre U = span(sobre) (MML §3.8); con `de`
//                                          (vector x0) proyecta sobre la recta afín L = x0 + U: πL(x) = x0 + πU(x − x0) (ec. 3.72),
//                                          y la flecha sale de x0. Flecha πU(x)
//                                          (color «camino»), segmento discontinuo x − πU(x) («mal») y marca de ángulo recto.
//                                          sobre: nombre de vector, [x,y] numérico o lista de ellos. A: [[a,b],[b,d]] simétrica
//                                          definida positiva → ⟨x,y⟩ = xᵀAy (la marca se ve oblicua: ortogonal respecto a A);
//                                          si A no es DP la capa se oculta. recta: false no dibuja U. Con 2 independientes, πU(x) = x
//   bola {p, r?, A?}                       contorno {x : ‖x‖ = r} (r = 1): p = 1 | 2 | 'inf' | número (ℓp; p < 1 no es norma:
//                                          sale no convexa) o, con A (DP), la elipse xᵀAx = r² de la norma inducida
//   recta {a, b, c, nombre?, color?}       recta a·x + b·y = c (vertical si b = 0; oculta si a = b = 0)
//   punto {x, y, nombre?, abierto?}        punto; abierto = círculo hueco
//   texto {x, y, s:{es,en}|string, ancla?} rótulo libre ('start'|'middle'|'end')
// `jugar`: vista plana v = {…par, vec: {u:[x,y], …}} (copia mutable). ctx = { par, fmt(n), det(p,q), comb(coefs, vecs),
//   resolver(a1,b1,c1,a2,b2,c2) → {tipo:'unica'|'ninguna'|'infinitas', x?, y?}, dim(vecs), mul(m,v), traza(m), detM(m),
//   eig2(m) → {reales, l1, l2, v1, v2, doble, defectuosa} | {reales:false, re, im}, svd2(m) → {s1, s2, u1, u2, v1, v2},
//   dot(p,q,A?) = pᵀAq, norma(x, 1|2|'inf'|p|A), angulo(x,y,A?) ∈ [0,π] (NaN si hay un nulo), proy(x, [vecs], A?) → [x,y] }.
//   Con `arrastrables`, el aviso es
//   soltar(v, clave, valor, cx): clave = nombre de vector (valor [x,y]) o de parámetro (valor número).
// Animación: UN solo rAF compartido (movimiento.js); arrastre con Muelle por componente; en SVG solo atributos de geometría,
// en HTML solo transform/opacity; ningún fotograma lee layout (el rectángulo se lee al empezar a arrastrar o al entrar).
// Lógica pura sin DOM al importar: tests/guias/test-vectores.js.
import { idioma } from './idioma.js';
import { PALETA, ticks125, formatear } from './grafica.js';
import { etiqueta } from './mates.js';
import { tarea, Muelle, ease, REDUCIDO } from './movimiento.js';

export const clave = 'vectores';

// ── Lógica pura ─────────────────────────────────────────────────────────────
const lim = (x, a, b) => Math.min(b, Math.max(a, x));
const GRANDE = 1e5;
const EPS = 1e-9;

/** Número o nombre de parámetro → número. */
export const num = (v, par) => (typeof v === 'string' ? +par[v] : +v);
/** Vector: nombre (en `vec`) o [x, y] con números/parámetros → [x, y]. */
export const vecDe = (a, vec, par) => (typeof a === 'string' ? vec[a] ?? [NaN, NaN] : Array.isArray(a) ? [num(a[0], par), num(a[1], par)] : [NaN, NaN]);
export const det = (p, q) => p[0] * q[1] - p[1] * q[0];
/** Σ coefᵢ·vecᵢ con vectores ya resueltos. */
export const comb = (cs, vs) => vs.reduce((s, v, i) => [s[0] + cs[i] * v[0], s[1] + cs[i] * v[1]], [0, 0]);
/** Dimensión del subespacio generado por vectores de ℝ² (0, 1 o 2). */
export function dim(vs) {
  const nz = vs.filter(v => Math.hypot(v[0], v[1]) > EPS);
  if (!nz.length) return 0;
  const s = Math.max(...nz.map(v => Math.hypot(v[0], v[1])));
  for (let i = 0; i < nz.length; i++) for (let j = i + 1; j < nz.length; j++) if (Math.abs(det(nz[i], nz[j])) > 1e-9 * s * s) return 2;
  return 1;
}
/** Sistema a1·x + b1·y = c1, a2·x + b2·y = c2 (regla de Cramer si det ≠ 0; si no, compara rangos). */
export function resolver(a1, b1, c1, a2, b2, c2) {
  const D = a1 * b2 - a2 * b1, s = Math.max(1, Math.abs(a1), Math.abs(b1), Math.abs(a2), Math.abs(b2));
  if (Math.abs(D) > 1e-12 * s * s) return { tipo: 'unica', x: (c1 * b2 - c2 * b1) / D, y: (a1 * c2 - a2 * c1) / D };
  // det = 0: filas (a,b) paralelas. Hay solución si la matriz ampliada tiene el mismo rango
  const r1 = Math.abs(a1) + Math.abs(b1) > EPS, r2 = Math.abs(a2) + Math.abs(b2) > EPS;
  if (!r1 && !r2) return { tipo: Math.abs(c1) < EPS && Math.abs(c2) < EPS ? 'infinitas' : 'ninguna' };
  if (!r1) return { tipo: Math.abs(c1) < EPS ? 'infinitas' : 'ninguna' };
  if (!r2) return { tipo: Math.abs(c2) < EPS ? 'infinitas' : 'ninguna' };
  const cons = Math.abs(a1 * c2 - a2 * c1) < 1e-9 * s * s && Math.abs(b1 * c2 - b2 * c1) < 1e-9 * s * s;
  return { tipo: cons ? 'infinitas' : 'ninguna' };
}
// ── Producto interno, normas y proyecciones (capas `proyeccion` y `bola`) ──
/** ⟨p, q⟩ = pᵀ A q (A simétrica definida positiva; sin A, producto escalar). */
export const dot = (p, q, A) => (A ? p[0] * (A[0][0] * q[0] + A[0][1] * q[1]) + p[1] * (A[1][0] * q[0] + A[1][1] * q[1]) : p[0] * q[0] + p[1] * q[1]);
/** ¿A simétrica y definida positiva? (2×2: simétrica, a₁₁ > 0 y det > 0). */
export const defPos = A => !A || (Math.abs(A[0][1] - A[1][0]) < 1e-9 && A[0][0] > 0 && A[0][0] * A[1][1] - A[0][1] * A[1][0] > 0);
/** Norma: tipo = 1 | 2 | 'inf' | p > 0 (ℓp; para p < 1 no es norma), o una matriz A (norma inducida √(xᵀAx)). */
export function norma(x, tipo = 2) {
  if (Array.isArray(tipo)) return Math.sqrt(Math.max(0, dot(x, x, tipo)));
  if (tipo === 'inf' || tipo === Infinity) return Math.max(Math.abs(x[0]), Math.abs(x[1]));
  return (Math.abs(x[0]) ** tipo + Math.abs(x[1]) ** tipo) ** (1 / tipo);
}
/** Ángulo ω ∈ [0, π] con cos ω = ⟨x,y⟩ / (‖x‖‖y‖) (MML ec. 3.25); NaN si alguno es nulo. */
export function angulo(x, y, A) {
  const nx = Math.sqrt(dot(x, x, A)), ny = Math.sqrt(dot(y, y, A));
  return nx > EPS && ny > EPS ? Math.acos(lim(dot(x, y, A) / (nx * ny), -1, 1)) : NaN;
}
/** Proyección ortogonal de x sobre U = span(bs) respecto a ⟨·,·⟩_A: ecuaciones normales con la matriz de Gram
 *  (MML ec. 3.56–3.58). Devuelve {p, l, d}: punto πU(x), coordenadas λ respecto a la base usada y dim U (0, 1, 2). */
export function proyectar(x, bs, A) {
  const nz = bs.filter(b => Math.hypot(b[0], b[1]) > EPS), d = dim(nz);
  if (d === 0) return { p: [0, 0], l: [], d: 0 };
  if (d === 2) return { p: [x[0], x[1]], l: [], d: 2 };   // en ℝ², dos independientes generan todo: πU(x) = x
  const b = nz[0], l = dot(x, b, A) / dot(b, b, A);       // λ = ⟨x,b⟩/⟨b,b⟩ (ec. 3.40)
  return { p: [l * b[0], l * b[1]], l: [l], d: 1 };
}
/** Contorno {x : ‖x‖ = r} como lista de puntos. p = 1 | 2 | 'inf' | número > 0 (ℓp), o A (elipse xᵀAx = r²).
 *  ℓp: x = r·sgn(cos t)|cos t|^(2/p), y = r·sgn(sin t)|sin t|^(2/p)  ⇒  |x|ᵖ + |y|ᵖ = rᵖ. A: x = r·L⁻ᵀ(cos t, sin t), A = LLᵀ. */
export function contornoBola(p, r = 1, A, n = 160) {
  const pts = [];
  if (A) {
    if (!defPos(A)) return null;
    const l11 = Math.sqrt(A[0][0]), l21 = A[0][1] / l11, l22 = Math.sqrt(A[1][1] - l21 * l21);
    for (let i = 0; i <= n; i++) { const t = 2 * Math.PI * i / n, c = Math.cos(t), s = Math.sin(t); pts.push([r * (c / l11 - s * l21 / (l11 * l22)), r * s / l22]); }
    return pts;
  }
  if (p === 'inf' || p === Infinity || p > 60) return [[r, r], [-r, r], [-r, -r], [r, -r], [r, r]];
  if (!(p > 0)) return null;
  const e = 2 / p, f = v => Math.sign(v) * Math.abs(v) ** e;
  for (let i = 0; i <= n; i++) { const t = 2 * Math.PI * i / n; pts.push([r * f(Math.cos(t)), r * f(Math.sin(t))]); }
  return pts;
}
/** Ajuste a rejilla (paso > 0) o a centésimas. */
export const ajustar = (x, paso) => (paso > 0 ? +(Math.round(x / paso) * paso).toFixed(6) : +x.toFixed(2));
/** Región pedida → ventana efectiva [x0,x1,y0,y1] con la misma escala en ambos ejes que contiene la pedida, centrada. */
export function ventanaEf(v, pw, ph) {
  const [a, b] = v.x, [c, d] = v.y, k = Math.max((b - a) / pw, (d - c) / ph), cx = (a + b) / 2, cy = (c + d) / 2;
  return [cx - k * pw / 2, cx + k * pw / 2, cy - k * ph / 2, cy + k * ph / 2];
}
/** Recta a·x + b·y = c → dos puntos que cruzan la ventana (o null). */
export function segRecta(a, b, c, w) {
  const [x0, x1, y0, y1] = w;
  if (!(Math.abs(a) + Math.abs(b) > EPS) || ![a, b, c].every(Number.isFinite)) return null;
  if (Math.abs(b) >= Math.abs(a)) { const m = 1 / b, X0 = x0 - (x1 - x0), X1 = x1 + (x1 - x0); return [X0, (c - a * X0) * m, X1, (c - a * X1) * m]; }
  const m = 1 / a, Y0 = y0 - (y1 - y0), Y1 = y1 + (y1 - y0); return [(c - b * Y0) * m, Y0, (c - b * Y1) * m, Y1];
}
/** Nombre de vector → rótulo en negrita ('b1' → $\mathbf{b}_{1}$). */
export const rotulo = n => { const m = /^([A-Za-z]+)(\d*)$/.exec(n); return m ? `$\\boldsymbol{${m[1]}}${m[2] ? `_{${m[2]}}` : ''}$` : n; };
/** Interpola la matriz desde la identidad: (1−k)·I + k·M. */
export const mezclaI = (m, k) => [[1 + (m[0][0] - 1) * k, m[0][1] * k], [m[1][0] * k, 1 + (m[1][1] - 1) * k]];
// ── Capas `elipse` y `propios` (MML cap. 4): matrices 2×2 m = [[a,b],[c,d]] ──
/** Producto matriz·vector, traza y determinante de una 2×2. */
export const mul = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]];
export const traza = m => m[0][0] + m[1][1];
export const detM = m => m[0][0] * m[1][1] - m[0][1] * m[1][0];
/** Autovalores y autovectores (unitarios) de una 2×2 real.
 *  → {reales:false, re, im}  (par complejo re ± i·im: no hay rectas propias reales)
 *  → {reales:true, l1 ≥ l2, v1, v2, doble, defectuosa}; doble: λ repetido; con A = λI, v1/v2 = e1/e2 (todo vector es propio);
 *    defectuosa: λ doble con una sola dirección propia (v2 = null). */
export function eig2(m) {
  const [[a, b], [c, d]] = m, t = a + d, disc = (a - d) * (a - d) / 4 + b * c;
  const esc = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)), tol = 1e-9 * esc * esc;
  if (disc < -tol) return { reales: false, re: t / 2, im: Math.sqrt(-disc) };
  const r = Math.sqrt(Math.max(0, disc)), doble = r * r <= tol, l1 = t / 2 + r, l2 = t / 2 - r;
  // dirección del núcleo de A − λI: de la fila más larga de A − λI (estable)
  const dir = l => {
    const p = [b, l - a], q = [l - d, c], n1 = Math.hypot(p[0], p[1]), n2 = Math.hypot(q[0], q[1]), v = n1 >= n2 ? p : q, n = Math.max(n1, n2);
    return n > 1e-7 * esc ? [v[0] / n, v[1] / n] : null; // null: A − λI = 0
  };
  if (doble) {
    const v = dir(t / 2);
    return v ? { reales: true, l1: t / 2, l2: t / 2, v1: v, v2: null, doble: true, defectuosa: true }
      : { reales: true, l1: t / 2, l2: t / 2, v1: [1, 0], v2: [0, 1], doble: true, defectuosa: false };
  }
  return { reales: true, l1, l2, v1: dir(l1), v2: dir(l2), doble: false, defectuosa: false };
}
/** SVD de una 2×2: A = U Σ Vᵀ con σ1 ≥ σ2 ≥ 0, columnas unitarias u1,u2 (de U) y v1,v2 (de V). Vía AᵀA simétrica (ángulo
 *  cerrado) y σ2 = |det|/σ1 (estable cuando A es casi singular). */
export function svd2(m) {
  const [[a, b], [c, d]] = m, p = a * a + c * c, r = b * b + d * d, q = a * b + c * d;
  const al = Math.atan2(2 * q, p - r) / 2, v1 = [Math.cos(al), Math.sin(al)], v2 = [-v1[1], v1[0]];
  const s1 = Math.sqrt(Math.max(0, (p + r) / 2 + Math.hypot((p - r) / 2, q))), s2 = s1 > 1e-12 ? Math.abs(a * d - b * c) / s1 : 0;
  const w1 = mul(m, v1), u1 = s1 > 1e-12 ? [w1[0] / s1, w1[1] / s1] : [1, 0];
  const w2 = mul(m, v2), u2 = s2 > 1e-9 * Math.max(1, s1) ? [w2[0] / s2, w2[1] / s2] : [-u1[1], u1[0]];
  return { s1, s2, u1, u2, v1, v2 };
}
/** Cadenas usadas en una capa (para saber qué deslizadores mostrar). */
export const nombresEn = x => (typeof x === 'string' ? [x] : Array.isArray(x) ? x.flatMap(nombresEn) : x && typeof x === 'object' ? Object.entries(x).filter(([k]) => k !== 'tipo' && k !== 'nombre' && k !== 's').flatMap(([, v]) => nombresEn(v)) : []);

// ── Estado: plegar (pura) ───────────────────────────────────────────────────
const defs = new WeakMap();
function crearDef(g) {
  if (!defs.has(g)) {
    const nombres = Object.keys(g.vec ?? {});
    defs.set(g, {
      nombres, color: Object.fromEntries(nombres.map((n, i) => [n, PALETA[i % PALETA.length]])),
      arrastrar: (g.arrastrar ?? []).filter(n => nombres.includes(n)), paso: g.paso ?? 0,
      deslizadores: g.deslizadores ?? [], etiqueta: g.etiqueta ?? null,
    });
  }
  return defs.get(g);
}
const copiaVec = vec => Object.fromEntries(Object.entries(vec).map(([k, v]) => [k, [v[0], v[1]]]));
function aplicar(s, p) {
  const r = { ...s };
  if (p.par) r.par = { ...r.par, ...p.par };
  if (p.vec) { r.vec = { ...r.vec }; for (const k in p.vec) if (k in s.vec) r.vec[k] = [p.vec[k][0], p.vec[k][1]]; }
  if (Array.isArray(p.capas)) r.capas = p.capas;
  if (p.ventana) r.ventana = { x: p.ventana.x ?? r.ventana.x, y: p.ventana.y ?? r.ventana.y };
  return r;
}
/** Estado nuevo = previo + parche. Pura. Estado: {def, vec, par, capas, ventana}. */
export function plegar(s, p) {
  if (p.vectores === undefined) return aplicar(s, p);
  const g = p.vectores, def = crearDef(g);
  const base = { def, vec: copiaVec(g.vec ?? {}), par: { ...(g.par ?? {}) }, capas: g.capas ?? [], ventana: { x: g.x ?? [-5, 5], y: g.y ?? [-5, 5] } };
  return aplicar(base, p);
}

// Para los bloques `jugar`
export const vista = s => ({ ...s.par, vec: copiaVec(s.vec) });
export const conVista = (s, v) => { const { vec, ...par } = v; return aplicar(s, { par, vec }); };
const lang = () => (globalThis.document ? idioma() : 'es');
const L = x => (x && typeof x === 'object' ? x[lang()] : x) ?? '';
export const ctx = s => ({ par: s.par, fmt: v => formatear(Math.abs(v) < 1e-10 ? 0 : v, lang()), det, comb, resolver, dim, mul, traza, detM, eig2, svd2, dot, norma, angulo, proy: (x, bs, A) => proyectar(x, bs, A).p });

// ── Escena (DOM) ────────────────────────────────────────────────────────────
const W = 640, ML = 40, MR = 40, PW = W - ML - MR, MT = 14, PH = 360, AB = 26, SH = MT + PH + AB, FILA = 34;
const NS = 'http://www.w3.org/2000/svg', CABEZA = 11, ANCHO = 4.6;
const UI = { es: { plano: 'Plano de vectores', asa: 'Extremo del vector' }, en: { plano: 'Vector plane', asa: 'Tip of vector' } };
const CSS = `
.vc { font-family: var(--ui); }
.vc svg { position: absolute; left: 0; top: 0; overflow: visible; }
.vc svg text { font: 11px var(--ui); fill: var(--muted); font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }
.vc .gM, .vc .eje, .vc .marco, .vc .rj, .vc .rec { vector-effect: non-scaling-stroke; fill: none; }
.vc .gM { stroke: var(--line); stroke-width: 1; opacity: .75; }
.vc .marco { stroke: var(--line2); stroke-width: 1; opacity: .7; }
.vc .eje { stroke: var(--line2); stroke-width: 1.5; }
.vc .fl { stroke-width: 2.5; stroke-linecap: round; fill: none; }
.vc .fl.t { stroke-width: 2; stroke-dasharray: 5 4; opacity: .85; }
.vc .fl.r { stroke-width: 3.5; }
.vc .cab { stroke: none; }
.vc .sp { fill: color-mix(in srgb, var(--g-aux) 14%, transparent); stroke: none; }
.vc .spl { stroke: var(--g-aux); stroke-width: 6; stroke-linecap: round; opacity: .35; fill: none; }
.vc .pg { stroke-width: 1.5; stroke-linejoin: round; }
.vc .pg.pos { fill: color-mix(in srgb, var(--g-camino) 22%, transparent); stroke: var(--g-camino); }
.vc .pg.neg { fill: color-mix(in srgb, var(--g-mal) 22%, transparent); stroke: var(--g-mal); stroke-dasharray: 6 4; }
.vc .rj { stroke: var(--g-compara); stroke-width: 1; opacity: .55; }
.vc .rec { stroke-width: 2; stroke-linecap: round; }
.vc .el0, .vc .el, .vc .pl { vector-effect: non-scaling-stroke; fill: none; }
.vc .el0 { stroke: var(--muted); stroke-width: 1.2; stroke-dasharray: 4 4; opacity: .8; }
.vc .el { stroke: var(--g-camino); stroke-width: 2.2; fill: color-mix(in srgb, var(--g-camino) 10%, transparent); }
.vc .fl.v { stroke-width: 1.8; stroke-dasharray: 3 3; }
.vc .pl { stroke-width: 5; stroke-linecap: round; opacity: .28; }
.vc text.ev { fill: var(--text); font: 12px var(--ui); font-variant-numeric: tabular-nums; }
.vc .pt { fill: var(--g-activo); stroke: var(--island); stroke-width: 2; }
.vc .pt.ab { fill: var(--island); stroke: var(--text); }
.vc .pjU { stroke: var(--g-aux); stroke-width: 5; stroke-linecap: round; opacity: .3; fill: none; }
.vc .pjE { stroke: var(--g-mal); stroke-width: 2; stroke-dasharray: 5 4; fill: none; }
.vc .pjR { stroke: var(--text); stroke-width: 1.3; fill: none; opacity: .8; }
.vc .bo { fill: color-mix(in srgb, var(--g-compara) 12%, transparent); stroke: var(--g-compara); stroke-width: 2; stroke-linejoin: round; }
.vc text.tx { fill: var(--text); font: italic 400 13px var(--display); }
.vc text.det { fill: var(--text); font: 12px var(--ui); font-variant-numeric: tabular-nums; }
.vc .hit { fill: transparent; pointer-events: all; touch-action: none; }
.vc.cerca .hit { cursor: grab; }
.vc .asa { cursor: grab; outline: none; touch-action: none; }
.vc .asa .zona { fill: transparent; pointer-events: all; }
.vc .asa .halo { fill: color-mix(in srgb, var(--g-activo) 14%, transparent); stroke: var(--g-activo); stroke-width: 1.5; opacity: 0; transition: opacity .14s; pointer-events: none; }
.vc .asa:hover .halo, .vc .asa:focus-visible .halo, .vc .asa.on .halo { opacity: 1; }
.vc .asa:focus-visible .halo { stroke-width: 2.5; }
.vc.drag, .vc.drag .asa, .vc.drag .hit { cursor: grabbing; }
.vc .ov { position: absolute; left: 0; top: 0; width: ${W}px; height: ${SH}px; pointer-events: none; overflow: visible; }
.vc .fe { position: absolute; left: 0; top: 0; white-space: nowrap; font: italic 400 14px/1.15 var(--display); color: var(--text); }
.vc .fe .katex { font-size: 1.05em; }
.vc .desl { position: absolute; left: ${ML - 8}px; width: ${PW + 16}px; height: ${FILA}px; display: grid; grid-template-columns: 1fr 64px; align-items: center; column-gap: 10px; font-size: 13px; color: var(--code); }
.vc .desl label { grid-column: 1 / -1; line-height: 1; margin-bottom: -6px; font-style: italic; font-family: var(--display); }
.vc .desl input { width: 100%; margin: 0; accent-color: var(--g-activo); cursor: pointer; }
.vc .desl output { font-variant-numeric: tabular-nums; color: var(--text); text-align: right; }
@media (prefers-reduced-motion: reduce) { .vc * { transition: none !important; animation: none !important; } }
`;
const inyectarCss = () => {
  if (document.getElementById('css-vectores')) return;
  const s = document.createElement('style'); s.id = 'css-vectores'; s.textContent = CSS; document.head.append(s);
};
const nodo = (tag, cls, attrs = {}) => {
  const e = document.createElementNS(NS, tag);
  if (cls) e.setAttribute('class', cls);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};
const div = cls => { const e = document.createElement('div'); e.className = cls; return e; };
const attr = (e, o) => { for (const k in o) e.setAttribute(k, typeof o[k] === 'number' ? +o[k].toFixed(2) : o[k]); };
const ocultar = (e, oc) => e.setAttribute('display', oc ? 'none' : 'inline');
const cl = v => lim(v, -GRANDE, GRANDE);
const fin = v => Number.isFinite(v[0]) && Number.isFinite(v[1]);

/** Rótulo: SVG <text> si no lleva `$`; si lleva, HTML (KaTeX una vez) movido con transform. Devuelve mover(x, y) en px del plano. */
function rotular(txt, g, ov, ancla = 'middle') {
  if (!txt) return () => {};
  if (String(txt).includes('$')) {
    const d = div('fe'), dx = { start: '0%', middle: '-50%', end: '-100%' }[ancla] ?? '-50%'; etiqueta(d, txt); ov.append(d); let ant = '';
    return (x, y, oc) => {
      const t = oc ? 'translate(-9999px,0)' : `translate(${(ML + x).toFixed(1)}px,${(MT + y).toFixed(1)}px) translate(${dx},-50%)`;
      if (t !== ant) { ant = t; d.style.transform = t; }
    };
  }
  const t = nodo('text', 'tx', { 'text-anchor': ancla, dy: '.35em' }); t.textContent = txt; g.append(t);
  return (x, y, oc) => { ocultar(t, !!oc); if (!oc) attr(t, { x, y }); };
}

/** Flecha (cuerpo + cabeza) en px. Devuelve pintar(x0,y0,x1,y1) y la oculta si el vector es casi nulo. */
function flechaSvg(g, cls, color) {
  const cuerpo = nodo('path', 'fl ' + cls, { stroke: color }), cab = nodo('path', 'cab', { fill: color });
  g.append(cuerpo, cab);
  return (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), ok = l > 1.5 && [x0, y0, x1, y1].every(Number.isFinite);
    ocultar(cuerpo, !ok); ocultar(cab, !ok); if (!ok) return;
    const ux = dx / l, uy = dy / l, h = Math.min(CABEZA, l * .6), bx = x1 - ux * h, by = y1 - uy * h;
    cuerpo.setAttribute('d', `M${cl(x0).toFixed(1)} ${cl(y0).toFixed(1)}L${cl(bx).toFixed(1)} ${cl(by).toFixed(1)}`);
    cab.setAttribute('d', `M${cl(x1).toFixed(1)} ${cl(y1).toFixed(1)}L${cl(bx - uy * ANCHO).toFixed(1)} ${cl(by + ux * ANCHO).toFixed(1)}L${cl(bx + uy * ANCHO).toFixed(1)} ${cl(by - ux * ANCHO).toFixed(1)}Z`);
  };
}
/** Posición del rótulo de un vector: más allá de la punta, apartado del cuerpo. */
const junto = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1; return [x1 + dx / l * 14 - dy / l * 8, y1 + dy / l * 14 + dx / l * 8]; };

// Capas: crear(spec, g, ov, D) → upd(c); c = {px, py, w:[x0,x1,y0,y1], par, V(a), C(a)}
const CAPAS = {
  flecha(s, g, ov, D) {
    const color = s.color ?? (typeof s.a === 'string' ? D.color[s.a] : null) ?? 'var(--text)', fl = flechaSvg(g, '', color);
    const rot = rotular(s.nombre ?? (typeof s.a === 'string' ? rotulo(s.a) : ''), g, ov);
    return c => {
      const o = s.de !== undefined ? c.V(s.de) : [0, 0], v = c.V(s.a), ok = fin(o) && fin(v);
      const x0 = c.px(o[0]), y0 = c.py(o[1]), x1 = c.px(o[0] + v[0]), y1 = c.py(o[1] + v[1]);
      fl(x0, y0, ok ? x1 : NaN, y1); rot(...junto(x0, y0, x1, y1), !ok || Math.hypot(x1 - x0, y1 - y0) < 2);
    };
  },
  comb(s, g, ov, D) {
    const tr = s.vecs.map(a => flechaSvg(g, 't', (typeof a === 'string' ? D.color[a] : null) ?? 'var(--muted)'));
    const res = flechaSvg(g, 'r', 'var(--g-camino)'), rot = rotular(s.nombre ?? '', g, ov);
    return c => {
      let x = 0, y = 0;
      s.vecs.forEach((a, i) => { const v = c.V(a), k = c.C(s.coef[i]), nx = x + k * v[0], ny = y + k * v[1]; tr[i](c.px(x), c.py(y), c.px(nx), c.py(ny)); x = nx; y = ny; });
      res(c.px(0), c.py(0), c.px(x), c.py(y)); rot(...junto(c.px(0), c.py(0), c.px(x), c.py(y)), !Number.isFinite(x + y));
    };
  },
  span(s, g) {
    const plano = nodo('rect', 'sp', { x: 0, y: 0, width: PW, height: PH }), recta = nodo('path', 'spl'), pt = nodo('circle', 'pt', { r: 5 });
    g.append(plano, recta, pt);
    return c => {
      const vs = s.vecs.map(c.V).filter(fin), d = dim(vs);
      ocultar(plano, d !== 2); ocultar(recta, d !== 1); ocultar(pt, d !== 0);
      if (d === 0) attr(pt, { cx: c.px(0), cy: c.py(0) });
      if (d === 1) {
        const v = vs.find(u => Math.hypot(u[0], u[1]) > EPS), k = 4 * Math.hypot(c.w[1] - c.w[0], c.w[3] - c.w[2]) / Math.hypot(v[0], v[1]);
        recta.setAttribute('d', `M${cl(c.px(-k * v[0])).toFixed(1)} ${cl(c.py(-k * v[1])).toFixed(1)}L${cl(c.px(k * v[0])).toFixed(1)} ${cl(c.py(k * v[1])).toFixed(1)}`);
      }
    };
  },
  paralelogramo(s, g) {
    const p = nodo('path', 'pg pos'), t = nodo('text', 'det', { 'text-anchor': 'middle', dy: '.35em' }); g.append(p, t);
    let signo = 1, txt = '';
    return c => {
      const u = c.V(s.u), v = c.V(s.v), ok = fin(u) && fin(v); ocultar(p, !ok); ocultar(t, !ok || s.det === false); if (!ok) return;
      const P = [[0, 0], u, [u[0] + v[0], u[1] + v[1]], v].map(q => `${cl(c.px(q[0])).toFixed(1)} ${cl(c.py(q[1])).toFixed(1)}`);
      p.setAttribute('d', `M${P.join('L')}Z`);
      const D = det(u, v), sg = D < -1e-9 ? -1 : 1;
      if (sg !== signo) { signo = sg; p.setAttribute('class', sg > 0 ? 'pg pos' : 'pg neg'); }
      if (s.det !== false) {
        const s2 = `det = ${formatear(Math.abs(D) < 1e-9 ? 0 : +D.toFixed(2), lang())}`;
        if (s2 !== txt) { txt = s2; t.textContent = s2; }
        attr(t, { x: c.px((u[0] + v[0]) / 2), y: c.py((u[1] + v[1]) / 2) });
      }
    };
  },
  rejilla(s, g, ov) {
    const p = nodo('path', 'rj'); g.append(p);
    const e1 = s.base === false ? null : flechaSvg(g, '', 'var(--g-activo)'), e2 = s.base === false ? null : flechaSvg(g, '', 'var(--g-compara)');
    const r1 = s.base === false ? null : rotular('$\\boldsymbol{A}\\boldsymbol{e}_1$', g, ov), r2 = s.base === false ? null : rotular('$\\boldsymbol{A}\\boldsymbol{e}_2$', g, ov);
    // Al aparecer, la rejilla se deforma desde la identidad (k: 0 → 1); con movimiento reducido, directa
    const est = { k: REDUCIDO ? 1 : 0, t0: 0 };
    return (c, pedir) => {
      if (est.k < 1 && pedir) pedir(est);
      const M = mezclaI(s.m.map(f => f.map(x => c.C(x))), ease(est.k)), N = 12;
      if (!M.flat().every(Number.isFinite)) { ocultar(p, true); return; }
      ocultar(p, false);
      const A = (x, y) => [c.px(M[0][0] * x + M[0][1] * y), c.py(M[1][0] * x + M[1][1] * y)];
      let d = '';
      for (let i = -N; i <= N; i++) {
        const [a, b] = A(i, -N), [e, f] = A(i, N), [g2, h] = A(-N, i), [k2, l] = A(N, i);
        d += `M${cl(a).toFixed(1)} ${cl(b).toFixed(1)}L${cl(e).toFixed(1)} ${cl(f).toFixed(1)}M${cl(g2).toFixed(1)} ${cl(h).toFixed(1)}L${cl(k2).toFixed(1)} ${cl(l).toFixed(1)}`;
      }
      p.setAttribute('d', d);
      if (e1) {
        const o = [c.px(0), c.py(0)], a = A(1, 0), b = A(0, 1);
        e1(...o, ...a); e2(...o, ...b); r1(...junto(...o, ...a)); r2(...junto(...o, ...b));
      }
    };
  },
  // imagen {m, a, nombre?, color?}: el vector m·a desde el origen (a = nombre de vector o [x,y]); por defecto color «camino»
  // y rótulo A𝐱 (con a = 'x'). Sirve para buscar autovectores arrastrando a hasta que m·a quede en su misma recta.
  imagen(s, g, ov) {
    const fl = flechaSvg(g, 'r', s.color ?? 'var(--g-camino)');
    const rot = rotular(s.nombre ?? (typeof s.a === 'string' ? `$\\boldsymbol{A}${rotulo(s.a).slice(1, -1)}$` : ''), g, ov);
    return c => {
      const M = s.m.map(f => f.map(x => c.C(x))), a = c.V(s.a), w = mul(M, a), ok = fin(w);
      const o = [c.px(0), c.py(0)], p = [c.px(w[0]), c.py(w[1])];
      fl(...o, ok ? p[0] : NaN, p[1]); rot(...junto(...o, ...p), !ok || Math.hypot(p[0] - o[0], p[1] - o[1]) < 2);
    };
  },
  // elipse {m, ejes?, v?, circulo?}: imagen del círculo unidad bajo m (al aparecer interpola desde la identidad, como la rejilla).
  // ejes: semiejes σ1𝐮1 y σ2𝐮2 (SVD 2×2) y, salvo v: false, los vectores singulares derechos 𝐯1, 𝐯2 sobre el círculo de partida.
  elipse(s, g, ov) {
    const c0 = s.circulo === false ? null : nodo('path', 'el0'), el = nodo('path', 'el'); if (c0) g.append(c0); g.append(el);
    const ejes = !!s.ejes, conV = ejes && s.v !== false, A1 = 'var(--g-activo)', A2 = 'var(--g-compara)';
    const fv = conV ? [flechaSvg(g, 'v', A1), flechaSvg(g, 'v', A2)] : null, fu = ejes ? [flechaSvg(g, '', A1), flechaSvg(g, '', A2)] : null;
    const rv = conV ? ['$\\boldsymbol{v}_1$', '$\\boldsymbol{v}_2$'].map(t => rotular(t, g, ov)) : null;
    const ru = ejes ? ['$\\sigma_1\\boldsymbol{u}_1$', '$\\sigma_2\\boldsymbol{u}_2$'].map(t => rotular(t, g, ov)) : null;
    const est = { k: REDUCIDO ? 1 : 0, t0: 0 }, N = 72, CS = Array.from({ length: N }, (_, i) => [Math.cos(2 * Math.PI * i / N), Math.sin(2 * Math.PI * i / N)]);
    return (c, pedir) => {
      if (est.k < 1 && pedir) pedir(est);
      const M = mezclaI(s.m.map(f => f.map(x => c.C(x))), ease(est.k)), ok = M.flat().every(Number.isFinite);
      ocultar(el, !ok); if (c0) ocultar(c0, !ok); if (!ok) return;
      const camino = T => CS.map(([x, y], i) => { const q = T(x, y); return `${i ? 'L' : 'M'}${cl(c.px(q[0])).toFixed(1)} ${cl(c.py(q[1])).toFixed(1)}`; }).join('') + 'Z';
      if (c0) c0.setAttribute('d', camino((x, y) => [x, y]));
      el.setAttribute('d', camino((x, y) => mul(M, [x, y])));
      if (!ejes) return;
      const S = svd2(M), o = [c.px(0), c.py(0)];
      [[S.s1, S.u1], [S.s2, S.u2]].forEach(([sg, u], i) => {
        const p = [c.px(sg * u[0]), c.py(sg * u[1])]; fu[i](...o, ...p); ru[i](...junto(...o, ...p), Math.hypot(p[0] - o[0], p[1] - o[1]) < 3);
      });
      if (conV) [S.v1, S.v2].forEach((v, i) => { const p = [c.px(v[0]), c.py(v[1])]; fv[i](...o, ...p); rv[i](...junto(...o, ...p)); });
    };
  },
  // propios {m, vecs?}: rectas de los subespacios propios reales de m; en cada una 𝐯 (unitario, discontinuo) y A𝐯 = λ𝐯 (lleno)
  // con «λᵢ = …» (vecs: false deja solo las rectas). λ complejos: sin rectas y un aviso; λ doble defectuoso: una sola recta y
  // aviso; A = λI: el plano entero sombreado (todo vector es propio).
  propios(s, g) {
    const COL = ['var(--g-activo)', 'var(--g-compara)'], plano = nodo('rect', 'sp', { x: 0, y: 0, width: PW, height: PH }); g.append(plano);
    const rs = COL.map(col => { const ln = nodo('path', 'pl', { stroke: col }); g.append(ln); return ln; });
    const fv = s.vecs === false ? null : COL.map(col => flechaSvg(g, 'v', col)), fa = s.vecs === false ? null : COL.map(col => flechaSvg(g, '', col));
    const tl = COL.map(() => { const t = nodo('text', 'ev', { 'text-anchor': 'middle', dy: '.35em' }); g.append(t); return t; });
    const aviso = nodo('text', 'ev', { x: 10, y: 18 }); g.append(aviso);
    const txt = ['', '', ''], pon = (i, e, t) => { if (txt[i] !== t) { txt[i] = t; e.textContent = t; } };
    return c => {
      const M = s.m.map(f => f.map(x => c.C(x))), ok = M.flat().every(Number.isFinite), E = ok ? eig2(M) : null, es = lang() === 'es';
      const f = x => formatear(Math.abs(x) < 5e-3 ? 0 : +x.toFixed(2), lang());
      const dirs = !E || !E.reales || (E.doble && !E.defectuosa) ? [] : E.defectuosa ? [[E.v1, E.l1]] : [[E.v1, E.l1], [E.v2, E.l2]];
      ocultar(plano, !(E && E.reales && E.doble && !E.defectuosa));
      const R = 4 * Math.hypot(c.w[1] - c.w[0], c.w[3] - c.w[2]), o = [c.px(0), c.py(0)];
      for (let i = 0; i < 2; i++) {
        const d = dirs[i]; ocultar(rs[i], !d); ocultar(tl[i], !d);
        if (!d) { fv?.[i](0, 0, NaN, 0); fa?.[i](0, 0, NaN, 0); continue; }
        const [v, l] = d, P = [c.px(v[0]), c.py(v[1])], Q = [c.px(l * v[0]), c.py(l * v[1])];
        rs[i].setAttribute('d', `M${cl(c.px(-R * v[0])).toFixed(1)} ${cl(c.py(-R * v[1])).toFixed(1)}L${cl(c.px(R * v[0])).toFixed(1)} ${cl(c.py(R * v[1])).toFixed(1)}`);
        fv?.[i](...o, ...P); fa?.[i](...o, ...Q);
        const ex = Math.abs(l) > 1 ? Q : P, [lx, ly] = junto(...o, ...ex);
        pon(i, tl[i], `λ${i ? '₂' : '₁'} = ${f(l)}`); attr(tl[i], { x: lim(lx, 34, PW - 34), y: lim(ly, 12, PH - 12) });
      }
      const av = !E ? '' : !E.reales ? (es ? `λ = ${f(E.re)} ± ${f(E.im)}i: sin rectas propias reales` : `λ = ${f(E.re)} ± ${f(E.im)}i: no real eigenlines`)
        : E.defectuosa ? (es ? `λ doble = ${f(E.l1)}: una sola recta propia (defectuosa)` : `double λ = ${f(E.l1)}: a single eigenline (defective)`)
          : E.doble ? (es ? `A = λI, λ = ${f(E.l1)}: todo vector es propio` : `A = λI, λ = ${f(E.l1)}: every vector is an eigenvector`) : '';
      pon(2, aviso, av); ocultar(aviso, !av);
    };
  },
  recta(s, g, ov) {
    const color = s.color ?? 'var(--g-activo)', ln = nodo('path', 'rec', { stroke: color }); g.append(ln);
    const rot = rotular(s.nombre ?? '', g, ov);
    return c => {
      const q = segRecta(c.C(s.a), c.C(s.b), c.C(s.c), c.w); ocultar(ln, !q); if (!q) { rot(0, 0, true); return; }
      const [x0, y0, x1, y1] = [c.px(q[0]), c.py(q[1]), c.px(q[2]), c.py(q[3])];
      ln.setAttribute('d', `M${cl(x0).toFixed(1)} ${cl(y0).toFixed(1)}L${cl(x1).toFixed(1)} ${cl(y1).toFixed(1)}`);
      // rótulo: punto de la recta dentro del plano, cerca del borde derecho (o superior si es casi vertical)
      const tA = lim(((PW - 46) - x0) / ((x1 - x0) || 1e-9), 0, 1), tB = lim((26 - y0) / ((y1 - y0) || 1e-9), 0, 1);
      let t = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? tA : tB, X = x0 + (x1 - x0) * t, Y = y0 + (y1 - y0) * t;
      if (Y < 12 || Y > PH - 12) { t = tB; X = x0 + (x1 - x0) * t; Y = y0 + (y1 - y0) * t; }
      rot(lim(X, 20, PW - 20), lim(Y - 14, 12, PH - 12), false);
    };
  },
  punto(s, g, ov) {
    const pt = nodo('circle', s.abierto ? 'pt ab' : 'pt', { r: 5 }); g.append(pt);
    const rot = rotular(s.nombre ?? '', g, ov);
    return c => {
      const x = c.C(s.x), y = c.C(s.y), ok = Number.isFinite(x) && Number.isFinite(y); ocultar(pt, !ok);
      if (ok) attr(pt, { cx: c.px(x), cy: c.py(y) }); rot(c.px(x) + 14, c.py(y) - 14, !ok);
    };
  },
  texto(s, g, ov) {
    const rot = rotular(L(s.s), g, ov, s.ancla ?? 'start');
    return c => rot(c.px(c.C(s.x)), c.py(c.C(s.y)), false);
  },
  // ── proyeccion y bola (MML §3.1–3.8) ──
  proyeccion(s, g, ov) {
    const bs = Array.isArray(s.sobre) && (typeof s.sobre[0] === 'string' || Array.isArray(s.sobre[0])) ? s.sobre : [s.sobre];
    const recta = s.recta === false ? null : nodo('path', 'pjU'), err = nodo('path', 'pjE'), ang = nodo('path', 'pjR');
    if (recta) g.append(recta);
    g.append(err, ang);
    const fl = flechaSvg(g, 'r', 'var(--g-camino)'), rot = rotular(s.nombre ?? '$\\pi_U(\\boldsymbol{x})$', g, ov);
    const P = (x, y) => `${cl(x).toFixed(1)} ${cl(y).toFixed(1)}`;
    return c => {
      const x = c.V(s.x), B = bs.map(c.V), A = s.A ? s.A.map(f => f.map(c.C)) : undefined, x0 = s.de !== undefined ? c.V(s.de) : [0, 0];
      const ok = fin(x) && fin(x0) && B.every(fin) && A?.flat().every(Number.isFinite) !== false && defPos(A);
      // afín (MML ec. 3.72): πL(x) = x0 + πU(x − x0)
      const r = ok ? proyectar([x[0] - x0[0], x[1] - x0[1]], B, A) : { d: -1 };
      const malo = r.d < 0;
      ocultar(err, malo || r.d === 2); ocultar(ang, malo || r.d !== 1); if (recta) ocultar(recta, malo || r.d !== 1);
      if (malo) { fl(NaN, 0, 0, 0); rot(0, 0, true); return; }
      const o = [c.px(x0[0]), c.py(x0[1])], q = [c.px(x0[0] + r.p[0]), c.py(x0[1] + r.p[1])], X = [c.px(x[0]), c.py(x[1])];
      fl(...o, ...q); rot(...junto(...o, ...q), Math.hypot(q[0] - o[0], q[1] - o[1]) < 2);
      if (r.d === 2) return;
      err.setAttribute('d', `M${P(...X)}L${P(...q)}`);
      if (r.d !== 1) return;
      const b = B.find(v => Math.hypot(v[0], v[1]) > EPS), k = 4 * Math.hypot(c.w[1] - c.w[0], c.w[3] - c.w[2]) / Math.hypot(b[0], b[1]);
      if (recta) recta.setAttribute('d', `M${P(c.px(x0[0] - k * b[0]), c.py(x0[1] - k * b[1]))}L${P(c.px(x0[0] + k * b[0]), c.py(x0[1] + k * b[1]))}`);
      // marca de ángulo «recto»: paralelogramo con lados a lo largo de b y de x − π en píxeles. Con el producto escalar es un
      // cuadrado; con otro ⟨·,·⟩_A se ve oblicuo: «ortogonal» depende del producto interno.
      const ux = c.px(b[0]) - o[0], uy = c.py(b[1]) - o[1], lu = Math.hypot(ux, uy), ex = X[0] - q[0], ey = X[1] - q[1], le = Math.hypot(ex, ey);
      if (le < 12 || lu < 1) { ocultar(ang, true); return; }
      const sgn = (q[0] - o[0]) * ux + (q[1] - o[1]) * uy > 0 ? -1 : 1, m = 10;  // la marca apunta hacia el origen
      const a1 = [q[0] + sgn * ux / lu * m, q[1] + sgn * uy / lu * m], a2 = [q[0] + ex / le * m, q[1] + ey / le * m];
      ang.setAttribute('d', `M${P(...a1)}L${P(a1[0] + ex / le * m, a1[1] + ey / le * m)}L${P(...a2)}`);
    };
  },
  bola(s, g) {
    const p = nodo('path', 'bo'); g.append(p);
    let clave = '', d = '';
    return c => {
      const A = s.A ? s.A.map(f => f.map(c.C)) : undefined, pp = s.p === 'inf' ? 'inf' : c.C(s.p), r = s.r === undefined ? 1 : c.C(s.r);
      const pts = contornoBola(pp, r, A); ocultar(p, !pts); if (!pts) return;
      // el contorno solo depende de (p, r, A): se recalcula si cambian; la proyección a píxeles se rehace siempre (ventana animada)
      const k = `${pp}|${r}|${A ? A.flat().join(',') : ''}|${c.w.join(',')}`;
      if (k !== clave) { clave = k; d = 'M' + pts.map(q => `${cl(c.px(q[0])).toFixed(1)} ${cl(c.py(q[1])).toFixed(1)}`).join('L') + 'Z'; p.setAttribute('d', d); }
    };
  },
};

export const crear = stage => new Vectores(stage);

export class Vectores {
  constructor(stage) {
    this.stage = stage; stage.classList.add('vc');
    this.def = null; this.cur = this.to = this.tw = null; this.cb = null; this.W = W; this.H = SH;
    this.mu = new Map(); this.rect = null; this.arr = null; this.parar = this.sp = this.anim = null;
    addEventListener('scroll', () => { this.rect = null; }, { passive: true, capture: true });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => { this.rect = null; }).observe(stage.parentElement || stage);
  }

  get tam() { return { W: this.W, H: this.H }; }

  fijar(def) {
    if (def === this.def) return;
    this.parar?.(); this.sp?.(); this.anim?.(); this.parar = this.sp = this.anim = null; inyectarCss();
    this.def = def; this.cur = this.to = this.tw = null; this.capasRef = null; this.capas = []; this.gridK = '';
    this.mu = new Map(); this.rect = null; this.arr = null; this.cerca = false; this.ticksX = []; this.ticksY = [];
    this.stage.classList.remove('drag', 'cerca');
    this.uid = (Vectores.n = (Vectores.n || 0) + 1);
    this.H = SH + def.deslizadores.length * FILA + 6;
    this.stage.replaceChildren();
    const svg = this.svg = nodo('svg', '', { width: W, height: SH, viewBox: `0 0 ${W} ${SH}`, role: 'img' });
    const clip = nodo('clipPath', '', { id: `vcl${this.uid}` }); clip.append(nodo('rect', '', { x: 0, y: 0, width: PW, height: PH }));
    const dfs = nodo('defs'); dfs.append(clip);
    const plot = nodo('g', '', { transform: `translate(${ML},${MT})` });
    this.gMay = nodo('path', 'gM'); this.gTicks = nodo('g');
    this.marco = nodo('rect', 'marco', { x: 0, y: 0, width: PW, height: PH });
    this.ejeX = nodo('line', 'eje'); this.ejeY = nodo('line', 'eje');
    const gc = nodo('g', '', { 'clip-path': `url(#vcl${this.uid})` }); this.gCapas = nodo('g'); gc.append(this.gCapas);
    this.hit = nodo('rect', 'hit', { x: 0, y: 0, width: PW, height: PH });
    plot.append(this.gMay, this.gTicks, this.marco, this.ejeX, this.ejeY, gc, this.hit);
    const ov = this.ov = div('ov'); this.ovCapas = div('ovc'); ov.append(this.ovCapas);
    // Asas (una por vector arrastrable): Tab + flechas
    this.asas = def.arrastrar.map(n => {
      const g = nodo('g', 'asa', { tabindex: 0, role: 'slider', 'aria-roledescription': '2D', display: 'none' });
      g.append(nodo('circle', 'zona', { r: 18 }), nodo('circle', 'halo', { r: 11 })); plot.append(g);
      g.addEventListener('keydown', e => this.tecla(n, e));
      return { n, g, zona: g.firstChild, halo: g.lastChild, val: '' };
    });
    svg.append(dfs, plot); this.stage.append(svg, ov);
    this.desl = def.deslizadores.map((d, i) => {
      const row = div('desl'); row.style.top = SH + 2 + i * FILA + 'px';
      const lab = document.createElement('label'), inp = document.createElement('input'), out = document.createElement('output');
      inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.paso ?? (d.max - d.min) / 200;
      inp.addEventListener('input', () => this.entrada('p:' + d.par, +inp.value));
      row.append(lab, inp, out); this.stage.append(row);
      return { d, lab, inp, out, row, ls: null };
    });
    // Arrastre: el rectángulo del SVG se lee al empezar (o al primer movimiento de la visita), nunca por fotograma
    const mundo = e => {
      const r = this.rect, s = r.width / W, [x0, x1, y0, y1] = this.cur.win;
      const lx = lim((e.clientX - r.left) / s - ML, 0, PW), ly = lim((e.clientY - r.top) / s - MT, 0, PH);
      return [x0 + lx / PW * (x1 - x0), y1 - ly / PH * (y1 - y0), lx, ly];
    };
    const cercano = (lx, ly, r = 36) => {
      let mejor = null, dm = r;
      for (const n of def.arrastrar) { const v = this.objetivo(n), d = Math.hypot(this.px(v[0]) - lx, this.py(v[1]) - ly); if (d < dm) { dm = d; mejor = n; } }
      return mejor;
    };
    const mover = (e, suave) => { const [x, y] = mundo(e), p = def.paso || .01; this.vecA(this.arr, [ajustar(x, p), ajustar(y, p)], suave); };
    const abajo = e => {
      if (!def.arrastrar.length || e.button || !this.cur) return;
      this.rect = this.svg.getBoundingClientRect();
      const [, , lx, ly] = mundo(e), asa = this.asas.find(a => a.g === e.currentTarget);
      const n = asa ? asa.n : cercano(lx, ly) ?? (def.arrastrar.length === 1 ? def.arrastrar[0] : null);
      if (!n) return;
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      this.arr = n; this.stage.classList.add('drag');
      const A = this.asas.find(a => a.n === n); A?.g.classList.add('on'); A?.g.focus({ preventScroll: true });
      mover(e, true);
    };
    const mueve = e => {
      if (this.arr) return mover(e, false);
      if (e.pointerType === 'touch' || !def.arrastrar.length || !this.cur) return;
      if (!this.rect) this.rect = this.svg.getBoundingClientRect();
      const [, , lx, ly] = mundo(e), c = !!cercano(lx, ly);
      if (c !== this.cerca) { this.cerca = c; this.stage.classList.toggle('cerca', c); }
    };
    const suelta = e => {
      if (!this.arr) return;
      this.asas.forEach(a => a.g.classList.remove('on')); this.arr = null; this.stage.classList.remove('drag');
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    };
    for (const el of [this.hit, ...this.asas.map(a => a.g)]) {
      el.addEventListener('pointerdown', abajo); el.addEventListener('pointermove', mueve);
      el.addEventListener('pointerup', suelta); el.addEventListener('pointercancel', suelta);
      el.addEventListener('pointerenter', () => { if (!this.arr) this.rect = null; });
    }
  }

  /** ids truthy: avisa cb(clave, valor) al arrastrar un vector ([x,y]) o mover un deslizador (número). */
  arrastre(ids, cb) { this.cb = ids ? cb : null; }

  tecla(n, e) {
    const st = (this.def.paso || .25) * (e.shiftKey ? 4 : 1), v = this.objetivo(n);
    const d = { ArrowRight: [st, 0], ArrowLeft: [-st, 0], ArrowUp: [0, st], ArrowDown: [0, -st] }[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation(); // las flechas no deben pasar de paso mientras el asa tiene el foco
    const [x0, x1, y0, y1] = this.cur.win;
    this.vecA(n, [+lim(v[0] + d[0], x0, x1).toFixed(4), +lim(v[1] + d[1], y0, y1).toFixed(4)], true);
  }

  /** Valor final (el que persigue el muelle) de un vector. */
  objetivo(n) { const v = this.cur.vec[n]; return [this.mu.get(`v:${n}:0`)?.a ?? v[0], this.mu.get(`v:${n}:1`)?.a ?? v[1]]; }

  vecA(n, xy, suave) {
    const v0 = this.objetivo(n); if (v0[0] === xy[0] && v0[1] === xy[1]) return;
    this.entrada(`v:${n}:0`, xy[0], suave, true); this.entrada(`v:${n}:1`, xy[1], suave, true);
    this.cb?.(n, [xy[0], xy[1]]);
  }

  leer(k) { const [t, a, i] = k.split(':'); return t === 'p' ? this.cur.par[a] : this.cur.vec[a][+i]; }
  poner(k, x) { const [t, a, i] = k.split(':'); if (t === 'p') this.cur.par[a] = x; else this.cur.vec[a][+i] = x; }

  /**
   * Fija una componente ('p:a' parámetro, 'v:u:0' componente de vector) a `x`. El dibujo la sigue con un Muelle (conserva la
   * velocidad si el objetivo cambia a mitad); el aviso `cb` lleva ya el valor final. Con movimiento reducido, salto directo.
   */
  entrada(k, x, suave = false, callado = false) {
    if (!this.cur) return;
    const m0 = this.mu.get(k), [t, a, i] = k.split(':');
    if ((m0 ? m0.a : this.leer(k)) === x) return;
    if (this.to) { if (t === 'p') this.to.par[a] = x; else this.to.vec[a][+i] = x; }
    if (this.tw) for (const o of [this.tw.from, this.tw.to]) { if (t === 'p') o.par[a] = x; else o.vec[a][+i] = x; }
    if (REDUCIDO) { this.mu.delete(k); this.poner(k, x); this.dibujar(); }
    else {
      const m = m0 ?? new Muelle(this.leer(k), 26, 1e-4); m.w = suave ? 14 : 26; m.ir(x); this.mu.set(k, m);
      this.sp ??= tarea((_, dt) => this.pasoMuelles(dt));
    }
    if (!callado && t === 'p') this.cb?.(a, x);
  }

  pasoMuelles(dt) {
    if (this.cur) { for (const [k, m] of this.mu) { this.poner(k, m.paso(dt)); if (m.quieto) this.mu.delete(k); } this.dibujar(); }
    else this.mu.clear();
    if (this.mu.size) return true;
    this.sp = null; return false;
  }

  pintar(S, animar = true) {
    const dur = animar === true ? 460 : +animar || 0, anim = dur > 0 && !REDUCIDO, D = this.def, idi = lang();
    const win = ventanaEf(S.ventana, PW, PH);
    const to = { win, par: Object.fromEntries(Object.entries(S.par).filter(([, v]) => typeof v === 'number')), vec: copiaVec(S.vec) };
    if (!this.cur) this.cur = { win: [...win], par: { ...to.par }, vec: copiaVec(to.vec) };
    // Un muelle conserva su animación si el estado trae su mismo objetivo (eco de `jugar`); si trae otro, manda la transición
    const sig = new Set([...this.mu.keys()].filter(k => {
      const [t, a, i] = k.split(':'), obj = t === 'p' ? to.par[a] : to.vec[a]?.[+i];
      if (obj === this.mu.get(k).a) return true; this.mu.delete(k); return false;
    }));
    if (S.capas !== this.capasRef || idi !== this.capasIdi) {
      this.capasRef = S.capas; this.capasIdi = idi; this.gCapas.replaceChildren(); this.ovCapas.replaceChildren(); this.anim?.(); this.anim = null;
      this.capas = S.capas.map(sp => { const g = nodo('g'); this.gCapas.append(g); return CAPAS[sp.tipo]?.(sp, g, this.ovCapas, D); }).filter(Boolean);
      if (anim) { this.gCapas.animate({ opacity: [0, 1] }, { duration: 240 }); this.ovCapas.animate({ opacity: [0, 1] }, { duration: 240 }); }
    }
    this.svg.setAttribute('aria-label', L(D.etiqueta) || UI[idi].plano);
    const usados = new Set(nombresEn(S.capas));
    this.desl.forEach(o => {
      const { d, lab, inp, row } = o, s = L(d);
      if (o.ls !== s) { o.ls = s; etiqueta(lab, s); inp.setAttribute('aria-label', s.replace(/\$/g, '')); }
      row.style.visibility = usados.has(d.par) ? '' : 'hidden';
    });
    for (const A of this.asas) A.g.setAttribute('aria-label', `${UI[idi].asa} ${A.n}`);
    this.to = to; this.parar?.(); this.parar = null;
    const igual = this.cur.win.every((v, i) => v === win[i])
      && Object.keys(to.par).every(k => sig.has('p:' + k) || this.cur.par[k] === to.par[k])
      && Object.keys(to.vec).every(n => [0, 1].every(i => sig.has(`v:${n}:${i}`) || this.cur.vec[n]?.[i] === to.vec[n][i]));
    if (!anim || igual) {
      const cur = { win: [...win], par: { ...to.par }, vec: copiaVec(to.vec) };
      for (const k of sig) { const [t, a, i] = k.split(':'), x = this.leer(k); if (t === 'p') cur.par[a] = x; else cur.vec[a][+i] = x; }
      this.cur = cur; this.tw = null; this.dibujar(); return;
    }
    this.tw = { t0: performance.now(), dur, from: { win: [...this.cur.win], par: { ...this.cur.par }, vec: copiaVec(this.cur.vec) }, to };
    if (this.frame(this.tw.t0)) this.parar = tarea(now => this.frame(now));
  }

  /** Un fotograma de la transición de ventana/parámetros/vectores (contrato de `tarea`). */
  frame = now => {
    const T = this.tw; if (!T) return false;
    const k = Math.min(1, (now - T.t0) / T.dur), e = ease(k), c = this.cur, a = T.from, b = T.to;
    c.win = a.win.map((v, i) => v + (b.win[i] - v) * e);
    for (const p in b.par) if (!this.mu.has('p:' + p)) c.par[p] = typeof a.par[p] === 'number' ? a.par[p] + (b.par[p] - a.par[p]) * e : b.par[p];
    for (const n in b.vec) { c.vec[n] ??= [...b.vec[n]]; for (const i of [0, 1]) if (!this.mu.has(`v:${n}:${i}`)) { const f = a.vec[n]?.[i] ?? b.vec[n][i]; c.vec[n][i] = f + (b.vec[n][i] - f) * e; } }
    this.dibujar();
    if (k < 1) return true;
    this.tw = null; return false;
  };

  /** Animación de aparición de una capa (rejilla): avanza su `k` en la tarea compartida hasta 1. */
  pedir = est => {
    if (est.vivo) return; est.vivo = true; est.t0 = performance.now();
    const stop = tarea(now => { est.k = Math.min(1, (now - est.t0) / 700); this.dibujar(); if (est.k < 1) return true; est.vivo = false; return false; });
    const ant = this.anim; this.anim = () => { ant?.(); stop(); };
  };

  dibujar() {
    const c = this.cur, [wx0, wx1, wy0, wy1] = c.win, idi = lang();
    const px = this.px = x => (x - wx0) / (wx1 - wx0) * PW, py = this.py = y => (wy1 - y) / (wy1 - wy0) * PH;
    const gk = c.win.map(v => v.toFixed(4)).join('|');
    if (gk !== this.gridK) { // rejilla y numerales: solo cuando cambia la ventana
      this.gridK = gk;
      const tx = ticks125(wx0, wx1, 10), paso = tx.length > 1 ? tx[1] - tx[0] : 1, ty = [];
      for (let v = Math.ceil(wy0 / paso - 1e-9) * paso; v <= wy1 + 1e-9; v += paso) ty.push(+v.toPrecision(12));
      let M = '';
      for (const v of tx) M += `M${px(v).toFixed(1)} 0V${PH}`;
      for (const v of ty) M += `M0 ${py(v).toFixed(1)}H${PW}`;
      this.gMay.setAttribute('d', M);
      const x0 = lim(px(0), 0, PW), y0 = lim(py(0), 0, PH);
      attr(this.ejeX, { x1: 0, x2: PW, y1: y0, y2: y0 }); attr(this.ejeY, { x1: x0, x2: x0, y1: 0, y2: PH });
      this.actTicks(this.ticksX, tx.filter(v => v !== 0), idi, (v, t) => attr(t, { x: px(v), y: PH + 16, 'text-anchor': 'middle' }));
      this.actTicks(this.ticksY, ty.filter(v => v !== 0), idi, (v, t) => attr(t, { x: -7, y: py(v), dy: '.32em', 'text-anchor': 'end' }));
    }
    const C = x => num(x, c.par), V = a => vecDe(a, c.vec, c.par), cx = { px, py, w: c.win, par: c.par, V, C };
    for (const u of this.capas) u(cx, this.pedir);
    for (const A of this.asas) {
      const v = c.vec[A.n], X = px(v[0]), Y = py(v[1]), ok = fin(v) && X >= -2 && X <= PW + 2 && Y >= -2 && Y <= PH + 2;
      A.g.setAttribute('display', ok ? 'inline' : 'none'); if (!ok) continue;
      attr(A.zona, { cx: X, cy: Y }); attr(A.halo, { cx: X, cy: Y });
      const o = this.objetivo(A.n), s = `(${formatear(o[0], idi)}${idi === 'es' ? ' ; ' : ', '}${formatear(o[1], idi)})`;
      if (s !== A.val) { A.val = s; A.g.setAttribute('aria-valuetext', s); }
    }
    this.desl.forEach(({ d, inp, out }) => {
      const v = this.mu.get('p:' + d.par)?.a ?? c.par[d.par];
      if (typeof v === 'number') { if (+inp.value !== v) inp.value = v; const s = formatear(+v.toFixed(d.dec ?? 2), idi); if (out.textContent !== s) out.textContent = s; }
    });
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
