#include <algorithm>
#include <array>
#include <functional>
#include <iostream>
#include <list>
#include <map>
#include <numeric>
#include <ranges>
#include <stdexcept>
#include <string>
#include <tuple>
#include <unordered_map>
#include <vector>
using namespace std;

/*
 * TEMA 5 · ORDENACIÓN
 * ────────────────────────────────────────────────────────────────────────────
 * Ordenar es el problema «de laboratorio» de los algoritmos: hay muchas soluciones y cada una enseña una idea.
 * En la práctica (y en un concurso) casi siempre usarás std::sort, que está en C++ optimizado a mano, pero
 * entender los algoritmos te enseña a razonar sobre coste, estabilidad y memoria, y es la base de muchos otros
 * problemas (contar inversiones, k-ésimo elemento, mezclar listas...).
 *
 *   Algoritmo        Mejor      Medio       Peor        Memoria   Estable
 *   burbuja          O(n)       O(n²)       O(n²)       O(1)      sí
 *   inserción        O(n)       O(n²)       O(n²)       O(1)      sí
 *   merge sort       O(n log n) O(n log n)  O(n log n)  O(n)      sí
 *   quick sort       O(n log n) O(n log n)  O(n²)       O(log n)  no (típico)
 *   heap sort        O(n log n) O(n log n)  O(n log n)  O(1)      no
 *   counting sort    O(n + k)   O(n + k)    O(n + k)    O(k)      sí (con cuidado)
 *   std::sort        O(n log n) O(n log n)  O(n log n)  O(log n)  no   (introsort, ver sección 4)
 *   std::stable_sort O(n log n) O(n log n)  O(n log n)  O(n)      sí   (merge sort)
 *
 * «Estable» = los elementos que empatan conservan el orden que tenían. Importa cuando ordenas por un criterio y
 * luego por otro (por ejemplo, por ciudad y, dentro de cada ciudad, el orden en que se apuntaron).
 *
 * Cota inferior: cualquier ordenación basada en COMPARAR elementos necesita Ω(n log n) comparaciones en el peor
 * caso (hay n! ordenaciones posibles y cada comparación descarta como mucho la mitad: log₂(n!) ≈ n log n). Solo
 * se "salta" ese límite no comparando: counting sort, radix sort...
 *
 * Desde Java:   Arrays.sort / List.sort → std::sort / std::stable_sort. Ojo: sort es INESTABLE (en Java, sort de
 *               objetos es estable) y el comparador devuelve bool («¿a va antes que b?»), no un int negativo/cero/positivo.
 * Desde PHP:    sort/usort → std::sort con o sin comparador. Aquí ordenar es siempre EN EL SITIO y con iteradores
 *               [inicio, fin): no existe «devolver un array nuevo ordenado» (haz antes una copia).
 * Desde Python: sorted(xs, key=...) → copia + sort con comparador; list.sort() (estable, Timsort) → stable_sort.
 *               No hay parámetro key: se escribe la lambda de comparación, o con ranges::sort una proyección.
 * Desde C:      qsort(base, n, tamaño, cmp) recibe un puntero a función que devuelve int y va con void*; std::sort
 *               está plantillizado, así que el compilador integra la comparación (lambda) en el propio algoritmo
 *               y suele ser 2-5 veces más rápido que qsort.
 *
 * Cómo se trabaja aquí
 *  - Pulsa Ctrl+Enter para ejecutar: verás las secciones de teoría y las pruebas de los ejercicios.
 *  - Cada ejercicio tiene un cuerpo «return pendiente();»: sustitúyelo por tu código y vuelve a ejecutar.
 *  - Ctrl+S guarda tu progreso. El botón «Solución» compara tu versión con la de referencia.
 *  - «Medir» (Ctrl+Alt+Enter) calcula experimentalmente el coste O() de los ejercicios marcados.
 */

using V = vector<int>;
using VS = vector<string>;

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

/** n números pseudoaleatorios en 0..max (siempre los mismos): para las pruebas y para medir. */
V datos(int n, int max)
{
    return aleatorios(n, max, 12345);
}

/** Una persona para ordenar por varios criterios. */
struct Persona {
    string nombre;
    string apellido;
    int edad;
    bool operator==(const Persona&) const = default;
};

ostream& operator<<(ostream& os, const Persona& p)
{
    return os << p.nombre << " " << p.apellido << "(" << p.edad << ")";
}

/** Un registro con una etiqueta para ver si el orden de los empates se conserva. */
struct Registro {
    int clave;
    char etiqueta;
};

