// Guía «Introducción: vectores y el mapa de MML» (Álgebra lineal, lección 0). Sigue MML cap. 1 (§1.1–1.2) y la introducción del
// cap. 2. Escena `vectores` (formato en la cabecera de assets/guias/vectores.js); formato de los pasos en data/punteros.js.
// Notación MML: escalares en cursiva, vectores en negrita minúscula (\boldsymbol{x}), matrices en negrita mayúscula (\boldsymbol{A}).
const B = x => `\\boldsymbol{${x}}`;
const U = B('u'), V = B('v');
const VENT = { x: [-5, 5], y: [-3.4, 3.4] };
const par = { a: 1, b: 1, l: 1.5 };
const DESL = [
  { par: 'a', min: -3, max: 3, paso: .1, es: 'Coeficiente $a$', en: 'Coefficient $a$', dec: 1 },
  { par: 'b', min: -3, max: 3, paso: .1, es: 'Coeficiente $b$', en: 'Coefficient $b$', dec: 1 },
  { par: 'l', min: -2.5, max: 2.5, paso: .1, es: 'Escalar $\\lambda$', en: 'Scalar $\\lambda$', dec: 1 },
];
const FU = { tipo: 'flecha', a: 'u' }, FV = { tipo: 'flecha', a: 'v' };
const SUMA = { tipo: 'comb', coef: [1, 1], vecs: ['u', 'v'], nombre: `$${U}+${V}$` };
const ESCALA = { tipo: 'comb', coef: ['l'], vecs: ['u'], nombre: `$\\lambda${U}$` };
const COMB = { tipo: 'comb', coef: ['a', 'b'], vecs: ['u', 'v'], nombre: `$a${U}+b${V}$` };
const SPAN = { tipo: 'span', vecs: ['u', 'v'] };

const par2 = (cx, p) => `(${cx.fmt(p[0])} ; ${cx.fmt(p[1])})`;
const soltar = (v, k, val) => { if (Array.isArray(val)) v.vec[k] = val; else v[k] = val; };

