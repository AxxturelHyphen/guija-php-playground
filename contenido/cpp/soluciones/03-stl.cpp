/*
 * SOLUCIONES · Tema 3 · STL: contenedores, iteradores y algoritmos
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
#include <algorithm>
#include <functional>
#include <map>
#include <numeric>
#include <optional>
#include <set>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using namespace std;

/**
 * Agrupar elementos por una clave calculada.
 *
 * @complejidad Tiempo O(n log g) con g grupos distintos (cada inserción en el map cuesta O(log g)); espacio O(n).
 * @bigo n
 * @explicacion Una sola pasada: `resultado[clave(x)]` crea el vector del grupo la primera vez (operator[] inserta un
 * valor por defecto) y `push_back` añade el elemento, así que dentro de cada grupo se conserva el orden original.
 * El tipo K sale de `invoke_result_t` y `decay_t` le quita const y &, para que la función clave pueda devolver una
 * referencia o un temporal. Se usa std::invoke para admitir también punteros a miembro (`&Persona::ciudad`).
 * @alternativas Recorrer la lista una vez por cada clave distinta es O(n·g). Con unordered_map el reparto baja a O(n)
 * medio, pero las claves salen sin orden.
 */
template <class T, class F, class K = decay_t<invoke_result_t<F&, const T&>>>
map<K, vector<T>> agruparPor(const vector<T>& xs, F clave)
{
    map<K, vector<T>> resultado;
    for (const T& x : xs) {
        resultado[invoke(clave, x)].push_back(x);
    }
    return resultado;
}

/**
 * Las k palabras más frecuentes de un texto.
 *
 * @complejidad Tiempo O(n + p log p) con p palabras distintas; espacio O(p).
 * @explicacion Se recorre el texto una vez formando palabras en minúsculas y contándolas en un unordered_map (O(1)
 * medio por palabra). Después se vuelcan los pares a un vector y se ordena con un comparador de dos criterios: más
 * veces primero y, a igualdad, orden alfabético. Se convierte cada char a unsigned char antes de llamar a isalpha y
 * tolower: con un char negativo (bytes de UTF-8) serían comportamiento indefinido. Al final se recorta a k.
 * @alternativas Con partial_sort (O(p log k)) o un heap de tamaño k se evita ordenar todo cuando k es pequeño. Contar
 * cada palabra recorriendo la lista otra vez sería O(n²).
 */
vector<pair<string, int>> topPalabras(const string& texto, int k)
{
    unordered_map<string, int> cuentas;
    string actual;
    for (char c : texto) {
        unsigned char u = static_cast<unsigned char>(c);
        if (u < 128 && isalpha(u)) {
            actual += static_cast<char>(tolower(u));
        } else if (!actual.empty()) {
            cuentas[actual]++;
            actual.clear();
        }
    }
    if (!actual.empty()) {
        cuentas[actual]++;
    }
    vector<pair<string, int>> filas(cuentas.begin(), cuentas.end());
    sort(filas.begin(), filas.end(), [](const auto& a, const auto& b) {
        return a.second != b.second ? a.second > b.second : a.first < b.first;
    });
    if (k < 0) {
        k = 0;
    }
    if (filas.size() > static_cast<size_t>(k)) {
        filas.resize(static_cast<size_t>(k));
    }
    return filas;
}

/**
 * Aplanar valores anidados a cualquier profundidad.
 *
 * @complejidad Tiempo O(n) en el número de enteros (más el de contenedores); espacio O(n).
 * @explicacion Es recursión sobre el TIPO: `if constexpr` elige en compilación la rama. Para un entero devuelve un
 * vector con ese único valor; para un contenedor aplana cada elemento (la llamada recursiva se instancia con el tipo
 * del elemento, un nivel más abajo) y concatena con `insert`. Los contenedores vacíos aportan cero enteros, así que
 * desaparecen solos. Como la profundidad es parte del tipo, el compilador genera una versión de la función por nivel.
 * @alternativas Un vector de variantes recursivo (variant<int, vector<Anidado>>) permite profundidad decidida en
 * ejecución, a costa de más código.
 */
template <class T>
vector<int> aplanar(const T& x)
{
    if constexpr (is_integral_v<T>) {
        return {static_cast<int>(x)};
    } else {
        vector<int> resultado;
        for (const auto& elemento : x) {
            vector<int> parte = aplanar(elemento);
            resultado.insert(resultado.end(), parte.begin(), parte.end());
        }
        return resultado;
    }
}

