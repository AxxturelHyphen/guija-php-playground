// Guía «La integral» (Cálculo I). Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Sumas de Riemann, integral definida como área con signo, teorema fundamental del cálculo y sustitución.
const cuad = x => x * x;
const z = v => (Math.abs(v) < 1e-9 ? 0 : v); // evita lecturas del tipo 1e-16
const PI = Math.PI;

const V1 = { x: [-.3, 2.5], y: [-.5, 4.5] };
const RIE = m => [{ tipo: 'riemann', c: 'f', a: 0, b: 2, n: 'n', m }];
const DESL_N = { par: 'n', min: 1, max: 60, paso: 1, dec: 0, es: 'Subintervalos n', en: 'Subintervals n' };

// Escena del coseno (secciones de área con signo y TFC): f = cos, F = sen es su función área desde 0
const VC = { x: [-.5, 6.8], y: [-1.6, 1.6] };
const AREA_B = { tipo: 'riemann', c: 'f', a: 0, b: 'b', n: 1, m: 'exacta' };
const BOT_B = [
  { label: 'b − 0,5', hacer: v => { v.b = Math.max(.05, +(v.b - .5).toFixed(2)); }, off: v => v.b <= .05 },
  { label: 'b + 0,5', hacer: v => { v.b = Math.min(6.3, +(v.b + .5).toFixed(2)); }, off: v => v.b >= 6.3 },
];

// Escena de la sustitución: f(x) = 2x·e^(x²) y g(u) = e^u
const VS = { x: [-.3, 1.4], y: [-.5, 6.5] };

