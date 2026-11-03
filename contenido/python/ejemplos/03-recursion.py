"""
TEMA 3 · RECURSIÓN
─────────────────────────────────────────────────────────────────
Una función recursiva se llama a sí misma resolviendo un problema más pequeño.
Toda recursión necesita dos cosas:
    1. CASO BASE: cuándo parar (si falta, recursión infinita → RecursionError).
    2. PASO RECURSIVO: acercarse al caso base en cada llamada.

Cada llamada apila un "marco" en la pila de llamadas. Python NO optimiza la recursión de cola (tail call) y
limita la profundidad a 1000 llamadas (sys.getrecursionlimit()): pasado ese punto lanza RecursionError. Por eso en
Python se prefiere un bucle cuando la profundidad puede ser grande.
"""
import sys
from functools import cache


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. ANATOMÍA: LA PILA DE LLAMADAS
# ═════════════════════════════════════════════════════════════════
titulo('1. La pila de llamadas')


def cuenta_atras(n: int, nivel: int = 0) -> None:
    sangria = '  ' * nivel
    if n == 0:                                        # CASO BASE
        print(f'{sangria}¡despegue! (caso base: aquí empiezan a volver)')
        return
    print(f'{sangria}baja n={n}')
    cuenta_atras(n - 1, nivel + 1)                    # PASO RECURSIVO: n más pequeño
    print(f'{sangria}vuelve n={n}')                   # esto se ejecuta al DESAPILAR


cuenta_atras(3)


# Sin caso base, la pila se llena y Python lanza RecursionError (lo puedes capturar).
def sin_caso_base(n: int) -> int:
    return sin_caso_base(n + 1)


try:
    sin_caso_base(0)
except RecursionError as e:
    print('Error esperado: RecursionError, límite =', sys.getrecursionlimit())
# ¿Subir el límite con sys.setrecursionlimit(10**6)? No: cada marco ocupa memoria de la pila del sistema, y si se
# agota ANTES de llegar al límite el intérprete se cae del todo (segmentation fault) en lugar de lanzar una excepción
# limpia. Si necesitas más profundidad, usa un bucle o una pila explícita (sección 5).

# ═════════════════════════════════════════════════════════════════
# 2. PENSAR EN "SI SÉ RESOLVER LO PEQUEÑO, RESUELVO LO GRANDE"
# ═════════════════════════════════════════════════════════════════
titulo('2. Descomponer')


# suma(n) = n + suma(n - 1)            suma(0) = 0
def suma_hasta(n: int) -> int:
    return 0 if n == 0 else n + suma_hasta(n - 1)


