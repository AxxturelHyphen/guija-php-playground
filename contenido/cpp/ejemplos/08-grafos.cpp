#include <algorithm>
#include <array>
#include <climits>
#include <cmath>
#include <functional>
#include <iostream>
#include <numeric>
#include <queue>
#include <stack>
#include <stdexcept>
#include <string>
#include <tuple>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 8 · GRAFOS
 * ────────────────────────────────────────────────────────────────────────────
 * Un GRAFO son nodos (vértices) unidos por aristas. Mapas de carreteras, redes sociales, dependencias entre
 * paquetes, laberintos, tableros de juego, estados de un puzzle... En una entrevista o un concurso, casi todo
 * "problema de relaciones" es un grafo disfrazado.
 *
 * REPRESENTACIÓN. En C++ de competición/DSA los nodos son ENTEROS 0..n-1 (no cadenas) y el grafo es un vector:
 *      Grafo = vector<vector<int>>                  g[u] = vecinos de u          (lista de adyacencia)
 *      GrafoPonderado = vector<vector<pair<int,int>>>   g[u] = {(destino, peso), ...}
 *   Acceder a g[u] es O(1) (un array, no un hash). Si los nombres son textos, se traducen a números una vez
 *   (con un map<string,int>) y se trabaja con números.
 *
 *   Algoritmo           Estructura               Para qué sirve                              Coste (V nodos, E aristas)
 *   BFS (anchura)       queue                    camino con MENOS aristas, niveles           O(V + E)
 *   DFS (profundidad)   stack / recursión        componentes, ciclos, islas, orden           O(V + E)
 *   Orden topológico    queue + grados (Kahn)    ordenar tareas con dependencias (DAG)       O(V + E)
 *   Dijkstra            priority_queue           camino de MENOR PESO (pesos ≥ 0)            O((V + E) log V)
 *   Bellman-Ford        pasadas sobre aristas    menor peso con pesos NEGATIVOS, ciclos <0   O(V · E)
 *   Floyd-Warshall      matriz V×V               distancias entre TODOS los pares            O(V³)
 *   Kruskal             ordenar + DSU            árbol de expansión mínimo                   O(E log E)
 *   Prim                priority_queue           árbol de expansión mínimo                   O(E log V)
 *   SCC (Tarjan)        DFS + pila               componentes fuertemente conexas             O(V + E)
 *   Bipartito           BFS con 2 colores        ¿se puede 2-colorear? (sin ciclos impares)  O(V + E)
 *   Ciclo (dirigido)    DFS con 3 estados        ¿hay un ciclo?                              O(V + E)
 *
 * (La programación dinámica tiene su propia lección: la 09.)
 *
 * CÓMO SE TRABAJA. Pulsa Ctrl+Enter para ejecutar: los ejemplos de teoría salen por pantalla y los ejercicios
 * aparecen como «pendientes». Sustituye `return pendiente();` por tu código y vuelve a ejecutar. Ctrl+S guarda tu
 * versión; el botón «Solución» la compara con la de referencia.
 */

// ── Tipos de la lección ─────────────────────────────────────────────────────
using Grafo = vector<vector<int>>;                  // g[u] = vecinos de u
using Arista = pair<int, int>;                      // (origen, destino)
using Aristas = vector<Arista>;
using Vecino = pair<int, int>;                      // (destino, peso)
using GrafoPonderado = vector<vector<Vecino>>;      // g[u] = {(destino, peso), ...}
using AristaP = tuple<int, int, int>;               // (origen, destino, peso)
using AristasP = vector<AristaP>;

void titulo(const string& texto) {
    cout << "\n=== " << texto << " ===\n";
}

/** "0 → 1 → 2" para imprimir recorridos. */
string flecha(const vector<int>& v) {
    string s;
    for (size_t i = 0; i < v.size(); i++) {
        s += (i ? " → " : "") + to_string(v[i]);
    }
    return s;
}

/*
 * ── TEORÍA 1 · RECORRIDOS ───────────────────────────────────────────────────
 * Desde Java/PHP/Python: allí el "visitado" suele ser un HashSet/array asociativo/set. En C++ con nodos 0..n-1 se
 * usa un `vector<char>` (o vector<bool>) indexado por nodo: es mucho más rápido (sin hash) y ocupa V bytes.
 * Desde C: es el `char visitado[N]` de siempre, pero con tamaño dinámico y sin tener que hacer free.
 *
 * TRAMPA CLÁSICA: `vector<bool>` es un contenedor ESPECIAL que empaqueta bits; su operator[] devuelve un proxy, no
 * un bool&. Funciona, pero es más lento y no se puede tomar `bool&`. Con `vector<char>` te ahorras sorpresas.
 */

/** BFS: visita por "capas": primero los vecinos, luego los vecinos de los vecinos... */
vector<int> recorridoAnchura(const Grafo& g, int inicio) {
    vector<char> visto(g.size(), 0);
    queue<int> cola;                                // push/pop en O(1); vector::erase(begin()) sería O(n)
    vector<int> orden;
    visto[inicio] = 1;                              // se marca al ENCOLAR, no al sacar: así nadie entra dos veces
    cola.push(inicio);
    while (!cola.empty()) {
        int u = cola.front();                       // front() NO saca nada; pop() no devuelve nada (a diferencia de poll() de Java)
        cola.pop();
        orden.push_back(u);
        for (int v : g[u]) {
            if (!visto[v]) {
                visto[v] = 1;
                cola.push(v);
            }
        }
    }
    return orden;
}

/** DFS recursivo: se mete por un camino hasta el fondo antes de probar otro. */
void recorridoProfundidad(const Grafo& g, int u, vector<char>& visto, vector<int>& orden) {
    visto[u] = 1;
    orden.push_back(u);
    for (int v : g[u]) {
        if (!visto[v]) {
            recorridoProfundidad(g, v, visto, orden);
        }
    }
}

/**
 * DFS con pila explícita. Se meten los vecinos AL REVÉS para que el primero salga antes y el orden coincida con el
 * recursivo. En C++ la recursión no lanza "StackOverflowError": se cae el programa (segfault) o ASan lo chiva.
 * Aquí la pila de llamadas es grande, pero en concursos suele rondar 1-8 MB: con 10^6 nodos en cadena, pila explícita.
 */
