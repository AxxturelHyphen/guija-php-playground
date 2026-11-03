"""
TEMA 4 · ORDENACIÓN
─────────────────────────────────────────────────────────────────
Ordenar es el problema "de laboratorio" de los algoritmos: hay muchas soluciones y cada una enseña una idea.
En la vida real casi siempre usarás sorted()/list.sort() de Python (rápidos y escritos en C), pero entender los
algoritmos te enseña a razonar sobre coste, estabilidad y memoria.

  Algoritmo        Mejor      Medio       Peor        Memoria   Estable
  burbuja          O(n)       O(n²)       O(n²)       O(1)      sí
  inserción        O(n)       O(n²)       O(n²)       O(1)      sí
  merge sort       O(n log n) O(n log n)  O(n log n)  O(n)      sí
  quick sort       O(n log n) O(n log n)  O(n²)       O(log n)  no (típico)
  counting sort    O(n + k)   O(n + k)    O(n + k)    O(k)      sí (con cuidado)
  Timsort (Python) O(n)       O(n log n)  O(n log n)  O(n)      sí

"Estable" = los elementos que empatan conservan el orden que tenían. Importa cuando ordenas por un criterio y luego
por otro.
"""
import json
from functools import cmp_to_key


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


def ver(valor) -> str:
    return json.dumps(valor, ensure_ascii=False)


# ═════════════════════════════════════════════════════════════════
# 1. sorted() FRENTE A list.sort()
# ═════════════════════════════════════════════════════════════════
# · sorted(iterable) devuelve una lista NUEVA y sirve para cualquier iterable (tuplas, sets, dict...). O(n log n)
#   de tiempo y O(n) de memoria extra.
# · lista.sort() ordena IN SITU y devuelve None: nunca hagas `ordenado = lista.sort()` (te quedas con None).
#   Es algo más rápido y ahorra la copia.
# · Ambos admiten key=... (función que da la clave de cada elemento) y reverse=True. Python usa Timsort: ESTABLE,
#   O(n) si ya está casi ordenada, O(n log n) en el peor caso.
titulo('1. sorted() frente a list.sort()')

numeros = [10, 9, 2, 33, 1]
copia = sorted(numeros)
print('original:', ver(numeros), '· sorted:', ver(copia))
numeros.sort(reverse=True)                        # in situ; reverse=True es estable (no es sorted(...)[::-1])
print('sort(reverse=True) in situ:', ver(numeros))
print('sort() devuelve:', numeros.sort())          # None: la trampa clásica

edades = {'ana': 30, 'luis': 25, 'eva': 41}
print('por valor (los dict no se "ordenan", se reconstruyen):', ver(dict(sorted(edades.items(), key=lambda kv: kv[1]))))
print('por clave:', ver(dict(sorted(edades.items()))))
print('los de más edad primero:', ver(sorted(edades, key=edades.get, reverse=True)))

# key= recibe UN elemento y devuelve la clave a comparar (se evalúa una sola vez por elemento). Una tupla como clave
# ordena por varios criterios: se compara elemento a elemento.
palabras = ['kiwi', 'fresa', 'pera', 'uva']
print('por longitud y luego alfabético:', ver(sorted(palabras, key=lambda p: (len(p), p))))

# cmp_to_key adapta un comparador clásico (negativo, cero, positivo) al mundo de key=. Es más lento que key: úsalo
# solo cuando el criterio no se pueda expresar como una clave.
print('con comparador:', ver(sorted(palabras, key=cmp_to_key(lambda a, b: len(b) - len(a) or (a > b) - (a < b)))))

# Trampa: comparar texto y números. Python 3 NO mezcla tipos: sorted([1, 'a']) lanza TypeError.
mezcla = ['10', '9', '2', '1']
print('como texto (orden lexicográfico):', ver(sorted(mezcla)))
print('como números:', ver(sorted(mezcla, key=int)))
archivos = ['img12.png', 'img10.png', 'IMG2.png', 'img1.png']
print('sin distinguir mayúsculas:', ver(sorted(archivos, key=str.lower)))   # img1, img10, img12, IMG2: lexicográfico
# Orden "natural" (img1, IMG2, img10, img12): la clave separa los números del texto.
import re
print('orden natural:', ver(sorted(archivos, key=lambda a: [int(t) if t.isdigit() else t for t in re.split(r'(\d+)', a.lower())])))

