// Escena «tabla»: rejilla de hasta 14×14 celdas con cabeceras de fila y columna, para programación dinámica (LCS, mochila,
// distancia de edición), matrices de adyacencia, tablas hash y tablas de prefijos. Cada celda tiene un valor (vacío = aún sin
// calcular) y un estado; las filas y columnas se pueden resaltar; flechas de dependencia opcionales (de la celda leída a la
// calculada); marcas con nombre sobre las cabeceras (i, j…) y una fórmula bajo la rejilla. Implementa el contrato de escena de
// guia.js: clave, plegar (pura), crear → {fijar, pintar, tam, arrastre}, vista/conVista/ctx.
//
// ── FORMATO ─────────────────────────────────────────────────────────────────────────────────────────────────────────
// Un paso ABRE la escena con
//   tabla: {
//     filas, cols,                      nº de filas y columnas (1..14, más no se lee bien)
//     cab?: {filas?: [..], cols?: [..], esq?: texto}   cabeceras: texto corto (≤ 8 car.), número u objeto {es,en}. Sin ellas se
//                                       numeran 0, 1, 2… `esq` = texto de la esquina (p. ej. «i\j»).
//     val?: [[..]]                      valores iniciales (matriz filas×cols; null / '' = vacía; filas o huecos que falten = vacía)
//     formula?: false                   no reserva la línea de fórmula bajo la rejilla (por defecto sí: así la escena no salta)
//   }
// Parches acumulativos (en pasos Y en frames de `traza`; `plegar` es pura), aplicados en este orden:
//   val: [[r,c,v], …]                   escribe esas celdas (v null/'' la vacía)
//        | {"r,c": v, …}                lo mismo en forma de mapa
//        | [[..], [..], …]              matriz completa filas×cols: undefined = sin tocar, null = vacía
//        (si una lista de ternas tiene justo `filas` elementos y la rejilla tiene 3 columnas, se lee como matriz: usa el mapa)
//   est: {"r,c": estado|null}           estado por celda; null lo limpia; est:null limpia todo
//   deps: [[r,c, r2,c2], …] | null      flechas de la celda LEÍDA (r,c) a la CALCULADA (r2,c2); REEMPLAZA la lista; null/[] las quita
//   marcas: {nombre: {fila:i}|{col:j}|null}   marca con nombre junto a la cabecera de la fila i / sobre la de la columna j
//                                       (nombres de 1 a 3 car.; se apilan si comparten cabecera); null la quita; marcas:null todas
//   resaltar: {filas?:[i…], cols?:[j…]} | null   banda tenue tras esas filas/columnas; REEMPLAZA lo anterior; null = nada
//   formula: texto | {es,en} | null     línea bajo la rejilla; `código` entre acentos graves; REEMPLAZA; null la borra
//   hl {"r,c": estado}                  (lo añade guia.js: énfasis solo del paso) mismo formato que `est`, se superpone
// Estados de celda (forma además de color, accesible): activa = anillo grueso (la que se calcula), lee = borde discontinuo y
//   fondo amarillo (de la que se lee), hecha = verde con esquina marcada, camino = azul/violeta con doble borde (traceback),
//   mal = rojo con rayas y borde punteado, elegida = contorno (hover/foco de `jugar`; también puede fijarse con `est`).
// Colores: SOLO variables --g-activo, --g-compara, --g-hecho, --g-camino, --g-mal, --g-aux (con respaldo si no existen).
// Animación: solo transform/opacity (el valor «brota» al escribirse, las flechas se dibujan, las marcas se deslizan).
//
// `jugar`: jugar.arrastrables = true | ["r,c", …] | [[r,c], …] activa el clic en celda (Pointer Events; teclado: Tab llega a la
//   rejilla, flechas mueven el foco entre celdas, Enter/Espacio eligen). Al elegir se llama soltar(v, r, c, cx) (misma
//   convención que las demás escenas: el segundo argumento de `soltar` son los del módulo, el último es ctx).
//   v = vista(S) = {val, est, deps, marcas, formula, resaltar} mutable (val es matriz filas×cols); helpers: poner, leer, estado, llave.
//   ctx(S) = {filas, cols, cabF, cabC, inicial (matriz), def}.
// La lógica pura (geometría, flechas, plegar, helpers) no toca el DOM al importar, así se prueba en Node.
import { idioma } from './idioma.js';

