// Guía «Proyecciones ortogonales y rotaciones» (Álgebra lineal, lección 6). Sigue MML §3.8 (proyección sobre rectas y sobre
// subespacios, ecuación normal, Gram-Schmidt, proyección sobre subespacios afines) y §3.9 (rotaciones en ℝ², ℝ³ y de Givens).
// Escena `vectores` (capas `proyeccion`, `rejilla`…; formato en la cabecera de assets/guias/vectores.js); formato de los pasos en
// data/punteros.js. Ejemplos propios; las fórmulas se citan por su número en MML. \bm = \boldsymbol en KaTeX.
const R = String.raw;
const B = x => R`\bm{${x}}`;
const X = B('x'), b = B('b'), Bm = B('B'), P = R`\bm{P}_\pi`, Zr = B('0'), u = B('u'), I = B('I'), lam = R`\boldsymbol{\lambda}`, w = B('w');
const p2 = (cx, p) => `(${cx.fmt(+p[0].toFixed(3))} ; ${cx.fmt(+p[1].toFixed(3))})`;
const soltar = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };
const MML = 'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com';
const mat3 = (...f) => R`\begin{bmatrix}${f.map(r => r.join('&')).join(R`\\`)}\end{bmatrix}`;
const col = (...v) => R`\begin{bmatrix}${v.join(R`\\`)}\end{bmatrix}`;

// ── Escena 1: proyección sobre una recta (con producto interno ajustable) ──
const PROY = { tipo: 'proyeccion', x: 'x', sobre: 'b', A: [['a', 'c'], ['c', 'd']] };
const FX = { tipo: 'flecha', a: 'x' }, FB = { tipo: 'flecha', a: 'b' };
const E_RECTA = {
  x: [-1, 4.4], y: [-0.9, 3], vec: { x: [1.5, 2.5], b: [3, 1] }, arrastrar: ['x', 'b'], paso: 0.25, par: { a: 1, c: 0, d: 1 },
  capas: [PROY, FB, FX], etiqueta: { es: 'Proyección ortogonal de x sobre la recta generada por b', en: 'Orthogonal projection of x onto the line spanned by b' },
};
// ── Escena 2: Gram-Schmidt en ℝ² (traza: u1 := b1; proyectar b2; restar; normalizar) ──
const FB1 = { tipo: 'flecha', a: 'b1' }, FB2 = { tipo: 'flecha', a: 'b2' }, FU1 = { tipo: 'flecha', a: 'u1' }, FU2 = { tipo: 'flecha', a: 'u2' };
const PGS = { tipo: 'proyeccion', x: 'b2', sobre: 'u1', nombre: R`$\pi(${b}_2)$` };
const r10 = Math.sqrt(10), r25 = Math.sqrt(2.5);
const E_GS = {
  x: [-1.4, 3.6], y: [-0.6, 2.6], vec: { b1: [3, 1], b2: [1, 2], u1: [3, 1], u2: [1, 2] }, arrastrar: ['b1', 'b2'], paso: 0.25,
  capas: [FB1, FB2], etiqueta: { es: 'Ortogonalización de Gram-Schmidt de b1 y b2', en: 'Gram-Schmidt orthogonalisation of b1 and b2' },
};
// ── Escena 3: proyección sobre una recta afín L = x0 + span[b] ──
const E_AF = {
  x: [-1.2, 4], y: [-0.6, 3.4], vec: { x: [2.5, 2.6], x0: [0, 2], b: [2, -1] }, arrastrar: ['x', 'x0'], paso: 0.1,
  capas: [{ tipo: 'flecha', a: 'x0', nombre: R`$${X}_0$` }, { tipo: 'flecha', a: 'b', de: 'x0' }, FX,
    { tipo: 'proyeccion', x: 'x', sobre: 'b', de: 'x0', nombre: R`$\pi_L(${X})$` }],
  etiqueta: { es: 'Recta afín x0 + span[b] y la proyección de x sobre ella', en: 'Affine line x0 + span[b] and the projection of x onto it' },
};
// ── Escena 4: rotación R(θ) ──
const rot = (v, g) => { const t = g * Math.PI / 180; v.t = g; v.c = Math.cos(t); v.s = Math.sin(t); v.ns = -Math.sin(t); };
const E_ROT = {
  x: [-2.2, 2.2], y: [-1.8, 1.8], vec: { x: [1.5, 0.5], y: [0.5, 1.2] }, arrastrar: ['x', 'y'], paso: 0.25,
  par: { t: 30, c: Math.cos(Math.PI / 6), s: 0.5, ns: -0.5 },
  capas: [{ tipo: 'rejilla', m: [['c', 'ns'], ['s', 'c']] }, { tipo: 'flecha', a: 'x' }, { tipo: 'flecha', a: 'y' }],
  etiqueta: { es: 'Rejilla rotada por R(θ) y dos vectores', en: 'Grid rotated by R(θ) and two vectors' },
};

