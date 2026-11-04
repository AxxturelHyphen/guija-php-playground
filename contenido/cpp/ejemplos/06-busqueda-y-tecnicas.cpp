#include <algorithm>
#include <array>
#include <climits>
#include <functional>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

/*
 * TEMA 6 · BÚSQUEDA Y TÉCNICAS CLÁSICAS
 * ────────────────────────────────────────────────────────────────────────────
 * Muchos problemas "difíciles" son en realidad un truco de cuatro o cinco que se repiten. Aquí aprenderás los que
 * más rentabilidad tienen en entrevistas y concursos, y cuándo aplicarlos:
 *
 *   Técnica                 Cuándo                          Coste           Herramienta en C++
 *   Búsqueda binaria        datos ORDENADOS                 O(n) → O(log n) lower_bound / upper_bound / a mano
 *   Binaria sobre la resp.  "el mínimo X tal que se puede"  O(log rango)    bucle con predicado monótono
 *   Dos punteros            ordenado / pares / in situ      O(n²) → O(n)    dos índices (o iteradores)
 *   Ventana deslizante      subarrays CONTIGUOS             O(n·k) → O(n)   dos índices + acumulador
 *   Tabla hash              "¿lo he visto ya?"              O(n²) → O(n)    unordered_map / unordered_set
 *   Sumas prefijas          consultas de rango              O(n) → O(1)     vector<long long> acumulado
 *   Sumas prefijas 2D       suma de un rectángulo           O(n·m) → O(1)   tabla (f+1)×(c+1)
 *   Diferencias             muchas actualizaciones de rango O(n) → O(1)     vector de diferencias + prefijas
 *
 * La idea común: no recalcular lo que ya sabes. Cambiar tiempo por un poco de memoria.
 *
 * CÓMO SE TRABAJA EN ESTE ARCHIVO
 *   - Ctrl+Enter ejecuta todo: la teoría (secciones 1-5) y las PRUEBAS de tus ejercicios.
 *   - Cada ejercicio empieza con `return pendiente();`: sustitúyelo por tu código. Mientras esté, sale como
 *     «pendiente» (no como fallo).
 *   - Ctrl+S guarda tu avance. El botón «Solución» compara tu código con el de referencia.
 *   - «Medir» (Ctrl+Alt+Enter) ejecuta los medir() del final y dibuja el coste real de tus funciones.
 *   - C++ exige DECLARAR antes de USAR: por eso todas las funciones están por encima de main().
 *
 * DESDE JAVA / PHP / PYTHON (lo que cambia en este tema)
 *   - Java trae Arrays.binarySearch y Collections.binarySearch; Python, bisect; PHP, nada. En C++ hay TRES
 *     funciones en <algorithm> (binary_search, lower_bound, upper_bound) y las usarás a diario.
 *   - Un std::vector<int> se pasa por COPIA si no escribes `&`: `const vector<int>&` = "solo lectura, sin copiar".
 *   - xs.size() devuelve size_t (SIN signo): `xs.size() - 1` en un vector vacío NO da -1, da 18446744073709551615.
 *     Para índices que pueden llegar a -1 usa `int` y convierte: static_cast<int>(xs.size()) - 1.
 *   - Un `int` desborda a partir de 2 147 483 647 y NO avisa (en C++ es comportamiento indefinido para enteros con
 *     signo). Las sumas de muchos elementos se acumulan en long long.
 * DESDE C: lo mismo que ya conoces (bsearch de <stdlib.h> existe, pero lower_bound es más útil: devuelve DÓNDE iría).
 */

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

using Par = pair<int, int>;
using VI = vector<int>;
using VS = vector<string>;
using VVS = vector<VS>;
using Matriz = vector<vector<int>>;

// ── Sección 1 · BÚSQUEDA LINEAL FRENTE A BINARIA (teoría y funciones de apoyo) ──
// Lineal: mirar uno por uno → hasta n pasos. Binaria: en una lista ORDENADA, mirar el del medio y descartar la
// mitad que no puede contenerlo → log₂ n pasos (con mil millones de elementos, ~30).

/** Devuelve {índice, número de pasos}. */
pair<int, int> lineal(const VI& xs, int x)
{
    int pasos = 0;
    for (int i = 0; i < static_cast<int>(xs.size()); i++) {   // int + static_cast: así i < size() no mezcla signo y sin signo
        pasos++;
        if (xs[i] == x) {
            return {i, pasos};
        }
    }
    return {-1, pasos};
}

pair<int, int> binariaConPasos(const VI& xs, int x)
{
    int pasos = 0;
    int bajo = 0;
    int alto = static_cast<int>(xs.size()) - 1;
    while (bajo <= alto) {                      // invariante: si x está, está en [bajo, alto]
        pasos++;
        int medio = bajo + (alto - bajo) / 2;   // NO (bajo + alto) / 2: con índices grandes la suma desborda el int
        if (xs[medio] == x) {
            return {medio, pasos};
        }
        if (xs[medio] < x) {
            bajo = medio + 1;                   // descarta la mitad izquierda (y el medio)
        } else {
            alto = medio - 1;                   // descarta la mitad derecha (y el medio)
        }
    }
    return {-1, pasos};
}

// Los errores típicos de la binaria: `alto = size() - 1` o `size()` (hay que ser coherente con `<=` o `<`), no avanzar
// `medio ± 1` (bucle infinito), no ordenar antes, y (en C++) indexar con un size_t que se desborda por abajo.
// Las dos plantillas más usadas:
//   · buscar un valor exacto:                      while (bajo <= alto) {...}          rango CERRADO [bajo, alto]
//   · buscar la primera posición que cumple algo:  while (bajo < alto) {...}           rango SEMIABIERTO [bajo, alto)
//     (el "límite inferior": lo que hace std::lower_bound)

