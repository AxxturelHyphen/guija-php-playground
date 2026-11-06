// Escena «barras»: una fila de barras (o cajas con el valor dentro) para animar ordenación y búsqueda, con fila
// auxiliar opcional (merge), punteros con nombre (i, j, lo, mid, hi, piv…), rango activo, estados por barra,
// contadores y modo «ordénalo tú» (arrastrar barras). Implementa el contrato de escena de guia.js.
//
// FORMATO (parches acumulativos, en pasos Y en frames de `traza`; `plegar` es pura):
//   barras {arr:[n…], aux?:n, estilo?:'barras'|'cajas', max?:n, etiquetas?:bool, etiquetasCont?:{clave:{es,en}|texto}}
//        abre la escena (solo en un paso, nunca en un frame). arr = valores iniciales (≥ 0, hasta ~32).
//        aux = nº de huecos de la fila auxiliar (0 = sin ella). max = valor que llena la altura (por defecto el
//        mayor de arr: declara max si luego `poner`/`aux` escriben valores mayores). etiquetas = índices bajo cada
//        columna. etiquetasCont = nombre mostrado de cada contador (por defecto, la clave).
//        Los elementos tienen IDENTIDAD estable (id = posición inicial): se mueven con transform, no se recrean.
//   intercambiar [i,j]            los dos elementos se cruzan (varios: [[i,j],[k,l]])
//   poner {i: valor}              escribe el valor en la posición i (la altura se anima)
//   arr [valores]                 reemplazo duro de todos los valores (misma longitud; la identidad no cambia)
//   aux {k: valor|null}           fila auxiliar: valor en el hueco k, null lo vacía; aux:null vacía toda la fila
//   marcas {nombre: i|null}       puntero con nombre bajo la columna i (−1 y n permitidos: «se salió»); null lo quita;
//                                 marcas:null quita todos. Varios nombres en un índice se apilan (máx. 3).
//   rango [lo,hi] | null          lo de fuera (inclusive lo..hi dentro) se atenúa; null = sin rango
//   est {i: 'cmp'|'ok'|'piv'|'sel'|null}   estado por POSICIÓN (no sigue al elemento); null lo limpia; est:null limpia todo
//   cont {nombre: n}              contadores arriba a la derecha (se acumulan por clave); cont:null los borra
//   hl {i: estado}                (lo añade guia.js: énfasis solo del paso) mismo formato que `est`, se superpone
// Orden de aplicación en un mismo parche: arr, poner, intercambiar, aux, marcas, rango, est, cont.
// Estados: cmp = amarillo con rayas / cuadro, ok = verde / subrayado, piv = acento con puntos / doble borde,
//          sel = rojo con franjas / círculo (forma además de color: accesible).
// Arrastre (`jugar.arrastrables: true`): cb(desde, hasta) con índices de inserción; teclado: flechas ← → sobre una barra.
// Para `jugar`: v = vista(S) = {arr, ord, aux, marcas, rango, est, cont} mutable. Usa mover(v, desde, hasta) y
// cambiar(v, i, j) / reponer(v, arr) (mantienen la identidad); si solo mutas v.arr (p.ej. sort) conVista reconstruye la identidad por valores.
// La lógica pura (geometría, plegar, helpers) no toca el DOM al importar, así se prueba en Node.
import { idioma } from './idioma.js';
import { etiqueta } from './mates.js';
import { Muelle, tarea } from './movimiento.js';
import { crearTip } from './tip.js';

export const clave = 'barras';
export const W = 620, PADX = 20, MAXSW = 72, HB = 120, HBOX = 46, IXH = 16, MKH = 17, MKROWS = 3, CAPH = 18, MAXN = 32;
export const ESTADOS = ['cmp', 'ok', 'piv', 'sel'];
const L = x => (x && typeof x === 'object' ? x[idioma()] : x) ?? '';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ── Lógica pura ──────────────────────────────────────────────────────────────────────────────────

const DEFS = new WeakMap(); // memo: el mismo objeto `barras:{}` da siempre el mismo def (guia.js re-pliega en cada paso)
/** Normaliza el objeto que abre la escena. Mismo objeto de entrada → mismo def (identidad estable). */
export function defDe(b) {
  const memo = b && typeof b === 'object' && DEFS.get(b);
  if (memo) return memo;
  const arr = Array.isArray(b?.arr) ? b.arr.map(Number) : [];
  const def = {
    arr, aux: b?.aux > 0 ? Math.floor(b.aux) : 0, estilo: b?.estilo === 'cajas' ? 'cajas' : 'barras',
    max: b?.max > 0 ? +b.max : Math.max(1, ...arr), etiquetas: !!b?.etiquetas, etiquetasCont: b?.etiquetasCont || {},
  };
  if (b && typeof b === 'object') DEFS.set(b, def);
  return def;
}

