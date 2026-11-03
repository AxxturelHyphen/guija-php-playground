"""
SOLUCIONES · Tema 7 · Grafos y programación dinámica
Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio. (Los imports y `levenshtein` ya están
en el ejemplo.)
"""


def construir_grafo(aristas: list, dirigido: bool = False) -> dict:
    """
    Lista de adyacencia desde una lista de aristas.

    @complejidad Tiempo O(E); espacio O(V + E).
    @explicacion `setdefault` crea la lista del nodo la primera vez que aparece, y así se conserva el orden de
    aparición (los dicts recuerdan el orden de inserción). En el caso dirigido el destino se registra igualmente.
    @alternativas `defaultdict(list)` y convertir al final con `dict()`; aquí se evita para devolver un dict normal.
    """
    grafo = {}
    for origen, destino in aristas:
        grafo.setdefault(origen, []).append(destino)
        if dirigido:
            grafo.setdefault(destino, [])
        else:
            grafo.setdefault(destino, []).append(origen)
    return grafo


def bfs_camino_mas_corto(grafo: dict, origen: str, destino: str):
    """
    Camino con menos aristas con BFS.

    @complejidad Tiempo O(V + E); espacio O(V).
    @explicacion BFS visita por capas, así que la primera vez que se llega al destino es por un camino mínimo.
    `padre` hace de conjunto de visitados y permite reconstruir el camino hacia atrás.
    @alternativas DFS no garantiza el camino más corto; enumerar todos los caminos es exponencial.
    """
    if origen not in grafo:
        return None
    padre = {origen: None}
    cola = deque([origen])
    while cola:
        nodo = cola.popleft()
        if nodo == destino:
            camino = []
            while nodo is not None:
                camino.append(nodo)
                nodo = padre[nodo]
            return camino[::-1]
        for vecino in grafo.get(nodo, []):
            if vecino not in padre:
                padre[vecino] = nodo
                cola.append(vecino)
    return None


def contar_islas(mapa: list) -> int:
    """
    Cuenta componentes conexas de '1' con una pila explícita.

    @complejidad Tiempo O(f·c); espacio O(f·c).
    @explicacion Cada celda de tierra se visita una vez: al encontrar una sin visitar se cuenta una isla y se
    hunde con DFS iterativo. La pila explícita evita el RecursionError de Python en islas grandes.
    @alternativas DFS recursivo (se desborda a ~1000 niveles); BFS con deque, igual de válido.
    @bigo n
    """
    visitado = set()
    islas = 0
    for f0, fila in enumerate(mapa):
        for c0, celda in enumerate(fila):
            if celda != '1' or (f0, c0) in visitado:
                continue
            islas += 1
            visitado.add((f0, c0))
            pila = [(f0, c0)]
            while pila:
                f, c = pila.pop()
                for nf, nc in ((f + 1, c), (f - 1, c), (f, c + 1), (f, c - 1)):
                    if (0 <= nf < len(mapa) and 0 <= nc < len(mapa[nf])
                            and mapa[nf][nc] == '1' and (nf, nc) not in visitado):
                        visitado.add((nf, nc))
                        pila.append((nf, nc))
    return islas


def orden_topologico(dependencias: dict) -> list:
    """
    Algoritmo de Kahn.

    @complejidad Tiempo O(V + E); espacio O(V + E).
    @explicacion `pendientes[t]` cuenta las dependencias sin cumplir de t; `dependientes[d]` lista quién espera
    a d. Se sacan las tareas con 0 pendientes y se descuenta a sus dependientes. Si no salen todas, hay un ciclo.
    @alternativas DFS con tres colores; `graphlib.TopologicalSorter` de la librería estándar hace lo mismo.
    """
    pendientes = {}
    dependientes = {}
    for tarea, deps in dependencias.items():
        pendientes.setdefault(tarea, 0)
        for d in deps:
            pendientes.setdefault(d, 0)
            pendientes[tarea] += 1
            dependientes.setdefault(d, []).append(tarea)
    cola = deque(t for t, n in pendientes.items() if n == 0)
    orden = []
    while cola:
        tarea = cola.popleft()
        orden.append(tarea)
        for sig in dependientes.get(tarea, []):
            pendientes[sig] -= 1
            if pendientes[sig] == 0:
                cola.append(sig)
    if len(orden) != len(pendientes):
        raise RuntimeError('Hay un ciclo de dependencias')
    return orden


