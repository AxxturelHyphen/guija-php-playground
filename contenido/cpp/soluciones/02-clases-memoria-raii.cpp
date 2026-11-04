#include <algorithm>
#include <cmath>
#include <functional>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <typeindex>
#include <unordered_map>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 2 · Clases, memoria y RAII
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Objeto de valor inmutable para dinero.
 *
 * @complejidad Tiempo O(1) en todas las operaciones; espacio O(1) (la moneda son 3 caracteres).
 * @explicacion Todo se valida en el CONSTRUCTOR y se lanza invalid_argument, así que es imposible tener un Dinero inválido
 * en el resto del programa. Los métodos son `const` y devuelven objetos nuevos (inmutabilidad). Se guardan céntimos enteros
 * (long long) para no arrastrar los errores de la coma flotante y solo se usa double en el borde (`euros`, `multiplicar`),
 * redondeando una vez con llround. La moneda llega por valor y se mueve al campo (idioma «sink»: una copia como máximo).
 * @alternativas Guardar un double de euros: más corto, pero acumula errores y permite negativos. Un `struct` con campos
 * públicos: no se puede garantizar la validez. Una plantilla con la moneda como parámetro: evita mezclar monedas en compilación.
 */
class Dinero {
    long long centimos_ = 0;
    string moneda_ = "EUR";

public:
    Dinero(long long centimos, string moneda = "EUR") : centimos_(centimos), moneda_(move(moneda)) {
        if (centimos_ < 0) {
            throw invalid_argument("El dinero no puede ser negativo: " + to_string(centimos_));
        }
        bool valida = moneda_.size() == 3 && all_of(moneda_.begin(), moneda_.end(), [](char c) { return c >= 'A' && c <= 'Z'; });
        if (!valida) {
            throw invalid_argument("Moneda no válida: '" + moneda_ + "' (tres letras mayúsculas)");
        }
    }

    static Dinero euros(double euros, string moneda = "EUR") {
        return Dinero(llround(euros * 100), move(moneda));
    }

    long long centimos() const { return centimos_; }
    const string& moneda() const { return moneda_; }

    Dinero sumar(const Dinero& otro) const {
        if (moneda_ != otro.moneda_) {
            throw invalid_argument("No se pueden sumar " + moneda_ + " y " + otro.moneda_);
        }
        return Dinero(centimos_ + otro.centimos_, moneda_);
    }

    Dinero multiplicar(double factor) const {
        return Dinero(llround((double)centimos_ * factor), moneda_);
    }

    bool igual(const Dinero& otro) const {
        return centimos_ == otro.centimos_ && moneda_ == otro.moneda_;
    }

    string aTexto() const {
        long long resto = centimos_ % 100;
        return to_string(centimos_ / 100) + "," + (resto < 10 ? "0" : "") + to_string(resto) + " " + moneda_;
    }
};

/**
 * Descuento por porcentaje sobre el subtotal.
 *
 * @complejidad Tiempo O(l) con l líneas (el subtotal); espacio O(1).
 * @explicacion La división entera de C++ trunca, que es justo el «redondeo hacia abajo» pedido: subtotal * porcentaje / 100.
 * El rango se valida en el constructor, y el multiplicar antes de dividir mantiene la precisión (1999 * 15 / 100 = 299).
 * `override` hace que el compilador compruebe que de verdad sobrescribimos Descuento::calcular.
 * @alternativas Calcular con double y floor: arrastra errores de coma flotante. Usar un entero más pequeño que long long
 * podría desbordarse con subtotales grandes (UB).
 */
class DescuentoPorcentaje : public Descuento {
    int porcentaje_;

public:
    explicit DescuentoPorcentaje(int porcentaje) : porcentaje_(porcentaje) {
        if (porcentaje_ < 0 || porcentaje_ > 100) {
            throw invalid_argument("El porcentaje debe estar entre 0 y 100: " + to_string(porcentaje_));
        }
    }

    long long calcular(const vector<Linea>& lineas) const override {
        return subtotalDe(lineas) * porcentaje_ / 100;
    }
};

/**
 * Descuento de una cantidad fija.
 *
 * @complejidad Tiempo O(l); espacio O(1).
 * @explicacion Devuelve el mínimo entre la cantidad y el subtotal con `min`, de modo que el descuento jamás deja el total en
 * negativo. Ambos son long long: `min` exige el mismo tipo en los dos argumentos.
 * @alternativas Dejar que el Carrito recorte el total; aquí cada estrategia es responsable de sus propias reglas.
 */
class DescuentoFijo : public Descuento {
    long long centimos_;

public:
    explicit DescuentoFijo(long long centimos) : centimos_(centimos) {
        if (centimos_ < 0) {
            throw invalid_argument("El descuento no puede ser negativo");
        }
    }

    long long calcular(const vector<Linea>& lineas) const override {
        return min(centimos_, subtotalDe(lineas));
    }
};

