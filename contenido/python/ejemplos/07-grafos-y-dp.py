"""
TEMA 7 · GRAFOS Y PROGRAMACIÓN DINÁMICA
─────────────────────────────────────────────────────────────────
GRAFOS: nodos unidos por aristas. Mapas, redes sociales, dependencias entre paquetes (¡pip!), rutas...

Se representan casi siempre con una LISTA DE ADYACENCIA: un dict que a cada nodo le asocia sus vecinos.
     {'A': ['B', 'C'], 'B': ['D'], 'C': ['D'], 'D': []}
Si las aristas tienen peso: {'A': {'B': 4, 'C': 1}}.

  Algoritmo           Estructura           Para qué sirve                          Coste (V nodos, E aristas)
  BFS (anchura)       cola (deque)         camino con MENOS aristas, niveles       O(V + E)
  DFS (profundidad)   pila (list)          componentes, ciclos, islas, orden       O(V + E)
  Orden topológico    cola + grados        ordenar tareas con dependencias         O(V + E)
  Dijkstra            cola de prioridad    camino de MENOR PESO (pesos ≥ 0)        O((V + E) log V)

PROGRAMACIÓN DINÁMICA (DP): cuando un problema se descompone en subproblemas que SE REPITEN, se resuelve cada
uno una sola vez y se guarda su resultado. Dos formas equivalentes:
  - de arriba abajo: recursión + memoización (`@cache`, lo del tema 3).
  - de abajo arriba ("tabulación"): rellenar una tabla desde los casos pequeños. Suele ser más rápida y no
    agota la pila de llamadas (el límite de recursión de Python es ~1000).
Receta: (1) define QUÉ significa cada celda de la tabla, (2) escribe cómo se calcula a partir de las anteriores,
(3) fija los casos base, (4) decide en qué orden rellenarla.
"""
import heapq
import json
from collections import defaultdict, deque
from functools import cache


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


def ver(valor) -> str:
    return json.dumps(valor, ensure_ascii=False)


# ═════════════════════════════════════════════════════════════════
# 1. GRAFOS: LISTA DE ADYACENCIA, BFS, DFS Y DIJKSTRA
# (1a) lista de adyacencia con defaultdict
# ═════════════════════════════════════════════════════════════════
titulo('1a. Lista de adyacencia')

aristas = [('Madrid', 'Toledo'), ('Madrid', 'Zaragoza'), ('Madrid', 'Valencia'),
           ('Toledo', 'Sevilla'), ('Zaragoza', 'Barcelona'), ('Valencia', 'Barcelona')]

# defaultdict(list) crea la lista vacía la primera vez que se pide una clave: nada de `if nodo not in grafo`.
# Alternativa: dict.setdefault(nodo, []).append(...), que sirve igual pero repite la clave en cada línea.
ciudades = defaultdict(list)
for a, b in aristas:
    ciudades[a].append(b)       # O(1) amortizado
    ciudades[b].append(a)       # no dirigido: la arista cuenta en los dos sentidos
print('vecinos de Madrid:', ciudades['Madrid'])
# Trampa: LEER una clave que no existe en un defaultdict la CREA (ciudades['Narnia'] añade un nodo vacío).
# Para consultar sin crear usa ciudades.get('Narnia', []).

# ═════════════════════════════════════════════════════════════════
# (1b) recorrer un grafo: anchura (BFS) y profundidad (DFS)
# ═════════════════════════════════════════════════════════════════
titulo('1b. BFS y DFS')


def recorrido_anchura(grafo: dict, inicio: str) -> list:
    """BFS: visita por "capas": primero los vecinos, luego los vecinos de los vecinos..."""
    visitados = {inicio}
    cola = deque([inicio])                    # deque: popleft() es O(1); list.pop(0) sería O(n)
    orden = []
    while cola:
        nodo = cola.popleft()
        orden.append(nodo)
        for vecino in grafo.get(nodo, []):
            if vecino not in visitados:       # marcar al ENCOLAR evita meterlo dos veces
                visitados.add(vecino)
                cola.append(vecino)
    return orden


