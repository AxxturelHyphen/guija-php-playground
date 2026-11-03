"""
TEMA 2 · LISTAS, DICTS Y COLECCIONES
───────────────────────────────────────────────────────
Cuatro estructuras hacen el 95 % del trabajo en Python. Entender su coste y sus trampas te
ahorra casi todos los problemas de rendimiento:

    estructura        buscar x        añadir al final   insertar/quitar al principio
    list              O(n)            O(1) amortizado   O(n)   ← pop(0), insert(0, x)
    dict              O(1) por clave  O(1)              —
    set               O(1)            O(1)              —
    collections.deque O(n)            O(1)              O(1)   ← la cola de verdad

Las asignaciones NO copian (comparten el objeto): lo verás en las trampas.
"""
import itertools
import re
from collections import Counter, defaultdict, deque
from functools import reduce
from operator import itemgetter


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═══════════════════════════════════════════════════════
# 1. LISTA, DICT Y CONJUNTO
# ═══════════════════════════════════════════════════════
titulo('1. Lista, dict y conjunto')
lista = [10, 20, 30]
lista.append(40)                       # añadir al final — O(1) amortizado
mapa = {'ana': 30, 'luis': 25}         # dict: conserva el orden de inserción
mapa['eva'] = 41
print('lista:', lista)
print('dict:', mapa)
# CONJUNTO: `x in conjunto` es O(1); `x in lista` es O(n).
conjunto = {'rojo', 'verde', 'azul'}
print('¿hay verde?', 'verde' in conjunto, '· ¿hay lila?', 'lila' in conjunto)
# Las claves de un dict deben ser HASHABLES (inmutables): una tupla sirve, una lista no.
rejilla = {(0, 0): 'origen', (1, 2): 'punto'}
print(rejilla[(1, 2)])
# Y ojo: 1, 1.0 y True son la MISMA clave (se comparan igual y tienen el mismo hash).
raro = {}
raro[1] = 'a'
raro[1.0] = 'b'
raro[True] = 'c'
print('una sola clave:', raro)
# d[k] lanza KeyError si no existe; d.get(k, defecto) no.
print(mapa.get('nadie'), mapa.get('nadie', 0))

# ═══════════════════════════════════════════════════════
# 2. DESEMPAQUETAR Y *
# ═══════════════════════════════════════════════════════
titulo('2. Desempaquetar y *')
primero, _, tercero = [1, 2, 3]                         # _ por convención = "no me importa"
cabeza, *cola = [1, 2, 3, 4]                            # *cola recoge el sobrante (siempre una lista)
a, b = 1, 2
a, b = b, a                                             # intercambio sin variable temporal
print(primero, tercero, cabeza, cola, a, b)
x = [1, 2]
y = [*x, 3, *[4, 5]]                                    # * al construir: une listas
d = {**{'a': 1}, **{'b': 2}, 'a': 9}                    # ** une dicts (el último gana)
print(y, d)


def suma_todo(*numeros: int) -> int:                    # *numeros llega como tupla
    return sum(numeros)


print(suma_todo(1, 2, 3), suma_todo(*[4, 5, 6]))
for i, letra in enumerate('abc', start=1):              # enumerate: índice + valor
    print(i, letra, end='  ')
print(list(zip([1, 2, 3], 'ab')))                       # zip se detiene en el más corto

# ═══════════════════════════════════════════════════════
# 3. map / filter / reduce Y COMPRENSIONES
# ═══════════════════════════════════════════════════════
# Lo pitónico es la COMPRENSIÓN: [f(x) for x in xs if cond]. map/filter devuelven iteradores
# (perezosos), no listas: hay que envolverlos en list(). reduce vive en functools.
titulo('3. map / filter / reduce')
nums = [1, 2, 3, 4, 5, 6]
print('filter:', list(filter(lambda n: n % 2 == 0, nums)), '= comprensión', [n for n in nums if n % 2 == 0])
print('map:', list(map(lambda n: n ** 2, nums)), '= comprensión', [n ** 2 for n in nums])
print('reduce:', reduce(lambda acc, n: acc + n, nums, 0), '· pero sum() ya lo hace:', sum(nums))
print('dict por comprensión:', {k: v * 2 for k, v in {'a': 1, 'b': 2}.items()})
print('any/all:', any(n > 5 for n in nums), all(n > 0 for n in nums))

