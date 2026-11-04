#include <algorithm>
#include <bit>
#include <climits>
#include <stdexcept>
#include <string>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 10 · Árboles de rangos
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Sumas prefijas.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @explicacion `p[i + 1] = p[i] + a[i]` va acumulando; la suma de a[l..r] es `p[r + 1] - p[l]` porque los términos de 0 a l-1 se
 * cancelan. El acumulador es `long long`: con int, la suma de unos pocos valores grandes desborda y eso es comportamiento indefinido
 * en C++ (no «da la vuelta» como en Java). Se construye `p(a.size() + 1)` y se indexa con `size_t`; el vector vacío da {0}
 * sin tener que restar 1 a un tamaño sin signo.
 * @alternativas Un `partial_sum` o `inclusive_scan` de <numeric> hace lo mismo en una línea, pero necesita el 0 inicial a mano.
 * Si el array cambia entre consultas, las sumas prefijas ya no sirven (cada cambio cuesta O(n)): usa Fenwick o un segment tree.
 * @bigo n
 */
vector<long long> sumasPrefijas(const vector<int>& a)
{
    vector<long long> p(a.size() + 1, 0);
    for (size_t i = 0; i < a.size(); i++) {
        p[i + 1] = p[i] + a[i];
    }
    return p;
}

/**
 * Árbol de Fenwick (BIT) de sumas.
 *
 * @complejidad Construcción O(n); `sumar`, `prefijo` y `suma` O(log n); espacio O(n).
 * @explicacion La posición 1-indexada i guarda la suma de las `i & -i` posiciones que terminan en ella (`i & -i` aísla el bit
 * encendido más bajo). Subir con `i += i & -i` visita todos los nodos que CONTIENEN a la posición (los que hay que actualizar); bajar
 * con `i -= i & -i` visita los bloques disjuntos que componen el prefijo [1..i]. Cada paso cambia un bit, así que son como mucho
 * log₂ n pasos. `suma(l, r)` es la resta de dos prefijos. Los índices se validan con una excepción: `t[i]` fuera de límites sería UB.
 * El vector es `long long` para que las sumas grandes no desborden.
 * @alternativas Un segment tree hace lo mismo (y más: mínimos, lazy...) con más código y el doble de memoria. Un Fenwick solo
 * sirve para operaciones con inverso (suma, XOR), no para mínimos.
 * @bigo log
 */
struct Fenwick {
    int n;
    vector<long long> t;

    explicit Fenwick(int n_) : n(n_), t(static_cast<size_t>(max(n_, 0)) + 1, 0)
    {
        if (n_ < 0) {
            throw invalid_argument("Fenwick: el tamaño no puede ser negativo");
        }
    }

    void sumar(int i, long long v)
    {
        if (i < 0 || i >= n) {
            throw out_of_range("Fenwick::sumar: índice fuera de rango");
        }
        for (i++; i <= n; i += i & -i) {
            t[i] += v;
        }
    }

    long long prefijo(int i) const
    {
        if (i < -1 || i >= n) {
            throw out_of_range("Fenwick::prefijo: índice fuera de rango");
        }
        long long s = 0;
        for (i++; i > 0; i -= i & -i) {
            s += t[i];
        }
        return s;
    }

    long long suma(int l, int r) const
    {
        if (l > r) {
            throw invalid_argument("Fenwick::suma: l > r");
        }
        if (l < 0) {
            throw out_of_range("Fenwick::suma: índice fuera de rango");
        }
        return prefijo(r) - prefijo(l - 1);
    }
};

/**
 * Segment tree iterativo de mínimos.
 *
 * @complejidad Construcción O(n); `asignar` y `minimo` O(log n); espacio O(n) (2n posiciones).
 * @explicacion Las hojas viven en t[n..2n-1] y cada nodo interno i es el mínimo de t[2i] y t[2i+1]. Al asignar se cambia la hoja
 * y se sube recalculando los padres (`i >>= 1`). Para consultar [l, r] se convierte en semiabierto [l+n, r+n+1) y se sube un nivel cada
 * vuelta: si el borde izquierdo es un hijo derecho (impar) su nodo se toma entero y se avanza; si el borde derecho es impar, se retrocede
 * y se toma el nodo de su izquierda. Cuando se cruzan, el intervalo queda cubierto por O(log n) nodos disjuntos. Funciona con
 * cualquier n (no hace falta potencia de dos) porque cada nodo solo se combina con los suyos propios.
 * @alternativas La versión recursiva (4n nodos) es más fácil de extender a lazy. Si el array no cambia, la sparse table responde en O(1).
 * @bigo log
 */
