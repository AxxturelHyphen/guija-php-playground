#include <algorithm>
#include <functional>
#include <queue>
#include <stdexcept>
#include <utility>
#include <vector>
using namespace std;

/*
 * SOLUCIONES · Tema 13 · Algoritmos voraces
 * Cada declaración sustituye a la que tiene el mismo nombre en tu ejercicio.
 */

/**
 * Cambio de monedas voraz.
 *
 * @complejidad Tiempo O(k log k) por ordenar las k monedas y O(k) por el recorrido, sin depender de la cantidad; espacio O(k).
 * @explicacion Se ordenan las monedas de mayor a menor (en una copia: el parámetro es const). Para cada moneda, `cantidad / m` es
 * cuántas caben de golpe y `cantidad % m` lo que queda: restar de una en una costaría O(cantidad / moneda mayor). Si al final sobra
 * algo, el voraz se atasca y devuelve -1. Es óptimo solo en sistemas canónicos: con {1, 3, 4} y 6 da 4+1+1 (3 monedas) cuando
 * 3+3 (2 monedas) es mejor, porque la moneda 4 no pertenece a ninguna solución óptima de 6: falla la propiedad de elección voraz.
 * @alternativas Para sistemas cualesquiera hace falta programación dinámica (O(cantidad · k)), como en el tema 9.
 * @bigo 1
 */
int cambioVoraz(int cantidad, const vector<int>& monedas)
{
    if (cantidad < 0) {
        throw invalid_argument("cambioVoraz: la cantidad no puede ser negativa");
    }
    vector<int> orden(monedas);
    for (int m : orden) {
        if (m <= 0) {
            throw invalid_argument("cambioVoraz: las monedas deben ser positivas");
        }
    }
    sort(orden.begin(), orden.end(), greater<int>());
    int usadas = 0;
    for (int m : orden) {
        usadas += cantidad / m;
        cantidad %= m;
    }
    return cantidad == 0 ? usadas : -1;
}

/**
 * Selección de actividades por hora de fin.
 *
 * @complejidad Tiempo O(n log n) por la ordenación y O(n) por el recorrido; espacio O(n) (copia ordenada).
 * @explicacion Se ordena por fin y se toma cada actividad cuyo inicio no sea anterior al fin de la última tomada. Es correcto por un
 * argumento de intercambio: la actividad que acaba antes, g, se puede suponer en una solución óptima (si no está, se cambia la primera
 * actividad de esa solución por g, que acaba no más tarde y por tanto no solapa con las siguientes), y lo que queda es el mismo
 * problema sobre las actividades que empiezan a partir del fin de g. Ordenar por inicio o por duración falla: una actividad larga puede
 * tapar a varias cortas, o una corta puede quedar en medio de dos compatibles.
 * @alternativas Programación dinámica (intervalos con peso, O(n log n)), necesaria si cada actividad tuviera un valor distinto.
 * @bigo nlogn
 */
int seleccionActividades(const vector<pair<int, int>>& actividades)
{
    vector<pair<int, int>> orden(actividades);
    for (const auto& [ini, fin] : orden) {
        if (fin <= ini) {
            throw invalid_argument("seleccionActividades: el fin debe ser posterior al inicio");
        }
    }
    sort(orden.begin(), orden.end(), [](const pair<int, int>& a, const pair<int, int>& b) { return a.second < b.second; });
    int elegidas = 0;
    bool hayUltima = false;
    int finUltima = 0;
    for (const auto& [ini, fin] : orden) {
        if (!hayUltima || ini >= finUltima) {
            elegidas++;
            hayUltima = true;
            finUltima = fin;
        }
    }
    return elegidas;
}

/**
 * Repostajes mínimos.
 *
 * @complejidad Tiempo O(n), espacio O(1): el índice de gasolineras solo avanza.
 * @explicacion `alcance` es el punto más lejano al que llega el depósito actual. Mientras no se llegue al destino, se recorren las
 * gasolineras con posición ≤ alcance y se recuerda la última (la más lejana); parar en ella es la jugada voraz. Si no apareció ninguna
 * gasolinera nueva, el coche no puede avanzar: -1. Es correcto «por ir por delante»: tras k paradas, ninguna estrategia llega más
 * lejos que esta, porque la voraz recarga siempre en el punto más adelantado de los alcanzables.
 * @alternativas Programación dinámica sobre las gasolineras: O(n²), válida si cada parada costase algo distinto.
 * @bigo n
 */
int repostajes(int destino, int autonomia, const vector<int>& estaciones)
{
    long long alcance = autonomia;
    size_t i = 0;
    int paradas = 0;
    while (alcance < destino) {
        long long mejor = -1;
        while (i < estaciones.size() && estaciones[i] <= alcance) {
            mejor = estaciones[i];
            i++;
        }
        if (mejor < 0) {
            return -1;
        }
        alcance = mejor + autonomia;
        paradas++;
    }
    return paradas;
}

