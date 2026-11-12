// Punto de entrada: crea el editor, conecta módulos y atajos globales.
import { $, el, store, toast } from './util.js';
import { state, emit, on, setSetting, activeTab } from './state.js';
import { api } from './api.js';
import { ctx } from './ctx.js';
import { createEditor } from './editor.js';
import { loadMonaco } from './monaco-setup.js';
import { createFiles } from './files.js';
import { createRunner } from './run.js';
import { initPanels } from './panels.js';
import { initStatusbar } from './statusbar.js';
import { applySettings, openSettings, openHelp } from './settings.js';
import { LANG } from './lang.js';
import { initLeccion, cargarTemario, abrirDesdeUrl, abrirEjercicio } from './leccion.js';
import { montarSiguiente } from './siguiente.js';
import { initSesion } from './sesion.js';
import { initIdeas } from './ideas.js';
import './panels/salida.js';
import './panels/problemas.js';
import './panels/pruebas.js';
import './panels/analisis.js';
import './panels/solucion.js';

initPanels();

// Monaco cancela promesas internas al cambiar de modelo y las deja sin capturar: es ruido inofensivo
window.addEventListener('unhandledrejection', e => { if (e.reason?.name === 'Canceled' || e.reason?.message === 'Canceled') e.preventDefault(); });

// ── Redimensionar (barra lateral y ventana de herramientas) ────────
// Ratón/táctil: pointermove solo anota la coordenada y una escritura de variable CSS por fotograma (rAF).
// Teclado (separador con tabindex=0): flechas = 16 px (Mayús 64), Inicio/Fin = mínimo/máximo.
function splitter(handle, { axis, apply, set, size, range, grow, load, save }) {
  const sync = () => {
    const [min, max] = range();
    handle.setAttribute('aria-valuemin', String(Math.round(min)));
    handle.setAttribute('aria-valuemax', String(Math.round(max)));
    handle.setAttribute('aria-valuenow', String(Math.round(size())));
  };
  const start = load();
  if (start != null) apply(start);
  requestAnimationFrame(sync);
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('dragging');
    document.body.classList.add(axis === 'x' ? 'dragging-v' : 'dragging-h');
    let raf = 0, pending = null;
    const flush = () => { raf = 0; if (pending != null) { apply(pending); pending = null; } };
    const move = ev => { pending = axis === 'x' ? ev.clientX : ev.clientY; raf ||= requestAnimationFrame(flush); };
    const up = () => {
      cancelAnimationFrame(raf);
      flush();
      handle.releasePointerCapture(e.pointerId);
      handle.classList.remove('dragging');
      document.body.classList.remove('dragging-v', 'dragging-h');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      save();
      sync();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? 64 : 16;
    const [min, max] = range();
    const dir = axis === 'x' ? { ArrowRight: 1, ArrowLeft: -1 } : { ArrowUp: 1, ArrowDown: -1 };
    let px;
    if (e.key in dir) px = size() + dir[e.key] * step * grow;
    else if (e.key === 'Home') px = min;
    else if (e.key === 'End') px = max;
    else return;
    e.preventDefault();
    set(Math.max(min, Math.min(max, px)));
    save();
    sync();
  });
}
const root = document.documentElement;
const SIDE = [160, 520];
splitter($('#gutter-side'), {
  axis: 'x', grow: 1,
  apply: x => root.style.setProperty('--side', Math.max(SIDE[0], Math.min(SIDE[1], x - 8)) + 'px'),
  set: px => root.style.setProperty('--side', px + 'px'),
  size: () => $('#sidebar').getBoundingClientRect().width,
  range: () => SIDE,
  load: () => { const v = parseInt(store.get('pg:side', ''), 10); return Number.isFinite(v) ? v + 8 : null; },
  save: () => store.set('pg:side', String(parseInt(getComputedStyle(root).getPropertyValue('--side'), 10))),
});
const toolMax = () => $('#main-col').getBoundingClientRect().height - 140;
splitter($('#gutter-tool'), {
  axis: 'y', grow: 1,
  apply: y => {
    const col = $('#main-col').getBoundingClientRect();
    const h = Math.max(120, Math.min(col.height - 140, col.bottom - y));
    root.style.setProperty('--tool', h + 'px');
  },
  set: px => root.style.setProperty('--tool', px + 'px'),
  size: () => $('#tool-island').getBoundingClientRect().height,
  range: () => [120, Math.max(120, toolMax())],
  load: () => { const v = parseInt(store.get('pg:tool', ''), 10); return Number.isFinite(v) ? $('#main-col').getBoundingClientRect().bottom - v : null; },
  save: () => store.set('pg:tool', String(parseInt(getComputedStyle(root).getPropertyValue('--tool'), 10))),
});

