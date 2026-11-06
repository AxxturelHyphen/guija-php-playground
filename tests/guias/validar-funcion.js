'use strict';
/**
 * Validador de la escena «funcion» para tests/guias-datos.js (ver su cabecera):
 *   module.exports = () => (p, w, info) => { … }     (la fábrica se llama una vez por guía)
 * Comprueba: curvas (id único; f | param | polar; nombre; f devuelve números), par numérico, deslizadores y `arrastrar`
 * coherentes, capas con su tipo y claves obligatorias, referencias a parámetros y curvas que existen, ver/resaltar,
 * ventana bien formada, `funcion` solo al abrir, y los botones de `jugar` ejecutados sobre una copia.
 */
const REQ = {
  tangente: ['c', 'x'], secante: ['c', 'x', 'h'], riemann: ['c', 'a', 'b', 'n'], entre: ['c', 'g', 'a', 'b'], taylor: ['c', 'a', 'grado', 'coef'],
  epsdelta: ['x', 'L', 'eps', 'delta'], punto: ['x'], asintota: [], newton: ['c', 'x', 'n'], marca: ['c', 'u'], linea: ['x1', 'y1', 'x2', 'y2'], texto: ['x', 'y', 's'],
};
const METODOS = ['izq', 'der', 'medio', 'trap', 'exacta'];
const NUM_CAPA = ['x', 'h', 'a', 'b', 'n', 'grado', 'L', 'eps', 'delta', 'y', 'u', 'x1', 'y1', 'x2', 'y2'];
const SOLO_APERTURA = ['curvas', 'deslizadores', 'arrastrar', 'igual', 'etiqueta'];

