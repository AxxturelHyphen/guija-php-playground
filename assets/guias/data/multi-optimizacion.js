// Guía «Optimización: puntos críticos y Lagrange» (Multivariable). Usa la escena `campo` (formato en la cabecera de assets/guias/campo.js).
// Parte A: ∇f = 0 y Hessiana con tres superficies (mínimo, máximo, silla) y un ejemplo con varios extremos (x³ − 3x + y³ − 3y).
// Parte B: Lagrange con f = xy sobre x² + y² = 2. El punto de la restricción se maneja con un deslizador (s, grados) y sus
// coordenadas son parámetros DERIVADOS (px, py) que recalcula `soltar` (por eso los pasos con deslizador llevan `jugar`).
const V = { x: [-2, 2], y: [-2, 2] };
const f1 = (x, y) => x * x + x * y + y * y;            // mínimo: D = 3, fxx = 2
const f2 = (x, y) => 4 - x * x - 2 * y * y;            // máximo: D = 8, fxx = -2
const f3 = (x, y) => x * x + 3 * x * y + y * y;        // silla: D = -5, fxx = 2
const f4 = (x, y) => x ** 3 - 3 * x + y ** 3 - 3 * y;  // (±1, ±1): D = 36xy
const fl = (x, y) => x * y;                            // Lagrange
const gl = (x, y) => x * x + y * y;                    // restricción g = c

const rad = a => a * Math.PI / 180;
const limpio = x => (Math.abs(x) < 1e-9 ? 0 : x);
const P = { tipo: 'punto', x: 'x0', y: 'y0' };
const CAMPO = { tipo: 'campo', grad: true, n: 9 };
const pc = (x, y) => ({ tipo: 'punto', x, y });
const rot = (s, etiqueta) => ({ tipo: 'texto', x: s[0], y: s[1], s: etiqueta });
const abrir = (f, modo, etq, capas, extra = {}) => ({ f, ...V, modo, par: { x0: 0, y0: 0 }, arrastrar: ['x0', 'y0'], capas, etiqueta: etq, ...extra });

// ── Parte A: puntos críticos de f4 ──
const CRIT = [pc(1, 1), pc(-1, -1), pc(1, -1), pc(-1, 1),
  rot([1, 1], { es: 'mín', en: 'min' }), rot([-1, -1], { es: 'máx', en: 'max' }), rot([1, -1], { es: 'silla', en: 'saddle' }), rot([-1, 1], { es: 'silla', en: 'saddle' })];
const tipo = (x, y) => { // clasificación con D = 36xy y fxx = 6x
  if (Math.hypot(3 * x * x - 3, 3 * y * y - 3) > .25) return '—';
  const D = 36 * x * y; return D < 0 ? 'silla / saddle' : D > 0 ? (x > 0 ? 'min' : 'max') : '?';
};
const salto = (x, y) => ({ hacer: v => { v.x0 = x; v.y0 = y; } });

// ── Parte B: restricción x² + y² = 2 recorrida con el ángulo s ──
const R2 = Math.SQRT2;
const circ = s => ({ s, px: R2 * Math.cos(rad(s)), py: R2 * Math.sin(rad(s)) });
const ponerS = v => { v.px = R2 * Math.cos(rad(v.s)); v.py = R2 * Math.sin(rad(v.s)); };
const RESTR = { tipo: 'restriccion', g: gl, c: 2 };
const LAG_CAPAS = [RESTR, pc('px', 'py'), { tipo: 'gradiente', x: 'px', y: 'py', k: 1.5 }];
const LAG_J = {
  botones: [45, 135, 225, 315, 0].map(s => ({ label: `s = ${s}°`, hacer: v => { v.s = s; ponerS(v); } })),
  lecturas: (v, cx) => {
    const x = v.px, y = v.py;
    return [
      { expr: '(x, y)', valor: `(${cx.fmt(x)}, ${cx.fmt(y)})` },
      { expr: 'f = xy', valor: cx.fmt(cx.f(x, y)), malo: x * y < 0 },
      { expr: '∇f = (y, x)', valor: `(${cx.fmt(y)}, ${cx.fmt(x)})` },
      { expr: '∇g = (2x, 2y)', valor: `(${cx.fmt(2 * x)}, ${cx.fmt(2 * y)})` },
      { expr: 'fₓ·g_y − f_y·gₓ', valor: cx.fmt(limpio(2 * (y * y - x * x))) },
    ];
  },
  arrastrables: true, soltar: (v, par, val) => { v[par] = val; ponerS(v); },
};
const lagrange = (extra = {}) => ({ f: fl, ...V, modo: 'nivel', niveles: [-2, -1, -.5, .5, 1, 2], par: circ(0), capas: LAG_CAPAS,
  deslizadores: [{ par: 's', min: 0, max: 360, paso: 5, es: 'Posición en la restricción s (grados)', en: 'Position on the constraint s (degrees)' }],
  etiqueta: { es: 'Mapa de nivel de f = xy y la restricción x² + y² = 2', en: 'Contour map of f = xy and the constraint x² + y² = 2' }, ...extra });

