// Pantalla de inicio: rellena cada tarjeta con lo que hay instalado (versión, lo que falta y cómo instalarlo).
import { $, $$, el, md, store } from './util.js';
import { api } from './api.js';

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
