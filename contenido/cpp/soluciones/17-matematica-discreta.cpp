#include <algorithm>
#include <cmath>
#include <numeric>
#include <optional>
#include <stdexcept>
#include <tuple>
#include <utility>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 17 · Matemática discreta para DSA
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 * Las versiones exactas usan __int128 para los productos y sumas intermedias que podrían desbordar un long long.
 */

/**
 * Euclides extendido iterativo: g = mcd(a, b) y a·x + b·y = g.
 *
 * @complejidad Tiempo O(log min(a, b)); espacio O(1).
 * @explicacion Se mantienen dos filas de restos (r0, r1) y dos de coeficientes (s0, s1) y (t0, t1) con el invariante rᵢ = a·sᵢ + b·tᵢ.
 * En cada vuelta q = r0 / r1 y (r0, r1) ← (r1, r0 - q·r1); lo mismo con s y t. El invariante se conserva porque restar q veces una
 * combinación lineal válida de otra sigue siendo una combinación lineal válida. Al llegar a r1 = 0, r0 = mcd y s0, t0 son los coeficientes
 * de Bézout. Los coeficientes se calculan en __int128: q·s1 puede acercarse a 10¹⁸ aunque el resultado final quepa.
 * @alternativas La versión recursiva de la lección 11 es más corta; la iterativa no gasta pila y deja explícito el invariante.
 * @bigo log
 */
tuple<long long, long long, long long> mcdExtendido(long long a, long long b)
{
    if (a < 0 || b < 0 || a > 1000000000000000000LL || b > 1000000000000000000LL) {
        throw invalid_argument("mcdExtendido: hacen falta 0 ≤ a, b ≤ 10¹⁸");
    }
    long long r0 = a;
    long long r1 = b;
    __int128 s0 = 1;
    __int128 s1 = 0;
    __int128 t0 = 0;
    __int128 t1 = 1;
    while (r1 != 0) {
        long long q = r0 / r1;
        long long r2 = r0 - q * r1;
        r0 = r1;
        r1 = r2;
        __int128 s2 = s0 - static_cast<__int128>(q) * s1;
        s0 = s1;
        s1 = s2;
        __int128 t2 = t0 - static_cast<__int128>(q) * t1;
        t0 = t1;
        t1 = t2;
    }
    return {r0, static_cast<long long>(s0), static_cast<long long>(t0)};
}

/**
 * Solución entera normalizada de a·x + b·y = c, o nullopt si no existe.
 *
 * @complejidad Tiempo O(log min(|a|, |b|)); espacio O(1).
 * @explicacion Si g = mcd(|a|, |b|) no divide a c, no hay solución: el lado izquierdo siempre es múltiplo de g. Si divide, Bézout da
 * |a|·x₀ + |b|·y₀ = g; se multiplica por c/g y se reajustan los signos de a y b. Todas las soluciones son (x + k·b/g, y - k·a/g), así que
 * se reduce x al intervalo [0, |b|/g) y se despeja y = (c - a·x)/b. El módulo se corrige con ((x % paso) + paso) % paso porque en C++ el
 * resto puede ser negativo. Los casos b = 0 y a = b = 0 se resuelven aparte (el intervalo normalizado no existe).
 * @alternativas Con `__int128` se evita el desbordamiento de x₀·(c/g); sin él habría que comprobar cada producto antes de multiplicar.
 */
optional<pair<long long, long long>> diofantica(long long a, long long b, long long c)
{
    constexpr long long LIMITE = 1000000000LL;
    if (a < -LIMITE || a > LIMITE || b < -LIMITE || b > LIMITE || c < -LIMITE || c > LIMITE) {
        throw invalid_argument("diofantica: hacen falta |a|, |b|, |c| ≤ 10⁹");
    }
    if (a == 0 && b == 0) {
        if (c == 0) {
            return pair<long long, long long>{0, 0};
        }
        return nullopt;
    }
    if (b == 0) {
        if (c % a != 0) {
            return nullopt;
        }
        return pair<long long, long long>{c / a, 0};
    }
    if (a == 0) {
        if (c % b != 0) {
            return nullopt;
        }
        return pair<long long, long long>{0, c / b};
    }

    long long absA = a < 0 ? -a : a;
    long long absB = b < 0 ? -b : b;
    auto [g, x0, y0] = mcdExtendido(absA, absB);
    if (c % g != 0) {
        return nullopt;
    }
    __int128 escala = c / g;
    __int128 x = static_cast<__int128>(a < 0 ? -x0 : x0) * escala;
    __int128 y = static_cast<__int128>(b < 0 ? -y0 : y0) * escala;
    long long paso = absB / g;
    __int128 reducida = ((x % paso) + paso) % paso;
    long long xFinal = static_cast<long long>(reducida);
    __int128 yFinal = (static_cast<__int128>(c) - static_cast<__int128>(a) * xFinal) / b;
    return pair<long long, long long>{xFinal, static_cast<long long>(yFinal)};
}

