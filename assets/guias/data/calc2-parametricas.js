// Guía «Paramétricas y polares» (Cálculo II): cicloide con tangente, curvas polares (cardioide, rosas, espiral),
// pendiente en polares y área ½∫r² dθ con sectores. Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Las capas que dependen de números calculados (tangente, abanico de sectores) solo se enlazan a `par` en los pasos
// `jugar` y en las trazas; los demás llevan números fijos para que un deslizador no deje la figura a medias.
const TAU = 2 * Math.PI, PI = Math.PI;
const r4 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(4)]));
const lim = (x, a, b) => Math.min(b, Math.max(a, x));

// ── Cicloide: x = t − sen t, y = 1 − cos t ──
const CX = t => t - Math.sin(t), CY = t => 1 - Math.cos(t);
const est = t => { // posición del parámetro y extremos de la tangente
  t = lim(t, 0, TAU);
  const px = CX(t), py = CY(t), dx = 1 - Math.cos(t), dy = Math.sin(t), m = Math.hypot(dx, dy);
  const ux = m > 1e-6 ? dx / m : 0, uy = m > 1e-6 ? dy / m : 1, d = 1.6;
  return r4({ t, x1: px - ux * d, y1: py - uy * d, x2: px + ux * d, y2: py + uy * d });
};
const pend = t => { const dx = 1 - Math.cos(t); return Math.abs(dx) < 1e-6 ? '∞' : Math.sin(t) / dx; };
const TANG = [{ tipo: 'linea', x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2' }, { tipo: 'marca', c: 'cic', u: 't' }];
const MARCA = [{ tipo: 'marca', c: 'cic', u: 't' }];

// ── Polares: cardioide, rosas, espiral ──
const RC = a => 1 + Math.cos(a);
const estP = th => { // extremos de la tangente a la cardioide en th
  th = lim(th, 0, TAU);
  const r = RC(th), rp = -Math.sin(th), px = r * Math.cos(th), py = r * Math.sin(th);
  const dx = rp * Math.cos(th) - r * Math.sin(th), dy = rp * Math.sin(th) + r * Math.cos(th), m = Math.hypot(dx, dy);
  const ux = m > 1e-6 ? dx / m : 1, uy = m > 1e-6 ? dy / m : 0, d = 1.2;
  return r4({ th, x1: px - ux * d, y1: py - uy * d, x2: px + ux * d, y2: py + uy * d });
};
const pendP = th => {
  const r = RC(th), rp = -Math.sin(th), dx = rp * Math.cos(th) - r * Math.sin(th), dy = rp * Math.sin(th) + r * Math.cos(th);
  if (Math.abs(dx) < 1e-6) return Math.abs(dy) < 1e-6 ? '→ 0' : '∞';
  return dy / dx;
};
const TANGP = [{ tipo: 'linea', x1: 'x1', y1: 'y1', x2: 'x2', y2: 'y2' }, { tipo: 'marca', c: 'card', u: 'th' }];

// ── Área: abanico de K sectores entre 0 y th ──
const K = 12;
const puntoFan = (th, i) => { const a = th * i / K, r = RC(a); return [r * Math.cos(a), r * Math.sin(a)]; };
const fanP = th => { // parámetros fx0..fxK, fy0..fyK
  th = lim(th, .1, TAU); const o = { th };
  for (let i = 0; i <= K; i++) { const [x, y] = puntoFan(th, i); o['fx' + i] = x; o['fy' + i] = y; }
  return r4(o);
};
const FANP = Array.from({ length: K + 1 }, (_, i) => ({ tipo: 'linea', x1: 0, y1: 0, x2: 'fx' + i, y2: 'fy' + i }));
const fanFijo = th => Array.from({ length: K + 1 }, (_, i) => { const [x, y] = puntoFan(th, i); return { tipo: 'linea', x1: 0, y1: 0, x2: +x.toFixed(4), y2: +y.toFixed(4) }; });
const sumaFan = th => { let s = 0; for (let i = 0; i < K; i++) s += .5 * RC(th * i / K) ** 2 * th / K; return s; };
const areaExacta = th => .5 * (1.5 * th + 2 * Math.sin(th) + Math.sin(2 * th) / 4);

const VCARD = { x: [-1.7, 2.7], y: [-1.7, 1.7] };
const VROSA = { x: [-1.5, 1.5], y: [-1.4, 1.4] };

export default {
  titulo: { es: 'Paramétricas y polares', en: 'Parametric and polar curves' },
  fuentes: [
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 2*. OpenStax. https://openstax.org/books/calculus-volume-2/pages/preface',
  ],
  pasos: [
    // ── Paramétricas ──
    { sec: { es: 'Curvas paramétricas', en: 'Parametric curves' },
      funcion: { x: [-1.2, 7.5], y: [-1.6, 3.6], igual: true,
        curvas: [{ id: 'cic', nombre: { es: 'cicloide', en: 'cycloid' }, param: { x: CX, y: CY, t: [0, TAU] }, hasta: 't' }],
        par: est(1.5), arrastrar: 't', deslizadores: [{ par: 't', min: 0, max: TAU, paso: .01, es: 'Parámetro t', en: 'Parameter t' }],
        capas: MARCA, etiqueta: { es: 'Un arco de cicloide dibujado hasta el parámetro t', en: 'One arch of a cycloid drawn up to parameter t' } },
      es: 'Una curva **paramétrica** da $x$ e $y$ por separado en función de un parámetro $t$ (piensa en el tiempo). Un punto de una rueda de radio $1$ que rueda sin deslizar describe $x=t-\\operatorname{sen}t$, $y=1-\\cos t$: una **cicloide**. Mueve $t$ y la curva se va dibujando.',
      en: 'A **parametric** curve gives $x$ and $y$ separately as functions of a parameter $t$ (think of time). A point on a wheel of radius $1$ rolling without slipping traces $x=t-\\sin t$, $y=1-\\cos t$: a **cycloid**. Move $t$ and the curve gets drawn.' },
    { par: est(0.01),
      traza: [
        { par: est(PI / 2), es: '$t=\\tfrac\\pi2$: el punto está en $(0{,}57;\\,1)$, a media altura.', en: '$t=\\tfrac\\pi2$: the point is at $(0.57,\\,1)$, at half height.' },
        { par: est(PI), es: '$t=\\pi$: $(3{,}14;\\,2)$, la cima: el punto va en lo más alto de la rueda.', en: '$t=\\pi$: $(3.14,\\,2)$, the top: the point is at the highest part of the wheel.' },
        { par: est(3 * PI / 2), es: '$t=\\tfrac{3\\pi}2$: $(5{,}71;\\,1)$, bajando.', en: '$t=\\tfrac{3\\pi}2$: $(5.71,\\,1)$, coming down.' },
        { par: est(TAU), es: '$t=2\\pi$: $(6{,}28;\\,0)$. Una vuelta de la rueda avanza $2\\pi$, la longitud de su circunferencia.', en: '$t=2\\pi$: $(6.28,\\,0)$. One turn of the wheel advances $2\\pi$, the length of its circumference.' },
      ],
      es: 'Reproduce la traza: el punto sube, llega a la cima en $t=\\pi$ y vuelve al suelo en $t=2\\pi$. A diferencia de $y=f(x)$, aquí la curva puede volver sobre sí misma o tener cúspides, porque $x$ no tiene por qué crecer con $t$ de forma pareja.',
      en: 'Play the trace: the point rises, reaches the top at $t=\\pi$ and returns to the ground at $t=2\\pi$. Unlike $y=f(x)$, here the curve can double back or have cusps, because $x$ need not grow evenly with $t$.' },
    { sec: { es: 'Pendiente de la tangente', en: 'Slope of the tangent' }, par: est(PI / 3), capas: TANG,
      traza: [
        { par: est(PI / 3), es: '$t=\\tfrac\\pi3$: $\\tfrac{0{,}87}{0{,}5}\\approx1{,}73$. Sube con unos $60^\\circ$.', en: '$t=\\tfrac\\pi3$: $\\tfrac{0.87}{0.5}\\approx1.73$. It rises at about $60^\\circ$.' },
        { par: est(PI / 2), es: '$t=\\tfrac\\pi2$: $\\tfrac{1}{1}=1$.', en: '$t=\\tfrac\\pi2$: $\\tfrac{1}{1}=1$.' },
        { par: est(PI), es: '$t=\\pi$: $\\tfrac{0}{2}=0$. Tangente horizontal en la cima.', en: '$t=\\pi$: $\\tfrac{0}{2}=0$. Horizontal tangent at the top.' },
        { par: est(3 * PI / 2), es: '$t=\\tfrac{3\\pi}2$: $\\tfrac{-1}{1}=-1$. Ya baja.', en: '$t=\\tfrac{3\\pi}2$: $\\tfrac{-1}{1}=-1$. It is going down.' },
      ],
      es: 'La pendiente no exige despejar $y(x)$: por la regla de la cadena $\\tfrac{dy}{dt}=\\tfrac{dy}{dx}\\cdot\\tfrac{dx}{dt}$, luego $\\dfrac{dy}{dx}=\\dfrac{dy/dt}{dx/dt}=\\dfrac{\\operatorname{sen}t}{1-\\cos t}$ cuando $\\tfrac{dx}{dt}\\ne0$. Reproduce la traza.',
      en: 'The slope does not require solving for $y(x)$: by the chain rule $\\tfrac{dy}{dt}=\\tfrac{dy}{dx}\\cdot\\tfrac{dx}{dt}$, so $\\dfrac{dy}{dx}=\\dfrac{dy/dt}{dx/dt}=\\dfrac{\\sin t}{1-\\cos t}$ when $\\tfrac{dx}{dt}\\ne0$. Play the trace.' },
    { es: '¿Cuál es la pendiente de la cicloide en $t=\\pi$?',
      en: 'What is the slope of the cycloid at $t=\\pi$?',
      pregunta: {
        opc: [
          { es: '$0$: tangente horizontal', en: '$0$: horizontal tangent', ok: 1 },
          { es: '$\\infty$: tangente vertical', en: '$\\infty$: vertical tangent' },
          { es: '$1$', en: '$1$' },
        ],
        why: {
          es: 'En $t=\\pi$: $\\tfrac{dy}{dt}=\\operatorname{sen}\\pi=0$ y $\\tfrac{dx}{dt}=1-\\cos\\pi=2\\ne0$, así que $\\tfrac{dy}{dx}=0$: es la cima. En $t=0$ y $t=2\\pi$ se anulan las dos derivadas (cúspide) y la pendiente tiende a $\\infty$.',
          en: 'At $t=\\pi$: $\\tfrac{dy}{dt}=\\sin\\pi=0$ and $\\tfrac{dx}{dt}=1-\\cos\\pi=2\\ne0$, so $\\tfrac{dy}{dx}=0$: it is the top. At $t=0$ and $t=2\\pi$ both derivatives vanish (a cusp) and the slope tends to $\\infty$.',
        },
      } },
    { sec: { es: 'Explora la tangente', en: 'Explore the tangent' }, par: est(1), capas: TANG,
      es: 'Arrastra sobre la gráfica, usa el deslizador o los botones. La lectura de $\\tfrac{dy}{dx}$ es el cociente de las dos derivadas: cambia de signo en la cima y se dispara hacia $\\infty$ al acercarse a la cúspide.',
      en: 'Drag on the graph, use the slider or the buttons. The $\\tfrac{dy}{dx}$ readout is the quotient of the two derivatives: it changes sign at the top and blows up towards $\\infty$ near the cusp.',
      jugar: {
        botones: [
          { label: 't − π/12', hacer: v => Object.assign(v, est(v.t - PI / 12)), off: v => v.t <= 0 },
          { label: 't + π/12', hacer: v => Object.assign(v, est(v.t + PI / 12)), off: v => v.t >= TAU },
          { label: { es: 'ir a la cima (t = π)', en: 'go to the top (t = π)' }, hacer: v => Object.assign(v, est(PI)) },
          { label: { es: 'ir a la cúspide (t = 0)', en: 'go to the cusp (t = 0)' }, hacer: v => Object.assign(v, est(0)) },
        ],
        lecturas: (v, cx) => [
          { expr: 't', valor: cx.fmt(v.t) },
          { expr: '(x, y)', valor: `(${cx.fmt(CX(v.t))}, ${cx.fmt(CY(v.t))})` },
          { expr: 'dx/dt = 1 − cos t', valor: cx.fmt(1 - Math.cos(v.t)) },
          { expr: 'dy/dt = sen t', valor: cx.fmt(Math.sin(v.t)) },
          { expr: 'dy/dx', valor: typeof pend(v.t) === 'number' ? cx.fmt(pend(v.t)) : pend(v.t), malo: typeof pend(v.t) !== 'number' },
        ],
        arrastrables: true, soltar: (v, par, val) => Object.assign(v, est(val)),
      } },
    { par: est(TAU), capas: MARCA,
      es: 'Dos resultados clásicos del arco $0\\le t\\le2\\pi$. Área: $\\int y\\,dx=\\int_0^{2\\pi}(1-\\cos t)^2dt=3\\pi$, el triple del círculo que rueda. Longitud: $\\int\\sqrt{x\'^2+y\'^2}\\,dt=\\int_0^{2\\pi}2\\operatorname{sen}\\tfrac t2\\,dt=8$, cuatro veces el diámetro.',
      en: 'Two classic results for the arch $0\\le t\\le2\\pi$. Area: $\\int y\\,dx=\\int_0^{2\\pi}(1-\\cos t)^2dt=3\\pi$, three times the rolling circle. Length: $\\int\\sqrt{x\'^2+y\'^2}\\,dt=\\int_0^{2\\pi}2\\sin\\tfrac t2\\,dt=8$, four times the diameter.' },

    // ── Polares ──
    { sec: { es: 'Curvas polares', en: 'Polar curves' },
      funcion: { x: VCARD.x, y: VCARD.y, igual: true,
        curvas: [
          { id: 'card', nombre: { es: 'cardioide', en: 'cardioid' }, polar: { r: RC, t: [0, TAU] }, hasta: 'th' },
          { id: 'rosa4', nombre: { es: 'rosa de 4 pétalos', en: '4-petal rose' }, polar: { r: a => Math.cos(2 * a), t: [0, TAU] }, hasta: 'th' },
          { id: 'rosa3', nombre: { es: 'rosa de 3 pétalos', en: '3-petal rose' }, polar: { r: a => Math.cos(3 * a), t: [0, TAU] }, hasta: 'th' },
          { id: 'esp', nombre: { es: 'espiral', en: 'spiral' }, polar: { r: a => a / PI, t: [0, TAU] }, hasta: 'th' },
        ],
        par: estP(2.4), arrastrar: 'th', deslizadores: [{ par: 'th', min: 0, max: TAU, paso: .01, es: 'Ángulo θ', en: 'Angle θ' }],
        capas: [{ tipo: 'marca', c: 'card', u: 'th' }], etiqueta: { es: 'Curvas polares dibujadas hasta el ángulo θ', en: 'Polar curves drawn up to the angle θ' } },
      ver: ['card'],
      es: 'En **polares** un punto se da por su distancia $r$ al origen y su ángulo $\\theta$: $x=r\\cos\\theta$, $y=r\\operatorname{sen}\\theta$. La curva $r=1+\\cos\\theta$ se dibuja al crecer $\\theta$ de $0$ a $2\\pi$. Mueve $\\theta$.',
      en: 'In **polar** coordinates a point is given by its distance $r$ to the origin and its angle $\\theta$: $x=r\\cos\\theta$, $y=r\\sin\\theta$. The curve $r=1+\\cos\\theta$ is drawn as $\\theta$ grows from $0$ to $2\\pi$. Move $\\theta$.' },
    { par: { th: .01 },
      traza: [
        { par: { th: PI / 2 }, es: '$\\theta=\\tfrac\\pi2$: $r=1$, el punto está en $(0,\\,1)$.', en: '$\\theta=\\tfrac\\pi2$: $r=1$, the point is at $(0,\\,1)$.' },
        { par: { th: PI }, es: '$\\theta=\\pi$: $r=0$. La curva llega al origen y forma una cúspide.', en: '$\\theta=\\pi$: $r=0$. The curve reaches the origin and forms a cusp.' },
        { par: { th: 3 * PI / 2 }, es: '$\\theta=\\tfrac{3\\pi}2$: $r=1$, el punto está en $(0,\\,-1)$.', en: '$\\theta=\\tfrac{3\\pi}2$: $r=1$, the point is at $(0,\\,-1)$.' },
        { par: { th: TAU }, es: '$\\theta=2\\pi$: $r=2$ otra vez, la curva se cierra.', en: '$\\theta=2\\pi$: $r=2$ again, the curve closes.' },
      ],
      es: 'La **cardioide** $r=1+\\cos\\theta$ parte de $r=2$ en $\\theta=0$, se acerca al origen y lo alcanza en $\\theta=\\pi$ ($r=0$). Reproduce la traza.',
      en: 'The **cardioid** $r=1+\\cos\\theta$ starts at $r=2$ at $\\theta=0$, approaches the origin and reaches it at $\\theta=\\pi$ ($r=0$). Play the trace.' },
    { ver: ['rosa4'], ventana: VROSA, par: { th: .01 }, capas: [{ tipo: 'marca', c: 'rosa4', u: 'th' }],
      traza: [
        { par: { th: PI / 4 }, es: '$\\theta=\\tfrac\\pi4$: $r=\\cos\\tfrac\\pi2=0$, el punto pasa por el origen.', en: '$\\theta=\\tfrac\\pi4$: $r=\\cos\\tfrac\\pi2=0$, the point passes through the origin.' },
        { par: { th: PI / 2 }, es: '$\\theta=\\tfrac\\pi2$: $r=\\cos\\pi=-1$. Con $r<0$ se dibuja al lado opuesto: $(0,\\,-1)$.', en: '$\\theta=\\tfrac\\pi2$: $r=\\cos\\pi=-1$. With $r<0$ it is drawn on the opposite side: $(0,\\,-1)$.' },
        { par: { th: PI }, es: '$\\theta=\\pi$: $r=\\cos2\\pi=1$, punto $(-1,\\,0)$: pétalo de la izquierda.', en: '$\\theta=\\pi$: $r=\\cos2\\pi=1$, point $(-1,\\,0)$: the left petal.' },
        { par: { th: TAU }, es: 'Tras una vuelta completa están los cuatro pétalos.', en: 'After a full turn all four petals are there.' },
      ],
      es: 'La **rosa** $r=\\cos2\\theta$ tiene cuatro pétalos. Cuando $r<0$ el punto se dibuja al lado opuesto del ángulo, por eso el segundo pétalo que aparece es el de abajo y no el de arriba. Reproduce la traza.',
      en: 'The **rose** $r=\\cos2\\theta$ has four petals. When $r<0$ the point is drawn on the opposite side of the angle, which is why the second petal to appear is the lower one, not the upper one. Play the trace.' },
    { ver: ['rosa3'], par: { th: TAU }, capas: [],
      es: 'En general $r=\\cos n\\theta$ da $n$ pétalos si $n$ es impar y $2n$ si es par. Con $n=3$ salen tres: la curva se recorre entera en $[0,\\pi]$ y de $\\pi$ a $2\\pi$ repite el mismo trazo. Usa el deslizador para verlo.',
      en: 'In general $r=\\cos n\\theta$ gives $n$ petals if $n$ is odd and $2n$ if $n$ is even. With $n=3$ there are three: the curve is traced completely over $[0,\\pi]$ and from $\\pi$ to $2\\pi$ it repeats the same stroke. Use the slider to see it.' },
    { es: '¿Cuántos pétalos tiene la rosa $r=\\cos4\\theta$?',
      en: 'How many petals does the rose $r=\\cos4\\theta$ have?',
      pregunta: {
        opc: [
          { es: '$4$', en: '$4$' },
          { es: '$8$', en: '$8$', ok: 1 },
          { es: '$2$', en: '$2$' },
        ],
        why: {
          es: 'Con $n$ par aparecen $2n$ pétalos: $2\\cdot4=8$. Los tramos con $r<0$ dibujan pétalos en el lado opuesto del ángulo, y así no se repiten los de los tramos con $r>0$. Con $n$ impar sí se repiten, y quedan $n$.',
          en: 'With $n$ even there are $2n$ petals: $2\\cdot4=8$. Stretches with $r<0$ draw petals on the opposite side of the angle, so they do not repeat those from stretches with $r>0$. With $n$ odd they do repeat, leaving $n$.',
        },
      } },
    { ver: ['esp'], ventana: { x: [-2.6, 2.6], y: [-2.4, 2.4] }, par: { th: 3.5 }, capas: [{ tipo: 'marca', c: 'esp', u: 'th' }],
      es: 'En la espiral de Arquímedes $r=\\theta/\\pi$ el radio crece de forma lineal con el ángulo: cada vuelta añade $2$ al radio, así que las espiras quedan separadas $2$ unidades. Aquí solo se dibuja una vuelta, hasta $r=2$.',
      en: 'In the Archimedean spiral $r=\\theta/\\pi$ the radius grows linearly with the angle: each turn adds $2$ to the radius, so consecutive coils are $2$ units apart. Only one turn is drawn here, up to $r=2$.' },
    { sec: { es: 'Pendiente en polares', en: 'Slope in polar coordinates' }, ver: ['card'], ventana: VCARD, par: { th: TAU }, capas: [],
      es: 'Con $x=r\\cos\\theta$ e $y=r\\operatorname{sen}\\theta$ se aplica la regla paramétrica con parámetro $\\theta$: $\\dfrac{dy}{dx}=\\dfrac{r\'\\operatorname{sen}\\theta+r\\cos\\theta}{r\'\\cos\\theta-r\\operatorname{sen}\\theta}$. En la cardioide con $\\theta=\\tfrac\\pi2$: $r=1$, $r\'=-1$, y la pendiente es $\\tfrac{-1+0}{0-1}=1$.',
      en: 'With $x=r\\cos\\theta$ and $y=r\\sin\\theta$ the parametric rule applies with parameter $\\theta$: $\\dfrac{dy}{dx}=\\dfrac{r\'\\sin\\theta+r\\cos\\theta}{r\'\\cos\\theta-r\\sin\\theta}$. On the cardioid at $\\theta=\\tfrac\\pi2$: $r=1$, $r\'=-1$, and the slope is $\\tfrac{-1+0}{0-1}=1$.' },
    { sec: { es: 'Tangente a la cardioide', en: 'Tangent to the cardioid' }, par: estP(1.2), capas: TANGP,
      es: 'Mueve $\\theta$ y observa la tangente. Es vertical donde $r\'\\cos\\theta-r\\operatorname{sen}\\theta=0$ (en $\\theta=0$, por ejemplo) y horizontal donde se anula el numerador. En la cúspide, $\\theta=\\pi$, ambos se anulan y la pendiente se obtiene como límite: $0$.',
      en: 'Move $\\theta$ and watch the tangent. It is vertical where $r\'\\cos\\theta-r\\sin\\theta=0$ (at $\\theta=0$, for instance) and horizontal where the numerator vanishes. At the cusp, $\\theta=\\pi$, both vanish and the slope comes from a limit: $0$.',
      jugar: {
        botones: [
          { label: 'θ − π/12', hacer: v => Object.assign(v, estP(v.th - PI / 12)), off: v => v.th <= 0 },
          { label: 'θ + π/12', hacer: v => Object.assign(v, estP(v.th + PI / 12)), off: v => v.th >= TAU },
          { label: { es: 'ir a θ = π/2', en: 'go to θ = π/2' }, hacer: v => Object.assign(v, estP(PI / 2)) },
          { label: { es: 'ir a la cúspide (θ = π)', en: 'go to the cusp (θ = π)' }, hacer: v => Object.assign(v, estP(PI)) },
        ],
        lecturas: (v, cx) => [
          { expr: 'θ', valor: cx.fmt(v.th) },
          { expr: 'r = 1 + cos θ', valor: cx.fmt(RC(v.th)) },
          { expr: 'dy/dx', valor: typeof pendP(v.th) === 'number' ? cx.fmt(pendP(v.th)) : pendP(v.th), malo: pendP(v.th) === '∞' },
        ],
        arrastrables: true, soltar: (v, par, val) => Object.assign(v, estP(val)),
      } },

    // ── Área en polares ──
    { sec: { es: 'Área en polares', en: 'Area in polar coordinates' },
      funcion: { x: VCARD.x, y: VCARD.y, igual: true,
        curvas: [{ id: 'card', nombre: { es: 'cardioide', en: 'cardioid' }, polar: { r: RC, t: [0, TAU] } }, { id: 'rosa4', nombre: { es: 'rosa de 4 pétalos', en: '4-petal rose' }, polar: { r: a => Math.cos(2 * a), t: [0, TAU] } }],
        par: fanP(PI), deslizadores: [{ par: 'th', min: .1, max: TAU, paso: .01, es: 'Ángulo θ', en: 'Angle θ' }],
        capas: fanFijo(PI), etiqueta: { es: 'Cardioide con un abanico de 12 sectores desde el origen', en: 'Cardioid with a fan of 12 sectors from the origin' } },
      ver: ['card'],
      es: 'Un sector circular de radio $r$ y ángulo $\\Delta\\theta$ tiene área $\\tfrac12r^2\\,\\Delta\\theta$: es la fracción $\\tfrac{\\Delta\\theta}{2\\pi}$ del círculo, $\\pi r^2$. Para el área de una curva polar la partimos en sectores desde el origen: aquí, $12$ entre $\\theta=0$ y $\\theta=\\pi$.',
      en: 'A circular sector of radius $r$ and angle $\\Delta\\theta$ has area $\\tfrac12r^2\\,\\Delta\\theta$: it is the fraction $\\tfrac{\\Delta\\theta}{2\\pi}$ of the circle, $\\pi r^2$. For the area of a polar curve we split it into sectors from the origin: here, $12$ between $\\theta=0$ and $\\theta=\\pi$.' },
    { capas: fanFijo(TAU),
      es: 'Sumando los sectores, $A\\approx\\sum\\tfrac12r(\\theta_i)^2\\,\\Delta\\theta$, que en el límite es $A=\\displaystyle\\tfrac12\\int_\\alpha^\\beta r(\\theta)^2\\,d\\theta$. Se integra $r^2$, no $r$, porque el área de un sector crece con el cuadrado del radio.',
      en: 'Adding the sectors, $A\\approx\\sum\\tfrac12r(\\theta_i)^2\\,\\Delta\\theta$, which in the limit is $A=\\displaystyle\\tfrac12\\int_\\alpha^\\beta r(\\theta)^2\\,d\\theta$. We integrate $r^2$, not $r$, because the area of a sector grows with the square of the radius.' },
    { capas: fanFijo(TAU),
      es: 'Para la cardioide: $A=\\tfrac12\\int_0^{2\\pi}(1+\\cos\\theta)^2d\\theta$. Como $(1+\\cos\\theta)^2=1+2\\cos\\theta+\\cos^2\\theta$, la integral vale $2\\pi+0+\\pi=3\\pi$ y $A=\\tfrac{3\\pi}2\\approx4{,}71$.',
      en: 'For the cardioid: $A=\\tfrac12\\int_0^{2\\pi}(1+\\cos\\theta)^2d\\theta$. Since $(1+\\cos\\theta)^2=1+2\\cos\\theta+\\cos^2\\theta$, the integral equals $2\\pi+0+\\pi=3\\pi$ and $A=\\tfrac{3\\pi}2\\approx4.71$.' },
    { sec: { es: 'Mueve el abanico', en: 'Move the fan' }, par: fanP(PI), capas: [...FANP, { tipo: 'marca', c: 'card', u: 'th' }],
      es: 'Mueve $\\theta$: los $12$ sectores se reparten entre $0$ y $\\theta$. La suma usa $r$ al principio de cada sector y se compara con el área exacta acumulada. En $\\theta=\\pi$: $2{,}62$ frente a $\\tfrac{3\\pi}4\\approx2{,}36$.',
      en: 'Move $\\theta$: the $12$ sectors are spread between $0$ and $\\theta$. The sum uses $r$ at the start of each sector and is compared with the exact accumulated area. At $\\theta=\\pi$: $2.62$ versus $\\tfrac{3\\pi}4\\approx2.36$.',
      jugar: {
        botones: [
          { label: 'θ − π/6', hacer: v => Object.assign(v, fanP(v.th - PI / 6)), off: v => v.th <= .1 },
          { label: 'θ + π/6', hacer: v => Object.assign(v, fanP(v.th + PI / 6)), off: v => v.th >= TAU },
          { label: { es: 'θ = π', en: 'θ = π' }, hacer: v => Object.assign(v, fanP(PI)) },
          { label: { es: 'θ = 2π (todo)', en: 'θ = 2π (all)' }, hacer: v => Object.assign(v, fanP(TAU)) },
        ],
        lecturas: (v, cx) => [
          { expr: 'θ', valor: cx.fmt(v.th) },
          { expr: 'Σ ½ r(θᵢ)² Δθ  (12 sectores)', valor: cx.fmt(sumaFan(v.th)) },
          { expr: 'A(θ) = ½ ∫₀^θ r² dθ', valor: cx.fmt(areaExacta(v.th)) },
        ],
        arrastrables: true, soltar: (v, par, val) => Object.assign(v, fanP(val)),
      } },
    { ver: ['rosa4'], ventana: VROSA, capas: [{ tipo: 'linea', x1: -1.1, y1: -1.1, x2: 1.1, y2: 1.1 }, { tipo: 'linea', x1: -1.1, y1: 1.1, x2: 1.1, y2: -1.1 }],
      es: '¿Cuánto vale el área de **un** pétalo de $r=\\cos2\\theta$, el de la derecha, para $-\\tfrac\\pi4\\le\\theta\\le\\tfrac\\pi4$?',
      en: 'What is the area of **one** petal of $r=\\cos2\\theta$, the right-hand one, for $-\\tfrac\\pi4\\le\\theta\\le\\tfrac\\pi4$?',
      pregunta: {
        opc: [
          { es: '$\\tfrac\\pi8$', en: '$\\tfrac\\pi8$', ok: 1 },
          { es: '$\\tfrac\\pi4$', en: '$\\tfrac\\pi4$' },
          { es: '$\\tfrac\\pi2$', en: '$\\tfrac\\pi2$' },
        ],
        why: {
          es: '$\\tfrac12\\int_{-\\pi/4}^{\\pi/4}\\cos^22\\theta\\,d\\theta=\\tfrac14\\int_{-\\pi/4}^{\\pi/4}(1+\\cos4\\theta)\\,d\\theta=\\tfrac14\\cdot\\tfrac\\pi2=\\tfrac\\pi8$. $\\tfrac\\pi4$ olvida el factor $\\tfrac12$ y $\\tfrac\\pi2$ es el área de los cuatro pétalos.',
          en: '$\\tfrac12\\int_{-\\pi/4}^{\\pi/4}\\cos^22\\theta\\,d\\theta=\\tfrac14\\int_{-\\pi/4}^{\\pi/4}(1+\\cos4\\theta)\\,d\\theta=\\tfrac14\\cdot\\tfrac\\pi2=\\tfrac\\pi8$. $\\tfrac\\pi4$ forgets the factor $\\tfrac12$ and $\\tfrac\\pi2$ is the area of all four petals.',
        },
      } },
  ],
};
