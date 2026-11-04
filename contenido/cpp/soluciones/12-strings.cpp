#include <algorithm>
#include <array>
#include <cstdint>
#include <map>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 12 · Algoritmos de strings
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Función de fallo (prefijo) de KMP.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @explicacion `pi[i]` es el borde más largo de s[0..i]. Con `k = pi[i-1]` (el borde del prefijo anterior): si s[i] == s[k], el borde crece en 1; si no, se
 * prueba con el siguiente borde más corto, que es `pi[k-1]` (un borde de un borde es un borde), hasta que coincida o k llegue a 0. Es amortizado O(n):
 * k sube como mucho 1 por carácter, y cada vuelta del `while` lo baja, así que el total de bajadas no supera el de subidas. Con la cadena vacía se
 * devuelve un vector vacío sin tocar `s.size() - 1` (que con size_t valdría 2⁶⁴-1).
 * @alternativas La función Z da información equivalente (cada una se puede obtener de la otra). La definición directa (probar todos los bordes de cada prefijo)
 * es O(n²) o O(n³).
 * @bigo n
 */
vector<int> funcionFallo(const string& s)
{
    vector<int> pi(s.size(), 0);
    int k = 0;
    for (size_t i = 1; i < s.size(); i++) {
        while (k > 0 && s[i] != s[static_cast<size_t>(k)]) {
            k = pi[static_cast<size_t>(k) - 1];
        }
        if (s[i] == s[static_cast<size_t>(k)]) {
            k++;
        }
        pi[i] = k;
    }
    return pi;
}

/**
 * Búsqueda de un patrón con KMP.
 *
 * @complejidad Tiempo O(n + m); espacio O(m).
 * @explicacion Se calcula `pi` del patrón y se recorre el texto una sola vez con `k` = cuántos caracteres del patrón coinciden ahora. Si el siguiente
 * carácter no coincide, se retrocede en el PATRÓN (`k = pi[k-1]`), nunca en el texto: ningún carácter del texto se examina más de una vez de forma
 * «neta», así que son como mucho 2n comparaciones. Al completar el patrón (k == m) se anota la posición `i - m + 1` y se sigue desde `pi[m-1]`, lo que
 * encuentra también las ocurrencias solapadas. Un patrón vacío es un error de uso (invalid_argument), no «aparece en todas partes».
 * @alternativas La búsqueda ingenua es O(n·m) en el peor caso (por ejemplo, "aaaa…a" con "aaa…ab"). `string::find` en bucle es lo habitual en la práctica,
 * pero sin garantía lineal. Z sobre `patron + '#' + texto`, Boyer-Moore o rolling hash (Rabin-Karp) son otras opciones.
 * @bigo n
 */
vector<int> buscarKMP(const string& texto, const string& patron)
{
    if (patron.empty()) {
        throw invalid_argument("buscarKMP: el patrón no puede estar vacío");
    }
    vector<int> posiciones;
    if (patron.size() > texto.size()) {
        return posiciones;
    }
    vector<int> pi = funcionFallo(patron);
    size_t m = patron.size();
    size_t k = 0;
    for (size_t i = 0; i < texto.size(); i++) {
        while (k > 0 && texto[i] != patron[k]) {
            k = static_cast<size_t>(pi[k - 1]);
        }
        if (texto[i] == patron[k]) {
            k++;
        }
        if (k == m) {
            posiciones.push_back(static_cast<int>(i + 1 - m));
            k = static_cast<size_t>(pi[k - 1]);
        }
    }
    return posiciones;
}

/**
 * Función Z.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @explicacion Se mantiene la «ventana Z» [l, r): el segmento más a la derecha que ya sabemos que coincide con un prefijo de s. Para un i dentro de ella,
 * s[i..r) es igual a s[i-l..r-l), así que `z[i]` vale al menos `min(r - i, z[i - l])` sin comparar nada. Solo si se llega al borde de la ventana se
 * extiende comparando caracteres, y cada comparación acertada empuja r hacia la derecha, que nunca retrocede: el total de comparaciones es O(n). Se
 * fija z[0] = n por convención.
 * @alternativas La función de fallo de KMP resuelve los mismos problemas (patrones, bordes, periodos). Con la definición directa cada z[i] cuesta O(n) y todo
 * O(n²).
 * @bigo n
 */