/** Geometría lógica de la escena: tamaño, anchura de hueco, filas. Solo aritmética. */
export function geom(def) {
  const n = def.arr.length, cols = Math.max(n, def.aux, 1), cajas = def.estilo === 'cajas';
  const sw = Math.min((W - 2 * PADX) / cols, MAXSW), x0 = (W - sw * cols) / 2;
  const bw = Math.min(sw - Math.max(3, Math.min(10, sw * .16)), 64), hr = cajas ? HBOX : HB;
  const topY = cajas ? 34 : 44, base = topY + hr, ixY = base + 6;
  const mkY = ixY + (def.etiquetas ? IXH : 0) + 2, capY = mkY + MKROWS * MKH + 4, auxY = capY + CAPH;
  return { W, H: def.aux ? auxY + hr + 12 : capY - 2, n, cols, cajas, sw, x0, bw, hr, topY, base, ixY, mkY, capY, auxY };
}

/** Fracción de altura (0..1) de un valor; un valor > 0 siempre se ve algo. */
export const escalaBarra = (v, max) => (v > 0 ? clamp(v / max, .03, 1) : 0);
/** Índice de columna bajo la coordenada lógica x (acotado a [0, n-1]). */
export const indiceDeX = (g, x) => clamp(Math.floor((x - g.x0) / g.sw), 0, g.n - 1);
/** Centro horizontal de una marca en el índice i (acotado para que −1 y n no salgan de la escena). */
export const xMarca = (g, i) => clamp(g.x0 + (i + .5) * g.sw, 24, W - 24);

/** Mueve el elemento de `desde` y lo inserta en `hasta` (copia). */
export function moverEn(arr, desde, hasta) {
  const a = [...arr]; a.splice(hasta, 0, a.splice(desde, 1)[0]); return a;
}
/** Nueva posición de cada posición original tras mover `desde` → `hasta` (las demás se corren para dejar hueco). */
export function posTrasMover(n, desde, hasta) {
  const orden = moverEn(Array.from({ length: n }, (_, i) => i), desde, hasta), res = Array(n);
  orden.forEach((orig, nueva) => { res[orig] = nueva; });
  return res;
}

/** Apila los nombres que comparten índice: [{nombre, i, nivel}] (el orden de las claves decide quién va arriba). */
export function colocarMarcas(marcas) {
  const nivel = new Map();
  return Object.entries(marcas).map(([nombre, i]) => {
    const k = nivel.get(i) ?? 0; nivel.set(i, k + 1);
    return { nombre, i, nivel: Math.min(k, MKROWS - 1) };
  });
}

/** Estado inicial de una escena abierta con `def`. */
const nuevoEstado = def => ({
  def, arr: [...def.arr], ord: def.arr.map((_, i) => i), aux: Array(def.aux).fill(null), marcas: {}, rango: null, est: {}, cont: {},
});

/** Parche de estado (paso o frame). PURA: `s` no se muta. Un paso con `barras` abre escena nueva (s se ignora). */
export function plegar(s, p) {
  const t = p.barras !== undefined
    ? nuevoEstado(defDe(p.barras))
    : { ...s, arr: [...s.arr], ord: [...s.ord], aux: [...s.aux], marcas: { ...s.marcas }, est: { ...s.est }, cont: { ...s.cont } };
  const n = t.arr.length, ok = i => Number.isInteger(+i) && i >= 0 && i < n;
  if (p.arr) t.arr = t.arr.map((x, i) => p.arr[i] ?? x);
  for (const [i, v] of Object.entries(p.poner || {})) if (ok(i)) t.arr[+i] = v;
  if (p.intercambiar) {
    for (const [i, j] of Array.isArray(p.intercambiar[0]) ? p.intercambiar : [p.intercambiar]) {
      if (!ok(i) || !ok(j)) continue;
      [t.arr[i], t.arr[j]] = [t.arr[j], t.arr[i]]; [t.ord[i], t.ord[j]] = [t.ord[j], t.ord[i]];
    }
  }
  if (p.aux === null) t.aux.fill(null);
  else for (const [k, v] of Object.entries(p.aux || {})) if (Number.isInteger(+k) && k >= 0 && k < t.aux.length) t.aux[+k] = v;
  if (p.marcas === null) t.marcas = {};
  else for (const [k, v] of Object.entries(p.marcas || {})) { if (v == null) delete t.marcas[k]; else t.marcas[k] = v; }
  if (p.rango !== undefined) t.rango = p.rango ? [...p.rango] : null;
  if (p.est === null) t.est = {};
  else for (const [k, v] of Object.entries(p.est || {})) { if (v == null) delete t.est[k]; else t.est[k] = v; }
  if (p.cont === null) t.cont = {};
  else Object.assign(t.cont, p.cont);
  return t;
}

/** Ordena `ord` (ids por posición) para que cada id siga a su valor: de arr0 (antes) a arr1 (después). Pura. */
export function reconciliar(ord, arr0, arr1) {
  const n = ord.length, res = Array(n).fill(null), usado = new Set(), pos0 = new Map(ord.map((id, p) => [id, p]));
  for (let p = 0; p < n; p++) if (arr1[p] === arr0[p]) { res[p] = ord[p]; usado.add(ord[p]); }
  for (let p = 0; p < n; p++) {
    if (res[p] !== null) continue;
    let mejor = null;
    for (const id of ord) {
      if (usado.has(id) || arr0[pos0.get(id)] !== arr1[p]) continue;
      if (mejor === null || Math.abs(pos0.get(id) - p) < Math.abs(pos0.get(mejor) - p)) mejor = id;
    }
    if (mejor !== null) { res[p] = mejor; usado.add(mejor); }
  }
  const libres = ord.filter(id => !usado.has(id));
  return res.map(id => id ?? libres.shift());
}

