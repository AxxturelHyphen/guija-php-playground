#include <algorithm>
#include <climits>
#include <cstdlib>
#include <functional>
#include <optional>
#include <stdexcept>
#include <utility>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 15 · Tablas hash propias y árboles equilibrados
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 * Usan `NodoAVL`, `alturaDe`, `recalcular` y `enOrdenDe`, que ya vienen en el archivo de ejercicios.
 */

/**
 * Cubeta de una clave: módulo no negativo.
 *
 * @complejidad Tiempo O(1); espacio O(1).
 * @explicacion En C++ el resto lleva el signo del dividendo: `clave % m` está en (-m, m). Sumando `m` queda en (0, 2m), que no desborda un
 * long long (m es un int), y el segundo `% m` lo deja en [0, m). `abs(clave) % m` fallaría con LLONG_MIN (su valor absoluto no cabe: UB) y
 * mandaría -3 y 3 a la misma cubeta, empeorando el reparto.
 * @alternativas Mezclar los bits de la clave (multiplicar por una constante impar grande y desplazar) antes del módulo evita que patrones
 * regulares como los múltiplos de 8 caigan todos en pocas cubetas.
 * @bigo 1
 */
int cubeta(long long clave, int m)
{
    if (m <= 0) {
        throw invalid_argument("cubeta: m debe ser positivo");
    }
    long long resto = clave % m;
    return static_cast<int>((resto + m) % m);
}

/**
 * Mínimo de nodos de un AVL de altura h.
 *
 * @complejidad Tiempo O(h); espacio O(1).
 * @explicacion El AVL más flaco de altura h tiene un subárbol de altura h-1 y otro de h-2 (la diferencia máxima), cada uno a su vez mínimo:
 * N(h) = N(h-1) + N(h-2) + 1, con N(0) = 0 y N(1) = 1. Un bucle con dos acumuladores lo calcula sin repetir subproblemas (la recursión doble
 * sería exponencial). N(h) = Fibonacci(h+2) - 1 ≈ φʰ⁺² / √5, de donde un AVL con n nodos tiene altura ≤ 1,44 · log₂(n + 2). Con h = 90 el valor
 * ya roza el límite de un long long (por eso se rechaza h > 90).
 * @alternativas La fórmula cerrada con φ da el valor con coma flotante, pero pierde exactitud para h grandes.
 * @bigo n
 */
long long minimoNodosAVL(int h)
{
    if (h < 0 || h > 90) {
        throw invalid_argument("minimoNodosAVL: la altura debe estar entre 0 y 90");
    }
    if (h == 0) {
        return 0;
    }
    long long anterior = 0;      // N(i-2), empezando con N(0)
    long long actual = 1;        // N(i-1), empezando con N(1)
    for (int i = 2; i <= h; i++) {
        long long siguiente = actual + anterior + 1;
        anterior = actual;
        actual = siguiente;
    }
    return actual;
}

/**
 * Tabla hash con encadenamiento.
 *
 * @complejidad `obtener`, `poner` y `borrar` O(1) esperado (O(longitud de la cadena)); el rehash O(n), amortizado O(1) por inserción; espacio O(n + m).
 * @explicacion Un vector de cubetas, cada una un vector de pares. La cubeta de una clave es `((clave % m) + m) % m`. Al insertar una clave NUEVA
 * el tamaño sube y, si `4 · tamano > 3 · cubetas` (factor de carga > 3/4), se duplican las cubetas y se recolocan todos los pares: el sitio
 * de cada clave depende de m, así que cambia al cambiar m. Duplicar (en vez de sumar una cantidad fija) es lo que hace amortizado el coste:
 * la suma de los rehashes hasta n inserciones es n + n/2 + n/4 + … < 2n. Se compara con enteros para evitar errores de coma flotante.
 * @alternativas Encadenar con listas enlazadas (como `unordered_map`) hace estables las referencias pero aleja los datos en memoria; el sondeo
 * lineal aprovecha mejor la caché pero exige tratar los borrados con lápidas.
 * @bigo 1
 */
