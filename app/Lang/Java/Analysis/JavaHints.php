<?php
declare(strict_types=1);

namespace Playground\Lang\Java\Analysis;

defined('PG_ROOT') or exit;

/**
 * Pistas de estilo, rendimiento y errores típicos de Java, en español y con arreglo automático cuando es seguro.
 * Mismos códigos que PHP y Python donde hay equivalente (cx.*, perf.*, flow.*, unused.*).
 *
 * Forma de cada pista: {source:'analysis', severity, code, line, col, endLine, endCol, title, message, explain, fixes}
 */
final class JavaHints
{
    private const RAW = ['List', 'ArrayList', 'LinkedList', 'Map', 'HashMap', 'TreeMap', 'LinkedHashMap', 'Set', 'HashSet', 'TreeSet', 'LinkedHashSet',
        'Queue', 'Deque', 'ArrayDeque', 'PriorityQueue', 'Stack', 'Iterator', 'Collection', 'Optional', 'Comparator', 'Iterable'];
    private const WRAPPERS = ['Integer', 'Long', 'Double', 'Float', 'Short', 'Byte', 'Character', 'Boolean'];
    /** Métodos que devuelven un String: `a == s.trim()` también compara referencias. */
    private const STRING_RET = ['toString', 'substring', 'trim', 'strip', 'toUpperCase', 'toLowerCase', 'nextLine', 'next', 'readLine', 'concat',
        'repeat', 'replace', 'replaceAll', 'valueOf', 'join', 'format', 'getName', 'name'];

    /** @var list<array<string,mixed>> */
    private array $out = [];

