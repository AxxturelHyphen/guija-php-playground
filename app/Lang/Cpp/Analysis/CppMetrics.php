<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp\Analysis;

use Playground\Lang\Php\Analysis\Metrics;

defined('PG_ROOT') or exit;

/**
 * Métricas de cada función de C++ con UNA sola pasada por sus fichas (como JavaMetrics): complejidad ciclomática
 * (McCabe), cognitiva (Sonar), anidamiento y estimación de O(). Mismas fórmulas, etiquetas y claves que PHP/Python/Java.
 *
 * Además de las reglas de Java, entiende patrones típicos de algoritmia en C++: bucles con cota constante
 * (`for (int d = 0; d < 4; d++)`), listas de adyacencia dentro de un BFS/Dijkstra (`while (!q.empty()) for (v : g[u])`
 * suma O(V + E), no multiplica), paso armónico de la criba (`j += i`), dos punteros, Fenwick (`i += i & -i`), lambdas
 * recursivas (`function<…> dfs = [&](…) { … dfs(v); }`) y llamadas recursivas en ramas excluyentes (búsqueda binaria,
 * update de un árbol de segmentos).
 */
final class CppMetrics
{
    /** Costes por familia y método: [grado de n, potencia de log n]. Lo que no aparece es O(1) (o amortizado). */
    private const COSTES = [
        'VEC' => ['insert' => [1, 0], 'erase' => [1, 0], 'assign' => [1, 0], 'emplace' => [1, 0]],
        'DEQ' => ['insert' => [1, 0], 'erase' => [1, 0], 'assign' => [1, 0], 'emplace' => [1, 0]],
        'STR' => ['find' => [1, 0], 'rfind' => [1, 0], 'substr' => [1, 0], 'replace' => [1, 0], 'insert' => [1, 0], 'erase' => [1, 0],
            'find_first_of' => [1, 0], 'find_last_of' => [1, 0], 'find_first_not_of' => [1, 0], 'find_last_not_of' => [1, 0], 'compare' => [1, 0],
            'assign' => [1, 0]],
        'LIST' => ['sort' => [1, 1], 'remove' => [1, 0], 'remove_if' => [1, 0], 'unique' => [1, 0], 'reverse' => [1, 0], 'merge' => [1, 0]],
        'TREE' => ['insert' => [0, 1], 'erase' => [0, 1], 'find' => [0, 1], 'count' => [0, 1], 'lower_bound' => [0, 1], 'upper_bound' => [0, 1],
            'equal_range' => [0, 1], 'emplace' => [0, 1], 'at' => [0, 1], 'contains' => [0, 1]],
        'PQ' => ['push' => [0, 1], 'pop' => [0, 1], 'emplace' => [0, 1]],
    ];
    /** Funciones libres de <algorithm>, <numeric> y <cstring>. */
    private const LIBRES = [
        'sort' => [1, 1], 'stable_sort' => [1, 1], 'partial_sort' => [1, 1], 'sort_heap' => [1, 1], 'nth_element' => [1, 0],
        'find' => [1, 0], 'find_if' => [1, 0], 'find_if_not' => [1, 0], 'count' => [1, 0], 'count_if' => [1, 0], 'accumulate' => [1, 0],
        'reduce' => [1, 0], 'reverse' => [1, 0], 'fill' => [1, 0], 'fill_n' => [1, 0], 'copy' => [1, 0], 'copy_n' => [1, 0], 'copy_if' => [1, 0],
        'iota' => [1, 0], 'max_element' => [1, 0], 'min_element' => [1, 0], 'minmax_element' => [1, 0], 'unique' => [1, 0], 'all_of' => [1, 0],
        'any_of' => [1, 0], 'none_of' => [1, 0], 'transform' => [1, 0], 'partial_sum' => [1, 0], 'adjacent_difference' => [1, 0],
        'inner_product' => [1, 0], 'for_each' => [1, 0], 'remove' => [1, 0], 'remove_if' => [1, 0], 'replace' => [1, 0], 'replace_if' => [1, 0],
        'rotate' => [1, 0], 'equal' => [1, 0], 'mismatch' => [1, 0], 'search' => [1, 0], 'merge' => [1, 0], 'inplace_merge' => [1, 0],
        'includes' => [1, 0], 'set_union' => [1, 0], 'set_intersection' => [1, 0], 'set_difference' => [1, 0], 'shuffle' => [1, 0],
        'random_shuffle' => [1, 0], 'make_heap' => [1, 0], 'push_heap' => [0, 1], 'pop_heap' => [0, 1], 'is_sorted' => [1, 0],
        'lower_bound' => [0, 1], 'upper_bound' => [0, 1], 'binary_search' => [0, 1], 'equal_range' => [0, 1], 'next_permutation' => [1, 0],
        'prev_permutation' => [1, 0], 'memset' => [1, 0], 'memcpy' => [1, 0], 'strlen' => [1, 0], 'strcmp' => [1, 0],
    ];
    /** Algoritmos que ejecutan su lambda una vez por elemento: lo de dentro cuenta como un bucle. */
    private const CALLBACKS = ['for_each' => 1, 'transform' => 1, 'count_if' => 1, 'find_if' => 1, 'find_if_not' => 1, 'all_of' => 1,
        'any_of' => 1, 'none_of' => 1, 'remove_if' => 1, 'generate' => 1, 'copy_if' => 1, 'replace_if' => 1, 'accumulate' => 1];
    /** Palabras de control que mide el bucle principal. */
    private const CTL = ['if' => 1, 'else' => 1, 'for' => 1, 'while' => 1, 'do' => 1, 'switch' => 1, 'case' => 1, 'catch' => 1, 'goto' => 1,
        'return' => 1, 'and' => 1, 'or' => 1];
    private const MEMO = '/^(memo|memoria|cache|cach[eé]|dp|tabla|table|seen|visited|visitados?|vistos?|vis)(?![a-z])/i';