# ═══════════════════════════════════════════════════════
# 4. FILAS DE DATOS: sorted, key, Counter Y defaultdict
# ═══════════════════════════════════════════════════════
titulo('4. Filas de datos')
personas = [
    {'nombre': 'Ana', 'edad': 30, 'ciudad': 'Madrid'},
    {'nombre': 'Luis', 'edad': 25, 'ciudad': 'Sevilla'},
    {'nombre': 'Eva', 'edad': 30, 'ciudad': 'Madrid'},
]
print('nombres:', [p['nombre'] for p in personas])
print('edad por nombre:', {p['nombre']: p['edad'] for p in personas})
# sorted(xs, key=f) calcula f UNA vez por elemento y ordena por ese valor. Si key devuelve una TUPLA,
# se ordena por varios criterios (compara elemento a elemento). Para "descendente" en un número, niégalo.
por_edad = sorted(personas, key=lambda p: (-p['edad'], p['nombre']))
print('por edad desc, nombre asc:', [p['nombre'] for p in por_edad])
print('con itemgetter:', [p['nombre'] for p in sorted(personas, key=itemgetter('edad'))])
# sorted y list.sort son ESTABLES: los empatados conservan su orden original. sort() ordena en el sitio y
# devuelve None (error típico: `lista = lista.sort()`).
# Counter cuenta; defaultdict crea el valor que falta al primer acceso.
print('Counter:', Counter('abracadabra').most_common(2))
por_ciudad = defaultdict(list)
for p in personas:
    por_ciudad[p['ciudad']].append(p['nombre'])           # sin comprobar si la clave existe
print('agrupado:', dict(por_ciudad))

# ═══════════════════════════════════════════════════════
# 5. TRAMPAS CLÁSICAS
# ═══════════════════════════════════════════════════════
titulo('5. Trampas')
# 5a. [[0] * n] * m: las filas son LA MISMA lista repetida.
mal = [[0] * 3] * 2
mal[0][0] = 9
bien = [[0] * 3 for _ in range(2)]
bien[0][0] = 9
print('[[0]*3]*2 →', mal, '  ← se cambian las dos filas')
print('comprensión →', bien)
# 5b. Copia superficial: list(a), a[:], a.copy() copian el nivel de arriba; las listas internas se comparten
#     (usa copy.deepcopy si las necesitas independientes).
original = [[1], [2]]
copia = original.copy()
copia[0].append(99)
print('original tras tocar la copia:', original)
# 5c. list.pop(0) e insert(0, x) desplazan TODO: O(n). Para una cola usa collections.deque (popleft es O(1)).
cola_buena = deque([1, 2, 3])
print('popleft:', cola_buena.popleft(), list(cola_buena))
# 5d. `x in lista` es O(n); dentro de un bucle da O(n²). Se arregla pasando la lista a un set UNA vez.
grandes = list(range(1, 6))
buscar = [2, 4, 9]
sin_conjunto = [b for b in buscar if b in grandes]                  # O(len(buscar) · len(grandes))
conjunto_g = set(grandes)
con_conjunto = [b for b in buscar if b in conjunto_g]               # O(len(buscar) + len(grandes))
print('mismo resultado:', sin_conjunto, '=', con_conjunto)
# 5e. Concatenar en un bucle con `acc = acc + [x]` copia la lista cada vez: O(n²). Usa acc.append(x) o extend.
acc = []
for i in range(5):
    acc.append(i)
# 5f. Modificar una lista mientras la recorres se salta elementos: itera sobre una copia o construye otra.
datos = [1, 2, 3, 4]
for v in datos[:]:
    if v % 2 == 0:
        datos.remove(v)
print('sin pares:', datos)

# ═══════════════════════════════════════════════════════
# 6. GENERADORES, itertools Y UN AVANCE DE numpy
# ═══════════════════════════════════════════════════════
titulo('6. Generadores')


def cuadrados(hasta: int):
    for i in range(1, hasta + 1):
        yield i, i ** 2            # devuelve un valor y se "pausa" aquí hasta el siguiente next()


for i, c in cuadrados(4):
    print(f'{i}² = {c}', end='  ')
print()
# Un generador sobre 10 millones de elementos usa memoria constante; una lista, cientos de MB.
print('suma de 100000 cuadrados sin crear la lista:', sum(c for _, c in cuadrados(100000)))
# itertools: piezas perezosas listas para usar.
print(list(itertools.islice(itertools.count(10, 5), 4)),            # 10, 15, 20, 25
      list(itertools.chain([1, 2], [3])),
      list(itertools.permutations('ab')),
      list(itertools.combinations([1, 2, 3], 2)))