export const ordenado = arr => arr.every((x, i) => i === 0 || arr[i - 1] <= x);

// ── Tooltip y accesibilidad (lógica pura + textos) ───────────────────────────────────────────────────
export const NOMBRE_EST = {
  cmp: { es: 'comparando', en: 'comparing' }, ok: { es: 'en su sitio', en: 'in place' },
  piv: { es: 'pivote', en: 'pivot' }, sel: { es: 'señalada', en: 'flagged' },
};
const TXT = {
  es: { pos: 'Posición', idx: 'Índice', val: 'Valor', est: 'Estado', mk: 'Punteros', aux: 'Auxiliar', hueco: 'hueco', fuera: 'Fuera del rango activo', rango: 'Rango' },
  en: { pos: 'Position', idx: 'Index', val: 'Value', est: 'State', mk: 'Pointers', aux: 'Auxiliary', hueco: 'slot', fuera: 'Outside the active range', rango: 'Range' },
};
/** Datos de la columna en la posición p (S = estado + hl opcional): {pos, valor, est, marcas, fuera}; null si no existe. Pura. */
export function describirBarra(S, p) {
  if (!Number.isInteger(p) || p < 0 || p >= S.arr.length) return null;
  const est = (S.hl && S.hl[p]) || S.est[p] || null;
  return {
    pos: p, valor: S.arr[p], est, marcas: Object.entries(S.marcas).filter(([, i]) => i === p).map(([k]) => k),
    fuera: !!(S.rango && (p < S.rango[0] || p > S.rango[1])),
  };
}
/** Datos del hueco k de la fila auxiliar: {hueco, valor}; null si está vacío o no existe. Pura. */
export const describirAux = (S, k) => (Number.isInteger(k) && k >= 0 && k < S.aux.length && S.aux[k] != null ? { hueco: k, valor: S.aux[k] } : null);

// ── Para los bloques `jugar`: los botones mutan una copia `v` ───────────────────────────────────────
const sync = v => { Object.defineProperty(v, '_arr', { value: [...v.arr], writable: true, configurable: true }); return v; };
export const vista = S => sync({ arr: [...S.arr], ord: [...S.ord], aux: [...S.aux], marcas: { ...S.marcas }, rango: S.rango && [...S.rango], est: { ...S.est }, cont: { ...S.cont } });
/** Devuelve v a estado pintable; si solo se mutó v.arr, deduce qué elemento es cada uno por sus valores. */
export function conVista(S, v) {
  if (v.arr.some((x, i) => x !== v._arr[i])) { v.ord = reconciliar(v.ord, v._arr, v.arr); v._arr = [...v.arr]; }
  return { ...S, arr: v.arr, ord: v.ord, aux: v.aux, marcas: v.marcas, rango: v.rango, est: v.est, cont: v.cont };
}
export const ctx = S => ({ n: S.arr.length, max: S.def.max, inicial: S.def.arr, def: S.def });
/** Arrastrar/insertar: mueve el elemento de la posición `desde` a `hasta` en la vista (identidad incluida). */
export function mover(v, desde, hasta) {
  v.arr = moverEn(v.arr, desde, hasta); v.ord = moverEn(v.ord, desde, hasta); return sync(v);
}
/** Repone la vista a unos valores (e identidad: por defecto la inicial). */
export function reponer(v, arr, ord = arr.map((_, i) => i)) {
  v.arr = [...arr]; v.ord = [...ord]; return sync(v);
}
/** Intercambia dos posiciones de la vista (identidad incluida). */
export function cambiar(v, i, j) {
  [v.arr[i], v.arr[j]] = [v.arr[j], v.arr[i]]; [v.ord[i], v.ord[j]] = [v.ord[j], v.ord[i]]; return sync(v);
}

