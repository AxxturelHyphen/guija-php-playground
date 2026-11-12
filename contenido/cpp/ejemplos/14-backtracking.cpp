#include <algorithm>
#include <bit>
#include <functional>
#include <iostream>
#include <numeric>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 14 · BACKTRACKING A FONDO (y el arte de podar)
 * ────────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA: hay que encontrar (o contar, o listar) soluciones que cumplen restricciones y el espacio de candidatos es
 * ENORME: 2ⁿ subconjuntos, n! permutaciones, kⁿ coloreados. Mirarlos todos es imposible; pero la mayoría se descartan MUY pronto.
 * El backtracking construye la solución pieza a pieza y, en cuanto una solución PARCIAL ya no puede completarse, abandona esa
 * rama entera. Esa decisión de abandonar se llama PODA, y es lo que separa un programa que acaba en milisegundos de otro que no
 * acaba nunca. La plantilla es siempre la misma (tema 4):
 *
 *   explorar(estado):
 *       si estado es solución → registrarla
 *       para cada opción posible desde estado:
 *           si la opción es viable (¡PODA!):  elegir → explorar → DESHACER
 *
 * Tipos de poda que verás aquí (cada ejercicio usa varias):
 *   FACTIBILIDAD    descartar lo que ya viola una restricción (un paréntesis cerrado de más, dos vecinos con el mismo color).
 *   SUMA/COTA       descartar lo que ya no puede llegar al objetivo (la suma se pasa; el resto no alcanza).
 *   SIMETRÍA        no probar dos veces lo mismo con otro nombre (permutaciones de colores, elementos repetidos, cubos iguales).
 *   ORDEN           probar primero lo MÁS restringido (el hueco del sudoku con menos candidatos): falla antes, poda más arriba.
 *
 * CÓMO SE MIDE LA PODA: el árbol de búsqueda tiene un NODO por cada llamada recursiva. Varios ejercicios aceptan un parámetro
 * opcional `long long* nodos`: si no es nulo, súmale 1 en cada llamada recursiva (la primera incluida). Las pruebas comprueban que
 * visitas pocos nodos en entradas donde la fuerza bruta necesitaría millones: la poda no es un adorno, es lo que se evalúa.
 * Además `medir` dibuja el tiempo frente al tamaño: una poda que falta se ve como una curva que se dispara.
 *
 * CONVENCIÓN DE ORDEN: salvo que se diga otra cosa, las soluciones se devuelven en el orden «natural» del backtracking (probar las
 * opciones de menor a mayor), que es ORDEN LEXICOGRÁFICO. Las pruebas comparan la lista exacta.
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
 * │ El «elegir → explorar → deshacer» es el mismo que en Java o Python, pero con una diferencia importante: en C++ los
 * │ objetos se pasan POR VALOR salvo que uses `&`. Para el estado compartido de la recursión (la lista que vas rellenando) usa
 * │ referencias o una lambda que lo capture con [&]; y deshaz con `pop_back()` en vez de copiar el estado en cada nodo (copiar
 * │ cuesta O(tamaño) por nodo y puede arruinar el coste). `std::function` permite una lambda recursiva sin nombrarla antes.
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Número de Catalan: cuántas secuencias de n pares de paréntesis están bien formadas. C(n) = C(n-1) · 2(2n-1)/(n+1). */
long long catalan(int n)
{
    long long c = 1;
    for (int i = 1; i <= n; i++) {
        c = c * 2 * (2 * i - 1) / (i + 1);
    }
    return c;
}

/** Nodos que visita una búsqueda de «subconjuntos de 1..n que suman objetivo» SIN poda: 2^(n+1) - 1, uno por cada decisión. */
long long nodosSinPoda(int n, int objetivo, int i = 1, int suma = 0, int* encontrados = nullptr)
{
    if (i > n) {
        if (suma == objetivo && encontrados != nullptr) {
            (*encontrados)++;
        }
        return 1;
    }
    return 1 + nodosSinPoda(n, objetivo, i + 1, suma + i, encontrados) + nodosSinPoda(n, objetivo, i + 1, suma, encontrados);
}

/** Lo mismo, PODANDO cuando la suma ya se pasa (suma > objetivo) o cuando lo que queda no alcanza (suma + i + ... + n < objetivo). */
long long nodosConPoda(int n, int objetivo, int i = 1, int suma = 0, int* encontrados = nullptr)
{
    int restante = (n - i + 1) * (n + i) / 2;           // i + (i+1) + ... + n
    if (suma > objetivo || suma + restante < objetivo) {
        return 1;                                        // este nodo se visita, pero NO se baja más
    }
    if (i > n) {
        if (encontrados != nullptr) {
            (*encontrados)++;
        }
        return 1;
    }
    return 1 + nodosConPoda(n, objetivo, i + 1, suma + i, encontrados) + nodosConPoda(n, objetivo, i + 1, suma, encontrados);
}

/** Grafo de n vértices con las aristas dadas, como lista de adyacencia (cada arista aparece en los dos sentidos). */
vector<vector<int>> grafoDesdeAristas(int n, const vector<pair<int, int>>& aristas)
{
    vector<vector<int>> ady(static_cast<size_t>(n));
    for (const auto& [a, b] : aristas) {
        ady[static_cast<size_t>(a)].push_back(b);
        ady[static_cast<size_t>(b)].push_back(a);
    }
    return ady;
}

