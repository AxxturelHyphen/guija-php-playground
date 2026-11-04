// Harness de Guija C++ Playground. Se incluye SOLO, antes del código del usuario (g++ -include pg.hpp, precompilado),
// así que no añade líneas: las de los errores son las del editor.
//
//  - Trae la biblioteca estándar que usan las lecciones (no hace falta acordarse de cada #include, aunque conviene
//    ponerlos: fuera del playground sí hacen falta). NO hace «using namespace std»: eso lo decide cada archivo.
//  - API de pruebas y mediciones (los mismos nombres que en PHP, Python y Java):
//      prueba(fn, caso("desc", esperado, args...), ...)    pruebaSinOrden(...)    pruebaCon(fn, comparador, caso...)
//      comprueba("desc", [&]{ return expr; }, esperado)    comprueba("desc", [&]{ return cond; })    comprueba("desc", cond)
//      compruebaSinOrden(...)    lanza("desc", [&]{ ... }, TipoExcepcion)    grupo("nombre")
//      return pendiente();    medir(fn, generadores en n...)    medirCon("etiqueta", preparar, operacion)
//      numeros(n) · lista(n) · aleatorios(n, max, semilla) · rango(desde, hasta, paso)
//    En pg:: (sin importar): pg::igual(a, b), pg::mostrar(v), pg::noOptimizar(v).
//  - prueba, pruebaSinOrden, pruebaCon, lanza y medir son MACROS (la función va sin comillas y así funcionan las
//    sobrecargas, las plantillas y los argumentos por defecto); no uses esos nombres para tus propias funciones.
//  - El main del usuario se renombra con una etiqueta de ensamblador (pg_main0.hpp / pg_main2.hpp, otro -include):
//    sigue siendo «main» para C++ (return 0 implícito); pg_main.cpp lo lanza en un hilo con 256 MB de pila.
//
// Lo que no depende de tipos (eventos JSON, cronómetro, el bucle de medir, señales, vigía) vive en pg_main.cpp, que se
// compila una sola vez por modo; aquí solo quedan las plantillas.

#ifndef PG_HPP_INCLUIDO
#define PG_HPP_INCLUIDO

#include <algorithm>
#include <array>
#include <atomic>
#include <bit>
#include <bitset>
#include <cassert>
#include <cctype>
#include <chrono>
#include <climits>
#include <cmath>
#include <compare>
#include <complex>
#include <concepts>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <exception>
#include <forward_list>
#include <fstream>
#include <functional>
#include <initializer_list>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <limits>
#include <list>
#include <map>
#include <memory>
#include <new>
#include <numbers>
#include <numeric>
#include <optional>
#include <queue>
#include <random>
#include <ranges>
#include <set>
#include <source_location>
#include <span>
#include <sstream>
#include <stack>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <type_traits>
#include <typeindex>
#include <typeinfo>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <variant>
#include <vector>

// ───────────────────────────── STL precompilada ─────────────────────────────
// Las instancias más habituales de la STL (vector<int>, string, map<string,int>, sort, lower_bound…) se compilan UNA vez
// en pg_main.o (que define PG_INSTANCIAR_STL); aquí se declaran «extern template» y cada programa no las vuelve a generar.
// Es lo que más acelera la compilación de un programa típico de algoritmos. Solo con libstdc++ (g++, MinGW, clang en Linux).
#if defined(__GLIBCXX__) && !defined(PG_SIN_STL_PRECOMPILADA)
#if defined(PG_INSTANCIAR_STL)
#define PG_STL template
#else
#define PG_STL extern template
#endif
// clases
PG_STL class std::basic_string<char>;
PG_STL class std::vector<int>;
PG_STL class std::vector<long long>;
PG_STL class std::vector<double>;
PG_STL class std::vector<bool>;
PG_STL class std::vector<char>;
PG_STL class std::vector<std::string>;
PG_STL class std::vector<std::vector<int>>;
PG_STL class std::vector<std::vector<long long>>;
PG_STL class std::vector<std::vector<bool>>;
PG_STL class std::vector<std::vector<char>>;
PG_STL class std::vector<std::vector<std::string>>;
PG_STL class std::vector<std::pair<int, int>>;
PG_STL class std::vector<std::vector<std::pair<int, int>>>;
PG_STL class std::vector<std::pair<long long, int>>;
PG_STL class std::map<int, int>;
PG_STL class std::map<std::string, int>;
PG_STL class std::map<char, int>;
PG_STL class std::map<int, std::vector<int>>;
PG_STL class std::map<std::string, std::vector<std::string>>;
PG_STL class std::set<int>;
PG_STL class std::set<std::string>;
PG_STL class std::set<std::pair<int, int>>;
PG_STL class std::unordered_map<int, int>;
PG_STL class std::unordered_map<std::string, int>;
PG_STL class std::unordered_map<char, int>;
PG_STL class std::unordered_map<int, std::vector<int>>;
PG_STL class std::unordered_set<int>;
PG_STL class std::unordered_set<std::string>;
PG_STL class std::deque<int>;
PG_STL class std::deque<std::pair<int, int>>;
PG_STL class std::priority_queue<int>;
PG_STL class std::priority_queue<int, std::vector<int>, std::greater<int>>;
PG_STL class std::priority_queue<std::pair<int, int>, std::vector<std::pair<int, int>>, std::greater<std::pair<int, int>>>;
PG_STL class std::priority_queue<std::pair<long long, int>, std::vector<std::pair<long long, int>>, std::greater<>>;
// algoritmos (con iteradores normales y constantes)
namespace pg::stl {
using VPar = std::vector<std::pair<int, int>>;
}
#define PG_STL_ORDENAR(It)                                     \
    PG_STL void std::sort<It>(It, It);                         \
    PG_STL void std::stable_sort<It>(It, It);                  \
    PG_STL void std::reverse<It>(It, It);                      \
    PG_STL It std::unique<It>(It, It);                         \
    PG_STL bool std::next_permutation<It>(It, It);
#define PG_STL_BUSCAR(It, T)                                   \
    PG_STL It std::lower_bound<It, T>(It, It, const T&);       \
    PG_STL It std::upper_bound<It, T>(It, It, const T&);       \
    PG_STL bool std::binary_search<It, T>(It, It, const T&);   \
    PG_STL It std::find<It, T>(It, It, const T&);              \
    PG_STL It std::max_element<It>(It, It);                    \
    PG_STL It std::min_element<It>(It, It);                    \
    PG_STL T std::accumulate<It, T>(It, It, T);                \
    PG_STL bool std::is_sorted<It>(It, It);
PG_STL_ORDENAR(std::vector<int>::iterator)
PG_STL_ORDENAR(std::vector<long long>::iterator)
PG_STL_ORDENAR(std::vector<std::string>::iterator)
PG_STL_ORDENAR(pg::stl::VPar::iterator)
PG_STL_ORDENAR(std::string::iterator)
PG_STL void std::sort<std::vector<int>::iterator, std::greater<int>>(std::vector<int>::iterator, std::vector<int>::iterator, std::greater<int>);
PG_STL void std::sort<std::vector<std::vector<int>>::iterator>(std::vector<std::vector<int>>::iterator, std::vector<std::vector<int>>::iterator);
PG_STL void std::sort<std::vector<std::vector<std::string>>::iterator>(std::vector<std::vector<std::string>>::iterator,
                                                                       std::vector<std::vector<std::string>>::iterator);