export const clave = 'tabla';
export const MAXN = 14;
export const ESTADOS = ['activa', 'lee', 'hecha', 'camino', 'mal', 'elegida'];
export const PAD = 14, MKW = 28, MKH = 24, HH = 30, FH = 46, MINW = 420;
const NS = 'http://www.w3.org/2000/svg';
const L = x => ((x && typeof x === 'object' ? x[globalThis.document ? idioma() : 'es'] : x) ?? '');
const txt = v => String(L(v));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ent = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
/** Clave de celda «r,c» (la de est, hl, val-mapa). */
export const llave = (r, c) => r + ',' + c;
/** «r,c» → [r, c] o null. */
export const deLlave = k => { const m = /^(\d+),(\d+)$/.exec(String(k)); return m ? [+m[1], +m[2]] : null; };

// ── Lógica pura ──────────────────────────────────────────────────────────────────────────────────

/** Valor de celda normalizado: undefined = sin tocar, null = vacía, número finito o texto. */
const norm = v => (v === undefined ? undefined : v === null || v === '' ? null : typeof v === 'number' && Number.isFinite(v) ? v : String(L(v)));
const matrizVacia = (f, c) => Array.from({ length: f }, () => Array(c).fill(null));
const copiaM = m => m.map(f => [...f]);
/** ¿Es `val` una matriz completa filas×cols? (si no, es lista de ternas o mapa) */
export const esMatriz = (val, filas, cols) => Array.isArray(val) && val.length === filas && val.every(f => Array.isArray(f) && f.length === cols);

/** Aplica un parche `val` (ternas, mapa o matriz) sobre la matriz `m` (se MUTA: pasa una copia). Ignora lo que se sale. */
export function aplicarVal(m, val, filas = m.length, cols = m[0]?.length ?? 0) {
  const ok = (r, c) => ent(r, 0, filas - 1) && ent(c, 0, cols - 1);
  if (Array.isArray(val)) {
    if (esMatriz(val, filas, cols)) {
      for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) { const x = norm(val[r][c]); if (x !== undefined) m[r][c] = x; }
    } else {
      for (const t of val) if (Array.isArray(t) && t.length >= 3 && ok(t[0], t[1])) { const x = norm(t[2]); if (x !== undefined) m[t[0]][t[1]] = x; }
    }
  } else if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) { const p = deLlave(k), x = norm(v); if (p && ok(p[0], p[1]) && x !== undefined) m[p[0]][p[1]] = x; }
  }
  return m;
}

/** Matriz inicial (la de `tabla.val`): puede venir incompleta; lo que falte queda vacío. */
const matrizDe = (val, filas, cols) => Array.from({ length: filas }, (_, r) => Array.from({ length: cols }, (_, c) => norm(val?.[r]?.[c]) ?? null));

const DEFS = new WeakMap(); // memo: el mismo objeto `tabla:{}` da siempre el mismo def (guia.js re-pliega en cada paso)
/** Normaliza el objeto que abre la escena. Mismo objeto de entrada → mismo def (identidad estable). */
export function defDe(b) {
  const memo = b && typeof b === 'object' && DEFS.get(b);
  if (memo) return memo;
  const filas = clamp(Math.floor(+b?.filas) || 1, 1, MAXN), cols = clamp(Math.floor(+b?.cols) || 1, 1, MAXN);
  const cab = (xs, n) => Array.from({ length: n }, (_, i) => (Array.isArray(xs) ? (xs[i] ?? '') : i));
  const def = {
    filas, cols, cabF: cab(b?.cab?.filas, filas), cabC: cab(b?.cab?.cols, cols), esq: b?.cab?.esq ?? '',
    val: matrizDe(b?.val, filas, cols), formula: b?.formula !== false,
  };
  if (b && typeof b === 'object') DEFS.set(b, def);
  return def;
}

/** Tamaño de celda según cuántas hay: pocas = grandes. */
export const tamCelda = n => (n <= 3 ? 72 : n <= 4 ? 64 : n <= 6 ? 56 : n <= 8 ? 48 : n <= 10 ? 42 : n <= 12 ? 38 : 34);

/** Geometría lógica: tamaño, origen de la rejilla, ancho de la cabecera de fila. Solo aritmética. */
export function geom(def) {
  const cs = tamCelda(Math.max(def.filas, def.cols));
  const larga = Math.max(0, ...def.cabF.map(x => txt(x).length));
  const hw = clamp(Math.ceil(larga * 8) + 18, 34, 96);
  const gw = def.cols * cs, gh = def.filas * cs, cw = MKW + hw + gw;
  const W = Math.max(MINW, cw + 2 * PAD);
  const x0 = (W - cw) / 2 + MKW + hw, y0 = PAD + MKH + HH, fy = y0 + gh + 12;
  const H = def.formula ? fy + FH + PAD - 6 : y0 + gh + PAD;
  return { W, H, cs, hw, hh: HH, gw, gh, x0, y0, fy, filas: def.filas, cols: def.cols, caja: cs - 4 };
}
/** Centro lógico de la celda (r, c). */
export const centro = (g, r, c) => ({ x: g.x0 + (c + .5) * g.cs, y: g.y0 + (r + .5) * g.cs });

