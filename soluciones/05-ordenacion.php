<?php
declare(strict_types=1);

/*
 * SOLUCIONES · Tema 5 · Ordenación
 */

/**
 * Burbuja con parada anticipada.
 *
 * @complejidad Tiempo O(n²) en el caso medio y peor, O(n) si ya está ordenada; espacio O(1) extra (trabaja sobre la copia).
 * @bigo n2
 * @explicacion En cada pasada se comparan vecinos y el mayor "sube" hasta su sitio, así que tras la pasada k los k
 * últimos ya están fijos (por eso el bucle interior se acorta). Si una pasada completa no intercambia nada, la lista
 * ya está ordenada y se sale: es lo que convierte el mejor caso en O(n). El intercambio con desestructuración
 * `[$a, $b] = [$b, $a]` evita la variable temporal.
 * @alternativas Es de las peores en la práctica: inserción hace menos trabajo con el mismo coste teórico. Lo normal
 * es `sort()` (O(n log n), escrito en C).
 */
function burbuja(array $xs): array
{
    $xs = array_values($xs);
    $n = count($xs);
    for ($pasada = 1; $pasada < $n; $pasada++) {
        $cambio = false;
        for ($i = 0; $i < $n - $pasada; $i++) {
            if ($xs[$i] > $xs[$i + 1]) {
                [$xs[$i], $xs[$i + 1]] = [$xs[$i + 1], $xs[$i]];
                $cambio = true;
            }
        }
        if (!$cambio) {
            break;
        }
    }
    return $xs;
}

/**
 * Ordenación por inserción.
 *
 * @complejidad Tiempo O(n²) medio y peor, O(n) si ya está ordenada; espacio O(1) extra.
 * @bigo n2
 * @explicacion La parte izquierda siempre está ordenada. Cada elemento nuevo se guarda, se desplazan hacia la derecha
 * los mayores que él y se deja caer en el hueco. No hace intercambios (solo desplazamientos), y es muy rápida en
 * listas pequeñas o casi ordenadas: por eso los `sort` de muchos lenguajes la usan para trozos de ~10-20 elementos.
 * @alternativas Con búsqueda binaria para encontrar el hueco se reducen las comparaciones a O(n log n), pero los
 * desplazamientos siguen siendo O(n²). Merge o quick sort para listas grandes.
 */
function insercion(array $xs): array
{
    $xs = array_values($xs);
    for ($i = 1, $n = count($xs); $i < $n; $i++) {
        $actual = $xs[$i];
        $j = $i - 1;
        while ($j >= 0 && $xs[$j] > $actual) {
            $xs[$j + 1] = $xs[$j];
            $j--;
        }
        $xs[$j + 1] = $actual;
    }
    return $xs;
}

/**
 * Merge sort estable con comparador opcional.
 *
 * @complejidad Tiempo O(n log n) siempre; espacio O(n).
 * @bigo nlogn
 * @explicacion Dividir por la mitad da log₂ n niveles y mezclar dos mitades ordenadas cuesta O(n) por nivel. La
 * estabilidad sale de mezclar con `<= 0`: ante un empate se toma el elemento de la IZQUIERDA, que era el que estaba
 * antes. A diferencia de quick sort, su coste no depende de los datos.
 * @alternativas Quick sort: suele ser más rápido en memoria, pero no es estable y su peor caso es O(n²). Timsort
 * (Python, Java para objetos) mezcla merge e inserción aprovechando los trozos ya ordenados.
 */
function mergeSort(array $xs, ?callable $comparar = null): array
{
    $comparar ??= static fn(mixed $a, mixed $b): int => $a <=> $b;
    $xs = array_values($xs);
    $n = count($xs);
    if ($n < 2) {
        return $xs;
    }
    $medio = intdiv($n, 2);
    $izq = mergeSort(array_slice($xs, 0, $medio), $comparar);
    $der = mergeSort(array_slice($xs, $medio), $comparar);

    $resultado = [];
    $i = $j = 0;
    $ni = count($izq);
    $nd = count($der);
    while ($i < $ni && $j < $nd) {
        $resultado[] = $comparar($izq[$i], $der[$j]) <= 0 ? $izq[$i++] : $der[$j++];
    }
    while ($i < $ni) {
        $resultado[] = $izq[$i++];
    }
    while ($j < $nd) {
        $resultado[] = $der[$j++];
    }
    return $resultado;
}

