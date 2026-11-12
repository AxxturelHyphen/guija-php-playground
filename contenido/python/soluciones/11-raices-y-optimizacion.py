"""
SOLUCIONES · Tema 11 · Raíces y optimización en 1D
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (`math` ya está importado en el ejemplo.)
"""


def biseccion(f, a: float, b: float, tol: float = 1e-12) -> float:
    """
    Raíz por bisección (Bolzano hecho algoritmo).

    @complejidad Tiempo O(log((b - a) / tol)) evaluaciones de f, independiente de f; espacio O(1).
    @explicacion Invariante: f(a) y f(b) tienen signo distinto, así que (por Bolzano, si f es continua) hay una raíz en
    [a, b]. Se evalúa f en el punto medio y se descarta la mitad sin cambio de signo: el ancho se divide entre 2 por
    iteración (convergencia lineal, 1 bit por paso). Se guarda f(a) para no reevaluarlo y se compara el signo con
    `(fm > 0) == (fa > 0)` en vez de multiplicar f(a)·f(m), que puede desbordar o dar 0 por underflow. La guarda
    `m <= a or m >= b` evita el bucle infinito cuando tol es menor que la separación entre floats vecinos.
    @alternativas Newton o la secante (mucho más rápidos pero sin garantía); `scipy.optimize.brentq` (bisección + secante
    + interpolación, con la garantía de la bisección); método de la falsa posición (regula falsi).
    """
    if not a < b:
        raise ValueError('se exige a < b')
    fa, fb = f(a), f(b)
    if fa == 0:
        return float(a)
    if fb == 0:
        return float(b)
    if (fa > 0) == (fb > 0):
        raise ValueError('f(a) y f(b) deben tener signo distinto')
    while b - a > tol:
        m = a + (b - a) / 2
        if m <= a or m >= b:
            break
        fm = f(m)
        if fm == 0:
            return float(m)
        if (fm > 0) == (fa > 0):
            a, fa = m, fm
        else:
            b = m
    return float(a + (b - a) / 2)