/**
 * Flecha de dependencia de la celda leída (r1,c1) a la calculada (r2,c2): {d (trazo), cabeza (puntos del triángulo), punta}.
 * Sale y llega por el borde de las celdas; si no son vecinas se curva un poco para no ocultar las del medio.
 */
export function flecha(g, [r1, c1, r2, c2]) {
  const s = centro(g, r1, c1), t = centro(g, r2, c2), h = g.caja / 2 + 1.5;
  const dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy);
  if (!len) return null;
  const vecina = Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1, bend = vecina ? 0 : Math.min(30, len * .2);
  const q = { x: (s.x + t.x) / 2 - (dy / len) * bend, y: (s.y + t.y) / 2 + (dx / len) * bend };
  const sale = (o, hacia) => { // punto donde el rayo desde el centro de la celda hacia `hacia` cruza su borde
    const ax = hacia.x - o.x, ay = hacia.y - o.y, k = h / Math.max(Math.abs(ax), Math.abs(ay));
    return { x: o.x + ax * k, y: o.y + ay * k };
  };
  const a = sale(s, q), p = sale(t, q), tx = p.x - q.x, ty = p.y - q.y, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
  const base = { x: p.x - ux * 7, y: p.y - uy * 7 }, f = n => +n.toFixed(1);
  return {
    d: `M${f(a.x)} ${f(a.y)}Q${f(q.x)} ${f(q.y)} ${f(base.x + ux * 1.5)} ${f(base.y + uy * 1.5)}`,
    cabeza: [p, { x: base.x - uy * 4.2, y: base.y + ux * 4.2 }, { x: base.x + uy * 4.2, y: base.y - ux * 4.2 }].map(z => `${f(z.x)},${f(z.y)}`).join(' '),
    punta: p,
  };
}

/** Marcas con nombre agrupadas por cabecera: [{nombre, tipo:'fila'|'col', i, nivel, de}] (`de` = cuántas comparten cabecera, máx. 3). */
export function colocarMarcas(marcas, def) {
  const por = new Map(), res = [];
  for (const [nombre, m] of Object.entries(marcas || {})) {
    const tipo = m?.fila !== undefined ? 'fila' : m?.col !== undefined ? 'col' : null, i = tipo && m[tipo];
    if (!tipo || !ent(i, 0, (tipo === 'fila' ? def.filas : def.cols) - 1)) continue;
    const k = tipo + i, lista = por.get(k) ?? por.set(k, []).get(k);
    res.push({ nombre, tipo, i, nivel: Math.min(lista.length, 2), de: 0 }); lista.push(nombre);
  }
  for (const m of res) m.de = Math.min(por.get(m.tipo + m.i).length, 3);
  return res;
}

const nuevoEstado = def => ({
  def, val: copiaM(def.val), est: {}, deps: [], marcas: {}, formula: null, resaltar: { filas: [], cols: [] },
});

/** Parche de estado (paso o frame). PURA: `s` ni `p` se mutan. Un paso con `tabla` abre escena nueva (s se ignora). */
export function plegar(s, p) {
  const t = p.tabla !== undefined
    ? nuevoEstado(defDe(p.tabla))
    : { ...s, val: s.val, est: { ...s.est }, deps: s.deps, marcas: { ...s.marcas }, resaltar: s.resaltar };
  const { filas, cols } = t.def;
  if (p.val !== undefined) t.val = aplicarVal(copiaM(t.val), p.val, filas, cols);
  if (p.est === null) t.est = {};
  else for (const [k, v] of Object.entries(p.est || {})) {
    const q = deLlave(k);
    if (!q || !ent(q[0], 0, filas - 1) || !ent(q[1], 0, cols - 1)) continue;
    if (v == null) delete t.est[k]; else t.est[k] = v;
  }
  if (p.deps !== undefined) {
    t.deps = (Array.isArray(p.deps) ? p.deps : []).filter(d => Array.isArray(d) && d.length >= 4
      && ent(d[0], 0, filas - 1) && ent(d[1], 0, cols - 1) && ent(d[2], 0, filas - 1) && ent(d[3], 0, cols - 1)
      && (d[0] !== d[2] || d[1] !== d[3])).map(d => d.slice(0, 4));
  }
  if (p.marcas === null) t.marcas = {};
  else for (const [k, v] of Object.entries(p.marcas || {})) {
    if (v == null) delete t.marcas[k];
    else if (v.fila !== undefined) t.marcas[k] = { fila: v.fila };
    else if (v.col !== undefined) t.marcas[k] = { col: v.col };
  }
  if (p.resaltar !== undefined) {
    const r = p.resaltar, xs = (a, n) => (Array.isArray(a) ? a.filter(i => ent(i, 0, n - 1)) : []);
    t.resaltar = r ? { filas: xs(r.filas, filas), cols: xs(r.cols, cols) } : { filas: [], cols: [] };
  }
  if (p.formula !== undefined) t.formula = p.formula ?? null;
  return t;
}