/**
 * Quick sort con pivote central y tres grupos.
 *
 * @complejidad Tiempo O(n log n) medio, O(n²) en el peor caso (muy raro con pivote central); espacio O(n) en esta
 * versión funcional (la in situ usa O(log n)).
 * @bigo nlogn
 * @explicacion El pivote reparte la lista en menores, iguales y mayores; los iguales ya están en su sitio, así que
 * solo se recursa sobre los otros dos. Repartir los iguales aparte evita el clásico problema de las listas con
 * muchos repetidos (que degradaría a O(n²)). Elegir el elemento central hace que las listas ya ordenadas o
 * inversas, que son el peor caso con pivote en un extremo, sean casos buenos.
 * @alternativas La versión in situ con particionado de Hoare/Lomuto no crea listas nuevas. Pivote aleatorio o
 * "mediana de tres" para blindarse contra entradas patológicas. En producción: `sort()`, que es introsort en C.
 */
function quickSort(array $xs): array
{
    $xs = array_values($xs);
    $n = count($xs);
    if ($n < 2) {
        return $xs;
    }
    $pivote = $xs[intdiv($n, 2)];
    $menores = $iguales = $mayores = [];
    foreach ($xs as $x) {
        if ($x < $pivote) {
            $menores[] = $x;
        } elseif ($x > $pivote) {
            $mayores[] = $x;
        } else {
            $iguales[] = $x;
        }
    }
    return [...quickSort($menores), ...$iguales, ...quickSort($mayores)];
}

/**
 * Ordenación por conteo.
 *
 * @complejidad Tiempo O(n + k) con k = max + 1; espacio O(k).
 * @bigo n
 * @explicacion No compara elementos: usa cada valor como índice de una tabla de contadores y después la recorre en
 * orden. Por eso se salta el límite O(n log n) de los algoritmos basados en comparaciones, a cambio de exigir enteros
 * en un rango pequeño. Si k es mucho mayor que n (p. ej. valores de hasta mil millones) deja de compensar.
 * @alternativas Radix sort (ordena dígito a dígito con counting sort, O(d·(n + b))) para rangos grandes; `sort()`
 * si no se conoce el rango.
 */
function countingSort(array $xs, int $max): array
{
    $cuentas = array_fill(0, $max + 1, 0);
    foreach ($xs as $x) {
        if ($x < 0 || $x > $max) {
            throw new InvalidArgumentException("El valor {$x} está fuera del rango 0..{$max}");
        }
        $cuentas[$x]++;
    }
    $resultado = [];
    foreach ($cuentas as $valor => $veces) {
        for ($i = 0; $i < $veces; $i++) {
            $resultado[] = $valor;
        }
    }
    return $resultado;
}

/**
 * Orden por varios criterios.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @explicacion Comparar dos ARRAYS con `<=>` los compara elemento a elemento y se detiene en la primera diferencia,
 * justo lo que se necesita para ordenar por varios criterios. Para que un criterio sea descendente se intercambian
 * los operandos de ESE elemento: `[$a['apellido'], $b['edad'], ...] <=> [$b['apellido'], $a['edad'], ...]`.
 * @alternativas Encadenar comparaciones con `?:` (`strcmp(...) ?: $b['edad'] <=> $a['edad'] ?: ...`), más largo.
 * `array_multisort` sobre columnas, rápido pero poco legible.
 */
function ordenarPersonas(array $personas): array
{
    usort($personas, static fn(array $a, array $b): int =>
        [$a['apellido'], $b['edad'], $a['nombre']] <=> [$b['apellido'], $a['edad'], $b['nombre']]);
    return $personas;
}

/**
 * Orden por frecuencia.
 *
 * @complejidad Tiempo O(n + d log d) con d valores distintos; espacio O(n).
 * @explicacion `array_count_values` cuenta en O(n). Solo se ordenan los d valores DISTINTOS (por frecuencia
 * descendente y luego por valor), y después cada uno se repite tantas veces como aparecía con `array_fill`.
 * Ordenar la lista entera de n elementos con un comparador que mirase las frecuencias sería O(n log n) y más lento.
 * @alternativas Un único `usort` sobre los n elementos con las frecuencias en una tabla: más corto, algo más caro.
 */
function ordenarPorFrecuencia(array $xs): array
{
    $cuentas = array_count_values($xs);
    $valores = array_keys($cuentas);
    usort($valores, static fn(int $a, int $b): int => $cuentas[$b] <=> $cuentas[$a] ?: $a <=> $b);
    $resultado = [];
    foreach ($valores as $v) {
        array_push($resultado, ...array_fill(0, $cuentas[$v], $v));
    }
    return $resultado;
}