/**
 * Criba armónica de divisores: d[k] = número de divisores positivos de k.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @explicacion En vez de factorizar cada k, se invierte el bucle: para cada d se suma 1 a todos sus múltiplos d, 2d, 3d… ≤ n. Cuesta
 * n/d por cada d y Σ n/d = n·Hₙ ≈ n ln n. Es la misma forma que la criba de Eratóstenes, que solo aplica el bucle a los primos.
 * @alternativas Probar divisores hasta √k para cada k cuesta O(n√n); factorizar con una criba de primos también sirve, pero es más código.
 * @bigo nlogn
 */
vector<int> contarDivisores(int n)
{
    if (n < 0) {
        throw invalid_argument("contarDivisores: n no puede ser negativo");
    }
    vector<int> divisores(static_cast<size_t>(n) + 1, 0);
    for (int d = 1; d <= n; d++) {
        for (long long m = d; m <= n; m += d) {
            divisores[static_cast<size_t>(m)]++;
        }
    }
    return divisores;
}

/**
 * φ de Euler para todo k ≤ n mediante criba.
 *
 * @complejidad Tiempo O(n log log n) (≈ O(n)); espacio O(n).
 * @explicacion Se inicializa phi[k] = k. Al recorrer i = 2..n, si phi[i] sigue valiendo i es que ningún primo menor lo tocó: i es primo.
 * Para cada múltiplo m de i se hace phi[m] -= phi[m] / i, que equivale a multiplicar por (1 - 1/i) y es una división exacta. Cada primo
 * toca n/i múltiplos, y Σ n/p sobre los primos ≤ n es ≈ n ln ln n.
 * @alternativas φ(k) por factorización de cada k cuesta O(n√n); la identidad Σ_{d|k} φ(d) = k permite otra criba, pero esta es la directa.
 * @bigo n
 */
vector<int> phiHasta(int n)
{
    if (n < 0) {
        throw invalid_argument("phiHasta: n no puede ser negativo");
    }
    vector<int> phi(static_cast<size_t>(n) + 1);
    iota(phi.begin(), phi.end(), 0);
    for (int i = 2; i <= n; i++) {
        if (phi[static_cast<size_t>(i)] == i) {
            for (long long m = i; m <= n; m += i) {
                phi[static_cast<size_t>(m)] -= phi[static_cast<size_t>(m)] / i;
            }
        }
    }
    return phi;
}

/**
 * C(n, k) exacto con una sola fila del triángulo de Pascal.
 *
 * @complejidad Tiempo O(n·min(k, n-k)); espacio O(min(k, n-k)).
 * @explicacion C(n, k) = C(n-1, k-1) + C(n-1, k) con C(n, 0) = C(n, n) = 1. Se guarda solo la fila actual y se actualiza de derecha a
 * izquierda: al leer fila[j-1] todavía no se ha pisado con el valor de la fila nueva. Solo hay sumas, así que no desborda mientras el
 * resultado quepa; C(62, 31) es el mayor que cabe en 64 bits. Se usa la simetría k = min(k, n-k) para ahorrar memoria y trabajo.
 * @alternativas El producto Π (n-i)/(i+1) divide exacto en cada paso, pero el producto intermedio puede pasarse de 64 bits aunque el
 * resultado final quepa; haría falta __int128 o dividir por el mcd antes de multiplicar.
 */
unsigned long long binomialPascal(int n, int k)
{
    if (n < 0 || n > 62) {
        throw invalid_argument("binomialPascal: hace falta 0 ≤ n ≤ 62");
    }
    if (k < 0 || k > n) {
        return 0;
    }
    int kk = min(k, n - k);
    vector<unsigned long long> fila(static_cast<size_t>(kk) + 1, 0);
    fila[0] = 1;
    for (int i = 1; i <= n; i++) {
        for (int j = min(i, kk); j >= 1; j--) {
            fila[static_cast<size_t>(j)] += fila[static_cast<size_t>(j) - 1];
        }
    }
    return fila[static_cast<size_t>(kk)];
}

