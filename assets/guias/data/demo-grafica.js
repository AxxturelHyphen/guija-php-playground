// Guía demo del módulo «grafica» (temporal: se borra al terminar). Ejercita todas las funciones de la escena:
// curvas que aparecen una a una (trazo animado), ymax animado, escala lin→log, resaltar, zoom, deslizador, tabla,
// `jugar` con botones + gráfica arrastrable, una traza que barre n y una pregunta de comprobación.
// Formato de los parches: ver la cabecera de assets/guias/grafica.js.
const lg = n => Math.log2(Math.max(1, n));
const CURVAS = [
  { id: 'c1', nombre: 'O(1)', f: () => 1 },
  { id: 'log', nombre: 'O(log n)', f: lg },
  { id: 'n', nombre: 'O(n)', f: n => n },
  { id: 'nlogn', nombre: 'O(n log n)', f: n => n * lg(n) },
  { id: 'n2', nombre: 'O(n²)', f: n => n * n },
  { id: 'exp', nombre: 'O(2ⁿ)', f: n => 2 ** n },
];
const TODAS = CURVAS.map(c => c.id);
const BASE = { curvas: CURVAS, nmax: 30 };

export default {
  titulo: { es: 'Demo · gráfica de crecimiento', en: 'Demo · growth chart' },
  pasos: [
    { sec: { es: 'Cómo crece el coste', en: 'How cost grows' },
      grafica: { ...BASE, n: 10, ver: ['c1'], ymax: 4 },
      es: 'El eje horizontal es el tamaño de la entrada `n`; el vertical, cuántas operaciones hace el algoritmo. Empezamos por **O(1)**: el coste no depende de `n` (leer `v[0]`, por ejemplo). Mueve el ratón sobre la gráfica para leer valores.',
      en: 'The horizontal axis is the input size `n`; the vertical one is how many operations the algorithm performs. We start with **O(1)**: the cost does not depend on `n` (reading `v[0]`, for example). Move the mouse over the chart to read values.' },
    { ver: ['c1', 'log'], ymax: 8, n: 16,
      es: '**O(log n)**: crece, pero cada vez más despacio. Duplicar `n` solo suma una operación. Es la búsqueda binaria. Fíjate en que el eje vertical se ajusta solo.',
      en: '**O(log n)**: it grows, but ever more slowly. Doubling `n` adds just one operation. This is binary search. Notice how the vertical axis rescales by itself.' },
    { ver: ['c1', 'log', 'n'], ymax: 40, n: 20,
      es: '**O(n)**: una operación por elemento. Es una recta: el doble de datos, el doble de trabajo (recorrer un array).',
      en: '**O(n)**: one operation per element. A straight line: twice the data, twice the work (walking an array).' },
    { ver: ['c1', 'log', 'n', 'nlogn'], ymax: 160, n: 20,
      es: '**O(n log n)**: un poco peor que lineal. Es el coste de los buenos algoritmos de ordenación (`std::sort`, mergesort).',
      en: '**O(n log n)**: a bit worse than linear. It is the cost of good sorting algorithms (`std::sort`, mergesort).' },
    { ver: ['c1', 'log', 'n', 'nlogn', 'n2'], ymax: 1000, n: 20,
      es: '**O(n²)**: dos bucles anidados. La curva se dispara: con `n = 20` ya son 400 operaciones, y con `n = 30`, 900.',
      en: '**O(n²)**: two nested loops. The curve takes off: with `n = 20` that is already 400 operations, and with `n = 30`, 900.' },
    { ver: TODAS, n: 20,
      es: '**O(2ⁿ)** (probar todos los subconjuntos). Sale volando: la curva se **recorta** en el borde con una marca ▲, y su etiqueta pasa arriba. Con `n = 20` ya son más de un millón de operaciones.',
      en: '**O(2ⁿ)** (trying every subset). It shoots off: the curve is **clipped** at the edge with a ▲ mark, and its label moves to the top. With `n = 20` that is already over a million operations.' },
    { sec: { es: 'Escala logarítmica', en: 'Logarithmic scale' }, escala: 'log', ymax: null, n: 30,
      es: 'Con la escala **logarítmica** cada marca es 10 veces mayor que la anterior, y por fin cabe todo: con `n = 30`, 2ⁿ ronda los 1,1e9. Una recta en esta escala es crecimiento exponencial.',
      en: 'With the **logarithmic** scale each tick is 10 times the previous one, and at last everything fits: with `n = 30`, 2ⁿ is about 1.1e9. A straight line on this scale means exponential growth.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' },
      grafica: { ...BASE, n: 12, ver: TODAS, escala: 'lin', deslizador: true, tabla: true },
      es: 'Mueve `n` con el deslizador, con los botones o **arrastrando sobre la gráfica**. Cambia la escala y oculta 2ⁿ para ver las demás. ¿Dónde se cruzan n² y 2ⁿ?',
      en: 'Move `n` with the slider, the buttons or by **dragging on the chart**. Change the scale and hide 2ⁿ to see the others. Where do n² and 2ⁿ cross?',
      jugar: {
        botones: [
          { label: 'n − 5', hacer: v => { v.n = Math.max(0, v.n - 5); }, off: v => v.n <= 0 },
          { label: 'n + 5', hacer: v => { v.n = Math.min(v.nmax, v.n + 5); }, off: v => v.n >= v.nmax },
          { label: 'n × 2', hacer: v => { v.n = Math.min(v.nmax, Math.max(1, v.n * 2)); }, off: v => v.n >= v.nmax },
          { label: { es: 'lineal / log', en: 'linear / log' }, hacer: v => { v.escala = v.escala === 'lin' ? 'log' : 'lin'; } },
          { label: { es: 'ver / ocultar 2ⁿ', en: 'show / hide 2ⁿ' }, hacer: v => { v.ver = v.ver.includes('exp') ? v.ver.filter(i => i !== 'exp') : [...v.ver, 'exp']; } },
          { label: { es: 'resaltar n²', en: 'highlight n²' }, hacer: v => { v.resaltar = v.resaltar === 'n2' ? null : 'n2'; } },
        ],
        lecturas: (v, cx) => {
          const n2 = cx.f('n2', v.n), e = cx.f('exp', v.n), r = n2 ? e / n2 : 0;
          return [
            { expr: 'n', valor: v.n },
            { expr: 'n²', valor: cx.fmt(n2) },
            { expr: '2ⁿ', valor: cx.fmt(e) },
            { expr: '2ⁿ / n²', valor: cx.fmt(r), malo: r > 1 },
          ];
        },
        arrastrables: true,
        soltar: (v, n) => { v.n = n; },
      } },
    { sec: { es: 'Barrido de n', en: 'Sweeping n' }, n: 1,
      es: 'Reproduce el barrido: `n` va de 1 a 30 y la tabla se actualiza. Al final resaltamos n² y hacemos zoom a `n` pequeño.',
      en: 'Play the sweep: `n` goes from 1 to 30 and the table updates. At the end we highlight n² and zoom in on small `n`.',
      traza: [
        { n: 2, es: 'Con `n = 2` todo cuesta casi lo mismo: da igual el algoritmo.', en: 'With `n = 2` everything costs about the same: the algorithm hardly matters.' },
        { n: 5 }, { n: 10, es: 'Con `n = 10` aparece la primera diferencia seria: 2ⁿ ya supera a n².', en: 'At `n = 10` the first serious gap appears: 2ⁿ already beats n².' },
        { n: 15 }, { n: 20 }, { n: 25 },
        { n: 30, es: 'Con `n = 30`: n² son 900 operaciones; 2ⁿ, más de mil millones.', en: 'At `n = 30`: n² is 900 operations; 2ⁿ is over a billion.' },
        { resaltar: 'n2', es: 'Primer plano para O(n²); las demás se atenúan.', en: 'O(n²) in the foreground; the rest fade.' },
        { resaltar: null, zoom: { nmax: 10 }, n: 5, es: 'Zoom al eje: con `n` pequeño las curvas se parecen mucho más.', en: 'Zooming the axis: for small `n` the curves look far more alike.' },
      ] },
    { sec: { es: 'Comprobación', en: 'Check' }, escala: 'lin', zoom: { nmax: 30 }, n: 10, resaltar: 'n2',
      es: 'Un algoritmo O(n²) tarda 1 s con `n = 1000`. ¿Cuánto tardará, aproximadamente, con `n = 2000`?',
      en: 'An O(n²) algorithm takes 1 s with `n = 1000`. Roughly how long will it take with `n = 2000`?',
      pregunta: {
        opc: [
          { es: '2 s: el doble de datos, el doble de tiempo', en: '2 s: twice the data, twice the time' },
          { es: '4 s: el tiempo se multiplica por 2² = 4', en: '4 s: the time is multiplied by 2² = 4', ok: 1 },
          { es: '1 s: O(n²) no depende del tamaño', en: '1 s: O(n²) does not depend on the size' },
        ],
        why: {
          es: 'Si `n` se duplica, `n²` se multiplica por `(2n)²/n² = 4`. Ese «cuatro por cada doble» es la huella de O(n²) en la gráfica.',
          en: 'If `n` doubles, `n²` is multiplied by `(2n)²/n² = 4`. That “four times per doubling” is the footprint of O(n²) on the chart.',
        },
      } },
  ],
};
