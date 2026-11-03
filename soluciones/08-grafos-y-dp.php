<?php
declare(strict_types=1);

/*
 * SOLUCIONES · Tema 8 · Grafos y programación dinámica
 */

/**
 * Construir una lista de adyacencia.
 *
 * @complejidad Tiempo O(E); espacio O(V + E).
 * @explicacion Se recorren las aristas una vez. `$grafo[$a][] = $b` crea la entrada de `$a` si no existía (los arrays
 * de PHP se autovivifican), pero en un grafo dirigido el destino hay que registrarlo EXPLÍCITAMENTE con
 * `??= []`, o los nodos sin salidas no aparecerían como claves. El orden de inserción del array da "orden de primera
 * aparición" gratis.
 * @alternativas Una matriz de adyacencia (V×V) ocupa O(V²) y solo compensa en grafos muy densos; buscar si existe una
 * arista concreta es O(1), pero listar los vecinos de un nodo es O(V).
 */
function construirGrafo(array $aristas, bool $dirigido = false): array
{
    $grafo = [];
    foreach ($aristas as [$a, $b]) {
        $grafo[$a][] = $b;
        if ($dirigido) {
            $grafo[$b] ??= [];
        } else {
            $grafo[$b][] = $a;
        }
    }
    return $grafo;
}

/**
 * Camino más corto en aristas (BFS).
 *
 * @complejidad Tiempo O(V + E); espacio O(V).
 * @explicacion BFS visita los nodos por distancia creciente: primero los que están a 1 arista, luego a 2... Por eso
 * la PRIMERA vez que se descubre un nodo es por un camino mínimo. Se guarda de quién se viene (`$padre`) y, al
 * llegar al destino, se reconstruye el camino hacia atrás. `$padre` hace también de conjunto de visitados. La cola
 * usa un índice de lectura en lugar de `array_shift`, que sería O(n) por llamada.
 * @alternativas DFS NO garantiza el camino más corto. Con pesos hace falta Dijkstra. BFS desde ambos extremos a la vez
 * reduce mucho el trabajo en grafos enormes.
 */
function bfsCaminoMasCorto(array $grafo, string $origen, string $destino): ?array
{
    if (!array_key_exists($origen, $grafo)) {
        return null;
    }
    $padre = [$origen => null];
    $cola = [$origen];
    for ($i = 0; $i < count($cola); $i++) {
        $nodo = $cola[$i];
        if ($nodo === $destino) {
            $camino = [];
            for ($n = $destino; $n !== null; $n = $padre[$n]) {
                $camino[] = $n;
            }
            return array_reverse($camino);
        }
        foreach ($grafo[$nodo] ?? [] as $vecino) {
            if (!array_key_exists($vecino, $padre)) {
                $padre[$vecino] = $nodo;
                $cola[] = $vecino;
            }
        }
    }
    return null;
}

/**
 * Contar islas.
 *
 * @complejidad Tiempo O(filas · columnas); espacio O(filas · columnas) en el peor caso.
 * @bigo n
 * @explicacion Cada celda se mira una vez en el bucle principal. Al encontrar tierra se suma una isla y se "hunde"
 * toda: se cambian a '0' las celdas conectadas (sobre una copia del mapa, que PHP hace por valor), así no hace falta
 * una tabla de visitados aparte. Se usa una PILA explícita en lugar de recursión porque una isla de 40.000 celdas
 * desbordaría la pila de llamadas.
 * @alternativas DFS recursivo: más corto pero frágil con mapas grandes. Union-Find (conjuntos disjuntos): útil si las
 * celdas se van añadiendo poco a poco.
 */
