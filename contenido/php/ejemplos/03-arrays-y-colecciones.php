<?php
declare(strict_types=1);

/*
 * TEMA 3 · ARRAYS Y COLECCIONES
 * ────────────────────────────────────────────────────────────────────────────
 * El array de PHP es la estructura que más vas a usar: es a la vez lista, mapa
 * ordenado (como LinkedHashMap), pila, cola y conjunto. Entender sus trampas y su
 * coste te ahorra el 80 % de los problemas de rendimiento.
 *
 * En Java:  ArrayList<T> + LinkedHashMap<K,V> + HashSet<T> + ArrayDeque<T>   → en PHP: array
 * Se copia al asignarse (valor), pero PHP no copia de verdad hasta que lo modificas
 * ("copy-on-write"), así que pasarlos a funciones es barato.
 */

function titulo(string $texto): void
{
    echo "\n=== {$texto} ===\n";
}

/** Muestra un valor en una línea, como JSON: [1,2] para listas y {"a":1} para mapas. */
function ver(mixed $valor): string
{
    return (string) json_encode($valor, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// ════════════════════════════════════════════════════════════════════════════
// 1. LISTA, MAPA Y CONJUNTO EN UNA SOLA ESTRUCTURA
// ════════════════════════════════════════════════════════════════════════════
titulo('1. Lista, mapa y conjunto');

$lista = [10, 20, 30];                         // claves 0, 1, 2
$lista[] = 40;                                 // añadir al final (como add) — O(1)
$mapa = ['ana' => 30, 'luis' => 25];           // claves de texto
$mapa['eva'] = 41;
echo 'lista: ', ver($lista), "\n";
echo 'mapa: ', ver($mapa), "\n";

// CONJUNTO: la clave es el elemento. `isset($set[$x])` es O(1); `in_array($x, $lista)` es O(n).
$set = array_flip(['rojo', 'verde', 'azul']);  // ['rojo' => 0, 'verde' => 1, 'azul' => 2]
echo "¿hay verde? ", isset($set['verde']) ? 'sí' : 'no', ' · ¿hay lila? ', isset($set['lila']) ? 'sí' : 'no', "\n";

// Las claves enteras y los strings numéricos son la MISMA clave:
$raro = [];
$raro[1] = 'a';
$raro['1'] = 'b';
$raro[true] = 'c';      // true se convierte en 1
echo 'una sola clave: ', ver($raro), "\n";

// ¿Lista o mapa? array_is_list(): ¿las claves son 0..n-1 en orden?
echo 'array_is_list: ', ver(array_is_list($lista)), ' / ', ver(array_is_list($mapa)), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 2. DESESTRUCTURAR Y SPREAD
// ════════════════════════════════════════════════════════════════════════════
titulo('2. Desestructurar y spread');

[$primero, , $tercero] = [1, 2, 3];                      // salta elementos
['nombre' => $n, 'edad' => $e] = ['nombre' => 'Ana', 'edad' => 30];
echo "{$primero} {$tercero} {$n} {$e}\n";

[$a, $b] = [1, 2];
[$a, $b] = [$b, $a];                                      // intercambio sin variable temporal
echo "a={$a} b={$b}\n";

$x = [1, 2];
$y = [...$x, 3, ...[4, 5]];                               // spread: une arrays (reindexa claves numéricas)
echo ver($y), "\n";

function sumaTodo(int ...$numeros): int                   // varargs: llegan como array
{
    return array_sum($numeros);
}
echo sumaTodo(1, 2, 3), ' ', sumaTodo(...[4, 5, 6]), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. map / filter / reduce
// ════════════════════════════════════════════════════════════════════════════
// Equivalentes a los streams de Java, pero ojo con dos detalles:
//  · array_filter CONSERVA las claves → usa array_values() si quieres una lista limpia.
//  · el orden de los argumentos de callback es distinto: array_map($fn, $array) pero
//    array_filter($array, $fn) y array_reduce($array, $fn, $inicial).
titulo('3. map / filter / reduce');

$nums = [1, 2, 3, 4, 5, 6];
$pares = array_filter($nums, fn(int $n): bool => $n % 2 === 0);
echo 'filter con claves: ', ver($pares), "\n";
echo 'filter reindexado: ', ver(array_values($pares)), "\n";
echo 'map: ', ver(array_map(fn(int $n): int => $n ** 2, $nums)), "\n";
echo 'reduce: ', array_reduce($nums, fn(int $acc, int $n): int => $acc + $n, 0), "\n";
echo 'map con claves (array_map con una sola array las conserva): ', ver(array_map(fn(int $v): int => $v * 2, ['a' => 1, 'b' => 2])), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. FILAS DE DATOS: array_column, usort y el operador <=>
// ════════════════════════════════════════════════════════════════════════════
titulo('4. Filas de datos');

$personas = [
    ['nombre' => 'Ana', 'edad' => 30, 'ciudad' => 'Madrid'],
    ['nombre' => 'Luis', 'edad' => 25, 'ciudad' => 'Sevilla'],
    ['nombre' => 'Eva', 'edad' => 30, 'ciudad' => 'Madrid'],
];
echo 'nombres: ', ver(array_column($personas, 'nombre')), "\n";
echo 'edad por nombre: ', ver(array_column($personas, 'edad', 'nombre')), "\n";

// <=> devuelve -1, 0 o 1. Comparar ARRAYS con <=> compara elemento a elemento:
// perfecto para ordenar por varios criterios (edad descendente, luego nombre).
usort($personas, fn(array $p, array $q): int => [$q['edad'], $p['nombre']] <=> [$p['edad'], $q['nombre']]);
echo 'por edad desc, nombre asc: ', ver(array_column($personas, 'nombre')), "\n";
// PHP 8 garantiza que sort/usort son ESTABLES: los empatados conservan su orden original.

// ════════════════════════════════════════════════════════════════════════════
// 5. TRAMPAS CLÁSICAS
// ════════════════════════════════════════════════════════════════════════════
titulo('5. Trampas');

// 5a. foreach por referencia: la variable se queda "enganchada" al último elemento.
$v = [1, 2, 3];
foreach ($v as &$elemento) {
    $elemento *= 2;
}
foreach ($v as $elemento) {          // reutiliza $elemento, que aún es una referencia al último
}
echo 'con la trampa: ', ver($v), "   ← el último se pisó a sí mismo\n";
$v = [1, 2, 3];
foreach ($v as &$elemento) {
    $elemento *= 2;
}
unset($elemento);                    // SIEMPRE rompe la referencia al terminar
foreach ($v as $elemento) {
}
echo 'con unset():  ', ver($v), "\n";

// 5b. in_array es O(n); dentro de un bucle da O(n²).
//     Se arregla pasando la lista a un conjunto UNA vez.
$grandes = range(1, 5);
$buscar = [2, 4, 9];
$sinConjunto = [];
foreach ($buscar as $b) {
    if (in_array($b, $grandes, true)) {      // true = comparación estricta (===). Sin él, "1e1" == "10" ¡es true!
        $sinConjunto[] = $b;
    }
}
$conjunto = array_flip($grandes);
$conConjunto = array_values(array_filter($buscar, fn(int $b): bool => isset($conjunto[$b])));
echo 'mismo resultado: ', ver($sinConjunto), ' = ', ver($conConjunto), "\n";

// 5c. array_shift reindexa TODO el array: O(n). Para una cola usa SplQueue (tema 7).
// 5d. array_merge dentro de un bucle copia el array cada vez: O(n²). Usa $acc[] = ... o el spread una vez.
// 5e. Un array "grande" como argumento NO se copia (copy-on-write), pero SÍ al modificarlo dentro.

// ════════════════════════════════════════════════════════════════════════════
// 6. GENERADORES: recorrer sin guardar todo en memoria
// ════════════════════════════════════════════════════════════════════════════
titulo('6. Generadores');

function cuadrados(int $hasta): Generator
{
    for ($i = 1; $i <= $hasta; $i++) {
        yield $i => $i ** 2;             // devuelve un valor y se "pausa" aquí hasta el siguiente foreach
    }
}
foreach (cuadrados(4) as $i => $c) {
    echo "{$i}² = {$c}  ";
}
echo "\n";
// Un generador sobre 10 millones de elementos usa memoria constante; un array, cientos de MB.
$suma = 0;
foreach (cuadrados(100000) as $c) {
    $suma += $c;
}
echo "suma de 100000 cuadrados sin crear el array: {$suma}\n";

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · agruparPor ────────────────────────────────────────────────
/**
 * Agrupa los elementos según lo que devuelva `$clave($elemento)`. El resultado es
 * clave => lista de elementos, con las claves en el orden en que aparecen por primera vez
 * y los elementos de cada grupo en su orden original.
 *
 *   agruparPor(['ana', 'luis', 'amy'], fn($s) => $s[0])   // ['a' => ['ana', 'amy'], 'l' => ['luis']]
 *
 * @param array<mixed> $items
 * @return array<int|string, list<mixed>>
 */
function agruparPor(array $items, callable $clave): array
{
    pendiente();
}

// ── Ejercicio 2 · topPalabras ───────────────────────────────────────────────
/**
 * Las $k palabras más frecuentes de un texto: palabra => veces.
 *  - Palabra = secuencia de letras (con acentos y ñ); lo demás separa. No distingue mayúsculas.
 *  - Orden: más veces primero; a igualdad, alfabético.
 *  - Si hay menos de $k palabras distintas, devuelve las que haya; con $k = 0, [].
 *
 * @return array<string, int>
 */
function topPalabras(string $texto, int $k): array
{
    pendiente();
}

// ── Ejercicio 3 · aplanar ───────────────────────────────────────────────────
/**
 * Aplana un array anidado a cualquier profundidad, en orden, como lista (claves 0, 1, 2...).
 * Los arrays vacíos desaparecen.   aplanar([1, [2, [3, [4]]], 5])  →  [1, 2, 3, 4, 5]
 *
 * @param array<mixed> $a
 * @return list<mixed>
 */
function aplanar(array $a): array
{
    pendiente();
}

// ── Ejercicio 4 · Coleccion (al estilo collect() de Laravel) ────────────────
/**
 * Una envoltura fluida sobre un array. Es INMUTABLE: cada operación devuelve una Coleccion nueva.
 *  - hacer($items): constructor estático. all(): el array interno. count() y foreach funcionan.
 *  - map($f): aplica $f a cada elemento, conservando las claves.
 *  - filter($f = null): se queda con los elementos para los que $f da true (sin $f, los "verdaderos"),
 *    y REINDEXA (lista 0, 1, 2...).
 *  - reduce($f, $inicial = null), sum(), avg() (0.0 si está vacía).
 *  - first($f = null, $defecto = null): primero (que cumpla $f) o $defecto.
 *  - sortBy($clave, $desc = false): ordena por lo que devuelva $clave($elemento); ESTABLE y reindexa.
 *  - pluck($campo): la columna $campo de cada fila (array).
 *  - groupBy($f): clave => lista de elementos (como agruparPor).
 *  - unique(): sin repetidos, conservando la primera aparición (1 y '1' son distintos). Reindexa.
 *  - take($n): los $n primeros.
 */
final class Coleccion implements Countable, IteratorAggregate
{
    /** @param array<mixed> $items */
    public function __construct(private array $items = [])
    {
        pendiente();
    }

    /** @param array<mixed> $items */
    public static function hacer(array $items = []): self
    {
        pendiente();
    }

    /** @return array<mixed> */
    public function all(): array
    {
        pendiente();
    }

    public function count(): int
    {
        pendiente();
    }

    public function getIterator(): ArrayIterator
    {
        pendiente();
    }

    public function map(callable $f): self
    {
        pendiente();
    }

    public function filter(?callable $f = null): self
    {
        pendiente();
    }

    public function reduce(callable $f, mixed $inicial = null): mixed
    {
        pendiente();
    }

    public function sum(): int|float
    {
        pendiente();
    }

    public function avg(): float
    {
        pendiente();
    }

    public function first(?callable $f = null, mixed $defecto = null): mixed
    {
        pendiente();
    }

    public function sortBy(callable $clave, bool $desc = false): self
    {
        pendiente();
    }

    public function pluck(string $campo): self
    {
        pendiente();
    }

    public function groupBy(callable $f): self
    {
        pendiente();
    }

    public function unique(): self
    {
        pendiente();
    }

    public function take(int $n): self
    {
        pendiente();
    }
}

// ── Ejercicio 5 · unicos ────────────────────────────────────────────────────
/**
 * Quita los repetidos de una lista de enteros o textos conservando el orden de la primera aparición.
 * Tiene que ser O(n): con in_array dentro de un bucle sería O(n²). Pulsa «Medir» y compruébalo.
 *
 * @param list<int|string> $xs
 * @return list<int|string>
 */
function unicos(array $xs): array
{
    pendiente();
}

// ── Ejercicio 6 · interseccion ──────────────────────────────────────────────
/**
 * Los valores de $a que también están en $b, sin repetidos y en el orden de $a. Debe ser O(n + m).
 *
 *   interseccion([3, 1, 3, 2], [2, 3, 9])  →  [3, 2]
 *
 * @param list<int> $a
 * @param list<int> $b
 * @return list<int>
 */
function interseccion(array $a, array $b): array
{
    pendiente();
}

// ── Ejercicio 7 · transponer ────────────────────────────────────────────────
/**
 * Transpone una matriz rectangular (lista de filas): las filas pasan a ser columnas.
 *   [[1, 2, 3], [4, 5, 6]]  →  [[1, 4], [2, 5], [3, 6]]
 * Ojo: `array_map(null, ...$m)` es un truco conocido pero devuelve OTRA cosa con una sola fila.
 * Una matriz vacía da [].
 *
 * @param list<list<int|float|string>> $m
 * @return list<list<int|float|string>>
 */
function transponer(array $m): array
{
    pendiente();
}

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

prueba('agruparPor', [
    'por inicial' => [[['ana', 'luis', 'amy'], fn(string $s): string => $s[0]], ['a' => ['ana', 'amy'], 'l' => ['luis']]],
    'por paridad (claves enteras)' => [[[1, 2, 3, 4, 5], fn(int $n): int => $n % 2], [1 => [1, 3, 5], 0 => [2, 4]]],
    'vacío' => [[[], fn($x) => $x], []],
    'un solo grupo' => [[['x', 'y'], fn($x) => 'todos'], ['todos' => ['x', 'y']]],
]);

prueba('topPalabras', [
    'cuenta y ordena' => [['a b a c b a', 2], ['a' => 3, 'b' => 2]],
    'desempata alfabéticamente' => [['perro gato loro', 2], ['gato' => 1, 'loro' => 1]],
    'ignora mayúsculas y signos' => [['¡Hola, hola! HOLA... adiós', 5], ['hola' => 3, 'adiós' => 1]],
    'letras con acento' => [['Él él ÉL pie', 1], ['él' => 3]],
    'k = 0' => [['a b c', 0], []],
    'texto sin palabras' => [['123 ... !!!', 3], []],
]);

prueba('aplanar', [
    'anidado' => [[[1, [2, [3, [4]]], 5]], [1, 2, 3, 4, 5]],
    'ya plano' => [[[1, 2, 3]], [1, 2, 3]],
    'vacíos' => [[[[], [[]], []]], []],
    'mezcla de tipos' => [[['a', [true, [null, 1.5]]]], ['a', true, null, 1.5]],
    'con claves de texto' => [[['x' => 1, 'y' => ['z' => 2]]], [1, 2]],
]);

$personas = [
    ['nombre' => 'Ana', 'edad' => 30, 'ciudad' => 'Madrid'],
    ['nombre' => 'Luis', 'edad' => 25, 'ciudad' => 'Sevilla'],
    ['nombre' => 'Eva', 'edad' => 30, 'ciudad' => 'Madrid'],
    ['nombre' => 'Pau', 'edad' => 41, 'ciudad' => 'Sevilla'],
];

grupo('Coleccion');
comprueba('map conserva claves', fn() => Coleccion::hacer(['a' => 1, 'b' => 2])->map(fn(int $x): int => $x * 10)->all(), ['a' => 10, 'b' => 20]);
comprueba('filter reindexa', fn() => Coleccion::hacer([1, 2, 3, 4, 5])->filter(fn(int $x): bool => $x % 2 === 1)->all(), [1, 3, 5]);
comprueba('filter sin función quita los falsos', fn() => Coleccion::hacer([0, 1, '', 'a', null, false])->filter()->all(), [1, 'a']);
comprueba('reduce', fn() => Coleccion::hacer([1, 2, 3])->reduce(fn(int $acc, int $x): int => $acc * 10 + $x, 0), 123);
comprueba('sum y avg', fn() => [Coleccion::hacer([1, 2, 3, 4])->sum(), Coleccion::hacer([1, 2, 3, 4])->avg()], [10, 2.5]);
comprueba('avg de una colección vacía', fn() => Coleccion::hacer()->avg(), 0.0);
comprueba('first', fn() => [Coleccion::hacer([5, 6, 7])->first(), Coleccion::hacer([5, 6, 7])->first(fn(int $x): bool => $x > 5), Coleccion::hacer()->first(null, 'nada')], [5, 6, 'nada']);
comprueba('sortBy descendente y estable', fn() => Coleccion::hacer($personas)->sortBy(fn(array $p): int => $p['edad'], true)->pluck('nombre')->all(), ['Pau', 'Ana', 'Eva', 'Luis']);
comprueba('sortBy ascendente', fn() => Coleccion::hacer($personas)->sortBy(fn(array $p): string => $p['nombre'])->pluck('nombre')->all(), ['Ana', 'Eva', 'Luis', 'Pau']);
comprueba('groupBy + map', fn() => Coleccion::hacer($personas)->groupBy(fn(array $p): string => $p['ciudad'])->map(fn(array $g): int => count($g))->all(), ['Madrid' => 2, 'Sevilla' => 2]);
comprueba('unique distingue 1 de "1"', fn() => Coleccion::hacer([3, 1, 3, '1', 2, 1])->unique()->all(), [3, 1, '1', 2]);
comprueba('take', fn() => Coleccion::hacer([1, 2, 3, 4])->take(2)->all(), [1, 2]);
comprueba('encadenado', fn() => Coleccion::hacer(range(1, 10))->filter(fn(int $x): bool => $x % 2 === 0)->map(fn(int $x): int => $x * $x)->sum(), 220);
comprueba('es inmutable', function () {
    $c = Coleccion::hacer([1, 2]);
    $c->map(fn(int $x): int => $x * 10);
    $c->filter(fn(int $x): bool => false);
    return $c->all();
}, [1, 2]);
comprueba('count() y foreach', function () {
    $c = Coleccion::hacer([1, 2, 3]);
    $suma = 0;
    foreach ($c as $x) {
        $suma += $x;
    }
    return [count($c), $suma];
}, [3, 6]);

prueba('unicos', [
    'enteros' => [[[3, 1, 3, 2, 1]], [3, 1, 2]],
    'textos' => [[['b', 'a', 'b', 'c', 'a']], ['b', 'a', 'c']],
    'sin repetidos' => [[[1, 2, 3]], [1, 2, 3]],
    'vacío' => [[[]], []],
    'todos iguales' => [[[7, 7, 7, 7]], [7]],
]);

prueba('interseccion', [
    'básica' => [[[3, 1, 3, 2], [2, 3, 9]], [3, 2]],
    'sin elementos comunes' => [[[1, 2], [3, 4]], []],
    'vacía' => [[[], [1, 2]], []],
    'una de las dos vacía' => [[[1, 2], []], []],
    'conserva el orden de la primera' => [[[5, 4, 3, 2, 1], [1, 3, 5]], [5, 3, 1]],
]);

prueba('transponer', [
    'rectangular' => [[[[1, 2, 3], [4, 5, 6]]], [[1, 4], [2, 5], [3, 6]]],
    'una sola fila' => [[[[1, 2, 3]]], [[1], [2], [3]]],
    'una sola columna' => [[[[1], [2], [3]]], [[1, 2, 3]]],
    'cuadrada' => [[[[1, 2], [3, 4]]], [[1, 3], [2, 4]]],
    'vacía' => [[[]], []],
]);

// Mide cómo crece el tiempo con el tamaño (pulsa «Medir», Ctrl+Alt+Enter). Con in_array dentro del bucle
// saldrá O(n²); con un conjunto (array_flip + isset), O(n).
function conRepetidos(int $n): array
{
    return array_map(static fn(int $i): int => ($i * 7919) % max(1, intdiv($n, 2)), range(0, $n - 1));
}
medir('unicos', fn(int $n): array => [conRepetidos($n)]);
medir('interseccion', fn(int $n): array => [range(0, $n - 1), range(intdiv($n, 2), $n + intdiv($n, 2))]);
