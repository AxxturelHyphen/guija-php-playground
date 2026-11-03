"""
SOLUCIONES · Tema 6 · Estructuras de datos
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (Nodo y NodoArbol, y los
auxiliares lista_desde / lista_a_lista, ya están en el ejemplo.)
"""


def parentesis_balanceados(texto: str) -> bool:
    """
    Paréntesis, corchetes y llaves con una pila.

    @complejidad Tiempo O(n); espacio O(n) en el peor caso (todo aperturas).
    @explicacion Cada apertura se apila; cada cierre debe encontrar en la cima su apertura correspondiente. Al final la
    pila debe quedar vacía (si no, sobran aperturas). Un cierre con la pila vacía es un fallo inmediato.
    @alternativas Reemplazar pares `()` repetidamente con `str.replace` es O(n²).
    @bigo n
    """
    pares = {')': '(', ']': '[', '}': '{'}
    pila = []
    for c in texto:
        if c in '([{':
            pila.append(c)
        elif c in pares:
            if not pila or pila.pop() != pares[c]:
                return False
    return not pila


class ColaConDosPilas:
    """
    Cola FIFO con dos pilas.

    @complejidad encolar O(1); desencolar y frente O(1) amortizado; espacio O(n).
    @explicacion `entrada` recibe los elementos; `salida` los entrega. Solo cuando `salida` está vacía se vuelca la
    entrada (invirtiendo el orden). Cada elemento se mueve una sola vez, de ahí el O(1) amortizado.
    @alternativas `collections.deque` (append / popleft), O(1) real.
    """

    def __init__(self) -> None:
        self._entrada = []
        self._salida = []

    def _volcar(self) -> None:
        if not self._salida:
            while self._entrada:
                self._salida.append(self._entrada.pop())

    def encolar(self, valor) -> None:
        self._entrada.append(valor)

    def desencolar(self):
        self._volcar()
        if not self._salida:
            raise IndexError('La cola está vacía')
        return self._salida.pop()

    def frente(self):
        self._volcar()
        if not self._salida:
            raise IndexError('La cola está vacía')
        return self._salida[-1]

    def tamano(self) -> int:
        return len(self._entrada) + len(self._salida)

    def vacia(self) -> bool:
        return self.tamano() == 0


def invertir_lista(cabeza):
    """
    Inversión de una lista enlazada.

    @complejidad Tiempo O(n); espacio O(1).
    @explicacion Se recorre guardando el `siguiente` antes de redirigir cada nodo hacia el anterior. Al terminar,
    `anterior` es la nueva cabeza. No se crean nodos.
    @alternativas Recursiva (O(n) de pila, límite de ~1000); volcar a una list, invertirla y reconstruir (O(n) de memoria).
    @bigo n
    """
    anterior = None
    actual = cabeza
    while actual is not None:
        siguiente = actual.siguiente
        actual.siguiente = anterior
        anterior = actual
        actual = siguiente
    return anterior


def tiene_ciclo(cabeza) -> bool:
    """
    Detección de ciclos de Floyd.

    @complejidad Tiempo O(n); espacio O(1).
    @explicacion La liebre avanza dos nodos por cada uno de la tortuga: si hay ciclo, la liebre acaba alcanzando a la tortuga
    dentro de él; si no, llega al final (`None`). Se compara con `is` (identidad), no con `==`.
    @alternativas Un `set` de ids de nodos vistos: O(n) de tiempo y de memoria.
    @bigo n
    """
    lenta = rapida = cabeza
    while rapida is not None and rapida.siguiente is not None:
        lenta = lenta.siguiente
        rapida = rapida.siguiente.siguiente
        if lenta is rapida:
            return True
    return False


class ArbolBinarioBusqueda:
    """
    ABB de enteros sin duplicados.

    @complejidad insertar, contiene y minimo O(altura) (O(log n) equilibrado, O(n) degenerado); en_orden, altura y tamano O(n).
    @explicacion Inserción y búsqueda iterativas (sin recursión, para no chocar con el límite de pila en un árbol
    degenerado). `en_orden` y `altura` recorren con una pila explícita por la misma razón.
    @alternativas Árboles autoequilibrados (AVL, rojo-negro) garantizan O(log n); `bisect` sobre una lista ordenada.
    """

    def __init__(self) -> None:
        self._raiz = None
        self._tamano = 0

    def insertar(self, valor: int) -> None:
        nuevo = NodoArbol(valor)
        if self._raiz is None:
            self._raiz = nuevo
            self._tamano = 1
            return
        nodo = self._raiz
        while True:
            if valor < nodo.valor:
                if nodo.izq is None:
                    nodo.izq = nuevo
                    break
                nodo = nodo.izq
            elif valor > nodo.valor:
                if nodo.der is None:
                    nodo.der = nuevo
                    break
                nodo = nodo.der
            else:
                return
        self._tamano += 1

    def contiene(self, valor: int) -> bool:
        nodo = self._raiz
        while nodo is not None:
            if valor == nodo.valor:
                return True
            nodo = nodo.izq if valor < nodo.valor else nodo.der
        return False

    def tamano(self) -> int:
        return self._tamano

    def en_orden(self) -> list:
        resultado = []
        pila = []
        nodo = self._raiz
        while nodo is not None or pila:
            while nodo is not None:
                pila.append(nodo)
                nodo = nodo.izq
            nodo = pila.pop()
            resultado.append(nodo.valor)
            nodo = nodo.der
        return resultado

    def altura(self) -> int:
        if self._raiz is None:
            return 0
        mayor = 0
        pila = [(self._raiz, 1)]
        while pila:
            nodo, nivel = pila.pop()
            mayor = max(mayor, nivel)
            if nodo.izq is not None:
                pila.append((nodo.izq, nivel + 1))
            if nodo.der is not None:
                pila.append((nodo.der, nivel + 1))
        return mayor

    def minimo(self):
        if self._raiz is None:
            return None
        nodo = self._raiz
        while nodo.izq is not None:
            nodo = nodo.izq
        return nodo.valor


