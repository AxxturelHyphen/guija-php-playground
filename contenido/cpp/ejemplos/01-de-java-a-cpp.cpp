#include <algorithm>
#include <climits>
#include <cstdint>
#include <functional>
#include <iostream>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <unordered_map>
#include <variant>
#include <vector>
using namespace std;

/*
 * TEMA 1 · DE JAVA, PHP Y PYTHON A C++
 * ────────────────────────────────────────────────────────────────────────────
 * Sabes programar. Aquí aprendes lo que es DISTINTO en C++, que es el lenguaje con el que se
 * resuelven problemas de algoritmia: rápido, sin máquina virtual y sin recolector de basura. A cambio,
 * el compilador confía en que sabes lo que haces: si te equivocas no siempre te avisa.
 *
 * CÓMO SE EJECUTA C++ (nada que ver con Java, PHP o Python)
 *   código .cpp ──► PREPROCESADOR ──► COMPILADOR ──► ENLAZADOR ──► binario nativo ──► se ejecuta
 *   1. Preprocesador: sustituye texto. `#include <vector>` PEGA el contenido de esa cabecera; `#define` hace
 *      sustituciones. Aún no entiende C++, solo copia y pega.
 *   2. Compilador: traduce a código máquina y comprueba tipos. Aquí salen los errores de compilación.
 *   3. Enlazador: une tu código con la biblioteca estándar (el «Linker error»: «undefined reference»).
 *   4. El resultado es un programa del sistema operativo. No hay intérprete ni JVM: la CPU lo ejecuta tal cual,
 *      y por eso un `a[i]` fuera de rango NO lanza ninguna excepción: lee la memoria que haya ahí.
 *   El playground hace los 4 pasos por ti (g++ -std=c++20 -Wall -Wextra -Wshadow):
 *     · «Ejecutar» (Ctrl+Enter) compila en MODO COMPROBADO: -O1 con sanitizers (ASan + UBSan), que detienen el
 *       programa y te dicen la línea si lees fuera de un vector, desbordas un int con signo, usas memoria liberada...
 *     · «Medir» compila con -O2 y SIN comprobaciones, como en un concurso: así se mide el coste real.
 *   Tu archivo no incluye `pg.hpp` ni las funciones prueba/comprueba/medir: el playground las añade solo.
 *
 * COMPORTAMIENTO INDEFINIDO (UB, «undefined behavior») = LA idea que Java/PHP/Python no tienen
 *   Si haces algo que el estándar prohíbe (desbordar un int, salirte de un array, usar un puntero muerto, dividir
 *   por 0), el programa NO está obligado a fallar: puede dar un resultado raro, funcionar «de casualidad» hoy y
 *   romperse mañana, o que el compilador optimice asumiendo que eso no ocurre jamás. En Java siempre pasa algo
 *   definido (excepción o wrap-around); aquí no. Regla de oro: PREVÉN los casos límite, no esperes un error.
 *
 * Lo que vas a ver (ejecuta y lee la salida junto al código):
 *   1 Variables y tipos · 2 Strings y E/S · 3 vector, map, set · 4 Funciones: valor, & y const& · 5 Lambdas
 *   6 Clases · 7 Interfaces y herencia · 8 Mixins · 9 enum class · 10 struct · 11 == · 12 Punteros, pila y heap, optional
 *   13 Excepciones · 14 Plantillas · 15 C++ moderno · y qué cambia respecto a C.
 *
 * Cómo se trabaja:
 *   1. Ctrl+Enter ejecuta el archivo: verás la teoría y las pruebas de los ejercicios en «Pendiente».
 *   2. Sustituye los `return pendiente();` por tu código y vuelve a ejecutar.
 *   3. Ctrl+S guarda tu copia en practicas/ (este ejemplo no se modifica).
 *   4. Cuando acabes (o te atasques) abre la pestaña «Solución» y compárala con la tuya.
 */

void titulo(const string& texto) {
    cout << "\n=== " << texto << " ===\n";
}

/** Imprime un vector como [1, 2, 3]: el cout de C++ no sabe imprimir contenedores (Java sí, con toString). */
string texto(const vector<int>& v) {
    string s = "[";
    for (size_t i = 0; i < v.size(); i++) {
        s += (i ? ", " : "") + to_string(v[i]);
    }
    return s + "]";
}

// ── Piezas de teoría que main usa más abajo (C++ exige declarar ANTES de usar) ─────────────────────────────────

// Sección 4: tres formas de pasar un parámetro.
int porValor(int x) {          // x es una COPIA: cambiarla no afecta al que llama (como en Java con int)
    x += 100;
    return x;
}
void porReferencia(int& x) {   // x ES la variable original con otro nombre (Java no puede hacer esto con int)
    x += 100;
}
int sumaTodo(const vector<int>& v) {   // const&: sin copiar el vector y sin poder modificarlo (lo normal para leer)
    int total = 0;
    for (int x : v) {
        total += x;
    }
    return total;
}
vector<int> copiaYAñade(vector<int> v) {   // por VALOR: el vector entero se copia (O(n))... y aquí es lo que queremos
    v.push_back(99);
    return v;
}
pair<int, int> minimoYMaximo(const vector<int>& v) {   // devolver varios valores: pair / tuple / struct
    return {*min_element(v.begin(), v.end()), *max_element(v.begin(), v.end())};
}
int potencia(int base, int exponente = 2) {   // argumentos por defecto (solo al final); también hay sobrecarga
    int r = 1;
    for (int i = 0; i < exponente; i++) {
        r *= base;
    }
    return r;
}
double potencia(double base, int exponente) {   // sobrecarga: mismo nombre, tipos distintos (como en Java)
    double r = 1;
    for (int i = 0; i < exponente; i++) {
        r *= base;
    }
    return r;
}

