#include <algorithm>
#include <cstdint>
#include <functional>
#include <iostream>
#include <numeric>
#include <queue>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>
using namespace std;

/*
 * TEMA 13 · ALGORITMOS VORACES (greedy)
 * ────────────────────────────────────────────────────────────────────────────
 * LA IDEA: en cada paso eliges lo que MEJOR parece AHORA y no vuelves nunca atrás. Cuando funciona es la técnica más barata
 * que existe (casi siempre «ordenar y recorrer»: O(n log n)); cuando no funciona, da una respuesta que parece razonable y
 * es incorrecta, sin avisar. Por eso lo importante de este tema NO es el código, sino la DEMOSTRACIÓN de que la elección
 * voraz es segura. Hay dos ingredientes que debes poder enunciar:
 *
 *   1. PROPIEDAD DE ELECCIÓN VORAZ: existe una solución óptima que empieza por la elección voraz.
 *   2. SUBESTRUCTURA ÓPTIMA: tras esa elección, lo que queda es el MISMO problema, más pequeño.
 *
 * El método estándar para demostrar el punto 1 es el ARGUMENTO DE INTERCAMBIO: coges una solución óptima cualquiera O que
 * no empieza por la elección voraz g, cambias UNA pieza de O por g y demuestras que no empeora (sigue siendo factible y
 * su valor no baja). Repitiendo el cambio, O se transforma paso a paso en la solución voraz sin perder calidad: luego la
 * voraz es óptima. Variante: «ir por delante» (stay ahead): demuestras que tras cada paso el voraz está al menos tan lejos
 * como cualquier otra solución. Cada ejercicio de esta lección nombra su argumento en la documentación.
 *
 *   Problema                      Criterio voraz                          Coste
 *   Cambio de monedas             la moneda más grande que quepa          O(k)      (¡solo en sistemas canónicos!)
 *   Selección de actividades      la que TERMINA antes                    O(n log n)
 *   Repostajes                    ir lo más lejos posible                 O(n)
 *   Mochila fraccionaria          mayor valor por unidad de peso          O(n log n)
 *   Códigos de Huffman            fundir las dos frecuencias menores      O(n log n)
 *   Planificación con plazos      mayor beneficio, en el último hueco     O(n log n)
 *
 * CONTRAEJEMPLOS: un voraz «casi correcto» falla en una entrada concreta. Aprende a buscarlos a mano: una entrada pequeña
 * donde la elección tentadora te lleve a un callejón. El ejercicio 8 te pide que los busques con un programa.
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
 * │ `sort(v.begin(), v.end(), comparador)` es el `Collections.sort(lista, comparador)` de Java o el `usort`/`sorted(key=)`
 * │ de PHP y Python. El comparador recibe dos elementos y devuelve TRUE si el primero va ANTES del segundo (estrictamente:
 * │ con `<=` el programa tiene comportamiento indefinido). `priority_queue` es un MAX-heap: para sacar el menor primero se
 * │ declara `priority_queue<int, vector<int>, greater<int>>` (en Java, `PriorityQueue` es de mínimos por defecto).
 * └────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Cuántas monedas usa el voraz «la más grande que quepa», o -1 si se queda atascado. Referencia de las demos y las pruebas. */
int vorazRef(int cantidad, vector<int> monedas)
{
    sort(monedas.begin(), monedas.end(), greater<int>());
    int usadas = 0;
    for (int m : monedas) {
        usadas += cantidad / m;
        cantidad %= m;
    }
    return cantidad == 0 ? usadas : -1;
}

/** Mínimo de monedas de verdad (programación dinámica, O(cantidad · k)), o -1 si no se puede pagar. Referencia para comparar. */
int optimoRef(int cantidad, const vector<int>& monedas)
{
    const int INF = 1 << 29;
    vector<int> d(static_cast<size_t>(cantidad) + 1, INF);
    d[0] = 0;
    for (int c = 1; c <= cantidad; c++) {
        for (int m : monedas) {
            if (m <= c && d[static_cast<size_t>(c - m)] + 1 < d[static_cast<size_t>(c)]) {
                d[static_cast<size_t>(c)] = d[static_cast<size_t>(c - m)] + 1;
            }
        }
    }
    return d[static_cast<size_t>(cantidad)] >= INF ? -1 : d[static_cast<size_t>(cantidad)];
}

/**
 * Selección voraz de actividades con el CRITERIO que le pases (cuál va primero): toma cada actividad que no solape con NINGUNA
 * de las ya tomadas. Con el criterio «por fin» basta mirar la última, pero con los demás hay que mirarlas todas (O(n²), da igual
 * aquí). Sirve para comparar criterios en la demo.
 */
