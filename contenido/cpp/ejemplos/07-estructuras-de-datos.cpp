#include <algorithm>
#include <climits>
#include <deque>
#include <functional>
#include <iostream>
#include <list>
#include <map>
#include <memory>
#include <optional>
#include <queue>
#include <set>
#include <stack>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

/*
 * TEMA 7 · ESTRUCTURAS DE DATOS
 * ────────────────────────────────────────────────────────────────────────────
 * Elegir la estructura adecuada suele importar más que optimizar el código. La biblioteca estándar de C++ (la STL)
 * trae casi todas; aquí aprenderás a usarlas, qué cuestan, y cómo se construyen "por dentro" las que no vienen hechas.
 *
 *   Java                         C++ (STL)                          Coste típico
 *   ArrayList / array            vector<T>                          acceso O(1), push_back O(1) amortizado
 *   Stack                        stack<T>  (o un vector)            push, pop, top: O(1)
 *   Queue / ArrayDeque           queue<T>  /  deque<T>              push, pop, front: O(1)
 *   LinkedList                   list<T>  (doblemente enlazada)     insertar/borrar con un iterador O(1)
 *   PriorityQueue                priority_queue<T>  (¡MAX-heap!)    push, pop: O(log n); top: O(1)
 *   TreeMap / TreeSet            map<K,V> / set<T>                  O(log n), claves ordenadas
 *   HashMap / HashSet            unordered_map / unordered_set      O(1) de media
 *   int[] (tamaño fijo)          array<T, N>                        acceso O(1), sin memoria dinámica
 *
 * CÓMO SE TRABAJA EN ESTE ARCHIVO
 *   - Ctrl+Enter ejecuta la teoría (secciones 1-6) y las PRUEBAS de tus ejercicios, que empiezan con `pendiente();`
 *     (salen como «pendiente», no como fallo, hasta que los sustituyas por tu código).
 *   - Ctrl+S guarda tu avance. «Solución» compara tu código con el de referencia. «Medir» (Ctrl+Alt+Enter) dibuja
 *     el coste real de tus funciones.
 *   - C++ exige DECLARAR antes de USAR: por eso todo está por encima de main().
 *
 * DESDE JAVA / PHP / PYTHON (lo que cambia en este tema)
 *   - Un std::stack<T>::pop() NO devuelve el elemento (es void): primero top(), luego pop(). Lo mismo con queue.
 *   - top()/front()/back() en un contenedor VACÍO es comportamiento indefinido (no una excepción): comprueba empty().
 *   - priority_queue es un MAX-heap: saca primero el mayor. Para un min-heap: priority_queue<int, vector<int>, greater<int>>.
 *   - Los objetos NO son referencias: `vector<Persona> v2 = v1;` COPIA todo. Se pasan con `const T&` para no copiar.
 *   - No hay recolector de basura. Lo que crees con `new` hay que liberarlo con `delete`; lo moderno es no escribir
 *     `new` ni `delete`: unique_ptr (un solo dueño) y las clases de la STL se encargan (RAII: el destructor libera).
 * DESDE C: lo que en C hacías con malloc/free y structs enlazadas aquí se hace con new/delete (o, mejor, con
 *   unique_ptr/vector). Los mismos errores siguen existiendo: fugas, doble delete, puntero colgante (use-after-free).
 *   En el modo comprobado del playground (ASan + UBSan), los detecta y te dice la línea.
 */

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

using VI = vector<int>;
using VS = vector<string>;

// ── Sección 1 · PILA (LIFO): EL ÚLTIMO EN ENTRAR ES EL PRIMERO EN SALIR (teoría y funciones de apoyo) ──
// Usos: deshacer/rehacer, recorrido en profundidad, evaluar expresiones, comprobar paréntesis.
// std::stack<T> es un "adaptador": por dentro usa un deque<T> y solo deja ver push, pop, top, size y empty.
// En la práctica, muchos programadores usan directamente un vector (push_back / back / pop_back): más rápido, y
// permite recorrerlo para depurar.

// ── 1b. La pila monótona: "siguiente mayor" en O(n) ──
// Para cada elemento, ¿cuál es el siguiente a su derecha que es MAYOR? La fuerza bruta es O(n²). Con una pila de
// índices cuyos valores van en orden decreciente: cuando llega un valor mayor que la cima, resuelve a todos los de la cima.
// Cada índice entra y sale una vez: O(n). Es de los trucos de pila que más caen en entrevistas.

/** resultado[i] = el primer valor mayor que xs[i] a su derecha, o -1 si no hay. */
VI siguienteMayor(const VI& xs)
{
    VI resultado(xs.size(), -1);
    vector<size_t> pila;                        // índices pendientes de resolver (sus valores van de mayor a menor)
    for (size_t i = 0; i < xs.size(); i++) {
        while (!pila.empty() && xs[pila.back()] < xs[i]) {
            resultado[pila.back()] = xs[i];     // xs[i] es el siguiente mayor de la cima
            pila.pop_back();
        }
        pila.push_back(i);
    }
    return resultado;
}

// ── Sección 2 · COLA (FIFO): EL PRIMERO EN ENTRAR ES EL PRIMERO EN SALIR (teoría y funciones de apoyo) ──
// Usos: tareas pendientes, recorrido en anchura (BFS), buffers.
// std::queue<T> (push al final, front/pop al principio) también envuelve un deque. Un deque<T> es una "cola de dos
// extremos": push_back/push_front/pop_back/pop_front en O(1) y además acceso con [] en O(1).
// TRAMPA: simular una cola con un vector borrando el primero (`v.erase(v.begin())`) cuesta O(n) por operación
// (desplaza todo): para colas, queue o deque; o un vector con un índice de cabeza que avanza.

// ── 2b. list + splice: mover nodos en O(1) (la idea de la caché LRU) ──
// std::list<T> es una lista doblemente enlazada. Su superpoder: dado un ITERADOR a un nodo, borrarlo o moverlo a otro
// sitio cuesta O(1), y los iteradores de los demás nodos NO se invalidan. `l.splice(destino, l, it)` recoloca el nodo `it`
// delante de `destino` sin copiar nada. Combinada con un unordered_map<clave, iterador> (para encontrar el nodo en O(1))
// es la receta de la CacheLRU del ejercicio 6. Lo que NO tiene: acceso por índice (hay que recorrer) ni buena
// localidad de memoria (cada nodo está en un sitio distinto; en la práctica un vector suele ganar con datos pequeños).

