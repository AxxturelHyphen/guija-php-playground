#include <algorithm>
#include <climits>
#include <functional>
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
 * SOLUCIONES · Tema 8 · Grafos
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Construir una lista de adyacencia.
 *
 * @complejidad Tiempo O(n + E); espacio O(n + E).
 * @explicacion `Grafo g(n)` crea n listas vacías de golpe, así que los nodos sin aristas también existen. Se valida cada
 * arista ANTES de indexar: `g[a]` con `a` fuera de rango no lanza nada, es comportamiento indefinido (memoria ajena).
 * En no dirigido se añade la arista en los dos sentidos, salvo el bucle (a, a), que se guarda una sola vez.
 * @alternativas Una matriz de adyacencia (n×n) ocupa O(n²) y solo compensa en grafos muy densos: preguntar "¿hay arista
 * u-v?" es O(1), pero recorrer los vecinos de un nodo es O(n). Para n ~10⁵ la matriz ni cabe en memoria.
 */
Grafo construirGrafo(int n, const Aristas& aristas, bool dirigido) {
    if (n < 0) {
        throw invalid_argument("n no puede ser negativo");
    }
    Grafo g(static_cast<size_t>(n));
    for (const auto& [a, b] : aristas) {
        if (a < 0 || a >= n || b < 0 || b >= n) {
            throw invalid_argument("arista con un nodo fuera de rango");
        }
        g[static_cast<size_t>(a)].push_back(b);
        if (!dirigido && a != b) {
            g[static_cast<size_t>(b)].push_back(a);
        }
    }
    return g;
}

/**
 * Camino con menos aristas (BFS).
 *
 * @complejidad Tiempo O(V + E); espacio O(V).
 * @explicacion BFS visita los nodos por distancia creciente: primero los que están a 1 arista, luego a 2... Por eso la
 * PRIMERA vez que se descubre un nodo es por un camino mínimo. Se guarda de quién se viene (`padre`) y, al llegar al
 * destino, se reconstruye el camino hacia atrás (el origen es el único con padre -1) y se invierte. `queue` hace
 * push/pop en O(1); borrar el primer elemento de un `vector` sería O(n) por operación.
 * @alternativas DFS NO garantiza el camino más corto. Con pesos hace falta Dijkstra. BFS bidireccional (desde ambos
 * extremos a la vez) reduce mucho el trabajo en grafos enormes.
 */
vector<int> bfsCaminoMasCorto(const Grafo& g, int origen, int destino) {
    int n = static_cast<int>(g.size());
    if (origen < 0 || origen >= n || destino < 0 || destino >= n) {
        return {};
    }
    vector<int> padre(g.size(), -1);
    vector<char> visto(g.size(), 0);
    queue<int> cola;
    visto[static_cast<size_t>(origen)] = 1;
    cola.push(origen);
    while (!cola.empty() && !visto[static_cast<size_t>(destino)]) {
        int u = cola.front();
        cola.pop();
        for (int v : g[static_cast<size_t>(u)]) {
            if (!visto[static_cast<size_t>(v)]) {
                visto[static_cast<size_t>(v)] = 1;
                padre[static_cast<size_t>(v)] = u;
                cola.push(v);
            }
        }
    }
    if (!visto[static_cast<size_t>(destino)]) {
        return {};
    }
    vector<int> camino;
    for (int x = destino; x != -1; x = padre[static_cast<size_t>(x)]) {
        camino.push_back(x);
    }
    reverse(camino.begin(), camino.end());
    return camino;
}

/**
 * Contar islas (DFS con pila explícita).
 *
 * @complejidad Tiempo O(filas · columnas); espacio O(filas · columnas).
 * @bigo n
 * @explicacion Se recorren todas las celdas; al encontrar tierra sin visitar se suma una isla y se "hunde" entera con un
 * DFS que usa un `stack` propio, no la recursión: una isla de 40.000 celdas son 40.000 marcos de pila. Las cuatro
 * direcciones salen de dos arrays `df`/`dc`, y las coordenadas son `int` (no `size_t`): con `size_t`, `f - 1` en la
 * fila 0 daría 18446744073709551615 en vez de -1 y el "¿me salgo por arriba?" nunca sería verdad. La longitud de cada fila
 * se consulta por fila, así que también aguanta mapas irregulares.
 * @alternativas BFS (queue) da el mismo coste. DSU (unión-búsqueda) permite añadir celdas de tierra una a una.
 * Modificar el mapa (poner '0' al visitar) ahorra la matriz `visitada` pero destruye la entrada.
 */
