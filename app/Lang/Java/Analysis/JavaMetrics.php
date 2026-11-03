<?php
declare(strict_types=1);

namespace Playground\Lang\Java\Analysis;

use Playground\Lang\Php\Analysis\Metrics;

defined('PG_ROOT') or exit;

/**
 * Métricas de cada método de Java con UNA sola pasada por sus fichas: complejidad ciclomática (McCabe), cognitiva
 * (Sonar), anidamiento y estimación de O(). Mismas fórmulas, etiquetas y claves que Metrics (PHP) y pg_analisis (Python).
 *
 * Idea: una pila de "rangos" (el cuerpo de cada if/for/while/switch/catch/lambda). Mientras se avanza por las fichas
 * se sabe en todo momento cuánta anidación y cuántos bucles rodean a la ficha actual, sin recorrer nada dos veces.
 */
final class JavaMetrics
{
    /** Tipos del JDK agrupados por comportamiento. */
    private const FAMILIA = [
        'ArrayList' => 'AL', 'List' => 'AL', 'Vector' => 'AL', 'Stack' => 'AL', 'Collection' => 'AL', 'CopyOnWriteArrayList' => 'AL',
        'LinkedList' => 'LL',
        'ArrayDeque' => 'DQ', 'Deque' => 'DQ', 'Queue' => 'DQ',
        'HashMap' => 'HASH', 'LinkedHashMap' => 'HASH', 'Map' => 'HASH', 'HashSet' => 'HASH', 'LinkedHashSet' => 'HASH', 'Set' => 'HASH',
        'ConcurrentHashMap' => 'HASH', 'Hashtable' => 'HASH', 'EnumMap' => 'HASH',
        'TreeMap' => 'TREE', 'TreeSet' => 'TREE', 'SortedMap' => 'TREE', 'NavigableMap' => 'TREE', 'SortedSet' => 'TREE', 'NavigableSet' => 'TREE',
        'PriorityQueue' => 'PQ', 'String' => 'STR', 'StringBuilder' => 'SB', 'StringBuffer' => 'SB',
    ];
    /** Costes por familia y método: [grado de n, potencia de log n]. */
    private const COSTES = [
        'AL' => ['contains' => [1, 0], 'indexOf' => [1, 0], 'lastIndexOf' => [1, 0], 'remove' => [1, 0], 'addAll' => [1, 0], 'containsAll' => [1, 0],
            'removeAll' => [1, 0], 'retainAll' => [1, 0], 'removeIf' => [1, 0], 'forEach' => [1, 0], 'toArray' => [1, 0], 'stream' => [1, 0],
            'sort' => [1, 1], 'replaceAll' => [1, 0]],
        'LL' => ['get' => [1, 0], 'set' => [1, 0], 'contains' => [1, 0], 'indexOf' => [1, 0], 'lastIndexOf' => [1, 0], 'remove' => [1, 0],
            'addAll' => [1, 0], 'removeIf' => [1, 0], 'forEach' => [1, 0], 'stream' => [1, 0], 'sort' => [1, 1], 'toArray' => [1, 0]],
        'DQ' => ['contains' => [1, 0], 'remove' => [1, 0], 'forEach' => [1, 0], 'stream' => [1, 0], 'removeIf' => [1, 0], 'addAll' => [1, 0]],
        'HASH' => ['containsValue' => [1, 0], 'putAll' => [1, 0], 'addAll' => [1, 0], 'containsAll' => [1, 0], 'removeAll' => [1, 0],
            'retainAll' => [1, 0], 'forEach' => [1, 0], 'stream' => [1, 0], 'toArray' => [1, 0], 'removeIf' => [1, 0]],
        'TREE' => ['get' => [0, 1], 'put' => [0, 1], 'containsKey' => [0, 1], 'contains' => [0, 1], 'add' => [0, 1], 'remove' => [0, 1],
            'first' => [0, 1], 'last' => [0, 1], 'firstKey' => [0, 1], 'lastKey' => [0, 1], 'floor' => [0, 1], 'ceiling' => [0, 1], 'higher' => [0, 1],
            'lower' => [0, 1], 'floorKey' => [0, 1], 'ceilingKey' => [0, 1], 'higherKey' => [0, 1], 'lowerKey' => [0, 1], 'pollFirst' => [0, 1],
            'pollLast' => [0, 1], 'firstEntry' => [0, 1], 'lastEntry' => [0, 1], 'containsValue' => [1, 0], 'putAll' => [1, 1], 'addAll' => [1, 1],
            'forEach' => [1, 0], 'stream' => [1, 0], 'toArray' => [1, 0], 'removeIf' => [1, 0]],
        'PQ' => ['add' => [0, 1], 'offer' => [0, 1], 'poll' => [0, 1], 'contains' => [1, 0], 'addAll' => [1, 1], 'forEach' => [1, 0],
            'stream' => [1, 0], 'removeIf' => [1, 0]],
        'STR' => ['contains' => [1, 0], 'indexOf' => [1, 0], 'lastIndexOf' => [1, 0], 'replace' => [1, 0], 'replaceAll' => [1, 0], 'split' => [1, 0],
            'toLowerCase' => [1, 0], 'toUpperCase' => [1, 0], 'toCharArray' => [1, 0], 'matches' => [1, 0], 'repeat' => [1, 0], 'concat' => [1, 0],
            'chars' => [1, 0], 'strip' => [1, 0], 'trim' => [1, 0]],
        'SB' => ['insert' => [1, 0], 'reverse' => [1, 0], 'indexOf' => [1, 0], 'toString' => [1, 0], 'delete' => [1, 0], 'deleteCharAt' => [1, 0],
            'replace' => [1, 0]],
    ];
    /** Llamadas estáticas `Clase.método`. */
    private const ESTATICOS = [
        'Collections.sort' => [1, 1], 'Collections.reverse' => [1, 0], 'Collections.shuffle' => [1, 0], 'Collections.max' => [1, 0],
        'Collections.min' => [1, 0], 'Collections.frequency' => [1, 0], 'Collections.binarySearch' => [0, 1], 'Collections.nCopies' => [1, 0],
        'Arrays.sort' => [1, 1], 'Arrays.fill' => [1, 0], 'Arrays.copyOf' => [1, 0], 'Arrays.copyOfRange' => [1, 0], 'Arrays.stream' => [1, 0],
        'Arrays.toString' => [1, 0], 'Arrays.equals' => [1, 0], 'Arrays.binarySearch' => [0, 1], 'Arrays.deepToString' => [1, 0],
        'String.join' => [1, 0], 'IntStream.range' => [1, 0], 'IntStream.rangeClosed' => [1, 0], 'Stream.of' => [1, 0],
    ];
    /** Métodos que ejecutan su lambda una vez por elemento: lo de dentro cuenta como un bucle. */
    private const CALLBACKS = ['forEach' => 1, 'removeIf' => 1, 'replaceAll' => 1, 'map' => 1, 'filter' => 1, 'flatMap' => 1, 'mapToInt' => 1,
        'mapToObj' => 1, 'mapToDouble' => 1, 'mapToLong' => 1, 'anyMatch' => 1, 'allMatch' => 1, 'noneMatch' => 1, 'reduce' => 1, 'peek' => 1,
        'takeWhile' => 1, 'dropWhile' => 1];
    private const MEMO = '/^(memo|memoria|cache|cach[eé]|dp|tabla|table|seen|visited|visitados?|vistos?|vis)(?![a-z])/i';