PG_STL_BUSCAR(std::vector<int>::iterator, int)
PG_STL_BUSCAR(std::vector<int>::const_iterator, int)
PG_STL_BUSCAR(std::vector<long long>::iterator, long long)
PG_STL_BUSCAR(std::vector<long long>::const_iterator, long long)
PG_STL long long std::accumulate<std::vector<int>::iterator, long long>(std::vector<int>::iterator, std::vector<int>::iterator, long long);
PG_STL long long std::accumulate<std::vector<int>::const_iterator, long long>(std::vector<int>::const_iterator, std::vector<int>::const_iterator, long long);
PG_STL std::iterator_traits<std::vector<int>::const_iterator>::difference_type std::count<std::vector<int>::const_iterator, int>(
    std::vector<int>::const_iterator, std::vector<int>::const_iterator, const int&);
PG_STL std::iterator_traits<std::vector<int>::iterator>::difference_type std::count<std::vector<int>::iterator, int>(std::vector<int>::iterator,
                                                                                                                   std::vector<int>::iterator, const int&);
// textos
PG_STL std::string std::operator+ <char, std::char_traits<char>, std::allocator<char>>(const std::string&, const std::string&);
PG_STL std::string std::operator+ <char, std::char_traits<char>, std::allocator<char>>(const std::string&, const char*);
PG_STL std::string std::operator+ <char, std::char_traits<char>, std::allocator<char>>(const char*, const std::string&);
PG_STL std::string std::operator+ <char, std::char_traits<char>, std::allocator<char>>(const std::string&, char);
PG_STL std::string std::operator+ <char, std::char_traits<char>, std::allocator<char>>(std::string&&, const std::string&);
PG_STL std::string std::operator+ <char, std::char_traits<char>, std::allocator<char>>(std::string&&, const char*);
PG_STL std::string std::operator+ <char, std::char_traits<char>, std::allocator<char>>(std::string&&, std::string&&);
#undef PG_STL_ORDENAR
#undef PG_STL_BUSCAR
#undef PG_STL
#endif

// El código del harness que se instancia en cada programa NO se instrumenta con los sanitizers: no es el código del
// usuario (que sí se comprueba) y así cada programa compila bastante más rápido.
#if defined(__GNUC__) || defined(__clang__)
#define PG_SI __attribute__((no_sanitize("address", "undefined")))
#else
#define PG_SI
#endif