module.exports = () => {
  let def = null, par = {}, ver = [];
  const num = x => typeof x === 'number' && Number.isFinite(x);
  const ids = () => new Set(def.curvas.map(c => c.id));
  const par2 = x => num(x) || (typeof x === 'string' && x in par);

  const capas = (lista, w) => {
    if (!Array.isArray(lista)) return w('capas: array de capas');
    lista.forEach((c, i) => {
      const q = `capas[${i}] «${c?.tipo}»: `;
      if (!c || !(c.tipo in REQ)) return w(q + 'tipo desconocido (' + Object.keys(REQ).join('|') + ')');
      for (const k of REQ[c.tipo]) if (c[k] === undefined) w(q + `falta «${k}»`);
      for (const k of ['c', 'g']) if (c[k] !== undefined && !ids().has(c[k])) w(q + `${k}: curva desconocida «${c[k]}»`);
      if (c.tipo === 'punto' && c.c === undefined && c.y === undefined) w(q + 'necesita c o y');
      if (c.tipo === 'asintota' && !('x' in c) && !('y' in c)) w(q + 'necesita x o y');
      for (const k of NUM_CAPA) if (c[k] !== undefined && !par2(c[k])) w(q + `${k}: número o parámetro existente (recibido ${JSON.stringify(c[k])})`);
      if (c.tipo === 'riemann' && c.m !== undefined && !METODOS.includes(c.m)) w(q + `m «${c.m}» (${METODOS.join('|')})`);
      if (c.tipo === 'taylor' && typeof c.coef !== 'function') w(q + 'coef: función k => número');
      if (c.tipo === 'texto' && !(typeof c.s === 'string' || (c.s?.es && c.s?.en))) w(q + 's: texto o {es,en}');
    });
  };

  const ventana = (v, w, d) => {
    if (!v || typeof v !== 'object') return w(d + 'ventana: {x:[a,b], y:[c,d]}');
    for (const k of ['x', 'y']) if (v[k] !== undefined && !(Array.isArray(v[k]) && v[k].length === 2 && v[k].every(num) && v[k][0] < v[k][1])) w(`${d}ventana.${k}: [min, max] con min < max`);
  };

  const abrir = (g, w) => {
    def = null;
    if (!Array.isArray(g.curvas)) return w('funcion.curvas: array de {id, nombre, f | param | polar}');
    const vistos = new Set();
    g.curvas.forEach((c, i) => {
      const q = `curvas[${i}]${c.id ? ` «${c.id}»` : ''}: `;
      if (!c.id || typeof c.id !== 'string') w(q + 'falta id (texto)'); else if (vistos.has(c.id)) w(q + 'id repetido');
      vistos.add(c.id);
      if (!(typeof c.nombre === 'string' || (c.nombre?.es && c.nombre?.en))) w(q + 'nombre: texto o {es,en}');
      if (c.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(c.color)) w(q + 'color: #rrggbb');
      const fs = [c.f && ['f', c.f], c.param && ['param.x', c.param.x], c.param && ['param.y', c.param.y], c.polar && ['polar.r', c.polar.r]].filter(Boolean);
      if (!fs.length) return w(q + 'necesita f, param o polar');
      for (const [n, f] of fs) {
        if (typeof f !== 'function') { w(q + `${n} debe ser función`); continue; }
        for (const x of [0, 0.5, 1, 2]) { let y; try { y = f(x); } catch (e) { w(q + `${n}(${x}) lanza: ${e.message}`); break; } if (typeof y !== 'number') { w(q + `${n}(${x}) devuelve ${typeof y}`); break; } }
      }
      const tt = (c.param ?? c.polar)?.t; if ((c.param || c.polar) && !(Array.isArray(tt) && tt.length === 2 && tt.every(num))) w(q + 'param/polar necesita t: [t0, t1]');
    });
    par = { ...(g.par ?? {}) };
    for (const [k, v] of Object.entries(par)) if (!num(v)) w(`par.${k}: número`);
    def = { curvas: g.curvas.filter(c => c && c.id) };
    (g.deslizadores ?? []).forEach((d, i) => {
      const q = `deslizadores[${i}]: `;
      if (!(d.par in par)) w(q + `par «${d.par}» no está en par`);
      if (!num(d.min) || !num(d.max) || d.min >= d.max) w(q + 'min < max');
      else if (num(par[d.par]) && (par[d.par] < d.min || par[d.par] > d.max)) w(q + `valor inicial ${par[d.par]} fuera de [${d.min}, ${d.max}]`);
      if (!(d.es && d.en)) w(q + 'necesita es y en');
    });
    if (g.arrastrar !== undefined && !(g.arrastrar in par)) w(`arrastrar «${g.arrastrar}» no está en par`);
    ventana({ x: g.x, y: g.y }, w, 'funcion.'); if (!g.x || !g.y) w('funcion.x y funcion.y: ventana inicial obligatoria');
    ver = def.curvas.map(c => c.id);
    capas(g.capas ?? [], w);
  };

  const parche = (p, w) => {
    if (!def) return;
    for (const k of SOLO_APERTURA) if (k in p) w(`«${k}» va dentro de funcion: {…} (y solo en el paso que abre la escena)`);
    if (p.par !== undefined) for (const [k, v] of Object.entries(p.par)) { if (!(k in par)) w(`par.${k}: parámetro no declarado al abrir`); else if (!num(v)) w(`par.${k}: número`); else par[k] = v; }
    if (p.capas !== undefined) capas(p.capas, w);
    if (p.ver !== undefined) { if (!Array.isArray(p.ver)) w('ver: array de ids'); else { for (const id of p.ver) if (!ids().has(id)) w(`ver: curva desconocida «${id}»`); ver = p.ver.filter(id => ids().has(id)); } }
    if ('resaltar' in p && p.resaltar !== null && !ids().has(p.resaltar)) w(`resaltar: curva desconocida «${p.resaltar}»`);
    if (p.ventana !== undefined) ventana(p.ventana, w, '');
  };

  const jugar = (J, w) => {
    if (!Array.isArray(J.botones)) return;
    const por = new Map(def.curvas.map(c => [c.id, c]));
    const cx = { par, fmt: String, nombre: id => id, f: (id, x) => (por.get(id)?.f?.(x) ?? NaN), d: () => 0, integral: () => 0, riemann: () => 0 };
    const v = { ...par, ver: [...ver], resaltar: null };
    try {
      for (let r = 0; r < 12; r++) for (const b of J.botones) {
        if (!(b.off && b.off(v, cx))) b.hacer(v, cx);
        for (const k of Object.keys(par)) if (!num(v[k])) throw new Error(`v.${k} = ${v[k]} no es un número`);
        if (!Array.isArray(v.ver) || v.ver.some(id => !por.has(id))) throw new Error(`v.ver = ${JSON.stringify(v.ver)}`);
        const filas = J.lecturas(v, cx);
        if (!Array.isArray(filas)) throw new Error('lecturas debe devolver un array');
        for (const f of filas) if (f.valor === undefined || /NaN|undefined/.test(String(f.valor))) throw new Error(`lectura «${f.expr}» con valor ${f.valor}`);
      }
      if (J.arrastrables && typeof J.soltar !== 'function') throw new Error('arrastrables necesita soltar(v, par, valor, cx)');
      if (J.soltar) { const k = Object.keys(par)[0]; J.soltar(v, k, 0, cx); J.lecturas(v, cx); }
    } catch (e) { w('jugar: ' + e.message); }
  };

  return (p, w, info) => {
    if (p.funcion !== undefined) {
      if (info.frame) return w('«funcion» solo abre la escena en un paso, no en un frame de traza');
      if (typeof p.funcion !== 'object' || !p.funcion) return w('funcion debe ser un objeto {x, y, curvas, …}');
      abrir(p.funcion, w);
    }
    parche(p, w);
    if (!info.frame && p.jugar && def) jugar(p.jugar, w);
  };
};
