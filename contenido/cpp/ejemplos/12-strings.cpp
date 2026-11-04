#include <algorithm>
#include <array>
#include <cstdint>
#include <iostream>
#include <map>
#include <numeric>
#include <set>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 12 · ALGORITMOS DE STRINGS
 * ────────────────────────────────────────────────────────────────────────────
 * Buscar un patrón en un texto, comparar subcadenas, detectar palíndromos o prefijos comunes son problemas clásicos. La versión ingenua
 * (probar cada posición y comparar) cuesta O(n·m); con un poco de preprocesamiento baja a O(n + m).
 *
 *   Técnica                        Qué resuelve                                        Coste
 *   Búsqueda ingenua               patrón en texto                                     O(n·m)
 *   KMP (función de fallo π)       patrón en texto, bordes, períodos                   O(n + m)
 *   Función Z                      prefijo común de cada sufijo con la cadena          O(n)
 *   Rolling hash                   comparar subcadenas en O(1), Rabin-Karp             O(n) + O(1)  (probabilístico)
 *   Manacher                       palíndromo más largo                                O(n)
 *   Trie                           prefijos, diccionarios, autocompletar               O(longitud) por operación
 *
 * CONVENCIONES: índices desde 0; una «subcadena» es contigua (a diferencia de una «subsecuencia», que se salta caracteres).
 * `n` = longitud del texto y `m` = longitud del patrón. Se trabaja con bytes (char): ver la sección 1.
 *
 * CÓMO SE TRABAJA: Ctrl+Enter ejecuta el archivo; los ejercicios dicen «pendiente» hasta que sustituyes `return pendiente();` por tu
 * código. Ctrl+S guarda tu avance. El botón «Solución» compara tu código con la de referencia (pruebas y coste medido).
 */

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

/*
 * ┌─ Desde Java/PHP/Python ────────────────────────────────────────────────────────────────────────────────────────
 * │ `std::string` es MUTABLE (como StringBuilder, no como el String inmutable de Java o el str de Python): `s += 'x'` modifica el mismo
 * │ objeto en O(1) amortizado, y `s[i] = 'z'` cambia un carácter. `==` compara el CONTENIDO (no hay un `==` de referencias que te engañe).
 * │ Pasarlo por valor COPIA los bytes: usa `const string&` o `string_view`. Un char es UN BYTE, no un carácter Unicode: "ñ" son 2 bytes
 * │ en UTF-8 y `size()` cuenta bytes, como `strlen`/`mb_strlen` sin la `m` de PHP, o `len(s.encode())` de Python.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * ┌─ Desde C ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * │ Adiós al `\0` final, a `strlen` en cada vuelta de bucle y a los desbordamientos de buffer: `string` conoce su tamaño y crece solo.
 * │ `s.c_str()` te da el `const char*` terminado en \0 si necesitas llamar a una función de C.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Un texto reproducible de n letras 'a' .. 'a' + alfabeto - 1 (con alfabeto pequeño aparecen muchas repeticiones: lo duro para el patrón). */
string textoAleatorio(int n, int alfabeto, int semilla)
{
    vector<int> v = aleatorios(n, alfabeto - 1, semilla);
    string s;
    s.reserve(static_cast<size_t>(n));                 // reserve evita realojar mientras se añade: sin él, ~log₂ n copias
    for (int x : v) {
        s += static_cast<char>('a' + x);
    }
    return s;
}

/** Cuenta ocurrencias de `c` en cualquier cosa «parecida a un texto» sin copiar nada: string, literal, subcadena... */
int contarLetra(string_view s, char c)
{
    return static_cast<int>(count(s.begin(), s.end(), c));
}

/** Búsqueda ingenua. Devuelve las posiciones y cuenta las comparaciones de caracteres hechas (para ver su coste). */
vector<int> buscarIngenuo(const string& texto, const string& patron, long long& comparaciones)
{
    vector<int> pos;
    comparaciones = 0;
    if (patron.empty() || patron.size() > texto.size()) {
        return pos;
    }
    for (size_t i = 0; i + patron.size() <= texto.size(); i++) {      // `i + m <= n`, NO `i <= n - m`: n - m con size_t podría «dar la vuelta»
        size_t j = 0;
        while (j < patron.size()) {
            comparaciones++;
            if (texto[i + j] != patron[j]) {
                break;
            }
            j++;
        }
        if (j == patron.size()) {
            pos.push_back(static_cast<int>(i));
        }
    }
    return pos;
}

/** Función de fallo calculada por definición, O(n²) o peor: referencia lenta de las pruebas. */
vector<int> falloLento(const string& s)
{
    vector<int> pi(s.size(), 0);
    for (size_t i = 0; i < s.size(); i++) {
        for (size_t k = i; k >= 1; k--) {                     // k = longitud candidata (propia: k < i + 1)
            if (s.compare(0, k, s, i + 1 - k, k) == 0) {
                pi[i] = static_cast<int>(k);
                break;
            }
        }
    }
    return pi;
}

