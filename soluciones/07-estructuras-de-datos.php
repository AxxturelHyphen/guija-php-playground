<?php
declare(strict_types=1);

/*
 * SOLUCIONES · Tema 7 · Estructuras de datos
 */

/**
 * Paréntesis balanceados con una pila.
 *
 * @complejidad Tiempo O(n); espacio O(n) en el peor caso (todo son aperturas).
 * @bigo n
 * @explicacion Cada apertura se apila. Cada cierre debe coincidir con la apertura de la CIMA de la pila: si la pila
 * está vacía (cierre de más) o la cima es de otro tipo (cruce como `([)]`) ya no puede estar bien. Al final la pila
 * debe quedar vacía, o sobran aperturas. El array asociativo `$pares` evita un `if` por cada tipo de paréntesis.
 * @alternativas Quitar repetidamente `()`, `[]` y `{}` con `str_replace` hasta que no cambie nada: más corto pero
 * O(n²) en el peor caso. Con un solo tipo de paréntesis basta un contador entero (O(1) de memoria).
 */
function parentesisBalanceados(string $texto): bool
{
    $pares = [')' => '(', ']' => '[', '}' => '{'];
    $pila = [];
    foreach (str_split($texto) as $c) {
        if (in_array($c, $pares, true)) {
            $pila[] = $c;
        } elseif (isset($pares[$c])) {
            if (array_pop($pila) !== $pares[$c]) {
                return false;
            }
        }
    }
    return $pila === [];
}

/**
 * Cola con dos pilas.
 *
 * @complejidad encolar O(1); desencolar y frente O(1) amortizado (O(n) puntual al trasvasar); espacio O(n).
 * @explicacion `entrada` recibe los elementos nuevos y `salida` los entrega. Cuando `salida` se queda vacía se
 * vuelca en ella toda `entrada`: al ir sacando de una pila y metiendo en la otra el orden se INVIERTE, así que el
 * elemento más antiguo queda arriba. Cada elemento se mueve de pila como mucho una vez en toda su vida, por eso
 * n operaciones cuestan O(n) en total (O(1) amortizado) aunque alguna sola cueste O(n).
 * @alternativas `SplQueue` (lista doblemente enlazada) da O(1) real en cada operación. Un array con `array_shift`
 * sería O(n) por desencolar, porque reindexa todo.
 */
final class ColaConDosPilas
{
    /** @var list<mixed> */
    private array $entrada = [];
    /** @var list<mixed> */
    private array $salida = [];

    public function encolar(mixed $valor): void
    {
        $this->entrada[] = $valor;
    }

    public function desencolar(): mixed
    {
        $this->preparar();
        return array_pop($this->salida);
    }

    public function frente(): mixed
    {
        $this->preparar();
        return $this->salida[array_key_last($this->salida)];
    }

    public function tamano(): int
    {
        return count($this->entrada) + count($this->salida);
    }

    public function vacia(): bool
    {
        return $this->tamano() === 0;
    }

    private function preparar(): void
    {
        if ($this->salida === []) {
            if ($this->entrada === []) {
                throw new UnderflowException('La cola está vacía');
            }
            while ($this->entrada !== []) {
                $this->salida[] = array_pop($this->entrada);
            }
        }
    }
}

/**
 * Invertir una lista enlazada.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion Se recorre la lista con tres referencias: `$anterior` (ya invertido), `$actual` y el siguiente, que
 * hay que guardar ANTES de cambiar `$actual->siguiente` o se perdería el resto de la lista. En cada paso el nodo
 * actual pasa a apuntar hacia atrás. Al terminar, `$anterior` es la nueva cabeza.
 * @alternativas Recursiva: más corta pero usa O(n) de pila de llamadas y se queda sin ella con listas muy largas.
 * Volcar a un array, invertirlo y reconstruir: O(n) de memoria y crea nodos nuevos.
 */
function invertirLista(?Nodo $cabeza): ?Nodo
{
    $anterior = null;
    $actual = $cabeza;
    while ($actual !== null) {
        $siguiente = $actual->siguiente;
        $actual->siguiente = $anterior;
        $anterior = $actual;
        $actual = $siguiente;
    }
    return $anterior;
}

/**
 * Detectar ciclos (tortuga y liebre de Floyd).
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion La liebre avanza dos nodos por vuelta y la tortuga uno. Si no hay ciclo, la liebre llega al final
 * (`null`). Si lo hay, ambas acaban dando vueltas dentro de él y la liebre, que gana un nodo por vuelta, termina
 * alcanzando a la tortuga: es imposible que se salte, porque la distancia entre ellas cambia de uno en uno.
 * @alternativas Guardar los nodos visitados en un `SplObjectStorage`: O(n) de tiempo pero también O(n) de memoria.
 */
