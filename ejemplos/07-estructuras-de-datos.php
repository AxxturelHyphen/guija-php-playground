<?php
declare(strict_types=1);

/*
 * TEMA 7 · ESTRUCTURAS DE DATOS
 * ────────────────────────────────────────────────────────────────────────────
 * Elegir la estructura adecuada suele importar más que optimizar el código. PHP trae en
 * la librería estándar (SPL) las que conoces de java.util:
 *
 *   Java                         PHP (SPL)                     Coste típico
 *   ArrayList / array            array                         acceso O(1), añadir al final O(1)
 *   Stack / ArrayDeque (pila)    SplStack                      push, pop, top: O(1)
 *   Queue / ArrayDeque (cola)    SplQueue                      enqueue, dequeue: O(1)
 *   LinkedList                   SplDoublyLinkedList           insertar en extremos O(1)
 *   PriorityQueue                SplMinHeap / SplPriorityQueue insert, extract: O(log n)
 *   int[] (tamaño fijo)          SplFixedArray                 acceso O(1), menos memoria
 *   HashSet / HashMap            array (clave = elemento)      isset, insertar: O(1)
 *   IdentityHashMap              SplObjectStorage / WeakMap    claves que son OBJETOS
 *
 * Recuerda: `array_shift()` y `array_unshift()` son O(n) porque reindexan todo el array.
 * Para colas usa SplQueue (o dos índices), no un array con array_shift.
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
// 1. PILA (LIFO): EL ÚLTIMO EN ENTRAR ES EL PRIMERO EN SALIR
// ════════════════════════════════════════════════════════════════════════════
// Usos: deshacer/rehacer, recorrido en profundidad, evaluar expresiones, comprobar paréntesis.
titulo('1. Pila');

$pila = new SplStack();
foreach (['a', 'b', 'c'] as $letra) {
    $pila->push($letra);
}
echo 'top: ', $pila->top(), ' · tamaño: ', count($pila), "\n";
echo 'sacando: ';
while (!$pila->isEmpty()) {
    echo $pila->pop(), ' ';
}
echo "\n";
// Un array también sirve de pila: array_push / array_pop (o $a[] = x; array_pop($a)), ambos O(1).

// ════════════════════════════════════════════════════════════════════════════
// 2. COLA (FIFO): EL PRIMERO EN ENTRAR ES EL PRIMERO EN SALIR
// ════════════════════════════════════════════════════════════════════════════
// Usos: tareas pendientes, recorrido en anchura, buffers.
titulo('2. Cola');

$cola = new SplQueue();
foreach (['t1', 't2', 't3'] as $tarea) {
    $cola->enqueue($tarea);
}
echo 'atendiendo: ';
while (!$cola->isEmpty()) {
    echo $cola->dequeue(), ' ';
}
echo "\n";

// ════════════════════════════════════════════════════════════════════════════
// 3. MONTÍCULO (HEAP) Y COLA DE PRIORIDAD
// ════════════════════════════════════════════════════════════════════════════
// Un montículo mantiene "el menor (o mayor) a mano": mirar el mínimo es O(1) y insertar/extraer, O(log n).
// Se guarda en un array con una regla: los hijos del nodo i son 2i+1 y 2i+2, y un padre nunca es mayor que sus hijos.
titulo('3. Montículo y cola de prioridad');

$minHeap = new SplMinHeap();
foreach ([5, 3, 8, 1, 9, 2] as $n) {
    $minHeap->insert($n);
}
echo 'extrayendo el menor cada vez: ';
while (!$minHeap->isEmpty()) {
    echo $minHeap->extract(), ' ';
}
echo "\n";

$tareas = new SplPriorityQueue();                // saca primero la de MAYOR prioridad
$tareas->insert('escribir informe', 2);
$tareas->insert('apagar incendio', 10);
$tareas->insert('tomar café', 1);
echo 'por prioridad: ';
while (!$tareas->isEmpty()) {
    echo $tareas->extract(), ' | ';
}
echo "\n(con la misma prioridad el orden no está garantizado)\n";

// ════════════════════════════════════════════════════════════════════════════
// 4. LISTA ENLAZADA: LO QUE PASA "POR DENTRO" EN LinkedList
// ════════════════════════════════════════════════════════════════════════════
// Cada nodo guarda un valor y la referencia al siguiente. Insertar/borrar al principio es O(1) (solo cambian
// referencias) pero acceder a la posición k es O(k). En PHP rara vez la necesitas (el array es más rápido casi
// siempre), pero es el ejemplo clásico para practicar referencias: lo harás en los ejercicios.
titulo('4. Nodos enlazados');

final class Nodo
{
    public function __construct(public mixed $valor, public ?Nodo $siguiente = null)
    {
    }
}

/** Construye la lista 1 → 2 → 3 desde un array. */
function listaDesde(array $valores): ?Nodo
{
    $cabeza = null;
    foreach (array_reverse($valores) as $v) {
        $cabeza = new Nodo($v, $cabeza);          // cada nodo nuevo apunta al anterior ya construido
    }
    return $cabeza;
}

