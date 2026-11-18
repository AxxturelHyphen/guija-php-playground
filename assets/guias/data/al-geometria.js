// Guía «Normas, productos internos y ortogonalidad» (Álgebra lineal, lección 5). Sigue MML §3.1–3.7: normas, productos
// internos, matrices simétricas definidas positivas, longitudes y distancias, ángulos y ortogonalidad, matrices ortogonales,
// bases ortonormales, complemento ortogonal y producto interno de funciones. Escena `vectores` (capas `bola` y `proyeccion`;
// formato en la cabecera de assets/guias/vectores.js) y `funcion` para §3.7. Formato de los pasos en data/punteros.js.
// Ejemplos propios (no los del libro); las fórmulas se citan por su número en MML. \bm = \boldsymbol en KaTeX.
const R = String.raw;
const B = x => R`\bm{${x}}`;
const X = B('x'), Y = B('y'), Z = B('z'), A = B('A'), b = B('b'), w = B('w'), I = B('I'), Zr = B('0');
const p2 = (cx, p) => `(${cx.fmt(p[0])} ; ${cx.fmt(p[1])})`;
const soltar = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };
const FX = { tipo: 'flecha', a: 'x' }, FY = { tipo: 'flecha', a: 'y' };
const MML = 'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com';

// ── Escena 1: bola unidad de ℓp ──
const BOLA = { tipo: 'bola', p: 'p' };
const E_NORMA = {
  x: [-2.2, 2.2], y: [-1.6, 1.7], vec: { x: [1.2, 0.8] }, arrastrar: ['x'], paso: 0.1, par: { p: 2 },
  deslizadores: [{ par: 'p', min: 0.5, max: 8, paso: 0.1, es: 'Exponente $p$', en: 'Exponent $p$', dec: 1 }],
  capas: [BOLA, FX], etiqueta: { es: 'Bola unidad de la norma p y un vector x arrastrable', en: 'Unit ball of the p-norm and a draggable vector x' },
};
// ── Escena 2: norma inducida por xᵀAy (elipse) ──
const BOLA_A = { tipo: 'bola', p: 2, A: [['a', 'c'], ['c', 'd']] };
const E_A = {
  x: [-2.2, 2.2], y: [-1.7, 1.7], vec: { x: [1, 0.6] }, arrastrar: ['x'], paso: 0.1, par: { a: 2, c: 1, d: 1 },
  deslizadores: [
    { par: 'a', min: 0.2, max: 4, paso: 0.05, es: '$a_{11}$', en: '$a_{11}$', dec: 2 },
    { par: 'c', min: -2, max: 2, paso: 0.05, es: '$a_{12}=a_{21}$', en: '$a_{12}=a_{21}$', dec: 2 },
    { par: 'd', min: 0.2, max: 4, paso: 0.05, es: '$a_{22}$', en: '$a_{22}$', dec: 2 },
  ],
  capas: [BOLA_A, FX], etiqueta: { es: 'Conjunto xᵀAx = 1 para una matriz A ajustable', en: 'Set xᵀAx = 1 for an adjustable matrix A' },
};
// ── Escena 3: ángulos y ortogonalidad con ⟨x,y⟩ = xᵀ diag(a,d) y ──
const PROY_YX = { tipo: 'proyeccion', x: 'y', sobre: 'x', A: [['a', 0], [0, 'd']], nombre: R`$\pi(${Y})$`, recta: false };
const E_ANG = {
  x: [-2.6, 2.6], y: [-0.8, 2.6], vec: { x: [1, 2], y: [-2, 1] }, arrastrar: ['x', 'y'], paso: 0.25, par: { a: 1, d: 1 },
  capas: [FX, FY, PROY_YX], etiqueta: { es: 'Dos vectores arrastrables y la proyección de y sobre x', en: 'Two draggable vectors and the projection of y onto x' },
};
// ── Escena 4: matriz ortogonal frente a no ortogonal ──
const MAT = { tipo: 'rejilla', m: [['m11', 'm12'], ['m21', 'm22']] };
const E_ORT = {
  x: [-2.4, 2.4], y: [-1.9, 1.9], vec: { x: [1.5, 0.5] }, arrastrar: ['x'], paso: 0.25, par: { m11: 1, m12: 0, m21: 0, m22: 1 },
  capas: [MAT, FX], etiqueta: { es: 'Rejilla transformada por A y un vector x', en: 'Grid transformed by A and a vector x' },
};
// ── Escena 5: base ortonormal; coordenadas = productos escalares ──
const E_ONB = {
  x: [-1.4, 2.6], y: [-0.6, 2.2], vec: { x: [2, 1], b1: [0.6, 0.8], b2: [-0.8, 0.6] }, arrastrar: ['x'], paso: 0.1,
  capas: [{ tipo: 'flecha', a: 'b1' }, { tipo: 'flecha', a: 'b2' }, FX,
    { tipo: 'proyeccion', x: 'x', sobre: 'b1', nombre: R`$\lambda_1${B('b')}_1$` }, { tipo: 'proyeccion', x: 'x', sobre: 'b2', nombre: R`$\lambda_2${B('b')}_2$` }],
  etiqueta: { es: 'Base ortonormal b1, b2 y las proyecciones de x sobre cada vector', en: 'Orthonormal basis b1, b2 and the projections of x onto each vector' },
};
// ── Escena 6: complemento ortogonal en ℝ² ──
const E_COMP = {
  x: [-2.6, 2.6], y: [-1.2, 2.6], vec: { x: [0.5, 2.2], w: [0.6, 1.2] }, arrastrar: ['x'], paso: 0.1,
  capas: [{ tipo: 'flecha', a: 'w' }, FX,
    { tipo: 'proyeccion', x: 'x', sobre: [[-2, 1]], nombre: R`$\pi_U(${X})$` }, { tipo: 'proyeccion', x: 'x', sobre: 'w', nombre: R`$\pi_{U^\perp}(${X})$`, recta: false }],
  etiqueta: { es: 'Recta U, su complemento generado por w y la descomposición de x', en: 'Line U, its complement spanned by w and the decomposition of x' },
};

