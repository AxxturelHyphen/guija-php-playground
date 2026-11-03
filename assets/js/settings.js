// Ajustes (tamaño de letra, ajuste de línea, minimapa, límite de tiempo, análisis en vivo) y ayuda (F1).
import { el, $ } from './util.js';
import { state, setSetting, DEFAULT_SETTINGS } from './state.js';
import { ctx } from './ctx.js';
import { infoDialog } from './dialog.js';
import { LANG } from './lang.js';

export function applySettings() {
  const s = state.settings;
  ctx.editor?.setOption('fontSize', s.fontSize);
  ctx.editor?.setOption('wordWrap', s.wordWrap);
  ctx.editor?.setOption('minimap', s.minimap);
  $('#timeout').value = String(s.timeout);
}

export function openSettings() {
  const s = state.settings;
  const row = (label, hint, control) => el('div', { class: 'form-row' }, el('div', {}, el('div', {}, label), hint ? el('div', { class: 'muted', style: 'font-size:12px' }, hint) : null), control);
  const check = (key) => el('input', { type: 'checkbox', checked: s[key] ? true : null, onchange: e => { setSetting(key, e.target.checked); applySettings(); } });
  const size = el('input', { type: 'number', min: 10, max: 28, value: s.fontSize, onchange: e => { setSetting('fontSize', Math.max(10, Math.min(28, +e.target.value || 14))); applySettings(); } });
  const timeout = el('select', { class: 'sel', onchange: e => { setSetting('timeout', +e.target.value); applySettings(); } },
    [5, 10, 30].map(v => el('option', { value: v, selected: v === s.timeout ? true : null }, v + ' s')));
  const body = el('div', {},
    row('Tamaño de letra', 'También Ctrl + rueda del ratón, Ctrl +/−', size),
    row('Ajuste de línea', 'Alt+Z', check('wordWrap')),
    row('Minimapa', null, check('minimap')),
    row('Análisis mientras escribes', 'Complejidad, pistas y errores en vivo', check('liveLint')),
    row('Tiempo máximo de ejecución', 'El programa se corta pasado este tiempo', timeout),
    el('div', { style: 'margin-top:12px' }, el('button', { class: 'btn', onclick: () => { Object.entries(DEFAULT_SETTINGS).forEach(([k, v]) => setSetting(k, v)); applySettings(); document.querySelector('#modal-root .modal-back')?.remove(); } }, 'Restablecer valores')));
  return infoDialog('Ajustes', body, { wide: false });
}

const KEYS = [
  ['Ctrl + Enter', 'Ejecutar'],
  ['Ctrl + Alt + Enter', 'Ejecutar y medir con medir()'],
  ['Ctrl + Shift + Enter', 'Comparar tu rendimiento con la solución'],
  ['Ctrl + S', `Guardar en practicas/${LANG.id}/ (de un ejemplo guarda una copia)`],
  ['Alt + Enter', 'Arreglo rápido en el error o aviso bajo el cursor'],
  ['Ctrl + Espacio', 'Autocompletado (plantillas: fore, func, class, prueba, medir…)'],
  ['Ctrl + D', 'Duplicar línea'],
  ['Ctrl + Y', 'Borrar línea'],
  ['Ctrl + Shift + ↑ / ↓', 'Mover línea'],
  ['Ctrl + /', 'Comentar / descomentar'],
  ['Ctrl + F  ·  Ctrl + H', 'Buscar  ·  reemplazar'],
  ['Alt + 1', 'Mostrar u ocultar el panel Proyecto'],
  ['Alt + Z', 'Ajuste de línea'],
  ['F1', 'Esta ayuda'],
];

export function openHelp() {
  const grid = el('div', { class: 'help-grid' }, KEYS.flatMap(([k, d]) => [el('kbd', {}, k), el('span', {}, d)]));
  const pre = t => el('pre', {}, t);
  const body = el('div', {},
    el('h3', {}, 'Atajos'), grid,
    el('h3', {}, 'Pruebas en tus ejercicios'),
    el('p', {}, 'Las funciones del playground están disponibles en cualquier archivo:'),
    pre(LANG.help.tests),
    el('p', {}, el('code', {}, LANG.help.pendiente), ' marca un ejercicio sin resolver (cuenta como pendiente, no como fallo).'),
    el('h3', {}, 'Medir la complejidad'),
    pre(LANG.help.medir),
    el('h3', {}, 'Qué te dice el análisis'),
    el('p', {}, el('b', {}, 'Ciclomática'), ': caminos distintos de la función (cuántas pruebas necesitas). ', el('b', {}, 'Cognitiva'), ': lo difícil que es de leer (el anidamiento pesa). ',
      el('b', {}, 'O()'), ': estimación de lo que crece el coste con la entrada; «Medir» la confirma con tiempos reales.'),
    el('h3', {}, 'Soluciones'),
    el('p', {}, 'Si un ejercicio tiene solución, aparece la pestaña «Solución»: explicación, diferencias con tu código y una comparación de rendimiento con gráfica. Está oculta tras un aviso para que lo intentes antes.'));
  return infoDialog(`Guija ${LANG.name} Playground · Ayuda`, body);
}
