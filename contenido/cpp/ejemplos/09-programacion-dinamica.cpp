#include <algorithm>
#include <bitset>
#include <climits>
#include <cmath>
#include <functional>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

/*
 * TEMA 9 · PROGRAMACIÓN DINÁMICA (DP)
 * ────────────────────────────────────────────────────────────────────────────
 * Cuando un problema se descompone en SUBPROBLEMAS QUE SE REPITEN, se resuelve cada uno una sola vez y se guarda su
 * resultado. Una recursión ingenua que tardaba O(2ⁿ) pasa a O(n) o O(n²). Dos condiciones para que se pueda aplicar DP:
 *   - SUBESTRUCTURA ÓPTIMA: la solución buena del problema grande se construye con soluciones buenas de los pequeños.
 *   - SUBPROBLEMAS SUPERPUESTOS: los mismos subproblemas aparecen una y otra vez (si no, basta divide y vencerás).
 *
 * LA RECETA (siempre la misma):
 *   1. ESTADO: ¿qué datos identifican un subproblema? (el índice i, la capacidad restante, los dos prefijos i y j...)
 *      Define en una frase qué guarda cada celda: «dp[c] = menor nº de monedas para sumar exactamente c».
 *   2. TRANSICIÓN: cómo se calcula un estado a partir de otros más pequeños (la fórmula de recurrencia).
 *   3. CASOS BASE: los estados que se saben sin calcular (dp[0] = 0).
 *   4. ORDEN: en qué orden rellenar para que lo que necesitas ya esté calculado.
 *   5. RESPUESTA: qué celda (o qué máximo/mínimo de celdas) es la solución.
 *
 * DOS FORMAS EQUIVALENTES:
 *   - TOP-DOWN (memoización): recursión + una tabla donde guardar lo ya calculado. Fácil de escribir (la fórmula tal
 *     cual) y solo calcula los estados que se necesitan, pero cada llamada gasta pila y en C++ se cae con recursión
 *     muy profunda (no hay excepción: segmentation fault).
 *   - BOTTOM-UP (tabulación): rellenar la tabla con bucles desde los casos base. Sin recursión, más rápido (acceso
 *     contiguo a memoria, sin llamadas) y permite OPTIMIZAR MEMORIA quedándose solo con las filas que hacen falta.
 *
 *   Problema                          Estado                      Tiempo             Espacio (optimizado)
 *   Escaleras / Fibonacci             dp[i]                       O(n)               O(1)
 *   Cambio de monedas                 dp[cantidad]                O(objetivo·m)      O(objetivo)
 *   Mochila 0/1                       dp[capacidad]               O(objetos·cap)     O(cap)
 *   Subsecuencia común (LCS)          dp[i][j]                    O(n·m)             O(m)
 *   Distancia de edición              dp[i][j]                    O(n·m)             O(m)
 *   Subsecuencia creciente (LIS)      cola de colas mínimas       O(n log n)         O(n)
 *   Viajante con bitmask (TSP)        dp[subconjunto][último]     O(2ⁿ·n²)           O(2ⁿ·n)
 *   Multiplicar matrices (intervalos) dp[i][j]                    O(n³)              O(n²)
 *   Caminos en rejilla                dp[fila][col]               O(filas·cols)      O(cols)
 *   Partición / subset sum            bitset de sumas posibles    O(n·suma/64)       O(suma/64)
 *
 * CÓMO SE TRABAJA. Ctrl+Enter ejecuta: la teoría sale por pantalla y los ejercicios aparecen «pendientes». Sustituye
 * `return pendiente();` por tu código y vuelve a ejecutar. Ctrl+S guarda tu versión; «Solución» la compara con la de
 * referencia.
 */

void titulo(const string& texto) {
    cout << "\n=== " << texto << " ===\n";
}

/*
 * ── TEORÍA 1 · FIBONACCI DE TRES FORMAS ─────────────────────────────────────
 * Desde Java/PHP/Python: en Python se memoiza con @lru_cache; en Java con un HashMap; en C++ no hay decorador: se
 * pasa la tabla por referencia o se usa una lambda que la captura. Un `vector` indexado por el estado es lo más rápido
 * (el estado casi siempre es un entero pequeño); un `unordered_map` solo si los estados son enormes y dispersos.
 * Desde C: es el array estático `long long memo[100]`, pero con tamaño dinámico y sin memset a mano.
 *
 * TRAMPA: ¿cómo distingues «no calculado» de «el resultado es 0»? Con un valor CENTINELA que no pueda ser respuesta
 * (-1 si los resultados son ≥ 0). `vector<long long> memo(n + 1, -1)` lo deja todo marcado de golpe.
 */

/** Recursión ingenua: recalcula los mismos subproblemas una y otra vez. Cuenta las llamadas. O(2ⁿ). */
long long fibIngenuo(int n, long long& llamadas) {
    llamadas++;
    return n < 2 ? n : fibIngenuo(n - 1, llamadas) + fibIngenuo(n - 2, llamadas);
}

/** Top-down: la misma recursión, pero cada fib(k) se calcula UNA vez. O(n) de tiempo y de espacio (tabla + pila). */
long long fibMemo(int n, vector<long long>& memo, long long& llamadas) {
    llamadas++;
    if (n < 2) {
        return n;
    }
    if (memo[static_cast<size_t>(n)] != -1) {
        return memo[static_cast<size_t>(n)];            // ya calculado: se devuelve sin recursar
    }
    long long valor = fibMemo(n - 1, memo, llamadas) + fibMemo(n - 2, memo, llamadas);
    memo[static_cast<size_t>(n)] = valor;               // se guarda DESPUÉS de calcular (no uses una referencia a memo[n] antes de recursar)
    return valor;
}

