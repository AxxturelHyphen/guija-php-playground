#!/usr/bin/env node
'use strict';
/**
 * Lógica pura de assets/js/progreso.js (sin navegador, con almacenamiento y reloj inyectados):
 *   node tests/progreso.js        (código de salida 0 = todo correcto)
 * Cubre: Leitner (1/3/7/21 días), racha entre días (también con cambio de hora), elección del siguiente paso,
 * guías, temporizador, notas y almacenamiento ausente, corrupto, de otra versión o que lanza.
 */
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let total = 0, fallos = 0;
const ok = (c, m) => { total++; if (!c) { fallos++; console.log('  ✗ ' + m); } };
const igual = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const seccion = n => console.log(n);

/** Almacenamiento en memoria con la interfaz de localStorage. */
const memoria = (ini = {}) => {
  const m = new Map(Object.entries(ini));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, _m: m };
};
/** Reloj manual: reloj.t son los milisegundos; avanzar(h) suma horas. */
const reloj = (fecha = new Date(2026, 0, 10, 9, 0, 0)) => {
  const r = { t: fecha.getTime(), ahora: () => r.t, avanzar: (h = 0, min = 0) => { r.t += h * 3_600_000 + min * 60_000; }, dia: (n, h = 9) => { const d = new Date(r.t); r.t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, h, 0, 0).getTime(); } };
  return r;
};
const temario = [
  { id: 'fundamentos', titulo: '01 · Fundamentos', archivo: '01.cpp', ejercicios: [{ key: 'a', name: 'a()' }, { key: 'b', name: 'b()' }] },
  { id: 'recursion', titulo: '04 · Recursión', archivo: '04.cpp', ejercicios: [{ key: 'fib', name: 'fib()' }, { key: 'mcd', name: 'mcd()' }] },
];

