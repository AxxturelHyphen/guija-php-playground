// «Aparcar idea»: una nota rápida por lección (Alt+I) para soltar un pensamiento que distrae sin salir del ejercicio.
// Se guardan con progreso.js (localStorage). Enter anota y devuelve el foco al editor; Esc cierra.
import { $, el } from './util.js';
import { state, on } from './state.js';
import { ctx } from './ctx.js';
import { LANG } from './lang.js';
import * as P from './progreso.js';

export function initIdeas() {
  const btn = $('#btn-ideas'), pop = $('#ideas-pop'), input = $('#ideas-in'), list = $('#ideas-list'), n = $('#ideas-n');
  if (!btn) return;
  const lec = () => state.leccion?.id ?? 'general';

  function pintar() {
    const notas = P.notas(LANG.id, lec());
    n.textContent = String(notas.length);
    n.hidden = !notas.length;
    if (pop.hidden) return;   // la lista solo se construye si está a la vista
    list.replaceChildren(...notas.slice().reverse().map(x => el('li', {},
      el('span', { class: 'idea-t' }, x.t),
      el('button', { class: 'del', type: 'button', title: 'Borrar la idea', 'aria-label': 'Borrar la idea: ' + x.t, onclick: () => { P.notaBorrar(LANG.id, lec(), x.id); input.focus(); } }, '×'))));
    if (!notas.length) list.append(el('li', { class: 'muted vacia' }, 'Nada aparcado en esta lección.'));
  }

  const fueraDe = e => { if (!pop.contains(e.target) && !btn.contains(e.target)) cerrar(false); };
  function abrir() {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    pintar();
    input.focus();
    document.addEventListener('pointerdown', fueraDe, true);
  }
  function cerrar(devolverFoco = true) {
    if (pop.hidden) return;
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', fueraDe, true);
    if (devolverFoco) { if (ctx.editor) ctx.editor.focus(); else btn.focus(); }
  }
  const alternar = () => (pop.hidden ? abrir() : cerrar());

  btn.addEventListener('click', alternar);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (P.notaAgregar(LANG.id, lec(), input.value)) { input.value = ''; cerrar(); }
    } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
  });
  pop.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } });
  document.addEventListener('keydown', e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'i') { e.preventDefault(); alternar(); }
  });
  P.alCambiar(pintar);
  on('leccion', pintar);
  on('active', pintar);
  pintar();
}