/**
 * Quitar repetidos conservando la primera aparición.
 *
 * @complejidad Tiempo O(n) medio; espacio O(n).
 * @bigo n
 * @explicacion Un unordered_set guarda lo ya visto. `insert` devuelve un pair<iterador, bool>: el segundo vale true solo
 * si el valor era nuevo, así que insertar y comprobar es una única operación O(1) medio. Se hace `reserve` para evitar
 * rehashes a mitad de camino.
 * @alternativas Buscar con `find` en el resultado dentro del bucle es O(n²). Con sort + unique es O(n log n) pero pierde
 * el orden original.
 */
template <class T>
vector<T> unicos(const vector<T>& xs)
{
    unordered_set<T> vistos;
    vistos.reserve(xs.size());
    vector<T> resultado;
    for (const T& x : xs) {
        if (vistos.insert(x).second) {
            resultado.push_back(x);
        }
    }
    return resultado;
}

/**
 * Intersección de dos vectores sin repetidos, en el orden del primero.
 *
 * @complejidad Tiempo O(n + m) medio; espacio O(m).
 * @bigo n
 * @explicacion Los valores de b van a un unordered_set (O(m)). Luego se recorre a: cada valor presente en b se añade
 * una sola vez (se saca del conjunto con `erase`, que devuelve cuántos borró: 1 si estaba, 0 si no), lo que a la vez
 * evita repetidos. Cada consulta es O(1) medio.
 * @alternativas Dos bucles anidados son O(n·m). Con ambos ordenados, dos punteros dan O(n log n + m log m) sin tabla hash
 * (y std::set_intersection).
 */
V interseccion(const V& a, const V& b)
{
    unordered_set<int> pendientes(b.begin(), b.end());
    V resultado;
    for (int x : a) {
        if (pendientes.erase(x) > 0) {
            resultado.push_back(x);
        }
    }
    return resultado;
}

/**
 * Transponer una matriz rectangular.
 *
 * @complejidad Tiempo O(f·c); espacio O(f·c).
 * @explicacion Si la matriz está vacía se devuelve vacía antes de mirar `m[0]` (accederíamos fuera de rango: UB). Si no,
 * se crea la matriz resultado de c filas por f columnas con las dimensiones ya puestas y se copia cada celda
 * `r[j][i] = m[i][j]`. Funciona igual con una sola fila o una sola columna.
 * @alternativas In situ solo es posible en matrices cuadradas (intercambiando simétricos); para rectangulares hace falta
 * una matriz nueva.
 */
VV transponer(const VV& m)
{
    if (m.empty()) {
        return {};
    }
    size_t filas = m.size();
    size_t columnas = m[0].size();
    VV r(columnas, V(filas));
    for (size_t i = 0; i < filas; i++) {
        for (size_t j = 0; j < columnas; j++) {
            r[j][i] = m[i][j];
        }
    }
    return r;
}

/**
 * Quitar los pares de un vector en el sitio.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion Idioma erase-remove: `remove_if` recorre una sola vez moviendo hacia el principio los elementos que se
 * quedan y devuelve el iterador donde empieza lo sobrante; `erase` recorta entonces el vector de golpe. Se compara con
 * `x % 2 == 0` (no `== 1`) porque en C++ el resto de un negativo impar es -1.
 * @alternativas Llamar a `erase` dentro de un bucle desplaza el resto del vector en cada borrado: O(n²). C++20 ofrece
 * `erase_if(xs, pred)`, que hace lo mismo en una línea.
 */
void quitarPares(V& xs)
{
    xs.erase(remove_if(xs.begin(), xs.end(), [](int x) { return x % 2 == 0; }), xs.end());
}

/**
 * Rotar un vector k posiciones a la izquierda en el sitio.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @explicacion Con el vector vacío se sale antes del módulo (n = 0 sería división por cero). `((k % n) + n) % n`
 * normaliza cualquier k, también negativo, al rango 0..n-1 (en C++ `-1 % 5` es -1). `rotate(inicio, inicio + k, fin)`
 * deja el elemento k como primero.
 * @alternativas Copiar a un vector auxiliar es O(n) en memoria. Tres inversiones (reverse de las dos partes y de todo)
 * hacen lo mismo con O(1) de memoria, que es lo que implementa rotate.
 */
void rotarIzquierda(V& xs, int k)
{
    int n = static_cast<int>(xs.size());
    if (n == 0) {
        return;
    }
    int desplazamiento = ((k % n) + n) % n;
    rotate(xs.begin(), xs.begin() + desplazamiento, xs.end());
}