// ── Sección 3 · MONTÍCULO (HEAP) Y COLA DE PRIORIDAD (teoría y funciones de apoyo) ──
// Un montículo mantiene "el menor (o mayor) a mano": mirar el extremo es O(1) y insertar/extraer, O(log n).
// Se guarda en un array con una regla: los hijos del nodo i son 2i+1 y 2i+2 (su padre, (i-1)/2), y un padre nunca
// es mayor que sus hijos (en un min-heap). No está ordenado del todo: solo garantiza que la raíz es el mínimo.
//   insertar: añade al final y "sube" mientras sea menor que su padre.        O(log n)
//   extraer:  saca la raíz, pone el último en su lugar y lo "baja" intercambiándolo con el hijo menor.   O(log n)
// En C++: priority_queue<T> (max-heap por defecto), con push / top / pop / size / empty. No se puede recorrer ni
// modificar un elemento intermedio (para "decrease-key" en Dijkstra se insertan duplicados y se ignoran los obsoletos).
// Dos trampas: el comparador está "al revés" (con less, el mayor sale primero; para min-heap, greater) y top() en
// una cola vacía es comportamiento indefinido.

// ── Sección 4 · LISTA ENLAZADA: LO QUE PASA "POR DENTRO" EN list / LinkedList (teoría y funciones de apoyo) ──
// Cada nodo guarda un valor y un puntero al siguiente. Insertar/borrar al principio es O(1) (solo cambian punteros)
// pero acceder a la posición k es O(k). En C++ casi nunca la necesitas (el vector es más rápido casi siempre), pero es
// el ejemplo clásico para practicar punteros: lo harás en los ejercicios.

/** Un nodo con puntero CRUDO (`Nodo*`): quien lo crea con new es responsable de liberarlo con delete. */
struct Nodo {
    int valor;
    Nodo* siguiente = nullptr;      // nullptr = "no hay siguiente" (en C: NULL; en Java: null)
};

/** Construye la lista 1 → 2 → 3 con new. El que la llame DEBE liberarla con liberarLista. */
Nodo* listaDesde(const VI& valores)
{
    Nodo* cabeza = nullptr;
    for (auto it = valores.rbegin(); it != valores.rend(); ++it) {      // al revés, para enlazar cada nodo con el ya construido
        cabeza = new Nodo{*it, cabeza};
    }
    return cabeza;
}

/** Libera todos los nodos. Guarda el siguiente ANTES de borrar el actual (después ya no se puede leer). */
void liberarLista(Nodo* cabeza)
{
    while (cabeza != nullptr) {
        Nodo* siguiente = cabeza->siguiente;
        delete cabeza;
        cabeza = siguiente;
    }
}

/** Recorre la lista y devuelve sus valores (con un tope por si hay un ciclo, que si no no acabaría nunca). */
VI listaAVector(const Nodo* cabeza, size_t limite = 1000)
{
    VI valores;
    for (const Nodo* n = cabeza; n != nullptr && valores.size() < limite; n = n->siguiente) {
        valores.push_back(n->valor);
    }
    return valores;
}

/**
 * Las pruebas necesitan listas (incluso con ciclos) sin escribir new/delete a mano: esta clase es la DUEÑA de los
 * nodos (los guarda en un deque, que no mueve los elementos al crecer) y los libera todos al destruirse, sea cual
 * sea el cableado que haga tu código. Es una "arena". Tus funciones solo reciben y devuelven punteros crudos.
 */
class Lista {
public:
    explicit Lista(const VI& valores)
    {
        for (int v : valores) {
            nodos_.push_back(Nodo{v, nullptr});
        }
        for (size_t i = 0; i + 1 < nodos_.size(); i++) {
            nodos_[i].siguiente = &nodos_[i + 1];
        }
    }
    Lista(const Lista&) = delete;               // copiarla dejaría punteros apuntando a los nodos de la otra
    Lista& operator=(const Lista&) = delete;

    Nodo* cabeza() { return nodos_.empty() ? nullptr : &nodos_.front(); }
    Nodo& nodo(size_t i) { return nodos_[i]; }

private:
    deque<Nodo> nodos_;
};

// ── 4b. La versión moderna: unique_ptr ──
// unique_ptr<T> es un puntero con UN solo dueño: cuando se destruye, hace delete solo. No se puede copiar (habría dos
// dueños), solo MOVER con std::move (el origen queda en nullptr). make_unique<T>(args) crea el objeto.
struct NodoUnico {
    int valor;
    unique_ptr<NodoUnico> siguiente;
    explicit NodoUnico(int v) : valor(v) {}
};

class ListaUnica {
public:
    ListaUnica() = default;
    ~ListaUnica()
    {
        // Si se dejara el destructor por defecto, liberar un nodo liberaría el siguiente, y este el siguiente...: una
        // RECURSIÓN tan profunda como la lista. Con un millón de nodos desborda la pila (y el programa se cae).
        // Se desmonta a mano, de uno en uno.
        while (cabeza_) {
            cabeza_ = std::move(cabeza_->siguiente);
        }
    }
    ListaUnica(const ListaUnica&) = delete;
    ListaUnica& operator=(const ListaUnica&) = delete;

    void agregarAlPrincipio(int valor)
    {
        auto nuevo = make_unique<NodoUnico>(valor);
        nuevo->siguiente = std::move(cabeza_);      // el nuevo se queda con el resto de la lista
        cabeza_ = std::move(nuevo);                 // y pasa a ser la cabeza
    }

    /** Invierte la lista re-enlazando punteros, sin crear ni copiar nodos. */
    void invertir()
    {
        unique_ptr<NodoUnico> invertida;
        while (cabeza_) {
            auto resto = std::move(cabeza_->siguiente);
            cabeza_->siguiente = std::move(invertida);
            invertida = std::move(cabeza_);
            cabeza_ = std::move(resto);
        }
        cabeza_ = std::move(invertida);
    }

    VI aVector() const
    {
        VI r;
        for (const NodoUnico* n = cabeza_.get(); n != nullptr; n = n->siguiente.get()) {
            r.push_back(n->valor);
        }
        return r;
    }

private:
    unique_ptr<NodoUnico> cabeza_;
};

// ── Sección 5 · ÁRBOL BINARIO DE BÚSQUEDA (ABB) (teoría y funciones de apoyo) ──
// En cada nodo: todo lo de la izquierda es menor y todo lo de la derecha, mayor. Buscar, insertar y
// borrar cuestan O(altura): O(log n) si está equilibrado, O(n) si degenera en una "lista" (datos ordenados).
// El recorrido en orden (izquierda, nodo, derecha) devuelve los valores ORDENADOS.
// (Los map y set de la STL son árboles de búsqueda AUTOEQUILIBRADOS: rojinegros. Aquí haces uno sin equilibrar.)

struct NodoArbol {
    int valor;
    unique_ptr<NodoArbol> izq;      // cada hijo pertenece a su padre; destruir el árbol destruye todo
    unique_ptr<NodoArbol> der;
    explicit NodoArbol(int v) : valor(v) {}
};

