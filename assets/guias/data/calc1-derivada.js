// Guía «La derivada» (Cálculo I). Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Plantilla de las guías de cálculo: paso = parche; `par` = parámetros que mueven capas; jugar = botones + lecturas + arrastre.
const cubica = x => x ** 3 / 6 - x / 2 + 1;
const dcubica = x => x * x / 2 - .5;
const VENT = { x: [-3, 3], y: [-3, 5] };
const CURVA = [{ id: 'f', nombre: '$f(x)$', f: cubica }];
const SEC = [{ tipo: 'secante', c: 'f', x: 'x0', h: 'h' }];
const TAN = [{ tipo: 'tangente', c: 'f', x: 'x0' }];

// Circunferencia x² + y² = 25: tangente en (px, py) con pendiente −px/py, precalculada para cada ángulo
const circ = th => {
  const px = 5 * Math.cos(th), py = 5 * Math.sin(th), d = 3.2, tx = -py / 5, ty = px / 5;
  return { px: +px.toFixed(3), py: +py.toFixed(3), x1: +(px - tx * d).toFixed(3), y1: +(py - ty * d).toFixed(3), x2: +(px + tx * d).toFixed(3), y2: +(py + ty * d).toFixed(3) };
};
const rad = g => g * Math.PI / 180;

export default {
  titulo: { es: 'La derivada', en: 'The derivative' },
  fuentes: [
    'Boelkins, M., Austin, D., & Schlicker, S. (2017). *Active calculus 2.0*. Grand Valley State University. https://open.umn.edu/opentextbooks/textbooks/active-calculus-2-0',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 1*. OpenStax. https://openstax.org/books/calculus-volume-1/pages/preface',
  ],
  pasos: [
    // ── De la secante a la tangente ──
    { sec: { es: 'De la secante a la tangente', en: 'From secant to tangent' },
      funcion: { ...VENT, curvas: CURVA, par: { x0: 1, h: 2 }, arrastrar: 'x0', capas: SEC,
        deslizadores: [{ par: 'h', min: .01, max: 3, paso: .01, es: 'Separación h', en: 'Spacing h' }],
        etiqueta: { es: 'Gráfica de f con una recta secante', en: 'Graph of f with a secant line' } },
      es: '¿Qué tan rápido cambia $f$? Entre dos puntos la respuesta es la **pendiente de la secante**: $\\dfrac{f(x_0+h)-f(x_0)}{h}$. Es una velocidad *media*: cuánto sube $f$ por cada unidad que avanza $x$ en ese tramo.',
      en: 'How fast does $f$ change? Between two points the answer is the **slope of the secant**: $\\dfrac{f(x_0+h)-f(x_0)}{h}$. It is an *average* rate: how much $f$ rises per unit of $x$ over that stretch.' },
    { par: { h: 2 },
      es: 'Con $x_0=1$ y $h=2$ la secante une $(1,\\,f(1))$ con $(3,\\,f(3))$. Su pendiente no dice nada sobre lo que ocurre *dentro* del tramo, solo el promedio.',
      en: 'With $x_0=1$ and $h=2$ the secant joins $(1,\\,f(1))$ and $(3,\\,f(3))$. Its slope says nothing about what happens *inside* the stretch, only the average.' },
    { sec: { es: 'Acercando el segundo punto', en: 'Bringing the second point closer' }, par: { h: 2 },
      traza: [
        { par: { h: 1 }, es: 'Con $h=1$ la secante ya se parece más a la curva cerca de $x_0$.', en: 'With $h=1$ the secant already hugs the curve near $x_0$.' },
        { par: { h: .5 } }, { par: { h: .25 } },
        { par: { h: .1 }, es: 'Con $h=0{,}1$ casi no se distingue de una recta que *toca* la curva en un solo punto.', en: 'With $h=0.1$ it is almost a line that *touches* the curve at a single point.' },
        { par: { h: .01 }, es: 'Con $h=0{,}01$: la pendiente se estabiliza. Ese valor límite es la **derivada**.', en: 'With $h=0.01$ the slope settles. That limiting value is the **derivative**.' },
      ],
      es: 'Reproduce la traza: el segundo punto se acerca al primero. La pendiente de la secante converge a un número. No podemos poner $h=0$ (dividiríamos entre cero), pero sí preguntar a qué valor *tiende*.',
      en: 'Play the trace: the second point slides toward the first. The secant slope converges to a number. We cannot set $h=0$ (we would divide by zero), but we can ask what value it *tends* to.' },
    { sec: { es: 'La definición', en: 'The definition' }, par: { h: .01 }, capas: TAN,
      es: 'La **derivada** de $f$ en $x_0$ es ese límite: $f\'(x_0)=\\displaystyle\\lim_{h\\to0}\\frac{f(x_0+h)-f(x_0)}{h}$ Geométricamente, la pendiente de la **recta tangente**. Si el límite no existe (una esquina, una cúspide, una vertical), $f$ no es derivable ahí.',
      en: 'The **derivative** of $f$ at $x_0$ is that limit: $f\'(x_0)=\\displaystyle\\lim_{h\\to0}\\frac{f(x_0+h)-f(x_0)}{h}$ Geometrically, the slope of the **tangent line**. If the limit does not exist (a corner, a cusp, a vertical tangent), $f$ is not differentiable there.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, par: { x0: 1 },
      es: 'Arrastra el punto sobre la gráfica. Donde la tangente es horizontal, $f\'=0$; donde sube, $f\'>0$; donde baja, $f\'<0$. ¿En qué dos puntos es horizontal?',
      en: 'Drag the point along the graph. Where the tangent is horizontal, $f\'=0$; where it rises, $f\'>0$; where it falls, $f\'<0$. At which two points is it horizontal?',
      jugar: {
        botones: [
          { label: 'x₀ − 0,5', hacer: v => { v.x0 = Math.max(-3, +(v.x0 - .5).toFixed(2)); }, off: v => v.x0 <= -3 },
          { label: 'x₀ + 0,5', hacer: v => { v.x0 = Math.min(3, +(v.x0 + .5).toFixed(2)); }, off: v => v.x0 >= 3 },
          { label: { es: 'ir a x₀ = 1', en: 'go to x₀ = 1' }, hacer: v => { v.x0 = 1; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: 'f(x₀)', valor: cx.fmt(cx.f('f', v.x0)) },
          { expr: 'f′(x₀)', valor: cx.fmt(cx.d('f', v.x0)), malo: cx.d('f', v.x0) < 0 },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { par: { x0: 1 },
      es: 'En $x_0=1$ la tangente de $f(x)=\\tfrac{x^3}{6}-\\tfrac{x}{2}+1$ es horizontal. ¿Cuánto vale $f\'(1)$?',
      en: 'At $x_0=1$ the tangent of $f(x)=\\tfrac{x^3}{6}-\\tfrac{x}{2}+1$ is horizontal. What is $f\'(1)$?',
      pregunta: {
        opc: [
          { es: '$1$, porque $x_0=1$', en: '$1$, because $x_0=1$' },
          { es: '$0$: recta horizontal, pendiente cero', en: '$0$: horizontal line, zero slope', ok: 1 },
          { es: '$f(1)=\\tfrac{2}{3}$, el valor de la función', en: '$f(1)=\\tfrac{2}{3}$, the function value' },
        ],
        why: {
          es: 'La derivada es la *pendiente*, no la altura: $f\'(x)=\\tfrac{x^2-1}{2}$, que se anula en $x=\\pm1$. $f(1)=\\tfrac23$ es la altura del punto.',
          en: 'The derivative is the *slope*, not the height: $f\'(x)=\\tfrac{x^2-1}{2}$, which vanishes at $x=\\pm1$. $f(1)=\\tfrac23$ is the height of the point.',
        },
      } },

    // ── Reglas ──
    { sec: { es: 'Reglas de derivación', en: 'Differentiation rules' },
      funcion: { x: [-3, 3], y: [-4, 6], curvas: [{ id: 'f', nombre: '$f(x)$', f: cubica }, { id: 'df', nombre: { es: '$f\'(x)$', en: '$f\'(x)$' }, f: dcubica }], par: { x0: 1.5 }, arrastrar: 'x0', capas: [{ tipo: 'tangente', c: 'f', x: 'x0' }, { tipo: 'punto', c: 'df', x: 'x0' }] },
      es: 'Calcular el límite cada vez sería agotador. Las **reglas** lo hacen por nosotros: $(x^n)\'=nx^{n-1}$, $(cf)\'=cf\'$ y $(f+g)\'=f\'+g\'$. Aquí $f\'(x)=\\tfrac{x^2}{2}-\\tfrac12$ es la segunda curva: su altura en $x_0$ **es** la pendiente de la tangente de $f$.',
      en: 'Computing the limit every time would be exhausting. The **rules** do it for us: $(x^n)\'=nx^{n-1}$, $(cf)\'=cf\'$ and $(f+g)\'=f\'+g\'$. Here $f\'(x)=\\tfrac{x^2}{2}-\\tfrac12$ is the second curve: its height at $x_0$ **is** the slope of the tangent of $f$.' },
    { sec: { es: 'Producto y cociente', en: 'Product and quotient' },
      es: 'El producto **no** se deriva factor a factor: $(fg)\'=f\'g+fg\'$. Y el cociente: $\\left(\\dfrac fg\\right)\'=\\dfrac{f\'g-fg\'}{g^2}$. Ejemplo: $(x\\,e^x)\'=e^x+x\\,e^x=(1+x)e^x$. Si derivases factor a factor saldría $1\\cdot e^x$, y faltaría el término $x\\,e^x$.',
      en: 'The product is **not** differentiated factor by factor: $(fg)\'=f\'g+fg\'$. And the quotient: $\\left(\\dfrac fg\\right)\'=\\dfrac{f\'g-fg\'}{g^2}$. Example: $(x\\,e^x)\'=e^x+x\\,e^x=(1+x)e^x$. Differentiating factor by factor would give $1\\cdot e^x$, missing the term $x\\,e^x$.' },
    { sec: { es: 'Regla de la cadena', en: 'The chain rule' },
      funcion: { x: [-2.5, 2.5], y: [-3, 3], curvas: [{ id: 'f', nombre: '$\\operatorname{sen}(x^2)$', f: x => Math.sin(x * x) }, { id: 'df', nombre: '$2x\\cos(x^2)$', f: x => 2 * x * Math.cos(x * x) }], par: { x0: .8 }, arrastrar: 'x0', capas: [{ tipo: 'tangente', c: 'f', x: 'x0' }, { tipo: 'punto', c: 'df', x: 'x0' }] },
      es: 'Si una función está *dentro* de otra, la derivada multiplica las dos tasas: $\\bigl(f(g(x))\\bigr)\'=f\'(g(x))\\cdot g\'(x)$. Para $\\operatorname{sen}(x^2)$: la de fuera da $\\cos(x^2)$ y la de dentro $2x$. Resultado: $2x\\cos(x^2)$. Arrastra el punto: la altura de la segunda curva sigue a la pendiente de la tangente.',
      en: 'When one function sits *inside* another, the derivative multiplies the two rates: $\\bigl(f(g(x))\\bigr)\'=f\'(g(x))\\cdot g\'(x)$. For $\\sin(x^2)$: the outer one gives $\\cos(x^2)$ and the inner one $2x$. Result: $2x\\cos(x^2)$. Drag the point: the height of the second curve follows the slope of the tangent.',
      jugar: {
        botones: [
          { label: 'x₀ − 0,25', hacer: v => { v.x0 = Math.max(-2.5, +(v.x0 - .25).toFixed(2)); }, off: v => v.x0 <= -2.5 },
          { label: 'x₀ + 0,25', hacer: v => { v.x0 = Math.min(2.5, +(v.x0 + .25).toFixed(2)); }, off: v => v.x0 >= 2.5 },
        ],
        lecturas: (v, cx) => [
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: 'f′(x₀) numérica', valor: cx.fmt(cx.d('f', v.x0)) },
          { expr: '2x₀·cos(x₀²)', valor: cx.fmt(cx.f('df', v.x0)) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { par: { x0: .8 },
      es: '¿Cuál es la derivada de $e^{3x}$?',
      en: 'What is the derivative of $e^{3x}$?',
      pregunta: {
        opc: [
          { es: '$e^{3x}$, la exponencial se deriva a sí misma', en: '$e^{3x}$, the exponential is its own derivative' },
          { es: '$3x\\,e^{3x-1}$, como si fuera una potencia', en: '$3x\\,e^{3x-1}$, as if it were a power' },
          { es: '$3e^{3x}$: la de fuera por la derivada de dentro', en: '$3e^{3x}$: the outer one times the derivative of the inner one', ok: 1 },
        ],
        why: {
          es: 'Cadena: fuera $e^u\\to e^u$, dentro $u=3x\\to3$. Producto: $3e^{3x}$. La primera opción olvida el factor de dentro; la segunda confunde $e^x$ con $x^n$.',
          en: 'Chain: outer $e^u\\to e^u$, inner $u=3x\\to3$. Product: $3e^{3x}$. The first option forgets the inner factor; the second mixes up $e^x$ with $x^n$.',
        },
      } },

    // ── Implícita ──
    { sec: { es: 'Derivación implícita', en: 'Implicit differentiation' },
      funcion: { x: [-7, 7], y: [-6.2, 6.2], igual: true, curvas: [{ id: 'c', nombre: '$x^2+y^2=25$', param: { x: t => 5 * Math.cos(t), y: t => 5 * Math.sin(t), t: [0, 2 * Math.PI] } }],
        par: circ(rad(37)), capas: [{ tipo: 'linea', x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2' }, { tipo: 'punto', x: 'px', y: 'py' }] },
      es: 'Una circunferencia no es la gráfica de una sola función $y=f(x)$, pero tiene tangente en cada punto. Derivamos **ambos lados respecto de $x$**, recordando que $y$ depende de $x$: $2x+2y\\,y\'=0$, y de ahí $y\'=-\\dfrac xy$.',
      en: 'A circle is not the graph of a single function $y=f(x)$, yet it has a tangent at every point. We differentiate **both sides with respect to $x$**, remembering that $y$ depends on $x$: $2x+2y\\,y\'=0$, so $y\'=-\\dfrac xy$.',
      traza: [
        { par: circ(rad(37)), es: 'En $(4,\\,3)$: $y\'=-\\tfrac43$. La tangente baja hacia la derecha y es perpendicular al radio.', en: 'At $(4,\\,3)$: $y\'=-\\tfrac43$. The tangent falls to the right and is perpendicular to the radius.' },
        { par: circ(rad(90)), es: 'En la cima $(0,\\,5)$: $y\'=0$, tangente horizontal.', en: 'At the top $(0,\\,5)$: $y\'=0$, horizontal tangent.' },
        { par: circ(rad(143)), es: 'En $(-4,\\,3)$: $y\'=\\tfrac43$.', en: 'At $(-4,\\,3)$: $y\'=\\tfrac43$.' },
        { par: circ(rad(180)), es: 'En $(-5,\\,0)$ el denominador $y$ es $0$: tangente vertical, $y\'$ no existe como número.', en: 'At $(-5,\\,0)$ the denominator $y$ is $0$: vertical tangent, $y\'$ does not exist as a number.' },
      ] },
  ],
};