print({k: list(g) for k, g in itertools.groupby(sorted('abracadabra'))})   # groupby necesita la entrada ORDENADA
# Avance de numpy (se usa en IA): un ndarray guarda números del mismo tipo juntos y opera sobre todos a la vez
# en C ("vectorizado"), sin bucle de Python. Una lista guarda referencias a objetos: más flexible y mucho más lenta.
try:
    import numpy as np

    arr = np.arange(1_000_000)
    print('ndarray:', (arr * 2).sum(), arr[:3] * 2, arr.dtype, '· lista: sum(2 * x for x in lista) hace el mismo trabajo, más lento')
    print('transponer es .T:', np.array([[1, 2, 3], [4, 5, 6]]).T.tolist())
except ImportError:
    print('(numpy no está instalado en este entorno)')

# ═══════════════════════════════════════════════════════
# EJERCICIOS
# ═══════════════════════════════════════════════════════
# Sustituye cada `pendiente()` por tu código. Mantén los nombres: las pruebas los usan.

# ── Ejercicio 1 · agrupar_por ────────────────────────────────────────────
def agrupar_por(items, clave):
    """
    Agrupa los elementos según lo que devuelva `clave(elemento)`. El resultado es un dict
    clave -> lista de elementos, con las claves en el orden en que aparecen por primera vez
    y los elementos de cada grupo en su orden original.

        agrupar_por(['ana', 'luis', 'amy'], lambda s: s[0])   # {'a': ['ana', 'amy'], 'l': ['luis']}

    Una sola pasada, O(n). La alternativa ingenua (recorrer la lista una vez por cada clave distinta) es O(n · k).
    """
    pendiente()


# ── Ejercicio 2 · top_palabras ────────────────────────────────────────────
def top_palabras(texto: str, k: int) -> dict:
    """
    Las `k` palabras más frecuentes de un texto: dict palabra -> veces.
     - Palabra = secuencia de letras (con acentos y ñ); lo demás separa. No distingue mayúsculas.
     - Orden: más veces primero; a igualdad, alfabético (usa sorted con una clave que sea una tupla).
     - Si hay menos de `k` palabras distintas, devuelve las que haya; con k = 0, {}.
    Pista: re.findall(r'[^\\W\\d_]+', ...) encuentra letras Unicode; Counter cuenta.
    """
    pendiente()


# ── Ejercicio 3 · aplanar ─────────────────────────────────────────────
def aplanar(a: list) -> list:
    """
    Aplana una lista anidada (listas o tuplas) a cualquier profundidad, en orden, como lista nueva.
    Las listas vacías desaparecen. Los str NO se aplanan (son iterables de str: cuidado con la recursión infinita).

        aplanar([1, [2, [3, [4]]], 5])  →  [1, 2, 3, 4, 5]
    """
    pendiente()


# ── Ejercicio 4 · Coleccion (al estilo collect() de Laravel) ────────────────
class Coleccion:
    """
    Una envoltura fluida sobre una lista o un dict. Es INMUTABLE: cada operación devuelve una Coleccion nueva.
     - Coleccion.hacer(items): constructor estático. all(): la lista (o el dict) interna, copiada.
       len(c) y `for x in c` funcionan (con un dict recorren los valores).
     - map(f): aplica `f` a cada elemento, conservando las claves si es un dict.
     - filter(f=None): se queda con los elementos para los que `f` da True (sin `f`, los "verdaderos"),
       y devuelve una LISTA (reindexa).
     - reduce(f, inicial=None), sum(), avg() (0.0 si está vacía).
     - first(f=None, defecto=None): primero (que cumpla `f`) o `defecto`.
     - sort_by(clave, desc=False): ordena por lo que devuelva `clave(elemento)`; ESTABLE, devuelve lista.
     - pluck(campo): la columna `campo` de cada fila (dicts).
     - group_by(f): dict clave -> lista de elementos (como agrupar_por).
     - unique(): sin repetidos, conservando la primera aparición (1 y '1' son distintos). Devuelve lista.
     - take(n): los `n` primeros.
    """

    def __init__(self, items=()):
        pendiente()

    @staticmethod
    def hacer(items=()) -> 'Coleccion':
        pendiente()

    def all(self):
        pendiente()

    def __len__(self) -> int:
        pendiente()

    def __iter__(self):
        pendiente()

    def map(self, f) -> 'Coleccion':
        pendiente()

    def filter(self, f=None) -> 'Coleccion':
        pendiente()

    def reduce(self, f, inicial=None):
        pendiente()

    def sum(self):
        pendiente()

    def avg(self) -> float:
        pendiente()

    def first(self, f=None, defecto=None):
        pendiente()

    def sort_by(self, clave, desc: bool = False) -> 'Coleccion':
        pendiente()

    def pluck(self, campo: str) -> 'Coleccion':
        pendiente()

    def group_by(self, f) -> 'Coleccion':
        pendiente()

    def unique(self) -> 'Coleccion':
        pendiente()

    def take(self, n: int) -> 'Coleccion':
        pendiente()