# ═════════════════════════════════════════════════════════════════
# 2. ESTABILIDAD
# ═════════════════════════════════════════════════════════════════
# Timsort es estable: ordenar por edad deja a los empatados en su orden de entrada. Por eso se puede ordenar en
# varias pasadas: primero por el criterio secundario y luego por el principal.
titulo('2. Estabilidad')

gente = [['Ana', 30], ['Luis', 25], ['Eva', 30], ['Pau', 25]]
print(ver(sorted(gente, key=lambda p: p[1])), '  ← Luis antes que Pau, Ana antes que Eva (como entraron)')
por_nombre = sorted(gente)                                    # 1.ª pasada: criterio secundario
print('dos pasadas:', ver(sorted(por_nombre, key=lambda p: p[1], reverse=True)))   # 2.ª: la principal; reverse conserva la estabilidad

# ═════════════════════════════════════════════════════════════════
# 3. VER A LA BURBUJA TRABAJAR
# ═════════════════════════════════════════════════════════════════
# La burbuja compara vecinos y los intercambia; en cada pasada, el mayor "sube" al final.
titulo('3. Una burbuja paso a paso')


def burbuja_con_traza(xs: list) -> list:
    xs = list(xs)
    n = len(xs)
    comparaciones = 0
    for pasada in range(1, n):
        cambio = False
        for i in range(n - pasada):
            comparaciones += 1
            if xs[i] > xs[i + 1]:
                xs[i], xs[i + 1] = xs[i + 1], xs[i]           # intercambio sin variable temporal
                cambio = True
        print(f'pasada {pasada}:', ver(xs))
        if not cambio:                                         # optimización: ya está ordenado
            break
    print('comparaciones:', comparaciones)
    return xs


burbuja_con_traza([5, 1, 4, 2, 8])

# ═════════════════════════════════════════════════════════════════
# 4. CUÁNTO CRECE EL TRABAJO
# ═════════════════════════════════════════════════════════════════
# Contamos las comparaciones que hace el Timsort de Python (O(n log n)) frente a lo que haría un algoritmo O(n²):
# al multiplicar n por 10, n log n se multiplica por ~13 y n² por 100.
titulo('4. n log n frente a n²')


def aleatorios(n: int, maximo: int = 1000, semilla: int = 12345) -> list:
    resultado = []
    x = semilla
    for _ in range(n):
        x = (x * 1103515245 + 12345) & 0x7fffffff       # generador congruencial: mismos datos en cada ejecución
        resultado.append(x % (maximo + 1))
    return resultado


for n in (100, 1000, 10000):
    datos = aleatorios(n, 1_000_000)
    comparaciones = 0

    def comparar(a: int, b: int) -> int:
        global comparaciones
        comparaciones += 1
        return (a > b) - (a < b)

    datos.sort(key=cmp_to_key(comparar))
    print(f'n = {n:>6,}   sort() hizo {comparaciones:>9,} comparaciones   (un O(n²) haría ~{n * n // 2:,})'.replace(',', '.'))

# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════
# Todos reciben una lista y DEVUELVEN otra ordenada de menor a mayor, sin modificar la original.
# No uses sorted()/list.sort() en los cinco primeros: el objetivo es escribir el algoritmo (en ordenar_personas y
# ordenar_por_frecuencia, sí).

# ── Ejercicio 1 · burbuja ───────────────────────────────────────────────────
def burbuja(xs: list) -> list:
    """
    Ordenación de la burbuja con parada anticipada: si en una pasada completa no se intercambia nada,
    la lista ya está ordenada y se termina (así una lista ordenada cuesta O(n) y no O(n²)).
    Trabaja sobre una copia (`list(xs)`): no modifiques la original.
    """
    pendiente()