function contarIslas(array $mapa): int
{
    $filas = count($mapa);
    $islas = 0;
    foreach ($mapa as $f0 => $fila) {
        for ($c0 = 0, $ancho = strlen($fila); $c0 < $ancho; $c0++) {
            if ($mapa[$f0][$c0] !== '1') {
                continue;
            }
            $islas++;
            $mapa[$f0][$c0] = '0';
            $pila = [[$f0, $c0]];
            while ($pila !== []) {
                [$f, $c] = array_pop($pila);
                foreach ([[$f + 1, $c], [$f - 1, $c], [$f, $c + 1], [$f, $c - 1]] as [$nf, $nc]) {
                    if ($nf >= 0 && $nf < $filas && $nc >= 0 && $nc < strlen($mapa[$nf]) && $mapa[$nf][$nc] === '1') {
                        $mapa[$nf][$nc] = '0';
                        $pila[] = [$nf, $nc];
                    }
                }
            }
        }
    }
    return $islas;
}

/**
 * Orden topológico (algoritmo de Kahn).
 *
 * @complejidad Tiempo O(V + E); espacio O(V + E).
 * @explicacion Para cada tarea se cuenta cuántas dependencias le faltan (`$pendientes`) y se apunta quién depende de
 * ella (`$dependientes`). Las que no esperan a nadie salen primero; al sacar una, a sus dependientes les falta una menos
 * y, cuando llegan a 0, ya pueden salir. Si al acabar han salido menos tareas que las que hay, las que quedan se
 * esperan unas a otras: un CICLO. Es lo que hace Composer o un `make` para decidir el orden de instalación/compilación.
 * @alternativas DFS con tres colores (sin visitar / en curso / terminado): el orden inverso de finalización es una
 * ordenación topológica, y encontrar un nodo "en curso" delata un ciclo. También O(V + E).
 */
function ordenTopologico(array $dependencias): array
{
    $pendientes = [];
    $dependientes = [];
    foreach ($dependencias as $tarea => $deps) {
        $pendientes[$tarea] ??= 0;
        foreach ($deps as $dep) {
            $pendientes[$dep] ??= 0;
            $pendientes[$tarea]++;
            $dependientes[$dep][] = $tarea;
        }
    }
    $cola = [];
    foreach ($pendientes as $tarea => $n) {
        if ($n === 0) {
            $cola[] = (string) $tarea;
        }
    }
    $orden = [];
    for ($i = 0; $i < count($cola); $i++) {
        $tarea = $cola[$i];
        $orden[] = $tarea;
        foreach ($dependientes[$tarea] ?? [] as $siguiente) {
            if (--$pendientes[$siguiente] === 0) {
                $cola[] = (string) $siguiente;
            }
        }
    }
    if (count($orden) !== count($pendientes)) {
        throw new RuntimeException('Dependencias circulares entre: ' . implode(', ', array_diff(array_map('strval', array_keys($pendientes)), $orden)));
    }
    return $orden;
}

/**
 * Dijkstra con cola de prioridad.
 *
 * @complejidad Tiempo O((V + E) log V); espacio O(V + E).
 * @bigo nlogn
 * @explicacion Se saca siempre el nodo pendiente con menor distancia: con pesos ≥ 0 esa distancia ya es definitiva
 * (cualquier otro camino pasaría por nodos más lejanos). Se "relajan" sus aristas: si llegar a un vecino pasando por
 * aquí es más corto, se actualiza e inserta de nuevo. `SplPriorityQueue` saca la MAYOR prioridad, así que se inserta
 * `-distancia`. No hay "decrease-key": se dejan entradas viejas en la cola y se descartan al sacarlas. Con un peso
 * negativo el razonamiento se rompe, de ahí la excepción.
 * @alternativas Sin cola de prioridad, buscando el mínimo a mano: O(V²). Bellman-Ford admite pesos negativos pero
 * cuesta O(V·E). A* añade una heurística para ir hacia el destino.
 */
