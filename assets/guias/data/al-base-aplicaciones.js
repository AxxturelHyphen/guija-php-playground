// Guía «Base, rango y aplicaciones lineales» (Álgebra lineal, lección 4). Sigue MML §2.6 (conjunto generador, base, dimensión,
// rango), §2.7 (aplicaciones lineales, coordenadas, matriz de transformación, cambio de base, núcleo e imagen, rango-nulidad) y
// §2.8 (subespacios y aplicaciones afines, en breve). Escena `vectores` (formato en la cabecera de assets/guias/vectores.js);
// formato de los pasos en data/punteros.js. Notación MML (\bm = \boldsymbol en KaTeX).
const B = x => `\\bm{${x}}`;
const X = B('x'), Y = B('y'), Z = B('0'), A = B('A'), b1 = B('b') + '_1', b2 = B('b') + '_2', e1 = B('e') + '_1', e2 = B('e') + '_2';
const Phi = '\\Phi';
const FB1 = { tipo: 'flecha', a: 'b1' }, FB2 = { tipo: 'flecha', a: 'b2' }, FX = { tipo: 'flecha', a: 'x' }, FC = { tipo: 'flecha', a: 'c' };
const COMB = { tipo: 'comb', coef: ['a', 'b'], vecs: ['b1', 'b2'], nombre: `$\\alpha_1${b1}+\\alpha_2${b2}$` };
const XO = [0, 3];
const soltar = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };
// Coordenadas de x = (0, 3) en la base (b1, b2) por Cramer; null si b1 ∥ b2
const coords = v => {
  const [p, q] = v.vec.b1, [r, s] = v.vec.b2, D = p * s - q * r;
  return Math.abs(D) < 1e-9 ? null : [(XO[0] * s - XO[1] * r) / D, (p * XO[1] - q * XO[0]) / D];
};
const soltarBase = (v, k, val) => { soltar(v, k, val); const c = coords(v); if (c) { v.a = +c[0].toFixed(2); v.b = +c[1].toFixed(2); } };
const M = [['m11', 'm12'], ['m21', 'm22']];
const COLS = [['m11', 'm21'], ['m12', 'm22']];
const ponM = (v, m) => { [[v.m11, v.m12], [v.m21, v.m22]] = m; };
const p2 = (cx, p) => `(${cx.fmt(+p[0].toFixed(2))} ; ${cx.fmt(+p[1].toFixed(2))})`;
const DESL_M = [
  { par: 'm11', min: -2, max: 2, paso: .05, es: '$a_{11}$', en: '$a_{11}$', dec: 2 },
  { par: 'm12', min: -2, max: 2, paso: .05, es: '$a_{12}$', en: '$a_{12}$', dec: 2 },
  { par: 'm21', min: -2, max: 2, paso: .05, es: '$a_{21}$', en: '$a_{21}$', dec: 2 },
  { par: 'm22', min: -2, max: 2, paso: .05, es: '$a_{22}$', en: '$a_{22}$', dec: 2 },
];
const C45 = Math.SQRT1_2;