vector<int> funcionZ(const string& s)
{
    size_t n = s.size();
    vector<int> z(n, 0);
    if (n == 0) {
        return z;
    }
    z[0] = static_cast<int>(n);
    size_t l = 0;
    size_t r = 0;
    for (size_t i = 1; i < n; i++) {
        size_t k = 0;
        if (i < r) {
            k = min(r - i, static_cast<size_t>(z[i - l]));
        }
        while (i + k < n && s[k] == s[i + k]) {
            k++;
        }
        z[i] = static_cast<int>(k);
        if (i + k > r) {
            l = i;
            r = i + k;
        }
    }
    return z;
}

/**
 * Hash polinómico con módulo 2⁶¹ - 1.
 *
 * @complejidad Construcción O(n); `subhash` O(1); espacio O(n).
 * @explicacion Con `h[i+1] = h[i]·B + código(s[i])` el hash de un prefijo es un polinomio en base B. El de una subcadena es `h[fin] - h[inicio]·B^largo`: se resta el
 * prefijo anterior «desplazado» para que sus términos se cancelen. Se trabaja módulo el primo de Mersenne 2⁶¹ - 1, cuyo producto de dos restos (122 bits) se calcula con
 * `unsigned __int128` y se reduce con un par de sumas porque 2⁶¹ ≡ 1. El carácter se convierte a `unsigned char` y se le suma 1: con `char` con signo los bytes
 * UTF-8 saldrían negativos, y si 'a' valiera 0 las cadenas "a" y "aa" coincidirían. La resta se hace sumando M antes para no pasar por un valor «negativo» sin signo.
 * @alternativas Dos hashes con módulos ~10⁹ distintos (más lentos de escribir). Un módulo único de ~10⁹ falla por la paradoja del cumpleaños con unas 40.000
 * subcadenas. Un arreglo de sufijos o un autómata dan igualdad exacta (sin probabilidad) a cambio de más código.
 * @bigo 1
 */
struct HashPolinomico {
    static constexpr uint64_t M = (1ULL << 61) - 1;
    static constexpr uint64_t B = 911382323ULL;
    int n;
    vector<uint64_t> h;
    vector<uint64_t> pw;

    explicit HashPolinomico(const string& s) : n(static_cast<int>(s.size())), h(s.size() + 1, 0), pw(s.size() + 1, 1)
    {
        for (size_t i = 0; i < s.size(); i++) {
            uint64_t c = static_cast<unsigned char>(s[i]) + 1u;
            h[i + 1] = (mul(h[i], B) + c) % M;
            pw[i + 1] = mul(pw[i], B);
        }
    }

    uint64_t subhash(int inicio, int largo) const
    {
        if (inicio < 0 || largo < 0 || inicio > n - largo) {
            throw out_of_range("HashPolinomico::subhash: subcadena fuera de rango");
        }
        size_t i = static_cast<size_t>(inicio);
        size_t f = static_cast<size_t>(inicio) + static_cast<size_t>(largo);
        return (h[f] + M - mul(h[i], pw[static_cast<size_t>(largo)])) % M;
    }

private:
    static uint64_t mul(uint64_t a, uint64_t b)
    {
        unsigned __int128 p = static_cast<unsigned __int128>(a) * b;
        uint64_t r = static_cast<uint64_t>(p & M) + static_cast<uint64_t>(p >> 61);
        return r >= M ? r - M : r;
    }
};

