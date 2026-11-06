'use strict';
// Reglas de la escena «tabla» para tests/guias-datos.js (formato de parches en assets/guias/tabla.js).
// La fábrica se llama una vez por guía; el validador recibe cada paso y cada frame de traza con la escena activa.
// Mantiene su propio estado mínimo (dimensiones y marcas acumuladas) sin importar el módulo ES (la fábrica es síncrona).
const PARCHES = ['val', 'est', 'deps', 'marcas', 'resaltar', 'formula'];
const DEF = ['filas', 'cols', 'cab', 'val', 'formula'];
const PASO = ['es', 'en', 'sec', 'code', 'line', 'hl', 'traza', 'jugar', 'pregunta', 'tabla', ...PARCHES];
const FRAME = ['es', 'en', 'line', ...PARCHES];
const ESTADOS = ['activa', 'lee', 'hecha', 'camino', 'mal', 'elegida'];
const MAXN = 14, MAXTXT = 8, MKROWS = 3;
const ent = (x, a, b) => Number.isInteger(x) && x >= a && x <= b;
const llave = k => { const m = /^(\d+),(\d+)$/.exec(k); return m ? [+m[1], +m[2]] : null; };
const bil = v => v && typeof v === 'object' && typeof v.es === 'string' && typeof v.en === 'string';

