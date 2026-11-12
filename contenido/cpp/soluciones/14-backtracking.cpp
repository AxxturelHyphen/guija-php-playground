#include <algorithm>
#include <bit>
#include <functional>
#include <numeric>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 14 · Backtracking a fondo
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Paréntesis bien formados.
 *
 * @complejidad Tiempo O(4ⁿ / √n) (Catalan(n) cadenas de longitud 2n); espacio O(n) de recursión sin contar la salida.
 * @explicacion Dos contadores bastan para no construir nunca una cadena mala: se puede abrir mientras `abiertos < n` y cerrar mientras
 * `cerrados < abiertos`. Esa poda de factibilidad mantiene el invariante cerrados ≤ abiertos ≤ n en todo prefijo, así que cada hoja es
 * válida y el trabajo es proporcional a la salida. Probar '(' antes que ')' da el orden lexicográfico. Se deshace con `pop_back` en una única
 * cadena compartida, sin copiar el estado en cada nodo.
 * @alternativas Generar las 2²ⁿ cadenas y filtrar es exponencialmente más lento. Hay también una recurrencia por «primer par»: "(" + A + ")" + B.
 * @bigo exp
 */
vector<string> generarParentesis(int n)
{
    if (n < 0) {
        throw invalid_argument("generarParentesis: n no puede ser negativo");
    }
    vector<string> resultado;
    string actual;
    function<void(int, int)> explorar = [&](int abiertos, int cerrados) {
        if (static_cast<int>(actual.size()) == 2 * n) {
            resultado.push_back(actual);
            return;
        }
        if (abiertos < n) {
            actual.push_back('(');
            explorar(abiertos + 1, cerrados);
            actual.pop_back();
        }
        if (cerrados < abiertos) {
            actual.push_back(')');
            explorar(abiertos, cerrados + 1);
            actual.pop_back();
        }
    };
    explorar(0, 0);
    return resultado;
}

/**
 * Permutaciones distintas.
 *
 * @complejidad Tiempo O(n · P) con P el número de permutaciones distintas (n!/(m₁! m₂! …)); espacio O(n).
 * @explicacion Se ordena una copia y se marcan los usados. En cada nivel se salta un valor ya usado y también uno igual al anterior cuando
 * el anterior NO está usado: probarlo repetiría exactamente las permutaciones que ya dio el anterior (poda de simetría), de modo que entre
 * iguales solo se prueba el primero sin usar. Así cada nodo del árbol lleva a al menos una permutación nueva. Con nueve unos el árbol es
 * un solo camino de 10 nodos en lugar de 9! hojas.
 * @alternativas Generar todas las n! y quitar duplicados con un `set` tiene el coste factorial aunque solo haya una permutación distinta.
 * `next_permutation` sobre el vector ordenado produce también solo las distintas, en orden lexicográfico.
 */
vector<vector<int>> permutacionesUnicas(vector<int> nums, long long* nodos = nullptr)
{
    sort(nums.begin(), nums.end());
    int n = static_cast<int>(nums.size());
    vector<vector<int>> resultado;
    vector<int> actual;
    vector<char> usado(nums.size(), 0);
    function<void()> explorar = [&]() {
        if (nodos != nullptr) {
            ++*nodos;
        }
        if (static_cast<int>(actual.size()) == n) {
            resultado.push_back(actual);
            return;
        }
        for (size_t i = 0; i < nums.size(); i++) {
            if (usado[i] || (i > 0 && nums[i] == nums[i - 1] && !usado[i - 1])) {
                continue;
            }
            usado[i] = 1;
            actual.push_back(nums[i]);
            explorar();
            actual.pop_back();
            usado[i] = 0;
        }
    };
    explorar();
    return resultado;
}

/**
 * Combinaciones que suman un objetivo.
 *
 * @complejidad Tiempo O(2ⁿ) en el peor caso, pero solo se visitan las sumas parciales que no superan el objetivo; espacio O(n).
 * @explicacion Con los candidatos ordenados, en cuanto uno supera lo que falta todos los siguientes también: `break` corta el bucle
 * entero (poda por cota). Para no repetir combinaciones, en un mismo nivel se salta un valor igual al anterior (`i > inicio`): el primero ya
 * exploró todas las combinaciones que empiezan por ese valor, y los repetidos se pueden usar más abajo. Cada llamada recibe `inicio` (solo
 * se mira hacia delante, así que cada elemento se usa una vez y el orden no genera duplicados) y `falta`.
 * @alternativas Programación dinámica si solo hubiera que CONTAR (no listar) las combinaciones: O(n · objetivo).
 */
