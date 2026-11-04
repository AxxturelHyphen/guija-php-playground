#include <algorithm>
#include <bitset>
#include <climits>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 9 · Programación dinámica
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Escaleras de 1 o 2 pasos con dos variables.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion pasos(n) = pasos(n-1) + pasos(n-2) con pasos(0) = pasos(1) = 1: es Fibonacci. Como cada celda solo mira las
 * dos anteriores, bastan dos variables en vez de una tabla. La suma se hace con `__builtin_add_overflow`, que detecta el
 * desbordamiento SIN producirlo: con `+` un `long long` desbordado es comportamiento indefinido (el compilador puede asumir que
 * no ocurre), y un `long long` solo llega a escaleras(91).
 * @alternativas Recursión con memoización (O(n) de espacio y de pila) o la recursión ingenua (O(2ⁿ)). Exponenciación de matrices
 * 2×2 en O(log n). Para n enormes, aritmética modular o enteros de precisión arbitraria (no hay en la biblioteca estándar).
 */
long long escaleras(int n) {
    if (n < 0) {
        throw invalid_argument("n no puede ser negativo");
    }
    long long anterior = 1;
    long long actual = 1;
    for (int i = 2; i <= n; i++) {
        long long siguiente;
        if (__builtin_add_overflow(anterior, actual, &siguiente)) {
            throw overflow_error("el resultado no cabe en un long long");
        }
        anterior = actual;
        actual = siguiente;
    }
    return actual;
}

/**
 * Cambio de monedas mínimo (DP).
 *
 * @complejidad Tiempo O(objetivo · monedas); espacio O(objetivo).
 * @bigo n
 * @explicacion `minimo[c]` es el menor número de monedas para sumar c. Se parte de `minimo[0] = 0` y cada cantidad se calcula
 * probando cada moneda: `1 + minimo[c - moneda]`. Las cantidades imposibles se marcan con un "infinito" que se puede sumar
 * (`objetivo + 1`, que nunca es un resultado válido) y NO con `INT_MAX`, porque sumarle 1 desbordaría (UB) y ganaría todas las
 * comparaciones. Una moneda ≤ 0 se rechaza: con 0 no se avanza nunca y con negativas `c - moneda` se sale de la tabla.
 * @alternativas El algoritmo voraz falla con monedas como {1, 3, 4}. La recursión con memoización es equivalente pero apila marcos
 * (con objetivos grandes, desbordamiento de pila = segfault).
 */
int cambioMonedas(const vector<int>& monedas, int objetivo) {
    if (objetivo < 0) {
        throw invalid_argument("La cantidad no puede ser negativa");
    }
    for (int moneda : monedas) {
        if (moneda <= 0) {
            throw invalid_argument("Las monedas deben ser positivas");
        }
    }
    int infinito = objetivo + 1;
    vector<int> minimo(static_cast<size_t>(objetivo) + 1, infinito);
    minimo[0] = 0;
    for (int c = 1; c <= objetivo; c++) {
        for (int moneda : monedas) {
            if (moneda <= c && minimo[static_cast<size_t>(c - moneda)] + 1 < minimo[static_cast<size_t>(c)]) {
                minimo[static_cast<size_t>(c)] = minimo[static_cast<size_t>(c - moneda)] + 1;
            }
        }
    }
    return minimo[static_cast<size_t>(objetivo)] >= infinito ? -1 : minimo[static_cast<size_t>(objetivo)];
}

/**
 * Mochila 0/1 con una tabla de una dimensión.
 *
 * @complejidad Tiempo O(objetos · capacidad); espacio O(capacidad).
 * @bigo n
 * @explicacion `mejor[w]` es el mayor valor con capacidad w. Para cada objeto se recorre w de MAYOR a menor: así `mejor[w - peso]`
 * todavía no incluye este objeto y no se usa dos veces. Si se recorriera de menor a mayor se obtendría la mochila "con
 * repetición" (cada objeto ilimitado), que es otro problema. El contador es `int`, no `size_t`: con `size_t` un bucle
 * descendente `w >= peso` con peso 0 no terminaría nunca (un sin signo no baja de 0).
 * @alternativas Tabla bidimensional objetos × capacidad: O(objetos · capacidad) de espacio, pero permite reconstruir qué objetos se
 * cogen. Fuerza bruta sobre los 2ⁿ subconjuntos. Si las capacidades son enormes y los valores pequeños, se invierte la tabla
 * (dp[valor] = peso mínimo).
 */
