<?php
declare(strict_types=1);

/*
 * SOLUCIONES · Tema 3 · Arrays y colecciones
 */

/**
 * Agrupa elementos por una clave calculada.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @bigo n
 * @explicacion `$grupos[$clave][] = ...` crea el grupo la primera vez (PHP autovivifica el array) y añade después,
 * todo en un solo recorrido. Como PHP conserva el orden de inserción de las claves, los grupos salen en el orden
 * de primera aparición sin hacer nada más.
 * @alternativas Recorrer una vez por cada clave distinta con array_filter: O(n·k). `array_reduce` hace lo mismo pero
 * copiando el acumulador en cada paso si no se tiene cuidado.
 */
function agruparPor(array $items, callable $clave): array
{
    $grupos = [];
    foreach ($items as $item) {
        $grupos[$clave($item)][] = $item;
    }
    return $grupos;
}

/**
 * Las k palabras más frecuentes.
 *
 * @complejidad Tiempo O(n + d log d) con n palabras y d distintas; espacio O(d).
 * @explicacion `array_count_values` cuenta en O(n) con una tabla hash. Después solo hay que ordenar las d palabras
 * DISTINTAS (no las n del texto) con `uksort`: más veces primero y, a igualdad, `strcmp` para desempatar. Usar
 * `\p{L}` con el modificador `u` reconoce acentos y ñ, y `mb_strtolower` baja las mayúsculas también con tildes.
 * @alternativas Un montículo de tamaño k (SplMinHeap) da O(n + d log k), mejor si k es muy pequeño y d enorme.
 */
function topPalabras(string $texto, int $k): array
{
    preg_match_all('/\p{L}+/u', mb_strtolower($texto), $coincidencias);
    $cuentas = array_count_values($coincidencias[0]);
    uksort($cuentas, static fn(string $a, string $b): int => $cuentas[$b] <=> $cuentas[$a] ?: strcmp($a, $b));
    return array_slice($cuentas, 0, max(0, $k), true);
}

/**
 * Aplana un array anidado.
 *
 * @complejidad Tiempo O(n) con n el número total de elementos; espacio O(n + p) con p la profundidad (pila).
 * @explicacion Recursión directa: si el elemento es un array se aplana y se vuelca; si no, se añade. El caso base
 * es implícito (un array sin sub-arrays se recorre y termina). `array_push($out, ...$trozo)` añade todo el trozo
 * de una vez sin copiar `$out`.
 * @alternativas `array_walk_recursive` con un closure por referencia (más corto); o una pila explícita para evitar
 * el límite de profundidad en estructuras muy hondas.
 */
function aplanar(array $a): array
{
    $plano = [];
    foreach ($a as $elemento) {
        if (is_array($elemento)) {
            array_push($plano, ...aplanar($elemento));
        } else {
            $plano[] = $elemento;
        }
    }
    return $plano;
}

/**
 * Colección fluida e inmutable.
 *
 * @complejidad Cada operación es O(n) (excepto take, O(k)); sortBy O(n log n); espacio O(n) por cada copia.
 * @explicacion Cada método construye una Coleccion NUEVA (`new self(...)`), así que se puede encadenar sin que un
 * paso estropee a otro. `sortBy` usa `usort`, que desde PHP 8 es estable: los empates mantienen el orden original
 * (por eso `desc` invierte los operandos del `<=>` en vez de invertir la lista, lo que rompería la estabilidad).
 * `unique` usa `serialize()` como clave: sirve para cualquier valor y distingue 1 de '1', a diferencia de
 * `array_unique`, que compara en blando.
 * @alternativas Heredar de ArrayObject (menos control sobre la inmutabilidad) o usar generadores para no
 * materializar arrays intermedios en cadenas largas (lo que hace `LazyCollection` en Laravel).
 */
final class Coleccion implements Countable, IteratorAggregate
{
    /** @param array<mixed> $items */
    public function __construct(private array $items = [])
    {
    }

    public static function hacer(array $items = []): self
    {
        return new self($items);
    }

    public function all(): array
    {
        return $this->items;
    }

    public function count(): int
    {
        return count($this->items);
    }

    public function getIterator(): ArrayIterator
    {
        return new ArrayIterator($this->items);
    }

    public function map(callable $f): self
    {
        return new self(array_map($f, $this->items));
    }

