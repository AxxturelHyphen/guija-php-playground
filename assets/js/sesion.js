// Sesiones cortas: temporizador discreto (10/15/25 min) y meta del día. Sin sonido, sin parpadeos y sin animaciones.
// El estado (marca de fin) vive en progreso.js, así que sobrevive a recargas y no deriva. UN solo setInterval de 1 s,
// que solo existe mientras el temporizador corre; el resto del tiempo no hay nada en marcha. Nada de rAF.
import { $ } from './util.js';
import * as P from './progreso.js';

const pad = n => String(n).padStart(2, '0');
/** 24:07 · 1:05:00 (cifras tabulares por CSS: el ancho no baila) */
function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ':' + pad(m) : m) + ':' + pad(s % 60);
}
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function initSesion() {
  const host = $('#sesion');
  if (!host) return;
  const meta = $('#ses-meta'), dur = $('#ses-dur'), time = $('#ses-time'), go = $('#ses-go'), stop = $('#ses-stop'), aviso = $('#ses-aviso');
  let intervalo = 0;

  const set = (nodo, k, v) => { if (nodo[k] !== v) nodo[k] = v; };   // solo se escribe si cambia

  function pintarMeta() {
    const s = P.sesionHoy();
    set(meta, 'textContent', (s.metaCumplida ? '✓ ' : '○ ') + '1 ejercicio hoy');
    meta.classList.toggle('done', s.metaCumplida);
    meta.title = `Hoy: ${plural(s.ejercicios, 'ejercicio', 'ejercicios')} · ${plural(s.pasos, 'paso', 'pasos')} de guía · racha de ${plural(s.racha, 'día', 'días')}`;
  }

  function pintar() {
    const t = P.temporizador();
    const q = t.estado;
    set(time, 'textContent', fmt(q === 'parado' ? Number(dur.value) * 60_000 : t.resta));
    set(go, 'textContent', q === 'corriendo' ? 'Pausa' : q === 'pausa' ? 'Seguir' : 'Empezar');
    go.setAttribute('aria-label', q === 'corriendo' ? 'Pausar la sesión' : q === 'pausa' ? 'Reanudar la sesión' : `Empezar una sesión de ${dur.value} minutos`);
    stop.classList.toggle('off', q === 'parado');
    stop.tabIndex = q === 'parado' ? -1 : 0;
    stop.setAttribute('aria-hidden', q === 'parado' ? 'true' : 'false');
    dur.disabled = q !== 'parado';
    const min = String(t.dur / 60_000);
    if (q !== 'parado' && min !== dur.value && [...dur.options].some(o => o.value === min)) dur.value = min;
    time.dataset.estado = q;
    // Aviso de fin: en línea, bajo el temporizador; no tapa el editor ni mueve nada
    if (q === 'fin' && aviso.hidden) {
      const s = P.sesionHoy();
      $('.ses-aviso-t', aviso).textContent = `Sesión de ${min} min terminada. Buen momento para una pausa de 5 minutos: levántate, bebe agua, mira a lo lejos.`;
      $('.ses-aviso-d', aviso).textContent = `Hoy: ${plural(s.ejercicios, 'ejercicio', 'ejercicios')}` + (s.pasos ? ` · ${plural(s.pasos, 'paso', 'pasos')} de guía` : '') + ` · racha de ${plural(s.racha, 'día', 'días')}.`;
      aviso.hidden = false;
    } else if (q !== 'fin' && !aviso.hidden) aviso.hidden = true;
    ciclo(q);
  }

  // El reloj solo corre mientras hay algo que contar
  function ciclo(q) {
    if (q === 'corriendo' && !intervalo) intervalo = setInterval(pintar, 1000);
    else if (q !== 'corriendo' && intervalo) { clearInterval(intervalo); intervalo = 0; }
  }

  go.addEventListener('click', () => {
    const q = P.temporizador().estado;
    if (q === 'corriendo') P.temporizadorPausar();
    else if (q === 'pausa') P.temporizadorReanudar();
    else P.temporizadorIniciar(Number(dur.value));
    pintar();
  });
  stop.addEventListener('click', () => { P.temporizadorParar(); pintar(); go.focus({ preventScroll: true }); });
  $('#ses-ok', aviso).addEventListener('click', () => { P.temporizadorParar(); pintar(); });
  dur.addEventListener('change', pintar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pintar(); });   // al volver a la pestaña se resincroniza al instante
  P.alCambiar(() => { pintarMeta(); pintar(); });
  pintarMeta();
  pintar();
}