// ── Aspecto (se inyecta una sola vez) ────────────────────────────────────────────────────────────
const CSS = `
.br{position:absolute;left:0;top:0;--br-ms:0ms;--br-e:cubic-bezier(.4,0,.2,1);--neu:color-mix(in srgb,var(--muted) 56%,var(--line2));font-family:var(--ui);color:var(--muted)}
.br *{box-sizing:border-box}
.br-col,.br-aux,.br-hueco,.br-ix,.br-mk,.br-cap{position:absolute;left:0;top:0}
.br-col,.br-aux{width:var(--sw);height:var(--hr);transition:transform var(--br-ms) var(--br-e),opacity var(--br-ms) var(--br-e)}
.br-col.mov{z-index:2}
.br-col.fuera{opacity:.28}
.br-aux.oculto{opacity:0}
.br-bar{position:absolute;bottom:0;left:calc((var(--sw) - var(--bw))/2);width:var(--bw);height:var(--hr);border-radius:3px 3px 0 0;background:var(--neu);transform-origin:50% 100%;transition:transform var(--br-ms) var(--br-e)}
.br-bar::after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,rgba(255,255,255,.13),rgba(255,255,255,0) 46%,rgba(0,0,0,.16));pointer-events:none}
.cajas .br-bar::after{display:none}
.br-base{position:absolute;height:1px;background:var(--line2);pointer-events:none}
.br-slot{position:absolute;left:0;top:0;width:var(--bw);height:var(--hr);margin-left:calc((var(--sw) - var(--bw))/2);border:1.5px dashed var(--g-activo);border-radius:4px;background:color-mix(in srgb,var(--g-activo) 8%,transparent);opacity:0;pointer-events:none;transition:opacity .15s,transform .12s ease-out}
.br-slot.on{opacity:1} .br-slot.sa{transition:opacity .15s}
.br-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.br-hueco,.br-cap{transition:opacity .35s}
.aux-vacio .br-hueco{opacity:.6} .aux-vacio .br-cap{opacity:.65}
.br-lb{position:absolute;left:0;bottom:0;width:100%;text-align:center;font:600 12px/16px var(--ui);color:var(--muted);transition:transform var(--br-ms) var(--br-e)}
.br-lb i{font-style:normal;display:inline-block;min-width:20px;padding:0 4px;border:1.5px solid transparent;border-radius:3px}
.dens .br-lb{font-size:10px}
.dens .br-lb i{min-width:0;padding:0;border-width:1px}
.br-hueco{width:var(--bw);height:var(--hr);margin-left:calc((var(--sw) - var(--bw))/2);border:1px dashed var(--line2);border-radius:3px}
.br-ix{width:var(--sw);text-align:center;font:10.5px/14px var(--ui);color:var(--faint)}
.dens .br-ix{font-size:9px}
.br-cap{font:600 11px/14px var(--ui);letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.br-cont{position:absolute;right:16px;top:8px;display:flex;gap:16px;font:12px/16px var(--ui);color:var(--muted)}
.br-cont b{margin-left:6px;color:var(--text);font-weight:600;font-variant-numeric:tabular-nums}
/* Estados (tokens --g-* de guia.css): color + forma (rayas/cuadro, subrayado, puntos/doble borde, franjas/círculo) */
.e-cmp .br-bar{background:var(--g-compara) repeating-linear-gradient(135deg,rgba(0,0,0,.24) 0 5px,transparent 5px 10px)}
.e-ok .br-bar{background:var(--g-hecho)}
.e-piv .br-bar{background:var(--g-activo) radial-gradient(rgba(0,0,0,.38) 1.2px,transparent 1.7px) 0 0/8px 8px}
.e-sel .br-bar{background:var(--g-mal) repeating-linear-gradient(90deg,rgba(0,0,0,.28) 0 3px,transparent 3px 7px)}
.e-cmp .br-lb{color:var(--g-compara)} .e-cmp .br-lb i{border-color:var(--g-compara);border-radius:2px}
.e-ok .br-lb{color:var(--g-hecho)} .e-ok .br-lb i{border-bottom-color:var(--g-hecho);border-radius:0}
.e-piv .br-lb{color:var(--g-activo)} .e-piv .br-lb i{border:3px double var(--g-activo);border-radius:2px}
.e-sel .br-lb{color:var(--g-mal)} .e-sel .br-lb i{border-color:var(--g-mal);border-radius:999px}
/* Estilo cajas: el valor dentro; el estado se marca con el tipo de borde */
.cajas .br-bar{border:2px solid var(--line2);border-radius:6px;background:var(--cell)}
.cajas .br-lb{top:0;bottom:auto;height:var(--hr);display:flex;align-items:center;justify-content:center;color:var(--text);font-size:15px}
.cajas .br-lb i{border:0;min-width:0;padding:0}
.cajas .e-cmp .br-bar{border:2px dashed var(--g-compara);background:color-mix(in srgb,var(--g-compara) 14%,var(--cell))}
.cajas .e-ok .br-bar{border:2px solid var(--g-hecho);background:color-mix(in srgb,var(--g-hecho) 16%,var(--cell))}
.cajas .e-piv .br-bar{border:5px double var(--g-activo);background:color-mix(in srgb,var(--g-activo) 18%,var(--cell))}
.cajas .e-sel .br-bar{border:3px dotted var(--g-mal);background:color-mix(in srgb,var(--g-mal) 14%,var(--cell))}
.cajas .e-cmp .br-lb,.cajas .e-ok .br-lb,.cajas .e-piv .br-lb,.cajas .e-sel .br-lb{color:var(--text)}
/* Punteros con nombre */
.br-mk{--c:var(--text);width:44px;margin-left:-22px;height:17px;padding-top:6px;text-align:center;font:600 11px/11px var(--ui);color:var(--c);transition:transform var(--br-ms) var(--br-e),opacity var(--br-ms) var(--br-e)}
.br-mk::before{content:'';position:absolute;left:50%;top:0;margin-left:-4px;border:4px solid transparent;border-top:0;border-bottom:5px solid var(--c)}
.br-mk.oculta{opacity:0}
.br-mk.nuevo{transition:opacity var(--br-ms) var(--br-e)}
.m-i,.m-k,.m-piv{--c:var(--g-activo)} .m-j,.m-mid{--c:var(--g-compara)} .m-lo,.m-hi{--c:var(--g-aux)}
/* Arrastre */
.br-col.arr{cursor:grab;touch-action:none}
.br-col.arr::after{content:'';position:absolute;left:calc((var(--sw) - var(--bw))/2);width:var(--bw);bottom:-4px;height:3px;border-radius:2px;background:var(--g-activo)}
.br-col.agarrada,.br-col.asienta{z-index:3;transition:opacity var(--br-ms) var(--br-e)}
.br-col.agarrada{cursor:grabbing}
.br-col.agarrada .br-bar{outline:2px solid var(--g-activo)}
.br-col.arr:focus,.br-col.arr:focus-visible{outline:none}
.br-col.arr:focus-visible::after{height:4px;box-shadow:0 0 0 3px var(--g-halo)}
.br-col.arr:focus-visible .br-bar{outline:2px solid var(--g-activo);outline-offset:2px}
@media (hover:hover){.br-col:hover .br-bar{filter:brightness(1.22)} .cajas .br-col:hover .br-bar{filter:none;border-color:var(--muted)}}
@media (prefers-reduced-motion:reduce){.br-slot{transition:none}}
`;
const inyectarCSS = () => {
  if (document.getElementById('css-barras')) return;
  const s = document.createElement('style'); s.id = 'css-barras'; s.textContent = CSS; document.head.append(s);
};
const reducido = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── Escena (DOM) ─────────────────────────────────────────────────────────────────────────────────
export const crear = stage => new Escena(stage);

