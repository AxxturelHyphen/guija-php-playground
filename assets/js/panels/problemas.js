// Panel Problemas: sintaxis + análisis estático + lo ocurrido en la última ejecución, agrupado por gravedad.
import { $, el } from '../util.js';
import { state, on } from '../state.js';
import { registerPanel, setCount } from '../panels.js';
import { diagCard } from '../diagcard.js';

const ORDER = ['error', 'warning', 'info', 'hint'];
const TITLES = { error: 'Errores', warning: 'Advertencias', info: 'Información', hint: 'Sugerencias de estilo' };

export function allProblems() {
  const live = state.analysis?.diagnostics ?? [];
  const ran = (state.run?.problems ?? []).filter(p => p.source !== 'syntax' || !live.some(l => l.code === p.code && l.line === p.line));
  return [...ran, ...live];
}

function render() {
  const host = $('#panel-problemas');
  const list = allProblems();
  const counts = Object.fromEntries(ORDER.map(s => [s, list.filter(d => d.severity === s).length]));
  const real = counts.error + counts.warning;
  setCount('problemas', real || (list.length ? list.length : ''), counts.error ? 'err' : counts.warning ? 'warn' : '');

  host.replaceChildren();
  if (!list.length) {
    host.append(el('div', { class: 'placeholder' }, state.analysis ? '✓ Sin problemas en este archivo.' : 'El análisis aparece aquí en cuanto escribes.'));
    return;
  }
  for (const sev of ORDER) {
    const items = list.filter(d => d.severity === sev);
    if (!items.length) continue;
    host.append(el('div', { class: 'group-title' }, `${TITLES[sev]} (${items.length})`));
    items.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
    items.forEach(d => host.append(diagCard(d, { open: sev === 'error' || sev === 'warning' || items.length <= 3 })));
  }
}

registerPanel('problemas', { onShow: render });
on('analysis', render);
on('run', render);
on('active', render);
render();
