#include <algorithm>
#include <bit>
#include <cstdint>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 10 · ÁRBOLES DE RANGOS (consultas sobre intervalos)
 * ────────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA: tienes un array a[0..n-1] y te hacen muchas preguntas del tipo «¿cuál es la suma (o el mínimo) de
 * a[l..r]?», mezcladas con cambios («ahora a[i] vale v»). Recalcular cada respuesta con un bucle cuesta O(n) y, con
 * n = q = 10⁵ consultas, son 10¹⁰ operaciones: demasiado. Estas estructuras bajan cada operación a O(log n) o O(1).
 *
 *   Estructura               Para qué                                   Construir     Consulta     Actualizar
 *   Sumas prefijas           suma de rango, array QUE NO CAMBIA          O(n)          O(1)         —
 *   Fenwick / BIT            suma de rango CON cambios puntuales         O(n)          O(log n)     O(log n)
 *   Segment tree             suma/mín/máx/mcd... con cambios puntuales   O(n)          O(log n)     O(log n)
 *   Segment tree + lazy      lo mismo con cambios de UN RANGO entero     O(n)          O(log n)     O(log n)
 *   Sparse table             mínimo/máximo de rango, array fijo          O(n log n)    O(1)         —
 *   Binary lifting           ancestro común (LCA) en un árbol            O(n log n)    O(log n)     —
 *   Fenwick + compresión     contar inversiones de un array              —             O(n log n) en total
 *
 * CONVENCIONES DE ESTA LECCIÓN: índices desde 0 y rangos CERRADOS [l, r] (ambos incluidos). Las sumas se guardan en
 * long long: 10⁵ números de 10⁹ ya no caben en un int de 32 bits (desbordamiento = comportamiento indefinido).
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
 * │ Un `vector<int>` es como un ArrayList<Integer> / lista de Python, pero guarda los int JUNTOS en memoria (no hay
 * │ objetos Integer): recorrerlo es muy rápido para la caché. `v[i]` NO comprueba límites (UB si te sales); `v.at(i)`
 * │ sí y lanza std::out_of_range. Las estructuras de esta lección guardan sus nodos en vectores planos, sin punteros.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * ┌─ Desde C ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * │ Es el `int arr[4 * N]` de siempre, pero con tamaño dinámico, que se libera solo al salir del ámbito (RAII) y que
 * │ se copia entero si lo pasas por valor: pasa `const vector<int>&` para evitar la copia.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Cuenta cuántas celdas visita el bucle ingenuo: para ver por qué hacen falta estructuras. */
long long costeIngenuo(int n, int consultas)
{
    return static_cast<long long>(n) * consultas;
}

/**
 * Sumas prefijas con comentarios: p[i] = a[0] + ... + a[i-1] (p[0] = 0). La suma de [l, r] es p[r+1] - p[l].
 * Es la idea de la que nacen casi todas las demás: «guarda acumulados y resta».
 */
vector<long long> prefijasDemo(const vector<int>& a)
{
    vector<long long> p(a.size() + 1, 0);     // long long desde el principio: la suma acumulada se sale de int enseguida
    for (size_t i = 0; i < a.size(); i++) {
        p[i + 1] = p[i] + a[i];
    }
    return p;
}

/** El bit menos significativo encendido de i: 12 (1100) → 4 (0100). Es el truco del árbol de Fenwick. */
int ultimoBit(int i)
{
    return i & -i;                            // -i es el complemento a dos: invierte todo y suma 1, y deja solo ese bit
}

/**
 * Segment tree RECURSIVO (de arriba abajo) de sumas: la versión «de libro». El nodo 1 es la raíz y cubre [0, n-1];
 * el nodo k tiene hijos 2k (mitad izquierda) y 2k+1 (mitad derecha). Cada nodo guarda la suma de su segmento.
 * Hacen falta hasta 4n nodos (el árbol no siempre es perfecto). Este sirve de modelo para los ejercicios.
 */
struct ArbolSumaRec {
    int n;
    vector<long long> t;                      // t[nodo] = suma del segmento que cubre ese nodo

    explicit ArbolSumaRec(const vector<int>& a) : n(static_cast<int>(a.size())), t(4 * max<size_t>(1, a.size()), 0)
    {
        if (n > 0) {
            construir(1, 0, n - 1, a);
        }
    }

    void construir(int nodo, int l, int r, const vector<int>& a)
    {
        if (l == r) {                         // hoja: un solo elemento
            t[nodo] = a[l];
            return;
        }
        int m = l + (r - l) / 2;              // (l + r) / 2 puede desbordar con índices enormes; esta forma, no
        construir(2 * nodo, l, m, a);
        construir(2 * nodo + 1, m + 1, r, a);
        t[nodo] = t[2 * nodo] + t[2 * nodo + 1];
    }

    void asignar(int i, int valor) { asignar(1, 0, n - 1, i, valor); }

