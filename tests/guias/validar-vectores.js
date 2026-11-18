'use strict';
/**
 * Validador de la escena «vectores» para tests/guias-datos.js (ver su cabecera):
 *   module.exports = () => (p, w, info) => { … }     (la fábrica se llama una vez por guía)
 * Comprueba: vec con componentes numéricas, par numérico, `arrastrar` y deslizadores coherentes, capas con su tipo y claves
 * obligatorias, números (valor o parámetro existente) y vectores (nombre existente o [x, y]) bien referidos, parches que solo
 * tocan lo declarado al abrir, ventana bien formada, `vectores` solo al abrir y los botones de `jugar` ejecutados sobre una copia.
 */
const REQ = {
  flecha: ['a'], comb: ['coef', 'vecs'], span: ['vecs'], paralelogramo: ['u', 'v'], rejilla: ['m'], elipse: ['m'], propios: ['m'], imagen: ['m', 'a'],
  proyeccion: ['x', 'sobre'], bola: ['p'],
  recta: ['a', 'b', 'c'], punto: ['x', 'y'], texto: ['x', 'y', 's'],
};
const NUMS = { recta: ['a', 'b', 'c'], punto: ['x', 'y'], texto: ['x', 'y'] };
const VECS = { flecha: ['a', 'de'], paralelogramo: ['u', 'v'], proyeccion: ['x', 'de'], imagen: ['a'] };
const SOLO_APERTURA = ['arrastrar', 'deslizadores', 'etiqueta', 'paso'];
// Helpers de matriz reales (lógica pura de la escena; require de ESM síncrono, Node ≥ 22.12) para ejecutar `jugar` de verdad
const { mul, traza, detM, eig2, svd2 } = require('../../assets/guias/vectores.js');
const { dot, norma, angulo, proyectar } = require('../../assets/guias/vectores.js');
const MATRIZ = { mul, traza, detM, eig2, svd2, dot, norma, angulo, proy: (x, bs, A) => proyectar(x, bs, A).p };