/**
 * Mínimo de andenes.
 *
 * @complejidad Tiempo O(n log n) por las dos ordenaciones y O(n) por la mezcla; espacio O(n).
 * @explicacion Los andenes necesarios son el máximo de trenes presentes a la vez, y ese máximo solo depende de los instantes,
 * no de qué tren es cuál: se ordenan llegadas y salidas por separado y se recorren como en una mezcla. Si la próxima llegada es
 * estrictamente anterior a la próxima salida, entra un tren; si no (la salida va antes o a la vez), sale uno y su andén queda libre.
 * Con igualdad se procesa primero la salida, que es lo que permite reutilizar el andén en el mismo instante.
 * @alternativas Un barrido con eventos (+1 en la llegada, -1 en la salida) ordenados juntos, o un min-heap con las salidas de los
 * trenes presentes: el mismo coste.
 * @bigo nlogn
 */
int minimoAndenes(const vector<int>& llegadas, const vector<int>& salidas)
{
    if (llegadas.size() != salidas.size()) {
        throw invalid_argument("minimoAndenes: hay que dar tantas salidas como llegadas");
    }
    for (size_t i = 0; i < llegadas.size(); i++) {
        if (salidas[i] <= llegadas[i]) {
            throw invalid_argument("minimoAndenes: cada tren debe salir después de llegar");
        }
    }
    vector<int> ll(llegadas);
    vector<int> sa(salidas);
    sort(ll.begin(), ll.end());
    sort(sa.begin(), sa.end());
    int actuales = 0;
    int maximo = 0;
    size_t i = 0;
    size_t j = 0;
    while (i < ll.size()) {
        if (ll[i] < sa[j]) {
            actuales++;
            maximo = max(maximo, actuales);
            i++;
        } else {
            actuales--;
            j++;
        }
    }
    return maximo;
}

/**
 * Mochila fraccionaria.
 *
 * @complejidad Tiempo O(n log n) por la ordenación; el recorrido es O(n); espacio O(n).
 * @explicacion Se ordenan los objetos por valor/peso decreciente comparando `v1 · p2 > v2 · p1` en long long (sin dividir ni perder
 * precisión, y sin desbordar un int). Se mete cada objeto entero mientras quepa y del primero que no cabe se toma la fracción que llena
 * la mochila. Argumento de intercambio: si una solución óptima lleva peso de un objeto de peor razón habiendo hueco para uno de mejor
 * razón, intercambiar esos kilos no baja el valor, así que se puede suponer que se llena por orden de razón. Con objetos indivisibles
 * (mochila 0/1) esto falla y hay que usar programación dinámica.
 * @alternativas Quickselect por la razón mediana en O(n): el mismo resultado sin ordenar entero.
 * @bigo nlogn
 */
double mochilaFraccionaria(const vector<pair<int, int>>& objetos, int cap)
{
    if (cap < 0) {
        throw invalid_argument("mochilaFraccionaria: la capacidad no puede ser negativa");
    }
    vector<pair<int, int>> orden(objetos);
    for (const auto& [peso, valor] : orden) {
        if (peso <= 0) {
            throw invalid_argument("mochilaFraccionaria: los pesos deben ser positivos");
        }
    }
    sort(orden.begin(), orden.end(), [](const pair<int, int>& a, const pair<int, int>& b) {
        return static_cast<long long>(a.second) * b.first > static_cast<long long>(b.second) * a.first;
    });
    double total = 0.0;
    long long libre = cap;
    for (const auto& [peso, valor] : orden) {
        if (libre <= 0) {
            break;
        }
        if (peso <= libre) {
            total += valor;
            libre -= peso;
        } else {
            total += static_cast<double>(valor) * static_cast<double>(libre) / peso;
            libre = 0;
        }
    }
    return total;
}

/**
 * Coste de un código de Huffman.
 *
 * @complejidad Tiempo O(n log n): n-1 fusiones con operaciones O(log n) en el heap; espacio O(n).
 * @explicacion Cada fusión de dos nodos de pesos a y b hace bajar un nivel (un bit más) a todos los símbolos que cuelgan de ellos, así
 * que añade a + b al coste total; el coste es la suma de los pesos de todas las fusiones, sin construir el árbol. El voraz funde
 * siempre las dos frecuencias menores con un min-heap (`greater<>`). Argumento de intercambio: los dos símbolos menos frecuentes pueden
 * ser hermanos en el nivel más profundo de un árbol óptimo; si no lo son, intercambiarlos con los que están ahí no sube el coste. Los
 * pesos se guardan en long long porque una fusión de frecuencias grandes ya no cabe en un int.
 * @alternativas Con las frecuencias ya ordenadas se resuelve en O(n) con dos colas (originales y fusionadas), que salen ordenadas solas.
 * @bigo nlogn
 */