/** Bottom-up: una tabla rellenada desde los casos base. Sin recursión. O(n) de tiempo y de espacio. */
long long fibTabla(int n) {
    vector<long long> tabla(static_cast<size_t>(max(n + 1, 2)), 0);
    tabla[1] = 1;
    for (int i = 2; i <= n; i++) {
        tabla[static_cast<size_t>(i)] = tabla[static_cast<size_t>(i) - 1] + tabla[static_cast<size_t>(i) - 2];
    }
    return tabla[static_cast<size_t>(n)];
}

/** Bottom-up optimizado: cada celda solo mira las dos anteriores, así que se guardan solo ESAS. O(n) y O(1). */
long long fibDosVariables(int n) {
    long long anterior = 0;
    long long actual = 1;
    for (int i = 0; i < n; i++) {
        long long siguiente = anterior + actual;        // fib(93) ya no cabe en un long long: UB con signo, no excepción
        anterior = actual;
        actual = siguiente;
    }
    return anterior;
}

/*
 * ── TEORÍA 2 · ESTADOS Y TRANSICIONES: «EL LADRÓN DE CASAS» ─────────────────
 * Una calle con n casas; la casa i tiene valor v[i]. No puedes robar dos casas seguidas. ¿Máximo botín?
 *   Estado:      mejor[i] = máximo botín considerando solo las casas 0..i-1.
 *   Transición:  o NO robas la casa i-1 → mejor[i-1];  o la robas → mejor[i-2] + v[i-1].  Nos quedamos con el máximo.
 *   Base:        mejor[0] = 0 (sin casas), mejor[1] = v[0].
 *   Respuesta:   mejor[n].
 * Es la forma de pensar de TODA la DP: en cada paso hay una decisión (coger / no coger) y la tabla guarda el mejor
 * resultado de las decisiones anteriores.
 */
long long botinMaximoTabla(const vector<int>& v) {
    size_t cuantas = v.size();
    vector<long long> mejor(cuantas + 1, 0);
    if (cuantas > 0) {
        mejor[1] = v[0];
    }
    for (size_t i = 2; i <= cuantas; i++) {
        mejor[i] = max(mejor[i - 1], mejor[i - 2] + v[i - 1]);
    }
    return mejor[cuantas];
}

/** Lo mismo con SOLO dos variables (la tabla solo mira las dos celdas anteriores): espacio O(1). */
long long botinMaximoO1(const vector<int>& v) {
    long long dosAntes = 0;
    long long antes = 0;
    for (int casa : v) {
        long long ahora = max(antes, dosAntes + casa);
        dosAntes = antes;
        antes = ahora;
    }
    return antes;
}

/** Lo mismo top-down con una lambda recursiva (necesita std::function para poder llamarse a sí misma). */
long long botinMaximoMemo(const vector<int>& v) {
    vector<long long> memo(v.size() + 1, -1);
    function<long long(int)> mejor = [&](int i) -> long long {   // mejor(i): botín con las casas 0..i-1
        if (i <= 0) {
            return 0;
        }
        if (memo[static_cast<size_t>(i)] != -1) {
            return memo[static_cast<size_t>(i)];
        }
        return memo[static_cast<size_t>(i)] = max(mejor(i - 1), mejor(i - 2) + v[static_cast<size_t>(i) - 1]);
    };
    return mejor(static_cast<int>(v.size()));
}

/*
 * ── TEORÍA 3 · OPTIMIZACIÓN DE MEMORIA ──────────────────────────────────────
 * Si dp[i] solo depende de dp[i-1] (o de las k filas anteriores), no hace falta guardar toda la tabla:
 *   - «Dos filas»: dp[i][j] mira solo la fila i-1 → dos vectores (`anterior` y `actual`) que se intercambian con swap.
 *   - «Una fila»: si además se recorre en el SENTIDO correcto, se actualiza la misma fila en el sitio. Mochila 0/1: de
 *     MAYOR a menor capacidad (cada objeto se usa una vez). Monedas ilimitadas: de menor a mayor (puede repetirse).
 * Precio: pierdes la tabla completa, así que ya no puedes RECONSTRUIR la solución (qué objetos cogiste, el alineamiento
 * de LCS...). Si te piden la solución y no solo su valor, guarda la tabla entera (o usa el truco de Hirschberg).
 */

/** Número de formas DISTINTAS de sumar `objetivo` con monedas ilimitadas (el orden NO importa) en una sola fila. */
long long formasDeCambio(const vector<int>& monedas, int objetivo) {
    vector<long long> formas(static_cast<size_t>(objetivo) + 1, 0);
    formas[0] = 1;
    for (int moneda : monedas) {                        // moneda por FUERA: así {1,2} y {2,1} cuentan como una sola forma
        for (int c = moneda; c <= objetivo; c++) {      // menor a mayor: la misma moneda puede usarse varias veces
            formas[static_cast<size_t>(c)] += formas[static_cast<size_t>(c - moneda)];
        }
    }
    return formas[static_cast<size_t>(objetivo)];
}

/*
 * ── TEORÍA 4 · DP AVANZADA: LAS TRES TÉCNICAS QUE SE PIDEN EN CONCURSOS ─────
 *   - BITMASK: el estado incluye un SUBCONJUNTO de elementos (n ≤ 20), codificado como un entero de n bits:
 *     el bit i vale 1 si el elemento i ya está usado. `mascara & (1 << i)` pregunta, `mascara | (1 << i)` añade.
 *     Hay 2ⁿ subconjuntos: sirve para el viajante (TSP), asignaciones, cubrir conjuntos.
 *     TRAMPA: `1 << 31` desborda un int con signo (UB); con n ≥ 31 usa `1LL << i` o `1u << i`.
 *   - INTERVALOS: dp[i][j] = mejor resultado para el tramo i..j; se rellena por LONGITUD creciente del tramo (no por
 *     filas) porque cada tramo se parte en dos tramos más cortos: dp[i][j] = min sobre k de dp[i][k] + dp[k+1][j] + coste.
 *   - BITSET: para «¿se puede sumar exactamente s?» basta un bitset donde el bit s vale 1 si la suma s es alcanzable;
 *     añadir un número x es `posibles |= posibles << x`, y desplaza 64 sumas por instrucción: n·S/64 operaciones.
 */

