#include <algorithm>
#include <climits>
#include <optional>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 6 · Búsqueda y técnicas clásicas
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Búsqueda binaria de un valor exacto.
 *
 * @complejidad Tiempo O(log n); espacio O(1).
 * @explicacion Invariante: si x está, está en el rango CERRADO [bajo, alto]. Cada vuelta mira el medio y descarta
 * la mitad que no puede contenerlo, así que el rango se parte en dos y hacen falta ~log₂ n vueltas. Tres detalles
 * propios de C++: `alto` empieza en `static_cast<int>(size()) - 1` (con size_t, un vector vacío daría 2⁶⁴ - 1 y se
 * saldría de la memoria: comportamiento indefinido); el medio se calcula como `bajo + (alto - bajo) / 2` para que la
 * suma no desborde el int; y se avanza siempre `medio ± 1` (si no, el bucle puede no terminar).
 * @alternativas `binary_search` de <algorithm> solo responde "¿está?"; con `lower_bound` + comprobar el elemento
 * se obtiene también la posición. Recursiva: mismo coste, pero con O(log n) de pila.
 * @bigo log
 */
int busquedaBinaria(const vector<int>& ordenado, int x)
{
    int bajo = 0;
    int alto = static_cast<int>(ordenado.size()) - 1;
    while (bajo <= alto) {
        int medio = bajo + (alto - bajo) / 2;
        if (ordenado[medio] == x) {
            return medio;
        }
        if (ordenado[medio] < x) {
            bajo = medio + 1;
        } else {
            alto = medio - 1;
        }
    }
    return -1;
}

/**
 * Límite inferior (primera posición con valor >= x).
 *
 * @complejidad Tiempo O(log n); espacio O(1).
 * @explicacion Plantilla SEMIABIERTA: la respuesta está en [bajo, alto) y `alto = size()` significa "ninguno es >= x".
 * Si ordenado[medio] < x, medio no puede ser la respuesta y se sube `bajo = medio + 1`; si no, medio PODRÍA serlo y se
 * conserva con `alto = medio` (sin restar 1). Al juntarse los dos extremos queda la primera posición que cumple. Con
 * repetidos devuelve la primera aparición porque nunca descarta un candidato válido más a la izquierda.
 * @alternativas `lower_bound(v.begin(), v.end(), x) - v.begin()` hace exactamente esto. `upper_bound` es la misma
 * plantilla con `<=` en lugar de `<`.
 * @bigo log
 */
int limiteInferior(const vector<int>& ordenado, int x)
{
    int bajo = 0;
    int alto = static_cast<int>(ordenado.size());
    while (bajo < alto) {
        int medio = bajo + (alto - bajo) / 2;
        if (ordenado[medio] < x) {
            bajo = medio + 1;
        } else {
            alto = medio;
        }
    }
    return bajo;
}

/**
 * Par con suma objetivo en un vector ordenado (dos punteros).
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Un puntero al principio y otro al final. Si la suma es menor que el objetivo, el menor de los dos no
 * puede emparejarse con NINGÚN elemento restante (el mayor ya era lo máximo que podía sumarle), así que se descarta
 * avanzando `i`; si es mayor, se descarta el mayor retrocediendo `j`. Cada paso elimina un candidato: como mucho n
 * pasos. `i < j` evita emparejar un elemento consigo mismo.
 * @alternativas Dos bucles anidados: O(n²). Una tabla hash sirve aunque el vector no esté ordenado (ejercicio siguiente),
 * pero gasta O(n) de memoria; los dos punteros no.
 * @bigo n
 */
optional<pair<int, int>> parSuma(const vector<int>& ordenado, int objetivo)
{
    int i = 0;
    int j = static_cast<int>(ordenado.size()) - 1;
    while (i < j) {
        long long suma = static_cast<long long>(ordenado[i]) + ordenado[j];
        if (suma == objetivo) {
            return pair<int, int>{i, j};
        }
        if (suma < objetivo) {
            i++;
        } else {
            j--;
        }
    }
    return nullopt;
}

/**
 * Dos sumas con una tabla hash.
 *
 * @complejidad Tiempo O(n) de media; espacio O(n).
 * @explicacion Para cada número se busca si ya se vio su complemento (`objetivo - n`). Si está, ya se tiene el par;
 * si no, se guarda `n → posición` y se sigue. Se consulta ANTES de insertar para no emparejar un número consigo mismo, y
 * se usa `find` en lugar de `vistos[falta]`, que insertaría una entrada vacía por cada consulta. Se usa long long
 * para el complemento por si los datos están cerca de los límites del int.
 * @alternativas Fuerza bruta con dos bucles: O(n²). Ordenar conservando posiciones y usar dos punteros: O(n log n)
 * sin tabla hash.
 * @bigo n
 */