/** La burbuja con la lista tras cada pasada: para VER cómo el mayor «sube» al final. Trabaja sobre su copia. */
V burbujaConTraza(V xs)
{
    size_t n = xs.size();
    int comparaciones = 0;
    for (size_t pasada = 1; pasada < n; pasada++) {
        bool cambio = false;
        for (size_t i = 0; i + pasada < n; i++) {
            comparaciones++;
            if (xs[i] > xs[i + 1]) {
                swap(xs[i], xs[i + 1]);               // swap intercambia dos valores (sin variable temporal a mano)
                cambio = true;
            }
        }
        cout << "pasada " << pasada << ": " << mostrar(xs) << "\n";
        if (!cambio) {                                // optimización: ya está ordenado
            break;
        }
    }
    cout << "comparaciones: " << comparaciones << "\n";
    return xs;
}

/** Quick sort ingenuo: pivote = el PRIMER elemento. Cuenta las comparaciones. Con datos ya ordenados se degrada a O(n²). */
void quickIngenuo(V& xs, int desde, int hasta, long long& comparaciones)
{
    if (desde >= hasta) {
        return;
    }
    int pivote = xs[static_cast<size_t>(desde)];
    int i = desde;
    for (int j = desde + 1; j <= hasta; j++) {
        comparaciones++;
        if (xs[static_cast<size_t>(j)] < pivote) {
            i++;
            swap(xs[static_cast<size_t>(i)], xs[static_cast<size_t>(j)]);
        }
    }
    swap(xs[static_cast<size_t>(desde)], xs[static_cast<size_t>(i)]);
    quickIngenuo(xs, desde, i - 1, comparaciones);
    quickIngenuo(xs, i + 1, hasta, comparaciones);
}

/** Formatea con punto de millar: 1234567 → 1.234.567. */
string miles(long long n)
{
    string s = to_string(n);
    string r;
    int cuenta = 0;
    for (auto it = s.rbegin(); it != s.rend(); ++it) {
        if (cuenta > 0 && cuenta % 3 == 0) {
            r.insert(r.begin(), '.');
        }
        r.insert(r.begin(), *it);
        cuenta++;
    }
    return r;
}

