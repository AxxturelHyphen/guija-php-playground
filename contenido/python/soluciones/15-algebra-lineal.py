"""
SOLUCIONES · Tema 15 · Álgebra lineal para ML
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`math` y `np` ya están importados en el ejemplo.)
"""


def _vector(v) -> np.ndarray:
    """
    Convierte una secuencia 1-D a ndarray float; cualquier otra forma es un error de uso.

    @complejidad Tiempo y espacio O(n) por la copia en float.
    @explicacion `np.asarray(..., dtype=float)` copia los enteros a coma flotante y rechaza de paso las listas
    irregulares; comprobar `ndim == 1` evita que una matriz se cuele como si fuera un vector (un producto escalar
    entre matrices no daría un número).
    @alternativas Convertir en cada función con `np.array` (duplica la validación); validar con `len(v)` y confiar en
    el tipo (falla con ndarrays 2-D).
    """
    a = np.asarray(v, dtype=float)
    if a.ndim != 1:
        raise ValueError('se esperaba una secuencia 1-D')
    return a


def coseno(u, v) -> float:
    """
    Coseno del ángulo entre u y v (similitud coseno).

    @complejidad Tiempo O(n); espacio O(n) por las dos copias en float (O(1) adicional).
    @explicacion Por Cauchy–Schwarz |u·v| ≤ |u||v|, así que el cociente cae en [−1, 1] y es exactamente cos θ. Se
    convierten ambos vectores a float para no truncar enteros y se comprueba la norma antes de dividir: un vector nulo
    no define dirección y el cociente sería 0/0. El recorte final a [−1, 1] solo corrige el último bit del redondeo
    (1.0000000000000002), que rompería un arccos posterior; no cambia ningún coseno real.
    @alternativas `scipy.spatial.distance.cosine` (devuelve 1 − cos); normalizar los vectores y usar solo el producto
    escalar cuando se comparan muchos pares (una matriz En @ Enᵀ).
    """
    a, b = _vector(u), _vector(v)
    if a.size != b.size:
        raise ValueError('u y v deben tener la misma longitud')
    na, nb = float(np.linalg.norm(a)), float(np.linalg.norm(b))
    if na == 0.0 or nb == 0.0:
        raise ValueError('el coseno no está definido con un vector nulo')
    return float(np.clip((a @ b) / (na * nb), -1.0, 1.0))


def proyeccion(u, v) -> np.ndarray:
    """
    Proyección ortogonal de u sobre la recta generada por v.

    @complejidad Tiempo O(n); espacio O(n) por la copia en float.
    @explicacion El punto de la recta {t·v} más cercano a u es p = t·v con t = (u·v)/(v·v): se elige t para que el
    residuo u − p sea perpendicular a v, (u − t·v)·v = 0. Dividir por v·v (y no por |v|) hace que la longitud de v no
    importe. Se valida la norma de v porque un vector nulo no genera una recta y v·v sería 0.
    @alternativas Proyectar sobre un subespacio con Q(Qᵀu) a partir de una base ortonormal (QR); mínimos cuadrados
    (sección 3) es la misma idea sobre todo col(A).
    """
    a, b = _vector(u), _vector(v)
    if a.size != b.size:
        raise ValueError('u y v deben tener la misma longitud')
    bb = float(b @ b)
    if bb == 0.0:
        raise ValueError('v nulo no define una recta')
    return (float(a @ b) / bb) * b