function tieneCiclo(?Nodo $cabeza): bool
{
    $lenta = $rapida = $cabeza;
    while ($rapida !== null && $rapida->siguiente !== null) {
        $lenta = $lenta->siguiente;
        $rapida = $rapida->siguiente->siguiente;
        if ($lenta === $rapida) {
            return true;
        }
    }
    return false;
}

/**
 * Árbol binario de búsqueda.
 *
 * @complejidad insertar/contiene O(h), con h la altura: O(log n) si está equilibrado, O(n) si se inserta ordenado;
 * enOrden O(n); espacio O(n).
 * @explicacion Cada nodo manda a los menores a la izquierda y a los mayores a la derecha, así que buscar y insertar
 * descienden por UNA sola rama. `enOrden` recorre izquierda-nodo-derecha, que por la propia regla entrega los
 * valores ordenados; se hace con una pila explícita para no depender de la profundidad de la recursión. La altura
 * sí es recursiva: 1 + la mayor de las alturas de sus hijos.
 * @alternativas Un árbol AVL o rojinegro se reequilibra solo y garantiza O(log n). En PHP lo habitual es un array
 * asociativo (tabla hash, O(1)) y `ksort` cuando hace falta el orden.
 */
final class ArbolBinarioBusqueda
{
    private ?NodoArbol $raiz = null;
    private int $total = 0;

    public function insertar(int $valor): void
    {
        $nuevo = new NodoArbol($valor);
        if ($this->raiz === null) {
            $this->raiz = $nuevo;
            $this->total = 1;
            return;
        }
        $nodo = $this->raiz;
        while (true) {
            if ($valor === $nodo->valor) {
                return;
            }
            if ($valor < $nodo->valor) {
                if ($nodo->izq === null) {
                    $nodo->izq = $nuevo;
                    break;
                }
                $nodo = $nodo->izq;
            } else {
                if ($nodo->der === null) {
                    $nodo->der = $nuevo;
                    break;
                }
                $nodo = $nodo->der;
            }
        }
        $this->total++;
    }

    public function contiene(int $valor): bool
    {
        for ($nodo = $this->raiz; $nodo !== null; $nodo = $valor < $nodo->valor ? $nodo->izq : $nodo->der) {
            if ($valor === $nodo->valor) {
                return true;
            }
        }
        return false;
    }

    public function tamano(): int
    {
        return $this->total;
    }

    /** @return list<int> */
    public function enOrden(): array
    {
        $resultado = [];
        $pila = [];
        $nodo = $this->raiz;
        while ($nodo !== null || $pila !== []) {
            while ($nodo !== null) {
                $pila[] = $nodo;
                $nodo = $nodo->izq;
            }
            $nodo = array_pop($pila);
            $resultado[] = $nodo->valor;
            $nodo = $nodo->der;
        }
        return $resultado;
    }

    public function altura(): int
    {
        return $this->alturaDe($this->raiz);
    }

    public function minimo(): ?int
    {
        $nodo = $this->raiz;
        while ($nodo?->izq !== null) {
            $nodo = $nodo->izq;
        }
        return $nodo?->valor;
    }

    private function alturaDe(?NodoArbol $nodo): int
    {
        return $nodo === null ? 0 : 1 + max($this->alturaDe($nodo->izq), $this->alturaDe($nodo->der));
    }
}

/**
 * Montículo de mínimos propio.
 *
 * @complejidad insertar y extraerMinimo O(log n); minimo O(1); espacio O(n).
 * @explicacion Es un árbol binario COMPLETO guardado en un array (hijos de i: 2i+1 y 2i+2; padre: (i-1)>>1) que
 * cumple que ningún padre es mayor que sus hijos. `insertar` añade al final y lo sube mientras sea menor que su
 * padre; `extraerMinimo` toma la raíz, mueve el último a su sitio y lo baja intercambiándolo con el hijo MENOR (si
 * se intercambiara con el mayor, ese hijo quedaría por debajo de un padre más grande). Ninguno recorre más de la
 * altura del árbol, que es log₂ n.
 * @alternativas `SplMinHeap` ya lo trae hecho (en C). Un array ordenado con búsqueda binaria: extraer el mínimo
 * sería O(1) pero insertar O(n).
 */
final class MinHeap
{
    /** @var list<int> */
    private array $datos = [];

    public function insertar(int $valor): void
    {
        $i = count($this->datos);
        $this->datos[] = $valor;
        while ($i > 0) {
            $padre = ($i - 1) >> 1;
            if ($this->datos[$padre] <= $this->datos[$i]) {
                break;
            }
            [$this->datos[$padre], $this->datos[$i]] = [$this->datos[$i], $this->datos[$padre]];
            $i = $padre;
        }
    }