vector<int> dfsIterativo(const Grafo& g, int inicio) {
    vector<char> visto(g.size(), 0);
    stack<int> pila;
    vector<int> orden;
    pila.push(inicio);
    while (!pila.empty()) {
        int u = pila.top();
        pila.pop();
        if (visto[u]) {
            continue;                               // puede haberse apilado dos veces antes de visitarse
        }
        visto[u] = 1;
        orden.push_back(u);
        for (auto it = g[u].rbegin(); it != g[u].rend(); ++it) {
            if (!visto[*it]) {
                pila.push(*it);
            }
        }
    }
    return orden;
}

/** Número de componentes conexas de un grafo NO dirigido: un DFS por cada nodo aún sin visitar. */
int contarComponentes(const Grafo& g) {
    vector<char> visto(g.size(), 0);
    int total = 0;
    for (int u = 0; u < static_cast<int>(g.size()); u++) {
        if (!visto[u]) {
            vector<int> basura;
            recorridoProfundidad(g, u, visto, basura);
            total++;
        }
    }
    return total;
}

/*
 * ── TEORÍA 2 · UNIÓN-BÚSQUEDA (DSU, "disjoint set union") ───────────────────
 * Estructura que mantiene grupos disjuntos y responde dos preguntas casi en O(1):
 *   encontrar(x): ¿cuál es el representante de mi grupo?    unir(a, b): fusiona los grupos de a y b.
 * Dos trucos la hacen casi constante (O(α(n)), α crece tan despacio que es ≤ 4 para cualquier n real):
 *   - COMPRESIÓN DE CAMINOS: tras buscar la raíz, se cuelga todo el camino directamente de ella.
 *   - UNIÓN POR TAMAÑO: el grupo pequeño se cuelga del grande.
 * Es el corazón de Kruskal.
 */
struct ConjuntosDisjuntos {
    vector<int> padre;
    vector<int> tam;
    int grupos;

    explicit ConjuntosDisjuntos(int n) : padre(static_cast<size_t>(n)), tam(static_cast<size_t>(n), 1), grupos(n) {
        iota(padre.begin(), padre.end(), 0);        // padre[i] = i: cada nodo empieza siendo su propio grupo
    }

    int encontrar(int x) {
        while (padre[x] != x) {
            padre[x] = padre[padre[x]];             // "path halving": salta un nivel por paso, sin recursión
            x = padre[x];
        }
        return x;
    }

    /** Devuelve false si ya estaban juntos. */
    bool unir(int a, int b) {
        a = encontrar(a);
        b = encontrar(b);
        if (a == b) {
            return false;
        }
        if (tam[a] < tam[b]) {
            swap(a, b);
        }
        padre[b] = a;
        tam[a] += tam[b];
        grupos--;
        return true;
    }
};

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS · GRAFOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · construirGrafo ────────────────────────────────────────────
/**
 * Construye la lista de adyacencia de un grafo de `n` nodos (numerados 0..n-1) a partir de una lista de aristas.
 *  - No dirigido (dirigido = false): cada arista (a, b) cuenta en los dos sentidos: b entra en g[a] y a en g[b].
 *  - Dirigido (dirigido = true): solo a → b.
 * Los vecinos quedan en el orden en que aparecen las aristas. Un bucle (a, a) no dirigido se guarda UNA vez.
 * Un nodo fuera de 0..n-1 o un n negativo lanza invalid_argument.
 *   construirGrafo(3, {{0,1},{0,2}}, false)  →  {{1,2},{0},{0}}
 * Pista: `Grafo g(n);` crea n listas vacías. Recorre con `for (const auto& [a, b] : aristas)`.
 * Trampa: g[a] con a fuera de rango NO lanza excepción (UB: memoria ajena); por eso se valida antes.
 */
Grafo construirGrafo(int n, const Aristas& aristas, bool dirigido) {
    return pendiente();
}

// ── Ejercicio 2 · bfsCaminoMasCorto ─────────────────────────────────────────
/**
 * Camino con MENOS aristas entre dos nodos, como lista de nodos (incluidos origen y destino), o un vector VACÍO si no
 * hay camino (o si origen/destino no existen). Si origen == destino devuelve {origen}.
 * Ante varios caminos igual de cortos vale el que se descubre antes (según el orden de los vecinos).
 * Pista: BFS con `queue<int>` guardando de qué nodo vienes (`padre[v] = u`, con -1 = "sin padre"); al llegar al
 * destino reconstruye el camino hacia atrás y dale la vuelta con `reverse`.
 * Trampa: marca `visto` al ENCOLAR; si lo haces al sacar, un nodo puede entrar varias veces en la cola.
 */
vector<int> bfsCaminoMasCorto(const Grafo& g, int origen, int destino) {
    return pendiente();
}

// ── Ejercicio 3 · contarIslas ───────────────────────────────────────────────
/**
 * Cuenta las "islas" de un mapa: grupos de '1' (tierra) conectados en horizontal o vertical (NO en diagonal),
 * rodeados de '0' (agua). El mapa es un vector de filas de texto.
 *   {"11000", "11000", "00100", "00011"}  →  3
 * Pista: recorre las celdas; al encontrar tierra sin visitar, suma 1 y "hunde" toda su isla con DFS/BFS usando una
 * pila explícita (stack<pair<int,int>>): la recursión en una isla de 40.000 celdas se acerca al límite de pila.
 * Trampa: `mapa[f][c]` es un char ('1'), no un int; y con int fila/columna comparar con `mapa.size()` (size_t, sin
 * signo) da warnings y errores sutiles: `f - 1 < 0` con size_t NUNCA es negativo, da un número enorme.
 */
int contarIslas(const vector<string>& mapa) {
    return pendiente();
}