struct ArbolMinimos {
    int n;
    vector<int> t;

    explicit ArbolMinimos(const vector<int>& a) : n(static_cast<int>(a.size())), t(2 * a.size(), 0)
    {
        for (int i = 0; i < n; i++) {
            t[n + i] = a[i];
        }
        for (int i = n - 1; i >= 1; i--) {
            t[i] = min(t[2 * i], t[2 * i + 1]);
        }
    }

    void asignar(int i, int v)
    {
        if (i < 0 || i >= n) {
            throw out_of_range("ArbolMinimos::asignar: índice fuera de rango");
        }
        for (t[i += n] = v, i >>= 1; i >= 1; i >>= 1) {
            t[i] = min(t[2 * i], t[2 * i + 1]);
        }
    }

    int minimo(int l, int r) const
    {
        if (l > r) {
            throw invalid_argument("ArbolMinimos::minimo: l > r");
        }
        if (l < 0 || r >= n) {
            throw out_of_range("ArbolMinimos::minimo: rango fuera de límites");
        }
        int res = INT_MAX;
        for (l += n, r += n + 1; l < r; l >>= 1, r >>= 1) {
            if (l & 1) {
                res = min(res, t[l++]);
            }
            if (r & 1) {
                res = min(res, t[--r]);
            }
        }
        return res;
    }
};

/**
 * Segment tree con propagación perezosa: suma de rango y suma sobre rango.
 *
 * @complejidad Construcción O(n); `sumarRango` y `suma` O(log n); espacio O(n).
 * @explicacion Un rango se descompone en O(log n) nodos totalmente cubiertos. En cada uno se actualiza `t[nodo]` (suma del segmento)
 * sumándole `v` por su longitud y se anota `pend[nodo] += v`, la deuda que deben cobrar sus hijos. Antes de bajar a los hijos
 * (`empujar`) se paga: se aplica la deuda a ambos hijos y se borra. Así ninguna operación llega a las hojas salvo que haga falta. El
 * orden importa: empujar ANTES de bajar y recalcular `t[nodo]` DESPUÉS de volver. Todo es `long long`: v × longitud desborda un int.
 * @alternativas Sin lazy, sumar a un rango son O(n). Si solo hay actualización de rango y consulta puntual, basta un Fenwick sobre
 * las diferencias.
 * @bigo log
 */
struct ArbolLazy {
    int n;
    vector<long long> t;
    vector<long long> pend;

    explicit ArbolLazy(const vector<int>& a) : n(static_cast<int>(a.size())), t(4 * max<size_t>(1, a.size()), 0), pend(t.size(), 0)
    {
        if (n > 0) {
            construir(1, 0, n - 1, a);
        }
    }

    void sumarRango(int l, int r, int v)
    {
        comprobar(l, r);
        actualizar(1, 0, n - 1, l, r, v);
    }

    long long suma(int l, int r)
    {
        comprobar(l, r);
        return consultar(1, 0, n - 1, l, r);
    }

private:
    void comprobar(int l, int r) const
    {
        if (l > r) {
            throw invalid_argument("ArbolLazy: l > r");
        }
        if (l < 0 || r >= n) {
            throw out_of_range("ArbolLazy: rango fuera de límites");
        }
    }

    void construir(int nodo, int l, int r, const vector<int>& a)
    {
        if (l == r) {
            t[nodo] = a[l];
            return;
        }
        int m = l + (r - l) / 2;
        construir(2 * nodo, l, m, a);
        construir(2 * nodo + 1, m + 1, r, a);
        t[nodo] = t[2 * nodo] + t[2 * nodo + 1];
    }

