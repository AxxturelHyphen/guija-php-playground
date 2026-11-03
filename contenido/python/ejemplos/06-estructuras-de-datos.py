"""
TEMA 6 · ESTRUCTURAS DE DATOS
─────────────────────────────────────────────────────────────────
Elegir la estructura adecuada suele importar más que optimizar el código. Python trae casi todo en la librería
estándar:

  Java                         Python                          Coste típico
  ArrayList / array            list                            acceso O(1), añadir al final O(1)
  Stack                        list (append / pop)             push, pop, top: O(1)
  Queue / ArrayDeque           collections.deque               append, popleft: O(1)
  LinkedList                   collections.deque               insertar en extremos O(1)
  PriorityQueue                heapq (sobre una list)          heappush, heappop: O(log n)
  int[] (tamaño fijo)          array.array / numpy             acceso O(1), menos memoria
  HashSet / HashMap            set / dict                      `in`, insertar: O(1)
  IdentityHashMap              dict con objetos / weakref      claves que son OBJETOS

Recuerda: `lista.pop(0)` y `lista.insert(0, x)` son O(n) porque desplazan todo. Para colas usa deque.
"""
import json
import weakref
from collections import OrderedDict, deque
from heapq import heapify, heappop, heappush


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


def ver(valor) -> str:
    return json.dumps(valor, ensure_ascii=False)


# ═════════════════════════════════════════════════════════════════
# 1. PILA (LIFO): EL ÚLTIMO EN ENTRAR ES EL PRIMERO EN SALIR
# ═════════════════════════════════════════════════════════════════
# Usos: deshacer/rehacer, recorrido en profundidad, evaluar expresiones, comprobar paréntesis.
titulo('1. Pila')

pila = []                                     # una list ya es una pila: append = push, pop = pop, pila[-1] = top
for letra in 'abc':
    pila.append(letra)                        # O(1) amortizado
print('top:', pila[-1], '· tamaño:', len(pila))
print('sacando: ', end='')
while pila:                                   # una lista vacía es "falsa"
    print(pila.pop(), end=' ')                # O(1); pop() en una lista vacía lanza IndexError
print()
# Trampa: pila.pop(0) sería O(n) (desplaza todo): eso ya no es una pila, es una cola mal hecha.

# ═════════════════════════════════════════════════════════════════
# 2. COLA (FIFO): EL PRIMERO EN ENTRAR ES EL PRIMERO EN SALIR
# ═════════════════════════════════════════════════════════════════
# Usos: tareas pendientes, recorrido en anchura, buffers. deque (cola de dos extremos) añade y quita por ambos lados
# en O(1); su punto débil es el acceso por el medio: deque[i] es O(n) en el centro.
titulo('2. Cola')

cola = deque()
for tarea in ('t1', 't2', 't3'):
    cola.append(tarea)
print('atendiendo: ', end='')
while cola:
    print(cola.popleft(), end=' ')            # O(1). Con una list sería lista.pop(0): O(n)
print()
recientes = deque(maxlen=3)                   # con maxlen es un buffer circular: al llenarse descarta por el otro extremo
for i in range(1, 6):
    recientes.append(i)
print('últimos 3 de 1..5:', list(recientes))

# ═════════════════════════════════════════════════════════════════
# 3. MONTÍCULO (HEAP) Y COLA DE PRIORIDAD
# ═════════════════════════════════════════════════════════════════
# Un montículo mantiene "el menor (o mayor) a mano": mirar el mínimo es O(1) y insertar/extraer, O(log n).
# Se guarda en un array con una regla: los hijos del nodo i son 2i+1 y 2i+2, y un padre nunca es mayor que sus hijos.
# heapq opera sobre una list normal y es SIEMPRE de mínimos: heap[0] es el menor. heapify(lista) la convierte en O(n).
titulo('3. Montículo y cola de prioridad')

minimos = []
for n in (5, 3, 8, 1, 9, 2):
    heappush(minimos, n)
print('extrayendo el menor cada vez: ', end='')
while minimos:
    print(heappop(minimos), end=' ')
print()

# Max-heap: heapq no lo trae; se guardan los valores con el signo cambiado.
maximos = []
for n in (5, 3, 8, 1):
    heappush(maximos, -n)
