'use strict';
/**
 * Validador de la escena «grafica» para tests/guias-datos.js (ver su cabecera):
 *   module.exports = () => (p, w, info) => { … }     (la fábrica se llama una vez por guía)
 * Se invoca con cada paso y cada frame de traza cuya escena activa sea «grafica». w(msg) registra un error.
 * Comprueba: curvas con id único y f función (y que devuelve números), nombre, color; ver con ids existentes; escala
 * válida; `grafica` solo en el paso que abre (no en frames); n en [0,nmax]; ymax/zoom/resaltar bien formados;
 * y, en los `jugar`, ejecuta los botones sobre una copia para detectar excepciones y estados inválidos.
 */
const ESCALAS = ['lin', 'log'];
// Claves que solo valen dentro de `grafica: {…}` (si aparecen sueltas en un paso, es un error de formato)
const SOLO_APERTURA = ['curvas', 'nmax', 'deslizador', 'tabla'];

module.exports = () => {
  let def = null, nmax = 0, n = 0, ver = [], escala = 'lin';
  const num = x => typeof x === 'number' && Number.isFinite(x);
  const ids = () => new Set(def.curvas.map(c => c.id));

  const comprobarYmax = (y, w, donde) => {
    if (y === null || y === undefined) return;
    const bien = v => v === undefined || (num(v) && v > 0);
    if (typeof y === 'object' ? !(bien(y.lin) && bien(y.log)) : !bien(y)) w(`${donde}ymax: número > 0, {lin,log} o null`);
  };

  const abrir = (g, w) => {
    def = null;
    if (!Array.isArray(g.curvas) || !g.curvas.length) return w('grafica.curvas: array no vacío de {id, nombre, f}');
    const vistos = new Set();
    g.curvas.forEach((c, i) => {
      const q = `curvas[${i}]${c.id ? ` «${c.id}»` : ''}: `;
      if (!c.id || typeof c.id !== 'string') w(q + 'falta id (texto)');
      else if (vistos.has(c.id)) w(q + 'id repetido');
      vistos.add(c.id);
      if (typeof c.f !== 'function') return w(q + 'f debe ser una función (n) => número');
      if (!(typeof c.nombre === 'string' ? c.nombre : c.nombre?.es && c.nombre?.en)) w(q + 'nombre: texto (con $…$ opcional) o {es,en}');
      if (c.color !== undefined && !/^#[0-9a-fA-F]{6}$/.test(c.color)) w(q + 'color: #rrggbb');
      for (const x of [0, 1, 7, g.nmax || 10]) {
        let y; try { y = c.f(x); } catch (e) { w(q + `f(${x}) lanza: ${e.message}`); break; }
        if (typeof y !== 'number') { w(q + `f(${x}) devuelve ${typeof y}, no número`); break; }
      }
    });
    if (!num(g.nmax) || g.nmax <= 0) return w('grafica.nmax: número > 0');
    if (g.escala !== undefined && !ESCALAS.includes(g.escala)) w(`grafica.escala «${g.escala}» (lin|log)`);
    for (const k of ['deslizador', 'tabla']) if (g[k] !== undefined && typeof g[k] !== 'boolean') w(`grafica.${k}: booleano`);
    comprobarYmax(g.ymax, w, 'grafica.');
    if (g.n !== undefined && !(num(g.n) && g.n >= 0 && g.n <= g.nmax)) w(`grafica.n ${g.n} fuera de [0, ${g.nmax}]`);
    def = { curvas: g.curvas.filter(c => c && c.id) };
    nmax = g.nmax; n = Math.round(g.nmax / 3); ver = def.curvas.map(c => c.id); escala = 'lin';
  };

  // Parche (paso o frame): vale igual para el paso de apertura (con sus claves sueltas) y para los demás
  const parche = (p, w, enFrame) => {
    if (!def) return;
    for (const k of SOLO_APERTURA) if (k in p) w(`«${k}» va dentro de grafica: {…} (y solo en el paso que abre la escena)`);
    if (p.zoom !== undefined) {
      if (!(p.zoom && num(p.zoom.nmax) && p.zoom.nmax > 0)) w('zoom: {nmax: número > 0}');
      else nmax = p.zoom.nmax;
    }
    if (p.ver !== undefined) {
      if (!Array.isArray(p.ver)) w('ver: array de ids');
      else { for (const id of p.ver) if (!ids().has(id)) w(`ver: curva desconocida «${id}»`); ver = p.ver.filter(id => ids().has(id)); }
    }
    if (p.escala !== undefined) { if (!ESCALAS.includes(p.escala)) w(`escala «${p.escala}» (lin|log)`); else escala = p.escala; }
    if ('resaltar' in p && p.resaltar !== null && !ids().has(p.resaltar)) w(`resaltar: curva desconocida «${p.resaltar}»`);
    if ('ymax' in p) comprobarYmax(p.ymax, w, '');
    if (p.n !== undefined) {
      if (!num(p.n) || p.n < 0 || p.n > nmax) w(`n ${p.n} fuera de [0, ${nmax}]`);
      else n = p.n;
    }
    n = Math.min(n, nmax);
  };

  const jugar = (J, w) => {
    if (!Array.isArray(J.botones)) return;
    const por = new Map(def.curvas.map(c => [c.id, c]));
    const cx = {
      curvas: def.curvas, fmt: String, nombre: id => id,
      f: (id, x) => (por.has(id) ? por.get(id).f(x) : NaN),
      valores: x => Object.fromEntries(def.curvas.map(c => [c.id, c.f(x)])),
    };
    const v = { n, nmax, escala, ver: [...ver], resaltar: null, ymax: null };
    try {
      for (let r = 0; r < 12; r++) for (const b of J.botones) {
        if (!(b.off && b.off(v, cx))) b.hacer(v, cx);
        if (!num(v.n)) throw new Error(`v.n = ${v.n} no es un número`);
        if (!ESCALAS.includes(v.escala)) throw new Error(`v.escala = ${v.escala}`);
        if (!Array.isArray(v.ver) || v.ver.some(id => !por.has(id))) throw new Error(`v.ver = ${JSON.stringify(v.ver)} con ids que no existen`);
        const filas = J.lecturas(v, cx);
        if (!Array.isArray(filas)) throw new Error('lecturas debe devolver un array');
        for (const f of filas) if (f.valor === undefined || /NaN|undefined/.test(String(f.valor))) throw new Error(`lectura «${f.expr}» con valor ${f.valor}`);
        J.hl && J.hl(v, cx);
      }
      if (J.arrastrables && typeof J.soltar !== 'function') throw new Error('arrastrables necesita soltar(v, n, _, cx)');
      if (J.soltar) { J.soltar(v, nmax, undefined, cx); J.soltar(v, 0, undefined, cx); J.lecturas(v, cx); }
    } catch (e) { w('jugar: ' + e.message); }
  };

  return (p, w, info) => {
    if (p.grafica !== undefined) {
      if (info.frame) return w('«grafica» solo abre la escena en un paso, no en un frame de traza');
      if (typeof p.grafica !== 'object' || !p.grafica) return w('grafica debe ser un objeto {curvas, nmax, …}');
      abrir(p.grafica, w);
      // El paso que abre puede llevar además parches sueltos (n, ver…); no cuentan claves de apertura repetidas
    }
    parche(p, w, info.frame);
    if (!info.frame && p.jugar && def) jugar(p.jugar, w);
  };
};
