// Carga de Monaco y funciones del IDE sobre él: completado, hover, ayuda de firma, CodeLens y arreglos rápidos.
import { registerTheme } from './monaco-theme.js';
import { state } from './state.js';
import { LANG } from './lang.js';

const MONACO = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min';

export function loadMonaco() {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = MONACO + '/vs/loader.min.js';
    s.onerror = () => reject(new Error('Sin conexión con el CDN'));
    s.onload = () => {
      window.MonacoEnvironment = {
        getWorkerUrl: () => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
          `self.MonacoEnvironment={baseUrl:'${MONACO}/'};importScripts('${MONACO}/vs/base/worker/workerMain.js');`),
      };
      window.require.config({ paths: { vs: MONACO + '/vs' } });
      window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
    };
    document.head.append(s);
  });
}

const TEMPLATES = LANG.templates;
const KEYWORDS = LANG.keywords;

const lensListeners = new Set();
export const refreshLenses = () => lensListeners.forEach(l => l());

const mdLines = (...parts) => ({ value: parts.filter(Boolean).join('\n\n'), isTrusted: false, supportHtml: false });
const sigText = (name, f) => `${name}(${f.p.join(', ')})${f.ret}`;

/** Nombre sin tipo ni $ para el hueco del snippet: "?int $length = null" -> "length", "key=None" -> "key", "int n" -> "n" */
const slotName = p => (p.match(/\$(\w+)/)?.[1] ?? p.replace(/[=:].*$/, '').trim().split(/\s+/).pop()?.replace(/^\*+|[^\w]/g, '') ?? 'x') || 'x';
/** Busca en el catálogo (PHP no distingue mayúsculas en nombres de función). */
const catFn = (cat, name) => cat?.functions?.[LANG.caseInsensitiveFns ? name.toLowerCase() : name];

// ── Símbolos del usuario (los lenguajes que los envían en analysis.symbols: hoy C++) ──
const MIEMBRO = new Set(['field', 'method']);
/** Locales y parámetros solo existen desde su declaración; lo global, en todo su ámbito. */
const desdeSuLinea = s => s.fn && ['var', 'const', 'lambda', 'alias'].includes(s.kind);
const visible = (s, line) => s.scope.sl <= line && line <= s.scope.el && (!desdeSuLinea(s) || s.line <= line);

/**
 * El símbolo que nombra la palabra bajo el cursor: el de ámbito más interno y, a igualdad, el declarado más cerca
 * antes del cursor. Tras `.` o `->` se prefieren campos y métodos (aunque se usen fuera de su clase).
 */
function symbolAt(model, position, w) {
  const syms = (state.analysis?.symbols ?? []).filter(s => s.name === w.word);
  if (!syms.length) return null;
  const line = position.lineNumber;
  const propia = syms.find(s => s.line === line && s.col === w.startColumn);
  if (propia) return propia;
  const miembro = /(\.|->)\s*$/.test(model.getLineContent(line).slice(0, w.startColumn - 1));
  let cand = syms.filter(s => visible(s, line) && (!miembro || MIEMBRO.has(s.kind)));
  if (!cand.length && miembro) cand = syms.filter(s => MIEMBRO.has(s.kind));
  if (!cand.length) return null;
  const antes = s => (s.line <= line ? line - s.line : 1e6 + s.line);
  cand.sort((a, b) => (a.scope.el - a.scope.sl) - (b.scope.el - b.scope.sl) || antes(a) - antes(b));
  return cand[0];
}

const KIND_ES = {
  var: ['Variable', 'a'], param: ['Parámetro', 'o'], field: ['Campo', 'o'], function: ['Función', 'a'], method: ['Método', 'o'],
  type: ['Tipo', 'o'], alias: ['Alias de tipo', 'o'], enumerator: ['Valor de enumeración', 'o'], const: ['Constante', 'a'], lambda: ['Lambda', 'a'],
};

