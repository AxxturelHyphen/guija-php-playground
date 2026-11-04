/*
 * SOLUCIONES · Tema 5 · Ordenación
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */
#include <algorithm>
#include <functional>
#include <stdexcept>
#include <string>
#include <tuple>
#include <unordered_map>
#include <vector>
using namespace std;

/**
 * Burbuja con parada anticipada.
 *
 * @complejidad Tiempo O(n²) en el peor y medio caso, O(n) si ya está ordenado; espacio O(n) por la copia (O(1) extra).
 * @bigo n2
 * @explicacion Se trabaja sobre una copia (la entrada es const). En cada pasada se comparan vecinos y se intercambian
 * los que están al revés: el mayor «sube» hasta su sitio, así que cada pasada deja un elemento más fijado al final y
 * se puede acortar el recorrido. Si una pasada entera no intercambia nada, ya está ordenado y se para (por eso el
 * mejor caso es O(n)). Los índices son size_t: el bucle se escribe como `i + pasada < n` en lugar de `i < n - pasada`
 * para no restar nunca por debajo de cero.
 * @alternativas Inserción hace menos escrituras y es igual de simple. Para producción, std::sort.
 */
V burbuja(const V& xs)
{
    V r = xs;
    size_t n = r.size();
    for (size_t pasada = 1; pasada < n; pasada++) {
        bool cambio = false;
        for (size_t i = 0; i + pasada < n; i++) {
            if (r[i] > r[i + 1]) {
                swap(r[i], r[i + 1]);
                cambio = true;
            }
        }
        if (!cambio) {
            break;
        }
    }
    return r;
}

/**
 * Ordenación por inserción.
 *
 * @complejidad Tiempo O(n²) en el peor y medio caso, O(n) si ya está ordenado; espacio O(1) extra.
 * @bigo n2
 * @explicacion La parte izquierda [0, i) siempre está ordenada. Se toma el elemento i, se desplazan una posición a la
 * derecha los mayores que él y se deja caer en el hueco. Para que el bucle interno pueda terminar con índices sin
 * signo, `j` cuenta cuántos elementos quedan por mirar a la izquierda (empieza en i y baja hasta 0) y se accede a
 * `r[j - 1]`: nunca hay un índice negativo. Con datos casi ordenados cuesta casi O(n).
 * @alternativas Búsqueda binaria para localizar el hueco (std::upper_bound) reduce las comparaciones a O(n log n), no los
 * desplazamientos. std::sort usa inserción para tramos de menos de ~16 elementos.
 */
V insercion(const V& xs)
{
    V r = xs;
    for (size_t i = 1; i < r.size(); i++) {
        int actual = r[i];
        size_t j = i;
        while (j > 0 && r[j - 1] > actual) {
            r[j] = r[j - 1];
            j--;
        }
        r[j] = actual;
    }
    return r;
}

/**
 * Merge sort estable con comparador.
 *
 * @complejidad Tiempo O(n log n) siempre; espacio O(n).
 * @bigo nlogn
 * @explicacion Divide y vencerás: se parte por la mitad (hasta vectores de 0 o 1 elemento, que ya están ordenados), se
 * ordena cada mitad recursivamente y se mezclan con dos índices. Para que sea ESTABLE, a igualdad se toma el de la
 * izquierda: se toma el derecho solo si `comparar(derecha, izquierda)` es true (estrictamente menor), nunca si empatan.
 * Cada nivel de recursión recorre n elementos y hay log₂ n niveles.
 * @alternativas std::stable_sort lo hace ya hecho. Quick sort usa menos memoria pero no es estable. Un merge sort que
 * reutiliza un único vector auxiliar evita las asignaciones repetidas.
 */
template <class T, class Comparador = less<>>
vector<T> mergeSort(const vector<T>& xs, Comparador comparar = {})
{
    if (xs.size() <= 1) {
        return xs;
    }
    size_t medio = xs.size() / 2;
    vector<T> izquierda = mergeSort(vector<T>(xs.begin(), xs.begin() + static_cast<ptrdiff_t>(medio)), comparar);
    vector<T> derecha = mergeSort(vector<T>(xs.begin() + static_cast<ptrdiff_t>(medio), xs.end()), comparar);
    vector<T> resultado;
    resultado.reserve(xs.size());
    size_t i = 0;
    size_t j = 0;
    while (i < izquierda.size() && j < derecha.size()) {
        if (comparar(derecha[j], izquierda[i])) {
            resultado.push_back(derecha[j++]);
        } else {
            resultado.push_back(izquierda[i++]);
        }
    }
    while (i < izquierda.size()) {
        resultado.push_back(izquierda[i++]);
    }
    while (j < derecha.size()) {
        resultado.push_back(derecha[j++]);
    }
    return resultado;
}

