// Guía «Cálculo vectorial» (Multivariable). Usa la escena `campo` (formato en la cabecera de assets/guias/campo.js):
// la capa `campo` pinta F en modo nivel; `camino` + `hasta` (deslizador) recorre la curva; las integrales de línea de las
// lecturas se calculan con las funciones locales de este archivo (no hay escena para campos 3D ni superficies orientadas).
const TAU = 2 * Math.PI;
const PI2 = Math.PI / 2;
const c0 = v => (Math.abs(v) < 1e-9 ? 0 : v);
const r6 = v => Math.round(v * 1e6) / 1e6;

// Campos F = (P, Q)
const ROT = (x, y) => [-y, x];
const RAD = (x, y) => [x, y];
const ESP = (x, y) => [x - y, x + y];
const GRAD = (x, y) => [y, x]; // gradiente de φ = xy
const FUL = (x, y) => [0, x * x]; // para Green
const FUN = (x, y) => [x * x, x * y]; // div = 3x, rot = y

// Caminos con su derivada: { x, y, dx, dy }
const CIRC = { x: Math.cos, y: Math.sin, dx: t => -Math.sin(t), dy: Math.cos };
const CIRU = { x: t => Math.cos(TAU * t), y: t => Math.sin(TAU * t), dx: t => -TAU * Math.sin(TAU * t), dy: t => TAU * Math.cos(TAU * t) }; // t ∈ [0,1]
const RECTA = { x: t => t, y: t => t, dx: () => 1, dy: () => 1 };
const PARAB = { x: t => t, y: t => t * t, dx: () => 1, dy: t => 2 * t };
// Cuadrado unidad recorrido en sentido antihorario, t ∈ [0,4] (un lado por unidad de t)
const lado = t => (t < 1 ? 0 : t < 2 ? 1 : t < 3 ? 2 : 3);
const CUAD = {
  x: t => [t, 1, 3 - t, 0][lado(t)], y: t => [0, t - 1, 1, 4 - t][lado(t)],
  dx: t => [1, 0, -1, 0][lado(t)], dy: t => [0, 1, 0, -1][lado(t)],
};

/** ∫ F·dr sobre r(t), t ∈ [a,b] (punto medio; se parte en los `cortes` para no cruzar esquinas). */
const linea = (F, c, a, b, cortes = []) => {
  const pts = [a, ...cortes.filter(k => k > a && k < b), b]; let s = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const n = 400, h = (pts[k + 1] - pts[k]) / n;
    for (let i = 0; i < n; i++) { const t = pts[k] + (i + .5) * h, [P, Q] = F(c.x(t), c.y(t)); s += (P * c.dx(t) + Q * c.dy(t)) * h; }
  }
  return s;
};
/** ∬ g dA sobre [a,b]×[c,d] (punto medio, n×n). */
const doble = (g, a, b, c, d, n = 100) => {
  let s = 0; const hx = (b - a) / n, hy = (d - c) / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += g(a + (i + .5) * hx, c + (j + .5) * hy);
  return s * hx * hy;
};
/** Divergencia y rotacional escalar por diferencias centradas. */
const dif = (F, x, y, h = 1e-4) => {
  const Px = (F(x + h, y)[0] - F(x - h, y)[0]) / (2 * h), Py = (F(x, y + h)[0] - F(x, y - h)[0]) / (2 * h);
  const Qx = (F(x + h, y)[1] - F(x - h, y)[1]) / (2 * h), Qy = (F(x, y + h)[1] - F(x, y - h)[1]) / (2 * h);
  return { div: r6(Px + Qy), rot: r6(Qx - Py) };
};

const V3 = { x: [-3, 3], y: [-3, 3] };
const V2 = { x: [-2, 2], y: [-2, 2] };
const circ2 = { tipo: 'camino', x: t => 2 * Math.cos(t), y: t => 2 * Math.sin(t), t: [0, TAU] };
const circ1 = { tipo: 'camino', x: Math.cos, y: Math.sin, t: [0, TAU] };

