/*
 * SOLUCIONES · Tema 4 · Recursión
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
#include <algorithm>
#include <cctype>
#include <climits>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

/**
 * Factorial recursivo con detección de desbordamiento.
 *
 * @complejidad Tiempo O(n); espacio O(n) de pila (n marcos).
 * @explicacion Caso base: 0! y 1! valen 1. Paso: n! = n · (n-1)!. Se rechaza antes n > 20 (21! ya no cabe), lo que además
 * acota la profundidad a 21 marcos. La multiplicación se hace al volver con `__builtin_mul_overflow`, que calcula el
 * producto y devuelve true si no cabe en el destino sin llegar a desbordar (el desbordamiento de un long long es
 * comportamiento indefinido); es una red de seguridad por si cambia el límite.
 * @alternativas Un bucle sería O(n) de tiempo y O(1) de pila. Comparar con LLONG_MAX / n antes de multiplicar es la
 * alternativa portable (sin extensiones del compilador). Una tabla con los 21 factoriales válidos da O(1).
 */
long long factorial(int n)
{
    if (n < 0) {
        throw invalid_argument("factorial de un negativo");
    }
    if (n > 20) {
        throw overflow_error("n! no cabe en un long long");
    }
    if (n <= 1) {
        return 1;
    }
    long long resultado;
    if (__builtin_mul_overflow(static_cast<long long>(n), factorial(n - 1), &resultado)) {
        throw overflow_error("n! no cabe en un long long");
    }
    return resultado;
}

/**
 * Máximo común divisor (algoritmo de Euclides).
 *
 * @complejidad Tiempo O(log min(|a|, |b|)); espacio O(log) de pila.
 * @explicacion mcd(a, b) = mcd(b, a mod b) hasta que b vale 0. Cada dos pasos el resto se reduce al menos a la mitad,
 * de ahí el coste logarítmico. En C++ `%` toma el signo del dividendo, así que con negativos los restos también lo
 * son, pero el algoritmo sigue convergiendo a 0; solo hay que devolver el valor absoluto al final.
 * @alternativas `std::gcd` (cabecera <numeric>) lo hace ya hecho. La versión con bucle usa O(1) de pila.
 */
int mcd(int a, int b)
{
    if (b == 0) {
        return a < 0 ? -a : a;
    }
    return mcd(b, a % b);
}

/**
 * Fibonacci con memoización.
 *
 * @complejidad Tiempo O(n); espacio O(n) (tabla y pila).
 * @bigo n
 * @explicacion La versión ingenua repite el mismo cálculo exponencialmente. Aquí cada fib(k) se calcula una vez: `memo[k]`
 * guarda el valor o -1 si aún no se conoce, y la recursión se hace con una lambda genérica que recibe a sí misma
 * (`self`), porque una lambda no puede llamarse por su nombre mientras se define. La tabla es LOCAL a cada llamada (no
 * `static`) para no arrastrar estado entre llamadas. Se rechazan antes los n negativos y los n > 92, porque fib(93) ya
 * no cabe en un long long: así la suma nunca desborda (que sería UB).
 * @alternativas Un bucle con dos variables es O(n) de tiempo y O(1) de memoria y no apila. La matriz de Fibonacci o el
 * doblado rápido dan O(log n).
 */
long long fibonacci(int n)
{
    if (n < 0) {
        throw invalid_argument("fibonacci de un negativo");
    }
    if (n > 92) {
        throw overflow_error("fib(n) no cabe en un long long");
    }
    vector<long long> memo(static_cast<size_t>(n) + 1, -1);
    auto fib = [&memo](auto&& self, int k) -> long long {
        if (k < 2) {
            return k;
        }
        long long& guardado = memo[static_cast<size_t>(k)];
        if (guardado == -1) {
            guardado = self(self, k - 1) + self(self, k - 2);
        }
        return guardado;
    };
    return fib(fib, n);
}

/**
 * Potencia por exponenciación rápida.
 *
 * @complejidad Tiempo O(log |exp|); espacio O(log |exp|) de pila.
 * @bigo log
 * @explicacion x^n = (x^(n/2))² si n es par y x·(x^(n/2))² si es impar (con división entera). Se calcula la mitad UNA
 * vez y se eleva al cuadrado: así el exponente se parte por dos en cada llamada. El exponente se pasa a long long
 * antes de negarlo, porque `-exp` con exp = INT_MIN desborda el int. Un exponente negativo se resuelve como el
 * inverso de la potencia positiva; 0 elevado a negativo daría una división por cero y se rechaza. La recursión va en
 * una lambda que recibe a sí misma (`self`).
 * @alternativas El bucle de n multiplicaciones es O(n). `std::pow` usa hardware/libm y es O(1), pero trabaja con
 * doubles y no sirve para módulos enteros.
 */
