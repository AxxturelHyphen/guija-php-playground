// Guía «Resolver sistemas: eliminación gaussiana» (Álgebra lineal, lección 2). Sigue MML §2.3: solución particular y general,
// operaciones elementales, forma escalonada (reducida), eliminación gaussiana, truco del −1, inversa con [A|I] y algoritmos
// (pseudoinversa, coste cúbico, métodos iterativos). Ejemplos propios. Las trazas se generan EJECUTANDO las operaciones de fila.
// Escenas `vectores` (assets/guias/vectores.js) y `tabla` (assets/guias/tabla.js); formato de los pasos en data/punteros.js.
const B = x => `\\bm{${x}}`; // \bm = \boldsymbol en KaTeX (más corto: los textos tienen tope de longitud)
const A = B('A'), I = B('I'), X = B('x'), b = B('b'), P = B('p'), N = B('n'), Z = B('0'), T = '^{\\top}';
const mat = (...filas) => `\\begin{bmatrix}${filas.map(f => f.join('&')).join('\\\\')}\\end{bmatrix}`;
const par2 = (cx, p) => `(${cx.fmt(p[0])} ; ${cx.fmt(p[1])})`;
const SUB = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
const neg = x => String(x).replace('-', '−');

// ── Operaciones de fila (exactas: todo son enteros) y trazas ───────────────────────────────────────────────────
const copia = M => M.map(f => [...f]);
function aplicar(M, op) {
  const R = copia(M);
  if (op.t === 'swap') [R[op.i], R[op.j]] = [R[op.j], R[op.i]];
  else if (op.t === 'suma') R[op.d] = R[op.d].map((x, c) => x + op.k * M[op.s][c]);
  else if (op.t === 'esc') R[op.d] = R[op.d].map(x => op.k * x);
  return R.map(f => f.map(x => (Object.is(x, -0) ? 0 : x)));
}
const R_ = i => `R${SUB(i + 1)}`;
function textoOp(op) {
  if (op.t === 'swap') return `${R_(op.i)} ↔ ${R_(op.j)}`;
  if (op.t === 'esc') return `${R_(op.d)} ← (${neg(op.k)})·${R_(op.d)}`;
  const k = Math.abs(op.k);
  return `${R_(op.d)} ← ${R_(op.d)} ${op.k < 0 ? '−' : '+'} ${k === 1 ? '' : k + '·'}${R_(op.s)}`;
}
/** Frames de una eliminación: por cada operación, uno que la anuncia (filas implicadas) y otro que la aplica. */
function traza(M0, ops) {
  const fr = []; let M = M0;
  for (const op of ops) {
    const filas = op.t === 'swap' ? [op.i, op.j] : [op.d], est = {};
    if (op.piv) est[`${op.piv[0]},${op.piv[1]}`] = 'activa';
    if (op.t === 'suma') M[op.s].forEach((_, c) => { if (!op.piv || c !== op.piv[1] || op.s !== op.piv[0]) est[`${op.s},${c}`] = 'lee'; });
    const t = textoOp(op);
    fr.push({ est, resaltar: { filas }, formula: t, es: `${t}: ${op.es}`, en: `${t}: ${op.en}` });
    M = aplicar(M, op);
    fr.push({ val: copia(M), formula: t, es: op.tras?.es ?? t, en: op.tras?.en ?? t });
  }
  return { frames: fr, final: M };
}
const pivotes = (M, nc) => {
  const e = {};
  M.forEach((f, r) => { const c = f.slice(0, nc).findIndex(x => x !== 0); if (c >= 0) e[`${r},${c}`] = 'hecha'; });
  return e;
};

// ── Sistema principal 3×4: 2x₁+4x₂+3x₃−x₄=9 · x₁+2x₂+x₃=4 · x₁+2x₂+4x₃−3x₄=7 ─────────────────────────────────
const M0 = [[2, 4, 3, -1, 9], [1, 2, 1, 0, 4], [1, 2, 4, -3, 7]];
const OPS = [
  { t: 'swap', i: 0, j: 1, es: 'el pivote más cómodo es un 1', en: 'the handiest pivot is a 1', tras: { es: 'Pivote 1 arriba a la izquierda.', en: 'Pivot 1 in the top left.' } },
  { t: 'suma', d: 1, s: 0, k: -2, piv: [0, 0], es: 'anula el 2 bajo el pivote', en: 'clear the 2 below the pivot', tras: { es: 'Debajo del pivote, un cero.', en: 'A zero below the pivot.' } },
  { t: 'suma', d: 2, s: 0, k: -1, piv: [0, 0], es: 'anula el 1 bajo el pivote', en: 'clear the 1 below the pivot', tras: { es: 'Columna 1 limpia. La columna 2 no tiene pivote posible: es todo ceros por debajo.', en: 'Column 1 is clean. Column 2 has no possible pivot: all zeros below.' } },
  { t: 'suma', d: 2, s: 1, k: -3, piv: [1, 2], es: 'pivote en la columna 3; anula el 3 de debajo', en: 'pivot in column 3; clear the 3 below', tras: { es: 'Forma escalonada: la última fila es 0 = 0.', en: 'Row-echelon form: the last row reads 0 = 0.' } },
];
const G = traza(M0, OPS);              // G.final = [[1,2,1,0,4],[0,0,1,-1,1],[0,0,0,0,0]]
const REF = G.final;
const RREF = aplicar(REF, { t: 'suma', d: 0, s: 1, k: -1 }); // [[1,2,0,1,3],[0,0,1,-1,1],[0,0,0,0,0]]
const CAB3 = { filas: ['R₁', 'R₂', 'R₃'], cols: ['x₁', 'x₂', 'x₃', 'x₄', 'b'], esq: '' };

