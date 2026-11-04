<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp\Analysis;

defined('PG_ROOT') or exit;

/**
 * Pistas de estilo, rendimiento y errores típicos de C++, en español y con arreglo automático cuando es seguro
 * (cada arreglo deja código que sigue compilando). Mismos códigos que PHP, Python y Java donde hay equivalente
 * (cx.*, perf.*, flow.*, unused.*), más los propios de C++ (include.missing, perf.pass-by-value, modern.*, sign.compare…).
 *
 * Forma de cada pista: {source:'analysis', severity, code, line, col, endLine, endCol, title, message, explain, fixes}
 */
final class CppHints
{
    /** Identificador de la biblioteca => cabecera que lo declara. */
    private const HEADERS = [
        'vector' => 'vector', 'map' => 'map', 'multimap' => 'map', 'set' => 'set', 'multiset' => 'set', 'unordered_map' => 'unordered_map',
        'unordered_multimap' => 'unordered_map', 'unordered_set' => 'unordered_set', 'unordered_multiset' => 'unordered_set',
        'queue' => 'queue', 'priority_queue' => 'queue', 'stack' => 'stack', 'deque' => 'deque', 'list' => 'list', 'forward_list' => 'forward_list',
        'string' => 'string', 'getline' => 'string', 'to_string' => 'string', 'stoi' => 'string', 'stoll' => 'string', 'stol' => 'string', 'stod' => 'string',
        'cout' => 'iostream', 'cin' => 'iostream', 'cerr' => 'iostream', 'endl' => 'iostream',
        'sort' => 'algorithm', 'stable_sort' => 'algorithm', 'reverse' => 'algorithm', 'max_element' => 'algorithm', 'min_element' => 'algorithm',
        'lower_bound' => 'algorithm', 'upper_bound' => 'algorithm', 'binary_search' => 'algorithm', 'next_permutation' => 'algorithm',
        'prev_permutation' => 'algorithm', 'fill' => 'algorithm', 'find' => 'algorithm', 'find_if' => 'algorithm', 'count' => 'algorithm',
        'count_if' => 'algorithm', 'unique' => 'algorithm', 'nth_element' => 'algorithm', 'all_of' => 'algorithm', 'any_of' => 'algorithm',
        'none_of' => 'algorithm', 'transform' => 'algorithm', 'remove_if' => 'algorithm', 'for_each' => 'algorithm', 'equal_range' => 'algorithm',
        'minmax_element' => 'algorithm', 'partial_sort' => 'algorithm', 'rotate' => 'algorithm',
        'accumulate' => 'numeric', 'iota' => 'numeric', 'gcd' => 'numeric', 'lcm' => 'numeric', 'partial_sum' => 'numeric', 'inner_product' => 'numeric',
        'tuple' => 'tuple', 'make_tuple' => 'tuple', 'tie' => 'tuple', 'function' => 'functional', 'greater' => 'functional',
        'unique_ptr' => 'memory', 'shared_ptr' => 'memory', 'make_unique' => 'memory', 'make_shared' => 'memory', 'array' => 'array', 'bitset' => 'bitset',
        'stringstream' => 'sstream', 'istringstream' => 'sstream', 'ostringstream' => 'sstream', 'setprecision' => 'iomanip', 'setw' => 'iomanip',
        'sqrt' => 'cmath', 'pow' => 'cmath', 'floor' => 'cmath', 'ceil' => 'cmath', 'log2' => 'cmath', 'hypot' => 'cmath', 'fabs' => 'cmath',
        'memset' => 'cstring', 'strlen' => 'cstring', 'strcmp' => 'cstring', 'strcpy' => 'cstring', 'memcpy' => 'cstring',
        'printf' => 'cstdio', 'scanf' => 'cstdio', 'puts' => 'cstdio', 'INT_MAX' => 'climits', 'INT_MIN' => 'climits', 'LLONG_MAX' => 'climits',
        'LLONG_MIN' => 'climits', 'numeric_limits' => 'limits', 'optional' => 'optional', 'string_view' => 'string_view', 'assert' => 'cassert',
        'mt19937' => 'random', 'uniform_int_distribution' => 'random', 'random_device' => 'random', 'chrono' => 'chrono', 'pair' => 'utility',
        'make_pair' => 'utility', 'swap' => 'utility', 'move' => 'utility', 'max' => 'algorithm', 'min' => 'algorithm',
    ];
    /** Cabeceras que en la práctica llegan con cualquier otra (no se piden si ya hay algún #include). */
    /** Fichas tras las que empieza una sentencia. */
    private const INICIO = [';' => 1, '{' => 1, '}' => 1, ')' => 1];
    private const BLANDAS = ['utility' => 1];
    private const BLANDOS = ['max' => 1, 'min' => 1, 'swap' => 1, 'move' => 1, 'pair' => 1, 'make_pair' => 1, 'string' => 1, 'getline' => 1];
    /** Contenedores caros de copiar (paso por valor). */
    private const CAROS = ['VEC' => 1, 'STR' => 1, 'TREE' => 1, 'HASH' => 1, 'DEQ' => 1, 'LIST' => 1, 'PQ' => 1, 'QUEUE' => 1, 'STACK' => 1];
    /** Métodos que no modifican el contenedor. */
    private const CONSULTA = ['size' => 1, 'empty' => 1, 'length' => 1, 'find' => 1, 'count' => 1, 'contains' => 1, 'at' => 1, 'front' => 1,
        'back' => 1, 'top' => 1, 'substr' => 1, 'c_str' => 1, 'compare' => 1, 'lower_bound' => 1, 'upper_bound' => 1, 'equal_range' => 1,
        'rfind' => 1, 'find_first_of' => 1, 'find_last_of' => 1, 'starts_with' => 1, 'ends_with' => 1, 'data' => 1, 'cbegin' => 1, 'cend' => 1,
        'first' => 1, 'second' => 1];
    /** Algoritmos que aceptan iteradores de un contenedor constante. */
    private const SOLO_LEEN = ['accumulate' => 1, 'count' => 1, 'count_if' => 1, 'find' => 1, 'find_if' => 1, 'max_element' => 1, 'min_element' => 1,
        'minmax_element' => 1, 'lower_bound' => 1, 'upper_bound' => 1, 'binary_search' => 1, 'equal_range' => 1, 'all_of' => 1, 'any_of' => 1,
        'none_of' => 1, 'is_sorted' => 1, 'distance' => 1, 'equal' => 1, 'insert' => 1, 'assign' => 1, 'append' => 1, 'inner_product' => 1,
        'set_intersection' => 1, 'set_union' => 1, 'set_difference' => 1, 'includes' => 1, 'copy' => 1, 'mismatch' => 1, 'search' => 1];
    /** Funciones que reciben sus argumentos por valor o por referencia constante. */
    private const PURAS = ['max' => 1, 'min' => 1, 'abs' => 1, 'to_string' => 1, 'sqrt' => 1, 'pow' => 1, 'printf' => 1, 'stoi' => 1, 'stoll' => 1,
        'gcd' => 1, 'lcm' => 1, 'hash' => 1, 'make_pair' => 1, 'puts' => 1, 'size' => 1, 'empty' => 1];
    /** Asignaciones (modifican lo que tienen a la izquierda). */
    private const ASIG = ['=' => 1, '+=' => 1, '-=' => 1, '*=' => 1, '/=' => 1, '%=' => 1, '&=' => 1, '|=' => 1, '^=' => 1, '<<=' => 1, '>>=' => 1,
        '++' => 1, '--' => 1];