double potencia(double base, int exp)
{
    auto rapida = [base](auto&& self, long long e) -> double {
        if (e == 0) {
            return 1.0;
        }
        double mitad = self(self, e / 2);
        return e % 2 == 0 ? mitad * mitad : base * mitad * mitad;
    };
    if (exp < 0) {
        if (base == 0.0) {
            throw invalid_argument("0 elevado a un exponente negativo");
        }
        return 1.0 / rapida(rapida, -static_cast<long long>(exp));
    }
    return rapida(rapida, exp);
}

/**
 * ¿Es un palíndromo? (solo letras y dígitos ASCII, sin distinguir mayúsculas)
 *
 * @complejidad Tiempo O(n); espacio O(n) de pila.
 * @explicacion Se comparan los extremos i y j; si difieren, falso; si coinciden, se estrecha el problema (i + 1, j - 1)
 * hasta que se cruzan (caso base: true, también para el texto vacío o de un carácter). Los signos se saltan avanzando un
 * solo extremo. Los caracteres se convierten a unsigned char antes de isalnum/tolower, que con un char negativo
 * (bytes UTF-8) serían indefinidos. Se pasan índices (con `int`, no `size_t`: `j - 1` desde 0 daría la vuelta al máximo)
 * en lugar de copiar el string con substr en cada nivel, que haría O(n²). La recursión va en una lambda con `self`.
 * @alternativas Un bucle con dos índices es O(n) de tiempo y O(1) de pila. Construir el texto limpio y compararlo con
 * su inverso (`equal(s.begin(), s.begin() + n/2, s.rbegin())`) también es O(n).
 */
bool esPalindromo(const string& texto)
{
    auto limpio = [&texto](int i) {
        unsigned char c = static_cast<unsigned char>(texto[static_cast<size_t>(i)]);
        return c < 128 && isalnum(c);
    };
    auto comparar = [&texto, &limpio](auto&& self, int i, int j) -> bool {
        if (i >= j) {
            return true;
        }
        if (!limpio(i)) {
            return self(self, i + 1, j);
        }
        if (!limpio(j)) {
            return self(self, i, j - 1);
        }
        unsigned char a = static_cast<unsigned char>(texto[static_cast<size_t>(i)]);
        unsigned char b = static_cast<unsigned char>(texto[static_cast<size_t>(j)]);
        return tolower(a) == tolower(b) && self(self, i + 1, j - 1);
    };
    return comparar(comparar, 0, static_cast<int>(texto.size()) - 1);
}

/**
 * Todas las permutaciones de un vector.
 *
 * @complejidad Tiempo O(n · n!); espacio O(n · n!) por el resultado.
 * @explicacion Hay n! permutaciones y cada una cuesta O(n) copiarla, así que ese es el mínimo posible. Backtracking:
 * elegir, explorar y deshacer. `usado[i]` dice si xs[i] ya está en `actual`; se prueba cada elemento libre en orden
 * (lo que produce el orden pedido): se elige (push_back y marca), se explora la llamada recursiva y se DESHACE
 * (pop_back y desmarca). Cuando `actual` tiene n elementos se guarda una copia. Con un vector vacío el caso base se
 * cumple al entrar y devuelve [[]]. La recursión va en una lambda que recibe a sí misma (`self`).
 * @alternativas `next_permutation` sobre una copia ordenada recorre las permutaciones sin recursión (y sin repetir si hay
 * elementos iguales), también en O(n · n!).
 */
template <class T>
vector<vector<T>> permutaciones(const vector<T>& xs)
{
    vector<vector<T>> resultado;
    vector<bool> usado(xs.size(), false);
    vector<T> actual;
    auto generar = [&](auto&& self) -> void {
        if (actual.size() == xs.size()) {
            resultado.push_back(actual);
            return;
        }
        for (size_t i = 0; i < xs.size(); i++) {
            if (usado[i]) {
                continue;
            }
            usado[i] = true;
            actual.push_back(xs[i]);
            self(self);
            actual.pop_back();
            usado[i] = false;
        }
    };
    generar(generar);
    return resultado;
}

/**
 * Todos los subconjuntos de un vector.
 *
 * @complejidad Tiempo O(n · 2ⁿ); espacio O(n · 2ⁿ) por el resultado.
 * @explicacion Hay 2ⁿ subconjuntos y copiar cada uno cuesta hasta O(n). Cada visita guarda el subconjunto actual ANTES
 * de añadir elementos (de ahí que el vacío salga primero) y luego, para cada elemento desde `inicio`, lo añade, recursa
 * con inicio = i + 1 (así nunca se repite ni se reordena) y lo quita al volver (deshacer).
 * @alternativas Con una máscara de bits (de 0 a 2ⁿ - 1) se generan sin recursión, pero en otro orden y solo para n ≤ 63.
 */
