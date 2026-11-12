// Máquina de estados PURA de las respuestas de una guía (sin DOM: se prueba con tests/guias/test-respuestas.js).
// Dos tipos de paso con decisión del alumno, los dos con el mismo ciclo «estado → transición → estado nuevo»:
//   pregunta {opc, why, pistas?}   comprobación con reintento: cada opción mala se marca y se descarta, aparece una pista
//                                  graduada y se puede volver a intentar. Termina al acertar o al quedar solo la correcta.
//   deriva {pregunta, opciones, correcta, razones, razonCorrecta, pistas?, revela}
//                                  re-derivación socrática: 1) predicción 2) razón 3) solo entonces se revela el paso.
// Los estados son objetos inmutables (cada transición devuelve uno nuevo; si la acción no procede, el MISMO objeto).
// `guardado(est)` / `desdeGuardado(paso, g)` convierten a/desde el registro persistible {opcion, ok, intentos}:
//   pregunta → opcion = índice de la opción final elegida · deriva → opcion = [predicción, razón]
//   ok = pregunta acertada (en el intento que sea) · deriva con predicción Y razón correctas; intentos = nº de elecciones.
// «Acierto a la primera» (lo que puntúa): pregunta con ok e intentos === 1 · deriva con resultado 'bien'.

const dentro = (xs, i) => Number.isInteger(i) && i >= 0 && i < (xs?.length ?? 0);

// ── Pregunta con reintento ───────────────────────────────────────────────────
export const nuevaPregunta = () => ({ tipo: 'p', intentos: 0, malas: [], opcion: null, ok: false, fin: false });

// El alumno elige la opción `i`. Opción ya descartada, índice inválido o pregunta terminada → sin cambios.
export function elegir(est, q, i) {
  if (est.fin || !dentro(q.opc, i) || est.malas.includes(i)) return est;
  const intentos = est.intentos + 1;
  if (q.opc[i].ok) return { ...est, intentos, opcion: i, ok: true, fin: true };
  const malas = [...est.malas, i];
  // Se acaban las opciones cuando solo queda la correcta: ya no hay nada que decidir, se muestra la explicación completa
  return { ...est, intentos, malas, opcion: i, ok: false, fin: malas.length >= q.opc.length - 1 };
}

// Texto de ayuda tras el último fallo (aún sin terminar): la pista que toca (una por fallo; si se acaban, la última) o, si la
// pregunta no trae `pistas`, la explicación. Terminada o sin fallos → null (al terminar se muestra `why` completo).
export function pistaDe(est, q) {
  if (est.fin || !est.malas.length) return null;
  const ps = q.pistas;
  return ps?.length ? ps[Math.min(est.malas.length, ps.length) - 1] : q.why;
}

// ── Deriva: predicción → razón → revelación ─────────────────────────────────
export const nuevaDeriva = () => ({ tipo: 'd', fase: 'pred', pred: null, razon: null, pistas: 0, fin: false, resultado: null });

// Fase 1: la predicción se compromete → pasa a pedir la razón.
export function predecir(est, D, i) {
  if (est.fase !== 'pred' || !dentro(D.opciones, i)) return est;
  return { ...est, fase: 'razon', pred: i };
}
// Atrás sin coste (un clic mal dado no debe castigar): de la fase 2 a la 1.
export function corregir(est) {
  return est.fase === 'razon' ? { ...est, fase: 'pred', pred: null } : est;
}
// Resultado del contraste: 'bien' (predicción y razón), 'razon' (predicción correcta por otra razón), 'mal' (predicción errónea).
export const veredicto = (D, pred, razon) => (pred !== D.correcta ? 'mal' : razon === D.razonCorrecta ? 'bien' : 'razon');
// Fase 2: la razón se compromete → se revela el paso (fase final, `fin`).
export function razonar(est, D, j) {
  if (est.fase !== 'razon' || !dentro(D.razones, j)) return est;
  return { ...est, fase: 'revela', razon: j, fin: true, resultado: veredicto(D, est.pred, j) };
}
// Pista bajo demanda (no revela el resultado): la siguiente de `D.pistas`, solo antes de la revelación.
export function pedirPista(est, D) {
  if (est.fin || est.pistas >= (D.pistas?.length ?? 0)) return est;
  return { ...est, pistas: est.pistas + 1 };
}
export const pistaPedida = (est, D) => (est.pistas ? D.pistas[est.pistas - 1] : null);

// ── Común ────────────────────────────────────────────────────────────────────
export const tipoDe = paso => (paso.deriva ? 'd' : paso.pregunta ? 'p' : null);
export const nuevo = paso => (paso.deriva ? nuevaDeriva() : paso.pregunta ? nuevaPregunta() : null);

// Registro persistible de un estado TERMINADO ({opcion, ok, intentos}); null si aún no terminó
export function guardado(est) {
  if (!est?.fin) return null;
  return est.tipo === 'd' ? { opcion: [est.pred, est.razon], ok: est.resultado === 'bien', intentos: 1 }
    : { opcion: est.opcion, ok: est.ok, intentos: est.intentos };
}
// Estado terminado a partir de un registro guardado (null si el registro no encaja con el paso: se ignora)
export function desdeGuardado(paso, g) {
  if (!g || typeof g !== 'object') return null;
  if (paso.deriva) {
    const D = paso.deriva, [pred, razon] = Array.isArray(g.opcion) ? g.opcion : [];
    if (!dentro(D.opciones, pred) || !dentro(D.razones, razon)) return null;
    return { ...nuevaDeriva(), fase: 'revela', pred, razon, fin: true, resultado: veredicto(D, pred, razon) };
  }
  if (paso.pregunta) {
    const opc = paso.pregunta.opc, i = g.opcion, intentos = Math.max(1, g.intentos | 0 || 1);
    if (!dentro(opc, i)) return null;
    const ok = !!opc[i].ok; // la verdad la dicta el dato del paso, no el registro (el contenido puede haber cambiado)
    return { ...nuevaPregunta(), intentos, opcion: i, ok, malas: ok ? [] : [i], fin: true };
  }
  return null;
}

export const aciertoPrimero = est => !!est?.fin && (est.tipo === 'd' ? est.resultado === 'bien' : est.ok && est.intentos === 1);

// Puntuación de la guía: preguntas + derivas acertadas a la primera / total de preguntas + derivas.
// `estados` = mapa índice de paso → estado (las que faltan cuentan como sin responder).
export function puntuacion(pasos, estados) {
  let ok = 0, total = 0;
  pasos.forEach((p, i) => { if (tipoDe(p)) { total++; if (aciertoPrimero(estados[i])) ok++; } });
  return { ok, total };
}