/** Inserta en el árbol. `nodo` es una REFERENCIA al puntero que hay en el hueco: así se puede rellenar el hueco vacío. */
void insertarEn(unique_ptr<NodoArbol>& nodo, int valor)
{
    if (!nodo) {
        nodo = make_unique<NodoArbol>(valor);
    } else if (valor < nodo->valor) {
        insertarEn(nodo->izq, valor);
    } else if (valor > nodo->valor) {
        insertarEn(nodo->der, valor);
    }                               // si es igual no se inserta (sin duplicados)
}

void enOrdenDe(const unique_ptr<NodoArbol>& nodo, VI& salida)    // `const unique_ptr&`: se mira, no se toca ni se copia
{
    if (!nodo) {
        return;
    }
    enOrdenDe(nodo->izq, salida);
    salida.push_back(nodo->valor);
    enOrdenDe(nodo->der, salida);
}

// ── 5b. Trie: un árbol de prefijos ──
// Un trie guarda palabras letra a letra: cada nodo tiene un hijo por letra y una marca "aquí termina una palabra".
//      raíz ─ c ─ a ─ s ─ a*          (casa)          Buscar una palabra o un prefijo cuesta O(longitud), no
//             │   └ r ─ a*            (cara)          importa cuántas palabras haya. Se usa para autocompletar,
//             └ o ─ s ─ a*            (cosa)          diccionarios y correctores. Lo implementarás en el ejercicio 11.
// Cada nodo puede tener `array<unique_ptr<Nodo>, 26>` (rápido, gasta memoria) o `map<char, unique_ptr<Nodo>>`
// (ahorra memoria y recorre ordenado).

// ── Sección 6 · CLAVES PROPIAS: struct EN set / map / unordered_map (teoría y funciones de apoyo) ──
// En Java defines equals + hashCode (o compareTo); en C++:
//   · set / map          piden un orden: operator< (o un comparador). C++20: `auto operator<=>(...) const = default;`
//                         genera TODOS los operadores de comparación comparando campo a campo.
//   · unordered_set/map  piden igualdad (operator==) y una función hash (una especialización de std::hash o un functor).
//   · "identidad de objeto" (el IdentityHashMap de Java / SplObjectStorage de PHP): usa como clave la DIRECCIÓN
//     (`const Nodo*`): dos nodos con el mismo valor son claves distintas porque están en sitios distintos.

struct Punto {
    int x;
    int y;
    auto operator<=>(const Punto&) const = default;     // da <, >, <=, >=, == y !=
};

ostream& operator<<(ostream& out, const Punto& p)      // para que cout << punto (y los resultados de las pruebas) lo muestren bonito
{
    return out << "(" << p.x << ", " << p.y << ")";
}

template <>
struct std::hash<Punto> {                                // especializar std::hash<Punto> es lo que permite unordered_set<Punto>
    size_t operator()(const Punto& p) const noexcept
    {
        size_t h = hash<int>()(p.x);
        return h ^ (hash<int>()(p.y) + 0x9e3779b97f4a7c15ULL + (h << 6) + (h >> 2));   // combinar dos hashes
    }
};

/** ¿Hay un ciclo? Con un conjunto de DIRECCIONES visitadas: O(n) de tiempo y de memoria (el ejercicio 4 lo hace en O(1) de memoria). */
bool tieneCicloConConjunto(const Nodo* cabeza)
{
    unordered_set<const Nodo*> vistos;
    for (const Nodo* n = cabeza; n != nullptr; n = n->siguiente) {
        if (!vistos.insert(n).second) {         // insert devuelve {iterador, ¿se insertó?}: false = ya estaba
            return true;
        }
    }
    return false;
}

// ── 6b. Union-Find (conjuntos disjuntos) ──
// Mantiene una partición de {0..n-1} en grupos y responde dos preguntas casi en O(1):
//   encontrar(x): ¿cuál es el REPRESENTANTE del grupo de x?     unir(a, b): fusiona los grupos de a y b.
// Cada elemento apunta a un "padre"; el representante es la raíz del árbol (se apunta a sí mismo). Dos optimizaciones lo
// vuelven casi constante (O(α(n)), α crece tan despacio que es ≤ 4 para cualquier n real):
//   · compresión de caminos: al buscar la raíz, se re-apunta todo el camino directamente a ella;
//   · unión por rango: el árbol más bajo se cuelga del más alto, para que no se alarguen.
// Usos: componentes conexas, detectar ciclos en grafos no dirigidos, el algoritmo de Kruskal. Lo harás en el ejercicio 8.

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · parentesisBalanceados (pila) ──────────────────────────────
/**
 * ¿Están bien emparejados y anidados los paréntesis ( ), corchetes [ ] y llaves { } del texto?
 * Los demás caracteres se ignoran. Usa una pila: cada cierre debe coincidir con el último apertura sin cerrar.
 *   "a(b[c]{d})e" → true    "(]" → false    "([)]" → false    "((" → false    "" → true
 * Trampa: con un cierre y la pila vacía, top()/back() es comportamiento INDEFINIDO: comprueba empty() antes.
 */
bool parentesisBalanceados(const string& texto)
{
    return pendiente();
}

// ── Ejercicio 2 · ColaConDosPilas ───────────────────────────────────────────
/**
 * Una cola FIFO construida SOLO con dos pilas (vector o stack): una para entrar y otra para salir. Cuando la de
 * salida se vacía, se le pasa todo lo de la de entrada (que invierte el orden). Cada elemento cambia de pila una
 * sola vez, así que desencolar es O(1) AMORTIZADO.
 *  - Es una plantilla (template): ColaConDosPilas<int>, ColaConDosPilas<string>... sirve para cualquier tipo T.
 *  - desencolar() y frente() en una cola vacía lanzan underflow_error.
 */
template <class T>
class ColaConDosPilas {
public:
    void encolar(const T& valor)
    {
        pendiente();
    }

    T desencolar()
    {
        return pendiente();
    }

    T frente()
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    bool vacia() const
    {
        return pendiente();
    }

private:
    // aquí tus dos pilas
};

// ── Ejercicio 3 · Lista enlazada: invertir y detectar ciclos ────────────────
/**
 * Invierte la lista cambiando los punteros `siguiente` (sin crear nodos nuevos) y devuelve la nueva cabeza.
 * O(n) de tiempo y O(1) de memoria. Lista vacía (nullptr) → nullptr.   1 → 2 → 3   pasa a   3 → 2 → 1
 * Necesitas TRES punteros: el anterior, el actual y el siguiente (guárdalo antes de cambiar actual->siguiente).
 */
Nodo* invertirLista(Nodo* cabeza)
{
    return pendiente();
}

/**
 * ¿La lista tiene un ciclo (algún nodo vuelve a apuntar a uno anterior)? Con el algoritmo de la tortuga y la liebre
 * de Floyd (dos punteros: uno avanza de 1 en 1 y otro de 2 en 2; si hay ciclo acaban coincidiendo): O(n) de
 * tiempo y O(1) de memoria. (Con un conjunto de nodos vistos, como tieneCicloConConjunto, serían O(n) de memoria.)
 * Cuidado con desreferenciar nullptr al avanzar de dos en dos.
 */