/** Función Z por definición, O(n²): referencia lenta. z[0] = n. */
vector<int> zLento(const string& s)
{
    vector<int> z(s.size(), 0);
    for (size_t i = 0; i < s.size(); i++) {
        size_t k = 0;
        while (i + k < s.size() && s[k] == s[i + k]) {
            k++;
        }
        z[i] = static_cast<int>(k);
    }
    return z;
}

/** Palíndromo más largo expandiendo desde cada centro, O(n²): referencia lenta (el de más a la izquierda en un empate). */
string palindromoLento(const string& s)
{
    int n = static_cast<int>(s.size());
    int mejorInicio = 0;
    int mejorLargo = 0;
    for (int centro = 0; centro < 2 * n - 1; centro++) {
        int l = centro / 2;
        int r = l + centro % 2;                                 // centro par → impar (l == r); impar → par (r = l + 1)
        while (l >= 0 && r < n && s[l] == s[r]) {
            l--;
            r++;
        }
        if (r - l - 1 > mejorLargo) {
            mejorLargo = r - l - 1;
            mejorInicio = l + 1;
        }
    }
    return s.substr(static_cast<size_t>(mejorInicio), static_cast<size_t>(mejorLargo));
}

/** Módulo 2⁶¹ - 1 (primo de Mersenne): un hash con solo ~10⁻¹⁸ de probabilidad de colisión por par, sin riesgo de desbordar. */
const uint64_t MOD61 = (1ULL << 61) - 1;

/** (a · b) mod (2⁶¹ - 1) usando un entero de 128 bits (extensión de GCC/Clang) para el producto intermedio. */
uint64_t mulMod61(uint64_t a, uint64_t b)
{
    unsigned __int128 p = static_cast<unsigned __int128>(a) * b;
    uint64_t r = static_cast<uint64_t>(p & MOD61) + static_cast<uint64_t>(p >> 61);     // 2⁶¹ ≡ 1 → se pliega la parte alta sobre la baja
    return r >= MOD61 ? r - MOD61 : r;
}

/** Un hash MUY flojo (mod 101) para ver una colisión de verdad. */
int hashDebil(const string& s)
{
    int h = 0;
    for (char c : s) {
        h = (h * 31 + (static_cast<unsigned char>(c) - 'a' + 1)) % 101;
    }
    return h;
}

/** Un texto con n palabras de un vocabulario de 20, separadas por UN espacio. */
string textoDePalabras(int n)
{
    static const array<string, 20> vocab = {"casa", "perro", "gato", "sol", "luna", "mar", "rio", "monte", "flor", "pan",
                                            "vino", "queso", "libro", "mesa", "silla", "calle", "plaza", "cielo", "nube", "viento"};
    vector<int> idx = aleatorios(n, 19, 2);
    string t;
    for (size_t i = 0; i < idx.size(); i++) {
        if (i > 0) {
            t += ' ';
        }
        t += vocab[static_cast<size_t>(idx[i])];
    }
    return t;
}