struct TablaHashEncadenada {
    explicit TablaHashEncadenada(int cubetasIniciales = 8) : tabla_(static_cast<size_t>(max(cubetasIniciales, 1)))
    {
        if (cubetasIniciales < 1) {
            throw invalid_argument("TablaHashEncadenada: hace falta al menos una cubeta");
        }
    }

    void poner(long long clave, int valor)
    {
        auto& cadena = tabla_[indice(clave, tabla_.size())];
        for (auto& par : cadena) {
            if (par.first == clave) {
                par.second = valor;
                return;
            }
        }
        cadena.push_back({clave, valor});
        n_++;
        if (4 * n_ > 3 * tabla_.size()) {
            recolocar();
        }
    }

    optional<int> obtener(long long clave) const
    {
        for (const auto& par : tabla_[indice(clave, tabla_.size())]) {
            if (par.first == clave) {
                return par.second;
            }
        }
        return nullopt;
    }

    bool borrar(long long clave)
    {
        auto& cadena = tabla_[indice(clave, tabla_.size())];
        for (size_t i = 0; i < cadena.size(); i++) {
            if (cadena[i].first == clave) {
                cadena[i] = cadena.back();
                cadena.pop_back();
                n_--;
                return true;
            }
        }
        return false;
    }

    size_t tamano() const { return n_; }

    size_t cubetas() const { return tabla_.size(); }

    double factorDeCarga() const { return static_cast<double>(n_) / static_cast<double>(tabla_.size()); }

    int recolocaciones() const { return recolocaciones_; }

private:
    vector<vector<pair<long long, int>>> tabla_;
    size_t n_ = 0;
    int recolocaciones_ = 0;

    static size_t indice(long long clave, size_t m)
    {
        long long mm = static_cast<long long>(m);
        return static_cast<size_t>(((clave % mm) + mm) % mm);
    }

    void recolocar()
    {
        vector<vector<pair<long long, int>>> nueva(tabla_.size() * 2);
        for (const auto& cadena : tabla_) {
            for (const auto& par : cadena) {
                nueva[indice(par.first, nueva.size())].push_back(par);
            }
        }
        tabla_.swap(nueva);
        recolocaciones_++;
    }
};

/**
 * Tabla hash con sondeo lineal y lápidas.
 *
 * @complejidad `obtener`, `poner` y `borrar` O(1) esperado con factor de carga ≤ 1/2; la reconstrucción O(m), amortizada; espacio O(m).
 * @explicacion Cada casilla está vacía, ocupada o borrada. Buscar sigue la cadena de sondeo saltando lápidas y se detiene en una casilla vacía (o tras
 * `capacidad` pasos). Borrar marca una lápida, nunca un hueco: un hueco cortaría la cadena de las claves que pasaron por allí. Insertar busca
 * primero la clave y recuerda la primera lápida; si la clave no está, la pone en esa lápida (se reutiliza) o en la casilla vacía final. Antes de
 * insertar una clave nueva, si `2 · (vivas + lápidas + 1) > capacidad` se reconstruye la tabla (duplicando si hay muchas vivas, y si no solo
 * se limpian lápidas), con lo que `2 · (vivas + lápidas) ≤ capacidad` siempre y toda búsqueda termina. Si solo se contaran las vivas, muchos borrados
 * llenarían la tabla de lápidas.
 * @alternativas El sondeo cuadrático o el doble hash reducen el agrupamiento primario; el hashing de Robin Hood y el borrado por «desplazamiento hacia atrás»
 * evitan las lápidas por completo.
 * @bigo 1
 */
struct TablaHashLineal {
    explicit TablaHashLineal(int capacidadInicial = 8) : casillas_(static_cast<size_t>(max(capacidadInicial, 1)))
    {
        if (capacidadInicial < 1) {
            throw invalid_argument("TablaHashLineal: hace falta al menos una casilla");
        }
    }

