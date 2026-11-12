#include <algorithm>
#include <bit>
#include <climits>
#include <cstdint>
#include <iostream>
#include <map>
#include <numeric>
#include <optional>
#include <set>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 15 · TABLAS HASH PROPIAS Y ÁRBOLES EQUILIBRADOS
 * ────────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA: `unordered_map` y `set` ya existen (tema 3), pero un buen ingeniero sabe qué hay dentro: por qué una búsqueda
 * cuesta O(1) «de media» y qué la puede arruinar, y por qué un árbol de búsqueda necesita equilibrarse para dar O(log n)
 * y no degenerar en una lista de O(n). Aquí construyes las dos estructuras con tus manos.
 *
 *   Estructura                        Buscar / insertar / borrar        Qué la rompe
 *   Hash con encadenamiento           O(1) esperado si α = n/m es pequeño     muchas claves en la misma cubeta (mal hash)
 *   Hash con sondeo lineal            O(1) esperado si α < ~0,5-0,7           α → 1: los grupos crecen y todo se vuelve O(n)
 *   Árbol de búsqueda sin equilibrar  O(h), h entre log n y n                 claves ya ordenadas: h = n
 *   Árbol AVL                         O(log n) SIEMPRE                        nada: h ≤ 1,44 · log₂(n + 2)
 *
 * TRES IDEAS:
 *   1. FACTOR DE CARGA α = n / m (elementos entre cubetas). Mientras α se mantenga acotado (se agranda la tabla y se
 *      «recoloca» todo cuando pasa un umbral), cada operación cuesta O(1) esperado y el REHASH, aunque cueste O(n), se paga con
 *      el trabajo de las n inserciones anteriores: es un coste AMORTIZADO O(1) (más en el tema 16).
 *   2. LÁPIDAS (tombstones): en el sondeo lineal NO se puede dejar un hueco al borrar, porque cortaría la cadena de sondeo de
 *      otras claves que pasaron por esa casilla. Se marca como «borrada»: la búsqueda sigue de largo y la inserción puede reusarla.
 *   3. INVARIANTE DE ALTURA (AVL): en cada nodo, las alturas de sus dos subárboles difieren como mucho en 1. Si una inserción lo
 *      rompe, UNA rotación simple o doble (O(1)) lo arregla. Un árbol AVL con h niveles tiene al menos N(h) = N(h-1) + N(h-2) + 1
 *      nodos (como Fibonacci), de donde sale la cota logarítmica.
 *
 * CÓMO SE TRABAJA: pulsa Ctrl+Enter para ejecutar el archivo; los ejercicios dicen «pendiente» hasta que sustituyes
 * `return pendiente();` por tu código. Ctrl+S guarda tu avance. El botón «Solución» compara tu código con la de
 * referencia (pruebas y medición del coste).
 */

void titulo(const string& texto)
{
    cout << "\n=== " << texto << " ===\n";
}

/*
 * ┌─ Desde Java/PHP/Python ────────────────────────────────────────────────────────────────────────────────────────
 * │ `HashMap` de Java (o el array asociativo de PHP, o el dict de Python) es una tabla hash con encadenamiento (Java
 * │ además convierte las cadenas largas en árboles). En C++, `unordered_map` también encadena. Una diferencia importante: en
 * │ C++ el operador `%` con un dividendo NEGATIVO da un resultado negativo (-7 % 3 es -1, no 2 como en Python), y usar
 * │ `abs()` para evitarlo falla con el entero más negativo (comportamiento indefinido). El ejercicio 1 trata de eso.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * ┌─ Desde C ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * │ Los nodos del árbol AVL de esta lección no son punteros sino ÍNDICES en un `vector<NodoAVL>` (-1 = «sin hijo»): es la misma
 * │ idea que el árbol con `malloc`, pero sin liberar a mano y con los nodos juntos en memoria (amigable para la caché).
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/**
 * Nodo de un árbol binario de búsqueda guardado en un vector: `izq` y `der` son posiciones en el vector (-1 si no hay hijo).
 * `altura` es el número de niveles del subárbol (una hoja vale 1; el subárbol vacío, 0). Todos los ejercicios de árboles de
 * esta lección usan este tipo, que NO tienes que modificar.
 */
struct NodoAVL {
    int clave;
    int altura;
    int izq;
    int der;
};

/** Altura del subárbol con raíz en `i`: 0 si i == -1. */
int alturaDe(const vector<NodoAVL>& t, int i)
{
    return i < 0 ? 0 : t[static_cast<size_t>(i)].altura;
}

/** Recalcula la altura del nodo `i` a partir de las de sus hijos (que deben estar al día). */
void recalcular(vector<NodoAVL>& t, int i)
{
    NodoAVL& n = t[static_cast<size_t>(i)];
    n.altura = 1 + max(alturaDe(t, n.izq), alturaDe(t, n.der));
}

/** Claves del subárbol con raíz en `i`, en orden creciente (recorrido en orden: izquierda, nodo, derecha). */
vector<int> enOrdenDe(const vector<NodoAVL>& t, int i)
{
    vector<int> r;
    vector<int> pila;
    int actual = i;
    while (actual != -1 || !pila.empty()) {
        while (actual != -1) {
            pila.push_back(actual);
            actual = t[static_cast<size_t>(actual)].izq;
        }
        actual = pila.back();
        pila.pop_back();
        r.push_back(t[static_cast<size_t>(actual)].clave);
        actual = t[static_cast<size_t>(actual)].der;
    }
    return r;
}

/** Árbol de búsqueda SIN equilibrar: inserta las claves en el orden dado (la raíz es el nodo 0). Alturas correctas. */
vector<NodoAVL> abbSinBalancear(const vector<int>& claves)
{
    vector<NodoAVL> t;
    for (int x : claves) {
        t.push_back({x, 1, -1, -1});
        int nuevo = static_cast<int>(t.size()) - 1;
        if (nuevo == 0) {
            continue;
        }
        vector<int> camino;
        int i = 0;
        while (true) {
            camino.push_back(i);
            NodoAVL& n = t[static_cast<size_t>(i)];
            int& hijo = x < n.clave ? n.izq : n.der;
            if (hijo == -1) {
                hijo = nuevo;
                break;
            }
            i = hijo;
        }
        for (int k = static_cast<int>(camino.size()) - 1; k >= 0; k--) {
            recalcular(t, camino[static_cast<size_t>(k)]);
        }
    }
    return t;
}