    /** @var array<int,array<string,mixed>> por índice de unidad: depth, events, locals, row… */
    public array $info = [];

    /** @var array<string,bool> funciones libres del usuario (tapan a las de la biblioteca con el mismo nombre) */
    private array $userFree = [];

    public function __construct(private readonly CppCode $c)
    {
        foreach ($c->units as $u) {
            if ($u['cls'] === '') {
                $this->userFree[$u['name']] = true;
            }
        }
    }

    /** @return array{units:list<array<string,mixed>>, summary:array<string,mixed>} */
    public function compute(): array
    {
        $rows = [];
        foreach ($this->c->units as $u => $unit) {
            $rows[$u] = $this->measure($u, $unit);
        }
        // O(): tres pasadas para que las llamadas entre funciones propaguen su coste (igual que en PHP y Java)
        $callee = [];
        for ($pass = 0; $pass < 3; $pass++) {
            foreach ($rows as $u => &$row) {
                $row['_cx'] = $this->bigO($u, $callee);
            }
            unset($row);
            $callee = [];
            foreach ($rows as $u => $row) {
                $key = strtolower($this->c->units[$u]['cls']) . '::' . strtolower($this->c->units[$u]['name']);
                $prev = $callee[$key] ?? null;           // sobrecargas: la más cara
                if ($prev === null || [$row['_cx']['a'], $row['_cx']['b']] > [$prev['a'], $prev['b']]) {
                    $callee[$key] = $row['_cx'];
                }
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

    // ───────────────────────────── una pasada por la función ─────────────────────────────

    private function measure(int $u, array $unit): array
    {
        $c = $this->c;
        $T = $c->t;
        $M = $c->m;
        $open = $unit['open'];
        $close = $unit['close'];
        $loc = $c->locals($u);
        $types = $loc['types'];
        $declToks = $loc['declToks'];
        $cc = 1;
        $cog = 0;
        $maxNest = 0;
        $returns = 0;
        $stack = [];       // [fin, anida, bucle, control, extra]
        $nest = 0;
        $loop = 0;
        $ctl = 0;
        $lastOp = null;
        $opStack = [];
        $doTails = [];
        $pend = [];
        $depth = [];
        $ev = [];
        $selfCalls = 0;
        $elseOf = [];
        $retEnd = -1;
        $retTok = -1;
        $guards = 0;
        $firstSelf = -1;
        $nparams = count($unit['params']);
        $required = count(array_filter($unit['params'], static fn($p) => $p['def'] === null && !str_contains($p['type'], '...')));
        // lambdas guardadas en variables (para la recursión con function<…> o auto&& self)
        $lamVar = [];
        foreach ($loc['decls'] as $d) {
            if (isset($d['init']) && $d['init'] !== null && ($T[$d['init'][0]][1] ?? '') === '[' && isset($c->lambdas[$d['init'][0]])) {
                $lamVar[$d['name']] = $c->lambdas[$d['init'][0]];
            }
        }
        $lamAt = [];
        foreach ($loc['lambdas'] as $l) {
            $lamAt[$l['ci']] = $l;
        }

        $vistos = [];
        $memo = false;
        $rep = 0;
        for ($i = $open + 1; $i < $close; $i++) {
            while ($stack && $stack[array_key_last($stack)][0] < $i) {
                [, $a, $b, $k, $xx] = array_pop($stack);
                $nest -= $a ? 1 : 0;
                $loop -= $b ? 1 : 0;
                $ctl -= $k ? 1 : 0;
                $rep -= isset($xx['rep']) ? 1 : 0;
            }
            if (isset($pend[$i])) {
                $stack[] = $pend[$i];
                [, $a, $b, $k, $xx] = $pend[$i];
                $nest += $a ? 1 : 0;
                $loop += $b ? 1 : 0;
                $ctl += $k ? 1 : 0;
                $rep += isset($xx['rep']) ? 1 : 0;
            }
            if ($rep > 0) {
                $depth[$i] = $rep;                               // repeticiones (también bucles de cota constante): para las pistas
            }
            [$ty, $x] = $T[$i];

            if ($ty === 'w') {
                if (!isset($vistos[$x])) {
                    $vistos[$x] = true;
                    $memo = $memo || preg_match(self::MEMO, $x) === 1;
                }
                $n1 = $T[$i + 1][1] ?? '';
                if (!isset(self::CTL[$x]) && $n1 !== '(' && $n1 !== '<' && $n1 !== '[' && $n1 !== '=') {
                    continue;                                   // un nombre cualquiera: nada que medir
                }
                switch ($x) {
                    case 'if':
                        $cc++;
                        $esElse = $T[$i - 1][1] === 'else';
                        $cog += $esElse ? 1 : 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        $p = $i + 1;
                        if (in_array($T[$p][1] ?? '', ['constexpr', '!', 'consteval'], true)) {
                            $p++;
                        }
                        if (isset($M[$p])) {
                            $fin = $c->stmtEnd($M[$p] + 1);
                            $arm = $esElse && isset($elseOf[$i - 1]) ? $elseOf[$i - 1] : [$i, 0];
                            if (($T[$fin + 1][1] ?? '') === 'else') {
                                $elseOf[$fin + 1] = [$arm[0], $arm[1] + 1];
                            }
                            $this->push($stack, $nest, $loop, $ctl, $fin, true, false, true, ['arm' => $arm]);
                        }
                        continue 2;
                    case 'else':
                        if (($T[$i + 1][1] ?? '') !== 'if') {
                            $cog++;
                            $this->push($stack, $nest, $loop, $ctl, $c->stmtEnd($i + 1), true, false, false, ['arm' => $elseOf[$i] ?? [$i, 1]]);
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
                            [$kind, $reason, $each, $extra] = $this->loopKind($i, $pc, $fin, $stack, $types, $loc);
                            $bucle = $kind === 'n' || $kind === 'log' || $kind === 'harm';
                            if ($bucle) {
                                $ev[] = ['loop', $loop + 1, $kind];
                            } else {
                                $ev[] = ['note', $loop, $reason];
                            }
                            $extra['rep'] = true;
                            $entry = [$fin, true, $bucle, true, $extra];
                            if ($each) {
                                $pend[$pc] = $entry;           // el rango a recorrer se evalúa una vez, fuera del bucle
                            } else {
                                $this->push($stack, $nest, $loop, $ctl, $fin, true, $bucle, true, $extra);
                                $rep++;
                            }
                        }
                        continue 2;
                    case 'do':
                        $cc++;
                        $cog += 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        $fin = $c->stmtEnd($i + 1);
                        $cond = $fin;
                        if (($T[$fin + 1][1] ?? '') === 'while' && isset($M[$fin + 2])) {
                            $doTails[$fin + 1] = true;
                            $cond = $fin + 2;
                            $fin = $M[$fin + 2] + 1;
                        }
                        $halves = $cond !== $fin && $this->halves($cond, $M[$cond] ?? $cond, $i + 1, $fin, $types);
                        $ev[] = ['loop', $loop + 1, $halves ? 'log' : 'n'];
                        $this->push($stack, $nest, $loop, $ctl, $fin, true, true, true, ['rep' => true]);
                        $rep++;
                        continue 2;
                    case 'switch':
                        $cog += 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        if (isset($M[$i + 1], $M[$M[$i + 1] + 1])) {
                            $this->push($stack, $nest, $loop, $ctl, $M[$M[$i + 1] + 1], true, false, true, []);
                        }
                        continue 2;
                    case 'case':
                        $cc++;
                        continue 2;
                    case 'catch':
                        $cc++;
                        $cog += 1 + $nest;
                        $maxNest = max($maxNest, $ctl + 1);
                        if (isset($M[$i + 1], $M[$M[$i + 1] + 1])) {
                            $this->push($stack, $nest, $loop, $ctl, $M[$M[$i + 1] + 1], true, false, true, []);
                        }
                        continue 2;
                    case 'goto':
                        $cog++;
                        continue 2;
                    case 'return':
                        $returns++;
                        $retTok = $i;
                        $retEnd = $c->stmtEnd($i);
                        if ($firstSelf < 0 && $ctl > 0) {
                            $guards++;
                        }
                        continue 2;
                    case 'and':
                    case 'or':
                        $cc++;
                        $op = $x === 'and' ? '&&' : '||';
                        if ($op !== $lastOp) {
                            $cog++;
                        }
                        $lastOp = $op;
                        continue 2;
                }
                // m[k] en un map: O(log n)
                if ($n1 === '[' && !isset($declToks[$i]) && ($T[$i - 1][1] ?? '') !== '.' && ($T[$i - 1][1] ?? '') !== '->'
                    && in_array($types[$x]['base'] ?? '', ['map', 'multimap'], true) && ($types[$x]['arr'] ?? 0) === 0) {
                    $ev[] = ['cost', $loop, 0, 1, $i, $x, 'map', '[]', $rep];
                }
                // s = s + … con string: copia entera
                if ($n1 === '=' && ($T[$i + 2][1] ?? '') === $x && ($T[$i + 3][1] ?? '') === '+' && ($types[$x]['fam'] ?? '') === 'STR') {
                    $ev[] = ['cost', $loop, 1, 0, $i, $x, 'string', '+', $rep];
                }
                // llamadas: nombre seguido de '(' (o de <…>( en una plantilla)
                $po = $i + 1;
                if (($T[$po][1] ?? '') === '<' && ($e = $c->angles($po, $close)) > 0 && ($T[$e][1] ?? '') === '(') {
                    $po = $e;
                }
                if (($T[$po][1] ?? '') !== '(' || !isset($M[$po]) || isset(CppCode::KW[$x]) || isset($declToks[$i])) {
                    continue;
                }
                $prev = $T[$i - 1][1];
                if ($prev === 'new' || $prev === 'operator' || ($T[$i - 1][0] === 'w' && !in_array($prev, ['return', 'throw', 'else', 'case', 'do', 'co_return', 'and', 'or', 'not'], true))
                    || ($prev === '>' && $po === $i + 1 && !isset($types[$x]) && $this->c->isType($x))) {
                    continue;
                }
                $pc = $M[$po];
                $args = $c->args($po);
                $nargs = count($args);
                $recv = null;
                $rinfo = null;
                $qual = false;
                $std = false;
                if ($prev === '.' || $prev === '->') {
                    $qual = true;
                    $k = $i - 2;
                    $subs = 0;
                    while (($T[$k][1] ?? '') === ']' && isset($M[$k])) {
                        $k = $M[$k] - 1;
                        $subs++;
                    }
                    $r = $T[$k] ?? null;
                    if ($r !== null && $r[0] === 'w') {
                        $recv = $r[1];
                        $rinfo = $types[$recv] ?? null;
                        for ($q = 0; $q < $subs && $rinfo !== null; $q++) {
                            $el = $rinfo['arr'] > 0 || $rinfo['fam'] !== null ? $c->elemType($rinfo) : null;
                            if (in_array($rinfo['base'], ['map', 'unordered_map'], true) && $rinfo['arr'] === 0) {
                                $el = $rinfo['args'][1] ?? null;
                            }
                            $rinfo = $el !== null ? $c->info($el) : null;
                        }
                    } elseif ($r !== null && $r[1] === ')') {
                        $recv = ')';
                    }
                } elseif ($prev === '::') {
                    $q = $T[$i - 2][1] ?? '';
                    if ($q === 'std' || $q === 'ranges') {
                        $std = true;
                    } else {
                        $qual = true;
                        $recv = $q;
                    }
                }
                // recursión: f(...) con el número de argumentos de la propia función, o la lambda que se llama a sí misma
                $self = false;
                if ($x === $unit['name'] && !$unit['ctor'] && $nargs >= $required && $nargs <= max($nparams, $required) && !$std
                    && (!$qual || $recv === 'this' || $recv === $unit['cls'])) {
                    $self = true;
                } elseif (!$qual && isset($lamVar[$x]) && $i > $lamVar[$x]['open'] && $i < $lamVar[$x]['close']) {
                    $self = true;
                } elseif (!$qual) {
                    foreach ($lamVar as $l) {
                        $p0 = $l['params'][0] ?? null;
                        if ($p0 !== null && $p0['name'] === $x && str_contains($p0['type'], 'auto') && $i > $l['open'] && $i < $l['close']) {
                            $self = true;
                            break;
                        }
                    }
                }
                if ($self) {
                    $selfCalls++;
                    if ($firstSelf < 0) {
                        $firstSelf = $i;
                    }
                    [$div, $dec] = $this->argShape($po, $pc, $unit);
                    $arms = [];
                    foreach ($stack as $s) {
                        if (isset($s[4]['arm'])) {
                            $arms[$s[4]['arm'][0]] = $s[4]['arm'][1];
                        }
                    }
                    $ev[] = ['self', $loop, $div, $dec, $i, $arms, $i <= $retEnd ? $retTok : -1];
                } else {
                    $coste = $this->coste($x, $qual ? $rinfo : null, $qual, $recv, $po, $pc, $nargs);
                    if ($coste !== null) {
                        $ev[] = ['cost', $loop, $coste[0], $coste[1], $i, $recv, $rinfo['base'] ?? null, $x, $rep];
                    }
                    $keys = [];
                    if (!$qual || $recv === 'this') {
                        if ($unit['cls'] !== '') {
                            $keys[] = strtolower($unit['cls']) . '::' . strtolower($x);
                        }
                        $keys[] = '::' . strtolower($x);
                    } elseif ($rinfo !== null && $rinfo['user']) {
                        $keys[] = strtolower($rinfo['base']) . '::' . strtolower($x);
                    } elseif ($prev === '::' && $recv !== null) {
                        $keys[] = strtolower($recv) . '::' . strtolower($x);
                    }
                    if ($keys !== []) {
                        $ev[] = ['call', $loop, $keys, $x, $i];
                    }
                }
                // la lambda del argumento se ejecuta una vez por elemento
                if (isset(self::CALLBACKS[$x]) && (!$qual || $std)) {
                    foreach ($args as [$aa, $ab]) {
                        if (($T[$aa][1] ?? '') === '[' && isset($lamAt[$aa])) {
                            $this->push($stack, $nest, $loop, $ctl, $pc, false, true, false, ['rep' => true]);
                            $rep++;
                            break;
                        }
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
                    $cc++;
                    $cog += 1 + $nest;
                    break;
                case '[':
                    if (isset($lamAt[$i])) {
                        $this->push($stack, $nest, $loop, $ctl, $lamAt[$i]['close'], true, false, false, []);   // lambda: anida
                    }
                    break;
            }
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
        // memoización: algún nombre de caché usado en el cuerpo (dp, memo, vis…), calculado en el bucle
        foreach ($unit['params'] as $p) {
            $memo = $memo || preg_match(self::MEMO, $p['name']) === 1;
        }
        $this->info[$u] = ['depth' => $depth, 'events' => $ev, 'locals' => $loc, 'memo' => $memo, 'self' => $selfCalls, 'guards' => $guards];

        $nl = 0;
        $prevL = 0;
        for ($q = $unit['first']; $q <= $close; $q++) {
            if ($T[$q][3] !== $prevL) {
                $prevL = $T[$q][3];
                $nl++;
            }
        }
        $cls = $unit['cls'] !== '' ? $unit['cls'] : null;
        return [
            'name' => $unit['name'], 'qname' => ($cls !== null ? $cls . '::' : '') . $unit['name'], 'kind' => $unit['kind'], 'class' => $cls,
            'startLine' => $T[$unit['first']][3], 'endLine' => $T[$close][3], 'loc' => $nl,
            'params' => $nparams, 'signature' => array_column($unit['params'], 'text'),
            'cc' => $cc, 'cognitive' => $cog, 'nesting' => $maxNest, 'returns' => $returns, 'grade' => Metrics::grade($cc),
        ];
    }

    /** Empuja un rango a la pila actualizando los contadores. */
    private function push(array &$stack, int &$nest, int &$loop, int &$ctl, int $fin, bool $anida, bool $bucle, bool $control, array $extra): void
    {
        $stack[] = [$fin, $anida, $bucle, $control, $extra];
        $nest += $anida ? 1 : 0;
        $loop += $bucle ? 1 : 0;
        $ctl += $control ? 1 : 0;
    }

    // ───────────────────────────── bucles ─────────────────────────────

    /**
     * Qué clase de bucle es: 'n' (normal), 'log' (divide la variable de control), 'harm' (paso armónico j += i),
     * 'const' (cota constante: direcciones, alfabeto, bits) o 'amort' (adyacencia en un BFS/Dijkstra, dos punteros).
     * @return array{0:string,1:string,2:bool,3:array<string,mixed>} [tipo, motivo, ¿for de rango?, extra para la pila]
     */
    private function loopKind(int $kw, int $pc, int $fin, array $stack, array $types, array $loc): array
    {
        $c = $this->c;
        $T = $c->t;
        $M = $c->m;
        $po = $kw + 1;
        $esFor = $T[$kw][1] === 'for';
        // partes de la cabecera: init ; cond ; incremento  —  o  decl : rango
        $semis = [];
        $colon = -1;
        for ($q = $po + 1; $q < $pc; $q++) {
            $y = $T[$q][1];
            if (($y === '(' || $y === '[' || $y === '{') && isset($M[$q])) {
                $q = $M[$q];
                continue;
            }
            if ($y === ';') {
                $semis[] = $q;
            } elseif ($y === ':' && $esFor && $semis === []) {
                $colon = $q;
            }
        }
        $each = $esFor && $colon > 0 && $semis === [];
        $vars = [];
        $extra = ['loopTok' => $kw];
        if ($esFor && !$each && count($semis) === 2) {
            for ($q = $po + 1; $q < $semis[0]; $q++) {
                if ($T[$q][0] === 'w' && in_array($T[$q + 1][1] ?? '', ['=', ',', ';', '{', '('], true) && !isset(CppCode::KW[$T[$q][1]])) {
                    $vars[$T[$q][1]] = true;
                }
            }
            $extra['vars'] = $vars;
            [$ca, $cb] = [$semis[0] + 1, $semis[1] - 1];
            [$ia, $ib] = [$semis[1] + 1, $pc - 1];
        } elseif (!$esFor) {
            [$ca, $cb] = [$po + 1, $pc - 1];
            [$ia, $ib] = [1, 0];
        } else {
            [$ca, $cb] = [1, 0];
            [$ia, $ib] = [1, 0];
        }
        // ¿while sobre una cola/pila/montículo? (BFS, Dijkstra…): lo marca para sus bucles interiores
        if (!$esFor) {
            for ($q = $ca; $q <= $cb; $q++) {
                if (in_array($T[$q][1], ['empty', 'size'], true) && in_array($T[$q - 1][1] ?? '', ['.', '->'], true)) {
                    $r = $types[$T[$q - 2][1] ?? ''] ?? null;
                    if ($r === null || in_array($r['fam'], ['QUEUE', 'PQ', 'STACK', 'DEQ', 'TREE', 'VEC'], true)) {
                        $extra['wl'] = true;
                    }
                }
            }
        }
        // cota constante
        if ($each) {
            $ra = $colon + 1;
            if (($T[$ra][1] ?? '') === '{') {
                return ['const', 'recorre una lista fija de valores: no depende de n', true, $extra];
            }
            if ($T[$ra][0] === 'w' && $ra === $pc - 1) {
                $n = $this->constCount($T[$ra][1], $types, $loc);
                if ($n !== null) {
                    return ['const', sprintf('`%s` tiene %d elementos fijos: el bucle no depende de n', $T[$ra][1], $n), true, $extra];
                }
            }
        } elseif ($esFor && $cb >= $ca) {
            if ($this->constBound($ca, $cb, $po + 1, $semis[0] - 1, $vars, $types, $loc)) {
                return ['const', 'bucle con cota constante (no depende de n)', false, $extra];
            }
        }
        // listas de adyacencia dentro de un while sobre una cola: amortizado
        $enWl = false;
        foreach ($stack as $s) {
            if (!empty($s[4]['wl'])) {
                $enWl = true;
            }
        }
        if ($enWl) {
            $adj = false;
            if ($each && $T[$colon + 1][0] === 'w' && ($T[$colon + 2][1] ?? '') === '[' && isset($M[$colon + 2]) && $M[$colon + 2] === $pc - 1) {
                $adj = true;
            }
            for ($q = $ca; $q <= $cb && !$adj; $q++) {
                if ($T[$q][1] === ']' && ($T[$q + 1][1] ?? '') === '.' && ($T[$q + 2][1] ?? '') === 'size') {
                    $adj = true;
                }
            }
            if ($adj) {
                return ['amort', 'recorrer la lista de adyacencia de cada nodo que sale de la cola suma O(V + E) en total: no multiplica', $each, $extra];
            }
        }
        if ($each) {
            return ['n', '', true, $extra];
        }
        // paso armónico de la criba: for (j = i * i; j <= n; j += i)
        for ($q = $ia; $q <= $ib; $q++) {
            if ($T[$q][1] === '+=' && ($T[$q + 1][0] ?? '') === 'w' && $q + 1 === $ib) {
                foreach ($stack as $s) {
                    if (isset($s[4]['vars'][$T[$q + 1][1]])) {
                        return ['harm', '', false, $extra];
                    }
                }
            }
        }
        $ctlVars = [];
        for ($q = $ca; $q <= $cb; $q++) {
            if ($T[$q][0] === 'w' && !isset(CppCode::KW[$T[$q][1]]) && ($T[$q - 1][1] ?? '') !== '.' && ($T[$q - 1][1] ?? '') !== '->'
                && ($T[$q + 1][1] ?? '') !== '(') {
                $ctlVars[$T[$q][1]] = true;
            }
        }
        if ($this->halvesVars($ctlVars, $esFor ? $ia : $pc + 1, $esFor ? $ib : $fin, $pc + 1, $fin, $types)) {
            return ['log', '', false, $extra];
        }
        // dos punteros: un while dentro de otro bucle que solo avanza una variable declarada fuera
        if (!$esFor && $this->loopDepthIn($stack) > 0 && $this->twoPointers($pc + 1, $fin, $ctlVars, $stack, $loc)) {
            return ['amort', 'dos punteros: la variable del while interior solo avanza, así que da O(n) vueltas en total, no por cada vuelta exterior', false, $extra];
        }
        return ['n', '', false, $extra];
    }

    private function loopDepthIn(array $stack): int
    {
        $n = 0;
        foreach ($stack as $s) {
            $n += $s[2] ? 1 : 0;
        }
        return $n;
    }

    /** Nº de elementos de un array/vector de tamaño fijo y pequeño (dirs, dx…), o null. */
    private function constCount(string $name, array $types, array $loc): ?int
    {
        $info = $types[$name] ?? null;
        if ($info === null) {
            return null;
        }
        if ($info['arr'] > 0 && preg_match('/^\[(\d+)\]$/', $info['dims'], $mm) && (int) $mm[1] <= 64) {
            return (int) $mm[1];
        }
        if ($info['fam'] === 'ARR' && ctype_digit($info['args'][1] ?? 'x') && (int) $info['args'][1] <= 64) {
            return (int) $info['args'][1];
        }
        foreach (array_merge($loc['decls'], $this->c->vars) as $d) {
            if ($d['name'] === $name && isset($d['init']) && $d['init'] !== null) {
                [$a, $b] = $d['init'];
                $T = $this->c->t;
                if ($d['ik'] === '=' && ($T[$a][1] ?? '') === '{' && ($this->c->m[$a] ?? -1) === $b) {
                    $a++;
                    $b--;
                } elseif ($d['ik'] !== '{') {
                    continue;
                }
                $n = count($this->c->args($a - 1));
                $n = $n === 0 ? 0 : $n;
                if ($info['arr'] > 0 || in_array($info['fam'], ['VEC', 'ARR'], true)) {
                    return $n > 0 && $n <= 64 ? $n : null;
                }
            }
        }
        return null;
    }

    /** ¿La condición compara la variable del for con una constante pequeña (`d < 4`, `b < LOG`, `k >= 0` desde LOG-1)? */
    private function constBound(int $ca, int $cb, int $ia, int $ib, array $vars, array $types, array $loc): bool
    {
        $T = $this->c->t;
        if ($vars === []) {
            return false;
        }
        for ($q = $ca; $q < $cb; $q++) {
            if (!isset($vars[$T[$q][1]])) {
                continue;
            }
            $op = $T[$q + 1][1] ?? '';
            $rhs = $q + 2;
            if (($op === '<' || $op === '<=') && $rhs === $cb) {
                return $this->smallConst($rhs, $types, $loc);
            }
            if (($op === '>' || $op === '>=' || $op === '!=') && $rhs === $cb && $T[$rhs][0] === 'n') {
                // cuenta atrás desde una constante: for (int b = LOG - 1; b >= 0; b--)
                for ($k = $ia; $k <= $ib; $k++) {
                    if ($T[$k][1] === '=' && $this->smallConst($k + 1, $types, $loc)) {
                        return true;
                    }
                }
                return false;
            }
        }
        return false;
    }

    /** ¿La ficha $k es un número ≤ 64 o una constante (const/constexpr/#define) que vale ≤ 64? */
    private function smallConst(int $k, array $types, array $loc): bool
    {
        $T = $this->c->t;
        $x = $T[$k] ?? null;
        if ($x === null) {
            return false;
        }
        if ($x[0] === 'n') {
            return ctype_digit(str_replace("'", '', $x[1])) && (int) $x[1] <= 64;
        }
        if ($x[0] !== 'w') {
            return false;
        }
        $mac = $this->c->macros[$x[1]] ?? null;
        if ($mac !== null && $mac['params'] === null) {
            return ctype_digit($mac['value']) && (int) $mac['value'] <= 64;
        }
        foreach (array_merge($loc['decls'], $this->c->vars) as $d) {
            if ($d['name'] === $x[1] && isset($d['init']) && $d['init'] !== null && $d['init'][0] === $d['init'][1]
                && (isset($d['spec']['const']) || isset($d['spec']['constexpr']))) {
                $v = $T[$d['init'][0]][1];
                return ctype_digit($v) && (int) $v <= 64;
            }
        }
        return false;
    }

    /**
     * ¿El bucle divide (o duplica) su variable de control en cada vuelta? Búsqueda binaria (`lo = mid + 1` con
     * `mid = (lo + hi) / 2`), `i *= 2`, `n /= 10`, `x >>= 1`, Fenwick (`i += i & -i`), Euclides (`b = a % b`).
     */
    private function halvesVars(array $ctl, int $ia, int $ib, int $ba, int $bb, array $types): bool
    {
        $T = $this->c->t;
        if ($ctl === []) {
            return false;
        }
        $H = [];                              // variables calculadas dividiendo: mid, t = a % b…
        $rangos = [[$ia, $ib]];
        if ($ba !== $ia) {
            $rangos[] = [$ba, $bb];
        }
        $es = static fn(int $k): bool => ($T[$k][0] ?? '') === 'n' && (int) str_replace("'", '', $T[$k][1]) >= 2;
        foreach ([0, 1] as $pasada) {
            foreach ($rangos as [$a, $b]) {
                for ($k = $a; $k <= $b; $k++) {
                    $x = $T[$k][1];
                    if (($x === 'for' || $x === 'while' || $x === 'do') && $T[$k][0] === 'w') {
                        $k = $this->c->stmtEnd($k);      // los bucles internos se miden aparte
                        continue;
                    }
                    if ($T[$k][0] !== 'w') {
                        continue;
                    }
                    $op = $T[$k + 1][1] ?? '';
                    $v = $x;
                    if (in_array($op, ['/=', '>>=', '%='], true) || (($op === '*=' || $op === '<<=') && ($es($k + 2) || ($T[$k + 2][0] ?? '') === 'w'))) {
                        if (isset($ctl[$v])) {
                            return true;
                        }
                        continue;
                    }
                    if ($op === '&=' && isset($ctl[$v])) {
                        return true;                   // x &= x - 1
                    }
                    if (($op === '+=' || $op === '-=') && isset($ctl[$v])) {
                        $e = $this->c->exprEnd($k + 2, $b + 1);
                        for ($q = $k + 2; $q < $e; $q++) {
                            if ($T[$q][1] === '&' && in_array($T[$q + 1][1] ?? '', ['-', '('], true)) {
                                return true;           // i += i & -i
                            }
                        }
                        continue;
                    }
                    if ($op === '=') {
                        $e = $this->c->exprEnd($k + 2, $b + 1);
                        $div = false;
                        for ($q = $k + 2; $q < $e; $q++) {
                            $y = $T[$q][1];
                            if (($y === '/' && $es($q + 1)) || ($y === '%' && ($T[$q + 1][0] ?? '') === 'w')
                                || ($y === '>' && ($T[$q + 1][1] ?? '') === '>' && $T[$q + 1][2] === $T[$q][2] + 1)
                                || ($T[$q][0] === 'w' && isset($H[$y]))
                                || ($y === '*' && ($es($q + 1) || $es($q - 1)) && isset($ctl[$v]))) {
                                $div = true;
                                break;
                            }
                        }
                        if ($div) {
                            if (isset($ctl[$v]) && ($pasada === 1 || !isset($H[$v]))) {
                                return true;
                            }
                            $H[$v] = true;
                        }
                    }
                }
            }
        }
        return false;
    }

    /** ¿Algún `x++` de una variable declarada fuera del bucle exterior y nunca reiniciada dentro? */
    private function twoPointers(int $a, int $b, array $ctlVars, array $stack, array $loc): bool
    {
        $T = $this->c->t;
        $outer = null;
        foreach ($stack as $s) {
            if ($s[2] && isset($s[4]['loopTok'])) {
                $outer ??= $s[4]['loopTok'];
            }
        }
        if ($outer === null) {
            return false;
        }
        $outerEnd = $this->c->stmtEnd($outer);
        for ($k = $a; $k <= $b; $k++) {
            if ($T[$k][0] !== 'w' || isset(CppCode::KW[$T[$k][1]])) {
                continue;
            }
            $v = $T[$k][1];
            $inc = in_array($T[$k + 1][1] ?? '', ['++', '--'], true) || in_array($T[$k - 1][1] ?? '', ['++', '--'], true)
                || (in_array($T[$k + 1][1] ?? '', ['+=', '-='], true) && ($T[$k + 2][1] ?? '') === '1');
            if (!$inc || !isset($ctlVars[$v]) && !$this->usedAsIndex($v, $a, $b)) {
                continue;
            }
            // declarada antes del bucle exterior y no reasignada con '=' dentro de él
            $declFuera = false;
            foreach ($loc['decls'] as $d) {
                if ($d['name'] === $v && $d['tok'] < $outer) {
                    $declFuera = true;
                }
            }
            if (!$declFuera) {
                continue;
            }
            $reset = false;
            for ($q = $outer; $q <= $outerEnd; $q++) {
                if ($T[$q][1] === $v && ($T[$q + 1][1] ?? '') === '=') {
                    $reset = true;
                    break;
                }
            }
            if (!$reset) {
                return true;
            }
        }
        return false;
    }

    private function usedAsIndex(string $v, int $a, int $b): bool
    {
        $T = $this->c->t;
        for ($k = $a; $k <= $b; $k++) {
            if ($T[$k][1] === $v && ($T[$k - 1][1] ?? '') === '[') {
                return true;
            }
        }
        return false;
    }

    /** do { … } while (cond): ¿divide su variable? */
    private function halves(int $po, int $pc, int $a, int $b, array $types): bool
    {
        $T = $this->c->t;
        $ctl = [];
        for ($q = $po + 1; $q < $pc; $q++) {
            if ($T[$q][0] === 'w' && !isset(CppCode::KW[$T[$q][1]])) {
                $ctl[$T[$q][1]] = true;
            }
        }
        return $this->halvesVars($ctl, $a, $b, $a, $b, $types);
    }

    /** @return array{0:bool,1:bool} [divide el problema, avanza en una constante] en los argumentos de una llamada */
    private function argShape(int $po, int $pc, array $unit): array
    {
        $T = $this->c->t;
        $div = false;
        $dec = false;
        $params = array_flip(array_column($unit['params'], 'name'));
        for ($i = $po + 1; $i < $pc; $i++) {
            $x = $T[$i][1];
            if ($x === '/' || ($x === '>' && ($T[$i + 1][1] ?? '') === '>')) {
                $div = true;
            } elseif ($x === '*' && (($T[$i + 1][1] ?? '') === '2' || ($T[$i - 1][1] ?? '') === '2')) {
                $div = true;                                    // 2 * nodo: hijos de un árbol implícito
            } elseif ($T[$i][0] === 'w' && !isset($params[$x]) && preg_match('/^(mid|medio|mitad|half|middle|m|centro|pivot|piv|p|q|md)$/i', $x)) {
                $div = true;
            } elseif ($x === '--' || $x === '++') {
                $dec = true;
            } elseif (($x === '-' || $x === '+') && ($T[$i + 1][0] ?? '') === 'n' && ($T[$i - 1][0] ?? '') === 'w' && isset($params[$T[$i - 1][1]])) {
                $dec = true;
            }
        }
        return [$div, $dec];
    }

    /** Coste [grado, log] de una llamada o null si es O(1) / desconocida. */
    private function coste(string $name, ?array $rinfo, bool $qual, ?string $recv, int $po, int $pc, int $nargs): ?array
    {
        $T = $this->c->t;
        if (!$qual) {
            if (isset($this->userFree[$name])) {
                return null;                                     // función del usuario con ese nombre
            }
            $c = self::LIBRES[$name] ?? null;
            return $c !== null && ($c[0] > 0 || $c[1] > 0) ? $c : null;
        }
        if ($rinfo === null || $rinfo['fam'] === null || $rinfo['arr'] > 0 || $rinfo['ptr'] > 0) {
            return null;
        }
        $fam = $rinfo['fam'];
        $c = self::COSTES[$fam][$name] ?? null;
        if ($c === null) {
            return null;
        }
        // v.erase(v.end() - 1) / v.insert(v.end(), x): al final, O(1)
        if (($fam === 'VEC' || $fam === 'STR' || $fam === 'DEQ') && ($name === 'erase' || $name === 'insert' || $name === 'emplace')) {
            for ($i = $po + 1; $i < $pc && $T[$i][1] !== ','; $i++) {
                if ($T[$i][1] === 'end' && ($T[$i - 1][1] ?? '') === '.') {
                    return $name === 'erase' && $nargs === 2 ? [1, 0] : null;
                }
                if ($fam === 'DEQ' && $T[$i][1] === 'begin' && $nargs === 1) {
                    return null;
                }
            }
        }
        return $c;
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
        $self = strtolower($unit['cls']) . '::' . strtolower($unit['name']);
        $notas = [];
        foreach ($info['events'] as $e) {
            switch ($e[0]) {
                case 'loop':
                    if ($e[2] === 'log') {
                        $consider($e[1] - 1, 1, 'el bucle reduce su variable a la mitad (o la duplica) en cada vuelta: logarítmico');
                    } elseif ($e[2] === 'harm') {
                        $consider($e[1] - 1, 1, 'paso que crece con el bucle exterior (j += i): suma armónica n/1 + n/2 + … = O(n log n) en total');
                    } else {
                        $maxLoop = max($maxLoop, $e[1]);
                        $consider($e[1], 0, '');
                    }
                    break;
                case 'note':
                    if (!in_array($e[2], $notas, true)) {
                        $notas[] = $e[2];
                    }
                    break;
                case 'cost':
                    [, $d, $a, $b, , , , $name] = $e;
                    $lab = Metrics::label(['a' => $a, 'b' => $b, 'exp' => null]);
                    $nm = $name === '[]' ? 'm[k] en un map' : ($name === '+' ? 's = s + …' : $name . '()');
                    $reason = $d > 0
                        ? sprintf('%s dentro de un bucle: %s × n%s', $nm, $lab, $d > 1 ? '^' . $d : '')
                        : sprintf('%s cuesta %s', $nm, $lab);
                    $consider($d + $a, $b, ($a >= 1 || $d > 0) && ($a + $b > 0) ? $reason : '');
                    break;
                case 'call':
                    [, $d, $keys, $name] = $e;
                    foreach ($keys as $key) {
                        if (isset($callee[$key]) && $key !== $self) {
                            $cx = $callee[$key];
                            if (($cx['a'] > 0 || $cx['b'] > 0) && !$cx['exp']) {
                                $consider($d + $cx['a'], $cx['b'], sprintf('llama a %s() que cuesta %s%s', $name, Metrics::label($cx), $d > 0 ? ' dentro de un bucle' : ''));
                            } elseif ($cx['exp'] && $d === 0) {
                                $why[] = sprintf('llama a %s(), que es exponencial', $name);
                            }
                            break;
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
        foreach ($notas as $n) {
            $why[] = $n;
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
            // llamadas en ramas excluyentes (if/else, o cada una en su return): solo se ejecuta una por nivel
            if ($c > 1) {
                $excl = true;
                for ($p = 0; $p < $c && $excl; $p++) {
                    for ($q = $p + 1; $q < $c && $excl; $q++) {
                        $excl = $this->exclusive($selfs[$p], $selfs[$q]);
                    }
                }
                if ($excl) {
                    $c = 1;
                }
            }
            $w = $best;
            if ($info['memo']) {
                $best = ['a' => max(1, $w['a']), 'b' => $w['b']];
                $why[] = 'recursión con memoización o marcas de visitado: cada subproblema (o nodo) se calcula una vez';
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
                    $why[] = 'recursión que divide el problema a la mitad en cada llamada (solo se sigue una rama)';
                } else {
                    $best = ['a' => $w['a'] + 1, 'b' => $w['b']];
                    $why[] = 'recursión lineal: una llamada por nivel, n niveles';
                }
            } else {
                if ($decrementing && !$dividing) {
                    $exp = '2^n';
                    $why[] = sprintf('%d llamadas recursivas que solo reducen n en una constante y sin memoización: se repite trabajo (exponencial)', $c);
                } elseif ($dividing && $w['a'] === 0 && $info['guards'] >= 2) {
                    $best = ['a' => 0, 'b' => 1];
                    $why[] = 'consulta de rango (árbol de segmentos): las podas por rango hacen que solo se visiten O(log n) nodos';
                } else {
                    $best = $w['a'] === 0 ? ['a' => 1, 'b' => 0] : ['a' => $w['a'], 'b' => $w['b'] + 1];
                    $why[] = 'divide y vencerás: ' . $c . ' llamadas sobre trozos más pequeños';
                }
            }
        }
        return ['a' => $best['a'], 'b' => $best['b'], 'exp' => $exp, 'why' => $why, 'recursive' => $recursive];
    }

    /** ¿Dos llamadas recursivas nunca se ejecutan en la misma invocación? */
    private function exclusive(array $s1, array $s2): bool
    {
        foreach ($s1[5] as $chain => $arm) {
            if (isset($s2[5][$chain]) && $s2[5][$chain] !== $arm) {
                return true;
            }
        }
        return $s1[6] >= 0 && $s2[6] >= 0 && $s1[6] !== $s2[6];
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
