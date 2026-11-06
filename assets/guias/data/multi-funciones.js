// Guía «Funciones de varias variables» (Multivariable). Usa la escena `campo` (formato en la cabecera de assets/guias/campo.js).
// Plantilla de las guías multivariable: `modo` alterna nivel/superficie; `par` mueve capas; jugar = botones + lecturas + arrastre.
const bowl = (x, y) => x * x + y * y;
const silla = (x, y) => x * x - y * y;
const raro = (x, y) => (x === 0 && y === 0 ? NaN : x * y / (x * x + y * y)); // límite en (0,0) que NO existe
const V = { x: [-2, 2], y: [-2, 2] };
const camino = m => ({ tipo: 'camino', x: t => t, y: t => m * t, t: [-2, 2] });

export default {
  titulo: { es: 'Funciones de varias variables', en: 'Functions of several variables' },
  fuentes: [
    'Auroux, D. (2010). *18.02SC Multivariable calculus* (Fall 2010) [Course]. MIT OpenCourseWare. https://ocw.mit.edu/courses/18-02sc-multivariable-calculus-fall-2010/',
    'Dawkins, P. (n.d.). *Paul\'s online notes*. Lamar University. https://tutorial.math.lamar.edu/',
    'Strang, G., & Herman, E. (2016). *Calculus volume 3*. OpenStax. https://openstax.org/books/calculus-volume-3/pages/preface',
  ],
  pasos: [
    { sec: { es: 'Una superficie', en: 'A surface' },
      campo: { f: bowl, ...V, modo: 'superficie', par: { x0: 1, y0: 1 }, arrastrar: ['x0', 'y0'], capas: [],
        etiqueta: { es: 'Superficie z = x² + y²', en: 'Surface z = x² + y²' } },
      es: 'Una función de dos variables asigna una altura $z=f(x,y)$ a cada punto $(x,y)$ del plano. Su gráfica es una **superficie**. Esta es $f(x,y)=x^2+y^2$, un cuenco. **Arrastra** sobre la figura para girarla.',
      en: 'A function of two variables assigns a height $z=f(x,y)$ to each point $(x,y)$ of the plane. Its graph is a **surface**. This one is $f(x,y)=x^2+y^2$, a bowl. **Drag** the figure to rotate it.' },
    { capas: [{ tipo: 'punto', x: 'x0', y: 'y0' }],
      es: 'Cada punto de la superficie corresponde a un par $(x,y)$ de la base. Con $(1,\\,1)$ la altura es $f(1,1)=1^2+1^2=2$.',
      en: 'Each point of the surface corresponds to a pair $(x,y)$ on the base. At $(1,\\,1)$ the height is $f(1,1)=1^2+1^2=2$.' },
    { sec: { es: 'Curvas de nivel', en: 'Level curves' }, modo: 'nivel', capas: [{ tipo: 'punto', x: 'x0', y: 'y0' }],
      es: 'Mirar desde arriba y pintar por altura da un **mapa de nivel**. Una **curva de nivel** une los puntos con el mismo valor: $f(x,y)=c$. Aquí son circunferencias $x^2+y^2=c$. Juntas se ven más densas donde la superficie es más empinada.',
      en: 'Looking from above and colouring by height gives a **contour map**. A **level curve** joins the points with the same value: $f(x,y)=c$. Here they are circles $x^2+y^2=c$. They crowd together where the surface is steeper.' },
    { sec: { es: 'Pruébalo tú', en: 'Try it yourself' },
      jugar: {
        botones: [
          { label: { es: 'ir al origen', en: 'go to origin' }, hacer: v => { v.x0 = 0; v.y0 = 0; } },
          { label: { es: 'ir a (1, 1)', en: 'go to (1, 1)' }, hacer: v => { v.x0 = 1; v.y0 = 1; } },
          { label: { es: 'ir a (1,5, 0)', en: 'go to (1.5, 0)' }, hacer: v => { v.x0 = 1.5; v.y0 = 0; } },
        ],
        lecturas: (v, cx) => [
          { expr: '(x, y)', valor: `(${cx.fmt(v.x0)}, ${cx.fmt(v.y0)})` },
          { expr: 'f(x, y)', valor: cx.fmt(cx.f(v.x0, v.y0)) },
        ],
        arrastrables: true, soltar: (v, par, val) => { v[par] = val; },
      },
      es: 'Arrastra el punto por el mapa. ¿Qué puntos distintos dan exactamente la misma altura? Compruébalo con $(1,5,\\,0)$ y busca otro con el mismo valor: tiene que estar sobre la misma circunferencia.',
      en: 'Drag the point around the map. Which different points give exactly the same height? Check it with $(1.5,\\,0)$ and find another with the same value: it must lie on the same circle.' },
    { par: { x0: 1.5, y0: 0 },
      es: 'En $(1,5,\\,0)$ el valor es $2{,}25$. ¿Cuál de estos puntos está en la **misma curva de nivel**?',
      en: 'At $(1.5,\\,0)$ the value is $2.25$. Which of these points lies on the **same level curve**?',
      pregunta: {
        opc: [
          { es: '$(0,\\,1{,}5)$', en: '$(0,\\,1.5)$', ok: 1 },
          { es: '$(1{,}5,\\,1{,}5)$', en: '$(1.5,\\,1.5)$' },
          { es: '$(0{,}75,\\,0)$', en: '$(0.75,\\,0)$' },
        ],
        why: {
          es: '$f(0,\\,1{,}5)=0+2{,}25=2{,}25$. En cambio $f(1{,}5,\\,1{,}5)=4{,}5$ y $f(0{,}75,\\,0)=0{,}5625$. Misma curva de nivel = mismo valor de $f$.',
          en: '$f(0,\\,1.5)=0+2.25=2.25$. By contrast $f(1.5,\\,1.5)=4.5$ and $f(0.75,\\,0)=0.5625$. Same level curve = same value of $f$.',
        },
      } },

    { sec: { es: 'Una silla', en: 'A saddle' },
      campo: { f: silla, ...V, modo: 'superficie', par: { x0: 0, y0: 0 }, capas: [{ tipo: 'punto', x: 'x0', y: 'y0' }],
        etiqueta: { es: 'Superficie z = x² − y²', en: 'Surface z = x² − y²' } },
      es: 'Con $f(x,y)=x^2-y^2$ el origen tiene altura $0$ pero **no es un mínimo ni un máximo**: en la dirección de $x$ la superficie sube y en la de $y$ baja. Es una **silla de montar**. Gírala.',
      en: 'With $f(x,y)=x^2-y^2$ the origin has height $0$ but it is **neither a minimum nor a maximum**: along $x$ the surface rises and along $y$ it falls. It is a **saddle**. Rotate it.' },
    { modo: 'nivel',
      es: 'Sus curvas de nivel son **hipérbolas** $x^2-y^2=c$, y la de nivel $0$ son dos rectas que se cruzan, $y=\\pm x$. Ese cruce de curvas de nivel es la firma de una silla.',
      en: 'Its level curves are **hyperbolas** $x^2-y^2=c$, and the level-$0$ curve is a pair of crossing lines, $y=\\pm x$. That crossing of level curves is the signature of a saddle.' },

    // ── Límites ──
    { sec: { es: 'Límites en el plano', en: 'Limits in the plane' },
      campo: { f: raro, ...V, z: [-.6, .6], modo: 'superficie', par: { x0: 0, y0: 0 }, capas: [camino(0), camino(1), camino(-1)],
        etiqueta: { es: 'Superficie z = xy/(x² + y²)', en: 'Surface z = xy/(x² + y²)' } },
      es: 'En una variable solo hay dos lados para acercarse a un punto; en el plano hay **infinitos caminos**. Para que $\\lim_{(x,y)\\to(0,0)}f$ exista, **todos** deben dar el mismo valor. Probemos con $f(x,y)=\\dfrac{xy}{x^2+y^2}$ por las rectas $y=mx$.',
      en: 'In one variable there are only two sides to approach a point; in the plane there are **infinitely many paths**. For $\\lim_{(x,y)\\to(0,0)}f$ to exist, **all** of them must give the same value. Let us try $f(x,y)=\\dfrac{xy}{x^2+y^2}$ along the lines $y=mx$.' },
    { capas: [camino(0)],
      es: 'Por $y=0$ (el eje $x$): $f(x,0)=\\dfrac{0}{x^2}=0$. El límite por este camino es $0$.',
      en: 'Along $y=0$ (the $x$-axis): $f(x,0)=\\dfrac{0}{x^2}=0$. The limit along this path is $0$.' },
    { capas: [camino(0), camino(1)],
      es: 'Por $y=x$: $f(x,x)=\\dfrac{x^2}{2x^2}=\\dfrac12$. ¡Otro valor! Dos caminos con límites distintos bastan para concluir que **el límite no existe**.',
      en: 'Along $y=x$: $f(x,x)=\\dfrac{x^2}{2x^2}=\\dfrac12$. A different value! Two paths with different limits are enough to conclude that **the limit does not exist**.' },
    { capas: [camino(0), camino(1), camino(-1)], modo: 'nivel',
      es: 'Por $y=-x$ sale $-\\tfrac12$. En general, por $y=mx$: $f=\\dfrac{m}{1+m^2}$, que depende de $m$. En el mapa de nivel se ve: todas las curvas de nivel **pasan por el origen**, cada una con su valor.',
      en: 'Along $y=-x$ you get $-\\tfrac12$. In general, along $y=mx$: $f=\\dfrac{m}{1+m^2}$, which depends on $m$. On the contour map you can see it: every level curve **passes through the origin**, each with its own value.',
      pregunta: {
        opc: [
          { es: 'Existe y vale $0$, porque por el eje $x$ da $0$', en: 'It exists and equals $0$, because along the $x$-axis it gives $0$' },
          { es: 'No existe: por $y=0$ da $0$ y por $y=x$ da $\\tfrac12$', en: 'It does not exist: along $y=0$ it gives $0$ and along $y=x$ it gives $\\tfrac12$', ok: 1 },
          { es: 'Existe y vale $\\tfrac12$, el mayor de los valores', en: 'It exists and equals $\\tfrac12$, the largest of the values' },
        ],
        why: {
          es: 'Comprobar *algunos* caminos solo sirve para **refutar**: si dos difieren, no hay límite. Para demostrar que sí existe hace falta una cota válida para todos los caminos a la vez.',
          en: 'Checking *some* paths only serves to **refute**: if two differ, there is no limit. To prove it exists you need a bound valid for all paths at once.',
        },
      } },
  ],
};