def recorrido_profundidad(grafo: dict, inicio: str) -> list:
    """DFS iterativo con pila explícita: no depende del límite de recursión de Python."""
    visitados = set()
    pila = [inicio]
    orden = []
    while pila:
        nodo = pila.pop()
        if nodo in visitados:                 # aquí se marca al SACAR: el nodo pudo apilarse varias veces
            continue
        visitados.add(nodo)
        orden.append(nodo)
        # reversed: así el primer vecino es el primero en salir de la pila (mismo orden que la versión recursiva)
        pila.extend(reversed(grafo.get(nodo, [])))
    return orden


print('BFS desde Madrid:', ' → '.join(recorrido_anchura(ciudades, 'Madrid')))
print('DFS desde Madrid:', ' → '.join(recorrido_profundidad(ciudades, 'Madrid')))
# Sin el conjunto de "visitados" un grafo con ciclos (Madrid ↔ Toledo) se recorrería PARA SIEMPRE.

# ═════════════════════════════════════════════════════════════════
# (1c) Dijkstra con heapq
# ═════════════════════════════════════════════════════════════════
titulo('1c. Dijkstra')

carreteras = {'A': {'B': 4, 'C': 1}, 'B': {'D': 1}, 'C': {'B': 2, 'D': 5}, 'D': {}}


def distancias_desde(grafo: dict, origen: str) -> dict:
    dist = {origen: 0}
    monticulo = [(0, origen)]                 # heapq es un montículo MÍNIMO: sale la menor distancia (no hace falta negar)
    while monticulo:
        d, nodo = heapq.heappop(monticulo)    # O(log n)
        if d > dist.get(nodo, float('inf')):  # entrada "vieja": ya llegamos a este nodo por un camino mejor
            continue
        for vecino, peso in grafo.get(nodo, {}).items():
            nueva = d + peso
            if nueva < dist.get(vecino, float('inf')):
                dist[vecino] = nueva
                heapq.heappush(monticulo, (nueva, vecino))   # heapq no actualiza prioridades: se añade otra entrada
    return dist


print('distancias desde A:', ver(distancias_desde(carreteras, 'A')))
# Con pesos negativos Dijkstra da resultados erróneos (daría por buena una distancia que luego mejora): por eso se rechazan.

# ═════════════════════════════════════════════════════════════════
# 2. POR QUÉ LA PD: FIBONACCI DE TRES FORMAS
# ═════════════════════════════════════════════════════════════════
titulo('2. Memoización (@cache) y tabulación')

llamadas = 0


def fib_ingenuo(n: int) -> int:
    global llamadas
    llamadas += 1
    return n if n < 2 else fib_ingenuo(n - 1) + fib_ingenuo(n - 2)      # O(2^n): recalcula lo mismo mil veces


@cache          # memoización en una línea: guarda el resultado por argumentos. Más limpio que un dict a mano
def fib_memo(n: int) -> int:
    global llamadas
    llamadas += 1
    return n if n < 2 else fib_memo(n - 1) + fib_memo(n - 2)


def fib_tabla(n: int) -> int:
    tabla = [0, 1]
    for i in range(2, n + 1):
        tabla.append(tabla[i - 1] + tabla[i - 2])       # cada celda depende solo de las dos anteriores
    return tabla[n]


llamadas = 0
print(f'ingenuo  fib(22) = {fib_ingenuo(22)} con {llamadas} llamadas')
llamadas = 0
print(f'@cache   fib(22) = {fib_memo(22)} con {llamadas} llamadas')
print(f'tabla    fib(22) = {fib_tabla(22)} con un solo bucle')
# @cache recursivo agota la pila con n grande (fib_memo(5000) → RecursionError); la tabla no.
# Como la tabla solo mira las dos últimas celdas, se puede guardar solo ESAS (espacio O(1)): lo harás en `escaleras`.

# ═════════════════════════════════════════════════════════════════
# 3. PD EN UNA TABLA: CAMINOS EN UNA CUADRÍCULA
# ═════════════════════════════════════════════════════════════════
# ¿De cuántas formas se llega a la esquina inferior derecha moviéndose solo a la derecha o hacia abajo?
#  celda(f, c) = celda(f-1, c) + celda(f, c-1)        (se llega desde arriba o desde la izquierda)
titulo('3. Caminos en una cuadrícula')


