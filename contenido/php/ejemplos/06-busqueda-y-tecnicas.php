<?php
declare(strict_types=1);

/*
 * TEMA 6 · BÚSQUEDA Y TÉCNICAS CLÁSICAS
 * ────────────────────────────────────────────────────────────────────────────
 * Muchos problemas "difíciles" son en realidad un truco de cuatro o cinco que se repiten.
 * Aquí aprenderás los que más rentabilidad tienen y cuándo aplicarlos:
 *
 *   Búsqueda binaria     datos ORDENADOS          O(n) → O(log n)
 *   Dos punteros         datos ordenados / pares  O(n²) → O(n)
 *   Ventana deslizante   subarrays contiguos       O(n·k) → O(n)
 *   Tabla hash           "¿lo he visto ya?"        O(n²) → O(n)
 *   Sumas prefijas       consultas de rango        O(n) por consulta → O(1)
 *
 * La idea común: no recalcular lo que ya sabes. Cambiar tiempo por un poco de memoria.
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
// 1. BÚSQUEDA LINEAL FRENTE A BINARIA
// ════════════════════════════════════════════════════════════════════════════
// Lineal: mirar uno por uno → hasta n pasos. Binaria: en una lista ORDENADA, mirar el del medio y descartar la
// mitad que no puede contenerlo → log₂ n pasos (con mil millones de elementos, ~30).
titulo('1. Lineal frente a binaria');

/** Devuelve [índice, número de pasos]. */
function lineal(array $xs, int $x): array
{
    $pasos = 0;
    foreach ($xs as $i => $v) {
        $pasos++;
        if ($v === $x) {
            return [$i, $pasos];
        }
    }
    return [-1, $pasos];
}

function binariaConPasos(array $xs, int $x): array
{
    $pasos = 0;
    $bajo = 0;
    $alto = count($xs) - 1;
    while ($bajo <= $alto) {                    // invariante: si x está, está en [bajo, alto]
        $pasos++;
        $medio = intdiv($bajo + $alto, 2);      // intdiv: división entera (como / entre ints en Java)
        if ($xs[$medio] === $x) {
            return [$medio, $pasos];
        }
        if ($xs[$medio] < $x) {
            $bajo = $medio + 1;                 // descarta la mitad izquierda (y el medio)
        } else {
            $alto = $medio - 1;                 // descarta la mitad derecha (y el medio)
        }
    }
    return [-1, $pasos];
}

$datos = range(0, 1_000_000, 2);                // 500.001 números pares, ordenados
foreach ([1000, 777_776, 999_999] as $buscado) {
    [$i1, $p1] = lineal($datos, $buscado);
    [$i2, $p2] = binariaConPasos($datos, $buscado);
    printf("buscando %9s → lineal: pos %6d en %6s pasos · binaria: pos %6d en %2d pasos\n", number_format($buscado, 0, ',', '.'), $i1, number_format($p1, 0, ',', '.'), $i2, $p2);
}
echo "(999.999 es impar: no está, y la lineal lo comprueba todo)\n";

// Los errores típicos de la binaria: `$alto = count - 1` o `count` (hay que ser coherente con `<=` o `<`),
// no avanzar `medio ± 1` (bucle infinito) y no ordenar antes. Las dos plantillas más usadas:
//   · buscar un valor exacto:                      while ($bajo <= $alto) {...}
//   · buscar la primera posición que cumple algo:  while ($bajo < $alto) { ... } ("límite inferior")

// ════════════════════════════════════════════════════════════════════════════
// 2. DOS PUNTEROS
// ════════════════════════════════════════════════════════════════════════════
// Con la lista ordenada, un puntero al principio y otro al final se van acercando según la suma
// sea demasiado pequeña o demasiado grande. Cada paso descarta al menos un candidato: O(n).
titulo('2. Dos punteros');

function parConSuma(array $ordenado, int $objetivo): ?array
{
    $i = 0;
    $j = count($ordenado) - 1;
    while ($i < $j) {
        $suma = $ordenado[$i] + $ordenado[$j];
        echo "  {$ordenado[$i]} + {$ordenado[$j]} = {$suma}\n";
        if ($suma === $objetivo) {
            return [$ordenado[$i], $ordenado[$j]];
        }
        $suma < $objetivo ? $i++ : $j--;
    }
    return null;
}
echo 'par que suma 10 en [1,2,4,7,8,11]: ', ver(parConSuma([1, 2, 4, 7, 8, 11], 10)), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. VENTANA DESLIZANTE
// ════════════════════════════════════════════════════════════════════════════
// Para "el mejor tramo CONTIGUO de tamaño k": en vez de sumar k elementos en cada posición (O(n·k)),
// se desliza la ventana: se suma el que entra y se resta el que sale (O(n)).
titulo('3. Ventana deslizante');