// ── Para los bloques `jugar`: los botones mutan una copia `v` ───────────────────────────────────────
export const vista = S => ({ val: copiaM(S.val), est: { ...S.est }, deps: S.deps.map(d => [...d]), marcas: { ...S.marcas }, formula: S.formula, resaltar: { filas: [...S.resaltar.filas], cols: [...S.resaltar.cols] } });
export const conVista = (S, v) => ({ ...S, val: v.val, est: v.est, deps: v.deps, marcas: v.marcas, formula: v.formula, resaltar: v.resaltar });
export const ctx = S => ({ filas: S.def.filas, cols: S.def.cols, cabF: S.def.cabF.map(txt), cabC: S.def.cabC.map(txt), inicial: copiaM(S.def.val), def: S.def });
/** Valor de la celda (r,c) de la vista (null si está vacía o fuera). */
export const leer = (v, r, c) => v.val[r]?.[c] ?? null;
/** Escribe en la vista el valor de la celda (r,c) (null = vacía). */
export function poner(v, r, c, x) { if (v.val[r] && c >= 0 && c < v.val[r].length) v.val[r][c] = norm(x) ?? null; return v; }
/** Fija (o con null quita) el estado de la celda (r,c) de la vista. */
export function estado(v, r, c, e) { if (e == null) delete v.est[llave(r, c)]; else v.est[llave(r, c)] = e; return v; }