# ── Ejercicio 5 · unicos ──────────────────────────────────────────────
def unicos(xs: list) -> list:
    """
    Quita los repetidos de una lista de enteros o textos conservando el orden de la primera aparición.
    Tiene que ser O(n): con `x in resultado` dentro de un bucle sería O(n²). Pulsa «Medir» y compruébalo.
    """
    pendiente()


# ── Ejercicio 6 · interseccion ────────────────────────────────────────────
def interseccion(a: list, b: list) -> list:
    """
    Los valores de `a` que también están en `b`, sin repetidos y en el orden de `a`. Debe ser O(n + m).

        interseccion([3, 1, 3, 2], [2, 3, 9])  →  [3, 2]

    Cuidado: `set(a) & set(b)` es correcto pero pierde el orden.
    """
    pendiente()


# ── Ejercicio 7 · transponer ────────────────────────────────────────────
def transponer(m: list) -> list:
    """
    Transpone una matriz rectangular (lista de filas): las filas pasan a ser columnas.

        [[1, 2, 3], [4, 5, 6]]  →  [[1, 4], [2, 5], [3, 6]]

    Devuelve listas (no tuplas). Una matriz vacía da []. Pista: zip(*m).
    """
    pendiente()


# ═══════════════════════════════════════════════════════
# PRUEBAS
# ═══════════════════════════════════════════════════════

prueba('agrupar_por', {
    'por inicial': ((['ana', 'luis', 'amy'], lambda s: s[0]), {'a': ['ana', 'amy'], 'l': ['luis']}),
    'por paridad (claves enteras)': (([1, 2, 3, 4, 5], lambda n: n % 2), {1: [1, 3, 5], 0: [2, 4]}),
    'vacío': (([], lambda x: x), {}),
    'un solo grupo': ((['x', 'y'], lambda x: 'todos'), {'todos': ['x', 'y']}),
})

prueba('top_palabras', {
    'cuenta y ordena': (('a b a c b a', 2), {'a': 3, 'b': 2}),
    'desempata alfabéticamente': (('perro gato loro', 2), {'gato': 1, 'loro': 1}),
    'ignora mayúsculas y signos': (('¡Hola, hola! HOLA... adiós', 5), {'hola': 3, 'adiós': 1}),
    'letras con acento': (('Él él ÉL pie', 1), {'él': 3}),
    'k = 0': (('a b c', 0), {}),
    'texto sin palabras': (('123 ... !!!', 3), {}),
})

prueba('aplanar', {
    'anidado': (([1, [2, [3, [4]]], 5],), [1, 2, 3, 4, 5]),
    'ya plano': (([1, 2, 3],), [1, 2, 3]),
    'vacíos': (([[], [[]], []],), []),
    'mezcla de tipos': ((['a', [True, [None, 1.5]]],), ['a', True, None, 1.5]),
    'con tuplas': (([1, (2, [3, (4,)])],), [1, 2, 3, 4]),
})

personas = [
    {'nombre': 'Ana', 'edad': 30, 'ciudad': 'Madrid'},
    {'nombre': 'Luis', 'edad': 25, 'ciudad': 'Sevilla'},
    {'nombre': 'Eva', 'edad': 30, 'ciudad': 'Madrid'},
    {'nombre': 'Pau', 'edad': 41, 'ciudad': 'Sevilla'},
]

