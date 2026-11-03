<?php
declare(strict_types=1);

namespace Playground\Analysis;

use PhpToken;

defined('PG_ROOT') or exit;

/**
 * Pistas de calidad sobre el código, sin ejecutarlo: rendimiento, buenas prácticas
 * y errores típicos de quien viene de Java ("java-ismos").
 *
 * Cada pista es un diagnóstico:
 *   {source:'analysis', severity:'warning'|'info'|'hint', code, line, col, endLine, endCol,
 *    title, message, explain, fixes?:[{title, edits:[{range:{sl,sc,el,ec}, text}]}]}
 */
final class Hints
{
    private const JAVA_TYPES = [
        'int', 'long', 'short', 'byte', 'double', 'float', 'boolean', 'char', 'String', 'var', 'void', 'Integer',
        'Double', 'Boolean', 'Long', 'Character', 'Object', 'List', 'ArrayList', 'LinkedList', 'Map', 'HashMap',
        'TreeMap', 'LinkedHashMap', 'Set', 'HashSet', 'TreeSet', 'Queue', 'Deque', 'Stack', 'ArrayDeque',
        'StringBuilder', 'Optional', 'Scanner',
    ];

    private const JAVA_GENERIC = [
        'List', 'ArrayList', 'LinkedList', 'Map', 'HashMap', 'TreeMap', 'LinkedHashMap', 'Set', 'HashSet', 'TreeSet',
        'Queue', 'Deque', 'Stack', 'ArrayDeque', 'Optional', 'Iterator', 'Iterable', 'Comparator', 'Function',
        'PriorityQueue',
    ];

    private const JAVA_NEW = [
        'ArrayList' => 'un array: `$lista = [];` y `$lista[] = $x;`',
        'LinkedList' => 'un array o `SplDoublyLinkedList`',
        'HashMap' => 'un array asociativo: `$mapa = [];` y `$mapa[$clave] = $valor;`',
        'TreeMap' => 'un array asociativo y `ksort($mapa)` cuando necesites el orden',
        'LinkedHashMap' => 'un array asociativo (PHP ya mantiene el orden de inserción)',
        'HashSet' => 'un array con las claves como valores: `$set[$x] = true;` y `isset($set[$x])`',
        'TreeSet' => 'un array con claves + `ksort()`',
        'ArrayDeque' => '`SplQueue` o `SplDoublyLinkedList`',
        'Stack' => '`SplStack`',
        'PriorityQueue' => '`SplPriorityQueue` o `SplMinHeap`',
        'StringBuilder' => 'un string normal y el operador `.=` (PHP lo hace eficiente)',
        'Scanner' => '`fgets(STDIN)` para leer una línea de la entrada',
        'Random' => '`random_int($min, $max)` o `mt_rand()`',
        'Object' => '`new stdClass()` o, mejor, una clase propia',
    ];

    /** Clase.método de Java -> equivalente directo en PHP (null = solo explicación). */
    private const JAVA_STATIC = [
        'Math.max' => ['max', 'max($a, $b)'], 'Math.min' => ['min', 'min($a, $b)'], 'Math.abs' => ['abs', 'abs($x)'],
        'Math.sqrt' => ['sqrt', 'sqrt($x)'], 'Math.floor' => ['floor', 'floor($x)'], 'Math.ceil' => ['ceil', 'ceil($x)'],
        'Math.round' => ['round', 'round($x)'], 'Math.pow' => ['pow', 'pow($base, $exp) o $base ** $exp'],
        'Math.random' => ['mt_rand', 'mt_rand() / mt_getrandmax()'],
        'Integer.parseInt' => ['intval', 'intval($s) o (int) $s'], 'Double.parseDouble' => ['floatval', 'floatval($s)'],
        'String.valueOf' => ['strval', 'strval($x) o (string) $x'], 'String.join' => ['implode', 'implode($sep, $array)'],
        'Arrays.sort' => ['sort', 'sort($array)'], 'Collections.sort' => ['sort', 'sort($array)'],
        'Arrays.toString' => ['print_r', 'print_r($array) o json_encode($array)'],
        'Arrays.asList' => [null, 'un array literal: [1, 2, 3]'], 'List.of' => [null, 'un array literal: [1, 2, 3]'],
        'Objects.equals' => [null, '$a === $b'], 'Objects.isNull' => [null, '$x === null'],
        'Collections.reverse' => ['array_reverse', 'array_reverse($array)'],
        'Character.isDigit' => ['ctype_digit', 'ctype_digit($c)'], 'Character.isLetter' => ['ctype_alpha', 'ctype_alpha($c)'],
        'System.currentTimeMillis' => ['hrtime', '(int) (microtime(true) * 1000)'], 'System.exit' => ['exit', 'exit($codigo)'],
    ];

