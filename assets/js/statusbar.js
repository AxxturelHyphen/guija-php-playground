// Barra de estado: posición, función actual con su complejidad, estado del análisis y de guardado.
import { $, el } from './util.js';
import { state, on, activeTab } from './state.js';
import { ctx } from './ctx.js';
import { showPanel } from './panels.js';

export function initStatusbar(editor) {
  const pos = $('#st-pos'), fn = $('#st-fn'), lint = $('#st-lint'), save = $('#st-save');
  let cursor = { line: 1, col: 1 };

  function renderFn() {
    const units = (state.analysis?.units ?? []).filter(u => u.kind !== 'main' && u.startLine <= cursor.line && cursor.line <= u.endLine);
    const u = units.sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine))[0];
    fn.hidden = !u;
    if (u) {
      fn.textContent = `${u.qname}()  ·  CC ${u.cc} (${u.grade})${u.bigO ? '  ·  ' + u.bigO : ''}`;
      fn.onclick = () => showPanel('analisis');
    }
  }

  function renderSave() {
    const tab = activeTab();
    if (!tab) { save.textContent = ''; return; }
    const dirty = editor.hasDoc(tab.id) && editor.getText(tab.id) !== tab.saved;
    save.className = 'st-item' + (dirty ? ' dirty-state' : '');
    save.textContent = tab.readOnly ? 'solo lectura' : dirty ? '● sin guardar' : tab.dir === 'practicas' ? 'guardado' : 'ejemplo (Ctrl+S crea una copia)';
  }

  function setLint(kind) {
    const txt = { busy: 'Analizando…', ok: 'Sin errores de sintaxis', error: 'Error de sintaxis', offline: 'Sin conexión con el servidor', idle: 'Listo' }[kind] ?? kind;
    lint.className = 'st-item ' + ({ ok: 'ok', error: 'error', busy: 'busy', offline: 'warn' }[kind] ?? '');
    lint.replaceChildren(el('i', { class: 'dot' }), el('span', {}, txt));
  }

  on('cursor', c => { cursor = c; pos.textContent = `Ln ${c.line}, Col ${c.col}`; renderFn(); });
  on('analysis', a => { renderFn(); if (!a) setLint('idle'); else if (!a.syntax) { const w = a.diagnostics.filter(d => d.severity === 'warning').length; if (w) { lint.className = 'st-item warn'; lint.replaceChildren(el('i', { class: 'dot' }), el('span', {}, `${w} advertencia${w === 1 ? '' : 's'}`)); } } });
  on('lint-state', setLint);
  on('doc-change', renderSave);
  on('active', () => { renderSave(); renderFn(); });
  on('saved', renderSave);
  lint.addEventListener('click', () => showPanel('problemas'));
  $('#st-php').textContent = 'PHP ' + (state.meta?.php ?? '');
  setLint('idle');
}
