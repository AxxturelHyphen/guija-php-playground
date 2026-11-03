"""
SOLUCIONES · Tema 5 · Búsqueda y técnicas
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
"""


def busqueda_binaria(ordenado: list, x: int) -> int:
    """
    Búsqueda binaria de un valor exacto.

    @complejidad Tiempo O(log n); espacio O(1).
    @explicacion Invariante: si `x` está, está en [bajo, alto]. Se mira el medio y se descarta la mitad que no puede
    contenerlo, avanzando siempre `medio ± 1` (si no, bucle infinito). `(bajo + alto) // 2` no desborda en Python.
    @alternativas `bisect.bisect_left` + comprobación; `lista.index(x)` es O(n) y falla si no está.
    @bigo log
    """
    bajo, alto = 0, len(ordenado) - 1
    while bajo <= alto:
        medio = (bajo + alto) // 2
        if ordenado[medio] == x:
            return medio
        if ordenado[medio] < x:
            bajo = medio + 1
        else:
            alto = medio - 1
    return -1


def limite_inferior(ordenado: list, x: int) -> int:
    """
    Primera posición con valor >= x ("lower bound").

    @complejidad Tiempo O(log n); espacio O(1).
    @explicacion Plantilla `bajo < alto` con `alto = len`: la respuesta está siempre en [bajo, alto]. Si el medio es menor
    que `x`, la respuesta está a su derecha; si no, puede ser el propio medio, así que `alto = medio` (sin restar 1).
    @alternativas `bisect.bisect_left(ordenado, x)` hace exactamente esto, en C.
    @bigo log
    """
    bajo, alto = 0, len(ordenado)
    while bajo < alto:
        medio = (bajo + alto) // 2
        if ordenado[medio] < x:
            bajo = medio + 1
        else:
            alto = medio
    return bajo


def par_suma(ordenado: list, objetivo: int):
    """
    Dos punteros sobre una lista ordenada.

    @complejidad Tiempo O(n); espacio O(1).
    @explicacion Si la suma es pequeña, avanza el puntero izquierdo (necesitas algo mayor); si es grande, retrocede el
    derecho. Cada paso descarta al menos un candidato, de modo que hay como mucho n pasos.
    @alternativas Doble bucle O(n²); dict de complementos O(n) pero con O(n) de memoria.
    @bigo n
    """
    i, j = 0, len(ordenado) - 1
    while i < j:
        suma = ordenado[i] + ordenado[j]
        if suma == objetivo:
            return [i, j]
        if suma < objetivo:
            i += 1
        else:
            j -= 1
    return None


def dos_sumas(nums: list, objetivo: int):
    """
    Dos sumas con un dict.

    @complejidad Tiempo O(n); espacio O(n).
    @explicacion Para cada número se pregunta si su complemento ya se vio (búsqueda O(1) en el dict) y después se guarda el
    número con su posición. Así el índice del complemento siempre es menor que el actual y no se empareja un valor consigo mismo.
    @alternativas Doble bucle O(n²) de tiempo y O(1) de memoria; ordenar + dos punteros pierde los índices originales.
    @bigo n
    """
    vistos = {}
    for i, n in enumerate(nums):
        falta = objetivo - n
        if falta in vistos:
            return [vistos[falta], i]
        vistos[n] = i
    return None


def suma_maxima_ventana(a: list, k: int) -> int:
    """
    Mayor suma de k elementos consecutivos.

    @complejidad Tiempo O(n); espacio O(1).
    @explicacion Se suma la primera ventana y se desliza: entra `a[i]`, sale `a[i - k]`. Cada elemento se toca dos veces
    como mucho. Se valida `k` antes de rebanar.
    @alternativas Recalcular `sum(a[i:i+k])` en cada posición es O(n·k).
    @bigo n
    """
    if k < 1 or k > len(a):
        raise ValueError(f'k debe estar entre 1 y {len(a)}')
    suma = sum(a[:k])
    mejor = suma
    for i in range(k, len(a)):
        suma += a[i] - a[i - k]
        mejor = max(mejor, suma)
    return mejor


def subcadena_sin_repetir(s: str) -> int:
    """
    Subcadena más larga sin caracteres repetidos.

    @complejidad Tiempo O(n); espacio O(min(n, alfabeto)).
    @explicacion Ventana [inicio, i]: un dict guarda la última posición de cada carácter. Si el carácter ya está dentro
    de la ventana, `inicio` salta justo después de su aparición anterior (nunca retrocede). Un str se recorre por puntos
    de código, así que un emoji cuenta como 1.
    @alternativas Probar todas las subcadenas con un set: O(n²) o peor.
    @bigo n
    """
    ultima = {}
    inicio = 0
    mejor = 0
    for i, c in enumerate(s):
        if c in ultima and ultima[c] >= inicio:
            inicio = ultima[c] + 1
        ultima[c] = i
        mejor = max(mejor, i - inicio + 1)
    return mejor


def agrupar_anagramas(palabras: list) -> list:
    """
    Agrupa anagramas por su clave de letras ordenadas.

    @complejidad Tiempo O(n · m log m) con m = longitud de la palabra; espacio O(n·m).
    @explicacion La clave `''.join(sorted(p))` es igual para todos los anagramas. Los dict conservan el orden de
    inserción, así que los grupos salen en el orden de su primera palabra y cada grupo respeta el orden de entrada.
    @alternativas Una clave por conteo de letras (tupla de 26 contadores) baja a O(n·m); `defaultdict(list)` ahorra el `setdefault`.
    """
    grupos = {}
    for p in palabras:
        grupos.setdefault(''.join(sorted(p)), []).append(p)
    return list(grupos.values())


class SumasPrefijas:
    """
    Sumas de rango en O(1).

    @complejidad Construcción O(n); `suma` O(1); espacio O(n).
    @explicacion `prefijo[i]` es la suma de los i primeros valores (con un 0 inicial), así que
    suma(desde, hasta) = prefijo[hasta + 1] - prefijo[desde]. Se valida el rango y se lanza IndexError.
    @alternativas Sumar el rango en cada consulta es O(n) por consulta; un árbol de Fenwick permite también modificar valores.
    @bigo 1
    """

    def __init__(self, valores: list) -> None:
        from itertools import accumulate
        self._prefijo = [0, *accumulate(valores)]

    def suma(self, desde: int, hasta: int) -> int:
        if desde < 0 or hasta >= len(self._prefijo) - 1 or desde > hasta:
            raise IndexError(f'Rango no válido: {desde}..{hasta}')
        return self._prefijo[hasta + 1] - self._prefijo[desde]
