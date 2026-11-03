// Orquesta el análisis en vivo (lint), la ejecución, la medición y la comparación con la solución.
// El servidor integrado de PHP atiende de uno en uno en Windows, así que aquí se evita encolar peticiones:
// el lint se cancela/ignora si ya es viejo y no se lanza mientras hay una ejecución en curso.
import { $, debounce, toast } from './util.js';
import { state, emit, on, activeTab } from './state.js';
import { api } from './api.js';
import { ctx } from './ctx.js';
import { showPanel } from './panels.js';

export function createRunner(editor) {
  const runs = new Map();      // id de pestaña -> último informe de ejecución
  const compares = new Map();  // id de pestaña -> última comparación
  let lintCtl = null;
  let lintSeq = 0;
  let pendingLint = false;

  const busyLabel = { run: 'Ejecutando…', measure: 'Midiendo…', compare: 'Comparando…' };
  function setBusy(kind) {
    state.busy = kind;
    $('#btn-run').classList.toggle('running', !!kind);
    $('#run-label').textContent = kind ? busyLabel[kind] : 'Ejecutar';
    for (const id of ['btn-run', 'btn-measure', 'btn-compare']) $('#' + id).disabled = !!kind || (id === 'btn-compare' && !activeTab()?.hasSolution);
    emit('busy', kind);
    if (!kind && pendingLint) { pendingLint = false; lintNow(); }
  }

  // ── Análisis en vivo ─────────────────────────────────────────
  async function lintNow() {
    const tab = activeTab();
    if (!tab) { state.analysis = null; emit('analysis', null); return; }
    if (state.busy) { pendingLint = true; return; }
    lintCtl?.abort();
    lintCtl = new AbortController();
    const seq = ++lintSeq;
    const code = editor.getText(tab.id);
    emit('lint-state', 'busy');
    try {
      const data = await api('lint', { body: { code, name: tab.name }, signal: lintCtl.signal });
      if (seq !== lintSeq || activeTab()?.id !== tab.id || editor.getText(tab.id) !== code) return; // respuesta vieja
      state.analysis = { id: tab.id, ...data };
      editor.setMarkers(tab.id, 'lint', data.diagnostics);
      editor.refreshLenses();
      emit('analysis', state.analysis);
      emit('lint-state', data.syntax ? 'error' : 'ok');
    } catch (e) {
      if (e.name === 'AbortError') return;
      emit('lint-state', 'offline');
    }
  }
  const lintSoon = debounce(() => { if (state.settings.liveLint) lintNow(); }, 500);

  // ── Ejecutar / medir ─────────────────────────────────────────
  async function run({ bench = false } = {}) {
    const tab = activeTab();
    if (!tab || state.busy) return;
    lintCtl?.abort();
    setBusy(bench ? 'measure' : 'run');
    showPanel('salida');
    const code = editor.getText(tab.id);
    try {
      const data = await api('run', { body: { code, name: tab.name, stdin: state.stdin, timeout: state.settings.timeout, bench } });
      runs.set(tab.id, data);
      if (activeTab()?.id === tab.id) state.run = data;
      editor.setMarkers(tab.id, 'run', data.problems.filter(p => p.line));
      editor.refreshLenses();
      setBusy(null);
      emit('run', data);
      const errors = data.problems.some(p => p.severity === 'error');
      if (bench && data.benches?.some(b => b.status === 'ok')) showPanel('analisis');
      else if (!errors && data.tests?.length) showPanel('pruebas');
      else showPanel('salida');
    } catch (e) {
      setBusy(null);
      toast(e.message, 'error', 5000);
    }
  }

  async function compare() {
    const tab = activeTab();
    if (!tab || state.busy) return;
    if (!tab.hasSolution) { toast('Este archivo no tiene solución de referencia con la que comparar.'); return; }
    lintCtl?.abort();
    setBusy('compare');
    showPanel('solucion');
    const code = editor.getText(tab.id);
    const res = await api('compare', { body: { code, name: tab.name, timeout: 60 }, raw: true }).catch(e => ({ ok: false, data: { error: e.message } }));
    setBusy(null);
    if (!res.ok) { toast(res.data?.error ?? 'No se pudo comparar', 'error', 6000); showPanel('solucion'); return; }
    const data = { id: tab.id, ...res.data };
    compares.set(tab.id, data);
    runs.set(tab.id, res.data.mine);
    if (activeTab()?.id === tab.id) { state.compare = data; state.run = res.data.mine; }
    emit('run', res.data.mine);
    emit('compare', data);
    showPanel('solucion');
  }

  // ── Cambios de pestaña / edición ─────────────────────────────
  on('active', ({ id }) => {
    state.run = id ? runs.get(id) ?? null : null;
    state.compare = id ? compares.get(id) ?? null : null;
    state.analysis = null;
    const tab = activeTab();
    $('#btn-compare').disabled = !!state.busy || !tab?.hasSolution;
    $('.tool-tab[data-panel="solucion"]').hidden = !tab?.hasSolution;
    emit('analysis', null);
    emit('run', state.run);
    emit('compare', state.compare);
    if (id) lintNow();
  });
  on('doc-change', ({ id }) => {
    if (id !== state.active) return;
    if (runs.has(id) && state.run) editor.setMarkers(id, 'run', []);    // las líneas ya no coinciden con lo ejecutado
    lintSoon();
  });
  on('lint-now', lintNow);
  on('settings', ({ key }) => { if (key === 'liveLint' && state.settings.liveLint) lintNow(); });
  on('clear', () => {
    if (state.active) { runs.delete(state.active); compares.delete(state.active); editor.setMarkers(state.active, 'run', []); }
    state.compare = null;
    emit('compare', null);
  });

  ctx.actions.lintSoon = lintSoon;
  return { run, measure: () => run({ bench: true }), compare, lintNow, lintSoon };
}
