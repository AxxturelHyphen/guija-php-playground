// Formato de una referencia bibliográfica (`fuentes` de una guía): texto → HTML seguro.
// Escapa todo, convierte *…* en cursiva (APA 7) y los enlaces http(s) en <a target=_blank rel=noopener>.
// Solo esquemas http/https: nada más se vuelve enlace. Módulo puro (se prueba con Node: tests/guias/test-fuentes.js).
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
const cursiva = s => esc(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

export function fuenteHtml(texto) {
  const t = String(texto ?? ''), re = /\bhttps?:\/\/[^\s<>"]+/gi;
  let out = '', i = 0, m;
  while ((m = re.exec(t))) {
    let url = m[0], cola = '';
    // la puntuación final de la frase no es parte del enlace
    const p = /[.,;:!?)\]*]+$/.exec(url);
    if (p) { cola = p[0]; url = url.slice(0, -cola.length); }
    out += cursiva(t.slice(i, m.index));
    out += url.length > 8 ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>` : esc(url);
    out += cursiva(cola);
    i = m.index + m[0].length;
  }
  return out + cursiva(t.slice(i));
}
