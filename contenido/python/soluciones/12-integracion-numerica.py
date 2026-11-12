"""
SOLUCIONES · Tema 12 · Integración numérica y Monte Carlo
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`math`, `numpy as np` y `matplotlib.pyplot`
ya están importados en el ejemplo.)
"""


def riemann(f, a: float, b: float, n: int, regla: str = 'medio') -> float:
    """
    Suma de Riemann con nodos a la izquierda, a la derecha o en el centro de cada rectángulo.

    @complejidad Tiempo O(n): una evaluación vectorizada de f en n nodos; espacio O(n) por el array de nodos.
    @explicacion El desplazamiento dentro de cada trozo (0, 1 o 0.5) es lo único que cambia entre reglas: los nodos son
    a + (k + desplazamiento)·h. La izquierda y la derecha cometen un error O(h) (f' no se anula, el rectángulo se queda
    corto o se pasa siempre del mismo lado); en el punto medio el defecto de un lado compensa el exceso del otro y queda
    O(h²). Si a > b, h es negativo y el signo sale solo, igual que en la integral orientada.
    @alternativas Trapecios (orden 2, y exacta para rectas) y Simpson (orden 4) con el mismo coste; cuadratura de Gauss
    (exacta para polinomios de grado 2n-1 con solo n nodos); scipy.integrate.quad (adaptativa, con estimación del error).
    """
    desplazamiento = {'izquierda': 0.0, 'derecha': 1.0, 'medio': 0.5}.get(regla)
    if desplazamiento is None:
        raise ValueError("regla debe ser 'izquierda', 'derecha' o 'medio'")
    if n < 1:
        raise ValueError('n debe ser al menos 1')
    h = (b - a) / n
    nodos = a + (np.arange(n) + desplazamiento) * h
    return float(h * np.sum(f(nodos)))


def trapecios(f, a: float, b: float, n: int) -> float:
    """
    Regla de los trapecios compuesta.

    @complejidad Tiempo O(n): una evaluación vectorizada de f en n + 1 nodos y una suma; espacio O(n).
    @explicacion Cada trapecio tiene área h·(f(xₖ) + f(xₖ₊₁))/2, así que los nodos interiores se cuentan dos veces (peso 1)
    y los extremos una (peso 1/2): h·(Σ f - (f₀ + fₙ)/2). Error (b-a)·h²·f''/12: orden 2, el doble de grande que el del
    punto medio (constante 1/24) y de signo contrario.
    @alternativas Simpson (orden 4, mismo coste); integración de Romberg (extrapola trapecios con Richardson hasta el
    orden que haga falta); np.trapz / np.trapezoid, que ya lo trae hecho (y acepta nodos no uniformes).
    @bigo n
    """
    if n < 1:
        raise ValueError('n debe ser al menos 1')
    y = f(np.linspace(a, b, n + 1))
    return float((b - a) / n * (np.sum(y) - (y[0] + y[-1]) / 2))


def simpson(f, a: float, b: float, n: int) -> float:
    """
    Regla de Simpson compuesta (n par).

    @complejidad Tiempo O(n): una evaluación vectorizada de f en n + 1 nodos y dos sumas con paso 2; espacio O(n).
    @explicacion Una parábola por tres nodos consecutivos integra a h/3·(f₀ + 4f₁ + f₂); al encadenar n/2 parábolas los
    nodos pares interiores se comparten (peso 2) y los impares son los centros (peso 4). Es la combinación (T + 2M)/3 de
    trapecios y punto medio: sus términos de error en h² se cancelan y queda O(h⁴). Exacta hasta grado 3 (la parábola
    gana un grado de más por simetría). `y[1:-1:2]` son los nodos de índice impar y `y[2:-1:2]` los pares interiores.
    @alternativas Cuadratura de Gauss-Legendre (más precisión por evaluación si f es suave); Romberg; métodos adaptativos
    (scipy.integrate.quad) que reparten los nodos donde f cambia más deprisa.
    @bigo n
    """
    if n < 2 or n % 2 != 0:
        raise ValueError('n debe ser par y al menos 2')
    y = f(np.linspace(a, b, n + 1))
    h = (b - a) / n
    return float(h / 3 * (y[0] + y[-1] + 4 * np.sum(y[1:-1:2]) + 2 * np.sum(y[2:-1:2])))


