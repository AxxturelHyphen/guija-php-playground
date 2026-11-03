<?php
declare(strict_types=1);

/*
 * TEMA 5 · ORDENACIÓN
 * ────────────────────────────────────────────────────────────────────────────
 * Ordenar es el problema "de laboratorio" de los algoritmos: hay muchas soluciones y
 * cada una enseña una idea. En la vida real casi siempre usarás sort()/usort() de PHP
 * (que son rápidos y están en C), pero entender los algoritmos te enseña a razonar
 * sobre coste, estabilidad y memoria.
 *
 *   Algoritmo        Mejor      Medio       Peor        Memoria   Estable
 *   burbuja          O(n)       O(n²)       O(n²)       O(1)      sí
 *   inserción        O(n)       O(n²)       O(n²)       O(1)      sí
 *   merge sort       O(n log n) O(n log n)  O(n log n)  O(n)      sí
 *   quick sort       O(n log n) O(n log n)  O(n²)       O(log n)  no (típico)
 *   counting sort    O(n + k)   O(n + k)    O(n + k)    O(k)      sí (con cuidado)
 *
 * "Estable" = los elementos que empatan conservan el orden que tenían. Importa cuando
 * ordenas por un criterio y luego por otro.
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
// 1. LA FAMILIA sort() DE PHP
// ════════════════════════════════════════════════════════════════════════════
// Ordenan IN SITU (modifican el array que les pasas) y devuelven true: nunca hagas
// `$ordenado = sort($a)`. Para obtener una copia ordenada: `$copia = $a; sort($copia);`
// (o `$copia = $a` y ordenar la copia: PHP no copia hasta que modifica).
//
//   sort / rsort      valores, de menor a mayor / al revés. REINDEXAN.
//   asort / arsort    valores, CONSERVANDO las claves.
//   ksort / krsort    por clave.
//   usort / uasort / uksort   con tu comparador (reindexa / conserva claves / por clave).
titulo('1. La familia sort()');

$numeros = [10, 9, 2, 33, 1];
$copia = $numeros;
sort($copia);
echo 'original: ', ver($numeros), ' · ordenado: ', ver($copia), "\n";

$edades = ['ana' => 30, 'luis' => 25, 'eva' => 41];
asort($edades);
echo 'asort conserva claves: ', ver($edades), "\n";
arsort($edades);
echo 'arsort: ', ver($edades), "\n";
ksort($edades);
echo 'ksort: ', ver($edades), "\n";

// El comparador devuelve negativo, cero o positivo. El operador <=> ("nave espacial") lo da hecho.
$palabras = ['kiwi', 'fresa', 'pera', 'uva'];
usort($palabras, fn(string $a, string $b): int => strlen($a) <=> strlen($b) ?: strcmp($a, $b));
echo 'por longitud y luego alfabético: ', ver($palabras), "\n";

// Trampa: comparar texto y números. Por defecto PHP compara "inteligentemente"...
$mezcla = ['10', '9', '2', '1'];
sort($mezcla);                                    // números en texto: los compara como números
echo 'como números: ', ver($mezcla), "\n";
sort($mezcla, SORT_STRING);                       // pero a veces quieres comparar como texto
echo 'como texto: ', ver($mezcla), "\n";
$archivos = ['img12.png', 'img10.png', 'IMG2.png', 'img1.png'];
sort($archivos, SORT_NATURAL | SORT_FLAG_CASE);   // orden "natural": img1, IMG2, img10, img12
echo 'orden natural: ', ver($archivos), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 2. ESTABILIDAD
// ════════════════════════════════════════════════════════════════════════════
// Desde PHP 8.0 sort/usort son estables. Ordenar por edad deja a los empatados en su orden de entrada.
titulo('2. Estabilidad');

$gente = [['Ana', 30], ['Luis', 25], ['Eva', 30], ['Pau', 25]];
usort($gente, fn(array $a, array $b): int => $a[1] <=> $b[1]);
echo ver($gente), "   ← Luis antes que Pau, Ana antes que Eva (como entraron)\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. VER A LA BURBUJA TRABAJAR
// ════════════════════════════════════════════════════════════════════════════
// La burbuja compara vecinos y los intercambia; en cada pasada, el mayor "sube" al final.
titulo('3. Una burbuja paso a paso');

function burbujaConTraza(array $xs): array
{
    $n = count($xs);
    $comparaciones = 0;
    for ($pasada = 1; $pasada < $n; $pasada++) {
        $cambio = false;
        for ($i = 0; $i < $n - $pasada; $i++) {
            $comparaciones++;
            if ($xs[$i] > $xs[$i + 1]) {
                [$xs[$i], $xs[$i + 1]] = [$xs[$i + 1], $xs[$i]];      // intercambio sin variable temporal
                $cambio = true;
            }
        }
        echo "pasada {$pasada}: ", ver($xs), "\n";
        if (!$cambio) {                                                 // optimización: ya está ordenado
            break;
        }
    }
    echo "comparaciones: {$comparaciones}\n";
    return $xs;
}
burbujaConTraza([5, 1, 4, 2, 8]);

// ════════════════════════════════════════════════════════════════════════════
// 4. CUÁNTO CRECE EL TRABAJO
// ════════════════════════════════════════════════════════════════════════════
// Contamos las comparaciones que hace el sort() nativo de PHP (O(n log n)) frente a lo que haría un
// algoritmo O(n²): al multiplicar n por 10, n log n se multiplica por ~13 y n² por 100.
titulo('4. n log n frente a n²');

function aleatorios(int $n, int $max = 1000, int $semilla = 12345): array
{
    $resultado = [];
    $x = $semilla;
    for ($i = 0; $i < $n; $i++) {
        $x = ($x * 1103515245 + 12345) & 0x7fffffff;      // generador congruencial: mismos datos en cada ejecución
        $resultado[] = $x % ($max + 1);
    }
    return $resultado;
}

foreach ([100, 1000, 10000] as $n) {
    $datos = aleatorios($n, 1_000_000);
    $comparaciones = 0;
    usort($datos, function (int $a, int $b) use (&$comparaciones): int {
        $comparaciones++;
        return $a <=> $b;
    });
    printf("n = %6s   sort() hizo %9s comparaciones   (un O(n²) haría ~%s)\n", number_format($n, 0, ',', '.'), number_format($comparaciones, 0, ',', '.'), number_format($n * $n / 2, 0, ',', '.'));
}

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════
// Todos reciben una lista y DEVUELVEN otra ordenada de menor a mayor, sin modificar la original.
// No uses sort()/usort(): el objetivo es escribir el algoritmo (en ordenarPersonas y
// ordenarPorFrecuencia, sí).

// ── Ejercicio 1 · burbuja ───────────────────────────────────────────────────
/**
 * Ordenación de la burbuja con parada anticipada: si en una pasada completa no se intercambia nada,
 * la lista ya está ordenada y se termina (así una lista ordenada cuesta O(n) y no O(n²)).
 *
 * @param list<int> $xs
 * @return list<int>
 */