# ── Ejercicio 2 · insercion ─────────────────────────────────────────────────
def insercion(xs: list) -> list:
    """
    Ordenación por inserción: mantén una parte izquierda ya ordenada y ve insertando cada nuevo elemento en su sitio,
    desplazando los mayores una posición a la derecha. Es la que usan las librerías para listas pequeñas (Timsort
    la emplea en cada trozo corto).
    """
    pendiente()


# ── Ejercicio 3 · merge_sort ────────────────────────────────────────────────
def merge_sort(xs: list, comparar=None) -> list:
    """
    Merge sort (divide y vencerás): parte la lista por la mitad, ordena cada mitad y mézclalas.
    Debe ser ESTABLE y aceptar un comparador opcional (`lambda a, b: int`, negativo/cero/positivo, como el de
    cmp_to_key). Sin comparador, ordena de menor a mayor con < y >.
    Cuidado con las rebanadas: xs[:m] copia (O(n) por nivel, lo esperado); no uses `pop(0)` para mezclar (O(n) cada uno).
    """
    pendiente()


# ── Ejercicio 4 · quick_sort ────────────────────────────────────────────────
def quick_sort(xs: list) -> list:
    """
    Quick sort: elige un pivote (el elemento central), reparte el resto en menores, iguales y mayores,
    y ordena recursivamente menores y mayores. Con "iguales" aparte, las listas con muchos repetidos no se degradan.
    """
    pendiente()


# ── Ejercicio 5 · counting_sort ─────────────────────────────────────────────
def counting_sort(xs: list, maximo: int) -> list:
    """
    Ordenación por conteo para enteros en el rango 0..maximo: cuenta cuántas veces aparece cada valor y reconstruye
    la lista. No compara elementos, así que se salta el límite O(n log n): cuesta O(n + maximo).
    Un valor fuera de 0..maximo lanza ValueError.
    """
    pendiente()


# ── Ejercicio 6 · ordenar_personas ──────────────────────────────────────────
def ordenar_personas(personas: list) -> list:
    """
    Ordena personas por varios criterios a la vez: apellido ascendente, luego edad DESCENDENTE, luego nombre
    ascendente. Cada persona es {'nombre': ..., 'apellido': ..., 'edad': ...}. Aquí SÍ puedes usar sorted con
    una clave que sea una tupla (truco: la edad se niega para que "ascendente" sea "descendente").
    """
    pendiente()