// ── 1b. La biblioteca estándar: binary_search, lower_bound, upper_bound, equal_range ──
// Trabajan con ITERADORES (como punteros a elementos): begin() es el primero y end() es "uno pasado el último".
//   binary_search(ini, fin, x)   → bool: ¿está x?
//   lower_bound(ini, fin, x)     → iterador al PRIMER elemento >= x   (end() si todos son menores)
//   upper_bound(ini, fin, x)     → iterador al PRIMER elemento >  x   (end() si ninguno es mayor)
//   equal_range(ini, fin, x)     → par {lower_bound, upper_bound}: el tramo de elementos iguales a x
// La POSICIÓN (índice) se obtiene restando: `it - xs.begin()`. Y cuántos hay iguales a x: upper - lower.
// Trampas: (1) desreferenciar `*it` cuando it == end() es comportamiento indefinido: compara antes.
// (2) Solo son O(log n) con iteradores de acceso aleatorio (vector, array, deque). Con std::list son O(n).
// (3) Si el contenedor es un std::set/map, usa su método xs.lower_bound(x), NO la función de <algorithm>.
// Desde Java/PHP/Python: lower_bound ≈ bisect_left de Python; upper_bound ≈ bisect_right; en Java, Arrays.binarySearch
// devuelve un negativo "-(punto de inserción) - 1" cuando no lo encuentra: aquí no hace falta ese truco.

// ── 1c. Búsqueda binaria sobre la RESPUESTA ──
// Si puedes preguntar "¿sirve el valor x?" y la respuesta es monótona (falso, falso, ..., verdadero, verdadero), no
// hace falta ningún vector: se hace búsqueda binaria sobre los posibles valores de x. Es uno de los trucos más
// potentes: "¿cuál es la capacidad MÍNIMA de camión para repartir todo en D días?", "¿la velocidad mínima?"...

/** Menor x en [bajo, alto) con cumple(x) verdadero, suponiendo cumple monótona; devuelve `alto` si ninguno cumple. */
long long primerVerdadero(long long bajo, long long alto, const function<bool(long long)>& cumple)
{
    while (bajo < alto) {
        long long medio = bajo + (alto - bajo) / 2;
        if (cumple(medio)) {
            alto = medio;           // medio sirve: la respuesta es medio o algo menor
        } else {
            bajo = medio + 1;       // medio no sirve: la respuesta es mayor
        }
    }
    return bajo;
}

/** Capacidad mínima de un camión para llevar los paquetes (EN ORDEN) en como mucho `dias` viajes. */
long long capacidadMinima(const VI& pesos, int dias)
{
    long long masPesado = *max_element(pesos.begin(), pesos.end());      // menos que esto no cabe ni un paquete
    long long total = accumulate(pesos.begin(), pesos.end(), 0LL);       // 0LL (long long): con 0 se acumularía en int
    auto bastaConEsa = [&](long long capacidad) {
        int diasNecesarios = 1;
        long long cargado = 0;
        for (int p : pesos) {
            if (cargado + p > capacidad) {  // este paquete ya no cabe: nuevo día
                diasNecesarios++;
                cargado = 0;
            }
            cargado += p;
        }
        return diasNecesarios <= dias;
    };
    return primerVerdadero(masPesado, total + 1, bastaConEsa);
}

// ── Sección 2 · DOS PUNTEROS (teoría y funciones de apoyo) ──
// Con la lista ordenada, un puntero al principio y otro al final se van acercando según la suma
// sea demasiado pequeña o demasiado grande. Cada paso descarta al menos un candidato: O(n).
// ("Puntero" aquí es un ÍNDICE; también valdrían iteradores o punteros de verdad: la técnica es la misma.)

optional<Par> parConSuma(const VI& ordenado, int objetivo)
{
    int i = 0;
    int j = static_cast<int>(ordenado.size()) - 1;
    while (i < j) {
        int suma = ordenado[i] + ordenado[j];
        cout << "  " << ordenado[i] << " + " << ordenado[j] << " = " << suma << "\n";
        if (suma == objetivo) {
            return Par{ordenado[i], ordenado[j]};
        }
        if (suma < objetivo) {
            i++;
        } else {
            j--;
        }
    }
    return nullopt;     // optional<T> es "un T o nada": el equivalente seguro de devolver null / un puntero nulo
}

// ── 2b. Lectura y escritura: dos punteros que avanzan a distinto ritmo ──
// Para modificar el vector EN EL SITIO sin memoria extra: `lee` recorre todo y `escribe` marca dónde va lo que
// se conserva. Es el esqueleto de std::unique, std::remove_if, partition... Aquí, quitar duplicados de un vector ordenado.

/** Deja el vector sin repetidos consecutivos (en un vector ordenado, sin repetidos) y lo recorta. O(n), memoria O(1). */
void quitarRepetidos(VI& xs)
{
    if (xs.empty()) {
        return;
    }
    size_t escribe = 1;                              // xs[0] siempre se queda
    for (size_t lee = 1; lee < xs.size(); lee++) {
        if (xs[lee] != xs[escribe - 1]) {            // distinto del último que guardé
            xs[escribe++] = xs[lee];
        }
    }
    xs.resize(escribe);                              // lo sobrante se tira. (Con std::unique + erase: el mismo patrón.)
}
// Trampa: borrar elementos de un vector con erase() dentro de un bucle for INVALIDA los iteradores y desplaza todo (O(n)
// por borrado → O(n²)). Con lectura/escritura (o el idioma erase-remove) se hace en una sola pasada.

