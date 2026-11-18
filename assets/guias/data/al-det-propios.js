// Guía «Determinante, traza y valores propios» (Álgebra lineal, lección 7). Sigue MML §4.1 (determinante y traza) y §4.2
// (valores y vectores propios). Escena `vectores` (formato en la cabecera de assets/guias/vectores.js: capas rejilla,
// paralelogramo, imagen y propios); formato de los pasos en data/punteros.js. Notación MML: escalares en cursiva, vectores en
// negrita minúscula, matrices en negrita mayúscula (\bm = \boldsymbol en KaTeX). Ejemplos propios, verificados a mano.
const B = x => `\\bm{${x}}`;
const A = B('A'), X = B('x'), I = B('I'), Z = B('0'), Bm = B('B'), S = B('S'), Vv = B('v');
const M = [['m11', 'm12'], ['m21', 'm22']];
const P0 = { m11: 2, m12: 1, m21: 1, m22: 2 };
const DM = [['m11', 'a_{11}'], ['m12', 'a_{12}'], ['m21', 'a_{21}'], ['m22', 'a_{22}']]
  .map(([par, t]) => ({ par, min: -4, max: 4, paso: .1, es: `Entrada $${t}$`, en: `Entry $${t}$`, dec: 1 }));
const DS = [['a', 'a'], ['b', 'b'], ['d', 'd']].map(([par, t]) => ({ par, min: -3, max: 3, paso: .1, es: `Entrada $${t}$`, en: `Entry $${t}$`, dec: 1 }));
const REJ = { tipo: 'rejilla', m: M }, PAR = { tipo: 'paralelogramo', u: ['m11', 'm21'], v: ['m12', 'm22'] };
const AS = [[2, 1], [1, 2]]; // matriz fija de la búsqueda de vectores propios

const ponM = (v, m) => { [[v.m11, v.m12], [v.m21, v.m22]] = m; };
const deV = v => [[v.m11, v.m12], [v.m21, v.m22]];
const p2 = (cx, p) => `(${cx.fmt(p[0])} ; ${cx.fmt(p[1])})`;
const lamTxt = (E, cx) => (!E.reales ? `${cx.fmt(E.re)} ± ${cx.fmt(E.im)}i` : E.doble ? `${cx.fmt(E.l1)} (×2)` : `${cx.fmt(E.l1)} ; ${cx.fmt(E.l2)}`);
const fuera = m => m.flat().some(x => Math.abs(x) > 4 + 1e-9);
// operación de fila sobre las entradas (botón desactivado si se saldría del rango de los deslizadores)
const opFila = (label, f) => ({ label, hacer: v => ponM(v, f(deV(v)).map(r => r.map(x => +x.toFixed(4)))), off: v => fuera(f(deV(v))) });
const soltar = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };

