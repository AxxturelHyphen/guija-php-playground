// Guía «Aplicaciones de la integral» (Cálculo II): área entre curvas, volumen por discos y por capas cilíndricas,
// longitud de arco. Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Las capas que dependen de parámetros calculados (tira de área, longitud de arco) van con números fijos salvo en
// los pasos `jugar`; la poligonal de la longitud de arco son capas `linea` precalculadas con segs(n).
const r4 = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(4)]));
const lim = (x, a, b) => Math.min(b, Math.max(a, x));

// ── Área entre curvas: f = 4 − x², g = x + 2, cortes en −2 y 1 ──
const FA = x => 4 - x * x, GA = x => x + 2;
const estA = x => r4({ x0: x, yg: GA(x), yf: FA(x) });
const AC = x => 2 * x - x * x / 2 - x ** 3 / 3 + 10 / 3; // ∫ de −2 a x de (f − g)
const ENT = { tipo: 'entre', c: 'f', g: 'g', a: -2, b: 1 };
const SC = [
  { id: 's', nombre: '$\\operatorname{sen} x$', f: Math.sin }, { id: 'c', nombre: '$\\cos x$', f: Math.cos },
];
const PI = Math.PI;
const CRUCES = [
  { tipo: 'entre', c: 's', g: 'c', a: 0, b: PI / 4 }, { tipo: 'entre', c: 's', g: 'c', a: PI / 4, b: 5 * PI / 4 }, { tipo: 'entre', c: 's', g: 'c', a: 5 * PI / 4, b: 2 * PI },
  { tipo: 'punto', c: 's', x: PI / 4 }, { tipo: 'punto', c: 's', x: 5 * PI / 4 },
];

// ── Discos: f = √x en [0, 4] girando alrededor del eje x ──
const NMAX = 40;
const DISCOS = n => ({ tipo: 'riemann', c: 'f', a: 0, b: 4, n, m: 'izq', espejo: true });
const vDisc = n => 8 * PI * (n - 1) / n; // Σ π f(xᵢ)² Δx con borde izquierdo (exacta para f² = x)
const fr = n => { const k = +((n - 1) / n * 8).toFixed(2), V = vDisc(n).toFixed(2); return { par: { n }, es: `$n=${n}$: $${String(k).replace('.', '{,}')}\\pi\\approx${V.replace('.', '{,}')}$.`, en: `$n=${n}$: $${k}\\pi\\approx${V}$.` }; };

// ── Capas cilíndricas: misma región girando alrededor del eje y ──
const CAPAS = n => [{ tipo: 'riemann', c: 'f', a: 0, b: 4, n, m: 'medio' }, { tipo: 'riemann', c: 'f', a: -4, b: 0, n, m: 'medio' }];
const sumaCapas = n => { let s = 0; const dx = 4 / n; for (let i = 0; i < n; i++) { const x = (i + .5) * dx; s += 2 * PI * x * Math.sqrt(x) * dx; } return s; };

// ── Longitud de arco: f = (2/3) x^(3/2) en [0, 3]; L = 14/3 ──
const FL = x => 2 / 3 * Math.pow(x, 1.5);
const segs = n => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = 3 * i / n, b = 3 * (i + 1) / n;
    out.push({ tipo: 'linea', x1: +a.toFixed(4), y1: +FL(a).toFixed(4), x2: +b.toFixed(4), y2: +FL(b).toFixed(4) });
  }
  for (let i = 0; i <= n; i++) out.push({ tipo: 'punto', c: 'f', x: +(3 * i / n).toFixed(4) });
  return out;
};
const longitud = n => { let s = 0; for (let i = 0; i < n; i++) s += Math.hypot(3 / n, FL(3 * (i + 1) / n) - FL(3 * i / n)); return s; };
const frL = n => { const L = longitud(n).toFixed(3); return { capas: segs(n), es: `$${n}$ ${n === 1 ? 'segmento' : 'segmentos'}: $L\\approx${L.replace('.', '{,}')}$.`, en: `$${n}$ ${n === 1 ? 'segment' : 'segments'}: $L\\approx${L}$.` }; };

