"""
SOLUCIONES · Tema 4 · Ordenación
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
"""


def burbuja(xs: list) -> list:
    """
    Burbuja con parada anticipada.

    @complejidad Tiempo O(n²) en el caso medio y peor, O(n) si ya está ordenada; espacio O(n) por la copia (O(1) extra).
    @explicacion En cada pasada el mayor "sube" al final, así que la zona final ya no se revisa (`n - pasada`). Si una
    pasada completa no intercambia nada, se corta: una lista ordenada cuesta una sola pasada.
    @alternativas Insertion sort hace menos escrituras; en la práctica `sorted()` (Timsort, O(n log n)).
    @bigo n2
    """
    xs = list(xs)
    n = len(xs)
    for pasada in range(1, n):
        cambio = False
        for i in range(n - pasada):
            if xs[i] > xs[i + 1]:
                xs[i], xs[i + 1] = xs[i + 1], xs[i]
                cambio = True
        if not cambio:
            break
    return xs


def insercion(xs: list) -> list:
    """
    Ordenación por inserción.

    @complejidad Tiempo O(n²) medio y peor, O(n) si ya está ordenada; espacio O(1) extra sobre la copia.
    @explicacion Se toma cada elemento y se desplazan a la derecha los mayores de la parte ordenada hasta encontrar su
    hueco. Cada desplazamiento es una sola asignación, no un intercambio.
    @alternativas Con búsqueda binaria (`bisect.insort`) se reducen las comparaciones, pero el desplazamiento sigue siendo O(n).
    @bigo n2
    """
    xs = list(xs)
    for i in range(1, len(xs)):
        actual = xs[i]
        j = i - 1
        while j >= 0 and xs[j] > actual:
            xs[j + 1] = xs[j]
            j -= 1
        xs[j + 1] = actual
    return xs


def merge_sort(xs: list, comparar=None) -> list:
    """
    Merge sort estable con comparador opcional.

    @complejidad Tiempo O(n log n) siempre; espacio O(n) para las listas mezcladas.
    @explicacion Se parte por la mitad, se ordena cada parte y se mezclan con dos índices (sin `pop(0)`, que sería O(n)).
    La estabilidad sale de preferir el elemento de la izquierda cuando `comparar(izq, der) <= 0`.
    @alternativas `sorted(xs, key=cmp_to_key(comparar))`: Timsort, también estable y O(n log n).
    @bigo nlogn
    """
    if comparar is None:
        def comparar(a, b):
            return (a > b) - (a < b)
    if len(xs) <= 1:
        return list(xs)
    medio = len(xs) // 2
    izq = merge_sort(xs[:medio], comparar)
    der = merge_sort(xs[medio:], comparar)
    resultado = []
    i = j = 0
    while i < len(izq) and j < len(der):
        if comparar(izq[i], der[j]) <= 0:
            resultado.append(izq[i])
            i += 1
        else:
            resultado.append(der[j])
            j += 1
    resultado.extend(izq[i:])
    resultado.extend(der[j:])
    return resultado


def quick_sort(xs: list) -> list:
    """
    Quick sort con pivote central y tres grupos.

    @complejidad Tiempo O(n log n) medio, O(n²) en el peor caso; espacio O(n) en esta versión funcional.
    @explicacion El pivote central evita el peor caso en listas ordenadas o inversas; separar los "iguales" hace que las
    listas con muchos repetidos no degeneren. No es in situ: crea listas nuevas en cada nivel.
    @alternativas La versión in situ (partición de Hoare) gasta O(log n) de pila; `sorted()` es lo recomendable.
    @bigo nlogn
    """
    if len(xs) <= 1:
        return list(xs)
    pivote = xs[len(xs) // 2]
    menores = [x for x in xs if x < pivote]
    iguales = [x for x in xs if x == pivote]
    mayores = [x for x in xs if x > pivote]
    return quick_sort(menores) + iguales + quick_sort(mayores)


def counting_sort(xs: list, maximo: int) -> list:
    """
    Ordenación por conteo.

    @complejidad Tiempo O(n + k) con k = maximo; espacio O(k).
    @explicacion Un contador por valor posible; luego se recorre de 0 a maximo repitiendo cada valor tantas veces como
    se contó. No compara, así que no está sujeto al límite O(n log n). Solo compensa si k no es mucho mayor que n.
    @alternativas `collections.Counter` si el rango es disperso; `sorted()` si k es enorme.
    @bigo n
    """
    cuentas = [0] * (maximo + 1)
    for x in xs:
        if x < 0 or x > maximo:
            raise ValueError(f'Valor fuera de rango 0..{maximo}: {x}')
        cuentas[x] += 1
    resultado = []
    for valor, veces in enumerate(cuentas):
        resultado.extend([valor] * veces)
    return resultado


def ordenar_personas(personas: list) -> list:
    """
    Ordena por apellido, edad descendente y nombre.

    @complejidad Tiempo O(n log n); espacio O(n).
    @explicacion La clave es una tupla `(apellido, -edad, nombre)`: se compara elemento a elemento, y negar la edad
    invierte solo ese criterio. `key` se evalúa una vez por persona.
    @alternativas Varias pasadas estables (de la clave menos importante a la más importante) o `cmp_to_key`, más lento.
    """
    return sorted(personas, key=lambda p: (p['apellido'], -p['edad'], p['nombre']))


def ordenar_por_frecuencia(xs: list) -> list:
    """
    Ordena por frecuencia descendente y valor ascendente.

    @complejidad Tiempo O(n + k log k) con k valores distintos (≤ O(n log n)); espacio O(n).
    @explicacion `Counter` cuenta en O(n); se ordenan solo los valores distintos por `(-frecuencia, valor)` y se
    expande cada uno tantas veces como aparecía.
    @alternativas `sorted(xs, key=lambda x: (-cuentas[x], x))`: más corto, pero ordena los n elementos.
    """
    from collections import Counter
    cuentas = Counter(xs)
    resultado = []
    for valor in sorted(cuentas, key=lambda v: (-cuentas[v], v)):
        resultado.extend([valor] * cuentas[valor])
    return resultado
