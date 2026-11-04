<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp\Analysis;

defined('PG_ROOT') or exit;

/**
 * Código C++ ya "troceado", sin compilador: fichas con su línea, emparejamiento de paréntesis/llaves, preprocesador
 * (includes y macros), tipos de usuario (struct/class/union/enum, alias `using`/`typedef`), funciones con cuerpo
 * (unidades: libres, métodos dentro y fuera de la clase, constructores, destructores, plantillas, operadores y main),
 * variables globales, campos y locales con su tipo. Es lo que usan las métricas, las pistas y los símbolos.
 *
 * Fichas: [tipo ('w' palabra, 's' cadena/carácter, 'n' número, 'p' símbolo), texto, offset en bytes, línea 1-based].
 */
final class CppCode
{
    /** Palabras reservadas: nunca son nombres de variable o de tipo. */
    public const KW = [
        'alignas' => 1, 'alignof' => 1, 'and' => 1, 'and_eq' => 1, 'asm' => 1, 'auto' => 1, 'bitand' => 1, 'bitor' => 1, 'bool' => 1,
        'break' => 1, 'case' => 1, 'catch' => 1, 'char' => 1, 'char8_t' => 1, 'char16_t' => 1, 'char32_t' => 1, 'class' => 1, 'compl' => 1,
        'concept' => 1, 'const' => 1, 'consteval' => 1, 'constexpr' => 1, 'constinit' => 1, 'const_cast' => 1, 'continue' => 1,
        'co_await' => 1, 'co_return' => 1, 'co_yield' => 1, 'decltype' => 1, 'default' => 1, 'delete' => 1, 'do' => 1, 'double' => 1,
        'dynamic_cast' => 1, 'else' => 1, 'enum' => 1, 'explicit' => 1, 'export' => 1, 'extern' => 1, 'false' => 1, 'float' => 1, 'for' => 1,
        'friend' => 1, 'goto' => 1, 'if' => 1, 'inline' => 1, 'int' => 1, 'long' => 1, 'mutable' => 1, 'namespace' => 1, 'new' => 1,
        'noexcept' => 1, 'not' => 1, 'not_eq' => 1, 'nullptr' => 1, 'operator' => 1, 'or' => 1, 'or_eq' => 1, 'private' => 1,
        'protected' => 1, 'public' => 1, 'register' => 1, 'reinterpret_cast' => 1, 'requires' => 1, 'return' => 1, 'short' => 1,
        'signed' => 1, 'sizeof' => 1, 'static' => 1, 'static_assert' => 1, 'static_cast' => 1, 'struct' => 1, 'switch' => 1,
        'template' => 1, 'this' => 1, 'thread_local' => 1, 'throw' => 1, 'true' => 1, 'try' => 1, 'typedef' => 1, 'typeid' => 1,
        'typename' => 1, 'union' => 1, 'unsigned' => 1, 'using' => 1, 'virtual' => 1, 'void' => 1, 'volatile' => 1, 'wchar_t' => 1,
        'while' => 1, 'xor' => 1, 'xor_eq' => 1, 'NULL' => 1,
    ];
    /** Palabras que forman tipos básicos (`unsigned long long`, `long double`…). */
    public const BUILTIN = ['bool' => 1, 'char' => 1, 'char8_t' => 1, 'char16_t' => 1, 'char32_t' => 1, 'wchar_t' => 1, 'short' => 1,
        'int' => 1, 'long' => 1, 'signed' => 1, 'unsigned' => 1, 'float' => 1, 'double' => 1, 'void' => 1, 'auto' => 1];
    /** Especificadores que pueden preceder a una declaración (const/volatile se guardan aparte: son parte del tipo). */
    public const SPECS = ['static' => 1, 'constexpr' => 1, 'consteval' => 1, 'constinit' => 1, 'inline' => 1, 'register' => 1,
        'thread_local' => 1, 'mutable' => 1, 'extern' => 1, 'virtual' => 1, 'explicit' => 1, 'friend' => 1, 'typename' => 1,
        'const' => 1, 'volatile' => 1];
    /** Tipos de la biblioteca estándar agrupados por comportamiento. */
    public const FAM = [
        'vector' => 'VEC', 'deque' => 'DEQ', 'list' => 'LIST', 'forward_list' => 'LIST', 'map' => 'TREE', 'multimap' => 'TREE',
        'set' => 'TREE', 'multiset' => 'TREE', 'unordered_map' => 'HASH', 'unordered_set' => 'HASH', 'unordered_multimap' => 'HASH',
        'unordered_multiset' => 'HASH', 'priority_queue' => 'PQ', 'queue' => 'QUEUE', 'stack' => 'STACK', 'string' => 'STR',
        'wstring' => 'STR', 'basic_string' => 'STR', 'string_view' => 'SV', 'array' => 'ARR', 'bitset' => 'BITS', 'pair' => 'PAIR',
        'tuple' => 'TUPLE', 'function' => 'FN', 'optional' => 'OPT', 'unique_ptr' => 'UPTR', 'shared_ptr' => 'SPTR', 'weak_ptr' => 'WPTR',
    ];
    /** Otros nombres de tipo de la biblioteca (para reconocer declaraciones). */
    public const STDT = ['size_t' => 1, 'ssize_t' => 1, 'ptrdiff_t' => 1, 'int8_t' => 1, 'int16_t' => 1, 'int32_t' => 1, 'int64_t' => 1,
        'uint8_t' => 1, 'uint16_t' => 1, 'uint32_t' => 1, 'uint64_t' => 1, 'intmax_t' => 1, 'uintmax_t' => 1, '__int128' => 1,
        'istream' => 1, 'ostream' => 1, 'iostream' => 1, 'stringstream' => 1, 'istringstream' => 1, 'ostringstream' => 1, 'ifstream' => 1,
        'ofstream' => 1, 'mt19937' => 1, 'mt19937_64' => 1, 'random_device' => 1, 'default_random_engine' => 1,
        'uniform_int_distribution' => 1, 'uniform_real_distribution' => 1, 'exception' => 1, 'runtime_error' => 1, 'logic_error' => 1,
        'invalid_argument' => 1, 'out_of_range' => 1, 'iterator' => 1, 'const_iterator' => 1, 'reverse_iterator' => 1, 'complex' => 1,
        'greater' => 1, 'less' => 1, 'hash' => 1, 'nullptr_t' => 1, 'initializer_list' => 1, 'mutex' => 1, 'thread' => 1, 'atomic' => 1,
        'variant' => 1, 'any' => 1, 'span' => 1, 'lock_guard' => 1, 'unique_lock' => 1, 'valarray' => 1, 'byte' => 1];

    /** Fichas tras las que puede empezar una declaración local. */
    private const ANTES_DECL = [';' => 1, '{' => 1, '}' => 1, 'else' => 1, 'do' => 1, '(' => 1];

    /** @var list<array{0:string,1:string,2:int,3:int}> */
    public array $t = [];
    /** @var array<int,int> */
    public array $m = [];
    /** @var array<int,array{0:int,1:int}> documentación asociada a una ficha */
    public array $doc = [];
    /** @var list<array<string,mixed>> líneas del preprocesador */
    public array $pp = [];
    /** @var array<int,array{0:int,1:string}> comentarios `//` por línea */
    public array $lc = [];
    /** @var array<string,int> cabecera => línea del #include */
    public array $includes = [];
    public int $lastInclude = 0;
    /** @var array<string,array<string,mixed>> macros: nombre => {value, params, line, off, type} */
    public array $macros = [];
    /** @var list<array<string,mixed>> struct/class/union/enum */
    public array $classes = [];
    /** @var array<string,string> nombre de tipo de usuario => 'struct'|'class'|'union'|'enum'|'alias'|'tparam'|'macro' */
    public array $typeNames = [];
    /** @var array<string,array<string,mixed>> alias: nombre => {target, tok, how:'using'|'typedef'|'macro'} */
    public array $aliases = [];
    /** @var list<array<string,mixed>> parámetros de plantilla {name, tok, from, to, type:bool} */
    public array $tparams = [];
    /** @var list<array<string,mixed>> enumeradores {name, tok, ci, value} */
    public array $enumerators = [];
    /** @var list<array<string,mixed>> funciones con cuerpo */
    public array $units = [];
    /** @var list<array<string,mixed>> declaraciones sin cuerpo (prototipos y métodos declarados en la clase) */
    public array $protos = [];
    /** @var list<array<string,mixed>> variables globales y campos (declaradores) */
    public array $vars = [];
    /** @var array<string,array<string,mixed>> globales: nombre => info de tipo */
    public array $globals = [];
    /** @var list<array<string,mixed>> lo que hay en el primer nivel del archivo (para soluciones e inserciones) */
    public array $top = [];
    /** @var array<int,array<string,mixed>> lambdas por la ficha `[` que las abre */
    public array $lambdas = [];
    /** @var list<int> offset de comienzo de cada línea */
    private array $ls = [0];
    private bool $ascii;
    /** @var array<int,array<string,mixed>> */
    private array $loc = [];
    /** @var array<string,array<string,mixed>> */
    private static array $typeMemo = [];

    public function __construct(public readonly string $code)
    {
        $L = CppLexer::lex($code);
        $this->t = $L['toks'];
        $this->m = $L['match'];
        $this->doc = $L['doc'];
        $this->pp = $L['pp'];
        $this->lc = $L['lc'];
        $this->ls = $L['ls'];
        $this->ascii = !preg_match('/[^\x00-\x7f]/', $code);
        $this->preprocessor();
        $this->scope(0, count($this->t), null, '', true);
    }

    // ───────────────────────────── posiciones ─────────────────────────────

    /** Columna (1-based, UTF-16 como Monaco) de un offset en bytes. */
    public function col(int $off, int $linea): int
    {
        $ini = $this->ls[$linea - 1] ?? 0;
        if ($this->ascii) {
            return $off - $ini + 1;
        }
        $pre = substr($this->code, $ini, $off - $ini);
        return (int) (strlen((string) mb_convert_encoding($pre, 'UTF-16LE', 'UTF-8')) / 2) + 1;
    }

    /** Rango {sl,sc,el,ec} desde el inicio de la ficha $a hasta el final de la ficha $b. */
    public function range(int $a, int $b): array
    {
        $ta = $this->t[$a];
        $tb = $this->t[$b];
        $fin = $tb[2] + strlen($tb[1]);
        $el = $tb[3];
        if ($tb[0] === 's' && str_contains($tb[1], "\n")) {
            $el += substr_count($tb[1], "\n");
        }
        return ['sl' => $ta[3], 'sc' => $this->col($ta[2], $ta[3]), 'el' => $el, 'ec' => $this->col($fin, $el)];
    }

    public function lineStart(int $linea): int
    {
        return $this->ls[$linea - 1] ?? strlen($this->code);
    }

    public function lineCount(): int
    {
        return count($this->ls);
    }

