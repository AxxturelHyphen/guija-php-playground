<?php
declare(strict_types=1);

/*
 * TEMA 4 · RECURSIÓN
 * ────────────────────────────────────────────────────────────────────────────
 * Una función recursiva se llama a sí misma resolviendo un problema más pequeño.
 * Toda recursión necesita dos cosas:
 *     1. CASO BASE: cuándo parar (si falta, recursión infinita → se agota la memoria).
 *     2. PASO RECURSIVO: acercarse al caso base en cada llamada.
 *
 * Cada llamada apila un "marco" en la pila de llamadas. PHP NO optimiza la recursión
 * de cola (tail call), igual que Java, y no tiene límite fijo de profundidad: lo
 * pone la memoria (aquí 128 MB). Por eso en PHP se prefiere un bucle cuando la
 * profundidad puede ser enorme.
 */

function titulo(string $texto): void
{
    echo "\n=== {$texto} ===\n";
}

// ════════════════════════════════════════════════════════════════════════════
// 1. ANATOMÍA: LA PILA DE LLAMADAS
// ════════════════════════════════════════════════════════════════════════════
titulo('1. La pila de llamadas');

function cuentaAtras(int $n, int $nivel = 0): void
{
    $sangria = str_repeat('  ', $nivel);
    if ($n === 0) {                                   // CASO BASE
        echo "{$sangria}¡despegue! (caso base: aquí empiezan a volver)\n";
        return;
    }
    echo "{$sangria}baja n={$n}\n";
    cuentaAtras($n - 1, $nivel + 1);                  // PASO RECURSIVO: n más pequeño
    echo "{$sangria}vuelve n={$n}\n";                 // esto se ejecuta al DESAPILAR
}
cuentaAtras(3);

// ════════════════════════════════════════════════════════════════════════════
// 2. PENSAR EN "SI SÉ RESOLVER LO PEQUEÑO, RESUELVO LO GRANDE"
// ════════════════════════════════════════════════════════════════════════════
titulo('2. Descomponer');

// suma(n) = n + suma(n - 1)            suma(0) = 0
function sumaHasta(int $n): int
{
    return $n === 0 ? 0 : $n + sumaHasta($n - 1);
}
echo 'sumaHasta(100) = ', sumaHasta(100), ' (la fórmula n(n+1)/2 da ', 100 * 101 / 2, ")\n";
echo 'sumaHasta(20000) = ', sumaHasta(20000), " (20.000 marcos apilados sin problema)\n";

// Recursión sobre estructuras anidadas: aquí un bucle no basta, la recursión es natural.
function sumaCarpetas(array $carpeta): int
{
    $total = 0;
    foreach ($carpeta as $contenido) {
        $total += is_array($contenido) ? sumaCarpetas($contenido) : $contenido;
    }
    return $total;
}
echo 'tamaño total del árbol: ', sumaCarpetas(['a.txt' => 10, 'src' => ['b.php' => 5, 'lib' => ['c.php' => 7]], 'd.md' => 1]), " KB\n";

// Recursión mutua: dos funciones que se llaman entre sí.
function esPar(int $n): bool
{
    return $n === 0 ? true : esImpar($n - 1);
}
function esImpar(int $n): bool
{
    return $n === 0 ? false : esPar($n - 1);
}
echo 'esPar(10): ', var_export(esPar(10), true), ' · esImpar(7): ', var_export(esImpar(7), true), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. EL PROBLEMA: LLAMADAS REPETIDAS (Y LA MEMOIZACIÓN)
// ════════════════════════════════════════════════════════════════════════════
// fib(n) = fib(n-1) + fib(n-2). Escrito sin más, recalcula lo mismo una y otra vez:
// fib(5) llama a fib(3) dos veces, a fib(2) tres veces... El número de llamadas crece como 2ⁿ.
titulo('3. Memoización');

function fibIngenuo(int $n, int &$llamadas): int
{
    $llamadas++;
    return $n < 2 ? $n : fibIngenuo($n - 1, $llamadas) + fibIngenuo($n - 2, $llamadas);
}

