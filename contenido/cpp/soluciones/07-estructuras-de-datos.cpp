#include <algorithm>
#include <array>
#include <functional>
#include <list>
#include <map>
#include <memory>
#include <optional>
#include <queue>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 7 · Estructuras de datos
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Paréntesis balanceados con una pila.
 *
 * @complejidad Tiempo O(n); espacio O(n) en el peor caso (todo aperturas).
 * @explicacion Cada apertura se apila; cada cierre debe coincidir con la cima. Si la pila está vacía al llegar un cierre
 * (`())`), o la cima es de otro tipo (`([)]`), falla. Al final la pila debe estar vacía (`((`). Se comprueba `empty()` ANTES
 * de mirar `back()`: en un vector vacío sería comportamiento indefinido. Se usa un `vector<char>` como pila (push_back,
 * back, pop_back), que es más rápido que `stack` (que envuelve un deque).
 * @alternativas Un contador por cada tipo NO sirve (no detecta `([)]`). Una pila de índices permitiría además informar
 * de la posición del error.
 * @bigo n
 */
bool parentesisBalanceados(const string& texto)
{
    vector<char> pila;
    for (char c : texto) {
        switch (c) {
            case '(':
            case '[':
            case '{':
                pila.push_back(c);
                break;
            case ')':
            case ']':
            case '}': {
                char abre = c == ')' ? '(' : c == ']' ? '[' : '{';
                if (pila.empty() || pila.back() != abre) {
                    return false;
                }
                pila.pop_back();
                break;
            }
            default:
                break;
        }
    }
    return pila.empty();
}

/**
 * Cola con dos pilas.
 *
 * @complejidad encolar O(1); desencolar y frente O(1) AMORTIZADO (en el peor caso aislado O(n)); espacio O(n).
 * @explicacion `entrada` recibe los elementos nuevos; `salida` los entrega. Cuando `salida` se vacía, se vuelca toda
 * `entrada` en ella: al ir de una pila a otra el orden se invierte, y el que llegó primero queda arriba. Cada elemento
 * se mueve de pila UNA vez en toda su vida, así que el coste total de n operaciones es O(n): O(1) amortizado. Los
 * métodos que leen (`frente`) también pueden disparar el volcado, por eso no son `const`.
 * @alternativas `std::queue` o `deque` (la implementación real). Para una cola sin amortización, una lista enlazada
 * con puntero al último.
 */
template <class T>
class ColaConDosPilas {
public:
    void encolar(const T& valor)
    {
        entrada_.push_back(valor);
    }

    T desencolar()
    {
        pasarSiHaceFalta();
        T valor = std::move(salida_.back());
        salida_.pop_back();
        return valor;
    }

    T frente()
    {
        pasarSiHaceFalta();
        return salida_.back();
    }

    size_t tamano() const
    {
        return entrada_.size() + salida_.size();
    }

    bool vacia() const
    {
        return tamano() == 0;
    }

private:
    void pasarSiHaceFalta()
    {
        if (salida_.empty()) {
            if (entrada_.empty()) {
                throw underflow_error("la cola está vacía");
            }
            while (!entrada_.empty()) {
                salida_.push_back(std::move(entrada_.back()));
                entrada_.pop_back();
            }
        }
    }

    vector<T> entrada_;
    vector<T> salida_;
};

/**
 * Invertir una lista enlazada.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Se recorre la lista con tres punteros: `anterior` (la parte ya invertida), `actual` y `siguiente`.
 * En cada paso se guarda `actual->siguiente` (si no, se perdería el resto de la lista), se hace que `actual` apunte hacia
 * atrás y se avanza. Al terminar `anterior` es la nueva cabeza. No se crea ningún nodo.
 * @alternativas Recursiva: más corta, pero usa O(n) de pila y con listas largas la desborda.
 * @bigo n
 */
Nodo* invertirLista(Nodo* cabeza)
{
    Nodo* anterior = nullptr;
    Nodo* actual = cabeza;
    while (actual != nullptr) {
        Nodo* siguiente = actual->siguiente;
        actual->siguiente = anterior;
        anterior = actual;
        actual = siguiente;
    }
    return anterior;
}

