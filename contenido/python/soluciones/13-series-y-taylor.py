"""
SOLUCIONES · Tema 13 · Series y Taylor
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`math` ya está importado en el ejemplo.)
"""


def armonico(n: int) -> float:
    """
    Número armónico H_n.

    @complejidad Tiempo O(n); espacio O(1).
    @explicacion Se suma de 1/n hacia 1/1: los términos pequeños se acumulan antes de sumar los grandes, así el redondeo
    pierde menos cifras que sumando de 1 hacia n (donde el acumulador ya es grande y 1/n apenas lo mueve). H_n ≈ ln n + γ
    + 1/(2n): para n grande se puede evitar el bucle con esa fórmula, con error ~1/(12n²).
    @alternativas math.fsum (suma exacta redondeada una sola vez); la aproximación asintótica ln n + γ + 1/(2n) - 1/(12n²) en
    O(1); numpy.cumsum cuando hacen falta todos los H_k a la vez.
    @bigo n
    """
    if n < 0:
        raise ValueError('n no puede ser negativo')
    return sum(1 / k for k in range(n, 0, -1))


def geometrica(r: float, n: int) -> float:
    """
    Suma r^0 + ... + r^(n-1) con la fórmula cerrada.

    @complejidad Tiempo O(1) (una potencia, O(log n) multiplicaciones); espacio O(1).
    @explicacion Si S = 1 + r + ... + r^(n-1), entonces r·S - S = r^n - 1, luego S = (r^n - 1)/(r - 1). Con r = 1 todos los
    términos valen 1 y la suma es n (la fórmula daría 0/0). Se convierte a float para que el resultado lo sea siempre.
    Limitación numérica: si r es casi 1, r^n - 1 resta números casi iguales y se pierden cifras; con r grande y n grande
    la potencia desborda.
    @alternativas Bucle que acumula r^k (O(n), sin pérdida por la resta); math.expm1(n·math.log1p(r - 1))/(r - 1) para r > 0
    cercano a 1; sumar la serie infinita 1/(1 - r) si |r| < 1 y n es grande.
    """
    if n < 0:
        raise ValueError('n no puede ser negativo')
    if r == 1:
        return float(n)
    return (float(r) ** n - 1.0) / (r - 1.0)


def suma_multiplos(n: int) -> list:
    """
    Número de divisores de cada k ≤ n con el bucle «para cada i, sus múltiplos».

    @complejidad Tiempo O(n log n): Σ n/i = n·H_n pasos; espacio O(n).
    @explicacion Para cada i se avanza j = i, 2i, 3i... hasta n y se suma 1 a d[j]: i divide a j. El bucle interno hace n/i
    pasos, así que el total es n(1 + 1/2 + ... + 1/n) = n·H_n ≈ n ln n (la serie armónica es lo que lo domina). No hay
    módulos ni divisiones: solo saltos de i en i. Es la misma estructura que la criba de Eratóstenes.
    @alternativas Contar divisores factorizando cada k por división de prueba (O(n√n)); criba lineal con el menor factor
    primo (O(n)); numpy con d[i::i] += 1 por cada i (mismos n·H_n pasos, pero vectorizado en C).
    @bigo nlogn
    """
    if n < 0:
        raise ValueError('n no puede ser negativo')
    d = [0] * (n + 1)
    for i in range(1, n + 1):
        for j in range(i, n + 1, i):
            d[j] += 1
    return d


def copias_al_crecer(n: int, factor: float) -> int:
    """
    Copias totales de n appends en un array dinámico que multiplica su capacidad.

    @complejidad Tiempo O(n) (un paso por append); espacio O(1). El valor devuelto es < n·factor/(factor - 1): lineal.
    @explicacion Se simula el array: cuando largo == capacidad el append reserva max(cap + 1, ceil(cap·factor)) y copia
    `largo` elementos. Las capacidades en las que se copia forman una serie geométrica de razón ≥ 1/factor; su suma está
    dominada por el último término y vale como mucho n·factor/(factor - 1). Con factor 2 son < 2n copias: O(1) amortizado.
    El max(cap + 1, ...) evita quedarse atascado con capacidades pequeñas y factores cercanos a 1.
    @alternativas Fórmula cerrada para factor 2: 2^ceil(log2 n) - 1 copias en O(1); método del potencial (contable) para
    demostrar el coste amortizado sin simular.
    @bigo n
    """
    if n < 0:
        raise ValueError('n no puede ser negativo')
    if factor <= 1:
        raise ValueError('factor debe ser mayor que 1')
    capacidad, copias = 1, 0
    for largo in range(n):
        if largo == capacidad:
            copias += largo
            capacidad = max(capacidad + 1, math.ceil(capacidad * factor))
    return copias