bool tieneCiclo(const Nodo* cabeza)
{
    return pendiente();
}

// ── Ejercicio 4 · ArbolBinarioBusqueda ──────────────────────────────────────
/**
 * Un ABB de enteros SIN duplicados (insertar un valor que ya está no hace nada), usando NodoArbol.
 *  - insertar(v), contiene(v): bool, tamano(): cuántos valores hay.
 *  - enOrden(): valores ordenados de menor a mayor.
 *  - altura(): niveles del árbol (vacío = 0, un solo nodo = 1).
 *  - minimo(): el menor valor, o nullopt si está vacío.
 * Las funciones recursivas auxiliares (privadas) reciben el nodo; los hijos son unique_ptr: pásalos por referencia.
 */
class ArbolBinarioBusqueda {
public:
    void insertar(int valor)
    {
        pendiente();
    }

    bool contiene(int valor) const
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    VI enOrden() const
    {
        return pendiente();
    }

    int altura() const
    {
        return pendiente();
    }

    optional<int> minimo() const
    {
        pendiente();        // (con optional hace falta un return después: sustituye estas dos líneas por tu código)
        return nullopt;
    }

private:
    // aquí tu raíz (unique_ptr<NodoArbol>) y lo que necesites
};

// ── Ejercicio 5 · MinHeap (montículo mínimo propio) ─────────────────────────
/**
 * Un montículo de mínimos de enteros guardado en un vector (sin usar priority_queue ni make_heap):
 *  - insertar(v): añádelo al final y "súbelo" mientras sea menor que su padre ((i-1)/2). O(log n).
 *  - extraerMinimo(): quita la raíz, pon el último elemento en su lugar y "bájalo" intercambiándolo con el
 *    hijo menor mientras haga falta (hijos: 2i+1 y 2i+2). O(log n).
 *  - minimo() mira la raíz sin quitarla (O(1)). Ambos, en un montículo vacío, lanzan underflow_error.
 * Cuidado: con size_t, `i - 1` cuando i == 0 da un número enorme; comprueba i > 0 antes de calcular el padre.
 */
class MinHeap {
public:
    void insertar(int valor)
    {
        pendiente();
    }

    int extraerMinimo()
    {
        return pendiente();
    }

    int minimo() const
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    bool vacio() const
    {
        return pendiente();
    }

private:
    // aquí tu vector
};

/**
 * Heap sort sencillo: mete todos los elementos en tu MinHeap y sácalos uno a uno. O(n log n).
 */
VI ordenarConMonticulo(const VI& xs)
{
    return pendiente();
}

// ── Ejercicio 6 · CacheLRU ──────────────────────────────────────────────────
/**
 * Caché "Least Recently Used" (clave texto → valor entero): guarda como mucho `capacidad` entradas y, al pasarse,
 * expulsa la que lleva más tiempo sin usarse. Tanto obtener() como poner() cuentan como "uso".
 *  - obtener(clave): el valor, o nullopt si no está (y la marca como la más reciente).
 *  - poner(clave, valor): inserta o actualiza (también la marca como la más reciente) y expulsa si hace falta.
 *  - claves(): las claves de la MÁS reciente a la MÁS antigua. tamano(): cuántas hay.
 *  - capacidad menor que 1 → invalid_argument.
 * Todo O(1). Pista: un std::list<pair<string,int>> ordenado por uso (la más reciente delante) + un
 * unordered_map<string, list<...>::iterator> para localizar cada nodo; list::splice mueve un nodo sin copiarlo (ver 2b).
 * ¡No recorras la lista para buscar la clave!
 */
class CacheLRU {
public:
    CacheLRU(int capacidad)
    {
        pendiente();
    }

    optional<int> obtener(const string& clave)
    {
        pendiente();        // (con optional hace falta un return después: sustituye estas dos líneas por tu código)
        return nullopt;
    }

    void poner(const string& clave, int valor)
    {
        pendiente();
    }

    VS claves() const
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

private:
    // aquí tus campos
};

// ── Ejercicio 7 · topK con un montículo ─────────────────────────────────────
/**
 * Los k valores MAYORES del vector, de mayor a menor, sin ordenar todo: mantén una priority_queue de MÍNIMOS de
 * tamaño máximo k (si entra uno más grande que el mínimo, saca el mínimo). O(n log k) y memoria O(k).
 *   topK({5, 1, 9, 3, 7}, 2)  →  {9, 7}       k = 0 → {}       k mayor que el vector → todo, ordenado desc.
 * Recuerda: priority_queue<int, vector<int>, greater<int>> es el min-heap.
 */
VI topK(const VI& xs, int k)
{
    return pendiente();
}

// ── Ejercicio 8 · UnionFind (extra C++) ─────────────────────────────────────
/**
 * Conjuntos disjuntos sobre los elementos 0..n-1 (ver 6b), con compresión de caminos Y unión por rango:
 *  - encontrar(x): el representante del grupo de x.
 *  - unir(a, b): fusiona los grupos; devuelve true si eran distintos (hubo fusión), false si ya estaban juntos.
 *  - conectados(a, b): ¿están en el mismo grupo?    componentes(): cuántos grupos hay (empieza en n).
 *  - Un elemento fuera de 0..n-1 lanza out_of_range.
 * Casi O(1) amortizado por operación. Al empezar, cada elemento es su propio representante.
 */
class UnionFind {
public:
    UnionFind(int n)
    {
        pendiente();
    }

    int encontrar(int x)
    {
        return pendiente();
    }

    bool unir(int a, int b)
    {
        return pendiente();
    }

    bool conectados(int a, int b)
    {
        return pendiente();
    }

    int componentes() const
    {
        return pendiente();
    }

private:
    // aquí tus vectores (padre, rango) y el contador
};

// ── Ejercicio 9 · Trie (extra C++) ──────────────────────────────────────────
/**
 * Un árbol de prefijos para palabras en minúsculas (a-z; ver 5b):
 *  - insertar(palabra): la añade (repetirla no hace nada).
 *  - contiene(palabra): ¿se insertó EXACTAMENTE esa palabra?   tienePrefijo(p): ¿alguna palabra empieza por p?
 *  - palabrasConPrefijo(p): todas las palabras que empiezan por p, ordenadas alfabéticamente (p = "" → todas).
 * Cada operación cuesta O(longitud de la palabra), sin importar cuántas haya guardadas. La cadena vacía como
 * palabra se ignora al insertar. Si un nodo tiene hijos en `array<unique_ptr<Nodo>, 26>` o en un `map<char, ...>`, es cosa tuya.
 */
class Trie {
public:
    void insertar(const string& palabra)
    {
        pendiente();
    }

    bool contiene(const string& palabra) const
    {
        return pendiente();
    }

    bool tienePrefijo(const string& prefijo) const
    {
        return pendiente();
    }