def resolver(A, b) -> np.ndarray:
    """
    Resuelve A x = b por eliminación gaussiana con pivoteo parcial.

    @complejidad Tiempo O(n³); espacio O(n²) por la copia de A.
    @explicacion Se elimina columna a columna: en la columna k se busca la fila con mayor |A[i, k]|, se intercambia con
    la fila k y se anula lo que queda debajo restando un múltiplo de la fila pivote. Elegir el mayor pivote (no el
    primero no nulo) mantiene pequeños los multiplicadores y evita dividir por 1e-20. Un pivote menor o igual que
    1e-12 · max|A| significa que la matriz es (numéricamente) singular: no hay solución única. Al final, la sustitución
    hacia atrás despeja x de abajo arriba. Todo se hace sobre copias en float para no truncar enteros ni modificar las
    entradas.
    @alternativas Descomposición LU con pivoteo (reutiliza la factorización con varios b); QR (más estable, O(mn²));
    `np.linalg.solve` (LAPACK); para sistemas dispersos, métodos iterativos.
    """
    M = np.array(A, dtype=float)
    c = np.array(b, dtype=float)
    if M.ndim != 2 or M.shape[0] != M.shape[1]:
        raise ValueError('A debe ser cuadrada')
    if c.ndim != 1 or c.size != M.shape[0]:
        raise ValueError('b debe tener una entrada por fila de A')
    n = M.shape[0]
    escala = float(np.abs(M).max()) if n else 0.0
    for k in range(n):
        i = k + int(np.argmax(np.abs(M[k:, k])))
        pivote = M[i, k]
        if escala == 0.0 or abs(pivote) <= 1e-12 * escala:
            raise ValueError('la matriz es singular')
        if i != k:
            M[[k, i]] = M[[i, k]]
            c[[k, i]] = c[[i, k]]
        for f in range(k + 1, n):
            factor = M[f, k] / pivote
            M[f, k:] -= factor * M[k, k:]
            c[f] -= factor * c[k]
    x = np.zeros(n)
    for i in range(n - 1, -1, -1):
        x[i] = (c[i] - M[i, i + 1:] @ x[i + 1:]) / M[i, i]
    return x


def minimos_cuadrados(A, b) -> np.ndarray:
    """
    Solución de mínimos cuadrados de A x ≈ b por las ecuaciones normales.

    @complejidad Tiempo O(mn² + n³); espacio O(mn) por las copias y AᵀA.
    @explicacion El punto de col(A) más cercano a b es su proyección, y el residuo es perpendicular a cada columna:
    Aᵀ(Ax − b) = 0, es decir AᵀA x = Aᵀb. Es la ecuación que anula el gradiente de |Ax − b|². Para que AᵀA sea
    invertible hacen falta rango completo por columnas y m ≥ n; se comprueba antes de resolver para dar un error claro
    en vez de un LinAlgError. Se usa `np.linalg.solve` a propósito: el ejercicio no depende del `resolver` anterior.
    @alternativas QR (A = QR ⇒ R x = Qᵀb): evita elevar al cuadrado el número de condición; SVD/`lstsq` (la más
    robusta con columnas casi dependientes); ecuaciones normales con regularización de Tikhonov.
    """
    M = np.array(A, dtype=float)
    c = np.array(b, dtype=float)
    if M.ndim != 2 or c.ndim != 1 or M.shape[0] != c.size:
        raise ValueError('A debe ser (m, n) y b de forma (m,)')
    m, n = M.shape
    if m < n:
        raise ValueError('hacen falta al menos tantas ecuaciones como incógnitas')
    if np.linalg.matrix_rank(M) < n:
        raise ValueError('las columnas de A son dependientes: AᵀA es singular')
    return np.linalg.solve(M.T @ M, M.T @ c)


