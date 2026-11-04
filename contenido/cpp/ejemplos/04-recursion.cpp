#include <algorithm>
#include <cctype>
#include <climits>
#include <cstdint>
#include <iostream>
#include <map>
#include <stack>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

/*
 * TEMA 4 · RECURSIÓN
 * ────────────────────────────────────────────────────────────────────────────
 * Una función recursiva se llama a sí misma resolviendo un problema más pequeño. Toda recursión necesita dos cosas:
 *     1. CASO BASE: cuándo parar (si falta, recursión infinita → la pila se agota y el programa muere).
 *     2. PASO RECURSIVO: acercarse al caso base en cada llamada.
 *
 * Cada llamada apila un «marco» (stack frame) en la PILA DE LLAMADAS: ahí viven sus parámetros, sus variables
 * locales y la dirección a la que volver. Al terminar la llamada, el marco se desapila. La pila es un trozo de
 * memoria de tamaño FIJO que decide el sistema operativo al crear el hilo: unos 8 MB en Linux, 1 MB en Windows
 * (aquí, en el playground, 256 MB). Con marcos de ~50-100 bytes caben del orden de cien mil llamadas en 8 MB y
 * ~10.000 en un marco grande. Si se agota hay DESBORDAMIENTO DE PILA (stack overflow).
 *
 *   Patrón de recursión          Ejemplo                       Llamadas        Pila
 *   lineal (n - 1)               factorial, sumaHasta          n               O(n)
 *   mitad (n / 2)                potencia rápida, búsq. bin.   log n           O(log n)
 *   dos ramas SIN memoria        fibonacci ingenuo             O(2ⁿ)           O(n)
 *   dos ramas CON memoria        fibonacci memoizado           O(n)            O(n)
 *   backtracking (probar/deshacer) permutaciones, n-reinas     O(n!), O(2ⁿ)    O(n)
 *
 * Desde Java:   igual que Java: sin optimización de cola garantizada. Pero NO hay StackOverflowError que capturar:
 *               en C++ el desbordamiento de pila no es una excepción, es un fallo de segmentación (SIGSEGV) y el
 *               programa muere sin dejarte hacer try/catch. Tampoco hay JVM que ponga la pila a 512 KB-1 MB.
 * Desde PHP/Python: Python corta con RecursionError a las ~1000 llamadas; PHP sigue hasta agotar la memoria. C++ no
 *               pone ningún límite propio: lo pone la pila del sistema, y se nota cuando se acaba.
 * Desde C:      lo mismo que en C. La diferencia: los objetos con destructores (vector, string...) viven en el marco
 *               y se destruyen solos al desapilar; los vector, además, guardan sus datos en el montón (heap), no en
 *               la pila, así que un vector local no agota la pila aunque tenga millones de elementos, pero un
 *               array local grande (int a[1000000]) sí.
 *
 * Optimización de cola (tail call): si la llamada recursiva es lo ÚLTIMO que hace la función, el compilador PUEDE
 * convertirla en un salto (con -O2 g++ y clang suelen hacerlo) y no apilar. Pero el estándar NO lo garantiza, así
 * que no cuentes con ello: con la compilación sin optimizar del modo comprobado, apila igual.
 *
 * Cómo se trabaja aquí
 *  - Pulsa Ctrl+Enter para ejecutar: verás las secciones de teoría y las pruebas de los ejercicios.
 *  - Cada ejercicio tiene un cuerpo «return pendiente();»: sustitúyelo por tu código y vuelve a ejecutar.
 *  - Ctrl+S guarda tu progreso. El botón «Solución» compara tu versión con la de referencia.
 *  - «Medir» (Ctrl+Alt+Enter) calcula experimentalmente el coste O() de los ejercicios marcados.
 */

using VS = vector<string>;
using V = vector<int>;
using VV = vector<vector<int>>;

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