export default {
  titulo: { es: 'Aplicaciones de la integral', en: 'Applications of the integral' },
  fuentes: [
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 2*. OpenStax. https://openstax.org/books/calculus-volume-2/pages/preface',
  ],
  pasos: [
    // ── Área entre curvas ──
    { sec: { es: 'Área entre curvas', en: 'Area between curves' },
      funcion: { x: [-3.5, 3], y: [-2, 5.5], curvas: [{ id: 'f', nombre: '$4-x^2$', f: FA }, { id: 'g', nombre: '$x+2$', f: GA }],
        par: estA(1), arrastrar: 'x0', deslizadores: [{ par: 'x0', min: -2, max: 1, paso: .05, es: 'Borde derecho x', en: 'Right edge x' }],
        capas: [ENT], etiqueta: { es: 'Región entre una parábola y una recta', en: 'Region between a parabola and a line' } },
      es: 'El área entre $f$ y $g$ en $[a,b]$, con $f\\ge g$, es $\\displaystyle\\int_a^b\\bigl(f(x)-g(x)\\bigr)dx$. Para $f=4-x^2$ y $g=x+2$ los cortes salen de $4-x^2=x+2$, es decir $x^2+x-2=0$: $x=-2$ y $x=1$.',
      en: 'The area between $f$ and $g$ on $[a,b]$, with $f\\ge g$, is $\\displaystyle\\int_a^b\\bigl(f(x)-g(x)\\bigr)dx$. For $f=4-x^2$ and $g=x+2$ the crossings come from $4-x^2=x+2$, that is $x^2+x-2=0$: $x=-2$ and $x=1$.' },
    { es: 'La altura de cada tira vertical es $f-g=2-x-x^2$. Entonces $\\displaystyle A=\\int_{-2}^{1}(2-x-x^2)\\,dx=\\Bigl[2x-\\tfrac{x^2}{2}-\\tfrac{x^3}{3}\\Bigr]_{-2}^{1}=\\tfrac76+\\tfrac{10}3=\\tfrac92$.',
      en: 'The height of each vertical strip is $f-g=2-x-x^2$. Then $\\displaystyle A=\\int_{-2}^{1}(2-x-x^2)\\,dx=\\Bigl[2x-\\tfrac{x^2}{2}-\\tfrac{x^3}{3}\\Bigr]_{-2}^{1}=\\tfrac76+\\tfrac{10}3=\\tfrac92$.' },
    { sec: { es: 'Mueve el borde', en: 'Move the edge' }, par: estA(-.5),
      capas: [{ tipo: 'entre', c: 'f', g: 'g', a: -2, b: 'x0' }, { tipo: 'linea', x1: 'x0', y1: 'yg', x2: 'x0', y2: 'yf' }, { tipo: 'punto', c: 'f', x: 'x0' }, { tipo: 'punto', c: 'g', x: 'x0' }],
      es: 'Arrastra el borde derecho (o usa el deslizador). La tira discontinua mide $f-g$ y el área acumulada es la integral de esa altura desde $x=-2$. En $x=1$ llega a $\\tfrac92=4{,}5$.',
      en: 'Drag the right edge (or use the slider). The dashed strip measures $f-g$ and the accumulated area is the integral of that height from $x=-2$. At $x=1$ it reaches $\\tfrac92=4.5$.',
      jugar: {
        botones: [
          { label: 'x − 0,25', hacer: v => Object.assign(v, estA(Math.max(-2, v.x0 - .25))), off: v => v.x0 <= -2 },
          { label: 'x + 0,25', hacer: v => Object.assign(v, estA(Math.min(1, v.x0 + .25))), off: v => v.x0 >= 1 },
          { label: { es: 'ir a x = 1 (total)', en: 'go to x = 1 (total)' }, hacer: v => Object.assign(v, estA(1)) },
        ],
        lecturas: (v, cx) => [
          { expr: 'x', valor: cx.fmt(v.x0) },
          { expr: 'f(x) − g(x) = 2 − x − x²', valor: cx.fmt(FA(v.x0) - GA(v.x0)) },
          { expr: '∫ de −2 a x de (f − g)', valor: cx.fmt(AC(v.x0)) },
        ],
        arrastrables: true, soltar: (v, par, val) => Object.assign(v, estA(lim(val, -2, 1))),
      } },
    { funcion: { x: [0, 6.6], y: [-1.7, 1.7], curvas: SC, capas: CRUCES, etiqueta: { es: 'Gráficas de seno y coseno con tres regiones', en: 'Graphs of sine and cosine with three regions' } },
      es: 'Si las curvas se cruzan, «la de arriba» cambia. Entre $\\operatorname{sen}x$ y $\\cos x$ en $[0,2\\pi]$ hay dos cruces, $\\tfrac\\pi4$ y $\\tfrac{5\\pi}4$, así que se integra por tramos: $\\sqrt2-1\\approx0{,}41$, $2\\sqrt2\\approx2{,}83$ y $1+\\sqrt2\\approx2{,}41$. Total: $4\\sqrt2\\approx5{,}66$.',
      en: 'When the curves cross, "the upper one" changes. Between $\\sin x$ and $\\cos x$ on $[0,2\\pi]$ there are two crossings, $\\tfrac\\pi4$ and $\\tfrac{5\\pi}4$, so we integrate piece by piece: $\\sqrt2-1\\approx0.41$, $2\\sqrt2\\approx2.83$ and $1+\\sqrt2\\approx2.41$. Total: $4\\sqrt2\\approx5.66$.' },
    { es: 'Al calcular $\\int_0^{2\\pi}(\\operatorname{sen}x-\\cos x)\\,dx$ sale $0$. ¿Es esa el área entre las curvas?',
      en: 'Computing $\\int_0^{2\\pi}(\\sin x-\\cos x)\\,dx$ gives $0$. Is that the area between the curves?',
      pregunta: {
        opc: [
          { es: 'Sí: la integral siempre mide área', en: 'Yes: an integral always measures area' },
          { es: 'No: donde $\\operatorname{sen}x<\\cos x$ la integral resta; hay que partir en los cruces', en: 'No: where $\\sin x<\\cos x$ the integral subtracts; we must split at the crossings', ok: 1 },
          { es: 'No: faltan los límites de integración', en: 'No: the limits of integration are missing' },
        ],
        why: {
          es: 'La integral es *con signo*: los tramos donde la resta es negativa compensan a los positivos. El área es $\\int_0^{2\\pi}|\\operatorname{sen}x-\\cos x|\\,dx=4\\sqrt2$, que se calcula tramo a tramo.',
          en: 'The integral is *signed*: stretches where the difference is negative cancel the positive ones. The area is $\\int_0^{2\\pi}|\\sin x-\\cos x|\\,dx=4\\sqrt2$, computed piece by piece.',
        },
      } },

    // ── Discos ──
    { sec: { es: 'Volumen por discos', en: 'Volume by disks' },
      funcion: { x: [-.4, 4.8], y: [-2.5, 2.5], igual: true, curvas: [{ id: 'f', nombre: '$\\sqrt{x}$', f: Math.sqrt }],
        par: { n: 4 }, deslizadores: [{ par: 'n', min: 1, max: NMAX, paso: 1, dec: 0, es: 'Discos n', en: 'Disks n' }],
        capas: [{ tipo: 'riemann', c: 'f', a: 0, b: 4, n: 1, m: 'exacta', espejo: true }], etiqueta: { es: 'Región bajo √x y su reflejo respecto del eje x', en: 'Region under √x and its reflection about the x-axis' } },
      es: 'Al girar la región bajo $y=\\sqrt x$, $0\\le x\\le4$, alrededor del eje $x$ se genera un sólido. Un corte perpendicular al eje es un **disco** de radio $f(x)$ y área $\\pi f(x)^2$. La figura muestra la región y su reflejo: el sólido visto de perfil.',
      en: 'Revolving the region under $y=\\sqrt x$, $0\\le x\\le4$, about the $x$-axis produces a solid. A cross-section perpendicular to the axis is a **disk** of radius $f(x)$ and area $\\pi f(x)^2$. The figure shows the region and its reflection: the solid seen from the side.' },
    { capas: [DISCOS('n')], par: { n: 4 },
      traza: [fr(2), fr(4), fr(8), fr(16), fr(40)],
      es: 'Rebanamos el sólido en $n$ discos de grosor $\\Delta x$: $V\\approx\\sum\\pi f(x_i)^2\\,\\Delta x$, con $x_i$ el borde izquierdo de cada tramo. Reproduce la traza: con más rebanadas la suma se acerca al volumen real. El primer disco tiene radio $0$.',
      en: 'We slice the solid into $n$ disks of thickness $\\Delta x$: $V\\approx\\sum\\pi f(x_i)^2\\,\\Delta x$, with $x_i$ the left edge of each piece. Play the trace: with more slices the sum approaches the true volume. The first disk has radius $0$.' },
    { capas: [{ tipo: 'riemann', c: 'f', a: 0, b: 4, n: 1, m: 'exacta', espejo: true }],
      es: 'En el límite la suma es una integral: $V=\\displaystyle\\pi\\int_a^b f(x)^2\\,dx$. Con $f=\\sqrt x$: $V=\\pi\\int_0^4x\\,dx=\\pi\\cdot\\tfrac{4^2}2=8\\pi\\approx25{,}13$. Para $n$ discos con borde izquierdo la suma vale $8\\pi\\,\\tfrac{n-1}n$: el error relativo es $\\tfrac1n$.',
      en: 'In the limit the sum is an integral: $V=\\displaystyle\\pi\\int_a^b f(x)^2\\,dx$. With $f=\\sqrt x$: $V=\\pi\\int_0^4x\\,dx=\\pi\\cdot\\tfrac{4^2}2=8\\pi\\approx25.13$. For $n$ disks with the left edge the sum is $8\\pi\\,\\tfrac{n-1}n$: the relative error is $\\tfrac1n$.' },
    { sec: { es: 'Cambia n', en: 'Change n' }, capas: [DISCOS('n')], par: { n: 6 },
      es: 'Mueve $n$ con el deslizador o los botones y compara la suma de discos con el volumen exacto $8\\pi$. El error baja como $\\tfrac1n$: duplicar $n$ lo reduce a la mitad.',
      en: 'Move $n$ with the slider or the buttons and compare the disk sum with the exact volume $8\\pi$. The error falls like $\\tfrac1n$: doubling $n$ halves it.',
      jugar: {
        botones: [
          { label: 'n − 1', hacer: v => { v.n = Math.max(1, v.n - 1); }, off: v => v.n <= 1 },
          { label: 'n + 1', hacer: v => { v.n = Math.min(NMAX, v.n + 1); }, off: v => v.n >= NMAX },
          { label: 'n × 2', hacer: v => { v.n = Math.min(NMAX, v.n * 2); }, off: v => v.n >= NMAX },
          { label: 'n = 40', hacer: v => { v.n = NMAX; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'n', valor: cx.fmt(v.n) },
          { expr: 'Σ π f(xᵢ)² Δx', valor: cx.fmt(vDisc(v.n)) },
          { expr: 'V = π∫ f² dx = 8π', valor: cx.fmt(8 * PI) },
          { expr: '1/n', valor: cx.fmt(100 / v.n) + ' %' },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = lim(Math.round(val), 1, NMAX); },
      } },
    { funcion: { x: [-.2, 1.3], y: [-1.15, 1.15], igual: true,
        curvas: [{ id: 'a', nombre: '$x$', f: x => x }, { id: 'b', nombre: '$x^2$', f: x => x * x }, { id: 'na', nombre: '$-x$', f: x => -x }, { id: 'nb', nombre: '$-x^2$', f: x => -x * x }],
        capas: [{ tipo: 'entre', c: 'a', g: 'b', a: 0, b: 1 }, { tipo: 'entre', c: 'na', g: 'nb', a: 0, b: 1 }], etiqueta: { es: 'Región entre y = x e y = x² y su reflejo', en: 'Region between y = x and y = x² and its reflection' } },
      ver: ['a', 'b'],
      es: 'Si la región está entre dos curvas, cada corte es una **arandela**: radio exterior $R$, interior $r$, área $\\pi(R^2-r^2)$. Entre $y=x$ e $y=x^2$, con $0\\le x\\le1$: $V=\\pi\\int_0^1(x^2-x^4)\\,dx=\\pi\\bigl(\\tfrac13-\\tfrac15\\bigr)=\\tfrac{2\\pi}{15}\\approx0{,}42$.',
      en: 'If the region lies between two curves, each cross-section is a **washer**: outer radius $R$, inner $r$, area $\\pi(R^2-r^2)$. Between $y=x$ and $y=x^2$, with $0\\le x\\le1$: $V=\\pi\\int_0^1(x^2-x^4)\\,dx=\\pi\\bigl(\\tfrac13-\\tfrac15\\bigr)=\\tfrac{2\\pi}{15}\\approx0.42$.' },
    { es: '¿Qué integral da el volumen al girar la región bajo $y=\\sqrt x$, $0\\le x\\le4$, alrededor del eje $x$?',
      en: 'Which integral gives the volume when the region under $y=\\sqrt x$, $0\\le x\\le4$, is revolved about the $x$-axis?',
      pregunta: {
        opc: [
          { es: '$\\pi\\int_0^4\\sqrt x\\,dx$', en: '$\\pi\\int_0^4\\sqrt x\\,dx$' },
          { es: '$\\pi\\int_0^4 x\\,dx$', en: '$\\pi\\int_0^4 x\\,dx$', ok: 1 },
          { es: '$2\\pi\\int_0^4 x\\sqrt x\\,dx$', en: '$2\\pi\\int_0^4 x\\sqrt x\\,dx$' },
        ],
        why: {
          es: 'El área del disco es $\\pi r^2$ con $r=f(x)=\\sqrt x$, así que se integra $\\pi\\bigl(\\sqrt x\\bigr)^2=\\pi x$. La primera olvida elevar al cuadrado; la tercera es la fórmula de capas, para girar alrededor del eje $y$.',
          en: 'The disk area is $\\pi r^2$ with $r=f(x)=\\sqrt x$, so we integrate $\\pi\\bigl(\\sqrt x\\bigr)^2=\\pi x$. The first forgets the square; the third is the shell formula, for revolving about the $y$-axis.',
        },
      } },

    // ── Capas cilíndricas ──
    { sec: { es: 'Capas cilíndricas', en: 'Cylindrical shells' },
      funcion: { x: [-5, 5], y: [-.5, 2.6], curvas: [{ id: 'f', nombre: '$\\sqrt{|x|}$', f: x => Math.sqrt(Math.abs(x)) }],
        par: { n: 4 }, deslizadores: [{ par: 'n', min: 1, max: 30, paso: 1, dec: 0, es: 'Capas n', en: 'Shells n' }],
        capas: [{ tipo: 'riemann', c: 'f', a: 0, b: 4, n: 1, m: 'exacta' }, { tipo: 'riemann', c: 'f', a: -4, b: 0, n: 1, m: 'exacta' }],
        etiqueta: { es: 'Región bajo √x y su reflejo respecto del eje y', en: 'Region under √x and its reflection about the y-axis' } },
      es: 'Giramos ahora la misma región, bajo $y=\\sqrt x$, alrededor del eje $y$. Una tira vertical de ancho $\\Delta x$, a distancia $x$ del eje, genera una **capa cilíndrica** de radio $x$ y altura $f(x)$. La figura muestra la región y su reflejo respecto del eje $y$.',
      en: 'Now we revolve the same region, under $y=\\sqrt x$, about the $y$-axis. A vertical strip of width $\\Delta x$, at distance $x$ from the axis, generates a **cylindrical shell** of radius $x$ and height $f(x)$. The figure shows the region and its reflection across the $y$-axis.' },
    { capas: CAPAS(4),
      es: 'Si cortamos la capa y la desenrollamos es casi un rectángulo de largo $2\\pi x$, alto $f(x)$ y grosor $\\Delta x$: volumen $2\\pi x\\,f(x)\\,\\Delta x$. Sumando, $V=\\displaystyle2\\pi\\int_a^b x\\,f(x)\\,dx$. Aquí: $2\\pi\\int_0^4x^{3/2}dx=2\\pi\\cdot\\tfrac25\\cdot32=\\tfrac{128\\pi}5\\approx80{,}42$.',
      en: 'If we cut the shell and unroll it, it is almost a rectangle of length $2\\pi x$, height $f(x)$ and thickness $\\Delta x$: volume $2\\pi x\\,f(x)\\,\\Delta x$. Summing, $V=\\displaystyle2\\pi\\int_a^b x\\,f(x)\\,dx$. Here: $2\\pi\\int_0^4x^{3/2}dx=2\\pi\\cdot\\tfrac25\\cdot32=\\tfrac{128\\pi}5\\approx80.42$.' },
    { sec: { es: 'Cambia n', en: 'Change n' }, capas: CAPAS('n'), par: { n: 4 },
      es: 'Más capas, mejor aproximación. La suma usa el punto medio de cada tira, $x_i$: $\\sum2\\pi x_i f(x_i)\\Delta x$. Con $n=4$ da $79{,}7$ y con $n=20$, $80{,}4$, frente al valor exacto $\\tfrac{128\\pi}5\\approx80{,}42$.',
      en: 'More shells, better approximation. The sum uses the midpoint of each strip, $x_i$: $\\sum2\\pi x_i f(x_i)\\Delta x$. With $n=4$ it gives $79.7$ and with $n=20$, $80.4$, against the exact value $\\tfrac{128\\pi}5\\approx80.42$.',
      jugar: {
        botones: [
          { label: 'n − 1', hacer: v => { v.n = Math.max(1, v.n - 1); }, off: v => v.n <= 1 },
          { label: 'n + 1', hacer: v => { v.n = Math.min(30, v.n + 1); }, off: v => v.n >= 30 },
          { label: 'n × 2', hacer: v => { v.n = Math.min(30, v.n * 2); }, off: v => v.n >= 30 },
        ],
        lecturas: (v, cx) => [
          { expr: 'n', valor: cx.fmt(v.n) },
          { expr: 'Σ 2π xᵢ f(xᵢ) Δx', valor: cx.fmt(sumaCapas(v.n)) },
          { expr: 'V = 2π∫ x f dx = 128π/5', valor: cx.fmt(128 * PI / 5) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = lim(Math.round(val), 1, 30); },
      } },
    { es: 'Se gira la región bajo $y=x^2$, $0\\le x\\le2$, alrededor del eje $y$. ¿Cuánto vale el volumen?',
      en: 'The region under $y=x^2$, $0\\le x\\le2$, is revolved about the $y$-axis. What is the volume?',
      pregunta: {
        opc: [
          { es: '$\\tfrac{32\\pi}{5}$', en: '$\\tfrac{32\\pi}{5}$' },
          { es: '$8\\pi$', en: '$8\\pi$', ok: 1 },
          { es: '$\\tfrac{8\\pi}{3}$', en: '$\\tfrac{8\\pi}{3}$' },
        ],
        why: {
          es: 'Con capas: $2\\pi\\int_0^2x\\cdot x^2\\,dx=2\\pi\\cdot\\tfrac{2^4}4=8\\pi$. $\\tfrac{32\\pi}5=\\pi\\int_0^2x^4dx$ es el volumen al girar alrededor del eje $x$, y $\\tfrac{8\\pi}3$ sale de aplicar discos con $r=x$, que no es el radio aquí.',
          en: 'With shells: $2\\pi\\int_0^2x\\cdot x^2\\,dx=2\\pi\\cdot\\tfrac{2^4}4=8\\pi$. $\\tfrac{32\\pi}5=\\pi\\int_0^2x^4dx$ is the volume when revolving about the $x$-axis, and $\\tfrac{8\\pi}3$ comes from using disks with $r=x$, which is not the radius here.',
        },
      } },

    // ── Longitud de arco ──
    { sec: { es: 'Longitud de arco', en: 'Arc length' },
      funcion: { x: [-.5, 3.6], y: [-.6, 4.2], igual: true, curvas: [{ id: 'f', nombre: '$f(x)$', f: FL }], capas: segs(1),
        etiqueta: { es: 'Curva f(x) = (2/3)x^(3/2) con una poligonal inscrita', en: 'Curve f(x) = (2/3)x^(3/2) with an inscribed polygonal path' } },
      es: 'Para medir una curva la aproximamos por segmentos. Cada tramo entre $x_i$ y $x_{i+1}$ mide $\\sqrt{\\Delta x^2+\\Delta y^2}$ (Pitágoras). Tomamos $f(x)=\\tfrac23x^{3/2}$ en $[0,3]$ y sumamos las longitudes. Con un solo segmento ya hay una cota inferior: $\\sqrt{21}$.',
      en: 'To measure a curve we approximate it by segments. Each stretch between $x_i$ and $x_{i+1}$ has length $\\sqrt{\\Delta x^2+\\Delta y^2}$ (Pythagoras). We take $f(x)=\\tfrac23x^{3/2}$ on $[0,3]$ and add the lengths. A single segment already gives a lower bound: $\\sqrt{21}$.' },
    { capas: segs(1),
      traza: [frL(1), frL(2), frL(4), frL(8), frL(16)],
      es: 'Reproduce la traza: cada vez que se duplican los segmentos la poligonal se pega más a la curva y la longitud sube hacia un valor límite. Una recta es el camino más corto entre dos puntos, así que la poligonal siempre se queda corta.',
      en: 'Play the trace: each time the number of segments doubles the polygonal path hugs the curve more and the length rises towards a limit. A straight line is the shortest path between two points, so the polygonal path always falls short.' },
    { es: 'Sacando $\\Delta x$ de la raíz, cada segmento mide $\\sqrt{1+\\bigl(\\tfrac{\\Delta y}{\\Delta x}\\bigr)^2}\\,\\Delta x$, y $\\tfrac{\\Delta y}{\\Delta x}\\to f\'(x)$. En el límite: $L=\\displaystyle\\int_a^b\\sqrt{1+\\bigl(f\'(x)\\bigr)^2}\\,dx$.',
      en: 'Taking $\\Delta x$ out of the root, each segment has length $\\sqrt{1+\\bigl(\\tfrac{\\Delta y}{\\Delta x}\\bigr)^2}\\,\\Delta x$, and $\\tfrac{\\Delta y}{\\Delta x}\\to f\'(x)$. In the limit: $L=\\displaystyle\\int_a^b\\sqrt{1+\\bigl(f\'(x)\\bigr)^2}\\,dx$.' },
    { capas: segs(16),
      es: 'Aquí $f\'(x)=\\sqrt x$, así que $1+f\'^2=1+x$ y $L=\\displaystyle\\int_0^3\\sqrt{1+x}\\,dx=\\tfrac23\\Bigl[(1+x)^{3/2}\\Bigr]_0^3=\\tfrac23(8-1)=\\tfrac{14}3\\approx4{,}667$. Con $16$ segmentos ya se llega a $4{,}665$.',
      en: 'Here $f\'(x)=\\sqrt x$, so $1+f\'^2=1+x$ and $L=\\displaystyle\\int_0^3\\sqrt{1+x}\\,dx=\\tfrac23\\Bigl[(1+x)^{3/2}\\Bigr]_0^3=\\tfrac23(8-1)=\\tfrac{14}3\\approx4.667$. With $16$ segments we already reach $4.665$.' },
    { es: '¿Qué integral da la longitud de la parábola $y=x^2$ entre $x=0$ y $x=1$?',
      en: 'Which integral gives the length of the parabola $y=x^2$ between $x=0$ and $x=1$?',
      pregunta: {
        opc: [
          { es: '$\\int_0^1\\sqrt{1+x^4}\\,dx$', en: '$\\int_0^1\\sqrt{1+x^4}\\,dx$' },
          { es: '$\\int_0^1\\sqrt{1+4x^2}\\,dx$', en: '$\\int_0^1\\sqrt{1+4x^2}\\,dx$', ok: 1 },
          { es: '$\\int_0^1(1+2x)\\,dx$', en: '$\\int_0^1(1+2x)\\,dx$' },
        ],
        why: {
          es: 'Con $f=x^2$ se tiene $f\'=2x$, así que $1+(f\')^2=1+4x^2$. La primera usa $f$ en lugar de $f\'$; la tercera quita la raíz, y la raíz es lo que hace que el resultado sea una longitud y no una suma de alturas.',
          en: 'With $f=x^2$ we have $f\'=2x$, so $1+(f\')^2=1+4x^2$. The first uses $f$ instead of $f\'$; the third drops the root, and the root is what makes the result a length rather than a sum of heights.',
        },
      } },
  ],
};
