"""
SOLUCIONES · Tema 16 · Probabilidad y estadística para ML
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`math` y `np` ya están importados en el ejemplo.)
"""


def prob_cumpleanos(k: int, dias: int = 365) -> float:
    """
    Probabilidad exacta de alguna coincidencia de cumpleaños (paradoja del cumpleaños).

    @complejidad Tiempo O(k); espacio O(k) por el array de índices.
    @explicacion La vía directa, 1 − ∏(1 − i/dias), resta dos números casi iguales cuando la probabilidad es diminuta y
    pierde todos los dígitos. Por eso se trabaja en el espacio de los logaritmos: log P(todos distintos) = Σ log(1 − i/dias),
    con `log1p` para no perder precisión cuando i/dias es pequeño, y al final `−expm1(suma)` recupera 1 − e^suma con
    precisión relativa completa. Los casos límite van antes: k ≤ 1 no puede repetir; k > dias es el principio del palomar
    (más personas que días) y vale 1 exacto.
    @alternativas Producto directo con `np.prod(1 - i/dias)` (sencillo, pero catastrófico con muchas casillas y k pequeño);
    simulación de Monte Carlo (estima, no calcula, y su error baja como 1/√n); aproximación 1 − e^(−k(k−1)/2dias) solo para
    intuir el orden de magnitud.
    """
    if k < 0 or dias < 1:
        raise ValueError('k debe ser >= 0 y dias >= 1')
    if k <= 1:
        return 0.0
    if k > dias:
        return 1.0
    suma = np.sum(np.log1p(-np.arange(k, dtype=float) / dias))
    return float(-np.expm1(suma))


def bayes(prior: float, sensibilidad: float, especificidad: float) -> float:
    """
    P(enfermo | positivo) por el teorema de Bayes.

    @complejidad Tiempo O(1); espacio O(1).
    @explicacion P(enfermo | +) = P(+ | enfermo)·P(enfermo) / P(+), y el denominador se abre por probabilidad total:
    P(+) = sens·prior + (1 − esp)·(1 − prior), es decir, positivos verdaderos más falsos positivos. El test parece bueno,
    pero con una prevalencia baja el segundo sumando domina: la tasa base manda. Si P(+) = 0 el positivo es imposible y se
    avisa con ValueError en vez de dejar que salga un ZeroDivisionError.
    @alternativas Frecuencias naturales (contar personas en una tabla 2×2; idéntico y más intuitivo); odds y log-odds
    (la evidencia se suma, base de la regresión logística); actualización secuencial multiplicando odds.
    """
    for nombre, valor in (('prior', prior), ('sensibilidad', sensibilidad), ('especificidad', especificidad)):
        if not 0.0 <= valor <= 1.0:
            raise ValueError(f'{nombre} debe estar en [0, 1]')
    p_positivo = sensibilidad * prior + (1.0 - especificidad) * (1.0 - prior)
    if p_positivo == 0.0:
        raise ValueError('un positivo es imposible con estos parámetros')
    return float(prior * sensibilidad / p_positivo)


def media_varianza(valores, probs) -> tuple:
    """
    Esperanza y varianza de una variable aleatoria discreta.

    @complejidad Tiempo O(n); espacio O(n).
    @explicacion μ = Σ pᵢ·xᵢ y Var = Σ pᵢ·(xᵢ − μ)². La varianza se calcula con la media ya restada, no con E[X²] − μ²:
    si |μ| ≫ σ, esa resta cancela las cifras significativas y puede dar 0 o negativo. Se valida que las probabilidades
    sean no negativas y que sumen 1 (tolerancia 1e-9 por los redondeos de escribir 1/6 seis veces).
    @alternativas E[X²] − μ² (una sola pasada, pero inestable con medias grandes); `np.average` y `np.cov` (pensados para
    muestras, no para distribuciones dadas); fórmula de la varianza de una suma si las variables son independientes.
    """
    x = np.asarray(valores, dtype=float)
    p = np.asarray(probs, dtype=float)
    if x.shape != p.shape:
        raise ValueError('valores y probs deben tener la misma longitud')
    if np.any(p < 0):
        raise ValueError('las probabilidades no pueden ser negativas')
    if abs(float(np.sum(p)) - 1.0) > 1e-9:
        raise ValueError('las probabilidades deben sumar 1')
    media = float(np.sum(p * x))
    varianza = float(np.sum(p * (x - media) ** 2))
    return media, varianza


