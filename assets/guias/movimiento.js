// Movimiento compartido por las escenas de las guías. Tres piezas pequeñas, sin dependencias:
//
//   tarea(fn)         UN único requestAnimationFrame para todas las escenas. fn(now, dt) devuelve true mientras siga viva;
//                     devuelve la función de cancelación. El rAF solo existe mientras hay tareas (sin bucle ocioso).
//   Muelle            oscilador críticamente amortiguado (sin rebote), integración EXACTA: estable con cualquier dt.
//                     Es lo que hace que arrastrar o cambiar de objetivo a mitad de movimiento sea suave: conserva la
//                     velocidad (una transición por tiempo con easing la reinicia y se nota «a tirones»).
//   seguir(ms, pintar) anima una lista de Muelle hasta que todos están quietos; pintar() se llama una vez por fotograma.
//   trazo(path)       dibuja un <path> SVG progresivamente (stroke-dashoffset).
//
// REGLAS (prioridad nº 1 = fluidez): en el DOM solo transform/opacity; en SVG solo atributos de geometría; nada de leer
// layout (getBoundingClientRect…) dentro de una tarea; respetar REDUCIDO (sin movimiento → salto directo al valor final).
// Lo puro (ease, Muelle) no toca el DOM al importar: se prueba en Node (tests/guias/test-movimiento.js).

export const REDUCIDO = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - (1 - t) ** 3;

// ── Planificador ────────────────────────────────────────────────────────────
const tareas = new Set();
let raf = 0, ult = 0;
function tic(now) {
  raf = 0;
  const dt = Math.min(.05, (now - ult) / 1000) || 1 / 60; // tope: tras una pestaña en segundo plano no hay salto gigante
  ult = now;
  for (const f of tareas) if (!f(now, dt)) tareas.delete(f);
  if (tareas.size) raf = requestAnimationFrame(tic);
}
export function tarea(fn) {
  tareas.add(fn);
  if (!raf) { ult = performance.now(); raf = requestAnimationFrame(tic); }
  return () => tareas.delete(fn);
}

// ── Muelle críticamente amortiguado ─────────────────────────────────────────
// w = frecuencia natural en rad/s (≈ 1/tiempo de respuesta): 10 lento y suave, 16 por defecto, 28 casi inmediato.
export class Muelle {
  constructor(x = 0, w = 16, eps = 1e-3) { this.x = this.a = x; this.v = 0; this.w = w; this.eps = eps; }
  ir(a) { this.a = a; return this; }                            // nuevo objetivo, conserva posición y velocidad
  salto(a) { this.x = this.a = a; this.v = 0; return this; }    // sin animar (REDUCIDO, reconstrucciones)
  get quieto() { return Math.abs(this.a - this.x) < this.eps && Math.abs(this.v) < this.eps * 8; }
  paso(dt) {
    const w = this.w, d = this.x - this.a, c = this.v + w * d, e = Math.exp(-w * dt);
    this.x = this.a + (d + c * dt) * e;
    this.v = (this.v - w * c * dt) * e;
    if (this.quieto) this.salto(this.a);
    return this.x;
  }
}

// Anima `ms` (Muelle[]) hasta el reposo; `pintar()` se llama una vez por fotograma y una última vez ya en reposo.
// Si el objetivo vuelve a cambiar mientras corre no hace falta llamar otra vez; si ya terminó, sí (devuelve su cancelación).
export function seguir(ms, pintar) {
  return tarea((_, dt) => {
    let vivo = false;
    for (const m of ms) if (!m.quieto) { m.paso(dt); vivo = vivo || !m.quieto; }
    pintar();
    return vivo;
  });
}

// ── Trazo que se dibuja ─────────────────────────────────────────────────────
// Solo para trazos continuos: pathLength=1 reescala las unidades de cualquier stroke-dasharray del CSS.
export function trazo(path, ms = 600) {
  if (REDUCIDO || !path.animate) return;
  path.setAttribute('pathLength', '1'); path.style.strokeDasharray = '1';
  const a = path.animate({ strokeDashoffset: [1, 0] }, { duration: ms, easing: 'cubic-bezier(.2,.7,.2,1)' });
  const fin = () => { path.style.strokeDasharray = ''; path.removeAttribute('pathLength'); };
  a.onfinish = fin; a.oncancel = fin;
}
