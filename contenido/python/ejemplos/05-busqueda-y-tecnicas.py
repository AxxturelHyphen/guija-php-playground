"""
TEMA 5 · BÚSQUEDA Y TÉCNICAS CLÁSICAS
─────────────────────────────────────────────────────────────────
Muchos problemas "difíciles" son en realidad un truco de cuatro o cinco que se repiten.
Aquí aprenderás los que más rentabilidad tienen y cuándo aplicarlos:

  Búsqueda binaria     datos ORDENADOS          O(n) → O(log n)
  Dos punteros         datos ordenados / pares  O(n²) → O(n)
  Ventana deslizante   subarrays contiguos       O(n·k) → O(n)
  Tabla hash           "¿lo he visto ya?"        O(n²) → O(n)
  Sumas prefijas       consultas de rango        O(n) por consulta → O(1)

La idea común: no recalcular lo que ya sabes. Cambiar tiempo por un poco de memoria.
"""
import json
from bisect import bisect_left, bisect_right
from collections import Counter
from itertools import accumulate


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


def ver(valor) -> str:
    return json.dumps(valor, ensure_ascii=False)


# ═════════════════════════════════════════════════════════════════
# 1. BÚSQUEDA LINEAL FRENTE A BINARIA
# ═════════════════════════════════════════════════════════════════
# Lineal: mirar uno por uno → hasta n pasos. Binaria: en una lista ORDENADA, mirar el del medio y descartar la
# mitad que no puede contenerlo → log₂ n pasos (con mil millones de elementos, ~30).
titulo('1. Lineal frente a binaria')


def lineal(xs: list, x: int) -> tuple:
    """Devuelve (índice, número de pasos)."""
    pasos = 0
    for i, v in enumerate(xs):
        pasos += 1
        if v == x:
            return i, pasos
    return -1, pasos


def binaria_con_pasos(xs: list, x: int) -> tuple:
    pasos = 0
    bajo, alto = 0, len(xs) - 1
    while bajo <= alto:                     # invariante: si x está, está en [bajo, alto]
        pasos += 1
        medio = (bajo + alto) // 2          # // es la división entera; en Python no hay desbordamiento de int
        if xs[medio] == x:
            return medio, pasos
        if xs[medio] < x:
            bajo = medio + 1                # descarta la mitad izquierda (y el medio)
        else:
            alto = medio - 1                # descarta la mitad derecha (y el medio)
    return -1, pasos


datos = list(range(0, 1_000_001, 2))        # 500.001 números pares, ordenados
for buscado in (1000, 777_776, 999_999):
    i1, p1 = lineal(datos, buscado)
    i2, p2 = binaria_con_pasos(datos, buscado)
    print(f'buscando {buscado:>9,} → lineal: pos {i1:>6} en {p1:>6,} pasos · binaria: pos {i2:>6} en {p2:>2} pasos'.replace(',', '.'))
print('(999.999 es impar: no está, y la lineal lo comprueba todo)')

# La librería estándar ya trae la binaria: el módulo `bisect` (en C, O(log n)).
#   bisect_left(xs, x)   primera posición donde x cabe sin romper el orden (el "límite inferior": primer elemento >= x)
#   bisect_right(xs, x)  posición tras el último igual a x (primer elemento > x)
#   insort(xs, x)        inserta manteniendo el orden: O(log n) para buscar pero O(n) para desplazar.
# Trampa: bisect NO comprueba que la lista esté ordenada, y `x in lista` es lineal O(n), no binaria.
pares = [1, 3, 3, 3, 7]
print('bisect_left(3) =', bisect_left(pares, 3), '· bisect_right(3) =', bisect_right(pares, 3),
      '→ hay', bisect_right(pares, 3) - bisect_left(pares, 3), 'treses')

# Los errores típicos de la binaria: `alto = len - 1` o `len` (hay que ser coherente con `<=` o `<`),
# no avanzar `medio ± 1` (bucle infinito) y no ordenar antes. Las dos plantillas más usadas:
#   · buscar un valor exacto:                      while bajo <= alto: ...
#   · buscar la primera posición que cumple algo:  while bajo < alto: ... ("límite inferior")

# ═════════════════════════════════════════════════════════════════
# 2. DOS PUNTEROS
# ═════════════════════════════════════════════════════════════════
# Con la lista ordenada, un puntero al principio y otro al final se van acercando según la suma
# sea demasiado pequeña o demasiado grande. Cada paso descarta al menos un candidato: O(n).
titulo('2. Dos punteros')


def par_con_suma(ordenado: list, objetivo: int):
    i, j = 0, len(ordenado) - 1
    while i < j:
        suma = ordenado[i] + ordenado[j]
        print(f'  {ordenado[i]} + {ordenado[j]} = {suma}')
        if suma == objetivo:
            return [ordenado[i], ordenado[j]]
        if suma < objetivo:
            i += 1
        else:
            j -= 1
    return None


