// Escena «celdas» (memoria): celdas con dirección/valor y flechas de puntero que se mueven suavemente entre estados,
// con zonas (pila/heap dibujados detrás), grupos (marcos de función, objetos) y arrastre de punteros.
// Las celdas ocupan huecos fijos (posición = orden en `celdas` dentro de su columna), así que el layout no salta.
// Las flechas se calculan con aritmética (sin medir el DOM) y se interpolan en un único requestAnimationFrame.
// Implementa el contrato de escena descrito en guia.js: clave, plegar, crear (+ vista/conVista/ctx para `jugar`).
//
// Interacción (sin cambiar el formato de datos): tooltip al pasar el puntero o enfocar una celda (nombre, tipo, dirección,
// valor, a quién apunta y quién la apunta) con resaltado de las flechas que la tocan; arrastre de punteros con el extremo
// de la flecha colgado de un Muelle (peso, imán sobre la celda destino, vuelve al origen si no se suelta sobre una celda);
// al soltar, la flecha real nace desde donde se dejó. Teclado: Intro/Espacio sobre una celda arrastrable abre la elección
// de destino, ↑↓←→ recorren las celdas candidatas, Intro confirma y Esc cancela (una región aria-live anuncia el destino).
// Los textos de zonas, grupos, columnas, nombres y tipos admiten `$…$` (KaTeX vía mates.etiqueta, solo si cambian).
import { idioma } from './idioma.js';
import { etiqueta } from './mates.js';
import { Muelle, tarea } from './movimiento.js';
import { crearTip } from './tip.js';