// ── Arranque ─────────────────────────────────────────────────────
// Estado de error con «Reintentar»: sustituye al esqueleto (no deja un «Cargando…» eterno si la API falla)
function showError(host, e, retry) {
  host.removeAttribute('aria-busy');
  host.querySelectorAll('.skel, .sr-only').forEach(n => n.setAttribute('hidden', ''));
  host.append(el('div', { class: 'err-state', role: 'alert' },
    el('p', {}, e?.message ?? String(e)),
    el('button', { class: 'btn', type: 'button', onclick: () => retry() }, 'Reintentar')));
}
function clearError(host) {
  host.querySelector('.err-state')?.remove();
  host.querySelectorAll('.skel, .sr-only').forEach(n => n.removeAttribute('hidden'));
  host.setAttribute('aria-busy', 'true');
}

// Monaco (lo más lento del arranque) empieza a bajar ya, a la vez que la petición de meta y el árbol
loadMonaco().catch(() => {});   // el fallo (sin CDN) lo gestiona createEditor con el editor básico

async function boot() {
  const editorHost = $('#editor');
  clearError(editorHost);
  try {
    state.meta = await api('meta');
  } catch (e) {
    showError(editorHost, e, boot);
    return;
  }
  cargarTemario();   // en paralelo con el resto del arranque: nunca lanza y, si la caché es reciente, ni pide nada
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
  initLeccion();   // antes de ctx.files.init(): así ve el primer 'active' y marca la lección de la pestaña restaurada
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
  $('#btn-zen').addEventListener('click', () => setZen(!htmlEl.classList.contains('zen')));
  $('#btn-zen').setAttribute('aria-pressed', String(htmlEl.classList.contains('zen')));
  ctx.zen = setZen;
  montarSiguiente($('#siguiente'), {
    lang: LANG.id, nuevaPestana: true, alAbrir: r => abrirEjercicio(r.leccion, r.clave),
    vacio: { titulo: 'Abre una lección', detalle: 'Elige un ejemplo del árbol para empezar.' },
  });
  initSesion();
  initIdeas();
  if (store.get('pg:sidebar') === '0' && !narrow()) document.body.classList.add('sidebar-hidden');

  const iniciar = async () => {
    clearError($('#tree'));
    try {
      await ctx.files.init();
    } catch (e) {
      showError($('#tree'), e, iniciar);
      return;
    }
    $('#tree').removeAttribute('aria-busy');
    $('#editor').removeAttribute('aria-busy');
    if (!activeTab()) $('#editor-island').classList.add('is-empty');
  };
  await iniciar();
  await abrirDesdeUrl();   // /cpp?l=recursion&e=fib (enlaces de «Siguiente paso» y de repaso): abre la lección y enfoca el ejercicio
}

const narrow = () => window.matchMedia('(max-width: 760px)').matches;
const htmlEl = document.documentElement;
function setSidebar(hidden) {
  if (narrow()) { if (hidden) document.body.classList.remove('sidebar-open'); return; }
  document.body.classList.toggle('sidebar-hidden', hidden);
  store.set('pg:sidebar', hidden ? '0' : '1');
  window.dispatchEvent(new Event('resize'));
}
function toggleSidebar() {
  if (narrow()) { document.body.classList.toggle('sidebar-open'); return; }
  setSidebar(!document.body.classList.contains('sidebar-hidden'));
}
// «Sin distracciones»: reutiliza el estado del panel Proyecto (pg:sidebar) y además oculta la ventana de resultados
// (clase en <html>, que shell.php aplica antes del primer pintado). Al salir devuelve el panel a como estaba.
function setZen(on) {
  if (on === htmlEl.classList.contains('zen')) return;
  if (on) {
    store.set('pg:zenprev', document.body.classList.contains('sidebar-hidden') ? '1' : '0');
    htmlEl.classList.add('zen');
    setSidebar(true);
  } else {
    htmlEl.classList.remove('zen');
    setSidebar(store.get('pg:zenprev', '0') === '1');
  }
  store.set('pg:zen', on ? '1' : '0');
  $('#btn-zen').setAttribute('aria-pressed', String(on));
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
  else if (e.altKey && k === 'q') { e.preventDefault(); setZen(!htmlEl.classList.contains('zen')); }
  else if (e.altKey && k === 'z') { e.preventDefault(); setSetting('wordWrap', !state.settings.wordWrap); }
  else if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); setSetting('fontSize', Math.min(28, state.settings.fontSize + 1)); }
  else if (mod && e.key === '-') { e.preventDefault(); setSetting('fontSize', Math.max(10, state.settings.fontSize - 1)); }
});
// Ctrl + rueda cambia el tamaño de letra. El listener (no pasivo, porque llama a preventDefault) va solo sobre el editor,
// no en todo el documento: así el resto de la página sigue desplazándose por el hilo del compositor.
$('#editor').addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setSetting('fontSize', Math.max(10, Math.min(28, state.settings.fontSize + (e.deltaY < 0 ? 1 : -1))));
}, { passive: false });

boot();
