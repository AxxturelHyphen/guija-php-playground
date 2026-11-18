// Guía «Espacios vectoriales e independencia lineal» (Álgebra lineal, lección 3). Sigue MML §2.4 (grupos, espacios y subespacios
// vectoriales) y §2.5 (combinación lineal, independencia lineal). Escena `vectores` (formato en la cabecera de
// assets/guias/vectores.js); formato de los pasos en data/punteros.js. Notación MML: escalares en cursiva, vectores en negrita
// minúscula, matrices en negrita mayúscula (\bm = \boldsymbol en KaTeX; más corto para el límite de texto por paso).
const B = x => `\\bm{${x}}`;
const U = B('u'), V = B('v'), W = B('w'), X = B('x'), Y = B('y'), Z = B('0'), A = B('A'), b = B('b');
const par = { a: 1, b: 1, l: 1.5 };
const DESL = [
  { par: 'a', min: -3, max: 3, paso: .05, es: 'Coeficiente $\\lambda_1$', en: 'Coefficient $\\lambda_1$', dec: 2 },
  { par: 'b', min: -3, max: 3, paso: .05, es: 'Coeficiente $\\lambda_2$', en: 'Coefficient $\\lambda_2$', dec: 2 },
  { par: 'l', min: -2.5, max: 2.5, paso: .1, es: 'Escalar $\\lambda$', en: 'Scalar $\\lambda$', dec: 1 },
];
const FU = { tipo: 'flecha', a: 'u' }, FV = { tipo: 'flecha', a: 'v' }, FW = { tipo: 'flecha', a: 'w' };
const COMB = { tipo: 'comb', coef: ['a', 'b'], vecs: ['u', 'v'], nombre: `$\\lambda_1${U}+\\lambda_2${V}$` };
const SUMA = { tipo: 'comb', coef: [1, 1], vecs: ['u', 'v'], nombre: `$${U}+${V}$` };
const SPAN = { tipo: 'span', vecs: ['u', 'v'] };
const OBJ = { tipo: 'punto', x: 3, y: -2, nombre: '$(3,-2)$', abierto: true };
const SUB = [{ tipo: 'span', vecs: ['u'] }, FU, { tipo: 'comb', coef: ['l'], vecs: ['u'], nombre: `$\\lambda${U}$` }, { tipo: 'recta', a: 1, b: -2, c: -2, nombre: '$y=\\tfrac{x}{2}+1$' }];

const p2 = (cx, p) => `(${cx.fmt(p[0])} ; ${cx.fmt(p[1])})`;
const soltar = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };
const cerca = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6;
const RESET = { label: { es: 'u y v de nuevo', en: 'reset u and v' }, hacer: v => { v.vec.u = [2, 1]; v.vec.v = [-1, 1.5]; } };