int contarIslas(const vector<string>& mapa) {
    int filas = static_cast<int>(mapa.size());
    vector<vector<char>> visitada(mapa.size());
    for (size_t f = 0; f < mapa.size(); f++) {
        visitada[f].assign(mapa[f].size(), 0);
    }
    const int df[4] = {1, -1, 0, 0};
    const int dc[4] = {0, 0, 1, -1};
    int islas = 0;
    for (int f0 = 0; f0 < filas; f0++) {
        for (int c0 = 0; c0 < static_cast<int>(mapa[static_cast<size_t>(f0)].size()); c0++) {
            if (mapa[static_cast<size_t>(f0)][static_cast<size_t>(c0)] != '1' || visitada[static_cast<size_t>(f0)][static_cast<size_t>(c0)]) {
                continue;
            }
            islas++;
            stack<pair<int, int>> pila;
            pila.push({f0, c0});
            visitada[static_cast<size_t>(f0)][static_cast<size_t>(c0)] = 1;
            while (!pila.empty()) {
                auto [f, c] = pila.top();
                pila.pop();
                for (int d = 0; d < 4; d++) {
                    int nf = f + df[d];
                    int nc = c + dc[d];
                    if (nf < 0 || nf >= filas || nc < 0 || nc >= static_cast<int>(mapa[static_cast<size_t>(nf)].size())) {
                        continue;
                    }
                    if (mapa[static_cast<size_t>(nf)][static_cast<size_t>(nc)] == '1' && !visitada[static_cast<size_t>(nf)][static_cast<size_t>(nc)]) {
                        visitada[static_cast<size_t>(nf)][static_cast<size_t>(nc)] = 1;
                        pila.push({nf, nc});
                    }
                }
            }
        }
    }
    return islas;
}

/**
 * Orden topológico (algoritmo de Kahn).
 *
 * @complejidad Tiempo O(V + E); espacio O(V).
 * @explicacion Se cuenta el grado de entrada de cada nodo y se encolan los de grado 0 (no esperan a nadie). Al sacar un
 * nodo, se le resta 1 al grado de cada vecino; el que llega a 0 ya tiene todo lo que necesitaba y se encola. Si al acabar el
 * orden tiene menos de n nodos, los que faltan forman (o dependen de) un ciclo, y se lanza `logic_error`. Las
 * dependencias circulares son exactamente los ciclos: un grafo tiene orden topológico si y solo si es un DAG.
 * @alternativas DFS: apilar cada nodo al TERMINAR y dar la vuelta al resultado (detecta ciclos con los tres estados).
 * Kahn tiene la ventaja de no usar recursión y de poder sacar el orden "léxicamente menor" con una priority_queue.
 */
vector<int> ordenTopologico(const Grafo& g) {
    vector<int> gradoEntrada(g.size(), 0);
    for (const auto& vecinos : g) {
        for (int v : vecinos) {
            gradoEntrada[static_cast<size_t>(v)]++;
        }
    }
    queue<int> cola;
    for (size_t u = 0; u < g.size(); u++) {
        if (gradoEntrada[u] == 0) {
            cola.push(static_cast<int>(u));
        }
    }
    vector<int> orden;
    while (!cola.empty()) {
        int u = cola.front();
        cola.pop();
        orden.push_back(u);
        for (int v : g[static_cast<size_t>(u)]) {
            if (--gradoEntrada[static_cast<size_t>(v)] == 0) {
                cola.push(v);
            }
        }
    }
    if (orden.size() != g.size()) {
        throw logic_error("el grafo tiene un ciclo");
    }
    return orden;
}

