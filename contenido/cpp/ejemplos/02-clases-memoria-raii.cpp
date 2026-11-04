#include <algorithm>
#include <functional>
#include <iostream>
#include <map>
#include <memory>
#include <numeric>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <typeindex>
#include <unordered_map>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 2 · CLASES, MEMORIA Y RAII
 * ────────────────────────────────────────────────────────────────────────────
 * En Java o PHP escribes la clase y el recolector de basura se ocupa de cuándo muere cada objeto. En C++ NO hay
 * recolector: el ciclo de vida de un objeto es parte del diseño de la clase. A cambio, todo es predecible y rápido,
 * y la misma idea (RAII) sirve para memoria, archivos, candados, conexiones...
 *
 *   Idea                 Qué significa en C++
 *   Constructor          construye el objeto; la LISTA DE INICIALIZACIÓN (`: campo(valor)`) construye los campos antes del cuerpo
 *   Destructor ~T()      se ejecuta SOLO al morir el objeto (al cerrar el bloque, al borrarlo...). Aquí se libera todo
 *   RAII                 «el objeto es dueño del recurso»: lo adquiere en el constructor y lo libera en el destructor
 *   Regla del 0          si tus campos ya son vector/string/unique_ptr..., NO escribas destructor ni copia: salen bien solos
 *   Regla del 3 / 5      si gestionas un recurso a mano, escribe (o prohíbe) destructor, copia (2) y move (2)
 *   Move (std::move)     «roba» los recursos de un objeto que va a morir en vez de copiarlos (O(1) en vez de O(n))
 *   virtual / override   polimorfismo (y destructor virtual en las bases); `= 0` = método abstracto
 *   Smart pointers       unique_ptr (un dueño) · shared_ptr (varios dueños, cuenta de referencias) · weak_ptr (observa)
 *   Plantillas           código genérico que el compilador instancia por tipo (en tiempo de compilación)
 *
 * DESDE JAVA / PHP / PYTHON:
 *   · Un objeto C++ puede vivir en la pila (`Dinero d(5);`) sin new: se destruye solo al salir del bloque.
 *   · Asignar objetos COPIA (como un array en PHP); las "referencias" de Java son aquí punteros o referencias explícitas.
 *   · No hay `finally`, ni `__destruct` impredecible, ni `close()` que se olvida: el destructor es el sitio.
 * DESDE C: `malloc/free` y los punteros desnudos se sustituyen por vector/string/unique_ptr; los `struct` ganan métodos.
 *
 * Al final hay 8 ejercicios con pruebas. Cómo se trabaja:
 *   1. Ctrl+Enter ejecuta el archivo: verás la teoría y las pruebas en «Pendiente».
 *   2. Sustituye los `pendiente();` por tu código y vuelve a ejecutar.
 *   3. Ctrl+S guarda tu copia en practicas/ (este ejemplo no se modifica).
 *   4. Cuando acabes (o te atasques) abre la pestaña «Solución».
 * NOTA: en C++ cada tipo se declara ANTES de usarse, así que primero van las clases de la teoría y los ejercicios, y
 * main (con las demostraciones y las pruebas) va al final.
 */

void titulo(const string& texto) {
    cout << "\n=== " << texto << " ===\n";
}

// ════════════════════════════════════════════════════════════════════════════
// Teoría 1 · Interfaces (clases abstractas) y RAII
// ════════════════════════════════════════════════════════════════════════════

/** RAII en pequeño: abre en el constructor, cierra en el destructor (aunque salte una excepción). */
class Traza {
    string nombre_;

public:
    explicit Traza(string nombre) : nombre_(move(nombre)) { cout << "  + abre " << nombre_ << "\n"; }
    ~Traza() { cout << "  - cierra " << nombre_ << "\n"; }
    Traza(const Traza&) = delete;              // un recurso único no se copia: se prohíbe a propósito
    Traza& operator=(const Traza&) = delete;
};

/**
 * Una «interfaz» de C++ es una clase con TODO virtual puro (= 0) y un destructor virtual. Quien la use solo conoce el
 * contrato. El destructor virtual es obligatorio: sin él, borrar un NotificadorEmail a través de un Notificador* sería UB.
 */
class Notificador {
public:
    virtual ~Notificador() = default;
    virtual string enviar(const string& destino, const string& mensaje) const = 0;
};

class NotificadorEmail final : public Notificador {
public:
    string enviar(const string& destino, const string& mensaje) const override {   // override: error si no sobrescribe nada
        return "email a " + destino + ": " + mensaje;
    }
};

class NotificadorSms final : public Notificador {
public:
    string enviar(const string& destino, const string& mensaje) const override {
        return "sms a " + destino + ": " + mensaje.substr(0, 20);
    }
};

/** Polimorfismo: un vector de unique_ptr<Base> guarda objetos de clases distintas; cada uno se borra con SU destructor. */
vector<string> avisarATodos(const vector<unique_ptr<Notificador>>& canales, const string& destino, const string& mensaje) {
    vector<string> salida;
    for (const auto& canal : canales) {
        salida.push_back(canal->enviar(destino, mensaje));
    }
    return salida;
}

// ════════════════════════════════════════════════════════════════════════════
// Teoría 2 · Composición y quién es dueño de qué
// ════════════════════════════════════════════════════════════════════════════

/** Acoplado: el pedido CONSTRUYE su notificador. No se puede cambiar ni probar con uno falso. */
class PedidoAcoplado {
    NotificadorEmail notificador_;   // composición por valor: el notificador vive DENTRO del pedido

public:
    string confirmar(const string& cliente) const { return notificador_.enviar(cliente, "pedido confirmado"); }
};

/** Composición con dueño: el pedido es dueño (unique_ptr) de lo que le dan; al morir el pedido, muere el notificador. */
class Pedido {
    unique_ptr<Notificador> notificador_;
    vector<string> articulos_;

public:
    explicit Pedido(unique_ptr<Notificador> notificador) : notificador_(move(notificador)) {}   // move: se TRANSFIERE la propiedad
    Pedido& añadir(string articulo) {
        articulos_.push_back(move(articulo));
        return *this;                // devolver *this permite encadenar: pedido.añadir("a").añadir("b")
    }
    string confirmar(const string& cliente) const {
        return notificador_->enviar(cliente, to_string(articulos_.size()) + " artículos confirmados");
    }
};