// ── Truco del −1 sobre la parte izquierda de la forma reducida ────────────────────────────────────────────────
const AR = RREF.slice(0, 2).map(f => f.slice(0, 4));                     // A en forma reducida sin filas nulas
const AT = [AR[0], [0, -1, 0, 0], AR[1], [0, 0, 0, -1]];                  // Ã ∈ ℝ⁴ˣ⁴
const KER = [1, 3];                                                       // columnas con −1 en la diagonal
const columna = c => AT.map(f => f[c]);
const Ax = x => AR.map(f => f.reduce((s, a, j) => s + a * x[j], 0));
const vstr = x => `[${x.map(neg).join(', ')}]ᵀ`;
const soltarK = (v, r, c) => {
  v.col = c; v.est = {};
  for (let rr = 0; rr < 4; rr++) v.est[`${rr},${c}`] = KER.includes(c) ? 'camino' : 'mal';
  v.resaltar = { filas: [], cols: [c] };
};

// ── Inversa con [A | I] ─────────────────────────────────────────────────────────────────────────────────────
const INV0 = [[2, 1, 1, 0], [1, 1, 0, 1]];
const GI = traza(INV0, [
  { t: 'swap', i: 0, j: 1, es: 'pivote 1 arriba', en: 'pivot 1 on top' },
  { t: 'suma', d: 1, s: 0, k: -2, piv: [0, 0], es: 'cero bajo el pivote', en: 'zero below the pivot' },
  { t: 'esc', d: 1, k: -1, es: 'el pivote debe valer 1', en: 'the pivot must be 1' },
  { t: 'suma', d: 0, s: 1, k: -1, piv: [1, 1], es: 'cero encima del pivote', en: 'zero above the pivot', tras: { es: 'A la izquierda, I₂; a la derecha, A⁻¹.', en: 'On the left, I₂; on the right, A⁻¹.' } },
]);

// ── Vista 2D: x₁ + 2x₂ = 4 = particular + núcleo ──────────────────────────────────────────────────────────────
const soltarV = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };
const CAPAS_PN = [
  { tipo: 'span', vecs: ['n'] },
  { tipo: 'recta', a: 1, b: 2, c: 4, nombre: '$x_1+2x_2=4$' },
  { tipo: 'flecha', a: 'n' }, { tipo: 'flecha', a: 'p' },
  { tipo: 'comb', coef: [1, 'l'], vecs: ['p', 'n'], nombre: `$${P}+\\lambda${N}$` },
];
// ── Vista 2D: operación de fila R₂ ← R₂ + k·R₁ sobre x₁ + 2x₂ = 4 · 3x₁ + x₂ = 7 ─────────────────────────────────
const conK = k => ({ k, A2: 3 + k, B2: 1 + 2 * k, C2: 7 + 4 * k });
const soltarR = (v, key, val) => { if (Array.isArray(val)) v.vec[key] = val; else { v[key] = val; Object.assign(v, conK(v.k)); } };
const CAPAS_R = [
  { tipo: 'recta', a: 1, b: 2, c: 4, nombre: '(1)' },
  { tipo: 'recta', a: 'A2', b: 'B2', c: 'C2', nombre: '(2)' },
  { tipo: 'flecha', a: 'n1' },
  { tipo: 'comb', coef: [1, 'k'], vecs: ['n2', 'n1'], nombre: `$${N}_2+k${N}_1$` },
  { tipo: 'punto', x: 2, y: 1, nombre: '$(2,1)$' },
];

const CODIGO = [
  'import numpy as np',
  '',
  'A = np.array([[2., 1.], [1., 1.]])',
  'b = np.array([3., 2.])',
  'print(np.linalg.solve(A, b))',
  '',
  'X = np.array([[1., 0.], [1., 1.], [1., 2.]])',
  'y = np.array([1., 2., 2.])',
  'theta, *_ = np.linalg.lstsq(X, y, rcond=None)',
  'print(theta)',
  'print(np.linalg.pinv(X) @ y)',
  'print(np.linalg.solve(X.T @ X, X.T @ y))',
].join('\n');