print('extrayendo el mayor cada vez:', [-heappop(maximos) for _ in range(len(maximos))])

# Cola de prioridad: tuplas (prioridad, orden, tarea). Se comparan elemento a elemento, así que el contador de
# desempate evita comparar las tareas (que pueden no ser comparables) y hace el orden estable. Prioridad menor = antes.
tareas = []
for orden, (prioridad, nombre) in enumerate([(2, 'escribir informe'), (10, 'apagar incendio'), (1, 'tomar café')]):
    heappush(tareas, (-prioridad, orden, nombre))     # negamos para que salga primero la de MAYOR prioridad
print('por prioridad: ', end='')
while tareas:
    print(heappop(tareas)[2], end=' | ')
print()
# Trampa: heap[1] o sorted(heap) NO están ordenados; solo se garantiza heap[0]. Y `lista = [..]` no es un heap hasta heapify.
desordenada = [5, 3, 8, 1]
heapify(desordenada)
print('tras heapify, solo el primero es el menor:', desordenada)

# ═════════════════════════════════════════════════════════════════
# 4. LISTA ENLAZADA: LO QUE PASA "POR DENTRO" EN LinkedList
# ═════════════════════════════════════════════════════════════════
# Cada nodo guarda un valor y la referencia al siguiente. Insertar/borrar al principio es O(1) (solo cambian
# referencias) pero acceder a la posición k es O(k). En Python rara vez la necesitas (list y deque son más rápidas casi
# siempre), pero es el ejemplo clásico para practicar referencias: lo harás en los ejercicios.
titulo('4. Nodos enlazados')


class Nodo:
    __slots__ = ('valor', 'siguiente')       # sin __dict__ por objeto: ahorra memoria cuando hay millones de nodos

    def __init__(self, valor, siguiente=None) -> None:
        self.valor = valor
        self.siguiente = siguiente


def lista_desde(valores: list):
    """Construye la lista 1 → 2 → 3 desde una list."""
    cabeza = None
    for v in reversed(valores):
        cabeza = Nodo(v, cabeza)             # cada nodo nuevo apunta al anterior ya construido
    return cabeza


def lista_a_lista(cabeza, limite: int = 1000) -> list:
    """Recorre la lista y devuelve sus valores (con un tope por si hay un ciclo)."""
    valores = []
    n = cabeza
    while n is not None and len(valores) < limite:
        valores.append(n.valor)
        n = n.siguiente
    return valores


lista = lista_desde([1, 2, 3])
print('lista:', ' → '.join(map(str, lista_a_lista(lista))))
# Las variables guardan referencias a objetos: modificar n.siguiente cambia la lista de verdad. Y `is None`, no `== None`.

# ═════════════════════════════════════════════════════════════════
# 5. ÁRBOL BINARIO DE BÚSQUEDA (ABB)
# ═════════════════════════════════════════════════════════════════
# En cada nodo: todo lo de la izquierda es menor y todo lo de la derecha, mayor. Buscar, insertar y
# borrar cuestan O(altura): O(log n) si está equilibrado, O(n) si degenera en una "lista" (datos ordenados).
# El recorrido en orden (izquierda, nodo, derecha) devuelve los valores ORDENADOS.
titulo('5. Árbol binario de búsqueda')


class NodoArbol:
    __slots__ = ('valor', 'izq', 'der')

    def __init__(self, valor: int) -> None:
        self.valor = valor
        self.izq = None
        self.der = None


def insertar_en(nodo, valor: int) -> NodoArbol:
    if nodo is None:
        return NodoArbol(valor)
    if valor < nodo.valor:
        nodo.izq = insertar_en(nodo.izq, valor)
    elif valor > nodo.valor:
        nodo.der = insertar_en(nodo.der, valor)
    return nodo                              # si es igual no se inserta (sin duplicados)


def en_orden_de(nodo) -> list:
    return [] if nodo is None else [*en_orden_de(nodo.izq), nodo.valor, *en_orden_de(nodo.der)]


raiz = None
for v in (50, 30, 70, 20, 40, 60, 80):
    raiz = insertar_en(raiz, v)
print('en orden:', ver(en_orden_de(raiz)))