/**
 * Dijkstra con montículo de mínimos.
 *
 * @complejidad Tiempo O((V + E) log V); espacio O(V + E).
 * @bigo nlogn
 * @explicacion Se saca siempre el nodo con la menor distancia provisional; como los pesos no son negativos, esa
 * distancia ya es definitiva y se "relajan" sus aristas: si `dist[u] + w < dist[v]`, se mejora v y se mete (d, v) en el
 * montículo. `priority_queue` no permite bajar una prioridad, así que quedan entradas viejas; al sacar una con `d > dist[u]`
 * se descarta. Se usa `greater<>` porque la `priority_queue` por defecto es de MÁXIMOS. Las distancias son `long long` y los
 * inalcanzables se quedan en LLONG_MAX (nunca se suma a ellos: solo se relaja desde nodos ya alcanzados).
 * @alternativas Con pesos negativos Dijkstra falla: Bellman-Ford. Con grafos densos (E ~ V²) una versión sin montículo
 * en O(V²) es mejor. Con pesos 0/1, un BFS con deque (0-1 BFS) da O(V + E).
 */
vector<long long> dijkstra(const GrafoPonderado& g, int origen) {
    if (origen < 0 || origen >= static_cast<int>(g.size())) {
        throw invalid_argument("el origen no existe");
    }
    for (const auto& vecinos : g) {
        for (const auto& [v, w] : vecinos) {
            if (w < 0) {
                throw invalid_argument("Dijkstra no admite pesos negativos");
            }
        }
    }
    vector<long long> dist(g.size(), LLONG_MAX);
    priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> cola;
    dist[static_cast<size_t>(origen)] = 0;
    cola.push({0, origen});
    while (!cola.empty()) {
        auto [d, u] = cola.top();
        cola.pop();
        if (d > dist[static_cast<size_t>(u)]) {
            continue;                                  // entrada vieja: ya se llegó aquí por un camino mejor
        }
        for (const auto& [v, w] : g[static_cast<size_t>(u)]) {
            if (d + w < dist[static_cast<size_t>(v)]) {
                dist[static_cast<size_t>(v)] = d + w;
                cola.push({d + w, v});
            }
        }
    }
    return dist;
}

/**
 * Bellman-Ford con detección de ciclo negativo.
 *
 * @complejidad Tiempo O(V · E); espacio O(V).
 * @explicacion Un camino mínimo sin ciclos usa como mucho n-1 aristas, así que n-1 pasadas relajando TODAS las aristas
 * bastan: tras la pasada k, las distancias por caminos de ≤ k aristas son correctas. Se para antes si una pasada no mejora
 * nada. Si la pasada n-ésima todavía mejora algo, hay un ciclo de peso negativo alcanzable desde el origen (cada vuelta
 * rebaja el coste): `logic_error`. No se relaja desde nodos con LLONG_MAX: `LLONG_MAX + w` desborda (UB con signo). Un ciclo
 * negativo que el origen no alcanza no afecta, porque sus nodos nunca dejan de valer LLONG_MAX.
 * @alternativas Dijkstra es más rápido pero exige pesos ≥ 0. SPFA (Bellman-Ford con cola) suele ir mucho más deprisa en la
 * práctica, aunque su peor caso es el mismo.
 */
vector<long long> bellmanFord(int n, const AristasP& aristas, int origen) {
    vector<long long> dist(static_cast<size_t>(n), LLONG_MAX);
    dist[static_cast<size_t>(origen)] = 0;
    for (int pasada = 0; pasada < n; pasada++) {
        bool mejora = false;
        for (const auto& [u, v, w] : aristas) {
            if (dist[static_cast<size_t>(u)] != LLONG_MAX && dist[static_cast<size_t>(u)] + w < dist[static_cast<size_t>(v)]) {
                dist[static_cast<size_t>(v)] = dist[static_cast<size_t>(u)] + w;
                mejora = true;
            }
        }
        if (!mejora) {
            return dist;
        }
    }
    throw logic_error("ciclo de peso negativo alcanzable");
}