long long costeHuffman(const vector<int>& frecuencias)
{
    priority_queue<long long, vector<long long>, greater<long long>> heap;
    for (int f : frecuencias) {
        if (f < 0) {
            throw invalid_argument("costeHuffman: las frecuencias no pueden ser negativas");
        }
        heap.push(f);
    }
    long long coste = 0;
    while (heap.size() >= 2) {
        long long a = heap.top();
        heap.pop();
        long long b = heap.top();
        heap.pop();
        coste += a + b;
        heap.push(a + b);
    }
    return coste;
}

/**
 * Planificación con plazos y beneficios.
 *
 * @complejidad Tiempo O(n log n) por la ordenación y el heap; espacio O(n).
 * @explicacion Se procesan los trabajos por plazo creciente y se guardan los beneficios aceptados en un min-heap. Tras añadir uno, si
 * hay más aceptados que horas hasta su plazo (no caben en 1..plazo), se expulsa el de menor beneficio. Invariante: tras procesar los
 * plazos ≤ d, el heap contiene el mejor conjunto factible que usa solo las horas 1..d. Es el argumento de intercambio: si falta un
 * trabajo más rentable que uno incluido, sustituirlo mantiene la factibilidad y no baja el total. Un plazo ≤ 0 se mete y se expulsa
 * enseguida (no puede cumplirse). El total se acumula en long long.
 * @alternativas Ordenar por beneficio decreciente y colocar cada trabajo en el último hueco libre ≤ plazo, con unión-búsqueda para
 * encontrar el hueco: O(n log n) también, con más código.
 * @bigo nlogn
 */
long long planificarConPlazos(const vector<pair<int, int>>& trabajos)
{
    vector<pair<int, int>> orden(trabajos);
    for (const auto& [plazo, beneficio] : orden) {
        if (beneficio < 0) {
            throw invalid_argument("planificarConPlazos: los beneficios no pueden ser negativos");
        }
    }
    sort(orden.begin(), orden.end());
    priority_queue<int, vector<int>, greater<int>> aceptados;
    for (const auto& [plazo, beneficio] : orden) {
        aceptados.push(beneficio);
        if (static_cast<long long>(aceptados.size()) > plazo) {
            aceptados.pop();
        }
    }
    long long total = 0;
    while (!aceptados.empty()) {
        total += aceptados.top();
        aceptados.pop();
    }
    return total;
}

/**
 * Primer contraejemplo del voraz de monedas.
 *
 * @complejidad Tiempo O(M · k) con M ≤ 2 · (moneda mayor) y k monedas; espacio O(M).
 * @explicacion Por el teorema de Kozen y Zaks, si el sistema no es canónico su menor contraejemplo es menor que c[k-2] + c[k-1] (las dos
 * monedas mayores), así que basta probar las cantidades 1..tope. Una tabla de programación dinámica d[x] = 1 + min(d[x - m]) da el óptimo
 * de todas a la vez; el voraz de cada cantidad sale con divisiones, como en `cambioVoraz`. La primera cantidad donde voraz > óptimo es
 * el contraejemplo; si no hay ninguna, el sistema es canónico. Se exige la moneda 1 para que toda cantidad se pueda pagar.
 * @alternativas Existe un algoritmo O(k³) que comprueba un número pequeño de cantidades candidatas, sin tabla.
 */
int primerContraejemplo(const vector<int>& monedas)
{
    if (find(monedas.begin(), monedas.end(), 1) == monedas.end()) {
        throw invalid_argument("primerContraejemplo: el sistema debe tener la moneda 1");
    }
    vector<int> orden(monedas);
    sort(orden.begin(), orden.end(), greater<int>());
    if (orden.size() < 3) {
        return -1;                            // {1} y {1, c} siempre son canónicos
    }
    int tope = orden[0] + orden[1];
    vector<int> optimo(static_cast<size_t>(tope) + 1, 0);
    for (int x = 1; x <= tope; x++) {
        int mejor = x;                        // x monedas de valor 1 siempre sirven
        for (int m : orden) {
            if (m <= x) {
                mejor = min(mejor, optimo[static_cast<size_t>(x - m)] + 1);
            }
        }
        optimo[static_cast<size_t>(x)] = mejor;
        int resto = x;
        int voraz = 0;
        for (int m : orden) {
            voraz += resto / m;
            resto %= m;
        }
        if (voraz > mejor) {
            return x;
        }
    }
    return -1;
}
