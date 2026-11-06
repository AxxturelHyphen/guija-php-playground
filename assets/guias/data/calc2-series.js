// Guía «Series numéricas» (Cálculo II). Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Sucesiones como puntos (`punto`), sumas parciales como poligonal paramétrica con `hasta: 'N'` + `marca`, criterio de la
// integral con la capa `riemann` (izq = rectángulos sobre la curva, der = bajo ella). Cada `funcion:{…}` abre una escena.
const GAMMA = 0.5772156649;
const pts = (c, a, b) => Array.from({ length: b - a + 1 }, (_, i) => ({ tipo: 'punto', c, x: a + i }));
// Poligonal que une (k, S(k)): S es la sucesión de sumas parciales (S(0) = 0)
const poli = S => t => { const k = Math.floor(t), a = S(k), b = S(k + 1); return a + (b - a) * (t - k); };

// Sumas parciales: geométrica 1 + 1/2 + 1/4 + …, armónica y armónica alternada
const SG = k => (k <= 0 ? 0 : 2 - 2 ** (1 - k));
const HN = [0]; for (let k = 1; k <= 60; k++) HN[k] = HN[k - 1] + 1 / k;
const SH = k => (k <= 0 ? 0 : HN[Math.min(k, 60)]);
const AN = [0]; for (let k = 1; k <= 25; k++) AN[k] = AN[k - 1] + (-1) ** (k + 1) / k;
const SA = k => (k <= 0 ? 0 : AN[Math.min(k, 25)]);

// Escena A: la sucesión a_n = 1/n (solo puntos: una sucesión es discreta)
const A_PTS = Array.from({ length: 15 }, (_, i) => ({ tipo: 'punto', x: i + 1, y: 1 / (i + 1) }));
const A_LIM = [{ tipo: 'asintota', y: 0 }, { tipo: 'texto', x: 12.5, y: .12, s: '$L=0$' }];
const A_EPS = [{ tipo: 'epsdelta', x: 0, L: 0, eps: 'eps', delta: 0 }, { tipo: 'linea', x1: 'N', y1: -.35, x2: 'N', y2: 1.25 }, { tipo: 'texto', x: 'N', y: 1.15, s: '$n=N$' }];
const PRESETS = [.5, .25, .1, .07];

// Escena B: sumas parciales de la geométrica (círculos huecos = términos)
const B_TERM = Array.from({ length: 12 }, (_, i) => ({ tipo: 'punto', x: i + 1, y: .5 ** i, abierto: true }));
const B_CAPAS = [...B_TERM, { tipo: 'asintota', y: 2 }, { tipo: 'texto', x: 9.5, y: 2.13, s: '$S=2$' }, { tipo: 'marca', c: 'S', u: 'N' }];

// Escena D: criterio de la integral. izq → rectángulos de altura f(n) (sobre la curva); der → altura f(n+1) (bajo ella)
const RIE = c => [{ tipo: 'riemann', c, a: 1, b: 'b', n: 'n', m: 'izq' }, { tipo: 'riemann', c, a: 1, b: 'b', n: 'n', m: 'der' }];

