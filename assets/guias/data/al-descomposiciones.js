// Guía «Descomposiciones de matrices» (Álgebra lineal, lección 8). Sigue MML §4.3 (Cholesky), §4.4 (diagonalización),
// §4.5 (SVD), §4.6 (aproximación de matrices) y §4.7 (filogenia). Escena `vectores` (formato en la cabecera de
// assets/guias/vectores.js: capas elipse, propios, imagen); formato de los pasos en data/punteros.js. Notación MML (\bm =
// \boldsymbol en KaTeX). Ejemplos propios, verificados a mano y con svd2/eig2 en tests/guias/test-vectores.js.
const B = x => `\\bm{${x}}`;
const A = B('A'), X = B('x'), I = B('I'), Z = B('0'), L = B('L'), P = B('P'), D = B('D'), U = B('U'), V = B('V'), Sg = B('\\Sigma');
const u1 = `${B('u')}_1`, u2 = `${B('u')}_2`, v1 = `${B('v')}_1`, v2 = `${B('v')}_2`, Bm = B('B'), Ah = `\\hat{${A}}`;
const M = [['m11', 'm12'], ['m21', 'm22']], ML = [['l11', 0], ['l21', 'l22']], MS = [['a', 'b'], ['b', 'd']];
const A0 = [[1.2, 0], [1.6, 2]]; // 0,4 · [[3,0],[4,5]] (el ejemplo resuelto, escalado para que quepa)
const PAR = { m11: 1.2, m12: 0, m21: 1.6, m22: 2, l11: 1, l21: .5, l22: 1, a: 2, b: .5, d: 1 };
const DM = [['m11', 'a_{11}'], ['m12', 'a_{12}'], ['m21', 'a_{21}'], ['m22', 'a_{22}']]
  .map(([par, t]) => ({ par, min: -3, max: 3, paso: .1, es: `Entrada $${t}$`, en: `Entry $${t}$`, dec: 1 }));
const DL = [['l11', 'l_{11}', .2, 2.5], ['l21', 'l_{21}', -2, 2], ['l22', 'l_{22}', .2, 2.5]]
  .map(([par, t, min, max]) => ({ par, min, max, paso: .05, es: `Entrada $${t}$ de $${L}$`, en: `Entry $${t}$ of $${L}$`, dec: 2 }));
const DS = [['a', 'a'], ['b', 'b'], ['d', 'd']].map(([par, t]) => ({ par, min: -3, max: 3, paso: .1, es: `Entrada $${t}$`, en: `Entry $${t}$`, dec: 1 }));
const ELM = { tipo: 'elipse', m: M, ejes: true };

const ponM = (v, m) => { [[v.m11, v.m12], [v.m21, v.m22]] = m; };
const deV = v => [[v.m11, v.m12], [v.m21, v.m22]];
const r4 = x => +x.toFixed(4);
const soltar = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };
// aproximación de rango 1 de A0: σ1 u1 v1ᵀ
const rango1 = (cx, m) => { const S = cx.svd2(m); return [[0, 0], [1, 0], [0, 1], [1, 1]].reduce((r, [i, j]) => { r[i][j] = r4(S.s1 * S.u1[i] * S.v1[j]); return r; }, [[0, 0], [0, 0]]); };
const resta = (p, q) => p.map((f, i) => f.map((x, j) => x - q[i][j]));