    public const JAVA_METHODS = [
        'length' => 'strlen($s) para strings o count($a) para arrays',
        'size' => 'count($a)',
        'isEmpty' => 'empty($a) o $a === []',
        'equals' => '$a === $b',
        'equalsIgnoreCase' => 'strcasecmp($a, $b) === 0',
        'toUpperCase' => 'strtoupper($s)',
        'toLowerCase' => 'strtolower($s)',
        'charAt' => '$s[$i]',
        'substring' => 'substr($s, $inicio, $largo)',
        'indexOf' => 'strpos($s, $x) para strings o array_search($x, $a) para arrays',
        'contains' => 'str_contains($s, $x) o in_array($x, $a)',
        'startsWith' => 'str_starts_with($s, $x)',
        'endsWith' => 'str_ends_with($s, $x)',
        'split' => 'explode($separador, $s)',
        'trim' => 'trim($s)',
        'replace' => 'str_replace($buscar, $nuevo, $s)',
        'add' => '$a[] = $x;',
        'append' => '$s .= $x;',
        'toString' => '(string) $x o implode()/json_encode() según el caso',
        'put' => '$mapa[$clave] = $valor;',
        'containsKey' => 'isset($mapa[$clave]) o array_key_exists($clave, $mapa)',
        'getOrDefault' => '$mapa[$clave] ?? $porDefecto',
    ];

    /** @var list<array<string,mixed>> */
    private array $out = [];
    /** @var array<int,true> tokens ya cubiertos por otra pista */
    private array $handled = [];

    public function __construct(
        private readonly Source $src,
        private readonly Parser $parser,
        private readonly Metrics $metrics,
        /** @var list<array<string,mixed>> filas de Metrics::compute()['units'] */
        private readonly array $unitRows,
    ) {
    }

    /** @return list<array<string,mixed>> */
    public function all(): array
    {
        $this->openTag();
        $this->looseComparison();
        $this->javaisms();
        $this->functionRules();
        $this->deadCode();
        $this->emptyCatch();
        $this->elseAfterReturn();
        $this->globals();

        usort($this->out, static fn(array $a, array $b): int => [$a['line'], $a['col']] <=> [$b['line'], $b['col']]);
        return $this->out;
    }

    // ───────────────────────────── utilidades ─────────────────────────────

    /**
     * @param list<array{title:string, edits:list<array{range:array<string,int>, text:string}>}> $fixes
     */
    private function add(string $code, string $severity, int $from, int $to, string $title, string $explain, array $fixes = []): void
    {
        $r = $this->src->range($from, $to);
        $this->out[] = [
            'source' => 'analysis', 'severity' => $severity, 'code' => $code,
            'line' => $r['sl'], 'col' => $r['sc'], 'endLine' => $r['el'], 'endCol' => $r['ec'],
            'title' => $title, 'message' => $title, 'explain' => $explain, 'fixes' => $fixes,
        ];
    }

    private function fix(string $title, array $range, string $text): array
    {
        return ['title' => $title, 'edits' => [['range' => $range, 'text' => $text]]];
    }

    private function id(int $i): int
    {
        return $this->src->tokens[$i]->id;
    }

    private function txt(?int $i): string
    {
        return $this->src->text($i);
    }

    /** ¿El token está justo pegado al siguiente, sin espacios? */
    private function adjacent(int $a, int $b): bool
    {
        $ta = $this->src->tokens[$a];
        return $ta->pos + strlen($ta->text) === $this->src->tokens[$b]->pos;
    }

    private function isStatementStart(int $i): bool
    {
        $p = $this->src->prev($i);
        if ($p === null) {
            return true;
        }
        $t = $this->src->tokens[$p];
        if (in_array($t->text, [';', '{', '}'], true) || $t->id === T_OPEN_TAG) {
            return true;
        }
        if ($t->text === '(') {
            $pp = $this->src->prev($p);
            return $pp !== null && $this->id($pp) === T_FOR;
        }
        return false;
    }

    // ───────────────────────────── reglas de archivo ─────────────────────────────

    private function openTag(): void
    {
        $src = $this->src;
        $open = $this->parser->openTagToken();
        if ($open === null) {
            $first = $src->tokens[0] ?? null;
            if ($first !== null && $first->id === T_INLINE_HTML && trim($first->text) !== '') {
                $this->add(
                    'php.open-tag', 'warning', 0, 0,
                    'El archivo no empieza por <?php',
                    'Todo lo que está fuera de `<?php ... ?>` PHP lo trata como texto plano y lo imprime tal cual, sin ejecutarlo. Empieza el archivo con `<?php`.',
                    [$this->fix('Añadir <?php al principio', ['sl' => 1, 'sc' => 1, 'el' => 1, 'ec' => 1], "<?php\n")],
                );
            }
            return;
        }
        if ($this->parser->strictTypesToken() === null) {
            $tag = $src->tokens[$open]->text;
            $text = str_ends_with($tag, "\n") ? "declare(strict_types=1);\n\n" : "\ndeclare(strict_types=1);\n";
            $this->add(
                'style.strict-types', 'info', $open, $open,
                'Falta declare(strict_types=1);',
                'Sin esta línea PHP convierte tipos sin avisar (`"5"` pasa a ser `5`, `"abc"` a `0` en algunos casos) y ocultas errores. Con ella PHP se comporta como Java: si una función pide `int` y le das un `string`, lanza `TypeError`. Debe ser la primera instrucción del archivo.',
                [$this->fix('Añadir declare(strict_types=1);', $src->after($open), $text)],
            );
        }
    }