    /** @var array<int,array<string,mixed>> por índice de unidad: depth, events, locals, row */
    public array $info = [];

    public function __construct(private readonly JavaCode $c)
    {
    }

    /** @return array{units:list<array<string,mixed>>, summary:array<string,mixed>} */
    public function compute(): array
    {
        $rows = [];
        foreach ($this->c->units as $u => $unit) {
            $rows[$u] = $this->measure($u, $unit);
        }
        // O(): tres pasadas para que las llamadas entre métodos propaguen su coste (igual que en PHP)
        $callee = [];
        for ($pass = 0; $pass < 3; $pass++) {
            foreach ($rows as $u => &$row) {
                $row['_cx'] = $this->bigO($u, $callee);
            }
            unset($row);
            $callee = [];
            foreach ($rows as $u => $row) {
                $callee[strtolower($this->c->units[$u]['cls']) . '::' . strtolower($this->c->units[$u]['name'])] = $row['_cx'];
            }
        }
        $units = [];
        foreach ($rows as $u => $row) {
            $cx = $row['_cx'];
            unset($row['_cx']);
            $row['bigO'] = Metrics::label($cx);
            $row['bigOWhy'] = $cx['why'];
            $row['bigOKey'] = Metrics::key($cx);
            $row['recursive'] = $cx['recursive'];
            $this->info[$u]['cx'] = $cx;
            $this->info[$u]['row'] = $row;
            $units[] = $row;
        }
        usort($units, static fn(array $a, array $b): int => $a['startLine'] <=> $b['startLine']);
        return ['units' => $units, 'summary' => $this->summarize($units)];
    }