export default {
  titulo: { es: 'Determinante, traza y valores propios', en: 'Determinant, trace and eigenvalues' },
  fuentes: [
    'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com',
  ],
  pasos: [
    // ── Motivación ──
    { sec: { es: 'Qué problema resuelve', en: 'What problem this solves' },
      vectores: { x: [-3.5, 3.5], y: [-3, 3.4], vec: {}, par: P0, deslizadores: DM, capas: [REJ, PAR],
        etiqueta: { es: 'Rejilla transformada por la matriz A y paralelogramo de sus columnas', en: 'Grid transformed by the matrix A and the parallelogram of its columns' } },
      es: `Una matriz cuadrada $${A}\\in\\mathbb{R}^{n\\times n}$ es una aplicación lineal de $\\mathbb{R}^n$ en sí mismo (MML §2.7). Este capítulo busca unos pocos números que la **resuman**: ¿aplasta el espacio, es decir, no es invertible?, ¿cuánto escala áreas y volúmenes?, ¿qué direcciones solo estira? Son el determinante, la traza y los valores propios (MML §4.1–4.2).`,
      en: `A square matrix $${A}\\in\\mathbb{R}^{n\\times n}$ is a linear mapping from $\\mathbb{R}^n$ to itself (MML §2.7). This chapter looks for a few numbers that **summarize** it: does it squash space, i.e. is it not invertible? How much does it scale areas and volumes? Which directions does it only stretch? They are the determinant, the trace and the eigenvalues (MML §4.1–4.2).` },
    { par: { m11: 1, m12: 2, m21: 2, m22: 4 },
      es: `Mirar las entradas no basta. $\\begin{bmatrix}1&2\\\\2&4\\end{bmatrix}$ parece inofensiva y aplasta todo el plano sobre una recta (la escena lo muestra). $\\begin{bmatrix}0&-1\\\\1&0\\end{bmatrix}$ no estira nada, pero gira todo. Hacen falta medidas que **no dependan de la base** en que se escribe la matriz. Eso tienen en común det, traza y valores propios.`,
      en: `Looking at the entries is not enough. $\\begin{bmatrix}1&2\\\\2&4\\end{bmatrix}$ looks harmless and squashes the whole plane onto a line (the scene shows it). $\\begin{bmatrix}0&-1\\\\1&0\\end{bmatrix}$ stretches nothing, but rotates everything. We need measures that **do not depend on the basis** the matrix is written in. That is what det, trace and eigenvalues share.` },

    // ── MML §4.1 Determinante ──
    { sec: { es: 'Determinante 2×2', en: '2×2 determinant' }, par: P0,
      es: `**Determinante (MML §4.1, ec. 4.4–4.6).** Para $n=1$, $\\det(a_{11})=a_{11}$. Para $n=2$: $\\det(${A})=\\begin{vmatrix}a_{11}&a_{12}\\\\a_{21}&a_{22}\\end{vmatrix}=a_{11}a_{22}-a_{12}a_{21}$. También se escribe $|${A}|$: aquí las barras significan determinante, no valor absoluto.`,
      en: `**Determinant (MML §4.1, eq. 4.4–4.6).** For $n=1$, $\\det(a_{11})=a_{11}$. For $n=2$: $\\det(${A})=\\begin{vmatrix}a_{11}&a_{12}\\\\a_{21}&a_{22}\\end{vmatrix}=a_{11}a_{22}-a_{12}a_{21}$. It is also written $|${A}|$: here the bars mean determinant, not absolute value.` },
    { es: `**Teorema 4.1 (MML).** $${A}\\in\\mathbb{R}^{n\\times n}$ es invertible $\\iff\\det(${A})\\neq0$. En $2\\times2$ se ve en la inversa: $${A}^{-1}=\\frac{1}{a_{11}a_{22}-a_{12}a_{21}}\\begin{bmatrix}a_{22}&-a_{12}\\\\-a_{21}&a_{11}\\end{bmatrix}$. El denominador es justo $\\det(${A})$, y si vale $0$ la fórmula no existe.`,
      en: `**Theorem 4.1 (MML).** $${A}\\in\\mathbb{R}^{n\\times n}$ is invertible $\\iff\\det(${A})\\neq0$. In $2\\times2$ you see it in the inverse: $${A}^{-1}=\\frac{1}{a_{11}a_{22}-a_{12}a_{21}}\\begin{bmatrix}a_{22}&-a_{12}\\\\-a_{21}&a_{11}\\end{bmatrix}$. The denominator is exactly $\\det(${A})$, and if it is $0$ the formula does not exist.` },
    { es: `**Intuición (MML Ej. 4.2).** $|\\det(${A})|$ es el área del paralelogramo que forman las **columnas** de $${A}$, que es la imagen del cuadrado unidad. El signo dice si la orientación se conserva ($+$) o se invierte como en un espejo ($-$, en rojo). Mueve las entradas o usa los botones y mira el área.`,
      en: `**Intuition (MML Ex. 4.2).** $|\\det(${A})|$ is the area of the parallelogram formed by the **columns** of $${A}$, which is the image of the unit square. The sign says whether orientation is preserved ($+$) or flipped as in a mirror ($-$, in red). Move the entries or use the buttons and watch the area.`,
      jugar: {
        botones: [
          { label: { es: 'cizalla', en: 'shear' }, hacer: v => ponM(v, [[1, 1], [0, 1]]) },
          { label: { es: 'reflexión', en: 'reflection' }, hacer: v => ponM(v, [[1, 0], [0, -1]]) },
          { label: { es: 'aplastar', en: 'squash' }, hacer: v => ponM(v, [[1, 2], [.5, 1]]) },
          { label: { es: 'escala ×2', en: 'scale ×2' }, hacer: v => ponM(v, [[2, 0], [0, 2]]) },
        ],
        lecturas: (v, cx) => {
          const d = cx.detM(deV(v)), nulo = Math.abs(d) < 1e-9;
          return [
            { expr: `$\\det(${A})=a_{11}a_{22}-a_{12}a_{21}$`, valor: cx.fmt(d) },
            { expr: { es: 'área $=|\\det(' + A + ')|$', en: 'area $=|\\det(' + A + ')|$' }, valor: cx.fmt(Math.abs(d)) },
            { expr: { es: 'orientación', en: 'orientation' }, valor: nulo ? '—' : d > 0 ? '+' : '−' },
            { expr: { es: '¿invertible?', en: 'invertible?' }, valor: nulo ? '✗' : '✓', malo: nulo },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: `¿Cuánto vale $\\det\\begin{bmatrix}3&1\\\\6&2\\end{bmatrix}$ y qué significa?`,
      en: `What is $\\det\\begin{bmatrix}3&1\\\\6&2\\end{bmatrix}$ and what does it mean?`,
      pregunta: {
        opc: [
          { es: '$0$: las columnas son paralelas y el plano se aplasta en una recta', en: '$0$: the columns are parallel and the plane is squashed onto a line', ok: 1 },
          { es: '$12$: el área se multiplica por 12', en: '$12$: area is multiplied by 12' },
          { es: '$-12$: el área se multiplica por 12 y se invierte la orientación', en: '$-12$: area is multiplied by 12 and orientation flips' },
        ],
        why: {
          es: '$3\\cdot2-1\\cdot6=0$. La columna $(1,2)^\\top$ es $\\tfrac13$ de $(3,6)^\\top$: el paralelogramo degenera en un segmento de área 0, la matriz no es invertible (Teorema 4.1) y su rango es 1.',
          en: '$3\\cdot2-1\\cdot6=0$. The column $(1,2)^\\top$ is $\\tfrac13$ of $(3,6)^\\top$: the parallelogram degenerates into a segment of area 0, the matrix is not invertible (Theorem 4.1) and its rank is 1.',
        },
      } },
    { sec: { es: 'Determinante 3×3', en: '3×3 determinant' },
      es: `**Regla de Sarrus (MML ec. 4.7).** Para $n=3$: $\\det(${A})=a_{11}a_{22}a_{33}+a_{21}a_{32}a_{13}+a_{31}a_{12}a_{23}-a_{31}a_{22}a_{13}-a_{11}a_{32}a_{23}-a_{21}a_{12}a_{33}$. Tres productos «en diagonal» suman y tres restan. Solo vale para $3\\times3$: no se generaliza a $n=4$.`,
      en: `**Sarrus' rule (MML eq. 4.7).** For $n=3$: $\\det(${A})=a_{11}a_{22}a_{33}+a_{21}a_{32}a_{13}+a_{31}a_{12}a_{23}-a_{31}a_{22}a_{13}-a_{11}a_{32}a_{23}-a_{21}a_{12}a_{33}$. Three "diagonal" products add and three subtract. It only works for $3\\times3$: it does not generalize to $n=4$.` },
    { es: `Si $${B('T')}$ es **triangular** (superior: $T_{ij}=0$ para $i>j$; inferior: ceros sobre la diagonal), entonces $\\det(${B('T')})=\\prod_{i=1}^nT_{ii}$ (MML ec. 4.8). En $\\mathbb{R}^3$, $|\\det[${B('r')},${B('b')},${B('g')}]|$ es el **volumen** del paralelepípedo que generan las columnas; en $\\mathbb{R}^n$ es un volumen $n$-dimensional con signo (MML Ej. 4.2).`,
      en: `If $${B('T')}$ is **triangular** (upper: $T_{ij}=0$ for $i>j$; lower: zeros above the diagonal), then $\\det(${B('T')})=\\prod_{i=1}^nT_{ii}$ (MML eq. 4.8). In $\\mathbb{R}^3$, $|\\det[${B('r')},${B('b')},${B('g')}]|$ is the **volume** of the parallelepiped spanned by the columns; in $\\mathbb{R}^n$ it is a signed $n$-dimensional volume (MML Ex. 4.2).` },
    { es: `**Teorema 4.2 (desarrollo de Laplace).** Sea $${A}_{k,j}\\in\\mathbb{R}^{(n-1)\\times(n-1)}$ la submatriz que queda al borrar la fila $k$ y la columna $j$. Por la columna $j$: $\\det(${A})=\\sum_{k=1}^n(-1)^{k+j}a_{kj}\\det(${A}_{k,j})$ (ec. 4.12). Por la fila $j$: $\\det(${A})=\\sum_{k=1}^n(-1)^{k+j}a_{jk}\\det(${A}_{j,k})$ (ec. 4.13).`,
      en: `**Theorem 4.2 (Laplace expansion).** Let $${A}_{k,j}\\in\\mathbb{R}^{(n-1)\\times(n-1)}$ be the submatrix left after deleting row $k$ and column $j$. Along column $j$: $\\det(${A})=\\sum_{k=1}^n(-1)^{k+j}a_{kj}\\det(${A}_{k,j})$ (eq. 4.12). Along row $j$: $\\det(${A})=\\sum_{k=1}^n(-1)^{k+j}a_{jk}\\det(${A}_{j,k})$ (eq. 4.13).` },
    { es: `$\\det(${A}_{k,j})$ es un **menor** y $(-1)^{k+j}\\det(${A}_{k,j})$ un **cofactor**. Ejemplo propio, $${A}=\\begin{bmatrix}2&0&1\\\\1&3&0\\\\0&1&4\\end{bmatrix}$, por la fila 1: $2\\begin{vmatrix}3&0\\\\1&4\\end{vmatrix}-0+1\\begin{vmatrix}1&3\\\\0&1\\end{vmatrix}=24+1=25$. Sarrus da lo mismo: $24+1+0-0-0-0=25$.`,
      en: `$\\det(${A}_{k,j})$ is a **minor** and $(-1)^{k+j}\\det(${A}_{k,j})$ a **cofactor**. An example of our own, $${A}=\\begin{bmatrix}2&0&1\\\\1&3&0\\\\0&1&4\\end{bmatrix}$, along row 1: $2\\begin{vmatrix}3&0\\\\1&4\\end{vmatrix}-0+1\\begin{vmatrix}1&3\\\\0&1\\end{vmatrix}=24+1=25$. Sarrus gives the same: $24+1+0-0-0-0=25$.` },
    { es: `Aplicado de forma recursiva, Laplace reduce todo a determinantes $2\\times2$, pero cuesta del orden de $n!$ operaciones: con $n=20$ ya es inviable. En la práctica se usa la eliminación gaussiana, de coste $O(n^3)$, gracias a las propiedades que vienen ahora (MML §4.1).`,
      en: `Applied recursively, Laplace reduces everything to $2\\times2$ determinants, but it costs on the order of $n!$ operations: at $n=20$ it is already infeasible. In practice Gaussian elimination is used, at cost $O(n^3)$, thanks to the properties that come next (MML §4.1).` },

    // ── Propiedades ──
    { sec: { es: 'Propiedades del determinante', en: 'Properties of the determinant' },
      es: `**Propiedades (MML §4.1).** Para $${A},${Bm}\\in\\mathbb{R}^{n\\times n}$: $\\det(${A}${Bm})=\\det(${A})\\det(${Bm})$; $\\det(${A})=\\det(${A}^\\top)$; si $${A}$ es invertible, $\\det(${A}^{-1})=1/\\det(${A})$. Matrices semejantes (Def. 2.22) tienen el mismo determinante, así que este **no depende de la base** de la aplicación lineal.`,
      en: `**Properties (MML §4.1).** For $${A},${Bm}\\in\\mathbb{R}^{n\\times n}$: $\\det(${A}${Bm})=\\det(${A})\\det(${Bm})$; $\\det(${A})=\\det(${A}^\\top)$; if $${A}$ is invertible, $\\det(${A}^{-1})=1/\\det(${A})$. Similar matrices (Def. 2.22) have the same determinant, so it **does not depend on the basis** of the linear mapping.` },
    { es: `Frente a operaciones de fila (o de columna): sumar a una fila un múltiplo de otra **no cambia** el determinante; multiplicar una fila por $\\lambda$ lo multiplica por $\\lambda$, y por eso $\\det(\\lambda${A})=\\lambda^n\\det(${A})$; intercambiar dos filas **cambia su signo**. Así, Gauss lleva $${A}$ a forma triangular y basta multiplicar la diagonal.`,
      en: `Under row (or column) operations: adding a multiple of one row to another **does not change** the determinant; multiplying a row by $\\lambda$ multiplies it by $\\lambda$, which is why $\\det(\\lambda${A})=\\lambda^n\\det(${A})$; swapping two rows **flips its sign**. So Gauss brings $${A}$ to triangular form and it is enough to multiply the diagonal.` },
    { par: P0,
      es: `Pruébalo. Cada botón aplica una operación de fila a las entradas de $${A}$. Mira el paralelogramo de las columnas: $R_2\\leftarrow R_2-\\tfrac12R_1$ lo **cizalla** sin cambiar su área y deja $${A}$ triangular; escalar una fila lo estira; intercambiar filas lo refleja y cambia el signo.`,
      en: `Try it. Each button applies a row operation to the entries of $${A}$. Watch the parallelogram of the columns: $R_2\\leftarrow R_2-\\tfrac12R_1$ **shears** it without changing its area and leaves $${A}$ triangular; scaling a row stretches it; swapping rows reflects it and flips the sign.`,
      jugar: {
        botones: [
          opFila('R₂ ← R₂ − ½R₁', m => [m[0], [m[1][0] - m[0][0] / 2, m[1][1] - m[0][1] / 2]]),
          opFila('R₁ ← 2R₁', m => [[2 * m[0][0], 2 * m[0][1]], m[1]]),
          opFila('R₁ ↔ R₂', m => [m[1], m[0]]),
          { label: { es: 'reiniciar', en: 'reset' }, hacer: v => ponM(v, [[2, 1], [1, 2]]) },
        ],
        lecturas: (v, cx) => {
          const m = deV(v), tri = Math.abs(m[1][0]) < 1e-9 || Math.abs(m[0][1]) < 1e-9;
          return [
            { expr: `$\\det(${A})$`, valor: cx.fmt(cx.detM(m)) },
            { expr: { es: '¿triangular?', en: 'triangular?' }, valor: tri ? '✓' : '✗' },
            { expr: '$a_{11}a_{22}$', valor: cx.fmt(m[0][0] * m[1][1]) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: `**Teorema 4.3 (MML).** $\\det(${A})\\neq0\\iff\\operatorname{rk}(${A})=n$: invertible equivale a rango completo. Con la $${A}$ $3\\times3$ de antes: $R_2\\leftarrow R_2-\\tfrac12R_1$ da la fila $(0,3,-\\tfrac12)$, y $R_3\\leftarrow R_3-\\tfrac13R_2$ da $(0,0,\\tfrac{25}{6})$. Queda triangular: $\\det=2\\cdot3\\cdot\\tfrac{25}{6}=25$, como con Laplace.`,
      en: `**Theorem 4.3 (MML).** $\\det(${A})\\neq0\\iff\\operatorname{rk}(${A})=n$: invertible means full rank. With the earlier $3\\times3$ $${A}$: $R_2\\leftarrow R_2-\\tfrac12R_1$ gives the row $(0,3,-\\tfrac12)$, and $R_3\\leftarrow R_3-\\tfrac13R_2$ gives $(0,0,\\tfrac{25}{6})$. It is now triangular: $\\det=2\\cdot3\\cdot\\tfrac{25}{6}=25$, as with Laplace.` },
    { es: `$${A}\\in\\mathbb{R}^{3\\times3}$ tiene $\\det(${A})=2$. ¿Cuánto vale $\\det(3${A})$?`,
      en: `$${A}\\in\\mathbb{R}^{3\\times3}$ has $\\det(${A})=2$. What is $\\det(3${A})$?`,
      pregunta: {
        opc: [{ es: '$6$', en: '$6$' }, { es: '$54$', en: '$54$', ok: 1 }, { es: '$18$', en: '$18$' }],
        pistas: [{ es: '$3' + A + '$ multiplica por 3 cada una de las 3 filas.', en: '$3' + A + '$ multiplies each of the 3 rows by 3.' }],
        why: {
          es: '$\\det(\\lambda' + A + ')=\\lambda^n\\det(' + A + ')=3^3\\cdot2=54$. Cada fila escalada multiplica el determinante por 3; geométricamente, el volumen crece $3$ veces en cada una de las 3 dimensiones.',
          en: '$\\det(\\lambda' + A + ')=\\lambda^n\\det(' + A + ')=3^3\\cdot2=54$. Each scaled row multiplies the determinant by 3; geometrically, volume grows $3$ times in each of the 3 dimensions.',
        },
      } },

    // ── Traza ──
    { sec: { es: 'Traza', en: 'Trace' },
      es: `**Def. 4.4 (traza).** $\\operatorname{tr}(${A}):=\\sum_{i=1}^na_{ii}$ (ec. 4.18), la suma de la diagonal. Cumple $\\operatorname{tr}(${A}+${Bm})=\\operatorname{tr}(${A})+\\operatorname{tr}(${Bm})$, $\\operatorname{tr}(\\alpha${A})=\\alpha\\operatorname{tr}(${A})$, y $\\operatorname{tr}(${I}_n)=n$ (MML §4.1).`,
      en: `**Def. 4.4 (trace).** $\\operatorname{tr}(${A}):=\\sum_{i=1}^na_{ii}$ (eq. 4.18), the sum of the diagonal. It satisfies $\\operatorname{tr}(${A}+${Bm})=\\operatorname{tr}(${A})+\\operatorname{tr}(${Bm})$, $\\operatorname{tr}(\\alpha${A})=\\alpha\\operatorname{tr}(${A})$, and $\\operatorname{tr}(${I}_n)=n$ (MML §4.1).` },
    { es: `Y para productos: $\\operatorname{tr}(${A}${Bm})=\\operatorname{tr}(${Bm}${A})$ si $${A}\\in\\mathbb{R}^{n\\times k}$ y $${Bm}\\in\\mathbb{R}^{k\\times n}$, aunque $${A}${Bm}$ sea $n\\times n$ y $${Bm}${A}$ sea $k\\times k$. Solo hay una función que cumpla estas cuatro propiedades a la vez: la traza (MML §4.1).`,
      en: `And for products: $\\operatorname{tr}(${A}${Bm})=\\operatorname{tr}(${Bm}${A})$ if $${A}\\in\\mathbb{R}^{n\\times k}$ and $${Bm}\\in\\mathbb{R}^{k\\times n}$, even though $${A}${Bm}$ is $n\\times n$ and $${Bm}${A}$ is $k\\times k$. Only one function satisfies these four properties together: the trace (MML §4.1).` },
    { es: `Más en general, la traza es invariante por **permutaciones cíclicas**: $\\operatorname{tr}(${A}${B('K')}${B('L')})=\\operatorname{tr}(${B('K')}${B('L')}${A})$, y en particular $\\operatorname{tr}(${X}${B('y')}^\\top)=${B('y')}^\\top${X}$. Ojo: cíclica no es cualquier orden; en general $\\operatorname{tr}(${A}${B('K')}${B('L')})\\neq\\operatorname{tr}(${B('K')}${A}${B('L')})$.`,
      en: `More generally, the trace is invariant under **cyclic permutations**: $\\operatorname{tr}(${A}${B('K')}${B('L')})=\\operatorname{tr}(${B('K')}${B('L')}${A})$, and in particular $\\operatorname{tr}(${X}${B('y')}^\\top)=${B('y')}^\\top${X}$. Careful: cyclic is not any order; in general $\\operatorname{tr}(${A}${B('K')}${B('L')})\\neq\\operatorname{tr}(${B('K')}${A}${B('L')})$.` },
    { es: `Consecuencia: la traza tampoco depende de la base. Si $${B('\\tilde A')}=${S}^{-1}${A}${S}$, entonces $\\operatorname{tr}(${S}^{-1}${A}${S})=\\operatorname{tr}(${A}${S}${S}^{-1})=\\operatorname{tr}(${A})$ (MML §4.1). En ML aparece constantemente al derivar expresiones con matrices, por ejemplo en el gradiente respecto a una matriz (MML §5.5).`,
      en: `Consequence: the trace does not depend on the basis either. If $${B('\\tilde A')}=${S}^{-1}${A}${S}$, then $\\operatorname{tr}(${S}^{-1}${A}${S})=\\operatorname{tr}(${A}${S}${S}^{-1})=\\operatorname{tr}(${A})$ (MML §4.1). In ML it shows up constantly when differentiating expressions with matrices, e.g. in gradients with respect to a matrix (MML §5.5).` },

    // ── Polinomio característico ──
    { sec: { es: 'Polinomio característico', en: 'Characteristic polynomial' },
      es: `**Def. 4.5 (polinomio característico).** Para $\\lambda\\in\\mathbb{R}$: $p_{${A}}(\\lambda):=\\det(${A}-\\lambda${I})=c_0+c_1\\lambda+\\dots+c_{n-1}\\lambda^{n-1}+(-1)^n\\lambda^n$ (ec. 4.22), con $c_0=\\det(${A})$ (ec. 4.23) y $c_{n-1}=(-1)^{n-1}\\operatorname{tr}(${A})$ (ec. 4.24).`,
      en: `**Def. 4.5 (characteristic polynomial).** For $\\lambda\\in\\mathbb{R}$: $p_{${A}}(\\lambda):=\\det(${A}-\\lambda${I})=c_0+c_1\\lambda+\\dots+c_{n-1}\\lambda^{n-1}+(-1)^n\\lambda^n$ (eq. 4.22), with $c_0=\\det(${A})$ (eq. 4.23) and $c_{n-1}=(-1)^{n-1}\\operatorname{tr}(${A})$ (eq. 4.24).` },
    { es: `En $2\\times2$, desarrollando: $p_{${A}}(\\lambda)=(a_{11}-\\lambda)(a_{22}-\\lambda)-a_{12}a_{21}=\\lambda^2-\\operatorname{tr}(${A})\\,\\lambda+\\det(${A})$. El determinante y la traza son, literalmente, coeficientes de este polinomio, y sus raíces van a ser los valores propios.`,
      en: `In $2\\times2$, expanding: $p_{${A}}(\\lambda)=(a_{11}-\\lambda)(a_{22}-\\lambda)-a_{12}a_{21}=\\lambda^2-\\operatorname{tr}(${A})\\,\\lambda+\\det(${A})$. The determinant and the trace are, literally, coefficients of this polynomial, and its roots are going to be the eigenvalues.` },

    // ── MML §4.2 Valores y vectores propios ──
    { sec: { es: 'Valores y vectores propios', en: 'Eigenvalues and eigenvectors' },
      es: `**Def. 4.6 (MML §4.2).** $\\lambda\\in\\mathbb{R}$ es un **valor propio** de $${A}\\in\\mathbb{R}^{n\\times n}$, y $${X}\\in\\mathbb{R}^n\\setminus\\{${Z}\\}$ un **vector propio** asociado, si $${A}${X}=\\lambda${X}$ (ec. 4.25, ecuación de valores propios). Se exige $${X}\\neq${Z}$ porque con $${X}=${Z}$ la ecuación vale para cualquier $\\lambda$ y no diría nada.`,
      en: `**Def. 4.6 (MML §4.2).** $\\lambda\\in\\mathbb{R}$ is an **eigenvalue** of $${A}\\in\\mathbb{R}^{n\\times n}$, and $${X}\\in\\mathbb{R}^n\\setminus\\{${Z}\\}$ a corresponding **eigenvector**, if $${A}${X}=\\lambda${X}$ (eq. 4.25, the eigenvalue equation). We require $${X}\\neq${Z}$ because with $${X}=${Z}$ the equation holds for any $\\lambda$ and would say nothing.` },
    { es: `Son equivalentes (MML §4.2): (i) $\\lambda$ es valor propio de $${A}$; (ii) existe $${X}\\neq${Z}$ con $(${A}-\\lambda${I}_n)${X}=${Z}$; (iii) $\\operatorname{rk}(${A}-\\lambda${I}_n)<n$; (iv) $\\det(${A}-\\lambda${I}_n)=0$. De ahí el **Teorema 4.8**: $\\lambda$ es valor propio de $${A}$ $\\iff$ es raíz de $p_{${A}}(\\lambda)$.`,
      en: `The following are equivalent (MML §4.2): (i) $\\lambda$ is an eigenvalue of $${A}$; (ii) there is $${X}\\neq${Z}$ with $(${A}-\\lambda${I}_n)${X}=${Z}$; (iii) $\\operatorname{rk}(${A}-\\lambda${I}_n)<n$; (iv) $\\det(${A}-\\lambda${I}_n)=0$. Hence **Theorem 4.8**: $\\lambda$ is an eigenvalue of $${A}$ $\\iff$ it is a root of $p_{${A}}(\\lambda)$.` },
    { vectores: { x: [-3.5, 3.5], y: [-3, 3.4], vec: { x: [1, .5] }, arrastrar: ['x'], paso: .25,
        capas: [{ tipo: 'flecha', a: 'x' }, { tipo: 'imagen', m: AS, a: 'x' }],
        etiqueta: { es: 'Vector x arrastrable y su imagen A x', en: 'Draggable vector x and its image A x' } },
      es: `**Intuición.** Casi todos los vectores cambian de dirección al aplicarles $${A}=\\begin{bmatrix}2&1\\\\1&2\\end{bmatrix}$. Arrastra $${X}$ y busca las direcciones en que $${A}${X}$ queda **sobre la misma recta** que $${X}$: ahí $${A}${X}=\\lambda${X}$. Hay dos rectas así.`,
      en: `**Intuition.** Almost every vector changes direction under $${A}=\\begin{bmatrix}2&1\\\\1&2\\end{bmatrix}$. Drag $${X}$ and look for the directions where $${A}${X}$ lands **on the same line** as $${X}$: there $${A}${X}=\\lambda${X}$. There are two such lines.`,
      jugar: {
        botones: [
          { label: { es: 'probar (1, 0)', en: 'try (1, 0)' }, hacer: v => { v.vec.x = [1, 0]; } },
          { label: { es: 'probar (1, 1)', en: 'try (1, 1)' }, hacer: v => { v.vec.x = [1, 1]; } },
          { label: { es: 'probar (−1, 1)', en: 'try (−1, 1)' }, hacer: v => { v.vec.x = [-1, 1]; } },
        ],
        lecturas: (v, cx) => {
          const x = v.vec.x, w = cx.mul(AS, x), n = Math.hypot(x[0], x[1]), cr = cx.det(x, w);
          const col = n > 1e-9 && Math.abs(cr) <= 1e-6 * Math.max(1, n * Math.hypot(w[0], w[1]));
          return [
            { expr: `$${A}${X}$`, valor: p2(cx, w) },
            { expr: { es: `$\\det[${X},${A}${X}]$ (0 = misma recta)`, en: `$\\det[${X},${A}${X}]$ (0 = same line)` }, valor: cx.fmt(cr) },
            { expr: '$\\lambda$', valor: col ? cx.fmt((x[0] * w[0] + x[1] * w[1]) / (n * n)) : '—' },
            { expr: { es: '¿vector propio?', en: 'eigenvector?' }, valor: col ? '✓' : '✗', malo: !col },
          ];
        },
        arrastrables: true, soltar,
      } },
    { capas: [{ tipo: 'propios', m: AS, vecs: false }, { tipo: 'flecha', a: 'x' }, { tipo: 'imagen', m: AS, a: 'x' }],
      es: `Las dos rectas son los **subespacios propios**: $\\lambda_1=3$ con $(1,1)^\\top$ y $\\lambda_2=1$ con $(1,-1)^\\top$. Compruébalo: $${A}(1,1)^\\top=(3,3)^\\top$ y $${A}(1,-1)^\\top=(1,-1)^\\top$. Fuera de ellas, $${A}${X}$ se inclina hacia la recta de $\\lambda_1=3$, la de mayor estiramiento. Sigue arrastrando $${X}$.`,
      en: `The two lines are the **eigenspaces**: $\\lambda_1=3$ with $(1,1)^\\top$ and $\\lambda_2=1$ with $(1,-1)^\\top$. Check: $${A}(1,1)^\\top=(3,3)^\\top$ and $${A}(1,-1)^\\top=(1,-1)^\\top$. Off them, $${A}${X}$ leans towards the line of $\\lambda_1=3$, the one stretched most. Keep dragging $${X}$.` },
    { es: `**Def. 4.10.** Los vectores propios de $\\lambda$ generan un subespacio, el **espacio propio** $E_\\lambda$; el conjunto de valores propios es el **espectro** de $${A}$. Como $${A}${X}=\\lambda${X}\\iff(${A}-\\lambda${I})${X}=${Z}$, resulta $E_\\lambda=\\ker(${A}-\\lambda${I})$ (ec. 4.27). Si $${X}$ es propio, $c${X}$ también ($c\\neq0$, ec. 4.26): los vectores no son únicos; las rectas, sí.`,
      en: `**Def. 4.10.** The eigenvectors of $\\lambda$ span a subspace, the **eigenspace** $E_\\lambda$; the set of eigenvalues is the **spectrum** of $${A}$. Since $${A}${X}=\\lambda${X}\\iff(${A}-\\lambda${I})${X}=${Z}$, we get $E_\\lambda=\\ker(${A}-\\lambda${I})$ (eq. 4.27). If $${X}$ is an eigenvector, so is $c${X}$ for every $c\\neq0$ (eq. 4.26): the vectors are not unique; the lines are.` },
    { sec: { es: 'Cálculo a mano', en: 'Computing by hand' },
      es: `Ejemplo propio, $${A}=\\begin{bmatrix}3&1\\\\2&2\\end{bmatrix}$. (1) $\\operatorname{tr}=5$ y $\\det=6-2=4$, así que $p_{${A}}(\\lambda)=\\lambda^2-5\\lambda+4=(\\lambda-4)(\\lambda-1)$. (2) Valores propios: $4$ y $1$. (3) $E_4=\\ker\\begin{bmatrix}-1&1\\\\2&-2\\end{bmatrix}=\\operatorname{span}[(1,1)^\\top]$ y $E_1=\\ker\\begin{bmatrix}2&1\\\\2&1\\end{bmatrix}=\\operatorname{span}[(1,-2)^\\top]$.`,
      en: `An example of our own, $${A}=\\begin{bmatrix}3&1\\\\2&2\\end{bmatrix}$. (1) $\\operatorname{tr}=5$ and $\\det=6-2=4$, so $p_{${A}}(\\lambda)=\\lambda^2-5\\lambda+4=(\\lambda-4)(\\lambda-1)$. (2) Eigenvalues: $4$ and $1$. (3) $E_4=\\ker\\begin{bmatrix}-1&1\\\\2&-2\\end{bmatrix}=\\operatorname{span}[(1,1)^\\top]$ and $E_1=\\ker\\begin{bmatrix}2&1\\\\2&1\\end{bmatrix}=\\operatorname{span}[(1,-2)^\\top]$.` },
    { vectores: { x: [-3.5, 3.5], y: [-3, 3.4], vec: {}, par: { m11: 3, m12: 1, m21: 2, m22: 2, a: 2, b: 1, d: 2 }, deslizadores: [...DM, ...DS],
        capas: [{ tipo: 'rejilla', m: M, base: false }, { tipo: 'propios', m: M }],
        etiqueta: { es: 'Rectas propias de la matriz A', en: 'Eigenlines of the matrix A' } },
      es: `Ahora mueve las entradas de $${A}$ (empieza en el ejemplo anterior). La escena dibuja las rectas propias reales, $${Vv}$ unitario (discontinuo) y $${A}${Vv}=\\lambda${Vv}$. Prueba los botones: una matriz simétrica, una rotación, una cizalla y un múltiplo de la identidad. ¿Cuándo desaparecen las rectas?`,
      en: `Now move the entries of $${A}$ (it starts at the previous example). The scene draws the real eigenlines, a unit $${Vv}$ (dashed) and $${A}${Vv}=\\lambda${Vv}$. Try the buttons: a symmetric matrix, a rotation, a shear and a multiple of the identity. When do the lines disappear?`,
      jugar: {
        botones: [
          { label: { es: 'ejemplo', en: 'example' }, hacer: v => ponM(v, [[3, 1], [2, 2]]) },
          { label: { es: 'simétrica', en: 'symmetric' }, hacer: v => ponM(v, [[2, 1], [1, 2]]) },
          { label: { es: 'rotación 90°', en: 'rotation 90°' }, hacer: v => ponM(v, [[0, -1], [1, 0]]) },
          { label: { es: 'cizalla', en: 'shear' }, hacer: v => ponM(v, [[2, 1], [0, 2]]) },
          { label: '2I', hacer: v => ponM(v, [[2, 0], [0, 2]]) },
        ],
        lecturas: (v, cx) => {
          const m = deV(v), E = cx.eig2(m), t = cx.traza(m), d = cx.detM(m);
          const s = E.reales ? E.l1 + E.l2 : 2 * E.re, p = E.reales ? E.l1 * E.l2 : E.re * E.re + E.im * E.im;
          return [
            { expr: '$\\lambda_1,\\lambda_2$', valor: lamTxt(E, cx) },
            { expr: `$\\lambda_1+\\lambda_2\\;|\\;\\operatorname{tr}(${A})$`, valor: `${cx.fmt(s)} | ${cx.fmt(t)}` },
            { expr: `$\\lambda_1\\lambda_2\\;|\\;\\det(${A})$`, valor: `${cx.fmt(p)} | ${cx.fmt(d)}` },
            { expr: { es: 'rectas propias reales', en: 'real eigenlines' }, valor: !E.reales ? '0' : E.defectuosa ? '1' : E.doble ? '∞' : '2', malo: !E.reales },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: `**Def. 4.9 y 4.11.** La **multiplicidad algebraica** de $\\lambda_i$ es el número de veces que aparece como raíz de $p_{${A}}$; la **geométrica** es $\\dim E_{\\lambda_i}$, el número de vectores propios independientes. Siempre $1\\le$ geométrica $\\le$ algebraica. Ej. 4.4: $${I}_n$ tiene $p(\\lambda)=(1-\\lambda)^n$; $\\lambda=1$ tiene las dos multiplicidades iguales a $n$, y todo vector es propio.`,
      en: `**Def. 4.9 and 4.11.** The **algebraic multiplicity** of $\\lambda_i$ is the number of times it appears as a root of $p_{${A}}$; the **geometric** one is $\\dim E_{\\lambda_i}$, the number of independent eigenvectors. Always $1\\le$ geometric $\\le$ algebraic. Ex. 4.4: $${I}_n$ has $p(\\lambda)=(1-\\lambda)^n$; $\\lambda=1$ has both multiplicities equal to $n$, and every vector is an eigenvector.` },
    { par: { m11: 2, m12: 1, m21: 0, m22: 2 },
      es: `**Def. 4.13.** $${A}\\in\\mathbb{R}^{n\\times n}$ es **defectuosa** si tiene menos de $n$ vectores propios linealmente independientes. Ejemplo propio, la cizalla de la escena: $p(\\lambda)=(2-\\lambda)^2$ (multiplicidad algebraica 2), pero $\\ker\\begin{bmatrix}0&1\\\\0&0\\end{bmatrix}=\\operatorname{span}[${B('e')}_1]$ (geométrica 1). Una sola recta propia.`,
      en: `**Def. 4.13.** $${A}\\in\\mathbb{R}^{n\\times n}$ is **defective** if it has fewer than $n$ linearly independent eigenvectors. An example of our own, the shear in the scene: $p(\\lambda)=(2-\\lambda)^2$ (algebraic multiplicity 2), but $\\ker\\begin{bmatrix}0&1\\\\0&0\\end{bmatrix}=\\operatorname{span}[${B('e')}_1]$ (geometric 1). A single eigenline.` },
    { es: `**Teorema 4.12.** Si $${A}\\in\\mathbb{R}^{n\\times n}$ tiene $n$ valores propios **distintos**, sus vectores propios son linealmente independientes y forman una base de $\\mathbb{R}^n$. Por eso una matriz defectuosa necesita un valor propio repetido; pero repetido no implica defectuosa: $2${I}$ repite $\\lambda=2$ y tiene todo el plano como espacio propio.`,
      en: `**Theorem 4.12.** If $${A}\\in\\mathbb{R}^{n\\times n}$ has $n$ **distinct** eigenvalues, its eigenvectors are linearly independent and form a basis of $\\mathbb{R}^n$. That is why a defective matrix needs a repeated eigenvalue; but repeated does not imply defective: $2${I}$ repeats $\\lambda=2$ and has the whole plane as its eigenspace.` },
    { par: { m11: 0, m12: -1, m21: 1, m22: 0 },
      es: `Una rotación $${B('R')}_\\theta=\\begin{bmatrix}\\cos\\theta&-\\sin\\theta\\\\\\sin\\theta&\\cos\\theta\\end{bmatrix}$ tiene $p(\\lambda)=\\lambda^2-2\\cos\\theta\\,\\lambda+1$, con discriminante $4\\cos^2\\theta-4<0$ salvo si $\\theta=k\\pi$. Sin raíces reales no hay rectas propias: ninguna dirección queda fija. Sus valores propios son complejos, $\\cos\\theta\\pm i\\sin\\theta$.`,
      en: `A rotation $${B('R')}_\\theta=\\begin{bmatrix}\\cos\\theta&-\\sin\\theta\\\\\\sin\\theta&\\cos\\theta\\end{bmatrix}$ has $p(\\lambda)=\\lambda^2-2\\cos\\theta\\,\\lambda+1$, with discriminant $4\\cos^2\\theta-4<0$ unless $\\theta=k\\pi$. With no real roots there are no eigenlines: no direction stays fixed. Its eigenvalues are complex, $\\cos\\theta\\pm i\\sin\\theta$.` },
    { deriva: {
        pregunta: { es: '¿Qué valores propios tiene la reflexión $\\begin{bmatrix}1&0\\\\0&-1\\end{bmatrix}$ respecto al eje $x_1$?', en: 'What eigenvalues does the reflection $\\begin{bmatrix}1&0\\\\0&-1\\end{bmatrix}$ across the $x_1$ axis have?' },
        opciones: [{ es: '$1$ y $-1$', en: '$1$ and $-1$' }, { es: 'Ninguno real', en: 'No real ones' }, { es: 'Solo $1$', en: 'Only $1$' }], correcta: 0,
        razones: [
          { es: 'El eje no se mueve ($\\lambda=1$) y su perpendicular se invierte ($\\lambda=-1$)', en: 'The axis does not move ($\\lambda=1$) and its perpendicular is flipped ($\\lambda=-1$)' },
          { es: 'Como una rotación, cambia la dirección de todos los vectores', en: 'Like a rotation, it changes the direction of every vector' },
          { es: 'Conserva longitudes, así que $|\\lambda|=1$ y solo cabe $\\lambda=1$', en: 'It preserves lengths, so $|\\lambda|=1$ and only $\\lambda=1$ fits' },
        ], razonCorrecta: 0,
        pistas: [{ es: 'Aplica la matriz a $(1,0)^\\top$ y a $(0,1)^\\top$.', en: 'Apply the matrix to $(1,0)^\\top$ and to $(0,1)^\\top$.' }],
        revela: { es: '$p(\\lambda)=(1-\\lambda)(-1-\\lambda)$, con raíces $1$ y $-1$. Conservar longitudes da $|\\lambda|=1$, pero $\\lambda=-1$ también cumple: un vector propio puede invertirse (MML §4.2).', en: '$p(\\lambda)=(1-\\lambda)(-1-\\lambda)$, with roots $1$ and $-1$. Preserving lengths gives $|\\lambda|=1$, but $\\lambda=-1$ also fits: an eigenvector may be flipped (MML §4.2).' },
      },
      par: { m11: 1, m12: 0, m21: 0, m22: -1 },
      es: `$\\lambda=1$ en el eje $x_1$ (queda fijo) y $\\lambda=-1$ en el eje $x_2$ (se invierte). Un valor propio negativo no es un fallo: indica que la dirección se conserva, pero el sentido se da la vuelta.`,
      en: `$\\lambda=1$ on the $x_1$ axis (it stays fixed) and $\\lambda=-1$ on the $x_2$ axis (it is flipped). A negative eigenvalue is not a failure: the direction is kept, but its sense is reversed.` },
    { es: `Más propiedades (MML §4.2): $${A}$ y $${A}^\\top$ tienen los mismos valores propios, pero no necesariamente los mismos vectores propios. Matrices semejantes tienen los mismos valores propios: igual que el determinante y la traza, **no dependen de la base**. Una matriz simétrica definida positiva tiene siempre valores propios reales y positivos.`,
      en: `More properties (MML §4.2): $${A}$ and $${A}^\\top$ have the same eigenvalues, but not necessarily the same eigenvectors. Similar matrices have the same eigenvalues: like the determinant and the trace, they **do not depend on the basis**. A symmetric positive definite matrix always has real, positive eigenvalues.` },
    { es: `**Teorema 4.14.** Para cualquier $${A}\\in\\mathbb{R}^{m\\times n}$, $${S}:=${A}^\\top${A}$ (ec. 4.36) es simétrica y semidefinida positiva. Simétrica: $(${A}^\\top${A})^\\top=${A}^\\top${A}$. Semidefinida: $${X}^\\top${A}^\\top${A}${X}=(${A}${X})^\\top(${A}${X})=\\|${A}${X}\\|^2\\ge0$. Si $\\operatorname{rk}(${A})=n$, es definida positiva. La SVD se apoya en esto.`,
      en: `**Theorem 4.14.** For any $${A}\\in\\mathbb{R}^{m\\times n}$, $${S}:=${A}^\\top${A}$ (eq. 4.36) is symmetric and positive semidefinite. Symmetric: $(${A}^\\top${A})^\\top=${A}^\\top${A}$. Semidefinite: $${X}^\\top${A}^\\top${A}${X}=(${A}${X})^\\top(${A}${X})=\\|${A}${X}\\|^2\\ge0$. If $\\operatorname{rk}(${A})=n$, it is positive definite. The SVD relies on this.` },

    // ── Teorema espectral ──
    { sec: { es: 'Teorema espectral', en: 'Spectral theorem' },
      capas: [{ tipo: 'rejilla', m: [['a', 'b'], ['b', 'd']], base: false }, { tipo: 'propios', m: [['a', 'b'], ['b', 'd']] }],
      es: `**Teorema 4.15 (espectral).** Si $${A}\\in\\mathbb{R}^{n\\times n}$ es simétrica, existe una base ortonormal del espacio formada por vectores propios de $${A}$, y todos sus valores propios son reales. Mueve $a$, $b$ y $d$ en $\\begin{bmatrix}a&b\\\\b&d\\end{bmatrix}$: las dos rectas propias siguen **perpendiculares** y nunca desaparecen.`,
      en: `**Theorem 4.15 (spectral).** If $${A}\\in\\mathbb{R}^{n\\times n}$ is symmetric, there is an orthonormal basis of the space made of eigenvectors of $${A}$, and all its eigenvalues are real. Move $a$, $b$ and $d$ in $\\begin{bmatrix}a&b\\\\b&d\\end{bmatrix}$: the two eigenlines stay **perpendicular** and never disappear.`,
      jugar: {
        botones: [
          { label: 'b = 0', hacer: v => { v.b = 0; } },
          { label: { es: 'a = d, b = 0', en: 'a = d, b = 0' }, hacer: v => { v.a = 1.5; v.d = 1.5; v.b = 0; } },
          { label: { es: 'indefinida', en: 'indefinite' }, hacer: v => { v.a = 1; v.b = 2; v.d = 1; } },
        ],
        lecturas: (v, cx) => {
          const E = cx.eig2([[v.a, v.b], [v.b, v.d]]), disc = ((v.a - v.d) / 2) ** 2 + v.b * v.b;
          const ang = E.reales && E.v2 && !E.doble ? Math.acos(Math.min(1, Math.abs(E.v1[0] * E.v2[0] + E.v1[1] * E.v2[1]))) * 180 / Math.PI : NaN;
          return [
            { expr: '$\\lambda_1,\\lambda_2$', valor: lamTxt(E, cx) },
            { expr: { es: 'discriminante $\\left(\\tfrac{a-d}{2}\\right)^2+b^2$', en: 'discriminant $\\left(\\tfrac{a-d}{2}\\right)^2+b^2$' }, valor: cx.fmt(disc) },
            { expr: { es: 'ángulo entre rectas', en: 'angle between lines' }, valor: Number.isFinite(ang) ? `${cx.fmt(+ang.toFixed(1))}°` : '—' },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: `Por qué siempre son reales en $2\\times2$: el discriminante de $p(\\lambda)$ es $\\left(\\tfrac{a-d}{2}\\right)^2+b^2\\ge0$, y solo vale $0$ si $a=d$ y $b=0$, es decir, si $${A}=a${I}$. Consecuencia directa del teorema: $${A}=${B('P')}${B('D')}${B('P')}^\\top$, con $${B('D')}$ diagonal de valores propios y $${B('P')}$ ortogonal, cuyas columnas son la base ortonormal propia (MML §4.2).`,
      en: `Why they are always real in $2\\times2$: the discriminant of $p(\\lambda)$ is $\\left(\\tfrac{a-d}{2}\\right)^2+b^2\\ge0$, and it is $0$ only if $a=d$ and $b=0$, i.e. if $${A}=a${I}$. A direct consequence of the theorem: $${A}=${B('P')}${B('D')}${B('P')}^\\top$, with $${B('D')}$ the diagonal of eigenvalues and $${B('P')}$ orthogonal, its columns being the orthonormal eigenbasis (MML §4.2).` },

    // ── det y traza con valores propios ──
    { sec: { es: 'Det y traza con valores propios', en: 'Det and trace via eigenvalues' },
      es: `**Teoremas 4.16 y 4.17.** $\\det(${A})=\\prod_{i=1}^n\\lambda_i$ (ec. 4.42) y $\\operatorname{tr}(${A})=\\sum_{i=1}^n\\lambda_i$ (ec. 4.43), con los $\\lambda_i\\in\\mathbb{C}$ repetidos según su multiplicidad. En $2\\times2$ basta comparar $(\\lambda-\\lambda_1)(\\lambda-\\lambda_2)=\\lambda^2-(\\lambda_1+\\lambda_2)\\lambda+\\lambda_1\\lambda_2$ con $\\lambda^2-\\operatorname{tr}(${A})\\lambda+\\det(${A})$.`,
      en: `**Theorems 4.16 and 4.17.** $\\det(${A})=\\prod_{i=1}^n\\lambda_i$ (eq. 4.42) and $\\operatorname{tr}(${A})=\\sum_{i=1}^n\\lambda_i$ (eq. 4.43), with the $\\lambda_i\\in\\mathbb{C}$ repeated according to multiplicity. In $2\\times2$ just compare $(\\lambda-\\lambda_1)(\\lambda-\\lambda_2)=\\lambda^2-(\\lambda_1+\\lambda_2)\\lambda+\\lambda_1\\lambda_2$ with $\\lambda^2-\\operatorname{tr}(${A})\\lambda+\\det(${A})$.` },
    { es: `**Intuición (MML Fig. 4.6).** Si los vectores propios forman una base ortonormal, $${A}$ estira el cuadrado unidad $|\\lambda_1|$ veces en una dirección propia y $|\\lambda_2|$ en la otra. El área se multiplica por $|\\lambda_1\\lambda_2|=|\\det(${A})|$ y el perímetro, por $\\tfrac12(|\\lambda_1|+|\\lambda_2|)$. Las lecturas del paso interactivo anterior ya lo comprobaban numéricamente.`,
      en: `**Intuition (MML Fig. 4.6).** If the eigenvectors form an orthonormal basis, $${A}$ stretches the unit square $|\\lambda_1|$ times along one eigendirection and $|\\lambda_2|$ along the other. Area is multiplied by $|\\lambda_1\\lambda_2|=|\\det(${A})|$ and the perimeter by $\\tfrac12(|\\lambda_1|+|\\lambda_2|)$. The readouts of the earlier interactive step already checked it numerically.` },
    { es: `$${A}\\in\\mathbb{R}^{2\\times2}$ tiene $\\operatorname{tr}(${A})=0$ y $\\det(${A})=-4$. ¿Cuáles son sus valores propios?`,
      en: `$${A}\\in\\mathbb{R}^{2\\times2}$ has $\\operatorname{tr}(${A})=0$ and $\\det(${A})=-4$. What are its eigenvalues?`,
      pregunta: {
        opc: [{ es: '$2$ y $-2$', en: '$2$ and $-2$', ok: 1 }, { es: '$2i$ y $-2i$', en: '$2i$ and $-2i$' }, { es: '$4$ y $-1$', en: '$4$ and $-1$' }],
        why: {
          es: '$p(\\lambda)=\\lambda^2-0\\cdot\\lambda+(-4)=\\lambda^2-4$, con raíces $\\pm2$. Comprobación: suma $0=\\operatorname{tr}$, producto $-4=\\det$. Con $\\pm2i$ el producto sería $+4$; con $4$ y $-1$ la suma sería $3$.',
          en: '$p(\\lambda)=\\lambda^2-0\\cdot\\lambda+(-4)=\\lambda^2-4$, with roots $\\pm2$. Check: sum $0=\\operatorname{tr}$, product $-4=\\det$. With $\\pm2i$ the product would be $+4$; with $4$ and $-1$ the sum would be $3$.',
        },
      } },

    // ── Código y ML ──
    { sec: { es: 'En código', en: 'In code' },
      code: `import numpy as np
A = np.array([[3., 1.], [2., 2.]])
print(np.linalg.det(A), np.trace(A))     # ≈ 4.0  5.0
lam, P = np.linalg.eig(A)                # columnas de P: vectores propios
print(lam)                               # 4 y 1 (orden no garantizado)
print(np.allclose(A @ P, P * lam))       # A p_i = λ_i p_i  -> True
print(np.isclose(lam.prod(), np.linalg.det(A)), np.isclose(lam.sum(), np.trace(A)))
S = np.array([[2., 1.], [1., 2.]])
w, Q = np.linalg.eigh(S)                 # simétrica: λ reales, Q ortogonal
print(w, np.allclose(Q.T @ Q, np.eye(2)))  # [1. 3.] True`, line: null,
      es: `Ejemplo mínimo en NumPy. \`eig\` sirve para cualquier matriz cuadrada; \`eigh\`, para simétricas: es más estable y devuelve los valores propios reales en orden **ascendente**, al revés que la convención de ordenarlos de mayor a menor. \`np.linalg.det\` usa una factorización LU, no Laplace.`,
      en: `A minimal NumPy example. \`eig\` works for any square matrix; \`eigh\` is for symmetric ones: it is more stable and returns the real eigenvalues in **ascending** order, the opposite of the largest-first convention. \`np.linalg.det\` uses an LU factorization, not Laplace.` },
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' }, code: '', line: null,
      es: `**Dónde aparece en ML.** PCA (MML §10.2) toma como direcciones principales los vectores propios de la matriz de covarianza de los datos con mayores valores propios; el Teorema 4.15 garantiza que son reales y ortogonales. La densidad gaussiana multivariante (§6.5) lleva $\\det(${B('\\Sigma')})$ en su constante de normalización. Y PageRank es un vector propio (MML Ej. 4.9).`,
      en: `**Where it shows up in ML.** PCA (MML §10.2) takes as principal directions the eigenvectors of the data covariance matrix with the largest eigenvalues; Theorem 4.15 guarantees they are real and orthogonal. The multivariate Gaussian density (§6.5) carries $\\det(${B('\\Sigma')})$ in its normalizing constant. And PageRank is an eigenvector (MML Ex. 4.9).` },
    { es: `**Resumen.** $\\det$: área o volumen con signo; $\\neq0\\iff$ invertible $\\iff$ rango completo. $\\operatorname{tr}$: suma de la diagonal, invariante cíclica. $p_{${A}}(\\lambda)=\\det(${A}-\\lambda${I})$: sus raíces son los valores propios y $E_\\lambda=\\ker(${A}-\\lambda${I})$. $\\det=\\prod\\lambda_i$ y $\\operatorname{tr}=\\sum\\lambda_i$. Simétrica: $\\lambda$ reales y base ortonormal propia.`,
      en: `**Summary.** $\\det$: signed area or volume; $\\neq0\\iff$ invertible $\\iff$ full rank. $\\operatorname{tr}$: sum of the diagonal, cyclically invariant. $p_{${A}}(\\lambda)=\\det(${A}-\\lambda${I})$: its roots are the eigenvalues and $E_\\lambda=\\ker(${A}-\\lambda${I})$. $\\det=\\prod\\lambda_i$ and $\\operatorname{tr}=\\sum\\lambda_i$. Symmetric: real $\\lambda$ and an orthonormal eigenbasis. Next: factorizing matrices.` },
  ],
};