export default {
  titulo: { es: 'Espacios vectoriales e independencia lineal', en: 'Vector spaces and linear independence' },
  fuentes: [
    'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com',
  ],
  pasos: [
    // ── Motivación ──
    { sec: { es: 'Qué problema resuelve', en: 'What problem this solves' },
      vectores: { x: [-4, 4], y: [-3, 3.4], vec: { u: [2, 1], v: [-1, 1.5], w: [1, 3] }, par, arrastrar: ['u', 'v'], paso: .25, deslizadores: DESL,
        capas: [FU, FV, SUMA], etiqueta: { es: 'Plano con vectores arrastrables u y v', en: 'Plane with draggable vectors u and v' } },
      es: 'En la introducción, un vector era «algo que se suma y se escala». Para usar esa idea con listas de números, matrices, polinomios o señales hay que fijar **exactamente** qué reglas cumplen la suma y el escalado. Así, lo que se demuestre una vez valdrá para todos esos objetos a la vez (MML §2.4).',
      en: 'In the introduction, a vector was "something you can add and scale". To use that idea with lists of numbers, matrices, polynomials or signals, we must fix **exactly** which rules addition and scaling obey. Then whatever is proved once holds for all of those objects at the same time (MML §2.4).' },
    { es: 'La respuesta ingenua, «un vector es una lista de números», falla por dos lados. Deja fuera objetos que se comportan igual, como una matriz $2\\times3$ o un polinomio. Y no dice qué operaciones son legítimas: en NumPy, `a * b` multiplica componente a componente, pero eso **no** es una operación de espacio vectorial. Lo que define a un vector son sus operaciones, no su forma.',
      en: 'The naive answer, "a vector is a list of numbers", fails on two fronts. It leaves out objects that behave the same way, such as a $2\\times3$ matrix or a polynomial. And it does not say which operations are legitimate: in NumPy, `a * b` multiplies component-wise, but that is **not** a vector-space operation. What defines a vector is its operations, not its shape.' },

    // ── MML §2.4.1 Grupos (solo lo necesario) ──
    { sec: { es: 'Grupos: la mitad de la definición', en: 'Groups: half of the definition' },
      es: '**Def. 2.7 (grupo, MML §2.4.1).** Sea $\\mathcal{G}$ un conjunto con una operación $\\otimes:\\mathcal{G}\\times\\mathcal{G}\\to\\mathcal{G}$. $G=(\\mathcal{G},\\otimes)$ es un **grupo** si cumple: (1) **clausura**: $\\forall x,y\\in\\mathcal{G}:\\;x\\otimes y\\in\\mathcal{G}$; (2) **asociatividad**: $(x\\otimes y)\\otimes z=x\\otimes(y\\otimes z)$.',
      en: '**Def. 2.7 (group, MML §2.4.1).** Let $\\mathcal{G}$ be a set with an operation $\\otimes:\\mathcal{G}\\times\\mathcal{G}\\to\\mathcal{G}$. $G=(\\mathcal{G},\\otimes)$ is a **group** if: (1) **closure**: $\\forall x,y\\in\\mathcal{G}:\\;x\\otimes y\\in\\mathcal{G}$; (2) **associativity**: $(x\\otimes y)\\otimes z=x\\otimes(y\\otimes z)$.' },
    { es: '(3) **Elemento neutro**: $\\exists e\\in\\mathcal{G}\\;\\forall x:\\;x\\otimes e=x$ y $e\\otimes x=x$. (4) **Inverso**: $\\forall x\\;\\exists y:\\;x\\otimes y=e$ y $y\\otimes x=e$; se escribe $x^{-1}$. Si además $x\\otimes y=y\\otimes x$ para todo par, el grupo es **abeliano** (conmutativo). Ojo: el inverso se define respecto a $\\otimes$, no significa $1/x$.',
      en: '(3) **Neutral element**: $\\exists e\\in\\mathcal{G}\\;\\forall x:\\;x\\otimes e=x$ and $e\\otimes x=x$. (4) **Inverse**: $\\forall x\\;\\exists y:\\;x\\otimes y=e$ and $y\\otimes x=e$; written $x^{-1}$. If also $x\\otimes y=y\\otimes x$ for every pair, the group is **Abelian** (commutative). Careful: the inverse is defined with respect to $\\otimes$, it does not mean $1/x$.' },
    { es: 'Ejemplos (MML §2.4.1). $(\\mathbb{Z},+)$ es abeliano. $(\\mathbb{N}_0,+)$ **no** es grupo: tiene neutro $0$, pero $3$ no tiene opuesto. $(\\mathbb{R},\\cdot)$ tampoco, porque $0$ no tiene inverso; $(\\mathbb{R}\\setminus\\{0\\},\\cdot)$ sí lo es. $(\\mathbb{R}^n,+)$, con la suma componente a componente, es abeliano: su neutro es $' + Z + '$ y el opuesto de $' + X + '$ es $-' + X + '$.',
      en: 'Examples (MML §2.4.1). $(\\mathbb{Z},+)$ is Abelian. $(\\mathbb{N}_0,+)$ is **not** a group: it has the neutral $0$, but $3$ has no opposite. Neither is $(\\mathbb{R},\\cdot)$, because $0$ has no inverse; $(\\mathbb{R}\\setminus\\{0\\},\\cdot)$ is. $(\\mathbb{R}^n,+)$ with component-wise addition is Abelian: its neutral is $' + Z + '$ and the opposite of $' + X + '$ is $-' + X + '$.' },
    { es: 'Las matrices $n\\times n$ **invertibles** con el producto de matrices forman el **grupo lineal general** $GL(n,\\mathbb{R})$ (Def. 2.8). El neutro es $' + B('I') + '_n$ y el inverso de $' + A + '$ es $' + A + '^{-1}$. No es abeliano, porque en general $' + A + B('B') + '\\neq' + B('B') + A + '$. Sin la condición de invertibles, $(\\mathbb{R}^{n\\times n},\\cdot)$ no es grupo.',
      en: 'The **invertible** $n\\times n$ matrices under matrix multiplication form the **general linear group** $GL(n,\\mathbb{R})$ (Def. 2.8). The neutral is $' + B('I') + '_n$ and the inverse of $' + A + '$ is $' + A + '^{-1}$. It is not Abelian, because in general $' + A + B('B') + '\\neq' + B('B') + A + '$. Without the invertibility condition, $(\\mathbb{R}^{n\\times n},\\cdot)$ is not a group.' },
    { es: '¿Cuál de estos es un grupo?',
      en: 'Which of these is a group?',
      pregunta: {
        opc: [
          { es: '$(\\mathbb{Z},\\cdot)$', en: '$(\\mathbb{Z},\\cdot)$' },
          { es: '$(\\mathbb{R}\\setminus\\{0\\},\\cdot)$', en: '$(\\mathbb{R}\\setminus\\{0\\},\\cdot)$', ok: 1 },
          { es: '$(\\mathbb{N}_0,+)$', en: '$(\\mathbb{N}_0,+)$' },
        ],
        why: {
          es: 'En $(\\mathbb{Z},\\cdot)$ el neutro es $1$, pero $2$ no tiene inverso entero ($\\tfrac12\\notin\\mathbb{Z}$). En $(\\mathbb{N}_0,+)$ faltan los opuestos. En $(\\mathbb{R}\\setminus\\{0\\},\\cdot)$ se cumplen los cuatro axiomas: el producto de no nulos es no nulo, el neutro es $1$ y el inverso de $x$ es $1/x$.',
          en: 'In $(\\mathbb{Z},\\cdot)$ the neutral is $1$, but $2$ has no integer inverse ($\\tfrac12\\notin\\mathbb{Z}$). In $(\\mathbb{N}_0,+)$ the opposites are missing. In $(\\mathbb{R}\\setminus\\{0\\},\\cdot)$ all four axioms hold: a product of nonzeros is nonzero, the neutral is $1$ and the inverse of $x$ is $1/x$.',
        },
      } },

    // ── MML §2.4.2 Espacio vectorial ──
    { sec: { es: 'Espacio vectorial', en: 'Vector space' },
      es: '**Def. 2.9 (espacio vectorial real, MML §2.4.2).** $V=(\\mathcal{V},+,\\cdot)$ es un conjunto $\\mathcal{V}$ con una operación **interna** $+:\\mathcal{V}\\times\\mathcal{V}\\to\\mathcal{V}$ y una **externa** $\\cdot:\\mathbb{R}\\times\\mathcal{V}\\to\\mathcal{V}$ que cumplen cuatro condiciones. La primera: (1) $(\\mathcal{V},+)$ es un **grupo abeliano**.',
      en: '**Def. 2.9 (real vector space, MML §2.4.2).** $V=(\\mathcal{V},+,\\cdot)$ is a set $\\mathcal{V}$ with an **inner** operation $+:\\mathcal{V}\\times\\mathcal{V}\\to\\mathcal{V}$ and an **outer** one $\\cdot:\\mathbb{R}\\times\\mathcal{V}\\to\\mathcal{V}$ that satisfy four conditions. The first: (1) $(\\mathcal{V},+)$ is an **Abelian group**.' },
    { es: 'Para todo $\\lambda,\\psi\\in\\mathbb{R}$ y $' + X + ',' + Y + '\\in\\mathcal{V}$: (2) **distributividad**: $\\lambda\\cdot(' + X + '+' + Y + ')=\\lambda\\cdot' + X + '+\\lambda\\cdot' + Y + '$ y $(\\lambda+\\psi)\\cdot' + X + '=\\lambda\\cdot' + X + '+\\psi\\cdot' + X + '$; (3) **asociatividad externa**: $\\lambda\\cdot(\\psi\\cdot' + X + ')=(\\lambda\\psi)\\cdot' + X + '$; (4) **neutro externo**: $1\\cdot' + X + '=' + X + '$.',
      en: 'For all $\\lambda,\\psi\\in\\mathbb{R}$ and $' + X + ',' + Y + '\\in\\mathcal{V}$: (2) **distributivity**: $\\lambda\\cdot(' + X + '+' + Y + ')=\\lambda\\cdot' + X + '+\\lambda\\cdot' + Y + '$ and $(\\lambda+\\psi)\\cdot' + X + '=\\lambda\\cdot' + X + '+\\psi\\cdot' + X + '$; (3) **outer associativity**: $\\lambda\\cdot(\\psi\\cdot' + X + ')=(\\lambda\\psi)\\cdot' + X + '$; (4) **outer neutral**: $1\\cdot' + X + '=' + X + '$.' },
    { es: 'Vocabulario (MML §2.4.2): los elementos de $\\mathcal{V}$ son **vectores**; el neutro de $+$ es el **vector nulo** $' + Z + '$; $+$ es la **suma de vectores**; los $\\lambda\\in\\mathbb{R}$ son **escalares** y $\\cdot$ es la **multiplicación por escalares**. «Interna» y «externa» solo dicen de dónde salen los operandos. No tienen que ver con el producto interior ni con el exterior.',
      en: 'Vocabulary (MML §2.4.2): the elements of $\\mathcal{V}$ are **vectors**; the neutral of $+$ is the **zero vector** $' + Z + '$; $+$ is **vector addition**; the $\\lambda\\in\\mathbb{R}$ are **scalars** and $\\cdot$ is **multiplication by scalars**. "Inner" and "outer" only say where the operands come from. They have nothing to do with the inner or the outer product.' },
    { capas: [FU, FV, { tipo: 'comb', coef: ['l', 'l'], vecs: ['u', 'v'], nombre: `$\\lambda${U}+\\lambda${V}$` }],
      es: 'Comprueba un axioma. La escena dibuja $\\lambda' + U + '+\\lambda' + V + '$ cabeza con cola. Mueve $\\lambda$ y arrastra $' + U + '$ y $' + V + '$: el extremo coincide siempre con $\\lambda(' + U + '+' + V + ')$, que es la diagonal escalada. Es la distributividad (2): escalar el paralelogramo entero equivale a escalar cada lado.',
      en: 'Check one axiom. The scene draws $\\lambda' + U + '+\\lambda' + V + '$ head to tail. Move $\\lambda$ and drag $' + U + '$ and $' + V + '$: the tip always lands on $\\lambda(' + U + '+' + V + ')$, the scaled diagonal. That is distributivity (2): scaling the whole parallelogram is the same as scaling each side.',
      jugar: {
        botones: [
          { label: 'λ = −1', hacer: v => { v.l = -1; } },
          { label: 'λ = 0', hacer: v => { v.l = 0; } },
          { label: 'λ = 2', hacer: v => { v.l = 2; } },
        ],
        lecturas: (v, cx) => {
          const s = cx.comb([1, 1], [v.vec.u, v.vec.v]), izq = cx.comb([v.l], [s]), der = cx.comb([v.l, v.l], [v.vec.u, v.vec.v]);
          return [
            { expr: `$\\lambda(${U}+${V})$`, valor: p2(cx, izq) },
            { expr: `$\\lambda${U}+\\lambda${V}$`, valor: p2(cx, der) },
            { expr: { es: '¿iguales?', en: 'equal?' }, valor: cerca(izq, der) ? '✓' : '✗', malo: !cerca(izq, der) },
          ];
        },
        arrastrables: true, soltar,
      } },
    { capas: [FU, FV, SUMA],
      es: '**Aviso (MML §2.4.2).** No existe un «producto de vectores» $' + B('a') + b + '$ en $\\mathbb{R}^n$. El producto componente a componente $c_j=a_jb_j$ es habitual al programar, pero no forma parte de la estructura. Tratando los vectores como matrices $n\\times1$, solo están definidos $' + B('a') + b + '^\\top\\in\\mathbb{R}^{n\\times n}$ (**producto exterior**) y $' + B('a') + '^\\top' + b + '\\in\\mathbb{R}$ (**producto escalar**, §3.2).',
      en: '**Warning (MML §2.4.2).** There is no "vector product" $' + B('a') + b + '$ in $\\mathbb{R}^n$. The component-wise product $c_j=a_jb_j$ is common in programming, but it is not part of the structure. Treating vectors as $n\\times1$ matrices, only $' + B('a') + b + '^\\top\\in\\mathbb{R}^{n\\times n}$ (**outer product**) and $' + B('a') + '^\\top' + b + '\\in\\mathbb{R}$ (**dot product**, §3.2) are defined.' },

    // ── Ejemplos y contraejemplos ──
    { sec: { es: 'Ejemplos', en: 'Examples' },
      es: 'Son espacios vectoriales (MML §2.4.2): $\\mathbb{R}^n$ con las operaciones componente a componente; $\\mathbb{R}^{m\\times n}$, con $' + A + '+' + B('B') + '$ y $\\lambda' + A + '$ entrada a entrada (equivale a $\\mathbb{R}^{mn}$, §2.7); $\\mathbb{C}$; y los polinomios de grado $\\le d$. Por defecto $' + X + '\\in\\mathbb{R}^n$ es una **columna**, y $' + X + '^\\top$ es la fila correspondiente.',
      en: 'These are vector spaces (MML §2.4.2): $\\mathbb{R}^n$ with component-wise operations; $\\mathbb{R}^{m\\times n}$, with $' + A + '+' + B('B') + '$ and $\\lambda' + A + '$ entry by entry (equivalent to $\\mathbb{R}^{mn}$, §2.7); $\\mathbb{C}$; and polynomials of degree $\\le d$. By default $' + X + '\\in\\mathbb{R}^n$ is a **column**, and $' + X + '^\\top$ is the matching row.' },
    { sec: { es: 'Contraejemplos', en: 'Counterexamples' },
      es: 'Ejemplos propios de lo que **no** es un espacio vectorial. (a) Los polinomios de grado **exactamente** 2: $(x^2+1)+(-x^2)=1$ tiene grado 0, así que falla la clausura. (b) La recta $y=x+1$ con las operaciones usuales, porque no contiene $' + Z + '$. (c) $\\mathbb{R}^2$ con la suma usual y el escalado $\\lambda\\odot(x,y)=(\\lambda x,\\,y)$: falla un axioma.',
      en: 'Examples of our own of what is **not** a vector space. (a) Polynomials of degree **exactly** 2: $(x^2+1)+(-x^2)=1$ has degree 0, so closure fails. (b) The line $y=x+1$ with the usual operations, because it does not contain $' + Z + '$. (c) $\\mathbb{R}^2$ with the usual addition and the scaling $\\lambda\\odot(x,y)=(\\lambda x,\\,y)$: one axiom fails.' },
    { deriva: {
        pregunta: { es: 'Con $\\lambda\\odot(x,y)=(\\lambda x,\\,y)$, ¿qué axioma de la Def. 2.9 falla?', en: 'With $\\lambda\\odot(x,y)=(\\lambda x,\\,y)$, which axiom of Def. 2.9 fails?' },
        opciones: [
          { es: '$(\\lambda+\\psi)\\odot' + X + '=\\lambda\\odot' + X + '+\\psi\\odot' + X + '$', en: '$(\\lambda+\\psi)\\odot' + X + '=\\lambda\\odot' + X + '+\\psi\\odot' + X + '$' },
          { es: '$1\\odot' + X + '=' + X + '$', en: '$1\\odot' + X + '=' + X + '$' },
          { es: 'Ninguno: es un espacio vectorial', en: 'None: it is a vector space' },
        ], correcta: 0,
        razones: [
          { es: 'A la izquierda la $y$ aparece una vez; a la derecha, sumada dos veces', en: 'On the left $y$ appears once; on the right, added twice' },
          { es: 'Multiplicar por 1 cambia la segunda componente', en: 'Multiplying by 1 changes the second component' },
          { es: 'Basta con que la suma sea un grupo abeliano', en: 'It is enough for addition to be an Abelian group' },
        ], razonCorrecta: 0,
        pistas: [{ es: 'Calcula los dos lados con $\\lambda=\\psi=1$ y $' + X + '=(0,1)$.', en: 'Compute both sides with $\\lambda=\\psi=1$ and $' + X + '=(0,1)$.' }],
        revela: { es: '$(\\lambda+\\psi)\\odot(x,y)=((\\lambda+\\psi)x,\\,y)$, pero $\\lambda\\odot(x,y)+\\psi\\odot(x,y)=((\\lambda+\\psi)x,\\,2y)$. Con $y\\neq0$ no coinciden. En cambio, $1\\odot(x,y)=(x,y)$ sí se cumple. Por eso hay que comprobar **todos** los axiomas: que se cumplan unos no garantiza los demás.', en: '$(\\lambda+\\psi)\\odot(x,y)=((\\lambda+\\psi)x,\\,y)$, but $\\lambda\\odot(x,y)+\\psi\\odot(x,y)=((\\lambda+\\psi)x,\\,2y)$. With $y\\neq0$ they differ. On the other hand, $1\\odot(x,y)=(x,y)$ does hold. That is why **every** axiom must be checked: some holding does not guarantee the rest.' },
      },
      es: 'Falla la distributividad respecto a la suma de escalares. Con $\\lambda=\\psi=1$ y $' + X + '=(0,1)$: $2\\odot(0,1)=(0,1)$, pero $(0,1)+(0,1)=(0,2)$.',
      en: 'Distributivity over the sum of scalars fails. With $\\lambda=\\psi=1$ and $' + X + '=(0,1)$: $2\\odot(0,1)=(0,1)$, but $(0,1)+(0,1)=(0,2)$.' },

    // ── MML §2.4.3 Subespacios ──
    { sec: { es: 'Subespacios vectoriales', en: 'Vector subspaces' }, capas: SUB,
      es: '**Def. 2.10 (subespacio, MML §2.4.3).** Sean $V$ un espacio vectorial y $\\mathcal{U}\\subseteq\\mathcal{V}$, $\\mathcal{U}\\neq\\emptyset$. $U=(\\mathcal{U},+,\\cdot)$ es un **subespacio** (o subespacio lineal) de $V$ si es un espacio vectorial con las operaciones de $V$ restringidas a $\\mathcal{U}\\times\\mathcal{U}$ y $\\mathbb{R}\\times\\mathcal{U}$. Se escribe $U\\subseteq V$.',
      en: '**Def. 2.10 (subspace, MML §2.4.3).** Let $V$ be a vector space and $\\mathcal{U}\\subseteq\\mathcal{V}$, $\\mathcal{U}\\neq\\emptyset$. $U=(\\mathcal{U},+,\\cdot)$ is a **subspace** (or linear subspace) of $V$ if it is a vector space with the operations of $V$ restricted to $\\mathcal{U}\\times\\mathcal{U}$ and $\\mathbb{R}\\times\\mathcal{U}$. We write $U\\subseteq V$.' },
    { es: 'Los axiomas que empiezan por «para todo» se heredan de $V$. En la práctica basta con comprobar tres cosas: (1) $' + Z + '\\in\\mathcal{U}$; (2a) **clausura externa**: $\\forall\\lambda\\in\\mathbb{R}\\;\\forall' + X + '\\in\\mathcal{U}:\\;\\lambda' + X + '\\in\\mathcal{U}$; (2b) **clausura interna**: $\\forall' + X + ',' + Y + '\\in\\mathcal{U}:\\;' + X + '+' + Y + '\\in\\mathcal{U}$.',
      en: 'The "for all" axioms are inherited from $V$. In practice it is enough to check three things: (1) $' + Z + '\\in\\mathcal{U}$; (2a) **outer closure**: $\\forall\\lambda\\in\\mathbb{R}\\;\\forall' + X + '\\in\\mathcal{U}:\\;\\lambda' + X + '\\in\\mathcal{U}$; (2b) **inner closure**: $\\forall' + X + ',' + Y + '\\in\\mathcal{U}:\\;' + X + '+' + Y + '\\in\\mathcal{U}$.' },
    { es: '**Intuición:** operar dentro de un subespacio nunca te saca de él. La recta sombreada $\\{\\lambda' + U + '\\}$ pasa por el origen y es un subespacio: mueve $\\lambda$ o arrastra $' + U + '$, y $\\lambda' + U + '$ no sale de ella. La paralela $y=\\tfrac{x}{2}+1$ **no** lo es. No contiene $' + Z + '$, y además $(0,1)$ y $(2,2)$ están en ella, pero su suma $(2,3)$ no.',
      en: '**Intuition:** operating inside a subspace never takes you out of it. The shaded line $\\{\\lambda' + U + '\\}$ goes through the origin and is a subspace: move $\\lambda$ or drag $' + U + '$, and $\\lambda' + U + '$ never leaves it. The parallel $y=\\tfrac{x}{2}+1$ is **not** one. It does not contain $' + Z + '$, and also $(0,1)$ and $(2,2)$ lie on it, but their sum $(2,3)$ does not.',
      jugar: {
        botones: [
          { label: 'λ = 0', hacer: v => { v.l = 0; } },
          { label: 'λ = −2', hacer: v => { v.l = -2; } },
          { label: { es: 'u = (2 ; 1)', en: 'u = (2, 1)' }, hacer: v => { v.vec.u = [2, 1]; } },
        ],
        lecturas: (v, cx) => {
          const p = cx.comb([v.l], [v.vec.u]), en = Math.abs(p[0] - 2 * p[1] + 2) < 1e-6;
          return [
            { expr: `$\\lambda${U}$`, valor: p2(cx, p) },
            { expr: { es: '¿en la recta generada por $' + U + '$?', en: 'on the line spanned by $' + U + '$?' }, valor: '✓' },
            { expr: { es: '¿en $y=\\tfrac{x}{2}+1$?', en: 'on $y=\\tfrac{x}{2}+1$?' }, valor: en ? '✓' : '✗', malo: !en },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: 'Ejemplos (MML §2.4.3). Los subespacios **triviales** de $V$ son $V$ y $\\{' + Z + '\\}$. El conjunto solución de un sistema **homogéneo** $' + A + X + '=' + Z + '$ es un subespacio de $\\mathbb{R}^n$. Contiene $' + Z + '$, porque $' + A + Z + '=' + Z + '$. Si $' + A + X + '=' + A + Y + '=' + Z + '$, entonces $' + A + '(' + X + '+' + Y + ')=' + A + X + '+' + A + Y + '=' + Z + '$. Y $' + A + '(\\lambda' + X + ')=\\lambda' + A + X + '=' + Z + '$.',
      en: 'Examples (MML §2.4.3). The **trivial** subspaces of $V$ are $V$ and $\\{' + Z + '\\}$. The solution set of a **homogeneous** system $' + A + X + '=' + Z + '$ is a subspace of $\\mathbb{R}^n$. It contains $' + Z + '$, because $' + A + Z + '=' + Z + '$. If $' + A + X + '=' + A + Y + '=' + Z + '$, then $' + A + '(' + X + '+' + Y + ')=' + A + X + '+' + A + Y + '=' + Z + '$. And $' + A + '(\\lambda' + X + ')=\\lambda' + A + X + '=' + Z + '$.' },
    { es: 'En cambio, el conjunto solución de $' + A + X + '=' + b + '$ con $' + b + '\\neq' + Z + '$ **no** es un subespacio: $' + A + Z + '=' + Z + '\\neq' + b + '$, así que $' + Z + '$ no está. La intersección de cualquier número de subespacios es un subespacio. Y, al revés, todo subespacio de $\\mathbb{R}^n$ es el conjunto solución de algún sistema $' + A + X + '=' + Z + '$ (MML §2.4.3).',
      en: 'On the other hand, the solution set of $' + A + X + '=' + b + '$ with $' + b + '\\neq' + Z + '$ is **not** a subspace: $' + A + Z + '=' + Z + '\\neq' + b + '$, so $' + Z + '$ is missing. The intersection of any number of subspaces is a subspace. Conversely, every subspace of $\\mathbb{R}^n$ is the solution set of some system $' + A + X + '=' + Z + '$ (MML §2.4.3).' },
    { es: '¿Cuál de estos subconjuntos de $\\mathbb{R}^3$ es un subespacio?',
      en: 'Which of these subsets of $\\mathbb{R}^3$ is a subspace?',
      pregunta: {
        opc: [
          { es: '$\\{' + X + ':x_1+x_2+x_3=1\\}$', en: '$\\{' + X + ':x_1+x_2+x_3=1\\}$' },
          { es: '$\\{' + X + ':x_1\\ge0\\}$', en: '$\\{' + X + ':x_1\\ge0\\}$' },
          { es: '$\\{' + X + ':x_1+x_2+x_3=0\\}$', en: '$\\{' + X + ':x_1+x_2+x_3=0\\}$', ok: 1 },
          { es: '$\\{' + X + ':x_1x_2=0\\}$', en: '$\\{' + X + ':x_1x_2=0\\}$' },
        ],
        why: {
          es: 'El plano $x_1+x_2+x_3=0$ es la solución de un sistema homogéneo ($' + A + '=[1\\;1\\;1]$). El de $=1$ no contiene $' + Z + '$. El semiespacio $x_1\\ge0$ no es cerrado por escalares: $(-1)\\cdot(1,0,0)$ se sale. $x_1x_2=0$ es la unión de dos planos y no es cerrada por la suma: $(1,0,0)+(0,1,0)=(1,1,0)$ se sale.',
          en: 'The plane $x_1+x_2+x_3=0$ is the solution of a homogeneous system ($' + A + '=[1\\;1\\;1]$). The $=1$ one does not contain $' + Z + '$. The half-space $x_1\\ge0$ is not closed under scalars: $(-1)\\cdot(1,0,0)$ leaves it. $x_1x_2=0$ is the union of two planes and is not closed under addition: $(1,0,0)+(0,1,0)=(1,1,0)$ leaves it.',
        },
        pistas: [
          { es: 'Primer filtro: ¿contiene el vector nulo?', en: 'First filter: does it contain the zero vector?' },
          { es: 'Segundo filtro: prueba $\\lambda=-1$ y suma dos vectores sencillos del conjunto.', en: 'Second filter: try $\\lambda=-1$ and add two simple vectors from the set.' },
        ],
      } },

    // ── MML §2.5 Combinación lineal ──
    { sec: { es: 'Combinación lineal', en: 'Linear combination' }, capas: [SPAN, FU, FV, COMB], par: { a: 1, b: 1 },
      es: '**Def. 2.11 (combinación lineal, MML §2.5).** Dados un espacio vectorial $V$ y un número finito de vectores $' + X + '_1,\\dots,' + X + '_k\\in V$, todo $' + V + '\\in V$ de la forma $' + V + '=\\lambda_1' + X + '_1+\\cdots+\\lambda_k' + X + '_k=\\sum_{i=1}^k\\lambda_i' + X + '_i$, con $\\lambda_1,\\dots,\\lambda_k\\in\\mathbb{R}$, es una **combinación lineal** de ellos.',
      en: '**Def. 2.11 (linear combination, MML §2.5).** Given a vector space $V$ and finitely many vectors $' + X + '_1,\\dots,' + X + '_k\\in V$, every $' + V + '\\in V$ of the form $' + V + '=\\lambda_1' + X + '_1+\\cdots+\\lambda_k' + X + '_k=\\sum_{i=1}^k\\lambda_i' + X + '_i$, with $\\lambda_1,\\dots,\\lambda_k\\in\\mathbb{R}$, is a **linear combination** of them.' },
    { capas: [SPAN, FU, FV, COMB, OBJ],
      es: 'Reto: mueve $\\lambda_1$ y $\\lambda_2$ hasta que $\\lambda_1' + U + '+\\lambda_2' + V + '$ caiga en el punto $(3,-2)$. Después arrastra $' + U + '$ o $' + V + '$ y observa cómo cambian los coeficientes necesarios. Mientras $' + U + '$ y $' + V + '$ no sean paralelos, siempre hay una solución, y es única.',
      en: 'Challenge: move $\\lambda_1$ and $\\lambda_2$ until $\\lambda_1' + U + '+\\lambda_2' + V + '$ lands on the point $(3,-2)$. Then drag $' + U + '$ or $' + V + '$ and watch how the required coefficients change. As long as $' + U + '$ and $' + V + '$ are not parallel, there is always a solution, and it is unique.',
      jugar: {
        botones: [
          { label: { es: 'resolver', en: 'solve' }, hacer: v => { const [u1, u2] = v.vec.u, [v1, v2] = v.vec.v, D = u1 * v2 - u2 * v1; if (Math.abs(D) > 1e-9) { v.a = +((3 * v2 + 2 * v1) / D).toFixed(2); v.b = +((-2 * u1 - 3 * u2) / D).toFixed(2); } } },
          RESET,
        ],
        lecturas: (v, cx) => {
          const p = cx.comb([v.a, v.b], [v.vec.u, v.vec.v]), d = Math.hypot(p[0] - 3, p[1] + 2), s = cx.resolver(v.vec.u[0], v.vec.v[0], 3, v.vec.u[1], v.vec.v[1], -2);
          return [
            { expr: `$\\lambda_1${U}+\\lambda_2${V}$`, valor: p2(cx, p) },
            { expr: { es: 'distancia a $(3,-2)$', en: 'distance to $(3,-2)$' }, valor: cx.fmt(+d.toFixed(2)), malo: d > .05 },
            { expr: { es: 'coeficientes exactos', en: 'exact coefficients' }, valor: s.tipo === 'unica' ? p2(cx, [+s.x.toFixed(2), +s.y.toFixed(2)]) : (s.tipo === 'ninguna' ? '—' : '∞'), malo: s.tipo !== 'unica' },
          ];
        },
        arrastrables: true, soltar,
      } },
    { es: 'Los coeficientes salen de un sistema lineal: $\\lambda_1' + U + '+\\lambda_2' + V + '=' + B('t') + '$ es $[' + U + '\\;' + V + ']\\begin{bmatrix}\\lambda_1\\\\\\lambda_2\\end{bmatrix}=' + B('t') + '$. Es el mismo $' + A + X + '=' + b + '$ de §2.3, pero leído **por columnas**: $' + A + X + '$ es una combinación lineal de las columnas de $' + A + '$. Y $' + Z + '=\\sum_i0\\,' + X + '_i$ siempre es posible: es la combinación **trivial**.',
      en: 'The coefficients come from a linear system: $\\lambda_1' + U + '+\\lambda_2' + V + '=' + B('t') + '$ is $[' + U + '\\;' + V + ']\\begin{bmatrix}\\lambda_1\\\\\\lambda_2\\end{bmatrix}=' + B('t') + '$. It is the same $' + A + X + '=' + b + '$ from §2.3, read **by columns**: $' + A + X + '$ is a linear combination of the columns of $' + A + '$. And $' + Z + '=\\sum_i0\\,' + X + '_i$ is always possible: the **trivial** combination.' },

    // ── MML §2.5 Independencia lineal ──
    { sec: { es: 'Independencia lineal', en: 'Linear independence' }, capas: [SPAN, { tipo: 'paralelogramo', u: 'u', v: 'v' }, FU, FV],
      es: '**Def. 2.12 (MML §2.5).** Los vectores $' + X + '_1,\\dots,' + X + '_k\\in V$ son **linealmente dependientes** si existe una combinación no trivial $' + Z + '=\\sum_{i=1}^k\\lambda_i' + X + '_i$, con al menos un $\\lambda_i\\neq0$. Son **linealmente independientes** si solo existe la solución trivial $\\lambda_1=\\cdots=\\lambda_k=0$.',
      en: '**Def. 2.12 (MML §2.5).** The vectors $' + X + '_1,\\dots,' + X + '_k\\in V$ are **linearly dependent** if there is a non-trivial combination $' + Z + '=\\sum_{i=1}^k\\lambda_i' + X + '_i$, with at least one $\\lambda_i\\neq0$. They are **linearly independent** if only the trivial solution $\\lambda_1=\\cdots=\\lambda_k=0$ exists.' },
    { es: '**Intuición:** independientes significa sin redundancia; si quitas uno, pierdes algo. En $\\mathbb{R}^2$, $\\lambda_1' + U + '+\\lambda_2' + V + '=' + Z + '$ solo tiene la solución $' + Z + '$ si y solo si $\\det[' + U + '\\;' + V + ']=u_1v_2-u_2v_1\\neq0$ (MML §4.1). Ese número es el área con signo del paralelogramo. Alinea $' + V + '$ con $' + U + '$.',
      en: '**Intuition:** independent means no redundancy; remove one and you lose something. In $\\mathbb{R}^2$, $\\lambda_1' + U + '+\\lambda_2' + V + '=' + Z + '$ has only the solution $' + Z + '$ if and only if $\\det[' + U + '\\;' + V + ']=u_1v_2-u_2v_1\\neq0$ (MML §4.1). That number is the signed area of the parallelogram. Line $' + V + '$ up with $' + U + '$.',
      jugar: {
        botones: [
          { label: 'v = 2u', hacer: v => { v.vec.v = [2 * v.vec.u[0], 2 * v.vec.u[1]]; } },
          { label: 'v = 0', hacer: v => { v.vec.v = [0, 0]; } },
          RESET,
        ],
        lecturas: (v, cx) => {
          const d = cx.det(v.vec.u, v.vec.v), n = cx.dim([v.vec.u, v.vec.v]);
          return [
            { expr: '$u_1v_2-u_2v_1$', valor: cx.fmt(+d.toFixed(2)), malo: n < 2 },
            { expr: { es: 'dimensión del generado', en: 'dimension of the span' }, valor: n, malo: n < 2 },
            { expr: { es: '¿independientes?', en: 'independent?' }, valor: n === 2 ? '✓' : '✗', malo: n < 2 },
          ];
        },
        arrastrables: true, soltar,
      } },
    { deriva: {
        pregunta: { es: 'Añadimos $' + W + '=(1,3)$ a $' + U + '=(2,1)$ y $' + V + '=(-1,1.5)$, que son independientes. ¿Cómo son $' + U + ',' + V + ',' + W + '$?', en: 'We add $' + W + '=(1,3)$ to $' + U + '=(2,1)$ and $' + V + '=(-1,1.5)$, which are independent. What about $' + U + ',' + V + ',' + W + '$?' },
        opciones: [{ es: 'Dependientes', en: 'Dependent' }, { es: 'Independientes', en: 'Independent' }, { es: 'Depende de $' + W + '$', en: 'It depends on $' + W + '$' }], correcta: 0,
        razones: [
          { es: '$' + U + '$ y $' + V + '$ ya generan todo $\\mathbb{R}^2$, así que $' + W + '$ es combinación de ellos', en: '$' + U + '$ and $' + V + '$ already span all of $\\mathbb{R}^2$, so $' + W + '$ is a combination of them' },
          { es: '$' + W + '$ no es múltiplo ni de $' + U + '$ ni de $' + V + '$', en: '$' + W + '$ is not a multiple of $' + U + '$ or of $' + V + '$' },
          { es: 'Tres vectores distintos siempre son independientes', en: 'Three different vectors are always independent' },
        ], razonCorrecta: 0,
        revela: { es: 'Resolviendo $\\lambda_1' + U + '+\\lambda_2' + V + '=' + W + '$ sale $\\lambda_1=1.125$ y $\\lambda_2=1.25$, así que $1.125' + U + '+1.25' + V + '-' + W + '=' + Z + '$ es una combinación no trivial. No ser múltiplo de **cada uno** no basta: hay que no ser combinación de **todos los demás juntos**. En $\\mathbb{R}^2$, tres vectores siempre son dependientes.', en: 'Solving $\\lambda_1' + U + '+\\lambda_2' + V + '=' + W + '$ gives $\\lambda_1=1.125$ and $\\lambda_2=1.25$, so $1.125' + U + '+1.25' + V + '-' + W + '=' + Z + '$ is a non-trivial combination. Not being a multiple of **each one** is not enough: it must not be a combination of **all the others together**. In $\\mathbb{R}^2$, three vectors are always dependent.' },
      },
      vec: { u: [2, 1], v: [-1, 1.5] }, capas: [SPAN, FU, FV, { tipo: 'comb', coef: [1.125, 1.25], vecs: ['u', 'v'], nombre: '' }, FW],
      es: 'La combinación $1.125' + U + '+1.25' + V + '$, cabeza con cola, termina justo en la punta de $' + W + '$: $' + W + '$ es redundante.',
      en: 'The combination $1.125' + U + '+1.25' + V + '$, head to tail, ends exactly at the tip of $' + W + '$: $' + W + '$ is redundant.' },
    { es: 'Propiedades útiles (MML §2.5). $k$ vectores son dependientes o independientes, sin tercera opción. Si alguno es $' + Z + '$, son dependientes, porque $1\\cdot' + Z + '=' + Z + '$ ya es no trivial; igual si dos son iguales. Si son no nulos y $k\\ge2$, son dependientes **si y solo si** alguno es combinación lineal de los demás, por ejemplo $' + X + '_i=\\lambda' + X + '_j$.',
      en: 'Useful properties (MML §2.5). $k$ vectors are either dependent or independent, with no third option. If one of them is $' + Z + '$ they are dependent, because $1\\cdot' + Z + '=' + Z + '$ is already non-trivial; same if two are equal. If they are nonzero and $k\\ge2$, they are dependent **if and only if** one is a linear combination of the others, e.g. $' + X + '_i=\\lambda' + X + '_j$.' },

    // ── Comprobarlo con Gauss ──
    { sec: { es: 'Comprobarlo con eliminación gaussiana', en: 'Checking it with Gaussian elimination' }, capas: [SPAN, FU, FV],
      es: 'Método práctico (MML §2.5): pon los vectores como **columnas** de una matriz y llévala a forma escalonada por filas; la reducida no hace falta. Las **columnas pivote** son independientes de las que tienen a su izquierda. Cada columna **sin** pivote es combinación de las columnas pivote a su izquierda. El orden de las columnas importa.',
      en: 'Practical method (MML §2.5): put the vectors as the **columns** of a matrix and reduce it to row-echelon form; the reduced form is not needed. The **pivot columns** are independent of the ones to their left. Each column **without** a pivot is a combination of the pivot columns to its left. The column order matters.' },
    { es: 'Por ejemplo, en $\\begin{bmatrix}1&-2&0\\\\0&0&3\\end{bmatrix}$ las columnas 1 y 3 son pivote, y la 2 es $-2$ veces la 1. Criterio: los vectores son independientes **si y solo si** todas las columnas son pivote. Basta una columna sin pivote para que sean dependientes.',
      en: 'For example, in $\\begin{bmatrix}1&-2&0\\\\0&0&3\\end{bmatrix}$ columns 1 and 3 are pivots, and column 2 is $-2$ times column 1. Criterion: the vectors are independent **if and only if** every column is a pivot. A single column without a pivot makes them dependent.' },
    { sec: { es: 'Ejemplo en ℝ³', en: 'Example in ℝ³' },
      es: 'Ejemplo propio: $' + X + '_1=(1,0,2)^\\top$, $' + X + '_2=(2,1,3)^\\top$ y $' + X + '_3=(0,1,-1)^\\top$. Con $F_3\\leftarrow F_3-2F_1$ y luego $F_3\\leftarrow F_3+F_2$: $\\begin{bmatrix}1&2&0\\\\0&1&1\\\\2&3&-1\\end{bmatrix}\\rightsquigarrow\\begin{bmatrix}1&2&0\\\\0&1&1\\\\0&0&0\\end{bmatrix}$. La columna 3 no tiene pivote, así que son **dependientes**.',
      en: 'An example of our own: $' + X + '_1=(1,0,2)^\\top$, $' + X + '_2=(2,1,3)^\\top$ and $' + X + '_3=(0,1,-1)^\\top$. With $R_3\\leftarrow R_3-2R_1$ and then $R_3\\leftarrow R_3+R_2$: $\\begin{bmatrix}1&2&0\\\\0&1&1\\\\2&3&-1\\end{bmatrix}\\rightsquigarrow\\begin{bmatrix}1&2&0\\\\0&1&1\\\\0&0&0\\end{bmatrix}$. Column 3 has no pivot, so they are **dependent**.' },
    { code: `import numpy as np
X = np.array([[1, 2,  0],
              [0, 1,  1],
              [2, 3, -1]])
print(np.linalg.matrix_rank(X))
U, s, Vt = np.linalg.svd(X)
n = Vt[-1]
print(n / n[0])
print(np.allclose(X @ n, 0))`, line: null,
      es: 'Reduciendo más ($F_1\\leftarrow F_1-2F_2$) se lee $' + X + '_3=-2' + X + '_1+' + X + '_2$, es decir, $2' + X + '_1-' + X + '_2+' + X + '_3=' + Z + '$. En NumPy, el rango es 2 y el último vector singular derecho de la SVD (§4.5) da los coeficientes. Dividido entre su primera componente, sale $(1,-\\tfrac12,\\tfrac12)$, proporcional a $(2,-1,1)$.',
      en: 'Reducing further ($R_1\\leftarrow R_1-2R_2$) we read $' + X + '_3=-2' + X + '_1+' + X + '_2$, that is, $2' + X + '_1-' + X + '_2+' + X + '_3=' + Z + '$. In NumPy, the rank is 2 and the last right singular vector of the SVD (§4.5) gives the coefficients. Divided by its first component, it comes out as $(1,-\\tfrac12,\\tfrac12)$, proportional to $(2,-1,1)$.' },
    { code: '', es: 'La forma escalonada de una matriz de 4 columnas es $\\begin{bmatrix}1&3&0&2\\\\0&0&1&-1\\\\0&0&0&0\\end{bmatrix}$. ¿Qué columnas son pivote?',
      en: 'The row-echelon form of a 4-column matrix is $\\begin{bmatrix}1&3&0&2\\\\0&0&1&-1\\\\0&0&0&0\\end{bmatrix}$. Which columns are pivots?',
      pregunta: {
        opc: [
          { es: 'La 1 y la 3', en: 'Columns 1 and 3', ok: 1 },
          { es: 'La 1 y la 2', en: 'Columns 1 and 2' },
          { es: 'Las cuatro, porque ninguna es nula', en: 'All four, since none is zero' },
        ],
        why: {
          es: 'El pivote es el primer elemento no nulo de cada fila: columna 1 (fila 1) y columna 3 (fila 2). La columna 2 es $3$ veces la 1, y la 4 es $2\\cdot\\text{col}_1-\\text{col}_3$. Las cuatro columnas originales son dependientes y las dos pivote forman un conjunto independiente.',
          en: 'The pivot is the first nonzero entry of each row: column 1 (row 1) and column 3 (row 2). Column 2 is $3$ times column 1, and column 4 is $2\\cdot\\text{col}_1-\\text{col}_3$. The four original columns are dependent and the two pivot columns form an independent set.',
        },
      } },

    // ── Combinaciones de vectores independientes (observación de MML §2.5) ──
    { sec: { es: 'Combinaciones de vectores independientes', en: 'Combinations of independent vectors' },
      es: 'Sean $' + b + '_1,\\dots,' + b + '_k$ independientes y $' + X + '_j=\\sum_{i=1}^k\\lambda_{ij}' + b + '_i$ para $j=1,\\dots,m$. Con $' + B('B') + '=[' + b + '_1,\\dots,' + b + '_k]$ queda $' + X + '_j=' + B('B') + B('\\lambda') + '_j$, donde $' + B('\\lambda') + '_j=(\\lambda_{1j},\\dots,\\lambda_{kj})^\\top$. Entonces $\\sum_{j=1}^m\\psi_j' + X + '_j=' + B('B') + '\\sum_{j=1}^m\\psi_j' + B('\\lambda') + '_j$.',
      en: 'Let $' + b + '_1,\\dots,' + b + '_k$ be independent and $' + X + '_j=\\sum_{i=1}^k\\lambda_{ij}' + b + '_i$ for $j=1,\\dots,m$. With $' + B('B') + '=[' + b + '_1,\\dots,' + b + '_k]$ we get $' + X + '_j=' + B('B') + B('\\lambda') + '_j$, where $' + B('\\lambda') + '_j=(\\lambda_{1j},\\dots,\\lambda_{kj})^\\top$. Then $\\sum_{j=1}^m\\psi_j' + X + '_j=' + B('B') + '\\sum_{j=1}^m\\psi_j' + B('\\lambda') + '_j$.' },
    { es: 'Como las columnas de $' + B('B') + '$ son independientes, $' + B('B') + B('z') + '=' + Z + '$ implica $' + B('z') + '=' + Z + '$. Por tanto $\\{' + X + '_j\\}$ son independientes **si y solo si** lo son los vectores de coeficientes $\\{' + B('\\lambda') + '_j\\}\\subset\\mathbb{R}^k$ (MML §2.5). Consecuencia: $m>k$ combinaciones de $k$ vectores son siempre dependientes.',
      en: 'Since the columns of $' + B('B') + '$ are independent, $' + B('B') + B('z') + '=' + Z + '$ implies $' + B('z') + '=' + Z + '$. Hence $\\{' + X + '_j\\}$ are independent **if and only if** the coefficient vectors $\\{' + B('\\lambda') + '_j\\}\\subset\\mathbb{R}^k$ are (MML §2.5). Consequence: $m>k$ combinations of $k$ vectors are always dependent.' },
    { es: 'Con $' + b + '_1,' + b + '_2$ independientes, ¿son independientes $' + X + '_1=' + b + '_1+' + b + '_2$ y $' + X + '_2=' + b + '_1-' + b + '_2$?',
      en: 'With $' + b + '_1,' + b + '_2$ independent, are $' + X + '_1=' + b + '_1+' + b + '_2$ and $' + X + '_2=' + b + '_1-' + b + '_2$ independent?',
      pregunta: {
        opc: [
          { es: 'Sí: $(1,1)$ y $(1,-1)$ son independientes', en: 'Yes: $(1,1)$ and $(1,-1)$ are independent', ok: 1 },
          { es: 'No: los dos usan $' + b + '_1$', en: 'No: both use $' + b + '_1$' },
          { es: 'Depende de cuánto valgan $' + b + '_1$ y $' + b + '_2$', en: 'It depends on the values of $' + b + '_1$ and $' + b + '_2$' },
        ],
        why: {
          es: 'Por la observación anterior basta con mirar los coeficientes $' + B('\\lambda') + '_1=(1,1)^\\top$ y $' + B('\\lambda') + '_2=(1,-1)^\\top$: $\\det=1\\cdot(-1)-1\\cdot1=-2\\neq0$. El resultado no depende de qué vectores concretos sean $' + b + '_1,' + b + '_2$, solo de que sean independientes. Compartir un vector no implica dependencia.',
          en: 'By the remark above it is enough to look at the coefficients $' + B('\\lambda') + '_1=(1,1)^\\top$ and $' + B('\\lambda') + '_2=(1,-1)^\\top$: $\\det=1\\cdot(-1)-1\\cdot1=-2\\neq0$. The result does not depend on which concrete vectors $' + b + '_1,' + b + '_2$ are, only on their being independent. Sharing a vector does not imply dependence.',
        },
      } },

    // ── ML ──
    { sec: { es: 'Dónde aparece en ML', en: 'Where it shows up in ML' }, capas: [SPAN, FU, FV, COMB], par: { a: 1, b: 1 },
      es: '**Subespacios**: PCA (MML cap. 10) busca el subespacio de dimensión baja que mejor aproxima los datos. Reducir la dimensión es proyectar sobre él, como anuncia MML §2.4.3. **Núcleo**: el conjunto solución de $' + A + X + '=' + Z + '$, que aquí has visto que es un subespacio, será el núcleo de §2.7.3.',
      en: '**Subspaces**: PCA (MML ch. 10) seeks the low-dimensional subspace that best approximates the data. Reducing the dimension is projecting onto it, as MML §2.4.3 announces. **Kernel**: the solution set of $' + A + X + '=' + Z + '$, which you have seen here is a subspace, will be the kernel of §2.7.3.' },
    { es: '**Independencia**: en regresión lineal (MML §9.2), la solución de mínimos cuadrados es única solo si las columnas de la matriz de diseño $' + B('\\Phi') + '$ son independientes. Si un rasgo es combinación lineal de otros (multicolinealidad), $' + B('\\Phi') + '^\\top' + B('\\Phi') + '$ no es invertible y hay infinitos parámetros igual de buenos.',
      en: '**Independence**: in linear regression (MML §9.2), the least-squares solution is unique only if the columns of the design matrix $' + B('\\Phi') + '$ are independent. If one feature is a linear combination of others (multicollinearity), $' + B('\\Phi') + '^\\top' + B('\\Phi') + '$ is not invertible and infinitely many parameters fit equally well.' },
    { es: 'Resumen: un espacio vectorial es un grupo abeliano $(\\mathcal{V},+)$ más un escalado que cumple la distributividad, la asociatividad y $1\\cdot' + X + '=' + X + '$. Un subespacio contiene $' + Z + '$ y es cerrado por $+$ y por $\\cdot$. Unos vectores son independientes si solo la combinación trivial da $' + Z + '$, y Gauss lo comprueba con las columnas pivote. Siguiente: **base, rango y aplicaciones lineales** (MML §2.6–2.8).',
      en: 'Summary: a vector space is an Abelian group $(\\mathcal{V},+)$ plus a scaling that satisfies distributivity, associativity and $1\\cdot' + X + '=' + X + '$. A subspace contains $' + Z + '$ and is closed under $+$ and $\\cdot$. Vectors are independent if only the trivial combination gives $' + Z + '$, and Gauss checks it through the pivot columns. Next: **basis, rank and linear mappings** (MML §2.6–2.8).' },
  ],
};
