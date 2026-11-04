// Arranque del programa del usuario y la parte del harness que no depende de tipos. Se compila UNA vez por modo
// (checked, fast) y se enlaza con cada programa: var/cpp/obj/<firma>-<modo>/pg_main.o.
//
//  - stdout es la única salida (stderr se mezcla con ella en el servidor): la salida del programa y los eventos
//    \x1ePG{json}\x1f van por el mismo FILE, con búfer por líneas, así que el orden se conserva.
//  - main del usuario corre en un hilo con 256 MB de pila (la recursión profunda de las lecciones no debe romperse pronto).
//  - Excepción sin capturar → evento err {kind:'exception', cls, msg, pcs}; pg::PorHacer → {t:'todo'}; bad_alloc → 'memory'.
//  - Señales (SIGSEGV, SIGFPE, SIGABRT, SIGILL, SIGBUS) → err {kind:'segfault'|'stack'|'fpe'|'abort'} con código seguro
//    para señales. Con AddressSanitizer activo, SEGV/BUS/FPE los gestiona ASan (su informe va a un archivo de registro
//    que el servidor convierte en eventos); aquí solo se vacía stdout y se cierra con `end` al morir.
//  - Un hilo vigía corta el programa al vencer PG_TIMEOUT: antes pide al hilo del usuario dónde está (SIGUSR2) para
//    que el servidor diga en qué línea estaba el bucle.
//  - Las direcciones (`pcs`) son desplazamientos dentro del ejecutable: el servidor las traduce a líneas con addr2line.
//  - Variables: PG_BENCH (1 = medir de verdad), PG_TIMEOUT (5), PG_BENCH_BUDGET_MS (1500).

#define PG_INSTANCIAR_STL 1    // aquí se compilan las instancias de la STL que pg.hpp declara «extern template»
#include "pg.hpp"

#include <cinttypes>
#include <csignal>
#include <mutex>
#include <thread>

#if defined(__GNUG__) || defined(__clang__)
#include <cxxabi.h>
#include <unwind.h>
#define PG_GNU 1
#endif

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <psapi.h>
#include <io.h>
#else
#include <dlfcn.h>
#include <pthread.h>
#include <sys/resource.h>
#include <unistd.h>
#define PG_POSIX 1
#endif

#if defined(__has_feature)
#if __has_feature(address_sanitizer)
#define PG_ASAN 1
#endif
#endif
#if defined(__SANITIZE_ADDRESS__)
#define PG_ASAN 1
#endif

#if defined(PG_ASAN)
extern "C" {
int __lsan_do_recoverable_leak_check();
void __sanitizer_set_death_callback(void (*callback)(void));
}
#endif

// El main del usuario, renombrado por la etiqueta de ensamblador de pg_main0.hpp / pg_main2.hpp (se llama con
// (argc, argv) aunque no los declare: en las convenciones de llamada de C los argumentos de más se ignoran).
extern "C" int pg_main_usuario_(int, char**) __asm__("pg_main_usuario");