/** Recorre la lista y devuelve sus valores (con un tope por si hay un ciclo). */
function listaAArray(?Nodo $cabeza, int $limite = 1000): array
{
    $valores = [];
    for ($n = $cabeza; $n !== null && count($valores) < $limite; $n = $n->siguiente) {
        $valores[] = $n->valor;
    }
    return $valores;
}

$lista = listaDesde([1, 2, 3]);
echo 'lista: ', implode(' → ', listaAArray($lista)), "\n";
// Los objetos se pasan por "identificador": modificar $n->siguiente cambia la lista de verdad.

// ════════════════════════════════════════════════════════════════════════════
// 5. ÁRBOL BINARIO DE BÚSQUEDA (ABB)
// ════════════════════════════════════════════════════════════════════════════
// En cada nodo: todo lo de la izquierda es menor y todo lo de la derecha, mayor. Buscar, insertar y
// borrar cuestan O(altura): O(log n) si está equilibrado, O(n) si degenera en una "lista" (datos ordenados).
// El recorrido en orden (izquierda, nodo, derecha) devuelve los valores ORDENADOS.
titulo('5. Árbol binario de búsqueda');

final class NodoArbol
{
    public ?NodoArbol $izq = null;
    public ?NodoArbol $der = null;

    public function __construct(public int $valor)
    {
    }
}

function insertarEn(?NodoArbol $nodo, int $valor): NodoArbol
{
    if ($nodo === null) {
        return new NodoArbol($valor);
    }
    if ($valor < $nodo->valor) {
        $nodo->izq = insertarEn($nodo->izq, $valor);
    } elseif ($valor > $nodo->valor) {
        $nodo->der = insertarEn($nodo->der, $valor);
    }                                              // si es igual no se inserta (sin duplicados)
    return $nodo;
}

function enOrdenDe(?NodoArbol $nodo): array
{
    return $nodo === null ? [] : [...enOrdenDe($nodo->izq), $nodo->valor, ...enOrdenDe($nodo->der)];
}

$raiz = null;
foreach ([50, 30, 70, 20, 40, 60, 80] as $v) {
    $raiz = insertarEn($raiz, $v);
}
echo 'en orden: ', ver(enOrdenDe($raiz)), "\n";

// ════════════════════════════════════════════════════════════════════════════
// 6. OBJETOS COMO CLAVES
// ════════════════════════════════════════════════════════════════════════════
// Un array solo admite int/string como clave. Para "conjuntos de objetos" existen SplObjectStorage y WeakMap.
titulo('6. Objetos como claves');

$a = new stdClass();
$b = new stdClass();
$vistos = new SplObjectStorage();
$vistos[$a] = true;          // attach() está obsoleto desde PHP 8.5: se usa como un array
echo '¿a visto? ', var_export(isset($vistos[$a]), true), ' · ¿b visto? ', var_export(isset($vistos[$b]), true), "\n";

// ════════════════════════════════════════════════════════════════════════════
// EJERCICIOS
// ════════════════════════════════════════════════════════════════════════════