// ── Sección 3 · VENTANA DESLIZANTE (teoría y funciones de apoyo) ──
// Para "el mejor tramo CONTIGUO de tamaño k": en vez de sumar k elementos en cada posición (O(n·k)),
// se desliza la ventana: se suma el que entra y se resta el que sale (O(n)).

vector<double> mediaMovil(const VI& xs, int k)
{
    vector<double> medias;
    long long suma = accumulate(xs.begin(), xs.begin() + k, 0LL);
    // Trampa clásica: accumulate(..., 0) acumula en INT aunque el vector sea de double (trunca en cada paso). El tipo
    // del acumulador lo marca el valor inicial: 0 (int), 0LL (long long), 0.0 (double).
    medias.push_back(static_cast<double>(suma) / k);
    for (int i = k; i < static_cast<int>(xs.size()); i++) {
        suma += xs[i] - xs[i - k];                   // entra xs[i], sale xs[i - k]
        medias.push_back(static_cast<double>(suma) / k);   // sin el cast, suma / k sería una división ENTERA (como en Java)
    }
    return medias;
}

// ── 3b. Ventana de tamaño VARIABLE ──
// Si el tamaño no está fijado ("el tramo más largo cuya suma no pase de L", con números POSITIVOS): la ventana se
// ensancha por la derecha y se encoge por la izquierda cuando se pasa. Cada índice entra y sale una vez: O(n).

int tramoMasLargoConSumaMaxima(const VI& positivos, long long limite)
{
    int mejor = 0;
    long long suma = 0;
    int izq = 0;
    for (int der = 0; der < static_cast<int>(positivos.size()); der++) {
        suma += positivos[der];
        while (suma > limite && izq <= der) {        // me pasé: encojo por la izquierda
            suma -= positivos[izq++];
        }
        mejor = max(mejor, der - izq + 1);
    }
    return mejor;
}
// (Con números negativos la ventana variable NO funciona: encoger no siempre reduce la suma. Ahí hacen falta sumas
// prefijas + tabla hash, o Kadane.)

// ── Sección 4 · TABLAS HASH: "¿LO HE VISTO YA?" (teoría y funciones de apoyo) ──
// unordered_map / unordered_set dan búsqueda e inserción O(1) de media. Casi cualquier problema de pares, duplicados,
// frecuencias o agrupaciones se resuelve con una pasada y una tabla auxiliar.
//   Java HashMap       →  unordered_map        (O(1) medio; el ORDEN de iteración no está definido)
//   TreeMap            →  map                  (árbol rojinegro: O(log n), claves ORDENADAS)
//   HashSet / TreeSet  →  unordered_set / set
// Trampas: (1) m[clave] INSERTA la clave con valor 0 si no estaba (aunque solo la mires): para consultar usa
// m.find(clave), m.count(clave) o m.contains(clave) (C++20). (2) Modificar el contenedor mientras lo recorres
// puede invalidar los iteradores. (3) Para claves propias (un pair, un struct) hay que dar una función hash.

/** Primer carácter (byte) que no se repite. */
optional<char> primerUnico(const string& s)
{
    unordered_map<char, int> cuentas;
    for (char c : s) {
        cuentas[c]++;                                // la primera vez crea la entrada con 0 y la sube a 1
    }
    for (char c : s) {                               // el unordered_map NO conserva orden: recorro el texto original
        if (cuentas[c] == 1) {
            return c;
        }
    }
    return nullopt;
}
// Desde Java/PHP/Python: un std::string es una secuencia de BYTES (char), no de caracteres Unicode. Con texto ASCII da
// igual; con tildes o emojis (UTF-8) un "carácter" ocupa 2-4 bytes. En el ejercicio 6 verás cómo decodificar.

// Dos sumas con una pasada: para cada número, ¿está ya su complemento?
optional<Par> dosSumasTraza(const VI& nums, int objetivo)
{
    unordered_map<int, int> vistos;                  // valor → índice
    for (int i = 0; i < static_cast<int>(nums.size()); i++) {
        int falta = objetivo - nums[i];
        auto it = vistos.find(falta);                // find no inserta; devuelve end() si no está
        cout << "  n=" << nums[i] << ", busco " << falta << ": " << (it != vistos.end() ? "encontrado" : "no está aún") << "\n";
        if (it != vistos.end()) {
            return Par{it->second, i};
        }
        vistos[nums[i]] = i;
    }
    return nullopt;
}

// ── 4b. Claves propias: una función hash para pair<int,int> ──
// unordered_map no sabe hacer hash de un pair: hay que decirle cómo (un "functor": struct con operator()).
// map/set, en cambio, solo piden `operator<`, y pair ya lo trae: por eso set<pair<int,int>> funciona sin más.
struct HashPar {
    size_t operator()(const Par& p) const
    {
        unsigned long long alto = static_cast<unsigned>(p.first);    // unsigned: sin signo no hay desbordamiento indefinido
        unsigned long long bajo = static_cast<unsigned>(p.second);
        return hash<unsigned long long>()((alto << 32) | bajo);
    }
};
// Aviso para concursos: los hash de la biblioteca son predecibles y hay casos de prueba pensados para que TODAS las
// claves colisionen (entonces unordered_map pasa de O(1) a O(n)). Si te importa, usa map (O(log n) garantizado).