int mochila(const vector<int>& pesos, const vector<int>& valores, int capacidad) {
    if (pesos.size() != valores.size()) {
        throw invalid_argument("pesos y valores deben tener la misma longitud");
    }
    if (capacidad < 0) {
        throw invalid_argument("la capacidad no puede ser negativa");
    }
    vector<int> mejor(static_cast<size_t>(capacidad) + 1, 0);
    for (size_t i = 0; i < pesos.size(); i++) {
        for (int w = capacidad; w >= pesos[i]; w--) {
            mejor[static_cast<size_t>(w)] = max(mejor[static_cast<size_t>(w)], mejor[static_cast<size_t>(w - pesos[i])] + valores[i]);
        }
    }
    return mejor[static_cast<size_t>(capacidad)];
}

/**
 * Subsecuencia común más larga con dos filas.
 *
 * @complejidad Tiempo O(n · m); espacio O(m).
 * @bigo n2
 * @explicacion `anterior[j]` y `actual[j]` guardan la longitud de la LCS entre los i-1 (o i) primeros caracteres de `a` y los j
 * primeros de `b`. Si `a[i-1] == b[j-1]` se extiende la diagonal (`anterior[j-1] + 1`); si no, se toma el mejor de arriba
 * (`anterior[j]`) o de la izquierda (`actual[j-1]`). Al acabar cada fila, `swap` intercambia los dos vectores en O(1) (sin copiar).
 * La fila 0 y la columna 0 son los prefijos vacíos: todo ceros, de ahí el `- 1` al indexar los textos.
 * @alternativas Tabla completa (n+1)×(m+1), necesaria si hay que reconstruir la subsecuencia en sí. Hirschberg reconstruye en
 * espacio lineal. Para alfabetos pequeños y textos enormes, algoritmos con bits (bit-parallel LCS) dividen el tiempo por 64.
 */
int lcs(const string& a, const string& b) {
    vector<int> anterior(b.size() + 1, 0);
    vector<int> actual(b.size() + 1, 0);
    for (size_t i = 1; i <= a.size(); i++) {
        for (size_t j = 1; j <= b.size(); j++) {
            actual[j] = a[i - 1] == b[j - 1] ? anterior[j - 1] + 1 : max(anterior[j], actual[j - 1]);
        }
        swap(anterior, actual);
    }
    return anterior[b.size()];
}

/**
 * Distancia de Levenshtein con dos filas.
 *
 * @complejidad Tiempo O(n · m); espacio O(m).
 * @bigo n2
 * @explicacion `anterior[j]` es la distancia entre los i-1 primeros caracteres de `a` y los j primeros de `b`. La columna 0 es
 * convertir un prefijo de `a` en el texto vacío (i borrados) y la fila 0 construir un prefijo de `b` desde cero (j inserciones).
 * Si los caracteres coinciden, no cuesta nada (diagonal); si no, 1 más el mejor de borrar (arriba), insertar (izquierda) o
 * sustituir (diagonal). `min({x, y, z})` con llaves admite tres valores del mismo tipo. Con `swap` se alternan las dos filas.
 * @alternativas Tabla completa para reconstruir qué operaciones se aplicaron. Recursión con memoización (más lenta y con
 * riesgo de pila). Damerau-Levenshtein añade transposiciones; con umbral máximo k se puede hacer en O(k · n).
 */
int distanciaEdicion(const string& a, const string& b) {
    vector<int> anterior(b.size() + 1);
    vector<int> actual(b.size() + 1);
    for (size_t j = 0; j <= b.size(); j++) {
        anterior[j] = static_cast<int>(j);
    }
    for (size_t i = 1; i <= a.size(); i++) {
        actual[0] = static_cast<int>(i);
        for (size_t j = 1; j <= b.size(); j++) {
            actual[j] = a[i - 1] == b[j - 1] ? anterior[j - 1] : 1 + min({anterior[j], actual[j - 1], anterior[j - 1]});
        }
        swap(anterior, actual);
    }
    return anterior[b.size()];
}

