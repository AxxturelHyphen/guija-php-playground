'use strict';
/**
 * Reglas de tests/guias-datos.js para la escena «arbol» (formato en assets/guias/arbol.js).
 *   module.exports = () => (p, w, info) => { … }     la fábrica se llama una vez por guía; w(msg) registra un error.
 * Se invoca con cada paso y cada frame de traza cuya escena activa sea «arbol»; lleva su propio estado (ids, aristas,
 * modo) aplicando los parches en el mismo orden que plegar(): -nodos, -aristas, +nodos, +aristas.
 * Comprueba: ids que existen, aristas entre nodos existentes, sin ciclos ni segundos padres en modo 'arbol', `lado`
 * válido y sin repetir, claves de parche desconocidas, `arbol` solo en el paso que abre, estados válidos, notas con
 * hueco reservado, el árbol cabe en `cabida` y el bloque `jugar.arrastrables`.
 */
const ESTADOS = ['activo', 'visitado', 'camino', 'ok', 'mal'];
const ESTADOS_ARISTA = ['camino', 'activa'];
const PARCHE = ['+nodos', '+aristas', '-nodos', '-aristas', 'val', 'etiquetas', 'est', 'aristaEst', 'notas'];
const PASO = ['arbol', 'hl', 'code', 'line', 'sec', 'es', 'en', 'jugar', 'pregunta', 'traza'];
const FRAME = ['line', 'es', 'en'];
const ABRE = ['modo', 'nodos', 'aristas', 'raiz', 'notas', 'cabida', 'lienzo', 'radio'];

const esVal = v => typeof v === 'number' || (typeof v === 'string' && v !== '') || (v && typeof v === 'object' && typeof v.es === 'string' && typeof v.en === 'string');
const clave = (a, b) => a + '-' + b;