// ── Ejercicio 1 · parentesisBalanceados (pila) ──────────────────────────────
/**
 * ¿Están bien emparejados y anidados los paréntesis ( ), corchetes [ ] y llaves { } del texto?
 * Los demás caracteres se ignoran. Usa una pila: cada cierre debe coincidir con el último apertura sin cerrar.
 *   "a(b[c]{d})e" → true    "(]" → false    "([)]" → false    "((" → false    "" → true
 */
function parentesisBalanceados(string $texto): bool
{
    pendiente();
}

// ── Ejercicio 2 · ColaConDosPilas ───────────────────────────────────────────
/**
 * Una cola FIFO construida SOLO con dos pilas (arrays que usas con array_push/array_pop):
 * una para entrar y otra para salir. Cuando la de salida se vacía, se le pasa todo lo de la de entrada (que
 * invierte el orden). Cada elemento cambia de pila una sola vez, así que desencolar es O(1) AMORTIZADO.
 *  - desencolar() y frente() en una cola vacía lanzan UnderflowException.
 */
final class ColaConDosPilas
{
    public function encolar(mixed $valor): void
    {
        pendiente();
    }

    public function desencolar(): mixed
    {
        pendiente();
    }

    public function frente(): mixed
    {
        pendiente();
    }

    public function tamano(): int
    {
        pendiente();
    }

    public function vacia(): bool
    {
        pendiente();
    }
}

// ── Ejercicio 3 · Lista enlazada: invertir y detectar ciclos ────────────────
/**
 * Invierte la lista cambiando las referencias `siguiente` (sin crear nodos nuevos) y devuelve la nueva cabeza.
 * O(n) de tiempo y O(1) de memoria. Lista vacía → null.   1 → 2 → 3   pasa a   3 → 2 → 1
 */
function invertirLista(?Nodo $cabeza): ?Nodo
{
    pendiente();
}

/**
 * ¿La lista tiene un ciclo (algún nodo vuelve a apuntar a uno anterior)? Con el algoritmo de la tortuga y la liebre
 * de Floyd (dos referencias: una avanza de 1 en 1 y otra de 2 en 2; si hay ciclo acaban coincidiendo): O(n) de
 * tiempo y O(1) de memoria. (Con un conjunto de nodos vistos sería O(n) de memoria.)
 */
function tieneCiclo(?Nodo $cabeza): bool
{
    pendiente();
}

// ── Ejercicio 4 · ArbolBinarioBusqueda ──────────────────────────────────────
/**
 * Un ABB de enteros SIN duplicados (insertar un valor que ya está no hace nada), usando NodoArbol.
 *  - insertar($v), contiene($v): bool, tamano(): int.
 *  - enOrden(): valores ordenados de menor a mayor.
 *  - altura(): niveles del árbol (vacío = 0, un solo nodo = 1).
 *  - minimo(): el menor valor, o null si está vacío.
 */
final class ArbolBinarioBusqueda
{
    public function insertar(int $valor): void
    {
        pendiente();
    }

    public function contiene(int $valor): bool
    {
        pendiente();
    }

    public function tamano(): int
    {
        pendiente();
    }

    /** @return list<int> */
    public function enOrden(): array
    {
        pendiente();
    }

    public function altura(): int
    {
        pendiente();
    }

    public function minimo(): ?int
    {
        pendiente();
    }
}

// ── Ejercicio 5 · MinHeap (montículo mínimo propio) ─────────────────────────
/**
 * Un montículo de mínimos de enteros guardado en un array (sin usar SplMinHeap):
 *  - insertar($v): añádelo al final y "súbelo" mientras sea menor que su padre ((i-1) >> 1). O(log n).
 *  - extraerMinimo(): quita la raíz, pon el último elemento en su lugar y "bájalo" intercambiándolo con el
 *    hijo menor mientras haga falta (hijos: 2i+1 y 2i+2). O(log n).
 *  - minimo() mira la raíz sin quitarla (O(1)). Ambos, en un montículo vacío, lanzan UnderflowException.
 */
final class MinHeap
{
    public function insertar(int $valor): void
    {
        pendiente();
    }

    public function extraerMinimo(): int
    {
        pendiente();
    }

