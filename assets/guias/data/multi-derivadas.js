// Guía «Derivadas parciales y gradiente» (Multivariable). Usa las escenas `campo` (formato en la cabecera de assets/guias/campo.js)
// y `funcion` (corte como curva plana). Función de trabajo: f(x, y) = x² + xy + 2y², en el punto (1, 1): f = 4, fx = 3, fy = 5, ∇f = (3, 5).
// La dirección u de la derivada direccional se pinta con parámetros DERIVADOS (px, py = punto + R·u): los recalcula `soltar` al mover
// el deslizador de θ (por eso los pasos con deslizador llevan `jugar`) y los pasos con `par` los fijan con dir(θ).
const f = (x, y) => x * x + x * y + 2 * y * y;
const fx = (x, y) => 2 * x + y;
const fy = (x, y) => x + 4 * y;
const V = { x: [-2, 2], y: [-2, 2] };
const g1 = x => x * x + x + 2; // corte y = 1: f(x, 1)

const R = .5, rad = a => a * Math.PI / 180;
const poner = v => { v.px = v.x0 + R * Math.cos(rad(v.th)); v.py = v.y0 + R * Math.sin(rad(v.th)); };
const dir = th => ({ th, px: 1 + R * Math.cos(rad(th)), py: 1 + R * Math.sin(rad(th)) });
const limpio = x => (Math.abs(x) < 1e-9 ? 0 : x);
const PHI = Math.atan2(5, 3) * 180 / Math.PI; // ángulo de ∇f(1,1) ≈ 59,04°

const P = { tipo: 'punto', x: 'x0', y: 'y0' };
const GRAD = { tipo: 'gradiente', x: 'x0', y: 'y0', k: 1.5 };
const CY = { tipo: 'corte', eje: 'y', v: 'y0' };
const CX = { tipo: 'corte', eje: 'x', v: 'x0' };
const superficie = capas => ({ f, ...V, modo: 'superficie', par: { x0: 1, y0: 1 }, arrastrar: ['x0', 'y0'], capas,
  etiqueta: { es: 'Superficie z = x² + xy + 2y²', en: 'Surface z = x² + xy + 2y²' } });

// Derivada direccional: la dirección se maneja con el deslizador de θ
const DIR_CAPAS = [GRAD, P, { tipo: 'punto', x: 'px', y: 'py' }, { tipo: 'texto', x: 'px', y: 'py', s: '$u$' }];
const DIR_J = {
  botones: [
    { label: { es: 'θ = 0° (eje x)', en: 'θ = 0° (x axis)' }, hacer: v => { v.th = 0; poner(v); } },
    { label: { es: 'θ = 90° (eje y)', en: 'θ = 90° (y axis)' }, hacer: v => { v.th = 90; poner(v); } },
    { label: { es: 'θ = dirección de ∇f', en: 'θ = direction of ∇f' }, hacer: v => { v.th = (Math.atan2(fy(v.x0, v.y0), fx(v.x0, v.y0)) * 180 / Math.PI + 360) % 360; poner(v); } },
    { label: { es: 'θ ⟂ ∇f (curva de nivel)', en: 'θ ⟂ ∇f (level curve)' }, hacer: v => { v.th = (Math.atan2(fy(v.x0, v.y0), fx(v.x0, v.y0)) * 180 / Math.PI + 450) % 360; poner(v); } },
  ],
  lecturas: (v, cx) => {
    const [a, b] = cx.grad(v.x0, v.y0), c = Math.cos(rad(v.th)), s = Math.sin(rad(v.th)), D = limpio(a * c + b * s);
    return [
      { expr: '(x₀, y₀)', valor: `(${cx.fmt(v.x0)}, ${cx.fmt(v.y0)})` },
      { expr: '∇f', valor: `(${cx.fmt(a)}, ${cx.fmt(b)})` },
      { expr: 'u = (cos θ, sen θ)', valor: `(${cx.fmt(c)}, ${cx.fmt(s)})` },
      { expr: '$D_u f=\\nabla f\\cdot u$', valor: cx.fmt(D), malo: D < 0 },
      { expr: '|∇f|', valor: cx.fmt(Math.hypot(a, b)) },
    ];
  },
  arrastrables: true, soltar: (v, par, val) => { v[par] = val; poner(v); },
};