int seleccionarPor(vector<pair<int, int>> a, const function<bool(const pair<int, int>&, const pair<int, int>&)>& antes)
{
    sort(a.begin(), a.end(), antes);
    vector<pair<int, int>> tomadas;
    for (const auto& act : a) {
        bool solapa = false;
        for (const auto& t : tomadas) {
            if (act.first < t.second && t.first < act.second) {
                solapa = true;
            }
        }
        if (!solapa) {
            tomadas.push_back(act);
        }
    }
    return static_cast<int>(tomadas.size());
}

/** Fuerza bruta de actividades: prueba los 2^n subconjuntos (n ≤ 16). Es la referencia que valida el voraz en las pruebas. */
int actividadesFuerzaBruta(const vector<pair<int, int>>& a)
{
    int n = static_cast<int>(a.size());
    int mejor = 0;
    for (int mascara = 0; mascara < (1 << n); mascara++) {
        vector<pair<int, int>> sel;
        for (int i = 0; i < n; i++) {
            if (mascara >> i & 1) {
                sel.push_back(a[static_cast<size_t>(i)]);
            }
        }
        sort(sel.begin(), sel.end());
        bool sinSolape = true;
        for (size_t i = 1; i < sel.size(); i++) {
            if (sel[i].first < sel[i - 1].second) {
                sinSolape = false;
            }
        }
        if (sinSolape) {
            mejor = max(mejor, static_cast<int>(sel.size()));
        }
    }
    return mejor;
}

/** n actividades (inicio, fin) pseudoaleatorias y reproducibles, para medir y para comparar con la fuerza bruta. */
vector<pair<int, int>> actividadesAleatorias(int n, int semilla)
{
    vector<int> ini = aleatorios(n, 10 * n + 10, semilla);
    vector<int> dur = aleatorios(n, 19, semilla + 1000);
    vector<pair<int, int>> a;
    for (int i = 0; i < n; i++) {
        a.push_back({ini[static_cast<size_t>(i)], ini[static_cast<size_t>(i)] + dur[static_cast<size_t>(i)] + 1});
    }
    return a;
}

/** n objetos (peso, valor) pseudoaleatorios: pesos de 1 a 100 y valores de 1 a 1000. */
vector<pair<int, int>> objetosAleatorios(int n, int semilla)
{
    vector<int> peso = aleatorios(n, 99, semilla);
    vector<int> valor = aleatorios(n, 999, semilla + 1000);
    vector<pair<int, int>> o;
    for (int i = 0; i < n; i++) {
        o.push_back({peso[static_cast<size_t>(i)] + 1, valor[static_cast<size_t>(i)] + 1});
    }
    return o;
}

/** Trenes de la demo de medición: llegadas pseudoaleatorias y salidas entre 1 y 30 unidades después de cada llegada. */
vector<int> llegadasTrenes(int n)
{
    return aleatorios(n, 10 * n + 10, 1);
}

vector<int> salidasTrenes(int n)
{
    vector<int> llegadas = llegadasTrenes(n);
    vector<int> estancia = aleatorios(n, 29, 2);
    for (int i = 0; i < n; i++) {
        llegadas[static_cast<size_t>(i)] += estancia[static_cast<size_t>(i)] + 1;
    }
    return llegadas;
}

/** n trabajos (plazo, beneficio) pseudoaleatorios: los plazos van de 1 a n. */
vector<pair<int, int>> trabajosAleatorios(int n, int semilla)
{
    vector<int> plazo = aleatorios(n, max(1, n) - 1, semilla);
    vector<int> beneficio = aleatorios(n, 1000, semilla + 1000);
    vector<pair<int, int>> t;
    for (int i = 0; i < n; i++) {
        t.push_back({plazo[static_cast<size_t>(i)] + 1, beneficio[static_cast<size_t>(i)]});
    }
    return t;
}

