<?php
declare(strict_types=1);

namespace Playground\Lang\Php\Analysis;

defined('PG_ROOT') or exit;

/**
 * Métricas por función/método:
 *  - complejidad ciclomática (McCabe)
 *  - complejidad cognitiva (especificación de Sonar)
 *  - anidamiento máximo, líneas de código, número de parámetros
 *  - Big-O estimado de forma estática (heurístico: la cifra real la da medir())
 */
final class Metrics
{
    /**
     * Coste de funciones nativas respecto al tamaño n de su argumento principal: [grado de n, potencia de log n].
     * [0,0] = O(1), [1,0] = O(n), [1,1] = O(n log n), [2,0] = O(n²)
     */
    public const COSTS = [
        // arrays: O(n)
        'in_array' => [1, 0], 'array_search' => [1, 0], 'array_keys' => [1, 0], 'array_values' => [1, 0],
        'array_merge' => [1, 0], 'array_merge_recursive' => [1, 0], 'array_slice' => [1, 0], 'array_splice' => [1, 0],
        'array_shift' => [1, 0], 'array_unshift' => [1, 0], 'array_reverse' => [1, 0], 'array_sum' => [1, 0],
        'array_product' => [1, 0], 'array_flip' => [1, 0], 'array_fill' => [1, 0], 'array_pad' => [1, 0],
        'array_combine' => [1, 0], 'array_column' => [1, 0], 'array_chunk' => [1, 0], 'array_count_values' => [1, 0],
        'array_map' => [1, 0], 'array_filter' => [1, 0], 'array_reduce' => [1, 0], 'array_walk' => [1, 0],
        'array_walk_recursive' => [1, 0], 'array_fill_keys' => [1, 0], 'array_key_first' => [0, 0],
        'array_intersect_key' => [1, 0], 'array_diff_key' => [1, 0], 'array_is_list' => [1, 0],
        'range' => [1, 0], 'shuffle' => [1, 0], 'array_rand' => [1, 0], 'iterator_to_array' => [1, 0],
        'min' => [1, 0], 'max' => [1, 0],
        // arrays: O(n log n)
        'sort' => [1, 1], 'rsort' => [1, 1], 'usort' => [1, 1], 'uasort' => [1, 1], 'uksort' => [1, 1],
        'ksort' => [1, 1], 'krsort' => [1, 1], 'asort' => [1, 1], 'arsort' => [1, 1], 'array_multisort' => [1, 1],
        'natsort' => [1, 1], 'array_unique' => [1, 1], 'array_diff' => [1, 1], 'array_intersect' => [1, 1],
        'array_udiff' => [1, 1], 'array_uintersect' => [1, 1],
        // strings
        'implode' => [1, 0], 'join' => [1, 0], 'explode' => [1, 0], 'str_repeat' => [1, 0], 'str_split' => [1, 0],
        'strrev' => [1, 0], 'strtolower' => [1, 0], 'strtoupper' => [1, 0], 'ucwords' => [1, 0], 'ucfirst' => [1, 0],
        'trim' => [1, 0], 'ltrim' => [1, 0], 'rtrim' => [1, 0], 'str_pad' => [1, 0], 'str_replace' => [1, 0],
        'str_contains' => [1, 0], 'str_starts_with' => [0, 0], 'strpos' => [1, 0], 'stripos' => [1, 0],
        'strrpos' => [1, 0], 'strstr' => [1, 0], 'substr' => [1, 0], 'substr_count' => [1, 0], 'mb_substr' => [1, 0],
        'mb_strlen' => [1, 0], 'mb_str_split' => [1, 0], 'mb_strtolower' => [1, 0], 'mb_strtoupper' => [1, 0],
        'count_chars' => [1, 0], 'str_word_count' => [1, 0], 'wordwrap' => [1, 0], 'nl2br' => [1, 0],
        'json_encode' => [1, 0], 'json_decode' => [1, 0], 'serialize' => [1, 0], 'unserialize' => [1, 0],
        'preg_match' => [1, 0], 'preg_match_all' => [1, 0], 'preg_replace' => [1, 0], 'preg_split' => [1, 0],
        'levenshtein' => [2, 0], 'similar_text' => [3, 0],
    ];

    /** Funciones que ejecutan un callback una vez por elemento: lo de dentro cuenta como un bucle. */
    private const CALLBACK_LOOPS = [
        'array_map', 'array_filter', 'array_reduce', 'array_walk', 'array_walk_recursive', 'iterator_apply',
        'array_any', 'array_all', 'array_find',
    ];