function burbuja(array $xs): array
{
    pendiente();
}

// ── Ejercicio 2 · insercion ─────────────────────────────────────────────────
/**
 * Ordenación por inserción: mantén una parte izquierda ya ordenada y va insertando cada nuevo elemento en su sitio,
 * desplazando los mayores una posición a la derecha. Es la que usan las librerías para listas pequeñas.
 *
 * @param list<int> $xs
 * @return list<int>
 */
function insercion(array $xs): array
{
    pendiente();
}

// ── Ejercicio 3 · mergeSort ─────────────────────────────────────────────────
/**
 * Merge sort (divide y vencerás): parte la lista por la mitad, ordena cada mitad y mézclalas.
 * Debe ser ESTABLE y aceptar un comparador opcional (`fn($a, $b): int`, como el de usort).
 * Sin comparador, ordena de menor a mayor con <=>.
 *
 * @param list<mixed> $xs
 * @return list<mixed>
 */
function mergeSort(array $xs, ?callable $comparar = null): array
{
    pendiente();
}

// ── Ejercicio 4 · quickSort ─────────────────────────────────────────────────
/**
 * Quick sort: elige un pivote (el elemento central), reparte el resto en menores, iguales y mayores,
 * y ordena recursivamente menores y mayores. Con "iguales" aparte, las listas con muchos repetidos no se degradan.
 *
 * @param list<int> $xs
 * @return list<int>
 */
