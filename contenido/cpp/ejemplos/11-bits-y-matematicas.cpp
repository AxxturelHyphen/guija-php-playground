#include <algorithm>
#include <array>
#include <bit>
#include <bitset>
#include <cstdint>
#include <iostream>
#include <limits>
#include <numeric>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 11 · BITS Y MATEMÁTICAS PARA ALGORITMIA
 * ────────────────────────────────────────────────────────────────────────────
 * En competición y en entrevistas aparecen una y otra vez los mismos recursos: manipular bits (máscaras, XOR, subconjuntos),
 * aritmética modular (resultados «módulo 10⁹+7» para que no se salgan de 64 bits), números primos y combinatoria.
 *
 *   Técnica                                  Para qué                                           Coste
 *   x & (x - 1), x & -x, __builtin_*, <bit>   contar/aislar bits, saltar al siguiente bit         O(1) / O(bits)
 *   Máscara de n bits                         representar un SUBCONJUNTO de n ≤ ~20-25 elementos   2ⁿ subconjuntos
 *   XOR                                       encontrar el que no se repite, intercambiar, nim      O(n)
 *   a·b mod M con long long                   producto modular sin desbordar (M ≲ 3·10⁹)            O(1)
 *   Exponenciación rápida                     aᵇ mod M                                             O(log b)
 *   Euclides extendido / Fermat               inverso modular (dividir mod M)                       O(log M)
 *   Criba de Eratóstenes                      todos los primos ≤ n                                  O(n log log n)
 *   Factorización por división                factores primos de n                                  O(√n)
 *   Factoriales precalculados                 nCr mod p muchas veces                                O(n) + O(1) por consulta
 *
 * La trampa que une todo el tema: en C++ el DESBORDAMIENTO de un entero con signo es comportamiento indefinido (UB), no «da la vuelta»
 * como en Java o C con -fwrapv. Tampoco existe BigInteger ni enteros ilimitados como en Python: o te quedas en 64 bits, o pasas por
 * módulo. Por eso casi todo se hace con `long long` y se reduce con `% MOD` en cada paso.
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
 * │ Java: `int` y `long` desbordan en silencio y dan la vuelta (Math.addExact lanza). C++: con signo es UB; solo los tipos SIN signo
 * │ (unsigned, uint64_t) dan la vuelta de forma garantizada (aritmética módulo 2ⁿ). Python: los int son ilimitados y `%` devuelve
 * │ siempre un resultado ≥ 0 si el divisor es positivo. En C++ y Java, `-7 % 3` es -1 (el signo del dividendo): hay que normalizar.
 * │ PHP: los int se pasan a float al desbordar (pierdes precisión); aquí no.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * ┌─ Desde C ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * │ Los operadores de bits son los mismos. Novedades: <bit> (C++20) trae popcount, countr_zero, bit_width... estándar y seguros
 * │ con 0, y los literales con separador `1'000'000'007`. Los `__builtin_*` de GCC/Clang son extensiones, no estándar.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** El módulo habitual: 10⁹ + 7 es primo y sus productos (< 10¹⁸·1.0000001) caben en un long long (máx. ≈ 9.2·10¹⁸). */
const long long MOD = 1'000'000'007LL;

/** Un número como texto de bits con un ancho fijo, para ver qué hacen los operadores. */
string binario(unsigned long long x, int ancho = 8)
{
    string s;
    for (int i = ancho - 1; i >= 0; i--) {
        s += (x >> i) & 1 ? '1' : '0';
    }
    return s;
}

/** Resto SIEMPRE en [0, m): en C++ `-7 % 3 == -1`, así que se suma m y se reduce otra vez. */
long long modPositivo(long long x, long long m)
{
    return ((x % m) + m) % m;
}

/** aᵇ mod m multiplicando b veces: O(b). Referencia lenta de las pruebas. */
long long potenciaLenta(long long base, long long exponente, long long m)
{
    long long r = 1 % m;
    for (long long i = 0; i < exponente; i++) {
        r = r * modPositivo(base, m) % m;
    }
    return r;
}

/**
 * Euclides extendido: devuelve g = mcd(a, b) y deja en x, y los coeficientes de Bézout: a·x + b·y = g.
 * Si g = 1, entonces x es el inverso de a módulo b. Base: mcd(a, 0) = a con (x, y) = (1, 0).
 * Paso: mcd(a, b) = mcd(b, a % b); si b·y' + (a % b)·x' = g, entonces a·x' + b·(y' - (a / b)·x') = g.
 */
long long euclidesExtendido(long long a, long long b, long long& x, long long& y)
{
    if (b == 0) {
        x = 1;
        y = 0;
        return a;
    }
    long long x1 = 0;
    long long y1 = 0;
    long long g = euclidesExtendido(b, a % b, x1, y1);
    x = y1;
    y = x1 - (a / b) * y1;
    return g;
}