def mle_gaussiana(datos) -> tuple:
    """
    Estimadores de máxima verosimilitud de una gaussiana.

    @complejidad Tiempo O(n); espacio O(n).
    @explicacion Al maximizar ℓ(μ, σ) = Σ [−log σ − ½log 2π − (xᵢ − μ)²/2σ²], las derivadas se anulan en μ̂ = media y
    σ̂² = (1/n)·Σ(xᵢ − μ̂)². El divisor es n, no n − 1: es el estimador de máxima verosimilitud y es sesgado (E[σ̂²] =
    (n−1)/n·σ²). Se hacen dos pasadas para restar primero la media y no perder precisión con datos de magnitud grande.
    @alternativas Divisor n − 1 (insesgado, el de `np.std(ddof=1)`); actualización online de Welford (una pasada y estable);
    `np.mean` + `np.std` (hacen lo mismo, con la misma estabilidad).
    """
    x = np.asarray(datos, dtype=float).ravel()
    if x.size == 0:
        raise ValueError('la muestra no puede estar vacía')
    mu = float(np.mean(x))
    sigma = float(np.sqrt(np.mean((x - mu) ** 2)))
    return mu, sigma


def entropia_cruzada(p, q) -> float:
    """
    Entropía cruzada H(p, q) = −Σ pᵢ·log qᵢ, en nats.

    @complejidad Tiempo O(n); espacio O(n) por las máscaras.
    @explicacion Solo contribuyen los términos con pᵢ > 0: la convención 0·log 0 = 0 se implementa con una máscara, sin
    evaluar log(0) ni generar avisos. Si pᵢ > 0 y qᵢ = 0 el modelo declara imposible algo que ocurre; el límite es +∞ y se
    devuelve `math.inf` explícitamente, no un nan. No se exige que p y q sumen 1: es una fórmula, no un validador.
    @alternativas H(p) + KL(p‖q) (equivale, pero arrastra el error de dos sumas); `scipy.stats.entropy`; en clasificación,
    `−log softmax(z)[y]` calculado con log-sum-exp para no desbordar.
    """
    p = np.asarray(p, dtype=float)
    q = np.asarray(q, dtype=float)
    if p.shape != q.shape:
        raise ValueError('p y q deben tener la misma longitud')
    if np.any(p < 0) or np.any(q < 0):
        raise ValueError('las probabilidades no pueden ser negativas')
    vive = p > 0
    if np.any(q[vive] == 0):
        return math.inf
    return float(-np.sum(p[vive] * np.log(q[vive])))


def kl(p, q) -> float:
    """
    Divergencia de Kullback-Leibler KL(p‖q) = Σ pᵢ·log(pᵢ/qᵢ), en nats.

    @complejidad Tiempo O(n); espacio O(n) por las máscaras.
    @explicacion Se suma directamente pᵢ·log(pᵢ/qᵢ), no H(p, q) − H(p): así, si p = q, cada cociente es exactamente 1,
    log 1 = 0 y el resultado es 0.0 sin residuos de ±1e-17. Las reglas de 0·log 0 y de q = 0 donde p > 0 son las mismas
    que en la entropía cruzada. No es simétrica y no cumple la desigualdad triangular: es una divergencia, no una distancia.
    @alternativas H(p, q) − H(p) (más error de redondeo); forma simétrica de Jeffreys; `scipy.special.kl_div`.
    """
    p = np.asarray(p, dtype=float)
    q = np.asarray(q, dtype=float)
    if p.shape != q.shape:
        raise ValueError('p y q deben tener la misma longitud')
    if np.any(p < 0) or np.any(q < 0):
        raise ValueError('las probabilidades no pueden ser negativas')
    vive = p > 0
    if np.any(q[vive] == 0):
        return math.inf
    return float(np.sum(p[vive] * np.log(p[vive] / q[vive])))


