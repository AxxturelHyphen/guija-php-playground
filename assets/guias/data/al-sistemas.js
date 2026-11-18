// Guía «Sistemas lineales y matrices» (Álgebra lineal, lección 1). Sigue MML §2.1 (sistemas de ecuaciones lineales) y §2.2
// (matrices: suma, producto, identidad, inversa, traspuesta, simétricas, escalares, forma compacta). Ejemplos propios.
// Escenas `vectores` (assets/guias/vectores.js) y `tabla` (assets/guias/tabla.js); formato de los pasos en data/punteros.js.
// Notación MML: escalares en cursiva, vectores en negrita minúscula, matrices en negrita mayúscula (\boldsymbol).
const B = x => `\\bm{${x}}`; // \bm = \boldsymbol en KaTeX (más corto: los textos tienen tope de longitud)
const A = B('A'), M = B('B'), C = B('C'), D = B('D'), I = B('I'), X = B('x'), b = B('b'), T = '^{\\top}';
const R = B('R'), S = B('S'), E1 = B('e') + '_1', E2 = B('e') + '_2';
const mat = (...filas) => `\\begin{bmatrix}${filas.map(f => f.join('&')).join('\\\\')}\\end{bmatrix}`;

// ── Vista por filas: x₁ + 2x₂ = 4 · 3x₁ + x₂ = 7 → (2, 1) ─────────────────────────────────────────────────
const FUERA = 99; // punto fuera de la ventana cuando no hay solución única
function conSol(p) {
  const d = p.a1 * p.b2 - p.a2 * p.b1;
  const s = Math.abs(d) < 1e-9 ? null : [(p.c1 * p.b2 - p.c2 * p.b1) / d, (p.a1 * p.c2 - p.a2 * p.c1) / d];
  return { ...p, sx: s ? s[0] : FUERA, sy: s ? s[1] : FUERA };
}
const P0 = conSol({ a1: 1, b1: 2, c1: 4, a2: 3, b2: 1, c2: 7 });
const R1 = { tipo: 'recta', a: 'a1', b: 'b1', c: 'c1', nombre: '(1)' };
const R2 = { tipo: 'recta', a: 'a2', b: 'b2', c: 'c2', nombre: '(2)' };
const PT = { tipo: 'punto', x: 'sx', y: 'sy', nombre: '$(x_1,x_2)$' };
const DESL_F = [
  { par: 'a2', min: -4, max: 4, paso: .5, es: 'Coeficiente $a_{21}$', en: 'Coefficient $a_{21}$', dec: 1 },
  { par: 'b2', min: -4, max: 4, paso: .5, es: 'Coeficiente $a_{22}$', en: 'Coefficient $a_{22}$', dec: 1 },
  { par: 'c2', min: -6, max: 10, paso: .5, es: 'Término independiente $b_2$', en: 'Right-hand side $b_2$', dec: 1 },
];
function recalcF(v, cx) {
  const r = cx.resolver(v.a1, v.b1, v.c1, v.a2, v.b2, v.c2);
  v.sx = r.tipo === 'unica' ? r.x : FUERA; v.sy = r.tipo === 'unica' ? r.y : FUERA;
  return r;
}
const soltarF = (v, k, val, cx) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; recalcF(v, cx); };
const nSol = r => (r.tipo === 'unica' ? '1' : r.tipo === 'ninguna' ? '0' : '∞');

// ── Vista por columnas: x₁·c₁ + x₂·c₂ = b ─────────────────────────────────────────────────────────────────
const DESL_C = [
  { par: 'x1', min: -2, max: 4, paso: .1, es: 'Peso $x_1$', en: 'Weight $x_1$', dec: 1 },
  { par: 'x2', min: -2, max: 4, paso: .1, es: 'Peso $x_2$', en: 'Weight $x_2$', dec: 1 },
];
const COMB_C = { tipo: 'comb', coef: ['x1', 'x2'], vecs: ['c1', 'c2'], nombre: `$x_1${B('c')}_1+x_2${B('c')}_2$` };
const CAPAS_C = [{ tipo: 'flecha', a: 'b' }, { tipo: 'flecha', a: 'c1' }, { tipo: 'flecha', a: 'c2' }, COMB_C];
const solC = (v, cx) => cx.resolver(v.vec.c1[0], v.vec.c2[0], v.vec.b[0], v.vec.c1[1], v.vec.c2[1], v.vec.b[1]);
const par2 = (cx, p) => `(${cx.fmt(p[0])} ; ${cx.fmt(p[1])})`;
const soltarC = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };

// ── Producto en esquema de Falk: B (3×2) arriba a la derecha, A (2×3) abajo a la izquierda, C = AB en el cruce ──
const MA = [[2, 0, 1], [1, 3, -1]], MB = [[1, 2], [0, 1], [4, -1]];
const SUB = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
const par0 = x => (x < 0 ? `(${String(x).replace('-', '−')})` : String(x));
const cij = (i, j) => MA[i].reduce((s, a, l) => s + a * MB[l][j], 0);
const cuenta = (i, j) => `c${SUB(i + 1)}${SUB(j + 1)} = ${MA[i].map((a, l) => `${par0(a)}·${par0(MB[l][j])}`).join(' + ')} = ${String(cij(i, j)).replace('-', '−')}`;
const vacia = () => Array.from({ length: 5 }, () => Array(5).fill(null));
const FALK = (() => { const v = vacia(); MB.forEach((f, l) => f.forEach((x, j) => { v[l][3 + j] = x; })); MA.forEach((f, i) => f.forEach((x, l) => { v[3 + i][l] = x; })); return v; })();
const conC = () => { const v = FALK.map(f => [...f]); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) v[3 + i][3 + j] = cij(i, j); return v; };
const estCelda = (i, j) => {
  const e = {};
  for (let l = 0; l < 3; l++) { e[`${3 + i},${l}`] = 'lee'; e[`${l},${3 + j}`] = 'lee'; }
  e[`${3 + i},${3 + j}`] = 'activa';
  return e;
};
const framesProducto = () => {
  const fr = [], hechas = {};
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    fr.push({ est: { ...hechas, ...estCelda(i, j) }, resaltar: { filas: [3 + i], cols: [3 + j] }, formula: { es: `fila ${i + 1} de A · columna ${j + 1} de B`, en: `row ${i + 1} of A · column ${j + 1} of B` },
      es: `Fila ${i + 1} de A por columna ${j + 1} de B: se multiplican por parejas y se suman.`, en: `Row ${i + 1} of A times column ${j + 1} of B: multiply pairwise and add.` });
    hechas[`${3 + i},${3 + j}`] = 'hecha';
    fr.push({ val: [[3 + i, 3 + j, cij(i, j)]], est: { ...hechas, ...estCelda(i, j), [`${3 + i},${3 + j}`]: 'activa' }, formula: cuenta(i, j), es: cuenta(i, j), en: cuenta(i, j) });
  }
  fr.push({ est: { ...hechas }, resaltar: null, formula: 'C = AB ∈ ℝ²ˣ²', es: 'C completa: 2×3 por 3×2 da 2×2.', en: 'C done: 2×3 times 3×2 gives 2×2.' });
  return fr;
};
const soltarP = (v, r, c) => {
  if (r < 3 || c < 3) { v.sel = null; v.est = {}; v.resaltar = { filas: [], cols: [] }; v.formula = { es: 'Pulsa una celda de C (abajo a la derecha)', en: 'Click a cell of C (bottom right)' }; return; }
  const i = r - 3, j = c - 3;
  v.sel = [i, j]; v.est = estCelda(i, j); v.resaltar = { filas: [r], cols: [c] }; v.formula = cuenta(i, j);
  v.val[r][c] = cij(i, j);
};

