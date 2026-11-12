#include <algorithm>
#include <functional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 16 · Análisis amortizado y recurrencias
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 * Las recurrencias usan `noOptimizar` (viene con el playground) para que el compilador no sustituya el bucle de trabajo por una suma.
 */

/**
 * Clasificación con el teorema maestro.
 *
 * @complejidad Tiempo O(min(k, log_b a)); espacio O(1).
 * @explicacion Se compara `a` con `bᵏ` en enteros, multiplicando paso a paso. Como b ≥ 2, el producto solo crece: en cuanto supera a `a` se sabe que a < bᵏ
 * (domina la raíz) y se para sin llegar a bᵏ, que podría desbordar un long long. Antes de superarlo, p ≤ a ≤ 2³¹ y p·b ≤ 2⁶² cabe. Si el bucle acaba sin pasarse, a ≥ bᵏ:
 * igual → todos los niveles cuestan lo mismo (equilibrado); mayor → ganan las hojas. Con coma flotante, log₂(8)/log₂(2) podría dar 2,9999999 y la comparación
 * de igualdad fallaría.
 * @alternativas Con `pow` y `log` es más corto pero poco fiable en el caso de igualdad; con la forma general del teorema (f(n) = Θ(n^c log^j n)) hay más casos.
 */
string casoMaestro(int a, int b, int k)
{
    if (a < 1 || b < 2 || k < 0) {
        throw invalid_argument("casoMaestro: hace falta a ≥ 1, b ≥ 2 y k ≥ 0");
    }
    long long p = 1;
    for (int i = 0; i < k; i++) {
        p *= b;
        if (p > a) {
            return "raíz";
        }
    }
    if (p == a) {
        return "equilibrado";
    }
    return "hojas";
}

/**
 * T(n) = T(n-1) + n.
 *
 * @complejidad Tiempo O(n²); espacio O(n) de pila.
 * @explicacion Cada llamada con m > 0 hace un bucle de m pasos y una llamada con m-1: n niveles, el nivel i con n - i pasos, una suma aritmética n + (n-1) + … + 1 = n(n+1)/2.
 * `noOptimizar` en el bucle evita que el compilador lo reduzca a `trabajo += m` y colapse la recursión: así `medir` mide el trabajo de verdad. Restar 1 en lugar de dividir deja n niveles
 * en vez de log n, y por eso no es del tipo maestro.
 * @alternativas La fórmula n(n+1)/2 da el valor en O(1); aquí se ejecuta la recursión precisamente para ver su coste.
 * @bigo n2
 */
long long recurrenciaLineal(int n)
{
    if (n < 0) {
        throw invalid_argument("recurrenciaLineal: n no puede ser negativo");
    }
    auto t = [&](auto& self, int m) -> long long {
        if (m == 0) {
            return 0;
        }
        long long trabajo = 0;
        for (int paso = 0; paso < m; paso++) {
            trabajo++;
            noOptimizar(paso);
        }
        return trabajo + self(self, m - 1);
    };
    return t(t, n);
}

/**
 * T(n) = 2T(n/2) + n.
 *
 * @complejidad Tiempo O(n log n); espacio O(log n) de pila.
 * @explicacion Cada llamada con m ≥ 2 hace m pasos y dos llamadas con ⌊m/2⌋; con m = 1 hace un paso. El árbol tiene log₂ n + 1 niveles y cada nivel suma n (2ᵈ llamadas de tamaño n/2ᵈ), así que
 * T(n) = n log₂ n + n para n potencia de dos. Es el caso «equilibrado» del teorema maestro (a = bᵏ con a = 2, b = 2, k = 1) y la forma de mergesort. Las dos llamadas se hacen de verdad (no
 * una multiplicada por 2): el coste es el de recorrer todo el árbol.
 * @alternativas Con memoización de T(⌊m/2⌋) se calcularía el valor en O(log n), pero ese no es el coste del algoritmo que modela.
 * @bigo nlogn
 */
long long recurrenciaDividir(int n)
{
    if (n < 0) {
        throw invalid_argument("recurrenciaDividir: n no puede ser negativo");
    }
    auto t = [&](auto& self, int m) -> long long {
        if (m == 0) {
            return 0;
        }
        long long trabajo = 0;
        unsigned acumulador = 1;
        for (int paso = 0; paso < m; paso++) {
            acumulador = acumulador * 31 + static_cast<unsigned>(paso);      // un paso con algo de coste real (cadena de dependencias)
            noOptimizar(acumulador);
            trabajo++;
        }
        if (m == 1) {
            return trabajo;
        }
        long long izquierda = self(self, m / 2);
        long long derecha = self(self, m / 2);
        return trabajo + izquierda + derecha;
    };
    return t(t, n);
}