# ═════════════════════════════════════════════════════════════════
# 6. OBJETOS COMO CLAVES
# ═════════════════════════════════════════════════════════════════
# Un dict o un set admiten cualquier objeto HASHABLE como clave. Por defecto un objeto se compara y se hashea por
# IDENTIDAD (es él mismo). Si defines __eq__, Python quita __hash__ (el objeto deja de ser hashable) hasta que
# definas también __hash__ coherente: dos objetos iguales DEBEN dar el mismo hash. Las claves no deben mutar.
titulo('6. Objetos como claves')


class Punto:
    def __init__(self, x: int, y: int) -> None:
        self.x, self.y = x, y


class PuntoValor:
    def __init__(self, x: int, y: int) -> None:
        self.x, self.y = x, y

    def __eq__(self, otro) -> bool:
        return isinstance(otro, PuntoValor) and (self.x, self.y) == (otro.x, otro.y)

    def __hash__(self) -> int:
        return hash((self.x, self.y))         # el mismo contenido → el mismo hash


a, b = Punto(1, 2), Punto(1, 2)
vistos = {a}
print('por identidad: ¿a visto?', a in vistos, '· ¿b (mismo contenido) visto?', b in vistos)
valores = {PuntoValor(1, 2)}
print('por valor:     ¿(1,2) visto?', PuntoValor(1, 2) in valores)

# weakref.WeakKeyDictionary: la entrada desaparece sola cuando nadie más referencia al objeto-clave. Sirve para
# cachés o metadatos asociados a objetos sin impedir que se liberen. (Las clases con __slots__ sin '__weakref__'
# no admiten referencias débiles.)
metadatos = weakref.WeakKeyDictionary()
objeto = Punto(0, 0)
metadatos[objeto] = 'datos extra'
print('entradas con el objeto vivo:', len(metadatos))
del objeto                                    # en CPython se libera al instante (contador de referencias)
print('entradas tras borrarlo:', len(metadatos))

# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · parentesis_balanceados (pila) ─────────────────────────────
def parentesis_balanceados(texto: str) -> bool:
    """
    ¿Están bien emparejados y anidados los paréntesis ( ), corchetes [ ] y llaves { } del texto?
    Los demás caracteres se ignoran. Usa una pila (una list): cada cierre debe coincidir con la última apertura sin cerrar.
        "a(b[c]{d})e" → True    "(]" → False    "([)]" → False    "((" → False    "" → True
    """
    pendiente()


# ── Ejercicio 2 · ColaConDosPilas ───────────────────────────────────────────
class ColaConDosPilas:
    """
    Una cola FIFO construida SOLO con dos pilas (list con append/pop): una para entrar y otra para salir. Cuando
    la de salida se vacía, se le pasa todo lo de la de entrada (que invierte el orden). Cada elemento cambia de pila
    una sola vez, así que desencolar es O(1) AMORTIZADO. No uses deque ni pop(0).
     - desencolar() y frente() en una cola vacía lanzan IndexError.
    """

    def __init__(self) -> None:
        pendiente()

    def encolar(self, valor) -> None:
        pendiente()

    def desencolar(self):
        pendiente()

    def frente(self):
        pendiente()

    def tamano(self) -> int:
        pendiente()

    def vacia(self) -> bool:
        pendiente()


# ── Ejercicio 3 · Lista enlazada: invertir y detectar ciclos ────────────────
def invertir_lista(cabeza):
    """
    Invierte la lista cambiando las referencias `siguiente` (sin crear nodos nuevos) y devuelve la nueva cabeza.
    O(n) de tiempo y O(1) de memoria. Lista vacía → None.   1 → 2 → 3   pasa a   3 → 2 → 1
    """
    pendiente()


def tiene_ciclo(cabeza) -> bool:
    """
    ¿La lista tiene un ciclo (algún nodo vuelve a apuntar a uno anterior)? Con el algoritmo de la tortuga y la liebre
    de Floyd (dos referencias: una avanza de 1 en 1 y otra de 2 en 2; si hay ciclo acaban coincidiendo): O(n) de
    tiempo y O(1) de memoria. (Con un set de nodos vistos sería O(n) de memoria.) Compara con `is`.
    """
    pendiente()