export default {
  titulo: { es: 'Base, rango y aplicaciones lineales', en: 'Basis, rank and linear mappings' },
  fuentes: [
    'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com',
    'Axler, S. (2015). *Linear algebra done right* (3rd ed.). Springer.',
    'Golan, J. S. (2007). *The linear algebra a beginning graduate student ought to know* (2nd ed.). Springer.',
    'Golub, G. H., & Van Loan, C. F. (2012). *Matrix computations* (4th ed.). Johns Hopkins University Press.',
    'Horn, R. A., & Johnson, C. R. (2013). *Matrix analysis* (2nd ed.). Cambridge University Press.',
    'Liesen, J., & Mehrmann, V. (2015). *Linear algebra*. Springer.',
    'Stoer, J., & Bulirsch, R. (2002). *Introduction to numerical analysis* (3rd ed.). Springer.',
    'Strang, G. (2003). *Introduction to linear algebra* (3rd ed.). Wellesley-Cambridge Press.',
  ],
  pasos: [
    // ── Motivación ──
    { sec: { es: 'Qué problema resuelve', en: 'What problem this solves' },
      vectores: { x: [-3.5, 3.5], y: [-1.5, 3.6], vec: { b1: [2, 1], b2: [-1, 1], c: [1, 2], x: [0, 3] }, par: { a: 1, b: 2 }, arrastrar: ['b1', 'b2'], paso: .25,
        deslizadores: [
          { par: 'a', min: -3, max: 3, paso: .05, es: 'Coordenada $\\alpha_1$', en: 'Coordinate $\\alpha_1$', dec: 2 },
          { par: 'b', min: -3, max: 3, paso: .05, es: 'Coordenada $\\alpha_2$', en: 'Coordinate $\\alpha_2$', dec: 2 },
        ],
        capas: [FB1, FB2, FX, COMB], etiqueta: { es: 'Vectores de base arrastrables b1 y b2 y un vector x fijo', en: 'Draggable basis vectors b1 and b2 and a fixed vector x' } },
      es: 'Dos preguntas guían esta lección (MML §2.6–2.7). ¿Cuántos vectores hacen falta, como mínimo, para fabricar **todos** los de un espacio, y de forma **única**? Esos números serán las **coordenadas**. Y las funciones que respetan la suma y el escalado, ¿se pueden describir con una matriz? Aquí $' + X + '=' + b1 + '+2' + b2 + '$.',
      en: 'Two questions drive this lesson (MML §2.6–2.7). What is the smallest number of vectors that build **every** vector of a space, and in a **unique** way? Those numbers will be the **coordinates**. And can the functions that respect addition and scaling be described by a matrix? Here $' + X + '=' + b1 + '+2' + b2 + '$.' },
    { es: 'Soluciones ingenuas. «Coge cualquier conjunto de vectores que lo genere todo» falla si sobra alguno: los coeficientes dejan de ser únicos y las coordenadas no están bien definidas. «Usa siempre los ejes de siempre» también falla: un subespacio (un plano dentro de $\\mathbb{R}^3$) no trae ejes de serie, y PCA busca precisamente otros ejes mejores (MML cap. 10).',
      en: 'Naive answers. "Take any set of vectors that spans everything" fails if one is superfluous: the coefficients stop being unique and the coordinates are not well defined. "Always use the usual axes" fails too: a subspace (a plane inside $\\mathbb{R}^3$) does not come with axes, and PCA looks precisely for other, better axes (MML ch. 10).' },

    // ── MML §2.6.1 Conjunto generador y base ──
    { sec: { es: 'Conjunto generador y span', en: 'Generating set and span' },
      es: '**Def. 2.13 (MML §2.6.1).** Sean $V$ un espacio vectorial y $\\mathcal{A}=\\{' + X + '_1,\\dots,' + X + '_k\\}\\subseteq\\mathcal{V}$. Si todo $' + B('v') + '\\in\\mathcal{V}$ se puede escribir como combinación lineal de $' + X + '_1,\\dots,' + X + '_k$, $\\mathcal{A}$ es un **conjunto generador** de $V$. El conjunto de **todas** sus combinaciones lineales es su **span**; si genera $V$, se escribe $V=\\operatorname{span}[\\mathcal{A}]$.',
      en: '**Def. 2.13 (MML §2.6.1).** Let $V$ be a vector space and $\\mathcal{A}=\\{' + X + '_1,\\dots,' + X + '_k\\}\\subseteq\\mathcal{V}$. If every $' + B('v') + '\\in\\mathcal{V}$ can be written as a linear combination of $' + X + '_1,\\dots,' + X + '_k$, $\\mathcal{A}$ is a **generating set** of $V$. The set of **all** its linear combinations is its **span**; if it spans $V$, we write $V=\\operatorname{span}[\\mathcal{A}]$.' },
    { capas: [{ tipo: 'span', vecs: ['b1', 'b2'] }, FB1, FB2, FC, FX],
      es: 'Un generador puede tener vectores de sobra. Añade $' + B('c') + '=' + b1 + '+' + b2 + '=(1,2)$: $\\{' + b1 + ',' + b2 + ',' + B('c') + '\\}$ sigue generando $\\mathbb{R}^2$, pero ahora $' + X + '=1\\,' + b1 + '+2\\,' + b2 + '+0\\,' + B('c') + '=0\\,' + b1 + '+1\\,' + b2 + '+1\\,' + B('c') + '$. Hay dos listas de coeficientes para el mismo vector. La redundancia rompe la unicidad.',
      en: 'A generating set may contain spare vectors. Add $' + B('c') + '=' + b1 + '+' + b2 + '=(1,2)$: $\\{' + b1 + ',' + b2 + ',' + B('c') + '\\}$ still spans $\\mathbb{R}^2$, but now $' + X + '=1\\,' + b1 + '+2\\,' + b2 + '+0\\,' + B('c') + '=0\\,' + b1 + '+1\\,' + b2 + '+1\\,' + B('c') + '$. There are two coefficient lists for the same vector. Redundancy breaks uniqueness.' },
    { sec: { es: 'Base', en: 'Basis' }, capas: [{ tipo: 'span', vecs: ['b1', 'b2'] }, FB1, FB2, FX],
      es: '**Def. 2.14 (base, MML §2.6.1).** Un conjunto generador $\\mathcal{A}$ de $V$ es **minimal** si no existe un conjunto más pequeño $\\tilde{\\mathcal{A}}\\subsetneq\\mathcal{A}$ que también genere $V$. Todo conjunto generador linealmente independiente es minimal, y se llama **base** de $V$.',
      en: '**Def. 2.14 (basis, MML §2.6.1).** A generating set $\\mathcal{A}$ of $V$ is **minimal** if there is no smaller set $\\tilde{\\mathcal{A}}\\subsetneq\\mathcal{A}$ that also spans $V$. Every linearly independent generating set is minimal, and it is called a **basis** of $V$.' },
    { es: 'Para $\\mathcal{B}\\subseteq\\mathcal{V}$, $\\mathcal{B}\\neq\\emptyset$, son **equivalentes** (MML §2.6.1): (i) $\\mathcal{B}$ es una base; (ii) es un generador minimal; (iii) es un conjunto independiente **maximal**: añadir otro vector lo vuelve dependiente; (iv) todo $' + X + '\\in V$ es combinación única de vectores de $\\mathcal{B}$: si $' + X + '=\\sum_i\\lambda_i' + B('b') + '_i=\\sum_i\\psi_i' + B('b') + '_i$, entonces $\\lambda_i=\\psi_i$.',
      en: 'For $\\mathcal{B}\\subseteq\\mathcal{V}$, $\\mathcal{B}\\neq\\emptyset$, these are **equivalent** (MML §2.6.1): (i) $\\mathcal{B}$ is a basis; (ii) it is a minimal generating set; (iii) it is a **maximal** independent set: adding any other vector makes it dependent; (iv) every $' + X + '\\in V$ is a unique combination of vectors of $\\mathcal{B}$: if $' + X + '=\\sum_i\\lambda_i' + B('b') + '_i=\\sum_i\\psi_i' + B('b') + '_i$, then $\\lambda_i=\\psi_i$.' },
    { es: 'Por qué (i) implica (iv): si $' + X + '=\\sum_i\\lambda_i' + B('b') + '_i=\\sum_i\\psi_i' + B('b') + '_i$, al restar queda $\\sum_i(\\lambda_i-\\psi_i)' + B('b') + '_i=' + Z + '$. Por independencia, todos los coeficientes son $0$, así que $\\lambda_i=\\psi_i$. Al revés, la unicidad aplicada a $' + X + '=' + Z + '$ dice que la única combinación que da $' + Z + '$ es la trivial: eso es la independencia. Base = generar + independencia.',
      en: 'Why (i) implies (iv): if $' + X + '=\\sum_i\\lambda_i' + B('b') + '_i=\\sum_i\\psi_i' + B('b') + '_i$, subtracting gives $\\sum_i(\\lambda_i-\\psi_i)' + B('b') + '_i=' + Z + '$. By independence all coefficients are $0$, so $\\lambda_i=\\psi_i$. Conversely, uniqueness applied to $' + X + '=' + Z + '$ says the only combination giving $' + Z + '$ is the trivial one: that is independence. Basis = spanning + independence.' },
    { capas: [{ tipo: 'span', vecs: ['b1', 'b2'] }, FB1, FB2, FX, COMB],
      es: 'Arrastra $' + b1 + '$ y $' + b2 + '$. El vector $' + X + '=(0,3)$ no se mueve, pero sus **coeficientes** $(\\alpha_1,\\alpha_2)$ se recalculan para que $\\alpha_1' + b1 + '+\\alpha_2' + b2 + '$ siga acabando en $' + X + '$. Mismo vector, otra base, otros números. Si alineas $' + b1 + '$ y $' + b2 + '$, dejan de ser base: la mayoría de vectores no se alcanzan.',
      en: 'Drag $' + b1 + '$ and $' + b2 + '$. The vector $' + X + '=(0,3)$ does not move, but its **coefficients** $(\\alpha_1,\\alpha_2)$ are recomputed so that $\\alpha_1' + b1 + '+\\alpha_2' + b2 + '$ still ends at $' + X + '$. Same vector, another basis, other numbers. If you line $' + b1 + '$ and $' + b2 + '$ up, they stop being a basis: most vectors cannot be reached.',
      jugar: {
        botones: [
          { label: { es: 'base canónica', en: 'standard basis' }, hacer: v => { v.vec.b1 = [1, 0]; v.vec.b2 = [0, 1]; v.a = 0; v.b = 3; } },
          { label: 'b₁ = (1 ; 1), b₂ = (1 ; −1)', hacer: v => { v.vec.b1 = [1, 1]; v.vec.b2 = [1, -1]; v.a = 1.5; v.b = -1.5; } },
          { label: { es: 'b₂ paralelo a b₁', en: 'b₂ parallel to b₁' }, hacer: v => { v.vec.b2 = [-v.vec.b1[0], -v.vec.b1[1]]; } },
        ],
        lecturas: (v, cx) => {
          const c = coords(v), d = cx.det(v.vec.b1, v.vec.b2);
          return [
            { expr: { es: 'coordenadas de $' + X + '$', en: 'coordinates of $' + X + '$' }, valor: c ? p2(cx, c) : '—', malo: !c },
            { expr: '$\\det[' + b1 + '\\;' + b2 + ']$', valor: cx.fmt(+d.toFixed(2)), malo: !c },
            { expr: { es: '¿es base de $\\mathbb{R}^2$?', en: 'basis of $\\mathbb{R}^2$?' }, valor: c ? '✓' : '✗', malo: !c },
          ];
        },
        arrastrables: true, soltar: soltarBase,
      } },
    { sec: { es: 'Dimensión', en: 'Dimension' }, capas: [{ tipo: 'span', vecs: ['b1', 'b2'] }, FB1, FB2, FX],
      es: 'Todo espacio vectorial tiene una base. Hay muchas, pero todas tienen el mismo número de vectores (MML §2.6.1). En dimensión finita, ese número es la **dimensión**, $\\dim(V)$. Si $U\\subseteq V$ es un subespacio, $\\dim(U)\\le\\dim(V)$, con igualdad si y solo si $U=V$. **Intuición:** la dimensión cuenta las direcciones independientes.',
      en: 'Every vector space has a basis. There are many, but they all have the same number of vectors (MML §2.6.1). In finite dimension, that number is the **dimension**, $\\dim(V)$. If $U\\subseteq V$ is a subspace, $\\dim(U)\\le\\dim(V)$, with equality if and only if $U=V$. **Intuition:** the dimension counts the independent directions.' },
    { es: 'Ejemplos. La **base canónica** de $\\mathbb{R}^n$ es $' + e1 + ',\\dots,' + B('e') + '_n$, con un $1$ en la posición $i$ y ceros en el resto. $(1,0,0)^\\top,(1,2,0)^\\top,(0,1,3)^\\top$ es otra base de $\\mathbb{R}^3$. Dos vectores independientes de $\\mathbb{R}^3$ no son base: generan un plano, no todo. Ojo: $\\dim$ no es el número de componentes. $\\operatorname{span}[(0,1)^\\top]$ tiene dimensión $1$.',
      en: 'Examples. The **standard basis** of $\\mathbb{R}^n$ is $' + e1 + ',\\dots,' + B('e') + '_n$, with a $1$ in position $i$ and zeros elsewhere. $(1,0,0)^\\top,(1,2,0)^\\top,(0,1,3)^\\top$ is another basis of $\\mathbb{R}^3$. Two independent vectors of $\\mathbb{R}^3$ are not a basis: they span a plane, not everything. Careful: $\\dim$ is not the number of entries. $\\operatorname{span}[(0,1)^\\top]$ has dimension $1$.' },
    { es: '¿Qué dimensión tiene $U=\\{' + X + '\\in\\mathbb{R}^3:x_1+x_2+x_3=0\\}$?',
      en: 'What is the dimension of $U=\\{' + X + '\\in\\mathbb{R}^3:x_1+x_2+x_3=0\\}$?',
      pregunta: {
        opc: [
          { es: '$3$, porque sus vectores tienen 3 componentes', en: '$3$, because its vectors have 3 entries' },
          { es: '$2$', en: '$2$', ok: 1 },
          { es: '$1$, porque es una sola ecuación', en: '$1$, because it is a single equation' },
        ],
        why: {
          es: 'Despejando $x_3=-x_1-x_2$, $x_1$ y $x_2$ son libres: $' + X + '=x_1(1,0,-1)^\\top+x_2(0,1,-1)^\\top$. Esos dos vectores son independientes y generan $U$, así que forman una base y $\\dim U=2$. Cada ecuación independiente **quita** una dimensión: $3-1=2$.',
          en: 'Solving $x_3=-x_1-x_2$, $x_1$ and $x_2$ are free: $' + X + '=x_1(1,0,-1)^\\top+x_2(0,1,-1)^\\top$. Those two vectors are independent and span $U$, so they form a basis and $\\dim U=2$. Each independent equation **removes** one dimension: $3-1=2$.',
        },
      } },
    { sec: { es: 'Hallar una base de un subespacio', en: 'Finding a basis of a subspace' },
      es: 'Receta (MML §2.6.1) para $U=\\operatorname{span}[' + X + '_1,\\dots,' + X + '_m]\\subseteq\\mathbb{R}^n$: (1) pon los vectores como columnas de $' + A + '$; (2) lleva $' + A + '$ a forma escalonada; (3) los $' + X + '_i$ de las **columnas pivote** forman una base de $U$. Ejemplo propio en $\\mathbb{R}^4$: $' + X + '_1=(1,1,0,2)^\\top$, $' + X + '_2=(2,2,0,4)^\\top$, $' + X + '_3=(0,1,1,1)^\\top$, $' + X + '_4=(1,3,2,4)^\\top$.',
      en: 'Recipe (MML §2.6.1) for $U=\\operatorname{span}[' + X + '_1,\\dots,' + X + '_m]\\subseteq\\mathbb{R}^n$: (1) put the vectors as columns of $' + A + '$; (2) reduce $' + A + '$ to row-echelon form; (3) the $' + X + '_i$ of the **pivot columns** form a basis of $U$. An example of our own in $\\mathbb{R}^4$: $' + X + '_1=(1,1,0,2)^\\top$, $' + X + '_2=(2,2,0,4)^\\top$, $' + X + '_3=(0,1,1,1)^\\top$, $' + X + '_4=(1,3,2,4)^\\top$.' },
    { es: 'Con $F_2\\leftarrow F_2-F_1$ y $F_4\\leftarrow F_4-2F_1$, y luego restando la nueva $F_2$ a $F_3$ y a $F_4$: $\\begin{bmatrix}1&2&0&1\\\\1&2&1&3\\\\0&0&1&2\\\\2&4&1&4\\end{bmatrix}\\rightsquigarrow\\begin{bmatrix}1&2&0&1\\\\0&0&1&2\\\\0&0&0&0\\\\0&0&0&0\\end{bmatrix}$. Pivotes en las columnas 1 y 3: $\\{' + X + '_1,' + X + '_3\\}$ es base y $\\dim U=2$. Además, $' + X + '_2=2' + X + '_1$ y $' + X + '_4=' + X + '_1+2' + X + '_3$.',
      en: 'With $R_2\\leftarrow R_2-R_1$ and $R_4\\leftarrow R_4-2R_1$, then subtracting the new $R_2$ from $R_3$ and $R_4$: $\\begin{bmatrix}1&2&0&1\\\\1&2&1&3\\\\0&0&1&2\\\\2&4&1&4\\end{bmatrix}\\rightsquigarrow\\begin{bmatrix}1&2&0&1\\\\0&0&1&2\\\\0&0&0&0\\\\0&0&0&0\\end{bmatrix}$. Pivots in columns 1 and 3: $\\{' + X + '_1,' + X + '_3\\}$ is a basis and $\\dim U=2$. Also, $' + X + '_2=2' + X + '_1$ and $' + X + '_4=' + X + '_1+2' + X + '_3$.' },

    // ── MML §2.6.2 Rango ──
    { sec: { es: 'Rango', en: 'Rank' },
      es: '**Rango (MML §2.6.2).** El número de columnas linealmente independientes de $' + A + '\\in\\mathbb{R}^{m\\times n}$ coincide con el de filas independientes. Ese número es el **rango**, $\\operatorname{rk}(' + A + ')$. Por tanto $\\operatorname{rk}(' + A + ')=\\operatorname{rk}(' + A + '^\\top)$: el rango por columnas es igual al rango por filas.',
      en: '**Rank (MML §2.6.2).** The number of linearly independent columns of $' + A + '\\in\\mathbb{R}^{m\\times n}$ equals the number of independent rows. That number is the **rank**, $\\operatorname{rk}(' + A + ')$. Hence $\\operatorname{rk}(' + A + ')=\\operatorname{rk}(' + A + '^\\top)$: column rank equals row rank.' },
    { es: 'Propiedades (MML §2.6.2). Las columnas de $' + A + '$ generan un subespacio $U\\subseteq\\mathbb{R}^m$ con $\\dim(U)=\\operatorname{rk}(' + A + ')$, la futura **imagen**; una base son sus columnas pivote. Las filas generan $W\\subseteq\\mathbb{R}^n$ con $\\dim(W)=\\operatorname{rk}(' + A + ')$; una base sale de aplicar Gauss a $' + A + '^\\top$. Y $' + A + '\\in\\mathbb{R}^{n\\times n}$ es invertible si y solo si $\\operatorname{rk}(' + A + ')=n$.',
      en: 'Properties (MML §2.6.2). The columns of $' + A + '$ span a subspace $U\\subseteq\\mathbb{R}^m$ with $\\dim(U)=\\operatorname{rk}(' + A + ')$, the future **image**; its pivot columns are a basis. The rows span $W\\subseteq\\mathbb{R}^n$ with $\\dim(W)=\\operatorname{rk}(' + A + ')$; a basis comes from Gauss on $' + A + '^\\top$. And $' + A + '\\in\\mathbb{R}^{n\\times n}$ is invertible if and only if $\\operatorname{rk}(' + A + ')=n$.' },
    { es: 'Más propiedades (MML §2.6.2). $' + A + X + '=' + B('b') + '$ tiene solución si y solo si $\\operatorname{rk}(' + A + ')=\\operatorname{rk}(' + A + '|' + B('b') + ')$. Las soluciones de $' + A + X + '=' + Z + '$ forman un subespacio de dimensión $n-\\operatorname{rk}(' + A + ')$, el **núcleo**. **Rango completo**: $\\operatorname{rk}(' + A + ')=\\min(m,n)$; si no, la matriz es **de rango deficiente**.',
      en: 'More properties (MML §2.6.2). $' + A + X + '=' + B('b') + '$ is solvable if and only if $\\operatorname{rk}(' + A + ')=\\operatorname{rk}(' + A + '|' + B('b') + ')$. The solutions of $' + A + X + '=' + Z + '$ form a subspace of dimension $n-\\operatorname{rk}(' + A + ')$, the **kernel**. **Full rank**: $\\operatorname{rk}(' + A + ')=\\min(m,n)$; otherwise the matrix is **rank deficient**.' },
    { es: 'Ejemplo propio: $' + A + '=\\begin{bmatrix}1&2&3\\\\2&4&6\\\\1&0&1\\end{bmatrix}$. La fila 2 es el doble de la 1, y las filas 1 y 3 son independientes, así que $\\operatorname{rk}(' + A + ')=2$. Por columnas sale lo mismo: la columna 3 es la suma de las otras dos, $(3,6,1)=(1,2,1)+(2,4,0)$. $' + A + '$ no es invertible, y $' + A + X + '=' + Z + '$ tiene un espacio de soluciones de dimensión $3-2=1$.',
      en: 'An example of our own: $' + A + '=\\begin{bmatrix}1&2&3\\\\2&4&6\\\\1&0&1\\end{bmatrix}$. Row 2 is twice row 1, and rows 1 and 3 are independent, so $\\operatorname{rk}(' + A + ')=2$. By columns it is the same: column 3 is the sum of the other two, $(3,6,1)=(1,2,1)+(2,4,0)$. $' + A + '$ is not invertible, and $' + A + X + '=' + Z + '$ has a solution space of dimension $3-2=1$.' },
    { es: '$' + A + '\\in\\mathbb{R}^{3\\times3}$ tiene $\\operatorname{rk}(' + A + ')=2$ y, para cierto $' + B('b') + '$, $\\operatorname{rk}(' + A + '|' + B('b') + ')=3$. ¿Cuántas soluciones tiene $' + A + X + '=' + B('b') + '$?',
      en: '$' + A + '\\in\\mathbb{R}^{3\\times3}$ has $\\operatorname{rk}(' + A + ')=2$ and, for some $' + B('b') + '$, $\\operatorname{rk}(' + A + '|' + B('b') + ')=3$. How many solutions does $' + A + X + '=' + B('b') + '$ have?',
      pregunta: {
        opc: [
          { es: 'Ninguna', en: 'None', ok: 1 },
          { es: 'Infinitas, porque $' + A + '$ no es invertible', en: 'Infinitely many, because $' + A + '$ is not invertible' },
          { es: 'Exactamente una', en: 'Exactly one' },
        ],
        why: {
          es: 'Que el rango suba al añadir $' + B('b') + '$ significa que $' + B('b') + '$ **no** es combinación de las columnas de $' + A + '$: está fuera de su imagen. El sistema es incompatible. Habría infinitas soluciones si $\\operatorname{rk}(' + A + ')=\\operatorname{rk}(' + A + '|' + B('b') + ')=2<3$.',
          en: 'The rank going up when $' + B('b') + '$ is appended means $' + B('b') + '$ is **not** a combination of the columns of $' + A + '$: it lies outside its image. The system is inconsistent. There would be infinitely many solutions if $\\operatorname{rk}(' + A + ')=\\operatorname{rk}(' + A + '|' + B('b') + ')=2<3$.',
        },
      } },

    // ── MML §2.7 Aplicaciones lineales ──
    { sec: { es: 'Aplicaciones lineales', en: 'Linear mappings' },
      vectores: { x: [-3, 3], y: [-3, 3], vec: { p: [1, 1], q: [1, -1] }, par: { m11: 1, m12: .5, m21: 0, m22: 1 }, deslizadores: DESL_M,
        capas: [{ tipo: 'rejilla', m: M }], etiqueta: { es: 'Rejilla del plano transformada por una matriz 2×2', en: 'Plane grid transformed by a 2×2 matrix' } },
      es: '**Def. 2.15 (MML §2.7).** Dados espacios vectoriales $V,W$, una aplicación $' + Phi + ':V\\to W$ es **lineal** (homomorfismo de espacios vectoriales) si $\\forall' + X + ',' + Y + '\\in V\\;\\forall\\lambda,\\psi\\in\\mathbb{R}:\\;' + Phi + '(\\lambda' + X + '+\\psi' + Y + ')=\\lambda' + Phi + '(' + X + ')+\\psi' + Phi + '(' + Y + ')$. Equivale a respetar la suma, $' + Phi + '(' + X + '+' + Y + ')=' + Phi + '(' + X + ')+' + Phi + '(' + Y + ')$, y el escalado, $' + Phi + '(\\lambda' + X + ')=\\lambda' + Phi + '(' + X + ')$.',
      en: '**Def. 2.15 (MML §2.7).** Given vector spaces $V,W$, a mapping $' + Phi + ':V\\to W$ is **linear** (a vector space homomorphism) if $\\forall' + X + ',' + Y + '\\in V\\;\\forall\\lambda,\\psi\\in\\mathbb{R}:\\;' + Phi + '(\\lambda' + X + '+\\psi' + Y + ')=\\lambda' + Phi + '(' + X + ')+\\psi' + Phi + '(' + Y + ')$. This is the same as respecting addition, $' + Phi + '(' + X + '+' + Y + ')=' + Phi + '(' + X + ')+' + Phi + '(' + Y + ')$, and scaling, $' + Phi + '(\\lambda' + X + ')=\\lambda' + Phi + '(' + X + ')$.' },
    { es: 'Toda matriz define una aplicación lineal $' + X + '\\mapsto' + A + X + '$, porque $' + A + '(\\lambda' + X + '+\\psi' + Y + ')=\\lambda' + A + X + '+\\psi' + A + Y + '$. **Intuición:** mueve los deslizadores de $' + A + '$. La rejilla se deforma, pero sus líneas siguen rectas, paralelas e igual de espaciadas, y el origen no se mueve. Eso es lo que significa «respetar la suma y el escalado».',
      en: 'Every matrix defines a linear mapping $' + X + '\\mapsto' + A + X + '$, because $' + A + '(\\lambda' + X + '+\\psi' + Y + ')=\\lambda' + A + X + '+\\psi' + A + Y + '$. **Intuition:** move the sliders of $' + A + '$. The grid deforms, but its lines stay straight, parallel and evenly spaced, and the origin does not move. That is what "respecting addition and scaling" means.' },
    { es: '**Def. 2.16 (MML §2.7).** $' + Phi + ':\\mathcal{V}\\to\\mathcal{W}$ es **inyectiva** si $' + Phi + '(' + X + ')=' + Phi + '(' + Y + ')\\Rightarrow' + X + '=' + Y + '$; **sobreyectiva** si $' + Phi + '(\\mathcal{V})=\\mathcal{W}$; **biyectiva** si es las dos cosas. Una biyectiva se puede deshacer: tiene inversa $' + Phi + '^{-1}$, con $' + Phi + '^{-1}\\circ' + Phi + '(' + X + ')=' + X + '$.',
      en: '**Def. 2.16 (MML §2.7).** $' + Phi + ':\\mathcal{V}\\to\\mathcal{W}$ is **injective** if $' + Phi + '(' + X + ')=' + Phi + '(' + Y + ')\\Rightarrow' + X + '=' + Y + '$; **surjective** if $' + Phi + '(\\mathcal{V})=\\mathcal{W}$; **bijective** if both. A bijective one can be undone: it has an inverse $' + Phi + '^{-1}$, with $' + Phi + '^{-1}\\circ' + Phi + '(' + X + ')=' + X + '$.' },
    { es: 'Casos especiales de aplicaciones lineales (MML §2.7): **isomorfismo** (biyectiva), **endomorfismo** ($V\\to V$), **automorfismo** (endomorfismo biyectivo); $\\mathrm{id}_V(' + X + ')=' + X + '$.',
      en: 'Special cases of linear mappings (MML §2.7): **isomorphism** (bijective), **endomorphism** ($V\\to V$), **automorphism** (bijective endomorphism); $\\mathrm{id}_V(' + X + ')=' + X + '$.' },
    { es: '**Teorema 2.17 (MML §2.7).** Dos espacios vectoriales de dimensión finita $V$ y $W$ son isomorfos si y solo si $\\dim(V)=\\dim(W)$. Por eso $\\mathbb{R}^{m\\times n}\\cong\\mathbb{R}^{mn}$ («aplanar» una matriz, `reshape` en NumPy, no pierde nada). Además: la composición de lineales es lineal, la inversa de un isomorfismo es un isomorfismo, y $' + Phi + '+\\Psi$ y $\\lambda' + Phi + '$ son lineales.',
      en: '**Theorem 2.17 (MML §2.7).** Two finite-dimensional vector spaces $V$ and $W$ are isomorphic if and only if $\\dim(V)=\\dim(W)$. That is why $\\mathbb{R}^{m\\times n}\\cong\\mathbb{R}^{mn}$ ("flattening" a matrix, `reshape` in NumPy, loses nothing). Also: a composition of linear maps is linear, the inverse of an isomorphism is an isomorphism, and $' + Phi + '+\\Psi$ and $\\lambda' + Phi + '$ are linear.' },
    { deriva: {
        pregunta: { es: '¿Es lineal la traslación $' + Phi + '(' + X + ')=' + X + '+(1,0)^\\top$ de $\\mathbb{R}^2$ en $\\mathbb{R}^2$?', en: 'Is the translation $' + Phi + '(' + X + ')=' + X + '+(1,0)^\\top$ from $\\mathbb{R}^2$ to $\\mathbb{R}^2$ linear?' },
        opciones: [{ es: 'No', en: 'No' }, { es: 'Sí', en: 'Yes' }], correcta: 0,
        razones: [
          { es: 'Una aplicación lineal siempre envía $' + Z + '$ a $' + Z + '$, y esta envía $' + Z + '$ a $(1,0)$', en: 'A linear map always sends $' + Z + '$ to $' + Z + '$, and this one sends $' + Z + '$ to $(1,0)$' },
          { es: 'Conserva las rectas y el paralelismo, así que es lineal', en: 'It preserves lines and parallelism, so it is linear' },
          { es: 'Toda biyección del plano es lineal', en: 'Every bijection of the plane is linear' },
        ], razonCorrecta: 0,
        revela: { es: 'De la linealidad sale $' + Phi + '(' + Z + ')=' + Phi + '(0\\cdot' + Z + ')=0\\cdot' + Phi + '(' + Z + ')=' + Z + '$. La traslación da $' + Phi + '(' + Z + ')=(1,0)\\neq' + Z + '$, y además $' + Phi + '(' + X + '+' + Y + ')=' + X + '+' + Y + '+(1,0)\\neq' + Phi + '(' + X + ')+' + Phi + '(' + Y + ')$. Conserva rectas y paralelismo, pero eso la hace **afín** (MML §2.8), no lineal.', en: 'Linearity gives $' + Phi + '(' + Z + ')=' + Phi + '(0\\cdot' + Z + ')=0\\cdot' + Phi + '(' + Z + ')=' + Z + '$. The translation gives $' + Phi + '(' + Z + ')=(1,0)\\neq' + Z + '$, and also $' + Phi + '(' + X + '+' + Y + ')=' + X + '+' + Y + '+(1,0)\\neq' + Phi + '(' + X + ')+' + Phi + '(' + Y + ')$. It preserves lines and parallelism, but that makes it **affine** (MML §2.8), not linear.' },
      },
      es: 'No es lineal: $' + Phi + '(' + Z + ')=(1,0)$. Las traslaciones son el ejemplo típico de aplicación **afín**, que veremos al final de la lección.',
      en: 'It is not linear: $' + Phi + '(' + Z + ')=(1,0)$. Translations are the typical example of an **affine** mapping, which we will see at the end of the lesson.' },

    // ── MML §2.7.1 Coordenadas y matriz de transformación ──
    { sec: { es: 'Coordenadas', en: 'Coordinates' },
      es: '**Def. 2.18 (MML §2.7.1).** Sea $B=(' + b1 + ',\\dots,' + B('b') + '_n)$ una **base ordenada** de $V$. Todo $' + X + '\\in V$ se escribe de forma única como $' + X + '=\\alpha_1' + b1 + '+\\dots+\\alpha_n' + B('b') + '_n$. Los $\\alpha_i$ son las **coordenadas** de $' + X + '$ respecto a $B$, y $' + B('\\alpha') + '=(\\alpha_1,\\dots,\\alpha_n)^\\top\\in\\mathbb{R}^n$ es su **vector de coordenadas**. Es lo que viste al arrastrar $' + b1 + ',' + b2 + '$.',
      en: '**Def. 2.18 (MML §2.7.1).** Let $B=(' + b1 + ',\\dots,' + B('b') + '_n)$ be an **ordered basis** of $V$. Every $' + X + '\\in V$ is written uniquely as $' + X + '=\\alpha_1' + b1 + '+\\dots+\\alpha_n' + B('b') + '_n$. The $\\alpha_i$ are the **coordinates** of $' + X + '$ with respect to $B$, and $' + B('\\alpha') + '=(\\alpha_1,\\dots,\\alpha_n)^\\top\\in\\mathbb{R}^n$ is its **coordinate vector**. That is what you saw when dragging $' + b1 + ',' + b2 + '$.' },
    { es: 'Notación de MML: $B=(' + b1 + ',\\dots,' + B('b') + '_n)$ es una base **ordenada**, $\\{' + b1 + ',\\dots,' + B('b') + '_n\\}$ una base sin orden, y $' + B('B') + '=[' + b1 + ',\\dots,' + B('b') + '_n]$ la matriz con ellos como columnas. En $\\mathbb{R}^n$, $' + X + '=' + B('B') + B('\\alpha') + '$, luego $' + B('\\alpha') + '=' + B('B') + '^{-1}' + X + '$; $' + B('B') + '$ es invertible porque sus columnas son base. La aplicación $\\mathbb{R}^n\\to V$, $' + B('e') + '_i\\mapsto' + B('b') + '_i$, es un isomorfismo.',
      en: 'MML notation: $B=(' + b1 + ',\\dots,' + B('b') + '_n)$ is an **ordered** basis, $\\{' + b1 + ',\\dots,' + B('b') + '_n\\}$ an unordered basis, and $' + B('B') + '=[' + b1 + ',\\dots,' + B('b') + '_n]$ the matrix with those vectors as columns. In $\\mathbb{R}^n$, $' + X + '=' + B('B') + B('\\alpha') + '$, so $' + B('\\alpha') + '=' + B('B') + '^{-1}' + X + '$; $' + B('B') + '$ is invertible because its columns are a basis. The map $\\mathbb{R}^n\\to V$, $' + B('e') + '_i\\mapsto' + B('b') + '_i$, is an isomorphism.' },
    { sec: { es: 'Matriz de transformación', en: 'Transformation matrix' },
      es: '**Def. 2.19 (MML §2.7.1).** Sean $B=(' + b1 + ',\\dots,' + B('b') + '_n)$ base ordenada de $V$, $C=(' + B('c') + '_1,\\dots,' + B('c') + '_m)$ de $W$ y $' + Phi + ':V\\to W$ lineal. Para cada $j$, $' + Phi + '(' + B('b') + '_j)=\\sum_{i=1}^m\\alpha_{ij}' + B('c') + '_i$ de forma única. La matriz $m\\times n$ $' + A + '_' + Phi + '$ con entradas $' + A + '_' + Phi + '(i,j)=\\alpha_{ij}$ es la **matriz de transformación** de $' + Phi + '$ respecto a $B$ y $C$.',
      en: '**Def. 2.19 (MML §2.7.1).** Let $B=(' + b1 + ',\\dots,' + B('b') + '_n)$ be an ordered basis of $V$, $C=(' + B('c') + '_1,\\dots,' + B('c') + '_m)$ one of $W$, and $' + Phi + ':V\\to W$ linear. For each $j$, $' + Phi + '(' + B('b') + '_j)=\\sum_{i=1}^m\\alpha_{ij}' + B('c') + '_i$ uniquely. The $m\\times n$ matrix $' + A + '_' + Phi + '$ with entries $' + A + '_' + Phi + '(i,j)=\\alpha_{ij}$ is the **transformation matrix** of $' + Phi + '$ with respect to $B$ and $C$.' },
    { capas: [{ tipo: 'rejilla', m: M }],
      es: 'Regla clave: la **columna $j$** de $' + A + '_' + Phi + '$ son las coordenadas de $' + Phi + '(' + B('b') + '_j)$ en $C$. Si $\\hat{' + X + '}$ son las coordenadas de $' + X + '$ en $B$ e $\\hat{' + Y + '}$ las de $' + Y + '=' + Phi + '(' + X + ')$ en $C$, entonces $\\hat{' + Y + '}=' + A + '_' + Phi + '\\hat{' + X + '}$ (2.94). Con las bases canónicas, las columnas son $' + A + e1 + '$ y $' + A + e2 + '$: léelas en la rejilla.',
      en: 'Key rule: **column $j$** of $' + A + '_' + Phi + '$ holds the coordinates of $' + Phi + '(' + B('b') + '_j)$ in $C$. If $\\hat{' + X + '}$ are the coordinates of $' + X + '$ in $B$ and $\\hat{' + Y + '}$ those of $' + Y + '=' + Phi + '(' + X + ')$ in $C$, then $\\hat{' + Y + '}=' + A + '_' + Phi + '\\hat{' + X + '}$ (2.94). With the standard bases, the columns are $' + A + e1 + '$ and $' + A + e2 + '$: read them on the grid.',
      jugar: {
        botones: [
          { label: { es: 'giro 45°', en: 'rotate 45°' }, hacer: v => ponM(v, [[+C45.toFixed(2), -C45.toFixed(2)], [+C45.toFixed(2), +C45.toFixed(2)]]) },
          { label: { es: 'estirar x ×2', en: 'stretch x ×2' }, hacer: v => ponM(v, [[2, 0], [0, 1]]) },
          { label: { es: 'reflexión', en: 'reflection' }, hacer: v => ponM(v, [[1, 0], [0, -1]]) },
          { label: { es: 'identidad', en: 'identity' }, hacer: v => ponM(v, [[1, 0], [0, 1]]) },
        ],
        lecturas: (v, cx) => {
          const d = v.m11 * v.m22 - v.m12 * v.m21;
          return [
            { expr: `$${A}${e1}$ (col. 1)`, valor: p2(cx, [v.m11, v.m21]) },
            { expr: `$${A}${e2}$ (col. 2)`, valor: p2(cx, [v.m12, v.m22]) },
            { expr: `$\\det${A}$`, valor: cx.fmt(+d.toFixed(2)), malo: Math.abs(d) < 1e-9 },
          ];
        },
      } },
    { es: 'Una aplicación lineal de $\\mathbb{R}^2$ cumple $' + Phi + '(' + e1 + ')=(1,2)^\\top$ y $' + Phi + '(' + e2 + ')=(-1,0)^\\top$. ¿Cuál es su matriz en la base canónica?',
      en: 'A linear map of $\\mathbb{R}^2$ has $' + Phi + '(' + e1 + ')=(1,2)^\\top$ and $' + Phi + '(' + e2 + ')=(-1,0)^\\top$. What is its matrix in the standard basis?',
      pregunta: {
        opc: [
          { es: '$\\begin{bmatrix}1&-1\\\\2&0\\end{bmatrix}$', en: '$\\begin{bmatrix}1&-1\\\\2&0\\end{bmatrix}$', ok: 1 },
          { es: '$\\begin{bmatrix}1&2\\\\-1&0\\end{bmatrix}$', en: '$\\begin{bmatrix}1&2\\\\-1&0\\end{bmatrix}$' },
          { es: '$\\begin{bmatrix}-1&1\\\\0&2\\end{bmatrix}$', en: '$\\begin{bmatrix}-1&1\\\\0&2\\end{bmatrix}$' },
        ],
        why: {
          es: 'Las imágenes de la base van en **columnas**, en orden: la 1 es $' + Phi + '(' + e1 + ')$ y la 2 es $' + Phi + '(' + e2 + ')$. La segunda opción las pone en filas, que es la traspuesta. La tercera intercambia el orden de las columnas, que sería usar la base $(' + e2 + ',' + e1 + ')$: el orden de la base importa.',
          en: 'The images of the basis go in **columns**, in order: column 1 is $' + Phi + '(' + e1 + ')$ and column 2 is $' + Phi + '(' + e2 + ')$. The second option puts them in rows, which is the transpose. The third swaps the column order, which would mean using the basis $(' + e2 + ',' + e1 + ')$: the order of the basis matters.',
        },
      } },

    // ── MML §2.7.2 Cambio de base ──
    { sec: { es: 'Cambio de base', en: 'Basis change' },
      es: '**Teorema 2.20 (MML §2.7.2).** Sea $' + Phi + ':V\\to W$ lineal, con bases ordenadas $B,\\tilde{B}$ de $V$ y $C,\\tilde{C}$ de $W$. Si $' + A + '_' + Phi + '$ es su matriz respecto a $B,C$, la matriz respecto a $\\tilde{B},\\tilde{C}$ es $\\tilde{' + A + '}_' + Phi + '=' + B('T') + '^{-1}' + A + '_' + Phi + B('S') + '$. $' + B('S') + '\\in\\mathbb{R}^{n\\times n}$ pasa coordenadas de $\\tilde{B}$ a $B$, y $' + B('T') + '\\in\\mathbb{R}^{m\\times m}$ de $\\tilde{C}$ a $C$.',
      en: '**Theorem 2.20 (MML §2.7.2).** Let $' + Phi + ':V\\to W$ be linear, with bases $B,\\tilde{B}$ of $V$ and $C,\\tilde{C}$ of $W$. If $' + A + '_' + Phi + '$ is its matrix with respect to $B,C$, the matrix with respect to $\\tilde{B},\\tilde{C}$ is $\\tilde{' + A + '}_' + Phi + '=' + B('T') + '^{-1}' + A + '_' + Phi + B('S') + '$. $' + B('S') + '\\in\\mathbb{R}^{n\\times n}$ maps coordinates from $\\tilde{B}$ to $B$, and $' + B('T') + '\\in\\mathbb{R}^{m\\times m}$ from $\\tilde{C}$ to $C$.' },
    { es: 'La columna $j$ de $' + B('S') + '$ son las coordenadas de $\\tilde{' + B('b') + '}_j$ en $B$. Se lee de derecha a izquierda: $' + X + '\\mapsto' + B('S') + X + '$ (a la base vieja), $\\mapsto' + A + '_' + Phi + B('S') + X + '$ (aplicar $' + Phi + '$), $\\mapsto' + B('T') + '^{-1}' + A + '_' + Phi + B('S') + X + '$ (a la base nueva de $W$). Y para la composición se cumple $' + A + '_{\\Psi\\circ' + Phi + '}=' + A + '_\\Psi' + A + '_' + Phi + '$.',
      en: 'Column $j$ of $' + B('S') + '$ holds the coordinates of $\\tilde{' + B('b') + '}_j$ in $B$. Read it right to left: $' + X + '\\mapsto' + B('S') + X + '$ (to the old basis), $\\mapsto' + A + '_' + Phi + B('S') + X + '$ (apply $' + Phi + '$), $\\mapsto' + B('T') + '^{-1}' + A + '_' + Phi + B('S') + X + '$ (to the new basis of $W$). And for composition, $' + A + '_{\\Psi\\circ' + Phi + '}=' + A + '_\\Psi' + A + '_' + Phi + '$.' },
    { es: '**Def. 2.21 (equivalencia).** $' + A + ',\\tilde{' + A + '}\\in\\mathbb{R}^{m\\times n}$ son **equivalentes** si existen $' + B('S') + '\\in\\mathbb{R}^{n\\times n}$ y $' + B('T') + '\\in\\mathbb{R}^{m\\times m}$ invertibles con $\\tilde{' + A + '}=' + B('T') + '^{-1}' + A + B('S') + '$. Son la misma aplicación lineal vista en otras bases de $V$ y de $W$ (MML §2.7.2).',
      en: '**Def. 2.21 (equivalence).** $' + A + ',\\tilde{' + A + '}\\in\\mathbb{R}^{m\\times n}$ are **equivalent** if there are invertible $' + B('S') + '\\in\\mathbb{R}^{n\\times n}$ and $' + B('T') + '\\in\\mathbb{R}^{m\\times m}$ with $\\tilde{' + A + '}=' + B('T') + '^{-1}' + A + B('S') + '$. They are the same linear map seen in other bases of $V$ and of $W$ (MML §2.7.2).' },
    { es: '**Def. 2.22 (semejanza).** $' + A + ',\\tilde{' + A + '}\\in\\mathbb{R}^{n\\times n}$ son **semejantes** si existe $' + B('S') + '\\in\\mathbb{R}^{n\\times n}$ invertible con $\\tilde{' + A + '}=' + B('S') + '^{-1}' + A + B('S') + '$. Es el caso $V=W$ con el **mismo** cambio de base a la entrada y a la salida. Semejantes implica equivalentes (basta con tomar $' + B('T') + '=' + B('S') + '$); al revés, no.',
      en: '**Def. 2.22 (similarity).** $' + A + ',\\tilde{' + A + '}\\in\\mathbb{R}^{n\\times n}$ are **similar** if there is an invertible $' + B('S') + '\\in\\mathbb{R}^{n\\times n}$ with $\\tilde{' + A + '}=' + B('S') + '^{-1}' + A + B('S') + '$. It is the case $V=W$ with the **same** basis change at input and output. Similar implies equivalent (just take $' + B('T') + '=' + B('S') + '$); not the other way round.' },
    { capas: [{ tipo: 'rejilla', m: [[1.5, .5], [.5, 1.5]], base: false }, { tipo: 'flecha', a: 'p' }, { tipo: 'flecha', a: [2, 2], nombre: `$${A}${B('p')}$` }, { tipo: 'flecha', a: 'q', nombre: `$${B('q')}=${A}${B('q')}$` }],
      es: 'Ejemplo propio: $' + A + '=\\begin{bmatrix}1.5&0.5\\\\0.5&1.5\\end{bmatrix}$ en la base canónica, y nueva base $' + B('p') + '=(1,1)^\\top$, $' + B('q') + '=(1,-1)^\\top$, así que $' + B('S') + '=[' + B('p') + '\\;' + B('q') + ']$. Se obtiene $' + A + B('S') + '=\\begin{bmatrix}2&1\\\\2&-1\\end{bmatrix}$ y $' + B('S') + '^{-1}=\\tfrac12\\begin{bmatrix}1&1\\\\1&-1\\end{bmatrix}$, luego $\\tilde{' + A + '}=' + B('S') + '^{-1}' + A + B('S') + '=\\begin{bmatrix}2&0\\\\0&1\\end{bmatrix}$.',
      en: 'An example of our own: $' + A + '=\\begin{bmatrix}1.5&0.5\\\\0.5&1.5\\end{bmatrix}$ in the standard basis, and a new basis $' + B('p') + '=(1,1)^\\top$, $' + B('q') + '=(1,-1)^\\top$, so $' + B('S') + '=[' + B('p') + '\\;' + B('q') + ']$. We get $' + A + B('S') + '=\\begin{bmatrix}2&1\\\\2&-1\\end{bmatrix}$ and $' + B('S') + '^{-1}=\\tfrac12\\begin{bmatrix}1&1\\\\1&-1\\end{bmatrix}$, so $\\tilde{' + A + '}=' + B('S') + '^{-1}' + A + B('S') + '=\\begin{bmatrix}2&0\\\\0&1\\end{bmatrix}$.' },
    { es: 'En la base $(' + B('p') + ',' + B('q') + ')$ la misma aplicación es **diagonal**: estira $' + B('p') + '$ por 2 ($' + A + B('p') + '=(2,2)=2' + B('p') + '$) y deja $' + B('q') + '$ igual. En la rejilla, $' + B('p') + '$ y $' + B('q') + '$ no giran, solo se escalan. Elegir la base adecuada simplifica la matriz. Esa es la idea de la diagonalización (MML §4.4) y de PCA, que busca una base cómoda para comprimir datos (cap. 10).',
      en: 'In the basis $(' + B('p') + ',' + B('q') + ')$ the same map is **diagonal**: it stretches $' + B('p') + '$ by 2 ($' + A + B('p') + '=(2,2)=2' + B('p') + '$) and leaves $' + B('q') + '$ as it is. On the grid, $' + B('p') + '$ and $' + B('q') + '$ do not turn, they only scale. Choosing the right basis simplifies the matrix. That is the idea behind diagonalization (MML §4.4) and PCA, which looks for a convenient basis to compress data (ch. 10).' },

    // ── MML §2.7.3 Núcleo e imagen ──
    { sec: { es: 'Núcleo e imagen', en: 'Kernel and image' },
      capas: [{ tipo: 'rejilla', m: [[1, 2], [.5, 1]], base: false }, { tipo: 'span', vecs: [[1, .5]] }, { tipo: 'recta', a: 1, b: 2, c: 0, nombre: '$\\ker$', color: 'var(--g-mal)' }, { tipo: 'flecha', a: [2, -1], nombre: '' }],
      es: '**Def. 2.23 (MML §2.7.3).** Para $' + Phi + ':V\\to W$, el **núcleo** es $\\ker(' + Phi + ')=' + Phi + '^{-1}(' + Z + '_W)=\\{' + B('v') + '\\in V:' + Phi + '(' + B('v') + ')=' + Z + '_W\\}$ y la **imagen** es $\\operatorname{Im}(' + Phi + ')=' + Phi + '(V)=\\{' + B('w') + '\\in W\\mid\\exists' + B('v') + '\\in V:' + Phi + '(' + B('v') + ')=' + B('w') + '\\}$. $V$ es el dominio y $W$ el codominio.',
      en: '**Def. 2.23 (MML §2.7.3).** For $' + Phi + ':V\\to W$, the **kernel** is $\\ker(' + Phi + ')=' + Phi + '^{-1}(' + Z + '_W)=\\{' + B('v') + '\\in V:' + Phi + '(' + B('v') + ')=' + Z + '_W\\}$ and the **image** is $\\operatorname{Im}(' + Phi + ')=' + Phi + '(V)=\\{' + B('w') + '\\in W\\mid\\exists' + B('v') + '\\in V:' + Phi + '(' + B('v') + ')=' + B('w') + '\\}$. $V$ is the domain and $W$ the codomain.' },
    { es: 'Con $' + A + '=\\begin{bmatrix}1&2\\\\0.5&1\\end{bmatrix}$ (columnas paralelas), todo el plano se aplasta sobre la recta sombreada $\\operatorname{span}[(1,0.5)^\\top]$, que es la **imagen**. La recta roja $x+2y=0$ se aplasta entera en $' + Z + '$: es el **núcleo**. Por ejemplo, $' + A + '(2,-1)^\\top=(0,0)^\\top$. Ni la imagen llena el plano ni el núcleo es solo $\\{' + Z + '\\}$.',
      en: 'With $' + A + '=\\begin{bmatrix}1&2\\\\0.5&1\\end{bmatrix}$ (parallel columns), the whole plane is squashed onto the shaded line $\\operatorname{span}[(1,0.5)^\\top]$, which is the **image**. The red line $x+2y=0$ is squashed entirely into $' + Z + '$: it is the **kernel**. For example, $' + A + '(2,-1)^\\top=(0,0)^\\top$. The image does not fill the plane and the kernel is not just $\\{' + Z + '\\}$.' },
    { es: 'Propiedades (MML §2.7.3): $' + Phi + '(' + Z + '_V)=' + Z + '_W$, así que $' + Z + '_V\\in\\ker(' + Phi + ')$ y el núcleo nunca es vacío. $\\operatorname{Im}(' + Phi + ')\\subseteq W$ y $\\ker(' + Phi + ')\\subseteq V$ son subespacios. $' + Phi + '$ es **inyectiva si y solo si** $\\ker(' + Phi + ')=\\{' + Z + '\\}$: dos vectores con la misma imagen difieren en un elemento del núcleo, porque $' + Phi + '(' + X + '-' + Y + ')=' + Z + '$.',
      en: 'Properties (MML §2.7.3): $' + Phi + '(' + Z + '_V)=' + Z + '_W$, so $' + Z + '_V\\in\\ker(' + Phi + ')$ and the kernel is never empty. $\\operatorname{Im}(' + Phi + ')\\subseteq W$ and $\\ker(' + Phi + ')\\subseteq V$ are subspaces. $' + Phi + '$ is **injective if and only if** $\\ker(' + Phi + ')=\\{' + Z + '\\}$: two vectors with the same image differ by an element of the kernel, because $' + Phi + '(' + X + '-' + Y + ')=' + Z + '$.' },
    { es: 'Para $' + Phi + '(' + X + ')=' + A + X + '$ con $' + A + '=[' + B('a') + '_1,\\dots,' + B('a') + '_n]\\in\\mathbb{R}^{m\\times n}$: $\\operatorname{Im}(' + Phi + ')=\\{\\sum_{i=1}^nx_i' + B('a') + '_i\\}=\\operatorname{span}[' + B('a') + '_1,\\dots,' + B('a') + '_n]\\subseteq\\mathbb{R}^m$, el **espacio columna**, y $\\operatorname{rk}(' + A + ')=\\dim(\\operatorname{Im}(' + Phi + '))$. $\\ker(' + Phi + ')$ es la solución general de $' + A + X + '=' + Z + '$, un subespacio de $\\mathbb{R}^n$ (MML §2.7.3).',
      en: 'For $' + Phi + '(' + X + ')=' + A + X + '$ with $' + A + '=[' + B('a') + '_1,\\dots,' + B('a') + '_n]\\in\\mathbb{R}^{m\\times n}$: $\\operatorname{Im}(' + Phi + ')=\\{\\sum_{i=1}^nx_i' + B('a') + '_i\\}=\\operatorname{span}[' + B('a') + '_1,\\dots,' + B('a') + '_n]\\subseteq\\mathbb{R}^m$, the **column space**, and $\\operatorname{rk}(' + A + ')=\\dim(\\operatorname{Im}(' + Phi + '))$. $\\ker(' + Phi + ')$ is the general solution of $' + A + X + '=' + Z + '$, a subspace of $\\mathbb{R}^n$ (MML §2.7.3).' },
    { sec: { es: 'Teorema de rango-nulidad', en: 'Rank-nullity theorem' }, capas: [{ tipo: 'rejilla', m: M }, { tipo: 'span', vecs: COLS }], par: { m11: 1, m12: 2, m21: .5, m22: 1 },
      es: '**Teorema 2.24 (MML §2.7.3).** Para $' + Phi + ':V\\to W$ lineal, $\\dim(\\ker(' + Phi + '))+\\dim(\\operatorname{Im}(' + Phi + '))=\\dim(V)$. Lo que se pierde en el núcleo es justo lo que falta en la imagen. Mueve las entradas de $' + A + '$: la zona sombreada es la imagen, generada por las columnas. Cuando el determinante se anula, la imagen pierde una dimensión y el núcleo la gana.',
      en: '**Theorem 2.24 (MML §2.7.3).** For a linear $' + Phi + ':V\\to W$, $\\dim(\\ker(' + Phi + '))+\\dim(\\operatorname{Im}(' + Phi + '))=\\dim(V)$. What is lost in the kernel is exactly what is missing from the image. Move the entries of $' + A + '$: the shaded area is the image, spanned by the columns. When the determinant vanishes, the image loses a dimension and the kernel gains it.',
      jugar: {
        botones: [
          { label: { es: 'rango 2', en: 'rank 2' }, hacer: v => ponM(v, [[1, .5], [-.5, 1]]) },
          { label: { es: 'rango 1', en: 'rank 1' }, hacer: v => ponM(v, [[1, 2], [.5, 1]]) },
          { label: { es: 'rango 0', en: 'rank 0' }, hacer: v => ponM(v, [[0, 0], [0, 0]]) },
        ],
        lecturas: (v, cx) => {
          const r = cx.dim([[v.m11, v.m21], [v.m12, v.m22]]);
          return [
            { expr: '$\\dim\\operatorname{Im}=\\operatorname{rk}(' + A + ')$', valor: r, malo: r < 2 },
            { expr: '$\\dim\\ker$', valor: 2 - r, malo: r < 2 },
            { expr: '$\\dim\\ker+\\dim\\operatorname{Im}$', valor: 2 },
            { expr: { es: '¿inyectiva?', en: 'injective?' }, valor: r === 2 ? '✓' : '✗', malo: r < 2 },
          ];
        },
      } },
    { es: 'Consecuencias (MML §2.7.3). Si $\\dim(\\operatorname{Im}(' + Phi + '))<\\dim(V)$, el núcleo es no trivial, con $\\dim(\\ker(' + Phi + '))\\ge1$, y $' + A + '_' + Phi + X + '=' + Z + '$ tiene infinitas soluciones. Si $\\dim(V)=\\dim(W)$, entonces $' + Phi + '$ inyectiva $\\iff$ sobreyectiva $\\iff$ biyectiva. Para una matriz cuadrada, basta con comprobar una de las tres.',
      en: 'Consequences (MML §2.7.3). If $\\dim(\\operatorname{Im}(' + Phi + '))<\\dim(V)$, the kernel is non-trivial, with $\\dim(\\ker(' + Phi + '))\\ge1$, and $' + A + '_' + Phi + X + '=' + Z + '$ has infinitely many solutions. If $\\dim(V)=\\dim(W)$, then $' + Phi + '$ injective $\\iff$ surjective $\\iff$ bijective. For a square matrix it is enough to check one of the three.' },
    { sec: { es: 'Calcular el núcleo', en: 'Computing the kernel' },
      code: `import numpy as np
A = np.array([[1., 2., 0., -1.],
              [0., 0., 1.,  2.]])
r = np.linalg.matrix_rank(A)
U, s, Vt = np.linalg.svd(A)
N = Vt[r:].T
print(r, N.shape[1])
print(np.allclose(A @ N, 0))`, line: null,
      es: 'Ejemplo propio: $' + A + '=\\begin{bmatrix}1&2&0&-1\\\\0&0&1&2\\end{bmatrix}$, $\\mathbb{R}^4\\to\\mathbb{R}^2$, ya en forma reducida. Pivotes en 1 y 3; $x_2,x_4$ son libres. Con $x_2=1,x_4=0$ sale $(-2,1,0,0)^\\top$, y con $x_2=0,x_4=1$, $(1,0,-2,1)^\\top$. Así $\\ker=\\operatorname{span}$ de ambos y $2+2=4$. En NumPy, las últimas $n-r$ filas de $' + B('V') + '^\\top$ de la SVD generan el núcleo.',
      en: 'An example of our own: $' + A + '=\\begin{bmatrix}1&2&0&-1\\\\0&0&1&2\\end{bmatrix}$, $\\mathbb{R}^4\\to\\mathbb{R}^2$, already reduced. Pivots in 1 and 3; $x_2,x_4$ are free. With $x_2=1,x_4=0$ we get $(-2,1,0,0)^\\top$, and with $x_2=0,x_4=1$, $(1,0,-2,1)^\\top$. So $\\ker=\\operatorname{span}$ of both and $2+2=4$. In NumPy, the last $n-r$ rows of $' + B('V') + '^\\top$ from the SVD span the kernel.' },
    { code: '', es: '$' + A + '\\in\\mathbb{R}^{3\\times5}$ tiene $\\operatorname{rk}(' + A + ')=3$. ¿Qué dimensión tiene el núcleo de $' + X + '\\mapsto' + A + X + '$?',
      en: '$' + A + '\\in\\mathbb{R}^{3\\times5}$ has $\\operatorname{rk}(' + A + ')=3$. What is the dimension of the kernel of $' + X + '\\mapsto' + A + X + '$?',
      pregunta: {
        opc: [
          { es: '$2$', en: '$2$', ok: 1 },
          { es: '$0$, porque tiene rango completo', en: '$0$, because it has full rank' },
          { es: '$3$', en: '$3$' },
        ],
        why: {
          es: 'El dominio es $\\mathbb{R}^5$: $\\dim\\ker=5-3=2$. «Rango completo» aquí significa $\\operatorname{rk}=\\min(3,5)=3$, así que la aplicación es **sobreyectiva** sobre $\\mathbb{R}^3$, no inyectiva. Con más incógnitas que ecuaciones independientes siempre quedan direcciones libres.',
          en: 'The domain is $\\mathbb{R}^5$: $\\dim\\ker=5-3=2$. "Full rank" here means $\\operatorname{rk}=\\min(3,5)=3$, so the map is **surjective** onto $\\mathbb{R}^3$, not injective. With more unknowns than independent equations there are always free directions.',
        },
      } },

    // ── MML §2.8 Espacios afines ──
    { sec: { es: 'Subespacios afines', en: 'Affine subspaces' },
      vectores: { x: [-3, 3.5], y: [-2, 3.2], vec: { b1: [2, 1], x0: [0, 1] }, par: { l: 1 },
        deslizadores: [{ par: 'l', min: -2, max: 1.5, paso: .05, es: 'Parámetro $\\lambda$', en: 'Parameter $\\lambda$', dec: 2 }],
        capas: [{ tipo: 'span', vecs: ['b1'] }, { tipo: 'recta', a: 1, b: -2, c: -2, nombre: '$L$' }, { tipo: 'flecha', a: 'x0' }, { tipo: 'flecha', a: 'b1' }],
        etiqueta: { es: 'Recta afín L = x0 + span[b1] y su dirección', en: 'Affine line L = x0 + span[b1] and its direction' } },
      es: '**Def. 2.25 (MML §2.8.1).** Sean $V$ un espacio vectorial, $' + X + '_0\\in V$ y $U\\subseteq V$ un subespacio. $L=' + X + '_0+U:=\\{' + X + '_0+' + B('u') + ':' + B('u') + '\\in U\\}$ es un **subespacio afín** de $V$. $U$ es su **dirección** y $' + X + '_0$ su **punto de apoyo**. Si $' + X + '_0\\notin U$, $L$ no contiene $' + Z + '$ y **no** es un subespacio vectorial.',
      en: '**Def. 2.25 (MML §2.8.1).** Let $V$ be a vector space, $' + X + '_0\\in V$ and $U\\subseteq V$ a subspace. $L=' + X + '_0+U:=\\{' + X + '_0+' + B('u') + ':' + B('u') + '\\in U\\}$ is an **affine subspace** of $V$. $U$ is its **direction** and $' + X + '_0$ its **support point**. If $' + X + '_0\\notin U$, $L$ does not contain $' + Z + '$ and is **not** a vector subspace.' },
    { capas: [{ tipo: 'span', vecs: ['b1'] }, { tipo: 'recta', a: 1, b: -2, c: -2, nombre: '$L$' }, { tipo: 'comb', coef: [1, 'l'], vecs: ['x0', 'b1'], nombre: `$${X}_0+\\lambda${b1}$` }],
      es: 'Con una base $(' + b1 + ',\\dots,' + B('b') + '_k)$ de $U$, cada punto de $L$ se escribe de forma única como $' + X + '=' + X + '_0+\\lambda_1' + b1 + '+\\dots+\\lambda_k' + B('b') + '_k$ (**ecuación paramétrica**). Mueve $\\lambda$: $' + X + '_0+\\lambda' + b1 + '$ recorre la recta $L$, paralela a la dirección $U=\\operatorname{span}[' + b1 + ']$. Con $k=1$ es una **recta**, con $k=2$ un **plano** y con $k=n-1$ en $\\mathbb{R}^n$ un **hiperplano**.',
      en: 'With a basis $(' + b1 + ',\\dots,' + B('b') + '_k)$ of $U$, each point of $L$ is written uniquely as $' + X + '=' + X + '_0+\\lambda_1' + b1 + '+\\dots+\\lambda_k' + B('b') + '_k$ (**parametric equation**). Move $\\lambda$: $' + X + '_0+\\lambda' + b1 + '$ runs along the line $L$, parallel to the direction $U=\\operatorname{span}[' + b1 + ']$. With $k=1$ it is a **line**, with $k=2$ a **plane** and with $k=n-1$ in $\\mathbb{R}^n$ a **hyperplane**.',
      jugar: {
        botones: [
          { label: 'λ = 0', hacer: v => { v.l = 0; } },
          { label: 'λ = −1', hacer: v => { v.l = -1; } },
          { label: 'λ = 1', hacer: v => { v.l = 1; } },
        ],
        lecturas: (v, cx) => {
          const p = cx.comb([1, v.l], [v.vec.x0, v.vec.b1]), en = Math.abs(p[0] - 2 * p[1] + 2) < 1e-6;
          return [
            { expr: `$${X}_0+\\lambda${b1}$`, valor: p2(cx, p) },
            { expr: { es: '¿en $L$: $x-2y=-2$?', en: 'on $L$: $x-2y=-2$?' }, valor: en ? '✓' : '✗', malo: !en },
            { expr: { es: '¿$' + Z + '\\in L$?', en: '$' + Z + '\\in L$?' }, valor: '✗', malo: true },
          ];
        },
      } },
    { es: 'Sistemas no homogéneos (MML §2.8.1): el conjunto solución de $' + A + X + '=' + B('b') + '$, con $' + A + '\\in\\mathbb{R}^{m\\times n}$, es vacío o un subespacio afín de $\\mathbb{R}^n$ de dimensión $n-\\operatorname{rk}(' + A + ')$: una solución particular más el núcleo de $' + A + '$. Al revés, todo subespacio afín de dimensión $k$ es la solución de algún $' + A + X + '=' + B('b') + '$ con $\\operatorname{rk}(' + A + ')=n-k$.',
      en: 'Inhomogeneous systems (MML §2.8.1): the solution set of $' + A + X + '=' + B('b') + '$, with $' + A + '\\in\\mathbb{R}^{m\\times n}$, is empty or an affine subspace of $\\mathbb{R}^n$ of dimension $n-\\operatorname{rk}(' + A + ')$: a particular solution plus the kernel of $' + A + '$. Conversely, every $k$-dimensional affine subspace is the solution of some $' + A + X + '=' + B('b') + '$ with $\\operatorname{rk}(' + A + ')=n-k$.' },
    { es: '**Def. 2.26 (aplicación afín, MML §2.8.2).** Dados $V,W$, una aplicación lineal $' + Phi + ':V\\to W$ y $' + B('a') + '\\in W$, la aplicación $\\phi(' + X + ')=' + B('a') + '+' + Phi + '(' + X + ')$ es **afín**, y $' + B('a') + '$ es su **vector de traslación**. Es la composición de $' + Phi + '$ con una traslación, ambas únicas. Las composiciones de afines son afines, y si es biyectiva conserva dimensiones y paralelismo.',
      en: '**Def. 2.26 (affine mapping, MML §2.8.2).** Given $V,W$, a linear mapping $' + Phi + ':V\\to W$ and $' + B('a') + '\\in W$, the mapping $\\phi(' + X + ')=' + B('a') + '+' + Phi + '(' + X + ')$ is **affine**, and $' + B('a') + '$ is its **translation vector**. It is the composition of $' + Phi + '$ with a translation, both unique. Compositions of affine maps are affine, and a bijective one preserves dimension and parallelism.' },
    { es: '$' + A + '\\in\\mathbb{R}^{2\\times3}$ tiene rango 2 y $' + A + X + '=' + B('b') + '$ con $' + B('b') + '\\neq' + Z + '$. ¿Qué es su conjunto solución en $\\mathbb{R}^3$?',
      en: '$' + A + '\\in\\mathbb{R}^{2\\times3}$ has rank 2 and $' + A + X + '=' + B('b') + '$ with $' + B('b') + '\\neq' + Z + '$. What is its solution set in $\\mathbb{R}^3$?',
      pregunta: {
        opc: [
          { es: 'Una recta que no pasa por el origen', en: 'A line not through the origin', ok: 1 },
          { es: 'Un plano por el origen', en: 'A plane through the origin' },
          { es: 'Un único punto', en: 'A single point' },
        ],
        why: {
          es: '$\\operatorname{rk}(' + A + ')=2=m$, así que $\\operatorname{rk}(' + A + '|' + B('b') + ')=2$ y hay solución. Su dimensión es $n-\\operatorname{rk}=3-2=1$: una recta $' + X + '_p+\\ker(' + A + ')$. No pasa por $' + Z + '$, porque $' + A + Z + '=' + Z + '\\neq' + B('b') + '$. Es un subespacio afín, no vectorial.',
          en: '$\\operatorname{rk}(' + A + ')=2=m$, so $\\operatorname{rk}(' + A + '|' + B('b') + ')=2$ and a solution exists. Its dimension is $n-\\operatorname{rk}=3-2=1$: a line $' + X + '_p+\\ker(' + A + ')$. It does not pass through $' + Z + '$, because $' + A + Z + '=' + Z + '\\neq' + B('b') + '$. It is an affine subspace, not a vector one.',
        },
      } },

    // ── ML ──
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' },
      es: '**PCA (MML cap. 10)**: elige una base ortonormal de un subespacio de dimensión $M\\ll D$. El código de cada dato son sus **coordenadas** en esa base, y volver del código al dato es una aplicación lineal. **Regresión (cap. 9)**: si $\\operatorname{rk}(' + B('\\Phi') + ')$ es completo por columnas, la solución es única, y la predicción por máxima verosimilitud es la proyección sobre $\\operatorname{Im}(' + B('\\Phi') + ')$ (§9.4).',
      en: '**PCA (MML ch. 10)**: picks an orthonormal basis of a subspace of dimension $M\\ll D$. Each data point\'s code is its **coordinates** in that basis, and going from code back to data is a linear map (a basis change). **Regression (ch. 9)**: if $' + B('\\Phi') + '$ has full column rank, the solution is unique, and the maximum-likelihood prediction is the projection onto $\\operatorname{Im}(' + B('\\Phi') + ')$ (§9.4).' },
    { es: '**SVM (cap. 12)**: el clasificador separa con un **hiperplano** $\\{' + X + ':\\langle' + B('w') + ',' + X + '\\rangle+b=0\\}$, un subespacio afín de dimensión $D-1$ que en general no pasa por el origen. **Redes neuronales**: cada capa $' + X + '\\mapsto' + A + X + '+' + B('b') + '$ es afín, aunque en ML se suele llamar «lineal»; MML avisa de esa confusión (§2.8).',
      en: '**SVM (ch. 12)**: the classifier separates with a **hyperplane** $\\{' + X + ':\\langle' + B('w') + ',' + X + '\\rangle+b=0\\}$, an affine subspace of dimension $D-1$ that in general does not pass through the origin. **Neural networks**: each layer $' + X + '\\mapsto' + A + X + '+' + B('b') + '$ is affine, though ML often calls it "linear"; MML warns about this confusion (§2.8).' },
    { es: 'Resumen: una base es un generador independiente, y da coordenadas únicas; todas tienen $\\dim(V)$ vectores. El rango cuenta las columnas (o filas) independientes. Una aplicación lineal queda fijada por las imágenes de una base, que son las columnas de su matriz. Al cambiar de base, $\\tilde{' + A + '}=' + B('T') + '^{-1}' + A + B('S') + '$. Y $\\dim\\ker+\\dim\\operatorname{Im}=\\dim V$. Siguiente: geometría analítica (MML cap. 3).',
      en: 'Summary: a basis is an independent generating set, and it gives unique coordinates; all bases have $\\dim(V)$ vectors. The rank counts independent columns (or rows). A linear map is fixed by the images of a basis, which are the columns of its matrix. Under a basis change, $\\tilde{' + A + '}=' + B('T') + '^{-1}' + A + B('S') + '$. And $\\dim\\ker+\\dim\\operatorname{Im}=\\dim V$. Next: analytic geometry (MML ch. 3).' },

    // ── MML §2.9 Para seguir ──
    { sec: { es: 'Para seguir (MML §2.9)', en: 'Further reading (MML §2.9)' },
      es: 'Aquí solo hemos resuelto sistemas con **eliminación gaussiana**. Con sistemas grandes o mal condicionados, el álgebra lineal numérica factoriza la matriz (LU, QR; Cholesky en §4.3) o usa métodos iterativos (Jacobi, Gauss-Seidel, gradiente conjugado; §2.3.4). Para profundizar: Golub y Van Loan (2012), Stoer y Bulirsch (2002) y Horn y Johnson (2013).',
      en: 'Here we only solved systems with **Gaussian elimination**. For large or ill-conditioned systems, numerical linear algebra factorizes the matrix (LU, QR; Cholesky in §4.3) or uses iterative methods (Jacobi, Gauss-Seidel, conjugate gradient; §2.3.4). To go deeper: Golub and Van Loan (2012), Stoer and Bulirsch (2002) and Horn and Johnson (2013).' },
    { es: 'Hasta aquí todo es **álgebra**: vectores, matrices, independencia, base. Aún no hay longitudes ni ángulos. El cap. 3 añade un **producto interno**, que induce una norma y con ella distancias, ángulos y **proyecciones ortogonales**, la pieza clave de la regresión lineal (cap. 9) y de PCA (cap. 10). Siguiente guía: normas y ortogonalidad. Manuales: Strang (2003), Axler (2015), Liesen y Mehrmann (2015), Golan (2007).',
      en: 'So far everything is **algebra**: vectors, matrices, independence, basis. There are no lengths or angles yet. Ch. 3 adds an **inner product**, which induces a norm and with it distances, angles and **orthogonal projections**, the key piece of linear regression (ch. 9) and PCA (ch. 10). Next guide: norms and orthogonality. Textbooks: Strang (2003), Axler (2015), Liesen and Mehrmann (2015), Golan (2007).' },
  ],
};