vector<vector<int>> grafoCamino(int n)
{
    vector<pair<int, int>> aristas;
    for (int i = 0; i + 1 < n; i++) {
        aristas.push_back({i, i + 1});
    }
    return grafoDesdeAristas(n, aristas);
}

vector<vector<int>> grafoCiclo(int n)
{
    vector<pair<int, int>> aristas;
    for (int i = 0; i < n; i++) {
        aristas.push_back({i, (i + 1) % n});
    }
    return grafoDesdeAristas(n, aristas);
}

vector<vector<int>> grafoCompleto(int n)
{
    vector<pair<int, int>> aristas;
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            aristas.push_back({i, j});
        }
    }
    return grafoDesdeAristas(n, aristas);
}

/** El grafo de Petersen: 10 vértices, 15 aristas, número cromático 3 (famoso por romper intuiciones). */
vector<vector<int>> grafoPetersen()
{
    return grafoDesdeAristas(10, {{0, 1}, {1, 2}, {2, 3}, {3, 4}, {4, 0}, {5, 7}, {7, 9}, {9, 6}, {6, 8}, {8, 5}, {0, 5}, {1, 6}, {2, 7}, {3, 8}, {4, 9}});
}

/** ¿Es `color` un coloreado válido con k colores (todos en 0..k-1 y ningún vecino igual)? Devuelve «ok» o el motivo del fallo. */
string veredictoColoreo(const vector<vector<int>>& ady, int k, const optional<vector<int>>& color)
{
    if (!color) {
        return "no hay coloreado";
    }
    if (color->size() != ady.size()) {
        return "tamaño incorrecto";
    }
    for (size_t v = 0; v < ady.size(); v++) {
        if ((*color)[v] < 0 || (*color)[v] >= k) {
            return "color fuera de rango en el vértice " + to_string(v);
        }
        for (int w : ady[v]) {
            if ((*color)[v] == (*color)[static_cast<size_t>(w)]) {
                return "vértices vecinos " + to_string(v) + " y " + to_string(w) + " con el mismo color";
            }
        }
    }
    return "ok";
}

/** Demo del ejercicio 6 en pequeño: nodos de un coloreado con tres niveles de poda. modo 0: solo al final; 1: conflicto al elegir; 2: + simetría. */
long long nodosColoreoDemo(const vector<vector<int>>& ady, int k, int modo)
{
    int n = static_cast<int>(ady.size());
    vector<int> color(static_cast<size_t>(n), -1);
    long long nodos = 0;
    function<bool(int, int)> rec = [&](int v, int usados) {
        nodos++;
        if (v == n) {
            for (int a = 0; a < n; a++) {
                for (int b : ady[static_cast<size_t>(a)]) {
                    if (color[static_cast<size_t>(a)] == color[static_cast<size_t>(b)]) {
                        return false;
                    }
                }
            }
            return true;
        }
        int tope = modo == 2 ? min(k, usados + 1) : k;
        for (int c = 0; c < tope; c++) {
            bool choca = false;
            if (modo >= 1) {
                for (int w : ady[static_cast<size_t>(v)]) {
                    if (color[static_cast<size_t>(w)] == c) {
                        choca = true;
                    }
                }
            }
            if (!choca) {
                color[static_cast<size_t>(v)] = c;
                if (rec(v + 1, max(usados, c + 1))) {
                    return true;
                }
                color[static_cast<size_t>(v)] = -1;
            }
        }
        return false;
    };
    rec(0, 0);
    return nodos;
}

/** Tablero n×n de letras 'a'..'z' pseudoaleatorias y reproducibles (para medir la búsqueda de palabras). */
vector<string> tableroAleatorio(int n, int semilla)
{
    vector<int> v = aleatorios(n * n, 25, semilla);
    vector<string> t(static_cast<size_t>(n), string(static_cast<size_t>(n), 'a'));
    for (int i = 0; i < n * n; i++) {
        t[static_cast<size_t>(i / n)][static_cast<size_t>(i % n)] = static_cast<char>('a' + v[static_cast<size_t>(i)]);
    }
    return t;
}

/** Los 9 candidatos de un hueco de sudoku (como máscara de bits del 1 al 9): lo que no está ya en su fila, columna ni caja. */
int candidatosSudoku(const vector<vector<int>>& t, int f, int c)
{
    int usados = 0;
    for (int i = 0; i < 9; i++) {
        usados |= 1 << t[static_cast<size_t>(f)][static_cast<size_t>(i)];
        usados |= 1 << t[static_cast<size_t>(i)][static_cast<size_t>(c)];
        usados |= 1 << t[static_cast<size_t>(f / 3 * 3 + i / 3)][static_cast<size_t>(c / 3 * 3 + i % 3)];
    }
    return ~usados & 0x3FE;
}