// Sección 6: una clase. `struct` y `class` son lo mismo salvo que struct es público por defecto y class, privado.
class Contador {
    int cuenta_;       // convención habitual: guion bajo al final para campos privados
    string nombre_;

public:
    // Lista de inicialización (después de «:»): construye los campos DIRECTAMENTE. En Java/PHP asignas en el cuerpo.
    Contador(string nombre, int inicio = 0) : cuenta_(inicio), nombre_(move(nombre)) {}
    ~Contador() {      // destructor: se llama SOLO al salir del ámbito, de forma determinista (no hay GC)
        if (cuenta_ < 0) {
            cout << "(destructor de " << nombre_ << ")\n";
        }
    }
    void incrementar() { cuenta_++; }
    int valor() const { return cuenta_; }   // `const` tras los paréntesis: promete no modificar el objeto
    const string& nombre() const { return nombre_; }
    static int creados;                       // static: uno para toda la clase
};
int Contador::creados = 0;

// Sección 7: «interfaz» = clase abstracta con métodos virtuales puros (= 0). No existe la palabra interface.
class Forma {
public:
    virtual ~Forma() = default;               // DESTRUCTOR VIRTUAL: imprescindible si se borra a través de la base
    virtual double area() const = 0;          // = 0 → abstracto: obliga a las hijas a implementarlo
    virtual string nombre() const { return "forma"; }   // virtual con implementación: se puede sobrescribir
};
class Cuadrado : public Forma {
    double lado_;

public:
    explicit Cuadrado(double lado) : lado_(lado) {}   // explicit: evita conversiones implícitas double → Cuadrado
    double area() const override { return lado_ * lado_; }   // override: el compilador comprueba que sobrescribes algo
    string nombre() const override { return "cuadrado"; }
};
class Circulo : public Forma {
    double r_;

public:
    explicit Circulo(double r) : r_(r) {}
    double area() const override { return 3.0 * r_ * r_; }   // 3.0 y no π, para que los números salgan redondos
};

// Sección 8: «traits» ≈ mixins por herencia múltiple (C++ permite heredar de varias clases).
class Etiquetable {
    string etiqueta_;

public:
    void etiquetar(string e) { etiqueta_ = move(e); }
    const string& etiqueta() const { return etiqueta_; }
};
class Producto : public Etiquetable {   // Producto «usa» el mixin Etiquetable
public:
    string nombre;
    explicit Producto(string n) : nombre(move(n)) {}
};

// Sección 9: enum class = enumeración fuerte (no se convierte sola a int y sus nombres no «contaminan» el ámbito).
enum class Dia { Lunes, Martes, Sabado, Domingo };
string aTexto(Dia d) {   // no hay toString() gratis ni Dia.values(): lo escribes tú
    switch (d) {
        case Dia::Lunes: return "lunes";
        case Dia::Martes: return "martes";
        case Dia::Sabado: return "sábado";
        case Dia::Domingo: return "domingo";
    }
    return "?";
}
bool esFinDeSemana(Dia d) { return d == Dia::Sabado || d == Dia::Domingo; }

// Sección 10: struct = el «record» de C++ (datos públicos y poco más). El == y el < se piden con `= default` (C++20).
struct Punto {
    int x = 0;
    int y = 0;
    bool operator==(const Punto&) const = default;
    auto operator<=>(const Punto&) const = default;   // da <, >, <=, >= comparando campo a campo
};

// Sección 14: plantilla de función y de clase (los «genéricos»; pero se resuelven al COMPILAR, no se borran).
template <typename T>
T mayor(const T& a, const T& b) {
    return a < b ? b : a;
}
template <typename T>
class Pila {
    vector<T> datos_;

public:
    void apilar(T x) { datos_.push_back(move(x)); }
    T desapilar() {
        if (datos_.empty()) {
            throw out_of_range("pila vacía");
        }
        T x = move(datos_.back());
        datos_.pop_back();
        return x;
    }
    bool vacia() const { return datos_.empty(); }
    size_t tamaño() const { return datos_.size(); }
};

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS (solo C++: los fallos típicos del lenguaje, en pequeño)
// ════════════════════════════════════════════════════════════════════════════
// Sustituye cada `return pendiente();` por tu código. Mantén las firmas: las pruebas las usan.

// ── Ejercicio 1 · intercambiar (referencias) ────────────────────────────────
/**
 * Intercambia los valores de a y b. Los parámetros son REFERENCIAS (int&): modificas las variables del que llama.
 * Pista: una variable temporal. (La biblioteca ya trae std::swap; escríbelo tú una vez.)
 * Trampa: con `int a, int b` (por valor) intercambiarías copias y fuera no cambiaría nada.
 */
void intercambiar(int& a, int& b) {
    pendiente();
}

