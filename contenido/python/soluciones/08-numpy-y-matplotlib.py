"""
SOLUCIONES · Tema 8 · NumPy y matplotlib
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`numpy as np` ya está importado en el
ejemplo.)
"""


def normalizar(x):
    """
    Z-score vectorizado.

    @complejidad Tiempo O(n); espacio O(n).
    @explicacion Dos reducciones (media y desviación) y una resta/división sobre el array entero, todo en C. Si la
    desviación es 0 se devuelven ceros para no producir nan. `np.asarray(..., dtype=float)` acepta listas sin
    modificar el original.
    @alternativas Bucle con listas: mismo O(n) pero decenas de veces más lento (factor constante).
    @bigo n
    """
    x = np.asarray(x, dtype=float)
    desviacion = x.std()
    if desviacion == 0:
        return np.zeros_like(x)
    return (x - x.mean()) / desviacion


def distancias_por_pares(a, b):
    """
    Distancias euclídeas por pares con broadcasting.

    @complejidad Tiempo O(n·m·d); espacio O(n·m·d) por el array intermedio.
    @explicacion `a[:, None, :] - b[None, :, :]` tiene shape (n, m, d): cada fila de a menos cada fila de b. Se
    suman los cuadrados en el último axis y se saca la raíz.
    @alternativas Dos bucles for (misma complejidad, mucho más lento); `scipy.spatial.distance.cdist` evita el array
    intermedio gigante.
    """
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    diferencias = a[:, None, :] - b[None, :, :]
    return np.sqrt((diferencias ** 2).sum(axis=-1))


def media_movil(x, k: int):
    """
    Media móvil por convolución.

    @complejidad Tiempo O(n·k); espacio O(n).
    @explicacion Convolucionar con una ventana de k valores 1/k suma k vecinos ponderados; `mode='valid'` descarta
    los bordes incompletos y deja n - k + 1 valores. Con k fijo el coste es lineal en n.
    @alternativas Suma acumulada (`cumsum`): O(n) aunque k sea grande; bucle con slices: O(n·k) en intérprete.
    @bigo n
    """
    x = np.asarray(x, dtype=float)
    if k < 1 or k > len(x):
        raise ValueError('k debe estar entre 1 y len(x)')
    return np.convolve(x, np.ones(k) / k, mode='valid')


def histograma(datos, n_bins: int, minimo: float, maximo: float):
    """
    Histograma con aritmética y bincount.

    @complejidad Tiempo O(n + bins); espacio O(n).
    @explicacion El índice de cada dato es floor((d - minimo) / ancho). Una máscara descarta los de fuera; el máximo
    exacto se lleva al último bin; `bincount` cuenta cuántos índices hay de cada valor.
    @alternativas `np.histogram` (hace exactamente esto); un bucle con if por dato (lento).
    """
    if n_bins < 1 or maximo <= minimo:
        raise ValueError('n_bins >= 1 y maximo > minimo')
    datos = np.asarray(datos, dtype=float)
    dentro = datos[(datos >= minimo) & (datos <= maximo)]
    indices = np.floor((dentro - minimo) / (maximo - minimo) * n_bins).astype(int)
    indices = np.minimum(indices, n_bins - 1)
    return np.bincount(indices, minlength=n_bins)


def softmax(x):
    """
    Softmax estable.

    @complejidad Tiempo O(n); espacio O(n).
    @explicacion Restar el máximo deja todos los exponentes en (-inf, 0], así exp nunca desborda; el resultado es el
    mismo porque el factor común se cancela entre numerador y denominador. `axis=-1, keepdims=True` permite
    aplicarlo a cada fila de una matriz con broadcasting.
    @alternativas exp(x) / exp(x).sum() directo: da nan con valores grandes; `scipy.special.softmax`.
    """
    x = np.asarray(x, dtype=float)
    e = np.exp(x - x.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)


def regresion_lineal(x, y):
    """
    Recta de mínimos cuadrados con lstsq.

    @complejidad Tiempo O(n) para n puntos y 2 parámetros; espacio O(n).
    @explicacion La matriz de diseño [x, 1] hace que A @ [m, b] = m·x + b; `lstsq` minimiza ||A p - y||² con una
    descomposición numéricamente estable.
    @alternativas `np.polyfit(x, y, 1)`; la ecuación normal con inversa (inestable si las columnas son casi dependientes).
    """
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    A = np.column_stack([x, np.ones_like(x)])
    return np.linalg.lstsq(A, y, rcond=None)[0]