/**
 * Quick sort con partición en tres vectores.
 *
 * @complejidad Tiempo O(n log n) medio, O(n²) en el peor caso (pivotes muy desiguales); espacio O(n) (vectores auxiliares).
 * @bigo nlogn
 * @explicacion Se elige como pivote el elemento CENTRAL (con datos ordenados o invertidos da particiones equilibradas) y se
 * reparte el resto en menores, iguales y mayores. Se ordenan recursivamente solo menores y mayores; los iguales ya están
 * en su sitio, así que un vector con muchos repetidos no se degrada. Se concatena menores + iguales + mayores.
 * @alternativas Partir el vector en el sitio (Lomuto/Hoare) evita las copias y deja O(log n) de memoria. Un pivote aleatorio
 * o la mediana de tres hace casi imposible el caso malo; std::sort añade un heap sort de seguridad (introsort).
 */
V quickSort(const V& xs)
{
    if (xs.size() <= 1) {
        return xs;
    }
    int pivote = xs[xs.size() / 2];
    V menores;
    V iguales;
    V mayores;
    for (int x : xs) {
        if (x < pivote) {
            menores.push_back(x);
        } else if (x > pivote) {
            mayores.push_back(x);
        } else {
            iguales.push_back(x);
        }
    }
    V resultado = quickSort(menores);
    resultado.insert(resultado.end(), iguales.begin(), iguales.end());
    V altos = quickSort(mayores);
    resultado.insert(resultado.end(), altos.begin(), altos.end());
    return resultado;
}

/**
 * Counting sort para enteros en 0..max.
 *
 * @complejidad Tiempo O(n + max); espacio O(max).
 * @bigo n
 * @explicacion Se valida primero (max negativo o valores fuera de rango lanzan invalid_argument; sin esto, un índice fuera
 * de rango o un tamaño negativo convertido a size_t sería UB). `cuenta[v]` guarda cuántas veces aparece v. Después se
 * recorre cuenta de 0 a max emitiendo cada valor tantas veces como aparezca. No compara elementos, por eso rompe el
 * límite O(n log n); compensa solo si max es del orden de n o menor.
 * @alternativas Radix sort ordena enteros grandes por dígitos con varias pasadas de counting sort. std::sort si max es
 * enorme.
 */
V countingSort(const V& xs, int max)
{
    if (max < 0) {
        throw invalid_argument("max negativo");
    }
    vector<int> cuenta(static_cast<size_t>(max) + 1, 0);
    for (int x : xs) {
        if (x < 0 || x > max) {
            throw invalid_argument("valor fuera de 0..max");
        }
        cuenta[static_cast<size_t>(x)]++;
    }
    V resultado;
    resultado.reserve(xs.size());
    for (int valor = 0; valor <= max; valor++) {
        resultado.insert(resultado.end(), static_cast<size_t>(cuenta[static_cast<size_t>(valor)]), valor);
    }
    return resultado;
}

/**
 * Ordenar personas por apellido, edad descendente y nombre.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @explicacion Se copia el vector (el original es const) y se ordena con un comparador de tres niveles. `tie` crea
 * tuplas de referencias que se comparan campo a campo (lexicográficamente), así que basta con poner en el mismo orden
 * los campos de ambos lados e INTERCAMBIAR a y b en el criterio descendente (la edad): `tie(a.apellido, b.edad,
 * a.nombre) < tie(b.apellido, a.edad, b.nombre)`. Invertir todo el comparador daría también apellido y nombre
 * descendentes.
 * @alternativas Con ranges::sort y proyecciones (C++20) o encadenando dos stable_sort (primero por el criterio menos
 * importante) se obtiene lo mismo.
 */
vector<Persona> ordenarPersonas(const vector<Persona>& personas)
{
    vector<Persona> r = personas;
    sort(r.begin(), r.end(), [](const Persona& a, const Persona& b) {
        return tie(a.apellido, b.edad, a.nombre) < tie(b.apellido, a.edad, b.nombre);
    });
    return r;
}

/**
 * Ordenar por frecuencia descendente y valor ascendente.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @explicacion Un unordered_map cuenta las apariciones en una pasada (O(n)). Después se ordena una copia del vector con
 * un comparador que consulta esa tabla: más frecuente primero y, a igualdad de frecuencia, menor valor primero. Como
 * el valor desempata, el comparador es un orden estricto total y no hace falta estabilidad. Cada elemento se repite
 * tantas veces como aparecía porque se ordenan los elementos, no los valores distintos.
 * @alternativas Ordenar los pares (valor, frecuencia) y expandirlos después es igual de rápido. Contar cada valor
 * recorriendo el vector otra vez sería O(n²).
 */
V ordenarPorFrecuencia(const V& xs)
{
    unordered_map<int, int> frecuencia;
    for (int x : xs) {
        frecuencia[x]++;
    }
    V r = xs;
    sort(r.begin(), r.end(), [&frecuencia](int a, int b) {
        int fa = frecuencia.at(a);
        int fb = frecuencia.at(b);
        return fa != fb ? fa > fb : a < b;
    });
    return r;
}

