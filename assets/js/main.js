// Punto de entrada: crea el editor, conecta módulos y atajos globales.
import { $, store, toast } from './util.js';
import { state, emit, on, setSetting, activeTab } from './state.js';
import { api } from './api.js';
import { ctx } from './ctx.js';
import { createEditor } from './editor.js';
import { createFiles } from './files.js';
import { createRunner } from './run.js';
import { initPanels } from './panels.js';
import { initStatusbar } from './statusbar.js';
import { applySettings, openSettings, openHelp } from './settings.js';
import { LANG } from './lang.js';
import './panels/salida.js';
import './panels/problemas.js';
import './panels/pruebas.js';
import './panels/analisis.js';
import './panels/solucion.js';

initPanels();

// Monaco cancela promesas internas al cambiar de modelo y las deja sin capturar: es ruido inofensivo
window.addEventListener('unhandledrejection', e => { if (e.reason?.name === 'Canceled' || e.reason?.message === 'Canceled') e.preventDefault(); });

// ── Redimensionar (barra lateral y ventana de herramientas) ────────
function splitter(handle, { axis, apply, load, save }) {
  const start = load();
  if (start != null) apply(start);
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.classList.add(axis === 'x' ? 'dragging-v' : 'dragging-h');
    const move = ev => apply(axis === 'x' ? ev.clientX : ev.clientY);
    const up = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.classList.remove('dragging');
      document.body.classList.remove('dragging-v', 'dragging-h');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      save();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}
const root = document.documentElement;
splitter($('#gutter-side'), {
  axis: 'x',
  apply: x => root.style.setProperty('--side', Math.max(160, Math.min(520, x - 8)) + 'px'),
  load: () => { const v = parseInt(store.get('pg:side', ''), 10); return Number.isFinite(v) ? v + 8 : null; },
  save: () => store.set('pg:side', String(parseInt(getComputedStyle(root).getPropertyValue('--side'), 10))),
});
splitter($('#gutter-tool'), {
  axis: 'y',
  apply: y => {
    const col = $('#main-col').getBoundingClientRect();
    const h = Math.max(120, Math.min(col.height - 140, col.bottom - y));
    root.style.setProperty('--tool', h + 'px');
  },
  load: () => { const v = parseInt(store.get('pg:tool', ''), 10); return Number.isFinite(v) ? $('#main-col').getBoundingClientRect().bottom - v : null; },
  save: () => store.set('pg:tool', String(parseInt(getComputedStyle(root).getPropertyValue('--tool'), 10))),
});

// ── Arranque ─────────────────────────────────────────────────────
async function boot() {
  try {
    state.meta = await api('meta');
  } catch (e) {
    $('#editor').replaceChildren(Object.assign(document.createElement('div'), { className: 'loading', textContent: e.message }));
    return;
  }
  $('#php-version').textContent = LANG.name + ' ' + (state.meta.version ?? '');
  store.set('pg:lastLang', LANG.id);
  if (!state.meta.ok) toast(`${LANG.name} no está listo en este PC: ${(state.meta.missing ?? []).map(m => m.what).join(', ')}. Vuelve a la pantalla de inicio para ver cómo instalarlo.`, 'error', 9000);

  // El catálogo (autocompletado/hover) llega en paralelo: no bloquea el editor
  api('catalog').then(c => { state.catalog = c; }).catch(() => {});

  let runner;
  const actions = {
    run: () => runner.run(),
    measure: () => runner.measure(),
    compare: () => runner.compare(),
    save: () => ctx.files.save(),
    command: (what, arg) => { if (what === 'analysis') ctx.showPanel('analisis'); void arg; },
  };
  const editor = await createEditor(actions);
  ctx.editor = editor;
  ctx.files = createFiles(editor);
  runner = createRunner(editor);
  ctx.actions = { ...actions, lintSoon: ctx.actions.lintSoon, lintNow: runner.lintNow };
  initStatusbar(editor);
  applySettings();
  if (!editor.isMonaco) toast('No se pudo cargar Monaco (¿sin internet?). Usas el editor básico: se mantienen la ejecución y el análisis.', '', 6000);

  $('#btn-run').addEventListener('click', actions.run);
  $('#btn-measure').addEventListener('click', actions.measure);
  $('#btn-compare').addEventListener('click', actions.compare);
  $('#btn-save').addEventListener('click', actions.save);
  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-help').addEventListener('click', openHelp);
  $('#btn-clear').addEventListener('click', () => emit('clear'));
  $('#timeout').addEventListener('change', e => setSetting('timeout', +e.target.value));
  on('settings', applySettings);

  $('#btn-sidebar').addEventListener('click', toggleSidebar);
  if (store.get('pg:sidebar') === '0' && !narrow()) document.body.classList.add('sidebar-hidden');

  await ctx.files.init();
  if (!activeTab()) $('#editor-island').classList.add('is-empty');
}

const narrow = () => window.matchMedia('(max-width: 760px)').matches;
function toggleSidebar() {
  if (narrow()) { document.body.classList.toggle('sidebar-open'); return; }
  const hidden = document.body.classList.toggle('sidebar-hidden');
  store.set('pg:sidebar', hidden ? '0' : '1');
  window.dispatchEvent(new Event('resize'));
}

// Atajos que funcionan aunque el foco no esté en el editor
document.addEventListener('keydown', e => {
  if (e.defaultPrevented) return;   // Monaco ya lo ha gestionado
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && e.key === 'Enter') {
    e.preventDefault();
    (e.shiftKey ? ctx.actions.compare : e.altKey ? ctx.actions.measure : ctx.actions.run)?.();
  } else if (mod && k === 's') { e.preventDefault(); ctx.actions.save?.(); }
  else if (e.key === 'F1') { e.preventDefault(); openHelp(); }
  else if (e.altKey && e.key === '1') { e.preventDefault(); toggleSidebar(); }
  else if (e.altKey && k === 'z') { e.preventDefault(); setSetting('wordWrap', !state.settings.wordWrap); }
  else if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); setSetting('fontSize', Math.min(28, state.settings.fontSize + 1)); }
  else if (mod && e.key === '-') { e.preventDefault(); setSetting('fontSize', Math.max(10, state.settings.fontSize - 1)); }
});
document.addEventListener('wheel', e => {
  if (!e.ctrlKey || !$('#editor').contains(e.target)) return;
  e.preventDefault();
  setSetting('fontSize', Math.max(10, Math.min(28, state.settings.fontSize + (e.deltaY < 0 ? 1 : -1))));
}, { passive: false });

boot();
