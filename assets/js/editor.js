// Editor: un modelo de Monaco por archivo (así cada pestaña conserva su deshacer y su posición).
// Si no hay internet para cargar Monaco, se usa un textarea con las mismas operaciones básicas.
import { $, el } from './util.js';
import { state, emit } from './state.js';
import { loadMonaco, registerIde, refreshLenses, diagStore } from './monaco-setup.js';

const SEVERITY = m => ({ error: m.MarkerSeverity.Error, warning: m.MarkerSeverity.Warning, info: m.MarkerSeverity.Info, hint: m.MarkerSeverity.Hint });

/**
 * @param {{run:Function, measure:Function, compare:Function, save:Function, command:Function}} actions
 */
export async function createEditor(actions) {
  let monaco = null;
  try {
    monaco = await loadMonaco();
  } catch {
    monaco = null;
  }
  return monaco ? monacoEditor(monaco, actions) : textareaEditor(actions);
}

// ─────────────────────────────── Monaco ───────────────────────────────

/** Editores de diferencias reciclables (ver `diff()` en monacoEditor). */
const diffPool = [];

function monacoEditor(monaco, actions) {
  const newDiffEntry = () => {
    const box = document.createElement('div');
    box.style.cssText = 'width:100%;height:100%';
    const diff = monaco.editor.createDiffEditor(box, {
      theme: 'islands-dark', automaticLayout: true, readOnly: true, renderSideBySide: true, originalEditable: false,
      fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: Math.max(12, state.settings.fontSize - 1), fontLigatures: false,
      minimap: { enabled: false }, scrollBeyondLastLine: false, renderOverviewRuler: false, padding: { top: 6, bottom: 6 },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
    });
    return { box, diff };
  };

  registerIde(monaco, { onCommand: actions.command });
  const host = $('#editor');
  host.replaceChildren();
  const s = state.settings;
  const ed = monaco.editor.create(host, {
    language: 'phpx', theme: 'islands-dark', model: null,
    fontFamily: '"JetBrains Mono", Consolas, monospace', fontSize: s.fontSize, lineHeight: Math.round(s.fontSize * 1.57), fontLigatures: false,
    tabSize: 4, insertSpaces: true, automaticLayout: true, wordWrap: s.wordWrap ? 'on' : 'off',
    minimap: { enabled: s.minimap }, scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 },
    smoothScrolling: true, cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on',
    bracketPairColorization: { enabled: false }, guides: { indentation: true },
    renderLineHighlight: 'line', lineNumbersMinChars: 3, glyphMargin: true,
    showFoldingControls: 'mouseover', stickyScroll: { enabled: false },
    overviewRulerLanes: 2, hideCursorInOverviewRuler: true, fixedOverflowWidgets: true,
    codeLens: true, lightbulb: { enabled: 'on' }, quickSuggestions: { other: true, comments: false, strings: false },
    suggest: { showSnippets: true, preview: true }, parameterHints: { enabled: true, cycle: true },
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
    accessibilitySupport: 'auto',
  });

  const models = new Map(); // id -> model
  const uriOf = id => monaco.Uri.parse('inmemory://pg/' + encodeURIComponent(id));
  const sev = SEVERITY(monaco);

  // Atajos del IDE (dentro del editor; fuera los gestiona main.js)
  const K = monaco.KeyMod, C = monaco.KeyCode;
  ed.addCommand(K.CtrlCmd | C.Enter, () => actions.run());
  ed.addCommand(K.CtrlCmd | K.Alt | C.Enter, () => actions.measure());
  ed.addCommand(K.CtrlCmd | K.Shift | C.Enter, () => actions.compare());
  ed.addCommand(K.CtrlCmd | C.KeyS, () => actions.save());
  // Atajos de JetBrains
  ed.addCommand(K.CtrlCmd | C.KeyD, () => ed.trigger('pg', 'editor.action.copyLinesDownAction', null));
  ed.addCommand(K.CtrlCmd | C.KeyY, () => ed.trigger('pg', 'editor.action.deleteLines', null));
  ed.addCommand(K.CtrlCmd | K.Shift | C.UpArrow, () => ed.trigger('pg', 'editor.action.moveLinesUpAction', null));
  ed.addCommand(K.CtrlCmd | K.Shift | C.DownArrow, () => ed.trigger('pg', 'editor.action.moveLinesDownAction', null));
  ed.addCommand(K.Alt | C.Enter, () => ed.trigger('pg', 'editor.action.quickFix', null));
  ed.addCommand(K.CtrlCmd | C.KeyB, () => ed.trigger('pg', 'editor.action.revealDefinition', null));

  const api = {
    isMonaco: true,
    monaco,
    ed,
    hasDoc: id => models.has(id),
    openDoc(id, text, { readOnly = false } = {}) {
      let model = models.get(id);
      if (!model) {
        model = monaco.editor.createModel(text, 'phpx', uriOf(id));
        model.__pgReadOnly = readOnly;
        model.onDidChangeContent(() => emit('doc-change', { id }));
        models.set(id, model);
      }
      return model;
    },
    show(id) {
      const model = models.get(id);
      if (!model) { ed.setModel(null); return; }
      ed.setModel(model);
      ed.updateOptions({ readOnly: !!model.__pgReadOnly });
      ed.focus();
    },
    getText: id => models.get(id)?.getValue() ?? '',
    /** Sustituye el contenido conservando el historial de deshacer. */
    setText(id, text) {
      const model = models.get(id);
      if (!model || model.getValue() === text) return;
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text }], () => null);
      model.pushStackElement();
    },
    closeDoc(id) {
      const model = models.get(id);
      if (!model) return;
      if (ed.getModel() === model) ed.setModel(null);
      diagStore.delete(model.uri.toString());
      model.dispose();
      models.delete(id);
    },
    clearView() { ed.setModel(null); },
    setMarkers(id, owner, diags) {
      const model = models.get(id);
      if (!model) return;
      const key = model.uri.toString();
      const entry = diagStore.get(key) ?? {};
      entry[owner] = diags;
      diagStore.set(key, entry);
      const max = model.getLineCount();
      monaco.editor.setModelMarkers(model, owner, diags.map(d => {
        const startLineNumber = Math.min(Math.max(d.line, 1), max);
        const endLineNumber = Math.min(Math.max(d.endLine ?? d.line, startLineNumber), max);
        const startColumn = d.col > 1 || d.endCol < 900 ? Math.min(d.col, model.getLineMaxColumn(startLineNumber)) : (model.getLineFirstNonWhitespaceColumn(startLineNumber) || 1);
        const endColumn = Math.min(Math.max(d.endCol ?? model.getLineMaxColumn(endLineNumber), startColumn + (startLineNumber === endLineNumber ? 1 : 0)), model.getLineMaxColumn(endLineNumber));
        return {
          startLineNumber, startColumn, endLineNumber, endColumn: Math.max(endColumn, 1),
          message: d.title ?? d.message, severity: sev[d.severity] ?? sev.info, code: d.code, source: d.source === 'analysis' ? 'análisis' : undefined,
          tags: d.code?.startsWith('unused') ? [monaco.MarkerTag.Unnecessary] : undefined,
        };
      }));
    },
    applyEdits(id, edits) {
      const model = models.get(id);
      if (!model || model.__pgReadOnly) return;
      const ops = edits.map(e => ({ range: new monaco.Range(e.range.sl, e.range.sc, e.range.el, e.range.ec), text: e.text }));
      model.pushEditOperations([], ops, () => null);
      model.pushStackElement();
    },
    reveal(line, col = 1) {
      ed.revealLineInCenterIfOutsideViewport(line);
      ed.setPosition({ lineNumber: line, column: col });
      ed.focus();
    },
    cursor: () => ed.getPosition(),
    focus: () => ed.focus(),
    setOption(key, value) {
      if (key === 'fontSize') ed.updateOptions({ fontSize: value, lineHeight: Math.round(value * 1.57) });
      else if (key === 'wordWrap') ed.updateOptions({ wordWrap: value ? 'on' : 'off' });
      else if (key === 'minimap') ed.updateOptions({ minimap: { enabled: value } });
    },
    refreshLenses,
    /** Editor de diferencias (tu función frente a la solución). Devuelve una función para destruirlo. */
    diff(host, original, modified) {
      // Los editores de diferencias NO se destruyen: se reciclan. Monaco comparte servicios globales (el menú de
      // Quick Fix, por ejemplo) que se enlazan con el primer editor que los pide; si ese fuera un diff que luego
      // se destruye, Alt+Enter dejaría de funcionar en el editor principal («InstantiationService has been disposed»).
      const entry = diffPool.pop() ?? newDiffEntry();
      host.append(entry.box);
      const o = monaco.editor.createModel(original, 'phpx');
      const m = monaco.editor.createModel(modified, 'phpx');
      entry.diff.setModel({ original: o, modified: m });
      entry.diff.layout();
      return () => {
        entry.diff.setModel(null);
        o.dispose();
        m.dispose();
        entry.box.remove();
        diffPool.push(entry);
      };
    },
  };

  ed.onDidChangeCursorPosition(e => emit('cursor', { line: e.position.lineNumber, col: e.position.column }));
  return api;
}