    void poner(long long clave, int valor)
    {
        size_t m = casillas_.size();
        size_t i = indice(clave, m);
        long long primeraLapida = -1;
        for (size_t paso = 0; paso < m; paso++, i = (i + 1) % m) {
            Casilla& c = casillas_[i];
            if (c.estado == Estado::Vacia) {
                break;
            }
            if (c.estado == Estado::Borrada) {
                if (primeraLapida < 0) {
                    primeraLapida = static_cast<long long>(i);
                }
            } else if (c.clave == clave) {
                c.valor = valor;
                return;
            }
        }
        if (2 * (vivas_ + lapidas_ + 1) > m) {
            reconstruir();
            poner(clave, valor);
            return;
        }
        size_t destino = primeraLapida >= 0 ? static_cast<size_t>(primeraLapida) : i;
        if (casillas_[destino].estado == Estado::Borrada) {
            lapidas_--;
        }
        casillas_[destino] = {clave, valor, Estado::Ocupada};
        vivas_++;
    }

    optional<int> obtener(long long clave) const
    {
        size_t m = casillas_.size();
        size_t i = indice(clave, m);
        for (size_t paso = 0; paso < m; paso++, i = (i + 1) % m) {
            const Casilla& c = casillas_[i];
            if (c.estado == Estado::Vacia) {
                return nullopt;
            }
            if (c.estado == Estado::Ocupada && c.clave == clave) {
                return c.valor;
            }
        }
        return nullopt;
    }

    bool borrar(long long clave)
    {
        size_t m = casillas_.size();
        size_t i = indice(clave, m);
        for (size_t paso = 0; paso < m; paso++, i = (i + 1) % m) {
            Casilla& c = casillas_[i];
            if (c.estado == Estado::Vacia) {
                return false;
            }
            if (c.estado == Estado::Ocupada && c.clave == clave) {
                c.estado = Estado::Borrada;
                vivas_--;
                lapidas_++;
                return true;
            }
        }
        return false;
    }

    size_t tamano() const { return vivas_; }

    size_t capacidad() const { return casillas_.size(); }

    size_t lapidas() const { return lapidas_; }

    int recolocaciones() const { return recolocaciones_; }

private:
    enum class Estado : char { Vacia, Ocupada, Borrada };
    struct Casilla {
        long long clave = 0;
        int valor = 0;
        Estado estado = Estado::Vacia;
    };

    vector<Casilla> casillas_;
    size_t vivas_ = 0;
    size_t lapidas_ = 0;
    int recolocaciones_ = 0;

    static size_t indice(long long clave, size_t m)
    {
        long long mm = static_cast<long long>(m);
        return static_cast<size_t>(((clave % mm) + mm) % mm);
    }

    void reconstruir()
    {
        size_t m = casillas_.size();
        size_t nueva = 4 * (vivas_ + 1) > m ? 2 * m : m;
        vector<Casilla> viejas(nueva);
        viejas.swap(casillas_);
        for (const Casilla& c : viejas) {
            if (c.estado != Estado::Ocupada) {
                continue;
            }
            size_t i = indice(c.clave, nueva);
            while (casillas_[i].estado != Estado::Vacia) {
                i = (i + 1) % nueva;
            }
            casillas_[i] = c;
        }
        lapidas_ = 0;
        recolocaciones_++;
    }
};

/**
 * Rotación simple a la derecha.
 *
 * @complejidad Tiempo O(1); espacio O(1).
 * @explicacion El hijo izquierdo x sube a la raíz; su subárbol derecho B (que está entre x e y en el orden) pasa a ser el hijo izquierdo de y,
 * y y baja a hijo derecho de x. Solo se tocan tres enlaces, y se recalculan las alturas de abajo arriba: primero y (ahora más bajo) y luego x. El
 * orden A < x < B < y < C no cambia. Devuelve x para que quien llamó lo enlace en el sitio de y (padre o raíz del árbol).
 * @alternativas Con punteros se hace igual intercambiando tres punteros; con índices hay que devolver la raíz nueva porque el vector no sabe quién es el padre.
 * @bigo 1
 */