vector<vector<int>> combinacionesQueSuman(vector<int> candidatos, int objetivo, long long* nodos = nullptr)
{
    if (objetivo < 0) {
        throw invalid_argument("combinacionesQueSuman: el objetivo no puede ser negativo");
    }
    for (int c : candidatos) {
        if (c <= 0) {
            throw invalid_argument("combinacionesQueSuman: los candidatos deben ser positivos");
        }
    }
    sort(candidatos.begin(), candidatos.end());
    vector<vector<int>> resultado;
    vector<int> actual;
    function<void(size_t, int)> explorar = [&](size_t inicio, int falta) {
        if (nodos != nullptr) {
            ++*nodos;
        }
        if (falta == 0) {
            resultado.push_back(actual);
            return;
        }
        for (size_t i = inicio; i < candidatos.size(); i++) {
            if (candidatos[i] > falta) {
                break;
            }
            if (i > inicio && candidatos[i] == candidatos[i - 1]) {
                continue;
            }
            actual.push_back(candidatos[i]);
            explorar(i + 1, falta - candidatos[i]);
            actual.pop_back();
        }
    };
    explorar(0, objetivo);
    return resultado;
}

/**
 * Particiones en palíndromos.
 *
 * @complejidad Tiempo O(n²) para la tabla más O(n · 2ⁿ) en el peor caso por la salida; espacio O(n²).
 * @explicacion La tabla `es[i][j]` (¿s[i..j] es palíndromo?) se rellena con i de mayor a menor porque depende de `es[i+1][j-1]`. Con ella,
 * cada trozo candidato se comprueba en O(1) y solo se baja por los que lo son (poda de factibilidad). `explorar(inicio)` prueba los trozos
 * del más corto al más largo, lo que da el orden esperado, y deshace con `pop_back`.
 * @alternativas Expandir desde cada centro también da la tabla en O(n²). Si solo hiciera falta el MÍNIMO de cortes, bastaría programación dinámica en O(n²).
 */
vector<vector<string>> particionesPalindromos(string s)
{
    int n = static_cast<int>(s.size());
    vector<vector<char>> es(static_cast<size_t>(n), vector<char>(static_cast<size_t>(n), 0));
    for (int i = n - 1; i >= 0; i--) {
        for (int j = i; j < n; j++) {
            es[static_cast<size_t>(i)][static_cast<size_t>(j)] = s[static_cast<size_t>(i)] == s[static_cast<size_t>(j)]
                && (j - i < 2 || es[static_cast<size_t>(i + 1)][static_cast<size_t>(j - 1)]);
        }
    }
    vector<vector<string>> resultado;
    vector<string> actual;
    function<void(int)> explorar = [&](int inicio) {
        if (inicio == n) {
            resultado.push_back(actual);
            return;
        }
        for (int fin = inicio; fin < n; fin++) {
            if (es[static_cast<size_t>(inicio)][static_cast<size_t>(fin)]) {
                actual.push_back(s.substr(static_cast<size_t>(inicio), static_cast<size_t>(fin - inicio + 1)));
                explorar(fin + 1);
                actual.pop_back();
            }
        }
    };
    explorar(0);
    return resultado;
}

/**
 * Palabra en un tablero.
 *
 * @complejidad Tiempo O(F·C · 3ᴸ) en el peor caso (L = longitud de la palabra), ~O(F·C) con letras aleatorias; espacio O(L) de recursión más la copia del tablero.
 * @explicacion Antes de buscar, una pre-poda cuenta las letras: si la palabra pide más ocurrencias de una letra de las que hay, es imposible.
 * Después, desde cada celda con la primera letra se lanza una búsqueda en profundidad `buscar(f, c, k)`, que sale al instante si la celda
 * se sale del tablero, ya se visitó (está marcada con '#') o no coincide con `palabra[k]`. Se marca la celda al entrar y se restaura al salir
 * (deshacer), así que cada celda se usa una vez por camino sin necesitar una matriz de visitadas. La copia por valor protege el tablero del
 * llamador. El `||` en cortocircuito detiene la búsqueda en cuanto una dirección acierta.
 * @alternativas Si la primera letra es más frecuente que la última, buscar la palabra al revés poda más. Un trie sirve para buscar muchas palabras a la vez.
 * @bigo n2
 */