/**
 * Detectar ciclos (tortuga y liebre de Floyd).
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion La liebre avanza de dos en dos y la tortuga de uno en uno. Sin ciclo, la liebre llega antes a `nullptr`.
 * Con ciclo, ambas acaban dentro de él y la liebre va cerrando la distancia de uno en uno hasta alcanzar a la tortuga.
 * Antes de dar el segundo paso se comprueba `liebre->siguiente`: desreferenciar `nullptr` es comportamiento indefinido.
 * @alternativas Un `unordered_set` de direcciones visitadas: O(n) de tiempo pero también de memoria.
 * @bigo n
 */
bool tieneCiclo(const Nodo* cabeza)
{
    const Nodo* tortuga = cabeza;
    const Nodo* liebre = cabeza;
    while (liebre != nullptr && liebre->siguiente != nullptr) {
        tortuga = tortuga->siguiente;
        liebre = liebre->siguiente->siguiente;
        if (tortuga == liebre) {
            return true;
        }
    }
    return false;
}

/**
 * Árbol binario de búsqueda sin duplicados.
 *
 * @complejidad insertar y contiene O(h), con h la altura (O(log n) equilibrado, O(n) degenerado); enOrden, tamano y
 * altura O(n) (recorren todo); minimo O(h); espacio O(n).
 * @explicacion La raíz es un `unique_ptr<NodoArbol>`: el árbol es el dueño de sus nodos y los libera al destruirse.
 * `insertarEn` recibe una REFERENCIA al `unique_ptr` del hueco: así, al encontrar un hueco vacío, se puede rellenar con
 * `make_unique`. Buscar es bajar a izquierda o derecha. El recorrido en orden (izquierda, nodo, derecha) entrega los valores
 * ordenados. La altura es 1 + el máximo de las alturas de los hijos (vacío = 0); el mínimo está en el nodo más a la
 * izquierda.
 * @alternativas Un árbol AUTOEQUILIBRADO (AVL, rojinegro, el de `set`/`map`) garantiza O(log n); este se degrada a O(n)
 * si los datos llegan ordenados.
 */
class ArbolBinarioBusqueda {
public:
    void insertar(int valor)
    {
        if (insertarEn(raiz_, valor)) {
            tamano_++;
        }
    }

    bool contiene(int valor) const
    {
        const NodoArbol* n = raiz_.get();
        while (n != nullptr) {
            if (valor == n->valor) {
                return true;
            }
            n = valor < n->valor ? n->izq.get() : n->der.get();
        }
        return false;
    }

    size_t tamano() const
    {
        return tamano_;
    }

    VI enOrden() const
    {
        VI salida;
        recorrer(raiz_, salida);
        return salida;
    }

    int altura() const
    {
        return alturaDe(raiz_);
    }

    optional<int> minimo() const
    {
        const NodoArbol* n = raiz_.get();
        if (n == nullptr) {
            return nullopt;
        }
        while (n->izq) {
            n = n->izq.get();
        }
        return n->valor;
    }

private:
    static bool insertarEn(unique_ptr<NodoArbol>& nodo, int valor)
    {
        if (!nodo) {
            nodo = make_unique<NodoArbol>(valor);
            return true;
        }
        if (valor == nodo->valor) {
            return false;
        }
        return insertarEn(valor < nodo->valor ? nodo->izq : nodo->der, valor);
    }

    static void recorrer(const unique_ptr<NodoArbol>& nodo, VI& salida)
    {
        if (!nodo) {
            return;
        }
        recorrer(nodo->izq, salida);
        salida.push_back(nodo->valor);
        recorrer(nodo->der, salida);
    }

    static int alturaDe(const unique_ptr<NodoArbol>& nodo)
    {
        return nodo ? 1 + max(alturaDe(nodo->izq), alturaDe(nodo->der)) : 0;
    }

    unique_ptr<NodoArbol> raiz_;
    size_t tamano_ = 0;
};