// ── Matriz como transformación (rejilla) ────────────────────────────────────────────────────────────────────
const VENT_T = { x: [-3.2, 3.2], y: [-2.6, 2.6] };
const DESL_T = [
  { par: 'a', min: -2, max: 2, paso: .1, es: '$a_{11}$', en: '$a_{11}$', dec: 1 },
  { par: 'b', min: -2, max: 2, paso: .1, es: '$a_{12}$', en: '$a_{12}$', dec: 1 },
  { par: 'c', min: -2, max: 2, paso: .1, es: '$a_{21}$', en: '$a_{21}$', dec: 1 },
  { par: 'd', min: -2, max: 2, paso: .1, es: '$a_{22}$', en: '$a_{22}$', dec: 1 },
];
const REJ = { tipo: 'rejilla', m: [['a', 'b'], ['c', 'd']] };
const fija = (v, a, b, c, d) => { v.a = a; v.b = b; v.c = c; v.d = d; };
const soltarT = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };
const BOT_T = [
  { label: { es: 'giro 90°', en: '90° rotation' }, hacer: v => fija(v, 0, -1, 1, 0) },
  { label: { es: 'cizalla', en: 'shear' }, hacer: v => fija(v, 1, 1, 0, 1) },
  { label: { es: 'singular', en: 'singular' }, hacer: v => fija(v, 1, 2, .5, 1) },
  { label: 'I', hacer: v => fija(v, 1, 0, 0, 1) },
];

