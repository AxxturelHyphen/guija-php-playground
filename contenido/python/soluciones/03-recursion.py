"""
SOLUCIONES · Tema 3 · Recursión
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
"""


def factorial(n: int) -> int:
    """
    Factorial recursivo.

    @complejidad Tiempo O(n); espacio O(n) por la pila de llamadas.
    @explicacion Caso base `n <= 1`; paso `n * factorial(n - 1)`. Los int de Python tienen precisión arbitraria, así
    que no desbordan: 30! sale exacto. El límite real es la recursión (~1000 marcos), no el tamaño del número.
    @alternativas Un bucle `for` o `math.factorial` (O(n) de tiempo y O(1) de pila): preferibles en la práctica porque no
    apilan marcos.
    @bigo n
    """
    if n < 0:
        raise ValueError(f'El factorial no está definido para {n}')
    return 1 if n <= 1 else n * factorial(n - 1)


def mcd(a: int, b: int) -> int:
    """
    Máximo común divisor (Euclides).

    @complejidad Tiempo O(log min(a, b)); espacio O(log min(a, b)) de pila.
    @explicacion mcd(a, b) = mcd(b, a mod b) porque cualquier divisor común de a y b también lo es de b y a mod b. El resto
    baja al menos a la mitad cada dos pasos, de ahí el logaritmo. El resultado final se pasa por abs() para que sea positivo
    (el `%` de Python da el signo del divisor, pero basta con normalizar al final).
    @alternativas El bucle `while b: a, b = b, a % b` no apila marcos (O(1) de espacio); `math.gcd` ya lo trae hecho.
    @bigo log
    """
    return abs(a) if b == 0 else mcd(b, a % b)


def fibonacci(n: int) -> int:
    """
    Fibonacci con memoización local.

    @complejidad Tiempo O(n); espacio O(n) (la memoria y la pila).
    @explicacion La función interna guarda en un dict creado en CADA llamada lo ya calculado, así que fib(k) se calcula una
    sola vez. Un `memo={}` como argumento por defecto se compartiría entre llamadas (aquí sería inofensivo, pero es la trampa
    clásica), y @cache funcionaría igual a cambio de una caché global.
    @alternativas @cache de functools (O(n) y una línea). Un bucle con dos variables: O(n) de tiempo y O(1) de espacio y sin
    límite de recursión. Sin memoria: O(2ⁿ).
    @bigo n
    """
    if n < 0:
        raise ValueError(f'Fibonacci no está definido para {n}')
    memo: dict[int, int] = {}

    def fib(k: int) -> int:
        if k < 2:
            return k
        if k not in memo:
            memo[k] = fib(k - 1) + fib(k - 2)
        return memo[k]

    return fib(n)


def potencia(base: float, exp: int) -> float:
    """
    Potencia por exponenciación rápida.

    @complejidad Tiempo O(log |exp|); espacio O(log |exp|) de pila.
    @explicacion x^n = (x^(n//2))² y, si n es impar, se multiplica además por x. Cada llamada reduce el exponente a la
    mitad, así que 1.000.000 se resuelve en unas 20 llamadas. El resultado de la mitad se calcula UNA vez y se reutiliza
    (si se llamara dos veces volvería a ser O(n)). Un exponente negativo se convierte en 1 / base^(-exp).
    @alternativas El bucle de multiplicaciones es O(n). `base ** exp` ya lo hace internamente.
    @bigo log
    """
    if exp < 0:
        if base == 0:
            raise ValueError('0 no se puede elevar a un exponente negativo')
        return 1.0 / potencia(base, -exp)
    if exp == 0:
        return 1.0
    mitad = potencia(base, exp // 2)
    return mitad * mitad * (base if exp % 2 else 1.0)


def es_palindromo(texto: str) -> bool:
    """
    Palíndromo por recursión.

    @complejidad Tiempo O(n); espacio O(n) (la copia filtrada y la pila).
    @explicacion Primero se queda solo con letras y dígitos en minúsculas; después se compara el primer y el último
    carácter y se repite con lo que queda en medio. Caso base: con 0 o 1 caracteres siempre es palíndromo.
    @alternativas `limpio == limpio[::-1]` (O(n), una línea y sin pila). Dos índices que se acercan, sin cortar cadenas.
    @bigo n
    """
    limpio = ''.join(c.lower() for c in texto if c.isalnum())

    def comprobar(i: int, j: int) -> bool:
        return True if i >= j else limpio[i] == limpio[j] and comprobar(i + 1, j - 1)

    return comprobar(0, len(limpio) - 1)


def permutaciones(xs: list) -> list:
    """
    Todas las permutaciones (backtracking).

    @complejidad Tiempo O(n · n!); espacio O(n · n!) por el resultado.
    @explicacion Se elige cada elemento como primero (en orden) y se permuta recursivamente el resto. Caso base: una lista
    vacía tiene una única permutación, la vacía. Hay n! resultados y cada uno cuesta O(n) construirlo.
    @alternativas `itertools.permutations` (perezoso, en C): lo que usarías en producción.
    @bigo exp
    """
    if not xs:
        return [[]]
    resultado = []
    for i, elegido in enumerate(xs):
        for resto in permutaciones(xs[:i] + xs[i + 1:]):
            resultado.append([elegido] + resto)
    return resultado


def subconjuntos(xs: list) -> list:
    """
    Conjunto de las partes (backtracking).

    @complejidad Tiempo O(n · 2ⁿ); espacio O(n · 2ⁿ).
    @explicacion `construir` registra una copia de lo acumulado y prueba, para cada elemento posterior, a añadirlo y
    profundizar; al volver lo quita (deshacer). Cada nodo del árbol de decisiones es un subconjunto distinto, y hay 2ⁿ.
    @alternativas Las máscaras de bits (de 0 a 2ⁿ−1, cada bit dice si entra un elemento). `itertools.combinations` por cada tamaño.
    @bigo exp
    """
    resultado: list = []

    def construir(inicio: int, actual: list) -> None:
        resultado.append(actual[:])           # copia: si no, todas las entradas serían la MISMA lista
        for i in range(inicio, len(xs)):
            actual.append(xs[i])
            construir(i + 1, actual)
            actual.pop()                      # deshacer

    construir(0, [])
    return resultado


def hanoi(n: int, origen: str = 'A', auxiliar: str = 'B', destino: str = 'C') -> list:
    """
    Torres de Hanoi.

    @complejidad Tiempo O(2ⁿ); espacio O(2ⁿ) por la lista de movimientos (la pila solo llega a n).
    @explicacion Para mover n discos: se llevan n−1 al auxiliar, se mueve el mayor al destino y se llevan los n−1 sobre él.
    T(n) = 2·T(n−1) + 1 = 2ⁿ − 1 movimientos, el mínimo posible.
    @alternativas Una versión iterativa con una pila explícita o con el patrón de bits: más complicada sin ganar nada.
    @bigo exp
    """
    if n == 0:
        return []
    return (hanoi(n - 1, origen, destino, auxiliar)
            + [f'{origen}→{destino}']
            + hanoi(n - 1, auxiliar, origen, destino))
