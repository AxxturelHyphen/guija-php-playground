#include <algorithm>
#include <array>
#include <deque>
#include <functional>
#include <iostream>
#include <list>
#include <map>
#include <numeric>
#include <optional>
#include <queue>
#include <ranges>
#include <set>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

/*
 * TEMA 3 · STL: CONTENEDORES, ITERADORES Y ALGORITMOS
 * ────────────────────────────────────────────────────────────────────────────
 * La STL (Standard Template Library) es la biblioteca estándar de C++ y, para algoritmia, la herramienta
 * número uno: te da listas, mapas, conjuntos, colas con prioridad y ~100 algoritmos ya escritos, probados y
 * optimizados. Se organiza en tres piezas que encajan entre sí:
 *
 *   CONTENEDORES   guardan datos                    vector, array, deque, list, map, set, unordered_map...
 *   ITERADORES     "punteros" que recorren          begin(), end(), it++, *it   (el pegamento de la STL)
 *   ALGORITMOS     operan sobre rangos de iteradores sort, find, accumulate, transform, lower_bound...
 *
 * Un algoritmo NO sabe qué contenedor tiene debajo: solo recibe dos iteradores [inicio, fin) y trabaja entre ellos.
 * Por eso el mismo sort() ordena un vector, un array de C o un deque.
 *
 *   Contenedor              v[i]       Buscar valor   Añadir al final    Insertar al principio   Orden
 *   vector                  O(1)       O(n)           O(1) amortizado    O(n)                    el de inserción
 *   array<T, N>             O(1)       O(n)           — (tamaño fijo)    —                       el de inserción
 *   deque                   O(1)       O(n)           O(1)               O(1)                    el de inserción
 *   list (doble enlazada)   —          O(n)           O(1)               O(1)                    el de inserción
 *   map / set               —          O(log n)       O(log n)           —                       ORDENADO por clave
 *   unordered_map / _set    —          O(1) medio     O(1) medio         —                       ninguno (tabla hash)
 *   priority_queue          top O(1)   —              push O(log n)      —                       el mayor primero
 *
 * Regla de oro: usa vector salvo que tengas un motivo medido para otra cosa. Es contiguo en memoria (la caché de
 * la CPU lo adora) y gana casi siempre, incluso a list para insertar en medio con n pequeño o mediano.
 *
 * Desde Java:   ArrayList → vector · LinkedList → list · ArrayDeque → deque · TreeMap/TreeSet → map/set ·
 *               HashMap/HashSet → unordered_map/unordered_set · PriorityQueue → priority_queue (¡es de MÁXIMOS!).
 *               Los contenedores guardan VALORES, no referencias: vector<Persona> contiene las personas dentro,
 *               y asignar o pasar uno COPIA todos sus elementos (usa const& para no copiar).
 * Desde PHP:    el array de PHP es a la vez lista, mapa y conjunto. En C++ eliges una estructura distinta para cada
 *               uso, y cada una tiene sus costes.
 * Desde Python: list → vector · dict → unordered_map (o map, que va ordenado) · set → unordered_set · tuple →
 *               tuple · collections.deque → deque. Aquí no hay slicing ni comprensiones: hay algoritmos.
 * Desde C:      vector reemplaza a «malloc + realloc + longitud» a mano y se libera solo (RAII). Los arrays de C
 *               (int a[5]) siguen existiendo, pero decaen a puntero y pierden su tamaño: mejor array<int, 5>.
 *
 * Cómo se trabaja aquí
 *  - Pulsa Ctrl+Enter para ejecutar: verás las secciones de teoría y las pruebas de los ejercicios.
 *  - Cada ejercicio tiene un cuerpo «return pendiente();»: sustitúyelo por tu código y vuelve a ejecutar.
 *  - Ctrl+S guarda tu progreso. El botón «Solución» compara tu versión con la de referencia.
 *  - «Medir» (Ctrl+Alt+Enter) calcula experimentalmente el coste O() de los ejercicios marcados.
 */

using V = vector<int>;
using VV = vector<vector<int>>;
using VS = vector<string>;

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

/** Imprime «etiqueta: valor» con cualquier contenedor (mostrar viene del playground). */
template <class T>
void ver(const string& etiqueta, const T& valor)
{
    cout << etiqueta << ": " << mostrar(valor) << "\n";
}

/** Los enteros de desde a hasta, ambos incluidos. */
V desde(int desde, int hasta)
{
    V r;
    for (int i = desde; i <= hasta; i++) {
        r.push_back(i);
    }
    return r;
}

/** n números con muchos repetidos (para medir unicos). */
V conRepetidos(int n)
{
    V r;
    r.reserve(static_cast<size_t>(n));
    for (int i = 0; i < n; i++) {
        r.push_back(static_cast<int>((i * 7919LL) % max(1, n / 2)));
    }
    return r;
}

/** Una fila de datos para los ejemplos y las pruebas. Un struct agrupa campos; sus valores se copian enteros. */
struct Persona {
    string nombre;
    int edad;
    string ciudad;
    bool operator==(const Persona&) const = default;   // == campo a campo (lo piden las pruebas)
};

ostream& operator<<(ostream& os, const Persona& p)   // para que mostrar() y cout lo pinten bonito
{
    return os << p.nombre << "(" << p.edad << "," << p.ciudad << ")";
}

/** Una versión «major.minor»: con <=> el compilador genera <, >, <=, >=, == y != comparando campo a campo, en orden. */
struct Version {
    int major;
    int minor;
    auto operator<=>(const Version&) const = default;
};

