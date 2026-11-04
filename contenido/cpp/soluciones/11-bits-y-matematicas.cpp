#include <algorithm>
#include <bit>
#include <stdexcept>
#include <utility>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 11 · Bits y matemáticas
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Contar bits encendidos (Kernighan).
 *
 * @complejidad Tiempo O(k), con k = número de bits a 1 (como mucho 64); espacio O(1).
 * @explicacion `x & (x - 1)` apaga el bit encendido más bajo: restar 1 invierte ese bit y todos los ceros que tiene a su derecha, y el AND
 * deja todo lo demás igual. Cada vuelta del bucle elimina por tanto exactamente un bit, así que se hacen tantas vueltas como bits a 1 (un
 * número disperso como 2⁶³ cuesta una sola). El parámetro es `unsigned long long`: con tipos sin signo el desplazamiento y la resta
 * están totalmente definidos, y no hay truncamiento a 32 bits como con `__builtin_popcount`.
 * @alternativas `std::popcount(x)` de <bit> (C++20) usa la instrucción POPCNT del procesador. Una tabla de 256 entradas cuenta por bytes.
 * Mirar los 64 bits uno a uno con `x >> i & 1` es O(64) siempre.
 */
int contarBits(unsigned long long x)
{
    int cuenta = 0;
    while (x != 0) {
        x &= x - 1;
        cuenta++;
    }
    return cuenta;
}

/**
 * El número que aparece una sola vez (XOR).
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion El XOR es conmutativo y asociativo, x ^ x = 0 y x ^ 0 = x. Al combinar todos los valores, cada pareja se anula sin importar
 * el orden en que aparezca y solo queda el valor único. No hace falta un mapa de frecuencias (O(n) de memoria) ni ordenar (O(n log n)).
 * Funciona con negativos porque el XOR de int es bit a bit sobre el complemento a dos, y no puede desbordar.
 * @alternativas Un `unordered_map<int,int>` de frecuencias da la misma complejidad de tiempo con memoria O(n). Ordenar y mirar de dos en
 * dos es O(n log n). Si en vez de parejas fueran tríos (todos tres veces menos uno), se cuentan los bits columna a columna módulo 3.
 * @bigo n
 */
int numeroUnico(const vector<int>& a)
{
    int r = 0;
    for (int x : a) {
        r ^= x;
    }
    return r;
}

/**
 * Subconjuntos con una suma dada.
 *
 * @complejidad Tiempo O(2ⁿ); espacio O(2ⁿ) por la tabla de sumas (O(1) si se recalcula bit a bit, a cambio de O(n·2ⁿ)).
 * @explicacion Cada número de 0 a 2ⁿ - 1 es una máscara: el bit i indica si se coge a[i]. La suma de la máscara se obtiene de la de la máscara con su bit más
 * bajo apagado: `suma[mask] = suma[mask & (mask - 1)] + a[countr_zero(mask)]`, así que cada subconjunto cuesta O(1) en lugar de O(n). Con
 * n ≤ 25 la tabla ocupa 25 M × 8 bytes como mucho, por eso se acota. La suma va en `long long` (cuatro valores de 2·10⁹ ya no caben en int)
 * y la máscara es `size_t`: `1 << n` con int sería UB a partir de n = 31.
 * @alternativas Con n mayor, «meet in the middle» (dividir en dos mitades de 2^(n/2) sumas y combinarlas con una búsqueda) o la
 * programación dinámica de la mochila si los valores son pequeños y positivos.
 * @bigo exp
 */
long long subconjuntosConSuma(const vector<int>& a, long long objetivo)
{
    if (a.size() > 25) {
        throw invalid_argument("subconjuntosConSuma: demasiados elementos (máximo 25)");
    }
    size_t n = a.size();
    size_t total = size_t{1} << n;
    vector<long long> suma(total, 0);
    long long cuenta = suma[0] == objetivo ? 1 : 0;      // el subconjunto vacío
    for (size_t mask = 1; mask < total; mask++) {
        size_t bajo = static_cast<size_t>(countr_zero(mask));
        suma[mask] = suma[mask & (mask - 1)] + a[bajo];
        if (suma[mask] == objetivo) {
            cuenta++;
        }
    }
    return cuenta;
}