/**
 * Coleccion: envoltura fluida e inmutable sobre un vector.
 *
 * @complejidad Cada operación es O(n) (copia o recorre); `all`, `count`, `begin` y `end` son O(1).
 * @explicacion Todas las operaciones son `const` y devuelven una Coleccion nueva (las lambdas y punteros a miembro se
 * invocan con std::invoke). `map` deduce el tipo de salida con `invoke_result_t` + `decay_t`, así que puede cambiar de
 * tipo. `filter()` sin función usa `static_cast<bool>` (o `!empty()` si el tipo tiene `empty()`, porque un string no se convierte a bool), de modo que 0 y "" cuentan como falsos. `sortBy` es estable
 * (stable_sort) y compara con `<` las claves, invirtiendo los operandos si es descendente (no se invierte el resultado
 * final: eso rompería la estabilidad). `unique` usa un set de lo visto, lo que exige que T tenga `<`.
 * @alternativas Con ranges y views se pueden encadenar estas operaciones de forma perezosa sin copias intermedias.
 */
template <class T>
class Coleccion {
    vector<T> items_;

public:
    Coleccion() = default;

    static Coleccion hacer(vector<T> items)
    {
        Coleccion c;
        c.items_ = std::move(items);
        return c;
    }

    const vector<T>& all() const
    {
        return items_;
    }

    size_t count() const
    {
        return items_.size();
    }

    typename vector<T>::const_iterator begin() const
    {
        return items_.begin();
    }

    typename vector<T>::const_iterator end() const
    {
        return items_.end();
    }

    template <class F>
    auto map(F f) const -> Coleccion<decay_t<invoke_result_t<F&, const T&>>>
    {
        using R = decay_t<invoke_result_t<F&, const T&>>;
        vector<R> salida;
        salida.reserve(items_.size());
        for (const T& x : items_) {
            salida.push_back(invoke(f, x));
        }
        return Coleccion<R>::hacer(std::move(salida));
    }

    template <class F>
    Coleccion filter(F f) const
    {
        vector<T> salida;
        for (const T& x : items_) {
            if (invoke(f, x)) {
                salida.push_back(x);
            }
        }
        return hacer(std::move(salida));
    }

    Coleccion filter() const
    {
        return filter([](const T& x) {
            if constexpr (requires { x.empty(); }) {
                return !x.empty();                      // textos y contenedores: «verdadero» si no están vacíos
            } else {
                return static_cast<bool>(x);            // números y punteros: distinto de cero
            }
        });
    }

    template <class R, class F>
    R reduce(R inicial, F f) const
    {
        for (const T& x : items_) {
            inicial = f(std::move(inicial), x);
        }
        return inicial;
    }

    double sum() const
    {
        double total = 0;
        for (const T& x : items_) {
            total += static_cast<double>(x);
        }
        return total;
    }

    double avg() const
    {
        return items_.empty() ? 0.0 : sum() / static_cast<double>(items_.size());
    }

    optional<T> first() const
    {
        if (items_.empty()) {
            return nullopt;
        }
        return items_.front();
    }

    template <class F>
    optional<T> first(F f) const
    {
        for (const T& x : items_) {
            if (invoke(f, x)) {
                return x;
            }
        }
        return nullopt;
    }

    template <class F>
    T first(F f, T defecto) const
    {
        return first(f).value_or(std::move(defecto));
    }

    template <class F>
    Coleccion sortBy(F clave, bool desc = false) const
    {
        vector<T> salida = items_;
        stable_sort(salida.begin(), salida.end(), [&](const T& a, const T& b) {
            return desc ? invoke(clave, b) < invoke(clave, a) : invoke(clave, a) < invoke(clave, b);
        });
        return hacer(std::move(salida));
    }

    template <class F>
    auto groupBy(F f) const -> std::map<decay_t<invoke_result_t<F&, const T&>>, vector<T>>
    {
        std::map<decay_t<invoke_result_t<F&, const T&>>, vector<T>> grupos;
        for (const T& x : items_) {
            grupos[invoke(f, x)].push_back(x);
        }
        return grupos;
    }

    Coleccion unique() const
    {
        set<T> vistos;
        vector<T> salida;
        for (const T& x : items_) {
            if (vistos.insert(x).second) {
                salida.push_back(x);
            }
        }
        return hacer(std::move(salida));
    }

    Coleccion take(size_t n) const
    {
        return hacer(vector<T>(items_.begin(), items_.begin() + static_cast<ptrdiff_t>(min(n, items_.size()))));
    }
};