    void aplicar(int nodo, int l, int r, long long v)
    {
        t[nodo] += v * (r - l + 1);
        pend[nodo] += v;
    }

    void empujar(int nodo, int l, int r)
    {
        if (pend[nodo] != 0) {
            int m = l + (r - l) / 2;
            aplicar(2 * nodo, l, m, pend[nodo]);
            aplicar(2 * nodo + 1, m + 1, r, pend[nodo]);
            pend[nodo] = 0;
        }
    }

    void actualizar(int nodo, int l, int r, int ql, int qr, long long v)
    {
        if (qr < l || r < ql) {
            return;
        }
        if (ql <= l && r <= qr) {
            aplicar(nodo, l, r, v);
            return;
        }
        empujar(nodo, l, r);
        int m = l + (r - l) / 2;
        actualizar(2 * nodo, l, m, ql, qr, v);
        actualizar(2 * nodo + 1, m + 1, r, ql, qr, v);
        t[nodo] = t[2 * nodo] + t[2 * nodo + 1];
    }

    long long consultar(int nodo, int l, int r, int ql, int qr)
    {
        if (qr < l || r < ql) {
            return 0;
        }
        if (ql <= l && r <= qr) {
            return t[nodo];
        }
        empujar(nodo, l, r);
        int m = l + (r - l) / 2;
        return consultar(2 * nodo, l, m, ql, qr) + consultar(2 * nodo + 1, m + 1, r, ql, qr);
    }
};

/**
 * Sparse table para mínimos de rango.
 *
 * @complejidad Construcción O(n log n) tiempo y espacio; `minimo` O(1).
 * @explicacion `t[k][i]` es el mínimo de los 2^k elementos desde i y se construye con dos mitades del nivel anterior. Una consulta
 * [l, r] de longitud len usa k = floor(log2 len) = `bit_width(len) - 1` y compara dos bloques de longitud 2^k, uno desde l y otro que
 * acaba en r. Se solapan, pero como min(x, x) = x no pasa nada (la suma, que no es idempotente, no admite este truco). El nivel k solo
 * tiene n - 2^k + 1 posiciones válidas, así que cada nivel ocupa menos que el anterior.
 * @alternativas Un segment tree es O(log n) por consulta pero admite cambios. Para n pequeño y pocas consultas, el bucle directo basta.
 * @bigo 1
 */
struct TablaDispersa {
    vector<vector<int>> t;

    explicit TablaDispersa(const vector<int>& a)
    {
        int n = static_cast<int>(a.size());
        if (n == 0) {
            return;
        }
        int niveles = bit_width(static_cast<unsigned>(n));
        t.assign(niveles, vector<int>());
        t[0] = a;
        for (int k = 1; k < niveles; k++) {
            int largo = n - (1 << k) + 1;
            t[k].resize(largo);
            for (int i = 0; i < largo; i++) {
                t[k][i] = min(t[k - 1][i], t[k - 1][i + (1 << (k - 1))]);
            }
        }
    }

    int minimo(int l, int r) const
    {
        if (l > r) {
            throw invalid_argument("TablaDispersa::minimo: l > r");
        }
        if (t.empty() || l < 0 || r >= static_cast<int>(t[0].size())) {
            throw out_of_range("TablaDispersa::minimo: rango fuera de límites");
        }
        int k = bit_width(static_cast<unsigned>(r - l + 1)) - 1;
        return min(t[k][l], t[k][r - (1 << k) + 1]);
    }
};

/**
 * LCA con binary lifting.
 *
 * @complejidad Construcción O(n log n); `lca` y `ancestro` O(log n); espacio O(n log n).
 * @explicacion `salto[k][v]` es el ancestro a 2^k niveles de v y se obtiene con dos saltos de 2^(k-1). Para el LCA: primero se
 * sube el nodo más profundo la diferencia de profundidades, descompuesta en bits (cada bit encendido es un salto de potencia de dos); si
 * coinciden ya está. Si no, se recorren los saltos de mayor a menor y se sube a la vez en ambos solo cuando sus ancestros DIFIEREN: así se
 * queda justo debajo del LCA, y su padre es la respuesta. La raíz apunta a sí misma para no salirse del árbol; `ancestro` comprueba antes
 * con la profundidad que k no la sobrepasa. Como `padre[v] < v`, la profundidad se calcula en un único recorrido.
 * @alternativas Euler tour + sparse table da el LCA en O(1) tras O(n log n). El LCA «lento» (marcar los ancestros de uno y subir con el otro)
 * cuesta O(profundidad), que en una cadena es O(n).
 * @bigo log
 */