    /** Texto fuente de las fichas $a..$b con los espacios normalizados (`const vector<int>& v`). */
    public function text(int $a, int $b): string
    {
        if ($b < $a || !isset($this->t[$a], $this->t[$b])) {
            return '';
        }
        // ficha a ficha (así no se tocan los espacios de dentro de las cadenas): un espacio donde el código tenía alguno
        $T = $this->t;
        $s = $T[$a][1];
        for ($k = $a + 1; $k <= $b; $k++) {
            $x = $T[$k][1];
            $p = $T[$k - 1];
            if ($T[$k][2] > $p[2] + strlen($p[1]) && !in_array($x, ['&', '*', '>', ']', ',', ')', '&&', ';'], true)
                && !in_array($p[1], ['<', '(', '['], true)) {
                $s .= ' ';
            } elseif ($p[0] === 'w' && $T[$k][0] === 'w') {
                $s .= ' ';
            }
            $s .= $x;
        }
        return $s;
    }

    /** Documentación limpia (sin `/**`, `*`, `///`, `//`) de un rango de bytes. */
    public function docText(?array $r): ?string
    {
        if ($r === null) {
            return null;
        }
        $raw = substr($this->code, $r[0], $r[1] - $r[0]);
        $out = [];
        foreach (preg_split('/\R/', $raw) ?: [] as $l) {
            $l = (string) preg_replace(['~^\s*(/\*\*+|\*/|\*(?!/)|///?)\s?~', '~\s*\*+/\s*$~'], '', $l);
            $out[] = rtrim($l);
        }
        $s = trim(implode("\n", $out));
        return $s === '' ? null : $s;
    }

    // ───────────────────────────── preprocesador ─────────────────────────────

    private function preprocessor(): void
    {
        foreach ($this->pp as $k => $p) {
            $txt = (string) preg_replace('~\\\\\r?\n~', ' ', $p['text']);
            $txt = (string) preg_replace('~/\*.*?\*/|//.*$~s', '', $txt);
            if (preg_match('~^#\s*include\s*([<"])([^>"]+)[>"]~', $txt, $mm)) {
                $this->includes[trim($mm[2])] = $p['line'];
                $this->lastInclude = max($this->lastInclude, $k + 1);
                continue;
            }
            if (!preg_match('~^#\s*define\s+([A-Za-z_]\w*)(\([^)]*\))?\s*(.*)$~s', $txt, $mm)) {
                continue;
            }
            $name = $mm[1];
            $val = trim($mm[3]);
            $isType = $mm[2] === '' && $val !== '' && $this->looksType($val);
            $this->macros[$name] = ['value' => $val, 'params' => $mm[2] !== '' ? $mm[2] : null, 'line' => $p['line'],
                'off' => $p['off'] + (int) strpos($p['text'], $name, 7), 'type' => $isType, 'pp' => $k];
            if ($isType && !isset(self::BUILTIN[$name])) {
                $this->typeNames[$name] = 'macro';
                $this->aliases[$name] = ['target' => $val, 'tok' => -1, 'how' => 'macro'];
            }
        }
    }

    /** ¿Un texto es un tipo? (`long long`, `pair<int,int>`, `vector<int>`, `unsigned long long`) */
    private function looksType(string $s): bool
    {
        if (preg_match('/^(?:(?:unsigned|signed|long|short|int|char|double|float|bool|const)\s*)+$/', $s)) {
            return true;
        }
        return (bool) preg_match('/^(?:std::)?([A-Za-z_]\w*)\s*<.*>$/s', $s, $mm) && isset(self::FAM[$mm[1]]);
    }

    // ───────────────────────────── ámbitos: archivo, namespace, clase ─────────────────────────────

    /** Recorre los elementos de $i..$lim (archivo, namespace o cuerpo de clase $ci). */
    private function scope(int $i, int $lim, ?int $ci, string $cls, bool $file): void
    {
        while ($i < $lim) {
            $i = max($i + 1, $this->item($i, $lim, $ci, $cls, $file));
        }
    }

    private function item(int $i, int $lim, ?int $ci, string $cls, bool $file): int
    {
        $T = $this->t;
        $M = $this->m;
        $first = $i;
        $x = $T[$i][1];
        if ($x === ';' || $x === '}') {
            return $i + 1;
        }
        if ($ci !== null && ($x === 'public' || $x === 'private' || $x === 'protected') && ($T[$i + 1][1] ?? '') === ':') {
            return $i + 2;
        }
        // prefijos: template<...>, [[atributos]], especificadores
        $tpl = null;
        $spec = [];
        $tpFrom = count($this->tparams);
        while ($i < $lim) {
            $x = $T[$i][1];
            if ($x === 'template' && ($T[$i + 1][1] ?? '') === '<') {
                $e = $this->angles($i + 1, $lim);
                if ($e < 0) {
                    return $i + 1;
                }
                $this->templateParams($i + 2, $e - 2);
                $tpl ??= $i;
                $i = $e;
                continue;
            }
            if ($x === '[' && ($T[$i + 1][1] ?? '') === '[' && isset($M[$i])) {
                $i = $M[$i] + 1;
                continue;
            }
            if ($T[$i][0] === 'w' && isset(self::SPECS[$x]) && $x !== 'const' && $x !== 'volatile' && $x !== 'typename') {
                $spec[$x] = true;
                $i++;
                continue;
            }
            break;
        }
        if ($i >= $lim) {
            return $lim;
        }
        $x = $T[$i][1];
        $next = $this->itemKind($first, $i, $lim, $ci, $cls, $file, $tpl, $spec);
        for ($q = $tpFrom, $nq = count($this->tparams); $q < $nq; $q++) {
            $this->tparams[$q]['to'] = min(count($this->t) - 1, max($first, $next - 1));
        }
        return $next;
    }

    /** @param array<string,bool> $spec */
    private function itemKind(int $first, int $i, int $lim, ?int $ci, string $cls, bool $file, ?int $tpl, array $spec): int
    {
        $T = $this->t;
        $M = $this->m;
        $x = $T[$i][1];
        $top = $file && $ci === null;
        switch ($T[$i][0] === 'w' ? $x : '') {
            case 'using':
                $e = $this->until($i, $lim, ';');
                if (($T[$i + 1][0] ?? '') === 'w' && ($T[$i + 2][1] ?? '') === '=' && $T[$i + 1][1] !== 'namespace') {
                    $this->alias($T[$i + 1][1], $i + 1, $this->text($i + 3, $e - 1), 'using', $ci);
                    if ($top) {
                        $this->addTop(['kind' => 'alias', 'name' => $T[$i + 1][1], 'ti' => $first, 'tj' => $e]);
                    }
                } elseif ($top) {
                    $this->addTop(['kind' => 'other', 'name' => '', 'ti' => $first, 'tj' => $e]);
                }
                return $e + 1;
            case 'typedef':
                $e = $this->until($i, $lim, ';');
                $k = $i + 1;
                if (in_array($T[$k][1] ?? '', ['struct', 'class', 'union', 'enum'], true)) {
                    $j = $k + 1;
                    while ($j < $e && $T[$j][1] !== '{') {
                        $j++;
                    }
                    if ($j < $e && isset($M[$j])) {
                        $this->klass($k, $j, $T[$k + 1][0] === 'w' && $T[$k + 1][1] !== '{' ? $T[$k + 1][1] : ($T[$e - 1][1] ?? ''), $ci, $first);
                    }
                }
                $nt = $e - 1;
                while ($nt > $i && $T[$nt][1] === ']' && isset($M[$nt])) {
                    $nt = $M[$nt] - 1;
                }
                if ($T[$nt][0] === 'w' && $nt > $i + 1) {
                    $conCuerpo = in_array($T[$i + 1][1], ['struct', 'class', 'union', 'enum'], true) && isset($j) && isset($M[$j]) && $j < $e;
                    if ($conCuerpo && $this->classIndex($T[$nt][1]) !== null) {
                        if ($top) {
                            $this->addTop(['kind' => 'type', 'name' => $T[$nt][1], 'ti' => $first, 'tj' => $e]);
                        }
                        return $e + 1;
                    }
                    $tgt = $conCuerpo ? $T[$i + 2][1] : $this->text($i + 1, $nt - 1);
                    $this->alias($T[$nt][1], $nt, $tgt, 'typedef', $ci);
                    if ($top) {
                        $this->addTop(['kind' => 'alias', 'name' => $T[$nt][1], 'ti' => $first, 'tj' => $e]);
                    }
                }
                return $e + 1;
            case 'namespace':
                $j = $i + 1;
                while ($j < $lim && $T[$j][1] !== '{' && $T[$j][1] !== ';') {
                    $j++;
                }
                if (($T[$j][1] ?? '') === '{' && isset($M[$j])) {
                    $this->scope($j + 1, $M[$j], null, '', $file);
                    return $M[$j] + 1;
                }
                return $j + 1;
            case 'extern':
                if (($T[$i + 1][0] ?? '') === 's' && ($T[$i + 2][1] ?? '') === '{' && isset($M[$i + 2])) {
                    $this->scope($i + 3, $M[$i + 2], null, '', $file);
                    return $M[$i + 2] + 1;
                }
                break;
            case 'static_assert':
                return $this->until($i, $lim, ';') + 1;
            case 'struct':
            case 'class':
            case 'union':
            case 'enum':
                $j = $i + 1;
                while ($j < $lim && !in_array($T[$j][1], ['{', ';', '=', '('], true)) {
                    $j = ($T[$j][1] === '<' && ($e = $this->angles($j, $lim)) > 0) ? $e : $j + 1;
                }
                if (($T[$j][1] ?? '') === '{' && isset($M[$j])) {
                    $name = '';
                    for ($q = $i + 1; $q < $j; $q++) {
                        if ($T[$q][0] === 'w' && !in_array($T[$q][1], ['class', 'struct', 'final', 'alignas'], true)) {
                            $name = $T[$q][1];
                            break;
                        }
                        if ($T[$q][1] === ':') {
                            break;
                        }
                    }
                    $nci = $this->klass($i, $j, $name, $ci, $first, $tpl);
                    $close = $M[$j];
                    $e = $this->until($close, $lim, ';');
                    if ($e > $close + 1) {                       // `} a, b;` variables de ese tipo
                        $this->declVars($close + 1, $lim, $ci, $cls, $file, $name, $first);
                    }
                    if ($top) {
                        $this->addTop(['kind' => 'type', 'name' => $name, 'ti' => $first, 'tj' => min($e, $lim - 1), 'ci' => $nci]);
                    }
                    return $e + 1;
                }
                if (($T[$j][1] ?? '') === ';' && $j === $i + 2) {
                    return $j + 1;                               // declaración adelantada: `struct Nodo;`
                }
                break;
        }
        if ($ci !== null && $x === 'friend' && in_array($T[$i + 1][1] ?? '', ['class', 'struct'], true)) {
            return $this->until($i, $lim, ';') + 1;
        }
        // ¿función o variable? Primer '(' / '=' / ';' / '{' / ',' / '[' del nivel
        $j = $i;
        $op = -1;
        while ($j < $lim) {
            $y = $T[$j][1];
            if ($y === 'operator' && $T[$j][0] === 'w') {
                $op = $j;
                if (($T[$j + 1][1] ?? '') === '(' && ($T[$j + 2][1] ?? '') === ')') {
                    $j += 3;
                } elseif (($T[$j + 1][1] ?? '') === '[' && ($T[$j + 2][1] ?? '') === ']') {
                    $j += 3;
                } else {
                    $j++;
                    while ($j < $lim && $T[$j][1] !== '(') {
                        $j++;
                    }
                }
                break;
            }
            if ($y === '<' && $j > $i && $T[$j - 1][0] === 'w' && ($e = $this->angles($j, $lim)) > 0) {
                $j = $e;
                continue;
            }
            if (in_array($y, ['(', '=', ';', '{', ',', '[', ':'], true) || $T[$j][0] === 's') {
                break;
            }
            $j++;
        }
        if ($j >= $lim) {
            return $lim;
        }
        if ($T[$j][1] === '(' && isset($M[$j]) && ($op >= 0 || ($T[$j - 1][0] === 'w' && !isset(self::KW[$T[$j - 1][1]])))) {
            $r = $this->func($first, $i, $op >= 0 ? $op : $j - 1, $j, $lim, $ci, $cls, $tpl, $spec, $op >= 0, $file);
            if ($r !== null) {
                return $r;
            }
        }
        if (in_array($T[$j][1], ['=', ';', ',', '[', '{', '(', ':'], true)) {
            return $this->declVars($i, $lim, $ci, $cls, $file, null, $first, $spec);
        }
        return $this->until($i, $lim, ';') + 1;
    }