export default {
  titulo: { es: 'Normas, productos internos y ortogonalidad', en: 'Norms, inner products and orthogonality' },
  fuentes: [MML],
  pasos: [
    // ── Motivación ──
    { sec: { es: 'Qué problema resuelve', en: 'What problem this solves' }, vectores: E_NORMA,
      es: R`En el cap. 2 los vectores se suman y se escalan, pero no se puede decir cuánto mide uno ni qué ángulo forman dos. En ML hace falta medir: el error de un modelo, la distancia entre dos datos, el tamaño de los parámetros. El cap. 3 añade esa **geometría** con dos herramientas: la **norma** (longitud) y el **producto interno** (longitud, ángulo y ortogonalidad) (MML §3).`,
      en: R`In ch. 2 vectors can be added and scaled, but nothing says how long one is or what angle two make. ML needs to measure: a model's error, the distance between two data points, the size of the parameters. Ch. 3 adds that **geometry** with two tools: the **norm** (length) and the **inner product** (length, angle and orthogonality) (MML §3).` },
    { es: R`La solución ingenua, «la longitud es siempre $\sqrt{x_1^2+\dots+x_n^2}$», se queda corta. Hay otras longitudes útiles: sumar valores absolutos favorece soluciones con muchos ceros. Y «perpendicular» depende de cómo midas: con otra regla de medir, dos flechas que se ven en ángulo recto dejan de serlo. Por eso se fijan **axiomas** en lugar de una fórmula.`,
      en: R`The naive solution, "length is always $\sqrt{x_1^2+\dots+x_n^2}$", falls short. Other lengths are useful: adding absolute values favours solutions with many zeros. And "perpendicular" depends on how you measure: with another ruler, two arrows that look at right angles stop being so. That is why we fix **axioms** instead of one formula.` },

    // ── MML §3.1 Normas ──
    { sec: { es: 'Normas', en: 'Norms' },
      es: R`**Def. 3.1 (norma, MML §3.1).** Una norma en $V$ es una función $\|\cdot\|:V\to\mathbb{R}$ (ec. 3.1) tal que para todo $\lambda\in\mathbb{R}$ y $${X},${Y}\in V$: **homogénea absoluta**: $\|\lambda${X}\|=|\lambda|\,\|${X}\|$; **desigualdad triangular**: $\|${X}+${Y}\|\le\|${X}\|+\|${Y}\|$; **definida positiva**: $\|${X}\|\ge0$ y $\|${X}\|=0\iff${X}=${Zr}$.`,
      en: R`**Def. 3.1 (norm, MML §3.1).** A norm on $V$ is a function $\|\cdot\|:V\to\mathbb{R}$ (eq. 3.1) such that for all $\lambda\in\mathbb{R}$ and $${X},${Y}\in V$: **absolutely homogeneous**: $\|\lambda${X}\|=|\lambda|\,\|${X}\|$; **triangle inequality**: $\|${X}+${Y}\|\le\|${X}\|+\|${Y}\|$; **positive definite**: $\|${X}\|\ge0$ and $\|${X}\|=0\iff${X}=${Zr}$.` },
    { es: R`Dos normas de MML en $\mathbb{R}^n$. **Manhattan** o $\ell_1$ (ec. 3.3): $\|${X}\|_1:=\sum_{i=1}^n|x_i|$. **Euclídea** o $\ell_2$ (ec. 3.4): $\|${X}\|_2:=\sqrt{\sum_{i=1}^n x_i^2}=\sqrt{${X}^\top${X}}$, la norma por defecto del libro. Fuera de MML, generalizan a $\|${X}\|_p=(\sum_i|x_i|^p)^{1/p}$ con $p\ge1$, y $\|${X}\|_\infty=\max_i|x_i|$ es su límite.`,
      en: R`Two MML norms on $\mathbb{R}^n$. **Manhattan** or $\ell_1$ (eq. 3.3): $\|${X}\|_1:=\sum_{i=1}^n|x_i|$. **Euclidean** or $\ell_2$ (eq. 3.4): $\|${X}\|_2:=\sqrt{\sum_{i=1}^n x_i^2}=\sqrt{${X}^\top${X}}$, the book's default norm. Outside MML, they generalise to $\|${X}\|_p=(\sum_i|x_i|^p)^{1/p}$ with $p\ge1$, and $\|${X}\|_\infty=\max_i|x_i|$ is its limit.` },
    { leyenda: ['compara'],
      es: R`El contorno es la **bola unidad** $\{${X}:\|${X}\|_p=1\}$. Mueve $p$: con $p=1$ es un rombo, con $p=2$ un círculo y con $p$ grande se acerca al cuadrado de $\ell_\infty$. Arrastra $${X}$: el mismo vector tiene longitudes distintas según la norma, y siempre $\|${X}\|_\infty\le\|${X}\|_2\le\|${X}\|_1$.`,
      en: R`The outline is the **unit ball** $\{${X}:\|${X}\|_p=1\}$. Move $p$: with $p=1$ it is a diamond, with $p=2$ a circle and with large $p$ it approaches the square of $\ell_\infty$. Drag $${X}$: the same vector has different lengths depending on the norm, and always $\|${X}\|_\infty\le\|${X}\|_2\le\|${X}\|_1$.`,
      jugar: {
        botones: [
          { label: 'p = 1', hacer: v => { v.p = 1; } },
          { label: 'p = 2', hacer: v => { v.p = 2; } },
          { label: 'p = 8', hacer: v => { v.p = 8; } },
          { label: 'p = 0,5', hacer: v => { v.p = 0.5; } },
        ],
        lecturas: (v, cx) => [
          { expr: R`$\|${X}\|_1$`, valor: cx.fmt(+cx.norma(v.vec.x, 1).toFixed(3)) },
          { expr: R`$\|${X}\|_2$`, valor: cx.fmt(+cx.norma(v.vec.x, 2).toFixed(3)) },
          { expr: R`$\|${X}\|_\infty$`, valor: cx.fmt(+cx.norma(v.vec.x, 'inf').toFixed(3)) },
          { expr: R`$\|${X}\|_p$`, valor: cx.fmt(+cx.norma(v.vec.x, v.p).toFixed(3)) },
          { expr: { es: '¿es norma? (p ≥ 1)', en: 'is it a norm? (p ≥ 1)' }, valor: v.p >= 1 ? '✓' : '✗', malo: v.p < 1 },
        ],
        arrastrables: true, soltar,
      } },
    { es: R`Con $p=0{,}5$ la «bola» deja de ser convexa (se hunde hacia dentro). ¿Qué axioma de la Def. 3.1 falla?`,
      en: R`With $p=0.5$ the "ball" is no longer convex (it caves inwards). Which axiom of Def. 3.1 fails?`,
      pregunta: {
        opc: [
          { es: 'La desigualdad triangular', en: 'The triangle inequality', ok: 1 },
          { es: 'La homogeneidad absoluta', en: 'Absolute homogeneity' },
          { es: 'La definida positiva', en: 'Positive definiteness' },
        ],
        why: {
          es: R`Con $${X}=(1,0)$ y $${Y}=(0,1)$: $\|${X}\|_{1/2}=\|${Y}\|_{1/2}=1$, pero $\|${X}+${Y}\|_{1/2}=(1+1)^2=4>2$. La homogeneidad sí se cumple, porque $(\sum|\lambda x_i|^p)^{1/p}=|\lambda|(\sum|x_i|^p)^{1/p}$, y solo $${Zr}$ mide $0$. Que la bola unidad sea convexa equivale a la desigualdad triangular.`,
          en: R`With $${X}=(1,0)$ and $${Y}=(0,1)$: $\|${X}\|_{1/2}=\|${Y}\|_{1/2}=1$, but $\|${X}+${Y}\|_{1/2}=(1+1)^2=4>2$. Homogeneity does hold, because $(\sum|\lambda x_i|^p)^{1/p}=|\lambda|(\sum|x_i|^p)^{1/p}$, and only $${Zr}$ has length $0$. A convex unit ball is equivalent to the triangle inequality.`,
        },
      } },

    // ── MML §3.2 Productos internos ──
    { sec: { es: 'Producto interno', en: 'Inner product' },
      es: R`Caso conocido: el **producto escalar** (MML §3.2.1, ec. 3.5): $${X}^\top${Y}=\sum_{i=1}^n x_iy_i$. Se generaliza con **aplicaciones bilineales** $\Omega:V\times V\to\mathbb{R}$, lineales en cada argumento (ec. 3.6–3.7): $\Omega(\lambda${X}+\psi${Y},${Z})=\lambda\Omega(${X},${Z})+\psi\Omega(${Y},${Z})$ y $\Omega(${X},\lambda${Y}+\psi${Z})=\lambda\Omega(${X},${Y})+\psi\Omega(${X},${Z})$.`,
      en: R`The familiar case is the **dot product** (MML §3.2.1, eq. 3.5): $${X}^\top${Y}=\sum_{i=1}^n x_iy_i$. It generalises via **bilinear mappings** $\Omega:V\times V\to\mathbb{R}$, linear in each argument (eq. 3.6–3.7): $\Omega(\lambda${X}+\psi${Y},${Z})=\lambda\Omega(${X},${Z})+\psi\Omega(${Y},${Z})$ and $\Omega(${X},\lambda${Y}+\psi${Z})=\lambda\Omega(${X},${Y})+\psi\Omega(${X},${Z})$.` },
    { es: R`**Def. 3.2.** $\Omega$ es **simétrica** si $\Omega(${X},${Y})=\Omega(${Y},${X})$, y **definida positiva** (DP) si $\forall${X}\neq${Zr}:\Omega(${X},${X})>0$, $\Omega(${Zr},${Zr})=0$ (ec. 3.8). **Def. 3.3.** Si $\Omega$ es simétrica y DP, es un **producto interno** $\langle${X},${Y}\rangle$, y $(V,\langle\cdot,\cdot\rangle)$ un **espacio con producto interno** (**euclídeo** si es el escalar).`,
      en: R`**Def. 3.2.** $\Omega$ is **symmetric** if $\Omega(${X},${Y})=\Omega(${Y},${X})$, and **positive definite** if $\forall${X}\in V\setminus\{${Zr}\}:\Omega(${X},${X})>0$, $\Omega(${Zr},${Zr})=0$ (eq. 3.8). **Def. 3.3.** A symmetric PD $\Omega$ is an **inner product** $\langle${X},${Y}\rangle$, and $(V,\langle\cdot,\cdot\rangle)$ an **inner product space** (**Euclidean** with the dot product).` },
    { es: R`Ejemplo propio en $\mathbb{R}^2$: $\langle${X},${Y}\rangle:=2x_1y_1+x_1y_2+x_2y_1+x_2y_2$. Es bilineal (cada término es lineal en $${X}$ y en $${Y}$) y simétrica (intercambiar $${X}$ e $${Y}$ deja igual la suma). Definida positiva: $\langle${X},${X}\rangle=2x_1^2+2x_1x_2+x_2^2=x_1^2+(x_1+x_2)^2>0$ si $${X}\neq${Zr}$. Es un producto interno distinto del escalar.`,
      en: R`An example of our own on $\mathbb{R}^2$: $\langle${X},${Y}\rangle:=2x_1y_1+x_1y_2+x_2y_1+x_2y_2$. It is bilinear (each term is linear in $${X}$ and in $${Y}$) and symmetric (swapping $${X}$ and $${Y}$ leaves the sum unchanged). Positive definite: $\langle${X},${X}\rangle=2x_1^2+2x_1x_2+x_2^2=x_1^2+(x_1+x_2)^2>0$ if $${X}\neq${Zr}$. It is an inner product other than the dot product.` },
    { sec: { es: 'Matrices simétricas definidas positivas', en: 'Symmetric, positive definite matrices' },
      es: R`Con una base $(${b}_1,\dots,${b}_n)$, escribe $${X}=\sum_i\psi_i${b}_i$ e $${Y}=\sum_j\lambda_j${b}_j$. Por bilinealidad (MML §3.2.3, ec. 3.10): $\langle${X},${Y}\rangle=\sum_{i}\sum_{j}\psi_i\langle${b}_i,${b}_j\rangle\lambda_j=\hat{${X}}^\top${A}\hat{${Y}}$, con $A_{ij}:=\langle${b}_i,${b}_j\rangle$ ($\hat{\cdot}$: coordenadas). El producto interno queda **determinado por** $${A}$.`,
      en: R`With an ordered basis $(${b}_1,\dots,${b}_n)$, write $${X}=\sum_i\psi_i${b}_i$ and $${Y}=\sum_j\lambda_j${b}_j$. By bilinearity (MML §3.2.3, eq. 3.10): $\langle${X},${Y}\rangle=\sum_{i}\sum_{j}\psi_i\langle${b}_i,${b}_j\rangle\lambda_j=\hat{${X}}^\top${A}\hat{${Y}}$, with $A_{ij}:=\langle${b}_i,${b}_j\rangle$ ($\hat{\cdot}$: coordinates). The inner product is **determined by** $${A}$.` },
    { es: R`La simetría del producto interno hace $${A}$ simétrica, y la definida positiva da $\forall${X}\in V\setminus\{${Zr}\}:${X}^\top${A}${X}>0$ (ec. 3.11). **Def. 3.4.** Una matriz simétrica que cumple (3.11) es **simétrica definida positiva** (DP). Si solo se cumple $\ge$, es **semidefinida positiva**. En el ejemplo anterior, $${A}=\begin{bmatrix}2&1\\1&1\end{bmatrix}$.`,
      en: R`The symmetry of the inner product makes $${A}$ symmetric, and positive definiteness gives $\forall${X}\in V\setminus\{${Zr}\}:${X}^\top${A}${X}>0$ (eq. 3.11). **Def. 3.4.** A symmetric matrix satisfying (3.11) is **symmetric, positive definite** (PD). If only $\ge$ holds, it is **positive semidefinite**. In the previous example, $${A}=\begin{bmatrix}2&1\\1&1\end{bmatrix}$.` },
    { es: R`**Teorema 3.5.** En un espacio real de dimensión finita con base ordenada $B$, $\langle\cdot,\cdot\rangle$ es un producto interno **si y solo si** existe $${A}\in\mathbb{R}^{n\times n}$ simétrica DP con $\langle${X},${Y}\rangle=\hat{${X}}^\top${A}\hat{${Y}}$ (ec. 3.15). Si es DP: $\ker(${A})=\{${Zr}\}$, porque $${X}^\top${A}${X}>0$ si $${X}\neq${Zr}$, y $a_{ii}=${B('e')}_i^\top${A}${B('e')}_i>0$.`,
      en: R`**Theorem 3.5.** In a finite-dimensional real space with ordered basis $B$, $\langle\cdot,\cdot\rangle$ is an inner product **if and only if** there is a symmetric PD $${A}\in\mathbb{R}^{n\times n}$ with $\langle${X},${Y}\rangle=\hat{${X}}^\top${A}\hat{${Y}}$ (eq. 3.15). If PD: $\ker(${A})=\{${Zr}\}$, because $${X}^\top${A}${X}>0$ if $${X}\neq${Zr}$, and $a_{ii}=${B('e')}_i^\top${A}${B('e')}_i>0$.` },
    { vectores: E_A, leyenda: ['compara'],
      es: R`El contorno es $\{${X}:${X}^\top${A}${X}=1\}$, la «circunferencia unidad» de la norma inducida por $${A}$: una **elipse**. Mueve las entradas. En $2\times2$, $${A}$ simétrica es DP si y solo si $a_{11}>0$ y $\det${A}>0$. Si $a_{11}a_{22}\le a_{12}^2$, la elipse **desaparece**: ya no es un producto interno.`,
      en: R`The outline is $\{${X}:${X}^\top${A}${X}=1\}$, the "unit circle" of the norm induced by $${A}$: an **ellipse**. Move the entries. In $2\times2$, a symmetric $${A}$ is PD if and only if $a_{11}>0$ and $\det${A}>0$. If $a_{11}a_{22}\le a_{12}^2$, the ellipse **disappears**: it is no longer an inner product.`,
      jugar: {
        botones: [
          { label: 'A = I', hacer: v => { v.a = 1; v.c = 0; v.d = 1; } },
          { label: '[[2,1],[1,1]]', hacer: v => { v.a = 2; v.c = 1; v.d = 1; } },
          { label: '[[1,1.5],[1.5,2]]', hacer: v => { v.a = 1; v.c = 1.5; v.d = 2; } },
        ],
        lecturas: (v, cx) => {
          const M = [[v.a, v.c], [v.c, v.d]], D = v.a * v.d - v.c * v.c, dp = v.a > 0 && D > 0;
          return [
            { expr: R`$\det${A}$`, valor: cx.fmt(+D.toFixed(3)) },
            { expr: R`$${X}^\top${A}${X}$`, valor: cx.fmt(+cx.dot(v.vec.x, v.vec.x, M).toFixed(3)) },
            { expr: R`$${X}^\top${X}$`, valor: cx.fmt(+cx.dot(v.vec.x, v.vec.x).toFixed(3)) },
            { expr: { es: '¿DP? (producto interno)', en: 'PD? (inner product)' }, valor: dp ? '✓' : '✗', malo: !dp },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: R`¿Cuál de estas matrices define un producto interno $\langle${X},${Y}\rangle=${X}^\top${A}${Y}$ en $\mathbb{R}^2$?`,
      en: R`Which of these matrices defines an inner product $\langle${X},${Y}\rangle=${X}^\top${A}${Y}$ on $\mathbb{R}^2$?`,
      pregunta: {
        opc: [
          { es: R`$\begin{bmatrix}4&2\\2&1\end{bmatrix}$`, en: R`$\begin{bmatrix}4&2\\2&1\end{bmatrix}$` },
          { es: R`$\begin{bmatrix}1&2\\2&5\end{bmatrix}$`, en: R`$\begin{bmatrix}1&2\\2&5\end{bmatrix}$`, ok: 1 },
          { es: R`$\begin{bmatrix}3&1\\2&3\end{bmatrix}$`, en: R`$\begin{bmatrix}3&1\\2&3\end{bmatrix}$` },
        ],
        pistas: [{ es: 'Comprueba simetría, luego el signo de $a_{11}$ y de $\\det$.', en: 'Check symmetry, then the sign of $a_{11}$ and of $\\det$.' }],
        why: {
          es: R`$\begin{bmatrix}1&2\\2&5\end{bmatrix}$ es simétrica, con $a_{11}=1>0$ y $\det=1$: es DP, porque $x_1^2+4x_1x_2+5x_2^2=(x_1+2x_2)^2+x_2^2$. La primera tiene $\det=0$: es solo semidefinida, y $${X}=(1,-2)$ da $${X}^\top${A}${X}=0$. La tercera no es simétrica.`,
          en: R`$\begin{bmatrix}1&2\\2&5\end{bmatrix}$ is symmetric, with $a_{11}=1>0$ and $\det=1$: it is PD, because $x_1^2+4x_1x_2+5x_2^2=(x_1+2x_2)^2+x_2^2$. The first has $\det=0$: it is only semidefinite, and $${X}=(1,-2)$ gives $${X}^\top${A}${X}=0$. The third is not symmetric.`,
        },
      } },

    // ── MML §3.3 Longitudes y distancias ──
    { sec: { es: 'Longitudes y distancias', en: 'Lengths and distances' },
      es: R`Todo producto interno **induce** una norma (MML §3.3, ec. 3.16): $\|${X}\|:=\sqrt{\langle${X},${X}\rangle}$. El recíproco es falso: $\ell_1$ no viene de ningún producto interno. La norma inducida cumple la **desigualdad de Cauchy-Schwarz** (ec. 3.17): $|\langle${X},${Y}\rangle|\le\|${X}\|\,\|${Y}\|$.`,
      en: R`Every inner product **induces** a norm (MML §3.3, eq. 3.16): $\|${X}\|:=\sqrt{\langle${X},${X}\rangle}$. The converse is false: $\ell_1$ comes from no inner product. The induced norm satisfies the **Cauchy-Schwarz inequality** (eq. 3.17): $|\langle${X},${Y}\rangle|\le\|${X}\|\,\|${Y}\|$.` },
    { es: R`**Def. 3.6 (distancia y métrica).** En $(V,\langle\cdot,\cdot\rangle)$, $d(${X},${Y}):=\|${X}-${Y}\|=\sqrt{\langle${X}-${Y},${X}-${Y}\rangle}$ (ec. 3.21) es la **distancia** (euclídea con el escalar); $d$ es una **métrica** (ec. 3.22–3.23): definida positiva ($d\ge0$, y $d=0\iff${X}=${Y}$), simétrica y con desigualdad triangular $d(${X},${Z})\le d(${X},${Y})+d(${Y},${Z})$.`,
      en: R`**Def. 3.6 (distance and metric).** In $(V,\langle\cdot,\cdot\rangle)$, $d(${X},${Y}):=\|${X}-${Y}\|=\sqrt{\langle${X}-${Y},${X}-${Y}\rangle}$ (eq. 3.21) is the **distance** (Euclidean with the dot product); $d$ is a **metric** (eq. 3.22–3.23): positive definite ($d\ge0$, and $d=0\iff${X}=${Y}$), symmetric and with the triangle inequality $d(${X},${Z})\le d(${X},${Y})+d(${Y},${Z})$.` },
    { es: R`Ejemplo propio: $${X}=(1,2)$, $${Y}=(2,3)$, $${X}-${Y}=(-1,-1)$. Euclídea: $d=\sqrt{2}$. Con $${A}=\begin{bmatrix}2&1\\1&1\end{bmatrix}$: $d^2=2+2+1=5$, así que $d=\sqrt5$. **Ojo** (MML §3.3): producto interno y métrica van al revés. Dos vectores muy parecidos dan un producto interno **grande** y una distancia **pequeña**.`,
      en: R`An example of our own: $${X}=(1,2)$, $${Y}=(2,3)$, $${X}-${Y}=(-1,-1)$. Euclidean: $d=\sqrt{2}$. With $${A}=\begin{bmatrix}2&1\\1&1\end{bmatrix}$: $d^2=2+2+1=5$, so $d=\sqrt5$. **Careful** (MML §3.3): inner product and metric go opposite ways. Two very similar vectors give a **large** inner product and a **small** distance.` },

    // ── MML §3.4 Ángulos y ortogonalidad ──
    { sec: { es: 'Ángulos y ortogonalidad', en: 'Angles and orthogonality' },
      es: R`Por Cauchy-Schwarz, para $${X},${Y}\neq${Zr}$: $-1\le\frac{\langle${X},${Y}\rangle}{\|${X}\|\,\|${Y}\|}\le1$ (ec. 3.24). Como $\cos:[0,\pi]\to[-1,1]$ es biyectiva, existe un único $\omega\in[0,\pi]$ con $\cos\omega=\frac{\langle${X},${Y}\rangle}{\|${X}\|\,\|${Y}\|}$ (ec. 3.25): el **ángulo** entre $${X}$ e $${Y}$ (MML §3.4). **Intuición:** mide cuánto se parecen sus orientaciones.`,
      en: R`By Cauchy-Schwarz, for $${X},${Y}\neq${Zr}$: $-1\le\frac{\langle${X},${Y}\rangle}{\|${X}\|\,\|${Y}\|}\le1$ (eq. 3.24). As $\cos:[0,\pi]\to[-1,1]$ is bijective, there is a unique $\omega\in[0,\pi]$ with $\cos\omega=\frac{\langle${X},${Y}\rangle}{\|${X}\|\,\|${Y}\|}$ (eq. 3.25): the **angle** between $${X}$ and $${Y}$ (MML §3.4). **Intuition:** it measures how alike their orientations are.` },
    { es: R`**Def. 3.7.** $${X}$ e $${Y}$ son **ortogonales**, $${X}\perp${Y}$, si y solo si $\langle${X},${Y}\rangle=0$. Si además $\|${X}\|=1=\|${Y}\|$, son **ortonormales**. Consecuencia directa: $${Zr}$ es ortogonal a todo vector. La ortogonalidad generaliza la perpendicularidad: es un ángulo recto **respecto a un producto interno concreto**.`,
      en: R`**Def. 3.7.** $${X}$ and $${Y}$ are **orthogonal**, $${X}\perp${Y}$, if and only if $\langle${X},${Y}\rangle=0$. If also $\|${X}\|=1=\|${Y}\|$, they are **orthonormal**. Direct consequence: $${Zr}$ is orthogonal to every vector. Orthogonality generalises perpendicularity: it is a right angle **with respect to a specific inner product**.` },
    { vectores: E_ANG, leyenda: ['camino', 'mal'],
      es: R`$${X}=(1,2)$ e $${Y}=(-2,1)$ se ven perpendiculares: $${X}^\top${Y}=0$, y la proyección de $${Y}$ sobre $${X}$ es $${Zr}$. Pulsa «diag(1, 3)» para medir con $\langle${X},${Y}\rangle=${X}^\top\mathrm{diag}(1,3)${Y}$: la proyección deja de ser nula y la marca de ángulo «recto» se tuerce. Arrastra $${Y}$ hasta anular de nuevo $\langle${X},${Y}\rangle$.`,
      en: R`$${X}=(1,2)$ and $${Y}=(-2,1)$ look perpendicular: $${X}^\top${Y}=0$, and the projection of $${Y}$ onto $${X}$ is $${Zr}$. Press "diag(1, 3)" to measure with $\langle${X},${Y}\rangle=${X}^\top\mathrm{diag}(1,3)${Y}$: the projection is no longer zero and the "right angle" mark skews. Drag $${Y}$ until $\langle${X},${Y}\rangle$ vanishes again.`,
      jugar: {
        botones: [
          { label: { es: 'producto escalar', en: 'dot product' }, hacer: v => { v.a = 1; v.d = 1; } },
          { label: 'diag(1, 3)', hacer: v => { v.a = 1; v.d = 3; } },
          { label: { es: 'x, y de nuevo', en: 'reset x, y' }, hacer: v => { v.vec.x = [1, 2]; v.vec.y = [-2, 1]; } },
        ],
        lecturas: (v, cx) => {
          const M = [[v.a, 0], [0, v.d]], s = cx.dot(v.vec.x, v.vec.y, M), om = cx.angulo(v.vec.x, v.vec.y, M);
          return [
            { expr: R`$\langle${X},${Y}\rangle$`, valor: cx.fmt(+s.toFixed(3)) },
            { expr: R`$\cos\omega$`, valor: Number.isFinite(om) ? cx.fmt(+Math.cos(om).toFixed(3)) : '—' },
            { expr: R`$\omega$`, valor: Number.isFinite(om) ? `${cx.fmt(+(om * 180 / Math.PI).toFixed(1))}°` : '—' },
            { expr: R`$${X}\perp${Y}$`, valor: Math.abs(s) < 1e-9 ? '✓' : '✗', malo: Math.abs(s) >= 1e-9 },
          ];
        },
        arrastrables: true, soltar,
      } },
    { deriva: {
        pregunta: { es: R`Con $\langle${X},${Y}\rangle=${X}^\top\mathrm{diag}(1,3)${Y}$, ¿qué ángulo forman $${X}=(1,2)$ e $${Y}=(-2,1)$?`, en: R`With $\langle${X},${Y}\rangle=${X}^\top\mathrm{diag}(1,3)${Y}$, what angle do $${X}=(1,2)$ and $${Y}=(-2,1)$ make?` },
        opciones: [
          { es: R`$90^\circ$, porque se ven perpendiculares`, en: R`$90^\circ$, because they look perpendicular` },
          { es: R`Unos $65^\circ$`, en: R`About $65^\circ$` },
          { es: R`Unos $115^\circ$`, en: R`About $115^\circ$` },
        ], correcta: 1,
        razones: [
          { es: R`$\langle${X},${Y}\rangle=-2+6=4>0$, así que $\omega<90^\circ$`, en: R`$\langle${X},${Y}\rangle=-2+6=4>0$, so $\omega<90^\circ$` },
          { es: 'El ángulo no depende del producto interno', en: 'The angle does not depend on the inner product' },
          { es: R`$\langle${X},${Y}\rangle<0$`, en: R`$\langle${X},${Y}\rangle<0$` },
        ], razonCorrecta: 0,
        pistas: [{ es: R`Calcula $\langle${X},${Y}\rangle=x_1y_1+3x_2y_2$ y luego $\|${X}\|^2$ y $\|${Y}\|^2$ con el mismo producto.`, en: R`Compute $\langle${X},${Y}\rangle=x_1y_1+3x_2y_2$, then $\|${X}\|^2$ and $\|${Y}\|^2$ with the same product.` }],
        revela: { es: R`$\langle${X},${Y}\rangle=1\cdot(-2)+3\cdot2\cdot1=4$, $\|${X}\|^2=1+12=13$ y $\|${Y}\|^2=4+3=7$. Así, $\cos\omega=4/\sqrt{91}\approx0{,}419$ y $\omega\approx65{,}2^\circ$. Vectores ortogonales para un producto interno no tienen por qué serlo para otro (MML §3.4).`, en: R`$\langle${X},${Y}\rangle=1\cdot(-2)+3\cdot2\cdot1=4$, $\|${X}\|^2=1+12=13$ and $\|${Y}\|^2=4+3=7$. So $\cos\omega=4/\sqrt{91}\approx0.419$ and $\omega\approx65.2^\circ$. Vectors orthogonal under one inner product need not be orthogonal under another (MML §3.4).` },
      },
      par: { a: 1, d: 3 },
      es: R`$\cos\omega=\frac{4}{\sqrt{13}\sqrt{7}}\approx0{,}419$, luego $\omega\approx65{,}2^\circ$: **no** son ortogonales con este producto interno.`,
      en: R`$\cos\omega=\frac{4}{\sqrt{13}\sqrt{7}}\approx0.419$, so $\omega\approx65.2^\circ$: they are **not** orthogonal under this inner product.` },

    // ── Matriz ortogonal ──
    { sec: { es: 'Matrices ortogonales', en: 'Orthogonal matrices' },
      es: R`**Def. 3.8.** $${A}\in\mathbb{R}^{n\times n}$ es **ortogonal** si y solo si sus columnas son ortonormales: $${A}${A}^\top=${I}=${A}^\top${A}$ (ec. 3.29), y por tanto $${A}^{-1}=${A}^\top$ (ec. 3.30). Con el producto escalar conserva longitudes, $\|${A}${X}\|^2=${X}^\top${A}^\top${A}${X}=${X}^\top${X}$ (ec. 3.31), y ángulos (ec. 3.32). El nombre preciso sería «ortonormal».`,
      en: R`**Def. 3.8.** $${A}\in\mathbb{R}^{n\times n}$ is **orthogonal** if and only if its columns are orthonormal: $${A}${A}^\top=${I}=${A}^\top${A}$ (eq. 3.29), hence $${A}^{-1}=${A}^\top$ (eq. 3.30). With the dot product it preserves lengths, $\|${A}${X}\|^2=${X}^\top${A}^\top${A}${X}=${X}^\top${X}$ (eq. 3.31), and angles (eq. 3.32). The precise name would be "orthonormal".` },
    { vectores: E_ORT,
      es: R`Prueba cuatro matrices sobre la rejilla. Una **rotación** y una **reflexión** son ortogonales: $\|${A}${X}\|=\|${X}\|$ y $${A}^\top${A}=${I}$. Una **cizalla** y un **escalado** no lo son: deforman los cuadrados y cambian longitudes. MML §3.9 lo resume: las matrices ortogonales son rotaciones, con posibles volteos.`,
      en: R`Try four matrices on the grid. A **rotation** and a **reflection** are orthogonal: $\|${A}${X}\|=\|${X}\|$ and $${A}^\top${A}=${I}$. A **shear** and a **scaling** are not: they deform the squares and change lengths. MML §3.9 sums it up: orthogonal matrices are rotations, possibly with flips.`,
      jugar: {
        botones: [
          { label: { es: 'rotación 30°', en: 'rotation 30°' }, hacer: v => { const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6); Object.assign(v, { m11: c, m12: -s, m21: s, m22: c }); } },
          { label: { es: 'reflexión', en: 'reflection' }, hacer: v => { Object.assign(v, { m11: 0, m12: 1, m21: 1, m22: 0 }); } },
          { label: { es: 'cizalla', en: 'shear' }, hacer: v => { Object.assign(v, { m11: 1, m12: 0.8, m21: 0, m22: 1 }); } },
          { label: { es: 'escalado', en: 'scaling' }, hacer: v => { Object.assign(v, { m11: 1.4, m12: 0, m21: 0, m22: 0.7 }); } },
        ],
        lecturas: (v, cx) => {
          const M = [[v.m11, v.m12], [v.m21, v.m22]], Ax = cx.mul(M, v.vec.x);
          const c1 = [M[0][0], M[1][0]], c2 = [M[0][1], M[1][1]], err = Math.abs(cx.dot(c1, c1) - 1) + Math.abs(cx.dot(c2, c2) - 1) + Math.abs(cx.dot(c1, c2));
          return [
            { expr: R`$\|${X}\|$`, valor: cx.fmt(+cx.norma(v.vec.x).toFixed(3)) },
            { expr: R`$\|${A}${X}\|$`, valor: cx.fmt(+cx.norma(Ax).toFixed(3)) },
            { expr: R`$\det${A}$`, valor: cx.fmt(+cx.detM(M).toFixed(3)) },
            { expr: R`$${A}^\top${A}=${I}$`, valor: err < 1e-9 ? '✓' : '✗', malo: err >= 1e-9 },
          ];
        },
        arrastrables: true, soltar,
      } },

    // ── MML §3.5 Base ortonormal ──
    { sec: { es: 'Base ortonormal', en: 'Orthonormal basis' }, vectores: E_ONB, leyenda: ['camino'],
      es: R`**Def. 3.9.** Una base $\{${b}_1,\dots,${b}_n\}$ es **ortonormal** (BON) si $\langle${b}_i,${b}_j\rangle=0$ para $i\neq j$ (ec. 3.33) y $\langle${b}_i,${b}_i\rangle=1$ (ec. 3.34). Si solo se cumple (3.33), es **ortogonal**. La base canónica de $\mathbb{R}^n$ es ortonormal con el producto escalar. Ejemplo propio: $${b}_1=\tfrac15(3,4)$, $${b}_2=\tfrac15(-4,3)$.`,
      en: R`**Def. 3.9.** A basis $\{${b}_1,\dots,${b}_n\}$ is **orthonormal** (ONB) if $\langle${b}_i,${b}_j\rangle=0$ for $i\neq j$ (eq. 3.33) and $\langle${b}_i,${b}_i\rangle=1$ (eq. 3.34). If only (3.33) holds, it is **orthogonal**. The standard basis of $\mathbb{R}^n$ is orthonormal with the dot product. An example of our own: $${b}_1=\tfrac15(3,4)$, $${b}_2=\tfrac15(-4,3)$.` },
    { es: R`La gran ventaja: en una BON las coordenadas de $${X}$ son **productos escalares**, $\lambda_i=${b}_i^\top${X}$, sin resolver ningún sistema. Arrastra $${X}$: las dos proyecciones son $\lambda_1${b}_1$ y $\lambda_2${b}_2$, y su suma es $${X}$. Con una base cualquiera habría que resolver $[${b}_1\;${b}_2]\boldsymbol{\lambda}=${X}$ (§2.6).`,
      en: R`The big advantage: in an ONB the coordinates of $${X}$ are **dot products**, $\lambda_i=${b}_i^\top${X}$, without solving any system. Drag $${X}$: the two projections are $\lambda_1${b}_1$ and $\lambda_2${b}_2$, and they add up to $${X}$. With an arbitrary basis you would have to solve $[${b}_1\;${b}_2]\boldsymbol{\lambda}=${X}$ (§2.6).`,
      jugar: {
        botones: [
          { label: 'x = (2, 1)', hacer: v => { v.vec.x = [2, 1]; } },
          { label: 'x = (1, 2)', hacer: v => { v.vec.x = [1, 2]; } },
        ],
        lecturas: (v, cx) => {
          const l1 = cx.dot(v.vec.b1, v.vec.x), l2 = cx.dot(v.vec.b2, v.vec.x), s = cx.comb([l1, l2], [v.vec.b1, v.vec.b2]);
          return [
            { expr: R`$\lambda_1=${b}_1^\top${X}$`, valor: cx.fmt(+l1.toFixed(3)) },
            { expr: R`$\lambda_2=${b}_2^\top${X}$`, valor: cx.fmt(+l2.toFixed(3)) },
            { expr: R`$\lambda_1${b}_1+\lambda_2${b}_2$`, valor: p2(cx, s.map(t => +t.toFixed(3))) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: R`Con $${b}_1=\tfrac15(3,4)$ y $${b}_2=\tfrac15(-4,3)$, ¿cuáles son las coordenadas de $${X}=(2,1)$ en esa base?`,
      en: R`With $${b}_1=\tfrac15(3,4)$ and $${b}_2=\tfrac15(-4,3)$, what are the coordinates of $${X}=(2,1)$ in that basis?`,
      pregunta: {
        opc: [
          { es: R`$(2,\,-1)$`, en: R`$(2,\,-1)$`, ok: 1 },
          { es: R`$(2,\,1)$`, en: R`$(2,\,1)$` },
          { es: R`$(10,\,-5)$`, en: R`$(10,\,-5)$` },
        ],
        why: {
          es: R`$\lambda_1=${b}_1^\top${X}=\tfrac15(6+4)=2$ y $\lambda_2=${b}_2^\top${X}=\tfrac15(-8+3)=-1$. Comprobación: $2${b}_1-${b}_2=\tfrac15(6+4,\;8-3)=(2,1)$. $(10,-5)$ sale de olvidar el factor $\tfrac15$: entonces $${b}_i$ no tendría norma $1$.`,
          en: R`$\lambda_1=${b}_1^\top${X}=\tfrac15(6+4)=2$ and $\lambda_2=${b}_2^\top${X}=\tfrac15(-8+3)=-1$. Check: $2${b}_1-${b}_2=\tfrac15(6+4,\;8-3)=(2,1)$. $(10,-5)$ comes from forgetting the factor $\tfrac15$: then $${b}_i$ would not have norm $1$.`,
        },
      } },

    // ── MML §3.6 Complemento ortogonal ──
    { sec: { es: 'Complemento ortogonal', en: 'Orthogonal complement' }, vectores: E_COMP, leyenda: ['camino', 'mal'],
      es: R`Sea $U\subseteq V$ un subespacio de dimensión $M$ en un $V$ de dimensión $D$. Su **complemento ortogonal** $U^\perp$ contiene los vectores ortogonales a **todos** los de $U$. Es un subespacio de dimensión $D-M$ con $U\cap U^\perp=\{${Zr}\}$ (MML §3.6). Aquí $U$ es la recta de dirección $(-2,1)$ y $U^\perp$ la generada por $${w}$.`,
      en: R`Let $U\subseteq V$ be a subspace of dimension $M$ in a $V$ of dimension $D$. Its **orthogonal complement** $U^\perp$ contains the vectors orthogonal to **every** vector of $U$. It is a subspace of dimension $D-M$ with $U\cap U^\perp=\{${Zr}\}$ (MML §3.6). Here $U$ is the line with direction $(-2,1)$ and $U^\perp$ the one spanned by $${w}$.` },
    { es: R`Todo $${X}\in V$ se descompone de forma **única** como $${X}=\sum_{m=1}^M\lambda_m${b}_m+\sum_{j=1}^{D-M}\psi_j${b}_j^\perp$ (ec. 3.36), con bases de $U$ y de $U^\perp$. Arrastra $${X}$: sus proyecciones sobre $U$ y sobre $U^\perp$ suman siempre $${X}$. En $\mathbb{R}^3$, un plano $U$ queda descrito por su **vector normal** $${w}$, con $\|${w}\|=1$, que genera $U^\perp$.`,
      en: R`Every $${X}\in V$ decomposes **uniquely** as $${X}=\sum_{m=1}^M\lambda_m${b}_m+\sum_{j=1}^{D-M}\psi_j${b}_j^\perp$ (eq. 3.36), with bases of $U$ and of $U^\perp$. Drag $${X}$: its projections onto $U$ and onto $U^\perp$ always add up to $${X}$. In $\mathbb{R}^3$, a plane $U$ is described by its **normal vector** $${w}$, with $\|${w}\|=1$, which spans $U^\perp$.`,
      jugar: {
        botones: [
          { label: 'x = (0.5, 2.2)', hacer: v => { v.vec.x = [0.5, 2.2]; } },
          { label: { es: 'x en U', en: 'x in U' }, hacer: v => { v.vec.x = [-2, 1]; } },
          { label: { es: 'x en U⊥', en: 'x in U⊥' }, hacer: v => { v.vec.x = [1, 2]; } },
        ],
        lecturas: (v, cx) => {
          const pu = cx.proy(v.vec.x, [[-2, 1]]), pw = cx.proy(v.vec.x, [v.vec.w]), s = cx.comb([1, 1], [pu, pw]);
          return [
            { expr: R`$\pi_U(${X})$`, valor: p2(cx, pu.map(t => +t.toFixed(3))) },
            { expr: R`$\pi_{U^\perp}(${X})$`, valor: p2(cx, pw.map(t => +t.toFixed(3))) },
            { expr: R`$\pi_U(${X})+\pi_{U^\perp}(${X})$`, valor: p2(cx, s.map(t => +t.toFixed(3))) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: R`**Hiperplanos.** En $\mathbb{R}^n$, el complemento de una recta generada por $${w}$ es $\{${X}:${w}^\top${X}=0\}$, un subespacio de dimensión $n-1$: un **hiperplano** por el origen. Trasladado, $\{${X}:${w}^\top${X}=c\}$ es un hiperplano afín (§2.8). Así describe la SVM su frontera de decisión: el vector $${w}$ es normal a ella (MML §12.1).`,
      en: R`**Hyperplanes.** In $\mathbb{R}^n$, the complement of a line spanned by $${w}$ is $\{${X}:${w}^\top${X}=0\}$, a subspace of dimension $n-1$: a **hyperplane** through the origin. Shifted, $\{${X}:${w}^\top${X}=c\}$ is an affine hyperplane (§2.8). That is how the SVM describes its decision boundary: the vector $${w}$ is normal to it (MML §12.1).` },

    // ── MML §3.7 Producto interno de funciones ──
    { sec: { es: 'Producto interno de funciones', en: 'Inner product of functions' },
      funcion: { x: [-3.6, 3.6], y: [-1.1, 1.1], curvas: [{ id: 'p', nombre: { es: R`$\operatorname{sen}x\cos x$`, en: R`$\sin x\cos x$` }, f: t => Math.sin(t) * Math.cos(t) }],
        capas: [{ tipo: 'riemann', c: 'p', a: -Math.PI, b: Math.PI, n: 1, m: 'exacta' }],
        etiqueta: { es: 'Área con signo bajo sen x cos x entre −π y π', en: 'Signed area under sin x cos x between −π and π' } },
      es: R`Un vector de $\mathbb{R}^n$ es una función con $n$ valores. Si los valores son infinitos, la suma de (3.5) pasa a ser una integral (MML §3.7, ec. 3.37): $\langle u,v\rangle:=\int_a^b u(x)v(x)\,dx$. Si da $0$, $u$ y $v$ son **ortogonales**. Hacerlo riguroso lleva a los espacios de Hilbert, y la integral puede divergir; MML no entra ahí.`,
      en: R`A vector of $\mathbb{R}^n$ is a function with $n$ values. With infinitely many values, the sum in (3.5) becomes an integral (MML §3.7, eq. 3.37): $\langle u,v\rangle:=\int_a^b u(x)v(x)\,dx$. If it is $0$, $u$ and $v$ are **orthogonal**. Making it rigorous leads to Hilbert spaces, and the integral may diverge; MML does not go there.` },
    { es: R`Con $u=\operatorname{sen}$ y $v=\cos$ en $[-\pi,\pi]$, el producto es impar, $f(-x)=-f(x)$: las áreas positiva y negativa se cancelan y $\langle\operatorname{sen},\cos\rangle=0$. También $\{1,\cos x,\cos2x,\dots\}$ es ortogonal en $[-\pi,\pi]$ (ec. 3.38). Proyectar una función sobre ese subespacio es la idea de las **series de Fourier**.`,
      en: R`With $u=\sin$ and $v=\cos$ on $[-\pi,\pi]$, the product is odd, $f(-x)=-f(x)$: the positive and negative areas cancel and $\langle\sin,\cos\rangle=0$. Also $\{1,\cos x,\cos2x,\dots\}$ is orthogonal on $[-\pi,\pi]$ (eq. 3.38). Projecting a function onto that subspace is the idea behind **Fourier series**.` },
    { es: R`Con $\langle u,v\rangle=\int_{-1}^{1}u(x)v(x)\,dx$, ¿qué par de funciones **no** es ortogonal?`,
      en: R`With $\langle u,v\rangle=\int_{-1}^{1}u(x)v(x)\,dx$, which pair of functions is **not** orthogonal?`,
      pregunta: {
        opc: [
          { es: R`$1$ y $x$`, en: R`$1$ and $x$` },
          { es: R`$x$ y $x^2$`, en: R`$x$ and $x^2$` },
          { es: R`$1$ y $x^2$`, en: R`$1$ and $x^2$`, ok: 1 },
        ],
        why: {
          es: R`$\int_{-1}^1 x\,dx=0$ y $\int_{-1}^1x^3\,dx=0$, porque los integrandos son impares. Pero $\int_{-1}^1x^2\,dx=\tfrac23\neq0$. Para tener una base ortogonal de polinomios hay que aplicar Gram-Schmidt a $1,x,x^2$ (siguiente guía): sale $x^2-\tfrac13$ (polinomios de Legendre).`,
          en: R`$\int_{-1}^1 x\,dx=0$ and $\int_{-1}^1x^3\,dx=0$, because the integrands are odd. But $\int_{-1}^1x^2\,dx=\tfrac23\neq0$. To get an orthogonal basis of polynomials you apply Gram-Schmidt to $1,x,x^2$ (next guide): it gives $x^2-\tfrac13$ (Legendre polynomials).`,
        },
      } },

    // ── Dónde aparece en ML y código ──
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' },
      es: R`**Normas:** la regresión regularizada minimiza $\|${Y}-\boldsymbol{\Phi}\boldsymbol{\theta}\|^2+\lambda\|\boldsymbol{\theta}\|_2^2$ (MML §9.2.4, ec. 9.32); con $\ell_1$ es el LASSO. **Productos internos y DP:** los kernels de la SVM son productos internos en un espacio de rasgos (§12.4). **BON y complementos:** PCA busca una BON del subespacio principal (§10). **Hiperplanos y normas:** el margen de la SVM (§12.2).`,
      en: R`**Norms:** regularised regression minimises $\|${Y}-\boldsymbol{\Phi}\boldsymbol{\theta}\|^2+\lambda\|\boldsymbol{\theta}\|_2^2$ (MML §9.2.4, eq. 9.32); with $\ell_1$ it is the LASSO. **Inner products and PD:** SVM kernels are inner products in a feature space (§12.4). **ONBs and complements:** PCA looks for an ONB of the principal subspace (§10). **Hyperplanes and norms:** the SVM margin (§12.2).` },
    { code: `import numpy as np
x = np.array([1., 2.]); y = np.array([-2., 1.])
print(np.linalg.norm(x, 1), np.linalg.norm(x), np.linalg.norm(x, np.inf))
A = np.array([[1., 0.], [0., 3.]])            # producto interno x^T A y
dot = x @ A @ y
cos = dot / np.sqrt((x @ A @ x) * (y @ A @ y))
print(dot, np.degrees(np.arccos(cos)))         # 4.0  65.2...
np.linalg.cholesky(np.array([[1., 2.], [2., 5.]]))  # sin error: es DP
B = np.array([[3., -4.], [4., 3.]]) / 5        # columnas = BON
print(np.allclose(B.T @ B, np.eye(2)), B.T @ np.array([2., 1.]))  # True [ 2. -1.]`, line: null,
      es: R`En NumPy: `+ '`np.linalg.norm`' + R` calcula $\ell_1$, $\ell_2$ y $\ell_\infty$, y `+ '`x @ A @ y`' + R` es $${X}^\top${A}${Y}$. Para comprobar que una matriz simétrica es DP, `+ '`np.linalg.cholesky`' + R` lanza un error si no lo es (§4.3). En una BON las coordenadas son $${B('B')}^\top${X}$.`,
      en: R`In NumPy: `+ '`np.linalg.norm`' + R` computes $\ell_1$, $\ell_2$ and $\ell_\infty$, and `+ '`x @ A @ y`' + R` is $${X}^\top${A}${Y}$. To check that a symmetric matrix is PD, `+ '`np.linalg.cholesky`' + R` raises an error if it is not (§4.3). In an ONB the coordinates are $${B('B')}^\top${X}$.` },
    { code: '', es: R`**Resumen.** Norma: longitud con tres axiomas. Producto interno: bilineal, simétrico y DP; en coordenadas es $\hat{${X}}^\top${A}\hat{${Y}}$ con $${A}$ simétrica DP. De él salen la norma inducida, la distancia, el ángulo y la ortogonalidad, y todos dependen de $${A}$. En la siguiente guía, la proyección ortogonal convierte todo esto en el **punto más cercano** de un subespacio.`,
      en: R`**Summary.** Norm: length with three axioms. Inner product: bilinear, symmetric and PD; in coordinates it is $\hat{${X}}^\top${A}\hat{${Y}}$ with a symmetric PD $${A}$. From it come the induced norm, distance, angle and orthogonality, and all of them depend on $${A}$. In the next guide, orthogonal projection turns all this into the **closest point** of a subspace.` },
  ],
};