export default {
  titulo: { es: 'La integral', en: 'The integral' },
  fuentes: [
    'Boelkins, M., Austin, D., & Schlicker, S. (2017). *Active calculus 2.0*. Grand Valley State University. https://open.umn.edu/opentextbooks/textbooks/active-calculus-2-0',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 1*. OpenStax. https://openstax.org/books/calculus-volume-1/pages/preface',
  ],
  pasos: [
    // ── Sumas de Riemann ──
    { sec: { es: 'Sumas de Riemann', en: 'Riemann sums' },
      funcion: { ...V1, curvas: [{ id: 'f', nombre: 'x²', f: cuad }], par: { n: 4 }, capas: RIE('izq'), deslizadores: [DESL_N],
        etiqueta: { es: 'Rectángulos bajo x² en [0, 2], extremo izquierdo', en: 'Rectangles under x² on [0, 2], left endpoint' } },
      es: 'Queremos el área bajo $f(x)=x^2$ entre $0$ y $2$. Idea: cubrirla con $n$ rectángulos de ancho $\\Delta x=\\dfrac{b-a}{n}$ y sumar sus áreas. Con $n=4$, $\\Delta x=0{,}5$ y alturas en el **extremo izquierdo**: $L_4=0{,}5\\,(0+0{,}25+1+2{,}25)=1{,}75$.',
      en: 'We want the area under $f(x)=x^2$ between $0$ and $2$. Idea: cover it with $n$ rectangles of width $\\Delta x=\\dfrac{b-a}{n}$ and add their areas. With $n=4$, $\\Delta x=0.5$ and heights at the **left endpoint**: $L_4=0.5\\,(0+0.25+1+2.25)=1.75$.' },
    { traza: [
        { par: { n: 1 }, es: '$n=1$: $L_1=0$. Un rectángulo de altura $f(0)=0$ no cubre nada.', en: '$n=1$: $L_1=0$. A rectangle of height $f(0)=0$ covers nothing.' },
        { par: { n: 2 }, es: '$n=2$: $L_2=1$.', en: '$n=2$: $L_2=1$.' },
        { par: { n: 4 }, es: '$n=4$: $L_4=1{,}75$.', en: '$n=4$: $L_4=1.75$.' },
        { par: { n: 8 }, es: '$n=8$: $L_8=2{,}1875$.', en: '$n=8$: $L_8=2.1875$.' },
        { par: { n: 16 }, es: '$n=16$: $L_{16}\\approx2{,}422$.', en: '$n=16$: $L_{16}\\approx2.422$.' },
        { par: { n: 32 }, es: '$n=32$: $L_{32}\\approx2{,}543$. Los escalones casi desaparecen.', en: '$n=32$: $L_{32}\\approx2.543$. The steps almost vanish.' },
      ],
      es: 'Reproduce la traza: al aumentar $n$ los rectángulos se estrechan y la suma izquierda sube hacia el área verdadera. Cada duplicación acerca el valor, pero despacio: el error solo se reduce a la mitad.',
      en: 'Play the trace: as $n$ grows the rectangles narrow and the left sum climbs toward the true area. Each doubling gets closer, but slowly: the error only halves.' },
    { par: { n: 32 },
      es: 'El área es el **límite** de estas sumas: $\\displaystyle\\int_a^b f(x)\\,dx=\\lim_{n\\to\\infty}\\sum_{i=1}^{n}f(x_i^*)\\,\\Delta x$. Para $x^2$ en $[0,2]$ vale $\\tfrac83\\approx2{,}667$; con $n=32$ ya estamos en $2{,}543$. Da igual qué punto $x_i^*$ elijas en cada tramo.',
      en: 'The area is the **limit** of these sums: $\\displaystyle\\int_a^b f(x)\\,dx=\\lim_{n\\to\\infty}\\sum_{i=1}^{n}f(x_i^*)\\,\\Delta x$. For $x^2$ on $[0,2]$ it is $\\tfrac83\\approx2.667$; with $n=32$ we are already at $2.543$. It does not matter which point $x_i^*$ you pick in each piece.' },
    { par: { n: 4 },
      traza: [
        { capas: RIE('der'), es: 'Extremo **derecho**: $R_4=0{,}5\\,(0{,}25+1+2{,}25+4)=3{,}75$.', en: '**Right** endpoint: $R_4=0.5\\,(0.25+1+2.25+4)=3.75$.' },
        { capas: RIE('medio'), es: '**Punto medio**: $M_4=0{,}5\\,(0{,}0625+0{,}5625+1{,}5625+3{,}0625)=2{,}625$.', en: '**Midpoint**: $M_4=0.5\\,(0.0625+0.5625+1.5625+3.0625)=2.625$.' },
        { capas: RIE('trap'), es: '**Trapecio**: $T_4=\\tfrac{L_4+R_4}{2}=\\tfrac{1{,}75+3{,}75}{2}=2{,}75$.', en: '**Trapezoid**: $T_4=\\tfrac{L_4+R_4}{2}=\\tfrac{1.75+3.75}{2}=2.75$.' },
      ],
      es: 'Mismo $n=4$, otras alturas. Reproduce la traza: derecha, punto medio y trapecio. Como $f$ es creciente, la izquierda ($1{,}75$) **subestima** y la derecha **sobrestima**; la real, $2{,}667$, queda entre ambas.',
      en: 'Same $n=4$, different heights. Play the trace: right, midpoint and trapezoid. Since $f$ is increasing, the left sum ($1.75$) **underestimates** and the right one **overestimates**; the true value, $2.667$, lies between them.' },
    { capas: RIE('medio'),
      es: 'Errores respecto de $\\tfrac83\\approx2{,}6667$ con $n=4$: $L_4$ $-0{,}917$, $R_4$ $+1{,}083$, $M_4$ $-0{,}042$, $T_4$ $+0{,}083$. Punto medio y trapecio aciertan mucho más con los mismos $4$ intervalos y fallan en sentidos opuestos, porque la parábola es convexa.',
      en: 'Errors against $\\tfrac83\\approx2.6667$ with $n=4$: $L_4$ $-0.917$, $R_4$ $+1.083$, $M_4$ $-0.042$, $T_4$ $+0.083$. Midpoint and trapezoid are far more accurate with the same $4$ intervals and miss in opposite directions, because the parabola is convex.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, par: { n: 4 }, capas: RIE('medio'),
      es: 'Cambia $n$ (deslizador o botones) y compara las cuatro sumas con la integral exacta. Duplica $n$ varias veces: ¿cuáles reducen su error a la mitad y cuáles a la cuarta parte?',
      en: 'Change $n$ (slider or buttons) and compare the four sums with the exact integral. Double $n$ several times: which ones halve their error and which ones cut it to a quarter?',
      jugar: {
        botones: [
          { label: 'n × 2', hacer: v => { v.n = Math.min(60, Math.round(v.n) * 2); }, off: v => v.n >= 60 },
          { label: 'n ÷ 2', hacer: v => { v.n = Math.max(1, Math.round(v.n / 2)); }, off: v => v.n <= 1 },
          { label: 'n = 4', hacer: v => { v.n = 4; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'n', valor: cx.fmt(Math.round(v.n)) },
          { expr: 'Lₙ', valor: cx.fmt(cx.riemann('f', 0, 2, v.n, 'izq')) },
          { expr: 'Rₙ', valor: cx.fmt(cx.riemann('f', 0, 2, v.n, 'der')) },
          { expr: 'Mₙ', valor: cx.fmt(cx.riemann('f', 0, 2, v.n, 'medio')) },
          { expr: 'Tₙ', valor: cx.fmt(cx.riemann('f', 0, 2, v.n, 'trap')) },
          { expr: '∫₀² x² dx', valor: cx.fmt(cx.integral('f', 0, 2)) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { capas: RIE('trap'), es: 'Al duplicar $n$, ¿por cuánto se divide aproximadamente el error de la regla del trapecio en $x^2$?',
      en: 'When $n$ is doubled, by roughly what factor does the trapezoid-rule error on $x^2$ shrink?',
      pregunta: {
        opc: [
          { es: 'Por $2$', en: 'By $2$' },
          { es: 'Por $4$', en: 'By $4$', ok: 1 },
          { es: 'Por $8$', en: 'By $8$' },
        ],
        why: {
          es: 'El error del trapecio y del punto medio es proporcional a $1/n^2$. Comprobación: $T_4=2{,}75$ (error $\\tfrac1{12}$) y $T_8=2{,}6875$ (error $\\tfrac1{48}$): el cociente es $4$. En $L_n$ y $R_n$ el error va como $1/n$.',
          en: 'The trapezoid and midpoint errors are proportional to $1/n^2$. Check: $T_4=2.75$ (error $\\tfrac1{12}$) and $T_8=2.6875$ (error $\\tfrac1{48}$): the ratio is $4$. For $L_n$ and $R_n$ the error goes like $1/n$.',
        },
      } },
    { es: 'Si $f$ es **decreciente** en $[a,b]$, ¿qué hace la suma izquierda $L_n$ respecto del área real?',
      en: 'If $f$ is **decreasing** on $[a,b]$, what does the left sum $L_n$ do relative to the true area?',
      pregunta: {
        opc: [
          { es: 'La subestima', en: 'It underestimates it' },
          { es: 'La sobrestima', en: 'It overestimates it', ok: 1 },
          { es: 'Es exacta para cualquier $n$', en: 'It is exact for any $n$' },
        ],
        why: {
          es: 'En una función decreciente, el máximo de cada subintervalo está en su extremo izquierdo: cada rectángulo sobresale por encima de la curva. Con $f$ creciente, como $x^2$, ocurre lo contrario.',
          en: 'For a decreasing function, the maximum on each subinterval is at its left endpoint: each rectangle sticks out above the curve. With $f$ increasing, like $x^2$, the opposite happens.',
        },
      } },

    // ── Área con signo ──
    { sec: { es: 'Integral definida: área con signo', en: 'Definite integral: signed area' },
      funcion: { ...VC, curvas: [{ id: 'f', nombre: 'cos x', f: Math.cos }, { id: 'abs', nombre: '|cos x|', f: x => Math.abs(Math.cos(x)) }, { id: 'F', nombre: { es: 'F(x) = sen x', en: 'F(x) = sin x' }, f: Math.sin }],
        ver: ['f'], par: { b: PI / 2 }, arrastrar: 'b', capas: [AREA_B],
        deslizadores: [{ par: 'b', min: .05, max: 6.3, paso: .01, es: 'Límite superior b', en: 'Upper limit b' }],
        etiqueta: { es: 'Área bajo cos x entre 0 y b', en: 'Area under cos x between 0 and b' } },
      es: '$\\int_a^b f(x)\\,dx$ cuenta el área **con signo**: suma lo que queda sobre el eje y **resta** lo que queda debajo. Aquí $f=\\cos x$: con $b=\\tfrac\\pi2$, $\\displaystyle\\int_0^{\\pi/2}\\cos x\\,dx=1$. Al pasar $\\tfrac\\pi2$ la curva baja del eje y empieza a restar. Mueve $b$.',
      en: '$\\int_a^b f(x)\\,dx$ counts **signed** area: it adds what lies above the axis and **subtracts** what lies below. Here $f=\\cos x$: with $b=\\tfrac\\pi2$, $\\displaystyle\\int_0^{\\pi/2}\\cos x\\,dx=1$. Past $\\tfrac\\pi2$ the curve drops below the axis and starts subtracting. Move $b$.' },
    { par: { b: PI / 2 },
      es: 'Prueba los cuatro valores clave de $b$. Compara la integral con signo y el área total (la de $|\\cos x|$). ¿Cuándo son distintas? ¿Cuándo la integral es negativa?',
      en: 'Try the four key values of $b$. Compare the signed integral and the total area (that of $|\\cos x|$). When do they differ? When is the integral negative?',
      jugar: {
        botones: [
          { label: 'b = π/2', hacer: v => { v.b = PI / 2; } },
          { label: 'b = π', hacer: v => { v.b = PI; } },
          { label: 'b = 3π/2', hacer: v => { v.b = 3 * PI / 2; } },
          { label: 'b = 2π', hacer: v => { v.b = 2 * PI; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'b', valor: cx.fmt(v.b) },
          { expr: '∫₀ᵇ cos x dx', valor: cx.fmt(z(cx.integral('f', 0, v.b))), malo: cx.integral('f', 0, v.b) < -1e-9 },
          { expr: '∫₀ᵇ |cos x| dx', valor: cx.fmt(z(cx.integral('abs', 0, v.b))) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { par: { b: PI },
      es: 'Con $b=\\pi$, el área sobre el eje ($1$) y la que queda bajo él ($1$) se cancelan: $\\int_0^\\pi\\cos x\\,dx=0$, aunque el **área geométrica** es $2$. Para el área hay que integrar $|f|$, partiendo en los cruces con el eje. Además, $\\int_a^b=-\\int_b^a$ y $\\int_a^c=\\int_a^b+\\int_b^c$.',
      en: 'With $b=\\pi$, the area above the axis ($1$) and the area below it ($1$) cancel: $\\int_0^\\pi\\cos x\\,dx=0$, although the **geometric area** is $2$. For area you must integrate $|f|$, splitting at the axis crossings. Also, $\\int_a^b=-\\int_b^a$ and $\\int_a^c=\\int_a^b+\\int_b^c$.' },
    { es: '¿Cuál es el área geométrica encerrada entre $y=\\cos x$ y el eje $x$ en $[0,\\,2\\pi]$?',
      en: 'What is the geometric area enclosed between $y=\\cos x$ and the $x$-axis on $[0,\\,2\\pi]$?',
      pregunta: {
        opc: [
          { es: '$0$', en: '$0$' },
          { es: '$4$', en: '$4$', ok: 1 },
          { es: '$2$', en: '$2$' },
        ],
        why: {
          es: 'La integral con signo vale $\\operatorname{sen}2\\pi-\\operatorname{sen}0=0$, pero eso es la *cancelación*. El área son cuatro tramos de un cuarto de periodo, cada uno de área $1$: $\\int_0^{2\\pi}|\\cos x|\\,dx=4$.',
          en: 'The signed integral is $\\sin2\\pi-\\sin0=0$, but that is the *cancellation*. The area is four quarter-period stretches, each of area $1$: $\\int_0^{2\\pi}|\\cos x|\\,dx=4$.',
        },
      } },

    // ── Teorema fundamental ──
    { sec: { es: 'Teorema fundamental del cálculo', en: 'Fundamental theorem of calculus' }, ver: ['f', 'F'], par: { b: 1 },
      capas: [AREA_B, { tipo: 'punto', c: 'F', x: 'b' }],
      es: 'Define la **función área** $F(x)=\\displaystyle\\int_0^x f(t)\\,dt$: el área con signo acumulada hasta $x$. Aquí $f=\\cos$ y la segunda curva es $F$. Mueve $b$: la altura del punto sobre $F$ es el área sombreada ($\\operatorname{sen}1\\approx0{,}84$ para $b=1$).',
      en: 'Define the **area function** $F(x)=\\displaystyle\\int_0^x f(t)\\,dt$: the signed area accumulated up to $x$. Here $f=\\cos$ and the second curve is $F$. Move $b$: the height of the point on $F$ is the shaded area ($\\sin1\\approx0.84$ for $b=1$).' },
    { par: { b: 1 }, capas: [AREA_B, { tipo: 'tangente', c: 'F', x: 'b' }],
      es: 'Ahora la tangente de $F$ en $b$. Compara las lecturas: la pendiente $F\'(b)$ coincide con la altura $f(b)$ de la curva original, y $F(b)$ con el área acumulada.',
      en: 'Now the tangent of $F$ at $b$. Compare the readings: the slope $F\'(b)$ matches the height $f(b)$ of the original curve, and $F(b)$ matches the accumulated area.',
      jugar: {
        botones: [
          ...BOT_B,
          { label: 'b = π/2', hacer: v => { v.b = PI / 2; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'b', valor: cx.fmt(v.b) },
          { expr: '∫₀ᵇ f', valor: cx.fmt(z(cx.integral('f', 0, v.b))) },
          { expr: 'F(b)', valor: cx.fmt(z(cx.f('F', v.b))) },
          { expr: 'F′(b)', valor: cx.fmt(z(cx.d('F', v.b))) },
          { expr: 'f(b)', valor: cx.fmt(z(cx.f('f', v.b))) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { par: { b: PI / 2 }, capas: [AREA_B, { tipo: 'tangente', c: 'F', x: 'b' }],
      es: '**TFC, parte 1**: si $f$ es continua, $F\'(x)=f(x)$. La pendiente de la función área es la altura de $f$: donde $f>0$, $F$ sube; donde $f=0$ ($x=\\tfrac\\pi2$), $F$ alcanza su máximo, $F(\\tfrac\\pi2)=1$; donde $f<0$, $F$ baja.',
      en: '**FTC, part 1**: if $f$ is continuous, $F\'(x)=f(x)$. The slope of the area function is the height of $f$: where $f>0$, $F$ rises; where $f=0$ ($x=\\tfrac\\pi2$), $F$ reaches its maximum, $F(\\tfrac\\pi2)=1$; where $f<0$, $F$ falls.' },
    { sec: { es: 'Evaluar con primitivas', en: 'Evaluating with antiderivatives' },
      funcion: { ...V1, curvas: [{ id: 'f', nombre: 'x²', f: cuad }], capas: [{ tipo: 'riemann', c: 'f', a: 0, b: 2, n: 1, m: 'exacta' }],
        etiqueta: { es: 'Área exacta bajo x² en [0, 2]', en: 'Exact area under x² on [0, 2]' } },
      es: '**TFC, parte 2**: si $G\'=f$, entonces $\\displaystyle\\int_a^b f(x)\\,dx=G(b)-G(a)$. Para $x^2$, $G=\\tfrac{x^3}{3}$: $\\displaystyle\\int_0^2x^2\\,dx=\\tfrac{2^3}{3}-0=\\tfrac83$, el valor al que tendían las sumas de Riemann, sin sumar nada. La constante $C$ se cancela.',
      en: '**FTC, part 2**: if $G\'=f$, then $\\displaystyle\\int_a^b f(x)\\,dx=G(b)-G(a)$. For $x^2$, $G=\\tfrac{x^3}{3}$: $\\displaystyle\\int_0^2x^2\\,dx=\\tfrac{2^3}{3}-0=\\tfrac83$, the value the Riemann sums were heading to, without adding anything. The constant $C$ cancels.' },
    { es: '¿Cuánto vale $\\displaystyle\\int_0^\\pi\\operatorname{sen}x\\,dx$?',
      en: 'What is $\\displaystyle\\int_0^\\pi\\sin x\\,dx$?',
      pregunta: {
        opc: [
          { es: '$0$', en: '$0$' },
          { es: '$2$', en: '$2$', ok: 1 },
          { es: '$-2$', en: '$-2$' },
        ],
        why: {
          es: 'Una primitiva de $\\operatorname{sen}x$ es $-\\cos x$: $\\big[-\\cos x\\big]_0^\\pi=-\\cos\\pi-(-\\cos0)=1+1=2$. Tiene sentido: el arco de $\\operatorname{sen}$ en $[0,\\pi]$ está sobre el eje, así que el resultado es positivo.',
          en: 'An antiderivative of $\\sin x$ is $-\\cos x$: $\\big[-\\cos x\\big]_0^\\pi=-\\cos\\pi-(-\\cos0)=1+1=2$. It makes sense: the arc of $\\sin$ on $[0,\\pi]$ lies above the axis, so the result is positive.',
        },
      } },
    { es: '¿Cuánto vale $\\displaystyle\\frac{d}{dx}\\int_0^x e^{-t^2}\\,dt$?',
      en: 'What is $\\displaystyle\\frac{d}{dx}\\int_0^x e^{-t^2}\\,dt$?',
      pregunta: {
        opc: [
          { es: '$e^{-x^2}$', en: '$e^{-x^2}$', ok: 1 },
          { es: '$-2x\\,e^{-x^2}$', en: '$-2x\\,e^{-x^2}$' },
          { es: 'No se puede: la integral no tiene fórmula', en: 'It cannot be done: the integral has no formula' },
        ],
        why: {
          es: 'Es la parte 1 del TFC: $F\'(x)=f(x)$ con $f(t)=e^{-t^2}$, sin calcular la integral (que no tiene primitiva elemental). La segunda opción deriva el integrando como si fuera función de $x$.',
          en: 'This is part 1 of the FTC: $F\'(x)=f(x)$ with $f(t)=e^{-t^2}$, without computing the integral (which has no elementary antiderivative). The second option differentiates the integrand as if it were a function of $x$.',
        },
      } },

    // ── Sustitución ──
    { sec: { es: 'Integración por sustitución', en: 'Integration by substitution' },
      funcion: { ...VS, curvas: [{ id: 'f', nombre: { es: '2x·e^(x²)', en: '2x·e^(x²)' }, f: x => 2 * x * Math.exp(x * x) }, { id: 'g', nombre: 'eᵘ', f: Math.exp }],
        ver: ['f'], par: { b: 1 }, capas: [{ tipo: 'riemann', c: 'f', a: 0, b: 1, n: 1, m: 'exacta' }],
        deslizadores: [{ par: 'b', min: .05, max: 1.2, paso: .01, es: 'Límite superior b', en: 'Upper limit b' }],
        etiqueta: { es: 'Área bajo 2x·e^(x²) en [0, 1]', en: 'Area under 2x·e^(x²) on [0, 1]' } },
      es: 'Calcula $\\displaystyle\\int_0^1 2x\\,e^{x^2}dx$. No se ve una primitiva directa, pero dentro hay $x^2$ y fuera su derivada, $2x$. Hacemos $u=x^2$, así que $du=2x\\,dx$: toda la expresión se reescribe en la variable $u$.',
      en: 'Compute $\\displaystyle\\int_0^1 2x\\,e^{x^2}dx$. There is no obvious antiderivative, but inside sits $x^2$ and outside its derivative, $2x$. Let $u=x^2$, so $du=2x\\,dx$: the whole expression is rewritten in the variable $u$.' },
    { ver: ['g'], capas: [{ tipo: 'riemann', c: 'g', a: 0, b: 1, n: 1, m: 'exacta' }],
      es: 'Cambiamos también los **límites**: $x=0\\to u=0$ y $x=1\\to u=1$. Queda $\\displaystyle\\int_0^1e^u\\,du=e-1\\approx1{,}718$. Es el mismo número aunque la curva y la región sean otras: la sustitución deforma la región conservando su área.',
      en: 'We also change the **limits**: $x=0\\to u=0$ and $x=1\\to u=1$. It becomes $\\displaystyle\\int_0^1e^u\\,du=e-1\\approx1.718$. It is the same number even though the curve and region are different: the substitution reshapes the region while keeping its area.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, ver: ['f', 'g'], par: { b: 1 }, capas: [{ tipo: 'riemann', c: 'f', a: 0, b: 'b', n: 1, m: 'exacta' }],
      es: 'Mueve el límite superior $b$. La integral en $x$ hasta $b$ y la integral en $u$ hasta $u=b^2$ coinciden, y ambas valen $e^{b^2}-1$. El límite también se transforma.',
      en: 'Move the upper limit $b$. The integral in $x$ up to $b$ and the integral in $u$ up to $u=b^2$ agree, and both equal $e^{b^2}-1$. The limit transforms too.',
      jugar: {
        botones: [
          { label: 'b − 0,2', hacer: v => { v.b = Math.max(.05, +(v.b - .2).toFixed(2)); }, off: v => v.b <= .05 },
          { label: 'b + 0,2', hacer: v => { v.b = Math.min(1.2, +(v.b + .2).toFixed(2)); }, off: v => v.b >= 1.2 },
          { label: 'b = 1', hacer: v => { v.b = 1; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'b', valor: cx.fmt(v.b) },
          { expr: '∫₀ᵇ 2x·e^(x²) dx', valor: cx.fmt(cx.integral('f', 0, v.b)) },
          { expr: 'u = b²', valor: cx.fmt(v.b * v.b) },
          { expr: '∫₀ᵘ eᵘ du', valor: cx.fmt(cx.integral('g', 0, v.b * v.b)) },
          { expr: 'e^(b²) − 1', valor: cx.fmt(Math.exp(v.b * v.b) - 1) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { es: 'Error típico: olvidar cambiar los límites. En $\\displaystyle\\int_0^2 2x\\,e^{x^2}dx$, $u=x^2$ va de $0$ a $4$, no de $0$ a $2$: el valor correcto es $e^4-1\\approx53{,}6$, no $e^2-1\\approx6{,}39$. Alternativa: hallar la primitiva en $u$, volver a $x$ y usar los límites originales.',
      en: 'Typical mistake: forgetting to change the limits. In $\\displaystyle\\int_0^2 2x\\,e^{x^2}dx$, $u=x^2$ runs from $0$ to $4$, not from $0$ to $2$: the correct value is $e^4-1\\approx53.6$, not $e^2-1\\approx6.39$. Alternative: find the antiderivative in $u$, go back to $x$ and use the original limits.' },
    { es: '¿Cuál es $\\displaystyle\\int x\\cos(x^2)\\,dx$?',
      en: 'What is $\\displaystyle\\int x\\cos(x^2)\\,dx$?',
      pregunta: {
        opc: [
          { es: '$\\operatorname{sen}(x^2)+C$', en: '$\\sin(x^2)+C$' },
          { es: '$\\tfrac12\\operatorname{sen}(x^2)+C$', en: '$\\tfrac12\\sin(x^2)+C$', ok: 1 },
          { es: '$2x\\operatorname{sen}(x^2)+C$', en: '$2x\\sin(x^2)+C$' },
        ],
        why: {
          es: 'Con $u=x^2$, $du=2x\\,dx$, es decir $x\\,dx=\\tfrac12du$. Entonces $\\int\\cos u\\cdot\\tfrac12du=\\tfrac12\\operatorname{sen}u+C=\\tfrac12\\operatorname{sen}(x^2)+C$. Derivar el resultado para comprobarlo devuelve $x\\cos(x^2)$.',
          en: 'With $u=x^2$, $du=2x\\,dx$, i.e. $x\\,dx=\\tfrac12du$. Then $\\int\\cos u\\cdot\\tfrac12du=\\tfrac12\\sin u+C=\\tfrac12\\sin(x^2)+C$. Differentiating the result to check it returns $x\\cos(x^2)$.',
        },
      } },
  ],
};