    private function looseComparison(): void
    {
        foreach ($this->src->tokens as $i => $t) {
            if ($t->id === T_IS_EQUAL || $t->id === T_IS_NOT_EQUAL) {
                if ($t->text === '<>') {
                    // `new ArrayList<>()`: el `<>` de los genéricos de Java, no una comparación
                    $p = $this->src->prev($i);
                    if ($p !== null && $this->id($p) === T_STRING && in_array($this->txt($p), self::JAVA_GENERIC, true)) {
                        continue;
                    }
                }
                $strict = $t->id === T_IS_EQUAL ? '===' : '!==';
                $this->add(
                    'eq.loose', 'hint', $i, $i,
                    sprintf('Usa %s en vez de %s', $strict, $t->text),
                    sprintf('`%s` convierte los tipos antes de comparar (`0 == "a"`, `"1" == "01"`, `null == false` son verdad en distintos casos) y es fuente clásica de bugs. `%s` compara valor **y** tipo, como el `==` de Java con primitivos. Usa `%s` salvo que quieras de verdad la conversión.', $t->text, $strict, $strict),
                    [$this->fix("Cambiar por {$strict}", $this->src->range($i), $strict)],
                );
            }
        }
    }

    private function globals(): void
    {
        foreach ($this->src->tokens as $i => $t) {
            if ($t->id === T_GLOBAL) {
                $this->add(
                    'style.global', 'warning', $i, $i,
                    'Evita `global`',
                    'Una función que lee o escribe variables globales depende de algo que no se ve en su firma: es difícil de probar y de razonar. Pasa el valor como parámetro y devuélvelo con `return`.',
                );
            }
        }
    }

    // ───────────────────────────── reglas por función ─────────────────────────────

    private function functionRules(): void
    {
        $rowByLine = [];
        foreach ($this->unitRows as $row) {
            $rowByLine[$row['kind'] . ':' . $row['qname'] . ':' . $row['startLine']] = $row;
        }

        foreach ($this->parser->units as $u => $unit) {
            $idxs = $this->metrics->unitTokens($u);
            $row = $rowByLine[$unit->kind . ':' . $unit->qname() . ':' . $unit->startLine] ?? null;

            $this->typeRules($unit);
            if ($row !== null) {
                $this->complexityRules($unit, $row);
            }
            if (!$unit->hasBody()) {
                continue;
            }
            $this->performance($unit, $idxs, $row);
            if ($unit->kind === 'function') {
                $this->unusedVariables($unit, $idxs);
            }
        }
    }

    private function typeRules(Unit $unit): void
    {
        foreach ($unit->params as $p) {
            if (!$p['typed']) {
                $this->add(
                    'types.param', 'hint', $p['token'], $p['token'],
                    sprintf('Falta el tipo del parámetro %s de %s()', $p['name'], $unit->name),
                    'Declarar el tipo (`int $n`, `string $s`, `array $items`, `?Cuenta $c`...) documenta la función y, con `strict_types`, PHP lo comprueba en cada llamada. En Java los tipos son obligatorios: aquí son opcionales pero muy recomendables.',
                );
            }
        }
        if (!$unit->hasReturnType && !in_array(strtolower($unit->name), ['__construct', '__destruct', '__clone'], true)) {
            $this->add(
                'types.return', 'hint', $unit->nameToken, $unit->nameToken,
                sprintf('Falta el tipo de retorno de %s()', $unit->name),
                'Añade `: int`, `: string`, `: array`, `: void`... después de los paréntesis. Si no devuelve nada, `: void`.',
            );
        }
    }

    /** @param array<string,mixed> $row */
    private function complexityRules(Unit $unit, array $row): void
    {
        $tok = $unit->nameToken;
        $name = $unit->qname() . '()';
        if ($row['cc'] > 20) {
            $this->add('cx.cyclomatic', 'warning', $tok, $tok, sprintf('%s: complejidad ciclomática muy alta (%d, nota %s)', $name, $row['cc'], $row['grade']),
                'La complejidad ciclomática cuenta los caminos independientes del código (cada `if`, bucle, `case`, `&&`, `||`, `?`...). Por encima de 20 es muy difícil de probar y de entender. Divide la función en funciones más pequeñas, cada una con una sola responsabilidad.');
        } elseif ($row['cc'] > 10) {
            $this->add('cx.cyclomatic', 'info', $tok, $tok, sprintf('%s: complejidad ciclomática alta (%d, nota %s)', $name, $row['cc'], $row['grade']),
                'Más de 10 caminos independientes: ya cuesta probarla entera. Busca bloques que puedas extraer a su propia función o condiciones que simplificar con *early return*.');
        }
        if ($row['cognitive'] > 15) {
            $this->add('cx.cognitive', 'warning', $tok, $tok, sprintf('%s: complejidad cognitiva %d', $name, $row['cognitive']),
                'La complejidad cognitiva mide lo difícil que es **leer** el código: penaliza el anidamiento. Por encima de 15 conviene reducir niveles con *early return* (`if (!cond) return;`) y extraer funciones.');
        }
        if ($row['nesting'] > 3) {
            $this->add('cx.nesting', 'info', $tok, $tok, sprintf('%s: %d niveles de anidamiento', $name, $row['nesting']),
                'Más de 3 estructuras de control dentro de otras cuesta seguir. Sal pronto con `return`/`continue` en vez de anidar `else`, o extrae el bloque interno a una función.');
        }
        if ($row['loc'] > 50) {
            $this->add('cx.length', 'info', $tok, $tok, sprintf('%s: %d líneas de código', $name, $row['loc']),
                'Una función larga suele hacer varias cosas. Prueba a separarla en pasos con nombre claro.');
        }
        if ($row['params'] > 5) {
            $this->add('cx.params', 'info', $tok, $tok, sprintf('%s: %d parámetros', $name, $row['params']),
                'Muchos parámetros son difíciles de recordar y de ordenar bien. Agrúpalos en un objeto (un *value object* o un `readonly class`) o usa argumentos con nombre.');
        }
        if (($row['recursive'] ?? false) && ($row['bigOKey'] ?? '') === 'exp' && str_contains(implode(' ', $row['bigOWhy']), 'sin memoización')) {
            $this->add('perf.recursion', 'warning', $tok, $tok, sprintf('%s: recursión exponencial sin memoización', $name),
                'Varias llamadas recursivas sobre `n-1`, `n-2`... recalculan los mismos subproblemas una y otra vez. Guarda los resultados ya calculados en un array (`$memo[$n]`) o usa una versión iterativa: pasa de O(2ⁿ) a O(n).');
        }
    }