module.exports = () => {
  let modo = 'arbol', ids = new Set(), ar = new Map(), cab = null, hueco = false, abierto = false;
  // Los frames de una traza no persisten: al volver al siguiente paso se restaura el estado que dejó el paso con la traza
  let snap = null, enFrames = false;
  const guardar = () => ({ modo, ids: new Set(ids), ar: new Map(ar), cab, hueco, abierto });
  const restaurar = x => { ({ modo, cab, hueco, abierto } = x); ids = new Set(x.ids); ar = new Map(x.ar); };

  /** Padre de cada nodo según las aristas actuales (solo modo 'arbol'). */
  const padres = () => new Map([...ar.values()].map(e => [e.b, e.a]));
  const tieneCiclo = () => {
    const pa = padres();
    for (const id of ids) for (let c = id, n = 0; pa.has(c); c = pa.get(c)) if (++n > ids.size) return true;
    return false;
  };

  return (p, w, info) => {
    const frame = info.frame;
    if (frame) enFrames = true;
    else { if (enFrames && snap) restaurar(snap); enFrames = false; }
    const permitidas = frame ? [...PARCHE, ...FRAME] : [...PARCHE, ...PASO];
    for (const k of Object.keys(p)) {
      if (k === 'arbol' && frame) w('arbol solo puede ir en el paso que abre la escena, no en un frame de traza');
      else if (!permitidas.includes(k)) w(`clave de parche desconocida «${k}»${frame && PASO.includes(k) ? ' (no válida en un frame de traza)' : ''}`);
    }

    if (p.arbol && !frame) {
      const d = p.arbol;
      if (!d || typeof d !== 'object' || !Array.isArray(d.nodos)) { w('arbol: necesita nodos[]'); return; }
      for (const k of Object.keys(d)) if (!ABRE.includes(k)) w(`arbol: clave desconocida «${k}»`);
      modo = d.modo ?? 'arbol'; abierto = true; ids = new Set(); ar = new Map(); cab = d.cabida ?? null;
      hueco = !!(d.notas?.length || cab?.notas);
      if (!['arbol', 'libre'].includes(modo)) w(`arbol.modo «${modo}» (arbol|libre)`);
      if (cab) {
        if (!Number.isInteger(cab.niveles) || cab.niveles < 1 || (cab.hojas !== undefined && !(cab.hojas >= 1))) w('arbol.cabida: {niveles ≥ 1, hojas ≥ 1}');
        if (cab.ancho !== undefined && !(cab.ancho >= 0)) w('arbol.cabida.ancho debe ser ≥ 0');
      }
      if (d.nodos.length > 40) w(`arbol: ${d.nodos.length} nodos; se leen bien hasta ~31`);
      nodos(d.nodos, w);
      aristas(d.aristas || [], w);
      if (d.raiz != null && !ids.has(d.raiz)) w(`arbol.raiz: nodo desconocido «${d.raiz}»`);
      if (!d.nodos.length && !cab && modo === 'arbol') w('arbol vacío sin cabida: el tamaño de la escena no crecerá; declara arbol.cabida');
      if (modo === 'libre' && d.nodos.length < 1) w('modo libre sin nodos');
      notas(d.notas, w);
    } else if (!abierto) { w('hay parche de arbol antes de abrir la escena'); return; }
    else {
      // Orden de plegar(): -nodos, -aristas, +nodos, +aristas
      for (const id of p['-nodos'] || []) {
        if (!ids.has(id)) { w(`-nodos: nodo desconocido «${id}»`); continue; }
        ids.delete(id);
        for (const [k, e] of ar) if (e.a === id || e.b === id) ar.delete(k);
      }
      for (const k of p['-aristas'] || []) if (!ar.delete(k)) w(`-aristas: arista desconocida «${k}»`);
      if (p['+nodos']) nodos(p['+nodos'], w, true);
      if (p['+aristas']) aristas(p['+aristas'], w, true);
      if (p.notas !== undefined) notas(p.notas, w, true);
    }

    for (const [k, campo] of [['val', 'val'], ['etiquetas', 'etiquetas'], ['est', 'est']]) {
      const o = p[k];
      if (o === undefined || (o === null && k !== 'val')) continue;
      if (!o || typeof o !== 'object' || Array.isArray(o)) { w(`${campo} debe ser {id: …}${k === 'val' ? '' : ' o null'}`); continue; }
      for (const [id, v] of Object.entries(o)) {
        if (!ids.has(id)) w(`${campo}: nodo desconocido «${id}»`);
        if (k === 'val' && !esVal(v)) w(`val ${id}: número, texto o {es,en}`);
        if (k === 'est' && v !== null && !ESTADOS.includes(v)) w(`est ${id}: «${v}» no válido (${ESTADOS.join('|')}|null)`);
        if (k === 'etiquetas' && v !== null && !esVal(v)) w(`etiquetas ${id}: texto, número, {es,en} o null`);
      }
    }
    if (p.aristaEst !== undefined && p.aristaEst !== null) {
      if (typeof p.aristaEst !== 'object' || Array.isArray(p.aristaEst)) w('aristaEst debe ser {\'a-b\': …} o null');
      else for (const [k, v] of Object.entries(p.aristaEst)) {
        if (!ar.has(k)) w(`aristaEst: arista desconocida «${k}»`);
        if (v !== null && !ESTADOS_ARISTA.includes(v)) w(`aristaEst ${k}: «${v}» no válido (${ESTADOS_ARISTA.join('|')}|null)`);
      }
    }
    for (const [x, c] of Object.entries(p.hl || {})) {
      if (!ids.has(x) && !ar.has(x)) w(`hl: nodo o arista desconocida «${x}»`);
      if (c.length !== 1 || !'abc'.includes(c)) w(`hl ${x}: usa 'a','b' o 'c'`);
    }

    if (modo === 'arbol' && tieneCiclo()) w('las aristas forman un ciclo (en modo arbol deben ser padre→hijo sin ciclos)');
    if (cab && modo === 'arbol' && !tieneCiclo()) {
      const pa = padres(), prof = id => { let n = 0; for (let c = id; pa.has(c); c = pa.get(c)) n++; return n + 1; };
      const niveles = Math.max(0, ...[...ids].map(prof)), conHijos = new Set(pa.values()), hojas = [...ids].filter(i => !conHijos.has(i)).length;
      if (niveles > cab.niveles) w(`el árbol tiene ${niveles} niveles y cabida.niveles es ${cab.niveles} (la escena se quedaría pequeña)`);
      if (cab.hojas !== undefined && hojas > cab.hojas) w(`el árbol tiene ${hojas} hojas y cabida.hojas es ${cab.hojas}`);
    }

    if (!frame) snap = guardar();
    const J = p.jugar;
    if (J?.arrastrables !== undefined) {
      const a = J.arrastrables;
      if (a !== true && !(Array.isArray(a) && a.length)) w('jugar.arrastrables: true o lista de ids');
      else if (Array.isArray(a)) for (const id of a) if (!ids.has(id)) w(`jugar.arrastrables: nodo desconocido «${id}»`);
      if (typeof J.soltar !== 'function') w('jugar.arrastrables necesita soltar(v, id, x, ctx)');
    }
  };

  function nodos(lista, w, parche = false) {
    if (!Array.isArray(lista)) { w('nodos debe ser una lista'); return; }
    for (const n of lista) {
      if (typeof n.id !== 'string' || !n.id) { w(`nodo sin id de texto (${JSON.stringify(n.id)})`); continue; }
      if (n.id.includes('-')) w(`nodo «${n.id}»: el id no puede llevar «-» (la clave de arista es a-b)`);
      if (ids.has(n.id)) w(`nodo «${n.id}» repetido${parche ? ' (+nodos de un id que ya existe)' : ''}`);
      ids.add(n.id);
      if (!esVal(n.val)) w(`nodo «${n.id}»: val debe ser número, texto o {es,en}`);
      else if (String(typeof n.val === 'object' ? n.val.es : n.val).length > 8) w(`nodo «${n.id}»: val de más de 8 caracteres`);
      const xy = n.x !== undefined || n.y !== undefined;
      if (modo === 'libre' && !(typeof n.x === 'number' && typeof n.y === 'number' && n.x >= 0 && n.y >= 0)) w(`nodo «${n.id}»: en modo libre x e y son números ≥ 0`);
      if (modo === 'arbol' && xy) w(`nodo «${n.id}»: x,y solo se usan en modo libre`);
    }
  }

  function aristas(lista, w, parche = false) {
    if (!Array.isArray(lista)) { w('aristas debe ser una lista'); return; }
    const pa = padres();
    for (const e of lista) {
      const k = clave(e.a, e.b);
      if (!ids.has(e.a) || !ids.has(e.b)) { w(`arista ${k}: extremo desconocido`); continue; }
      if (e.a === e.b) w(`arista ${k}: de un nodo a sí mismo`);
      if (ar.has(k)) w(`arista ${k} repetida${parche ? ' (+aristas de una clave que ya existe)' : ''}`);
      if (e.lado !== undefined && !['i', 'd'].includes(e.lado)) w(`arista ${k}: lado «${e.lado}» (i|d)`);
      if (e.dir !== undefined && typeof e.dir !== 'boolean') w(`arista ${k}: dir debe ser true/false`);
      if (e.peso !== undefined && !esVal(e.peso)) w(`arista ${k}: peso debe ser número o texto`);
      if (modo === 'arbol') {
        if (pa.has(e.b)) w(`arista ${k}: «${e.b}» ya tiene padre («${pa.get(e.b)}»)`);
        const hermanos = [...ar.values()].filter(f => f.a === e.a);
        if (e.lado && hermanos.some(f => f.lado === e.lado)) w(`arista ${k}: «${e.a}» ya tiene hijo en el lado ${e.lado}`);
        if (e.lado && hermanos.length >= 2) w(`arista ${k}: más de 2 hijos con lado`);
        if (e.dir || e.peso !== undefined) w(`arista ${k}: peso/dir pensados para el modo libre (grafos)`);
        pa.set(e.b, e.a);
      }
      ar.set(k, e);
    }
  }

  function notas(lista, w, parche = false) {
    if (lista == null) return;
    if (!Array.isArray(lista)) { w('notas debe ser una lista [{nivel, texto}] o null'); return; }
    if (lista.length && !hueco && parche) w('notas sin hueco reservado: declara arbol.cabida.notas = true (o notas en la apertura)');
    if (lista.length && modo === 'libre') w('notas por nivel solo tienen sentido en modo arbol');
    for (const n of lista) if (!Number.isInteger(n.nivel) || n.nivel < 0 || !esVal(n.texto)) w('notas: cada una necesita nivel (entero ≥ 0) y texto');
  }
};