function quickSort(array $xs): array
{
    pendiente();
}

// ── Ejercicio 5 · countingSort ──────────────────────────────────────────────
/**
 * Ordenación por conteo para enteros en el rango 0..$max: cuenta cuántas veces aparece cada valor y reconstruye
 * la lista. No compara elementos, así que se salta el límite O(n log n): cuesta O(n + max).
 * Un valor fuera de 0..$max lanza InvalidArgumentException.
 *
 * @param list<int> $xs
 * @return list<int>
 */
function countingSort(array $xs, int $max): array
{
    pendiente();
}

// ── Ejercicio 6 · ordenarPersonas ───────────────────────────────────────────
/**
 * Ordena personas por varios criterios a la vez: apellido ascendente, luego edad DESCENDENTE, luego nombre
 * ascendente. Cada persona es ['nombre' => ..., 'apellido' => ..., 'edad' => ...]. Aquí SÍ puedes usar usort
 * con el operador <=> (truco: comparar arrays compara elemento a elemento).
 *
 * @param list<array{nombre: string, apellido: string, edad: int}> $personas
 * @return list<array{nombre: string, apellido: string, edad: int}>
 */
function ordenarPersonas(array $personas): array
{
    pendiente();
}

// ── Ejercicio 7 · ordenarPorFrecuencia ──────────────────────────────────────
/**
 * Ordena una lista de enteros por frecuencia (los que más se repiten, primero) y, a igual frecuencia,
 * por valor ascendente. Los elementos se repiten en el resultado tantas veces como aparecían.
 *   [4, 6, 2, 6, 4, 4, 6]  →  [4, 4, 4, 6, 6, 6, 2]
 *
 * @param list<int> $xs
 * @return list<int>
 */
function ordenarPorFrecuencia(array $xs): array
{
    pendiente();
}

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

$casos = static function (): array {
    return [
        'vacía' => [[[]], []],
        'un elemento' => [[[7]], [7]],
        'ya ordenada' => [[[1, 2, 3, 4, 5]], [1, 2, 3, 4, 5]],
        'inversa' => [[[5, 4, 3, 2, 1]], [1, 2, 3, 4, 5]],
        'con repetidos' => [[[3, 1, 3, 2, 1, 3]], [1, 1, 2, 3, 3, 3]],
        'negativos' => [[[0, -5, 3, -1, 2]], [-5, -1, 0, 2, 3]],
        'todos iguales' => [[[4, 4, 4, 4]], [4, 4, 4, 4]],
        'dos elementos' => [[[2, 1]], [1, 2]],
    ];
};

foreach (['burbuja', 'insercion', 'mergeSort', 'quickSort'] as $nombre) {
    prueba($nombre, $casos());
    grupo($nombre . '()');
    comprueba('500 números aleatorios', function () use ($nombre) {
        $datos = aleatorios(500, 100000);
        $esperado = $datos;
        sort($esperado);
        return $nombre($datos) === $esperado;
    }, true);
    comprueba('no modifica la lista original', function () use ($nombre) {
        $datos = [3, 1, 2];
        $nombre($datos);
        return $datos;
    }, [3, 1, 2]);
}