export default {
  titulo: { es: 'Sistemas lineales y matrices', en: 'Linear systems and matrices' },
  fuentes: [
    'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com',
  ],
  pasos: [
    // ── MML §2.1: el problema ──
    { sec: { es: 'Qué problema resuelve', en: 'What problem it solves' },
      vectores: { x: [-1.5, 5], y: [-1.5, 4.5], vec: { n1: [1, 2], n2: [3, 1] }, par: P0, arrastrar: [], deslizadores: DESL_F, capas: [R1, R2, PT],
        etiqueta: { es: 'Dos rectas del plano x1x2 y su punto de corte', en: 'Two lines in the x1x2 plane and their intersection' } },
      es: 'Una ración del ingrediente 1 aporta 1 g de proteína y 3 g de hidratos; una del 2, 2 g y 1 g. ¿Cuántas raciones $x_1,x_2$ dan justo 4 g de proteína y 7 g de hidratos? Hay que cumplir $x_1+2x_2=4$ y $3x_1+x_2=7$ a la vez: un **sistema de ecuaciones lineales** (MML §2.1).',
      en: 'A serving of ingredient 1 gives 1 g of protein and 3 g of carbs; one of ingredient 2, 2 g and 1 g. How many servings $x_1,x_2$ give exactly 4 g of protein and 7 g of carbs? We need $x_1+2x_2=4$ and $3x_1+x_2=7$ at once: a **system of linear equations** (MML §2.1).' },
    { es: 'En general, con $m$ ecuaciones y $n$ incógnitas (MML (2.3)): $a_{11}x_1+\\cdots+a_{1n}x_n=b_1,\\;\\dots,\\;a_{m1}x_1+\\cdots+a_{mn}x_n=b_m$, con $a_{ij},b_i\\in\\mathbb{R}$ conocidos. Una **solución** es toda $n$-tupla $(x_1,\\dots,x_n)\\in\\mathbb{R}^n$ que cumple **todas** las ecuaciones a la vez.',
      en: 'In general, with $m$ equations and $n$ unknowns (MML (2.3)): $a_{11}x_1+\\cdots+a_{1n}x_n=b_1,\\;\\dots,\\;a_{m1}x_1+\\cdots+a_{mn}x_n=b_m$, with known $a_{ij},b_i\\in\\mathbb{R}$. A **solution** is any $n$-tuple $(x_1,\\dots,x_n)\\in\\mathbb{R}^n$ that satisfies **all** equations at once.' },

    // ── Interpretación geométrica ──
    { sec: { es: 'Cada ecuación, una recta', en: 'Each equation, a line' },
      es: 'Con dos incógnitas, cada ecuación es una **recta** del plano (eje horizontal $x_1$, vertical $x_2$). Cumplir las dos es estar en ambas: el conjunto solución es la **intersección**. Aquí se cortan en $(2,1)$: $2+2\\cdot1=4$ y $3\\cdot2+1=7$ (MML §2.1, interpretación geométrica).',
      en: 'With two unknowns each equation is a **line** in the plane (horizontal axis $x_1$, vertical $x_2$). Satisfying both means lying on both: the solution set is the **intersection**. Here they meet at $(2,1)$: $2+2\\cdot1=4$ and $3\\cdot2+1=7$ (MML §2.1, geometric interpretation).' },
    { es: 'Mueve los coeficientes de la ecuación (2), $a_{21}x_1+a_{22}x_2=b_2$. Busca los tres casos: rectas que se cortan (una solución), **paralelas distintas** (ninguna) y **la misma recta** (infinitas).',
      en: 'Move the coefficients of equation (2), $a_{21}x_1+a_{22}x_2=b_2$. Find the three cases: lines that cross (one solution), **distinct parallel** lines (none) and **the same line** (infinitely many).',
      jugar: {
        botones: [
          { label: { es: 'original', en: 'original' }, hacer: (v, cx) => { v.a2 = 3; v.b2 = 1; v.c2 = 7; recalcF(v, cx); } },
          { label: { es: 'paralela', en: 'parallel' }, hacer: (v, cx) => { v.a2 = 2; v.b2 = 4; v.c2 = 3; recalcF(v, cx); } },
          { label: { es: 'misma recta', en: 'same line' }, hacer: (v, cx) => { v.a2 = 2; v.b2 = 4; v.c2 = 8; recalcF(v, cx); } },
        ],
        lecturas: (v, cx) => {
          const r = cx.resolver(v.a1, v.b1, v.c1, v.a2, v.b2, v.c2);
          return [
            { expr: { es: 'número de soluciones', en: 'number of solutions' }, valor: nSol(r), malo: r.tipo === 'ninguna' },
            { expr: '$(x_1,x_2)$', valor: r.tipo === 'unica' ? `(${cx.fmt(r.x)} ; ${cx.fmt(r.y)})` : '—' },
            { expr: '$a_{11}a_{22}-a_{12}a_{21}$', valor: cx.fmt(v.a1 * v.b2 - v.b1 * v.a2), malo: Math.abs(v.a1 * v.b2 - v.b1 * v.a2) < 1e-9 },
          ];
        },
        arrastrables: true, soltar: soltarF,
      } },
    { deriva: {
        pregunta: { es: 'Si la ecuación (2) pasa a ser $2x_1+4x_2=c$, ¿para qué $c$ hay **infinitas** soluciones?', en: 'If equation (2) becomes $2x_1+4x_2=c$, for which $c$ are there **infinitely many** solutions?' },
        opciones: [{ es: 'Solo para $c=8$', en: 'Only for $c=8$' }, { es: 'Para ningún $c$', en: 'For no $c$' }, { es: 'Para todo $c\\neq8$', en: 'For every $c\\neq8$' }], correcta: 0,
        razones: [
          { es: 'Con $c=8$ la ecuación (2) es $2\\cdot$(1): la misma recta', en: 'With $c=8$ equation (2) is $2\\cdot$(1): the same line' },
          { es: 'Dos rectas paralelas nunca se tocan', en: 'Two parallel lines never touch' },
          { es: 'Dos ecuaciones con dos incógnitas siempre tienen solución única', en: 'Two equations in two unknowns always have a unique solution' },
        ], razonCorrecta: 0,
        pistas: [{ es: 'Compara $2x_1+4x_2=c$ con el doble de $x_1+2x_2=4$.', en: 'Compare $2x_1+4x_2=c$ with twice $x_1+2x_2=4$.' }],
        revela: { es: 'Los coeficientes $(2,4)$ son el doble de $(1,2)$: las rectas son paralelas. Si además $c=2\\cdot4$, coinciden; si no, no se cortan nunca.', en: 'The coefficients $(2,4)$ are twice $(1,2)$: the lines are parallel. If also $c=2\\cdot4$ they coincide; otherwise they never meet.' },
      },
      par: conSol({ ...P0, a2: 2, b2: 4, c2: 8 }),
      es: 'Con $c=8$ la ecuación (2) es **redundante**. El conjunto solución es toda la recta $x_1=4-2x_2$: una solución por cada valor de la **variable libre** $x_2\\in\\mathbb{R}$. Con $c\\neq8$ no hay ninguna.',
      en: 'With $c=8$ equation (2) is **redundant**. The solution set is the whole line $x_1=4-2x_2$: one solution for each value of the **free variable** $x_2\\in\\mathbb{R}$. With $c\\neq8$ there is none.' },
    { par: P0,
      es: 'Con tres incógnitas cada ecuación es un **plano** de $\\mathbb{R}^3$ y la intersección puede ser un plano, una recta, un punto o vacía. Con $n$ incógnitas son hiperplanos y ya no se dibujan: hace falta un método algebraico, la eliminación gaussiana (MML §2.3). Antes, una notación compacta.',
      en: 'With three unknowns each equation is a **plane** in $\\mathbb{R}^3$ and the intersection can be a plane, a line, a point or empty. With $n$ unknowns they are hyperplanes and cannot be drawn: we need an algebraic method, Gaussian elimination (MML §2.3). First, a compact notation.' },

    // ── Vista por columnas (MML (2.9)–(2.10)) ──
    { sec: { es: 'La vista por columnas', en: 'The column view' },
      vectores: { x: [-1, 5.5], y: [-1, 7.5], vec: { c1: [1, 3], c2: [2, 1], b: [4, 7] }, par: { x1: 1, x2: .5 }, arrastrar: ['b'], paso: .5, deslizadores: DESL_C, capas: CAPAS_C,
        etiqueta: { es: 'Columnas c1, c2, el vector b y la combinación x1·c1 + x2·c2', en: 'Columns c1, c2, vector b and the combination x1·c1 + x2·c2' } },
      es: 'Agrupa los coeficientes por **columnas** (MML (2.9)): $x_1' + mat([1], [3]) + '+x_2' + mat([2], [1]) + '=' + mat([4], [7]) + '$. Resolver el sistema es averiguar **cuánto de cada columna** hay que sumar para llegar a $' + b + '$: buscar una **combinación lineal**.',
      en: 'Group the coefficients by **columns** (MML (2.9)): $x_1' + mat([1], [3]) + '+x_2' + mat([2], [1]) + '=' + mat([4], [7]) + '$. Solving the system means finding **how much of each column** to add to reach $' + b + '$: looking for a **linear combination**.' },
    { es: 'Mueve $x_1$ y $x_2$ hasta que la punta de la combinación caiga en $' + b + '$. Luego arrastra $' + b + '$: con columnas no paralelas siempre hay **una única** combinación que llega, sea cual sea $' + b + '$. Pulsa «$' + B('c') + '_2$ paralela» y verás que casi ningún $' + b + '$ es alcanzable.',
      en: 'Move $x_1$ and $x_2$ until the tip of the combination lands on $' + b + '$. Then drag $' + b + '$: with non-parallel columns there is always **exactly one** combination that reaches it, whatever $' + b + '$ is. Press "$' + B('c') + '_2$ parallel" and almost no $' + b + '$ is reachable.',
      jugar: {
        botones: [
          { label: { es: 'resolver', en: 'solve' }, hacer: (v, cx) => { const r = solC(v, cx); if (r.tipo === 'unica') { v.x1 = r.x; v.x2 = r.y; } } },
          { label: 'x = 0', hacer: v => { v.x1 = 0; v.x2 = 0; } },
          { label: { es: 'c₂ paralela', en: 'c₂ parallel' }, hacer: v => { v.vec.c2 = [2, 6]; } },
          { label: { es: 'columnas originales', en: 'original columns' }, hacer: v => { v.vec.c1 = [1, 3]; v.vec.c2 = [2, 1]; v.vec.b = [4, 7]; } },
        ],
        lecturas: (v, cx) => {
          const r = solC(v, cx), p = cx.comb([v.x1, v.x2], [v.vec.c1, v.vec.c2]), e = Math.hypot(p[0] - v.vec.b[0], p[1] - v.vec.b[1]);
          return [
            { expr: '$x_1' + B('c') + '_1+x_2' + B('c') + '_2$', valor: par2(cx, p) },
            { expr: '$' + b + '$', valor: par2(cx, v.vec.b) },
            { expr: { es: 'distancia a b', en: 'distance to b' }, valor: cx.fmt(e), malo: e > .05 },
            { expr: { es: 'solución exacta', en: 'exact solution' }, valor: r.tipo === 'unica' ? `x = (${cx.fmt(r.x)} ; ${cx.fmt(r.y)})` : r.tipo === 'ninguna' ? '∄' : '∞', malo: r.tipo !== 'unica' },
          ];
        },
        arrastrables: true, soltar: soltarC,
      } },
    { par: { x1: 2, x2: 1 },
      es: 'Juntando las columnas en una tabla (MML (2.10)): $' + mat(['a_{11}', '\\cdots', 'a_{1n}'], ['\\vdots', '', '\\vdots'], ['a_{m1}', '\\cdots', 'a_{mn}']) + mat(['x_1'], ['\\vdots'], ['x_n']) + '=' + mat(['b_1'], ['\\vdots'], ['b_m']) + '$, o sea $' + A + X + '=' + b + '$. El producto $' + A + X + '$ **es** la combinación de las columnas de $' + A + '$ con pesos $x_j$ (MML §2.2.4).',
      en: 'Putting the columns into a table (MML (2.10)): $' + mat(['a_{11}', '\\cdots', 'a_{1n}'], ['\\vdots', '', '\\vdots'], ['a_{m1}', '\\cdots', 'a_{mn}']) + mat(['x_1'], ['\\vdots'], ['x_n']) + '=' + mat(['b_1'], ['\\vdots'], ['b_m']) + '$, that is $' + A + X + '=' + b + '$. The product $' + A + X + '$ **is** the combination of the columns of $' + A + '$ with weights $x_j$ (MML §2.2.4).' },
    { es: 'Un sistema lineal real, ¿puede tener **exactamente dos** soluciones?',
      en: 'Can a real linear system have **exactly two** solutions?',
      pregunta: {
        opc: [
          { es: 'Sí, si hay más incógnitas que ecuaciones', en: 'Yes, if there are more unknowns than equations' },
          { es: 'No: ninguna, una o infinitas', en: 'No: none, one or infinitely many', ok: 1 },
          { es: 'Sí, si dos rectas se cortan dos veces', en: 'Yes, if two lines cross twice' },
        ],
        why: {
          es: 'Si $' + X + '$ e $' + B('y') + '$ resuelven $' + A + X + '=' + b + '$, todo punto de la recta que los une también: $' + A + '(' + X + '+t(' + B('y') + '-' + X + '))=' + b + '+t(' + b + '-' + b + ')=' + b + '$ para todo $t\\in\\mathbb{R}$. Dos soluciones distintas fuerzan infinitas (MML §2.1).',
          en: 'If $' + X + '$ and $' + B('y') + '$ solve $' + A + X + '=' + b + '$, every point on the line through them does too: $' + A + '(' + X + '+t(' + B('y') + '-' + X + '))=' + b + '+t(' + b + '-' + b + ')=' + b + '$ for all $t\\in\\mathbb{R}$. Two distinct solutions force infinitely many (MML §2.1).',
        },
        pistas: [{ es: 'Si $' + X + '$ e $' + B('y') + '$ son soluciones, prueba con el punto medio $\\tfrac12(' + X + '+' + B('y') + ')$.', en: 'If $' + X + '$ and $' + B('y') + '$ are solutions, try the midpoint $\\tfrac12(' + X + '+' + B('y') + ')$.' }],
      } },

    // ── MML §2.2: matrices ──
    { sec: { es: 'Matrices', en: 'Matrices' },
      tabla: { filas: 5, cols: 5, cab: { filas: ['B₁', 'B₂', 'B₃', 'A₁', 'A₂'], cols: ['A·₁', 'A·₂', 'A·₃', 'B·₁', 'B·₂'], esq: '' }, val: FALK },
      formula: { es: 'A ∈ ℝ²ˣ³ abajo a la izquierda · B ∈ ℝ³ˣ² arriba a la derecha', en: 'A ∈ ℝ²ˣ³ bottom left · B ∈ ℝ³ˣ² top right' },
      es: 'Una matriz real $(m,n)$ es una tabla de $m\\cdot n$ números $a_{ij}$ en $m$ filas y $n$ columnas (MML Def. 2.1); $\\mathbb{R}^{m\\times n}$ es el conjunto de todas. Una $(1,n)$ es un **vector fila** y una $(m,1)$ un **vector columna**. Apilando columnas, $' + A + '\\in\\mathbb{R}^{m\\times n}$ se ve también como un vector de $\\mathbb{R}^{mn}$.',
      en: 'A real $(m,n)$ matrix is a table of $m\\cdot n$ numbers $a_{ij}$ in $m$ rows and $n$ columns (MML Def. 2.1); $\\mathbb{R}^{m\\times n}$ is the set of all of them. A $(1,n)$ one is a **row vector** and an $(m,1)$ one a **column vector**. Stacking columns, $' + A + '\\in\\mathbb{R}^{m\\times n}$ can also be seen as a vector of $\\mathbb{R}^{mn}$.' },
    { es: 'La **suma** de $' + A + ',' + M + '\\in\\mathbb{R}^{m\\times n}$ es entrada a entrada, $(' + A + '+' + M + ')_{ij}=a_{ij}+b_{ij}$ (MML (2.12)). El **producto** de $' + A + '\\in\\mathbb{R}^{m\\times n}$ y $' + M + '\\in\\mathbb{R}^{n\\times k}$ es $' + C + '=' + A + M + '\\in\\mathbb{R}^{m\\times k}$ con $c_{ij}=\\sum_{l=1}^{n}a_{il}b_{lj}$ (MML (2.13)): fila $i$ de $' + A + '$ por columna $j$ de $' + M + '$.',
      en: 'The **sum** of $' + A + ',' + M + '\\in\\mathbb{R}^{m\\times n}$ is entry-wise, $(' + A + '+' + M + ')_{ij}=a_{ij}+b_{ij}$ (MML (2.12)). The **product** of $' + A + '\\in\\mathbb{R}^{m\\times n}$ and $' + M + '\\in\\mathbb{R}^{n\\times k}$ is $' + C + '=' + A + M + '\\in\\mathbb{R}^{m\\times k}$ with $c_{ij}=\\sum_{l=1}^{n}a_{il}b_{lj}$ (MML (2.13)): row $i$ of $' + A + '$ times column $j$ of $' + M + '$.' },
    { es: 'En el esquema, cada $c_{ij}$ nace donde se cruzan la fila $i$ de $' + A + '$ (izquierda) y la columna $j$ de $' + M + '$ (arriba). Reproduce la traza: cuatro entradas, cada una suma de $n=3$ productos.',
      en: 'In the layout, each $c_{ij}$ is born where row $i$ of $' + A + '$ (left) meets column $j$ of $' + M + '$ (top). Play the trace: four entries, each a sum of $n=3$ products.',
      leyenda: ['compara', 'activo', 'hecho'], traza: framesProducto() },
    { val: conC(), est: { '3,3': 'hecha', '3,4': 'hecha', '4,3': 'hecha', '4,4': 'hecha' }, formula: 'C = AB ∈ ℝ²ˣ²',
      es: 'Pulsa una celda de $' + C + '$ (abajo a la derecha) para ver qué fila y qué columna la producen. Cuenta el coste: $' + C + '\\in\\mathbb{R}^{m\\times k}$ tiene $mk$ entradas de $n$ productos cada una, $mnk$ multiplicaciones; con matrices $n\\times n$, del orden de $n^3$.',
      en: 'Click a cell of $' + C + '$ (bottom right) to see which row and column produce it. Count the cost: $' + C + '\\in\\mathbb{R}^{m\\times k}$ has $mk$ entries of $n$ products each, $mnk$ multiplications; for $n\\times n$ matrices, on the order of $n^3$.',
      jugar: {
        botones: [
          { label: 'c₁₂', hacer: v => soltarP(v, 3, 4) },
          { label: 'c₂₁', hacer: v => soltarP(v, 4, 3) },
          { label: { es: 'limpiar', en: 'clear' }, hacer: v => soltarP(v, 0, 0) },
        ],
        lecturas: v => v.sel
          ? [{ expr: { es: 'entrada', en: 'entry' }, valor: `c${SUB(v.sel[0] + 1)}${SUB(v.sel[1] + 1)}` }, { expr: { es: 'cálculo', en: 'computation' }, valor: cuenta(v.sel[0], v.sel[1]).split(' = ').slice(1).join(' = ') }]
          : [{ expr: { es: 'entrada', en: 'entry' }, valor: '—' }, { expr: { es: 'cálculo', en: 'computation' }, valor: '—' }],
        arrastrables: true, soltar: soltarP,
      } },
    { est: { '3,3': 'hecha', '3,4': 'hecha', '4,3': 'hecha', '4,4': 'hecha' }, resaltar: null, formula: 'C = AB ∈ ℝ²ˣ²',
      es: 'Solo se multiplican si las dimensiones **vecinas** coinciden: $\\underbrace{' + A + '}_{n\\times k}\\underbrace{' + M + '}_{k\\times m}=\\underbrace{' + C + '}_{n\\times m}$ (MML (2.14)). Y no es entrada a entrada: $c_{ij}\\neq a_{ij}b_{ij}$. Eso es el producto de **Hadamard**, el `*` de NumPy; el matricial es `@`.',
      en: 'They can only be multiplied if the **neighbouring** dimensions match: $\\underbrace{' + A + '}_{n\\times k}\\underbrace{' + M + '}_{k\\times m}=\\underbrace{' + C + '}_{n\\times m}$ (MML (2.14)). And it is not entry-wise: $c_{ij}\\neq a_{ij}b_{ij}$. That is the **Hadamard** product, NumPy\'s `*`; the matrix product is `@`.' },
    { es: 'Con las matrices del esquema, ¿cuánto mide $' + M + A + '$?',
      en: 'With the matrices in the layout, what size is $' + M + A + '$?',
      pregunta: {
        opc: [
          { es: '$2\\times2$, igual que $' + A + M + '$', en: '$2\\times2$, like $' + A + M + '$' },
          { es: '$3\\times3$', en: '$3\\times3$', ok: 1 },
          { es: 'No está definido', en: 'It is not defined' },
        ],
        why: {
          es: '$' + M + '$ es $3\\times2$ y $' + A + '$ es $2\\times3$: vecinas $2=2$, resultado $3\\times3$: $' + M + A + '=' + mat([4, 6, -1], [1, 3, -1], [7, -3, 5]) + '$. Los dos productos existen y ni siquiera tienen el mismo tamaño: **el orden importa**.',
          en: '$' + M + '$ is $3\\times2$ and $' + A + '$ is $2\\times3$: neighbours $2=2$, result $3\\times3$: $' + M + A + '=' + mat([4, 6, -1], [1, 3, -1], [7, -3, 5]) + '$. Both products exist and do not even have the same size: **order matters**.',
        },
        pistas: [{ es: 'Escribe las dimensiones en orden: $(3\\times2)(2\\times3)$.', en: 'Write the sizes in order: $(3\\times2)(2\\times3)$.' }],
      } },
    { sec: { es: 'Propiedades del producto', en: 'Properties of the product' },
      es: 'Con dimensiones compatibles (MML (2.18)–(2.20)): **asociativo**, $(' + A + M + ')' + C + '=' + A + '(' + M + C + ')$; **distributivo**, $(' + A + '+' + M + ')' + C + '=' + A + C + '+' + M + C + '$ y $' + A + '(' + C + '+' + D + ')=' + A + C + '+' + A + D + '$; y la **identidad** $' + I + '_n$ (unos en la diagonal, ceros fuera, MML Def. 2.2) cumple $' + I + '_m' + A + '=' + A + I + '_n=' + A + '$.',
      en: 'With compatible sizes (MML (2.18)–(2.20)): **associative**, $(' + A + M + ')' + C + '=' + A + '(' + M + C + ')$; **distributive**, $(' + A + '+' + M + ')' + C + '=' + A + C + '+' + M + C + '$ and $' + A + '(' + C + '+' + D + ')=' + A + C + '+' + A + D + '$; and the **identity** $' + I + '_n$ (ones on the diagonal, zeros elsewhere, MML Def. 2.2) gives $' + I + '_m' + A + '=' + A + I + '_n=' + A + '$.' },
    { es: '**No** es conmutativo, ni con matrices cuadradas: si $' + A + '=' + mat([0, 1], [0, 0]) + '$ y $' + M + '=' + mat([1, 0], [0, 0]) + '$, entonces $' + A + M + '=' + B('0') + '$ pero $' + M + A + '=' + mat([0, 1], [0, 0]) + '$. Y otra trampa: $' + A + M + '=' + B('0') + '$ **no** implica $' + A + '=' + B('0') + '$ ni $' + M + '=' + B('0') + '$.',
      en: 'It is **not** commutative, not even for square matrices: if $' + A + '=' + mat([0, 1], [0, 0]) + '$ and $' + M + '=' + mat([1, 0], [0, 0]) + '$, then $' + A + M + '=' + B('0') + '$ but $' + M + A + '=' + mat([0, 1], [0, 0]) + '$. Another trap: $' + A + M + '=' + B('0') + '$ does **not** imply $' + A + '=' + B('0') + '$ or $' + M + '=' + B('0') + '$.' },

    // ── Intuición: la matriz como transformación ──
    { sec: { es: 'Intuición: la matriz mueve el plano', en: 'Intuition: the matrix moves the plane' },
      vectores: { ...VENT_T, vec: { e1: [1, 0], e2: [0, 1] }, par: { a: 1, b: 1, c: 0, d: 1 }, deslizadores: DESL_T, capas: [REJ],
        etiqueta: { es: 'Rejilla del plano transformada por una matriz 2×2', en: 'Plane grid transformed by a 2×2 matrix' } },
      es: '**Intuición** (se formaliza en MML §2.7): $' + A + '\\in\\mathbb{R}^{2\\times2}$ lleva cada $' + X + '$ a $' + A + X + '$. Como $' + A + X + '=x_1' + A + E1 + '+x_2' + A + E2 + '$, basta saber adónde van $' + E1 + '$ y $' + E2 + '$: a las **columnas** de $' + A + '$. Mueve las entradas y mira la rejilla.',
      en: '**Intuition** (formalized in MML §2.7): $' + A + '\\in\\mathbb{R}^{2\\times2}$ sends each $' + X + '$ to $' + A + X + '$. Since $' + A + X + '=x_1' + A + E1 + '+x_2' + A + E2 + '$, it is enough to know where $' + E1 + '$ and $' + E2 + '$ go: to the **columns** of $' + A + '$. Move the entries and watch the grid.',
      jugar: {
        botones: BOT_T,
        lecturas: (v, cx) => [
          { expr: '$' + A + E1 + '$', valor: par2(cx, [v.a, v.c]) },
          { expr: '$' + A + E2 + '$', valor: par2(cx, [v.b, v.d]) },
        ],
        arrastrables: true, soltar: soltarT,
      } },
    { par: { a: 0, b: -1, c: 1, d: 1 }, capas: [{ tipo: 'rejilla', m: [[0, -1], [1, 1]] }],
      es: 'Componer transformaciones es multiplicar matrices. Aplicar primero la cizalla $' + S + '=' + mat([1, 1], [0, 1]) + '$ y luego el giro $' + R + '=' + mat([0, -1], [1, 0]) + '$ es $' + R + '(' + S + X + ')=(' + R + S + ')' + X + '$ por la asociatividad, con $' + R + S + '=' + mat([0, -1], [1, 1]) + '$.',
      en: 'Composing transformations is multiplying matrices. Applying first the shear $' + S + '=' + mat([1, 1], [0, 1]) + '$ and then the rotation $' + R + '=' + mat([0, -1], [1, 0]) + '$ is $' + R + '(' + S + X + ')=(' + R + S + ')' + X + '$ by associativity, with $' + R + S + '=' + mat([0, -1], [1, 1]) + '$.' },
    { deriva: {
        pregunta: { es: '¿Y en el otro orden, primero el giro y luego la cizalla ($' + S + R + '$)?', en: 'And in the other order, rotation first and then shear ($' + S + R + '$)?' },
        opciones: [{ es: 'La misma rejilla que $' + R + S + '$', en: 'The same grid as $' + R + S + '$' }, { es: 'Una rejilla distinta', en: 'A different grid' }], correcta: 1,
        razones: [
          { es: 'Girar y cizallar conmutan porque las dos fijan el origen', en: 'Rotating and shearing commute because both fix the origin' },
          { es: 'El producto de matrices no es conmutativo: hay que calcular $' + S + R + '$', en: 'Matrix multiplication is not commutative: compute $' + S + R + '$' },
        ], razonCorrecta: 1,
        pistas: [{ es: 'Calcula la primera columna de $' + S + R + '$: es $' + S + '$ aplicado a $' + R + E1 + '=(0,1)$.', en: 'Compute the first column of $' + S + R + '$: it is $' + S + '$ applied to $' + R + E1 + '=(0,1)$.' }],
        revela: { es: '$' + S + R + '=' + mat([1, -1], [1, 0]) + '\\neq' + R + S + '$. Fijar el origen solo dice que son lineales; el orden sigue importando.', en: '$' + S + R + '=' + mat([1, -1], [1, 0]) + '\\neq' + R + S + '$. Fixing the origin only says they are linear; the order still matters.' },
      },
      par: { a: 1, b: -1, c: 1, d: 0 }, capas: [{ tipo: 'rejilla', m: [[1, -1], [1, 0]] }],
      es: 'Ahora $' + A + E1 + '=(1,1)$ y $' + A + E2 + '=(-1,0)$: otra rejilla. Deshacer una composición exigirá también invertir el orden.',
      en: 'Now $' + A + E1 + '=(1,1)$ and $' + A + E2 + '=(-1,0)$: a different grid. Undoing a composition will also require reversing the order.' },

    // ── Inversa (MML Def. 2.3, (2.21)–(2.28)) ──
    { sec: { es: 'La inversa', en: 'The inverse' }, capas: [REJ], par: { a: 1, b: 1, c: 0, d: 1 },
      es: 'Sea $' + A + '\\in\\mathbb{R}^{n\\times n}$ **cuadrada**. Si existe $' + M + '\\in\\mathbb{R}^{n\\times n}$ con $' + A + M + '=' + I + '_n=' + M + A + '$, se llama **inversa** de $' + A + '$ y se escribe $' + A + '^{-1}$ (MML Def. 2.3). Si existe es **única** y $' + A + '$ es **regular** (invertible, no singular); si no, **singular**. Intuición: $' + A + '^{-1}$ deshace el movimiento.',
      en: 'Let $' + A + '\\in\\mathbb{R}^{n\\times n}$ be **square**. If there is $' + M + '\\in\\mathbb{R}^{n\\times n}$ with $' + A + M + '=' + I + '_n=' + M + A + '$, it is called the **inverse** of $' + A + '$, written $' + A + '^{-1}$ (MML Def. 2.3). If it exists it is **unique** and $' + A + '$ is **regular** (invertible, nonsingular); otherwise **singular**. Intuition: $' + A + '^{-1}$ undoes the motion.' },
    { es: 'Para $2\\times2$ (MML (2.24)): $' + A + '^{-1}=\\frac{1}{a_{11}a_{22}-a_{12}a_{21}}' + mat(['a_{22}', '-a_{12}'], ['-a_{21}', 'a_{11}']) + '$, y existe **si y solo si** $a_{11}a_{22}-a_{12}a_{21}\\neq0$ (el determinante, MML §4.1). Aplasta la rejilla sobre una recta: ahí vale $0$ y no hay vuelta atrás.',
      en: 'For $2\\times2$ (MML (2.24)): $' + A + '^{-1}=\\frac{1}{a_{11}a_{22}-a_{12}a_{21}}' + mat(['a_{22}', '-a_{12}'], ['-a_{21}', 'a_{11}']) + '$, which exists **if and only if** $a_{11}a_{22}-a_{12}a_{21}\\neq0$ (the determinant, MML §4.1). Squash the grid onto a line: there it is $0$ and there is no way back.',
      jugar: {
        botones: BOT_T,
        lecturas: (v, cx) => {
          const d = v.a * v.d - v.b * v.c, s = Math.abs(d) < 1e-9;
          return [
            { expr: '$a_{11}a_{22}-a_{12}a_{21}$', valor: cx.fmt(d), malo: s },
            { expr: { es: 'fila 1 de A⁻¹', en: 'row 1 of A⁻¹' }, valor: s ? '∄' : `(${cx.fmt(v.d / d)} ; ${cx.fmt(-v.b / d)})`, malo: s },
            { expr: { es: 'fila 2 de A⁻¹', en: 'row 2 of A⁻¹' }, valor: s ? '∄' : `(${cx.fmt(-v.c / d)} ; ${cx.fmt(v.a / d)})`, malo: s },
          ];
        },
        arrastrables: true, soltar: soltarT,
      } },
    { es: '¿Cuál es la inversa de $' + A + '=' + mat([2, 1], [1, 1]) + '$?',
      en: 'What is the inverse of $' + A + '=' + mat([2, 1], [1, 1]) + '$?',
      pregunta: {
        opc: [
          { es: '$' + mat([1, -1], [-1, 2]) + '$', en: '$' + mat([1, -1], [-1, 2]) + '$', ok: 1 },
          { es: '$' + mat(['\\tfrac12', 1], [1, 1]) + '$', en: '$' + mat(['\\tfrac12', 1], [1, 1]) + '$' },
          { es: 'No tiene: tiene entradas repetidas', en: 'None: it has repeated entries' },
        ],
        why: {
          es: '$\\det=2\\cdot1-1\\cdot1=1\\neq0$, así que existe: intercambia la diagonal, cambia de signo el resto y divide entre $1$. Comprueba: $' + mat([2, 1], [1, 1]) + mat([1, -1], [-1, 2]) + '=' + I + '$. Invertir entrada a entrada **no** da la inversa.',
          en: '$\\det=2\\cdot1-1\\cdot1=1\\neq0$, so it exists: swap the diagonal, negate the rest and divide by $1$. Check: $' + mat([2, 1], [1, 1]) + mat([1, -1], [-1, 2]) + '=' + I + '$. Inverting entry by entry does **not** give the inverse.',
        },
        pistas: [{ es: 'Calcula primero $a_{11}a_{22}-a_{12}a_{21}$.', en: 'First compute $a_{11}a_{22}-a_{12}a_{21}$.' }],
      } },
    { es: 'Propiedades (MML (2.26)–(2.28)): $' + A + A + '^{-1}=' + I + '=' + A + '^{-1}' + A + '$; $(' + A + M + ')^{-1}=' + M + '^{-1}' + A + '^{-1}$, en orden **inverso**, porque $(' + A + M + ')(' + M + '^{-1}' + A + '^{-1})=' + A + I + A + '^{-1}=' + I + '$; y en general $(' + A + '+' + M + ')^{-1}\\neq' + A + '^{-1}+' + M + '^{-1}$: ya con escalares, $\\frac{1}{2+4}\\neq\\frac12+\\frac14$.',
      en: 'Properties (MML (2.26)–(2.28)): $' + A + A + '^{-1}=' + I + '=' + A + '^{-1}' + A + '$; $(' + A + M + ')^{-1}=' + M + '^{-1}' + A + '^{-1}$, in **reverse** order, because $(' + A + M + ')(' + M + '^{-1}' + A + '^{-1})=' + A + I + A + '^{-1}=' + I + '$; and in general $(' + A + '+' + M + ')^{-1}\\neq' + A + '^{-1}+' + M + '^{-1}$: even for scalars, $\\frac{1}{2+4}\\neq\\frac12+\\frac14$.' },

    // ── Traspuesta y simétricas (MML Def. 2.4–2.5, (2.29)–(2.31)) ──
    { sec: { es: 'Traspuesta y simétricas', en: 'Transpose and symmetric matrices' },
      es: 'La **traspuesta** de $' + A + '\\in\\mathbb{R}^{m\\times n}$ es $' + A + T + '\\in\\mathbb{R}^{n\\times m}$ con $(' + A + T + ')_{ij}=a_{ji}$: las columnas pasan a ser filas (MML Def. 2.4). Cumple (MML (2.29)–(2.31)) $(' + A + T + ')' + T + '=' + A + '$, $(' + A + M + ')' + T + '=' + M + T + A + T + '$ y $(' + A + '+' + M + ')' + T + '=' + A + T + '+' + M + T + '$.',
      en: 'The **transpose** of $' + A + '\\in\\mathbb{R}^{m\\times n}$ is $' + A + T + '\\in\\mathbb{R}^{n\\times m}$ with $(' + A + T + ')_{ij}=a_{ji}$: columns become rows (MML Def. 2.4). It satisfies (MML (2.29)–(2.31)) $(' + A + T + ')' + T + '=' + A + '$, $(' + A + M + ')' + T + '=' + M + T + A + T + '$ and $(' + A + '+' + M + ')' + T + '=' + A + T + '+' + M + T + '$.' },
    { es: 'Con $' + A + '\\in\\mathbb{R}^{2\\times3}$ y $' + M + '\\in\\mathbb{R}^{3\\times4}$, ¿qué pasa con $' + A + T + M + T + '$?',
      en: 'With $' + A + '\\in\\mathbb{R}^{2\\times3}$ and $' + M + '\\in\\mathbb{R}^{3\\times4}$, what about $' + A + T + M + T + '$?',
      pregunta: {
        opc: [
          { es: 'Es igual a $(' + A + M + ')' + T + '$', en: 'It equals $(' + A + M + ')' + T + '$' },
          { es: 'No está definido: $(3\\times2)(4\\times3)$', en: 'It is not defined: $(3\\times2)(4\\times3)$', ok: 1 },
          { es: 'Es una matriz $4\\times2$', en: 'It is a $4\\times2$ matrix' },
        ],
        why: {
          es: '$(' + A + M + ')' + T + '$ es $4\\times2$ y solo $' + M + T + A + T + '$, $(4\\times3)(3\\times2)$, encaja. Entrada a entrada: $((' + A + M + ')' + T + ')_{ij}=(' + A + M + ')_{ji}=\\sum_l a_{jl}b_{li}=\\sum_l (' + M + T + ')_{il}(' + A + T + ')_{lj}$.',
          en: '$(' + A + M + ')' + T + '$ is $4\\times2$ and only $' + M + T + A + T + '$, $(4\\times3)(3\\times2)$, fits. Entry-wise: $((' + A + M + ')' + T + ')_{ij}=(' + A + M + ')_{ji}=\\sum_l a_{jl}b_{li}=\\sum_l (' + M + T + ')_{il}(' + A + T + ')_{lj}$.',
        },
        pistas: [{ es: 'Escribe la dimensión de $' + A + T + '$ y la de $' + M + T + '$ y mira las vecinas.', en: 'Write the sizes of $' + A + T + '$ and $' + M + T + '$ and look at the neighbours.' }],
      } },
    { es: '$' + A + '\\in\\mathbb{R}^{n\\times n}$ es **simétrica** si $' + A + '=' + A + T + '$ (MML Def. 2.5); solo las cuadradas pueden serlo. Si $' + A + '$ es invertible también lo es $' + A + T + '$, y $(' + A + '^{-1})' + T + '=(' + A + T + ')^{-1}=:' + A + '^{-\\top}$. La suma de simétricas es simétrica; el producto casi nunca: $' + mat([1, 1], [1, 0]) + mat([0, 1], [1, 0]) + '=' + mat([1, 1], [0, 1]) + '$.',
      en: '$' + A + '\\in\\mathbb{R}^{n\\times n}$ is **symmetric** if $' + A + '=' + A + T + '$ (MML Def. 2.5); only square matrices can be. If $' + A + '$ is invertible so is $' + A + T + '$, and $(' + A + '^{-1})' + T + '=(' + A + T + ')^{-1}=:' + A + '^{-\\top}$. A sum of symmetric matrices is symmetric; a product rarely is: $' + mat([1, 1], [1, 0]) + mat([0, 1], [1, 0]) + '=' + mat([1, 1], [0, 1]) + '$.' },
    { sec: { es: 'Multiplicar por un escalar', en: 'Multiplying by a scalar' },
      es: '$\\lambda' + A + '$ multiplica cada entrada: $(\\lambda' + A + ')_{ij}=\\lambda a_{ij}$ (MML §2.2.3). Los escalares se mueven libremente: $(\\lambda\\psi)' + C + '=\\lambda(\\psi' + C + ')$, $\\lambda(' + M + C + ')=(\\lambda' + M + ')' + C + '=' + M + '(\\lambda' + C + ')$, $(\\lambda' + C + ')' + T + '=\\lambda' + C + T + '$, $(\\lambda+\\psi)' + C + '=\\lambda' + C + '+\\psi' + C + '$, $\\lambda(' + M + '+' + C + ')=\\lambda' + M + '+\\lambda' + C + '$.',
      en: '$\\lambda' + A + '$ multiplies each entry: $(\\lambda' + A + ')_{ij}=\\lambda a_{ij}$ (MML §2.2.3). Scalars move freely: $(\\lambda\\psi)' + C + '=\\lambda(\\psi' + C + ')$, $\\lambda(' + M + C + ')=(\\lambda' + M + ')' + C + '=' + M + '(\\lambda' + C + ')$, $(\\lambda' + C + ')' + T + '=\\lambda' + C + T + '$, $(\\lambda+\\psi)' + C + '=\\lambda' + C + '+\\psi' + C + '$, $\\lambda(' + M + '+' + C + ')=\\lambda' + M + '+\\lambda' + C + '$.' },

    // ── Dónde aparece en ML ──
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' },
      es: 'En regresión lineal (MML §9.2) los datos se apilan en la **matriz de diseño** $' + B('X') + '=[' + X + '_1,\\dots,' + X + '_N]' + T + '\\in\\mathbb{R}^{N\\times D}$, una fila por dato, y todas las predicciones son $' + B('X') + B('\\theta') + '$. El estimador es $' + B('\\theta') + '_{\\text{ML}}=(' + B('X') + T + B('X') + ')^{-1}' + B('X') + T + B('y') + '$ (MML (9.12c)): producto, traspuesta e inversa.',
      en: 'In linear regression (MML §9.2) the data are stacked into the **design matrix** $' + B('X') + '=[' + X + '_1,\\dots,' + X + '_N]' + T + '\\in\\mathbb{R}^{N\\times D}$, one row per data point, and all predictions are $' + B('X') + B('\\theta') + '$. The estimator is $' + B('\\theta') + '_{\\text{ML}}=(' + B('X') + T + B('X') + ')^{-1}' + B('X') + T + B('y') + '$ (MML (9.12c)): product, transpose and inverse.' },
    { es: 'En PCA (MML §10.1) aparece la matriz de covarianza de los datos centrados $' + S + '=\\frac1N\\sum_{n=1}^{N}' + X + '_n' + X + '_n' + T + '$, suma de productos columna por fila; es **simétrica** porque $(' + X + X + T + ')' + T + '=' + X + X + T + '$. Siguiente guía: resolver $' + A + X + '=' + b + '$ de forma sistemática con **eliminación gaussiana** (MML §2.3).',
      en: 'In PCA (MML §10.1) we meet the covariance matrix of the centred data $' + S + '=\\frac1N\\sum_{n=1}^{N}' + X + '_n' + X + '_n' + T + '$, a sum of column-times-row products; it is **symmetric** because $(' + X + X + T + ')' + T + '=' + X + X + T + '$. Next guide: solving $' + A + X + '=' + b + '$ systematically with **Gaussian elimination** (MML §2.3).' },
  ],
};
