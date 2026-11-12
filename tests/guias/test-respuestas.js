#!/usr/bin/env node
'use strict';
/** Máquina de estados pura de preguntas (con reintento) y derivas de assets/guias/respuestas.js (sin DOM): node tests/guias/test-respuestas.js */
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
let n = 0;
const ok = (nombre, fn) => { fn(); n++; console.log('  ✓ ' + nombre); };

const t = x => ({ es: x, en: x });
const Q3 = { opc: [{ ...t('a') }, { ...t('b'), ok: 1 }, { ...t('c') }, { ...t('d') }], why: t('porque'), pistas: [t('p1'), t('p2')] }; // 4 opciones: 2 pistas
const Q2 = { opc: [{ ...t('a'), ok: 1 }, { ...t('b') }], why: t('porque') };
const D = { pregunta: t('¿?'), opciones: [t('x'), t('y'), t('z')], correcta: 1, razones: [t('r0'), t('r1')], razonCorrecta: 0, pistas: [t('h1'), t('h2')], revela: t('rev') };

(async () => {
  const R = await import(pathToFileURL(path.join(__dirname, '../../assets/guias/respuestas.js')).href);

  console.log('pregunta con reintento');
  ok('acierto a la primera: ok, fin, intentos 1, cuenta como acierto', () => {
    const e = R.elegir(R.nuevaPregunta(), Q3, 1);
    assert.deepStrictEqual([e.ok, e.fin, e.intentos, e.opcion, e.malas], [true, true, 1, 1, []]);
    assert.ok(R.aciertoPrimero(e));
    assert.deepStrictEqual(R.guardado(e), { opcion: 1, ok: true, intentos: 1 });
  });
  ok('un fallo marca la opción, no termina, da la primera pista y se puede reintentar', () => {
    const e = R.elegir(R.nuevaPregunta(), Q3, 0);
    assert.deepStrictEqual([e.ok, e.fin, e.intentos, e.malas], [false, false, 1, [0]]);
    assert.strictEqual(R.pistaDe(e, Q3).es, 'p1');
    assert.strictEqual(R.guardado(e), null, 'sin terminar no se guarda');
    const f = R.elegir(e, Q3, 1);
    assert.ok(f.ok && f.fin && f.intentos === 2);
    assert.ok(!R.aciertoPrimero(f), 'acertar al segundo intento no puntúa');
  });
  ok('una pista por fallo, en orden; si se acaban se repite la última', () => {
    let e = R.nuevaPregunta();
    e = R.elegir(e, Q3, 0); assert.strictEqual(R.pistaDe(e, Q3).es, 'p1');
    e = R.elegir(e, Q3, 2); assert.strictEqual(R.pistaDe(e, Q3).es, 'p2');
    assert.ok(!e.fin);
    const Q = { ...Q3, pistas: [t('sola')] };
    let f = R.elegir(R.elegir(R.nuevaPregunta(), Q, 0), Q, 2); assert.strictEqual(R.pistaDe(f, Q).es, 'sola');
  });
  ok('sin `pistas` la ayuda es la explicación (why)', () => {
    const Q = { ...Q3, pistas: undefined };
    assert.strictEqual(R.pistaDe(R.elegir(R.nuevaPregunta(), Q, 0), Q).es, 'porque');
  });
  ok('una opción descartada no se puede volver a elegir (sin cambios, mismo objeto)', () => {
    const e = R.elegir(R.nuevaPregunta(), Q3, 0);
    assert.strictEqual(R.elegir(e, Q3, 0), e);
  });
  ok('al quedar solo la correcta termina sin acierto y revela (opciones agotadas)', () => {
    let e = R.nuevaPregunta();
    for (const j of [0, 2, 3]) e = R.elegir(e, Q3, j);
    assert.deepStrictEqual([e.fin, e.ok, e.intentos, e.malas], [true, false, 3, [0, 2, 3]]);
    assert.strictEqual(R.pistaDe(e, Q3), null, 'al terminar se muestra el why completo, no una pista');
    assert.deepStrictEqual(R.guardado(e), { opcion: 3, ok: false, intentos: 3 });
    assert.ok(!R.aciertoPrimero(e));
  });
  ok('con 2 opciones el primer fallo ya termina', () => {
    const e = R.elegir(R.nuevaPregunta(), Q2, 1);
    assert.deepStrictEqual([e.fin, e.ok], [true, false]);
  });
  ok('terminada o índice inválido: no cambia nada', () => {
    const e = R.elegir(R.nuevaPregunta(), Q3, 1);
    assert.strictEqual(R.elegir(e, Q3, 0), e);
    const v = R.nuevaPregunta();
    for (const j of [-1, 4, 1.5, NaN, '1', undefined]) assert.strictEqual(R.elegir(v, Q3, j), v);
  });
  ok('las transiciones no mutan el estado anterior', () => {
    const e0 = R.nuevaPregunta(), copia = JSON.stringify(e0);
    R.elegir(e0, Q3, 0); R.elegir(e0, Q3, 1);
    assert.strictEqual(JSON.stringify(e0), copia);
  });

  console.log('deriva');
  ok('flujo completo bien: predicción → razón → revelación', () => {
    let e = R.nuevaDeriva();
    assert.strictEqual(e.fase, 'pred');
    e = R.predecir(e, D, 1); assert.deepStrictEqual([e.fase, e.pred, e.fin], ['razon', 1, false]);
    e = R.razonar(e, D, 0); assert.deepStrictEqual([e.fase, e.razon, e.fin, e.resultado], ['revela', 0, true, 'bien']);
    assert.ok(R.aciertoPrimero(e));
    assert.deepStrictEqual(R.guardado(e), { opcion: [1, 0], ok: true, intentos: 1 });
  });
  ok('veredictos: bien / razón errónea con predicción buena / predicción errónea', () => {
    const v = (p, r) => R.razonar(R.predecir(R.nuevaDeriva(), D, p), D, r).resultado;
    assert.strictEqual(v(1, 0), 'bien');
    assert.strictEqual(v(1, 1), 'razon');
    assert.strictEqual(v(0, 0), 'mal'); // buena razón pero predicción errónea
    assert.strictEqual(v(2, 1), 'mal');
    assert.ok(!R.aciertoPrimero(R.razonar(R.predecir(R.nuevaDeriva(), D, 1), D, 1)));
    assert.deepStrictEqual(R.guardado(R.razonar(R.predecir(R.nuevaDeriva(), D, 1), D, 1)), { opcion: [1, 1], ok: false, intentos: 1 });
  });
  ok('el orden se respeta: no se puede razonar sin predecir ni predecir dos veces', () => {
    const e0 = R.nuevaDeriva();
    assert.strictEqual(R.razonar(e0, D, 0), e0);
    const e1 = R.predecir(e0, D, 1);
    assert.strictEqual(R.predecir(e1, D, 2), e1);
  });
  ok('índices fuera de rango no cambian nada', () => {
    const e0 = R.nuevaDeriva();
    for (const j of [-1, 3, 0.5, null]) assert.strictEqual(R.predecir(e0, D, j), e0);
    const e1 = R.predecir(e0, D, 1);
    for (const j of [-1, 2, 'x']) assert.strictEqual(R.razonar(e1, D, j), e1);
  });
  ok('«cambiar» devuelve de la razón a la predicción sin coste; terminada ya no se puede cambiar', () => {
    const e1 = R.predecir(R.nuevaDeriva(), D, 2), e2 = R.corregir(e1);
    assert.deepStrictEqual([e2.fase, e2.pred], ['pred', null]);
    const fin = R.razonar(R.predecir(e2, D, 1), D, 0);
    assert.strictEqual(R.corregir(fin), fin);
    const e0 = R.nuevaDeriva(); assert.strictEqual(R.corregir(e0), e0);
  });
  ok('pistas: una por petición, acotadas, sin tocar la fase ni el resultado, y no tras revelar', () => {
    let e = R.nuevaDeriva();
    assert.strictEqual(R.pistaPedida(e, D), null);
    e = R.pedirPista(e, D); assert.strictEqual(R.pistaPedida(e, D).es, 'h1');
    e = R.pedirPista(e, D); assert.strictEqual(R.pistaPedida(e, D).es, 'h2');
    assert.strictEqual(R.pedirPista(e, D), e, 'se acaban');
    assert.strictEqual(e.fase, 'pred');
    const fin = R.razonar(R.predecir(e, D, 1), D, 0);
    assert.strictEqual(R.pedirPista({ ...fin, pistas: 0 }, D).pistas, 0);
    const sin = R.nuevaDeriva(); assert.strictEqual(R.pedirPista(sin, { ...D, pistas: undefined }), sin);
  });

  console.log('guardado y puntuación');
  const pasos = [{}, { pregunta: Q3 }, { deriva: D }, { pregunta: Q2 }, {}];
  ok('tipoDe / nuevo según el paso', () => {
    assert.deepStrictEqual(pasos.map(R.tipoDe), [null, 'p', 'd', 'p', null]);
    assert.strictEqual(R.nuevo(pasos[0]), null);
    assert.strictEqual(R.nuevo(pasos[2]).tipo, 'd');
  });
  ok('desdeGuardado reconstruye estados terminados (ida y vuelta)', () => {
    const q = R.elegir(R.elegir(R.nuevaPregunta(), Q3, 0), Q3, 1);
    const q2 = R.desdeGuardado(pasos[1], R.guardado(q));
    assert.deepStrictEqual([q2.fin, q2.ok, q2.intentos, q2.opcion], [true, true, 2, 1]);
    const d = R.razonar(R.predecir(R.nuevaDeriva(), D, 1), D, 1);
    const d2 = R.desdeGuardado(pasos[2], R.guardado(d));
    assert.deepStrictEqual([d2.fin, d2.pred, d2.razon, d2.resultado], [true, 1, 1, 'razon']);
  });
  ok('desdeGuardado ignora registros que no encajan (contenido cambiado, basura)', () => {
    assert.strictEqual(R.desdeGuardado(pasos[1], { opcion: 9, ok: true, intentos: 1 }), null);
    assert.strictEqual(R.desdeGuardado(pasos[2], { opcion: 1, ok: true, intentos: 1 }), null);
    assert.strictEqual(R.desdeGuardado(pasos[2], { opcion: [1, 7], ok: true, intentos: 1 }), null);
    assert.strictEqual(R.desdeGuardado(pasos[0], { opcion: 0 }), null);
    assert.strictEqual(R.desdeGuardado(pasos[1], null), null);
    // la verdad la dicta el dato del paso, no el `ok` guardado
    assert.strictEqual(R.desdeGuardado(pasos[1], { opcion: 0, ok: true, intentos: 1 }).ok, false);
  });
  ok('puntuación: solo cuenta lo acertado a la primera; lo no respondido y lo saltado, no', () => {
    assert.deepStrictEqual(R.puntuacion(pasos, {}), { ok: 0, total: 3 });
    const est = {
      1: R.elegir(R.nuevaPregunta(), Q3, 1),                                     // a la primera
      2: R.predecir(R.nuevaDeriva(), D, 1),                                      // empezada y abandonada
      3: R.elegir(R.nuevaPregunta(), Q2, 1),                                     // fallada
    };
    assert.deepStrictEqual(R.puntuacion(pasos, est), { ok: 1, total: 3 });
    est[2] = R.razonar(est[2], D, 0);
    assert.deepStrictEqual(R.puntuacion(pasos, est), { ok: 2, total: 3 });
    est[1] = R.elegir(R.elegir(R.nuevaPregunta(), Q3, 0), Q3, 1);              // al segundo intento
    assert.deepStrictEqual(R.puntuacion(pasos, est), { ok: 1, total: 3 });
  });
  console.log(`\n${n} pruebas OK`);
})().catch(e => { console.error('\n✗ ' + (e.stack || e)); process.exit(1); });
