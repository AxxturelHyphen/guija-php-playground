// Gráfica SVG de tiempo frente a tamaño de entrada (ejes logarítmicos), sin librerías.
// Diseño según la skill dataviz: líneas de 2 px, marcadores con anillo del color de la superficie, rejilla
// recesiva, leyenda siempre que hay 2+ series, etiquetas directas al final de cada línea, tooltip con cruz
// y vista en tabla para quien no distingue colores.
import { el, fmtMs, num } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids.filter(k => k != null));
  return n;
};

// Un único tooltip para todas las gráficas
let tipNode = null;
const sharedTip = () => (tipNode ??= document.body.appendChild(el('div', { class: 'chart-tip', hidden: true })));

const W = 640, H = 300, M = { l: 80, r: 112, t: 14, b: 40 };
const MIN_MS = 1e-4;

/**
 * @param {{series: {name:string, label?:string, cls:'s1'|'s2', points:[number,number][]}[], xLinear?:boolean, title?:string}} cfg
 * @returns {HTMLElement}
 */
export function renderChart({ series, xLinear = false, title = '' }) {
  const all = series.filter(s => s.points?.length);
  const root = el('div', { class: 'chart' });
  if (!all.length) return root;

  const xs = all.flatMap(s => s.points.map(p => p[0]));
  const ys = all.flatMap(s => s.points.map(p => Math.max(p[1], MIN_MS)));
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yLo = Math.floor(Math.log10(Math.min(...ys))), yHi = Math.max(yLo + 1, Math.ceil(Math.log10(Math.max(...ys))));
  const px = x => M.l + ((xLinear ? x - xMin : Math.log(x) - Math.log(xMin)) / Math.max(1e-9, xLinear ? xMax - xMin : Math.log(xMax) - Math.log(xMin))) * (W - M.l - M.r);
  const py = y => M.t + (1 - (Math.log10(Math.max(y, MIN_MS)) - yLo) / (yHi - yLo)) * (H - M.t - M.b);

  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title || 'Tiempo frente al tamaño de la entrada' });
  g.append(svg('title', {}, title || 'Tiempo frente al tamaño de la entrada'));

  // Rejilla y ejes
  const grid = svg('g', { class: 'grid' });
  const axis = svg('g', { class: 'axis' });
  for (let e = yLo; e <= yHi; e++) {
    const y = py(10 ** e);
    grid.append(svg('line', { x1: M.l, x2: W - M.r, y1: y, y2: y }));
    axis.append(svg('text', { x: M.l - 8, y: y + 4, 'text-anchor': 'end' }, fmtMs(10 ** e)));
  }
  const xticks = [];
  if (xLinear) {
    const step = Math.max(1, Math.round((xMax - xMin) / 6));
    for (let x = xMin; x <= xMax; x += step) xticks.push(x);
  } else {
    for (let e = Math.ceil(Math.log10(xMin)); e <= Math.floor(Math.log10(xMax)); e++) xticks.push(10 ** e);
    if (xticks.length < 2) xticks.splice(0, xticks.length, xMin, xMax);
  }
  for (const x of xticks) {
    grid.append(svg('line', { x1: px(x), x2: px(x), y1: M.t, y2: H - M.b }));
    axis.append(svg('text', { x: px(x), y: H - M.b + 16, 'text-anchor': 'middle' }, num(x)));
  }
  axis.append(svg('text', { class: 'axis-title', x: (M.l + W - M.r) / 2, y: H - 6, 'text-anchor': 'middle' }, 'tamaño de la entrada (n)' + (xLinear ? '' : ' · escala logarítmica')));
  axis.append(svg('text', { class: 'axis-title', transform: `translate(11 ${(M.t + H - M.b) / 2}) rotate(-90)`, 'text-anchor': 'middle' }, 'tiempo por llamada (log)'));
  g.append(grid, axis);

  // Series
  const labelYs = [];
  for (const s of all) {
    const pts = s.points.map(([x, y]) => [px(x), py(y)]);
    const gs = svg('g', { class: s.cls });
    gs.append(svg('polyline', { class: 'line', points: pts.map(p => p.join(',')).join(' ') }));
    for (const [x, y] of pts) gs.append(svg('circle', { class: 'dot', cx: x, cy: y, r: 3.5 }));
    g.append(gs);
    // Etiqueta directa al final de la línea (texto en tinta normal; el color lo da el marcador)
    const [lx, ly0] = pts[pts.length - 1];
    let ly = ly0;
    for (const prev of labelYs) if (Math.abs(prev - ly) < 14) ly = prev + (ly >= prev ? 14 : -14);
    labelYs.push(ly);
    const lab = svg('g', { class: s.cls });
    lab.append(svg('circle', { cx: lx + 11, cy: ly - 4, r: 3.5 }), svg('text', { class: 'lab', x: lx + 19, y: ly, fill: 'var(--code)' }, s.label ?? s.name));
    lab.querySelector('text').style.fill = 'var(--code)';
    g.append(lab);
  }

  // Cruz + tooltip
  const cross = svg('line', { class: 'cross', y1: M.t, y2: H - M.b, visibility: 'hidden' });
  const hit = svg('rect', { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: 'transparent' });
  g.append(cross, hit);
  const tip = sharedTip();
  const sizes = [...new Set(xs)].sort((a, b) => a - b);
  hit.addEventListener('mousemove', ev => {
    const r = g.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * W;
    let best = sizes[0];
    for (const n of sizes) if (Math.abs(px(n) - sx) < Math.abs(px(best) - sx)) best = n;
    cross.setAttribute('x1', px(best)); cross.setAttribute('x2', px(best)); cross.setAttribute('visibility', 'visible');
    tip.replaceChildren(el('div', {}, el('b', {}, 'n = ' + num(best))),
      ...all.map(s => {
        const p = s.points.find(q => q[0] === best);
        return el('div', {}, el('span', { style: `color:var(--ser-${s.cls === 's1' ? 1 : 2})` }, '● '), `${s.name}: `, el('span', { class: 'mono' }, p ? fmtMs(p[1]) : '—'));
      }));
    tip.hidden = false;
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, ev.clientX + 14) + 'px';
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, ev.clientY + 14) + 'px';
  });
  hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; });

  // Leyenda (siempre con 2+ series) y tabla alternativa
  if (all.length > 1) {
    root.append(el('div', { class: 'chart-legend' }, all.map(s =>
      el('span', {}, el('i', { style: `background:var(--ser-${s.cls === 's1' ? 1 : 2})` }), s.label ? `${s.name} · ${s.label}` : s.name))));
  }
  root.append(g);
  const rows = sizes.map(n => el('tr', {}, el('td', { class: 'num' }, num(n)),
    all.map(s => { const p = s.points.find(q => q[0] === n); return el('td', { class: 'num' }, p ? fmtMs(p[1]) : '—'); })));
  root.append(el('details', { class: 'chart-table' }, el('summary', {}, 'Ver como tabla'),
    el('table', { class: 'grid' }, el('thead', {}, el('tr', {}, el('th', { class: 'num' }, 'n'), all.map(s => el('th', { class: 'num' }, s.name)))), el('tbody', {}, rows))));
  return root;
}