    /** @var list<array<string,mixed>> */
    private array $out = [];

    public function __construct(private readonly CppCode $c, private readonly CppMetrics $m)
    {
    }

    /** @return list<array<string,mixed>> */
    public function all(): array
    {
        foreach ($this->c->units as $u => $unit) {
            $info = $this->m->info[$u] ?? null;
            if ($info === null) {
                continue;
            }
            $this->complexity($unit, $info['row']);
            $this->performance($u, $unit, $info);
            $this->unused($unit, $info);
            $this->passByValue($u, $unit, $info);
            $this->overflow($unit, $info);
            $this->signCompare($unit, $info);
            $this->cstringEq($unit, $info);
        }
        $code = $this->c->code;
        $this->includes();
        if (str_contains($code, 'NULL')) {
            $this->nullMacro();
        }
        if (str_contains($code, 'new')) {
            $this->rawNew();
        }
        if (str_contains($code, 'catch')) {
            $this->emptyCatch();
        }
        if (str_contains($code, 'else')) {
            $this->elseAfterReturn();
        }
        $seen = [];
        $res = [];
        foreach ($this->out as $d) {
            $k = $d['code'] . ':' . $d['line'] . ':' . $d['col'];
            if (!isset($seen[$k])) {
                $seen[$k] = true;
                $res[] = $d;
            }
        }
        usort($res, static fn(array $a, array $b): int => [$a['line'], $a['col']] <=> [$b['line'], $b['col']]);
        return $res;
    }

    // ───────────────────────────── utilidades ─────────────────────────────

    /** @param list<array<string,mixed>> $fixes */
    private function add(string $code, string $sev, int $from, int $to, string $title, string $explain, array $fixes = []): void
    {
        $r = $this->c->range($from, $to);
        $this->out[] = [
            'source' => 'analysis', 'severity' => $sev, 'code' => $code,
            'line' => $r['sl'], 'col' => $r['sc'], 'endLine' => $r['el'], 'endCol' => $r['ec'],
            'title' => $title, 'message' => $title, 'explain' => $explain, 'fixes' => $fixes,
        ];
    }

    /** Un arreglo de un solo cambio que sustituye las fichas $a..$b por $text. */
    private function fix(string $title, int $a, int $b, string $text): array
    {
        return ['title' => $title, 'edits' => [['range' => $this->c->range($a, $b), 'text' => $text]]];
    }

    private function fname(array $unit): string
    {
        return ($unit['cls'] !== '' ? $unit['cls'] . '::' : '') . $unit['name'] . '()';
    }

    // ───────────────────────────── complejidad ─────────────────────────────

    private function complexity(array $unit, array $row): void
    {
        $tok = $unit['nameTok'];
        $name = $row['qname'] . '()';
        if ($row['cc'] > 20) {
            $this->add('cx.cyclomatic', 'warning', $tok, $tok, sprintf('%s: complejidad ciclomática muy alta (%d, nota %s)', $name, $row['cc'], $row['grade']),
                'La complejidad ciclomática cuenta los caminos independientes del código (cada `if`, bucle, `case`, `&&`, `||`, `?:`...). Por encima de 20 es muy difícil de probar y de entender. Divide la función en funciones más pequeñas, cada una con una sola responsabilidad.');
        } elseif ($row['cc'] > 10) {
            $this->add('cx.cyclomatic', 'info', $tok, $tok, sprintf('%s: complejidad ciclomática alta (%d, nota %s)', $name, $row['cc'], $row['grade']),
                'Más de 10 caminos independientes: ya cuesta probarla entera. Busca bloques que puedas extraer a su propia función o condiciones que simplificar con *early return*.');
        }
        if ($row['cognitive'] > 15) {
            $this->add('cx.cognitive', 'warning', $tok, $tok, sprintf('%s: complejidad cognitiva %d', $name, $row['cognitive']),
                'La complejidad cognitiva mide lo difícil que es **leer** el código: penaliza el anidamiento. Por encima de 15 conviene reducir niveles con *early return* (`if (!cond) return;`, `continue`) y extraer funciones.');
        }
        if ($row['nesting'] > 3) {
            $this->add('cx.nesting', 'info', $tok, $tok, sprintf('%s: %d niveles de anidamiento', $name, $row['nesting']),
                'Más de 3 estructuras de control dentro de otras cuesta seguir. Sal pronto con `return`/`continue` en vez de anidar `else`, o extrae el bloque interno a una función.');
        }
        if ($row['loc'] > 50) {
            $this->add('cx.length', 'info', $tok, $tok, sprintf('%s: %d líneas de código', $name, $row['loc']),
                'Una función larga suele hacer varias cosas. Prueba a separarla en pasos con nombre claro (leer la entrada, calcular, imprimir…).');
        }
        if ($row['params'] > 5) {
            $this->add('cx.params', 'info', $tok, $tok, sprintf('%s: %d parámetros', $name, $row['params']),
                'Muchos parámetros son difíciles de recordar y de ordenar bien. Agrúpalos en un `struct` o conviértelos en campos de una clase.');
        }
        if (($row['recursive'] ?? false) && ($row['bigOKey'] ?? '') === 'exp' && str_contains(implode(' ', $row['bigOWhy']), 'sin memoización')) {
            $this->add('perf.recursion', 'warning', $tok, $tok, sprintf('%s: recursión exponencial sin memoización', $name),
                'Varias llamadas recursivas sobre `n-1`, `n-2`... recalculan los mismos subproblemas una y otra vez. Guarda los resultados ya calculados en un `vector<long long> memo(n + 1, -1)` (o un `unordered_map`) y devuélvelos si ya están, o escribe la versión iterativa (DP de abajo arriba): pasa de O(2ⁿ) a O(n).');
        }
    }