function symbolHover(s) {
  const [nombre, g] = KIND_ES[s.kind] ?? ['Símbolo', 'o'];
  const donde = {
    param: `Parámetro de \`${s.fn ?? '?'}\` · línea ${s.line}`,
    field: `Campo de \`${s.cls}\` · declarado en la línea ${s.line}`,
    method: `Método de \`${s.cls}\` · declarado en la línea ${s.line}`,
    enumerator: `Valor de \`${s.cls}\` · línea ${s.line}`,
    type: `Tipo definido en tu código · línea ${s.line}`,
    function: `Función definida en tu código · línea ${s.line}`,
  }[s.kind] ?? `${nombre} ${s.fn ? 'local' : 'global'} · declarad${g} en la línea ${s.line}`;
  const parts = ['```' + LANG.fence + '\n' + (s.decl ?? (s.type ? `${s.type} ${s.name}` : s.name)) + '\n```', donde];
  if (s.kind === 'function' || s.kind === 'method') {
    const u = (state.analysis?.units ?? []).find(x => x.name === s.name && (s.kind !== 'method' || x.class === s.cls) && x.startLine <= s.line + 3 && s.line <= x.endLine)
      ?? (state.analysis?.units ?? []).find(x => x.name === s.name && (s.kind !== 'method' || x.class === s.cls));
    if (u) parts.push(`Complejidad ciclomática **${u.cc}** (${u.grade}) · cognitiva **${u.cognitive}**${u.bigO ? ` · estimación **${u.bigO}**` : ''}`);
  }
  if (s.doc) parts.push(s.doc);
  if (s.detail) parts.push(s.detail);
  return mdLines(...parts);
}