// ─────────────────────────────── Respaldo sin internet ───────────────────────────────

function textareaEditor(actions) {
  const host = $('#editor');
  const ta = el('textarea', { class: 'fallback', spellcheck: 'false', 'aria-label': 'Código' });
  host.replaceChildren(ta);
  const docs = new Map(); // id -> {text, readOnly}
  let current = null;

  const pos = () => {
    const before = ta.value.slice(0, ta.selectionStart).split('\n');
    return { lineNumber: before.length, column: before[before.length - 1].length + 1 };
  };
  const cursor = () => emit('cursor', { line: pos().lineNumber, col: pos().column });
  ta.addEventListener('input', () => { if (current) { docs.get(current).text = ta.value; emit('doc-change', { id: current }); } });
  ['keyup', 'click'].forEach(ev => ta.addEventListener(ev, cursor));
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input')); }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') { e.preventDefault(); (e.shiftKey ? actions.compare : e.altKey ? actions.measure : actions.run)(); }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); actions.save(); }
  });

  return {
    isMonaco: false,
    hasDoc: id => docs.has(id),
    openDoc(id, text, { readOnly = false } = {}) { if (!docs.has(id)) docs.set(id, { text, readOnly }); },
    show(id) {
      const d = docs.get(id);
      current = d ? id : null;
      ta.value = d?.text ?? '';
      ta.readOnly = !!d?.readOnly;
      ta.focus();
    },
    getText: id => (id === current ? ta.value : docs.get(id)?.text ?? ''),
    setText(id, text) {
      const d = docs.get(id);
      if (!d) return;
      d.text = text;
      if (id === current) ta.value = text;
      emit('doc-change', { id });
    },
    closeDoc(id) { docs.delete(id); if (current === id) { current = null; ta.value = ''; } },
    clearView() { current = null; ta.value = ''; },
    setMarkers() {},
    applyEdits(id, edits) {
      const d = docs.get(id);
      if (!d || d.readOnly) return;
      const lines = d.text.split('\n');
      const off = (l, c) => lines.slice(0, l - 1).reduce((n, x) => n + x.length + 1, 0) + c - 1;
      let text = d.text;
      for (const e of [...edits].sort((a, b) => off(b.range.sl, b.range.sc) - off(a.range.sl, a.range.sc))) {
        text = text.slice(0, off(e.range.sl, e.range.sc)) + e.text + text.slice(off(e.range.el, e.range.ec));
      }
      this.setText(id, text);
    },
    reveal(line) {
      const at = ta.value.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0);
      ta.focus();
      ta.setSelectionRange(at, at);
    },
    cursor: pos,
    focus: () => ta.focus(),
    setOption(key, value) { if (key === 'fontSize') ta.style.fontSize = value + 'px'; if (key === 'wordWrap') ta.style.whiteSpace = value ? 'pre-wrap' : 'pre'; },
    refreshLenses() {},
    diff: null,
  };
}