def caminos_en_cuadricula(filas: int, columnas: int) -> int:
    # Trampa: [[1] * columnas] * filas repetiría LA MISMA fila; hay que crear una lista por fila.
    tabla = [[1] * columnas for _ in range(filas)]      # primera fila y columna: solo 1 camino
    for f in range(1, filas):
        for c in range(1, columnas):
            tabla[f][c] = tabla[f - 1][c] + tabla[f][c - 1]
    return tabla[-1][-1]


print('caminos en 3×3:', caminos_en_cuadricula(3, 3), '· en 10×10:', caminos_en_cuadricula(10, 10))


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS · GRAFOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · construir_grafo ───────────────────────────────
def construir_grafo(aristas: list, dirigido: bool = False) -> dict:
    """
    Construye la lista de adyacencia a partir de una lista de aristas [origen, destino].
     - No dirigido (por defecto): cada arista cuenta en los dos sentidos.
     - Dirigido (dirigido=True): solo origen → destino, pero el destino TAMBIÉN aparece como nodo (con []).
    Los nodos salen en el orden en que aparecen por primera vez, y los vecinos en el orden de las aristas.
    Devuelve un dict normal (no un defaultdict).
      construir_grafo([['A','B'],['A','C']])  →  {'A': ['B','C'], 'B': ['A'], 'C': ['A']}
    """
    pendiente()


# ── Ejercicio 2 · bfs_camino_mas_corto ──────────────────────────
def bfs_camino_mas_corto(grafo: dict, origen: str, destino: str):
    """
    Camino con MENOS aristas entre dos nodos de una lista de adyacencia, como lista de nodos
    (incluidos origen y destino), o None si no hay camino. Si origen == destino devuelve [origen].
    Si el origen no existe en el grafo, None. Ante varios caminos igual de cortos vale el que se descubre antes.
    Pista: BFS con deque guardando de qué nodo vienes (`padre[vecino] = nodo`) y reconstruye el camino hacia atrás.
    """
    pendiente()


# ── Ejercicio 3 · contar_islas ──────────────────────────────────
def contar_islas(mapa: list) -> int:
    """
    Cuenta las "islas" de un mapa: grupos de '1' (tierra) conectados en horizontal o vertical (NO en diagonal),
    rodeados de '0' (agua). El mapa es una lista de filas de texto.
      ['11000', '11000', '00100', '00011']  →  3
    Pista: recorre las celdas; al encontrar tierra sin visitar, suma 1 y "hunde" toda su isla con DFS
    usando una pila explícita (la recursión se desbordaría con mapas grandes). No modifiques el mapa recibido.
    """
    pendiente()


# ── Ejercicio 4 · orden_topologico ──────────────────────────────
def orden_topologico(dependencias: dict) -> list:
    """
    Ordena tareas con dependencias de modo que cada tarea aparezca DESPUÉS de todas aquellas de las que depende.
    Es lo que hace pip al instalar paquetes. Entrada: {'tarea': ['dependencia1', ...]}; una dependencia
    puede no aparecer como clave (es una tarea sin dependencias). Devuelve todas las tareas.
    Si hay un ciclo (a necesita b y b necesita a) lanza RuntimeError.
    Algoritmo de Kahn: cuenta cuántas dependencias pendientes tiene cada tarea; saca las que tienen 0 y, al sacarlas,
    descuenta una a las tareas que dependían de ellas. Si al acabar quedan tareas sin sacar, había un ciclo. O(V + E).
    """
    pendiente()