    /** @param list<int> $idxs @param array<string,mixed>|null $row */
    private function performance(Unit $unit, array $idxs, ?array $row): void
    {
        $src = $this->src;
        $depth = $this->metrics->loopDepth($idxs);

        foreach ($idxs as $i) {
            $t = $src->tokens[$i];
            if ($t->id !== T_STRING || !$src->is($src->next($i), '(') || $src->is($src->prev($i), T_OBJECT_OPERATOR)
                || $src->is($src->prev($i), T_DOUBLE_COLON) || $src->is($src->prev($i), T_NEW)) {
                continue;
            }
            $name = strtolower($t->text);
            $inLoop = $depth($i) > 0;

            if ($inLoop && ($name === 'in_array' || $name === 'array_search')) {
                $this->add('perf.in-array-loop', 'warning', $i, $i, sprintf('%s() dentro de un bucle: O(n²)', $t->text),
                    '`' . $t->text . '()` recorre el array entero en cada llamada; dentro de un bucle el coste se multiplica. Guarda los valores como **claves** (`$vistos[$x] = true;` o `array_flip($lista)`) y comprueba con `isset($vistos[$x])`, que es O(1). Es el equivalente a usar un `HashSet` en vez de un `ArrayList.contains()`.');
            } elseif ($inLoop && ($name === 'array_shift' || $name === 'array_unshift')) {
                $this->add('perf.shift-loop', 'warning', $i, $i, sprintf('%s() dentro de un bucle: O(n²)', $t->text),
                    'Quitar o poner al principio de un array reindexa todos los elementos: O(n) cada vez. Para una cola usa `SplQueue` (O(1)) o recorre el array con un índice que avanza.');
            } elseif ($inLoop && in_array($name, ['sort', 'usort', 'rsort', 'ksort', 'asort', 'uasort'], true)) {
                $this->add('perf.sort-loop', 'warning', $i, $i, sprintf('%s() dentro de un bucle', $t->text),
                    'Ordenar cuesta O(n log n) y aquí se repite en cada vuelta. Si puedes, ordena una sola vez fuera del bucle, o usa una estructura que mantenga el orden (`SplMinHeap`, `SplPriorityQueue`).');
            } elseif ($inLoop && $name === 'array_merge' && $this->isSelfAccumulation($i)) {
                $this->add('perf.merge-loop', 'warning', $i, $i, 'array_merge() acumulando dentro de un bucle: O(n²)',
                    '`$x = array_merge($x, ...)` copia todo `$x` en cada vuelta. Añade con `$x[] = $valor;` o, para varios, `array_push($x, ...$otros)` / `$x = [...$x, ...$otros]` una sola vez al final.');
            }
        }
    }

    /** `$x = array_merge($x, ...)` */
    private function isSelfAccumulation(int $callTok): bool
    {
        $src = $this->src;
        $eq = $src->prev($callTok);
        $var = $eq !== null ? $src->prev($eq) : null;
        if (!$src->is($eq, '=') || $var === null || $this->id($var) !== T_VARIABLE) {
            return false;
        }
        $po = $src->next($callTok);
        $first = $po !== null ? $src->next($po) : null;
        return $first !== null && $this->id($first) === T_VARIABLE && $this->txt($first) === $this->txt($var);
    }

    /** @param list<int> $idxs */
    private function unusedVariables(Unit $unit, array $idxs): void
    {
        $src = $this->src;
        $count = [];
        $first = [];
        foreach ($idxs as $i) {
            $t = $src->tokens[$i];
            if ($t->text === '$' || $t->id === T_DOLLAR_OPEN_CURLY_BRACES || ($t->id === T_STRING && in_array(strtolower($t->text), ['compact', 'extract', 'get_defined_vars', 'eval'], true))) {
                return; // uso dinámico de variables: no se puede saber
            }
            if ($t->id === T_VARIABLE) {
                $count[$t->text] = ($count[$t->text] ?? 0) + 1;
                $first[$t->text] ??= $i;
            }
        }
        $paramNames = array_column($unit->params, 'name');
        foreach ($count as $name => $n) {
            if ($n !== 1 || $name === '$this' || str_starts_with($name, '$_')) {
                continue;
            }
            $i = $first[$name];
            if (in_array($name, $paramNames, true)) {
                $p = $unit->params[array_search($name, $paramNames, true)];
                if (!$p['promoted']) {
                    $this->add('unused.param', 'hint', $i, $i, sprintf('Parámetro %s sin usar en %s()', $name, $unit->name),
                        'Este parámetro nunca se lee dentro de la función. Si no hace falta, quítalo; si lo exige una interfaz, ignora este aviso.');
                }
                continue;
            }
            $next = $src->next($i);
            $prev = $src->prev($i);
            $assigned = $next !== null && $src->tokens[$next]->text === '=';
            $isStatic = $prev !== null && in_array($this->id($prev), [T_STATIC, T_GLOBAL, T_AS, T_DOUBLE_ARROW], true);
            if ($assigned && !$isStatic) {
                $this->add('unused.var', 'hint', $i, $i, sprintf('%s se asigna pero nunca se usa', $name),
                    'Esta variable recibe un valor y después no se lee en ningún sitio. Puede ser código sobrante o un olvido (¿querías usarla en un `return`?).');
            }
        }
    }