function mediaMovil(array $xs, int $k): array
{
    $medias = [];
    $suma = array_sum(array_slice($xs, 0, $k));
    $medias[] = $suma / $k;
    for ($i = $k, $n = count($xs); $i < $n; $i++) {
        $suma += $xs[$i] - $xs[$i - $k];          // entra xs[i], sale xs[i - k]
        $medias[] = $suma / $k;
    }
    return $medias;
}
echo 'media móvil (k = 3) de [1,2,3,4,5,6]: ', ver(mediaMovil([1, 2, 3, 4, 5, 6], 3)), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. TABLAS HASH: "¿LO HE VISTO YA?"
// ════════════════════════════════════════════════════════════════════════════
// Un array asociativo da búsqueda/inserción O(1). Casi cualquier problema de pares, duplicados, frecuencias o
// agrupaciones se resuelve con una pasada y un array auxiliar.
titulo('4. Tablas hash');

// Primer carácter que no se repite
function primerUnico(string $s): ?string
{
    $cuentas = array_count_values(mb_str_split($s));
    foreach ($cuentas as $caracter => $veces) {       // el array conserva el orden de inserción
        if ($veces === 1) {
            return (string) $caracter;
        }
    }
    return null;
}
echo 'primer carácter único de "aabbcdd": ', var_export(primerUnico('aabbcdd'), true), "\n";

// Dos sumas con una pasada: para cada número, ¿está ya su complemento?
function dosSumasTraza(array $nums, int $objetivo): ?array
{
    $vistos = [];                                     // valor => índice
    foreach ($nums as $i => $n) {
        $falta = $objetivo - $n;
        echo "  n={$n}, busco {$falta}: ", isset($vistos[$falta]) ? 'encontrado' : 'no está aún', "\n";
        if (isset($vistos[$falta])) {
            return [$vistos[$falta], $i];
        }
        $vistos[$n] = $i;
    }
    return null;
}
echo 'dos sumas a 9 en [2,7,11,15]: ', ver(dosSumasTraza([2, 7, 11, 15], 9)), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 5. SUMAS PREFIJAS
// ════════════════════════════════════════════════════════════════════════════
// prefijo[i] = suma de los primeros i elementos. Entonces suma(desde..hasta) = prefijo[hasta+1] - prefijo[desde].
// Se paga O(n) una vez y cada consulta cuesta O(1).
titulo('5. Sumas prefijas');

$valores = [3, 1, 4, 1, 5, 9, 2, 6];
$prefijo = [0];
foreach ($valores as $v) {
    $prefijo[] = end($prefijo) + $v;
}
echo 'prefijo: ', ver($prefijo), "\n";
echo 'suma de las posiciones 2..5: ', $prefijo[6] - $prefijo[2], ' (4+1+5+9 = ', 4 + 1 + 5 + 9, ")\n";

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · busquedaBinaria ───────────────────────────────────────────
/**
 * Índice de $x en la lista ORDENADA ascendente, o -1 si no está. Debe ser O(log n).
 * Si hay repetidos, vale cualquier posición válida (las pruebas no los incluyen).
 *
 * @param list<int> $ordenado
 */
function busquedaBinaria(array $ordenado, int $x): int
{
    pendiente();
}

// ── Ejercicio 2 · limiteInferior ────────────────────────────────────────────
/**
 * Primera posición cuyo valor es MAYOR O IGUAL que $x (el "lower bound"); count($ordenado) si todos son menores.
 * Con repetidos devuelve la PRIMERA aparición. Es la búsqueda binaria que más se usa en la práctica
 * (insertar en una lista ordenada, contar cuántos hay menores que x...). O(log n).
 *
 *   limiteInferior([1, 3, 3, 3, 7], 3)  →  1        limiteInferior([1, 3, 7], 5)  →  2
 *
 * @param list<int> $ordenado
 */
function limiteInferior(array $ordenado, int $x): int
{
    pendiente();
}

// ── Ejercicio 3 · parSuma (dos punteros) ────────────────────────────────────
/**
 * En una lista ordenada ascendente, busca dos posiciones i < j cuyos valores sumen $objetivo y devuelve [i, j];
 * null si no hay. Usa dos punteros desde los extremos: O(n). (Las pruebas solo tienen una solución posible.)
 *
 * @param list<int> $ordenado
 * @return ?array{0: int, 1: int}
 */