/** `unidad` repetida `veces` veces: periodo mínimo = unidad.size() (si unidad no es ella misma periódica). */
string repetida(const string& unidad, int veces)
{
    string s;
    s.reserve(unidad.size() * static_cast<size_t>(veces));
    for (int i = 0; i < veces; i++) {
        s += unidad;
    }
    return s;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · funcionFallo (función de prefijo de KMP) ───────────────────
/**
 * pi[i] = longitud del prefijo PROPIO más largo de s[0..i] que también es sufijo de s[0..i] (un «borde»). Propio = distinto de la cadena entera.
 *     "aabaaab" → {0, 1, 0, 1, 2, 2, 3}      "abab" → {0, 0, 1, 2}      "aaaa" → {0, 1, 2, 3}
 * Cálculo en O(n) (no O(n²)): mantén k = pi[i-1]. Para cada i ≥ 1: `while (k > 0 && s[i] != s[k]) k = pi[k - 1];` (acorta el borde al
 * siguiente más corto), luego `if (s[i] == s[k]) k++;` y `pi[i] = k`. Es amortizado: k sube como mucho 1 por carácter, así que
 * baja como mucho n veces en total. Cadena vacía → vector vacío.
 * Trampas: `s.size() - 1` con la cadena vacía da 18 trillones (size_t); y `k = pi[k - 1]`, no `k = pi[k]`.
 */
vector<int> funcionFallo(const string& s)
{
    return pendiente();
}

// ── Ejercicio 2 · buscarKMP ──────────────────────────────────────────────────
/**
 * Todas las posiciones donde aparece `patron` en `texto` (también las que se SOLAPAN), en orden. "aaaa" y "aa" → {0, 1, 2}. Patrón vacío →
 * invalid_argument; patrón más largo que el texto → {}. Coste O(n + m).
 * Receta: recorre el texto con un contador k = longitud del trozo del patrón que coincide ahora mismo. En cada carácter:
 * `while (k > 0 && texto[i] != patron[k]) k = pi[k - 1];` y si coincide, k++. Cuando k == m hay una ocurrencia que acaba en i
 * (empieza en i - m + 1); después `k = pi[k - 1]` para seguir buscando solapes. Reutiliza `funcionFallo(patron)`.
 * (Truco alternativo: calcula la función de fallo de `patron + '#' + texto`; las posiciones con pi == m son ocurrencias.)
 */
vector<int> buscarKMP(const string& texto, const string& patron)
{
    return pendiente();
}

// ── Ejercicio 3 · funcionZ ───────────────────────────────────────────────────
/**
 * z[i] = longitud del prefijo común más largo entre s y el sufijo s[i..]. Por convención z[0] = n.
 *     "aaaaa" → {5, 4, 3, 2, 1}      "abacaba" → {7, 0, 1, 0, 3, 0, 1}      "" → {}
 * En O(n) con la «ventana Z» [l, r) = el segmento más a la derecha que ya sabes que coincide con un prefijo: para cada i, si i < r
 * empiezas con `z[i] = min(r - i, z[i - l])` (lo que ya está calculado) y solo extiendes comparando caracteres nuevos; si te pasas de r,
 * actualiza l = i, r = i + z[i]. Sirve igual que KMP para buscar (calcula Z de `patron + '#' + texto`) y para períodos.
 */
vector<int> funcionZ(const string& s)
{
    return pendiente();
}

// ── Ejercicio 4 · HashPolinomico (rolling hash) ──────────────────────────────
/**
 * Hash de CUALQUIER subcadena en O(1) tras O(n) de preproceso, para comparar subcadenas sin recorrerlas (y para Rabin-Karp).
 * Hash polinómico módulo M = 2⁶¹ - 1 con base B = 911382323: h[i+1] = (h[i]·B + código(s[i])) mod M, y potencias pw[i] = Bⁱ mod M.
 * El hash de s[inicio .. inicio+largo) es `(h[inicio+largo] - h[inicio]·pw[largo]) mod M` (cuidado: la resta puede salir negativa; en
 * uint64_t, suma M antes: `+ M - ...`). Usa `mulMod61` (arriba) para multiplicar sin desbordar 64 bits.
 *   - `HashPolinomico h(s)`; `h.subhash(inicio, largo)` → uint64_t. largo 0 → 0. Fuera de [0, n] → out_of_range.
 *   - Dos subcadenas iguales SIEMPRE dan el mismo hash (incluso de dos objetos distintos); dos distintas casi nunca coinciden.
 * Trampas: `char` suele tener signo (las letras acentuadas en UTF-8 serían negativas): convierte con `static_cast<unsigned char>` y
 * suma 1 para que 'a' no valga 0 (si no, "a" y "aa" tendrían el mismo hash). Un hash mod ~10⁹ falla enseguida (paradoja del cumpleaños:
 * con 50.000 subcadenas ya hay colisiones casi seguras); con 2⁶¹ - 1 no. Un hash NO demuestra igualdad: si importa, verifica el candidato.
 */
struct HashPolinomico {
    explicit HashPolinomico(const string& s)
    {
        pendiente();
    }

    uint64_t subhash(int inicio, int largo) const
    {
        return pendiente();
    }
};

// ── Ejercicio 5 · palindromoMasLargo (Manacher) ──────────────────────────────
/**
 * La subcadena palíndroma más larga. En un empate, la que empieza más a la izquierda: "babad" → "bab"; "cbbd" → "bb"; "" → "".
 * El truco ingenuo (expandir desde cada centro, `palindromoLento` arriba) es O(n²) en "aaaa...". Manacher es O(n): calcula, para cada centro,
 * el radio del palíndromo reutilizando el espejo respecto al palíndromo más a la derecha ya conocido [l, r].
 * Dos arrays: d1[i] = nº de palíndromos de longitud IMPAR centrados en i (el radio, contando el propio i); d2[i] = nº de palíndromos de
 * longitud PAR centrados entre i-1 e i. Para d1: `k = (i > r) ? 1 : min(d1[l + r - i], r - i + 1);` luego `while (i - k >= 0 && i + k < n &&
 * s[i - k] == s[i + k]) k++;` y si `i + k - 1 > r`, actualiza l = i - k + 1, r = i + k - 1. d2 es igual con índices desplazados.
 * Con d1 el palíndromo ocupa [i - d1[i] + 1, i + d1[i] - 1] (largo 2·d1[i] - 1); con d2, [i - d2[i], i + d2[i] - 1] (largo 2·d2[i]).
 */
string palindromoMasLargo(const string& s)
{
    return pendiente();
}

// ── Ejercicio 6 · Trie ───────────────────────────────────────────────────────
/**
 * Árbol de prefijos para palabras de letras minúsculas a-z. Cada nodo tiene hasta 26 hijos (uno por letra), un marcador «aquí acaba una
 * palabra» y un contador de cuántas palabras pasan por él. Todas las operaciones cuestan O(longitud de la palabra), sin importar cuántas
 * palabras haya guardadas.
 *   - insertar(p): añade la palabra (repetirla no cuenta dos veces). Un carácter que no sea a-z → invalid_argument. La vacía vale.
 *   - contiene(p): ¿está EXACTAMENTE esa palabra? ("cas" no está aunque "casa" sí). Con caracteres no a-z → false.
 *   - contarConPrefijo(p): cuántas palabras DISTINTAS empiezan por p (p vacío → todas). Con caracteres no a-z → 0.
 * Representación sugerida: un `vector` de nodos con `array<int, 26> hijo` (0 = «no hay»; el nodo 0 es la raíz) en lugar de un `new` por nodo:
 * menos fragmentación, sin `delete` que olvidar y sin fugas de memoria. Con punteros tendrías que liberarlos (regla de los tres/cinco).
 */
struct Trie {
    void insertar(const string& palabra)
    {
        pendiente();
    }

    bool contiene(const string& palabra) const
    {
        return pendiente();
    }

    int contarConPrefijo(const string& prefijo) const
    {
        return pendiente();
    }
};

// ── Ejercicio 7 · frecuenciaPalabras ─────────────────────────────────────────
/**
 * Cuenta cuántas veces aparece cada palabra de un texto. Las palabras se separan por uno o más espacios (hay que ignorar los vacíos del
 * principio, del final y los dobles). Distingue mayúsculas: "Sol" y "sol" son distintas. Devuelve un `map<string, int>` ordenado por palabra.
 * El parámetro es `string_view`: no copia el texto de entrada (acepta string, literales y trozos). Recórrelo con `find` y `substr` sobre la
 * VISTA (que son O(1)) y copia solo cada palabra al insertarla: `mapa[string(vista.substr(ini, largo))]++` (de string_view a string la
 * conversión es EXPLÍCITA: sin `string(...)` no compila). Coste O(n + P·log D) con P palabras y D distintas.
 * Trampa: un `string_view` no es dueño de los bytes; si apuntas a un `string` temporal que ya se destruyó, accedes a memoria liberada (UB).
 */
map<string, int> frecuenciaPalabras(string_view texto)
{
    return pendiente();
}

// ── Ejercicio 8 · periodoMinimo ──────────────────────────────────────────────
/**
 * La longitud de la unidad más corta que, repetida, construye s: "abcabcabc" → 3; "abab" → 2; "aaaa" → 1; "abcab" → 5 (no se repite
 * exactamente: el periodo es la cadena entera); "a" → 1; "" → 0.
 * Con la función de fallo: si k = n - pi[n-1] divide a n, el periodo mínimo es k; si no, es n. (pi[n-1] es el borde más largo: si s tiene
 * un borde de longitud b, entonces tiene "periodo" n - b; solo es una repetición exacta cuando ese periodo divide a n.)
 * Reutiliza `funcionFallo`. Coste O(n).
 */
int periodoMinimo(const string& s)
{
    return pendiente();
}

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. STRING, STRING_VIEW Y SU COSTE
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1. string, string_view y su coste");

    string palabra = "algoritmo";
    string_view vista = palabra;                    // no copia: guarda (puntero, longitud)
    string_view trozo = vista.substr(2, 4);         // O(1): otra vista dentro de la misma memoria. string::substr, en cambio, copia (O(k))
    cout << "vista = " << vista << ", trozo = " << trozo << ", letra 'o' en el literal: " << contarLetra("ovoide", 'o') << "\n";
    cout << "contarLetra(palabra) = " << contarLetra(palabra, 'o') << ", contarLetra(trozo) = " << contarLetra(trozo, 'o') << "  (la misma función para tres tipos)\n";
    // PELIGRO (no se ejecuta): una vista a algo temporal queda colgando.
    //     string_view mala = string("temporal");    // el string muere al acabar la línea; `mala` apunta a memoria liberada → UB
    //     string_view tambien() { string s = "x"; return s; }   // igual: devuelve una vista de una variable local
    // Regla: un string_view no puede vivir más que el texto al que mira. Úsalo como PARÁMETRO, no como campo ni como retorno.

    string utf8 = "año";
    cout << "\"año\" mide " << utf8.size() << " bytes (la ñ ocupa 2 en UTF-8), aunque se vean 3 letras\n";
    cout << "sizeof(string) = " << sizeof(string) << " bytes; capacity() de un string vacío = " << string().capacity()
         << " (SSO: los textos cortos viven DENTRO del objeto, sin reservar memoria dinámica)\n";

    // El coste de construir texto: s += c es O(1) amortizado (la capacidad se duplica), s = s + c copia todo cada vez.
    string crece;
    size_t capAnterior = crece.capacity();
    cout << "capacidad al añadir 100 caracteres:";
    for (int i = 0; i < 100; i++) {
        crece += 'x';
        if (crece.capacity() != capAnterior) {
            capAnterior = crece.capacity();
            cout << " " << capAnterior;
        }
    }
    cout << "\n";
    long long copiasMal = 0;
    for (long long len = 1; len <= 10000; len++) {
        copiasMal += len;                           // `s = s + 'x'` copia los len caracteres que hay
    }
    cout << "construir 10000 caracteres con s = s + 'x' copia " << copiasMal << " caracteres; con s += 'x', unos " << 2 * 10000 << " (amortizado)\n";
    // Otras operaciones caras: insert/erase al principio O(n), substr O(k), pasar un string por valor O(n), comparar O(longitud común).
    // Y recuerda: s.size() - 1 es 18446744073709551615 si s está vacío (size_t no tiene signo).

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BÚSQUEDA Y KMP
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. Búsqueda ingenua frente a KMP");

    long long comps = 0;
    string peor(20000, 'a');
    vector<int> encontrados = buscarIngenuo(peor, string(100, 'a') + "b", comps);
    cout << "ingenua: texto de 20000 'a' y patrón de 100 'a' + 'b' → " << encontrados.size() << " apariciones, " << comps << " comparaciones (≈ n·m)\n";
    // KMP no vuelve nunca atrás en el texto: a lo sumo 2n comparaciones. La clave: la función de fallo dice, cuando falla el carácter k+1
    // del patrón, a qué posición k' del propio patrón se puede retroceder sin perder nada (el borde más largo del trozo que ya coincidía).
    cout << "pi(\"abababc\") = " << mostrar(falloLento("abababc")) << "   (borde máximo de cada prefijo)\n";
    cout << "pi(\"aabaaab\") = " << mostrar(falloLento("aabaaab")) << "\n";
    cout << "ocurrencias ingenuas de \"abra\" en \"abracadabra\": " << mostrar(buscarIngenuo("abracadabra", "abra", comps)) << "\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 3. FUNCIÓN Z
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3. Función Z");

    cout << "z(\"abacaba\") = " << mostrar(zLento("abacaba")) << "\n";
    // z[i] > 0 ⇒ el sufijo que empieza en i comparte prefijo con s. Para buscar un patrón: Z de patron + '#' + texto (el '#' no puede
    // aparecer en ninguno; así ningún z supera m); una ocurrencia es cada posición con z == m. Y el borde/periodo de s: n - i para el menor i
    // con i + z[i] == n.

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ROLLING HASH
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("4. Rolling hash");

    // La idea: tratar la cadena como un número en base B y reducirlo módulo M. Con prefijos h[i] se obtiene el de cualquier trozo en O(1).
    // Si dos hashes difieren, las cadenas son distintas seguro; si coinciden, lo más probable es que sean iguales (¡no es una prueba!).
    int colisiones = 0;
    string pareja[2];
    for (int a1 = 0; a1 < 26 && colisiones == 0; a1++) {
        for (int a2 = 0; a2 < 26 && colisiones == 0; a2++) {
            for (int b1 = 0; b1 < 26 && colisiones == 0; b1++) {
                for (int b2 = 0; b2 < 26; b2++) {
                    string x = {static_cast<char>('a' + a1), static_cast<char>('a' + a2)};
                    string y = {static_cast<char>('a' + b1), static_cast<char>('a' + b2)};
                    if (x < y && hashDebil(x) == hashDebil(y)) {
                        colisiones = 1;
                        pareja[0] = x;
                        pareja[1] = y;
                        break;
                    }
                }
            }
        }
    }
    cout << "con un hash mod 101, \"" << pareja[0] << "\" y \"" << pareja[1] << "\" colisionan: " << hashDebil(pareja[0]) << " = " << hashDebil(pareja[1]) << "\n";
    cout << "mulMod61(2^60, 4) = " << mulMod61(1ULL << 60, 4) << " (2^62 mod (2^61-1) = 2)\n";
    // Anti-hack: en un concurso, usa una BASE ALEATORIA (p. ej. a partir de chrono::steady_clock) para que nadie construya entradas que
    // choquen contra tu base fija. Aquí es fija para que los resultados sean reproducibles.

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MANACHER Y PALÍNDROMOS
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("5. Palíndromos");

    cout << "palíndromo más largo (lento) de \"forgeeksskeegfor\": " << palindromoLento("forgeeksskeegfor") << "\n";
    // Manacher evita repetir trabajo: dentro de un palíndromo grande, el radio en un centro es el de su «espejo» (acotado por el borde).
    // Un truco habitual para tratar pares e impares a la vez: intercalar un separador ("abba" → "#a#b#b#a#") y calcular solo radios impares.

// ═══════════════════════════════════════════════════════════════════════════════
// 6. TRIE
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("6. Trie");

    // Un trie para {casa, caso, cosa}:  raíz ─c─ a ─┬─ s ─┬─ a*
    //                                                │     └─ o*          (* = aquí acaba una palabra)
    //                                                └─ o ─ s ─ a*       comparte el prefijo «c»
    // Compararlo con un set<string>: el set cuesta O(m log n) por consulta (compara cadenas enteras); el trie, O(m) exacto, y además
    // responde «¿alguna palabra empieza por...?» sin recorrer nada más. A cambio gasta mucha memoria (26 enteros por nodo).
    cout << "un nodo con array<int, 26> ocupa " << sizeof(array<int, 26>) << " bytes + marcadores\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PALABRAS Y PERIODOS
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("7. Palabras y periodos");

    string frase = "el gato y el perro y el sol";
    string_view restoFrase = frase;
    size_t pos = 0;
    int cuentaPalabras = 0;
    while (pos < restoFrase.size()) {
        size_t fin = restoFrase.find(' ', pos);
        if (fin == string_view::npos) {                 // npos = «no encontrado»: size_t máximo, nunca lo compares con int
            fin = restoFrase.size();
        }
        cuentaPalabras++;
        pos = fin + 1;
    }
    cout << "palabras en \"" << frase << "\": " << cuentaPalabras << "\n";
    cout << "pi(\"abcabcabc\") = " << mostrar(falloLento("abcabcabc")) << " → n - pi[n-1] = 9 - 6 = 3 y 3 divide a 9: periodo 3\n";

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    prueba(funcionFallo,
        caso("aabaaab", vector<int>{0, 1, 0, 1, 2, 2, 3}, string("aabaaab")),
        caso("abab", vector<int>{0, 0, 1, 2}, string("abab")),
        caso("todo igual", vector<int>{0, 1, 2, 3}, string("aaaa")),
        caso("sin bordes", vector<int>{0, 0, 0, 0}, string("abcd")),
        caso("un carácter", vector<int>{0}, string("x")),
        caso("vacía", vector<int>{}, string("")),
        caso("periodo 3", vector<int>{0, 0, 0, 1, 2, 3, 4, 5, 6}, string("abcabcabc")));
    grupo("funcionFallo (más casos)");
    comprueba("coincide con la definición en 40 cadenas aleatorias", [&] {
        for (int semilla = 1; semilla <= 40; semilla++) {
            string t = textoAleatorio(semilla * 2, 2 + semilla % 3, semilla);
            if (funcionFallo(t) != falloLento(t)) {
                return "falla con " + t;
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(buscarKMP,
        caso("abracadabra", vector<int>{0, 7}, string("abracadabra"), string("abra")),
        caso("solapadas", vector<int>{0, 1, 2}, string("aaaa"), string("aa")),
        caso("no aparece", vector<int>{}, string("abcdef"), string("xyz")),
        caso("patrón más largo que el texto", vector<int>{}, string("ab"), string("abc")),
        caso("patrón igual al texto", vector<int>{0}, string("hola"), string("hola")),
        caso("un carácter", vector<int>{1, 3}, string("abab"), string("b")),
        caso("texto vacío", vector<int>{}, string(""), string("a")),
        caso("fallo y reintento", vector<int>{6}, string("aabaabaaab"), string("aaab")));
    grupo("buscarKMP (más casos)");
    lanza("patrón vacío", [&] { buscarKMP("abc", ""); }, invalid_argument);
    comprueba("coincide con la búsqueda ingenua en 40 textos con alfabeto pequeño", [&] {
        long long c = 0;
        for (int semilla = 1; semilla <= 40; semilla++) {
            string t = textoAleatorio(60 + semilla, 2, semilla);
            string pat = textoAleatorio(1 + semilla % 5, 2, semilla + 100);
            if (buscarKMP(t, pat) != buscarIngenuo(t, pat, c)) {
                return "falla con " + t + " / " + pat;
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("500000 'a' y patrón 'aaaab': sin coincidencias y en tiempo lineal", [&] {
        return buscarKMP(string(500000, 'a'), "aaaab").size();
    }, static_cast<size_t>(0));

    prueba(funcionZ,
        caso("todo igual", vector<int>{5, 4, 3, 2, 1}, string("aaaaa")),
        caso("abacaba", vector<int>{7, 0, 1, 0, 3, 0, 1}, string("abacaba")),
        caso("sin repetición", vector<int>{4, 0, 0, 0}, string("abcd")),
        caso("un carácter", vector<int>{1}, string("z")),
        caso("vacía", vector<int>{}, string("")),
        caso("periodo 2", vector<int>{6, 0, 4, 0, 2, 0}, string("ababab")));
    grupo("funcionZ (más casos)");
    comprueba("coincide con la definición en 40 cadenas aleatorias", [&] {
        for (int semilla = 1; semilla <= 40; semilla++) {
            string t = textoAleatorio(semilla * 3, 2 + semilla % 2, semilla);
            if (funcionZ(t) != zLento(t)) {
                return "falla con " + t;
            }
        }
        return string("ok");
    }, string("ok"));

    grupo("HashPolinomico");
    comprueba("subcadenas iguales, mismo hash", [&] {
        HashPolinomico h("abcabc");
        return h.subhash(0, 3) == h.subhash(3, 3);
    }, true);
    comprueba("subcadenas distintas, distinto hash", [&] {
        HashPolinomico h("abcabc");
        return h.subhash(0, 3) != h.subhash(1, 3);
    }, true);
    comprueba("'a' y 'aa' no coinciden (el código de 'a' no es 0)", [&] {
        HashPolinomico h("aaa");
        return h.subhash(0, 1) != h.subhash(0, 2);
    }, true);
    comprueba("el hash de la cadena vacía es 0", [&] { return HashPolinomico("abc").subhash(1, 0); }, static_cast<uint64_t>(0));
    comprueba("dos objetos distintos son comparables entre sí", [&] {
        HashPolinomico a("xxhola"), b("hola!!");
        return a.subhash(2, 4) == b.subhash(0, 4);
    }, true);
    comprueba("letras acentuadas (bytes UTF-8 con signo negativo) funcionan", [&] {
        HashPolinomico h("canción canción");
        return h.subhash(0, 8) == h.subhash(9, 8) && h.subhash(0, 7) != h.subhash(1, 7);   // "canción" son 8 bytes (la ó ocupa 2)
    }, true);
    comprueba("Rabin-Karp: encuentra las mismas posiciones que la búsqueda ingenua", [&] {
        string t = textoAleatorio(2000, 3, 9);
        string pat = "abca";
        HashPolinomico ht(t), hp(pat);
        vector<int> halladas;
        for (int i = 0; i + 4 <= 2000; i++) {
            if (ht.subhash(i, 4) == hp.subhash(0, 4)) {
                halladas.push_back(i);
            }
        }
        long long c = 0;
        return halladas == buscarIngenuo(t, pat, c);
    }, true);
    comprueba("las subcadenas distintas de longitud 6 dan hashes distintos (sin colisiones)", [&] {
        string t = textoAleatorio(5000, 4, 3);
        HashPolinomico h(t);
        set<uint64_t> hashes;
        set<string> textos;
        for (int i = 0; i + 6 <= 5000; i++) {
            hashes.insert(h.subhash(i, 6));
            textos.insert(t.substr(static_cast<size_t>(i), 6));
        }
        return hashes.size() == textos.size();
    }, true);
    lanza("fuera de rango", [&] { HashPolinomico h("abc"); h.subhash(2, 5); }, out_of_range);
    lanza("inicio negativo", [&] { HashPolinomico h("abc"); h.subhash(-1, 1); }, out_of_range);

    prueba(palindromoMasLargo,
        caso("babad (gana el de más a la izquierda)", string("bab"), string("babad")),
        caso("longitud par", string("bb"), string("cbbd")),
        caso("vacía", string(""), string("")),
        caso("un carácter", string("x"), string("x")),
        caso("todo es palíndromo", string("aaaa"), string("aaaa")),
        caso("sin palíndromos largos", string("a"), string("abcd")),
        caso("en medio de la cadena", string("geeksskeeg"), string("forgeeksskeegfor")),
        caso("dos candidatos iguales", string("aba"), string("abacdfgdcaba")));
    grupo("palindromoMasLargo (más casos)");
    comprueba("coincide con la versión O(n²) en 60 cadenas aleatorias", [&] {
        for (int semilla = 1; semilla <= 60; semilla++) {
            string t = textoAleatorio(semilla, 2 + semilla % 2, semilla);
            if (palindromoMasLargo(t) != palindromoLento(t)) {
                return "falla con " + t;
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("200000 'a' (la expansión ingenua tardaría minutos)", [&] { return palindromoMasLargo(string(200000, 'a')).size(); },
        static_cast<size_t>(200000));

    grupo("Trie");
    comprueba("insertar y contiene", [&] {
        Trie t;
        t.insertar("casa");
        t.insertar("cosa");
        return vector<int>{t.contiene("casa"), t.contiene("cosa"), t.contiene("cas"), t.contiene("casas"), t.contiene("")};
    }, vector<int>{true, true, false, false, false});
    comprueba("un prefijo no es palabra salvo que se inserte", [&] {
        Trie t;
        t.insertar("casas");
        bool antes = t.contiene("casa");
        t.insertar("casa");
        return vector<int>{antes, t.contiene("casa")};
    }, vector<int>{false, true});
    comprueba("contarConPrefijo", [&] {
        Trie t;
        for (string w : {"casa", "caso", "cosa", "casas", "mesa"}) {
            t.insertar(w);
        }
        return vector<int>{t.contarConPrefijo("cas"), t.contarConPrefijo("c"), t.contarConPrefijo("casa"), t.contarConPrefijo("casas"),
                           t.contarConPrefijo("z"), t.contarConPrefijo(""), t.contarConPrefijo("mesas")};
    }, vector<int>{3, 4, 2, 1, 0, 5, 0});
    comprueba("repetir una palabra no la cuenta dos veces", [&] {
        Trie t;
        t.insertar("sol");
        t.insertar("sol");
        t.insertar("sol");
        return t.contarConPrefijo("s");
    }, 1);
    comprueba("la palabra vacía", [&] {
        Trie t;
        t.insertar("");
        return vector<int>{t.contiene(""), t.contarConPrefijo("")};
    }, vector<int>{1, 1});
    comprueba("caracteres fuera de a-z en las consultas", [&] {
        Trie t;
        t.insertar("abc");
        return vector<int>{t.contiene("AB"), t.contarConPrefijo("a-"), t.contiene("a b")};
    }, vector<int>{0, 0, 0});
    lanza("insertar con mayúsculas", [&] { Trie t; t.insertar("Casa"); }, invalid_argument);
    comprueba("30000 palabras de 6 letras coinciden con un set<string>", [&] {
        string base = textoAleatorio(6 * 30000, 4, 13);
        Trie t;
        set<string> ref;
        for (int i = 0; i < 30000; i++) {
            string w = base.substr(static_cast<size_t>(i) * 6, 6);
            t.insertar(w);
            ref.insert(w);
        }
        for (string pre : {"a", "ab", "abc", "dd", "bcd", "dcba"}) {
            int esperado = 0;
            for (const string& w : ref) {
                if (w.starts_with(pre)) {
                    esperado++;
                }
            }
            if (t.contarConPrefijo(pre) != esperado) {
                return "falla con el prefijo " + pre;
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(frecuenciaPalabras,
        caso("simple", map<string, int>{{"a", 2}, {"b", 1}}, string("a b a")),
        caso("espacios dobles y bordes", map<string, int>{{"a", 3}, {"b", 1}, {"c", 1}}, string("  a b  a   c a  ")),
        caso("vacío", map<string, int>{}, string("")),
        caso("solo espacios", map<string, int>{}, string("     ")),
        caso("mayúsculas distintas", map<string, int>{{"Sol", 1}, {"sol", 2}}, string("sol Sol sol")),
        caso("una palabra", map<string, int>{{"hola", 1}}, string("hola")),
        caso("frase", map<string, int>{{"el", 3}, {"gato", 1}, {"perro", 1}, {"sol", 1}, {"y", 2}}, string("el gato y el perro y el sol")));
    grupo("frecuenciaPalabras (más casos)");
    comprueba("acepta un literal y un trozo de otra cadena sin copiar", [&] {
        string grande = "xx uno dos uno yy";
        return frecuenciaPalabras(string_view(grande).substr(3, 11));
    }, map<string, int>{{"dos", 1}, {"uno", 2}});

    prueba(periodoMinimo,
        caso("abcabcabc", 3, string("abcabcabc")),
        caso("abab", 2, string("abab")),
        caso("aaaa", 1, string("aaaa")),
        caso("no se repite exactamente", 5, string("abcab")),
        caso("un carácter", 1, string("a")),
        caso("vacía", 0, string("")),
        caso("sin borde", 4, string("abcd")),
        caso("un solo bloque", 6, string("abcdef")));
    grupo("periodoMinimo (más casos)");
    comprueba("repetidas 1000 veces", [&] { return periodoMinimo(repetida("abcde", 1000)); }, 5);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    medir(funcionFallo, textoAleatorio(n, 2, 1));                                          // O(n)
    medir(buscarKMP, string(n, 'a'), string("aaab"));                                       // O(n + m)
    medir(funcionZ, textoAleatorio(n, 2, 2));                                              // O(n)
    medir(palindromoMasLargo, textoAleatorio(n, 2, 3));                                    // O(n)
    medir(frecuenciaPalabras, textoDePalabras(n));                                         // O(n)
    medir(periodoMinimo, repetida("ab", n));                                               // O(n)
    // Una consulta de hash tarda nanosegundos: cada repetición hace 1000 seguidas.
    medirCon("HashPolinomico.subhash", [](int n) { return make_pair(HashPolinomico(textoAleatorio(n, 3, 5)), n); }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.subhash(i % (e.second / 2), e.second / 2));
        }
    });                                                                                    // O(1)
    // Cada repetición inserta n palabras de 6 letras: el coste total es lineal en n (6 pasos por palabra).
    medirCon("Trie.insertar", [](int n) {
        string base = textoAleatorio(6 * n, 4, 7);
        vector<string> palabras;
        for (int i = 0; i < n; i++) {
            palabras.push_back(base.substr(static_cast<size_t>(i) * 6, 6));
        }
        return palabras;
    }, [](auto& palabras) {
        Trie t;
        for (const string& w : palabras) {
            t.insertar(w);
        }
        noOptimizar(t.contarConPrefijo("a"));
    }, "lineal", rango(2000, 40000, 2000));                                                // O(n) palabras
}