# ── Ejercicio 5 · dijkstra ──────────────────────────────────────
def dijkstra(grafo: dict, origen: str) -> dict:
    """
    Distancia mínima desde un origen a todos los nodos ALCANZABLES de un grafo con pesos:
    {'A': {'B': 4, 'C': 1}, ...}. Devuelve {nodo: distancia} ordenado por nodo (sorted); los
    inalcanzables no aparecen. Un peso negativo lanza ValueError (Dijkstra no lo soporta).
    Usa heapq con tuplas (distancia, nodo) y descarta las entradas "viejas" (si sacas un nodo con una distancia
    peor que la ya conocida, sáltalo). O((V + E) log V).
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS · PROGRAMACIÓN DINÁMICA
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 6 · escaleras ─────────────────────────────────────
def escaleras(n: int) -> int:
    """
    ¿De cuántas formas se sube una escalera de n peldaños dando pasos de 1 o 2? (escaleras(0) = 1, escaleras(1) = 1,
    escaleras(2) = 2, escaleras(3) = 3, escaleras(5) = 8...). Valores negativos → ValueError.
    Es Fibonacci disfrazado: pasos(n) = pasos(n-1) + pasos(n-2). Hazlo en O(n) de tiempo y O(1) de espacio
    guardando solo las dos últimas celdas. (Los int de Python no se desbordan.)
    """
    pendiente()


# ── Ejercicio 7 · cambio_monedas ────────────────────────────────
def cambio_monedas(monedas: list, objetivo: int) -> int:
    """
    Menor número de monedas que suman exactamente `objetivo`, o -1 si es imposible. Cada moneda se puede usar
    todas las veces que haga falta. Una cantidad negativa → ValueError.
    ¡El algoritmo voraz (coger siempre la moneda mayor) FALLA! Con [1, 3, 4] y 6 daría 4+1+1 (3 monedas) y lo mejor
    es 3+3 (2). Tabla: `minimo[c]` = monedas necesarias para sumar c; minimo[0] = 0;
    minimo[c] = 1 + min(minimo[c - moneda]) para cada moneda ≤ c. O(objetivo · monedas).
    """
    pendiente()


# ── Ejercicio 8 · mochila 0/1 ───────────────────────────────────
def mochila(pesos: list, valores: list, capacidad: int) -> int:
    """
    Mochila 0/1: cada objeto tiene un peso y un valor y se coge entero o no se coge. Devuelve el mayor valor
    posible sin pasar de la capacidad. Listas de distinta longitud → ValueError.
    Tabla de una dimensión: `mejor[w]` = mayor valor con capacidad w. Para cada objeto recorre w de MAYOR a menor
    (si fuera de menor a mayor, usarías el mismo objeto varias veces): mejor[w] = max(mejor[w], mejor[w - peso] + valor).
    O(objetos · capacidad).
    """
    pendiente()


# ── Ejercicio 9 · lcs (subsecuencia común más larga) ────────────
def lcs(a: str, b: str) -> int:
    """
    Longitud de la subsecuencia común más larga de dos textos (los caracteres no tienen por qué ser contiguos, pero
    sí mantener el orden). "ABCBDAB" y "BDCABA" → 4 ("BCBA"). Tabla de (n+1)×(m+1): si los caracteres coinciden,
    tabla[i][j] = tabla[i-1][j-1] + 1; si no, max(tabla[i-1][j], tabla[i][j-1]). Es el núcleo del comando `diff`.
    O(n·m) de tiempo; como cada fila solo mira la anterior, basta con DOS filas (espacio O(m)).
    """
    pendiente()


# ── Ejercicio 10 · distancia_edicion ────────────────────────────
def distancia_edicion(a: str, b: str) -> int:
    """
    Distancia de Levenshtein: mínimo de inserciones, borrados y sustituciones de un carácter para convertir a en b.
    "kitten" → "sitting" = 3. Se comparará con la implementación de referencia `levenshtein` de este archivo.
    tabla[i][j] = distancia entre los i primeros caracteres de a y los j primeros de b;
    tabla[i][0] = i; tabla[0][j] = j; y si coinciden: tabla[i-1][j-1], si no: 1 + min(borrar, insertar, sustituir).
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS
# ═════════════════════════════════════════════════════════════════

def levenshtein(a: str, b: str) -> int:
    """Implementación de referencia (el oráculo de las pruebas): dos filas, O(n·m)."""
    anterior = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        actual = [i]
        for j, cb in enumerate(b, 1):
            actual.append(min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + (ca != cb)))
        anterior = actual
    return anterior[-1]