/**
 * Floyd-Warshall (distancias entre todos los pares).
 *
 * @complejidad Tiempo O(V³); espacio O(V²).
 * @bigo n3
 * @explicacion Programación dinámica: tras procesar los nodos 0..k, `d[i][j]` es la menor distancia de i a j pasando solo
 * por intermedios del conjunto {0..k}. Añadir el nodo k permite el atajo `d[i][k] + d[k][j]`. El bucle de `k` TIENE que ser
 * el más externo; con `k` dentro se obtienen resultados incorrectos. Se saltan los pares con LLONG_MAX para no desbordar.
 * Si algún `d[i][i]` acaba siendo negativo, i está en un ciclo negativo.
 * @alternativas V ejecuciones de Dijkstra: O(V · E log V), mejor en grafos dispersos con pesos ≥ 0. Con ciclos negativos los
 * valores pueden crecer exponencialmente en negativo (de ahí que se compruebe y se lance antes de que se note).
 */
vector<vector<long long>> floydWarshall(int n, const AristasP& aristas) {
    size_t m = static_cast<size_t>(n);
    vector<vector<long long>> d(m, vector<long long>(m, LLONG_MAX));
    for (size_t i = 0; i < m; i++) {
        d[i][i] = 0;
    }
    for (const auto& [u, v, w] : aristas) {
        d[static_cast<size_t>(u)][static_cast<size_t>(v)] = min(d[static_cast<size_t>(u)][static_cast<size_t>(v)], static_cast<long long>(w));
    }
    for (size_t k = 0; k < m; k++) {
        for (size_t i = 0; i < m; i++) {
            if (d[i][k] == LLONG_MAX) {
                continue;
            }
            for (size_t j = 0; j < m; j++) {
                if (d[k][j] != LLONG_MAX && d[i][k] + d[k][j] < d[i][j]) {
                    d[i][j] = d[i][k] + d[k][j];
                }
            }
        }
        for (size_t i = 0; i < m; i++) {
            if (d[i][i] < 0) {
                throw logic_error("ciclo de peso negativo");
            }
        }
    }
    return d;
}

/**
 * Árbol de expansión mínimo con Kruskal y DSU.
 *
 * @complejidad Tiempo O(E log E); espacio O(V).
 * @bigo nlogn
 * @explicacion Es un algoritmo voraz: tomar siempre la arista más barata que no cierre un ciclo da el árbol mínimo. Se
 * ordenan las aristas por peso y se recorren; una arista sirve si sus extremos están en grupos distintos (raíces del DSU
 * distintas), y entonces se fusionan. Al llegar a n-1 aristas aceptadas se acaba. Si no se llega, el grafo no es conexo: -1.
 * Los bucles y las aristas paralelas más caras se descartan solos (extremos ya en el mismo grupo). El peso se acumula en
 * `long long` aunque cada arista sea `int`.
 * @alternativas Prim (con montículo) hace lo mismo O(E log V) y compensa en grafos densos. Con aristas ya ordenadas o pesos
 * pequeños, un counting sort evita el log.
 */
long long kruskal(int n, AristasP aristas) {
    sort(aristas.begin(), aristas.end(), [](const AristaP& x, const AristaP& y) { return get<2>(x) < get<2>(y); });
    vector<int> padre(static_cast<size_t>(n));
    iota(padre.begin(), padre.end(), 0);
    vector<int> tam(static_cast<size_t>(n), 1);
    // Raíz del grupo de x con compresión de caminos ("path halving"): cada nodo visitado se cuelga de su abuelo.
    // Iterativa a propósito: la versión recursiva puede agotar la pila con cadenas largas.
    auto raiz = [&padre](int x) {
        while (padre[static_cast<size_t>(x)] != x) {
            padre[static_cast<size_t>(x)] = padre[static_cast<size_t>(padre[static_cast<size_t>(x)])];
            x = padre[static_cast<size_t>(x)];
        }
        return x;
    };
    long long total = 0;
    int usadas = 0;
    for (const auto& [a, b, w] : aristas) {
        int ra = raiz(a);
        int rb = raiz(b);
        if (ra == rb) {
            continue;
        }
        if (tam[static_cast<size_t>(ra)] < tam[static_cast<size_t>(rb)]) {
            swap(ra, rb);
        }
        padre[static_cast<size_t>(rb)] = ra;
        tam[static_cast<size_t>(ra)] += tam[static_cast<size_t>(rb)];
        total += w;
        usadas++;
    }
    return (n == 0 || usadas == n - 1) ? total : -1;
}