    // ───────────────────────────── una pasada por el método ─────────────────────────────

    private function measure(int $u, array $unit): array
    {
        $c = $this->c;
        $T = $c->t;
        $M = $c->m;
        $open = $unit['open'];
        $close = $unit['close'];
        $loc = $c->locals($unit);
        $types = $loc['types'];
        $cc = 1;
        $cog = 0;
        $maxNest = 0;
        $returns = 0;
        $stack = [];       // [fin, anida, bucle, control]
        $nest = 0;
        $loop = 0;
        $ctl = 0;
        $lastOp = null;
        $opStack = [];
        $doTails = [];
        $pend = [];        // índice => rango a empujar (el for-each empieza a contar tras su cabecera)
        $expectArrow = false;
        $depth = [];
        $ev = [];
        $selfCalls = 0;
        $nparams = count($unit['params']);

        for ($i = $open + 1; $i < $close; $i++) {
            while ($stack && $stack[count($stack) - 1][0] < $i) {
                [, $a, $b, $k] = array_pop($stack);
                $nest -= $a ? 1 : 0;
                $loop -= $b ? 1 : 0;
                $ctl -= $k ? 1 : 0;
            }
            if (isset($pend[$i])) {
                [$fin, $a, $b, $k] = $pend[$i];
                $stack[] = [$fin, $a, $b, $k];
                $nest += $a ? 1 : 0;
                $loop += $b ? 1 : 0;
                $ctl += $k ? 1 : 0;
            }
            $depth[$i] = $loop;
            [$ty, $x] = $T[$i];

            if ($ty === 'w') {
                switch ($x) {
                    case 'if':
                        $cc++;
                        $cog += ($T[$i - 1][1] === 'else') ? 1 : 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        if (isset($M[$i + 1])) {
                            $this->push($stack, $nest, $loop, $ctl, $c->stmtEnd($M[$i + 1] + 1), true, false, true);
                        }
                        continue 2;
                    case 'else':
                        if (($T[$i + 1][1] ?? '') !== 'if') {
                            $cog++;
                            $this->push($stack, $nest, $loop, $ctl, $c->stmtEnd($i + 1), true, false, false);
                        }
                        continue 2;
                    case 'for':
                    case 'while':
                        if ($x === 'while' && isset($doTails[$i])) {
                            continue 2;
                        }
                        $cc++;
                        $cog += 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        if (isset($M[$i + 1])) {
                            $pc = $M[$i + 1];
                            $fin = $c->stmtEnd($pc + 1);
                            $each = false;
                            if ($x === 'for') {
                                for ($q = $i + 2; $q < $pc; $q++) {
                                    if ($T[$q][1] === ':') {
                                        $each = true;
                                        break;
                                    }
                                    if (($T[$q][1] === '(' || $T[$q][1] === '[' || $T[$q][1] === '{') && isset($M[$q])) {
                                        $q = $M[$q];
                                    }
                                }
                            }
                            $ev[] = ['loop', $loop + 1, $this->halves($i, $pc, $fin)];
                            if ($each) {
                                $pend[$pc] = [$fin, true, true, true];     // la lista a recorrer se evalúa una vez, fuera del bucle
                            } else {
                                $this->push($stack, $nest, $loop, $ctl, $fin, true, true, true);
                            }
                        }
                        continue 2;
                    case 'do':
                        $cc++;
                        $cog += 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        $fin = $c->stmtEnd($i + 1);
                        if (($T[$fin + 1][1] ?? '') === 'while' && isset($M[$fin + 2])) {
                            $doTails[$fin + 1] = true;
                            $fin = $M[$fin + 2] + 1;
                        }
                        $ev[] = ['loop', $loop + 1, $this->halves($i, $fin, $fin)];
                        $this->push($stack, $nest, $loop, $ctl, $fin, true, true, true);
                        continue 2;
                    case 'switch':
                        $cog += 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        if (isset($M[$i + 1], $M[$M[$i + 1] + 1])) {
                            $this->push($stack, $nest, $loop, $ctl, $M[$M[$i + 1] + 1], true, false, true);
                        }
                        continue 2;
                    case 'case':
                        $cc++;
                        $expectArrow = true;
                        continue 2;
                    case 'default':
                        $expectArrow = true;
                        continue 2;
                    case 'catch':
                        $cc++;
                        $cog += 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        if (isset($M[$i + 1], $M[$M[$i + 1] + 1])) {
                            $this->push($stack, $nest, $loop, $ctl, $M[$M[$i + 1] + 1], true, false, true);
                        }
                        continue 2;
                    case 'return':
                        $returns++;
                        continue 2;
                }
                // llamadas: nombre seguido de '('
                if (($T[$i + 1][1] ?? '') === '(' && isset($M[$i + 1]) && !isset(JavaCode::KW[$x])) {
                    $prev = $T[$i - 1][1];
                    // `new X(` es un constructor y `void run(` (tipo + nombre) una declaración, p. ej. de una clase anónima
                    if ($prev === 'new' || ($T[$i - 1][0] === 'w' && !in_array($prev, ['return', 'throw', 'else', 'case', 'yield', 'do', 'assert'], true))) {
                        continue;
                    }
                    $po = $i + 1;
                    $pc = $M[$po];
                    $nargs = $this->argCount($po, $pc);
                    $recv = null;
                    $rtype = null;
                    $qual = false;
                    if ($prev === '.') {
                        $qual = true;
                        $r = $T[$i - 2] ?? null;
                        if ($r !== null && $r[0] === 'w') {
                            $recv = $r[1];
                            $rtype = $types[$recv] ?? null;
                        } elseif ($r !== null && $r[1] === ')') {
                            $recv = ')';
                        }
                    }
                    // recursión: this.f(...) / f(...) con los mismos parámetros
                    if ($x === $unit['name'] && !$unit['ctor'] && $nargs === $nparams
                        && (!$qual || ($recv === 'this' && ($T[$i - 3][1] ?? '') !== '.') || $recv === $unit['cls'])) {
                        $selfCalls++;
                        [$div, $dec] = $this->argShape($po, $pc);
                        $ev[] = ['self', $loop, $div, $dec, $i];
                    } else {
                        $coste = $this->coste($x, $recv, $rtype, $po, $pc, $nargs);
                        if ($coste !== null) {
                            $ev[] = ['cost', $loop, $coste[0], $coste[1], $i, $recv, $rtype, $x];
                        }
                        if (!$qual || $recv === 'this' || ($recv !== null && $recv !== ')' && $c->isUserClass($recv) && !isset($types[$recv]))) {
                            $cls = $qual && $recv !== 'this' ? $recv : $unit['cls'];
                            $ev[] = ['call', $loop, strtolower((string) $cls) . '::' . strtolower($x), $x, $i];
                        } elseif ($rtype !== null && $c->isUserClass(rtrim($rtype, '[]'))) {
                            $ev[] = ['call', $loop, strtolower($rtype) . '::' . strtolower($x), $x, $i];
                        }
                    }
                    // el lambda del argumento se ejecuta una vez por elemento
                    if (isset(self::CALLBACKS[$x]) && $qual && !($rtype === 'Optional') && $this->hasLambda($po, $pc)) {
                        $this->push($stack, $nest, $loop, $ctl, $pc, false, true, false);
                    }
                }
                continue;
            }

            if ($ty !== 'p') {
                continue;
            }
            switch ($x) {
                case '&&':
                case '||':
                    $cc++;
                    if ($x !== $lastOp) {
                        $cog++;
                    }
                    $lastOp = $x;
                    break;
                case '?':
                    $nx = $T[$i + 1][1] ?? '';
                    if (!($nx === '>' || $nx === 'extends' || ($nx === 'super' && ($T[$i + 2][1] ?? '') !== '.') || ($T[$i - 1][1] === '<')
                        || ($T[$i - 1][1] === ',' && ($nx === '>' || $nx === 'extends')))) {
                        $cc++;
                        $cog += 1 + $nest;
                    }
                    break;
                case '->':
                    if ($expectArrow) {
                        $expectArrow = false;
                    } elseif (($T[$i + 1][1] ?? '') === '{' && isset($M[$i + 1])) {
                        $this->push($stack, $nest, $loop, $ctl, $M[$i + 1], true, false, false);     // lambda con bloque
                    }
                    break;
                case ':':
                case ';':
                    $expectArrow = false;
                    break;
            }
            // la secuencia de && / || se reinicia al cambiar de expresión
            if ($x === ';' || $x === '{' || $x === '}' || $x === ',') {
                $lastOp = null;
            } elseif ($x === '(') {
                $opStack[] = $lastOp;
                $lastOp = null;
            } elseif ($x === ')') {
                $lastOp = $opStack ? array_pop($opStack) : null;
            }
        }
        if ($selfCalls > 0) {
            $cog++;
        }
        // memoización: algún campo, parámetro o local con nombre de caché
        $memo = false;
        foreach (array_keys($types) as $nm) {
            if (preg_match(self::MEMO, (string) $nm)) {
                $memo = true;
                break;
            }
        }
        $this->info[$u] = ['depth' => $depth, 'events' => $ev, 'locals' => $loc, 'memo' => $memo, 'self' => $selfCalls];

        $lineas = [];
        for ($q = $unit['first']; $q <= $close; $q++) {
            $lineas[$T[$q][3]] = true;
        }
        return [
            'name' => $unit['name'], 'qname' => $unit['cls'] . '.' . $unit['name'], 'kind' => 'method', 'class' => $unit['cls'],
            'startLine' => $T[$unit['first']][3], 'endLine' => $T[$close][3], 'loc' => count($lineas),
            'params' => $nparams, 'signature' => array_column($unit['params'], 'text'),
            'cc' => $cc, 'cognitive' => $cog, 'nesting' => $maxNest, 'returns' => $returns, 'grade' => Metrics::grade($cc),
        ];
    }