grupo('mergeSort()');
comprueba('es estable', fn() => mergeSort([['a', 1], ['b', 0], ['c', 1], ['d', 0]], fn(array $x, array $y): int => $x[1] <=> $y[1]), [['b', 0], ['d', 0], ['a', 1], ['c', 1]]);
comprueba('acepta un comparador (descendente)', fn() => mergeSort([1, 3, 2], fn(int $a, int $b): int => $b <=> $a), [3, 2, 1]);
comprueba('ordena textos', fn() => mergeSort(['pera', 'uva', 'fresa']), ['fresa', 'pera', 'uva']);

prueba('countingSort', [
    'básica' => [[[3, 1, 2, 1, 0], 3], [0, 1, 1, 2, 3]],
    'vacía' => [[[], 5], []],
    'repetidos' => [[[2, 2, 2], 2], [2, 2, 2]],
    'rango mayor que los datos' => [[[5, 1], 100], [1, 5]],
]);
grupo('countingSort()');
lanza('valor fuera de rango', fn() => countingSort([1, 9], 5), InvalidArgumentException::class);
lanza('negativo', fn() => countingSort([-1, 2], 5), InvalidArgumentException::class);
comprueba('1000 números en 0..50', function () {
    $datos = aleatorios(1000, 50);
    $esperado = $datos;
    sort($esperado);
    return countingSort($datos, 50) === $esperado;
}, true);

prueba('ordenarPersonas', [
    'por apellido' => [[[
        ['nombre' => 'Luis', 'apellido' => 'Pérez', 'edad' => 25],
        ['nombre' => 'Ana', 'apellido' => 'García', 'edad' => 30],
    ]], [
        ['nombre' => 'Ana', 'apellido' => 'García', 'edad' => 30],
        ['nombre' => 'Luis', 'apellido' => 'Pérez', 'edad' => 25],
    ]],
    'mismo apellido: edad descendente' => [[[
        ['nombre' => 'Ana', 'apellido' => 'Ruiz', 'edad' => 20],
        ['nombre' => 'Eva', 'apellido' => 'Ruiz', 'edad' => 40],
    ]], [
        ['nombre' => 'Eva', 'apellido' => 'Ruiz', 'edad' => 40],
        ['nombre' => 'Ana', 'apellido' => 'Ruiz', 'edad' => 20],
    ]],
    'mismo apellido y edad: nombre ascendente' => [[[
        ['nombre' => 'Zoe', 'apellido' => 'Ruiz', 'edad' => 30],
        ['nombre' => 'Ana', 'apellido' => 'Ruiz', 'edad' => 30],
    ]], [
        ['nombre' => 'Ana', 'apellido' => 'Ruiz', 'edad' => 30],
        ['nombre' => 'Zoe', 'apellido' => 'Ruiz', 'edad' => 30],
    ]],
    'vacía' => [[[]], []],
]);

prueba('ordenarPorFrecuencia', [
    'ejemplo' => [[[4, 6, 2, 6, 4, 4, 6]], [4, 4, 4, 6, 6, 6, 2]],
    'sin repetidos: por valor' => [[[3, 1, 2]], [1, 2, 3]],
    'un valor domina' => [[[1, 2, 2, 3, 2]], [2, 2, 2, 1, 3]],
    'vacía' => [[[]], []],
    'negativos' => [[[-1, 5, -1, 5, 0]], [-1, -1, 5, 5, 0]],
]);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
// Verás O(n²) para burbuja e inserción y O(n log n) para merge y quick sort. Los datos son pseudoaleatorios
// pero siempre los mismos, para que las mediciones sean comparables.
foreach (['burbuja', 'insercion', 'mergeSort', 'quickSort'] as $nombre) {
    medir($nombre, fn(int $n): array => [aleatorios($n, 1_000_000)]);
}
medir('countingSort', fn(int $n): array => [aleatorios($n, 1000), 1000]);
