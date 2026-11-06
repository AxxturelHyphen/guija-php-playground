// Guía «Técnicas de integración» (Cálculo II). Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Cuatro bloques: partes (área), fracciones parciales (la suma reproduce la curva), sustitución trigonométrica
// (triángulo dibujado) e integrales impropias (b arrastrable). Las capas que dependen de parámetros calculados
// (triángulo, apilado de fracciones) solo se enlazan a `par` en el paso `jugar`; en los demás llevan números fijos.
const r3 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(4)]));
const lim = (x, a, b) => Math.min(b, Math.max(a, x));

// ── 1. Partes: y = ln x entre 1 y e ──
const PARTES = [
  { id: 'f', nombre: 'ln x', f: x => Math.log(x) },
  { id: 'top', nombre: 'y = 1', f: () => 1 },
  { id: 'lnp', nombre: 'max(0, ln x)', f: x => (x <= 1 ? 0 : Math.log(x)) },
];
const BAJO = { tipo: 'riemann', c: 'f', a: 1, b: Math.E, n: 1, m: 'exacta' };
const IZQ = { tipo: 'entre', c: 'top', g: 'lnp', a: 0, b: Math.E };
const PUNTOS = [{ tipo: 'punto', c: 'f', x: 1 }, { tipo: 'punto', c: 'f', x: Math.E }];
const ROT1 = { tipo: 'texto', x: 1.55, y: .27, s: { es: '∫ y dx = 1', en: '∫ y dx = 1' } };
const ROT2 = { tipo: 'texto', x: .06, y: .5, s: { es: '∫ x dy = e − 1', en: '∫ x dy = e − 1' } };

// ── 2. Fracciones parciales: f = 2/(x−1) − 1/(x+2) ──
const P = x => 2 / (x - 1), Q = x => -1 / (x + 2), FN = x => (x + 5) / ((x - 1) * (x + 2));
const pila = ([x0, yp, yf]) => [
  { tipo: 'punto', c: 'f', x: x0 }, { tipo: 'punto', c: 'p', x: x0 }, { tipo: 'punto', c: 'q', x: x0 },
  { tipo: 'linea', x1: x0, y1: 0, x2: x0, y2: yp }, { tipo: 'linea', x1: x0, y1: yp, x2: x0, y2: yf },
];
const est2 = (x, k) => r3({ [k[0]]: x, [k[1]]: P(x), [k[2]]: FN(x) });
const KU = ['u0', 'up', 'uf'], KX = ['x0', 'yp', 'yf'];

// ── 3. Sustitución trigonométrica: ∫ √(4 − x²) dx, x = 2 sen θ ──
const FT = x => x * Math.sqrt(Math.max(0, 4 - x * x)) / 2 + 2 * Math.asin(lim(x / 2, -1, 1)); // área acumulada desde 0
const tri = px => {
  px = lim(px, 0, 2); const py = Math.sqrt(Math.max(0, 4 - px * px));
  return r3({ px, py, ax: px / 2, ay: -.22, bx: px + .07, by: py / 2, hx: px / 2 - .08, hy: py / 2 + .1, qx: px - .07, qy: py - .4 });
};
const capasTri = k => [
  { tipo: 'riemann', c: 'f', a: 0, b: k.px, n: 1, m: 'exacta' },
  { tipo: 'linea', x1: 0, y1: 0, x2: k.px, y2: 0 }, { tipo: 'linea', x1: k.px, y1: 0, x2: k.px, y2: k.py }, { tipo: 'linea', x1: 0, y1: 0, x2: k.px, y2: k.py },
  { tipo: 'punto', c: 'f', x: k.px },
  { tipo: 'texto', x: k.ax, y: k.ay, s: 'x', ancla: 'middle' },
  { tipo: 'texto', x: k.bx, y: k.by, s: '√(4 − x²)' },
  { tipo: 'texto', x: k.hx, y: k.hy, s: '2', ancla: 'end' },
  { tipo: 'texto', x: k.qx, y: k.qy, s: 'θ', ancla: 'end' },
];
const NOM = Object.fromEntries(Object.keys(tri(1)).map(k => [k, k]));

// ── 4. Impropias ──
const BMAX = 12;