    public function filter(?callable $f = null): self
    {
        return new self(array_values($f === null ? array_filter($this->items) : array_filter($this->items, $f)));
    }

    public function reduce(callable $f, mixed $inicial = null): mixed
    {
        return array_reduce($this->items, $f, $inicial);
    }

    public function sum(): int|float
    {
        return array_sum($this->items);
    }

    public function avg(): float
    {
        return $this->items === [] ? 0.0 : array_sum($this->items) / count($this->items);
    }

    public function first(?callable $f = null, mixed $defecto = null): mixed
    {
        foreach ($this->items as $item) {
            if ($f === null || $f($item)) {
                return $item;
            }
        }
        return $defecto;
    }

    public function sortBy(callable $clave, bool $desc = false): self
    {
        $items = $this->items;
        usort($items, static fn(mixed $a, mixed $b): int => $desc ? $clave($b) <=> $clave($a) : $clave($a) <=> $clave($b));
        return new self($items);
    }

    public function pluck(string $campo): self
    {
        return new self(array_column($this->items, $campo));
    }

    public function groupBy(callable $f): self
    {
        $grupos = [];
        foreach ($this->items as $item) {
            $grupos[$f($item)][] = $item;
        }
        return new self($grupos);
    }

    public function unique(): self
    {
        $vistos = [];
        $unicos = [];
        foreach ($this->items as $item) {
            $huella = serialize($item);
            if (!isset($vistos[$huella])) {
                $vistos[$huella] = true;
                $unicos[] = $item;
            }
        }
        return new self($unicos);
    }

    public function take(int $n): self
    {
        return new self(array_slice($this->items, 0, max(0, $n)));
    }
}

/**
 * Elimina repetidos conservando el orden.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @bigo n
 * @explicacion Un array PHP es una tabla hash: `isset($vistos[$x])` es O(1). Se recorre la lista una sola vez y se
 * añade cada valor la primera vez que se ve. El truco clave es usar el VALOR como CLAVE del array auxiliar.
 * @alternativas `array_values(array_unique($xs))`: correcto y corto, pero ordena internamente (O(n log n)) y
 * compara en blando. Con `in_array` dentro del bucle sería O(n²): con 10.000 elementos son 100 millones de comparaciones.
 */
function unicos(array $xs): array
{
    $vistos = [];
    $resultado = [];
    foreach ($xs as $x) {
        if (!isset($vistos[$x])) {
            $vistos[$x] = true;
            $resultado[] = $x;
        }
    }
    return $resultado;
}

/**
 * Intersección en orden de la primera lista.
 *
 * @complejidad Tiempo O(n + m); espacio O(n + m).
 * @bigo n
 * @explicacion `array_flip($b)` convierte la segunda lista en un conjunto en O(m); después cada pertenencia
 * es O(1) con `isset`. Otro conjunto auxiliar evita repetir valores de `$a` ya añadidos.
 * @alternativas Bucle doble o `in_array` por elemento: O(n·m). `array_intersect` es cómodo pero compara con `==`
 * de forma lineal. Ordenar ambas y avanzar con dos punteros: O(n log n + m log m) y sin memoria extra.
 */
function interseccion(array $a, array $b): array
{
    $enB = array_flip($b);
    $vistos = [];
    $resultado = [];
    foreach ($a as $x) {
        if (isset($enB[$x]) && !isset($vistos[$x])) {
            $vistos[$x] = true;
            $resultado[] = $x;
        }
    }
    return $resultado;
}

/**
 * Transpone una matriz.
 *
 * @complejidad Tiempo O(f·c); espacio O(f·c).
 * @explicacion Para cada columna j se toma `array_column($m, $j)`, que ya recorre las filas. Funciona también con
 * una sola fila o una sola columna. El truco `array_map(null, ...$m)` falla con una fila: sin el spread de
 * varios arrays, `array_map(null, $fila)` devuelve la fila sin transponer.
 * @alternativas Dos bucles anidados escribiendo `$t[$j][$i] = $m[$i][$j]`: igual de correcto y más explícito.
 */
function transponer(array $m): array
{
    if ($m === []) {
        return [];
    }
    return array_map(static fn(int $columna): array => array_column($m, $columna), array_keys($m[0]));
}