export class Escena {
  constructor(stage) {
    inyectarCSS();
    this.stage = stage; this.def = null; this.g = null; this.ult = null; this.d = null; this.np = 0; this.ms = -1;
    this.nuevo = false; this.cols = []; this.auxs = []; this.mk = new Map(); this.nuevos = []; this.posDe = []; this.cb = null; this.ids = null;
    this.red = reducido(); this.contClave = '';
    const r = this.root = document.createElement('div'); r.className = 'br'; r.setAttribute('role', 'group'); stage.append(r);
    r.addEventListener('pointerdown', e => this.abajo(e));
    r.addEventListener('pointermove', e => this.mueve(e));
    r.addEventListener('pointerup', e => this.suelta(e));
    r.addEventListener('pointercancel', e => this.suelta(e, true));
    r.addEventListener('keydown', e => this.tecla(e));
    this.as = null; this.slot = this.sr = null; this.auxVacio = null;
    this.tip = crearTip(stage, { objetivo: n => this.tipClave(n), datos: k => this.tipDatos(k) });
  }

  // ── Tooltip: clave 'c<id>' (columna) o 'a<k>' (hueco auxiliar); la posición sale de la geometría lógica, no del DOM ──
  tipClave(n) {
    const c = n.closest?.('.br-col, .br-aux');
    if (!c || !this.root.contains(c)) return null;
    return c.classList.contains('br-aux') ? 'a' + c.dataset.k : 'c' + c.dataset.id;
  }

  tipDatos(clave) {
    const S = this.ult, g = this.g;
    if (!S || !g) return null;
    const u = TXT[idioma()], aux = clave[0] === 'a', i = +clave.slice(1), filas = [];
    if (aux) {
      const d = describirAux(S, i);
      if (!d) return null;
      filas.push([u.val, d.valor]);
      return { titulo: `${u.aux} · ${u.hueco} ${i}`, filas, x: g.x0 + i * g.sw + g.sw / 2, y: g.auxY + g.hr * (1 - (g.cajas ? 1 : escalaBarra(d.valor, this.def.max))) - (g.cajas ? 2 : 21), y2: g.auxY + g.hr + 2 };
    }
    const p = this.posDe[i], d = describirBarra(S, p);
    if (!d) return null;
    filas.push([u.val, d.valor]);
    if (d.est) filas.push([u.est, L(NOMBRE_EST[d.est]) || d.est]);
    if (d.marcas.length) filas.push([u.mk, d.marcas.join(', ')]);
    if (d.fuera) filas.push(['', u.fuera]);
    return { titulo: `${u.idx} ${p}`, filas, x: g.x0 + p * g.sw + g.sw / 2, y: g.topY + (g.cajas ? -2 : g.hr * (1 - escalaBarra(d.valor, this.def.max)) - 21), y2: g.base + 2 };
  }

  get tam() { return this.g ? { W: this.g.W, H: this.g.H } : { W, H: 240 }; }

