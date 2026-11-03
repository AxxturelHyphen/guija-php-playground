<?php
declare(strict_types=1);

/*
 * SOLUCIONES · Tema 6 · Búsqueda y técnicas
 */

/**
 * Búsqueda binaria (valor exacto).
 *
 * @complejidad Tiempo O(log n); espacio O(1).
 * @bigo log
 * @explicacion Invariante: si `$x` está en la lista, está entre `$bajo` y `$alto`. Cada vuelta mira el medio y
 * descarta la mitad que no puede contenerlo, así que el intervalo se divide por dos y en log₂ n pasos queda vacío.
 * Es imprescindible moverse a `$medio ± 1` (no a `$medio`), o el bucle puede no terminar nunca.
 * @alternativas La búsqueda lineal (`array_search`, `foreach`): O(n), válida si no está ordenada o si es muy
 * corta. Si buscas muchas veces sobre datos fijos que no tienen orden, una tabla hash (`array_flip` + `isset`) da O(1).
 */
function busquedaBinaria(array $ordenado, int $x): int
{
    $bajo = 0;
    $alto = count($ordenado) - 1;
    while ($bajo <= $alto) {
        $medio = intdiv($bajo + $alto, 2);
        if ($ordenado[$medio] === $x) {
            return $medio;
        }
        if ($ordenado[$medio] < $x) {
            $bajo = $medio + 1;
        } else {
            $alto = $medio - 1;
        }
    }
    return -1;
}

/**
 * Límite inferior (lower bound).
 *
 * @complejidad Tiempo O(log n); espacio O(1).
 * @bigo log
 * @explicacion Aquí el intervalo es SEMIABIERTO `[bajo, alto)` y `alto` empieza en `count` (la posición "después del
 * último" es una respuesta válida). Si `ordenado[medio] < x`, la respuesta está estrictamente a la derecha; si no,
 * `medio` podría ser la respuesta, así que se conserva (`alto = medio`). Al terminar, `bajo == alto` es la primera
 * posición con valor ≥ x. Con repetidos nunca se "salta" el primero, que es justo lo pedido.
 * @alternativas Una búsqueda binaria exacta seguida de un retroceso lineal para hallar el primer repetido: O(n)
 * en el peor caso (todos iguales).
 */
function limiteInferior(array $ordenado, int $x): int
{
    $bajo = 0;
    $alto = count($ordenado);
    while ($bajo < $alto) {
        $medio = intdiv($bajo + $alto, 2);
        if ($ordenado[$medio] < $x) {
            $bajo = $medio + 1;
        } else {
            $alto = $medio;
        }
    }
    return $bajo;
}

/**
 * Par con suma objetivo en una lista ordenada (dos punteros).
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion Con la lista ordenada, si la suma de los extremos se queda corta hay que subir el menor (puntero
 * izquierdo), y si se pasa hay que bajar el mayor (derecho): ningún otro emparejamiento del elemento descartado
 * puede dar el objetivo. Cada paso elimina un candidato, así que hay como mucho n pasos, sin memoria extra.
 * @alternativas Dos bucles anidados: O(n²). Tabla hash (como en `dosSumas`): O(n) pero con O(n) de memoria, y no
 * aprovecha que está ordenada. Para cada elemento, búsqueda binaria del complemento: O(n log n).
 */
function parSuma(array $ordenado, int $objetivo): ?array
{
    $i = 0;
    $j = count($ordenado) - 1;
    while ($i < $j) {
        $suma = $ordenado[$i] + $ordenado[$j];
        if ($suma === $objetivo) {
            return [$i, $j];
        }
        if ($suma < $objetivo) {
            $i++;
        } else {
            $j--;
        }
    }
    return null;
}

/**
 * Dos sumas con tabla hash.
 *
 * @complejidad Tiempo O(n); espacio O(n).
 * @bigo n
 * @explicacion Al visitar cada número se pregunta "¿ya vi `objetivo - n`?" con `isset` (O(1)). Si sí, ya hay par;
 * si no, se apunta `n` y su posición. Una sola pasada, y como se comprueba ANTES de guardar, un número nunca se
 * empareja consigo mismo (pero `[3, 3]` sí funciona para 6).
 * @alternativas Fuerza bruta con dos bucles: O(n²). Ordenar y usar dos punteros: O(n log n), pero hay que ordenar
 * guardando las posiciones originales.
 */
function dosSumas(array $nums, int $objetivo): ?array
{
    $vistos = [];
    foreach ($nums as $i => $n) {
        $falta = $objetivo - $n;
        if (isset($vistos[$falta])) {
            return [$vistos[$falta], $i];
        }
        $vistos[$n] = $i;
    }
    return null;
}