print('par que suma 10 en [1,2,4,7,8,11]:', ver(par_con_suma([1, 2, 4, 7, 8, 11], 10)))

# ═════════════════════════════════════════════════════════════════
# 3. VENTANA DESLIZANTE
# ═════════════════════════════════════════════════════════════════
# Para "el mejor tramo CONTIGUO de tamaño k": en vez de sumar k elementos en cada posición (O(n·k)),
# se desliza la ventana: se suma el que entra y se resta el que sale (O(n)).
titulo('3. Ventana deslizante')


def media_movil(xs: list, k: int) -> list:
    suma = sum(xs[:k])
    medias = [suma / k]
    for i in range(k, len(xs)):
        suma += xs[i] - xs[i - k]           # entra xs[i], sale xs[i - k]
        medias.append(suma / k)
    return medias


print('media móvil (k = 3) de [1,2,3,4,5,6]:', ver(media_movil([1, 2, 3, 4, 5, 6], 3)))

# ═════════════════════════════════════════════════════════════════
# 4. TABLAS HASH: "¿LO HE VISTO YA?"
# ═════════════════════════════════════════════════════════════════
# Un dict (o un set) da búsqueda/inserción O(1) de media. Casi cualquier problema de pares, duplicados, frecuencias o
# agrupaciones se resuelve con una pasada y un dict/set auxiliar. Las claves deben ser hashables (int, str, tuple...;
# no list ni dict).
titulo('4. Tablas hash')


# Primer carácter que no se repite. Counter es un dict que cuenta; conserva el orden de inserción.
def primer_unico(s: str):
    cuentas = Counter(s)                    # iterar un str da puntos de código, no bytes
    for caracter, veces in cuentas.items():
        if veces == 1:
            return caracter
    return None


print('primer carácter único de "aabbcdd":', repr(primer_unico('aabbcdd')))


# Dos sumas con una pasada: para cada número, ¿está ya su complemento?
def dos_sumas_traza(nums: list, objetivo: int):
    vistos = {}                             # valor -> índice
    for i, n in enumerate(nums):
        falta = objetivo - n
        print(f'  n={n}, busco {falta}:', 'encontrado' if falta in vistos else 'no está aún')
        if falta in vistos:
            return [vistos[falta], i]
        vistos[n] = i
    return None


print('dos sumas a 9 en [2,7,11,15]:', ver(dos_sumas_traza([2, 7, 11, 15], 9)))
# Trampa: `x in lista` cuesta O(n); `x in set_o_dict` cuesta O(1). Convertir a set UNA vez compensa si preguntas muchas.

# ═════════════════════════════════════════════════════════════════
# 5. SUMAS PREFIJAS
# ═════════════════════════════════════════════════════════════════
# prefijo[i] = suma de los primeros i elementos. Entonces suma(desde..hasta) = prefijo[hasta+1] - prefijo[desde].
# Se paga O(n) una vez y cada consulta cuesta O(1).
titulo('5. Sumas prefijas')

valores = [3, 1, 4, 1, 5, 9, 2, 6]
prefijo = [0, *accumulate(valores)]         # itertools.accumulate: sumas acumuladas en O(n), perezoso
print('prefijo:', ver(prefijo))
print('suma de las posiciones 2..5:', prefijo[6] - prefijo[2], '(4+1+5+9 =', 4 + 1 + 5 + 9, ')')
# Con NumPy: np.cumsum(valores) hace lo mismo vectorizado (en C). Ojo: usa int64 y desborda en silencio con
# números enormes, justo lo que los int de Python (precisión arbitraria) nunca hacen.
try:
    import numpy as np
    print('np.cumsum:', np.cumsum(valores).tolist())
except ImportError:
    print('(NumPy no está instalado en este entorno)')

# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · busqueda_binaria ──────────────────────────────────────────
def busqueda_binaria(ordenado: list, x: int) -> int:
    """
    Índice de `x` en la lista ORDENADA ascendente, o -1 si no está. Debe ser O(log n).
    Si hay repetidos, vale cualquier posición válida (las pruebas no los incluyen).
    Escríbela a mano (con `bisect` sería trivial; aquí se pide el bucle). `ordenado.index(x)` es O(n).
    """
    pendiente()