namespace pg {

/** Lo lanza pendiente(): el ejercicio aún no está hecho. NO deriva de std::exception, así que un
 *  «catch (const std::exception&)» del usuario no se lo traga. */
struct PorHacer {
    std::string msg;
    int linea = 0;
};

namespace detalle {

// ───────────────────────────── implementado en pg_main.cpp ─────────────────────────────

/** Un evento del protocolo: \x1ePG{json}\x1f por stdout, en orden con la salida normal del programa. */
class Ev {
public:
    explicit Ev(const char* tipo);
    Ev& s(const char* clave, std::string_view valor);    // cadena (se escapa y se sanea a UTF-8 válido)
    Ev& i(const char* clave, long long valor);
    Ev& d(const char* clave, double valor, int decimales);
    Ev& raw(const char* clave, std::string_view json);   // JSON ya formado
    void emitir();

private:
    std::string j_;
};

extern std::atomic<int> lineaActual;    // línea del caso/prueba/medir en curso: la usan el vigía y los errores sin línea
extern std::string grupoActual;         // grupo("...") de comprueba/lanza
std::string demangle(const char* nombre);
/** "Tipo: what()" de la excepción que se está tratando (llamar dentro de un catch). */
std::string describirActual();
/** Tipo (sin espacios de nombres raros) de la excepción en vuelo, o "" si no hay. */
std::string tipoActual();
/** JSON con las direcciones del último throw de ESTE hilo dentro del ejecutable ("[]" si no se sabe): el servidor las
 *  traduce a líneas del usuario con addr2line. */
std::string pcsUltimoThrow();
double ms(std::chrono::steady_clock::time_point t0);
[[noreturn]] void lanzarPorHacer(std::string_view msg, int linea);

/** Una medición en marcha: el bucle (tamaños, calentamiento, tandas, paradas) es común y no depende de tipos. */
struct Fabrica {
    virtual ~Fabrica() = default;
    /** Prepara k repeticiones para el tamaño n (fuera del cronómetro). */
    virtual void preparar(int n, int k) = 0;
    /** Ejecuta la repetición i ya preparada (dentro del cronómetro). */
    virtual void ejecutar(int i) = 0;
    /** Si las repeticiones comparten la misma entrada (la función no puede modificarla). */
    bool compartido = true;
};
void medirGeneral(std::string_view nombre, std::string_view escala, const std::vector<int>& tamanos, Fabrica& f, int linea);

// ───────────────────────────── utilidades de tipos ─────────────────────────────

template <class> inline constexpr bool siempreFalso = false;
template <class T> using Limpio = std::remove_cvref_t<T>;

template <class T> inline constexpr bool esChar = std::is_same_v<Limpio<T>, char> || std::is_same_v<Limpio<T>, char8_t>;
template <class T> inline constexpr bool esBool = std::is_same_v<Limpio<T>, bool>;
template <class T> inline constexpr bool esNumero = std::is_arithmetic_v<Limpio<T>> && !esChar<T> && !esBool<T>;
template <class T>
inline constexpr bool esEnteroEstandar = std::is_integral_v<T> && !std::is_same_v<T, bool> && !std::is_same_v<T, char> && !std::is_same_v<T, wchar_t> &&
                                         !std::is_same_v<T, char8_t> && !std::is_same_v<T, char16_t> && !std::is_same_v<T, char32_t>;

template <class T>
concept Cadena = std::is_convertible_v<const T&, std::string_view> && !std::is_same_v<Limpio<T>, std::nullptr_t>;

template <class T>
concept Rango = requires(const T& t) {
    std::begin(t);
    std::end(t);
} && !Cadena<T>;

template <class T>
concept Mapa = Rango<T> && requires {
    typename T::key_type;
    typename T::mapped_type;
};

template <class T>
concept Conjunto = Rango<T> && requires { typename T::key_type; } && !Mapa<T>;

template <class T>
concept TuplaLike = !Rango<T> && requires { std::tuple_size<Limpio<T>>::value; };

template <class T> struct EsOptional : std::false_type {};
template <class T> struct EsOptional<std::optional<T>> : std::true_type {};
template <class T> struct EsVariant : std::false_type {};
template <class... T> struct EsVariant<std::variant<T...>> : std::true_type {};

template <class T>
concept Imprimible = requires(std::ostream& o, const T& t) { o << t; };

template <class T>
concept ConIgualdad = requires(const T& a, const T& b) {
    { a == b } -> std::convertible_to<bool>;
};

template <class T>
concept Puntero = std::is_pointer_v<Limpio<T>> && !Cadena<T>;

template <class T>
concept PunteroListo = requires(const T& p) {
    typename T::element_type;
    p.get();
};

// Adaptadores (stack, queue, priority_queue): su contenedor es el miembro protegido `c`
template <class T>
concept Adaptador = requires {
    typename T::container_type;
    typename T::value_type;
} && !Rango<T>;

template <class A>
const typename A::container_type& contenedorDe(const A& a)
{
    struct Acceso : A {
        static const typename A::container_type& de(const A& x) { return x.*(&Acceso::c); }
    };
    return Acceso::de(a);
}

template <class T>
concept ColaPrioridad = Adaptador<T> && requires { typename T::value_compare; };

template <class T> PG_SI std::string nombreTipo()
{
    return demangle(typeid(T).name());
}

// ───────────────────────────── mostrar ─────────────────────────────

std::string citar(std::string_view s, char comilla);    // "texto" con escapes (pg_main.cpp)
std::string numeroDecimal(double v);                    // la representación más corta que vuelve al mismo double
std::string numeroDecimal(float v);
std::string numeroDecimal(long double v);

template <class T> PG_SI void mostrarEn(std::string& out, const T& v, int prof);

template <class It> PG_SI void mostrarSecuencia(std::string& out, It ini, It fin, int prof, const char* abre, const char* cierra)
{
    if (prof >= 4) {
        out += abre;
        out += "…";
        out += cierra;
        return;
    }
    out += abre;
    std::size_t i = 0;
    std::size_t total = 0;
    for (It it = ini; it != fin; ++it, ++total) {
        if (i < 40) {
            if (i > 0) out += ", ";
            mostrarEn(out, *it, prof + 1);
            ++i;
        }
    }
    if (total > 40) out += ", …(+" + std::to_string(total - 40) + ")";
    out += cierra;
}

template <class Tup, std::size_t... I> PG_SI void mostrarTupla(std::string& out, const Tup& t, int prof, std::index_sequence<I...>)
{
    out += "(";
    ((out += (I == 0 ? "" : ", "), mostrarEn(out, std::get<I>(t), prof + 1)), ...);
    out += ")";
}

template <class T> PG_SI void mostrarEn(std::string& out, const T& v, int prof)
{
    using U = Limpio<T>;
    if constexpr (esBool<U>) {
        out += v ? "true" : "false";
    } else if constexpr (std::is_same_v<U, char>) {
        out += citar(std::string_view(&v, 1), '\'');
    } else if constexpr (std::is_same_v<U, signed char> || std::is_same_v<U, unsigned char>) {
        out += std::to_string(static_cast<int>(v));
    } else if constexpr (std::is_integral_v<U>) {
        out += std::to_string(v);
    } else if constexpr (std::is_floating_point_v<U>) {
        out += numeroDecimal(v);
    } else if constexpr (std::is_same_v<U, std::nullptr_t>) {
        out += "nullptr";
    } else if constexpr (std::is_same_v<U, const char*> || std::is_same_v<U, char*>) {
        if (v == nullptr) out += "nullptr";
        else out += citar(v, '"');
    } else if constexpr (Cadena<U>) {
        out += citar(std::string_view(v), '"');
    } else if constexpr (std::is_same_v<U, std::nullopt_t>) {
        out += "nullopt";
    } else if constexpr (EsOptional<U>::value) {
        if (v.has_value()) mostrarEn(out, *v, prof);
        else out += "nullopt";
    } else if constexpr (EsVariant<U>::value) {
        std::visit([&](const auto& x) PG_SI { mostrarEn(out, x, prof); }, v);
    } else if constexpr (std::is_same_v<U, std::monostate>) {
        out += "monostate";
    } else if constexpr (std::is_enum_v<U> && !Imprimible<U>) {
        out += std::to_string(static_cast<long long>(static_cast<std::underlying_type_t<U>>(v)));
    } else if constexpr (Mapa<U>) {
        if (prof >= 4) {
            out += "{…}";
            return;
        }
        out += "{";
        std::size_t i = 0;
        for (const auto& [k, x] : v) {
            if (i == 40) {
                out += ", …(+" + std::to_string(v.size() - 40) + ")";
                break;
            }
            if (i++ > 0) out += ", ";
            mostrarEn(out, k, prof + 1);
            out += ": ";
            mostrarEn(out, x, prof + 1);
        }
        out += "}";
    } else if constexpr (Rango<U>) {
        mostrarSecuencia(out, std::begin(v), std::end(v), prof, "{", "}");
    } else if constexpr (TuplaLike<U>) {
        mostrarTupla(out, v, prof, std::make_index_sequence<std::tuple_size_v<U>>{});
    } else if constexpr (ColaPrioridad<U>) {
        U copia = v;    // de la cima hacia abajo, en el orden en que saldrían
        std::vector<typename U::value_type> orden;
        while (!copia.empty() && orden.size() < 41) {
            orden.push_back(copia.top());
            copia.pop();
        }
        std::string tmp;
        mostrarSecuencia(tmp, orden.begin(), orden.begin() + std::min<std::size_t>(orden.size(), 40), prof, "{", "");
        if (v.size() > 40) tmp += ", …(+" + std::to_string(v.size() - 40) + ")";
        out += tmp + "}";
    } else if constexpr (Adaptador<U>) {
        const auto& c = contenedorDe(v);
        mostrarSecuencia(out, std::begin(c), std::end(c), prof, "{", "}");
    } else if constexpr (Imprimible<U>) {
        std::ostringstream os;
        os << v;
        out += os.str();
    } else if constexpr (PunteroListo<U>) {
        if (!v) out += "nullptr";
        else {
            out += "&";
            mostrarEn(out, *v, prof + 1);
        }
    } else if constexpr (Puntero<U>) {
        if (v == nullptr) out += "nullptr";
        else {
            char b[32];
            std::snprintf(b, sizeof b, "%p", static_cast<const void*>(v));
            out += b;
        }
    } else {
        out += "<" + nombreTipo<U>() + ">";
    }
}

/** Texto de un valor para los resultados de las pruebas: {1, 2, 3}, "texto", 'c', (a, b), nullopt… (máx. `max` caracteres). */
template <class T> PG_SI std::string mostrarMax(const T& v, std::size_t max)
{
    std::string s;
    mostrarEn(s, v, 0);
    if (s.size() > max) {
        std::size_t corte = max - 1;
        while (corte > 0 && (static_cast<unsigned char>(s[corte]) & 0xC0) == 0x80) --corte;    // sin partir un carácter UTF-8
        s = s.substr(0, corte) + "…";
    }
    return s;
}

// ───────────────────────────── igualdad ─────────────────────────────

inline bool cerca(long double a, long double b)
{
    if (std::isnan(a) && std::isnan(b)) return true;
    if (a == b) return true;
    return std::fabs(a - b) <= 1e-9L * std::max<long double>(1.0L, std::max(std::fabs(a), std::fabs(b)));
}

// SO = «sin orden» (en tiempo de compilación: el código de ordenar solo se genera si se usa)
template <bool SO, class A, class B> PG_SI bool igualEn(const A& a, const B& b);

/** Clave para ordenar elementos «sin orden»: su texto, con las secuencias interiores ya ordenadas. */
template <class T> PG_SI std::string claveSinOrden(const T& v)
{
    using U = Limpio<T>;
    if constexpr (Rango<U> && !Mapa<U> && !Conjunto<U>) {
        std::vector<std::string> ks;
        for (const auto& x : v) ks.push_back(claveSinOrden(x));
        std::sort(ks.begin(), ks.end());
        std::string s = "{";
        for (std::size_t i = 0; i < ks.size(); ++i) s += (i ? ", " : "") + ks[i];
        return s + "}";
    } else {
        std::string s;
        mostrarEn(s, v, 0);
        return s;
    }
}

/** Orden (por clave) de los elementos de una secuencia, para compararla «sin orden». */
template <class R> PG_SI std::vector<std::pair<std::string, const std::remove_reference_t<decltype(*std::begin(std::declval<const R&>()))>*>> ordenSinOrden(const R& r)
{
    std::vector<std::pair<std::string, const std::remove_reference_t<decltype(*std::begin(r))>*>> p;
    for (const auto& x : r) p.emplace_back(claveSinOrden(x), &x);
    std::stable_sort(p.begin(), p.end(), [](const auto& x, const auto& y) PG_SI { return x.first < y.first; });
    return p;
}

template <bool SO, class RA, class RB> PG_SI bool igualSecuencias(const RA& a, const RB& b)
{
    auto na = static_cast<std::size_t>(std::distance(std::begin(a), std::end(a)));
    auto nb = static_cast<std::size_t>(std::distance(std::begin(b), std::end(b)));
    if (na != nb) return false;
    if constexpr (!SO) {
        auto ib = std::begin(b);
        for (auto ia = std::begin(a); ia != std::end(a); ++ia, ++ib)
            if (!igualEn<false>(*ia, *ib)) return false;
        return true;
    } else {
        auto pa = ordenSinOrden(a);
        auto pb = ordenSinOrden(b);
        for (std::size_t i = 0; i < pa.size(); ++i)
            if (!igualEn<true>(*pa[i].second, *pb[i].second)) return false;
        return true;
    }
}

/** Contenedores asociativos (o un conjunto y una secuencia): como conjuntos/mapas, sin importar el orden. */
template <bool SO, class RA, class RB> PG_SI bool igualAsociativos(const RA& a, const RB& b)
{
    if constexpr (Mapa<RA> && Mapa<RB>) {
        if (a.size() != b.size()) return false;
        for (const auto& [k, x] : a) {
            bool hay = false;
            if constexpr (std::is_same_v<RA, RB>) {
                auto it = b.find(k);
                hay = it != b.end() && igualEn<SO>(x, it->second);
            } else {
                for (const auto& [k2, y] : b)
                    if (igualEn<SO>(k, k2)) {
                        hay = igualEn<SO>(x, y);
                        break;
                    }
            }
            if (!hay) return false;
        }
        return true;
    } else if constexpr (std::is_same_v<RA, RB> && Conjunto<RA> && requires { a.count(*std::begin(b)); }) {
        if (a.size() != b.size()) return false;
        for (const auto& x : a)
            if (!b.count(x)) return false;
        return true;
    } else {
        return igualSecuencias<true>(a, b);    // conjunto frente a secuencia (u otro tipo de conjunto): mismos elementos
    }
}

template <bool SO, class TA, class TB, std::size_t... I> PG_SI bool igualTuplas(const TA& a, const TB& b, std::index_sequence<I...>)
{
    return (igualEn<SO>(std::get<I>(a), std::get<I>(b)) && ...);
}

/**
 * Igualdad «de prueba»: números por valor (enteros con cualquier signo y tamaño; decimales con tolerancia relativa 1e-9,
 * NaN igual a NaN), textos como textos, contenedores elemento a elemento (los asociativos como conjuntos/mapas),
 * pair/tuple/optional/variant por partes, y tus tipos con su operator==.
 */
template <bool SO, class A, class B> PG_SI bool igualEn(const A& a, const B& b)
{
    using UA = Limpio<A>;
    using UB = Limpio<B>;
    if constexpr ((std::is_arithmetic_v<UA> || std::is_enum_v<UA>) && (std::is_arithmetic_v<UB> || std::is_enum_v<UB>)) {
        if constexpr (std::is_enum_v<UA> && std::is_enum_v<UB> && std::is_same_v<UA, UB>) {
            return a == b;
        } else if constexpr (std::is_enum_v<UA> || std::is_enum_v<UB>) {
            if constexpr (std::is_enum_v<UA>) return igualEn<SO>(static_cast<std::underlying_type_t<UA>>(a), b);
            else return igualEn<SO>(a, static_cast<std::underlying_type_t<UB>>(b));
        } else if constexpr (std::is_floating_point_v<UA> || std::is_floating_point_v<UB>) {
            return cerca(static_cast<long double>(a), static_cast<long double>(b));
        } else if constexpr (esEnteroEstandar<UA> && esEnteroEstandar<UB>) {
            return std::cmp_equal(a, b);    // con signo y sin signo, sin sorpresas (-1 ≠ 4294967295u)
        } else {
            return static_cast<long long>(a) == static_cast<long long>(b);    // bool y los tipos char
        }
    } else if constexpr (Cadena<UA> && Cadena<UB>) {
        if constexpr (std::is_pointer_v<UA>) {
            if (a == nullptr) {
                if constexpr (std::is_pointer_v<UB>) return b == nullptr;
                else return false;
            }
        }
        if constexpr (std::is_pointer_v<UB>) {
            if (b == nullptr) return false;
        }
        return std::string_view(a) == std::string_view(b);
    } else if constexpr (std::is_same_v<UA, std::nullptr_t> || std::is_same_v<UB, std::nullptr_t>) {
        if constexpr (std::is_same_v<UA, std::nullptr_t> && std::is_same_v<UB, std::nullptr_t>) return true;
        else if constexpr (std::is_same_v<UA, std::nullptr_t>) {
            if constexpr (requires { b == nullptr; }) return b == nullptr;
            else return false;
        } else {
            if constexpr (requires { a == nullptr; }) return a == nullptr;
            else return false;
        }
    } else if constexpr (std::is_same_v<UA, std::nullopt_t> || std::is_same_v<UB, std::nullopt_t>) {
        if constexpr (EsOptional<UA>::value) return !a.has_value();
        else if constexpr (EsOptional<UB>::value) return !b.has_value();
        else return std::is_same_v<UA, UB>;
    } else if constexpr (EsOptional<UA>::value && EsOptional<UB>::value) {
        if (a.has_value() != b.has_value()) return false;
        return !a.has_value() || igualEn<SO>(*a, *b);
    } else if constexpr (EsOptional<UA>::value) {
        return a.has_value() && igualEn<SO>(*a, b);
    } else if constexpr (EsOptional<UB>::value) {
        return b.has_value() && igualEn<SO>(a, *b);
    } else if constexpr (EsVariant<UA>::value && EsVariant<UB>::value) {
        return std::visit([&](const auto& x) PG_SI { return std::visit([&](const auto& y) PG_SI { return igualEn<SO>(x, y); }, b); }, a);
    } else if constexpr (EsVariant<UA>::value) {
        return std::visit([&](const auto& x) PG_SI { return igualEn<SO>(x, b); }, a);
    } else if constexpr (EsVariant<UB>::value) {
        return std::visit([&](const auto& y) PG_SI { return igualEn<SO>(a, y); }, b);
    } else if constexpr (Rango<UA> && Rango<UB>) {
        if constexpr (Mapa<UA> || Mapa<UB> || Conjunto<UA> || Conjunto<UB>) return igualAsociativos<SO>(a, b);
        else return igualSecuencias<SO>(a, b);
    } else if constexpr (TuplaLike<UA> && TuplaLike<UB>) {
        if constexpr (std::tuple_size_v<UA> != std::tuple_size_v<UB>) return false;
        else return igualTuplas<SO>(a, b, std::make_index_sequence<std::tuple_size_v<UA>>{});
    } else if constexpr (Adaptador<UA> && Adaptador<UB>) {
        if constexpr (ColaPrioridad<UA> || ColaPrioridad<UB>) return igualSecuencias<true>(contenedorDe(a), contenedorDe(b));
        else return igualSecuencias<SO>(contenedorDe(a), contenedorDe(b));
    } else if constexpr (PunteroListo<UA> && PunteroListo<UB>) {
        if (!a || !b) return !a && !b;
        return igualEn<SO>(*a, *b);
    } else if constexpr (requires { { a == b } -> std::convertible_to<bool>; }) {
        return static_cast<bool>(a == b);
    } else {
        static_assert(siempreFalso<A>, "pg: no sé comparar estos dos valores: define operator== en tu tipo "
                                       "(p. ej. «bool operator==(const T&) const = default;») o usa comprueba() con tu propia condición");
        return false;
    }
}

// Las combinaciones más habituales ya vienen compiladas en pg_main.o (así cada programa compila menos)
using VInt = std::vector<int>;
using VLL = std::vector<long long>;
using VDouble = std::vector<double>;
using VString = std::vector<std::string>;
using VBool = std::vector<bool>;
using VChar = std::vector<char>;
using VVInt = std::vector<std::vector<int>>;
using ParInt = std::pair<int, int>;
using VParInt = std::vector<std::pair<int, int>>;
using SetInt = std::set<int>;
using MapIntInt = std::map<int, int>;
using MapStringInt = std::map<std::string, int>;
using CStr = const char*;
#define PG_TIPOS_COMUNES(X)                                                                                                                       \
    X(int) X(long) X(long long) X(unsigned) X(unsigned long) X(unsigned long long) X(double) X(bool) X(char) X(std::string) X(VInt) X(VLL) \
        X(VDouble) X(VString) X(VBool) X(VChar) X(VVInt) X(ParInt) X(VParInt) X(SetInt) X(MapIntInt) X(MapStringInt)
#define PG_PARES_COMUNES(X)                                                                                                                     \
    X(long long, int) X(long, int) X(unsigned long, int) X(unsigned, int) X(double, int) X(int, long long) X(int, double) X(float, double) \
        X(std::string, CStr)
#define PG_EXTERN_MOSTRAR(T) extern template std::string mostrarMax<T>(const T&, std::size_t);
#define PG_EXTERN_IGUAL(T) extern template bool igualEn<false, T, T>(const T&, const T&);
#define PG_EXTERN_IGUAL2(A, B) extern template bool igualEn<false, A, B>(const A&, const B&);
PG_TIPOS_COMUNES(PG_EXTERN_MOSTRAR)
PG_TIPOS_COMUNES(PG_EXTERN_IGUAL)
PG_PARES_COMUNES(PG_EXTERN_IGUAL2)
extern template bool igualEn<true, VInt, VInt>(const VInt&, const VInt&);
extern template bool igualEn<true, VVInt, VVInt>(const VVInt&, const VVInt&);
extern template bool igualEn<true, VString, VString>(const VString&, const VString&);

// ───────────────────────────── casos y pruebas ─────────────────────────────

/** Descripción + dónde se escribió (la conversión implícita captura la línea de la llamada). */
struct Desc {
    std::string texto;
    int linea;
    Desc(const char* t, std::source_location l = std::source_location::current()) : texto(t ? t : ""), linea(static_cast<int>(l.line())) {}
    Desc(const std::string& t, std::source_location l = std::source_location::current()) : texto(t), linea(static_cast<int>(l.line())) {}
    Desc(std::string_view t, std::source_location l = std::source_location::current()) : texto(t), linea(static_cast<int>(l.line())) {}
};

/** Cómo se guarda un argumento o el esperado: copia sin referencias; los textos literales, como std::string. */
template <class T>
using Guardado = std::conditional_t<std::is_same_v<std::decay_t<T>, const char*> || std::is_same_v<std::decay_t<T>, char*>, std::string, std::decay_t<T>>;

template <class E, class... A> struct Caso {
    std::string desc;
    int linea;
    E esperado;
    std::tuple<A...> args;
};

/** Referencia a algo invocable sin copiarlo ni reservar memoria (lo que pasa de las plantillas a pg_main.cpp). */
template <class R> class FnRef {
public:
    template <class F> FnRef(F& f) : obj_(static_cast<void*>(std::addressof(f))), llamar_([](void* o) PG_SI -> R { return (*static_cast<F*>(o))(); }) {}
    R operator()() const { return llamar_(obj_); }

private:
    void* obj_;
    R (*llamar_)(void*);
};

/** Lo que devuelve una prueba ya hecha: si pasó y el texto de lo obtenido. */
struct Salida {
    bool ok;
    std::string actual;
};

// En pg_main.cpp: cronómetro, try/catch y evento (no dependen de tipos). correrCaso devuelve false si hubo pendiente().
bool correrCaso(const std::string& grupo, const std::string& nombre, int linea, const std::string& input, const std::string& esperado, FnRef<Salida> cuerpo,
                int total);
void correrComprueba(const std::string& desc, int linea, const std::string& esperado, FnRef<Salida> cuerpo);
void correrLanza(const std::string& desc, int linea, const std::string& esperado, void (*llamar)(void*), void* fn, bool (*esDelTipo)());

/** Llama a fn con los argumentos como lvalues (o rvalues si la función los pide así). */
template <class F, class Tup, std::size_t... I> PG_SI decltype(auto) aplicarI(F& fn, Tup& t, std::index_sequence<I...>)
{
    if constexpr (std::is_invocable_v<F&, std::tuple_element_t<I, Tup>&...>) return fn(std::get<I>(t)...);
    else return fn(std::move(std::get<I>(t))...);
}

template <class F, class Tup> PG_SI decltype(auto) aplicar(F& fn, Tup& t)
{
    return aplicarI(fn, t, std::make_index_sequence<std::tuple_size_v<Tup>>{});
}

template <class F, class Tup> inline constexpr bool invocableTupla = false;
template <class F, class... A> inline constexpr bool invocableTupla<F, std::tuple<A...>> = std::is_invocable_v<F&, A&...> || std::is_invocable_v<F&, A&&...>;

template <class F, class Tup> struct ResultadoTupla;
template <class F, class... A> struct ResultadoTupla<F, std::tuple<A...>> {
    using type = std::conditional_t<std::is_invocable_v<F&, A&...>, std::invoke_result<F&, A&...>, std::invoke_result<F&, A&&...>>::type;
};
/** Resultado sin referencias (void si no devuelve nada). */
template <class F, class Tup> using ResultadoDe = std::decay_t<typename ResultadoTupla<F, Tup>::type>;

// Lo ÚNICO que depende de la función concreta (cada prueba() trae su propia lambda): llamarla. Todo lo demás depende
// solo de los tipos de los argumentos y del resultado, y se comparte entre todas las pruebas con los mismos tipos.
template <class F, class Tup, class RD> PG_SI RD llamarCon(void* f, Tup& args)
{
    if constexpr (std::is_void_v<RD>) aplicar(*static_cast<F*>(f), args);
    else return aplicar(*static_cast<F*>(f), args);
}

template <class Cmp, class O, class E> PG_SI bool compararCon(void* c, const O& o, const E& e)
{
    return static_cast<bool>((*static_cast<Cmp*>(c))(o, e));
}

template <bool SO, class O, class E> PG_SI bool compararIgual(void*, const O& o, const E& e)
{
    return igualEn<SO>(o, e);
}

template <class Tup> PG_SI std::string mostrarArgs(const Tup& args)
{
    std::string in;
    std::apply([&](const auto&... a) PG_SI { ((in += (in.empty() ? "" : ", ") + mostrarMax(a, 120)), ...); }, args);
    return in;
}

/** Lo que se compara: el resultado o, si la función es void, su primer argumento (ordenar(v) en el sitio). */
template <class Tup, class RD> using Obtenido = std::conditional_t<std::is_void_v<RD>, std::tuple_element<0, Tup>, std::type_identity<RD>>::type;

/** Un caso: copia los argumentos, llama, compara y emite el evento. Devuelve false si hubo pendiente(). */
template <class Tup, class E, class RD>
PG_SI bool unCaso(const std::string& grupo, const std::string& desc, int n, int linea, const Tup& args, const E& esperado, int total,
                  RD (*llamar)(void*, Tup&), void* fn, bool (*cmp)(void*, const Obtenido<Tup, RD>&, const E&), void* cmpObj)
{
    auto cuerpo = [&]() PG_SI -> Salida {
        Tup copia = args;    // cada llamada recibe su propia copia: el caso guardado no cambia
        if constexpr (std::is_void_v<RD>) {
            llamar(fn, copia);
            return {cmp(cmpObj, std::get<0>(copia), esperado), mostrarMax(std::get<0>(copia), 300)};
        } else {
            RD r = llamar(fn, copia);
            return {cmp(cmpObj, r, esperado), mostrarMax(r, 300)};
        }
    };
    return correrCaso(grupo, desc.empty() ? "caso " + std::to_string(n) : desc, linea, mostrarArgs(args), mostrarMax(esperado, 300), FnRef<Salida>(cuerpo),
                      total);
}

/** Modo 0: prueba · 1: pruebaSinOrden · 2: pruebaCon (cmp es el comparador del usuario). */
template <int Modo, class F, class Cmp, class E, class... A>
PG_SI bool casoDe(const std::string& grupo, int n, int total, Caso<E, A...>& c, F& fn, Cmp& cmp)
{
    using Tup = std::tuple<A...>;
    if constexpr (!invocableTupla<F, Tup>) {
        static_assert(siempreFalso<F>, "prueba(): los argumentos de este caso() no encajan con los parámetros de la función "
                                       "(¿cuántos y de qué tipo recibe?)");
        return true;
    } else {
        using RD = ResultadoDe<F, Tup>;
        if constexpr (std::is_void_v<RD> && sizeof...(A) == 0) {
            static_assert(siempreFalso<F>, "prueba(): la función no devuelve nada y no tiene argumentos: no hay nada que comparar");
            return true;
        } else {
            using O = Obtenido<Tup, RD>;
            bool (*comparar)(void*, const O&, const E&);
            if constexpr (Modo == 2) comparar = &compararCon<Cmp, O, E>;
            else comparar = &compararIgual<Modo == 1, O, E>;
            return unCaso<Tup, E, RD>(grupo, c.desc, n, c.linea, c.args, c.esperado, total, &llamarCon<F, Tup, RD>, static_cast<void*>(&fn), comparar,
                                      static_cast<void*>(&cmp));
        }
    }
}

/** Ejecuta los casos de prueba(fn, ...): un evento `test` por caso; un pendiente() corta el grupo con estado «todo». */
template <int Modo, class F, class Cmp, class... Casos> PG_SI void pruebaImpl(const char* nombreFn, F fn, Cmp cmp, Casos&&... casos)
{
    std::string grupo = std::string(nombreFn) + "()";
    int n = 0;
    bool seguir = true;
    ((seguir = seguir && casoDe<Modo>(grupo, ++n, static_cast<int>(sizeof...(Casos)), casos, fn, cmp)), ...);
}

struct SinComparador {};

template <class F, class RD> PG_SI RD llamarSinArgs(void* f)
{
    if constexpr (std::is_void_v<RD>) (*static_cast<F*>(f))();
    else return (*static_cast<F*>(f))();
}

template <bool SO, class RD, class E> PG_SI void compruebaTipado(const Desc& d, RD (*llamar)(void*), void* fn, const E& esperado)
{
    auto cuerpo = [&]() PG_SI -> Salida {
        RD r = llamar(fn);
        return {igualEn<SO>(r, esperado), mostrarMax(r, 300)};
    };
    correrComprueba(d.texto, d.linea, mostrarMax(esperado, 300), FnRef<Salida>(cuerpo));
}

template <bool SO, class V, class E> PG_SI void compruebaValor(const Desc& d, const V& v, const E& esperado)
{
    auto cuerpo = [&]() PG_SI -> Salida { return {igualEn<SO>(v, esperado), mostrarMax(v, 300)}; };
    correrComprueba(d.texto, d.linea, mostrarMax(esperado, 300), FnRef<Salida>(cuerpo));
}

/** comprueba(): el valor (o lo que devuelve la lambda) debe ser igual al esperado. */
template <bool SO, class F, class E> PG_SI void compruebaImpl(const Desc& d, F& fn, const E& esperado)
{
    if constexpr (std::is_invocable_v<F&>) {
        using RD = std::decay_t<std::invoke_result_t<F&>>;
        if constexpr (std::is_void_v<RD>) {
            static_assert(siempreFalso<F>, "comprueba(): la lambda no devuelve nada; escribe «[&]{ return expresión; }»");
        } else {
            compruebaTipado<SO, RD, E>(d, &llamarSinArgs<F, RD>, static_cast<void*>(std::addressof(fn)), esperado);
        }
    } else {
        compruebaValor<SO>(d, fn, esperado);
    }
}

template <class X> PG_SI bool esDelTipo()
{
    try {
        throw;
    } catch (const X&) {
        return true;
    } catch (...) {
        return false;
    }
}

/** lanza(): pasa si fn lanza una excepción de tipo X (o derivada). */
template <class X, class F> PG_SI void lanzaImpl(const Desc& d, F&& fn, const char* nombreTipo)
{
    if constexpr (!std::is_invocable_v<F&>) {
        static_assert(siempreFalso<F>, "lanza(): el segundo argumento debe ser una lambda sin parámetros: [&]{ ... }");
    } else {
        correrLanza(d.texto, d.linea, std::string("lanza ") + nombreTipo, &llamarSinArgs<std::remove_reference_t<F>, void>,
                    static_cast<void*>(std::addressof(fn)), &esDelTipo<X>);
    }
}

// ───────────────────────────── medir ─────────────────────────────

/** El compilador no puede quitar el cálculo cuyo resultado pasa por aquí. */
template <class T> inline void noOptimizar(const T& v)
{
#if defined(__GNUC__) || defined(__clang__)
    asm volatile("" : : "r,m"(v) : "memory");
#else
    static volatile const void* sumidero;
    sumidero = &v;
#endif
}

template <class F, class Tup> PG_SI void llamarYNoOptimizar(F& fn, Tup& args)
{
    using R = typename ResultadoTupla<F, Tup>::type;
    if constexpr (std::is_void_v<R>) {
        aplicar(fn, args);
        if constexpr (std::tuple_size_v<Tup> > 0) noOptimizar(std::get<0>(args));
    } else {
        decltype(auto) r = aplicar(fn, args);
        noOptimizar(r);
    }
}

/** ¿fn recibe alguno de sus argumentos por referencia no constante? Entonces cada repetición necesita entrada nueva. */
template <class F, class Tup> inline constexpr bool modificaEntrada = true;
template <class F, class... A> inline constexpr bool modificaEntrada<F, std::tuple<A...>> = !std::is_invocable_v<F&, const A&...>;

template <class F, class Gen, class Tup> struct FabricaTupla final : Fabrica {
    F& fn;
    Gen& gen;
    std::vector<Tup> entradas;
    FabricaTupla(F& f, Gen& g) : fn(f), gen(g) { compartido = !modificaEntrada<F, Tup>; }
    PG_SI void preparar(int n, int k) override
    {
        entradas.clear();
        int cuantas = compartido ? 1 : k;
        entradas.reserve(static_cast<std::size_t>(cuantas));
        for (int i = 0; i < cuantas; ++i) entradas.push_back(gen(n));
    }
    PG_SI void ejecutar(int i) override { llamarYNoOptimizar(fn, entradas[compartido ? 0 : static_cast<std::size_t>(i)]); }
};

/** Separa las opciones del final de medir(fn, gen..., "lineal", rango(10, 30, 2)) de los argumentos de verdad. */
template <class Tup, std::size_t N = std::tuple_size_v<Tup>> constexpr std::size_t inicioOpciones()
{
    if constexpr (N >= 2) {
        if constexpr (std::is_same_v<std::tuple_element_t<N - 2, Tup>, const char*> && std::is_same_v<std::tuple_element_t<N - 1, Tup>, std::vector<int>>)
            return N - 2;
    }
    if constexpr (N >= 1) {
        if constexpr (std::is_same_v<std::tuple_element_t<N - 1, Tup>, const char*>) return N - 1;
    }
    return N;
}

template <class Tup, std::size_t... I> auto prefijo(Tup&& t, std::index_sequence<I...>)
{
    return std::make_tuple(std::get<I>(std::forward<Tup>(t))...);
}

template <class F, class Gen> PG_SI void medirImpl(const char* nombre, F fn, Gen gen, int linea)
{
    using TodoTup = std::invoke_result_t<Gen&, int>;
    constexpr std::size_t total = std::tuple_size_v<TodoTup>;
    constexpr std::size_t corte = inicioOpciones<TodoTup>();
    using ArgsTup = decltype(prefijo(std::declval<TodoTup>(), std::make_index_sequence<corte>{}));
    // Las opciones solo se aceptan si la función NO se puede llamar con todos los valores (si no, son argumentos)
    constexpr bool conOpciones = corte < total && invocableTupla<F, ArgsTup> && !invocableTupla<F, TodoTup>;
    if constexpr (!conOpciones) {
        if constexpr (!invocableTupla<F, TodoTup>) {
            static_assert(siempreFalso<F>, "medir(): los valores que generas para n no encajan con los parámetros de la función");
        } else {
            FabricaTupla<F, Gen, TodoTup> fab(fn, gen);
            medirGeneral(nombre, "geometrica", {}, fab, linea);
        }
    } else {
        std::string escala = "geometrica";
        std::vector<int> tams;
        {
            TodoTup muestra = gen(1);    // solo para leer las opciones
            escala = std::get<corte>(muestra);
            if constexpr (corte + 2 == total) tams = std::get<corte + 1>(muestra);
        }
        auto genArgs = [&](int n) PG_SI { return prefijo(gen(n), std::make_index_sequence<corte>{}); };
        FabricaTupla<F, decltype(genArgs), ArgsTup> fab(fn, genArgs);
        medirGeneral(nombre, escala, tams, fab, linea);
    }
}

template <class Prep, class Op> struct FabricaCon final : Fabrica {
    using T = std::decay_t<std::invoke_result_t<Prep&, int>>;
    Prep& prep;
    Op& op;
    std::vector<T> entradas;
    // Como el medir tipado de Java: entrada nueva en cada repetición (la operación puede modificarla)
    FabricaCon(Prep& p, Op& o) : prep(p), op(o) { compartido = false; }
    PG_SI void preparar(int n, int k) override
    {
        entradas.clear();
        int cuantas = compartido ? 1 : k;
        entradas.reserve(static_cast<std::size_t>(cuantas));
        for (int i = 0; i < cuantas; ++i) entradas.push_back(prep(n));
    }
    PG_SI void ejecutar(int i) override
    {
        T& e = entradas[compartido ? 0 : static_cast<std::size_t>(i)];
        if constexpr (std::is_void_v<std::invoke_result_t<Op&, T&>>) {
            op(e);
            noOptimizar(e);
        } else {
            decltype(auto) r = op(e);
            noOptimizar(r);
        }
    }
};

} // namespace detalle

// ───────────────────────────── API pública ─────────────────────────────

/** Marca un ejercicio sin hacer: «return pendiente();» (o «pendiente();» en una función void). En las pruebas sale
 *  como pendiente, no como fallo. Compila en cualquier función: el valor se convierte al tipo que haga falta. */
struct Pendiente {
    // (pendiente() lanza antes de devolver nada: estas conversiones solo existen para que compile; la de && gana para
    //  valores, también los que solo se mueven como unique_ptr, y la de referencia sirve para «int& f()»)
    template <class T> operator T() && { throw PorHacer{"Ejercicio pendiente de implementar", 0}; }
    template <class T> operator T&() const& { throw PorHacer{"Ejercicio pendiente de implementar", 0}; }
};

inline Pendiente pendiente(std::string_view msg = "Ejercicio pendiente de implementar", std::source_location l = std::source_location::current())
{
    detalle::lanzarPorHacer(msg, static_cast<int>(l.line()));
}

/** Agrupa las siguientes comprobaciones (comprueba/lanza) bajo un título. */
inline void grupo(std::string_view nombre)
{
    detalle::grupoActual = std::string(nombre);
}

/** caso("descripción", esperado, argumentos...): los argumentos se copian, y cada llamada recibe su propia copia. */
template <class E, class... A>
detalle::Caso<detalle::Guardado<E>, detalle::Guardado<A>...> caso(detalle::Desc desc, E&& esperado, A&&... args)
{
    return {std::move(desc.texto), desc.linea, detalle::Guardado<E>(std::forward<E>(esperado)),
            std::tuple<detalle::Guardado<A>...>(std::forward<A>(args)...)};
}

/** caso("descripción", {1, 2, 3}, argumentos...): el esperado entre llaves se guarda como std::vector. */
template <class T, class... A>
detalle::Caso<std::vector<T>, detalle::Guardado<A>...> caso(detalle::Desc desc, std::initializer_list<T> esperado, A&&... args)
{
    return {std::move(desc.texto), desc.linea, std::vector<T>(esperado), std::tuple<detalle::Guardado<A>...>(std::forward<A>(args)...)};
}

/** comprueba("descripción", [&]{ return expr; }, esperado) — o un valor directamente en vez de la lambda. */
template <class F, class E> void comprueba(detalle::Desc desc, F&& fn, const E& esperado)
{
    detalle::compruebaImpl<false>(desc, fn, esperado);
}

template <class F, class T> void comprueba(detalle::Desc desc, F&& fn, std::initializer_list<T> esperado)
{
    detalle::compruebaImpl<false>(desc, fn, std::vector<T>(esperado));
}

/** comprueba("descripción", [&]{ return condicion; }): debe dar true. */
template <class F>
    requires std::is_invocable_v<F&>
void comprueba(detalle::Desc desc, F&& fn)
{
    detalle::compruebaImpl<false>(desc, fn, true);
}

/** comprueba("descripción", a == b). */
inline void comprueba(detalle::Desc desc, bool ok)
{
    detalle::compruebaImpl<false>(desc, ok, true);
}

/** Como comprueba(), pero el orden de las secuencias no importa (resultados que son conjuntos). */
template <class F, class E> void compruebaSinOrden(detalle::Desc desc, F&& fn, const E& esperado)
{
    detalle::compruebaImpl<true>(desc, fn, esperado);
}

template <class F, class T> void compruebaSinOrden(detalle::Desc desc, F&& fn, std::initializer_list<T> esperado)
{
    detalle::compruebaImpl<true>(desc, fn, std::vector<T>(esperado));
}

/** igual(a, b): la igualdad que usan las pruebas (ver detalle::igualEn). */
template <class A, class B> bool igual(const A& a, const B& b)
{
    return detalle::igualEn<false>(a, b);
}

template <class A, class B> bool igualSinOrden(const A& a, const B& b)
{
    return detalle::igualEn<true>(a, b);
}

/** mostrar(v): el texto con el que las pruebas enseñan un valor ({1, 2, 3}, "hola", (a, b)…). */
template <class T> std::string mostrar(const T& v)
{
    return detalle::mostrarMax(v, 100000);
}

using detalle::noOptimizar;

/** [1, 2, ..., n]. */
std::vector<int> numeros(int n);
/** Lo mismo que numeros(n) (en Java, lista(n) da una List; aquí todo es std::vector). */
std::vector<int> lista(int n);
/** n números pseudoaleatorios en 0..max, siempre los mismos para la misma semilla (el mismo generador que PHP/Java). */
std::vector<int> aleatorios(int n, int max, long long semilla = 1);
/** desde, desde+paso, ... hasta (incluido), como range() de PHP. Sin paso: 1 o -1 según el sentido. */
std::vector<int> rango(int desde, int hasta, int paso);
std::vector<int> rango(int desde, int hasta);

/**
 * medirCon("etiqueta", [](int n){ return entrada; }, [](auto& e){ operacion(e); }): preparar crea la entrada (no se
 * cronometra; si la operación la modifica, una nueva en cada repetición). Opcional: escala "geometrica" (64, 128, 256…)
 * o "lineal" (1..40), y tamaños concretos: medirCon("fib", [](int n){ return n; }, [](int n){ return fib(n); }, "lineal", rango(10, 30, 2)).
 */
template <class Prep, class Op>
void medirCon(detalle::Desc etiqueta, Prep preparar, Op operacion, std::string_view escala = "geometrica", const std::vector<int>& tamanos = {})
{
    static_assert(std::is_invocable_v<Prep&, int>, "medirCon(): el segundo argumento debe ser una lambda [](int n){ return entrada; }");
    using T = std::decay_t<std::invoke_result_t<Prep&, int>>;
    static_assert(std::is_invocable_v<Op&, T&>, "medirCon(): la operación debe recibir la entrada que crea preparar: [](auto& e){ ... }");
    detalle::FabricaCon<Prep, Op> fab(preparar, operacion);
    detalle::medirGeneral(etiqueta.texto, escala, tamanos, fab, etiqueta.linea);
}

} // namespace pg