grupo('Coleccion')
comprueba('map conserva claves', lambda: Coleccion.hacer({'a': 1, 'b': 2}).map(lambda x: x * 10).all(), {'a': 10, 'b': 20})
comprueba('filter reindexa', lambda: Coleccion.hacer([1, 2, 3, 4, 5]).filter(lambda x: x % 2 == 1).all(), [1, 3, 5])
comprueba('filter sin función quita los falsos', lambda: Coleccion.hacer([0, 1, '', 'a', None, False]).filter().all(), [1, 'a'])
comprueba('reduce', lambda: Coleccion.hacer([1, 2, 3]).reduce(lambda acc, x: acc * 10 + x, 0), 123)
comprueba('sum y avg', lambda: [Coleccion.hacer([1, 2, 3, 4]).sum(), Coleccion.hacer([1, 2, 3, 4]).avg()], [10, 2.5])
comprueba('avg de una colección vacía', lambda: Coleccion.hacer().avg(), 0.0)
comprueba('first', lambda: [Coleccion.hacer([5, 6, 7]).first(), Coleccion.hacer([5, 6, 7]).first(lambda x: x > 5),
                            Coleccion.hacer().first(None, 'nada')], [5, 6, 'nada'])
comprueba('sort_by descendente y estable',
          lambda: Coleccion.hacer(personas).sort_by(lambda p: p['edad'], True).pluck('nombre').all(), ['Pau', 'Ana', 'Eva', 'Luis'])
comprueba('sort_by ascendente', lambda: Coleccion.hacer(personas).sort_by(lambda p: p['nombre']).pluck('nombre').all(),
          ['Ana', 'Eva', 'Luis', 'Pau'])
comprueba('group_by + map',
          lambda: Coleccion.hacer(personas).group_by(lambda p: p['ciudad']).map(lambda g: len(g)).all(), {'Madrid': 2, 'Sevilla': 2})
comprueba('unique distingue 1 de "1"', lambda: Coleccion.hacer([3, 1, 3, '1', 2, 1]).unique().all(), [3, 1, '1', 2])
comprueba('take', lambda: Coleccion.hacer([1, 2, 3, 4]).take(2).all(), [1, 2])
comprueba('encadenado',
          lambda: Coleccion.hacer(range(1, 11)).filter(lambda x: x % 2 == 0).map(lambda x: x * x).sum(), 220)


def _inmutable():
    c = Coleccion.hacer([1, 2])
    c.map(lambda x: x * 10)
    c.filter(lambda x: False)
    return c.all()


comprueba('es inmutable', _inmutable, [1, 2])


def _len_e_iteracion():
    c = Coleccion.hacer([1, 2, 3])
    suma = 0
    for x in c:
        suma += x
    return [len(c), suma]


comprueba('len() y for', _len_e_iteracion, [3, 6])

prueba('unicos', {
    'enteros': (([3, 1, 3, 2, 1],), [3, 1, 2]),
    'textos': ((['b', 'a', 'b', 'c', 'a'],), ['b', 'a', 'c']),
    'sin repetidos': (([1, 2, 3],), [1, 2, 3]),
    'vacío': (([],), []),
    'todos iguales': (([7, 7, 7, 7],), [7]),
})

prueba('interseccion', {
    'básica': (([3, 1, 3, 2], [2, 3, 9]), [3, 2]),
    'sin elementos comunes': (([1, 2], [3, 4]), []),
    'vacía': (([], [1, 2]), []),
    'una de las dos vacía': (([1, 2], []), []),
    'conserva el orden de la primera': (([5, 4, 3, 2, 1], [1, 3, 5]), [5, 3, 1]),
})

prueba('transponer', {
    'rectangular': (([[1, 2, 3], [4, 5, 6]],), [[1, 4], [2, 5], [3, 6]]),
    'una sola fila': (([[1, 2, 3]],), [[1], [2], [3]]),
    'una sola columna': (([[1], [2], [3]],), [[1, 2, 3]]),
    'cuadrada': (([[1, 2], [3, 4]],), [[1, 3], [2, 4]]),
    'vacía': (([],), []),
})


# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
# Con `x in resultado` dentro del bucle saldrá O(n²); con un set o dict.fromkeys, O(n).
def con_repetidos(n: int) -> list:
    return [(i * 7919) % max(1, n // 2) for i in range(n)]


medir('unicos', lambda n: (con_repetidos(n),))
medir('interseccion', lambda n: (list(range(n)), list(range(n // 2, n + n // 2))))