// ════════════════════════════════════════════════════════════════════════════
// Teoría 3 · Inyección de dependencias y plantillas
// ════════════════════════════════════════════════════════════════════════════

/** Un doble de pruebas: no envía nada, solo apunta lo que le piden enviar. */
class NotificadorFalso : public Notificador {
public:
    mutable vector<string> enviados;   // mutable: se puede modificar aunque enviar() sea const
    string enviar(const string& destino, const string& mensaje) const override {
        enviados.push_back(destino + "|" + mensaje);
        return "falso";
    }
};

/** Inyección ESTÁTICA con plantillas: el tipo del notificador se decide al compilar (sin virtual, sin heap, inlinable). */
template <typename N>
class PedidoT {
    N notificador_;

public:
    explicit PedidoT(N notificador) : notificador_(move(notificador)) {}
    string confirmar(const string& cliente) const { return notificador_.enviar(cliente, "ok"); }
};

// ════════════════════════════════════════════════════════════════════════════
// Teoría 4 · Strategy
// ════════════════════════════════════════════════════════════════════════════

class Ordenacion {
public:
    virtual ~Ordenacion() = default;
    virtual bool antes(int a, int b) const = 0;   // ¿a debe ir antes que b?
};
class Ascendente final : public Ordenacion {
public:
    bool antes(int a, int b) const override { return a < b; }
};
class Descendente final : public Ordenacion {
public:
    bool antes(int a, int b) const override { return a > b; }
};

/** Tres formas de recibir la estrategia. 1) interfaz virtual (flexible, una llamada indirecta por comparación). */
string mostrarOrdenado(vector<int> xs, const Ordenacion& criterio) {   // xs por VALOR: copia, así no tocamos el original
    sort(xs.begin(), xs.end(), [&](int a, int b) { return criterio.antes(a, b); });
    string s;
    for (int x : xs) {
        s += to_string(x) + " ";
    }
    return s;
}
/** 2) std::function: acepta cualquier cosa invocable (lambda, puntero a función, objeto con operator()). */
string ordenarCon(vector<int> xs, const function<bool(int, int)>& criterio) {
    sort(xs.begin(), xs.end(), criterio);
    string s;
    for (int x : xs) {
        s += to_string(x) + " ";
    }
    return s;
}
/** 3) Plantilla: el compilador genera una versión por criterio y la llamada se puede inlinar (como hace sort). */
template <typename Criterio>
string ordenarPlantilla(vector<int> xs, Criterio criterio) {
    sort(xs.begin(), xs.end(), criterio);
    string s;
    for (int x : xs) {
        s += to_string(x) + " ";
    }
    return s;
}

// ════════════════════════════════════════════════════════════════════════════
// Teoría 5 · Objetos de valor, operadores, regla del 0/3/5 y move
// ════════════════════════════════════════════════════════════════════════════

/** Un objeto de valor: se define por sus datos, es inmutable, se compara por valor y se copia sin miedo. */
class Fraccion {
    long long num_;
    long long den_;

public:
    Fraccion(long long num, long long den = 1) : num_(num), den_(den) {   // sin explicit: Fraccion f = 3; vale
        if (den == 0) {
            throw invalid_argument("el denominador no puede ser 0");
        }
        long long g = gcd(num_, den_);   // <numeric>
        if (den_ < 0) {
            g = -g;
        }
        num_ /= g;
        den_ /= g;
    }
    long long num() const { return num_; }
    long long den() const { return den_; }
    Fraccion operator+(const Fraccion& o) const { return Fraccion(num_ * o.den_ + o.num_ * den_, den_ * o.den_); }
    Fraccion operator*(const Fraccion& o) const { return Fraccion(num_ * o.num_, den_ * o.den_); }
    bool operator==(const Fraccion&) const = default;       // como están normalizadas, comparar campos basta
    bool operator<(const Fraccion& o) const { return num_ * o.den_ < o.num_ * den_; }
    friend ostream& operator<<(ostream& os, const Fraccion& f) { return os << f.num_ << "/" << f.den_; }   // friend: función externa con acceso
};

/** Regla del 5 en vivo: un recurso a mano (memoria dinámica) obliga a escribir las 5 funciones especiales. */
class Buffer {
    size_t n_;
    int* datos_;

public:
    static inline int copias = 0;
    static inline int movimientos = 0;

    explicit Buffer(size_t n) : n_(n), datos_(new int[n]()) {}                 // 1. constructor
    ~Buffer() { delete[] datos_; }                                             // 2. destructor
    Buffer(const Buffer& o) : n_(o.n_), datos_(new int[o.n_]) {                // 3. copia: duplica el recurso (O(n))
        copy(o.datos_, o.datos_ + n_, datos_);
        copias++;
    }
    Buffer& operator=(const Buffer& o) {                                       // 4. asignación por copia
        if (this != &o) {                                                      // ¡autoasignación! a = a no debe romper nada
            int* nuevo = new int[o.n_];
            copy(o.datos_, o.datos_ + o.n_, nuevo);
            delete[] datos_;
            datos_ = nuevo;
            n_ = o.n_;
            copias++;
        }
        return *this;
    }
    Buffer(Buffer&& o) noexcept : n_(o.n_), datos_(o.datos_) {                 // 5. move: roba el puntero (O(1))
        o.n_ = 0;
        o.datos_ = nullptr;                                                    // el original queda vacío pero válido
        movimientos++;
    }
    // (falta la asignación por move: la regla completa son 5; aquí se omite para no alargar. Al declarar un move
    //  constructor, la asignación por move NO se genera sola: el compilador usaría la copia.)
    size_t tamaño() const { return n_; }
};

/** Regla del 0: todos los campos gestionan su memoria solos, así que NO se escribe nada especial y la copia/move salen bien. */
class Alumno {
public:
    string nombre;
    vector<int> notas;
    double media() const { return notas.empty() ? 0.0 : accumulate(notas.begin(), notas.end(), 0.0) / (double)notas.size(); }
};