    /** Índice del primer `$what` del nivel desde $i (saltando paréntesis, llaves y corchetes). */
    public function until(int $i, int $lim, string $what): int
    {
        $T = $this->t;
        for ($j = $i; $j < $lim; $j++) {
            $y = $T[$j][1];
            if ($y === $what) {
                return $j;
            }
            if (($y === '(' || $y === '{' || $y === '[') && isset($this->m[$j])) {
                $j = $this->m[$j];
            }
        }
        return $lim;
    }

    /** Alta de un elemento de primer nivel con sus fichas dentro del archivo (el código a medio escribir puede no cerrarse). */
    private function addTop(array $it): void
    {
        $max = count($this->t) - 1;
        $it['ti'] = max(0, min($it['ti'], $max));
        $it['tj'] = max($it['ti'], min($it['tj'], $max));
        $this->top[] = $it;
    }

    private function alias(string $name, int $tok, string $target, string $how, ?int $ci): void
    {
        $this->typeNames[$name] = 'alias';
        $this->aliases[$name] = ['target' => $target, 'tok' => $tok, 'how' => $how, 'ci' => $ci];
    }

    /** `template<typename T, int N = 5>`: los nombres (los de tipo cuentan como tipos conocidos). */
    private function templateParams(int $a, int $b): void
    {
        $T = $this->t;
        $ini = $a;
        $prof = 0;
        for ($k = $a; $k <= $b + 1; $k++) {
            $y = $T[$k][1] ?? ',';
            if ($k <= $b && $y === '<') {
                $prof++;
            } elseif ($k <= $b && $y === '>') {
                $prof--;
            } elseif ($k <= $b && ($y === '(' || $y === '[') && isset($this->m[$k])) {
                $k = $this->m[$k];
                continue;
            }
            if ($k > $b || ($y === ',' && $prof === 0)) {
                $fin = $k - 1;
                for ($q = $ini; $q <= $fin; $q++) {
                    if ($T[$q][1] === '=') {
                        $fin = $q - 1;
                        break;
                    }
                }
                if ($fin >= $ini && $T[$fin][0] === 'w' && !isset(self::KW[$T[$fin][1]]) && $fin > $ini) {
                    $esTipo = in_array($T[$ini][1], ['typename', 'class'], true) || ($T[$ini][0] === 'w' && !isset(self::BUILTIN[$T[$ini][1]]) && $fin === $ini + 1 && !isset(self::STDT[$T[$ini][1]]) && !isset($this->typeNames[$T[$ini][1]]));
                    $this->tparams[] = ['name' => $T[$fin][1], 'tok' => $fin, 'from' => $a - 2, 'to' => $b, 'type' => $esTipo, 'text' => $this->text($ini, $fin)];
                    if ($esTipo) {
                        $this->typeNames[$T[$fin][1]] ??= 'tparam';
                    }
                }
                $ini = $k + 1;
            }
        }
    }

    /** struct/class/union/enum con cuerpo en $open. Devuelve su índice en classes. */
    private function klass(int $kw, int $open, string $name, ?int $parent, int $first, ?int $tpl = null): int
    {
        $T = $this->t;
        $M = $this->m;
        $kind = $T[$kw][1];
        $scoped = $kind === 'enum' && in_array($T[$kw + 1][1] ?? '', ['class', 'struct'], true);
        $ci = count($this->classes);
        $nameTok = -1;
        for ($q = $kw + 1; $q < $open; $q++) {
            if ($T[$q][1] === $name && $T[$q][0] === 'w') {
                $nameTok = $q;
                break;
            }
        }
        $under = null;
        if ($kind === 'enum') {
            for ($q = $kw + 1; $q < $open; $q++) {
                if ($T[$q][1] === ':') {
                    $under = $this->text($q + 1, $open - 1);
                }
            }
        }
        $this->classes[] = ['name' => $name, 'kind' => $kind, 'scoped' => $scoped, 'open' => $open, 'close' => $M[$open], 'first' => $first,
            'kw' => $kw, 'nameTok' => $nameTok, 'line' => $T[$kw][3], 'fields' => [], 'order' => [], 'parent' => $parent, 'tpl' => $tpl, 'under' => $under,
            'methods' => []];
        if ($name !== '') {
            $this->typeNames[$name] = $kind;
        }
        if ($kind === 'enum') {
            $ini = $open + 1;
            $val = 0;
            for ($k = $open + 1; $k <= $M[$open]; $k++) {
                $y = $T[$k][1];
                if (($y === '(' || $y === '{' || $y === '[') && isset($M[$k]) && $k < $M[$open]) {
                    $k = $M[$k];
                    continue;
                }
                if ($y === ',' || $k === $M[$open]) {
                    if ($ini < $k && $T[$ini][0] === 'w') {
                        $v = null;
                        if (($T[$ini + 1][1] ?? '') === '=') {
                            $v = $this->text($ini + 2, $k - 1);
                            if (preg_match('/^-?\d+$/', $v)) {
                                $val = (int) $v;
                            }
                        }
                        $this->enumerators[] = ['name' => $T[$ini][1], 'tok' => $ini, 'ci' => $ci, 'value' => $v ?? (string) $val];
                        $val++;
                    }
                    $ini = $k + 1;
                }
            }
            return $ci;
        }
        $this->scope($open + 1, $M[$open], $ci, $name, false);
        return $ci;
    }

    /**
     * Posible función: nombre en $nt (o `operator`), paréntesis en $po. Registra la unidad (con cuerpo) o el prototipo y
     * devuelve el índice siguiente; null si aquello no es una función (p. ej. `vector<int> v(n);`).
     * @param array<string,bool> $spec
     */
    private function func(int $first, int $ts, int $nt, int $po, int $lim, ?int $ci, string $cls, ?int $tpl, array $spec, bool $isOp, bool $file): ?int
    {
        $T = $this->t;
        $M = $this->m;
        $pc = $M[$po];
        // nombre (con calificador Clase:: y ~ de destructor)
        $ns = $nt;
        $name = $isOp ? 'operator' . implode('', array_map(static fn($t) => $t[1], array_slice($T, $nt + 1, $po - $nt - 1))) : $T[$nt][1];
        if ($isOp && preg_match('/^operator[a-z]/', $name)) {
            $name = 'operator ' . substr($name, 8);
        }
        $dtor = false;
        if (($T[$ns - 1][1] ?? '') === '~') {
            $dtor = true;
            $name = '~' . $name;
            $ns--;
        }
        $owner = $cls;
        $oci = $ci;
        if (($T[$ns - 1][1] ?? '') === '::' && ($ns - 2) >= $ts) {
            $q = $ns - 2;
            if ($T[$q][1] === '>' && ($o = $this->openAngle($q, $ts)) >= 0) {
                $q = $o - 1;
            }
            if ($T[$q][0] === 'w') {
                $owner = $T[$q][1];
                $oci = $this->classIndex($owner);
                $ns = $q;
                while (($T[$ns - 1][1] ?? '') === '::' && ($T[$ns - 2][0] ?? '') === 'w' && $ns - 2 >= $ts) {
                    $ns -= 2;
                }
            }
        }
        $ctor = !$dtor && !$isOp && $owner !== '' && $name === $owner;
        if ($ns === $ts && !$ctor && !$dtor && !$isOp) {
            return null;                                         // sin tipo de retorno: una llamada o una macro, no una función
        }
        // tras los parámetros: const, noexcept, override, final, -> tipo, = 0 / default / delete, : lista de inicialización
        $k = $pc + 1;
        $trail = null;
        $quals = [];
        while ($k < $lim) {
            $y = $T[$k][1];
            if (in_array($y, ['const', 'volatile', '&', '&&', 'override', 'final', 'mutable'], true)) {
                $quals[$y] = true;
                $k++;
            } elseif (($y === 'noexcept' || $y === 'throw') && $T[$k][0] === 'w') {
                $k = (($T[$k + 1][1] ?? '') === '(' && isset($M[$k + 1])) ? $M[$k + 1] + 1 : $k + 1;
            } elseif ($y === '[' && ($T[$k + 1][1] ?? '') === '[' && isset($M[$k])) {
                $k = $M[$k] + 1;
            } elseif ($y === '->') {
                $a = $k + 1;
                $k++;
                while ($k < $lim && !in_array($T[$k][1], ['{', ';', '='], true)) {
                    $k = ($T[$k][1] === '<' && ($e = $this->angles($k, $lim)) > 0) ? $e : (($T[$k][1] === '(' && isset($M[$k])) ? $M[$k] + 1 : $k + 1);
                }
                $trail = $this->text($a, $k - 1);
            } elseif ($y === 'requires') {
                $k++;
                while ($k < $lim && $T[$k][1] !== '{' && $T[$k][1] !== ';') {
                    $k = (in_array($T[$k][1], ['(', '['], true) && isset($M[$k])) ? $M[$k] + 1 : $k + 1;
                }
            } else {
                break;
            }
        }
        $y = $T[$k][1] ?? '';
        $open = -1;
        if ($y === '{' && isset($M[$k])) {
            $open = $k;
        } elseif ($y === ':' && ($ctor || $owner !== '')) {
            $q = $k + 1;
            while ($q < $lim) {
                while ($q < $lim && ($T[$q][0] === 'w' || $T[$q][1] === '::')) {
                    $q++;
                }
                if (($T[$q][1] ?? '') === '<' && ($e = $this->angles($q, $lim)) > 0) {
                    $q = $e;
                }
                if (in_array($T[$q][1] ?? '', ['(', '{'], true) && isset($M[$q])) {
                    $q = $M[$q] + 1;
                }
                if (($T[$q][1] ?? '') === '...') {
                    $q++;
                }
                if (($T[$q][1] ?? '') === ',') {
                    $q++;
                    continue;
                }
                break;
            }
            if (($T[$q][1] ?? '') === '{' && isset($M[$q])) {
                $open = $q;
            } else {
                return null;
            }
        } elseif ($y === ';' || ($y === '=' && in_array($T[$k + 1][1] ?? '', ['0', 'default', 'delete'], true))) {
            if (!$this->looksParams($po, $pc) && !$ctor && !$isOp) {
                return null;                                     // `vector<int> v(n);`: variable con argumentos
            }
            $end = $this->until($k, $lim, ';');
            $this->protos[] = ['name' => $name, 'cls' => $owner, 'ci' => $oci, 'nameTok' => $nt, 'first' => $first, 'ts' => $ts, 'ns' => $ns,
                'po' => $po, 'params' => $this->params($po), 'ret' => $ctor || $dtor ? '' : ($trail ?? $this->retText($ts, $ns - 1)),
                'spec' => $spec, 'quals' => $quals, 'tpl' => $tpl, 'ctor' => $ctor, 'dtor' => $dtor, 'end' => $end, 'inClass' => $ci !== null];
            if ($file && $ci === null) {
                $this->addTop(['kind' => 'proto', 'name' => $name, 'ti' => $first, 'tj' => $end]);
            }
            return $end + 1;
        } else {
            return null;
        }
        $close = $M[$open];
        $u = count($this->units);
        $this->units[] = [
            'name' => $name, 'cls' => $owner, 'ci' => $oci, 'ctor' => $ctor, 'dtor' => $dtor, 'op' => $isOp, 'first' => $first, 'ts' => $ts,
            'ns' => $ns, 'nameTok' => $nt, 'po' => $po, 'pc' => $pc, 'open' => $open, 'close' => $close, 'params' => $this->params($po),
            'ret' => $ctor || $dtor ? '' : ($trail ?? $this->retText($ts, $ns - 1)), 'auto' => !$ctor && !$dtor && $trail !== null,
            'spec' => $spec, 'quals' => $quals, 'tpl' => $tpl, 'inClass' => $ci !== null,
            'kind' => $owner === '' && $name === 'main' ? 'main' : ($owner !== '' ? 'method' : 'function'),
            'static' => isset($spec['static']), 'virtual' => isset($spec['virtual']) || isset($quals['override']) || isset($quals['final']),
        ];
        if ($file && $ci === null) {
            $this->addTop(['kind' => $owner === '' ? ($name === 'main' ? 'main' : 'function') : 'method', 'name' => $name, 'ti' => $first, 'tj' => $close, 'unit' => $u]);
        }
        $this->scanLambdasIn($pc + 1, $open);            // por si hay lambdas en la lista de inicialización
        return $close + 1;
    }

