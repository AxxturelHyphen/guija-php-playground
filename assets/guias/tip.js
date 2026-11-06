// Tooltip DELEGADO para las escenas de las guías (barras, celdas, árbol/grafo). Un único listener por tipo de evento en
// el `stage` de la escena y UN único elemento de tooltip por escena, hijo del propio stage (así se oculta solo con la escena
// y comparte su sistema de coordenadas lógicas).
//
//   const tip = crearTip(stage, { objetivo, datos })
//     objetivo(nodo) → clave | null     qué elemento (o ninguno) representa el nodo del evento (usa .closest)
//     datos(clave)   → {x, y, y2, titulo, filas: [[etiqueta, valor], …]} | null
//                      x,y = punto de anclaje superior y y2 = inferior, en px LÓGICOS del stage (la escena los conoce por
//                      geometría: nada de medir el DOM). Si no cabe encima, el tooltip se coloca bajo y2.
//     sobre?(clave|null)  aviso opcional cuando cambia el elemento bajo el puntero/foco (p. ej. para resaltar relaciones)
//   tip.refrescar()   vuelve a pedir los datos de lo que está bajo el puntero/foco (llamar tras pintar: valores que cambian)
//   tip.pausa(b)      true mientras se arrastra: oculta y no muestra; al volver a false reaparece si el puntero sigue encima
//   tip.ocultar()
//
// RENDIMIENTO: solo pointerover/pointerout/focusin/focusout (no pointermove); el contenido se reescribe solo si cambia su
// firma; la posición es un transform; la escala del stage se lee de su style (la fija guia.js), no del layout. Los
// valores con `$…$` pasan por etiqueta() (KaTeX local con caché). En táctil no hay tooltip de puntero (sí al enfocar).
import { etiqueta } from './mates.js';

export const TIP_ANCHO = 220;
let css = false;
const CSS = `
.g-tip{position:absolute;left:0;top:0;z-index:30;width:max-content;max-width:${TIP_ANCHO}px;padding:7px 10px 8px;border:1px solid var(--line2);border-radius:var(--g-r2,6px);background:var(--cell);color:var(--text);font:12px/1.4 var(--ui);box-shadow:0 8px 22px rgba(0,0,0,.38);opacity:0;pointer-events:none;transform-origin:0 0;transition:opacity .14s ease,transform .1s ease-out;font-variant-numeric:tabular-nums}
.g-tip.v{opacity:1} .g-tip.sa{transition:opacity .14s ease}
.g-tip b{display:block;font-weight:600;font-size:12.5px;color:var(--text);margin-bottom:2px;overflow-wrap:anywhere}
.g-tip dl{display:grid;grid-template-columns:auto 1fr;gap:1px 10px;margin:0}
.g-tip dt{color:var(--faint,var(--muted))} .g-tip dd{margin:0;color:var(--muted);overflow-wrap:anywhere}
.g-tip dd.fuerte{color:var(--text)}
@media (prefers-reduced-motion:reduce){.g-tip,.g-tip.sa{transition:none}}
`;
const inyectar = () => {
  if (css || typeof document === 'undefined') return;
  css = true;
  if (document.getElementById('css-tip')) return;
  const s = document.createElement('style'); s.id = 'css-tip'; s.textContent = CSS; document.head.append(s);
};

/** Escala y desplazamiento que guia.js dejó en el stage (`scale(s)`, left, top): se leen del style, no del layout. */
export function transformaStage(stage) {
  const m = /scale\(([\d.]+)\)/.exec(stage.style.transform || ''), s = m ? +m[1] : 1;
  return { s: s > 0 ? s : 1, left: parseFloat(stage.style.left) || 0, top: parseFloat(stage.style.top) || 0 };
}

/**
 * Posición del tooltip en coordenadas lógicas. PURA (se prueba en Node). `vw` = ancho visible del panel en px de pantalla;
 * `s`, `left` = escala y desplazamiento del stage. Devuelve {x, y, arriba}: x centrado y acotado al panel, y = ancla elegida.
 * Si el ancla superior queda a menos de `alto` px de pantalla del borde, el tooltip pasa debajo (y2).
 */