export default {
  titulo: { es: 'Introducción: vectores y el mapa de MML', en: 'Introduction: vectors and the MML map' },
  fuentes: [
    'Deisenroth, M. P., Faisal, A. A., & Ong, C. S. (2020). *Mathematics for machine learning*. Cambridge University Press. https://mml-book.com',
  ],
  pasos: [
    // ── MML §1: datos, modelo, aprendizaje ──
    { sec: { es: 'Datos, modelo y aprendizaje', en: 'Data, model and learning' },
      vectores: { ...VENT, vec: { u: [2, 1], v: [-1, 2] }, par, arrastrar: ['u', 'v'], paso: .5, deslizadores: DESL, capas: [FU, { tipo: 'punto', x: 2, y: 1, nombre: '$(2,1)$' }],
        etiqueta: { es: 'Plano con vectores arrastrables u y v', en: 'Plane with draggable vectors u and v' } },
      es: 'El aprendizaje automático diseña algoritmos que extraen información útil de los datos **sin** reprogramarlos para cada caso (MML cap. 1). Tiene tres piezas: **datos**, un **modelo** que describe cómo se generan, y **aprendizaje**: ajustar los parámetros del modelo para que funcione bien con datos que aún no ha visto.',
      en: 'Machine learning designs algorithms that extract useful information from data **without** reprogramming them for each case (MML ch. 1). It has three pieces: **data**, a **model** of how the data is generated, and **learning**: tuning the model\'s parameters so it works well on data it has not seen yet.' },
    { es: 'MML supone que los datos ya están convertidos a números: cada dato es un **vector**. Un cliente con edad 2 y gasto 1 (en unidades escaladas) es el punto $(2,1)$ del plano; con $D$ rasgos sería un punto de $\\mathbb{R}^D$. Aprender bien no es memorizar los datos de entrenamiento: es **generalizar** a datos nuevos (MML §1.1).',
      en: 'MML assumes the data has already been turned into numbers: each data point is a **vector**. A customer with age 2 and spending 1 (scaled units) is the point $(2,1)$ in the plane; with $D$ features it would be a point of $\\mathbb{R}^D$. Learning well is not memorizing the training data: it is **generalizing** to new data (MML §1.1).' },
    { sec: { es: 'Tres formas de ver un vector', en: 'Three ways to see a vector' }, capas: [FU, { tipo: 'punto', x: 2, y: 1, nombre: '$(2,1)$' }],
      es: 'La misma palabra, tres ideas (MML §1.1): una **lista de números** (la vista informática, un array), una **flecha** con dirección y longitud (la vista física) y un **objeto que se puede sumar y escalar** (la vista matemática). La tercera es la que manda: las otras dos son ejemplos de ella.',
      en: 'One word, three ideas (MML §1.1): a **list of numbers** (the computer-science view, an array), an **arrow** with direction and length (the physics view) and an **object that can be added and scaled** (the mathematical view). The third one rules: the other two are instances of it.' },

    // ── MML cap. 2, introducción: sumar y escalar ──
    { sec: { es: 'Qué es un vector', en: 'What a vector is' }, capas: [FU, FV, SUMA],
      es: 'Un **álgebra** es un conjunto de objetos más unas reglas para operar con ellos. El álgebra lineal estudia los **vectores**: objetos que se pueden **sumar** entre sí y **multiplicar por escalares**, y el resultado es otra vez un objeto del mismo tipo (MML cap. 2). Aquí $' + U + '+' + V + '$ se dibuja cabeza con cola.',
      en: 'An **algebra** is a set of objects plus rules to manipulate them. Linear algebra studies **vectors**: objects that can be **added** together and **multiplied by scalars**, and the result is again an object of the same kind (MML ch. 2). Here $' + U + '+' + V + '$ is drawn head to tail.' },
    { capas: [FU, FV, SUMA],
      es: 'Arrastra los extremos de $' + U + '$ y $' + V + '$. La suma se hace **componente a componente**: $(u_1,u_2)+(v_1,v_2)=(u_1+v_1,\\;u_2+v_2)$. Fíjate en que $' + U + '+' + V + '=' + V + '+' + U + '$: los dos caminos cabeza-cola cierran el mismo paralelogramo.',
      en: 'Drag the tips of $' + U + '$ and $' + V + '$. Addition is **component-wise**: $(u_1,u_2)+(v_1,v_2)=(u_1+v_1,\\;u_2+v_2)$. Note that $' + U + '+' + V + '=' + V + '+' + U + '$: both head-to-tail paths close the same parallelogram.',
      jugar: {
        botones: [
          { label: { es: 'u = (2 ; 1), v = (−1 ; 2)', en: 'u = (2, 1), v = (−1, 2)' }, hacer: v => { v.vec.u = [2, 1]; v.vec.v = [-1, 2]; } },
          { label: { es: 'v = −u', en: 'v = −u' }, hacer: v => { v.vec.v = [-v.vec.u[0], -v.vec.u[1]]; } },
        ],
        lecturas: (v, cx) => [
          { expr: `$${U}$`, valor: par2(cx, v.vec.u) },
          { expr: `$${V}$`, valor: par2(cx, v.vec.v) },
          { expr: `$${U}+${V}$`, valor: par2(cx, cx.comb([1, 1], [v.vec.u, v.vec.v])) },
        ],
        arrastrables: true, soltar,
      } },
    { capas: [FU, ESCALA], par: { l: 1.5 },
      es: 'Multiplicar por un escalar $\\lambda\\in\\mathbb{R}$ estira o encoge: $\\lambda(u_1,u_2)=(\\lambda u_1,\\lambda u_2)$. Mueve $\\lambda$: con $\\lambda<0$ el vector se da la vuelta, con $\\lambda=0$ se queda en el vector nulo $' + B('0') + '$ y con $|\\lambda|<1$ se acorta. La dirección (la recta que lo contiene) nunca cambia.',
      en: 'Multiplying by a scalar $\\lambda\\in\\mathbb{R}$ stretches or shrinks: $\\lambda(u_1,u_2)=(\\lambda u_1,\\lambda u_2)$. Move $\\lambda$: with $\\lambda<0$ the vector flips, with $\\lambda=0$ it collapses to the zero vector $' + B('0') + '$ and with $|\\lambda|<1$ it gets shorter. The line that contains it never changes.',
      jugar: {
        botones: [
          { label: 'λ = −1', hacer: v => { v.l = -1; } },
          { label: 'λ = 0', hacer: v => { v.l = 0; } },
          { label: 'λ = 2', hacer: v => { v.l = 2; } },
        ],
        lecturas: (v, cx) => [
          { expr: '$\\lambda$', valor: cx.fmt(v.l) },
          { expr: `$\\lambda${U}$`, valor: par2(cx, cx.comb([v.l], [v.vec.u])) },
        ],
        arrastrables: true, soltar,
      } },
    { deriva: {
        pregunta: { es: 'Con $' + U + '=(2,1)$, ¿dónde acaba $\\lambda' + U + '$ si $\\lambda=-1$?', en: 'With $' + U + '=(2,1)$, where does $\\lambda' + U + '$ end up if $\\lambda=-1$?' },
        opciones: [{ es: 'En $(-2,-1)$', en: 'At $(-2,-1)$' }, { es: 'En $(1,2)$', en: 'At $(1,2)$' }, { es: 'En $(-2,1)$', en: 'At $(-2,1)$' }], correcta: 0,
        razones: [
          { es: 'El escalar multiplica **cada** componente: $-1\\cdot2$ y $-1\\cdot1$', en: 'The scalar multiplies **each** component: $-1\\cdot2$ and $-1\\cdot1$' },
          { es: 'Multiplicar por $-1$ refleja solo respecto al eje vertical', en: 'Multiplying by $-1$ reflects only across the vertical axis' },
          { es: 'Multiplicar por $-1$ intercambia las componentes', en: 'Multiplying by $-1$ swaps the components' },
        ], razonCorrecta: 0,
        revela: { es: '$-' + U + '=(-2,-1)$: la misma recta, sentido contrario. Reflejar en un eje o intercambiar componentes son otras operaciones (aplicaciones lineales, MML §2.7), no escalados.', en: '$-' + U + '=(-2,-1)$: same line, opposite direction. Reflecting across an axis or swapping components are different operations (linear mappings, MML §2.7), not scalings.' },
      },
      capas: [FU, ESCALA], par: { l: -1 },
      es: 'Con $\\lambda=-1$ obtienes el **opuesto** $-' + U + '$, el que cumple $' + U + '+(-' + U + ')=' + B('0') + '$.',
      en: 'With $\\lambda=-1$ you get the **inverse** $-' + U + '$, the one with $' + U + '+(-' + U + ')=' + B('0') + '$.' },

    // ── Ejemplos de vectores (MML cap. 2, lista 1–4) ──
    { sec: { es: 'No todo vector es una flecha', en: 'Not every vector is an arrow' }, capas: [FU, FV, SUMA], par: { l: 1.5 },
      es: 'Ejemplos de MML cap. 2: (1) **vectores geométricos**, las flechas de aquí; (2) **polinomios**: $(p+q)(x)=p(x)+q(x)$ y $\\lambda p$ siguen siendo polinomios; (3) **señales de audio**: series de números que se suman (mezclar) y escalan (volumen); (4) $\\mathbb{R}^n$, las listas de $n$ números reales.',
      en: 'Examples from MML ch. 2: (1) **geometric vectors**, the arrows here; (2) **polynomials**: $(p+q)(x)=p(x)+q(x)$ and $\\lambda p$ are still polynomials; (3) **audio signals**: series of numbers that add (mixing) and scale (volume); (4) $\\mathbb{R}^n$, lists of $n$ real numbers.' },
    { es: 'MML se centra en $\\mathbb{R}^n$ porque casi todos los algoritmos se escriben ahí y porque, en dimensión finita, todo espacio vectorial se corresponde uno a uno con algún $\\mathbb{R}^n$. Por ejemplo $' + B('a') + '=[1,2,3]^\\top\\in\\mathbb{R}^3$, y si $' + B('a') + ',' + B('b') + '\\in\\mathbb{R}^n$ entonces $' + B('a') + '+' + B('b') + '\\in\\mathbb{R}^n$ y $\\lambda' + B('a') + '\\in\\mathbb{R}^n$.',
      en: 'MML focuses on $\\mathbb{R}^n$ because almost every algorithm is written there and because, in finite dimension, every vector space corresponds one to one with some $\\mathbb{R}^n$. For example $' + B('a') + '=[1,2,3]^\\top\\in\\mathbb{R}^3$, and if $' + B('a') + ',' + B('b') + '\\in\\mathbb{R}^n$ then $' + B('a') + '+' + B('b') + '\\in\\mathbb{R}^n$ and $\\lambda' + B('a') + '\\in\\mathbb{R}^n$.' },
    { sec: { es: 'ℝⁿ y el ordenador', en: 'ℝⁿ and the computer' },
      es: 'Un vector de $\\mathbb{R}^n$ se guarda como un array, pero **cuidado** (aviso de MML cap. 2): comprueba que la operación del lenguaje es la operación vectorial. En Python, `[1, 2] + [3, 4]` **concatena** listas; con NumPy, `np.array([1, 2]) + np.array([3, 4])` sí suma componente a componente.',
      en: 'A vector of $\\mathbb{R}^n$ is stored as an array, but **careful** (a warning from MML ch. 2): check that the language\'s operation is the vector operation. In Python, `[1, 2] + [3, 4]` **concatenates** lists; with NumPy, `np.array([1, 2]) + np.array([3, 4])` does add component-wise.' },
    { es: '¿Qué devuelve Python con `[1, 2] + [3, 4]` (listas, sin NumPy)?',
      en: 'What does Python return for `[1, 2] + [3, 4]` (lists, no NumPy)?',
      pregunta: {
        opc: [
          { es: '`[4, 6]`, la suma de vectores', en: '`[4, 6]`, the vector sum' },
          { es: '`[1, 2, 3, 4]`: el `+` de listas concatena', en: '`[1, 2, 3, 4]`: list `+` concatenates', ok: 1 },
          { es: 'Un error de tipos', en: 'A type error' },
        ],
        why: {
          es: 'Para listas, `+` significa «pegar una detrás de otra»: el resultado tiene 4 elementos, ni siquiera vive en $\\mathbb{R}^2$. La suma vectorial necesita NumPy (o un bucle). Otro caso: en NumPy `a * b` multiplica componente a componente, que **no** es una operación de espacio vectorial.',
          en: 'For lists, `+` means "glue one after the other": the result has 4 elements, it does not even live in $\\mathbb{R}^2$. Vector addition needs NumPy (or a loop). Another trap: in NumPy `a * b` multiplies component-wise, which is **not** a vector-space operation.',
        },
        pistas: [{ es: 'Piensa en qué hace `+` con dos cadenas de texto en Python.', en: 'Think about what `+` does to two strings in Python.' }],
      } },

    // ── Clausura (MML cap. 2) ──
    { sec: { es: 'Clausura: todo lo que se puede alcanzar', en: 'Closure: everything you can reach' }, capas: [SPAN, FU, FV, COMB], par: { a: 1, b: 1 },
      es: 'Gran idea de MML cap. 2: la **clausura**. Empieza con unos pocos vectores y súmalos y escálalos cuanto quieras: ¿qué conjunto obtienes? Con $' + U + '$ y $' + V + '$ obtienes todas las **combinaciones lineales** $a' + U + '+b' + V + '$. Ese conjunto es un **espacio vectorial** (MML §2.4).',
      en: 'A big idea from MML ch. 2: **closure**. Start with a few vectors and add and scale them as much as you like: what set do you get? With $' + U + '$ and $' + V + '$ you get every **linear combination** $a' + U + '+b' + V + '$. That set is a **vector space** (MML §2.4).' },
    { capas: [SPAN, FU, FV, COMB],
      es: 'Mueve $a$ y $b$, o arrastra $' + U + '$ y $' + V + '$. La zona sombreada es el **subespacio generado**: con dos vectores no paralelos alcanzas **cualquier** punto del plano. Prueba a llevar $(3,-2)$ con los deslizadores.',
      en: 'Move $a$ and $b$, or drag $' + U + '$ and $' + V + '$. The shaded area is the **span**: with two non-parallel vectors you reach **any** point of the plane. Try to reach $(3,-2)$ with the sliders.',
      jugar: {
        botones: [
          { label: 'a = 0, b = 0', hacer: v => { v.a = 0; v.b = 0; } },
          { label: { es: 'u y v de nuevo', en: 'reset u and v' }, hacer: v => { v.vec.u = [2, 1]; v.vec.v = [-1, 2]; } },
          { label: { es: 'v paralelo a u', en: 'v parallel to u' }, hacer: v => { v.vec.v = [-v.vec.u[0], -v.vec.u[1]]; } },
        ],
        lecturas: (v, cx) => {
          const d = cx.dim([v.vec.u, v.vec.v]);
          return [
            { expr: `$a${U}+b${V}$`, valor: par2(cx, cx.comb([v.a, v.b], [v.vec.u, v.vec.v])) },
            { expr: { es: 'dimensión del generado (0 punto, 1 recta, 2 plano)', en: 'dimension of the span (0 point, 1 line, 2 plane)' }, valor: d, malo: d < 2 },
            { expr: `$u_1v_2-u_2v_1$`, valor: cx.fmt(cx.det(v.vec.u, v.vec.v)), malo: d < 2 },
          ];
        },
        arrastrables: true, soltar,
      } },
    { deriva: {
        pregunta: { es: 'Ahora $' + V + '=(-4,-2)=-2' + U + '$. ¿Qué alcanzan todas las combinaciones $a' + U + '+b' + V + '$?', en: 'Now $' + V + '=(-4,-2)=-2' + U + '$. What do all combinations $a' + U + '+b' + V + '$ reach?' },
        opciones: [{ es: 'Todo el plano', en: 'The whole plane' }, { es: 'Una recta que pasa por el origen', en: 'A line through the origin' }, { es: 'Solo los puntos $' + U + '$ y $' + V + '$', en: 'Only the points $' + U + '$ and $' + V + '$' }], correcta: 1,
        razones: [
          { es: '$a' + U + '+b' + V + '=(a-2b)' + U + '$: siempre un múltiplo de $' + U + '$', en: '$a' + U + '+b' + V + '=(a-2b)' + U + '$: always a multiple of $' + U + '$' },
          { es: 'Dos vectores distintos siempre generan el plano', en: 'Two different vectors always span the plane' },
          { es: 'Los coeficientes solo pueden ser enteros', en: 'Coefficients can only be integers' },
        ], razonCorrecta: 0,
        pistas: [{ es: 'Sustituye $' + V + '=-2' + U + '$ en $a' + U + '+b' + V + '$ y saca factor común.', en: 'Substitute $' + V + '=-2' + U + '$ into $a' + U + '+b' + V + '$ and factor out.' }],
        revela: { es: 'Si un vector es múltiplo de otro, no aporta nada nuevo: el generado es la recta $\\{t' + U + ':t\\in\\mathbb{R}\\}$. Que los vectores sean distintos no basta: hace falta que sean **linealmente independientes** (MML §2.5).', en: 'If one vector is a multiple of another, it adds nothing new: the span is the line $\\{t' + U + ':t\\in\\mathbb{R}\\}$. Being different is not enough: they must be **linearly independent** (MML §2.5).' },
      },
      vec: { u: [2, 1], v: [-4, -2] }, capas: [SPAN, FU, FV, COMB], par: { a: 1, b: .25 },
      es: 'Con $' + V + '=-2' + U + '$ el generado colapsa a una recta: $u_1v_2-u_2v_1=2\\cdot(-2)-1\\cdot(-4)=0$. Ese número, el **determinante** (MML §4.1), es $0$ justo cuando los dos vectores son paralelos.',
      en: 'With $' + V + '=-2' + U + '$ the span collapses to a line: $u_1v_2-u_2v_1=2\\cdot(-2)-1\\cdot(-4)=0$. That number, the **determinant** (MML §4.1), is $0$ exactly when the two vectors are parallel.' },

    // ── El mapa del libro (MML §1.2, Fig. 1.1) ──
    { sec: { es: 'El mapa: Parte I', en: 'The map: Part I' }, vec: { u: [2, 1], v: [-1, 2] }, capas: [SPAN, FU, FV],
      es: 'MML tiene dos partes (§1.2). La **Parte I** son los cimientos: cap. 2 álgebra lineal (vectores y matrices), cap. 3 geometría analítica (normas, ángulos, proyecciones: similitud entre datos), cap. 4 descomposiciones de matrices, cap. 5 cálculo vectorial (gradientes), cap. 6 probabilidad (incertidumbre) y cap. 7 optimización continua.',
      en: 'MML has two parts (§1.2). **Part I** is the foundation: ch. 2 linear algebra (vectors and matrices), ch. 3 analytic geometry (norms, angles, projections: similarity between data), ch. 4 matrix decompositions, ch. 5 vector calculus (gradients), ch. 6 probability (uncertainty) and ch. 7 continuous optimization.' },
    { sec: { es: 'El mapa: Parte II', en: 'The map: Part II' },
      es: 'La **Parte II** usa esos cimientos en cuatro pilares: **regresión** lineal (cap. 9, mínimos cuadrados con álgebra lineal), **reducción de dimensión** con PCA (cap. 10, proyecciones de §3.8), **estimación de densidad** con mezclas de gaussianas (cap. 11) y **clasificación** con SVM (cap. 12). El cap. 8 formaliza datos, modelos y aprendizaje.',
      en: '**Part II** uses that foundation in four pillars: linear **regression** (ch. 9, least squares with linear algebra), **dimensionality reduction** with PCA (ch. 10, projections from §3.8), **density estimation** with Gaussian mixtures (ch. 11) and **classification** with SVMs (ch. 12). Ch. 8 formalizes data, models and learning.' },
    { es: '¿Qué pilar trabaja **sin etiquetas** y busca una representación de **menor dimensión** de datos $' + B('x') + '\\in\\mathbb{R}^D$?',
      en: 'Which pillar works **without labels** and looks for a **lower-dimensional** representation of data $' + B('x') + '\\in\\mathbb{R}^D$?',
      pregunta: {
        opc: [
          { es: 'Regresión lineal (cap. 9)', en: 'Linear regression (ch. 9)' },
          { es: 'Reducción de dimensión con PCA (cap. 10)', en: 'Dimensionality reduction with PCA (ch. 10)', ok: 1 },
          { es: 'Clasificación con SVM (cap. 12)', en: 'Classification with SVMs (ch. 12)' },
          { es: 'Estimación de densidad (cap. 11)', en: 'Density estimation (ch. 11)' },
        ],
        why: {
          es: 'Regresión y clasificación tienen etiquetas $y$ (reales o enteras). La estimación de densidad tampoco usa etiquetas, pero busca una distribución, no una representación más pequeña. PCA comprime $' + B('x') + '\\in\\mathbb{R}^D$ a menos coordenadas (MML §1.2).',
          en: 'Regression and classification have labels $y$ (real or integer). Density estimation has no labels either, but it seeks a distribution, not a smaller representation. PCA compresses $' + B('x') + '\\in\\mathbb{R}^D$ into fewer coordinates (MML §1.2).',
        },
      } },
    { sec: { es: 'Dos formas de leer', en: 'Two ways to read' },
      es: 'MML admite dos lecturas (§1.2): **de abajo arriba**, de los fundamentos a lo avanzado (sólido, pero se olvida qué motiva cada definición), y **de arriba abajo**, de la aplicación a lo que necesita (motivado, pero con cimientos frágiles). Estas guías recorren la Parte I de abajo arriba y en cada concepto señalan dónde se usa en la Parte II.',
      en: 'MML supports two readings (§1.2): **bottom-up**, from foundations to advanced topics (solid, but you forget what motivates each definition), and **top-down**, from the application to what it needs (motivated, but on shaky foundations). These guides walk Part I bottom-up and, for each concept, point to where Part II uses it.' },

    // ── Notación MML ──
    { sec: { es: 'Notación', en: 'Notation' },
      es: 'La notación de MML (tabla de símbolos), que usaremos siempre: escalares en cursiva minúscula ($a,b,\\lambda$); vectores en **negrita minúscula** ($' + B('x') + ',' + B('y') + '$); matrices en **negrita mayúscula** ($' + B('A') + ',' + B('B') + '$). $D$ es el número de dimensiones y $N$ el de datos.',
      en: 'MML\'s notation (table of symbols), which we will always use: scalars in lowercase italics ($a,b,\\lambda$); vectors in **bold lowercase** ($' + B('x') + ',' + B('y') + '$); matrices in **bold uppercase** ($' + B('A') + ',' + B('B') + '$). $D$ is the number of dimensions and $N$ the number of data points.' },
    { es: 'Un vector $' + B('x') + '\\in\\mathbb{R}^n$ es, por defecto, una **columna** ($\\mathbb{R}^{n\\times1}$); la fila correspondiente es su traspuesta $' + B('x') + '^\\top\\in\\mathbb{R}^{1\\times n}$ (MML §2.4). La distinción importa en cuanto multiplicamos matrices: $' + B('x') + '^\\top' + B('y') + '$ es un número y $' + B('x') + B('y') + '^\\top$ una matriz $n\\times n$.',
      en: 'A vector $' + B('x') + '\\in\\mathbb{R}^n$ is a **column** by default ($\\mathbb{R}^{n\\times1}$); the matching row is its transpose $' + B('x') + '^\\top\\in\\mathbb{R}^{1\\times n}$ (MML §2.4). The distinction matters as soon as we multiply matrices: $' + B('x') + '^\\top' + B('y') + '$ is a number and $' + B('x') + B('y') + '^\\top$ is an $n\\times n$ matrix.' },
    { sec: { es: 'Aviso: el gradiente es una fila', en: 'Warning: the gradient is a row' },
      es: '**Ojo**: MML define el gradiente de $f:\\mathbb{R}^n\\to\\mathbb{R}$ como un vector **fila**: $\\nabla_{' + B('x') + '}f=\\left[\\frac{\\partial f}{\\partial x_1}\\;\\cdots\\;\\frac{\\partial f}{\\partial x_n}\\right]\\in\\mathbb{R}^{1\\times n}$ (MML §5.2). Muchos libros lo escriben en columna. MML lo hace así para que el gradiente pase a ser una matriz (el jacobiano) sin cambiar nada.',
      en: '**Careful**: MML defines the gradient of $f:\\mathbb{R}^n\\to\\mathbb{R}$ as a **row** vector: $\\nabla_{' + B('x') + '}f=\\left[\\frac{\\partial f}{\\partial x_1}\\;\\cdots\\;\\frac{\\partial f}{\\partial x_n}\\right]\\in\\mathbb{R}^{1\\times n}$ (MML §5.2). Many books write it as a column. MML does this so the gradient becomes a matrix (the Jacobian) with nothing changed.' },
    { es: 'La segunda razón (MML §5.2): con gradientes en fila, la **regla de la cadena** multivariable es un producto de matrices en el orden natural, sin trasponer nada. Lo aprovecharemos en backpropagation (MML §5.6). Si comparas con otro libro, comprueba su convención.',
      en: 'The second reason (MML §5.2): with row gradients the multivariate **chain rule** is a matrix product in the natural order, with no transposes. We will use it in backpropagation (MML §5.6). When you compare with another book, check its convention.' },
    { es: 'Con la convención de MML, si $' + B('x') + '\\in\\mathbb{R}^3$ (columna) y $f:\\mathbb{R}^3\\to\\mathbb{R}$, ¿dónde vive $\\nabla_{' + B('x') + '}f$?',
      en: 'With MML\'s convention, if $' + B('x') + '\\in\\mathbb{R}^3$ (column) and $f:\\mathbb{R}^3\\to\\mathbb{R}$, where does $\\nabla_{' + B('x') + '}f$ live?',
      pregunta: {
        opc: [
          { es: '$\\mathbb{R}^{3\\times1}$, igual que $' + B('x') + '$', en: '$\\mathbb{R}^{3\\times1}$, like $' + B('x') + '$' },
          { es: '$\\mathbb{R}^{1\\times3}$, una fila', en: '$\\mathbb{R}^{1\\times3}$, a row', ok: 1 },
          { es: '$\\mathbb{R}$, porque $f$ devuelve un número', en: '$\\mathbb{R}$, because $f$ returns a number' },
        ],
        why: {
          es: 'Una derivada parcial por variable, puestas en fila: $1\\times3$ (filas = dimensión de la salida, columnas = de la entrada). Es el caso $m=1$ del jacobiano $m\\times n$ de MML §5.3.',
          en: 'One partial derivative per variable, laid out as a row: $1\\times3$ (rows = output dimension, columns = input dimension). It is the $m=1$ case of the $m\\times n$ Jacobian in MML §5.3.',
        },
      } },
    { sec: { es: 'Lo que viene', en: 'What comes next' }, capas: [SPAN, FU, FV, COMB], par: { a: 1, b: 1 },
      es: 'Resumen: un vector es cualquier cosa que se suma y se escala; trabajamos en $\\mathbb{R}^n$; combinar vectores genera subespacios, y que generen «todo» depende de la independencia lineal. Siguiente guía: **sistemas de ecuaciones lineales** y matrices (MML §2.1–2.2), donde estas combinaciones se convierten en ecuaciones.',
      en: 'Summary: a vector is anything that can be added and scaled; we work in $\\mathbb{R}^n$; combining vectors generates subspaces, and whether they span "everything" depends on linear independence. Next guide: **systems of linear equations** and matrices (MML §2.1–2.2), where these combinations become equations.' },
  ],
};