def copias_en_pasos(n: int, paso: int) -> int:
    """
    Copias totales de n appends cuando la capacidad crece sumando `paso`.

    @complejidad Tiempo O(n) simulando; espacio O(1). El valor devuelto es Θ(n²/paso): cuadrático.
    @explicacion Con capacidad inicial `paso`, se copia al llegar a largo = paso, 2·paso, 3·paso...: son m = (n - 1)//paso
    copias de tamaños paso·j, y su suma es una serie ARITMÉTICA paso·m(m+1)/2 ≈ n²/(2·paso). Cada append «cuesta» de media
    O(n/paso): no es amortizado constante. Por eso list.append y vector::push_back crecen por un factor, no por una
    constante.
    @alternativas Forma cerrada paso·m(m+1)/2 con m = (n - 1)//paso, en O(1).
    """
    if n < 0:
        raise ValueError('n no puede ser negativo')
    if paso < 1:
        raise ValueError('paso debe ser al menos 1')
    capacidad, copias = paso, 0
    for largo in range(n):
        if largo == capacidad:
            copias += largo
            capacidad += paso
    return copias


def exp_taylor(x: float, terminos: int) -> float:
    """
    Polinomio de Taylor de exp en 0 con `terminos` términos.

    @complejidad Tiempo O(terminos); espacio O(1).
    @explicacion El término k+1 es el término k por x/(k+1): x^k/k! = x^(k-1)/(k-1)! · x/k. Así no se calcula ni x**k ni
    k! por separado, que desbordarían mucho antes de que el cociente deje de ser representable. Se acumula en un float
    desde el principio (suma vacía = 0.0). Para x < 0 los términos alternan de signo y hay algo de cancelación; para |x|
    moderado el error es del orden de eps.
    @alternativas Para x < 0 calcular 1/exp_taylor(-x) (sin cancelación); reducción de rango exp(x) = 2^k·exp(r) con |r| ≤
    ln2/2, que es lo que hacen las librerías; Horner con coeficientes 1/k! precalculados.
    """
    if terminos < 0:
        raise ValueError('terminos no puede ser negativo')
    suma, termino = 0.0, 1.0
    for k in range(terminos):
        suma += termino
        termino *= x / (k + 1)
    return suma


def sin_taylor(x: float, tol: float = 1e-12) -> float:
    """
    sin(x) por Taylor con reducción de rango y parada por cota.

    @complejidad Tiempo O(log(1/tol)) términos, independiente de |x|; espacio O(1).
    @explicacion Primero x ← x - 2π·round(x/2π) lo deja en [-π, π] (sin es 2π-periódica): sin ello los términos x^k/k! de un
    x grande llegan a ~e^x y la suma se cancela catastróficamente. Después cada término sale del anterior por
    -x²/((2k)(2k+1)). El resto de Lagrange con |sin⁽ⁿ⁾| ≤ 1 acota el error de lo sumado por el primer término omitido, así
    que se para cuando |término| < tol sin sumarlo. Con |x| ≤ π el factor x²/((2k)(2k+1)) < 1 desde k = 2: los términos
    decrecen y la parada llega pronto. Se rechaza tol ≤ 0 (no pararía) y x no finito (round(inf) no existe).
    @alternativas Reducción a [-π/4, π/4] usando simetrías de sin y cos (menos términos, lo habitual en libm); polinomio
    minimax o aproximación de Chebyshev (menor error con el mismo grado); CORDIC en hardware sin multiplicadores.
    """
    if not math.isfinite(x):
        raise ValueError('x debe ser finito')
    if tol <= 0:
        raise ValueError('tol debe ser positiva')
    x = x - 2 * math.pi * round(x / (2 * math.pi))
    termino = suma = x
    k = 1
    while True:
        termino *= -x * x / ((2 * k) * (2 * k + 1))
        if abs(termino) < tol:
            return float(suma)
        suma += termino
        k += 1


def terminos_para_error(x: float, tol: float) -> int:
    """
    Términos de la serie de exp que garantizan error < tol según Lagrange.

    @complejidad Tiempo O(N), con N el resultado (≈ el menor N con |x|^N/N! < tol, que crece con |x| y con log(1/tol)); espacio O(1).
    @explicacion El error de truncar tras N términos es R_N = e^c·x^N/N! con c entre 0 y x, y e^c ≤ e^max(x, 0). Se busca el
    menor N con esa cota < tol. |x|^N/N! se actualiza multiplicando por |x|/N en cada paso. El bucle termina siempre porque
    N! crece más que cualquier potencia. La cota es suficiente, no necesaria: el error real suele ser menor.
    @alternativas Despejar N con la fórmula de Stirling (aproximada, O(1)); búsqueda binaria sobre N (innecesaria: el
    bucle ya es corto); si la cota es muy pesimista, parar cuando el término sumado baje de tol (criterio práctico, sin garantía).
    """
    if tol <= 0:
        raise ValueError('tol debe ser positiva')
    factor = math.exp(max(x, 0.0))
    n, t = 0, 1.0
    while factor * t >= tol:
        n += 1
        t *= abs(x) / n
    return n