function dijkstra(array $grafo, string $origen): array
{
    $dist = [$origen => 0];
    $cola = new SplPriorityQueue();
    $cola->setExtractFlags(SplPriorityQueue::EXTR_BOTH);
    $cola->insert($origen, 0);
    while (!$cola->isEmpty()) {
        ['data' => $nodo, 'priority' => $prioridad] = $cola->extract();
        $d = -$prioridad;
        if ($d > $dist[$nodo]) {
            continue;                       // entrada vieja: ya se encontró un camino mejor a este nodo
        }
        foreach ($grafo[$nodo] ?? [] as $vecino => $peso) {
            if ($peso < 0) {
                throw new InvalidArgumentException("Peso negativo ({$peso}) en la arista {$nodo} → {$vecino}");
            }
            $nueva = $d + $peso;
            if (!isset($dist[$vecino]) || $nueva < $dist[$vecino]) {
                $dist[$vecino] = $nueva;
                $cola->insert((string) $vecino, -$nueva);
            }
        }
    }
    ksort($dist);
    return $dist;
}

/**
 * Subir escaleras.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion Al último peldaño se llega desde el anterior (un paso) o desde el anteanterior (dos pasos), así que
 * `formas(n) = formas(n-1) + formas(n-2)`. Como cada valor solo necesita los dos previos, no hace falta una tabla
 * entera: dos variables que se van desplazando. Con la recursión ingenua serían O(2ⁿ) llamadas.
 * @alternativas Recursión + memoización (O(n) de tiempo y de pila); exponenciación de matrices 2×2 en O(log n).
 */
function escaleras(int $n): int
{
    if ($n < 0) {
        throw new InvalidArgumentException("El número de peldaños no puede ser negativo ({$n})");
    }
    [$anterior, $actual] = [1, 1];
    for ($i = 2; $i <= $n; $i++) {
        [$anterior, $actual] = [$actual, $anterior + $actual];
    }
    return $actual;
}

/**
 * Cambio de monedas mínimo.
 *
 * @complejidad Tiempo O(objetivo · monedas); espacio O(objetivo).
 * @bigo n
 * @explicacion `$minimo[c]` es el menor número de monedas para sumar `c`. Para cada cantidad se prueba cada
 * moneda: si cabe, una solución es `minimo[c - moneda] + 1`. Se rellena de 0 a objetivo, de modo que los
 * subproblemas pequeños ya están resueltos. `PHP_INT_MAX` marca "imposible" (y hay que no sumarle 1 a eso). El
 * voraz falla con [1, 3, 4] y 6; la tabla lo encuentra siempre porque prueba TODAS las opciones por cantidad.
 * @alternativas Recursión + memo (mismo coste, usa pila). Voraz: O(monedas) pero solo correcto con sistemas
 * "canónicos" (euro, dólar) y no con cualquier conjunto de monedas.
 */
function cambioMonedas(array $monedas, int $objetivo): int
{
    if ($objetivo < 0) {
        throw new InvalidArgumentException("La cantidad no puede ser negativa ({$objetivo})");
    }
    $imposible = PHP_INT_MAX;
    $minimo = array_fill(0, $objetivo + 1, $imposible);
    $minimo[0] = 0;
    for ($c = 1; $c <= $objetivo; $c++) {
        foreach ($monedas as $moneda) {
            if ($moneda <= $c && $minimo[$c - $moneda] !== $imposible && $minimo[$c - $moneda] + 1 < $minimo[$c]) {
                $minimo[$c] = $minimo[$c - $moneda] + 1;
            }
        }
    }
    return $minimo[$objetivo] === $imposible ? -1 : $minimo[$objetivo];
}

/**
 * Mochila 0/1.
 *
 * @complejidad Tiempo O(objetos · capacidad); espacio O(capacidad).
 * @bigo n
 * @explicacion `$mejor[w]` es el mayor valor con capacidad `w` usando los objetos vistos hasta ahora. Para cada
 * objeto se actualiza cada `w` como el máximo entre NO cogerlo (`mejor[w]`) y cogerlo (`mejor[w - peso] + valor`).
 * Recorrer `w` de MAYOR a menor es clave: así `mejor[w - peso]` aún no incluye este objeto; si fuera de menor a
 * mayor se podría usar varias veces (esa es la mochila "ilimitada"). Es pseudo-polinómica: depende del VALOR de
 * la capacidad, no solo del tamaño de la entrada.
 * @alternativas Tabla de 2 dimensiones (objetos × capacidad): más fácil de reconstruir QUÉ objetos se cogen, pero
 * O(objetos · capacidad) de memoria. Fuerza bruta sobre subconjuntos: O(2ⁿ).
 */