    // ───────────────────────────── rendimiento ─────────────────────────────

    private function performance(int $u, array $unit, array $info): void
    {
        $c = $this->c;
        $T = $c->t;
        $M = $c->m;
        foreach ($info['events'] as $e) {
            if ($e[0] !== 'cost' || ($e[8] ?? $e[1]) < 1) {
                continue;
            }
            [, , $a, $b, $tok, $recv, $rbase, $name] = $e;
            $fam = $rbase !== null ? (CppCode::FAM[$rbase] ?? null) : null;
            $arg0 = $T[$tok + 2] ?? ['', ''];
            $empieza = $arg0[0] === 'w' && ($T[$tok + 3][1] ?? '') === '.' && ($T[$tok + 4][1] ?? '') === 'begin';
            if (($fam === 'VEC' || $fam === 'STR') && ($name === 'erase' || $name === 'insert') && $empieza) {
                $this->add('perf.erase-front-loop', 'warning', $tok, $tok, sprintf('%s.%s(%s.begin()…) dentro de un bucle: O(n²)', $recv, $name, $arg0[1]),
                    'Borrar o insertar al principio de un `' . ($fam === 'STR' ? 'string' : 'vector') . '` desplaza todos los elementos: O(n) cada vez, O(n²) en el bucle. Si necesitas una cola, usa `deque` (`push_front`/`pop_front` son O(1)) o `queue`; si solo procesas en orden inverso, recorre desde el final o haz `reverse` una vez y usa `pop_back()`.');
            } elseif (($recv === null || $recv === 'std') && in_array($name, ['sort', 'stable_sort', 'partial_sort'], true)) {
                $this->add('perf.sort-loop', 'warning', $tok, $tok, sprintf('%s() dentro de un bucle', $name),
                    'Ordenar cuesta O(n log n) y aquí se repite en cada vuelta. Si puedes, ordena una sola vez fuera del bucle, o usa una estructura que mantenga el orden al insertar (`set`, `multiset`, `priority_queue`).');
            } elseif (($recv === null || $recv === 'std') && in_array($name, ['find', 'count'], true) && $this->overContainer($tok)) {
                $this->add('perf.find-loop', 'warning', $tok, $tok, sprintf('%s() dentro de un bucle: O(n²)', $name),
                    '`' . $name . '(v.begin(), v.end(), x)` recorre el contenedor entero en cada llamada; dentro de un bucle el coste se multiplica. Guarda los valores en un `unordered_set<int>` (o `set`) y consulta con `s.count(x)` / `s.contains(x)`: O(1) de media (O(log n) con `set`).');
            } elseif ($name === '+' && $rbase === 'string') {
                $fx = [];
                $k = $tok;
                if (($T[$k + 4] ?? null) !== null && in_array($T[$k + 4][0], ['w', 's', 'n'], true) && ($T[$k + 5][1] ?? '') === ';') {
                    $fx[] = ['title' => 'Usar +=', 'edits' => [['range' => $c->range($k + 1, $k + 3), 'text' => '+=']]];
                }
                $this->add('perf.concat-loop', 'warning', $tok, $tok + 3, sprintf('%s = %s + … dentro de un bucle: O(n²)', $recv, $recv),
                    '`s = s + x` construye un `string` nuevo copiando todo `s` en cada vuelta: n concatenaciones cuestan O(n²). Con `s += x` (o `s.push_back(c)`) se añade al final sin copiar: O(1) amortizado.', $fx);
            }
        }
        // endl dentro de un bucle
        foreach ($info['depth'] as $i => $d) {
            if ($d < 1 || $T[$i][1] !== 'endl' || ($T[$i + 1][1] ?? '') === '(') {
                continue;
            }
            $a = (($T[$i - 1][1] ?? '') === '::' && ($T[$i - 2][1] ?? '') === 'std') ? $i - 2 : $i;
            $this->add('perf.endl-loop', 'info', $a, $i, '`endl` dentro de un bucle: vacía el búfer en cada línea',
                '`endl` escribe un salto de línea **y** fuerza a vaciar el búfer de salida (un `flush`), que es lento: con muchas líneas el programa puede tardar varias veces más. Usa `\'\\n\'` y deja que el búfer se vacíe solo (al terminar o cuando se llena).',
                [$this->fix("Usar '\\n'", $a, $i, "'\\n'")]);
        }
    }

    /** ¿La llamada de $tok recibe iteradores `x.begin(), x.end()` (find/count de <algorithm>, no el de un string)? */
    private function overContainer(int $tok): bool
    {
        $T = $this->c->t;
        return ($T[$tok + 3][1] ?? '') === '.' && in_array($T[$tok + 4][1] ?? '', ['begin', 'cbegin'], true);
    }

    // ───────────────────────────── sin usar ─────────────────────────────

    private function unused(array $unit, array $info): void
    {
        $T = $this->c->t;
        $freq = [];
        for ($i = $unit['pc'] + 1; $i < $unit['close']; $i++) {           // desde la lista de inicialización del constructor
            if ($T[$i][0] === 'w' && ($T[$i - 1][1] ?? '') !== '.' && ($T[$i - 1][1] ?? '') !== '->') {
                $freq[$T[$i][1]] = ($freq[$T[$i][1]] ?? 0) + 1;
            }
        }
        foreach ($info['locals']['decls'] as $d) {
            if (!empty($d['param']) || $d['bind'] !== null || $d['ctx'] !== 'stmt' || ($freq[$d['name']] ?? 0) > 1 || $d['name'] === '_'
                || isset($d['spec']['static']) || str_starts_with($d['name'], '_')) {
                continue;
            }
            $inf = $d['info'] ?? null;
            // solo tipos sin efectos al construirse (un lock_guard o un temporizador sí se usan aunque no se lean)
            if ($inf === null || $inf['user'] || !(isset(CppCode::BUILTIN[$inf['base']]) || $inf['fam'] !== null || isset(CppCode::STDT[$inf['base']]) && !in_array($inf['base'], ['lock_guard', 'unique_lock', 'thread', 'mutex'], true))) {
                continue;
            }
            $this->add('unused.var', 'hint', $d['tok'], $d['tok'], sprintf('La variable %s no se usa', $d['name']),
                'Se declara pero nunca se lee. Si ya no hace falta, bórrala; si te faltaba usarla, quizá es un error (¿otro nombre?).');
        }
        if ($unit['kind'] === 'main' || $unit['virtual'] || $unit['op']) {
            return;
        }
        foreach ($unit['params'] as $p) {
            if ($p['name'] !== '' && ($freq[$p['name']] ?? 0) === 0) {
                $this->add('unused.param', 'hint', $p['tok'], $p['tok'], sprintf('El parámetro %s de %s no se usa', $p['name'], $this->fname($unit)),
                    'Ese parámetro no se lee en el cuerpo de la función. Quítalo (y de las llamadas) o úsalo. Si tiene que estar por la firma, puedes dejarlo sin nombre (`int /*n*/`) o marcarlo `[[maybe_unused]]`.');
            }
        }
    }