/**
 * Palíndromo más largo con Manacher.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @explicacion `d1[i]` y `d2[i]` guardan el radio máximo de los palíndromos impares centrados en i y pares centrados entre i-1 e i. Se conserva el palíndromo que llega
 * más a la derecha, [l, r]. Para un centro i dentro de él, su espejo `l + r - i` ya tiene su radio calculado y se copia, acotado por la distancia a r; solo se
 * extiende comparando caracteres más allá de r, y como r nunca retrocede el total es lineal. Se compara por centros de izquierda a derecha y solo se sustituye el mejor si el
 * nuevo es ESTRICTAMENTE mayor: eso deja, en un empate, el que empieza más a la izquierda. Un palíndromo par y uno impar nunca empatan (su longitud tiene distinta paridad).
 * @alternativas Expandir alrededor de cada centro es O(n²) en cadenas como "aaaa…a". La programación dinámica sobre (i, j) usa O(n²) de memoria. Se puede usar
 * árboles de sufijos o hashing + búsqueda binaria en O(n log n).
 * @bigo n
 */
string palindromoMasLargo(const string& s)
{
    int n = static_cast<int>(s.size());
    if (n == 0) {
        return "";
    }
    vector<int> d1(static_cast<size_t>(n));
    vector<int> d2(static_cast<size_t>(n));
    for (int i = 0, l = 0, r = -1; i < n; i++) {
        int k = i > r ? 1 : min(d1[static_cast<size_t>(l + r - i)], r - i + 1);
        while (i - k >= 0 && i + k < n && s[static_cast<size_t>(i - k)] == s[static_cast<size_t>(i + k)]) {
            k++;
        }
        d1[static_cast<size_t>(i)] = k;
        if (i + k - 1 > r) {
            l = i - k + 1;
            r = i + k - 1;
        }
    }
    for (int i = 0, l = 0, r = -1; i < n; i++) {
        int k = i > r ? 0 : min(d2[static_cast<size_t>(l + r - i + 1)], r - i + 1);
        while (i - k - 1 >= 0 && i + k < n && s[static_cast<size_t>(i - k - 1)] == s[static_cast<size_t>(i + k)]) {
            k++;
        }
        d2[static_cast<size_t>(i)] = k;
        if (i + k - 1 > r) {
            l = i - k;
            r = i + k - 1;
        }
    }
    int mejorInicio = 0;
    int mejorLargo = 1;
    for (int i = 0; i < n; i++) {
        int largoImpar = 2 * d1[static_cast<size_t>(i)] - 1;
        if (largoImpar > mejorLargo) {
            mejorLargo = largoImpar;
            mejorInicio = i - d1[static_cast<size_t>(i)] + 1;
        }
        int largoPar = 2 * d2[static_cast<size_t>(i)];
        if (largoPar > mejorLargo) {
            mejorLargo = largoPar;
            mejorInicio = i - d2[static_cast<size_t>(i)];
        }
    }
    return s.substr(static_cast<size_t>(mejorInicio), static_cast<size_t>(mejorLargo));
}

/**
 * Trie de letras minúsculas.
 *
 * @complejidad Cada operación O(longitud de la palabra); espacio O(26 · nodos).
 * @explicacion Los nodos viven en un `vector` y se enlazan por índice (`hijo[c]`, 0 = «no hay», porque el 0 es la raíz y nadie la tiene como hijo). Así no hay `new`
 * por nodo, ni destructor que escribir, ni fugas, y el recorrido es cómodo para la caché. Cada nodo guarda `pasan`, cuántas palabras DISTINTAS atraviesan
 * ese nodo, y si una palabra termina en él (`esFinal`). Al insertar una palabra que ya estaba no se tocan los contadores (se comprueba antes con
 * `contiene`). `contarConPrefijo` baja hasta el nodo del prefijo y devuelve su contador, sin recorrer el subárbol. Las letras se validan ANTES de crear nodos,
 * para no dejar basura si la palabra es inválida.
 * @alternativas Un `set<string>` o un `unordered_set<string>` guardan palabras, pero un conteo por prefijo exige recorrer o ordenar. Con alfabetos grandes, los hijos
 * se guardan en un `map<char, int>` o en una tabla hash por nodo. Un array de sufijos o un autómata de sufijos compacta aún más.
 * @bigo n
 */
struct Trie {
    struct Nodo {
        array<int, 26> hijo{};
        int pasan = 0;
        bool esFinal = false;
    };
    vector<Nodo> nodos = vector<Nodo>(1);