prueba('construir_grafo', {
    'no dirigido': (([['A', 'B'], ['A', 'C']],), {'A': ['B', 'C'], 'B': ['A'], 'C': ['A']}),
    'dirigido': (([['A', 'B'], ['A', 'C']], True), {'A': ['B', 'C'], 'B': [], 'C': []}),
    'sin aristas': (([],), {}),
    'orden de aparición': (([['B', 'A']],), {'B': ['A'], 'A': ['B']}),
    'cadena dirigida': (([['a', 'b'], ['b', 'c']], True), {'a': ['b'], 'b': ['c'], 'c': []}),
    'ciclo no dirigido': (([['x', 'y'], ['y', 'z'], ['z', 'x']],), {'x': ['y', 'z'], 'y': ['x', 'z'], 'z': ['y', 'x']}),
})

MAPA_CIUDADES = {'Madrid': ['Toledo', 'Zaragoza'], 'Toledo': ['Madrid', 'Sevilla'], 'Zaragoza': ['Madrid', 'Barcelona'],
                 'Sevilla': ['Toledo'], 'Barcelona': ['Zaragoza'], 'Isla': []}

prueba('bfs_camino_mas_corto', {
    'directo': ((MAPA_CIUDADES, 'Madrid', 'Toledo'), ['Madrid', 'Toledo']),
    'dos saltos': ((MAPA_CIUDADES, 'Madrid', 'Sevilla'), ['Madrid', 'Toledo', 'Sevilla']),
    'tres saltos': ((MAPA_CIUDADES, 'Sevilla', 'Barcelona'), ['Sevilla', 'Toledo', 'Madrid', 'Zaragoza', 'Barcelona']),
    'mismo nodo': ((MAPA_CIUDADES, 'Madrid', 'Madrid'), ['Madrid']),
    'sin camino': ((MAPA_CIUDADES, 'Madrid', 'Isla'), None),
    'el origen no existe': ((MAPA_CIUDADES, 'Narnia', 'Madrid'), None),
    'elige el más corto, no el primero': (({'A': ['B', 'D'], 'B': ['C'], 'C': ['E'], 'D': ['E'], 'E': []}, 'A', 'E'), ['A', 'D', 'E']),
    'con ciclos no se cuelga': (({'A': ['B'], 'B': ['A', 'C'], 'C': ['B']}, 'A', 'C'), ['A', 'B', 'C']),
})

prueba('contar_islas', {
    'ejemplo': ((['11000', '11000', '00100', '00011'],), 3),
    'sin mapa': (([],), 0),
    'todo agua': ((['000', '000'],), 0),
    'todo tierra': ((['111', '111'],), 1),
    'diagonales no conectan': ((['10', '01'],), 2),
    'en forma de U': ((['101', '101', '111'],), 1),
    'tablero de ajedrez 3×3': ((['101', '010', '101'],), 5),
    'una fila': ((['1011011'],), 3),
    'una columna': ((['1', '0', '1', '1'],), 2),
    'mapa grande': (([('1' * 200)] * 200,), 1),
})


def es_orden_valido(deps: dict, orden: list) -> bool:
    """¿Es `orden` una ordenación topológica válida de `deps`? (hay varias válidas, por eso no se compara con una lista fija)."""
    nodos = set(deps)
    for ds in deps.values():
        nodos.update(ds)
    if len(orden) != len(nodos) or len(set(orden)) != len(orden):
        return False
    posicion = {t: i for i, t in enumerate(orden)}
    return all(d in posicion and t in posicion and posicion[d] < posicion[t]
               for t, ds in deps.items() for d in ds)


def _topo_valido(deps: dict) -> bool:
    return es_orden_valido(deps, orden_topologico(deps))


def _topo_larga() -> bool:
    d = {f't{i}': ([f't{i // 2}'] if i > 1 else []) for i in range(1, 2001)}
    return _topo_valido(d)