/** Para el ejemplo de vector: copia cada vez que se pasa por valor; por const& no copia. */
int sumaPorReferencia(const V& xs)
{
    return accumulate(xs.begin(), xs.end(), 0);
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · agruparPor ────────────────────────────────────────────────
/**
 * Agrupa los elementos según lo que devuelva `clave(elemento)`. El resultado es un map clave → vector de
 * elementos: las claves salen ORDENADAS (un map es un árbol ordenado) y los elementos de cada grupo, en su orden
 * original.
 *
 *   agruparPor(VS{"ana", "luis", "amy"}, [](const string& s) { return s.substr(0, 1); })   // {a: [ana, amy], l: [luis]}
 *
 * El tipo de la clave K se deduce de lo que devuelve la función (invoke_result_t) y se le quitan const y &
 * (decay_t): así `clave` puede devolver un string temporal o una referencia sin problema.
 *
 * Alternativa ingenua: para cada clave distinta, recorrer toda la lista otra vez: O(n·g). Se puede en una
 * pasada, O(n log g) con map (y O(n) con unordered_map si no te importa el orden).
 */
template <class T, class F, class K = decay_t<invoke_result_t<F&, const T&>>>
map<K, vector<T>> agruparPor(const vector<T>& xs, F clave)
{
    return pendiente();
}

// ── Ejercicio 2 · topPalabras ───────────────────────────────────────────────
/**
 * Las k palabras más frecuentes de un texto, como vector de pares (palabra, veces) ya ordenado.
 *  - Palabra = secuencia de letras ASCII (a-z); lo demás (espacios, signos, dígitos) separa. No distingue
 *    mayúsculas: "Hola" y "hola" son la misma palabra, en minúsculas.
 *  - Orden: más veces primero; a igualdad, alfabético.
 *  - Si hay menos de k palabras distintas, devuelve las que haya; con k = 0, vacío.
 *
 * Trampas de C++: `tolower` y `isalpha` esperan un valor de unsigned char (o EOF): con un char negativo
 * (los bytes de acentos o ñ en UTF-8 lo son) el comportamiento es indefinido. Convierte con
 * `static_cast<unsigned char>(c)` antes. (En este ejercicio el texto es ASCII, pero acostúmbrate.)
 * Alternativa ingenua: contar cada palabra recorriendo la lista otra vez, O(n²).
 */
vector<pair<string, int>> topPalabras(const string& texto, int k)
{
    return pendiente();
}

// ── Ejercicio 3 · aplanar ───────────────────────────────────────────────────
/**
 * Aplana un valor anidado a cualquier profundidad, en orden, como vector<int>. En C++ la profundidad la fija el
 * TIPO, y la recursión ocurre en tiempo de compilación: aplanar(5) → [5]; aplanar(V{1, 2}) → [1, 2];
 * aplanar(VV{{1, 2}, {3}}) → [1, 2, 3]; con vector<VV> igual, etc.
 *
 * Pista: `if constexpr (is_integral_v<T>)` decide en compilación qué rama se compila. Si T es un contenedor,
 * recorre sus elementos, aplana cada uno (llamada recursiva con OTRO tipo) y concatena con insert.
 * Los contenedores vacíos desaparecen.
 */
template <class T>
vector<int> aplanar(const T& x)
{
    return pendiente();
}

// El ejercicio 4 (Coleccion) es un tipo: está más abajo, justo antes de main.

// ── Ejercicio 5 · unicos ────────────────────────────────────────────────────
/**
 * Quita los repetidos de un vector conservando el orden de la primera aparición. Tiene que ser O(n): buscar con
 * `find` (lineal) dentro de un bucle sería O(n²). Usa un unordered_set de lo ya visto (insert devuelve
 * pair<iterador, bool>: el bool dice si era nuevo). Pulsa «Medir» y compruébalo.
 */
template <class T>
vector<T> unicos(const vector<T>& xs)
{
    return pendiente();
}

// ── Ejercicio 6 · interseccion ──────────────────────────────────────────────
/**
 * Los valores de a que también están en b, sin repetidos y en el orden de a. Debe ser O(n + m).
 *
 *   interseccion(V{3, 1, 3, 2}, V{2, 3, 9})  →  [3, 2]
 */
V interseccion(const V& a, const V& b)
{
    return pendiente();
}

// ── Ejercicio 7 · transponer ────────────────────────────────────────────────
/**
 * Transpone una matriz rectangular (vector de filas): las filas pasan a ser columnas.
 *   [[1, 2, 3], [4, 5, 6]]  →  [[1, 4], [2, 5], [3, 6]]
 * Ojo con los casos límite: una sola fila, una sola columna y la matriz vacía (da vacío). Con m[0] vacío
 * (m.empty()) accederías fuera de rango: UB.
 */
VV transponer(const VV& m)
{
    return pendiente();
}

// ── Ejercicio 8 · quitarPares (extra de C++) ────────────────────────────────
/**
 * Elimina de `xs` (EN EL SITIO, void) todos los números pares conservando el orden de los demás. Debe ser O(n).
 *
 * Trampa clásica: llamar a `erase` dentro de un bucle desplaza todo lo que queda a la izquierda en cada
 * borrado (O(n²)) y, si sigues usando el iterador viejo, es un comportamiento indefinido. Usa el idioma
 * «erase-remove»: `xs.erase(remove_if(xs.begin(), xs.end(), pred), xs.end())` (remove_if no borra: mueve
 * los que se quedan al principio y devuelve dónde empieza la basura). C++20 trae `erase_if(xs, pred)`.
 * Cuidado con los negativos: -3 % 2 vale -1, no 1, así que compara con 0 (x % 2 == 0), no con 1.
 */
void quitarPares(V& xs)
{
    pendiente();
}

// ── Ejercicio 9 · rotarIzquierda (extra de C++) ─────────────────────────────
/**
 * Rota `xs` EN EL SITIO k posiciones a la izquierda: [1,2,3,4,5] con k = 2 → [3,4,5,1,2].
 *  - k puede ser mayor que el tamaño (se da la vuelta) y negativo (rota a la derecha).
 *  - Con un vector vacío no hay nada que hacer: ojo con el módulo por cero.
 *  - `%` con negativos devuelve resto negativo: normaliza k a 0..n-1.
 * Pista: std::rotate(inicio, medio, fin) deja `medio` como nuevo primer elemento. O(n).
 */
void rotarIzquierda(V& xs, int k)
{
    pendiente();
}

// ── Ejercicio 4 · Coleccion (al estilo collect() de Laravel / Stream de Java) ──
/**
 * Una envoltura fluida sobre un vector, con plantillas. Es INMUTABLE: cada operación devuelve una Coleccion nueva.
 *  - Coleccion<T>::hacer(items): constructor estático. all(): el vector interno. count() y el for-each funcionan
 *    (hay que ofrecer begin() y end()).
 *  - map(f): aplica f a cada elemento. Usa std::invoke, así f puede ser una lambda o un puntero a miembro
 *    (map(&Persona::nombre) saca la columna «nombre», como pluck).
 *  - filter(f): se queda con los elementos para los que f da true; filter() sin función se queda con los
 *    «verdaderos» (los que valen true al convertirlos a bool: no 0, no "").
 *  - reduce(inicial, f): f(acumulado, elemento). sum() (como double), avg() (0.0 si está vacía).
 *  - first(): primero o nullopt; first(f): primero que cumpla f o nullopt; first(f, defecto): o el defecto.
 *  - sortBy(clave, desc): ordena por lo que devuelva clave(elemento); ESTABLE (stable_sort). Ascendente por defecto.
 *  - groupBy(f): map clave → vector de elementos (como agruparPor).
 *  - unique(): sin repetidos, conservando la primera aparición (T debe poder compararse con <).
 *  - take(n): los n primeros (o todos si hay menos).
 */
template <class T>
class Coleccion {
    vector<T> items_;

public:
    Coleccion() = default;

    static Coleccion hacer(vector<T> items)
    {
        return pendiente();
    }

    const vector<T>& all() const
    {
        return pendiente();
    }

    size_t count() const
    {
        return pendiente();
    }

    typename vector<T>::const_iterator begin() const
    {
        return pendiente();
    }

    typename vector<T>::const_iterator end() const
    {
        return pendiente();
    }

    template <class F>
    auto map(F f) const -> Coleccion<decay_t<invoke_result_t<F&, const T&>>>
    {
        return pendiente();
    }

    template <class F>
    Coleccion filter(F f) const
    {
        return pendiente();
    }

    Coleccion filter() const
    {
        return pendiente();
    }

    template <class R, class F>
    R reduce(R inicial, F f) const
    {
        return pendiente();
    }

    double sum() const
    {
        return pendiente();
    }

    double avg() const
    {
        return pendiente();
    }

    optional<T> first() const
    {
        pendiente();                                   // (con optional, «return pendiente();» sería ambiguo)
        return nullopt;
    }

    template <class F>
    optional<T> first(F f) const
    {
        pendiente();
        return nullopt;
    }

    template <class F>
    T first(F f, T defecto) const
    {
        return pendiente();
    }

    template <class F>
    Coleccion sortBy(F clave, bool desc = false) const
    {
        return pendiente();
    }

    template <class F>
    auto groupBy(F f) const -> std::map<decay_t<invoke_result_t<F&, const T&>>, vector<T>>
    {
        return pendiente();
    }

    Coleccion unique() const
    {
        return pendiente();
    }

    Coleccion take(size_t n) const
    {
        return pendiente();
    }
};

int main()
{

// ════════════════════════════════════════════════════════════════════════════
// 1. vector, MAPA Y CONJUNTO: LOS CONTENEDORES
// ════════════════════════════════════════════════════════════════════════════
    titulo("1. Los contenedores");

    // ── vector: el array dinámico (tu ArrayList, tu list de Python)
    // Guarda los elementos contiguos en memoria. size() es cuántos hay; capacity() cuántos caben sin pedir memoria
    // nueva. Al llenarse, pide un bloque mayor (g++ lo dobla), COPIA/MUEVE todo y libera el viejo: por eso
    // push_back es O(1) AMORTIZADO (casi siempre barato, de vez en cuando O(n)).
    vector<int> v = {10, 20, 30};
    v.push_back(40);                                  // añadir al final: O(1) amortizado
    v.insert(v.begin(), 5);                           // al principio: O(n) (desplaza todo)
    ver("v", v);
    cout << "primero " << v.front() << ", último " << v.back() << ", v[2] = " << v[2] << ", tamaño " << v.size() << "\n";

    vector<int> crece;
    size_t capacidadAnterior = crece.capacity();
    cout << "capacidades al hacer push_back 1000 veces:";
    for (int i = 0; i < 1000; i++) {
        crece.push_back(i);
        if (crece.capacity() != capacidadAnterior) {
            cout << " " << crece.capacity();
            capacidadAnterior = crece.capacity();
        }
    }
    cout << "\n(cada cambio = una reasignación y copia de todo; con reserve(n) lo evitas si sabes el tamaño)\n";
    vector<int> reservado;
    reservado.reserve(1000);                          // pide sitio para 1000 de golpe: size sigue en 0
    cout << "tras reserve(1000): size " << reservado.size() << ", capacity " << reservado.capacity() << "\n";

    // Constructores útiles: vector<int>(5, 0) son cinco ceros; vector<int>(5) también (valor 0); pero
    // OJO: vector<int>{5, 0} son dos elementos, 5 y 0 (las llaves son una lista de valores).
    ver("vector<int>(3, 7)", vector<int>(3, 7));
    ver("vector<int>{3, 7}", vector<int>{3, 7});
    vector<vector<int>> rejilla(3, vector<int>(4, 0));   // matriz 3x4 de ceros
    rejilla[1][2] = 9;
    ver("rejilla", rejilla);

    // Desde Java/Python: pasar un vector por valor COPIA todos sus elementos (O(n)); una asignación b = a también.
    // Para solo leer, recibe `const vector<int>&`. Para modificar el original, `vector<int>&`.
    cout << "suma por const&: " << sumaPorReferencia(v) << " (no copia)\n";

    // ── array<T, N>: tamaño fijo conocido EN COMPILACIÓN, sin memoria dinámica
    array<int, 5> fijo = {3, 1, 4, 1, 5};
    sort(fijo.begin(), fijo.end());
    ver("array ordenado", fijo);
    cout << "fijo.size() = " << fijo.size() << " (siempre 5; no puede crecer)\n";
    // Desde C: int a[5] decae a puntero al pasarlo a una función y se pierde su tamaño. array<int,5> lo conserva,
    // se puede copiar, comparar con == y devolver desde una función.

    // ── deque: cola doble. Insertar/quitar en AMBOS extremos en O(1) y acceso aleatorio en O(1)
    // Es una lista de bloques: no es contigua del todo (no sirve para pasar a una API de C con data()).
    deque<int> cola = {2, 3};
    cola.push_front(1);
    cola.push_back(4);
    cola.pop_front();
    ver("deque", cola);
    cout << "cola[1] = " << cola[1] << " (acceso directo, a diferencia de list)\n";

    // ── list: lista doblemente enlazada. Insertar/borrar con un iterador en cualquier sitio: O(1)
    // Pero no hay l[i] (hay que andar nodo a nodo), cada nodo es una reserva de memoria aparte y recorrerla es lento
    // (los nodos están desperdigados y la caché no ayuda). En la práctica casi nunca gana a vector.
    list<int> enlazada = {1, 2, 4};
    auto donde = enlazada.begin();
    advance(donde, 2);                                // avanzar 2 nodos: O(n)
    enlazada.insert(donde, 3);                        // insertar antes de ese nodo: O(1), no mueve nada
    ver("list", enlazada);

    // ── map y set: árboles equilibrados (rojo-negro). Siempre ORDENADOS por clave. Buscar/insertar/borrar: O(log n)
    map<string, int> edades = {{"luis", 25}, {"ana", 30}};
    edades["eva"] = 41;                               // [] inserta si no existe
    edades.insert({"ana", 99});                       // insert NO pisa un valor existente
    ver("map (ordenado por clave)", edades);
    cout << "ana tiene " << edades.at("ana") << ", ¿existe 'pau'? " << edades.count("pau") << " (count da 0 o 1)\n";
    if (auto it = edades.find("luis"); it != edades.end()) {   // find devuelve un iterador; end() = no está
        cout << "find: " << it->first << " → " << it->second << "\n";
    }
    set<int> conjunto = {5, 1, 3, 3, 1};              // sin repetidos y ordenado
    ver("set", conjunto);
    cout << "lower_bound(2) del set: " << *conjunto.lower_bound(2) << " (el primero ≥ 2, en O(log n); un unordered_set no puede)\n";
    cout << "mínimo " << *conjunto.begin() << ", máximo " << *conjunto.rbegin() << " (los dos extremos, O(1))\n";
    multiset<int> varios = {3, 1, 3};                 // multiset/multimap admiten claves repetidas
    ver("multiset", varios);

    // ── unordered_map / unordered_set: tabla hash. Buscar/insertar en O(1) MEDIO; peor caso O(n); sin orden
    unordered_map<string, int> hashMapa;
    for (const string& palabra : VS{"a", "b", "a", "c", "a"}) {
        hashMapa[palabra]++;                          // [] crea el 0 la primera vez: contar es una línea
    }
    cout << "a aparece " << hashMapa["a"] << " veces; b " << hashMapa["b"] << "\n";
    unordered_set<int> vistos;
    cout << "insert(7) nuevo: " << vistos.insert(7).second << ", insert(7) repetido: " << vistos.insert(7).second << "\n";
    // Cuándo map y cuándo unordered_map: si necesitas recorrer en orden, buscar «el siguiente mayor»
    // (lower_bound) o el mínimo/máximo → map. Si solo buscas por clave → unordered_map (más rápido). Si temes
    // entradas maliciosas con muchas colisiones (concursos hackeables), map es seguro: siempre O(log n).

    // ── Adaptadores: stack, queue, priority_queue (envuelven un deque o vector y restringen la interfaz)
    stack<int> pila;
    pila.push(1);
    pila.push(2);
    cout << "pila.top() = " << pila.top() << " (el último que entró)\n";
    pila.pop();                                       // pop NO devuelve el valor: antes mira top()
    queue<int> fila;
    fila.push(1);
    fila.push(2);
    cout << "fila.front() = " << fila.front() << " (el primero que entró)\n";
    priority_queue<int> monton;                       // ¡MÁXIMOS primero! (Java PriorityQueue es de minimos)
    for (int x : V{3, 9, 1, 7}) {
        monton.push(x);
    }
    cout << "monton.top() = " << monton.top() << "; ";
    priority_queue<int, vector<int>, greater<int>> minimos;   // con greater<int>, el menor primero
    for (int x : V{3, 9, 1, 7}) {
        minimos.push(x);
    }
    cout << "minimos.top() = " << minimos.top() << "\n";

    // ── Iteradores: la pieza que une contenedores y algoritmos
    // Un iterador apunta a un elemento. *it lo lee, ++it avanza, it->campo accede a un miembro. El rango es
    // SEMIABIERTO [begin, end): end() apunta UNA POSICIÓN DESPUÉS del último y NO se puede desreferenciar.
    //   vector, array, deque → de acceso aleatorio: it + 3, it2 - it1, it[2], comparar con <
    //   list, set, map       → bidireccionales: ++it y --it, pero no it + 3
    //   forward_list, unordered_* → solo hacia delante (++it)
    // Por eso std::sort exige acceso aleatorio y no funciona sobre list (list tiene su propio l.sort()).
    V w = {10, 20, 30, 40, 50};
    auto it = w.begin() + 2;
    cout << "*it = " << *it << ", distance(begin, it) = " << distance(w.begin(), it) << ", *next(it) = " << *next(it)
         << ", *prev(it) = " << *prev(it) << "\n";
    cout << "recorrido inverso con rbegin/rend:";
    for (auto r = w.rbegin(); r != w.rend(); ++r) {
        cout << " " << *r;
    }
    cout << "\n";
    // Los tres bucles que vas a ver (el segundo es el normal; el primero cuando necesitas el índice):
    cout << "con índice:";
    for (size_t i = 0; i < w.size(); i++) {           // size_t es SIN signo: ver trampa 5b
        cout << " " << w[i];
    }
    cout << "\nrange-for por referencia:";
    for (int& x : w) {                                // int& modifica el original; const int& evita copiar; int copia
        x += 1;
        cout << " " << x;
    }
    cout << "\n";

// ════════════════════════════════════════════════════════════════════════════
// 2. DESESTRUCTURAR: pair, tuple Y ENLACES ESTRUCTURADOS
// ════════════════════════════════════════════════════════════════════════════
    titulo("2. pair, tuple y structured bindings");

    // pair<A, B> junta dos valores; tuple<A, B, C...> junta los que quieras. Los elementos de un map son pair<const K, V>.
    pair<string, int> par = {"ana", 30};
    cout << par.first << " " << par.second << "\n";
    tuple<string, int, double> tupla = {"luis", 25, 1.8};
    cout << get<0>(tupla) << " " << get<1>(tupla) << " " << get<2>(tupla) << "\n";

    // Structured bindings (C++17): auto [a, b] = ... desmonta un pair, una tupla, un array o un struct simple.
    // Es tu desestructuración de JS/PHP/Python (a, b = par).
    auto [nombre, edad] = par;
    cout << "desmontado: " << nombre << " tiene " << edad << "\n";
    for (const auto& [clave, valor] : edades) {       // recorrer un mapa: la forma moderna (const& evita copiar cada par)
        cout << clave << "=" << valor << " ";
    }
    cout << "\n";
    Persona ana{"Ana", 30, "Madrid"};
    auto [n2, e2, c2] = ana;                          // también con un struct (por orden de declaración)
    cout << n2 << " " << e2 << " " << c2 << "\n";

    // Devolver varios valores a la vez: un pair/tuple (o un struct con nombres, que se lee mejor).
    auto minMax = minmax_element(v.begin(), v.end());       // devuelve pair de ITERADORES
    cout << "min " << *minMax.first << ", max " << *minMax.second << "\n";
    auto [pos, nuevo] = vistos.insert(8);             // insert devuelve pair<iterador, bool>
    cout << "insertado 8: " << nuevo << ", valor " << *pos << "\n";

    // tie(a, b) = ... asigna a variables que YA existen; y tie sirve para comparar varios campos de una vez
    // (las tuplas se comparan lexicográficamente): ver sección 4.
    int mejor = 0;
    string quien;
    tie(quien, mejor) = pair<string, int>{"eva", 41};
    cout << "tie: " << quien << " " << mejor << "\n";

    // Insertar en un map con más control
    map<string, int> m2;
    m2.emplace("a", 1);                               // construye el par en el sitio
    m2.try_emplace("a", 99);                          // no hace nada (ya existe) y, a diferencia de insert, ni construye el valor
    m2.insert_or_assign("a", 2);                      // pisa el valor si existe
    cout << "m2[a] = " << m2["a"] << "\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. transform / copy_if / accumulate: <algorithm> Y <numeric>
// ════════════════════════════════════════════════════════════════════════════
    titulo("3. Algoritmos");

    // Cada algoritmo recibe un rango [begin, end) y a veces una función (lambda). Una lambda es una función sin
    // nombre: [captura](parámetros) { cuerpo }. Entre corchetes dices qué variables de fuera ve: [] ninguna,
    // [&] todas por referencia, [=] todas por copia, [x, &y] x por copia e y por referencia.
    V datos = desde(1, 10);
    V cuadrados(datos.size());
    transform(datos.begin(), datos.end(), cuadrados.begin(), [](int x) { return x * x; });   // map
    ver("cuadrados (transform)", cuadrados);

    V pares;
    copy_if(datos.begin(), datos.end(), back_inserter(pares), [](int x) { return x % 2 == 0; });   // filter
    ver("pares (copy_if + back_inserter)", pares);
    // OJO: copy_if y transform ESCRIBEN en el destino: o ya tiene tamaño (como cuadrados) o usas back_inserter,
    // que hace push_back en cada escritura. Escribir más allá del final de un vector es comportamiento indefinido.

    cout << "suma (accumulate): " << accumulate(datos.begin(), datos.end(), 0) << "\n";            // reduce
    cout << "producto de 1..5: " << accumulate(datos.begin(), datos.begin() + 5, 1LL, multiplies<long long>()) << "\n";
    cout << "fold con lambda: " << accumulate(datos.begin(), datos.end(), string(), [](const string& acc, int x) {
        return acc.empty() ? to_string(x) : acc + "-" + to_string(x);
    }) << "\n";
    // Trampa: el tipo del VALOR INICIAL es el del acumulador. accumulate(..., 0) con doubles trunca en cada paso:
    vector<double> dobles = {0.5, 0.5, 0.5, 0.5};
    cout << "doubles con 0: " << accumulate(dobles.begin(), dobles.end(), 0) << " (mal) · con 0.0: "
         << accumulate(dobles.begin(), dobles.end(), 0.0) << " (bien)\n";
    // Y con long long: accumulate(v.begin(), v.end(), 0) suma en int y DESBORDA (UB) con valores grandes: usa 0LL.

    cout << "count_if mayores que 5: " << count_if(datos.begin(), datos.end(), [](int x) { return x > 5; })
         << " · any_of: " << any_of(datos.begin(), datos.end(), [](int x) { return x == 7; })
         << " · all_of: " << all_of(datos.begin(), datos.end(), [](int x) { return x > 0; })
         << " · none_of: " << none_of(datos.begin(), datos.end(), [](int x) { return x > 10; }) << "\n";
    auto primerMayor = find_if(datos.begin(), datos.end(), [](int x) { return x * x > 30; });
    cout << "find_if → " << (primerMayor != datos.end() ? to_string(*primerMayor) : "no hay") << " (find y find_if son O(n))\n";
    // Los algoritmos de búsqueda devuelven un ITERADOR, no un índice: comprueba siempre contra end() antes de usar *it.
    // Para el índice: distance(v.begin(), it).

    V desorden = {5, 3, 8, 1, 9, 2, 8};
    cout << "min " << *min_element(desorden.begin(), desorden.end()) << ", max " << *max_element(desorden.begin(), desorden.end())
         << " (iteradores; hay que desreferenciar con *)\n";
    V ord = desorden;
    sort(ord.begin(), ord.end());                     // O(n log n), EN EL SITIO (modifica ord)
    ver("sort", ord);
    cout << "binary_search(8): " << binary_search(ord.begin(), ord.end(), 8)
         << " · lower_bound(8) está en el índice " << lower_bound(ord.begin(), ord.end(), 8) - ord.begin()
         << " · upper_bound(8) en " << upper_bound(ord.begin(), ord.end(), 8) - ord.begin() << " (O(log n), solo en rangos ORDENADOS)\n";
    auto [desdeOcho, hastaOcho] = equal_range(ord.begin(), ord.end(), 8);
    cout << "equal_range(8): " << distance(desdeOcho, hastaOcho) << " ocho(s)\n";

    // Borrar de un vector: el idioma erase-remove. remove/remove_if NO borran (un algoritmo no puede cambiar el
    // tamaño del contenedor: solo ve iteradores): mueven lo que se queda al principio y devuelven el nuevo «fin».
    V conBasura = {1, 2, 3, 4, 5, 6};
    conBasura.erase(remove_if(conBasura.begin(), conBasura.end(), [](int x) { return x % 3 == 0; }), conBasura.end());
    ver("erase-remove (quita múltiplos de 3)", conBasura);
    V otro = {1, 2, 3, 4, 5, 6};
    erase_if(otro, [](int x) { return x % 2 == 1; });   // C++20: lo mismo en una línea
    ver("erase_if (quita impares)", otro);

    V repes = {3, 1, 3, 2, 1, 3};
    sort(repes.begin(), repes.end());
    repes.erase(unique(repes.begin(), repes.end()), repes.end());   // unique solo quita ADYACENTES: antes hay que ordenar
    ver("sort + unique + erase", repes);

    V a1 = {1, 2, 3, 4, 5};
    reverse(a1.begin(), a1.end());
    ver("reverse", a1);
    rotate(a1.begin(), a1.begin() + 2, a1.end());     // el elemento begin+2 pasa a ser el primero
    ver("rotate", a1);
    V a2 = {1, 2, 3, 4, 5, 6};
    partition(a2.begin(), a2.end(), [](int x) { return x % 2 == 0; });   // los pares delante (no estable)
    cout << "partition: los 3 primeros son pares: " << (a2[0] % 2 == 0 && a2[1] % 2 == 0 && a2[2] % 2 == 0) << "\n";
    V a3 = {9, 4, 7, 1, 8, 2};
    nth_element(a3.begin(), a3.begin() + 2, a3.end());   // coloca en a3[2] el que iría ahí ordenado: O(n) medio
    cout << "nth_element: el 3.º menor es " << a3[2] << " (sin ordenar todo)\n";
    V a4 = {1, 2, 3};
    cout << "permutaciones de {1,2,3}:";
    do {
        cout << " " << a4[0] << a4[1] << a4[2];
    } while (next_permutation(a4.begin(), a4.end()));   // recorre en orden lexicográfico; devuelve false al acabar
    cout << "\n";

    V relleno(5);
    iota(relleno.begin(), relleno.end(), 1);          // 1, 2, 3, 4, 5
    V acumuladas(relleno.size());
    partial_sum(relleno.begin(), relleno.end(), acumuladas.begin());   // sumas de prefijos: base de muchas técnicas
    ver("iota", relleno);
    ver("partial_sum (prefijos)", acumuladas);
    V difs(relleno.size());
    adjacent_difference(acumuladas.begin(), acumuladas.end(), difs.begin());
    ver("adjacent_difference (deshace las sumas)", difs);
    fill(relleno.begin(), relleno.end(), 0);
    ver("fill", relleno);

// ════════════════════════════════════════════════════════════════════════════
// 4. FILAS DE DATOS: sort CON COMPARADORES Y EL OPERADOR <=>
// ════════════════════════════════════════════════════════════════════════════
    titulo("4. Comparadores");

    vector<Persona> gente = {{"Ana", 30, "Madrid"}, {"Luis", 25, "Sevilla"}, {"Eva", 30, "Madrid"}, {"Pau", 41, "Sevilla"}};

    // Un COMPARADOR es una función (a, b) → bool que dice «¿a va ANTES que b?». Debe ser un orden débil estricto:
    // irreflexivo (comp(a, a) es false), asimétrico y transitivo. Si usas <= en vez de <, sort puede leer fuera
    // del vector o colgarse (comportamiento indefinido): es la trampa más famosa de std::sort.
    auto porEdadDesc = [](const Persona& a, const Persona& b) { return a.edad > b.edad; };
    vector<Persona> copia = gente;
    sort(copia.begin(), copia.end(), porEdadDesc);
    ver("por edad descendente (sort NO garantiza estabilidad; con pocos datos lo parece)", copia);
    copia = gente;
    stable_sort(copia.begin(), copia.end(), porEdadDesc);
    ver("por edad descendente (stable_sort)", copia);

    // Varios criterios a la vez: tie() crea una tupla de referencias y las tuplas se comparan campo a campo.
    sort(copia.begin(), copia.end(), [](const Persona& a, const Persona& b) {
        return tie(a.ciudad, b.edad, a.nombre) < tie(b.ciudad, a.edad, b.nombre);   // ciudad ↑, edad ↓ (intercambiada), nombre ↑
    });
    ver("ciudad ↑, edad ↓, nombre ↑", copia);

    // C++20: projections de ranges::sort. «Ordena por este campo» sin escribir la lambda.
    copia = gente;
    ranges::stable_sort(copia, {}, &Persona::nombre);   // {} = orden natural (less), &Persona::nombre = por qué campo
    ver("ranges::stable_sort por nombre", copia);

    // Trampa heredada de C/Java: comparar restando. a - b DESBORDA con valores grandes. En C++ el desbordamiento
    // de int con signo es UB (no solo da un resultado raro: el compilador puede suponer que no ocurre). Compara con < .
    int grande = 2'000'000'000, negativo = -2'000'000'000;
    cout << "comparar con <: " << (grande < negativo) << " (correcto); a - b habría desbordado el int\n";

    // El operador <=> («nave espacial», C++20): una sola línea genera todas las comparaciones.
    Version v1{1, 4}, v2{1, 10};
    cout << "Version{1,4} < Version{1,10}: " << (v1 < v2) << " · == : " << (v1 == v2) << "\n";
    vector<Version> versiones = {{2, 0}, {1, 10}, {1, 4}};
    sort(versiones.begin(), versiones.end());          // funciona porque Version ya sabe compararse con <
    cout << "versiones ordenadas:";
    for (const auto& ver_ : versiones) {
        cout << " " << ver_.major << "." << ver_.minor;
    }
    cout << "\n";

    // Comparadores en contenedores: el tercer parámetro de plantilla de set/map/priority_queue.
    map<string, int, greater<string>> alReves = {{"a", 1}, {"c", 3}, {"b", 2}};
    ver("map con greater<string>", alReves);
    auto porLongitud = [](const string& a, const string& b) { return a.size() != b.size() ? a.size() < b.size() : a < b; };
    set<string, decltype(porLongitud)> porTam(porLongitud);   // el comparador forma parte del TIPO
    for (const string& s : VS{"pera", "uva", "fresa", "kiwi"}) {
        porTam.insert(s);
    }
    ver("set ordenado por longitud y luego alfabético", porTam);
    // Un mapa NO se puede ordenar por valor: se copian sus pares a un vector y se ordena este.
    vector<pair<string, int>> filas(edades.begin(), edades.end());
    sort(filas.begin(), filas.end(), [](const auto& a, const auto& b) { return a.second > b.second; });
    ver("map volcado y ordenado por valor desc", filas);
    // Cadenas: sort ordena por código de byte, no por alfabeto: «Zebra» < «apple» ('Z' = 90 < 'a' = 97).
    VS palabras = {"banana", "Zebra", "apple"};
    sort(palabras.begin(), palabras.end());
    ver("orden natural de strings", palabras);

// ════════════════════════════════════════════════════════════════════════════
// 5. TRAMPAS CLÁSICAS: ITERADORES INVALIDADOS, operator[], size_t
// ════════════════════════════════════════════════════════════════════════════
    titulo("5. Trampas");

    // 5a. Iteradores y referencias INVALIDADOS. Si el contenedor cambia de sitio sus elementos, los iteradores,
    // punteros y referencias que tenías quedan colgando. Usarlos es comportamiento indefinido (UB): a veces
    // «funciona», a veces falla con un valor basura o se cuelga, y AddressSanitizer lo señala como use-after-free.
    //
    //   Contenedor          push_back / insert                                 erase
    //   vector              si hay reasignación: TODOS; si no, desde la posición    desde la posición
    //   deque               push_front/back: iteradores sí, referencias no          en medio: todos
    //   list, map, set      NINGUNO (solo el elemento borrado)                      solo el borrado
    //   unordered_*         un rehash invalida los iteradores (no las referencias)  solo el borrado
    V crecimiento = {1, 2, 3};
    const int* antes = crecimiento.data();
    crecimiento.insert(crecimiento.end(), 100, 0);     // seguro que reasigna: la memoria cambia de sitio
    cout << "¿se movió la memoria? " << (crecimiento.data() != antes) << "  → cualquier iterador viejo está colgando\n";
    // Mal:  auto it = v.begin(); v.push_back(9); cout << *it;      // UB
    // Mal:  for (auto x : v) if (cond) v.push_back(x);              // UB: el range-for guarda begin/end
    // Bien: guarda el índice (no un iterador) o reserva capacidad antes, o vuelve a pedir begin() después.

    // 5b. Borrar mientras recorres. erase devuelve el siguiente iterador válido: úsalo.
    V borrando = {1, 2, 3, 4, 5, 6};
    for (auto p = borrando.begin(); p != borrando.end();) {
        if (*p % 2 == 0) {
            p = borrando.erase(p);                     // NO hacer ++p después de borrar
        } else {
            ++p;
        }
    }
    ver("erase con el iterador devuelto", borrando);
    // (Pero cada erase en un vector es O(n): para quitar muchos, erase-remove / erase_if es O(n) en total.)

    // 5c. size_t es SIN SIGNO. v.size() - 1 con v vacío no da -1: da 18.446.744.073.709.551.615 (el desbordamiento
    // sin signo SÍ está definido: da la vuelta). Y `for (size_t i = v.size() - 1; i >= 0; i--)` NO termina nunca,
    // porque un sin signo es siempre ≥ 0. Mezclar con int también engaña: -1 < v.size() es FALSE (el -1 se convierte).
    V vacio;
    size_t tam0 = vacio.size();
    cout << "vacio.size() - 1 = " << tam0 - 1 << "\n";
    int bajando = 0;
    for (int i = static_cast<int>(v.size()) - 1; i >= 0; i--) {   // solución: iterar con int con signo
        bajando++;
    }
    cout << "bucle hacia atrás con int: " << bajando << " vueltas · alternativa: ssize(v) = " << ssize(v) << " (con signo, C++20)\n";

    // 5d. [] frente a at(): v[i] fuera de rango es UB (sin comprobación); v.at(i) lanza out_of_range.
    try {
        cout << v.at(99) << "\n";
    } catch (const out_of_range& e) {
        cout << "at(99) → out_of_range (con v[99] habría sido UB)\n";
    }
    // Y en un map, m[clave] INSERTA la clave con valor por defecto si no existía; incluso solo para mirar:
    map<string, int> tamanoMapa;
    int tmp = tamanoMapa["fantasma"];
    cout << "tras leer tamanoMapa[\"fantasma\"] (= " << tmp << ") el mapa tiene " << tamanoMapa.size() << " entrada. Para mirar sin insertar: find / count / contains\n";
    // En un map CONSTANTE, [] ni compila: usa at() o find().

    // 5e. Recorrer por valor copia cada elemento: for (auto p : mapa) copia string + int en cada vuelta;
    // for (auto s : palabras) copia cada string. Usa const auto& siempre que no modifiques.

    // 5f. vector<bool> es una excepción rara: guarda bits y su v[i] devuelve un proxy, no un bool&. Evítalo
    // (usa vector<char> o vector<int>, o bitset si el tamaño es fijo).
    vector<bool> bits = {true, false};
    cout << "vector<bool>: " << bits[0] << bits[1] << " (funciona, pero 'bool& r = bits[0]' no compilaría)\n";

    // 5g. Un comparador con <= o que no sea transitivo estropea sort, set y map (UB). Y comparar doubles con == falla
    // por redondeo: 0.1 + 0.2 == 0.3 es false.

// ════════════════════════════════════════════════════════════════════════════
// 6. RECORRER SIN GUARDAR: ranges Y views PEREZOSAS
// ════════════════════════════════════════════════════════════════════════════
    titulo("6. Ranges y views");

    // C++20 trae ranges: las operaciones se encadenan con | (como las tuberías de la shell o los Stream de Java)
    // y las VIEWS son perezosas: no calculan nada hasta que alguien las recorre y no guardan los resultados.
    // views::iota(1) es una secuencia INFINITA 1, 2, 3... que solo existe a medida que se pide.
    int evaluaciones = 0;
    auto primerosCuadrados = views::iota(1)
        | views::filter([&](int x) { evaluaciones++; return x % 2 == 1; })
        | views::transform([](int x) { return x * x; })
        | views::take(5);
    cout << "cinco cuadrados de impares:";
    for (int x : primerosCuadrados) {
        cout << " " << x;
    }
    cout << "\n(el filtro solo se evaluó " << evaluaciones << " veces: lo justo para obtener 5 resultados)\n";

    long long suma = 0;
    for (long long x : views::iota(1, 100001) | views::transform([](long long x) { return x * x; })) {
        suma += x;                                     // 100.000 cuadrados sumados sin crear ningún vector
    }
    cout << "suma de 100000 cuadrados sin crear la lista: " << suma << "\n";

    // Una view no posee los datos: apunta a los del contenedor original. Si el contenedor muere o cambia de
    // tamaño mientras la view vive, la view cuelga (misma trampa que los iteradores).
    V base = desde(1, 6);
    auto mitad = base | views::drop(2) | views::take(3);   // 3, 4, 5 sin copiar nada
    cout << "drop(2) | take(3):";
    for (int x : mitad) {
        cout << " " << x;
    }
    cout << "\n";
    ranges::reverse(base);                             // las versiones ranges:: aceptan el contenedor entero
    cout << "ranges::reverse + ranges::max: " << base.front() << ", máximo " << ranges::max(base) << "\n";
    // Para materializar una view en un vector (C++20): V r(view.begin(), view.end()) con una view común, o
    // ranges::to<V>(view) en C++23. Un generador con coroutines (std::generator) llega en C++23.

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

    auto inicial = [](const string& s) { return s.substr(0, 1); };
    auto paridad = [](int x) { return x % 2; };
    auto identidad = [](int x) { return x; };
    auto todos = [](const string&) { return string("todos"); };

    prueba(agruparPor,
        caso("por inicial", map<string, VS>{{"a", {"ana", "amy"}}, {"l", {"luis"}}}, VS{"ana", "luis", "amy"}, inicial),
        caso("por paridad (claves enteras)", map<int, V>{{0, {2, 4}}, {1, {1, 3, 5}}}, V{1, 2, 3, 4, 5}, paridad),
        caso("vacío", map<int, V>{}, V{}, identidad),
        caso("un solo grupo", map<string, VS>{{"todos", {"x", "y"}}}, VS{"x", "y"}, todos),
        caso("cada uno en su grupo, dentro conserva el orden", map<int, V>{{1, {1}}, {2, {2}}, {3, {3, 3}}}, V{3, 1, 2, 3}, identidad));

    prueba(topPalabras,
        caso("cuenta y ordena", vector<pair<string, int>>{{"a", 3}, {"b", 2}}, string("a b a c b a"), 2),
        caso("desempata alfabéticamente", vector<pair<string, int>>{{"gato", 1}, {"loro", 1}}, string("perro gato loro"), 2),
        caso("ignora mayúsculas y signos", vector<pair<string, int>>{{"hola", 3}, {"adios", 1}}, string("¡Hola, hola! HOLA... adios"), 5),
        caso("menos de k palabras", vector<pair<string, int>>{{"a", 1}}, string("a"), 4),
        caso("k = 0", vector<pair<string, int>>{}, string("a b c"), 0),
        caso("texto sin palabras", vector<pair<string, int>>{}, string("123 ... !!!"), 3));

    prueba(aplanar,
        caso("un entero suelto", V{5}, 5),
        caso("ya plano", V{1, 2, 3}, V{1, 2, 3}),
        caso("dos niveles", V{1, 2, 3, 4}, VV{{1, 2}, {3}, {4}}),
        caso("tres niveles", V{1, 2, 3, 4, 5}, vector<VV>{VV{V{1, 2}, V{3}}, VV{V{4, 5}}}),
        caso("vacíos desaparecen", V{7}, VV{V{}, V{7}, V{}}),
        caso("todo vacío", V{}, vector<VV>{VV{V{}}, VV{}}));

    auto gente2 = vector<Persona>{{"Ana", 30, "Madrid"}, {"Luis", 25, "Sevilla"}, {"Eva", 30, "Madrid"}, {"Pau", 41, "Sevilla"}};
    grupo("Coleccion");
    comprueba("map transforma cada elemento y conserva el orden", [&] { return Coleccion<int>::hacer({1, 2}).map([](int x) { return x * 10; }).all(); }, V{10, 20});
    comprueba("map puede cambiar de tipo", [&] { return Coleccion<int>::hacer({1, 2}).map([](int x) { return to_string(x) + "!"; }).all(); }, VS{"1!", "2!"});
    comprueba("filter devuelve una colección nueva", [&] { return Coleccion<int>::hacer({1, 2, 3, 4, 5}).filter([](int x) { return x % 2 == 1; }).all(); }, V{1, 3, 5});
    comprueba("filter sin función quita los falsos", [&] { return Coleccion<int>::hacer({0, 1, 0, 2}).filter().all(); }, V{1, 2});
    comprueba("filter sin función con textos", [&] { return Coleccion<string>::hacer({"", "a", "", "b"}).filter().all(); }, VS{"a", "b"});
    comprueba("reduce", [&] { return Coleccion<int>::hacer({1, 2, 3}).reduce(0, [](int acc, int x) { return acc * 10 + x; }); }, 123);
    comprueba("reduce a otro tipo", [&] { return Coleccion<int>::hacer({1, 2, 3}).reduce(string(), [](const string& acc, int x) { return acc + to_string(x); }); }, string("123"));
    comprueba("sum", [&] { return Coleccion<int>::hacer({1, 2, 3, 4}).sum(); }, 10.0);
    comprueba("avg", [&] { return Coleccion<int>::hacer({1, 2, 3, 4}).avg(); }, 2.5);
    comprueba("avg de una colección vacía", [&] { return Coleccion<int>::hacer({}).avg(); }, 0.0);
    comprueba("first sin función", [&] { return Coleccion<int>::hacer({5, 6, 7}).first().value_or(-1); }, 5);
    comprueba("first con función", [&] { return Coleccion<int>::hacer({5, 6, 7}).first([](int x) { return x > 5; }).value_or(-1); }, 6);
    comprueba("first vacío es nullopt", [&] { return Coleccion<int>::hacer({}).first().has_value(); }, false);
    comprueba("first con defecto", [&] { return Coleccion<int>::hacer({1}).first([](int x) { return x > 5; }, 99); }, 99);
    comprueba("sortBy descendente y estable", [&] { return Coleccion<Persona>::hacer(gente2).sortBy(&Persona::edad, true).map(&Persona::nombre).all(); }, VS{"Pau", "Ana", "Eva", "Luis"});
    comprueba("sortBy ascendente", [&] { return Coleccion<Persona>::hacer(gente2).sortBy(&Persona::nombre).map(&Persona::nombre).all(); }, VS{"Ana", "Eva", "Luis", "Pau"});
    comprueba("groupBy", [&] { return Coleccion<Persona>::hacer(gente2).groupBy(&Persona::ciudad); },
              map<string, vector<Persona>>{{"Madrid", {gente2[0], gente2[2]}}, {"Sevilla", {gente2[1], gente2[3]}}});
    comprueba("unique conserva la primera aparición", [&] { return Coleccion<int>::hacer({3, 1, 3, 2, 1}).unique().all(); }, V{3, 1, 2});
    comprueba("take", [&] { return Coleccion<int>::hacer({1, 2, 3, 4}).take(2).all(); }, V{1, 2});
    comprueba("take más de los que hay", [&] { return Coleccion<int>::hacer({1, 2}).take(10).all(); }, V{1, 2});
    comprueba("encadenado", [&] {
        return Coleccion<int>::hacer(desde(1, 10)).filter([](int x) { return x % 2 == 0; }).map([](int x) { return x * x; }).sum();
    }, 220.0);
    comprueba("es inmutable", [&] {
        auto c = Coleccion<int>::hacer({1, 2});
        c.map([](int x) { return x * 10; });
        c.filter([](int) { return false; });
        return c.all();
    }, V{1, 2});
    comprueba("count() y for-each", [&] {
        auto c = Coleccion<int>::hacer({1, 2, 3});
        int total = 0;
        for (int x : c) {
            total += x;
        }
        return V{static_cast<int>(c.count()), total};
    }, V{3, 6});

    prueba(unicos,
        caso("enteros", V{3, 1, 2}, V{3, 1, 3, 2, 1}),
        caso("textos", VS{"b", "a", "c"}, VS{"b", "a", "b", "c", "a"}),
        caso("sin repetidos", V{1, 2, 3}, V{1, 2, 3}),
        caso("vacío", V{}, V{}),
        caso("todos iguales", V{7}, V{7, 7, 7, 7}));

    prueba(interseccion,
        caso("básica", V{3, 2}, V{3, 1, 3, 2}, V{2, 3, 9}),
        caso("sin elementos comunes", V{}, V{1, 2}, V{3, 4}),
        caso("vacía", V{}, V{}, V{1, 2}),
        caso("una de las dos vacía", V{}, V{1, 2}, V{}),
        caso("conserva el orden de la primera", V{5, 3, 1}, V{5, 4, 3, 2, 1}, V{1, 3, 5}));

    prueba(transponer,
        caso("rectangular", VV{{1, 4}, {2, 5}, {3, 6}}, VV{{1, 2, 3}, {4, 5, 6}}),
        caso("una sola fila", VV{{1}, {2}, {3}}, VV{{1, 2, 3}}),
        caso("una sola columna", VV{{1, 2, 3}}, VV{{1}, {2}, {3}}),
        caso("cuadrada", VV{{1, 3}, {2, 4}}, VV{{1, 2}, {3, 4}}),
        caso("vacía", VV{}, VV{}));

    prueba(quitarPares,
        caso("mezcla", V{1, 3, 5}, V{1, 2, 3, 4, 5}),
        caso("todos pares", V{}, V{2, 4, 6}),
        caso("ninguno par", V{1, 3}, V{1, 3}),
        caso("negativos (-3 % 2 es -1)", V{-3, -1}, V{-3, -2, -1, 0}),
        caso("vacío", V{}, V{}),
        caso("consecutivos", V{1, 3, 5}, V{1, 2, 4, 6, 3, 8, 5}));

    prueba(rotarIzquierda,
        caso("k = 2", V{3, 4, 5, 1, 2}, V{1, 2, 3, 4, 5}, 2),
        caso("k = 0", V{1, 2, 3}, V{1, 2, 3}, 0),
        caso("k mayor que el tamaño da la vuelta", V{2, 3, 1}, V{1, 2, 3}, 4),
        caso("k = tamaño no cambia nada", V{1, 2, 3}, V{1, 2, 3}, 3),
        caso("k negativa rota a la derecha", V{5, 1, 2, 3, 4}, V{1, 2, 3, 4, 5}, -1),
        caso("vacío", V{}, V{}, 7));

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // Con find() de una lista dentro del bucle saldría O(n²); con un unordered_set, O(n).
    medir(unicos, conRepetidos(n));
    medir(interseccion, desde(0, n - 1), desde(n / 2, n + n / 2));
    // erase dentro de un bucle sería O(n²); erase-remove, O(n).
    medir(quitarPares, numeros(n));
}