    // ───────────────────────────── estructura ─────────────────────────────

    private function deadCode(): void
    {
        $src = $this->src;
        $stop = [T_RETURN, T_THROW, T_BREAK, T_CONTINUE];
        $skipNext = [T_CASE, T_DEFAULT, T_ENDIF, T_ENDWHILE, T_ENDFOR, T_ENDFOREACH, T_ENDSWITCH, T_ELSE, T_ELSEIF,
            T_FUNCTION, T_CLASS, T_INTERFACE, T_TRAIT, T_ENUM, T_ABSTRACT, T_FINAL, T_READONLY, T_CLOSE_TAG, T_CATCH, T_FINALLY];

        foreach ($src->tokens as $i => $t) {
            if (!in_array($t->id, $stop, true)) {
                continue;
            }
            $p = $src->prev($i);
            if ($p !== null) {
                $pt = $src->tokens[$p];
                if (!in_array($pt->text, [';', '{', '}', ':'], true) && $pt->id !== T_OPEN_TAG) {
                    continue; // `if (x) return;` o `else return;`: el return es el cuerpo de otra sentencia
                }
                if ($pt->text === ':' && $this->isTernaryColon($p)) {
                    continue;
                }
            }
            $end = $this->parser->statementEnd($i);
            $n = $src->next($end);
            if ($n === null) {
                continue;
            }
            $nt = $src->tokens[$n];
            if ($nt->text === '}' || in_array($nt->id, $skipNext, true)) {
                continue;
            }
            $nEnd = $this->parser->statementEnd($n);
            $kw = strtolower($t->text);
            $this->add(
                'flow.unreachable', 'warning', $n, min($nEnd, $src->count() - 1),
                'Código inalcanzable',
                sprintf('Después de `%s` la ejecución no continúa en este bloque, así que esto no se ejecutará nunca. Bórralo o mueve el `%s`.', $kw, $kw),
                [$this->fix('Eliminar el código inalcanzable', $src->range($n, min($nEnd, $src->count() - 1)), '')],
            );
        }
    }

    private function isTernaryColon(int $colon): bool
    {
        // Un `:` de ternario tiene un `?` antes al mismo nivel; el de `case X:` / `default:` / tipo de retorno, no.
        $src = $this->src;
        for ($i = $colon - 1, $depth = 0; $i >= 0 && $i > $colon - 60; $i--) {
            $t = $src->tokens[$i];
            if ($t->text === ')' || $t->text === ']' || $t->text === '}') {
                $depth++;
            } elseif ($t->text === '(' || $t->text === '[' || $t->text === '{') {
                if ($depth === 0) {
                    return false;
                }
                $depth--;
            } elseif ($depth === 0) {
                if ($t->text === ';' || $t->id === T_CASE || $t->id === T_DEFAULT) {
                    return false;
                }
                if ($t->text === '?') {
                    return true;
                }
            }
        }
        return false;
    }

    private function emptyCatch(): void
    {
        $src = $this->src;
        foreach ($src->tokens as $i => $t) {
            if ($t->id !== T_CATCH) {
                continue;
            }
            $po = $src->next($i);
            if (!$src->is($po, '(') || !isset($this->parser->parenMatch[$po])) {
                continue;
            }
            $open = $src->next($this->parser->parenMatch[$po]);
            if (!$src->is($open, '{') || !isset($this->parser->braceMatch[$open])) {
                continue;
            }
            $close = $this->parser->braceMatch[$open];
            $empty = true;
            for ($k = $open + 1; $k < $close; $k++) {
                if ($src->tokens[$k]->id !== T_WHITESPACE) {
                    $empty = false; // hay código o un comentario que explica por qué se ignora
                    break;
                }
            }
            if ($empty) {
                $this->add('flow.empty-catch', 'warning', $i, $close, 'catch vacío: el error se ignora en silencio',
                    'Si capturas una excepción y no haces nada, el fallo desaparece y luego es muy difícil saber qué pasó. Como mínimo regístralo, relánzalo (`throw $e;`) o añade un comentario explicando por qué es seguro ignorarlo.');
            }
        }
    }