  /** (Re)construye si el def cambió (mismo def = misma escena: se conservan los nodos y se anima entre pasos). */
  fijar(def) {
    if (def === this.def) return;
    this.cancelar(); this.fin(false); this.tip.ocultar(); this.root.replaceChildren(); this.auxVacio = null;
    const g = this.g = geom(def), rs = this.root.style;
    this.def = def; this.mk = new Map(); this.nuevos = []; this.contClave = ''; this.ms = -1; this.nuevo = true;
    rs.width = g.W + 'px'; rs.height = g.H + 'px';
    for (const [k, v] of [['--sw', g.sw], ['--bw', g.bw], ['--hr', g.hr]]) rs.setProperty(k, v + 'px');
    this.root.className = 'br' + (g.cajas ? ' cajas' : '') + (g.sw < 30 ? ' dens' : '');
    const div = (cls, txt) => { const e = document.createElement('div'); e.className = cls; if (txt != null) e.textContent = txt; this.root.append(e); return e; };
    const sitio = (e, x, y) => { e.style.transform = `translate(${x}px,${y}px)`; return e; };
    const celda = cls => {
      const e = div(cls); e.innerHTML = '<div class="br-bar"></div><div class="br-lb"><i></i></div>';
      const c = { el: e, bar: e.firstChild, lb: e.lastChild, tx: e.lastChild.firstChild, c: {} };
      if (!g.cajas) { c.bar.style.transform = 'scaleY(0)'; c.lb.style.transform = 'translateY(-3px)'; c.c.s = 0; } // nacen a altura 0
      return c;
    };
    const linea = y => { const e = div('br-base'); e.style.width = g.sw * g.cols + 'px'; sitio(e, g.x0, y); };
    if (!g.cajas) linea(g.base);
    if (def.etiquetas) for (let p = 0; p < g.n; p++) sitio(div('br-ix', p), g.x0 + p * g.sw, g.ixY);
    if (def.aux) {
      sitio(div('br-cap', 'aux'), g.x0, g.capY);
      for (let k = 0; k < def.aux; k++) sitio(div('br-hueco'), g.x0 + k * g.sw, g.auxY);
      this.auxs = Array.from({ length: def.aux }, (_, k) => { const c = celda('br-aux oculto'); c.el.dataset.k = k; sitio(c.el, g.x0 + k * g.sw, g.auxY); return c; });
      if (!g.cajas) linea(g.auxY + g.hr);
    } else this.auxs = [];
    this.slot = div('br-slot'); // hueco punteado donde caerá la barra agarrada
    this.sr = div('br-sr'); this.sr.setAttribute('role', 'status'); this.sr.setAttribute('aria-live', 'polite');
    this.cols = Array.from({ length: g.n }, (_, id) => { const c = celda('br-col'); c.el.dataset.id = id; c.id = id; return c; });
    this.cont = div('br-cont');
    this.posDe = Array(g.n).fill(0);
    this.ult = null; this.ids = null; this.cb = null; // el arrastre de la escena anterior no se hereda
  }