// Lo que se usa sin «pg::» (si tienes algo con el mismo nombre, el tuyo choca con este: renómbralo)
using pg::aleatorios;
using pg::caso;
using pg::comprueba;
using pg::compruebaSinOrden;
using pg::grupo;
using pg::lista;
using pg::medirCon;
using pg::mostrar;
using pg::noOptimizar;
using pg::numeros;
using pg::pendiente;
using pg::rango;

// Envuelve una función por su nombre en una lambda genérica: valen sobrecargas, plantillas y argumentos por defecto
#define PG_ENVOLVER(fn) \
    [&](auto&&... pg_a) PG_SI -> decltype(fn(static_cast<decltype(pg_a)&&>(pg_a)...)) { return fn(static_cast<decltype(pg_a)&&>(pg_a)...); }

/** prueba(suma, caso("básico", 5, 2, 3), caso("negativos", 0, -1, 1)): la función, sin comillas. */
#define prueba(fn, ...) ::pg::detalle::pruebaImpl<0>(#fn, PG_ENVOLVER(fn), ::pg::detalle::SinComparador{}, __VA_ARGS__)
/** Como prueba(), pero el orden de las secuencias no importa. */
#define pruebaSinOrden(fn, ...) ::pg::detalle::pruebaImpl<1>(#fn, PG_ENVOLVER(fn), ::pg::detalle::SinComparador{}, __VA_ARGS__)
/** Con tu propio criterio: pruebaCon(fn, [](const auto& obtenido, const auto& esperado) { return ...; }, caso(...)...). */
#define pruebaCon(fn, ...) ::pg::detalle::pruebaImpl<2>(#fn, PG_ENVOLVER(fn), __VA_ARGS__)
/** lanza("descripción", [&]{ v.at(10); }, std::out_of_range): el tipo va el último. Si el cuerpo de la lambda tiene comas,
 *  el preprocesador la parte en varios argumentos: se cuentan y se vuelve a juntar todo lo que hay entre la descripción y el tipo. */