// ── Ejercicio 2 · sumaSinDesbordar (long long) ──────────────────────────────
/**
 * Suma dos int sin que se desborde: INT_MAX + 1 con int es UB (comportamiento indefinido), no «da la vuelta».
 * Devuelve el resultado correcto aunque no quepa en un int (por eso devuelve long long, 64 bits).
 * Pista: convierte ANTES de sumar: `(long long)a + b`. Si conviertes después de `a + b`, ya es tarde.
 */
long long sumaSinDesbordar(int a, int b) {
    return pendiente();
}

// ── Ejercicio 3 · contarVocales (const string&) ─────────────────────────────
/**
 * Cuenta las vocales (a, e, i, o, u, mayúsculas o minúsculas) de un texto ASCII.
 * Pista: recorre con `for (char c : s)` y pasa a minúscula con tolower. La cadena llega por const& (sin copiarla).
 * Trampa: los acentos ocupan 2 bytes en UTF-8; aquí solo se cuentan las vocales sin tilde.
 */
int contarVocales(const string& s) {
    return pendiente();
}

// ── Ejercicio 4 · invertirEnSitio (vector<int>&) ────────────────────────────
/**
 * Da la vuelta al vector SIN crear otro: intercambia el primero con el último, el segundo con el penúltimo...
 * Pista: dos índices, i desde el principio y j = size() - 1 - i; para cuando se crucen. Cuesta O(n) y O(1) de memoria.
 * Trampa: `v.size() - 1` con el vector vacío vale 18446744073709551615 (size_t no tiene negativos).
 */
void invertirEnSitio(vector<int>& v) {
    pendiente();
}

// ── Ejercicio 5 · maximo (const vector<int>&) ───────────────────────────────
/**
 * Devuelve el mayor elemento, o nullopt si el vector está vacío (por eso el tipo es optional<int>: no hay null ni
 * -1 mágico que confundir con un dato real).
 * Pista: parte de v[0] y recorre el resto. Cuesta O(n).
 */
optional<int> maximo(const vector<int>& v) {
    pendiente();
    return nullopt;
}

// ── Ejercicio 6 · penultimo (size_t) ────────────────────────────────────────
/**
 * Devuelve el penúltimo elemento, o nullopt si hay menos de 2.
 * Trampa clásica: `v.size() - 2` es UNSIGNED. Con 0 o 1 elementos no vale -1 ni -2: da un número gigantesco
 * y `v[ese número]` lee memoria ajena. Comprueba el tamaño ANTES de restar.
 */
optional<int> penultimo(const vector<int>& v) {
    pendiente();
    return nullopt;
}