def autovalor_dominante(A, iteraciones: int = 1000, semilla: int = 0) -> tuple:
    """
    Autovalor de mayor módulo y su autovector por iteración de potencias.

    @complejidad Tiempo O(iteraciones · n²); espacio O(n²) por la copia de A.
    @explicacion Si v = Σ cᵢvᵢ, entonces Aᵏv = Σ cᵢλᵢᵏvᵢ: el término con mayor |λ| domina y la dirección converge a su
    autovector con razón |λ₂/λ₁| por paso. Normalizar en cada paso mantiene la norma en 1 y evita desbordamientos (con
    λ = 10 y 1000 pasos, sin normalizar habría 10¹⁰⁰⁰). Si A v = 0 el vector ha caído en el núcleo y no hay dirección
    dominante que extraer. El cociente de Rayleigh v·(Av) con |v| = 1 da λ, y el signo canónico fija la ambigüedad
    ±v para que el resultado sea reproducible.
    @alternativas Iteración de potencias inversa (autovalor más pequeño, con LU); iteración de Rayleigh (convergencia
    cúbica en matrices simétricas); `np.linalg.eig`/`eigh` (todos los autovalores, O(n³), mejor para n pequeño).
    """
    M = np.array(A, dtype=float)
    if M.ndim != 2 or M.shape[0] != M.shape[1]:
        raise ValueError('A debe ser cuadrada')
    n = M.shape[0]
    v = np.random.default_rng(semilla).normal(size=n)
    v = v / np.linalg.norm(v)
    for _ in range(iteraciones):
        w = M @ v
        norma = float(np.linalg.norm(w))
        if norma == 0.0:
            raise ValueError('A v = 0: el vector cayó en el núcleo')
        v = w / norma
    lam = float(v @ (M @ v))
    grandes = np.flatnonzero(np.abs(v) > 1e-6)
    if grandes.size and v[grandes[0]] < 0:
        v = -v
    return lam, v


def pca(X, k: int) -> tuple:
    """
    PCA por SVD de los datos centrados.

    @complejidad Tiempo O(n·d·min(n, d)) (la SVD); espacio O(n·d).
    @explicacion Centrar es imprescindible: la SVD descompone la dispersión respecto del origen, y sin restar la media
    la primera componente apuntaría a la media en vez de a la dirección de máxima varianza. Con Xc centrada,
    XcᵀXc/(n−1) = VΣ²Vᵀ/(n−1): las filas de Vᵀ son los autovectores de la covarianza y σᵢ²/(n−1), la varianza muestral
    sobre cada eje. Se devuelven los k primeros (orden decreciente de σ) con el signo canónico, porque el signo de un
    autovector es arbitrario.
    @alternativas `np.linalg.eigh(np.cov(X.T))` (solo simétricas, más barato si d ≪ n); PCA incremental/aleatorio para
    datos que no caben en memoria; kernel PCA para estructura no lineal.
    """
    M = np.array(X, dtype=float)
    if M.ndim != 2:
        raise ValueError('X debe ser (n, d)')
    n, d = M.shape
    if n < 2:
        raise ValueError('hacen falta al menos dos muestras')
    if not 1 <= k <= min(n, d):
        raise ValueError('k debe cumplir 1 <= k <= min(n, d)')
    _, S, Vt = np.linalg.svd(M - M.mean(axis=0), full_matrices=False)
    componentes = np.array([fila if fila[np.flatnonzero(np.abs(fila) > 1e-6)[0]] > 0 else -fila
                            for fila in Vt[:k]])
    varianza = S[:k] ** 2 / (n - 1)
    return componentes, varianza


def aproximacion_rango(A, k: int) -> np.ndarray:
    """
    Mejor aproximación de rango k de A (Eckart–Young).

    @complejidad Tiempo O(mn·min(m, n)) la SVD, más O(mnk) el producto; espacio O(mn).
    @explicacion La SVD escribe A = Σ σᵢuᵢvᵢᵀ, con los σ en orden decreciente. Quedarse con los k primeros términos es
    la mejor aproximación de rango k posible (Eckart–Young) y el error son exactamente los σ descartados. k = 0 devuelve
    la matriz nula y k = min(m, n) reconstruye A. Se usa `full_matrices=False` para no calcular las columnas de U que
    no intervienen.
    @alternativas SVD truncada aleatoria (mucho más rápida en matrices enormes); `scipy.sparse.linalg.svds` para
    dispersas; completar con regularización nuclear si faltan datos.
    """
    M = np.array(A, dtype=float)
    if M.ndim != 2:
        raise ValueError('A debe ser una matriz (m, n)')
    m, n = M.shape
    if not 0 <= k <= min(m, n):
        raise ValueError('k debe cumplir 0 <= k <= min(m, n)')
    if k == 0:
        return np.zeros((m, n))
    U, S, Vt = np.linalg.svd(M, full_matrices=False)
    return (U[:, :k] * S[:k]) @ Vt[:k]