optional<pair<int, int>> dosSumas(const vector<int>& nums, int objetivo)
{
    unordered_map<long long, int> vistos;
    vistos.reserve(nums.size());
    for (int i = 0; i < static_cast<int>(nums.size()); i++) {
        long long falta = static_cast<long long>(objetivo) - nums[i];
        auto it = vistos.find(falta);
        if (it != vistos.end()) {
            return pair<int, int>{it->second, i};
        }
        vistos[nums[i]] = i;
    }
    return nullopt;
}

/**
 * Mayor suma de k elementos consecutivos (ventana deslizante).
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Se suman los k primeros una vez y luego se desliza: al avanzar una posición entra `a[i]` y sale
 * `a[i - k]`, así que cada paso cuesta O(1) en vez de O(k). La suma se acumula en long long (varios int pueden
 * superar los 2 147 483 647) y el valor inicial es `0LL`: con `0` la suma de `accumulate` sería de tipo int.
 * k se valida primero: sin eso, `begin() + k` se saldría del vector.
 * @alternativas Recalcular cada ventana: O(n·k). Con una cola doble (deque) se obtiene el máximo de cada ventana
 * en O(n) para el problema "máximo móvil".
 * @bigo n
 */
long long sumaMaximaVentana(const vector<int>& a, int k)
{
    if (k < 1 || static_cast<size_t>(k) > a.size()) {
        throw invalid_argument("k debe estar entre 1 y el tamaño del vector");
    }
    long long suma = 0;
    for (int i = 0; i < k; i++) {
        suma += a[i];
    }
    long long mejor = suma;
    for (int i = k; i < static_cast<int>(a.size()); i++) {
        suma += a[i] - a[i - k];
        mejor = max(mejor, suma);
    }
    return mejor;
}

/**
 * Subcadena más larga sin caracteres repetidos.
 *
 * @complejidad Tiempo O(n); espacio O(alfabeto).
 * @explicacion Ventana [inicio, i] sin repetidos. Una tabla guarda la ÚLTIMA posición de cada carácter; si el carácter
 * actual ya estaba dentro de la ventana, el inicio salta justo detrás de esa aparición (nunca retrocede: por eso el
 * `max`). Cada carácter se procesa una vez. El texto se decodifica antes a puntos de código, porque un `std::string`
 * guarda bytes: en UTF-8 una tilde ocupa 2 y un emoji 4, y contar bytes daría resultados erróneos.
 * @alternativas Un `unordered_set` con dos punteros que encoge la ventana de uno en uno: también O(n) pero con más
 * pasos. Para ASCII puro, un `array<int, 256>` en lugar de la tabla hash es más rápido.
 * @bigo n
 */
int subcadenaSinRepetir(const string& s)
{
    vector<char32_t> letras = puntosDeCodigo(s);
    unordered_map<char32_t, int> ultima;
    int mejor = 0;
    int inicio = 0;
    for (int i = 0; i < static_cast<int>(letras.size()); i++) {
        auto it = ultima.find(letras[i]);
        if (it != ultima.end()) {
            inicio = max(inicio, it->second + 1);
        }
        ultima[letras[i]] = i;
        mejor = max(mejor, i - inicio + 1);
    }
    return mejor;
}

/**
 * Agrupar anagramas.
 *
 * @complejidad Tiempo O(n · L log L) con L la longitud de las palabras; espacio O(n · L).
 * @explicacion La clave de cada palabra son sus letras ORDENADAS: dos palabras son anagramas si y solo si comparten
 * clave. Un `unordered_map` lleva de la clave al índice de su grupo dentro del resultado; así los grupos salen en el
 * orden de la primera palabra de cada uno (el mapa por sí solo no conserva el orden) y dentro de cada grupo se
 * respeta el orden de entrada.
 * @alternativas Clave por recuento de letras (un `array<int, 26>`): O(n · L) sin ordenar. Un `map` ordenaría los
 * grupos por clave, no por aparición, y no cumpliría lo pedido.
 */
vector<vector<string>> agruparAnagramas(const vector<string>& palabras)
{
    vector<vector<string>> grupos;
    unordered_map<string, size_t> indice;
    for (const string& palabra : palabras) {
        string clave = palabra;
        sort(clave.begin(), clave.end());
        auto [it, nuevo] = indice.try_emplace(clave, grupos.size());
        if (nuevo) {
            grupos.emplace_back();
        }
        grupos[it->second].push_back(palabra);
    }
    return grupos;
}