    public function minimo(): int
    {
        pendiente();
    }

    public function tamano(): int
    {
        pendiente();
    }

    public function vacio(): bool
    {
        pendiente();
    }
}

/**
 * Heap sort sencillo: mete todos los elementos en tu MinHeap y sácalos uno a uno. O(n log n).
 *
 * @param list<int> $xs
 * @return list<int>
 */
function ordenarConMonticulo(array $xs): array
{
    pendiente();
}

// ── Ejercicio 6 · CacheLRU ──────────────────────────────────────────────────
/**
 * Caché "Least Recently Used": guarda como mucho $capacidad entradas y, al pasarse, expulsa la que lleva más tiempo
 * sin usarse. Tanto obtener() como poner() cuentan como "uso".
 *  - obtener($clave): el valor, o null si no está (y la marca como la más reciente).
 *  - poner($clave, $valor): inserta o actualiza (también la marca como la más reciente) y expulsa si hace falta.
 *  - claves(): las claves de la MÁS reciente a la MÁS antigua. tamano(): cuántas hay.
 *  - capacidad menor que 1 → InvalidArgumentException.
 * Todo O(1). Pista: un array de PHP recuerda el orden de inserción; si borras una clave y la vuelves a insertar,
 * pasa al final. ¡No recorras el array para buscar la más antigua!
 */
final class CacheLRU
{
    public function __construct(private readonly int $capacidad)
    {
        pendiente();
    }

    public function obtener(string $clave): mixed
    {
        pendiente();
    }

    public function poner(string $clave, mixed $valor): void
    {
        pendiente();
    }

    /** @return list<string> */
    public function claves(): array
    {
        pendiente();
    }

    public function tamano(): int
    {
        pendiente();
    }
}

// ── Ejercicio 7 · topK con un montículo ─────────────────────────────────────
/**
 * Los $k valores MAYORES de la lista, de mayor a menor, sin ordenar toda la lista: mantén un SplMinHeap de tamaño
 * máximo k (si entra uno más grande que el mínimo, saca el mínimo). O(n log k) y memoria O(k).
 *   topK([5, 1, 9, 3, 7], 2)  →  [9, 7]       k = 0 → []       k mayor que la lista → toda, ordenada desc.
 *
 * @param list<int> $xs
 * @return list<int>
 */
function topK(array $xs, int $k): array
{
    pendiente();
}

// ════════════════════════════════════════════════════════════════════════════
// PRUEBAS
// ════════════════════════════════════════════════════════════════════════════

prueba('parentesisBalanceados', [
    'vacío' => [[''], true],
    'simple' => [['()'], true],
    'mezclados' => [['([]{})'], true],
    'con texto' => [['a(b[c]{d})e'], true],
    'cierre incorrecto' => [['(]'], false],
    'cruzados' => [['([)]'], false],
    'sin cerrar' => [['(('], false],
    'cierre de más' => [['())'], false],
    'empieza cerrando' => [[')('], false],
    'solo texto' => [['hola'], true],
    'profundo' => [[str_repeat('(', 500) . str_repeat(')', 500)], true],
]);