# ── Ejercicio 4 · ArbolBinarioBusqueda ──────────────────────────────────────
class ArbolBinarioBusqueda:
    """
    Un ABB de enteros SIN duplicados (insertar un valor que ya está no hace nada), usando NodoArbol.
     - insertar(v), contiene(v) -> bool, tamano() -> int.
     - en_orden(): lista de valores ordenados de menor a mayor.
     - altura(): niveles del árbol (vacío = 0, un solo nodo = 1).
     - minimo(): el menor valor, o None si está vacío.
    Con datos ya ordenados el árbol degenera en una lista: evita la recursión en insertar (límite de ~1000 marcos).
    """

    def insertar(self, valor: int) -> None:
        pendiente()

    def contiene(self, valor: int) -> bool:
        pendiente()

    def tamano(self) -> int:
        pendiente()

    def en_orden(self) -> list:
        pendiente()

    def altura(self) -> int:
        pendiente()

    def minimo(self):
        pendiente()


# ── Ejercicio 5 · MinHeap (montículo mínimo propio) ─────────────────────────
class MinHeap:
    """
    Un montículo de mínimos de enteros guardado en una list (sin usar heapq):
     - insertar(v): añádelo al final y "súbelo" mientras sea menor que su padre ((i - 1) // 2). O(log n).
     - extraer_minimo(): quita la raíz, pon el último elemento en su lugar y "bájalo" intercambiándolo con el
       hijo menor mientras haga falta (hijos: 2i+1 y 2i+2). O(log n).
     - minimo() mira la raíz sin quitarla (O(1)). Ambos, en un montículo vacío, lanzan IndexError.
    """

    def __init__(self) -> None:
        pendiente()

    def insertar(self, valor: int) -> None:
        pendiente()

    def extraer_minimo(self) -> int:
        pendiente()

    def minimo(self) -> int:
        pendiente()

    def tamano(self) -> int:
        pendiente()

    def vacio(self) -> bool:
        pendiente()


def ordenar_con_monticulo(xs: list) -> list:
    """
    Heap sort sencillo: mete todos los elementos en un montículo y sácalos uno a uno. O(n log n).
    Puedes usar heapq (o tu MinHeap). No modifiques la lista original.
    """
    pendiente()


# ── Ejercicio 6 · CacheLRU ──────────────────────────────────────────────────
class CacheLRU:
    """
    Caché "Least Recently Used": guarda como mucho `capacidad` entradas y, al pasarse, expulsa la que lleva más tiempo
    sin usarse. Tanto obtener() como poner() cuentan como "uso".
     - obtener(clave): el valor, o None si no está (y la marca como la más reciente).
     - poner(clave, valor): inserta o actualiza (también la marca como la más reciente) y expulsa si hace falta.
     - claves(): las claves de la MÁS reciente a la MÁS antigua. tamano(): cuántas hay.
     - capacidad menor que 1 → ValueError.
    Todo O(1). Pista: OrderedDict.move_to_end(clave) y popitem(last=False) (o un dict normal: borrar y reinsertar una
    clave la pasa al final, y next(iter(d)) es la más antigua). ¡No recorras la caché para buscar la más antigua!
    """

    def __init__(self, capacidad: int) -> None:
        pendiente()

    def obtener(self, clave: str):
        pendiente()

    def poner(self, clave: str, valor) -> None:
        pendiente()

    def claves(self) -> list:
        pendiente()

    def tamano(self) -> int:
        pendiente()