    /** Empuja un rango a la pila actualizando los contadores (pasados por valor: se recalculan al volver). */
    private function push(array &$stack, int &$nest, int &$loop, int &$ctl, int $fin, bool $anida, bool $bucle, bool $control): void
    {
        $stack[] = [$fin, $anida, $bucle, $control];
        $nest += $anida ? 1 : 0;
        $loop += $bucle ? 1 : 0;
        $ctl += $control ? 1 : 0;
    }

    private function argCount(int $po, int $pc): int
    {
        if ($pc === $po + 1) {
            return 0;
        }
        $n = 1;
        for ($i = $po + 1; $i < $pc; $i++) {
            $x = $this->c->t[$i][1];
            if (($x === '(' || $x === '[' || $x === '{') && isset($this->c->m[$i])) {
                $i = $this->c->m[$i];
            } elseif ($x === ',') {
                $n++;
            }
        }
        return $n;
    }

    private function hasLambda(int $po, int $pc): bool
    {
        for ($i = $po + 1; $i < $pc; $i++) {
            if ($this->c->t[$i][1] === '->' || $this->c->t[$i][1] === '::') {
                return true;
            }
        }
        return false;
    }

    /** Coste [grado, log] de una llamada o null si es O(1) / desconocida. */
    private function coste(string $name, ?string $recv, ?string $rtype, int $po, int $pc, int $nargs): ?array
    {
        $T = $this->c->t;
        if ($recv !== null && $rtype === null && $recv !== ')' && ctype_upper($recv[0])) {
            $c = self::ESTATICOS[$recv . '.' . $name] ?? null;
            return $c !== null && ($c[0] > 0 || $c[1] > 0) ? $c : null;
        }
        if ($recv === ')') {                                       // cadena de streams: sorted() ordena; distinct() recorre
            return match ($name) {
                'sorted' => [1, 1], 'distinct' => [1, 0], 'toList' => null, default => null,
            };
        }
        if ($rtype === null) {
            return null;
        }
        $fam = self::FAMILIA[rtrim($rtype, '[]')] ?? null;
        if ($fam === null || str_ends_with($rtype, '[]')) {
            return null;
        }
        $c = self::COSTES[$fam][$name] ?? null;
        if ($c === null) {
            // casos que dependen de los argumentos
            if ($fam === 'AL' && $name === 'add' && $nargs === 2 && ($T[$po + 1][1] ?? '') === '0' && ($T[$po + 2][1] ?? '') === ',') {
                return [1, 0];                                         // add(0, x): desplaza todo
            }
            if ($fam === 'PQ' && $name === 'remove' && $nargs === 0) {
                return [0, 1];
            }
            if ($fam === 'PQ' && $name === 'remove') {
                return [1, 0];
            }
            if ($fam === 'TREE' || $fam === 'HASH' || $fam === 'PQ') {
                return null;
            }
            return null;
        }
        if ($name === 'remove' && $fam === 'DQ' && $nargs === 0) {
            return null;
        }
        if ($name === 'remove' && ($fam === 'AL') && $nargs === 1) {
            // list.remove(list.size() - 1) quita el último: O(1)
            for ($i = $po + 1; $i < $pc; $i++) {
                if ($T[$i][1] === 'size' && ($T[$i + 1][1] ?? '') === '(') {
                    return null;
                }
            }
        }
        if ($name === 'remove' && $fam === 'DQ' && $nargs === 0) {
            return null;
        }
        if ($fam === 'LL' && $name === 'remove' && $nargs === 0) {
            return null;
        }
        if ($fam === 'STR' && $name === 'replace' && $nargs !== 2) {
            return null;
        }
        if ($fam === 'SB' && $name === 'deleteCharAt') {
            for ($i = $po + 1; $i < $pc; $i++) {
                if ($T[$i][1] === 'length' || $T[$i][1] === '-') {
                    return null;                                       // quitar el último carácter
                }
            }
        }
        return $c;
    }