    /** Texto del tipo de retorno (sin especificadores como static/inline). */
    private function retText(int $a, int $b): string
    {
        $T = $this->t;
        while ($a <= $b && $T[$a][0] === 'w' && isset(self::SPECS[$T[$a][1]]) && $T[$a][1] !== 'const' && $T[$a][1] !== 'volatile') {
            $a++;
        }
        return $this->text($a, $b);
    }

    /** ¿El contenido de unos paréntesis parece una lista de parámetros (y no argumentos)? */
    private function looksParams(int $po, int $pc): bool
    {
        if ($pc === $po + 1) {
            return true;
        }
        $T = $this->t;
        $a = $T[$po + 1];
        if ($a[0] !== 'w') {
            return $a[1] === '...';
        }
        if (isset(self::BUILTIN[$a[1]]) || isset(self::SPECS[$a[1]]) || isset($this->typeNames[$a[1]]) || isset(self::FAM[$a[1]]) || isset(self::STDT[$a[1]])) {
            return true;
        }
        if ($a[1] === 'std' && ($T[$po + 2][1] ?? '') === '::') {
            return true;
        }
        // `Tipo nombre` (dos palabras seguidas) solo puede ser un parámetro
        return ($T[$po + 2][0] ?? '') === 'w' || in_array($T[$po + 2][1] ?? '', ['&', '*', '&&', '<'], true) && ($T[$po + 3][0] ?? '') === 'w';
    }

    public function classIndex(string $name): ?int
    {
        foreach ($this->classes as $k => $c) {
            if ($c['name'] === $name && $c['kind'] !== 'enum') {
                return $k;
            }
        }
        return null;
    }

    /** Variables de archivo/clase desde $i. Devuelve el índice siguiente. @param array<string,bool> $spec */
    private function declVars(int $i, int $lim, ?int $ci, string $cls, bool $file, ?string $typeOf, int $first, array $spec = []): int
    {
        $ctx = $ci !== null ? 'member' : 'global';
        $ds = $typeOf !== null ? $this->declarators($i, $lim, $ctx, $i, $i - 1, [], $typeOf, true) : $this->declAt($i, $lim, $ctx);
        $end = $this->until($i, $lim, ';');
        if ($ds === null) {
            $this->scanLambdasIn($i, $end);
            return $end + 1;
        }
        foreach ($ds as $d) {
            $d['ci'] = $ci;
            $d['cls'] = $cls;
            $d['spec'] += $spec;
            $d['first'] = $first;
            $info = $this->varInfo($d, []);
            if ($ci !== null) {
                $this->classes[$ci]['fields'][$d['name']] = $info;
                $this->classes[$ci]['order'][] = $d['name'];
            } else {
                $this->globals[$d['name']] = $info;
            }
            $this->vars[] = $d;
        }
        if ($file && $ci === null) {
            $this->addTop(['kind' => 'var', 'name' => $ds[0]['name'], 'ti' => $first, 'tj' => $end]);
        }
        $this->scanLambdasIn($i, $end);
        return $end + 1;
    }

    /** Registra las lambdas que haya entre $a y $b (en inicializadores de globales y campos). */
    private function scanLambdasIn(int $a, int $b): void
    {
        for ($k = $a; $k < $b; $k++) {
            if ($this->t[$k][1] === '[' && ($l = $this->lambdaAt($k)) !== null) {
                $k = $l['close'];
            }
        }
    }

    // ───────────────────────────── declaraciones ─────────────────────────────

    /** Salta `<...>` de una plantilla; devuelve el índice posterior al `>` o -1 si aquello no parece una plantilla. */
    public function angles(int $i, int $lim): int
    {
        $T = $this->t;
        $prof = 0;
        for ($j = $i; $j < $lim && $j < $i + 120; $j++) {
            $x = $T[$j];
            $y = $x[1];
            if ($y === '<') {
                $prof++;
            } elseif ($y === '>') {
                if (--$prof === 0) {
                    return $j + 1;
                }
            } elseif ($y === '(' && isset($this->m[$j])) {
                $j = $this->m[$j];
            } elseif (!($x[0] === 'w' || $x[0] === 'n' || in_array($y, [',', '::', '*', '&', '[', ']', '+', '-', '...', '.'], true))) {
                return -1;
            }
        }
        return -1;
    }

    /** El `<` que abre el `>` de la ficha $j (hacia atrás), o -1. */
    private function openAngle(int $j, int $lim): int
    {
        $prof = 0;
        for ($k = $j; $k >= $lim; $k--) {
            $y = $this->t[$k][1];
            if ($y === '>') {
                $prof++;
            } elseif ($y === '<' && --$prof === 0) {
                return $k;
            } elseif ($y === ')' && isset($this->m[$k])) {
                $k = $this->m[$k];
            }
        }
        return -1;
    }

    /** ¿Es un nombre de tipo conocido (básico, de la biblioteca, de usuario o parámetro de plantilla)? */
    public function isType(string $w): bool
    {
        return isset(self::BUILTIN[$w]) || isset(self::FAM[$w]) || isset(self::STDT[$w]) || isset($this->typeNames[$w]);
    }

    /**
     * ¿Empieza en la ficha $i una declaración `[static|const…] Tipo decl1 [= …], decl2…`? $ctx: 'stmt', 'for' (cabecera de
     * for), 'cond' (if/while/switch), 'global', 'member'. Cada declarador: {name, tok, ts, te, cv, spec, ptr, dims, init:[a,b]|null,
     * ik:'='|'('|'{'|':'|null, end, bind:list<[nombre, ficha]>|null}.
     * @return ?list<array<string,mixed>>
     */
    public function declAt(int $i, int $lim, string $ctx): ?array
    {
        $T = $this->t;
        $M = $this->m;
        $j = $i;
        $spec = [];
        $cv = '';
        while ($j < $lim) {
            $x = $T[$j][1];
            if ($T[$j][0] === 'w' && isset(self::SPECS[$x])) {
                if ($x === 'const' || $x === 'volatile') {
                    $cv .= $x . ' ';
                }
                $spec[$x] = true;
                $j++;
            } elseif ($x === '[' && ($T[$j + 1][1] ?? '') === '[' && isset($M[$j])) {
                $j = $M[$j] + 1;
            } else {
                break;
            }
        }
        $ts = $j;
        $x = $T[$j] ?? null;
        if ($x === null || $x[0] !== 'w') {
            return null;
        }
        $known = true;
        $w = $x[1];
        if (isset(self::BUILTIN[$w])) {
            while ($j < $lim && $T[$j][0] === 'w' && (isset(self::BUILTIN[$T[$j][1]]) || $T[$j][1] === 'const' || $T[$j][1] === 'volatile')) {
                $j++;
            }
        } elseif ($w === 'decltype' && ($T[$j + 1][1] ?? '') === '(' && isset($M[$j + 1])) {
            $j = $M[$j + 1] + 1;
        } elseif (in_array($w, ['struct', 'class', 'enum', 'union'], true) && ($T[$j + 1][0] ?? '') === 'w') {
            $j += 2;
        } elseif (!isset(self::KW[$w])) {
            $known = $this->isType($w) || ($w === 'std' && ($T[$j + 1][1] ?? '') === '::');
            while (true) {
                $j++;
                if (($T[$j][1] ?? '') === '<') {
                    $j = $this->angles($j, $lim);
                    if ($j < 0) {
                        return null;
                    }
                }
                if (($T[$j][1] ?? '') === '::' && ($T[$j + 1][0] ?? '') === 'w') {
                    $j++;
                    if (!$known || $T[$j - 2][1] === 'std') {
                        $known = $known || $this->isType($T[$j][1]);
                    }
                    continue;
                }
                break;
            }
        } else {
            return null;
        }
        while ($j < $lim && ($T[$j][1] === 'const' || $T[$j][1] === 'volatile')) {
            $j++;
        }
        return $this->declarators($j, $lim, $ctx, $ts, $j - 1, $spec, null, $known, trim($cv), $i);
    }

