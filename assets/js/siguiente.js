// Tarjeta «Siguiente paso»: UNA acción obvia (la que decide progreso.siguientePaso). La usan la pantalla de inicio y el IDE.
// Su hueco está reservado por CSS (.sig), así que rellenarla o cambiarla nunca mueve el resto de la página.
import { el } from './util.js';
import * as P from './progreso.js';

const ETIQUETA = { ejercicio: 'Abrir ejercicio', guia: 'Continuar guía', repaso: 'Repasar' };

/**
 * Pinta la tarjeta en `host` y la mantiene al día cuando cambia el progreso (también desde otra pestaña).
 *   lang          lenguaje a proponer si todavía no hay lección en curso
 *   alAbrir       el IDE abre los ejercicios de su lenguaje sin recargar la página (el resto navega con el enlace)
 *   nuevaPestana  las guías se abren en otra pestaña (así el IDE conserva su estado)
 *   vacio         qué mostrar si no hay ningún paso conocido: {titulo, detalle, url?, etiqueta?}
 * @returns {() => void} función para dejar de escuchar
 */
export function montarSiguiente(host, { lang, alAbrir = null, nuevaPestana = false, vacio = null } = {}) {
  host.classList.add('sig');
  host.setAttribute('aria-label', 'Siguiente paso');
  let ultima = null;

  function pintar() {
    const s = P.siguientePaso({ lang }) ?? (vacio ? { tipo: 'vacio', ...vacio } : null);
    const clave = JSON.stringify(s);
    if (clave === ultima) return;   // sin cambios: no se toca el DOM
    ultima = clave;
    if (!s) { host.replaceChildren(); host.classList.remove('is-ready'); return; }
    const url = s.url ?? null;
    const ir = e => {
      if (!alAbrir || !url) return;
      const u = new URL(url, location.origin);
      if (u.pathname === '/' + lang && u.searchParams.get('l') && u.searchParams.get('e')) {
        e.preventDefault();
        alAbrir({ leccion: u.searchParams.get('l'), clave: u.searchParams.get('e') });
      }
    };
    const abreFuera = nuevaPestana && s.tipo === 'guia';
    host.replaceChildren(
      el('span', { class: 'sig-kicker' }, 'Siguiente paso'),
      el('b', { class: 'sig-t', title: s.titulo }, s.titulo),
      el('span', { class: 'sig-d', title: s.detalle }, s.detalle),
      url ? el('a', { class: 'btn btn-primary sig-go', href: url, onclick: ir, ...(abreFuera ? { target: '_blank', rel: 'noopener' } : {}) }, s.etiqueta ?? ETIQUETA[s.tipo] ?? 'Abrir') : null);
    host.classList.add('is-ready');
  }

  pintar();
  return P.alCambiar(pintar);
}