    /** ¿El bucle divide o duplica una variable en cada vuelta (búsqueda binaria, `i *= 2`...)? */
    private function halves(int $kw, int $pc, int $end): bool
    {
        $T = $this->c->t;
        $es = static fn(int $k, string $lit): bool => ($T[$k + 1][0] ?? '') === 'n' && preg_replace('/[lLfFdD]$/', '', $T[$k + 1][1]) === $lit
            || ($T[$k + 1][0] ?? '') === 'n' && $T[$k + 1][1] === $lit . '.0';
        $fin = $T[$kw][1] === 'do' ? $pc : $end;
        for ($k = $kw + 1; $k <= $fin && $k < count($T); $k++) {
            $x = $T[$k][1];
            if (($x === 'for' || $x === 'while' || $x === 'do') && $T[$k][0] === 'w' && $k > $kw && $k !== $pc) {
                $k = $this->c->stmtEnd($k);          // los bucles internos se miden aparte
                continue;
            }
            if ($x === '>' && ($T[$k + 1][1] ?? '') === '>' && $T[$k + 1][2] === $T[$k][2] + 1 && ($T[$k + 2][1] ?? '') === '1') {
                return true;                         // x >> 1
            }
            if ($x === '>' && ($T[$k + 1][1] ?? '') === '>=' && $T[$k + 1][2] === $T[$k][2] + 1 && ($T[$k + 2][1] ?? '') === '1') {
                return true;                         // x >>= 1
            }
            if ($x === '<' && ($T[$k + 1][1] ?? '') === '<' && $es($k + 1, '1')) {
                return true;                         // x << 1
            }
            if ($x === '/' || $x === '/=') {
                if ($es($k, '2')) {
                    return true;
                }
            }
            if ($x === '*=' && $es($k, '2')) {
                return true;
            }
            if ($x === '*' && ($es($k, '2') && ($T[$k - 2][1] ?? '') === '=' && ($T[$k - 1][1] ?? '') === ($T[$k - 3][1] ?? '-')
                || ($T[$k - 1][1] ?? '') === '2' && ($T[$k - 2][1] ?? '') === '=' && ($T[$k + 1][1] ?? '') === ($T[$k - 3][1] ?? '-'))) {
                return true;                         // i = i * 2  /  i = 2 * i
            }
            if ($x === 'floorDiv') {
                return true;
            }
        }
        return false;
    }