export default {
  titulo: { es: 'Resolver sistemas: eliminación gaussiana', en: 'Solving systems: Gaussian elimination' },
  fuentes: [
    'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com',
  ],
  pasos: [
    // ── MML §2.3.1: particular + homogénea ──
    { sec: { es: 'Solución particular y general', en: 'Particular and general solution' },
      vectores: { x: [-3, 5.5], y: [-1.5, 3.5], vec: { p: [4, 0], n: [-2, 1] }, par: { l: 0 }, arrastrar: ['p'], paso: .5,
        deslizadores: [{ par: 'l', min: -3, max: 3, paso: .1, es: 'Parámetro $\\lambda$', en: 'Parameter $\\lambda$', dec: 1 }], capas: CAPAS_PN,
        etiqueta: { es: 'Recta solución de x1 + 2x2 = 4, solución particular p y dirección n del núcleo', en: 'Solution line of x1 + 2x2 = 4, particular solution p and kernel direction n' } },
      es: 'Una sola ecuación, $x_1+2x_2=4$, ya tiene infinitas soluciones: toda una recta. MML §2.3.1 las ordena así: una **solución particular** $' + P + '$ (aquí $(4,0)$) más **todas** las soluciones de $' + A + X + '=' + Z + '$, que aquí son los múltiplos de $' + N + '=(-2,1)$, porque $-2+2\\cdot1=0$.',
      en: 'A single equation, $x_1+2x_2=4$, already has infinitely many solutions: a whole line. MML §2.3.1 organizes them as one **particular solution** $' + P + '$ (here $(4,0)$) plus **all** solutions of $' + A + X + '=' + Z + '$, which here are the multiples of $' + N + '=(-2,1)$, because $-2+2\\cdot1=0$.' },
    { es: 'Mueve $\\lambda$: $' + P + '+\\lambda' + N + '$ recorre justo la recta solución. La recta sombreada por el origen son las soluciones de $' + A + X + '=' + Z + '$; la recta solución es esa misma, **desplazada** por $' + P + '$. Arrastra $' + P + '$ a otro punto de la recta: la particular **no es única**. ¿Y si la sacas de la recta?',
      en: 'Move $\\lambda$: $' + P + '+\\lambda' + N + '$ traces exactly the solution line. The shaded line through the origin is the solution set of $' + A + X + '=' + Z + '$; the solution line is that same line, **shifted** by $' + P + '$. Drag $' + P + '$ to another point of the line: the particular solution is **not unique**. And if you move it off the line?',
      jugar: {
        botones: [
          { label: 'λ = 0', hacer: v => { v.l = 0; } },
          { label: 'p = (0 ; 2)', hacer: v => { v.vec.p = [0, 2]; } },
          { label: 'p = (4 ; 0)', hacer: v => { v.vec.p = [4, 0]; } },
        ],
        lecturas: (v, cx) => {
          const q = cx.comb([1, v.l], [v.vec.p, v.vec.n]), ax = q[0] + 2 * q[1], ap = v.vec.p[0] + 2 * v.vec.p[1];
          return [
            { expr: '$' + P + '+\\lambda' + N + '$', valor: par2(cx, q) },
            { expr: '$x_1+2x_2$', valor: cx.fmt(ax), malo: Math.abs(ax - 4) > 1e-6 },
            { expr: { es: '¿p es solución?', en: 'is p a solution?' }, valor: Math.abs(ap - 4) < 1e-6 ? '✓' : '✗', malo: Math.abs(ap - 4) > 1e-6 },
          ];
        },
        arrastrables: true, soltar: soltarV,
      } },
    { vec: { p: [4, 0] }, par: { l: 1 },
      es: '**Receta** (MML §2.3.1): 1) halla una solución particular de $' + A + X + '=' + b + '$; 2) halla todas las de $' + A + X + '=' + Z + '$; 3) súmalas. Funciona porque si $' + A + P + '=' + b + '$ y $' + A + N + '=' + Z + '$, entonces $' + A + '(' + P + '+' + N + ')=' + b + '$; y la diferencia de dos soluciones de $' + A + X + '=' + b + '$ resuelve $' + A + X + '=' + Z + '$.',
      en: '**Recipe** (MML §2.3.1): 1) find a particular solution of $' + A + X + '=' + b + '$; 2) find all solutions of $' + A + X + '=' + Z + '$; 3) add them. It works because if $' + A + P + '=' + b + '$ and $' + A + N + '=' + Z + '$, then $' + A + '(' + P + '+' + N + ')=' + b + '$; and the difference of two solutions of $' + A + X + '=' + b + '$ solves $' + A + X + '=' + Z + '$.' },
    { tabla: { filas: 2, cols: 5, cab: { filas: ['R₁', 'R₂'], cols: ['x₁', 'x₂', 'x₃', 'x₄', 'b'], esq: '' }, val: [[1, 0, 3, -2, 7], [0, 1, -1, 5, 4]] },
      hl: { '0,4': 'activa', '1,4': 'activa' },
      es: 'Si la matriz ya es «fácil», se lee a ojo. En $' + mat([1, 0, 3, -2], [0, 1, -1, 5]) + X + '=' + mat([7], [4]) + '$, con columnas $' + B('c') + '_1,\\dots,' + B('c') + '_4$, se ve que $' + b + '=7' + B('c') + '_1+4' + B('c') + '_2$: una solución particular es $[7,4,0,0]' + T + '$.',
      en: 'If the matrix is already "easy", you can read it off. In $' + mat([1, 0, 3, -2], [0, 1, -1, 5]) + X + '=' + mat([7], [4]) + '$, with columns $' + B('c') + '_1,\\dots,' + B('c') + '_4$, we see $' + b + '=7' + B('c') + '_1+4' + B('c') + '_2$: a particular solution is $[7,4,0,0]' + T + '$.' },
    { hl: { '0,2': 'activa', '1,2': 'activa', '0,3': 'lee', '1,3': 'lee' },
      es: 'Para $' + A + X + '=' + Z + '$ escribe cada columna «difícil» con las fáciles: $' + B('c') + '_3=3' + B('c') + '_1-' + B('c') + '_2$, luego $3' + B('c') + '_1-' + B('c') + '_2-' + B('c') + '_3=' + Z + '$ y $[3,-1,-1,0]' + T + '$ resuelve el homogéneo. Igual, $' + B('c') + '_4=-2' + B('c') + '_1+5' + B('c') + '_2$ da $[-2,5,0,-1]' + T + '$. Cualquier múltiplo sirve.',
      en: 'For $' + A + X + '=' + Z + '$ write each "hard" column with the easy ones: $' + B('c') + '_3=3' + B('c') + '_1-' + B('c') + '_2$, so $3' + B('c') + '_1-' + B('c') + '_2-' + B('c') + '_3=' + Z + '$ and $[3,-1,-1,0]' + T + '$ solves the homogeneous system. Likewise $' + B('c') + '_4=-2' + B('c') + '_1+5' + B('c') + '_2$ gives $[-2,5,0,-1]' + T + '$. Any multiple works.' },
    { es: 'Solución general: $\\{' + X + '\\in\\mathbb{R}^4:' + X + '=' + mat([7], [4], [0], [0]) + '+\\lambda_1' + mat([3], [-1], [-1], [0]) + '+\\lambda_2' + mat([-2], [5], [0], [-1]) + ',\\;\\lambda_1,\\lambda_2\\in\\mathbb{R}\\}$. Ni la particular ni esta forma de escribirla son únicas (MML §2.3.1); el **conjunto** sí.',
      en: 'General solution: $\\{' + X + '\\in\\mathbb{R}^4:' + X + '=' + mat([7], [4], [0], [0]) + '+\\lambda_1' + mat([3], [-1], [-1], [0]) + '+\\lambda_2' + mat([-2], [5], [0], [-1]) + ',\\;\\lambda_1,\\lambda_2\\in\\mathbb{R}\\}$. Neither the particular solution nor this way of writing it is unique (MML §2.3.1); the **set** is.' },
    { es: '¿Es $[4,5,1,0]' + T + '$ solución de este sistema?',
      en: 'Is $[4,5,1,0]' + T + '$ a solution of this system?',
      pregunta: {
        opc: [
          { es: 'Sí: es la general con $\\lambda_1=-1,\\ \\lambda_2=0$', en: 'Yes: it is the general one with $\\lambda_1=-1,\\ \\lambda_2=0$', ok: 1 },
          { es: 'No: no coincide con la particular $[7,4,0,0]' + T + '$', en: 'No: it differs from the particular $[7,4,0,0]' + T + '$' },
          { es: 'No: $x_3$ tiene que valer $0$', en: 'No: $x_3$ must be $0$' },
        ],
        why: {
          es: 'Sustituye: $4+3\\cdot1-2\\cdot0=7$ y $5-1+5\\cdot0=4$. Y $[7,4,0,0]' + T + '-[3,-1,-1,0]' + T + '=[4,5,1,0]' + T + '$. Era **otra** particular igual de válida.',
          en: 'Substitute: $4+3\\cdot1-2\\cdot0=7$ and $5-1+5\\cdot0=4$. And $[7,4,0,0]' + T + '-[3,-1,-1,0]' + T + '=[4,5,1,0]' + T + '$. It was **another** equally valid particular solution.',
        },
        pistas: [{ es: 'Sustituye en las dos ecuaciones: $x_1+3x_3-2x_4$ y $x_2-x_3+5x_4$.', en: 'Substitute into both equations: $x_1+3x_3-2x_4$ and $x_2-x_3+5x_4$.' }],
      } },

    // ── MML §2.3.2: operaciones elementales ──
    { sec: { es: 'Operaciones elementales', en: 'Elementary transformations' },
      vectores: { x: [-2, 5.5], y: [-6.2, 4.2], vec: { n1: [1, 2], n2: [3, 1] }, par: conK(0), arrastrar: [],
        deslizadores: [{ par: 'k', min: -3.5, max: 1, paso: .1, es: 'Factor $k$ en $R_2\\leftarrow R_2+kR_1$', en: 'Factor $k$ in $R_2\\leftarrow R_2+kR_1$', dec: 1 }], capas: CAPAS_R,
        etiqueta: { es: 'Rectas de un sistema 2×2 y la recta 2 tras sumarle k veces la ecuación 1', en: 'Lines of a 2×2 system and line 2 after adding k times equation 1' } },
      es: 'Para sistemas grandes, se transforman sin cambiar sus soluciones con **operaciones elementales** (MML §2.3.2): **intercambiar** dos ecuaciones; **multiplicar** una por $\\lambda\\in\\mathbb{R}\\setminus\\{0\\}$; **sumar** a una ecuación otra (o un múltiplo de otra). Las tres se pueden deshacer: por eso no ganan ni pierden soluciones.',
      en: 'Large systems are transformed without changing their solutions using **elementary transformations** (MML §2.3.2): **swap** two equations; **multiply** one by $\\lambda\\in\\mathbb{R}\\setminus\\{0\\}$; **add** to one equation another (or a multiple of another). All three can be undone: that is why they neither gain nor lose solutions.' },
    { es: 'Aplica $R_2\\leftarrow R_2+kR_1$ moviendo $k$: la recta (2) **gira alrededor de la solución** $(2,1)$, que no se mueve. Sus coeficientes forman $' + N + '_2+k' + N + '_1$, perpendicular a la recta. Con $k=-3$ desaparece $x_1$: queda $-5x_2=-5$ y se lee $x_2=1$. Eso es **eliminar** una variable.',
      en: 'Apply $R_2\\leftarrow R_2+kR_1$ by moving $k$: line (2) **turns around the solution** $(2,1)$, which does not move. Its coefficients form $' + N + '_2+k' + N + '_1$, perpendicular to the line. With $k=-3$, $x_1$ disappears: $-5x_2=-5$ remains and $x_2=1$ can be read off. That is **eliminating** a variable.',
      jugar: {
        botones: [
          { label: 'k = −3', hacer: v => Object.assign(v, conK(-3)) },
          { label: 'k = 0', hacer: v => Object.assign(v, conK(0)) },
          { label: 'k = 1', hacer: v => Object.assign(v, conK(1)) },
        ],
        lecturas: (v, cx) => {
          const r = cx.resolver(1, 2, 4, v.A2, v.B2, v.C2);
          return [
            { expr: { es: 'ecuación (2)', en: 'equation (2)' }, valor: `${cx.fmt(v.A2)}·x₁ ${v.B2 < 0 ? '−' : '+'} ${cx.fmt(Math.abs(v.B2))}·x₂ = ${cx.fmt(v.C2)}` },
            { expr: { es: 'solución del sistema', en: 'solution of the system' }, valor: r.tipo === 'unica' ? `(${cx.fmt(r.x)} ; ${cx.fmt(r.y)})` : '—' },
            { expr: { es: '¿x₁ eliminada?', en: 'x₁ eliminated?' }, valor: Math.abs(v.A2) < 1e-9 ? '✓' : '✗', malo: Math.abs(v.A2) >= 1e-9 },
          ];
        },
        arrastrables: true, soltar: soltarR,
      } },

    // ── Matriz aumentada y eliminación gaussiana ──
    { sec: { es: 'La matriz aumentada', en: 'The augmented matrix' },
      tabla: { filas: 3, cols: 5, cab: CAB3, val: M0 }, formula: '[A | b]',
      es: 'Escribir las $x_j$ sobra: basta la **matriz aumentada** $[' + A + '\\,|\\,' + b + ']$ (MML §2.3.2), una fila por ecuación. Resolvamos $2x_1+4x_2+3x_3-x_4=9$, $x_1+2x_2+x_3=4$ y $x_1+2x_2+4x_3-3x_4=7$: tres ecuaciones y cuatro incógnitas.',
      en: 'Writing the $x_j$ is redundant: the **augmented matrix** $[' + A + '\\,|\\,' + b + ']$ is enough (MML §2.3.2), one row per equation. Let us solve $2x_1+4x_2+3x_3-x_4=9$, $x_1+2x_2+x_3=4$ and $x_1+2x_2+4x_3-3x_4=7$: three equations and four unknowns.' },
    { es: 'Reproduce la eliminación. Cada paso es una operación elemental; la meta es dejar **ceros debajo** de cada pivote, columna a columna de izquierda a derecha. Las operaciones actúan sobre la fila entera, $' + b + '$ incluido.',
      en: 'Play the elimination. Each step is an elementary transformation; the goal is to leave **zeros below** each pivot, column by column from left to right. The operations act on the whole row, $' + b + '$ included.',
      leyenda: ['activo', 'compara'], traza: G.frames },
    { val: REF, est: pivotes(REF, 4), resaltar: null, formula: { es: 'forma escalonada por filas', en: 'row-echelon form' },
      es: 'Es la **forma escalonada por filas** (MML Def. 2.6): las filas de ceros están abajo y, en las demás, el primer número no nulo por la izquierda, el **pivote**, queda siempre estrictamente a la derecha del pivote de la fila de arriba. De ahí la **escalera**.',
      en: 'This is the **row-echelon form** (MML Def. 2.6): rows of zeros are at the bottom and, in the others, the first nonzero number from the left, the **pivot**, is always strictly to the right of the pivot of the row above. Hence the **staircase**.',
      leyenda: ['hecho'] },
    { es: 'Las variables de las columnas con pivote son **básicas** (aquí $x_1,x_3$) y el resto, **libres** ($x_2,x_4$) (MML §2.3.2). La fila $[0\\;0\\;0\\;0\\,|\\,0]$ dice $0=0$: la tercera ecuación era combinación de las otras dos y no aportaba nada.',
      en: 'The variables of the pivot columns are **basic** (here $x_1,x_3$) and the rest are **free** ($x_2,x_4$) (MML §2.3.2). The row $[0\\;0\\;0\\;0\\,|\\,0]$ says $0=0$: the third equation was a combination of the other two and added nothing.' },
    { deriva: {
        pregunta: { es: 'Si el término independiente de la tercera ecuación fuera $8$ en vez de $7$, ¿cómo acabaría la última fila?', en: 'If the right-hand side of the third equation were $8$ instead of $7$, how would the last row end?' },
        opciones: [{ es: '$[0\\;0\\;0\\;0\\,|\\,1]$', en: '$[0\\;0\\;0\\;0\\,|\\,1]$' }, { es: '$[0\\;0\\;0\\;0\\,|\\,0]$, igual', en: '$[0\\;0\\;0\\;0\\,|\\,0]$, the same' }, { es: '$[0\\;0\\;0\\;0\\,|\\,8]$', en: '$[0\\;0\\;0\\;0\\,|\\,8]$' }], correcta: 0,
        razones: [
          { es: 'Las operaciones también actúan sobre $' + b + '$: $8-4-3\\cdot1=1$', en: 'The operations also act on $' + b + '$: $8-4-3\\cdot1=1$' },
          { es: 'La columna $' + b + '$ no interviene en la eliminación', en: 'Column $' + b + '$ takes no part in the elimination' },
        ], razonCorrecta: 0,
        pistas: [{ es: 'Sigue solo la última columna: a la fila 3 se le restó $R_1$ (que tenía $4$) y luego $3R_2$ (que tenía $1$).', en: 'Follow only the last column: row 3 had $R_1$ (with $4$) subtracted, then $3R_2$ (with $1$).' }],
        revela: { es: 'La parte izquierda no depende de $' + b + '$, así que la fila sigue siendo de ceros, pero a la derecha queda $1$.', en: 'The left part does not depend on $' + b + '$, so the row is still zeros, but $1$ is left on the right.' },
      },
      val: { '2,4': 1 }, est: { ...pivotes(REF, 4), '2,4': 'mal', '2,0': 'mal', '2,1': 'mal', '2,2': 'mal', '2,3': 'mal' },
      es: 'Queda $0x_1+0x_2+0x_3+0x_4=1$: imposible. El sistema es **incompatible**. Una fila $[0\\;\\cdots\\;0\\,|\\,c]$ con $c\\neq0$ es justo la señal de que no hay solución; con $c=0$, la ecuación sobra.',
      en: 'We get $0x_1+0x_2+0x_3+0x_4=1$: impossible. The system is **inconsistent**. A row $[0\\;\\cdots\\;0\\,|\\,c]$ with $c\\neq0$ is exactly the sign that there is no solution; with $c=0$, the equation is redundant.',
      leyenda: ['mal'] },
    { val: REF, est: pivotes(REF, 4), hl: { '0,0': 'camino', '1,2': 'camino', '0,4': 'activa', '1,4': 'activa' },
      es: 'Particular desde la escalonada (MML §2.3.2): escribe $' + b + '$ con las **columnas pivote**, de derecha a izquierda: $\\lambda_1' + mat([1], [0], [0]) + '+\\lambda_2' + mat([1], [1], [0]) + '=' + mat([4], [1], [0]) + '$ da $\\lambda_2=1$ y $\\lambda_1=3$. Las columnas sin pivote llevan peso $0$: $' + X + '_p=[3,0,1,0]' + T + '$.',
      en: 'Particular solution from the echelon form (MML §2.3.2): write $' + b + '$ with the **pivot columns**, right to left: $\\lambda_1' + mat([1], [0], [0]) + '+\\lambda_2' + mat([1], [1], [0]) + '=' + mat([4], [1], [0]) + '$ gives $\\lambda_2=1$ and $\\lambda_1=3$. Non-pivot columns get weight $0$: $' + X + '_p=[3,0,1,0]' + T + '$.' },
    { val: RREF, est: pivotes(RREF, 4), hl: { '0,0': 'activa', '0,1': 'activa', '0,2': 'activa', '0,3': 'activa', '0,4': 'activa' }, formula: 'R₁ ← R₁ − R₂',
      es: '**Forma escalonada reducida** (MML §2.3.2): escalonada, cada pivote vale $1$ y es la única entrada no nula de su columna. Aquí basta $R_1\\leftarrow R_1-R_2$. La **eliminación gaussiana** es el algoritmo que lleva, con operaciones elementales, cualquier sistema a esta forma.',
      en: '**Reduced row-echelon form** (MML §2.3.2): echelon form, every pivot is $1$ and is the only nonzero entry in its column. Here $R_1\\leftarrow R_1-R_2$ suffices. **Gaussian elimination** is the algorithm that brings any system to this form with elementary transformations.' },

    // ── MML §2.3.3: truco del −1 ──
    { sec: { es: 'El truco del −1', en: 'The minus-1 trick' },
      tabla: { filas: 4, cols: 4, cab: { filas: ['1', '2', '3', '4'], cols: ['x₁', 'x₂', 'x₃', 'x₄'], esq: 'Ã' }, val: AT },
      est: { '1,1': 'activa', '3,3': 'activa' }, resaltar: { filas: [1, 3] }, formula: { es: 'filas añadidas: 2 y 4', en: 'added rows: 2 and 4' },
      es: 'Para leer las soluciones de $' + A + X + '=' + Z + '$ (MML §2.3.3): con $' + A + '$ en forma reducida y sin filas nulas, intercala filas $[0\\,\\cdots\\,0\\;-1\\;0\\,\\cdots\\,0]$ donde falte un pivote en la diagonal, hasta tener $\\tilde{' + A + '}\\in\\mathbb{R}^{n\\times n}$ con $1$ o $-1$ en toda la diagonal.',
      en: 'To read off the solutions of $' + A + X + '=' + Z + '$ (MML §2.3.3): with $' + A + '$ in reduced form and no zero rows, insert rows $[0\\,\\cdots\\,0\\;-1\\;0\\,\\cdots\\,0]$ wherever a pivot is missing on the diagonal, until $\\tilde{' + A + '}\\in\\mathbb{R}^{n\\times n}$ has $1$ or $-1$ all along the diagonal.' },
    { est: { '0,1': 'camino', '1,1': 'camino', '2,1': 'camino', '3,1': 'camino', '0,3': 'camino', '1,3': 'camino', '2,3': 'camino', '3,3': 'camino' }, resaltar: { cols: KER }, formula: null,
      es: 'Las columnas de $\\tilde{' + A + '}$ con $-1$ en la diagonal resuelven $' + A + X + '=' + Z + '$ y forman una **base** de sus soluciones, el **núcleo** (MML §2.3.3; base en §2.6.1, núcleo en §2.7.3): aquí $[2,-1,0,0]' + T + '$ y $[1,0,-1,-1]' + T + '$.',
      en: 'The columns of $\\tilde{' + A + '}$ with $-1$ on the diagonal solve $' + A + X + '=' + Z + '$ and form a **basis** of its solutions, the **kernel** (MML §2.3.3; basis in §2.6.1, kernel in §2.7.3): here $[2,-1,0,0]' + T + '$ and $[1,0,-1,-1]' + T + '$.',
      leyenda: ['camino'] },
    { est: null, resaltar: null,
      es: 'Compruébalo: pulsa cualquier celda para elegir esa columna de $\\tilde{' + A + '}$ y multiplícala por $' + A + '$ (las dos filas de la forma reducida). Solo las columnas con $-1$ dan $' + Z + '$.',
      en: 'Check it: click any cell to pick that column of $\\tilde{' + A + '}$ and multiply it by $' + A + '$ (the two rows of the reduced form). Only the columns with $-1$ give $' + Z + '$.',
      jugar: {
        botones: [
          { label: { es: 'columna 2', en: 'column 2' }, hacer: v => soltarK(v, 0, 1) },
          { label: { es: 'columna 4', en: 'column 4' }, hacer: v => soltarK(v, 0, 3) },
          { label: { es: 'columna 1', en: 'column 1' }, hacer: v => soltarK(v, 0, 0) },
        ],
        lecturas: v => {
          if (v.col == null) return [{ expr: { es: 'columna elegida', en: 'chosen column' }, valor: '—' }, { expr: '$' + A + X + '$', valor: '—' }];
          const x = columna(v.col), r = Ax(x), cero = r.every(y => y === 0);
          return [
            { expr: { es: 'columna elegida', en: 'chosen column' }, valor: vstr(x) },
            { expr: '$' + A + X + '$', valor: vstr(r), malo: !cero },
            { expr: { es: '¿en el núcleo?', en: 'in the kernel?' }, valor: cero ? '✓' : '✗', malo: !cero },
          ];
        },
        arrastrables: true, soltar: soltarK,
      } },
    { est: { '0,1': 'camino', '1,1': 'camino', '2,1': 'camino', '3,1': 'camino', '0,3': 'camino', '1,3': 'camino', '2,3': 'camino', '3,3': 'camino' },
      es: 'Juntándolo todo: $\\{' + X + '\\in\\mathbb{R}^4:' + X + '=' + mat([3], [0], [1], [0]) + '+\\lambda_1' + mat([2], [-1], [0], [0]) + '+\\lambda_2' + mat([1], [0], [-1], [-1]) + ',\\;\\lambda_1,\\lambda_2\\in\\mathbb{R}\\}$. Dos variables libres, dos direcciones: un plano desplazado dentro de $\\mathbb{R}^4$.',
      en: 'Putting it together: $\\{' + X + '\\in\\mathbb{R}^4:' + X + '=' + mat([3], [0], [1], [0]) + '+\\lambda_1' + mat([2], [-1], [0], [0]) + '+\\lambda_2' + mat([1], [0], [-1], [-1]) + ',\\;\\lambda_1,\\lambda_2\\in\\mathbb{R}\\}$. Two free variables, two directions: a shifted plane inside $\\mathbb{R}^4$.' },
    { es: 'Un sistema compatible con $5$ incógnitas cuya forma escalonada tiene $3$ pivotes, ¿cuántos parámetros $\\lambda_i$ tiene su solución general?',
      en: 'A consistent system with $5$ unknowns whose echelon form has $3$ pivots: how many parameters $\\lambda_i$ does its general solution have?',
      pregunta: {
        opc: [
          { es: '$2$', en: '$2$', ok: 1 },
          { es: '$3$', en: '$3$' },
          { es: 'Depende de $' + b + '$', en: 'It depends on $' + b + '$' },
        ],
        why: {
          es: 'Uno por variable libre: $5-3=2$. El truco del $-1$ añade una fila $-1$ por cada columna sin pivote, y cada una da un vector del núcleo. $' + b + '$ solo decide **si** hay solución, no cuántos parámetros (anticipo del teorema rango-nulidad, MML §2.7.3).',
          en: 'One per free variable: $5-3=2$. The minus-1 trick adds a $-1$ row for each non-pivot column, and each gives a kernel vector. $' + b + '$ only decides **whether** there is a solution, not how many parameters (a preview of rank-nullity, MML §2.7.3).',
        },
        pistas: [{ es: 'Cuenta las variables libres: las columnas sin pivote.', en: 'Count the free variables: the columns without a pivot.' }],
      } },

    // ── Inversa con [A | I] (MML (2.56)) ──
    { sec: { es: 'Calcular la inversa', en: 'Computing the inverse' },
      tabla: { filas: 2, cols: 4, cab: { filas: ['R₁', 'R₂'], cols: ['A·₁', 'A·₂', 'I·₁', 'I·₂'], esq: '' }, val: INV0 }, formula: '[A | I₂]',
      es: 'Hallar $' + A + '^{-1}$ es resolver $' + A + B('X') + '=' + I + '_n$: $n$ sistemas con la misma matriz a la vez (MML (2.56)): $[' + A + '\\,|\\,' + I + '_n]\\rightsquigarrow\\cdots\\rightsquigarrow[' + I + '_n\\,|\\,' + A + '^{-1}]$. Con $' + A + '=' + mat([2, 1], [1, 1]) + '$, reproduce la traza hasta la forma reducida.',
      en: 'Finding $' + A + '^{-1}$ means solving $' + A + B('X') + '=' + I + '_n$: $n$ systems with the same matrix at once (MML (2.56)): $[' + A + '\\,|\\,' + I + '_n]\\rightsquigarrow\\cdots\\rightsquigarrow[' + I + '_n\\,|\\,' + A + '^{-1}]$. With $' + A + '=' + mat([2, 1], [1, 1]) + '$, play the trace up to the reduced form.',
      leyenda: ['activo', 'compara'], traza: GI.frames },
    { val: GI.final, est: { '0,2': 'hecha', '0,3': 'hecha', '1,2': 'hecha', '1,3': 'hecha' }, resaltar: null, formula: '[I₂ | A⁻¹]',
      es: 'A la derecha queda $' + A + '^{-1}=' + mat([1, -1], [-1, 2]) + '$ (compruébalo: $' + A + A + '^{-1}=' + I + '$). Si en el camino la parte izquierda produce una fila de ceros, $' + A + '$ es **singular** y no hay inversa. Calcular la inversa **es** resolver sistemas lineales.',
      en: 'On the right we get $' + A + '^{-1}=' + mat([1, -1], [-1, 2]) + '$ (check: $' + A + A + '^{-1}=' + I + '$). If along the way the left part produces a row of zeros, $' + A + '$ is **singular** and has no inverse. Computing the inverse **is** solving linear systems.' },

    // ── MML §2.3.4: algoritmos ──
    { sec: { es: 'Algoritmos en la práctica', en: 'Algorithms in practice' },
      es: '$' + X + '=' + A + '^{-1}' + b + '$ solo vale si $' + A + '$ es cuadrada e invertible. Si hay solución y las columnas de $' + A + '$ son linealmente independientes (MML (2.59)): $' + A + X + '=' + b + '\\iff' + A + T + A + X + '=' + A + T + b + '\\iff' + X + '=(' + A + T + A + ')^{-1}' + A + T + b + '$, con la **pseudoinversa de Moore-Penrose** $(' + A + T + A + ')^{-1}' + A + T + '$.',
      en: '$' + X + '=' + A + '^{-1}' + b + '$ only works if $' + A + '$ is square and invertible. If a solution exists and the columns of $' + A + '$ are linearly independent (MML (2.59)): $' + A + X + '=' + b + '\\iff' + A + T + A + X + '=' + A + T + b + '\\iff' + X + '=(' + A + T + A + ')^{-1}' + A + T + b + '$, with the **Moore-Penrose pseudo-inverse** $(' + A + T + A + ')^{-1}' + A + T + '$.' },
    { es: 'Pero MML desaconseja invertir: cuesta mucho y es **numéricamente** delicado. La eliminación sirve con miles de incógnitas, pero su coste crece **cúbicamente**; con millones se usan métodos **iterativos** $' + X + '^{(k+1)}=' + B('C') + X + '^{(k)}+' + B('d') + '$ (MML (2.60)) que reducen $\\|' + X + '^{(k+1)}-' + X + '_*\\|$ en cada paso: Jacobi, Gauss-Seidel, gradientes conjugados.',
      en: 'But MML advises against inverting: it is costly and **numerically** delicate. Elimination works with thousands of unknowns, but its cost grows **cubically**; with millions, **iterative** methods $' + X + '^{(k+1)}=' + B('C') + X + '^{(k)}+' + B('d') + '$ (MML (2.60)) are used, reducing $\\|' + X + '^{(k+1)}-' + X + '_*\\|$ at every step: Jacobi, Gauss-Seidel, conjugate gradients.' },
    { code: CODIGO, line: 5,
      es: 'En NumPy: `solve` resuelve un sistema cuadrado por eliminación (factorización LU) sin formar la inversa: imprime `[1. 1.]`. `lstsq` da la solución de mínimos cuadrados cuando no hay exacta; `pinv` usa la SVD (MML §4.5). Las tres últimas líneas imprimen lo mismo, $\\approx[1.1667,\\;0.5]$.',
      en: 'In NumPy: `solve` solves a square system by elimination (LU factorization) without forming the inverse: it prints `[1. 1.]`. `lstsq` gives the least-squares solution when there is no exact one; `pinv` uses the SVD (MML §4.5). The last three lines print the same thing, $\\approx[1.1667,\\;0.5]$.' },
    { line: 12,
      es: 'Para resolver $' + A + X + '=' + b + '$ con $' + A + '$ cuadrada e invertible, ¿qué conviene en la práctica?',
      en: 'To solve $' + A + X + '=' + b + '$ with $' + A + '$ square and invertible, what is best in practice?',
      pregunta: {
        opc: [
          { es: '`np.linalg.inv(A) @ b`', en: '`np.linalg.inv(A) @ b`' },
          { es: '`np.linalg.solve(A, b)`', en: '`np.linalg.solve(A, b)`', ok: 1 },
          { es: 'Da igual: es el mismo cálculo', en: 'No difference: same computation' },
        ],
        why: {
          es: '`solve` factoriza y sustituye sin formar $' + A + '^{-1}$: menos operaciones y menos error de redondeo (MML §2.3.4). Formar la inversa equivale a resolver $n$ sistemas, uno por columna de $' + I + '$, para luego usar solo uno.',
          en: '`solve` factorizes and substitutes without forming $' + A + '^{-1}$: fewer operations and less rounding error (MML §2.3.4). Forming the inverse means solving $n$ systems, one per column of $' + I + '$, to then use just one.',
        },
        pistas: [{ es: 'Recuerda $[' + A + '|' + I + ']\\rightsquigarrow[' + I + '|' + A + '^{-1}]$: ¿cuántos sistemas resuelve eso?', en: 'Recall $[' + A + '|' + I + ']\\rightsquigarrow[' + I + '|' + A + '^{-1}]$: how many systems does that solve?' }],
      } },

    // ── Dónde aparece en ML ──
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' }, code: '', line: null,
      es: 'En regresión lineal (MML §9.2) el estimador $' + B('\\theta') + '_{\\text{ML}}$ resuelve las **ecuaciones normales** $' + B('X') + T + B('X') + B('\\theta') + '=' + B('X') + T + B('y') + '$ (MML (9.12)), un sistema $' + A + B('\\theta') + '=' + b + '$ con $' + A + '=' + B('X') + T + B('X') + '$: justo el de (2.59). Si los datos no caben en una recta no hay solución exacta y esto da la de **mínimos cuadrados**.',
      en: 'In linear regression (MML §9.2) the estimator $' + B('\\theta') + '_{\\text{ML}}$ solves the **normal equations** $' + B('X') + T + B('X') + B('\\theta') + '=' + B('X') + T + B('y') + '$ (MML (9.12)), a system $' + A + B('\\theta') + '=' + b + '$ with $' + A + '=' + B('X') + T + B('X') + '$: exactly the one in (2.59). If the data do not fit a line there is no exact solution and this gives the **least-squares** one.' },
    { es: 'Resumen: solución general = particular + soluciones de $' + A + X + '=' + Z + '$; la eliminación gaussiana lleva a la forma escalonada (reducida); el truco del $-1$ lee el núcleo; $[' + A + '|' + I + ']\\rightsquigarrow[' + I + '|' + A + '^{-1}]$. Siguiente guía: **espacios vectoriales** e **independencia lineal** (MML §2.4–2.5), que dan nombre a todo esto.',
      en: 'Summary: general solution = particular + solutions of $' + A + X + '=' + Z + '$; Gaussian elimination reaches (reduced) echelon form; the minus-1 trick reads off the kernel; $[' + A + '|' + I + ']\\rightsquigarrow[' + I + '|' + A + '^{-1}]$. Next guide: **vector spaces** and **linear independence** (MML §2.4–2.5), which give names to all of this.' },
  ],
};