/**
 * Exponenciación rápida modular.
 *
 * @complejidad Tiempo O(log exponente); espacio O(1).
 * @explicacion Se recorre el exponente en binario: cuando el bit bajo es 1, se multiplica el resultado por la potencia actual de la base; luego la base se
 * eleva al cuadrado y se pasa al bit siguiente (`base^(2^k)`). Son unas 60 vueltas para un exponente de 10¹⁸ frente a 10¹⁸ del método ingenuo.
 * La base se normaliza primero a [0, m) para admitir negativos, y el módulo se limita a 3·10⁹ para que `base * base` (< 9·10¹⁸) quepa en
 * long long sin desbordar (que sería UB). El resultado inicial es `1 % m`, no 1: con m = 1 cualquier potencia vale 0.
 * @alternativas La versión recursiva (`a^b = (a^(b/2))²·a^(b%2)`) es equivalente pero gasta pila. Con módulos de hasta 10¹⁸ habría que usar
 * `unsigned __int128` para el producto. Con módulo primo, el exponente se puede reducir primero módulo (p - 1) por Fermat.
 * @bigo log
 */
long long potenciaModular(long long base, long long exponente, long long modulo)
{
    if (modulo < 1 || modulo > 3'000'000'000LL) {
        throw invalid_argument("potenciaModular: el módulo debe estar entre 1 y 3·10⁹");
    }
    if (exponente < 0) {
        throw invalid_argument("potenciaModular: el exponente no puede ser negativo");
    }
    base = ((base % modulo) + modulo) % modulo;
    long long r = 1 % modulo;
    while (exponente > 0) {
        if (exponente & 1) {
            r = r * base % modulo;
        }
        base = base * base % modulo;
        exponente >>= 1;
    }
    return r;
}

/**
 * Inverso modular con Euclides extendido.
 *
 * @complejidad Tiempo O(log m); espacio O(1).
 * @explicacion Euclides iterativo mantiene, en cada paso, los coeficientes con los que cada resto se expresa como combinación de a y m. Al terminar, si el
 * mcd es 1, el coeficiente de a es x con a·x + m·y = 1, o sea a·x ≡ 1 (mod m). Ese x puede salir negativo: se normaliza a [0, m). Si el mcd es
 * distinto de 1 no existe inverso y se devuelve -1. Primero se reduce `a` módulo m (con corrección para negativos), de modo que todos los productos
 * son pequeños. Sirve para cualquier m, primo o no.
 * @alternativas Con m primo, Fermat: `potenciaModular(a, m - 2, m)`, un poco más simple pero solo vale para primos. Para invertir muchos números
 * seguidos hay una recurrencia O(1) por número: inv[i] = -(m / i) · inv[m % i] mod m.
 */
long long inversoModular(long long a, long long m)
{
    if (m < 2) {
        throw invalid_argument("inversoModular: el módulo debe ser al menos 2");
    }
    long long r0 = m;
    long long r1 = ((a % m) + m) % m;
    long long t0 = 0;
    long long t1 = 1;
    while (r1 != 0) {
        long long q = r0 / r1;
        long long r2 = r0 - q * r1;
        long long t2 = t0 - q * t1;
        r0 = r1;
        r1 = r2;
        t0 = t1;
        t1 = t2;
    }
    if (r0 != 1) {
        return -1;
    }
    return ((t0 % m) + m) % m;
}

/**
 * Criba de Eratóstenes.
 *
 * @complejidad Tiempo O(n log log n); espacio O(n).
 * @explicacion Se parte de «todo es primo» y, para cada primo p con p² ≤ n, se tachan sus múltiplos desde p² (los menores, k·p con k < p, ya los
 * tachó un primo menor). Basta llegar a √n porque todo compuesto ≤ n tiene un factor ≤ √n. El número de tachados total es n·(1/2 + 1/3 + 1/5 + ...) =
 * O(n log log n), casi lineal. Se usa `vector<char>` (un byte por número, acceso directo) en vez de `vector<bool>` (empaquetado a bits, más lento) y
 * los índices del bucle son `long long`: `i * i` con int desborda cuando n se acerca a 2³¹.
 * @alternativas La criba lineal es O(n) estricto. Para rangos grandes lejos del cero, la criba segmentada ahorra memoria. Para comprobar UN número,
 * la división de prueba hasta √n o Miller-Rabin.
 * @bigo n
 */
