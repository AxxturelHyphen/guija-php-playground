#include <algorithm>
#include <bit>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 16 · ANÁLISIS AMORTIZADO Y RECURRENCIAS
 * ────────────────────────────────────────────────────────────────────────────
 * DOS PREGUNTAS DE COSTE QUE SE RESPONDEN CON MATEMÁTICAS, NO CON UN CRONÓMETRO:
 *
 *   A. «Una operación cuesta O(n) a veces, pero casi siempre O(1): ¿cuánto cuestan n operaciones SEGUIDAS?»  → ANÁLISIS AMORTIZADO.
 *      `vector::push_back` es el ejemplo: cuando se llena, copia TODO a un array del doble de tamaño (O(n)), pero eso pasa
 *      cada vez menos. El coste amortizado es el total de n operaciones dividido entre n: O(1). No es una media probabilista (no hay
 *      azar): es una garantía sobre CUALQUIER secuencia de operaciones, incluida la peor.
 *
 *   B. «Un algoritmo recursivo se llama a sí mismo con entradas más pequeñas: ¿cuánto tarda?»  → RECURRENCIAS: T(n) = a·T(n/b) + f(n).
 *      Se resuelven con el árbol de recursión (sumar el trabajo de cada nivel) o con el TEOREMA MAESTRO.
 *
 * LOS TRES MÉTODOS AMORTIZADOS (cada ejercicio de estructuras usa uno, y los tres dan el mismo resultado):
 *   1. AGREGADO:  sumar el coste real de n operaciones y dividir. Vector que dobla: copias totales = 1 + 2 + 4 + … + 2ᵏ < 2n.
 *   2. CONTABLE:  cobrar a cada operación barata un poco de MÁS (una «moneda» de ahorro); ese crédito paga las operaciones caras.
 *                 Cada push cobra 3: 1 por insertar, 1 para copiarse a sí mismo al crecer y 1 para copiar a un elemento viejo.
 *   3. POTENCIAL: una función Φ del estado de la estructura (energía almacenada). Coste amortizado = coste real + ΔΦ. Si Φ ≥ 0 y
 *                 empieza en 0, el coste real total ≤ el coste amortizado total. En la pila con multipop, Φ = tamaño de la pila.
 *
 * TEOREMA MAESTRO para T(n) = a·T(n/b) + n^k (a ≥ 1, b ≥ 2): sea c = log_b(a), el exponente de «cuántas hojas hay».
 *   a > bᵏ  (c > k)   domina el trabajo de las HOJAS:    T(n) = Θ(n^c)         ej.  T(n) = 4·T(n/2) + n  → Θ(n²)
 *   a = bᵏ  (c = k)   todos los niveles cuestan igual:   T(n) = Θ(nᵏ · log n)  ej.  T(n) = 2·T(n/2) + n  → Θ(n log n)  (mergesort)
 *   a < bᵏ  (c < k)   domina el trabajo de la RAÍZ:      T(n) = Θ(nᵏ)          ej.  T(n) = T(n/2) + n    → Θ(n)
 * Cuando el problema se reduce restando (T(n) = T(n-1) + n) no es del tipo maestro: sumas n + (n-1) + … + 1 = n(n+1)/2 = Θ(n²).
 *
 * CÓMO SE COMPRUEBA AQUÍ: las estructuras llevan CONTADORES del trabajo real (copias, volteos, traslados) y las pruebas verifican las
 * cotas amortizadas EXACTAS (por ejemplo, copias totales ≤ 2n tras n inserciones). Las recurrencias se EJECUTAN de verdad y `medir`
 * dibuja el tiempo frente a n: debe salir la curva que predice el teorema maestro.
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
 * │ `ArrayList` de Java, el array de PHP y la lista de Python crecen igual que `std::vector`: cuando se llenan, reservan más
 * │ sitio (el factor es 2 en libstdc++, 1,5 en Java y ~1,125 en CPython) y copian. Una consecuencia práctica en C++: al crecer, el
 * │ vector MUEVE sus elementos a otra dirección y las referencias, punteros e iteradores anteriores quedan colgando (UB). Si sabes
 * │ cuántos vas a meter, `v.reserve(n)` evita todas las copias intermedias.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Copias totales de n inserciones en un array que DOBLA su capacidad (empieza en 1): 1 + 2 + 4 + … Referencia para la demo. */
long long copiasDoblando(int n)
{
    long long copias = 0;
    long long capacidad = 1;
    for (int tamano = 0; tamano < n; tamano++) {
        if (tamano == capacidad) {
            copias += tamano;
            capacidad *= 2;
        }
    }
    return copias;
}

/** Volteos de bits al pasar el contador binario de v-1 a v: los ceros finales de v más el 1 que se enciende = ctz(v) + 1. */
int volteosAlSubirA(unsigned long long v)
{
    return countr_zero(v) + 1;
}

/**
 * T(n) de la recurrencia T(n) = a·T(⌊n/b⌋) + f(n) con T(0) = 0, T(1) = 1 y f(n) = n^k (k = 0 o 1), calculada de ABAJO ARRIBA sobre la cadena
 * n, ⌊n/b⌋, ⌊n/b²⌋… (solo log n valores, aunque T(n) sea enorme). Es el ORÁCULO de las pruebas (vale para b = 2, que es el que se usa).
 */