/**
 * Montículo de mínimos sobre un vector.
 *
 * @complejidad insertar y extraerMinimo O(log n); minimo, tamano y vacio O(1); espacio O(n).
 * @explicacion El vector guarda el árbol por niveles: los hijos de `i` son `2i+1` y `2i+2`, el padre es `(i-1)/2`.
 * `insertar` añade al final y SUBE el valor intercambiándolo con su padre mientras sea menor. `extraerMinimo` guarda la
 * raíz, mueve el último elemento a la raíz y lo BAJA intercambiándolo con el hijo menor mientras algún hijo sea menor.
 * Ambas recorren como mucho la altura del árbol, log₂ n niveles. En `subir` se comprueba `i > 0` antes de calcular el
 * padre: con size_t, `0 - 1` daría un número enorme.
 * @alternativas `priority_queue` con `greater<int>` (usa `push_heap`/`pop_heap` sobre un vector). `make_heap` construye
 * un montículo de n elementos en O(n) en lugar de n inserciones O(n log n).
 */
class MinHeap {
public:
    void insertar(int valor)
    {
        datos_.push_back(valor);
        subir(datos_.size() - 1);
    }

    int extraerMinimo()
    {
        if (datos_.empty()) {
            throw underflow_error("montículo vacío");
        }
        int raiz = datos_.front();
        datos_.front() = datos_.back();
        datos_.pop_back();
        if (!datos_.empty()) {
            bajar(0);
        }
        return raiz;
    }

    int minimo() const
    {
        if (datos_.empty()) {
            throw underflow_error("montículo vacío");
        }
        return datos_.front();
    }

    size_t tamano() const
    {
        return datos_.size();
    }

    bool vacio() const
    {
        return datos_.empty();
    }

private:
    void subir(size_t i)
    {
        while (i > 0) {
            size_t padre = (i - 1) / 2;
            if (datos_[padre] <= datos_[i]) {
                break;
            }
            swap(datos_[padre], datos_[i]);
            i = padre;
        }
    }

    void bajar(size_t i)
    {
        size_t n = datos_.size();
        while (true) {
            size_t menor = i;
            size_t izq = 2 * i + 1;
            size_t der = 2 * i + 2;
            if (izq < n && datos_[izq] < datos_[menor]) {
                menor = izq;
            }
            if (der < n && datos_[der] < datos_[menor]) {
                menor = der;
            }
            if (menor == i) {
                break;
            }
            swap(datos_[i], datos_[menor]);
            i = menor;
        }
    }

    vector<int> datos_;
};

/**
 * Heap sort con el montículo propio.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @explicacion Meter n elementos cuesta n·O(log n) y sacarlos, otro tanto; como cada extracción devuelve el menor de los
 * que quedan, salen ya ordenados. Se reserva el tamaño del resultado de antemano para no realocar.
 * @alternativas El heap sort "de verdad" ordena EN EL SITIO con O(1) de memoria extra (construye un max-heap sobre el propio
 * vector con `make_heap` y extrae con `pop_heap`: `sort_heap`). En la práctica `sort` de la biblioteca es más rápido.
 * @bigo nlogn
 */
vector<int> ordenarConMonticulo(const vector<int>& xs)
{
    MinHeap heap;
    for (int x : xs) {
        heap.insertar(x);
    }
    vector<int> ordenado;
    ordenado.reserve(xs.size());
    while (!heap.vacio()) {
        ordenado.push_back(heap.extraerMinimo());
    }
    return ordenado;
}

/**
 * Caché LRU con lista + tabla hash.
 *
 * @complejidad obtener, poner y tamano O(1) de media; claves O(n) (devuelve todas); espacio O(capacidad).
 * @explicacion La lista `uso_` guarda las entradas de la MÁS reciente (delante) a la más antigua (detrás). La tabla
 * `indice_` lleva cada clave al iterador de su nodo, así que encontrar una entrada es O(1) y no hay que recorrer la lista.
 * Marcar como reciente es `splice`: mueve el nodo al principio sin copiarlo ni invalidar ningún iterador. Al pasarse de
 * capacidad se expulsa el último nodo (la más antigua), borrando también su entrada en la tabla.
 * @alternativas Con un `map` ordenado por un contador de uso, todo sería O(log n). Una lista enlazada hecha a mano con
 * punteros prev/next hace lo mismo que `std::list`.
 * @bigo 1
 */