export default {
  titulo: { es: 'Derivadas parciales y gradiente', en: 'Partial derivatives and the gradient' },
  fuentes: [
    'Auroux, D. (2010). *18.02SC Multivariable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 3*. OpenStax. https://openstax.org/books/calculus-volume-3/pages/preface',
  ],
  pasos: [
    // ── Cortes y derivadas parciales ──
    { sec: { es: 'Dos formas de moverse', en: 'Two ways to move' },
      campo: superficie([P]),
      es: 'En una variable, $f\'(x_0)$ es la pendiente de la curva. Con dos variables hay **muchas** direcciones para salir de un punto, así que la pendiente depende de hacia dónde mires. Empezamos por las dos más simples: avanzar solo en $x$ o solo en $y$. La superficie es $f(x,y)=x^2+xy+2y^2$ y el punto, $(1,\\,1)$, con $f(1,1)=4$. **Arrastra** para girarla.',
      en: 'In one variable, $f\'(x_0)$ is the slope of the curve. With two variables there are **many** directions to leave a point, so the slope depends on where you look. We start with the two simplest: moving only in $x$ or only in $y$. The surface is $f(x,y)=x^2+xy+2y^2$ and the point is $(1,\\,1)$, with $f(1,1)=4$. **Drag** to rotate it.' },
    { capas: [P, CY],
      es: 'Fijar $y=y_0=1$ equivale a cortar la superficie con el plano vertical $y=1$. La **curva de corte** (en ámbar) es una función de una sola variable: $g(x)=f(x,1)=x^2+x+2$. Su pendiente en $x=1$ es la **derivada parcial** respecto de $x$: $f_x(1,1)=g\'(1)=2\\cdot1+1=3$.',
      en: 'Fixing $y=y_0=1$ means cutting the surface with the vertical plane $y=1$. The **cut curve** (amber) is a function of one variable: $g(x)=f(x,1)=x^2+x+2$. Its slope at $x=1$ is the **partial derivative** with respect to $x$: $f_x(1,1)=g\'(1)=2\\cdot1+1=3$.' },
    { sec: { es: 'El corte visto de lado', en: 'The cut seen from the side' },
      funcion: { x: [-2, 2], y: [0, 9], curvas: [{ id: 'g', nombre: { es: '$f(x,1)$', en: '$f(x,1)$' }, f: g1 }], par: { x0: 1 }, arrastrar: 'x0',
        capas: [{ tipo: 'tangente', c: 'g', x: 'x0' }, { tipo: 'punto', c: 'g', x: 'x0' }],
        etiqueta: { es: 'Corte y = 1 de la superficie, como curva plana', en: 'Cut y = 1 of the surface, as a plane curve' } },
      es: 'El mismo corte, como curva plana $z=g(x)$. La tangente en $x_0=1$ tiene pendiente $3$. Arrastra el punto: la pendiente del corte es $f_x(x_0,\\,1)=2x_0+1$, y se anula en el fondo de la parábola, $x_0=-\\tfrac12$.',
      en: 'The same cut, as a plane curve $z=g(x)$. The tangent at $x_0=1$ has slope $3$. Drag the point: the slope of the cut is $f_x(x_0,\\,1)=2x_0+1$, and it vanishes at the bottom of the parabola, $x_0=-\\tfrac12$.',
      jugar: {
        botones: [
          { label: 'x₀ − 0,25', hacer: v => { v.x0 = Math.max(-2, +(v.x0 - .25).toFixed(2)); }, off: v => v.x0 <= -2 },
          { label: 'x₀ + 0,25', hacer: v => { v.x0 = Math.min(2, +(v.x0 + .25).toFixed(2)); }, off: v => v.x0 >= 2 },
          { label: { es: 'ir a x₀ = −0,5', en: 'go to x₀ = −0.5' }, hacer: v => { v.x0 = -.5; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: 'f(x₀, 1)', valor: cx.fmt(cx.f('g', v.x0)) },
          { expr: 'pendiente (numérica)', valor: cx.fmt(cx.d('g', v.x0)), malo: cx.d('g', v.x0) < 0 },
          { expr: 'fₓ(x₀, 1) = 2x₀ + 1', valor: cx.fmt(2 * v.x0 + 1) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { sec: { es: 'Las dos derivadas parciales', en: 'The two partial derivatives' },
      campo: superficie([P, CY, CX]),
      es: 'Formalmente, $f_x(x_0,y_0)=\\displaystyle\\lim_{h\\to0}\\frac{f(x_0+h,y_0)-f(x_0,y_0)}{h}$ y análogamente $f_y$. En la práctica: **derivas respecto de una variable y tratas la otra como constante**. Aquí $f_x=2x+y$ y $f_y=x+4y$. En $(1,1)$ valen $3$ y $5$: el corte $x=1$ (segunda curva) sube más deprisa que el corte $y=1$.',
      en: 'Formally, $f_x(x_0,y_0)=\\displaystyle\\lim_{h\\to0}\\frac{f(x_0+h,y_0)-f(x_0,y_0)}{h}$ and likewise $f_y$. In practice: **differentiate with respect to one variable and treat the other as a constant**. Here $f_x=2x+y$ and $f_y=x+4y$. At $(1,1)$ they equal $3$ and $5$: the cut $x=1$ (second curve) rises faster than the cut $y=1$.' },
    { es: '¿Cuánto vale $f_y(1,\\,1)$ para $f(x,y)=x^2+xy+2y^2$?',
      en: 'What is $f_y(1,\\,1)$ for $f(x,y)=x^2+xy+2y^2$?',
      pregunta: {
        opc: [
          { es: '$3$', en: '$3$' },
          { es: '$5$', en: '$5$', ok: 1 },
          { es: '$4$', en: '$4$' },
        ],
        why: {
          es: '$f_y=x+4y$ (en $x^2$ no aparece $y$; $xy\\to x$; $2y^2\\to4y$), así que $f_y(1,1)=1+4=5$. El $3$ es $f_x(1,1)$: se ha derivado respecto de la variable equivocada. El $4$ es la altura $f(1,1)$, no una pendiente.',
          en: '$f_y=x+4y$ ($x^2$ has no $y$; $xy\\to x$; $2y^2\\to4y$), so $f_y(1,1)=1+4=5$. The $3$ is $f_x(1,1)$: wrong variable differentiated. The $4$ is the height $f(1,1)$, not a slope.',
        },
      } },
    { sec: { es: 'Plano tangente', en: 'Tangent plane' },
      es: 'Las dos rectas tangentes a los cortes, de pendientes $f_x$ y $f_y$, generan un plano: el **plano tangente**, $z=f(x_0,y_0)+f_x(x_0,y_0)(x-x_0)+f_y(x_0,y_0)(y-y_0)$. En $(1,1)$ es $z=4+3(x-1)+5(y-1)=3x+5y-4$. Cerca del punto aproxima a $f$: en $(1{,}1,\\,0{,}9)$ da $3{,}8$ y el valor exacto es $3{,}82$.',
      en: 'The two tangent lines to the cuts, with slopes $f_x$ and $f_y$, span a plane: the **tangent plane**, $z=f(x_0,y_0)+f_x(x_0,y_0)(x-x_0)+f_y(x_0,y_0)(y-y_0)$. At $(1,1)$ it is $z=4+3(x-1)+5(y-1)=3x+5y-4$. Near the point it approximates $f$: at $(1.1,\\,0.9)$ it gives $3.8$ and the exact value is $3.82$.' },

    // ── Gradiente ──
    { sec: { es: 'El gradiente', en: 'The gradient' }, modo: 'nivel', capas: [P, GRAD],
      es: 'Juntando las dos parciales en un vector: $\\nabla f=(f_x,\\,f_y)$. En $(1,1)$, $\\nabla f=(3,\\,5)$ (flecha verde, dibujada más corta para que quepa). Es **perpendicular a la curva de nivel** que pasa por el punto y apunta hacia donde $f$ **crece más deprisa**. La tangente a la curva de nivel tiene dirección $(5,\\,-3)$ y $3\\cdot5+5\\cdot(-3)=0$.',
      en: 'Putting the two partials in one vector: $\\nabla f=(f_x,\\,f_y)$. At $(1,1)$, $\\nabla f=(3,\\,5)$ (green arrow, drawn shorter to fit). It is **perpendicular to the level curve** through the point and points where $f$ **increases fastest**. The tangent to the level curve has direction $(5,\\,-3)$ and $3\\cdot5+5\\cdot(-3)=0$.' },
    { capas: [P, GRAD, { tipo: 'campo', grad: true, n: 9 }],
      es: 'El campo de gradientes. Las flechas cruzan las curvas de nivel en ángulo recto, apuntan cuesta arriba y son más largas donde las curvas están más juntas. En el origen $\\nabla f=(0,\\,0)$: es el fondo del cuenco.',
      en: 'The gradient field. The arrows cross the level curves at right angles, point uphill and are longer where the curves are closer together. At the origin $\\nabla f=(0,\\,0)$: the bottom of the bowl.',
      pregunta: {
        opc: [
          { es: 'La superficie es muy empinada ahí: $|\\nabla f|$ es grande', en: 'The surface is very steep there: $|\\nabla f|$ is large', ok: 1 },
          { es: '$f$ vale casi cero', en: '$f$ is almost zero' },
          { es: 'El gradiente se anula', en: 'The gradient vanishes' },
        ],
        why: {
          es: 'Entre dos curvas consecutivas $f$ cambia siempre lo mismo (la diferencia de niveles). Si están cerca, ese cambio ocurre en poca distancia: mucha pendiente, $|\\nabla f|$ grande.',
          en: 'Between two consecutive curves $f$ always changes by the same amount (the level step). If they are close, that change happens over a short distance: a steep slope, a large $|\\nabla f|$.',
        },
      } },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, capas: [P, GRAD], par: { x0: 1, y0: 1 },
      es: 'Arrastra el punto por el mapa. Comprueba que $\\nabla f=(2x+y,\\;x+4y)$, que su longitud crece al alejarte del origen y que la flecha **desaparece en $(0,0)$**, donde el gradiente es nulo.',
      en: 'Drag the point around the map. Check that $\\nabla f=(2x+y,\\;x+4y)$, that its length grows as you move away from the origin and that the arrow **disappears at $(0,0)$**, where the gradient is zero.',
      jugar: {
        botones: [
          { label: { es: 'ir a (1, 1)', en: 'go to (1, 1)' }, hacer: v => { v.x0 = 1; v.y0 = 1; } },
          { label: { es: 'ir a (−1,5; 0,5)', en: 'go to (−1.5, 0.5)' }, hacer: v => { v.x0 = -1.5; v.y0 = .5; } },
          { label: { es: 'ir al origen', en: 'go to origin' }, hacer: v => { v.x0 = 0; v.y0 = 0; } },
        ],
        lecturas: (v, cx) => {
          const [a, b] = cx.grad(v.x0, v.y0);
          return [
            { expr: '(x, y)', valor: `(${cx.fmt(v.x0)}, ${cx.fmt(v.y0)})` },
            { expr: 'f(x, y)', valor: cx.fmt(cx.f(v.x0, v.y0)) },
            { expr: '∇f', valor: `(${cx.fmt(a)}, ${cx.fmt(b)})` },
            { expr: '|∇f|', valor: cx.fmt(Math.hypot(a, b)) },
          ];
        },
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },

    // ── Derivada direccional ──
    { sec: { es: 'Derivada direccional', en: 'Directional derivative' },
      campo: { f, ...V, modo: 'nivel', par: { x0: 1, y0: 1, ...dir(45) }, arrastrar: ['x0', 'y0'], capas: DIR_CAPAS,
        deslizadores: [{ par: 'th', min: 0, max: 360, paso: 1, es: 'Dirección $\\theta$ (grados)', en: 'Direction $\\theta$ (degrees)' }],
        etiqueta: { es: 'Mapa de nivel con el gradiente y una dirección u', en: 'Contour map with the gradient and a direction u' } },
      es: 'Para avanzar en una dirección cualquiera, dada por un vector **unitario** $\\mathbf u=(\\cos\\theta,\\,\\operatorname{sen}\\theta)$: $D_{\\mathbf u}f=\\nabla f\\cdot\\mathbf u=f_x\\cos\\theta+f_y\\operatorname{sen}\\theta$. Con $\\theta=0^\\circ$ sale $f_x$ y con $\\theta=90^\\circ$ sale $f_y$. Mueve el **deslizador** de $\\theta$ y observa la lectura; el punto marcado $u$ indica la dirección.',
      en: 'To move in any direction, given by a **unit** vector $\\mathbf u=(\\cos\\theta,\\,\\sin\\theta)$: $D_{\\mathbf u}f=\\nabla f\\cdot\\mathbf u=f_x\\cos\\theta+f_y\\sin\\theta$. With $\\theta=0^\\circ$ you get $f_x$ and with $\\theta=90^\\circ$ you get $f_y$. Move the $\\theta$ **slider** and watch the reading; the marked point $u$ shows the direction.',
      jugar: DIR_J },
    { sec: { es: 'Barrido de direcciones', en: 'Sweeping the directions' }, par: dir(0),
      es: 'Como $D_{\\mathbf u}f=|\\nabla f|\\cos\\alpha$, con $\\alpha$ el ángulo entre $\\mathbf u$ y $\\nabla f$, el valor depende solo de ese ángulo: máximo si $\\alpha=0$, nulo si $\\alpha=90^\\circ$, mínimo si $\\alpha=180^\\circ$. Reproduce la traza.',
      en: 'Since $D_{\\mathbf u}f=|\\nabla f|\\cos\\alpha$, with $\\alpha$ the angle between $\\mathbf u$ and $\\nabla f$, the value depends only on that angle: maximum if $\\alpha=0$, zero if $\\alpha=90^\\circ$, minimum if $\\alpha=180^\\circ$. Play the trace.',
      traza: [
        { par: dir(0), es: '$\\theta=0^\\circ$: $D_{\\mathbf u}f=f_x=3$.', en: '$\\theta=0^\\circ$: $D_{\\mathbf u}f=f_x=3$.' },
        { par: dir(PHI), es: 'Dirección del gradiente ($\\theta\\approx59^\\circ$): $D_{\\mathbf u}f=|\\nabla f|=\\sqrt{34}\\approx5{,}83$. Es el **máximo**.', en: 'Gradient direction ($\\theta\\approx59^\\circ$): $D_{\\mathbf u}f=|\\nabla f|=\\sqrt{34}\\approx5.83$. This is the **maximum**.' },
        { par: dir(90), es: '$\\theta=90^\\circ$: $D_{\\mathbf u}f=f_y=5$.', en: '$\\theta=90^\\circ$: $D_{\\mathbf u}f=f_y=5$.' },
        { par: dir(PHI + 90), es: 'Perpendicular al gradiente ($\\theta\\approx149^\\circ$): $D_{\\mathbf u}f=0$. Es la dirección de la **curva de nivel**: $f$ no cambia.', en: 'Perpendicular to the gradient ($\\theta\\approx149^\\circ$): $D_{\\mathbf u}f=0$. This is the direction of the **level curve**: $f$ does not change.' },
        { par: dir(PHI + 180), es: 'Sentido contrario ($\\theta\\approx239^\\circ$): $D_{\\mathbf u}f=-\\sqrt{34}\\approx-5{,}83$. Es el descenso más rápido.', en: 'Opposite direction ($\\theta\\approx239^\\circ$): $D_{\\mathbf u}f=-\\sqrt{34}\\approx-5.83$. This is the steepest descent.' },
      ] },
    { par: dir(135),
      es: 'Toma $\\theta=135^\\circ$, es decir $\\mathbf u=\\tfrac1{\\sqrt2}(-1,\\,1)$. ¿Cuánto vale $D_{\\mathbf u}f(1,\\,1)$?',
      en: 'Take $\\theta=135^\\circ$, that is $\\mathbf u=\\tfrac1{\\sqrt2}(-1,\\,1)$. What is $D_{\\mathbf u}f(1,\\,1)$?',
      jugar: DIR_J,
      pregunta: {
        opc: [
          { es: '$2$', en: '$2$' },
          { es: '$\\sqrt2\\approx1{,}41$', en: '$\\sqrt2\\approx1.41$', ok: 1 },
          { es: '$8/\\sqrt2\\approx5{,}66$', en: '$8/\\sqrt2\\approx5.66$' },
        ],
        why: {
          es: '$\\nabla f\\cdot\\mathbf u=\\tfrac1{\\sqrt2}\\bigl(3\\cdot(-1)+5\\cdot1\\bigr)=\\tfrac2{\\sqrt2}=\\sqrt2$. El $2$ sale de usar $(-1,\\,1)$ sin dividir por su longitud: $\\mathbf u$ debe ser **unitario**. El $5{,}66$ corresponde a $\\theta=45^\\circ$.',
          en: '$\\nabla f\\cdot\\mathbf u=\\tfrac1{\\sqrt2}\\bigl(3\\cdot(-1)+5\\cdot1\\bigr)=\\tfrac2{\\sqrt2}=\\sqrt2$. The $2$ comes from using $(-1,\\,1)$ without dividing by its length: $\\mathbf u$ must be a **unit** vector. The $5.66$ corresponds to $\\theta=45^\\circ$.',
        },
      } },

    // ── Regla de la cadena ──
    { sec: { es: 'Regla de la cadena', en: 'The chain rule' },
      campo: { f, ...V, modo: 'nivel', par: { x0: 1, y0: 1 },
        capas: [{ tipo: 'camino', x: t => t, y: t => t * t, t: [-1.4, 1.4] }, P, GRAD],
        etiqueta: { es: 'Mapa de nivel con la curva y = x²', en: 'Contour map with the curve y = x²' } },
      es: 'Si recorres una curva $\\mathbf r(t)=(x(t),\\,y(t))$, $f$ pasa a ser función de $t$ y $\\dfrac{d}{dt}f(x(t),y(t))=f_x\\,x\'(t)+f_y\\,y\'(t)=\\nabla f\\cdot\\mathbf r\'(t)$. Con $x=t$, $y=t^2$ (en ámbar, pasa por $(1,1)$ en $t=1$): $\\mathbf r\'(1)=(1,\\,2)$ y $\\nabla f=(3,\\,5)$, luego $3\\cdot1+5\\cdot2=13$.',
      en: 'If you travel along a curve $\\mathbf r(t)=(x(t),\\,y(t))$, $f$ becomes a function of $t$ and $\\dfrac{d}{dt}f(x(t),y(t))=f_x\\,x\'(t)+f_y\\,y\'(t)=\\nabla f\\cdot\\mathbf r\'(t)$. With $x=t$, $y=t^2$ (amber, through $(1,1)$ at $t=1$): $\\mathbf r\'(1)=(1,\\,2)$ and $\\nabla f=(3,\\,5)$, so $3\\cdot1+5\\cdot2=13$.' },
    { es: 'Comprobación directa: $f(t,t^2)=t^2+t^3+2t^4$, cuya derivada $2t+3t^2+8t^3$ vale $13$ en $t=1$. Coincide. Además es una derivada direccional con velocidad no unitaria: $13/|\\mathbf r\'|=13/\\sqrt5\\approx5{,}81$, casi el máximo $5{,}83$: la parábola sube casi en la dirección del gradiente.',
      en: 'Direct check: $f(t,t^2)=t^2+t^3+2t^4$, whose derivative $2t+3t^2+8t^3$ equals $13$ at $t=1$. They agree. It is also a directional derivative with a non-unit speed: $13/|\\mathbf r\'|=13/\\sqrt5\\approx5.81$, almost the maximum $5.83$: the parabola climbs almost along the gradient.' },
  ],
};
