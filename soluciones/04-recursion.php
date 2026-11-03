<?php
declare(strict_types=1);

/*
 * SOLUCIONES · Tema 4 · Recursión
 */

/**
 * Factorial recursivo con control de desbordamiento.
 *
 * @complejidad Tiempo O(n); espacio O(n) por la pila de llamadas.
 * @explicacion Caso base `n <= 1`; paso `n * factorial(n - 1)`. Como 21! ya no cabe en un int de 64 bits y PHP
 * convertiría el resultado en un float perdiendo precisión sin avisar, se corta antes con una excepción: es mejor
 * un error claro que un número silenciosamente equivocado.
 * @alternativas Un bucle `for` (O(n) de tiempo y O(1) de espacio): preferible en la práctica porque no apila marcos.
 * Para números grandes, la extensión `gmp` o `bcmath`.
 */
function factorial(int $n): int
{
    if ($n < 0) {
        throw new InvalidArgumentException("El factorial no está definido para {$n}");
    }
    if ($n > 20) {
        throw new OverflowException("{$n}! no cabe en un int de 64 bits");
    }
    return $n <= 1 ? 1 : $n * factorial($n - 1);
}

/**
 * Máximo común divisor (Euclides).
 *
 * @complejidad Tiempo O(log min(a, b)); espacio O(log min(a, b)) de pila.
 * @explicacion mcd(a, b) = mcd(b, a mod b) porque cualquier divisor común de a y b también lo es de b y a mod b.
 * El resto baja al menos a la mitad cada dos pasos, de ahí el logaritmo. Se trabaja con valores absolutos para que
 * el resultado sea siempre positivo.
 * @alternativas La versión con `while ($b !== 0) { [$a, $b] = [$b, $a % $b]; }` no apila marcos (O(1) de espacio).
 */
function mcd(int $a, int $b): int
{
    return $b === 0 ? abs($a) : mcd($b, $a % $b);
}

/**
 * Fibonacci con memoización local.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @bigo n
 * @explicacion La versión ingenua recalcula los mismos subproblemas una y otra vez (O(2ⁿ) llamadas). Aquí cada
 * valor se calcula UNA vez y se guarda en `$memo`. La caché es LOCAL a cada llamada (no `static`): una caché estática
 * haría que las siguientes llamadas fueran O(1) y falsearía las mediciones, además de ocupar memoria para siempre.
 * @alternativas Un bucle con dos variables (`[$a, $b] = [$b, $a + $b]`): O(n) de tiempo y O(1) de espacio, la mejor
 * opción en la práctica. La fórmula de Binet es O(1) pero con floats pierde precisión a partir de n ≈ 70.
 */
function fibonacci(int $n): int
{
    if ($n < 0) {
        throw new InvalidArgumentException("fibonacci no está definido para {$n}");
    }
    $memo = [];
    $f = static function (int $k) use (&$f, &$memo): int {
        if ($k < 2) {
            return $k;
        }
        return $memo[$k] ??= $f($k - 1) + $f($k - 2);
    };
    return $f($n);
}

/**
 * Potencia rápida por exponenciación binaria.
 *
 * @complejidad Tiempo O(log n); espacio O(log n) de pila.
 * @bigo log
 * @explicacion Si el exponente es par, x^n = (x^(n/2))²; si es impar, x · (x^((n-1)/2))². Cada llamada divide el
 * exponente entre dos, así que bastan ~log₂(n) llamadas en vez de n multiplicaciones. La mitad se calcula UNA vez
 * y se guarda en una variable (si se llamara dos veces, se perdería la ventaja y volvería a ser O(n)).
 * @alternativas El bucle `for` de n multiplicaciones: O(n). La versión iterativa de la exponenciación binaria
 * (recorrer los bits del exponente) es O(log n) con O(1) de espacio. La función nativa `**` o `pow()` es lo que
 * usarías en producción.
 */
function potencia(float $base, int $exp): float
{
    if ($exp < 0) {
        if ($base === 0.0) {
            throw new InvalidArgumentException('0 elevado a un exponente negativo no está definido');
        }
        return 1 / potencia($base, -$exp);
    }
    if ($exp === 0) {
        return 1.0;
    }
    $mitad = potencia($base, intdiv($exp, 2));
    return $exp % 2 === 0 ? $mitad * $mitad : $base * $mitad * $mitad;
}