int rotarDerecha(vector<NodoAVL>& t, int y)
{
    if (y < 0 || static_cast<size_t>(y) >= t.size() || t[static_cast<size_t>(y)].izq == -1) {
        throw invalid_argument("rotarDerecha: hace falta un nodo con hijo izquierdo");
    }
    int x = t[static_cast<size_t>(y)].izq;
    t[static_cast<size_t>(y)].izq = t[static_cast<size_t>(x)].der;
    t[static_cast<size_t>(x)].der = y;
    recalcular(t, y);
    recalcular(t, x);
    return x;
}

/**
 * Rotación simple a la izquierda.
 *
 * @complejidad Tiempo O(1); espacio O(1).
 * @explicacion Es la imagen en el espejo de `rotarDerecha`: el hijo derecho y sube; su subárbol izquierdo B pasa a ser el hijo derecho de x, y x baja a
 * hijo izquierdo de y. Se recalculan las alturas de x y luego de y. Un caso izquierda-derecha (nodo pesado a la izquierda cuyo hijo izquierdo
 * pesa a la derecha) se resuelve con una rotación doble: `rotarIzquierda` en el hijo y después `rotarDerecha` en el nodo.
 * @alternativas Implementar una sola rotación y obtener la otra por simetría con una plantilla sobre la dirección: menos código, más difícil de leer.
 * @bigo 1
 */
int rotarIzquierda(vector<NodoAVL>& t, int x)
{
    if (x < 0 || static_cast<size_t>(x) >= t.size() || t[static_cast<size_t>(x)].der == -1) {
        throw invalid_argument("rotarIzquierda: hace falta un nodo con hijo derecho");
    }
    int y = t[static_cast<size_t>(x)].der;
    t[static_cast<size_t>(x)].der = t[static_cast<size_t>(y)].izq;
    t[static_cast<size_t>(y)].izq = x;
    recalcular(t, x);
    recalcular(t, y);
    return y;
}

/**
 * Validador de árboles AVL.
 *
 * @complejidad Tiempo O(n); espacio O(h) de recursión (h = altura del árbol dado, hasta n en una lista).
 * @explicacion Una sola recursión por nodo devuelve la altura real, o -1 en cuanto algo falla. Lleva un intervalo (mín, máx) abierto: la clave del nodo debe
 * caer dentro y cada hijo hereda un intervalo más estrecho, de modo que el orden se comprueba contra TODOS los antecesores y no solo contra el padre. Después
 * compara las alturas de los hijos (diferencia ≤ 1) y la altura almacenada con la real. Los nodos visitados se cuentan: si pasan de t.size() hay un ciclo
 * o un hijo compartido y no es un árbol. Antes de recorrer se validan los índices de todos los nodos (invalid_argument si alguno se sale).
 * @alternativas Recorrer en orden y comprobar que las claves salen estrictamente crecientes valida el orden, pero el equilibrio y las alturas piden otro recorrido.
 * @bigo n
 */
bool esAVL(const vector<NodoAVL>& t, int raiz)
{
    if (raiz == -1) {
        return true;
    }
    int n = static_cast<int>(t.size());
    if (raiz < 0 || raiz >= n) {
        throw invalid_argument("esAVL: la raíz está fuera de rango");
    }
    for (const NodoAVL& nodo : t) {
        if (nodo.izq < -1 || nodo.izq >= n || nodo.der < -1 || nodo.der >= n) {
            throw invalid_argument("esAVL: un hijo está fuera de rango");
        }
    }
    int visitados = 0;
    function<int(int, long long, long long)> altura = [&](int i, long long minimo, long long maximo) -> int {
        if (i == -1) {
            return 0;
        }
        if (++visitados > n) {
            return -1;
        }
        const NodoAVL& nodo = t[static_cast<size_t>(i)];
        if (nodo.clave <= minimo || nodo.clave >= maximo) {
            return -1;
        }
        int hi = altura(nodo.izq, minimo, nodo.clave);
        if (hi < 0) {
            return -1;
        }
        int hd = altura(nodo.der, nodo.clave, maximo);
        if (hd < 0 || abs(hi - hd) > 1) {
            return -1;
        }
        int real = 1 + max(hi, hd);
        return nodo.altura == real ? real : -1;
    };
    return altura(raiz, LLONG_MIN, LLONG_MAX) >= 0;
}