grupo('ColaConDosPilas');
comprueba('sale en el orden en que entra', function () {
    $c = new ColaConDosPilas();
    foreach ([1, 2, 3] as $x) {
        $c->encolar($x);
    }
    return [$c->desencolar(), $c->desencolar(), $c->desencolar()];
}, [1, 2, 3]);
comprueba('entradas y salidas intercaladas', function () {
    $c = new ColaConDosPilas();
    $c->encolar('a');
    $c->encolar('b');
    $salida = [$c->desencolar()];
    $c->encolar('c');
    $salida[] = $c->desencolar();
    $salida[] = $c->desencolar();
    return $salida;
}, ['a', 'b', 'c']);
comprueba('frente no la quita', function () {
    $c = new ColaConDosPilas();
    $c->encolar(5);
    $c->encolar(6);
    return [$c->frente(), $c->frente(), $c->tamano()];
}, [5, 5, 2]);
comprueba('vacia y tamano', function () {
    $c = new ColaConDosPilas();
    $antes = [$c->vacia(), $c->tamano()];
    $c->encolar(1);
    $c->desencolar();
    return [...$antes, $c->vacia(), $c->tamano()];
}, [true, 0, true, 0]);
comprueba('admite cualquier tipo de valor', function () {
    $c = new ColaConDosPilas();
    $c->encolar(null);
    $c->encolar([1]);
    return [$c->desencolar(), $c->desencolar()];
}, [null, [1]]);
comprueba('mismo resultado que una cola de verdad (2000 operaciones)', function () {
    $c = new ColaConDosPilas();
    $real = new SplQueue();
    $x = 7;
    for ($i = 0; $i < 2000; $i++) {
        $x = ($x * 1103515245 + 12345) & 0x7fffffff;
        if ($x % 3 !== 0 || $real->isEmpty()) {
            $c->encolar($i);
            $real->enqueue($i);
        } elseif ($c->desencolar() !== $real->dequeue()) {
            return false;
        }
    }
    return $c->tamano() === count($real);
}, true);
lanza('desencolar en vacía', fn() => (new ColaConDosPilas())->desencolar(), UnderflowException::class);
lanza('frente en vacía', fn() => (new ColaConDosPilas())->frente(), UnderflowException::class);

grupo('invertirLista');
comprueba('invierte', fn() => listaAArray(invertirLista(listaDesde([1, 2, 3, 4]))), [4, 3, 2, 1]);
comprueba('un nodo', fn() => listaAArray(invertirLista(listaDesde([9]))), [9]);
comprueba('lista vacía', fn() => invertirLista(null), null);
comprueba('no crea nodos nuevos', function () {
    $cabeza = listaDesde([1, 2, 3]);
    $cola = $cabeza->siguiente->siguiente;
    return invertirLista($cabeza) === $cola;
}, true);
comprueba('invertir dos veces devuelve la original', fn() => listaAArray(invertirLista(invertirLista(listaDesde(range(1, 50))))), range(1, 50));

grupo('tieneCiclo');
comprueba('lista normal', fn() => tieneCiclo(listaDesde([1, 2, 3, 4, 5])), false);
comprueba('lista vacía', fn() => tieneCiclo(null), false);
comprueba('un nodo', fn() => tieneCiclo(listaDesde([1])), false);
comprueba('el último apunta al segundo', function () {
    $cabeza = listaDesde([1, 2, 3, 4]);
    $cabeza->siguiente->siguiente->siguiente->siguiente = $cabeza->siguiente;
    return tieneCiclo($cabeza);
}, true);
comprueba('un nodo que se apunta a sí mismo', function () {
    $n = new Nodo(1);
    $n->siguiente = $n;
    return tieneCiclo($n);
}, true);
comprueba('lista larga sin ciclo', fn() => tieneCiclo(listaDesde(range(1, 5000))), false);

grupo('ArbolBinarioBusqueda');
comprueba('enOrden devuelve los valores ordenados', function () {
    $a = new ArbolBinarioBusqueda();
    foreach ([50, 30, 70, 20, 40, 60, 80] as $v) {
        $a->insertar($v);
    }
    return $a->enOrden();
}, [20, 30, 40, 50, 60, 70, 80]);
comprueba('contiene', function () {
    $a = new ArbolBinarioBusqueda();
    foreach ([5, 3, 8] as $v) {
        $a->insertar($v);
    }
    return [$a->contiene(3), $a->contiene(8), $a->contiene(4)];
}, [true, true, false]);
comprueba('no admite duplicados', function () {
    $a = new ArbolBinarioBusqueda();
    foreach ([5, 5, 5, 3, 3] as $v) {
        $a->insertar($v);
    }
    return [$a->tamano(), $a->enOrden()];
}, [2, [3, 5]]);
comprueba('altura de un árbol equilibrado', function () {
    $a = new ArbolBinarioBusqueda();
    foreach ([4, 2, 6, 1, 3, 5, 7] as $v) {
        $a->insertar($v);
    }
    return $a->altura();
}, 3);
comprueba('altura si se insertan ordenados (degenera en lista)', function () {
    $a = new ArbolBinarioBusqueda();
    foreach (range(1, 10) as $v) {
        $a->insertar($v);
    }
    return $a->altura();
}, 10);
comprueba('árbol vacío', fn() => (function () {
    $a = new ArbolBinarioBusqueda();
    return [$a->altura(), $a->minimo(), $a->enOrden(), $a->tamano(), $a->contiene(1)];
})(), [0, null, [], 0, false]);
comprueba('mínimo', function () {
    $a = new ArbolBinarioBusqueda();
    foreach ([8, 3, 10, 1, 6] as $v) {
        $a->insertar($v);
    }
    return $a->minimo();
}, 1);
comprueba('un nodo tiene altura 1', function () {
    $a = new ArbolBinarioBusqueda();
    $a->insertar(1);
    return $a->altura();
}, 1);