/**
 * Palíndromo recursivo sobre letras y dígitos.
 *
 * @complejidad Tiempo O(n); espacio O(n) (la cadena limpia y la pila).
 * @explicacion Primero se limpia el texto: `\p{L}\p{N}` conserva letras y números de cualquier idioma y
 * `mb_strtolower` unifica las mayúsculas. Después, cada llamada compara los dos extremos y se queda con el
 * interior; el caso base es una cadena de 0 o 1 caracteres, que siempre es palíndroma.
 * @alternativas `$s === strrev($s)` (con `mb_str_split` + `array_reverse` para UTF-8): una línea, O(n). Dos
 * índices que se acercan en un bucle: O(n) sin copiar el texto, y es lo que se usa en las entrevistas.
 */
function esPalindromo(string $texto): bool
{
    $limpio = mb_strtolower((string) preg_replace('/[^\p{L}\p{N}]/u', '', $texto));
    $comparar = static function (string $s) use (&$comparar): bool {
        if (mb_strlen($s) < 2) {
            return true;
        }
        return mb_substr($s, 0, 1) === mb_substr($s, -1) && $comparar(mb_substr($s, 1, -1));
    };
    return $comparar($limpio);
}

/**
 * Permutaciones por backtracking.
 *
 * @complejidad Tiempo O(n · n!); espacio O(n · n!) para devolver todas.
 * @explicacion Se elige cada elemento como primero y se permuta el resto (que es una lista más corta): caso base,
 * la lista vacía tiene una sola permutación, `[]`. Al construir `[$x, ...$perm]` no hay nada que "deshacer": cada
 * llamada trabaja con su propia copia del resto.
 * @alternativas El algoritmo de Heap genera las permutaciones intercambiando UN par por paso sin copiar listas.
 * Un generador (`yield`) evita guardar las n! permutaciones en memoria a la vez.
 */
function permutaciones(array $xs): array
{
    if ($xs === []) {
        return [[]];
    }
    $resultado = [];
    foreach ($xs as $i => $x) {
        $resto = $xs;
        unset($resto[$i]);
        foreach (permutaciones(array_values($resto)) as $perm) {
            $resultado[] = [$x, ...$perm];
        }
    }
    return $resultado;
}

/**
 * Subconjuntos por backtracking.
 *
 * @complejidad Tiempo O(n · 2ⁿ); espacio O(n · 2ⁿ).
 * @explicacion `buscar($inicio, $actual)` registra el subconjunto actual y luego, para cada elemento posterior,
 * lo añade, baja un nivel y lo QUITA con `array_pop` al volver: es el "probar y deshacer" del backtracking. El
 * orden de salida (vacío, [1], [1,2], [1,2,3], [1,3]...) es el del recorrido en profundidad.
 * @alternativas Contar de 0 a 2ⁿ − 1 y usar cada bit como "incluir este elemento" (máscara de bits).
 */
function subconjuntos(array $xs): array
{
    $xs = array_values($xs);
    $resultado = [];
    $buscar = static function (int $inicio, array $actual) use (&$buscar, &$resultado, $xs): void {
        $resultado[] = $actual;
        for ($i = $inicio, $n = count($xs); $i < $n; $i++) {
            $actual[] = $xs[$i];
            $buscar($i + 1, $actual);
            array_pop($actual);
        }
    };
    $buscar(0, []);
    return $resultado;
}

/**
 * Torres de Hanoi.
 *
 * @complejidad Tiempo O(2ⁿ); espacio O(2ⁿ) por la lista de movimientos (la pila es O(n)).
 * @explicacion Para mover n discos: 1) pasar los n−1 de arriba al auxiliar, 2) mover el grande al destino, 3)
 * pasar los n−1 del auxiliar al destino. Cada llamada hace dos subllamadas de tamaño n−1, de ahí los 2ⁿ − 1
 * movimientos (y no se puede hacer en menos: es óptimo).
 * @alternativas Existe una solución iterativa (alternar el movimiento legal del disco más pequeño con el único
 * otro movimiento posible), pero la recursiva es mucho más clara.
 */
function hanoi(int $n, string $origen = 'A', string $auxiliar = 'B', string $destino = 'C'): array
{
    if ($n <= 0) {
        return [];
    }
    return [
        ...hanoi($n - 1, $origen, $destino, $auxiliar),
        "{$origen}→{$destino}",
        ...hanoi($n - 1, $auxiliar, $origen, $destino),
    ];
}