export default {
  titulo: { es: 'Proyecciones ortogonales y rotaciones', en: 'Orthogonal projections and rotations' },
  fuentes: [MML],
  pasos: [
    // ── Motivación ──
    { sec: { es: 'Qué problema resuelve', en: 'What problem this solves' }, vectores: E_RECTA, leyenda: ['camino', 'mal'],
      es: R`Los datos de ML suelen vivir en muchas dimensiones, pero casi toda la información cabe en unas pocas. Para comprimir o visualizar hay que llevar cada dato a un subespacio de menor dimensión **perdiendo lo mínimo**: el punto del subespacio más cercano al dato. Eso es la **proyección ortogonal** (MML §3.8), y la usan PCA (§10), la regresión lineal (§9) y la SVM (§12).`,
      en: R`ML data usually lives in many dimensions, but almost all the information fits in a few. To compress or visualise, each data point must be brought into a lower-dimensional subspace **losing as little as possible**: the point of the subspace closest to it. That is the **orthogonal projection** (MML §3.8), used by PCA (§10), linear regression (§9) and the SVM (§12).` },
    { es: R`La solución ingenua, «borrar coordenadas» (poner $x_2=0$), solo da el punto más cercano si el subespacio es un **eje** y se mide con el producto escalar. Sobre la recta generada por $${b}=(3,1)$ no sirve: hay que buscar $\pi_U(${X})\in U$ con $\|${X}-\pi_U(${X})\|$ **mínima**. La escena ya la dibuja: arrastra $${X}$ y $${b}$.`,
      en: R`The naive solution, "delete coordinates" (set $x_2=0$), only gives the closest point if the subspace is an **axis** and we measure with the dot product. On the line spanned by $${b}=(3,1)$ it fails: we need $\pi_U(${X})\in U$ with **minimal** $\|${X}-\pi_U(${X})\|$. The scene already draws it: drag $${X}$ and $${b}$.` },
    { es: R`**Def. 3.10 (proyección).** Sea $U\subseteq V$ un subespacio. Una aplicación lineal $\pi:V\to U$ es una **proyección** si $\pi^2=\pi\circ\pi=\pi$. Como las aplicaciones lineales tienen matriz (§2.7), sus **matrices de proyección** cumplen $${P}^2=${P}$. **Intuición:** proyectar algo ya proyectado no lo mueve. Mientras no se diga otra cosa, $\langle${X},${B('y')}\rangle=${X}^\top${B('y')}$.`,
      en: R`**Def. 3.10 (projection).** Let $U\subseteq V$ be a subspace. A linear mapping $\pi:V\to U$ is a **projection** if $\pi^2=\pi\circ\pi=\pi$. Since linear mappings have matrices (§2.7), their **projection matrices** satisfy $${P}^2=${P}$. **Intuition:** projecting something already projected does not move it. Unless stated otherwise, $\langle${X},${B('y')}\rangle=${X}^\top${B('y')}$.` },

    // ── MML §3.8.1 Recta ──
    { sec: { es: 'Proyección sobre una recta', en: 'Projection onto a line' },
      es: R`Sea $U=\operatorname{span}[${b}]\subseteq\mathbb{R}^n$, una recta por el origen (MML §3.8.1). Dos condiciones fijan $\pi_U(${X})$. (1) Está en $U$: $\pi_U(${X})=\lambda${b}$ para algún $\lambda\in\mathbb{R}$. (2) Es el punto **más cercano**, y eso obliga a que el segmento $${X}-\pi_U(${X})$ sea ortogonal a $U$, es decir, a $${b}$.`,
      en: R`Let $U=\operatorname{span}[${b}]\subseteq\mathbb{R}^n$, a line through the origin (MML §3.8.1). Two conditions pin down $\pi_U(${X})$. (1) It lies in $U$: $\pi_U(${X})=\lambda${b}$ for some $\lambda\in\mathbb{R}$. (2) It is the **closest** point, which forces the segment $${X}-\pi_U(${X})$ to be orthogonal to $U$, that is, to $${b}$.` },
    { es: R`**Paso 1, la coordenada.** La ortogonalidad da $\langle${X}-\lambda${b},${b}\rangle=0$ (ec. 3.39). Por bilinealidad, $\langle${X},${b}\rangle-\lambda\langle${b},${b}\rangle=0$, de donde $\lambda=\frac{\langle${X},${b}\rangle}{\langle${b},${b}\rangle}=\frac{\langle${b},${X}\rangle}{\|${b}\|^2}$ (ec. 3.40), donde el último paso usa la simetría del producto interno.`,
      en: R`**Step 1, the coordinate.** Orthogonality gives $\langle${X}-\lambda${b},${b}\rangle=0$ (eq. 3.39). By bilinearity, $\langle${X},${b}\rangle-\lambda\langle${b},${b}\rangle=0$, hence $\lambda=\frac{\langle${X},${b}\rangle}{\langle${b},${b}\rangle}=\frac{\langle${b},${X}\rangle}{\|${b}\|^2}$ (eq. 3.40), where the last step uses the symmetry of the inner product.` },
    { es: R`Con el producto escalar, $\lambda=\frac{${b}^\top${X}}{${b}^\top${b}}=\frac{${b}^\top${X}}{\|${b}\|^2}$ (ec. 3.41). Si $\|${b}\|=1$, simplemente $\lambda=${b}^\top${X}$: la coordenada de la proyección sobre un vector unitario es un producto escalar. Es lo que ya viste con las bases ortonormales.`,
      en: R`With the dot product, $\lambda=\frac{${b}^\top${X}}{${b}^\top${b}}=\frac{${b}^\top${X}}{\|${b}\|^2}$ (eq. 3.41). If $\|${b}\|=1$, simply $\lambda=${b}^\top${X}$: the coordinate of the projection onto a unit vector is a dot product. You already saw this with orthonormal bases.` },
    { es: R`**Paso 2, el punto.** $\pi_U(${X})=\lambda${b}=\frac{${b}^\top${X}}{\|${b}\|^2}${b}$ (ec. 3.42), con longitud $\|\pi_U(${X})\|=|\lambda|\,\|${b}\|$ (ec. 3.43). Usando (3.25), $\|\pi_U(${X})\|=|\cos\omega|\,\|${X}\|$ (ec. 3.44), con $\omega$ el ángulo entre $${X}$ y $${b}$: la trigonometría de siempre. $\lambda$ es la **coordenada** de la proyección respecto a $${b}$.`,
      en: R`**Step 2, the point.** $\pi_U(${X})=\lambda${b}=\frac{${b}^\top${X}}{\|${b}\|^2}${b}$ (eq. 3.42), with length $\|\pi_U(${X})\|=|\lambda|\,\|${b}\|$ (eq. 3.43). Using (3.25), $\|\pi_U(${X})\|=|\cos\omega|\,\|${X}\|$ (eq. 3.44), with $\omega$ the angle between $${X}$ and $${b}$: plain trigonometry. $\lambda$ is the **coordinate** of the projection with respect to $${b}$.` },
    { es: R`**Paso 3, la matriz.** Reordenando, $\pi_U(${X})=${b}\lambda=\frac{${b}${b}^\top}{\|${b}\|^2}${X}$ (ec. 3.45), así que $${P}=\frac{${b}${b}^\top}{\|${b}\|^2}$ (ec. 3.46). Es **simétrica** y de **rango 1**. La proyección sigue siendo un vector de $\mathbb{R}^n$, pero basta un número, $\lambda$, para describirla dentro de $U$.`,
      en: R`**Step 3, the matrix.** Rearranging, $\pi_U(${X})=${b}\lambda=\frac{${b}${b}^\top}{\|${b}\|^2}${X}$ (eq. 3.45), so $${P}=\frac{${b}${b}^\top}{\|${b}\|^2}$ (eq. 3.46). It is **symmetric** and of **rank 1**. The projection is still a vector of $\mathbb{R}^n$, but one number, $\lambda$, is enough to describe it inside $U$.` },
    { es: R`Arrastra $${X}$ y $${b}$. Las lecturas comprueban las tres piezas: $\lambda$ de (3.41), el punto de (3.42) y que el error $${X}-\pi_U(${X})$ es ortogonal a $${b}$. Fíjate en que $\pi_U(${X})$ **no cambia** al escalar $${b}$ (prueba «2b»): depende de la recta, no del vector que la genera; lo que cambia es $\lambda$.`,
      en: R`Drag $${X}$ and $${b}$. The readouts check all three pieces: $\lambda$ from (3.41), the point from (3.42) and that the error $${X}-\pi_U(${X})$ is orthogonal to $${b}$. Notice that $\pi_U(${X})$ **does not change** when $${b}$ is scaled (try "2b"): it depends on the line, not on the vector spanning it; what changes is $\lambda$.`,
      jugar: {
        botones: [
          { label: '2b', hacer: v => { v.vec.b = [2 * v.vec.b[0], 2 * v.vec.b[1]]; } },
          { label: 'b/2', hacer: v => { v.vec.b = [v.vec.b[0] / 2, v.vec.b[1] / 2]; } },
          { label: { es: 'x ⊥ b', en: 'x ⊥ b' }, hacer: v => { v.vec.x = [-v.vec.b[1], v.vec.b[0]]; } },
          { label: { es: 'de nuevo', en: 'reset' }, hacer: v => { v.vec.x = [1.5, 2.5]; v.vec.b = [3, 1]; } },
        ],
        lecturas: (v, cx) => {
          const x = v.vec.x, bb = v.vec.b, l = cx.dot(bb, x) / cx.dot(bb, bb), q = [l * bb[0], l * bb[1]], e = [x[0] - q[0], x[1] - q[1]];
          return [
            { expr: R`$\lambda=\frac{${b}^\top${X}}{${b}^\top${b}}$`, valor: Number.isFinite(l) ? cx.fmt(+l.toFixed(3)) : '—' },
            { expr: R`$\pi_U(${X})$`, valor: Number.isFinite(l) ? p2(cx, q) : '—' },
            { expr: R`$\langle${X}-\pi_U(${X}),${b}\rangle$`, valor: Number.isFinite(l) ? cx.fmt(+cx.dot(e, bb).toFixed(6)) : '—' },
            { expr: R`$\|${X}-\pi_U(${X})\|$`, valor: Number.isFinite(l) ? cx.fmt(+cx.norma(e).toFixed(3)) : '—' },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: R`Si $${X}\perp${b}$ (y $${b}\neq${Zr}$), ¿qué vale $\pi_U(${X})$ sobre $U=\operatorname{span}[${b}]$?`,
      en: R`If $${X}\perp${b}$ (and $${b}\neq${Zr}$), what is $\pi_U(${X})$ onto $U=\operatorname{span}[${b}]$?`,
      pregunta: {
        opc: [
          { es: R`$${Zr}$`, en: R`$${Zr}$`, ok: 1 },
          { es: R`$${X}$`, en: R`$${X}$` },
          { es: R`No está definida`, en: R`It is undefined` },
        ],
        why: {
          es: R`$${b}^\top${X}=0$ da $\lambda=0$ y $\pi_U(${X})=${Zr}$: todo $${X}$ es «error», ortogonal a la recta. El caso opuesto es $${X}\in U$: entonces $\pi_U(${X})=${X}$ y el error es nulo. La proyección solo deja de estar definida si $${b}=${Zr}$, porque se dividiría por $\|${b}\|^2=0$.`,
          en: R`$${b}^\top${X}=0$ gives $\lambda=0$ and $\pi_U(${X})=${Zr}$: all of $${X}$ is "error", orthogonal to the line. The opposite case is $${X}\in U$: then $\pi_U(${X})=${X}$ and the error is zero. The projection is only undefined if $${b}=${Zr}$, because we would divide by $\|${b}\|^2=0$.`,
        },
      } },
    { es: R`Ejemplo propio en $\mathbb{R}^3$: $${b}=(2,-1,2)^\top$, $\|${b}\|^2=9$ y $${P}=\frac19${mat3([4, -2, 4], [-2, 1, -2], [4, -2, 4])}$. Para $${X}=(1,1,1)^\top$: $${b}^\top${X}=3$, $\lambda=\tfrac13$ y $\pi_U(${X})=\tfrac13(2,-1,2)^\top$. El error $\tfrac13(1,4,1)^\top$ cumple $${b}^\top(\cdot)=\tfrac13(2-4+2)=0$. Y $${P}\pi_U(${X})=\pi_U(${X})$, como pide $${P}^2=${P}$.`,
      en: R`Our own example in $\mathbb{R}^3$: $${b}=(2,-1,2)^\top$, $\|${b}\|^2=9$ and $${P}=\frac19${mat3([4, -2, 4], [-2, 1, -2], [4, -2, 4])}$. For $${X}=(1,1,1)^\top$: $${b}^\top${X}=3$, $\lambda=\tfrac13$ and $\pi_U(${X})=\tfrac13(2,-1,2)^\top$. The error $\tfrac13(1,4,1)^\top$ gives $${b}^\top(\cdot)=\tfrac13(2-4+2)=0$, and $${P}\pi_U(${X})=\pi_U(${X})$ since $${P}^2=${P}$.` },
    { es: R`Con otro producto interno, (3.40) sigue valiendo: $\lambda=\langle${X},${b}\rangle/\langle${b},${b}\rangle$, y el error es ortogonal **en ese** producto. Pulsa «⟨·,·⟩ = xᵀAy» con $${B('A')}=\begin{bmatrix}2&1\\1&3\end{bmatrix}$: el punto proyectado se desplaza y la marca de ángulo recto se tuerce. «Más cercano» se mide ahora con $\|\cdot\|_{${B('A')}}$ (MML §3.8.2).`,
      en: R`With another inner product, (3.40) still holds: $\lambda=\langle${X},${b}\rangle/\langle${b},${b}\rangle$, and the error is orthogonal **in that** product. Press "⟨·,·⟩ = xᵀAy" with $${B('A')}=\begin{bmatrix}2&1\\1&3\end{bmatrix}$: the projected point shifts and the right-angle mark skews. "Closest" is now measured with $\|\cdot\|_{${B('A')}}$ (MML §3.8.2).`,
      jugar: {
        botones: [
          { label: { es: 'producto escalar', en: 'dot product' }, hacer: v => { v.a = 1; v.c = 0; v.d = 1; } },
          { label: '⟨·,·⟩ = xᵀAy', hacer: v => { v.a = 2; v.c = 1; v.d = 3; } },
        ],
        lecturas: (v, cx) => {
          const M = [[v.a, v.c], [v.c, v.d]], q = cx.proy(v.vec.x, [v.vec.b], M), e = [v.vec.x[0] - q[0], v.vec.x[1] - q[1]];
          return [
            { expr: R`$\pi_U(${X})$`, valor: p2(cx, q) },
            { expr: R`$\langle${X}-\pi_U(${X}),${b}\rangle$`, valor: cx.fmt(+cx.dot(e, v.vec.b, M).toFixed(6)) },
            { expr: R`$(${X}-\pi_U(${X}))^\top${b}$`, valor: cx.fmt(+cx.dot(e, v.vec.b).toFixed(3)) },
          ];
        },
        arrastrables: true, soltar,
      } },

    // ── MML §3.8.2 Subespacios generales ──
    { sec: { es: 'Proyección sobre un subespacio', en: 'Projection onto a subspace' },
      es: R`Ahora $U\subseteq\mathbb{R}^n$ con $\dim U=m\ge1$ y base ordenada $(${b}_1,\dots,${b}_m)$, que se coloca en las columnas de $${Bm}=[${b}_1,\dots,${b}_m]\in\mathbb{R}^{n\times m}$ (MML §3.8.2). Si te dan un generador que no es base, primero hay que extraer una base (§2.6). Como $\pi_U(${X})\in U$: $\pi_U(${X})=\sum_{i=1}^m\lambda_i${b}_i=${Bm}${lam}$.`,
      en: R`Now $U\subseteq\mathbb{R}^n$ with $\dim U=m\ge1$ and ordered basis $(${b}_1,\dots,${b}_m)$, placed in the columns of $${Bm}=[${b}_1,\dots,${b}_m]\in\mathbb{R}^{n\times m}$ (MML §3.8.2). If you are given a generating set that is not a basis, extract a basis first (§2.6). Since $\pi_U(${X})\in U$: $\pi_U(${X})=\sum_{i=1}^m\lambda_i${b}_i=${Bm}${lam}$.` },
    { es: R`El error debe ser ortogonal a **cada** vector de la base: $${b}_i^\top(${X}-\pi_U(${X}))=0$ para $i=1,\dots,m$ (ec. 3.51–3.52), es decir, $${b}_i^\top(${X}-${Bm}${lam})=0$ (ec. 3.53–3.54). Apilando las $m$ condiciones: $${Bm}^\top(${X}-${Bm}${lam})=${Zr}\iff${Bm}^\top${Bm}${lam}=${Bm}^\top${X}$ (ec. 3.55–3.56), la **ecuación normal**.`,
      en: R`The error must be orthogonal to **each** basis vector: $${b}_i^\top(${X}-\pi_U(${X}))=0$ for $i=1,\dots,m$ (eq. 3.51–3.52), that is, $${b}_i^\top(${X}-${Bm}${lam})=0$ (eq. 3.53–3.54). Stacking the $m$ conditions: $${Bm}^\top(${X}-${Bm}${lam})=${Zr}\iff${Bm}^\top${Bm}${lam}=${Bm}^\top${X}$ (eq. 3.55–3.56), the **normal equation**.` },
    { es: R`Como los $${b}_i$ son independientes, $${Bm}^\top${Bm}\in\mathbb{R}^{m\times m}$ es regular y $${lam}=(${Bm}^\top${Bm})^{-1}${Bm}^\top${X}$ (ec. 3.57). La matriz $(${Bm}^\top${Bm})^{-1}${Bm}^\top$ es la **pseudoinversa** de $${Bm}$: existe aunque $${Bm}$ no sea cuadrada, siempre que tenga rango completo, porque entonces $${Bm}^\top${Bm}$ es DP.`,
      en: R`Since the $${b}_i$ are independent, $${Bm}^\top${Bm}\in\mathbb{R}^{m\times m}$ is regular and $${lam}=(${Bm}^\top${Bm})^{-1}${Bm}^\top${X}$ (eq. 3.57). The matrix $(${Bm}^\top${Bm})^{-1}${Bm}^\top$ is the **pseudo-inverse** of $${Bm}$: it exists even if $${Bm}$ is not square, as long as it has full rank, because then $${Bm}^\top${Bm}$ is PD.` },
    { es: R`En la práctica (por ejemplo, en regresión lineal) se suma un pequeño «jitter» $\epsilon${I}$ a $${Bm}^\top${Bm}$: garantiza que sea DP y mejora la estabilidad numérica. Ese término es la regularización de cresta (*ridge*), que el cap. 9 deriva por inferencia bayesiana.`,
      en: R`In practice (for example, in linear regression) a small "jitter" $\epsilon${I}$ is added to $${Bm}^\top${Bm}$: it guarantees positive definiteness and improves numerical stability. That term is ridge regularisation, which ch. 9 derives with Bayesian inference.` },
    { es: R`Entonces $\pi_U(${X})=${Bm}${lam}=${Bm}(${Bm}^\top${Bm})^{-1}${Bm}^\top${X}$ (ec. 3.58) y $${P}=${Bm}(${Bm}^\top${Bm})^{-1}${Bm}^\top$ (ec. 3.59). Con $m=1$, $${Bm}^\top${Bm}=${b}^\top${b}$ es un escalar y sale (3.46). Y $${P}^2=${P}$: el factor central $(${Bm}^\top${Bm})^{-1}${Bm}^\top${Bm}$ es $${I}$.`,
      en: R`Then $\pi_U(${X})=${Bm}${lam}=${Bm}(${Bm}^\top${Bm})^{-1}${Bm}^\top${X}$ (eq. 3.58) and $${P}=${Bm}(${Bm}^\top${Bm})^{-1}${Bm}^\top$ (eq. 3.59). With $m=1$, $${Bm}^\top${Bm}=${b}^\top${b}$ is a scalar and we get (3.46). And $${P}^2=${P}$: the middle factor $(${Bm}^\top${Bm})^{-1}${Bm}^\top${Bm}$ is $${I}$.` },
    { es: R`Ejemplo propio: $U=\operatorname{span}[(1,0,1)^\top,(0,1,1)^\top]$, $${X}=(1,2,0)^\top$. Así $${Bm}=${mat3([1, 0], [0, 1], [1, 1])}$, $${Bm}^\top${Bm}=${mat3([2, 1], [1, 2])}$ y $${Bm}^\top${X}=${col(1, 2)}$. La ecuación normal da $${lam}=\tfrac13${mat3([2, -1], [-1, 2])}${col(1, 2)}=${col(0, 1)}$.`,
      en: R`Our own example: $U=\operatorname{span}[(1,0,1)^\top,(0,1,1)^\top]$, $${X}=(1,2,0)^\top$. Then $${Bm}=${mat3([1, 0], [0, 1], [1, 1])}$, $${Bm}^\top${Bm}=${mat3([2, 1], [1, 2])}$ and $${Bm}^\top${X}=${col(1, 2)}$. The normal equation: $${lam}=\tfrac13${mat3([2, -1], [-1, 2])}${col(1, 2)}=${col(0, 1)}$.` },
    { es: R`Así $\pi_U(${X})=${Bm}${lam}=(0,1,1)^\top$. El error $${X}-\pi_U(${X})=(1,1,-1)^\top$ es ortogonal a $(1,0,1)$ y a $(0,1,1)$ (los dos productos dan $0$), y mide $\sqrt3$. La matriz es $${P}=\tfrac13${mat3([2, -1, 1], [-1, 2, 1], [1, 1, 2])}$, y $${P}${X}=\tfrac13(0,3,3)^\top$ coincide.`,
      en: R`So $\pi_U(${X})=${Bm}${lam}=(0,1,1)^\top$. The error $${X}-\pi_U(${X})=(1,1,-1)^\top$ is orthogonal to $(1,0,1)$ and to $(0,1,1)$ (both products give $0$), and has length $\sqrt3$. The matrix is $${P}=\tfrac13${mat3([2, -1, 1], [-1, 2, 1], [1, 1, 2])}$, and $${P}${X}=\tfrac13(0,3,3)^\top$ agrees.` },
    { es: R`$\|${X}-\pi_U(${X})\|$ es el **error de proyección** o **de reconstrucción** (ec. 3.63); minimizarlo es una forma de derivar PCA (MML §10.3). Y si $${B('A')}${X}=${b}$ no tiene solución porque $${b}$ no está en el espacio columna de $${B('A')}$, proyectar $${b}$ sobre ese espacio da la **solución por mínimos cuadrados** (MML §9.4).`,
      en: R`$\|${X}-\pi_U(${X})\|$ is the **projection error** or **reconstruction error** (eq. 3.63); minimising it is one way to derive PCA (MML §10.3). And if $${B('A')}${X}=${b}$ has no solution because $${b}$ is not in the column space of $${B('A')}$, projecting $${b}$ onto that space gives the **least-squares solution** (MML §9.4).` },
    { es: R`**Con una base ortonormal** todo se simplifica: $${Bm}^\top${Bm}=${I}$, luego $\pi_U(${X})=${Bm}${Bm}^\top${X}$ (ec. 3.65) y $${lam}=${Bm}^\top${X}$ (ec. 3.66), sin invertir nada. Por eso interesa ortonormalizar una base antes de proyectar, que es justo lo que hace Gram-Schmidt.`,
      en: R`**With an orthonormal basis** everything simplifies: $${Bm}^\top${Bm}=${I}$, so $\pi_U(${X})=${Bm}${Bm}^\top${X}$ (eq. 3.65) and $${lam}=${Bm}^\top${X}$ (eq. 3.66), with nothing to invert. That is why it pays to orthonormalise a basis before projecting, which is exactly what Gram-Schmidt does.` },
    { es: R`Sea $${P}$ la proyección ortogonal de $\mathbb{R}^n$ sobre un subespacio $U$ con $\dim U=m<n$. ¿Es $${P}$ invertible?`,
      en: R`Let $${P}$ be the orthogonal projection of $\mathbb{R}^n$ onto a subspace $U$ with $\dim U=m<n$. Is $${P}$ invertible?`,
      pregunta: {
        opc: [
          { es: R`No: $\operatorname{rk}(${P})=m<n$ y todo $${X}\in U^\perp$ va a $${Zr}$`, en: R`No: $\operatorname{rk}(${P})=m<n$ and every $${X}\in U^\perp$ goes to $${Zr}$`, ok: 1 },
          { es: R`Sí, porque $${P}^2=${P}$ implica $${P}=${I}$`, en: R`Yes, because $${P}^2=${P}$ implies $${P}=${I}$` },
          { es: R`Sí, porque es simétrica`, en: R`Yes, because it is symmetric` },
        ],
        why: {
          es: R`La imagen de $${P}$ es $U$, de dimensión $m$, así que por rango-nulidad $\dim\ker${P}=n-m\ge1$; el núcleo es $U^\perp$. De $${P}^2=${P}$ solo se deduce $${P}=${I}$ si $${P}$ es invertible, que es justo lo que no pasa. Simétrica no implica invertible: la matriz nula es simétrica.`,
          en: R`The image of $${P}$ is $U$, of dimension $m$, so by rank-nullity $\dim\ker${P}=n-m\ge1$; the kernel is $U^\perp$. From $${P}^2=${P}$ one only gets $${P}=${I}$ if $${P}$ is invertible, which is precisely what fails. Symmetric does not imply invertible: the zero matrix is symmetric.`,
        },
      } },

    // ── MML §3.8.3 Gram-Schmidt ──
    { sec: { es: 'Ortogonalización de Gram-Schmidt', en: 'Gram-Schmidt orthogonalisation' }, vectores: E_GS,
      es: R`Gram-Schmidt convierte cualquier base $(${b}_1,\dots,${b}_n)$ de $V$ en una base ortogonal $(${u}_1,\dots,${u}_n)$ del mismo espacio (MML §3.8.3): $${u}_1:=${b}_1$ (ec. 3.67) y $${u}_k:=${b}_k-\pi_{\operatorname{span}[${u}_1,\dots,${u}_{k-1}]}(${b}_k)$, $k=2,\dots,n$ (ec. 3.68). A cada paso se quita a $${b}_k$ lo que ya está en las direcciones anteriores.`,
      en: R`Gram-Schmidt turns any basis $(${b}_1,\dots,${b}_n)$ of $V$ into an orthogonal basis $(${u}_1,\dots,${u}_n)$ of the same space (MML §3.8.3): $${u}_1:=${b}_1$ (eq. 3.67) and $${u}_k:=${b}_k-\pi_{\operatorname{span}[${u}_1,\dots,${u}_{k-1}]}(${b}_k)$, $k=2,\dots,n$ (eq. 3.68). At each step, $${b}_k$ loses whatever already lies in the previous directions.` },
    { leyenda: ['camino', 'mal'],
      es: R`Ejemplo propio: $${b}_1=(3,1)$, $${b}_2=(1,2)$. Reproduce la traza paso a paso.`,
      en: R`An example of our own: $${b}_1=(3,1)$, $${b}_2=(1,2)$. Play the trace step by step.`,
      traza: [
        { capas: [FB1, FB2, FU1], es: R`$${u}_1:=${b}_1=(3,1)$ (ec. 3.67).`, en: R`$${u}_1:=${b}_1=(3,1)$ (eq. 3.67).` },
        { capas: [FB1, FB2, FU1, PGS], es: R`Proyecta $${b}_2$ sobre $\operatorname{span}[${u}_1]$: $\frac{${b}_2^\top${u}_1}{${u}_1^\top${u}_1}${u}_1=\frac{5}{10}(3,1)=(1{,}5;\,0{,}5)$.`, en: R`Project $${b}_2$ onto $\operatorname{span}[${u}_1]$: $\frac{${b}_2^\top${u}_1}{${u}_1^\top${u}_1}${u}_1=\frac{5}{10}(3,1)=(1.5,\,0.5)$.` },
        { capas: [FB1, FU1, PGS, FU2], vec: { u2: [-0.5, 1.5] }, es: R`$${u}_2:=${b}_2-\pi(${b}_2)=(-0{,}5;\,1{,}5)$ (ec. 3.68). Comprueba: $${u}_1^\top${u}_2=-1{,}5+1{,}5=0$.`, en: R`$${u}_2:=${b}_2-\pi(${b}_2)=(-0.5,\,1.5)$ (eq. 3.68). Check: $${u}_1^\top${u}_2=-1.5+1.5=0$.` },
        { capas: [FU1, FU2], vec: { u1: [3 / r10, 1 / r10], u2: [-0.5 / r25, 1.5 / r25] }, es: R`Para una BON, se normaliza cada uno: $${u}_1/\sqrt{10}$ y $${u}_2/\sqrt{2{,}5}$.`, en: R`For an ONB, normalise each one: $${u}_1/\sqrt{10}$ and $${u}_2/\sqrt{2.5}$.` },
      ] },
    { capas: [FB1, FB2, PGS], vec: { u1: [3, 1], u2: [1, 2] },
      es: R`Arrastra $${b}_1$ y $${b}_2$. El segmento discontinuo, de $\pi(${b}_2)$ a $${b}_2$, **es** $${u}_2$ trasladado: siempre forma ángulo recto con $${b}_1$. Si haces $${b}_2$ paralelo a $${b}_1$, $${u}_2=${Zr}$: Gram-Schmidt detecta la dependencia lineal.`,
      en: R`Drag $${b}_1$ and $${b}_2$. The dashed segment, from $\pi(${b}_2)$ to $${b}_2$, **is** $${u}_2$ translated: it always makes a right angle with $${b}_1$. If you make $${b}_2$ parallel to $${b}_1$, $${u}_2=${Zr}$: Gram-Schmidt detects linear dependence.`,
      jugar: {
        botones: [
          { label: { es: 'b₂ ∥ b₁', en: 'b₂ ∥ b₁' }, hacer: v => { v.vec.b2 = [-v.vec.b1[0] / 2, -v.vec.b1[1] / 2]; } },
          { label: { es: 'de nuevo', en: 'reset' }, hacer: v => { v.vec.b1 = [3, 1]; v.vec.b2 = [1, 2]; } },
        ],
        lecturas: (v, cx) => {
          const b1 = v.vec.b1, b2 = v.vec.b2, q = cx.proy(b2, [b1]), u2 = [b2[0] - q[0], b2[1] - q[1]], n2 = cx.norma(u2);
          return [
            { expr: R`$${u}_2=${b}_2-\pi(${b}_2)$`, valor: p2(cx, u2) },
            { expr: R`$${u}_1^\top${u}_2$`, valor: cx.fmt(+cx.dot(b1, u2).toFixed(6)) },
            { expr: R`$${u}_2/\|${u}_2\|$`, valor: n2 > 1e-9 ? p2(cx, [u2[0] / n2, u2[1] / n2]) : '—', malo: n2 <= 1e-9 },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: R`En dimensión $n$, lo mismo: $${u}_k$ resta a $${b}_k$ su proyección sobre el subespacio de los $k-1$ anteriores, que con una base ortogonal es la suma de las proyecciones sobre cada $${u}_j$. MML apunta también a la versión matricial: eliminación gaussiana sobre $[\tilde{${Bm}}\tilde{${Bm}}^\top\,|\,\tilde{${Bm}}]$ (§3.5). En NumPy, la factorización QR (fuera de MML) da el mismo resultado salvo signos.`,
      en: R`In dimension $n$ the same repeats: $${u}_k$ subtracts from $${b}_k$ its projection onto the subspace of the previous $k-1$, which with an orthogonal basis is the sum of the projections onto each $${u}_j$. MML also points to the matrix version: Gaussian elimination on $[\tilde{${Bm}}\tilde{${Bm}}^\top\,|\,\tilde{${Bm}}]$ (§3.5). In NumPy, the QR factorisation (outside MML) gives the same result up to signs.` },

    // ── MML §3.8.4 Subespacios afines ──
    { sec: { es: 'Proyección sobre subespacios afines', en: 'Projection onto affine subspaces' }, vectores: E_AF, leyenda: ['camino', 'mal'],
      es: R`Sea $L=${X}_0+U$ un subespacio afín (§2.8). Se reduce al caso anterior trasladando: se resta $${X}_0$, se proyecta sobre $U$ y se vuelve a sumar (MML §3.8.4): $\pi_L(${X})=${X}_0+\pi_U(${X}-${X}_0)$ (ec. 3.72). La distancia de $${X}$ a $L$ es la de $${X}-${X}_0$ a $U$: $d(${X},L)=\|${X}-\pi_L(${X})\|$.`,
      en: R`Let $L=${X}_0+U$ be an affine subspace (§2.8). It reduces to the previous case by translating: subtract $${X}_0$, project onto $U$ and add it back (MML §3.8.4): $\pi_L(${X})=${X}_0+\pi_U(${X}-${X}_0)$ (eq. 3.72). The distance from $${X}$ to $L$ is that of $${X}-${X}_0$ to $U$: $d(${X},L)=\|${X}-\pi_L(${X})\|$.` },
    { es: R`Aquí $L$ es la recta $x_1+2x_2=4$, con $${X}_0=(0,2)$ y dirección $${b}=(2,-1)$. Arrastra $${X}$ y también $${X}_0$ (la recta se mueve con él). Las lecturas comparan $d(${X},L)$ con la fórmula del hiperplano $\frac{|${w}^\top${X}-c|}{\|${w}\|}$, con normal $${w}=(1,2)$, que vale mientras $${X}_0$ siga en la recta.`,
      en: R`Here $L$ is the line $x_1+2x_2=4$, with $${X}_0=(0,2)$ and direction $${b}=(2,-1)$. Drag $${X}$ and also $${X}_0$ (the line moves with it). The readouts compare $d(${X},L)$ with the hyperplane formula $\frac{|${w}^\top${X}-c|}{\|${w}\|}$, with normal $${w}=(1,2)$, valid while $${X}_0$ stays on the line.`,
      jugar: {
        botones: [
          { label: { es: 'x₀ = (0, 2)', en: 'x₀ = (0, 2)' }, hacer: v => { v.vec.x0 = [0, 2]; } },
          { label: { es: 'x₀ = (4, 0)', en: 'x₀ = (4, 0)' }, hacer: v => { v.vec.x0 = [4, 0]; } },
          { label: 'x = (3, 3)', hacer: v => { v.vec.x = [3, 3]; } },
        ],
        lecturas: (v, cx) => {
          const x = v.vec.x, x0 = v.vec.x0, d0 = [x[0] - x0[0], x[1] - x0[1]], q = cx.proy(d0, [v.vec.b]), pl = [x0[0] + q[0], x0[1] + q[1]];
          const d = cx.norma([x[0] - pl[0], x[1] - pl[1]]), c = x0[0] + 2 * x0[1];
          return [
            { expr: R`$\pi_L(${X})$`, valor: p2(cx, pl) },
            { expr: R`$d(${X},L)$`, valor: cx.fmt(+d.toFixed(3)) },
            { expr: R`$\frac{|${w}^\top${X}-c|}{\|${w}\|}$`, valor: cx.fmt(+(Math.abs(x[0] + 2 * x[1] - c) / Math.sqrt(5)).toFixed(3)) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: R`¿A qué distancia está el punto $(3,3)$ del hiperplano (recta) $x_1+2x_2=4$?`,
      en: R`How far is the point $(3,3)$ from the hyperplane (line) $x_1+2x_2=4$?`,
      pregunta: {
        opc: [
          { es: R`$\sqrt5\approx2{,}24$`, en: R`$\sqrt5\approx2.24$`, ok: 1 },
          { es: R`$5$`, en: R`$5$` },
          { es: R`$\sqrt{18}$, la distancia al origen`, en: R`$\sqrt{18}$, the distance to the origin` },
        ],
        why: {
          es: R`Con $${w}=(1,2)$ y $c=4$: $\frac{|3+6-4|}{\sqrt{1+4}}=\frac5{\sqrt5}=\sqrt5$. El $5$ olvida dividir por $\|${w}\|$, que solo es $1$ si la normal es unitaria. Esta cuenta es la base del **margen** de la SVM: la distancia de un dato al hiperplano $${w}^\top${X}+b=0$ (MML §12.2.1).`,
          en: R`With $${w}=(1,2)$ and $c=4$: $\frac{|3+6-4|}{\sqrt{1+4}}=\frac5{\sqrt5}=\sqrt5$. The $5$ forgets to divide by $\|${w}\|$, which is only $1$ for a unit normal. This computation underlies the SVM **margin**: the distance from a data point to the hyperplane $${w}^\top${X}+b=0$ (MML §12.2.1).`,
        },
      } },

    // ── MML §3.9 Rotaciones ──
    { sec: { es: 'Rotaciones', en: 'Rotations' }, vectores: E_ROT,
      es: R`Una **rotación** es una aplicación lineal (un automorfismo de un espacio euclídeo) que gira un plano un ángulo $\theta$ alrededor del origen, que queda fijo; con $\theta>0$ se gira en sentido **antihorario** (MML §3.9). En $\mathbb{R}^2$ basta mirar la base canónica: $\Phi(${B('e')}_1)=(\cos\theta,\operatorname{sen}\theta)^\top$ y $\Phi(${B('e')}_2)=(-\operatorname{sen}\theta,\cos\theta)^\top$ (ec. 3.75).`,
      en: R`A **rotation** is a linear mapping (an automorphism of a Euclidean vector space) that turns a plane by an angle $\theta$ about the origin, which stays fixed; with $\theta>0$ the turn is **counterclockwise** (MML §3.9). In $\mathbb{R}^2$ it is enough to look at the standard basis: $\Phi(${B('e')}_1)=(\cos\theta,\sin\theta)^\top$ and $\Phi(${B('e')}_2)=(-\sin\theta,\cos\theta)^\top$ (eq. 3.75).` },
    { es: R`Con esas columnas, $${B('R')}(\theta)=\begin{bmatrix}\cos\theta&-\operatorname{sen}\theta\\\operatorname{sen}\theta&\cos\theta\end{bmatrix}$ (ec. 3.76). Prueba ángulos: la rejilla gira **sin deformarse**. $\|${B('R')}${X}\|=\|${X}\|$, el ángulo entre $${B('R')}${X}$ y $${B('R')}${B('y')}$ es el de $${X}$ e $${B('y')}$, $${B('R')}^\top${B('R')}=${I}$ y $\det${B('R')}=1$. Una reflexión también es ortogonal, pero tiene $\det=-1$.`,
      en: R`With those columns, $${B('R')}(\theta)=\begin{bmatrix}\cos\theta&-\sin\theta\\\sin\theta&\cos\theta\end{bmatrix}$ (eq. 3.76). Try angles: the grid turns **without deforming**. $\|${B('R')}${X}\|=\|${X}\|$, the angle between $${B('R')}${X}$ and $${B('R')}${B('y')}$ is that of $${X}$ and $${B('y')}$, $${B('R')}^\top${B('R')}=${I}$ and $\det${B('R')}=1$. A reflection is orthogonal too, but has $\det=-1$.`,
      jugar: {
        botones: [
          { label: 'θ = 0°', hacer: v => rot(v, 0) },
          { label: 'θ = 30°', hacer: v => rot(v, 30) },
          { label: 'θ = 90°', hacer: v => rot(v, 90) },
          { label: 'θ = 135°', hacer: v => rot(v, 135) },
          { label: 'θ = −60°', hacer: v => rot(v, -60) },
        ],
        lecturas: (v, cx) => {
          const M = [[v.c, v.ns], [v.s, v.c]], Rx = cx.mul(M, v.vec.x), Ry = cx.mul(M, v.vec.y);
          const g = a => (Number.isFinite(a) ? `${cx.fmt(+(a * 180 / Math.PI).toFixed(1))}°` : '—');
          return [
            { expr: R`$\theta$`, valor: `${cx.fmt(v.t)}°` },
            { expr: R`$\|${X}\|\;/\;\|${B('R')}${X}\|$`, valor: `${cx.fmt(+cx.norma(v.vec.x).toFixed(3))} / ${cx.fmt(+cx.norma(Rx).toFixed(3))}` },
            { expr: R`$\angle(${X},${B('y')})\;/\;\angle(${B('R')}${X},${B('R')}${B('y')})$`, valor: `${g(cx.angulo(v.vec.x, v.vec.y))} / ${g(cx.angulo(Rx, Ry))}` },
            { expr: R`$\det${B('R')}$`, valor: cx.fmt(+cx.detM(M).toFixed(3)) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: R`**En $\mathbb{R}^3$** se gira alrededor de un eje, en sentido antihorario mirando el eje «de frente», desde su extremo hacia el origen (MML §3.9.2). Alrededor de $${B('e')}_1$ esa coordenada queda fija (ec. 3.77): $${B('R')}_1(\theta)=${mat3([1, 0, 0], [0, R`\cos\theta`, R`-\operatorname{sen}\theta`], [0, R`\operatorname{sen}\theta`, R`\cos\theta`])}$.`,
      en: R`**In $\mathbb{R}^3$** we rotate about an axis, counterclockwise when looking at the axis "head on", from its tip towards the origin (MML §3.9.2). About $${B('e')}_1$ that coordinate stays fixed (eq. 3.77): $${B('R')}_1(\theta)=${mat3([1, 0, 0], [0, R`\cos\theta`, R`-\sin\theta`], [0, R`\sin\theta`, R`\cos\theta`])}$.` },
    { es: R`Alrededor de $${B('e')}_2$ (ec. 3.78): $${B('R')}_2(\theta)=${mat3([R`\cos\theta`, 0, R`\operatorname{sen}\theta`], [0, 1, 0], [R`-\operatorname{sen}\theta`, 0, R`\cos\theta`])}$; ojo al signo, que cambia de sitio. Alrededor de $${B('e')}_3$ (ec. 3.79), $${B('R')}_3(\theta)$ es $${B('R')}(\theta)$ ampliada con un $1$ en la esquina.`,
      en: R`About $${B('e')}_2$ (eq. 3.78): $${B('R')}_2(\theta)=${mat3([R`\cos\theta`, 0, R`\sin\theta`], [0, 1, 0], [R`-\sin\theta`, 0, R`\cos\theta`])}$; watch the sign, which moves. About $${B('e')}_3$ (eq. 3.79), $${B('R')}_3(\theta)$ is $${B('R')}(\theta)$ padded with a $1$ in the corner.` },
    { es: R`**Def. 3.11 (rotación de Givens).** En un espacio euclídeo de dimensión $n$, para $1\le i<j\le n$ y $\theta\in\mathbb{R}$, $${B('R')}_{ij}(\theta)\in\mathbb{R}^{n\times n}$ es la identidad salvo en cuatro entradas (ec. 3.80–3.81): $r_{ii}=\cos\theta$, $r_{ij}=-\operatorname{sen}\theta$, $r_{ji}=\operatorname{sen}\theta$ y $r_{jj}=\cos\theta$. Gira solo el plano de las coordenadas $i,j$; con $n=2$ es (3.76).`,
      en: R`**Def. 3.11 (Givens rotation).** In an $n$-dimensional Euclidean space, for $1\le i<j\le n$ and $\theta\in\mathbb{R}$, $${B('R')}_{ij}(\theta)\in\mathbb{R}^{n\times n}$ is the identity except for four entries (eq. 3.80–3.81): $r_{ii}=\cos\theta$, $r_{ij}=-\sin\theta$, $r_{ji}=\sin\theta$ and $r_{jj}=\cos\theta$. It only turns the plane of coordinates $i,j$; with $n=2$ it is (3.76).` },
    { es: R`Propiedades (MML §3.9.4): las rotaciones son matrices ortogonales, así que conservan distancias, $\|${X}-${B('y')}\|=\|${B('R')}_\theta(${X})-${B('R')}_\theta(${B('y')})\|$, y ángulos. En $\mathbb{R}^2$ conmutan: $${B('R')}(\phi)${B('R')}(\theta)=${B('R')}(\theta)${B('R')}(\phi)$, y equivalen a girar $\phi+\theta$. En tres o más dimensiones, en general **no** conmutan.`,
      en: R`Properties (MML §3.9.4): rotations are orthogonal matrices, so they preserve distances, $\|${X}-${B('y')}\|=\|${B('R')}_\theta(${X})-${B('R')}_\theta(${B('y')})\|$, and angles. In $\mathbb{R}^2$ they commute: $${B('R')}(\phi)${B('R')}(\theta)=${B('R')}(\theta)${B('R')}(\phi)$, and both equal a turn of $\phi+\theta$. In three or more dimensions they generally do **not** commute.` },
    { es: R`Aplica a $${B('e')}_2$ un giro de $90^\circ$ alrededor de $${B('e')}_3$ y luego otro de $90^\circ$ alrededor de $${B('e')}_1$. ¿Y en el orden inverso?`,
      en: R`Apply to $${B('e')}_2$ a $90^\circ$ turn about $${B('e')}_3$ and then another $90^\circ$ turn about $${B('e')}_1$. And in the reverse order?`,
      pregunta: {
        opc: [
          { es: R`$(-1,0,0)$ y $(0,0,1)$: el orden importa`, en: R`$(-1,0,0)$ and $(0,0,1)$: order matters`, ok: 1 },
          { es: R`$(-1,0,0)$ en los dos órdenes`, en: R`$(-1,0,0)$ in both orders` },
          { es: R`$(0,0,1)$ en los dos órdenes`, en: R`$(0,0,1)$ in both orders` },
        ],
        why: {
          es: R`$${B('R')}_3(90^\circ)${B('e')}_2=(-1,0,0)$, y $${B('R')}_1$ deja fijo el eje $${B('e')}_1$: queda $(-1,0,0)$. En el otro orden, $${B('R')}_1(90^\circ)${B('e')}_2=(0,0,1)$, y $${B('R')}_3$ deja fijo $${B('e')}_3$: queda $(0,0,1)$. Así, $${B('R')}_1${B('R')}_3\neq${B('R')}_3${B('R')}_1$. Por eso en robótica y gráficos se fija siempre el orden de los giros.`,
          en: R`$${B('R')}_3(90^\circ)${B('e')}_2=(-1,0,0)$, and $${B('R')}_1$ fixes the $${B('e')}_1$ axis: we get $(-1,0,0)$. In the other order, $${B('R')}_1(90^\circ)${B('e')}_2=(0,0,1)$, and $${B('R')}_3$ fixes $${B('e')}_3$: we get $(0,0,1)$. So $${B('R')}_1${B('R')}_3\neq${B('R')}_3${B('R')}_1$. That is why robotics and graphics always fix the order of rotations.`,
        },
      } },

    // ── Dónde aparece en ML y código ──
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' },
      es: R`**Regresión lineal:** la predicción MV $\bm{\Phi}\bm{\theta}_{\mathrm{ML}}=\bm{\Phi}(\bm{\Phi}^\top\bm{\Phi})^{-1}\bm{\Phi}^\top${B('y')}$ es la proyección ortogonal de $${B('y')}$ sobre el espacio columna de $\boldsymbol{\Phi}$ (MML §9.4). **PCA:** proyecta los datos sobre un subespacio minimizando el error de reconstrucción (§10.3). **SVM:** distancia de un dato al hiperplano (§12.2).`,
      en: R`**Linear regression:** the ML prediction $\bm{\Phi}\bm{\theta}_{\mathrm{ML}}=\bm{\Phi}(\bm{\Phi}^\top\bm{\Phi})^{-1}\bm{\Phi}^\top${B('y')}$ is the orthogonal projection of $${B('y')}$ onto the column space of $\bm{\Phi}$ (MML §9.4). **PCA:** projects the data onto a subspace, minimising the reconstruction error (§10.3). **SVM:** distance from a data point to the hyperplane (§12.2).` },
    { code: `import numpy as np
B = np.array([[1., 0.], [0., 1.], [1., 1.]]); x = np.array([1., 2., 0.])
lam = np.linalg.solve(B.T @ B, B.T @ x)      # ecuación normal (3.56)
P = B @ np.linalg.inv(B.T @ B) @ B.T          # (3.59)
print(lam, B @ lam, np.allclose(P @ P, P))    # [0. 1.] [0. 1. 1.] True
print(np.linalg.lstsq(B, x, rcond=None)[0])   # el mismo λ: mínimos cuadrados
Q, _ = np.linalg.qr(B)                        # columnas ortonormales de span(B)
print(np.allclose(Q @ Q.T @ x, B @ lam))      # π = Q Qᵀ x  (3.65)
t = np.radians(30)
Rt = np.array([[np.cos(t), -np.sin(t)], [np.sin(t), np.cos(t)]])
print(np.allclose(Rt.T @ Rt, np.eye(2)), np.linalg.det(Rt))  # True 1.0`, line: null,
      es: R`El ejemplo de $\mathbb{R}^3$ en NumPy. Resolver la ecuación normal con un solver es mejor que invertir $${Bm}^\top${Bm}$; en la práctica se usa `+ '`lstsq`' + R`, que da el mismo $${lam}$ por mínimos cuadrados. `+ '`qr`' + R` ortonormaliza la base, y entonces $\pi_U(${X})=${B('Q')}${B('Q')}^\top${X}$.`,
      en: R`The $\mathbb{R}^3$ example in NumPy. Solving the normal equation with a solver beats inverting $${Bm}^\top${Bm}$; in practice you use `+ '`lstsq`' + R`, which gives the same $${lam}$ by least squares. `+ '`qr`' + R` orthonormalises the basis, and then $\pi_U(${X})=${B('Q')}${B('Q')}^\top${X}$.` },
    { code: '', es: R`**Resumen.** Proyectar = buscar el punto más cercano $\iff$ error **ortogonal** al subespacio. Sobre una recta, $\lambda=${b}^\top${X}/${b}^\top${b}$. Sobre un subespacio, la ecuación normal $${Bm}^\top${Bm}${lam}=${Bm}^\top${X}$. Con una BON, $${P}=${Bm}${Bm}^\top$, y Gram-Schmidt la construye. Las rotaciones son las ortogonales con $\det=1$.`,
      en: R`**Summary.** Projecting = finding the closest point $\iff$ error **orthogonal** to the subspace. Onto a line, $\lambda=${b}^\top${X}/${b}^\top${b}$. Onto a subspace, the normal equation $${Bm}^\top${Bm}${lam}=${Bm}^\top${X}$. With an ONB, $${P}=${Bm}${Bm}^\top$, and Gram-Schmidt builds one. Rotations are the orthogonal matrices with $\det=1$.` },
  ],
};
