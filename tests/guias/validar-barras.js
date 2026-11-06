'use strict';
// Reglas de la escena «barras» para tests/guias-datos.js (formato de parches en assets/guias/barras.js).
// La fábrica se llama una vez por guía; el validador recibe cada paso y cada frame de traza con la escena activa.
// Mantiene su propio estado mínimo (def y punteros acumulados) sin importar el módulo ES (la fábrica es síncrona).
const PARCHES = ['intercambiar', 'poner', 'arr', 'aux', 'marcas', 'rango', 'est', 'cont'];
const DEF = ['arr', 'aux', 'estilo', 'max', 'etiquetas', 'etiquetasCont'];
const PASO = ['es', 'en', 'sec', 'code', 'line', 'hl', 'traza', 'jugar', 'pregunta', 'barras', ...PARCHES];
const FRAME = ['es', 'en', 'line', ...PARCHES];
const ESTADOS = ['cmp', 'ok', 'piv', 'sel'];
const MAXN = 32, MKROWS = 3;
const ent = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
const clave = k => (/^-?\d+$/.test(k) ? +k : NaN); // las claves de objeto llegan como texto

module.exports = () => {
  let def = null; // {n, aux, max}
  let marc = {}, tr = null; // punteros acumulados del paso / de la traza en curso

  const abrir = (b, w) => {
    def = null;
    if (!b || typeof b !== 'object') return w('barras: debe ser un objeto {arr, …}');
    for (const k of Object.keys(b)) if (!DEF.includes(k)) w(`barras: clave desconocida «${k}» (${DEF.join(', ')})`);
    if (!Array.isArray(b.arr) || !b.arr.length) return w('barras.arr: array de números no vacío');
    if (b.arr.length > MAXN) w(`barras.arr: ${b.arr.length} elementos (máx. ${MAXN}, más no se lee bien)`);
    if (!b.arr.every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0)) w('barras.arr: solo números finitos ≥ 0');
    if (b.aux !== undefined && !ent(b.aux, 0, MAXN)) w(`barras.aux: entero 0..${MAXN}`);
    if (b.estilo !== undefined && !['barras', 'cajas'].includes(b.estilo)) w("barras.estilo: 'barras' o 'cajas'");
    if (b.etiquetas !== undefined && typeof b.etiquetas !== 'boolean') w('barras.etiquetas: booleano');
    const tope = Math.max(1, ...b.arr.filter(Number.isFinite));
    if (b.max !== undefined && !(typeof b.max === 'number' && b.max > 0)) w('barras.max: número > 0');
    else if (b.max !== undefined && b.max < tope) w(`barras.max (${b.max}) menor que el mayor de arr (${tope})`);
    for (const [k, v] of Object.entries(b.etiquetasCont ?? {})) {
      if (typeof v === 'string') continue;
      if (!v || typeof v.es !== 'string' || typeof v.en !== 'string') w(`barras.etiquetasCont.${k}: texto o {es, en}`);
    }
    def = { n: b.arr.length, aux: ent(b.aux ?? 0, 0, MAXN) ? (b.aux ?? 0) : 0, max: b.max ?? tope };
    marc = {}; tr = null;
  };

  // Valida un mapa {índice: estado|null} (est y hl)
  const estados = (o, nombre, w) => {
    for (const [k, v] of Object.entries(o)) {
      if (!ent(clave(k), 0, def.n - 1)) w(`${nombre}: índice «${k}» fuera de [0, ${def.n})`);
      if (v !== null && !ESTADOS.includes(v)) w(`${nombre} ${k}: «${v}» no es ${ESTADOS.join('|')}|null`);
    }
  };
  const valor = (v, nombre, w) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) w(`${nombre}: valor inválido «${v}» (número ≥ 0)`);
    else if (v > def.max) w(`${nombre}: ${v} supera max (${def.max}); declara barras.max`);
  };

  return (p, w, info) => {
    if (p.barras !== undefined) {
      if (info.frame) w('barras solo puede aparecer en el paso que abre la escena, no en un frame de traza');
      else abrir(p.barras, w);
    }
    if (!def) return;
    if ('texto' in p) w('«texto» no existe en barras: el subtítulo lo pone guia.js (es / en)');
    for (const k of Object.keys(p)) if (!(info.frame ? FRAME : PASO).includes(k) && k !== 'texto') w(`clave desconocida «${k}» (${info.frame ? 'frame' : 'paso'} de barras)`);

    const n = def.n;
    // Los frames se acumulan sobre una copia de los punteros del paso; el siguiente paso vuelve a partir de él
    let m = marc;
    if (info.frame) { tr ??= { ...marc }; m = tr; } else tr = null;

    if (p.arr !== undefined) {
      if (!Array.isArray(p.arr) || p.arr.length !== n) w(`arr: array de ${n} valores`);
      else p.arr.forEach((v, i) => valor(v, `arr[${i}]`, w));
    }
    if (p.poner !== undefined) {
      if (!p.poner || typeof p.poner !== 'object' || Array.isArray(p.poner)) w('poner: objeto {índice: valor}');
      else for (const [k, v] of Object.entries(p.poner)) {
        if (!ent(clave(k), 0, n - 1)) w(`poner: índice «${k}» fuera de [0, ${n})`);
        valor(v, `poner ${k}`, w);
      }
    }
    if (p.intercambiar !== undefined) {
      const ps = Array.isArray(p.intercambiar) && Array.isArray(p.intercambiar[0]) ? p.intercambiar : [p.intercambiar];
      for (const q of ps) {
        if (!Array.isArray(q) || q.length !== 2 || !ent(q[0], 0, n - 1) || !ent(q[1], 0, n - 1)) w(`intercambiar: [i, j] enteros en [0, ${n}) (recibido ${JSON.stringify(q)})`);
        else if (q[0] === q[1]) w('intercambiar: i y j iguales (no hace nada)');
      }
    }
    if (p.aux !== undefined && p.aux !== null) {
      if (!def.aux) w('aux: la escena se abrió sin fila auxiliar (barras.aux = 0)');
      if (typeof p.aux !== 'object' || Array.isArray(p.aux)) w('aux: objeto {hueco: valor|null} o null');
      else for (const [k, v] of Object.entries(p.aux)) {
        if (!ent(clave(k), 0, def.aux - 1)) w(`aux: hueco «${k}» fuera de [0, ${def.aux})`);
        if (v !== null) valor(v, `aux ${k}`, w);
      }
    }
    if (p.marcas !== undefined && p.marcas !== null) {
      if (typeof p.marcas !== 'object' || Array.isArray(p.marcas)) w('marcas: objeto {nombre: índice|null} o null');
      else for (const [k, v] of Object.entries(p.marcas)) {
        if (!/^[A-Za-z][A-Za-z0-9]{0,5}$/.test(k)) w(`marcas: nombre «${k}» (letras/dígitos, máx. 6)`);
        if (v !== null && !ent(v, -1, n)) w(`marcas ${k}: índice ${v} fuera de [-1, ${n}]`);
        if (v === null) delete m[k]; else m[k] = v;
      }
    }
    if (p.marcas === null) for (const k of Object.keys(m)) delete m[k];
    if (p.marcas !== undefined) {
      const por = {};
      for (const i of Object.values(m)) por[i] = (por[i] ?? 0) + 1;
      for (const [i, c] of Object.entries(por)) if (c > MKROWS) w(`marcas: ${c} nombres apilados en el índice ${i} (máx. ${MKROWS})`);
    }
    if (p.rango !== undefined && p.rango !== null) {
      const r = p.rango;
      if (!Array.isArray(r) || r.length !== 2 || !ent(r[0], 0, n - 1) || !ent(r[1], 0, n - 1)) w(`rango: [lo, hi] enteros en [0, ${n}) o null`);
      else if (r[0] > r[1]) w(`rango: lo (${r[0]}) mayor que hi (${r[1]}); usa null para quitarlo`);
    }
    if (p.est !== undefined && p.est !== null) {
      if (typeof p.est !== 'object' || Array.isArray(p.est)) w('est: objeto {índice: estado|null} o null');
      else estados(p.est, 'est', w);
    }
    if (p.hl !== undefined) {
      if (!p.hl || typeof p.hl !== 'object' || Array.isArray(p.hl)) w('hl: objeto {índice: estado}');
      else estados(p.hl, 'hl', w);
    }
    if (p.cont !== undefined && p.cont !== null) {
      if (typeof p.cont !== 'object' || Array.isArray(p.cont)) w('cont: objeto {nombre: número} o null');
      else for (const [k, v] of Object.entries(p.cont)) if (typeof v !== 'number' || !Number.isFinite(v)) w(`cont ${k}: debe ser un número`);
    }

    if (p.jugar) {
      const J = p.jugar;
      if (J.arrastrables !== undefined) {
        if (J.arrastrables !== true && !(Array.isArray(J.arrastrables) && J.arrastrables.every(i => ent(i, 0, n - 1)))) w(`jugar.arrastrables: true o ids (posición inicial) en [0, ${n})`);
        if (typeof J.soltar !== 'function') w('jugar.arrastrables necesita soltar(v, desde, hasta, cx)');
      }
    }
  };
};