/**
 * T(n) = 2T(n/2) + 1.
 *
 * @complejidad Tiempo O(n); espacio O(log n) de pila.
 * @explicacion Mismo esqueleto que `recurrenciaDividir` pero con una unidad de trabajo por llamada. El nivel d tiene 2ᵈ nodos de coste 1, así que el trabajo se duplica en cada nivel y lo domina el último
 * (las n hojas): T(n) = 2n - 1 para n potencia de dos, el número de nodos de un árbol binario completo. Es el caso «hojas» del teorema maestro (a = 2 > bᵏ = 1). Cambiar solo el trabajo por nivel
 * (n frente a 1) pasa de n log n a n con exactamente el mismo patrón de llamadas.
 * @alternativas Es también el coste de recorrer un árbol binario de n hojas o de buscar el máximo de un array dividiéndolo en mitades: no mejora el bucle simple, que es O(n) con menos pila.
 * @bigo n
 */
long long recurrenciaHojas(int n)
{
    if (n < 0) {
        throw invalid_argument("recurrenciaHojas: n no puede ser negativo");
    }
    auto t = [&](auto& self, int m) -> long long {
        if (m == 0) {
            return 0;
        }
        long long trabajo = 1;
        noOptimizar(trabajo);
        if (m == 1) {
            return trabajo;
        }
        long long izquierda = self(self, m / 2);
        long long derecha = self(self, m / 2);
        return trabajo + izquierda + derecha;
    };
    return t(t, n);
}

/**
 * Contador binario con volteos contados.
 *
 * @complejidad `incrementar` O(bits) en el peor caso y O(1) amortizado: n incrementos cuestan menos de 2n volteos; espacio O(bits).
 * @explicacion Un incremento pone a 0 los unos finales y enciende el primer cero. El bit i se voltea una vez cada 2ⁱ incrementos, luego n incrementos voltean n + n/2 + n/4 + … < 2n
 * bits (método agregado; sin desborde, exactamente 2n - popcount(n)). Con el método potencial, Φ = número de unos: un incremento con t unos a 0 cuesta t + 1 y cambia Φ en 1 - t, de modo que el coste
 * amortizado es 2. Al desbordar, todos los bits pasan a 0 y también cuentan como volteos.
 * @alternativas Un contador de Gray cambia exactamente un bit por incremento (coste O(1) en el peor caso), pero el valor no se lee directamente.
 * @bigo n
 */
struct ContadorBinario {
    explicit ContadorBinario(int bits = 32) : bits_(static_cast<size_t>(max(bits, 1)), 0)
    {
        if (bits < 1 || bits > 64) {
            throw invalid_argument("ContadorBinario: los bits deben estar entre 1 y 64");
        }
    }

    int incrementar()
    {
        int volteos = 0;
        size_t i = 0;
        while (i < bits_.size() && bits_[i] == 1) {
            bits_[i] = 0;
            volteos++;
            i++;
        }
        if (i < bits_.size()) {
            bits_[i] = 1;
            volteos++;
        }
        total_ += volteos;
        return volteos;
    }

    unsigned long long valor() const
    {
        unsigned long long v = 0;
        for (size_t i = bits_.size(); i-- > 0;) {
            v = (v << 1) | static_cast<unsigned long long>(bits_[i]);
        }
        return v;
    }

    long long volteos() const { return total_; }

private:
    vector<char> bits_;
    long long total_ = 0;
};

/**
 * Array dinámico que dobla su capacidad.
 *
 * @complejidad `agregar` O(n) en el peor caso y O(1) amortizado; `get` O(1); espacio O(n).
 * @explicacion Cuando el tamaño iguala la capacidad se crea un array del doble y se copian los `tamano` elementos. Tras n inserciones, las copias son 1 + 2 + 4 + … + 2ᵏ = 2ᵏ⁺¹ - 1 con 2ᵏ < n,
 * es decir, siempre menos de 2n (método agregado). Con el método contable, cada inserción cobra 3 monedas: una para escribir, otra para su propia copia futura y otra para la copia de un elemento
 * que ya estaba. Crecer sumando una constante en vez de multiplicar sería Θ(n²). Se guarda un vector del tamaño de la capacidad y se copia a mano; no se usa `push_back` porque ocultaría el crecimiento.
 * @alternativas Un factor 1,5 (como Java o MSVC) gasta menos memoria y reutiliza bloques liberados, con más copias (3n en vez de 2n).
 * @bigo n
 */
struct ArrayDinamico {
    void agregar(int x)
    {
        if (n_ == datos_.size()) {
            vector<int> nuevo(datos_.size() * 2);
            copy(datos_.begin(), datos_.begin() + static_cast<long>(n_), nuevo.begin());
            copias_ += static_cast<long long>(n_);
            datos_.swap(nuevo);
        }
        datos_[n_++] = x;
    }

    int get(size_t i) const
    {
        if (i >= n_) {
            throw out_of_range("ArrayDinamico::get: índice fuera de rango");
        }
        return datos_[i];
    }

    size_t tamano() const { return n_; }

    size_t capacidad() const { return datos_.size(); }

    long long copias() const { return copias_; }

private:
    vector<int> datos_ = vector<int>(1);
    size_t n_ = 0;
    long long copias_ = 0;
};