# ── Ejercicio 7 · top_k con un montículo ────────────────────────────────────
def top_k(xs: list, k: int) -> list:
    """
    Los `k` valores MAYORES de la lista, de mayor a menor, sin ordenar toda la lista: mantén un montículo de mínimos
    (heapq) de tamaño máximo k (si entra uno más grande que el mínimo, saca el mínimo). O(n log k) y memoria O(k).
        top_k([5, 1, 9, 3, 7], 2)  →  [9, 7]       k = 0 → []       k mayor que la lista → toda, ordenada desc.
    (heapq.nlargest hace justo esto, pero aquí se pide escribirlo.)
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS
# ═════════════════════════════════════════════════════════════════

prueba('parentesis_balanceados', {
    'vacío': (('',), True),
    'simple': (('()',), True),
    'mezclados': (('([]{})',), True),
    'con texto': (('a(b[c]{d})e',), True),
    'cierre incorrecto': (('(]',), False),
    'cruzados': (('([)]',), False),
    'sin cerrar': (('((',), False),
    'cierre de más': (('())',), False),
    'empieza cerrando': ((')(',), False),
    'solo texto': (('hola',), True),
    'profundo': (('(' * 500 + ')' * 500,), True),
})

grupo('ColaConDosPilas')


def _cola_orden() -> list:
    c = ColaConDosPilas()
    for x in (1, 2, 3):
        c.encolar(x)
    return [c.desencolar(), c.desencolar(), c.desencolar()]


def _cola_intercalada() -> list:
    c = ColaConDosPilas()
    c.encolar('a')
    c.encolar('b')
    salida = [c.desencolar()]
    c.encolar('c')
    salida.append(c.desencolar())
    salida.append(c.desencolar())
    return salida


def _cola_frente() -> list:
    c = ColaConDosPilas()
    c.encolar(5)
    c.encolar(6)
    return [c.frente(), c.frente(), c.tamano()]


def _cola_vacia() -> list:
    c = ColaConDosPilas()
    antes = [c.vacia(), c.tamano()]
    c.encolar(1)
    c.desencolar()
    return [*antes, c.vacia(), c.tamano()]


def _cola_tipos() -> list:
    c = ColaConDosPilas()
    c.encolar(None)
    c.encolar([1])
    return [c.desencolar(), c.desencolar()]


def _cola_oraculo() -> bool:
    c = ColaConDosPilas()
    real = deque()                            # el oráculo: una cola de verdad
    x = 7
    for i in range(2000):
        x = (x * 1103515245 + 12345) & 0x7fffffff
        if x % 3 != 0 or not real:
            c.encolar(i)
            real.append(i)
        elif c.desencolar() != real.popleft():
            return False
    return c.tamano() == len(real)


comprueba('sale en el orden en que entra', _cola_orden, [1, 2, 3])
comprueba('entradas y salidas intercaladas', _cola_intercalada, ['a', 'b', 'c'])
comprueba('frente no la quita', _cola_frente, [5, 5, 2])
comprueba('vacia y tamano', _cola_vacia, [True, 0, True, 0])
comprueba('admite cualquier tipo de valor', _cola_tipos, [None, [1]])
comprueba('mismo resultado que una cola de verdad (2000 operaciones)', _cola_oraculo, True)
lanza('desencolar en vacía', lambda: ColaConDosPilas().desencolar(), IndexError)
lanza('frente en vacía', lambda: ColaConDosPilas().frente(), IndexError)

grupo('invertir_lista')


def _invertir_no_crea() -> bool:
    cabeza = lista_desde([1, 2, 3])
    cola_ = cabeza.siguiente.siguiente
    return invertir_lista(cabeza) is cola_


comprueba('invierte', lambda: lista_a_lista(invertir_lista(lista_desde([1, 2, 3, 4]))), [4, 3, 2, 1])
comprueba('un nodo', lambda: lista_a_lista(invertir_lista(lista_desde([9]))), [9])
comprueba('lista vacía', lambda: invertir_lista(None), None)
comprueba('no crea nodos nuevos', _invertir_no_crea, True)
comprueba('invertir dos veces devuelve la original',
          lambda: lista_a_lista(invertir_lista(invertir_lista(lista_desde(list(range(1, 51)))))), list(range(1, 51)))

grupo('tiene_ciclo')


def _ciclo_al_segundo() -> bool:
    cabeza = lista_desde([1, 2, 3, 4])
    cabeza.siguiente.siguiente.siguiente.siguiente = cabeza.siguiente
    return tiene_ciclo(cabeza)


def _ciclo_propio() -> bool:
    n = Nodo(1)
    n.siguiente = n
    return tiene_ciclo(n)


comprueba('lista normal', lambda: tiene_ciclo(lista_desde([1, 2, 3, 4, 5])), False)
comprueba('lista vacía', lambda: tiene_ciclo(None), False)
comprueba('un nodo', lambda: tiene_ciclo(lista_desde([1])), False)
comprueba('el último apunta al segundo', _ciclo_al_segundo, True)
comprueba('un nodo que se apunta a sí mismo', _ciclo_propio, True)
comprueba('lista larga sin ciclo', lambda: tiene_ciclo(lista_desde(list(range(1, 5001)))), False)

grupo('ArbolBinarioBusqueda')


def _abb(valores) -> ArbolBinarioBusqueda:
    a = ArbolBinarioBusqueda()
    for v in valores:
        a.insertar(v)
    return a


comprueba('en_orden devuelve los valores ordenados', lambda: _abb([50, 30, 70, 20, 40, 60, 80]).en_orden(),
          [20, 30, 40, 50, 60, 70, 80])
comprueba('contiene', lambda: (lambda a: [a.contiene(3), a.contiene(8), a.contiene(4)])(_abb([5, 3, 8])),
          [True, True, False])
comprueba('no admite duplicados', lambda: (lambda a: [a.tamano(), a.en_orden()])(_abb([5, 5, 5, 3, 3])), [2, [3, 5]])
comprueba('altura de un árbol equilibrado', lambda: _abb([4, 2, 6, 1, 3, 5, 7]).altura(), 3)
comprueba('altura si se insertan ordenados (degenera en lista)', lambda: _abb(range(1, 11)).altura(), 10)
comprueba('árbol vacío', lambda: (lambda a: [a.altura(), a.minimo(), a.en_orden(), a.tamano(), a.contiene(1)])(_abb([])),
          [0, None, [], 0, False])
comprueba('mínimo', lambda: _abb([8, 3, 10, 1, 6]).minimo(), 1)
comprueba('un nodo tiene altura 1', lambda: _abb([1]).altura(), 1)
comprueba('2000 valores ordenados no desbordan la pila', lambda: _abb(range(2000)).tamano(), 2000)

grupo('MinHeap')


def _heap_orden() -> list:
    h = MinHeap()
    for v in (5, 3, 8, 1, 9, 2):
        h.insertar(v)
    salida = []
    while not h.vacio():
        salida.append(h.extraer_minimo())
    return salida


def _heap_minimo() -> list:
    h = MinHeap()
    h.insertar(4)
    h.insertar(2)
    return [h.minimo(), h.minimo(), h.tamano()]


def _heap_repetidos() -> list:
    h = MinHeap()
    for v in (2, 2, 1, 1):
        h.insertar(v)
    return [h.extraer_minimo() for _ in range(4)]


def _heap_oraculo() -> bool:
    h = MinHeap()
    real = []                                 # el oráculo: heapq
    x = 99
    for _ in range(1500):
        x = (x * 1103515245 + 12345) & 0x7fffffff
        if x % 4 != 0 or not real:
            v = x % 1000
            h.insertar(v)
            heappush(real, v)
        elif h.extraer_minimo() != heappop(real):
            return False
    return h.tamano() == len(real) and (not real or h.minimo() == real[0])


comprueba('extrae en orden ascendente', _heap_orden, [1, 2, 3, 5, 8, 9])
comprueba('minimo no extrae', _heap_minimo, [2, 2, 2])
comprueba('con repetidos', _heap_repetidos, [1, 1, 2, 2])
comprueba('operaciones mezcladas igual que heapq (1500 ops)', _heap_oraculo, True)
lanza('extraer de uno vacío', lambda: MinHeap().extraer_minimo(), IndexError)
lanza('minimo de uno vacío', lambda: MinHeap().minimo(), IndexError)

prueba('ordenar_con_monticulo', {
    'desordenada': (([5, 2, 9, 1, 5, 6],), [1, 2, 5, 5, 6, 9]),
    'vacía': (([],), []),
    'un elemento': (([3],), [3]),
    'negativos': (([0, -3, 2, -1],), [-3, -1, 0, 2]),
    'inversa': ((list(range(10, 0, -1)),), list(range(1, 11))),
})
comprueba('no modifica la original', lambda: (lambda xs: (ordenar_con_monticulo(xs), xs)[1])([3, 1, 2]), [3, 1, 2])

grupo('CacheLRU')


def _lru_guarda() -> list:
    c = CacheLRU(2)
    c.poner('a', 1)
    return [c.obtener('a'), c.obtener('zzz')]


def _lru_expulsa() -> list:
    c = CacheLRU(2)
    c.poner('a', 1)
    c.poner('b', 2)
    c.poner('c', 3)                           # expulsa a
    return [c.obtener('a'), c.obtener('b'), c.obtener('c')]


def _lru_obtener_es_uso() -> list:
    c = CacheLRU(2)
    c.poner('a', 1)
    c.poner('b', 2)
    c.obtener('a')                            # ahora la más antigua es b
    c.poner('c', 3)                           # expulsa b
    return [c.obtener('a'), c.obtener('b')]


def _lru_actualizar() -> list:
    c = CacheLRU(2)
    c.poner('a', 1)
    c.poner('b', 2)
    c.poner('a', 10)                          # actualiza y refresca a
    c.poner('c', 3)                           # expulsa b
    return [c.obtener('a'), c.obtener('b'), c.claves()]


def _lru_claves() -> list:
    c = CacheLRU(3)
    c.poner('a', 1)
    c.poner('b', 2)
    c.poner('c', 3)
    c.obtener('a')
    return c.claves()


def _lru_capacidad_1() -> list:
    c = CacheLRU(1)
    c.poner('a', 1)
    c.poner('b', 2)
    return [c.obtener('a'), c.obtener('b'), c.tamano()]


def _lru_tamano() -> list:
    c = CacheLRU(3)
    for i in range(10):
        c.poner(f'k{i}', i)
    return [c.tamano(), c.claves()]


def _lru_referencia() -> str:
    lru = CacheLRU(5)
    orden = []                                # claves de menos a más reciente
    datos = {}
    x = 5
    for i in range(3000):
        x = (x * 1103515245 + 12345) & 0x7fffffff
        clave = f'k{x % 9}'
        if x % 2 == 0:
            esperado = datos.get(clave)
            if clave in datos:
                orden = [k for k in orden if k != clave] + [clave]
            if lru.obtener(clave) != esperado:
                return f'obtener({clave}) falló en la operación {i}'
        else:
            lru.poner(clave, i)
            datos[clave] = i
            orden = [k for k in orden if k != clave] + [clave]
            if len(orden) > 5:
                del datos[orden.pop(0)]
    return 'ok' if lru.claves() == orden[::-1] else 'claves distintas'


comprueba('guarda y devuelve', _lru_guarda, [1, None])
comprueba('expulsa la menos reciente', _lru_expulsa, [None, 2, 3])
comprueba('obtener cuenta como uso', _lru_obtener_es_uso, [1, None])
comprueba('actualizar también cuenta como uso', _lru_actualizar, [10, None, ['a', 'c']])
comprueba('claves de la más reciente a la más antigua', _lru_claves, ['a', 'c', 'b'])
comprueba('capacidad 1', _lru_capacidad_1, [None, 2, 1])
comprueba('tamano nunca supera la capacidad', _lru_tamano, [3, ['k9', 'k8', 'k7']])
comprueba('igual que una versión lenta de referencia (3000 operaciones)', _lru_referencia, 'ok')
lanza('capacidad cero', lambda: CacheLRU(0), ValueError)

prueba('top_k', {
    'básico': (([5, 1, 9, 3, 7], 2), [9, 7]),
    'k = 0': (([1, 2, 3], 0), []),
    'k mayor que la lista': (([2, 9, 4], 10), [9, 4, 2]),
    'con repetidos': (([4, 4, 4, 1], 2), [4, 4]),
    'negativos': (([-5, -1, -3], 2), [-1, -3]),
    'vacía': (([], 3), []),
    'k = 1': (([3, 8, 1], 1), [8]),
})

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
def aleatorios_lista(n: int) -> list:
    resultado = []
    x = 12345
    for _ in range(n):
        x = (x * 1103515245 + 12345) & 0x7fffffff
        resultado.append(x % 1_000_000)
    return resultado


def cache_llena(n: int) -> CacheLRU:
    c = CacheLRU(n)
    for i in range(n):
        c.poner(f'k{i}', i)
    return c


medir('parentesis_balanceados', lambda n: ('([{' * (n // 3) + '}])' * (n // 3),))
medir('ordenar_con_monticulo', lambda n: (aleatorios_lista(n),))          # O(n log n)
medir('top_k', lambda n: (aleatorios_lista(n), 10))                         # O(n log k) con k = 10: ~O(n)
# obtener() en una caché con n entradas: O(1) si no recorres nada; O(n) si buscas la clave a mano.
medir(lambda c, clave: c.obtener(clave), lambda n: (cache_llena(n), f'k{n - 1}'), etiqueta='CacheLRU')