  /** S = estado de plegar + `hl`; animar: false | true (520 ms) | milisegundos. Solo transform/opacity (transiciones CSS). */
  pintar(S, animar = true) {
    if (S.def !== this.def) this.fijar(S.def);
    this.cancelar(); this.fin(false); this.ult = S; this.np++;
    const g = this.g, def = this.def, max = def.max, n = g.n;
    const ms = this.nuevo || this.red ? 0 : clamp(animar === true ? 520 : +animar || 0, 0, 3000);
    this.nuevo = false;
    if (ms !== this.ms) { this.root.style.setProperty('--br-ms', ms + 'ms'); this.ms = ms; }
    for (const e of this.nuevos) e.classList.remove('nuevo');
    this.nuevos.length = 0;
    const est = S.hl ? { ...S.est, ...S.hl } : S.est, ran = S.rango;
    // pone `v` en la propiedad `k` de la caché de `c` y solo toca el DOM si cambió
    const set = (c, k, v, fn) => { if (c.c[k] !== v) { c.c[k] = v; fn(v); } };
    const arrOn = c => !!(this.ids && c.id !== undefined && (this.ids === true || this.ids.has(c.id))), tx = TXT[idioma()];
    const pinta = (c, x, y, v, e, cls, p) => {
      set(c, 't', `translate(${x}px,${y}px)`, t => { c.el.style.transform = t; });
      if (!g.cajas) {
        const s = escalaBarra(v, max);
        set(c, 's', s, s => { c.bar.style.transform = `scaleY(${s})`; c.lb.style.transform = `translateY(${-s * g.hr - 3}px)`; });
      }
      set(c, 'v', v ?? '', t => { c.tx.textContent = t; });
      const arr = arrOn(c);
      set(c, 'cls', cls + (e ? ' e-' + e : '') + (arr ? ' arr' : ''), t => { c.el.className = t; });
      // etiqueta accesible solo en lo que se puede mover (el resto lo cubre el aria-label del grupo)
      set(c, 'al', arr ? `${v}, ${tx.pos} ${p + 1} / ${n}` : '', t => {
        if (t) { c.el.setAttribute('role', 'button'); c.el.setAttribute('aria-label', t); } else { c.el.removeAttribute('role'); c.el.removeAttribute('aria-label'); }
      });
      // pulso de aviso (solo transform/opacity: la propiedad individual `scale` se compone con el transform de la barra)
      const en = e ?? null;
      if (en !== c.c.e) { if (en && en !== 'ok' && ms > 0 && c.c.e !== undefined) c.bar.animate({ scale: ['1 1', '1.18 1', '1 1'] }, { duration: Math.min(380, ms), easing: 'ease-out' }); c.c.e = en; }
    };
    S.ord.forEach((id, p) => { this.posDe[id] = p; });
    for (const c of this.cols) {
      const p = this.posDe[c.id], fuera = ran && (p < ran[0] || p > ran[1]);
      pinta(c, g.x0 + p * g.sw, g.topY, S.arr[p], est[p], 'br-col' + (fuera ? ' fuera' : '') + (c.c.p !== undefined && c.c.p !== p ? ' mov' : ''), p);
      c.c.p = p;
    }
    this.auxs.forEach((c, k) => {
      const v = S.aux[k];
      if (v == null) { set(c, 'cls', 'br-aux oculto', t => { c.el.className = t; }); return; }
      pinta(c, g.x0 + k * g.sw, g.auxY, v, null, 'br-aux', k);
    });
    // fila auxiliar sin usar: se atenúa (la escala de la escena no cambia, así que no hay saltos)
    const vacio = def.aux > 0 && S.aux.every(v => v == null);
    if (vacio !== this.auxVacio) { this.auxVacio = vacio; this.root.classList.toggle('aux-vacio', vacio); }
    // Punteros: cada nombre tiene su nodo; los que no están se atenúan; al reaparecer se colocan sin deslizarse
    const vistos = new Set();
    for (const { nombre, i, nivel } of colocarMarcas(S.marcas)) {
      vistos.add(nombre);
      let m = this.mk.get(nombre);
      if (!m) {
        const e = document.createElement('div'); e.textContent = nombre;
        m = { el: e, c: {} }; this.mk.set(nombre, m); this.root.append(e);
        e.className = 'br-mk oculta' + (/^[a-z]+$/i.test(nombre) ? ' m-' + nombre : '');
      }
      if (m.c.oculto !== false) { m.el.classList.add('nuevo'); this.nuevos.push(m.el); m.el.classList.remove('oculta'); m.c.oculto = false; }
      set(m, 't', `translate(${xMarca(g, i)}px,${g.mkY + nivel * MKH}px)`, t => { m.el.style.transform = t; });
    }
    for (const [nombre, m] of this.mk) if (!vistos.has(nombre) && m.c.oculto !== true) { m.el.classList.add('oculta'); m.c.oculto = true; }
    // Contadores (el texto se reconstruye solo si cambia el conjunto de claves o el idioma)
    const ks = Object.keys(S.cont), lang = idioma(), clave = lang + '|' + ks.join('|');
    if (clave !== this.contClave) {
      this.contClave = clave;
      this.cont.replaceChildren(...ks.map(k => { const s = document.createElement('span'); s.innerHTML = '<i></i><b></b>'; etiqueta(s.firstChild, String(L(def.etiquetasCont[k]) || k)); return s; }));
    }
    ks.forEach((k, j) => { const b = this.cont.children[j].lastChild, t = String(S.cont[k]); if (b.textContent !== t) b.textContent = t; });
    this.root.setAttribute('aria-label', S.arr.join(', '));
    this.tip.refrescar();
  }

  repintar(ms) { if (this.ult) this.pintar(this.ult, ms); }

  // ── Arrastre («ordénalo tú») ────────────────────────────────────────────────────────────────────
  // La barra agarrada sigue al puntero a través de dos Muelle (x, y): se mueve con «peso», y al soltar conserva la velocidad
  // y se asienta en su hueco sin saltos. Un único trabajo por fotograma (tarea compartida) escribe su transform; la
  // posición de las demás barras y el hueco punteado de destino solo cambian cuando cambia el índice de inserción.
  /** ids = true (todas) | [ids] | null (desactiva). cb(desde, hasta): índices de inserción al soltar (o con ← →). */
  arrastre(ids, cb) {
    this.ids = ids === true ? true : Array.isArray(ids) && ids.length ? new Set(ids) : null; this.cb = cb;
    this.cancelar();
    for (const c of this.cols) {
      const on = this.ids === true || !!this.ids?.has(c.id);
      if (on) c.el.tabIndex = 0; else c.el.removeAttribute('tabindex');
      c.c.cls = null; c.c.al = null; // fuerza reescribir clase (arr) y etiqueta accesible en el siguiente pintar
    }
    if (this.ult) this.repintar(false);
  }

  abajo(e) {
    const col = e.target.closest?.('.br-col.arr');
    if (!col || !this.cb || this.d || e.button > 0) return;
    e.preventDefault();
    this.fin(false);
    const g = this.g, id = +col.dataset.id, desde = this.posDe[id], r = this.root.getBoundingClientRect(), k = r.width / g.W, x0 = g.x0 + desde * g.sw;
    this.d = {
      id, desde, hasta: desde, r, k, pid: e.pointerId, col, cc: this.cols[id], off: (e.clientX - r.left) / k - x0,
      mx: new Muelle(x0, 34), my: new Muelle(g.topY, 34), cancela: null,
    };
    this.root.setPointerCapture(e.pointerId);
    col.classList.add('agarrada'); col.focus({ preventScroll: true });
    this.root.style.setProperty('--br-ms', (this.red ? 0 : 160) + 'ms'); this.ms = -1;
    this.slot.classList.add('sa', 'on'); this.slot.style.transform = `translate(${x0}px,${g.topY}px)`;
    this.tip.pausa(true);
    this.mueve(e);
  }

