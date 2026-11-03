// Panel Solución: tu código frente a la solución de referencia (explicación, complejidad, diff) y la comparación
// de rendimiento (gráfica con las dos series y veredicto). Oculto detrás de un aviso de spoiler.
import { $, el, md, fmtMs, fmtBytes, toast } from '../util.js';
import { state, on, emit, activeTab } from '../state.js';
import { ctx } from '../ctx.js';
import { api } from '../api.js';
import { registerPanel } from '../panels.js';
import { confirmDialog } from '../dialog.js';
import { renderChart } from '../chart.js';

let unlocked = false;
try { unlocked = sessionStorage.getItem('pg:spoiler') === '1'; } catch { /* nada */ }
let disposers = [];
let inflight = null;

function disposeDiffs() { disposers.forEach(d => d()); disposers = []; }

// Una sola petición en vuelo por (pestaña, código): varios render() seguidos (cambio de pestaña, «busy», onShow...)
// comparten la misma carga. Si cada uno lanzara la suya e invalidara a la anterior, nunca terminaría ninguna.
async function load() {
  const tab = activeTab();
  if (!tab?.hasSolution) { state.solution = null; return; }
  const code = ctx.editor.getText(tab.id);
  if (inflight && inflight.id === tab.id && inflight.code === code) return inflight.promise;
  const mine = { id: tab.id, code, promise: null };
  mine.promise = (async () => {
    let result;
    try { result = { id: tab.id, ...(await api('solution', { body: { name: tab.name, code } })) }; }
    catch (e) { result = { id: tab.id, error: e.message }; }
    // Solo vale si nadie la ha reemplazado y el código no ha cambiado mientras tanto
    if (inflight === mine) {
      inflight = null;
      if (activeTab()?.id === tab.id && ctx.editor.getText(tab.id) === code) state.solution = result;
    }
  })();
  inflight = mine;
  return mine.promise;
}

async function render() {
  const host = $('#panel-solucion');
  const tab = activeTab();
  disposeDiffs();
  host.replaceChildren();
  if (!tab?.hasSolution) { host.append(el('div', { class: 'placeholder' }, 'Este archivo no tiene solución de referencia.')); return; }

  if (!unlocked) {
    host.append(el('div', { class: 'sol-gate' },
      el('div', { html: md('**¿Seguro?** Aquí está la solución óptima de cada ejercicio, con su explicación. Si la miras antes de intentarlo, te quitas la mitad del aprendizaje.') }),
      el('button', { class: 'btn', onclick: () => { unlocked = true; try { sessionStorage.setItem('pg:spoiler', '1'); } catch { /* nada */ } render(); } }, 'Mostrar la solución')));
    return;
  }

  host.append(compareSection());
  host.append(el('div', { class: 'group-title' }, 'Ejercicio a ejercicio'));
  if (!state.solution || state.solution.id !== tab.id) {
    host.append(el('div', { class: 'placeholder' }, 'Cargando…'));
    await load();
    if (activeTab()?.id === tab.id) render();
    return;
  }
  if (state.solution.error) { host.append(el('div', { class: 'out-note' }, state.solution.error)); return; }
  for (const item of state.solution.items) host.append(itemCard(item, tab));
}

function compareSection() {
  const wrap = el('div', {});
  const c = state.compare;
  const btn = el('button', { class: 'btn btn-primary', onclick: () => ctx.actions.compare(), disabled: state.busy ? true : null },
    c ? 'Volver a comparar' : 'Comparar rendimiento con la solución');
  wrap.append(el('div', { class: 'tsum' }, btn,
    el('span', { class: 'muted' }, 'Ejecuta tu código y el de referencia con los mismos medir() y los enfrenta (Ctrl+Shift+Enter).')));
  if (state.busy === 'compare') { wrap.append(el('div', { class: 'placeholder' }, 'Comparando… ejecuta dos veces el archivo con tamaños crecientes.')); return wrap; }
  if (!c) return wrap;

  const sol = c.solution?.testSummary;
  if (sol && sol.total) {
    const ok = sol.fail + sol.error === 0;
    wrap.append(el('div', { class: 'note' }, ok ? `La solución de referencia pasa ${sol.pass}/${sol.total} pruebas.` : `⚠ La solución de referencia falla ${sol.fail + sol.error} pruebas: avisa, eso no debería pasar.`,
      c.solution.peak ? ` Memoria pico de la referencia: ${fmtBytes(c.solution.peak)}.` : ''));
  }
  if (!c.series.length) wrap.append(el('div', { class: 'out-note' }, 'Este archivo no tiene llamadas a medir(), así que no hay nada que cronometrar. Las pruebas sí se comparan arriba.'));
  for (const s of c.series) {
    const level = s.level ?? 'info';
    wrap.append(el('div', { class: 'verdict ' + level }, el('b', {}, s.name + '()  '), el('span', { html: md(s.verdict ?? '') })));
    if (s.mine?.status === 'ok' && s.best?.status === 'ok') {
      wrap.append(renderChart({
        series: [
          { name: 'tu código', label: '~' + s.mine.label, cls: 's1', points: s.mine.points },
          { name: 'solución', label: '~' + s.best.label, cls: 's2', points: s.best.points },
        ],
        xLinear: s.mine.scale === 'lineal', title: `Tiempo de ${s.name}: tu código frente a la solución`,
      }));
    }
  }
  return wrap;
}