def raiz_entera(n: int) -> int:
    """
    Raíz cuadrada entera exacta por búsqueda binaria sobre la respuesta.

    @complejidad Tiempo O(log n) iteraciones, cada una con un producto de enteros de ~log n bits (mejor que O(n)
    de probar candidatos); espacio O(1) además de los enteros.
    @explicacion La respuesta es el mayor x con x² <= n, y «x² <= n» es un predicado monótono en x. Invariante:
    bajo² <= n < alto². Se arranca con alto = 2^⌈bits/2⌉, que cumple alto² >= 2^bits > n, y se acorta [bajo, alto)
    hasta que alto - bajo = 1. Todo es aritmética entera exacta: ningún float interviene, así que funciona con 10**40
    o con 2**1000 donde int(n ** 0.5) ya falla (un float guarda 53 bits).
    @alternativas `math.isqrt` (la versión de la librería estándar, también exacta); método de Newton entero
    x ← (x + n // x) // 2, que converge cuadráticamente; con floats solo sirve hasta ~2**52.
    """
    if not isinstance(n, int):
        raise TypeError('n debe ser un entero')
    if n < 0:
        raise ValueError('n debe ser >= 0')
    bajo, alto = 0, 1 << ((n.bit_length() + 1) // 2)
    while alto - bajo > 1:
        medio = (bajo + alto) // 2
        if medio * medio <= n:
            bajo = medio
        else:
            alto = medio
    return bajo


def newton(f, df, x0: float, tol: float = 1e-12, max_iter: int = 50) -> float:
    """
    Método de Newton para una raíz de f.

    @complejidad Tiempo O(iteraciones) evaluaciones de f y df; cerca de una raíz simple, O(log log(1/tol)); espacio O(1).
    @explicacion Se sustituye f por su tangente en x y se salta a la raíz de la tangente: x ← x − f(x)/f'(x). En una
    raíz simple el error se eleva al cuadrado (convergencia cuadrática: los dígitos correctos se duplican). Se prueba f(x)
    == 0 antes de dividir (si x ya es raíz, que f' valga 0 allí no importa). Los fallos NO se ocultan: f' = 0 lanza
    ZeroDivisionError, y un iterado infinito/nan o agotar max_iter (ciclo, divergencia, raíz múltiple muy lenta) lanza
    RuntimeError; devolver el último valor o None se propagaría como un resultado falso.
    @alternativas Bisección (siempre converge, pero lineal); método de la secante (sin derivada, orden ~1.6); Newton
    amortiguado o con búsqueda de línea para ampliar la cuenca de convergencia; `scipy.optimize.newton` / `brentq`.
    """
    x = float(x0)
    for _ in range(max_iter):
        fx = f(x)
        if fx == 0:
            return x
        d = df(x)
        if d == 0:
            raise ZeroDivisionError(f'la derivada es 0 en x = {x}')
        paso = fx / d
        x -= paso
        if not math.isfinite(x):
            raise RuntimeError('Newton diverge: el iterado dejó de ser finito')
        if abs(paso) <= tol:
            return x
    raise RuntimeError(f'no convergió en {max_iter} iteraciones')


def descenso_1d(df, x0: float, tasa: float, pasos: int) -> list:
    """
    Descenso de gradiente en 1D, devolviendo toda la trayectoria.

    @complejidad Tiempo O(pasos) con una evaluación de df por paso; espacio O(pasos) por la lista devuelta.
    @explicacion x ← x − η·f'(x): un paso contra la pendiente. En una parábola de curvatura L el error se multiplica por
    (1 − ηL) en cada paso, de modo que converge si 0 < η < 2/L (la más rápida es η = 1/L) y diverge si η > 2/L. Guardar la
    trayectoria entera (en vez de solo el último punto) permite dibujar el error por iteración y diagnosticar la tasa.
    @alternativas Newton sobre f' (usa la segunda derivada y no necesita elegir η); descenso con búsqueda de línea o
    tasa decreciente; momento y Adam, que adaptan el paso en problemas con muchas dimensiones.
    @bigo n
    """
    if pasos < 0:
        raise ValueError('pasos no puede ser negativo')
    x = float(x0)
    trayectoria = [x]
    for _ in range(pasos):
        x -= tasa * df(x)
        trayectoria.append(x)
    return trayectoria


def minimo_ternario(f, a: float, b: float, tol: float = 1e-9) -> float:
    """
    Mínimo de una función unimodal por búsqueda ternaria.

    @complejidad Tiempo O(log_{3/2}((b - a) / tol)) iteraciones con 2 evaluaciones de f cada una; espacio O(1).
    @explicacion Con dos puntos interiores m1 < m2: si f(m1) < f(m2) el mínimo no puede estar en (m2, b] (f ya subía
    antes de m2); si no, no está en [a, m1). Se descarta un tercio y el ancho queda × 2/3. Funciona sin derivadas, pero solo
    si f es estrictamente unimodal (una meseta o varios mínimos locales la engañan). La precisión de x está limitada a
    ~√eps: cerca del mínimo f es plana y f(m1) == f(m2) por redondeo, de ahí la guarda `a < m1 < m2 < b` y que tol < 1e-8
    no mejore el resultado.
    @alternativas Búsqueda de la sección áurea (1 evaluación por iteración, reutiliza un punto); bisección sobre f' o
    Newton si se dispone de derivada (precisión ~eps en x); `scipy.optimize.minimize_scalar` (Brent).
    """
    if not a < b:
        raise ValueError('se exige a < b')
    while b - a > tol:
        tercio = (b - a) / 3
        m1, m2 = a + tercio, b - tercio
        if not a < m1 < m2 < b:
            break
        if f(m1) < f(m2):
            b = m2
        else:
            a = m1
    return float(a + (b - a) / 2)