// ── Ejercicio 4 · ordenTopologico ───────────────────────────────────────────
/**
 * Ordena los nodos de un grafo DIRIGIDO de modo que para cada arista u → v, u aparezca ANTES que v (tareas con
 * dependencias, compilar módulos, plan de estudios...). Hay muchos órdenes válidos: las pruebas comprueban la regla.
 * Si hay un ciclo (a → b → a) lanza logic_error.
 * Algoritmo de Kahn: cuenta el GRADO DE ENTRADA de cada nodo (cuántas aristas le llegan); mete en la cola los de grado 0;
 * al sacar uno, resta 1 al grado de sus vecinos y encola los que lleguen a 0. Si al acabar has sacado menos de n
 * nodos, quedó un ciclo. O(V + E).
 */
vector<int> ordenTopologico(const Grafo& g) {
    return pendiente();
}

// ── Ejercicio 5 · dijkstra ──────────────────────────────────────────────────
/**
 * Distancia mínima desde `origen` a todos los nodos de un grafo con pesos (g[u] = {(destino, peso), ...}).
 * Devuelve un vector de n distancias; los nodos INALCANZABLES valen LLONG_MAX. Un peso negativo (Dijkstra no lo
 * soporta) o un origen inexistente lanzan invalid_argument.
 * Usa `priority_queue<pair<long long,int>, vector<pair<long long,int>>, greater<>>` (un montículo de MÍNIMOS: la
 * de C++ por defecto es de máximos, al revés que PriorityQueue de Java) con pares (distancia, nodo). No existe
 * "bajar la prioridad": se inserta una entrada nueva y al sacar una "vieja" (d > dist[u]) se descarta. O((V + E) log V).
 * Trampa: distancias en long long (con int, 10^5 aristas de peso 10^5 ya desbordan); y no sumes a LLONG_MAX.
 */
vector<long long> dijkstra(const GrafoPonderado& g, int origen) {
    return pendiente();
}

// ── Ejercicio 6 · bellmanFord ───────────────────────────────────────────────
/**
 * Distancias mínimas desde `origen` con pesos que pueden ser NEGATIVOS. El grafo es una lista de aristas dirigidas
 * (origen, destino, peso) sobre n nodos. Los inalcanzables valen LLONG_MAX. Si desde el origen se alcanza un CICLO
 * DE PESO NEGATIVO (las distancias bajarían sin límite) lanza logic_error.
 * Idea: el camino más corto usa como mucho n-1 aristas, así que n-1 pasadas relajando TODAS las aristas
 * (`dist[v] = min(dist[v], dist[u] + w)`) bastan. Una pasada n-ésima que aún mejore algo delata el ciclo negativo.
 * Para antes si una pasada no cambia nada. O(V · E).
 * Trampa: no relajes desde un nodo con dist == LLONG_MAX (LLONG_MAX + w desborda: UB con signo).
 */
vector<long long> bellmanFord(int n, const AristasP& aristas, int origen) {
    return pendiente();
}

// ── Ejercicio 7 · floydWarshall ─────────────────────────────────────────────
/**
 * Matriz de distancias mínimas entre TODOS los pares de nodos (aristas dirigidas (origen, destino, peso), pesos
 * posibles negativos). d[i][i] = 0 y los pares sin camino valen LLONG_MAX. Si hay un ciclo negativo lanza logic_error.
 * Idea (programación dinámica): d[i][j] mejorando con `k` como nodo intermedio permitido:
 * d[i][j] = min(d[i][j], d[i][k] + d[k][j]). El bucle de `k` va el PRIMERO (el más externo). O(V³).
 * Con aristas paralelas quédate con la de menor peso.
 * Trampa: salta los pares con LLONG_MAX (sumarlos desborda), y el orden de los bucles: k fuera, i y j dentro.
 */
vector<vector<long long>> floydWarshall(int n, const AristasP& aristas) {
    return pendiente();
}

// ── Ejercicio 8 · kruskal ───────────────────────────────────────────────────
/**
 * Peso total del ÁRBOL DE EXPANSIÓN MÍNIMO de un grafo NO dirigido y con pesos (aristas (a, b, peso) sobre n nodos),
 * o -1 si el grafo no es conexo (no hay árbol que lo cubra). Con n == 0 devuelve 0.
 * Kruskal: ordena las aristas por peso y recórrelas; coge una si une dos grupos distintos (con un DSU: busca la raíz
 * de cada extremo y fusiona; si ya tienen la misma raíz, la arista cerraría un ciclo y se descarta). Un árbol de n
 * nodos tiene n-1 aristas. O(E log E).
 * Pista: `sort(aristas.begin(), aristas.end(), [](const AristaP& x, const AristaP& y){ return get<2>(x) < get<2>(y); })`;
 * el parámetro va por valor (copia) precisamente para poder ordenarlo sin tocar al llamador.
 */
long long kruskal(int n, AristasP aristas) {
    return pendiente();
}

// ── Ejercicio 9 · prim ──────────────────────────────────────────────────────
/**
 * Lo mismo que kruskal (peso del árbol de expansión mínimo, o -1 si no es conexo) pero sobre una lista de adyacencia
 * NO dirigida (cada arista aparece en los dos sentidos): g[u] = {(v, peso), ...}. Con n == 0 devuelve 0.
 * Prim: haz crecer el árbol desde el nodo 0. Una priority_queue de mínimos con (peso, nodo) guarda las aristas que
 * salen del árbol; saca la más barata, y si su nodo aún no está dentro, súmala y mete sus aristas. O(E log V).
 * Kruskal ordena aristas globalmente (mejor en grafos dispersos); Prim crece como Dijkstra (mejor en densos).
 */
long long prim(const GrafoPonderado& g) {
    return pendiente();
}

// ── Ejercicio 10 · componentesFuertes ───────────────────────────────────────
/**
 * Componentes fuertemente conexas (SCC) de un grafo DIRIGIDO: grupos de nodos donde desde cualquiera se llega a
 * cualquier otro. Devuelve la lista de componentes, con los nodos de cada una en orden ascendente y las componentes
 * ordenadas por su primer nodo (así el resultado es único).
 *   0 → 1 → 2 → 0 y 2 → 3  →  {{0,1,2},{3}}
 * Tarjan: un DFS que numera los nodos (`indice[u]`) y calcula `bajo[u]` = el índice más pequeño alcanzable desde su
 * subárbol DFS usando como mucho una arista hacia un nodo que siga en la pila. Si bajo[u] == indice[u], u es la raíz
 * de una componente: se desapila hasta u. (Alternativa: Kosaraju = DFS, grafo traspuesto, DFS.) O(V + E).
 * Trampa: "está en la pila" ≠ "visitado": una arista a un nodo ya visitado pero FUERA de la pila no cuenta.
 */