// ════════════════════════════════════════════════════════════════════════════
// main: la teoría ejecutable y, al final, las pruebas
// ════════════════════════════════════════════════════════════════════════════
int main() {
    // ─────────────────────────────────────────────────────────────────────────────
    titulo("1. Variables y tipos");
    // C++ es de tipado ESTÁTICO como Java, pero los tipos básicos NO tienen un tamaño garantizado igual en todas las máquinas.
    // Java: int edad = 30;   PHP: $edad = 30;   Python: edad = 30
    int edad = 30;
    double precio = 9.99;
    bool activo = true;
    char letra = 'A';        // char = UN byte (un número pequeño); 'A' con comillas simples. "A" con dobles es otra cosa
    cout << "int " << sizeof(int) << " bytes, long long " << sizeof(long long) << ", double " << sizeof(double)
         << ", char " << sizeof(char) << ", bool " << sizeof(bool) << ", size_t " << sizeof(size_t) << "\n";
    cout << edad << " " << precio << " " << activo << " " << letra << "\n";   // bool se imprime 1/0 (boolalpha lo cambia)

    // RANGOS. int suele tener 32 bits: de -2 147 483 648 a 2 147 483 647. long long, 64 bits: ~9,2·10^18.
    // Desde Java: allí int y long tienen tamaño fijo; en C++ `long` puede ser 32 o 64 bits según el sistema: usa `long long`.
    cout << "INT_MAX = " << INT_MAX << ", long long max = " << numeric_limits<long long>::max() << "\n";

    // size_t = entero SIN signo del tamaño de un puntero. Lo devuelven .size(), .length(), sizeof y find (npos).
    // Trampa nº 1 de C++: restar con unsigned. 0 - 1 no es -1:
    size_t vacio = 0;
    cout << "size_t 0 - 1 = " << vacio - 1 << "  (unsigned da la vuelta: está DEFINIDO, pero casi nunca es lo que quieres)\n";
    // DESBORDAMIENTO: con tipos CON signo (int, long long) es UB: el compilador puede suponer que no ocurre jamás.
    //     int boom = INT_MAX; boom++;     // ← UB. En Java daría -2147483648; aquí NO se promete nada.
    // Con tipos sin signo (unsigned, size_t) sí está definido: da la vuelta (módulo 2^n).
    // Cómo evitarlo: calcula en un tipo más ancho, o comprueba antes:
    long long ancho = (long long)INT_MAX + 1;   // se convierte ANTES de sumar → 2147483648
    int resultado = 0;
    bool desborda = __builtin_add_overflow(INT_MAX, 1, &resultado);   // extensión de GCC/Clang: dice si hubo desbordamiento
    cout << "INT_MAX + 1 en long long = " << ancho << ", ¿desborda un int? " << (desborda ? "sí" : "no") << "\n";
    // Trampa nº 2: la división entera trunca hacia 0 y % puede salir negativo (igual que en Java, distinto de Python).
    cout << "7 / 2 = " << 7 / 2 << ", -7 / 2 = " << -7 / 2 << ", -7 % 3 = " << -7 % 3 << ", 7 / 2.0 = " << 7 / 2.0 << "\n";

    // auto: el compilador deduce el tipo. Java: var;  PHP/Python: no hace falta. No es tipado dinámico: sigue fijo.
    auto doble = 2 * precio;        // double
    auto contador = 0;              // int; si quieres otro tipo: 0LL (long long), 0u (unsigned), 0.0 (double)
    cout << "auto: " << doble << " " << contador << "\n";
    // Inicialización con llaves: PROHÍBE las conversiones que pierden datos (int x{3.5}; no compila). Úsala cuando puedas.
    int estrecho{7};
    // const = no se puede modificar (≈ final de Java). constexpr = el valor se conoce AL COMPILAR (≈ static final real).
    const int maximoIntentos = 3;
    constexpr int TAMAÑO = 8;
    int tabla[TAMAÑO] = {};         // arrays de C: tamaño fijo, sin .size(); en DSA usa vector o array<T, N>
    cout << maximoIntentos << " " << TAMAÑO << " " << sizeof(tabla) / sizeof(tabla[0]) << " " << estrecho << "\n";
    // Desde C: igual de tipado, pero C++ añade bool de verdad, auto, referencias, string y contenedores que se
    // redimensionan solos. `NULL` y `malloc` casi nunca: nullptr y vector/unique_ptr.
    // El valor de una variable local SIN inicializar es BASURA (UB leerla): int x; cout << x; ← no lo hagas.
    // Un `__cplusplus` te dice el estándar con el que se compila:
    cout << "estándar: " << __cplusplus << " (202002 = C++20)\n";

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("2. Strings y entrada/salida");
    // std::string es un objeto MUTABLE que se COPIA al asignarlo (en Java es inmutable y se comparte la referencia).
    // Java: "Hola " + nombre   →   C++: "Hola " + nombre solo si uno de los dos es string (los literales "..." son const char*)
    string nombre = "Ana";
    string saludo = "Hola " + nombre + "!";
    saludo += " Qué tal";
    cout << saludo << " | longitud " << saludo.size() << "\n";
    string copia = nombre;          // copia independiente
    copia[0] = 'E';                 // mutable (Java: imposible)
    cout << nombre << " " << copia << "\n";
    // "año" ocupa 4 bytes en UTF-8: size() cuenta BYTES, no letras (como strlen en PHP). Para algoritmia, ASCII y listo.
    cout << "'año' tiene size() = " << string("año").size() << "\n";
    // Búsqueda: find devuelve la POSICIÓN o string::npos (el size_t más grande). Nunca -1 ni null.
    size_t pos = saludo.find("Qué");
    cout << "find: " << pos << ", find de algo que no está == npos: " << (saludo.find("zzz") == string::npos) << "\n";
    cout << saludo.substr(0, 4) << "|" << to_string(42) + "!" << "|" << stoi("123") + 1 << "\n";   // stoi lanza si no es número
    string_view vista = saludo;     // una «ventana» de solo lectura sin copiar (cuidado: no puede vivir más que el string)
    cout << vista.substr(5, 3) << "\n";
    // cout/cin: flujos. `<<` encadena; '\n' es más rápido que endl (endl además vacía el búfer).
    // cin >> x lee una palabra/número separado por espacios; getline(cin, linea) lee una línea entera. Aquí simulamos
    // la entrada con un istringstream, que funciona igual (en un concurso sería cin):
    istringstream entrada("3\n10 20 30\nhola mundo\n");
    int cuantos = 0;
    entrada >> cuantos;
    vector<int> leidos(cuantos);
    for (int& x : leidos) {
        entrada >> x;
    }
    string resto;
    getline(entrada, resto);        // consume el final de la línea anterior
    getline(entrada, resto);
    cout << "leído: " << texto(leidos) << " y «" << resto << "»\n";
    // En concursos: ios::sync_with_stdio(false); cin.tie(nullptr); acelera cin/cout muchísimo con entradas grandes.
    // Formato (no hay String.format ni f-strings): ostringstream o printf. C++20 trae std::format pero no todos los compiladores.
    ostringstream formato;
    formato << nombre << " cuesta " << precio << " €";
    cout << formato.str() << "\n";

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("3. vector, map y set (no hay un 'array' mágico)");
    // vector<T> = ArrayList<T> / array de PHP / list de Python. Los elementos están JUNTOS en memoria (muy rápido).
    // Java: List<Integer> v = new ArrayList<>(List.of(3, 1, 2));
    vector<int> v = {3, 1, 2};
    v.push_back(5);                 // amortizado O(1)
    cout << v.size() << " elementos, v[0] = " << v[0] << ", último = " << v.back() << "\n";
    // v[i] NO comprueba el rango (UB si i >= size()). v.at(i) sí: lanza out_of_range. En el modo comprobado del playground
    // el sanitizer te avisa; en un concurso, no.
    try {
        cout << v.at(10);
    } catch (const out_of_range& e) {
        cout << "at(10) lanza out_of_range\n";
    }
    // COPIA: a diferencia de Java (referencias), asignar un vector COPIA todos sus elementos (como los arrays de PHP).
    vector<int> otro = v;
    otro[0] = 99;
    cout << "original " << texto(v) << " copia " << texto(otro) << "\n";
    // Ordenar: sort(inicio, fin) usa iteradores (≈ punteros al elemento). O(n log n). Comparador = lambda.
    sort(v.begin(), v.end());
    sort(v.begin(), v.end(), [](int a, int b) { return a > b; });   // descendente
    cout << "descendente " << texto(v) << "\n";
    // Recorrer: por valor copia cada elemento; usa const auto& para no copiar objetos grandes.
    int suma = 0;
    for (const auto& x : v) {
        suma += x;
    }
    cout << "suma " << suma << "\n";
    // TRAMPA: añadir (push_back) mientras recorres con iteradores o con for-range INVALIDA los iteradores: UB.
    // vector<vector<int>> es una matriz: vector<vector<int>> m(3, vector<int>(4, 0));  // 3 filas × 4 columnas a 0
    vector<vector<int>> matriz(3, vector<int>(4, 0));
    matriz[1][2] = 7;
    cout << "matriz " << matriz.size() << "x" << matriz[0].size() << ", [1][2] = " << matriz[1][2] << "\n";

    // map<K,V> = TreeMap (ORDENADO por clave, O(log n)). unordered_map = HashMap (O(1) de media, sin orden).
    // set / unordered_set igual. En DSA: unordered_map si no importa el orden.
    map<string, int> edades = {{"Ana", 30}, {"Luis", 25}};
    edades["Marta"] = 41;           // [] INSERTA la clave con valor 0 si no existía (¡aunque solo la leas!)
    cout << "edades[Pepe] crea la clave: " << edades["Pepe"] << ", ahora hay " << edades.size() << " claves\n";
    if (edades.count("Luis")) {     // count/contains = containsKey (C++20: edades.contains("Luis"))
        cout << "Luis tiene " << edades.at("Luis") << "\n";
    }
    for (const auto& [clave, valor] : edades) {   // «structured binding»: desempaqueta el par clave/valor
        cout << clave << "=" << valor << " ";
    }
    cout << "\n";
    unordered_map<char, int> frecuencia;
    for (char c : string("abracadabra")) {
        frecuencia[c]++;            // aquí el [] que inserta 0 es justo lo que queremos
    }
    cout << "a aparece " << frecuencia['a'] << " veces\n";
    set<int> unicos = {5, 1, 5, 3, 1};
    cout << "set ordenado y sin repetidos: ";
    for (int x : unicos) {
        cout << x << " ";
    }
    cout << "\n";

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("4. Funciones: por valor, por referencia y por const&");
    // Orden: una función debe estar DECLARADA antes de usarla (por eso todo está arriba y main al final).
    // Java pasa SIEMPRE por valor (de la referencia). C++ te deja elegir y por defecto COPIA TODO.
    int valorN = 5;
    cout << "por valor: " << porValor(valorN) << ", valorN sigue valiendo " << valorN << "\n";
    porReferencia(valorN);
    cout << "por referencia: valorN vale ahora " << valorN << "\n";
    // Regla práctica: tipos pequeños (int, double, char, bool) por valor. Objetos que solo lees (vector, string): const T&.
    // Objetos que modificas: T&. Objetos que te quedas / devuelves: por valor (+ move, ver tema 2).
    vector<int> datos = {4, 8, 15};
    cout << "const&: " << sumaTodo(datos) << ", valor: " << texto(copiaYAñade(datos)) << ", datos intacto " << texto(datos) << "\n";
    // REFERENCIA (T&) frente a PUNTERO (T*):
    //   referencia: otro nombre de algo que YA existe; no puede ser nula ni cambiar de destino; se usa como una variable normal.
    //   puntero: guarda una DIRECCIÓN; puede ser nullptr, reasignarse y hace falta *p para llegar al valor (o p->campo).
    // Regla: prefiere referencias en parámetros; punteros solo cuando «no hay objeto» (nullptr) tiene sentido. Ver sección 12.
    int& alias = valorN;           // alias ES valorN
    alias = 7;
    int* p = &valorN;            // &valorN = dirección de valorN
    *p += 1;                        // *p = lo que hay en esa dirección
    cout << "alias/puntero: valorN = " << valorN << "\n";
    auto [minimo, maximoDato] = minimoYMaximo(datos);   // devolver varios valores y desempaquetarlos
    cout << "min " << minimo << " max " << maximoDato << ", potencia(3) = " << potencia(3) << ", potencia(2.5, 2) = " << potencia(2.5, 2) << "\n";
    // No hay varargs cómodos: usa initializer_list, vector o plantillas variádicas (tema 2). No hay argumentos con nombre.
    // Devolver una referencia a una variable LOCAL es UB (la variable muere al salir): devuelve por valor.

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("5. Lambdas y capturas");
    // Java: x -> x * 2    PHP: fn($x) => $x * 2    Python: lambda x: x * 2
    auto doblar = [](int x) { return x * 2; };
    cout << "doblar(21) = " << doblar(21) << "\n";
    // Los corchetes dicen QUÉ variables de fuera ve la lambda y CÓMO:
    //   []     nada      [=]  copia de todo lo que use      [&]  referencia a todo      [x]  copia de x      [&x]  referencia a x
    // Java exige variables «efectivamente final» (como si fuera [=]); C++ deja capturar por referencia y modificar.
    int factor = 10;
    int llamadas = 0;
    auto escalar = [factor, &llamadas](int x) {   // factor se copia; llamadas se comparte con fuera
        llamadas++;
        return x * factor;
    };
    factor = 999;                   // la lambda guardó el 10 original
    cout << escalar(4) << " " << escalar(5) << " en " << llamadas << " llamadas\n";
    // `mutable` permite modificar la COPIA interna: auto c = [k = 0]() mutable { return ++k; };
    auto contar = [k = 0]() mutable { return ++k; };
    cout << "contador interno: " << contar() << contar() << contar() << "\n";
    // Parámetros `auto` (lambda genérica) y std::function para guardarlas con un tipo concreto:
    auto sumar = [](auto a, auto b) { return a + b; };
    function<int(int)> operacion = doblar;   // function<tipoRetorno(tiposParametros)>: más lento que auto, pero es un tipo
    cout << sumar(1, 2) << " " << sumar(1.5, 2.5) << " " << operacion(8) << "\n";
    // TRAMPA: [&] guarda REFERENCIAS. Si devuelves o guardas la lambda y la variable ya murió, es una referencia colgante (UB).
    // Con sort: sort(v.begin(), v.end(), [&](int a, int b) { return peso[a] < peso[b]; });  // comparador con datos de fuera

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("6. Clases: constructor, destructor y const");
    // Java: new Contador("visitas") en el heap, con GC.  C++: el objeto vive en la PILA y muere al cerrar la llave.
    {
        Contador visitas("visitas", 10);
        visitas.incrementar();
        Contador::creados++;
        cout << visitas.nombre() << " = " << visitas.valor() << " (creados " << Contador::creados << ")\n";
        Contador negativo("negativo", -5);   // este imprimirá al destruirse
    }                               // ← aquí se llaman los destructores (en orden INVERSO al de creación)
    cout << "(fin del bloque: los objetos locales ya se destruyeron)\n";
    // Esto es RAII («Resource Acquisition Is Initialization»): el objeto es dueño del recurso y lo libera en su destructor.
    // Por eso en C++ moderno casi no se escribe delete ni close(): vector, string, unique_ptr, ifstream... lo hacen solos.
    // Copiar un objeto copia sus campos (Java: copiaría la referencia). Los métodos que no modifican llevan `const`.
    Contador a("a", 1);
    Contador b = a;                 // COPIA independiente
    b.incrementar();
    cout << "a=" << a.valor() << " b=" << b.valor() << "\n";

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("7. Interfaces, abstract y herencia");
    // Para que haya polimorfismo hay que usar PUNTEROS o REFERENCIAS a la base y métodos `virtual`.
    // Los objetos viven donde los crees: un vector<unique_ptr<Forma>> es dueño de formas de distintos tipos.
    vector<unique_ptr<Forma>> formas;
    formas.push_back(make_unique<Cuadrado>(2));
    formas.push_back(make_unique<Circulo>(1));
    for (const auto& f : formas) {
        cout << f->nombre() << " área " << f->area() << "\n";   // f-> llama a la versión de la clase real
    }
    // TRAMPA «slicing»: vector<Forma> o Forma f = Cuadrado(2) corta el objeto a la parte de la base (y Forma es abstracta,
    // ni compilaría). Polimorfismo ⇒ siempre por puntero/referencia, nunca por valor.
    // Sin `virtual ~Forma()` borrar un Cuadrado a través de Forma* es UB (no se ejecuta su destructor).
    // Desde Java: todos los métodos son «virtuales»; en C++ es opt-in (y más rápido por defecto). `final` cierra una clase.

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("8. Mixins (lo más parecido a los traits de PHP)");
    // C++ permite herencia múltiple; una clase pequeña con estado y métodos se «mezcla» en otras. Para la versión con
    // plantillas (CRTP) y conceptos, tema 2.
    Producto teclado("teclado");
    teclado.etiquetar("oferta");
    cout << teclado.nombre << " [" << teclado.etiqueta() << "]\n";

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("9. enum class");
    // Java: enum Dia {LUNES, ...} (con métodos y campos).  C++: solo nombres con valores enteros; sin values() ni toString.
    Dia hoy = Dia::Sabado;
    cout << aTexto(hoy) << " ¿fin de semana? " << esFinDeSemana(hoy) << ", valor numérico " << static_cast<int>(hoy) << "\n";
    // El `switch` sobre un enum class con -Wall avisa si te falta algún caso. Sin `class` (enum viejo) los nombres se
    // vuelven globales y se convierten solos a int: evítalo.

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("10. struct (el record de C++)");
    // Java: record Punto(int x, int y) {}.   C++: struct con campos públicos; los métodos útiles se piden con `= default`.
    Punto p1{1, 2};
    Punto p2{.x = 1, .y = 2};       // designated initializers (C++20): campos con nombre, EN ORDEN
    auto [px, py] = p1;             // desempaquetado
    cout << "iguales: " << (p1 == p2) << ", p1 < (2,0): " << (p1 < Punto{2, 0}) << ", x=" << px << " y=" << py << "\n";
    // Para usar tus tipos en un set/map ordenado necesitan `<`; en unordered_map, un hash (más trabajo). pair<int,int> ya trae todo.
    set<pair<int, int>> casillas = {{1, 2}, {0, 5}, {1, 2}};
    cout << "casillas únicas: " << casillas.size() << "\n";

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("11. == y compararlo todo");
    // En C++ == compara VALORES casi siempre (string, vector, pair...): a diferencia de Java, donde == en objetos compara referencias.
    string s1 = "hola", s2 = string("ho") + "la";
    cout << "strings iguales: " << (s1 == s2) << ", vectores iguales: " << (vector<int>{1, 2} == vector<int>{1, 2}) << "\n";
    // Con PUNTEROS, == compara DIRECCIONES (como el == de Java con objetos):
    int u = 1, w = 1;
    int *pu = &u, *pw = &w;
    cout << "mismos valores " << (u == w) << ", mismos punteros " << (pu == pw) << ", mismos valores por puntero " << (*pu == *pw) << "\n";
    // Con const char* ("literal") también compararía direcciones: compara strings, no punteros a char.
    // Decimales: 0.1 + 0.2 != 0.3 en cualquier lenguaje; compara con tolerancia: abs(a - b) < 1e-9.
    cout << "0.1+0.2 == 0.3 → " << (0.1 + 0.2 == 0.3) << ", con tolerancia → " << (abs(0.1 + 0.2 - 0.3) < 1e-9) << "\n";
    // Comparar signed con unsigned convierte el negativo a un número enorme: (-1 < 1u) es FALSO. -Wall suele avisar. Compara con
    // el mismo tipo (static_cast) o con int(v.size()).

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("12. Sin null: nullptr, optional, pila y heap");
    // PILA (stack): variables locales; reserva instantánea, se libera sola al salir del bloque. Tamaño limitado (~MB).
    // HEAP (montón): memoria dinámica con new / make_unique; vive hasta que se libere. En Java TODOS los objetos están en el
    // heap y el GC los limpia; en C++ eliges, y un olvido es una fuga (leak) o un uso-tras-liberar (UB).
    // vector y string guardan sus datos en el heap pero ellos mismos están en la pila: se liberan solos (RAII).
    int enPila = 5;
    auto enHeap = make_unique<int>(5);          // puntero dueño: libera el int al morir (nunca escribas delete a mano)
    *enHeap += enPila;
    cout << "heap: " << *enHeap << "\n";
    int* ninguno = nullptr;         // nullptr = «no apunta a nada». Desreferenciarlo (*ninguno) es UB (en Java: NullPointerException)
    cout << "¿puntero nulo? " << (ninguno == nullptr) << "\n";
    // optional<T>: «puede haber un valor o no», dentro del tipo (≈ Optional de Java, ?int de PHP). Es lo recomendado para
    // funciones que a veces no tienen respuesta; sin heap ni punteros.
    optional<int> hallado = nullopt;
    cout << "value_or: " << hallado.value_or(-1);
    hallado = 42;
    if (hallado) {                  // `if (opt)` o opt.has_value()
        cout << ", ahora hay " << *hallado << " (opt.value() lanza bad_optional_access si está vacío)\n";
    }
    // REFERENCIA COLGANTE: int& f() { int x = 1; return x; } → UB: x murió al salir. Lo mismo con punteros a objetos ya borrados
    // o iteradores invalidados. El modo comprobado (ASan) lo detecta; el estándar solo dice «indefinido».
    // Regla: usa objetos por valor y vector/string/unique_ptr; evita new/delete a mano y la aritmética de punteros.

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("13. Excepciones");
    // throw lanza CUALQUIER tipo (se usan clases de <stdexcept>); se captura por const& (por valor se corta/copia).
    // No existen las checked exceptions (nada de `throws`): el compilador no te obliga a capturar nada.
    try {
        throw invalid_argument("el tamaño debe ser positivo");
    } catch (const out_of_range&) {
        cout << "no entra aquí\n";
    } catch (const exception& e) {                  // base común de todas las excepciones estándar
        cout << "exception: " << e.what() << "\n";  // what() = getMessage()
    }
    try {
        stoi("abc");                                // stoi lanza invalid_argument; at() lanza out_of_range
    } catch (const invalid_argument&) {
        cout << "stoi no pudo convertir\n";
    }
    // No hay `finally`: la limpieza va en destructores (RAII), que se ejecutan también al lanzar («stack unwinding»).
    // OJO: divisiones por 0, acceder fuera de rango con [], desbordar un int... NO lanzan excepciones: son UB. Las excepciones
    // son para errores que TÚ detectas. En algoritmia se usan poco: se devuelve optional/bool o se valida la entrada.

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("14. Plantillas (los genéricos de C++)");
    // Java: <T extends Comparable<T>> T mayor(T a, T b).  C++: el compilador GENERA una versión por cada tipo que uses
    // (no hay «type erasure», y sí funcionan con int y double sin envolverlos en Integer).
    cout << mayor(3, 7) << " " << mayor(2.5, 1.5) << " " << mayor(string("pera"), string("manzana")) << "\n";
    Pila<int> pila;
    pila.apilar(1);
    pila.apilar(2);
    cout << "pila: " << pila.desapilar() << " " << pila.tamaño() << "\n";
    // Si T no admite lo que haces (p. ej. < en un tipo sin <), el error sale en la instanciación y es larguísimo: lee la PRIMERA
    // línea y busca «required from here». Las plantillas viven en el mismo archivo (no hay .class separados).
    // Las plantillas con tipos y valores (template <typename T, int N>), las variádicas y los conceptos, en el tema 2.

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("15. C++ moderno (11/14/17/20) que ya puedes usar");
    // if con inicializador, structured bindings, string_view, optional, variant, contains, ranges...
    if (auto it = edades.find("Ana"); it != edades.end()) {   // «it» solo existe dentro del if
        cout << "Ana existe y tiene " << it->second << "\n";
    }
    variant<int, string> v1 = string("texto");                // unión con tipo (≈ union types de PHP)
    cout << "variant guarda " << (holds_alternative<string>(v1) ? "string" : "int") << "\n";
    vector<int> pares;
    copy_if(datos.begin(), datos.end(), back_inserter(pares), [](int x) { return x % 2 == 0; });
    cout << "copy_if pares: " << texto(pares) << "\n";
    erase_if(pares, [](int x) { return x > 4; });             // C++20: borrar por condición
    cout << "erase_if: " << texto(pares) << "\n";

    // ─────────────────────────────────────────────────────────────────────────────
    titulo("Y una diferencia de mentalidad (y qué cambia respecto a C)");
    cout << "En Java/PHP/Python el runtime te protege y recoge la basura. En C++ tú decides dónde vive cada cosa y el\n"
            "compilador solo garantiza lo que el estándar define: lo demás es UB.\n";
    // QUÉ CAMBIA RESPECTO A C (si vienes de ahí):
    //   · string, vector, map... en lugar de char[] y arrays a mano; el tamaño lo conoce el contenedor.
    //   · Referencias (T&) y const& en lugar de punteros por todas partes.
    //   · new/delete y malloc/free → RAII y smart pointers (unique_ptr, shared_ptr).
    //   · bool, nullptr, auto, for-range, lambdas, enum class, namespaces y plantillas (templates) en lugar de macros.
    //   · Excepciones (opcionales) además de códigos de retorno; y sobrecarga de funciones y operadores.
    //   · Todo lo de C sigue compilando, pero con reglas de tipos más estrictas: no se convierte void* solo, etc.
    //   · El UB es el mismo: desbordar un int con signo, salirse de un array, usar memoria liberada.

    // ════════════════════════════════════════════════════════════════════════
    // PRUEBAS (no hace falta tocarlas)
    // ════════════════════════════════════════════════════════════════════════
    grupo("intercambiar");
    comprueba("intercambia dos enteros", [&] {
        int x = 1, y = 2;
        intercambiar(x, y);
        return make_pair(x, y);
    }, make_pair(2, 1));
    comprueba("con iguales no cambia nada", [&] {
        int x = 5, y = 5;
        intercambiar(x, y);
        return make_pair(x, y);
    }, make_pair(5, 5));
    comprueba("con negativos", [&] {
        int x = -3, y = 8;
        intercambiar(x, y);
        return make_pair(x, y);
    }, make_pair(8, -3));

    grupo("sumaSinDesbordar");
    prueba(sumaSinDesbordar,
           caso("pequeños", 5LL, 2, 3),
           caso("negativos", -7LL, -3, -4),
           caso("INT_MAX + 1", 2147483648LL, INT_MAX, 1),
           caso("INT_MAX + INT_MAX", 4294967294LL, INT_MAX, INT_MAX),
           caso("INT_MIN + INT_MIN", -4294967296LL, INT_MIN, INT_MIN));

    grupo("contarVocales");
    prueba(contarVocales,
           caso("palabra", 2, string("hola")),
           caso("mayúsculas y minúsculas", 5, string("AEIOUxyz")),
           caso("sin vocales", 0, string("rhythm")),
           caso("vacío", 0, string("")),
           caso("frase", 6, string("The quick brown fox jumps")));

    grupo("invertirEnSitio");
    prueba(invertirEnSitio,
           caso("varios", vector<int>{3, 2, 1}, vector<int>{1, 2, 3}),
           caso("longitud par", vector<int>{4, 3, 2, 1}, vector<int>{1, 2, 3, 4}),
           caso("un elemento", vector<int>{7}, vector<int>{7}),
           caso("vacío (cuidado con size() - 1)", vector<int>{}, vector<int>{}),
           caso("con repetidos", vector<int>{1, 1, 2}, vector<int>{2, 1, 1}));

    grupo("maximo");
    prueba(maximo,
           caso("varios", optional<int>(9), vector<int>{3, 9, 2}),
           caso("negativos", optional<int>(-1), vector<int>{-5, -1, -9}),
           caso("uno solo", optional<int>(4), vector<int>{4}),
           caso("vacío", optional<int>(), vector<int>{}),
           caso("al final", optional<int>(8), vector<int>{1, 2, 8}));

    grupo("penultimo");
    prueba(penultimo,
           caso("varios", optional<int>(2), vector<int>{1, 2, 3}),
           caso("dos", optional<int>(1), vector<int>{1, 2}),
           caso("uno solo", optional<int>(), vector<int>{1}),
           caso("vacío", optional<int>(), vector<int>{}));

    // ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    medir(invertirEnSitio, numeros(n));          // O(n)
    medir(maximo, numeros(n));                   // O(n)
}