def dijkstra(grafo: dict, origen: str) -> dict:
    """
    Caminos mínimos con montículo.

    @complejidad Tiempo O((V + E) log V); espacio O(V + E).
    @explicacion `heapq` saca siempre la menor distancia; al fijar un nodo se relajan sus aristas. Como heapq no
    puede actualizar prioridades, se añaden entradas nuevas y se saltan las viejas al sacarlas.
    @alternativas Bellman-Ford admite pesos negativos pero cuesta O(V·E); sin montículo, Dijkstra es O(V²).
    @bigo nlogn
    """
    for destinos in grafo.values():
        if any(peso < 0 for peso in destinos.values()):
            raise ValueError('Dijkstra no admite pesos negativos')
    dist = {origen: 0}
    monticulo = [(0, origen)]
    while monticulo:
        d, nodo = heapq.heappop(monticulo)
        if d > dist.get(nodo, float('inf')):
            continue
        for vecino, peso in grafo.get(nodo, {}).items():
            nueva = d + peso
            if nueva < dist.get(vecino, float('inf')):
                dist[vecino] = nueva
                heapq.heappush(monticulo, (nueva, vecino))
    return dict(sorted(dist.items()))


def escaleras(n: int) -> int:
    """
    Formas de subir n peldaños con pasos de 1 o 2.

    @complejidad Tiempo O(n); espacio O(1).
    @explicacion Es Fibonacci: pasos(n) = pasos(n-1) + pasos(n-2). Solo hacen falta las dos últimas celdas.
    @alternativas Recursión con @cache (O(n) de espacio y límite de recursión); recursión ingenua O(2^n).
    @bigo n
    """
    if n < 0:
        raise ValueError('n no puede ser negativo')
    anterior, actual = 1, 1
    for _ in range(n - 1):
        anterior, actual = actual, anterior + actual
    return actual


def cambio_monedas(monedas: list, objetivo: int) -> int:
    """
    Mínimo de monedas con una tabla.

    @complejidad Tiempo O(objetivo · monedas); espacio O(objetivo).
    @explicacion `minimo[c]` = menos monedas para sumar c, con infinito si no se puede. Cada celda mira
    `minimo[c - moneda]` para cada moneda; el voraz falla porque la moneda mayor no siempre es la mejor.
    @alternativas Recursión con @cache (mismo coste, pero con límite de recursión); voraz (incorrecto).
    @bigo n
    """
    if objetivo < 0:
        raise ValueError('El objetivo no puede ser negativo')
    infinito = float('inf')
    minimo = [0] + [infinito] * objetivo
    for c in range(1, objetivo + 1):
        for m in monedas:
            if 0 < m <= c and minimo[c - m] + 1 < minimo[c]:
                minimo[c] = minimo[c - m] + 1
    return -1 if minimo[objetivo] == infinito else minimo[objetivo]


def mochila(pesos: list, valores: list, capacidad: int) -> int:
    """
    Mochila 0/1 con tabla de una dimensión.

    @complejidad Tiempo O(objetos · capacidad); espacio O(capacidad).
    @explicacion `mejor[w]` = mayor valor con capacidad w. Recorrer w de mayor a menor garantiza que cada
    objeto se use como mucho una vez, porque `mejor[w - peso]` aún no incluye este objeto.
    @alternativas Tabla 2D (más espacio); fuerza bruta sobre subconjuntos O(2^n).
    @bigo n
    """
    if len(pesos) != len(valores):
        raise ValueError('pesos y valores deben tener la misma longitud')
    mejor = [0] * (capacidad + 1)
    for peso, valor in zip(pesos, valores):
        for w in range(capacidad, peso - 1, -1):
            mejor[w] = max(mejor[w], mejor[w - peso] + valor)
    return mejor[capacidad]


def lcs(a: str, b: str) -> int:
    """
    Subsecuencia común más larga con dos filas.

    @complejidad Tiempo O(n·m); espacio O(m).
    @explicacion Si los caracteres coinciden se suma 1 a la diagonal; si no, se toma el mejor entre "arriba" e
    "izquierda". Cada fila solo depende de la anterior, así que no hace falta guardar toda la tabla.
    @alternativas Tabla completa (O(n·m) de espacio); recursión sin memoizar O(2^(n+m)).
    @bigo n2
    """
    anterior = [0] * (len(b) + 1)
    for ca in a:
        actual = [0]
        for j, cb in enumerate(b, 1):
            actual.append(anterior[j - 1] + 1 if ca == cb else max(anterior[j], actual[j - 1]))
        anterior = actual
    return anterior[-1]


def distancia_edicion(a: str, b: str) -> int:
    """
    Distancia de Levenshtein con dos filas.

    @complejidad Tiempo O(n·m); espacio O(m).
    @explicacion `tabla[i][j]` = distancia entre los i primeros de a y los j primeros de b. Si coinciden se
    hereda la diagonal; si no, 1 + el mínimo de borrar, insertar o sustituir. Solo se conserva la fila anterior.
    @alternativas Tabla completa; recursión con @cache (mismo coste, con límite de recursión).
    @bigo n2
    """
    anterior = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        actual = [i]
        for j, cb in enumerate(b, 1):
            if ca == cb:
                actual.append(anterior[j - 1])
            else:
                actual.append(1 + min(anterior[j], actual[j - 1], anterior[j - 1]))
        anterior = actual
    return anterior[-1]