    private function elseAfterReturn(): void
    {
        $src = $this->src;
        foreach ($src->tokens as $i => $t) {
            if ($t->id !== T_ELSE) {
                continue;
            }
            $next = $src->next($i);
            if (!$src->is($next, '{')) {
                continue; // `else if` y else sin llaves: se dejan
            }
            $close = $src->prev($i);
            if (!$src->is($close, '}')) {
                continue;
            }
            $open = array_search($close, $this->parser->braceMatch, true);
            if ($open === false) {
                continue;
            }
            $last = $this->lastStatementStart((int) $open, $close);
            if ($last !== null && in_array($this->id($last), [T_RETURN, T_THROW, T_CONTINUE, T_BREAK], true)) {
                $this->add('flow.else-after-return', 'hint', $i, $i, 'else innecesario después de return',
                    'El bloque anterior termina saliendo de la función (o del bucle), así que el `else` sobra: puedes quitarlo y dejar su contenido sin sangrar. Es el patrón *early return* y deja el código más plano.');
            }
        }
    }

    /** Primer token de la última sentencia de un bloque { ... } (solo nivel 0 del bloque). */
    private function lastStatementStart(int $open, int $close): ?int
    {
        $src = $this->src;
        $depth = 0;
        $start = null;
        $atStart = true;
        for ($i = $open + 1; $i < $close; $i++) {
            $t = $src->tokens[$i];
            if (!Source::isSignificant($t)) {
                continue;
            }
            if ($atStart && $depth === 0) {
                $start = $i;
                $atStart = false;
            }
            if ($t->text === '{' || $t->text === '(' || $t->text === '[') {
                $depth++;
            } elseif ($t->text === '}' || $t->text === ')' || $t->text === ']') {
                $depth--;
                if ($depth === 0 && $t->text === '}') {
                    $atStart = true; // un bloque cerrado también acaba una sentencia (if {...})
                }
            } elseif ($t->text === ';' && $depth === 0) {
                $atStart = true;
            }
        }
        return $start;
    }

    // ───────────────────────────── java-ismos ─────────────────────────────

    private function javaisms(): void
    {
        $src = $this->src;
        $n = $src->count();

        for ($i = 0; $i < $n; $i++) {
            $t = $src->tokens[$i];
            if (isset($this->handled[$i])) {
                continue;
            }

            switch ($t->id) {
                case T_FOREACH:
                    $this->javaForeach($i);
                    break;

                case T_STRING:
                    $this->javaString($i);
                    break;

                case T_NEW:
                    $this->javaNew($i);
                    break;

                case T_CATCH:
                    $this->javaCatch($i);
                    break;

                default:
                    if ($t->text === '+') {
                        $this->javaConcat($i);
                    } elseif ($t->text === '.') {
                        $this->javaDot($i);
                    }
            }
        }
    }

    private function javaForeach(int $i): void
    {
        $src = $this->src;
        $po = $src->next($i);
        if (!$src->is($po, '(') || !isset($this->parser->parenMatch[$po])) {
            return;
        }
        $pc = $this->parser->parenMatch[$po];
        $type = $src->next($po);
        $ident = $type !== null ? $src->next($type) : null;
        $colon = $ident !== null ? $src->next($ident) : null;
        if ($type === null || $ident === null || $colon === null || $this->id($type) !== T_STRING
            || $this->id($ident) !== T_STRING || !$src->is($colon, ':')) {
            return;
        }
        $this->handled[$type] = $this->handled[$ident] = $this->handled[$colon] = true;
        $exprStart = $src->next($colon);
        if ($exprStart === null || $exprStart >= $pc) {
            return;
        }
        $expr = trim(substr($src->code, $src->tokens[$exprStart]->pos, $src->tokens[$pc]->pos - $src->tokens[$exprStart]->pos));
        if (preg_match('/^[A-Za-z_]\w*$/', $expr)) {
            $expr = '$' . $expr;
        }
        $replacement = sprintf('%s as $%s', $expr, $this->txt($ident));
        $this->add(
            'java.foreach', 'warning', $type, $pc - 1,
            'foreach de Java: en PHP es `foreach ($lista as $x)`',
            sprintf('En Java se escribe `for (String s : lista)`. En PHP la forma es `foreach ($lista as $s)`: primero la colección, luego `as` y la variable (con `$`), sin tipo.'),
            [$this->fix("Reescribir como foreach ({$replacement})", $src->range($src->next($po), $pc - 1), $replacement)],
        );
    }

