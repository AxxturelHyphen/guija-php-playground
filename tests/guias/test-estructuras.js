#!/usr/bin/env node
'use strict';
/**
 * Pruebas de la guía «Estructuras de datos» sin navegador:
 *   node tests/guias/test-estructuras.js        (código de salida 0 = todo correcto)
 * Comprueba los generadores de trazas (assets/guias/data/estructuras-traza.js) contra modelos de referencia: invertir una lista,
 * invariante del ABB tras insertar/borrar, in-order ordenado, sift-up/down sobre el montículo, cola circular FIFO, y ejecuta
 * los botones de `jugar` de pila, cola, ABB y lista (el validador común solo ejecuta los de `celdas`, y no con estas escenas).
 */
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..', '..', 'assets', 'guias');
let fallos = 0, total = 0;
const ok = (c, m) => { total++; if (!c) { fallos++; console.log('  ✗ ' + m); } };
const igual = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
const seccion = n => console.log(n);
// Generador pseudoaleatorio con semilla (mulberry32): las pruebas son reproducibles.
const rng = semilla => () => { semilla |= 0; semilla = (semilla + 0x6D2B79F5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const barajar = (a, r) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

(async () => {
  const imp = f => import(pathToFileURL(path.join(RAIZ, f)).href);
  const A = await imp('arbol.js'), B = await imp('barras.js'), T = await imp('data/estructuras-traza.js'), G = (await imp('data/estructuras.js')).default;
  const { arbolVacio, arbolDeArray, recorrido, altura } = A;

  // Normaliza un árbol {nodos, aristas} para compararlo: ids con valor y aristas ordenadas.
  const forma = t => ({ n: t.nodos.map(n => `${n.id}=${n.val}`).sort(), e: t.aristas.map(e => `${e.a}>${e.b}:${e.lado}`).sort() });
  // Un estado plegado guarda los valores en S.val (los nodos conservan el val de apertura): se compara con ellos.
  const formaS = S => forma({ nodos: S.nodos.map(n => ({ ...n, val: S.val[n.id] ?? n.val })), aristas: S.aristas });
  const plegarTodo = (S, frames) => frames.reduce((s, f) => A.plegar(s, f), S);
  const abre = t => A.plegar(undefined, { arbol: { nodos: t.nodos, aristas: t.aristas, raiz: t.raiz, cabida: A.cabidaMax(t) } });
  /** ¿Es un ABB válido? Todo el subárbol izquierdo < nodo < todo el derecho (cotas por rama), sin nodos huérfanos. */
  function esABB(t) {
    if (!t.nodos.length) return !t.aristas.length;
    const hijo = (id, l) => t.aristas.find(e => e.a === id && e.lado === l)?.b, val = id => t.nodos.find(n => n.id === id).val;
    let visitados = 0;
    const rec = (id, lo, hi) => {
      if (id == null) return true;
      visitados++;
      const v = val(id);
      return v > lo && v < hi && rec(hijo(id, 'i'), lo, v) && rec(hijo(id, 'd'), v, hi);
    };
    return rec(t.raiz ?? t.nodos[0].id, -Infinity, Infinity) && visitados === t.nodos.length;
  };
  const valoresIn = t => recorrido(t, 'in').map(id => t.nodos.find(n => n.id === id).val);
  const ordenado = a => a.every((x, i) => !i || a[i - 1] < x);

  seccion('lista enlazada: recorrer, insertar al final, invertir');
  {
    const datos = { a: 10, b: 20, c: 30, d: 40 };
    igual(T.trazaRecorrer(['a', 'b', 'c'], datos).salida, [10, 20, 30], 'recorrer imprime en orden');
    igual(T.trazaAlFinal(['a', 'b', 'c'], datos, 'd', 40).orden, ['a', 'b', 'c', 'd'], 'alFinal: orden final');
    const ini = { head: '→ad', ad: 10, as: '→bd', bd: 20, bs: '→cd', cd: 30, cs: '→dd', dd: 40, ds: '→∅' };
    const plegarVal = (v0, fr) => fr.reduce((v, f) => ({ ...v, ...(f.val || {}) }), v0);
    const L3 = { ...ini, cs: '→∅' };
    const fin = plegarVal(L3, T.trazaAlFinal(['a', 'b', 'c'], datos, 'd', 40).frames);
    igual(T.analizarLista({ ...fin, head: '→ad' }).orden, ['a', 'b', 'c', 'd'], 'alFinal: la lista plegada contiene el nodo nuevo al final');
    const inv = T.trazaInvertir(['a', 'b', 'c', 'd'], datos), v1 = plegarVal(ini, inv.frames), an = T.analizarLista(v1);
    igual(an.orden, ['d', 'c', 'b', 'a'], 'invertir: recorrido desde el head nuevo');
    igual(an.orden.map(n => v1[n + 'd']), [40, 30, 20, 10], 'invertir: datos al revés');
    ok(!an.ciclo && !an.perdidos.length, 'invertir: sin ciclo ni nodos perdidos');
    igual(v1.as, '→∅', 'invertir: el antiguo primero apunta a nullptr');
    igual(v1.head, '→dd', 'invertir: head apunta al antiguo último');
    // Lista de un solo nodo y de dos: casos límite
    const i1 = T.trazaInvertir(['a'], datos);
    igual(T.analizarLista(plegarVal({ head: '→ad', as: '→∅' }, i1.frames)).orden, ['a'], 'invertir 1 nodo');
    const i2 = T.trazaInvertir(['a', 'b'], datos);
    igual(T.analizarLista(plegarVal({ head: '→ad', as: '→bd', bs: '→∅' }, i2.frames)).orden, ['b', 'a'], 'invertir 2 nodos');
  }

  seccion('lista enlazada: recablear detecta fugas y ciclos');
  {
    const v = { head: '→ad', as: '→bd', bs: '→cd', cs: '→dd', ds: '→∅' };
    let a = T.analizarLista(v);
    igual([a.orden, a.ciclo, a.perdidos], [['a', 'b', 'c', 'd'], false, []], 'lista sana');
    T.recablear(v, 'bs', 'nul');
    a = T.analizarLista(v);
    igual([a.orden, a.perdidos], [['a', 'b'], ['c', 'd']], 'cortar bs deja c y d inalcanzables (fuga)');
    T.recablear(v, 'bs', 'cd'); T.recablear(v, 'ds', 'bd');
    a = T.analizarLista(v);
    ok(a.ciclo, 'ds → b crea un ciclo');
    ok(!a.perdidos.length, 'el ciclo no pierde nodos');
    igual(a.orden, ['a', 'b', 'c', 'd'], 'el ciclo recorre cada nodo una vez antes de repetir');
    T.recablear(v, 'head', 'cs'); // destino cualquier celda del nodo c
    igual(v.head, '→cd', 'soltar sobre una celda del nodo lo apunta');
    const w = { head: '→ad', as: '→∅' };
    T.recablear(w, 'ad', 'bd'); T.recablear(w, 'nada', 'bd'); T.recablear(w, 'as', 'inventado');
    igual(w, { head: '→ad', as: '→∅' }, 'orígenes y destinos no válidos se ignoran');
  }

  seccion('ABB: invariante tras insertar y borrar, in-order ordenado');
  {
    const r = rng(7);
    for (let ronda = 0; ronda < 25; ronda++) {
      const n = 3 + Math.floor(r() * 8), vals = barajar(Array.from({ length: 30 }, (_, i) => i + 1), r).slice(0, n);
      const ins = T.trazaInsertar(vals), t = ins.arbol;
      ok(esABB(t), `insertar ${vals}: invariante`);
      igual(valoresIn(t), [...vals].sort((a, b) => a - b), `insertar ${vals}: in-order = datos ordenados`);
      const S = plegarTodo(A.plegar(undefined, { arbol: { ...arbolVacio(), cabida: A.cabidaMax(t) } }), ins.frames);
      igual(formaS(S), forma(t), `insertar ${vals}: los frames pliegan al árbol calculado`);
      // duplicados: no cambian nada
      const dup = T.trazaInsertar([vals[0]], t);
      igual(forma(dup.arbol), forma(t), 'duplicado ignorado');
      let cur = t;
      for (const x of barajar(vals, r)) {
        const d = T.trazaBorrar(cur, x);
        ok(esABB(d.arbol), `borrar ${x} de ${vals}: invariante`);
        ok(!valoresIn(d.arbol).includes(x), `borrar ${x}: ya no está`);
        igual(d.arbol.nodos.length, cur.nodos.length - 1, `borrar ${x}: un nodo menos`);
        ok(ordenado(valoresIn(d.arbol)), `borrar ${x}: in-order sigue ordenado`);
        const S0 = abre(cur);
        igual(formaS(plegarTodo(S0, d.frames)), forma(d.arbol), `borrar ${x}: los frames pliegan al árbol resultante`);
        igual(formaS(A.plegar(S0, d.parche)), forma(d.arbol), `borrar ${x}: el parche final deja el árbol resultante`);
        cur = d.arbol;
      }
      igual(cur.nodos.length, 0, 'tras borrarlo todo no queda nada');
    }
    // Los tres casos aparecen con el árbol de la guía
    const base = T.trazaInsertar([8, 4, 12, 2, 6, 10, 14, 5]).arbol;
    igual(T.trazaBorrar(base, 2).caso, 0, 'borrar hoja = caso 0');
    igual(T.trazaBorrar(base, 6).caso, 1, 'borrar con un hijo = caso 1');
    igual(T.trazaBorrar(base, 8).caso, 2, 'borrar con dos hijos = caso 2');
    const d8 = T.trazaBorrar(base, 8);
    ok(d8.arbol.nodos.find(n => n.id === 'n8').val === 10, 'la raíz copia el sucesor in-order (10)');
    // buscar
    const b = T.trazaBuscar(base, 10), nb = T.trazaBuscar(base, 7);
    igual([b.encontrado, nb.encontrado], [true, false], 'buscar encuentra / no encuentra');
    igual(b.camino.length, 3, 'camino al 10 = 8, 12, 10');
  }

  seccion('ABB: los recorridos coinciden con el helper y con su definición');
  {
    const t = T.trazaInsertar([8, 4, 12, 2, 6, 10, 14, 5]).arbol, val = id => t.nodos.find(n => n.id === id).val;
    const hijo = (id, l) => t.aristas.find(e => e.a === id && e.lado === l)?.b;
    const ref = { in: [], pre: [], post: [], niveles: [] };
    const rec = id => { if (!id) return; ref.pre.push(val(id)); rec(hijo(id, 'i')); ref.in.push(val(id)); rec(hijo(id, 'd')); ref.post.push(val(id)); };
    rec(t.raiz ?? t.nodos[0].id);
    for (let q = [t.nodos[0].id]; q.length;) { const id = q.shift(); ref.niveles.push(val(id)); q.push(...['i', 'd'].map(l => hijo(id, l)).filter(Boolean)); }
    for (const tipo of ['in', 'pre', 'post', 'niveles']) {
      const tr = T.trazaRecorrido(t, tipo, 4);
      igual(tr.salida, ref[tipo], `recorrido ${tipo}`);
      const S = plegarTodo(abre(t), tr.frames);
      ok(t.nodos.every(n => S.est[n.id] === 'visitado'), `recorrido ${tipo}: el último frame marca todo como visitado`);
    }
    igual(ref.in, [2, 4, 5, 6, 8, 10, 12, 14], 'in-order del árbol de la guía');
  }

  seccion('montículo: sift-up y sift-down mantienen la propiedad');
  {
    const r = rng(11);
    for (let ronda = 0; ronda < 40; ronda++) {
      const n = 1 + Math.floor(r() * 10);
      let h = [];
      for (let i = 0; i < n; i++) h = T.subir(h, Math.floor(r() * 90) + 1);
      ok(T.esMonticulo(h), `construcción por pushes ${h}`);
      // traza de push
      const x = Math.floor(r() * 90) + 1, a1 = T.subir(h, x), sp = T.trazaSubir(h, x);
      ok(T.esMonticulo(a1), `push ${x} en ${h}: sigue siendo montículo`);
      igual(sp.arr, a1, 'trazaSubir devuelve el mismo array que subir');
      igual([...sp.arr].sort((p, q) => p - q), [...h, x].sort((p, q) => p - q), 'push conserva los elementos');
      const S0 = A.plegar(undefined, { arbol: { ...arbolDeArray(h), cabida: A.cabidaMax(arbolDeArray(a1)) } });
      igual(formaS(plegarTodo(S0, sp.frames)), forma(arbolDeArray(a1)), `push ${x}: los frames pliegan a arbolDeArray(resultado)`);
      igual(formaS(A.plegar(S0, T.parcheHeap(h, a1))), forma(arbolDeArray(a1)), 'parcheHeap (crecer) restaura el estado');
      // traza de pop
      if (a1.length > 1) {
        const d = T.bajar(a1), bj = T.trazaBajar(a1);
        ok(T.esMonticulo(d.arr), `pop de ${a1}: sigue siendo montículo`);
        igual(d.tope, Math.max(...a1), 'pop devuelve el máximo');
        igual(bj.arr, d.arr, 'trazaBajar devuelve el mismo array que bajar');
        const S1 = A.plegar(undefined, { arbol: { ...arbolDeArray(a1), cabida: A.cabidaMax(arbolDeArray(a1)) } });
        igual(formaS(plegarTodo(S1, bj.frames)), forma(arbolDeArray(d.arr)), `pop de ${a1}: los frames pliegan a arbolDeArray(resultado)`);
        igual(formaS(A.plegar(S1, T.parcheHeap(a1, d.arr))), forma(arbolDeArray(d.arr)), 'parcheHeap (encoger) restaura el estado');
      }
    }
    // Heap-sort como prueba de extremo a extremo: los pops salen en orden decreciente
    let h = [];
    for (const x of [5, 3, 9, 1, 7, 9, 2]) h = T.subir(h, x);
    const sal = [];
    while (h.length) { const d = T.bajar(h); sal.push(d.tope); h = d.arr; }
    igual(sal, [9, 9, 7, 5, 3, 2, 1], 'vaciar el montículo da orden decreciente');
    igual([T.padre(6), T.padre(1), T.padre(2), T.padre(3)], [2, 0, 0, 1], 'padre(i) = (i-1)/2');
  }

  seccion('cola circular: FIFO frente a un modelo de referencia');
  {
    const r = rng(23);
    for (let ronda = 0; ronda < 60; ronda++) {
      const v = { arr: [0, 0, 0, 0, 0, 0], marcas: { head: 0, tail: 0 }, cont: { n: 0 }, est: {} }, modelo = [];
      for (let k = 0; k < 60; k++) {
        if (r() < 0.55) {
          const x = 1 + Math.floor(r() * 99), antes = JSON.stringify(v.arr), llena = modelo.length === T.CAP;
          const hecho = T.colaEnq(v, x);
          igual(hecho, !llena, 'enqueue acepta salvo llena');
          if (llena) igual(JSON.stringify(v.arr), antes, 'overflow no toca el array'); else modelo.push(x);
        } else {
          const y = T.colaDeq(v), esperado = modelo.shift();
          igual(y, esperado, 'dequeue devuelve el más antiguo (FIFO)');
        }
        igual(v.cont.n, modelo.length, 'n = elementos de la cola');
        ok(v.marcas.tail === (v.marcas.head + v.cont.n) % T.CAP, 'tail = (head + n) % cap');
        igual(Object.keys(v.est).map(Number).sort(), Array.from({ length: modelo.length }, (_, i) => (v.marcas.head + i) % T.CAP).sort(), 'est marca exactamente los ocupados');
      }
    }
    // La traza de la guía (la que recorre el final del array y da la vuelta)
    const ini = { arr: [4, 8, 6, 0, 0, 0], head: 1, n: 2 };
    const ops = [['E', 5], ['E', 2], ['E', 7], ['E', 1], ['D'], ['E', 9], ['D'], ['D']];
    const tr = T.trazaCola(ini, ops);
    igual(tr.salida, [8, 6, 5], 'la traza saca 8, 6, 5 (el orden de entrada)');
    igual(tr.final.cont.n, 4, 'quedan 4 elementos');
    const modelo = [8, 6];
    for (const [op, x] of ops) { if (op === 'E') modelo.length < 6 && modelo.push(x); else modelo.shift(); }
    igual(tr.final.est && Object.keys(tr.final.est).length, modelo.length, 'estado final coherente con el modelo');
    ok(tr.frames.some(f => f.es.includes('Da la vuelta')), 'la traza muestra que tail da la vuelta');
    ok(tr.frames.some(f => f.es.includes('Cola llena')), 'la traza llega a la cola llena');
    // Los frames pliegan al mismo estado final que la ejecución directa
    const S0 = B.plegar(undefined, { barras: { arr: [4, 8, 6, 0, 0, 0], estilo: 'cajas', max: 99, etiquetas: true } });
    const S1 = B.plegar(S0, { est: { 0: null, 1: 'ok', 2: 'ok' }, marcas: { head: 1, tail: 3 }, cont: { n: 2 } });
    const Sf = tr.frames.reduce((s, f) => B.plegar(s, f), S1);
    igual(Sf.marcas, tr.final.marcas, 'marcas head/tail finales');
    igual(Sf.cont.n, tr.final.cont.n, 'contador n final');
    igual(Sf.est, tr.final.est, 'celdas ocupadas finales');
  }

  seccion('pila: LIFO frente a un modelo, overflow y underflow');
  {
    const r = rng(5), v = { arr: [0, 0, 0, 0, 0, 0], marcas: { top: -1 }, cont: { tam: 0 }, est: {} }, modelo = [];
    for (let k = 0; k < 400; k++) {
      if (r() < 0.5) {
        const lleno = modelo.length === T.CAP, antes = JSON.stringify(v.arr);
        igual(T.pilaPush(v, k), !lleno, 'push acepta salvo llena');
        if (lleno) igual(JSON.stringify(v.arr), antes, 'overflow no toca el array'); else modelo.push(k);
      } else {
        const vacio = !modelo.length;
        igual(T.pilaPop(v), !vacio, 'pop acepta salvo vacía'); modelo.pop();
      }
      igual(v.marcas.top, modelo.length - 1, 'top');
      igual(T.pilaCima(v), modelo.length ? modelo.at(-1) : null, 'cima = último apilado (LIFO)');
      igual(v.cont.tam, modelo.length, 'tam');
    }
    ok(v.cont.overflow > 0 && v.cont.underflow > 0, 'se han contado errores de ambos tipos');
    const vac = { arr: [4, 8, 6, 5, 2], marcas: {}, cont: {} };
    const be = T.trazaBorrarInicio(vac.arr);
    igual(be.resultado, [8, 6, 5, 2], 'erase(begin()) desplaza todo a la izquierda');
    igual(be.frames.length, vac.arr.length, 'n-1 desplazamientos + 1 frame final');
    igual(be.frames.at(-2).cont.movimientos, vac.arr.length - 1, 'n-1 movimientos');
  }

  seccion('guía completa: estructura, texto y pliegue de todos los pasos y frames');
  const pasos = G.pasos, aperturas = [];
  {
    ok(pasos.length >= 40, `hay pasos suficientes (${pasos.length})`);
    ok(pasos[0].sec && (pasos[0].celdas || pasos[0].barras || pasos[0].arbol), 'el primer paso tiene sec y abre una escena');
    const secs = pasos.filter(p => p.sec).length;
    igual(secs, 6, 'seis secciones');
    ok(pasos.filter(p => p.pregunta).length >= 3, 'al menos 3 preguntas');
    ok(pasos.filter(p => p.jugar).length >= 3, 'al menos 3 bloques jugar');
    ok(pasos.filter(p => p.traza).length >= 4, 'al menos 4 trazas');
    for (const [i, p] of pasos.entries()) {
      ok(p.es && p.en, `paso ${i + 1}: texto en es y en`);
      for (const k of ['es', 'en']) ok(!/\*(?!\*)/.test((p[k] || '').replace(/`[^`]*`/g, '').replace(/\*\*/g, '')), `paso ${i + 1} ${k}: asteriscos sueltos fuera de código`);
      if (p.code && typeof p.code === 'object') igual(p.code.es.split('\n').length, p.code.en.split('\n').length, `paso ${i + 1}: code es/en con las mismas líneas`);
      for (const f of p.traza || []) {
        ok(f.es && f.en, `paso ${i + 1}: frame con es y en`);
        ok(f.es.length <= 140 && f.en.length <= 140, `paso ${i + 1}: subtítulo de frame breve (${f.es.length})`);
      }
      ok((p.traza || []).length <= 120, `paso ${i + 1}: traza de ≤ 120 frames`);
    }
    // Pliegue real por escena: barras y arbol se pliegan con sus módulos; celdas no se puede importar en Node (usa DOM al cargar)
    const mods = { barras: B, arbol: A };
    let tipo = null, S = null, plegados = 0;

    pasos.forEach((p, i) => {
      const nuevo = ['celdas', 'barras', 'arbol'].find(c => p[c] !== undefined);
      if (nuevo) { tipo = nuevo; S = mods[nuevo] ? mods[nuevo].plegar(undefined, p) : null; }
      else if (mods[tipo]) S = mods[tipo].plegar(S, p);
      if (!mods[tipo]) return;
      plegados++;
      aperturas.push([i, tipo, S]);
      if (p.traza) {
        let E = S;
        try { for (const f of p.traza) E = mods[tipo].plegar(E, f); } catch (e) { ok(false, `paso ${i + 1}: la traza no se pliega (${e.message})`); }
      }
    });
    ok(plegados > 20, `se han plegado ${plegados} pasos de barras/arbol sin error`);

    seccion('guía: el estado se restaura tras cada traza de árbol (el paso siguiente no depende de la traza)');
    // Tras una traza el estado NO persiste: el paso siguiente debe ser coherente por sí solo. Comprobamos la secuencia ABB.
    const iABB = pasos.findIndex(p => p.sec?.es === 'Árbol binario de búsqueda');
    const hasta = pasos.findIndex(p => p.sec?.es === 'Altura y coste');
    let SS = null, fin = null;
    for (let i = iABB; i < hasta; i++) {
      const p = pasos[i];
      SS = p.arbol !== undefined ? A.plegar(undefined, p) : A.plegar(SS, p);
      const t = { nodos: SS.nodos.map(n => ({ ...n, val: SS.val[n.id] ?? n.val })), aristas: SS.aristas, raiz: SS.def.raiz };
      if (SS.nodos.length > 1 && !p.arbol) ok(esABB(t), `paso ${i + 1}: el árbol en pantalla es un ABB válido`);
      ok(SS.nodos.every(n => SS.val[n.id] !== undefined), `paso ${i + 1}: todos los nodos tienen valor`);
      if (p.pregunta && p.hl?.n8) fin = t; // el paso de la pregunta del sucesor llega tras los tres borrados
    }
    ok(fin !== null, 'se localiza el paso posterior a los tres borrados');
    igual(fin.nodos.map(n => n.val).sort((a, b) => a - b), [4, 5, 10, 12, 14], 'tras los tres borrados quedan 4, 5, 10, 12, 14');
    const iH = pasos.findIndex(p => p.sec?.es === 'Montículo en vista de árbol'), iC = pasos.findIndex(p => p.sec?.es === 'Comparativa de costes');
    let HS = null;
    for (let i = iH; i < iC; i++) {
      const p = pasos[i];
      HS = p.arbol !== undefined ? A.plegar(undefined, p) : A.plegar(HS, p);
      const arr = HS.nodos.map(n => HS.val[n.id]);
      ok(T.esMonticulo(arr), `paso ${i + 1}: el montículo en pantalla cumple la propiedad (${arr})`);
    }
    igual(HS.nodos.map(n => HS.val[n.id]), T.bajar(T.subir([50, 30, 40, 10, 20, 35, 15], 45)).arr, 'al final de la sección el montículo es el de push(45) + pop()');
  }

  seccion('jugar: los botones de pila y cola ejecutan cada acción sin romper la escena');
  {
    const ejecutar = (nombre, i, mod, S, rondas) => {
      const J = pasos[i].jugar, v = mod.vista(S), cx = mod.ctx ? mod.ctx(S) : {};
      let usados = 0;
      for (let k = 0; k < rondas; k++) for (const b of J.botones) {
        if (!(b.off && b.off(v, cx))) { b.hacer(v, cx); usados++; }
        const lec = J.lecturas(v, cx);
        ok(Array.isArray(lec) && lec.every(l => l.expr && l.valor !== undefined && !String(l.valor).includes('NaN')), `${nombre}: lecturas válidas`);
        J.hl?.(v, cx);
        mod.conVista(S, v);
      }
      ok(usados > 0, `${nombre}: se han pulsado botones`);
      return { v, J, cx };
    };
    const iPila = pasos.findIndex(p => p.jugar && p.barras && p.marcas?.top === -1 && p.cont?.underflow === 0);
    const iCola = pasos.findIndex(p => p.jugar && p.barras && p.marcas?.head === 0 && p.cont?.underflow === 0);
    ok(iPila >= 0 && iCola >= 0, 'se localizan los jugar de pila y cola');
    const ap = Object.fromEntries(aperturas.map(([i, , S]) => [i, S]));

    // Pila
    const sp = B.plegar(undefined, pasos[iPila]);
    {
      const { v, J } = ejecutar('pila', iPila, B, sp, 30);
      ok(v.marcas.top >= -1 && v.marcas.top <= 5, 'pila: top en rango');
      ok(v.cont.overflow > 0 || v.cont.underflow > 0, 'pila: algún error contado tras 30 rondas');
      // secuencia concreta: push, push, pop deja top = 0
      const w = B.vista(sp), [p7, p3, pop] = J.botones;
      p7.hacer(w); p3.hacer(w); pop.hacer(w);
      igual([w.marcas.top, w.arr[0], w.arr[1], pilaLec(J, w, 'cima()')], [0, 7, 3, 7], 'pila: push(7), push(3), pop() → top 0, el 3 queda en su hueco');
      for (let k = 0; k < 8; k++) p7.hacer(w);
      ok(w.cont.overflow >= 2 && w.marcas.top === 5, 'pila: llenar de más cuenta overflow y deja top = 5');
      for (let k = 0; k < 8; k++) pop.hacer(w);
      ok(w.cont.underflow >= 2 && w.marcas.top === -1, 'pila: vaciar de más cuenta underflow y deja top = -1');
      ok(J.lecturas(w).find(l => l.expr === 'cima()').malo, 'pila: cima() de la vacía se marca como mala');
    }
    function pilaLec(J, v, expr) { return J.lecturas(v).find(l => l.expr === expr).valor; }

    // Cola
    const sc = B.plegar(undefined, pasos[iCola]);
    {
      const { v, J } = ejecutar('cola', iCola, B, sc, 30);
      ok(v.cont.n >= 0 && v.cont.n <= 6, 'cola: n en rango');
      const w = B.vista(sc), [e7, e3, deq] = J.botones;
      for (let k = 0; k < 5; k++) e7.hacer(w);
      deq.hacer(w); deq.hacer(w); e3.hacer(w); e3.hacer(w); e3.hacer(w);
      igual([w.marcas.head, w.marcas.tail, w.cont.n], [2, 2, 6], 'cola: tail da la vuelta y la cola queda llena (head == tail)');
      ok(!J.lecturas(w).find(l => l.expr === 'errores').malo, 'cola: sin errores hasta ahora');
      e7.hacer(w);
      ok(w.cont.overflow === 1, 'cola: enqueue con la cola llena cuenta overflow');
    }
  }

  seccion('jugar: ABB (inserta en el árbol vivo y lee altura y nodos)');
  {
    const i = pasos.findIndex(p => p.jugar && p.arbol);
    ok(i >= 0, 'se localiza el jugar del ABB');
    const S = A.plegar(undefined, pasos[i]), J = pasos[i].jugar;
    const v = A.vista(S), cx = A.ctx(S), [mayor, azar, reinicio] = J.botones;
    const lec = () => Object.fromEntries(J.lecturas(v, cx).map(l => [l.expr, l.valor]));
    igual([lec().n, lec().h], [0, 0], 'árbol vacío: n = 0 y h = 0');
    for (let k = 0; k < 10; k++) mayor.hacer(v, cx);
    igual([lec().n, lec().h], [10, 10], 'insertar «mayor + 1» diez veces degenera: h = n = 10');
    ok(mayor.off(v, cx) && azar.off(v, cx), 'a 10 nodos se desactivan los botones de insertar');
    ok(J.lecturas(v, cx).find(l => l.expr === 'h / mín').malo, 'la lectura h / mín se marca como mala al degenerar');
    ok(esABB(cx.arbol), 'degenerado: sigue siendo ABB válido');
    reinicio.hacer(v, cx);
    igual([lec().n, lec().h], [0, 0], 'Reiniciar vacía el árbol');
    const r = rng(3);
    const real = Math.random; Math.random = r;
    try {
      for (let k = 0; k < 10; k++) { azar.hacer(v, cx); ok(esABB(cx.arbol), 'al azar: ABB válido tras cada inserción'); }
    } finally { Math.random = real; }
    const n = lec().n, h = lec().h, min = Math.ceil(Math.log2(n + 1));
    ok(n === 10 && h >= min && h <= n, `al azar: ${min} ≤ h=${h} ≤ n=${n}`);
    ok(new Set(cx.arbol.nodos.map(x => x.val)).size === n, 'sin valores repetidos');
    const pintable = A.conVista(S, v);
    ok(pintable.nodos === S.nodos && pintable.nodos.length === n, 'la escena pinta los nodos vivos');
    ok(pintable.nodos.every(x => pintable.val[x.id] === undefined || pintable.val[x.id] === x.val), 'val de la vista no contradice a los nodos');
    ok(A.cabidaMax(cx.arbol).niveles <= S.def.cabida.niveles, 'cabida: el árbol del juego cabe en la reserva');
    reinicio.hacer(v, cx);
    ok(!S.nodos.length && !S.aristas.length, 'Reiniciar deja el estado de apertura vacío (se puede volver a este paso)');
  }

  seccion('jugar: lista enlazada (recablear con lecturas de fuga y ciclo)');
  {
    const i = pasos.findIndex(p => p.jugar && p.celdas);
    ok(i >= 0, 'se localiza el jugar de la lista');
    const J = pasos[i].jugar, ini = pasos[i].val;
    ok(pasos[i].celdas.every(c => c.id && c.addr), 'las celdas tienen id y dirección');
    const INI = { head: '→ad', ad: 10, as: '→bd', bd: 20, bs: '→cd', cd: 30, cs: '→dd', dd: 40, ds: '→∅' };
    ok(J.arrastrables.every(id => pasos[i].celdas.some(c => c.id === id)), 'los arrastrables existen como celdas');
    const v = { ...INI, ...ini }, lec = () => Object.fromEntries(J.lecturas(v).map(l => [l.expr, l]));
    igual(lec()['recorrer(head)'].valor, '10 → 20 → 30 → 40 → ∅', 'recorrido inicial');
    ok(!lec().ciclo.malo && !lec().inalcanzables.malo, 'estado inicial sin problemas');
    J.soltar(v, 'bs', 'nul');
    ok(lec().inalcanzables.malo && lec().inalcanzables.valor === '30, 40', 'cortar bs: 30 y 40 inalcanzables (fuga)');
    ok(Object.keys(J.hl(v)).includes('gc') && Object.keys(J.hl(v)).includes('gd'), 'los nodos perdidos se resaltan');
    J.soltar(v, 'bs', 'cd'); J.soltar(v, 'ds', 'ad');
    ok(lec().ciclo.malo && lec().ciclo.valor === 'true', 'ds → a: ciclo');
    ok(/ciclo/.test(lec()['recorrer(head)'].valor), 'el recorrido avisa del ciclo (no se queda colgado)');
    J.botones[0].hacer(v);
    igual(v.head, '→bd', 'head = head->sig avanza head');
    J.botones[1].hacer(v);
    igual(lec()['recorrer(head)'].valor, '10 → 20 → 30 → 40 → ∅', 'Reiniciar restaura la lista');
    // head->sig sobre lista vacía no rompe
    const vac = { ...INI, head: '→∅' };
    ok(J.botones[0].off(vac), 'head = head->sig se desactiva con la lista vacía');
  }

  console.log(fallos ? `\n✗ ${fallos} de ${total} comprobaciones fallan` : `\n✓ ${total} comprobaciones correctas`);
  process.exitCode = fallos ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