/** Criba de Eratóstenes sencilla: esPrimo[i] == 1 si i es primo. Un vector<char> (¡no vector<bool>!) para indexar sin proxies. */
vector<char> cribaBasica(int n)
{
    vector<char> esPrimo(static_cast<size_t>(n) + 1, 1);
    esPrimo[0] = 0;
    if (n >= 1) {
        esPrimo[1] = 0;
    }
    for (long long i = 2; i * i <= n; i++) {          // long long: i*i con int desbordaría para n cercano a 2³¹
        if (esPrimo[i]) {
            for (long long j = i * i; j <= n; j += i) {   // se empieza en i²: los múltiplos menores ya los tachó un primo menor
                esPrimo[j] = 0;
            }
        }
    }
    return esPrimo;
}

/** Menor factor primo de cada número hasta n (criba lineal-ish): factorizar luego un número ≤ n cuesta O(log n). */
vector<int> menorFactor(int n)
{
    vector<int> mf(static_cast<size_t>(n) + 1, 0);
    for (int i = 2; i <= n; i++) {
        if (mf[i] == 0) {
            for (int j = i; j <= n; j += i) {
                if (mf[j] == 0) {
                    mf[j] = i;
                }
            }
        }
    }
    return mf;
}

/** Cuenta los subconjuntos de a con suma objetivo recorriendo cada máscara: ejemplo de enumeración con bits. */
int subconjuntosLento(const vector<int>& a, long long objetivo)
{
    int n = static_cast<int>(a.size());
    int cuenta = 0;
    for (unsigned mask = 0; mask < (1u << n); mask++) {
        long long suma = 0;
        for (int i = 0; i < n; i++) {
            if (mask >> i & 1) {
                suma += a[i];
            }
        }
        if (suma == objetivo) {
            cuenta++;
        }
    }
    return cuenta;
}

