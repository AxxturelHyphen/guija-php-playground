// Pantalla de inicio: rellena cada tarjeta con lo que hay instalado (versión, lo que falta y cómo instalarlo).
import { $, $$, el, md, store } from './util.js';
import { api } from './api.js';
import { montarSiguiente } from './siguiente.js';
import * as P from './progreso.js';

const cards = Object.fromEntries($$('.lang-card').map(c => [c.dataset.lang, c]));

const last = store.get('pg:lastLang');
if (cards[last]) {
  cards[last].classList.add('is-last');
  $('[data-last]', cards[last]).hidden = false;
  cards[last].focus();
}

function render(langs) {
  for (const l of langs) {
    const card = cards[l.id];
    if (!card) continue;
    const status = $('[data-status]', card);
    const missing = $('[data-missing]', card);
    card.classList.toggle('is-off', !l.ok);
    const lessons = l.lessons ? ` · ${l.lessons} lecciones` : '';
    status.textContent = l.ok ? `✓ ${l.name} ${l.version ?? ''}${lessons}` : `✗ ${l.version ? l.name + ' ' + l.version + ', pero' : ''} falta algo para usarlo`;
    status.className = 'lang-status ' + (l.ok ? 'ok' : 'err');
    const items = [...(l.missing ?? []).map(m => ({ t: `**${m.what}**: ${m.how}`, cls: 'err' })), ...(l.notes ?? []).map(n => ({ t: n, cls: 'note' }))];
    missing.hidden = !items.length;
    missing.replaceChildren(...items.map(i => el('span', { class: 'lang-item ' + i.cls, html: md(i.t) })));
  }
}

api('langs').then(r => render(r.langs)).catch(e => {
  for (const c of Object.values(cards)) $('[data-status]', c).textContent = 'No hay conexión con el servidor: ' + e.message;
});

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const id = ['php', 'python', 'java', 'cpp'][Number(e.key) - 1];
  if (id) { store.set('pg:lastLang', id); location.href = '/' + id; }
});
for (const [id, c] of Object.entries(cards)) c.addEventListener('click', () => store.set('pg:lastLang', id));

// ── Progreso: siguiente paso, resumen del día y repaso (todo sale de progreso.js, sin esperar a la red) ──
const NOMBRES = { php: 'PHP', python: 'Python', java: 'Java', cpp: 'C++' };
const lang = cards[last] ? last : 'cpp';
montarSiguiente($('#siguiente'), {
  lang,
  vacio: { titulo: `Empieza por ${NOMBRES[lang]}`, detalle: 'Primera lección: de lo que ya sabes al lenguaje nuevo.', url: '/' + lang, etiqueta: 'Empezar' },
});
// El temario se guarda en caché para proponer el siguiente ejercicio sin abrir antes el IDE; solo se pide si falta o es viejo
if (P.temarioEdad(lang) > 6 * 3_600_000) api('temario', { params: { lang } }).then(r => P.registrarTemario(lang, r.lessons)).catch(() => {});

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
function pintarHoy() {
  const s = P.sesionHoy();
  const t = s.actividad || s.racha ? `Hoy: ${plural(s.ejercicios, 'ejercicio', 'ejercicios')}${s.pasos ? ' · ' + plural(s.pasos, 'paso', 'pasos') + ' de guía' : ''} · racha de ${plural(s.racha, 'día', 'días')}` : '';
  if ($('#hoy').textContent !== t) $('#hoy').textContent = t;
}

const repasoSec = $('#repaso'), repasoLista = $('#repaso-lista');
function pintarRepaso(foco = -1) {
  const items = P.repasoHoy(5);
  repasoSec.hidden = !items.length;
  if (!items.length) {
    repasoLista.replaceChildren();
    if (foco >= 0) $('#siguiente a')?.focus();   // se resolvió el último: el foco pasa a la acción siguiente, no se pierde
    return;
  }
  const resolver = (i, ok, n) => { P.repasoResultado(i.id, ok); pintarRepaso(n); };
  repasoLista.replaceChildren(...items.map((i, n) => el('li', { class: 'repaso-item' },
    el('a', { class: 'repaso-link', href: i.url }, el('span', { class: 'repaso-t' }, i.titulo), el('span', { class: 'muted repaso-d' }, (i.tipo === 'guia' ? 'Pregunta de guía' : 'Ejercicio') + ' · caja ' + i.caja + (i.atraso ? ` · ${plural(i.atraso, 'día', 'días')} de retraso` : ''))),
    el('button', { class: 'btn btn-sm', type: 'button', title: 'Lo recordé: tardará más en volver', onclick: () => resolver(i, true, n) }, 'Lo recordé'),
    el('button', { class: 'btn btn-sm', type: 'button', title: 'No me salió: volverá mañana', onclick: () => resolver(i, false, n) }, 'Otra vez'))));
  if (foco >= 0) (repasoLista.querySelectorAll('.repaso-link')[Math.min(foco, items.length - 1)] ?? repasoLista.previousElementSibling)?.focus();
}
P.alCambiar(() => { pintarHoy(); pintarRepaso(); });
pintarHoy();
pintarRepaso();