grupo('MinHeap');
comprueba('extrae en orden ascendente', function () {
    $h = new MinHeap();
    foreach ([5, 3, 8, 1, 9, 2] as $v) {
        $h->insertar($v);
    }
    $salida = [];
    while (!$h->vacio()) {
        $salida[] = $h->extraerMinimo();
    }
    return $salida;
}, [1, 2, 3, 5, 8, 9]);
comprueba('minimo no extrae', function () {
    $h = new MinHeap();
    $h->insertar(4);
    $h->insertar(2);
    return [$h->minimo(), $h->minimo(), $h->tamano()];
}, [2, 2, 2]);
comprueba('con repetidos', function () {
    $h = new MinHeap();
    foreach ([2, 2, 1, 1] as $v) {
        $h->insertar($v);
    }
    return [$h->extraerMinimo(), $h->extraerMinimo(), $h->extraerMinimo(), $h->extraerMinimo()];
}, [1, 1, 2, 2]);
comprueba('operaciones mezcladas igual que SplMinHeap (1500 ops)', function () {
    $h = new MinHeap();
    $real = new SplMinHeap();
    $x = 99;
    for ($i = 0; $i < 1500; $i++) {
        $x = ($x * 1103515245 + 12345) & 0x7fffffff;
        if ($x % 4 !== 0 || $real->isEmpty()) {
            $v = $x % 1000;
            $h->insertar($v);
            $real->insert($v);
        } elseif ($h->extraerMinimo() !== $real->extract()) {
            return false;
        }
    }
    return $h->tamano() === count($real) && ($real->isEmpty() || $h->minimo() === $real->top());
}, true);
lanza('extraer de uno vacío', fn() => (new MinHeap())->extraerMinimo(), UnderflowException::class);
lanza('minimo de uno vacío', fn() => (new MinHeap())->minimo(), UnderflowException::class);

prueba('ordenarConMonticulo', [
    'desordenada' => [[[5, 2, 9, 1, 5, 6]], [1, 2, 5, 5, 6, 9]],
    'vacía' => [[[]], []],
    'un elemento' => [[[3]], [3]],
    'negativos' => [[[0, -3, 2, -1]], [-3, -1, 0, 2]],
    'inversa' => [[range(10, 1)], range(1, 10)],
]);