    // ───────────────────────────── paso por valor ─────────────────────────────

    private function passByValue(int $u, array $unit, array $info): void
    {
        $c = $this->c;
        $T = $c->t;
        if ($unit['kind'] === 'main' || $unit['virtual'] || $unit['op'] || $unit['tpl'] !== null && $this->usesTplParam($unit)) {
            return;
        }
        $proto = false;
        foreach ($c->protos as $p) {
            if ($p['name'] === $unit['name'] && $p['cls'] === $unit['cls'] && !$p['inClass']) {
                $proto = true;
            }
        }
        foreach ($unit['params'] as $p) {
            if ($p['name'] === '' || $p['def'] !== null) {
                continue;
            }
            $inf = $c->info($p['type']);
            if ($inf['ref'] !== '' || $inf['ptr'] > 0 || $inf['arr'] > 0) {
                continue;
            }
            $caro = isset(self::CAROS[$inf['fam'] ?? '']) || ($inf['user'] && in_array($c->typeNames[$inf['base']] ?? '', ['struct', 'class'], true)
                && ($ci = $c->classIndex($inf['base'])) !== null && $c->classes[$ci]['fields'] !== []);
            if (!$caro || $this->modifies($p['name'], $inf, $unit, $info)) {
                continue;
            }
            $fixes = [];
            $inClassProto = false;
            foreach ($c->protos as $q) {
                if ($q['name'] === $unit['name'] && $q['cls'] === $unit['cls']) {
                    $inClassProto = true;
                }
            }
            if (!$proto && !$inClassProto && $T[$p['ta']][3] === $T[$p['te']][3]) {
                $txt = $c->text($p['ta'], $p['te']);
                $nuevo = (str_starts_with($txt, 'const ') ? '' : 'const ') . $txt . '&';
                $fixes[] = $this->fix('Pasar por referencia constante (' . $nuevo . ')', $p['ta'], $p['te'], $nuevo);
            }
            $this->add('perf.pass-by-value', 'info', $p['tok'], $p['tok'], sprintf('%s se pasa por valor: se copia entero en cada llamada', $p['name']),
                'Un parámetro `' . $c->text($p['ta'], $p['te']) . '` sin `&` hace una **copia completa** (O(n) en tiempo y memoria) cada vez que se llama a la función; en una función recursiva o dentro de un bucle eso se nota mucho. Como aquí no se modifica, pásalo por referencia constante: `const ' . preg_replace('/^const\s+/', '', $c->text($p['ta'], $p['te'])) . '& ' . $p['name'] . '` (no copia nada y el compilador impide cambiarlo).', $fixes);
        }
    }

    private function usesTplParam(array $unit): bool
    {
        foreach ($unit['params'] as $p) {
            foreach ($this->c->tparams as $tp) {
                if ($tp['type'] && preg_match('/\b' . preg_quote($tp['name'], '/') . '\b/', $p['type'])) {
                    return true;
                }
            }
        }
        return false;
    }

    /** ¿El parámetro $v se modifica (o podría modificarse) en el cuerpo? Ante la duda, sí. */
    private function modifies(string $v, array $inf, array $unit, array $info): bool
    {
        $c = $this->c;
        $T = $c->t;
        $M = $c->m;
        $mapa = in_array($inf['base'], ['map', 'unordered_map'], true);
        for ($i = $unit['open'] + 1; $i < $unit['close']; $i++) {
            if ($T[$i][1] !== $v || $T[$i][0] !== 'w' || in_array($T[$i - 1][1] ?? '', ['.', '->', '::'], true)) {
                continue;
            }
            $p = $T[$i - 1][1] ?? '';
            if ($p === '++' || $p === '--' || $p === '&' && !in_array($T[$i - 2][0] ?? '', ['w', 'n'], true) && ($T[$i - 2][1] ?? '') !== ')') {
                return true;
            }
            if ($p === '>' && ($T[$i - 2][1] ?? '') === '>') {
                return true;                                     // cin >> v
            }
            $k = $i + 1;
            while (($T[$k][1] ?? '') === '[' && isset($M[$k])) {
                if ($mapa) {
                    return true;                                 // m[k] no existe en un map constante
                }
                $k = $M[$k] + 1;
            }
            $n = $T[$k][1] ?? '';
            if (isset(self::ASIG[$n])) {
                return true;
            }
            if (($n === '.' || $n === '->') && ($T[$k + 1][0] ?? '') === 'w') {
                $mth = $T[$k + 1][1];
                $llamada = ($T[$k + 2][1] ?? '') === '(';
                if (in_array($mth, ['begin', 'end', 'rbegin', 'rend'], true)) {
                    if (!$this->insideReadOnlyCall($i)) {
                        return true;
                    }
                    continue;
                }
                if (!isset(self::CONSULTA[$mth]) && $llamada) {
                    return true;
                }
                if (!$llamada && $k + 1 > $i + 1 && !isset(self::CONSULTA[$mth])) {
                    // campo de un struct: v.x = …
                    $q = $k + 2;
                    while (($T[$q][1] ?? '') === '[' && isset($M[$q])) {
                        $q = $M[$q] + 1;
                    }
                    if (isset(self::ASIG[$T[$q][1] ?? ''])) {
                        return true;
                    }
                    continue;
                }
                $fin = $llamada && isset($M[$k + 2]) ? $M[$k + 2] + 1 : $k + 2;
                if (isset(self::ASIG[$T[$fin][1] ?? ''])) {
                    return true;                                 // v.back() = 5
                }
                continue;
            }
            // argumento de una llamada: solo si la función no puede cambiarlo
            if ($p === '(' || $p === ',') {
                $call = $this->callOf($i);
                if ($call === null) {
                    continue;                                    // lista de inicialización o paréntesis de expresión
                }
                [$fn, $pos] = $call;
                if (isset(self::PURAS[$fn]) || $this->userParamConst($fn, $pos)) {
                    continue;
                }
                return true;
            }
            if ($p === ':' && $this->rangeForMutable($i)) {
                return true;
            }
        }
        // también si una lambda lo captura por referencia y lo cambia: se ve como uso normal arriba
        unset($info);
        return false;
    }