/** Formatea con punto de millar: 1234567 → 1.234.567. */
string miles(long long n)
{
    string s = to_string(n);
    string r;
    int cuenta = 0;
    for (auto it = s.rbegin(); it != s.rend(); ++it) {
        if (cuenta > 0 && cuenta % 3 == 0) {
            r.insert(r.begin(), '.');
        }
        r.insert(r.begin(), *it);
        cuenta++;
    }
    return r;
}

/** Los enteros de 1 a n. */
V lista1(int n)
{
    V r;
    for (int i = 1; i <= n; i++) {
        r.push_back(i);
    }
    return r;
}

void cuentaAtras(int n, int nivel)
{
    string sangria(static_cast<size_t>(nivel) * 2, ' ');
    if (n == 0) {                                     // CASO BASE
        cout << sangria << "¡despegue! (caso base: aquí empiezan a volver)\n";
        return;
    }
    cout << sangria << "baja n=" << n << "\n";
    cuentaAtras(n - 1, nivel + 1);                    // PASO RECURSIVO: n más pequeño
    cout << sangria << "vuelve n=" << n << "\n";      // esto se ejecuta al DESAPILAR
}

// suma(n) = n + suma(n - 1)            suma(0) = 0
long long sumaHasta(long long n)
{
    return n == 0 ? 0 : n + sumaHasta(n - 1);
}

/** Un árbol de carpetas: ficheros con su tamaño en KB y subcarpetas con nombre. Un vector de su propio tipo es válido. */
struct Carpeta {
    map<string, int> ficheros;
    vector<pair<string, Carpeta>> hijas;
};

int sumaCarpetas(const Carpeta& carpeta)
{
    int total = 0;
    for (const auto& [nombre, kb] : carpeta.ficheros) {
        total += kb;
    }
    for (const auto& [nombre, hija] : carpeta.hijas) {
        total += sumaCarpetas(hija);                  // el problema pequeño: una carpeta más pequeña
    }
    return total;
}

// Recursión mutua: dos funciones que se llaman entre sí. En C++ (y en C) hay que DECLARAR una antes de definir la otra.
bool esImpar(int n);                                  // declaración adelantada (prototipo)

bool esPar(int n)
{
    return n == 0 ? true : esImpar(n - 1);
}

bool esImpar(int n)
{
    return n == 0 ? false : esPar(n - 1);
}

long long fibIngenuo(int n, long long& llamadas)      // long long& = referencia: todas las llamadas comparten el contador
{
    llamadas++;
    return n < 2 ? n : fibIngenuo(n - 1, llamadas) + fibIngenuo(n - 2, llamadas);
}

/** memo recuerda lo ya calculado (se pasa por referencia: si se pasara por valor, cada llamada copiaría el mapa entero). */
long long fibMemo(int n, unordered_map<int, long long>& memo, long long& llamadas)
{
    llamadas++;
    if (n < 2) {
        return n;
    }
    if (auto it = memo.find(n); it != memo.end()) {
        return it->second;
    }
    long long valor = fibMemo(n - 1, memo, llamadas) + fibMemo(n - 2, memo, llamadas);
    memo[n] = valor;
    return valor;
}

/** Todas las cadenas binarias de longitud n: decide un bit, sigue, y al volver DESHACE esa decisión y prueba el otro. */
void binarios(int n, string& actual, VS& resultado)
{
    if (static_cast<int>(actual.size()) == n) {      // CASO BASE: solución completa
        resultado.push_back(actual);
        return;
    }
    for (char bit : {'0', '1'}) {
        actual.push_back(bit);                        // 1. elegir
        binarios(n, actual, resultado);               // 2. explorar
        actual.pop_back();                            // 3. DESHACER (el string es mutable y se comparte: hay que limpiar)
    }
}