/**
 * Suma máxima de una ventana de tamaño k.
 *
 * @complejidad Tiempo O(n); espacio O(1).
 * @bigo n
 * @explicacion Se calcula la suma de la primera ventana y después se DESLIZA: al avanzar una posición entra
 * `a[i]` y sale `a[i - k]`, así que la nueva suma cuesta O(1) en vez de volver a sumar k elementos. Sumar cada
 * ventana desde cero costaría O(n·k), que con k = n/2 es O(n²).
 * @alternativas Con `array_slice` + `array_sum` en cada posición: correcto y muy legible, pero O(n·k). Los
 * mínimos/máximos móviles necesitan una cola doble (deque monótona) para mantener el O(n).
 */
function sumaMaximaVentana(array $a, int $k): int
{
    $n = count($a);
    if ($k < 1 || $k > $n) {
        throw new InvalidArgumentException("k debe estar entre 1 y {$n}, no {$k}");
    }
    $suma = array_sum(array_slice($a, 0, $k));
    $maxima = $suma;
    for ($i = $k; $i < $n; $i++) {
        $suma += $a[$i] - $a[$i - $k];
        if ($suma > $maxima) {
            $maxima = $suma;
        }
    }
    return $maxima;
}

/**
 * Subcadena más larga sin repetidos.
 *
 * @complejidad Tiempo O(n); espacio O(min(n, tamaño del alfabeto)).
 * @bigo n
 * @explicacion La ventana `[inicio, i]` nunca contiene repetidos. Una tabla guarda la ÚLTIMA posición de cada
 * carácter; si el carácter actual ya estaba DENTRO de la ventana, `inicio` salta justo detrás de esa posición
 * (sin retroceder jamás). Cada carácter se procesa una vez. `mb_str_split` trata cada carácter Unicode (tildes,
 * emojis) como una unidad, a diferencia de `$s[$i]`, que lee bytes.
 * @alternativas Probar todas las subcadenas y comprobar repetidos en cada una: O(n²) o O(n³).
 */
function subcadenaSinRepetir(string $s): int
{
    $ultima = [];
    $inicio = 0;
    $mejor = 0;
    foreach (mb_str_split($s) as $i => $caracter) {
        if (isset($ultima[$caracter]) && $ultima[$caracter] >= $inicio) {
            $inicio = $ultima[$caracter] + 1;
        }
        $ultima[$caracter] = $i;
        $mejor = max($mejor, $i - $inicio + 1);
    }
    return $mejor;
}

/**
 * Agrupa anagramas.
 *
 * @complejidad Tiempo O(n · k log k) con n palabras de longitud media k; espacio O(n · k).
 * @explicacion Dos palabras son anagramas si tienen las mismas letras ordenadas, así que esa forma "canónica" es la
 * clave de la tabla. Como los arrays PHP conservan el orden de inserción, los grupos salen por la primera aparición
 * sin ordenar nada. `mb_str_split` + `sort` ordena las letras Unicode correctamente.
 * @alternativas Contar las letras (un vector de 26 cuentas como clave) evita ordenar y baja a O(n·k) para alfabetos
 * pequeños. Comparar cada palabra con cada grupo: O(n²·k).
 */
function agruparAnagramas(array $palabras): array
{
    $grupos = [];
    foreach ($palabras as $palabra) {
        $letras = mb_str_split($palabra);
        sort($letras);
        $grupos[implode('', $letras)][] = $palabra;
    }
    return array_values($grupos);
}

/**
 * Sumas prefijas para consultas de rango en O(1).
 *
 * @complejidad Construir O(n); cada consulta O(1); espacio O(n).
 * @bigo 1
 * @explicacion `prefijo[i]` guarda la suma de los primeros i elementos (con `prefijo[0] = 0`), así que la suma de
 * `desde..hasta` es `prefijo[hasta + 1] - prefijo[desde]`: la parte común se cancela. El trabajo pesado se paga
 * una vez en el constructor y cada pregunta posterior es una resta.
 * @alternativas Sumar el rango en cada consulta (`array_sum(array_slice(...))`): O(n) por consulta, de modo que q
 * consultas cuestan O(n·q). Un árbol de Fenwick/segmentos si además hay que ACTUALIZAR valores.
 */
final class SumasPrefijas
{
    /** @var list<int> */
    private array $prefijo = [0];

    public function __construct(array $valores)
    {
        $acumulado = 0;
        foreach ($valores as $v) {
            $acumulado += $v;
            $this->prefijo[] = $acumulado;
        }
    }

    public function suma(int $desde, int $hasta): int
    {
        if ($desde < 0 || $hasta >= count($this->prefijo) - 1 || $desde > $hasta) {
            throw new OutOfRangeException("Rango no válido: {$desde}..{$hasta}");
        }
        return $this->prefijo[$hasta + 1] - $this->prefijo[$desde];
    }
}