/** ¿Es `t` un sudoku completo y válido, que conserva todos los números de `original`? Devuelve «ok» o el motivo. */
string veredictoSudoku(const vector<vector<int>>& original, const vector<vector<int>>& t)
{
    if (t.size() != 9) {
        return "no tiene 9 filas";
    }
    for (int i = 0; i < 9; i++) {
        int fila = 0;
        int col = 0;
        int caja = 0;
        for (int j = 0; j < 9; j++) {
            int a = t[static_cast<size_t>(i)][static_cast<size_t>(j)];
            int b = t[static_cast<size_t>(j)][static_cast<size_t>(i)];
            int c = t[static_cast<size_t>(i / 3 * 3 + j / 3)][static_cast<size_t>(i % 3 * 3 + j % 3)];
            if (a < 1 || a > 9) {
                return "hay un hueco o un número fuera de 1..9";
            }
            fila |= 1 << a;
            col |= 1 << b;
            caja |= 1 << c;
            int o = original[static_cast<size_t>(i)][static_cast<size_t>(j)];
            if (o != 0 && o != a) {
                return "ha cambiado un número del enunciado";
            }
        }
        if (fila != 0x3FE || col != 0x3FE || caja != 0x3FE) {
            return "repite un número en la fila, columna o caja " + to_string(i);
        }
    }
    return "ok";
}

