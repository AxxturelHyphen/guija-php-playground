#include <algorithm>
#include <bit>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <optional>
#include <random>
#include <stdexcept>
#include <string>
#include <tuple>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 17 · MATEMÁTICA DISCRETA PARA DSA
 * ────────────────────────────────────────────────────────────────────────────
 * La matemática que aparece sin avisar cuando analizas un bucle, demuestras que un algoritmo es correcto o te enfrentas a un problema de
 * «Mathematics» de CSES: sumas y logaritmos, inducción, divisibilidad, contar sin enumerar y esperanza. En ML es el mismo lenguaje:
 * log-verosimilitudes, probabilidad de colisión en hashing, esperanza de una suma de indicadores.
 *
 *   Herramienta                           Para qué                                              Coste
 *   Σi = n(n+1)/2 · Σ2ⁱ = 2ᵏ⁺¹ - 1        sumar un bucle sin ejecutarlo                          O(1) frente a O(n)
 *   Hₙ = 1 + 1/2 + … + 1/n ≈ ln n         «para cada i, sus múltiplos» cuesta Σ n/i              O(n log n)
 *   Invariante de bucle (inducción)       demostrar que un bucle es correcto                     (es una demostración)
 *   Euclides, Fibonacci peor caso         mcd(a, b)                                              O(log min(a, b))
 *   Euclides extendido (Bézout)           a·x + b·y = mcd(a, b); inverso modular                 O(log min(a, b))
 *   Ecuación diofántica a·x + b·y = c     solución entera si y solo si mcd(a, b) | c             O(log min(a, b))
 *   Función φ de Euler                    cuántos k ≤ n son coprimos con n; exponentes mod n     O(n log log n) con criba
 *   Pascal / palomar / inclusión-exclusión contar sin enumerar                                   O(n·k) · O(1) · O(2ᵐ)
 *   Esperanza y linealidad                E[X + Y] = E[X] + E[Y] aunque X e Y dependan           O(n)
 *
 * IDEA QUE UNE EL TEMA: casi todo se reduce a «descomponer en piezas que sabes contar». Un bucle se descompone en sumas, un entero en
 * divisores, un conjunto en subconjuntos (inclusión-exclusión) y una variable aleatoria en indicadores (linealidad). Y cada algoritmo
 * se demuestra por INDUCCIÓN: caso base + «si vale para lo anterior, vale para esto».
 *
 * COMPLETA LA LECCIÓN 11: allí aparecieron el mcd extendido recursivo, la exponenciación modular, la criba y nCr mod p. Aquí
 * entendemos POR QUÉ funcionan (Bézout, φ, Hₙ) y damos las versiones exactas en 64 bits (sin módulo) que desbordan con facilidad.
 *
 * CÓMO SE TRABAJA: pulsa Ctrl+Enter para ejecutar el archivo; los ejercicios dicen «pendiente» hasta que sustituyes
 * `return pendiente();` por tu código. Ctrl+S guarda tu avance. El botón «Solución» compara tu código con la de
 * referencia (pruebas y medición del coste).
 */

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

/*
 * ┌─ Desde Java/PHP/Python ────────────────────────────────────────────────────────────────────────────────────────
 * │ Python: `math.gcd`, `math.comb` y `fractions.Fraction` resuelven en una línea (y los enteros no desbordan). Java: `BigInteger.gcd` y
 * │ `Math.floorMod`. En C++ el mcd es `std::gcd` / `std::lcm` (<numeric>, C++17) y un long long desborda (UB con signo): hay que
 * │ razonar sobre los rangos. Dos precauciones frecuentes: `a / b * c` puede ser exacto mientras que `a * c / b` desborda (reordena),
 * │ y `__int128` (extensión de GCC/Clang, no estándar) da 128 bits para los productos intermedios.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════════
// AYUDAS DE LA DEMOSTRACIÓN (no son ejercicios; las usan las pruebas como oráculo)
// ═══════════════════════════════════════════════════════════════════════════════

/** Suma 1 + 2 + … + n ejecutando el bucle. */
long long sumaPorBucle(int n)
{
    long long suma = 0;
    for (int i = 1; i <= n; i++) {
        suma += i;
    }
    return suma;
}

/** Pasos de «para cada i = 1..n, recorre sus múltiplos i, 2i, 3i… ≤ n»: la suma de ⌊n/i⌋. */
long long pasosMultiplos(int n)
{
    long long pasos = 0;
    for (int i = 1; i <= n; i++) {
        for (long long m = i; m <= n; m += i) {
            pasos++;
        }
    }
    return pasos;
}

/** Número armónico Hₙ = 1 + 1/2 + … + 1/n. Se suma de los términos pequeños a los grandes: pierde menos precisión. */
double armonico(int n)
{
    double h = 0;
    for (int i = n; i >= 1; i--) {
        h += 1.0 / i;
    }
    return h;
}

/** Cuántas veces se puede dividir n entre 2 (división entera) antes de llegar a 1: ⌊log₂ n⌋. */
int vecesQueSeDivide(unsigned long long n)
{
    int veces = 0;
    while (n > 1) {
        n /= 2;
        veces++;
    }
    return veces;
}

/** Multiplicación rusa de a·b ≥ 0 con el invariante de bucle comprobado en cada vuelta. Con `traza` imprime la tabla. */
long long multiplicacionRusa(long long a, long long b, bool traza)
{
    long long acumulado = 0;
    long long x = a;
    long long y = b;
    while (y > 0) {
        // INVARIANTE: acumulado + x·y == a·b   (se cumple ANTES de cada vuelta, también antes de la primera)
        if (acumulado + x * y != a * b) {
            throw logic_error("el invariante no se cumple");
        }
        if (traza) {
            cout << "  x = " << setw(4) << x << "   y = " << setw(3) << y << "   acumulado = " << setw(4) << acumulado << "   (acumulado + x·y = " << acumulado + x * y << ")\n";
        }
        if (y % 2 == 1) {
            acumulado += x;
            y -= 1;
        }
        x *= 2;
        y /= 2;
    }
    return acumulado;
}

/** Pasos del algoritmo de Euclides (cada paso es un «a % b»). */
int pasosEuclides(long long a, long long b)
{
    int pasos = 0;
    while (b != 0) {
        long long r = a % b;
        a = b;
        b = r;
        pasos++;
    }
    return pasos;
}

/** Fibonacci con F(1) = F(2) = 1, en un long long (hasta F(92)). */
long long fibonacci(int k)
{
    long long a = 0;
    long long b = 1;
    for (int i = 0; i < k; i++) {
        long long c = a + b;
        a = b;
        b = c;
    }
    return a;
}

/** aᵉ mod m por exponenciación rápida (m ≤ 3·10⁹ para que los productos quepan). */
long long elevarMod(long long a, long long e, long long m)
{
    long long r = 1 % m;
    a %= m;
    while (e > 0) {
        if (e & 1) {
            r = r * a % m;
        }
        a = a * a % m;
        e >>= 1;
    }
    return r;
}

/** φ(n) de UN número por factorización (O(√n)): φ(n) = n · Π (1 - 1/p) sobre los primos p | n. */
long long phiUno(long long n)
{
    long long resultado = n;
    for (long long p = 2; p * p <= n; p++) {
        if (n % p == 0) {
            while (n % p == 0) {
                n /= p;
            }
            resultado -= resultado / p;
        }
    }
    if (n > 1) {
        resultado -= resultado / n;
    }
    return resultado;
}

/**
 * ORÁCULO de `diofantica` por fuerza bruta: la x más pequeña ≥ 0 tal que b | (c - a·x), probando x = 0, 1, 2…, |b|-1 (la solución se repite cada |b|/g,
 * así que ahí está la primera). Con b = 0 hay que dividir a entre c. Solo para números pequeños.
 */
optional<pair<long long, long long>> diofanticaFuerzaBruta(long long a, long long b, long long c)
{
    if (b == 0) {
        if (a == 0) {
            return c == 0 ? optional<pair<long long, long long>>(pair<long long, long long>{0, 0}) : nullopt;
        }
        return c % a == 0 ? optional<pair<long long, long long>>(pair<long long, long long>{c / a, 0}) : nullopt;
    }
    for (long long x = 0; x < llabs(b); x++) {
        if ((c - a * x) % b == 0) {
            return pair<long long, long long>{x, (c - a * x) / b};
        }
    }
    return nullopt;
}