    void asignar(int nodo, int l, int r, int i, int valor)
    {
        if (l == r) {
            t[nodo] = valor;
            return;
        }
        int m = l + (r - l) / 2;
        if (i <= m) {
            asignar(2 * nodo, l, m, i, valor);
        } else {
            asignar(2 * nodo + 1, m + 1, r, i, valor);
        }
        t[nodo] = t[2 * nodo] + t[2 * nodo + 1];   // al volver, recalcula el camino hasta la raíz
    }

    long long suma(int ql, int qr) const { return suma(1, 0, n - 1, ql, qr); }

    long long suma(int nodo, int l, int r, int ql, int qr) const
    {
        if (qr < l || r < ql) {
            return 0;                         // el segmento no se toca con la consulta: elemento neutro de la suma
        }
        if (ql <= l && r <= qr) {
            return t[nodo];                   // contenido por completo: respuesta ya guardada
        }
        int m = l + (r - l) / 2;
        return suma(2 * nodo, l, m, ql, qr) + suma(2 * nodo + 1, m + 1, r, ql, qr);
    }
};

/** Cuántos nodos visita una consulta [ql, qr] en un árbol de n hojas: nunca más de ~4·log₂ n. */
int nodosVisitados(int l, int r, int ql, int qr)
{
    if (qr < l || r < ql) {
        return 1;
    }
    if ((ql <= l && r <= qr) || l == r) {
        return 1;
    }
    int m = l + (r - l) / 2;
    return 1 + nodosVisitados(l, m, ql, qr) + nodosVisitados(m + 1, r, ql, qr);
}

/** Tabla de saltos de potencias de dos de un árbol: salto[k][v] = el ancestro 2^k niveles por encima de v. */
vector<vector<int>> tablaSaltos(const vector<int>& padre)
{
    int n = static_cast<int>(padre.size());
    int niveles = max(1, bit_width(static_cast<unsigned>(n)));
    vector<vector<int>> salto(niveles, vector<int>(n, 0));
    for (int v = 0; v < n; v++) {
        salto[0][v] = padre[v] < 0 ? v : padre[v];      // la raíz se «apunta a sí misma»: así nunca nos salimos
    }
    for (int k = 1; k < niveles; k++) {
        for (int v = 0; v < n; v++) {
            salto[k][v] = salto[k - 1][salto[k - 1][v]];    // dar dos saltos de 2^(k-1) = uno de 2^k
        }
    }
    return salto;
}

/** Fuerza bruta de inversiones: O(n²). Sirve de referencia en las pruebas. */
long long inversionesLento(const vector<int>& a)
{
    long long c = 0;
    for (size_t i = 0; i < a.size(); i++) {
        for (size_t j = i + 1; j < a.size(); j++) {
            if (a[i] > a[j]) {
                c++;
            }
        }
    }
    return c;
}

/** Ancestro común lento (sube de padre en padre). Referencia de las pruebas de AncestroComun. */
int lcaLento(const vector<int>& padre, int a, int b)
{
    vector<char> marca(padre.size(), 0);
    for (int v = a; v != -1; v = padre[v]) {
        marca[v] = 1;
    }
    for (int v = b; v != -1; v = padre[v]) {
        if (marca[v]) {
            return v;
        }
    }
    return -1;
}