export const clave = 'celdas';
export const COLW = 230, CELLH = 50, ROWH = 58, GUT = 96, GAP = 130, HEAD = 26, PAD = 6, PX = 18, HG = 22, GP = 8, GG = 12;
const NS = 'http://www.w3.org/2000/svg';
const NUM = ['sx', 'sy', 'ex', 'ey', 'o1', 'o2', 'head', 'bar', 'op'];
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const L = x => (x && typeof x === 'object' ? x[idioma()] : x) ?? '';
const TXT = {
  es: { tipo: 'Tipo', dir: 'Dirección', val: 'Valor', apunta: 'Apunta a', apuntada: 'Apuntada por', estado: 'Estado', grupo: 'En', nulo: 'nada (nulo)', fan: 'liberada o fuera de ámbito', nada: '—', agarra: 'puntero: Intro para elegir a qué celda apunta', elige: 'Elige destino', sin: 'sin destino', fin: 'apunta ahora a' },
  en: { tipo: 'Type', dir: 'Address', val: 'Value', apunta: 'Points to', apuntada: 'Pointed by', estado: 'State', grupo: 'In', nulo: 'nothing (null)', fan: 'freed or out of scope', nada: '—', agarra: 'pointer: press Enter to choose which cell it points to', elige: 'Choose target', sin: 'no target', fin: 'now points to' },
};
const CSS = `
.cel{box-shadow:inset 0 1px 0 rgba(255,255,255,.045),0 1px 2px rgba(0,0,0,.3)}
.cel.arrastrable:focus,.cel.arrastrable:focus-visible{outline:none}
.cel.arrastrable:focus-visible{border-color:var(--g-activo);box-shadow:0 0 0 3px var(--g-halo)}
.cel.enlace{border-color:var(--g-aux);background:var(--g-aux-bg)}
.cel.elige{border-color:var(--g-hecho);background:var(--g-hecho-bg)}
.fl.hov .ln,.fl.hov .br{stroke:var(--g-aux);stroke-width:3} .fl.hov .hd{fill:var(--g-aux)}
path.vivo.imana{stroke-dasharray:none;stroke-width:2.5}
circle.vivo-p{fill:var(--g-activo);stroke:var(--island);stroke-width:2;pointer-events:none}
.pg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;
const inyectarCss = () => {
  if (document.getElementById('css-celdas')) return;
  const e = document.createElement('style'); e.id = 'css-celdas'; e.textContent = CSS; document.head.append(e);
};
/** Pone el texto en el elemento solo si cambió (con `$…$` pasa por KaTeX). */
const poner = (el, t) => { if (el._t !== t) { el._t = t; etiqueta(el, t); } };
const svg = (tag, cls) => { const e = document.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); return e; };
const ICO = {
  pila: '<svg viewBox="0 0 16 16" width="15" height="15"><g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="2" y="2" width="12" height="3.2" rx="1"/><rect x="2" y="6.4" width="12" height="3.2" rx="1"/><rect x="2" y="10.8" width="12" height="3.2" rx="1"/></g></svg>',
  heap: '<svg viewBox="0 0 16 16" width="15" height="15"><g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="2" y="2.5" width="5" height="5" rx="1"/><rect x="9" y="4" width="5" height="3.5" rx="1"/><rect x="3.5" y="9.5" width="4" height="4" rx="1"/><rect x="9.5" y="10" width="4.5" height="3.5" rx="1"/></g></svg>',
  datos: '<svg viewBox="0 0 16 16" width="15" height="15"><g fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 6h12M2 10h12M6 2v12"/></g></svg>',
};

/** Parche de estado: un paso con `celdas` abre escena nueva; el resto (mostrar/ocultar/fantasma/val) modifica. Pura. */
export function plegar(s, p) {
  s = p.celdas
    ? { def: { celdas: p.celdas, cols: p.cols || null, zonas: p.zonas || null, grupos: p.grupos || null }, st: {}, val: {} }
    : { ...s, st: { ...s.st }, val: { ...s.val } };
  for (const id of p.mostrar || []) s.st[id] = 'vivo';
  for (const id of p.ocultar || []) delete s.st[id];
  for (const id of p.fantasma || []) s.st[id] = 'fantasma';
  Object.assign(s.val, p.val);
  return s;
}
// Para los bloques `jugar`: los botones mutan una copia de los valores
export const vista = s => ({ ...s.val });
export const conVista = (s, v) => ({ ...s, val: v });
export const ctx = s => ({ cel: Object.fromEntries(s.def.celdas.map(c => [c.id, c])) });
export const crear = stage => new Escena(stage);

export class Escena {
  constructor(stage) {
    this.stage = stage;
    this.def = null; this.por = new Map(); this.els = new Map(); this.extras = []; this.gr = new Map(); this.vis = new Set();
    this.arr = new Map(); this.cur = new Map(); this.txt = new Map(); this.W = this.H = 0;
    this.svg = svg('svg', 'flechas'); stage.append(this.svg);
    this.raf = 0; this.tween = null; this.drag = null; this.vivo = null; this.kb = null; this.ptr = new Map(); this.hov = null; this.ult = null;
    inyectarCss();
    this.sr = Object.assign(document.createElement('div'), { className: 'pg-sr' }); this.sr.setAttribute('role', 'status'); this.sr.setAttribute('aria-live', 'polite'); stage.append(this.sr);
    this.tip = crearTip(stage, { objetivo: n => this.tipClave(n), datos: id => this.tipDatos(id), sobre: id => { this.hov = id; this.aplicarHover(); } });
    stage.addEventListener('keydown', e => this.tecla(e));
    stage.addEventListener('focusout', () => { if (this.kb) this.kbCancelar(); });
    stage.addEventListener('pointerdown', e => this.arrancar(e));
    stage.addEventListener('pointermove', e => this.mover(e));
    stage.addEventListener('pointerup', e => this.soltar(e));
    stage.addEventListener('pointercancel', e => this.soltar(e, true));
  }

  get tam() { return { W: this.W, H: this.H }; }

  fijar(def) {
    if (def === this.def) return;
    cancelAnimationFrame(this.raf); this.vivoFuera(); this.tip.ocultar(); this.ptr = new Map(); this.ult = null;
    for (const el of [...this.els.values(), ...this.extras]) { el.classList.remove('arrastrable'); el.removeAttribute('tabindex'); el.classList.add('sale'); setTimeout(() => el.remove(), 260); }
    for (const r of this.arr.values()) r.g.remove();
    this.def = def; this.els = new Map(); this.extras = []; this.gr = new Map(); this.vis = new Set();
    this.arr = new Map(); this.cur = new Map(); this.txt = new Map(); this.pos = new Map(); this.drag = null;
    const { celdas, cols, zonas, grupos } = def;
    this.por = new Map(celdas.map(c => [c.id, c]));
    const ncols = 1 + Math.max(...celdas.map(c => c.col || 0));
    const cab = zonas || cols ? HEAD + 8 : PAD, cur = Array(ncols).fill(cab), abierto = Array(ncols).fill(null);
    const cerrar = col => {
      const r = this.gr.get(abierto[col]);
      r.h = cur[col] - ROWH + CELLH + GP - r.y; cur[col] = r.y + r.h + GG; abierto[col] = null;
    };
    for (const c of celdas) {
      const col = c.col || 0, g = c.grupo || null;
      if (g !== abierto[col]) {
        if (abierto[col]) cerrar(col);
        if (g) { this.gr.set(g, { x: PX + col * (COLW + GAP) - 8, y: cur[col], w: COLW + 16, h: 0, miembros: [] }); cur[col] += HG; abierto[col] = g; }
      }
      this.pos.set(c.id, { x: PX + col * (COLW + GAP), y: cur[col], col });
      cur[col] += ROWH;
      if (g) this.gr.get(g).miembros.push(c.id);
    }
    for (let col = 0; col < ncols; col++) if (abierto[col]) cerrar(col);
    this.W = PX + ncols * COLW + (ncols - 1) * GAP + GUT; // margen derecho: ahí salen las flechas de la última columna
    this.H = Math.max(...cur) + PAD;
    const poner = (el, antes) => { this.stage.insertBefore(el, antes); this.extras.push(el); return el; };
    // Capas: zonas < grupos < flechas < celdas
    this.zon = (zonas || []).map(z => {
      const el = poner(Object.assign(document.createElement('div'), { className: 'zona ' + (z.tono || 'datos') }), this.svg);
      el.style.cssText = `transform:translate(${PX + (z.col || 0) * (COLW + GAP) - 14}px,0);width:${COLW + 28}px;height:${this.H - 2}px`;
      el.innerHTML = `<span class="zt">${ICO[z.tono] || ICO.datos}<span></span></span>`;
      return { z, t: el.querySelector('.zt span:last-child') };
    });
    this.grp = [...this.gr].map(([id, r]) => {
      const el = poner(Object.assign(document.createElement('div'), { className: 'grupo oculta' }), this.svg);
      el.style.cssText = `transform:translate(${r.x}px,${r.y}px);width:${r.w}px;height:${r.h}px`;
      el.innerHTML = '<span class="gt"></span>';
      return { id, r, el, t: el.firstChild };
    });
    for (const c of celdas) {
      const { x, y } = this.pos.get(c.id), el = document.createElement('div');
      el.className = 'cel oculta'; el.dataset.id = c.id;
      el.style.transform = `translate(${x}px,${y}px)`;
      el.innerHTML = '<span class="dir"></span><span class="tip"></span><span class="nom"></span><span class="val"></span>';
      this.stage.append(el); this.els.set(c.id, el);
    }
    (cols || []).forEach((t, i) => {
      if ((zonas || []).some(z => (z.col || 0) === i)) return;
      const h = poner(Object.assign(document.createElement('div'), { className: 'colh' }), this.svg);
      h.style.transform = `translate(${PX + i * (COLW + GAP)}px,0)`; h.dataset.col = i;
    });
    this.stage.style.width = this.W + 'px'; this.stage.style.height = this.H + 'px';
    this.svg.setAttribute('width', this.W); this.svg.setAttribute('height', this.H);
  }

  /** Valor mostrado: «→id» = puntero a esa celda (muestra su dirección), «→∅» = nullptr (o c.nulo). */
  texto(v, c) {
    if (typeof v === 'string' && v[0] === '→') return v === '→∅' ? c.nulo ?? 'nullptr' : this.por.get(v.slice(1))?.addr ?? '?';
    return v ?? '';
  }

  /** S = {st: {id: 'vivo'|'fantasma'}, val: {id: valor}, hl: {id|grupo: 'a'|'b'|'c'}}; animar: false | true | ms */
  pintar({ st, val, hl = {} }, animar = true) {
    const dur = animar === true ? 520 : +animar || 0, anim = dur > 0 && !REDUCIDO, { cols } = this.def;
    this.ult = { st, val };
    for (const e of this.extras) if (e.dataset.col != null) poner(e, String(L(cols[e.dataset.col])));
    for (const { z, t } of this.zon) poner(t, String(L(z.titulo)));
    for (const { id, r, el, t } of this.grp) {
      const v = r.miembros.filter(m => st[m]), fan = v.length && v.every(m => st[m] === 'fantasma');
      el.className = 'grupo' + (v.length ? '' : ' oculta') + (fan ? ' fantasma' : '') + (hl[id] ? ' hl-' + hl[id] : '');
      poner(t, String(L(this.def.grupos?.find(g => g.id === id)?.titulo ?? id)));
    }
    this.vis = new Set();
    const dianas = new Map(), ptrs = new Map();
    for (const c of this.def.celdas) {
      const el = this.els.get(c.id), s = st[c.id], v = val[c.id], ptr = typeof v === 'string' && v[0] === '→';
      if (s) this.vis.add(c.id);
      el.className = 'cel' + (!s ? ' oculta' : s === 'fantasma' ? ' fantasma' : '') + (hl[c.id] ? ' hl-' + hl[c.id] : '') + (this.drag?.has(c.id) && s ? ' arrastrable' : '');
      const arr = !!(this.drag?.has(c.id) && s), u = TXT[idioma()];
      if (arr) { el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${L(c.name)}, ${u.agarra}`); }
      else if (el.hasAttribute('tabindex')) { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); }
      poner(el.children[0], String(c.addr ?? ''));
      poner(el.children[1], String(L(c.type)) + (c.size ? ` · ${c.size} B` : ''));
      poner(el.children[2], String(L(c.name)));
      const valEl = el.children[3], txt = String(this.texto(v, c));
      valEl.className = 'val' + (ptr ? ' ptr' : '');
      if (s && txt !== this.txt.get(c.id) && anim && this.txt.has(c.id)) {
        valEl.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: Math.min(320, dur), easing: 'ease-out' });
        if (!s || s === 'vivo') el.animate([{ opacity: .55 }, { opacity: 1 }], { duration: Math.min(520, dur * 1.2), easing: 'ease-out' });
      }
      poner(valEl, s === 'fantasma' ? '' : txt);
      this.txt.set(c.id, txt);
      if (ptr && s) { const t = this.diana(c, v, st, hl); if (t) { dianas.set(c.id, t); if (v !== '→∅') ptrs.set(c.id, v.slice(1)); } }
    }
    // Flechas: las que ya no existen se desvanecen donde estaban; las nuevas «salen» de su origen
    const from = new Map(), to = new Map();
    for (const [id, a] of this.cur) if (!dianas.has(id)) dianas.set(id, { ...a, op: 0, head: 0, bar: 0, cls: 'fl' });
    for (const [id, t] of dianas) {
      from.set(id, { ...(this.cur.get(id) ?? { ...t, ex: t.sx, ey: t.sy, op: 0, head: 0, bar: 0 }) });
      to.set(id, t);
      this.garr(id).g.setAttribute('class', t.cls);
    }
    cancelAnimationFrame(this.raf);
    this.tween = { t0: performance.now(), dur: anim ? dur : 0, from, to };
    this.frame(this.tween.t0);
    this.ptr = ptrs; this.aplicarHover(); this.tip.refrescar();
  }

  // ── Tooltip y relaciones al pasar el puntero ──
  tipClave(n) {
    const c = n.closest?.('.cel');
    return c && this.stage.contains(c) ? c.dataset.id : null;
  }

  /** Quién apunta a `id` (ids de celdas). */
  apuntadaPor(id) { return [...this.ptr].filter(([, t]) => t === id).map(([o]) => o); }

  tipDatos(id) {
    const c = this.por.get(id), S = this.ult, o = this.pos?.get(id);
    if (!c || !S || !o || !S.st[id]) return null;
    const u = TXT[idioma()], v = S.val[id], ptr = typeof v === 'string' && v[0] === '→', nombre = i => String(L(this.por.get(i)?.name ?? i)), filas = [];
    const txt = String(this.texto(v, c));
    if (c.type) filas.push([u.tipo, String(L(c.type)) + (c.size ? ` · ${c.size} B` : '')]);
    if (c.addr) filas.push([u.dir, c.addr]);
    filas.push([u.val, S.st[id] === 'fantasma' || txt === '' ? u.nada : txt]);
    if (ptr) {
      const t = v.slice(1);
      filas.push([u.apunta, v === '→∅' ? u.nulo : `${nombre(t)}${S.st[t] === 'fantasma' ? ' · ' + u.fan : ''}`]);
    }
    const por = this.apuntadaPor(id);
    if (por.length) filas.push([u.apuntada, por.map(nombre).join(', ')]);
    if (S.st[id] === 'fantasma') filas.push([u.estado, u.fan]);
    if (c.grupo) { const g = this.def.grupos?.find(x => x.id === c.grupo); if (g) filas.push([u.grupo, String(L(g.titulo))]); }
    return { titulo: String(L(c.name)), filas, x: o.x + COLW / 2, y: o.y - 2, y2: o.y + CELLH + 2 };
  }

  /** Resalta la flecha de la celda con el puntero encima, las que llegan a ella y las celdas del otro extremo. */
  aplicarHover() {
    const h = this.hov, rel = new Set(), fl = new Set();
    if (h) {
      const a = this.ptr.get(h);
      if (a) { fl.add(h); rel.add(a); }
      for (const o of this.apuntadaPor(h)) { fl.add(o); rel.add(o); }
    }
    for (const [id, el] of this.els) el.classList.toggle('enlace', rel.has(id));
    for (const [id, r] of this.arr) r.g.classList.toggle('hov', fl.has(id));
  }

  /** Geometría de la flecha de un puntero (null si el destino no está en escena). */
  diana(c, v, st, hl) {
    const o = this.pos.get(c.id), sy = o.y + CELLH / 2, base = { sy, cls: 'fl' + (hl[c.id] ? ' hl' : '') };
    if (v === '→∅') { const sx = o.x + COLW; return { ...base, sx, ex: sx + 36, ey: sy, o1: 12, o2: -12, h: -1, head: 0, bar: 1, op: 1 }; }
    const id = v.slice(1), d = this.pos.get(id), ts = st[id];
    if (!d || !ts) return null;
    const cls = base.cls + (ts === 'fantasma' ? ' bad' : ''), ey = d.y + CELLH / 2;
    if (d.col === o.col) {
      const sx = o.x + COLW, k = 46 + Math.min(44, Math.abs(ey - sy) * .3);
      return { ...base, cls, sx, ex: sx, ey, o1: k, o2: k, h: -1, head: 1, bar: 0, op: 1 };
    }
    const der = d.col > o.col, sx = der ? o.x + COLW : o.x, ex = der ? d.x : d.x + COLW, m = (ex - sx) / 2.4;
    return { ...base, cls, sx, ex, ey, o1: m, o2: -m, h: der ? 1 : -1, head: 1, bar: 0, op: 1 };
  }

  garr(id) {
    let r = this.arr.get(id);
    if (!r) {
      r = { g: svg('g', 'fl'), ln: svg('path', 'ln'), hd: svg('path', 'hd'), br: svg('path', 'br') };
      r.g.append(r.ln, r.hd, r.br); this.svg.append(r.g); this.arr.set(id, r);
    }
    return r;
  }

  frame = now => {
    const T = this.tween, k = T.dur ? Math.min(1, (now - T.t0) / T.dur) : 1, e = ease(k);
    for (const [id, b] of T.to) {
      const a = T.from.get(id), c = { h: b.h };
      for (const n of NUM) c[n] = a[n] + (b[n] - a[n]) * e;
      this.cur.set(id, c); this.dibujar(id, c);
    }
    if (k < 1) this.raf = requestAnimationFrame(this.frame);
  };

  dibujar(id, a) {
    const r = this.garr(id), { sx, sy, ex, ey, h } = a;
    r.ln.setAttribute('d', `M${sx} ${sy}C${sx + a.o1} ${sy} ${ex + a.o2} ${ey} ${ex} ${ey}`);
    r.hd.setAttribute('d', `M${ex} ${ey}l${-8 * h} -4.5l0 9z`);
    r.br.setAttribute('d', `M${ex} ${ey - 8}L${ex} ${ey + 8}`);
    r.g.style.opacity = a.op; r.hd.style.opacity = a.head; r.br.style.opacity = a.bar;
  }

  // ── Arrastre de punteros: se arrastra desde la celda y se suelta sobre la celda destino ──
  // El extremo de la flecha «viva» cuelga de dos Muelle: sigue al puntero con algo de peso, se pega (imán) a la celda
  // candidata y, si no se suelta sobre ninguna, vuelve a su origen. El rectángulo del stage se mide UNA vez al agarrar.
  /** Activa (ids = [..]) o desactiva (null) el arrastre; cb(origen, destino) al soltar sobre una celda visible. */
  arrastre(ids, cb) {
    this.drag = ids && ids.length ? new Set(ids) : null; this.cbSoltar = cb;
    if (this.kb) this.kbCancelar();
    for (const [id, el] of this.els) {
      const on = !!(this.drag && this.drag.has(id) && this.vis.has(id));
      el.classList.toggle('arrastrable', on);
      if (on) { el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${L(this.por.get(id).name)}, ${TXT[idioma()].agarra}`); }
      else if (el.hasAttribute('tabindex')) { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); }
    }
  }

  /** Crea la flecha viva de `id` con el extremo en (px, py). */
  iniciarVivo(id, px, py) {
    const o = this.pos.get(id), sx = o.x + COLW, sy = o.y + CELLH / 2;
    const v = { id, sx, sy, path: svg('path', 'vivo'), punta: svg('circle', 'vivo-p'), dst: null, izq: false, snap: false, suelto: false, mx: new Muelle(px, 30), my: new Muelle(py, 30), cancela: null, r: null, k: 1, kb: false };
    v.punta.setAttribute('r', 5); this.svg.append(v.path, v.punta);
    this.els.get(id)?.classList.add('agarrada');
    this.vivo = v; this.pintarVivo(v); this.tip.pausa(true);
    return v;
  }

  pintarVivo(v) {
    const x = v.mx.x, y = v.my.x;
    v.path.setAttribute('d', `M${v.sx} ${v.sy}C${v.sx + 60} ${v.sy} ${v.izq ? x + 60 : x - 60} ${y} ${x} ${y}`);
    v.punta.setAttribute('cx', x); v.punta.setAttribute('cy', y);
  }

  /** Un único trabajo por fotograma mientras los muelles se mueven; al reposar, si la flecha se soltó, se retira. */
  tareaVivo(v) {
    if (REDUCIDO) { v.mx.salto(v.mx.a); v.my.salto(v.my.a); this.pintarVivo(v); if (v.suelto) this.quitarVivo(v); return; }
    if (v.cancela) return;
    v.cancela = tarea((_, dt) => {
      v.mx.paso(dt); v.my.paso(dt); this.pintarVivo(v);
      if (!(v.mx.quieto && v.my.quieto)) return true;
      v.cancela = null; if (v.suelto) this.quitarVivo(v);
      return false;
    });
  }

  quitarVivo(v) { v.cancela?.(); v.cancela = null; v.path.remove(); v.punta.remove(); }

  /** Apunta la flecha viva al candidato `dst` (imán a su borde) o, sin candidato, al punto (px, py). */
  apuntar(v, dst, px, py) {
    if (dst) {
      const p = this.pos.get(dst), der = p.x > this.pos.get(v.id).x;
      v.mx.ir(der ? p.x : p.x + COLW); v.my.ir(p.y + CELLH / 2); v.izq = !der;
    } else { v.mx.ir(px); v.my.ir(py); v.izq = false; }
    if (!!dst !== v.snap) { v.snap = !!dst; v.path.classList.toggle('imana', v.snap); }
    this.tareaVivo(v);
  }

  /** Cambia el candidato resaltado. */
  candidato(v, dst) {
    if (dst === v.dst) return;
    this.els.get(v.dst)?.classList.remove('diana', 'elige'); this.els.get(dst)?.classList.add(v.kb ? 'elige' : 'diana'); v.dst = dst;
  }

  /** Deja la flecha viva: aceptada (la real ocupa su lugar) o rechazada (vuelve a su origen y se retira). */
  cerrarVivo(v, aceptada) {
    this.els.get(v.dst)?.classList.remove('diana', 'elige'); this.els.get(v.id)?.classList.remove('agarrada');
    this.tip.pausa(false);
    if (aceptada || REDUCIDO) { this.quitarVivo(v); return; }
    v.suelto = true; v.snap = false; v.path.classList.remove('imana'); v.mx.w = v.my.w = 20; v.mx.ir(v.sx); v.my.ir(v.sy); this.tareaVivo(v);
  }

  /** La flecha real del puntero arranca desde donde el usuario dejó el extremo (la animación de pintar la lleva al destino). */
  sembrar(v) {
    const r = this.garr(v.id), c = { sx: v.sx, sy: v.sy, ex: v.mx.x, ey: v.my.x, o1: 60, o2: v.izq ? 60 : -60, h: v.izq ? -1 : 1, head: 1, bar: 0, op: 1 };
    r.g.setAttribute('class', 'fl hl'); this.cur.set(v.id, c); this.dibujar(v.id, c);
  }

  /** Quita sin ceremonias cualquier flecha viva (cambio de escena). */
  vivoFuera() {
    const v = this.vivo;
    if (!v) return;
    this.vivo = null; this.kb = null; this.quitarVivo(v);
    this.els.get(v.dst)?.classList.remove('diana', 'elige'); this.els.get(v.id)?.classList.remove('agarrada');
  }

  local(v, e) { return [(e.clientX - v.r.left) / v.k, (e.clientY - v.r.top) / v.k]; }

  arrancar(e) {
    const el = e.target.closest('.cel.arrastrable');
    if (!el || this.vivo || this.els.get(el.dataset.id) !== el) return; // (las celdas de una escena anterior se están desvaneciendo: no cuentan)
    e.preventDefault(); this.stage.setPointerCapture(e.pointerId);
    const r = this.stage.getBoundingClientRect(), k = r.width / this.W || 1, px = (e.clientX - r.left) / k, py = (e.clientY - r.top) / k;
    const v = this.iniciarVivo(el.dataset.id, px, py);
    v.r = r; v.k = k; v.pid = e.pointerId; el.focus({ preventScroll: true });
    this.mover(e);
  }

  mover(e) {
    const v = this.vivo;
    if (!v || v.kb || e.pointerId !== v.pid) return;
    const [px, py] = this.local(v, e);
    let dst = null;
    for (const id of this.vis) {
      const p = this.pos.get(id);
      if (id !== v.id && px >= p.x - 4 && px <= p.x + COLW + 4 && py >= p.y - 4 && py <= p.y + CELLH + 4) { dst = id; break; }
    }
    this.candidato(v, dst); this.apuntar(v, dst, px, py);
  }

  soltar(e, cancelado = false) {
    const v = this.vivo;
    if (!v || v.kb) return;
    this.vivo = null;
    if (this.stage.hasPointerCapture(e.pointerId)) this.stage.releasePointerCapture(e.pointerId);
    const ok = !cancelado && v.dst && this.cbSoltar;
    this.cerrarVivo(v, !!ok);
    if (ok) { this.sembrar(v); this.cbSoltar(v.id, v.dst); }
  }

  // ── Teclado: Intro/Espacio abre la elección de destino; ↑↓←→ recorren los candidatos; Intro confirma; Esc cancela ──
  tecla(e) {
    const k = e.key;
    if (!this.kb) {
      const el = e.target.closest?.('.cel.arrastrable');
      if (el && (k === 'Enter' || k === ' ')) { e.preventDefault(); e.stopPropagation(); this.kbIniciar(el.dataset.id); }
      return;
    }
    const paso = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[k];
    if (paso) { e.preventDefault(); e.stopPropagation(); this.kbMover(paso); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); e.stopPropagation(); this.kbConfirmar(); }
    else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); this.kbCancelar(); }
  }

  kbIniciar(id) {
    if (this.vivo || !this.vis.has(id)) return;
    const lista = this.def.celdas.map(c => c.id).filter(x => this.vis.has(x) && x !== id);
    if (!lista.length) return;
    const o = this.pos.get(id), v = this.iniciarVivo(id, o.x + COLW, o.y + CELLH / 2), actual = lista.indexOf(this.ptr.get(id));
    v.kb = true; this.kb = { id, lista, i: actual >= 0 ? actual : 0 };
    this.kbMostrar();
  }

  kbMover(d) { const K = this.kb; K.i = (K.i + d + K.lista.length) % K.lista.length; this.kbMostrar(); }

  kbMostrar() {
    const K = this.kb, v = this.vivo, dst = K.lista[K.i];
    this.candidato(v, dst); this.apuntar(v, dst);
    const c = this.por.get(dst), u = TXT[idioma()];
    this.sr.textContent = `${u.elige}: ${L(c.name)} ${c.addr ?? ''} (${K.i + 1}/${K.lista.length})`;
  }

  kbConfirmar() {
    const K = this.kb, v = this.vivo, dst = K.lista[K.i];
    this.kb = null; this.vivo = null;
    this.cerrarVivo(v, true); this.sembrar(v);
    this.sr.textContent = `${L(this.por.get(K.id).name)} ${TXT[idioma()].fin} ${L(this.por.get(dst).name)}`;
    if (this.cbSoltar) this.cbSoltar(K.id, dst);
  }

  kbCancelar() {
    const v = this.vivo;
    this.kb = null; this.vivo = null;
    if (v) this.cerrarVivo(v, false);
    this.sr.textContent = TXT[idioma()].sin;
  }
}
