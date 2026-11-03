"""
SOLUCIONES · Tema 2 · Listas, dicts y colecciones
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
"""


def agrupar_por(items, clave):
    """
    Agrupa elementos por clave conservando el orden.

    @complejidad Tiempo O(n); espacio O(n).
    @explicacion Una sola pasada: `setdefault` crea la lista del grupo la primera vez que aparece la clave y devuelve
    el grupo, al que se añade el elemento. Como el dict conserva el orden de inserción, las claves salen en el orden de
    primera aparición.
    @alternativas `defaultdict(list)` (igual de bueno, pero devuelve un defaultdict que habría que convertir con dict()).
    Recorrer la lista una vez por cada clave distinta: O(n · k).
    @bigo n
    """
    grupos: dict = {}
    for item in items:
        grupos.setdefault(clave(item), []).append(item)
    return grupos


def top_palabras(texto: str, k: int) -> dict:
    """
    Las k palabras más frecuentes.

    @complejidad Tiempo O(n + p log p) con p palabras distintas; espacio O(p).
    @explicacion La expresión regular `[^\\W\\d_]+` casa letras Unicode (acentos y ñ incluidos) y descarta dígitos y
    signos. Counter cuenta en una pasada y `sorted` con la clave `(-veces, palabra)` ordena por veces descendente y, en
    empate, alfabéticamente (se niega el número porque la tupla se compara de menor a mayor).
    @alternativas `Counter.most_common(k)`: no desempata alfabéticamente (conserva el orden de aparición).
    @bigo nlogn
    """
    import re
    from collections import Counter
    cuenta = Counter(re.findall(r'[^\W\d_]+', texto.lower()))
    ordenadas = sorted(cuenta.items(), key=lambda par: (-par[1], par[0]))
    return dict(ordenadas[:max(0, k)])


def aplanar(a: list) -> list:
    """
    Aplana una lista anidada.

    @complejidad Tiempo O(n) sobre el total de elementos; espacio O(n + d) con profundidad d de pila.
    @explicacion Recursión sobre listas y tuplas: lo que no es colección se añade tal cual y lo que lo es se aplana
    por dentro. Los str se tratan como valores sueltos, porque iterar un str da más str de un carácter y nunca terminaría.
    @alternativas Un bucle con pila explícita (sin límite de recursión de 1000 niveles).
    @bigo n
    """
    resultado: list = []
    for elemento in a:
        if isinstance(elemento, (list, tuple)):
            resultado.extend(aplanar(elemento))
        else:
            resultado.append(elemento)
    return resultado


class Coleccion:
    """
    Envoltura fluida e inmutable sobre una lista o un dict.

    @complejidad Cada operación es O(n) en el tamaño de la colección (first y take pueden cortar antes); espacio O(n).
    @explicacion Cada método construye una Coleccion nueva a partir de los datos y nunca toca la lista interna, de ahí
    la inmutabilidad (all() devuelve una copia). `map` conserva las claves cuando es un dict; los demás métodos trabajan
    con los valores. `sort_by` usa `sorted`, que es estable, y `reverse=True` también conserva el orden de los empatados.
    @alternativas Una subclase de list: heredaría métodos mutables que rompen la inmutabilidad.
    @bigo n
    """

    def __init__(self, items=()):
        self._items = dict(items) if isinstance(items, dict) else list(items)

    @staticmethod
    def hacer(items=()) -> 'Coleccion':
        return Coleccion(items)

    def _valores(self) -> list:
        return list(self._items.values()) if isinstance(self._items, dict) else list(self._items)

    def all(self):
        return dict(self._items) if isinstance(self._items, dict) else list(self._items)

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self):
        return iter(self._valores())

    def map(self, f) -> 'Coleccion':
        if isinstance(self._items, dict):
            return Coleccion({k: f(v) for k, v in self._items.items()})
        return Coleccion([f(v) for v in self._items])

    def filter(self, f=None) -> 'Coleccion':
        return Coleccion([v for v in self._valores() if (f(v) if f else v)])

    def reduce(self, f, inicial=None):
        acc = inicial
        for v in self._valores():
            acc = f(acc, v)
        return acc

    def sum(self):
        return sum(self._valores())

    def avg(self) -> float:
        valores = self._valores()
        return sum(valores) / len(valores) if valores else 0.0

    def first(self, f=None, defecto=None):
        for v in self._valores():
            if f is None or f(v):
                return v
        return defecto

    def sort_by(self, clave, desc: bool = False) -> 'Coleccion':
        return Coleccion(sorted(self._valores(), key=clave, reverse=desc))

    def pluck(self, campo: str) -> 'Coleccion':
        return Coleccion([fila[campo] for fila in self._valores()])

    def group_by(self, f) -> 'Coleccion':
        return Coleccion(agrupar_por(self._valores(), f))

    def unique(self) -> 'Coleccion':
        vistos: list = []
        conjunto: set = set()
        for v in self._valores():
            clave = (type(v), v)              # (tipo, valor): 1 y '1' (y 1 y True) son distintos
            if clave not in conjunto:
                conjunto.add(clave)
                vistos.append(v)
        return Coleccion(vistos)

    def take(self, n: int) -> 'Coleccion':
        return Coleccion(self._valores()[:n])


def unicos(xs: list) -> list:
    """
    Quita repetidos conservando el orden.

    @complejidad Tiempo O(n); espacio O(n).
    @explicacion `dict.fromkeys(xs)` crea un dict cuyas claves son los elementos: una clave no se repite y el dict
    recuerda el orden de primera inserción. Cada inserción es O(1) gracias al hash.
    @alternativas Recorrer con `if x not in resultado`: O(n²) porque `in` sobre una lista es lineal. `list(set(xs))`: O(n) pero
    pierde el orden.
    @bigo n
    """
    return list(dict.fromkeys(xs))


def interseccion(a: list, b: list) -> list:
    """
    Intersección conservando el orden de a.

    @complejidad Tiempo O(n + m); espacio O(n + m).
    @explicacion Se pasa `b` a un set una vez (O(m)) para que cada pertenencia sea O(1), y se recorre `a` sin repetidos
    con dict.fromkeys (que conserva el orden).
    @alternativas `[x for x in a if x in b]` con `b` lista: O(n · m) y con repetidos. `set(a) & set(b)`: pierde el orden.
    @bigo n
    """
    en_b = set(b)
    return [x for x in dict.fromkeys(a) if x in en_b]


def transponer(m: list) -> list:
    """
    Transpone una matriz rectangular.

    @complejidad Tiempo O(f · c); espacio O(f · c).
    @explicacion `zip(*m)` empareja el primer elemento de cada fila, luego el segundo... que son justo las columnas.
    Con una matriz vacía, `zip()` no produce nada y el resultado es [] sin caso especial. Se convierte cada tupla en lista.
    @alternativas Dos bucles anidados con índices (más largos). `numpy`: `np.array(m).T` para matrices grandes.
    @bigo n
    """
    return [list(columna) for columna in zip(*m)]