/** Un vector con cada valor 1..n/2 dos veces y UN valor `unico` una sola vez, mezclado de forma reproducible. */
vector<int> conUnico(int n, int unico)
{
    vector<int> v;
    for (int i = 1; i <= n / 2; i++) {
        v.push_back(i);
        v.push_back(i);
    }
    v.push_back(unico);
    vector<int> orden = aleatorios(static_cast<int>(v.size()), 1000000, 5);
    vector<int> idx(v.size());
    iota(idx.begin(), idx.end(), 0);
    sort(idx.begin(), idx.end(), [&](int p, int q) { return orden[p] < orden[q]; });
    vector<int> r(v.size());
    for (size_t i = 0; i < idx.size(); i++) {
        r[i] = v[idx[i]];
    }
    return r;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · contarBits ─────────────────────────────────────────────────
/**
 * Cuántos bits valen 1 en x (el «popcount»), SIN usar `popcount` ni `__builtin_popcount`: con el truco de Kernighan.
 * `x &= x - 1` apaga el bit encendido más bajo (x - 1 invierte ese bit y todos los de su derecha), así que el bucle
 * da una vuelta por cada bit encendido: O(bits encendidos), no O(64).
 *     10110 → 10100 → 10000 → 0   (3 vueltas)
 * Trampa de C++: el parámetro es `unsigned long long` (64 bits SIN signo). `__builtin_popcount(x)` toma un `unsigned int`:
 * le pasas un long long y se TRUNCA a 32 bits en silencio (la versión de 64 es `__builtin_popcountll`). En C++20 usa `std::popcount`.
 */
int contarBits(unsigned long long x)
{
    return pendiente();
}

// ── Ejercicio 2 · numeroUnico ────────────────────────────────────────────────
/**
 * En un vector todos los valores aparecen EXACTAMENTE dos veces menos uno, que aparece una sola vez. Devuélvelo en O(n) tiempo y O(1)
 * espacio extra (sin mapas). Pista: x ^ x = 0 y x ^ 0 = x, y el XOR es conmutativo y asociativo: al hacer XOR de todo, los pares se
 * anulan. [4, 1, 2, 1, 2] → 4. Los negativos valen igual (XOR de int es bit a bit). El vector llega con al menos un elemento.
 */
int numeroUnico(const vector<int>& a)
{
    return pendiente();
}

// ── Ejercicio 3 · subconjuntosConSuma ────────────────────────────────────────
/**
 * Cuenta de cuántas formas se pueden elegir elementos de `a` (por posición; la elección vacía cuenta) para que sumen `objetivo`.
 * {1, 2, 3} y 3 → 2 ({3} y {1, 2}). {} y 0 → 1 (el subconjunto vacío). Los valores pueden ser negativos: {-1, 1} y 0 → 2.
 * Enumera las 2ⁿ máscaras: el bit i de la máscara dice si se coge a[i] (`mask >> i & 1`). Usa una máscara `unsigned` o `long long`
 * con `1LL << n`: **`1 << n` es int y con n ≥ 31 es UB** (con n ≥ 32 es desplazamiento mayor que el ancho: UB siempre).
 * Acumula la suma en long long. Si a.size() > 25 lanza invalid_argument (2²⁵ máscaras ya son 33 millones de subconjuntos).
 * Coste: O(2ⁿ · n) (mejora a O(2ⁿ) construyendo la suma de cada máscara a partir de la de `mask & (mask - 1)`).
 */
long long subconjuntosConSuma(const vector<int>& a, long long objetivo)
{
    return pendiente();
}

// ── Ejercicio 4 · potenciaModular ────────────────────────────────────────────
/**
 * aᵇ mod m en O(log b) con la exponenciación rápida (binaria): si b es par, aᵇ = (a²)^(b/2); si es impar, aᵇ = a·a^(b-1). Iterativo:
 *     r = 1; while (e > 0) { if (e & 1) r = r * base % m; base = base * base % m; e >>= 1; }
 * Condiciones: 1 ≤ m ≤ 3·10⁹ (así cualquier producto de dos restos es < 9·10¹⁸ y cabe en long long); exponente ≥ 0; si no,
 * invalid_argument. La base puede ser negativa o enorme: normalízala a [0, m) con `((base % m) + m) % m` ANTES de empezar.
 * Con m = 1 el resultado es 0 (todo es 0 módulo 1), incluso con exponente 0: ¡no devuelvas 1 sin reducir!
 * Trampa: `base * base` con base ≥ 3.04·10⁹ ya desborda long long (UB). Por eso se reduce primero y el módulo está acotado.
 */
long long potenciaModular(long long base, long long exponente, long long modulo)
{
    return pendiente();
}

// ── Ejercicio 5 · inversoModular ─────────────────────────────────────────────
/**
 * El inverso de a módulo m: el x en [0, m) con (a · x) % m == 1; o -1 si no existe (existe sii mcd(a, m) = 1). m ≥ 2, si no
 * invalid_argument. `a` puede ser negativa. Sirve para «dividir módulo m»: a / b ≡ a · inverso(b).
 * Con m PRIMO vale Fermat: a^(m-2) mod m (con tu potenciaModular), pero para un m cualquiera hay que usar Euclides extendido
 * (mira `euclidesExtendido` arriba): si a·x + m·y = 1, entonces a·x ≡ 1 (mod m), y x puede salir negativo → normalízalo.
 */
long long inversoModular(long long a, long long m)
{
    return pendiente();
}

// ── Ejercicio 6 · criba ──────────────────────────────────────────────────────
/**
 * Todos los primos ≤ n, en orden creciente, con la criba de Eratóstenes: O(n log log n), casi lineal. n < 2 → vector vacío.
 * Tacha los múltiplos de cada primo empezando en p² (los menores ya los tachó otro primo menor) y solo hace falta llegar hasta √n.
 * Trampas: el bucle `i * i <= n` desborda int cuando n está cerca de 2³¹ (usa long long); `vector<bool>` está empaquetado a bits
 * y es más lento de acceder (usa vector<char> si lo mides); y reserva `n + 1` posiciones, no `n`.
 */
vector<int> criba(int n)
{
    return pendiente();
}

// ── Ejercicio 7 · factorizar ─────────────────────────────────────────────────
/**
 * Factores primos de n como pares (primo, exponente) en orden creciente de primo: 360 → {(2,3), (3,2), (5,1)}; 97 → {(97,1)}; 1 → {}.
 * n ≤ 0 → invalid_argument. Divide por d = 2, 3, 4... mientras `d * d <= n`; cada vez que d divide a n, divídelo todo lo que puedas (así
 * solo se prueban primos: los compuestos ya han perdido sus factores). Lo que quede al final, si es > 1, es un primo grande.
 * Coste O(√n): para n ≈ 10¹² son 10⁶ vueltas. Trampa: `d * d` con d de tipo int desborda; usa long long para d.
 */
vector<pair<long long, int>> factorizar(long long n)
{
    return pendiente();
}

// ── Ejercicio 8 · Combinatoria (nCr mod p) ───────────────────────────────────
/**
 * Calcula C(n, r) mod 1.000.000.007 en O(1) por consulta tras un precálculo O(nMax). Guarda `fact[i] = i! mod p` y `inv[i] = (i!)⁻¹ mod p`:
 *     C(n, r) = fact[n] · inv[r] · inv[n-r]  (mod p)
 * El truco para tener inv[] en O(nMax): calcula SOLO inv[nMax] con exponenciación (Fermat: x^(p-2)) y baja con `inv[i-1] = inv[i] · i`.
 * Cada multiplicación se reduce por separado: (a · b % p) · c % p (tres factores de 30 bits NO caben juntos en 64).
 *   - `Combinatoria c(nMax)`: nMax < 0 → invalid_argument.
 *   - `c.nCr(n, r)`: r < 0 o r > n → 0; n fuera de [0, nMax] → out_of_range.
 * Trampa: no sirve para n ≥ p (los factoriales serían 0 mod p). Aquí nMax ≪ p.
 */
struct Combinatoria {
    explicit Combinatoria(int nMax)
    {
        pendiente();
    }

    long long nCr(int n, int r) const
    {
        return pendiente();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. OPERACIONES DE BITS Y MÁSCARAS
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1. Operadores de bits");

    unsigned bitsA = 0b10110100;
    unsigned bitsB = 0b01101110;
    cout << "a        = " << binario(bitsA) << " (" << bitsA << ")\n";
    cout << "b        = " << binario(bitsB) << " (" << bitsB << ")\n";
    cout << "a & b    = " << binario(bitsA & bitsB) << "   (AND: bits en AMBOS)\n";
    cout << "a | b    = " << binario(bitsA | bitsB) << "   (OR: bits en alguno)\n";
    cout << "a ^ b    = " << binario(bitsA ^ bitsB) << "   (XOR: bits que DIFIEREN)\n";
    cout << "a << 2   = " << binario(bitsA << 2, 10) << "  (multiplicar por 4)\n";
    cout << "a >> 2   = " << binario(bitsA >> 2) << "   (dividir entre 4, hacia abajo)\n";
    cout << "~a (8 b) = " << binario(~bitsA & 0xFF) << "   (NOT: ojo, ~a tiene 32 bits; se enmascara con & 0xFF)\n";

    // Las cuatro operaciones de máscara que se usan constantemente (k = número de bit, 0 = el menos significativo):
    unsigned masc = 0;
    masc |= 1u << 3;                  // ENCENDER el bit 3
    masc |= 1u << 5;
    masc ^= 1u << 5;                  // INVERTIR el bit 5 (aquí lo apaga)
    masc |= 1u << 1;
    masc &= ~(1u << 1);               // APAGAR el bit 1
    cout << "máscara = " << binario(masc) << ", ¿bit 3? " << ((masc >> 3) & 1) << ", ¿bit 4? " << ((masc >> 4) & 1) << "\n";

    // x & (x-1) apaga el bit más bajo; x & -x lo aísla:
    unsigned xBits = 0b10110100;
    cout << "x          = " << binario(xBits) << "\n";
    cout << "x & (x-1)  = " << binario(xBits & (xBits - 1)) << "   (apaga el bit más bajo)\n";
    cout << "x & -x     = " << binario(xBits & (~xBits + 1)) << "   (solo el bit más bajo)\n";
    // Potencia de dos ⇔ un único bit encendido ⇔ x > 0 && (x & (x-1)) == 0.
    // TRAMPAS: (1) `1 << 31` en int toca el bit de signo (en C++20 está definido pero da negativo) y `1 << 32` es UB: usa 1u, 1ULL o 1LL;
    // (2) desplazar más bits que el ancho del tipo es UB; (3) `>>` de un negativo conserva el signo en la práctica, pero está definido por la
    // implementación hasta C++20: para bits trabaja con tipos sin signo; (4) la precedencia: `a & 1 == 0` se lee `a & (1 == 0)`. ¡Paréntesis!

// ═══════════════════════════════════════════════════════════════════════════════
// 2. __BUILTIN Y <BIT>
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. popcount, ctz, clz y <bit>");

    unsigned vBits = 0b0010'1000'0000;
    cout << "v = " << vBits << " = " << binario(vBits, 12) << "\n";
    cout << "std::popcount(v)     = " << popcount(vBits) << "      (bits encendidos)\n";
    cout << "std::countr_zero(v)  = " << countr_zero(vBits) << "      (ceros por la derecha = posición del bit más bajo)\n";
    cout << "std::countl_zero(v)  = " << countl_zero(vBits) << "     (ceros por la izquierda en 32 bits)\n";
    cout << "std::bit_width(v)    = " << bit_width(vBits) << "      (bits necesarios = floor(log2 v) + 1)\n";
    cout << "std::has_single_bit  = " << has_single_bit(vBits) << "      (¿potencia de dos?)\n";
    cout << "std::bit_ceil(100)   = " << bit_ceil(100u) << "    (siguiente potencia de dos ≥ 100)\n";
    cout << "std::rotl(0b1001u,2) = " << rotl(9u, 2) << "     (rotación: lo que sale por la izquierda entra por la derecha)\n";
    cout << "popcount(0) = " << popcount(0u) << ", countr_zero(0u) = " << countr_zero(0u) << " (con 0 los std:: están definidos)\n";
    // Los __builtin_popcount / __builtin_ctz / __builtin_clz (GCC y Clang) hacen lo mismo, pero:
    //   - toman unsigned int; la versión de 64 bits lleva «ll» (__builtin_popcountll). Pasar un long long a la de 32 TRUNCA en silencio;
    //   - __builtin_ctz(0) y __builtin_clz(0) son UB (la CPU no define el resultado);
    //   - no son estándar: no compilan en MSVC. En C++20 usa <bit>.
    cout << "floor(log2(1000)) = " << bit_width(1000u) - 1 << "\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ENUMERAR SUBCONJUNTOS
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3. Subconjuntos con máscaras");

    vector<string> letras = {"a", "b", "c"};
    for (unsigned m = 0; m < (1u << letras.size()); m++) {         // 2ⁿ máscaras: 0 .. 2ⁿ-1
        cout << binario(m, 3) << " → {";
        bool primero = true;
        for (size_t i = 0; i < letras.size(); i++) {
            if (m >> i & 1) {
                cout << (primero ? "" : ", ") << letras[i];
                primero = false;
            }
        }
        cout << "}\n";
    }
    // Submáscaras de una máscara dada (los subconjuntos de un subconjunto), de mayor a menor: s = (s - 1) & mask.
    unsigned total = 0b1011;
    cout << "submáscaras de " << binario(total, 4) << ":";
    for (unsigned s = total;; s = (s - 1) & total) {
        cout << " " << binario(s, 4);
        if (s == 0) {
            break;                                            // el 0 (conjunto vacío) se procesa aparte: con `for (; s; ...)` se perdería
        }
    }
    cout << "\n";
    // Recorrer TODAS las submáscaras de TODAS las máscaras de n bits cuesta 3ⁿ, no 4ⁿ.
    cout << "subconjuntos de {1,2,3} con suma 3 (lento): " << subconjuntosLento({1, 2, 3}, 3) << "\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ARITMÉTICA MODULAR
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("4. Módulo 10⁹+7 y desbordamiento");

    // Propiedades: (a + b) % M = ((a % M) + (b % M)) % M, igual con · y con -; NO con / (hace falta el inverso modular).
    long long pMod = 987654321, qMod = 876543210;
    cout << "(p * q) % MOD = " << pMod * qMod % MOD << "   (p * q = " << pMod * qMod << " cabe en 63 bits)\n";
    cout << "-7 % 3 = " << -7 % 3 << " (¡negativo en C++!), modPositivo(-7, 3) = " << modPositivo(-7, 3) << "\n";
    // Restas: (a - b) % M puede dar negativo → ((a - b) % M + M) % M.
    // Si MOD fuera 10¹⁸ ya no podrías multiplicar en long long; con GCC existe __int128 (no estándar) y hay que convertir al imprimir:
    unsigned __int128 grande = static_cast<unsigned __int128>(1'000'000'000'000'000'000ULL) * 999'999'999'999ULL;
    cout << "10^18 · (10^12 - 1) mod 998244353 con __int128 = " << static_cast<unsigned long long>(grande % 998244353) << "\n";
    // TRAMPA clásica: `long long r = a * b % MOD` con a, b de tipo int: el producto se calcula en INT y desborda ANTES de promover.
    int ai = 100000, bi = 100000;
    cout << "bien: " << static_cast<long long>(ai) * bi % MOD << " (casting ANTES de multiplicar)\n";
    // INT_MAX + 1 y similares: UB para int con signo; para unsigned es módulo 2ⁿ y legal:
    unsigned maxU = numeric_limits<unsigned>::max();
    cout << "UINT_MAX + 1 = " << maxU + 1 << " (da la vuelta, definido solo para unsigned)\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 5. EXPONENCIACIÓN RÁPIDA, INVERSOS Y EUCLIDES
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("5. Euclides extendido e inverso modular");

    cout << "std::gcd(84, 36) = " << gcd(84, 36) << ", std::lcm(4, 6) = " << lcm(4, 6) << "   (en <numeric>; lcm = a / gcd * b para no desbordar)\n";
    long long xx = 0;
    long long yy = 0;
    long long mcdv = euclidesExtendido(240, 46, xx, yy);
    cout << "240·x + 46·y = " << mcdv << "  con x = " << xx << ", y = " << yy << "  (comprobación: " << 240 * xx + 46 * yy << ")\n";
    mcdv = euclidesExtendido(3, MOD, xx, yy);
    (void)mcdv;
    cout << "inverso de 3 mod 10⁹+7 = " << modPositivo(xx, MOD) << " (3 · eso % MOD = " << 3 * modPositivo(xx, MOD) % MOD << ")\n";
    cout << "2^30 mod 10⁹+7 (lento) = " << potenciaLenta(2, 30, MOD) << "\n";
    // Si el exponente es 10¹⁸ el método lento no acaba nunca; la exponenciación rápida (ejercicio 4) hace unas 60 vueltas.
    // Fermat: si p es primo y p ∤ a, a^(p-1) ≡ 1 (mod p) → inverso de a = a^(p-2).

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CRIBA Y FACTORIZACIÓN
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("6. Criba de Eratóstenes");

    vector<char> esPrimoC = cribaBasica(50);
    cout << "primos ≤ 50:";
    for (int i = 0; i <= 50; i++) {
        if (esPrimoC[i]) {
            cout << " " << i;
        }
    }
    cout << "\n";
    vector<int> mf = menorFactor(100);
    cout << "90 = ";                                    // factorizar con el «menor factor» precalculado: O(log n) por número
    int resto = 90;
    while (resto > 1) {
        cout << mf[resto] << " ";
        resto /= mf[resto];
    }
    cout << "(con menorFactor(100))\n";
    // Para 1 consulta: factorizar por división O(√n) (ejercicio 7). Para MUCHAS consultas ≤ N: criba de menor factor O(N log log N) y
    // luego O(log n) por consulta.

// ═══════════════════════════════════════════════════════════════════════════════
// 7. COMBINATORIA MODULAR
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("7. nCr mod p");

    // C(n, r) = n! / (r! (n-r)!). Sin módulo, n! ya no cabe en 64 bits para n ≥ 21. Con módulo no se puede dividir tal cual: se multiplica
    // por el INVERSO modular de los factoriales (ejercicio 8).
    long long fact20 = 1;
    for (int i = 1; i <= 20; i++) {
        fact20 *= i;
    }
    cout << "20! = " << fact20 << " (el máximo que cabe en long long; 21! desbordaría → UB)\n";
    // Triángulo de Pascal: C(n, r) = C(n-1, r-1) + C(n-1, r). O(n²) de tiempo y memoria; vale cuando n ≤ ~5000 y no hay inverso.
    vector<vector<long long>> pascal(6, vector<long long>(6, 0));
    for (int n = 0; n < 6; n++) {
        pascal[n][0] = 1;
        for (int r = 1; r <= n; r++) {
            pascal[n][r] = pascal[n - 1][r - 1] + pascal[n - 1][r];
        }
    }
    cout << "C(5, 2) con Pascal = " << pascal[5][2] << "\n";

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    prueba(contarBits,
        caso("cero", 0, 0ULL),
        caso("uno", 1, 1ULL),
        caso("255", 8, 255ULL),
        caso("potencia de dos", 1, 1ULL << 40),
        caso("todos los bits", 64, ~0ULL),
        caso("el bit más alto", 1, 1ULL << 63),
        caso("alternos", 32, 0x5555555555555555ULL),
        caso("bits dispersos", 3, 0x8000000000010001ULL));
    grupo("contarBits (más casos)");
    comprueba("coincide con std::popcount en 2000 valores", [&] {
        unsigned long long x = 88172645463325252ULL;
        for (int i = 0; i < 2000; i++) {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            if (contarBits(x) != popcount(x)) {
                return string("falla con ") + to_string(x);
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(numeroUnico,
        caso("clásico", 4, vector<int>{4, 1, 2, 1, 2}),
        caso("un elemento", 7, vector<int>{7}),
        caso("negativos", -7, vector<int>{-3, -7, -3}),
        caso("el único es 0", 0, vector<int>{5, 0, 5}),
        caso("valores grandes", 2147483647, vector<int>{1000000000, 2147483647, 1000000000}));
    grupo("numeroUnico (más casos)");
    comprueba("100001 elementos mezclados", [&] { return numeroUnico(conUnico(100000, 424242)); }, 424242);

    prueba(subconjuntosConSuma,
        caso("ejemplo", 2LL, vector<int>{1, 2, 3}, 3LL),
        caso("vacío y 0 → el subconjunto vacío", 1LL, vector<int>{}, 0LL),
        caso("vacío y otro objetivo", 0LL, vector<int>{}, 5LL),
        caso("repetidos cuentan por posición", 6LL, vector<int>{1, 1, 1, 1}, 2LL),
        caso("con negativos", 2LL, vector<int>{-1, 1}, 0LL),
        caso("objetivo imposible", 0LL, vector<int>{2, 4, 6}, 5LL),
        caso("todos los elementos", 1LL, vector<int>{5, 6, 7}, 18LL),
        caso("ceros duplican las opciones", 4LL, vector<int>{0, 0, 3}, 3LL));
    grupo("subconjuntosConSuma (más casos)");
    comprueba("20 elementos: coincide con la versión lenta", [&] {
        vector<int> v = aleatorios(20, 10, 3);
        return subconjuntosConSuma(v, 25);
    }, static_cast<long long>(subconjuntosLento(aleatorios(20, 10, 3), 25)));
    comprueba("suma mayor que un int", [&] {
        vector<int> v(4, 2000000000);
        return subconjuntosConSuma(v, 6000000000LL);
    }, 4LL);
    lanza("más de 25 elementos", [&] { subconjuntosConSuma(vector<int>(26, 1), 5); }, invalid_argument);

    prueba(potenciaModular,
        caso("2^10 mod 1000", 24LL, 2LL, 10LL, 1000LL),
        caso("2^30 mod 10⁹+7", 73741817LL, 2LL, 30LL, MOD),
        caso("exponente 0", 1LL, 7LL, 0LL, 13LL),
        caso("módulo 1", 0LL, 5LL, 3LL, 1LL),
        caso("módulo 1 y exponente 0", 0LL, 5LL, 0LL, 1LL),
        caso("base 0", 0LL, 0LL, 5LL, 7LL),
        caso("base negativa", 4LL, -3LL, 2LL, 5LL),
        caso("base mayor que el módulo", 1LL, 1000000008LL, 2LL, MOD),
        caso("módulo de 3·10⁹: (m-1)² ≡ 1", 1LL, 2999999999LL, 2LL, 3000000000LL));
    grupo("potenciaModular (más casos)");
    comprueba("Fermat: a^(p-1) ≡ 1 (mod p) con exponente 10⁹+6", [&] {
        for (long long a : {2LL, 3LL, 10LL, 123456789LL, 1000000006LL}) {
            if (potenciaModular(a, MOD - 1, MOD) != 1) {
                return string("falla con ") + to_string(a);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("exponente de 10¹⁸ (el método lento no acabaría)", [&] {
        long long r = potenciaModular(2, 1'000'000'000'000'000'000LL, MOD);
        return r >= 0 && r < MOD && potenciaModular(2, 1'000'000'000'000'000'000LL % (MOD - 1), MOD) == r;     // Fermat reduce el exponente
    }, true);
    comprueba("coincide con la versión lenta", [&] {
        for (long long a = -5; a <= 12; a++) {
            for (long long e = 0; e <= 20; e += 3) {
                for (long long m : {1LL, 2LL, 7LL, 100LL, MOD}) {
                    if (potenciaModular(a, e, m) != potenciaLenta(a, e, m)) {
                        return string("falla con ") + to_string(a) + "^" + to_string(e) + " mod " + to_string(m);
                    }
                }
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("exponente negativo", [&] { potenciaModular(2, -1, 7); }, invalid_argument);
    lanza("módulo 0", [&] { potenciaModular(2, 3, 0); }, invalid_argument);

    prueba(inversoModular,
        caso("3 mod 7", 5LL, 3LL, 7LL),
        caso("2 mod 10⁹+7", 500000004LL, 2LL, MOD),
        caso("a = 1", 1LL, 1LL, 2LL),
        caso("módulo compuesto", 7LL, 7LL, 12LL),
        caso("no es coprimo", -1LL, 4LL, 8LL),
        caso("a = 0", -1LL, 0LL, 7LL),
        caso("a negativo", 2LL, -3LL, 7LL),
        caso("a mayor que m", 5LL, 10LL, 7LL));
    grupo("inversoModular (más casos)");
    comprueba("para todo m en 2..80 y a en 0..m-1", [&] {
        for (long long m = 2; m <= 80; m++) {
            for (long long a = 0; a < m; a++) {
                long long x = inversoModular(a, m);
                bool coprimo = gcd(a, m) == 1;
                if (coprimo ? (x < 0 || x >= m || a * x % m != 1) : x != -1) {
                    return string("falla con a = ") + to_string(a) + ", m = " + to_string(m);
                }
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("módulo 1", [&] { inversoModular(3, 1); }, invalid_argument);

    prueba(criba,
        caso("hasta 30", vector<int>{2, 3, 5, 7, 11, 13, 17, 19, 23, 29}, 30),
        caso("n = 2", vector<int>{2}, 2),
        caso("n = 1", vector<int>{}, 1),
        caso("n = 0", vector<int>{}, 0),
        caso("n negativo", vector<int>{}, -5),
        caso("n primo se incluye", vector<int>{2, 3, 5, 7, 11}, 11),
        caso("n compuesto", vector<int>{2, 3, 5, 7}, 10));
    grupo("criba (más casos)");
    comprueba("hay 78498 primos ≤ 10⁶", [&] { return static_cast<int>(criba(1000000).size()); }, 78498);
    comprueba("el último primo ≤ 10⁶ es 999983", [&] { return criba(1000000).back(); }, 999983);
    comprueba("coincide con la criba básica", [&] {
        vector<char> es2 = cribaBasica(5000);
        vector<int> esperado;
        for (int i = 0; i <= 5000; i++) {
            if (es2[i]) {
                esperado.push_back(i);
            }
        }
        return criba(5000) == esperado;
    }, true);

    prueba(factorizar,
        caso("360", vector<pair<long long, int>>{{2, 3}, {3, 2}, {5, 1}}, 360LL),
        caso("1 no tiene factores", vector<pair<long long, int>>{}, 1LL),
        caso("un primo", vector<pair<long long, int>>{{97, 1}}, 97LL),
        caso("potencia de primo", vector<pair<long long, int>>{{2, 40}}, 1LL << 40),
        caso("dos primos grandes", vector<pair<long long, int>>{{999983, 1}, {1000003, 1}}, 999983LL * 1000003LL),
        caso("Project Euler 3", vector<pair<long long, int>>{{71, 1}, {839, 1}, {1471, 1}, {6857, 1}}, 600851475143LL),
        caso("primo de 12 cifras", vector<pair<long long, int>>{{999999999989LL, 1}}, 999999999989LL));
    grupo("factorizar (más casos)");
    comprueba("el producto de los factores devuelve n (n = 2..3000)", [&] {
        for (long long n = 2; n <= 3000; n++) {
            long long prod = 1;
            long long anterior = 1;
            for (auto [pr, e] : factorizar(n)) {
                if (pr <= anterior) {
                    return string("desordenado en ") + to_string(n);
                }
                anterior = pr;
                for (int i = 0; i < e; i++) {
                    prod *= pr;
                }
            }
            if (prod != n) {
                return string("falla con ") + to_string(n);
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("n = 0", [&] { factorizar(0); }, invalid_argument);
    lanza("n negativo", [&] { factorizar(-12); }, invalid_argument);

    grupo("Combinatoria");
    comprueba("valores pequeños", [&] {
        Combinatoria c(10);
        return vector<long long>{c.nCr(5, 2), c.nCr(10, 0), c.nCr(10, 10), c.nCr(6, 3), c.nCr(0, 0), c.nCr(10, 5)};
    }, vector<long long>{10, 1, 1, 20, 1, 252});
    comprueba("r fuera de [0, n] vale 0", [&] {
        Combinatoria c(10);
        return vector<long long>{c.nCr(3, 4), c.nCr(3, -1)};
    }, vector<long long>{0, 0});
    comprueba("C(1000, 500) mod 10⁹+7", [&] { return Combinatoria(1000).nCr(1000, 500); }, 159835829LL);
    comprueba("simetría C(n, r) = C(n, n-r)", [&] {
        Combinatoria c(5000);
        for (int n = 0; n <= 5000; n += 313) {
            for (int r = 0; r <= n; r += 97) {
                if (c.nCr(n, r) != c.nCr(n, n - r)) {
                    return string("falla con ") + to_string(n) + ", " + to_string(r);
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("coincide con el triángulo de Pascal módulo p (n ≤ 300)", [&] {
        Combinatoria c(300);
        vector<vector<long long>> t(301, vector<long long>(301, 0));
        for (int n = 0; n <= 300; n++) {
            t[n][0] = 1;
            for (int r = 1; r <= n; r++) {
                t[n][r] = (t[n - 1][r - 1] + t[n - 1][r]) % MOD;
            }
        }
        for (int n = 0; n <= 300; n++) {
            for (int r = 0; r <= n; r++) {
                if (c.nCr(n, r) != t[n][r]) {
                    return string("falla con ") + to_string(n) + ", " + to_string(r);
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("nMax = 0", [&] { return Combinatoria(0).nCr(0, 0); }, 1LL);
    lanza("n por encima de nMax", [&] { Combinatoria c(10); c.nCr(11, 2); }, out_of_range);
    lanza("nMax negativo", [&] { Combinatoria c(-1); }, invalid_argument);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    medir(numeroUnico, conUnico(n, 7));                                                   // O(n)
    medir(criba, n);                                                                      // O(n log log n) ≈ O(n)
    // 2ⁿ: la escala geométrica se pasaría de largo; se mide con n = 10..20 («lineal»)
    medirCon("subconjuntosConSuma", [](int n) { return n; }, [](int n) {
        noOptimizar(subconjuntosConSuma(vector<int>(n, 1), -1));
    }, "lineal", rango(10, 20, 1));                                                       // O(2ⁿ)
    // Una exponenciación tarda nanosegundos: cada repetición hace 1000 y el exponente crece con n.
    medirCon("potenciaModular", [](int n) { return n; }, [](int n) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(potenciaModular(3 + i, 1'000'000LL * n + i, MOD));
        }
    });                                                                                   // O(log exponente)
    medirCon("Combinatoria.nCr", [](int n) { return make_pair(Combinatoria(n), n); }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.nCr(e.second, i % (e.second + 1)));
        }
    });                                                                                   // O(1) por consulta
}
