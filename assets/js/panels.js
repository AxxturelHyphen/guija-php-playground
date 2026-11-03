// Ventana de herramientas: pestañas, contadores y registro de paneles.
import { $, $$, store } from './util.js';
import { ctx } from './ctx.js';

const registry = new Map(); // id -> {render, onShow}
let current = 'salida';

export function registerPanel(id, impl) {
  registry.set(id, impl);
}

export function showPanel(id, { focus = false } = {}) {
  if (!registry.has(id)) return;
  current = id;
  for (const tab of $$('.tool-tab')) {
    const on = tab.dataset.panel === id;
    tab.classList.toggle('active', on);
    tab.setAttribute('aria-selected', String(on));
  }
  for (const p of $$('.panel')) p.hidden = p.id !== 'panel-' + id;
  registry.get(id).onShow?.();
  if (focus) $('#panel-' + id).focus?.();
  store.set('pg:panel', id);
}

export const currentPanel = () => current;

/** Contador de la pestaña: setCount('problemas', 3, 'err') */
export function setCount(id, text, kind = '') {
  const c = $(`.count[data-count="${id}"]`);
  if (!c) return;
  c.hidden = text === '' || text == null || text === 0;
  c.textContent = String(text);
  c.className = 'count ' + kind;
}

export function showTab(id, visible) {
  const t = $(`.tool-tab[data-panel="${id}"]`);
  if (t) t.hidden = !visible;
  if (!visible && current === id) showPanel('salida');
}

export function initPanels() {
  for (const tab of $$('.tool-tab')) tab.addEventListener('click', () => showPanel(tab.dataset.panel));
  ctx.showPanel = showPanel;
  const saved = store.get('pg:panel', 'salida');
  showPanel(registry.has(saved) && saved !== 'solucion' ? saved : 'salida');
}