/** Triángulo de Pascal con `filas` filas: P[n][k] = C(n, k) = C(n-1, k-1) + C(n-1, k). Es una DP (lección 9) con caso base C(n, 0) = C(n, n) = 1. */
vector<vector<unsigned long long>> trianguloPascal(int filas)
{
    vector<vector<unsigned long long>> p;
    for (int n = 0; n < filas; n++) {
        p.push_back(vector<unsigned long long>(static_cast<size_t>(n) + 1, 1));
        for (int k = 1; k < n; k++) {
            p[static_cast<size_t>(n)][static_cast<size_t>(k)] = p[static_cast<size_t>(n) - 1][static_cast<size_t>(k) - 1] + p[static_cast<size_t>(n) - 1][static_cast<size_t>(k)];
        }
    }
    return p;
}

/**
 * PRINCIPIO DEL PALOMAR en una línea: en CUALQUIER array de n enteros hay un tramo consecutivo a[i..j-1] cuya suma es múltiplo de n. Devuelve (i, j).
 * Las n+1 sumas de prefijos (la vacía incluida) caen en solo n restos posibles, así que dos tienen el MISMO resto y su diferencia es la suma del tramo.
 */
pair<int, int> tramoDivisible(const vector<int>& a)
{
    int n = static_cast<int>(a.size());
    vector<int> primera(static_cast<size_t>(n), -1);
    primera[0] = 0;                                   // el prefijo vacío tiene suma 0 y resto 0
    long long suma = 0;
    for (int j = 1; j <= n; j++) {
        suma += a[static_cast<size_t>(j) - 1];
        size_t resto = static_cast<size_t>(((suma % n) + n) % n);
        if (primera[resto] != -1) {
            return {primera[resto], j};
        }
        primera[resto] = j;
    }
    return {-1, -1};                                  // inalcanzable: lo garantiza el palomar
}

/** Desórdenes Dₙ (permutaciones sin punto fijo): D₀ = 1, D₁ = 0, Dₙ = (n-1)(Dₙ₋₁ + Dₙ₋₂). Sale de inclusión-exclusión: Dₙ = n! Σ (-1)ᵏ/k!. Hasta n = 20. */
long long desordenes(int n)
{
    long long anterior = 1;
    long long actual = 0;
    if (n == 0) {
        return 1;
    }
    for (int i = 2; i <= n; i++) {
        long long siguiente = (i - 1) * (actual + anterior);
        anterior = actual;
        actual = siguiente;
    }
    return actual;
}

/** E[sorteos] para reunir los n cupones, por ETAPAS: con i ya reunidos, cada sorteo acierta con probabilidad (n-i)/n y la espera media es n/(n-i) (geométrica). Se suman por linealidad. */
double cuponesPorEtapas(int n)
{
    double total = 0;
    for (int i = 0; i < n; i++) {
        total += static_cast<double>(n) / (n - i);
    }
    return total;
}

/** SIMULACIÓN con semilla fija: media de sorteos hasta reunir los n cupones. `azar() % n` (y no una distribution) para que sea idéntico en cualquier compilador. */
double simularCupones(int n, int pruebas, unsigned semilla)
{
    mt19937 azar(semilla);
    long long total = 0;
    for (int p = 0; p < pruebas; p++) {
        vector<char> visto(static_cast<size_t>(n), 0);
        int distintos = 0;
        while (distintos < n) {
            size_t c = azar() % static_cast<unsigned>(n);
            total++;
            if (visto[c] == 0) {
                visto[c] = 1;
                distintos++;
            }
        }
    }
    return static_cast<double>(total) / pruebas;
}

/** Media de puntos fijos de una permutación aleatoria de n elementos (Fisher-Yates con semilla fija). Por linealidad vale EXACTAMENTE 1 para todo n ≥ 1. */
double puntosFijosMedios(int n, int pruebas, unsigned semilla)
{
    mt19937 azar(semilla);
    long long total = 0;
    vector<int> perm(static_cast<size_t>(n));
    for (int p = 0; p < pruebas; p++) {
        iota(perm.begin(), perm.end(), 0);
        for (int i = n - 1; i > 0; i--) {
            swap(perm[static_cast<size_t>(i)], perm[azar() % static_cast<unsigned>(i + 1)]);
        }
        for (int i = 0; i < n; i++) {
            total += perm[static_cast<size_t>(i)] == i ? 1 : 0;
        }
    }
    return static_cast<double>(total) / pruebas;
}

/** P(al menos una colisión) con el producto ingenuo 1 - Π(1 - i/m). Correcto para probabilidades «grandes»; con resultados diminutos (1 - casi 1) pierde todas las cifras. */
double colisionIngenua(int k, double m)
{
    double sinColision = 1;
    for (int i = 0; i < k; i++) {
        sinColision *= 1.0 - i / m;
    }
    return 1.0 - sinColision;
}

/** Aproximación de Taylor: 1 - e^(-k(k-1)/(2m)). Explica la regla «las colisiones llegan hacia k ≈ √m». */
double colisionAproximada(double k, double m)
{
    return 1.0 - exp(-k * (k - 1) / (2 * m));
}

