'use strict';
/**
 * Validador de la escena «campo» para tests/guias-datos.js (ver su cabecera):
 *   module.exports = () => (p, w, info) => { … }     (la fábrica se llama una vez por guía)
 * Comprueba: f(x,y) devuelve números, ventana, par numérico, deslizadores y `arrastrar` coherentes, capas con su
 * tipo y claves, referencias a parámetros, modo válido, `campo` solo al abrir y los botones de `jugar` sobre una copia.
 */
const REQ = { punto: ['x', 'y'], gradiente: ['x', 'y'], corte: ['eje', 'v'], campo: [], restriccion: ['g', 'c'], region: ['x', 'y'], camino: ['x', 'y', 't'], texto: ['x', 'y', 's'] };
const NUM_CAPA = ['x', 'y', 'v', 'c', 'n', 'hasta', 'k'];
const SOLO_APERTURA = ['f', 'z', 'niveles', 'arrastrar', 'deslizadores', 'etiqueta'];

module.exports = () => {
  let par = {}, def = null;
  const num = x => typeof x === 'number' && Number.isFinite(x);
  const par2 = x => num(x) || (typeof x === 'string' && x in par);
  const rango = r => Array.isArray(r) && r.length === 2 && r.every(num) && r[0] < r[1];

  const capas = (lista, w) => {
    if (!Array.isArray(lista)) return w('capas: array de capas');
    lista.forEach((c, i) => {
      const q = `capas[${i}] «${c?.tipo}»: `;
      if (!c || !(c.tipo in REQ)) return w(q + 'tipo desconocido (' + Object.keys(REQ).join('|') + ')');
      for (const k of REQ[c.tipo]) if (c[k] === undefined) w(q + `falta «${k}»`);
      for (const k of NUM_CAPA) if (c[k] !== undefined && typeof c[k] !== 'object' && typeof c[k] !== 'function' && !par2(c[k])) w(q + `${k}: número o parámetro existente (recibido ${JSON.stringify(c[k])})`);
      if (c.tipo === 'corte' && !['x', 'y'].includes(c.eje)) w(q + "eje: 'x' | 'y'");
      if (c.tipo === 'campo' && typeof c.F !== 'function' && !c.grad) w(q + 'necesita F: (x,y)=>[u,v] o grad: true');
      if (c.tipo === 'restriccion' && typeof c.g !== 'function') w(q + 'g: función (x,y)=>número');
      if (c.tipo === 'region' && !(rango(c.x) && rango(c.y))) w(q + 'x e y: [min, max]');
      if (c.tipo === 'camino' && !(typeof c.x === 'function' && typeof c.y === 'function' && rango(c.t))) w(q + 'x, y: funciones de t; t: [t0, t1]');
      if (c.tipo === 'texto' && !(typeof c.s === 'string' || (c.s?.es && c.s?.en))) w(q + 's: texto o {es,en}');
    });
  };

  const abrir = (g, w) => {
    def = null;
    if (typeof g.f !== 'function') return w('campo.f debe ser una función (x, y) => número');
    if (!rango(g.x) || !rango(g.y)) return w('campo.x y campo.y: [min, max]');
    if (g.z !== undefined && !rango(g.z)) w('campo.z: [min, max]');
    if (g.modo !== undefined && !['nivel', 'superficie'].includes(g.modo)) w(`campo.modo «${g.modo}» (nivel|superficie)`);
    let finitos = 0;
    for (const fx of [.1, .3, .5, .7, .9]) for (const fy of [.1, .5, .9]) {
      const x = g.x[0] + (g.x[1] - g.x[0]) * fx, y = g.y[0] + (g.y[1] - g.y[0]) * fy; let z;
      try { z = g.f(x, y); } catch (e) { return w(`f(${x}, ${y}) lanza: ${e.message}`); }
      if (typeof z !== 'number') return w(`f(${x}, ${y}) devuelve ${typeof z}, no número`);
      if (Number.isFinite(z)) finitos++;
    }
    if (!finitos) w('f no da ningún valor finito en la ventana');
    par = { rot: 0, elev: 0, ...(g.par ?? {}) };
    for (const [k, v] of Object.entries(par)) if (!num(v)) w(`par.${k}: número`);
    (g.deslizadores ?? []).forEach((d, i) => {
      const q = `deslizadores[${i}]: `;
      if (!(d.par in par)) w(q + `par «${d.par}» no está en par`);
      if (!num(d.min) || !num(d.max) || d.min >= d.max) w(q + 'min < max');
      else if (num(par[d.par]) && (par[d.par] < d.min || par[d.par] > d.max)) w(q + `valor inicial ${par[d.par]} fuera de [${d.min}, ${d.max}]`);
      if (!(d.es && d.en)) w(q + 'necesita es y en');
    });
    if (g.arrastrar !== undefined && !(Array.isArray(g.arrastrar) && g.arrastrar.length === 2 && g.arrastrar.every(k => k in par))) w('arrastrar: [parX, parY] con parámetros existentes');
    def = g; capas(g.capas ?? [], w);
  };

  const jugar = (J, w) => {
    if (!Array.isArray(J.botones)) return;
    const cx = { par, fmt: String, f: (x, y) => def.f(x, y), grad: () => [0, 0], integral: () => 0 };
    const v = { ...par };
    try {
      for (let r = 0; r < 12; r++) for (const b of J.botones) {
        if (!(b.off && b.off(v, cx))) b.hacer(v, cx);
        for (const k of Object.keys(par)) if (!num(v[k])) throw new Error(`v.${k} = ${v[k]} no es un número`);
        const filas = J.lecturas(v, cx);
        if (!Array.isArray(filas)) throw new Error('lecturas debe devolver un array');
        for (const f of filas) if (f.valor === undefined || /NaN|undefined/.test(String(f.valor))) throw new Error(`lectura «${f.expr}» con valor ${f.valor}`);
      }
      if (J.arrastrables && typeof J.soltar !== 'function') throw new Error('arrastrables necesita soltar(v, par, valor, cx)');
      if (J.soltar) { J.soltar(v, Object.keys(par)[0], 0, cx); J.lecturas(v, cx); }
    } catch (e) { w('jugar: ' + e.message); }
  };

  return (p, w, info) => {
    if (p.campo !== undefined) {
      if (info.frame) return w('«campo» solo abre la escena en un paso, no en un frame de traza');
      if (typeof p.campo !== 'object' || !p.campo) return w('campo debe ser un objeto {f, x, y, …}');
      abrir(p.campo, w);
    }
    if (!def) return;
    for (const k of SOLO_APERTURA) if (k in p) w(`«${k}» va dentro de campo: {…} (y solo en el paso que abre la escena)`);
    if (p.par !== undefined) for (const [k, v] of Object.entries(p.par)) { if (!(k in par)) w(`par.${k}: parámetro no declarado al abrir`); else if (!num(v)) w(`par.${k}: número`); else par[k] = v; }
    if (p.capas !== undefined) capas(p.capas, w);
    if (p.modo !== undefined && !['nivel', 'superficie'].includes(p.modo)) w(`modo «${p.modo}» (nivel|superficie)`);
    if (!info.frame && p.jugar) jugar(p.jugar, w);
  };
};