    /** Si la ficha $i es un argumento directo de una llamada: [nombre, posición]. */
    private function callOf(int $i): ?array
    {
        $T = $this->c->t;
        $M = $this->c->m;
        $pos = 0;
        for ($k = $i - 1; $k >= 0; $k--) {
            $y = $T[$k][1];
            if (($y === ')' || $y === ']' || $y === '}') && isset($M[$k])) {
                $k = $M[$k];
                continue;
            }
            if ($y === ',') {
                $pos++;
                continue;
            }
            if ($y === '(') {
                $f = $T[$k - 1] ?? null;
                if ($f !== null && $f[0] === 'w' && !isset(CppCode::KW[$f[1]])) {
                    return [$f[1], $pos];
                }
                if ($f !== null && $f[1] === '>' ) {
                    return ['?', $pos];
                }
                return null;
            }
            if ($y === ';' || $y === '{' || $y === '}') {
                return null;
            }
        }
        return null;
    }

    /** ¿v.begin() está dentro de una llamada a un algoritmo que solo lee? */
    private function insideReadOnlyCall(int $i): bool
    {
        $call = $this->callOf($i);
        return $call !== null && isset(self::SOLO_LEEN[$call[0]]);
    }

    /** ¿La función de usuario $fn recibe su parámetro $pos por valor o por referencia constante? */
    private function userParamConst(string $fn, int $pos): bool
    {
        $found = false;
        foreach (array_merge($this->c->units, $this->c->protos) as $u) {
            if ($u['name'] !== $fn) {
                continue;
            }
            $found = true;
            $p = $u['params'][$pos] ?? null;
            if ($p === null) {
                return false;
            }
            $inf = $this->c->info($p['type']);
            if (($inf['ref'] === '&' && !$inf['const']) || ($inf['ptr'] > 0 && !$inf['const']) || $inf['ref'] === '&&') {
                return false;
            }
        }
        return $found;
    }

    /** `for (auto& x : v)` sin const: el bucle podría modificar los elementos. */
    private function rangeForMutable(int $i): bool
    {
        $T = $this->c->t;
        for ($k = $i - 2; $k >= 0 && $T[$k][1] !== '(' && $T[$k][1] !== ';'; $k--) {
            if ($T[$k][1] === '&' || $T[$k][1] === '&&') {
                for ($q = $k; $q >= 0 && $T[$q][1] !== '('; $q--) {
                    if ($T[$q][1] === 'const') {
                        return false;
                    }
                }
                return true;
            }
        }
        return false;
    }

    // ───────────────────────────── desbordamiento ─────────────────────────────

    private function overflow(array $unit, array $info): void
    {
        $T = $this->c->t;
        $types = $info['locals']['types'];
        $esInt = static fn(?array $t): bool => $t !== null && $t['base'] === 'int' && $t['ptr'] === 0 && $t['arr'] === 0;
        $esWide = static fn(?array $t): bool => $t !== null && $t['ptr'] === 0 && $t['arr'] === 0
            && in_array($t['deduced'] ?? $t['base'], ['long long', 'unsigned long long', 'int64_t', 'uint64_t', 'long', 'll'], true);
        $hecho = [];
        $depth = $info['depth'];
        for ($i = $unit['open'] + 1; $i < $unit['close']; $i++) {
            $n = $T[$i + 1][1];
            if (($n !== '=' && $n !== '*=') || $T[$i][0] !== 'w' || isset($hecho[$T[$i][1]]) || in_array($T[$i - 1][1] ?? '', ['.', '->'], true)) {
                continue;
            }
            $v = $T[$i][1];
            // long long r = a * b; con a y b int: el producto se hace en int y desborda ANTES de ensancharse
            if ($n === '=' && $esWide($types[$v] ?? null) && ($T[$i + 3][1] ?? '') === '*' && ($T[$i + 5][1] ?? '') === ';'
                && $T[$i + 2][0] === 'w' && $T[$i + 4][0] === 'w' && $esInt($types[$T[$i + 2][1]] ?? null) && $esInt($types[$T[$i + 4][1]] ?? null)) {
                $hecho[$v] = true;
                $this->add('overflow.int', 'warning', $i + 2, $i + 4, sprintf('%s * %s se calcula en int y desborda antes de guardarse en %s', $T[$i + 2][1], $T[$i + 4][1], $v),
                    'Aunque `' . $v . '` sea `long long`, `' . $T[$i + 2][1] . ' * ' . $T[$i + 4][1] . '` multiplica dos `int`: el resultado es `int` y se desborda (comportamiento indefinido) **antes** de convertirse a `long long`. Convierte un operando antes de multiplicar: `1LL * a * b` o `(long long)a * b`.',
                    [$this->fix('Multiplicar en long long: 1LL * ' . $T[$i + 2][1] . ' * ' . $T[$i + 4][1], $i + 2, $i + 4, '1LL * ' . $T[$i + 2][1] . ' * ' . $T[$i + 4][1])]);
                continue;
            }
            if (!$esInt($types[$v] ?? null)) {
                continue;
            }
            $d = $depth[$i] ?? 0;
            $prod = $d >= 1 && ($n === '*=' || ($n === '=' && ($T[$i + 2][1] ?? '') === $v && ($T[$i + 3][1] ?? '') === '*'));
            // int r = a * b; con a y b int (no literales)
            $mult = false;
            if (!$prod && $n === '=' && ($T[$i - 1][0] === 'w') && ($T[$i + 3][1] ?? '') === '*' && ($T[$i + 5][1] ?? '') === ';'
                && $esInt($types[$T[$i + 2][1]] ?? null) && $esInt($types[$T[$i + 4][1]] ?? null)) {
                $mult = true;
            }
            if (!$prod && !$mult) {
                continue;
            }
            $hecho[$v] = true;
            $fixes = [];
            if ($mult && $T[$i - 1][1] === 'int' && isset(self::INICIO[$T[$i - 2][1] ?? ''])) {
                $a = $T[$i + 2][1];
                $b = $T[$i + 4][1];
                $fixes[] = ['title' => 'Usar long long: long long ' . $v . ' = 1LL * ' . $a . ' * ' . $b, 'edits' => [
                    ['range' => $this->c->range($i - 1, $i - 1), 'text' => 'long long'],
                    ['range' => $this->c->range($i + 2, $i + 4), 'text' => '1LL * ' . $a . ' * ' . $b],
                ]];
            }
            $this->add('overflow.int', 'hint', $i, $i, $prod ? sprintf('%s es int y acumula un producto: puede desbordarse', $v) : sprintf('%s = %s * %s en int: puede desbordarse', $v, $T[$i + 2][1], $T[$i + 4][1]),
                'Un `int` solo llega a 2.147.483.647 (≈ 2·10⁹). Un producto que crece en un bucle (factoriales, potencias) o `n * n` con n = 10⁵ lo superan enseguida, y en C++ el desbordamiento de un entero con signo es **comportamiento indefinido**: no da error, da números absurdos. Usa `long long` (hasta ≈ 9,2·10¹⁸) para la variable y, si los operandos son `int`, convierte uno antes de multiplicar: `1LL * a * b`. Si el enunciado pide el resultado módulo 10⁹+7, aplica `% MOD` en cada paso.', $fixes);
        }
    }