// ── Aspecto (se inyecta una sola vez) ────────────────────────────────────────────────────────────
const CSS = `
.tb{position:absolute;left:0;top:0;--tb-ms:0ms;--tb-e:cubic-bezier(.4,0,.2,1);--tb-activo:var(--g-activo,#56A8F5);--tb-compara:var(--g-compara,#E0BB65);--tb-hecho:var(--g-hecho,#5FB865);--tb-camino:var(--g-camino,#C792EA);--tb-mal:var(--g-mal,#F75464);--tb-aux:var(--g-aux,#4FC1B0);font-family:var(--ui);color:var(--muted)}
.tb *{box-sizing:border-box}
.tb-bf,.tb-bc,.tb-hf,.tb-hc,.tb-esq,.tb-c,.tb-mk,.tb-fo{position:absolute;left:0;top:0}
.tb-bf,.tb-bc{background:color-mix(in srgb,var(--tb-activo) 13%,transparent);border-radius:6px;opacity:0;transition:opacity var(--tb-ms) var(--tb-e)}
.tb-bf.on,.tb-bc.on{opacity:1}
.tb-hf,.tb-hc,.tb-esq{display:flex;align-items:center;font:600 12px/1 var(--ui);color:var(--muted);white-space:nowrap;transition:color var(--tb-ms) var(--tb-e)}
.tb-hf{justify-content:flex-end;padding-right:9px}
.tb-hc{justify-content:center}
.tb-esq{justify-content:center;color:var(--faint);font-weight:500}
.tb-hf.on,.tb-hc.on{color:var(--text)}
.tb-c{display:flex;align-items:center;justify-content:center;background:var(--cell);border:1.5px solid var(--line2);border-radius:6px;color:var(--text);font-variant-numeric:tabular-nums;overflow:visible;transition:background-color var(--tb-ms) var(--tb-e),border-color var(--tb-ms) var(--tb-e),box-shadow var(--tb-ms) var(--tb-e)}
.tb-c.vacia{background:transparent;border:1.5px dashed var(--line)}
.tb-v{display:block;font-weight:600;line-height:1;pointer-events:none;white-space:nowrap}
.tb-c.e-activa{border-color:var(--tb-activo);background:color-mix(in srgb,var(--tb-activo) 24%,var(--cell));box-shadow:0 0 0 2px color-mix(in srgb,var(--tb-activo) 55%,transparent),inset 0 0 0 1.5px var(--tb-activo)}
.tb-c.e-lee{border:2px dashed var(--tb-compara);background:color-mix(in srgb,var(--tb-compara) 15%,var(--cell))}
.tb-c.e-hecha{border-color:var(--tb-hecho);background:color-mix(in srgb,var(--tb-hecho) 15%,var(--cell))}
.tb-c.e-hecha::after{content:'';position:absolute;right:-1.5px;top:-1.5px;border:6px solid transparent;border-top-color:var(--tb-hecho);border-right-color:var(--tb-hecho);border-top-right-radius:6px}
.tb-c.e-camino{border:3px double var(--tb-camino);background:color-mix(in srgb,var(--tb-camino) 28%,var(--cell));box-shadow:0 0 0 1.5px color-mix(in srgb,var(--tb-camino) 45%,transparent)}
.tb-c.e-camino .tb-v{font-weight:700}
.tb-c.e-mal{border:2px dotted var(--tb-mal);background:var(--cell) repeating-linear-gradient(135deg,color-mix(in srgb,var(--tb-mal) 26%,transparent) 0 4px,transparent 4px 8px)}
.tb-c.e-elegida,.tb-c.jg:hover,.tb-c.jg:focus-visible{outline:2px solid var(--g-activo);outline-offset:1px;border-color:var(--g-activo);background-color:color-mix(in srgb,var(--g-activo) 14%,var(--cell))}
.tb-c.jg{cursor:pointer;touch-action:manipulation}
.tb-c.jg:focus-visible{outline-style:dashed}
.tb-mk{width:0;height:0;transition:transform var(--tb-ms) var(--tb-e),opacity var(--tb-ms) var(--tb-e)}
.tb-mk.nuevo{transition:opacity var(--tb-ms) var(--tb-e)}
.tb-mk.oculta{opacity:0}
.tb-mk span{position:absolute;left:0;top:0;min-width:16px;padding:1px 5px 2px;border-radius:4px;background:color-mix(in srgb,var(--tb-aux) 20%,var(--island));border:1px solid var(--tb-aux);color:var(--tb-aux);font:600 11px/13px var(--ui);text-align:center;white-space:nowrap}
.tb-mk.mf span{transform:translate(calc(-100% - 5px),-50%)}
.tb-mk.mc span{transform:translate(-50%,calc(-100% - 5px))}
.tb-mk span::after{content:'';position:absolute;border:4px solid transparent}
.tb-mk.mf span::after{left:100%;top:50%;margin-top:-4px;border-right:0;border-left:5px solid var(--tb-aux)}
.tb-mk.mc span::after{top:100%;left:50%;margin-left:-4px;border-bottom:0;border-top:5px solid var(--tb-aux)}
.tb-sv{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.tb-d path{fill:none;stroke:var(--tb-aux);stroke-width:2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0}
.tb-d polygon{fill:var(--tb-aux)}
.tb-fo{display:flex;align-items:center;justify-content:center;padding:0 10px;text-align:center;font:14px/1.45 var(--ui);color:var(--code);opacity:0;transition:opacity var(--tb-ms) var(--tb-e)}
.tb-fo.on{opacity:1}
.tb-fo code{font:600 .95em var(--mono);color:var(--text);background:var(--line);padding:2px 7px;border-radius:4px}
`;
const inyectarCSS = () => {
  if (document.getElementById('css-tabla')) return;
  const s = document.createElement('style'); s.id = 'css-tabla'; s.textContent = CSS; document.head.append(s);
};
const reducido = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
/** Texto de la fórmula → HTML seguro; `código` entre acentos graves. */
export const htmlFormula = s => String(s).replace(/[&<>"]/g, c => ESC[c]).replace(/`([^`]+)`/g, '<code>$1</code>');
const tamFuente = (cs, len) => Math.max(8, Math.min(cs >= 64 ? 18 : cs >= 56 ? 16 : cs >= 48 ? 15 : cs >= 42 ? 14 : cs >= 38 ? 13 : 12, (cs - 10) / (Math.max(1, len) * .62)));

// ── Escena (DOM) ─────────────────────────────────────────────────────────────────────────────────
export const crear = stage => new Escena(stage);
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const svg = (tag, cls) => { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); return e; };

export class Escena {
  constructor(stage) {
    inyectarCSS();
    this.stage = stage; this.def = null; this.g = null; this.ult = null; this.ms = -1; this.nuevo = false;
    this.red = reducido(); this.ids = null; this.cb = null; this.foco = null; this.dn = null; this.lang = ''; this.fclave = '';
    this.celdas = []; this.mk = new Map(); this.nuevos = []; this.deps = new Map();
    const r = this.root = el('div', 'tb'); r.setAttribute('role', 'group'); stage.append(r);
    r.addEventListener('pointerdown', e => this.abajo(e));
    r.addEventListener('pointerup', e => this.suelta(e));
    r.addEventListener('pointercancel', () => { this.dn = null; });
    r.addEventListener('keydown', e => this.tecla(e));
    r.addEventListener('focusin', e => this.enfocado(e));
  }

  get tam() { return this.g ? { W: this.g.W, H: this.g.H } : { W: MINW, H: 240 }; }

  /** (Re)construye si el def cambió (mismo def = misma escena: se conservan los nodos y se anima entre pasos). */
  fijar(def) {
    if (def === this.def) return;
    this.dn = null; this.root.replaceChildren();
    const g = this.g = geom(def), rs = this.root.style;
    this.def = def; this.mk = new Map(); this.nuevos = []; this.deps = new Map(); this.ms = -1; this.nuevo = true; this.lang = ''; this.fclave = '';
    rs.width = g.W + 'px'; rs.height = g.H + 'px';
    const pon = (e, x, y, w, h) => {
      e.style.transform = `translate(${x}px,${y}px)`;
      if (w != null) { e.style.width = w + 'px'; e.style.height = h + 'px'; }
      this.root.append(e); return e;
    };
    const xs = g.x0 - g.hw;
    this.bf = Array.from({ length: def.filas }, (_, r) => pon(el('div', 'tb-bf'), xs - 2, g.y0 + r * g.cs + 1, g.hw + g.gw + 4, g.cs - 2));
    this.bc = Array.from({ length: def.cols }, (_, c) => pon(el('div', 'tb-bc'), g.x0 + c * g.cs + 1, g.y0 - g.hh - 1, g.cs - 2, g.hh + g.gh + 2));
    this.esq = pon(el('div', 'tb-esq'), xs, g.y0 - g.hh, g.hw, g.hh);
    this.hf = Array.from({ length: def.filas }, (_, r) => pon(el('div', 'tb-hf'), xs, g.y0 + r * g.cs, g.hw, g.cs));
    this.hc = Array.from({ length: def.cols }, (_, c) => pon(el('div', 'tb-hc'), g.x0 + c * g.cs, g.y0 - g.hh, g.cs, g.hh));
    this.celdas = [];
    for (let r = 0; r < def.filas; r++) for (let c = 0; c < def.cols; c++) {
      const e = pon(el('div', 'tb-c'), g.x0 + c * g.cs + 2, g.y0 + r * g.cs + 2, g.caja, g.caja), v = el('span', 'tb-v');
      e.append(v); e.setAttribute('role', 'gridcell'); e.dataset.r = r; e.dataset.c = c;
      this.celdas.push({ el: e, v, r, c, k: llave(r, c), x: {} });
    }
    this.sv = svg('svg', 'tb-sv'); this.sv.setAttribute('width', g.W); this.sv.setAttribute('height', g.H); this.root.append(this.sv);
    this.fo = def.formula ? pon(el('div', 'tb-fo'), PAD, g.fy, g.W - 2 * PAD, FH) : null;
    this.ult = null; this.ids = null; this.cb = null; this.foco = null; // la interacción de la escena anterior no se hereda
  }

  /** S = estado de plegar + `hl`; animar: false | true (520 ms) | milisegundos. Solo transform/opacity (transiciones CSS / WAAPI). */
  pintar(S, animar = true) {
    if (S.def !== this.def) this.fijar(S.def);
    this.ult = S;
    const g = this.g, def = this.def, lang = idioma();
    const ms = this.nuevo || this.red ? 0 : clamp(animar === true ? 520 : +animar || 0, 0, 3000);
    this.nuevo = false;
    if (ms !== this.ms) { this.root.style.setProperty('--tb-ms', ms + 'ms'); this.ms = ms; }
    for (const e of this.nuevos) e.classList.remove('nuevo');
    this.nuevos.length = 0;
    const set = (o, k, v, fn) => { if (o.x[k] !== v) { o.x[k] = v; fn(v); } };
    // Cabeceras (el texto se reescribe solo si cambia el idioma: pueden ser {es,en})
    if (lang !== this.lang) {
      this.lang = lang;
      def.cabF.forEach((t, r) => { this.hf[r].textContent = txt(t); this.hf[r].style.fontSize = Math.min(13, Math.max(8, (g.hw - 14) / (Math.max(1, txt(t).length) * .62))) + 'px'; });
      def.cabC.forEach((t, c) => { this.hc[c].textContent = txt(t); this.hc[c].style.fontSize = Math.min(13, Math.max(8, (g.cs - 6) / (Math.max(1, txt(t).length) * .62))) + 'px'; });
      this.esq.textContent = txt(def.esq);
      for (const k of this.celdas) k.x.t = null; // las etiquetas de accesibilidad llevan las cabeceras
    }
    const est = S.hl ? { ...S.est, ...S.hl } : S.est, { filas: rf, cols: rc } = S.resaltar;
    this.bf.forEach((b, r) => set({ x: b.x ??= {} }, 'on', rf.includes(r), on => b.classList.toggle('on', on)));
    this.bc.forEach((b, c) => set({ x: b.x ??= {} }, 'on', rc.includes(c), on => b.classList.toggle('on', on)));
    this.hf.forEach((h, r) => h.classList.toggle('on', rf.includes(r)));
    this.hc.forEach((h, c) => h.classList.toggle('on', rc.includes(c)));
    // Celdas: texto (con «brotar» si cambia y hay animación), estado y accesibilidad
    for (const k of this.celdas) {
      const v = S.val[k.r][k.c], t = v == null ? '' : String(v), e = est[k.k];
      const jg = this.ids && (this.ids === true || this.ids.has(k.k));
      set(k, 'cls', 'tb-c' + (t === '' ? ' vacia' : '') + (e ? ' e-' + e : '') + (jg ? ' jg' : ''), c => { k.el.className = c; });
      set(k, 'tab', jg ? (k.k === this.foco ? 0 : -1) : null, n => { if (n === null) k.el.removeAttribute('tabindex'); else k.el.tabIndex = n; });
      if (k.x.t !== t) {
        const antes = k.x.t; k.x.t = t; k.v.textContent = t;
        if (t) k.v.style.fontSize = tamFuente(g.cs, t.length) + 'px';
        if (ms > 0 && t && antes !== undefined && antes !== null && k.v.animate) k.v.animate([{ opacity: 0, transform: 'scale(.35)' }, { opacity: 1, transform: 'scale(1.12)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: Math.min(420, ms), easing: 'ease-out' });
        k.el.setAttribute('aria-label', `${txt(def.cabF[k.r])}, ${txt(def.cabC[k.c])}: ${t || '—'}`);
      }
    }
    this.marcas(S, set);
    this.flechas(S.deps, ms);
    if (this.fo) {
      const f = S.formula == null ? '' : String(L(S.formula)), clv = lang + '|' + f;
      if (clv !== this.fclave) { this.fclave = clv; this.fo.innerHTML = htmlFormula(f); this.fo.classList.toggle('on', !!f); }
    }
    this.root.setAttribute('aria-label', `${def.filas}×${def.cols}`);
  }

  /** Marcas con nombre: cada nombre tiene su nodo (se desliza de una cabecera a otra); los que no están se atenúan. */
  marcas(S, set) {
    const g = this.g, vistos = new Set();
    for (const { nombre, tipo, i, nivel, de } of colocarMarcas(S.marcas, this.def)) {
      vistos.add(nombre);
      let m = this.mk.get(nombre);
      if (!m) {
        m = { el: el('div', 'tb-mk oculta ' + (tipo === 'fila' ? 'mf' : 'mc')), x: {} };
        const s = el('span'); s.textContent = nombre; m.el.append(s); this.mk.set(nombre, m); this.root.append(m.el);
      }
      const fila = tipo === 'fila', d = (nivel - (de - 1) / 2) * (fila ? 15 : Math.min(26, (g.cs - 2) / de));
      if (m.x.oculto !== false) { m.el.classList.add('nuevo'); this.nuevos.push(m.el); m.el.classList.remove('oculta'); m.x.oculto = false; }
      if (m.x.tipo !== tipo) { m.x.tipo = tipo; m.el.classList.toggle('mf', fila); m.el.classList.toggle('mc', !fila); }
      const x = fila ? g.x0 - g.hw - 3 : g.x0 + (i + .5) * g.cs + d, y = fila ? g.y0 + (i + .5) * g.cs + d : g.y0 - g.hh - 1;
      set(m, 't', `translate(${x}px,${y}px)`, t => { m.el.style.transform = t; });
    }
    for (const [nombre, m] of this.mk) if (!vistos.has(nombre) && m.x.oculto !== true) { m.el.classList.add('oculta'); m.x.oculto = true; }
  }

  /** Flechas de dependencia: las nuevas se dibujan (trazo + cabeza), las que sobran se desvanecen. */
  flechas(deps, ms) {
    const g = this.g, quedan = new Set();
    for (const d of deps) {
      const k = d.join(','), f = flecha(g, d);
      if (!f) continue;
      quedan.add(k);
      let n = this.deps.get(k);
      if (n && n.saliendo) { n.el.getAnimations?.().forEach(a => a.cancel()); n.saliendo = false; }
      if (n) continue;
      const gr = svg('g', 'tb-d'), p = svg('path'), h = svg('polygon');
      p.setAttribute('d', f.d); p.setAttribute('pathLength', '1'); h.setAttribute('points', f.cabeza);
      gr.append(p, h); this.sv.append(gr); this.deps.set(k, { el: gr, saliendo: false });
      if (ms > 0 && gr.animate) {
        p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: ms * .75, easing: 'ease-out', fill: 'backwards' });
        h.animate([{ opacity: 0 }, { opacity: 0, offset: .7 }, { opacity: 1 }], { duration: ms, fill: 'backwards' });
      }
    }
    for (const [k, n] of [...this.deps]) {
      if (quedan.has(k)) continue;
      const quitar = () => { if (this.deps.get(k) === n && n.saliendo) { n.el.remove(); this.deps.delete(k); } };
      if (ms > 0 && n.el.animate) {
        if (!n.saliendo) { n.saliendo = true; n.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.min(300, ms), fill: 'forwards' }).onfinish = quitar; }
      } else { n.saliendo = true; quitar(); }
    }
  }

  repintar(ms) { if (this.ult) this.pintar(this.ult, ms); }

  // ── Clic en celda («pruébalo tú») ────────────────────────────────────────────────────────────────
  /** ids = true (todas) | ["r,c"…] | [[r,c]…] | null (desactiva). cb(r, c) al pulsar una celda (clic, toque o Enter/Espacio). */
  arrastre(ids, cb) {
    if (!ids && !this.ids) return; // guia.js lo llama con null en cada paso: sin interacción previa no hay nada que repintar
    const ks = Array.isArray(ids) ? ids.map(x => (Array.isArray(x) ? llave(x[0], x[1]) : String(x))).filter(k => deLlave(k)) : null;
    this.ids = ids === true ? true : ks?.length ? new Set(ks) : null; this.cb = this.ids ? cb : null; this.dn = null;
    if (!this.ids) this.foco = null;
    else if (!this.foco || (this.ids !== true && !this.ids.has(this.foco))) this.foco = this.ids === true ? '0,0' : [...this.ids][0];
    for (const k of this.celdas) { k.x.cls = null; k.x.tab = undefined; } // fuerza reescribir la clase y el tabindex
    if (this.ult) this.repintar(false);
  }

  celdaDe(t) { const e = t?.closest?.('.tb-c.jg'); return e ? this.celdas[+e.dataset.r * this.def.cols + +e.dataset.c] : null; }

  abajo(e) {
    const k = this.celdaDe(e.target);
    if (!k || !this.cb || e.button > 0) return;
    this.dn = { k, pid: e.pointerId };
  }

  suelta(e) {
    const d = this.dn; this.dn = null;
    if (!d || e.pointerId !== d.pid || !this.cb) return;
    const bajo = this.celdaDe(globalThis.document.elementFromPoint?.(e.clientX, e.clientY) ?? e.target); // el toque captura al elemento inicial
    if (bajo === d.k) { this.foco = d.k.k; this.cb(d.k.r, d.k.c); }
  }

  enfocado(e) {
    const k = this.celdaDe(e.target);
    if (!k || this.foco === k.k) return;
    const antes = this.celdas.find(x => x.k === this.foco);
    if (antes && antes.el.hasAttribute('tabindex')) { antes.el.tabIndex = -1; antes.x.tab = -1; }
    this.foco = k.k; k.el.tabIndex = 0; k.x.tab = 0;
  }

  /** Teclado: Enter/Espacio eligen; las flechas mueven el foco (guia.js usa ← → para cambiar de paso: aquí no se propagan). */
  tecla(e) {
    const k = this.celdaDe(e.target);
    if (!k || !this.cb) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); this.cb(k.r, k.c); return; }
    const d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    for (let r = k.r + d[0], c = k.c + d[1]; ent(r, 0, this.def.filas - 1) && ent(c, 0, this.def.cols - 1); r += d[0], c += d[1]) {
      const s = this.celdas[r * this.def.cols + c];
      if (this.ids === true || this.ids?.has(s.k)) { s.el.focus({ preventScroll: true }); return; }
    }
  }
}