/** Un array de enteros «raro» (con negativos) pero reproducible, para comparar contra la fuerza bruta. */
vector<int> conSigno(int n, int semilla)
{
    vector<int> v = aleatorios(n, 2000, semilla);
    for (int& x : v) {
        x -= 1000;
    }
    return v;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · sumasPrefijas ──────────────────────────────────────────────
/**
 * Devuelve p con n+1 elementos: p[0] = 0 y p[i] = a[0] + ... + a[i-1]. Así la suma de a[l..r] (ambos incluidos) es
 * `p[r+1] - p[l]` en O(1). Vector vacío → {0}.
 * Trampa de C++: acumula en `long long`. Con int, 100.000 números de 100.000 suman 10¹⁰ y el desbordamiento de un int con
 * signo es COMPORTAMIENTO INDEFINIDO (el compilador puede hacer lo que quiera; no «da la vuelta» como en Java).
 * Trampa 2: `a.size()` es `size_t` (sin signo): `a.size() - 1` con el vector vacío da 18.446.744.073.709.551.615.
 * Coste: O(n).
 */
vector<long long> sumasPrefijas(const vector<int>& a)
{
    return pendiente();
}

// ── Ejercicio 2 · Fenwick (árbol indexado binario, BIT) ──────────────────────
/**
 * Suma de rango con actualizaciones puntuales, en O(log n), con MUY poco código. Guarda un vector `t` de n+1 posiciones
 * (el 0 no se usa) donde t[i] contiene la suma de las `i & -i` posiciones que terminan en i (1-indexado):
 *     t[8] cubre 1..8, t[6] cubre 5..6, t[7] cubre 7..7, t[12] cubre 9..12...
 *   - sumar(i, v): suma v a la posición i (0-indexada): `for (i++; i <= n; i += i & -i) t[i] += v;`
 *   - prefijo(i): suma de a[0..i]:                       `for (i++; i > 0; i -= i & -i) s += t[i];`   (prefijo(-1) = 0)
 *   - suma(l, r): prefijo(r) - prefijo(l - 1).
 * Nace con todo a cero: `Fenwick f(n)`. Un índice fuera de [0, n-1] lanza `out_of_range` (con `t[i]` sin comprobar sería UB);
 * n negativo lanza `invalid_argument`; suma(l, r) con l > r lanza `invalid_argument`.
 * Trampas: mezclar el índice 0-indexado de fuera con el 1-indexado de dentro (el árbol NO funciona con índice 0:
 * `0 & -0` es 0 y el bucle no avanza nunca), y usar int en vez de long long.
 */
struct Fenwick {
    explicit Fenwick(int n)
    {
        pendiente();
    }

    void sumar(int i, long long v)
    {
        pendiente();
    }

    long long prefijo(int i) const
    {
        return pendiente();
    }

    long long suma(int l, int r) const
    {
        return pendiente();
    }
};

// ── Ejercicio 3 · ArbolMinimos (segment tree iterativo) ──────────────────────
/**
 * Mínimo de un rango con asignaciones puntuales, en O(log n), con el segment tree ITERATIVO de abajo arriba: un vector
 * `t` de 2n posiciones; las hojas son t[n..2n-1] (t[n+i] = a[i]) y cada nodo interno es el mínimo de sus dos hijos:
 * `t[i] = min(t[2i], t[2i+1])`. No hay recursión ni hace falta que n sea potencia de dos.
 *   - asignar(i, v): `i += n; t[i] = v; for (i >>= 1; i >= 1; i >>= 1) t[i] = min(t[2i], t[2i+1]);`
 *   - minimo(l, r): `res = INT_MAX; for (l += n, r += n + 1; l < r; l >>= 1, r >>= 1)` { si l es impar (`l & 1`) toma t[l++];
 *     si r es impar toma t[--r]; }` (el rango se trata como semiabierto [l, r+1)).
 * Índices fuera de rango → out_of_range; l > r → invalid_argument. Un vector vacío es válido (no admite consultas).
 */
struct ArbolMinimos {
    explicit ArbolMinimos(const vector<int>& a)
    {
        pendiente();
    }

    void asignar(int i, int v)
    {
        pendiente();
    }

    int minimo(int l, int r) const
    {
        return pendiente();
    }
};

// ── Ejercicio 4 · ArbolLazy (propagación perezosa) ───────────────────────────
/**
 * Segment tree que admite SUMAR UN VALOR A TODO UN RANGO y consultar la SUMA de un rango, ambos en O(log n).
 * Si al sumar v a [l, r] tocaras las hojas una a una serían O(n). La idea PEREZOSA: cuando un nodo queda totalmente dentro
 * del rango, se actualiza solo él (`t[nodo] += v * (longitud del segmento)`) y se deja una «deuda» `pend[nodo] += v` para
 * sus hijos. Esa deuda se paga (se «empuja» a los hijos) justo antes de bajar a ellos, tanto al actualizar como al consultar.
 * Receta recursiva con nodo/l/r como en `ArbolSumaRec`:
 *   empujar(nodo, l, r): si pend[nodo] != 0 → aplícala a los dos hijos (t y pend) y ponla a 0.
 *   sumarRango: fuera → nada; dentro → actualiza t y pend de ese nodo; si no, empujar, bajar a ambos hijos y recalcular t.
 *   suma: igual que la consulta normal pero llamando a empujar antes de bajar.
 * Usa long long en `t` y en `pend`. Mismos errores que Fenwick: fuera de rango → out_of_range, l > r → invalid_argument.
 */
struct ArbolLazy {
    explicit ArbolLazy(const vector<int>& a)
    {
        pendiente();
    }

    void sumarRango(int l, int r, int v)
    {
        pendiente();
    }

    long long suma(int l, int r)
    {
        return pendiente();
    }
};

// ── Ejercicio 5 · TablaDispersa (sparse table) ───────────────────────────────
/**
 * Mínimo de un rango en O(1) (!) para un array QUE NO CAMBIA, a cambio de O(n log n) de memoria y de construcción.
 * `t[k][i]` = mínimo de los 2^k elementos que empiezan en i: t[0] = el array, y t[k][i] = min(t[k-1][i], t[k-1][i + 2^(k-1)]).
 * Para consultar [l, r]: sea k = floor(log2(r - l + 1)); los dos bloques de longitud 2^k que empiezan en l y que terminan en
 * r **se solapan**, pero para el mínimo eso da igual: `min(t[k][l], t[k][r - 2^k + 1])`. (Con sumas NO valdría: contaría dos
 * veces el solape.)
 * floor(log2(x)) sin float: `bit_width(x) - 1` de <bit> (C++20; `bit_width` necesita un tipo SIN signo: `unsigned`).
 * l > r → invalid_argument; fuera de [0, n-1] → out_of_range.
 */
struct TablaDispersa {
    explicit TablaDispersa(const vector<int>& a)
    {
        pendiente();
    }

    int minimo(int l, int r) const
    {
        return pendiente();
    }
};

// ── Ejercicio 6 · AncestroComun (LCA con binary lifting) ─────────────────────
/**
 * Árbol dado por `padre[v]` (la raíz es el nodo 0 con padre -1; se garantiza `padre[v] < v` para v > 0, así que el padre
 * siempre está calculado antes que el hijo). Responde en O(log n):
 *   - lca(a, b): el ancestro común más profundo (un nodo es ancestro de sí mismo).
 *   - ancestro(v, k): el ancestro k niveles por encima de v, o -1 si te sales por la raíz.
 * Construcción: profundidad `prof[v] = prof[padre[v]] + 1`; `salto[k][v]` = ancestro a 2^k niveles (mira `tablaSaltos` arriba;
 * la raíz «salta a sí misma»). lca: (1) sube al más profundo hasta la profundidad del otro descomponiendo la diferencia en
 * bits; (2) si ya son el mismo nodo, ese es el LCA; (3) si no, para k de mayor a menor, `if (salto[k][a] != salto[k][b])` sube
 * AMBOS; (4) el padre de cualquiera de los dos es el LCA.
 * Un padre inválido (fuera de [0, v-1]) → invalid_argument en el constructor; un nodo fuera de rango → out_of_range.
 */
struct AncestroComun {
    explicit AncestroComun(const vector<int>& padre)
    {
        pendiente();
    }

    int lca(int a, int b) const
    {
        return pendiente();
    }

    int ancestro(int v, int k) const
    {
        return pendiente();
    }
};

// ── Ejercicio 7 · contarInversiones ──────────────────────────────────────────
/**
 * Una INVERSIÓN es un par de posiciones i < j con a[i] > a[j] (estrictamente: los iguales no cuentan). [2, 4, 1, 3, 5] tiene 3:
 * (2,1), (4,1), (4,3). Mide cuánto de desordenado está un array. La fuerza bruta (`inversionesLento`) es O(n²).
 * Solución O(n log n) con un Fenwick de CONTADORES: (1) comprime los valores a rangos 1..m (ordena una copia, quita repetidos
 * con `unique` y busca cada valor con `lower_bound`); (2) recorre el array de izquierda a derecha: las inversiones que
 * termina el elemento actual x son los ya vistos MAYORES que x = `vistos - consulta(rango(x))`; (3) suma 1 en rango(x).
 * El resultado puede ser n(n-1)/2 ≈ 5·10⁹ para n = 10⁵: ¡no cabe en int! Devuelve long long.
 */
long long contarInversiones(const vector<int>& a)
{
    return pendiente();
}

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. EL PROBLEMA Y LAS SUMAS PREFIJAS
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1. Consultas de rango y sumas prefijas");

    vector<int> datos = {5, 2, 7, 1, 9, 3, 8, 4};
    cout << "datos       = " << mostrar(datos) << "\n";
    vector<long long> pref = prefijasDemo(datos);
    cout << "prefijas    = " << mostrar(pref) << "\n";
    cout << "suma[2..5]  = p[6] - p[2] = " << pref[6] - pref[2] << "   (7 + 1 + 9 + 3 = 20)\n";
    cout << "Con n = q = 100000, el bucle ingenuo hace " << costeIngenuo(100000, 100000) << " pasos.\n";
    // Las sumas prefijas no sirven si el array cambia: tocar a[i] obliga a recalcular p[i+1..n]: O(n) por cambio.
    // Los árboles de abajo reparten el trabajo entre consultas y cambios para que ambos cuesten O(log n).

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ÁRBOL DE FENWICK (BIT)
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. Fenwick: qué cubre cada posición");

    // t[i] guarda la suma de las (i & -i) posiciones que acaban en i (índices 1..n):
    for (int i = 1; i <= 12; i++) {
        cout << "t[" << i << "] cubre (" << i - ultimoBit(i) << ", " << i << "]  → " << ultimoBit(i) << " posiciones\n";
    }
    // Para sumar el prefijo 11: t[11] + t[10] + t[8]: se quita el bit bajo cada vez (11 → 10 → 8 → 0): O(log n) pasos.
    cout << "camino de prefijo(11):";
    for (int i = 11; i > 0; i -= ultimoBit(i)) {
        cout << " " << i;
    }
    cout << "\ncamino de sumar en 3:";
    for (int i = 3; i <= 12; i += ultimoBit(i)) {
        cout << " " << i;
    }
    cout << "\n";
    // Mira bien `i & -i`: en C++ funciona con el complemento a dos. Con un int SIN signo (unsigned) también, pero cuidado
    // con `-i` sobre unsigned: da 2^32 - i (legal, pero confunde). Y con INT_MIN, `-i` desborda → UB.

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SEGMENT TREE
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3. Segment tree de sumas");

    ArbolSumaRec arbol(datos);
    cout << "suma[2..5]  = " << arbol.suma(2, 5) << "\n";
    arbol.asignar(3, 100);               // a[3]: 1 → 100
    cout << "tras a[3]=100: suma[2..5] = " << arbol.suma(2, 5) << " (7 + 100 + 9 + 3 = 119)\n";
    // La misma estructura con otra operación asociativa y su elemento neutro: mínimo (neutro = +infinito), máximo
    // (-infinito), mcd (0), producto (1), XOR (0). Lo único que cambia es `+` y el valor que devuelve la rama «fuera».
    // En el ejercicio 3 verás la versión iterativa, más corta y rápida (sin recursión).

// ═══════════════════════════════════════════════════════════════════════════════
// 4. PROPAGACIÓN PEREZOSA (LAZY)
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("4. Lazy propagation: cuántos nodos se tocan");

    // Una consulta o actualización de rango NUNCA visita muchos más de 4·log₂ n nodos, aunque el rango cubra todo el array.
    for (int n : {16, 1024, 65536}) {
        cout << "n = " << n << ": rango [1, n-2] visita " << nodosVisitados(0, n - 1, 1, n - 2)
             << " nodos (n sería " << n << ")\n";
    }
    // Sin lazy, «sumar 3 a [l, r]» tocaría las r-l+1 hojas. Con lazy, los nodos totalmente cubiertos se anotan («debo
    // sumar 3 a todo mi segmento») y la anotación solo baja cuando hace falta mirar más abajo.

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SPARSE TABLE (RMQ EN O(1))
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("5. Sparse table: potencias de dos");

    for (int len : {1, 2, 3, 4, 7, 8, 9, 1000}) {
        // bit_width(x) = nº de bits necesarios = floor(log2 x) + 1. Entra un unsigned.
        cout << "floor(log2(" << len << ")) = " << bit_width(static_cast<unsigned>(len)) - 1 << "\n";
    }
    // Idempotencia: min(x, x) = x, por eso se pueden solapar los dos bloques. Para la suma no se puede (se cuenta doble).

// ═══════════════════════════════════════════════════════════════════════════════
// 6. LCA CON BINARY LIFTING
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("6. Binary lifting: tabla de saltos");

    //        0
    //      /   \         padre = [-1, 0, 0, 1, 1, 2, 3, 3]
    //     1     2
    //    / \     \
    //   3   4     5      (6 y 7 cuelgan de 3)
    vector<int> padre = {-1, 0, 0, 1, 1, 2, 3, 3};
    auto salto = tablaSaltos(padre);
    for (size_t k = 0; k < salto.size(); k++) {
        cout << "salto[" << k << "] (2^" << k << " niveles) = " << mostrar(salto[k]) << "\n";
    }
    cout << "lca lento(6, 4) = " << lcaLento(padre, 6, 4) << ", lca lento(6, 5) = " << lcaLento(padre, 6, 5) << "\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 7. INVERSIONES CON UN BIT
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("7. Inversiones");

    vector<int> casi = {2, 4, 1, 3, 5};
    cout << "inversiones de " << mostrar(casi) << " = " << inversionesLento(casi) << "\n";
    cout << "inversiones de [5,4,3,2,1] = " << inversionesLento({5, 4, 3, 2, 1}) << " (el máximo: n(n-1)/2)\n";

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    prueba(sumasPrefijas,
        caso("ejemplo", vector<long long>{0, 5, 7, 14, 15}, vector<int>{5, 2, 7, 1}),
        caso("vacío", vector<long long>{0}, vector<int>{}),
        caso("un elemento", vector<long long>{0, -3}, vector<int>{-3}),
        caso("negativos", vector<long long>{0, -1, 0, -2}, vector<int>{-1, 1, -2}));
    grupo("sumasPrefijas (más casos)");
    comprueba("no desborda un int (3 valores de 10⁹)", [&] {
        return sumasPrefijas(vector<int>(3, 1000000000)).back();
    }, 3000000000LL);
    comprueba("suma de rango = p[r+1] - p[l] frente a std::accumulate", [&] {
        vector<int> v = conSigno(300, 4);
        auto p = sumasPrefijas(v);
        for (int l = 0; l < 300; l += 7) {
            for (int r = l; r < 300; r += 11) {
                if (p[r + 1] - p[l] != accumulate(v.begin() + l, v.begin() + r + 1, 0LL)) {
                    return string("falla en [") + to_string(l) + ", " + to_string(r) + "]";
                }
            }
        }
        return string("ok");
    }, string("ok"));

    grupo("Fenwick");
    comprueba("prefijo tras sumar", [&] {
        Fenwick f(8);
        for (int i = 0; i < 8; i++) {
            f.sumar(i, i + 1);                                   // 1 2 3 4 5 6 7 8
        }
        return f.prefijo(4);
    }, 15LL);
    comprueba("suma de rango [2, 5]", [&] {
        Fenwick f(8);
        for (int i = 0; i < 8; i++) {
            f.sumar(i, i + 1);
        }
        return f.suma(2, 5);
    }, 18LL);
    comprueba("prefijo(-1) es 0 (rango vacío)", [&] { return Fenwick(5).prefijo(-1); }, 0LL);
    comprueba("n = 1", [&] {
        Fenwick f(1);
        f.sumar(0, 42);
        return f.suma(0, 0);
    }, 42LL);
    comprueba("sumar acumula, también valores negativos", [&] {
        Fenwick f(4);
        f.sumar(2, 10);
        f.sumar(2, -4);
        return f.suma(2, 2);
    }, 6LL);
    comprueba("valores grandes no desbordan (long long)", [&] {
        Fenwick f(3);
        for (int i = 0; i < 3; i++) {
            f.sumar(i, 2000000000LL);
        }
        return f.suma(0, 2);
    }, 6000000000LL);
    comprueba("coincide con fuerza bruta en 2000 operaciones", [&] {
        int n = 37;
        Fenwick f(n);
        vector<long long> ref(n, 0);
        vector<int> azar = aleatorios(6000, 100000, 3);
        for (int k = 0; k < 2000; k++) {
            int i = azar[3 * k] % n;
            int a = azar[3 * k + 1] % n;
            int b = azar[3 * k + 2] % n;
            long long v = azar[3 * k] - 50000;
            f.sumar(i, v);
            ref[i] += v;
            int l = min(a, b);
            int r = max(a, b);
            if (f.suma(l, r) != accumulate(ref.begin() + l, ref.begin() + r + 1, 0LL)) {
                return string("falla en la operación ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("índice fuera de rango en sumar", [&] { Fenwick f(4); f.sumar(4, 1); }, out_of_range);
    lanza("índice negativo en sumar", [&] { Fenwick f(4); f.sumar(-1, 1); }, out_of_range);
    lanza("l > r", [&] { Fenwick f(4); f.suma(3, 1); }, invalid_argument);
    lanza("tamaño negativo", [&] { Fenwick f(-2); }, invalid_argument);

    grupo("ArbolMinimos");
    comprueba("mínimo de rangos", [&] {
        ArbolMinimos t(vector<int>{5, 2, 7, 1, 9, 3, 8, 4});
        return vector<int>{t.minimo(0, 7), t.minimo(0, 2), t.minimo(4, 7), t.minimo(2, 2), t.minimo(4, 5)};
    }, vector<int>{1, 2, 3, 7, 3});
    comprueba("asignar baja el mínimo", [&] {
        ArbolMinimos t(vector<int>{5, 2, 7, 1});
        t.asignar(2, -10);
        return t.minimo(1, 3);
    }, -10);
    comprueba("asignar sube el mínimo", [&] {
        ArbolMinimos t(vector<int>{5, 2, 7, 1});
        t.asignar(3, 100);
        return t.minimo(2, 3);
    }, 7);
    comprueba("un solo elemento", [&] {
        ArbolMinimos t(vector<int>{9});
        t.asignar(0, 4);
        return t.minimo(0, 0);
    }, 4);
    comprueba("tamaño que no es potencia de dos (n = 13)", [&] {
        vector<int> v = conSigno(13, 8);
        ArbolMinimos t(v);
        for (int l = 0; l < 13; l++) {
            for (int r = l; r < 13; r++) {
                if (t.minimo(l, r) != *min_element(v.begin() + l, v.begin() + r + 1)) {
                    return string("falla en [") + to_string(l) + ", " + to_string(r) + "]";
                }
            }
        }
        return string("ok");
    }, string("ok"));
    comprueba("coincide con fuerza bruta con asignaciones intercaladas", [&] {
        int n = 50;
        vector<int> ref = conSigno(n, 9);
        ArbolMinimos t(ref);
        vector<int> azar = aleatorios(4000, 1000, 5);
        for (int k = 0; k < 1000; k++) {
            int i = azar[4 * k] % n;
            ref[i] = azar[4 * k + 1] - 500;
            t.asignar(i, ref[i]);
            int a = azar[4 * k + 2] % n;
            int b = azar[4 * k + 3] % n;
            int l = min(a, b);
            int r = max(a, b);
            if (t.minimo(l, r) != *min_element(ref.begin() + l, ref.begin() + r + 1)) {
                return string("falla en la operación ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("rango fuera", [&] { ArbolMinimos t(vector<int>{1, 2}); t.minimo(0, 2); }, out_of_range);
    lanza("l > r", [&] { ArbolMinimos t(vector<int>{1, 2}); t.minimo(1, 0); }, invalid_argument);

    grupo("ArbolLazy");
    comprueba("suma sin actualizaciones", [&] {
        ArbolLazy t(vector<int>{5, 2, 7, 1, 9});
        return t.suma(1, 3);
    }, 10LL);
    comprueba("sumar a un rango", [&] {
        ArbolLazy t(vector<int>{1, 1, 1, 1, 1, 1});
        t.sumarRango(1, 3, 5);
        return vector<long long>{t.suma(0, 5), t.suma(1, 1), t.suma(0, 0), t.suma(3, 4)};
    }, vector<long long>{21, 6, 1, 7});
    comprueba("dos rangos solapados", [&] {
        ArbolLazy t(vector<int>(8, 0));
        t.sumarRango(0, 5, 2);
        t.sumarRango(3, 7, 10);
        return t.suma(0, 7);
    }, 62LL);
    comprueba("todo el array", [&] {
        ArbolLazy t(vector<int>{1, 2, 3});
        t.sumarRango(0, 2, -1);
        return t.suma(0, 2);
    }, 3LL);
    comprueba("un elemento", [&] {
        ArbolLazy t(vector<int>{4});
        t.sumarRango(0, 0, 6);
        return t.suma(0, 0);
    }, 10LL);
    comprueba("no desborda un int", [&] {
        ArbolLazy t(vector<int>(4, 0));
        t.sumarRango(0, 3, 1000000000);
        t.sumarRango(0, 3, 1000000000);
        return t.suma(0, 3);
    }, 8000000000LL);
    comprueba("coincide con fuerza bruta (1500 operaciones mezcladas)", [&] {
        int n = 41;
        vector<int> inicial = conSigno(n, 12);
        vector<long long> ref(inicial.begin(), inicial.end());
        ArbolLazy t(inicial);
        vector<int> azar = aleatorios(6000, 1000, 7);
        for (int k = 0; k < 1500; k++) {
            int a = azar[4 * k] % n;
            int b = azar[4 * k + 1] % n;
            int l = min(a, b);
            int r = max(a, b);
            if (k % 2 == 0) {
                int v = azar[4 * k + 2] - 500;
                t.sumarRango(l, r, v);
                for (int i = l; i <= r; i++) {
                    ref[i] += v;
                }
            } else if (t.suma(l, r) != accumulate(ref.begin() + l, ref.begin() + r + 1, 0LL)) {
                return string("falla en la operación ") + to_string(k);
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("rango fuera", [&] { ArbolLazy t(vector<int>{1, 2}); t.sumarRango(0, 5, 1); }, out_of_range);
    lanza("l > r", [&] { ArbolLazy t(vector<int>{1, 2}); t.suma(1, 0); }, invalid_argument);

    grupo("TablaDispersa");
    comprueba("mínimos de rangos", [&] {
        TablaDispersa t(vector<int>{5, 2, 7, 1, 9, 3, 8, 4});
        return vector<int>{t.minimo(0, 7), t.minimo(0, 2), t.minimo(4, 7), t.minimo(2, 2), t.minimo(4, 5), t.minimo(1, 3)};
    }, vector<int>{1, 2, 3, 7, 3, 1});
    comprueba("un elemento", [&] { return TablaDispersa(vector<int>{-7}).minimo(0, 0); }, -7);
    comprueba("longitud no potencia de dos (solapa los bloques)", [&] {
        TablaDispersa t(vector<int>{9, 4, 6, 8, 5});
        return t.minimo(0, 4);
    }, 4);
    comprueba("coincide con fuerza bruta en todos los rangos (n = 33)", [&] {
        vector<int> v = conSigno(33, 21);
        TablaDispersa t(v);
        for (int l = 0; l < 33; l++) {
            for (int r = l; r < 33; r++) {
                if (t.minimo(l, r) != *min_element(v.begin() + l, v.begin() + r + 1)) {
                    return string("falla en [") + to_string(l) + ", " + to_string(r) + "]";
                }
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("l > r", [&] { TablaDispersa t(vector<int>{1, 2, 3}); t.minimo(2, 1); }, invalid_argument);
    lanza("fuera de rango", [&] { TablaDispersa t(vector<int>{1, 2, 3}); t.minimo(0, 3); }, out_of_range);

    grupo("AncestroComun");
    comprueba("LCA en el árbol del ejemplo", [&] {
        AncestroComun t(padre);
        return vector<int>{t.lca(6, 4), t.lca(6, 5), t.lca(3, 4), t.lca(7, 6), t.lca(5, 5)};
    }, vector<int>{1, 0, 1, 3, 5});
    comprueba("un nodo es ancestro de sí mismo y de sus descendientes", [&] {
        AncestroComun t(padre);
        return vector<int>{t.lca(1, 7), t.lca(7, 1), t.lca(0, 5)};
    }, vector<int>{1, 1, 0});
    comprueba("ancestro(v, k)", [&] {
        AncestroComun t(padre);
        return vector<int>{t.ancestro(6, 0), t.ancestro(6, 1), t.ancestro(6, 2), t.ancestro(6, 3), t.ancestro(6, 4), t.ancestro(0, 1)};
    }, vector<int>{6, 3, 1, 0, -1, -1});
    comprueba("árbol de un solo nodo", [&] {
        AncestroComun t(vector<int>{-1});
        return t.lca(0, 0);
    }, 0);
    comprueba("cadena larga (10000 nodos): ancestro a 8191 niveles", [&] {
        vector<int> cadena(10000);
        cadena[0] = -1;
        for (int i = 1; i < 10000; i++) {
            cadena[i] = i - 1;
        }
        AncestroComun t(cadena);
        return vector<int>{t.ancestro(9999, 8191), t.lca(9999, 5000), t.ancestro(9999, 9999), t.ancestro(9999, 10000)};
    }, vector<int>{1808, 5000, 0, -1});
    comprueba("coincide con el LCA lento en un árbol aleatorio", [&] {
        int n = 300;
        vector<int> p(n, -1);
        vector<int> azar = aleatorios(n, 1000000, 31);
        for (int i = 1; i < n; i++) {
            p[i] = azar[i] % i;
        }
        AncestroComun t(p);
        for (int a = 0; a < n; a += 3) {
            for (int b = 0; b < n; b += 5) {
                if (t.lca(a, b) != lcaLento(p, a, b)) {
                    return string("falla con ") + to_string(a) + " y " + to_string(b);
                }
            }
        }
        return string("ok");
    }, string("ok"));
    lanza("padre inválido", [&] { AncestroComun t(vector<int>{-1, 0, 5}); }, invalid_argument);
    lanza("nodo fuera de rango", [&] { AncestroComun t(vector<int>{-1, 0}); t.lca(0, 2); }, out_of_range);

    prueba(contarInversiones,
        caso("ejemplo", 3LL, vector<int>{2, 4, 1, 3, 5}),
        caso("ordenado", 0LL, vector<int>{1, 2, 3, 4}),
        caso("al revés", 10LL, vector<int>{5, 4, 3, 2, 1}),
        caso("vacío", 0LL, vector<int>{}),
        caso("un elemento", 0LL, vector<int>{7}),
        caso("los repetidos no cuentan", 0LL, vector<int>{2, 2, 2, 2}),
        caso("repetidos mezclados", 3LL, vector<int>{3, 1, 3, 1}),
        caso("negativos", 3LL, vector<int>{0, -5, -10}),
        caso("extremos de int", 1LL, vector<int>{2147483647, -2147483647 - 1}));
    grupo("contarInversiones (más casos)");
    comprueba("n = 100000 al revés: n(n-1)/2 no cabe en int", [&] {
        vector<int> v(100000);
        iota(v.rbegin(), v.rend(), 1);
        return contarInversiones(v);
    }, 4999950000LL);
    comprueba("coincide con la fuerza bruta en arrays aleatorios", [&] {
        for (int semilla = 1; semilla <= 30; semilla++) {
            vector<int> v = conSigno(5 + semilla * 3, semilla);
            if (contarInversiones(v) != inversionesLento(v)) {
                return string("falla con la semilla ") + to_string(semilla);
            }
        }
        return string("ok");
    }, string("ok"));

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    medir(sumasPrefijas, aleatorios(n, 1000, 1));                                                  // O(n)
    medir(contarInversiones, aleatorios(n, 1000000, 1));                                           // O(n log n)
    // Una sola operación tarda nanosegundos (el reloj no la distingue del ruido): cada repetición hace 1000 seguidas.
    medirCon("Fenwick.suma", [](int n) { return make_pair(Fenwick(n), n); }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.suma(i % e.second, e.second - 1));
        }
    });                                                                                            // O(log n)
    medirCon("ArbolMinimos.minimo", [](int n) { return make_pair(ArbolMinimos(aleatorios(n, 100000, 2)), n); }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.minimo(i % e.second, e.second - 1));
        }
    });                                                                                            // O(log n)
    medirCon("ArbolLazy.suma", [](int n) { return make_pair(ArbolLazy(aleatorios(n, 100000, 3)), n); }, [](auto& e) {
        for (int i = 0; i < 500; i++) {
            e.first.sumarRango(i % e.second, e.second - 1, 1);
            noOptimizar(e.first.suma(0, e.second - 1 - i % e.second));
        }
    });                                                                                            // O(log n)
    medirCon("TablaDispersa.minimo", [](int n) { return make_pair(TablaDispersa(aleatorios(n, 100000, 4)), n); }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.minimo(i % e.second, e.second - 1));
        }
    });                                                                                            // O(1)
    medirCon("AncestroComun.lca", [](int n) {
        vector<int> p(n, -1);
        for (int i = 1; i < n; i++) {
            p[i] = i % 5 == 0 ? max(0, i - 3) : i - 1;       // casi una cadena: la profundidad crece con n
        }
        return make_pair(AncestroComun(p), n);
    }, [](auto& e) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(e.first.lca(e.second - 1 - i % 3, (i * 37) % e.second));
        }
    });                                                                                            // O(log n)
}