vector<vector<int>> componentesFuertes(const Grafo& g) {
    return pendiente();
}

// ── Ejercicio 11 · esBipartito ──────────────────────────────────────────────
/**
 * ¿Se puede colorear un grafo NO dirigido con dos colores de modo que ninguna arista una dos nodos del mismo color?
 * Equivale a "no tiene ciclos de longitud impar". Aplicaciones: repartir en dos equipos sin enemigos, emparejamientos.
 * Un bucle (u, u) lo hace NO bipartito. El grafo puede tener varias componentes (hay que probar desde cada una).
 * Pista: BFS que asigna al vecino el color contrario; si encuentra un vecino YA coloreado con el mismo color, false.
 */
bool esBipartito(const Grafo& g) {
    return pendiente();
}

// ── Ejercicio 12 · tieneCiclo ───────────────────────────────────────────────
/**
 * ¿Tiene un ciclo este grafo DIRIGIDO? (a → b → c → a, o un bucle a → a.)
 * DFS con TRES estados por nodo: 0 = sin visitar, 1 = en el camino actual (en proceso), 2 = terminado. Una arista hacia
 * un nodo en estado 1 cierra un ciclo. Con solo "visitado/no" se confundiría un ciclo con un rombo (dos caminos que
 * se juntan), que NO es un ciclo en dirigidos.
 * Hazlo con pila explícita (guarda pares (nodo, siguiente vecino por mirar)) para que una cadena de 10^5 nodos no
 * agote la pila de llamadas. O(V + E).
 */
bool tieneCiclo(const Grafo& g) {
    return pendiente();
}

// ── Utilidades de las pruebas ───────────────────────────────────────────────

/** ¿Es `orden` una ordenación topológica válida de `g`? (hay varias válidas, por eso no se compara con una lista fija). */
bool esOrdenValido(const Grafo& g, const vector<int>& orden) {
    if (orden.size() != g.size()) {
        return false;
    }
    vector<int> posicion(g.size(), -1);
    for (size_t i = 0; i < orden.size(); i++) {
        int u = orden[i];
        if (u < 0 || u >= static_cast<int>(g.size()) || posicion[static_cast<size_t>(u)] != -1) {
            return false;                           // fuera de rango o repetido
        }
        posicion[static_cast<size_t>(u)] = static_cast<int>(i);
    }
    for (size_t u = 0; u < g.size(); u++) {
        for (int v : g[u]) {
            if (posicion[u] >= posicion[static_cast<size_t>(v)]) {
                return false;
            }
        }
    }
    return true;
}

/** Referencia lenta de distancias mínimas (Bellman-Ford sin protecciones) para comparar con dijkstra. */
vector<long long> distanciasReferencia(const GrafoPonderado& g, int origen) {
    vector<long long> d(g.size(), LLONG_MAX);
    d[static_cast<size_t>(origen)] = 0;
    for (size_t pasada = 0; pasada < g.size(); pasada++) {
        for (size_t u = 0; u < g.size(); u++) {
            if (d[u] == LLONG_MAX) {
                continue;
            }
            for (auto [v, w] : g[u]) {
                d[static_cast<size_t>(v)] = min(d[static_cast<size_t>(v)], d[u] + w);
            }
        }
    }
    return d;
}

/** Mapa pseudoaleatorio de unas n celdas (lado = raíz de n). */
vector<string> mapaAleatorio(int n) {
    int lado = max(2, static_cast<int>(sqrt(static_cast<double>(n))));
    unsigned long long x = 4242;
    vector<string> filas;
    for (int f = 0; f < lado; f++) {
        string fila;
        for (int c = 0; c < lado; c++) {
            x = (x * 1103515245ULL + 12345ULL) & 0x7fffffffULL;
            fila += ((x >> 8) % 100 < 55) ? '1' : '0';
        }
        filas.push_back(fila);
    }
    return filas;
}

/** Grafo ponderado de n nodos: una cadena y un salto "aleatorio" desde cada nodo (unas 2n aristas). */
GrafoPonderado grafoPonderado(int n) {
    GrafoPonderado g(static_cast<size_t>(n));
    for (int i = 0; i < n; i++) {
        g[static_cast<size_t>(i)].push_back({(i + 1) % n, 1 + i % 5});
        g[static_cast<size_t>(i)].push_back({(i * 7 + 3) % n, 2 + i % 3});
    }
    return g;
}

/** Aristas ponderadas NO dirigidas de un grafo conexo de n nodos: una cadena más 2 aristas "aleatorias" por nodo. */
AristasP aristasConexas(int n) {
    AristasP a;
    unsigned long long x = 99;
    for (int i = 1; i < n; i++) {
        a.push_back({i - 1, i, 1 + i % 7});
    }
    for (int i = 0; i < 2 * n; i++) {
        x = (x * 1103515245ULL + 12345ULL) & 0x7fffffffULL;
        int p = static_cast<int>((x >> 4) % static_cast<unsigned long long>(n));
        x = (x * 1103515245ULL + 12345ULL) & 0x7fffffffULL;
        int q = static_cast<int>((x >> 4) % static_cast<unsigned long long>(n));
        a.push_back({p, q, 1 + static_cast<int>((x >> 9) % 20)});
    }
    return a;
}

/** Las mismas aristas como lista de adyacencia no dirigida. */
GrafoPonderado desdeAristas(int n, const AristasP& aristas) {
    GrafoPonderado g(static_cast<size_t>(n));
    for (auto [a, b, w] : aristas) {
        g[static_cast<size_t>(a)].push_back({b, w});
        g[static_cast<size_t>(b)].push_back({a, w});
    }
    return g;
}