bool palabraEnTablero(vector<string> tablero, string palabra)
{
    if (palabra.empty()) {
        return true;
    }
    int filas = static_cast<int>(tablero.size());
    if (filas == 0) {
        return false;
    }
    int cols = static_cast<int>(tablero[0].size());
    for (const string& fila : tablero) {
        if (static_cast<int>(fila.size()) != cols) {
            throw invalid_argument("palabraEnTablero: las filas deben tener la misma longitud");
        }
    }
    if (static_cast<long long>(palabra.size()) > static_cast<long long>(filas) * cols) {
        return false;
    }
    int hay[256] = {};
    for (const string& fila : tablero) {
        for (char ch : fila) {
            hay[static_cast<unsigned char>(ch)]++;
        }
    }
    int pide[256] = {};
    for (char ch : palabra) {
        if (++pide[static_cast<unsigned char>(ch)] > hay[static_cast<unsigned char>(ch)]) {
            return false;
        }
    }
    function<bool(int, int, size_t)> buscar = [&](int f, int c, size_t k) {
        if (f < 0 || c < 0 || f >= filas || c >= cols || tablero[static_cast<size_t>(f)][static_cast<size_t>(c)] != palabra[k]) {
            return false;
        }
        if (k + 1 == palabra.size()) {
            return true;
        }
        char guardada = tablero[static_cast<size_t>(f)][static_cast<size_t>(c)];
        tablero[static_cast<size_t>(f)][static_cast<size_t>(c)] = '#';
        bool encontrada = buscar(f + 1, c, k + 1) || buscar(f - 1, c, k + 1) || buscar(f, c + 1, k + 1) || buscar(f, c - 1, k + 1);
        tablero[static_cast<size_t>(f)][static_cast<size_t>(c)] = guardada;
        return encontrada;
    };
    for (int f = 0; f < filas; f++) {
        for (int c = 0; c < cols; c++) {
            if (buscar(f, c, 0)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Coloreado de grafos con k colores.
 *
 * @complejidad Tiempo O(kⁿ) en el peor caso; en un camino con k = 2, O(n) porque cada color queda forzado; espacio O(n).
 * @explicacion Se colorean los vértices en orden. Dos podas: factibilidad (se prueba un color solo si ningún vecino ya coloreado lo tiene, comprobado
 * AL ELEGIR) y simetría (un vértice solo puede tomar un color ya usado o el siguiente al mayor usado, porque los colores no tienen nombre propio;
 * así no se repite k! veces cada coloreado). Con K₈ y 7 colores el árbol pasa de ~14 000 nodos a 8. El vértice `v` mira los vecinos con
 * `color[w] == c`; los aún sin colorear valen -1 y no chocan.
 * @alternativas Ordenar los vértices por grado decreciente (o elegir siempre el más restringido, como el DSATUR) poda mucho más. El problema es NP-completo para k ≥ 3.
 * @bigo n
 */
optional<vector<int>> colorearGrafo(const vector<vector<int>>& ady, int k, long long* nodos = nullptr)
{
    if (k < 0) {
        throw invalid_argument("colorearGrafo: k no puede ser negativo");
    }
    int n = static_cast<int>(ady.size());
    vector<int> color(ady.size(), -1);
    function<bool(int, int)> explorar = [&](int v, int usados) {
        if (nodos != nullptr) {
            ++*nodos;
        }
        if (v == n) {
            return true;
        }
        int tope = min(k, usados + 1);
        for (int c = 0; c < tope; c++) {
            bool choca = false;
            for (int w : ady[static_cast<size_t>(v)]) {
                if (color[static_cast<size_t>(w)] == c) {
                    choca = true;
                    break;
                }
            }
            if (choca) {
                continue;
            }
            color[static_cast<size_t>(v)] = c;
            if (explorar(v + 1, max(usados, c + 1))) {
                return true;
            }
            color[static_cast<size_t>(v)] = -1;
        }
        return false;
    };
    if (explorar(0, 0)) {
        return color;
    }
    return nullopt;
}

/**
 * Partición en k subconjuntos de igual suma.
 *
 * @complejidad Tiempo O(kⁿ) en el peor caso; con las podas, práctico para n ≈ 20; espacio O(n + k).
 * @explicacion Si la suma no es múltiplo de k, imposible; si no, cada cubo debe sumar `objetivo = suma / k`. Se ordenan los números de mayor a
 * menor (los grandes restringen más y fallan antes) y se coloca cada uno en un cubo donde quepa. Poda de simetría: dos cubos con la misma
 * suma actual son intercambiables, así que solo se prueba el primero (eso incluye no probar más de un cubo vacío). Con todos los números
 * colocados y ningún cubo pasado de `objetivo`, la suma total obliga a que todos valgan exactamente `objetivo`.
 * @alternativas Programación dinámica sobre máscaras de bits: O(2ⁿ · n), predecible aunque no dependa de las podas.
 */
bool particionKIguales(vector<int> nums, int k, long long* nodos = nullptr)
{
    if (k < 1) {
        throw invalid_argument("particionKIguales: k debe ser al menos 1");
    }
    for (int x : nums) {
        if (x < 0) {
            throw invalid_argument("particionKIguales: los números no pueden ser negativos");
        }
    }
    if (nums.empty()) {
        return true;
    }
    long long suma = accumulate(nums.begin(), nums.end(), 0LL);
    if (suma % k != 0) {
        return false;
    }
    long long objetivo = suma / k;
    sort(nums.begin(), nums.end(), greater<int>());
    if (nums[0] > objetivo) {
        return false;
    }
    vector<long long> cubo(static_cast<size_t>(k), 0);
    function<bool(size_t)> explorar = [&](size_t i) {
        if (nodos != nullptr) {
            ++*nodos;
        }
        if (i == nums.size()) {
            return true;
        }
        for (size_t j = 0; j < cubo.size(); j++) {
            if (cubo[j] + nums[i] > objetivo) {
                continue;
            }
            bool repetido = false;
            for (size_t p = 0; p < j; p++) {
                if (cubo[p] == cubo[j]) {
                    repetido = true;
                    break;
                }
            }
            if (repetido) {
                continue;
            }
            cubo[j] += nums[i];
            if (explorar(i + 1)) {
                return true;
            }
            cubo[j] -= nums[i];
        }
        return false;
    };
    return explorar(0);
}

/**
 * Sudoku con backtracking y MRV.
 *
 * @complejidad Exponencial en teoría; en la práctica, para 9×9, miles de nodos; espacio O(81) de recursión más 27 máscaras.
 * @explicacion Tres vectores de 9 máscaras (filas, columnas, cajas) dicen qué números están usados; los candidatos de un hueco son
 * `~(fila | col | caja) & 0x3FE`. En cada nodo se busca el hueco con menos candidatos (MRV): con 0, se retrocede en el acto; con 1, la jugada
 * es forzada. Esa poda de ORDEN hace que los errores salgan arriba del árbol. Se deshace cada colocación, así que si no hay solución el tablero
 * queda como estaba. Se comprueban los datos iniciales antes de buscar: dos iguales en una fila, columna o caja dan false directamente.
 * @alternativas Dancing Links (Knuth) lo trata como cobertura exacta; propagar «único candidato» y «único lugar» antes de ramificar poda aún más.
 */
bool resolverSudoku(vector<vector<int>>& t, long long* nodos = nullptr)
{
    if (t.size() != 9) {
        throw invalid_argument("resolverSudoku: el tablero debe ser de 9 filas");
    }
    int fila[9] = {};
    int col[9] = {};
    int caja[9] = {};
    for (int f = 0; f < 9; f++) {
        if (t[static_cast<size_t>(f)].size() != 9) {
            throw invalid_argument("resolverSudoku: cada fila debe tener 9 columnas");
        }
        for (int c = 0; c < 9; c++) {
            int v = t[static_cast<size_t>(f)][static_cast<size_t>(c)];
            if (v < 0 || v > 9) {
                throw invalid_argument("resolverSudoku: los números deben estar entre 0 y 9");
            }
        }
    }
    for (int f = 0; f < 9; f++) {
        for (int c = 0; c < 9; c++) {
            int v = t[static_cast<size_t>(f)][static_cast<size_t>(c)];
            if (v == 0) {
                continue;
            }
            int bit = 1 << v;
            int b = f / 3 * 3 + c / 3;
            if ((fila[f] & bit) || (col[c] & bit) || (caja[b] & bit)) {
                return false;
            }
            fila[f] |= bit;
            col[c] |= bit;
            caja[b] |= bit;
        }
    }
    function<bool()> explorar = [&]() {
        if (nodos != nullptr) {
            ++*nodos;
        }
        int mejorF = -1;
        int mejorC = -1;
        int mejorMascara = 0;
        int mejorN = 10;
        for (int f = 0; f < 9; f++) {
            for (int c = 0; c < 9; c++) {
                if (t[static_cast<size_t>(f)][static_cast<size_t>(c)] != 0) {
                    continue;
                }
                int mascara = ~(fila[f] | col[c] | caja[f / 3 * 3 + c / 3]) & 0x3FE;
                int cuantos = popcount(static_cast<unsigned>(mascara));
                if (cuantos < mejorN) {
                    mejorN = cuantos;
                    mejorF = f;
                    mejorC = c;
                    mejorMascara = mascara;
                }
            }
        }
        if (mejorF < 0) {
            return true;                       // no quedan huecos: resuelto
        }
        int b = mejorF / 3 * 3 + mejorC / 3;
        for (int v = 1; v <= 9; v++) {
            int bit = 1 << v;
            if (!(mejorMascara & bit)) {
                continue;
            }
            t[static_cast<size_t>(mejorF)][static_cast<size_t>(mejorC)] = v;
            fila[mejorF] |= bit;
            col[mejorC] |= bit;
            caja[b] |= bit;
            if (explorar()) {
                return true;
            }
            fila[mejorF] &= ~bit;
            col[mejorC] &= ~bit;
            caja[b] &= ~bit;
            t[static_cast<size_t>(mejorF)][static_cast<size_t>(mejorC)] = 0;
        }
        return false;
    };
    return explorar();
}