function parSuma(array $ordenado, int $objetivo): ?array
{
    pendiente();
}

// ── Ejercicio 4 · dosSumas (tabla hash) ─────────────────────────────────────
/**
 * Como el anterior, pero la lista NO está ordenada: devuelve las posiciones [i, j] (i < j) de dos números que
 * suman $objetivo, o null. O(n) con una tabla de "valor ya visto → posición".
 *
 * @param list<int> $nums
 * @return ?array{0: int, 1: int}
 */
function dosSumas(array $nums, int $objetivo): ?array
{
    pendiente();
}

// ── Ejercicio 5 · sumaMaximaVentana ─────────────────────────────────────────
/**
 * La mayor suma de $k elementos CONSECUTIVOS. O(n) con ventana deslizante.
 * $k < 1 o $k > count($a) → InvalidArgumentException.
 *   sumaMaximaVentana([2, 1, 5, 1, 3, 2], 3)  →  9   (5 + 1 + 3)
 *
 * @param list<int> $a
 */
function sumaMaximaVentana(array $a, int $k): int
{
    pendiente();
}

// ── Ejercicio 6 · subcadenaSinRepetir ───────────────────────────────────────
/**
 * Longitud de la subcadena más larga SIN caracteres repetidos (ventana deslizante + tabla de últimas posiciones).
 * Trabaja con caracteres Unicode (usa mb_str_split). O(n).
 *   "abcabcbb" → 3 ("abc")      "bbbbb" → 1      "pwwkew" → 3 ("wke")      "" → 0
 */
function subcadenaSinRepetir(string $s): int
{
    pendiente();
}

// ── Ejercicio 7 · agruparAnagramas ──────────────────────────────────────────
/**
 * Agrupa las palabras que son anagramas entre sí (mismas letras, distinto orden). Los grupos salen en el orden
 * de la primera palabra de cada uno, y dentro de cada grupo se respeta el orden de entrada. Distingue minúsculas.
 *   ['rata', 'tara', 'sol', 'los', 'arta', 'pez']  →  [['rata', 'tara', 'arta'], ['sol', 'los'], ['pez']]
 * Pista: dos palabras son anagramas si tienen las mismas letras ORDENADAS: esa es la clave del grupo.
 *
 * @param list<string> $palabras
 * @return list<list<string>>
 */
function agruparAnagramas(array $palabras): array
{
    pendiente();
}

// ── Ejercicio 8 · SumasPrefijas ─────────────────────────────────────────────
/**
 * Prepara una lista una vez (O(n)) para responder "¿cuánto suman las posiciones desde..hasta (inclusive)?"
 * en O(1). Un rango inválido (desde < 0, hasta fuera de la lista o desde > hasta) lanza OutOfRangeException.
 */
final class SumasPrefijas
{
    /** @param list<int> $valores */
    public function __construct(array $valores)
    {
        pendiente();
    }

    public function suma(int $desde, int $hasta): int
    {
        pendiente();
    }
}

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

prueba('busquedaBinaria', [
    'en medio' => [[[1, 3, 5, 7, 9], 5], 2],
    'el primero' => [[[1, 3, 5, 7, 9], 1], 0],
    'el último' => [[[1, 3, 5, 7, 9], 9], 4],
    'no está (en medio)' => [[[1, 3, 5, 7, 9], 4], -1],
    'menor que todos' => [[[1, 3, 5], -10], -1],
    'mayor que todos' => [[[1, 3, 5], 99], -1],
    'lista vacía' => [[[], 1], -1],
    'un elemento (está)' => [[[4], 4], 0],
    'un elemento (no está)' => [[[4], 5], -1],
    'negativos' => [[[-9, -4, 0, 3], -4], 1],
]);

prueba('limiteInferior', [
    'con repetidos: la primera' => [[[1, 3, 3, 3, 7], 3], 1],
    'no está: donde iría' => [[[1, 3, 7], 5], 2],
    'menor que todos' => [[[1, 3, 7], 0], 0],
    'mayor que todos' => [[[1, 3, 7], 100], 3],
    'vacía' => [[[], 5], 0],
    'todos iguales' => [[[2, 2, 2, 2], 2], 0],
    'el último' => [[[1, 2, 3], 3], 2],
]);

prueba('parSuma', [
    'básico' => [[[1, 2, 4, 7, 8, 11], 10], [1, 4]],
    'extremos' => [[[1, 5, 9], 10], [0, 2]],
    'no hay' => [[[1, 2, 3], 100], null],
    'lista corta' => [[[5], 5], null],
    'negativos' => [[[-4, -1, 3, 8], 7], [1, 3]],
    'vacía' => [[[], 0], null],
]);