    private function javaString(int $i): void
    {
        $src = $this->src;
        $t = $src->tokens[$i];
        $next = $src->next($i);
        $nextTok = $next !== null ? $src->tokens[$next] : null;

        // System.out.println(...)
        if ($t->text === 'System' && $src->is($next, '.')) {
            $out = $src->next($next);
            $dot2 = $out !== null ? $src->next($out) : null;
            $m = $dot2 !== null ? $src->next($dot2) : null;
            if ($out !== null && $m !== null && $this->txt($out) === 'out' && $src->is($dot2, '.')
                && in_array($this->txt($m), ['println', 'print', 'printf'], true)) {
                foreach ([$i, $next, $out, $dot2, $m] as $k) {
                    $this->handled[$k] = true;
                }
                $isPrintf = $this->txt($m) === 'printf';
                $this->add(
                    'java.println', 'warning', $i, $m,
                    sprintf('System.out.%s no existe en PHP', $this->txt($m)),
                    $isPrintf
                        ? '`printf("%d", $x)` existe tal cual en PHP, sin `System.out.`.'
                        : 'En PHP se imprime con `echo`: `echo "Hola", PHP_EOL;` (o `echo "Hola\n";`). `println` añade un salto de línea; en PHP lo pones tú con `"\n"` o `PHP_EOL`.',
                    [$this->fix($isPrintf ? 'Quitar System.out.' : 'Cambiar por echo', $src->range($i, $m), $isPrintf ? 'printf' : 'echo')],
                );
                return;
            }
        }

        // Math.max(...), Integer.parseInt(...), Arrays.sort(...)
        if ($src->is($next, '.')) {
            $m = $src->next($next);
            if ($m !== null && $this->id($m) === T_STRING && $src->is($src->next($m), '(')) {
                $key = $t->text . '.' . $this->txt($m);
                if (isset(self::JAVA_STATIC[$key])) {
                    [$fn, $php] = self::JAVA_STATIC[$key];
                    foreach ([$i, $next, $m] as $k) {
                        $this->handled[$k] = true;
                    }
                    $this->add(
                        'java.static', 'warning', $i, $m,
                        sprintf('`%s` es de Java', $key),
                        sprintf('PHP no tiene la clase `%s`. El equivalente es %s.', $t->text, '`' . $php . '`'),
                        $fn !== null && $fn !== 'hrtime' ? [$this->fix("Cambiar por {$fn}()", $src->range($i, $m), $fn)] : [],
                    );
                    return;
                }
            }
        }

        // Tipo + identificador sin $: `String nombre`, `int i`
        if ($nextTok !== null && $nextTok->id === T_STRING && $next !== null) {
            $isType = in_array($t->text, self::JAVA_TYPES, true);
            $after = $src->next($next);
            $afterText = $this->txt($after);
            $prev = $src->prev($i);
            $prevId = $prev !== null ? $this->id($prev) : null;
            if ($prevId === T_NEW || $prevId === T_FUNCTION || $prevId === T_INSTANCEOF || $prevId === T_CLASS
                || $prevId === T_INTERFACE || $prevId === T_TRAIT || $prevId === T_ENUM || $prevId === T_NAMESPACE || $prevId === T_CONST) {
                return;
            }
            $this->handled[$i] = $this->handled[$next] = true;
            $ident = $nextTok->text;

            if ($afterText === '(') {
                // Método estilo Java: `public static void main(String[] args)` / `int suma(int a, int b)`
                $isMain = $ident === 'main';
                $this->add(
                    'java.method', 'warning', $i, $next,
                    $isMain ? 'No hay `main` en PHP' : sprintf('Función estilo Java: `%s %s(...)`', $t->text, $ident),
                    $isMain
                        ? 'En PHP no existe un método `main`: el archivo se ejecuta de arriba abajo. Pon directamente el código que irías a poner dentro del `main`.'
                        : sprintf('En PHP las funciones se declaran con la palabra `function` y el tipo de retorno va **después** de los paréntesis: `function %s(int $a, int $b): %s { ... }`. Dentro de una clase puedes poner `public static function ...`.', $ident, $t->text === 'void' ? 'void' : 'int'),
                );
                return;
            }

            $startStmt = $this->isStatementStart($i);
            $afterOk = in_array($afterText, ['=', ';', ',', ')', ':'], true);
            if ($isType && $afterOk) {
                if ($startStmt && $prevId !== T_FINAL) {
                    $this->add(
                        'java.decl', 'warning', $i, $next,
                        sprintf('`%s %s`: en PHP no se declara el tipo y la variable lleva $', $t->text, $ident),
                        sprintf('En Java declaras `%s %s = ...;`. En PHP las variables **siempre** empiezan por `$` y no llevan tipo delante: `$%s = ...;`. (El tipo solo se pone en parámetros, retornos y propiedades de clase.)', $t->text, $ident, $ident),
                        [$this->fix("Cambiar por \${$ident}", $src->range($i, $next), '$' . $ident)],
                    );
                } else {
                    $this->add(
                        'java.param', 'warning', $next, $next,
                        sprintf('Falta el $ en `%s`', $ident),
                        sprintf('Las variables y parámetros de PHP llevan `$`: `%s $%s`.', $t->text, $ident),
                        [$this->fix("Cambiar por \${$ident}", $src->range($next), '$' . $ident)],
                    );
                }
            } elseif ($isType) {
                $this->add('java.decl', 'warning', $i, $next, sprintf('`%s %s`: no es sintaxis PHP', $t->text, $ident),
                    'Las variables de PHP llevan `$` y no se declara el tipo delante. Ejemplo: `$' . $ident . ' = ...;`.');
            }
            return;
        }

        // Genéricos: List<String>
        if ($next !== null && $nextTok->text === '<' && in_array($t->text, self::JAVA_GENERIC, true)) {
            $this->add(
                'java.generic', 'warning', $i, $i,
                sprintf('PHP no tiene genéricos (`%s<...>`)', $t->text),
                'No existen los tipos genéricos. Usa un `array` y, si quieres documentar qué contiene, un comentario PHPDoc: `/** @var list<string> $nombres */` (lo entienden PHPStan y los IDE, PHP lo ignora).',
            );
            return;
        }

        // `i++`, `i = 5` sin $ (solo al empezar una sentencia, para no confundir con constantes)
        if ($next !== null && $this->isStatementStart($i)) {
            $assignOps = [T_INC, T_DEC, T_PLUS_EQUAL, T_MINUS_EQUAL, T_MUL_EQUAL, T_DIV_EQUAL, T_CONCAT_EQUAL, T_MOD_EQUAL];
            if (in_array($nextTok->id, $assignOps, true) || $nextTok->text === "=") {
                $this->add(
                    "java.dollar", "warning", $i, $i,
                    sprintf("¿Falta el $ en `%s`?", $t->text),
                    sprintf("En PHP todas las variables empiezan por `$`: `$%s`. Sin él PHP cree que `%s` es una constante o una función.", $t->text, $t->text),
                    [$this->fix('Cambiar por $' . $t->text, $src->range($i), '$' . $t->text)],
                );
            }
        }
    }