    void insertar(const string& palabra)
    {
        for (char c : palabra) {
            if (c < 'a' || c > 'z') {
                throw invalid_argument("Trie::insertar: solo letras minúsculas a-z");
            }
        }
        if (contiene(palabra)) {
            return;
        }
        size_t actual = 0;
        nodos[0].pasan++;
        for (char c : palabra) {
            size_t letra = static_cast<size_t>(c - 'a');
            if (nodos[actual].hijo[letra] == 0) {
                nodos.push_back(Nodo{});                         // push_back puede realojar: no se guarda ninguna referencia a un nodo
                nodos[actual].hijo[letra] = static_cast<int>(nodos.size()) - 1;
            }
            actual = static_cast<size_t>(nodos[actual].hijo[letra]);
            nodos[actual].pasan++;
        }
        nodos[actual].esFinal = true;
    }

    bool contiene(const string& palabra) const
    {
        long long nodo = buscar(palabra);
        return nodo >= 0 && nodos[static_cast<size_t>(nodo)].esFinal;
    }

    int contarConPrefijo(const string& prefijo) const
    {
        long long nodo = buscar(prefijo);
        return nodo < 0 ? 0 : nodos[static_cast<size_t>(nodo)].pasan;
    }

private:
    /** Índice del nodo al que lleva el texto, o -1 si no existe el camino (o hay letras fuera de a-z). */
    long long buscar(const string& texto) const
    {
        size_t actual = 0;
        for (char c : texto) {
            if (c < 'a' || c > 'z') {
                return -1;
            }
            int siguiente = nodos[actual].hijo[static_cast<size_t>(c - 'a')];
            if (siguiente == 0) {
                return -1;
            }
            actual = static_cast<size_t>(siguiente);
        }
        return static_cast<long long>(actual);
    }
};

/**
 * Frecuencia de palabras con string_view.
 *
 * @complejidad Tiempo O(n + P log D) con P palabras y D distintas; espacio O(D).
 * @explicacion Se recorre el texto con índices sobre la vista: `find_first_not_of(' ')` salta los espacios (se ignoran los dobles y los de los bordes) y `find(' ')` localiza
 * el final de la palabra. `substr` de un `string_view` no copia: solo se crea un `string` (conversión EXPLÍCITA) al contar la palabra, y el `map` solo copia
 * una vez por palabra distinta. `npos` (el máximo de `size_t`) significa «no encontrado»: por eso se compara con `npos` y no con -1 ni se guarda en un int.
 * @alternativas Con `unordered_map` baja a O(n) esperado, pero el resultado no sale ordenado. Con `string_view` como CLAVE se evitarían las copias, pero entonces
 * el mapa depende de que el texto original siga vivo.
 * @bigo n
 */
map<string, int> frecuenciaPalabras(string_view texto)
{
    map<string, int> cuenta;
    size_t pos = texto.find_first_not_of(' ');
    while (pos != string_view::npos) {
        size_t fin = texto.find(' ', pos);
        if (fin == string_view::npos) {
            fin = texto.size();
        }
        cuenta[string(texto.substr(pos, fin - pos))]++;
        pos = texto.find_first_not_of(' ', fin);
    }
    return cuenta;
}

/**
 * Periodo mínimo con la función de fallo.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @explicacion Si s tiene un borde de longitud b = pi[n-1], entonces s tiene periodo n - b (cada carácter coincide con el que está n - b posiciones antes). Será una
 * repetición EXACTA de una unidad solo cuando ese periodo divida a n; si no, la cadena no se descompone y su periodo es ella misma. Sin borde (b = 0) el candidato es n,
 * que divide a n, y el resultado es n también. La cadena vacía devuelve 0 sin acceder a `pi[n-1]` (con size_t sería `pi[2⁶⁴-1]`).
 * @alternativas Con la función Z: el menor `p` que divide a n con `p + z[p] == n`. Probar cada divisor de n comparando la cadena es O(n · d(n)).
 * @bigo n
 */
int periodoMinimo(const string& s)
{
    if (s.empty()) {
        return 0;
    }
    vector<int> pi = funcionFallo(s);
    int n = static_cast<int>(s.size());
    int candidato = n - pi.back();
    return n % candidato == 0 ? candidato : n;
}