export default {
  titulo: { es: 'Series numéricas', en: 'Numerical series' },
  fuentes: [
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 2*. OpenStax. https://openstax.org/books/calculus-volume-2/pages/preface',
  ],
  pasos: [
    // ── Sucesiones y límite ──
    { sec: { es: 'Sucesiones y límite', en: 'Sequences and limits' },
      ver: [],
      funcion: { x: [-.5, 16], y: [-.4, 1.3], curvas: [{ id: 'a', nombre: '$\\dfrac{1}{x}$', f: x => (x > 0 ? 1 / x : NaN) }], par: { eps: .5, N: 2 }, capas: [...A_PTS, ...A_LIM],
        etiqueta: { es: 'Términos de la sucesión 1/n como puntos que se acercan a 0', en: 'Terms of the sequence 1/n as points approaching 0' } },
      es: 'Una **sucesión** es una lista infinita $a_1,a_2,a_3,\\dots$ Aquí $a_n=\\dfrac1n$: $1,\\tfrac12,\\tfrac13,\\dots$ Cada punto es un término. Se acercan a la recta $y=0$ sin tocarla: el **límite** es $0$, $\\displaystyle\\lim_{n\\to\\infty}\\dfrac1n=0$.',
      en: 'A **sequence** is an infinite list $a_1,a_2,a_3,\\dots$ Here $a_n=\\dfrac1n$: $1,\\tfrac12,\\tfrac13,\\dots$ Each dot is a term. They approach the line $y=0$ without touching it: the **limit** is $0$, $\\displaystyle\\lim_{n\\to\\infty}\\dfrac1n=0$.' },
    { par: { eps: .5, N: 2 }, capas: [...A_PTS, ...A_LIM.slice(0, 1), ...A_EPS],
      es: 'Precisamente: $\\lim a_n=L$ si para todo $\\varepsilon>0$ hay un $N$ tal que $|a_n-L|<\\varepsilon$ para todo $n>N$. Desde $N$ en adelante, todos los términos caen dentro de la banda. Aquí basta $N=\\lfloor1/\\varepsilon\\rfloor$. Estrecha la banda y mira dónde cae $N$.',
      en: 'Precisely: $\\lim a_n=L$ if for every $\\varepsilon>0$ there is an $N$ such that $|a_n-L|<\\varepsilon$ for all $n>N$. From $N$ on, every term falls inside the band. Here $N=\\lfloor1/\\varepsilon\\rfloor$ is enough. Narrow the band and watch where $N$ lands.',
      jugar: {
        botones: PRESETS.map(e => ({ label: 'ε = ' + String(e).replace('.', ','), hacer: v => { v.eps = e; v.N = Math.floor(1 / e + 1e-9); } })),
        lecturas: (v, cx) => [
          { expr: 'ε', valor: cx.fmt(v.eps) },
          { expr: 'N = ⌊1/ε⌋', valor: cx.fmt(v.N) },
          { expr: '$a_{N+1}=\\dfrac1{N+1}$', valor: cx.fmt(1 / (v.N + 1)) },
        ],
      } },

    // ── De sucesión a serie ──
    { sec: { es: 'De la sucesión a la serie', en: 'From sequence to series' },
      funcion: { x: [-.5, 12.5], y: [-.2, 2.35], curvas: [{ id: 'S', nombre: '$S_N$', param: { x: t => t, y: poli(SG), t: [0, 12] }, hasta: 'N' }], par: { N: 3 },
        deslizadores: [{ par: 'N', min: 1, max: 12, paso: 1, es: 'Términos sumados N', en: 'Terms added N' }], capas: B_CAPAS,
        etiqueta: { es: 'Sumas parciales de la serie geométrica de razón 1/2', en: 'Partial sums of the geometric series with ratio 1/2' } },
      es: 'Una **serie** es la suma de todos los términos: $\\displaystyle\\sum_{n=1}^{\\infty}a_n$. No se puede sumar infinitas veces, así que se define con **sumas parciales** $S_N=a_1+\\dots+a_N$. Si $S_N$ tiene límite, la serie **converge** y ese límite es su suma. Si no, **diverge**.',
      en: 'A **series** is the sum of all the terms: $\\displaystyle\\sum_{n=1}^{\\infty}a_n$. You cannot add infinitely many times, so it is defined through **partial sums** $S_N=a_1+\\dots+a_N$. If $S_N$ has a limit, the series **converges** and that limit is its sum. Otherwise it **diverges**.' },
    { par: { N: 1 },
      traza: [
        { par: { N: 1 }, es: '$S_1=1$.', en: '$S_1=1$.' },
        { par: { N: 2 }, es: '$S_2=1{,}5$.', en: '$S_2=1.5$.' },
        { par: { N: 3 }, es: '$S_3=1{,}75$.', en: '$S_3=1.75$.' },
        { par: { N: 4 }, es: '$S_4=1{,}875$: cada paso recorre la mitad de lo que falta para $2$.', en: '$S_4=1.875$: each step covers half of what is left to reach $2$.' },
        { par: { N: 5 }, es: '$S_5=1{,}9375$.', en: '$S_5=1.9375$.' },
        { par: { N: 8 } },
        { par: { N: 10 }, es: '$S_{10}\\approx1{,}998$: la línea se pega a $S=2$.', en: '$S_{10}\\approx1.998$: the line hugs $S=2$.' },
        { par: { N: 12 } },
      ],
      es: 'Ejemplo: $1+\\tfrac12+\\tfrac14+\\tfrac18+\\cdots$ Los círculos huecos son los términos $a_n$ (se achican); la línea une las sumas parciales $S_N$. Reproduce la traza: $S_N$ sube cada vez menos y se aproxima a una recta horizontal.',
      en: 'Example: $1+\\tfrac12+\\tfrac14+\\tfrac18+\\cdots$ The hollow circles are the terms $a_n$ (shrinking); the line joins the partial sums $S_N$. Play the trace: $S_N$ rises by less each time and approaches a horizontal line.' },
    { par: { N: 12 },
      es: 'Cada término es la mitad del anterior: **razón** $r=\\tfrac12$. Entonces $S_N=\\dfrac{1-r^N}{1-r}=2-2^{1-N}$. Si $|r|<1$, $r^N\\to0$ y $\\displaystyle\\sum_{n=0}^{\\infty}r^n=\\dfrac1{1-r}$; con $r=\\tfrac12$ da $2$. Si $|r|\\ge1$ los términos no tienden a $0$ y la serie diverge.',
      en: 'Each term is half the previous one: **ratio** $r=\\tfrac12$. Then $S_N=\\dfrac{1-r^N}{1-r}=2-2^{1-N}$. If $|r|<1$, $r^N\\to0$ and $\\displaystyle\\sum_{n=0}^{\\infty}r^n=\\dfrac1{1-r}$; with $r=\\tfrac12$ this gives $2$. If $|r|\\ge1$ the terms do not tend to $0$ and the series diverges.' },
    { par: { N: 12 },
      es: '¿Cuánto vale $\\displaystyle\\sum_{n=0}^{\\infty}\\left(\\tfrac13\\right)^n=1+\\tfrac13+\\tfrac19+\\cdots$?',
      en: 'What is $\\displaystyle\\sum_{n=0}^{\\infty}\\left(\\tfrac13\\right)^n=1+\\tfrac13+\\tfrac19+\\cdots$?',
      pregunta: {
        opc: [
          { es: '$3$, porque $\\dfrac1r=3$', en: '$3$, because $\\dfrac1r=3$' },
          { es: '$\\tfrac32$: $\\dfrac1{1-1/3}$', en: '$\\tfrac32$: $\\dfrac1{1-1/3}$', ok: 1 },
          { es: 'Diverge: suma infinitos términos positivos', en: 'It diverges: it adds infinitely many positive terms' },
        ],
        why: {
          es: 'Es geométrica con $r=\\tfrac13$, $|r|<1$: suma $\\dfrac1{1-r}=\\dfrac{1}{2/3}=\\tfrac32$. Compruébalo: $1+0{,}333+0{,}111+0{,}037+\\cdots\\to1{,}5$. Infinitos términos positivos pueden dar una suma finita si se achican lo bastante rápido.',
          en: 'It is geometric with $r=\\tfrac13$, $|r|<1$: the sum is $\\dfrac1{1-r}=\\dfrac{1}{2/3}=\\tfrac32$. Check: $1+0.333+0.111+0.037+\\cdots\\to1.5$. Infinitely many positive terms can add up to a finite value if they shrink fast enough.',
        },
      } },

    // ── La armónica ──
    { sec: { es: 'La serie armónica', en: 'The harmonic series' },
      funcion: { x: [-1, 52], y: [-.3, 5.4], curvas: [{ id: 'H', nombre: '$H_N$', param: { x: t => t, y: poli(SH), t: [0, 50] }, hasta: 'N' }, { id: 'L', nombre: '$\\ln x+\\gamma$', f: x => (x >= .6 ? Math.log(x) + GAMMA : NaN) }], par: { N: 10 },
        deslizadores: [{ par: 'N', min: 1, max: 50, paso: 1, es: 'Términos sumados N', en: 'Terms added N' }], capas: [{ tipo: 'marca', c: 'H', u: 'N' }],
        etiqueta: { es: 'Sumas parciales de la serie armónica y la curva ln x + γ', en: 'Partial sums of the harmonic series and the curve ln x + γ' } },
      es: 'Ahora $\\displaystyle\\sum_{n=1}^{\\infty}\\dfrac1n=1+\\tfrac12+\\tfrac13+\\cdots$ (**armónica**). Sus términos también tienden a $0$, como en la geométrica. Mueve $N$: $H_{10}\\approx2{,}93$ y $H_{50}\\approx4{,}50$. ¿Se estabiliza o sigue creciendo?',
      en: 'Now $\\displaystyle\\sum_{n=1}^{\\infty}\\dfrac1n=1+\\tfrac12+\\tfrac13+\\cdots$ (**harmonic**). Its terms also tend to $0$, as in the geometric one. Move $N$: $H_{10}\\approx2.93$ and $H_{50}\\approx4.50$. Does it settle or keep growing?' },
    { par: { N: 31 },
      es: 'No se frena: $H_N\\approx\\ln N+\\gamma$ con $\\gamma\\approx0{,}5772$. Crece despacio, pero sin cota: pasa de $4$ en $N=31$ y de $10$ en $N=12367$. Oresme: $\\tfrac13+\\tfrac14>\\tfrac12$, $\\tfrac15+\\cdots+\\tfrac18>\\tfrac12$, y cada bloque siguiente también supera $\\tfrac12$. Diverge.',
      en: 'It does not stop: $H_N\\approx\\ln N+\\gamma$ with $\\gamma\\approx0.5772$. It grows slowly but without bound: it passes $4$ at $N=31$ and $10$ at $N=12367$. Oresme: $\\tfrac13+\\tfrac14>\\tfrac12$, $\\tfrac15+\\cdots+\\tfrac18>\\tfrac12$, and every next block also exceeds $\\tfrac12$. It diverges.' },
    { par: { N: 31 },
      es: 'Los términos $\\dfrac1n$ tienden a $0$. ¿Basta eso para que la serie converja?',
      en: 'The terms $\\dfrac1n$ tend to $0$. Is that enough for the series to converge?',
      pregunta: {
        opc: [
          { es: 'Sí: si los términos se hacen diminutos, la suma se estabiliza', en: 'Yes: if the terms become tiny, the sum settles' },
          { es: 'No: $a_n\\to0$ es necesario, no suficiente', en: 'No: $a_n\\to0$ is necessary, not sufficient', ok: 1 },
          { es: 'Sí, siempre que todos los términos sean positivos', en: 'Yes, as long as all terms are positive' },
        ],
        why: {
          es: 'Si $\\sum a_n$ converge, entonces $a_n\\to0$; por eso, si $a_n\\not\\to0$ la serie diverge (criterio del término general). El recíproco es falso: la armónica tiene $a_n\\to0$, es de términos positivos y diverge.',
          en: 'If $\\sum a_n$ converges, then $a_n\\to0$; so if $a_n\\not\\to0$ the series diverges (the divergence test). The converse is false: the harmonic series has $a_n\\to0$, positive terms, and still diverges.',
        },
      } },

    // ── Criterio de la integral ──
    { sec: { es: 'Criterio de la integral', en: 'The integral test' },
      ver: ['p1'],
      funcion: { x: [-.5, 18], y: [-.15, 1.3], par: { n: 8, b: 9 },
        curvas: [{ id: 'p1', nombre: '$\\dfrac{1}{x}$', f: x => (x > 0 ? 1 / x : NaN) }, { id: 'p2', nombre: '$\\dfrac{1}{x^2}$', f: x => (x > 0 ? 1 / (x * x) : NaN) }, { id: 'ph', nombre: '$\\dfrac{1}{\\sqrt{x}}$', f: x => (x > 0 ? 1 / Math.sqrt(x) : NaN) }],
        capas: RIE('p1'), etiqueta: { es: 'Rectángulos sobre y bajo la curva 1/x', en: 'Rectangles above and below the curve 1/x' } },
      es: '**Criterio de la integral.** Si $f$ es positiva, continua y decreciente en $[1,\\infty)$ y $a_n=f(n)$, entonces $\\sum a_n$ y $\\displaystyle\\int_1^{\\infty}f$ convergen o divergen a la vez. Los rectángulos de altura $f(n)$ quedan **sobre** la curva; los de altura $f(n+1)$, **bajo** ella.',
      en: '**Integral test.** If $f$ is positive, continuous and decreasing on $[1,\\infty)$ and $a_n=f(n)$, then $\\sum a_n$ and $\\displaystyle\\int_1^{\\infty}f$ either both converge or both diverge. Rectangles of height $f(n)$ sit **above** the curve; those of height $f(n+1)$ sit **below** it.' },
    { par: { n: 8, b: 9 },
      traza: [
        { par: { n: 2, b: 3 }, es: '$N=2$: $0{,}83<\\ln3\\approx1{,}10<1{,}50$.', en: '$N=2$: $0.83<\\ln3\\approx1.10<1.50$.' },
        { par: { n: 4, b: 5 }, es: '$N=4$: $1{,}28<\\ln5\\approx1{,}61<2{,}08$.', en: '$N=4$: $1.28<\\ln5\\approx1.61<2.08$.' },
        { par: { n: 8, b: 9 }, es: '$N=8$: $1{,}83<\\ln9\\approx2{,}20<2{,}72$.', en: '$N=8$: $1.83<\\ln9\\approx2.20<2.72$.' },
        { par: { n: 16, b: 17 }, es: '$N=16$: $2{,}44<\\ln17\\approx2{,}83<3{,}38$. La suma queda siempre sobre el área.', en: '$N=16$: $2.44<\\ln17\\approx2.83<3.38$. The sum always stays above the area.' },
      ],
      es: 'Reproduce la traza con $f=1/x$. Para cada $N$ el área bajo la curva, $\\ln(N+1)$, queda entre la suma de los rectángulos bajos y la de los altos. La suma de los altos es justo $H_N=1+\\tfrac12+\\cdots+\\tfrac1N$.',
      en: 'Play the trace with $f=1/x$. For each $N$ the area under the curve, $\\ln(N+1)$, lies between the sum of the low rectangles and that of the high ones. The sum of the high ones is exactly $H_N=1+\\tfrac12+\\cdots+\\tfrac1N$.' },
    { par: { n: 8, b: 9 },
      es: 'Como $H_N\\ge\\displaystyle\\int_1^{N+1}\\dfrac{dx}{x}=\\ln(N+1)\\to\\infty$, la armónica diverge: ahora con una prueba que sirve para cualquier $f$. Duplica $N$ y compara las tres lecturas.',
      en: 'Since $H_N\\ge\\displaystyle\\int_1^{N+1}\\dfrac{dx}{x}=\\ln(N+1)\\to\\infty$, the harmonic series diverges: now with a proof that works for any $f$. Double $N$ and compare the three readings.',
      jugar: {
        botones: [
          { label: { es: 'N × 2', en: 'N × 2' }, hacer: v => { v.n = Math.min(16, v.n * 2); v.b = v.n + 1; }, off: v => v.n >= 16 },
          { label: { es: 'N ÷ 2', en: 'N ÷ 2' }, hacer: v => { v.n = Math.max(2, v.n / 2); v.b = v.n + 1; }, off: v => v.n <= 2 },
          { label: 'N = 8', hacer: v => { v.n = 8; v.b = 9; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'N', valor: cx.fmt(v.n) },
          { expr: 'Σ 1/k  (rect. altos)', valor: cx.fmt(cx.riemann('p1', 1, v.b, v.n, 'izq')) },
          { expr: '∫ 1/x = ln(N+1)', valor: cx.fmt(cx.integral('p1', 1, v.b)) },
          { expr: { es: 'rect. bajos', en: 'low rectangles' }, valor: cx.fmt(cx.riemann('p1', 1, v.b, v.n, 'der')) },
        ],
      } },
    { ver: ['p2'], par: { n: 16, b: 17 }, capas: RIE('p2'),
      es: 'Con $f=1/x^2$ la desigualdad juega a favor: $\\displaystyle\\sum_{n=2}^{N}\\dfrac1{n^2}\\le\\int_1^{N}\\dfrac{dx}{x^2}=1-\\dfrac1N<1$. Las sumas parciales crecen pero no pasan de $2$, y una sucesión creciente y acotada converge. Aquí $S_{16}\\approx1{,}584$.',
      en: 'With $f=1/x^2$ the inequality works in our favor: $\\displaystyle\\sum_{n=2}^{N}\\dfrac1{n^2}\\le\\int_1^{N}\\dfrac{dx}{x^2}=1-\\dfrac1N<1$. The partial sums grow but never pass $2$, and an increasing bounded sequence converges. Here $S_{16}\\approx1.584$.' },
    { ver: ['ph'], par: { n: 16, b: 17 }, capas: RIE('ph'),
      es: 'Con $f=1/\\sqrt x$: $\\displaystyle\\int_1^{N+1}\\dfrac{dx}{\\sqrt x}=2\\sqrt{N+1}-2\\to\\infty$, y la suma de los rectángulos altos lo supera, así que diverge. Para $N=16$: $S_{16}\\approx6{,}66$ frente a $2\\sqrt{17}-2\\approx6{,}25$.',
      en: 'With $f=1/\\sqrt x$: $\\displaystyle\\int_1^{N+1}\\dfrac{dx}{\\sqrt x}=2\\sqrt{N+1}-2\\to\\infty$, and the sum of the high rectangles exceeds it, so it diverges. For $N=16$: $S_{16}\\approx6.66$ versus $2\\sqrt{17}-2\\approx6.25$.' },
    { ver: ['p1', 'p2', 'ph'], capas: [],
      es: 'En general $\\displaystyle\\int_1^{\\infty}x^{-p}\\,dx=\\dfrac1{p-1}$ si $p>1$ y diverge si $p\\le1$. Por tanto, $\\displaystyle\\sum\\dfrac1{n^p}$ **converge si y solo si $p>1$**. El criterio dice *si* converge, no *a qué*: $\\sum\\dfrac1{n^2}=\\dfrac{\\pi^2}6\\approx1{,}645$, no $1$.',
      en: 'In general $\\displaystyle\\int_1^{\\infty}x^{-p}\\,dx=\\dfrac1{p-1}$ if $p>1$ and diverges if $p\\le1$. Hence $\\displaystyle\\sum\\dfrac1{n^p}$ **converges if and only if $p>1$**. The test says *whether* it converges, not *to what*: $\\sum\\dfrac1{n^2}=\\dfrac{\\pi^2}6\\approx1.645$, not $1$.' },
    { ver: ['p1', 'p2', 'ph'], capas: [],
      es: '¿Cuál de estas series converge?',
      en: 'Which of these series converges?',
      pregunta: {
        opc: [
          { es: '$\\displaystyle\\sum\\dfrac1{\\sqrt n}$', en: '$\\displaystyle\\sum\\dfrac1{\\sqrt n}$' },
          { es: '$\\displaystyle\\sum\\dfrac1{n^{1{,}1}}$', en: '$\\displaystyle\\sum\\dfrac1{n^{1.1}}$', ok: 1 },
          { es: '$\\displaystyle\\sum\\dfrac1n$', en: '$\\displaystyle\\sum\\dfrac1n$' },
        ],
        why: {
          es: 'Es una $p$-serie: converge solo si $p>1$. $\\tfrac1{\\sqrt n}$ tiene $p=\\tfrac12$ y $\\tfrac1n$ tiene $p=1$: ambas divergen. $p=1{,}1$ converge, aunque muy despacio.',
          en: 'These are $p$-series: they converge only if $p>1$. $\\tfrac1{\\sqrt n}$ has $p=\\tfrac12$ and $\\tfrac1n$ has $p=1$: both diverge. $p=1.1$ converges, though very slowly.',
        },
      } },

    // ── Comparación, cociente y alternada ──
    { sec: { es: 'Criterios de comparación', en: 'Comparison tests' },
      ver: ['g', 'h'],
      funcion: { x: [0, 9], y: [-.06, 1.1],
        curvas: [{ id: 'g', nombre: '$\\dfrac{1}{x^2}$', f: x => (x > 0 ? 1 / (x * x) : NaN) }, { id: 'h', nombre: '$\\dfrac{1}{x^2+1}$', f: x => 1 / (x * x + 1) }, { id: 'u', nombre: '$\\dfrac{x}{x^2+1}$', f: x => x / (x * x + 1) }, { id: 'v', nombre: '$\\dfrac{1}{x}$', f: x => (x > 0 ? 1 / x : NaN) }, { id: 'w', nombre: '$\\dfrac{x}{2^x}$', f: x => x / 2 ** x }],
        capas: [...pts('g', 1, 8), ...pts('h', 1, 8)], etiqueta: { es: 'Términos de 1/n² y 1/(n²+1)', en: 'Terms of 1/n² and 1/(n²+1)' } },
      es: '**Comparación directa.** Si $0\\le a_n\\le b_n$ y $\\sum b_n$ converge, $\\sum a_n$ converge; si $\\sum a_n$ diverge, $\\sum b_n$ también. Como $\\dfrac1{n^2+1}<\\dfrac1{n^2}$ ($0{,}2<0{,}25$ en $n=2$; $0{,}1<0{,}111$ en $n=3$) y $p=2>1$, $\\sum\\dfrac1{n^2+1}$ converge.',
      en: '**Direct comparison.** If $0\\le a_n\\le b_n$ and $\\sum b_n$ converges, $\\sum a_n$ converges; if $\\sum a_n$ diverges, so does $\\sum b_n$. Since $\\dfrac1{n^2+1}<\\dfrac1{n^2}$ ($0.2<0.25$ at $n=2$; $0.1<0.111$ at $n=3$) and $p=2>1$, $\\sum\\dfrac1{n^2+1}$ converges.' },
    { ver: ['g', 'h'],
      es: 'Y al revés: $\\dfrac1{2n-1}>\\dfrac1{2n}$, y $\\sum\\dfrac1{2n}=\\tfrac12\\sum\\dfrac1n$ diverge, luego $\\sum\\dfrac1{2n-1}$ diverge. La comparación exige la dirección correcta: acotar por encima una serie divergente no prueba nada.',
      en: 'And the other way: $\\dfrac1{2n-1}>\\dfrac1{2n}$, and $\\sum\\dfrac1{2n}=\\tfrac12\\sum\\dfrac1n$ diverges, so $\\sum\\dfrac1{2n-1}$ diverges. Comparison needs the right direction: bounding a series above by a divergent one proves nothing.' },
    { ver: ['u', 'v'], capas: [...pts('u', 1, 8), ...pts('v', 1, 8)],
      es: '**Comparación en el límite.** Si $a_n,b_n>0$ y $\\displaystyle\\lim\\dfrac{a_n}{b_n}=c$ con $0<c<\\infty$, ambas series se comportan igual. Con $a_n=\\dfrac n{n^2+1}$ y $b_n=\\dfrac1n$: $a_n/b_n=\\dfrac{n^2}{n^2+1}$ vale $0{,}990$ en $n=10$ y $0{,}9999$ en $n=100$; $c=1$, así que diverge como la armónica.',
      en: '**Limit comparison.** If $a_n,b_n>0$ and $\\displaystyle\\lim\\dfrac{a_n}{b_n}=c$ with $0<c<\\infty$, both series behave alike. With $a_n=\\dfrac n{n^2+1}$ and $b_n=\\dfrac1n$: $a_n/b_n=\\dfrac{n^2}{n^2+1}$ is $0.990$ at $n=10$ and $0.9999$ at $n=100$; $c=1$, so it diverges like the harmonic series.' },
    { sec: { es: 'Criterio del cociente', en: 'The ratio test' }, ver: ['w'], capas: pts('w', 1, 8),
      es: '**Cociente.** Si $L=\\displaystyle\\lim\\left|\\dfrac{a_{n+1}}{a_n}\\right|$: $L<1$ converge, $L>1$ diverge, $L=1$ no concluye. Con $a_n=\\dfrac n{2^n}$ el cociente es $\\dfrac{n+1}{2n}$: $0{,}75$ ($n=2$), $0{,}6$ ($n=5$), $0{,}55$ ($n=10$), y tiende a $\\tfrac12<1$: converge (suma $2$).',
      en: '**Ratio test.** If $L=\\displaystyle\\lim\\left|\\dfrac{a_{n+1}}{a_n}\\right|$: $L<1$ converges, $L>1$ diverges, $L=1$ is inconclusive. With $a_n=\\dfrac n{2^n}$ the ratio is $\\dfrac{n+1}{2n}$: $0.75$ ($n=2$), $0.6$ ($n=5$), $0.55$ ($n=10$), and it tends to $\\tfrac12<1$: converges (sum $2$).' },
    { ver: ['w'],
      es: 'Con $L=1$ el criterio calla: $\\sum\\dfrac1n$ y $\\sum\\dfrac1{n^2}$ dan ambas $L=1$, y una diverge y la otra converge. Es el criterio natural cuando aparecen factoriales o potencias de $n$ en el exponente, como $\\dfrac{n!}{3^n}$ o $\\dfrac{2^n}{n!}$.',
      en: 'With $L=1$ the test is silent: $\\sum\\dfrac1n$ and $\\sum\\dfrac1{n^2}$ both give $L=1$, yet one diverges and the other converges. It is the natural test when factorials or powers with $n$ in the exponent appear, such as $\\dfrac{n!}{3^n}$ or $\\dfrac{2^n}{n!}$.' },

    // ── Alternada ──
    { sec: { es: 'Series alternadas', en: 'Alternating series' },
      funcion: { x: [-1, 21], y: [-.05, 1.12], curvas: [{ id: 'A', nombre: '$S_N$', param: { x: t => t, y: poli(SA), t: [0, 20] }, hasta: 'N' }], par: { N: 6 },
        deslizadores: [{ par: 'N', min: 1, max: 20, paso: 1, es: 'Términos sumados N', en: 'Terms added N' }],
        capas: [{ tipo: 'asintota', y: Math.LN2 }, { tipo: 'texto', x: 14, y: .74, s: { es: '$\\ln 2\\approx 0{,}693$', en: '$\\ln 2\\approx 0.693$' } }, { tipo: 'marca', c: 'A', u: 'N' }],
        etiqueta: { es: 'Sumas parciales de la serie armónica alternada', en: 'Partial sums of the alternating harmonic series' } },
      es: '**Leibniz.** Si $b_n>0$ decrece y $b_n\\to0$, entonces $\\displaystyle\\sum(-1)^{n+1}b_n$ converge. Con $b_n=\\dfrac1n$: $1-\\tfrac12+\\tfrac13-\\cdots$ Las sumas parciales saltan a un lado y otro del límite, que es $\\ln2\\approx0{,}693$: $S_5\\approx0{,}783$, $S_6\\approx0{,}617$.',
      en: '**Leibniz.** If $b_n>0$ decreases and $b_n\\to0$, then $\\displaystyle\\sum(-1)^{n+1}b_n$ converges. With $b_n=\\dfrac1n$: $1-\\tfrac12+\\tfrac13-\\cdots$ The partial sums jump to either side of the limit, which is $\\ln2\\approx0.693$: $S_5\\approx0.783$, $S_6\\approx0.617$.' },
    { par: { N: 6 },
      es: 'El error al parar en $N$ nunca supera el primer término omitido: $|S-S_N|\\le b_{N+1}=\\dfrac1{N+1}$. Recorre $N$ y comprueba que la distancia real a $\\ln 2$ siempre cabe dentro de esa cota.',
      en: 'The error when stopping at $N$ never exceeds the first omitted term: $|S-S_N|\\le b_{N+1}=\\dfrac1{N+1}$. Step through $N$ and check that the true distance to $\\ln 2$ always fits inside that bound.',
      jugar: {
        botones: [
          { label: 'N − 1', hacer: v => { v.N = Math.max(1, v.N - 1); }, off: v => v.N <= 1 },
          { label: 'N + 1', hacer: v => { v.N = Math.min(20, v.N + 1); }, off: v => v.N >= 20 },
          { label: 'N = 6', hacer: v => { v.N = 6; } },
        ],
        lecturas: (v, cx) => [
          { expr: 'N', valor: cx.fmt(v.N) },
          { expr: '$S_N$', valor: cx.fmt(SA(v.N)) },
          { expr: '$|S-S_N|$', valor: cx.fmt(Math.abs(Math.LN2 - SA(v.N))) },
          { expr: { es: 'cota 1/(N+1)', en: 'bound 1/(N+1)' }, valor: cx.fmt(1 / (v.N + 1)) },
        ],
      } },
    { par: { N: 20 },
      es: 'Ojo: $\\sum\\dfrac{(-1)^{n+1}}n$ converge, pero $\\sum\\left|\\dfrac{(-1)^{n+1}}n\\right|=\\sum\\dfrac1n$ diverge. Se llama **convergencia condicional**. Si converge $\\sum|a_n|$ hay **convergencia absoluta**, que garantiza la convergencia de $\\sum a_n$.',
      en: 'Note: $\\sum\\dfrac{(-1)^{n+1}}n$ converges, but $\\sum\\left|\\dfrac{(-1)^{n+1}}n\\right|=\\sum\\dfrac1n$ diverges. This is **conditional convergence**. If $\\sum|a_n|$ converges there is **absolute convergence**, which guarantees that $\\sum a_n$ converges.' },
    { par: { N: 20 },
      es: '¿Qué ocurre con $\\displaystyle\\sum_{n=1}^{\\infty}\\dfrac{(-1)^n}{\\sqrt n}$?',
      en: 'What happens with $\\displaystyle\\sum_{n=1}^{\\infty}\\dfrac{(-1)^n}{\\sqrt n}$?',
      pregunta: {
        opc: [
          { es: 'Diverge, porque $\\sum\\dfrac1{\\sqrt n}$ diverge', en: 'It diverges, because $\\sum\\dfrac1{\\sqrt n}$ diverges' },
          { es: 'Converge condicionalmente', en: 'It converges conditionally', ok: 1 },
          { es: 'Converge absolutamente', en: 'It converges absolutely' },
        ],
        why: {
          es: 'Es alternada con $\\dfrac1{\\sqrt n}$ decreciente y $\\to0$: Leibniz da convergencia. Pero $\\sum\\dfrac1{\\sqrt n}$ es una $p$-serie con $p=\\tfrac12\\le1$ y diverge, así que la convergencia no es absoluta. La divergencia del valor absoluto no implica la de la serie.',
          en: 'It alternates with $\\dfrac1{\\sqrt n}$ decreasing and $\\to0$: Leibniz gives convergence. But $\\sum\\dfrac1{\\sqrt n}$ is a $p$-series with $p=\\tfrac12\\le1$ and diverges, so the convergence is not absolute. The divergence of the absolute series does not imply that of the series.',
        },
      } },
    { par: { N: 20 },
      es: '**Mapa de decisión.** ¿$a_n\\not\\to0$? Diverge. ¿Geométrica? Mira $|r|<1$. ¿$p$-serie? Mira $p>1$. ¿Se parece a una de esas? Comparación (directa o en el límite). ¿Factoriales o potencias de $n$? Cociente. ¿Signos alternos? Leibniz. ¿Término decreciente integrable? Integral.',
      en: '**Decision map.** Is $a_n\\not\\to0$? It diverges. Geometric? Check $|r|<1$. $p$-series? Check $p>1$. Does it resemble one of those? Comparison (direct or limit). Factorials or powers of $n$? Ratio. Alternating signs? Leibniz. Decreasing integrable term? Integral.' },
  ],
};
