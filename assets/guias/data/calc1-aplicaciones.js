// Guía «Aplicaciones de la derivada» (Cálculo I). Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Monotonía y concavidad, optimización, Newton-Raphson, L'Hôpital y teorema del valor medio.
const f1 = x => x ** 3 / 3 - x * x - 3 * x + 3; // máx. local en −1 (14/3), mín. local en 3 (−6), inflexión en 1 (−2/3)
const df1 = x => x * x - 2 * x - 3;
const ddf1 = x => 2 * x - 2;
const caja = x => x * (30 - 2 * x) ** 2; // volumen de la caja con hoja de 30 cm
const dcaja = x => (30 - 2 * x) * (30 - 6 * x);
const sinc = x => (x === 0 ? NaN : Math.sin(x) / x);
const cosq = x => (x === 0 ? NaN : (1 - Math.cos(x)) / (x * x));

const VA = { x: [-3, 5], y: [-9, 9] };
const CURVAS_A = [{ id: 'f', nombre: '$f(x)$', f: f1 }, { id: 'df', nombre: '$f\'(x)$', f: df1 }, { id: 'ddf', nombre: '$f\'\'(x)$', f: ddf1 }];
const DESL_X = { par: 'x0', min: -3, max: 5, paso: .05, es: 'Posición x₀', en: 'Position x₀' };
const flecha = d => (d > .02 ? '↗ ↑' : d < -.02 ? '↘ ↓' : '→');

// Newton: n-ésimo iterado desde v.x0, usando el contexto (derivada numérica)
const iterado = (v, cx) => {
  let x = v.x0;
  for (let i = 0; i < Math.round(v.n); i++) { const d = cx.d('f', x); if (!d) break; x -= cx.f('f', x) / d; }
  return x;
};