export function colocarTip({ x, y, y2 }, { s = 1, left = 0, top = 0, vw = 0, alto = 90 } = {}) {
  const mitad = TIP_ANCHO / 2 + 6;
  let px = left + x * s;
  if (vw > 2 * mitad) px = Math.min(vw - mitad, Math.max(mitad, px));
  const arriba = top + y * s >= alto || y2 == null;
  return { x: (px - left) / s, y: arriba ? y : y2, arriba };
}

export function crearTip(stage, { objetivo, datos, sobre }) {
  inyectar();
  const el = document.createElement('div');
  el.className = 'g-tip'; el.setAttribute('role', 'tooltip'); el.setAttribute('aria-hidden', 'true');
  const tit = document.createElement('b'), lista = document.createElement('dl');
  el.append(tit, lista); stage.append(el);
  const T = { sobre: null, actual: null, firma: '', pausado: false, visible: false, pos: '' };

  const ocultar = () => {
    if (T.actual != null) { T.actual = null; sobre?.(null); }
    if (T.visible) { el.classList.remove('v'); T.visible = false; }
  };
  const mostrar = clave => {
    const d = clave == null || T.pausado ? null : datos(clave);
    if (!d) { ocultar(); return; }
    const firma = d.titulo + '\u0001' + d.filas.map(f => f.join('\u0002')).join('\u0001');
    if (firma !== T.firma) {
      T.firma = firma;
      etiqueta(tit, d.titulo);
      lista.replaceChildren(...d.filas.flatMap(([k, v]) => {
        const a = document.createElement('dt'), b = document.createElement('dd');
        a.textContent = k; etiqueta(b, String(v)); return [a, b];
      }));
    }
    const { s, left, top } = transformaStage(stage), p = colocarTip(d, { s, left, top, vw: stage.parentElement?.clientWidth || 0 });
    const t = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) scale(${(1 / s).toFixed(4)}) translate(-50%,${p.arriba ? 'calc(-100% - 8px)' : '8px'})`;
    if (t !== T.pos) {
      // al aparecer desde oculto el tooltip no «viaja» desde su sitio anterior: se coloca sin transición y se restaura al siguiente fotograma
      if (!T.visible) { el.classList.add('sa'); requestAnimationFrame(() => el.classList.remove('sa')); }
      el.style.transform = T.pos = t;
    }
    if (T.actual !== clave) { T.actual = clave; sobre?.(clave); }
    if (!T.visible) { el.classList.add('v'); T.visible = true; }
  };

  const desde = e => { const n = e.target; return n && n.nodeType === 1 ? objetivo(n) : null; };
  stage.addEventListener('pointerover', e => {
    if (e.pointerType === 'touch') return;
    T.sobre = desde(e);
    if (T.sobre !== T.actual) mostrar(T.sobre);
  });
  stage.addEventListener('pointerout', e => {
    const a = e.relatedTarget && e.relatedTarget.nodeType === 1 ? objetivo(e.relatedTarget) : null;
    if (a === T.sobre) return; // sigue sobre el mismo elemento (cambió de hijo)
    T.sobre = a; if (a == null) ocultar(); // si a != null, el siguiente pointerover lo muestra
  });
  stage.addEventListener('focusin', e => { const k = desde(e); if (k != null && e.target.matches?.(':focus-visible')) mostrar(k); });
  stage.addEventListener('focusout', () => { if (T.sobre == null) ocultar(); else mostrar(T.sobre); });
  return {
    el,
    refrescar() { const k = T.actual ?? T.sobre; if (k != null && !T.pausado) mostrar(k); else if (T.visible) ocultar(); },
    pausa(b) { T.pausado = !!b; if (b) ocultar(); else if (T.sobre != null) mostrar(T.sobre); },
    ocultar,
  };
}