/**
 * Árbol de expansión mínimo con Prim.
 *
 * @complejidad Tiempo O(E log V); espacio O(V + E).
 * @explicacion El árbol crece desde el nodo 0. El montículo de mínimos guarda aristas (peso, nodo) que salen del árbol; se
 * saca la más barata y, si su nodo todavía no está dentro, se añade (sumando su peso) y se meten sus aristas. Las entradas
 * hacia nodos ya dentro se descartan al sacarlas. Si al terminar hay menos de n nodos dentro, el grafo no es conexo: -1.
 * Es casi idéntico a Dijkstra: allí la prioridad es "distancia desde el origen"; aquí, "peso de la arista que conecta".
 * @alternativas Kruskal con DSU. Con matriz de adyacencia y sin montículo, Prim es O(V²), óptimo en grafos densos.
 */
long long prim(const GrafoPonderado& g) {
    if (g.empty()) {
        return 0;
    }
    vector<char> dentro(g.size(), 0);
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> cola;
    cola.push({0, 0});
    long long total = 0;
    size_t cuantos = 0;
    while (!cola.empty()) {
        auto [w, u] = cola.top();
        cola.pop();
        if (dentro[static_cast<size_t>(u)]) {
            continue;
        }
        dentro[static_cast<size_t>(u)] = 1;
        total += w;
        cuantos++;
        for (const auto& [v, peso] : g[static_cast<size_t>(u)]) {
            if (!dentro[static_cast<size_t>(v)]) {
                cola.push({peso, v});
            }
        }
    }
    return cuantos == g.size() ? total : -1;
}

/**
 * Componentes fuertemente conexas (Tarjan).
 *
 * @complejidad Tiempo O(V + E); espacio O(V).
 * @explicacion Un solo DFS por componente conexa del grafo, lanzado desde cada nodo sin visitar. Tarjan cierra las
 * componentes en orden topológico inverso; para que el resultado sea único se ordenan los nodos dentro de cada una y las
 * componentes por su primer nodo. Es recursivo: con cadenas de cientos de miles de nodos habría que pasarlo a pila explícita.
 * @alternativas Kosaraju: DFS para obtener el orden de salida, DFS sobre el grafo TRASPUESTO en ese orden; también O(V + E)
 * y más fácil de recordar, pero recorre el grafo dos veces y necesita construir el traspuesto.
 */
vector<vector<int>> componentesFuertes(const Grafo& g) {
    vector<int> indice(g.size(), -1);
    vector<int> bajo(g.size(), 0);
    vector<char> enPila(g.size(), 0);
    vector<int> pila;
    vector<vector<int>> componentes;
    int reloj = 0;
    // `indice[u]` numera los nodos en orden de descubrimiento; `bajo[u]` es el menor índice alcanzable desde u usando su
    // subárbol DFS y, como mucho, una arista hacia un nodo que SIGA en la pila. Una arista a un nodo visitado que ya no
    // está en la pila (de una componente ya cerrada) se ignora. Si bajo[u] == indice[u], u es la raíz de una componente
    // y todo lo apilado desde u hacia arriba pertenece a ella.
    function<void(int)> visita = [&](int u) {
        size_t su = static_cast<size_t>(u);
        indice[su] = bajo[su] = reloj++;
        pila.push_back(u);
        enPila[su] = 1;
        for (int v : g[su]) {
            size_t sv = static_cast<size_t>(v);
            if (indice[sv] == -1) {
                visita(v);
                bajo[su] = min(bajo[su], bajo[sv]);
            } else if (enPila[sv]) {
                bajo[su] = min(bajo[su], indice[sv]);
            }
        }
        if (bajo[su] == indice[su]) {
            vector<int> componente;
            int w;
            do {
                w = pila.back();
                pila.pop_back();
                enPila[static_cast<size_t>(w)] = 0;
                componente.push_back(w);
            } while (w != u);
            sort(componente.begin(), componente.end());
            componentes.push_back(componente);
        }
    };
    for (size_t u = 0; u < g.size(); u++) {
        if (indice[u] == -1) {
            visita(static_cast<int>(u));
        }
    }
    sort(componentes.begin(), componentes.end());
    return componentes;
}