/** Fuerza bruta de la planificación con plazos (n ≤ 12): prueba cada subconjunto y comprueba si cabe ordenando por plazo. */
long long plazosFuerzaBruta(const vector<pair<int, int>>& t)
{
    int n = static_cast<int>(t.size());
    long long mejor = 0;
    for (int mascara = 0; mascara < (1 << n); mascara++) {
        vector<int> plazos;
        long long valor = 0;
        for (int i = 0; i < n; i++) {
            if (mascara >> i & 1) {
                plazos.push_back(t[static_cast<size_t>(i)].first);
                valor += t[static_cast<size_t>(i)].second;
            }
        }
        sort(plazos.begin(), plazos.end());
        bool cabe = true;
        for (size_t i = 0; i < plazos.size(); i++) {
            if (plazos[i] < static_cast<int>(i) + 1) {      // el trabajo nº i+1 acaba en la hora i+1: debe cumplir su plazo
                cabe = false;
            }
        }
        if (cabe) {
            mejor = max(mejor, valor);
        }
    }
    return mejor;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · cambioVoraz ────────────────────────────────────────────────
/**
 * Devuelve cuántas monedas usa el voraz «toma siempre la moneda más grande que quepa», o -1 si se queda atascado (le sobra
 * una cantidad que ninguna moneda puede pagar). `monedas` viene en cualquier orden y sin repetir; cantidad ≥ 0.
 * Idea: ordena las monedas de mayor a menor y, para cada una, toma TODAS las que quepan de golpe con `cantidad / m` y
 * quédate con el resto `cantidad % m`. Así no restas de una en una: el coste NO depende de la cantidad.
 * ¡CUIDADO!: este voraz es óptimo solo en sistemas «canónicos» ({1, 5, 10, 25}, el euro...). Con {1, 3, 4} y cantidad 6 da
 * 4+1+1 = 3 monedas y lo mejor es 3+3 = 2. Las pruebas incluyen ese caso: no esperan 2, esperan lo que DEVUELVE el voraz.
 * Una moneda ≤ 0 o una cantidad negativa → invalid_argument.
 * Coste: O(k log k) por ordenar las k monedas y O(k) después: independiente de la cantidad.
 */
int cambioVoraz(int cantidad, const vector<int>& monedas)
{
    return pendiente();
}

// ── Ejercicio 2 · seleccionActividades ───────────────────────────────────────
/**
 * Cada actividad es (inicio, fin) con fin > inicio y ocupa el intervalo [inicio, fin): una que acaba en t deja libre el instante t
 * para otra que empiece en t. ¿Cuál es el MÁXIMO número de actividades sin solapes? Devuelve ese número.
 * Criterio voraz: ordena por HORA DE FIN y toma cada actividad cuyo inicio sea ≥ al fin de la última tomada.
 * Argumento de intercambio: sea g la que acaba antes de todas. Si una solución óptima no la contiene, cambia su primera
 * actividad por g: g acaba no más tarde, así que sigue sin solapar con las demás, y el número de actividades no baja.
 * Otros criterios FALLAN: «la que empieza antes» ({(0,10),(1,2),(3,4)} da 1 y lo mejor es 2) o «la más corta»
 * ({(0,5),(4,6),(5,10)} da 1 y lo mejor es 2). Mira la demo 2: cuenta cada criterio sobre datos aleatorios.
 * Una actividad con fin ≤ inicio → invalid_argument.
 * Coste: O(n log n) por la ordenación; el recorrido es O(n).
 */
int seleccionActividades(const vector<pair<int, int>>& actividades)
{
    return pendiente();
}

// ── Ejercicio 3 · repostajes ─────────────────────────────────────────────────
/**
 * Un coche recorre `destino` kilómetros con un depósito que da para `autonomia` km. Sale lleno de la posición 0 y puede
 * repostar (llenar) en las gasolineras de `estaciones` (posiciones estrictamente crecientes, todas en (0, destino)).
 * Devuelve el MÍNIMO de paradas para llegar, o -1 si es imposible. Si autonomia ≥ destino, 0 paradas.
 * Criterio voraz («ir por delante»): conduce hasta el límite y para en la gasolinera MÁS LEJANA que alcances. Invariante:
 * tras k paradas, ninguna estrategia con k paradas llega más lejos que la voraz (inducción: la voraz elige, de entre las
 * alcanzables, la que deja el depósito lleno más adelante). Si no hay ninguna gasolinera nueva alcanzable, estás atascado.
 * Coste: O(n): cada gasolinera se mira una sola vez con un índice que solo avanza.
 */
int repostajes(int destino, int autonomia, const vector<int>& estaciones)
{
    return pendiente();
}

// ── Ejercicio 4 · minimoAndenes ──────────────────────────────────────────────
/**
 * El tren i llega en llegadas[i] y sale en salidas[i] (siempre salidas[i] > llegadas[i]). Un andén queda libre en el instante en
 * que sale su tren: otro puede llegar en ese mismo instante. ¿Cuántos andenes hacen falta como mínimo?
 * Idea: el mínimo es el MÁXIMO de trenes presentes a la vez. Ordena las llegadas y las salidas POR SEPARADO y recórrelas
 * como una mezcla: si la próxima llegada es anterior a la próxima salida entra un tren (andenes++), si no, sale uno.
 * Anota el máximo. Por qué vale ordenar por separado: para el recuento solo importan los instantes, no qué tren es cuál.
 * Vectores de distinto tamaño o una salida que no sea posterior a su llegada → invalid_argument. Sin trenes → 0.
 * Coste: O(n log n) por las dos ordenaciones; la mezcla es O(n).
 */
int minimoAndenes(const vector<int>& llegadas, const vector<int>& salidas)
{
    return pendiente();
}

// ── Ejercicio 5 · mochilaFraccionaria ────────────────────────────────────────
/**
 * Cada objeto es (peso, valor) y se puede coger una FRACCIÓN de él (el valor es proporcional). Con capacidad `cap`,
 * ¿cuál es el máximo valor transportable? Devuelve un double. Pesos > 0 y cap ≥ 0, si no invalid_argument.
 * Criterio voraz: ordena por valor/peso de mayor a menor, mete los objetos enteros mientras quepan y rellena el hueco con
 * la fracción cap_restante/peso del siguiente. Argumento de intercambio: si una solución óptima lleva algo de un objeto
 * peor mientras deja sitio sin usar de uno con mejor razón, cambia un poco de peso del peor por el mismo peso del mejor:
 * el valor sube o se queda igual. ¡Esto NO vale en la mochila 0/1 (sin fracciones): allí hay que usar programación dinámica!
 * Compara con la demo 3: {(10,60), (20,100), (30,120)} con cap 50 da 240 aquí y 220 en la 0/1.
 * Trampa: ordena con una comparación de razones SIN dividir por cero ni perder precisión: v1·p2 > v2·p1 en long long.
 * Coste: O(n log n).
 */
double mochilaFraccionaria(const vector<pair<int, int>>& objetos, int cap)
{
    return pendiente();
}

// ── Ejercicio 6 · costeHuffman ───────────────────────────────────────────────
/**
 * Dadas las frecuencias de n símbolos, un código de Huffman da al símbolo más raro el código más largo. Aquí NO hace falta
 * construir los códigos: devuelve el COSTE TOTAL = suma de frecuencia · longitud del código, el número de bits que ocupa el
 * mensaje. Truco: cada vez que fundes dos nodos de pesos a y b, todos los símbolos que cuelgan de ellos bajan un nivel
 * (un bit más), lo que añade exactamente a + b al coste. Así el coste total es la SUMA de los pesos de todas las fusiones.
 * Algoritmo voraz: mete las frecuencias en un min-heap; mientras queden ≥ 2, saca las dos menores, fúndelas (suma), suma
 * ese peso al coste y devuélvelo al heap. Con 0 o 1 símbolos no hay fusiones: 0. Frecuencia negativa → invalid_argument.
 * Argumento de intercambio: los dos símbolos menos frecuentes pueden ser hermanos en el nivel más profundo de un árbol
 * óptimo (si no lo son, intercámbialos con los que están ahí: el coste no sube). Ejemplo {5,9,12,13,16,45} → 224.
 * Usa long long: 10⁵ frecuencias de 10⁹ suman mucho más que un int. `priority_queue` es de máximos: pasa `greater<>`.
 * Coste: O(n log n) (n fusiones, cada una con operaciones O(log n) en el heap).
 */
long long costeHuffman(const vector<int>& frecuencias)
{
    return pendiente();
}

// ── Ejercicio 7 · planificarConPlazos ────────────────────────────────────────
/**
 * Cada trabajo es (plazo, beneficio), dura UNA hora y solo cuenta si termina como tarde en la hora `plazo` (la hora 1 es
 * la primera; un plazo ≤ 0 es imposible de cumplir). Con una sola máquina, ¿cuál es el máximo beneficio total?
 * Beneficios ≥ 0 (si no, invalid_argument). Devuelve long long.
 * Idea (la más corta de programar): ordena por PLAZO creciente y mantén un min-heap con los beneficios de los trabajos
 * aceptados. Al llegar un trabajo, mételo; si ahora hay más trabajos aceptados que su plazo (no caben en las horas
 * 1..plazo), expulsa el de MENOR beneficio. Al final el heap es el conjunto óptimo.
 * Invariante: tras procesar los plazos ≤ d, el heap guarda el mejor conjunto factible que usa solo las horas 1..d.
 * Argumento de intercambio: si el conjunto no tiene al trabajo más rentable que cabría, sustituye el de menor beneficio
 * por él: sigue siendo factible y el total no baja.
 * Coste: O(n log n).
 */
long long planificarConPlazos(const vector<pair<int, int>>& trabajos)
{
    return pendiente();
}

// ── Ejercicio 8 · primerContraejemplo ────────────────────────────────────────
/**
 * Un sistema de monedas es CANÓNICO si el voraz del ejercicio 1 es óptimo para TODAS las cantidades. Devuelve la
 * MENOR cantidad ≥ 1 en la que el voraz usa más monedas que el óptimo, o -1 si el sistema es canónico.
 * `monedas` contiene el 1 (así toda cantidad se puede pagar; si no, invalid_argument), sin repetir y en cualquier orden.
 * Ejemplos: {1,3,4} → 6 (voraz 4+1+1, óptimo 3+3); {1,5,10,25} → -1; {1,5,10,20,25} → 40 (25+10+5 frente a 20+20).
 * ¿Hasta dónde buscar? Teorema de Kozen y Zaks: si hay contraejemplo, el menor es MENOR que c[k-2] + c[k-1] (la suma de las dos
 * monedas mayores). Con ese tope la búsqueda es finita. Para cada cantidad x en 1..tope compara el voraz (`cantidad / m`)
 * con el óptimo, que sale de una tabla de programación dinámica d[x] = 1 + min(d[x - m]) calculada una sola vez.
 * Idea para el razonamiento: aquí el algoritmo voraz es la HIPÓTESIS y el programa la refuta con una entrada concreta.
 * Coste: O(M·k) con M ≤ 2·(moneda mayor) y k monedas.
 */
int primerContraejemplo(const vector<int>& monedas)
{
    return pendiente();
}

// ═══════════════════════════════════════════════════════════════════════════════
int main()
{
// ═══════════════════════════════════════════════════════════════════════════════
// 1. EL VORAZ TENTADOR QUE FALLA
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("1. Cambio de monedas: cuándo el voraz acierta y cuándo no");

    for (int cantidad : {6, 30, 63}) {
        for (const auto& sistema : {vector<int>{1, 5, 10, 25}, vector<int>{1, 3, 4}, vector<int>{1, 5, 10, 20, 25}}) {
            cout << "cantidad " << cantidad << " con " << mostrar(sistema) << ": voraz = " << vorazRef(cantidad, sistema)
                 << ", óptimo = " << optimoRef(cantidad, sistema) << (vorazRef(cantidad, sistema) == optimoRef(cantidad, sistema) ? "" : "   <-- el voraz pierde") << "\n";
        }
    }
    // Moraleja: «parece lo mejor ahora» no es una demostración. Para {1, 3, 4} la elección tentadora (la moneda 4) NO forma
    // parte de ninguna solución óptima de 6: falla la propiedad de elección voraz. Haría falta programación dinámica (tema 9).

// ═══════════════════════════════════════════════════════════════════════════════
// 2. CRITERIOS PARA ELEGIR ACTIVIDADES
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("2. Selección de actividades: solo UN criterio es correcto");

    using Act = pair<int, int>;
    auto porFin = [](const Act& a, const Act& b) { return a.second < b.second || (a.second == b.second && a.first < b.first); };
    auto porInicio = [](const Act& a, const Act& b) { return a.first < b.first; };
    auto porDuracion = [](const Act& a, const Act& b) { return a.second - a.first < b.second - b.first; };
    for (int semilla = 1; semilla <= 4; semilla++) {
        vector<Act> a = actividadesAleatorias(12, semilla);
        cout << "semilla " << semilla << ": por fin = " << seleccionarPor(a, porFin) << "  por inicio = " << seleccionarPor(a, porInicio)
             << "  por duración = " << seleccionarPor(a, porDuracion) << "  fuerza bruta = " << actividadesFuerzaBruta(a) << "\n";
    }
    // «Por fin» coincide SIEMPRE con la fuerza bruta (es el argumento de intercambio hecho código); los otros se quedan cortos
    // en cuanto la entrada tiene una actividad larga que tapa a varias cortas.

// ═══════════════════════════════════════════════════════════════════════════════
// 3. MOCHILA: FRACCIONARIA FRENTE A 0/1
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("3. Mochila: por qué dividir un objeto cambia el algoritmo");

    vector<pair<int, int>> objetos = {{10, 60}, {20, 100}, {30, 120}};
    for (const auto& [peso, valor] : objetos) {
        cout << "peso " << peso << " valor " << valor << " razón " << static_cast<double>(valor) / peso << "\n";
    }
    // Capacidad 50, por razón (6, 5, 4): fraccionaria = 60 + 100 + 120 · 20/30 = 240. Con la 0/1 el voraz por razón coge
    // los objetos 1 y 2 (valor 160, sobran 20 kg que no sirven para el 3) y el óptimo es 100 + 120 = 220: el hueco sobrante
    // es lo que no se puede rellenar sin fracciones. La mochila 0/1 se resuelve con programación dinámica (tema 9).

// ═══════════════════════════════════════════════════════════════════════════════
// 4. HUFFMAN: EL COSTE ES LA SUMA DE LAS FUSIONES
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("4. Huffman con {5, 9, 12, 13, 16, 45}");

    // Fusiones: 5+9=14 · 12+13=25 · 14+16=30 · 25+30=55 · 45+55=100  →  coste = 14+25+30+55+100 = 224.
    // Con una codificación de longitud fija (3 bits por símbolo) serían 3 · 100 = 300 bits: Huffman ahorra el 25 %.
    long long fijo = 3LL * (5 + 9 + 12 + 13 + 16 + 45);
    cout << "longitud fija de 3 bits: " << fijo << " bits; Huffman (a mano): 224 bits\n";

// ═══════════════════════════════════════════════════════════════════════════════
// 5. COMPROBAR UN VORAZ: FUERZA BRUTA EN ENTRADAS PEQUEÑAS
// ═══════════════════════════════════════════════════════════════════════════════
    titulo("5. Cómo se sospecha de un voraz");

    // Sin demostración, la defensa práctica es comparar con una solución EXHAUSTIVA (lenta pero obviamente correcta) sobre
    // muchas entradas pequeñas aleatorias. Si hay un contraejemplo pequeño, casi seguro sale. Las pruebas de abajo lo hacen.
    int distintos = 0;
    for (int semilla = 1; semilla <= 50; semilla++) {
        vector<Act> a = actividadesAleatorias(10, semilla);
        if (seleccionarPor(a, porInicio) != actividadesFuerzaBruta(a)) {
            distintos++;
        }
    }
    cout << "el criterio «por inicio» falla en " << distintos << " de 50 entradas aleatorias de 10 actividades\n";

// ═══════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ═══════════════════════════════════════════════════════════════════════════════
    prueba(cambioVoraz,
        caso("euro-céntimos", 6, 63, vector<int>{1, 5, 10, 25}),
        caso("cantidad 0", 0, 0, vector<int>{1, 5}),
        caso("monedas desordenadas", 3, 12, vector<int>{5, 1, 10}),
        caso("sin moneda 1 y atascado", -1, 3, vector<int>{5, 10}),
        caso("el voraz NO es óptimo: {1,3,4} y 6 da 3 monedas (lo mejor es 2)", 3, 6, vector<int>{1, 3, 4}),
        caso("el voraz se atasca aunque exista solución (6 = 2+2+2)", -1, 6, vector<int>{2, 5}),
        caso("cantidad grande", 4000, 1000000, vector<int>{1, 25, 100, 250}),
        caso("una sola moneda", 7, 21, vector<int>{3}));
    grupo("cambioVoraz (más casos)");
    lanza("moneda cero", [&] { cambioVoraz(5, vector<int>{0, 1}); }, invalid_argument);
    lanza("cantidad negativa", [&] { cambioVoraz(-1, vector<int>{1}); }, invalid_argument);
    comprueba("no modifica el vector de entrada", [&] {
        vector<int> m = {1, 5, 10};
        cambioVoraz(17, m);
        return m;
    }, vector<int>{1, 5, 10});
    comprueba("en el euro coincide con el óptimo para todas las cantidades hasta 500", [&] {
        vector<int> euro = {1, 2, 5, 10, 20, 50, 100, 200};
        for (int c = 0; c <= 500; c++) {
            if (cambioVoraz(c, euro) != optimoRef(c, euro)) {
                return string("falla con ") + to_string(c);
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(seleccionActividades,
        caso("ejemplo clásico (CLRS)", 4, vector<pair<int, int>>{{1, 4}, {3, 5}, {0, 6}, {5, 7}, {3, 9}, {5, 9}, {6, 10}, {8, 11}, {8, 12}, {2, 14}, {12, 16}}),
        caso("vacío", 0, vector<pair<int, int>>{}),
        caso("una actividad", 1, vector<pair<int, int>>{{5, 9}}),
        caso("se tocan: [1,2) y [2,3) no solapan", 3, vector<pair<int, int>>{{1, 2}, {2, 3}, {3, 4}}),
        caso("todas solapan", 1, vector<pair<int, int>>{{1, 10}, {2, 9}, {3, 8}}),
        caso("fallaría «por inicio»", 2, vector<pair<int, int>>{{0, 10}, {1, 2}, {3, 4}}),
        caso("fallaría «la más corta»", 2, vector<pair<int, int>>{{0, 5}, {4, 6}, {5, 10}}),
        caso("desordenadas", 3, vector<pair<int, int>>{{6, 8}, {0, 2}, {3, 5}, {1, 7}}));
    grupo("seleccionActividades (más casos)");
    lanza("fin antes que inicio", [&] { seleccionActividades(vector<pair<int, int>>{{5, 3}}); }, invalid_argument);
    lanza("actividad de duración cero", [&] { seleccionActividades(vector<pair<int, int>>{{5, 5}}); }, invalid_argument);
    comprueba("coincide con la fuerza bruta en 60 entradas aleatorias de 11 actividades", [&] {
        for (int semilla = 1; semilla <= 60; semilla++) {
            vector<pair<int, int>> a = actividadesAleatorias(11, semilla);
            if (seleccionActividades(a) != actividadesFuerzaBruta(a)) {
                return string("falla con la semilla ") + to_string(semilla);
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(repostajes,
        caso("ejemplo", 2, 10, 4, vector<int>{2, 4, 6, 8}),
        caso("llega sin repostar", 0, 10, 10, vector<int>{5}),
        caso("sin gasolineras y no llega", -1, 10, 3, vector<int>{}),
        caso("hueco demasiado grande", -1, 10, 3, vector<int>{2, 4, 9}),
        caso("hay que parar en la más lejana, no en la primera", 1, 10, 6, vector<int>{1, 2, 3, 5}),
        caso("una parada justo en el límite", 1, 10, 5, vector<int>{5}),
        caso("muchas paradas", 4, 120, 25, vector<int>{10, 25, 30, 50, 55, 75, 99}));
    grupo("repostajes (más casos)");
    comprueba("autonomía cero no llega a ningún sitio", [&] { return repostajes(5, 0, vector<int>{1, 2, 3, 4}); }, -1);
    comprueba("destino 0: ya has llegado", [&] { return repostajes(0, 5, vector<int>{}); }, 0);

    prueba(minimoAndenes,
        caso("ejemplo clásico", 3, vector<int>{900, 940, 950, 1100, 1500, 1800}, vector<int>{910, 1200, 1120, 1130, 1900, 2000}),
        caso("sin trenes", 0, vector<int>{}, vector<int>{}),
        caso("un tren", 1, vector<int>{5}, vector<int>{9}),
        caso("uno sale justo cuando llega otro: reutilizan andén", 1, vector<int>{1, 2}, vector<int>{2, 3}),
        caso("todos a la vez", 4, vector<int>{1, 1, 1, 1}, vector<int>{5, 5, 5, 5}),
        caso("un tren que se queda toda la noche", 2, vector<int>{1, 3, 6}, vector<int>{20, 4, 7}),
        caso("dos trenes idénticos", 2, vector<int>{4, 4}, vector<int>{9, 9}));
    grupo("minimoAndenes (más casos)");
    lanza("tamaños distintos", [&] { minimoAndenes(vector<int>{1, 2}, vector<int>{3}); }, invalid_argument);
    lanza("sale antes de llegar", [&] { minimoAndenes(vector<int>{5}, vector<int>{4}); }, invalid_argument);
    lanza("sale en el mismo instante en que llega", [&] { minimoAndenes(vector<int>{5}, vector<int>{5}); }, invalid_argument);

    prueba(mochilaFraccionaria,
        caso("ejemplo clásico", 240.0, vector<pair<int, int>>{{10, 60}, {20, 100}, {30, 120}}, 50),
        caso("capacidad 0", 0.0, vector<pair<int, int>>{{10, 60}}, 0),
        caso("sin objetos", 0.0, vector<pair<int, int>>{}, 10),
        caso("cabe todo", 280.0, vector<pair<int, int>>{{10, 60}, {20, 100}, {30, 120}}, 100),
        caso("fracción de un solo objeto", 4.0, vector<pair<int, int>>{{4, 8}}, 2),
        caso("desordenados: el mejor entero y fracción del siguiente", 9.0, vector<pair<int, int>>{{5, 5}, {2, 8}, {10, 10}}, 3),
        caso("razones iguales", 30.0, vector<pair<int, int>>{{5, 10}, {3, 6}, {7, 14}}, 15));
    grupo("mochilaFraccionaria (más casos)");
    lanza("peso cero", [&] { mochilaFraccionaria(vector<pair<int, int>>{{0, 5}}, 10); }, invalid_argument);
    lanza("capacidad negativa", [&] { mochilaFraccionaria(vector<pair<int, int>>{{1, 5}}, -1); }, invalid_argument);
    comprueba("valores grandes: la razón se compara sin desbordar un int", [&] {
        return mochilaFraccionaria(vector<pair<int, int>>{{2000000000, 2000000000}, {1999999999, 1999999999}}, 2000000000);
    }, 2000000000.0);

    prueba(costeHuffman,
        caso("ejemplo clásico", 224LL, vector<int>{5, 9, 12, 13, 16, 45}),
        caso("sin símbolos", 0LL, vector<int>{}),
        caso("un símbolo: no hace falta ningún bit", 0LL, vector<int>{7}),
        caso("dos símbolos", 3LL, vector<int>{1, 2}),
        caso("cuatro iguales", 8LL, vector<int>{1, 1, 1, 1}),
        caso("1..5", 33LL, vector<int>{1, 2, 3, 4, 5}),
        caso("frecuencias cero", 5LL, vector<int>{0, 0, 5}),
        caso("sin desbordar un int", 8000000000LL, vector<int>{1000000000, 1000000000, 1000000000, 1000000000}));
    grupo("costeHuffman (más casos)");
    lanza("frecuencia negativa", [&] { costeHuffman(vector<int>{3, -1}); }, invalid_argument);
    comprueba("no modifica la entrada", [&] {
        vector<int> f = {4, 1, 3};
        costeHuffman(f);
        return f;
    }, vector<int>{4, 1, 3});

    prueba(planificarConPlazos,
        caso("ejemplo clásico: 100 + 27 + 15", 142LL, vector<pair<int, int>>{{2, 100}, {1, 19}, {2, 27}, {1, 25}, {3, 15}}),
        caso("vacío", 0LL, vector<pair<int, int>>{}),
        caso("todos con plazo 1: solo uno cabe", 9LL, vector<pair<int, int>>{{1, 5}, {1, 9}, {1, 7}}),
        caso("plazos amplios: caben todos", 6LL, vector<pair<int, int>>{{5, 1}, {5, 2}, {5, 3}}),
        caso("plazo 0: imposible", 5LL, vector<pair<int, int>>{{0, 100}, {1, 5}}),
        caso("un trabajo desplaza a otro de menos beneficio", 160LL, vector<pair<int, int>>{{1, 10}, {2, 50}, {2, 60}, {1, 100}}),
        caso("beneficios cero", 0LL, vector<pair<int, int>>{{2, 0}, {3, 0}}));
    grupo("planificarConPlazos (más casos)");
    lanza("beneficio negativo", [&] { planificarConPlazos(vector<pair<int, int>>{{1, -4}}); }, invalid_argument);
    comprueba("coincide con la fuerza bruta en 60 entradas aleatorias de 10 trabajos", [&] {
        for (int semilla = 1; semilla <= 60; semilla++) {
            vector<pair<int, int>> t = trabajosAleatorios(10, semilla);
            if (planificarConPlazos(t) != plazosFuerzaBruta(t)) {
                return string("falla con la semilla ") + to_string(semilla);
            }
        }
        return string("ok");
    }, string("ok"));

    prueba(primerContraejemplo,
        caso("{1,3,4}", 6, vector<int>{1, 3, 4}),
        caso("sistema canónico de céntimos", -1, vector<int>{1, 5, 10, 25}),
        caso("{1,5,10,20,25} falla en 40", 40, vector<int>{1, 5, 10, 20, 25}),
        caso("solo la moneda 1", -1, vector<int>{1}),
        caso("el euro es canónico", -1, vector<int>{200, 100, 50, 20, 10, 5, 2, 1}),
        caso("{1,5,12}", 15, vector<int>{1, 5, 12}),
        caso("desordenado {6,1,4}", 8, vector<int>{6, 1, 4}));
    grupo("primerContraejemplo (más casos)");
    lanza("sin la moneda 1", [&] { primerContraejemplo(vector<int>{2, 5}); }, invalid_argument);
    comprueba("el resultado es de verdad el primer contraejemplo (200 sistemas aleatorios)", [&] {
        for (int semilla = 1; semilla <= 200; semilla++) {
            vector<int> v = aleatorios(3, 20, semilla);
            vector<int> monedas = {1};
            for (int x : v) {
                if (x >= 2 && find(monedas.begin(), monedas.end(), x) == monedas.end()) {
                    monedas.push_back(x);
                }
            }
            int c = primerContraejemplo(monedas);
            int tope = 2 * *max_element(monedas.begin(), monedas.end()) + 2;
            int primero = -1;
            for (int x = 1; x <= tope && primero < 0; x++) {
                if (vorazRef(x, monedas) != optimoRef(x, monedas)) {
                    primero = x;
                }
            }
            if (c != primero) {
                return string("falla con la semilla ") + to_string(semilla) + ": " + to_string(c) + " en vez de " + to_string(primero);
            }
        }
        return string("ok");
    }, string("ok"));

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
    // Una sola llamada tarda nanosegundos (el reloj no la distingue del ruido): cada repetición hace 1000 seguidas.
    medirCon("cambioVoraz", [](int n) { return n; }, [](int& n) {
        for (int i = 0; i < 1000; i++) {
            noOptimizar(cambioVoraz(n + i, vector<int>{1, 5, 10, 25, 100}));
        }
    });                                                                                            // O(1)
    medir(seleccionActividades, actividadesAleatorias(n, 1));                                      // O(n log n)
    medir(repostajes, 2 * n + 2, 5, rango(2, 2 * n, 2));                                           // O(n)
    medir(minimoAndenes, llegadasTrenes(n), salidasTrenes(n));                                     // O(n log n)
    medir(mochilaFraccionaria, objetosAleatorios(n, 3), n * 5);                                  // O(n log n)
    // (tamaños acotados: a partir de ~10⁵ elementos el heap deja de caber en la caché y el tiempo sube más de lo que dice la teoría)
    medir(costeHuffman, aleatorios(n, 1000000, 1), "geometrica", vector<int>{256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536});         // O(n log n)
    medir(planificarConPlazos, trabajosAleatorios(n, 1), "geometrica", vector<int>{256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536});   // O(n log n)
}