    /**
     * Declaradores a partir de $j (tras el tipo $ts..$te).
     * @param array<string,bool> $spec
     * @return ?list<array<string,mixed>>
     */
    private function declarators(int $j, int $lim, string $ctx, int $ts, int $te, array $spec, ?string $typeOf, bool $known, string $cv = '', ?int $first = null): ?array
    {
        $T = $this->t;
        $M = $this->m;
        $out = [];
        $primero = true;
        $auto = $typeOf === null && $te >= $ts && ($T[$te][1] === 'auto');
        while ($j < $lim) {
            $k = $j;
            $ptr = '';
            while ($k < $lim && (in_array($T[$k][1], ['*', '&', '&&'], true) || ($ptr !== '' && $T[$k][1] === 'const'))) {
                $ptr .= $T[$k][1] === 'const' ? ' const' : $T[$k][1];
                $k++;
            }
            $bind = null;
            if ($primero && $auto && ($T[$k][1] ?? '') === '[' && isset($M[$k])) {
                $bind = [];
                for ($q = $k + 1; $q < $M[$k]; $q++) {
                    if ($T[$q][0] === 'w') {
                        $bind[] = [$T[$q][1], $q];
                    }
                }
                if ($bind === []) {
                    return null;
                }
                $nameTok = $bind[0][1];
                $q = $M[$k] + 1;
            } else {
                $n = $T[$k] ?? null;
                if ($n === null || $n[0] !== 'w' || isset(self::KW[$n[1]])) {
                    break;
                }
                $nameTok = $k;
                $q = $k + 1;
            }
            $dims = '';
            while (($T[$q][1] ?? '') === '[' && isset($M[$q]) && $bind === null) {
                $dims .= '[' . $this->text($q + 1, $M[$q] - 1) . ']';
                $q = $M[$q] + 1;
            }
            $nx = $T[$q][1] ?? '';
            if ($primero) {
                $ok = match ($ctx) {
                    'cond' => ['=', '{'],
                    'for' => ['=', ';', ',', ':', '(', '{'],
                    'member' => ['=', ';', ',', '(', '{', ':'],
                    default => ['=', ';', ',', '(', '{'],
                };
                if (!in_array($nx, $ok, true) || ($q >= $lim && $ctx !== 'for')) {
                    return null;
                }
                if (!$known && $typeOf === null) {
                    // Tipo desconocido: `Foo x;` vale, pero `a * b;` o `a & b;` no se dan por declaración
                    if ($ptr !== '' && $nx !== '=') {
                        return null;
                    }
                    if ($nx === '(' && $ctx === 'stmt' && !$this->looksArgsOfDecl($q)) {
                        return null;
                    }
                }
                if ($nx === '(' && $ctx === 'global' && isset($M[$q]) && $this->looksParams($q, $M[$q]) && $M[$q] > $q + 1) {
                    return null;                                 // eso es un prototipo
                }
            }
            $d = ['name' => $bind !== null ? $bind[0][0] : $T[$nameTok][1], 'tok' => $nameTok, 'ts' => $ts, 'te' => $te, 'cv' => $cv, 'spec' => $spec,
                'ptr' => $ptr, 'dims' => $dims, 'init' => null, 'ik' => null, 'bind' => $bind, 'ctx' => $ctx, 'typeOf' => $typeOf, 'first' => $first ?? $ts];
            $e = $q;
            if ($nx === '=') {
                $e = $this->exprEnd($q + 1, $lim);
                $d['init'] = [$q + 1, $e - 1];
                $d['ik'] = '=';
            } elseif (($nx === '(' || $nx === '{') && isset($M[$q])) {
                $d['init'] = [$q + 1, $M[$q] - 1];
                $d['ik'] = $nx;
                $e = $M[$q] + 1;
            } elseif ($nx === ':') {
                $e = $this->exprEnd($q + 1, $lim);
                $d['init'] = [$q + 1, $e - 1];
                $d['ik'] = $ctx === 'for' ? ':' : null;
            }
            $d['end'] = $e;
            $out[] = $d;
            $primero = false;
            if (($T[$e][1] ?? '') === ',' && $e < $lim) {
                $j = $e + 1;
                continue;
            }
            break;
        }
        return $out ?: null;
    }

    /** `Foo x(…)` dentro de una función con Foo desconocido: solo si los argumentos parecen expresiones simples. */
    private function looksArgsOfDecl(int $po): bool
    {
        return isset($this->m[$po]);
    }

    /** Fin (exclusivo) de una expresión de inicialización: la ',' o ';' de su nivel (o $lim). */
    public function exprEnd(int $a, int $lim): int
    {
        $T = $this->t;
        $M = $this->m;
        for ($k = $a; $k < $lim; $k++) {
            $y = $T[$k][1];
            if ($y === ',' || $y === ';' || $y === ')' || $y === '}' || $y === ']') {
                return $k;
            }
            if (($y === '(' || $y === '{' || $y === '[') && isset($M[$k])) {
                $k = $M[$k];
            } elseif ($y === '<' && $k > $a && $T[$k - 1][0] === 'w' && ($e = $this->angles($k, $lim)) > 0
                && in_array($T[$e][1] ?? '', ['(', '{', '::', '>'], true)) {
                $k = $e - 1;
            }
        }
        return $lim;
    }

    /**
     * Parámetros de la lista que abre $po: {type, name, tok, text, def, ta, te}. `tok` = -1 si no tiene nombre.
     * @return list<array<string,mixed>>
     */
    public function params(int $po): array
    {
        $T = $this->t;
        $M = $this->m;
        $pc = $M[$po] ?? $po;
        $out = [];
        $ini = $po + 1;
        for ($i = $po + 1; $i <= $pc; $i++) {
            $x = $T[$i][1];
            if ($i < $pc) {
                if (($x === '(' || $x === '{' || $x === '[') && isset($M[$i])) {
                    $i = $M[$i];
                    continue;
                }
                if ($x === '<' && $T[$i - 1][0] === 'w' && ($e = $this->angles($i, $pc)) > 0) {
                    $i = $e - 1;
                    continue;
                }
            }
            if ($i === $pc || $x === ',') {
                $b = $i - 1;
                if ($b >= $ini && !($b === $ini && in_array($T[$ini][1], ['void', '...'], true))) {
                    $def = null;
                    $e = $b;
                    for ($q = $ini; $q <= $b; $q++) {
                        if (($T[$q][1] === '(' || $T[$q][1] === '{' || $T[$q][1] === '[') && isset($M[$q])) {
                            $q = $M[$q];
                            continue;
                        }
                        if ($T[$q][1] === '=') {
                            $def = $this->text($q + 1, $b);
                            $e = $q - 1;
                            break;
                        }
                    }
                    $dims = '';
                    $f = $e;
                    while ($f > $ini && $T[$f][1] === ']' && isset($M[$f])) {
                        $dims = '[' . $this->text($M[$f] + 1, $f - 1) . ']' . $dims;
                        $f = $M[$f] - 1;
                    }
                    $tok = -1;
                    if ($f > $ini && $T[$f][0] === 'w' && !isset(self::KW[$T[$f][1]]) && !isset(self::BUILTIN[$T[$f][1]]) && $T[$f - 1][1] !== '::'
                        && !($T[$f - 1][1] === '<' || $T[$f - 1][1] === ',')) {
                        $tok = $f;
                    }
                    $type = $tok >= 0 ? $this->text($ini, $tok - 1) . $dims : $this->text($ini, $e);
                    $out[] = ['type' => $type, 'name' => $tok >= 0 ? $T[$tok][1] : '', 'tok' => $tok, 'text' => $this->text($ini, $b),
                        'def' => $def, 'ta' => $ini, 'te' => $tok >= 0 ? $tok - 1 : $e, 'dims' => $dims];
                }
                $ini = $i + 1;
            }
        }
        return $out;
    }

    // ───────────────────────────── lambdas ─────────────────────────────

    /**
     * ¿Empieza una lambda en el `[` de la ficha $i? {ci, cc (cierre de la captura), cap, po, pc (o -1), open, close, params, ret}
     * @return ?array<string,mixed>
     */
    public function lambdaAt(int $i): ?array
    {
        if (isset($this->lambdas[$i])) {
            return $this->lambdas[$i];
        }
        $T = $this->t;
        $M = $this->m;
        if (($T[$i][1] ?? '') !== '[' || !isset($M[$i]) || ($T[$i + 1][1] ?? '') === '[') {
            return null;
        }
        $p = $T[$i - 1] ?? ['p', ';'];
        if (($p[0] === 'w' && !in_array($p[1], ['return', 'co_return', 'throw', 'case', 'else', 'do'], true)) || $p[0] === 'n' || $p[0] === 's'
            || $p[1] === ')' || $p[1] === ']' || $p[1] === '[') {
            return null;
        }
        $c = $M[$i];
        $k = $c + 1;
        if (($T[$k][1] ?? '') === '<' && ($e = $this->angles($k, count($T))) > 0) {
            $k = $e;
        }
        $po = -1;
        $pc = -1;
        if (($T[$k][1] ?? '') === '(' && isset($M[$k])) {
            $po = $k;
            $pc = $M[$k];
            $k = $pc + 1;
        }
        $ret = null;
        while (isset($T[$k])) {
            $y = $T[$k][1];
            if (in_array($y, ['mutable', 'constexpr', 'static', 'consteval'], true)) {
                $k++;
            } elseif ($y === 'noexcept') {
                $k = (($T[$k + 1][1] ?? '') === '(' && isset($M[$k + 1])) ? $M[$k + 1] + 1 : $k + 1;
            } elseif ($y === '[' && ($T[$k + 1][1] ?? '') === '[' && isset($M[$k])) {
                $k = $M[$k] + 1;
            } elseif ($y === '->') {
                $a = $k + 1;
                while (isset($T[$k]) && $T[$k][1] !== '{' && $T[$k][1] !== ';') {
                    $k = ($T[$k][1] === '<' && ($e = $this->angles($k, count($T))) > 0) ? $e : $k + 1;
                }
                $ret = $this->text($a, $k - 1);
            } else {
                break;
            }
        }
        if (($T[$k][1] ?? '') !== '{' || !isset($M[$k])) {
            return null;
        }
        $l = ['ci' => $i, 'cc' => $c, 'cap' => $this->text($i, $c), 'po' => $po, 'pc' => $pc, 'open' => $k, 'close' => $M[$k],
            'params' => $po >= 0 ? $this->params($po) : [], 'ret' => $ret];
        $this->lambdas[$i] = $l;
        return $l;
    }

    // ───────────────────────────── sentencias ─────────────────────────────