// ── Sección 5 · SUMAS PREFIJAS (teoría y funciones de apoyo) ──
// prefijo[i] = suma de los primeros i elementos. Entonces suma(desde..hasta) = prefijo[hasta+1] - prefijo[desde].
// Se paga O(n) una vez y cada consulta cuesta O(1).
// Trampa: usa long long. Con 100 000 elementos de hasta 10⁹ la suma llega a 10¹⁴ y un int desbordaría sin avisar.

vector<long long> construirPrefijo(const VI& valores)
{
    vector<long long> prefijo(valores.size() + 1, 0);     // n+1 ceros: prefijo[0] = 0 es "la suma de nada"
    for (size_t i = 0; i < valores.size(); i++) {
        prefijo[i + 1] = prefijo[i] + valores[i];
    }
    return prefijo;                                       // se devuelve SIN copiar (el compilador mueve el vector)
}

// ── 5b. Sumas prefijas en 2D: la suma de cualquier rectángulo en O(1) ──
// p[f][c] = suma del rectángulo que va desde (0,0) hasta (f-1,c-1). Se rellena con inclusión-exclusión:
//   p[f+1][c+1] = m[f][c] + p[f][c+1] + p[f+1][c] - p[f][c]
// y un rectángulo (f1,c1)-(f2,c2) INCLUSIVO suma:
//   p[f2+1][c2+1] - p[f1][c2+1] - p[f2+1][c1] + p[f1][c1]

vector<vector<long long>> construirPrefijo2D(const Matriz& m)
{
    size_t filas = m.size();
    size_t columnas = filas == 0 ? 0 : m[0].size();
    vector<vector<long long>> p(filas + 1, vector<long long>(columnas + 1, 0));
    for (size_t f = 0; f < filas; f++) {
        for (size_t c = 0; c < columnas; c++) {
            p[f + 1][c + 1] = m[f][c] + p[f][c + 1] + p[f + 1][c] - p[f][c];
        }
    }
    return p;
}

long long sumaRectangulo(const vector<vector<long long>>& p, int f1, int c1, int f2, int c2)
{
    return p[f2 + 1][c2 + 1] - p[f1][c2 + 1] - p[f2 + 1][c1] + p[f1][c1];
}

// ── 5c. Diferencias: el truco inverso ──
// Si en vez de CONSULTAR rangos muchas veces tienes que ACTUALIZARLOS muchas veces ("suma 5 a las posiciones 2..6"),
// guarda las DIFERENCIAS: dif[l] += v y dif[r+1] -= v cuestan O(1); al final una suma prefija reconstruye el resultado.
// Las diferencias son a las sumas prefijas lo que la resta es a la suma.

/** n ceros a los que se aplican operaciones {desde, hasta, valor} (inclusivas) en O(n + operaciones). */
vector<long long> aplicarRangos(int n, const vector<array<int, 3>>& operaciones)
{
    vector<long long> dif(static_cast<size_t>(n) + 1, 0);       // una posición de más para r+1 == n
    for (const auto& [desde, hasta, valor] : operaciones) {
        dif[static_cast<size_t>(desde)] += valor;
        dif[static_cast<size_t>(hasta) + 1] -= valor;
    }
    vector<long long> resultado(static_cast<size_t>(n), 0);
    long long acumulado = 0;
    for (size_t i = 0; i < static_cast<size_t>(n); i++) {
        acumulado += dif[i];
        resultado[i] = acumulado;
    }
    return resultado;
}