export function registerIde(monaco, { onCommand }) {
  registerTheme(monaco);
  LANG.register?.(monaco);
  const lang = LANG.monaco;

  // ── Autocompletado ───────────────────────────────────────────────
  monaco.languages.registerCompletionItemProvider(lang, {
    triggerCharacters: LANG.triggerCharacters,
    provideCompletionItems(model, position) {
      const w = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
      const K = monaco.languages.CompletionItemKind;
      const SNIP = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
      const cat = state.catalog;
      const out = [];

      // Tras -> o :: solo tendría sentido ofrecer miembros; sin análisis de tipos, se ofrece lo mínimo útil.
      const before = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: Math.max(1, w.startColumn - 2), endLineNumber: position.lineNumber, endColumn: w.startColumn });
      if (LANG.noCompletionAfter.includes(before)) return { suggestions: [] };

      const seen = new Set();
      const text = model.getValue();
      for (const m of LANG.varRe ? text.matchAll(LANG.varRe) : []) {
        if (seen.has(m[0])) continue;
        seen.add(m[0]);
        out.push({ label: m[0], kind: K.Variable, insertText: m[0], range, sortText: '0' + m[0], detail: 'variable' });
      }
      // Lo que ha declarado el usuario y se ve aquí (el más interno primero); tras . o -> también campos y métodos
      const SK = { var: K.Variable, param: K.Variable, field: K.Field, function: K.Function, method: K.Method, type: K.Struct, alias: K.TypeParameter,
        enumerator: K.EnumMember, const: K.Constant, lambda: K.Function };
      const miembro = /(\.|->)$/.test(before);
      const propios = new Set();
      const syms = (state.analysis?.symbols ?? []).filter(s => visible(s, position.lineNumber) || (miembro && MIEMBRO.has(s.kind)))
        .sort((a, b) => (a.scope.el - a.scope.sl) - (b.scope.el - b.scope.sl));
      for (const s of syms) {
        propios.add(s.name);
        const clave = (['function', 'method', 'lambda'].includes(s.kind) ? 'fn:' : '') + s.name;
        if (seen.has(clave) || seen.has(s.name)) continue;
        seen.add(clave);
        const kind = s.kind === 'type' && /^(template\s*<.*>\s*)?enum\b/.test(s.decl ?? '') ? K.Enum : (s.kind === 'type' && /\bclass\b/.test(s.decl ?? '') ? K.Class : SK[s.kind] ?? K.Variable);
        out.push({ label: s.name, kind, insertText: s.name, range, sortText: (miembro && MIEMBRO.has(s.kind) ? '0' : '1') + s.name,
          detail: s.type ?? s.decl ?? '', documentation: mdLines(s.doc, s.detail) });
      }
      for (const u of state.analysis?.units ?? []) {
        if (u.kind === 'main' || seen.has('fn:' + u.name)) continue;
        seen.add('fn:' + u.name);
        out.push({ label: u.name, kind: u.kind === 'method' ? K.Method : K.Function, insertText: u.name, range, sortText: '1' + u.name, detail: `${u.qname} · CC ${u.cc}`, documentation: 'Definida en tu código' });
      }
      for (const [name, f] of Object.entries(cat?.functions ?? {})) {
        if (propios.has(name)) continue;
        const slots = f.p.slice(0, f.r).map((p, i) => `\${${i + 1}:${slotName(p)}}`).join(', ');
        out.push({
          label: { label: name, detail: `(${f.p.map(slotName).join(', ')})` }, kind: K.Function, range, sortText: (f.pg ? '2' : '3') + name,
          insertText: `${name}(${slots})`, insertTextRules: SNIP, detail: sigText(name, f),
          documentation: mdLines(f.d, f.o ? `Coste: **${f.o}**` : '', f.j && LANG.showJava ? `Java: \`${f.j}\`` : ''),
        });
      }
      for (const [name, c] of Object.entries(cat?.classes ?? {})) {
        if (propios.has(name)) continue;
        out.push({ label: name, kind: K.Class, insertText: name, range, sortText: '4' + name, documentation: mdLines(c.d, c.j && LANG.showJava ? `Java: \`${c.j}\`` : '') });
      }
      for (const k of KEYWORDS) out.push({ label: k, kind: K.Keyword, insertText: k, range, sortText: '5' + k });
      for (const [label, body, desc] of TEMPLATES) {
        out.push({ label, kind: K.Snippet, insertText: body, insertTextRules: SNIP, range, sortText: '0!' + label, detail: desc, documentation: 'Plantilla: ' + desc });
      }
      return { suggestions: out };
    },
  });

  // ── Hover ────────────────────────────────────────────────────────
  const OPS = LANG.ops;
  monaco.languages.registerHoverProvider(lang, {
    provideHover(model, position) {
      const contents = [];
      const cat = state.catalog;
      const line = model.getLineContent(position.lineNumber);

      // Explicación completa del diagnóstico bajo el cursor (el marcador solo trae el título)
      for (const d of diagsAt(model, position)) {
        contents.push({ value: `**${d.title}**\n\n${d.explain ?? ''}${d.hint ? `\n\n💡 ${d.hint}` : ''}${d.fixes?.length ? '\n\n_Alt+Enter: arreglo rápido_' : ''}` });
      }

      const w = model.getWordAtPosition(position);
      let range = null;
      if (w && !w.word.startsWith('$')) {
        range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
        const lower = w.word.toLowerCase();
        const f = catFn(cat, w.word);
        const user = (state.analysis?.units ?? []).find(u => u.name === w.word && u.kind !== 'main');
        const sym = symbolAt(model, position, w);
        if (sym) {
          contents.push(symbolHover(sym));
        } else if (user) {
          contents.push(mdLines(
            `\`\`\`${LANG.fence}\n${user.kind === 'method' ? user.qname : LANG.fnPrefix + user.name}\n\`\`\``,
            `Definida en tu código · complejidad ciclomática **${user.cc}** (${user.grade}) · cognitiva **${user.cognitive}**${user.bigO ? ` · estimación **${user.bigO}**` : ''}`));
        } else if (f) {
          contents.push(mdLines('```' + LANG.fence + '\n' + sigText(w.word, f) + '\n```', f.d, f.o ? `Coste: **${f.o}**` : '', f.j && LANG.showJava ? `Equivalente en Java: \`${f.j}\`` : ''));
        } else if (cat?.classes?.[w.word]) {
          const c = cat.classes[w.word];
          contents.push(mdLines(`**${w.word}**`, c.d, c.j && LANG.showJava ? `Equivalente en Java: \`${c.j}\`` : ''));
        } else if (cat?.keywords?.[w.word] ?? cat?.keywords?.[lower]) {
          contents.push(mdLines(`**${w.word}**`, cat.keywords[w.word] ?? cat.keywords[lower]));
        }
      }
      if (!contents.length) {
        for (const op of OPS) {
          let i = line.indexOf(op);
          while (i !== -1) {
            if (position.column - 1 >= i && position.column - 1 <= i + op.length && cat?.keywords?.[op]) {
              range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: i + 1, endColumn: i + 1 + op.length };
              contents.push(mdLines(`**${op}**`, cat.keywords[op]));
              break;
            }
            i = line.indexOf(op, i + 1);
          }
          if (contents.length) break;
        }
      }
      return contents.length ? { range: range ?? undefined, contents } : null;
    },
  });

  // ── Ayuda de firma al escribir "(" y "," ──────────────────────────
  monaco.languages.registerSignatureHelpProvider(lang, {
    signatureHelpTriggerCharacters: ['(', ','],
    signatureHelpRetriggerCharacters: [','],
    provideSignatureHelp(model, position) {
      const text = model.getValueInRange({ startLineNumber: Math.max(1, position.lineNumber - 30), startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column });
      let depth = 0, commas = 0, i = text.length - 1, quote = null;
      for (; i >= 0; i--) {
        const c = text[i];
        if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (')]}'.includes(c)) depth++;
        else if ('([{'.includes(c)) {
          if (depth === 0) { if (c === '(') break; return null; }
          depth--;
        } else if (c === ',' && depth === 0) commas++;
      }
      if (i < 0) return null;
      const m = text.slice(0, i).match(LANG.identRe);
      if (!m) return null;
      const full = m[1];
      const name = full.includes('.') ? full.slice(full.lastIndexOf('.') + 1) : full;
      const f = catFn(state.catalog, full) ?? catFn(state.catalog, name);
      let params, label, doc;
      if (f) {
        params = f.p; label = sigText(f === catFn(state.catalog, full) ? full : name, f); doc = f.d;
      } else {
        const u = (state.analysis?.units ?? []).find(x => x.name === name && x.kind !== 'main');
        if (!u) return null;
        const sig = u.signature ?? null;
        if (!sig) return null;
        params = sig; label = `${name}(${sig.join(', ')})`;
      }
      const start = label.indexOf('(') + 1;
      let pos = start;
      const parameters = params.map(p => {
        const at = label.indexOf(p, pos);
        pos = at + p.length;
        return { label: [at, at + p.length] };
      });
      const hasVariadic = params.length && params[params.length - 1].includes('...');
      const active = Math.min(commas, Math.max(0, params.length - 1));
      return {
        value: { signatures: [{ label, parameters, documentation: doc ? { value: doc } : undefined }], activeSignature: 0, activeParameter: hasVariadic ? Math.min(commas, params.length - 1) : active },
        dispose() {},
      };
    },
  });

  // ── CodeLens: complejidad y pruebas sobre cada función ──────────
  const lensCommand = 'pg.showAnalysis';
  monaco.editor.registerCommand(lensCommand, (_accessor, name) => onCommand('analysis', name));
  monaco.languages.registerCodeLensProvider(lang, {
    onDidChange(listener) { lensListeners.add(listener); return { dispose: () => lensListeners.delete(listener) }; },
    provideCodeLenses(model) {
      const lenses = [];
      const tests = state.run?.tests ?? [];
      for (const u of state.analysis?.units ?? []) {
        if (u.kind === 'main' || u.startLine > model.getLineCount()) continue;
        const parts = [`CC ${u.cc} (${u.grade})`, `cognitiva ${u.cognitive}`];
        if (u.bigO) parts.push('~' + u.bigO);
        const mine = tests.filter(t => { const g = (t.group ?? '').replace(/\(\)$/, ''); return g.toLowerCase() === u.name.toLowerCase() || (u.class && g === u.class); });
        if (mine.length) {
          const real = mine.filter(t => t.status !== 'todo');
          const pass = mine.filter(t => t.status === 'pass').length;
          if (!real.length) parts.push('⏳ pendiente');
          else parts.push(`${pass === real.length ? '✓' : '✗'} ${pass}/${real.length}`);
        }
        lenses.push({ range: { startLineNumber: u.startLine, startColumn: 1, endLineNumber: u.startLine, endColumn: 1 }, command: { id: lensCommand, title: parts.join('  ·  '), arguments: [u.qname] } });
      }
      return { lenses, dispose() {} };
    },
    resolveCodeLens: (_m, lens) => lens,
  });

  // ── Arreglos rápidos (Alt+Enter) ──────────────────────────────────
  monaco.languages.registerCodeActionProvider(lang, {
    provideCodeActions(model, range) {
      const actions = [];
      for (const d of allDiags(model)) {
        if (!d.fixes?.length) continue;
        const sl = d.line, el = d.endLine ?? d.line;
        if (range.endLineNumber < sl || range.startLineNumber > el) continue;
        for (const fx of d.fixes) {
          actions.push({
            title: fx.title, kind: 'quickfix', isPreferred: true,
            diagnostics: [],
            edit: { edits: fx.edits.map(e => ({ resource: model.uri, versionId: undefined, textEdit: { range: { startLineNumber: e.range.sl, startColumn: e.range.sc, endLineNumber: e.range.el, endColumn: e.range.ec }, text: e.text } })) },
          });
        }
      }
      return { actions, dispose() {} };
    },
  }, { providedCodeActionKinds: ['quickfix'] });
}

// Diagnósticos por modelo (los rellena editor.js al poner marcadores)
export const diagStore = new Map(); // uri string -> {lint:[], run:[]}
const allDiags = model => { const e = diagStore.get(model.uri.toString()); return e ? [...(e.lint ?? []), ...(e.run ?? [])] : []; };
function diagsAt(model, pos) {
  return allDiags(model).filter(d => {
    const el = d.endLine ?? d.line, ec = d.endCol ?? 1000;
    if (pos.lineNumber < d.line || pos.lineNumber > el) return false;
    if (pos.lineNumber === d.line && pos.column < d.col) return false;
    if (pos.lineNumber === el && pos.column > ec) return false;
    return true;
  });
}
