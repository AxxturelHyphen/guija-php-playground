// Panel Pruebas: resultado de prueba() / comprueba() / lanza() del archivo, con entrada, esperado y obtenido.
import { $, el, fmtMs } from '../util.js';
import { state, on } from '../state.js';
import { registerPanel, setCount } from '../panels.js';
import { LANG } from '../lang.js';

const ICON = { pass: '✓', fail: '✗', error: '!', todo: '⏳' };
const LABEL = { pass: 'correcta', fail: 'falla', error: 'error', todo: 'pendiente' };

function render() {
  const host = $('#panel-pruebas');
  const r = state.run;
  host.replaceChildren();
  const tests = r?.tests ?? [];
  const s = r?.testSummary ?? { pass: 0, fail: 0, error: 0, todo: 0, total: 0 };
  const bad = s.fail + s.error;
  setCount('pruebas', s.total ? (bad ? `${s.pass}/${s.total}` : s.todo && !s.pass ? `⏳ ${s.todo}` : `${s.pass}/${s.total}`) : '', bad ? 'err' : s.pass === s.total && s.total ? 'ok' : 'warn');

  if (!tests.length) {
    host.append(el('div', { class: 'placeholder' }, r
      ? LANG.testsHint
      : 'Ejecuta el archivo para ver las pruebas.'));
    return;
  }

  const pct = n => (s.total ? (n / s.total) * 100 : 0) + '%';
  host.append(el('div', { class: 'tsum' },
    el('b', {}, bad ? `${bad} sin pasar` : s.todo ? 'Todo lo implementado pasa' : '¡Todas las pruebas pasan!'),
    el('span', { class: 'muted' }, `${s.pass} correctas · ${s.fail + s.error} fallan · ${s.todo} pendientes · ${s.total} en total`),
    el('div', { class: 'progress', role: 'img', 'aria-label': `${s.pass} de ${s.total} correctas` },
      el('i', { class: 'p', style: `width:${pct(s.pass)}` }), el('i', { class: 'f', style: `width:${pct(s.fail + s.error)}` }), el('i', { class: 't', style: `width:${pct(s.todo)}` }))));

  const groups = new Map();
  for (const t of tests) {
    const g = t.group || '(sin grupo)';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  for (const [name, list] of groups) {
    host.append(el('div', { class: 'tgroup' }, name));
    for (const t of list) host.append(row(t));
  }
}

function row(t) {
  const expandable = t.status === 'fail' || t.status === 'error';
  const detail = el('div', { class: 'tdetail', hidden: !expandable ? true : null });
  if (expandable) {
    const dl = el('dl', {});
    if (t.input !== undefined) dl.append(el('dt', {}, 'Entrada'), el('dd', {}, t.input));
    if (t.expected !== undefined) dl.append(el('dt', {}, 'Esperado'), el('dd', { class: 'exp' }, t.expected));
    if (t.actual !== undefined) dl.append(el('dt', {}, 'Obtenido'), el('dd', { class: 'act' }, t.actual));
    if (t.msg) dl.append(el('dt', {}, 'Error' + (t.line ? ` (línea ${t.line})` : '')), el('dd', { class: 'act' }, t.msg));
    detail.append(dl);
  }
  const head = el('div', { class: 'trow-head', onclick: () => { if (expandable) detail.hidden = !detail.hidden; } },
    el('span', { class: 'ticon ' + t.status, title: LABEL[t.status] }, ICON[t.status] ?? '?'),
    el('span', { class: 'tname' }, t.name),
    t.status === 'todo' && t.total ? el('span', { class: 'tms' }, `${t.total} casos`) : null,
    t.ms != null ? el('span', { class: 'tms' }, fmtMs(t.ms)) : null);
  const node = el('div', { class: 'trow' + (expandable ? ' expandable' : '') }, head, expandable ? detail : null);
  if (expandable) detail.hidden = false;
  return node;
}

registerPanel('pruebas', { onShow: render });
on('run', render);
on('active', () => { if (!state.run) render(); });
render();