    /** Índice de la última ficha de la sentencia que empieza en $i (con if/else, try/catch, do/while...). */
    public function stmtEnd(int $i): int
    {
        $T = $this->t;
        $M = $this->m;
        $n = count($T);
        if ($i >= $n) {
            return $n - 1;
        }
        $x = $T[$i][1];
        if ($T[$i][0] === 'p') {
            if ($x === '{') {
                return $M[$i] ?? $n - 1;
            }
            if ($x === ';') {
                return $i;
            }
        }
        switch ($T[$i][0] === 'w' ? $x : '') {
            case 'if':
                $p = $i + 1;
                if (in_array($T[$p][1] ?? '', ['constexpr', '!', 'consteval'], true)) {
                    $p++;
                }
                if (!isset($M[$p])) {
                    return $n - 1;
                }
                $e = $this->stmtEnd($M[$p] + 1);
                return ($T[$e + 1][1] ?? '') === 'else' ? $this->stmtEnd($e + 2) : $e;
            case 'for':
            case 'while':
            case 'switch':
                return isset($M[$i + 1]) ? $this->stmtEnd($M[$i + 1] + 1) : $n - 1;
            case 'do':
                $e = $this->stmtEnd($i + 1);
                if (($T[$e + 1][1] ?? '') === 'while' && isset($M[$e + 2])) {
                    return min($n - 1, $M[$e + 2] + 1);
                }
                return $e;
            case 'try':
                $e = $M[$i + 1] ?? $n - 1;
                while (($T[$e + 1][1] ?? '') === 'catch') {
                    $po = $e + 2;
                    $e = isset($M[$po], $M[$M[$po] + 1]) ? $M[$M[$po] + 1] : $n - 1;
                }
                return $e;
        }
        for ($j = $i; $j < $n; $j++) {
            $y = $T[$j][1];
            if ($T[$j][0] === 'p') {
                if ($y === ';') {
                    return $j;
                }
                if (($y === '(' || $y === '[' || $y === '{') && isset($M[$j])) {
                    $j = $M[$j];
                }
            }
        }
        return $n - 1;
    }

    // ───────────────────────────── variables de una función ─────────────────────────────

    /**
     * Lo declarado dentro de una unidad: tipos visibles (globales, campos de su clase, parámetros y locales, en orden),
     * declaraciones locales (con su ámbito) y lambdas.
     * @return array{types:array<string,array<string,mixed>>, decls:list<array<string,mixed>>, lambdas:list<array<string,mixed>>, declToks:array<int,bool>, aliases:list<array<string,mixed>>}
     */
    public function locals(int $u): array
    {
        if (isset($this->loc[$u])) {
            return $this->loc[$u];
        }
        $unit = $this->units[$u];
        $T = $this->t;
        $M = $this->m;
        $types = $this->globals;
        if ($unit['ci'] !== null) {
            for ($c = $unit['ci']; $c !== null; $c = $this->classes[$c]['parent']) {
                $types = $this->classes[$c]['fields'] + $types;
            }
        }
        foreach ($unit['params'] as $p) {
            if ($p['name'] !== '') {
                $types[$p['name']] = $this->info($p['type']);
            }
        }
        $open = $unit['open'];
        $close = $unit['close'];
        $decls = [];
        $lams = [];
        $declToks = [];
        $aliases = [];
        $blocks = [$close];
        $nb = 1;
        for ($i = $open + 1; $i < $close; $i++) {
            while ($nb > 1 && $blocks[$nb - 1] < $i) {
                array_pop($blocks);
                $nb--;
            }
            [$ty, $x] = $T[$i];
            if ($ty === 'p') {
                if ($x === '{' && isset($M[$i])) {
                    $blocks[] = $M[$i];
                    $nb++;
                } elseif ($x === '[' && ($l = $this->lambdaAt($i)) !== null) {
                    $lams[] = $l;
                    foreach ($l['params'] as $p) {
                        if ($p['name'] !== '') {
                            $types[$p['name']] = $this->info($p['type']);
                            $decls[] = ['name' => $p['name'], 'tok' => $p['tok'], 'param' => true, 'lambda' => $i, 'type' => $p['type'], 'se' => $l['close'],
                                'ctx' => 'param', 'p' => $p];
                            $declToks[$p['tok']] = true;
                        }
                    }
                }
                continue;
            }
            if ($ty !== 'w') {
                continue;
            }
            $p = $T[$i - 1][1];
            if (!isset(self::ANTES_DECL[$p])) {
                continue;
            }
            $ctx = null;
            $se = $blocks[$nb - 1];
            if ($p === ';' || $p === '{' || $p === '}' || $p === 'else' || $p === 'do') {
                $ctx = 'stmt';
            } elseif ($p === '(') {
                $kw = $T[$i - 2][1] ?? '';
                if ($kw === 'for') {
                    $ctx = 'for';
                    $se = $this->stmtEnd($i - 2);
                } elseif ($kw === 'if' || $kw === 'while' || $kw === 'switch' || ($kw === 'constexpr' && ($T[$i - 3][1] ?? '') === 'if')) {
                    $ctx = 'cond';
                    $se = $this->stmtEnd($kw === 'constexpr' ? $i - 3 : $i - 2);
                } elseif ($kw === 'catch' && isset($M[$i - 1])) {
                    foreach ($this->params($i - 1) as $q) {
                        if ($q['name'] !== '') {
                            $types[$q['name']] = $this->info($q['type']);
                            $declToks[$q['tok']] = true;
                            $decls[] = ['name' => $q['name'], 'tok' => $q['tok'], 'param' => true, 'catch' => true, 'type' => $q['type'],
                                'se' => $M[$M[$i - 1] + 1] ?? $close, 'ctx' => 'param', 'p' => $q];
                        }
                    }
                    continue;
                }
            }
            if ($ctx === null) {
                continue;
            }
            if ($x === 'using' && ($T[$i + 1][0] ?? '') === 'w' && ($T[$i + 2][1] ?? '') === '=') {
                $e = $this->until($i, $close, ';');
                $aliases[] = ['name' => $T[$i + 1][1], 'tok' => $i + 1, 'target' => $this->text($i + 3, $e - 1), 'se' => $se];
                $this->typeNames[$T[$i + 1][1]] ??= 'alias';
                $this->aliases[$T[$i + 1][1]] ??= ['target' => $this->text($i + 3, $e - 1), 'tok' => $i + 1, 'how' => 'using', 'ci' => null];
                continue;
            }
            if (isset(self::KW[$x]) && !isset(self::BUILTIN[$x]) && !isset(self::SPECS[$x]) && $x !== 'decltype' && $x !== 'struct' && $x !== 'enum') {
                continue;
            }
            $n1 = $T[$i + 1] ?? null;
            if ($n1 === null || !($n1[0] === 'w' || in_array($n1[1], ['<', '::', '*', '&', '&&', '[', '('], true)) || ($n1[1] === '(' && $x !== 'decltype')) {
                continue;
            }
            $ds = $this->declAt($i, $ctx === 'stmt' ? $close : ($M[$i - 1] ?? $close), $ctx);
            if ($ds === null) {
                continue;
            }
            foreach ($ds as $d) {
                $d['se'] = $se;
                if ($d['bind'] !== null) {
                    $comps = $this->bindingTypes($d, $types);
                    foreach ($d['bind'] as $bi => [$bn, $bt]) {
                        $e = $d;
                        $e['name'] = $bn;
                        $e['tok'] = $bt;
                        $e['bi'] = $bi;
                        $e['comp'] = $comps[$bi] ?? null;
                        $types[$bn] = $this->info($comps[$bi][0] ?? 'auto');
                        $decls[] = $e;
                        $declToks[$bt] = true;
                    }
                    continue;
                }
                $types[$d['name']] = $this->varInfo($d, $types);
                $d['info'] = $types[$d['name']];
                $decls[] = $d;
                $declToks[$d['tok']] = true;
            }
        }
        return $this->loc[$u] = ['types' => $types, 'decls' => $decls, 'lambdas' => $lams, 'declToks' => $declToks, 'aliases' => $aliases];
    }

    // ───────────────────────────── tipos ─────────────────────────────

    /** Texto del tipo declarado de un declarador (`const vector<int>&`, `int[100]`, `auto`). */
    public function declType(array $d): string
    {
        $base = $d['typeOf'] ?? $this->text($d['ts'], $d['te']);
        $cv = $d['cv'] ?? '';
        return trim(($cv !== '' && !str_starts_with($base, $cv) ? $cv . ' ' : '') . $base) . ($d['ptr'] ?? '') . ($d['dims'] ?? '');
    }

    /** Información de tipo de un declarador (con `auto` deducido cuando se puede). @param array<string,array<string,mixed>> $types */
    public function varInfo(array $d, array $types): array
    {
        $txt = $this->declType($d);
        $info = $this->info($txt);
        if ($info['base'] === 'auto' && $d['init'] !== null && $d['ik'] !== ':') {
            [$inf] = $this->infer($d['init'][0], $d['init'][1], $types);
            if ($inf !== null) {
                $i2 = $this->info($inf);
                $i2['ref'] = $info['ref'];
                $i2['const'] = $info['const'] || $i2['const'];
                $i2['deduced'] = $inf;
                return $i2;
            }
        } elseif ($info['base'] === 'auto' && $d['ik'] === ':' && $d['init'] !== null) {
            $el = $this->elementOf($d['init'][0], $d['init'][1], $types);
            if ($el !== null) {
                $i2 = $this->info($el);
                $i2['ref'] = $info['ref'];
                $i2['deduced'] = $el;
                return $i2;
            }
        }
        return $info;
    }

    /**
     * Desmonta un tipo: {text, base (sin std:: ni calificadores: 'vector', 'long long', 'Arista'), fam, args (de la plantilla),
     * const, ref ('', '&', '&&'), ptr (número de *), arr (número de [N]), dims, user (tipo de usuario)}. Resuelve alias.
     * @return array<string,mixed>
     */
    public function info(string $type, int $depth = 0): array
    {
        $r = self::parseType($type);
        if ($depth < 3 && isset($this->aliases[$r['base']]) && $r['args'] === []) {
            $t = $this->info($this->aliases[$r['base']]['target'], $depth + 1);
            $t['text'] = $type;
            $t['alias'] = $r['base'];
            $t['const'] = $t['const'] || $r['const'];
            $t['ref'] = $r['ref'] !== '' ? $r['ref'] : $t['ref'];
            $t['ptr'] += $r['ptr'];
            $t['arr'] += $r['arr'];
            $t['dims'] = $r['dims'] . $t['dims'];
            return $t;
        }
        $r['user'] = isset($this->typeNames[$r['base']]) && $this->typeNames[$r['base']] !== 'alias' && $this->typeNames[$r['base']] !== 'macro';
        return $r;
    }