function itemCard(item, tab) {
  const doc = item.doc ?? {};
  const state_ = !item.implemented && item.mine ? 'todo' : item.mine === null ? 'todo' : item.same ? 'same' : 'diff';
  const label = { todo: 'sin implementar', same: 'igual que la solución', diff: 'distinta a la solución' }[state_];
  const body = el('div', { class: 'sol-body' });
  if (doc.text) body.append(el('p', { html: md(doc.text) }));
  if (doc.complejidad) body.append(el('h4', {}, 'Complejidad'), el('p', { html: md(doc.complejidad) }));
  if (doc.explicacion) body.append(el('h4', {}, 'Por qué es la mejor forma'), el('p', { html: md(doc.explicacion) }));
  if (doc.alternativas) body.append(el('h4', {}, 'Alternativas'), el('p', { html: md(doc.alternativas) }));

  const diffHost = el('div', { class: 'diff-host', hidden: true });
  const actions = el('div', { class: 'sol-actions' });
  if (ctx.editor.diff) {
    let shown = false;
    actions.append(el('button', { class: 'btn', onclick: e => {
      shown = !shown;
      diffHost.hidden = !shown;
      e.currentTarget.textContent = shown ? 'Ocultar diferencias' : item.mine ? 'Ver diferencias con la mía' : 'Ver el código de la solución';
      if (shown && !diffHost.dataset.ready) {
        diffHost.dataset.ready = '1';
        disposers.push(ctx.editor.diff(diffHost, item.mine?.code ?? '// (todavía no has escrito esta función)\n', item.solution.code));
      }
    } }, item.mine ? 'Ver diferencias con la mía' : 'Ver el código de la solución'));
  } else {
    body.append(el('pre', { class: 'diag-code', style: 'padding:8px 10px;overflow:auto' }, item.solution.code));
  }
  if (!tab.readOnly && !item.same) {
    actions.append(el('button', { class: 'btn btn-fix', onclick: () => applyOne(item, tab) }, item.mine ? 'Aplicar la solución a mi código' : 'Añadir la solución a mi código'));
  }
  body.append(actions, diffHost);

  return el('div', { class: 'sol-item' },
    el('div', { class: 'sol-head' }, el('span', { class: 'fn-name' }, item.name), el('span', { class: 'badge ' + state_ }, label),
      item.mine ? el('span', { class: 'muted jump', title: 'Ir a mi versión', style: 'cursor:pointer', onclick: () => ctx.editor.reveal(item.mine.line) }, `mi línea ${item.mine.line}`) : null),
    body);
}

async function applyOne(item, tab) {
  const ok = await confirmDialog('Aplicar solución', `Se sustituirá **${item.name}** en tu código por la solución de referencia (puedes deshacerlo con Ctrl+Z).`, { ok: 'Aplicar' });
  if (!ok) return;
  try {
    const data = await api('solution', { body: { name: tab.name, code: ctx.editor.getText(tab.id), only: item.key } });
    ctx.editor.setText(tab.id, data.spliced);
    toast(`Aplicada la solución de ${item.name}`, 'ok');
    state.solution = null;
    emit('lint-now');
    render();
  } catch (e) {
    toast(e.message, 'error');
  }
}

registerPanel('solucion', { onShow: () => { state.solution = null; render(); } });
on('compare', render);
on('busy', () => { if (!$('#panel-solucion').hidden) render(); });
on('active', () => { state.solution = null; state.compare = state.compare?.id === activeTab()?.id ? state.compare : null; if (!$('#panel-solucion').hidden) render(); });