enum class Prioridad { Baja = 1, Media = 5, Alta = 10 };   // enum class: valores con nombre, sin conversiones implícitas a int

// ════════════════════════════════════════════════════════════════════════════
// Teoría 6 · Repository
// ════════════════════════════════════════════════════════════════════════════

struct Usuario {
    int id = 0;
    string nombre;
    bool operator==(const Usuario&) const = default;
};
inline ostream& operator<<(ostream& os, const Usuario& u) {   // para que las pruebas lo enseñen bonito
    return os << "Usuario(" << u.id << ", " << u.nombre << ")";
}

/** El resto de la aplicación habla con esta interfaz y no sabe si los datos están en memoria, en un archivo o en SQL. */
class RepositorioUsuarios {
public:
    virtual ~RepositorioUsuarios() = default;
    virtual void guardar(const Usuario& usuario) = 0;
    virtual optional<Usuario> buscar(int id) const = 0;   // optional: «puede que no exista», sin null
    virtual vector<Usuario> todos() const = 0;
    virtual bool eliminar(int id) = 0;
};

/** Una implementación sencilla con map: ordenado por id, O(log n) por operación. */
class RepositorioLibrosEnMemoria {
    map<int, string> libros_;

public:
    void guardar(int id, const string& titulo_) { libros_[id] = titulo_; }
    optional<string> buscar(int id) const {
        auto it = libros_.find(id);                       // find NO inserta (a diferencia de libros_[id])
        if (it == libros_.end()) {
            return nullopt;
        }
        return it->second;
    }
    size_t cantidad() const { return libros_.size(); }
};

// ════════════════════════════════════════════════════════════════════════════
// Teoría 7 · Excepciones propias
// ════════════════════════════════════════════════════════════════════════════

/** Se hereda de una excepción estándar (runtime_error guarda el mensaje y what() lo devuelve). */
class StockInsuficiente : public runtime_error {
public:
    using runtime_error::runtime_error;   // hereda los constructores
    static StockInsuficiente de(const string& producto, int pedido, int hay) {
        return StockInsuficiente("No hay stock de " + producto + ": pides " + to_string(pedido) + " y quedan " + to_string(hay));
    }
};

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════
// Sustituye cada `pendiente();` por tu código. Mantén las firmas: las pruebas las usan.

// ── Ejercicio 1 · Dinero (objeto de valor) ──────────────────────────────────
/**
 * Dinero en céntimos para no arrastrar errores de coma flotante (0.1 + 0.2 != 0.3).
 *  - Es INMUTABLE: sumar, multiplicar... devuelven un Dinero nuevo (todos los métodos son const).
 *  - `Dinero(-1)` lanza invalid_argument (no hay dinero negativo).
 *  - La moneda son tres letras mayúsculas ("EUR", "USD"); si no, invalid_argument.
 *  - `euros(12.5)` crea 1250 céntimos (redondea: euros(0.1 + 0.2) son 30 céntimos). Pista: llround de <cmath>.
 *  - `sumar` con monedas distintas lanza invalid_argument.
 *  - `multiplicar(1.5)` redondea al céntimo más cercano.
 *  - `aTexto()`: "12,50 EUR" (coma decimal, siempre dos decimales). El operador << ya lo usa.
 * Pistas de C++: valida en el cuerpo del constructor (lanzar desde un constructor es la forma de impedir objetos inválidos);
 * los parámetros de clase se pasan por const&; `string moneda` por valor + move si te la quedas.
 */
class Dinero {
    long long centimos_ = 0;
    string moneda_ = "EUR";

public:
    Dinero(long long centimos, string moneda = "EUR") {
        pendiente();
    }

    static Dinero euros(double euros, string moneda = "EUR") {
        return pendiente();
    }

    long long centimos() const { return centimos_; }
    const string& moneda() const { return moneda_; }

    Dinero sumar(const Dinero& otro) const {
        return pendiente();
    }

    Dinero multiplicar(double factor) const {
        return pendiente();
    }

    bool igual(const Dinero& otro) const {
        return pendiente();
    }

    string aTexto() const {
        return pendiente();
    }
};
inline ostream& operator<<(ostream& os, const Dinero& d) { return os << d.aTexto(); }

// ── Ejercicio 2 · Carrito con descuentos (Strategy) ─────────────────────────
/** Una «línea» del carrito: nombre, precio unitario en céntimos y cantidad. */
struct Linea {
    string nombre;
    long long precio = 0;
    int cantidad = 0;
};

/** Suma de precio × cantidad de todas las líneas (ya hecho: úsalo en los descuentos). */
inline long long subtotalDe(const vector<Linea>& lineas) {
    long long total = 0;
    for (const Linea& l : lineas) {
        total += l.precio * l.cantidad;
    }
    return total;
}

/** El contrato de cualquier descuento: céntimos que se descuentan de un conjunto de líneas. */
class Descuento {
public:
    virtual ~Descuento() = default;
    virtual long long calcular(const vector<Linea>& lineas) const = 0;
};

/**
 * Descuento por porcentaje sobre el subtotal (entero, redondeando hacia abajo):
 * 15 % de 1999 céntimos = 299. Un porcentaje fuera de 0..100 lanza invalid_argument.
 */
class DescuentoPorcentaje : public Descuento {
    int porcentaje_;

public:
    explicit DescuentoPorcentaje(int porcentaje) : porcentaje_(porcentaje) {
        pendiente();
    }

    long long calcular(const vector<Linea>& lineas) const override {
        return pendiente();
    }
};

/** Descuento de una cantidad fija, que nunca puede superar el subtotal. */
class DescuentoFijo : public Descuento {
    long long centimos_;

public:
    explicit DescuentoFijo(long long centimos) : centimos_(centimos) {
        pendiente();
    }

    long long calcular(const vector<Linea>& lineas) const override {
        return pendiente();
    }
};