    private const MEMO_NAMES = '/^\$(memo|memoria|cache|cach[eé]|dp|tabla|table|seen|visited|visitados|visitado|vistos|vis)\b/i';

    public function __construct(private readonly Source $src, private readonly Parser $parser)
    {
    }

    /**
     * @return array{units: list<array<string,mixed>>, summary: array<string,mixed>}
     */
    public function compute(): array
    {
        $unitIdxs = [];
        foreach ($this->parser->units as $u => $unit) {
            $unitIdxs[$u] = $this->tokensOf($u);
        }
        $mainIdxs = $this->tokensOf(-1);

        $rows = [];
        foreach ($this->parser->units as $u => $unit) {
            if (!$unit->hasBody()) {
                continue;
            }
            $rows[$u] = $this->measure($unit, $unitIdxs[$u], $u);
        }

        // Big-O: tres pasadas para que las llamadas entre funciones propaguen su coste.
        $callee = [];
        for ($pass = 0; $pass < 3; $pass++) {
            foreach ($rows as $u => &$row) {
                $cx = $this->bigO($this->parser->units[$u], $unitIdxs[$u], $callee);
                $row['_cx'] = $cx;
            }
            unset($row);
            $callee = [];
            foreach ($rows as $u => $row) {
                $unit = $this->parser->units[$u];
                $key = $unit->kind === 'method' ? strtolower((string) $unit->class) . '::' . strtolower($unit->name) : strtolower($unit->name);
                $callee[$key] = $row['_cx'];
            }
        }

        $units = [];
        foreach ($rows as $u => $row) {
            $cx = $row['_cx'];
            unset($row['_cx']);
            $row['bigO'] = self::label($cx);
            $row['bigOWhy'] = $cx['why'];
            $row['bigOKey'] = self::key($cx);
            $row['recursive'] = $cx['recursive'];
            $units[] = $row;
        }

        // Código suelto: se mide pero sin Big-O (depende de los datos concretos).
        $main = $this->measureMain($mainIdxs);
        if ($main !== null) {
            $units[] = $main;
        }

        usort($units, static fn(array $a, array $b): int => $a['startLine'] <=> $b['startLine']);

        return ['units' => $units, 'summary' => $this->summarize($units)];
    }

    /** Tokens significativos que pertenecen a la unidad $u (-1 = código suelto). */
    public function unitTokens(int $u): array
    {
        return $this->tokensOf($u);
    }

    /** @return \Closure(int):int cuántos bucles rodean a un token (incluye los callbacks de array_map & co.) */
    public function loopDepth(array $idxs): \Closure
    {
        $ranges = $this->buildRanges($idxs);
        return static function (int $i) use ($ranges): int {
            $d = 0;
            foreach ($ranges as [$s, $e, , $loop]) {
                if ($loop && $s <= $i && $i <= $e) {
                    $d++;
                }
            }
            return $d;
        };
    }

    // ───────────────────────────── tokens de una unidad ─────────────────────────────

    /** @return list<int> índices de tokens significativos que pertenecen a la unidad (-1 = código suelto) */
    private function tokensOf(int $u): array
    {
        $src = $this->src;
        $out = [];
        if ($u === -1) {
            foreach ($src->tokens as $i => $t) {
                if ($this->parser->owner[$i] === -1 && Source::isSignificant($t) && $t->id !== T_OPEN_TAG && $t->id !== T_CLOSE_TAG) {
                    $out[] = $i;
                }
            }
            return $out;
        }
        $unit = $this->parser->units[$u];
        $end = $unit->close >= 0 ? $unit->close : $unit->parenClose;
        for ($i = $unit->head; $i <= $end; $i++) {
            if ($this->parser->owner[$i] === $u && Source::isSignificant($src->tokens[$i])) {
                $out[] = $i;
            }
        }
        return $out;
    }

    // ───────────────────────────── ciclomática / cognitiva ─────────────────────────────

    /** @param list<int> $idxs */
    private function measure(Unit $unit, array $idxs, int $u): array
    {
        [$cc, $cog, $nesting, $returns] = $this->decisions($idxs, $unit);

        $lines = [];
        foreach ($idxs as $i) {
            $lines[$this->src->tokens[$i]->line] = true;
        }

        return [
            'name' => $unit->name,
            'qname' => $unit->qname(),
            'kind' => $unit->kind,
            'class' => $unit->class,
            'startLine' => $unit->startLine,
            'endLine' => $unit->endLine,
            'loc' => count($lines),
            'params' => count($unit->params),
            'signature' => array_column($unit->params, 'text'),
            'cc' => $cc,
            'cognitive' => $cog,
            'nesting' => $nesting,
            'returns' => $returns,
            'grade' => self::grade($cc),
        ];
    }