/**
 * Grafo bipartito (BFS con dos colores).
 *
 * @complejidad Tiempo O(V + E); espacio O(V).
 * @explicacion Se colorea cada nodo con 0 o 1 y a cada vecino se le da el color contrario. Si aparece un vecino ya
 * coloreado igual que el nodo actual, hay un ciclo impar y no es bipartito. Se lanza un BFS desde cada nodo sin color para
 * cubrir todas las componentes. Un bucle (u, u) se detecta solo: u es vecino de sí mismo con su mismo color.
 * @alternativas DFS con la misma idea. DSU con "nodo y su contrario" (2n elementos). Es equivalente a "sin ciclos impares".
 */
bool esBipartito(const Grafo& g) {
    vector<int> color(g.size(), -1);
    for (size_t inicio = 0; inicio < g.size(); inicio++) {
        if (color[inicio] != -1) {
            continue;
        }
        color[inicio] = 0;
        queue<int> cola;
        cola.push(static_cast<int>(inicio));
        while (!cola.empty()) {
            int u = cola.front();
            cola.pop();
            for (int v : g[static_cast<size_t>(u)]) {
                if (color[static_cast<size_t>(v)] == -1) {
                    color[static_cast<size_t>(v)] = 1 - color[static_cast<size_t>(u)];
                    cola.push(v);
                } else if (color[static_cast<size_t>(v)] == color[static_cast<size_t>(u)]) {
                    return false;
                }
            }
        }
    }
    return true;
}

/**
 * Ciclo en un grafo dirigido (DFS iterativo con tres estados).
 *
 * @complejidad Tiempo O(V + E); espacio O(V).
 * @explicacion Cada nodo está SIN VISITAR (0), EN PROCESO (1: en el camino actual) o TERMINADO (2). La pila guarda pares
 * (nodo, índice del siguiente vecino por mirar) para poder "volver" a un nodo y retomarlo, imitando la recursión sin
 * consumir pila de llamadas. Una arista hacia un nodo EN PROCESO cierra un ciclo; hacia uno TERMINADO es inocua (un rombo
 * no es un ciclo). Cuando un nodo agota sus vecinos pasa a TERMINADO y se desapila.
 * @alternativas El orden topológico de Kahn: si no saca todos los nodos, hay ciclo. En grafos NO dirigidos basta un DSU
 * (una arista entre dos nodos ya unidos cierra un ciclo).
 */
bool tieneCiclo(const Grafo& g) {
    vector<char> estado(g.size(), 0);
    for (size_t inicio = 0; inicio < g.size(); inicio++) {
        if (estado[inicio] != 0) {
            continue;
        }
        vector<pair<int, size_t>> pila;
        pila.push_back({static_cast<int>(inicio), 0});
        estado[inicio] = 1;
        while (!pila.empty()) {
            auto& [u, siguiente] = pila.back();
            const vector<int>& vecinos = g[static_cast<size_t>(u)];
            if (siguiente < vecinos.size()) {
                int v = vecinos[siguiente++];
                if (estado[static_cast<size_t>(v)] == 1) {
                    return true;
                }
                if (estado[static_cast<size_t>(v)] == 0) {
                    estado[static_cast<size_t>(v)] = 1;
                    pila.push_back({v, 0});             // invalida la referencia `u`/`siguiente`: no se usa más en esta vuelta
                }
            } else {
                estado[static_cast<size_t>(u)] = 2;
                pila.pop_back();
            }
        }
    }
    return false;
}