/** @param array<int,int> $memo recuerda lo ya calculado (se pasa por referencia con &) */
function fibMemo(int $n, array &$memo, int &$llamadas): int
{
    $llamadas++;
    if ($n < 2) {
        return $n;
    }
    return $memo[$n] ??= fibMemo($n - 1, $memo, $llamadas) + fibMemo($n - 2, $memo, $llamadas);
}

foreach ([10, 20, 25] as $n) {
    $a = 0;
    $m = [];
    $b = 0;
    $resultado = fibIngenuo($n, $a);
    fibMemo($n, $m, $b);
    printf("fib(%d) = %d   llamadas: ingenuo %s · con memoria %d\n", $n, $resultado, number_format($a, 0, ',', '.'), $b);
}
echo "Memoización = cambiar memoria por tiempo: O(2ⁿ) pasa a O(n). Es la base de la programación dinámica (tema 8).\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. BACKTRACKING: PROBAR, DESHACER, PROBAR OTRA COSA
// ════════════════════════════════════════════════════════════════════════════
// Se construye una solución paso a paso; si un camino no sirve, se deshace la última
// decisión y se prueba la siguiente. Es la plantilla de permutaciones, subconjuntos,
// sudokus, n-reinas...
titulo('4. Backtracking');

/** Todas las cadenas binarias de longitud $n (no se repiten ni se dejan). */
function binarios(int $n, string $actual = '', array &$resultado = []): array
{
    if (strlen($actual) === $n) {                 // CASO BASE: solución completa
        $resultado[] = $actual;
        return $resultado;
    }
    foreach (['0', '1'] as $bit) {
        binarios($n, $actual . $bit, $resultado); // decidir un paso y seguir (al volver, "se deshace" solo
    }                                             // porque $actual es una copia: strings pasan por valor)
    return $resultado;
}
echo implode(' ', binarios(3)), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 5. CUÁNDO NO USAR RECURSIÓN
// ════════════════════════════════════════════════════════════════════════════
// · Cuando la profundidad pueda ser enorme (un bucle no apila marcos).
// · Cuando el trabajo se repite (usa memoización o un bucle que guarde lo calculado).
// Cualquier recursión se puede convertir en un bucle con una pila explícita (un array):
titulo('5. De recursión a bucle con pila explícita');

function sumaCarpetasIterativa(array $raiz): int
{
    $total = 0;
    $pila = [$raiz];
    while ($pila) {
        $actual = array_pop($pila);
        foreach ($actual as $contenido) {
            if (is_array($contenido)) {
                $pila[] = $contenido;
            } else {
                $total += $contenido;
            }
        }
    }
    return $total;
}
echo 'mismo resultado sin recursión: ', sumaCarpetasIterativa(['a.txt' => 10, 'src' => ['b.php' => 5, 'lib' => ['c.php' => 7]], 'd.md' => 1]), " KB\n";

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · factorial ─────────────────────────────────────────────────
/**
 * n! = n × (n-1) × ... × 1, con 0! = 1. Hazlo recursivo.
 *  - n negativo → InvalidArgumentException.
 *  - Un int de 64 bits solo llega a 20! (2.432.902.008.176.640.000): para n > 20 lanza OverflowException
 *    (en vez de dejar que PHP convierta en silencio a float y pierda precisión).
 */
function factorial(int $n): int
{
    pendiente();
}

// ── Ejercicio 2 · mcd ───────────────────────────────────────────────────────
/**
 * Máximo común divisor con el algoritmo de Euclides: mcd(a, b) = mcd(b, a mod b); mcd(a, 0) = |a|.
 * Admite negativos (el resultado siempre es positivo). mcd(0, 0) = 0.
 */
function mcd(int $a, int $b): int
{
    pendiente();
}

