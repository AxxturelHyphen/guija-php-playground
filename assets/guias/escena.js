// Escena «celdas» (memoria): celdas con dirección/valor y flechas de puntero que se mueven suavemente entre estados,
// con zonas (pila/heap dibujados detrás), grupos (marcos de función, objetos) y arrastre de punteros.
// Las celdas ocupan huecos fijos (posición = orden en `celdas` dentro de su columna), así que el layout no salta.
// Las flechas se calculan con aritmética (sin medir el DOM) y se interpolan en un único requestAnimationFrame.
// Implementa el contrato de escena descrito en guia.js: clave, plegar, crear (+ vista/conVista/ctx para `jugar`).
import { idioma } from './idioma.js';

export const clave = 'celdas';
export const COLW = 230, CELLH = 50, ROWH = 58, GUT = 96, GAP = 130, HEAD = 26, PAD = 6, PX = 18, HG = 22, GP = 8, GG = 12;
const NS = 'http://www.w3.org/2000/svg';
const NUM = ['sx', 'sy', 'ex', 'ey', 'o1', 'o2', 'head', 'bar', 'op'];
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const L = x => (x && typeof x === 'object' ? x[idioma()] : x) ?? '';
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
    this.raf = 0; this.tween = null; this.drag = null; this.vivo = null;
    stage.addEventListener('pointerdown', e => this.arrancar(e));
    stage.addEventListener('pointermove', e => this.mover(e));
    stage.addEventListener('pointerup', e => this.soltar(e));
    stage.addEventListener('pointercancel', e => this.soltar(e, true));
  }

  get tam() { return { W: this.W, H: this.H }; }

  fijar(def) {
    if (def === this.def) return;
    cancelAnimationFrame(this.raf);
    for (const el of [...this.els.values(), ...this.extras]) { el.classList.add('sale'); setTimeout(() => el.remove(), 260); }
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
    for (const e of this.extras) if (e.dataset.col != null) e.textContent = L(cols[e.dataset.col]);
    for (const { z, t } of this.zon) t.textContent = L(z.titulo);
    for (const { id, r, el, t } of this.grp) {
      const v = r.miembros.filter(m => st[m]), fan = v.length && v.every(m => st[m] === 'fantasma');
      el.className = 'grupo' + (v.length ? '' : ' oculta') + (fan ? ' fantasma' : '') + (hl[id] ? ' hl-' + hl[id] : '');
      t.textContent = L(this.def.grupos?.find(g => g.id === id)?.titulo ?? id);
    }
    this.vis = new Set();
    const dianas = new Map();
    for (const c of this.def.celdas) {
      const el = this.els.get(c.id), s = st[c.id], v = val[c.id], ptr = typeof v === 'string' && v[0] === '→';
      if (s) this.vis.add(c.id);
      el.className = 'cel' + (!s ? ' oculta' : s === 'fantasma' ? ' fantasma' : '') + (hl[c.id] ? ' hl-' + hl[c.id] : '') + (this.drag?.has(c.id) && s ? ' arrastrable' : '');
      el.children[0].textContent = c.addr;
      el.children[1].textContent = L(c.type) + (c.size ? ` · ${c.size} B` : '');
      el.children[2].textContent = L(c.name);
      const valEl = el.children[3], txt = String(this.texto(v, c));
      valEl.className = 'val' + (ptr ? ' ptr' : '');
      if (s && txt !== this.txt.get(c.id) && anim && this.txt.has(c.id)) {
        valEl.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: Math.min(320, dur), easing: 'ease-out' });
        if (!s || s === 'vivo') el.animate([{ opacity: .55 }, { opacity: 1 }], { duration: Math.min(520, dur * 1.2), easing: 'ease-out' });
      }
      valEl.textContent = s === 'fantasma' ? '' : txt;
      this.txt.set(c.id, txt);
      if (ptr && s) { const t = this.diana(c, v, st, hl); if (t) dianas.set(c.id, t); }
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
  /** Activa (ids = [..]) o desactiva (null) el arrastre; cb(origen, destino) al soltar sobre una celda visible. */
  arrastre(ids, cb) {
    this.drag = ids && ids.length ? new Set(ids) : null; this.cbSoltar = cb;
    for (const [id, el] of this.els) el.classList.toggle('arrastrable', !!(this.drag && this.drag.has(id) && this.vis.has(id)));
  }

  local(e) {
    const r = this.stage.getBoundingClientRect(), k = r.width / this.W;
    return [(e.clientX - r.left) / k, (e.clientY - r.top) / k];
  }

  arrancar(e) {
    const el = e.target.closest('.cel.arrastrable');
    if (!el) return;
    e.preventDefault(); this.stage.setPointerCapture(e.pointerId);
    this.vivo = { id: el.dataset.id, path: svg('path', 'vivo'), dst: null };
    this.svg.append(this.vivo.path); el.classList.add('agarrada');
    this.mover(e);
  }

  mover(e) {
    const v = this.vivo;
    if (!v) return;
    const [px, py] = this.local(e), o = this.pos.get(v.id), sx = o.x + COLW, sy = o.y + CELLH / 2;
    v.path.setAttribute('d', `M${sx} ${sy}C${sx + 60} ${sy} ${px - 60} ${py} ${px} ${py}`);
    let dst = null;
    for (const id of this.vis) {
      const p = this.pos.get(id);
      if (id !== v.id && px >= p.x - 4 && px <= p.x + COLW + 4 && py >= p.y - 4 && py <= p.y + CELLH + 4) { dst = id; break; }
    }
    if (dst !== v.dst) { this.els.get(v.dst)?.classList.remove('diana'); this.els.get(dst)?.classList.add('diana'); v.dst = dst; }
  }

  soltar(e, cancelado = false) {
    const v = this.vivo;
    if (!v) return;
    this.vivo = null; v.path.remove();
    this.els.get(v.dst)?.classList.remove('diana'); this.els.get(v.id)?.classList.remove('agarrada');
    if (this.stage.hasPointerCapture(e.pointerId)) this.stage.releasePointerCapture(e.pointerId);
    if (!cancelado && v.dst && this.cbSoltar) this.cbSoltar(v.id, v.dst);
  }
}