// Parte B, último paso: el multiplicador como tasa de cambio del óptimo respecto de c
const ponerC = v => { v.px = v.py = Math.sqrt(v.c / 2); };
const cDe = c => ({ hacer: v => { v.c = c; ponerC(v); } });

export default {
  titulo: { es: 'Optimización: puntos críticos y Lagrange', en: 'Optimization: critical points and Lagrange' },
  fuentes: [
    'Auroux, D. (2010). *18.02SC Multivariable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 3*. OpenStax. https://openstax.org/books/calculus-volume-3/pages/preface',
  ],
  pasos: [
    // ── A. Puntos críticos ──
    { sec: { es: 'Puntos críticos', en: 'Critical points' },
      campo: abrir(f1, 'superficie', { es: 'Superficie z = x² + xy + y²', en: 'Surface z = x² + xy + y²' }, [P]),
      es: 'En un mínimo o máximo local la superficie está «plana» en el punto: a primer orden no hay dirección de subida ni de bajada. Se escribe con el gradiente: $\\nabla f=(f_x,\\,f_y)=(0,\\,0)$. Esos puntos se llaman **puntos críticos**. Esta superficie es $f(x,y)=x^2+xy+y^2$. Gírala.',
      en: 'At a local minimum or maximum the surface is "flat" at the point: to first order there is no direction of ascent or descent. In terms of the gradient: $\\nabla f=(f_x,\\,f_y)=(0,\\,0)$. Such points are called **critical points**. This surface is $f(x,y)=x^2+xy+y^2$. Rotate it.' },
    { modo: 'nivel', capas: [P, CAMPO],
      es: 'Con el campo $\\nabla f$ sobre el mapa de nivel: las flechas apuntan cuesta arriba y se encogen hacia el centro. Se resuelve $f_x=2x+y=0$ y $f_y=x+2y=0$: de la primera $y=-2x$, y en la segunda $x-4x=0$, así que $x=0$ e $y=0$. El único punto crítico es el origen.',
      en: 'With the field $\\nabla f$ on the contour map: arrows point uphill and shrink toward the centre. Solve $f_x=2x+y=0$ and $f_y=x+2y=0$: from the first, $y=-2x$, and in the second $x-4x=0$, so $x=0$ and $y=0$. The only critical point is the origin.' },
    { sec: { es: '∇f = 0 no basta', en: '∇f = 0 is not enough' },
      campo: abrir(f3, 'superficie', { es: 'Superficie z = x² + 3xy + y²', en: 'Surface z = x² + 3xy + y²' },
        [P, { tipo: 'camino', x: t => t, y: t => t, t: [-2, 2] }, { tipo: 'camino', x: t => t, y: t => -t, t: [-2, 2] }]),
      es: 'Ahora $f(x,y)=x^2+3xy+y^2$: $f_x=2x+3y$ y $f_y=3x+2y$ solo se anulan en $(0,0)$. Pero **no es un mínimo**: por $y=x$ vale $5x^2\\ge0$ (sube) y por $y=-x$ vale $-x^2\\le0$ (baja). Es una **silla**. Hace falta mirar la curvatura.',
      en: 'Now $f(x,y)=x^2+3xy+y^2$: $f_x=2x+3y$ and $f_y=3x+2y$ vanish only at $(0,0)$. But it is **not a minimum**: along $y=x$ it equals $5x^2\\ge0$ (rises) and along $y=-x$ it equals $-x^2\\le0$ (falls). It is a **saddle**. We need to look at curvature.' },
    { sec: { es: 'Hessiana y discriminante', en: 'Hessian and discriminant' },
      es: 'La **Hessiana** reúne las segundas derivadas: $H=\\begin{pmatrix}f_{xx}&f_{xy}\\\\f_{xy}&f_{yy}\\end{pmatrix}$, y su determinante es el **discriminante** $D=f_{xx}f_{yy}-f_{xy}^2$. En un punto crítico: $D>0$ y $f_{xx}>0$, mínimo local; $D>0$ y $f_{xx}<0$, máximo local; $D<0$, silla; $D=0$, no concluye.',
      en: 'The **Hessian** collects the second derivatives: $H=\\begin{pmatrix}f_{xx}&f_{xy}\\\\f_{xy}&f_{yy}\\end{pmatrix}$, and its determinant is the **discriminant** $D=f_{xx}f_{yy}-f_{xy}^2$. At a critical point: $D>0$ and $f_{xx}>0$, local minimum; $D>0$ and $f_{xx}<0$, local maximum; $D<0$, saddle; $D=0$, inconclusive.' },
    { es: 'Para $f=x^2+3xy+y^2$: $f_{xx}=2$, $f_{yy}=2$, $f_{xy}=3$. ¿Qué es el origen?',
      en: 'For $f=x^2+3xy+y^2$: $f_{xx}=2$, $f_{yy}=2$, $f_{xy}=3$. What is the origin?',
      pregunta: {
        opc: [
          { es: 'Mínimo local, porque $f_{xx}>0$ y $f_{yy}>0$', en: 'Local minimum, because $f_{xx}>0$ and $f_{yy}>0$' },
          { es: 'Silla, porque $D=2\\cdot2-3^2=-5<0$', en: 'Saddle, because $D=2\\cdot2-3^2=-5<0$', ok: 1 },
          { es: 'Máximo local, porque $D<0$', en: 'Local maximum, because $D<0$' },
        ],
        why: {
          es: 'Mirar solo el signo de $f_{xx}$ y $f_{yy}$ engaña: el término cruzado $f_{xy}=3$ pesa más ($D=4-9=-5$). Con $D<0$ siempre hay silla, sea cual sea el signo de $f_{xx}$.',
          en: 'Looking only at the sign of $f_{xx}$ and $f_{yy}$ is misleading: the cross term $f_{xy}=3$ weighs more ($D=4-9=-5$). With $D<0$ it is always a saddle, whatever the sign of $f_{xx}$.',
        },
      } },
    { sec: { es: 'Mínimo y máximo', en: 'Minimum and maximum' },
      campo: abrir(f2, 'superficie', { es: 'Superficie z = 4 − x² − 2y²', en: 'Surface z = 4 − x² − 2y²' }, [P]),
      es: 'Con $f(x,y)=4-x^2-2y^2$: $f_x=-2x$, $f_y=-4y$, crítico en $(0,0)$; $f_{xx}=-2$, $f_{yy}=-4$, $f_{xy}=0$, luego $D=8>0$ y $f_{xx}<0$: **máximo local**, $f(0,0)=4$. Para el cuenco anterior, $x^2+xy+y^2$, sale $D=2\\cdot2-1^2=3>0$ y $f_{xx}=2>0$: **mínimo local**.',
      en: 'With $f(x,y)=4-x^2-2y^2$: $f_x=-2x$, $f_y=-4y$, critical at $(0,0)$; $f_{xx}=-2$, $f_{yy}=-4$, $f_{xy}=0$, so $D=8>0$ and $f_{xx}<0$: **local maximum**, $f(0,0)=4$. For the earlier bowl, $x^2+xy+y^2$, we get $D=2\\cdot2-1^2=3>0$ and $f_{xx}=2>0$: **local minimum**.' },

    // ── Varios extremos ──
    { sec: { es: 'Varios extremos locales', en: 'Several local extrema' },
      campo: abrir(f4, 'nivel', { es: 'Mapa de nivel de f = x³ − 3x + y³ − 3y', en: 'Contour map of f = x³ − 3x + y³ − 3y' }, CRIT),
      es: 'Con $f(x,y)=x^3-3x+y^3-3y$: $f_x=3x^2-3$ y $f_y=3y^2-3$ se anulan por separado, en $x=\\pm1$ e $y=\\pm1$. Hay **cuatro** puntos críticos: $(1,1)$, $(-1,-1)$, $(1,-1)$ y $(-1,1)$. ¿Cuáles son mínimos, máximos o sillas? Lo decide la Hessiana en cada uno.',
      en: 'With $f(x,y)=x^3-3x+y^3-3y$: $f_x=3x^2-3$ and $f_y=3y^2-3$ vanish separately, at $x=\\pm1$ and $y=\\pm1$. There are **four** critical points: $(1,1)$, $(-1,-1)$, $(1,-1)$ and $(-1,1)$. Which are minima, maxima or saddles? The Hessian at each one decides.' },
    { modo: 'superficie',
      es: 'Aquí $f_{xx}=6x$, $f_{yy}=6y$, $f_{xy}=0$, así que $D=36xy$. En $(1,1)$: $D=36>0$, $f_{xx}=6>0$, mínimo, $f=-4$. En $(-1,-1)$: $D=36>0$, $f_{xx}=-6<0$, máximo, $f=4$. En $(1,-1)$ y $(-1,1)$: $D=-36<0$, sillas, $f=0$. Son extremos **locales**: $f$ no está acotada.',
      en: 'Here $f_{xx}=6x$, $f_{yy}=6y$, $f_{xy}=0$, so $D=36xy$. At $(1,1)$: $D=36>0$, $f_{xx}=6>0$, minimum, $f=-4$. At $(-1,-1)$: $D=36>0$, $f_{xx}=-6<0$, maximum, $f=4$. At $(1,-1)$ and $(-1,1)$: $D=-36<0$, saddles, $f=0$. They are **local** extrema: $f$ is unbounded.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, modo: 'nivel', capas: [P, { tipo: 'gradiente', x: 'x0', y: 'y0' }],
      es: 'Arrastra el punto o salta a cada punto crítico. Donde la flecha del gradiente desaparece, estás en un punto crítico; la lectura $D=36xy$ y el signo de $f_{xx}=6x$ dicen de qué tipo.',
      en: 'Drag the point or jump to each critical point. Where the gradient arrow disappears you are at a critical point; the reading $D=36xy$ and the sign of $f_{xx}=6x$ tell you its type.',
      jugar: {
        botones: [
          { label: { es: 'ir a (1, 1)', en: 'go to (1, 1)' }, ...salto(1, 1) },
          { label: { es: 'ir a (−1, −1)', en: 'go to (−1, −1)' }, ...salto(-1, -1) },
          { label: { es: 'ir a (1, −1)', en: 'go to (1, −1)' }, ...salto(1, -1) },
          { label: { es: 'ir a (−1, 1)', en: 'go to (−1, 1)' }, ...salto(-1, 1) },
        ],
        lecturas: (v, cx) => [
          { expr: '(x, y)', valor: `(${cx.fmt(v.x0)}, ${cx.fmt(v.y0)})` },
          { expr: 'f(x, y)', valor: cx.fmt(cx.f(v.x0, v.y0)) },
          { expr: '|∇f|', valor: cx.fmt(Math.hypot(3 * v.x0 * v.x0 - 3, 3 * v.y0 * v.y0 - 3)) },
          { expr: 'D = 36xy', valor: cx.fmt(36 * v.x0 * v.y0), malo: v.x0 * v.y0 < 0 },
          { expr: 'tipo / type', valor: tipo(v.x0, v.y0) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { par: { x0: -1, y0: -1 },
      es: 'En $(-1,\\,-1)$: $f_{xx}=-6$, $f_{yy}=-6$, $f_{xy}=0$. ¿Qué tipo de punto crítico es?',
      en: 'At $(-1,\\,-1)$: $f_{xx}=-6$, $f_{yy}=-6$, $f_{xy}=0$. What kind of critical point is it?',
      pregunta: {
        opc: [
          { es: 'Mínimo local', en: 'Local minimum' },
          { es: 'Máximo local: $D=36>0$ y $f_{xx}<0$', en: 'Local maximum: $D=36>0$ and $f_{xx}<0$', ok: 1 },
          { es: 'Silla', en: 'Saddle' },
        ],
        why: {
          es: '$D=(-6)(-6)-0^2=36>0$ y $f_{xx}=-6<0$: máximo local, con $f(-1,-1)=4$. Con el mismo $D$ pero $f_{xx}>0$ sería un mínimo, que es lo que pasa en $(1,1)$.',
          en: '$D=(-6)(-6)-0^2=36>0$ and $f_{xx}=-6<0$: local maximum, with $f(-1,-1)=4$. With the same $D$ but $f_{xx}>0$ it would be a minimum, which is what happens at $(1,1)$.',
        },
      } },

    // ── B. Lagrange ──
    { sec: { es: 'Optimizar con una restricción', en: 'Optimizing with a constraint' },
      campo: { f: fl, ...V, modo: 'nivel', niveles: [-2, -1, -.5, .5, 1, 2], par: {}, capas: [RESTR],
        etiqueta: { es: 'Mapa de nivel de f = xy y la restricción x² + y² = 2', en: 'Contour map of f = xy and the constraint x² + y² = 2' } },
      es: 'Buscamos el máximo y el mínimo de $f(x,y)=xy$ **solo sobre la curva** $g(x,y)=x^2+y^2=2$ (en rojo). Sin restricción, $\\nabla f=(y,\\,x)$ solo se anula en $(0,0)$, una silla ($D=-1$), y ni siquiera está en la curva. Las curvas de nivel de $f$ son hipérbolas $xy=k$.',
      en: 'We look for the maximum and minimum of $f(x,y)=xy$ **only on the curve** $g(x,y)=x^2+y^2=2$ (red). Without the constraint, $\\nabla f=(y,\\,x)$ vanishes only at $(0,0)$, a saddle ($D=-1$), and that is not even on the curve. The level curves of $f$ are hyperbolas $xy=k$.' },
    { sec: { es: 'Recorre la restricción', en: 'Walk along the constraint' },
      campo: lagrange(), jugar: LAG_J,
      es: 'Mueve $s$ para recorrer la circunferencia. Mira cómo cambia $f$ y dónde la curva roja **roza** una curva de nivel sin cruzarla: ahí no se puede mejorar $f$ avanzando por la restricción. La flecha verde es $\\nabla f$.',
      en: 'Move $s$ to walk around the circle. Watch how $f$ changes and where the red curve **grazes** a level curve without crossing it: there $f$ cannot be improved by moving along the constraint. The green arrow is $\\nabla f$.' },
    { sec: { es: 'Gradientes paralelos', en: 'Parallel gradients' }, par: circ(45), jugar: LAG_J,
      capas: [...LAG_CAPAS, { tipo: 'campo', F: (x, y) => [2 * x, 2 * y], n: 9 }],
      es: 'En $(1,1)$: $\\nabla f=(1,\\,1)$ y $\\nabla g=(2,\\,2)$ (flechas blancas: el campo de $\\nabla g$, siempre perpendicular a la circunferencia). Son **paralelos**. Si $\\nabla f$ tuviera componente tangente a la curva, avanzarías por ella y $f$ cambiaría. La última lectura, $f_xg_y-f_yg_x$, vale $0$ cuando son paralelos.',
      en: 'At $(1,1)$: $\\nabla f=(1,\\,1)$ and $\\nabla g=(2,\\,2)$ (white arrows: the field of $\\nabla g$, always perpendicular to the circle). They are **parallel**. If $\\nabla f$ had a component tangent to the curve, you could move along it and $f$ would change. The last reading, $f_xg_y-f_yg_x$, is $0$ when they are parallel.' },
    { sec: { es: 'Multiplicadores de Lagrange', en: 'Lagrange multipliers' }, jugar: LAG_J,
      es: 'Condición: $\\nabla f=\\lambda\\nabla g$ y $g=c$. Aquí $y=2\\lambda x$, $x=2\\lambda y$, $x^2+y^2=2$. Sustituyendo, $x=4\\lambda^2x$: o $x=0$ (entonces $y=0$, fuera de la curva) o $\\lambda=\\pm\\tfrac12$, es decir $y=\\pm x$ y $2x^2=2$. Candidatos: $(1,1)$ y $(-1,-1)$ con $f=1$; $(1,-1)$ y $(-1,1)$ con $f=-1$.',
      en: 'Condition: $\\nabla f=\\lambda\\nabla g$ and $g=c$. Here $y=2\\lambda x$, $x=2\\lambda y$, $x^2+y^2=2$. Substituting, $x=4\\lambda^2x$: either $x=0$ (then $y=0$, off the curve) or $\\lambda=\\pm\\tfrac12$, i.e. $y=\\pm x$ and $2x^2=2$. Candidates: $(1,1)$ and $(-1,-1)$ with $f=1$; $(1,-1)$ and $(-1,1)$ with $f=-1$.' },
    { par: circ(315), jugar: LAG_J,
      es: 'En $(1,\\,-1)$: $\\nabla f=(-1,\\,1)$ y $\\nabla g=(2,\\,-2)$. ¿Cuánto vale $\\lambda$ en $\\nabla f=\\lambda\\nabla g$?',
      en: 'At $(1,\\,-1)$: $\\nabla f=(-1,\\,1)$ and $\\nabla g=(2,\\,-2)$. What is $\\lambda$ in $\\nabla f=\\lambda\\nabla g$?',
      pregunta: {
        opc: [
          { es: '$\\tfrac12$', en: '$\\tfrac12$' },
          { es: '$-\\tfrac12$', en: '$-\\tfrac12$', ok: 1 },
          { es: '$-2$', en: '$-2$' },
        ],
        why: {
          es: '$(-1,\\,1)=\\lambda\\,(2,\\,-2)$ da $\\lambda=-\\tfrac12$. Es negativo porque los gradientes son paralelos pero de sentido opuesto; ese punto es el mínimo restringido, $f=-1$. El $-2$ invierte el cociente.',
          en: '$(-1,\\,1)=\\lambda\\,(2,\\,-2)$ gives $\\lambda=-\\tfrac12$. It is negative because the gradients are parallel but opposite; this point is the constrained minimum, $f=-1$. The $-2$ inverts the ratio.',
        },
      } },
    { sec: { es: 'La restricción sobre la superficie', en: 'The constraint on the surface' }, modo: 'superficie', par: circ(45), jugar: LAG_J,
      capas: [RESTR, pc('px', 'py')],
      es: 'En la superficie $z=xy$, la restricción es una curva elevada sobre la circunferencia. Sobre ella $f=xy=\\operatorname{sen}2s$, que oscila entre $-1$ y $1$: dos máximos ($s=45^\\circ$, $225^\\circ$) y dos mínimos ($135^\\circ$, $315^\\circ$), justo los cuatro candidatos.',
      en: 'On the surface $z=xy$, the constraint is a curve raised above the circle. On it $f=xy=\\sin2s$, which oscillates between $-1$ and $1$: two maxima ($s=45^\\circ$, $225^\\circ$) and two minima ($135^\\circ$, $315^\\circ$), exactly the four candidates.' },
    { sec: { es: 'Qué mide λ', en: 'What λ measures' },
      campo: { f: fl, ...V, modo: 'nivel', par: { c: 2, px: 1, py: 1 }, capas: [{ tipo: 'restriccion', g: gl, c: 'c' }, pc('px', 'py')],
        deslizadores: [{ par: 'c', min: .5, max: 3.5, paso: .1, es: 'Valor de la restricción c', en: 'Constraint value c' }],
        etiqueta: { es: 'Restricción x² + y² = c y su máximo de f = xy', en: 'Constraint x² + y² = c and its maximum of f = xy' } },
      jugar: {
        botones: [{ label: 'c = 1', ...cDe(1) }, { label: 'c = 2', ...cDe(2) }, { label: 'c = 3', ...cDe(3) }],
        lecturas: (v, cx) => [
          { expr: 'c', valor: cx.fmt(v.c) },
          { expr: 'f máx = f(P)', valor: cx.fmt(cx.f(v.px, v.py)) },
          { expr: 'f máx / c', valor: cx.fmt(cx.f(v.px, v.py) / v.c) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; ponerC(v); },
      },
      es: 'Al subir $c$ crece la circunferencia ($r=\\sqrt c$) y el máximo pasa a ser $f_{\\max}=c/2$, porque $xy\\le\\tfrac{x^2+y^2}2$. Su tasa de cambio, $\\dfrac{df_{\\max}}{dc}=\\tfrac12$, es justo $\\lambda$: el multiplicador mide cuánto mejora el óptimo si relajas la restricción una unidad.',
      en: 'As $c$ grows, the circle grows ($r=\\sqrt c$) and the maximum becomes $f_{\\max}=c/2$, because $xy\\le\\tfrac{x^2+y^2}2$. Its rate of change, $\\dfrac{df_{\\max}}{dc}=\\tfrac12$, is exactly $\\lambda$: the multiplier measures how much the optimum improves if you relax the constraint by one unit.' },
  ],
};