/**
 * Oferta 3x2 por línea.
 *
 * @complejidad Tiempo O(l); espacio O(1).
 * @explicacion Por cada línea, `cantidad / 3` (división entera) es el número de grupos completos de tres; cada grupo regala
 * una unidad, así que se descuenta ese número × precio. 7 unidades → 2 grupos → 2 gratis; menos de 3 → 0.
 * @alternativas Bucle que cuente de 3 en 3: lo mismo con más código.
 */
class TresPorDos : public Descuento {
public:
    long long calcular(const vector<Linea>& lineas) const override {
        long long total = 0;
        for (const Linea& l : lineas) {
            total += (l.cantidad / 3) * l.precio;
        }
        return total;
    }
};

/**
 * Carrito de la compra que recibe sus descuentos (Strategy + inyección de dependencias).
 *
 * @complejidad añadir O(1) amortizado; subtotal, descuento y total O(l + d·l) con l líneas y d descuentos; espacio O(l + d).
 * @explicacion El carrito es DUEÑO de los descuentos (vector<unique_ptr<Descuento>>): aplicar() recibe un unique_ptr y lo
 * MUEVE dentro, de modo que los descuentos mueren con el carrito (RAII) sin delete a mano. Solo conoce la interfaz Descuento,
 * nunca las clases concretas. descuento() suma lo que dice cada estrategia y lo recorta con `min` al subtotal. Devolver
 * `*this` por referencia permite encadenar llamadas. Al tener un unique_ptr, el compilador impide copiar el Carrito.
 * @alternativas vector<shared_ptr<Descuento>> si varios carritos compartieran descuentos. Guardar std::function<long long(...)>
 * en lugar de objetos: más corto, pero se pierde el nombre y el estado de cada descuento.
 */
class Carrito {
    vector<Linea> lineas_;
    vector<unique_ptr<Descuento>> descuentos_;

public:
    Carrito& añadir(string nombre, long long precio, int cantidad = 1) {
        if (cantidad <= 0) {
            throw invalid_argument("La cantidad debe ser mayor que 0");
        }
        lineas_.push_back({move(nombre), precio, cantidad});
        return *this;
    }

    Carrito& aplicar(unique_ptr<Descuento> descuento) {
        descuentos_.push_back(move(descuento));
        return *this;
    }

    long long subtotal() const {
        return subtotalDe(lineas_);
    }

    long long descuento() const {
        long long suma = 0;
        for (const auto& d : descuentos_) {
            suma += d->calcular(lineas_);
        }
        return min(suma, subtotal());
    }

    long long total() const {
        return subtotal() - descuento();
    }
};

/**
 * Repositorio de usuarios en memoria, con búsqueda por id en O(1).
 *
 * @complejidad guardar y buscar O(1) de media; todos O(n); eliminar O(n) (hay que desplazar el vector); espacio O(n).
 * @explicacion Dos estructuras que se mantienen a la vez: un vector con los usuarios en orden de inserción y un
 * unordered_map id → posición. guardar() reemplaza en su sitio si el id ya existe (así no cambia el orden) o añade al final.
 * buscar() consulta el mapa con find (que NO inserta, a diferencia de operator[]) y devuelve optional. eliminar() borra del
 * vector y, como los siguientes retroceden una posición, recorre desde ahí para corregir sus entradas del índice.
 * @alternativas Un solo unordered_map: buscar igual de rápido, pero todos() perdería el orden de inserción. Un map<int,...>:
 * ordenado por id, no por inserción, y O(log n). Marcar como borrado sin mover (tombstones): eliminar O(1) pero hay que compactar.
 * @bigo 1
 */
class RepositorioUsuariosEnMemoria : public RepositorioUsuarios {
    vector<Usuario> usuarios_;
    unordered_map<int, size_t> posicion_;

public:
    void guardar(const Usuario& usuario) override {
        auto it = posicion_.find(usuario.id);
        if (it != posicion_.end()) {
            usuarios_[it->second] = usuario;
        } else {
            posicion_[usuario.id] = usuarios_.size();
            usuarios_.push_back(usuario);
        }
    }

    optional<Usuario> buscar(int id) const override {
        auto it = posicion_.find(id);
        if (it == posicion_.end()) {
            return nullopt;
        }
        return usuarios_[it->second];
    }

    vector<Usuario> todos() const override {
        return usuarios_;
    }

    bool eliminar(int id) override {
        auto it = posicion_.find(id);
        if (it == posicion_.end()) {
            return false;
        }
        size_t donde = it->second;
        usuarios_.erase(usuarios_.begin() + (long)donde);
        posicion_.erase(it);
        for (size_t i = donde; i < usuarios_.size(); i++) {
            posicion_[usuarios_[i].id] = i;
        }
        return true;
    }
};

