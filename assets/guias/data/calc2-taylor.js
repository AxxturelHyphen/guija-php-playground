// Guía «Polinomios y series de Taylor» (Cálculo II). Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Capa `taylor` con deslizador de grado `g`; en los bloques `jugar` el error se dibuja con `punto` + `linea` cuyos extremos
// (`ya` = f(x0), `yb` = P_n(x0)) son parámetros que `jugar` recalcula al arrastrar o cambiar el grado.
const fact = k => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };
// Coeficientes de Maclaurin f⁽ᵏ⁾(0)/k!
const cs = k => (k % 2 ? ((k - 1) / 2 % 2 ? -1 : 1) / fact(k) : 0); // sen x: 0, 1, 0, −1/6, 0, 1/120, …
const ce = k => 1 / fact(k);                                           // eˣ: 1/k!
const cg = () => 1;                                                    // 1/(1−x): 1, 1, 1, …
const P = (c, n, x) => { let s = 0; for (let k = 0; k <= n; k++) s += c(k) * x ** k; return s; };
const F1 = x => (Math.abs(1 - x) < 1e-9 ? NaN : 1 / (1 - x));

const TAY = coef => ({ tipo: 'taylor', c: 'f', a: 0, grado: 'g', coef });
// Capas del bloque de error: curva, polinomio, punto sobre la curva, punto sobre el polinomio y la barra entre ambos
const ERR = coef => [TAY(coef), { tipo: 'punto', c: 'f', x: 'x0' }, { tipo: 'punto', x: 'x0', y: 'yb', abierto: true }, { tipo: 'linea', x1: 'x0', y1: 'ya', x2: 'x0', y2: 'yb' }];
// Recalcula los extremos de la barra de error tras mover x0 o el grado
const sincro = (F, coef) => v => { const y = F(v.x0); v.ya = Number.isFinite(y) ? y : 0; v.yb = P(coef, Math.round(v.g), v.x0); };
const sincS = sincro(Math.sin, cs), sincG = sincro(F1, cg);
const par0 = (F, coef, g, x0) => ({ g, x0, ya: F(x0), yb: P(coef, g, x0) });
const asigna = sinc => (v, par, val) => { v[par] = val; sinc(v); };