/**
 * Copias con crecimiento aritmético.
 *
 * @complejidad Tiempo O(n² / incremento); espacio O(n).
 * @explicacion Se crece solo cuando el tamaño iguala la capacidad: en los tamaños 0, inc, 2·inc, … Cada crecimiento crea un vector con `incremento` casillas más y copia `tamano` elementos de verdad (el
 * `noOptimizar` impide que el compilador elimine la copia, cuyo resultado nunca se lee). El total es inc · (0 + 1 + … + ⌊(n-1)/inc⌋) ≈ n² / (2·inc): cuadrático. Multiplicar la capacidad por un
 * factor, en cambio, da una serie geométrica y Θ(n): por eso `vector` dobla.
 * @alternativas Calcular la suma con la fórmula es O(1) pero no cronometra nada: se pierde la lección.
 * @bigo n2
 */
long long copiasCrecimientoFijo(int n, int incremento)
{
    if (n < 0 || incremento < 1) {
        throw invalid_argument("copiasCrecimientoFijo: hace falta n ≥ 0 e incremento ≥ 1");
    }
    vector<int> datos;
    size_t tamano = 0;
    long long copias = 0;
    for (int i = 0; i < n; i++) {
        if (tamano == datos.size()) {
            vector<int> nuevo(datos.size() + static_cast<size_t>(incremento));
            copy(datos.begin(), datos.begin() + static_cast<long>(tamano), nuevo.begin());
            copias += static_cast<long long>(tamano);
            datos.swap(nuevo);
            noOptimizar(datos.data());
        }
        datos[tamano++] = i;
    }
    return copias;
}

/**
 * Pila con multipop.
 *
 * @complejidad `empujar` O(1); `sacar(k)` O(min(k, n)) en el peor caso, O(1) amortizado; espacio O(n).
 * @explicacion Cada elemento se saca como máximo una vez después de empujarse, así que sacados ≤ empujados y el trabajo total ≤ 2 · empujados (método agregado). Con potencial Φ = tamaño de la pila: empujar
 * cuesta 1 y sube Φ en 1 (amortizado 2); sacar s elementos cuesta s y baja Φ en s (amortizado 0). Por eso cualquier secuencia de m operaciones cuesta a lo sumo 2m, aunque un `sacar` suelto sea O(n).
 * `trabajo_` cuenta empujados + sacados; sacar en vacío no suma nada.
 * @alternativas Si `sacar` hiciera trabajo extra por elemento (por ejemplo, recorrerlo), el potencial tendría que subir en consecuencia para que la cota siguiera valiendo.
 * @bigo n
 */
struct PilaMultipop {
    void empujar(int x)
    {
        datos_.push_back(x);
        trabajo_++;
    }

    int cima() const
    {
        if (datos_.empty()) {
            throw out_of_range("PilaMultipop::cima: la pila está vacía");
        }
        return datos_.back();
    }

    size_t tamano() const { return datos_.size(); }

    vector<int> sacar(int k)
    {
        if (k < 0) {
            throw invalid_argument("PilaMultipop::sacar: k no puede ser negativo");
        }
        vector<int> sacados;
        while (k > 0 && !datos_.empty()) {
            sacados.push_back(datos_.back());
            datos_.pop_back();
            trabajo_++;
            k--;
        }
        return sacados;
    }

    long long trabajo() const { return trabajo_; }

private:
    vector<int> datos_;
    long long trabajo_ = 0;
};

/**
 * Cola con dos pilas.
 *
 * @complejidad `encolar` O(1); `desencolar` y `frente` O(n) en el peor caso, O(1) amortizado; espacio O(n).
 * @explicacion `entrada_` recibe los elementos; `salida_` los entrega. Solo cuando `salida_` está vacía se traslada toda `entrada_` sacando de una y metiendo en la otra, lo que invierte el orden y deja el más
 * antiguo arriba. Cada elemento pasa de una pila a otra como máximo una vez, así que los traslados totales ≤ elementos encolados: potencial Φ = tamaño de `entrada_` (cada encolado deja una moneda para su traslado).
 * Una sola operación puede ser cara (1000 encolar y un desencolar trasladan 1000), pero n operaciones cuestan O(n). Trasladar en cada desencolar rompería la cota.
 * @alternativas Una cola circular sobre un array (anillo) da O(1) en el peor caso sin amortizar; la de dos pilas es útil cuando solo hay pilas, y como ejercicio para ver el potencial.
 * @bigo n
 */
struct ColaAmortizada {
    void encolar(int x) { entrada_.push_back(x); }

    int desencolar()
    {
        preparar();
        int x = salida_.back();
        salida_.pop_back();
        return x;
    }

    int frente()
    {
        preparar();
        return salida_.back();
    }

    size_t tamano() const { return entrada_.size() + salida_.size(); }

    long long traslados() const { return traslados_; }

private:
    vector<int> entrada_;
    vector<int> salida_;
    long long traslados_ = 0;

    void preparar()
    {
        if (salida_.empty()) {
            while (!entrada_.empty()) {
                salida_.push_back(entrada_.back());
                entrada_.pop_back();
                traslados_++;
            }
        }
        if (salida_.empty()) {
            throw out_of_range("ColaAmortizada: la cola está vacía");
        }
    }
};