/** 3x2 en cada línea: de cada 3 unidades, una es gratis (6 unidades → 2 gratis). */
class TresPorDos : public Descuento {
public:
    long long calcular(const vector<Linea>& lineas) const override {
        return pendiente();
    }
};

/**
 * El carrito NO sabe qué descuentos existen: los recibe (inyección) y se limita a sumarlos.
 *  - añadir() acepta cantidad > 0 (si no, invalid_argument) y devuelve *this para encadenar.
 *  - aplicar() RECIBE la propiedad del descuento (unique_ptr<Descuento>): usa move para guardarlo.
 *  - subtotal(): suma de precio × cantidad.
 *  - descuento(): suma de todos los descuentos aplicados, sin pasar nunca del subtotal.
 *  - total(): subtotal − descuento.
 * Como tiene unique_ptr dentro, un Carrito no se copia (se podría mover): es lo correcto, los descuentos tienen un único dueño.
 */
class Carrito {
    vector<Linea> lineas_;
    vector<unique_ptr<Descuento>> descuentos_;

public:
    Carrito& añadir(string nombre, long long precio, int cantidad = 1) {
        pendiente();
        return *this;
    }

    Carrito& aplicar(unique_ptr<Descuento> descuento) {
        pendiente();
        return *this;
    }

    long long subtotal() const {
        return pendiente();
    }

    long long descuento() const {
        return pendiente();
    }

    long long total() const {
        return pendiente();
    }
};

// ── Ejercicio 3 · Repositorio en memoria ────────────────────────────────────
/**
 * Implementa RepositorioUsuarios guardando los usuarios en un vector (orden de inserción) y un unordered_map
 * de id → posición en el vector:
 *  - guardar() inserta o REEMPLAZA (mismo id) sin cambiar su posición.
 *  - buscar() es O(1) (nada de recorrer el vector) y devuelve nullopt si no existe.
 *  - todos() devuelve una copia del vector en orden de primera inserción.
 *  - eliminar() devuelve true si existía. Al borrar del vector las posiciones de los siguientes cambian: actualiza el índice.
 */
class RepositorioUsuariosEnMemoria : public RepositorioUsuarios {
    vector<Usuario> usuarios_;
    unordered_map<int, size_t> posicion_;

public:
    void guardar(const Usuario& usuario) override {
        pendiente();
    }

    optional<Usuario> buscar(int id) const override {
        pendiente();
        return nullopt;
    }

    vector<Usuario> todos() const override {
        return pendiente();
    }

    bool eliminar(int id) override {
        return pendiente();
    }
};

// ── Ejercicio 4 · Mini contenedor de inyección de dependencias ──────────────
/** Se lanza cuando el contenedor no puede construir algo (tipo sin registrar...). */
class ContenedorException : public runtime_error {
public:
    using runtime_error::runtime_error;
};

/** Dependencia circular: A necesita B y B necesita A. */
class DependenciaCircular : public ContenedorException {
public:
    using ContenedorException::ContenedorException;
};

/**
 * Un contenedor como el de Laravel o Spring, en pequeño. C++ NO tiene reflexión: no puede mirar el constructor de una
 * clase para saber qué necesita, así que el programador lo REGISTRA y los tipos se identifican con type_index
 * (typeid(T)), una clave comparable y con hash que representa un tipo en tiempo de ejecución.
 *  - set<T>(fabrica) registra cómo construir un T: la fábrica recibe el contenedor y devuelve shared_ptr<T>.
 *  - registrar<T, Deps...>() es el «autowiring»: registra que T se construye con make_shared<T>(get<Deps>()...).
 *  - get<T>() devuelve SIEMPRE la misma instancia (singleton): la primera vez la construye con su fábrica y la guarda.
 *    Si T no está registrado lanza ContenedorException. Un ciclo (A necesita B y B necesita A) lanza DependenciaCircular.
 *  - has<T>(): true si T está registrado.
 * Pistas: shared_ptr<void> guarda cualquier cosa borrando bien al final; static_pointer_cast<T> la recupera; para detectar
 * ciclos apunta qué tipos estás construyendo AHORA y quítalos al terminar (también si salta una excepción: RAII o try/catch).
 */
class Contenedor {
    unordered_map<type_index, function<shared_ptr<void>(Contenedor&)>> fabricas_;
    unordered_map<type_index, shared_ptr<void>> instancias_;
    vector<type_index> enConstruccion_;

public:
    template <class T>
    void set(function<shared_ptr<T>(Contenedor&)> fabrica) {
        pendiente();
    }

    template <class T, class... Deps>
    void registrar() {
        pendiente();
    }

    template <class T>
    bool has() const {
        return pendiente();
    }

    template <class T>
    shared_ptr<T> get() {
        pendiente();
        return nullptr;
    }
};

// Clases de apoyo para las pruebas del contenedor (no hay que tocarlas)
struct Motor {};
struct Coche {
    shared_ptr<Motor> motor;
    int plazas;
    explicit Coche(shared_ptr<Motor> m, int p = 5) : motor(move(m)), plazas(p) {}
};
struct Taller {
    shared_ptr<Coche> coche;
    shared_ptr<Motor> repuesto;
    Taller(shared_ptr<Coche> c, shared_ptr<Motor> r) : coche(move(c)), repuesto(move(r)) {}
};
class Reloj {
public:
    virtual ~Reloj() = default;
    virtual string ahora() const = 0;
};
class RelojFijo : public Reloj {
public:
    string ahora() const override { return "2025-01-01"; }
};
struct Agenda {
    shared_ptr<Reloj> reloj;
    explicit Agenda(shared_ptr<Reloj> r) : reloj(move(r)) {}
};
struct CicloB;
struct CicloA {
    shared_ptr<CicloB> b;
    explicit CicloA(shared_ptr<CicloB> x) : b(move(x)) {}
};
struct CicloB {
    shared_ptr<CicloA> a;
    explicit CicloB(shared_ptr<CicloA> x) : a(move(x)) {}
};
struct SinRegistrar {};