vector<int> criba(int n)
{
    vector<int> primos;
    if (n < 2) {
        return primos;
    }
    vector<char> esPrimo(static_cast<size_t>(n) + 1, 1);
    for (long long i = 2; i * i <= n; i++) {
        if (esPrimo[i]) {
            for (long long j = i * i; j <= n; j += i) {
                esPrimo[j] = 0;
            }
        }
    }
    for (int i = 2; i <= n; i++) {
        if (esPrimo[i]) {
            primos.push_back(i);
        }
    }
    return primos;
}

/**
 * Factorización por división de prueba.
 *
 * @complejidad Tiempo O(√n); espacio O(1) más la salida.
 * @explicacion Se divide por d = 2, 3, 4... mientras d² ≤ n. Cada vez que d divide a n se divide por él todo lo posible, así que los factores
 * compuestos (4, 6, 9...) nunca llegan a dividir porque sus primos ya se han extraído antes: los d que dividen son siempre primos. Cuando d² > n,
 * lo que queda de n (si es > 1) es primo, porque un compuesto tendría un factor ≤ √n. `d` es long long: con int, `d * d` desborda para n grandes.
 * @alternativas Para muchas consultas ≤ N conviene una criba del menor factor primo (O(N log log N) una vez, O(log n) por consulta). Para n de
 * 18 cifras hace falta Miller-Rabin + Pollard rho.
 */
vector<pair<long long, int>> factorizar(long long n)
{
    if (n <= 0) {
        throw invalid_argument("factorizar: n debe ser positivo");
    }
    vector<pair<long long, int>> factores;
    for (long long d = 2; d * d <= n; d++) {
        if (n % d == 0) {
            int exponente = 0;
            while (n % d == 0) {
                n /= d;
                exponente++;
            }
            factores.push_back({d, exponente});
        }
    }
    if (n > 1) {
        factores.push_back({n, 1});
    }
    return factores;
}

/**
 * nCr módulo 10⁹+7 con factoriales precalculados.
 *
 * @complejidad Construcción O(nMax + log p); cada `nCr` O(1); espacio O(nMax).
 * @explicacion C(n, r) = n! / (r!·(n-r)!) y en aritmética modular dividir es multiplicar por el inverso. Se guarda `fact[i]` = i! mod p y
 * `inv[i]` = (i!)⁻¹ mod p. Para no invertir cada factorial (O(log p) cada uno) se invierte solo el último, con Fermat (x^(p-2)), y se baja con
 * (i-1)!⁻¹ = (i!)⁻¹ · i. Cada producto se reduce de inmediato (`a * b % p`): dos restos de 30 bits caben en 60, tres no. Solo vale mientras
 * n < p: si n ≥ p, n! contiene el factor p y sería 0.
 * @alternativas El triángulo de Pascal es O(n²) pero sin inversos (sirve para módulos compuestos). Para una sola consulta con r pequeño, el producto
 * directo (n·(n-1)···(n-r+1)) / r! con un solo inverso. Para módulos pequeños y n grandes, el teorema de Lucas.
 * @bigo 1
 */
struct Combinatoria {
    static constexpr long long P = 1'000'000'007LL;
    int nMax;
    vector<long long> fact;
    vector<long long> inv;

    explicit Combinatoria(int nMax_) : nMax(nMax_)
    {
        if (nMax_ < 0) {
            throw invalid_argument("Combinatoria: nMax no puede ser negativo");
        }
        fact.assign(static_cast<size_t>(nMax_) + 1, 1);
        inv.assign(static_cast<size_t>(nMax_) + 1, 1);
        for (int i = 1; i <= nMax_; i++) {
            fact[i] = fact[i - 1] * i % P;
        }
        inv[nMax_] = potencia(fact[nMax_], P - 2);
        for (int i = nMax_; i >= 1; i--) {
            inv[i - 1] = inv[i] * i % P;
        }
    }

    long long nCr(int n, int r) const
    {
        if (n < 0 || n > nMax) {
            throw out_of_range("Combinatoria::nCr: n fuera de [0, nMax]");
        }
        if (r < 0 || r > n) {
            return 0;
        }
        return fact[n] * inv[r] % P * inv[n - r] % P;
    }

private:
    static long long potencia(long long base, long long e)
    {
        long long r = 1;
        base %= P;
        while (e > 0) {
            if (e & 1) {
                r = r * base % P;
            }
            base = base * base % P;
            e >>= 1;
        }
        return r;
    }
};