    // ───────────────────────────── comparación con signo ─────────────────────────────

    private function signCompare(array $unit, array $info): void
    {
        $c = $this->c;
        $T = $c->t;
        $M = $c->m;
        $types = $info['locals']['types'];
        for ($i = $unit['open'] + 1; $i < $unit['close']; $i++) {
            $op = $T[$i][1];
            if ($op !== '<' && $op !== '<=' && $op !== '>' && $op !== '>=') {
                continue;
            }
            $l = $T[$i - 1];
            if ($l[0] !== 'w' || in_array($T[$i - 2][1] ?? '', ['.', '->'], true)) {
                continue;
            }
            $tl = $types[$l[1]] ?? null;
            if ($tl === null || !in_array($tl['deduced'] ?? $tl['base'], ['int', 'long', 'long long', 'short'], true) || $tl['arr'] > 0) {
                continue;
            }
            // lado derecho: recv(.recv)*[...]*.size() / .length()
            $k = $i + 1;
            $a = $k;
            if ($T[$k][0] !== 'w') {
                continue;
            }
            $k++;
            while (true) {
                if (($T[$k][1] ?? '') === '[' && isset($M[$k])) {
                    $k = $M[$k] + 1;
                } elseif (in_array($T[$k][1] ?? '', ['.', '->'], true) && ($T[$k + 1][0] ?? '') === 'w' && !in_array($T[$k + 1][1], ['size', 'length'], true)) {
                    $k += 2;
                } else {
                    break;
                }
            }
            if (!in_array($T[$k][1] ?? '', ['.', '->'], true) || !in_array($T[$k + 1][1] ?? '', ['size', 'length'], true) || ($T[$k + 2][1] ?? '') !== '(' || ($T[$k + 3][1] ?? '') !== ')') {
                continue;
            }
            $b = $k + 3;
            $menos = ($T[$b + 1][1] ?? '') === '-';
            $expr = $c->text($a, $b);
            $this->add('sign.compare', $menos ? 'warning' : 'hint', $a, $b, sprintf('Comparas un int con %s, que no tiene signo%s', $expr, $menos ? ' (y le restas)' : ''),
                '`' . $expr . '` devuelve `size_t`, un entero **sin signo**. Al comparar `' . $l[1] . ' ' . $op . ' ' . $expr . '`, el `int` se convierte a sin signo: si fuera negativo pasa a valer un número enorme y la comparación falla (el compilador avisa con `-Wsign-compare`). Peor aún: si el contenedor está vacío, `' . $expr . ' - 1` no da -1 sino 18.446.744.073.709.551.615 y el bucle se sale de rango. Convierte el tamaño a entero con signo: `(int)' . $expr . '` (o `ssize(v)` en C++20).',
                [$this->fix('Convertir a int: (int)' . $expr, $a, $b, '(int)' . $expr)]);
        }
    }

    // ───────────────────────────── == con cadenas de C ─────────────────────────────

    private function cstringEq(array $unit, array $info): void
    {
        $c = $this->c;
        $T = $c->t;
        $types = $info['locals']['types'];
        $esC = static fn(?array $t): bool => $t !== null && $t['base'] === 'char' && ($t['ptr'] === 1 || $t['arr'] === 1);
        for ($i = $unit['open'] + 1; $i < $unit['close']; $i++) {
            $op = $T[$i][1];
            if ($op !== '==' && $op !== '!=') {
                continue;
            }
            $l = $T[$i - 1];
            $r = $T[$i + 1] ?? null;
            if ($r === null) {
                continue;
            }
            $lc = $l[0] === 'w' && !in_array($T[$i - 2][1] ?? '', ['.', '->', '['], true) && $esC($types[$l[1]] ?? null);
            $rc = $r[0] === 'w' && !in_array($T[$i + 2][1] ?? '', ['.', '->', '[', '('], true) && $esC($types[$r[1]] ?? null);
            $ls = $l[0] === 's' && $l[1][0] === '"';
            $rs = $r[0] === 's' && $r[1][0] === '"';
            if (!(($lc && ($rc || $rs)) || ($ls && $rc))) {
                continue;
            }
            $fixes = [];
            if ($lc && in_array($T[$i - 2][1] ?? '', ['(', '&&', '||', '=', ',', '!', 'return', ';', '{'], true)) {
                $fixes[] = $this->fix('Comparar como std::string', $i - 1, $i - 1, 'std::string(' . $l[1] . ')');
            }
            $this->add('eq.cstring', 'warning', $i, $i, 'Con char* ' . $op . ' compara direcciones, no el texto',
                'Las cadenas de C (`char*`, `const char*`, `char s[]`) son punteros: `' . $op . '` mira si apuntan **al mismo sitio de memoria**, no si tienen el mismo texto, así que dos textos iguales suelen dar `false`. Usa `std::string` (con él `==` sí compara el texto) o, si tienes que quedarte con `char*`, `strcmp(a, b) == 0` de `<cstring>`.', $fixes);
        }
    }