// ── Ejercicio 5 · Despachador de eventos (patrón Observer) ──────────────────
/**
 * Los «oyentes» se registran para un evento y se llaman cuando alguien lo despacha.
 *  - escuchar(evento, oyente, prioridad = 0): mayor prioridad se ejecuta antes; con igual prioridad, por orden de registro.
 *    El oyente es CUALQUIER invocable que reciba `const string&` (la plantilla F lo acepta). Si devuelve bool, `false`
 *    corta la cadena; si devuelve void, nunca corta. Pista: `if constexpr (is_void_v<invoke_result_t<F&, const string&>>)`
 *    y guárdalo envuelto en function<bool(const string&)>.
 *  - despachar(evento, datos = ""): llama a cada oyente con `datos` y devuelve cuántos se ejecutaron. Un evento sin oyentes
 *    devuelve 0. Si un oyente devuelve false, se corta (cuenta ese oyente pero no los siguientes).
 */
class Despachador {
    struct Oyente {
        int prioridad;
        size_t orden;
        function<bool(const string&)> llamar;
    };
    unordered_map<string, vector<Oyente>> oyentes_;
    size_t registrados_ = 0;

public:
    template <class F>
    void escuchar(const string& evento, F oyente, int prioridad = 0) {
        pendiente();
    }

    int despachar(const string& evento, const string& datos = "") {
        return pendiente();
    }
};