export default {
  titulo: { es: 'Descomposiciones de matrices', en: 'Matrix decompositions' },
  fuentes: [
    'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com',
  ],
  pasos: [
    // ── Motivación ──
    { sec: { es: 'Qué problema resuelve', en: 'What problem this solves' },
      vectores: { x: [-3.5, 3.5], y: [-3, 3.4], vec: {}, par: PAR, deslizadores: [...DM, ...DL, ...DS], capas: [{ tipo: 'elipse', m: M }],
        etiqueta: { es: 'Círculo unidad y su imagen bajo la matriz A, una elipse', en: 'Unit circle and its image under the matrix A, an ellipse' } },
      es: `Factorizar un número, $60=2^2\\cdot3\\cdot5$, revela su estructura. Con las matrices pasa lo mismo (MML §4.3–4.5): escribir $${A}$ como producto de matrices **simples** (triangulares, diagonales, ortogonales) abarata las cuentas y hace legible la geometría. Veremos tres: Cholesky, diagonalización y SVD.`,
      en: `Factorizing a number, $60=2^2\\cdot3\\cdot5$, reveals its structure. The same goes for matrices (MML §4.3–4.5): writing $${A}$ as a product of **simple** matrices (triangular, diagonal, orthogonal) makes computations cheap and the geometry readable. We will see three: Cholesky, diagonalization and the SVD.` },
    { es: `Trabajar con $${A}$ tal cual es caro y opaco: $${A}^{100}$ son 99 productos de matrices, y las entradas no dicen en qué direcciones estira $${A}$. La escena sí lo muestra: el círculo unidad (discontinuo) se convierte en una elipse. Las factorizaciones permiten **leer** esa elipse: sus ejes, cuánto mide cada uno y de qué vectores vienen.`,
      en: `Working with $${A}$ as it is is costly and opaque: $${A}^{100}$ takes 99 matrix products, and the entries do not say in which directions $${A}$ stretches. The scene does show it: the unit circle (dashed) becomes an ellipse. Factorizations let us **read** that ellipse: its axes, how long each one is and which vectors they come from.` },

    // ── MML §4.3 Cholesky ──
    { sec: { es: 'Cholesky', en: 'Cholesky' }, capas: [{ tipo: 'elipse', m: ML }],
      es: `**Teorema 4.18 (Cholesky).** Toda matriz $${A}$ simétrica y definida positiva se factoriza como $${A}=${L}${L}^\\top$ (ec. 4.44), con $${L}$ **triangular inferior** de diagonal positiva. $${L}$ es el **factor de Cholesky** y es único. Es el análogo matricial de la raíz cuadrada de un número positivo (MML §4.3).`,
      en: `**Theorem 4.18 (Cholesky).** Every symmetric, positive definite matrix $${A}$ factorizes as $${A}=${L}${L}^\\top$ (eq. 4.44), with $${L}$ **lower triangular** with a positive diagonal. $${L}$ is the **Cholesky factor** and it is unique. It is the matrix analogue of the square root of a positive number (MML §4.3).` },
    { es: `En $2\\times2$: $\\begin{bmatrix}a_{11}&a_{21}\\\\a_{21}&a_{22}\\end{bmatrix}=\\begin{bmatrix}l_{11}&0\\\\l_{21}&l_{22}\\end{bmatrix}\\begin{bmatrix}l_{11}&l_{21}\\\\0&l_{22}\\end{bmatrix}=\\begin{bmatrix}l_{11}^2&l_{11}l_{21}\\\\l_{11}l_{21}&l_{21}^2+l_{22}^2\\end{bmatrix}$. Igualando entradas: $l_{11}=\\sqrt{a_{11}}$, $l_{21}=a_{21}/l_{11}$ y $l_{22}=\\sqrt{a_{22}-l_{21}^2}$.`,
      en: `In $2\\times2$: $\\begin{bmatrix}a_{11}&a_{21}\\\\a_{21}&a_{22}\\end{bmatrix}=\\begin{bmatrix}l_{11}&0\\\\l_{21}&l_{22}\\end{bmatrix}\\begin{bmatrix}l_{11}&l_{21}\\\\0&l_{22}\\end{bmatrix}=\\begin{bmatrix}l_{11}^2&l_{11}l_{21}\\\\l_{11}l_{21}&l_{21}^2+l_{22}^2\\end{bmatrix}$. Matching entries: $l_{11}=\\sqrt{a_{11}}$, $l_{21}=a_{21}/l_{11}$ and $l_{22}=\\sqrt{a_{22}-l_{21}^2}$.` },
    { es: `Ejemplo propio: $\\begin{bmatrix}4&2\\\\2&5\\end{bmatrix}$ da $l_{11}=2$, $l_{21}=1$, $l_{22}=\\sqrt{5-1}=2$. En general, columna a columna (MML Ej. 4.10): $l_{jj}=\\sqrt{a_{jj}-\\sum_{k<j}l_{jk}^2}$ y $l_{ij}=\\frac{1}{l_{jj}}\\big(a_{ij}-\\sum_{k<j}l_{ik}l_{jk}\\big)$ para $i>j$. Que $${A}$ sea definida positiva es justo lo que hace positivas todas las raíces.`,
      en: `An example of our own: $\\begin{bmatrix}4&2\\\\2&5\\end{bmatrix}$ gives $l_{11}=2$, $l_{21}=1$, $l_{22}=\\sqrt{5-1}=2$. In general, column by column (MML Ex. 4.10): $l_{jj}=\\sqrt{a_{jj}-\\sum_{k<j}l_{jk}^2}$ and $l_{ij}=\\frac{1}{l_{jj}}\\big(a_{ij}-\\sum_{k<j}l_{ik}l_{jk}\\big)$ for $i>j$. $${A}$ being positive definite is exactly what keeps every radicand positive.` },
    { es: `**Intuición (MML §6.5.4).** Si $${B('z')}$ recorre el círculo unidad, $${L}${B('z')}$ recorre una elipse: la curva de nivel de una gaussiana de covarianza $${Sg}=${L}${L}^\\top$. Mueve las entradas de $${L}$ y mira cómo cambian la elipse y $${Sg}$, que las lecturas reconstruyen junto con su determinante.`,
      en: `**Intuition (MML §6.5.4).** If $${B('z')}$ runs over the unit circle, $${L}${B('z')}$ runs over an ellipse: the level curve of a Gaussian with covariance $${Sg}=${L}${L}^\\top$. Move the entries of $${L}$ and watch the ellipse and $${Sg}$ change; the readouts rebuild $${Sg}$ and its determinant.`,
      jugar: {
        botones: [
          { label: 'Σ = I', hacer: v => { v.l11 = 1; v.l21 = 0; v.l22 = 1; } },
          { label: { es: 'ejemplo ÷ 4', en: 'example ÷ 4' }, hacer: v => { v.l11 = 1; v.l21 = .5; v.l22 = 1; } },
          { label: { es: 'correlación fuerte', en: 'strong correlation' }, hacer: v => { v.l11 = 1; v.l21 = .9; v.l22 = .45; } },
        ],
        lecturas: (v, cx) => {
          const s11 = v.l11 * v.l11, s12 = v.l11 * v.l21, s22 = v.l21 * v.l21 + v.l22 * v.l22;
          return [
            { expr: `$${Sg}=${L}${L}^\\top$`, valor: `[${cx.fmt(r4(s11))} ${cx.fmt(r4(s12))} ; ${cx.fmt(r4(s12))} ${cx.fmt(r4(s22))}]` },
            { expr: `$\\det(${Sg})=(l_{11}l_{22})^2$`, valor: cx.fmt(r4((v.l11 * v.l22) ** 2)) },
            { expr: { es: `$\\det(${Sg})$ (directo)`, en: `$\\det(${Sg})$ (direct)` }, valor: cx.fmt(r4(s11 * s22 - s12 * s12)) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: `Usos (MML §4.3). **Determinante barato:** $\\det(${A})=\\det(${L})\\det(${L}^\\top)=\\prod_i l_{ii}^2$. **Muestrear gaussianas** (§6.5.4): si $${B('z')}\\sim\\mathcal{N}(${Z},${I})$, entonces $${B('\\mu')}+${L}${B('z')}$ tiene media $${B('\\mu')}$ y covarianza $${L}${L}^\\top=${Sg}$; que $${L}$ sea triangular abarata el cálculo. También sostiene el truco de reparametrización de los autoencoders variacionales.`,
      en: `Uses (MML §4.3). **Cheap determinant:** $\\det(${A})=\\det(${L})\\det(${L}^\\top)=\\prod_i l_{ii}^2$. **Sampling Gaussians** (§6.5.4): if $${B('z')}\\sim\\mathcal{N}(${Z},${I})$, then $${B('\\mu')}+${L}${B('z')}$ has mean $${B('\\mu')}$ and covariance $${L}${L}^\\top=${Sg}$; $${L}$ being triangular makes it cheap. It also underpins the reparametrization trick of variational autoencoders.` },
    { es: `¿Tiene factor de Cholesky $\\begin{bmatrix}1&2\\\\2&1\\end{bmatrix}$?`,
      en: `Does $\\begin{bmatrix}1&2\\\\2&1\\end{bmatrix}$ have a Cholesky factor?`,
      pregunta: {
        opc: [
          { es: 'No: es simétrica, pero no definida positiva', en: 'No: it is symmetric, but not positive definite', ok: 1 },
          { es: 'Sí, porque es simétrica', en: 'Yes, because it is symmetric' },
          { es: 'Sí, porque su diagonal es positiva', en: 'Yes, because its diagonal is positive' },
        ],
        why: {
          es: 'El algoritmo da $l_{11}=1$, $l_{21}=2$ y $l_{22}=\\sqrt{1-4}=\\sqrt{-3}$, que no es real. Con $' + X + '=(1,-1)^\\top$: $' + X + '^\\top' + A + X + '=1-4+1=-2<0$. Sus valores propios son $3$ y $-1$. Simetría y diagonal positiva no bastan.',
          en: 'The algorithm gives $l_{11}=1$, $l_{21}=2$ and $l_{22}=\\sqrt{1-4}=\\sqrt{-3}$, which is not real. With $' + X + '=(1,-1)^\\top$: $' + X + '^\\top' + A + X + '=1-4+1=-2<0$. Its eigenvalues are $3$ and $-1$. Symmetry and a positive diagonal are not enough.',
        },
      } },

    // ── MML §4.4 Diagonalización ──
    { sec: { es: 'Diagonalización', en: 'Diagonalization' },
      capas: [{ tipo: 'elipse', m: MS, ejes: true, v: false }, { tipo: 'propios', m: MS, vecs: false }],
      es: `Las matrices **diagonales** son las más cómodas (MML §4.4). Para $${D}=\\operatorname{diag}(d_1,\\dots,d_n)$: $${D}^k=\\operatorname{diag}(d_1^k,\\dots,d_n^k)$, $\\det(${D})=\\prod_id_i$ y, si todos los $d_i\\neq0$, $${D}^{-1}=\\operatorname{diag}(1/d_1,\\dots,1/d_n)$. La pregunta es cuándo una matriz cualquiera «es» diagonal vista en otra base.`,
      en: `**Diagonal** matrices are the most convenient (MML §4.4). For $${D}=\\operatorname{diag}(d_1,\\dots,d_n)$: $${D}^k=\\operatorname{diag}(d_1^k,\\dots,d_n^k)$, $\\det(${D})=\\prod_id_i$ and, if every $d_i\\neq0$, $${D}^{-1}=\\operatorname{diag}(1/d_1,\\dots,1/d_n)$. The question is when an arbitrary matrix "is" diagonal seen in another basis.` },
    { es: `**Def. 4.19.** $${A}\\in\\mathbb{R}^{n\\times n}$ es **diagonalizable** si es semejante a una diagonal: existe $${P}$ invertible con $${D}=${P}^{-1}${A}${P}$. Si $${P}=[${B('p')}_1,\\dots,${B('p')}_n]$, la igualdad $${A}${P}=${P}${D}$ (ec. 4.50) dice, columna a columna, $${A}${B('p')}_i=\\lambda_i${B('p')}_i$ (ec. 4.51–4.54): las columnas de $${P}$ tienen que ser vectores propios.`,
      en: `**Def. 4.19.** $${A}\\in\\mathbb{R}^{n\\times n}$ is **diagonalizable** if it is similar to a diagonal matrix: there is an invertible $${P}$ with $${D}=${P}^{-1}${A}${P}$. If $${P}=[${B('p')}_1,\\dots,${B('p')}_n]$, the equality $${A}${P}=${P}${D}$ (eq. 4.50) says, column by column, $${A}${B('p')}_i=\\lambda_i${B('p')}_i$ (eq. 4.51–4.54): the columns of $${P}$ must be eigenvectors.` },
    { es: `**Teorema 4.20 (descomposición en valores propios).** $${A}=${P}${D}${P}^{-1}$ (ec. 4.55), con $${D}$ diagonal de valores propios, **si y solo si** los vectores propios de $${A}$ forman una base de $\\mathbb{R}^n$. Así que solo se diagonalizan las no defectuosas. **Teorema 4.21:** toda matriz simétrica se diagonaliza, y además con $${P}$ ortogonal: $${A}=${P}${D}${P}^\\top$.`,
      en: `**Theorem 4.20 (eigendecomposition).** $${A}=${P}${D}${P}^{-1}$ (eq. 4.55), with $${D}$ the diagonal of eigenvalues, **if and only if** the eigenvectors of $${A}$ form a basis of $\\mathbb{R}^n$. So only non-defective matrices diagonalize. **Theorem 4.21:** every symmetric matrix diagonalizes, and with an orthogonal $${P}$: $${A}=${P}${D}${P}^\\top$.` },
    { es: `**Intuición (MML Fig. 4.7).** $${A}${X}=${P}${D}${P}^{-1}${X}$ se lee de derecha a izquierda: $${P}^{-1}$ pasa a coordenadas en la base propia, $${D}$ escala cada eje por $\\lambda_i$ y $${P}$ vuelve a la base canónica. Con $${A}$ simétrica definida positiva, los ejes de la elipse caen sobre las rectas propias y miden $\\lambda_1$ y $\\lambda_2$. Prueba también «indefinida».`,
      en: `**Intuition (MML Fig. 4.7).** $${A}${X}=${P}${D}${P}^{-1}${X}$ reads right to left: $${P}^{-1}$ switches to coordinates in the eigenbasis, $${D}$ scales each axis by $\\lambda_i$ and $${P}$ goes back to the standard basis. With a symmetric positive definite $${A}$, the ellipse axes lie on the eigenlines and measure $\\lambda_1$ and $\\lambda_2$. Try "indefinite" too.`,
      jugar: {
        botones: [
          { label: { es: 'definida positiva', en: 'positive definite' }, hacer: v => { v.a = 2; v.b = .5; v.d = 1; } },
          { label: { es: 'indefinida', en: 'indefinite' }, hacer: v => { v.a = 1; v.b = 1.5; v.d = 1; } },
          { label: { es: 'diagonal', en: 'diagonal' }, hacer: v => { v.a = 2.5; v.b = 0; v.d = 1; } },
        ],
        lecturas: (v, cx) => {
          const m = [[v.a, v.b], [v.b, v.d]], E = cx.eig2(m), S = cx.svd2(m);
          const l = E.reales ? [E.l1, E.l2] : [NaN, NaN], ok = E.reales && Math.abs(Math.abs(l[0]) - S.s1) + Math.abs(Math.abs(l[1]) - S.s2) < 1e-6 || E.reales && Math.abs(Math.abs(l[1]) - S.s1) + Math.abs(Math.abs(l[0]) - S.s2) < 1e-6;
          return [
            { expr: '$\\lambda_1,\\lambda_2$', valor: `${cx.fmt(r4(l[0]))} ; ${cx.fmt(r4(l[1]))}` },
            { expr: { es: 'semiejes $\\sigma_1,\\sigma_2$', en: 'semi-axes $\\sigma_1,\\sigma_2$' }, valor: `${cx.fmt(r4(S.s1))} ; ${cx.fmt(r4(S.s2))}` },
            { expr: { es: '¿$\\sigma_i=|\\lambda_i|$?', en: '$\\sigma_i=|\\lambda_i|$?' }, valor: ok ? '✓' : '✗' },
            { expr: { es: '¿definida positiva?', en: 'positive definite?' }, valor: E.reales && l[1] > 1e-9 ? '✓' : '✗' },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: `Ejemplo propio (de la lección anterior): $${A}=\\begin{bmatrix}3&1\\\\2&2\\end{bmatrix}$ tiene $\\lambda=4,1$, con vectores $(1,1)^\\top$ y $(1,-2)^\\top$. Entonces $${P}=\\begin{bmatrix}1&1\\\\1&-2\\end{bmatrix}$, $${D}=\\begin{bmatrix}4&0\\\\0&1\\end{bmatrix}$, $${P}^{-1}=\\tfrac13\\begin{bmatrix}2&1\\\\1&-1\\end{bmatrix}$, y $${P}${D}${P}^{-1}=${A}$. $${P}$ no es ortogonal: $${A}$ no es simétrica.`,
      en: `An example of our own (from the previous lesson): $${A}=\\begin{bmatrix}3&1\\\\2&2\\end{bmatrix}$ has $\\lambda=4,1$, with vectors $(1,1)^\\top$ and $(1,-2)^\\top$. Then $${P}=\\begin{bmatrix}1&1\\\\1&-2\\end{bmatrix}$, $${D}=\\begin{bmatrix}4&0\\\\0&1\\end{bmatrix}$, $${P}^{-1}=\\tfrac13\\begin{bmatrix}2&1\\\\1&-1\\end{bmatrix}$, and $${P}${D}${P}^{-1}=${A}$. $${P}$ is not orthogonal: $${A}$ is not symmetric.` },
    { es: `**Potencias (ec. 4.62):** $${A}^k=(${P}${D}${P}^{-1})^k=${P}${D}^k${P}^{-1}$, porque los $${P}^{-1}${P}$ intermedios se cancelan. En el ejemplo, $${A}^{10}=${P}\\operatorname{diag}(4^{10},1)${P}^{-1}$: dos potencias de números en vez de nueve productos de matrices. Y $\\det(${A})=\\det(${P})\\det(${D})\\det(${P}^{-1})=\\det(${D})=\\prod_i\\lambda_i$ (ec. 4.63).`,
      en: `**Powers (eq. 4.62):** $${A}^k=(${P}${D}${P}^{-1})^k=${P}${D}^k${P}^{-1}$, because the inner $${P}^{-1}${P}$ cancel. In the example, $${A}^{10}=${P}\\operatorname{diag}(4^{10},1)${P}^{-1}$: two powers of numbers instead of nine matrix products. And $\\det(${A})=\\det(${P})\\det(${D})\\det(${P}^{-1})=\\det(${D})=\\prod_i\\lambda_i$ (eq. 4.63).` },
    { es: `¿Es diagonalizable $\\begin{bmatrix}1&1\\\\0&1\\end{bmatrix}$?`,
      en: `Is $\\begin{bmatrix}1&1\\\\0&1\\end{bmatrix}$ diagonalizable?`,
      pregunta: {
        opc: [
          { es: 'No: $\\lambda=1$ es doble y solo tiene una recta propia', en: 'No: $\\lambda=1$ is double and has a single eigenline', ok: 1 },
          { es: 'Sí: es triangular y su diagonal da los valores propios', en: 'Yes: it is triangular and its diagonal gives the eigenvalues' },
          { es: 'Sí: su determinante es 1, así que es invertible', en: 'Yes: its determinant is 1, so it is invertible' },
        ],
        why: {
          es: 'Los valores propios sí son la diagonal, $1$ y $1$, pero $\\ker\\begin{bmatrix}0&1\\\\0&0\\end{bmatrix}=\\operatorname{span}[' + B('e') + '_1]$: no hay base de vectores propios y falla el Teorema 4.20. Invertible y diagonalizable son cosas distintas (MML §4.7).',
          en: 'The eigenvalues are indeed the diagonal, $1$ and $1$, but $\\ker\\begin{bmatrix}0&1\\\\0&0\\end{bmatrix}=\\operatorname{span}[' + B('e') + '_1]$: there is no eigenbasis and Theorem 4.20 fails. Invertible and diagonalizable are different things (MML §4.7).',
        },
      } },

    // ── MML §4.5 SVD ──
    { sec: { es: 'Descomposición en valores singulares', en: 'Singular value decomposition' }, par: { m11: 1.2, m12: 0, m21: 1.6, m22: 2 }, capas: [ELM],
      es: `**Teorema 4.22 (SVD).** Toda $${A}\\in\\mathbb{R}^{m\\times n}$ de rango $r\\in[0,\\min(m,n)]$ se descompone como $${A}=${U}${Sg}${V}^\\top$ (ec. 4.64), con $${U}\\in\\mathbb{R}^{m\\times m}$ y $${V}\\in\\mathbb{R}^{n\\times n}$ **ortogonales** y $${Sg}\\in\\mathbb{R}^{m\\times n}$ con $\\Sigma_{ii}=\\sigma_i\\ge0$ y $\\Sigma_{ij}=0$ si $i\\neq j$. Existe para **toda** matriz, cuadrada o no.`,
      en: `**Theorem 4.22 (SVD).** Every $${A}\\in\\mathbb{R}^{m\\times n}$ of rank $r\\in[0,\\min(m,n)]$ decomposes as $${A}=${U}${Sg}${V}^\\top$ (eq. 4.64), with $${U}\\in\\mathbb{R}^{m\\times m}$ and $${V}\\in\\mathbb{R}^{n\\times n}$ **orthogonal** and $${Sg}\\in\\mathbb{R}^{m\\times n}$ with $\\Sigma_{ii}=\\sigma_i\\ge0$ and $\\Sigma_{ij}=0$ for $i\\neq j$. It exists for **every** matrix, square or not.` },
    { es: `Los $\\sigma_i$ son los **valores singulares**, ordenados $\\sigma_1\\ge\\sigma_2\\ge\\dots\\ge\\sigma_r>0$ (los demás, cero). Las columnas $${B('u')}_i$ de $${U}$ son los vectores singulares **izquierdos**, y las $${B('v')}_j$ de $${V}$, los **derechos**. $${Sg}$ es única y tiene la forma de $${A}$: si $m>n$, por debajo de la fila $n$ solo hay ceros (MML §4.5).`,
      en: `The $\\sigma_i$ are the **singular values**, ordered $\\sigma_1\\ge\\sigma_2\\ge\\dots\\ge\\sigma_r>0$ (the rest are zero). The columns $${B('u')}_i$ of $${U}$ are the **left**-singular vectors, and the $${B('v')}_j$ of $${V}$ the **right**-singular ones. $${Sg}$ is unique and has the shape of $${A}$: if $m>n$, below row $n$ there are only zeros (MML §4.5).` },
    { es: `**Intuición (MML §4.5.1).** $${A}${X}=${U}${Sg}${V}^\\top${X}$: $${V}^\\top$ cambia de base (gira o refleja), $${Sg}$ escala cada eje por $\\sigma_i$ y $${U}$ vuelve a girar. Por eso el círculo unidad acaba en una elipse de semiejes $\\sigma_1${u1}$ y $\\sigma_2${u2}$, imágenes de $${v1}$ y $${v2}$ (discontinuos, sobre el círculo). Mueve las entradas de $${A}$.`,
      en: `**Intuition (MML §4.5.1).** $${A}${X}=${U}${Sg}${V}^\\top${X}$: $${V}^\\top$ changes basis (rotates or reflects), $${Sg}$ scales each axis by $\\sigma_i$ and $${U}$ rotates again. That is why the unit circle ends up as an ellipse with semi-axes $\\sigma_1${u1}$ and $\\sigma_2${u2}$, the images of $${v1}$ and $${v2}$ (dashed, on the circle). Move the entries of $${A}$.`,
      jugar: {
        botones: [
          { label: { es: 'ejemplo × 0,4', en: 'example × 0.4' }, hacer: v => ponM(v, A0) },
          { label: { es: 'rotación 30°', en: 'rotation 30°' }, hacer: v => ponM(v, [[.87, -.5], [.5, .87]]) },
          { label: { es: 'singular', en: 'singular' }, hacer: v => ponM(v, [[1, 2], [.5, 1]]) },
          { label: { es: 'simétrica', en: 'symmetric' }, hacer: v => ponM(v, [[2, 1], [1, 2]]) },
        ],
        lecturas: (v, cx) => {
          const m = deV(v), S = cx.svd2(m), w = cx.mul(m, S.v1), e = Math.hypot(w[0] - S.s1 * S.u1[0], w[1] - S.s1 * S.u1[1]);
          return [
            { expr: '$\\sigma_1,\\sigma_2$', valor: `${cx.fmt(r4(S.s1))} ; ${cx.fmt(r4(S.s2))}` },
            { expr: `$\\sigma_1\\sigma_2\\;|\\;|\\det(${A})|$`, valor: `${cx.fmt(r4(S.s1 * S.s2))} | ${cx.fmt(r4(Math.abs(cx.detM(m))))}` },
            { expr: `$\\|${A}${v1}-\\sigma_1${u1}\\|$`, valor: cx.fmt(r4(e)) },
            { expr: `$${u1}^\\top${u2}$`, valor: cx.fmt(r4(S.u1[0] * S.u2[0] + S.u1[1] * S.u2[1])) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { sec: { es: 'Cómo se construye', en: 'How it is built' },
      es: `**Construcción (MML §4.5.2).** Por los Teoremas 4.14 y 4.15, $${A}^\\top${A}$ es simétrica semidefinida positiva y $${A}^\\top${A}=${P}${D}${P}^\\top$ (ec. 4.71). Si la SVD existe, $${A}^\\top${A}=${V}${Sg}^\\top${U}^\\top${U}${Sg}${V}^\\top=${V}${Sg}^\\top${Sg}${V}^\\top$ (ec. 4.72–4.73). Así: $${V}^\\top=${P}^\\top$ (ec. 4.74) y $\\sigma_i^2=\\lambda_i$ (ec. 4.75).`,
      en: `**Construction (MML §4.5.2).** By Theorems 4.14 and 4.15, $${A}^\\top${A}$ is symmetric positive semidefinite and $${A}^\\top${A}=${P}${D}${P}^\\top$ (eq. 4.71). If the SVD exists, $${A}^\\top${A}=${V}${Sg}^\\top${U}^\\top${U}${Sg}${V}^\\top=${V}${Sg}^\\top${Sg}${V}^\\top$ (eq. 4.72–4.73). So: $${V}^\\top=${P}^\\top$ (eq. 4.74) and $\\sigma_i^2=\\lambda_i$ (eq. 4.75).` },
    { es: `Del mismo modo, $${A}${A}^\\top=${U}${Sg}${Sg}^\\top${U}^\\top$ da los vectores izquierdos. Para enlazar los dos lados, MML normaliza las imágenes: $${B('u')}_i=\\frac{${A}${B('v')}_i}{\\|${A}${B('v')}_i\\|}=\\frac{1}{\\sigma_i}${A}${B('v')}_i$ (ec. 4.78). Son ortogonales: $(${A}${B('v')}_i)^\\top(${A}${B('v')}_j)=\\lambda_j${B('v')}_i^\\top${B('v')}_j=0$ si $i\\neq j$ (ec. 4.77).`,
      en: `Likewise, $${A}${A}^\\top=${U}${Sg}${Sg}^\\top${U}^\\top$ gives the left vectors. To link both sides, MML normalizes the images: $${B('u')}_i=\\frac{${A}${B('v')}_i}{\\|${A}${B('v')}_i\\|}=\\frac{1}{\\sigma_i}${A}${B('v')}_i$ (eq. 4.78). They are orthogonal: $(${A}${B('v')}_i)^\\top(${A}${B('v')}_j)=\\lambda_j${B('v')}_i^\\top${B('v')}_j=0$ for $i\\neq j$ (eq. 4.77).` },
    { es: `Reordenando sale la **ecuación de valores singulares**, $${A}${B('v')}_i=\\sigma_i${B('u')}_i$ para $i=1,\\dots,r$ (ec. 4.79), y en forma matricial $${A}${V}=${U}${Sg}$ (ec. 4.80). Se parece a $${A}${X}=\\lambda${X}$, pero con **dos** bases, la de partida ($${B('v')}_i$) y la de llegada ($${B('u')}_i$). Por eso existe aunque $${A}$ no sea cuadrada.`,
      en: `Rearranging gives the **singular value equation**, $${A}${B('v')}_i=\\sigma_i${B('u')}_i$ for $i=1,\\dots,r$ (eq. 4.79), and in matrix form $${A}${V}=${U}${Sg}$ (eq. 4.80). It looks like $${A}${X}=\\lambda${X}$, but with **two** bases, the domain one ($${B('v')}_i$) and the codomain one ($${B('u')}_i$). That is why it exists even when $${A}$ is not square.` },
    { es: `Ejemplo propio, $${A}=\\begin{bmatrix}3&0\\\\4&5\\end{bmatrix}$. $${A}^\\top${A}=\\begin{bmatrix}25&20\\\\20&25\\end{bmatrix}$ tiene $\\lambda=45$ en $(1,1)^\\top/\\sqrt2$ y $\\lambda=5$ en $(1,-1)^\\top/\\sqrt2$. Así $\\sigma_1=3\\sqrt5$, $\\sigma_2=\\sqrt5$, $${u1}=\\frac{${A}${v1}}{\\sigma_1}=\\frac{(1,3)^\\top}{\\sqrt{10}}$ y $${u2}=\\frac{(3,-1)^\\top}{\\sqrt{10}}$. Control: $\\sigma_1\\sigma_2=15=|\\det(${A})|$.`,
      en: `An example of our own, $${A}=\\begin{bmatrix}3&0\\\\4&5\\end{bmatrix}$. $${A}^\\top${A}=\\begin{bmatrix}25&20\\\\20&25\\end{bmatrix}$ has $\\lambda=45$ on $(1,1)^\\top/\\sqrt2$ and $\\lambda=5$ on $(1,-1)^\\top/\\sqrt2$. So $\\sigma_1=3\\sqrt5$, $\\sigma_2=\\sqrt5$, $${u1}=\\frac{${A}${v1}}{\\sigma_1}=\\frac{(1,3)^\\top}{\\sqrt{10}}$ and $${u2}=\\frac{(3,-1)^\\top}{\\sqrt{10}}$. Check: $\\sigma_1\\sigma_2=15=|\\det(${A})|$.` },
    { es: `**SVD frente a descomposición en valores propios (MML §4.5.3).** La SVD existe siempre; $${P}${D}${P}^{-1}$, solo para matrices cuadradas no defectuosas. $${U}$ y $${V}$ son ortogonales; $${P}$, en general, no. La SVD usa bases distintas en partida y llegada; la otra, la misma. Los $\\sigma_i$ son $\\ge0$; los $\\lambda_i$ pueden ser negativos o complejos.`,
      en: `**SVD versus eigendecomposition (MML §4.5.3).** The SVD always exists; $${P}${D}${P}^{-1}$ only for square non-defective matrices. $${U}$ and $${V}$ are orthogonal; $${P}$ in general is not. The SVD uses different bases in domain and codomain; the other one, the same basis. The $\\sigma_i$ are $\\ge0$; the $\\lambda_i$ may be negative or complex.` },
    { es: `Para una matriz simétrica semidefinida positiva coinciden: $${U}=${P}=${V}$ y $${D}=${Sg}$ (ec. 4.70). Para una simétrica cualquiera, $\\sigma_i=|\\lambda_i|$ y el signo pasa a los vectores; lo viste en el paso de la diagonalización con el botón «indefinida».`,
      en: `For a symmetric positive semidefinite matrix they coincide: $${U}=${P}=${V}$ and $${D}=${Sg}$ (eq. 4.70). For an arbitrary symmetric one, $\\sigma_i=|\\lambda_i|$ and the sign moves into the vectors; you saw it in the diagonalization step with the "indefinite" button.` },
    { es: `¿Qué valores singulares tiene una rotación $${B('R')}_\\theta$?`,
      en: `What singular values does a rotation $${B('R')}_\\theta$ have?`,
      pregunta: {
        opc: [
          { es: '$\\sigma_1=\\sigma_2=1$', en: '$\\sigma_1=\\sigma_2=1$', ok: 1 },
          { es: '$\\cos\\theta\\pm i\\sin\\theta$', en: '$\\cos\\theta\\pm i\\sin\\theta$' },
          { es: 'Ninguno: no tiene rectas propias', en: 'None: it has no eigenlines' },
        ],
        why: {
          es: '$' + B('R') + '_\\theta^\\top' + B('R') + '_\\theta=' + I + '$, así que los valores propios de $' + A + '^\\top' + A + '$ son $1$ y $\\sigma_i=\\sqrt1=1$: el círculo va a otro círculo. $\\cos\\theta\\pm i\\sin\\theta$ son sus valores **propios**, no singulares. La SVD existe siempre: $' + U + '=' + B('R') + '_\\theta$, $' + Sg + '=' + V + '=' + I + '$.',
          en: '$' + B('R') + '_\\theta^\\top' + B('R') + '_\\theta=' + I + '$, so the eigenvalues of $' + A + '^\\top' + A + '$ are $1$ and $\\sigma_i=\\sqrt1=1$: the circle goes to another circle. $\\cos\\theta\\pm i\\sin\\theta$ are its **eigen**values, not singular values. The SVD always exists: $' + U + '=' + B('R') + '_\\theta$, $' + Sg + '=' + V + '=' + I + '$.',
        },
      } },
    { deriva: {
        pregunta: { es: '¿Qué valores singulares tiene $\\operatorname{diag}(2,-3)$?', en: 'What singular values does $\\operatorname{diag}(2,-3)$ have?' },
        opciones: [{ es: '$3$ y $2$', en: '$3$ and $2$' }, { es: '$2$ y $-3$', en: '$2$ and $-3$' }, { es: '$-3$ y $2$', en: '$-3$ and $2$' }], correcta: 0,
        razones: [
          { es: 'Son los valores absolutos de la diagonal, de mayor a menor; el signo lo absorbe $' + U + '$ o $' + V + '$', en: 'They are the absolute values of the diagonal, largest first; the sign is absorbed by $' + U + '$ or $' + V + '$' },
          { es: 'En una matriz diagonal, los valores singulares son la diagonal tal cual', en: 'For a diagonal matrix, the singular values are the diagonal as it is' },
          { es: 'Se ordenan de menor a mayor', en: 'They are sorted from smallest to largest' },
        ], razonCorrecta: 0,
        pistas: [{ es: 'Los valores singulares nunca son negativos (Teorema 4.22).', en: 'Singular values are never negative (Theorem 4.22).' }],
        revela: { es: '$' + Sg + '=\\operatorname{diag}(3,2)$ con $' + v1 + '=' + B('e') + '_2$, $' + u1 + '=-' + B('e') + '_2$, $' + v2 + '=' + u2 + '=' + B('e') + '_1$: $' + A + B('e') + '_2=(0,-3)^\\top=3(-' + B('e') + '_2)$ y $' + A + B('e') + '_1=2' + B('e') + '_1$.', en: '$' + Sg + '=\\operatorname{diag}(3,2)$ with $' + v1 + '=' + B('e') + '_2$, $' + u1 + '=-' + B('e') + '_2$, $' + v2 + '=' + u2 + '=' + B('e') + '_1$: $' + A + B('e') + '_2=(0,-3)^\\top=3(-' + B('e') + '_2)$ and $' + A + B('e') + '_1=2' + B('e') + '_1$.' },
      },
      par: { m11: 2, m12: 0, m21: 0, m22: -3 },
      es: `$\\sigma_1=3$ y $\\sigma_2=2$. En la escena, el eje mayor de la elipse está sobre $x_2$, la dirección en que $${A}$ estira 3 veces, aunque lo haga invirtiendo el sentido. Los valores singulares miden cuánto se estira; la orientación queda en $${U}$ y $${V}$.`,
      en: `$\\sigma_1=3$ and $\\sigma_2=2$. In the scene, the major axis of the ellipse lies on $x_2$, the direction that $${A}$ stretches 3 times, even though it flips its sense. Singular values measure how much it stretches; orientation lives in $${U}$ and $${V}$.` },

    // ── MML §4.6 Aproximación ──
    { sec: { es: 'Aproximación de rango bajo', en: 'Low-rank approximation' }, par: { m11: 1.2, m12: 0, m21: 1.6, m22: 2 },
      es: `**MML §4.6.** Con $${A}_i:=${B('u')}_i${B('v')}_i^\\top$ (ec. 4.90), matrices de rango 1 (productos exteriores), la SVD es una suma: $${A}=\\sum_{i=1}^r\\sigma_i${B('u')}_i${B('v')}_i^\\top=\\sum_{i=1}^r\\sigma_i${A}_i$ (ec. 4.91). Cortarla en $k<r$ da $${Ah}(k):=\\sum_{i=1}^k\\sigma_i${B('u')}_i${B('v')}_i^\\top$ (ec. 4.92), con $\\operatorname{rk}(${Ah}(k))=k$.`,
      en: `**MML §4.6.** With $${A}_i:=${B('u')}_i${B('v')}_i^\\top$ (eq. 4.90), rank-1 matrices (outer products), the SVD is a sum: $${A}=\\sum_{i=1}^r\\sigma_i${B('u')}_i${B('v')}_i^\\top=\\sum_{i=1}^r\\sigma_i${A}_i$ (eq. 4.91). Truncating it at $k<r$ gives $${Ah}(k):=\\sum_{i=1}^k\\sigma_i${B('u')}_i${B('v')}_i^\\top$ (eq. 4.92), with $\\operatorname{rk}(${Ah}(k))=k$.` },
    { es: `Por qué comprime: $${A}\\in\\mathbb{R}^{m\\times n}$ tiene $mn$ números, y $${Ah}(k)$ se guarda con $k$ vectores $${B('u')}_i$, $k$ vectores $${B('v')}_i$ y $k$ números $\\sigma_i$: $k(m+n+1)$ en total. Ejemplo propio: una imagen $1000\\times1000$ con $k=20$ ocupa $20\\cdot2001=40\\,020$ números, un $4\\,\\%$ del original. Cuánto se pierde lo dice el Teorema 4.25.`,
      en: `Why it compresses: $${A}\\in\\mathbb{R}^{m\\times n}$ holds $mn$ numbers, and $${Ah}(k)$ is stored with $k$ vectors $${B('u')}_i$, $k$ vectors $${B('v')}_i$ and $k$ numbers $\\sigma_i$: $k(m+n+1)$ in total. An example of our own: a $1000\\times1000$ image with $k=20$ takes $20\\cdot2001=40\\,020$ numbers, $4\\,\\%$ of the original. How much is lost is what Theorem 4.25 says.` },
    { vectores: { x: [-3.5, 3.5], y: [-3, 3.4], vec: { x: [1.5, 0] }, arrastrar: ['x'], paso: .25,
        capas: [{ tipo: 'elipse', m: A0, ejes: true, v: false }, { tipo: 'flecha', a: 'x' }, { tipo: 'imagen', m: A0, a: 'x' }],
        etiqueta: { es: 'Vector x arrastrable, su imagen A x y la elipse de A', en: 'Draggable vector x, its image A x and the ellipse of A' } },
      es: `**Def. 4.23 (norma espectral).** $\\|${A}\\|_2:=\\max_{${X}\\neq${Z}}\\frac{\\|${A}${X}\\|_2}{\\|${X}\\|_2}$ (ec. 4.93): lo máximo que $${A}$ puede alargar un vector. **Teorema 4.24:** $\\|${A}\\|_2=\\sigma_1$. Arrastra $${X}$ y busca el mayor cociente: lo alcanzas en la dirección de $${v1}$, cuya imagen es el eje mayor.`,
      en: `**Def. 4.23 (spectral norm).** $\\|${A}\\|_2:=\\max_{${X}\\neq${Z}}\\frac{\\|${A}${X}\\|_2}{\\|${X}\\|_2}$ (eq. 4.93): the most $${A}$ can lengthen a vector. **Theorem 4.24:** $\\|${A}\\|_2=\\sigma_1$. Drag $${X}$ and look for the largest ratio: you reach it along $${v1}$, whose image is the major axis.`,
      jugar: {
        botones: [
          { label: 'x = e₁', hacer: v => { v.vec.x = [1.5, 0]; } },
          { label: 'x ∥ v₁', hacer: v => { v.vec.x = [1, 1]; } },
          { label: 'x ∥ v₂', hacer: v => { v.vec.x = [1, -1]; } },
        ],
        lecturas: (v, cx) => {
          const x = v.vec.x, n = Math.hypot(x[0], x[1]), w = cx.mul(A0, x), q = n > 1e-9 ? Math.hypot(w[0], w[1]) / n : NaN, s1 = cx.svd2(A0).s1;
          return [
            { expr: `$\\|${A}${X}\\|_2/\\|${X}\\|_2$`, valor: Number.isFinite(q) ? cx.fmt(r4(q)) : '—' },
            { expr: '$\\sigma_1$', valor: cx.fmt(r4(s1)) },
            { expr: { es: '¿máximo?', en: 'maximum?' }, valor: q > s1 - 1e-6 ? '✓' : '✗', malo: !(q > s1 - 1e-6) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: `**Teorema 4.25 (Eckart-Young).** Sea $${A}\\in\\mathbb{R}^{m\\times n}$ de rango $r$, y $k\\le r$. Entre todas las $${Bm}$ de rango $k$, $${Ah}(k)=\\arg\\min_{\\operatorname{rk}(${Bm})=k}\\|${A}-${Bm}\\|_2$ (ec. 4.94), con error $\\|${A}-${Ah}(k)\\|_2=\\sigma_{k+1}$ (ec. 4.95). Ninguna otra aproximación de rango $k$ es mejor en norma espectral.`,
      en: `**Theorem 4.25 (Eckart-Young).** Let $${A}\\in\\mathbb{R}^{m\\times n}$ have rank $r$, and $k\\le r$. Among all $${Bm}$ of rank $k$, $${Ah}(k)=\\arg\\min_{\\operatorname{rk}(${Bm})=k}\\|${A}-${Bm}\\|_2$ (eq. 4.94), with error $\\|${A}-${Ah}(k)\\|_2=\\sigma_{k+1}$ (eq. 4.95). No other rank-$k$ approximation does better in spectral norm.` },
    { vectores: { x: [-3.5, 3.5], y: [-3, 3.4], vec: {}, par: { m11: 1.2, m12: 0, m21: 1.6, m22: 2 }, capas: [ELM],
        etiqueta: { es: 'Elipse de la matriz y de sus aproximaciones de rango 1', en: 'Ellipse of the matrix and of its rank-1 approximations' } },
      es: `Por qué (ec. 4.96): $${A}-${Ah}(k)=\\sum_{i=k+1}^r\\sigma_i${B('u')}_i${B('v')}_i^\\top$ es otra SVD, cuyo mayor valor singular es $\\sigma_{k+1}$. En $2\\times2$, $${Ah}(1)=\\sigma_1${u1}${v1}^\\top$ aplasta la elipse sobre su eje mayor. Compara su error con $\\sigma_2$ y con otra matriz de rango 1 cualquiera.`,
      en: `Why (eq. 4.96): $${A}-${Ah}(k)=\\sum_{i=k+1}^r\\sigma_i${B('u')}_i${B('v')}_i^\\top$ is another SVD, whose largest singular value is $\\sigma_{k+1}$. In $2\\times2$, $${Ah}(1)=\\sigma_1${u1}${v1}^\\top$ squashes the ellipse onto its major axis. Compare its error with $\\sigma_2$ and with some other rank-1 matrix.`,
      jugar: {
        botones: [
          { label: 'A', hacer: v => ponM(v, A0) },
          { label: 'Â(1)', hacer: (v, cx) => ponM(v, rango1(cx, A0)) },
          { label: { es: 'otra de rango 1', en: 'another rank 1' }, hacer: v => ponM(v, [[1.2, 0], [1.6, 0]]) },
        ],
        lecturas: (v, cx) => {
          const m = deV(v), S = cx.svd2(m), rk = S.s1 < 1e-9 ? 0 : S.s2 < 1e-6 * S.s1 ? 1 : 2;
          return [
            { expr: { es: 'rango de la matriz mostrada', en: 'rank of the matrix shown' }, valor: String(rk) },
            { expr: `$\\|${A}-${Bm}\\|_2$`, valor: cx.fmt(r4(cx.svd2(resta(A0, m)).s1)) },
            { expr: `$\\sigma_2(${A})$`, valor: cx.fmt(r4(cx.svd2(A0).s2)) },
          ];
        },
        arrastrables: true, soltar,
      } },

    // ── MML §4.7 Filogenia ──
    { sec: { es: 'Mapa de las matrices', en: 'Map of matrices' },
      es: `**Filogenia (MML §4.7).** Toda matriz real, cuadrada o no, tiene SVD. Entre las cuadradas, el determinante separa las invertibles; las que tienen $n$ vectores propios independientes son no defectuosas y admiten $${P}${D}${P}^{-1}$. No es lo mismo: una rotación es invertible, pero no diagonalizable en $\\mathbb{R}$.`,
      en: `**Phylogeny (MML §4.7).** Every real matrix, square or not, has an SVD. Among square ones, the determinant singles out the invertible ones; those with $n$ independent eigenvectors are non-defective and admit $${P}${D}${P}^{-1}$. These are not the same: a rotation is invertible, but not diagonalizable over $\\mathbb{R}$.` },
    { es: `Dentro de las no defectuosas, MML sitúa las **normales** ($${A}^\\top${A}=${A}${A}^\\top$), que incluyen las **ortogonales** ($${A}^\\top${A}=${A}${A}^\\top=${I}$) y las **simétricas** (valores propios reales). Entre las simétricas, las **definidas positivas** (Cholesky único, $\\lambda_i>0$, siempre invertibles) y las **diagonales**, con la identidad como caso particular.`,
      en: `Within non-defective matrices, MML places the **normal** ones ($${A}^\\top${A}=${A}${A}^\\top$), which include the **orthogonal** ones ($${A}^\\top${A}=${A}${A}^\\top=${I}$) and the **symmetric** ones (real eigenvalues). Among symmetric matrices, the **positive definite** ones (unique Cholesky, $\\lambda_i>0$, always invertible) and the **diagonal** ones, with the identity as a special case.` },

    // ── Código y ML ──
    { sec: { es: 'En código', en: 'In code' },
      code: `import numpy as np
A = np.array([[4., 2.], [2., 5.]])
L = np.linalg.cholesky(A)                    # triangular inferior
print(L, np.allclose(L @ L.T, A))            # [[2,0],[1,2]] True
B = np.array([[3., 1.], [2., 2.]])
lam, P = np.linalg.eig(B)
print(np.allclose(P @ np.diag(lam) @ np.linalg.inv(P), B))   # True
C = np.array([[3., 0.], [4., 5.]])
U, s, Vt = np.linalg.svd(C)                  # s: σ de mayor a menor
print(s, s**2)                               # [6.708 2.236] [45. 5.]
k = 1
Ck = U[:, :k] @ np.diag(s[:k]) @ Vt[:k]      # aproximación de rango k
print(np.linalg.norm(C - Ck, 2), s[k])       # ambos ≈ 2.236 (Eckart-Young)`, line: null,
      es: `Ejemplo mínimo con los tres ejemplos de la guía. \`np.linalg.svd\` devuelve $${V}^\\top$ (no $${V}$) y los $\\sigma_i$ ya ordenados; \`norm(·, 2)\` es la norma espectral. La última línea comprueba Eckart-Young: el error de rango 1 es exactamente $\\sigma_2=\\sqrt5$.`,
      en: `A minimal example with the three examples of the guide. \`np.linalg.svd\` returns $${V}^\\top$ (not $${V}$) and the $\\sigma_i$ already sorted; \`norm(·, 2)\` is the spectral norm. The last line checks Eckart-Young: the rank-1 error is exactly $\\sigma_2=\\sqrt5$.` },
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' }, code: '', line: null,
      es: `**Dónde aparece en ML.** PCA (MML cap. 10) obtiene las direcciones principales con los vectores propios de la covarianza o con la SVD de los datos centrados, y su reconstrucción es una aproximación de rango bajo de Eckart-Young (§10.4). Cholesky muestrea gaussianas (§6.5.4). Y en regresión lineal (§9.2), $(${B('\\Phi')}^\\top${B('\\Phi')})^{-1}${B('\\Phi')}^\\top$ se evalúa con estas factorizaciones, sin invertir.`,
      en: `**Where it shows up in ML.** PCA (MML ch. 10) gets the principal directions from the eigenvectors of the covariance or, equivalently, from the SVD of the centred data, and its reconstruction is an Eckart-Young low-rank approximation (§10.4). Cholesky samples Gaussians (§6.5.4). And in linear regression (§9.2), $(${B('\\Phi')}^\\top${B('\\Phi')})^{-1}${B('\\Phi')}^\\top$ is evaluated with these factorizations, without inverting.` },
    { es: `**Resumen.** Cholesky: $${A}=${L}${L}^\\top$ para simétricas definidas positivas. Diagonalización: $${A}=${P}${D}${P}^{-1}$ si hay base de vectores propios ($${P}$ ortogonal si es simétrica). SVD: $${A}=${U}${Sg}${V}^\\top$ para **toda** matriz, con $\\sigma_i^2$ los valores propios de $${A}^\\top${A}$. Truncarla da la mejor aproximación de rango $k$, con error $\\sigma_{k+1}$.`,
      en: `**Summary.** Cholesky: $${A}=${L}${L}^\\top$ for symmetric positive definite matrices. Diagonalization: $${A}=${P}${D}${P}^{-1}$ if there is an eigenbasis ($${P}$ orthogonal when symmetric). SVD: $${A}=${U}${Sg}${V}^\\top$ for **every** matrix, with $\\sigma_i^2$ the eigenvalues of $${A}^\\top${A}$. Truncating it gives the best rank-$k$ approximation, with error $\\sigma_{k+1}$.` },
  ],
};
