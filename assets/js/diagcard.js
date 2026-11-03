// Tarjeta de diagnóstico: título, explicación en español, pista, "¿quisiste decir…?", arreglos y fragmento de código.
import { el, md } from './util.js';
import { state } from './state.js';
import { ctx } from './ctx.js';
import { LANG } from './lang.js';

const ICON = { error: '✕', warning: '!', info: 'i', hint: '·' };

/** Texto del archivo activo, para el fragmento de código. */
function activeLines() {
  return state.active && ctx.editor?.hasDoc(state.active) ? ctx.editor.getText(state.active).split('\n') : [];
}

function excerpt(d, lines) {
  if (!lines.length || !d.line || d.line > lines.length) return null;
  const from = Math.max(1, d.line - 1), to = Math.min(lines.length, (d.endLine ?? d.line) + 1);
  const rows = [];
  for (let n = from; n <= to; n++) {
    const hl = n >= d.line && n <= (d.endLine ?? d.line);
    rows.push(el('div', { class: 'ln' + (hl ? ' hl ' + d.severity : '') }, el('span', { class: 'no' }, String(n)), lines[n - 1] || ' '));
  }
  return el('div', { class: 'diag-code' }, rows);
}

function applyFix(fix) {
  if (!state.active) return;
  ctx.editor.applyEdits(state.active, fix.edits);
  ctx.editor.focus();
  ctx.actions.lintSoon?.();
}

/**
 * @param {object} d diagnóstico (formato del servidor)
 * @param {{open?: boolean, excerpt?: boolean}} opts
 */
export function diagCard(d, { open = true, withExcerpt = true } = {}) {
  const sev = d.severity ?? 'info';
  const body = el('div', { class: 'diag-body' });
  if (d.explain) body.append(el('p', { html: md(d.explain) }));
  if (d.hint) body.append(el('p', { class: 'diag-hint', html: md(d.hint) }));
  if (d.suggestions?.length) {
    body.append(el('div', { class: 'sugg' }, el('span', { class: 'muted' }, '¿Quisiste decir?'),
      d.suggestions.map(s => el('span', { class: 'chip' }, s))));
  }
  if (withExcerpt) {
    const ex = excerpt(d, activeLines());
    if (ex) body.append(ex);
  }
  if (d.fixes?.length) {
    body.append(el('div', { class: 'diag-fixes' }, d.fixes.map(fx =>
      el('button', { class: 'btn btn-fix', title: 'Aplicar este arreglo en el editor', onclick: e => { e.stopPropagation(); applyFix(fx); } }, '⚡ ' + fx.title))));
  }
  if (d.trace?.length) {
    body.append(el('details', { class: 'trace' }, el('summary', {}, `Traza (${d.trace.length})`),
      d.trace.map(t => el('div', {}, `${t.fn ?? '?'}${t.line ? '  ·  línea ' + t.line : ''}`))));
  }
  if (d.original && d.original !== d.title) body.append(el('div', { class: 'orig' }, 'Mensaje original de ' + LANG.name + ': ' + d.original));

  const loc = d.line ? el('span', { class: 'diag-loc jump', title: 'Ir a la línea', onclick: e => { e.stopPropagation(); ctx.editor.reveal(d.line, d.col > 1 ? d.col : 1); } }, `línea ${d.line}`) : null;
  const head = el('div', { class: 'diag-head', onclick: () => { body.hidden = !body.hidden; } },
    el('span', { class: 'sev ' + sev, 'aria-label': sev }, ICON[sev] ?? 'i'),
    el('span', { class: 'diag-title', html: md(d.title ?? d.message ?? '') }), loc);
  body.hidden = !open;
  return el('div', { class: 'diag ' + sev, role: 'group' }, head, body);
}