template <class T>
vector<vector<T>> subconjuntos(const vector<T>& xs)
{
    vector<vector<T>> resultado;
    vector<T> actual;
    auto generar = [&](auto&& self, size_t inicio) -> void {
        resultado.push_back(actual);
        for (size_t i = inicio; i < xs.size(); i++) {
            actual.push_back(xs[i]);
            self(self, i + 1);
            actual.pop_back();
        }
    };
    generar(generar, 0);
    return resultado;
}

/**
 * Torres de Hanoi.
 *
 * @complejidad Tiempo O(2ⁿ); espacio O(n) de pila más los 2ⁿ - 1 movimientos del resultado.
 * @explicacion Para mover n discos de origen a destino: (1) mueve los n-1 de arriba a la torre auxiliar, (2) mueve el
 * disco grande directamente a destino, (3) mueve los n-1 desde la auxiliar a destino. T(n) = 2·T(n-1) + 1 = 2ⁿ - 1
 * movimientos, y es el mínimo posible. Los nombres de las torres se intercambian de papel en cada llamada. El caso
 * base n = 0 no hace nada.
 * @alternativas Existe una versión iterativa (alternar el disco más pequeño y el único movimiento legal restante), pero
 * la recursiva es la que revela la estructura del problema.
 */
VS hanoi(int n, const string& origen = "A", const string& auxiliar = "B", const string& destino = "C")
{
    if (n <= 0) {
        return {};
    }
    VS movimientos = hanoi(n - 1, origen, destino, auxiliar);
    movimientos.push_back(origen + "→" + destino);
    VS resto = hanoi(n - 1, auxiliar, origen, destino);
    movimientos.insert(movimientos.end(), resto.begin(), resto.end());
    return movimientos;
}

/**
 * Exponenciación modular rápida.
 *
 * @complejidad Tiempo O(log exp); espacio O(1).
 * @bigo log
 * @explicacion Se recorren los bits del exponente: si el bit es 1, el resultado se multiplica por la base actual; en cada
 * vuelta la base se eleva al cuadrado. Después de cada producto se reduce `% m`, así los números nunca superan m², que
 * cabe en un long long si m ≤ ~3·10⁹. La base negativa se normaliza primero a 0..m-1 (en C++ el resto de un negativo es
 * negativo) y el resultado inicial es `1 % m`, que vale 0 cuando m = 1.
 * @alternativas Multiplicar exp veces es O(exp). Para módulos de más de 3·10⁹ hay que multiplicar con __int128.
 */
long long potenciaModular(long long base, long long exp, long long m)
{
    if (exp < 0 || m <= 0) {
        throw invalid_argument("exponente negativo o módulo no positivo");
    }
    long long resultado = 1 % m;
    base %= m;
    if (base < 0) {
        base += m;
    }
    while (exp > 0) {
        if (exp & 1) {
            resultado = resultado * base % m;
        }
        base = base * base % m;
        exp >>= 1;
    }
    return resultado;
}

/**
 * Número de soluciones del problema de las n reinas.
 *
 * @complejidad Tiempo O(n!) en el peor caso, mucho menos con la poda; espacio O(n).
 * @explicacion Backtracking fila a fila: una reina por fila garantiza que no comparten fila. Tres vectores marcan las
 * columnas, diagonales (fila + col) y antidiagonales (fila - col + n - 1) ocupadas, de modo que las ramas inválidas se
 * podan en O(1) nada más empezar. Para cada columna libre se coloca la reina (marca), se avanza a la fila siguiente y
 * se DESHACE al volver. Cuando fila == n se ha colocado una reina en cada fila: es una solución. n = 0 da 1 (la forma de
 * no colocar nada).
 * @alternativas Con máscaras de bits (un entero por cada conjunto) es varias veces más rápido; es la técnica habitual en
 * concursos.
 */
int nReinas(int n)
{
    if (n < 0) {
        throw invalid_argument("n negativo");
    }
    vector<bool> columna(static_cast<size_t>(n), false);
    vector<bool> diagonal(static_cast<size_t>(2 * n), false);
    vector<bool> antidiagonal(static_cast<size_t>(2 * n), false);
    auto colocar = [&](auto&& self, int fila) -> int {
        if (fila == n) {
            return 1;
        }
        int total = 0;
        for (int col = 0; col < n; col++) {
            size_t c = static_cast<size_t>(col);
            size_t d = static_cast<size_t>(fila + col);
            size_t a = static_cast<size_t>(fila - col + n - 1);
            if (columna[c] || diagonal[d] || antidiagonal[a]) {
                continue;
            }
            columna[c] = diagonal[d] = antidiagonal[a] = true;
            total += self(self, fila + 1);
            columna[c] = diagonal[d] = antidiagonal[a] = false;
        }
        return total;
    };
    return colocar(colocar, 0);
}