// ── Ejercicio 3 · fibonacci ─────────────────────────────────────────────────
/**
 * fib(0) = 0, fib(1) = 1, fib(n) = fib(n-1) + fib(n-2).  n negativo → InvalidArgumentException.
 * La versión ingenua es O(2ⁿ): con n = 40 tarda minutos. Hazla O(n) con memoización
 * (¡ojo con una caché `static`: que no se arrastre entre llamadas!). Pulsa «Medir» para verlo.
 */
function fibonacci(int $n): int
{
    pendiente();
}

// ── Ejercicio 4 · potencia ──────────────────────────────────────────────────
/**
 * base^exp en O(log n) con la idea "divide y vencerás":
 *     x^n = (x^(n/2))² si n es par;   x · (x^((n-1)/2))² si n es impar
 * Exponente negativo → 1 / base^(-exp). Cualquier base elevada a 0 es 1.0. 0 elevado a un exponente negativo
 * → InvalidArgumentException. (El bucle de n multiplicaciones es O(n); aquí se pide mucho menos.)
 */
function potencia(float $base, int $exp): float
{
    pendiente();
}

// ── Ejercicio 5 · esPalindromo ──────────────────────────────────────────────
/**
 * ¿Se lee igual al revés? Solo cuentan las letras y los dígitos: se ignoran mayúsculas, espacios y signos
 * (los acentos no se normalizan: é ≠ e). Hazlo con recursión comparando los extremos y acercándote al centro.
 *   "Anita lava la tina" → true   ·   "A man, a plan, a canal: Panama" → true   ·   "hola" → false
 */
function esPalindromo(string $texto): bool
{
    pendiente();
}

// ── Ejercicio 6 · permutaciones ─────────────────────────────────────────────
/**
 * Todas las ordenaciones posibles de los elementos de la lista (backtracking), en este orden:
 * se elige el primer elemento en el orden original y se permuta el resto.
 *   permutaciones([1, 2, 3]) → [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
 * Lista vacía → [[]] (hay exactamente una forma de ordenar nada).
 *
 * @param list<int|string> $xs
 * @return list<list<int|string>>
 */
function permutaciones(array $xs): array
{
    pendiente();
}

// ── Ejercicio 7 · subconjuntos ──────────────────────────────────────────────
/**
 * Todos los subconjuntos (el "conjunto de las partes"), en orden de backtracking: primero el vacío, y luego
 * cada elemento seguido de los subconjuntos que se pueden formar con los que le siguen.
 *   subconjuntos([1, 2, 3]) → [[], [1], [1,2], [1,2,3], [1,3], [2], [2,3], [3]]
 * Para n elementos hay 2ⁿ subconjuntos.
 *
 * @param list<int|string> $xs
 * @return list<list<int|string>>
 */
function subconjuntos(array $xs): array
{
    pendiente();
}

// ── Ejercicio 8 · hanoi ─────────────────────────────────────────────────────
/**
 * Torres de Hanoi: mueve $n discos de $origen a $destino usando $auxiliar, sin poner nunca uno grande sobre
 * uno pequeño. Devuelve la lista de movimientos como "A→C".
 *   hanoi(2) → ['A→B', 'A→C', 'B→C']
 * Hacen falta exactamente 2ⁿ − 1 movimientos. Con n = 0 no hay ninguno.
 *
 * @return list<string>
 */
function hanoi(int $n, string $origen = 'A', string $auxiliar = 'B', string $destino = 'C'): array
{
    pendiente();
}

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

prueba('factorial', [
    '0! = 1' => [[0], 1],
    '1! = 1' => [[1], 1],
    '5! = 120' => [[5], 120],
    '10!' => [[10], 3628800],
    '20! es el mayor que cabe' => [[20], 2432902008176640000],
]);
grupo('factorial()');
lanza('negativo', fn() => factorial(-1), InvalidArgumentException::class);
lanza('21! desborda', fn() => factorial(21), OverflowException::class);

prueba('mcd', [
    'básico' => [[12, 18], 6],
    'coprimos' => [[7, 13], 1],
    'con cero' => [[0, 5], 5],
    'con cero (otro orden)' => [[5, 0], 5],
    'negativos' => [[-12, 18], 6],
    'iguales' => [[9, 9], 9],
    'los dos cero' => [[0, 0], 0],
    'números grandes' => [[1071, 462], 21],
]);