# ── Ejercicio 2 · limite_inferior ───────────────────────────────────────────
def limite_inferior(ordenado: list, x: int) -> int:
    """
    Primera posición cuyo valor es MAYOR O IGUAL que `x` (el "lower bound"); len(ordenado) si todos son menores.
    Con repetidos devuelve la PRIMERA aparición. Es la búsqueda binaria que más se usa en la práctica
    (insertar en una lista ordenada, contar cuántos hay menores que x...). O(log n). Escríbela a mano (es lo que
    hace bisect.bisect_left).

        limite_inferior([1, 3, 3, 3, 7], 3)  →  1        limite_inferior([1, 3, 7], 5)  →  2
    """
    pendiente()


# ── Ejercicio 3 · par_suma (dos punteros) ───────────────────────────────────
def par_suma(ordenado: list, objetivo: int):
    """
    En una lista ordenada ascendente, busca dos posiciones i < j cuyos valores sumen `objetivo` y devuelve la
    lista [i, j]; None si no hay. Usa dos punteros desde los extremos: O(n). (Las pruebas solo tienen una
    solución posible.)
    """
    pendiente()


# ── Ejercicio 4 · dos_sumas (tabla hash) ────────────────────────────────────
def dos_sumas(nums: list, objetivo: int):
    """
    Como el anterior, pero la lista NO está ordenada: devuelve la lista [i, j] (i < j) con las posiciones de dos
    números que suman `objetivo`, o None. O(n) con un dict de "valor ya visto → posición".
    """
    pendiente()


# ── Ejercicio 5 · suma_maxima_ventana ───────────────────────────────────────
def suma_maxima_ventana(a: list, k: int) -> int:
    """
    La mayor suma de `k` elementos CONSECUTIVOS. O(n) con ventana deslizante.
    k < 1 o k > len(a) → ValueError.
        suma_maxima_ventana([2, 1, 5, 1, 3, 2], 3)  →  9   (5 + 1 + 3)
    (Calcular sum(a[i:i+k]) en cada posición es O(n·k).)
    """
    pendiente()


# ── Ejercicio 6 · subcadena_sin_repetir ─────────────────────────────────────
def subcadena_sin_repetir(s: str) -> int:
    """
    Longitud de la subcadena más larga SIN caracteres repetidos (ventana deslizante + dict de últimas posiciones).
    Un str de Python se recorre por PUNTOS DE CÓDIGO (un emoji cuenta como 1), no por bytes ni por unidades UTF-16.
    O(n).
        "abcabcbb" → 3 ("abc")      "bbbbb" → 1      "pwwkew" → 3 ("wke")      "" → 0
    """
    pendiente()


# ── Ejercicio 7 · agrupar_anagramas ─────────────────────────────────────────
def agrupar_anagramas(palabras: list) -> list:
    """
    Agrupa las palabras que son anagramas entre sí (mismas letras, distinto orden). Los grupos salen en el orden
    de la primera palabra de cada uno, y dentro de cada grupo se respeta el orden de entrada. Distingue minúsculas.
        ['rata', 'tara', 'sol', 'los', 'arta', 'pez']  →  [['rata', 'tara', 'arta'], ['sol', 'los'], ['pez']]
    Pista: dos palabras son anagramas si tienen las mismas letras ORDENADAS: esa es la clave del grupo
    (`''.join(sorted(p))`; una lista no vale como clave, un str o una tupla sí). Los dict conservan el orden de inserción.
    """
    pendiente()


# ── Ejercicio 8 · SumasPrefijas ─────────────────────────────────────────────
class SumasPrefijas:
    """
    Prepara una lista una vez (O(n)) para responder "¿cuánto suman las posiciones desde..hasta (inclusive)?"
    en O(1). Un rango inválido (desde < 0, hasta fuera de la lista o desde > hasta) lanza IndexError.
    Pista: itertools.accumulate.
    """

    def __init__(self, valores: list) -> None:
        pendiente()

    def suma(self, desde: int, hasta: int) -> int:
        pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS
# ═════════════════════════════════════════════════════════════════

prueba('busqueda_binaria', {
    'en medio': (([1, 3, 5, 7, 9], 5), 2),
    'el primero': (([1, 3, 5, 7, 9], 1), 0),
    'el último': (([1, 3, 5, 7, 9], 9), 4),
    'no está (en medio)': (([1, 3, 5, 7, 9], 4), -1),
    'menor que todos': (([1, 3, 5], -10), -1),
    'mayor que todos': (([1, 3, 5], 99), -1),
    'lista vacía': (([], 1), -1),
    'un elemento (está)': (([4], 4), 0),
    'un elemento (no está)': (([4], 5), -1),
    'negativos': (([-9, -4, 0, 3], -4), 1),
})

prueba('limite_inferior', {
    'con repetidos: la primera': (([1, 3, 3, 3, 7], 3), 1),
    'no está: donde iría': (([1, 3, 7], 5), 2),
    'menor que todos': (([1, 3, 7], 0), 0),
    'mayor que todos': (([1, 3, 7], 100), 3),
    'vacía': (([], 5), 0),
    'todos iguales': (([2, 2, 2, 2], 2), 0),
    'el último': (([1, 2, 3], 3), 2),
})