    /** @return array<string,mixed> */
    public static function parseType(string $type): array
    {
        if (isset(self::$typeMemo[$type])) {
            return self::$typeMemo[$type];
        }
        preg_match_all('/[A-Za-z_]\w*|::|\.\.\.|&&|\d+|\S/', $type, $mm);
        $tk = $mm[0];
        $prof = 0;
        $const = false;
        $ref = '';
        $ptr = 0;
        $words = [];
        $args = [];
        $argIni = -1;
        $owner = null;
        $arr = 0;
        $dims = '';
        $n = count($tk);
        for ($k = 0; $k < $n; $k++) {
            $x = $tk[$k];
            if ($x === '<') {
                if ($prof === 0 && $args === [] && $argIni < 0) {
                    $argIni = $k + 1;
                }
                $prof++;
                continue;
            }
            if ($x === '>') {
                $prof--;
                if ($prof === 0 && $argIni >= 0 && $args === []) {
                    $args = self::splitArgs(array_slice($tk, $argIni, $k - $argIni));
                }
                continue;
            }
            if ($prof > 0) {
                continue;
            }
            if ($x === '(' ) {                                     // tipo función: R(Args)
                $words[] = '(';
                break;
            }
            if ($x === '[') {
                $arr++;
                $q = $k + 1;
                $d = '';
                while ($q < $n && $tk[$q] !== ']') {
                    $d .= $tk[$q++];
                }
                $dims .= '[' . $d . ']';
                $k = $q;
                continue;
            }
            match (true) {
                $x === 'const' => $const = $const || $ptr === 0,
                $x === '&' || $x === '&&' => $ref = $x,
                $x === '*' => $ptr++,
                $x === '::' => $owner = end($words) ?: null,
                in_array($x, ['volatile', 'static', 'constexpr', 'inline', 'mutable', 'typename', 'struct', 'class', 'enum', 'std', 'register', 'thread_local', 'extern', 'union'], true) => null,
                default => $words[] = $x,
            };
        }
        // básicos: unsigned long long int → 'unsigned long long'
        $bw = array_values(array_filter($words, static fn($w) => isset(self::BUILTIN[$w])));
        if ($bw !== [] && count($bw) === count($words)) {
            $s = implode(' ', $bw);
            if (preg_match('/\b(short|long)\b/', $s)) {
                $s = trim((string) preg_replace('/\bint\b/', '', $s));
            }
            $s = (string) preg_replace('/\s+/', ' ', $s);
            $base = match ($s) {
                'signed' => 'int', 'unsigned' => 'unsigned int', 'signed long long', 'long long signed' => 'long long', 'signed long' => 'long',
                'signed char' => 'signed char', 'long unsigned', 'unsigned long' => 'unsigned long', 'long long unsigned' => 'unsigned long long',
                default => $s,
            };
        } else {
            $base = $words !== [] ? end($words) : '';
            if ($base === '(') {
                $base = 'función';
            }
        }
        $r = ['text' => $type, 'base' => $base, 'fam' => self::FAM[$base] ?? null, 'args' => $args, 'const' => $const, 'ref' => $ref, 'ptr' => $ptr,
            'arr' => $arr, 'dims' => $dims, 'owner' => $owner, 'user' => false];
        if (count(self::$typeMemo) > 2000) {
            self::$typeMemo = [];
        }
        return self::$typeMemo[$type] = $r;
    }

    /** @param list<string> $tk @return list<string> */
    private static function splitArgs(array $tk): array
    {
        $out = [];
        $cur = '';
        $prof = 0;
        foreach ($tk as $x) {
            if ($x === '<' || $x === '(') {
                $prof++;
            } elseif ($x === '>' || $x === ')') {
                $prof--;
            }
            if ($x === ',' && $prof === 0) {
                $out[] = $cur;
                $cur = '';
                continue;
            }
            $cur .= (preg_match('/^\w/', $x) && preg_match('/\w$/', $cur) ? ' ' : '') . $x;
        }
        if (trim($cur) !== '') {
            $out[] = $cur;
        }
        return array_map(static fn($s) => (string) preg_replace('/,(?! )/', ', ', $s), $out);
    }

    /** Tipo del elemento de un contenedor o array (lo que da `x[i]`, `x.top()`, el `for (auto e : x)`). */
    public function elemType(array $info): ?string
    {
        if ($info['arr'] > 0) {
            return trim((string) preg_replace('/\[[^\]]*\]/', '', $info['text'], 1));
        }
        $a = $info['args'];
        return match ($info['fam']) {
            'VEC', 'DEQ', 'LIST', 'ARR', 'TREE', 'HASH', 'PQ', 'QUEUE', 'STACK', 'OPT', 'UPTR', 'SPTR' => in_array($info['base'], ['map', 'multimap', 'unordered_map', 'unordered_multimap'], true)
                ? (isset($a[1]) ? 'pair<const ' . $a[0] . ', ' . $a[1] . '>' : null) : ($a[0] ?? null),
            'STR' => 'char',
            default => null,
        };
    }

    /** Tipo del elemento al recorrer la expresión $a..$b (rango de un for). @param array<string,array<string,mixed>> $types */
    public function elementOf(int $a, int $b, array $types): ?string
    {
        [$t] = $this->infer($a, $b, $types);
        if ($t === null) {
            return null;
        }
        return $this->elemType($this->info($t));
    }

    /** Valor de `x[i]` en mapas: el segundo argumento; en el resto, el elemento. */
    private function subscriptType(array $info): ?string
    {
        if (in_array($info['base'], ['map', 'unordered_map'], true)) {
            return $info['args'][1] ?? null;
        }
        return $this->elemType($info);
    }