    private function javaNew(int $i): void
    {
        $src = $this->src;
        $c = $src->next($i);
        if ($c === null || $this->id($c) !== T_STRING) {
            return;
        }
        $name = $this->txt($c);
        if (!isset(self::JAVA_NEW[$name])) {
            return;
        }
        $this->handled[$c] = true;
        $this->add(
            'java.new', 'warning', $i, $c,
            sprintf('`new %s` no existe en PHP', $name),
            sprintf('PHP no tiene la clase `%s`. En su lugar se usa %s.', $name, self::JAVA_NEW[$name]),
        );
    }

    private function javaCatch(int $i): void
    {
        $src = $this->src;
        $po = $src->next($i);
        if (!$src->is($po, '(')) {
            return;
        }
        $type = $src->next($po);
        $var = $type !== null ? $src->next($type) : null;
        if ($type !== null && $var !== null && $this->id($type) === T_STRING && $this->id($var) === T_STRING
            && $src->is($src->next($var), ')')) {
            $this->handled[$type] = $this->handled[$var] = true;
            $name = $this->txt($var);
            $this->add(
                'java.catch', 'warning', $var, $var,
                sprintf('Falta el $ en `catch (%s %s)`', $this->txt($type), $name),
                sprintf('La variable de la excepción también lleva `$`: `catch (%s $%s)`. (Desde PHP 8 puedes incluso omitirla si no la usas: `catch (%s)`.)', $this->txt($type), $name, $this->txt($type)),
                [$this->fix("Cambiar por \${$name}", $src->range($var), '$' . $name)],
            );
        }
    }

    /** `"texto" + $x` */
    private function javaConcat(int $i): void
    {
        $src = $this->src;
        $p = $src->prev($i);
        $n = $src->next($i);
        if ($p === null || $n === null) {
            return;
        }
        $strings = [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE];
        $prevIsStr = in_array($this->id($p), $strings, true) || $src->tokens[$p]->text === '"';
        $nextIsStr = in_array($this->id($n), $strings, true) || $src->tokens[$n]->text === '"';
        if (!$prevIsStr && !$nextIsStr) {
            return;
        }
        $this->add(
            'java.concat', 'warning', $i, $i,
            'Para concatenar strings se usa `.`, no `+`',
            'En PHP el operador `+` es **solo aritmético** (con strings intenta convertirlos a número y, con `strict_types`, lanza `TypeError`). Para unir textos se usa el punto: `"Hola " . $nombre`, o interpolación: `"Hola {$nombre}"`.',
            [$this->fix('Cambiar + por .', $src->range($i), '.')],
        );
    }

    /** `lista.size()`, `s.length()`, `arr.length` y `this.x` con el punto de Java */
    private function javaDot(int $i): void
    {
        $src = $this->src;
        $p = $src->prev($i);
        $n = $src->next($i);
        if ($p === null || $n === null || isset($this->handled[$i])) {
            return;
        }
        $pt = $src->tokens[$p];
        $nt = $src->tokens[$n];
        if (!$this->adjacent($p, $i) || !$this->adjacent($i, $n)) {
            return; // con espacios es una concatenación normal de PHP
        }

        if ($pt->id === T_STRING && $pt->text === 'this') {
            $this->handled[$p] = true;
            $this->add(
                'java.this', 'warning', $p, $i,
                '`this.` en PHP es `$this->`',
                'En PHP `this` se escribe `$this` y se accede a sus miembros con la flecha `->` (no con el punto): `$this->saldo`, `$this->ingresar(5)`.',
                [$this->fix('Cambiar por $this->', $src->range($p, $i), '$this->')],
            );
            return;
        }

        $prevIsValue = $pt->id === T_VARIABLE || $pt->text === ')' || $pt->text === ']';
        if ($nt->id !== T_STRING || !$prevIsValue) {
            return;
        }
        $isCall = $src->is($src->next($n), '(');
        if ($isCall && isset(self::JAVA_METHODS[$nt->text])) {
            $this->add(
                'java.method-call', 'warning', $p, $n,
                sprintf('`.%s()` es de Java', $nt->text),
                sprintf('En PHP el punto concatena strings; las funciones sobre strings y arrays son funciones sueltas. En vez de `x.%s()` usa: `%s`.', $nt->text, self::JAVA_METHODS[$nt->text]),
            );
        } elseif (!$isCall && $nt->text === 'length') {
            $this->add(
                'java.length', 'warning', $p, $n,
                '`.length` es de Java',
                'Los arrays de PHP no tienen `.length`. Usa `count($array)`; para el largo de un texto, `strlen($s)` (bytes) o `mb_strlen($s)` (caracteres).',
            );
        }
    }
}