print('suma_hasta(100) =', suma_hasta(100), '(la fórmula n(n+1)/2 da', 100 * 101 // 2, ')')
try:
    suma_hasta(20000)                  # en otros lenguajes cabe; aquí 20.000 marcos superan el límite de 1000
except RecursionError:
    print('suma_hasta(20000) → RecursionError: con sum(range(...)) o un bucle no hay problema')


# Recursión sobre estructuras anidadas: aquí un bucle no basta, la recursión es natural.
def suma_carpetas(carpeta: dict) -> int:
    total = 0
    for contenido in carpeta.values():
        total += suma_carpetas(contenido) if isinstance(contenido, dict) else contenido
    return total


ARBOL = {'a.txt': 10, 'src': {'b.py': 5, 'lib': {'c.py': 7}}, 'd.md': 1}
print('tamaño total del árbol:', suma_carpetas(ARBOL), 'KB')


# Recursión mutua: dos funciones que se llaman entre sí.
def es_par(n: int) -> bool:
    return True if n == 0 else es_impar(n - 1)


def es_impar(n: int) -> bool:
    return False if n == 0 else es_par(n - 1)


print('es_par(10):', es_par(10), '· es_impar(7):', es_impar(7))

# ═════════════════════════════════════════════════════════════════
# 3. EL PROBLEMA: LLAMADAS REPETIDAS (Y LA MEMOIZACIÓN)
# ═════════════════════════════════════════════════════════════════
# fib(n) = fib(n-1) + fib(n-2). Escrito sin más, recalcula lo mismo una y otra vez:
# fib(5) llama a fib(3) dos veces, a fib(2) tres veces... El número de llamadas crece como 2ⁿ.
titulo('3. Memoización')


def fib_ingenuo(n: int, llamadas: list) -> int:
    llamadas[0] += 1                   # una lista es mutable: sirve de "contador por referencia"
    return n if n < 2 else fib_ingenuo(n - 1, llamadas) + fib_ingenuo(n - 2, llamadas)


# Memoización con un dict: antes de calcular, mira si ya está; al calcular, guárdalo.
def fib_memo(n: int, memo: dict, llamadas: list) -> int:
    llamadas[0] += 1
    if n < 2:
        return n
    if n not in memo:
        memo[n] = fib_memo(n - 1, memo, llamadas) + fib_memo(n - 2, memo, llamadas)
    return memo[n]


# Memoización automática con @cache (functools): guarda el resultado de cada argumento distinto.
# Los argumentos deben ser hashables; la caché vive mientras viva el programa (en funciones puras es justo lo que se quiere).
@cache
def fib_cache(n: int) -> int:
    return n if n < 2 else fib_cache(n - 1) + fib_cache(n - 2)


for n in (10, 20, 25):
    a, b = [0], [0]
    resultado = fib_ingenuo(n, a)
    fib_memo(n, {}, b)
    print(f'fib({n}) = {resultado}   llamadas: ingenuo {a[0]:,} · con memoria {b[0]} · @cache {fib_cache(n)}')
print('Memoización = cambiar memoria por tiempo: O(2ⁿ) pasa a O(n). Es la base de la programación dinámica.')

# ═════════════════════════════════════════════════════════════════
# 4. BACKTRACKING: PROBAR, DESHACER, PROBAR OTRA COSA
# ═════════════════════════════════════════════════════════════════
# Se construye una solución paso a paso; si un camino no sirve, se deshace la última
# decisión y se prueba la siguiente. Es la plantilla de permutaciones, subconjuntos,
# sudokus, n-reinas...
titulo('4. Backtracking')


def binarios(n: int, actual: str = '', resultado: list | None = None) -> list:
    """Todas las cadenas binarias de longitud n."""
    if resultado is None:                         # (¡no `resultado=[]`! sería el argumento mutable compartido)
        resultado = []
    if len(actual) == n:                          # CASO BASE: solución completa
        resultado.append(actual)
        return resultado
    for bit in '01':
        binarios(n, actual + bit, resultado)      # decidir un paso y seguir (al volver, "se deshace" solo
    return resultado                              # porque `actual` es un str inmutable: se creó otro)


print(' '.join(binarios(3)))

# ═════════════════════════════════════════════════════════════════
# 5. CUÁNDO NO USAR RECURSIÓN
# ═════════════════════════════════════════════════════════════════
# · Cuando la profundidad pueda ser grande (el límite es 1000; un bucle no apila marcos).
# · Cuando el trabajo se repite (usa memoización o un bucle que guarde lo calculado).
# Cualquier recursión se puede convertir en un bucle con una pila explícita (una lista):
titulo('5. De recursión a bucle con pila explícita')


def suma_carpetas_iterativa(raiz: dict) -> int:
    total = 0
    pila = [raiz]
    while pila:
        actual = pila.pop()
        for contenido in actual.values():
            if isinstance(contenido, dict):
                pila.append(contenido)
            else:
                total += contenido
    return total


print('mismo resultado sin recursión:', suma_carpetas_iterativa(ARBOL), 'KB')

# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════
# Sustituye cada `pendiente()` por tu código. Mantén los nombres: las pruebas los usan.

# ── Ejercicio 1 · factorial ─────────────────────────────────────────────────
def factorial(n: int) -> int:
    """
    n! = n × (n-1) × ... × 1, con 0! = 1. Hazlo recursivo.
     - n negativo → ValueError.
     - Los int de Python tienen precisión arbitraria: no desbordan (30! es exacto), así que aquí no hay límite
       superior. La única barrera es la profundidad de recursión (~1000): con un bucle o math.factorial no existe.
    """
    pendiente()


# ── Ejercicio 2 · mcd ───────────────────────────────────────────────────────
def mcd(a: int, b: int) -> int:
    """
    Máximo común divisor con el algoritmo de Euclides: mcd(a, b) = mcd(b, a mod b); mcd(a, 0) = |a|.
    Admite negativos (el resultado siempre es positivo). mcd(0, 0) = 0.
    """
    pendiente()


# ── Ejercicio 3 · fibonacci ─────────────────────────────────────────────────
def fibonacci(n: int) -> int:
    """
    fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).  n negativo → ValueError.
    La versión ingenua es O(2ⁿ): con n = 40 tarda minutos. Hazla O(n) con memoización
    (con un dict local o con @cache; ¡ojo con un `memo={}` como argumento por defecto: se arrastra entre llamadas!).
    Pulsa «Medir» para verlo.
    """
    pendiente()


# ── Ejercicio 4 · potencia ──────────────────────────────────────────────────
def potencia(base: float, exp: int) -> float:
    """
    base^exp en O(log n) con la idea "divide y vencerás":
        x^n = (x^(n/2))² si n es par;   x · (x^((n-1)/2))² si n es impar
    Exponente negativo → 1 / base^(-exp). Cualquier base elevada a 0 es 1.0. 0 elevado a un exponente negativo
    → ValueError. Devuelve siempre float. (El bucle de n multiplicaciones es O(n); aquí se pide mucho menos.)
    """
    pendiente()


# ── Ejercicio 5 · es_palindromo ─────────────────────────────────────────────
def es_palindromo(texto: str) -> bool:
    """
    ¿Se lee igual al revés? Solo cuentan las letras y los dígitos: se ignoran mayúsculas, espacios y signos
    (los acentos no se normalizan: é ≠ e). Hazlo con recursión comparando los extremos y acercándote al centro.
        "Anita lava la tina" → True   ·   "A man, a plan, a canal: Panama" → True   ·   "hola" → False
    Pista: str.isalnum() y str.lower(). (`limpio == limpio[::-1]` es correcto, pero aquí se pide recursión.)
    """
    pendiente()


# ── Ejercicio 6 · permutaciones ─────────────────────────────────────────────
def permutaciones(xs: list) -> list:
    """
    Todas las ordenaciones posibles de los elementos de la lista (backtracking), en este orden:
    se elige el primer elemento en el orden original y se permuta el resto.
        permutaciones([1, 2, 3]) → [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
    Lista vacía → [[]] (hay exactamente una forma de ordenar nada).
    """
    pendiente()


# ── Ejercicio 7 · subconjuntos ──────────────────────────────────────────────
def subconjuntos(xs: list) -> list:
    """
    Todos los subconjuntos (el "conjunto de las partes"), en orden de backtracking: primero el vacío, y luego
    cada elemento seguido de los subconjuntos que se pueden formar con los que le siguen.
        subconjuntos([1, 2, 3]) → [[], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]]
    Para n elementos hay 2ⁿ subconjuntos.
    """
    pendiente()


# ── Ejercicio 8 · hanoi ─────────────────────────────────────────────────────
def hanoi(n: int, origen: str = 'A', auxiliar: str = 'B', destino: str = 'C') -> list:
    """
    Torres de Hanoi: mueve `n` discos de `origen` a `destino` usando `auxiliar`, sin poner nunca uno grande sobre
    uno pequeño. Devuelve la lista de movimientos como "A→C".
        hanoi(2) → ['A→B', 'A→C', 'B→C']
    Hacen falta exactamente 2ⁿ − 1 movimientos. Con n = 0 no hay ninguno.
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS
# ═════════════════════════════════════════════════════════════════

prueba('factorial', {
    '0! = 1': ((0,), 1),
    '1! = 1': ((1,), 1),
    '5! = 120': ((5,), 120),
    '10!': ((10,), 3628800),
    '20!': ((20,), 2432902008176640000),
    '30! no desborda (exacto)': ((30,), 265252859812191058636308480000000),
})
grupo('factorial()')
lanza('negativo', lambda: factorial(-1), ValueError)

prueba('mcd', {
    'básico': ((12, 18), 6),
    'coprimos': ((7, 13), 1),
    'con cero': ((0, 5), 5),
    'con cero (otro orden)': ((5, 0), 5),
    'negativos': ((-12, 18), 6),
    'iguales': ((9, 9), 9),
    'los dos cero': ((0, 0), 0),
    'números grandes': ((1071, 462), 21),
})

prueba('fibonacci', {
    'fib(0)': ((0,), 0),
    'fib(1)': ((1,), 1),
    'fib(2)': ((2,), 1),
    'fib(10)': ((10,), 55),
    'fib(30)': ((30,), 832040),
    'fib(50) (la versión ingenua no llega)': ((50,), 12586269025),
    'fib(90)': ((90,), 2880067194370816120),
})
grupo('fibonacci()')
lanza('negativo', lambda: fibonacci(-1), ValueError)
comprueba('dos llamadas seguidas dan lo mismo', lambda: [fibonacci(25), fibonacci(25)], [75025, 75025])

prueba('potencia', {
    '2^10': ((2.0, 10), 1024.0),
    '3^0': ((3.0, 0), 1.0),
    '2^1': ((2.0, 1), 2.0),
    '1.5^3': ((1.5, 3), 3.375),
    'exponente negativo': ((2.0, -2), 0.25),
    '0^0': ((0.0, 0), 1.0),
    '0^5': ((0.0, 5), 0.0),
    '(-2)^3': ((-2.0, 3), -8.0),
    'exponente enorme sin desbordar': ((1.0, 1_000_000), 1.0),
})
grupo('potencia()')
lanza('0 elevado a negativo', lambda: potencia(0.0, -1), ValueError)

prueba('es_palindromo', {
    'palabra': (('reconocer',), True),
    'con espacios y mayúsculas': (('Anita lava la tina',), True),
    'con signos': (('A man, a plan, a canal: Panama',), True),
    'no lo es': (('hola',), False),
    'vacío': (('',), True),
    'un carácter': (('x',), True),
    'solo signos': (('¡?!',), True),
    'dígitos': (('12321',), True),
    'casi': (('abca',), False),
})

prueba('permutaciones', {
    'tres elementos': (([1, 2, 3],), [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]),
    'dos elementos': ((['a', 'b'],), [['a', 'b'], ['b', 'a']]),
    'uno': (([7],), [[7]]),
    'vacía': (([],), [[]]),
})
grupo('permutaciones()')
comprueba('5 elementos dan 120', lambda: len(permutaciones([1, 2, 3, 4, 5])), 120)
comprueba('ninguna se repite', lambda: len({tuple(p) for p in permutaciones([1, 2, 3, 4])}), 24)

prueba('subconjuntos', {
    'tres elementos': (([1, 2, 3],), [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]),
    'uno': ((['x'],), [[], ['x']]),
    'vacío': (([],), [[]]),
})
grupo('subconjuntos()')
comprueba('10 elementos dan 1024', lambda: len(subconjuntos(list(range(1, 11)))), 1024)

prueba('hanoi', {
    'n = 0': ((0,), []),
    'n = 1': ((1,), ['A→C']),
    'n = 2': ((2,), ['A→B', 'A→C', 'B→C']),
    'n = 3': ((3,), ['A→C', 'A→B', 'C→B', 'A→C', 'B→A', 'B→C', 'A→C']),
    'otros nombres': ((1, 'X', 'Y', 'Z'), ['X→Z']),
})
grupo('hanoi()')
comprueba('10 discos = 1023 movimientos', lambda: len(hanoi(10)), 1023)

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
# fibonacci con la versión ingenua explota (O(2ⁿ)), con memoria es lineal. La escala es lineal (5, 10, 15...)
# porque con tamaños que se doblan, el ingenuo no acabaría nunca.
medir('fibonacci', lambda n: (n,), 'lineal', range(5, 90, 5))
# potencia: con n = 131072 un bucle hace 131072 multiplicaciones; la versión rápida, 17.
medir('potencia', lambda n: (1.0, n))