    public function extraerMinimo(): int
    {
        if ($this->datos === []) {
            throw new UnderflowException('El montículo está vacío');
        }
        $minimo = $this->datos[0];
        $ultimo = array_pop($this->datos);
        $n = count($this->datos);
        if ($n > 0) {
            $this->datos[0] = $ultimo;
            $i = 0;
            while (true) {
                $menor = $i;
                $izq = 2 * $i + 1;
                $der = $izq + 1;
                if ($izq < $n && $this->datos[$izq] < $this->datos[$menor]) {
                    $menor = $izq;
                }
                if ($der < $n && $this->datos[$der] < $this->datos[$menor]) {
                    $menor = $der;
                }
                if ($menor === $i) {
                    break;
                }
                [$this->datos[$i], $this->datos[$menor]] = [$this->datos[$menor], $this->datos[$i]];
                $i = $menor;
            }
        }
        return $minimo;
    }

    public function minimo(): int
    {
        if ($this->datos === []) {
            throw new UnderflowException('El montículo está vacío');
        }
        return $this->datos[0];
    }

    public function tamano(): int
    {
        return count($this->datos);
    }

    public function vacio(): bool
    {
        return $this->datos === [];
    }
}

/**
 * Heap sort sencillo.
 *
 * @complejidad Tiempo O(n log n); espacio O(n).
 * @bigo nlogn
 * @explicacion n inserciones de O(log n) y n extracciones de O(log n): O(n log n). Aquí se usa `SplMinHeap` (en C)
 * para que la función no dependa de tu `MinHeap`; con el tuyo el resultado es el mismo, solo que más lento por estar
 * escrito en PHP.
 * @alternativas El heap sort "de verdad" ordena EN EL SITIO (O(1) de memoria extra) construyendo el montículo sobre
 * el propio array. Para ordenar sin más, `sort()`.
 */
function ordenarConMonticulo(array $xs): array
{
    $monticulo = new SplMinHeap();
    foreach ($xs as $x) {
        $monticulo->insert($x);
    }
    $resultado = [];
    while (!$monticulo->isEmpty()) {
        $resultado[] = $monticulo->extract();
    }
    return $resultado;
}

/**
 * Caché LRU en O(1).
 *
 * @complejidad obtener y poner O(1); espacio O(capacidad).
 * @bigo 1
 * @explicacion Un array de PHP es una tabla hash que además recuerda el orden de inserción. Para "refrescar" una
 * clave se borra y se vuelve a insertar: pasa al final, que es la posición de la más reciente. La más antigua es
 * siempre la primera, y `array_key_first` la localiza en O(1) sin recorrer nada. Es lo que en Java se haría con
 * `LinkedHashMap` (accessOrder = true).
 * @alternativas Una lista doblemente enlazada + un mapa clave→nodo (la solución clásica en otros lenguajes). Guardar
 * una marca de tiempo por clave y buscar el mínimo al expulsar: obtener sería O(1) pero poner con expulsión, O(n).
 */
final class CacheLRU
{
    /** @var array<string, mixed> */
    private array $datos = [];

    public function __construct(private readonly int $capacidad)
    {
        if ($capacidad < 1) {
            throw new InvalidArgumentException("La capacidad debe ser al menos 1, no {$capacidad}");
        }
    }

    public function obtener(string $clave): mixed
    {
        if (!array_key_exists($clave, $this->datos)) {
            return null;
        }
        $valor = $this->datos[$clave];
        unset($this->datos[$clave]);
        $this->datos[$clave] = $valor;
        return $valor;
    }

    public function poner(string $clave, mixed $valor): void
    {
        unset($this->datos[$clave]);
        $this->datos[$clave] = $valor;
        if (count($this->datos) > $this->capacidad) {
            unset($this->datos[array_key_first($this->datos)]);
        }
    }

    /** @return list<string> */
    public function claves(): array
    {
        return array_map('strval', array_reverse(array_keys($this->datos)));
    }

    public function tamano(): int
    {
        return count($this->datos);
    }
}

/**
 * Los k mayores con un montículo de tamaño k.
 *
 * @complejidad Tiempo O(n log k); espacio O(k).
 * @bigo n
 * @explicacion El montículo de MÍNIMOS guarda los k mayores vistos hasta ahora y su raíz es el menor de ellos, o
 * sea, el "umbral" que hay que superar. Un valor nuevo solo entra si supera ese umbral (y expulsa al mínimo); cada
 * entrada cuesta O(log k). Ordenar toda la lista costaría O(n log n) y O(n) de memoria, y para k pequeño es mucho más.
 * @alternativas `rsort($xs); array_slice($xs, 0, $k)`: más corto y, para listas pequeñas, probablemente más rápido
 * por estar en C. QuickSelect encuentra el k-ésimo en O(n) medio.
 */
function topK(array $xs, int $k): array
{
    if ($k <= 0) {
        return [];
    }
    $monticulo = new SplMinHeap();
    foreach ($xs as $x) {
        if (count($monticulo) < $k) {
            $monticulo->insert($x);
        } elseif ($x > $monticulo->top()) {
            $monticulo->extract();
            $monticulo->insert($x);
        }
    }
    $resultado = [];
    while (!$monticulo->isEmpty()) {
        $resultado[] = $monticulo->extract();
    }
    return array_reverse($resultado);
}