    /**
     * Deduce el tipo de la expresión $a..$b: [tipo|null, motivo]. Lo justo para `auto`: literales, constructores,
     * make_pair, .size(), .top(), x[i], copias, casts, accumulate…
     * @param array<string,array<string,mixed>> $types
     * @return array{0:?string,1:string}
     */
    public function infer(int $a, int $b, array $types): array
    {
        $T = $this->t;
        $M = $this->m;
        if ($b < $a) {
            return [null, ''];
        }
        $x = $T[$a];
        $src = $this->text($a, $b);
        if ($a === $b) {
            if ($x[0] === 'n') {
                return [self::numType($x[1]), 'por el literal `' . $x[1] . '`'];
            }
            if ($x[0] === 's') {
                if ($x[1][0] === "'" || preg_match('/^(u8|[uUL])\'/', $x[1])) {
                    return ['char', 'por el carácter `' . $x[1] . '`'];
                }
                return ['const char*', 'porque un literal `"…"` es un array de char de C, no un `string` (para eso: `"…"s` o `string("…")`)'];
            }
            if ($x[1] === 'true' || $x[1] === 'false') {
                return ['bool', 'por el literal `' . $x[1] . '`'];
            }
            if ($x[1] === 'nullptr') {
                return ['nullptr_t', 'por `nullptr`'];
            }
            if (isset($types[$x[1]])) {
                $t = $types[$x[1]];
                $txt = $t['deduced'] ?? $t['text'];
                $txt = trim((string) preg_replace(['/^(const|static|constexpr)\s+/', '/\s*&+$/'], '', $txt));
                return [$txt, 'copia de `' . $x[1] . '`'];
            }
            return [null, ''];
        }
        if ($b === $a + 1 && $x[0] === 's' && $T[$b][1] === 's') {
            return ['string', 'por el literal `"…"s`'];
        }
        if ($x[0] === 'p' && $x[1] === '-' && $b === $a + 1 && $T[$b][0] === 'n') {
            return [self::numType($T[$b][1]), 'por el literal `' . $src . '`'];
        }
        if ($x[1] === '[' && ($l = $this->lambdaAt($a)) !== null) {
            return ['lambda', 'es una lambda'];
        }
        if ($x[1] === '{') {
            return [null, ''];
        }
        if ($x[1] === 'new') {
            $k = $a + 1;
            $t = '';
            while ($k <= $b && ($T[$k][0] === 'w' || $T[$k][1] === '::')) {
                $t .= $T[$k][1];
                $k++;
            }
            if (($T[$k][1] ?? '') === '<' && ($e = $this->angles($k, $b + 1)) > 0) {
                $t = $this->text($a + 1, $e - 1);
            }
            return [$t !== '' ? $t . '*' : null, 'porque `new` devuelve un puntero'];
        }
        // casts
        if (in_array($x[1], ['static_cast', 'reinterpret_cast', 'const_cast', 'dynamic_cast'], true) && ($T[$a + 1][1] ?? '') === '<' && ($e = $this->angles($a + 1, $b + 1)) > 0) {
            return [$this->text($a + 2, $e - 2), 'por el `' . $x[1] . '`'];
        }
        if ($x[1] === '(' && isset($M[$a]) && $M[$a] < $b && $T[$a + 1][0] === 'w' && $this->isType($T[$a + 1][1])) {
            return [$this->text($a + 1, $M[$a] - 1), 'por la conversión `(' . $this->text($a + 1, $M[$a] - 1) . ')`'];
        }
        // Tipo(…) / Tipo{…} / Tipo<…>(…)
        if ($x[0] === 'w' && ($this->isType($x[1]) || ($x[1] === 'std' && ($T[$a + 1][1] ?? '') === '::'))) {
            $k = $a;
            while ($k < $b && ($T[$k + 1][1] === '::' || $T[$k][1] === '::')) {
                $k++;
            }
            if (($T[$k + 1][1] ?? '') === '<' && ($e = $this->angles($k + 1, $b + 1)) > 0) {
                $k = $e - 1;
            }
            if (in_array($T[$k + 1][1] ?? '', ['(', '{'], true) && ($M[$k + 1] ?? -1) === $b) {
                $t = $this->text($a, $k);
                return [$t, 'por `' . $t . ($T[$k + 1][1] === '(' ? '(…)' : '{…}') . '`'];
            }
        }
        // llamadas conocidas
        if ($x[0] === 'w' && ($T[$a + 1][1] ?? '') === '(' && ($M[$a + 1] ?? -1) === $b) {
            $args = $this->args($a + 1);
            switch ($x[1]) {
                case 'make_pair':
                    $ts = array_map(fn($r) => $this->infer($r[0], $r[1], $types)[0] ?? '?', $args);
                    return ['pair<' . implode(', ', $ts) . '>', 'por `make_pair(…)`'];
                case 'make_tuple':
                    $ts = array_map(fn($r) => $this->infer($r[0], $r[1], $types)[0] ?? '?', $args);
                    return ['tuple<' . implode(', ', $ts) . '>', 'por `make_tuple(…)`'];
                case 'accumulate':
                case 'reduce':
                    // el valor inicial es el último argumento (o el penúltimo si hay operación); con macros como all(v) hay menos
                    $ini = count($args) >= 4 || (count($args) === 3 && ($T[$args[2][0]][1] ?? '') === '[') ? $args[count($args) - 2] : ($args[count($args) - 1] ?? null);
                    if ($ini !== null && count($args) >= 2) {
                        [$t0] = $this->infer($ini[0], $ini[1], $types);
                        if ($t0 !== null) {
                            return [$t0, 'porque `' . $x[1] . '` devuelve el tipo de su valor inicial (`' . $this->text($ini[0], $ini[1]) . '`)'
                                . ($t0 === 'int' ? '; ojo: con `0` la suma se hace en `int` y puede desbordarse, usa `0LL`' : '')];
                        }
                    }
                    break;
                case 'max':
                case 'min':
                case 'abs':
                    if (isset($args[0])) {
                        [$t0] = $this->infer($args[0][0], $args[0][1], $types);
                        if ($t0 !== null) {
                            return [$t0, 'el tipo de sus argumentos'];
                        }
                    }
                    break;
            }
            $fijos = ['stoi' => 'int', 'stol' => 'long', 'stoll' => 'long long', 'stod' => 'double', 'stof' => 'float', 'to_string' => 'string',
                'sqrt' => 'double', 'pow' => 'double', 'log' => 'double', 'log2' => 'double', 'exp' => 'double', 'floor' => 'double', 'ceil' => 'double',
                'hypot' => 'double', '__builtin_popcount' => 'int', '__builtin_popcountll' => 'int', '__lg' => 'int', '__builtin_clz' => 'int',
                '__builtin_ctz' => 'int', 'gcd' => 'int', 'lcm' => 'int', '__gcd' => 'int', 'strlen' => 'size_t', 'distance' => 'ptrdiff_t',
                'count' => 'ptrdiff_t', 'count_if' => 'ptrdiff_t', 'getline' => 'istream&', 'rand' => 'int', 'time' => 'time_t',
                'lower_bound' => 'iterator', 'upper_bound' => 'iterator', 'find' => 'iterator', 'max_element' => 'iterator', 'min_element' => 'iterator',
                'begin' => 'iterator', 'end' => 'iterator', 'binary_search' => 'bool', 'all_of' => 'bool', 'any_of' => 'bool', 'none_of' => 'bool',
                'is_sorted' => 'bool', 'next_permutation' => 'bool'];
            if (isset($fijos[$x[1]])) {
                return [$fijos[$x[1]], 'porque `' . $x[1] . '()` devuelve `' . $fijos[$x[1]] . '`'];
            }
            if (in_array($x[1], ['make_unique', 'make_shared'], true)) {
                return [null, ''];
            }
        }
        if (in_array($x[1], ['make_unique', 'make_shared'], true) && ($T[$a + 1][1] ?? '') === '<' && ($e = $this->angles($a + 1, $b + 1)) > 0) {
            return [($x[1] === 'make_unique' ? 'unique_ptr<' : 'shared_ptr<') . $this->text($a + 2, $e - 2) . '>', 'por `' . $x[1] . '<…>(…)`'];
        }
        // x.metodo(…), x[i], x.first, p->campo
        if ($x[0] === 'w' && isset($types[$x[1]])) {
            $info = $types[$x[1]];
            $k = $a + 1;
            $desc = $x[1];
            while ($k <= $b && ($T[$k][1] === '[') && isset($M[$k]) && $M[$k] <= $b) {
                $el = $this->subscriptType($info);
                if ($el === null) {
                    return [null, ''];
                }
                $info = $this->info($el);
                $desc .= '[…]';
                $k = $M[$k] + 1;
            }
            if ($k > $b) {
                return [$info['text'], 'el elemento de `' . $x[1] . '`'];
            }
            if (($T[$k][1] === '.' || $T[$k][1] === '->') && ($T[$k + 1][0] ?? '') === 'w') {
                $mth = $T[$k + 1][1];
                $isCall = ($T[$k + 2][1] ?? '') === '(' && ($M[$k + 2] ?? -1) === $b;
                $isField = $k + 1 === $b;
                if ($isCall) {
                    $r = match ($mth) {
                        'size', 'length', 'count' => 'size_t',
                        'empty' => 'bool',
                        'top', 'front', 'back' => $this->elemType($info),
                        'substr' => 'string',
                        'begin', 'end', 'rbegin', 'rend', 'find', 'lower_bound', 'upper_bound', 'insert', 'erase' => $info['text'] . '::iterator',
                        'c_str' => 'const char*',
                        'get' => $info['args'][0] ?? null,
                        'at' => $this->subscriptType($info),
                        default => $this->methodReturn($info['base'], $mth),
                    };
                    if ($r !== null) {
                        $r = trim((string) preg_replace('/^const\s+/', '', $r));
                        return [$r, 'porque `' . $desc . '.' . $mth . '()` devuelve `' . $r . '`'];
                    }
                } elseif ($isField) {
                    if ($info['fam'] === 'PAIR' || preg_match('/^pair</', $info['text'])) {
                        $r = $mth === 'first' ? ($info['args'][0] ?? null) : ($mth === 'second' ? ($info['args'][1] ?? null) : null);
                        if ($r !== null) {
                            return [trim((string) preg_replace('/^const\s+/', '', $r)), 'el `.' . $mth . '` del par'];
                        }
                    }
                    $ci = $this->classIndex($info['base']);
                    if ($ci !== null && isset($this->classes[$ci]['fields'][$mth])) {
                        return [$this->classes[$ci]['fields'][$mth]['text'], 'el campo `' . $mth . '` de `' . $info['base'] . '`'];
                    }
                }
            }
        }
        // aritmética simple: el tipo "más ancho" de los operandos
        $ancho = null;
        $rank = ['char' => 1, 'bool' => 1, 'short' => 1, 'int' => 2, 'unsigned int' => 3, 'long' => 4, 'unsigned long' => 4, 'size_t' => 4,
            'long long' => 5, 'unsigned long long' => 6, 'float' => 7, 'double' => 8, 'long double' => 9];
        for ($k = $a; $k <= $b; $k++) {
            $y = $T[$k];
            if ($y[0] === 'p' && !in_array($y[1], ['+', '-', '*', '/', '%', '(', ')'], true)) {
                return [null, ''];
            }
            $t = null;
            if ($y[0] === 'n') {
                $t = self::numType($y[1]);
            } elseif ($y[0] === 'w') {
                if (($T[$k + 1][1] ?? '') === '(' || ($T[$k + 1][1] ?? '') === '[' || ($T[$k + 1][1] ?? '') === '.') {
                    return [null, ''];
                }
                $i = $types[$y[1]] ?? null;
                if ($i === null || !isset($rank[$i['deduced'] ?? $i['base']])) {
                    return [null, ''];
                }
                $t = $i['deduced'] ?? $i['base'];
            } elseif ($y[0] === 's') {
                return [null, ''];
            }
            if ($t !== null && isset($rank[$t]) && ($ancho === null || $rank[$t] > $rank[$ancho])) {
                $ancho = $t;
            }
        }
        if ($ancho !== null) {
            return [$ancho, 'el tipo más ancho de la operación `' . (strlen($src) > 40 ? substr($src, 0, 37) . '…' : $src) . '`'];
        }
        return [null, ''];
    }

    /** Método de un tipo de usuario: su tipo de retorno. */
    private function methodReturn(string $cls, string $m): ?string
    {
        foreach ($this->units as $u) {
            if ($u['cls'] === $cls && $u['name'] === $m && $u['ret'] !== '' && $u['ret'] !== 'auto') {
                return $u['ret'];
            }
        }
        foreach ($this->protos as $p) {
            if ($p['cls'] === $cls && $p['name'] === $m && $p['ret'] !== '') {
                return $p['ret'];
            }
        }
        return null;
    }

    /** Rangos [a, b] de cada argumento de la llamada cuyo '(' es $po. @return list<array{0:int,1:int}> */
    public function args(int $po): array
    {
        $pc = $this->m[$po] ?? $po;
        if ($pc === $po + 1) {
            return [];
        }
        $out = [];
        $ini = $po + 1;
        for ($k = $po + 1; $k <= $pc; $k++) {
            $y = $this->t[$k][1];
            if ($k < $pc && ($y === '(' || $y === '{' || $y === '[') && isset($this->m[$k])) {
                $k = $this->m[$k];
                continue;
            }
            if ($k === $pc || $y === ',') {
                $out[] = [$ini, $k - 1];
                $ini = $k + 1;
            }
        }
        return $out;
    }

    /** Tipo de un literal numérico: 5 → int, 5LL → long long, 5.0 → double, 2.5f → float, 1e9 → double. */
    public static function numType(string $n): string
    {
        $n = str_replace("'", '', $n);
        $hex = (bool) preg_match('/^0[xX]/', $n);
        if (!$hex && (str_contains($n, '.') || preg_match('/[eE]/', $n))) {
            return preg_match('/[fF]$/', $n) ? 'float' : (preg_match('/[lL]$/', $n) ? 'long double' : 'double');
        }
        preg_match('/([uUlLzZ]*)$/', $n, $s);
        $suf = strtolower($s[1] ?? '');
        $u = str_contains($suf, 'u');
        $l = substr_count($suf, 'l');
        return match (true) {
            $l >= 2 => $u ? 'unsigned long long' : 'long long',
            $l === 1 => $u ? 'unsigned long' : 'long',
            str_contains($suf, 'z') => 'size_t',
            $u => 'unsigned int',
            default => 'int',
        };
    }

    /**
     * Tipos de los nombres de un `auto [a, b] = …` o `for (auto& [k, v] : m)`: [tipo, papel] por posición.
     * @param array<string,array<string,mixed>> $types
     * @return list<array{0:string,1:string}>
     */
    public function bindingTypes(array $d, array $types): array
    {
        if ($d['init'] === null) {
            return [];
        }
        [$a, $b] = $d['init'];
        if ($d['ik'] === ':') {
            [$t] = $this->infer($a, $b, $types);
            if ($t === null) {
                return [];
            }
            $info = $this->info($t);
            if (in_array($info['base'], ['map', 'multimap', 'unordered_map', 'unordered_multimap'], true) && isset($info['args'][1])) {
                return [['const ' . $info['args'][0], 'clave'], [$info['args'][1], 'valor']];
            }
            $el = $this->elemType($info);
        } else {
            [$el] = $this->infer($a, $b, $types);
        }
        return $el === null ? [] : $this->components($el);
    }

    /** Componentes de pair/tuple/array/struct. @return list<array{0:string,1:string}> */
    public function components(string $type): array
    {
        $info = $this->info($type);
        if ($info['fam'] === 'PAIR' && count($info['args']) === 2) {
            $k = str_starts_with($info['args'][0], 'const ');
            return [[$info['args'][0], $k ? 'clave' : 'first'], [$info['args'][1], $k ? 'valor' : 'second']];
        }
        if ($info['fam'] === 'TUPLE') {
            return array_map(static fn($t, $i) => [$t, 'get<' . $i . '>'], $info['args'], array_keys($info['args']));
        }
        if ($info['fam'] === 'ARR' && isset($info['args'][1]) && ctype_digit($info['args'][1])) {
            return array_fill(0, min(16, (int) $info['args'][1]), [$info['args'][0], 'elemento']);
        }
        $ci = $this->classIndex($info['base']);
        if ($ci !== null) {
            return array_map(fn($f) => [$this->classes[$ci]['fields'][$f]['text'], 'campo ' . $f], $this->classes[$ci]['order']);
        }
        return [];
    }

    /** Unidad que contiene la ficha $i (la más interna), o null. */
    public function unitAt(int $i): ?int
    {
        $best = null;
        foreach ($this->units as $k => $u) {
            if ($i > $u['open'] && $i < $u['close'] && ($best === null || $u['open'] > $this->units[$best]['open'])) {
                $best = $k;
            }
        }
        return $best;
    }
}