  mueve(e) {
    const d = this.d, g = this.g;
    if (!d || e.pointerId !== d.pid) return;
    const x = clamp((e.clientX - d.r.left) / d.k - d.off, g.x0 - g.sw / 2, g.x0 + g.sw * (g.n - .5)), y = g.topY - 6;
    d.mx.ir(x); d.my.ir(y);
    if (this.red) { d.mx.salto(x); d.my.salto(y); this.ponerArr(d); } else this.tareaArr(d);
    const hasta = indiceDeX(g, x + g.sw / 2);
    if (hasta === d.hasta) return;
    d.hasta = hasta;
    this.slot.classList.remove('sa'); this.slot.style.transform = `translate(${g.x0 + hasta * g.sw}px,${g.topY}px)`;
    const np = posTrasMover(g.n, d.desde, hasta);
    for (const c of this.cols) if (c.id !== d.id) c.el.style.transform = `translate(${g.x0 + np[this.posDe[c.id]] * g.sw}px,${g.topY}px)`;
  }

  /** Escribe el transform de la columna agarrada/asentándose desde sus muelles. */
  ponerArr(d) { d.col.style.transform = `translate(${d.mx.x.toFixed(1)}px,${d.my.x.toFixed(1)}px)`; }

  /** Un único trabajo por fotograma mientras los muelles se mueven; al reposar termina el asentamiento. */
  tareaArr(d) {
    if (d.cancela) return;
    d.cancela = tarea((_, dt) => {
      d.mx.paso(dt); d.my.paso(dt); this.ponerArr(d);
      if (!(d.mx.quieto && d.my.quieto)) return true;
      d.cancela = null;
      if (this.as === d) this.fin(true);
      return false;
    });
  }

  suelta(e, cancelado = false) {
    const d = this.d;
    if (!d || e.pointerId !== d.pid) return;
    if (this.root.hasPointerCapture(d.pid)) this.root.releasePointerCapture(d.pid);
    this.cancelar(true);
    const np = this.np;
    if (!cancelado && d.hasta !== d.desde && this.cb) this.cb(d.desde, d.hasta);
    if (this.np === np) this.repintar(260); // nadie repintó (soltó en su sitio o se canceló): vuelve a su hueco
    this.asentar(d);
  }

  /** La barra soltada se asienta en su hueco con los mismos muelles (conservan la velocidad del arrastre). */
  asentar(d) {
    if (this.red || !this.g || !d.col.isConnected) { d.cancela?.(); d.cancela = null; return; }
    const g = this.g, p = this.posDe[d.id];
    d.mx.w = d.my.w = 15; d.mx.ir(g.x0 + p * g.sw); d.my.ir(g.topY);
    this.as = d; d.col.classList.add('asienta'); this.ponerArr(d); this.tareaArr(d);
  }

  /** Termina el asentamiento. final = true: la deja exactamente en su hueco; false (interrumpido): conserva donde esté y pintar() la recoloca. */
  fin(final = true) {
    const d = this.as;
    if (!d) return;
    this.as = null; d.cancela?.(); d.cancela = null; d.col.classList.remove('asienta');
    if (!final || !this.g) { d.cc.c.t = null; return; }
    const t = `translate(${this.g.x0 + this.posDe[d.id] * this.g.sw}px,${this.g.topY}px)`;
    d.col.style.transform = t; d.cc.c.t = t;
  }

  /** Deja el arrastre en curso sin efecto (los nodos se reescribirán en el siguiente pintar). conservar = true: los muelles siguen (asentamiento). */
  cancelar(conservar = false) {
    const d = this.d;
    if (!d) return;
    this.d = null; d.col.classList.remove('agarrada');
    if (!conservar) { d.cancela?.(); d.cancela = null; }
    this.slot?.classList.remove('on');
    this.tip.pausa(false);
    for (const c of this.cols) { c.c.t = null; c.c.cls = null; }
  }

  /** Teclado: ← → mueven la barra enfocada un hueco; Inicio/Fin la llevan a un extremo (guia.js usa esas teclas para cambiar de paso: no se propagan). */
  tecla(e) {
    const col = e.target.closest?.('.br-col.arr');
    if (!col || !this.cb || !this.g) return;
    const id = +col.dataset.id, i = this.posDe[id], n = this.g.n, j = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: n - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault(); e.stopPropagation();
    if (j >= 0 && j < n && j !== i) { this.cb(i, j); this.anunciar(id); }
  }

  /** Anuncia la nueva posición a los lectores de pantalla (región aria-live). */
  anunciar(id) {
    const u = TXT[idioma()], p = this.posDe[id];
    this.sr.textContent = `${this.ult?.arr[p] ?? ''}: ${u.pos} ${p + 1} / ${this.g.n}`;
  }
}