export default {
  titulo: { es: 'Aplicaciones de la derivada', en: 'Applications of the derivative' },
  fuentes: [
    'Boelkins, M., Austin, D., & Schlicker, S. (2017). *Active calculus 2.0*. Grand Valley State University. https://open.umn.edu/opentextbooks/textbooks/active-calculus-2-0',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 1*. OpenStax. https://openstax.org/books/calculus-volume-1/pages/preface',
  ],
  pasos: [
    // ── Signo de f′ y monotonía ──
    { sec: { es: 'El signo de f′', en: 'The sign of f′' },
      funcion: { ...VA, curvas: CURVAS_A, ver: ['f'], par: { x0: -2 }, arrastrar: 'x0', deslizadores: [DESL_X],
        capas: [{ tipo: 'tangente', c: 'f', x: 'x0' }],
        etiqueta: { es: 'Gráfica de f con su recta tangente', en: 'Graph of f with its tangent line' } },
      es: 'Si la tangente sube ($f\'>0$), $f$ es **creciente** ahí; si baja ($f\'<0$), **decreciente**; si es horizontal ($f\'=0$) puede haber un cambio de dirección. Aquí $f(x)=\\tfrac{x^3}{3}-x^2-3x+3$. Arrastra el punto.',
      en: 'If the tangent rises ($f\'>0$), $f$ is **increasing** there; if it falls ($f\'<0$), **decreasing**; if it is horizontal ($f\'=0$) the direction may change. Here $f(x)=\\tfrac{x^3}{3}-x^2-3x+3$. Drag the point.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, par: { x0: -2 },
      es: 'Recorre la curva con los botones o arrastrando. Fíjate en dónde cambia el signo de $f\'(x_0)$: ahí $f$ pasa de crecer a decrecer, o al revés. ¿En cuántos puntos ocurre?',
      en: 'Walk along the curve with the buttons or by dragging. Watch where the sign of $f\'(x_0)$ changes: there $f$ goes from increasing to decreasing, or vice versa. At how many points does it happen?',
      jugar: {
        botones: [
          { label: 'x₀ − 0,5', hacer: v => { v.x0 = Math.max(-3, +(v.x0 - .5).toFixed(2)); }, off: v => v.x0 <= -3 },
          { label: 'x₀ + 0,5', hacer: v => { v.x0 = Math.min(5, +(v.x0 + .5).toFixed(2)); }, off: v => v.x0 >= 5 },
          { label: 'x₀ = −1', hacer: v => { v.x0 = -1; } },
          { label: 'x₀ = 3', hacer: v => { v.x0 = 3; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: 'f(x₀)', valor: cx.fmt(cx.f('f', v.x0)) },
          { expr: 'f′(x₀)', valor: cx.fmt(cx.d('f', v.x0)), malo: cx.d('f', v.x0) < 0 },
          { expr: 'f', valor: flecha(cx.d('f', v.x0)) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { ver: ['f', 'df'], capas: [{ tipo: 'tangente', c: 'f', x: 'x0' }, { tipo: 'punto', c: 'df', x: 'x0' }],
      es: 'La segunda curva es $f\'(x)=x^2-2x-3=(x-3)(x+1)$: su altura es la pendiente de la tangente de $f$. Cruza el eje en $x=-1$ y $x=3$, los **puntos críticos**. Entre ellos $f\'<0$ y $f$ decrece.',
      en: 'The second curve is $f\'(x)=x^2-2x-3=(x-3)(x+1)$: its height is the slope of the tangent of $f$. It crosses the axis at $x=-1$ and $x=3$, the **critical points**. Between them $f\'<0$ and $f$ decreases.' },
    { ver: ['f', 'df'], resaltar: 'f',
      capas: [{ tipo: 'punto', c: 'f', x: -1 }, { tipo: 'punto', c: 'f', x: 3 },
        { tipo: 'texto', x: -.85, y: 5.4, s: { es: 'máx. local', en: 'local max' } }, { tipo: 'texto', x: 3.15, y: -6.6, s: { es: 'mín. local', en: 'local min' } }],
      es: '**Primera derivada**: si $f\'$ pasa de $+$ a $-$ en $c$ hay un **máximo local**; de $-$ a $+$, un **mínimo local**. Aquí, máximo en $x=-1$ con $f(-1)=\\tfrac{14}{3}\\approx4{,}67$, y mínimo en $x=3$ con $f(3)=-6$.',
      en: '**First derivative test**: if $f\'$ goes from $+$ to $-$ at $c$ there is a **local maximum**; from $-$ to $+$, a **local minimum**. Here, a maximum at $x=-1$ with $f(-1)=\\tfrac{14}{3}\\approx4.67$, and a minimum at $x=3$ with $f(3)=-6$.' },
    { es: 'Con $f\'(x)=(x-3)(x+1)$, ¿en qué intervalo decrece $f$?',
      en: 'With $f\'(x)=(x-3)(x+1)$, on which interval does $f$ decrease?',
      pregunta: {
        opc: [
          { es: '$(-1,\\,3)$', en: '$(-1,\\,3)$', ok: 1 },
          { es: '$(-\\infty,\\,-1)\\cup(3,\\,\\infty)$', en: '$(-\\infty,\\,-1)\\cup(3,\\,\\infty)$' },
          { es: 'Solo en $x=1$', en: 'Only at $x=1$' },
        ],
        why: {
          es: '$f\'<0$ cuando un factor es positivo y el otro negativo: entre las raíces. Por ejemplo $f\'(0)=-3<0$. Fuera, $f\'(-2)=5>0$ y $f\'(4)=5>0$, así que $f$ crece.',
          en: '$f\'<0$ when one factor is positive and the other negative: between the roots. For example $f\'(0)=-3<0$. Outside, $f\'(-2)=5>0$ and $f\'(4)=5>0$, so $f$ increases.',
        },
      } },

    // ── Concavidad ──
    { sec: { es: 'Concavidad y f″', en: 'Concavity and f″' }, ver: ['f', 'ddf'], par: { x0: -2 },
      capas: [{ tipo: 'tangente', c: 'f', x: 'x0' }, { tipo: 'punto', c: 'ddf', x: 'x0' }],
      es: 'La **concavidad** dice cómo gira la tangente. Si $f\'\'>0$, $f\'$ crece y la curva queda *por encima* de su tangente: cóncava hacia arriba ($\\cup$). Si $f\'\'<0$, queda por debajo ($\\cap$). Aquí $f\'\'(x)=2x-2$.',
      en: '**Concavity** tells how the tangent turns. If $f\'\'>0$, $f\'$ increases and the curve lies *above* its tangent: concave up ($\\cup$). If $f\'\'<0$, it lies below ($\\cap$). Here $f\'\'(x)=2x-2$.' },
    { par: { x0: -2 },
      es: 'Mueve el punto: $f\'\'$ cambia de signo en $x=1$. Allí la curva pasa de $\\cap$ a $\\cup$: un **punto de inflexión**, con $f(1)=-\\tfrac23$.',
      en: 'Move the point: $f\'\'$ changes sign at $x=1$. There the curve goes from $\\cap$ to $\\cup$: an **inflection point**, with $f(1)=-\\tfrac23$.',
      jugar: {
        botones: [
          { label: 'x₀ − 0,5', hacer: v => { v.x0 = Math.max(-3, +(v.x0 - .5).toFixed(2)); }, off: v => v.x0 <= -3 },
          { label: 'x₀ + 0,5', hacer: v => { v.x0 = Math.min(5, +(v.x0 + .5).toFixed(2)); }, off: v => v.x0 >= 5 },
          { label: 'x₀ = 1', hacer: v => { v.x0 = 1; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: 'f″(x₀)', valor: cx.fmt(cx.f('ddf', v.x0)), malo: cx.f('ddf', v.x0) < 0 },
          { expr: 'f', valor: cx.f('ddf', v.x0) > .02 ? '∪' : cx.f('ddf', v.x0) < -.02 ? '∩' : '—' },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { es: 'En $x=3$ se cumple $f\'(3)=0$ y $f\'\'(3)=4$. ¿Qué es $x=3$?',
      en: 'At $x=3$ we have $f\'(3)=0$ and $f\'\'(3)=4$. What is $x=3$?',
      pregunta: {
        opc: [
          { es: 'Un máximo local', en: 'A local maximum' },
          { es: 'Un mínimo local', en: 'A local minimum', ok: 1 },
          { es: 'Un punto de inflexión', en: 'An inflection point' },
        ],
        why: {
          es: 'Con tangente horizontal y $f\'\'>0$ la curva es $\\cup$ y queda por encima de la tangente: mínimo. Es el **criterio de la segunda derivada**; en $x=-1$, $f\'\'(-1)=-4<0$ da el máximo. Si $f\'\'=0$, el criterio no decide.',
          en: 'With a horizontal tangent and $f\'\'>0$ the curve is $\\cup$ and lies above the tangent: a minimum. This is the **second derivative test**; at $x=-1$, $f\'\'(-1)=-4<0$ gives the maximum. If $f\'\'=0$, the test is inconclusive.',
        },
      } },

    // ── Optimización ──
    { sec: { es: 'Optimización: la caja', en: 'Optimization: the box' },
      funcion: { x: [-1, 16], y: [-400, 2500], curvas: [{ id: 'V', nombre: '$V(x)$', f: caja }, { id: 'dV', nombre: '$V\'(x)$', f: dcaja }], ver: ['V'], par: { x0: 3 }, arrastrar: 'x0',
        deslizadores: [{ par: 'x0', min: 0, max: 15, paso: .1, es: 'Recorte x (cm)', en: 'Cut x (cm)' }],
        capas: [{ tipo: 'tangente', c: 'V', x: 'x0' }],
        etiqueta: { es: 'Volumen de la caja en función del recorte x', en: 'Volume of the box as a function of the cut x' } },
      es: 'Una hoja cuadrada de $30$ cm se convierte en una caja sin tapa recortando un cuadrado de lado $x$ en cada esquina y doblando. La base mide $30-2x$ y la altura $x$: $V(x)=x(30-2x)^2$, con $0\\le x\\le15$. ¿Qué $x$ maximiza el volumen?',
      en: 'A $30$ cm square sheet becomes an open box by cutting a square of side $x$ from each corner and folding. The base is $30-2x$ wide and the height is $x$: $V(x)=x(30-2x)^2$, with $0\\le x\\le15$. Which $x$ maximizes the volume?' },
    { par: { x0: 3 },
      es: 'Arrastra el punto y observa $V$. Con $x=3$: base $24$ cm y $V=3\\cdot24^2=1728$ cm³. La tangente sube al principio y luego baja: ¿dónde se vuelve horizontal?',
      en: 'Drag the point and watch $V$. With $x=3$: base $24$ cm and $V=3\\cdot24^2=1728$ cm³. The tangent rises at first and then falls: where does it become horizontal?',
      jugar: {
        botones: [
          { label: 'x − 1', hacer: v => { v.x0 = Math.max(0, +(v.x0 - 1).toFixed(2)); }, off: v => v.x0 <= 0 },
          { label: 'x + 1', hacer: v => { v.x0 = Math.min(15, +(v.x0 + 1).toFixed(2)); }, off: v => v.x0 >= 15 },
          { label: 'x = 3', hacer: v => { v.x0 = 3; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'x (cm)', valor: cx.fmt(v.x0) },
          { expr: '30 − 2x (cm)', valor: cx.fmt(30 - 2 * v.x0) },
          { expr: 'V (cm³)', valor: cx.fmt(cx.f('V', v.x0)) },
          { expr: 'V′(x)', valor: cx.fmt(cx.d('V', v.x0)), malo: cx.d('V', v.x0) < 0 },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { par: { x0: 5 }, ver: ['V', 'dV'], capas: [{ tipo: 'tangente', c: 'V', x: 'x0' }, { tipo: 'punto', c: 'dV', x: 'x0' }],
      es: '$V\'(x)=(30-2x)^2-4x(30-2x)=(30-2x)(30-6x)$ se anula en $x=15$ (sin caja, $V=0$) y en $x=5$. Candidatos: $V(0)=V(15)=0$ y $V(5)=5\\cdot20^2=2000$. El máximo es **2000 cm³**, recortando $5$ cm.',
      en: '$V\'(x)=(30-2x)^2-4x(30-2x)=(30-2x)(30-6x)$ vanishes at $x=15$ (no box, $V=0$) and at $x=5$. Candidates: $V(0)=V(15)=0$ and $V(5)=5\\cdot20^2=2000$. The maximum is **2000 cm³**, cutting $5$ cm.' },
    { es: 'Con una hoja de $24$ cm de lado, ¿qué recorte $x$ maximiza el volumen $V(x)=x(24-2x)^2$?',
      en: 'With a $24$ cm sheet, which cut $x$ maximizes the volume $V(x)=x(24-2x)^2$?',
      pregunta: {
        opc: [
          { es: '$x=4$ cm', en: '$x=4$ cm', ok: 1 },
          { es: '$x=6$ cm', en: '$x=6$ cm' },
          { es: '$x=12$ cm', en: '$x=12$ cm' },
        ],
        why: {
          es: '$V\'(x)=(24-2x)(24-6x)=0$ da $x=12$ (caja vacía, $V=0$) o $x=4$, con $V(4)=4\\cdot16^2=1024$ cm³. Comparación: $V(6)=6\\cdot12^2=864<1024$. En general el recorte óptimo es $\\tfrac16$ del lado.',
          en: '$V\'(x)=(24-2x)(24-6x)=0$ gives $x=12$ (empty box, $V=0$) or $x=4$, with $V(4)=4\\cdot16^2=1024$ cm³. Check: $V(6)=6\\cdot12^2=864<1024$. In general the optimal cut is $\\tfrac16$ of the side.',
        },
      } },

    // ── Newton-Raphson ──
    { sec: { es: 'Newton-Raphson', en: 'Newton-Raphson' },
      funcion: { x: [0, 3], y: [-3, 7], curvas: [{ id: 'f', nombre: '$x^2-2$', f: x => x * x - 2 }], par: { x0: 2, n: 0 }, arrastrar: 'x0',
        deslizadores: [{ par: 'n', min: 0, max: 6, paso: 1, dec: 0, es: 'Iteraciones n', en: 'Iterations n' }, { par: 'x0', min: .3, max: 3, paso: .05, es: 'Punto de partida x₀', en: 'Starting point x₀' }],
        capas: [{ tipo: 'newton', c: 'f', x: 'x0', n: 'n' }, { tipo: 'punto', x: Math.SQRT2, y: 0, abierto: true }],
        etiqueta: { es: 'Iteraciones de Newton-Raphson para x² − 2', en: 'Newton-Raphson iterations for x² − 2' } },
      es: 'Para resolver $f(x)=0$ sin despejar: parte de una estimación $x_0$, cambia la curva por su **tangente** y toma donde esa recta corta el eje: $x_{n+1}=x_n-\\dfrac{f(x_n)}{f\'(x_n)}$. Aquí $f(x)=x^2-2$, con raíz $\\sqrt2\\approx1{,}41421$. Partimos de $x_0=2$.',
      en: 'To solve $f(x)=0$ without isolating $x$: start from a guess $x_0$, replace the curve by its **tangent** and take where that line meets the axis: $x_{n+1}=x_n-\\dfrac{f(x_n)}{f\'(x_n)}$. Here $f(x)=x^2-2$, with root $\\sqrt2\\approx1.41421$. We start at $x_0=2$.' },
    { traza: [
        { par: { n: 1 }, es: '$n=1$: $x_1=2-\\dfrac{2}{4}=1{,}5$.', en: '$n=1$: $x_1=2-\\dfrac{2}{4}=1.5$.' },
        { par: { n: 2 }, es: '$n=2$: $x_2=1{,}5-\\dfrac{0{,}25}{3}\\approx1{,}41667$.', en: '$n=2$: $x_2=1.5-\\dfrac{0.25}{3}\\approx1.41667$.' },
        { par: { n: 3 }, es: '$n=3$: $x_3\\approx1{,}414216$, cinco decimales correctos.', en: '$n=3$: $x_3\\approx1.414216$, five correct decimals.' },
        { par: { n: 4 }, es: '$n=4$: $x_4\\approx1{,}41421356237$, once decimales correctos.', en: '$n=4$: $x_4\\approx1.41421356237$, eleven correct decimals.' },
      ],
      es: 'Reproduce la traza: cada iteración *duplica*, aproximadamente, las cifras correctas. Esa velocidad (convergencia cuadrática) es lo que hace tan útil al método cuando se parte cerca de la raíz.',
      en: 'Play the trace: each iteration roughly *doubles* the number of correct digits. This speed (quadratic convergence) is what makes the method so useful when you start near the root.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, par: { n: 0, x0: 2 },
      es: 'Cambia $n$ y el punto de partida. Desde $x_0=0{,}5$ la tangente es casi plana y el primer paso salta lejos, a $x_1=2{,}25$, pero acaba convergiendo igual.',
      en: 'Change $n$ and the starting point. From $x_0=0.5$ the tangent is nearly flat and the first step jumps far away, to $x_1=2.25$, but it still converges in the end.',
      jugar: {
        botones: [
          { label: 'n + 1', hacer: v => { v.n = Math.min(6, Math.round(v.n) + 1); }, off: v => v.n >= 6 },
          { label: 'n = 0', hacer: v => { v.n = 0; } },
          { label: 'x₀ = 0,5', hacer: v => { v.x0 = .5; v.n = 0; } },
          { label: 'x₀ = 2', hacer: v => { v.x0 = 2; v.n = 0; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'n', valor: cx.fmt(Math.round(v.n)) },
          { expr: 'xₙ', valor: cx.fmt(iterado(v, cx)) },
          { expr: 'f(xₙ)', valor: cx.fmt(cx.f('f', iterado(v, cx))) },
          { expr: '|xₙ − √2|', valor: cx.fmt(Math.abs(iterado(v, cx) - Math.SQRT2)) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { es: 'Newton para $f(x)=x^2-2$ con $x_0=0$. ¿Qué ocurre en el primer paso?',
      en: 'Newton for $f(x)=x^2-2$ with $x_0=0$. What happens at the first step?',
      pregunta: {
        opc: [
          { es: 'Da $x_1=\\sqrt2$ de golpe', en: 'It gives $x_1=\\sqrt2$ at once' },
          { es: 'Falla: $f\'(0)=0$, la tangente es horizontal y no corta el eje', en: 'It fails: $f\'(0)=0$, the tangent is horizontal and never meets the axis', ok: 1 },
          { es: 'Da $x_1=0$ y se queda ahí', en: 'It gives $x_1=0$ and stays there' },
        ],
        why: {
          es: 'La fórmula divide entre $f\'(x_n)=2x_n$, que vale $0$ en $x_0=0$. Una tangente horizontal no corta el eje. Si $f\'(x_n)$ es solo *pequeña*, el paso es enorme y puede lanzarte lejos de la raíz.',
          en: 'The formula divides by $f\'(x_n)=2x_n$, which is $0$ at $x_0=0$. A horizontal tangent never meets the axis. If $f\'(x_n)$ is merely *small*, the step is huge and can throw you far from the root.',
        },
      } },

    // ── L'Hôpital ──
    { sec: { es: 'Regla de L\'Hôpital', en: 'L\'Hôpital\'s rule' },
      funcion: { x: [-4, 4], y: [-1.5, 1.5], curvas: [{ id: 'q', nombre: { es: '$\\operatorname{sen} x / x$', en: '$\\sin x / x$' }, f: sinc }, { id: 'num', nombre: { es: '$\\operatorname{sen} x$', en: '$\\sin x$' }, f: Math.sin }, { id: 'den', nombre: '$x$', f: x => x }, { id: 'q2', nombre: '$\\dfrac{1-\\cos x}{x^2}$', f: cosq }],
        ver: ['q'], capas: [{ tipo: 'punto', x: 0, y: 1, abierto: true }],
        etiqueta: { es: 'Gráfica de sen x / x, con un hueco en x = 0', en: 'Graph of sin x / x, with a hole at x = 0' } },
      es: '$\\displaystyle\\lim_{x\\to0}\\dfrac{\\operatorname{sen}x}{x}$ da $\\tfrac00$, una **forma indeterminada**: sustituir no sirve. La gráfica sugiere que el límite es $1$ y que en $x=0$ solo falta el punto (el hueco).',
      en: '$\\displaystyle\\lim_{x\\to0}\\dfrac{\\sin x}{x}$ gives $\\tfrac00$, an **indeterminate form**: plugging in does not work. The graph suggests the limit is $1$ and that at $x=0$ only the point is missing (the hole).' },
    { ver: ['num', 'den'], capas: [{ tipo: 'punto', x: 0, y: 0 }, { tipo: 'tangente', c: 'num', x: 0 }],
      es: 'Cerca de $0$, $\\operatorname{sen}x$ y $x$ valen $0$ y tienen la misma pendiente: $\\cos0=1$ y $1$. **L\'Hôpital**: si $f(a)=g(a)=0$ (o ambas $\\pm\\infty$) y $\\lim\\dfrac{f\'}{g\'}$ existe, entonces $\\lim\\dfrac fg=\\lim\\dfrac{f\'}{g\'}$. Aquí, $\\dfrac{\\cos x}{1}\\to1$.',
      en: 'Near $0$, $\\sin x$ and $x$ both vanish and have the same slope: $\\cos0=1$ and $1$. **L\'Hôpital**: if $f(a)=g(a)=0$ (or both $\\pm\\infty$) and $\\lim\\dfrac{f\'}{g\'}$ exists, then $\\lim\\dfrac fg=\\lim\\dfrac{f\'}{g\'}$. Here, $\\dfrac{\\cos x}{1}\\to1$.' },
    { ver: ['q2'], capas: [{ tipo: 'punto', x: 0, y: .5, abierto: true }],
      es: 'A veces hay que repetirlo, comprobando la hipótesis en cada paso: $\\displaystyle\\lim_{x\\to0}\\dfrac{1-\\cos x}{x^2}\\overset{0/0}{=}\\lim_{x\\to0}\\dfrac{\\operatorname{sen}x}{2x}\\overset{0/0}{=}\\lim_{x\\to0}\\dfrac{\\cos x}{2}=\\dfrac12$. La gráfica confirma el hueco en $y=\\tfrac12$.',
      en: 'Sometimes you must repeat it, checking the hypothesis at every step: $\\displaystyle\\lim_{x\\to0}\\dfrac{1-\\cos x}{x^2}\\overset{0/0}{=}\\lim_{x\\to0}\\dfrac{\\sin x}{2x}\\overset{0/0}{=}\\lim_{x\\to0}\\dfrac{\\cos x}{2}=\\dfrac12$. The graph confirms the hole at $y=\\tfrac12$.' },
    { es: '¿Cuánto vale $\\displaystyle\\lim_{x\\to0}\\dfrac{\\cos x}{x+1}$?',
      en: 'What is $\\displaystyle\\lim_{x\\to0}\\dfrac{\\cos x}{x+1}$?',
      pregunta: {
        opc: [
          { es: '$1$, sustituyendo directamente', en: '$1$, by direct substitution', ok: 1 },
          { es: '$0$, aplicando L\'Hôpital: $\\dfrac{-\\operatorname{sen}0}{1}$', en: '$0$, applying L\'Hôpital: $\\dfrac{-\\sin0}{1}$' },
          { es: 'No existe', en: 'It does not exist' },
        ],
        why: {
          es: '$\\dfrac{\\cos0}{0+1}=1$ no es indeterminado (ni $\\tfrac00$ ni $\\tfrac\\infty\\infty$), así que L\'Hôpital **no se puede usar**; hacerlo daría $0$, un resultado falso. Comprueba siempre la forma antes de derivar.',
          en: '$\\dfrac{\\cos0}{0+1}=1$ is not indeterminate (neither $\\tfrac00$ nor $\\tfrac\\infty\\infty$), so L\'Hôpital **does not apply**; using it would give $0$, a wrong result. Always check the form before differentiating.',
        },
      } },

    // ── Teorema del valor medio ──
    { sec: { es: 'Teorema del valor medio', en: 'Mean value theorem' },
      funcion: { x: [-1, 3.5], y: [-2.5, 9], curvas: [{ id: 'f', nombre: '$f(x)$', f: x => x ** 3 / 3 - x }], par: { x0: .5, a: 0, h: 3 }, arrastrar: 'x0',
        deslizadores: [{ par: 'x0', min: 0, max: 3, paso: .01, es: 'Punto x₀', en: 'Point x₀' }],
        capas: [{ tipo: 'secante', c: 'f', x: 'a', h: 'h' }, { tipo: 'tangente', c: 'f', x: 'x0' }],
        etiqueta: { es: 'Secante entre x = 0 y x = 3 y tangente móvil', en: 'Secant between x = 0 and x = 3 and a movable tangent' } },
      es: 'Si $f$ es continua en $[a,b]$ y derivable en $(a,b)$, existe $c\\in(a,b)$ con $f\'(c)=\\dfrac{f(b)-f(a)}{b-a}$: en algún punto la tangente es **paralela a la secante**. Aquí $f(x)=\\tfrac{x^3}{3}-x$ en $[0,3]$: la secante tiene pendiente $\\tfrac{6-0}{3}=2$.',
      en: 'If $f$ is continuous on $[a,b]$ and differentiable on $(a,b)$, there is $c\\in(a,b)$ with $f\'(c)=\\dfrac{f(b)-f(a)}{b-a}$: somewhere the tangent is **parallel to the secant**. Here $f(x)=\\tfrac{x^3}{3}-x$ on $[0,3]$: the secant has slope $\\tfrac{6-0}{3}=2$.' },
    { par: { x0: .5 },
      es: 'Mueve $x_0$ hasta que la tangente sea paralela a la secante. Como $f\'(x)=x^2-1=2$, resulta $x=\\sqrt3\\approx1{,}73$ en $(0,3)$ (el otro valor, $-\\sqrt3$, queda fuera del intervalo).',
      en: 'Move $x_0$ until the tangent is parallel to the secant. Since $f\'(x)=x^2-1=2$, we get $x=\\sqrt3\\approx1.73$ in $(0,3)$ (the other value, $-\\sqrt3$, lies outside the interval).',
      jugar: {
        botones: [
          { label: 'x₀ − 0,25', hacer: v => { v.x0 = Math.max(0, +(v.x0 - .25).toFixed(2)); }, off: v => v.x0 <= 0 },
          { label: 'x₀ + 0,25', hacer: v => { v.x0 = Math.min(3, +(v.x0 + .25).toFixed(2)); }, off: v => v.x0 >= 3 },
          { label: 'x₀ = √3', hacer: v => { v.x0 = Math.sqrt(3); } },
        ],
        lecturas: (v, cx) => [
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: '(f(3) − f(0)) / 3', valor: cx.fmt((cx.f('f', 3) - cx.f('f', 0)) / 3) },
          { expr: 'f′(x₀)', valor: cx.fmt(cx.d('f', v.x0)), malo: Math.abs(cx.d('f', v.x0) - 2) > .05 },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { funcion: { x: [-2, 2], y: [-.5, 2], curvas: [{ id: 'f', nombre: '$|x|$', f: Math.abs }], par: { a: -1, h: 2 },
        capas: [{ tipo: 'secante', c: 'f', x: 'a', h: 'h' }, { tipo: 'tangente', c: 'f', x: -.5 }, { tipo: 'tangente', c: 'f', x: .5 }],
        etiqueta: { es: 'Valor absoluto con secante horizontal y tangentes de pendiente ±1', en: 'Absolute value with a horizontal secant and tangents of slope ±1' } },
      es: 'Las hipótesis importan. $f(x)=|x|$ es continua en $[-1,1]$ pero no derivable en $0$. La secante es horizontal (pendiente $0$) y, sin embargo, ninguna tangente lo es: $f\'=-1$ a la izquierda y $f\'=1$ a la derecha.',
      en: 'The hypotheses matter. $f(x)=|x|$ is continuous on $[-1,1]$ but not differentiable at $0$. The secant is horizontal (slope $0$) and yet no tangent is: $f\'=-1$ on the left and $f\'=1$ on the right.' },
    { es: 'Un coche recorre $150$ km en $2$ h, a $75$ km/h de media. Según el teorema del valor medio:',
      en: 'A car travels $150$ km in $2$ h, averaging $75$ km/h. According to the mean value theorem:',
      pregunta: {
        opc: [
          { es: 'Hubo un instante en que iba a exactamente $75$ km/h', en: 'At some instant it was going exactly $75$ km/h', ok: 1 },
          { es: 'Iba a $75$ km/h todo el tiempo', en: 'It was going $75$ km/h the whole time' },
          { es: 'No se puede decir nada de la velocidad instantánea', en: 'Nothing can be said about the instantaneous speed' },
        ],
        why: {
          es: 'La posición $s(t)$ es continua y derivable (el coche no se teletransporta), así que existe $c$ con $s\'(c)=\\tfrac{150}{2}=75$. No dice cuándo ni que fuera constante: solo que la velocidad pasó por $75$.',
          en: 'The position $s(t)$ is continuous and differentiable (the car does not teleport), so there is $c$ with $s\'(c)=\\tfrac{150}{2}=75$. It does not say when, nor that it was constant: only that the speed passed through $75$.',
        },
      } },
  ],
};
