// Utilidades pequeñas compartidas por todos los módulos.

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/** Crea un elemento: el('div', {class:'x', onclick: fn}, 'texto', otroNodo) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Markdown mínimo y seguro: `código`, **negrita**, *cursiva* y saltos de línea. */
export function md(text) {
  return esc(text)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:]|$)/g, '$1<i>$2</i>')
    .replace(/\n/g, '<br>');
}

export const store = {
  get(k, fallback = null) { try { const v = localStorage.getItem(k); return v === null ? fallback : v; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado o sin espacio */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nada */ } },
  json(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
};

export const debounce = (fn, ms) => {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(t);
  return d;
};

/** Número con separador de miles español: 10.000 */
export const num = n => Number(n).toLocaleString('es-ES');

/** Milisegundos legibles: 0,4 µs · 12 ms · 1,25 s */
export function fmtMs(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  if (ms < 0.001) return '<1 µs';
  if (ms < 1) { const us = ms * 1000; return us.toLocaleString('es-ES', { maximumFractionDigits: us < 10 ? 1 : 0 }) + ' µs'; }
  if (ms < 1000) return ms.toLocaleString('es-ES', { maximumFractionDigits: ms < 10 ? 1 : 0 }) + ' ms';
  return (ms / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' s';
}

export function fmtBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' KB';
  return (b / 1048576).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' MB';
}

let toastRoot;
export function toast(text, kind = '', ms = 3200) {
  toastRoot ??= $('#toasts');
  const t = el('div', { class: 'toast ' + kind, role: 'status' }, text);
  toastRoot.append(t);
  setTimeout(() => t.remove(), ms);
}

export const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