def sigmoide(z):
    """
    Sigmoide σ(z) = 1/(1 + e^(−z)), estable para |z| enorme.

    @complejidad Tiempo O(tamaño de z); espacio O(tamaño de z).
    @explicacion Solo se exponencia −|z|, que es ≤ 0 y por tanto no desborda: para z ≥ 0 se usa 1/(1 + e^(−z)); para z < 0,
    e^z/(1 + e^z) (el mismo valor, multiplicado arriba y abajo por e^z). Con eso σ(1000) = 1.0 y σ(−1000) = 0.0 sin evaluar
    e^1000. Además las dos ramas comparten denominador en z y −z, así que σ(−z) = 1 − σ(z) sale exacto. Un escalar devuelve
    float y un array conserva su forma.
    @alternativas `scipy.special.expit` (hace exactamente esto); `np.tanh(z/2)/2 + 0.5` (estable y una sola función, algo
    más lenta); la versión ingenua 1/(1 + np.exp(−z)) (desborda con z negativo grande).
    """
    if np.ndim(z) == 0:
        x = float(z)
        if x >= 0:
            return 1.0 / (1.0 + math.exp(-x))
        e = math.exp(x)
        return e / (1.0 + e)
    a = np.asarray(z, dtype=float)
    salida = np.empty_like(a)
    pos = a >= 0
    salida[pos] = 1.0 / (1.0 + np.exp(-a[pos]))
    neg = ~pos
    e = np.exp(a[neg])
    salida[neg] = e / (1.0 + e)
    return salida


def regresion_logistica(X, y, tasa: float, pasos: int) -> tuple:
    """
    Regresión logística binaria por descenso de gradiente.

    @bigo n
    @complejidad Tiempo O(pasos·n·d); espacio O(n) por el vector de probabilidades.
    @explicacion Cada paso calcula p = σ(X·w + b), el error (p − y) y sus dos gradientes: ∂L/∂w = Xᵀ(p − y)/n y
    ∂L/∂b = media(p − y). El factor σ'(z) = p(1 − p) se cancela al derivar la pérdida log, así que no hay que escribirlo.
    Los dos gradientes se calculan con los mismos w y b y solo después se actualizan (descenso simultáneo). Se empieza en
    w = 0, b = 0, y `sigmoide` evita desbordamientos cuando el modelo se vuelve muy seguro.
    @alternativas Forma cerrada iterativamente reweighted least squares (IRLS/Newton: pocas iteraciones, O(n·d²) por paso);
    descenso estocástico o mini-lotes (más barato por paso con n grande); `sklearn.linear_model.LogisticRegression`.
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)
    if X.ndim != 2:
        raise ValueError('X debe ser 2D (una fila por dato)')
    if y.ndim != 1 or y.shape[0] != X.shape[0]:
        raise ValueError('y debe tener una etiqueta por fila de X')
    if np.any((y != 0) & (y != 1)):
        raise ValueError('las etiquetas deben ser 0 o 1')
    if pasos < 0:
        raise ValueError('pasos no puede ser negativo')
    n, d = X.shape
    w = np.zeros(d)
    b = 0.0
    for _ in range(pasos):
        error = sigmoide(X @ w + b) - y
        gradiente_w = X.T @ error / n
        gradiente_b = float(np.mean(error))
        w = w - tasa * gradiente_w
        b = b - tasa * gradiente_b
    return w, float(b)
