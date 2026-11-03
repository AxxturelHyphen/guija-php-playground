// Estado compartido y bus de eventos. Los paneles escuchan eventos; main.js los conecta con el resto.
import { store } from './util.js';

const bus = new EventTarget();
export const on = (name, fn) => bus.addEventListener(name, e => fn(e.detail));
export const emit = (name, detail) => bus.dispatchEvent(new CustomEvent(name, { detail }));

export const DEFAULT_SETTINGS = { fontSize: 14, wordWrap: false, minimap: false, timeout: 5, liveLint: true };

export const state = {
  meta: null,
  catalog: null,
  tree: { ejemplos: [], practicas: [], soluciones: [] },
  tabs: [],            // [{id, dir, name, saved, hasSolution, readOnly}]
  active: null,        // id de la pestaña activa
  analysis: null,      // última respuesta de lint {syntax, diagnostics, units, summary}
  run: null,           // último informe de ejecución
  compare: null,       // última comparación
  solution: null,      // última lista de soluciones
  busy: null,          // null | 'run' | 'measure' | 'compare'
  stdin: '',
  settings: { ...DEFAULT_SETTINGS, ...store.json('pg:settings', {}) },
};

export function setSetting(key, value) {
  state.settings[key] = value;
  store.set('pg:settings', JSON.stringify(state.settings));
  emit('settings', { key, value });
}

export const activeTab = () => state.tabs.find(t => t.id === state.active) ?? null;