/**
 * Heap sort en el sitio.
 *
 * @complejidad Tiempo O(n log n) siempre; espacio O(1).
 * @bigo nlogn
 * @explicacion Un montículo de máximos guardado en el propio vector: los hijos de i son 2i+1 y 2i+2 y cada padre es
 * mayor que sus hijos. Fase 1 (construir): hundir cada nodo con hijos, de n/2-1 a 0, cuesta O(n) en total. Fase 2:
 * intercambiar la raíz (el mayor) con el último del montículo, reducir el montículo en uno y hundir la nueva raíz,
 * O(log n) por vuelta. Hundir = intercambiar con el mayor de los hijos mientras sea mayor que el nodo. Se usa
 * `ptrdiff_t`/`long long` para la posición para evitar restas con size_t.
 * @alternativas std::make_heap + std::sort_heap lo dan hecho. Merge sort es estable y más rápido en la práctica (mejor uso
 * de la caché), pero necesita O(n) de memoria.
 */
void heapSort(V& xs)
{
    auto hundir = [&xs](size_t i, size_t tam) {
        while (true) {
            size_t mayor = i;
            size_t izq = 2 * i + 1;
            size_t der = 2 * i + 2;
            if (izq < tam && xs[izq] > xs[mayor]) {
                mayor = izq;
            }
            if (der < tam && xs[der] > xs[mayor]) {
                mayor = der;
            }
            if (mayor == i) {
                return;
            }
            swap(xs[i], xs[mayor]);
            i = mayor;
        }
    };
    size_t n = xs.size();
    for (size_t i = n / 2; i > 0; i--) {
        hundir(i - 1, n);
    }
    for (size_t fin = n; fin > 1; fin--) {
        swap(xs[0], xs[fin - 1]);
        hundir(0, fin - 1);
    }
}

/**
 * Contar inversiones con merge sort.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @bigo nlogn
 * @explicacion Se cuentan las inversiones de cada mitad (recursivo) y las que cruzan entre ambas mientras se mezclan:
 * cuando se toma un elemento de la mitad DERECHA antes de que se agoten los de la izquierda, es menor que TODOS los que
 * quedan a la izquierda (están ordenados), así que forma tantas inversiones como elementos queden en la izquierda. Con
 * `<=` al tomar de la izquierda, los iguales no cuentan. El acumulador es long long: el máximo n(n-1)/2 desborda un
 * int para n ≈ 65.000.
 * @alternativas Un árbol de Fenwick con compresión de coordenadas también da O(n log n). Dos bucles anidados: O(n²).
 */
long long contarInversiones(const V& xs)
{
    V trabajo = xs;
    V auxiliar(xs.size());
    auto ordenarYContar = [&](auto&& self, size_t desde, size_t hasta) -> long long {
        if (hasta - desde <= 1) {
            return 0;
        }
        size_t medio = desde + (hasta - desde) / 2;
        long long total = self(self, desde, medio) + self(self, medio, hasta);
        size_t i = desde;
        size_t j = medio;
        size_t k = desde;
        while (i < medio && j < hasta) {
            if (trabajo[i] <= trabajo[j]) {
                auxiliar[k++] = trabajo[i++];
            } else {
                auxiliar[k++] = trabajo[j++];
                total += static_cast<long long>(medio - i);
            }
        }
        while (i < medio) {
            auxiliar[k++] = trabajo[i++];
        }
        while (j < hasta) {
            auxiliar[k++] = trabajo[j++];
        }
        copy(auxiliar.begin() + static_cast<ptrdiff_t>(desde), auxiliar.begin() + static_cast<ptrdiff_t>(hasta), trabajo.begin() + static_cast<ptrdiff_t>(desde));
        return total;
    };
    return ordenarYContar(ordenarYContar, 0, trabajo.size());
}

/**
 * Bandera holandesa: ordenar ceros, unos y doses en una pasada.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion Invariante: [0, bajo) son ceros, [bajo, medio) unos, (alto, fin) doses y [medio, alto] está sin examinar.
 * Un 0 se intercambia con el primer uno (en `bajo`) y avanzan ambos; un 1 está bien y solo avanza `medio`; un 2 se
 * intercambia con el último sin examinar (`alto`) y retrocede `alto` SIN avanzar `medio`, porque el elemento que llega
 * aún no se ha mirado. Cada elemento se examina como mucho una vez. Se usan índices con signo (long long) porque `alto`
 * puede bajar de 0 con un vector vacío.
 * @alternativas Contar los tres valores y reescribir (counting sort) también es O(n) pero con dos pasadas. Es la partición
 * en tres de quick sort.
 */
void banderaHolandesa(V& xs)
{
    long long bajo = 0;
    long long medio = 0;
    long long alto = static_cast<long long>(xs.size()) - 1;
    while (medio <= alto) {
        int& actual = xs[static_cast<size_t>(medio)];
        if (actual == 0) {
            swap(actual, xs[static_cast<size_t>(bajo)]);
            bajo++;
            medio++;
        } else if (actual == 1) {
            medio++;
        } else if (actual == 2) {
            swap(actual, xs[static_cast<size_t>(alto)]);
            alto--;
        } else {
            throw invalid_argument("solo se admiten 0, 1 y 2");
        }
    }
}