/**
 * Subsecuencia creciente más larga en O(n log n).
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @bigo nlogn
 * @explicacion `colas[k]` es el menor valor con el que puede terminar una subsecuencia estrictamente creciente de longitud k+1.
 * Ese vector siempre queda ordenado, así que para cada `x` se busca con `lower_bound` (búsqueda binaria) la primera cola ≥ x:
 * si no hay ninguna, `x` alarga la mejor secuencia y se añade; si la hay, se sustituye por `x` (acabar en un valor menor
 * deja más opciones para seguir creciendo). La longitud final de `colas` es la respuesta, pero `colas` NO es una subsecuencia
 * real. `lower_bound` hace la comparación estricta; `upper_bound` admitiría iguales (no decreciente).
 * @alternativas DP clásica dp[i] = 1 + max(dp[j]) para j < i con v[j] < v[i]: O(n²), pero permite reconstruir la secuencia con un
 * vector de padres. Con guardar además los índices en `colas` y un vector `padre`, también se reconstruye en O(n log n).
 */
int lis(const vector<int>& v) {
    vector<int> colas;
    for (int x : v) {
        auto it = lower_bound(colas.begin(), colas.end(), x);
        if (it == colas.end()) {
            colas.push_back(x);
        } else {
            *it = x;
        }
    }
    return static_cast<int>(colas.size());
}

/**
 * Viajante de comercio con DP sobre subconjuntos.
 *
 * @complejidad Tiempo O(2ⁿ · n²); espacio O(2ⁿ · n).
 * @explicacion La máscara tiene un bit por ciudad (1 = visitada). `dp[mascara][u]` es el coste mínimo de salir de la 0, visitar
 * justo las ciudades de `mascara` y estar en u. Se parte de `dp[1][0] = 0` y se avanza de máscara menor a mayor (añadir un bit
 * siempre da un número mayor, así que todo estado está listo cuando se necesita). Desde cada estado alcanzable se prueba ir a
 * cada ciudad `v` aún no visitada. Al final se cierra el ciclo volviendo a la 0. El "infinito" es `INT_MAX / 2` para poder
 * sumarle una distancia sin desbordar, y los estados inalcanzables se saltan. Se usa `1 << i` con i ≤ 19, que cabe en un int.
 * @alternativas Fuerza bruta con permutaciones: O(n!) (inviable desde n ≈ 12). Para n grande, heurísticas o aproximaciones
 * (vecino más cercano, 2-opt, Christofides); el problema es NP-difícil. Con n ≤ 20 y memoria justa, dp con `int` de 2²⁰×20 = 80 MB.
 */
int tspBitmask(const vector<vector<int>>& dist) {
    size_t ciudades = dist.size();
    for (const auto& fila : dist) {
        if (fila.size() != ciudades) {
            throw invalid_argument("la matriz de distancias debe ser cuadrada");
        }
    }
    if (ciudades > 20) {
        throw invalid_argument("demasiadas ciudades para la DP con bitmask");
    }
    if (ciudades <= 1) {
        return 0;
    }
    const int infinito = INT_MAX / 2;
    size_t estados = size_t{1} << ciudades;
    vector<vector<int>> dp(estados, vector<int>(ciudades, infinito));
    dp[1][0] = 0;
    for (size_t mascara = 1; mascara < estados; mascara++) {
        for (size_t u = 0; u < ciudades; u++) {
            if (dp[mascara][u] >= infinito || !(mascara & (size_t{1} << u))) {
                continue;
            }
            for (size_t v = 0; v < ciudades; v++) {
                if (mascara & (size_t{1} << v)) {
                    continue;
                }
                size_t nueva = mascara | (size_t{1} << v);
                dp[nueva][v] = min(dp[nueva][v], dp[mascara][u] + dist[u][v]);
            }
        }
    }
    int mejor = infinito;
    for (size_t u = 1; u < ciudades; u++) {
        mejor = min(mejor, dp[estados - 1][u] + dist[u][0]);
    }
    return mejor;
}

/**
 * Multiplicación de cadena de matrices (DP de intervalos).
 *
 * @complejidad Tiempo O(k³); espacio O(k²).
 * @bigo n3
 * @explicacion `dp[i][j]` es el coste mínimo de multiplicar las matrices i..j (la i es dims[i] × dims[i+1]). Un tramo de una sola
 * matriz cuesta 0. Para un tramo mayor se prueba cada punto de corte `k`: se multiplican i..k y k+1..j por separado y luego los
 * dos resultados (dims[i] × dims[k+1] por dims[k+1] × dims[j+1]: dims[i]·dims[k+1]·dims[j+1] productos). Como cada tramo depende de
 * tramos MÁS CORTOS, se rellena por longitud creciente, no por filas. Los productos se calculan en `long long` (con `int`,
 * tres dimensiones de 2000 ya desbordan).
 * @alternativas Recursión con memoización (misma complejidad, riesgo de pila). Knuth/Hu-Shing bajan el coste a O(k²) o O(k log k) con
 * condiciones adicionales. La misma plantilla resuelve "partir una cuerda", "triangulación de polígono" o "quitar globos".
 */