/** Estima P(colisión) lanzando k claves en m cubos con semilla fija. */
double simularColision(int k, int m, int pruebas, unsigned semilla)
{
    mt19937 azar(semilla);
    int con = 0;
    for (int p = 0; p < pruebas; p++) {
        vector<char> ocupado(static_cast<size_t>(m), 0);
        bool colision = false;
        for (int i = 0; i < k && !colision; i++) {
            size_t c = azar() % static_cast<unsigned>(m);
            if (ocupado[c] != 0) {
                colision = true;
            }
            ocupado[c] = 1;
        }
        con += colision ? 1 : 0;
    }
    return static_cast<double>(con) / pruebas;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · mcdExtendido ───────────────────────────────────────────────
/**
 * Euclides EXTENDIDO: devuelve (g, x, y) con g = mcd(a, b) y a·x + b·y = g (identidad de Bézout). Dominio: 0 ≤ a, b ≤ 10¹⁸ (si no, invalid_argument).
 * mcd(0, 0) = 0 y devuelve (0, 0, 0)... o cualquier x, y: las pruebas solo exigen a·x + b·y = g. Las pruebas comprueban TRES cosas: que g es el mcd, que
 * a·x + b·y = g (con __int128, para no desbordar al comprobarlo) y que los coeficientes quedan acotados, |x| ≤ max(1, b/g) y |y| ≤ max(1, a/g): ahí está la
 * garantía de que la versión iterativa no desborda. NO hay una única pareja (x, y): (x + k·b/g, y - k·a/g) también vale, para todo k.
 * La lección 11 lo hizo RECURSIVO con parámetros por referencia. Aquí, ITERATIVO y con un invariante (sección 2): mantén dos filas de restos
 * (r0, r1) = (a, b) y dos de coeficientes (s0, s1) = (1, 0), (t0, t1) = (0, 1) tales que SIEMPRE rᵢ = a·sᵢ + b·tᵢ. Mientras r1 ≠ 0: q = r0 / r1 y pasa
 * (r0, r1) ← (r1, r0 - q·r1), y lo mismo con s y con t. Cuando r1 = 0, r0 = mcd y el invariante da r0 = a·s0 + b·t0. ¿Por qué se conserva? Porque restar q veces
 * una igualdad válida de otra igualdad válida da otra igualdad válida (es combinación lineal).
 * Coste: O(log min(a, b)) de tiempo, O(1) de espacio.
 */
tuple<long long, long long, long long> mcdExtendido(long long a, long long b)
{
    return pendiente();
}

// ── Ejercicio 2 · diofantica ─────────────────────────────────────────────────
/**
 * Resuelve a·x + b·y = c en ENTEROS. Devuelve (x, y) o nullopt si no hay solución. Dominio: |a|, |b|, |c| ≤ 10⁹ (si no, invalid_argument); a y b pueden ser
 * negativos o cero. Existe solución si y solo si g = mcd(|a|, |b|) divide a c: si a·x₀ + b·y₀ = g (Bézout), entonces x₀·(c/g), y₀·(c/g) lo resuelve; el
 * resto de soluciones son (x + k·b/g, y - k·a/g). Si no divide, no hay: el lado izquierdo es siempre múltiplo de g.
 * Para que la respuesta sea ÚNICA (y se pueda comprobar con `prueba`), devuelve la normalizada: con b ≠ 0, la x MÁS PEQUEÑA ≥ 0, es decir x ∈ [0, |b|/g); con b = 0
 * (y a ≠ 0), x = c / a y y = 0; con a = b = 0, (0, 0) si c = 0 y nullopt en otro caso.
 *   (6, 10, 14) → (4, -1) · (3, 6, 10) → nullopt · (2, 3, 7) → (2, 1) · (-4, 6, 2) → (1, 1) · (5, 0, 15) → (3, 0) · (0, 7, 21) → (0, 3)
 * Reutiliza `mcdExtendido`; ojo con los signos (extiende con |a|, |b| y reajusta el signo de x e y) y con el desbordamiento: x₀·(c/g) llega a 10¹⁸, cabe en un long long.
 * Reduce x al intervalo con `((x % paso) + paso) % paso`, donde paso = |b|/g (el resto con signo de C++ puede ser negativo) y calcula y = (c - a·x) / b.
 * Coste: O(log min(|a|, |b|)).
 */
optional<pair<long long, long long>> diofantica(long long a, long long b, long long c)
{
    // pendiente() lanza antes de devolver; `, nullopt` solo fija el tipo de retorno (la conversión directa a optional es ambigua).
    return pendiente(), nullopt;
}

// ── Ejercicio 3 · contarDivisores ────────────────────────────────────────────
/**
 * Devuelve un vector de tamaño n + 1 con d[k] = número de divisores positivos de k para todo 1 ≤ k ≤ n (d[0] = 0). n < 0 → invalid_argument.
 * n = 10 → {0, 1, 2, 2, 3, 2, 4, 2, 4, 3, 4}.
 * CRIBA ARMÓNICA: en vez de probar a dividir cada k entre todos los números (O(n²), o O(n√n) hasta √k), invierte el bucle: «para cada d, suma 1 a
 * todos SUS MÚLTIPLOS» d, 2d, 3d… ≤ n. Cuesta n/d por cada d, y Σ n/d = n·Hₙ ≈ n ln n (sección 1): O(n log n). La misma forma sirve para la suma de
 * divisores o para marcar compuestos (la criba de Eratóstenes es esto mismo, solo para los primos d).
 * Dato: d(k) es impar si y solo si k es un cuadrado perfecto (los divisores se emparejan d ↔ k/d y solo en √k se «auto-emparejan»); las pruebas lo comprueban.
 * Coste: O(n log n) de tiempo y O(n) de espacio.
 */
vector<int> contarDivisores(int n)
{
    return pendiente();
}

// ── Ejercicio 4 · phiHasta ───────────────────────────────────────────────────
/**
 * Devuelve un vector de tamaño n + 1 con φ(k) (la función de Euler: cuántos 1 ≤ j ≤ k cumplen mcd(j, k) = 1) para todo k ≤ n, con φ(0) = 0. n < 0 → invalid_argument.
 * n = 10 → {0, 1, 1, 2, 2, 4, 2, 6, 4, 6, 4}. Para un primo, φ(p) = p - 1; para una potencia, φ(pᵉ) = pᵉ - pᵉ⁻¹; y es MULTIPLICATIVA: φ(a·b) = φ(a)·φ(b) si mcd(a, b) = 1.
 * Una sola fórmula lo resume: φ(n) = n · Π (1 - 1/p) sobre los primos p que dividen a n. Eso es inclusión-exclusión sobre «los j divisibles por algún primo de n» (ejercicio 6).
 * CRIBA: empieza con phi[k] = k. Recorre i = 2..n: si phi[i] sigue valiendo i, i es PRIMO (nadie lo ha tocado todavía) y para cada múltiplo m de i haces
 * `phi[m] -= phi[m] / i` (equivale a multiplicar por (1 - 1/i), y la división es exacta). Cada primo toca n/p múltiplos: Σ n/p ≈ n ln ln n.
 * Por qué importa: el teorema de Euler dice aᵠ⁽ⁿ⁾ ≡ 1 (mod n) si mcd(a, n) = 1; de ahí el inverso a⁻¹ = aᵠ⁽ⁿ⁾⁻¹ y que los exponentes grandes se reduzcan mod φ(n).
 * Coste: O(n log log n) de tiempo (casi lineal) y O(n) de espacio.
 */
vector<int> phiHasta(int n)
{
    return pendiente();
}

// ── Ejercicio 5 · binomialPascal ─────────────────────────────────────────────
/**
 * C(n, k) EXACTO (sin módulo) en unsigned long long, con 0 ≤ n ≤ 62. n fuera de [0, 62] → invalid_argument; k < 0 o k > n → 0.
 * C(5, 2) = 10 · C(10, 5) = 252 · C(30, 15) = 155 117 520 · C(62, 31) = 465 428 353 255 261 088 (el mayor: cabe, con holgura, en 64 bits).
 * Dos caminos. (a) PASCAL: C(n, k) = C(n-1, k-1) + C(n-1, k) con C(n, 0) = C(n, n) = 1; guarda solo UNA fila (vector de k+1 casillas, actualizada de derecha a
 * izquierda para no pisar lo que aún hace falta): O(n·k) de tiempo y O(k) de espacio, y SOLO sumas: no desborda nunca mientras el resultado quepa.
 * (b) MULTIPLICATIVO: C(n, k) = Π (n-i)/(i+1), i = 0..k-1, dividiendo en cada paso: tras el paso i el valor es C(n, i+1), un entero, así que la
 * división es exacta; pero el PRODUCTO `valor · (n-i)` antes de dividir puede pasarse de 64 bits aunque el resultado final quepa (mira la demostración de la sección 4).
 * Usa k = min(k, n-k) por simetría. Hay que elegir bien el camino; con las sumas de Pascal no existe ese riesgo.
 * Coste: O(n·k) con Pascal; O(k) multiplicaciones con el camino multiplicativo.
 */
unsigned long long binomialPascal(int n, int k)
{
    return pendiente();
}

// ── Ejercicio 6 · inclusionExclusion ─────────────────────────────────────────
/**
 * Cuántos enteros de [1, n] son divisibles por AL MENOS UNO de los números dados. n ≥ 0 (si no, invalid_argument) y hasta 20 números, todos ≥ 2 (si no,
 * invalid_argument); lista vacía → 0. Aunque se llame «primos», sirve cualquier número ≥ 2: la fórmula usa el MÍNIMO COMÚN MÚLTIPLO de cada subconjunto.
 *   (100, {2, 3, 5}) → 74 · (100, {2, 3}) → 67 · (10¹⁸, {2}) → 5·10¹⁷ · (100, {4, 6}) → 33 (mcm(4, 6) = 12) · (1000, {6, 10, 15}) → 266
 * INCLUSIÓN-EXCLUSIÓN: |A₁ ∪ … ∪ Aₘ| = Σ|Aᵢ| - Σ|Aᵢ ∩ Aⱼ| + Σ|Aᵢ ∩ Aⱼ ∩ Aₖ| - …, y los multiplos de todos los de un subconjunto S son exactamente los
 * múltiplos de mcm(S): ⌊n / mcm(S)⌋. Cada subconjunto no vacío entra con signo (-1)^(|S|+1). Recorre las 2ᵐ - 1 MÁSCARAS de bits: el bit i de la máscara dice si
 * el elemento i está en S (lección 11).
 * Tres trampas de desbordamiento: (1) el mcm puede pasarse de 64 bits (con 15 primos pequeños ya sale 6·10¹⁷, y con 20 sobrepasa 10¹⁸): en cuanto un mcm parcial
 * supere n, ⌊n / mcm⌋ = 0 y el subconjunto no aporta nada. Detecta el exceso con `l / gcd(l, p) > n / p` ANTES de multiplicar. (2) Las SUMAS PARCIALES
 * con signo alternante pueden salirse de un long long aunque el resultado final sea ≤ n: acumula en `__int128`. (3) n llega a 10¹⁸.
 * Coste: O(2ᵐ · m) de tiempo y O(1) de espacio.
 */
long long inclusionExclusion(long long n, const vector<long long>& primos)
{
    return pendiente();
}

// ── Ejercicio 7 · cuponesEsperados ───────────────────────────────────────────
/**
 * Problema del COLECCIONISTA DE CUPONES: hay n cupones distintos y cada sorteo da uno al azar (uniforme e independiente). Devuelve el número ESPERADO de sorteos
 * hasta reunirlos todos: n · Hₙ = n · (1 + 1/2 + … + 1/n). n = 0 → 0; n < 0 → invalid_argument.
 * n = 1 → 1 · n = 2 → 3 · n = 3 → 5,5 · n = 4 → 25/3 = 8,333… · n = 10 → 29,2896… · n = 100 → 518,7377… · n = 10⁶ → 14 392 726,72…
 * Derivación (la demostración de la sección 5 la hace paso a paso): con i cupones ya reunidos, cada sorteo acierta con probabilidad (n-i)/n, así que se espera n/(n-i)
 * sorteos más (distribución geométrica). Por LINEALIDAD DE LA ESPERANZA E[total] = Σ n/(n-i) = n·Hₙ; no hace falta que las etapas sean independientes (aquí lo son, pero
 * la linealidad no lo pide). Crece como n ln n: reunir 100 cupones cuesta ~519 sorteos, no 100.
 * Suma de i = n hasta 1 (de lo pequeño a lo grande) y devuelve el producto: así se pierde menos precisión con n grande. Las pruebas toleran 10⁻⁹ de error relativo.
 * Coste: O(n) de tiempo y O(1) de espacio.
 */
double cuponesEsperados(int n)
{
    return pendiente();
}

// ── Ejercicio 8 · probColision ───────────────────────────────────────────────
/**
 * Probabilidad EXACTA de que k claves lanzadas al azar (uniformes, independientes) a m cubos produzcan AL MENOS UNA colisión (dos en el mismo cubo): la paradoja del
 * cumpleaños con m = 365. k < 0 o m < 1 → invalid_argument; k ≤ 1 → 0; k > m → 1 (palomar).
 *   (23, 365) → 0,5073 · (2, 365) → 1/365 · (4, 4) → 1 - 4!/4⁴ = 0,90625 · (5, 5) → 0,9616
 * P(sin colisión) = Π (1 - i/m) para i = 0..k-1 (la clave i evita los i cubos ya ocupados), y P(colisión) = 1 - eso. La trampa es NUMÉRICA: con probabilidades
 * diminutas, 1 - (casi 1) pierde todas las cifras (con k = 1000 y m = 10¹⁸ el producto sale EXACTAMENTE 1 y devuelve 0 en vez de 5·10⁻¹³). Calcula con
 * logaritmos: S = Σ log1p(-i/m) y devuelve -expm1(S) (`log1p(x)` = log(1+x) y `expm1(x)` = eˣ - 1, precisas cerca de 0). Es el mismo cuidado que pide ML con
 * log-probabilidades (log-sum-exp). Las pruebas incluyen ese caso: exigen error relativo < 10⁻⁶ frente a k(k-1)/(2m).
 * Consecuencia para hashing: con m cubos, la primera colisión se espera hacia k ≈ √(2m ln 2) (con m = 2³² son ~77 163 claves, no 2³²).
 * Coste: O(k) de tiempo y O(1) de espacio.
 */
double probColision(long long k, long long m)
{
    return pendiente();
}

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. SUMATORIOS Y LOGARITMOS: LO QUE SALE AL ANALIZAR UN BUCLE
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1a. Fórmula cerrada frente a bucle: Σi = n(n+1)/2");

    for (int n : {10, 1000, 100000}) {
        long long cerrada = static_cast<long long>(n) * (n + 1) / 2;
        cout << "n = " << n << ": bucle = " << sumaPorBucle(n) << ", fórmula = " << cerrada << "\n";
    }
    // Demostración por «Gauss»: suma la lista y su inversa, n parejas que suman n+1 cada una → 2·Σ = n(n+1). Dos bucles anidados «j < i» cuestan entonces
    // n(n-1)/2 vueltas: Θ(n²), no «la mitad de nada». OJO: n·(n+1) con int se desborda a partir de n ≈ 46 340; con long long aguanta hasta ≈ 3·10⁹.
    // Σ 2ⁱ (i = 0..k) = 2ᵏ⁺¹ - 1: una serie GEOMÉTRICA está dominada por su último término. Por eso un vector que dobla copia menos de 2n (lección 16).

    titulo("1b. El bucle «para cada i, sus múltiplos» es O(n log n): suma de ⌊n/i⌋ ≈ n·ln n");

    cout << "         n          pasos     n·Hₙ     pasos / (n·ln n)\n";
    for (int n : {10, 100, 1000, 100000, 1000000}) {
        long long pasos = pasosMultiplos(n);
        cout << setw(10) << n << setw(15) << pasos << setw(14) << fixed << setprecision(0) << n * armonico(n) << setw(14) << setprecision(3) << pasos / (n * log(static_cast<double>(n)))
             << defaultfloat << "\n";
    }
    cout << "H(10) = " << armonico(10) << ",  ln 10 + γ = " << log(10.0) + 0.5772156649 << ";  H(10⁶) = " << armonico(1000000) << ",  ln 10⁶ + γ = " << log(1e6) + 0.5772156649 << "\n";
    // Hₙ = ln n + γ + 1/(2n) - …, con γ ≈ 0,5772 (Euler-Mascheroni). Para el análisis basta Hₙ = Θ(log n), que sale de comparar la suma con la integral de 1/x:
    //   ln(n+1) ≤ Hₙ ≤ 1 + ln n. El cociente pasos/(n ln n) tiende a 1 (muy despacio: la parte «+ 0,15·n» pesa mucho tiempo).
    // Este bucle está en la criba de Eratóstenes, en «contar divisores de todos los k ≤ n» y en la recurrencia de la suma armónica de CSES: aprende a reconocerlo.

    titulo("1c. log₂ n = cuántas veces puedo dividir entre 2");

    for (unsigned long long n : {1ULL, 2ULL, 1000ULL, 1000000ULL, 1ULL << 40, 18446744073709551615ULL}) {
        cout << "n = " << n << ": divisiones hasta llegar a 1 = " << vecesQueSeDivide(n) << ", bit_width(n) - 1 = " << bit_width(n) - 1 << ", log₂ n = " << log2(static_cast<double>(n)) << "\n";
    }
    // ⌊log₂ n⌋ es también «cuántos bits tiene n, menos 1». Bucles del tipo `for (i = 1; i < n; i *= 2)` o `while (n > 1) n /= 2` son O(log n): búsqueda binaria,
    // Euclides, exponenciación rápida, alturas de árboles equilibrados. La base da igual en O(): log₁₀ n = log₂ n / log₂ 10, una constante.

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INDUCCIÓN: LA PLANTILLA PARA DEMOSTRAR QUE UN BUCLE ES CORRECTO
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. Invariante de bucle: multiplicación rusa de 13 · 11");

    cout << "13 · 11 = " << multiplicacionRusa(13, 11, true) << "\n";
    // INDUCCIÓN: para probar P(n) para todo n ≥ 1: (BASE) P(1); (PASO) si vale P(n), entonces vale P(n+1). Ejemplo: 1 + … + n = n(n+1)/2.
    //   Base: n = 1 → 1 = 1·2/2. Paso: 1 + … + n + (n+1) = n(n+1)/2 + (n+1) = (n+1)(n+2)/2. ∎
    // Un INVARIANTE de bucle es la misma idea con «vuelta del bucle» en lugar de n. Se demuestran tres cosas:
    //   (1) INICIALIZACIÓN: se cumple antes de la primera vuelta (acumulado = 0, x·y = a·b: 0 + a·b = a·b).
    //   (2) CONSERVACIÓN: si se cumple antes de una vuelta, se cumple después. Si y es impar: (acumulado + x) + x·(y-1) = acumulado + x·y. Luego (2x)·(y/2) = x·y para y par. ✓
    //   (3) TERMINACIÓN: y baja en cada vuelta (y/2 < y para y > 0), así que llega a 0; entonces acumulado + x·0 = a·b, es decir, acumulado = a·b. ∎
    // Si el invariante «no sirve», el algoritmo está mal o aún no lo has entendido. Con él se demuestran la búsqueda binaria (la respuesta sigue dentro de [lo, hi)),
    // las particiones de quicksort, Dijkstra (las distancias finales ya son óptimas) y casi cualquier algoritmo voraz.

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DIVISIBILIDAD: EUCLIDES, BÉZOUT, DIOFÁNTICAS Y φ
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3a. Euclides es O(log): el peor caso son los números de Fibonacci consecutivos");

    cout << "   k     F(k+1)           F(k)          pasos    pasos / log₂ F(k)\n";
    for (int k : {5, 10, 20, 40, 60, 80}) {
        long long a = fibonacci(k + 1);
        long long b = fibonacci(k);
        cout << setw(4) << k << setw(18) << a << setw(15) << b << setw(8) << pasosEuclides(a, b) << setw(14) << fixed << setprecision(2) << pasosEuclides(a, b) / log2(static_cast<double>(b)) << defaultfloat
             << "\n";
    }
    cout << "pasos con mcd(10¹⁸, 10¹⁸ - 1) = " << pasosEuclides(1000000000000000000LL, 999999999999999999LL) << ", con (10¹⁸, 2·10⁹ + 1) = " << pasosEuclides(1000000000000000000LL, 2000000001LL) << "\n";
    // Por qué O(log): tras UN paso (a, b) → (b, a mod b) y se cumple a mod b < b y a mod b ≤ a - b, luego a mod b ≤ a/2. En DOS pasos el mayor de los números se reduce al
    // menos a la mitad: como mucho 2·log₂(min) pasos. El PEOR caso es cuando el cociente de cada división es 1 (el mínimo posible): a = F(k+1), b = F(k) da exactamente
    // k - 1 pasos (teorema de Lamé) y F(k) ≈ φᵏ/√5 con φ = 1,618…: pasos ≈ log_φ b = 1,44·log₂ b. Ningún otro par necesita tantos pasos.

    titulo("3b. Bézout y ecuaciones diofánticas: 6x + 10y = 14");

    auto solucion = diofanticaFuerzaBruta(6, 10, 14);
    cout << "mcd(6, 10) = " << gcd(6, 10) << " divide a 14 → hay solución; la menor con x ≥ 0 es x = " << solucion->first << ", y = " << solucion->second << "\n";
    cout << "familia (x + k·b/g, y - k·a/g) = (" << solucion->first << " + 5k, " << solucion->second << " - 3k):";
    for (int k = -1; k <= 2; k++) {
        long long x = solucion->first + 5 * k;
        long long y = solucion->second - 3 * k;
        cout << "  k=" << k << " → (" << x << ", " << y << ") 6x+10y=" << 6 * x + 10 * y;
    }
    cout << "\n";
    cout << "3x + 6y = 10: " << (diofanticaFuerzaBruta(3, 6, 10) ? "tiene solución" : "NO tiene solución (3 no divide a 10: el lado izquierdo siempre es múltiplo de 3)") << "\n";
    cout << "7x - 3y = 1: " << diofanticaFuerzaBruta(7, -3, 1)->first << ", " << diofanticaFuerzaBruta(7, -3, 1)->second << "\n";
    // TEOREMA: a·x + b·y = c tiene solución entera ⇔ mcd(a, b) | c. (⇒) el lado izquierdo es múltiplo de g. (⇐) Bézout da a·x₀ + b·y₀ = g; multiplica por c/g.
    // Aplicaciones: inverso modular (c = 1 con b = m, lección 11), «¿se puede pagar N con monedas de a y b?» (con x, y ≥ 0, hace falta además mover k), relojes y jarras (3 y 5 litros → 1).

    titulo("3c. La función φ de Euler");

    cout << "n:    ";
    for (int n = 1; n <= 12; n++) {
        cout << setw(3) << n;
    }
    cout << "\nφ(n): ";
    for (int n = 1; n <= 12; n++) {
        cout << setw(3) << phiUno(n);
    }
    cout << "\n";
    long long sumaDivisores = 0;
    for (int d = 1; d <= 36; d++) {
        if (36 % d == 0) {
            sumaDivisores += phiUno(d);
        }
    }
    cout << "Σ φ(d) sobre los divisores de 36 = " << sumaDivisores << " (siempre vale n)\n";
    cout << "teorema de Euler: 7^φ(20) mod 20 = 7^" << phiUno(20) << " mod 20 = " << elevarMod(7, phiUno(20), 20) << "   |   3^φ(100) mod 100 = " << elevarMod(3, phiUno(100), 100) << "   |   2^φ(100) mod 100 = " << elevarMod(2, phiUno(100), 100)
         << " (mcd ≠ 1: no hay garantía)\n";
    // Identidad Σ_{d|n} φ(d) = n: las n fracciones j/n (j = 1..n) se reducen a una fracción irreducible con denominador d | n, y hay φ(d) de ellas por denominador.
    // Euler: si mcd(a, n) = 1, aᵠ⁽ⁿ⁾ ≡ 1 (mod n); con n primo es el pequeño teorema de Fermat (φ(p) = p - 1). Útil para reducir exponentes enormes: aᴱ mod n = a^(E mod φ(n)) mod n.

// ═══════════════════════════════════════════════════════════════════════════════
// 4. COMBINATORIA: CONTAR SIN ENUMERAR
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("4a. Triángulo de Pascal: C(n, k) = C(n-1, k-1) + C(n-1, k)");

    auto pascal = trianguloPascal(9);
    for (const auto& fila : pascal) {
        cout << string(static_cast<size_t>(9 - fila.size()) * 2, ' ');
        unsigned long long sumaFila = 0;
        for (unsigned long long v : fila) {
            cout << setw(4) << v;
            sumaFila += v;
        }
        cout << "   suma = " << sumaFila << "\n";
    }
    // C(n, k) cuenta los subconjuntos de k elementos de n: o contienen al último (C(n-1, k-1) maneras de escoger los demás) o no (C(n-1, k)). Es una DP con una tabla n × k (lección 9).
    // La suma de una fila vale 2ⁿ (subconjuntos de todos los tamaños); los valores de cada fila son simétricos C(n, k) = C(n, n-k).

    titulo("4b. Palomar: siempre hay un tramo cuya suma es múltiplo de n");

    vector<int> datos = {3, 9, 5, 7, 2, 4, 11};
    auto [desde, hasta] = tramoDivisible(datos);
    long long sumaTramo = 0;
    for (int i = desde; i < hasta; i++) {
        sumaTramo += datos[static_cast<size_t>(i)];
    }
    cout << "n = " << datos.size() << ": el tramo [" << desde << ", " << hasta << ") suma " << sumaTramo << " = " << sumaTramo / static_cast<long long>(datos.size()) << " · " << datos.size() << "\n";
    // PALOMAR: si metes más de n objetos en n cajas, alguna caja tiene dos. Aquí, las n+1 sumas de prefijos (la vacía incluida) y los n restos mod n. No hace falta buscar con O(n²) tramos:
    // se encuentra en O(n) guardando el primer prefijo de cada resto. Es el truco de «número de subarrays con suma divisible por k» de CSES.

    titulo("4c. Inclusión-exclusión: múltiplos de 2, 3 o 5 hasta 100");

    long long a2 = 100 / 2;
    long long a3 = 100 / 3;
    long long a5 = 100 / 5;
    long long a23 = 100 / 6;
    long long a25 = 100 / 10;
    long long a35 = 100 / 15;
    long long a235 = 100 / 30;
    long long conFormula = a2 + a3 + a5 - a23 - a25 - a35 + a235;
    int conBucle = 0;
    for (int i = 1; i <= 100; i++) {
        conBucle += (i % 2 == 0 || i % 3 == 0 || i % 5 == 0) ? 1 : 0;
    }
    cout << a2 << " + " << a3 << " + " << a5 << " - " << a23 << " - " << a25 << " - " << a35 << " + " << a235 << " = " << conFormula << ";  contando uno a uno: " << conBucle << "\n";
    // Si sumas |A₂| + |A₃| + |A₅| cuentas DOS veces los múltiplos de 6, 10 y 15, y TRES veces los de 30; restando las parejas quitas demasiado a los de 30 (los tres múltiplos quedan en 0),
    // y los repones sumando la tripleta. Con m conjuntos son 2ᵐ - 1 términos y, cuando m es pequeño, es la solución más sencilla. φ(n) sale igual: Π(1 - 1/p) desarrollado.

    titulo("4d. Desórdenes (nadie en su sitio): Dₙ/n! → 1/e");

    for (int n : {1, 2, 3, 4, 5, 10, 20}) {
        double factorial = 1;
        for (int i = 2; i <= n; i++) {
            factorial *= i;
        }
        cout << "D(" << n << ") = " << desordenes(n) << ",  D/n! = " << desordenes(n) / factorial << "\n";
    }
    cout << "1/e = " << exp(-1.0) << "\n";
    // Inclusión-exclusión sobre «la persona i recibe su propio sombrero»: Dₙ = Σ (-1)ᵏ C(n,k)(n-k)! = n! Σ (-1)ᵏ/k!, la serie de e⁻¹. La probabilidad de que NADIE acierte converge
    // enseguida a 0,3679 (con n = 7 ya coincide hasta cuatro decimales) y casi no depende de n.

    titulo("4e. Desbordamiento: factoriales y productos intermedios");

    unsigned long long factorial = 1;
    int nMax = 1;
    for (;;) {
        unsigned long long siguiente = 0;
        if (__builtin_mul_overflow(factorial, static_cast<unsigned long long>(nMax + 1), &siguiente)) {
            break;
        }
        factorial = siguiente;
        nMax++;
    }
    cout << "el mayor n con n! en unsigned long long es " << nMax << " (" << factorial << "); 21! ya no cabe: " << static_cast<double>(factorial) * 21 << " > 1,8·10¹⁹\n";
    cout << "C(62, 31) = " << trianguloPascal(63)[62][31] << " cabe, ¿y los productos intermedios del método multiplicativo?\n";
    {
        __int128 valor = 1;
        __int128 maximo = 0;
        int n = 62;
        int k = 31;
        for (int i = 0; i < k; i++) {
            __int128 producto = valor * (n - i);
            maximo = max(maximo, producto);
            valor = producto / (i + 1);
        }
        cout << "mayor producto valor·(n-i) = " << static_cast<double>(maximo) << " frente a 2⁶³ = " << 9223372036854775808.0 << " (long long) y 2⁶⁴ = " << 18446744073709551616.0 << " (unsigned)\n";
    }
    // 20! ≈ 2,4·10¹⁸ es lo máximo; por eso nCr con factoriales EXACTOS solo vale hasta n = 20. Pascal (solo sumas) llega hasta C(62, 31) sin trampas. El método multiplicativo
    // exige dividir por el mcd antes de multiplicar, o `__int128`. Con módulo (lección 11) el problema desaparece, pero solo si el módulo es primo y mayor que n.

// ═══════════════════════════════════════════════════════════════════════════════
// 5. PROBABILIDAD DISCRETA: ESPERANZA Y LINEALIDAD
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("5a. Linealidad: puntos fijos de una permutación aleatoria");

    for (int n : {1, 5, 50, 500}) {
        cout << "n = " << setw(3) << n << ": media simulada (4000 permutaciones, semilla fija) = " << fixed << setprecision(3) << puntosFijosMedios(n, 4000, 7) << defaultfloat << "   (esperanza exacta: 1)\n";
    }
    // X = Σ Xᵢ con Xᵢ = 1 si la posición i es un punto fijo (probabilidad 1/n): E[X] = Σ E[Xᵢ] = n · (1/n) = 1, para CUALQUIER n y aunque los Xᵢ sean dependientes. LINEALIDAD: E[X + Y] = E[X] + E[Y]
    // sin condiciones. Es la herramienta más rentable de la probabilidad: casi siempre se trata de escribir lo que cuentas como suma de INDICADORES.

    titulo("5b. Coleccionista de cupones: n·Hₙ");

    cout << "     n    por etapas (n·Hₙ)    simulación (semilla 1)\n";
    for (int n : {1, 2, 6, 20, 50}) {
        cout << setw(6) << n << setw(15) << fixed << setprecision(3) << cuponesPorEtapas(n) << setw(20) << simularCupones(n, 4000, 1) << defaultfloat << "\n";
    }
    cout << "n·Hₙ con n = 50: " << 50 * armonico(50) << "  ·  con n = 1000: " << 1000 * armonico(1000) << "  (≈ n ln n + γn)\n";
    // La etapa i es una variable GEOMÉTRICA de parámetro (n-i)/n, con esperanza n/(n-i). La suma de esperanzas es la esperanza de la suma (linealidad): n/n + n/(n-1) + … + n/1 = n·Hₙ ≈ n ln n.
    // La última etapa (el cupón que falta) sola cuesta n sorteos en media: casi todo el tiempo se va en conseguir los últimos. La simulación coincide con el cálculo exacto, con ruido de ±1 %.

    titulo("5c. Colisiones en hashing: paradoja del cumpleaños");

    cout << "m = 365:    k    P exacta    aprox 1 - e^(-k(k-1)/2m)    simulación (20000, semilla 3)\n";
    for (int k : {5, 10, 23, 30, 50, 70}) {
        cout << setw(18) << k << setw(12) << fixed << setprecision(4) << colisionIngenua(k, 365) << setw(18) << colisionAproximada(k, 365) << setw(25) << simularColision(k, 365, 20000, 3) << defaultfloat << "\n";
    }
    cout << "m = 2³²: P(colisión) con k = 77163 claves = " << fixed << setprecision(4) << colisionIngenua(77163, 4294967296.0) << defaultfloat << "   (k = √(2m·ln 2) = " << sqrt(2 * 4294967296.0 * log(2.0)) << ")\n";
    cout << "pares en colisión esperados con k = 23 y m = 365: C(23,2)/365 = " << 23 * 22 / 2 / 365.0 << " (linealidad: un indicador por pareja)\n";
    cout << "k = 1000, m = 10¹⁸: producto ingenuo → " << colisionIngenua(1000, 1e18) << ", valor real ≈ k(k-1)/(2m) = " << 1000.0 * 999 / 2e18 << "\n";
    // Con k personas hay C(k, 2) parejas, cada una coincide con probabilidad 1/m: esperanza ≈ k²/2m. Pasa de 1 hacia k ≈ √(2m): la colisión llega MUCHÍSIMO antes que «m/2 claves». Por eso hace falta una
    // tabla hash con encadenamiento (lección 15) y por eso un hash de 64 bits solo es «seguro» hasta ~10⁹ elementos. Ojo con la última línea: con probabilidades diminutas, 1 - producto pierde toda la precisión (ejercicio 8).

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    using Sol = optional<pair<long long, long long>>;
    auto bezoutOk = [](long long a, long long b) -> string {
        auto [g, x, y] = mcdExtendido(a, b);
        if (g != gcd(a, b)) {
            return "g = " + to_string(g) + " no es el mcd(" + to_string(a) + ", " + to_string(b) + ")";
        }
        __int128 lado = static_cast<__int128>(a) * x + static_cast<__int128>(b) * y;
        if (lado != g) {
            return "a·x + b·y no vale g con (" + to_string(a) + ", " + to_string(b) + ")";
        }
        if (llabs(x) > max(1LL, g == 0 ? 1LL : b / g) || llabs(y) > max(1LL, g == 0 ? 1LL : a / g)) {
            return "coeficientes demasiado grandes con (" + to_string(a) + ", " + to_string(b) + ")";
        }
        return "ok";
    };

    grupo("mcdExtendido");
    comprueba("mcd(240, 46) = 2 y 240·x + 46·y = 2", [&] { return bezoutOk(240, 46); }, string("ok"));
    comprueba("el mcd de coprimos es 1", [&] { return get<0>(mcdExtendido(17, 5)); }, 1LL);
    comprueba("mcd(0, 7) = 7", [&] { return bezoutOk(0, 7); }, string("ok"));
    comprueba("mcd(7, 0) = 7", [&] { return bezoutOk(7, 0); }, string("ok"));
    comprueba("mcd(0, 0) = 0", [&] { return bezoutOk(0, 0); }, string("ok"));
    comprueba("mcd(12, 12) y (1, 1)", [&] { return bezoutOk(12, 12) + bezoutOk(1, 1); }, string("okok"));
    comprueba("todos los pares 0 ≤ a, b < 120", [&] {
        for (long long a = 0; a < 120; a++) {
            for (long long b = 0; b < 120; b++) {
                string r = bezoutOk(a, b);
                if (r != "ok") {
                    return r;
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("peor caso: Fibonacci consecutivos F(87), F(86)", [&] { return bezoutOk(fibonacci(87), fibonacci(86)); }, string("ok"));
    comprueba("valores gigantes: 10¹⁸ y 10¹⁸ - 1 · 10¹⁸ y 999 999 937", [&] { return bezoutOk(1000000000000000000LL, 999999999999999999LL) + bezoutOk(1000000000000000000LL, 999999937LL); }, string("okok"));
    comprueba("múltiplos grandes: 6·10¹⁷ y 4·10¹⁷ (g = 2·10¹⁷)", [&] { return bezoutOk(600000000000000000LL, 400000000000000000LL); }, string("ok"));
    lanza("negativo", [&] { mcdExtendido(-1, 5); }, invalid_argument);
    lanza("demasiado grande", [&] { mcdExtendido(2000000000000000000LL, 1); }, invalid_argument);

    prueba(diofantica,
        caso("6x + 10y = 14", Sol(pair<long long, long long>{4, -1}), 6, 10, 14),
        caso("3x + 6y = 10: 3 no divide a 10", Sol{}, 3, 6, 10),
        caso("coprimos: 2x + 3y = 7", Sol(pair<long long, long long>{2, 1}), 2, 3, 7),
        caso("coeficiente negativo: -4x + 6y = 2", Sol(pair<long long, long long>{1, 1}), -4, 6, 2),
        caso("b = 0: 5x = 15", Sol(pair<long long, long long>{3, 0}), 5, 0, 15),
        caso("b = 0 sin solución: 5x = 14", Sol{}, 5, 0, 14),
        caso("a = 0: 7y = 21", Sol(pair<long long, long long>{0, 3}), 0, 7, 21),
        caso("a = 0 sin solución: 7y = 20", Sol{}, 0, 7, 20),
        caso("a = b = 0, c = 0", Sol(pair<long long, long long>{0, 0}), 0, 0, 0),
        caso("a = b = 0, c ≠ 0", Sol{}, 0, 0, 5),
        caso("signos mixtos: 7x - 3y = 1", Sol(pair<long long, long long>{1, 2}), 7, -3, 1),
        caso("c negativo: 4x + 6y = -2", Sol(pair<long long, long long>{1, -1}), 4, 6, -2),
        caso("c = 0 siempre tiene la solución (0, 0)", Sol(pair<long long, long long>{0, 0}), 15, 21, 0));
    grupo("diofantica (más casos)");
    comprueba("coincide con la fuerza bruta: |a|, |b|, |c| ≤ 12", [&] {
        for (long long a = -12; a <= 12; a++) {
            for (long long b = -12; b <= 12; b++) {
                for (long long c = -12; c <= 12; c++) {
                    if (diofantica(a, b, c) != diofanticaFuerzaBruta(a, b, c)) {
                        return string("falla con ") + to_string(a) + ", " + to_string(b) + ", " + to_string(c);
                    }
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("valores de 10⁹: la solución es válida y está normalizada", [&] {
        long long a = 999999937;
        long long b = 1000000000;
        long long c = 999999999;
        Sol s = diofantica(a, b, c);
        if (!s.has_value()) {
            return string("no encuentra la solución");
        }
        __int128 lado = static_cast<__int128>(a) * s->first + static_cast<__int128>(b) * s->second;
        if (lado != c || s->first < 0 || s->first >= b) {
            return string("solución incorrecta o sin normalizar");
        }
        return string("ok");
    }, string("ok"));
    comprueba("valores de 10⁹ con mcd 10⁶: 999999000·x + 1000000000·y = 3·10⁶ no (3·10⁶ sí es múltiplo de 10⁶... y 5 no)", [&] {
        Sol s1 = diofantica(999999000, 1000000000, 3000000);
        Sol s2 = diofantica(999999000, 1000000000, 1000500);
        return string(s1.has_value() ? "si" : "no") + string(s2.has_value() ? "si" : "no");
    }, string("sino"));
    lanza("a fuera de dominio", [&] { diofantica(2000000000, 1, 1); }, invalid_argument);
    lanza("c fuera de dominio", [&] { diofantica(1, 1, -2000000000); }, invalid_argument);

    prueba(contarDivisores,
        caso("n = 0", vector<int>{0}, 0),
        caso("n = 1", vector<int>{0, 1}, 1),
        caso("n = 10", vector<int>{0, 1, 2, 2, 3, 2, 4, 2, 4, 3, 4}, 10),
        caso("n = 12: 12 tiene seis divisores", vector<int>{0, 1, 2, 2, 3, 2, 4, 2, 4, 3, 4, 2, 6}, 12));
    grupo("contarDivisores (más casos)");
    lanza("n negativo", [&] { contarDivisores(-1); }, invalid_argument);
    comprueba("coincide con contar divisores hasta √k para k ≤ 3000", [&] {
        vector<int> d = contarDivisores(3000);
        if (d.size() != 3001 || d[0] != 0) {
            return string("tamaño o d[0] incorrectos");
        }
        for (int k = 1; k <= 3000; k++) {
            int esperado = 0;
            for (int i = 1; i * i <= k; i++) {
                if (k % i == 0) {
                    esperado += (i * i == k) ? 1 : 2;
                }
            }
            if (d[static_cast<size_t>(k)] != esperado) {
                return string("falla con ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("d(k) es impar exactamente para los cuadrados perfectos (k ≤ 10000)", [&] {
        vector<int> d = contarDivisores(10000);
        for (int k = 1; k <= 10000; k++) {
            int raiz = static_cast<int>(sqrt(static_cast<double>(k)) + 0.5);
            bool cuadrado = raiz * raiz == k;
            if ((d[static_cast<size_t>(k)] % 2 == 1) != cuadrado) {
                return string("falla con ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("720720 tiene 240 divisores y 997 (primo) tiene 2", [&] {
        vector<int> d = contarDivisores(720720);
        return vector<int>{d[720720], d[997]};
    }, vector<int>{240, 2});
    comprueba("Σ d(k) para k ≤ n es Σ ⌊n/i⌋ (n = 5000)", [&] {
        vector<int> d = contarDivisores(5000);
        long long suma = 0;
        for (int k = 1; k <= 5000; k++) {
            suma += d[static_cast<size_t>(k)];
        }
        return suma == pasosMultiplos(5000);
    }, true);

    prueba(phiHasta,
        caso("n = 0", vector<int>{0}, 0),
        caso("n = 1", vector<int>{0, 1}, 1),
        caso("n = 10", vector<int>{0, 1, 1, 2, 2, 4, 2, 6, 4, 6, 4}, 10),
        caso("n = 20", vector<int>{0, 1, 1, 2, 2, 4, 2, 6, 4, 6, 4, 10, 4, 12, 6, 8, 8, 16, 6, 18, 8}, 20));
    grupo("phiHasta (más casos)");
    lanza("n negativo", [&] { phiHasta(-3); }, invalid_argument);
    comprueba("coincide con φ por factorización para k ≤ 5000", [&] {
        vector<int> p = phiHasta(5000);
        if (p.size() != 5001) {
            return string("tamaño incorrecto");
        }
        for (int k = 1; k <= 5000; k++) {
            if (p[static_cast<size_t>(k)] != phiUno(k)) {
                return string("falla con ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("identidad: Σ φ(d) sobre los divisores de k vale k (k ≤ 400)", [&] {
        vector<int> p = phiHasta(400);
        for (int k = 1; k <= 400; k++) {
            int suma = 0;
            for (int d = 1; d <= k; d++) {
                if (k % d == 0) {
                    suma += p[static_cast<size_t>(d)];
                }
            }
            if (suma != k) {
                return string("falla con ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("n = 10⁶: un primo da p - 1 y una potencia de 2 da la mitad", [&] {
        vector<int> p = phiHasta(1000000);
        return vector<int>{p[999983], p[524288], p[1000000]};
    }, vector<int>{999982, 262144, 400000});
    comprueba("multiplicativa: φ(a·b) = φ(a)·φ(b) con a, b coprimos", [&] {
        vector<int> p = phiHasta(2000);
        for (int a = 2; a <= 44; a++) {
            for (int b = 2; b <= 44; b++) {
                if (gcd(a, b) == 1 && p[static_cast<size_t>(a * b)] != p[static_cast<size_t>(a)] * p[static_cast<size_t>(b)]) {
                    return string("falla con ") + to_string(a) + ", " + to_string(b);
                }
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(binomialPascal,
        caso("C(0, 0)", 1ULL, 0, 0),
        caso("C(5, 2)", 10ULL, 5, 2),
        caso("C(10, 5)", 252ULL, 10, 5),
        caso("C(30, 15)", 155117520ULL, 30, 15),
        caso("C(40, 20)", 137846528820ULL, 40, 20),
        caso("C(62, 10)", 107518933731ULL, 62, 10),
        caso("C(62, 31): el mayor", 465428353255261088ULL, 62, 31),
        caso("C(62, 0) = C(62, 62) = 1", 1ULL, 62, 62),
        caso("k > n", 0ULL, 5, 6),
        caso("k negativo", 0ULL, 5, -1));
    grupo("binomialPascal (más casos)");
    lanza("n = 63", [&] { binomialPascal(63, 1); }, invalid_argument);
    lanza("n negativo", [&] { binomialPascal(-1, 0); }, invalid_argument);
    comprueba("identidad de Pascal para toda la tabla n ≤ 62", [&] {
        for (int n = 1; n <= 62; n++) {
            for (int k = 1; k < n; k++) {
                if (binomialPascal(n, k) != binomialPascal(n - 1, k - 1) + binomialPascal(n - 1, k)) {
                    return string("falla con ") + to_string(n) + ", " + to_string(k);
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("simetría C(n, k) = C(n, n-k) y suma de cada fila = 2ⁿ", [&] {
        for (int n = 0; n <= 62; n++) {
            unsigned long long suma = 0;
            for (int k = 0; k <= n; k++) {
                if (binomialPascal(n, k) != binomialPascal(n, n - k)) {
                    return string("asimetría con ") + to_string(n) + ", " + to_string(k);
                }
                suma += binomialPascal(n, k);
            }
            if (suma != (1ULL << n)) {
                return string("la fila ") + to_string(n) + " no suma 2^n";
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(inclusionExclusion,
        caso("múltiplos de 2, 3 o 5 hasta 100", 74LL, 100LL, vector<long long>{2, 3, 5}),
        caso("2 o 3 hasta 100", 67LL, 100LL, vector<long long>{2, 3}),
        caso("sin números", 0LL, 100LL, vector<long long>{}),
        caso("n = 0", 0LL, 0LL, vector<long long>{2, 3}),
        caso("n = 1", 0LL, 1LL, vector<long long>{2}),
        caso("un solo número, n = 10¹⁸", 500000000000000000LL, 1000000000000000000LL, vector<long long>{2}),
        caso("no coprimos: usa el mcm (4 y 6 → 12)", 33LL, 100LL, vector<long long>{4, 6}),
        caso("tres no coprimos: 6, 10, 15", 266LL, 1000LL, vector<long long>{6, 10, 15}),
        caso("dos primos de casi 10⁹ con n = 10¹⁸", 2000000133LL, 1000000000000000000LL, vector<long long>{999999937, 999999929}),
        caso("15 primeros primos con n = 10¹⁸ (sumas parciales y mcm grandes)", 861295907364149673LL, 1000000000000000000LL, vector<long long>{2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47}),
        caso("12 primeros primos con n = 10¹⁸", 851278987837743313LL, 1000000000000000000LL, vector<long long>{2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37}));
    grupo("inclusionExclusion (más casos)");
    lanza("número menor que 2", [&] { inclusionExclusion(100, vector<long long>{2, 1}); }, invalid_argument);
    lanza("n negativo", [&] { inclusionExclusion(-1, vector<long long>{2}); }, invalid_argument);
    lanza("más de 20 números", [&] { inclusionExclusion(100, vector<long long>(21, 2)); }, invalid_argument);
    comprueba("coincide con contar uno a uno (n ≤ 600, conjuntos variados)", [&] {
        vector<vector<long long>> conjuntos = {{2}, {3, 5}, {2, 3, 5, 7}, {6, 10, 15}, {4, 6, 9}, {7, 11, 13}, {2, 4, 8}, {5, 5}, {30, 42, 70, 105}};
        for (const auto& c : conjuntos) {
            for (long long n = 0; n <= 600; n += 7) {
                long long cuenta = 0;
                for (long long i = 1; i <= n; i++) {
                    for (long long p : c) {
                        if (i % p == 0) {
                            cuenta++;
                            break;
                        }
                    }
                }
                if (inclusionExclusion(n, c) != cuenta) {
                    return string("falla con n = ") + to_string(n) + " y " + to_string(c.size()) + " números";
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("20 números pequeños no se pasa de tiempo (2²⁰ máscaras)", [&] {
        vector<long long> c = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71};
        long long total = inclusionExclusion(1000000, c);
        return total > 0 && total < 1000000;
    }, true);

    prueba(cuponesEsperados,
        caso("n = 0", 0.0, 0),
        caso("n = 1", 1.0, 1),
        caso("n = 2: 2 + 1", 3.0, 2),
        caso("n = 3: 5,5", 5.5, 3),
        caso("n = 4: 25/3", 25.0 / 3, 4),
        caso("n = 5: 137/12", 137.0 / 12, 5),
        caso("n = 10", 29.28968253968254, 10),
        caso("n = 100", 518.737751763962, 100),
        caso("n = 1000", 7485.470860550345, 1000),
        caso("n = 10⁶", 14392726.722865723, 1000000));
    grupo("cuponesEsperados (más casos)");
    lanza("n negativo", [&] { cuponesEsperados(-1); }, invalid_argument);
    comprueba("coincide con la suma por etapas (n ≤ 300)", [&] {
        for (int n = 1; n <= 300; n++) {
            if (fabs(cuponesEsperados(n) - cuponesPorEtapas(n)) > 1e-9 * cuponesPorEtapas(n)) {
                return string("falla con ") + to_string(n);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("la simulación con semilla fija se queda cerca (n = 30: dentro del 2 %)", [&] {
        double simulada = simularCupones(30, 6000, 11);
        return fabs(simulada - cuponesEsperados(30)) < 0.02 * cuponesEsperados(30);
    }, true);

    prueba(probColision,
        caso("k = 0", 0.0, 0LL, 365LL),
        caso("k = 1: sin pareja no hay colisión", 0.0, 1LL, 365LL),
        caso("k = 2: 1/365", 1.0 / 365, 2LL, 365LL),
        caso("k = 3", 0.008204165884781385, 3LL, 365LL),
        caso("cumpleaños: k = 23", 0.5072972343239854, 23LL, 365LL),
        caso("k = 70 casi seguro", 0.9991595759651571, 70LL, 365LL),
        caso("k = m = 4: 1 - 4!/4⁴", 0.90625, 4LL, 4LL),
        caso("k = m = 5", 0.9616, 5LL, 5LL),
        caso("k > m: palomar", 1.0, 6LL, 5LL),
        caso("un solo cubo y dos claves", 1.0, 2LL, 1LL),
        caso("hashing de 32 bits: k = 77163", 0.49999989051734833, 77163LL, 4294967296LL),
        caso("k = 1000, m = 10⁶", 0.39326702855852064, 1000LL, 1000000LL));
    grupo("probColision (más casos)");
    lanza("k negativo", [&] { probColision(-1, 10); }, invalid_argument);
    lanza("m cero", [&] { probColision(2, 0); }, invalid_argument);
    comprueba("probabilidad diminuta: k = 1000, m = 10¹⁸ da ≈ k(k-1)/(2m) con error relativo < 10⁻⁶ (el producto ingenuo daría 0)", [&] {
        double p = probColision(1000, 1000000000000000000LL);
        double esperado = 1000.0 * 999 / 2e18;
        return fabs(p - esperado) < 1e-6 * esperado;
    }, true);
    comprueba("crece con k y nunca pasa de 1 (m = 365)", [&] {
        double anterior = -1;
        for (long long k = 0; k <= 400; k++) {
            double p = probColision(k, 365);
            if (p < anterior || p > 1.0 || p < 0.0) {
                return string("falla con ") + to_string(k);
            }
            anterior = p;
        }
        return string("ok");
    }, string("ok"));
    comprueba("con la simulación de semilla fija: k = 23 queda a menos de 0,02", [&] { return fabs(simularColision(23, 365, 20000, 3) - probColision(23, 365)) < 0.02; }, true);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    medir(contarDivisores, n);                                                                    // O(n log n)  (Σ n/d)
    medir(phiHasta, n);                                                                           // O(n log log n) ≈ O(n)
    // Un paso de Euclides tarda nanosegundos: cada repetición hace 1000 llamadas y el mayor de los dos números crece con n (Fibonacci consecutivos: el peor caso).
    medirCon("mcdExtendido", [](int n) { return n; }, [](int n) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(mcdExtendido(1000000000000000000LL - i, 1LL + static_cast<long long>(n) * 1000000 + i));
        }
    }, "geometrica", vector<int>{1000, 4000, 16000, 64000, 256000, 1000000});                    // O(log n): sobre todo se ve el ruido, no se compara con la clase
    medir(cuponesEsperados, n);                                                                   // O(n)
}
