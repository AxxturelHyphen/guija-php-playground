<?php
declare(strict_types=1);

/*
 * TEMA 8 · GRAFOS Y PROGRAMACIÓN DINÁMICA
 * ────────────────────────────────────────────────────────────────────────────
 * GRAFOS: nodos unidos por aristas. Mapas, redes sociales, dependencias entre paquetes (¡Composer!), rutas...
 *
 * Se representan casi siempre con una LISTA DE ADYACENCIA: un array que a cada nodo le asocia sus vecinos.
 *      ['A' => ['B', 'C'], 'B' => ['D'], 'C' => ['D'], 'D' => []]
 * (en Java sería un Map<String, List<String>>). Si las aristas tienen peso: ['A' => ['B' => 4, 'C' => 1]].
 *
 *   Algoritmo           Estructura           Para qué sirve                          Coste (V nodos, E aristas)
 *   BFS (anchura)       cola                 camino con MENOS aristas, niveles       O(V + E)
 *   DFS (profundidad)   pila / recursión     componentes, ciclos, islas, orden       O(V + E)
 *   Orden topológico    cola + grados        ordenar tareas con dependencias         O(V + E)
 *   Dijkstra            cola de prioridad    camino de MENOR PESO (pesos ≥ 0)        O((V + E) log V)
 *
 * PROGRAMACIÓN DINÁMICA (DP): cuando un problema se descompone en subproblemas que SE REPITEN, se resuelve cada
 * uno una sola vez y se guarda su resultado. Dos formas equivalentes:
 *   - de arriba abajo: recursión + memoización (lo del tema 4).
 *   - de abajo arriba ("tabulación"): rellenar una tabla desde los casos pequeños. Suele ser más rápida y no
 *     agota la pila de llamadas.
 * Receta: (1) define QUÉ significa cada celda de la tabla, (2) escribe cómo se calcula a partir de las anteriores,
 * (3) fija los casos base, (4) decide en qué orden rellenarla.
 */

function titulo(string $texto): void
{
    echo "\n=== {$texto} ===\n";
}