# ── Ejercicio 7 · ordenar_por_frecuencia ────────────────────────────────────
def ordenar_por_frecuencia(xs: list) -> list:
    """
    Ordena una lista de enteros por frecuencia (los que más se repiten, primero) y, a igual frecuencia,
    por valor ascendente. Los elementos se repiten en el resultado tantas veces como aparecían.
        [4, 6, 2, 6, 4, 4, 6]  →  [4, 4, 4, 6, 6, 6, 2]
    Pista: collections.Counter cuenta en O(n).
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS
# ═════════════════════════════════════════════════════════════════

def casos() -> dict:
    return {
        'vacía': (([],), []),
        'un elemento': (([7],), [7]),
        'ya ordenada': (([1, 2, 3, 4, 5],), [1, 2, 3, 4, 5]),
        'inversa': (([5, 4, 3, 2, 1],), [1, 2, 3, 4, 5]),
        'con repetidos': (([3, 1, 3, 2, 1, 3],), [1, 1, 2, 3, 3, 3]),
        'negativos': (([0, -5, 3, -1, 2],), [-5, -1, 0, 2, 3]),
        'todos iguales': (([4, 4, 4, 4],), [4, 4, 4, 4]),
        'dos elementos': (([2, 1],), [1, 2]),
    }


def _aleatorios_ordena(nombre: str) -> bool:
    datos = aleatorios(500, 100000)
    return globals()[nombre](datos) == sorted(datos)


def _no_modifica(nombre: str) -> list:
    datos = [3, 1, 2]
    globals()[nombre](datos)
    return datos


for nombre in ('burbuja', 'insercion', 'merge_sort', 'quick_sort'):
    prueba(nombre, casos())
    grupo(nombre + '()')
    comprueba('500 números aleatorios', lambda nombre=nombre: _aleatorios_ordena(nombre), True)
    comprueba('no modifica la lista original', lambda nombre=nombre: _no_modifica(nombre), [3, 1, 2])

grupo('merge_sort()')
comprueba('es estable', lambda: merge_sort([['a', 1], ['b', 0], ['c', 1], ['d', 0]], lambda x, y: x[1] - y[1]),
          [['b', 0], ['d', 0], ['a', 1], ['c', 1]])
comprueba('acepta un comparador (descendente)', lambda: merge_sort([1, 3, 2], lambda a, b: b - a), [3, 2, 1])
comprueba('ordena textos', lambda: merge_sort(['pera', 'uva', 'fresa']), ['fresa', 'pera', 'uva'])

prueba('counting_sort', {
    'básica': (([3, 1, 2, 1, 0], 3), [0, 1, 1, 2, 3]),
    'vacía': (([], 5), []),
    'repetidos': (([2, 2, 2], 2), [2, 2, 2]),
    'rango mayor que los datos': (([5, 1], 100), [1, 5]),
})
grupo('counting_sort()')
lanza('valor fuera de rango', lambda: counting_sort([1, 9], 5), ValueError)
lanza('negativo', lambda: counting_sort([-1, 2], 5), ValueError)
comprueba('1000 números en 0..50', lambda: counting_sort(aleatorios(1000, 50), 50) == sorted(aleatorios(1000, 50)), True)

prueba('ordenar_personas', {
    'por apellido': (([
        {'nombre': 'Luis', 'apellido': 'Pérez', 'edad': 25},
        {'nombre': 'Ana', 'apellido': 'García', 'edad': 30},
    ],), [
        {'nombre': 'Ana', 'apellido': 'García', 'edad': 30},
        {'nombre': 'Luis', 'apellido': 'Pérez', 'edad': 25},
    ]),
    'mismo apellido: edad descendente': (([
        {'nombre': 'Ana', 'apellido': 'Ruiz', 'edad': 20},
        {'nombre': 'Eva', 'apellido': 'Ruiz', 'edad': 40},
    ],), [
        {'nombre': 'Eva', 'apellido': 'Ruiz', 'edad': 40},
        {'nombre': 'Ana', 'apellido': 'Ruiz', 'edad': 20},
    ]),
    'mismo apellido y edad: nombre ascendente': (([
        {'nombre': 'Zoe', 'apellido': 'Ruiz', 'edad': 30},
        {'nombre': 'Ana', 'apellido': 'Ruiz', 'edad': 30},
    ],), [
        {'nombre': 'Ana', 'apellido': 'Ruiz', 'edad': 30},
        {'nombre': 'Zoe', 'apellido': 'Ruiz', 'edad': 30},
    ]),
    'vacía': (([],), []),
})

prueba('ordenar_por_frecuencia', {
    'ejemplo': (([4, 6, 2, 6, 4, 4, 6],), [4, 4, 4, 6, 6, 6, 2]),
    'sin repetidos: por valor': (([3, 1, 2],), [1, 2, 3]),
    'un valor domina': (([1, 2, 2, 3, 2],), [2, 2, 2, 1, 3]),
    'vacía': (([],), []),
    'negativos': (([-1, 5, -1, 5, 0],), [-1, -1, 5, 5, 0]),
})

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
# Verás O(n²) para burbuja e inserción y O(n log n) para merge y quick sort. Los datos son pseudoaleatorios
# pero siempre los mismos, para que las mediciones sean comparables.
for nombre in ('burbuja', 'insercion', 'merge_sort', 'quick_sort'):
    medir(nombre, lambda n: (aleatorios(n, 1_000_000),))
medir('counting_sort', lambda n: (aleatorios(n, 1000), 1000))