/** Devuelve cuántos bits a 1 tiene un número (subconjuntos de una máscara): __builtin_popcount hace lo mismo más rápido. */
int cuentaBits(unsigned mascara) {
    int total = 0;
    for (; mascara; mascara &= mascara - 1) {           // apaga el bit más bajo en cada vuelta
        total++;
    }
    return total;
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS · PROGRAMACIÓN DINÁMICA
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · escaleras ─────────────────────────────────────────────────
/**
 * ¿De cuántas formas se sube una escalera de n peldaños dando pasos de 1 o 2? (escaleras(0) = 1, escaleras(1) = 1,
 * escaleras(2) = 2, escaleras(3) = 3, escaleras(5) = 8...). Valores negativos → invalid_argument.
 * Es Fibonacci disfrazado: pasos(n) = pasos(n-1) + pasos(n-2). Hazlo en O(n) de tiempo y O(1) de espacio
 * guardando solo las dos últimas celdas.
 * Trampa de C++: un long long solo llega a escaleras(91); con n = 92 la suma desborda y, al ser un entero CON SIGNO,
 * es comportamiento indefinido (no una excepción ni un número negativo garantizado). Detecta el desbordamiento ANTES de
 * sumar con `__builtin_add_overflow(a, b, &resultado)` (GCC/Clang) y lanza overflow_error.
 */
long long escaleras(int n) {
    return pendiente();
}

// ── Ejercicio 2 · cambioMonedas ─────────────────────────────────────────────
/**
 * Menor número de monedas que suman exactamente `objetivo`, o -1 si es imposible. Cada moneda se puede usar
 * todas las veces que haga falta. Un objetivo negativo o una moneda ≤ 0 → invalid_argument.
 * ¡El algoritmo voraz (coger siempre la moneda mayor) FALLA! Con {1, 3, 4} y 6 daría 4+1+1 (3 monedas) y lo mejor
 * es 3+3 (2). Tabla: `minimo[c]` = monedas necesarias para sumar c; minimo[0] = 0;
 * minimo[c] = 1 + min(minimo[c - moneda]) para cada moneda ≤ c. O(objetivo · monedas).
 * Trampa: si marcas "imposible" con INT_MAX, `INT_MAX + 1` desborda (UB) y ya no compara bien. Usa un "infinito"
 * que se pueda sumar: objetivo + 1 (nunca puede ser una respuesta válida).
 */
int cambioMonedas(const vector<int>& monedas, int objetivo) {
    return pendiente();
}

// ── Ejercicio 3 · mochila 0/1 ───────────────────────────────────────────────
/**
 * Mochila 0/1: cada objeto tiene un peso y un valor y se coge entero o no se coge. Devuelve el mayor valor
 * posible sin pasar de la capacidad. Vectores de distinta longitud o capacidad negativa → invalid_argument.
 * Tabla de una dimensión: `mejor[w]` = mayor valor con capacidad w. Para cada objeto recorre w de MAYOR a menor
 * (si fuera de menor a mayor, usarías el mismo objeto varias veces): mejor[w] = max(mejor[w], mejor[w - peso] + valor).
 * O(objetos · capacidad).
 * Trampa: `for (size_t w = capacidad; w >= peso; w--)` NUNCA termina si peso == 0 (size_t no baja de 0); usa int.
 */
int mochila(const vector<int>& pesos, const vector<int>& valores, int capacidad) {
    return pendiente();
}

// ── Ejercicio 4 · lcs (subsecuencia común más larga) ────────────────────────
/**
 * Longitud de la subsecuencia común más larga de dos textos (los caracteres no tienen por qué ser contiguos, pero
 * sí mantener el orden). "ABCBDAB" y "BDCABA" → 4 ("BCBA"). Tabla de (n+1)×(m+1): si los caracteres coinciden,
 * tabla[i][j] = tabla[i-1][j-1] + 1; si no, max(tabla[i-1][j], tabla[i][j-1]). Es el núcleo del comando `diff`.
 * O(n·m) de tiempo; como cada fila solo mira la anterior, basta con DOS filas (espacio O(m)).
 * Trampa: `a[i - 1]` con i = 0 sobre un size_t da una posición enorme; las filas/columnas 0 de la tabla son las del
 * prefijo vacío, así que el carácter de la posición i es `a[i - 1]`.
 */
int lcs(const string& a, const string& b) {
    return pendiente();
}

// ── Ejercicio 5 · distanciaEdicion ──────────────────────────────────────────
/**
 * Distancia de Levenshtein: mínimo de inserciones, borrados y sustituciones de un carácter para convertir `a` en `b`.
 * "kitten" → "sitting" = 3. C++ no trae esta función: las pruebas la comparan con una versión recursiva con memoria.
 * tabla[i][j] = distancia entre los i primeros caracteres de `a` y los j primeros de `b`;
 * tabla[i][0] = i; tabla[0][j] = j; y si coinciden: tabla[i-1][j-1], si no: 1 + min(borrar, insertar, sustituir).
 * Trampa: `min` de C++ solo admite dos argumentos del MISMO tipo; para tres usa `min({x, y, z})` (necesita <algorithm>).
 */
int distanciaEdicion(const string& a, const string& b) {
    return pendiente();
}

// ── Ejercicio 6 · lis (subsecuencia creciente más larga) ────────────────────
/**
 * Longitud de la subsecuencia ESTRICTAMENTE creciente más larga de un vector (elementos no contiguos pero en orden).
 *   {10, 9, 2, 5, 3, 7, 101, 18}  →  4   (2, 3, 7, 18)
 * La DP clásica es O(n²) (dp[i] = longitud de la mejor que termina en i). Aquí se pide la de O(n log n): mantén un vector
 * `colas` donde colas[k] es el MENOR valor con el que puede terminar una subsecuencia creciente de longitud k+1. Para cada x,
 * `lower_bound(colas.begin(), colas.end(), x)` da la primera posición con valor ≥ x: si es el final, añade x (la secuencia
 * crece); si no, sustituye ese valor por x (una cola más pequeña es mejor). La respuesta es colas.size().
 * Ojo: `colas` NO es la subsecuencia, solo su longitud es válida. Con lower_bound es estricta; con upper_bound sería no decreciente.
 */
int lis(const vector<int>& v) {
    return pendiente();
}

// ── Ejercicio 7 · tspBitmask (viajante) ─────────────────────────────────────
/**
 * Viajante de comercio con pocas ciudades: longitud del recorrido MÁS CORTO que sale de la ciudad 0, visita todas las
 * demás exactamente una vez y vuelve a la 0. `dist[i][j]` es la distancia de i a j (matriz cuadrada, puede ser asimétrica).
 * Con 0 ciudades o 1 ciudad la respuesta es 0. Matriz no cuadrada o más de 20 ciudades → invalid_argument.
 *   Estado:      dp[mascara][u] = coste mínimo de salir de 0, visitar exactamente las ciudades de `mascara` y acabar en u.
 *   Base:        dp[1][0] = 0 (solo la 0 visitada).
 *   Transición:  dp[mascara | (1 << v)][v] = min(dp[mascara][u] + dist[u][v]) para v que NO esté en mascara.
 *   Respuesta:   min sobre u de dp[todas][u] + dist[u][0].
 * O(2ⁿ · n²) en tiempo y O(2ⁿ · n) en espacio: con n = 20 son ~400 millones de pasos, frente a n! de la fuerza bruta.
 * Trampa: usa un "infinito" que se pueda sumar sin desbordar (p. ej. INT_MAX / 2) y no sigas desde estados inalcanzables.
 */
int tspBitmask(const vector<vector<int>>& dist) {
    return pendiente();
}

// ── Ejercicio 8 · multiplicacionMatrices (DP de intervalos) ─────────────────
/**
 * Multiplicar una cadena de k matrices: la matriz i tiene dimensiones dims[i] × dims[i+1] (así que dims tiene k+1
 * elementos). El producto es asociativo pero el ORDEN de los paréntesis cambia el coste: (A·B)·C no cuesta lo mismo que
 * A·(B·C). Multiplicar p×q por q×r cuesta p·q·r productos. Devuelve el menor número de productos escalares.
 *   dims = {10, 30, 5, 60}  →  4500   ((A·B)·C: 10·30·5 + 10·5·60)
 * Con menos de 2 matrices (dims.size() < 3) el coste es 0. Una dimensión ≤ 0 → invalid_argument.
 *   Estado:      dp[i][j] = coste mínimo de multiplicar las matrices i..j.
 *   Transición:  dp[i][j] = min sobre k en [i, j) de dp[i][k] + dp[k+1][j] + dims[i]·dims[k+1]·dims[j+1].
 *   Orden:       por LONGITUD del tramo (2, 3, 4...), no por filas: los tramos cortos deben estar listos antes.
 * O(k³) de tiempo y O(k²) de espacio. Usa long long: los costes crecen enseguida.
 */
long long multiplicacionMatrices(const vector<int>& dims) {
    return pendiente();
}

// ── Ejercicio 9 · caminosRejilla ────────────────────────────────────────────
/**
 * Número de caminos de la esquina superior izquierda a la inferior derecha de una rejilla moviéndose solo a la
 * DERECHA o ABAJO. Las celdas '#' son obstáculos y '.' son libres. El resultado puede ser enorme: devuélvelo MÓDULO
 * 1.000.000.007 (el módulo de casi todos los concursos). Si la salida o la entrada es un obstáculo, 0. Rejilla vacía → 0.
 *   dp[f][c] = dp[f-1][c] + dp[f][c-1] si la celda está libre, 0 si es obstáculo.
 * Basta UNA fila: al procesar la celda (f, c), dp[c] aún guarda el valor de arriba y dp[c-1] ya es el de la izquierda.
 * Trampa: suma y reduce con `% MOD` en cada paso; con long long el producto de dos valores < MOD cabe, pero la suma sin
 * reducir de millones de términos no. Y nunca dejes un resto negativo (en C++ `-3 % 5` es -3, no 2).
 */
int caminosRejilla(const vector<string>& rejilla) {
    return pendiente();
}

// ── Ejercicio 10 · particionIgual (subset sum con bitset) ───────────────────
/**
 * ¿Se puede repartir un vector de enteros NO negativos en dos grupos con la misma suma? ({1, 5, 11, 5} → true: 11 y 1+5+5.)
 * Es el problema del subconjunto: ¿existe un subconjunto con suma total/2? Si la suma es impar, false de entrada.
 * Un número negativo o una suma total mayor que 100000 → invalid_argument (el bitset tiene tamaño fijo en compilación).
 * Usa `bitset<50001> posibles;` con posibles[0] = 1: añadir un número x es `posibles |= posibles << x`. Al final mira el bit
 * total/2. Cada desplazamiento procesa 64 sumas por instrucción: O(n · suma / 64).
 * Trampa: `posibles << x` con x ≥ 50001 da simplemente 0 (no es UB en bitset, a diferencia de `<<` en enteros), y
 * `bitset<N>[i]` con i ≥ N con `operator[]` SÍ es UB: usa `test(i)`, que lanza out_of_range.
 */
bool particionIgual(const vector<int>& v) {
    return pendiente();
}

// ── Utilidades de las pruebas ───────────────────────────────────────────────

/** Referencia para distanciaEdicion: recursión con memoria (la otra forma de hacer DP). */
int levenshteinReferencia(const string& a, const string& b, size_t i, size_t j, vector<vector<int>>& memo) {
    if (i == 0) {
        return static_cast<int>(j);
    }
    if (j == 0) {
        return static_cast<int>(i);
    }
    if (memo[i][j] >= 0) {
        return memo[i][j];
    }
    int r = a[i - 1] == b[j - 1]
        ? levenshteinReferencia(a, b, i - 1, j - 1, memo)
        : 1 + min({levenshteinReferencia(a, b, i - 1, j, memo), levenshteinReferencia(a, b, i, j - 1, memo),
                   levenshteinReferencia(a, b, i - 1, j - 1, memo)});
    memo[i][j] = r;
    return r;
}

/** Referencia de la mochila: fuerza bruta sobre los 2ⁿ subconjuntos (solo para n pequeño). */
int mochilaFuerzaBruta(const vector<int>& pesos, const vector<int>& valores, int capacidad) {
    int mejor = 0;
    size_t cuantos = pesos.size();
    for (unsigned mascara = 0; mascara < (1u << cuantos); mascara++) {
        int peso = 0;
        int valor = 0;
        for (size_t i = 0; i < cuantos; i++) {
            if (mascara & (1u << i)) {
                peso += pesos[i];
                valor += valores[i];
            }
        }
        if (peso <= capacidad) {
            mejor = max(mejor, valor);
        }
    }
    return mejor;
}

/** Referencia de LIS: la DP clásica O(n²). */
int lisCuadratica(const vector<int>& v) {
    vector<int> dp(v.size(), 1);
    int mejor = 0;
    for (size_t i = 0; i < v.size(); i++) {
        for (size_t j = 0; j < i; j++) {
            if (v[j] < v[i]) {
                dp[i] = max(dp[i], dp[j] + 1);
            }
        }
        mejor = max(mejor, dp[i]);
    }
    return mejor;
}

/** Referencia de TSP: fuerza bruta con todas las permutaciones (n! recorridos; solo n ≤ 8). */
int tspFuerzaBruta(const vector<vector<int>>& dist) {
    size_t ciudades = dist.size();
    if (ciudades <= 1) {
        return 0;
    }
    vector<int> orden(ciudades - 1);
    iota(orden.begin(), orden.end(), 1);
    int mejor = INT_MAX;
    do {
        int total = dist[0][static_cast<size_t>(orden[0])];
        for (size_t i = 0; i + 1 < orden.size(); i++) {
            total += dist[static_cast<size_t>(orden[i])][static_cast<size_t>(orden[i + 1])];
        }
        total += dist[static_cast<size_t>(orden.back())][0];
        mejor = min(mejor, total);
    } while (next_permutation(orden.begin(), orden.end()));
    return mejor;
}

/** Matriz de distancias pseudoaleatoria de `ciudades` ciudades. */
vector<vector<int>> distanciasAleatorias(size_t ciudades, unsigned long long semilla) {
    vector<vector<int>> d(ciudades, vector<int>(ciudades, 0));
    unsigned long long x = semilla;
    for (size_t i = 0; i < ciudades; i++) {
        for (size_t j = 0; j < ciudades; j++) {
            if (i != j) {
                x = (x * 1103515245ULL + 12345ULL) & 0x7fffffffULL;
                d[i][j] = 1 + static_cast<int>((x >> 8) % 50);
            }
        }
    }
    return d;
}

/** Referencia de la cadena de matrices: recursión con memoria. */
long long cadenaReferencia(const vector<int>& dims, size_t i, size_t j, vector<vector<long long>>& memo) {
    if (i == j) {
        return 0;
    }
    if (memo[i][j] >= 0) {
        return memo[i][j];
    }
    long long mejor = LLONG_MAX;
    for (size_t k = i; k < j; k++) {
        mejor = min(mejor, cadenaReferencia(dims, i, k, memo) + cadenaReferencia(dims, k + 1, j, memo)
                               + static_cast<long long>(dims[i]) * dims[k + 1] * dims[j + 1]);
    }
    return memo[i][j] = mejor;
}

/** Referencia del subset sum: vector<bool> de sumas posibles, un número cada vez. */
bool particionReferencia(const vector<int>& v) {
    int total = accumulate(v.begin(), v.end(), 0);
    if (total % 2 != 0) {
        return false;
    }
    vector<bool> posible(static_cast<size_t>(total / 2) + 1, false);
    posible[0] = true;
    for (int x : v) {
        for (int s = total / 2; s >= x; s--) {
            if (posible[static_cast<size_t>(s - x)]) {
                posible[static_cast<size_t>(s)] = true;
            }
        }
    }
    return posible[static_cast<size_t>(total / 2)];
}

/** Rejilla pseudoaleatoria de unas n celdas (lado = raíz de n) con ~10 % de obstáculos y entrada/salida libres. */
vector<string> rejillaAleatoria(int n) {
    int lado = max(2, static_cast<int>(sqrt(static_cast<double>(n))));
    unsigned long long x = 777;
    vector<string> filas;
    for (int f = 0; f < lado; f++) {
        string fila;
        for (int c = 0; c < lado; c++) {
            x = (x * 1103515245ULL + 12345ULL) & 0x7fffffffULL;
            fila += ((x >> 8) % 100 < 10) ? '#' : '.';
        }
        filas.push_back(fila);
    }
    filas.front().front() = '.';
    filas.back().back() = '.';
    return filas;
}

/** Dimensiones aleatorias (1..50) para una cadena de n matrices (n + 1 dimensiones). */
vector<int> dimensionesAleatorias(int matrices) {
    vector<int> dims = aleatorios(matrices + 1, 49, 7);
    for (int& d : dims) {
        d++;
    }
    return dims;
}

string textoAleatorio(int largo, unsigned long long semilla) {
    unsigned long long x = semilla;
    string s;
    for (int i = 0; i < largo; i++) {
        x = (x * 1103515245ULL + 12345ULL) & 0x7fffffffULL;
        s += static_cast<char>('a' + (x >> 8) % 4);
    }
    return s;
}

int main() {

// ════════════════════════════════════════════════════════════════════════════
// 1. POR QUÉ LA PD: FIBONACCI DE TRES FORMAS (TOP-DOWN VS BOTTOM-UP)
// ════════════════════════════════════════════════════════════════════════════
        titulo("1. Memoización y tabulación");

        long long llamadas = 0;
        long long resultado = fibIngenuo(25, llamadas);
        cout << "ingenuo   fib(25) = " << resultado << " con " << llamadas << " llamadas\n";
        llamadas = 0;
        vector<long long> memo(26, -1);
        resultado = fibMemo(25, memo, llamadas);
        cout << "top-down  fib(25) = " << resultado << " con " << llamadas << " llamadas\n";
        cout << "bottom-up fib(25) = " << fibTabla(25) << " con un solo bucle\n";
        cout << "2 variables fib(25) = " << fibDosVariables(25) << " (espacio O(1))\n";
        // El mismo número de estados (25), pero la ingenua los recalcula ~250.000 veces. Con n = 50 tardaría horas.

        // Pasar la tabla por referencia es esencial: `vector<long long> memo` SIN & copiaría la tabla en cada llamada
        // y la memoización dejaría de funcionar (cada copia empieza vacía).

        // ── Subsección: un unordered_map como memo ──
        // Útil cuando el estado no es un índice pequeño (un número gigante, una cadena, un par).
        unordered_map<long long, long long> collatzMemo;
        function<long long(long long)> pasosCollatz = [&](long long x) -> long long {
            if (x == 1) {
                return 0;
            }
            auto it = collatzMemo.find(x);
            if (it != collatzMemo.end()) {
                return it->second;
            }
            long long r = 1 + pasosCollatz(x % 2 == 0 ? x / 2 : 3 * x + 1);
            collatzMemo[x] = r;                          // OJO: no guardes `auto& hueco = collatzMemo[x]` antes de recursar
            return r;
        };
        cout << "pasos de Collatz para 27: " << pasosCollatz(27) << " (estados guardados: " << collatzMemo.size() << ")\n";

// ════════════════════════════════════════════════════════════════════════════
// 2. ESTADOS Y TRANSICIONES: CÓMO PENSAR UNA DP
// ════════════════════════════════════════════════════════════════════════════
        titulo("2. Estados y transiciones");

        vector<int> casas = {2, 7, 9, 3, 1};
        cout << "ladrón de casas {2,7,9,3,1}: tabla=" << botinMaximoTabla(casas) << " · O(1)=" << botinMaximoO1(casas)
             << " · memo=" << botinMaximoMemo(casas) << "  (2 + 9 + 1)\n";

        // ── Subsección: caminos en una cuadrícula ──
        // ¿De cuántas formas se llega a la esquina inferior derecha moviéndose solo a la derecha o hacia abajo?
        //   celda(f, c) = celda(f-1, c) + celda(f, c-1)        (se llega desde arriba o desde la izquierda)
        // Con las celdas de la primera fila y columna a 1. Esto es el ejercicio caminosRejilla sin obstáculos.
        vector<vector<long long>> cuadricula(10, vector<long long>(10, 1));
        for (size_t f = 1; f < 10; f++) {
            for (size_t c = 1; c < 10; c++) {
                cuadricula[f][c] = cuadricula[f - 1][c] + cuadricula[f][c - 1];
            }
        }
        cout << "caminos en una cuadrícula 10×10: " << cuadricula[9][9] << " (= C(18, 9))\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. OPTIMIZAR LA MEMORIA: DE LA TABLA A UNA FILA
// ════════════════════════════════════════════════════════════════════════════
        titulo("3. Optimización de memoria");

        cout << "formas de sumar 10 con {1,2,5} (orden irrelevante): " << formasDeCambio({1, 2, 5}, 10) << "\n";
        // Si el bucle de monedas estuviera DENTRO del de cantidades, se contarían las permutaciones: 1+2 y 2+1 serían
        // dos formas. Cambiar el orden de los bucles cambia el problema que resuelves.
        // Memoria de una tabla de 10⁴ × 10⁴ ints: 400 MB (no cabe). Dos filas: 80 KB. Esa es la diferencia entre
        // «se pasa de memoria» y «funciona».
        cout << "tabla completa 10⁴×10⁴ de int: " << (10000LL * 10000 * 4) / 1000000 << " MB · dos filas: "
             << (2LL * 10000 * 4) / 1000 << " KB\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. DP AVANZADA: BITMASK, INTERVALOS Y BITSET
// ════════════════════════════════════════════════════════════════════════════
        titulo("4. Bitmask, intervalos y bitset");

        // Un subconjunto de {0,1,2,3} como número de 4 bits: 0b1010 = {1, 3}.
        unsigned mascara = 0b1010;
        cout << "máscara 1010: bits a 1 = " << cuentaBits(mascara) << " · ¿contiene el 3? " << ((mascara >> 3) & 1)
             << " · añadir el 0 → " << (mascara | (1u << 0)) << "\n";
        cout << "un conjunto de 20 elementos tiene " << (1 << 20) << " subconjuntos\n";

        // bitset: sumas alcanzables con {3, 5, 8} (bit s = 1 si se puede sumar s).
        bitset<20> posibles;
        posibles[0] = 1;
        for (int x : {3, 5, 8}) {
            posibles |= posibles << x;
        }
        cout << "sumas posibles con {3,5,8}: " << posibles << "  (bit 0 a la derecha)\n";

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

        prueba(escaleras,
            caso("n = 0", 1LL, 0),
            caso("n = 1", 1LL, 1),
            caso("n = 2", 2LL, 2),
            caso("n = 3", 3LL, 3),
            caso("n = 5", 8LL, 5),
            caso("n = 10", 89LL, 10),
            caso("n = 40", 165580141LL, 40),
            caso("n = 80 (sin desbordar)", 37889062373143906LL, 80),
            caso("n = 91 (el último que cabe en un long long)", 7540113804746346429LL, 91));
        grupo("escaleras()");
        lanza("negativo", [&] { escaleras(-1); }, invalid_argument);
        lanza("n = 92 desborda un long long", [&] { escaleras(92); }, overflow_error);

        prueba(cambioMonedas,
            caso("ejemplo básico", 3, vector<int>{1, 2, 5}, 11),
            caso("el voraz falla", 2, vector<int>{1, 3, 4}, 6),
            caso("imposible", -1, vector<int>{2}, 3),
            caso("objetivo 0", 0, vector<int>{1, 2}, 0),
            caso("sin monedas", -1, vector<int>{}, 5),
            caso("una moneda exacta", 1, vector<int>{7}, 7),
            caso("monedas europeas", 7, vector<int>{1, 2, 5, 10, 20, 50, 100, 200}, 387),
            caso("moneda mayor que el objetivo", -1, vector<int>{5, 10}, 3),
            caso("objetivo grande", 405, vector<int>{1, 5, 10, 25}, 9999),
            caso("monedas desordenadas", 3, vector<int>{5, 1, 2}, 11));
        grupo("cambioMonedas()");
        lanza("cantidad negativa", [&] { cambioMonedas({1}, -1); }, invalid_argument);
        lanza("moneda cero (bucle infinito si no se valida)", [&] { cambioMonedas({0, 1}, 5); }, invalid_argument);

        prueba(mochila,
            caso("clásico", 9, vector<int>{1, 3, 4, 5}, vector<int>{1, 4, 5, 7}, 7),
            caso("capacidad 0", 0, vector<int>{1, 2}, vector<int>{10, 20}, 0),
            caso("todo cabe", 28, vector<int>{1, 2, 3}, vector<int>{6, 10, 12}, 10),
            caso("ningún objeto cabe", 0, vector<int>{5, 6}, vector<int>{10, 20}, 4),
            caso("no se reutilizan objetos", 3, vector<int>{2}, vector<int>{3}, 10),
            caso("sin objetos", 0, vector<int>{}, vector<int>{}, 5),
            caso("elegir bien", 220, vector<int>{10, 20, 30}, vector<int>{60, 100, 120}, 50),
            caso("objeto de peso 0 siempre cabe", 7, vector<int>{0, 3}, vector<int>{7, 1}, 2));
        grupo("mochila()");
        lanza("longitudes distintas", [&] { mochila({1, 2}, {3}, 5); }, invalid_argument);
        comprueba("coincide con la fuerza bruta en 60 mochilas pequeñas", [&] {
            for (int semilla = 1; semilla <= 60; semilla++) {
                vector<int> pesos = aleatorios(8, 9, semilla);
                vector<int> valores = aleatorios(8, 20, semilla + 100);
                int capacidad = 5 + semilla % 20;
                if (mochila(pesos, valores, capacidad) != mochilaFuerzaBruta(pesos, valores, capacidad)) {
                    return false;
                }
            }
            return true;
        }, true);

        prueba(lcs,
            caso("clásico", 4, "ABCBDAB", "BDCABA"),
            caso("iguales", 3, "abc", "abc"),
            caso("nada en común", 0, "abc", "def"),
            caso("una vacía", 0, "", "abc"),
            caso("ambas vacías", 0, "", ""),
            caso("subsecuencia", 4, "AGGTAB", "GXTXAYB"),
            caso("una dentro de otra", 3, "ace", "abcde"),
            caso("distinta longitud", 1, "a", "aaaaaaaa"),
            caso("una contenida entera en la otra", 4, "abcbdab", "bcab"));

        grupo("distanciaEdicion");
        comprueba("kitten → sitting", [&] { return distanciaEdicion("kitten", "sitting"); }, 3);
        comprueba("horse → ros", [&] { return distanciaEdicion("horse", "ros"); }, 3);
        comprueba("intention → execution", [&] { return distanciaEdicion("intention", "execution"); }, 5);
        comprueba("iguales", [&] { return distanciaEdicion("cpp", "cpp"); }, 0);
        comprueba("desde vacío", [&] { return distanciaEdicion("", "abc"); }, 3);
        comprueba("a vacío", [&] { return distanciaEdicion("abcd", ""); }, 4);
        comprueba("es simétrica", [&] { return distanciaEdicion("sabado", "domingo") == distanciaEdicion("domingo", "sabado"); }, true);
        comprueba("coincide con la versión recursiva en 200 pares", [&] {
            for (int i = 0; i < 200; i++) {
                string a = textoAleatorio(i % 9, static_cast<unsigned long long>(11 + i));
                string b = textoAleatorio((i * 7) % 11, static_cast<unsigned long long>(5000 + i));
                vector<vector<int>> referencia(a.size() + 1, vector<int>(b.size() + 1, -1));
                if (distanciaEdicion(a, b) != levenshteinReferencia(a, b, a.size(), b.size(), referencia)) {
                    return false;
                }
            }
            return true;
        }, true);

        prueba(lis,
            caso("clásico", 4, vector<int>{10, 9, 2, 5, 3, 7, 101, 18}),
            caso("vacío", 0, vector<int>{}),
            caso("un elemento", 1, vector<int>{5}),
            caso("ya creciente", 5, vector<int>{1, 2, 3, 4, 5}),
            caso("decreciente", 1, vector<int>{5, 4, 3, 2, 1}),
            caso("estricta: los iguales no cuentan", 1, vector<int>{7, 7, 7, 7}),
            caso("con repetidos", 4, vector<int>{0, 1, 0, 3, 2, 3}));
        grupo("lis (contra la versión O(n²))");
        comprueba("coincide en 100 vectores aleatorios", [&] {
            for (int semilla = 1; semilla <= 100; semilla++) {
                vector<int> v = aleatorios(40, 30, semilla);
                if (lis(v) != lisCuadratica(v)) {
                    return false;
                }
            }
            return true;
        }, true);
        comprueba("negativos", [&] { return lis({-5, -3, -4, -1, -2, 0}); }, 4);
        comprueba("100.000 elementos en O(n log n)", [&] { return lis(numeros(100000)); }, 100000);

        grupo("tspBitmask");
        comprueba("0 y 1 ciudades", [&] { return tspBitmask({}) + tspBitmask({{0}}); }, 0);
        comprueba("dos ciudades: ida y vuelta", [&] { return tspBitmask({{0, 5}, {7, 0}}); }, 12);
        comprueba("cuadrado (4 ciudades)", [&] {
            return tspBitmask({{0, 1, 2, 1}, {1, 0, 1, 2}, {2, 1, 0, 1}, {1, 2, 1, 0}});
        }, 4);
        comprueba("asimétrica", [&] { return tspBitmask({{0, 1, 9}, {9, 0, 1}, {1, 9, 0}}); }, 3);
        comprueba("coincide con la fuerza bruta (n = 3..8)", [&] {
            for (size_t ciudades = 3; ciudades <= 8; ciudades++) {
                auto d = distanciasAleatorias(ciudades, 31 * ciudades);
                if (tspBitmask(d) != tspFuerzaBruta(d)) {
                    return false;
                }
            }
            return true;
        }, true);
        comprueba("15 ciudades se resuelven al instante", [&] {
            return tspBitmask(distanciasAleatorias(15, 5)) > 0;
        }, true);
        lanza("matriz no cuadrada", [&] { tspBitmask({{0, 1}, {1}}); }, invalid_argument);
        lanza("más de 20 ciudades", [&] { tspBitmask(vector<vector<int>>(21, vector<int>(21, 1))); }, invalid_argument);

        grupo("multiplicacionMatrices");
        comprueba("tres matrices", [&] { return multiplicacionMatrices({10, 30, 5, 60}); }, 4500LL);
        comprueba("una sola matriz", [&] { return multiplicacionMatrices({10, 20}); }, 0LL);
        comprueba("sin matrices", [&] { return multiplicacionMatrices({}); }, 0LL);
        comprueba("dos matrices", [&] { return multiplicacionMatrices({4, 5, 6}); }, 120LL);
        comprueba("cuatro matrices (clásico CLRS reducido)", [&] { return multiplicacionMatrices({40, 20, 30, 10, 30}); }, 26000LL);
        comprueba("seis matrices (CLRS)", [&] { return multiplicacionMatrices({30, 35, 15, 5, 10, 20, 25}); }, 15125LL);
        comprueba("coincide con la recursiva (30 casos)", [&] {
            for (int semilla = 1; semilla <= 30; semilla++) {
                vector<int> dims = aleatorios(2 + semilla % 8, 40, semilla);
                for (int& d : dims) {
                    d++;
                }
                vector<vector<long long>> memoRef(dims.size(), vector<long long>(dims.size(), -1));
                long long esperado = dims.size() < 3 ? 0 : cadenaReferencia(dims, 0, dims.size() - 2, memoRef);
                if (multiplicacionMatrices(dims) != esperado) {
                    return false;
                }
            }
            return true;
        }, true);
        lanza("dimensión cero", [&] { multiplicacionMatrices({3, 0, 4}); }, invalid_argument);

        prueba(caminosRejilla,
            caso("2×2 libre", 2, vector<string>{"..", ".."}),
            caso("3×3 libre", 6, vector<string>{"...", "...", "..."}),
            caso("un obstáculo en el centro", 2, vector<string>{"...", ".#.", "..."}),
            caso("camino bloqueado", 0, vector<string>{".#", "#."}),
            caso("una celda", 1, vector<string>{"."}),
            caso("salida bloqueada", 0, vector<string>{"..", ".#"}),
            caso("entrada bloqueada", 0, vector<string>{"#.", ".."}),
            caso("rejilla vacía", 0, vector<string>{}),
            caso("una sola fila", 1, vector<string>{"....."}),
            caso("18×18 libre: C(34, 17) = 2333606220 → mod 1e9+7", 333606206, vector<string>(18, string(18, '.'))));

        prueba(particionIgual,
            caso("clásico", true, vector<int>{1, 5, 11, 5}),
            caso("suma impar", false, vector<int>{1, 2, 4}),
            caso("sin elementos", true, vector<int>{}),
            caso("un solo elemento", false, vector<int>{4}),
            caso("todo ceros", true, vector<int>{0, 0, 0}),
            caso("no se puede aunque la suma sea par", false, vector<int>{1, 2, 5}),
            caso("dos iguales", true, vector<int>{7, 7}),
            caso("varios", true, vector<int>{3, 1, 1, 2, 2, 1}));
        grupo("particionIgual (contra la referencia)");
        comprueba("coincide en 100 vectores aleatorios", [&] {
            for (int semilla = 1; semilla <= 100; semilla++) {
                vector<int> v = aleatorios(12, 15, semilla);
                if (particionIgual(v) != particionReferencia(v)) {
                    return false;
                }
            }
            return true;
        }, true);
        lanza("negativos", [&] { particionIgual({3, -1}); }, invalid_argument);
        lanza("suma demasiado grande", [&] { particionIgual({60000, 60000}); }, invalid_argument);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
        // escaleras: una sola llamada tarda nanosegundos (el reloj no la distingue del ruido) y n no puede pasar de 91,
        // así que cada repetición hace 20.000 llamadas seguidas.
        medirCon("escaleras", [](int largo) { return largo; }, [](int largo) {
            for (int i = 0; i < 20000; i++) {
                escaleras(largo);
            }
        }, "lineal", rango(5, 85, 5));                                                  // O(n)
        medir(cambioMonedas, vector<int>{1, 5, 10, 25}, n);                            // O(objetivo · monedas)
        medir(mochila, rango(1, 20), rango(21, 40), n);                                // O(objetos · capacidad)
        medir(lcs, textoAleatorio(n, 1), textoAleatorio(n, 2));                        // O(n²)
        medir(distanciaEdicion, textoAleatorio(n, 3), textoAleatorio(n, 4));           // O(n²)
        medir(lis, aleatorios(n, 1000000, 3));                                         // O(n log n)
        medir(multiplicacionMatrices, dimensionesAleatorias(n));                           // O(n³) en el nº de matrices
        medir(caminosRejilla, rejillaAleatoria(n));                                    // O(celdas)

        return 0;
}