/** ¿Conserva `salida` el orden de aparición de las etiquetas dentro de cada clave? (para comprobar la estabilidad) */
bool esEstable(const vector<Registro>& salida)
{
    for (size_t i = 1; i < salida.size(); i++) {
        if (salida[i - 1].clave == salida[i].clave && salida[i - 1].etiqueta > salida[i].etiqueta) {
            return false;                              // las etiquetas se asignaron en orden creciente
        }
    }
    return true;
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · burbuja ───────────────────────────────────────────────────
/**
 * Ordenación de la burbuja con parada anticipada: si en una pasada completa no se intercambia nada,
 * la lista ya está ordenada y se termina (así una lista ordenada cuesta O(n) y no O(n²)).
 * Recibe `const V&` (no se puede tocar): trabaja sobre una COPIA (`V r = xs;`) y devuélvela.
 * Trampa: con índices size_t, `n - 1` con n = 0 da 18 trillones. Comprueba antes el caso vacío.
 */
V burbuja(const V& xs)
{
    return pendiente();
}

// ── Ejercicio 2 · insercion ─────────────────────────────────────────────────
/**
 * Ordenación por inserción: mantén una parte izquierda ya ordenada e inserta cada nuevo elemento en su sitio,
 * desplazando los mayores una posición a la derecha. Es la que usan las librerías para tramos pequeños (std::sort
 * cambia a inserción por debajo de ~16 elementos) y la mejor con datos casi ordenados.
 * Trampa: el bucle interno `while (j >= 0 && ...)` con un j de tipo size_t nunca llega a ser negativo.
 */
V insercion(const V& xs)
{
    return pendiente();
}

// ── Ejercicio 3 · mergeSort ─────────────────────────────────────────────────
/**
 * Merge sort (divide y vencerás): parte el vector por la mitad, ordena cada mitad y mézclalas.
 * Debe ser ESTABLE y aceptar un comparador `comparar(a, b)` = «¿a va antes que b?» (por defecto `less<>`, el
 * operador <). Al mezclar, a igualdad toma SIEMPRE el elemento de la mitad izquierda: solo así es estable.
 * Para eso la condición es `!comparar(derecha, izquierda)`, no `comparar(izquierda, derecha)`.
 */
template <class T, class Comparador = less<>>
vector<T> mergeSort(const vector<T>& xs, Comparador comparar = {})
{
    return pendiente();
}

// ── Ejercicio 4 · quickSort ─────────────────────────────────────────────────
/**
 * Quick sort: elige un pivote (el elemento central), reparte el resto en menores, iguales y mayores,
 * y ordena recursivamente menores y mayores. Con «iguales» aparte, los vectores con muchos repetidos no se degradan.
 * (Versión didáctica con vectores auxiliares; la real parte el vector en el sitio y consume O(log n) de memoria.)
 */
V quickSort(const V& xs)
{
    return pendiente();
}

// ── Ejercicio 5 · countingSort ──────────────────────────────────────────────
/**
 * Ordenación por conteo para enteros en el rango 0..max: cuenta cuántas veces aparece cada valor y reconstruye
 * el vector. No compara elementos, así que se salta el límite O(n log n): cuesta O(n + max).
 * Un valor fuera de 0..max (o un max negativo) lanza invalid_argument.
 * Trampa: vector<int> cuenta(max + 1) con max negativo se convierte a size_t... y pide una cantidad enorme de memoria.
 */
V countingSort(const V& xs, int max)
{
    return pendiente();
}

// ── Ejercicio 6 · ordenarPersonas ───────────────────────────────────────────
/**
 * Ordena personas por varios criterios a la vez: apellido ascendente, luego edad DESCENDENTE, luego nombre
 * ascendente. Aquí SÍ puedes usar sort con una lambda: la clave está en el comparador de varios niveles,
 * por ejemplo con `tie`: para cada criterio descendente intercambia a y b en la tupla
 * (`tie(a.apellido, b.edad, a.nombre) < tie(b.apellido, a.edad, b.nombre)`).
 * Devuelve un vector NUEVO, sin modificar el original (recibe const&).
 */
vector<Persona> ordenarPersonas(const vector<Persona>& personas)
{
    return pendiente();
}

// ── Ejercicio 7 · ordenarPorFrecuencia ──────────────────────────────────────
/**
 * Ordena un vector de enteros por frecuencia (los que más se repiten, primero) y, a igual frecuencia,
 * por valor ascendente. Los elementos se repiten en el resultado tantas veces como aparecían.
 *   [4, 6, 2, 6, 4, 4, 6]  →  [4, 4, 4, 6, 6, 6, 2]
 * Alternativa ingenua: contar cada valor recorriendo el vector otra vez, O(n²). Con un unordered_map de
 * frecuencias y un comparador que lo consulte es O(n log n).
 */
V ordenarPorFrecuencia(const V& xs)
{
    return pendiente();
}

// ── Ejercicio 8 · heapSort (extra de C++) ───────────────────────────────────
/**
 * Heap sort EN EL SITIO (void), sin memoria extra: (1) convierte el vector en un montículo de máximos
 * (para i desde n/2-1 hasta 0: «hundir» el nodo i); (2) repite: intercambia la raíz (el mayor) con el último
 * elemento del montículo, reduce el montículo en uno y hunde la nueva raíz. Cuesta O(n log n) SIEMPRE.
 * Hijos de i: 2i+1 y 2i+2. «Hundir» = mientras algún hijo sea mayor, intercambiar con el mayor de los hijos.
 * Prohibido llamar a sort_heap / make_heap: implementa tú el hundimiento (std::sort usa este algoritmo
 * como red de seguridad cuando el quick sort se degrada: ver sección 4).
 */
void heapSort(V& xs)
{
    pendiente();
}

// ── Ejercicio 9 · contarInversiones (extra de C++) ──────────────────────────
/**
 * Cuenta las inversiones de un vector: los pares (i, j) con i < j y xs[i] > xs[j]. Mide cuánto «desorden» hay:
 * 0 si está ordenado, n(n-1)/2 si está del revés. Los iguales no cuentan como inversión.
 * La fuerza bruta (dos bucles) es O(n²). Hazlo en O(n log n) con un merge sort que cuente: al mezclar, cada vez
 * que pasa un elemento de la mitad DERECHA antes que los que quedan en la izquierda, suma esos que quedan.
 * Devuelve long long: con n = 10⁵ el máximo ronda 5·10⁹ y un int desbordaría (UB).
 */
long long contarInversiones(const V& xs)
{
    return pendiente();
}

// ── Ejercicio 10 · banderaHolandesa (extra de C++) ──────────────────────────
/**
 * Bandera holandesa (Dijkstra): ordena EN EL SITIO un vector que solo contiene 0, 1 y 2 con UNA sola pasada y
 * O(1) de memoria. Es la partición en tres de quick sort. Tres índices: `bajo` (todo lo anterior son ceros),
 * `medio` (el que se examina) y `alto` (todo lo posterior son doses). Si xs[medio] es 0 → intercambia con bajo y
 * avanza ambos; si es 1 → avanza medio; si es 2 → intercambia con alto y retrocede alto SIN avanzar medio
 * (el que llega aún no está examinado). Un valor distinto de 0, 1 y 2 lanza invalid_argument.
 */
void banderaHolandesa(V& xs)
{
    pendiente();
}

/**
 * Las mismas pruebas para los cuatro algoritmos de ordenación de enteros (así no se repite el bloque cuatro
 * veces). Es una macro solo por comodidad: prueba(fn, ...) necesita el NOMBRE de la función sin comillas.
 */
#define PRUEBAS_ORDENACION(fn)                                                                      \
    prueba(fn,                                                                                      \
        caso("vacía", V{}, V{}),                                                                    \
        caso("un elemento", V{7}, V{7}),                                                            \
        caso("ya ordenada", V{1, 2, 3, 4, 5}, V{1, 2, 3, 4, 5}),                                    \
        caso("inversa", V{1, 2, 3, 4, 5}, V{5, 4, 3, 2, 1}),                                        \
        caso("con repetidos", V{1, 1, 2, 3, 3, 3}, V{3, 1, 3, 2, 1, 3}),                            \
        caso("negativos", V{-5, -1, 0, 2, 3}, V{0, -5, 3, -1, 2}),                                  \
        caso("todos iguales", V{4, 4, 4, 4}, V{4, 4, 4, 4}),                                        \
        caso("dos elementos", V{1, 2}, V{2, 1}));                                                   \
    grupo(#fn "()");                                                                                \
    comprueba("500 números aleatorios", [&] {                                                       \
        V entrada = datos(500, 100000);                                                             \
        V esperado = entrada;                                                                       \
        sort(esperado.begin(), esperado.end());                                                     \
        return fn(entrada) == esperado;                                                             \
    }, true);                                                                                       \
    comprueba("no modifica el vector original", [&] {                                               \
        V entrada = {3, 1, 2};                                                                      \
        fn(entrada);                                                                                \
        return entrada;                                                                             \
    }, V{3, 1, 2});

int main()
{

// ════════════════════════════════════════════════════════════════════════════
// 1. LA FAMILIA sort() DE C++
// ════════════════════════════════════════════════════════════════════════════
    // Todas ordenan EN EL SITIO (modifican lo que les pasas) y trabajan con un rango de iteradores [inicio, fin).
    // No devuelven el vector ordenado: para conservar el original, haz antes una copia.
    //
    //   sort(b, e)               O(n log n), inestable. Necesita iteradores de acceso aleatorio (vector, array, deque).
    //   sort(b, e, comp)         lo mismo con tu comparador: comp(a, b) = «¿a va ANTES que b?» (orden débil estricto).
    //   stable_sort(b, e, comp)  estable. O(n log n) si hay memoria extra (la pide); si no, O(n log² n).
    //   partial_sort(b, m, e)    deja ordenados los m-b primeros y el resto, sin orden: O(n log m).
    //   nth_element(b, n, e)     coloca en su sitio el n-ésimo (los menores antes, los mayores después): O(n) medio.
    //   is_sorted(b, e)          ¿ya está ordenado? O(n).
    //   list::sort()             las listas enlazadas no tienen acceso aleatorio: usan su propio método (estable).
    //   ranges::sort(v, comp, proyección)    versión C++20 sobre el contenedor entero, con proyección.
    titulo("1. La familia sort()");

    V numeros = {10, 9, 2, 33, 1};
    V copia = numeros;                                // una copia: sort modifica el original
    sort(copia.begin(), copia.end());
    cout << "original: " << mostrar(numeros) << " · ordenado: " << mostrar(copia) << "\n";
    sort(copia.begin(), copia.end(), greater<int>());   // descendente: greater<> es un comparador ya hecho
    cout << "descendente con greater<int>: " << mostrar(copia) << "\n";
    sort(copia.rbegin(), copia.rend());               // ¡también! ordenar el rango inverso lo deja descendente
    cout << "con rbegin/rend: " << mostrar(copia) << "\n";
    sort(numeros.begin(), numeros.begin() + 3);       // solo los 3 primeros
    cout << "solo el tramo [0, 3): " << mostrar(numeros) << "\n";

    int viejo[] = {5, 2, 9, 1};                       // un array de C: el «fin» es viejo + tamaño
    sort(viejo, viejo + 4);
    cout << "array de C ordenado: " << viejo[0] << " " << viejo[1] << " " << viejo[2] << " " << viejo[3] << "\n";
    array<int, 4> fijo = {5, 2, 9, 1};
    ranges::sort(fijo);                               // C++20: sin begin()/end()
    cout << "array<int,4> con ranges::sort: " << mostrar(fijo) << "\n";
    list<int> enlazada = {4, 2, 3, 1};
    enlazada.sort();                                  // sort(enlazada.begin(), enlazada.end()) NO compila: no hay acceso aleatorio
    cout << "list::sort: " << mostrar(enlazada) << "\n";

    // Los pares y las tuplas se ordenan solos: comparan campo a campo (primero, luego segundo...).
    vector<pair<int, string>> pares = {{2, "b"}, {1, "z"}, {2, "a"}};
    sort(pares.begin(), pares.end());
    cout << "pares ordenados (primero por .first, luego por .second): " << mostrar(pares) << "\n";

    // Un mapa no se ordena: se ordenan sus pares (por valor, por clave...) en otro contenedor. Lo ves en el tema 3.
    // Comparadores: el comparador devuelve bool (¿a va antes?). Varias formas de escribirlo:
    VS palabras = {"kiwi", "fresa", "pera", "uva"};
    sort(palabras.begin(), palabras.end(), [](const string& a, const string& b) {
        return a.size() != b.size() ? a.size() < b.size() : a < b;      // por longitud y luego alfabético
    });
    cout << "por longitud y luego alfabético: " << mostrar(palabras) << "\n";
    VS conMayusculas = {"banana", "Zebra", "apple", "Árbol"};
    sort(conMayusculas.begin(), conMayusculas.end());
    cout << "orden natural de strings: " << mostrar(conMayusculas) << "   (compara bytes: las mayúsculas y la Á van antes)\n";
    VS textoNumeros = {"10", "9", "2", "1"};
    sort(textoNumeros.begin(), textoNumeros.end());
    cout << "números como texto: " << mostrar(textoNumeros) << " (\"10\" < \"2\")\n";
    sort(textoNumeros.begin(), textoNumeros.end(), [](const string& a, const string& b) { return stoi(a) < stoi(b); });
    cout << "como números: " << mostrar(textoNumeros) << "\n";

    // Trampa 1: restar para comparar. Con enteros CON signo, a - b puede desbordar y eso es UB (no solo da un
    // signo equivocado): ni se te ocurra escribir [](int a, int b) { return a - b < 0; }. Compara con <.
    // Trampa 2: el comparador debe ser un ORDEN DÉBIL ESTRICTO. Con <= (o con un comparador que dice "a va antes
    // que b" Y "b va antes que a") std::sort puede leer fuera del vector o colgarse: comportamiento indefinido,
    // y solo falla con ciertos datos. Regla: comp(x, x) siempre es false.
    //      sort(v.begin(), v.end(), [](int a, int b) { return a <= b; });     // ¡MAL! (UB con repetidos)
    // Trampa 3: sort necesita que el comparador sea coherente durante la ordenación: no cambies datos desde dentro.

    // Otras operaciones sobre rangos ordenados: se aprovechan en búsquedas (tema 6)
    V ordenado = {1, 3, 3, 5, 8};
    cout << "is_sorted: " << is_sorted(ordenado.begin(), ordenado.end()) << " · lower_bound(3) en el índice "
         << lower_bound(ordenado.begin(), ordenado.end(), 3) - ordenado.begin() << "\n";

    // partial_sort y nth_element: cuando NO necesitas todo ordenado
    V grande = datos(20, 100);
    V parcial = grande;
    partial_sort(parcial.begin(), parcial.begin() + 3, parcial.end());   // los 3 menores, ordenados
    cout << "los 3 menores (partial_sort): " << parcial[0] << " " << parcial[1] << " " << parcial[2] << "\n";
    V mediana = grande;
    nth_element(mediana.begin(), mediana.begin() + 10, mediana.end());
    V comprobacion = grande;
    sort(comprobacion.begin(), comprobacion.end());
    cout << "la «mediana» con nth_element en O(n): " << mediana[10] << " (ordenando todo: " << comprobacion[10] << ")\n";

// ════════════════════════════════════════════════════════════════════════════
// 2. ESTABILIDAD
// ════════════════════════════════════════════════════════════════════════════
    // stable_sort conserva el orden relativo de los elementos que empatan. std::sort NO lo garantiza: con pocos
    // elementos suele parecer estable (usa inserción), pero con más datos los empatados se desordenan.
    titulo("2. Estabilidad");

    vector<Registro> registros;
    for (int i = 0; i < 40; i++) {
        registros.push_back({i % 3, static_cast<char>('A' + i % 26)});        // etiqueta creciente: A, B, C... en orden de entrada
    }
    // (con 40 > 26 la etiqueta vuelve a 'A' tras 'Z'; basta comprobar solo dentro de los primeros 26)
    registros.resize(26);
    auto porClave = [](const Registro& a, const Registro& b) { return a.clave < b.clave; };
    vector<Registro> conSort = registros;
    sort(conSort.begin(), conSort.end(), porClave);
    vector<Registro> conStable = registros;
    stable_sort(conStable.begin(), conStable.end(), porClave);
    cout << "sort estable: " << (esEstable(conSort) ? "sí (de casualidad)" : "NO") << " · stable_sort estable: " << (esEstable(conStable) ? "sí" : "NO") << "\n";
    cout << "stable_sort:";
    for (const auto& r : conStable) {
        cout << " " << r.clave << r.etiqueta;
    }
    cout << "\n";

    // Ordenar por varios criterios a base de ordenaciones ESTABLES: primero por el criterio secundario, luego por
    // el principal. (Es lo que hace el comparador de varios niveles de ordenarPersonas, pero en dos pasadas.)
    vector<Persona> gente = {{"Ana", "Gil", 30}, {"Luis", "Gil", 25}, {"Eva", "Gil", 30}, {"Pau", "Gil", 25}};
    stable_sort(gente.begin(), gente.end(), [](const Persona& a, const Persona& b) { return a.edad < b.edad; });
    cout << "estable por edad:";
    for (const auto& p : gente) {
        cout << " " << p.nombre;
    }
    cout << "   ← Luis antes que Pau, Ana antes que Eva (como entraron)\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. VER A LA BURBUJA TRABAJAR
// ════════════════════════════════════════════════════════════════════════════
    // La burbuja compara vecinos y los intercambia; en cada pasada, el mayor «sube» al final.
    titulo("3. Una burbuja paso a paso");

    burbujaConTraza({5, 1, 4, 2, 8});

// ════════════════════════════════════════════════════════════════════════════
// 4. CUÁNTO CRECE EL TRABAJO
// ════════════════════════════════════════════════════════════════════════════
    // Contamos las comparaciones que hace el std::sort nativo (O(n log n)) frente a lo que haría un
    // algoritmo O(n²): al multiplicar n por 10, n log n se multiplica por ~13 y n² por 100.
    titulo("4. n log n frente a n²");

    for (int n : {100, 1000, 10000}) {
        V lista = datos(n, 1'000'000);
        long long comparaciones = 0;
        sort(lista.begin(), lista.end(), [&comparaciones](int x, int y) {
            comparaciones++;
            return x < y;
        });
        cout << "n = " << n << "   sort() hizo " << miles(comparaciones) << " comparaciones   (un O(n²) haría ~" << miles(static_cast<long long>(n) * n / 2) << ")\n";
    }

    // ── Por qué std::sort es un «introsort»
    // El quick sort es el más rápido en promedio, pero con un mal pivote se degrada a O(n²) (por ejemplo, con el
    // primer elemento de datos ya ordenados). std::sort combina tres algoritmos para no tener nunca ese problema:
    //   1. QUICK SORT con pivote «mediana de tres» (primero, central, último): el caso normal.
    //   2. Si la recursión se hace demasiado profunda (> 2·log₂ n), la partición está yendo mal: cambia a HEAP SORT
    //      para ese tramo, que garantiza O(n log n) en el peor caso. (Intro-spective sort: se vigila a sí mismo.)
    //   3. Para tramos pequeños (≤ 16 elementos) usa INSERCIÓN, más rápida que la recursión con pocos datos.
    // Resultado: O(n log n) garantizado en tiempo, O(log n) de pila, en el sitio. Su precio: no es estable.
    // Comparamos un quick sort ingenuo con el sort de la STL sobre datos ordenados, invertidos e iguales:
    const int tam = 3000;
    V ordenadoN, invertidoN, igualesN;
    for (int i = 0; i < tam; i++) {
        ordenadoN.push_back(i);
        invertidoN.push_back(tam - i);
        igualesN.push_back(7);
    }
    cout << "comparaciones con n = " << tam << ":\n";
    cout << "   datos               quick ingenuo (pivote = 1.º)    std::sort (introsort)\n";
    auto fila = [&](const string& nombre, V entrada) {
        V paraSort = entrada;
        long long ingenuo = 0;
        quickIngenuo(entrada, 0, static_cast<int>(entrada.size()) - 1, ingenuo);
        long long estandar = 0;
        sort(paraSort.begin(), paraSort.end(), [&estandar](int x, int y) {
            estandar++;
            return x < y;
        });
        cout << "   " << nombre << string(20 - nombre.size(), ' ') << miles(ingenuo) << string(32 - miles(ingenuo).size(), ' ') << miles(estandar) << "\n";
    };
    fila("aleatorios", datos(tam, 1'000'000));
    fila("ya ordenados", ordenadoN);
    fila("al revés", invertidoN);
    fila("todos iguales", igualesN);
    cout << "(el ingenuo se va a ~n²/2 = " << miles(static_cast<long long>(tam) * tam / 2) << " con datos ordenados o iguales; el introsort no se inmuta)\n";
    // Ojo: la recursión del ingenuo con datos ordenados llega a n niveles de profundidad: con n = 10⁶ reventaría la
    // pila. El introsort acota la profundidad a O(log n) recursando primero en la parte pequeña.

    // ── Cuál usar
    //  · Lo normal: std::sort. Si necesitas estabilidad: std::stable_sort.
    //  · Solo los k primeros o el k-ésimo: partial_sort / nth_element (más rápidos que ordenar todo).
    //  · Enteros pequeños (rango acotado): counting sort, O(n + k).
    //  · Datos casi ordenados: la inserción es O(n + inversiones); stable_sort/Timsort se aprovechan, std::sort no.
    //  · Mezclar dos ya ordenados: std::merge / inplace_merge, O(n). Conjuntos ordenados: set_union, set_intersection.

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

    PRUEBAS_ORDENACION(burbuja)
    PRUEBAS_ORDENACION(insercion)
    PRUEBAS_ORDENACION(mergeSort)
    PRUEBAS_ORDENACION(quickSort)

    grupo("mergeSort()");
    comprueba("es estable", [&] {
        vector<Registro> filas = {{1, 'a'}, {0, 'b'}, {1, 'c'}, {0, 'd'}};
        string r;
        for (const auto& f : mergeSort(filas, [](const Registro& x, const Registro& y) { return x.clave < y.clave; })) {
            r += f.etiqueta;
        }
        return r;
    }, string("bdac"));
    comprueba("acepta un comparador (descendente)", [&] { return mergeSort(V{1, 3, 2}, greater<int>()); }, V{3, 2, 1});
    comprueba("ordena textos", [&] { return mergeSort(VS{"pera", "uva", "fresa"}); }, VS{"fresa", "pera", "uva"});
    comprueba("estable con muchos empates", [&] {
        vector<Registro> filas;
        for (int i = 0; i < 26; i++) {
            filas.push_back({i % 3, static_cast<char>('A' + i)});
        }
        return esEstable(mergeSort(filas, [](const Registro& x, const Registro& y) { return x.clave < y.clave; }));
    }, true);

    prueba(countingSort,
        caso("básica", V{0, 1, 1, 2, 3}, V{3, 1, 2, 1, 0}, 3),
        caso("vacía", V{}, V{}, 5),
        caso("repetidos", V{2, 2, 2}, V{2, 2, 2}, 2),
        caso("rango mayor que los datos", V{1, 5}, V{5, 1}, 100),
        caso("max = 0", V{0, 0}, V{0, 0}, 0));
    grupo("countingSort()");
    lanza("valor fuera de rango", [&] { countingSort(V{1, 9}, 5); }, invalid_argument);
    lanza("negativo", [&] { countingSort(V{-1, 2}, 5); }, invalid_argument);
    lanza("max negativo", [&] { countingSort(V{}, -1); }, invalid_argument);
    comprueba("1000 números en 0..50", [&] {
        V entrada = datos(1000, 50);
        V esperado = entrada;
        sort(esperado.begin(), esperado.end());
        return countingSort(entrada, 50) == esperado;
    }, true);

    prueba(ordenarPersonas,
        caso("por apellido",
            vector<Persona>{{"Ana", "García", 30}, {"Luis", "Pérez", 25}},
            vector<Persona>{{"Luis", "Pérez", 25}, {"Ana", "García", 30}}),
        caso("mismo apellido: edad descendente",
            vector<Persona>{{"Eva", "Ruiz", 40}, {"Ana", "Ruiz", 20}},
            vector<Persona>{{"Ana", "Ruiz", 20}, {"Eva", "Ruiz", 40}}),
        caso("mismo apellido y edad: nombre ascendente",
            vector<Persona>{{"Ana", "Ruiz", 30}, {"Zoe", "Ruiz", 30}},
            vector<Persona>{{"Zoe", "Ruiz", 30}, {"Ana", "Ruiz", 30}}),
        caso("vacía", vector<Persona>{}, vector<Persona>{}));
    grupo("ordenarPersonas()");
    comprueba("no modifica la original", [&] {
        vector<Persona> original = {{"Zoe", "Ruiz", 30}, {"Ana", "Gil", 20}};
        ordenarPersonas(original);
        return original;
    }, vector<Persona>{{"Zoe", "Ruiz", 30}, {"Ana", "Gil", 20}});

    prueba(ordenarPorFrecuencia,
        caso("ejemplo", V{4, 4, 4, 6, 6, 6, 2}, V{4, 6, 2, 6, 4, 4, 6}),
        caso("sin repetidos: por valor", V{1, 2, 3}, V{3, 1, 2}),
        caso("un valor domina", V{2, 2, 2, 1, 3}, V{1, 2, 2, 3, 2}),
        caso("vacía", V{}, V{}),
        caso("negativos", V{-1, -1, 5, 5, 0}, V{-1, 5, -1, 5, 0}));

    prueba(heapSort,
        caso("vacía", V{}, V{}),
        caso("un elemento", V{7}, V{7}),
        caso("inversa", V{1, 2, 3, 4, 5, 6, 7}, V{7, 6, 5, 4, 3, 2, 1}),
        caso("repetidos", V{1, 1, 2, 3, 3, 3}, V{3, 1, 3, 2, 1, 3}),
        caso("negativos", V{-5, -1, 0, 2, 3}, V{0, -5, 3, -1, 2}),
        caso("ya ordenada", V{1, 2, 3}, V{1, 2, 3}));
    grupo("heapSort()");
    comprueba("500 números aleatorios", [&] {
        V entrada = datos(500, 100000);
        V esperado = entrada;
        sort(esperado.begin(), esperado.end());
        heapSort(entrada);
        return entrada == esperado;
    }, true);

    prueba(contarInversiones,
        caso("ordenado: ninguna", 0LL, V{1, 2, 3, 4}),
        caso("al revés: n(n-1)/2", 6LL, V{4, 3, 2, 1}),
        caso("mezclado", 3LL, V{2, 4, 1, 3, 5}),
        caso("los iguales no cuentan", 2LL, V{2, 2, 1}),
        caso("vacío", 0LL, V{}),
        caso("un elemento", 0LL, V{9}));
    grupo("contarInversiones()");
    comprueba("1000 elementos al revés", [&] {
        V entrada;
        for (int i = 1000; i > 0; i--) {
            entrada.push_back(i);
        }
        return contarInversiones(entrada);
    }, 499500LL);
    comprueba("100000 al revés: no desborda un int", [&] {
        V entrada;
        for (int i = 100000; i > 0; i--) {
            entrada.push_back(i);
        }
        return contarInversiones(entrada);
    }, 4999950000LL);

    prueba(banderaHolandesa,
        caso("mezcla", V{0, 0, 1, 1, 2, 2}, V{2, 0, 1, 2, 0, 1}),
        caso("ya ordenada", V{0, 1, 2}, V{0, 1, 2}),
        caso("solo dos valores", V{0, 0, 2}, V{2, 0, 0}),
        caso("todos iguales", V{1, 1, 1}, V{1, 1, 1}),
        caso("vacía", V{}, V{}),
        caso("doses delante", V{0, 1, 1, 2, 2, 2}, V{2, 2, 2, 1, 1, 0}));
    grupo("banderaHolandesa()");
    lanza("valor inválido", [&] {
        V xs = {0, 3, 1};
        banderaHolandesa(xs);
    }, invalid_argument);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // Verás O(n²) para burbuja e inserción y O(n log n) para merge y quick sort. Los datos son pseudoaleatorios
    // pero siempre los mismos, para que las mediciones sean comparables.
    medir(burbuja, datos(n_, 1'000'000));
}