/** Peso del MST por una vía distinta y lenta (Prim sobre matriz) para contrastar. O(V²). */
long long mstReferencia(int n, const AristasP& aristas) {
    const long long INF = LLONG_MAX;
    vector<vector<long long>> m(static_cast<size_t>(n), vector<long long>(static_cast<size_t>(n), INF));
    for (auto [a, b, w] : aristas) {
        m[static_cast<size_t>(a)][static_cast<size_t>(b)] = min(m[static_cast<size_t>(a)][static_cast<size_t>(b)], static_cast<long long>(w));
        m[static_cast<size_t>(b)][static_cast<size_t>(a)] = m[static_cast<size_t>(a)][static_cast<size_t>(b)];
    }
    vector<long long> mejor(static_cast<size_t>(n), INF);
    vector<char> dentro(static_cast<size_t>(n), 0);
    mejor[0] = 0;
    long long total = 0;
    for (int paso = 0; paso < n; paso++) {
        int u = -1;
        for (int i = 0; i < n; i++) {
            if (!dentro[static_cast<size_t>(i)] && (u == -1 || mejor[static_cast<size_t>(i)] < mejor[static_cast<size_t>(u)])) {
                u = i;
            }
        }
        if (mejor[static_cast<size_t>(u)] == INF) {
            return -1;
        }
        dentro[static_cast<size_t>(u)] = 1;
        total += mejor[static_cast<size_t>(u)];
        for (int v = 0; v < n; v++) {
            if (!dentro[static_cast<size_t>(v)] && m[static_cast<size_t>(u)][static_cast<size_t>(v)] < mejor[static_cast<size_t>(v)]) {
                mejor[static_cast<size_t>(v)] = m[static_cast<size_t>(u)][static_cast<size_t>(v)];
            }
        }
    }
    return total;
}