#define lanza(...) PG_CAT(PG_LANZA_, PG_NARGS(__VA_ARGS__))(__VA_ARGS__)
#define PG_CAT(a, b) PG_CAT_(a, b)
#define PG_CAT_(a, b) a##b
#define PG_NARGS(...) PG_NARGS_(__VA_ARGS__, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0)
#define PG_NARGS_(a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, N, ...) N
#define PG_LANZA_1(d) static_assert(false, "lanza(\"descripción\", [&]{ ... }, TipoDeExcepcion): faltan la lambda y el tipo")
#define PG_LANZA_2(d, f) static_assert(false, "lanza(\"descripción\", [&]{ ... }, TipoDeExcepcion): falta el tipo de la excepción")
#define PG_LANZA_3(d, f, t) ::pg::detalle::lanzaImpl<t>(d, f, #t)
#define PG_LANZA_4(d, a, b, t) ::pg::detalle::lanzaImpl<t>(d, (a, b), #t)
#define PG_LANZA_5(d, a, b, c, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c), #t)
#define PG_LANZA_6(d, a, b, c, e, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e), #t)
#define PG_LANZA_7(d, a, b, c, e, f, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f), #t)
#define PG_LANZA_8(d, a, b, c, e, f, g, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g), #t)
#define PG_LANZA_9(d, a, b, c, e, f, g, h, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h), #t)
#define PG_LANZA_10(d, a, b, c, e, f, g, h, i, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h, i), #t)
#define PG_LANZA_11(d, a, b, c, e, f, g, h, i, j, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h, i, j), #t)
#define PG_LANZA_12(d, a, b, c, e, f, g, h, i, j, k, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h, i, j, k), #t)
#define PG_LANZA_13(d, a, b, c, e, f, g, h, i, j, k, l, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h, i, j, k, l), #t)
#define PG_LANZA_14(d, a, b, c, e, f, g, h, i, j, k, l, m, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h, i, j, k, l, m), #t)
#define PG_LANZA_15(d, a, b, c, e, f, g, h, i, j, k, l, m, o, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h, i, j, k, l, m, o), #t)
#define PG_LANZA_16(d, a, b, c, e, f, g, h, i, j, k, l, m, o, p, t) ::pg::detalle::lanzaImpl<t>(d, (a, b, c, e, f, g, h, i, j, k, l, m, o, p), #t)
/** medir(ordenar, aleatorios(n, 1000, 1)): las expresiones en n crean la entrada de cada tamaño (fuera del cronómetro). */
#define medir(fn, ...) \
    ::pg::detalle::medirImpl(#fn, PG_ENVOLVER(fn), [&](int n) PG_SI { (void)n; return ::std::make_tuple(__VA_ARGS__); }, __LINE__)

// El main del usuario se declara aparte (pg_main0.hpp o pg_main2.hpp) con una etiqueta de ensamblador: así sigue
// siendo main para C++ pero el programa arranca en pg_main.cpp.

#endif // PG_HPP_INCLUIDO