prueba('dosSumas', [
    'clásico' => [[[2, 7, 11, 15], 9], [0, 1]],
    'desordenada' => [[[3, 2, 4], 6], [1, 2]],
    'con repetidos' => [[[3, 3], 6], [0, 1]],
    'no hay' => [[[1, 2, 3], 10], null],
    'vacía' => [[[], 3], null],
    'con negativos' => [[[-3, 4, 3, 90], 0], [0, 2]],
]);

prueba('sumaMaximaVentana', [
    'ejemplo' => [[[2, 1, 5, 1, 3, 2], 3], 9],
    'ventana de 1' => [[[4, 8, 2], 1], 8],
    'ventana = lista' => [[[1, 2, 3], 3], 6],
    'con negativos' => [[[-5, -1, -3, -2], 2], -4],
    'al final' => [[[1, 1, 1, 9, 9], 2], 18],
]);
grupo('sumaMaximaVentana()');
lanza('k mayor que la lista', fn() => sumaMaximaVentana([1, 2], 3), InvalidArgumentException::class);
lanza('k cero', fn() => sumaMaximaVentana([1, 2], 0), InvalidArgumentException::class);

prueba('subcadenaSinRepetir', [
    'abcabcbb' => [['abcabcbb'], 3],
    'todos iguales' => [['bbbbb'], 1],
    'pwwkew' => [['pwwkew'], 3],
    'vacía' => [[''], 0],
    'sin repeticiones' => [['abcdef'], 6],
    'se repite al principio' => [['abba'], 2],
    'con tildes' => [['áéíóúáé'], 5],
    'con emojis' => [['😀😎😀🎉'], 3],
]);

prueba('agruparAnagramas', [
    'ejemplo' => [[['rata', 'tara', 'sol', 'los', 'arta', 'pez']], [['rata', 'tara', 'arta'], ['sol', 'los'], ['pez']]],
    'ninguno' => [[['a', 'b', 'c']], [['a'], ['b'], ['c']]],
    'vacía' => [[[]], []],
    'repetidas' => [[['ab', 'ba', 'ab']], [['ab', 'ba', 'ab']]],
    'distinta longitud' => [[['a', 'aa', 'aaa']], [['a'], ['aa'], ['aaa']]],
]);

grupo('SumasPrefijas');
comprueba('rango en medio', fn() => (new SumasPrefijas([3, 1, 4, 1, 5, 9, 2, 6]))->suma(2, 5), 19);
comprueba('un solo elemento', fn() => (new SumasPrefijas([3, 1, 4]))->suma(1, 1), 1);
comprueba('toda la lista', fn() => (new SumasPrefijas([1, 2, 3, 4]))->suma(0, 3), 10);
comprueba('con negativos', fn() => (new SumasPrefijas([5, -2, -3, 4]))->suma(1, 2), -5);
comprueba('muchas consultas', function () {
    $s = new SumasPrefijas(range(1, 100));
    return [$s->suma(0, 99), $s->suma(10, 19), $s->suma(99, 99)];
}, [5050, 155, 100]);
lanza('desde negativo', fn() => (new SumasPrefijas([1, 2]))->suma(-1, 1), OutOfRangeException::class);
lanza('hasta fuera de la lista', fn() => (new SumasPrefijas([1, 2]))->suma(0, 2), OutOfRangeException::class);
lanza('desde mayor que hasta', fn() => (new SumasPrefijas([1, 2, 3]))->suma(2, 1), OutOfRangeException::class);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
medir('busquedaBinaria', fn(int $n): array => [range(0, $n - 1), $n - 1]);        // O(log n) (un bucle: O(n))
medir('parSuma', fn(int $n): array => [range(0, $n - 1), -1]);                      // O(n) (con bucle doble: O(n²))
medir('dosSumas', fn(int $n): array => [range(0, $n - 1), -1]);                     // O(n) (con bucle doble: O(n²))
medir('sumaMaximaVentana', fn(int $n): array => [range(1, $n), intdiv($n, 2)]);    // O(n) (recalculando cada ventana: O(n²))
medir('subcadenaSinRepetir', fn(int $n): array => [implode('', array_map(static fn(int $i): string => mb_chr(0x10000 + $i), range(0, $n - 1)))]);
medir(
    fn(SumasPrefijas $s, int $n): int => $s->suma(0, $n - 1),
    fn(int $n): array => [new SumasPrefijas(range(1, $n)), $n],
    etiqueta: 'SumasPrefijas',
);   // O(1) por consulta (sumando el rango en cada consulta: O(n))