    private function measureMain(array $idxs): ?array
    {
        if (!$idxs) {
            return null;
        }
        $fake = new Unit('{main}', 'main', null, -1, -1, -1, -1, -1, -1, false, 0, 0);
        [$cc, $cog, $nesting, $returns] = $this->decisions($idxs, $fake);
        $lines = [];
        foreach ($idxs as $i) {
            $lines[$this->src->tokens[$i]->line] = true;
        }
        if (!$lines) {
            return null;
        }
        return [
            'name' => '{main}', 'qname' => '{main}', 'kind' => 'main', 'class' => null,
            'startLine' => min(array_keys($lines)), 'endLine' => max(array_keys($lines)),
            'loc' => count($lines), 'params' => 0, 'cc' => $cc, 'cognitive' => $cog, 'nesting' => $nesting,
            'returns' => $returns, 'grade' => self::grade($cc), 'bigO' => null, 'bigOWhy' => [], 'bigOKey' => null,
            'recursive' => false,
        ];
    }

    /**
     * @param list<int> $idxs
     * @return array{0:int,1:int,2:int,3:int} [ciclomática, cognitiva, anidamiento máximo, nº de returns]
     */
    private function decisions(array $idxs, Unit $unit): array
    {
        $src = $this->src;
        $tokens = $src->tokens;
        $ranges = $this->buildRanges($idxs);

        $cc = 1;
        $cog = 0;
        $maxNest = 0;
        $returns = 0;

        $nestAt = static function (int $i) use ($ranges): int {
            $n = 0;
            foreach ($ranges as [$s, $e, , , $nests]) {
                if ($nests && $s <= $i && $i <= $e) {
                    $n++;
                }
            }
            return $n;
        };
        $controlNestAt = static function (int $i) use ($ranges): int {
            $n = 0;
            foreach ($ranges as [$s, $e, $control]) {
                if ($control && $s <= $i && $i <= $e) {
                    $n++;
                }
            }
            return $n;
        };

        // Secuencias de operadores lógicos (Sonar): && && cuenta 1; && || cuenta 2.
        $lastOp = null;
        $opStack = [];

        foreach ($idxs as $i) {
            $t = $tokens[$i];
            switch ($t->id) {
                case T_IF:
                    $cc++;
                    if ($src->is($src->prev($i), T_ELSE)) {
                        $cog++;
                        $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    } else {
                        $cog += 1 + $nestAt($i);
                        $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    }
                    break;
                case T_ELSEIF:
                    $cc++;
                    $cog++;
                    $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    break;
                case T_ELSE:
                    if (!$src->is($src->next($i), T_IF)) {
                        $cog++;
                    }
                    break;
                case T_FOR:
                case T_FOREACH:
                case T_CATCH:
                    $cc++;
                    $cog += 1 + $nestAt($i);
                    $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    break;
                case T_WHILE:
                    $cc++;
                    $cog += 1 + $nestAt($i);
                    $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    break;
                case T_DO:
                    $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    break;
                case T_SWITCH:
                    $cog += 1 + $nestAt($i);
                    $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    break;
                case T_CASE:
                    $cc++;
                    break;
                case T_MATCH:
                    $cog += 1 + $nestAt($i);
                    $maxNest = max($maxNest, $controlNestAt($i) + 1);
                    $cc += $this->matchArms($i);
                    break;
                case T_COALESCE:
                case T_COALESCE_EQUAL:
                    $cc++;
                    break;
                case T_GOTO:
                    $cog++;
                    break;
                case T_RETURN:
                    $returns++;
                    break;
                case T_BOOLEAN_AND:
                case T_BOOLEAN_OR:
                case T_LOGICAL_AND:
                case T_LOGICAL_OR:
                case T_LOGICAL_XOR:
                    $cc++;
                    $kind = match ($t->id) {
                        T_BOOLEAN_AND, T_LOGICAL_AND => 'and',
                        T_BOOLEAN_OR, T_LOGICAL_OR => 'or',
                        default => 'xor',
                    };
                    if ($kind !== $lastOp) {
                        $cog++;
                    }
                    $lastOp = $kind;
                    break;
                default:
                    if ($t->text === '?' && !$this->isNullableMark($i)) {
                        $cc++;
                        $cog += 1 + $nestAt($i);
                    }
            }

            // Se reinicia la secuencia al cambiar de expresión
            if ($t->text === ';' || $t->text === '{' || $t->text === '}' || $t->text === ',') {
                $lastOp = null;
            } elseif ($t->text === '(') {
                $opStack[] = $lastOp;
                $lastOp = null;
            } elseif ($t->text === ')') {
                $lastOp = $opStack ? array_pop($opStack) : null;
            }
        }

        if ($unit->kind !== 'main' && $this->selfCalls($unit, $idxs)) {
            $cog++;
        }

        return [$cc, $cog, $maxNest, $returns];
    }