grupo('orden_topologico')
comprueba('cadena', lambda: orden_topologico({'app': ['framework'], 'framework': ['util'], 'util': []}), ['util', 'framework', 'app'])
comprueba('dependencia que no es clave', lambda: orden_topologico({'a': ['b']}), ['b', 'a'])
comprueba('sin tareas', lambda: orden_topologico({}), [])
comprueba('diamante: orden válido', lambda: _topo_valido({'app': ['http', 'db'], 'http': ['util'], 'db': ['util'], 'util': []}), True)
comprueba('tareas independientes aparecen todas', lambda: _topo_valido({'x': [], 'y': [], 'z': []}), True)
comprueba('pip: grafo de paquetes', lambda: _topo_valido({
    'django': ['asgiref', 'sqlparse', 'tzdata'],
    'celery': ['kombu', 'tzdata'],
    'kombu': ['amqp', 'tzdata'],
    'asgiref': [], 'sqlparse': [], 'amqp': [],
    'mi-app': ['django', 'celery'],
}), True)
comprueba('lista larga sin ciclos', _topo_larga, True)
lanza('ciclo de dos', lambda: orden_topologico({'a': ['b'], 'b': ['a']}), RuntimeError)
lanza('se necesita a sí misma', lambda: orden_topologico({'a': ['a']}), RuntimeError)
lanza('ciclo escondido al final', lambda: orden_topologico({'a': [], 'b': ['c'], 'c': ['d'], 'd': ['b']}), RuntimeError)

RED = {'A': {'B': 4, 'C': 1}, 'B': {'D': 1}, 'C': {'B': 2, 'D': 5}, 'D': {}, 'Z': {'A': 1}}

prueba('dijkstra', {
    'caso clásico': ((RED, 'A'), {'A': 0, 'B': 3, 'C': 1, 'D': 4}),
    'el atajo gana al directo': (({'A': {'B': 10, 'C': 1}, 'C': {'B': 1}}, 'A'), {'A': 0, 'B': 2, 'C': 1}),
    'solo el origen': (({'A': {}}, 'A'), {'A': 0}),
    'inalcanzables no aparecen': ((RED, 'D'), {'D': 0}),
    'nodo que solo es destino': (({'A': {'B': 2}}, 'A'), {'A': 0, 'B': 2}),
    'pesos cero': (({'A': {'B': 0}, 'B': {'C': 0}}, 'A'), {'A': 0, 'B': 0, 'C': 0}),
    'desde otro origen': ((RED, 'Z'), {'A': 1, 'B': 4, 'C': 2, 'D': 5, 'Z': 0}),
})


def _cuadricula_30() -> int:
    g = {}
    for f in range(30):
        for c in range(30):
            g[f'{f},{c}'] = {}
            if f + 1 < 30:
                g[f'{f},{c}'][f'{f + 1},{c}'] = 1
            if c + 1 < 30:
                g[f'{f},{c}'][f'{f},{c + 1}'] = 1
    return dijkstra(g, '0,0')['29,29']


grupo('dijkstra (casos especiales)')
lanza('peso negativo', lambda: dijkstra({'A': {'B': -1}}, 'A'), ValueError)
comprueba('cuadrícula 30×30 de pesos 1: la esquina opuesta está a 58', _cuadricula_30, 58)

prueba('escaleras', {
    'n = 0': ((0,), 1),
    'n = 1': ((1,), 1),
    'n = 2': ((2,), 2),
    'n = 3': ((3,), 3),
    'n = 5': ((5,), 8),
    'n = 10': ((10,), 89),
    'n = 40': ((40,), 165580141),
    'n = 80 (sin desbordar)': ((80,), 37889062373143906),
})
lanza('escaleras negativo', lambda: escaleras(-1), ValueError)

prueba('cambio_monedas', {
    'ejemplo básico': (([1, 2, 5], 11), 3),
    'el voraz falla': (([1, 3, 4], 6), 2),
    'imposible': (([2], 3), -1),
    'objetivo 0': (([1, 2], 0), 0),
    'sin monedas': (([], 5), -1),
    'una moneda exacta': (([7], 7), 1),
    'monedas europeas': (([1, 2, 5, 10, 20, 50, 100, 200], 387), 7),
    'moneda mayor que el objetivo': (([5, 10], 3), -1),
    'objetivo grande': (([1, 5, 10, 25], 9999), 405),
})
lanza('cambio negativo', lambda: cambio_monedas([1], -1), ValueError)

