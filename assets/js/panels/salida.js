// Panel Salida: lo que imprime el programa, con los errores explicados justo donde ocurrieron.
import { $, el, fmtMs, fmtBytes } from '../util.js';
import { state, on } from '../state.js';
import { registerPanel } from '../panels.js';
import { diagCard } from '../diagcard.js';
import { LANG } from '../lang.js';

const root = () => $('#panel-salida');

function render() {
  const r = state.run;
  const host = root();
  host.replaceChildren(stdinBox());

  if (state.busy === 'run' || state.busy === 'measure') {
    host.append(el('div', { class: 'placeholder' }, state.busy === 'measure' ? 'Midiendo… (puede tardar unos segundos)' : 'Ejecutando…'));
    return;
  }
  if (!r) {
    host.append(el('div', { class: 'placeholder' }, 'Pulsa Ctrl+Enter para ejecutar. Aquí verás la salida y los errores explicados en español.'));
    renderMeta(null);
    return;
  }

  let pre = null;
  let firstErr = true;
  for (const seg of r.segments) {
    if (seg.t === 'out') {
      if (!pre) { pre = el('pre', { class: 'out-pre' }); host.append(pre); }
      pre.append(document.createTextNode(seg.text));
    } else if (seg.t === 'diag') {
      pre = null;
      const open = seg.diag.severity === 'error' ? firstErr : true;
      if (seg.diag.severity === 'error') firstErr = false;
      host.append(diagCard(seg.diag, { open }));
    } else if (seg.t === 'note') {
      pre = null;
      host.append(el('div', { class: 'out-note' }, seg.text));
    } else if (seg.t === 'img') {
      // Gráficas (matplotlib en Python): llegan como PNG/SVG en base64 y se muestran donde se dibujaron
      pre = null;
      host.append(el('figure', { class: 'out-img' }, el('img', { src: `data:${seg.mime};base64,${seg.data}`, alt: seg.title || 'gráfica', loading: 'lazy' }),
        seg.title ? el('figcaption', {}, seg.title) : null));
    }
  }
  if (!r.segments.length) host.append(el('div', { class: 'placeholder' }, '(el programa terminó sin imprimir nada)'));
  renderMeta(r);
}

function stdinBox() {
  const ta = el('textarea', { rows: 3, placeholder: LANG.stdinHint, 'aria-label': 'Entrada estándar', spellcheck: 'false' });
  ta.value = state.stdin;
  ta.addEventListener('input', () => { state.stdin = ta.value; });
  return el('details', { class: 'stdin-box', open: state.stdin ? true : null }, el('summary', {}, 'Entrada (STDIN)'), ta);
}

function renderMeta(r) {
  const m = $('#run-meta');
  if (!r) { m.replaceChildren(); return; }
  const ts = r.testSummary ?? { fail: 0, error: 0 };
  const bad = r.killed || r.exit !== 0 || r.problems.some(p => p.severity === 'error') || ts.fail + ts.error > 0;
  m.replaceChildren(
    el('span', { class: bad ? 'err' : 'ok' }, bad ? (ts.fail + ts.error > 0 && !r.problems.some(p => p.severity === 'error') ? '✕ pruebas fallidas' : '✕ con errores') : '✓ correcto'),
    el('span', {}, fmtMs(r.ms)),
    r.peak ? el('span', { title: 'Memoria pico' }, fmtBytes(r.peak)) : null,
    el('span', { title: 'Código de salida' }, 'exit ' + r.exit));
}

registerPanel('salida', { onShow: render });
on('run', render);
on('busy', render);
on('clear', () => { state.run = null; render(); });
render();