export default {
  titulo: { es: 'Técnicas de integración', en: 'Integration techniques' },
  fuentes: [
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 2*. OpenStax. https://openstax.org/books/calculus-volume-2/pages/preface',
  ],
  pasos: [
    // ── Partes ──
    { sec: { es: 'Integración por partes', en: 'Integration by parts' },
      funcion: { x: [-.4, 3.4], y: [-1.4, 1.6], curvas: PARTES, capas: [BAJO, ...PUNTOS],
        etiqueta: { es: 'Gráfica de ln x entre 1 y e con el área bajo la curva', en: 'Graph of ln x between 1 and e with the area under the curve' } },
      ver: ['f'],
      es: 'Integrar la regla del producto da la **integración por partes**: $\\displaystyle\\int u\\,dv=uv-\\int v\\,du$. Tiene una lectura geométrica. La curva $y=\\ln x$ entre $x=1$ y $x=e$ encierra con el eje $x$ el área sombreada, que es $\\int y\\,dx$.',
      en: 'Integrating the product rule gives **integration by parts**: $\\displaystyle\\int u\\,dv=uv-\\int v\\,du$. It has a geometric reading. The curve $y=\\ln x$ between $x=1$ and $x=e$ encloses with the $x$-axis the shaded area, which is $\\int y\\,dx$.' },
    { capas: [BAJO, IZQ, ...PUNTOS, ROT1, ROT2],
      es: 'Ahora mira el área entre la curva y el eje $y$, hasta la altura $y=1$: es $\\int x\\,dy$. Las dos regiones rellenan exactamente el rectángulo $[0,e]\\times[0,1]$, de área $e\\cdot1-1\\cdot0=e$. Es la fórmula con $u=y$ y $v=x$: $\\int y\\,dx+\\int x\\,dy=[xy]$.',
      en: 'Now look at the area between the curve and the $y$-axis, up to height $y=1$: it is $\\int x\\,dy$. The two regions fill exactly the rectangle $[0,e]\\times[0,1]$, of area $e\\cdot1-1\\cdot0=e$. That is the formula with $u=y$ and $v=x$: $\\int y\\,dx+\\int x\\,dy=[xy]$.' },
    { capas: [BAJO, IZQ, ...PUNTOS, ROT1, ROT2],
      es: 'Con $u=\\ln x$ y $dv=dx$ ($du=\\tfrac{dx}{x}$, $v=x$): $\\displaystyle\\int_1^e\\ln x\\,dx=\\bigl[x\\ln x\\bigr]_1^e-\\int_1^e dx=e-(e-1)=1$. La región de la izquierda es $\\int_0^1e^y\\,dy=e-1$. Suman $e$, como pedía el rectángulo.',
      en: 'With $u=\\ln x$ and $dv=dx$ ($du=\\tfrac{dx}{x}$, $v=x$): $\\displaystyle\\int_1^e\\ln x\\,dx=\\bigl[x\\ln x\\bigr]_1^e-\\int_1^e dx=e-(e-1)=1$. The region on the left is $\\int_0^1e^y\\,dy=e-1$. They add up to $e$, as the rectangle demands.' },
    { es: 'Para $\\int x\\,e^x\\,dx$ hay que decidir qué es $u$ y qué es $dv$. ¿Qué elección simplifica la integral?',
      en: 'For $\\int x\\,e^x\\,dx$ you must decide what is $u$ and what is $dv$. Which choice simplifies the integral?',
      pregunta: {
        opc: [
          { es: '$u=e^x$ y $dv=x\\,dx$', en: '$u=e^x$ and $dv=x\\,dx$' },
          { es: '$u=x$ y $dv=e^x\\,dx$', en: '$u=x$ and $dv=e^x\\,dx$', ok: 1 },
          { es: 'Da igual: las dos llevan a lo mismo', en: 'It does not matter: both lead to the same thing' },
        ],
        why: {
          es: 'Conviene que $u$ se simplifique al derivar y que $dv$ sea fácil de integrar. Con $u=x$: $du=dx$, $v=e^x$ y queda $xe^x-\\int e^x\\,dx=(x-1)e^x+C$. Con $u=e^x$ aparece $\\int\\tfrac{x^2}{2}e^x\\,dx$, peor que la original.',
          en: 'You want $u$ to simplify when differentiated and $dv$ to be easy to integrate. With $u=x$: $du=dx$, $v=e^x$ and you get $xe^x-\\int e^x\\,dx=(x-1)e^x+C$. With $u=e^x$ you reach $\\int\\tfrac{x^2}{2}e^x\\,dx$, worse than the original.',
        },
      } },

    // ── Fracciones parciales ──
    { sec: { es: 'Fracciones parciales', en: 'Partial fractions' },
      funcion: { x: [-4, 7], y: [-5, 5],
        curvas: [{ id: 'f', nombre: 'f(x)', f: FN }, { id: 'p', nombre: '2/(x−1)', f: P }, { id: 'q', nombre: '−1/(x+2)', f: Q }],
        par: { x0: 3, yp: P(3), yf: FN(3), ...est2(3, KU) }, arrastrar: 'x0',
        etiqueta: { es: 'Gráfica de f y de sus dos fracciones parciales', en: 'Graph of f and its two partial fractions' } },
      ver: ['f'],
      es: '¿Cómo se integra $f(x)=\\dfrac{x+5}{(x-1)(x+2)}$? No hay una regla directa para un cociente así. Hay dos asíntotas verticales, en $x=1$ y $x=-2$, que ya anuncian que aparecerán logaritmos.',
      en: 'How do we integrate $f(x)=\\dfrac{x+5}{(x-1)(x+2)}$? There is no direct rule for such a quotient. It has two vertical asymptotes, at $x=1$ and $x=-2$, which already hint that logarithms will appear.' },
    { ver: ['f', 'p', 'q'], capas: pila(KU), par: est2(3, KU),
      traza: [
        { par: est2(1.5, KU), es: 'En $x=1{,}5$: $4+(-0{,}29)\\approx3{,}71$. La primera fracción domina cerca de la asíntota $x=1$.', en: 'At $x=1.5$: $4+(-0.29)\\approx3.71$. The first fraction dominates near the asymptote $x=1$.' },
        { par: est2(3, KU), es: 'En $x=3$: $1+(-0{,}2)=0{,}8$, que es $f(3)=\\tfrac{8}{10}$.', en: 'At $x=3$: $1+(-0.2)=0.8$, which is $f(3)=\\tfrac{8}{10}$.' },
        { par: est2(5, KU), es: 'En $x=5$: $0{,}5-0{,}14\\approx0{,}36$.', en: 'At $x=5$: $0.5-0.14\\approx0.36$.' },
        { par: est2(-3, KU), es: 'A la izquierda de $x=-2$ la segunda fracción es positiva: $-0{,}5+1=0{,}5=f(-3)$.', en: 'To the left of $x=-2$ the second fraction is positive: $-0.5+1=0.5=f(-3)$.' },
      ],
      es: '**Fracciones parciales**: $f=\\dfrac{A}{x-1}+\\dfrac{B}{x+2}$, con $A=2$ y $B=-1$. Reproduce la traza: en cada $x$ la altura de $f$ es la de $\\tfrac2{x-1}$ más la de $-\\tfrac1{x+2}$. Primero se sube hasta una curva y luego se suma la otra.',
      en: '**Partial fractions**: $f=\\dfrac{A}{x-1}+\\dfrac{B}{x+2}$, with $A=2$ and $B=-1$. Play the trace: at every $x$ the height of $f$ is that of $\\tfrac2{x-1}$ plus that of $-\\tfrac1{x+2}$. You climb to one curve first and then add the other.' },
    { capas: pila([3, P(3), FN(3)]),
      es: '¿De dónde salen $A$ y $B$? Se multiplica por el denominador: $x+5=A(x+2)+B(x-1)$. En $x=1$ el término de $B$ desaparece: $6=3A$, luego $A=2$. En $x=-2$ desaparece el de $A$: $3=-3B$, luego $B=-1$.',
      en: 'Where do $A$ and $B$ come from? Multiply by the denominator: $x+5=A(x+2)+B(x-1)$. At $x=1$ the $B$ term vanishes: $6=3A$, so $A=2$. At $x=-2$ the $A$ term vanishes: $3=-3B$, so $B=-1$.' },
    { ver: ['f'], capas: [{ tipo: 'riemann', c: 'f', a: 2, b: 3, n: 1, m: 'exacta' }],
      es: 'Cada fracción simple es un logaritmo: $\\displaystyle\\int f\\,dx=2\\ln|x-1|-\\ln|x+2|+C$. Entre $x=2$ y $x=3$ el área sombreada vale $\\bigl(2\\ln2-\\ln5\\bigr)-\\bigl(0-\\ln4\\bigr)=4\\ln2-\\ln5\\approx1{,}163$.',
      en: 'Each simple fraction is a logarithm: $\\displaystyle\\int f\\,dx=2\\ln|x-1|-\\ln|x+2|+C$. Between $x=2$ and $x=3$ the shaded area is $\\bigl(2\\ln2-\\ln5\\bigr)-\\bigl(0-\\ln4\\bigr)=4\\ln2-\\ln5\\approx1.163$.' },
    { sec: { es: 'Súmalo tú', en: 'Add it yourself' }, ver: ['f', 'p', 'q'], par: est2(3, KX), capas: pila(KX),
      es: 'Arrastra por la gráfica (o usa los botones) con $x>1$. La lectura compara la suma de las dos fracciones con $f$: siempre coinciden. La descomposición no aproxima: es una identidad.',
      en: 'Drag along the graph (or use the buttons) with $x>1$. The readout compares the sum of the two fractions with $f$: they always match. The decomposition is not an approximation: it is an identity.',
      jugar: {
        botones: [
          { label: 'x − 0,5', hacer: v => Object.assign(v, est2(Math.max(1.3, v.x0 - .5), KX)), off: v => v.x0 <= 1.3 },
          { label: 'x + 0,5', hacer: v => Object.assign(v, est2(Math.min(6, v.x0 + .5), KX)), off: v => v.x0 >= 6 },
          { label: { es: 'ir a x = 3', en: 'go to x = 3' }, hacer: v => Object.assign(v, est2(3, KX)) },
        ],
        lecturas: (v, cx) => [
          { expr: 'x', valor: cx.fmt(v.x0) },
          { expr: '2/(x−1)', valor: cx.fmt(P(v.x0)) },
          { expr: '−1/(x+2)', valor: cx.fmt(Q(v.x0)) },
          { expr: '2/(x−1) − 1/(x+2)', valor: cx.fmt(P(v.x0) + Q(v.x0)) },
          { expr: 'f(x) = (x+5)/((x−1)(x+2))', valor: cx.fmt(FN(v.x0)) },
        ],
        arrastrables: true, soltar: (v, par, val) => Object.assign(v, est2(lim(val, 1.3, 6), KX)),
      } },
    { es: '¿Qué forma tiene la descomposición de $\\dfrac{1}{x(x+1)^2}$?',
      en: 'What form does the decomposition of $\\dfrac{1}{x(x+1)^2}$ take?',
      pregunta: {
        opc: [
          { es: '$\\dfrac{A}{x}+\\dfrac{B}{(x+1)^2}$', en: '$\\dfrac{A}{x}+\\dfrac{B}{(x+1)^2}$' },
          { es: '$\\dfrac{A}{x}+\\dfrac{B}{x+1}+\\dfrac{C}{(x+1)^2}$', en: '$\\dfrac{A}{x}+\\dfrac{B}{x+1}+\\dfrac{C}{(x+1)^2}$', ok: 1 },
          { es: '$\\dfrac{A}{x}+\\dfrac{B}{x+1}$', en: '$\\dfrac{A}{x}+\\dfrac{B}{x+1}$' },
        ],
        why: {
          es: 'Un factor repetido $(x+1)^2$ exige un término por cada potencia, hasta la multiplicidad: $\\tfrac{B}{x+1}$ y $\\tfrac{C}{(x+1)^2}$. Y si el grado del numerador es mayor o igual que el del denominador, se divide antes de descomponer.',
          en: 'A repeated factor $(x+1)^2$ needs one term per power, up to its multiplicity: $\\tfrac{B}{x+1}$ and $\\tfrac{C}{(x+1)^2}$. And if the numerator degree is at least the denominator degree, divide first and then decompose.',
        },
      } },

    // ── Sustitución trigonométrica ──
    { sec: { es: 'Sustitución trigonométrica', en: 'Trigonometric substitution' },
      funcion: { x: [-.6, 2.9], y: [-.6, 2.5], igual: true, curvas: [{ id: 'f', nombre: '√(4−x²)', f: x => Math.sqrt(4 - x * x) }],
        par: tri(1), arrastrar: 'px', deslizadores: [{ par: 'px', min: 0, max: 2, paso: .01, es: 'Posición x', en: 'Position x' }],
        capas: capasTri(tri(1)), etiqueta: { es: 'Cuarto de circunferencia de radio 2 con un triángulo rectángulo', en: 'Quarter circle of radius 2 with a right triangle' } },
      es: 'En $\\int\\sqrt{4-x^2}\\,dx$ aparece $a^2-x^2$ con $a=2$. Se dibuja un triángulo rectángulo de hipotenusa $2$ y cateto horizontal $x$: el otro cateto mide $\\sqrt{4-x^2}$, justo el radicando. Si $\\theta$ es el ángulo opuesto a $x$, entonces $x=2\\operatorname{sen}\\theta$.',
      en: 'In $\\int\\sqrt{4-x^2}\\,dx$ we meet $a^2-x^2$ with $a=2$. Draw a right triangle with hypotenuse $2$ and horizontal leg $x$: the other leg is $\\sqrt{4-x^2}$, exactly the radicand. If $\\theta$ is the angle opposite $x$, then $x=2\\sin\\theta$.' },
    { es: 'Con $x=2\\operatorname{sen}\\theta$ se tiene $dx=2\\cos\\theta\\,d\\theta$ y $\\sqrt{4-x^2}=\\sqrt{4-4\\operatorname{sen}^2\\theta}=2\\cos\\theta$ (para $\\cos\\theta\\ge0$). La integral queda $\\displaystyle\\int 2\\cos\\theta\\cdot2\\cos\\theta\\,d\\theta=\\int4\\cos^2\\theta\\,d\\theta$.',
      en: 'With $x=2\\sin\\theta$ we get $dx=2\\cos\\theta\\,d\\theta$ and $\\sqrt{4-x^2}=\\sqrt{4-4\\sin^2\\theta}=2\\cos\\theta$ (for $\\cos\\theta\\ge0$). The integral becomes $\\displaystyle\\int 2\\cos\\theta\\cdot2\\cos\\theta\\,d\\theta=\\int4\\cos^2\\theta\\,d\\theta$.' },
    { es: 'Como $4\\cos^2\\theta=2+2\\cos2\\theta$: $\\int4\\cos^2\\theta\\,d\\theta=2\\theta+\\operatorname{sen}2\\theta+C=2\\theta+2\\operatorname{sen}\\theta\\cos\\theta+C$. El triángulo deshace el cambio: $\\operatorname{sen}\\theta=\\tfrac x2$ y $\\cos\\theta=\\tfrac{\\sqrt{4-x^2}}2$. Resultado: $2\\arcsin\\tfrac x2+\\tfrac x2\\sqrt{4-x^2}+C$.',
      en: 'Since $4\\cos^2\\theta=2+2\\cos2\\theta$: $\\int4\\cos^2\\theta\\,d\\theta=2\\theta+\\sin2\\theta+C=2\\theta+2\\sin\\theta\\cos\\theta+C$. The triangle undoes the change: $\\sin\\theta=\\tfrac x2$ and $\\cos\\theta=\\tfrac{\\sqrt{4-x^2}}2$. Result: $2\\arcsin\\tfrac x2+\\tfrac x2\\sqrt{4-x^2}+C$.' },
    { par: tri(2), capas: capasTri(tri(2)),
      es: 'Con límites no hace falta deshacer el cambio: $x=0\\to\\theta=0$ y $x=2\\to\\theta=\\tfrac\\pi2$. Entonces $\\displaystyle\\int_0^2\\sqrt{4-x^2}\\,dx=\\bigl[2\\theta+\\operatorname{sen}2\\theta\\bigr]_0^{\\pi/2}=\\pi$: el área de un cuarto de círculo de radio $2$, $\\tfrac{\\pi\\cdot2^2}{4}$.',
      en: 'With limits there is no need to undo the change: $x=0\\to\\theta=0$ and $x=2\\to\\theta=\\tfrac\\pi2$. Then $\\displaystyle\\int_0^2\\sqrt{4-x^2}\\,dx=\\bigl[2\\theta+\\sin2\\theta\\bigr]_0^{\\pi/2}=\\pi$: the area of a quarter circle of radius $2$, $\\tfrac{\\pi\\cdot2^2}{4}$.' },
    { sec: { es: 'Mueve el triángulo', en: 'Move the triangle' }, par: tri(1), capas: capasTri(NOM),
      es: 'Mueve $x$ con el punto o el deslizador. El triángulo cambia, pero $\\sqrt{4-x^2}=2\\cos\\theta$ y $x=2\\operatorname{sen}\\theta$ siempre se cumplen. La última lectura es la primitiva evaluada en $x$: coincide con el área sombreada.',
      en: 'Move $x$ with the point or the slider. The triangle changes, but $\\sqrt{4-x^2}=2\\cos\\theta$ and $x=2\\sin\\theta$ always hold. The last readout is the antiderivative evaluated at $x$: it matches the shaded area.',
      jugar: {
        botones: [
          { label: 'x − 0,25', hacer: v => Object.assign(v, tri(v.px - .25)), off: v => v.px <= 0 },
          { label: 'x + 0,25', hacer: v => Object.assign(v, tri(v.px + .25)), off: v => v.px >= 2 },
          { label: { es: 'x = 1 (θ = 30°)', en: 'x = 1 (θ = 30°)' }, hacer: v => Object.assign(v, tri(1)) },
          { label: { es: 'x = √2 (θ = 45°)', en: 'x = √2 (θ = 45°)' }, hacer: v => Object.assign(v, tri(Math.SQRT2)) },
        ],
        lecturas: (v, cx) => [
          { expr: 'x', valor: cx.fmt(v.px) },
          { expr: 'θ = arcsin(x/2)', valor: cx.fmt(Math.asin(lim(v.px / 2, -1, 1)) * 180 / Math.PI) + '°' },
          { expr: '√(4 − x²) = 2 cos θ', valor: cx.fmt(Math.sqrt(Math.max(0, 4 - v.px * v.px))) },
          { expr: '2 arcsin(x/2) + (x/2)√(4−x²)', valor: cx.fmt(FT(v.px)) },
        ],
        arrastrables: true, soltar: (v, par, val) => Object.assign(v, tri(val)),
      } },
    { es: 'Para $\\displaystyle\\int\\frac{dx}{\\sqrt{x^2+9}}$ el radicando es $x^2+a^2$ con $a=3$. ¿Qué sustitución conviene?',
      en: 'For $\\displaystyle\\int\\frac{dx}{\\sqrt{x^2+9}}$ the radicand is $x^2+a^2$ with $a=3$. Which substitution fits?',
      pregunta: {
        opc: [
          { es: '$x=3\\operatorname{sen}\\theta$', en: '$x=3\\sin\\theta$' },
          { es: '$x=3\\tan\\theta$', en: '$x=3\\tan\\theta$', ok: 1 },
          { es: '$x=3\\sec\\theta$', en: '$x=3\\sec\\theta$' },
        ],
        why: {
          es: 'Se busca que la raíz se simplifique con una identidad: $9+9\\tan^2\\theta=9\\sec^2\\theta$. Resumen: $a^2-x^2\\to x=a\\operatorname{sen}\\theta$; $a^2+x^2\\to x=a\\tan\\theta$; $x^2-a^2\\to x=a\\sec\\theta$.',
          en: 'The goal is for the root to simplify with an identity: $9+9\\tan^2\\theta=9\\sec^2\\theta$. Summary: $a^2-x^2\\to x=a\\sin\\theta$; $a^2+x^2\\to x=a\\tan\\theta$; $x^2-a^2\\to x=a\\sec\\theta$.',
        },
      } },

    // ── Impropias ──
    { sec: { es: 'Integrales impropias', en: 'Improper integrals' },
      funcion: { x: [0, 12.5], y: [-.3, 2.3], curvas: [{ id: 'f1', nombre: '1/x', f: x => 1 / x }, { id: 'f2', nombre: '1/x²', f: x => 1 / (x * x) }],
        par: { b: 3 }, arrastrar: 'b', deslizadores: [{ par: 'b', min: 1, max: BMAX, paso: .05, es: 'Límite superior b', en: 'Upper limit b' }],
        etiqueta: { es: 'Gráficas de 1/x y 1/x² para x ≥ 1', en: 'Graphs of 1/x and 1/x² for x ≥ 1' } },
      es: '¿Puede un área infinitamente larga ser finita? $\\displaystyle\\int_1^\\infty f\\,dx$ se define como $\\displaystyle\\lim_{b\\to\\infty}\\int_1^b f\\,dx$. Comparamos $\\tfrac1x$ y $\\tfrac1{x^2}$: las dos decrecen hacia $0$, pero no igual de rápido.',
      en: 'Can an infinitely long area be finite? $\\displaystyle\\int_1^\\infty f\\,dx$ is defined as $\\displaystyle\\lim_{b\\to\\infty}\\int_1^b f\\,dx$. We compare $\\tfrac1x$ and $\\tfrac1{x^2}$: both decrease towards $0$, but not equally fast.' },
    { ver: ['f1'], resaltar: 'f1', capas: [{ tipo: 'riemann', c: 'f1', a: 1, b: 'b', n: 1, m: 'exacta' }],
      es: 'Para $f=\\tfrac1x$: $\\displaystyle\\int_1^b\\frac{dx}{x}=\\ln b$. Con $b=3$ el área es $\\ln3\\approx1{,}10$. Arrastra por la gráfica o usa el deslizador para mover el límite superior $b$ y observa cómo crece el área.',
      en: 'For $f=\\tfrac1x$: $\\displaystyle\\int_1^b\\frac{dx}{x}=\\ln b$. With $b=3$ the area is $\\ln3\\approx1.10$. Drag along the graph or use the slider to move the upper limit $b$ and watch the area grow.' },
    { par: { b: 3 },
      traza: [
        { par: { b: 2 }, es: '$b=2$: $\\ln2\\approx0{,}69$.', en: '$b=2$: $\\ln2\\approx0.69$.' },
        { par: { b: 4 }, es: '$b=4$: $\\ln4\\approx1{,}39$. Duplicar $b$ sumó $\\ln2$.', en: '$b=4$: $\\ln4\\approx1.39$. Doubling $b$ added $\\ln2$.' },
        { par: { b: 8 }, es: '$b=8$: $\\ln8\\approx2{,}08$. Otra vez $+\\ln2$.', en: '$b=8$: $\\ln8\\approx2.08$. Another $+\\ln2$.' },
        { par: { b: 12 }, es: '$b=12$: $\\ln12\\approx2{,}48$. Sigue creciendo.', en: '$b=12$: $\\ln12\\approx2.48$. Still growing.' },
      ],
      es: 'Cada vez que $b$ se duplica, el área suma $\\ln2\\approx0{,}69$. Crece cada vez más despacio, pero sin tope: $\\ln b\\to\\infty$. La integral **diverge**, aunque $\\tfrac1x\\to0$.',
      en: 'Each time $b$ doubles, the area adds $\\ln2\\approx0.69$. It grows ever more slowly, but without bound: $\\ln b\\to\\infty$. The integral **diverges**, even though $\\tfrac1x\\to0$.' },
    { ver: ['f2'], resaltar: 'f2', par: { b: 3 }, capas: [{ tipo: 'riemann', c: 'f2', a: 1, b: 'b', n: 1, m: 'exacta' }],
      traza: [
        { par: { b: 2 }, es: '$b=2$: $1-\\tfrac12=0{,}5$.', en: '$b=2$: $1-\\tfrac12=0.5$.' },
        { par: { b: 4 }, es: '$b=4$: $1-\\tfrac14=0{,}75$.', en: '$b=4$: $1-\\tfrac14=0.75$.' },
        { par: { b: 8 }, es: '$b=8$: $0{,}875$. Falta $\\tfrac18$.', en: '$b=8$: $0.875$. Missing $\\tfrac18$.' },
        { par: { b: 12 }, es: '$b=12$: $\\tfrac{11}{12}\\approx0{,}92$. Falta $\\tfrac1{12}$.', en: '$b=12$: $\\tfrac{11}{12}\\approx0.92$. Missing $\\tfrac1{12}$.' },
      ],
      es: 'Para $f=\\tfrac1{x^2}$: $\\displaystyle\\int_1^b x^{-2}dx=1-\\dfrac1b$. Con $b=3$ vale $\\tfrac23\\approx0{,}67$. Reproduce la traza: el área se acerca a $1$ y lo que falta, $\\tfrac1b$, se encoge.',
      en: 'For $f=\\tfrac1{x^2}$: $\\displaystyle\\int_1^b x^{-2}dx=1-\\dfrac1b$. With $b=3$ it equals $\\tfrac23\\approx0.67$. Play the trace: the area approaches $1$ and what is missing, $\\tfrac1b$, shrinks.' },
    { ver: ['f1', 'f2'], resaltar: null,
      es: '$\\displaystyle\\lim_{b\\to\\infty}\\Bigl(1-\\frac1b\\Bigr)=1$: la integral **converge** a $1$. En general, $\\int_1^\\infty x^{-p}\\,dx$ converge si $p>1$ (vale $\\tfrac1{p-1}$) y diverge si $p\\le1$. Todo se decide por la rapidez con que $f$ decae.',
      en: '$\\displaystyle\\lim_{b\\to\\infty}\\Bigl(1-\\frac1b\\Bigr)=1$: the integral **converges** to $1$. In general, $\\int_1^\\infty x^{-p}\\,dx$ converges if $p>1$ (it equals $\\tfrac1{p-1}$) and diverges if $p\\le1$. It all depends on how fast $f$ decays.' },
    { sec: { es: 'Las dos a la vez', en: 'Both at once' }, ver: ['f1', 'f2'], par: { b: 3 },
      capas: [{ tipo: 'riemann', c: 'f2', a: 1, b: 'b', n: 1, m: 'exacta' }, { tipo: 'entre', c: 'f1', g: 'f2', a: 1, b: 'b' }],
      es: 'La región bajo $\\tfrac1x$ se parte en dos: la de abajo (bajo $\\tfrac1{x^2}$), que nunca pasa de $1$, y la que queda **entre** las dos curvas, que crece como $\\ln b-1+\\tfrac1b$ sin límite. Mueve $b$ y compara.',
      en: 'The region under $\\tfrac1x$ splits in two: the lower one (under $\\tfrac1{x^2}$), which never exceeds $1$, and the one **between** the curves, which grows like $\\ln b-1+\\tfrac1b$ without bound. Move $b$ and compare.',
      jugar: {
        botones: [
          { label: 'b × 2', hacer: v => { v.b = Math.min(BMAX, +(v.b * 2).toFixed(2)); }, off: v => v.b >= BMAX },
          { label: 'b ÷ 2', hacer: v => { v.b = Math.max(1, +(v.b / 2).toFixed(2)); }, off: v => v.b <= 1 },
          { label: 'b = 12', hacer: v => { v.b = BMAX; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'b', valor: cx.fmt(v.b) },
          { expr: '∫₁ᵇ 1/x² dx = 1 − 1/b', valor: cx.fmt(1 - 1 / v.b) },
          { expr: 'entre ambas = ln b − 1 + 1/b', valor: cx.fmt(Math.log(v.b) - 1 + 1 / v.b) },
          { expr: '∫₁ᵇ 1/x dx = ln b', valor: cx.fmt(Math.log(v.b)) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = lim(val, 1, BMAX); },
      } },
    { es: '¿Qué ocurre con $\\displaystyle\\int_1^\\infty\\frac{dx}{\\sqrt x}$?',
      en: 'What happens with $\\displaystyle\\int_1^\\infty\\frac{dx}{\\sqrt x}$?',
      pregunta: {
        opc: [
          { es: 'Converge, porque $\\tfrac1{\\sqrt x}\\to0$', en: 'It converges, because $\\tfrac1{\\sqrt x}\\to0$' },
          { es: 'Diverge: $\\int_1^b x^{-1/2}dx=2\\sqrt b-2\\to\\infty$', en: 'It diverges: $\\int_1^b x^{-1/2}dx=2\\sqrt b-2\\to\\infty$', ok: 1 },
          { es: 'Converge a $2$', en: 'It converges to $2$' },
        ],
        why: {
          es: 'Que $f\\to0$ no basta: hace falta que decaiga más deprisa que $\\tfrac1x$. Aquí $p=\\tfrac12\\le1$, y $\\int_1^b x^{-1/2}dx=\\bigl[2\\sqrt x\\bigr]_1^b=2\\sqrt b-2$ no tiene límite finito.',
          en: '$f\\to0$ is not enough: it must decay faster than $\\tfrac1x$. Here $p=\\tfrac12\\le1$, and $\\int_1^b x^{-1/2}dx=\\bigl[2\\sqrt x\\bigr]_1^b=2\\sqrt b-2$ has no finite limit.',
        },
      } },
  ],
};