    VS palabrasConPrefijo(const string& prefijo) const
    {
        return pendiente();
    }

private:
    // aquí tu nodo y tu raíz
};

// ── Ayudas para medir ───────────────────────────────────────────────────────
/** Una caché con n entradas ("k0" la más antigua) para medir obtener(). */
unique_ptr<CacheLRU> cacheLlena(int n)
{
    auto cache = make_unique<CacheLRU>(n);
    for (int i = 0; i < n; i++) {
        cache->poner("k" + to_string(i), i);
    }
    return cache;
}

// ════════════════════════════════════════════════════════════════════════════
int main()
{
// ════════════════════════════════════════════════════════════════════════════
// 1. PILA (LIFO): EL ÚLTIMO EN ENTRAR ES EL PRIMERO EN SALIR
// ════════════════════════════════════════════════════════════════════════════
    titulo("1. Pila");

    stack<char> pila;
    for (char letra : string("abc")) {
        pila.push(letra);
    }
    cout << "top: " << pila.top() << " · tamaño: " << pila.size() << "\n";
    cout << "sacando: ";
    while (!pila.empty()) {
        cout << pila.top() << ' ';              // primero se MIRA...
        pila.pop();                             // ...y luego se QUITA (pop no devuelve nada)
    }
    cout << "\n";

    VI comoPila;                                // un vector también sirve de pila
    comoPila.push_back(1);
    comoPila.push_back(2);
    cout << "vector como pila: cima " << comoPila.back() << ", ";
    comoPila.pop_back();
    cout << "tras pop_back la cima es " << comoPila.back() << "\n";

    // ── 1b. Pila monótona ──
    cout << "siguiente mayor de {2,1,5,3,4,0}: " << mostrar(siguienteMayor({2, 1, 5, 3, 4, 0})) << "\n";

// ════════════════════════════════════════════════════════════════════════════
// 2. COLA (FIFO): EL PRIMERO EN ENTRAR ES EL PRIMERO EN SALIR
// ════════════════════════════════════════════════════════════════════════════
    titulo("2. Cola");

    queue<string> cola;
    for (const char* tarea : {"t1", "t2", "t3"}) {
        cola.push(tarea);
    }
    cout << "atendiendo: ";
    while (!cola.empty()) {
        cout << cola.front() << ' ';
        cola.pop();
    }
    cout << "\n";

    deque<int> doble = {2, 3};
    doble.push_front(1);                        // por los dos extremos, O(1)
    doble.push_back(4);
    cout << "deque: " << mostrar(doble) << " · doble[2] = " << doble[2] << " (acceso directo, como en un vector)\n";

    // ── 2b. list + splice ──
    {
        list<char> uso = {'a', 'b', 'c', 'd'};          // la más reciente delante
        auto it = uso.begin();
        advance(it, 2);                                 // it apunta a 'c' (avanzar por una lista es O(k))
        uso.splice(uso.begin(), uso, it);               // 'c' pasa al principio SIN copiar ni invalidar otros iteradores
        cout << "tras splice de 'c' al frente: " << mostrar(uso) << "\n";
    }

// ════════════════════════════════════════════════════════════════════════════
// 3. MONTÍCULO (HEAP) Y COLA DE PRIORIDAD
// ════════════════════════════════════════════════════════════════════════════
    titulo("3. Montículo y cola de prioridad");

    priority_queue<int, vector<int>, greater<int>> minHeap;       // greater<int> → el MENOR arriba
    for (int n : {5, 3, 8, 1, 9, 2}) {
        minHeap.push(n);
    }
    cout << "min-heap, extrayendo el menor cada vez: ";
    while (!minHeap.empty()) {
        cout << minHeap.top() << ' ';
        minHeap.pop();
    }
    cout << "\n";

    priority_queue<int> maxHeap;                                  // por defecto: el MAYOR arriba
    for (int n : {5, 3, 8, 1, 9, 2}) {
        maxHeap.push(n);
    }
    cout << "max-heap (el de por defecto), extrayendo: ";
    while (!maxHeap.empty()) {
        cout << maxHeap.top() << ' ';
        maxHeap.pop();
    }
    cout << "\n";

    // Con pares, se compara por el primer elemento y, si empatan, por el segundo: {prioridad, tarea}
    priority_queue<pair<int, string>> tareas;
    tareas.push({2, "escribir informe"});
    tareas.push({10, "apagar incendio"});
    tareas.push({1, "tomar café"});
    cout << "por prioridad: ";
    while (!tareas.empty()) {
        cout << tareas.top().second << " | ";
        tareas.pop();
    }
    cout << "\n";

    // Cómo es un heap "por dentro": un vector con la regla padre ≤ hijos (ni siquiera está ordenado)
    {
        VI v = {5, 3, 8, 1, 9, 2};
        make_heap(v.begin(), v.end(), greater<int>());          // convierte el vector en min-heap en O(n)
        cout << "vector como min-heap: " << mostrar(v) << " (la raíz v[0] = " << v[0] << " es el menor; hijos de v[0]: v[1] y v[2])\n";
        // Comparador propio: la lambda dice "a va DESPUÉS que b" (¡al revés de lo intuitivo!). Aquí, cadenas más cortas primero.
        auto mascorta = [](const string& a, const string& b) { return a.size() > b.size(); };
        priority_queue<string, VS, decltype(mascorta)> porLongitud(mascorta);
        for (const char* palabra : {"elefante", "ya", "casa"}) {
            porLongitud.push(palabra);
        }
        cout << "la más corta sale primero: " << porLongitud.top() << "\n";
    }

// ════════════════════════════════════════════════════════════════════════════
// 4. LISTA ENLAZADA: LO QUE PASA "POR DENTRO" EN list / LinkedList
// ════════════════════════════════════════════════════════════════════════════
    titulo("4. Nodos enlazados");

    {
        Nodo* lista = listaDesde({1, 2, 3});
        cout << "lista: ";
        for (const Nodo* n = lista; n != nullptr; n = n->siguiente) {
            cout << n->valor << (n->siguiente ? " → " : "\n");
        }
        // Un puntero crudo es una DIRECCIÓN: copiarlo (Nodo* otra = lista) NO copia la lista; ambos apuntan a la misma.
        // Si ahora hicieras `delete lista;` y siguieras usando `otra`, sería un use-after-free (comportamiento indefinido).
        liberarLista(lista);                            // sin esta línea, la memoria se perdería: una FUGA (leak)
    }

    // ── 4b. unique_ptr ──
    {
        ListaUnica unica;
        for (int v : {3, 2, 1}) {
            unica.agregarAlPrincipio(v);
        }
        cout << "con unique_ptr: " << mostrar(unica.aVector());
        unica.invertir();
        cout << " → invertida " << mostrar(unica.aVector()) << "\n";
        ListaUnica enorme;
        for (int i = 0; i < 200000; i++) {
            enorme.agregarAlPrincipio(i);
        }
        cout << "200 000 nodos creados y liberados sin recursión: el destructor desmonta la lista de uno en uno\n";
    }

// ════════════════════════════════════════════════════════════════════════════
// 5. ÁRBOL BINARIO DE BÚSQUEDA (ABB)
// ════════════════════════════════════════════════════════════════════════════
    titulo("5. Árbol binario de búsqueda");

    {
        unique_ptr<NodoArbol> raiz;
        for (int v : {50, 30, 70, 20, 40, 60, 80}) {
            insertarEn(raiz, v);
        }
        VI orden;
        enOrdenDe(raiz, orden);
        cout << "en orden: " << mostrar(orden) << "\n";
    }

    // ── 5b. Trie ──  (el esquema está arriba; lo implementas en el ejercicio 9)

// ════════════════════════════════════════════════════════════════════════════
// 6. CLAVES PROPIAS: struct EN set / map / unordered_map
// ════════════════════════════════════════════════════════════════════════════
    titulo("6. Claves propias");

    {
        set<Punto> ordenados = {{3, 1}, {1, 2}, {1, 1}};       // usa el operator<=> generado: ordena por x y luego por y
        cout << "set<Punto> ordenado: " << mostrar(ordenados) << "\n";

        unordered_set<Punto> vistos;                            // usa std::hash<Punto> y operator==
        vistos.insert({1, 2});
        vistos.insert({1, 2});
        cout << "unordered_set<Punto> con (1,2) dos veces: " << vistos.size() << " elemento\n";

        // Identidad: dos nodos con el MISMO valor son claves distintas (están en direcciones distintas)
        Lista dos({7, 7});
        unordered_set<const Nodo*> porDireccion = {&dos.nodo(0), &dos.nodo(1)};
        cout << "dos nodos con valor 7 por dirección: " << porDireccion.size() << " claves\n";

        Lista conCiclo({1, 2, 3});
        conCiclo.nodo(2).siguiente = &conCiclo.nodo(0);
        cout << "¿ciclo en 1→2→3→1? " << boolalpha << tieneCicloConConjunto(conCiclo.cabeza()) << "\n";
    }

    // ── 6b. Union-Find ──  (la teoría está arriba; lo implementas en el ejercicio 8)

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

    prueba(parentesisBalanceados,
        caso("vacío", true, string("")),
        caso("simple", true, string("()")),
        caso("mezclados", true, string("([]{})")),
        caso("con texto", true, string("a(b[c]{d})e")),
        caso("cierre incorrecto", false, string("(]")),
        caso("cruzados", false, string("([)]")),
        caso("sin cerrar", false, string("((")),
        caso("cierre de más", false, string("())")),
        caso("empieza cerrando", false, string(")(")),
        caso("solo texto", true, string("hola")),
        caso("profundo", true, string(500, '(') + string(500, ')')));

    grupo("ColaConDosPilas");
    comprueba("sale en el orden en que entra", [&] {
        ColaConDosPilas<int> c;
        for (int x : {1, 2, 3}) {
            c.encolar(x);
        }
        return VI{c.desencolar(), c.desencolar(), c.desencolar()};
    }, VI{1, 2, 3});
    comprueba("entradas y salidas intercaladas", [&] {
        ColaConDosPilas<string> c;
        c.encolar("a");
        c.encolar("b");
        VS salida = {c.desencolar()};
        c.encolar("c");
        salida.push_back(c.desencolar());
        salida.push_back(c.desencolar());
        return salida;
    }, VS{"a", "b", "c"});
    comprueba("frente no la quita", [&] {
        ColaConDosPilas<int> c;
        c.encolar(5);
        c.encolar(6);
        return VI{c.frente(), c.frente(), static_cast<int>(c.tamano())};
    }, VI{5, 5, 2});
    comprueba("vacia y tamano", [&] {
        ColaConDosPilas<int> c;
        VI r = {c.vacia(), static_cast<int>(c.tamano())};
        c.encolar(1);
        c.desencolar();
        r.push_back(c.vacia());
        r.push_back(static_cast<int>(c.tamano()));
        return r;
    }, VI{1, 0, 1, 0});
    comprueba("admite cualquier tipo de valor", [&] {
        ColaConDosPilas<VI> c;
        c.encolar(VI{});
        c.encolar(VI{1});
        VI primero = c.desencolar();
        VI segundo = c.desencolar();
        return VI{static_cast<int>(primero.size()), static_cast<int>(segundo.size())};
    }, VI{0, 1});
    comprueba("mismo resultado que una cola de verdad (2000 operaciones)", [&] {
        ColaConDosPilas<int> c;
        queue<int> real;
        unsigned x = 7;
        for (int i = 0; i < 2000; i++) {
            x = (x * 1103515245u + 12345u) & 0x7fffffffu;
            if (x % 3 != 0 || real.empty()) {
                c.encolar(i);
                real.push(i);
            } else {
                int esperado = real.front();
                real.pop();
                if (c.desencolar() != esperado) {
                    return false;
                }
            }
        }
        return c.tamano() == real.size();
    }, true);
    lanza("desencolar en vacía", [&] { ColaConDosPilas<int> c; c.desencolar(); }, underflow_error);
    lanza("frente en vacía", [&] { ColaConDosPilas<int> c; c.frente(); }, underflow_error);

    grupo("invertirLista");
    comprueba("invierte", [&] {
        Lista l({1, 2, 3, 4});
        return listaAVector(invertirLista(l.cabeza()));
    }, VI{4, 3, 2, 1});
    comprueba("un nodo", [&] {
        Lista l({9});
        return listaAVector(invertirLista(l.cabeza()));
    }, VI{9});
    comprueba("lista vacía", [&] { return invertirLista(nullptr) == nullptr; });
    comprueba("no crea nodos nuevos", [&] {
        Lista l({1, 2, 3});
        Nodo* ultimo = &l.nodo(2);
        return invertirLista(l.cabeza()) == ultimo;
    });
    comprueba("invertir dos veces devuelve la original", [&] {
        Lista l(numeros(50));
        return listaAVector(invertirLista(invertirLista(l.cabeza())));
    }, numeros(50));

    grupo("tieneCiclo");
    comprueba("lista normal", [&] {
        Lista l({1, 2, 3, 4, 5});
        return tieneCiclo(l.cabeza());
    }, false);
    comprueba("lista vacía", [&] { return tieneCiclo(nullptr); }, false);
    comprueba("un nodo", [&] {
        Lista l({1});
        return tieneCiclo(l.cabeza());
    }, false);
    comprueba("el último apunta al segundo", [&] {
        Lista l({1, 2, 3, 4});
        l.nodo(3).siguiente = &l.nodo(1);
        return tieneCiclo(l.cabeza());
    }, true);
    comprueba("un nodo que se apunta a sí mismo", [&] {
        Lista l({1});
        l.nodo(0).siguiente = &l.nodo(0);
        return tieneCiclo(l.cabeza());
    }, true);
    comprueba("lista larga sin ciclo", [&] {
        Lista l(numeros(5000));
        return tieneCiclo(l.cabeza());
    }, false);

    grupo("ArbolBinarioBusqueda");
    comprueba("enOrden devuelve los valores ordenados", [&] {
        ArbolBinarioBusqueda a;
        for (int v : {50, 30, 70, 20, 40, 60, 80}) {
            a.insertar(v);
        }
        return a.enOrden();
    }, VI{20, 30, 40, 50, 60, 70, 80});
    comprueba("contiene", [&] {
        ArbolBinarioBusqueda a;
        for (int v : {5, 3, 8}) {
            a.insertar(v);
        }
        return vector<bool>{a.contiene(3), a.contiene(8), a.contiene(4)};
    }, vector<bool>{true, true, false});
    comprueba("no admite duplicados", [&] {
        ArbolBinarioBusqueda a;
        for (int v : {5, 5, 5, 3, 3}) {
            a.insertar(v);
        }
        return make_pair(a.tamano(), a.enOrden());
    }, make_pair(size_t{2}, VI{3, 5}));
    comprueba("altura de un árbol equilibrado", [&] {
        ArbolBinarioBusqueda a;
        for (int v : {4, 2, 6, 1, 3, 5, 7}) {
            a.insertar(v);
        }
        return a.altura();
    }, 3);
    comprueba("altura si se insertan ordenados (degenera en lista)", [&] {
        ArbolBinarioBusqueda a;
        for (int v : numeros(10)) {
            a.insertar(v);
        }
        return a.altura();
    }, 10);
    comprueba("árbol vacío", [&] {
        ArbolBinarioBusqueda a;
        return a.altura() == 0 && !a.minimo().has_value() && a.enOrden().empty() && a.tamano() == 0 && !a.contiene(1);
    });
    comprueba("mínimo", [&] {
        ArbolBinarioBusqueda a;
        for (int v : {8, 3, 10, 1, 6}) {
            a.insertar(v);
        }
        return a.minimo();
    }, optional<int>(1));
    comprueba("un nodo tiene altura 1", [&] {
        ArbolBinarioBusqueda a;
        a.insertar(1);
        return a.altura();
    }, 1);

    grupo("MinHeap");
    comprueba("extrae en orden ascendente", [&] {
        MinHeap h;
        for (int v : {5, 3, 8, 1, 9, 2}) {
            h.insertar(v);
        }
        VI salida;
        while (!h.vacio()) {
            salida.push_back(h.extraerMinimo());
        }
        return salida;
    }, VI{1, 2, 3, 5, 8, 9});
    comprueba("minimo no extrae", [&] {
        MinHeap h;
        h.insertar(4);
        h.insertar(2);
        return VI{h.minimo(), h.minimo(), static_cast<int>(h.tamano())};
    }, VI{2, 2, 2});
    comprueba("con repetidos", [&] {
        MinHeap h;
        for (int v : {2, 2, 1, 1}) {
            h.insertar(v);
        }
        return VI{h.extraerMinimo(), h.extraerMinimo(), h.extraerMinimo(), h.extraerMinimo()};
    }, VI{1, 1, 2, 2});
    comprueba("operaciones mezcladas igual que priority_queue (1500 ops)", [&] {
        MinHeap h;
        priority_queue<int, VI, greater<int>> real;
        unsigned x = 99;
        for (int i = 0; i < 1500; i++) {
            x = (x * 1103515245u + 12345u) & 0x7fffffffu;
            if (x % 4 != 0 || real.empty()) {
                int v = static_cast<int>(x % 1000);
                h.insertar(v);
                real.push(v);
            } else {
                int esperado = real.top();
                real.pop();
                if (h.extraerMinimo() != esperado) {
                    return false;
                }
            }
        }
        return h.tamano() == real.size() && (real.empty() || h.minimo() == real.top());
    }, true);
    lanza("extraer de uno vacío", [&] { MinHeap h; h.extraerMinimo(); }, underflow_error);
    lanza("minimo de uno vacío", [&] { MinHeap h; h.minimo(); }, underflow_error);

    prueba(ordenarConMonticulo,
        caso("desordenada", VI{1, 2, 5, 5, 6, 9}, VI{5, 2, 9, 1, 5, 6}),
        caso("vacía", VI{}, VI{}),
        caso("un elemento", VI{3}, VI{3}),
        caso("negativos", VI{-3, -1, 0, 2}, VI{0, -3, 2, -1}),
        caso("inversa", numeros(10), rango(10, 1)),
        caso("extremos del int", VI{INT_MIN, 0, INT_MAX}, VI{INT_MAX, INT_MIN, 0}));

    grupo("CacheLRU");
    comprueba("guarda y devuelve", [&] {
        CacheLRU c(2);
        c.poner("a", 1);
        return make_pair(c.obtener("a"), c.obtener("zzz"));
    }, make_pair(optional<int>(1), optional<int>()));
    comprueba("expulsa la menos reciente", [&] {
        CacheLRU c(2);
        c.poner("a", 1);
        c.poner("b", 2);
        c.poner("c", 3);                 // expulsa a
        return VI{c.obtener("a").value_or(-1), c.obtener("b").value_or(-1), c.obtener("c").value_or(-1)};
    }, VI{-1, 2, 3});
    comprueba("obtener cuenta como uso", [&] {
        CacheLRU c(2);
        c.poner("a", 1);
        c.poner("b", 2);
        c.obtener("a");                  // ahora la más antigua es b
        c.poner("c", 3);                 // expulsa b
        return VI{c.obtener("a").value_or(-1), c.obtener("b").value_or(-1)};
    }, VI{1, -1});
    comprueba("actualizar también cuenta como uso", [&] {
        CacheLRU c(2);
        c.poner("a", 1);
        c.poner("b", 2);
        c.poner("a", 10);                // actualiza y refresca a
        c.poner("c", 3);                 // expulsa b
        int a = c.obtener("a").value_or(-1);    // (en varias líneas: el orden de evaluación de los argumentos de make_tuple no está definido)
        int b = c.obtener("b").value_or(-1);
        return make_tuple(a, b, c.claves());
    }, make_tuple(10, -1, VS{"a", "c"}));
    comprueba("claves de la más reciente a la más antigua", [&] {
        CacheLRU c(3);
        c.poner("a", 1);
        c.poner("b", 2);
        c.poner("c", 3);
        c.obtener("a");
        return c.claves();
    }, VS{"a", "c", "b"});
    comprueba("capacidad 1", [&] {
        CacheLRU c(1);
        c.poner("a", 1);
        c.poner("b", 2);
        return VI{c.obtener("a").value_or(-1), c.obtener("b").value_or(-1), static_cast<int>(c.tamano())};
    }, VI{-1, 2, 1});
    comprueba("tamano nunca supera la capacidad", [&] {
        CacheLRU c(3);
        for (int i = 0; i < 10; i++) {
            c.poner("k" + to_string(i), i);
        }
        return make_pair(c.tamano(), c.claves());
    }, make_pair(size_t{3}, VS{"k9", "k8", "k7"}));
    comprueba("igual que una versión lenta de referencia (3000 operaciones)", [&] {
        CacheLRU lru(5);
        VS orden;                        // claves de menos a más reciente
        map<string, int> datos;
        auto refrescar = [&](const string& clave) {
            orden.erase(remove(orden.begin(), orden.end(), clave), orden.end());
            orden.push_back(clave);
        };
        unsigned x = 5;
        for (int i = 0; i < 3000; i++) {
            x = (x * 1103515245u + 12345u) & 0x7fffffffu;
            string clave = "k" + to_string(x % 9);
            if (x % 2 == 0) {
                optional<int> esperado;
                if (datos.count(clave)) {
                    esperado = datos[clave];
                    refrescar(clave);
                }
                if (lru.obtener(clave) != esperado) {
                    return "obtener(" + clave + ") falló en la operación " + to_string(i);
                }
            } else {
                lru.poner(clave, i);
                datos[clave] = i;
                refrescar(clave);
                if (orden.size() > 5) {
                    datos.erase(orden.front());
                    orden.erase(orden.begin());
                }
            }
        }
        return lru.claves() == VS(orden.rbegin(), orden.rend()) ? string("ok") : string("claves distintas");
    }, string("ok"));
    lanza("capacidad cero", [&] { CacheLRU c(0); }, invalid_argument);

    prueba(topK,
        caso("básico", VI{9, 7}, VI{5, 1, 9, 3, 7}, 2),
        caso("k = 0", VI{}, VI{1, 2, 3}, 0),
        caso("k mayor que el vector", VI{9, 4, 2}, VI{2, 9, 4}, 10),
        caso("con repetidos", VI{4, 4}, VI{4, 4, 4, 1}, 2),
        caso("negativos", VI{-1, -3}, VI{-5, -1, -3}, 2),
        caso("vacía", VI{}, VI{}, 3),
        caso("k = 1", VI{8}, VI{3, 8, 1}, 1));

    grupo("UnionFind");
    comprueba("al empezar cada uno va solo", [&] {
        UnionFind uf(5);
        return make_pair(uf.componentes(), uf.conectados(0, 1));
    }, make_pair(5, false));
    comprueba("unir conecta y reduce los grupos", [&] {
        UnionFind uf(6);
        uf.unir(0, 1);
        uf.unir(2, 3);
        return make_tuple(uf.componentes(), uf.conectados(0, 1), uf.conectados(1, 2));
    }, make_tuple(4, true, false));
    comprueba("es transitivo", [&] {
        UnionFind uf(5);
        uf.unir(0, 1);
        uf.unir(1, 2);
        uf.unir(3, 2);
        return make_pair(uf.conectados(0, 3), uf.conectados(4, 0));
    }, make_pair(true, false));
    comprueba("unir dos ya unidos devuelve false", [&] {
        UnionFind uf(4);
        bool primera = uf.unir(0, 1);
        bool repetida = uf.unir(1, 0);
        return make_pair(primera, repetida);
    }, make_pair(true, false));
    comprueba("todos acaban en un grupo", [&] {
        UnionFind uf(100);
        for (int i = 1; i < 100; i++) {
            uf.unir(i - 1, i);
        }
        return make_pair(uf.componentes(), uf.encontrar(0) == uf.encontrar(99));
    }, make_pair(1, true));
    comprueba("cadena muy larga no desborda la pila", [&] {
        UnionFind uf(200000);
        for (int i = 1; i < 200000; i++) {
            uf.unir(i, i - 1);
        }
        return uf.conectados(0, 199999) && uf.componentes() == 1;
    });
    lanza("elemento fuera de rango", [&] { UnionFind uf(3); uf.encontrar(3); }, out_of_range);

    grupo("Trie");
    comprueba("contiene solo palabras completas", [&] {
        Trie t;
        t.insertar("casa");
        return vector<bool>{t.contiene("casa"), t.contiene("cas"), t.contiene("casas"), t.contiene("")};
    }, vector<bool>{true, false, false, false});
    comprueba("tienePrefijo", [&] {
        Trie t;
        t.insertar("casa");
        t.insertar("cosa");
        return vector<bool>{t.tienePrefijo("ca"), t.tienePrefijo("c"), t.tienePrefijo("casa"), t.tienePrefijo("d"), t.tienePrefijo("casas")};
    }, vector<bool>{true, true, true, false, false});
    comprueba("una palabra puede ser prefijo de otra", [&] {
        Trie t;
        t.insertar("cara");
        t.insertar("caramelo");
        return vector<bool>{t.contiene("cara"), t.contiene("caramelo"), t.contiene("caram")};
    }, vector<bool>{true, true, false});
    comprueba("palabrasConPrefijo ordenadas", [&] {
        Trie t;
        for (const char* p : {"casa", "cosa", "cara", "caro", "dado", "ca"}) {
            t.insertar(p);
        }
        return t.palabrasConPrefijo("ca");
    }, VS{"ca", "cara", "caro", "casa"});
    comprueba("prefijo vacío devuelve todas", [&] {
        Trie t;
        for (const char* p : {"b", "a", "ab"}) {
            t.insertar(p);
        }
        return t.palabrasConPrefijo("");
    }, VS{"a", "ab", "b"});
    comprueba("prefijo que no existe", [&] {
        Trie t;
        t.insertar("hola");
        return t.palabrasConPrefijo("x");
    }, VS{});
    comprueba("repetir una palabra no la duplica", [&] {
        Trie t;
        t.insertar("sol");
        t.insertar("sol");
        return t.palabrasConPrefijo("s");
    }, VS{"sol"});

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    medir(parentesisBalanceados, string(n / 3, '(') + string(n / 3, ')'));      // O(n)
    medir(ordenarConMonticulo, aleatorios(n, 1000000, 12345));                   // O(n log n)
    medir(topK, aleatorios(n, 1000000, 12345), 10);                               // O(n log k) con k = 10: ~O(n)
    // obtener() en una caché con n entradas: O(1) si no recorres nada; O(n) si buscas la clave a mano.
    // (Una sola llamada dura nanosegundos: cada repetición hace 1000 seguidas.)
    medirCon("CacheLRU",
             [](int n) { return cacheLlena(max(n, 2)); },
             [](auto& cache) {
                 const string a = "k0";
                 const string b = "k1";
                 int suma = 0;
                 for (int i = 0; i < 1000; i++) {
                     suma += cache->obtener(i % 2 == 0 ? a : b).value_or(0);
                 }
                 return suma;
             });
}