module.exports = () => {
  let def = null; // {filas, cols}
  let marc = {}, tr = null; // marcas acumuladas del paso / de la traza en curso

  const celda = (k, nombre, w) => {
    const q = llave(k);
    if (!q) { w(`${nombre}: clave «${k}» no es «fila,col»`); return null; }
    if (!ent(q[0], 0, def.filas - 1) || !ent(q[1], 0, def.cols - 1)) { w(`${nombre}: celda ${k} fuera de la rejilla ${def.filas}×${def.cols}`); return null; }
    return q;
  };
  const valor = (v, nombre, w) => {
    if (v === null || v === '') return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) w(`${nombre}: número no finito`); else if (String(v).length > MAXTXT) w(`${nombre}: «${v}» no cabe en la celda (máx. ${MAXTXT} car.)`); return; }
    if (typeof v !== 'string') w(`${nombre}: valor «${JSON.stringify(v)}» (número, texto o null)`);
    else if (v.length > MAXTXT) w(`${nombre}: «${v}» tiene ${v.length} car. (máx. ${MAXTXT})`);
  };
  const cab = (xs, n, nombre, w) => {
    if (xs === undefined) return;
    if (!Array.isArray(xs) || xs.length !== n) return w(`tabla.cab.${nombre}: array de ${n} textos`);
    xs.forEach((x, i) => {
      const t = typeof x === 'number' ? String(x) : typeof x === 'string' ? x : bil(x) ? null : false;
      if (t === false) w(`tabla.cab.${nombre}[${i}]: texto, número o {es,en}`);
      else if (t !== null && t.length > MAXTXT) w(`tabla.cab.${nombre}[${i}]: «${t}» demasiado largo (máx. ${MAXTXT} car.)`);
      else if (t === null && (x.es.length > MAXTXT || x.en.length > MAXTXT)) w(`tabla.cab.${nombre}[${i}]: demasiado largo (máx. ${MAXTXT} car.)`);
    });
  };
  const abrir = (b, w) => {
    def = null;
    if (!b || typeof b !== 'object') return w('tabla: debe ser un objeto {filas, cols, cab, val}');
    for (const k of Object.keys(b)) if (!DEF.includes(k)) w(`tabla: clave desconocida «${k}» (${DEF.join(', ')})`);
    if (!ent(b.filas, 1, MAXN)) w(`tabla.filas: entero 1..${MAXN} (más no se lee bien)`);
    if (!ent(b.cols, 1, MAXN)) w(`tabla.cols: entero 1..${MAXN} (más no se lee bien)`);
    if (!ent(b.filas, 1, MAXN) || !ent(b.cols, 1, MAXN)) return;
    def = { filas: b.filas, cols: b.cols };
    if (b.cab !== undefined) {
      if (!b.cab || typeof b.cab !== 'object') w('tabla.cab: objeto {filas, cols, esq}');
      else {
        for (const k of Object.keys(b.cab)) if (!['filas', 'cols', 'esq'].includes(k)) w(`tabla.cab: clave desconocida «${k}»`);
        cab(b.cab.filas, b.filas, 'filas', w); cab(b.cab.cols, b.cols, 'cols', w);
        if (b.cab.esq !== undefined && typeof b.cab.esq !== 'string') w('tabla.cab.esq: texto');
      }
    }
    if (b.val !== undefined) {
      if (!Array.isArray(b.val) || b.val.length > b.filas) w(`tabla.val: matriz de hasta ${b.filas} filas`);
      else b.val.forEach((f, r) => {
        if (!Array.isArray(f) || f.length > b.cols) w(`tabla.val[${r}]: fila de hasta ${b.cols} valores`);
        else f.forEach((v, c) => valor(v, `tabla.val[${r}][${c}]`, w));
      });
    }
    if (b.formula !== undefined && b.formula !== false) w('tabla.formula: solo vale false (la fórmula se pone con el parche `formula`)');
    marc = {}; tr = null;
  };

  const estados = (o, nombre, w) => {
    for (const [k, v] of Object.entries(o)) {
      celda(k, nombre, w);
      if (v !== null && !ESTADOS.includes(v)) w(`${nombre} ${k}: «${v}» no es ${ESTADOS.join('|')}|null`);
    }
  };
  const esMatriz = v => Array.isArray(v) && v.length === def.filas && v.every(f => Array.isArray(f) && f.length === def.cols);

  return (p, w, info) => {
    if (p.tabla !== undefined) {
      if (info.frame) w('tabla solo puede aparecer en el paso que abre la escena, no en un frame de traza');
      else abrir(p.tabla, w);
    }
    if (!def) return;
    if ('texto' in p) w('«texto» no existe en tabla: el subtítulo lo pone guia.js (es / en)');
    for (const k of Object.keys(p)) if (!(info.frame ? FRAME : PASO).includes(k) && k !== 'texto') w(`clave desconocida «${k}» (${info.frame ? 'frame' : 'paso'} de tabla)`);

    // Los frames se acumulan sobre una copia de las marcas del paso; el siguiente paso vuelve a partir de él
    let m = marc;
    if (info.frame) { tr ??= { ...marc }; m = tr; } else tr = null;

    if (p.val !== undefined) {
      if (esMatriz(p.val)) p.val.forEach((f, r) => f.forEach((v, c) => { if (v !== undefined) valor(v, `val[${r}][${c}]`, w); }));
      else if (Array.isArray(p.val)) {
        p.val.forEach((t, i) => {
          if (!Array.isArray(t) || t.length !== 3) return w(`val[${i}]: terna [fila, col, valor] (o matriz de ${def.filas}×${def.cols}); recibido ${JSON.stringify(t)}`);
          if (!ent(t[0], 0, def.filas - 1) || !ent(t[1], 0, def.cols - 1)) w(`val[${i}]: celda (${t[0]},${t[1]}) fuera de la rejilla ${def.filas}×${def.cols}`);
          valor(t[2], `val[${i}]`, w);
        });
      } else if (p.val && typeof p.val === 'object') {
        for (const [k, v] of Object.entries(p.val)) { celda(k, 'val', w); valor(v, `val ${k}`, w); }
      } else w('val: lista de ternas [r,c,v], mapa {"r,c": v} o matriz');
    }
    if (p.est !== undefined && p.est !== null) {
      if (typeof p.est !== 'object' || Array.isArray(p.est)) w('est: objeto {"r,c": estado|null} o null');
      else estados(p.est, 'est', w);
    }
    if (p.hl !== undefined) {
      if (!p.hl || typeof p.hl !== 'object' || Array.isArray(p.hl)) w('hl: objeto {"r,c": estado}');
      else estados(p.hl, 'hl', w);
    }
    if (p.deps !== undefined && p.deps !== null) {
      if (!Array.isArray(p.deps)) w('deps: lista [[r,c, r2,c2], …] o null');
      else p.deps.forEach((d, i) => {
        if (!Array.isArray(d) || d.length !== 4 || !d.every(Number.isInteger)) return w(`deps[${i}]: [fila, col, fila2, col2] enteros (recibido ${JSON.stringify(d)})`);
        if (!ent(d[0], 0, def.filas - 1) || !ent(d[2], 0, def.filas - 1) || !ent(d[1], 0, def.cols - 1) || !ent(d[3], 0, def.cols - 1)) w(`deps[${i}]: celda fuera de la rejilla ${def.filas}×${def.cols}`);
        else if (d[0] === d[2] && d[1] === d[3]) w(`deps[${i}]: origen y destino son la misma celda`);
      });
    }
    if (p.marcas !== undefined && p.marcas !== null) {
      if (typeof p.marcas !== 'object' || Array.isArray(p.marcas)) w('marcas: objeto {nombre: {fila:i}|{col:j}|null} o null');
      else for (const [k, v] of Object.entries(p.marcas)) {
        if (!/^[A-Za-z][A-Za-z0-9]{0,2}$/.test(k)) w(`marcas: nombre «${k}» (letras/dígitos, de 1 a 3)`);
        if (v === null) { delete m[k]; continue; }
        const ks = v && typeof v === 'object' ? Object.keys(v) : [];
        if (ks.length !== 1 || !['fila', 'col'].includes(ks[0])) { w(`marcas ${k}: {fila: i} o {col: j} o null (recibido ${JSON.stringify(v)})`); continue; }
        if (!ent(v[ks[0]], 0, (ks[0] === 'fila' ? def.filas : def.cols) - 1)) w(`marcas ${k}: ${ks[0]} ${v[ks[0]]} fuera de la rejilla`);
        m[k] = `${ks[0]}${v[ks[0]]}`;
      }
    }
    if (p.marcas === null) for (const k of Object.keys(m)) delete m[k];
    if (p.marcas !== undefined) {
      const por = {};
      for (const c of Object.values(m)) por[c] = (por[c] ?? 0) + 1;
      for (const [c, n] of Object.entries(por)) if (n > MKROWS) w(`marcas: ${n} nombres apilados en la misma cabecera (${c}; máx. ${MKROWS})`);
    }
    if (p.resaltar !== undefined && p.resaltar !== null) {
      const r = p.resaltar;
      if (!r || typeof r !== 'object' || Array.isArray(r)) w('resaltar: {filas?:[i…], cols?:[j…]} o null');
      else {
        for (const k of Object.keys(r)) if (!['filas', 'cols'].includes(k)) w(`resaltar: clave desconocida «${k}» (filas, cols)`);
        if (r.filas !== undefined && !(Array.isArray(r.filas) && r.filas.every(i => ent(i, 0, def.filas - 1)))) w(`resaltar.filas: índices en [0, ${def.filas})`);
        if (r.cols !== undefined && !(Array.isArray(r.cols) && r.cols.every(i => ent(i, 0, def.cols - 1)))) w(`resaltar.cols: índices en [0, ${def.cols})`);
      }
    }
    if (p.formula !== undefined && p.formula !== null) {
      if (!(typeof p.formula === 'string' || bil(p.formula))) w('formula: texto, {es, en} o null');
      else for (const t of typeof p.formula === 'string' ? [p.formula] : [p.formula.es, p.formula.en]) {
        if ((t.match(/`/g) || []).length % 2) w('formula: backticks desparejados');
        if (t.length > 90) w(`formula: ${t.length} car. (máx. 90: cabe en una línea bajo la rejilla)`);
      }
    }

    if (p.jugar) {
      const J = p.jugar;
      if (J.arrastrables !== undefined) {
        const par = x => (Array.isArray(x) ? ent(x[0], 0, def.filas - 1) && ent(x[1], 0, def.cols - 1) : typeof x === 'string' && !!llave(x) && ent(llave(x)[0], 0, def.filas - 1) && ent(llave(x)[1], 0, def.cols - 1));
        if (J.arrastrables !== true && !(Array.isArray(J.arrastrables) && J.arrastrables.length && J.arrastrables.every(par))) w('jugar.arrastrables: true o celdas ["r,c"] / [[r,c]] dentro de la rejilla');
        if (typeof J.soltar !== 'function') w('jugar.arrastrables necesita soltar(v, r, c, cx)');
      }
    }
  };
};