class CacheLRU {
public:
    CacheLRU(int capacidad) : capacidad_(capacidad)
    {
        if (capacidad < 1) {
            throw invalid_argument("la capacidad debe ser al menos 1");
        }
        indice_.reserve(static_cast<size_t>(capacidad) * 2);
    }

    optional<int> obtener(const string& clave)
    {
        auto it = indice_.find(clave);
        if (it == indice_.end()) {
            return nullopt;
        }
        uso_.splice(uso_.begin(), uso_, it->second);        // la marca como la más reciente
        return it->second->second;
    }

    void poner(const string& clave, int valor)
    {
        auto it = indice_.find(clave);
        if (it != indice_.end()) {
            it->second->second = valor;
            uso_.splice(uso_.begin(), uso_, it->second);
            return;
        }
        uso_.emplace_front(clave, valor);
        indice_[clave] = uso_.begin();
        if (static_cast<int>(uso_.size()) > capacidad_) {
            indice_.erase(uso_.back().first);               // primero la tabla (usa la clave del nodo), luego el nodo
            uso_.pop_back();
        }
    }

    vector<string> claves() const
    {
        vector<string> r;
        r.reserve(uso_.size());
        for (const auto& [clave, valor] : uso_) {
            r.push_back(clave);
        }
        return r;
    }

    size_t tamano() const
    {
        return uso_.size();
    }

private:
    int capacidad_;
    list<pair<string, int>> uso_;
    unordered_map<string, list<pair<string, int>>::iterator> indice_;
};

/**
 * Los k mayores con un min-heap de tamaño k.
 *
 * @complejidad Tiempo O(n log k); espacio O(k).
 * @explicacion El min-heap guarda los k mayores vistos hasta ahora, con el MENOR de ellos en la cima. Cada número nuevo
 * solo entra si supera a ese mínimo (que sale): así el montículo nunca pasa de k elementos y cada operación cuesta
 * O(log k). Al final se vacía de menor a mayor, y se rellena el resultado desde atrás para dejarlo de mayor a menor.
 * @alternativas Ordenar todo y quedarse con los k primeros: O(n log n). `nth_element` parte el vector en O(n) de media
 * (quickselect), sin garantía en el peor caso.
 * @bigo n
 */
vector<int> topK(const vector<int>& xs, int k)
{
    if (k <= 0) {
        return {};
    }
    priority_queue<int, vector<int>, greater<int>> menores;
    for (int x : xs) {
        if (static_cast<int>(menores.size()) < k) {
            menores.push(x);
        } else if (x > menores.top()) {
            menores.pop();
            menores.push(x);
        }
    }
    vector<int> resultado(menores.size());
    for (size_t i = resultado.size(); i > 0; i--) {
        resultado[i - 1] = menores.top();
        menores.pop();
    }
    return resultado;
}

/**
 * Union-Find con compresión de caminos y unión por rango.
 *
 * @complejidad encontrar, unir y conectados O(α(n)) amortizado (prácticamente constante); espacio O(n).
 * @explicacion `padre_[x]` apunta hacia la raíz del grupo (la raíz se apunta a sí misma). `encontrar` sube hasta la raíz y,
 * en una segunda pasada, re-apunta todo el camino directamente a ella (compresión): se hace con un bucle, no con
 * recursión, para que una cadena larga no desborde la pila. `unir` cuelga la raíz de menor rango bajo la de mayor
 * rango (el árbol no se alarga) y el rango solo crece cuando se unen dos árboles de la misma altura. Cada fusión
 * real resta un grupo.
 * @alternativas Solo compresión o solo rango ya dan O(log n) amortizado; las dos juntas, α(n). Sin ninguna, una cadena
 * de uniones degenera en O(n) por búsqueda.
 */
class UnionFind {
public:
    UnionFind(int n) : padre_(static_cast<size_t>(n)), rango_(static_cast<size_t>(n), 0), grupos_(n)
    {
        for (size_t i = 0; i < padre_.size(); i++) {
            padre_[i] = static_cast<int>(i);
        }
    }