    // ───────────────────────────── #include que faltan ─────────────────────────────

    private function includes(): void
    {
        $c = $this->c;
        $T = $c->t;
        $inc = $c->includes;
        if (isset($inc['bits/stdc++.h'])) {
            return;
        }
        $hayAlguno = $inc !== [];
        $propios = [];
        foreach ($c->units as $u) {
            $propios[$u['name']] = true;
        }
        foreach ($c->vars as $d) {
            $propios[$d['name']] = true;
        }
        foreach ($c->typeNames as $n => $k) {
            $propios[$n] = true;
        }
        foreach ($c->macros as $n => $k) {
            $propios[$n] = true;
        }
        foreach ($c->protos as $p) {
            $propios[$p['name']] = true;
        }
        $falta = [];
        $locales = [];
        foreach ($c->units as $u => $unit) {
            foreach ($c->locals($u)['decls'] as $d) {
                $locales[$d['name']] = true;
            }
            foreach ($unit['params'] as $p) {
                $locales[$p['name']] = true;
            }
        }
        foreach ($T as $i => $t) {
            if ($t[0] !== 'w' || !isset(self::HEADERS[$t[1]])) {
                continue;
            }
            $h = self::HEADERS[$t[1]];
            if (isset($inc[$h]) || isset($falta[$h]) || isset($propios[$t[1]]) || isset($locales[$t[1]])) {
                continue;
            }
            if ($hayAlguno && (isset(self::BLANDAS[$h]) || isset(self::BLANDOS[$t[1]]) && isset($inc['iostream']))) {
                continue;
            }
            if ($hayAlguno && isset(self::BLANDOS[$t[1]]) && in_array($t[1], ['max', 'min', 'swap', 'move', 'pair', 'make_pair'], true)) {
                continue;
            }
            $p = $T[$i - 1][1] ?? '';
            if ($p === '.' || $p === '->' || ($p === '::' && ($T[$i - 2][1] ?? '') !== 'std')) {
                continue;
            }
            $n = $T[$i + 1][1] ?? '';
            // los nombres de función solo cuentan si se llaman; los de tipo, si van seguidos de <, de un nombre o de ::
            $esTipo = in_array($t[1], ['vector', 'map', 'multimap', 'set', 'multiset', 'unordered_map', 'unordered_multimap', 'unordered_set',
                'unordered_multiset', 'queue', 'priority_queue', 'stack', 'deque', 'list', 'forward_list', 'tuple', 'function', 'unique_ptr',
                'shared_ptr', 'array', 'bitset', 'optional', 'pair', 'numeric_limits', 'greater', 'uniform_int_distribution'], true);
            $esObjeto = in_array($t[1], ['cout', 'cin', 'cerr', 'endl', 'string', 'stringstream', 'istringstream', 'ostringstream', 'string_view',
                'mt19937', 'random_device', 'chrono', 'INT_MAX', 'INT_MIN', 'LLONG_MAX', 'LLONG_MIN'], true);
            if ($esTipo ? $n !== '<' : (!$esObjeto && $n !== '(' && $n !== '<')) {
                continue;
            }
            $falta[$h] = $i;
        }
        if ($falta === []) {
            return;
        }
        // dónde insertar: tras el último #include (o en la línea 1)
        $ult = null;
        foreach ($c->pp as $p) {
            if (preg_match('~^#\s*include~', $p['text'])) {
                $ult = $p;
            }
        }
        foreach ($falta as $h => $i) {
            if ($ult !== null) {
                $fin = $ult['off'] + strlen(rtrim(explode("\n", $ult['text'])[0]));
                $col = $c->col($fin, $ult['line']);
                $edit = ['range' => ['sl' => $ult['line'], 'sc' => $col, 'el' => $ult['line'], 'ec' => $col], 'text' => "\n#include <{$h}>"];
            } else {
                $edit = ['range' => ['sl' => 1, 'sc' => 1, 'el' => 1, 'ec' => 1], 'text' => "#include <{$h}>\n"];
            }
            $this->add('include.missing', 'info', $i, $i, sprintf('Falta #include <%s> para %s', $h, $T[$i][1]),
                '`' . $T[$i][1] . '` se declara en `<' . $h . '>`. Aquí compila porque el playground incluye toda la biblioteca estándar por ti, pero con un compilador normal (o en un juez online sin `<bits/stdc++.h>`) daría *«\'' . $T[$i][1] . '\' was not declared in this scope»*. Añade el `#include` que corresponde: es la forma portátil de decir qué usas.',
                [['title' => "Añadir #include <{$h}>", 'edits' => [$edit]]]);
        }
    }

    // ───────────────────────────── C++ moderno ─────────────────────────────

    private function nullMacro(): void
    {
        $c = $this->c;
        $T = $c->t;
        foreach ($T as $i => $t) {
            if ($t[1] !== 'NULL' || $t[0] !== 'w') {
                continue;
            }
            $u = $c->unitAt($i);
            $types = $u !== null ? $c->locals($u)['types'] : $c->globals;
            $esPtr = static fn(?array $x): bool => $x !== null && $x['ptr'] > 0;
            $p = $T[$i - 1][1] ?? '';
            $seguro = false;
            if (in_array($p, ['==', '!=', '='], true) && ($T[$i - 2][0] ?? '') === 'w') {
                $seguro = $esPtr($types[$T[$i - 2][1]] ?? null);
                if (!$seguro && in_array($T[$i - 3][1] ?? '', ['.', '->'], true)) {
                    foreach ($c->classes as $cl) {
                        if ($esPtr($cl['fields'][$T[$i - 2][1]] ?? null)) {
                            $seguro = true;
                        }
                    }
                }
            } elseif (in_array($T[$i + 1][1] ?? '', ['==', '!='], true) && ($T[$i + 2][0] ?? '') === 'w') {
                $seguro = $esPtr($types[$T[$i + 2][1]] ?? null);
            } elseif ($p === '(' && in_array($T[$i - 2][1] ?? '', ['time'], true)) {
                $seguro = true;
            } elseif ($p === 'return' && $u !== null) {
                $seguro = str_contains($c->units[$u]['ret'], '*');
            }
            $this->add('modern.null', 'hint', $i, $i, 'NULL: en C++ moderno se escribe nullptr',
                '`NULL` es una macro heredada de C que vale `0` (un entero), así que puede confundirse con un número al elegir sobrecargas (`f(NULL)` llama a `f(int)`, no a `f(int*)`). Desde C++11 el puntero nulo es `nullptr`, que tiene su propio tipo y solo se convierte a punteros.',
                $seguro ? [$this->fix('Cambiar por nullptr', $i, $i, 'nullptr')] : []);
        }
    }