function ver(mixed $valor): string
{
    return (string) json_encode($valor, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. RECORRER UN GRAFO: ANCHURA (BFS) Y PROFUNDIDAD (DFS)
// ════════════════════════════════════════════════════════════════════════════
titulo('1. BFS y DFS');

$ciudades = [
    'Madrid' => ['Toledo', 'Zaragoza', 'Valencia'],
    'Toledo' => ['Madrid', 'Sevilla'],
    'Zaragoza' => ['Madrid', 'Barcelona'],
    'Valencia' => ['Madrid', 'Barcelona'],
    'Sevilla' => ['Toledo'],
    'Barcelona' => ['Zaragoza', 'Valencia'],
];

/** BFS: visita por "capas": primero los vecinos, luego los vecinos de los vecinos... */
function recorridoAnchura(array $grafo, string $inicio): array
{
    $visitados = [$inicio => true];
    $cola = [$inicio];
    $orden = [];
    for ($i = 0; $i < count($cola); $i++) {            // índice en vez de array_shift (que es O(n))
        $nodo = $cola[$i];
        $orden[] = $nodo;
        foreach ($grafo[$nodo] ?? [] as $vecino) {
            if (!isset($visitados[$vecino])) {         // marcar al ENCOLAR evita meterlo dos veces
                $visitados[$vecino] = true;
                $cola[] = $vecino;
            }
        }
    }
    return $orden;
}

/** DFS: se mete todo lo que se pueda por un camino antes de probar otro. */
function recorridoProfundidad(array $grafo, string $nodo, array &$visitados = []): array
{
    $visitados[$nodo] = true;
    $orden = [$nodo];
    foreach ($grafo[$nodo] ?? [] as $vecino) {
        if (!isset($visitados[$vecino])) {
            array_push($orden, ...recorridoProfundidad($grafo, $vecino, $visitados));
        }
    }
    return $orden;
}

echo 'BFS desde Madrid: ', implode(' → ', recorridoAnchura($ciudades, 'Madrid')), "\n";
echo 'DFS desde Madrid: ', implode(' → ', recorridoProfundidad($ciudades, 'Madrid')), "\n";
// Sin el array de "visitados" un grafo con ciclos (Madrid ↔ Toledo) se recorrería PARA SIEMPRE.

// ════════════════════════════════════════════════════════════════════════════
// 2. POR QUÉ LA PD: FIBONACCI DE TRES FORMAS
// ════════════════════════════════════════════════════════════════════════════
titulo('2. Memoización y tabulación');

function fibIngenuo(int $n, int &$llamadas): int
{
    $llamadas++;
    return $n < 2 ? $n : fibIngenuo($n - 1, $llamadas) + fibIngenuo($n - 2, $llamadas);
}

function fibMemo(int $n, array &$memo, int &$llamadas): int
{
    $llamadas++;
    if ($n < 2) {
        return $n;
    }
    return $memo[$n] ??= fibMemo($n - 1, $memo, $llamadas) + fibMemo($n - 2, $memo, $llamadas);
}

function fibTabla(int $n): int
{
    $tabla = [0, 1];
    for ($i = 2; $i <= $n; $i++) {
        $tabla[$i] = $tabla[$i - 1] + $tabla[$i - 2];      // cada celda depende solo de las dos anteriores
    }
    return $tabla[$n];
}

$llamadas = 0;
$resultado = fibIngenuo(22, $llamadas);
echo "ingenuo  fib(22) = {$resultado} con {$llamadas} llamadas\n";
$llamadas = 0;
$memo = [];
$resultado = fibMemo(22, $memo, $llamadas);
echo "memo     fib(22) = {$resultado} con {$llamadas} llamadas\n";
echo 'tabla    fib(22) = ', fibTabla(22), " con un solo bucle\n";
// Como la tabla solo mira las dos últimas celdas, se puede guardar solo ESAS (espacio O(1)): lo harás en `escaleras`.

// ════════════════════════════════════════════════════════════════════════════
// 3. PD EN UNA TABLA: CAMINOS EN UNA CUADRÍCULA
// ════════════════════════════════════════════════════════════════════════════
// ¿De cuántas formas se llega a la esquina inferior derecha moviéndose solo a la derecha o hacia abajo?
//  celda(f, c) = celda(f-1, c) + celda(f, c-1)        (se llega desde arriba o desde la izquierda)
titulo('3. Caminos en una cuadrícula');

function caminosEnCuadricula(int $filas, int $columnas): int
{
    $tabla = array_fill(0, $filas, array_fill(0, $columnas, 1));   // primera fila y columna: solo 1 camino
    for ($f = 1; $f < $filas; $f++) {
        for ($c = 1; $c < $columnas; $c++) {
            $tabla[$f][$c] = $tabla[$f - 1][$c] + $tabla[$f][$c - 1];
        }
    }
    return $tabla[$filas - 1][$columnas - 1];
}

echo 'caminos en 3×3: ', caminosEnCuadricula(3, 3), ' · en 10×10: ', caminosEnCuadricula(10, 10), "\n";

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS · GRAFOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · construirGrafo ────────────────────────────────────────────
/**
 * Construye la lista de adyacencia a partir de una lista de aristas [origen, destino].
 *  - No dirigido (por defecto): cada arista cuenta en los dos sentidos.
 *  - Dirigido ($dirigido = true): solo origen → destino, pero el destino TAMBIÉN aparece como nodo (con []).
 * Los nodos salen en el orden en que aparecen por primera vez, y los vecinos en el orden de las aristas.
 *   construirGrafo([['A','B'],['A','C']])  →  ['A' => ['B','C'], 'B' => ['A'], 'C' => ['A']]
 */
function construirGrafo(array $aristas, bool $dirigido = false): array
{
    pendiente();
}

// ── Ejercicio 2 · bfsCaminoMasCorto ─────────────────────────────────────────
/**
 * Camino con MENOS aristas entre dos nodos de una lista de adyacencia, como lista de nodos
 * (incluidos origen y destino), o null si no hay camino. Si origen === destino devuelve [origen].
 * Ante varios caminos igual de cortos vale el que se descubre antes (según el orden de los vecinos).
 * Pista: BFS guardando de qué nodo vienes (`$padre[$vecino] = $nodo`) y reconstruye el camino hacia atrás.
 *
 * @param array<string, list<string>> $grafo
 * @return list<string>|null
 */
function bfsCaminoMasCorto(array $grafo, string $origen, string $destino): ?array
{
    pendiente();
}

// ── Ejercicio 3 · contarIslas ───────────────────────────────────────────────
/**
 * Cuenta las "islas" de un mapa: grupos de '1' (tierra) conectados en horizontal o vertical (NO en diagonal),
 * rodeados de '0' (agua). El mapa es una lista de filas de texto.
 *   ['11000', '11000', '00100', '00011']  →  3
 * Pista: recorre las celdas; al encontrar tierra sin visitar, suma 1 y "hunde" toda su isla con DFS/BFS
 * (con una pila explícita para que no se desborde con mapas grandes).
 *
 * @param list<string> $mapa
 */
function contarIslas(array $mapa): int
{
    pendiente();
}

// ── Ejercicio 4 · ordenTopologico ───────────────────────────────────────────
/**
 * Ordena tareas con dependencias de modo que cada tarea aparezca DESPUÉS de todas aquellas de las que depende.
 * Es lo que hace Composer al instalar paquetes. Entrada: ['tarea' => ['dependencia1', ...]]; una dependencia
 * puede no aparecer como clave (es una tarea sin dependencias). Devuelve todas las tareas.
 * Si hay un ciclo (a necesita b y b necesita a) lanza RuntimeException.
 * Algoritmo de Kahn: cuenta cuántas dependencias pendientes tiene cada tarea; saca las que tienen 0 y, al sacarlas,
 * descuenta una a las tareas que dependían de ellas. Si al acabar quedan tareas sin sacar, había un ciclo. O(V + E).
 *
 * @param array<string, list<string>> $dependencias
 * @return list<string>
 */
function ordenTopologico(array $dependencias): array
{
    pendiente();
}

// ── Ejercicio 5 · dijkstra ──────────────────────────────────────────────────
/**
 * Distancia mínima desde un origen a todos los nodos ALCANZABLES de un grafo con pesos:
 * ['A' => ['B' => 4, 'C' => 1], ...]. Devuelve [nodo => distancia] ordenado por nodo (ksort); los
 * inalcanzables no aparecen. Un peso negativo lanza InvalidArgumentException (Dijkstra no lo soporta).
 * Usa SplPriorityQueue (saca la MAYOR prioridad, así que inserta con prioridad = -distancia) y descarta las
 * entradas "viejas" (si sacas un nodo con una distancia peor que la ya conocida, sáltalo). O((V + E) log V).
 *
 * @param array<string, array<string, int>> $grafo
 * @return array<string, int>
 */
function dijkstra(array $grafo, string $origen): array
{
    pendiente();
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS · PROGRAMACIÓN DINÁMICA
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 6 · escaleras ─────────────────────────────────────────────────
/**
 * ¿De cuántas formas se sube una escalera de $n peldaños dando pasos de 1 o 2? (escaleras(0) = 1, escaleras(1) = 1,
 * escaleras(2) = 2, escaleras(3) = 3, escaleras(5) = 8...). Valores negativos → InvalidArgumentException.
 * Es Fibonacci disfrazado: pasos(n) = pasos(n-1) + pasos(n-2). Hazlo en O(n) de tiempo y O(1) de espacio
 * guardando solo las dos últimas celdas.
 */
function escaleras(int $n): int
{
    pendiente();
}

// ── Ejercicio 7 · cambioMonedas ─────────────────────────────────────────────
/**
 * Menor número de monedas que suman exactamente $objetivo, o -1 si es imposible. Cada moneda se puede usar
 * todas las veces que haga falta. Una cantidad negativa → InvalidArgumentException.
 * ¡El algoritmo voraz (coger siempre la moneda mayor) FALLA! Con [1, 3, 4] y 6 daría 4+1+1 (3 monedas) y lo mejor
 * es 3+3 (2). Tabla: `minimo[c]` = monedas necesarias para sumar c; minimo[0] = 0;
 * minimo[c] = 1 + min(minimo[c - moneda]) para cada moneda ≤ c. O(objetivo · monedas).
 *
 * @param list<int> $monedas
 */
function cambioMonedas(array $monedas, int $objetivo): int
{
    pendiente();
}

// ── Ejercicio 8 · mochila 0/1 ───────────────────────────────────────────────
/**
 * Mochila 0/1: cada objeto tiene un peso y un valor y se coge entero o no se coge. Devuelve el mayor valor
 * posible sin pasar de la capacidad. Listas de distinta longitud → InvalidArgumentException.
 * Tabla de una dimensión: `mejor[w]` = mayor valor con capacidad w. Para cada objeto recorre w de MAYOR a menor
 * (si fuera de menor a mayor, usarías el mismo objeto varias veces): mejor[w] = max(mejor[w], mejor[w - peso] + valor).
 * O(objetos · capacidad).
 *
 * @param list<int> $pesos
 * @param list<int> $valores
 */
function mochila(array $pesos, array $valores, int $capacidad): int
{
    pendiente();
}

// ── Ejercicio 9 · lcs (subsecuencia común más larga) ────────────────────────
/**
 * Longitud de la subsecuencia común más larga de dos textos (los caracteres no tienen por qué ser contiguos, pero
 * sí mantener el orden). "ABCBDAB" y "BDCABA" → 4 ("BCBA"). Tabla de (n+1)×(m+1): si los caracteres coinciden,
 * tabla[i][j] = tabla[i-1][j-1] + 1; si no, max(tabla[i-1][j], tabla[i][j-1]). Es el núcleo del comando `diff`.
 * O(n·m) de tiempo; como cada fila solo mira la anterior, basta con DOS filas (espacio O(m)).
 */
function lcs(string $a, string $b): int
{
    pendiente();
}

// ── Ejercicio 10 · distanciaEdicion ─────────────────────────────────────────
/**
 * Distancia de Levenshtein: mínimo de inserciones, borrados y sustituciones de un carácter para convertir $a en $b.
 * "kitten" → "sitting" = 3. Se comparará con la función nativa levenshtein() de PHP.
 * tabla[i][j] = distancia entre los i primeros caracteres de $a y los j primeros de $b;
 * tabla[i][0] = i; tabla[0][j] = j; y si coinciden: tabla[i-1][j-1], si no: 1 + min(borrar, insertar, sustituir).
 */
function distanciaEdicion(string $a, string $b): int
{
    pendiente();
}

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

prueba('construirGrafo', [
    'no dirigido' => [[[['A', 'B'], ['A', 'C']]], ['A' => ['B', 'C'], 'B' => ['A'], 'C' => ['A']]],
    'dirigido' => [[[['A', 'B'], ['A', 'C']], true], ['A' => ['B', 'C'], 'B' => [], 'C' => []]],
    'sin aristas' => [[[]], []],
    'orden de aparición' => [[[['B', 'A']]], ['B' => ['A'], 'A' => ['B']]],
    'cadena dirigida' => [[[['a', 'b'], ['b', 'c']], true], ['a' => ['b'], 'b' => ['c'], 'c' => []]],
    'ciclo no dirigido' => [[[['x', 'y'], ['y', 'z'], ['z', 'x']]], ['x' => ['y', 'z'], 'y' => ['x', 'z'], 'z' => ['y', 'x']]],
]);

$mapaCiudades = ['Madrid' => ['Toledo', 'Zaragoza'], 'Toledo' => ['Madrid', 'Sevilla'], 'Zaragoza' => ['Madrid', 'Barcelona'],
    'Sevilla' => ['Toledo'], 'Barcelona' => ['Zaragoza'], 'Isla' => []];

prueba('bfsCaminoMasCorto', [
    'directo' => [[$mapaCiudades, 'Madrid', 'Toledo'], ['Madrid', 'Toledo']],
    'dos saltos' => [[$mapaCiudades, 'Madrid', 'Sevilla'], ['Madrid', 'Toledo', 'Sevilla']],
    'tres saltos' => [[$mapaCiudades, 'Sevilla', 'Barcelona'], ['Sevilla', 'Toledo', 'Madrid', 'Zaragoza', 'Barcelona']],
    'mismo nodo' => [[$mapaCiudades, 'Madrid', 'Madrid'], ['Madrid']],
    'sin camino' => [[$mapaCiudades, 'Madrid', 'Isla'], null],
    'el origen no existe' => [[$mapaCiudades, 'Narnia', 'Madrid'], null],
    'elige el más corto, no el primero' => [[['A' => ['B', 'D'], 'B' => ['C'], 'C' => ['E'], 'D' => ['E'], 'E' => []], 'A', 'E'], ['A', 'D', 'E']],
    'con ciclos no se cuelga' => [[['A' => ['B'], 'B' => ['A', 'C'], 'C' => ['B']], 'A', 'C'], ['A', 'B', 'C']],
]);

prueba('contarIslas', [
    'ejemplo' => [[['11000', '11000', '00100', '00011']], 3],
    'sin mapa' => [[[]], 0],
    'todo agua' => [[['000', '000']], 0],
    'todo tierra' => [[['111', '111']], 1],
    'diagonales no conectan' => [[['10', '01']], 2],
    'en forma de U' => [[['101', '101', '111']], 1],
    'tablero de ajedrez 3×3' => [[['101', '010', '101']], 5],
    'una fila' => [[['1011011']], 3],
    'una columna' => [[['1', '0', '1', '1']], 2],
    'mapa grande' => [[array_fill(0, 200, str_repeat('1', 200))], 1],
]);

/** ¿Es `$orden` una ordenación topológica válida de `$deps`? (hay varias válidas, por eso no se compara con un array fijo). */
function esOrdenValido(array $deps, array $orden): bool
{
    $nodos = [];
    foreach ($deps as $tarea => $ds) {
        $nodos[$tarea] = true;
        foreach ($ds as $d) {
            $nodos[$d] = true;
        }
    }
    if (count($orden) !== count($nodos) || count(array_unique($orden)) !== count($orden)) {
        return false;
    }
    $posicion = array_flip($orden);
    foreach ($deps as $tarea => $ds) {
        foreach ($ds as $d) {
            if (!isset($posicion[$d], $posicion[$tarea]) || $posicion[$d] >= $posicion[$tarea]) {
                return false;
            }
        }
    }
    return true;
}

grupo('ordenTopologico');
comprueba('cadena', fn() => ordenTopologico(['app' => ['framework'], 'framework' => ['util'], 'util' => []]), ['util', 'framework', 'app']);
comprueba('dependencia que no es clave', fn() => ordenTopologico(['a' => ['b']]), ['b', 'a']);
comprueba('sin tareas', fn() => ordenTopologico([]), []);
comprueba('diamante: orden válido', function () {
    $d = ['app' => ['http', 'db'], 'http' => ['util'], 'db' => ['util'], 'util' => []];
    return esOrdenValido($d, ordenTopologico($d));
}, true);
comprueba('tareas independientes aparecen todas', function () {
    $d = ['x' => [], 'y' => [], 'z' => []];
    return esOrdenValido($d, ordenTopologico($d));
}, true);
comprueba('composer: grafo de paquetes', function () {
    $d = [
        'laravel/framework' => ['symfony/console', 'monolog/monolog', 'psr/log'],
        'symfony/console' => ['psr/log', 'symfony/string'],
        'monolog/monolog' => ['psr/log'],
        'symfony/string' => [],
        'mi/app' => ['laravel/framework', 'monolog/monolog'],
    ];
    return esOrdenValido($d, ordenTopologico($d));
}, true);
comprueba('lista larga sin ciclos', function () {
    $d = [];
    for ($i = 1; $i <= 2000; $i++) {
        $d["t{$i}"] = $i > 1 ? ['t' . intdiv($i, 2)] : [];
    }
    return esOrdenValido($d, ordenTopologico($d));
}, true);
lanza('ciclo de dos', fn() => ordenTopologico(['a' => ['b'], 'b' => ['a']]), RuntimeException::class);
lanza('se necesita a sí misma', fn() => ordenTopologico(['a' => ['a']]), RuntimeException::class);
lanza('ciclo escondido al final', fn() => ordenTopologico(['a' => [], 'b' => ['c'], 'c' => ['d'], 'd' => ['b']]), RuntimeException::class);

$red = ['A' => ['B' => 4, 'C' => 1], 'B' => ['D' => 1], 'C' => ['B' => 2, 'D' => 5], 'D' => [], 'Z' => ['A' => 1]];

prueba('dijkstra', [
    'caso clásico' => [[$red, 'A'], ['A' => 0, 'B' => 3, 'C' => 1, 'D' => 4]],
    'el atajo gana al directo' => [[['A' => ['B' => 10, 'C' => 1], 'C' => ['B' => 1]], 'A'], ['A' => 0, 'B' => 2, 'C' => 1]],
    'solo el origen' => [[['A' => []], 'A'], ['A' => 0]],
    'inalcanzables no aparecen' => [[$red, 'D'], ['D' => 0]],
    'nodo que solo es destino' => [[['A' => ['B' => 2]], 'A'], ['A' => 0, 'B' => 2]],
    'pesos cero' => [[['A' => ['B' => 0], 'B' => ['C' => 0]], 'A'], ['A' => 0, 'B' => 0, 'C' => 0]],
    'desde otro origen' => [[$red, 'Z'], ['A' => 1, 'B' => 4, 'C' => 2, 'D' => 5, 'Z' => 0]],
]);
grupo('dijkstra (casos especiales)');
lanza('peso negativo', fn() => dijkstra(['A' => ['B' => -1]], 'A'), InvalidArgumentException::class);
comprueba('cuadrícula 30×30 de pesos 1: la esquina opuesta está a 58', function () {
    $g = [];
    for ($f = 0; $f < 30; $f++) {
        for ($c = 0; $c < 30; $c++) {
            $g["{$f},{$c}"] = [];
            if ($f + 1 < 30) {
                $g["{$f},{$c}"][($f + 1) . ",{$c}"] = 1;
            }
            if ($c + 1 < 30) {
                $g["{$f},{$c}"]["{$f}," . ($c + 1)] = 1;
            }
        }
    }
    return dijkstra($g, '0,0')['29,29'];
}, 58);

prueba('escaleras', [
    'n = 0' => [[0], 1],
    'n = 1' => [[1], 1],
    'n = 2' => [[2], 2],
    'n = 3' => [[3], 3],
    'n = 5' => [[5], 8],
    'n = 10' => [[10], 89],
    'n = 40' => [[40], 165580141],
    'n = 80 (sin desbordar)' => [[80], 37889062373143906],
]);
lanza('escaleras negativo', fn() => escaleras(-1), InvalidArgumentException::class);

prueba('cambioMonedas', [
    'ejemplo básico' => [[[1, 2, 5], 11], 3],
    'el voraz falla' => [[[1, 3, 4], 6], 2],
    'imposible' => [[[2], 3], -1],
    'objetivo 0' => [[[1, 2], 0], 0],
    'sin monedas' => [[[], 5], -1],
    'una moneda exacta' => [[[7], 7], 1],
    'monedas europeas' => [[[1, 2, 5, 10, 20, 50, 100, 200], 387], 7],
    'moneda mayor que el objetivo' => [[[5, 10], 3], -1],
    'objetivo grande' => [[[1, 5, 10, 25], 9999], 405],
]);
lanza('cambio negativo', fn() => cambioMonedas([1], -1), InvalidArgumentException::class);

prueba('mochila', [
    'clásico' => [[[1, 3, 4, 5], [1, 4, 5, 7], 7], 9],
    'capacidad 0' => [[[1, 2], [10, 20], 0], 0],
    'todo cabe' => [[[1, 2, 3], [6, 10, 12], 10], 28],
    'ningún objeto cabe' => [[[5, 6], [10, 20], 4], 0],
    'no se reutilizan objetos' => [[[2], [3], 10], 3],
    'sin objetos' => [[[], [], 5], 0],
    'elegir bien' => [[[10, 20, 30], [60, 100, 120], 50], 220],
]);
lanza('longitudes distintas', fn() => mochila([1, 2], [3], 5), InvalidArgumentException::class);

prueba('lcs', [
    'clásico' => [['ABCBDAB', 'BDCABA'], 4],
    'iguales' => [['abc', 'abc'], 3],
    'nada en común' => [['abc', 'def'], 0],
    'una vacía' => [['', 'abc'], 0],
    'ambas vacías' => [['', ''], 0],
    'subsecuencia' => [['AGGTAB', 'GXTXAYB'], 4],
    'una dentro de otra' => [['ace', 'abcde'], 3],
    'distinta longitud' => [['a', 'aaaaaaaa'], 1],
]);

grupo('distanciaEdicion');
comprueba('kitten → sitting', fn() => distanciaEdicion('kitten', 'sitting'), 3);
comprueba('horse → ros', fn() => distanciaEdicion('horse', 'ros'), 3);
comprueba('intention → execution', fn() => distanciaEdicion('intention', 'execution'), 5);
comprueba('iguales', fn() => distanciaEdicion('php', 'php'), 0);
comprueba('desde vacío', fn() => distanciaEdicion('', 'abc'), 3);
comprueba('a vacío', fn() => distanciaEdicion('abcd', ''), 4);
comprueba('es simétrica', fn() => distanciaEdicion('sábado', 'domingo') === distanciaEdicion('domingo', 'sábado'), true);
comprueba('coincide con levenshtein() en 200 pares (ASCII)', function () {
    $x = 11;
    $palabra = function (int $largo) use (&$x): string {
        $s = '';
        for ($i = 0; $i < $largo; $i++) {
            $x = ($x * 1103515245 + 12345) & 0x7fffffff;
            $s .= chr(97 + $x % 5);
        }
        return $s;
    };
    for ($i = 0; $i < 200; $i++) {
        $a = $palabra($i % 9);
        $b = $palabra(($i * 7) % 11);
        if (distanciaEdicion($a, $b) !== levenshtein($a, $b)) {
            return "falla con '{$a}' y '{$b}'";
        }
    }
    return 'ok';
}, 'ok');

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
/** Mapa pseudoaleatorio de unas $n celdas (lado = raíz de n). */
function mapaAleatorio(int $n): array
{
    $lado = max(2, intdiv((int) sqrt($n), 1));
    $x = 4242;
    $filas = [];
    for ($f = 0; $f < $lado; $f++) {
        $fila = '';
        for ($c = 0; $c < $lado; $c++) {
            $x = ($x * 1103515245 + 12345) & 0x7fffffff;
            $fila .= ($x >> 8) % 100 < 55 ? '1' : '0';
        }
        $filas[] = $fila;
    }
    return $filas;
}

/** Grafo ponderado de $n nodos: una cadena y un salto "aleatorio" desde cada nodo (unas 2n aristas). */
function grafoPonderado(int $n): array
{
    $g = [];
    for ($i = 0; $i < $n; $i++) {
        $g["n{$i}"] = ["n" . (($i + 1) % $n) => 1 + $i % 5, 'n' . (($i * 7 + 3) % $n) => 2 + $i % 3];
    }
    return $g;
}

function textoAleatorio(int $n, int $semilla): string
{
    $x = $semilla;
    $s = '';
    for ($i = 0; $i < $n; $i++) {
        $x = ($x * 1103515245 + 12345) & 0x7fffffff;
        $s .= chr(97 + ($x >> 8) % 4);
    }
    return $s;
}

medir('contarIslas', fn(int $n): array => [mapaAleatorio($n)]);                          // O(celdas)
medir('dijkstra', fn(int $n): array => [grafoPonderado($n), 'n0']);                      // O((V+E) log V)
medir('escaleras', fn(int $n): array => [$n], 'lineal', range(5, 85, 5));                // O(n)
medir('cambioMonedas', fn(int $n): array => [[1, 5, 10, 25], $n]);                       // O(objetivo · monedas)
medir('mochila', fn(int $n): array => [range(1, 20), range(21, 40), $n]);                // O(objetos · capacidad)
medir('lcs', fn(int $n): array => [textoAleatorio($n, 1), textoAleatorio($n, 2)]);       // O(n²)
medir('distanciaEdicion', fn(int $n): array => [textoAleatorio($n, 3), textoAleatorio($n, 4)]);  // O(n²)