    int encontrar(int x)
    {
        comprobar(x);
        int raiz = x;
        while (padre_[static_cast<size_t>(raiz)] != raiz) {
            raiz = padre_[static_cast<size_t>(raiz)];
        }
        while (padre_[static_cast<size_t>(x)] != raiz) {        // compresión: todo el camino apunta ya a la raíz
            int siguiente = padre_[static_cast<size_t>(x)];
            padre_[static_cast<size_t>(x)] = raiz;
            x = siguiente;
        }
        return raiz;
    }

    bool unir(int a, int b)
    {
        int ra = encontrar(a);
        int rb = encontrar(b);
        if (ra == rb) {
            return false;
        }
        if (rango_[static_cast<size_t>(ra)] < rango_[static_cast<size_t>(rb)]) {
            swap(ra, rb);
        }
        padre_[static_cast<size_t>(rb)] = ra;                   // el árbol más bajo cuelga del más alto
        if (rango_[static_cast<size_t>(ra)] == rango_[static_cast<size_t>(rb)]) {
            rango_[static_cast<size_t>(ra)]++;
        }
        grupos_--;
        return true;
    }

    bool conectados(int a, int b)
    {
        return encontrar(a) == encontrar(b);
    }

    int componentes() const
    {
        return grupos_;
    }

private:
    void comprobar(int x) const
    {
        if (x < 0 || static_cast<size_t>(x) >= padre_.size()) {
            throw out_of_range("elemento fuera de rango");
        }
    }

    vector<int> padre_;
    vector<int> rango_;
    int grupos_;
};

/**
 * Trie (árbol de prefijos).
 *
 * @complejidad insertar, contiene y tienePrefijo O(L), con L la longitud de la palabra; palabrasConPrefijo O(L + tamaño del
 * resultado); espacio O(total de letras · 26) en el peor caso.
 * @explicacion Cada nodo tiene 26 hijos (uno por letra, `unique_ptr`, nulo si no existe) y una marca `fin` si ahí termina
 * una palabra. Insertar y buscar es seguir letra a letra, creando los nodos que falten al insertar. `contiene` exige
 * llegar al final Y que `fin` esté activo (si no, "cas" no sería palabra de "casa"); `tienePrefijo` solo exige llegar. Para
 * listar, se baja hasta el prefijo y se recorre el subárbol en profundidad visitando los hijos de la 'a' a la 'z', lo
 * que produce las palabras ya ordenadas.
 * @alternativas `map<char, Nodo>` por nodo ahorra memoria con alfabetos grandes. Un `set<string>` con `lower_bound` también
 * localiza palabras por prefijo, en O(L log n).
 */
class Trie {
public:
    void insertar(const string& palabra)
    {
        if (palabra.empty()) {
            return;
        }
        Nodo* n = &raiz_;
        for (char c : palabra) {
            auto& hijo = n->hijos[indice(c)];
            if (!hijo) {
                hijo = make_unique<Nodo>();
            }
            n = hijo.get();
        }
        n->fin = true;
    }

    bool contiene(const string& palabra) const
    {
        const Nodo* n = buscar(palabra);
        return n != nullptr && n->fin;
    }

    bool tienePrefijo(const string& prefijo) const
    {
        return buscar(prefijo) != nullptr;
    }

    vector<string> palabrasConPrefijo(const string& prefijo) const
    {
        vector<string> resultado;
        const Nodo* n = buscar(prefijo);
        if (n != nullptr) {
            string actual = prefijo;
            recoger(n, actual, resultado);
        }
        return resultado;
    }

private:
    struct Nodo {
        array<unique_ptr<Nodo>, 26> hijos;
        bool fin = false;
    };

    static size_t indice(char c)
    {
        return static_cast<size_t>(c - 'a');
    }

    const Nodo* buscar(const string& texto) const
    {
        const Nodo* n = &raiz_;
        for (char c : texto) {
            n = n->hijos[indice(c)].get();
            if (n == nullptr) {
                return nullptr;
            }
        }
        return n;
    }

    static void recoger(const Nodo* n, string& actual, vector<string>& salida)
    {
        if (n->fin) {
            salida.push_back(actual);
        }
        for (size_t i = 0; i < 26; i++) {
            if (n->hijos[i]) {
                actual.push_back(static_cast<char>('a' + i));
                recoger(n->hijos[i].get(), actual, salida);
                actual.pop_back();
            }
        }
    }

    Nodo raiz_;
};