    /** ¿Este `?` es parte de un tipo nullable (`?int`) en vez de un ternario? */
    private function isNullableMark(int $i): bool
    {
        $src = $this->src;
        $p = $src->prev($i);
        if ($p === null) {
            return false;
        }
        $t = $src->tokens[$p];
        if (in_array($t->text, ['(', ',', ':', '|'], true)) {
            return true;
        }
        return in_array($t->id, [T_PUBLIC, T_PRIVATE, T_PROTECTED, T_STATIC, T_READONLY, T_VAR, T_FINAL, T_CONST], true);
    }

    /** Brazos de un `match` (sin contar `default`). */
    private function matchArms(int $matchTok): int
    {
        $src = $this->src;
        $po = $src->next($matchTok);
        if (!$src->is($po, '(') || !isset($this->parser->parenMatch[$po])) {
            return 0;
        }
        $open = $src->next($this->parser->parenMatch[$po]);
        if (!$src->is($open, '{') || !isset($this->parser->braceMatch[$open])) {
            return 0;
        }
        $close = $this->parser->braceMatch[$open];
        $depth = 0;
        $arrows = 0;
        $hasDefault = false;
        for ($i = $open + 1; $i < $close; $i++) {
            $t = $src->tokens[$i];
            if ($t->text === '(' || $t->text === '[' || $t->text === '{' || $t->id === T_ATTRIBUTE || $t->id === T_CURLY_OPEN) {
                $depth++;
            } elseif ($t->text === ')' || $t->text === ']' || $t->text === '}') {
                $depth--;
            } elseif ($depth === 0) {
                if ($t->id === T_DOUBLE_ARROW) {
                    $arrows++;
                } elseif ($t->id === T_DEFAULT && $src->is($src->next($i), T_DOUBLE_ARROW)) {
                    $hasDefault = true;
                }
            }
        }
        return max(0, $arrows - ($hasDefault ? 1 : 0));
    }

    // ───────────────────────────── rangos de anidamiento ─────────────────────────────

    /**
     * Rangos de tokens. [inicio, fin, esControl, esBucle, anida]
     * `anida` = suma un nivel de anidamiento cognitivo (los callbacks de array_map solo cuentan como bucle).
     * @param list<int> $idxs
     * @return list<array{0:int,1:int,2:bool,3:bool,4:bool}>
     */
    private function buildRanges(array $idxs): array
    {
        $src = $this->src;
        $p = $this->parser;
        $ranges = [];

        foreach ($idxs as $i) {
            $t = $src->tokens[$i];
            switch ($t->id) {
                case T_IF:
                case T_ELSEIF:
                case T_FOR:
                case T_FOREACH:
                case T_WHILE:
                case T_SWITCH:
                case T_CATCH:
                    $b = $this->bodyStart($i);
                    if ($b !== null) {
                        $isLoop = in_array($t->id, [T_FOR, T_FOREACH, T_WHILE], true);
                        if ($src->is($b, ';')) {
                            break; // while (...); del do-while: no tiene cuerpo propio
                        }
                        if ($src->is($b, ':')) {
                            $end = $this->altEnd($i, $b);
                            $ranges[] = [$b, $end, true, $isLoop, true];
                        } else {
                            $ranges[] = [$b, $p->statementEnd($b), true, $isLoop, true];
                        }
                    }
                    break;
                case T_DO:
                    $b = $src->next($i);
                    if ($b !== null) {
                        $ranges[] = [$b, $p->statementEnd($b), true, true, true];
                    }
                    break;
                case T_ELSE:
                    $b = $src->next($i);
                    if ($b !== null && $src->tokens[$b]->id !== T_IF) {
                        $ranges[] = [$b, $p->statementEnd($b), true, false, true];
                    }
                    break;
                case T_MATCH:
                    $po = $src->next($i);
                    if ($src->is($po, '(') && isset($p->parenMatch[$po])) {
                        $open = $src->next($p->parenMatch[$po]);
                        if ($src->is($open, '{') && isset($p->braceMatch[$open])) {
                            $ranges[] = [$open, $p->braceMatch[$open], true, false, true];
                        }
                    }
                    break;
                case T_FUNCTION:
                    $n = $src->next($i);
                    if ($src->is($n, '&')) {
                        $n = $src->next($n);
                    }
                    if ($src->is($n, '(') && isset($p->parenMatch[$n])) {
                        // closure: salta `use (...)` y el tipo de retorno hasta la llave
                        $j = $src->next($p->parenMatch[$n]);
                        while ($j !== null && !in_array($src->tokens[$j]->text, ['{', ';'], true)) {
                            $j = $src->next($j);
                        }
                        if ($src->is($j, '{') && isset($p->braceMatch[$j])) {
                            $ranges[] = [$j, $p->braceMatch[$j], false, false, true];
                        }
                    }
                    break;
                case T_FN:
                    $arrow = $i;
                    while ($arrow !== null && $src->tokens[$arrow]->id !== T_DOUBLE_ARROW) {
                        $arrow = $src->next($arrow);
                        if ($arrow !== null && in_array($src->tokens[$arrow]->text, [';', '{'], true)) {
                            $arrow = null;
                        }
                    }
                    if ($arrow !== null) {
                        $ranges[] = [$arrow, $this->arrowEnd($arrow), false, false, true];
                    }
                    break;
                case T_STRING:
                    if (in_array(strtolower($t->text), self::CALLBACK_LOOPS, true)) {
                        $po = $src->next($i);
                        if ($src->is($po, '(') && isset($p->parenMatch[$po]) && !$src->is($src->prev($i), T_OBJECT_OPERATOR)) {
                            $ranges[] = [$po, $p->parenMatch[$po], false, true, false];
                        }
                    }
                    break;
            }
        }
        return $ranges;
    }