(async () => {
  const M = await import(pathToFileURL(path.join(__dirname, '..', 'assets', 'js', 'progreso.js')).href);
  const nuevo = (st = memoria(), r = reloj()) => ({ P: M.crearProgreso({ storage: st, ahora: r.ahora }), st, r });

  seccion('Ejercicios');
  {
    const { P, st } = nuevo();
    ok(P.ejercicioHecho('cpp', 'recursion', 'fib') === true, 'primera vez devuelve true');
    ok(P.ejercicioHecho('cpp', 'recursion', 'fib') === false, 'la segunda no cuenta');
    P.ejercicioHecho('cpp', 'recursion', 'mcd');
    igual(P.ejerciciosHechos('cpp', 'recursion'), ['fib', 'mcd'], 'ejerciciosHechos en orden de logro');
    igual(P.ejerciciosHechos('cpp', 'otra'), [], 'lección sin nada');
    ok(P.sesionHoy().ejercicios === 2, 'la actividad del día no cuenta repeticiones');
    ok(JSON.parse(st.getItem('pg:progreso')).v === 1, 'se guarda versionado en pg:progreso');
    ok(P.ejercicioHecho('c++', 'x', 'y') === false && P.ejercicioHecho('cpp', '', 'y') === false, 'entradas inválidas se ignoran');
  }

  seccion('Leitner: intervalos 1/3/7/21 días');
  {
    const { P, r } = nuevo();
    P.ejercicioHecho('cpp', 'recursion', 'fib');
    const id = 'ej:cpp/recursion/fib';
    igual(P.repasoHoy().length, 0, 'recién pasado: hasta mañana no toca');
    r.dia(1);
    igual(P.repasoHoy().map(i => i.id), [id], 'al día siguiente toca (caja 1 = 1 día)');
    igual(P.repasoHoy()[0].url, '/cpp?l=recursion&e=fib', 'enlace al ejercicio');
    let it = P.repasoResultado(id, true);
    ok(it.caja === 2, 'acierto: caja 2');
    r.dia(2); igual(P.repasoHoy().length, 0, 'caja 2: a los 2 días aún no');
    r.dia(1); igual(P.repasoHoy().length, 1, 'caja 2: a los 3 días sí');
    it = P.repasoResultado(id, true); ok(it.caja === 3, 'caja 3');
    r.dia(6); igual(P.repasoHoy().length, 0, 'caja 3: a los 6 días no');
    r.dia(1); igual(P.repasoHoy().length, 1, 'caja 3: a los 7 días sí');
    it = P.repasoResultado(id, true); ok(it.caja === 4, 'caja 4');
    r.dia(20); igual(P.repasoHoy().length, 0, 'caja 4: a los 20 días no');
    r.dia(1); igual(P.repasoHoy().length, 1, 'caja 4: a los 21 días sí');
    it = P.repasoResultado(id, true); ok(it.caja === 4, 'la caja 4 es el tope');
    r.dia(21); P.repasoResultado(id, false);
    ok(P.repasoDe(id).caja === 1, 'fallo: vuelve a la caja 1');
    igual(P.repasoHoy().length, 0, 'tras fallar no vuelve a salir el mismo día');
    r.dia(1); igual(P.repasoHoy().length, 1, 'y sale al día siguiente');
    ok(P.repasoResultado('no-existe', true) === null, 'id desconocido: null');
  }
  {
    const { P, r } = nuevo();
    for (const c of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) { P.ejercicioHecho('cpp', 'l', c); r.avanzar(0, 1); }
    r.dia(1);
    igual(P.repasoHoy().length, 5, 'máximo 5 por defecto');
    igual(P.repasoHoy(2).length, 2, 'max configurable');
    igual(P.repasoHoy(0).length, 0, 'max 0');
    ok(P.repasoPendientes() === 7, 'repasoPendientes cuenta todos los vencidos');
    r.dia(-1); // vuelve atrás: nada vencido aún
    igual(P.repasoHoy().length, 0, 'reloj hacia atrás no inventa repasos');
  }
  {
    const { P, r } = nuevo();
    P.guiaRespuesta('punteros', 3, 2, false);
    P.guiaRespuesta('punteros', 4, 1, true);
    r.dia(1);
    const rep = P.repasoHoy();
    igual(rep.map(i => i.id), ['guia:punteros#3'], 'una pregunta fallada entra en la cola; una acertada no');
    ok(rep[0].url === '/guias/punteros#4' && rep[0].tipo === 'guia', 'enlace al paso de la guía (#n desde 1)');
    igual(P.guiaEstado('punteros').resp, { 3: { opcion: 2, ok: false }, 4: { opcion: 1, ok: true } }, 'respuestas guardadas');
  }

  seccion('Racha');
  {
    const { P, r } = nuevo();
    ok(P.racha() === 0, 'sin actividad: 0');
    P.ejercicioHecho('cpp', 'l', 'a');
    ok(P.racha() === 1, 'hoy con un ejercicio: 1');
    r.dia(1);
    ok(P.racha() === 1, 'hoy aún sin actividad no rompe la racha de ayer');
    P.ejercicioHecho('cpp', 'l', 'b');
    ok(P.racha() === 2, 'dos días seguidos: 2');
    r.dia(3);
    ok(P.racha() === 0, 'saltarse un día la rompe');
    for (let p = 0; p < 4; p++) P.guiaPaso('g', p, 10);
    ok(P.racha() === 0 && P.sesionHoy().pasos === 4 && !P.sesionHoy().cuenta, '4 pasos de guía no cuentan');
    P.guiaPaso('g', 4, 10);
    ok(P.racha() === 1 && P.sesionHoy().cuenta, '5 pasos de guía sí');
  }
  {
    // 23:59 → 00:01: otro día del calendario aunque pasen 2 minutos
    const { P, r } = nuevo(memoria(), reloj(new Date(2026, 2, 7, 23, 59)));
    P.ejercicioHecho('cpp', 'l', 'a');
    r.avanzar(0, 2);
    ok(P.sesionHoy().ejercicios === 0, 'pasada la medianoche empieza otro día');
    ok(P.racha() === 1, 'la racha de anoche sigue viva');
    P.ejercicioHecho('cpp', 'l', 'b');
    ok(P.racha() === 2, 'y se alarga');
    // Cambio de hora (en las zonas con DST el día dura 23 o 25 h): un día por día natural
    const { P: Q, r: r2 } = nuevo(memoria(), reloj(new Date(2026, 2, 28, 12)));
    for (let i = 0; i < 4; i++) { Q.ejercicioHecho('cpp', 'l', 'x' + i); r2.dia(1, 12); }
    r2.dia(-1, 12);
    ok(Q.racha() === 4, 'racha de 4 días naturales a través del cambio de hora (' + Q.racha() + ')');
  }

  seccion('Guías');
  {
    const { P } = nuevo();
    igual(P.guiaEstado('nada'), { paso: 0, max: -1, total: 0, resp: {} }, 'guía no vista');
    P.guiaPaso('punteros', 0, 12);
    P.guiaPaso('punteros', 1, 12);
    P.guiaPaso('punteros', 4, 12);
    P.guiaPaso('punteros', 2, 12);
    igual(P.guiaEstado('punteros'), { paso: 2, max: 4, total: 12, resp: {} }, 'posición y máximo');
    ok(P.sesionHoy().pasos === 3, 'solo los pasos nuevos suman (volver atrás no)');
    P.guiaPaso('Mal Id!', 1, 2); P.guiaPaso('x', -1, 2); P.guiaPaso('x', 1.5, 2);
    igual(P.guiaEstado('Mal Id!').max, -1, 'ids y pasos inválidos se ignoran');
  }

  seccion('Siguiente paso');
  {
    const { P, r } = nuevo();
    ok(P.siguientePaso() === null, 'sin temario ni actividad: null');
    P.registrarTemario('cpp', temario);
    const s0 = P.siguientePaso({ lang: 'cpp' });
    ok(s0 && s0.tipo === 'ejercicio' && s0.url === '/cpp?l=fundamentos&e=a' && s0.titulo === 'Ejercicio: a()', 'arranque: primer ejercicio del temario');
    ok(/0 de 2 hechos/.test(s0.detalle) && Object.keys(s0).sort().join() === 'detalle,ref,tipo,titulo,url', 'detalle y forma del objeto');
    ok(P.siguientePaso() === null, 'sin lang ni lección en curso: null aunque haya temario');

    P.ejercicioHecho('cpp', 'fundamentos', 'a');
    const s1 = P.siguientePaso();
    ok(s1.url === '/cpp?l=fundamentos&e=b' && /1 de 2/.test(s1.detalle), 'continúa en la lección en curso');
    P.ejercicioHecho('cpp', 'fundamentos', 'b');
    const s2 = P.siguientePaso();
    ok(s2.url === '/cpp?l=recursion&e=fib', 'lección acabada: pasa al primer pendiente de la siguiente');

    // Con la lección en curso reciente, un repaso vencido NO la interrumpe; pasado el margen, sí
    r.dia(1);
    P.marcarLeccion('cpp', 'recursion');
    ok(P.siguientePaso().tipo === 'ejercicio', 'trabajando ahora: el repaso espera');
    r.avanzar(0, 21);
    const s3 = P.siguientePaso();
    ok(s3.tipo === 'repaso' && s3.ref.id.startsWith('ej:cpp/fundamentos/') && /2 pendientes/.test(s3.detalle), 'pasado el margen: toca repasar');
    for (const i of P.repasoHoy()) P.repasoResultado(i.id, true);
    ok(P.siguientePaso().tipo === 'ejercicio', 'sin repaso vencido vuelve a los ejercicios');

    // Una guía a medias gana a empezar un ejercicio nuevo, y el enlace va al paso guardado
    P.guiaPaso('arboles', 3, 10, 'Árboles');
    const s4 = P.siguientePaso();
    ok(s4.tipo === 'guia' && s4.url === '/guias/arboles#4' && /Árboles/.test(s4.titulo) && s4.detalle === 'Paso 4 de 10', 'guía a medias: #paso+1');
    P.guiaPaso('arboles', 9, 10);
    ok(P.siguientePaso().tipo === 'ejercicio', 'guía terminada: ya no es el siguiente paso');
    P.guiaRespuesta('arboles', 9, 0, false);
    r.dia(1);
    ok(P.siguientePaso().tipo === 'repaso', 'pregunta fallada pendiente: repaso');
  }
  {
    // Todo hecho: nada que proponer
    const { P } = nuevo();
    P.registrarTemario('cpp', [temario[0]]);
    P.ejercicioHecho('cpp', 'fundamentos', 'a'); P.ejercicioHecho('cpp', 'fundamentos', 'b');
    ok(P.siguientePaso({ lang: 'cpp' }) === null, 'temario completo y sin repaso: null');
    ok(P.leccionDeArchivo('cpp', '01.cpp').id === 'fundamentos' && P.leccionDeArchivo('cpp', 'nada.cpp') === null, 'leccionDeArchivo');
    ok(P.temarioDe('cpp')[0].ej[1].n === 'b()' && P.temarioEdad('java') === Infinity, 'temario en caché');
  }

  seccion('Temporizador');
  {
    const { P, r, st } = nuevo();
    igual(P.temporizador(), { estado: 'parado', dur: 0, resta: 0 }, 'parado');
    P.temporizadorIniciar(10);
    r.avanzar(0, 4);
    const t = P.temporizador();
    ok(t.estado === 'corriendo' && t.resta === 6 * 60_000 && t.dur === 600_000, 'corre y deriva el resto de la marca de fin');
    // «Recarga»: otra instancia sobre el mismo almacenamiento ve lo mismo
    const Q = M.crearProgreso({ storage: st, ahora: r.ahora });
    ok(Q.temporizador().resta === 6 * 60_000, 'sobrevive a una recarga');
    P.temporizadorPausar();
    r.avanzar(1);
    ok(P.temporizador().estado === 'pausa' && P.temporizador().resta === 6 * 60_000, 'en pausa no avanza');
    P.temporizadorReanudar();
    r.avanzar(0, 7);
    ok(P.temporizador().estado === 'fin', 'termina');
    P.temporizadorParar();
    ok(P.temporizador().estado === 'parado', 'parar lo limpia');
    P.temporizadorIniciar(0); P.temporizadorIniciar(999); P.temporizadorIniciar('x');
    ok(P.temporizador().estado === 'parado', 'duraciones fuera de rango se ignoran');
  }

  seccion('Notas y enfoque');
  {
    const { P, st } = nuevo();
    const n = P.notaAgregar('cpp', 'recursion', '  mirar cómo se llama memo  ');
    ok(n && n.t === 'mirar cómo se llama memo', 'nota recortada');
    ok(P.notaAgregar('cpp', 'recursion', '   ') === null, 'nota vacía: no');
    P.notaAgregar('cpp', 'recursion', 'otra');
    igual(P.notas('cpp', 'recursion').map(x => x.t), ['mirar cómo se llama memo', 'otra'], 'listado en orden');
    igual(P.notas('cpp', 'fundamentos'), [], 'por lección');
    ok(P.notaBorrar('cpp', 'recursion', n.id) === true && P.notaBorrar('cpp', 'recursion', n.id) === false, 'borrar una vez');
    for (let i = 0; i < 60; i++) P.notaAgregar('cpp', 'x', 'n' + i);
    ok(P.notas('cpp', 'x').length === 50, 'máximo 50 por lección');
    P.enfoqueFijar('cpp', 'recursion', 'fib');
    ok(P.enfoque('cpp', 'recursion') === 'fib' && M.crearProgreso({ storage: st }).enfoque('cpp', 'recursion') === 'fib', 'enfoque recordado');
    P.enfoqueFijar('cpp', 'recursion', null);
    ok(P.enfoque('cpp', 'recursion') === null, 'quitar enfoque');
  }

  seccion('Almacenamiento ausente, corrupto o ajeno');
  {
    const P = M.crearProgreso({ storage: null, ahora: reloj().ahora });
    P.ejercicioHecho('cpp', 'l', 'a');
    ok(P.sesionHoy().ejercicios === 1 && P.racha() === 1, 'sin almacenamiento funciona en memoria');
    const roto = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
    const Q = M.crearProgreso({ storage: roto, ahora: reloj().ahora });
    ok(Q.ejercicioHecho('cpp', 'l', 'a') === true && Q.ejerciciosHechos('cpp', 'l').length === 1, 'almacenamiento que lanza: sin excepciones');
  }
  for (const [nombre, raw] of [['JSON truncado', '{"v":1,"ej":'], ['no es objeto', '[1,2,3]'], ['sin versión', '{"ej":{}}'], ['versión 0', '{"v":0}'], ['texto', 'hola']]) {
    const st = memoria({ 'pg:progreso': raw });
    const P = M.crearProgreso({ storage: st, ahora: reloj().ahora });
    ok(P.racha() === 0 && P.ejerciciosHechos('cpp', 'l').length === 0 && P.siguientePaso() === null, `${nombre}: arranca de cero`);
    P.ejercicioHecho('cpp', 'l', 'a');
    ok(JSON.parse(st.getItem('pg:progreso')).ej['cpp/l'].a > 0 && st.getItem('pg:progreso:corrupto') === raw, `${nombre}: se recupera y se conserva el original`);
  }
  {
    // Tipos equivocados dentro de un JSON válido: se descartan sin romper
    const basura = { v: 1, ej: { 'cpp/l': { a: 'x', b: 5 }, malo: 3 }, guias: { 'ID MALO': {}, ok: { paso: -3, max: 'z', total: 'q', resp: 7 } }, repaso: { x: { tipo: 'ejercicio', url: 'javascript:alert(1)', caja: 1, prox: 0 }, y: { tipo: 'ejercicio', url: '//evil.com', caja: 1 }, z: { tipo: 'otro', url: '/a' } }, dias: { hoy: {}, 5: 'x' }, tem: { cpp: { lecciones: 'no' }, 'C++': {} }, notas: { k: 'no' }, tmr: { dur: 'x' }, ui: 3, ult: 7 };
    const P = M.crearProgreso({ storage: memoria({ 'pg:progreso': JSON.stringify(basura) }), ahora: reloj().ahora });
    igual(P.ejerciciosHechos('cpp', 'l'), ['b'], 'solo se conservan marcas numéricas');
    igual(P.guiaEstado('ok'), { paso: 0, max: -1, total: 0, resp: {} }, 'guía con campos inválidos: valores por defecto');
    igual(P.repasoHoy(10), [], 'URLs no locales o tipos desconocidos se descartan del repaso');
    ok(P.temporizador().estado === 'parado' && P.siguientePaso() === null && P.notas('cpp', 'k').length === 0, 'el resto no rompe');
  }
  {
    // Escrito por una versión más nueva: se lee, no se pisa
    const nueva = JSON.stringify({ v: 2, ej: { 'cpp/l': { a: 1 } }, futuro: true });
    const st = memoria({ 'pg:progreso': nueva });
    const P = M.crearProgreso({ storage: st, ahora: reloj().ahora });
    igual(P.ejerciciosHechos('cpp', 'l'), ['a'], 'versión mayor: se lee lo conocido');
    P.ejercicioHecho('cpp', 'l', 'b');
    ok(st.getItem('pg:progreso') === nueva, 'versión mayor: no se sobrescribe');
  }
  {
    // Los oyentes se enteran de los cambios y de las recargas
    const { P } = nuevo();
    let n = 0; const baja = P.alCambiar(() => { n++; });
    P.ejercicioHecho('cpp', 'l', 'a'); P.recargar();
    ok(n === 2, 'alCambiar avisa al escribir y al recargar');
    baja(); P.ejercicioHecho('cpp', 'l', 'b');
    ok(n === 2, 'darse de baja funciona');
  }

  console.log(fallos ? `\n${fallos} FALLOS de ${total}` : `\n${total} comprobaciones OK`);
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
