// Guía «Límites y continuidad» (Cálculo I). Usa la escena `funcion` (formato en la cabecera de assets/guias/funcion.js).
// Las discontinuidades se dibujan con un pequeño hueco (NaN) alrededor del punto para que el trazo no una los dos lados.
const GAP = .009;
const salto = x => (Math.abs(x - 1) < GAP ? NaN : x < 1 ? x + 1 : 4 - x); // 2 por la izquierda, 3 por la derecha
const evitable = x => (x * x - 1) / (x - 1);
const infinita = x => (x === 1 ? NaN : 1 / ((x - 1) * (x - 1)));
const lineal = x => 2 * x - 1;
const cuadrada = x => x * x;
const racional = x => (2 * x + 1) / (x - 1);

// Escena 1: límites laterales de `salto` en x = 1
const V1 = { x: [-1, 3], y: [-1, 4] };
const LIN = { tipo: 'linea', x1: 1, y1: -5, x2: 1, y2: 5 };
const LATERALES = [LIN, { tipo: 'punto', c: 'f', x: 'xl' }, { tipo: 'punto', c: 'f', x: 'xr' }];
const SALTO = [LIN, { tipo: 'punto', x: 1, y: 1 }, { tipo: 'punto', x: 1, y: 2, abierto: true }, { tipo: 'punto', x: 1, y: 3, abierto: true },
  { tipo: 'texto', x: .92, y: 2.25, s: '$2$', ancla: 'end' }, { tipo: 'texto', x: 1.08, y: 3.25, s: '$3$' }, { tipo: 'texto', x: 1.08, y: .85, s: '$f(1)=1$' }];
const lado = (v, d) => { v.d = d; v.xl = +(1 - d).toFixed(5); v.xr = +(1 + d).toFixed(5); };

// Escena 3 y 4: ε-δ. `cabe` comprueba, muestreando, que f(x) queda a menos de ε de L para 0 < |x − a| < δ
const cabe = (v, cx, a, L) => {
  for (let i = -49; i <= 49; i++) { if (i && !(Math.abs(cx.f('f', a + v.delta * i / 50) - L) < v.eps)) return false; }
  for (const s of [-.9999, .9999]) if (!(Math.abs(cx.f('f', a + v.delta * s) - L) < v.eps)) return false;
  return true;
};