/**
 * Árbol AVL.
 *
 * @complejidad `insertar` y `contiene` O(log n) en el peor caso; `enOrden` O(n); espacio O(n).
 * @explicacion `insertarEn(i, x)` baja recursivamente, ENLAZA el resultado de la llamada y, al volver, recalcula la altura y reequilibra el nodo. Si el equilibrio
 * (altura izquierda - altura derecha) sale fuera de [-1, 1], una rotación lo arregla: un caso simple (izquierda-izquierda o derecha-derecha) con una rotación,
 * y el zig-zag (izquierda-derecha o derecha-izquierda) con dos (la primera sobre el hijo). Como cada inserción deshace como mucho un desequilibrio, las
 * rotaciones por inserción son O(1) y el coste lo domina el descenso, O(h) = O(log n) porque h ≤ 1,44 · log₂(n + 2). Los nodos se manejan por índice: un
 * `push_back` puede mover el vector y dejar colgando cualquier referencia. Los duplicados se detectan al llegar y no cambian nada.
 * @alternativas Un árbol rojo-negro (el de `std::set`) hace menos rotaciones al borrar y permite un desequilibrio mayor; un treap equilibra con prioridades aleatorias.
 * @bigo log
 */
struct ArbolAVL {
    vector<NodoAVL> nodos;
    int raiz = -1;
    int rotaciones = 0;

    bool insertar(int x)
    {
        bool nuevo = false;
        int r = insertarEn(raiz, x, nuevo);
        raiz = r;
        return nuevo;
    }

    bool contiene(int x) const
    {
        int i = raiz;
        while (i != -1) {
            const NodoAVL& n = nodos[static_cast<size_t>(i)];
            if (x == n.clave) {
                return true;
            }
            i = x < n.clave ? n.izq : n.der;
        }
        return false;
    }

    int altura() const { return alturaDe(nodos, raiz); }

    size_t tamano() const { return nodos.size(); }

    vector<int> enOrden() const { return enOrdenDe(nodos, raiz); }

private:
    int equilibrio(int i) const
    {
        return i == -1 ? 0 : alturaDe(nodos, nodos[static_cast<size_t>(i)].izq) - alturaDe(nodos, nodos[static_cast<size_t>(i)].der);
    }

    int insertarEn(int i, int x, bool& nuevo)
    {
        if (i == -1) {
            nodos.push_back({x, 1, -1, -1});
            nuevo = true;
            return static_cast<int>(nodos.size()) - 1;
        }
        int clave = nodos[static_cast<size_t>(i)].clave;
        if (x == clave) {
            return i;
        }
        if (x < clave) {
            int hijo = insertarEn(nodos[static_cast<size_t>(i)].izq, x, nuevo);
            nodos[static_cast<size_t>(i)].izq = hijo;
        } else {
            int hijo = insertarEn(nodos[static_cast<size_t>(i)].der, x, nuevo);
            nodos[static_cast<size_t>(i)].der = hijo;
        }
        if (!nuevo) {
            return i;
        }
        recalcular(nodos, i);
        return reequilibrar(i);
    }

    int reequilibrar(int i)
    {
        int e = equilibrio(i);
        if (e > 1) {
            if (equilibrio(nodos[static_cast<size_t>(i)].izq) < 0) {
                int hijo = rotarIzquierda(nodos, nodos[static_cast<size_t>(i)].izq);
                nodos[static_cast<size_t>(i)].izq = hijo;
                rotaciones++;
            }
            rotaciones++;
            return rotarDerecha(nodos, i);
        }
        if (e < -1) {
            if (equilibrio(nodos[static_cast<size_t>(i)].der) > 0) {
                int hijo = rotarDerecha(nodos, nodos[static_cast<size_t>(i)].der);
                nodos[static_cast<size_t>(i)].der = hijo;
                rotaciones++;
            }
            rotaciones++;
            return rotarIzquierda(nodos, i);
        }
        return i;
    }
};