/** Lista de n nodos «colgando» siempre a la derecha (1, 2, …, n): el peor árbol de búsqueda. La raíz es el nodo 0. */
vector<NodoAVL> cadenaDerecha(int n)
{
    vector<NodoAVL> t;
    for (int i = 0; i < n; i++) {
        t.push_back({i + 1, n - i, -1, i + 1 < n ? i + 1 : -1});
    }
    return t;
}

/** Árbol PERFECTAMENTE equilibrado con las claves 1..n (la raíz es el nodo 0; los índices siguen el orden previo). Para medir esAVL. */
vector<NodoAVL> arbolEquilibrado(int n)
{
    vector<NodoAVL> t;
    t.reserve(static_cast<size_t>(n));
    // construye [lo, hi] y devuelve el índice de su raíz (el nodo se crea ANTES que sus hijos: la raíz global es el 0)
    auto construir = [&](auto&& self, int lo, int hi) -> int {
        if (lo > hi) {
            return -1;
        }
        int medio = lo + (hi - lo) / 2;
        int yo = static_cast<int>(t.size());
        t.push_back({medio, 1, -1, -1});
        int izq = self(self, lo, medio - 1);
        int der = self(self, medio + 1, hi);
        t[static_cast<size_t>(yo)].izq = izq;
        t[static_cast<size_t>(yo)].der = der;
        recalcular(t, yo);
        return yo;
    };
    construir(construir, 1, n);
    return t;
}