/**
 * Sumas prefijas para consultas de rango en O(1).
 *
 * @complejidad Construir O(n); cada consulta O(1); espacio O(n).
 * @explicacion `prefijo[i]` guarda la suma de los primeros i elementos (con `prefijo[0] = 0`), así que la suma de
 * `desde..hasta` es `prefijo[hasta + 1] - prefijo[desde]`: la parte común se cancela. El trabajo pesado se paga
 * una vez en el constructor y cada pregunta posterior es una resta. El acumulado es long long: con int, 100 000
 * valores grandes desbordarían sin avisar.
 * @alternativas Sumar el rango en cada consulta: O(n) por consulta, de modo que q consultas cuestan O(n·q). Un
 * árbol de Fenwick o de segmentos si además hay que ACTUALIZAR valores.
 * @bigo 1
 */
class SumasPrefijas {
public:
    SumasPrefijas(const vector<int>& valores) : prefijo_(valores.size() + 1, 0)
    {
        for (size_t i = 0; i < valores.size(); i++) {
            prefijo_[i + 1] = prefijo_[i] + valores[i];
        }
    }

    long long suma(int desde, int hasta) const
    {
        if (desde < 0 || hasta >= static_cast<int>(prefijo_.size()) - 1 || desde > hasta) {
            throw out_of_range("Rango no válido");
        }
        return prefijo_[static_cast<size_t>(hasta) + 1] - prefijo_[static_cast<size_t>(desde)];
    }

private:
    vector<long long> prefijo_;
};

/**
 * Raíz cuadrada entera por búsqueda binaria sobre la respuesta.
 *
 * @complejidad Tiempo O(log n); espacio O(1).
 * @explicacion "r·r <= n" es verdadero para r = 0, 1, ..., raíz y falso a partir de ahí: un predicado MONÓTONO, así que
 * se busca la frontera con búsqueda binaria entre 0 y min(n, 3 037 000 499) (el mayor r cuyo cuadrado cabe en un
 * long long). Para no desbordar nunca se compara `medio <= n / medio` en lugar de `medio * medio <= n`. Se busca el
 * último valor que cumple, así que se inclina el medio hacia arriba (`+ 1`) para no quedarse en un bucle infinito.
 * @alternativas Newton (x ← (x + n/x)/2) converge en pocas vueltas. `sqrt` en double pierde precisión con n mayores
 * que 2⁵³ y obliga a corregir el resultado a mano.
 * @bigo log
 */
long long raizEntera(long long n)
{
    if (n < 0) {
        throw invalid_argument("n no puede ser negativo");
    }
    if (n == 0) {
        return 0;
    }
    long long bajo = 1;
    long long alto = min(n, 3037000499LL);
    while (bajo < alto) {
        long long medio = bajo + (alto - bajo + 1) / 2;     // medio hacia arriba
        if (medio <= n / medio) {
            bajo = medio;                                   // medio sirve: la respuesta es medio o mayor
        } else {
            alto = medio - 1;
        }
    }
    return bajo;
}

/**
 * Sumas prefijas en 2D.
 *
 * @complejidad Construir O(filas · columnas); cada consulta O(1); espacio O(filas · columnas).
 * @explicacion `p[f][c]` es la suma del rectángulo (0,0)-(f-1,c-1), con una fila y una columna de ceros delante para
 * no tratar los bordes aparte. Se rellena por inclusión-exclusión (`m + arriba + izquierda - diagonal`, porque la
 * diagonal se contó dos veces). Un rectángulo cualquiera se obtiene restando las franjas de arriba y de la izquierda y
 * sumando una vez la esquina que se restó dos veces: cuatro lecturas, O(1).
 * @alternativas Sumar el rectángulo celda a celda: O(filas · columnas) por consulta. Con actualizaciones de celdas,
 * un árbol de Fenwick 2D.
 */
class SumasPrefijas2D {
public:
    SumasPrefijas2D(const vector<vector<int>>& m)
        : filas_(static_cast<int>(m.size())),
          columnas_(m.empty() ? 0 : static_cast<int>(m[0].size())),
          p_(static_cast<size_t>(filas_) + 1, vector<long long>(static_cast<size_t>(columnas_) + 1, 0))
    {
        for (size_t f = 0; f < m.size(); f++) {
            for (size_t c = 0; c < m[f].size(); c++) {
                p_[f + 1][c + 1] = m[f][c] + p_[f][c + 1] + p_[f + 1][c] - p_[f][c];
            }
        }
    }

    long long suma(int f1, int c1, int f2, int c2) const
    {
        if (f1 < 0 || c1 < 0 || f2 >= filas_ || c2 >= columnas_ || f1 > f2 || c1 > c2) {
            throw out_of_range("Rectángulo no válido");
        }
        auto fila1 = static_cast<size_t>(f1);
        auto col1 = static_cast<size_t>(c1);
        auto fila2 = static_cast<size_t>(f2) + 1;
        auto col2 = static_cast<size_t>(c2) + 1;
        return p_[fila2][col2] - p_[fila1][col2] - p_[fila2][col1] + p_[fila1][col1];
    }

private:
    int filas_;
    int columnas_;
    vector<vector<long long>> p_;
};