/**
 * Contenedor mínimo de inyección de dependencias con singletons y detección de ciclos.
 *
 * @complejidad set, registrar y has O(1) de media; get O(1) de media por dependencia ya construida (más el coste de construir
 * el grafo la primera vez); espacio O(t) con t tipos registrados.
 * @explicacion Como C++ no tiene reflexión, las recetas se registran con plantillas: `registrar<T, Deps...>()` guarda una
 * fábrica que hace make_shared<T>(c.get<Deps>()...) (la expansión del pack construye cada dependencia recursivamente).
 * Cada tipo se identifica con type_index(typeid(T)). Las instancias se guardan como shared_ptr<void>, que sabe borrar el tipo
 * real; al guardar siempre un shared_ptr<T> y recuperar con static_pointer_cast<T> la conversión es correcta (por eso la
 * fábrica de set<T> convierte primero a shared_ptr<T>, también para interfaces). Para detectar ciclos se apunta qué tipos se
 * están construyendo; un guardián RAII (struct local) los saca de la lista al terminar o al lanzar, así el contenedor no queda
 * «envenenado» tras un error.
 * @alternativas Una macro o un registro estático por clase (como hacen algunos frameworks) para no tener que repetir las
 * dependencias; en C++26 la reflexión permitiría el autowiring de verdad. Un shared_ptr<void> con deleter propio en vez de
 * la conversión; un mapa<string, ...> con nombres: pierde la seguridad de tipos.
 */
class Contenedor {
    unordered_map<type_index, function<shared_ptr<void>(Contenedor&)>> fabricas_;
    unordered_map<type_index, shared_ptr<void>> instancias_;
    vector<type_index> enConstruccion_;

public:
    template <class T>
    void set(function<shared_ptr<T>(Contenedor&)> fabrica) {
        fabricas_[type_index(typeid(T))] = [fabrica](Contenedor& c) -> shared_ptr<void> {
            shared_ptr<T> objeto = fabrica(c);   // se convierte a shared_ptr<T> ANTES de borrar el tipo
            return objeto;
        };
    }

    template <class T, class... Deps>
    void registrar() {
        set<T>([](Contenedor& c) { return make_shared<T>(c.get<Deps>()...); });
    }

    template <class T>
    bool has() const {
        return fabricas_.count(type_index(typeid(T))) > 0;
    }

    template <class T>
    shared_ptr<T> get() {
        const type_index id(typeid(T));
        auto hecha = instancias_.find(id);
        if (hecha != instancias_.end()) {
            return static_pointer_cast<T>(hecha->second);
        }
        auto fabrica = fabricas_.find(id);
        if (fabrica == fabricas_.end()) {
            throw ContenedorException(string("No sé construir ") + typeid(T).name());
        }
        if (find(enConstruccion_.begin(), enConstruccion_.end(), id) != enConstruccion_.end()) {
            throw DependenciaCircular(string("Dependencia circular al construir ") + typeid(T).name());
        }
        struct Guardian {   // RAII: saca el tipo de «en construcción» pase lo que pase
            vector<type_index>& lista;
            ~Guardian() { lista.pop_back(); }
        };
        enConstruccion_.push_back(id);
        Guardian guardian{enConstruccion_};
        shared_ptr<void> creada = fabrica->second(*this);
        instancias_[id] = creada;
        return static_pointer_cast<T>(creada);
    }
};

/**
 * Despachador de eventos (Observer) con prioridades.
 *
 * @complejidad escuchar O(k) por inserción ordenada con k oyentes del evento; despachar O(k) (más lo que tarden los oyentes);
 * espacio O(total de oyentes).
 * @explicacion Los oyentes de cada evento se guardan YA ordenados: escuchar() inserta tras el último de prioridad mayor o igual
 * (upper_bound con el comparador), así mismo-prioridad queda por orden de registro y despachar() solo recorre. La plantilla F
 * acepta lambdas que devuelven void o bool; `if constexpr` decide en compilación cómo envolverlas en function<bool(...)>
 * (los void siempre «continúan»). Un oyente que devuelve false se cuenta y rompe el bucle. Se itera una COPIA del vector de
 * oyentes: si un oyente llamara a escuchar() durante el despacho, el vector original podría realojarse e invalidaría los
 * iteradores (UB).
 * @alternativas Guardar sin orden y ordenar al despachar con stable_sort (más simple, O(k log k) en cada despacho). Una
 * std::multimap<int, ...> con la prioridad negada como clave.
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
        function<bool(const string&)> envuelto;
        if constexpr (is_void_v<invoke_result_t<F&, const string&>>) {
            envuelto = [oyente](const string& datos) mutable {
                oyente(datos);
                return true;
            };
        } else {
            envuelto = [oyente](const string& datos) mutable { return static_cast<bool>(oyente(datos)); };
        }
        auto& lista = oyentes_[evento];
        auto donde = upper_bound(lista.begin(), lista.end(), prioridad, [](int p, const Oyente& o) { return p > o.prioridad; });
        lista.insert(donde, Oyente{prioridad, registrados_++, move(envuelto)});
    }

    int despachar(const string& evento, const string& datos = "") {
        auto it = oyentes_.find(evento);
        if (it == oyentes_.end()) {
            return 0;
        }
        vector<Oyente> copia = it->second;
        int ejecutados = 0;
        for (const Oyente& o : copia) {
            ejecutados++;
            if (!o.llamar(datos)) {
                break;
            }
        }
        return ejecutados;
    }
};