module.exports = () => {
  let abierta = false, vec = {}, par = {};
  const num = x => typeof x === 'number' && Number.isFinite(x);
  const n2 = x => num(x) || (typeof x === 'string' && x in par);
  const v2 = x => (typeof x === 'string' ? x in vec : Array.isArray(x) && x.length === 2 && x.every(n2));
  const xy = x => Array.isArray(x) && x.length === 2 && x.every(num);
  const txt = x => typeof x === 'string' || (x?.es !== undefined && x?.en !== undefined);

  const capas = (lista, w) => {
    if (!Array.isArray(lista)) return w('capas: array de capas');
    lista.forEach((c, i) => {
      const q = `capas[${i}] «${c?.tipo}»: `;
      if (!c || !(c.tipo in REQ)) return w(q + 'tipo desconocido (' + Object.keys(REQ).join('|') + ')');
      for (const k of REQ[c.tipo]) if (c[k] === undefined) w(q + `falta «${k}»`);
      for (const k of NUMS[c.tipo] ?? []) if (c[k] !== undefined && !n2(c[k])) w(q + `${k}: número o parámetro existente (recibido ${JSON.stringify(c[k])})`);
      for (const k of VECS[c.tipo] ?? []) if (c[k] !== undefined && !v2(c[k])) w(q + `${k}: vector existente o [x, y] (recibido ${JSON.stringify(c[k])})`);
      if (c.tipo === 'comb' || c.tipo === 'span') {
        if (!Array.isArray(c.vecs) || !c.vecs.length) w(q + 'vecs: lista no vacía');
        else c.vecs.forEach((v, j) => { if (!v2(v)) w(q + `vecs[${j}]: vector existente o [x, y]`); });
      }
      if (c.tipo === 'comb' && !(Array.isArray(c.coef) && Array.isArray(c.vecs) && c.coef.length === c.vecs.length && c.coef.every(n2))) w(q + 'coef: tantos números/parámetros como vecs');
      const m22 = m => Array.isArray(m) && m.length === 2 && m.every(f => Array.isArray(f) && f.length === 2 && f.every(n2));
      if (c.tipo === 'proyeccion') {
        const bs = typeof c.sobre === 'string' || (Array.isArray(c.sobre) && c.sobre.length === 2 && c.sobre.every(num)) ? [c.sobre] : c.sobre;
        if (!Array.isArray(bs) || !bs.length || !bs.every(v => typeof v === 'string' ? v in vec : xy(v))) w(q + 'sobre: nombre de vector, [x,y] numérico o lista de ellos');
      }
      if ((c.tipo === 'proyeccion' || c.tipo === 'bola') && c.A !== undefined && !m22(c.A)) w(q + 'A: [[a,b],[b,d]] con números o parámetros');
      if (c.tipo === 'bola' && !(c.p === 'inf' || n2(c.p))) w(q + "p: número, parámetro o 'inf'");
      if (c.tipo === 'bola' && c.r !== undefined && !n2(c.r)) w(q + 'r: número o parámetro');
      if ((c.tipo === 'rejilla' || c.tipo === 'elipse' || c.tipo === 'propios' || c.tipo === 'imagen') && !(Array.isArray(c.m) && c.m.length === 2 && c.m.every(f => Array.isArray(f) && f.length === 2 && f.every(n2)))) w(q + 'm: [[a,b],[c,d]] con números o parámetros');
      if (c.nombre !== undefined && !txt(c.nombre)) w(q + 'nombre: texto o {es,en}');
      if (c.tipo === 'texto' && !txt(c.s)) w(q + 's: texto o {es,en}');
      if (c.color !== undefined && typeof c.color !== 'string') w(q + 'color: cadena CSS');
    });
  };
  const ventana = (v, w, d) => {
    for (const k of ['x', 'y']) if (v[k] !== undefined && !(xy(v[k]) && v[k][0] < v[k][1])) w(`${d}ventana.${k}: [min, max] con min < max`);
  };

  const abrir = (g, w) => {
    abierta = true; vec = {}; par = {};
    if (!g.vec || typeof g.vec !== 'object') w('vectores.vec: objeto {nombre: [x, y]}');
    for (const [k, v] of Object.entries(g.vec ?? {})) { if (!/^[A-Za-z]+\d*$/.test(k)) w(`vec.${k}: nombre = letras + dígitos opcionales`); if (!xy(v)) w(`vec.${k}: [x, y] numéricos`); vec[k] = v; }
    for (const [k, v] of Object.entries(g.par ?? {})) { if (!num(v)) w(`par.${k}: número`); if (k in vec) w(`par.${k}: choca con un vector del mismo nombre`); par[k] = v; }
    if (g.arrastrar !== undefined) { if (!Array.isArray(g.arrastrar)) w('arrastrar: lista de nombres de vector'); else for (const n of g.arrastrar) if (!(n in vec)) w(`arrastrar: vector desconocido «${n}»`); }
    if (g.paso !== undefined && !(num(g.paso) && g.paso > 0)) w('paso: número > 0');
    (g.deslizadores ?? []).forEach((d, i) => {
      const q = `deslizadores[${i}]: `;
      if (!(d.par in par)) w(q + `par «${d.par}» no está en par`);
      if (!num(d.min) || !num(d.max) || d.min >= d.max) w(q + 'min < max');
      else if (num(par[d.par]) && (par[d.par] < d.min || par[d.par] > d.max)) w(q + `valor inicial ${par[d.par]} fuera de [${d.min}, ${d.max}]`);
      if (!(d.es && d.en)) w(q + 'necesita es y en');
    });
    if (!g.x || !g.y) w('vectores.x y vectores.y: región inicial obligatoria');
    ventana({ x: g.x, y: g.y }, w, 'vectores.');
    capas(g.capas ?? [], w);
  };

  const parche = (p, w) => {
    if (!abierta) return;
    for (const k of SOLO_APERTURA) if (k in p) w(`«${k}» va dentro de vectores: {…} (y solo en el paso que abre la escena)`);
    if (p.par !== undefined) for (const [k, v] of Object.entries(p.par)) { if (!(k in par)) w(`par.${k}: parámetro no declarado al abrir`); else if (!num(v)) w(`par.${k}: número`); else par[k] = v; }
    if (p.vec !== undefined) for (const [k, v] of Object.entries(p.vec)) { if (!(k in vec)) w(`vec.${k}: vector no declarado al abrir`); else if (!xy(v)) w(`vec.${k}: [x, y] numéricos`); else vec[k] = v; }
    if (p.capas !== undefined) capas(p.capas, w);
    if (p.ventana !== undefined) ventana(p.ventana, w, '');
  };

  const jugar = (J, w) => {
    if (!Array.isArray(J.botones)) return;
    const det = (a, b) => a[0] * b[1] - a[1] * b[0];
    const cx = { par, fmt: String, det, comb: (cs, vs) => vs.reduce((s, v, i) => [s[0] + cs[i] * v[0], s[1] + cs[i] * v[1]], [0, 0]), resolver: () => ({ tipo: 'unica', x: 0, y: 0 }), dim: () => 2, ...MATRIZ };
    const v = { ...par, vec: Object.fromEntries(Object.entries(vec).map(([k, a]) => [k, [...a]])) };
    try {
      for (let r = 0; r < 12; r++) for (const b of J.botones) {
        if (!(b.off && b.off(v, cx))) b.hacer(v, cx);
        for (const k of Object.keys(par)) if (!num(v[k])) throw new Error(`v.${k} = ${v[k]} no es un número`);
        for (const k of Object.keys(vec)) if (!xy(v.vec[k])) throw new Error(`v.vec.${k} = ${JSON.stringify(v.vec[k])} no es [x, y]`);
        const filas = J.lecturas(v, cx);
        if (!Array.isArray(filas)) throw new Error('lecturas debe devolver un array');
        for (const f of filas) if (f.valor === undefined || /NaN|undefined/.test(String(f.valor))) throw new Error(`lectura «${typeof f.expr === 'object' ? f.expr.es : f.expr}» con valor ${f.valor}`);
      }
      if (J.arrastrables && typeof J.soltar !== 'function') throw new Error('arrastrables necesita soltar(v, clave, valor, cx)');
      if (J.soltar) { const k = Object.keys(vec)[0]; if (k) J.soltar(v, k, [1, 1], cx); J.lecturas(v, cx); }
    } catch (e) { w('jugar: ' + e.message); }
  };

  return (p, w, info) => {
    if (p.vectores !== undefined) {
      if (info.frame) return w('«vectores» solo abre la escena en un paso, no en un frame de traza');
      if (typeof p.vectores !== 'object' || !p.vectores) return w('vectores debe ser un objeto {x, y, vec, …}');
      abrir(p.vectores, w);
    }
    parche(p, w);
    if (!info.frame && p.jugar && abierta) jugar(p.jugar, w);
  };
};