// ════════════════════════════════════════════════════════════════════════════
// main: las demostraciones y, al final, las pruebas
// ════════════════════════════════════════════════════════════════════════════
int main() {
// ════════════════════════════════════════════════════════════════════════
// 1. INTERFACES: CONTRATOS, NO HERENCIA
// ════════════════════════════════════════════════════════════════════════
    titulo("1. Interfaces, constructor, destructor y RAII");
    // ── Una clase: constructor, lista de inicialización y destructor ──
    // Java/PHP: el objeto vive mientras alguien lo referencie y no sabes cuándo se limpia.
    // C++: el objeto local muere al cerrar el bloque, y su destructor se ejecuta EN ESE MOMENTO (en orden inverso).
    {
        Traza a("archivo A");
        Traza b("archivo B");
        cout << "  trabajando...\n";
    }   // ← se cierra B y luego A
    // Con excepciones también: el «desenrollado de pila» (stack unwinding) llama a los destructores de todo lo que estaba vivo.
    try {
        Traza candado("candado");
        throw runtime_error("fallo a mitad");
    } catch (const exception& e) {
        cout << "  capturada: " << e.what() << " (el candado ya se cerró solo)\n";
    }
    // Esto es RAII: no hace falta try/finally, ni acordarse de cerrar. vector, string, fstream, unique_ptr, lock_guard...
    // son todos objetos RAII.

    // ── La interfaz propiamente dicha ──
    // Igual que en Java: dice QUÉ se puede hacer, no CÓMO. Se implementa con herencia pública + override.
    vector<unique_ptr<Notificador>> canales;
    canales.push_back(make_unique<NotificadorEmail>());
    canales.push_back(make_unique<NotificadorSms>());
    for (const string& linea : avisarATodos(canales, "ana", "Tu pedido de 3 camisetas ha salido")) {
        cout << linea << "\n";
    }
    // Un objeto con virtual guarda un puntero oculto (vptr) a su tabla de métodos: cada llamada virtual cuesta una
    // indirección. Por eso solo lo que debe ser polimórfico es virtual (en Java todo lo es). Ver «final» y «override».
    // Slicing: `Notificador n = NotificadorEmail();` (por valor) CORTARÍA el objeto. Polimorfismo = puntero o referencia.

// ════════════════════════════════════════════════════════════════════════
// 2. COMPOSICIÓN FRENTE A HERENCIA
// ════════════════════════════════════════════════════════════════════════
    titulo("2. Composición y smart pointers");
    // La herencia ata (clase base, cambios que se propagan, destructores virtuales). La composición — un objeto TIENE otro —
    // se cambia y se prueba con mucha más facilidad. En C++ hay que decidir además QUIÉN ES DUEÑO del objeto contenido:
    //   · por valor (miembro normal)     → vive dentro; lo más simple y rápido (PedidoAcoplado)
    //   · unique_ptr<T>                   → UN dueño; no se copia, solo se MUEVE (Pedido)
    //   · shared_ptr<T>                   → varios dueños; se libera al irse el último (cuenta de referencias)
    //   · T& / T* / weak_ptr<T>           → NO es dueño, solo mira (¡no debe sobrevivir al dueño!)
    cout << PedidoAcoplado().confirmar("ana") << "\n";
    Pedido pedido(make_unique<NotificadorSms>());
    pedido.añadir("camiseta").añadir("gorra");
    cout << pedido.confirmar("luis") << "\n";

    auto uno = make_unique<int>(7);
    auto otro = move(uno);                       // el unique_ptr no se copia; move transfiere el dueño
    cout << "tras move, uno " << (uno ? "tiene" : "está vacío") << " y otro vale " << *otro << "\n";
    auto compartido = make_shared<string>("dato");
    auto segundo = compartido;                   // copia el shared_ptr: ahora hay 2 dueños
    cout << "dueños: " << compartido.use_count() << "\n";
    weak_ptr<string> observador = compartido;    // mira sin ser dueño; no suma a la cuenta
    compartido.reset();
    segundo.reset();                             // murió el último dueño → el string se libera
    cout << "¿sigue vivo? " << (observador.expired() ? "no" : "sí") << "\n";
    // Ciclos: dos shared_ptr que se apuntan mutuamente NUNCA se liberan (fuga). Se rompe uno de los lados con weak_ptr.
    // Regla: unique_ptr por defecto; shared_ptr solo si la propiedad es compartida de verdad; `new`/`delete` a mano, casi nunca.

// ════════════════════════════════════════════════════════════════════════
// 3. INYECCIÓN DE DEPENDENCIAS (DI)
// ════════════════════════════════════════════════════════════════════════
    titulo("3. Inyección de dependencias");
    // Una clase NO crea lo que necesita (PedidoAcoplado fija NotificadorEmail): lo recibe por el constructor. Así en las
    // pruebas se le pasa un doble (NotificadorFalso) y nunca se envía un email de verdad. Pedido(unique_ptr<Notificador>)
    // ya hace DI; un «contenedor» solo AUTOMATIZA construir el grafo de objetos (ejercicio 4).
    auto falso = make_unique<NotificadorFalso>();
    NotificadorFalso* espia = falso.get();       // puntero SIN dueño para mirar después; el dueño sigue siendo `falso`
    Pedido probado(move(falso));
    probado.añadir("teclado");
    probado.confirmar("ana");
    cout << "el falso recibió: " << espia->enviados.front() << "\n";
    // La misma idea en tiempo de compilación, con plantillas (no hay virtual ni heap; el tipo debe conocerse al compilar):
    PedidoT<NotificadorEmail> estatico{NotificadorEmail()};
    cout << estatico.confirmar("ana") << "\n";
    // ── Plantillas básicas ──
    // `template <typename N> class PedidoT` NO es una clase: es un molde. PedidoT<NotificadorEmail> hace que el compilador
    // genere una clase de verdad sustituyendo N. Si N no tiene `enviar`, el error sale al instanciar (a veces enorme: busca la
    // primera línea). En Java los genéricos se borran al compilar (type erasure); en C++ cada instanciación es código distinto.
    // C++ no tiene reflexión (Reflection de PHP/Java): por eso el contenedor del ejercicio 4 usa typeid(T) y funciones.

// ════════════════════════════════════════════════════════════════════════
// 4. STRATEGY: ALGORITMOS INTERCAMBIABLES
// ════════════════════════════════════════════════════════════════════════
    titulo("4. Strategy");
    // Se mete la parte que VARÍA detrás de una interfaz y se inyecta. En C++ tienes tres herramientas (ver arriba):
    //   interfaz virtual → flexible, decisión en ejecución, 1 llamada indirecta
    //   std::function    → acepta lambdas; algo más lenta; ideal para guardar callbacks
    //   plantilla        → decisión en compilación; la más rápida (sort la usa)
    vector<int> xs = {3, 1, 2};
    cout << mostrarOrdenado(xs, Ascendente()) << "| " << mostrarOrdenado(xs, Descendente()) << "| original intacto: " << xs[0] << xs[1] << xs[2] << "\n";
    cout << ordenarCon(xs, [](int a, int b) { return a > b; }) << "| " << ordenarPlantilla(xs, less<int>()) << "\n";

// ════════════════════════════════════════════════════════════════════════
// 5. OBJETOS DE VALOR (VALUE OBJECTS) Y const
// ════════════════════════════════════════════════════════════════════════
    titulo("5. Objetos de valor, operadores, regla 0/3/5 y move");
    // Un objeto de valor se define por sus datos, no por su identidad, y es inmutable: cada operación devuelve uno NUEVO.
    // const es la herramienta: métodos `const`, parámetros `const&`, campos `const` si hace falta.
    Fraccion mitad(1, 2), tercio(1, 3);
    cout << mitad << " + " << tercio << " = " << mitad + tercio << ", " << mitad << " * " << tercio << " = " << mitad * tercio
         << ", Fraccion(6, -4) = " << Fraccion(6, -4) << ", ¿1/2 == 2/4? " << (mitad == Fraccion(2, 4)) << ", ¿1/3 < 1/2? " << (tercio < mitad) << "\n";
    // Sobrecarga de operadores: se escribe `operator+` y se usa `a + b`. Hazlo SOLO cuando el significado sea obvio (matemáticas,
    // comparaciones, <<). `= default` en == o <=> genera la comparación campo a campo. Un enum class evita números mágicos:
    Prioridad p = Prioridad::Alta;
    cout << "prioridad " << static_cast<int>(p) << ", ¿es mayor que Media? " << (p > Prioridad::Media) << "\n";
    // ── Regla del 0 / 3 / 5 ──
    // Si tu clase no gestiona recursos a mano (Alumno: string + vector), NO escribas ni destructor ni copia ni move: ya salen bien.
    // Si guardas un puntero propio (Buffer), el compilador copiaría el PUNTERO (dos objetos borrando lo mismo = UB). Entonces
    // escribes las cinco: destructor, copia, asignación por copia, move y asignación por move. O las prohíbes con `= delete`.
    Alumno ana{"Ana", {7, 9, 8}};
    Alumno copiaAna = ana;                       // copia profunda: el vector se duplica solo
    copiaAna.notas.push_back(10);
    cout << ana.nombre << " media " << ana.media() << ", la copia " << copiaAna.media() << "\n";
    Buffer b1(1000);
    Buffer b2 = b1;                              // copia (O(n))
    Buffer b3 = move(b1);                        // move (O(1)); b1 queda vacío pero seguro de destruir
    cout << "copias " << Buffer::copias << ", moves " << Buffer::movimientos << ", b1 " << b1.tamaño() << ", b3 " << b3.tamaño() << "\n";
    // std::move NO mueve nada: solo CONVIERTE a «valor temporal» para que se elija el constructor move. Tras un move, no uses
    // el objeto salvo para destruirlo o asignarlo. Devolver un objeto local (`return v;`) ya lo mueve (o ni se copia): NO escribas move ahí.

// ════════════════════════════════════════════════════════════════════════
// 6. REPOSITORY: ESCONDER DÓNDE SE GUARDAN LOS DATOS
// ════════════════════════════════════════════════════════════════════════
    titulo("6. Repository");
    // El resto de la aplicación habla con una interfaz ("dame el usuario 7") y no sabe si está en memoria, en un archivo o en SQL.
    RepositorioLibrosEnMemoria libros;
    libros.guardar(2, "Fundamentos de C++");
    libros.guardar(1, "Algoritmos");
    libros.guardar(2, "Fundamentos de C++ (2.ª ed.)");   // mismo id: reemplaza
    cout << libros.cantidad() << " libros; el 2 es «" << libros.buscar(2).value_or("?") << "»; el 9: "
         << (libros.buscar(9) ? "existe" : "no existe") << "\n";
    // optional<T> en lugar de devolver null o un valor mágico. map::find no inserta; map::operator[] sí (¡y crearía el id 9!).

// ════════════════════════════════════════════════════════════════════════
// 7. EXCEPCIONES PROPIAS
// ════════════════════════════════════════════════════════════════════════
    titulo("7. Excepciones");
    // En C++ no existen las excepciones "comprobadas" (no hay `throws`). Se hereda de la jerarquía estándar para poder
    // capturar lo que interesa y nada más. Se lanza por valor y se captura por const& (evita copias y el slicing).
    try {
        throw StockInsuficiente::de("teclado", 5, 2);
    } catch (const invalid_argument&) {
        cout << "no entra aquí\n";
    } catch (const StockInsuficiente& e) {                 // el orden importa: se elige el PRIMER catch compatible
        cout << "StockInsuficiente: " << e.what() << "\n";
    }
    try {
        try {
            throw runtime_error("interno");
        } catch (const runtime_error&) {
            cout << "relanzo...\n";
            throw;                                        // `throw;` sin nada relanza LA MISMA excepción (sin copiarla)
        }
    } catch (...) {                                       // catch(...) captura cualquier cosa (no sabes qué es)
        cout << "capturado en el exterior\n";
    }
    // `noexcept` promete no lanzar (los move deberían serlo: vector solo mueve en su crecimiento si el move es noexcept).
    // No hay finally: se usa RAII (sección 1). Un destructor NO debe lanzar. Dividir por 0 o salirse de un vector NO son
    // excepciones, son UB: las excepciones son para los errores que TÚ detectas.

// ════════════════════════════════════════════════════════════════════════
// PRUEBAS (no hace falta tocarlas)
// ════════════════════════════════════════════════════════════════════════
    grupo("Dinero");
    comprueba("euros(12.5) son 1250 céntimos", [&] { return Dinero::euros(12.5).centimos(); }, 1250LL);
    comprueba("euros(0.1 + 0.2) redondea a 30 céntimos", [&] { return Dinero::euros(0.1 + 0.2).centimos(); }, 30LL);
    comprueba("sumar da un Dinero nuevo", [&] { return Dinero::euros(1).sumar(Dinero::euros(2.5)).centimos(); }, 350LL);
    comprueba("sumar no modifica el original", [&] {
        Dinero a = Dinero::euros(1);
        Dinero suma = a.sumar(Dinero::euros(1));
        return make_pair(a.centimos(), suma.centimos());
    }, make_pair(100LL, 200LL));
    comprueba("multiplicar redondea", [&] { return Dinero(1999).multiplicar(1.5).centimos(); }, 2999LL);
    comprueba("igual compara importe y moneda", [&] { return Dinero::euros(3).igual(Dinero(300)) && !Dinero::euros(3).igual(Dinero(300, "USD")); }, true);
    comprueba("se imprime con coma decimal", [&] { return Dinero::euros(12.5).aTexto(); }, string("12,50 EUR"));
    comprueba("se imprime con dos decimales", [&] { return Dinero(5, "USD").aTexto(); }, string("0,05 USD"));
    lanza("importe negativo", [&] { Dinero d(-1); }, invalid_argument);
    lanza("moneda inválida", [&] { Dinero d(1, "euro"); }, invalid_argument);
    lanza("sumar monedas distintas", [&] { Dinero::euros(1).sumar(Dinero(100, "USD")); }, invalid_argument);

    vector<Linea> lineas = {{"camiseta", 1000, 3}, {"gorra", 500, 2}};   // subtotal 4000

    grupo("DescuentoPorcentaje");
    comprueba("15 % de 1999", [&] { return DescuentoPorcentaje(15).calcular({{"x", 1999, 1}}); }, 299LL);
    comprueba("20 % de 4000", [&] { return DescuentoPorcentaje(20).calcular(lineas); }, 800LL);
    lanza("porcentaje mayor que 100", [&] { DescuentoPorcentaje d(101); }, invalid_argument);

    grupo("DescuentoFijo");
    comprueba("resta la cantidad fija", [&] { return DescuentoFijo(300).calcular(lineas); }, 300LL);
    comprueba("nunca pasa del subtotal", [&] { return DescuentoFijo(9999).calcular(lineas); }, 4000LL);

    grupo("TresPorDos");
    comprueba("3 camisetas: una gratis", [&] { return TresPorDos().calcular({{"c", 1000, 3}}); }, 1000LL);
    comprueba("7 unidades: dos gratis", [&] { return TresPorDos().calcular({{"c", 100, 7}}); }, 200LL);
    comprueba("menos de 3 unidades: nada", [&] { return TresPorDos().calcular({{"c", 100, 2}}); }, 0LL);

    grupo("Carrito");
    comprueba("subtotal", [&] {
        Carrito c;
        c.añadir("camiseta", 1000, 3).añadir("gorra", 500, 2);
        return c.subtotal();
    }, 4000LL);
    comprueba("sin descuentos el total es el subtotal", [&] {
        Carrito c;
        c.añadir("gorra", 500);
        return c.total();
    }, 500LL);
    comprueba("acumula descuentos", [&] {
        Carrito c;
        c.añadir("camiseta", 1000, 3).aplicar(make_unique<TresPorDos>()).aplicar(make_unique<DescuentoFijo>(500));
        return c.total();
    }, 1500LL);
    comprueba("el descuento nunca supera el subtotal", [&] {
        Carrito c;
        c.añadir("gorra", 500).aplicar(make_unique<DescuentoFijo>(400)).aplicar(make_unique<DescuentoFijo>(400));
        return c.total();
    }, 0LL);
    lanza("cantidad cero", [&] { Carrito c; c.añadir("gorra", 500, 0); }, invalid_argument);

    grupo("RepositorioUsuariosEnMemoria");
    comprueba("guardar y buscar", [&] {
        RepositorioUsuariosEnMemoria r;
        r.guardar({1, "Ana"});
        return r.buscar(1).value().nombre;
    }, string("Ana"));
    comprueba("buscar lo que no existe da nullopt", [&] { return RepositorioUsuariosEnMemoria().buscar(7).has_value(); }, false);
    comprueba("guardar el mismo id reemplaza sin duplicar", [&] {
        RepositorioUsuariosEnMemoria r;
        r.guardar({1, "Ana"});
        r.guardar({2, "Luis"});
        r.guardar({1, "Ana María"});
        vector<string> nombres;
        for (const Usuario& u : r.todos()) {
            nombres.push_back(u.nombre);
        }
        return nombres;
    }, vector<string>{"Ana María", "Luis"});
    comprueba("eliminar devuelve si existía", [&] {
        RepositorioUsuariosEnMemoria r;
        r.guardar({1, "Ana"});
        bool primera = r.eliminar(1);
        bool segunda = r.eliminar(1);
        return vector<bool>{primera, segunda, r.buscar(1).has_value()};
    }, vector<bool>{true, false, false});
    comprueba("tras eliminar, los demás siguen encontrándose", [&] {
        RepositorioUsuariosEnMemoria r;
        for (int i = 1; i <= 3; i++) {
            r.guardar({i, "u" + to_string(i)});
        }
        r.eliminar(1);
        return make_pair(r.buscar(3).value().nombre, r.todos().size());
    }, make_pair(string("u3"), size_t(2)));

    grupo("Contenedor");
    comprueba("autowiring de una clase sin dependencias", [&] {
        Contenedor c;
        c.registrar<Motor>();
        return c.get<Motor>() != nullptr;
    }, true);
    comprueba("autowiring recursivo con valor por defecto", [&] {
        Contenedor c;
        c.registrar<Motor>();
        c.registrar<Coche, Motor>();
        auto coche = c.get<Coche>();
        return make_pair(coche->motor != nullptr, coche->plazas);
    }, make_pair(true, 5));
    comprueba("devuelve siempre la misma instancia", [&] {
        Contenedor c;
        c.registrar<Motor>();
        return c.get<Motor>() == c.get<Motor>();
    }, true);
    comprueba("las dependencias compartidas son la misma instancia", [&] {
        Contenedor c;
        c.registrar<Motor>();
        c.registrar<Coche, Motor>();
        c.registrar<Taller, Coche, Motor>();
        auto t = c.get<Taller>();
        return t->coche->motor == t->repuesto;
    }, true);
    comprueba("set() enlaza una interfaz con una implementación", [&] {
        Contenedor c;
        c.set<Reloj>([](Contenedor&) { return make_shared<RelojFijo>(); });
        c.registrar<Agenda, Reloj>();
        return c.get<Agenda>()->reloj->ahora();
    }, string("2025-01-01"));
    comprueba("la fábrica recibe el contenedor", [&] {
        Contenedor c;
        c.registrar<Motor>();
        c.set<Coche>([](Contenedor& cont) { return make_shared<Coche>(cont.get<Motor>(), 2); });
        auto coche = c.get<Coche>();
        return make_pair(coche->motor == c.get<Motor>(), coche->plazas);
    }, make_pair(true, 2));
    comprueba("has()", [&] {
        Contenedor c;
        c.registrar<Motor>();
        return make_pair(c.has<Motor>(), c.has<Reloj>());
    }, make_pair(true, false));
    lanza("tipo sin registrar", [&] { Contenedor().get<SinRegistrar>(); }, ContenedorException);
    lanza("interfaz sin registrar", [&] { Contenedor().get<Reloj>(); }, ContenedorException);
    lanza("dependencia circular", [&] {
        Contenedor c;
        c.registrar<CicloA, CicloB>();
        c.registrar<CicloB, CicloA>();
        c.get<CicloA>();
    }, DependenciaCircular);
    comprueba("tras un ciclo el contenedor sigue siendo usable", [&] {
        Contenedor c;
        c.registrar<Motor>();
        c.registrar<CicloA, CicloB>();
        c.registrar<CicloB, CicloA>();
        try {
            c.get<CicloA>();
        } catch (const DependenciaCircular&) {
        }
        return c.get<Motor>() != nullptr;
    }, true);

    grupo("Despachador");
    comprueba("despacha a los oyentes con los datos", [&] {
        Despachador d;
        vector<string> visto;
        d.escuchar("alta", [&](const string& datos) { visto.push_back(datos); });
        int n = d.despachar("alta", "ana");
        return make_pair(n, visto);
    }, make_pair(1, vector<string>{"ana"}));
    comprueba("evento sin oyentes", [&] { return Despachador().despachar("nada"); }, 0);
    comprueba("mayor prioridad primero; a igual prioridad, orden de registro", [&] {
        Despachador d;
        string orden;
        d.escuchar("e", [&](const string&) { orden += "b"; });
        d.escuchar("e", [&](const string&) { orden += "A"; }, 10);
        d.escuchar("e", [&](const string&) { orden += "c"; });
        d.despachar("e");
        return orden;
    }, string("Abc"));
    comprueba("devolver false corta la cadena", [&] {
        Despachador d;
        int llamados = 0;
        d.escuchar("e", [&](const string&) { llamados++; return false; }, 5);
        d.escuchar("e", [&](const string&) { llamados++; });
        int n = d.despachar("e");
        return make_pair(n, llamados);
    }, make_pair(1, 1));
    comprueba("los eventos no se mezclan", [&] {
        Despachador d;
        d.escuchar("a", [](const string&) {});
        return d.despachar("b");
    }, 0);

    // ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // Mide cuánto cuesta buscar un usuario según el tamaño del repositorio (O(1) si guardas por id).
    // Una búsqueda tarda nanosegundos y el reloj no la distingue del ruido: cada repetición hace 1000 seguidas.
    medirCon("RepositorioUsuariosEnMemoria", [](int n) {
        auto repo = make_shared<RepositorioUsuariosEnMemoria>();
        for (int i = 1; i <= n; i++) {
            repo->guardar({i, "u" + to_string(i)});
        }
        return make_pair(repo, n);
    }, [](auto& entrada) {
        for (int k = 0; k < 1000; k++) {
            noOptimizar(entrada.first->buscar(entrada.second - k % 7).has_value());
        }
    });                                                                                 // O(1)
}
