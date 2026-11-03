// Panel Análisis: complejidad ciclomática y cognitiva por función, estimación de O() y mediciones reales de medir().
import { $, el, fmtMs, num } from '../util.js';
import { state, on } from '../state.js';
import { ctx } from '../ctx.js';
import { registerPanel, setCount } from '../panels.js';
import { renderChart } from '../chart.js';
import { LANG } from '../lang.js';

const CC_RULE = LANG.ccRule +
  'Es el número mínimo de pruebas para recorrer todos los caminos. Nota: 1-5 A, 6-10 B, 11-20 C, 21-30 D, 31-40 E, 41+ F.';
const COG_RULE = 'Complejidad cognitiva (Sonar): como la ciclomática pero penaliza el anidamiento (un if dentro de un for dentro de un if cuesta más que tres if seguidos). Mide lo difícil que es de leer.';
const BIGO_RULE = 'Estimación estática a partir de los bucles anidados, el coste de las funciones nativas y la recursión. Es una pista, no una prueba: la cifra real la da «Medir» (medir() en tu código).';

const ccColor = cc => (cc <= 10 ? 'var(--green)' : cc <= 20 ? 'var(--yellow)' : 'var(--red)');

function render() {
  const host = $('#panel-analisis');
  host.replaceChildren();
  const a = state.analysis;
  if (!a) { host.append(el('div', { class: 'placeholder' }, 'El análisis aparece aquí en cuanto escribes código.')); setCount('analisis', ''); return; }

  const s = a.summary;
  const units = a.units.filter(u => u.kind !== 'main');
  setCount('analisis', units.length ? 'CC ' + s.ccMax : '', s.ccMax > 20 ? 'err' : s.ccMax > 10 ? 'warn' : '');

  host.append(el('div', { class: 'cards' },
    card('Líneas de código', num(s.loc), `${s.functions} funciones/métodos`),
    card('CC media', String(s.ccAvg), `nota ${s.grade}`, 'Complejidad ciclomática media por función'),
    card('CC máxima', String(s.ccMax), s.worst ?? '—'),
    card('Anidamiento máx.', String(s.maxNesting), 'niveles de bloques')));

  if (!a.units.length) { host.append(el('div', { class: 'placeholder' }, 'Sin código que analizar.')); return; }

  const head = el('tr', {}, el('th', {}, 'Función'), el('th', { class: 'num' }, 'Líneas'), el('th', { class: 'num' }, 'Parám.'),
    el('th', { class: 'num' }, el('span', { class: 'help-tip', title: CC_RULE }, 'Ciclomática')),
    el('th', { class: 'num' }, el('span', { class: 'help-tip', title: COG_RULE }, 'Cognitiva')),
    el('th', { class: 'num' }, 'Anid.'),
    el('th', {}, el('span', { class: 'help-tip', title: BIGO_RULE }, 'O() estimado')));
  const rows = a.units.map(u => el('tr', { class: 'clickable', title: 'Ir a la función', onclick: () => ctx.editor.reveal(u.startLine) },
    el('td', {}, el('span', { class: 'fn-name' }, u.kind === 'main' ? 'código suelto' : u.qname + (u.kind === 'main' ? '' : '()'))),
    el('td', { class: 'num' }, String(u.loc)),
    el('td', { class: 'num' }, u.kind === 'main' ? '—' : String(u.params)),
    el('td', { class: 'num' }, el('div', { class: 'cc-cell' },
      el('span', {}, String(u.cc)),
      el('div', { class: 'cc-bar' }, el('i', { style: `width:${Math.min(100, (u.cc / 30) * 100)}%;background:${ccColor(u.cc)}` })),
      el('span', { class: 'grade ' + u.grade, title: 'Nota ' + u.grade }, u.grade))),
    el('td', { class: 'num' }, String(u.cognitive)),
    el('td', { class: 'num' }, String(u.nesting)),
    el('td', { class: 'bigo' }, u.bigO ? [u.bigO, u.recursive ? el('small', {}, '  recursiva') : null] : el('small', {}, '—'),
      u.bigOWhy?.length ? el('div', { class: 'muted', style: 'font:11px var(--ui);max-width:340px' }, u.bigOWhy.join(' · ')) : null)));
  host.append(el('table', { class: 'grid' }, el('thead', {}, head), el('tbody', {}, rows)));
  host.append(el('p', { class: 'note' }, 'Pasa el ratón sobre los títulos para ver cómo se calcula cada medida. Haz clic en una fila para ir a la función.'));

  benches(host);
}

function card(k, v, s, tip) {
  return el('div', { class: 'card', title: tip ?? '' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, v), el('div', { class: 's' }, s));
}

/** Mediciones reales de la última ejecución con «Medir». */
function benches(host) {
  const list = state.run?.benches ?? [];
  if (!list.length) return;
  host.append(el('div', { class: 'group-title', style: 'margin-top:18px' }, 'Mediciones reales (medir)'));
  for (const b of list) {
    const est = (state.analysis?.units ?? []).find(u => u.name === b.name)?.bigO;
    if (b.status === 'skipped') {
      host.append(el('div', { class: 'note' }, `${b.name}: pulsa «Medir» para cronometrarla con tamaños crecientes.`));
    } else if (b.status === 'todo') {
      host.append(el('div', { class: 'note' }, `${b.name}: todavía sin implementar.`));
    } else if (b.status === 'error') {
      host.append(el('div', { class: 'note', style: 'color:var(--red)' }, `${b.name}: ${b.msg}`));
    } else {
      const measured = b.label;   // null si hubo muy pocos puntos para ajustar un modelo
      const agree = est && measured && est.replace(/\s/g, '') === measured.replace(/\s/g, '');
      host.append(el('div', { class: 'sol-item' },
        el('div', { class: 'sol-head' }, el('span', { class: 'fn-name' }, b.name + '()'),
          measured ? el('span', { class: 'badge ok' }, 'medido ~' + measured) : el('span', { class: 'badge todo' }, 'pocos puntos para estimar O()'), est ? el('span', { class: 'badge ' + (agree ? 'same' : 'diff') }, (agree ? 'coincide con la estimación ' : 'estimación estática ') + est) : null,
          b.stopped !== 'done' ? el('span', { class: 'muted' }, b.stopped === 'slow' ? 'se paró al tardar >250 ms por llamada' : 'se paró al agotar el presupuesto de tiempo') : null),
        el('div', { class: 'sol-body' }, renderChart({ series: [{ name: 'tu código', label: measured ? '~' + measured : '', cls: 's1', points: b.points }], xLinear: b.scale === 'lineal', title: `Tiempo de ${b.name}` }))));
    }
  }
}

registerPanel('analisis', { onShow: render });
on('analysis', render);
on('run', render);
render();