    private function rawNew(): void
    {
        $c = $this->c;
        $T = $c->t;
        foreach ($T as $t) {
            if ($t[0] === 'w' && ($t[1] === 'delete' || $t[1] === 'unique_ptr' || $t[1] === 'shared_ptr')) {
                return;
            }
        }
        $porUnidad = [];
        foreach ($T as $i => $t) {
            if ($t[1] !== 'new' || $t[0] !== 'w' || ($T[$i - 1][1] ?? '') === 'operator') {
                continue;
            }
            $u = $c->unitAt($i) ?? -1;
            if (isset($porUnidad[$u])) {
                continue;
            }
            $porUnidad[$u] = true;
            $this->add('modern.raw-new', 'info', $i, $i, '`new` sin `delete`: esa memoria no se libera nunca',
                'Cada `new` reserva memoria que hay que devolver con `delete` (o `delete[]`), y es fácil olvidarlo o saltárselo con un `return` o una excepción: es una fuga de memoria. En C++ moderno se usa **RAII**: un objeto dueño libera la memoria al salir de su ámbito. Para un solo objeto, `auto p = make_unique<Nodo>(…);` (`unique_ptr`, de `<memory>`); para muchos, un `vector<T>` en vez de `new T[n]`. Si de verdad necesitas punteros crudos (árboles, listas enlazadas), libera los nodos en un destructor.');
        }
    }

    // ───────────────────────────── flujo ─────────────────────────────

    private function emptyCatch(): void
    {
        $T = $this->c->t;
        $M = $this->c->m;
        foreach ($T as $i => $t) {
            if ($t[0] !== 'w' || $t[1] !== 'catch' || !isset($M[$i + 1]) || ($T[$M[$i + 1] + 1][1] ?? '') !== '{') {
                continue;
            }
            $o = $M[$i + 1] + 1;
            $c = $M[$o] ?? null;
            if ($c === null) {
                continue;
            }
            $dentro = substr($this->c->code, $T[$o][2] + 1, $T[$c][2] - $T[$o][2] - 1);
            if (trim($dentro) === '') {
                $this->add('flow.empty-catch', 'warning', $i, $c, 'catch vacío: el error se ignora en silencio',
                    'Si capturas una excepción y no haces nada, el fallo desaparece y luego es muy difícil saber qué pasó. Como mínimo muéstralo (`cerr << e.what() << \'\\n\';`), relánzalo (`throw;`) o añade un comentario explicando por qué es seguro ignorarlo.');
            }
        }
    }

    private function elseAfterReturn(): void
    {
        $c = $this->c;
        $T = $c->t;
        $M = $c->m;
        foreach ($T as $i => $t) {
            if ($t[0] !== 'w' || $t[1] !== 'else' || ($T[$i + 1][1] ?? '') !== '{' || ($T[$i - 1][1] ?? '') !== '}' || !isset($M[$i + 1])) {
                continue;
            }
            $cierre = $i - 1;
            $abre = $M[$cierre] ?? null;
            if ($abre === null || ($T[$abre - 1][1] ?? '') !== ')' || !isset($M[$abre - 1])) {
                continue;
            }
            $po = $M[$abre - 1];
            $kw = $po - 1;
            if (in_array($T[$kw][1] ?? '', ['constexpr', '!'], true)) {
                $kw--;
            }
            if (($T[$kw][1] ?? '') !== 'if' || ($T[$kw - 1][1] ?? '') === 'else') {
                continue;                                    // `else if` encadenado: quitar el else cambiaría el significado
            }
            $s = $abre + 1;
            $ult = null;
            while ($s < $cierre) {
                $ult = $s;
                $s = $c->stmtEnd($s) + 1;
            }
            if ($ult === null || !in_array($T[$ult][1], ['return', 'throw', 'continue', 'break'], true)) {
                continue;
            }
            // ¿es seguro quitar las llaves? No si el if declara algo (`if (auto it = …; …)`) o si el else declara un nombre que se usa después
            $fixes = [];
            $seguro = true;
            for ($q = $po + 1; $q < $M[$po]; $q++) {
                if ($T[$q][1] === ';' || ($T[$q][1] === '=' && ($T[$q - 2][0] ?? '') === 'w')) {
                    $seguro = false;
                }
            }
            $eo = $i + 1;
            $ec = $M[$eo];
            if ($seguro) {
                $u = $c->unitAt($i);
                $bloque = $u !== null ? $this->enclosingBlockEnd($eo, $c->units[$u]['close']) : $ec;
                foreach ($u !== null ? $c->locals($u)['decls'] : [] as $d) {
                    if ($d['tok'] > $eo && $d['tok'] < $ec) {
                        for ($q = $ec + 1; $q < $bloque; $q++) {
                            if ($T[$q][1] === $d['name']) {
                                $seguro = false;
                                break 2;
                            }
                        }
                    }
                }
            }
            if ($seguro) {
                $fixes[] = ['title' => 'Quitar el else y dejar su contenido', 'edits' => [
                    ['range' => $c->range($i, $i + 1), 'text' => ''],
                    ['range' => $c->range($ec, $ec), 'text' => ''],
                ]];
            }
            $this->add('flow.else-after-return', 'hint', $i, $i, 'else innecesario después de ' . $T[$ult][1],
                'El bloque anterior termina saliendo de la función (o del bucle), así que el `else` sobra: puedes quitarlo y dejar su contenido sin sangrar. Es el patrón *early return* y deja el código más plano.', $fixes);
        }
    }

    /** Fin del bloque `{…}` que contiene la ficha $i. */
    private function enclosingBlockEnd(int $i, int $lim): int
    {
        $T = $this->c->t;
        $M = $this->c->m;
        for ($k = $i - 1; $k > 0; $k--) {
            if (($T[$k][1] === '}' || $T[$k][1] === ')' || $T[$k][1] === ']') && isset($M[$k])) {
                $k = $M[$k];
                continue;
            }
            if ($T[$k][1] === '{' && isset($M[$k]) && $M[$k] > $i) {
                return $M[$k];
            }
        }
        return $lim;
    }
}