    /** @param list<array<string,mixed>> $rows */
    public function __construct(private readonly JavaCode $c, private readonly JavaMetrics $m)
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
            $this->performance($unit, $info);
            $this->comparisons($unit, $info);
            $this->unused($unit, $info);
        }
        $this->rawTypes();
        $this->emptyCatch();
        $this->elseAfterReturn();
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

    private function fix(string $title, array $edits): array
    {
        return ['title' => $title, 'edits' => $edits];
    }

    // ───────────────────────────── complejidad ─────────────────────────────

    /** @param array<string,mixed> $unit @param array<string,mixed> $row */
    private function complexity(array $unit, array $row): void
    {
        $tok = $unit['nameTok'];
        $name = $row['qname'] . '()';
        if ($row['cc'] > 20) {
            $this->add('cx.cyclomatic', 'warning', $tok, $tok, sprintf('%s: complejidad ciclomática muy alta (%d, nota %s)', $name, $row['cc'], $row['grade']),
                'La complejidad ciclomática cuenta los caminos independientes del código (cada `if`, bucle, `case`, `&&`, `||`, `?:`...). Por encima de 20 es muy difícil de probar y de entender. Divide el método en métodos más pequeños, cada uno con una sola responsabilidad.');
        } elseif ($row['cc'] > 10) {
            $this->add('cx.cyclomatic', 'info', $tok, $tok, sprintf('%s: complejidad ciclomática alta (%d, nota %s)', $name, $row['cc'], $row['grade']),
                'Más de 10 caminos independientes: ya cuesta probarlo entero. Busca bloques que puedas extraer a su propio método o condiciones que simplificar con *early return*.');
        }
        if ($row['cognitive'] > 15) {
            $this->add('cx.cognitive', 'warning', $tok, $tok, sprintf('%s: complejidad cognitiva %d', $name, $row['cognitive']),
                'La complejidad cognitiva mide lo difícil que es **leer** el código: penaliza el anidamiento. Por encima de 15 conviene reducir niveles con *early return* (`if (!cond) return;`) y extraer métodos.');
        }
        if ($row['nesting'] > 3) {
            $this->add('cx.nesting', 'info', $tok, $tok, sprintf('%s: %d niveles de anidamiento', $name, $row['nesting']),
                'Más de 3 estructuras de control dentro de otras cuesta seguir. Sal pronto con `return`/`continue` en vez de anidar `else`, o extrae el bloque interno a un método.');
        }
        if ($row['loc'] > 50) {
            $this->add('cx.length', 'info', $tok, $tok, sprintf('%s: %d líneas de código', $name, $row['loc']),
                'Un método largo suele hacer varias cosas. Prueba a separarlo en pasos con nombre claro.');
        }
        if ($row['params'] > 5) {
            $this->add('cx.params', 'info', $tok, $tok, sprintf('%s: %d parámetros', $name, $row['params']),
                'Muchos parámetros son difíciles de recordar y de ordenar bien. Agrúpalos en un objeto (un `record`, por ejemplo).');
        }
        if (($row['recursive'] ?? false) && ($row['bigOKey'] ?? '') === 'exp' && str_contains(implode(' ', $row['bigOWhy']), 'sin memoización')) {
            $this->add('perf.recursion', 'warning', $tok, $tok, sprintf('%s: recursión exponencial sin memoización', $name),
                'Varias llamadas recursivas sobre `n-1`, `n-2`... recalculan los mismos subproblemas una y otra vez. Guarda los resultados ya calculados en un `Map<Integer, Long>` (o un array) o usa una versión iterativa: pasa de O(2ⁿ) a O(n).');
        }
    }

    // ───────────────────────────── rendimiento ─────────────────────────────

    /** @param array<string,mixed> $unit @param array<string,mixed> $info */
    private function performance(array $unit, array $info): void
    {
        $T = $this->c->t;
        foreach ($info['events'] as $e) {
            if ($e[0] !== 'cost' || $e[1] < 1) {
                continue;
            }
            [, , $a, $b, $tok, $recv, $rtype, $name] = $e;
            $fam = $rtype !== null ? rtrim($rtype, '[]') : '';
            $esLista = in_array($fam, ['ArrayList', 'List', 'LinkedList', 'Vector', 'Stack', 'Collection'], true);
            $arg0 = ($T[$tok + 2][1] ?? '');
            if ($esLista && in_array($name, ['contains', 'indexOf'], true)) {
                $this->add('perf.in-array-loop', 'warning', $tok, $tok, sprintf('%s.%s() dentro de un bucle: O(n²)', $recv, $name),
                    '`' . $recv . '.' . $name . '()` recorre la lista entera en cada llamada; dentro de un bucle el coste se multiplica. Guarda los valores en un `HashSet` (`Set<Integer> vistos = new HashSet<>();`) y consulta con `vistos.contains(x)`, que es O(1).');
            } elseif ($fam !== '' && in_array($fam, ['ArrayList', 'List', 'Vector'], true)
                && (($name === 'remove' && $arg0 === '0' && ($T[$tok + 3][1] ?? '') === ')') || ($name === 'add' && $arg0 === '0' && ($T[$tok + 3][1] ?? '') === ','))) {
                $this->add('perf.shift-loop', 'warning', $tok, $tok, sprintf('%s.%s(0...) dentro de un bucle: O(n²)', $recv, $name),
                    'Quitar o poner al principio de un `ArrayList` desplaza todos los elementos: O(n) cada vez. Para una cola o una pila usa `ArrayDeque` (`addFirst`, `pollFirst`, `offer`, `poll`), que lo hace en O(1).');
            } elseif ($fam === 'LinkedList' && ($name === 'get' || $name === 'set')) {
                $this->add('perf.get-loop', 'warning', $tok, $tok, sprintf('%s.%s(i) en un LinkedList dentro de un bucle: O(n²)', $recv, $name),
                    'Un `LinkedList` no tiene acceso directo por posición: `get(i)` recorre la lista desde un extremo, O(n). Dentro de un bucle da O(n²). Usa un `ArrayList` o recorre con un `for (var x : lista)`.');
            } elseif (in_array($name, ['sort', 'sorted'], true) && $a >= 1 && $b >= 1) {
                $this->add('perf.sort-loop', 'warning', $tok, $tok, sprintf('%s() dentro de un bucle', $name),
                    'Ordenar cuesta O(n log n) y aquí se repite en cada vuelta. Si puedes, ordena una sola vez fuera del bucle, o usa una estructura que mantenga el orden (`TreeSet`, `PriorityQueue`).');
            }
        }
        // String += dentro de un bucle
        $types = $info['locals']['types'];
        foreach ($info['depth'] as $i => $d) {
            if ($d < 1 || $T[$i][0] !== 'w' || ($types[$T[$i][1]] ?? '') !== 'String' || ($T[$i - 1][1] ?? '') === '.') {
                continue;
            }
            $n = $T[$i + 1][1] ?? '';
            if ($n === '+=' || ($n === '=' && ($T[$i + 2][1] ?? '') === $T[$i][1] && ($T[$i + 3][1] ?? '') === '+')) {
                $this->add('perf.concat-loop', 'warning', $i, $i + 1, sprintf('%s += … dentro de un bucle: O(n²)', $T[$i][1]),
                    'Los `String` son inmutables: cada `+=` crea una cadena nueva copiando la anterior, así que n concatenaciones cuestan O(n²). Usa un `StringBuilder`: `sb.append(...)` es O(1) amortizado y al final `sb.toString()`.');
            }
        }
    }

    // ───────────────────────────── == entre objetos ─────────────────────────────

    /** @param array<string,mixed> $unit @param array<string,mixed> $info */
    private function comparisons(array $unit, array $info): void
    {
        $T = $this->c->t;
        $types = $info['locals']['types'];
        for ($i = $unit['open'] + 1; $i < $unit['close']; $i++) {
            $op = $T[$i][1];
            if (($op !== '==' && $op !== '!=') || $T[$i][0] !== 'p') {
                continue;
            }
            $l = $this->operand($i - 1, -1, $types);
            $r = $this->operand($i + 1, 1, $types);
            if ($l === null || $r === null || $l['null'] || $r['null']) {
                continue;
            }
            $neg = $op === '!=';
            if ($l['type'] === 'String' || $r['type'] === 'String') {
                $fixes = [];
                if ($l['simple'] && $r['simple']) {
                    $lit = $l['lit'] ? $l : ($r['lit'] ? $r : null);
                    $otro = $lit === $l ? $r : $l;
                    $txt = ($neg ? '!' : '') . ($lit !== null ? $lit['text'] . '.equals(' . $otro['text'] . ')' : $l['text'] . '.equals(' . $r['text'] . ')');
                    $fixes[] = $this->fix('Comparar con equals()', [['range' => $this->c->range($l['from'], $r['to']), 'text' => $txt]]);
                }
                $this->add('eq.string', 'warning', $i, $i, 'Los String se comparan con equals(), no con ' . $op,
                    '`==` compara si son **el mismo objeto**, no si tienen el mismo texto: `new String("a") == "a"` es `false`, y con textos leídos del teclado o construidos con `+` casi nunca coincide. Usa `a.equals(b)` (o `"literal".equals(a)`, que además no falla si `a` es `null`; `equalsIgnoreCase` ignora mayúsculas).', $fixes);
            } elseif (in_array($l['type'], self::WRAPPERS, true) && in_array($r['type'], self::WRAPPERS, true)) {
                $this->add('eq.wrapper', 'warning', $i, $i, 'Integer/Long... se comparan con equals(), no con ' . $op,
                    'Entre dos objetos `Integer` (o `Long`, `Double`...), `==` compara referencias. Solo funciona por casualidad con valores pequeños (-128..127, que Java reutiliza) y falla con `1000`. Usa `a.equals(b)` o convierte a primitivo (`a.intValue() == b.intValue()`).');
            }
        }
    }

    /**
     * Operando simple a un lado de `==`: {type, text, from, to, lit, null, simple}. null si no se reconoce.
     * @param array<string,string> $types
     */
    private function operand(int $i, int $dir, array $types): ?array
    {
        $T = $this->c->t;
        $t = $T[$i] ?? null;
        if ($t === null) {
            return null;
        }
        $r = ['type' => '', 'text' => $t[1], 'from' => $i, 'to' => $i, 'lit' => false, 'null' => $t[1] === 'null', 'simple' => false];
        if ($t[0] === 's') {
            if ($t[1][0] === "'") {
                return null;
            }
            $r['type'] = 'String';
            $r['lit'] = true;
        } elseif ($t[0] === 'w' && !isset(JavaCode::KW[$t[1]])) {
            if ($dir > 0) {
                $n = $T[$i + 1][1] ?? '';
                if ($n === '(') {                               // llamada: solo si devuelve String conocido
                    if (!in_array($t[1], self::STRING_RET, true) || !isset($this->c->m[$i + 1])) {
                        return null;
                    }
                    $r['type'] = 'String';
                    return $r;
                }
                if ($n === '.' || $n === '[') {
                    return null;
                }
            } else {
                $p = $T[$i - 1][1] ?? '';
                if ($p === '.') {
                    if (($T[$i - 2][1] ?? '') === 'this') {
                        $r['from'] = $i - 2;
                        $r['text'] = 'this.' . $t[1];
                    } else {
                        return null;
                    }
                }
            }
            $r['type'] = $types[$t[1]] ?? '';
        } elseif ($t[1] === ')' && $dir < 0 && isset($this->c->m[$i])) {
            $po = $this->c->m[$i];
            $name = $T[$po - 1] ?? null;
            if ($name !== null && $name[0] === 'w' && in_array($name[1], self::STRING_RET, true)) {
                $r['type'] = 'String';
                return $r;
            }
            return null;
        } else {
            return null;
        }
        // ¿es todo el operando? (que no sea parte de una expresión mayor: a + b == c, x == y.z, a == b + c)
        $antes = $T[$r['from'] - 1][1] ?? '';
        $despues = $T[$r['to'] + 1][1] ?? '';
        $bordeIz = $dir < 0 ? $antes : ($T[$i - 2][1] ?? '');
        $r['simple'] = $r['type'] !== '' && !in_array($dir < 0 ? $antes : $despues, $dir < 0 ? ['+', '-', '*', '/', '%', '.', '!', '~'] : ['+', '-', '*', '/', '%', '.', '(', '[', '?'], true);
        if ($dir > 0 && ($T[$i + 1][0] ?? '') === 'p' && in_array($T[$i + 1][1], ['+', '-', '*', '/', '%', '.', '(', '['], true)) {
            $r['simple'] = false;
        }
        unset($bordeIz);
        return $r;
    }

    // ───────────────────────────── sin usar ─────────────────────────────

    /** @param array<string,mixed> $unit @param array<string,mixed> $info */
    private function unused(array $unit, array $info): void
    {
        $T = $this->c->t;
        $freq = [];
        for ($i = $unit['open'] + 1; $i < $unit['close']; $i++) {
            if ($T[$i][0] === 'w' && ($T[$i - 1][1] ?? '') !== '.') {
                $freq[$T[$i][1]] = ($freq[$T[$i][1]] ?? 0) + 1;
            }
        }
        foreach ($info['locals']['decls'] as $d) {
            if (!in_array($d['prev'], [';', '{', '}', 'final'], true) || ($d['ctx'] ?? '') !== '' || ($freq[$d['name']] ?? 0) > 1) {
                continue;
            }
            $this->add('unused.var', 'hint', $d['tok'], $d['tok'], sprintf('La variable %s no se usa', $d['name']),
                'Se declara pero nunca se lee. Si ya no hace falta, bórrala; si te faltaba usarla, quizá es un error (¿otro nombre?).');
        }
        if (($unit['static'] || $unit['private']) && !$unit['override'] && $unit['name'] !== 'main') {
            foreach ($unit['params'] as $p) {
                if (($freq[$p['name']] ?? 0) === 0) {
                    $this->add('unused.param', 'hint', $p['tok'], $p['tok'], sprintf('El parámetro %s de %s() no se usa', $p['name'], $unit['name']),
                        'Ese parámetro no se lee en el cuerpo del método. Quítalo (y de las llamadas) o úsalo.');
                }
            }
        }
    }

    // ───────────────────────────── tipos crudos ─────────────────────────────

    private function rawTypes(): void
    {
        $T = $this->c->t;
        $lineas = [];
        foreach ($T as $i => $t) {
            if ($t[0] !== 'w' || !in_array($t[1], self::RAW, true)) {
                continue;
            }
            $n = $T[$i + 1] ?? ['', ''];
            $p = $T[$i - 1][1] ?? '';
            if ($p === '.' || $p === 'import' || $p === 'package' || $n[1] === '<' || $n[1] === '.' || $n[1] === '::') {
                continue;
            }
            $crudo = ($p === 'new' && $n[1] === '(') || ($p !== 'new' && $n[0] === 'w' && !isset(JavaCode::KW[$n[1]]) && in_array($T[$i + 2][1] ?? '', ['=', ';', ',', ')', ':'], true));
            if (!$crudo || isset($lineas[$t[3]])) {
                continue;
            }
            $lineas[$t[3]] = true;
            $this->add('types.raw', 'info', $i, $i, sprintf('%s sin tipo de elementos (tipo crudo)', $t[1]),
                'Sin los `<...>`, `' . $t[1] . '` guarda `Object` y el compilador no comprueba nada: los errores de tipo aparecen al ejecutar (`ClassCastException`). Indica el tipo: `' . $t[1] . '<Integer>`, `Map<String, Integer>`... y con `new` basta el rombo: `new ' . $t[1] . '<>()`.');
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
            // con un comentario dentro se considera intencionado (los comentarios no son fichas: se mira el texto)
            $dentro = substr($this->c->code, $T[$o][2] + 1, $T[$c][2] - $T[$o][2] - 1);
            if (trim($dentro) === '') {
                $this->add('flow.empty-catch', 'warning', $i, $c, 'catch vacío: el error se ignora en silencio',
                    'Si capturas una excepción y no haces nada, el fallo desaparece y luego es muy difícil saber qué pasó. Como mínimo muéstralo (`e.printStackTrace();`), relánzalo (`throw e;`) o añade un comentario explicando por qué es seguro ignorarlo.');
            }
        }
    }

    private function elseAfterReturn(): void
    {
        $T = $this->c->t;
        $M = $this->c->m;
        foreach ($T as $i => $t) {
            if ($t[0] !== 'w' || $t[1] !== 'else' || ($T[$i + 1][1] ?? '') !== '{' || ($T[$i - 1][1] ?? '') !== '}' || !isset($M[$i + 1])) {
                continue;
            }
            $cierre = $i - 1;
            $abre = $M[$cierre] ?? null;
            if ($abre === null || ($T[$abre - 1][1] ?? '') !== ')' || !isset($M[$abre - 1])) {
                continue;
            }
            $kw = $M[$abre - 1] - 1;
            if (($T[$kw][1] ?? '') !== 'if' || ($T[$kw - 1][1] ?? '') === 'else') {
                continue;                                    // `else if` encadenado: quitar el else cambiaría el significado
            }
            $s = $abre + 1;
            $ult = null;
            while ($s < $cierre) {
                $ult = $s;
                $s = $this->c->stmtEnd($s) + 1;
            }
            if ($ult !== null && in_array($T[$ult][1], ['return', 'throw', 'continue', 'break'], true)) {
                $fx = $this->fix('Quitar el else y dejar su contenido', [
                    ['range' => $this->c->range($i, $i + 1), 'text' => ''],
                    ['range' => $this->c->range($M[$i + 1], $M[$i + 1]), 'text' => ''],
                ]);
                $this->add('flow.else-after-return', 'hint', $i, $i, 'else innecesario después de ' . $T[$ult][1],
                    'El bloque anterior termina saliendo del método (o del bucle), así que el `else` sobra: puedes quitarlo y dejar su contenido sin sangrar. Es el patrón *early return* y deja el código más plano.', [$fx]);
            }
        }
    }
}