prueba('mochila', {
    'clásico': (([1, 3, 4, 5], [1, 4, 5, 7], 7), 9),
    'capacidad 0': (([1, 2], [10, 20], 0), 0),
    'todo cabe': (([1, 2, 3], [6, 10, 12], 10), 28),
    'ningún objeto cabe': (([5, 6], [10, 20], 4), 0),
    'no se reutilizan objetos': (([2], [3], 10), 3),
    'sin objetos': (([], [], 5), 0),
    'elegir bien': (([10, 20, 30], [60, 100, 120], 50), 220),
})
lanza('longitudes distintas', lambda: mochila([1, 2], [3], 5), ValueError)

prueba('lcs', {
    'clásico': (('ABCBDAB', 'BDCABA'), 4),
    'iguales': (('abc', 'abc'), 3),
    'nada en común': (('abc', 'def'), 0),
    'una vacía': (('', 'abc'), 0),
    'ambas vacías': (('', ''), 0),
    'subsecuencia': (('AGGTAB', 'GXTXAYB'), 4),
    'una dentro de otra': (('ace', 'abcde'), 3),
    'distinta longitud': (('a', 'aaaaaaaa'), 1),
})


def _contra_oraculo() -> str:
    x = 11

    def palabra(largo: int) -> str:
        nonlocal x
        s = ''
        for _ in range(largo):
            x = (x * 1103515245 + 12345) & 0x7fffffff
            s += chr(97 + x % 5)
        return s

    for i in range(200):
        a, b = palabra(i % 9), palabra((i * 7) % 11)
        if distancia_edicion(a, b) != levenshtein(a, b):
            return f"falla con '{a}' y '{b}'"
    return 'ok'


grupo('distancia_edicion')
comprueba('kitten → sitting', lambda: distancia_edicion('kitten', 'sitting'), 3)
comprueba('horse → ros', lambda: distancia_edicion('horse', 'ros'), 3)
comprueba('intention → execution', lambda: distancia_edicion('intention', 'execution'), 5)
comprueba('iguales', lambda: distancia_edicion('python', 'python'), 0)
comprueba('desde vacío', lambda: distancia_edicion('', 'abc'), 3)
comprueba('a vacío', lambda: distancia_edicion('abcd', ''), 4)
comprueba('es simétrica', lambda: distancia_edicion('sábado', 'domingo') == distancia_edicion('domingo', 'sábado'), True)
comprueba('coincide con la referencia en 200 pares', _contra_oraculo, 'ok')

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────
def mapa_aleatorio(n: int) -> list:
    """Mapa pseudoaleatorio de unas n celdas (lado = raíz de n)."""
    lado = max(2, int(n ** 0.5))
    x = 4242
    filas = []
    for _ in range(lado):
        fila = []
        for _ in range(lado):
            x = (x * 1103515245 + 12345) & 0x7fffffff
            fila.append('1' if (x >> 8) % 100 < 55 else '0')
        filas.append(''.join(fila))
    return filas


def grafo_ponderado(n: int) -> dict:
    """Grafo ponderado de n nodos: una cadena y un salto "aleatorio" desde cada nodo (unas 2n aristas)."""
    return {f'n{i}': {f'n{(i + 1) % n}': 1 + i % 5, f'n{(i * 7 + 3) % n}': 2 + i % 3} for i in range(n)}


def texto_aleatorio(n: int, semilla: int) -> str:
    x = semilla
    s = []
    for _ in range(n):
        x = (x * 1103515245 + 12345) & 0x7fffffff
        s.append(chr(97 + (x >> 8) % 4))
    return ''.join(s)


medir('contar_islas', lambda n: (mapa_aleatorio(n),))                                  # O(celdas)
medir('dijkstra', lambda n: (grafo_ponderado(n), 'n0'))                                # O((V+E) log V)
medir('escaleras', lambda n: (n,), escala='lineal', tamanos=range(100, 2001, 100))    # O(n)
medir('cambio_monedas', lambda n: ([1, 5, 10, 25], n))                                 # O(objetivo · monedas)
medir('mochila', lambda n: (list(range(1, 21)), list(range(21, 41)), n))               # O(objetos · capacidad)
medir('lcs', lambda n: (texto_aleatorio(n, 1), texto_aleatorio(n, 2)))                 # O(n²)
medir('distancia_edicion', lambda n: (texto_aleatorio(n, 3), texto_aleatorio(n, 4)))   # O(n²)
