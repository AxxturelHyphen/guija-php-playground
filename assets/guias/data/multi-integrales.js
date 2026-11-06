// Guía «Integrales múltiples» (Multivariable). Usa las escenas `campo` (superficie, columnas de Riemann, cortes, polares)
// y `funcion` (dibujos 2D de regiones: Fubini, regiones no rectangulares, base del tetraedro, corte meridiano esférico).
// Formato en las cabeceras de assets/guias/campo.js y assets/guias/funcion.js.
const PI = Math.PI;
const f2 = (x, y) => x * x + y * y;
const V0 = { x: [0, 2], y: [0, 2] };
const c0 = v => (Math.abs(v) < 1e-9 ? 0 : v);

// Integral doble sobre el disco de radio R en polares (punto medio, n×n): ∬ f(r cosθ, r sinθ) r dr dθ
const polar = (f, R, n = 80) => {
  let s = 0; const hr = R / n, ht = 2 * PI / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const r = (i + .5) * hr, t = (j + .5) * ht; s += f(r * Math.cos(t), r * Math.sin(t)) * r; }
  return s * hr * ht;
};

export default {
  titulo: { es: 'Integrales múltiples', en: 'Multiple integrals' },
  fuentes: [
    'Auroux, D. (2010). *18.02SC Multivariable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 3*. OpenStax. https://openstax.org/books/calculus-volume-3/pages/preface',
  ],
  pasos: [
    // ── Integral doble como volumen ──
    { sec: { es: 'Volumen bajo una superficie', en: 'Volume under a surface' },
      campo: { f: f2, ...V0, modo: 'superficie', par: { n: 1 },
        deslizadores: [{ par: 'n', min: 1, max: 20, paso: 1, dec: 0, es: '$n$ (columnas por lado)', en: '$n$ (columns per side)' }],
        capas: [{ tipo: 'region', x: [0, 2], y: [0, 2], n: 'n' }],
        etiqueta: { es: 'Superficie z = x² + y² sobre [0,2]×[0,2] con columnas de Riemann', en: 'Surface z = x² + y² over [0,2]×[0,2] with Riemann columns' } },
      es: 'La integral simple da el área bajo una curva; la **integral doble** da el **volumen** bajo una superficie $z=f(x,y)$ sobre una región $R$. Aquí $f(x,y)=x^2+y^2$ sobre $R=[0,2]\\times[0,2]$. Con $n=1$ hay una columna: base $4$, altura $f(1,1)=2$, volumen $8$.',
      en: 'The single integral gives the area under a curve; the **double integral** gives the **volume** under a surface $z=f(x,y)$ over a region $R$. Here $f(x,y)=x^2+y^2$ over $R=[0,2]\\times[0,2]$. With $n=1$ there is one column: base $4$, height $f(1,1)=2$, volume $8$.' },
    { par: { n: 2 },
      es: 'Parte $R$ en $n\\times n$ rectángulos de área $\\Delta A$ y levanta en cada uno una columna con la altura de $f$ en su centro. Con $n=2$ las alturas son $0{,}5$, $2{,}5$, $2{,}5$ y $4{,}5$, que suman $10$; como $\\Delta A=1$, el volumen aproximado es $10$.',
      en: 'Split $R$ into $n\\times n$ rectangles of area $\\Delta A$ and raise a column on each one, with the height of $f$ at its centre. With $n=2$ the heights are $0.5$, $2.5$, $2.5$ and $4.5$, which add up to $10$; since $\\Delta A=1$, the approximate volume is $10$.' },
    { par: { n: 8 },
      es: 'Con $n=8$ la suma da $10{,}625$. Al refinar, las columnas se pegan a la superficie: $\\displaystyle\\iint_R f\\,dA=\\lim_{n\\to\\infty}\\sum_{i,j}f(x_i^*,y_j^*)\\,\\Delta A$. Para esta $f$ el límite es $\\tfrac{32}{3}\\approx10{,}667$, que obtendremos con Fubini.',
      en: 'With $n=8$ the sum gives $10.625$. As you refine, the columns hug the surface: $\\displaystyle\\iint_R f\\,dA=\\lim_{n\\to\\infty}\\sum_{i,j}f(x_i^*,y_j^*)\\,\\Delta A$. For this $f$ the limit is $\\tfrac{32}{3}\\approx10.667$, which we will get with Fubini.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' },
      jugar: {
        botones: [1, 2, 4, 10, 20].map(n => ({ label: { es: `n = ${n}`, en: `n = ${n}` }, hacer: v => { v.n = n; } })),
        lecturas: (v, cx) => {
          const S = cx.integral(0, 2, 0, 2, v.n), E = 32 / 3;
          return [
            { expr: 'n', valor: cx.fmt(v.n) },
            { expr: 'S(n)', valor: cx.fmt(S) },
            { expr: '32/3', valor: cx.fmt(E) },
            { expr: 'error', valor: cx.fmt(c0(E - S)) },
          ];
        },
      },
      es: 'Mueve $n$ con el deslizador o los botones. El error de la suma de punto medio vale exactamente $\\tfrac{8}{3n^2}$ para esta $f$: duplicar $n$ lo divide entre $4$. Compruébalo con $n=2$ (error $0{,}667$) y $n=4$ (error $0{,}167$).',
      en: 'Move $n$ with the slider or the buttons. The error of the midpoint sum is exactly $\\tfrac{8}{3n^2}$ for this $f$: doubling $n$ divides it by $4$. Check it with $n=2$ (error $0.667$) and $n=4$ (error $0.167$).' },
    { par: { n: 4 },
      es: 'Si $f(x,y)=1$ en todo $R=[0,2]\\times[0,2]$, ¿cuánto vale $\\iint_R f\\,dA$?',
      en: 'If $f(x,y)=1$ everywhere on $R=[0,2]\\times[0,2]$, what is $\\iint_R f\\,dA$?',
      pregunta: {
        opc: [
          { es: '$1$, la altura de la superficie', en: '$1$, the height of the surface' },
          { es: '$4$, el área de $R$', en: '$4$, the area of $R$', ok: 1 },
          { es: '$2$, el lado de $R$', en: '$2$, the side of $R$' },
        ],
        why: {
          es: 'Las columnas miden $1$ de alto, así que el volumen coincide con el área de la base: $\\iint_R 1\\,dA=\\text{área}(R)=4$. Así se mide el área de una región con una integral doble.',
          en: 'The columns are $1$ high, so the volume equals the area of the base: $\\iint_R 1\\,dA=\\text{area}(R)=4$. That is how a double integral measures the area of a region.',
        },
      } },

    // ── Fubini ──
    { sec: { es: 'Fubini: integrales iteradas', en: 'Fubini: iterated integrals' },
      campo: { f: f2, ...V0, modo: 'superficie', par: { x0: 1 },
        deslizadores: [{ par: 'x0', min: 0, max: 2, paso: .05, dec: 2, es: '$x$ (plano de corte)', en: '$x$ (cutting plane)' }],
        capas: [{ tipo: 'corte', eje: 'x', v: 'x0' }],
        etiqueta: { es: 'Superficie z = x² + y² cortada por el plano x = x₀', en: 'Surface z = x² + y² cut by the plane x = x₀' } },
      es: 'En lugar de columnas, corta con un plano $x=x_0$. El área de esa sección es $A(x_0)=\\int_0^2(x_0^2+y^2)\\,dy=2x_0^2+\\tfrac83$. El volumen es la suma de todas las secciones: $V=\\int_0^2A(x)\\,dx$. Mueve el plano.',
      en: 'Instead of columns, cut with a plane $x=x_0$. The area of that section is $A(x_0)=\\int_0^2(x_0^2+y^2)\\,dy=2x_0^2+\\tfrac83$. The volume is the sum of all the sections: $V=\\int_0^2A(x)\\,dx$. Move the plane.' },
    { es: '**Teorema de Fubini**: si $f$ es continua en $R=[a,b]\\times[c,d]$, $\\displaystyle\\iint_R f\\,dA=\\int_a^b\\!\\int_c^d f\\,dy\\,dx=\\int_c^d\\!\\int_a^b f\\,dx\\,dy$. Aquí: $\\int_0^2\\bigl(2x^2+\\tfrac83\\bigr)dx=\\tfrac{16}{3}+\\tfrac{16}{3}=\\tfrac{32}{3}$, justo el límite de las sumas.',
      en: '**Fubini\'s theorem**: if $f$ is continuous on $R=[a,b]\\times[c,d]$, $\\displaystyle\\iint_R f\\,dA=\\int_a^b\\!\\int_c^d f\\,dy\\,dx=\\int_c^d\\!\\int_a^b f\\,dx\\,dy$. Here: $\\int_0^2\\bigl(2x^2+\\tfrac83\\bigr)dx=\\tfrac{16}{3}+\\tfrac{16}{3}=\\tfrac{32}{3}$, exactly the limit of the sums.' },
    { sec: { es: 'Elegir el orden', en: 'Choosing the order' },
      funcion: { x: [-.25, 1.25], y: [-.25, 1.25], igual: true,
        curvas: [{ id: 'a', nombre: '$y=x$', f: x => x }, { id: 'b', nombre: '$y=1$', f: () => 1 }],
        capas: [{ tipo: 'entre', c: 'b', g: 'a', a: 0, b: 1 }, { tipo: 'texto', x: .12, y: .85, s: '$R$' }],
        etiqueta: { es: 'Región triangular entre y = x e y = 1', en: 'Triangular region between y = x and y = 1' } },
      es: 'El orden puede decidir si un problema se resuelve o no. Calcula $\\displaystyle\\int_0^1\\!\\int_x^1e^{y^2}\\,dy\\,dx$. La función $e^{y^2}$ **no tiene antiderivada elemental**, así que integrar primero en $y$ es un callejón sin salida. ¿Qué haces?',
      en: 'The order can decide whether a problem is solvable. Compute $\\displaystyle\\int_0^1\\!\\int_x^1e^{y^2}\\,dy\\,dx$. The function $e^{y^2}$ **has no elementary antiderivative**, so integrating in $y$ first is a dead end. What do you do?',
      pregunta: {
        opc: [
          { es: 'Seguir con $y$ primero, tal como está escrita', en: 'Keep going with $y$ first, as written' },
          { es: 'Cambiar el orden: la región es $0\\le x\\le y\\le1$, luego $x$ va de $0$ a $y$', en: 'Swap the order: the region is $0\\le x\\le y\\le1$, so $x$ runs from $0$ to $y$', ok: 1 },
          { es: 'Concluir que no se puede calcular', en: 'Conclude it cannot be computed' },
        ],
        why: {
          es: 'Dibujar la región revela los nuevos límites. Con $dx$ primero la integral interior es $\\int_0^y dx=y$ y queda $\\int_0^1y\\,e^{y^2}dy$, que sí sale por sustitución. Dibujar la región es siempre el primer paso.',
          en: 'Drawing the region reveals the new limits. With $dx$ first the inner integral is $\\int_0^y dx=y$ and what remains is $\\int_0^1y\\,e^{y^2}dy$, which does work by substitution. Drawing the region is always the first step.',
        },
      } },
    { capas: [{ tipo: 'entre', c: 'b', g: 'a', a: 0, b: 1 }, { tipo: 'texto', x: .12, y: .85, s: '$R$' }],
      es: 'Con $R=\\{0\\le y\\le1,\\ 0\\le x\\le y\\}$: $\\displaystyle\\int_0^1\\!\\int_0^ye^{y^2}dx\\,dy=\\int_0^1y\\,e^{y^2}dy=\\Bigl[\\tfrac12e^{y^2}\\Bigr]_0^1=\\tfrac{e-1}{2}\\approx0{,}859$. Es la misma región leída por columnas o por filas: los límites interiores dependen de la variable exterior.',
      en: 'With $R=\\{0\\le y\\le1,\\ 0\\le x\\le y\\}$: $\\displaystyle\\int_0^1\\!\\int_0^ye^{y^2}dx\\,dy=\\int_0^1y\\,e^{y^2}dy=\\Bigl[\\tfrac12e^{y^2}\\Bigr]_0^1=\\tfrac{e-1}{2}\\approx0.859$. It is the same region read by columns or by rows: the inner limits depend on the outer variable.' },

    // ── Regiones no rectangulares ──
    { sec: { es: 'Regiones no rectangulares', en: 'Non-rectangular regions' },
      funcion: { x: [-.25, 1.25], y: [-.25, 1.25], igual: true,
        curvas: [{ id: 'p', nombre: '$y=x^2$', f: x => x * x }, { id: 'r', nombre: '$y=x$', f: x => x }],
        capas: [{ tipo: 'entre', c: 'r', g: 'p', a: 0, b: 1 }, { tipo: 'texto', x: .5, y: .4, s: '$R$' }],
        etiqueta: { es: 'Región entre y = x² e y = x', en: 'Region between y = x² and y = x' } },
      es: 'Si $R$ no es un rectángulo, los límites de la integral interior dependen de la variable exterior. Región **tipo I**: $a\\le x\\le b$, $g_1(x)\\le y\\le g_2(x)$, con $\\displaystyle\\iint_Rf\\,dA=\\int_a^b\\!\\int_{g_1(x)}^{g_2(x)}f\\,dy\\,dx$. Aquí $R$ queda entre $y=x^2$ e $y=x$, con $0\\le x\\le1$.',
      en: 'If $R$ is not a rectangle, the inner limits depend on the outer variable. **Type I** region: $a\\le x\\le b$, $g_1(x)\\le y\\le g_2(x)$, with $\\displaystyle\\iint_Rf\\,dA=\\int_a^b\\!\\int_{g_1(x)}^{g_2(x)}f\\,dy\\,dx$. Here $R$ lies between $y=x^2$ and $y=x$, with $0\\le x\\le1$.' },
    { es: 'Con $f=xy$: $\\int_0^1\\!\\int_{x^2}^{x}xy\\,dy\\,dx=\\int_0^1\\bigl(\\tfrac{x^3}{2}-\\tfrac{x^5}{2}\\bigr)dx=\\tfrac18-\\tfrac1{12}=\\tfrac1{24}$. Como **tipo II** ($y\\le x\\le\\sqrt y$) sale igual: $\\int_0^1\\!\\int_y^{\\sqrt y}xy\\,dx\\,dy=\\tfrac16-\\tfrac18=\\tfrac1{24}$. Con $f=1$ resulta el área: $\\tfrac12-\\tfrac13=\\tfrac16$.',
      en: 'With $f=xy$: $\\int_0^1\\!\\int_{x^2}^{x}xy\\,dy\\,dx=\\int_0^1\\bigl(\\tfrac{x^3}{2}-\\tfrac{x^5}{2}\\bigr)dx=\\tfrac18-\\tfrac1{12}=\\tfrac1{24}$. As a **type II** region ($y\\le x\\le\\sqrt y$) it comes out the same: $\\int_0^1\\!\\int_y^{\\sqrt y}xy\\,dx\\,dy=\\tfrac16-\\tfrac18=\\tfrac1{24}$. With $f=1$ you get the area: $\\tfrac12-\\tfrac13=\\tfrac16$.' },

    // ── Polares ──
    { sec: { es: 'Coordenadas polares', en: 'Polar coordinates' },
      campo: { f: f2, x: [-2.5, 2.5], y: [-2.5, 2.5], modo: 'nivel', par: { c: 1 },
        deslizadores: [{ par: 'c', min: .25, max: 4, paso: .05, dec: 2, es: '$c=r^2$ (nivel de $x^2+y^2$)', en: '$c=r^2$ (level of $x^2+y^2$)' }],
        capas: [{ tipo: 'restriccion', g: f2, c: 'c' }],
        etiqueta: { es: 'Curvas de nivel de x² + y²: circunferencias', en: 'Level curves of x² + y²: circles' } },
      es: 'Si la región es un círculo o un sector, las cartesianas estorban. En **polares** $x=r\\cos\\theta$, $y=r\\sin\\theta$ y $x^2+y^2=r^2$. Las curvas de nivel de $x^2+y^2$ ya son circunferencias $r=\\text{cte}$: la roja es $x^2+y^2=c$, de radio $\\sqrt c$. Mueve $c$.',
      en: 'When the region is a disc or a sector, Cartesian coordinates get in the way. In **polar** form $x=r\\cos\\theta$, $y=r\\sin\\theta$ and $x^2+y^2=r^2$. The level curves of $x^2+y^2$ are already circles $r=\\text{const}$: the red one is $x^2+y^2=c$, of radius $\\sqrt c$. Move $c$.' },
    { es: 'Un «rectángulo polar» $\\Delta r\\times\\Delta\\theta$ no tiene área $\\Delta r\\,\\Delta\\theta$ sino la de un trozo de corona: $\\tfrac12\\bigl[(r+\\Delta r)^2-r^2\\bigr]\\Delta\\theta=\\bigl(r+\\tfrac{\\Delta r}2\\bigr)\\Delta r\\,\\Delta\\theta$. Por eso $dA=r\\,dr\\,d\\theta$. Ese $r$ es el **jacobiano**: $\\left|\\dfrac{\\partial(x,y)}{\\partial(r,\\theta)}\\right|=r\\cos^2\\theta+r\\sin^2\\theta=r$.',
      en: 'A «polar rectangle» $\\Delta r\\times\\Delta\\theta$ does not have area $\\Delta r\\,\\Delta\\theta$ but that of a piece of a ring: $\\tfrac12\\bigl[(r+\\Delta r)^2-r^2\\bigr]\\Delta\\theta=\\bigl(r+\\tfrac{\\Delta r}2\\bigr)\\Delta r\\,\\Delta\\theta$. Hence $dA=r\\,dr\\,d\\theta$. That $r$ is the **Jacobian**: $\\left|\\dfrac{\\partial(x,y)}{\\partial(r,\\theta)}\\right|=r\\cos^2\\theta+r\\sin^2\\theta=r$.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' },
      jugar: {
        botones: [.5, 1, 1.5, 2].map(r => ({ label: { es: `r = ${String(r).replace('.', ',')}`, en: `r = ${r}` }, hacer: v => { v.c = r * r; } })),
        lecturas: (v, cx) => [
          { expr: 'R', valor: cx.fmt(Math.sqrt(v.c)) },
          { expr: 'A = πR²', valor: cx.fmt(PI * v.c) },
          { expr: '∬ (x²+y²) dA', valor: cx.fmt(polar(f2, Math.sqrt(v.c))) },
          { expr: 'πR⁴/2', valor: cx.fmt(PI * v.c * v.c / 2) },
        ],
      },
      es: 'Sobre el disco $r\\le R$: $\\displaystyle\\iint(x^2+y^2)\\,dA=\\int_0^{2\\pi}\\!\\!\\int_0^Rr^2\\cdot r\\,dr\\,d\\theta=\\tfrac{\\pi R^4}{2}$. Elige un radio: la suma numérica en polares coincide con la fórmula. Con $R=2$ da $8\\pi\\approx25{,}13$.',
      en: 'Over the disc $r\\le R$: $\\displaystyle\\iint(x^2+y^2)\\,dA=\\int_0^{2\\pi}\\!\\!\\int_0^Rr^2\\cdot r\\,dr\\,d\\theta=\\tfrac{\\pi R^4}{2}$. Pick a radius: the numerical sum in polar coordinates matches the formula. With $R=2$ it gives $8\\pi\\approx25.13$.' },
    { par: { c: 9 },
      es: 'Sea $D$ el disco de radio $3$. ¿Cuánto vale $\\iint_D(x^2+y^2)\\,dA$?',
      en: 'Let $D$ be the disc of radius $3$. What is $\\iint_D(x^2+y^2)\\,dA$?',
      pregunta: {
        opc: [
          { es: '$18\\pi$', en: '$18\\pi$' },
          { es: '$\\tfrac{81\\pi}{2}$', en: '$\\tfrac{81\\pi}{2}$', ok: 1 },
          { es: '$9\\pi$', en: '$9\\pi$' },
        ],
        why: {
          es: '$\\int_0^{2\\pi}\\!\\int_0^3r^2\\,r\\,dr\\,d\\theta=2\\pi\\cdot\\tfrac{81}{4}=\\tfrac{81\\pi}2\\approx127{,}2$. Sin el jacobiano saldría $2\\pi\\cdot9=18\\pi$, y $9\\pi$ es solo el área del disco.',
          en: '$\\int_0^{2\\pi}\\!\\int_0^3r^2\\,r\\,dr\\,d\\theta=2\\pi\\cdot\\tfrac{81}{4}=\\tfrac{81\\pi}2\\approx127.2$. Without the Jacobian you would get $2\\pi\\cdot9=18\\pi$, and $9\\pi$ is just the area of the disc.',
        },
      } },

    // ── Triples ──
    { sec: { es: 'Integrales triples', en: 'Triple integrals' },
      funcion: { x: [-.25, 1.25], y: [-.25, 1.25], igual: true,
        curvas: [{ id: 't', nombre: '$y=1-x$', f: x => 1 - x }, { id: 'e', nombre: '$y=0$', f: () => 0 }],
        capas: [{ tipo: 'entre', c: 't', g: 'e', a: 0, b: 1 }, { tipo: 'texto', x: .12, y: .25, s: '$D$' }],
        etiqueta: { es: 'Base D del tetraedro en el plano xy', en: 'Base D of the tetrahedron in the xy-plane' } },
      es: 'La integral triple $\\iiint_Ef\\,dV$ extiende la idea a un sólido $E$; con $f=1$ da su volumen. Ejemplo: el tetraedro $x,y,z\\ge0$, $x+y+z\\le1$. Su base en el plano $xy$ es el triángulo $D$ de la figura, y sobre cada punto $z$ va de $0$ a $1-x-y$.',
      en: 'The triple integral $\\iiint_Ef\\,dV$ extends the idea to a solid $E$; with $f=1$ it gives its volume. Example: the tetrahedron $x,y,z\\ge0$, $x+y+z\\le1$. Its base in the $xy$-plane is the triangle $D$ in the figure, and above each point $z$ runs from $0$ to $1-x-y$.' },
    { es: '$V=\\int_0^1\\!\\int_0^{1-x}\\!\\int_0^{1-x-y}dz\\,dy\\,dx=\\int_0^1\\!\\int_0^{1-x}(1-x-y)\\,dy\\,dx=\\int_0^1\\tfrac{(1-x)^2}{2}dx=\\tfrac16$. Se comprueba con la fórmula de la pirámide: $\\tfrac13\\cdot\\text{base}\\cdot\\text{altura}=\\tfrac13\\cdot\\tfrac12\\cdot1=\\tfrac16$. Fubini sigue valiendo: hay seis órdenes posibles.',
      en: '$V=\\int_0^1\\!\\int_0^{1-x}\\!\\int_0^{1-x-y}dz\\,dy\\,dx=\\int_0^1\\!\\int_0^{1-x}(1-x-y)\\,dy\\,dx=\\int_0^1\\tfrac{(1-x)^2}{2}dx=\\tfrac16$. Check with the pyramid formula: $\\tfrac13\\cdot\\text{base}\\cdot\\text{height}=\\tfrac13\\cdot\\tfrac12\\cdot1=\\tfrac16$. Fubini still holds: there are six possible orders.' },

    // ── Cilíndricas ──
    { sec: { es: 'Coordenadas cilíndricas', en: 'Cylindrical coordinates' },
      campo: { f: (x, y) => (x * x + y * y <= 4 ? 4 - x * x - y * y : NaN), x: [-2, 2], y: [-2, 2], z: [0, 4], modo: 'superficie', par: {}, capas: [],
        etiqueta: { es: 'Paraboloide z = 4 − r² sobre el disco r ≤ 2', en: 'Paraboloid z = 4 − r² over the disc r ≤ 2' } },
      es: 'En **cilíndricas** $(r,\\theta,z)$: $x=r\\cos\\theta$, $y=r\\sin\\theta$, $z=z$, y $dV=r\\,dz\\,dr\\,d\\theta$: es polares más la altura, con el mismo jacobiano $r$. Conviene cuando hay un eje de simetría. Aquí, el sólido bajo $z=4-r^2$ y sobre el plano $z=0$. Gíralo.',
      en: 'In **cylindrical** coordinates $(r,\\theta,z)$: $x=r\\cos\\theta$, $y=r\\sin\\theta$, $z=z$, and $dV=r\\,dz\\,dr\\,d\\theta$: polar plus height, with the same Jacobian $r$. It fits when there is an axis of symmetry. Here, the solid under $z=4-r^2$ and above the plane $z=0$. Rotate it.' },
    { es: '$V=\\int_0^{2\\pi}\\!\\int_0^2\\!\\int_0^{4-r^2}r\\,dz\\,dr\\,d\\theta=2\\pi\\int_0^2r(4-r^2)\\,dr=2\\pi\\Bigl[2r^2-\\tfrac{r^4}{4}\\Bigr]_0^2=2\\pi(8-4)=8\\pi\\approx25{,}13$. En cartesianas habría que integrar $\\sqrt{4-x^2}$: mucho más trabajo.',
      en: '$V=\\int_0^{2\\pi}\\!\\int_0^2\\!\\int_0^{4-r^2}r\\,dz\\,dr\\,d\\theta=2\\pi\\int_0^2r(4-r^2)\\,dr=2\\pi\\Bigl[2r^2-\\tfrac{r^4}{4}\\Bigr]_0^2=2\\pi(8-4)=8\\pi\\approx25.13$. In Cartesian form you would have to integrate $\\sqrt{4-x^2}$: far more work.' },

    // ── Esféricas ──
    { sec: { es: 'Coordenadas esféricas', en: 'Spherical coordinates' },
      funcion: { x: [-3, 3], y: [-3, 3], igual: true,
        curvas: [{ id: 'c', nombre: { es: '$\\rho=2$', en: '$\\rho=2$' }, param: { x: t => 2 * Math.cos(t), y: t => 2 * Math.sin(t), t: [0, 2 * PI] } }],
        capas: [
          { tipo: 'linea', x1: 0, y1: -2.6, x2: 0, y2: 2.6 }, { tipo: 'linea', x1: 0, y1: 0, x2: 1.532, y2: 1.286 },
          { tipo: 'texto', x: .78, y: .55, s: '$\\rho$' }, { tipo: 'texto', x: .05, y: .9, s: '$\\varphi$' }, { tipo: 'texto', x: .05, y: 2.45, s: '$z$' }, { tipo: 'texto', x: 1.5, y: -.25, s: '$r=\\rho\\operatorname{sen}\\varphi$' },
        ],
        etiqueta: { es: 'Corte meridiano de una esfera de radio 2', en: 'Meridian cut of a sphere of radius 2' } },
      es: 'En **esféricas** $(\\rho,\\varphi,\\theta)$: $\\rho$ es la distancia al origen, $\\varphi\\in[0,\\pi]$ el ángulo con el eje $z$ y $\\theta$ el acimut. $x=\\rho\\sin\\varphi\\cos\\theta$, $y=\\rho\\sin\\varphi\\sin\\theta$, $z=\\rho\\cos\\varphi$. La figura es un corte meridiano: aquí $\\varphi=50^\\circ$, y la distancia al eje es $\\rho\\sin\\varphi$.',
      en: 'In **spherical** coordinates $(\\rho,\\varphi,\\theta)$: $\\rho$ is the distance to the origin, $\\varphi\\in[0,\\pi]$ the angle from the $z$-axis and $\\theta$ the azimuth. $x=\\rho\\sin\\varphi\\cos\\theta$, $y=\\rho\\sin\\varphi\\sin\\theta$, $z=\\rho\\cos\\varphi$. The figure is a meridian cut: here $\\varphi=50^\\circ$, and the distance to the axis is $\\rho\\sin\\varphi$.' },
    { es: 'El jacobiano es $\\rho^2\\sin\\varphi$: $dV=\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta$ (una casilla mide $d\\rho$, $\\rho\\,d\\varphi$ y $\\rho\\sin\\varphi\\,d\\theta$). Bola de radio $2$: $V=\\int_0^{2\\pi}\\!\\int_0^\\pi\\!\\int_0^2\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta=2\\pi\\cdot2\\cdot\\tfrac83=\\tfrac{32\\pi}{3}\\approx33{,}51$.',
      en: 'The Jacobian is $\\rho^2\\sin\\varphi$: $dV=\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta$ (a cell measures $d\\rho$, $\\rho\\,d\\varphi$ and $\\rho\\sin\\varphi\\,d\\theta$). Ball of radius $2$: $V=\\int_0^{2\\pi}\\!\\int_0^\\pi\\!\\int_0^2\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta=2\\pi\\cdot2\\cdot\\tfrac83=\\tfrac{32\\pi}{3}\\approx33.51$.' },
    { es: 'Sea $B$ la bola unidad. ¿Cuánto vale $\\iiint_B(x^2+y^2+z^2)\\,dV$?',
      en: 'Let $B$ be the unit ball. What is $\\iiint_B(x^2+y^2+z^2)\\,dV$?',
      pregunta: {
        opc: [
          { es: '$\\tfrac{4\\pi}{3}$', en: '$\\tfrac{4\\pi}{3}$' },
          { es: '$\\tfrac{4\\pi}{5}$', en: '$\\tfrac{4\\pi}{5}$', ok: 1 },
          { es: '$\\tfrac{2\\pi^2}{5}$', en: '$\\tfrac{2\\pi^2}{5}$' },
        ],
        why: {
          es: 'Como $x^2+y^2+z^2=\\rho^2$: $\\int_0^{2\\pi}\\!\\int_0^\\pi\\!\\int_0^1\\rho^2\\cdot\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta=2\\pi\\cdot2\\cdot\\tfrac15=\\tfrac{4\\pi}5$. $\\tfrac{4\\pi}3$ es el volumen, y $\\tfrac{2\\pi^2}5$ sale de olvidar $\\sin\\varphi$ ($\\int_0^\\pi d\\varphi=\\pi$).',
          en: 'Since $x^2+y^2+z^2=\\rho^2$: $\\int_0^{2\\pi}\\!\\int_0^\\pi\\!\\int_0^1\\rho^2\\cdot\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta=2\\pi\\cdot2\\cdot\\tfrac15=\\tfrac{4\\pi}5$. $\\tfrac{4\\pi}3$ is the volume, and $\\tfrac{2\\pi^2}5$ comes from forgetting $\\sin\\varphi$ ($\\int_0^\\pi d\\varphi=\\pi$).',
        },
      } },
    { sec: { es: 'Resumen', en: 'Summary' },
      es: 'Elige las coordenadas por la simetría de la región o del integrando. Polares: $dA=r\\,dr\\,d\\theta$. Cilíndricas: $dV=r\\,dz\\,dr\\,d\\theta$. Esféricas: $dV=\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta$. Cambiar de coordenadas sin el jacobiano da un resultado equivocado aunque los límites sean correctos.',
      en: 'Choose the coordinates by the symmetry of the region or of the integrand. Polar: $dA=r\\,dr\\,d\\theta$. Cylindrical: $dV=r\\,dz\\,dr\\,d\\theta$. Spherical: $dV=\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta$. Changing coordinates without the Jacobian gives a wrong result even when the limits are right.' },
  ],
};