    /** Primer token del cuerpo de if/for/while/... (el siguiente a su `)`). */
    private function bodyStart(int $kw): ?int
    {
        $po = $this->src->next($kw);
        if (!$this->src->is($po, '(') || !isset($this->parser->parenMatch[$po])) {
            return null;
        }
        return $this->src->next($this->parser->parenMatch[$po]);
    }

    private function altEnd(int $kw, int $colon): int
    {
        $src = $this->src;
        $ends = [T_IF => T_ENDIF, T_ELSEIF => T_ENDIF, T_FOR => T_ENDFOR, T_FOREACH => T_ENDFOREACH, T_WHILE => T_ENDWHILE, T_SWITCH => T_ENDSWITCH];
        $target = $ends[$src->tokens[$kw]->id] ?? null;
        for ($i = $colon; $i < $src->count(); $i++) {
            $id = $src->tokens[$i]->id;
            if ($id === $target || (($id === T_ELSE || $id === T_ELSEIF) && $target === T_ENDIF)) {
                return $i - 1;
            }
        }
        return $src->count() - 1;
    }

    private function arrowEnd(int $arrow): int
    {
        $src = $this->src;
        $depth = 0;
        for ($i = $arrow + 1; $i < $src->count(); $i++) {
            $t = $src->tokens[$i];
            if ($t->text === '(' || $t->text === '[' || $t->text === '{') {
                $depth++;
            } elseif ($t->text === ')' || $t->text === ']' || $t->text === '}') {
                $depth--;
                if ($depth < 0) {
                    return $i - 1;
                }
            } elseif ($depth === 0 && ($t->text === ',' || $t->text === ';')) {
                return $i - 1;
            }
        }
        return $src->count() - 1;
    }

    // ───────────────────────────── Big-O estimado ─────────────────────────────