/** Cuántas cubetas contienen alguna clave y la cubeta más llena, al repartir `claves` en m cubetas con `clave % m` (positivas). */
pair<int, int> reparto(const vector<long long>& claves, int m)
{
    vector<int> cuenta(static_cast<size_t>(m), 0);
    for (long long c : claves) {
        cuenta[static_cast<size_t>(c % m)]++;
    }
    int ocupadas = 0;
    for (int x : cuenta) {
        ocupadas += x > 0 ? 1 : 0;
    }
    return {ocupadas, *max_element(cuenta.begin(), cuenta.end())};
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · cubeta ─────────────────────────────────────────────────────
/**
 * El número de cubeta (entre 0 y m-1) que le toca a una clave entera: la clave módulo m, SIEMPRE no negativo.
 * cubeta(13, 5) → 3 · cubeta(-1, 10) → 9 · cubeta(-10, 10) → 0. m ≤ 0 → invalid_argument.
 * La trampa: en C++, `-1 % 10` es -1 (el resto lleva el signo del dividendo), y un índice negativo en un vector es comportamiento
 * indefinido. La solución habitual `((clave % m) + m) % m` funciona con todas las claves; la tentación de usar `abs(clave) % m`
 * FALLA con el valor más negativo de long long, cuyo `abs` desborda (también es UB) y además reparte claves distintas
 * (-3 y 3) en la misma cubeta. Piensa por qué la suma de `m` no puede desbordar aquí (el resto está en (-m, m)).
 * Coste: O(1).
 */
int cubeta(long long clave, int m)
{
    return pendiente();
}

// ── Ejercicio 2 · minimoNodosAVL ─────────────────────────────────────────────
/**
 * El MÍNIMO de nodos que puede tener un árbol AVL de altura h (una hoja tiene altura 1; el árbol vacío, 0). Es la cuenta que
 * demuestra que un AVL es logarítmico: para ser lo más «flaco» posible, la raíz tiene un subárbol de altura h-1 y el otro de h-2
 * (la diferencia máxima permitida), cada uno a su vez mínimo. Así N(h) = N(h-1) + N(h-2) + 1 con N(0) = 0 y N(1) = 1:
 * 0, 1, 2, 4, 7, 12, 20, 33, … Es Fibonacci menos 1, y crece como φʰ con φ ≈ 1,618; invirtiendo, h ≤ 1,44 · log₂(n + 2).
 * h < 0 o h > 90 (más no cabe en un long long) → invalid_argument.
 * Hazlo con un bucle, no con recursión doble (que sería exponencial: justo lo que se quiere enseñar a evitar).
 * Coste: O(h).
 */
long long minimoNodosAVL(int h)
{
    return pendiente();
}

// ── Ejercicio 3 · TablaHashEncadenada ────────────────────────────────────────
/**
 * Tabla hash de claves `long long` a valores `int` con ENCADENAMIENTO: un vector de cubetas y cada cubeta guarda sus pares
 * (clave, valor) en un vector. La cubeta de una clave es `((clave % m) + m) % m` con m el número de cubetas (mira el ejercicio 1).
 *   - poner(clave, valor): inserta, o CAMBIA el valor si la clave ya estaba (sin duplicar).
 *   - obtener(clave): `optional<int>`, vacío si no está.
 *   - borrar(clave): quita el par y devuelve true; false si no estaba.
 *   - tamano(): cuántas claves hay; cubetas(): cuántas cubetas; factorDeCarga() = tamano / cubetas (double);
 *     recolocaciones(): cuántas veces se ha agrandado la tabla.
 * Nace con `cubetasIniciales` cubetas (por defecto 8; menos de 1 → invalid_argument). REHASH: tras insertar una clave NUEVA, si
 * tamano / cubetas > 3/4 (compárala en enteros: `4 * tamano > 3 * cubetas`), DUPLICA las cubetas y recoloca todos los pares con
 * el módulo nuevo. Borrar nunca reduce la tabla. Invariante tras cada `poner`: factor de carga ≤ 3/4.
 * Por qué recolocar y no solo ampliar: el número de cubeta depende de m, así que al cambiar m cambia el sitio de CADA clave.
 * Coste: obtener, poner y borrar O(1) esperado (O(longitud de la cadena)); el rehash es O(n) pero amortizado O(1) por inserción.
 */
struct TablaHashEncadenada {
    explicit TablaHashEncadenada(int cubetasIniciales = 8)
    {
        pendiente();
    }

    void poner(long long clave, int valor)
    {
        pendiente();
    }

    optional<int> obtener(long long clave) const
    {
        pendiente();
        return nullopt;
    }

    bool borrar(long long clave)
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    size_t cubetas() const
    {
        return pendiente();
    }

    double factorDeCarga() const
    {
        return pendiente();
    }

    int recolocaciones() const
    {
        return pendiente();
    }
};

// ── Ejercicio 4 · TablaHashLineal ────────────────────────────────────────────
/**
 * Tabla hash con DIRECCIONAMIENTO ABIERTO y SONDEO LINEAL: un único vector de `capacidad` casillas; la clave va a la casilla
 * `((clave % m) + m) % m` y, si está ocupada, a la siguiente (con vuelta al principio), y así hasta encontrar sitio. Cada casilla
 * está VACÍA, OCUPADA o BORRADA (lápida). La misma API que `TablaHashEncadenada`, más `capacidad()` y `lapidas()` (casillas borradas).
 *   - obtener: sigue la cadena de sondeo SALTANDO las lápidas y para al llegar a una casilla vacía (o tras `capacidad` pasos).
 *   - borrar: marca la casilla como BORRADA (nunca vacía: cortaría la cadena de otras claves) y cuenta una lápida.
 *   - poner: busca la clave siguiendo la cadena. Si existe, cambia su valor. Si no, la inserta en la PRIMERA lápida que viste
 *     (o en la casilla vacía donde acabó la búsqueda) — así las lápidas se reutilizan.
 * RECONSTRUCCIÓN: antes de insertar una clave NUEVA, si 2 · (vivas + lápidas + 1) > capacidad, reconstruye la tabla: la capacidad
 * se DUPLICA si 4 · (vivas + 1) > capacidad y se queda igual si no (solo limpia las lápidas), se reinsertan las vivas, las lápidas
 * pasan a 0 y `recolocaciones` sube 1. Invariante: 2 · (vivas + lápidas) ≤ capacidad: siempre hay al menos la mitad vacía, así que
 * toda búsqueda termina. Capacidad inicial por defecto 8 (menos de 1 → invalid_argument).
 * Trampa: contar solo las claves vivas para decidir el rehash. Con muchos borrados la tabla se llenaría de lápidas y `obtener` de
 * una clave ausente daría vueltas hasta el final. Compáralo con el encadenamiento: allí borrar es trivial; aquí es lo difícil.
 * Coste: O(1) esperado con α ≤ 1/2 (≈ ½(1 + 1/(1-α)²) sondeos en una búsqueda fallida); la reconstrucción es amortizada.
 */
struct TablaHashLineal {
    explicit TablaHashLineal(int capacidadInicial = 8)
    {
        pendiente();
    }

    void poner(long long clave, int valor)
    {
        pendiente();
    }

    optional<int> obtener(long long clave) const
    {
        pendiente();
        return nullopt;
    }

    bool borrar(long long clave)
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    size_t capacidad() const
    {
        return pendiente();
    }

    size_t lapidas() const
    {
        return pendiente();
    }

    int recolocaciones() const
    {
        return pendiente();
    }
};

// ── Ejercicio 5 · rotarDerecha ───────────────────────────────────────────────
/**
 * Rotación simple a la DERECHA del subárbol con raíz `y`: su hijo izquierdo `x` pasa a ser la raíz.
 *
 *          y                x
 *         / \              / \
 *        x   C    →       A   y          A, B y C son subárboles (pueden ser vacíos, -1)
 *       / \                  / \
 *      A   B                B   C
 *
 * En el vector: `t[y].izq = t[x].der; t[x].der = y;` y después RECALCULA LA ALTURA de `y` primero (ahora está más abajo) y de `x`
 * después. Devuelve el índice de la nueva raíz (x): quien llamó debe enlazarlo donde antes estaba y (como hijo de su padre, o como la
 * raíz del árbol). La rotación conserva el orden: A < x < B < y < C antes y después. Sin hijo izquierdo (o y fuera de rango) → invalid_argument.
 * Usa `recalcular(t, i)` de arriba. Coste: O(1).
 */
int rotarDerecha(vector<NodoAVL>& t, int y)
{
    return pendiente();
}

// ── Ejercicio 6 · rotarIzquierda ─────────────────────────────────────────────
/**
 * La simétrica: rotación simple a la IZQUIERDA del subárbol con raíz `x`: su hijo derecho `y` pasa a ser la raíz.
 *
 *        x                    y
 *       / \                  / \
 *      A   y        →       x   C
 *         / \              / \
 *        B   C            A   B
 *
 * `t[x].der = t[y].izq; t[y].izq = x;`, recalcula la altura de `x` y luego la de `y`, y devuelve `y`. Sin hijo derecho → invalid_argument.
 * Piensa cuándo hace falta cada una: un nodo «pesado a la izquierda» se arregla con rotarDerecha; si ese hijo izquierdo está a su vez
 * pesado a la DERECHA (caso izquierda-derecha), antes hay que rotarlo a la izquierda y luego rotar el nodo a la derecha (rotación doble).
 * Coste: O(1).
 */
int rotarIzquierda(vector<NodoAVL>& t, int x)
{
    return pendiente();
}

// ── Ejercicio 7 · esAVL ──────────────────────────────────────────────────────
/**
 * Validador: ¿el árbol con raíz en el índice `raiz` es un AVL correcto? (raiz = -1 es el árbol vacío: sí). Debe cumplirse a la vez:
 *   (1) ORDEN de búsqueda ESTRICTO en todo el árbol: las claves de la izquierda < la clave del nodo < las de la derecha.
 *       Trampa clásica: comprobar solo «hijo izquierdo < padre < hijo derecho» NO basta; 10 con hijo izquierdo 5 cuyo hijo derecho
 *       es 12 pasa esa comprobación local y es un árbol inválido (el 12 está a la izquierda del 10). Lleva un intervalo (mín, máx).
 *   (2) EQUILIBRIO: en cada nodo las alturas de sus dos subárboles difieren como mucho en 1.
 *   (3) ALTURAS ALMACENADAS: el campo `altura` de cada nodo coincide con la altura real (1 + el mayor de los hijos).
 * Es un árbol de verdad: si un nodo se visita más de una vez (un ciclo o un hijo compartido) devuelve false (cuenta los nodos
 * visitados: nunca más de t.size()). Un índice de hijo fuera de [-1, t.size()) o una raíz fuera de rango → invalid_argument.
 * Idea: una función recursiva que recibe el nodo y el intervalo y devuelve la altura real, o -1 si algo falla (un solo recorrido).
 * Usa long long para el intervalo (las claves son int y el intervalo inicial es «todo»).
 * Coste: O(n) (cada nodo una vez) y profundidad de recursión = altura del árbol dado.
 */
bool esAVL(const vector<NodoAVL>& t, int raiz)
{
    return pendiente();
}

// ── Ejercicio 8 · ArbolAVL ───────────────────────────────────────────────────
/**
 * Conjunto de enteros en un árbol AVL: una búsqueda, inserción o consulta cuesta O(log n) SIEMPRE, sin importar el orden de llegada.
 * Los nodos viven en `nodos` (los nuevos se añaden al final) y `raiz` es el índice de la raíz (-1 si está vacío). Ambos son públicos
 * para que las pruebas puedan mirar dentro. `rotaciones` cuenta las rotaciones SIMPLES hechas (una rotación doble son 2).
 *   - insertar(x): true si x es nueva, false si ya estaba (entonces no cambia nada).
 *   - contiene(x), altura() (0 si está vacío), tamano(), enOrden() (las claves en orden creciente; usa `enOrdenDe`).
 * Receta (recursiva): `insertarEn(i, x)` devuelve la nueva raíz del subárbol: baja a la izquierda o la derecha, ENLAZA lo que
 * devuelva la llamada recursiva, y al volver recalcula la altura y reequilibra:
 *      equilibrio = altura(izq) - altura(der)
 *      si equilibrio > 1:   (cargado a la izquierda)  si el hijo izquierdo tiene equilibrio < 0, rotarIzquierda(hijo izq) antes;  rotarDerecha(i)
 *      si equilibrio < -1:  (cargado a la derecha)    si el hijo derecho tiene equilibrio > 0, rotarDerecha(hijo der) antes;  rotarIzquierda(i)
 * Usa TUS `rotarDerecha` y `rotarIzquierda` (y `recalcular`/`alturaDe` de arriba). Cuidado con las referencias: `nodos.push_back` puede
 * reubicar el vector; trabaja con ÍNDICES, no con referencias a elementos, mientras insertas.
 * No se pide borrar (es lo más delicado del AVL: puede necesitar una rotación en cada nivel del camino de vuelta).
 * Coste: insertar y contiene O(log n) en el peor caso; espacio O(n).
 */
struct ArbolAVL {
    vector<NodoAVL> nodos;
    int raiz = -1;
    int rotaciones = 0;

    bool insertar(int x)
    {
        return pendiente();
    }

    bool contiene(int x) const
    {
        return pendiente();
    }

    int altura() const
    {
        return pendiente();
    }

    size_t tamano() const
    {
        return pendiente();
    }

    vector<int> enOrden() const
    {
        return pendiente();
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. EL FACTOR DE CARGA Y LAS COLISIONES
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1. Un mal módulo arruina la tabla");

    vector<long long> multiplosDe8;
    for (int i = 0; i < 64; i++) {
        multiplosDe8.push_back(8LL * i);
    }
    for (int m : {8, 16, 7, 61}) {
        auto [ocupadas, maxima] = reparto(multiplosDe8, m);
        cout << "64 claves múltiplos de 8 en " << m << " cubetas: " << ocupadas << " ocupadas, la más llena tiene " << maxima << "\n";
    }
    // Con m = 8 o 16 las claves se amontonan en 1 o 2 cubetas (8 divide a la clave y a m): una lista de 64 o dos de 32. Con un m PRIMO (7, 61) se reparten.
    // Por eso se prefiere un número de cubetas primo, o MEZCLAR los bits de la clave antes del módulo (lo que hacen las tablas reales).

    cout << "\n  α     encadenamiento (éxito/fallo)   sondeo lineal (éxito/fallo)\n";
    for (double a : {0.25, 0.50, 0.75, 0.90}) {
        double lineExito = 0.5 * (1 + 1 / (1 - a));
        double lineFallo = 0.5 * (1 + 1 / ((1 - a) * (1 - a)));
        cout << "  " << a << "      " << 1 + a / 2 << " / " << a << "                      " << lineExito << " / " << lineFallo << "\n";
    }
    // Pasos esperados al buscar. El encadenamiento aguanta α > 1; el sondeo lineal NO: con α = 0,9 una búsqueda fallida son ~50 sondeos.

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LÁPIDAS EN EL SONDEO LINEAL
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. Por qué borrar no puede dejar un hueco");

    // Tabla de 8 casillas; las claves 3, 11 y 19 caen todas en la casilla 3 (3, 11 y 19 son 3 módulo 8) y ocupan 3, 4 y 5.
    vector<string> casillas(8, ".");
    casillas[3] = "3";
    casillas[4] = "11";
    casillas[5] = "19";
    auto pinta = [&](const string& que) {
        cout << que << ": [";
        for (size_t i = 0; i < casillas.size(); i++) {
            cout << (i ? " " : "") << casillas[i];
        }
        cout << "]\n";
    };
    pinta("tras insertar 3, 11 y 19");
    casillas[4] = ".";
    pinta("borrar 11 DEJANDO HUECO");
    cout << "buscar 19: casilla 3 (ocupada por 3) → casilla 4 (vacía) → «no está». ¡Mentira! 19 sigue en la casilla 5.\n";
    casillas[4] = "†";
    pinta("borrar 11 con LÁPIDA (†)");
    cout << "buscar 19: casilla 3 (3) → casilla 4 (lápida: sigo) → casilla 5 (19) → encontrado.\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 3. UN ÁRBOL SIN EQUILIBRAR DEGENERA
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3. Altura de un árbol de búsqueda según el orden de inserción");

    for (int n : {15, 255, 4095}) {
        vector<int> ordenadas = numeros(n);
        vector<int> azar = aleatorios(n, 1000000, 7);
        auto t1 = abbSinBalancear(ordenadas);
        auto t2 = abbSinBalancear(azar);
        cout << "n = " << n << ": claves ordenadas → altura " << alturaDe(t1, 0) << "; claves aleatorias → altura " << alturaDe(t2, 0)
             << "; la mejor posible = " << bit_width(static_cast<unsigned>(n)) << "\n";
    }
    // Insertar 1, 2, 3, … produce una lista de altura n: buscar cuesta O(n). Con claves al azar el árbol sale razonable (≈ 2-3 · log₂ n)
    // pero no hay garantía: un solo cliente que mande datos ordenados lo arruina. El AVL garantiza ≤ 1,44 · log₂(n + 2) para cualquier orden.

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    prueba(cubeta,
        caso("positiva", 3, 13LL, 5),
        caso("múltiplo exacto", 0, 20LL, 10),
        caso("negativa: -1 va a la última cubeta", 9, -1LL, 10),
        caso("negativa múltiplo", 0, -10LL, 10),
        caso("cero", 0, 0LL, 7),
        caso("m = 1: todo a la cubeta 0", 0, 123456789LL, 1),
        caso("el mayor long long", 807, 9223372036854775807LL, 1000),
        caso("el menor long long (abs desbordaría)", 2, LLONG_MIN, 10));
    grupo("cubeta (más casos)");
    lanza("m cero", [&] { cubeta(5, 0); }, invalid_argument);
    lanza("m negativo", [&] { cubeta(5, -3); }, invalid_argument);
    comprueba("siempre en [0, m) para claves de todos los signos", [&] {
        for (long long c = -200; c <= 200; c++) {
            for (int m : {1, 2, 3, 7, 10, 64}) {
                int b = cubeta(c, m);
                if (b < 0 || b >= m) {
                    return string("falla con ") + to_string(c) + " y " + to_string(m);
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("-3 y 3 no tienen por qué caer juntas (abs sí las juntaría)", [&] { return cubeta(-3, 10) != cubeta(3, 10); }, true);

    prueba(minimoNodosAVL,
        caso("vacío", 0LL, 0),
        caso("una hoja", 1LL, 1),
        caso("altura 2", 2LL, 2),
        caso("altura 3", 4LL, 3),
        caso("altura 4", 7LL, 4),
        caso("altura 5", 12LL, 5),
        caso("altura 10 (Fibonacci menos 1)", 143LL, 10),
        caso("altura 40", 267914295LL, 40),
        caso("el máximo permitido", 7540113804746346428LL, 90));
    grupo("minimoNodosAVL (más casos)");
    lanza("altura negativa", [&] { minimoNodosAVL(-1); }, invalid_argument);
    lanza("altura que desborda", [&] { minimoNodosAVL(91); }, invalid_argument);

    grupo("TablaHashEncadenada");
    comprueba("poner y obtener", [&] {
        TablaHashEncadenada t;
        t.poner(10, 100);
        t.poner(20, 200);
        return vector<int>{t.obtener(10).value_or(-1), t.obtener(20).value_or(-1), t.obtener(30).value_or(-1)};
    }, vector<int>{100, 200, -1});
    comprueba("poner una clave existente cambia el valor y no duplica", [&] {
        TablaHashEncadenada t;
        t.poner(5, 1);
        t.poner(5, 2);
        return vector<long long>{t.obtener(5).value_or(-1), static_cast<long long>(t.tamano())};
    }, vector<long long>{2, 1});
    comprueba("borrar", [&] {
        TablaHashEncadenada t;
        t.poner(1, 10);
        t.poner(2, 20);
        bool a = t.borrar(1);
        bool b = t.borrar(1);
        return vector<long long>{a, b, t.obtener(1).has_value(), t.obtener(2).value_or(-1), static_cast<long long>(t.tamano())};
    }, vector<long long>{1, 0, 0, 20, 1});
    comprueba("claves negativas", [&] {
        TablaHashEncadenada t;
        t.poner(-1, 7);
        t.poner(-9, 8);
        t.poner(LLONG_MIN, 9);
        return vector<int>{t.obtener(-1).value_or(0), t.obtener(-9).value_or(0), t.obtener(LLONG_MIN).value_or(0)};
    }, vector<int>{7, 8, 9});
    comprueba("tabla vacía", [&] { TablaHashEncadenada t; return vector<long long>{static_cast<long long>(t.tamano()), t.obtener(0).has_value(), t.borrar(0)}; }, vector<long long>{0, 0, 0});
    comprueba("rehash: 100 claves desde 4 cubetas acaban en 256 cubetas tras 6 recolocaciones", [&] {
        TablaHashEncadenada t(4);
        for (int i = 0; i < 100; i++) {
            t.poner(i, i);
        }
        return vector<long long>{static_cast<long long>(t.cubetas()), t.recolocaciones()};
    }, vector<long long>{256, 6});
    comprueba("el factor de carga nunca pasa de 3/4 tras un poner", [&] {
        TablaHashEncadenada t(3);
        for (int i = 0; i < 500; i++) {
            t.poner(i * 7LL, i);
            if (t.factorDeCarga() > 0.75) {
                return string("falla con ") + to_string(i);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("el rehash conserva todos los pares", [&] {
        TablaHashEncadenada t(2);
        for (int i = 0; i < 1000; i++) {
            t.poner(i * 31LL - 400, i);
        }
        for (int i = 0; i < 1000; i++) {
            if (t.obtener(i * 31LL - 400) != i) {
                return string("pierde la clave ") + to_string(i * 31 - 400);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("muchas colisiones (todas las claves son múltiplos de 1024) siguen funcionando", [&] {
        TablaHashEncadenada t;
        for (int i = 0; i < 300; i++) {
            t.poner(i * 1024LL, i);
        }
        t.borrar(5 * 1024LL);
        return vector<int>{t.obtener(299 * 1024LL).value_or(-1), t.obtener(5 * 1024LL).value_or(-1), t.obtener(6 * 1024LL).value_or(-1)};
    }, vector<int>{299, -1, 6});
    comprueba("borrar no reduce las cubetas", [&] {
        TablaHashEncadenada t(4);
        for (int i = 0; i < 20; i++) {
            t.poner(i, i);
        }
        size_t antes = t.cubetas();
        for (int i = 0; i < 20; i++) {
            t.borrar(i);
        }
        return t.cubetas() == antes && t.tamano() == 0;
    }, true);
    lanza("cero cubetas", [&] { TablaHashEncadenada t(0); }, invalid_argument);
    comprueba("coincide con un std::map en 3000 operaciones mezcladas", [&] {
        TablaHashEncadenada t;
        map<long long, int> ref;
        vector<int> azar = aleatorios(9000, 300, 11);
        for (int k = 0; k < 3000; k++) {
            long long clave = azar[3 * k] - 150;
            int op = azar[3 * k + 1] % 3;
            if (op == 0) {
                t.poner(clave, azar[3 * k + 2]);
                ref[clave] = azar[3 * k + 2];
            } else if (op == 1) {
                if (t.borrar(clave) != (ref.erase(clave) == 1)) {
                    return string("borrar falla en ") + to_string(k);
                }
            } else {
                auto it = ref.find(clave);
                optional<int> esperado = it == ref.end() ? nullopt : optional<int>(it->second);
                if (t.obtener(clave) != esperado) {
                    return string("obtener falla en ") + to_string(k);
                }
            }
            if (t.tamano() != ref.size()) {
                return string("tamaño distinto en ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));

    grupo("TablaHashLineal");
    comprueba("poner, obtener y borrar", [&] {
        TablaHashLineal t;
        t.poner(10, 100);
        t.poner(20, 200);
        bool a = t.borrar(10);
        return vector<long long>{t.obtener(10).has_value(), t.obtener(20).value_or(-1), a, t.borrar(10), static_cast<long long>(t.tamano())};
    }, vector<long long>{0, 200, 1, 0, 1});
    comprueba("poner una clave existente cambia el valor", [&] {
        TablaHashLineal t;
        t.poner(7, 1);
        t.poner(7, 2);
        return vector<long long>{t.obtener(7).value_or(-1), static_cast<long long>(t.tamano())};
    }, vector<long long>{2, 1});
    comprueba("claves negativas y extremas", [&] {
        TablaHashLineal t;
        t.poner(-1, 1);
        t.poner(LLONG_MIN, 2);
        t.poner(LLONG_MAX, 3);
        return vector<int>{t.obtener(-1).value_or(0), t.obtener(LLONG_MIN).value_or(0), t.obtener(LLONG_MAX).value_or(0)};
    }, vector<int>{1, 2, 3});
    comprueba("LÁPIDA: borrar 11 no pierde el 19 que está después en la cadena (3, 11 y 19 chocan con 8 casillas)", [&] {
        TablaHashLineal t;
        t.poner(3, 30);
        t.poner(11, 110);
        t.poner(19, 190);
        t.borrar(11);
        return vector<long long>{t.obtener(19).value_or(-1), t.obtener(11).has_value(), static_cast<long long>(t.lapidas())};
    }, vector<long long>{190, 0, 1});
    comprueba("LÁPIDA: insertar una clave nueva reutiliza la primera lápida", [&] {
        TablaHashLineal t;
        t.poner(3, 30);
        t.poner(11, 110);
        t.poner(19, 190);
        t.borrar(11);
        t.poner(27, 270);
        return vector<long long>{static_cast<long long>(t.lapidas()), static_cast<long long>(t.tamano()), t.obtener(27).value_or(-1), t.obtener(19).value_or(-1)};
    }, vector<long long>{0, 3, 270, 190});
    comprueba("LÁPIDA: una clave que sigue a una lápida no se duplica al volver a ponerla", [&] {
        TablaHashLineal t;
        t.poner(3, 30);
        t.poner(11, 110);
        t.poner(19, 190);
        t.borrar(11);
        t.poner(19, 191);
        return vector<long long>{static_cast<long long>(t.tamano()), t.obtener(19).value_or(-1)};
    }, vector<long long>{2, 191});
    comprueba("la capacidad crece al llenarse: 5 claves desde 8 casillas → 16", [&] {
        TablaHashLineal t;
        for (int i = 0; i < 5; i++) {
            t.poner(i, i);
        }
        return vector<long long>{static_cast<long long>(t.capacidad()), t.recolocaciones()};
    }, vector<long long>{16, 1});
    comprueba("invariante: siempre al menos la mitad de casillas vacías (2·(vivas + lápidas) ≤ capacidad)", [&] {
        TablaHashLineal t(4);
        for (int i = 0; i < 300; i++) {
            t.poner(i * 13LL, i);
            if (i % 3 == 0) {
                t.borrar((i / 2) * 13LL);
            }
            if (2 * (t.tamano() + t.lapidas()) > t.capacidad()) {
                return string("falla con ") + to_string(i);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("muchos borrados: la tabla se limpia de lápidas y no se llena ni se cuelga (5000 altas y bajas)", [&] {
        TablaHashLineal t;
        for (int i = 0; i < 5000; i++) {
            t.poner(i, i);
            if (i >= 10) {
                t.borrar(i - 10);
            }
            if (t.obtener(-1).has_value()) {                              // una clave que nunca estuvo: debe terminar y decir que no
                return string("encuentra una clave que no existe");
            }
        }
        return string("tamaño ") + to_string(t.tamano()) + (t.capacidad() <= 128 ? " con capacidad razonable" : " con capacidad desbocada");
    }, string("tamaño 10 con capacidad razonable"));
    lanza("capacidad cero", [&] { TablaHashLineal t(0); }, invalid_argument);
    comprueba("coincide con un std::map en 3000 operaciones mezcladas", [&] {
        TablaHashLineal t;
        map<long long, int> ref;
        vector<int> azar = aleatorios(9000, 300, 12);
        for (int k = 0; k < 3000; k++) {
            long long clave = azar[3 * k] - 150;
            int op = azar[3 * k + 1] % 3;
            if (op == 0) {
                t.poner(clave, azar[3 * k + 2]);
                ref[clave] = azar[3 * k + 2];
            } else if (op == 1) {
                if (t.borrar(clave) != (ref.erase(clave) == 1)) {
                    return string("borrar falla en ") + to_string(k);
                }
            } else {
                auto it = ref.find(clave);
                optional<int> esperado = it == ref.end() ? nullopt : optional<int>(it->second);
                if (t.obtener(clave) != esperado) {
                    return string("obtener falla en ") + to_string(k);
                }
            }
            if (t.tamano() != ref.size()) {
                return string("tamaño distinto en ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));

    grupo("rotarDerecha");
    comprueba("rotación simple con dos nodos", [&] {
        vector<NodoAVL> t = {{30, 2, 1, -1}, {20, 1, -1, -1}};
        int raizNueva = rotarDerecha(t, 0);
        return vector<int>{raizNueva, t[1].der, t[0].izq, t[0].altura, t[1].altura};
    }, vector<int>{1, 0, -1, 1, 2});
    comprueba("el subárbol B pasa a ser el hijo izquierdo de y", [&] {
        //          50               30
        //         /  \             /  \        índices: 0:50  1:30  2:20  3:40  4:60
        //       30    60    →    20    50
        //      /  \                    /  \
        //    20    40                40    60
        vector<NodoAVL> t = {{50, 3, 1, 4}, {30, 2, 2, 3}, {20, 1, -1, -1}, {40, 1, -1, -1}, {60, 1, -1, -1}};
        int r = rotarDerecha(t, 0);
        return vector<int>{r, t[1].izq, t[1].der, t[0].izq, t[0].der, t[0].altura, t[1].altura};
    }, vector<int>{1, 2, 0, 3, 4, 2, 3});
    comprueba("conserva el recorrido en orden", [&] {
        vector<NodoAVL> t = {{50, 3, 1, 4}, {30, 2, 2, 3}, {20, 1, -1, -1}, {40, 1, -1, -1}, {60, 1, -1, -1}};
        int r = rotarDerecha(t, 0);
        return enOrdenDe(t, r);
    }, vector<int>{20, 30, 40, 50, 60});
    comprueba("rotar un subárbol interior: devuelve la nueva raíz sin tocar al padre", [&] {
        // 10 → derecha: 40, con izquierdo 30 (hoja). Se rota el 40 (índice 1).
        vector<NodoAVL> t = {{10, 3, -1, 1}, {40, 2, 2, -1}, {30, 1, -1, -1}};
        int r = rotarDerecha(t, 1);
        return vector<int>{r, t[r].clave, t[0].der, t[2].der};
    }, vector<int>{2, 30, 1, 1});
    lanza("sin hijo izquierdo", [&] { vector<NodoAVL> t = {{1, 1, -1, -1}}; rotarDerecha(t, 0); }, invalid_argument);
    lanza("nodo fuera de rango", [&] { vector<NodoAVL> t = {{1, 1, -1, -1}}; rotarDerecha(t, 3); }, invalid_argument);

    grupo("rotarIzquierda");
    comprueba("rotación simple con dos nodos", [&] {
        vector<NodoAVL> t = {{10, 2, -1, 1}, {20, 1, -1, -1}};
        int raizNueva = rotarIzquierda(t, 0);
        return vector<int>{raizNueva, t[1].izq, t[0].der, t[0].altura, t[1].altura};
    }, vector<int>{1, 0, -1, 1, 2});
    comprueba("el subárbol B pasa a ser el hijo derecho de x", [&] {
        //      20                 40
        //     /  \               /  \         índices: 0:20  1:10  2:40  3:30  4:50
        //   10    40      →    20    50
        //        /  \         /  \
        //      30    50     10    30
        vector<NodoAVL> t = {{20, 3, 1, 2}, {10, 1, -1, -1}, {40, 2, 3, 4}, {30, 1, -1, -1}, {50, 1, -1, -1}};
        int r = rotarIzquierda(t, 0);
        return vector<int>{r, t[2].izq, t[2].der, t[0].izq, t[0].der, t[0].altura, t[2].altura};
    }, vector<int>{2, 0, 4, 1, 3, 2, 3});
    comprueba("conserva el recorrido en orden", [&] {
        vector<NodoAVL> t = {{20, 3, 1, 2}, {10, 1, -1, -1}, {40, 2, 3, 4}, {30, 1, -1, -1}, {50, 1, -1, -1}};
        int r = rotarIzquierda(t, 0);
        return enOrdenDe(t, r);
    }, vector<int>{10, 20, 30, 40, 50});
    comprueba("rotación doble izquierda-derecha: rotarIzquierda en el hijo y rotarDerecha en el nodo", [&] {
        // 30 con hijo izquierdo 10, que tiene hijo derecho 20 (el zig-zag): índices 0:30 1:10 2:20
        vector<NodoAVL> t = {{30, 3, 1, -1}, {10, 2, -1, 2}, {20, 1, -1, -1}};
        t[0].izq = rotarIzquierda(t, t[0].izq);
        int r = rotarDerecha(t, 0);
        return vector<int>{t[r].clave, t[t[r].izq].clave, t[t[r].der].clave, t[r].altura};
    }, vector<int>{20, 10, 30, 2});
    lanza("sin hijo derecho", [&] { vector<NodoAVL> t = {{1, 1, -1, -1}}; rotarIzquierda(t, 0); }, invalid_argument);

    grupo("esAVL");
    comprueba("árbol vacío y de un nodo", [&] {
        vector<NodoAVL> uno = {{5, 1, -1, -1}};
        return esAVL({}, -1) && esAVL(uno, 0);
    }, true);
    comprueba("árbol perfecto de 7 nodos", [&] { return esAVL(arbolEquilibrado(7), 0); }, true);
    comprueba("árbol de 4 nodos con una pata más larga (sigue siendo AVL)", [&] { return esAVL(abbSinBalancear({4, 2, 6, 1}), 0); }, true);
    comprueba("una lista de tres nodos NO está equilibrada", [&] { return esAVL(abbSinBalancear({1, 2, 3}), 0); }, false);
    comprueba("una lista de 100000 nodos: false (sin desbordar la pila ni ir lento)", [&] { return esAVL(cadenaDerecha(100000), 0); }, false);
    comprueba("orden roto: el hijo izquierdo es mayor que el padre", [&] {
        vector<NodoAVL> t = {{5, 2, 1, -1}, {9, 1, -1, -1}};
        return esAVL(t, 0);
    }, false);
    comprueba("orden roto en lo hondo: 12 es hijo derecho de 5 pero está a la izquierda del 10", [&] {
        vector<NodoAVL> t = {{10, 3, 1, -1}, {5, 2, -1, 2}, {12, 1, -1, -1}};
        return esAVL(t, 0);
    }, false);
    comprueba("claves repetidas: no es un árbol de búsqueda estricto", [&] {
        vector<NodoAVL> t = {{5, 2, 1, -1}, {5, 1, -1, -1}};
        return esAVL(t, 0);
    }, false);
    comprueba("desequilibrio con las alturas bien anotadas", [&] {
        vector<NodoAVL> t = {{3, 3, 1, -1}, {2, 2, 2, -1}, {1, 1, -1, -1}};
        return esAVL(t, 0);
    }, false);
    comprueba("equilibrado pero con una altura almacenada mal", [&] {
        vector<NodoAVL> t = {{2, 5, 1, 2}, {1, 1, -1, -1}, {3, 1, -1, -1}};
        return esAVL(t, 0);
    }, false);
    comprueba("un ciclo: el hijo de un nodo apunta a la raíz", [&] {
        vector<NodoAVL> t = {{5, 2, 1, -1}, {3, 1, 0, -1}};
        return esAVL(t, 0);
    }, false);
    lanza("índice de hijo fuera de rango", [&] { vector<NodoAVL> t = {{5, 1, 7, -1}}; esAVL(t, 0); }, invalid_argument);
    lanza("raíz fuera de rango", [&] { vector<NodoAVL> t = {{5, 1, -1, -1}}; esAVL(t, 4); }, invalid_argument);

    grupo("ArbolAVL");
    comprueba("1, 2, 3 provoca una rotación simple y deja el 2 en la raíz", [&] {
        ArbolAVL a;
        a.insertar(1);
        a.insertar(2);
        a.insertar(3);
        return vector<int>{a.nodos[static_cast<size_t>(a.raiz)].clave, a.altura(), a.rotaciones};
    }, vector<int>{2, 2, 1});
    comprueba("1, 3, 2 provoca una rotación doble (2 rotaciones simples)", [&] {
        ArbolAVL a;
        a.insertar(1);
        a.insertar(3);
        a.insertar(2);
        return vector<int>{a.nodos[static_cast<size_t>(a.raiz)].clave, a.altura(), a.rotaciones};
    }, vector<int>{2, 2, 2});
    comprueba("3, 2, 1 y 3, 1, 2 también", [&] {
        ArbolAVL a;
        ArbolAVL b;
        for (int x : {3, 2, 1}) {
            a.insertar(x);
        }
        for (int x : {3, 1, 2}) {
            b.insertar(x);
        }
        return vector<int>{a.nodos[static_cast<size_t>(a.raiz)].clave, a.rotaciones, b.nodos[static_cast<size_t>(b.raiz)].clave, b.rotaciones};
    }, vector<int>{2, 1, 2, 2});
    comprueba("vacío", [&] { ArbolAVL a; return vector<long long>{a.altura(), static_cast<long long>(a.tamano()), static_cast<long long>(a.enOrden().size()), a.contiene(0)}; }, vector<long long>{0, 0, 0, 0});
    comprueba("duplicados: insertar devuelve false y no cambia nada", [&] {
        ArbolAVL a;
        bool primera = a.insertar(5);
        bool segunda = a.insertar(5);
        return vector<long long>{primera, segunda, static_cast<long long>(a.tamano())};
    }, vector<long long>{1, 0, 1});
    comprueba("contiene (también con negativos)", [&] {
        ArbolAVL a;
        for (int x : {5, -3, 8, 0, 12, -7}) {
            a.insertar(x);
        }
        return vector<int>{a.contiene(5), a.contiene(-7), a.contiene(12), a.contiene(4), a.contiene(-100)};
    }, vector<int>{1, 1, 1, 0, 0});
    comprueba("enOrden sale ordenado", [&] {
        ArbolAVL a;
        for (int x : {5, -3, 8, 0, 12, -7, 5}) {
            a.insertar(x);
        }
        return a.enOrden();
    }, vector<int>{-7, -3, 0, 5, 8, 12});
    comprueba("1..7 en orden dan un árbol perfecto de altura 3 con 4 rotaciones", [&] {
        ArbolAVL a;
        for (int i = 1; i <= 7; i++) {
            a.insertar(i);
        }
        return vector<int>{a.altura(), a.rotaciones, a.nodos[static_cast<size_t>(a.raiz)].clave};
    }, vector<int>{3, 4, 4});
    comprueba("1..1023 en orden: altura 10 (la mejor posible) y n - popcount(n) = 1013 rotaciones", [&] {
        ArbolAVL a;
        for (int i = 1; i <= 1023; i++) {
            a.insertar(i);
        }
        return vector<int>{a.altura(), a.rotaciones};
    }, vector<int>{10, 1013});
    comprueba("100000 claves ordenadas: altura 17 (un árbol sin equilibrar tendría 100000)", [&] {
        ArbolAVL a;
        for (int i = 1; i <= 100000; i++) {
            a.insertar(i);
        }
        return a.altura();
    }, 17);
    comprueba("altura ≤ 1,44·log₂(n + 2) en 3000 claves aleatorias y en 3000 descendentes", [&] {
        ArbolAVL a;
        ArbolAVL b;
        for (int x : aleatorios(3000, 1000000, 3)) {
            a.insertar(x);
        }
        for (int i = 3000; i >= 1; i--) {
            b.insertar(i);
        }
        return a.altura() <= 17 && b.altura() <= 17;
    }, true);
    comprueba("coincide con un std::set y cada nodo cumple |equilibrio| ≤ 1 (2000 claves)", [&] {
        ArbolAVL a;
        set<int> ref;
        for (int x : aleatorios(2000, 5000, 9)) {
            if (a.insertar(x) != ref.insert(x).second) {
                return string("insertar devuelve mal con ") + to_string(x);
            }
        }
        if (a.enOrden() != vector<int>(ref.begin(), ref.end())) {
            return string("el recorrido en orden no coincide");
        }
        for (size_t i = 0; i < a.nodos.size(); i++) {
            int d = alturaDe(a.nodos, a.nodos[i].izq) - alturaDe(a.nodos, a.nodos[i].der);
            if (d < -1 || d > 1) {
                return string("desequilibrio en el nodo ") + to_string(i);
            }
            if (a.nodos[i].altura != 1 + max(alturaDe(a.nodos, a.nodos[i].izq), alturaDe(a.nodos, a.nodos[i].der))) {
                return string("altura mal anotada en el nodo ") + to_string(i);
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("el árbol que construyes pasa tu validador esAVL", [&] {
        ArbolAVL a;
        for (int x : aleatorios(1500, 100000, 21)) {
            a.insertar(x);
        }
        return esAVL(a.nodos, a.raiz);
    }, true);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // Una sola operación tarda nanosegundos (el reloj no la distingue del ruido): cada repetición hace 1000 seguidas.
    medirCon("cubeta", [](int n) { return n; }, [](int& n) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(cubeta(n * 1234567LL - i, 1009));
        }
    });                                                                                            // O(1)
    medirCon("TablaHashEncadenada.obtener", [](int n) {
        TablaHashEncadenada t;
        vector<int> claves = aleatorios(n, 2000000000, 5);       // claves «al azar»: un patrón regular (múltiplos de algo) crearía grupos
        for (int i = 0; i < n; i++) {
            t.poner(claves[static_cast<size_t>(i)], i);
        }
        return make_pair(std::move(t), std::move(claves));
    }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.obtener(e.second[static_cast<size_t>(i % 32)] + (i % 2)));      // 32 claves siempre «calientes» en caché: la mitad se encuentran y la mitad no
        }
    });                                                                                            // O(1)
    medirCon("TablaHashLineal.obtener", [](int n) {
        TablaHashLineal t;
        vector<int> claves = aleatorios(n, 2000000000, 5);       // claves «al azar»: un patrón regular (múltiplos de algo) crearía grupos
        for (int i = 0; i < n; i++) {
            t.poner(claves[static_cast<size_t>(i)], i);
        }
        return make_pair(std::move(t), std::move(claves));
    }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.obtener(e.second[static_cast<size_t>(i % 32)] + (i % 2)));      // 32 claves siempre «calientes» en caché: la mitad se encuentran y la mitad no
        }
    });                                                                                            // O(1)
    medirCon("esAVL", [](int n) { return arbolEquilibrado(n); }, [](vector<NodoAVL>& t) { return esAVL(t, 0); });   // O(n)
    medirCon("ArbolAVL.contiene", [](int n) {
        ArbolAVL a;
        for (int i = 0; i < n; i++) {
            a.insertar(i);
        }
        return make_pair(std::move(a), n);
    }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.contiene((i * 37) % e.second));
        }
    });                                                                                            // O(log n)
}