/**
 * Cuántos enteros de [1, n] son divisibles por al menos uno de los números dados.
 *
 * @complejidad Tiempo O(2ᵐ · m); espacio O(1).
 * @explicacion Se recorren las 2ᵐ - 1 máscaras no vacías. Los múltiplos comunes de un subconjunto S son los múltiplos de mcm(S), así que
 * aportan ⌊n / mcm(S)⌋ con signo (-1)^(|S|+1). El mcm se construye multiplicando por p/gcd(l, p); si antes de multiplicar se detecta
 * l/g > n/p, el mcm supera a n y el término vale 0, con lo que se evita el desbordamiento. Las sumas alternantes se acumulan en
 * __int128 porque pueden salirse de un long long aunque el resultado final sea ≤ n.
 * @alternativas Contar uno a uno cuesta O(n·m); la fórmula es exponencial en m pero con m ≤ 20 (≈ 10⁶ máscaras) es práctica.
 */
long long inclusionExclusion(long long n, const vector<long long>& primos)
{
    if (n < 0) {
        throw invalid_argument("inclusionExclusion: n no puede ser negativo");
    }
    if (primos.size() > 20) {
        throw invalid_argument("inclusionExclusion: como mucho 20 números");
    }
    for (long long p : primos) {
        if (p < 2) {
            throw invalid_argument("inclusionExclusion: cada número debe ser ≥ 2");
        }
    }
    int m = static_cast<int>(primos.size());
    __int128 total = 0;
    for (unsigned long long mascara = 1; mascara < (1ULL << m); mascara++) {
        long long lcm = 1;
        int bits = 0;
        bool aporta = true;
        for (int i = 0; i < m; i++) {
            if ((mascara & (1ULL << i)) == 0) {
                continue;
            }
            bits++;
            long long p = primos[static_cast<size_t>(i)];
            long long g = gcd(lcm, p);
            if (lcm / g > n / p) {          // el mcm se pasaría de n: ⌊n / mcm⌋ = 0
                aporta = false;
                break;
            }
            lcm = (lcm / g) * p;
        }
        if (!aporta) {
            continue;
        }
        __int128 termino = n / lcm;
        total += (bits % 2 == 1) ? termino : -termino;
    }
    return static_cast<long long>(total);
}

/**
 * Sorteos esperados para reunir los n cupones: n·Hₙ.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Con i cupones ya reunidos, cada sorteo acierta con probabilidad (n-i)/n, así que la espera media es n/(n-i) (geométrica).
 * Por linealidad de la esperanza, E[total] = Σ n/(n-i) = n·Hₙ. La suma se hace de i = n hacia 1, de los términos pequeños a los grandes,
 * para perder menos precisión; el producto final crece como n ln n.
 * @alternativas La simulación con semilla fija da el mismo valor con ruido de ±1 %, pero no es exacta ni determinista en el tiempo.
 * @bigo n
 */
double cuponesEsperados(int n)
{
    if (n < 0) {
        throw invalid_argument("cuponesEsperados: n no puede ser negativo");
    }
    double armonico = 0;
    for (int i = n; i >= 1; i--) {
        armonico += 1.0 / i;
    }
    return n * armonico;
}

/**
 * Probabilidad exacta de al menos una colisión al lanzar k claves en m cubos.
 *
 * @complejidad Tiempo O(k); espacio O(1).
 * @explicacion P(sin colisión) = Π (1 - i/m) para i = 0..k-1, y la probabilidad pedida es 1 menos eso. Con probabilidades diminutas,
 * 1 - (casi 1) pierde todas las cifras: con k = 1000 y m = 10¹⁸ el producto redondea a 1. Por eso se acumula en logaritmos,
 * S = Σ log1p(-i/m), y se devuelve -expm1(S) = -(eˢ - 1), que es preciso cerca de 0. Es el mismo cuidado que pide ML con
 * log-probabilidades (log-sum-exp).
 * @alternativas La aproximación 1 - e^(-k(k-1)/(2m)) explica la regla k ≈ √(2m ln 2), pero no es exacta para k grande.
 */
double probColision(long long k, long long m)
{
    if (k < 0 || m < 1) {
        throw invalid_argument("probColision: hacen falta k ≥ 0 y m ≥ 1");
    }
    if (k <= 1) {
        return 0.0;
    }
    if (k > m) {
        return 1.0;
    }
    double logSinColision = 0;
    for (long long i = 0; i < k; i++) {
        logSinColision += log1p(-static_cast<double>(i) / static_cast<double>(m));
    }
    return -expm1(logSinColision);
}