export default {
  titulo: { es: 'Cálculo vectorial', en: 'Vector calculus' },
  fuentes: [
    'Auroux, D. (2010). *18.02SC Multivariable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 3*. OpenStax. https://openstax.org/books/calculus-volume-3/pages/preface',
  ],
  pasos: [
    // ── Campos vectoriales ──
    { sec: { es: 'Campos vectoriales', en: 'Vector fields' },
      campo: { f: (x, y) => Math.hypot(x, y), ...V3, modo: 'nivel', par: {}, capas: [{ tipo: 'campo', F: ROT, n: 11 }],
        etiqueta: { es: 'Campo F = (−y, x); el color indica el módulo |F|', en: 'Field F = (−y, x); colour shows the magnitude |F|' } },
      es: 'Un **campo vectorial** asigna un vector $\\vec F(x,y)=(P,Q)$ a cada punto: viento, corriente, fuerza. Este es $\\vec F=(-y,\\,x)$, un giro alrededor del origen; en $(2,1)$ vale $(-1,\\,2)$. El tamaño de cada flecha es proporcional a $|\\vec F|=r$, como indica el color.',
      en: 'A **vector field** assigns a vector $\\vec F(x,y)=(P,Q)$ to each point: wind, current, force. This one is $\\vec F=(-y,\\,x)$, a swirl around the origin; at $(2,1)$ it equals $(-1,\\,2)$. Each arrow is scaled by $|\\vec F|=r$, as the colour shows.' },
    { capas: [{ tipo: 'campo', F: RAD, n: 11 }],
      es: 'Otro campo: $\\vec F=(x,\\,y)$ **sale** del origen en línea recta, como una fuente. Tiene el mismo módulo $|\\vec F|=r$ y un comportamiento muy distinto: importa tanto la dirección como el tamaño. Esta pareja servirá luego para la divergencia y el rotacional.',
      en: 'Another field: $\\vec F=(x,\\,y)$ **points away** from the origin in straight lines, like a source. It has the same magnitude $|\\vec F|=r$ and a very different behaviour: direction matters as much as size. This pair will come back for divergence and curl.' },

    // ── Integral de línea ──
    { sec: { es: 'Integral de línea', en: 'Line integral' },
      campo: { f: (x, y) => Math.hypot(x, y), ...V2, modo: 'nivel', par: { s: PI2 },
        deslizadores: [{ par: 's', min: 0, max: 6.3, paso: .05, dec: 2, es: '$s$ (hasta dónde se recorre)', en: '$s$ (how far it is travelled)' }],
        capas: [{ tipo: 'campo', F: ROT, n: 9 }, { tipo: 'camino', x: Math.cos, y: Math.sin, t: [0, TAU], hasta: 's' }],
        etiqueta: { es: 'Campo F = (−y, x) y circunferencia unidad recorrida hasta t = s', en: 'Field F = (−y, x) and unit circle travelled up to t = s' } },
      es: 'Una partícula recorre una curva $C$, $\\vec r(t)$ con $a\\le t\\le b$. El **trabajo** del campo es $\\displaystyle\\int_C\\vec F\\cdot d\\vec r=\\int_a^b\\vec F(\\vec r(t))\\cdot\\vec{r}\'(t)\\,dt$. Aquí $C$ es la circunferencia unidad, $\\vec r(t)=(\\cos t,\\sin t)$, y el deslizador fija hasta dónde se recorre.',
      en: 'A particle travels along a curve $C$, $\\vec r(t)$ with $a\\le t\\le b$. The field\'s **work** is $\\displaystyle\\int_C\\vec F\\cdot d\\vec r=\\int_a^b\\vec F(\\vec r(t))\\cdot\\vec{r}\'(t)\\,dt$. Here $C$ is the unit circle, $\\vec r(t)=(\\cos t,\\sin t)$, and the slider sets how far it is travelled.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' },
      jugar: {
        botones: [[PI2, 'π/2'], [Math.PI, 'π'], [3 * Math.PI / 2, '3π/2'], [TAU, '2π']].map(([s, e]) => ({ label: { es: `s = ${e}`, en: `s = ${e}` }, hacer: v => { v.s = s; } })),
        lecturas: (v, cx) => {
          const s = Math.min(v.s, TAU);
          return [
            { expr: 's', valor: cx.fmt(s) },
            { expr: '∫ F·dr', valor: cx.fmt(c0(linea(ROT, CIRC, 0, s))) },
            { expr: 'F·r′', valor: '1' },
          ];
        },
      },
      es: 'Sobre la circunferencia, $\\vec F(\\vec r(t))=(-\\sin t,\\cos t)$ y $\\vec{r}\'(t)=(-\\sin t,\\cos t)$: **iguales**, el campo empuja siempre a favor del movimiento. El producto es $\\sin^2t+\\cos^2t=1$ y $\\int_0^s1\\,dt=s$. Comprueba la lectura numérica.',
      en: 'On the circle, $\\vec F(\\vec r(t))=(-\\sin t,\\cos t)$ and $\\vec{r}\'(t)=(-\\sin t,\\cos t)$: **equal**, the field always pushes along the motion. The product is $\\sin^2t+\\cos^2t=1$ and $\\int_0^s1\\,dt=s$. Check the numerical reading.' },
    { par: { s: TAU },
      es: 'Tras una vuelta completa ($s=2\\pi$), ¿cuánto vale $\\oint_C\\vec F\\cdot d\\vec r$?',
      en: 'After one full turn ($s=2\\pi$), what is $\\oint_C\\vec F\\cdot d\\vec r$?',
      pregunta: {
        opc: [
          { es: '$0$, porque volvemos al punto de partida', en: '$0$, because we are back at the starting point' },
          { es: '$2\\pi$, la longitud de la circunferencia', en: '$2\\pi$, the length of the circle', ok: 1 },
          { es: '$\\pi$', en: '$\\pi$' },
        ],
        why: {
          es: 'Como $\\vec F\\cdot\\vec{r}\'=1$ en todo punto, la integral es la longitud de la curva: $2\\pi$. Que no sea $0$ al cerrar el circuito significa que el campo hace trabajo neto: **no es conservativo**.',
          en: 'Since $\\vec F\\cdot\\vec{r}\'=1$ at every point, the integral is the length of the curve: $2\\pi$. That it is not $0$ after closing the loop means the field does net work: it is **not conservative**.',
        },
      } },

    // ── Conservativo ──
    { sec: { es: 'Campos conservativos', en: 'Conservative fields' },
      campo: { f: (x, y) => x * y, ...V2, modo: 'nivel', par: { u: .5 },
        deslizadores: [{ par: 'u', min: 0, max: 1, paso: .025, dec: 3, es: '$u$ (fracción recorrida)', en: '$u$ (fraction travelled)' }],
        capas: [{ tipo: 'campo', grad: true, n: 9 }, { tipo: 'camino', x: RECTA.x, y: RECTA.y, t: [0, 1], hasta: 'u' }, { tipo: 'camino', x: PARAB.x, y: PARAB.y, t: [0, 1], hasta: 'u' }],
        etiqueta: { es: 'Potencial φ = xy (color), campo F = ∇φ y dos caminos de (0,0) a (1,1)', en: 'Potential φ = xy (colour), field F = ∇φ and two paths from (0,0) to (1,1)' } },
      es: 'Un campo es **conservativo** si es un gradiente: $\\vec F=\\nabla\\varphi$. Aquí $\\varphi=xy$ (el color) y $\\vec F=(y,\\,x)$ es perpendicular a sus curvas de nivel. Hay dos caminos de $(0,0)$ a $(1,1)$: la recta $y=x$ y la parábola $y=x^2$.',
      en: 'A field is **conservative** if it is a gradient: $\\vec F=\\nabla\\varphi$. Here $\\varphi=xy$ (the colour) and $\\vec F=(y,\\,x)$ is perpendicular to its level curves. There are two paths from $(0,0)$ to $(1,1)$: the line $y=x$ and the parabola $y=x^2$.' },
    { par: { u: 1 },
      jugar: {
        botones: [.25, .5, .75, 1].map(u => ({ label: { es: `u = ${String(u).replace('.', ',')}`, en: `u = ${u}` }, hacer: v => { v.u = u; } })),
        lecturas: (v, cx) => [
          { expr: '∫ recta', valor: cx.fmt(linea(GRAD, RECTA, 0, v.u)) },
          { expr: '∫ parábola', valor: cx.fmt(linea(GRAD, PARAB, 0, v.u)) },
          { expr: 'φ(fin recta)', valor: cx.fmt(v.u * v.u) },
          { expr: 'φ(fin parábola)', valor: cx.fmt(v.u * v.u * v.u) },
        ],
      },
      es: '**Teorema fundamental**: $\\int_C\\nabla\\varphi\\cdot d\\vec r=\\varphi(B)-\\varphi(A)$, sea cual sea el camino. Recta: $\\vec F\\cdot\\vec{r}\'=2t$, integral $1$. Parábola: $(t^2,t)\\cdot(1,2t)=3t^2$, integral $1$. Ambas valen $\\varphi(1,1)-\\varphi(0,0)=1$. Con $u<1$ cada una vale $\\varphi$ en su punto final.',
      en: '**Fundamental theorem**: $\\int_C\\nabla\\varphi\\cdot d\\vec r=\\varphi(B)-\\varphi(A)$, whatever the path. Line: $\\vec F\\cdot\\vec{r}\'=2t$, integral $1$. Parabola: $(t^2,t)\\cdot(1,2t)=3t^2$, integral $1$. Both equal $\\varphi(1,1)-\\varphi(0,0)=1$. With $u<1$ each equals $\\varphi$ at its own end point.' },
    { es: '¿Cuál de estos campos es conservativo?',
      en: 'Which of these fields is conservative?',
      pregunta: {
        opc: [
          { es: '$(-y,\\ x)$', en: '$(-y,\\ x)$' },
          { es: '$(2xy,\\ x^2)$', en: '$(2xy,\\ x^2)$', ok: 1 },
          { es: '$(xy,\\ xy)$', en: '$(xy,\\ xy)$' },
        ],
        why: {
          es: 'Criterio en el plano: $\\vec F=(P,Q)$ es conservativo si $\\dfrac{\\partial P}{\\partial y}=\\dfrac{\\partial Q}{\\partial x}$ (en una región sin agujeros). Para $(2xy,x^2)$: $2x=2x$, y $\\varphi=x^2y$. En $(-y,x)$ salen $-1\\neq1$ y en $(xy,xy)$, $x\\neq y$.',
          en: 'Criterion in the plane: $\\vec F=(P,Q)$ is conservative if $\\dfrac{\\partial P}{\\partial y}=\\dfrac{\\partial Q}{\\partial x}$ (on a region without holes). For $(2xy,x^2)$: $2x=2x$, and $\\varphi=x^2y$. For $(-y,x)$ you get $-1\\neq1$ and for $(xy,xy)$, $x\\neq y$.',
        },
      } },
    { capas: [{ tipo: 'campo', grad: true, n: 9 }, { tipo: 'camino', x: CIRU.x, y: CIRU.y, t: [0, 1], hasta: 'u' }], par: { u: .125 },
      jugar: {
        botones: [.125, .25, .375, .5, 1].map(u => ({ label: { es: `u = ${String(u).replace('.', ',')}`, en: `u = ${u}` }, hacer: v => { v.u = u; } })),
        lecturas: (v, cx) => [
          { expr: 'u', valor: cx.fmt(v.u) },
          { expr: '∫ F·dr', valor: cx.fmt(c0(linea(GRAD, CIRU, 0, v.u))) },
          { expr: '½ sen 4πu', valor: cx.fmt(c0(Math.sin(2 * TAU * v.u) / 2)) },
        ],
      },
      es: 'En un campo conservativo la circulación por **toda curva cerrada** es $0$: $\\varphi(A)-\\varphi(A)=0$. Con $(y,x)$ en la circunferencia unidad, $\\vec F\\cdot\\vec{r}\'=\\cos2t$ y la integral hasta $t$ es $\\tfrac12\\sin2t$: sube a $\\tfrac12$, baja a $-\\tfrac12$ y vuelve a $0$. Con $(-y,x)$ daba $2\\pi$.',
      en: 'In a conservative field the circulation around **every closed curve** is $0$: $\\varphi(A)-\\varphi(A)=0$. With $(y,x)$ on the unit circle, $\\vec F\\cdot\\vec{r}\'=\\cos2t$ and the integral up to $t$ is $\\tfrac12\\sin2t$: it rises to $\\tfrac12$, falls to $-\\tfrac12$ and returns to $0$. With $(-y,x)$ it gave $2\\pi$.' },

    // ── Green ──
    { sec: { es: 'Teorema de Green', en: 'Green\'s theorem' },
      campo: { f: (x, y) => x * x, x: [-.5, 1.5], y: [-.5, 1.5], modo: 'nivel', par: { s: 2 },
        deslizadores: [{ par: 's', min: 0, max: 4, paso: .05, dec: 2, es: '$s$ (recorrido del borde)', en: '$s$ (distance along the boundary)' }],
        capas: [{ tipo: 'region', x: [0, 1], y: [0, 1] }, { tipo: 'campo', F: FUL, n: 9 }, { tipo: 'camino', x: CUAD.x, y: CUAD.y, t: [0, 4], hasta: 's' }],
        etiqueta: { es: 'Campo F = (0, x²) y borde del cuadrado unidad en sentido antihorario', en: 'Field F = (0, x²) and the unit-square boundary, counterclockwise' } },
      es: '**Teorema de Green**: si $C$ cierra una región $D$ (antihorario), $\\displaystyle\\oint_CP\\,dx+Q\\,dy=\\iint_D\\Bigl(\\dfrac{\\partial Q}{\\partial x}-\\dfrac{\\partial P}{\\partial y}\\Bigr)dA$. La circulación por el borde es el giro local acumulado dentro. Probémoslo con $\\vec F=(0,\\,x^2)$ y el cuadrado unidad.',
      en: '**Green\'s theorem**: if $C$ encloses a region $D$ (counterclockwise), $\\displaystyle\\oint_CP\\,dx+Q\\,dy=\\iint_D\\Bigl(\\dfrac{\\partial Q}{\\partial x}-\\dfrac{\\partial P}{\\partial y}\\Bigr)dA$. The circulation around the boundary is the local spin accumulated inside. Let us test it with $\\vec F=(0,\\,x^2)$ and the unit square.' },
    { jugar: {
        botones: [1, 1.5, 2, 3, 4].map(s => ({ label: { es: `s = ${String(s).replace('.', ',')}`, en: `s = ${s}` }, hacer: v => { v.s = s; } })),
        lecturas: (v, cx) => [
          { expr: 's', valor: cx.fmt(v.s) },
          { expr: '∮ hasta s', valor: cx.fmt(c0(linea(FUL, CUAD, 0, Math.min(v.s, 4), [1, 2, 3]))) },
          { expr: '$\\iint (Q_x-P_y)\\,dA$', valor: cx.fmt(doble((x, y) => 2 * x, 0, 1, 0, 1)) },
        ],
      },
      es: 'Aquí $\\partial Q/\\partial x-\\partial P/\\partial y=2x$ y $\\iint_D2x\\,dA=\\int_0^1\\!\\int_0^12x\\,dy\\,dx=1$. Por el borde solo aporta el lado derecho (subiendo en $x=1$): $\\int_0^11\\,dy=1$. En los otros $P=0$ con $dy=0$, o bien $Q=0$ en $x=0$. Recorre el perímetro con $s$.',
      en: 'Here $\\partial Q/\\partial x-\\partial P/\\partial y=2x$ and $\\iint_D2x\\,dA=\\int_0^1\\!\\int_0^12x\\,dy\\,dx=1$. Along the boundary only the right side contributes (going up at $x=1$): $\\int_0^11\\,dy=1$. On the others $P=0$ with $dy=0$, or $Q=0$ at $x=0$. Walk the perimeter with $s$.' },
    { es: 'Con $P=-\\tfrac y2$ y $Q=\\tfrac x2$ el integrando de Green vale $1$, así que el **área** es $A=\\tfrac12\\oint_Cx\\,dy-y\\,dx$. Para una circunferencia de radio $a$, $x\\,dy-y\\,dx=a^2dt$ y $A=\\tfrac12\\cdot2\\pi a^2=\\pi a^2$. Y para $(-y,x)$ el integrando es $2$: circulación $2\\cdot\\pi=2\\pi$, como al principio.',
      en: 'With $P=-\\tfrac y2$ and $Q=\\tfrac x2$ the Green integrand equals $1$, so the **area** is $A=\\tfrac12\\oint_Cx\\,dy-y\\,dx$. For a circle of radius $a$, $x\\,dy-y\\,dx=a^2dt$ and $A=\\tfrac12\\cdot2\\pi a^2=\\pi a^2$. And for $(-y,x)$ the integrand is $2$: circulation $2\\cdot\\pi=2\\pi$, as at the start.' },
    { es: 'Una región tiene área $5$. ¿Cuánto vale $\\oint_C(-y\\,dx+2x\\,dy)$, en sentido antihorario?',
      en: 'A region has area $5$. What is $\\oint_C(-y\\,dx+2x\\,dy)$, counterclockwise?',
      pregunta: {
        opc: [
          { es: '$5$', en: '$5$' },
          { es: '$10$', en: '$10$' },
          { es: '$15$', en: '$15$', ok: 1 },
        ],
        why: {
          es: 'Con $P=-y$ y $Q=2x$: $\\partial Q/\\partial x-\\partial P/\\partial y=2-(-1)=3$, constante. Entonces la circulación es $3\\cdot\\text{Área}=15$, sin conocer la forma de la región. $10$ sale de olvidar el término $-1$.',
          en: 'With $P=-y$ and $Q=2x$: $\\partial Q/\\partial x-\\partial P/\\partial y=2-(-1)=3$, constant. So the circulation is $3\\cdot\\text{Area}=15$, without knowing the shape of the region. $10$ comes from forgetting the $-1$ term.',
        },
      } },

    // ── Divergencia y rotacional ──
    { sec: { es: 'Divergencia', en: 'Divergence' },
      campo: { f: (x, y) => .001 * (x * x + y * y), x: [-2.5, 2.5], y: [-2.5, 2.5], z: [0, 1], modo: 'nivel', par: { x0: 1, y0: 1 }, arrastrar: ['x0', 'y0'],
        capas: [{ tipo: 'campo', F: RAD, n: 11 }],
        etiqueta: { es: 'Campo vectorial sobre el plano; arrastra el punto cuando aparezca', en: 'Vector field on the plane; drag the point when it appears' } },
      es: 'La **divergencia** $\\operatorname{div}\\vec F=\\dfrac{\\partial P}{\\partial x}+\\dfrac{\\partial Q}{\\partial y}$ mide cuánto *sale* de un punto por unidad de área: positiva en una fuente, negativa en un sumidero, cero si lo que entra es lo que sale. Para $\\vec F=(x,y)$: $\\operatorname{div}=1+1=2$ en todas partes.',
      en: 'The **divergence** $\\operatorname{div}\\vec F=\\dfrac{\\partial P}{\\partial x}+\\dfrac{\\partial Q}{\\partial y}$ measures how much *leaves* a point per unit area: positive at a source, negative at a sink, zero if what comes in is what goes out. For $\\vec F=(x,y)$: $\\operatorname{div}=1+1=2$ everywhere.' },
    { sec: { es: 'Rotacional', en: 'Curl' }, capas: [{ tipo: 'campo', F: ROT, n: 11 }],
      es: 'El **rotacional** (escalar, en el plano) $\\operatorname{rot}\\vec F=\\dfrac{\\partial Q}{\\partial x}-\\dfrac{\\partial P}{\\partial y}$ mide el giro local: una rueda de paletas gira en sentido antihorario si es positivo. Para $(-y,x)$: $\\operatorname{rot}=1-(-1)=2$ y $\\operatorname{div}=0+0=0$. Gira, pero nada se acumula.',
      en: 'The **curl** (scalar, in the plane) $\\operatorname{rot}\\vec F=\\dfrac{\\partial Q}{\\partial x}-\\dfrac{\\partial P}{\\partial y}$ measures local spin: a paddle wheel turns counterclockwise if it is positive. For $(-y,x)$: $\\operatorname{rot}=1-(-1)=2$ and $\\operatorname{div}=0+0=0$. It swirls, but nothing piles up.' },
    { capas: [{ tipo: 'campo', F: ESP, n: 11 }, { tipo: 'punto', x: 1, y: 1 }],
      es: 'Un campo puede tener ambas cosas. $\\vec F=(x-y,\\,x+y)$ sale y gira a la vez: $\\operatorname{div}=1+1=2$ y $\\operatorname{rot}=1-(-1)=2$. En $(1,1)$ vale $(0,\\,2)$: hacia arriba, tangente al giro y alejándose del origen.',
      en: 'A field can have both. $\\vec F=(x-y,\\,x+y)$ spreads out and swirls at once: $\\operatorname{div}=1+1=2$ and $\\operatorname{rot}=1-(-1)=2$. At $(1,1)$ it equals $(0,\\,2)$: upward, following the swirl while moving away from the origin.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, capas: [{ tipo: 'campo', F: FUN, n: 9 }, { tipo: 'punto', x: 'x0', y: 'y0' }],
      jugar: {
        botones: [
          { label: { es: 'ir a (1, 0)', en: 'go to (1, 0)' }, hacer: v => { v.x0 = 1; v.y0 = 0; } },
          { label: { es: 'ir a (−1, 2)', en: 'go to (−1, 2)' }, hacer: v => { v.x0 = -1; v.y0 = 2; } },
          { label: { es: 'ir a (0, 0)', en: 'go to (0, 0)' }, hacer: v => { v.x0 = 0; v.y0 = 0; } },
          { label: { es: 'ir a (2, −1)', en: 'go to (2, −1)' }, hacer: v => { v.x0 = 2; v.y0 = -1; } },
        ],
        lecturas: (v, cx) => {
          const F = FUN(v.x0, v.y0), d = dif(FUN, v.x0, v.y0);
          return [
            { expr: '(x, y)', valor: `(${cx.fmt(v.x0)}, ${cx.fmt(v.y0)})` },
            { expr: 'F(x, y)', valor: `(${cx.fmt(F[0])}, ${cx.fmt(F[1])})` },
            { expr: 'div F', valor: cx.fmt(c0(d.div)) },
            { expr: 'rot F', valor: cx.fmt(c0(d.rot)) },
          ];
        },
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      },
      es: 'Arrastra el punto. Para $\\vec F=(x^2,\\,xy)$: $\\operatorname{div}=2x+x=3x$ y $\\operatorname{rot}=y-0=y$. Ambos cambian con la posición: para $x<0$ el campo converge (sumidero) y por encima del eje $x$ el giro es antihorario. Compara la lectura con estas fórmulas.',
      en: 'Drag the point. For $\\vec F=(x^2,\\,xy)$: $\\operatorname{div}=2x+x=3x$ and $\\operatorname{rot}=y-0=y$. Both change with position: for $x<0$ the field converges (sink) and above the $x$-axis the spin is counterclockwise. Compare the reading with these formulas.' },
    { par: { x0: -1, y0: 2 },
      es: 'En el punto $(-1,\\,2)$ del campo $\\vec F=(x^2,\\,xy)$, ¿qué ocurre?',
      en: 'At the point $(-1,\\,2)$ of the field $\\vec F=(x^2,\\,xy)$, what happens?',
      pregunta: {
        opc: [
          { es: '$\\operatorname{div}=-3$ (sumidero) y $\\operatorname{rot}=2$ (giro antihorario)', en: '$\\operatorname{div}=-3$ (sink) and $\\operatorname{rot}=2$ (counterclockwise spin)', ok: 1 },
          { es: '$\\operatorname{div}=3$ (fuente) y $\\operatorname{rot}=-2$ (giro horario)', en: '$\\operatorname{div}=3$ (source) and $\\operatorname{rot}=-2$ (clockwise spin)' },
          { es: '$\\operatorname{div}=-3$ (sumidero) y $\\operatorname{rot}=-2$ (giro horario)', en: '$\\operatorname{div}=-3$ (sink) and $\\operatorname{rot}=-2$ (clockwise spin)' },
        ],
        why: {
          es: '$P=x^2$, $Q=xy$. $\\operatorname{div}=2x+x=3x=-3$. $\\operatorname{rot}=\\partial Q/\\partial x-\\partial P/\\partial y=y-0=2$. El signo del rotacional se lee con la regla de la mano derecha: positivo = antihorario.',
          en: '$P=x^2$, $Q=xy$. $\\operatorname{div}=2x+x=3x=-3$. $\\operatorname{rot}=\\partial Q/\\partial x-\\partial P/\\partial y=y-0=2$. The sign of the curl follows the right-hand rule: positive = counterclockwise.',
        },
      } },

    // ── Divergencia y Stokes ──
    { sec: { es: 'Teorema de la divergencia', en: 'Divergence theorem' }, capas: [{ tipo: 'campo', F: RAD, n: 11 }, circ2],
      es: 'El flujo hacia fuera por el borde es lo que producen las fuentes dentro. En el plano, $\\displaystyle\\oint_C\\vec F\\cdot\\vec n\\,ds=\\iint_D\\operatorname{div}\\vec F\\,dA$. Con $\\vec F=(x,y)$ y $C$ de radio $2$: por el borde, $\\vec F\\cdot\\vec n=2$ y longitud $4\\pi$, es decir $8\\pi$; dentro, $2\\cdot4\\pi=8\\pi$.',
      en: 'The outward flux through the boundary is what the sources inside produce. In the plane, $\\displaystyle\\oint_C\\vec F\\cdot\\vec n\\,ds=\\iint_D\\operatorname{div}\\vec F\\,dA$. With $\\vec F=(x,y)$ and $C$ of radius $2$: through the boundary, $\\vec F\\cdot\\vec n=2$ and length $4\\pi$, that is $8\\pi$; inside, $2\\cdot4\\pi=8\\pi$.' },
    { es: 'En el espacio, $\\displaystyle\\iint_S\\vec F\\cdot\\vec n\\,dS=\\iiint_E\\operatorname{div}\\vec F\\,dV$ para $S$ cerrada. Con $\\vec F=(x,y,z)$ y la esfera unidad: por la superficie, $\\vec F\\cdot\\vec n=1$ y el área es $4\\pi$, flujo $4\\pi$; por el volumen, $\\operatorname{div}=3$ y $V=\\tfrac{4\\pi}3$, así que $3\\cdot\\tfrac{4\\pi}{3}=4\\pi$. La triple suele ser mucho más fácil.',
      en: 'In space, $\\displaystyle\\iint_S\\vec F\\cdot\\vec n\\,dS=\\iiint_E\\operatorname{div}\\vec F\\,dV$ for a closed $S$. With $\\vec F=(x,y,z)$ and the unit sphere: over the surface, $\\vec F\\cdot\\vec n=1$ and the area is $4\\pi$, flux $4\\pi$; over the volume, $\\operatorname{div}=3$ and $V=\\tfrac{4\\pi}3$, so $3\\cdot\\tfrac{4\\pi}{3}=4\\pi$. The triple integral is usually much easier.' },
    { sec: { es: 'Teorema de Stokes', en: 'Stokes\' theorem' }, capas: [{ tipo: 'campo', F: ROT, n: 11 }, circ1],
      es: '**Stokes** es Green sobre una superficie cualquiera: la circulación por el borde $C$ es el flujo del rotacional por la superficie, $\\displaystyle\\oint_C\\vec F\\cdot d\\vec r=\\iint_S(\\nabla\\times\\vec F)\\cdot\\vec n\\,dS$. Con $\\vec F=(-y,x,0)$: $\\nabla\\times\\vec F=(0,0,2)$. El borde es la circunferencia unidad y su circulación ya la conocemos: $2\\pi$.',
      en: '**Stokes** is Green on any surface: the circulation around the boundary $C$ is the flux of the curl through the surface, $\\displaystyle\\oint_C\\vec F\\cdot d\\vec r=\\iint_S(\\nabla\\times\\vec F)\\cdot\\vec n\\,dS$. With $\\vec F=(-y,x,0)$: $\\nabla\\times\\vec F=(0,0,2)$. The boundary is the unit circle and we already know its circulation: $2\\pi$.' },
    { es: 'Disco plano $x^2+y^2\\le1$, $\\vec n=\\vec k$: $\\iint2\\,dA=2\\pi$. Semiesfera superior, $\\vec n=(x,y,z)$: $(\\nabla\\times\\vec F)\\cdot\\vec n=2z$ y $\\iint2z\\,dS=\\int_0^{2\\pi}\\!\\int_0^{\\pi/2}2\\cos\\varphi\\sin\\varphi\\,d\\varphi\\,d\\theta=2\\pi$. Dos superficies distintas con el **mismo borde** dan el mismo flujo del rotacional.',
      en: 'Flat disc $x^2+y^2\\le1$, $\\vec n=\\vec k$: $\\iint2\\,dA=2\\pi$. Upper hemisphere, $\\vec n=(x,y,z)$: $(\\nabla\\times\\vec F)\\cdot\\vec n=2z$ and $\\iint2z\\,dS=\\int_0^{2\\pi}\\!\\int_0^{\\pi/2}2\\cos\\varphi\\sin\\varphi\\,d\\varphi\\,d\\theta=2\\pi$. Two different surfaces with the **same boundary** give the same flux of the curl.',
      pregunta: {
        opc: [
          { es: 'El de la semiesfera es mayor, porque tiene más área', en: 'The hemisphere one is larger, because it has more area' },
          { es: 'Los dos son iguales: ambos valen la circulación por $C$', en: 'They are equal: both equal the circulation around $C$', ok: 1 },
          { es: 'Depende de la superficie que se elija', en: 'It depends on the surface chosen' },
        ],
        why: {
          es: 'Stokes dice que ambos flujos son iguales a $\\oint_C\\vec F\\cdot d\\vec r$, que solo depende del borde. El área extra de la semiesfera queda compensada porque $\\vec n$ está más inclinado respecto de $(0,0,2)$.',
          en: 'Stokes says both fluxes equal $\\oint_C\\vec F\\cdot d\\vec r$, which depends only on the boundary. The extra area of the hemisphere is compensated because $\\vec n$ is more tilted with respect to $(0,0,2)$.',
        },
      } },
    { sec: { es: 'Resumen', en: 'Summary' },
      es: 'Todos estos teoremas dicen lo mismo: la integral de una **derivada** sobre una región es una integral de la función sobre su **frontera**. Fundamental: $\\varphi(B)-\\varphi(A)$. Green y Stokes: rotacional dentro, circulación en el borde. Divergencia: divergencia dentro, flujo en el borde. Y $\\operatorname{rot}\\vec F=0$ en una región sin agujeros garantiza que $\\vec F$ sea conservativo.',
      en: 'All these theorems say the same thing: the integral of a **derivative** over a region equals an integral of the function over its **boundary**. Fundamental: $\\varphi(B)-\\varphi(A)$. Green and Stokes: curl inside, circulation on the boundary. Divergence: divergence inside, flux on the boundary. And $\\operatorname{rot}\\vec F=0$ on a region without holes guarantees that $\\vec F$ is conservative.' },
  ],
};