    /**
     * @param list<int> $idxs
     * @param array<string, array<string,mixed>> $callee complejidades ya calculadas de otras funciones
     * @return array{a:int, b:int, exp:?string, why:list<string>, recursive:bool}
     */
    private function bigO(Unit $unit, array $idxs, array $callee): array
    {
        $src = $this->src;
        $ranges = $this->buildRanges($idxs);
        $loopDepthAt = static function (int $i) use ($ranges): int {
            $d = 0;
            foreach ($ranges as [$s, $e, , $loop]) {
                if ($loop && $s <= $i && $i <= $e) {
                    $d++;
                }
            }
            return $d;
        };

        $best = ['a' => 0, 'b' => 0];
        $why = [];
        $consider = function (int $a, int $b, string $reason) use (&$best, &$why): void {
            if ($a > $best['a'] || ($a === $best['a'] && $b > $best['b'])) {
                $best = ['a' => $a, 'b' => $b];
            }
            if ($reason !== '' && !in_array($reason, $why, true)) {
                $why[] = $reason;
            }
        };

        // El `while (...)` que cierra un do { } while no es otro bucle.
        $doTails = [];
        foreach ($idxs as $i) {
            if ($src->tokens[$i]->id === T_DO && ($b = $src->next($i)) !== null) {
                $w = $src->next($this->parser->statementEnd($b));
                if ($src->is($w, T_WHILE)) {
                    $doTails[$w] = true;
                }
            }
        }

        $maxLoop = 0;
        foreach ($idxs as $i) {
            $t = $src->tokens[$i];
            if (in_array($t->id, [T_FOR, T_FOREACH, T_WHILE, T_DO], true)) {
                if ($t->id === T_WHILE && isset($doTails[$i])) {
                    continue;
                }
                $d = $loopDepthAt($i) + 1;
                if (($t->id === T_WHILE || $t->id === T_FOR) && $this->loopHalves($i)) {
                    $consider($d - 1, 1, 'el bucle reduce el rango a la mitad en cada vuelta: logarítmico');
                    continue;
                }
                $maxLoop = max($maxLoop, $d);
                $consider($d, 0, '');
                continue;
            }
            if ($t->id !== T_STRING || !$src->is($src->next($i), '(')) {
                continue;
            }
            $kind = $this->callKind($i);
            if ($kind === null) {
                continue;
            }
            $name = strtolower($t->text);
            $d = $loopDepthAt($i);

            if ($kind === 'function' && isset(self::COSTS[$name])) {
                [$a, $b] = self::COSTS[$name];
                if (($name === 'max' || $name === 'min') && $this->argCount($i) > 1) {
                    [$a, $b] = [0, 0];
                }
                if ($a > 0 || $b > 0) {
                    $reason = $d > 0
                        ? sprintf('%s() dentro de un bucle: %s × n%s', $t->text, self::label(['a' => $a, 'b' => $b, 'exp' => null]), $d > 1 ? '^' . $d : '')
                        : sprintf('%s() cuesta %s', $t->text, self::label(['a' => $a, 'b' => $b, 'exp' => null]));
                    $consider($d + $a, $b, $a >= 1 && ($d > 0 || $b > 0 || $a > 1) ? $reason : '');
                }
                continue;
            }

            $key = $kind === 'method' ? strtolower((string) $unit->class) . '::' . $name : $name;
            if (isset($callee[$key]) && !($key === $this->selfKey($unit))) {
                $cx = $callee[$key];
                if (($cx['a'] > 0 || $cx['b'] > 0) && !$cx['exp']) {
                    $consider(
                        $d + $cx['a'], $cx['b'],
                        sprintf('llama a %s() que cuesta %s%s', $t->text, self::label($cx), $d > 0 ? ' dentro de un bucle' : ''),
                    );
                }
            }
        }

        if ($maxLoop >= 2) {
            $why[] = sprintf('bucles anidados (profundidad %d)', $maxLoop);
        } elseif ($maxLoop === 1) {
            $why[] = 'un bucle sobre la entrada';
        }

        $recursive = false;
        $exp = null;
        $selfCalls = $this->selfCallTokens($unit, $idxs);
        if ($selfCalls) {
            $recursive = true;
            $c = count($selfCalls);
            $inLoop = false;
            $dividing = false;
            $decrementing = false;
            foreach ($selfCalls as $call) {
                $inLoop = $inLoop || $loopDepthAt($call) > 0;
                [$div, $dec] = $this->argShape($call);
                $dividing = $dividing || $div;
                $decrementing = $decrementing || $dec;
            }
            $memo = $this->hasMemo($unit, $idxs);
            $w = $best; // trabajo propio (sin contar la recursión)

            if ($memo) {
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

    /** ¿El bucle divide o duplica una variable en cada vuelta (búsqueda binaria, `$i *= 2`...)? */
    private function loopHalves(int $kw): bool
    {
        $src = $this->src;
        $po = $src->next($kw);
        if (!$src->is($po, '(') || !isset($this->parser->parenMatch[$po])) {
            return false;
        }
        $pc = $this->parser->parenMatch[$po];
        $b = $src->next($pc);
        $end = ($b !== null && !$src->is($b, ':') && !$src->is($b, ';')) ? $this->parser->statementEnd($b) : $pc;
        $isTwoOrOne = function (int $k, string $lit) use ($src): bool {
            $n = $src->next($k);
            return $n !== null && $src->tokens[$n]->id === T_LNUMBER && $src->tokens[$n]->text === $lit;
        };
        for ($k = $kw; $k <= $end; $k++) {
            $t = $src->tokens[$k];
            if (($t->id === T_SR || $t->id === T_SL || $t->id === T_SR_EQUAL || $t->id === T_SL_EQUAL) && $isTwoOrOne($k, '1')) {
                return true;
            }
            if (($t->text === '/' || $t->id === T_DIV_EQUAL || $t->id === T_MUL_EQUAL || $t->text === '*') && $isTwoOrOne($k, '2')) {
                if ($t->text !== '*' || $this->assignsToSelf($k)) {
                    return true;
                }
            }
            if ($t->id === T_STRING && strtolower($t->text) === 'intdiv') {
                return true;
            }
        }
        return false;
    }

    /** `$i = $i * 2` (el `*` aparece justo tras `$i =` o `$i * 2` termina asignándose) */
    private function assignsToSelf(int $starTok): bool
    {
        $src = $this->src;
        $left = $src->prev($starTok);
        $eq = $left !== null ? $src->prev($left) : null;
        $var = $eq !== null ? $src->prev($eq) : null;
        return $left !== null && $var !== null && $src->is($eq, '=') && $src->tokens[$left]->id === T_VARIABLE
            && $src->tokens[$var]->id === T_VARIABLE && $src->tokens[$var]->text === $src->tokens[$left]->text;
    }

    private function selfKey(Unit $unit): string
    {
        return $unit->kind === 'method' ? strtolower((string) $unit->class) . '::' . strtolower($unit->name) : strtolower($unit->name);
    }

    /** 'function' | 'method' (de la misma clase) | null (otra cosa que no sabemos evaluar) */
    private function callKind(int $i): ?string
    {
        $src = $this->src;
        $p = $src->prev($i);
        if ($p === null) {
            return 'function';
        }
        $pt = $src->tokens[$p];
        if ($pt->id === T_NEW || $pt->id === T_FUNCTION) {
            return null;
        }
        if ($pt->id === T_OBJECT_OPERATOR || $pt->id === T_NULLSAFE_OBJECT_OPERATOR) {
            $pp = $src->prev($p);
            return $pp !== null && $src->tokens[$pp]->text === '$this' ? 'method' : null;
        }
        if ($pt->id === T_DOUBLE_COLON) {
            $pp = $src->prev($p);
            if ($pp !== null && ($src->tokens[$pp]->id === T_STATIC || in_array(strtolower($src->tokens[$pp]->text), ['self', 'static'], true))) {
                return 'method';
            }
            return null;
        }
        return 'function';
    }

    private function argCount(int $nameTok): int
    {
        $src = $this->src;
        $po = $src->next($nameTok);
        if (!$src->is($po, '(') || !isset($this->parser->parenMatch[$po])) {
            return 0;
        }
        $pc = $this->parser->parenMatch[$po];
        if ($src->next($po) === $pc) {
            return 0;
        }
        $depth = 0;
        $n = 1;
        for ($i = $po + 1; $i < $pc; $i++) {
            $t = $src->tokens[$i];
            if ($t->text === '(' || $t->text === '[' || $t->text === '{') {
                $depth++;
            } elseif ($t->text === ')' || $t->text === ']' || $t->text === '}') {
                $depth--;
            } elseif ($t->text === ',' && $depth === 0) {
                $n++;
            }
        }
        return $n;
    }

    /** ¿Llama la función a sí misma? (para la complejidad cognitiva) */
    private function selfCalls(Unit $unit, array $idxs): bool
    {
        return $this->selfCallTokens($unit, $idxs) !== [];
    }

    /** @return list<int> tokens (nombre) de las llamadas recursivas */
    private function selfCallTokens(Unit $unit, array $idxs): array
    {
        $src = $this->src;
        $out = [];
        foreach ($idxs as $i) {
            $t = $src->tokens[$i];
            if ($t->id !== T_STRING || strcasecmp($t->text, $unit->name) !== 0 || $i === $unit->nameToken) {
                continue;
            }
            if (!$src->is($src->next($i), '(')) {
                continue;
            }
            $kind = $this->callKind($i);
            if ($kind === 'function' && $unit->kind === 'function' || $kind === 'method' && $unit->kind === 'method') {
                $out[] = $i;
            }
        }
        return $out;
    }

    /** @return array{0:bool,1:bool} [¿divide por la mitad?, ¿resta 1 o 2?] mirando los argumentos de una llamada */
    private function argShape(int $nameTok): array
    {
        $src = $this->src;
        $po = $src->next($nameTok);
        if (!$src->is($po, '(') || !isset($this->parser->parenMatch[$po])) {
            return [false, false];
        }
        $pc = $this->parser->parenMatch[$po];
        $dividing = false;
        $decrementing = false;
        for ($i = $po + 1; $i < $pc; $i++) {
            $t = $src->tokens[$i];
            if ($t->text === '/' || $t->id === T_SR || $t->id === T_DIV_EQUAL) {
                $dividing = true;
            } elseif ($t->id === T_STRING && in_array(strtolower($t->text), ['intdiv', 'floor', 'ceil', 'round'], true)) {
                $dividing = true;
            } elseif ($t->id === T_VARIABLE && preg_match('/^\$(mid|medio|mitad|half|middle|m|centro)$/i', $t->text)) {
                $dividing = true;
            } elseif ($t->text === '-' || $t->id === T_DEC) {
                $n = $src->next($i);
                if ($t->id === T_DEC || ($n !== null && $src->tokens[$n]->id === T_LNUMBER)) {
                    $decrementing = true;
                }
            }
        }
        return [$dividing, $decrementing];
    }

    /** ¿Usa memoización o un conjunto de visitados? */
    private function hasMemo(Unit $unit, array $idxs): bool
    {
        $src = $this->src;
        foreach ($unit->params as $p) {
            if (preg_match(self::MEMO_NAMES, $p['name'])) {
                return true;
            }
        }
        foreach ($idxs as $i) {
            $t = $src->tokens[$i];
            if ($t->id === T_STATIC && $src->tokens[$src->next($i) ?? $i]->id === T_VARIABLE) {
                return true;
            }
            if ($t->id === T_VARIABLE && preg_match(self::MEMO_NAMES, $t->text)) {
                return true;
            }
        }
        return false;
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /** Nota estilo radon: A 1-5, B 6-10, C 11-20, D 21-30, E 31-40, F 41+ */
    public static function grade(int $cc): string
    {
        return match (true) {
            $cc <= 5 => 'A',
            $cc <= 10 => 'B',
            $cc <= 20 => 'C',
            $cc <= 30 => 'D',
            $cc <= 40 => 'E',
            default => 'F',
        };
    }

    /** @param array{a:int, b:int, exp:?string} $cx */
    public static function label(array $cx): string
    {
        if (($cx['exp'] ?? null) === '2^n') {
            return 'O(2ⁿ)';
        }
        if (($cx['exp'] ?? null) === 'n!') {
            return 'O(2ⁿ) o O(n!)';
        }
        $a = $cx['a'];
        $b = $cx['b'];
        if ($a === 0 && $b === 0) {
            return 'O(1)';
        }
        $sup = [2 => '²', 3 => '³', 4 => '⁴', 5 => '⁵'];
        $poly = match (true) {
            $a === 0 => '',
            $a === 1 => 'n',
            default => 'n' . ($sup[$a] ?? '^' . $a),
        };
        $log = match (true) {
            $b === 0 => '',
            $b === 1 => 'log n',
            default => 'log' . ($sup[$b] ?? '^' . $b) . ' n',
        };
        return 'O(' . trim($poly . ($poly !== '' && $log !== '' ? ' ' : '') . $log) . ')';
    }

    /** Clave estable para comparar con lo que mide medir(): 1, log, n, nlogn, n2, n3, exp */
    public static function key(array $cx): string
    {
        if (!empty($cx['exp'])) {
            return 'exp';
        }
        return match (true) {
            $cx['a'] === 0 && $cx['b'] === 0 => '1',
            $cx['a'] === 0 => 'log',
            $cx['a'] === 1 && $cx['b'] === 0 => 'n',
            $cx['a'] === 1 => 'nlogn',
            $cx['a'] === 2 => 'n2',
            default => 'n3',
        };
    }

    /** @param list<array<string,mixed>> $units */
    private function summarize(array $units): array
    {
        $loc = 0;
        $ccTotal = 0;
        $ccMax = 0;
        $worst = null;
        $maxNest = 0;
        $count = 0;
        foreach ($units as $u) {
            $loc += $u['loc'];
            if ($u['kind'] === 'main') {
                continue;
            }
            $count++;
            $ccTotal += $u['cc'];
            $maxNest = max($maxNest, $u['nesting']);
            if ($u['cc'] > $ccMax) {
                $ccMax = $u['cc'];
                $worst = $u['qname'];
            }
        }
        $avg = $count > 0 ? round($ccTotal / $count, 1) : 0.0;
        return [
            'loc' => $loc,
            'functions' => $count,
            'ccTotal' => $ccTotal,
            'ccMax' => $ccMax,
            'ccAvg' => $avg,
            'grade' => self::grade((int) round($avg)),
            'worst' => $worst,
            'maxNesting' => $maxNest,
        ];
    }
}