class MinHeap:
    """
    Montículo de mínimos sobre una list.

    @complejidad insertar y extraer_minimo O(log n); minimo O(1); espacio O(n).
    @explicacion El padre de i es (i - 1) // 2 y sus hijos 2i+1 y 2i+2. Insertar: añadir al final y subir mientras sea menor que
    el padre. Extraer: llevar el último a la raíz y bajarlo intercambiándolo con el hijo menor.
    @alternativas `heapq` (en C, mismo coste); `heapify` construye un montículo en O(n).
    """

    def __init__(self) -> None:
        self._datos = []

    def insertar(self, valor: int) -> None:
        datos = self._datos
        datos.append(valor)
        i = len(datos) - 1
        while i > 0:
            padre = (i - 1) // 2
            if datos[padre] <= datos[i]:
                break
            datos[padre], datos[i] = datos[i], datos[padre]
            i = padre

    def extraer_minimo(self) -> int:
        datos = self._datos
        if not datos:
            raise IndexError('El montículo está vacío')
        raiz = datos[0]
        ultimo = datos.pop()
        if datos:
            datos[0] = ultimo
            i = 0
            n = len(datos)
            while True:
                menor = i
                for hijo in (2 * i + 1, 2 * i + 2):
                    if hijo < n and datos[hijo] < datos[menor]:
                        menor = hijo
                if menor == i:
                    break
                datos[i], datos[menor] = datos[menor], datos[i]
                i = menor
        return raiz

    def minimo(self) -> int:
        if not self._datos:
            raise IndexError('El montículo está vacío')
        return self._datos[0]

    def tamano(self) -> int:
        return len(self._datos)

    def vacio(self) -> bool:
        return not self._datos


def ordenar_con_monticulo(xs: list) -> list:
    """
    Heap sort sencillo.

    @complejidad Tiempo O(n log n); espacio O(n).
    @explicacion `heapify` convierte una copia en montículo en O(n) y cada `heappop` cuesta O(log n): n extracciones dan
    O(n log n). Se usa `heapq` (en C) para no depender de tu MinHeap.
    @alternativas El heap sort "de verdad" ordena en el sitio con O(1) de memoria extra; para ordenar sin más, `sorted()`.
    @bigo nlogn
    """
    from heapq import heapify, heappop
    monticulo = list(xs)
    heapify(monticulo)
    return [heappop(monticulo) for _ in range(len(monticulo))]


class CacheLRU:
    """
    Caché LRU en O(1).

    @complejidad obtener y poner O(1); espacio O(capacidad).
    @explicacion `OrderedDict` es una tabla hash con una lista doblemente enlazada por dentro: `move_to_end` refresca una
    clave y `popitem(last=False)` expulsa la más antigua, ambos en O(1). Es el `LinkedHashMap(accessOrder=true)` de Java.
    @alternativas Un dict normal (borrar y reinsertar pasa la clave al final; `next(iter(d))` es la más antigua);
    `functools.lru_cache` si lo que se cachea es el resultado de una función.
    @bigo 1
    """

    def __init__(self, capacidad: int) -> None:
        if capacidad < 1:
            raise ValueError(f'La capacidad debe ser al menos 1, no {capacidad}')
        self._capacidad = capacidad
        self._datos = OrderedDict()

    def obtener(self, clave: str):
        if clave not in self._datos:
            return None
        self._datos.move_to_end(clave)
        return self._datos[clave]

    def poner(self, clave: str, valor) -> None:
        self._datos[clave] = valor
        self._datos.move_to_end(clave)
        if len(self._datos) > self._capacidad:
            self._datos.popitem(last=False)

    def claves(self) -> list:
        return list(reversed(self._datos))

    def tamano(self) -> int:
        return len(self._datos)


def top_k(xs: list, k: int) -> list:
    """
    Los k mayores con un montículo de tamaño k.

    @complejidad Tiempo O(n log k); espacio O(k).
    @explicacion El montículo de MÍNIMOS guarda los k mayores vistos y su raíz es el umbral que hay que superar. Un valor
    nuevo solo entra si lo supera (y expulsa al mínimo con `heapreplace`); cada entrada cuesta O(log k). Ordenar todo
    costaría O(n log n) y O(n) de memoria.
    @alternativas `heapq.nlargest(k, xs)` (hace esto mismo); `sorted(xs, reverse=True)[:k]`; QuickSelect en O(n) medio.
    @bigo n
    """
    from heapq import heappush, heapreplace
    if k <= 0:
        return []
    monticulo = []
    for x in xs:
        if len(monticulo) < k:
            heappush(monticulo, x)
        elif x > monticulo[0]:
            heapreplace(monticulo, x)
    return sorted(monticulo, reverse=True)
