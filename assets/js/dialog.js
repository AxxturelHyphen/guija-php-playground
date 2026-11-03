// Diálogos modales sencillos (sustituyen a confirm/prompt del navegador, que rompen el flujo del IDE).
import { el, $, md } from './util.js';

function open(title, body, buttons, { wide = false, onOpen } = {}) {
  return new Promise(resolve => {
    const root = $('#modal-root');
    const previous = document.activeElement;
    const close = value => { back.remove(); document.removeEventListener('keydown', onKey, true); previous?.focus?.(); resolve(value); };
    // Un botón cuyo value() devuelve undefined no cierra el diálogo (validación fallida)
    const pick = b => { const v = typeof b.value === 'function' ? b.value() : b.value; if (v !== undefined) close(v); };
    const foot = el('div', { class: 'mfoot' }, buttons.map(b =>
      el('button', { class: 'btn ' + (b.primary ? 'btn-primary' : ''), onclick: () => pick(b) }, b.label)));
    const modal = el('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('h2', {}, title), el('div', { class: 'mbody' }, body), foot);
    const back = el('div', { class: 'modal-back', onmousedown: e => { if (e.target === back) close(null); } }, modal);
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !(e.target.tagName === 'BUTTON')) {
        const primary = buttons.find(b => b.primary);
        if (primary) { e.preventDefault(); pick(primary); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    root.append(back);
    (onOpen?.(modal) ?? $('.btn-primary', modal) ?? $('button', foot))?.focus();
  });
}

/** Sí/No. Devuelve true/false. */
export function confirmDialog(title, message, { ok = 'Aceptar', cancel = 'Cancelar', danger = false } = {}) {
  const body = el('div', { html: md(message) });
  return open(title, body, [{ label: cancel, value: false }, { label: ok, value: true, primary: true }]).then(v => v === true);
}

/** Pide un texto. Devuelve el texto o null. */
export function promptDialog(title, message, value = '', { ok = 'Aceptar', validate } = {}) {
  const input = el('input', { type: 'text', value, spellcheck: 'false', autocomplete: 'off' });
  const err = el('div', { class: 'muted', style: 'color:var(--red);min-height:1.4em;margin-top:4px' });
  const body = el('div', {}, el('div', { html: md(message) }), el('div', { style: 'margin-top:8px' }, input), err);
  const accept = () => {
    const msg = validate?.(input.value);
    if (msg) { err.textContent = msg; input.focus(); return undefined; }  // undefined = no cerrar
    return input.value;
  };
  return open(title, body, [
    { label: 'Cancelar', value: null },
    { label: ok, value: accept, primary: true },
  ], { onOpen: () => { input.select(); return input; } });
}

/** Contenido libre con un botón Cerrar. */
export function infoDialog(title, content, { wide = true } = {}) {
  return open(title, content, [{ label: 'Cerrar', value: true, primary: true }], { wide });
}

/** Contenido con botones propios: devuelve el value del pulsado. */
export function choiceDialog(title, message, choices) {
  return open(title, el('div', { html: md(message) }), choices);
}