export default {
  titulo: { es: 'Polinomios y series de Taylor', en: 'Taylor polynomials and series' },
  fuentes: [
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 2*. OpenStax. https://openstax.org/books/calculus-volume-2/pages/preface',
  ],
  pasos: [
    // ── sen x ──
    { sec: { es: 'Aproximar con polinomios', en: 'Approximating with polynomials' },
      funcion: { x: [-7.5, 7.5], y: [-3, 3], curvas: [{ id: 'f', nombre: { es: 'sen x', en: 'sin x' }, f: Math.sin }], par: par0(Math.sin, cs, 1, 1), arrastrar: 'x0',
        deslizadores: [{ par: 'g', min: 0, max: 21, paso: 1, es: 'Grado n', en: 'Degree n', dec: 0 }], capas: [TAY(cs)],
        etiqueta: { es: 'Gráfica de sen x y su polinomio de Taylor', en: 'Graph of sin x and its Taylor polynomial' } },
      es: 'Cerca de un punto $a$, una función suave se parece a su recta tangente: $f(x)\\approx f(a)+f\'(a)(x-a)$. Para $\\operatorname{sen}x$ en $a=0$ esa recta es $y=x$ (curva punteada). ¿Y si usamos un polinomio de mayor grado para pegarnos más, y durante más tiempo?',
      en: 'Near a point $a$, a smooth function looks like its tangent line: $f(x)\\approx f(a)+f\'(a)(x-a)$. For $\\sin x$ at $a=0$ that line is $y=x$ (dotted curve). What if we use a higher-degree polynomial to hug the curve more closely, and for longer?' },
    { par: { g: 1 },
      es: 'El **polinomio de Taylor** de grado $n$ en $a$ es $P_n(x)=\\displaystyle\\sum_{k=0}^{n}\\dfrac{f^{(k)}(a)}{k!}(x-a)^k$. Coincide con $f$ en $a$ y también en sus primeras $n$ derivadas. Si $a=0$ se llama polinomio de **Maclaurin**. Con el deslizador subes el grado.',
      en: 'The **Taylor polynomial** of degree $n$ at $a$ is $P_n(x)=\\displaystyle\\sum_{k=0}^{n}\\dfrac{f^{(k)}(a)}{k!}(x-a)^k$. It matches $f$ at $a$ and also its first $n$ derivatives. If $a=0$ it is called the **Maclaurin** polynomial. The slider raises the degree.' },
    { par: { g: 1 },
      traza: [
        { par: { g: 1 }, es: '$P_1=x$: la tangente en $0$.', en: '$P_1=x$: the tangent at $0$.' },
        { par: { g: 3 }, es: '$P_3=x-\\dfrac{x^3}6$: ya acompaña la primera curva de la onda.', en: '$P_3=x-\\dfrac{x^3}6$: it already follows the first bend of the wave.' },
        { par: { g: 5 }, es: '$P_5=x-\\dfrac{x^3}{3!}+\\dfrac{x^5}{5!}$.', en: '$P_5=x-\\dfrac{x^3}{3!}+\\dfrac{x^5}{5!}$.' },
        { par: { g: 7 } },
        { par: { g: 9 }, es: 'Cada grado impar extiende el tramo donde copia y curva son casi indistinguibles.', en: 'Each odd degree extends the stretch where copy and curve are almost indistinguishable.' },
        { par: { g: 13 } },
      ],
      es: 'Derivadas de $\\operatorname{sen}x$ en $0$: $0,\\,1,\\,0,\\,-1,\\,0,\\,1,\\dots$ y se divide entre $k!$. Solo quedan potencias impares y el signo alterna. Reproduce la traza: cada término ensancha el intervalo donde el polinomio sigue a la onda.',
      en: 'Derivatives of $\\sin x$ at $0$: $0,\\,1,\\,0,\\,-1,\\,0,\\,1,\\dots$ divided by $k!$. Only odd powers survive and the sign alternates. Play the trace: each term widens the interval where the polynomial follows the wave.' },
    { par: { g: 7 },
      es: '**Serie de Maclaurin:** $\\operatorname{sen}x=\\displaystyle\\sum_{k=0}^{\\infty}\\dfrac{(-1)^k}{(2k+1)!}x^{2k+1}=x-\\dfrac{x^3}{6}+\\dfrac{x^5}{120}-\\dfrac{x^7}{5040}+\\cdots$ Los coeficientes son $\\tfrac1{3!}$, $\\tfrac1{5!}$, $\\tfrac1{7!}$ con signo alterno; los de grado par valen $0$.',
      en: '**Maclaurin series:** $\\sin x=\\displaystyle\\sum_{k=0}^{\\infty}\\dfrac{(-1)^k}{(2k+1)!}x^{2k+1}=x-\\dfrac{x^3}{6}+\\dfrac{x^5}{120}-\\dfrac{x^7}{5040}+\\cdots$ The coefficients are $\\tfrac1{3!}$, $\\tfrac1{5!}$, $\\tfrac1{7!}$ with alternating sign; the even-degree ones are $0$.' },
    { par: { g: 3 },
      es: '¿Cuál es el coeficiente de $x^3$ en la serie de Maclaurin de $\\operatorname{sen}x$?',
      en: 'What is the coefficient of $x^3$ in the Maclaurin series of $\\sin x$?',
      pregunta: {
        opc: [
          { es: '$\\dfrac16$', en: '$\\dfrac16$' },
          { es: '$-\\dfrac16$', en: '$-\\dfrac16$', ok: 1 },
          { es: '$-1$', en: '$-1$' },
        ],
        why: {
          es: 'El coeficiente es $\\dfrac{f\'\'\'(0)}{3!}$. Como $f\'\'\'(x)=-\\cos x$, $f\'\'\'(0)=-1$, y dividiendo entre $3!=6$ queda $-\\tfrac16$. La opción $-1$ olvida dividir entre $k!$; la primera pierde el signo.',
          en: 'The coefficient is $\\dfrac{f\'\'\'(0)}{3!}$. Since $f\'\'\'(x)=-\\cos x$, $f\'\'\'(0)=-1$, and dividing by $3!=6$ gives $-\\tfrac16$. The option $-1$ forgets to divide by $k!$; the first one loses the sign.',
        },
      } },
    { par: { g: 3 },
      es: '**Error.** $f(x)=P_n(x)+R_n(x)$ con $|R_n(x)|\\le\\dfrac{M\\,|x-a|^{n+1}}{(n+1)!}$, donde $M$ acota $|f^{(n+1)}|$ entre $a$ y $x$. Para $\\operatorname{sen}x$, $M=1$. Ejemplo: $\\operatorname{sen}1\\approx0{,}8415$ y $P_5(1)\\approx0{,}8417$; la cota $\\tfrac1{7!}\\approx0{,}0002$ lo cubre.',
      en: '**Error.** $f(x)=P_n(x)+R_n(x)$ with $|R_n(x)|\\le\\dfrac{M\\,|x-a|^{n+1}}{(n+1)!}$, where $M$ bounds $|f^{(n+1)}|$ between $a$ and $x$. For $\\sin x$, $M=1$. Example: $\\sin1\\approx0.8415$ and $P_5(1)\\approx0.8417$; the bound $\\tfrac1{7!}\\approx0.0002$ covers it.' },
    { par: par0(Math.sin, cs, 3, 1), capas: ERR(cs),
      es: 'La barra vertical es el **error** $|f(x_0)-P_n(x_0)|$. Arrastra el punto o sube el grado: con $n=3$ en $x_0=1$ el error es $\\approx0{,}008$; con $n=5$, $\\approx0{,}0002$. Lejos de $0$ hace falta mucho más grado.',
      en: 'The vertical bar is the **error** $|f(x_0)-P_n(x_0)|$. Drag the point or raise the degree: with $n=3$ at $x_0=1$ the error is $\\approx0.008$; with $n=5$, $\\approx0.0002$. Far from $0$ you need much more degree.',
      jugar: {
        botones: [
          { label: { es: 'grado − 2', en: 'degree − 2' }, hacer: v => { v.g = Math.max(1, v.g - 2); sincS(v); }, off: v => v.g <= 1 },
          { label: { es: 'grado + 2', en: 'degree + 2' }, hacer: v => { v.g = Math.min(21, v.g + 2); sincS(v); }, off: v => v.g >= 21 },
          { label: 'x₀ = 1', hacer: v => { v.x0 = 1; sincS(v); } },
          { label: 'x₀ = 3', hacer: v => { v.x0 = 3; sincS(v); } },
          { label: 'x₀ = 6', hacer: v => { v.x0 = 6; sincS(v); } },
        ],
        lecturas: (v, cx) => [
          { expr: 'n', valor: cx.fmt(v.g) },
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: 'P_n(x₀)', valor: cx.fmt(v.yb) },
          { expr: 'sen x₀', valor: cx.fmt(v.ya) },
          { expr: { es: 'error', en: 'error' }, valor: cx.fmt(Math.abs(v.ya - v.yb)) },
          { expr: { es: 'cota |x₀|^(n+1)/(n+1)!', en: 'bound |x₀|^(n+1)/(n+1)!' }, valor: cx.fmt(Math.abs(v.x0) ** (v.g + 1) / fact(v.g + 1)) },
        ],
        arrastrables: true, soltar: asigna(sincS),
      } },

    // ── eˣ ──
    { sec: { es: 'eˣ: converge en todas partes', en: 'eˣ: converges everywhere' },
      funcion: { x: [-4, 3.2], y: [-3, 24], curvas: [{ id: 'f', nombre: 'eˣ', f: Math.exp }], par: { g: 2 },
        deslizadores: [{ par: 'g', min: 0, max: 10, paso: 1, es: 'Grado n', en: 'Degree n', dec: 0 }], capas: [TAY(ce)],
        etiqueta: { es: 'Gráfica de e^x y su polinomio de Taylor', en: 'Graph of e^x and its Taylor polynomial' } },
      es: 'Para $e^x$ todas las derivadas valen $1$ en $0$, así que $c_k=\\dfrac1{k!}$: $e^x=\\displaystyle\\sum_{k=0}^{\\infty}\\dfrac{x^k}{k!}=1+x+\\dfrac{x^2}2+\\dfrac{x^3}6+\\dfrac{x^4}{24}+\\cdots$ Mueve el grado: el polinomio sube hasta alcanzar la curva.',
      en: 'For $e^x$ every derivative equals $1$ at $0$, so $c_k=\\dfrac1{k!}$: $e^x=\\displaystyle\\sum_{k=0}^{\\infty}\\dfrac{x^k}{k!}=1+x+\\dfrac{x^2}2+\\dfrac{x^3}6+\\dfrac{x^4}{24}+\\cdots$ Move the degree: the polynomial climbs until it reaches the curve.' },
    { par: { g: 1 },
      traza: [
        { par: { g: 1 }, es: '$P_1(1)=2$.', en: '$P_1(1)=2$.' },
        { par: { g: 2 }, es: '$P_2(1)=2{,}5$.', en: '$P_2(1)=2.5$.' },
        { par: { g: 3 }, es: '$P_3(1)\\approx2{,}667$.', en: '$P_3(1)\\approx2.667$.' },
        { par: { g: 4 }, es: '$P_4(1)\\approx2{,}708$.', en: '$P_4(1)\\approx2.708$.' },
        { par: { g: 6 }, es: '$P_6(1)\\approx2{,}7181$.', en: '$P_6(1)\\approx2.7181$.' },
        { par: { g: 8 }, es: '$P_8(1)\\approx2{,}71828$: coincide con $e$ en cinco decimales.', en: '$P_8(1)\\approx2.71828$: it matches $e$ to five decimals.' },
      ],
      es: 'En $x=1$, $P_n(1)=1+1+\\tfrac12+\\tfrac16+\\cdots$ es la forma de calcular $e$ a mano. Reproduce la traza: cada grado añade un término y el valor se acerca a $e\\approx2{,}71828$. En todo $x$ real la serie converge a $e^x$.',
      en: 'At $x=1$, $P_n(1)=1+1+\\tfrac12+\\tfrac16+\\cdots$ is how you compute $e$ by hand. Play the trace: each degree adds a term and the value approaches $e\\approx2.71828$. At every real $x$ the series converges to $e^x$.' },
    { par: { g: 5 },
      es: 'Con Lagrange y $M=e<3$ en $[0,1]$: $|R_n(1)|\\le\\dfrac3{(n+1)!}$. Para $n=5$ la cota es $\\tfrac3{720}\\approx0{,}0042$ y el error real, $0{,}0016$. Como $(n+1)!$ crece más rápido que cualquier potencia, $\\dfrac{x^{n+1}}{(n+1)!}\\to0$ para todo $x$: radio de convergencia **infinito**.',
      en: 'With Lagrange and $M=e<3$ on $[0,1]$: $|R_n(1)|\\le\\dfrac3{(n+1)!}$. For $n=5$ the bound is $\\tfrac3{720}\\approx0.0042$ and the real error is $0.0016$. Since $(n+1)!$ grows faster than any power, $\\dfrac{x^{n+1}}{(n+1)!}\\to0$ for every $x$: **infinite** radius of convergence.' },
    { par: { g: 5 },
      es: 'Para calcular $e$ con error menor que $0{,}001$ usando $|R_n(1)|\\le\\dfrac3{(n+1)!}$, ¿qué grado basta?',
      en: 'To compute $e$ with error below $0.001$ using $|R_n(1)|\\le\\dfrac3{(n+1)!}$, which degree is enough?',
      pregunta: {
        opc: [
          { es: '$n=3$', en: '$n=3$' },
          { es: '$n=5$', en: '$n=5$' },
          { es: '$n=6$', en: '$n=6$', ok: 1 },
        ],
        why: {
          es: 'Se pide $\\dfrac3{(n+1)!}<0{,}001$, es decir, $(n+1)!>3000$. Con $n=5$, $6!=720$ da cota $0{,}0042$: no basta. Con $n=6$, $7!=5040$ da $0{,}0006$: basta. Con $n=3$ la cota es $0{,}125$.',
          en: 'We need $\\dfrac3{(n+1)!}<0.001$, that is, $(n+1)!>3000$. With $n=5$, $6!=720$ gives a bound of $0.0042$: not enough. With $n=6$, $7!=5040$ gives $0.0006$: enough. With $n=3$ the bound is $0.125$.',
        },
      } },

    // ── 1/(1−x) ──
    { sec: { es: 'Radio de convergencia', en: 'Radius of convergence' },
      funcion: { x: [-2.5, 2.5], y: [-4, 6], curvas: [{ id: 'f', nombre: '1/(1−x)', f: F1 }], par: par0(F1, cg, 4, .5), arrastrar: 'x0',
        deslizadores: [{ par: 'g', min: 0, max: 20, paso: 1, es: 'Grado n', en: 'Degree n', dec: 0 }], capas: [TAY(cg), { tipo: 'asintota', x: 1 }],
        etiqueta: { es: 'Gráfica de 1/(1−x) con su asíntota y su polinomio de Taylor', en: 'Graph of 1/(1−x) with its asymptote and Taylor polynomial' } },
      es: '$\\dfrac1{1-x}$ cumple $f^{(k)}(0)=k!$, así que todos los coeficientes valen $1$: $\\dfrac1{1-x}=1+x+x^2+x^3+\\cdots$ Es la serie geométrica con $r=x$. La función no existe en $x=1$: asíntota vertical. Sube el grado y observa.',
      en: '$\\dfrac1{1-x}$ satisfies $f^{(k)}(0)=k!$, so every coefficient is $1$: $\\dfrac1{1-x}=1+x+x^2+x^3+\\cdots$ It is the geometric series with $r=x$. The function does not exist at $x=1$: vertical asymptote. Raise the degree and watch.' },
    { par: { g: 2 },
      traza: [
        { par: { g: 2 }, es: '$P_2=1+x+x^2$.', en: '$P_2=1+x+x^2$.' },
        { par: { g: 4 }, es: 'Dentro de $(-1,1)$ el polinomio ya se pega a la curva.', en: 'Inside $(-1,1)$ the polynomial already hugs the curve.' },
        { par: { g: 8 }, es: 'Fuera de $(-1,1)$ se aleja más con cada grado.', en: 'Outside $(-1,1)$ it moves further away with each degree.' },
        { par: { g: 14 } },
      ],
      es: 'Reproduce la traza. Entre $-1$ y $1$ los polinomios se acercan a $f$ al subir el grado; para $x>1$ o $x<-1$ ocurre lo contrario: oscilan o se disparan más cuanto mayor es $n$. La zona buena parece acabar justo en la asíntota.',
      en: 'Play the trace. Between $-1$ and $1$ the polynomials approach $f$ as the degree grows; for $x>1$ or $x<-1$ the opposite happens: they oscillate or blow up more the larger $n$ is. The good zone seems to end right at the asymptote.' },
    { par: { g: 6 }, capas: [TAY(cg), { tipo: 'asintota', x: 1 }, { tipo: 'linea', x1: -1, y1: -4, x2: -1, y2: 6 }, { tipo: 'texto', x: 0, y: 5.2, s: '|x| < 1', ancla: 'middle' }],
      es: 'El **radio de convergencia** $R$ dice hasta dónde converge la serie alrededor de $a$. Aquí $R=1$: converge si $|x|<1$ y diverge si $|x|>1$. Es la distancia de $a=0$ a la asíntota. En $x=-1$ la función es regular ($f(-1)=\\tfrac12$), pero la serie $1-1+1-\\cdots$ no converge.',
      en: 'The **radius of convergence** $R$ says how far the series converges around $a$. Here $R=1$: it converges if $|x|<1$ and diverges if $|x|>1$. It is the distance from $a=0$ to the asymptote. At $x=-1$ the function is regular ($f(-1)=\\tfrac12$), yet the series $1-1+1-\\cdots$ does not converge.' },
    { par: { g: 6 },
      es: 'Aquí el error es exacto: $P_n(x)=\\dfrac{1-x^{n+1}}{1-x}$, luego $\\dfrac1{1-x}-P_n(x)=\\dfrac{x^{n+1}}{1-x}$. Tiende a $0$ si $|x|<1$ y crece si $|x|>1$. En $x=0{,}5$ con $n=5$: $\\dfrac{0{,}5^6}{0{,}5}=0{,}03125$, es decir, $P_5=1{,}96875$ frente a $2$.',
      en: 'Here the error is exact: $P_n(x)=\\dfrac{1-x^{n+1}}{1-x}$, so $\\dfrac1{1-x}-P_n(x)=\\dfrac{x^{n+1}}{1-x}$. It tends to $0$ if $|x|<1$ and grows if $|x|>1$. At $x=0.5$ with $n=5$: $\\dfrac{0.5^6}{0.5}=0.03125$, that is, $P_5=1.96875$ versus $2$.' },
    { par: par0(F1, cg, 4, .5), capas: ERR(cg),
      es: 'Arrastra el punto dentro y fuera de $|x_0|<1$ y cambia el grado. En $x_0=0{,}9$ converge lentamente: error $3{,}1$ con $n=10$ y $1{,}1$ con $n=20$. En $x_0=1{,}5$ el error crece con $n$ en vez de bajar.',
      en: 'Drag the point inside and outside $|x_0|<1$ and change the degree. At $x_0=0.9$ it converges slowly: error $3.1$ with $n=10$ and $1.1$ with $n=20$. At $x_0=1.5$ the error grows with $n$ instead of shrinking.',
      jugar: {
        botones: [
          { label: { es: 'grado − 2', en: 'degree − 2' }, hacer: v => { v.g = Math.max(0, v.g - 2); sincG(v); }, off: v => v.g <= 0 },
          { label: { es: 'grado + 2', en: 'degree + 2' }, hacer: v => { v.g = Math.min(20, v.g + 2); sincG(v); }, off: v => v.g >= 20 },
          { label: 'x₀ = 0,5', hacer: v => { v.x0 = .5; sincG(v); } },
          { label: 'x₀ = 0,9', hacer: v => { v.x0 = .9; sincG(v); } },
          { label: 'x₀ = −0,5', hacer: v => { v.x0 = -.5; sincG(v); } },
          { label: 'x₀ = 1,5', hacer: v => { v.x0 = 1.5; sincG(v); } },
        ],
        lecturas: (v, cx) => [
          { expr: 'n', valor: cx.fmt(v.g) },
          { expr: 'x₀', valor: cx.fmt(v.x0) },
          { expr: 'P_n(x₀)', valor: cx.fmt(v.yb) },
          { expr: 'f(x₀)', valor: cx.fmt(F1(v.x0)) },
          { expr: { es: 'error', en: 'error' }, valor: cx.fmt(Math.abs(F1(v.x0) - v.yb)), malo: Math.abs(v.x0) >= 1 },
          { expr: '|x₀| < 1', valor: Math.abs(v.x0) < 1 ? '✓' : '✗', malo: Math.abs(v.x0) >= 1 },
        ],
        arrastrables: true, soltar: asigna(sincG),
      } },
    { par: { g: 6 }, capas: [TAY(cg), { tipo: 'asintota', x: 1 }],
      es: 'Para $\\dfrac1{1-2x}=\\displaystyle\\sum_{k=0}^{\\infty}(2x)^k$, ¿cuál es el radio de convergencia?',
      en: 'For $\\dfrac1{1-2x}=\\displaystyle\\sum_{k=0}^{\\infty}(2x)^k$, what is the radius of convergence?',
      pregunta: {
        opc: [
          { es: '$R=2$', en: '$R=2$' },
          { es: '$R=\\tfrac12$', en: '$R=\\tfrac12$', ok: 1 },
          { es: '$R=1$', en: '$R=1$' },
        ],
        why: {
          es: 'Es geométrica de razón $2x$: converge si $|2x|<1$, es decir, $|x|<\\tfrac12$. Coincide con la distancia de $0$ a la asíntota en $x=\\tfrac12$. $R=2$ invierte el cociente; $R=1$ ignora el factor $2$.',
          en: 'It is geometric with ratio $2x$: it converges if $|2x|<1$, that is, $|x|<\\tfrac12$. This matches the distance from $0$ to the asymptote at $x=\\tfrac12$. $R=2$ inverts the quotient; $R=1$ ignores the factor $2$.',
        },
      } },
    { par: { g: 6 },
      es: '**Resumen de Maclaurin.** $e^x$: coeficientes $1,1,\\tfrac12,\\tfrac16,\\tfrac1{24},\\dots$ y $R=\\infty$. $\\operatorname{sen}x$: $0,1,0,-\\tfrac16,0,\\tfrac1{120},\\dots$ y $R=\\infty$. $\\tfrac1{1-x}$: $1,1,1,1,\\dots$ y $R=1$. Siempre $c_k=\\tfrac{f^{(k)}(0)}{k!}$; el radio lo marca el punto problemático más cercano.',
      en: '**Maclaurin summary.** $e^x$: coefficients $1,1,\\tfrac12,\\tfrac16,\\tfrac1{24},\\dots$ and $R=\\infty$. $\\sin x$: $0,1,0,-\\tfrac16,0,\\tfrac1{120},\\dots$ and $R=\\infty$. $\\tfrac1{1-x}$: $1,1,1,1,\\dots$ and $R=1$. Always $c_k=\\tfrac{f^{(k)}(0)}{k!}$; the radius is set by the nearest problem point.' },
  ],
};