long long tMaestro(int a, int b, int n, int k)
{
    vector<int> cadena;
    for (int m = n; m >= 2; m /= b) {
        cadena.push_back(m);
    }
    long long t = n >= 1 ? 1 : 0;                         // T(1) = 1 (o T(0) = 0 si n = 0)
    for (size_t i = cadena.size(); i-- > 0;) {
        t = a * t + (k == 0 ? 1 : cadena[i]);
    }
    return n >= 1 ? t : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · casoMaestro ────────────────────────────────────────────────
/**
 * Clasifica T(n) = a·T(n/b) + nᵏ con el teorema maestro y devuelve QUÉ domina: "hojas" (a > bᵏ), "equilibrado" (a = bᵏ) o "raíz" (a < bᵏ).
 * (2, 2, 1) → "equilibrado" (n log n) · (4, 2, 1) → "hojas" (n²) · (1, 2, 1) → "raíz" (n) · (1, 2, 0) → "equilibrado" (log n).
 * a ≥ 1, b ≥ 2 y k ≥ 0, si no invalid_argument. Todo en ENTEROS: compara `a` con `bᵏ` sin pow() ni logaritmos de coma flotante
 * (log₂ 8 / log₂ 2 podría salir 2,9999999). Multiplica `bᵏ` paso a paso y PARA en cuanto supere a `a`: ya no puede volver a bajar
 * (b ≥ 2), así que no hace falta llegar a bᵏ si desbordaría (con k = 40 y b = 3, bᵏ no cabe en un long long).
 * Coste: O(min(k, log_b a)).
 */
string casoMaestro(int a, int b, int k)
{
    return pendiente();
}

// ── Ejercicio 2 · recurrenciaLineal ──────────────────────────────────────────
/**
 * EJECUTA de verdad T(n) = T(n-1) + n con T(0) = 0 y devuelve el número total de «unidades de trabajo» hechas. Cada llamada con n > 0 hace
 * un bucle de n pasos (cada paso suma 1 al contador y llama a `noOptimizar(paso)`, para que el compilador no lo convierta en `contador += n`)
 * y después se llama con n-1. El resultado es n + (n-1) + … + 1 = n(n+1)/2. n < 0 → invalid_argument.
 * Por qué es Θ(n²): hay n niveles de recursión y el nivel i hace n - i pasos, una suma aritmética. NO es del tipo maestro (resta, no divide).
 * Si calculas la fórmula n(n+1)/2 en vez de ejecutar la recursión, las pruebas pasan pero `medir` saldrá O(1) y no O(n²): el cronómetro
 * delata que no has medido nada. El objetivo es ver la curva.
 * Cuidado con la profundidad: n llamadas anidadas. Decenas de miles caben (la pila del playground es grande); con millones, no.
 * Coste: O(n²) de tiempo y O(n) de pila.
 */
long long recurrenciaLineal(int n)
{
    return pendiente();
}

// ── Ejercicio 3 · recurrenciaDividir ─────────────────────────────────────────
/**
 * EJECUTA T(n) = 2·T(⌊n/2⌋) + n con T(0) = 0 y T(1) = 1 y devuelve el trabajo total. Cada llamada con n ≥ 2 hace un bucle de n pasos (cada paso suma 1 al contador y
 * hace `acumulador = acumulador * 31 + paso; noOptimizar(acumulador);` para que sea un trabajo real), y llama dos veces con ⌊n/2⌋; con n = 1 hace 1 paso; con n = 0 nada. T(2) = 4, T(3) = 5, T(4) = 12, T(8) = 32;
 * para n potencia de dos, T(n) = n·log₂ n + n. n < 0 → invalid_argument.
 * Es la forma de MERGESORT: dividir en dos mitades y hacer un trabajo lineal para combinarlas. Árbol de recursión: log₂ n + 1 niveles y
 * CADA nivel suma n (2ᵈ llamadas de tamaño n/2ᵈ), así que T(n) = Θ(n log n): caso «equilibrado» del teorema maestro (a = bᵏ: 2 = 2¹).
 * Coste: O(n log n) de tiempo y O(log n) de pila.
 */
long long recurrenciaDividir(int n)
{
    return pendiente();
}

// ── Ejercicio 4 · recurrenciaHojas ───────────────────────────────────────────
/**
 * EJECUTA T(n) = 2·T(⌊n/2⌋) + 1 con T(0) = 0 y T(1) = 1 y devuelve el trabajo total (1 paso por llamada, con `noOptimizar`). T(2) = 3, T(3) = 3,
 * T(4) = 7, T(8) = 15; para n potencia de dos, T(n) = 2n - 1 (el número de nodos de un árbol binario con n hojas). n < 0 → invalid_argument.
 * Mismo esqueleto que el ejercicio 3 pero con trabajo CONSTANTE por llamada, y el resultado es muy distinto: Θ(n), no Θ(n log n). Árbol: el nivel d
 * tiene 2ᵈ nodos y cada uno cuesta 1, así que el trabajo se DUPLICA en cada nivel y lo domina el último (las n hojas): caso «hojas» (a = 2 > 1 = 2⁰).
 * Compara la curva de `medir` con la del ejercicio 3: misma estructura de llamadas, distinto trabajo por nivel, distinto coste.
 * Coste: O(n) de tiempo y O(log n) de pila.
 */
long long recurrenciaHojas(int n)
{
    return pendiente();
}

// ── Ejercicio 5 · ContadorBinario ────────────────────────────────────────────
/**
 * Contador binario de `bits` bits (por defecto 32; entre 1 y 64, si no invalid_argument) que se incrementa en 1 volteando bits: los 1 finales pasan a
 * 0 y el primer 0 pasa a 1 (0111 + 1 = 1000: 4 volteos). Al desbordar (todo unos) vuelve a 0 (aritmética módulo 2^bits) y esos bits también cuentan.
 *   - incrementar(): devuelve cuántos bits ha volteado ESE incremento.
 *   - valor(): el número que representa (unsigned long long).   - volteos(): el total de volteos desde el principio.
 * Guarda los bits en un vector (bit 0 = el menos significativo). Un solo incremento puede costar `bits` volteos, pero n incrementos cuestan
 * menos de 2n en total: AMORTIZADO O(1). (Método agregado: el bit i se voltea una vez cada 2ⁱ incrementos, así que el total es
 * n + n/2 + n/4 + … < 2n. Método potencial: Φ = número de unos; un incremento que voltea t unos a 0 y uno 0 a 1 cuesta t + 1 y
 * hace ΔΦ = 1 - t, luego el coste amortizado es (t + 1) + (1 - t) = 2.) Sin desbordar, n incrementos dan exactamente 2n - popcount(n) volteos.
 * Coste: incrementar es O(bits) en el peor caso y O(1) amortizado.
 */
struct ContadorBinario {
    explicit ContadorBinario(int bits = 32)
    {
        pendiente();
    }

    int incrementar()
    {
        return pendiente();
    }

    unsigned long long valor() const
    {
        return pendiente();
    }

    long long volteos() const
    {
        return pendiente();
    }
};

// ── Ejercicio 6 · ArrayDinamico ──────────────────────────────────────────────
/**
 * Array que crece DOBLANDO su capacidad, como `vector`. Nace con capacidad 1 y 0 elementos. NO uses push_back de un vector para guardar los
 * datos: guarda un vector de tamaño = capacidad (o un puntero) y haz tú el crecimiento.
 *   - agregar(x): si tamano == capacidad, crea un array del DOBLE de capacidad, COPIA los `tamano` elementos y suma esas copias a `copias`;
 *     después coloca x al final.
 *   - get(i): el elemento i; fuera de [0, tamano) → out_of_range.   - tamano(), capacidad() y copias() (el total de elementos copiados al crecer).
 * Demostración amortizada (agregado): tras n inserciones las copias son 1 + 2 + 4 + … + 2ᵏ = 2ᵏ⁺¹ - 1 con 2ᵏ < n ≤ 2ᵏ⁺¹ → siempre MENOS DE 2n. Por tanto
 * n inserciones cuestan O(n) en total (n escrituras + < 2n copias) y cada una O(1) amortizado, aunque UNA sola pueda costar O(n).
 * Las pruebas comprueban exactamente: capacidad 1, 2, 4, 4, 8… y copias 0, 1, 3, 3, 7… Si en vez de DOBLAR sumaras una cantidad fija, serían Θ(n²): mira
 * el ejercicio 7.
 * Coste: agregar es O(n) en el peor caso y O(1) amortizado; get O(1); espacio O(n).
 */
struct ArrayDinamico {
    void agregar(int x)
    {
        pendiente();
    }

    int get(size_t i) const
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    size_t capacidad() const
    {
        return pendiente();
    }

    long long copias() const
    {
        return pendiente();
    }
};

// ── Ejercicio 7 · copiasCrecimientoFijo ──────────────────────────────────────
/**
 * Lo CONTRARIO del ejercicio 6: un array que, cuando se llena, crece solo `incremento` casillas (en vez de doblar). Parte de capacidad 0.
 * Simula n inserciones y devuelve el total de elementos copiados al crecer. n = 0 → 0; n < 0 o incremento < 1 → invalid_argument.
 * (n = 10, incremento = 1) → 0 + 1 + 2 + … + 9 = 45 · (10, 5) → 5 · (10, 10) → 0 · (1000, 1) → 499 500.
 * Cuando el tamaño actual iguala la capacidad hay que crecer: copiar `tamano` elementos a un array nuevo de capacidad + incremento. Hazlo de
 * VERDAD (crea el vector nuevo y copia con un bucle o con `std::copy`), no con la fórmula: así `medir` cronometra copias reales.
 * Resultado: las copias son incremento · (1 + 2 + … + ⌊(n-1)/incremento⌋) ≈ n² / (2·incremento): CUADRÁTICO para un incremento fijo. El
 * crecimiento ARITMÉTICO (sumar una constante) da Θ(n²) y el GEOMÉTRICO (multiplicar por un factor > 1) da Θ(n): es lo que justifica el 2 de `vector`.
 * Las pruebas usan n pequeño; `medir` hace el resto.
 * Coste: O(n² / incremento) de tiempo.
 */
long long copiasCrecimientoFijo(int n, int incremento)
{
    return pendiente();
}

// ── Ejercicio 8 · PilaMultipop ───────────────────────────────────────────────
/**
 * Pila con una operación extra, `sacar(k)` (multipop): saca hasta k elementos de golpe (todos los que haya si hay menos) y los devuelve en el orden en
 * que salen (la cima primero). Una sola llamada puede costar O(n), pero el coste amortizado de cada operación es O(1).
 *   - empujar(x), cima() (vacía → out_of_range), tamano(), sacar(k) (k < 0 → invalid_argument).
 *   - trabajo(): el total de operaciones elementales hechas = (elementos empujados) + (elementos sacados). Una llamada a `sacar` en una pila vacía
 *     suma 0.
 * Cota amortizada (método potencial, Φ = tamaño de la pila): empujar cuesta 1 y sube Φ en 1 → amortizado 2; sacar(k) saca s ≤ k elementos y cuesta s
 * pero baja Φ en s → amortizado 0. Así cualquier secuencia de m operaciones cuesta como mucho 2m. Método agregado: cada elemento se saca como máximo una
 * vez después de empujarse, así que sacados ≤ empujados y trabajo ≤ 2 · empujados. Las pruebas verifican `trabajo() ≤ 2 · empujados`.
 * Coste: sacar(k) O(min(k, n)); amortizado O(1).
 */
struct PilaMultipop {
    void empujar(int x)
    {
        pendiente();
    }

    int cima() const
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    vector<int> sacar(int k)
    {
        return pendiente();
    }

    long long trabajo() const
    {
        return pendiente();
    }
};

// ── Ejercicio 9 · ColaAmortizada ─────────────────────────────────────────────
/**
 * Cola FIFO hecha con DOS PILAS (dos vectores que usas solo por el final): `entrada` recibe los `encolar`; `salida` entrega los `desencolar`/`frente`.
 * Cuando `salida` está vacía y hace falta un elemento, se TRASLADA toda `entrada` a `salida` sacando de una y metiendo en la otra: así se invierte el
 * orden y el más antiguo queda arriba. Cada elemento trasladado suma 1 a `traslados()`.
 *   - encolar(x), desencolar() → el más antiguo (vacía → out_of_range), frente() (igual pero sin quitarlo; también puede trasladar), tamano(), traslados().
 * UNA operación puede costar O(n): n encolar y un desencolar traslada n elementos de golpe (la prueba lo comprueba: traslados() == 1000). Pero cada
 * elemento se traslada COMO MUCHO UNA VEZ (cuando pasa a salida ya no vuelve), así que n operaciones cuestan O(n): amortizado O(1).
 * Potencial: Φ = tamaño de `entrada` (cada elemento encolado guarda 1 moneda para su propio traslado). Es la versión «reloj» de la cola de dos pilas del tema 7.
 * Invariante: traslados() ≤ número de elementos encolados. Si trasladaras en CADA desencolar (no solo cuando salida está vacía), serían O(n) cada vez.
 * Coste: encolar O(1); desencolar O(n) en el peor caso, O(1) amortizado.
 */
struct ColaAmortizada {
    void encolar(int x)
    {
        pendiente();
    }

    int desencolar()
    {
        return pendiente();
    }

    int frente()
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    long long traslados() const
    {
        return pendiente();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. EL VECTOR QUE DOBLA: COPIAS TOTALES FRENTE A n
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1. Método agregado: copias totales de n inserciones");

    for (int n : {1, 2, 3, 5, 9, 17, 100, 1000, 1025, 1000000}) {
        long long c = copiasDoblando(n);
        cout << "n = " << n << ": copias = " << c << "  (copias / n = " << static_cast<double>(c) / n << ", siempre < 2)\n";
    }
    // El peor caso es n = 2ᵏ + 1 (justo después de doblar): copias ≈ 2n - 1. Aun así, el total de n inserciones es O(n): ¡O(1) amortizado!
    // Un solo push_back de los de 1 000 000 de elementos copia medio millón de golpe: la latencia máxima NO está acotada (importa en tiempo real).

// ═══════════════════════════════════════════════════════════════════════════════
// 2. EL CONTADOR BINARIO: CUÁNTO CUESTA CADA INCREMENTO
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. Volteos de bits de 1 a 16");

    long long total = 0;
    cout << "incremento → volteos (acumulado):";
    for (unsigned long long v = 1; v <= 16; v++) {
        total += volteosAlSubirA(v);
        cout << "  " << v << "→" << volteosAlSubirA(v) << " (" << total << ")";
    }
    cout << "\n";
    // Los costes 1,2,1,3,1,2,1,4,… forman la «secuencia de la regla»: el bit i se voltea cada 2ⁱ incrementos. Tras 16 incrementos el total es 31
    // = 2·16 - 1 < 32: amortizado menos de 2 por incremento, aunque el incremento 16 (01111 → 10000) cueste 5.

// ═══════════════════════════════════════════════════════════════════════════════
// 3. RECURRENCIAS: LA FORMA DE T(n) SEGÚN a, b Y f(n)
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3. T(n) / (lo que predice el teorema maestro) se estabiliza");

    cout << "        n   T(n)=T(n/2)+n / n   T(n)=2T(n/2)+n / (n·log₂n)   T(n)=4T(n/2)+n / n²   T(n)=2T(n/2)+1 / n\n";
    for (int n : {64, 1024, 16384, 262144, 4194304}) {
        double ln = log2(static_cast<double>(n));
        cout << "  " << n << "        " << static_cast<double>(tMaestro(1, 2, n, 1)) / n << "                " << static_cast<double>(tMaestro(2, 2, n, 1)) / (n * ln)
             << "                      " << static_cast<double>(tMaestro(4, 2, n, 1)) / (static_cast<double>(n) * n) << "                " << static_cast<double>(tMaestro(2, 2, n, 0)) / n << "\n";
    }
    // Cada columna tiende a una constante (2, 1+1/log n, 2, 2): el cociente con la función del teorema maestro NO crece ni decrece, es
    // lo que significa Θ. Con `medir` verás lo mismo con relojes en lugar de contar pasos.

// ═══════════════════════════════════════════════════════════════════════════════
// 4. T(n) = T(n-1) + n: NO ES UNA DIVISIÓN
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("4. Restar un elemento en cada paso");

    for (int n : {10, 100, 1000}) {
        long long suma = static_cast<long long>(n) * (n + 1) / 2;
        cout << "n = " << n << ": T(n) = n(n+1)/2 = " << suma << "  (n² / 2 = " << static_cast<long long>(n) * n / 2 << ")\n";
    }
    // Quitar UNA unidad por nivel deja n niveles en lugar de log n: el coste ya no es n log n sino n². Dividir a la mitad es lo que hace barata
    // la recursión; restar 1 la hace tan cara como dos bucles anidados. (Y T(n) = 2T(n-1) + 1 sería 2ⁿ - 1: exponencial.)

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    prueba(casoMaestro,
        caso("mergesort", string("equilibrado"), 2, 2, 1),
        caso("hojas: T(n) = 4T(n/2) + n → n²", string("hojas"), 4, 2, 1),
        caso("raíz: T(n) = T(n/2) + n → n", string("raíz"), 1, 2, 1),
        caso("búsqueda binaria: T(n) = T(n/2) + 1 → log n", string("equilibrado"), 1, 2, 0),
        caso("hojas con trabajo constante: T(n) = 2T(n/2) + 1 → n", string("hojas"), 2, 2, 0),
        caso("Karatsuba: 3T(n/2) + n", string("hojas"), 3, 2, 1),
        caso("n³ log n", string("equilibrado"), 8, 2, 3),
        caso("raíz con k = 2", string("raíz"), 2, 2, 2),
        caso("b = 3", string("equilibrado"), 9, 3, 2));
    grupo("casoMaestro (más casos)");
    lanza("a cero", [&] { casoMaestro(0, 2, 1); }, invalid_argument);
    lanza("b = 1", [&] { casoMaestro(2, 1, 1); }, invalid_argument);
    lanza("k negativo", [&] { casoMaestro(2, 2, -1); }, invalid_argument);
    comprueba("k enorme no desborda: b = 3 y k = 60", [&] { return casoMaestro(5, 3, 60); }, string("raíz"));
    comprueba("a enorme con k grande", [&] { return casoMaestro(2000000000, 2, 40); }, string("raíz"));
    comprueba("a = bᵏ exacto con valores grandes (2³⁰)", [&] { return casoMaestro(1 << 30, 2, 30); }, string("equilibrado"));

    prueba(recurrenciaLineal,
        caso("T(0)", 0LL, 0),
        caso("T(1)", 1LL, 1),
        caso("T(2)", 3LL, 2),
        caso("T(5)", 15LL, 5),
        caso("T(100)", 5050LL, 100),
        caso("T(1000)", 500500LL, 1000));
    grupo("recurrenciaLineal (más casos)");
    lanza("n negativo", [&] { recurrenciaLineal(-1); }, invalid_argument);
    comprueba("profundidad 20000 sin romper la pila", [&] { return recurrenciaLineal(20000); }, 200010000LL);

    prueba(recurrenciaDividir,
        caso("T(0)", 0LL, 0),
        caso("T(1)", 1LL, 1),
        caso("T(2)", 4LL, 2),
        caso("T(3): ⌊3/2⌋ = 1", 5LL, 3),
        caso("T(4)", 12LL, 4),
        caso("T(8) = 8·3 + 8", 32LL, 8),
        caso("T(16)", 80LL, 16),
        caso("n no potencia de dos: T(100)", tMaestro(2, 2, 100, 1), 100));
    grupo("recurrenciaDividir (más casos)");
    lanza("n negativo", [&] { recurrenciaDividir(-5); }, invalid_argument);
    comprueba("potencias de dos: n·log₂(n) + n", [&] {
        for (int k = 0; k <= 16; k++) {
            long long n = 1LL << k;
            if (recurrenciaDividir(static_cast<int>(n)) != n * k + n) {
                return string("falla con 2^") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("coincide con el oráculo para n = 0..300", [&] {
        for (int n = 0; n <= 300; n++) {
            if (recurrenciaDividir(n) != tMaestro(2, 2, n, 1)) {
                return string("falla con ") + to_string(n);
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(recurrenciaHojas,
        caso("T(0)", 0LL, 0),
        caso("T(1)", 1LL, 1),
        caso("T(2)", 3LL, 2),
        caso("T(3)", 3LL, 3),
        caso("T(4)", 7LL, 4),
        caso("T(8)", 15LL, 8),
        caso("T(1000)", tMaestro(2, 2, 1000, 0), 1000));
    grupo("recurrenciaHojas (más casos)");
    lanza("n negativo", [&] { recurrenciaHojas(-1); }, invalid_argument);
    comprueba("potencias de dos: 2n - 1", [&] {
        for (int k = 0; k <= 20; k++) {
            long long n = 1LL << k;
            if (recurrenciaHojas(static_cast<int>(n)) != 2 * n - 1) {
                return string("falla con 2^") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("coincide con el oráculo para n = 0..300", [&] {
        for (int n = 0; n <= 300; n++) {
            if (recurrenciaHojas(n) != tMaestro(2, 2, n, 0)) {
                return string("falla con ") + to_string(n);
            }
        }
        return string("ok");
    }, string("ok"));

    grupo("ContadorBinario");
    comprueba("volteos de cada incremento (0 → 8)", [&] {
        ContadorBinario c;
        vector<int> v;
        for (int i = 0; i < 8; i++) {
            v.push_back(c.incrementar());
        }
        return v;
    }, vector<int>{1, 2, 1, 3, 1, 2, 1, 4});
    comprueba("valor y volteos totales tras 8 incrementos", [&] {
        ContadorBinario c;
        for (int i = 0; i < 8; i++) {
            c.incrementar();
        }
        return vector<long long>{static_cast<long long>(c.valor()), c.volteos()};
    }, vector<long long>{8, 15});
    comprueba("recién creado vale 0", [&] { ContadorBinario c; return vector<long long>{static_cast<long long>(c.valor()), c.volteos()}; }, vector<long long>{0, 0});
    comprueba("desborda y vuelve a 0 (3 bits: 7 → 0 voltea los tres)", [&] {
        ContadorBinario c(3);
        vector<int> v;
        for (int i = 0; i < 8; i++) {
            v.push_back(c.incrementar());
        }
        return vector<long long>{v.back(), static_cast<long long>(c.valor()), c.volteos()};
    }, vector<long long>{3, 0, 14});
    comprueba("COTA AMORTIZADA: tras n incrementos hay exactamente 2n - popcount(n) volteos (n = 1..3000)", [&] {
        ContadorBinario c;
        for (int n = 1; n <= 3000; n++) {
            c.incrementar();
            if (c.volteos() != 2LL * n - popcount(static_cast<unsigned>(n))) {
                return string("falla con n = ") + to_string(n);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("UN solo incremento puede costar muchos volteos: de 2²⁰ - 1 a 2²⁰ son 21 (y n incrementos siguen costando < 2n)", [&] {
        ContadorBinario c;
        for (long long i = 0; i < (1LL << 20) - 1; i++) {
            c.incrementar();
        }
        return c.incrementar();
    }, 21);
    comprueba("64 bits: el valor máximo cabe", [&] {
        ContadorBinario c(64);
        c.incrementar();
        return c.valor();
    }, 1ULL);
    lanza("0 bits", [&] { ContadorBinario c(0); }, invalid_argument);
    lanza("65 bits", [&] { ContadorBinario c(65); }, invalid_argument);

    grupo("ArrayDinamico");
    comprueba("agregar y get", [&] {
        ArrayDinamico a;
        for (int i = 0; i < 20; i++) {
            a.agregar(i * i);
        }
        return vector<int>{a.get(0), a.get(5), a.get(19), static_cast<int>(a.tamano())};
    }, vector<int>{0, 25, 361, 20});
    comprueba("recién creado: capacidad 1, ningún elemento", [&] { ArrayDinamico a; return vector<long long>{static_cast<long long>(a.tamano()), static_cast<long long>(a.capacidad()), a.copias()}; }, vector<long long>{0, 1, 0});
    comprueba("la capacidad sigue 1, 2, 4, 4, 8, 8, 8, 8, 16…", [&] {
        ArrayDinamico a;
        vector<int> caps;
        for (int i = 0; i < 9; i++) {
            a.agregar(i);
            caps.push_back(static_cast<int>(a.capacidad()));
        }
        return caps;
    }, vector<int>{1, 2, 4, 4, 8, 8, 8, 8, 16});
    comprueba("las copias son 0, 1, 3, 3, 7, 7, 7, 7, 15 tras 1..9 inserciones", [&] {
        ArrayDinamico a;
        vector<long long> copias;
        for (int i = 0; i < 9; i++) {
            a.agregar(i);
            copias.push_back(a.copias());
        }
        return copias;
    }, vector<long long>{0, 1, 3, 3, 7, 7, 7, 7, 15});
    comprueba("COTA AMORTIZADA: copias ≤ 2n tras cada una de 5000 inserciones", [&] {
        ArrayDinamico a;
        for (int n = 1; n <= 5000; n++) {
            a.agregar(n);
            if (a.copias() > 2LL * n) {
                return string("falla con n = ") + to_string(n);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("el peor caso es justo después de doblar: n = 2ᵏ + 1 copia 2ᵏ⁺¹ - 1", [&] {
        ArrayDinamico a;
        for (int i = 0; i < 1025; i++) {
            a.agregar(i);
        }
        return a.copias();
    }, 2047LL);
    comprueba("conserva los valores al crecer", [&] {
        ArrayDinamico a;
        for (int i = 0; i < 1000; i++) {
            a.agregar(i * 3 - 7);
        }
        for (int i = 0; i < 1000; i++) {
            if (a.get(static_cast<size_t>(i)) != i * 3 - 7) {
                return string("pierde el elemento ") + to_string(i);
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("get fuera de rango", [&] { ArrayDinamico a; a.agregar(1); a.get(1); }, out_of_range);
    lanza("get en vacío", [&] { ArrayDinamico a; a.get(0); }, out_of_range);

    prueba(copiasCrecimientoFijo,
        caso("n = 10, incremento 1", 45LL, 10, 1),
        caso("n = 10, incremento 5", 5LL, 10, 5),
        caso("el incremento cubre todo", 0LL, 10, 10),
        caso("incremento enorme", 0LL, 10, 100),
        caso("n = 0", 0LL, 0, 1),
        caso("n = 1", 0LL, 1, 1),
        caso("n = 1000, incremento 1", 499500LL, 1000, 1),
        caso("n = 11, incremento 5: crece en los tamaños 0, 5 y 10", 15LL, 11, 5));
    grupo("copiasCrecimientoFijo (más casos)");
    lanza("incremento cero", [&] { copiasCrecimientoFijo(5, 0); }, invalid_argument);
    lanza("n negativo", [&] { copiasCrecimientoFijo(-1, 1); }, invalid_argument);
    comprueba("fórmula para todos los pares (n < 120, incremento < 15)", [&] {
        for (int n = 0; n < 120; n++) {
            for (int inc = 1; inc < 15; inc++) {
                long long esperado = 0;
                for (long long s = 0; s < n; s += inc) {
                    esperado += s;
                }
                if (copiasCrecimientoFijo(n, inc) != esperado) {
                    return string("falla con ") + to_string(n) + " y " + to_string(inc);
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("doblar gana: n = 3000 copia mucho menos que crecer de 8 en 8", [&] {
        ArrayDinamico a;
        for (int i = 0; i < 3000; i++) {
            a.agregar(i);
        }
        return a.copias() * 50 < copiasCrecimientoFijo(3000, 8);
    }, true);

    grupo("PilaMultipop");
    comprueba("empujar, cima y tamaño", [&] {
        PilaMultipop p;
        p.empujar(1);
        p.empujar(2);
        p.empujar(3);
        return vector<int>{p.cima(), static_cast<int>(p.tamano())};
    }, vector<int>{3, 3});
    comprueba("sacar(2) devuelve la cima primero", [&] {
        PilaMultipop p;
        for (int i = 1; i <= 5; i++) {
            p.empujar(i);
        }
        auto s = p.sacar(2);
        return vector<int>{s[0], s[1], static_cast<int>(s.size()), p.cima(), static_cast<int>(p.tamano())};
    }, vector<int>{5, 4, 2, 3, 3});
    comprueba("sacar más de los que hay saca todos", [&] {
        PilaMultipop p;
        p.empujar(1);
        p.empujar(2);
        return vector<int>{static_cast<int>(p.sacar(100).size()), static_cast<int>(p.tamano())};
    }, vector<int>{2, 0});
    comprueba("sacar de una pila vacía devuelve nada y no cuesta", [&] {
        PilaMultipop p;
        auto s = p.sacar(5);
        return vector<long long>{static_cast<long long>(s.size()), p.trabajo()};
    }, vector<long long>{0, 0});
    comprueba("sacar(0) no saca nada", [&] {
        PilaMultipop p;
        p.empujar(7);
        return vector<long long>{static_cast<long long>(p.sacar(0).size()), static_cast<long long>(p.tamano()), p.trabajo()};
    }, vector<long long>{0, 1, 1});
    comprueba("trabajo = empujados + sacados", [&] {
        PilaMultipop p;
        for (int i = 0; i < 10; i++) {
            p.empujar(i);
        }
        p.sacar(4);
        p.sacar(100);
        return p.trabajo();
    }, 20LL);
    comprueba("COTA AMORTIZADA: trabajo ≤ 2 · empujados en 20000 operaciones aleatorias", [&] {
        PilaMultipop p;
        long long empujados = 0;
        vector<int> azar = aleatorios(20000, 100, 5);
        for (int op : azar) {
            if (op < 70) {
                p.empujar(op);
                empujados++;
            } else {
                p.sacar(op - 60);
            }
            if (p.trabajo() > 2 * empujados) {
                return string("supera la cota con ") + to_string(empujados) + " empujados";
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("cima de una pila vacía", [&] { PilaMultipop p; p.cima(); }, out_of_range);
    lanza("k negativo", [&] { PilaMultipop p; p.sacar(-1); }, invalid_argument);

    grupo("ColaAmortizada");
    comprueba("orden FIFO", [&] {
        ColaAmortizada c;
        for (int i = 1; i <= 5; i++) {
            c.encolar(i);
        }
        vector<int> r;
        for (int i = 0; i < 3; i++) {
            r.push_back(c.desencolar());
        }
        c.encolar(6);
        while (c.tamano() > 0) {
            r.push_back(c.desencolar());
        }
        return r;
    }, vector<int>{1, 2, 3, 4, 5, 6});
    comprueba("frente no quita el elemento", [&] {
        ColaAmortizada c;
        c.encolar(10);
        c.encolar(20);
        return vector<int>{c.frente(), c.frente(), static_cast<int>(c.tamano()), c.desencolar(), c.frente()};
    }, vector<int>{10, 10, 2, 10, 20});
    comprueba("traslados: 5 encolar + desencolares trasladan 5 una sola vez; luego encolar(6) y sacarlo traslada 1", [&] {
        ColaAmortizada c;
        for (int i = 1; i <= 5; i++) {
            c.encolar(i);
        }
        c.desencolar();
        long long tras1 = c.traslados();
        for (int i = 0; i < 4; i++) {
            c.desencolar();
        }
        long long tras2 = c.traslados();
        c.encolar(6);
        c.desencolar();
        return vector<long long>{tras1, tras2, c.traslados()};
    }, vector<long long>{5, 5, 6});
    comprueba("UNA operación cuesta O(n): mil encolar y un desencolar trasladan mil", [&] {
        ColaAmortizada c;
        for (int i = 0; i < 1000; i++) {
            c.encolar(i);
        }
        c.desencolar();
        return c.traslados();
    }, 1000LL);
    comprueba("sin desencolar no hay traslados", [&] { ColaAmortizada c; for (int i = 0; i < 50; i++) { c.encolar(i); } return c.traslados(); }, 0LL);
    comprueba("alternando encolar/desencolar, un traslado por desencolar (cada elemento se traslada una vez)", [&] {
        ColaAmortizada c;
        for (int i = 0; i < 100; i++) {
            c.encolar(i);
            c.desencolar();
        }
        return c.traslados();
    }, 100LL);
    comprueba("COTA AMORTIZADA: traslados ≤ elementos encolados en 20000 operaciones aleatorias", [&] {
        ColaAmortizada c;
        long long encolados = 0;
        size_t dentro = 0;
        vector<int> azar = aleatorios(20000, 100, 8);
        for (int op : azar) {
            if (op < 55 || dentro == 0) {
                c.encolar(op);
                encolados++;
                dentro++;
            } else if (op % 2 == 0) {
                c.desencolar();
                dentro--;
            } else {
                c.frente();
            }
            if (c.traslados() > encolados) {
                return string("supera la cota");
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("si salida no está vacía NO se traslada: 1,2 → desencolar; encolar 3 → desencolar", [&] {
        ColaAmortizada c;
        c.encolar(1);
        c.encolar(2);
        c.desencolar();
        c.encolar(3);
        c.desencolar();
        return c.traslados();
    }, 2LL);
    lanza("desencolar en una cola vacía", [&] { ColaAmortizada c; c.desencolar(); }, out_of_range);
    lanza("frente en una cola vacía", [&] { ColaAmortizada c; c.frente(); }, out_of_range);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // Las tres recurrencias del teorema maestro y la que resta: cuatro curvas distintas con el mismo esqueleto de código.
    medir(recurrenciaLineal, n);                                                                   // O(n²)  T(n) = T(n-1) + n
    // (las dos siguientes son rápidas: cada repetición hace 32 rondas para que el tiempo no se pierda en el ruido del cronómetro)
    medirCon("recurrenciaDividir", [](int n) { return n; }, [](int& n) {
        long long total = 0;
        for (int ronda = 0; ronda < 32; ronda++) {
            total += recurrenciaDividir(n);
        }
        return total;
    });                                                                                            // O(n log n)  T(n) = 2T(n/2) + n
    medirCon("recurrenciaHojas", [](int n) { return n; }, [](int& n) {
        long long total = 0;
        for (int ronda = 0; ronda < 32; ronda++) {
            total += recurrenciaHojas(n);
        }
        return total;
    });                                                                                            // O(n)  T(n) = 2T(n/2) + 1
    // El crecimiento aritmético frente al geométrico: copias reales de datos al insertar n elementos.
    medir(copiasCrecimientoFijo, n, 1, "geometrica", vector<int>{1024, 2048, 4096, 8192, 16384, 32768});    // O(n²)  (de 1 en 1)
    // Las estructuras amortizadas: n operaciones seguidas cuestan O(n) en total (O(1) amortizado cada una).
    // (cada repetición hace muchas rondas de n operaciones: con n pequeño una sola ronda tarda menos que el propio cronómetro)
    medirCon("ArrayDinamico.agregar", [](int n) { return n; }, [](int& n) {
        long long copias = 0;
        for (int ronda = 0; ronda < 256; ronda++) {
            ArrayDinamico a;
            for (int i = 0; i < n; i++) {
                a.agregar(i);
            }
            copias += a.copias();
        }
        return copias;
    }, "geometrica", vector<int>{512, 1024, 2048, 4096, 8192});                                  // O(n)
    medirCon("ContadorBinario.incrementar", [](int n) { return n; }, [](int& n) {
        long long volteos = 0;
        for (int ronda = 0; ronda < 32; ronda++) {
            ContadorBinario c(64);
            for (int i = 0; i < n; i++) {
                c.incrementar();
            }
            volteos += c.volteos();
        }
        return volteos;
    }, "geometrica", vector<int>{1024, 2048, 4096, 8192, 16384, 32768});                           // O(n)
    medirCon("PilaMultipop.sacar", [](int n) { return n; }, [](int& n) {
        size_t sacados = 0;
        for (int ronda = 0; ronda < 32; ronda++) {
            PilaMultipop p;
            for (int i = 0; i < n; i++) {
                p.empujar(i);
                if (i % 100 == 99) {
                    p.sacar(60);
                }
            }
            sacados += p.sacar(n).size();
        }
        return sacados;
    }, "geometrica", vector<int>{1024, 2048, 4096, 8192, 16384, 32768});                                                                                            // O(n)
    medirCon("ColaAmortizada.desencolar", [](int n) { return n; }, [](int& n) {
        long long suma = 0;
        for (int ronda = 0; ronda < 32; ronda++) {
            ColaAmortizada c;
            for (int i = 0; i < n; i++) {
                c.encolar(i);
                if (i % 3 == 2) {
                    c.desencolar();
                }
            }
            while (c.tamano() > 0) {
                suma += c.desencolar();
            }
        }
        return suma;
    }, "geometrica", vector<int>{1024, 2048, 4096, 8192, 16384, 32768});                                                                                            // O(n)
}