// Decodifica texto UTF-8 en sus puntos de código (un emoji o una tilde = UN elemento). Lo usa el ejercicio 6.
vector<char32_t> puntosDeCodigo(const string& s)
{
    vector<char32_t> r;
    for (size_t i = 0; i < s.size();) {
        unsigned char c = static_cast<unsigned char>(s[i]);
        size_t extra = c < 0x80 ? 0 : (c >> 5) == 6 ? 1 : (c >> 4) == 14 ? 2 : (c >> 3) == 30 ? 3 : 0;
        char32_t cp = extra == 0 ? c : (c & (0x3Fu >> extra));
        for (size_t k = 1; k <= extra && i + k < s.size(); k++) {
            cp = (cp << 6) | (static_cast<unsigned char>(s[i + k]) & 0x3Fu);
        }
        i += extra + 1;
        r.push_back(cp);
    }
    return r;
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · busquedaBinaria ───────────────────────────────────────────
/**
 * Índice de x en el vector ORDENADO ascendente, o -1 si no está. Debe ser O(log n).
 * Si hay repetidos, vale cualquier posición válida (las pruebas no los incluyen).
 * Hazla a mano (no con std::binary_search, que solo dice si está): es la plantilla que debes dominar.
 * Cuidado con: `size() - 1` en un vector vacío (size_t sin signo) y con el desbordamiento de (bajo + alto) / 2.
 */
int busquedaBinaria(const VI& ordenado, int x)
{
    return pendiente();
}

// ── Ejercicio 2 · limiteInferior ────────────────────────────────────────────
/**
 * Primera posición cuyo valor es MAYOR O IGUAL que x (el "lower bound"); ordenado.size() si todos son menores.
 * Con repetidos devuelve la PRIMERA aparición. Es la búsqueda binaria que más se usa en la práctica
 * (insertar en una lista ordenada, contar cuántos hay menores que x...). O(log n).
 * Impleméntala con la plantilla semiabierta (bajo < alto) sin llamar a std::lower_bound.
 *
 *   limiteInferior({1, 3, 3, 3, 7}, 3)  →  1        limiteInferior({1, 3, 7}, 5)  →  2
 */
int limiteInferior(const VI& ordenado, int x)
{
    return pendiente();
}

// ── Ejercicio 3 · parSuma (dos punteros) ────────────────────────────────────
/**
 * En un vector ordenado ascendente, busca dos posiciones i < j cuyos valores sumen `objetivo` y devuelve {i, j};
 * nullopt si no hay. Usa dos punteros desde los extremos: O(n). (Las pruebas solo tienen una solución posible.)
 * Pista: el tipo optional<Par> se rellena con `return Par{i, j};` y se vacía con `return nullopt;`.
 */
optional<Par> parSuma(const VI& ordenado, int objetivo)
{
    pendiente();         // (con optional hace falta un return después: sustituye estas dos líneas por tu código)
    return nullopt;
}

// ── Ejercicio 4 · dosSumas (tabla hash) ─────────────────────────────────────
/**
 * Como el anterior, pero el vector NO está ordenado: devuelve las posiciones {i, j} (i < j) de dos números que
 * suman `objetivo`, o nullopt. O(n) con un unordered_map de "valor ya visto → posición".
 * Cuidado: objetivo - nums[i] puede desbordar un int si los datos son enormes (aquí no lo serán).
 */
optional<Par> dosSumas(const VI& nums, int objetivo)
{
    pendiente();         // (con optional hace falta un return después: sustituye estas dos líneas por tu código)
    return nullopt;
}

// ── Ejercicio 5 · sumaMaximaVentana ─────────────────────────────────────────
/**
 * La mayor suma de k elementos CONSECUTIVOS. O(n) con ventana deslizante.
 * k < 1 o k > a.size() → lanza invalid_argument.
 * Devuelve long long: la suma de varios int cerca de 2·10⁹ no cabe en un int.
 *   sumaMaximaVentana({2, 1, 5, 1, 3, 2}, 3)  →  9   (5 + 1 + 3)
 */
long long sumaMaximaVentana(const VI& a, int k)
{
    return pendiente();
}

// ── Ejercicio 6 · subcadenaSinRepetir ───────────────────────────────────────
/**
 * Longitud de la subcadena más larga SIN caracteres repetidos (ventana deslizante + tabla de últimas posiciones).
 * El texto es UTF-8: cuenta CARACTERES, no bytes. Para eso tienes la función puntosDeCodigo(s) (arriba), que te
 * devuelve un vector<char32_t> con un elemento por carácter (una tilde o un emoji = 1). O(n).
 *   "abcabcbb" → 3 ("abc")      "bbbbb" → 1      "pwwkew" → 3 ("wke")      "" → 0
 */
int subcadenaSinRepetir(const string& s)
{
    return pendiente();
}

// ── Ejercicio 7 · agruparAnagramas ──────────────────────────────────────────
/**
 * Agrupa las palabras que son anagramas entre sí (mismas letras, distinto orden). Los grupos salen en el orden
 * de la primera palabra de cada uno, y dentro de cada grupo se respeta el orden de entrada. Distingue minúsculas.
 *   {"rata", "tara", "sol", "los", "arta", "pez"}  →  {{"rata", "tara", "arta"}, {"sol", "los"}, {"pez"}}
 * Pista: dos palabras son anagramas si tienen las mismas letras ORDENADAS: esa es la clave del grupo. Como el
 * unordered_map no conserva el orden, guarda aparte el índice de cada grupo (clave → posición en el resultado).
 */
VVS agruparAnagramas(const VS& palabras)
{
    return pendiente();
}

// ── Ejercicio 8 · SumasPrefijas ─────────────────────────────────────────────
/**
 * Prepara un vector una vez (O(n)) para responder "¿cuánto suman las posiciones desde..hasta (inclusive)?"
 * en O(1). Un rango inválido (desde < 0, hasta fuera del vector o desde > hasta) lanza out_of_range.
 * Añade en la parte private: los campos que necesites (¿qué guardarás? ¡long long!).
 */
class SumasPrefijas {
public:
    SumasPrefijas(const VI& valores)
    {
        pendiente();
    }

    long long suma(int desde, int hasta) const
    {
        return pendiente();
    }

private:
    // aquí tus campos
};

// ── Ejercicio 9 · raizEntera (búsqueda binaria sobre la respuesta) ──────────
/**
 * La parte entera de la raíz cuadrada de n (el mayor r con r·r <= n), SIN usar sqrt: búsqueda binaria sobre r. O(log n).
 * n < 0 → lanza invalid_argument. Debe funcionar hasta n = LLONG_MAX (9 223 372 036 854 775 807).
 * Trampa: `medio * medio` desborda un long long con n grande (comportamiento indefinido): compara `medio <= n / medio`.
 *   raizEntera(15) → 3      raizEntera(16) → 4      raizEntera(0) → 0
 */
long long raizEntera(long long n)
{
    return pendiente();
}

// ── Ejercicio 10 · SumasPrefijas2D ──────────────────────────────────────────
/**
 * Sumas prefijas en dos dimensiones sobre una matriz de enteros (todas las filas con las mismas columnas):
 *  - el constructor construye la tabla en O(filas · columnas);
 *  - suma(f1, c1, f2, c2) devuelve la suma del rectángulo con esquina superior izquierda (f1,c1) e inferior derecha
 *    (f2,c2), ambas INCLUSIVAS, en O(1). Un rectángulo inválido (fuera de la matriz o f1 > f2 o c1 > c2) lanza out_of_range.
 */
class SumasPrefijas2D {
public:
    SumasPrefijas2D(const Matriz& m)
    {
        pendiente();
    }

    long long suma(int f1, int c1, int f2, int c2) const
    {
        return pendiente();
    }

private:
    // aquí tus campos
};

// ── Ayudas para medir ───────────────────────────────────────────────────────
/** Texto de n letras minúsculas pseudoaleatorias (siempre el mismo para el mismo n). */
string textoAleatorio(int n)
{
    string s;
    for (int x : aleatorios(n, 25, 7)) {
        s += static_cast<char>('a' + x);
    }
    return s;
}

// ════════════════════════════════════════════════════════════════════════════
int main()
{
// ════════════════════════════════════════════════════════════════════════════
// 1. BÚSQUEDA LINEAL FRENTE A BINARIA
// ════════════════════════════════════════════════════════════════════════════
    titulo("1. Lineal frente a binaria");

    const VI datos = rango(0, 1000000, 2);              // 500 001 números pares, ordenados
    for (int buscado : {1000, 777776, 999999}) {
        auto [i1, p1] = lineal(datos, buscado);
        auto [i2, p2] = binariaConPasos(datos, buscado);
        cout << "buscando " << setw(7) << buscado << " → lineal: pos " << setw(6) << i1 << " en " << setw(6) << p1
             << " pasos · binaria: pos " << setw(6) << i2 << " en " << setw(2) << p2 << " pasos\n";
    }
    cout << "(999999 es impar: no está, y la lineal lo comprueba todo)\n";

    // ── 1b. La biblioteca estándar ──
    {
        VI v = {1, 3, 3, 3, 7, 9};
        auto inf = lower_bound(v.begin(), v.end(), 3);
        auto sup = upper_bound(v.begin(), v.end(), 3);
        cout << "v = " << mostrar(v) << "\n";
        cout << "lower_bound(3) → posición " << inf - v.begin() << " · upper_bound(3) → posición " << sup - v.begin()
             << " · hay " << sup - inf << " treses\n";
        cout << "binary_search(7) = " << boolalpha << binary_search(v.begin(), v.end(), 7)
             << " · binary_search(8) = " << binary_search(v.begin(), v.end(), 8) << "\n";
        auto sitio = lower_bound(v.begin(), v.end(), 5) - v.begin();
        cout << "el 5 no está, pero lower_bound dice dónde INSERTARLO para seguir ordenado: posición " << sitio << "\n";
        if (lower_bound(v.begin(), v.end(), 100) == v.end()) {
            cout << "lower_bound(100) == end(): ¡no se puede desreferenciar!\n";
        }
        v.insert(v.begin() + sitio, 5);                 // insertar en el vector es O(n) (desplaza), aunque localizar sea O(log n)
        cout << "tras insertar el 5: " << mostrar(v) << "\n";
    }

    // ── 1c. Binaria sobre la respuesta ──
    {
        VI pesos = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10};
        cout << "capacidad mínima para enviar 1..10 en 5 días: " << capacidadMinima(pesos, 5) << " (comprobando solo ~6 capacidades)\n";
        cout << "y en 1 día: " << capacidadMinima(pesos, 1) << " (todo junto) · en 10 días: " << capacidadMinima(pesos, 10) << " (el más pesado)\n";
    }

// ════════════════════════════════════════════════════════════════════════════
// 2. DOS PUNTEROS
// ════════════════════════════════════════════════════════════════════════════
    titulo("2. Dos punteros");

    cout << "buscando el par que suma 10 en {1,2,4,7,8,11}:\n";
    auto par = parConSuma({1, 2, 4, 7, 8, 11}, 10);      // (primero se calcula, luego se imprime: la traza sale antes)
    cout << "  → " << mostrar(par) << "\n";

    // ── 2b. Lectura y escritura ──
    {
        VI repetidos = {1, 1, 2, 2, 2, 3, 5, 5, 9};
        quitarRepetidos(repetidos);
        cout << "sin repetidos: " << mostrar(repetidos) << "\n";
    }

// ════════════════════════════════════════════════════════════════════════════
// 3. VENTANA DESLIZANTE
// ════════════════════════════════════════════════════════════════════════════
    titulo("3. Ventana deslizante");

    cout << "media móvil (k = 3) de {1,2,3,4,5,6}: " << mostrar(mediaMovil({1, 2, 3, 4, 5, 6}, 3)) << "\n";
    // ── 3b. Ventana variable ──
    cout << "tramo más largo con suma <= 8 en {3,1,2,1,1,5,1}: " << tramoMasLargoConSumaMaxima({3, 1, 2, 1, 1, 5, 1}, 8) << " (3+1+2+1+1)\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. TABLAS HASH: "¿LO HE VISTO YA?"
// ════════════════════════════════════════════════════════════════════════════
    titulo("4. Tablas hash");

    cout << "primer carácter único de \"aabbcdd\": " << mostrar(primerUnico("aabbcdd")) << "\n";
    cout << "dos sumas a 9 en {2,7,11,15}:\n";
    auto posiciones = dosSumasTraza({2, 7, 11, 15}, 9);
    cout << "  → posiciones " << mostrar(posiciones) << "\n";

    // ── 4b. Claves propias y la trampa de operator[] ──
    {
        unordered_map<int, int> m;
        if (m[42] == 0) {                               // ¡esta simple consulta inserta la clave 42!
            cout << "tras consultar m[42] el mapa ya tiene " << m.size() << " entrada (la consulta INSERTÓ)\n";
        }
        cout << "m.count(7) = " << m.count(7) << " y sigue teniendo " << m.size() << " entrada (count no inserta)\n";

        unordered_set<Par, HashPar> visitadas;           // casillas (fila, columna) ya visitadas
        visitadas.insert({0, 1});
        visitadas.insert({2, 3});
        visitadas.insert({0, 1});                        // repetida: un set no guarda duplicados
        cout << "casillas visitadas: " << visitadas.size() << " · ¿(2,3)? " << boolalpha << (visitadas.count({2, 3}) > 0) << "\n";
    }

// ════════════════════════════════════════════════════════════════════════════
// 5. SUMAS PREFIJAS
// ════════════════════════════════════════════════════════════════════════════
    titulo("5. Sumas prefijas");

    {
        VI valores = {3, 1, 4, 1, 5, 9, 2, 6};
        auto prefijo = construirPrefijo(valores);
        cout << "prefijo: " << mostrar(prefijo) << "\n";
        cout << "suma de las posiciones 2..5: " << prefijo[6] - prefijo[2] << " (4+1+5+9 = " << 4 + 1 + 5 + 9 << ")\n";

        // La biblioteca ya trae la construcción: partial_sum (o inclusive_scan en <numeric>)
        vector<long long> otro(valores.size());
        partial_sum(valores.begin(), valores.end(), otro.begin());
        cout << "partial_sum (sin el 0 inicial): " << mostrar(otro) << "\n";
    }

    // ── 5b. Sumas prefijas en 2D ──
    {
        Matriz m = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
        auto p = construirPrefijo2D(m);
        cout << "suma del rectángulo (1,1)-(2,2) de la matriz 3×3: " << sumaRectangulo(p, 1, 1, 2, 2) << " (5+6+8+9)\n";
        cout << "suma de toda la matriz: " << sumaRectangulo(p, 0, 0, 2, 2) << "\n";
    }

    // ── 5c. Diferencias ──
    cout << "5 posiciones tras sumar 5 en 0..2 y 2 en 1..3: " << mostrar(aplicarRangos(5, {{0, 2, 5}, {1, 3, 2}})) << "\n";

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

    prueba(busquedaBinaria,
        caso("en medio", 2, VI{1, 3, 5, 7, 9}, 5),
        caso("el primero", 0, VI{1, 3, 5, 7, 9}, 1),
        caso("el último", 4, VI{1, 3, 5, 7, 9}, 9),
        caso("no está (en medio)", -1, VI{1, 3, 5, 7, 9}, 4),
        caso("menor que todos", -1, VI{1, 3, 5}, -10),
        caso("mayor que todos", -1, VI{1, 3, 5}, 99),
        caso("vector vacío", -1, VI{}, 1),
        caso("un elemento (está)", 0, VI{4}, 4),
        caso("un elemento (no está)", -1, VI{4}, 5),
        caso("negativos", 1, VI{-9, -4, 0, 3}, -4),
        caso("extremos del int", 2, VI{INT_MIN, 0, INT_MAX}, INT_MAX));

    prueba(limiteInferior,
        caso("con repetidos: la primera", 1, VI{1, 3, 3, 3, 7}, 3),
        caso("no está: donde iría", 2, VI{1, 3, 7}, 5),
        caso("menor que todos", 0, VI{1, 3, 7}, 0),
        caso("mayor que todos", 3, VI{1, 3, 7}, 100),
        caso("vacío", 0, VI{}, 5),
        caso("todos iguales", 0, VI{2, 2, 2, 2}, 2),
        caso("el último", 2, VI{1, 2, 3}, 3));

    prueba(parSuma,
        caso("básico", Par{1, 4}, VI{1, 2, 4, 7, 8, 11}, 10),
        caso("extremos", Par{0, 2}, VI{1, 5, 9}, 10),
        caso("no hay", nullopt, VI{1, 2, 3}, 100),
        caso("vector corto", nullopt, VI{5}, 5),
        caso("negativos", Par{1, 3}, VI{-4, -1, 3, 8}, 7),
        caso("vacío", nullopt, VI{}, 0));

    prueba(dosSumas,
        caso("clásico", Par{0, 1}, VI{2, 7, 11, 15}, 9),
        caso("desordenado", Par{1, 2}, VI{3, 2, 4}, 6),
        caso("con repetidos", Par{0, 1}, VI{3, 3}, 6),
        caso("no hay", nullopt, VI{1, 2, 3}, 10),
        caso("vacío", nullopt, VI{}, 3),
        caso("con negativos", Par{0, 2}, VI{-3, 4, 3, 90}, 0));

    prueba(sumaMaximaVentana,
        caso("ejemplo", 9, VI{2, 1, 5, 1, 3, 2}, 3),
        caso("ventana de 1", 8, VI{4, 8, 2}, 1),
        caso("ventana = vector", 6, VI{1, 2, 3}, 3),
        caso("con negativos", -4, VI{-5, -1, -3, -2}, 2),
        caso("al final", 18, VI{1, 1, 1, 9, 9}, 2),
        caso("no desborda el int", 2LL * INT_MAX, VI{INT_MAX, INT_MAX, 1}, 2));
    grupo("sumaMaximaVentana()");
    lanza("k mayor que el vector", [&] { sumaMaximaVentana({1, 2}, 3); }, invalid_argument);
    lanza("k cero", [&] { sumaMaximaVentana({1, 2}, 0); }, invalid_argument);

    prueba(subcadenaSinRepetir,
        caso("abcabcbb", 3, string("abcabcbb")),
        caso("todos iguales", 1, string("bbbbb")),
        caso("pwwkew", 3, string("pwwkew")),
        caso("vacía", 0, string("")),
        caso("sin repeticiones", 6, string("abcdef")),
        caso("se repite al principio", 2, string("abba")),
        caso("con tildes", 5, string("áéíóúáé")),
        caso("con emojis", 3, string("😀😎😀🎉")));

    prueba(agruparAnagramas,
        caso("ejemplo", VVS{{"rata", "tara", "arta"}, {"sol", "los"}, {"pez"}}, VS{"rata", "tara", "sol", "los", "arta", "pez"}),
        caso("ninguno", VVS{{"a"}, {"b"}, {"c"}}, VS{"a", "b", "c"}),
        caso("vacía", VVS{}, VS{}),
        caso("repetidas", VVS{{"ab", "ba", "ab"}}, VS{"ab", "ba", "ab"}),
        caso("distinta longitud", VVS{{"a"}, {"aa"}, {"aaa"}}, VS{"a", "aa", "aaa"}));

    grupo("SumasPrefijas");
    comprueba("rango en medio", [&] { return SumasPrefijas({3, 1, 4, 1, 5, 9, 2, 6}).suma(2, 5); }, 19);
    comprueba("un solo elemento", [&] { return SumasPrefijas({3, 1, 4}).suma(1, 1); }, 1);
    comprueba("toda la lista", [&] { return SumasPrefijas({1, 2, 3, 4}).suma(0, 3); }, 10);
    comprueba("con negativos", [&] { return SumasPrefijas({5, -2, -3, 4}).suma(1, 2); }, -5);
    comprueba("muchas consultas", [&] {
        SumasPrefijas s(numeros(100));
        return vector<long long>{s.suma(0, 99), s.suma(10, 19), s.suma(99, 99)};
    }, vector<long long>{5050, 155, 100});
    comprueba("no desborda el int", [&] { return SumasPrefijas({INT_MAX, INT_MAX, INT_MAX}).suma(0, 2); }, 3LL * INT_MAX);
    lanza("desde negativo", [&] { SumasPrefijas({1, 2}).suma(-1, 1); }, out_of_range);
    lanza("hasta fuera de la lista", [&] { SumasPrefijas({1, 2}).suma(0, 2); }, out_of_range);
    lanza("desde mayor que hasta", [&] { SumasPrefijas({1, 2, 3}).suma(2, 1); }, out_of_range);

    prueba(raizEntera,
        caso("cero", 0, 0LL),
        caso("uno", 1, 1LL),
        caso("no exacta", 1, 3LL),
        caso("cuadrado perfecto", 2, 4LL),
        caso("justo debajo de un cuadrado", 3, 15LL),
        caso("cuadrado perfecto 16", 4, 16LL),
        caso("99", 9, 99LL),
        caso("100", 10, 100LL),
        caso("un int grande", 46340, 2147483647LL),
        caso("10^18", 1000000000, 1000000000000000000LL),
        caso("LLONG_MAX (sin desbordar)", 3037000499LL, LLONG_MAX));
    lanza("negativo", [&] { raizEntera(-1); }, invalid_argument);

    grupo("SumasPrefijas2D");
    comprueba("toda la matriz", [&] { return SumasPrefijas2D({{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}).suma(0, 0, 2, 2); }, 45);
    comprueba("rectángulo interior", [&] { return SumasPrefijas2D({{1, 2, 3}, {4, 5, 6}, {7, 8, 9}}).suma(1, 1, 2, 2); }, 28);
    comprueba("una sola celda", [&] { return SumasPrefijas2D({{1, 2}, {3, 4}}).suma(1, 0, 1, 0); }, 3);
    comprueba("con negativos", [&] { return SumasPrefijas2D({{-1, 2}, {3, -4}}).suma(0, 0, 1, 1); }, 0);
    comprueba("muchas consultas", [&] {
        Matriz m(50, VI(50, 2));
        SumasPrefijas2D s(m);
        return vector<long long>{s.suma(0, 0, 49, 49), s.suma(10, 10, 19, 29), s.suma(5, 5, 5, 5)};
    }, vector<long long>{5000, 400, 2});
    lanza("fuera de la matriz", [&] { SumasPrefijas2D({{1, 2}, {3, 4}}).suma(0, 0, 2, 1); }, out_of_range);
    lanza("esquinas al revés", [&] { SumasPrefijas2D({{1, 2}, {3, 4}}).suma(1, 1, 0, 0); }, out_of_range);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    medir(busquedaBinaria, numeros(n), n - 1);                      // O(log n) (un bucle: O(n))
    medir(parSuma, numeros(n), -1);                                 // O(n) (con bucle doble: O(n²))
    medir(dosSumas, numeros(n), -1);                                // O(n) (con bucle doble: O(n²))
    medir(sumaMaximaVentana, numeros(n), n / 2);                    // O(n) (recalculando cada ventana: O(n²))
    medir(subcadenaSinRepetir, textoAleatorio(n));                  // O(n)
    medirCon("SumasPrefijas",
             [](int n) { return make_pair(SumasPrefijas(numeros(n)), n); },
             [](auto& e) {                                      // una consulta dura nanosegundos: se hacen 1000 seguidas
                 long long total = 0;
                 for (int i = 0; i < 1000; i++) {
                     total += e.first.suma(i % 2, e.second - 1);
                 }
                 return total;
             });                                                // O(1) por consulta (sumando el rango en cada consulta: O(n))
}