namespace pg::detalle {

std::atomic<int> lineaActual{0};
std::string grupoActual = "general";

namespace {

bool modoBench = false;
int presupuestoMs = 1500;
int plazoSegundos = 5;
std::chrono::steady_clock::time_point inicio;
std::atomic<bool> terminado{false};
std::atomic<bool> finEmitido{false};
std::atomic<bool> hubo{false};
std::mutex mutexSalida;

// ───────────────────────────── salida ─────────────────────────────

void escribirCrudo(const char* s, std::size_t n)
{
#if defined(_WIN32)
    _write(1, s, static_cast<unsigned>(n));
#else
    while (n > 0) {
        ssize_t w = ::write(1, s, n);
        if (w <= 0) return;
        s += w;
        n -= static_cast<std::size_t>(w);
    }
#endif
}

/** Escribe un evento ya formado en stdout, detrás de lo que el programa haya impreso. */
void emitirTexto(const std::string& ev)
{
    std::lock_guard<std::mutex> g(mutexSalida);
    std::cout.flush();    // por si el usuario hizo sync_with_stdio(false): su búfer va primero
    std::fwrite(ev.data(), 1, ev.size(), stdout);
    std::fflush(stdout);
}

/** Desde otro hilo (vigía): sin esperar indefinidamente a que el hilo del usuario suelte stdout. */
void emitirDesdeFuera(const std::string& ev)
{
#if defined(PG_POSIX)
    for (int intento = 0; intento < 50; ++intento) {
        if (ftrylockfile(stdout) == 0) {
            fflush_unlocked(stdout);
            fwrite_unlocked(ev.data(), 1, ev.size(), stdout);
            fflush_unlocked(stdout);
            funlockfile(stdout);
            return;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }
    escribirCrudo(ev.data(), ev.size());
#else
    std::fflush(stdout);
    escribirCrudo(ev.data(), ev.size());
#endif
}

// ───────────────────────────── JSON ─────────────────────────────

void hex4(std::string& o, unsigned v)
{
    static const char* d = "0123456789abcdef";
    o += "\\u";
    for (int s = 12; s >= 0; s -= 4) o += d[(v >> s) & 0xF];
}

} // namespace

/** "texto" con escapes JSON; los bytes que no son UTF-8 válido se cambian por U+FFFD (si no, el servidor perdería el evento). */
void jsonCadena(std::string& o, std::string_view s)
{
    o += '"';
    std::size_t i = 0;
    const std::size_t n = s.size();
    while (i < n) {
        unsigned char c = static_cast<unsigned char>(s[i]);
        if (c < 0x80) {
            switch (c) {
                case '"': o += "\\\""; break;
                case '\\': o += "\\\\"; break;
                case '\n': o += "\\n"; break;
                case '\r': o += "\\r"; break;
                case '\t': o += "\\t"; break;
                default:
                    if (c < 0x20 || c == 0x7f) hex4(o, c);
                    else o += static_cast<char>(c);
            }
            ++i;
            continue;
        }
        int len = (c & 0xE0) == 0xC0 ? 2 : (c & 0xF0) == 0xE0 ? 3 : (c & 0xF8) == 0xF0 ? 4 : 0;
        bool ok = len > 0 && i + static_cast<std::size_t>(len) <= n;
        for (int k = 1; ok && k < len; ++k) ok = (static_cast<unsigned char>(s[i + k]) & 0xC0) == 0x80;
        if (ok) {
            unsigned cp = c & (len == 2 ? 0x1F : len == 3 ? 0x0F : 0x07);
            for (int k = 1; k < len; ++k) cp = (cp << 6) | (static_cast<unsigned char>(s[i + k]) & 0x3F);
            ok = !(len == 2 && cp < 0x80) && !(len == 3 && cp < 0x800) && !(len == 4 && (cp < 0x10000 || cp > 0x10FFFF)) && !(cp >= 0xD800 && cp <= 0xDFFF);
        }
        if (ok) {
            o.append(s.data() + i, static_cast<std::size_t>(len));
            i += static_cast<std::size_t>(len);
        } else {
            o += "\xEF\xBF\xBD";
            ++i;
        }
    }
    o += '"';
}

Ev::Ev(const char* tipo)
{
    j_ = "{\"t\":";
    jsonCadena(j_, tipo);
}

Ev& Ev::s(const char* clave, std::string_view valor)
{
    j_ += ',';
    jsonCadena(j_, clave);
    j_ += ':';
    jsonCadena(j_, valor);
    return *this;
}

Ev& Ev::i(const char* clave, long long valor)
{
    j_ += ',';
    jsonCadena(j_, clave);
    j_ += ':';
    j_ += std::to_string(valor);
    return *this;
}

Ev& Ev::d(const char* clave, double valor, int decimales)
{
    j_ += ',';
    jsonCadena(j_, clave);
    j_ += ':';
    if (!std::isfinite(valor)) {
        j_ += "null";
        return *this;
    }
    char b[64];
    std::snprintf(b, sizeof b, "%.*f", decimales, valor);
    // sin ceros de más a la derecha (0.250000 → 0.25)
    std::string t = b;
    if (t.find('.') != std::string::npos) {
        while (!t.empty() && t.back() == '0') t.pop_back();
        if (!t.empty() && t.back() == '.') t.pop_back();
    }
    j_ += t.empty() || t == "-0" ? "0" : t;
    return *this;
}

Ev& Ev::raw(const char* clave, std::string_view json)
{
    j_ += ',';
    jsonCadena(j_, clave);
    j_ += ':';
    j_ += json;
    return *this;
}

void Ev::emitir()
{
    emitirTexto("\x1ePG" + j_ + "}\x1f");
}

// ───────────────────────────── nombres y excepciones ─────────────────────────────

std::string demangle(const char* nombre)
{
#if defined(PG_GNU)
    int st = 0;
    char* r = abi::__cxa_demangle(nombre, nullptr, nullptr, &st);
    if (st == 0 && r != nullptr) {
        std::string s = r;
        std::free(r);
        // Nombres largos de la biblioteca: std::__cxx11::basic_string<char, ...> → std::string
        auto cambia = [&](const std::string& de, const std::string& a) {
            for (std::size_t p = s.find(de); p != std::string::npos; p = s.find(de, p + a.size())) s.replace(p, de.size(), a);
        };
        cambia("std::__cxx11::basic_string<char, std::char_traits<char>, std::allocator<char> >", "std::string");
        cambia("std::__cxx11::", "std::");
        cambia("std::__1::", "std::");
        return s;
    }
#endif
    return nombre;
}

namespace {

#if defined(PG_GNU) && defined(PG_POSIX)
std::string tipoEnVuelo()
{
    const std::type_info* t = abi::__cxa_current_exception_type();
    return t ? demangle(t->name()) : std::string();
}
#else
std::string tipoEnVuelo()
{
    return "excepción";
}
#endif

} // namespace

std::string tipoActual()
{
    return tipoEnVuelo();
}

std::string describirActual()
{
    std::exception_ptr p = std::current_exception();
    if (!p) return "";
    try {
        std::rethrow_exception(p);
    } catch (const PorHacer& e) {
        return "pendiente: " + e.msg;
    } catch (const std::exception& e) {
        return demangle(typeid(e).name()) + ": " + e.what();
    } catch (const char* s) {
        return std::string("const char*: \"") + (s ? s : "") + "\"";
    } catch (const std::string& s) {
        return "std::string: \"" + s + "\"";
    } catch (int v) {
        return "int: " + std::to_string(v);
    } catch (long long v) {
        return "long long: " + std::to_string(v);
    } catch (...) {
        return tipoEnVuelo();
    }
}

[[noreturn]] void lanzarPorHacer(std::string_view msg, int linea)
{
    throw PorHacer{std::string(msg), linea};
}

double ms(std::chrono::steady_clock::time_point t0)
{
    return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
}

// ───────────────────────────── dónde se lanzó (pcs) ─────────────────────────────

namespace {

constexpr int MAX_PCS = 48;

struct Pcs {
    std::uintptr_t pc[MAX_PCS];
    int n = 0;
};

#if defined(PG_GNU) && defined(PG_POSIX)
std::uintptr_t baseEjecutable = 0;
std::uintptr_t finEjecutable = UINTPTR_MAX;

struct Recogida {
    Pcs* destino;
    int saltar;
};

_Unwind_Reason_Code recogerFrame(struct _Unwind_Context* ctx, void* arg)
{
    auto* r = static_cast<Recogida*>(arg);
    if (r->saltar > 0) {
        --r->saltar;
        return _URC_NO_REASON;
    }
    int antes = 0;
    std::uintptr_t ip = _Unwind_GetIPInfo(ctx, &antes);
    if (ip == 0) return _URC_END_OF_STACK;
    if (!antes && ip > 0) --ip;    // dirección de retorno: la instrucción de la llamada es la anterior
    if (r->destino->n >= MAX_PCS) return _URC_END_OF_STACK;
    r->destino->pc[r->destino->n++] = ip;
    return _URC_NO_REASON;
}

void recoger(Pcs& p, int saltar)
{
    p.n = 0;
    Recogida r{&p, saltar};
    _Unwind_Backtrace(recogerFrame, &r);
}

/** "[\"0x1a2b\",...]" con las direcciones que caen dentro del ejecutable (relativas a su base de carga). */
std::string pcsJson(const Pcs& p)
{
    std::string o = "[";
    bool primero = true;
    for (int i = 0; i < p.n; ++i) {
        std::uintptr_t a = p.pc[i];
        if (a < baseEjecutable || a >= finEjecutable) continue;
        char b[32];
        std::snprintf(b, sizeof b, "\"0x%" PRIxPTR "\"", a - baseEjecutable);
        o += primero ? "" : ",";
        o += b;
        primero = false;
    }
    return o + "]";
}

thread_local Pcs ultimoThrow;
thread_local const std::type_info* ultimoTipo = nullptr;
#endif

} // namespace

std::string pcsUltimoThrow()
{
#if defined(PG_GNU) && defined(PG_POSIX)
    const std::type_info* t = abi::__cxa_current_exception_type();
    if (t == nullptr || ultimoTipo == nullptr || *t != *ultimoTipo) return "";
    return pcsJson(ultimoThrow);
#else
    return "";
#endif
}

} // namespace pg::detalle

#if defined(PG_GNU) && defined(__linux__)
// Se intercepta __cxa_throw (también los throw de dentro de libstdc++, como vector::at) para guardar DÓNDE se lanzó:
// sin esto, al capturarla en main la pila ya se ha deshecho y no se sabe la línea. Solo copia direcciones (barato).
extern "C" [[noreturn]] void __cxa_throw(void* obj, void* tinfo, void (*dest)(void*))
{
    using Real = void (*)(void*, void*, void (*)(void*));
    static Real real = reinterpret_cast<Real>(dlsym(RTLD_NEXT, "__cxa_throw"));
    pg::detalle::recoger(pg::detalle::ultimoThrow, 1);
    pg::detalle::ultimoTipo = static_cast<const std::type_info*>(tinfo);
    real(obj, tinfo, dest);
    __builtin_unreachable();
}
#endif

namespace pg::detalle {

// ───────────────────────────── pruebas ─────────────────────────────

namespace {

void eventoPrueba(const std::string& grupo, const std::string& nombre, const char* estado, int linea, double msT, const std::string* input,
                  const std::string* esperado, const std::string* actual, const std::string* msg, const std::string& pcs, int total)
{
    Ev e("test");
    e.s("group", grupo).s("name", nombre).s("status", estado);
    if (input) e.s("input", *input);
    if (esperado) e.s("expected", *esperado);
    if (actual) e.s("actual", *actual);
    if (msg) e.s("msg", *msg);
    if (total >= 0) e.i("total", total);
    if (std::string_view(estado) != "todo") e.d("ms", msT, 3);
    e.i("line", linea > 0 ? linea : 1);
    if (!pcs.empty() && pcs != "[]") e.raw("pcs", pcs);
    e.emitir();
}

} // namespace

bool correrCaso(const std::string& grupo, const std::string& nombre, int linea, const std::string& input, const std::string& esperado, FnRef<Salida> cuerpo,
                int total)
{
    lineaActual.store(linea, std::memory_order_relaxed);
    auto t0 = std::chrono::steady_clock::now();
    bool seguir = true;
    try {
        Salida r = cuerpo();
        eventoPrueba(grupo, nombre, r.ok ? "pass" : "fail", linea, ms(t0), &input, &esperado, &r.actual, nullptr, "", -1);
    } catch (const PorHacer&) {
        eventoPrueba(grupo, "(todos los casos)", "todo", linea, 0, nullptr, nullptr, nullptr, nullptr, "", total);
        seguir = false;
    } catch (...) {
        std::string msg = describirActual();
        eventoPrueba(grupo, nombre, "error", linea, ms(t0), &input, &esperado, nullptr, &msg, pcsUltimoThrow(), -1);
    }
    lineaActual.store(0, std::memory_order_relaxed);
    return seguir;
}

void correrComprueba(const std::string& desc, int linea, const std::string& esperado, FnRef<Salida> cuerpo)
{
    lineaActual.store(linea, std::memory_order_relaxed);
    auto t0 = std::chrono::steady_clock::now();
    try {
        Salida r = cuerpo();
        eventoPrueba(grupoActual, desc, r.ok ? "pass" : "fail", linea, ms(t0), nullptr, &esperado, &r.actual, nullptr, "", -1);
    } catch (const PorHacer&) {
        eventoPrueba(grupoActual, desc, "todo", linea, 0, nullptr, &esperado, nullptr, nullptr, "", -1);
    } catch (...) {
        std::string msg = describirActual();
        eventoPrueba(grupoActual, desc, "error", linea, ms(t0), nullptr, &esperado, nullptr, &msg, pcsUltimoThrow(), -1);
    }
    lineaActual.store(0, std::memory_order_relaxed);
}

void correrLanza(const std::string& desc, int linea, const std::string& esperado, void (*llamar)(void*), void* fn, bool (*esDelTipo)())
{
    lineaActual.store(linea, std::memory_order_relaxed);
    auto t0 = std::chrono::steady_clock::now();
    try {
        llamar(fn);
        std::string act = "no lanzó nada";
        eventoPrueba(grupoActual, desc, "fail", linea, ms(t0), nullptr, &esperado, &act, nullptr, "", -1);
    } catch (const PorHacer&) {
        eventoPrueba(grupoActual, desc, "todo", linea, 0, nullptr, &esperado, nullptr, nullptr, "", -1);
    } catch (...) {
        std::string act = "lanzó " + describirActual();
        eventoPrueba(grupoActual, desc, esDelTipo() ? "pass" : "fail", linea, ms(t0), nullptr, &esperado, &act, nullptr, "", -1);
    }
    lineaActual.store(0, std::memory_order_relaxed);
}

// Las combinaciones de tipos más habituales se compilan aquí una vez (en pg.hpp están como «extern template»)
#define PG_INST_MOSTRAR(T) template std::string mostrarMax<T>(const T&, std::size_t);
#define PG_INST_IGUAL(T) template bool igualEn<false, T, T>(const T&, const T&);
#define PG_INST_IGUAL2(A, B) template bool igualEn<false, A, B>(const A&, const B&);
PG_TIPOS_COMUNES(PG_INST_MOSTRAR)
PG_TIPOS_COMUNES(PG_INST_IGUAL)
PG_PARES_COMUNES(PG_INST_IGUAL2)
template bool igualEn<true, VInt, VInt>(const VInt&, const VInt&);
template bool igualEn<true, VVInt, VVInt>(const VVInt&, const VVInt&);
template bool igualEn<true, VString, VString>(const VString&, const VString&);

// ───────────────────────────── medir ─────────────────────────────

namespace {

using Reloj = std::chrono::steady_clock;

/** Milisegundos por llamada en una tanda de k repeticiones (la preparación no se cronometra). */
double tanda(Fabrica& f, int n, int k)
{
    f.preparar(n, k);
    auto t0 = Reloj::now();
    for (int i = 0; i < k; ++i) f.ejecutar(i);
    return ms(t0) / k;
}

/** Milisegundos por llamada (mínimo de varias tandas, para filtrar el ruido). */
double unaMedida(Fabrica& f, int n)
{
    double primera = tanda(f, n, 1);
    if (primera > 50) return primera;
    if (primera > 2) {
        double mejor = primera;
        for (int i = 0; i < 2; ++i) mejor = std::min(mejor, tanda(f, n, 1));
        return mejor;
    }
    int k = static_cast<int>(std::min(200000.0, std::max(1.0, std::ceil(2.0 / std::max(primera, 0.0002)))));
    if (!f.compartido) k = std::max(1, std::min(k, 1'000'000 / std::max(n, 1)));    // cada repetición tiene su entrada: acota la memoria
    double mejor = 1e300;
    for (int t = 0; t < 5; ++t) mejor = std::min(mejor, tanda(f, n, k));
    return mejor;
}

/** Calienta cachés y frecuencia de la CPU con varios tamaños (unas decenas de ms). */
void calentar(Fabrica& f, const std::vector<int>& tams)
{
    int ult = static_cast<int>(tams.size()) - 1;
    for (int idx : {0, std::min(2, ult), std::min(5, ult)}) {
        auto ini = Reloj::now();
        double una = tanda(f, tams[static_cast<std::size_t>(idx)], 1);
        if (una > 20) continue;    // una sola llamada ya es lenta: no hace falta calentar
        while (ms(ini) < 25) tanda(f, tams[static_cast<std::size_t>(idx)], 1);
    }
}

} // namespace

void medirGeneral(std::string_view nombre, std::string_view escala, const std::vector<int>& tamanos, Fabrica& f, int linea)
{
    if (!modoBench) {
        Ev("bench").s("name", nombre).s("status", "skipped").emitir();
        return;
    }
    bool lineal = escala == "lineal";
    if (escala != "lineal" && escala != "geometrica") {
        Ev("bench").s("name", nombre).s("status", "error").s("msg", "La escala de medir() es \"geometrica\" o \"lineal\" (no \"" + std::string(escala) + "\")")
            .i("line", linea).emitir();
        return;
    }
    std::vector<int> tams = tamanos;
    if (tams.empty()) {
        if (lineal)
            for (int i = 1; i <= 40; ++i) tams.push_back(i);
        else
            for (int e = 6; e <= 17; ++e) tams.push_back(1 << e);
    }
    int lineaAntes = lineaActual.load();
    lineaActual.store(linea);
    std::string puntos = "[";
    double gastado = 0;
    const char* parada = "done";
    try {
        calentar(f, tams);
        bool primero = true;
        for (int n : tams) {
            auto t0 = Reloj::now();
            double por = std::max(unaMedida(f, n), 1e-7);
            char b[80];
            std::snprintf(b, sizeof b, "%s[%d,%.7g]", primero ? "" : ",", n, std::round(por * 1e6) / 1e6 > 0 ? std::round(por * 1e6) / 1e6 : por);
            puntos += b;
            primero = false;
            gastado += ms(t0);
            if (por > 250) {
                parada = "slow";    // una sola llamada ya tarda más de 250 ms
                break;
            }
            if (gastado > presupuestoMs) {
                parada = "budget";
                break;
            }
        }
    } catch (const PorHacer&) {
        Ev("bench").s("name", nombre).s("status", "todo").emitir();
        lineaActual.store(lineaAntes);
        return;
    } catch (...) {
        Ev e("bench");
        e.s("name", nombre).s("status", "error").s("msg", describirActual()).i("line", linea);
        std::string p = pcsUltimoThrow();
        if (!p.empty() && p != "[]") e.raw("pcs", p);
        e.emitir();
        lineaActual.store(lineaAntes);
        return;
    }
    lineaActual.store(lineaAntes);
    // Solo los puntos: el ajuste del modelo (O(n), O(n²)...) lo hace el servidor, igual para todos los lenguajes.
    Ev("bench").s("name", nombre).s("status", "ok").s("scale", lineal ? "lineal" : "geometrica").s("stopped", parada).raw("points", puntos + "]").emitir();
}

// ───────────────────────────── formato de números ─────────────────────────────

std::string citar(std::string_view s, char comilla)
{
    std::string o(1, comilla);
    for (char ch : s) {
        switch (ch) {
            case '\\': o += "\\\\"; break;
            case '\n': o += "\\n"; break;
            case '\r': o += "\\r"; break;
            case '\t': o += "\\t"; break;
            case '\0': o += "\\0"; break;
            default:
                if (ch == comilla) {
                    o += '\\';
                    o += ch;
                } else {
                    o += ch;
                }
        }
    }
    return o + comilla;
}

namespace {
template <class T> std::string decimalCorto(T v)
{
    if (std::isnan(v)) return "nan";
    if (std::isinf(v)) return v > 0 ? "inf" : "-inf";
    char b[64];
    for (int p = std::numeric_limits<T>::digits10; p <= std::numeric_limits<T>::max_digits10; ++p) {
        std::snprintf(b, sizeof b, "%.*Lg", p, static_cast<long double>(v));
        if (static_cast<T>(std::strtold(b, nullptr)) == v) break;
    }
    return b;
}
} // namespace

std::string numeroDecimal(double v)
{
    return decimalCorto(v);
}
std::string numeroDecimal(float v)
{
    return decimalCorto(v);
}
std::string numeroDecimal(long double v)
{
    return decimalCorto(v);
}

} // namespace pg::detalle

// ───────────────────────────── ayudas de datos ─────────────────────────────

namespace pg {

std::vector<int> rango(int desde, int hasta, int paso)
{
    if (paso == 0 || (paso > 0 && desde > hasta) || (paso < 0 && desde < hasta)) return {};
    long long n = (static_cast<long long>(hasta) - desde) / paso + 1;
    std::vector<int> r(static_cast<std::size_t>(n));
    for (long long i = 0; i < n; ++i) r[static_cast<std::size_t>(i)] = static_cast<int>(desde + i * paso);
    return r;
}

std::vector<int> rango(int desde, int hasta)
{
    return rango(desde, hasta, desde <= hasta ? 1 : -1);
}

std::vector<int> numeros(int n)
{
    return rango(1, n, 1);
}

std::vector<int> lista(int n)
{
    return rango(1, n, 1);
}

std::vector<int> aleatorios(int n, int max, long long semilla)
{
    std::vector<int> r(static_cast<std::size_t>(std::max(n, 0)));
    long long x = semilla;
    for (auto& v : r) {
        x = (x * 1103515245LL + 12345LL) & 0x7fffffffLL;
        v = static_cast<int>(x % (max + 1LL));
    }
    return r;
}

} // namespace pg

// ═════════════════════════════ arranque, señales, vigía ═════════════════════════════

namespace {

using namespace pg::detalle;

int entero(const char* s, int def)
{
    if (s == nullptr || *s == '\0') return def;
    char* fin = nullptr;
    long v = std::strtol(s, &fin, 10);
    return fin == s ? def : static_cast<int>(v);
}

void memoria(long long& actual, long long& pico)
{
    actual = 0;
    pico = 0;
#if defined(_WIN32)
    PROCESS_MEMORY_COUNTERS pmc;
    if (K32GetProcessMemoryInfo(GetCurrentProcess(), &pmc, sizeof pmc)) {
        actual = static_cast<long long>(pmc.WorkingSetSize);
        pico = static_cast<long long>(pmc.PeakWorkingSetSize);
    }
#else
    struct rusage ru {};
    if (getrusage(RUSAGE_SELF, &ru) == 0) {
#if defined(__APPLE__)
        pico = static_cast<long long>(ru.ru_maxrss);
#else
        pico = static_cast<long long>(ru.ru_maxrss) * 1024;
#endif
    }
#if defined(__linux__)
    if (FILE* f = std::fopen("/proc/self/statm", "r")) {
        long tam = 0, res = 0;
        if (std::fscanf(f, "%ld %ld", &tam, &res) == 2) actual = static_cast<long long>(res) * sysconf(_SC_PAGESIZE);
        std::fclose(f);
    }
#endif
    if (actual == 0) actual = pico;
#endif
}

/** Evento `end` (una sola vez). Con LeakSanitizer, antes se buscan fugas (el servidor las convierte en avisos). */
void fin(bool comprobarFugas)
{
    if (finEmitido.exchange(true)) return;
#if defined(PG_ASAN)
    if (comprobarFugas && !hubo.load()) __lsan_do_recoverable_leak_check();
#else
    (void)comprobarFugas;
#endif
    long long actual, pico;
    memoria(actual, pico);
    Ev("end").d("ms", ms(inicio), 2).i("mem", actual).i("peak", pico).emitir();
}

void finAlSalir()
{
    fin(true);    // exit() del usuario (o el final normal): igualmente se cierra con `end`
}

/** Convierte una excepción que llegó hasta main en evento. Un PorHacer se cuenta como pendiente, como en PHP y Java. */
void informarExcepcion()
{
    hubo = true;
    std::exception_ptr p = std::current_exception();
    try {
        std::rethrow_exception(p);
    } catch (const pg::PorHacer& e) {
        Ev("todo").s("msg", e.msg).i("line", e.linea > 0 ? e.linea : std::max(1, lineaActual.load())).raw("trace", "[]").emitir();
        return;
    } catch (...) {
    }
    std::string tipo = tipoActual();
    std::string msg;
    const char* kind = "exception";
    try {
        std::rethrow_exception(p);
    } catch (const std::bad_alloc& e) {
        kind = "memory";
        tipo = demangle(typeid(e).name());
        msg = e.what();
    } catch (const std::exception& e) {
        tipo = demangle(typeid(e).name());
        msg = e.what();
    } catch (const char* s) {
        msg = s ? s : "";
    } catch (const std::string& s) {
        msg = s;
    } catch (...) {
        msg = describirActual();
    }
    Ev e("err");
    e.s("kind", kind).s("cls", tipo).s("msg", msg).i("line", lineaActual.load());
    std::string pcs = pcsUltimoThrow();
    if (!pcs.empty()) e.raw("pcs", pcs);
    e.emitir();
}

void alTerminar()
{
    // std::terminate fuera del try de arranque: noexcept violado, throw en un destructor durante otro throw, std::thread sin join…
    static std::atomic<bool> dentro{false};
    if (!dentro.exchange(true)) {
        if (std::current_exception()) {
            informarExcepcion();
        } else {
            hubo = true;
            Ev("err").s("kind", "abort").s("cls", "std::terminate").s("msg", "Se llamó a std::terminate() (¿un std::thread sin join(), o una excepción en un noexcept?)")
                .i("line", lineaActual.load()).emitir();
        }
        fin(false);
    }
    std::fflush(stdout);
    std::_Exit(255);
}

// ───────────────────────────── señales (POSIX) ─────────────────────────────

#if defined(PG_POSIX)

// Todo lo de aquí corre dentro de un manejador de señal: nada de malloc ni stdio (salvo un fflush si stdout está libre).
char bufSenal[4096];
std::size_t largoSenal = 0;
std::uintptr_t pilaBaja = 0, pilaAlta = 0;    // pila del hilo del usuario (para reconocer el desbordamiento)
Pcs pcsSenal;
std::atomic<bool> pcsListos{false};
pthread_t hiloUsuario;
std::atomic<bool> hayHiloUsuario{false};

void ap(const char* s)
{
    while (*s && largoSenal + 1 < sizeof bufSenal) bufSenal[largoSenal++] = *s++;
}

void apNum(unsigned long long v, int base)
{
    char t[24];
    int k = 0;
    do {
        t[k++] = "0123456789abcdef"[v % static_cast<unsigned>(base)];
        v /= static_cast<unsigned>(base);
    } while (v && k < 23);
    while (k > 0 && largoSenal + 1 < sizeof bufSenal) bufSenal[largoSenal++] = t[--k];
}

void apPcs(const Pcs& p)
{
    ap(",\"pcs\":[");
    bool primero = true;
    for (int i = 0; i < p.n; ++i) {
        std::uintptr_t a = p.pc[i];
        if (a < baseEjecutable || a >= finEjecutable) continue;
        ap(primero ? "\"0x" : ",\"0x");
        apNum(a - baseEjecutable, 16);
        ap("\"");
        primero = false;
    }
    ap("]");
}

void vaciarStdoutSiSePuede()
{
    if (ftrylockfile(stdout) == 0) {
        fflush_unlocked(stdout);
        funlockfile(stdout);
    }
}

void alSenal(int sig, siginfo_t* info, void*)
{
    static std::atomic<bool> dentro{false};
    if (dentro.exchange(true)) _exit(255);
    vaciarStdoutSiSePuede();
    std::uintptr_t dir = info ? reinterpret_cast<std::uintptr_t>(info->si_addr) : 0;
    const char* kind = "segfault";
    const char* cls = "SIGSEGV";
    const char* msg = "Segmentation fault: acceso a memoria no válida";
    bool pila = (sig == SIGSEGV || sig == SIGBUS) && pilaBaja != 0 && dir + (1u << 20) >= pilaBaja && dir < pilaBaja + (64u << 10);
    if (pila) {
        kind = "stack";
        cls = "StackOverflow";
        msg = "Stack overflow: se agotaron los 256 MB de pila";
    } else if (sig == SIGFPE) {
        kind = "fpe";
        cls = "SIGFPE";
        msg = "Floating point exception: operación aritmética no válida (¿división entera entre cero?)";
    } else if (sig == SIGABRT) {
        kind = "abort";
        cls = "SIGABRT";
        msg = "Aborted: el programa se abortó (assert que falla, o una comprobación de la biblioteca)";
    } else if (sig == SIGILL) {
        kind = "abort";
        cls = "SIGILL";
        msg = "Illegal instruction (¿una función que debía devolver un valor terminó sin return?)";
    } else if (sig == SIGBUS) {
        cls = "SIGBUS";
        msg = "Bus error: acceso a memoria no válida";
    }
    Pcs p;
    if (!pila) recoger(p, 0);    // con la pila desbordada se recorre igual, pero con tope de MAX_PCS
    else recoger(p, 0);
    largoSenal = 0;
    ap("\x1ePG{\"t\":\"err\",\"kind\":\"");
    ap(kind);
    ap("\",\"cls\":\"");
    ap(cls);
    ap("\",\"msg\":\"");
    ap(msg);
    ap("\",\"line\":");
    apNum(static_cast<unsigned long long>(std::max(0, lineaActual.load())), 10);
    if (sig == SIGSEGV || sig == SIGBUS) {
        ap(",\"addr\":\"0x");
        apNum(dir, 16);
        ap("\"");
    }
    apPcs(p);
    ap("}\x1f\x1ePG{\"t\":\"end\",\"ms\":");
    apNum(static_cast<unsigned long long>(ms(inicio)), 10);
    ap(",\"mem\":0,\"peak\":0}\x1f");
    finEmitido = true;
    escribirCrudo(bufSenal, largoSenal);
    _exit(255);
}

/** El vigía pide al hilo del usuario dónde está: se guardan sus direcciones (código seguro para señales). */
void alPedirPila(int, siginfo_t*, void*)
{
    recoger(pcsSenal, 0);
    pcsListos = true;
}

void instalarSenales()
{
    struct sigaction sa {};
    sa.sa_sigaction = alSenal;
    sa.sa_flags = SA_SIGINFO | SA_ONSTACK;
    sigemptyset(&sa.sa_mask);
#if defined(PG_ASAN)
    // SEGV, BUS y FPE los gestiona AddressSanitizer (informe completo en su registro); abort e instrucción ilegal, nosotros
    const int senales[] = {SIGABRT, SIGILL};
#else
    const int senales[] = {SIGSEGV, SIGBUS, SIGFPE, SIGABRT, SIGILL};
#endif
    for (int s : senales) sigaction(s, &sa, nullptr);
    struct sigaction sp {};
    sp.sa_sigaction = alPedirPila;
    sp.sa_flags = SA_SIGINFO | SA_RESTART;
    sigemptyset(&sp.sa_mask);
    sigaction(SIGUSR2, &sp, nullptr);
}

void localizarEjecutable()
{
    Dl_info di{};
    if (dladdr(reinterpret_cast<void*>(&localizarEjecutable), &di) && di.dli_fbase) {
        baseEjecutable = reinterpret_cast<std::uintptr_t>(di.dli_fbase);
        finEjecutable = UINTPTR_MAX;
        // El ejecutable es lo primero que se carga; las bibliotecas van a otras direcciones (y se filtran por dladdr)
    }
}

#endif

// ───────────────────────────── vigía ─────────────────────────────

void vigia()
{
    auto limite = inicio + std::chrono::seconds(plazoSegundos);
    while (std::chrono::steady_clock::now() < limite) {
        if (terminado.load()) return;
        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }
    if (terminado.load()) return;
    hubo = true;
    std::string pcs;
#if defined(PG_POSIX) && defined(PG_GNU)
    if (hayHiloUsuario.load() && pthread_kill(hiloUsuario, SIGUSR2) == 0) {
        for (int i = 0; i < 100 && !pcsListos.load(); ++i) std::this_thread::sleep_for(std::chrono::milliseconds(2));
        if (pcsListos.load()) pcs = pcsJson(pcsSenal);
    }
#endif
    std::string ev = "\x1ePG{\"t\":\"err\",\"kind\":\"timeout\",\"msg\":\"Maximum execution time of " + std::to_string(plazoSegundos) +
                     " seconds exceeded\",\"line\":" + std::to_string(lineaActual.load()) + (pcs.empty() ? "" : ",\"pcs\":" + pcs) + "}\x1f";
    emitirDesdeFuera(ev);
    if (!finEmitido.exchange(true)) {
        long long actual, pico;
        memoria(actual, pico);
        char b[160];
        std::snprintf(b, sizeof b, "\x1ePG{\"t\":\"end\",\"ms\":%.2f,\"mem\":%lld,\"peak\":%lld}\x1f", ms(inicio), actual, pico);
        emitirDesdeFuera(b);
    }
    std::_Exit(255);
}

// ───────────────────────────── el hilo del usuario ─────────────────────────────

struct Arranque {
    int argc;
    char** argv;
    int codigo = 0;
};

void ejecutarUsuario(Arranque* a)
{
    try {
        a->codigo = pg_main_usuario_(a->argc, a->argv);
    } catch (...) {
        informarExcepcion();
        a->codigo = 255;
    }
}

#if defined(PG_POSIX)
void* hiloPosix(void* p)
{
    // Pila alternativa para poder contar un desbordamiento de pila (sin ella, el manejador no tendría dónde correr)
#if !defined(PG_ASAN)
    static char alterna[1 << 16];
    stack_t ss{};
    ss.ss_sp = alterna;
    ss.ss_size = sizeof alterna;
    sigaltstack(&ss, nullptr);
#endif
    pthread_attr_t at;
    if (pthread_getattr_np(pthread_self(), &at) == 0) {
        void* dir = nullptr;
        std::size_t tam = 0;
        if (pthread_attr_getstack(&at, &dir, &tam) == 0) {
            pilaBaja = reinterpret_cast<std::uintptr_t>(dir);
            pilaAlta = pilaBaja + tam;
        }
        pthread_attr_destroy(&at);
    }
    ejecutarUsuario(static_cast<Arranque*>(p));
    return nullptr;
}
#elif defined(_WIN32)
DWORD WINAPI hiloWindows(LPVOID p)
{
    ejecutarUsuario(static_cast<Arranque*>(p));
    return 0;
}

LONG WINAPI alExcepcionWindows(EXCEPTION_POINTERS* ep)
{
    DWORD c = ep->ExceptionRecord->ExceptionCode;
    const char* kind = "segfault";
    const char* msg = "Access violation: acceso a memoria no válida";
    if (c == EXCEPTION_STACK_OVERFLOW) {
        kind = "stack";
        msg = "Stack overflow: se agotaron los 256 MB de pila";
    } else if (c == EXCEPTION_INT_DIVIDE_BY_ZERO) {
        kind = "fpe";
        msg = "Integer division by zero";
    } else if (c != EXCEPTION_ACCESS_VIOLATION && c != EXCEPTION_ARRAY_BOUNDS_EXCEEDED && c != EXCEPTION_ILLEGAL_INSTRUCTION) {
        return EXCEPTION_CONTINUE_SEARCH;
    }
    char b[512];
    int n = std::snprintf(b, sizeof b, "\x1ePG{\"t\":\"err\",\"kind\":\"%s\",\"msg\":\"%s\",\"line\":%d}\x1f\x1ePG{\"t\":\"end\",\"ms\":0,\"mem\":0,\"peak\":0}\x1f", kind,
                          msg, lineaActual.load());
    std::fflush(stdout);
    escribirCrudo(b, static_cast<std::size_t>(n));
    TerminateProcess(GetCurrentProcess(), 255);
    return EXCEPTION_EXECUTE_HANDLER;
}
#endif

#if defined(PG_ASAN)
void alMorirSanitizer()
{
    // ASan/UBSan van a terminar el proceso: lo impreso hasta aquí no se pierde, y se cierra con `end`
    hubo = true;
#if defined(PG_POSIX)
    vaciarStdoutSiSePuede();
#endif
    if (!finEmitido.exchange(true)) {
        long long actual, pico;
        memoria(actual, pico);
        char b[160];
        int n = std::snprintf(b, sizeof b, "\x1ePG{\"t\":\"end\",\"ms\":%.2f,\"mem\":%lld,\"peak\":%lld}\x1f", ms(inicio), actual, pico);
        escribirCrudo(b, static_cast<std::size_t>(n));
    }
}
#endif

} // namespace

int main(int argc, char** argv)
{
    inicio = std::chrono::steady_clock::now();
    // Búfer por líneas: rápido, y si el programa muere de golpe se pierde como mucho la última línea a medias
    std::setvbuf(stdout, nullptr, _IOLBF, 1 << 16);
    modoBench = entero(std::getenv("PG_BENCH"), 0) == 1;
    plazoSegundos = std::max(1, entero(std::getenv("PG_TIMEOUT"), 5));
    presupuestoMs = std::max(50, entero(std::getenv("PG_BENCH_BUDGET_MS"), 1500));

    std::set_terminate(alTerminar);
    std::atexit(finAlSalir);
#if defined(PG_ASAN)
    __sanitizer_set_death_callback(alMorirSanitizer);
#endif
#if defined(PG_POSIX)
    localizarEjecutable();
    instalarSenales();
#if !defined(PG_ASAN) && defined(__linux__)
    // Sin ASan, un límite de memoria: pedir de más da std::bad_alloc (kind 'memory') en vez de dejar el PC sin RAM
    struct rlimit rl {};
    rl.rlim_cur = rl.rlim_max = static_cast<rlim_t>(4096) << 20;
    setrlimit(RLIMIT_AS, &rl);
#endif
#elif defined(_WIN32)
    SetUnhandledExceptionFilter(alExcepcionWindows);
#endif

    std::thread(vigia).detach();

    char nombre[] = "programa";
    char* args[] = {nombre, nullptr};
    Arranque a{1, args};
    (void)argc;
    (void)argv;
#if defined(PG_POSIX)
    pthread_attr_t at;
    pthread_attr_init(&at);
    pthread_attr_setstacksize(&at, static_cast<std::size_t>(256) << 20);
    pthread_attr_setguardsize(&at, static_cast<std::size_t>(64) << 10);
    pthread_t h;
    if (pthread_create(&h, &at, hiloPosix, &a) != 0) {
        ejecutarUsuario(&a);    // sin hilo: en el principal, con la pila que haya
    } else {
        hiloUsuario = h;
        hayHiloUsuario = true;
        pthread_join(h, nullptr);
    }
    pthread_attr_destroy(&at);
#elif defined(_WIN32)
    HANDLE h = CreateThread(nullptr, static_cast<SIZE_T>(256) << 20, hiloWindows, &a, STACK_SIZE_PARAM_IS_A_RESERVATION, nullptr);
    if (h == nullptr) {
        ejecutarUsuario(&a);
    } else {
        WaitForSingleObject(h, INFINITE);
        CloseHandle(h);
    }
#else
    ejecutarUsuario(&a);
#endif
    terminado = true;
    std::cout.flush();
    std::fflush(stdout);
    fin(true);
    std::fflush(stdout);
    std::exit(hubo.load() ? 255 : a.codigo);
}