prueba('par_suma', {
    'básico': (([1, 2, 4, 7, 8, 11], 10), [1, 4]),
    'extremos': (([1, 5, 9], 10), [0, 2]),
    'no hay': (([1, 2, 3], 100), None),
    'lista corta': (([5], 5), None),
    'negativos': (([-4, -1, 3, 8], 7), [1, 3]),
    'vacía': (([], 0), None),
})

prueba('dos_sumas', {
    'clásico': (([2, 7, 11, 15], 9), [0, 1]),
    'desordenada': (([3, 2, 4], 6), [1, 2]),
    'con repetidos': (([3, 3], 6), [0, 1]),
    'no hay': (([1, 2, 3], 10), None),
    'vacía': (([], 3), None),
    'con negativos': (([-3, 4, 3, 90], 0), [0, 2]),
})

prueba('suma_maxima_ventana', {
    'ejemplo': (([2, 1, 5, 1, 3, 2], 3), 9),
    'ventana de 1': (([4, 8, 2], 1), 8),
    'ventana = lista': (([1, 2, 3], 3), 6),
    'con negativos': (([-5, -1, -3, -2], 2), -4),
    'al final': (([1, 1, 1, 9, 9], 2), 18),
})
grupo('suma_maxima_ventana()')
lanza('k mayor que la lista', lambda: suma_maxima_ventana([1, 2], 3), ValueError)
lanza('k cero', lambda: suma_maxima_ventana([1, 2], 0), ValueError)

prueba('subcadena_sin_repetir', {
    'abcabcbb': (('abcabcbb',), 3),
    'todos iguales': (('bbbbb',), 1),
    'pwwkew': (('pwwkew',), 3),
    'vacía': (('',), 0),
    'sin repeticiones': (('abcdef',), 6),
    'se repite al principio': (('abba',), 2),
    'con tildes': (('áéíóúáé',), 5),
    'con emojis': (('😀😎😀🎉',), 3),
})

prueba('agrupar_anagramas', {
    'ejemplo': ((['rata', 'tara', 'sol', 'los', 'arta', 'pez'],), [['rata', 'tara', 'arta'], ['sol', 'los'], ['pez']]),
    'ninguno': ((['a', 'b', 'c'],), [['a'], ['b'], ['c']]),
    'vacía': (([],), []),
    'repetidas': ((['ab', 'ba', 'ab'],), [['ab', 'ba', 'ab']]),
    'distinta longitud': ((['a', 'aa', 'aaa'],), [['a'], ['aa'], ['aaa']]),
})

grupo('SumasPrefijas')
comprueba('rango en medio', lambda: SumasPrefijas([3, 1, 4, 1, 5, 9, 2, 6]).suma(2, 5), 19)
comprueba('un solo elemento', lambda: SumasPrefijas([3, 1, 4]).suma(1, 1), 1)
comprueba('toda la lista', lambda: SumasPrefijas([1, 2, 3, 4]).suma(0, 3), 10)
comprueba('con negativos', lambda: SumasPrefijas([5, -2, -3, 4]).suma(1, 2), -5)


def _muchas_consultas() -> list:
    s = SumasPrefijas(list(range(1, 101)))
    return [s.suma(0, 99), s.suma(10, 19), s.suma(99, 99)]


comprueba('muchas consultas', _muchas_consultas, [5050, 155, 100])
lanza('desde negativo', lambda: SumasPrefijas([1, 2]).suma(-1, 1), IndexError)
lanza('hasta fuera de la lista', lambda: SumasPrefijas([1, 2]).suma(0, 2), IndexError)
lanza('desde mayor que hasta', lambda: SumasPrefijas([1, 2, 3]).suma(2, 1), IndexError)

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
medir('busqueda_binaria', lambda n: (list(range(n)), n - 1))          # O(log n) (un bucle: O(n))
medir('par_suma', lambda n: (list(range(n)), -1))                      # O(n) (con bucle doble: O(n²))
medir('dos_sumas', lambda n: (list(range(n)), -1))                     # O(n) (con bucle doble: O(n²))
medir('suma_maxima_ventana', lambda n: (list(range(1, n + 1)), n // 2))   # O(n) (recalculando cada ventana: O(n²))
medir('subcadena_sin_repetir', lambda n: (''.join(chr(0x10000 + i) for i in range(n)),))
medir(lambda s, n: s.suma(0, n - 1), lambda n: (SumasPrefijas(list(range(1, n + 1))), n),
      etiqueta='SumasPrefijas')   # O(1) por consulta (sumando el rango en cada consulta: O(n))