    /** @return array{0:bool,1:bool} [divide el problema, resta una constante] en los argumentos de una llamada */
    private function argShape(int $po, int $pc): array
    {
        $T = $this->c->t;
        $div = false;
        $dec = false;
        for ($i = $po + 1; $i < $pc; $i++) {
            $x = $T[$i][1];
            if ($x === '/' || $x === '/=' || ($x === '>' && ($T[$i + 1][1] ?? '') === '>')) {
                $div = true;
            } elseif ($T[$i][0] === 'w' && in_array($x, ['floor', 'ceil', 'round', 'floorDiv'], true)) {
                $div = true;
            } elseif ($T[$i][0] === 'w' && preg_match('/^(mid|medio|mitad|half|middle|m|centro|pivot|p|q)$/i', $x)) {
                $div = true;
            } elseif ($x === '-' || $x === '--') {
                if ($x === '--' || ($T[$i + 1][0] ?? '') === 'n') {
                    $dec = true;
                }
            }
        }
        return [$div, $dec];
    }

    // ───────────────────────────── O() ─────────────────────────────

    /** @return array{a:int,b:int,exp:?string,why:list<string>,recursive:bool} */
    private function bigO(int $u, array $callee): array
    {
        $unit = $this->c->units[$u];
        $info = $this->info[$u];
        $best = ['a' => 0, 'b' => 0];
        $why = [];
        $consider = static function (int $a, int $b, string $reason) use (&$best, &$why): void {
            if ($a > $best['a'] || ($a === $best['a'] && $b > $best['b'])) {
                $best = ['a' => $a, 'b' => $b];
            }
            if ($reason !== '' && !in_array($reason, $why, true)) {
                $why[] = $reason;
            }
        };
        $maxLoop = 0;
        $selfs = [];
        $self = ($unit['cls'] !== '' ? strtolower($unit['cls']) . '::' : '') . strtolower($unit['name']);
        foreach ($info['events'] as $e) {
            switch ($e[0]) {
                case 'loop':
                    if ($e[2]) {
                        $consider($e[1] - 1, 1, 'el bucle reduce el rango a la mitad en cada vuelta: logarítmico');
                    } else {
                        $maxLoop = max($maxLoop, $e[1]);
                        $consider($e[1], 0, '');
                    }
                    break;
                case 'cost':
                    [, $d, $a, $b, $tok, $recv, $rtype, $name] = $e;
                    if ($a > 0 || $b > 0) {
                        $lab = Metrics::label(['a' => $a, 'b' => $b, 'exp' => null]);
                        $reason = $d > 0
                            ? sprintf('%s() dentro de un bucle: %s × n%s', $name, $lab, $d > 1 ? '^' . $d : '')
                            : sprintf('%s() cuesta %s', $name, $lab);
                        $consider($d + $a, $b, $a >= 1 && ($d > 0 || $b > 0 || $a > 1) ? $reason : '');
                    } elseif ($b > 0) {
                        $consider($d, $b, '');
                    }
                    break;
                case 'call':
                    [, $d, $key, $name] = $e;
                    if (isset($callee[$key]) && $key !== $self) {
                        $cx = $callee[$key];
                        if (($cx['a'] > 0 || $cx['b'] > 0) && !$cx['exp']) {
                            $consider($d + $cx['a'], $cx['b'], sprintf('llama a %s() que cuesta %s%s', $name, Metrics::label($cx), $d > 0 ? ' dentro de un bucle' : ''));
                        }
                    }
                    break;
                case 'self':
                    $selfs[] = $e;
                    break;
            }
        }
        if ($maxLoop >= 2) {
            $why[] = sprintf('bucles anidados (profundidad %d)', $maxLoop);
        } elseif ($maxLoop === 1) {
            $why[] = 'un bucle sobre la entrada';
        }
        $recursive = false;
        $exp = null;
        if ($selfs) {
            $recursive = true;
            $c = count($selfs);
            $inLoop = false;
            $dividing = false;
            $decrementing = false;
            foreach ($selfs as $s) {
                $inLoop = $inLoop || $s[1] > 0;
                $dividing = $dividing || $s[2];
                $decrementing = $decrementing || $s[3];
            }
            $w = $best;                                            // trabajo propio, sin contar la recursión
            if ($info['memo']) {
                $best = ['a' => max(1, $w['a']), 'b' => $w['b']];
                $why[] = 'recursión con memoización o conjunto de visitados: cada subproblema se calcula una vez';
            } elseif ($inLoop) {
                $exp = $dividing ? null : 'n!';
                if ($exp) {
                    $why[] = 'llamada recursiva dentro de un bucle sin memoización (backtracking): crece de forma exponencial';
                } else {
                    $best = ['a' => $w['a'] + 1, 'b' => $w['b']];
                }
            } elseif ($c === 1) {
                if ($dividing) {
                    $best = $w['a'] === 0 ? ['a' => 0, 'b' => 1] : $w;
                    $why[] = 'recursión que divide el problema a la mitad en cada llamada';
                } else {
                    $best = ['a' => $w['a'] + 1, 'b' => $w['b']];
                    $why[] = 'recursión lineal: una llamada por nivel, n niveles';
                }
            } else {
                if ($decrementing && !$dividing) {
                    $exp = '2^n';
                    $why[] = sprintf('%d llamadas recursivas con n-1/n-2 y sin memoización: se repite trabajo (exponencial)', $c);
                } else {
                    $best = $w['a'] === 0 ? ['a' => 1, 'b' => 0] : ['a' => $w['a'], 'b' => $w['b'] + 1];
                    $why[] = 'divide y vencerás: ' . $c . ' llamadas sobre trozos más pequeños';
                }
            }
        }
        return ['a' => $best['a'], 'b' => $best['b'], 'exp' => $exp, 'why' => $why, 'recursive' => $recursive];
    }

    /** @param list<array<string,mixed>> $units */
    private function summarize(array $units): array
    {
        $loc = 0;
        $ccTotal = 0;
        $ccMax = 0;
        $worst = null;
        $maxNest = 0;
        foreach ($units as $u) {
            $loc += $u['loc'];
            $ccTotal += $u['cc'];
            $maxNest = max($maxNest, $u['nesting']);
            if ($u['cc'] > $ccMax) {
                $ccMax = $u['cc'];
                $worst = $u['qname'];
            }
        }
        $count = count($units);
        $avg = $count > 0 ? round($ccTotal / $count, 1) : 0.0;
        return ['loc' => $loc, 'functions' => $count, 'ccTotal' => $ccTotal, 'ccMax' => $ccMax, 'ccAvg' => $avg,
            'grade' => Metrics::grade((int) round($avg)), 'worst' => $worst, 'maxNesting' => $maxNest];
    }
}