long long multiplicacionMatrices(const vector<int>& dims) {
    for (int d : dims) {
        if (d <= 0) {
            throw invalid_argument("las dimensiones deben ser positivas");
        }
    }
    if (dims.size() < 3) {
        return 0;
    }
    size_t k = dims.size() - 1;
    vector<vector<long long>> dp(k, vector<long long>(k, 0));
    for (size_t largo = 2; largo <= k; largo++) {
        for (size_t i = 0; i + largo <= k; i++) {
            size_t j = i + largo - 1;
            long long mejor = LLONG_MAX;
            for (size_t corte = i; corte < j; corte++) {
                long long coste = dp[i][corte] + dp[corte + 1][j]
                    + static_cast<long long>(dims[i]) * dims[corte + 1] * dims[j + 1];
                mejor = min(mejor, coste);
            }
            dp[i][j] = mejor;
        }
    }
    return dp[0][k - 1];
}

/**
 * Caminos en una rejilla con obstáculos (una fila, módulo 10⁹+7).
 *
 * @complejidad Tiempo O(filas · columnas); espacio O(columnas).
 * @bigo n
 * @explicacion `camino[c]` guarda los caminos hasta la celda de la fila actual y columna c. Al procesar (f, c), `camino[c]`
 * todavía vale lo de la fila anterior (arriba) y `camino[c-1]` ya es el de esta fila (izquierda), así que sumarlos da la celda
 * nueva: `camino[c] += camino[c-1]`. Un obstáculo pone la celda a 0, que "corta" los caminos que pasarían por ella. La suma de
 * dos valores < 10⁹+7 cabe de sobra en `long long` y se reduce con `%` en cada paso para que nunca crezca. Como todo son
 * sumas de números no negativos, el resto nunca es negativo (con restas habría que corregirlo con `+ MOD`).
 * @alternativas Tabla completa (filas × columnas), necesaria si hay que reconstruir un camino. Sin obstáculos, la fórmula
 * cerrada C(f+c-2, f-1) con inversos modulares da O(f + c).
 */
int caminosRejilla(const vector<string>& rejilla) {
    const long long MOD = 1000000007LL;
    if (rejilla.empty() || rejilla[0].empty()) {
        return 0;
    }
    size_t columnas = rejilla[0].size();
    vector<long long> camino(columnas, 0);
    camino[0] = rejilla[0][0] == '#' ? 0 : 1;
    for (size_t f = 0; f < rejilla.size(); f++) {
        for (size_t c = 0; c < columnas; c++) {
            if (rejilla[f][c] == '#') {
                camino[c] = 0;
            } else if (c > 0) {
                camino[c] = (camino[c] + camino[c - 1]) % MOD;
            }
        }
    }
    return static_cast<int>(camino[columnas - 1]);
}

/**
 * Partición en dos grupos de igual suma con un bitset.
 *
 * @complejidad Tiempo O(n · suma / 64); espacio O(suma / 64).
 * @explicacion El bit s de `posibles` vale 1 si algún subconjunto de los números vistos suma s. Al añadir un número x, las
 * sumas nuevas son las antiguas más x: `posibles |= posibles << x` (todo el desplazamiento y la O se hacen 64 bits por
 * instrucción). Si la suma total es impar no hay reparto posible; si es par, basta mirar el bit total/2. Se valida antes de
 * desplazar: negativos no tienen sentido en este esquema y una suma mayor que el bitset lo dejaría pequeño. `test()` lanza
 * `out_of_range` si el índice no cabe, mientras que `operator[]` sería comportamiento indefinido.
 * @alternativas `vector<bool>` o `vector<char>` con un bucle descendente por número: O(n · suma), 64 veces más lento. Con sumas
 * enormes, "meet in the middle" (dividir en dos mitades) o aproximaciones.
 */
bool particionIgual(const vector<int>& v) {
    long long total = 0;
    for (int x : v) {
        if (x < 0) {
            throw invalid_argument("los números no pueden ser negativos");
        }
        total += x;
    }
    if (total > 100000) {
        throw invalid_argument("la suma total no puede pasar de 100000");
    }
    if (total % 2 != 0) {
        return false;
    }
    bitset<50001> posibles;
    posibles[0] = 1;
    for (int x : v) {
        posibles |= posibles << static_cast<size_t>(x);
    }
    return posibles.test(static_cast<size_t>(total / 2));
}
