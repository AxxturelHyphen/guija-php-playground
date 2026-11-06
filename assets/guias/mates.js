// Fórmulas y texto con formato para las guías. Un único dueño de KaTeX (autoalojado en assets/vendor/katex) que comparten
// guia.js (textos, preguntas, lecturas) y las escenas (etiquetas de ejes, curvas, nodos…).
//
//   await iniciarKatex()   carga CSS + JS + fuentes principales; guia.js lo llama ANTES del primer paso y solo si la guía
//                          lleva fórmulas, así todo `$…$` se renderiza de forma síncrona (sin parpadeo ni saltos de maquetación)
//   fmt(s)                 texto del paso → HTML seguro: `código`, $fórmula$ (KaTeX), **negrita**, *cursiva*
//   mate(t)                HTML de una fórmula (caché por cadena); si es inválida o no hay KaTeX, el texto escapado
//   etiqueta(el, s)        pone `s` en `el` con el camino más barato: textContent si no lleva `$`, fmt() si lleva
//
// RENDIMIENTO: renderToString es lo único caro y se hace UNA vez por cadena distinta (Map). Las escenas deben llamar a
// etiqueta() solo cuando el texto cambia, nunca en cada fotograma.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = s => s.replace(/[&<>"]/g, c => ESC[c]);

const KATEX = '/assets/vendor/katex/';
let katex;
const mates = new Map();
export const mate = t => {
  let h = mates.get(t);
  if (h === undefined) {
    try { h = katex.renderToString(t, { throwOnError: true }); } catch { h = `<span class="tex-raw">${esc(t)}</span>`; } // fórmula inválida o sin KaTeX: se ve el texto
    h = `<span class="tex">${h}</span>`; mates.set(t, h);
  }
  return h;
};

const cargarCss = href => new Promise((ok, ko) => document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href, onload: ok, onerror: ko })));
const cargarJs = src => new Promise((ok, ko) => document.head.append(Object.assign(document.createElement('script'), { src, onload: ok, onerror: ko })));
export async function iniciarKatex() {
  try {
    await Promise.all([cargarCss(KATEX + 'katex.min.css'), cargarJs(KATEX + 'katex.min.js')]);
    katex = window.katex;
    // Fuentes principales listas antes de pintar (font-display: block ocultaría las fórmulas un instante); con tope para no bloquear
    await Promise.race([Promise.all(['1em KaTeX_Main', 'italic 1em KaTeX_Math', '1em KaTeX_Size1'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]);
  } catch { /* sin KaTeX las fórmulas se ven como texto: la guía sigue siendo usable */ }
}

// Texto del paso → HTML seguro. Código y fórmulas se apartan antes de escapar y de aplicar negrita/cursiva (llevan `*` y `_`).
export const fmt = s => {
  const guardado = [];
  const aparta = h => { guardado.push(h); return `\u0000${guardado.length - 1}\u0000`; };
  return String(s)
    .replace(/`([^`]+)`/g, (_, c) => aparta(`<code>${esc(c)}</code>`))
    .replace(/\$([^$]+)\$/g, (_, t) => aparta(mate(t)))
    .replace(/[&<>"]/g, c => ESC[c])
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => guardado[i]);
};

export const etiqueta = (el, s) => { s = String(s); if (s.includes('$')) el.innerHTML = fmt(s); else el.textContent = s; };