int main() {

// ════════════════════════════════════════════════════════════════════════════
// 1. RECORRER UN GRAFO: ANCHURA (BFS) Y PROFUNDIDAD (DFS)
// ════════════════════════════════════════════════════════════════════════════
        titulo("1. BFS y DFS");

        // 0 = Madrid, 1 = Toledo, 2 = Zaragoza, 3 = Valencia, 4 = Sevilla, 5 = Barcelona
        const vector<string> nombres = {"Madrid", "Toledo", "Zaragoza", "Valencia", "Sevilla", "Barcelona"};
        Grafo ciudades = {{1, 2, 3}, {0, 4}, {0, 5}, {0, 5}, {1}, {2, 3}};

        vector<int> dfs;
        vector<char> visto(ciudades.size(), 0);
        recorridoProfundidad(ciudades, 0, visto, dfs);
        cout << "BFS desde " << nombres[0] << ": " << flecha(recorridoAnchura(ciudades, 0)) << "\n";
        cout << "DFS desde " << nombres[0] << ": " << flecha(dfs) << "\n";
        cout << "DFS con pila:      " << flecha(dfsIterativo(ciudades, 0)) << "\n";
        // Sin el vector `visto` un grafo con ciclos (Madrid ↔ Toledo) se recorrería PARA SIEMPRE.

        // ── Subsección: componentes conexas ──
        // Dos "islas" de nodos: {0,1,2} y {3,4}, y el nodo 5 solo.
        Grafo islas = {{1}, {0, 2}, {1}, {4}, {3}, {}};
        cout << "componentes conexas: " << contarComponentes(islas) << "\n";

        // ── Subsección: DSU ──
        ConjuntosDisjuntos dsu(6);
        dsu.unir(0, 1);
        dsu.unir(1, 2);
        dsu.unir(3, 4);
        cout << "DSU: ¿0 y 2 juntos? " << (dsu.encontrar(0) == dsu.encontrar(2) ? "sí" : "no")
             << " · ¿0 y 3? " << (dsu.encontrar(0) == dsu.encontrar(3) ? "sí" : "no")
             << " · grupos: " << dsu.grupos << "\n";

// ════════════════════════════════════════════════════════════════════════════
// 2. CAMINOS MÍNIMOS Y ORDEN: DIJKSTRA, BELLMAN-FORD, FLOYD-WARSHALL, TOPOLÓGICO
// ════════════════════════════════════════════════════════════════════════════
        // Cuál usar: sin pesos → BFS. Pesos ≥ 0 → Dijkstra. Pesos negativos → Bellman-Ford. Todos contra todos y
        // pocos nodos (≤ unos cientos) → Floyd-Warshall. Dependencias sin ciclos → orden topológico.
        titulo("2. Caminos mínimos: las piezas");

        // (a) La cola de prioridad. priority_queue<int> es un montículo de MÁXIMOS (saca el mayor); en Java,
        //     PriorityQueue es de MÍNIMOS. Para Dijkstra se necesita el mínimo: se le pasa greater<>.
        priority_queue<int> maximos;
        priority_queue<int, vector<int>, greater<>> minimos;
        for (int x : {5, 1, 4, 2}) {
            maximos.push(x);
            minimos.push(x);
        }
        cout << "máximos saca " << maximos.top() << " · mínimos saca " << minimos.top() << "\n";
        // Con pares, la comparación es lexicográfica: (distancia, nodo) ordena primero por distancia.
        priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> cola;
        cola.push({7, 2});
        cola.push({3, 9});
        cola.push({3, 1});
        cout << "primero sale (dist, nodo) = (" << cola.top().first << ", " << cola.top().second << ")\n";

        // (b) El "infinito" y el desbordamiento. LLONG_MAX es cómodo, pero LLONG_MAX + 1 es UB (overflow con
        //     signo): el compilador puede asumir que nunca ocurre y "optimizar" tu comprobación. Mira ANTES de sumar.
        long long infinito = LLONG_MAX;
        long long peso = 5;
        bool seguro = infinito != LLONG_MAX && infinito + peso < 100;   // el && corta: la suma NO se evalúa
        cout << "¿relajar desde el infinito? " << (seguro ? "sí" : "no (y sin tocar la suma)") << "\n";
        // Otra opción: infinito = LLONG_MAX / 4, que se puede sumar varias veces sin desbordar. Pero entonces
        // "inalcanzable" es "≥ infinito", no "== infinito": la comparación queda más fina.

        // (c) Grados de entrada, la base de Kahn: cuántas aristas llegan a cada nodo.
        Grafo tareas = {{1, 2}, {3}, {3}, {}};
        vector<int> gradoEntrada(tareas.size(), 0);
        for (const auto& vecinos : tareas) {
            for (int v : vecinos) {
                gradoEntrada[static_cast<size_t>(v)]++;
            }
        }
        cout << "grados de entrada:";
        for (int gr : gradoEntrada) {
            cout << " " << gr;
        }
        cout << "   (el nodo con 0 puede ir el primero)\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. ÁRBOLES DE EXPANSIÓN Y CONECTIVIDAD: KRUSKAL, PRIM, SCC, BIPARTITO, CICLOS
// ════════════════════════════════════════════════════════════════════════════
        // Un ÁRBOL DE EXPANSIÓN MÍNIMO conecta todos los nodos con el menor peso total (red eléctrica, cableado...).
        // Preguntas de estructura: ¿qué grupos se alcanzan entre sí (SCC)? ¿se parte en dos bandos (bipartito)? ¿hay ciclos?
        titulo("3. MST y estructura: las piezas");

        // (a) Ordenar aristas por peso: lambda sobre el tercer campo de la tupla. Es el primer paso de Kruskal.
        AristasP rutas = {{0, 1, 9}, {1, 2, 2}, {0, 2, 5}};
        sort(rutas.begin(), rutas.end(), [](const AristaP& x, const AristaP& y) { return get<2>(x) < get<2>(y); });
        cout << "aristas por peso:";
        for (const auto& [a, b, w] : rutas) {          // desestructuración (C++17): como el "for (a, b, w) in" de Python
            cout << "  " << a << "-" << b << "(" << w << ")";
        }
        cout << "\n";

        // (b) Tres estados en vez de visitado sí/no: sirven para detectar ciclos en grafos DIRIGIDOS.
        //     0 = sin visitar · 1 = en el camino actual · 2 = terminado. Una arista hacia un 1 cierra un ciclo.
        enum Estado : char { SIN_VISITAR = 0, EN_PROCESO = 1, TERMINADO = 2 };
        vector<Estado> estado(3, SIN_VISITAR);
        estado[0] = EN_PROCESO;
        cout << "estado[0] = " << static_cast<int>(estado[0]) << " (una arista a un nodo así cerraría un ciclo)\n";

        // (c) Un SCC es una relación de equivalencia entre nodos: se puede "comprimir" cada SCC en un solo nodo y
        //     el grafo resultante es siempre un DAG (sin ciclos), al que se le puede aplicar orden topológico.
        cout << "idea: componentes fuertes + orden topológico = resolver cualquier dependencia circular\n";

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        prueba(construirGrafo,
            caso("no dirigido", Grafo{{1, 2}, {0}, {0}}, 3, Aristas{{0, 1}, {0, 2}}, false),
            caso("dirigido", Grafo{{1, 2}, {}, {}}, 3, Aristas{{0, 1}, {0, 2}}, true),
            caso("sin aristas", Grafo{{}, {}}, 2, Aristas{}, false),
            caso("sin nodos", Grafo{}, 0, Aristas{}, true),
            caso("orden de las aristas", Grafo{{2, 1}, {0}, {0}}, 3, Aristas{{0, 2}, {0, 1}}, false),
            caso("cadena dirigida", Grafo{{1}, {2}, {}}, 3, Aristas{{0, 1}, {1, 2}}, true),
            caso("ciclo no dirigido", Grafo{{1, 2}, {0, 2}, {1, 0}}, 3, Aristas{{0, 1}, {1, 2}, {2, 0}}, false),
            caso("bucle no dirigido: una sola vez", Grafo{{0}}, 1, Aristas{{0, 0}}, false));
        grupo("construirGrafo (errores)");
        lanza("nodo fuera de rango", [&] { construirGrafo(2, Aristas{{0, 5}}, false); }, invalid_argument);
        lanza("nodo negativo", [&] { construirGrafo(2, Aristas{{-1, 0}}, true); }, invalid_argument);
        lanza("n negativo", [&] { construirGrafo(-1, Aristas{}, false); }, invalid_argument);

        Grafo mapaCiudades = {{1, 2}, {0, 3}, {0, 4}, {1}, {2}, {}};   // 5 = isla aislada
        prueba(bfsCaminoMasCorto,
            caso("directo", vector<int>{0, 1}, mapaCiudades, 0, 1),
            caso("dos saltos", vector<int>{0, 1, 3}, mapaCiudades, 0, 3),
            caso("de vuelta", vector<int>{3, 1, 0, 2, 4}, mapaCiudades, 3, 4),
            caso("mismo nodo", vector<int>{0}, mapaCiudades, 0, 0),
            caso("sin camino", vector<int>{}, mapaCiudades, 0, 5),
            caso("el origen no existe", vector<int>{}, mapaCiudades, 9, 0),
            caso("el destino no existe", vector<int>{}, mapaCiudades, 0, -1),
            caso("elige el más corto, no el primero", vector<int>{0, 3, 4},
                 Grafo{{1, 3}, {2}, {4}, {4}, {}}, 0, 4),
            caso("con ciclos no se cuelga", vector<int>{0, 1, 2}, Grafo{{1}, {0, 2}, {1}}, 0, 2));

        prueba(contarIslas,
            caso("ejemplo", 3, vector<string>{"11000", "11000", "00100", "00011"}),
            caso("sin mapa", 0, vector<string>{}),
            caso("todo agua", 0, vector<string>{"000", "000"}),
            caso("todo tierra", 1, vector<string>{"111", "111"}),
            caso("diagonales no conectan", 2, vector<string>{"10", "01"}),
            caso("en forma de U", 1, vector<string>{"101", "101", "111"}),
            caso("tablero de ajedrez 3×3", 5, vector<string>{"101", "010", "101"}),
            caso("una fila", 3, vector<string>{"1011011"}),
            caso("una columna", 2, vector<string>{"1", "0", "1", "1"}),
            caso("mapa grande", 1, vector<string>(200, string(200, '1'))));

        grupo("ordenTopologico");
        comprueba("cadena", [&] { return ordenTopologico(Grafo{{1}, {2}, {}}); }, vector<int>{0, 1, 2});
        comprueba("sin nodos", [&] { return ordenTopologico(Grafo{}); }, vector<int>{});
        comprueba("un solo nodo", [&] { return ordenTopologico(Grafo{{}}); }, vector<int>{0});
        comprueba("diamante: orden válido", [&] {
            Grafo d = {{1, 2}, {3}, {3}, {}};
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        comprueba("nodos independientes aparecen todos", [&] {
            Grafo d = {{}, {}, {}};
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        comprueba("grafo de módulos", [&] {
            Grafo d = {{1, 2, 3}, {4}, {4, 3}, {4}, {}, {0, 1}};
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        comprueba("lista larga sin ciclos (árbol de 2000 nodos)", [&] {
            Grafo d(2000);
            for (int i = 1; i < 2000; i++) {
                d[static_cast<size_t>(i / 2)].push_back(i);
            }
            return esOrdenValido(d, ordenTopologico(d));
        }, true);
        lanza("ciclo de dos", [&] { ordenTopologico(Grafo{{1}, {0}}); }, logic_error);
        lanza("se necesita a sí misma", [&] { ordenTopologico(Grafo{{0}}); }, logic_error);
        lanza("ciclo escondido al final", [&] { ordenTopologico(Grafo{{}, {2}, {3}, {1}}); }, logic_error);

        GrafoPonderado redPonderada = {{{1, 4}, {2, 1}}, {{3, 1}}, {{1, 2}, {3, 5}}, {}, {{0, 1}}};
        const long long INF = LLONG_MAX;
        prueba(dijkstra,
            caso("caso clásico", vector<long long>{0, 3, 1, 4, INF}, redPonderada, 0),
            caso("el atajo gana al directo", vector<long long>{0, 2, 1}, GrafoPonderado{{{1, 10}, {2, 1}}, {}, {{1, 1}}}, 0),
            caso("solo el origen", vector<long long>{0}, GrafoPonderado{{}}, 0),
            caso("inalcanzables valen LLONG_MAX", vector<long long>{INF, INF, INF, 0, INF}, redPonderada, 3),
            caso("pesos cero", vector<long long>{0, 0, 0}, GrafoPonderado{{{1, 0}}, {{2, 0}}, {}}, 0),
            caso("desde otro origen", vector<long long>{1, 4, 2, 5, 0}, redPonderada, 4),
            caso("pesos enormes no desbordan (long long)", vector<long long>{0, 2000000000LL, 4000000000LL},
                 GrafoPonderado{{{1, 2000000000}}, {{2, 2000000000}}, {}}, 0));
        grupo("dijkstra (casos especiales)");
        lanza("peso negativo", [&] { dijkstra(GrafoPonderado{{{1, -1}}, {}}, 0); }, invalid_argument);
        lanza("origen inexistente", [&] { dijkstra(GrafoPonderado{{}}, 3); }, invalid_argument);
        comprueba("cuadrícula 30×30 de pesos 1: la esquina opuesta está a 58", [&] {
            GrafoPonderado g(900);
            for (int f = 0; f < 30; f++) {
                for (int c = 0; c < 30; c++) {
                    if (f + 1 < 30) {
                        g[static_cast<size_t>(f * 30 + c)].push_back({(f + 1) * 30 + c, 1});
                    }
                    if (c + 1 < 30) {
                        g[static_cast<size_t>(f * 30 + c)].push_back({f * 30 + c + 1, 1});
                    }
                }
            }
            return dijkstra(g, 0)[899];
        }, 58LL);
        comprueba("coincide con la referencia en un grafo de 300 nodos", [&] {
            GrafoPonderado g = grafoPonderado(300);
            return dijkstra(g, 0) == distanciasReferencia(g, 0);
        }, true);

        AristasP conNegativos = {{0, 1, 4}, {0, 2, 5}, {1, 2, -3}, {2, 3, 2}};
        prueba(bellmanFord,
            caso("con una arista negativa", vector<long long>{0, 4, 1, 3}, 4, conNegativos, 0),
            caso("inalcanzables", vector<long long>{INF, 0, -3, -1}, 4, conNegativos, 1),
            caso("sin aristas", vector<long long>{0, INF}, 2, AristasP{}, 0),
            caso("coincide con Dijkstra si no hay negativos", vector<long long>{0, 3, 1, 4, INF}, 5,
                 AristasP{{0, 1, 4}, {0, 2, 1}, {1, 3, 1}, {2, 1, 2}, {2, 3, 5}, {4, 0, 1}}, 0));
        grupo("bellmanFord (ciclos negativos)");
        lanza("ciclo negativo alcanzable", [&] { bellmanFord(3, AristasP{{0, 1, 1}, {1, 2, -2}, {2, 1, 1}}, 0); }, logic_error);
        comprueba("ciclo negativo inalcanzable se ignora", [&] {
            return bellmanFord(3, AristasP{{1, 2, -2}, {2, 1, 1}}, 0);
        }, vector<long long>{0, INF, INF});
        comprueba("un ciclo de peso 0 no es negativo", [&] {
            return bellmanFord(3, AristasP{{0, 1, 1}, {1, 2, -1}, {2, 1, 1}}, 0);
        }, vector<long long>{0, 1, 0});

        grupo("floydWarshall");
        comprueba("tres nodos", [&] { return floydWarshall(3, AristasP{{0, 1, 3}, {1, 2, 4}, {0, 2, 10}}); },
            vector<vector<long long>>{{0, 3, 7}, {INF, 0, 4}, {INF, INF, 0}});
        comprueba("con peso negativo", [&] { return floydWarshall(3, AristasP{{0, 1, 5}, {1, 2, -2}, {0, 2, 4}}); },
            vector<vector<long long>>{{0, 5, 3}, {INF, 0, -2}, {INF, INF, 0}});
        comprueba("aristas paralelas: la menor", [&] { return floydWarshall(2, AristasP{{0, 1, 9}, {0, 1, 2}}); },
            vector<vector<long long>>{{0, 2}, {INF, 0}});
        comprueba("sin nodos", [&] { return floydWarshall(0, AristasP{}); }, vector<vector<long long>>{});
        comprueba("coincide con Dijkstra desde cada nodo (40 nodos)", [&] {
            GrafoPonderado g = grafoPonderado(40);
            AristasP aristas;
            for (int u = 0; u < 40; u++) {
                for (auto [v, w] : g[static_cast<size_t>(u)]) {
                    aristas.push_back({u, v, w});
                }
            }
            vector<vector<long long>> m = floydWarshall(40, aristas);
            for (int u = 0; u < 40; u++) {
                if (m[static_cast<size_t>(u)] != distanciasReferencia(g, u)) {
                    return false;
                }
            }
            return true;
        }, true);
        lanza("ciclo negativo", [&] { floydWarshall(2, AristasP{{0, 1, -1}, {1, 0, -1}}); }, logic_error);

        prueba(kruskal,
            caso("triángulo", 3LL, 3, AristasP{{0, 1, 1}, {1, 2, 2}, {0, 2, 3}}),
            caso("ejemplo clásico", 16LL, 5, AristasP{{0, 1, 2}, {0, 3, 6}, {1, 2, 3}, {1, 3, 8}, {1, 4, 5}, {2, 4, 7}, {3, 4, 9}}),
            caso("no conexo", -1LL, 4, AristasP{{0, 1, 1}, {2, 3, 1}}),
            caso("un solo nodo", 0LL, 1, AristasP{}),
            caso("sin nodos", 0LL, 0, AristasP{}),
            caso("aristas paralelas", 1LL, 2, AristasP{{0, 1, 7}, {0, 1, 1}, {1, 0, 4}}),
            caso("bucles se ignoran", 5LL, 2, AristasP{{0, 0, 1}, {0, 1, 5}}),
            caso("pesos negativos", -4LL, 3, AristasP{{0, 1, -3}, {1, 2, -1}, {0, 2, 5}}),
            caso("coincide con la referencia (150 nodos)", mstReferencia(150, aristasConexas(150)), 150, aristasConexas(150)));

        prueba(prim,
            caso("triángulo", 3LL, desdeAristas(3, AristasP{{0, 1, 1}, {1, 2, 2}, {0, 2, 3}})),
            caso("ejemplo clásico", 16LL, desdeAristas(5, AristasP{{0, 1, 2}, {0, 3, 6}, {1, 2, 3}, {1, 3, 8}, {1, 4, 5}, {2, 4, 7}, {3, 4, 9}})),
            caso("no conexo", -1LL, desdeAristas(4, AristasP{{0, 1, 1}, {2, 3, 1}})),
            caso("un solo nodo", 0LL, GrafoPonderado{{}}),
            caso("sin nodos", 0LL, GrafoPonderado{}),
            caso("coincide con la referencia (150 nodos)", mstReferencia(150, aristasConexas(150)), desdeAristas(150, aristasConexas(150))));

        prueba(componentesFuertes,
            caso("un ciclo y una cola", vector<vector<int>>{{0, 1, 2}, {3}}, Grafo{{1}, {2}, {0, 3}, {}}),
            caso("sin ciclos: cada nodo es una", vector<vector<int>>{{0}, {1}, {2}}, Grafo{{1}, {2}, {}}),
            caso("dos ciclos unidos por un puente", vector<vector<int>>{{0, 1}, {2, 3}}, Grafo{{1}, {0, 2}, {3}, {2}}),
            caso("todo un ciclo", vector<vector<int>>{{0, 1, 2, 3}}, Grafo{{1}, {2}, {3}, {0}}),
            caso("sin nodos", vector<vector<int>>{}, Grafo{}),
            caso("el clásico de Tarjan (8 nodos)", vector<vector<int>>{{0, 1, 2}, {3, 4}, {5, 6}, {7}},
                 Grafo{{1}, {2}, {0}, {1, 2, 4}, {3, 5}, {2, 6}, {5}, {4, 6, 7}}));

        prueba(esBipartito,
            caso("camino", true, Grafo{{1}, {0, 2}, {1}}),
            caso("triángulo (ciclo impar)", false, Grafo{{1, 2}, {0, 2}, {0, 1}}),
            caso("cuadrado (ciclo par)", true, Grafo{{1, 3}, {0, 2}, {1, 3}, {2, 0}}),
            caso("pentágono", false, Grafo{{1, 4}, {0, 2}, {1, 3}, {2, 4}, {3, 0}}),
            caso("sin nodos", true, Grafo{}),
            caso("dos componentes: la segunda no vale", false, Grafo{{1}, {0}, {3, 4}, {2, 4}, {2, 3}}),
            caso("bucle", false, Grafo{{0}}),
            caso("nodos sueltos", true, Grafo{{}, {}, {}}));

        prueba(tieneCiclo,
            caso("cadena", false, Grafo{{1}, {2}, {}}),
            caso("ciclo de tres", true, Grafo{{1}, {2}, {0}}),
            caso("rombo: dos caminos que se juntan NO es ciclo", false, Grafo{{1, 2}, {3}, {3}, {}}),
            caso("bucle", true, Grafo{{0}}),
            caso("sin nodos", false, Grafo{}),
            caso("ciclo en la segunda componente", true, Grafo{{1}, {}, {3}, {2}}),
            caso("ida y vuelta", true, Grafo{{1}, {0}}));
        comprueba("cadena de 100.000 nodos (sin recursión)", [&] {
            Grafo g(100000);
            for (int i = 0; i + 1 < 100000; i++) {
                g[static_cast<size_t>(i)].push_back(i + 1);
            }
            return tieneCiclo(g);
        }, false);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        medir(contarIslas, mapaAleatorio(n));                       // O(celdas)
        medir(dijkstra, grafoPonderado(n), 0);                      // O((V+E) log V)
        medir(kruskal, n, aristasConexas(n));                       // O(E log E)
        medir(floydWarshall, n, aristasConexas(n));                 // O(V³): crece MUY rápido; por eso solo ~cientos de nodos

        return 0;
}