export default {
  titulo: { es: 'Límites y continuidad', en: 'Limits and continuity' },
  fuentes: [
    'Boelkins, M., Austin, D., & Schlicker, S. (2017). *Active calculus 2.0*. Grand Valley State University. https://open.umn.edu/opentextbooks/textbooks/active-calculus-2-0',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Jerison, D. (2010). *18.01SC Single variable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 1*. OpenStax. https://openstax.org/books/calculus-volume-1/pages/preface',
  ],
  pasos: [
    // ── Límites laterales ──
    { sec: { es: 'Límites laterales', en: 'One-sided limits' },
      funcion: { ...V1, curvas: [{ id: 'f', nombre: '$f(x)$', f: salto }], par: { xl: 0, xr: 2, d: 1 }, capas: LATERALES,
        etiqueta: { es: 'Gráfica de una función con un salto en x = 1', en: 'Graph of a function with a jump at x = 1' } },
      es: 'El límite no pregunta cuánto *vale* $f$ en un punto, sino hacia dónde *se dirige* cuando $x$ se acerca a él. Aquí $f(x)=x+1$ si $x<1$ y $f(x)=4-x$ si $x>1$. Dos puntos se acercan a $x=1$, uno desde cada lado.',
      en: 'A limit does not ask what $f$ *equals* at a point, but where it is *heading* as $x$ gets close to it. Here $f(x)=x+1$ for $x<1$ and $f(x)=4-x$ for $x>1$. Two points approach $x=1$, one from each side.' },
    { traza: [
        { par: { xl: .5, xr: 1.5 }, es: 'Con $x=0{,}5$ y $x=1{,}5$: alturas $1{,}5$ y $2{,}5$.', en: 'With $x=0.5$ and $x=1.5$: heights $1.5$ and $2.5$.' },
        { par: { xl: .9, xr: 1.1 }, es: 'Con $x=0{,}9$ y $x=1{,}1$: alturas $1{,}9$ y $2{,}9$.', en: 'With $x=0.9$ and $x=1.1$: heights $1.9$ and $2.9$.' },
        { par: { xl: .99, xr: 1.01 }, es: 'Con $x=0{,}99$ y $x=1{,}01$: alturas $1{,}99$ y $2{,}99$. Cada lado se estabiliza en un valor distinto.', en: 'With $x=0.99$ and $x=1.01$: heights $1.99$ and $2.99$. Each side settles on a different value.' },
      ],
      es: 'Reproduce la traza: el punto de la izquierda sube hacia la altura $2$ y el de la derecha baja hacia la altura $3$. Cada lado tiene un destino claro, pero **no es el mismo**.',
      en: 'Play the trace: the left point climbs toward height $2$ and the right one descends toward height $3$. Each side has a clear destination, but it is **not the same one**.' },
    { capas: SALTO,
      es: 'Escribimos $\\displaystyle\\lim_{x\\to1^-}f(x)=2$ y $\\displaystyle\\lim_{x\\to1^+}f(x)=3$. El límite **bilateral** existe solo si ambos laterales existen y son iguales. Aquí $2\\ne3$, así que $\\lim_{x\\to1}f(x)$ **no existe**, aunque $f(1)=1$ esté definida: ese valor no influye.',
      en: 'We write $\\displaystyle\\lim_{x\\to1^-}f(x)=2$ and $\\displaystyle\\lim_{x\\to1^+}f(x)=3$. The **two-sided** limit exists only if both one-sided limits exist and are equal. Here $2\\ne3$, so $\\lim_{x\\to1}f(x)$ **does not exist**, even though $f(1)=1$ is defined: that value plays no role.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, par: { d: 1, xl: 0, xr: 2 }, capas: LATERALES,
      es: 'Reduce $d$ con los botones y mira las lecturas: $f(1-d)$ se acerca a $2$ y $f(1+d)$ a $3$. La diferencia entre ambas no se achica: siempre vale $1$.',
      en: 'Shrink $d$ with the buttons and watch the readings: $f(1-d)$ approaches $2$ and $f(1+d)$ approaches $3$. The gap between them does not shrink: it is always $1$.',
      jugar: {
        botones: [
          { label: 'd ÷ 2', hacer: v => lado(v, +(v.d / 2).toFixed(5)), off: v => v.d <= .06 },
          { label: 'd × 2', hacer: v => lado(v, Math.min(1, v.d * 2)), off: v => v.d >= 1 },
          { label: 'd = 1', hacer: v => lado(v, 1) },
        ],
        lecturas: (v, cx) => [
          { expr: 'd', valor: cx.fmt(v.d) },
          { expr: 'f(1 − d)', valor: cx.fmt(cx.f('f', v.xl)) },
          { expr: 'f(1 + d)', valor: cx.fmt(cx.f('f', v.xr)) },
          { expr: 'f(1 + d) − f(1 − d)', valor: cx.fmt(cx.f('f', v.xr) - cx.f('f', v.xl)), malo: true },
        ],
      } },
    { es: 'Una función cumple $\\lim_{x\\to2^-}g(x)=5$, $\\lim_{x\\to2^+}g(x)=5$ y $g(2)=7$. ¿Qué afirmación es cierta?',
      en: 'A function satisfies $\\lim_{x\\to2^-}g(x)=5$, $\\lim_{x\\to2^+}g(x)=5$ and $g(2)=7$. Which statement is true?',
      pregunta: {
        opc: [
          { es: '$\\lim_{x\\to2}g(x)=7$, porque $g(2)=7$', en: '$\\lim_{x\\to2}g(x)=7$, because $g(2)=7$' },
          { es: '$\\lim_{x\\to2}g(x)=5$, pero $g$ no es continua en $2$', en: '$\\lim_{x\\to2}g(x)=5$, but $g$ is not continuous at $2$', ok: 1 },
          { es: 'El límite no existe, porque $g(2)\\ne5$', en: 'The limit does not exist, because $g(2)\\ne5$' },
        ],
        why: {
          es: 'El límite solo depende de lo que ocurre *cerca* de $2$, no *en* $2$: los laterales coinciden y valen $5$. Pero la continuidad exige $\\lim_{x\\to2}g(x)=g(2)$, y $5\\ne7$.',
          en: 'The limit depends only on what happens *near* $2$, not *at* $2$: the one-sided limits agree and equal $5$. But continuity requires $\\lim_{x\\to2}g(x)=g(2)$, and $5\\ne7$.',
        },
      } },

    // ── Continuidad ──
    { sec: { es: 'Continuidad', en: 'Continuity' }, capas: SALTO,
      es: '$f$ es **continua** en $a$ si (1) $f(a)$ existe, (2) $\\lim_{x\\to a}f(x)$ existe y (3) ambos coinciden: $\\lim_{x\\to a}f(x)=f(a)$. Gráficamente, se traza sin levantar el lápiz. La función de arriba falla la condición (2) en $x=1$.',
      en: '$f$ is **continuous** at $a$ if (1) $f(a)$ exists, (2) $\\lim_{x\\to a}f(x)$ exists and (3) they agree: $\\lim_{x\\to a}f(x)=f(a)$. Graphically, you can draw it without lifting the pencil. The function above fails condition (2) at $x=1$.' },
    { sec: { es: 'Tipos de discontinuidad', en: 'Types of discontinuity' },
      funcion: { x: [-2, 4], y: [-2, 6], curvas: [{ id: 'ev', nombre: '$f(x)$', f: evitable }, { id: 'sa', nombre: '$g(x)$', f: salto }, { id: 'inf', nombre: '$h(x)$', f: infinita }, { id: 'k', nombre: '$k(x)$', f: x => (x === 2 ? NaN : (x * x - 4) / (x - 2)) }],
        ver: ['ev'], capas: [{ tipo: 'punto', x: 1, y: 2, abierto: true }, { tipo: 'texto', x: 1.12, y: 1.8, s: '$(1,2)$' }],
        etiqueta: { es: 'Discontinuidad evitable en x = 1', en: 'Removable discontinuity at x = 1' } },
      es: '**Evitable**: el límite existe pero $f(a)$ no existe o vale otra cosa. $f(x)=\\dfrac{x^2-1}{x-1}=x+1$ para $x\\ne1$: el límite en $1$ es $2$ y falta un punto. Se repara definiendo $f(1)=2$.',
      en: '**Removable**: the limit exists but $f(a)$ does not exist or is something else. $f(x)=\\dfrac{x^2-1}{x-1}=x+1$ for $x\\ne1$: the limit at $1$ is $2$ and one point is missing. It is repaired by defining $f(1)=2$.' },
    { ver: ['sa'], capas: [LIN, { tipo: 'punto', x: 1, y: 3 }, { tipo: 'punto', x: 1, y: 2, abierto: true }],
      es: '**De salto**: existen ambos límites laterales, pero son distintos. Aquí $2$ por la izquierda y $3$ por la derecha, con $g(1)=3$: el salto mide $1$ y no se arregla cambiando un solo valor.',
      en: '**Jump**: both one-sided limits exist but differ. Here $2$ from the left and $3$ from the right, with $g(1)=3$: the jump has size $1$ and cannot be fixed by changing a single value.' },
    { ver: ['inf'], capas: [{ tipo: 'asintota', x: 1 }],
      es: '**Infinita**: algún límite lateral es $\\pm\\infty$. $h(x)=\\dfrac{1}{(x-1)^2}$ crece sin cota a ambos lados de $x=1$, una **asíntota vertical**. Hay una cuarta clase, la oscilante ($\\operatorname{sen}\\tfrac1x$ en $0$), que ni siquiera tiene laterales.',
      en: '**Infinite**: some one-sided limit is $\\pm\\infty$. $h(x)=\\dfrac{1}{(x-1)^2}$ grows without bound on both sides of $x=1$, a **vertical asymptote**. There is a fourth kind, the oscillating one ($\\sin\\tfrac1x$ at $0$), which has no one-sided limits at all.' },
    { ver: ['k'], capas: [], es: 'Clasifica la discontinuidad de $k(x)=\\dfrac{x^2-4}{x-2}$ en $x=2$.',
      en: 'Classify the discontinuity of $k(x)=\\dfrac{x^2-4}{x-2}$ at $x=2$.',
      pregunta: {
        opc: [
          { es: 'Evitable: el límite es $4$', en: 'Removable: the limit is $4$', ok: 1 },
          { es: 'De salto: los laterales son distintos', en: 'Jump: the one-sided limits differ' },
          { es: 'Infinita: hay una asíntota vertical en $x=2$', en: 'Infinite: there is a vertical asymptote at $x=2$' },
        ],
        why: {
          es: 'Factoriza: $\\dfrac{(x-2)(x+2)}{x-2}=x+2$ para $x\\ne2$, y $\\lim_{x\\to2}(x+2)=4$. El límite es finito y los laterales coinciden: solo falta el punto $(2,\\,4)$.',
          en: 'Factor it: $\\dfrac{(x-2)(x+2)}{x-2}=x+2$ for $x\\ne2$, and $\\lim_{x\\to2}(x+2)=4$. The limit is finite and the one-sided limits agree: only the point $(2,\\,4)$ is missing.',
        },
      } },

    // ── ε-δ ──
    { sec: { es: 'La definición ε-δ', en: 'The ε-δ definition' },
      funcion: { x: [0, 4], y: [-1.5, 7], curvas: [{ id: 'f', nombre: '$f(x)$', f: lineal }], par: { eps: 1, delta: .5 },
        capas: [{ tipo: 'epsdelta', x: 2, L: 3, eps: 'eps', delta: 'delta' }, { tipo: 'punto', c: 'f', x: 2, abierto: true }],
        deslizadores: [{ par: 'eps', min: .2, max: 2, paso: .05, es: 'Tolerancia ε', en: 'Tolerance ε' }, { par: 'delta', min: .02, max: 2, paso: .01, es: 'Distancia δ', en: 'Distance δ' }],
        etiqueta: { es: 'Banda ε alrededor de L = 3 y banda δ alrededor de x = 2', en: 'ε band around L = 3 and δ band around x = 2' } },
      es: '«Se acerca» era una intuición. La definición precisa: $\\lim_{x\\to a}f(x)=L$ si **para todo** $\\varepsilon>0$ existe $\\delta>0$ tal que $0<|x-a|<\\delta\\Rightarrow|f(x)-L|<\\varepsilon$. La banda horizontal es la tolerancia $\\varepsilon$; la vertical, la distancia $\\delta$.',
      en: '«Gets close» was an intuition. The precise definition: $\\lim_{x\\to a}f(x)=L$ if **for every** $\\varepsilon>0$ there is $\\delta>0$ such that $0<|x-a|<\\delta\\Rightarrow|f(x)-L|<\\varepsilon$. The horizontal band is the tolerance $\\varepsilon$; the vertical one, the distance $\\delta$.' },
    { par: { eps: 1, delta: .5 },
      es: 'Para $f(x)=2x-1$, $a=2$, $L=3$: $|f(x)-3|=|2x-4|=2|x-2|$. Es menor que $\\varepsilon$ cuando $|x-2|<\\varepsilon/2$. Basta $\\delta=\\varepsilon/2$: con $\\varepsilon=1$, $\\delta=0{,}5$. Cada $\\varepsilon$ exige su propio $\\delta$.',
      en: 'For $f(x)=2x-1$, $a=2$, $L=3$: $|f(x)-3|=|2x-4|=2|x-2|$. It is below $\\varepsilon$ when $|x-2|<\\varepsilon/2$. Taking $\\delta=\\varepsilon/2$ suffices: with $\\varepsilon=1$, $\\delta=0.5$. Each $\\varepsilon$ demands its own $\\delta$.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' }, par: { eps: 1, delta: 1.2 },
      es: 'Ajusta $\\delta$ (deslizador o botones) hasta que toda la curva dentro de la banda vertical quede dentro de la horizontal. Después reduce $\\varepsilon$ a la mitad: ¿qué le pasa al $\\delta$ que valía?',
      en: 'Adjust $\\delta$ (slider or buttons) until the whole curve inside the vertical band lies inside the horizontal one. Then halve $\\varepsilon$: what happens to the $\\delta$ that worked?',
      jugar: {
        botones: [
          { label: 'ε ÷ 2', hacer: v => { v.eps = Math.max(.2, +(v.eps / 2).toFixed(3)); }, off: v => v.eps <= .2 },
          { label: 'δ ÷ 2', hacer: v => { v.delta = Math.max(.02, +(v.delta / 2).toFixed(3)); }, off: v => v.delta <= .02 },
          { label: 'δ = ε/2', hacer: v => { v.delta = Math.min(2, Math.max(.02, +(v.eps / 2).toFixed(3))); } },
        ],
        lecturas: (v, cx) => [
          { expr: 'ε', valor: cx.fmt(v.eps) },
          { expr: 'δ', valor: cx.fmt(v.delta) },
          { expr: '|f(x) − 3| < ε', valor: cabe(v, cx, 2, 3) ? '✓' : '✗', malo: !cabe(v, cx, 2, 3) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { funcion: { x: [0, 2.5], y: [-.5, 4], curvas: [{ id: 'f', nombre: '$f(x)$', f: cuadrada }], par: { eps: .5, delta: .6 },
        capas: [{ tipo: 'epsdelta', x: 1, L: 1, eps: 'eps', delta: 'delta' }, { tipo: 'punto', c: 'f', x: 1, abierto: true }],
        deslizadores: [{ par: 'eps', min: .1, max: 1.5, paso: .05, es: 'Tolerancia ε', en: 'Tolerance ε' }, { par: 'delta', min: .02, max: 1, paso: .01, es: 'Distancia δ', en: 'Distance δ' }],
        etiqueta: { es: 'Banda ε y banda δ para x² en x = 1', en: 'ε and δ bands for x² at x = 1' } },
      es: 'Con $f(x)=x^2$, $a=1$, $L=1$ el $\\delta$ ya no es inmediato: $|x^2-1|=|x-1|\\,|x+1|$. Si $\\delta\\le1$, entonces $|x+1|<3$ y $|x^2-1|<3\\delta$. Basta $\\delta=\\min(1,\\varepsilon/3)$: para $\\varepsilon=0{,}5$, $\\delta\\approx0{,}17$.',
      en: 'With $f(x)=x^2$, $a=1$, $L=1$ the $\\delta$ is no longer immediate: $|x^2-1|=|x-1|\\,|x+1|$. If $\\delta\\le1$, then $|x+1|<3$ and $|x^2-1|<3\\delta$. Taking $\\delta=\\min(1,\\varepsilon/3)$ suffices: for $\\varepsilon=0.5$, $\\delta\\approx0.17$.' },
    { par: { eps: .5, delta: .6 },
      es: 'Busca $\\delta$ a ojo y compárala con la fórmula. La lectura «óptimo» es el mayor $\\delta$ posible: la fórmula $\\min(1,\\varepsilon/3)$ es una cota segura, no la mejor.',
      en: 'Find $\\delta$ by eye and compare it with the formula. The «optimal» reading is the largest possible $\\delta$: the formula $\\min(1,\\varepsilon/3)$ is a safe bound, not the best one.',
      jugar: {
        botones: [
          { label: 'ε ÷ 2', hacer: v => { v.eps = Math.max(.1, +(v.eps / 2).toFixed(3)); }, off: v => v.eps <= .1 },
          { label: 'δ ÷ 2', hacer: v => { v.delta = Math.max(.02, +(v.delta / 2).toFixed(3)); }, off: v => v.delta <= .02 },
          { label: 'δ = mín(1, ε/3)', hacer: v => { v.delta = Math.max(.02, +Math.min(1, v.eps / 3).toFixed(3)); } },
        ],
        lecturas: (v, cx) => [
          { expr: 'ε', valor: cx.fmt(v.eps) },
          { expr: 'δ', valor: cx.fmt(v.delta) },
          { expr: '|f(x) − 1| < ε', valor: cabe(v, cx, 1, 1) ? '✓' : '✗', malo: !cabe(v, cx, 1, 1) },
          { expr: 'δ óptimo / optimal', valor: cx.fmt(Math.min(Math.sqrt(1 + v.eps) - 1, 1 - Math.sqrt(Math.max(0, 1 - v.eps)))) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      } },
    { es: 'Un $\\delta$ funciona para $\\varepsilon=0{,}5$. Ahora exigimos más precisión: $\\varepsilon=0{,}1$. ¿Qué ocurre con ese $\\delta$?',
      en: 'A $\\delta$ works for $\\varepsilon=0.5$. Now we demand more precision: $\\varepsilon=0.1$. What happens to that $\\delta$?',
      pregunta: {
        opc: [
          { es: 'Sigue valiendo: si un $\\delta$ funciona, funciona siempre', en: 'It still works: if a $\\delta$ works, it always works' },
          { es: 'Puede dejar de valer: hay que buscar otro, normalmente menor', en: 'It may stop working: you must find another one, usually smaller', ok: 1 },
          { es: 'Es irrelevante: $\\delta$ no depende de $\\varepsilon$', en: 'It is irrelevant: $\\delta$ does not depend on $\\varepsilon$' },
        ],
        why: {
          es: 'La definición dice «para todo $\\varepsilon$ *existe* un $\\delta$»: el $\\delta$ depende de $\\varepsilon$. En $f(x)=2x-1$, $\\delta=\\varepsilon/2$: al pasar de $0{,}5$ a $0{,}1$, el $\\delta$ baja de $0{,}25$ a $0{,}05$.',
          en: 'The definition says «for every $\\varepsilon$ there *exists* a $\\delta$»: $\\delta$ depends on $\\varepsilon$. For $f(x)=2x-1$, $\\delta=\\varepsilon/2$: going from $0.5$ to $0.1$, $\\delta$ drops from $0.25$ to $0.05$.',
        },
      } },

    // ── Límites infinitos y asíntotas ──
    { sec: { es: 'Límites infinitos y asíntotas', en: 'Infinite limits and asymptotes' },
      funcion: { x: [-4, 6], y: [-6, 10], curvas: [{ id: 'f', nombre: '$f(x)$', f: racional }], par: { d: 1, xl: 0, xr: 2 }, capas: [{ tipo: 'asintota', x: 1 }],
        etiqueta: { es: 'Gráfica de (2x+1)/(x−1) con asíntota vertical en x = 1', en: 'Graph of (2x+1)/(x−1) with a vertical asymptote at x = 1' } },
      es: '$f(x)=\\dfrac{2x+1}{x-1}$ no está definida en $x=1$ y cerca de él se dispara: $\\displaystyle\\lim_{x\\to1^+}f(x)=+\\infty$ y $\\displaystyle\\lim_{x\\to1^-}f(x)=-\\infty$. No tiende a un número: crece sin cota. La recta $x=1$ es una **asíntota vertical**.',
      en: '$f(x)=\\dfrac{2x+1}{x-1}$ is undefined at $x=1$ and blows up near it: $\\displaystyle\\lim_{x\\to1^+}f(x)=+\\infty$ and $\\displaystyle\\lim_{x\\to1^-}f(x)=-\\infty$. It does not approach a number: it grows without bound. The line $x=1$ is a **vertical asymptote**.' },
    { capas: [{ tipo: 'asintota', x: 1 }, { tipo: 'punto', c: 'f', x: 'xl' }, { tipo: 'punto', c: 'f', x: 'xr' }], par: { d: 1, xl: 0, xr: 2 },
      es: 'Acerca los puntos: $f(1+d)=2+\\dfrac3d$ y $f(1-d)=2-\\dfrac3d$. Con $d=0{,}0625$ ya valen $50$ y $-46$, fuera de la ventana. «$\\infty$» no es un número: describe un comportamiento.',
      en: 'Bring the points closer: $f(1+d)=2+\\dfrac3d$ and $f(1-d)=2-\\dfrac3d$. With $d=0.0625$ they are already $50$ and $-46$, off the window. «$\\infty$» is not a number: it describes a behaviour.',
      jugar: {
        botones: [
          { label: 'd ÷ 2', hacer: v => lado(v, +(v.d / 2).toFixed(5)), off: v => v.d <= .0625 },
          { label: 'd × 2', hacer: v => lado(v, Math.min(1, v.d * 2)), off: v => v.d >= 1 },
          { label: 'd = 1', hacer: v => lado(v, 1) },
        ],
        lecturas: (v, cx) => [
          { expr: 'd', valor: cx.fmt(v.d) },
          { expr: 'f(1 + d)', valor: cx.fmt(cx.f('f', v.xr)) },
          { expr: 'f(1 − d)', valor: cx.fmt(cx.f('f', v.xl)), malo: cx.f('f', v.xl) < 0 },
        ],
      } },
    { capas: [{ tipo: 'asintota', x: 1 }, { tipo: 'asintota', y: 2 }], ventana: { x: [-40, 40], y: [-8, 12] },
      es: 'Si alejamos la vista, $x\\to\\pm\\infty$, la curva se pega a $y=2$: $f(100)=\\dfrac{201}{99}\\approx2{,}03$ y $f(-100)=\\dfrac{-199}{-101}\\approx1{,}97$. Dividiendo entre $x$: $\\displaystyle\\lim_{x\\to\\pm\\infty}\\dfrac{2+1/x}{1-1/x}=2$. Es una asíntota **horizontal**.',
      en: 'Zooming out, $x\\to\\pm\\infty$, the curve hugs $y=2$: $f(100)=\\dfrac{201}{99}\\approx2.03$ and $f(-100)=\\dfrac{-199}{-101}\\approx1.97$. Dividing by $x$: $\\displaystyle\\lim_{x\\to\\pm\\infty}\\dfrac{2+1/x}{1-1/x}=2$. It is a **horizontal** asymptote.' },
    { es: '¿Cuánto vale $\\displaystyle\\lim_{x\\to\\infty}\\dfrac{3x^2+1}{x^2-5}$?',
      en: 'What is $\\displaystyle\\lim_{x\\to\\infty}\\dfrac{3x^2+1}{x^2-5}$?',
      pregunta: {
        opc: [
          { es: '$0$, porque el denominador crece', en: '$0$, because the denominator grows' },
          { es: '$3$', en: '$3$', ok: 1 },
          { es: '$\\infty$, porque ambos crecen', en: '$\\infty$, because both grow' },
        ],
        why: {
          es: 'Divide arriba y abajo entre $x^2$: $\\dfrac{3+1/x^2}{1-5/x^2}\\to\\dfrac31=3$. Con el mismo grado en numerador y denominador, el límite es el cociente de los coeficientes principales.',
          en: 'Divide top and bottom by $x^2$: $\\dfrac{3+1/x^2}{1-5/x^2}\\to\\dfrac31=3$. With equal degree in numerator and denominator, the limit is the ratio of the leading coefficients.',
        },
      } },
  ],
};