grupo('CacheLRU');
comprueba('guarda y devuelve', function () {
    $c = new CacheLRU(2);
    $c->poner('a', 1);
    return [$c->obtener('a'), $c->obtener('zzz')];
}, [1, null]);
comprueba('expulsa la menos reciente', function () {
    $c = new CacheLRU(2);
    $c->poner('a', 1);
    $c->poner('b', 2);
    $c->poner('c', 3);                 // expulsa a
    return [$c->obtener('a'), $c->obtener('b'), $c->obtener('c')];
}, [null, 2, 3]);
comprueba('obtener cuenta como uso', function () {
    $c = new CacheLRU(2);
    $c->poner('a', 1);
    $c->poner('b', 2);
    $c->obtener('a');                  // ahora la más antigua es b
    $c->poner('c', 3);                 // expulsa b
    return [$c->obtener('a'), $c->obtener('b')];
}, [1, null]);
comprueba('actualizar también cuenta como uso', function () {
    $c = new CacheLRU(2);
    $c->poner('a', 1);
    $c->poner('b', 2);
    $c->poner('a', 10);                // actualiza y refresca a
    $c->poner('c', 3);                 // expulsa b
    return [$c->obtener('a'), $c->obtener('b'), $c->claves()];
}, [10, null, ['a', 'c']]);
comprueba('claves de la más reciente a la más antigua', function () {
    $c = new CacheLRU(3);
    $c->poner('a', 1);
    $c->poner('b', 2);
    $c->poner('c', 3);
    $c->obtener('a');
    return $c->claves();
}, ['a', 'c', 'b']);
comprueba('capacidad 1', function () {
    $c = new CacheLRU(1);
    $c->poner('a', 1);
    $c->poner('b', 2);
    return [$c->obtener('a'), $c->obtener('b'), $c->tamano()];
}, [null, 2, 1]);
comprueba('tamano nunca supera la capacidad', function () {
    $c = new CacheLRU(3);
    for ($i = 0; $i < 10; $i++) {
        $c->poner("k{$i}", $i);
    }
    return [$c->tamano(), $c->claves()];
}, [3, ['k9', 'k8', 'k7']]);
comprueba('igual que una versión lenta de referencia (3000 operaciones)', function () {
    $lru = new CacheLRU(5);
    $orden = [];                       // claves de menos a más reciente
    $datos = [];
    $x = 5;
    for ($i = 0; $i < 3000; $i++) {
        $x = ($x * 1103515245 + 12345) & 0x7fffffff;
        $clave = 'k' . ($x % 9);
        if ($x % 2 === 0) {
            $esperado = $datos[$clave] ?? null;
            if (isset($datos[$clave])) {
                $orden = [...array_values(array_diff($orden, [$clave])), $clave];
            }
            if ($lru->obtener($clave) !== $esperado) {
                return "obtener({$clave}) falló en la operación {$i}";
            }
        } else {
            $lru->poner($clave, $i);
            $datos[$clave] = $i;
            $orden = [...array_values(array_diff($orden, [$clave])), $clave];
            if (count($orden) > 5) {
                unset($datos[array_shift($orden)]);
            }
        }
    }
    return $lru->claves() === array_reverse($orden) ? 'ok' : 'claves distintas';
}, 'ok');
lanza('capacidad cero', fn() => new CacheLRU(0), InvalidArgumentException::class);

prueba('topK', [
    'básico' => [[[5, 1, 9, 3, 7], 2], [9, 7]],
    'k = 0' => [[[1, 2, 3], 0], []],
    'k mayor que la lista' => [[[2, 9, 4], 10], [9, 4, 2]],
    'con repetidos' => [[[4, 4, 4, 1], 2], [4, 4]],
    'negativos' => [[[-5, -1, -3], 2], [-1, -3]],
    'vacía' => [[[], 3], []],
    'k = 1' => [[[3, 8, 1], 1], [8]],
]);

// ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
function aleatoriosLista(int $n): array
{
    $resultado = [];
    $x = 12345;
    for ($i = 0; $i < $n; $i++) {
        $x = ($x * 1103515245 + 12345) & 0x7fffffff;
        $resultado[] = $x % 1_000_000;
    }
    return $resultado;
}

function cacheLlena(int $n): CacheLRU
{
    $c = new CacheLRU($n);
    for ($i = 0; $i < $n; $i++) {
        $c->poner("k{$i}", $i);
    }
    return $c;
}

medir('parentesisBalanceados', fn(int $n): array => [str_repeat('([{', intdiv($n, 3)) . str_repeat('}])', intdiv($n, 3))]);
medir('ordenarConMonticulo', fn(int $n): array => [aleatoriosLista($n)]);          // O(n log n)
medir('topK', fn(int $n): array => [aleatoriosLista($n), 10]);                      // O(n log k) con k = 10: ~O(n)
// obtener() en una caché con n entradas: O(1) si no recorres nada; O(n) si buscas la clave a mano.
medir(fn(CacheLRU $c, string $clave): mixed => $c->obtener($clave), fn(int $n): array => [cacheLlena($n), 'k' . ($n - 1)], etiqueta: 'CacheLRU');