struct AncestroComun {
    int n;
    vector<int> prof;
    vector<vector<int>> salto;

    explicit AncestroComun(const vector<int>& padre) : n(static_cast<int>(padre.size())), prof(padre.size(), 0)
    {
        int niveles = max(1, bit_width(static_cast<unsigned>(n)));
        salto.assign(niveles, vector<int>(n, 0));
        for (int v = 0; v < n; v++) {
            if (v > 0 && (padre[v] < 0 || padre[v] >= v)) {
                throw invalid_argument("AncestroComun: padre[v] debe estar en [0, v-1]");
            }
            salto[0][v] = v == 0 ? 0 : padre[v];
            prof[v] = v == 0 ? 0 : prof[padre[v]] + 1;
        }
        for (int k = 1; k < niveles; k++) {
            for (int v = 0; v < n; v++) {
                salto[k][v] = salto[k - 1][salto[k - 1][v]];
            }
        }
    }

    int ancestro(int v, int k) const
    {
        comprobar(v);
        if (k < 0 || k > prof[v]) {
            return -1;
        }
        for (int bit = 0; k > 0; bit++, k >>= 1) {
            if (k & 1) {
                v = salto[bit][v];
            }
        }
        return v;
    }

    int lca(int a, int b) const
    {
        comprobar(a);
        comprobar(b);
        if (prof[a] < prof[b]) {
            swap(a, b);
        }
        a = ancestro(a, prof[a] - prof[b]);
        if (a == b) {
            return a;
        }
        for (int k = static_cast<int>(salto.size()) - 1; k >= 0; k--) {
            if (salto[k][a] != salto[k][b]) {
                a = salto[k][a];
                b = salto[k][b];
            }
        }
        return salto[0][a];
    }

private:
    void comprobar(int v) const
    {
        if (v < 0 || v >= n) {
            throw out_of_range("AncestroComun: nodo fuera de rango");
        }
    }
};

/**
 * Contar inversiones con un Fenwick de contadores.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @explicacion Se comprimen los valores a rangos 1..m (ordenar una copia, `unique`, `lower_bound`) para poder usarlos como índices. Al recorrer el array
 * de izquierda a derecha, el Fenwick cuenta cuántos valores de cada rango se han visto ya; las inversiones que cierra x son los vistos
 * MAYORES que él: `vistos - consulta(rango(x))`, donde la consulta cuenta los vistos menores o IGUALES (los iguales no son inversión). La suma
 * total puede llegar a n(n-1)/2 ≈ 5·10⁹, por eso el acumulador es `long long`.
 * @alternativas La ordenación por mezcla cuenta las inversiones durante la fusión, también en O(n log n) y sin compresión. La fuerza bruta es O(n²).
 * @bigo nlogn
 */
long long contarInversiones(const vector<int>& a)
{
    vector<int> orden(a);
    sort(orden.begin(), orden.end());
    orden.erase(unique(orden.begin(), orden.end()), orden.end());
    int m = static_cast<int>(orden.size());
    vector<int> bit(m + 1, 0);
    long long inversiones = 0;
    long long vistos = 0;
    for (int x : a) {
        int rango = static_cast<int>(lower_bound(orden.begin(), orden.end(), x) - orden.begin()) + 1;
        long long menoresOIguales = 0;
        for (int i = rango; i > 0; i -= i & -i) {
            menoresOIguales += bit[i];
        }
        inversiones += vistos - menoresOIguales;
        for (int i = rango; i <= m; i += i & -i) {
            bit[i]++;
        }
        vistos++;
    }
    return inversiones;
}