def es_primitiva(F, f, a: float, b: float, tol: float = 1e-6) -> bool:
    """
    Comprueba F' = f con diferencias centradas en una rejilla interior.

    @complejidad Tiempo O(1): 20 puntos, 40 evaluaciones de F y 20 de f; espacio O(1).
    @explicacion Es el teorema fundamental leído al revés: si F es primitiva, su derivada numérica coincide con f en cada
    punto. Se usa solo el interior de [a, b] (los 20 puntos de linspace(a, b, 22)[1:-1]) para que F(x ± h) exista aunque F
    no esté definida fuera, como ln x en [1, 2]. La tolerancia es mixta (absoluta cerca de 0, relativa si |f| > 1) y la
    comparación `<=` hace que un nan nunca pase. Una constante sumada a F no cambia F', así que no se detecta.
    @alternativas Derivar simbólicamente con sympy y simplificar F' - f (prueba exacta, pero más lenta y frágil);
    comparar F(b) - F(a) con Simpson (detecta errores globales pero no dice dónde falla); autodiff.
    """
    if a >= b:
        raise ValueError('a debe ser menor que b')
    x = np.linspace(a, b, 22)[1:-1]
    h = 1e-5
    derivada = (F(x + h) - F(x - h)) / (2 * h)
    objetivo = f(x)
    return bool(np.all(np.abs(derivada - objetivo) <= tol * np.maximum(1.0, np.abs(objetivo))))


def pi_montecarlo(n: int, semilla: int = 0) -> float:
    """
    Estimación de π por Monte Carlo en el cuadrado unidad.

    @complejidad Tiempo O(n); espacio O(n) por el array de n puntos (se podría hacer en bloques con espacio O(1)).
    @explicacion El cuarto de círculo ocupa π/4 del cuadrado, así que la proporción de puntos con x² + y² ≤ 1 estima π/4.
    Es la media de una variable de Bernoulli: error típico 4·√(p(1-p))/√n ≈ 1.64/√n, lento (cuatro veces más puntos para
    una cifra binaria más) pero independiente de la dimensión. `default_rng(semilla)` y una sola llamada a
    rng.random((n, 2)) fijan el resultado: misma semilla, mismo número. Con np.count_nonzero se evita sumar booleanos.
    @alternativas Muestreo estratificado o cuasi-Monte Carlo (secuencias de Sobol, error cercano a 1/n); variables de
    control (restar algo con media conocida) y muestreo por importancia para reducir la varianza; la serie de Leibniz o
    Machin si solo se quiere π (convergen mucho más deprisa: Monte Carlo no es para esto).
    @bigo n
    """
    if n < 1:
        raise ValueError('n debe ser al menos 1')
    puntos = np.random.default_rng(semilla).random((n, 2))
    dentro = np.count_nonzero(puntos[:, 0] ** 2 + puntos[:, 1] ** 2 <= 1.0)
    return float(4 * dentro / n)


def esperanza(densidad, a: float, b: float, n: int = 1000) -> float:
    """
    Esperanza ∫ₐᵇ x·f(x)dx con Simpson.

    @complejidad Tiempo O(n): una evaluación vectorizada de la densidad en n + 1 nodos; espacio O(n).
    @explicacion E[X] es una integral como cualquier otra, con integrando x·f(x): se delega en `simpson`, que ya valida que
    n sea par. No se normaliza: si la masa en [a, b] no es 1, el resultado es la integral del enunciado tal cual (para
    la media condicionada habría que dividir entre la masa). El intervalo debe cubrir la práctica totalidad de la masa:
    para una gaussiana, ±8σ deja una cola de ~1e-15.
    @alternativas Monte Carlo (media de una muestra: error 1/√n, ventaja en dimensión alta); cuadratura de Gauss-Hermite
    (diseñada para integrales con peso gaussiano); la fórmula cerrada cuando existe (μ para N(μ, σ²)).
    """
    return simpson(lambda x: x * densidad(x), a, b, n)