/** Convierte 9 textos de 9 caracteres ('.' o '0' = hueco) en la matriz que usa resolverSudoku. */
vector<vector<int>> sudokuDesdeTexto(const vector<string>& filas)
{
    vector<vector<int>> t;
    for (const string& f : filas) {
        vector<int> fila;
        for (char ch : f) {
            fila.push_back(ch == '.' ? 0 : ch - '0');
        }
        t.push_back(fila);
    }
    return t;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · generarParentesis ──────────────────────────────────────────
/**
 * Todas las cadenas BIEN FORMADAS de n pares de paréntesis, en orden lexicográfico ('(' va antes que ')'). n = 3 →
 * ["((()))", "(()())", "(())()", "()(())", "()()()"]. n = 0 → [""] (una cadena vacía). n < 0 → invalid_argument.
 * Poda de FACTIBILIDAD: no generes las 2²ⁿ cadenas y las filtres. Lleva dos contadores, `abiertos` y `cerrados`: puedes poner
 * '(' si abiertos < n y puedes poner ')' si cerrados < abiertos. Con esas dos reglas NUNCA construyes una cadena mala.
 * Invariante: en todo prefijo, cerrados ≤ abiertos ≤ n. Hay Catalan(n) ≈ 4ⁿ / (n√n) cadenas (mira `catalan`), así que el
 * coste es proporcional a lo que devuelves: no se puede hacer mejor.
 * Coste: O(4ⁿ / √n) (exponencial, dominado por la salida).
 */
vector<string> generarParentesis(int n)
{
    return pendiente();
}

// ── Ejercicio 2 · permutacionesUnicas ────────────────────────────────────────
/**
 * Todas las permutaciones DISTINTAS de `nums` (que puede tener repetidos), en orden lexicográfico. {1,1,2} →
 * [[1,1,2], [1,2,1], [2,1,1]] (3 y no 6). Vacío → [[]]. Si `nodos` no es nulo, suma 1 por llamada recursiva.
 * Poda de SIMETRÍA: ordena una copia de los números y usa un vector `usado`. En cada nivel, no pruebes un número que ya esté
 * usado ni uno IGUAL al anterior si el anterior NO está usado (probarlo daría las mismas permutaciones que el anterior).
 * Fuerza bruta: generar las n! y quitar duplicados con un `set` visita n! nodos aunque haya 1 sola permutación distinta.
 * Invariante: en cada nivel, de entre los números iguales solo se prueba el PRIMERO sin usar.
 * Coste: O(n · n!/(m₁! m₂! …)) para multiplicidades m_i: proporcional al número de permutaciones distintas.
 */
vector<vector<int>> permutacionesUnicas(vector<int> nums, long long* nodos = nullptr)
{
    return pendiente();
}

// ── Ejercicio 3 · combinacionesQueSuman ──────────────────────────────────────
/**
 * Todas las COMBINACIONES (conjuntos, sin importar el orden) de `candidatos` que suman `objetivo`. Cada elemento de la lista se
 * usa como mucho una vez, pero la lista puede traer números repetidos y NO debe haber combinaciones repetidas. {10,1,2,7,6,1,5} y 8 →
 * [[1,1,6], [1,2,5], [1,7], [2,6]] (cada una creciente y la lista en orden lexicográfico). objetivo 0 → [[]]. Candidatos o
 * objetivo negativos, o candidatos que no sean positivos → invalid_argument. Si `nodos` no es nulo, suma 1 por llamada recursiva.
 * Dos podas: (1) con los candidatos ORDENADOS, en cuanto uno supera lo que falta, todos los siguientes también: `break`, no
 * `continue`; (2) para no repetir, en un mismo nivel salta un valor igual al anterior (`i > inicio && v[i] == v[i-1]`).
 * Esquema: `explorar(inicio, falta)`: si falta == 0 registra; para i desde `inicio`: poda; elige v[i]; explora(i + 1, falta - v[i]); deshaz.
 * Coste: O(2ⁿ) en el peor caso, pero con la poda solo se visitan las sumas parciales que aún caben (mira las pruebas de nodos).
 */
vector<vector<int>> combinacionesQueSuman(vector<int> candidatos, int objetivo, long long* nodos = nullptr)
{
    return pendiente();
}

// ── Ejercicio 4 · particionesPalindromos ─────────────────────────────────────
/**
 * Todas las formas de cortar `s` en trozos consecutivos que sean PALÍNDROMOS. "aab" → [["a","a","b"], ["aa","b"]]. "" → [[]].
 * El orden es el del backtracking: para cada posición, primero el trozo más corto. Esquema: `explorar(inicio)`: si inicio == n
 * registra; para fin desde inicio: si s[inicio..fin] es palíndromo, elige ese trozo, explora(fin + 1) y deshaz.
 * Poda de FACTIBILIDAD: solo se baja por trozos que ya son palíndromos. Para no recomprobarlo cada vez, precalcula una tabla
 * `es[i][j]` (¿s[i..j] es palíndromo?) en O(n²): `es[i][j] = s[i] == s[j] && (j - i < 2 || es[i+1][j-1])`, rellenándola con i
 * de mayor a menor. Con la tabla, comprobar un trozo es O(1) en vez de O(longitud).
 * Cuidado: "aaaa…" tiene 2ⁿ⁻¹ particiones (cada hueco entre letras se corta o no): el coste de la salida es exponencial.
 * Coste: O(n²) para la tabla más O(n · 2ⁿ) en el peor caso por la salida.
 */
vector<vector<string>> particionesPalindromos(string s)
{
    return pendiente();
}

// ── Ejercicio 5 · palabraEnTablero ───────────────────────────────────────────
/**
 * ¿Aparece `palabra` en el tablero siguiendo celdas ADYACENTES (arriba, abajo, izquierda, derecha) sin usar la misma celda dos
 * veces? Con ["ABCE","SFCS","ADEE"]: "ABCCED" sí, "SEE" sí, "ABCB" NO (habría que reutilizar la B). Palabra vacía → true;
 * tablero vacío con palabra no vacía → false; filas de distinta longitud → invalid_argument.
 * Idea: para cada celda que sea la primera letra, lanza una búsqueda en profundidad `buscar(f, c, k)` (¿encaja palabra[k..] desde (f,c)?).
 * Poda: sal en cuanto la celda no coincida con palabra[k] o ya esté visitada. Para marcar visitadas sin otra matriz, el tablero
 * llega POR VALOR (es una copia tuya): cambia la celda a '#' al entrar y restáurala al salir (DESHACER).
 * Pre-poda barata: si la palabra necesita más ocurrencias de una letra de las que hay en el tablero, responde false sin buscar
 * (un tablero lleno de 'a' y la palabra "aaaa…ab" es un desastre sin ella). Coste: O(F·C · 3ᴸ) con L = longitud de la palabra
 * (3 y no 4 porque no se vuelve por donde se vino); con letras aleatorias la búsqueda muere enseguida y es ~ O(F·C).
 */
bool palabraEnTablero(vector<string> tablero, string palabra)
{
    return pendiente();
}

// ── Ejercicio 6 · colorearGrafo ──────────────────────────────────────────────
/**
 * ¿Se puede colorear un grafo (lista de adyacencia simétrica) con k colores sin que dos vecinos compartan color? Devuelve el
 * coloreado (color[v] en 0..k-1) o `nullopt` si es imposible. Sin vértices → un vector vacío (no nullopt). k < 0 → invalid_argument.
 * Esquema: asigna colores a los vértices 0, 1, 2… en orden; `explorar(v)`: si v == n, éxito; para cada color c: si NINGÚN vecino ya
 * coloreado tiene c, elige, explora(v + 1) y deshaz.
 * Podas: (1) FACTIBILIDAD: comprueba el conflicto AL ELEGIR, no al final (sin ello son kⁿ nodos); (2) SIMETRÍA: los colores son
 * intercambiables, así que un vértice solo puede usar un color YA usado o EL SIGUIENTE al mayor usado (color ≤ máximo + 1). Eso evita
 * repetir k! veces cada coloreado. Si nodos != nullptr, suma 1 por llamada recursiva.
 * Las pruebas incluyen K₈ con 7 colores (imposible): con (1) se visitan ~14 000 nodos, con (1) y (2) solo 8.
 * Coste: O(kⁿ) en el peor caso, pero un camino con k = 2 se resuelve en O(n): cada color queda forzado (mira `medir`).
 */
optional<vector<int>> colorearGrafo(const vector<vector<int>>& ady, int k, long long* nodos = nullptr)
{
    pendiente();
    return nullopt;
}

// ── Ejercicio 7 · particionKIguales ──────────────────────────────────────────
/**
 * ¿Se pueden repartir los números en EXACTAMENTE k grupos (todos los números se usan) con la MISMA suma? {4,3,2,3,5,2,1} con
 * k = 4 → true (5 | 1+4 | 2+3 | 2+3). Vacío → true. k < 1 o algún número negativo → invalid_argument. Si `nodos` no es nulo, suma 1
 * por llamada recursiva (una llamada por número colocado).
 * Es la versión general de `particionIgual` (k = 2) del tema 9, pero con k grupos la programación dinámica ya no es tan corta
 * y el backtracking con poda brilla. Algoritmo: suma total; si no es múltiplo de k → false; objetivo = suma / k. Ordena de MAYOR a
 * menor (los grandes restringen más) y, número a número, pruébalo en cada cubo j.
 * Podas: (1) un cubo no puede pasar de `objetivo`; (2) si ningún número cabe en un cubo con la suma actual, ya falla; (3) SIMETRÍA:
 * dos cubos con la MISMA suma actual son intercambiables, prueba solo el primero; (4) el mayor no puede superar `objetivo`.
 * Sin (3) un problema sin solución explora k^n asignaciones; con ella, muy pocas (mira la prueba de nodos).
 * Coste: O(kⁿ) en el peor caso; las podas lo acercan a lo práctico para n ≈ 20.
 */
bool particionKIguales(vector<int> nums, int k, long long* nodos = nullptr)
{
    return pendiente();
}

// ── Ejercicio 8 · resolverSudoku ─────────────────────────────────────────────
/**
 * Resuelve un sudoku 9×9 EN SITIO: `t[f][c]` es 0 en un hueco y 1..9 en un dato. Devuelve true y deja el tablero resuelto, o false y
 * deja el tablero COMO ESTABA si no tiene solución (también si los datos ya se contradicen). Tablero que no sea 9×9 o con números fuera
 * de 0..9 → invalid_argument. Si `nodos` no es nulo, suma 1 por llamada recursiva.
 * Estado: tres vectores de 9 máscaras de bits (filas, columnas, cajas): el bit v está encendido si v ya está usado. Los candidatos de
 * un hueco son `~(fila | columna | caja) & 0x3FE`, y `popcount` (de <bit>) los cuenta.
 * Poda de ORDEN (la heurística MRV, «menos valores restantes»): en cada nodo busca el hueco con MENOS candidatos y expándelo. Si
 * alguno tiene 0, retrocede de inmediato; si tiene 1, es una jugada forzada. Resolver los huecos en orden de lectura (izquierda a
 * derecha, arriba a abajo) hace millones de nodos en algunos sudokus; con MRV, miles. La prueba «anti fuerza bruta» lo comprueba.
 * Coste: exponencial en teoría (el sudoku generalizado es NP-completo); en la práctica, 9×9 con MRV: milisegundos.
 */
bool resolverSudoku(vector<vector<int>>& t, long long* nodos = nullptr)
{
    return pendiente();
}

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. EL ÁRBOL DE BÚSQUEDA Y LO QUE VALE PODAR
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1. Subconjuntos de 1..n que suman n: nodos sin y con poda");

    for (int n : {8, 12, 16, 20}) {
        int a = 0;
        int b = 0;
        long long sin = nodosSinPoda(n, n, 1, 0, &a);
        long long con = nodosConPoda(n, n, 1, 0, &b);
        cout << "n = " << n << ": soluciones " << a << "/" << b << " · nodos sin poda = " << sin << ", con poda = " << con << "\n";
    }
    // Las dos versiones encuentran las MISMAS soluciones; la poda solo evita bajar por ramas condenadas. Con n = 20 son 2 millones
    // de nodos frente a unos pocos miles. Y la diferencia crece exponencialmente: podar es cambiar la base de la exponencial.

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PODAR BIEN: FACTIBILIDAD Y SIMETRÍA (COLOREADO)
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. Colorear K6 con 5 colores (imposible): tres niveles de poda");

    auto k6 = grafoCompleto(6);
    for (int modo = 0; modo < 3; modo++) {
        const char* nombre[] = {"comprobar solo al final", "comprobar al elegir", "al elegir + simetría de colores"};
        cout << nombre[modo] << ": " << nodosColoreoDemo(k6, 5, modo) << " nodos\n";
    }
    // Sin poda el árbol tiene 19 531 nodos (5⁶ = 15 625 hojas). Comprobar al elegir corta casi todo. La simetría corta el resto: los colores son
    // intercambiables, así que el primer vértice solo puede ser 0, el segundo 0 o 1... y no se prueban los 5! reordenamientos de colores.

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CUÁNTO CRECE LA SALIDA: LOS NÚMEROS DE CATALAN
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3. Paréntesis bien formados: Catalan(n)");

    for (int n : {1, 2, 3, 5, 8, 10, 12}) {
        long long total = 1LL << (2 * n);
        cout << "n = " << n << ": bien formadas = " << catalan(n) << " de " << total << " cadenas posibles ("
             << 100.0 * static_cast<double>(catalan(n)) / static_cast<double>(total) << " %)\n";
    }
    // Hay 4ⁿ cadenas de longitud 2n, pero solo ~4ⁿ/(n√n) son válidas: la poda por factibilidad construye directamente esas.

// ═══════════════════════════════════════════════════════════════════════════════
// 4. EL ORDEN IMPORTA: SUDOKU Y «MENOS CANDIDATOS PRIMERO»
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("4. Candidatos de los primeros huecos de un sudoku");

    auto sudoku = sudokuDesdeTexto({"53..7....", "6..195...", ".98....6.", "8...6...3", "4..8.3..1", "7...2...6", ".6....28.", "...419..5", "....8..79"});
    int mejorF = -1;
    int mejorC = -1;
    int mejorN = 10;
    for (int f = 0; f < 9; f++) {
        for (int c = 0; c < 9; c++) {
            if (sudoku[static_cast<size_t>(f)][static_cast<size_t>(c)] == 0) {
                int n = popcount(static_cast<unsigned>(candidatosSudoku(sudoku, f, c)));
                if (f == 0 && c < 4) {
                    cout << "hueco (" << f << "," << c << "): " << n << " candidatos\n";
                }
                if (n < mejorN) {
                    mejorN = n;
                    mejorF = f;
                    mejorC = c;
                }
            }
        }
    }
    cout << "el hueco MÁS restringido es (" << mejorF << "," << mejorC << ") con " << mejorN << " candidato(s)\n";
    // En orden de lectura empezarías por (0,2), con varios candidatos y ninguna pista. MRV empieza por el hueco forzado: no hay
    // decisión que equivocarse, el árbol no se bifurca ahí. «Falla pronto» es el lema: si algo ha de salir mal, que sea arriba.

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    prueba(generarParentesis,
        caso("n = 3", vector<string>{"((()))", "(()())", "(())()", "()(())", "()()()"}, 3),
        caso("n = 0: la cadena vacía", vector<string>{""}, 0),
        caso("n = 1", vector<string>{"()"}, 1),
        caso("n = 2", vector<string>{"(())", "()()"}, 2));
    grupo("generarParentesis (más casos)");
    lanza("n negativo", [&] { generarParentesis(-1); }, invalid_argument);
    comprueba("n = 8 da Catalan(8) = 1430 cadenas", [&] { return generarParentesis(8).size(); }, size_t{1430});
    comprueba("todas distintas, bien formadas y en orden creciente (n = 7)", [&] {
        auto r = generarParentesis(7);
        for (size_t i = 0; i < r.size(); i++) {
            int saldo = 0;
            for (char c : r[i]) {
                saldo += c == '(' ? 1 : -1;
                if (saldo < 0) {
                    return string("cadena mal formada: ") + r[i];
                }
            }
            if (saldo != 0 || (i > 0 && !(r[i - 1] < r[i]))) {
                return string("falla en ") + r[i];
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(permutacionesUnicas,
        caso("con repetidos", vector<vector<int>>{{1, 1, 2}, {1, 2, 1}, {2, 1, 1}}, vector<int>{1, 1, 2}),
        caso("vacío: una permutación vacía", vector<vector<int>>{{}}, vector<int>{}),
        caso("todos distintos", vector<vector<int>>{{1, 2, 3}, {1, 3, 2}, {2, 1, 3}, {2, 3, 1}, {3, 1, 2}, {3, 2, 1}}, vector<int>{3, 1, 2}),
        caso("todos iguales", vector<vector<int>>{{2, 2}}, vector<int>{2, 2}),
        caso("un elemento", vector<vector<int>>{{9}}, vector<int>{9}));
    grupo("permutacionesUnicas (más casos)");
    comprueba("{1,1,2,2,3,3} da 6!/(2!·2!·2!) = 90", [&] { return permutacionesUnicas(vector<int>{3, 1, 2, 3, 1, 2}).size(); }, size_t{90});
    comprueba("PODA: nueve unos visitan 10 nodos y no 9!", [&] {
        long long nodos = 0;
        permutacionesUnicas(vector<int>(9, 1), &nodos);
        return nodos < 50;
    }, true);
    comprueba("PODA: {1,1,1,1,2,2,2,2} visita menos de 1000 nodos", [&] {
        long long nodos = 0;
        auto r = permutacionesUnicas(vector<int>{1, 1, 1, 1, 2, 2, 2, 2}, &nodos);
        return to_string(r.size()) + (nodos < 1000 ? " bien" : " demasiados nodos");
    }, string("70 bien"));

    prueba(combinacionesQueSuman,
        caso("ejemplo con repetidos", vector<vector<int>>{{1, 1, 6}, {1, 2, 5}, {1, 7}, {2, 6}}, vector<int>{10, 1, 2, 7, 6, 1, 5}, 8),
        caso("otro ejemplo", vector<vector<int>>{{1, 2, 2}, {5}}, vector<int>{2, 5, 2, 1, 2}, 5),
        caso("objetivo 0: la combinación vacía", vector<vector<int>>{{}}, vector<int>{3, 4}, 0),
        caso("sin candidatos", vector<vector<int>>{}, vector<int>{}, 3),
        caso("sin solución", vector<vector<int>>{}, vector<int>{4, 6, 8}, 5),
        caso("un elemento no se usa dos veces", vector<vector<int>>{}, vector<int>{2}, 4));
    grupo("combinacionesQueSuman (más casos)");
    lanza("candidato cero", [&] { combinacionesQueSuman(vector<int>{0, 1}, 3); }, invalid_argument);
    lanza("objetivo negativo", [&] { combinacionesQueSuman(vector<int>{1}, -3); }, invalid_argument);
    comprueba("PODA: candidatos 1..30 y objetivo 10 visitan menos de 1000 nodos", [&] {
        long long nodos = 0;
        auto r = combinacionesQueSuman(numeros(30), 10, &nodos);
        return to_string(r.size()) + (nodos < 1000 ? " bien" : " demasiados nodos");
    }, string("10 bien"));
    comprueba("PODA: veinte unos y objetivo 5 visitan menos de 100 nodos", [&] {
        long long nodos = 0;
        auto r = combinacionesQueSuman(vector<int>(20, 1), 5, &nodos);
        return to_string(r.size()) + (nodos < 100 ? " bien" : " demasiados nodos");
    }, string("1 bien"));

    prueba(particionesPalindromos,
        caso("aab", vector<vector<string>>{{"a", "a", "b"}, {"aa", "b"}}, string("aab")),
        caso("una letra", vector<vector<string>>{{"a"}}, string("a")),
        caso("vacía", vector<vector<string>>{{}}, string("")),
        caso("aaa", vector<vector<string>>{{"a", "a", "a"}, {"a", "aa"}, {"aa", "a"}, {"aaa"}}, string("aaa")),
        caso("sin palíndromos largos", vector<vector<string>>{{"a", "b", "c"}}, string("abc")),
        caso("racecar", vector<vector<string>>{{"r", "a", "c", "e", "c", "a", "r"}, {"r", "a", "cec", "a", "r"}, {"r", "aceca", "r"}, {"racecar"}}, string("racecar")));
    grupo("particionesPalindromos (más casos)");
    comprueba("diez aes: 2⁹ = 512 particiones", [&] { return particionesPalindromos(string(10, 'a')).size(); }, size_t{512});

    prueba(palabraEnTablero,
        caso("ABCCED", true, vector<string>{"ABCE", "SFCS", "ADEE"}, string("ABCCED")),
        caso("SEE", true, vector<string>{"ABCE", "SFCS", "ADEE"}, string("SEE")),
        caso("no se reutiliza la celda (ABCB)", false, vector<string>{"ABCE", "SFCS", "ADEE"}, string("ABCB")),
        caso("palabra vacía", true, vector<string>{"A"}, string("")),
        caso("tablero vacío", false, vector<string>{}, string("A")),
        caso("una celda no sirve para dos letras", false, vector<string>{"A"}, string("AA")),
        caso("recorrido en espiral", true, vector<string>{"abc", "hid", "gfe"}, string("abcdefghi")),
        caso("las diagonales no son adyacentes", false, vector<string>{"ab", "cd"}, string("ad")));
    grupo("palabraEnTablero (más casos)");
    lanza("filas desiguales", [&] { palabraEnTablero(vector<string>{"ab", "c"}, "a"); }, invalid_argument);
    comprueba("PRE-PODA: tablero de aes y palabra con una b inexistente", [&] {
        return palabraEnTablero(vector<string>(5, string(5, 'a')), string(20, 'a') + "b");
    }, false);
    comprueba("más letras de las que caben en el tablero", [&] { return palabraEnTablero(vector<string>{"ab", "cd"}, "abcdabcd"); }, false);
    comprueba("el tablero del llamador no se modifica", [&] {
        vector<string> t = {"ABCE", "SFCS", "ADEE"};
        palabraEnTablero(t, "ABCCED");
        return t;
    }, vector<string>{"ABCE", "SFCS", "ADEE"});

    grupo("colorearGrafo");
    comprueba("triángulo con 3 colores", [&] { auto g = grafoCompleto(3); return veredictoColoreo(g, 3, colorearGrafo(g, 3)); }, string("ok"));
    comprueba("triángulo con 2 colores es imposible", [&] { return colorearGrafo(grafoCompleto(3), 2).has_value(); }, false);
    comprueba("ciclo par con 2 colores", [&] { auto g = grafoCiclo(6); return veredictoColoreo(g, 2, colorearGrafo(g, 2)); }, string("ok"));
    comprueba("ciclo impar con 2 colores es imposible", [&] { return colorearGrafo(grafoCiclo(5), 2).has_value(); }, false);
    comprueba("K₄ con 3 colores es imposible, con 4 sí", [&] {
        auto g = grafoCompleto(4);
        return string(colorearGrafo(g, 3) ? "sí" : "no") + "/" + veredictoColoreo(g, 4, colorearGrafo(g, 4));
    }, string("no/ok"));
    comprueba("Petersen con 3 colores", [&] { auto g = grafoPetersen(); return veredictoColoreo(g, 3, colorearGrafo(g, 3)); }, string("ok"));
    comprueba("Petersen con 2 colores es imposible", [&] { return colorearGrafo(grafoPetersen(), 2).has_value(); }, false);
    comprueba("grafo sin vértices: coloreado vacío", [&] { auto r = colorearGrafo(vector<vector<int>>{}, 0); return r.has_value() && r->empty(); }, true);
    comprueba("un vértice con 0 colores es imposible", [&] { return colorearGrafo(vector<vector<int>>(1), 0).has_value(); }, false);
    comprueba("vértices aislados con 1 color", [&] {
        vector<vector<int>> g(5);
        return veredictoColoreo(g, 1, colorearGrafo(g, 1));
    }, string("ok"));
    lanza("k negativo", [&] { colorearGrafo(grafoCompleto(2), -1); }, invalid_argument);
    comprueba("PODA 1: K₈ con 7 colores visita menos de 20000 nodos (comprobar al elegir)", [&] {
        long long nodos = 0;
        bool hay = colorearGrafo(grafoCompleto(8), 7, &nodos).has_value();
        return string(hay ? "hay" : "no hay") + (nodos < 20000 ? " bien" : " demasiados nodos");
    }, string("no hay bien"));
    comprueba("PODA 2: K₈ con 7 colores visita menos de 200 nodos (simetría de colores)", [&] {
        long long nodos = 0;
        colorearGrafo(grafoCompleto(8), 7, &nodos);
        return nodos < 200;
    }, true);

    prueba(particionKIguales,
        caso("ejemplo", true, vector<int>{4, 3, 2, 3, 5, 2, 1}, 4),
        caso("suma no múltiplo de k", false, vector<int>{1, 2, 4}, 2),
        caso("vacío", true, vector<int>{}, 3),
        caso("k = 1: siempre", true, vector<int>{5, 1, 7}, 1),
        caso("un número mayor que el objetivo", false, vector<int>{10, 1, 1, 1, 1}, 2),
        caso("k = 2 clásico", true, vector<int>{1, 5, 11, 5}, 2),
        caso("más cubos que números", false, vector<int>{2, 2}, 3),
        caso("suma múltiplo de k pero no se puede", false, vector<int>{3, 3, 3, 5, 5, 5}, 2),
        caso("ceros", true, vector<int>{0, 0, 0}, 3));
    grupo("particionKIguales (más casos)");
    lanza("k cero", [&] { particionKIguales(vector<int>{1, 2}, 0); }, invalid_argument);
    lanza("número negativo", [&] { particionKIguales(vector<int>{1, -2}, 1); }, invalid_argument);
    comprueba("PODA: 16 números con k = 4, suma múltiplo de 4 y sin solución, visitan menos de 300000 nodos", [&] {
        vector<int> v = {3, 6, 3, 10, 6, 4, 7, 9, 9, 3, 9, 4, 3, 6, 4, 6};     // suma 92 = 4 · 23: pasa el filtro de la suma y aun así no se puede
        long long nodos = 0;
        bool r = particionKIguales(v, 4, &nodos);
        return string(r ? "sí" : "no") + (nodos < 300000 ? " bien" : " demasiados nodos");
    }, string("no bien"));
    comprueba("PODA: ocho cincos y ocho seises con k = 4 (sí tiene solución) visitan menos de 100000 nodos", [&] {
        vector<int> v = {6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5};
        long long nodos = 0;
        bool r = particionKIguales(v, 4, &nodos);
        return string(r ? "sí" : "no") + (nodos < 100000 ? " bien" : " demasiados nodos");
    }, string("sí bien"));

    grupo("resolverSudoku");
    comprueba("sudoku clásico de Wikipedia", [&] {
        auto original = sudokuDesdeTexto({"53..7....", "6..195...", ".98....6.", "8...6...3", "4..8.3..1", "7...2...6", ".6....28.", "...419..5", "....8..79"});
        auto t = original;
        bool ok = resolverSudoku(t);
        return string(ok ? "resuelto" : "sin solución") + ": " + veredictoSudoku(original, t);
    }, string("resuelto: ok"));
    comprueba("solución conocida (única)", [&] {
        auto t = sudokuDesdeTexto({"53..7....", "6..195...", ".98....6.", "8...6...3", "4..8.3..1", "7...2...6", ".6....28.", "...419..5", "....8..79"});
        resolverSudoku(t);
        return t == sudokuDesdeTexto({"534678912", "672195348", "198342567", "859761423", "426853791", "713924856", "961537284", "287419635", "345286179"});
    }, true);
    comprueba("un sudoku ya resuelto se queda igual", [&] {
        auto t = sudokuDesdeTexto({"534678912", "672195348", "198342567", "859761423", "426853791", "713924856", "961537284", "287419635", "345286179"});
        auto copia = t;
        return resolverSudoku(t) && t == copia;
    }, true);
    comprueba("datos que ya se contradicen (dos 5 en una fila): false y sin tocar", [&] {
        auto t = sudokuDesdeTexto({"55.......", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "........."});
        auto copia = t;
        return !resolverSudoku(t) && t == copia;
    }, true);
    comprueba("consistente pero sin solución (el hueco (0,8) no admite ningún número): false y sin tocar", [&] {
        auto t = sudokuDesdeTexto({"12345678.", ".......9.", ".........", ".........", ".........", ".........", ".........", ".........", "........."});
        t[1][8] = 9;
        auto copia = t;
        return !resolverSudoku(t) && t == copia;
    }, true);
    lanza("tablero que no es 9×9", [&] { vector<vector<int>> t(4, vector<int>(4, 0)); resolverSudoku(t); }, invalid_argument);
    lanza("número fuera de 0..9", [&] { auto t = sudokuDesdeTexto({"5........", ".........", ".........", ".........", ".........", ".........", ".........", ".........", "........."}); t[0][0] = 12; resolverSudoku(t); }, invalid_argument);
    comprueba("PODA (MRV): un sudoku pensado contra la fuerza bruta visita menos de 200000 nodos", [&] {
        string datos = "..............3.85..1.2.......5.7.....4...1...9.......5......73..2.1........4...9";
        vector<string> filas;
        for (int f = 0; f < 9; f++) {
            filas.push_back(datos.substr(static_cast<size_t>(f * 9), 9));
        }
        auto original = sudokuDesdeTexto(filas);
        auto t = original;
        long long nodos = 0;
        bool ok = resolverSudoku(t, &nodos);
        return string(ok ? "resuelto" : "sin solución") + ": " + veredictoSudoku(original, t) + (nodos < 200000 ? " bien" : " demasiados nodos");
    }, string("resuelto: ok bien"));

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // La salida de generarParentesis crece como 4ⁿ: se miden n pequeños (de 4 a 12).
    medirCon("generarParentesis", [](int n) { return n; }, [](int& n) { return generarParentesis(n).size(); }, "lineal", rango(4, 12));   // O(4ⁿ)
    // Con letras aleatorias la búsqueda muere en la primera o segunda letra: casi solo cuesta recorrer las celdas.
    medirCon("palabraEnTablero", [](int n) { return tableroAleatorio(n, 1); }, [](vector<string>& t) { return palabraEnTablero(t, "zzzzzzzzzz"); },
        "lineal", rango(50, 800, 50));                                                                                                       // O(n²) (n = lado)
    // Un camino se colorea con 2 colores sin retroceder nunca (cada vértice queda forzado); sin comprobar al elegir, sería 2ⁿ.
    medirCon("colorearGrafo", [](int n) { return grafoCamino(n); }, [](vector<vector<int>>& g) { return colorearGrafo(g, 2).has_value(); },
        "geometrica", vector<int>{64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384});                                                                                              // O(n)
}