int sumaCarpetasIterativa(const Carpeta& raiz)
{
    int total = 0;
    stack<const Carpeta*> pila;                       // la pila explícita sustituye a la pila de llamadas
    pila.push(&raiz);
    while (!pila.empty()) {
        const Carpeta* actual = pila.top();
        pila.pop();
        for (const auto& [nombre, kb] : actual->ficheros) {
            total += kb;
        }
        for (const auto& [nombre, hija] : actual->hijas) {
            pila.push(&hija);
        }
    }
    return total;
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · factorial ─────────────────────────────────────────────────
/**
 * n! = n × (n-1) × ... × 1, con 0! = 1. Hazlo recursivo.
 *  - n negativo → lanza invalid_argument.
 *  - Un long long de 64 bits solo llega a 20! (2.432.902.008.176.640.000): para n > 20 lanza overflow_error.
 *
 * Trampa de C++: el desbordamiento de un entero CON signo es comportamiento indefinido (UB): el compilador puede
 * suponer que no ocurre y devolver cualquier cosa; en el modo comprobado del playground, UBSan aborta el programa.
 * (Con enteros SIN signo, unsigned, da la vuelta de forma definida, pero igualmente te daría un número falso.)
 * Para detectarlo ANTES de que ocurra: `__builtin_mul_overflow(a, b, &resultado)` (GCC y clang) devuelve true si
 * a * b no cabe; o comprueba `resultado > LLONG_MAX / n` antes de multiplicar.
 */
long long factorial(int n)
{
    return pendiente();
}

// ── Ejercicio 2 · mcd ───────────────────────────────────────────────────────
/**
 * Máximo común divisor con el algoritmo de Euclides: mcd(a, b) = mcd(b, a mod b); mcd(a, 0) = |a|.
 * Admite negativos (el resultado siempre es positivo). mcd(0, 0) = 0. No te pasarán INT_MIN
 * (abs(INT_MIN) desborda: es UB).
 * En C++ el resto `%` toma el signo del dividendo: -12 % 18 vale -12, no 6. Mira cómo afecta al algoritmo.
 */
int mcd(int a, int b)
{
    return pendiente();
}

// ── Ejercicio 3 · fibonacci ─────────────────────────────────────────────────
/**
 * fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).
 *  - n negativo → invalid_argument.
 *  - fib(92) = 7.540.113.804.746.346.429 es el mayor que cabe en un long long: n > 92 → overflow_error.
 * La versión ingenua es O(2ⁿ): con n = 50 tarda minutos. Hazla O(n) con memoización (un vector o un
 * unordered_map pasado por referencia a una función auxiliar). Ojo con una caché `static`: que no se arrastre
 * entre llamadas con resultados viejos. Pulsa «Medir» para verlo.
 */
long long fibonacci(int n)
{
    return pendiente();
}

// ── Ejercicio 4 · potencia ──────────────────────────────────────────────────
/**
 * base^exp en O(log n) con la idea «divide y vencerás»:
 *     x^n = (x^(n/2))² si n es par;   x · (x^((n-1)/2))² si n es impar
 * Exponente negativo → 1 / base^(-exp). Cualquier base elevada a 0 es 1.0. 0 elevado a un exponente negativo
 * → invalid_argument. (El bucle de n multiplicaciones es O(n); aquí se pide mucho menos.)
 *
 * Trampa: -exp con exp = INT_MIN desborda el int (UB). Trabaja con long long para el exponente o trata el
 * signo aparte.
 */
double potencia(double base, int exp)
{
    return pendiente();
}

// ── Ejercicio 5 · esPalindromo ──────────────────────────────────────────────
/**
 * ¿Se lee igual al revés? Solo cuentan las letras y los dígitos ASCII: se ignoran mayúsculas, espacios y signos
 * (los acentos no se normalizan: los bytes UTF-8 no ASCII se tratan como signos). Hazlo con recursión comparando
 * los extremos y acercándote al centro.
 *   "Anita lava la tina" → true   ·   "A man, a plan, a canal: Panama" → true   ·   "hola" → false
 *
 * Trampas: `isalnum` y `tolower` piden un unsigned char (un char negativo es UB: convierte con
 * static_cast<unsigned char>). Y si usas índices size_t, `j - 1` con j = 0 da la vuelta al máximo: usa int.
 */
bool esPalindromo(const string& texto)
{
    return pendiente();
}

// ── Ejercicio 6 · permutaciones ─────────────────────────────────────────────
/**
 * Todas las ordenaciones posibles de los elementos del vector (backtracking), en este orden:
 * se elige el primer elemento en el orden original y se permuta el resto.
 *   permutaciones(V{1, 2, 3}) → [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
 * Vector vacío → [[]] (hay exactamente una forma de ordenar nada).
 * Pista: un vector<bool> de «ya usado» y un vector actual al que haces push_back / pop_back.
 */
template <class T>
vector<vector<T>> permutaciones(const vector<T>& xs)
{
    return pendiente();
}

// ── Ejercicio 7 · subconjuntos ──────────────────────────────────────────────
/**
 * Todos los subconjuntos (el «conjunto de las partes»), en orden de backtracking: primero el vacío, y luego
 * cada elemento seguido de los subconjuntos que se pueden formar con los que le siguen.
 *   subconjuntos(V{1, 2, 3}) → [[], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]]
 * Para n elementos hay 2ⁿ subconjuntos.
 */
template <class T>
vector<vector<T>> subconjuntos(const vector<T>& xs)
{
    return pendiente();
}

// ── Ejercicio 8 · hanoi ─────────────────────────────────────────────────────
/**
 * Torres de Hanoi: mueve n discos de origen a destino usando auxiliar, sin poner nunca uno grande sobre uno
 * pequeño. Devuelve la lista de movimientos como "A→C". C++ sí tiene parámetros por defecto: hanoi(n) ya
 * usa A, B y C.
 *   hanoi(2) → [A→B, A→C, B→C]
 * Hacen falta exactamente 2ⁿ − 1 movimientos. Con n = 0 no hay ninguno.
 */
VS hanoi(int n, const string& origen = "A", const string& auxiliar = "B", const string& destino = "C")
{
    return pendiente();
}

// ── Ejercicio 9 · potenciaModular (extra de C++) ────────────────────────────
/**
 * (base^exp) mod m en O(log exp): exponenciación rápida donde cada producto se reduce módulo m para que nunca
 * crezca. Es la herramienta de casi todos los problemas con «módulo 1.000.000.007».
 *  - Resultado siempre en 0..m-1, también con base negativa (en C++ -8 % 5 vale -3, hay que normalizar).
 *  - exp < 0 o m <= 0 → invalid_argument. Con m = 1 todo da 0. potenciaModular(b, 0, m) = 1 % m.
 *  - Con m hasta ~3·10⁹ el producto de dos restos cabe en un long long; para módulos mayores haría falta __int128.
 *    ¡Y aquí NO vale calcular base^exp y luego tomar el resto: desbordaría al instante!
 */
long long potenciaModular(long long base, long long exp, long long m)
{
    return pendiente();
}

// ── Ejercicio 10 · nReinas (extra de C++) ───────────────────────────────────
/**
 * Cuenta de cuántas formas se pueden colocar n reinas en un tablero n×n sin que se ataquen (ni por fila, ni por
 * columna, ni por diagonal). Es el backtracking clásico: coloca una reina por fila, prueba cada columna libre y
 * DESHAZ la decisión al volver.
 *   nReinas(4) → 2 · nReinas(6) → 4 · nReinas(8) → 92 · nReinas(0) → 1 (el tablero vacío es una solución)
 * n negativo → invalid_argument. Pista: vectores (o bitsets) de «columna ocupada», «diagonal ocupada» y
 * «antidiagonal ocupada»: la casilla (fila, col) usa la diagonal fila + col y la antidiagonal fila - col + n - 1.
 */
int nReinas(int n)
{
    return pendiente();
}

int main()
{

// ════════════════════════════════════════════════════════════════════════════
// 1. ANATOMÍA: LA PILA DE LLAMADAS
// ════════════════════════════════════════════════════════════════════════════
    titulo("1. La pila de llamadas");

    cuentaAtras(3, 0);

    // ── Desbordamiento de pila
    // Si falta el caso base (o la profundidad es enorme), los marcos llenan la pila y el sistema operativo mata el
    // programa con SIGSEGV. En C++ NO se puede capturar con try/catch: no es una excepción. Por eso no lo
    // ejecutamos aquí; el playground lo detectaría y te diría «Stack overflow» con la línea de la recursión.
    //      int infinito(int n) { return infinito(n + 1) + 1; }      // sin caso base → muerte segura
    // Regla práctica: si la profundidad puede pasar de ~10⁴-10⁵ (listas de un millón, caminos largos en un
    // grafo...), no uses recursión: usa un bucle o una pila explícita (sección 5).

// ════════════════════════════════════════════════════════════════════════════
// 2. PENSAR EN «SI SÉ RESOLVER LO PEQUEÑO, RESUELVO LO GRANDE»
// ════════════════════════════════════════════════════════════════════════════
    titulo("2. Descomponer");

    cout << "sumaHasta(100) = " << sumaHasta(100) << " (la fórmula n(n+1)/2 da " << 100 * 101 / 2 << ")\n";
    cout << "sumaHasta(100000) = " << miles(sumaHasta(100000)) << " (100.000 marcos apilados: caben en 256 MB, pero no en toda pila pequeña)\n";

    // Recursión sobre estructuras anidadas: aquí un bucle no basta, la recursión es natural.
    Carpeta arbol;
    arbol.ficheros = {{"a.txt", 10}, {"d.md", 1}};
    Carpeta src;
    src.ficheros = {{"b.cpp", 5}};
    Carpeta lib;
    lib.ficheros = {{"c.cpp", 7}};
    src.hijas.push_back({"lib", lib});
    arbol.hijas.push_back({"src", src});
    cout << "tamaño total del árbol: " << sumaCarpetas(arbol) << " KB\n";

    cout << "esPar(10): " << esPar(10) << " · esImpar(7): " << esImpar(7) << "\n";

    // ── Factorial y el desbordamiento de enteros
    // 20! = 2.432.902.008.176.640.000 es lo máximo que cabe en un long long (límite ≈ 9,22·10¹⁸). Multiplicar
    // de más con enteros CON signo es UB: no «da la vuelta», el compilador puede hacer lo que quiera (y el modo
    // comprobado aborta). Detectarlo antes con __builtin_mul_overflow (GCC/clang):
    long long acumulado = 1;
    for (int i = 1; i <= 25; i++) {
        long long siguiente;
        if (__builtin_mul_overflow(acumulado, static_cast<long long>(i), &siguiente)) {
            cout << i << "! NO cabe en un long long: __builtin_mul_overflow lo detectó (acumulado " << miles(acumulado) << ")\n";
            break;
        }
        acumulado = siguiente;
    }
    // Con enteros SIN signo la multiplicación da la vuelta de forma DEFINIDA (módulo 2⁶⁴): sin error, pero falso.
    unsigned long long envuelto = 1;
    for (unsigned long long i = 1; i <= 25; i++) {
        envuelto *= i;
    }
    cout << "25! en unsigned long long = " << envuelto << " (mal: sin aviso, el verdadero es 15511210043330985984000000)\n";
    double aproximado = 1;
    for (int i = 2; i <= 25; i++) {
        aproximado *= i;
    }
    cout << "25! en double ≈ " << aproximado << " (no desborda, pero pierde cifras exactas: un double guarda ~15-16)\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. EL PROBLEMA: LLAMADAS REPETIDAS (Y LA MEMOIZACIÓN)
// ════════════════════════════════════════════════════════════════════════════
    // fib(n) = fib(n-1) + fib(n-2). Escrito sin más, recalcula lo mismo una y otra vez:
    // fib(5) llama a fib(3) dos veces, a fib(2) tres veces... El número de llamadas crece como 2ⁿ.
    titulo("3. Memoización");

    for (int n : {10, 20, 30}) {
        long long a = 0;
        long long b = 0;
        unordered_map<int, long long> memo;
        long long resultado = fibIngenuo(n, a);
        fibMemo(n, memo, b);
        cout << "fib(" << n << ") = " << resultado << "   llamadas: ingenuo " << miles(a) << " · con memoria " << b << "\n";
    }
    cout << "Memoización = cambiar memoria por tiempo: O(2ⁿ) pasa a O(n). Es la base de la programación dinámica (tema 9).\n";

    // ── Tres formas de memoizar en C++
    //  1. Un mapa/vector pasado por referencia a una función auxiliar (lo de arriba).
    //  2. Una variable `static` dentro de la función: la caché vive entre llamadas (¡y entre pruebas!). Cómoda,
    //     pero oculta y no es segura con varios hilos.
    //  3. Una lambda recursiva: una lambda no puede llamarse por su nombre mientras se define, pero C++14 deja
    //     pasársela a sí misma con un parámetro genérico (`self`):
    vector<long long> cache(60, -1);
    auto fib = [&cache](auto&& self, int n) -> long long {
        if (n < 2) {
            return n;
        }
        if (cache[static_cast<size_t>(n)] != -1) {
            return cache[static_cast<size_t>(n)];
        }
        return cache[static_cast<size_t>(n)] = self(self, n - 1) + self(self, n - 2);
    };
    cout << "fib(50) con lambda recursiva y vector como caché: " << fib(fib, 50) << "\n";
    // Alternativa «de abajo arriba» (tabulación): rellenar una tabla desde los casos pequeños, sin recursión
    // ni riesgo de desbordar la pila.
    long long anterior = 0, actual = 1;
    for (int i = 2; i <= 50; i++) {
        long long siguiente = anterior + actual;
        anterior = actual;
        actual = siguiente;
    }
    cout << "fib(50) con bucle y dos variables: " << actual << " (O(n) de tiempo y O(1) de memoria)\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. BACKTRACKING: PROBAR, DESHACER, PROBAR OTRA COSA
// ════════════════════════════════════════════════════════════════════════════
    // Se construye una solución paso a paso; si un camino no sirve, se deshace la última decisión y se prueba la
    // siguiente. Es la plantilla de permutaciones, subconjuntos, sudokus, n-reinas... Esquema:
    //      elegir  →  explorar (llamada recursiva)  →  deshacer
    // En C++ el estado se suele compartir por REFERENCIA (un solo string o vector que crece y mengua), así que
    // el «deshacer» (pop_back) es imprescindible; si copiaras el estado en cada llamada (pasar por valor)
    // no haría falta deshacer, pero cada llamada costaría O(tamaño).
    titulo("4. Backtracking");

    VS cadenas;
    string actualBin;
    binarios(3, actualBin, cadenas);
    cout << mostrar(cadenas) << "\n";

// ════════════════════════════════════════════════════════════════════════════
// 5. CUÁNDO NO USAR RECURSIÓN
// ════════════════════════════════════════════════════════════════════════════
    // · Cuando la profundidad pueda ser enorme (un bucle no apila marcos).
    // · Cuando el trabajo se repite (usa memoización o un bucle que guarde lo calculado).
    // Cualquier recursión se puede convertir en un bucle con una pila explícita (un stack<>, que vive en el montón
    // y crece hasta donde llegue la memoria, no hasta donde llegue la pila):
    titulo("5. De recursión a bucle con pila explícita");

    cout << "mismo resultado sin recursión: " << sumaCarpetasIterativa(arbol) << " KB\n";
    long long sumaBucle = 0;
    for (long long i = 1; i <= 100'000'000; i++) {
        sumaBucle += i;
    }
    cout << "sumaHasta(100.000.000) con un bucle: " << miles(sumaBucle) << " (con recursión habría reventado la pila)\n";

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

    prueba(factorial,
        caso("0! = 1", 1LL, 0),
        caso("1! = 1", 1LL, 1),
        caso("5! = 120", 120LL, 5),
        caso("10!", 3628800LL, 10),
        caso("20! es el mayor que cabe", 2432902008176640000LL, 20));
    grupo("factorial()");
    lanza("negativo", [&] { factorial(-1); }, invalid_argument);
    lanza("21! desborda", [&] { factorial(21); }, overflow_error);
    lanza("25! también", [&] { factorial(25); }, overflow_error);

    prueba(mcd,
        caso("básico", 6, 12, 18),
        caso("coprimos", 1, 7, 13),
        caso("con cero", 5, 0, 5),
        caso("con cero (otro orden)", 5, 5, 0),
        caso("negativos", 6, -12, 18),
        caso("el segundo negativo", 6, 12, -18),
        caso("iguales", 9, 9, 9),
        caso("los dos cero", 0, 0, 0),
        caso("números grandes", 21, 1071, 462));

    prueba(fibonacci,
        caso("fib(0)", 0LL, 0),
        caso("fib(1)", 1LL, 1),
        caso("fib(2)", 1LL, 2),
        caso("fib(10)", 55LL, 10),
        caso("fib(30)", 832040LL, 30),
        caso("fib(50) (la versión ingenua no llega)", 12586269025LL, 50),
        caso("fib(90)", 2880067194370816120LL, 90),
        caso("fib(92) es el último que cabe", 7540113804746346429LL, 92));
    grupo("fibonacci()");
    lanza("negativo", [&] { fibonacci(-1); }, invalid_argument);
    lanza("fib(93) desborda", [&] { fibonacci(93); }, overflow_error);
    comprueba("dos llamadas seguidas dan lo mismo", [&] { return V{static_cast<int>(fibonacci(25)), static_cast<int>(fibonacci(25))}; }, V{75025, 75025});

    prueba(potencia,
        caso("2^10", 1024.0, 2.0, 10),
        caso("3^0", 1.0, 3.0, 0),
        caso("2^1", 2.0, 2.0, 1),
        caso("1.5^3", 3.375, 1.5, 3),
        caso("exponente negativo", 0.25, 2.0, -2),
        caso("0^0", 1.0, 0.0, 0),
        caso("0^5", 0.0, 0.0, 5),
        caso("(-2)^3", -8.0, -2.0, 3),
        caso("exponente enorme sin desbordar", 1.0, 1.0, 1'000'000),
        caso("exponente INT_MIN (cuidado al negarlo)", 1.0, 1.0, INT_MIN));
    grupo("potencia()");
    lanza("0 elevado a negativo", [&] { potencia(0.0, -1); }, invalid_argument);

    prueba(esPalindromo,
        caso("palabra", true, string("reconocer")),
        caso("con espacios y mayúsculas", true, string("Anita lava la tina")),
        caso("con signos", true, string("A man, a plan, a canal: Panama")),
        caso("no lo es", false, string("hola")),
        caso("vacío", true, string("")),
        caso("un carácter", true, string("x")),
        caso("solo signos", true, string("¡?!")),
        caso("dígitos", true, string("12321")),
        caso("casi", false, string("abca")));

    prueba(permutaciones,
        caso("tres elementos", VV{{1, 2, 3}, {1, 3, 2}, {2, 1, 3}, {2, 3, 1}, {3, 1, 2}, {3, 2, 1}}, V{1, 2, 3}),
        caso("dos elementos", vector<VS>{{"a", "b"}, {"b", "a"}}, VS{"a", "b"}),
        caso("uno", VV{{7}}, V{7}),
        caso("vacía", VV{{}}, V{}));
    grupo("permutaciones()");
    comprueba("5 elementos dan 120", [&] { return permutaciones(lista1(5)).size(); }, size_t{120});
    comprueba("ninguna se repite", [&] {
        auto todas = permutaciones(lista1(4));
        sort(todas.begin(), todas.end());
        return unique(todas.begin(), todas.end()) - todas.begin();
    }, 24);

    prueba(subconjuntos,
        caso("tres elementos", VV{{}, {1}, {1, 2}, {1, 2, 3}, {1, 3}, {2}, {2, 3}, {3}}, V{1, 2, 3}),
        caso("uno", vector<VS>{{}, {"x"}}, VS{"x"}),
        caso("vacío", VV{{}}, V{}));
    grupo("subconjuntos()");
    comprueba("10 elementos dan 1024", [&] { return subconjuntos(lista1(10)).size(); }, size_t{1024});

    prueba(hanoi,
        caso("n = 0", VS{}, 0),
        caso("n = 1", VS{"A→C"}, 1),
        caso("n = 2", VS{"A→B", "A→C", "B→C"}, 2),
        caso("n = 3", VS{"A→C", "A→B", "C→B", "A→C", "B→A", "B→C", "A→C"}, 3),
        caso("otros nombres", VS{"X→Z"}, 1, string("X"), string("Y"), string("Z")));
    grupo("hanoi()");
    comprueba("10 discos = 1023 movimientos", [&] { return hanoi(10).size(); }, size_t{1023});

    prueba(potenciaModular,
        caso("2^10 mod 1000", 24LL, 2LL, 10LL, 1000LL),
        caso("exponente 0", 1LL, 3LL, 0LL, 7LL),
        caso("módulo 1: todo es 0", 0LL, 5LL, 3LL, 1LL),
        caso("2^62 mod 1e9+7", 145586002LL, 2LL, 62LL, 1'000'000'007LL),
        caso("exponente de 10^18", 259616729LL, 7LL, 1'000'000'000'000'000'000LL, 1'000'000'007LL),
        caso("base negativa: resultado en 0..m-1", 2LL, -2LL, 3LL, 5LL),
        caso("base mayor que el módulo", 9LL, 3LL, 200LL, 13LL),
        caso("módulo grande", 730701112LL, 123456789LL, 987654321LL, 998244353LL));
    grupo("potenciaModular()");
    lanza("exponente negativo", [&] { potenciaModular(2, -1, 5); }, invalid_argument);
    lanza("módulo cero", [&] { potenciaModular(2, 3, 0); }, invalid_argument);

    prueba(nReinas,
        caso("n = 0", 1, 0),
        caso("n = 1", 1, 1),
        caso("n = 2 no tiene solución", 0, 2),
        caso("n = 3 tampoco", 0, 3),
        caso("n = 4", 2, 4),
        caso("n = 6", 4, 6),
        caso("n = 8", 92, 8));
    grupo("nReinas()");
    lanza("n negativo", [&] { nReinas(-1); }, invalid_argument);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // fibonacci con la versión ingenua explota (O(2ⁿ)), con memoria es lineal. La escala es lineal (5, 10, 15...)
    // porque con tamaños que se doblan, el ingenuo no acabaría nunca. Una sola llamada tarda microsegundos
    // (el reloj no la distingue del ruido), así que cada repetición hace 2000 llamadas seguidas.
    medirCon("fibonacci", [](int n) { return n; }, [](auto& n) {
        for (int i = 0; i < 2000; i++) {
            noOptimizar(fibonacci(n));
        }
    }, "lineal", rango(5, 90, 5));
    // potencia: con n = 131072 un bucle hace 131072 multiplicaciones; la versión rápida, 17 (y se repite 200 veces
    // para que el tiempo sea medible).
    medirCon("potencia", [](int n) { return n; }, [](auto& n) {
        for (int i = 0; i < 200; i++) {
            noOptimizar(potencia(1.0, n));
        }
    });
    medirCon("potenciaModular", [](int n) { return n; }, [](auto& n) {
        for (int i = 0; i < 200; i++) {
            noOptimizar(potenciaModular(3, n, 1'000'000'007));
        }
    });
}