prueba('fibonacci', [
    'fib(0)' => [[0], 0],
    'fib(1)' => [[1], 1],
    'fib(2)' => [[2], 1],
    'fib(10)' => [[10], 55],
    'fib(30)' => [[30], 832040],
    'fib(50) (la versión ingenua no llega)' => [[50], 12586269025],
    'fib(90)' => [[90], 2880067194370816120],
]);
grupo('fibonacci()');
lanza('negativo', fn() => fibonacci(-1), InvalidArgumentException::class);
comprueba('dos llamadas seguidas dan lo mismo', fn() => [fibonacci(25), fibonacci(25)], [75025, 75025]);

prueba('potencia', [
    '2^10' => [[2.0, 10], 1024.0],
    '3^0' => [[3.0, 0], 1.0],
    '2^1' => [[2.0, 1], 2.0],
    '1.5^3' => [[1.5, 3], 3.375],
    'exponente negativo' => [[2.0, -2], 0.25],
    '0^0' => [[0.0, 0], 1.0],
    '0^5' => [[0.0, 5], 0.0],
    '(-2)^3' => [[-2.0, 3], -8.0],
    'exponente enorme sin desbordar' => [[1.0, 1_000_000], 1.0],
]);
grupo('potencia()');
lanza('0 elevado a negativo', fn() => potencia(0.0, -1), InvalidArgumentException::class);

prueba('esPalindromo', [
    'palabra' => [['reconocer'], true],
    'con espacios y mayúsculas' => [['Anita lava la tina'], true],
    'con signos' => [['A man, a plan, a canal: Panama'], true],
    'no lo es' => [['hola'], false],
    'vacío' => [[''], true],
    'un carácter' => [['x'], true],
    'solo signos' => [['¡?!'], true],
    'dígitos' => [['12321'], true],
    'casi' => [['abca'], false],
]);

prueba('permutaciones', [
    'tres elementos' => [[[1, 2, 3]], [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]],
    'dos elementos' => [[['a', 'b']], [['a', 'b'], ['b', 'a']]],
    'uno' => [[[7]], [[7]]],
    'vacía' => [[[]], [[]]],
]);
grupo('permutaciones()');
comprueba('5 elementos dan 120', fn() => count(permutaciones([1, 2, 3, 4, 5])), 120);
comprueba('ninguna se repite', fn() => count(array_unique(array_map('json_encode', permutaciones([1, 2, 3, 4])))), 24);

prueba('subconjuntos', [
    'tres elementos' => [[[1, 2, 3]], [[], [1], [1, 2], [1, 2, 3], [1, 3], [2], [2, 3], [3]]],
    'uno' => [[['x']], [[], ['x']]],
    'vacío' => [[[]], [[]]],
]);
grupo('subconjuntos()');
comprueba('10 elementos dan 1024', fn() => count(subconjuntos(range(1, 10))), 1024);

prueba('hanoi', [
    'n = 0' => [[0], []],
    'n = 1' => [[1], ['A→C']],
    'n = 2' => [[2], ['A→B', 'A→C', 'B→C']],
    'n = 3' => [[3], ['A→C', 'A→B', 'C→B', 'A→C', 'B→A', 'B→C', 'A→C']],
    'otros nombres' => [[1, 'X', 'Y', 'Z'], ['X→Z']],
]);
grupo('hanoi()');
comprueba('10 discos = 1023 movimientos', fn() => count(hanoi(10)), 1023);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
// fibonacci con la versión ingenua explota (O(2ⁿ)), con memoria es lineal. La escala es lineal (5, 10, 15...)
// porque con tamaños que se doblan, el ingenuo no acabaría nunca.
medir('fibonacci', fn(int $n): array => [$n], 'lineal', range(5, 90, 5));
// potencia: con n = 131072 un bucle hace 131072 multiplicaciones; la versión rápida, 17.
medir('potencia', fn(int $n): array => [1.0, $n]);