function mochila(array $pesos, array $valores, int $capacidad): int
{
    if (count($pesos) !== count($valores)) {
        throw new InvalidArgumentException('Debe haber tantos pesos (' . count($pesos) . ') como valores (' . count($valores) . ')');
    }
    $mejor = array_fill(0, $capacidad + 1, 0);
    foreach ($pesos as $i => $peso) {
        for ($w = $capacidad; $w >= $peso; $w--) {
            $mejor[$w] = max($mejor[$w], $mejor[$w - $peso] + $valores[$i]);
        }
    }
    return $mejor[$capacidad];
}

/**
 * Subsecuencia común más larga.
 *
 * @complejidad Tiempo O(n · m); espacio O(m).
 * @bigo n2
 * @explicacion `anterior[j]` y `actual[j]` son las filas i-1 e i de la tabla completa. Si los caracteres i y j
 * coinciden, se extiende la mejor subsecuencia de los prefijos SIN ellos (la diagonal, `anterior[j-1] + 1`); si no, se
 * descarta un carácter de uno u otro texto y se queda con la mejor de las dos opciones. Como cada fila solo consulta la
 * anterior, no hace falta guardar la tabla entera. `mb_str_split` trabaja con caracteres Unicode, no con bytes.
 * @alternativas Tabla completa (n+1)×(m+1): necesaria si hay que reconstruir la subsecuencia en sí. Recursión sin memo:
 * O(2ⁿ). Para ficheros grandes, algoritmos como el de Myers (el de git diff).
 */
function lcs(string $a, string $b): int
{
    $x = mb_str_split($a);
    $y = mb_str_split($b);
    $m = count($y);
    $anterior = array_fill(0, $m + 1, 0);
    foreach ($x as $caracter) {
        $actual = [0];
        for ($j = 1; $j <= $m; $j++) {
            $actual[$j] = $caracter === $y[$j - 1]
                ? $anterior[$j - 1] + 1
                : max($anterior[$j], $actual[$j - 1]);
        }
        $anterior = $actual;
    }
    return $anterior[$m];
}

/**
 * Distancia de edición (Levenshtein).
 *
 * @complejidad Tiempo O(n · m); espacio O(m).
 * @bigo n2
 * @explicacion `anterior[j]` es la distancia entre los i-1 primeros caracteres de `$a` y los j primeros de `$b`. Cuando
 * los caracteres coinciden no cuesta nada (la diagonal); si no, es 1 más el menor de: borrar (la celda de arriba),
 * insertar (la de la izquierda) o sustituir (la diagonal). La fila 0 es `0..m` (construir `$b` desde vacío) y el
 * primer elemento de cada fila es `i` (borrar `i` caracteres). Dos filas bastan porque cada una solo mira la anterior.
 * @alternativas La función nativa `levenshtein()` (en C, bytes, y con costes configurables). Damerau-Levenshtein
 * añade las transposiciones (`ab` → `ba` cuesta 1).
 */
function distanciaEdicion(string $a, string $b): int
{
    $x = mb_str_split($a);
    $y = mb_str_split($b);
    $m = count($y);
    $anterior = range(0, $m);
    foreach ($x as $i => $caracter) {
        $actual = [$i + 1];
        for ($j = 1; $j <= $m; $j++) {
            $coste = $caracter === $y[$j - 1] ? 0 : 1;
            $actual[$j] = min($anterior[$j] + 1, $actual[$j - 1] + 1, $anterior[$j - 1] + $coste);
        }
        $anterior = $actual;
    }
    return $anterior[$m];
}
