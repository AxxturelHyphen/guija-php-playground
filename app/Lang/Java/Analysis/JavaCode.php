<?php
declare(strict_types=1);

namespace Playground\Lang\Java\Analysis;

use Playground\Lang\Java\JavaLexer;

defined('PG_ROOT') or exit;

/**
 * Código Java ya "troceado": fichas con su línea, emparejamiento de paréntesis/llaves, clases, campos y métodos
 * (unidades). Todo en PHP y sin JVM: es lo que permite analizar mientras se escribe (unos pocos ms).
 *
 * Fichas: [tipo ('w' palabra, 's' cadena, 'n' número, 'p' símbolo), texto, offset en bytes, línea 1-based].
 * Los operadores de dos caracteres (`&&`, `==`, `->`, `+=`...) se funden en una sola ficha; `>>` NO (por los genéricos).
 */
final class JavaCode
{
    /** Palabras reservadas: nunca son nombres de variable o de tipo. */
    public const KW = [
        'abstract' => 1, 'assert' => 1, 'boolean' => 1, 'break' => 1, 'byte' => 1, 'case' => 1, 'catch' => 1, 'char' => 1, 'class' => 1,
        'continue' => 1, 'default' => 1, 'do' => 1, 'double' => 1, 'else' => 1, 'enum' => 1, 'extends' => 1, 'final' => 1, 'finally' => 1,
        'float' => 1, 'for' => 1, 'if' => 1, 'implements' => 1, 'import' => 1, 'instanceof' => 1, 'int' => 1, 'interface' => 1, 'long' => 1,
        'native' => 1, 'new' => 1, 'package' => 1, 'private' => 1, 'protected' => 1, 'public' => 1, 'return' => 1, 'short' => 1, 'static' => 1,
        'super' => 1, 'switch' => 1, 'synchronized' => 1, 'this' => 1, 'throw' => 1, 'throws' => 1, 'transient' => 1, 'try' => 1, 'void' => 1,
        'volatile' => 1, 'while' => 1, 'null' => 1, 'true' => 1, 'false' => 1,
    ];
    public const PRIM = ['int' => 1, 'long' => 1, 'double' => 1, 'float' => 1, 'boolean' => 1, 'char' => 1, 'byte' => 1, 'short' => 1];
    private const MODS = ['public' => 1, 'protected' => 1, 'private' => 1, 'static' => 1, 'final' => 1, 'abstract' => 1, 'native' => 1,
        'synchronized' => 1, 'transient' => 1, 'volatile' => 1, 'strictfp' => 1, 'default' => 1, 'sealed' => 1];
    private const DOBLES = ['&&' => 1, '||' => 1, '==' => 1, '!=' => 1, '<=' => 1, '>=' => 1, '->' => 1, '::' => 1, '++' => 1, '--' => 1,
        '+=' => 1, '-=' => 1, '*=' => 1, '/=' => 1, '%=' => 1, '&=' => 1, '|=' => 1, '^=' => 1];

    /** @var list<array{0:string,1:string,2:int,3:int}> */
    public array $t = [];
    /** @var array<int,int> */
    public array $m = [];
    /** @var list<array<string,mixed>> */
    public array $classes = [];
    /** @var list<array<string,mixed>> métodos y constructores con cuerpo */
    public array $units = [];
    /** @var list<int> offset de comienzo de cada línea (índice 0 = línea 1) */
    private array $ls = [0];
    private bool $ascii;

    public function __construct(public readonly string $code)
    {
        $this->ascii = !preg_match('/[^\x00-\x7f]/', $code);
        preg_match_all('/\n/', $code, $nl, PREG_OFFSET_CAPTURE);
        foreach ($nl[0] as [, $o]) {
            $this->ls[] = $o + 1;
        }
        $raw = JavaLexer::lex($code)['toks'];
        $linea = 1;
        $nls = count($this->ls);
        $pila = [];
        $k = 0;
        for ($i = 0, $n = count($raw); $i < $n; $i++) {
            [$ty, $tx, $off] = $raw[$i];
            while ($linea < $nls && $this->ls[$linea] <= $off) {
                $linea++;
            }
            if ($ty === 'p' && $i + 1 < $n && $raw[$i + 1][0] === 'p' && $raw[$i + 1][2] === $off + 1 && isset(self::DOBLES[$tx . $raw[$i + 1][1]])) {
                $tx .= $raw[$i + 1][1];
                $i++;
            }
            $this->t[$k] = [$ty, $tx, $off, $linea];
            if ($ty === 'p') {
                if ($tx === '(' || $tx === '{' || $tx === '[') {
                    $pila[] = $k;
                } elseif (($tx === ')' || $tx === '}' || $tx === ']') && $pila) {
                    $o = array_pop($pila);
                    $this->m[$o] = $k;
                    $this->m[$k] = $o;
                }
            }
            $k++;
        }
        $this->scanBody(-1, $k, '', 'file');
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
        if ($tb[0] === 's' && str_contains($tb[1], "\n")) {      // bloque de texto: el final puede caer en otra línea
            $el += substr_count($tb[1], "\n");
        }
        return ['sl' => $ta[3], 'sc' => $this->col($ta[2], $ta[3]), 'el' => $el, 'ec' => $this->col($fin, $el)];
    }

    /** Índice de la ficha que empieza en (línea, columna) o la primera posterior; -1 si no hay. */
    public function tokenAt(int $linea, int $col): int
    {
        foreach ($this->t as $i => $x) {
            if ($x[3] > $linea || ($x[3] === $linea && $this->col($x[2], $x[3]) >= $col)) {
                return $i;
            }
        }
        return -1;
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
                if (!isset($M[$i + 1])) {
                    return $n - 1;
                }
                $e = $this->stmtEnd($M[$i + 1] + 1);
                return ($T[$e + 1][1] ?? '') === 'else' ? $this->stmtEnd($e + 2) : $e;
            case 'for':
            case 'while':
            case 'synchronized':
                return isset($M[$i + 1]) ? $this->stmtEnd($M[$i + 1] + 1) : $n - 1;
            case 'do':
                $e = $this->stmtEnd($i + 1);
                if (($T[$e + 1][1] ?? '') === 'while' && isset($M[$e + 2])) {
                    return $M[$e + 2] + 1;
                }
                return $e;
            case 'try':
                $j = $i + 1;
                if (($T[$j][1] ?? '') === '(' && isset($M[$j])) {
                    $j = $M[$j] + 1;
                }
                $e = $M[$j] ?? $n - 1;
                while (in_array($T[$e + 1][1] ?? '', ['catch', 'finally'], true)) {
                    if ($T[$e + 1][1] === 'catch') {
                        $po = $e + 2;
                        $e = isset($M[$po], $M[$M[$po] + 1]) ? $M[$M[$po] + 1] : $n - 1;
                    } else {
                        $e = $M[$e + 2] ?? $n - 1;
                    }
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

    // ───────────────────────────── clases, campos y métodos ─────────────────────────────

    /** Recorre los miembros del cuerpo $open..$close (fichas; -1/n para el archivo entero). */
    private function scanBody(int $open, int $close, string $cls, string $kind): void
    {
        $ci = null;
        if ($kind !== 'file') {
            $ci = count($this->classes);
            $this->classes[] = ['name' => $cls, 'kind' => $kind, 'open' => $open, 'close' => $close, 'fields' => [], 'line' => $this->t[$open][3]];
        }
        $j = $open + 1;
        if ($kind === 'enum') {                                   // constantes: hasta el primer ';' de su nivel
            while ($j < $close && $this->t[$j][1] !== ';') {
                $j = (in_array($this->t[$j][1], ['(', '{', '['], true) && isset($this->m[$j])) ? $this->m[$j] + 1 : $j + 1;
            }
            $j++;
        }
        while ($j < $close) {
            $j = max($j + 1, $this->member($j, $close, $cls, $ci));
        }
    }

    private function member(int $i, int $lim, string $cls, ?int $ci): int
    {
        $T = $this->t;
        $M = $this->m;
        $first = $i;
        $override = false;
        $static = false;
        $private = false;
        while ($i < $lim) {
            $x = $T[$i][1];
            if ($x === '@' && ($T[$i + 1][1] ?? '') !== 'interface') {
                $i++;
                $override = $override || ($T[$i][1] ?? '') === 'Override';
                while ($i < $lim && $T[$i][0] === 'w') {
                    $i++;
                    if (($T[$i][1] ?? '') === '.') {
                        $i++;
                    } else {
                        break;
                    }
                }
                if (($T[$i][1] ?? '') === '(' && isset($M[$i])) {
                    $i = $M[$i] + 1;
                }
                continue;
            }
            if ($T[$i][0] === 'w' && isset(self::MODS[$x])) {
                $static = $static || $x === 'static';
                $private = $private || $x === 'private';
                $i++;
                continue;
            }
            if ($x === '<' && ($j = $this->skipAngles($i, $lim)) > 0) {      // <T> genérico de método
                $i = $j;
                continue;
            }
            break;
        }
        if ($i >= $lim) {
            return $lim;
        }
        $typeTok = $i;
        $x = $T[$i][1];
        if ($x === '{') {                                         // bloque de inicialización
            return ($M[$i] ?? $i) + 1;
        }
        $anot = $x === '@' && ($T[$i + 1][1] ?? '') === 'interface';
        $esRecord = $x === 'record' && ($T[$i + 1][0] ?? '') === 'w' && in_array($T[$i + 2][1] ?? '', ['(', '<'], true);
        if ($x === 'class' || $x === 'interface' || $x === 'enum' || $anot || $esRecord) {
            $nombre = $T[$i + ($anot ? 2 : 1)][1] ?? '';
            $j = $i + 1;
            while ($j < $lim && $T[$j][1] !== '{') {
                $j = ($T[$j][1] === '(' && isset($M[$j])) ? $M[$j] + 1 : $j + 1;
            }
            if ($j >= $lim || !isset($M[$j])) {
                return $lim;
            }
            $this->scanBody($j, $M[$j], $nombre, $anot ? 'annotation' : ($esRecord ? 'record' : $x));
            if ($esRecord && isset($M[$i + 2]) && $this->classes) {   // componentes del record = campos
                foreach ($this->params($i + 2) as $p) {
                    foreach ($this->classes as $k => $c) {
                        if ($c['open'] === $j) {
                            $this->classes[$k]['fields'][$p['name']] = $p['type'];
                        }
                    }
                }
            }
            return $M[$j] + 1;
        }
        // compacto de record: `Nombre {`
        if ($T[$i][0] === 'w' && $x === $cls && ($T[$i + 1][1] ?? '') === '{' && isset($M[$i + 1])) {
            $this->unit($first, $typeTok, $i, -1, $M[$i + 1] ? $i + 1 : 0, $cls, true, $static, $private, $override);
            return $M[$i + 1] + 1;
        }
        for ($j = $i; $j < $lim; $j++) {
            $y = $T[$j][1];
            if ($y === '(' && $j > $i && $T[$j - 1][0] === 'w' && isset($M[$j])) {
                $k = $M[$j] + 1;
                while ($k < $lim && $T[$k][1] !== '{' && $T[$k][1] !== ';') {
                    $k++;
                }
                if ($k >= $lim) {
                    return $lim;
                }
                if ($T[$k][1] === '{' && isset($M[$k])) {
                    $this->unit($first, $typeTok, $j - 1, $j, $k, $cls, $j - 1 === $typeTok, $static, $private, $override);
                    return $M[$k] + 1;
                }
                return $k + 1;
            }
            if ($y === '=' || $y === ';' || $y === ',') {          // campo
                if ($ci !== null) {
                    foreach ($this->declAt($typeTok, $lim, true) ?? [] as $d) {
                        $this->classes[$ci]['fields'][$d['name']] = $d['init'] ?? $d['type'];
                    }
                }
                while ($j < $lim && $T[$j][1] !== ';') {
                    $j = (in_array($T[$j][1], ['(', '{', '['], true) && isset($M[$j])) ? $M[$j] + 1 : $j + 1;
                }
                return $j + 1;
            }
            if ($y === '{') {
                return ($M[$j] ?? $j) + 1;
            }
        }
        return $lim;
    }

    private function unit(int $first, int $typeTok, int $nameTok, int $po, int $open, string $cls, bool $ctor, bool $static, bool $private, bool $override): void
    {
        $close = $this->m[$open] ?? $open;
        $ret = $ctor ? '' : $this->typeText($typeTok, $nameTok);
        $this->units[] = [
            'name' => $this->t[$nameTok][1], 'cls' => $cls, 'ctor' => $ctor, 'static' => $static, 'private' => $private, 'override' => $override,
            'first' => $first, 'typeTok' => $typeTok, 'nameTok' => $nameTok, 'open' => $open, 'close' => $close,
            'params' => $po >= 0 ? $this->params($po) : [], 'ret' => $ret, 'class' => count($this->classes) - 1,
            'throws' => $po >= 0 && ($this->t[$this->m[$po] + 1][1] ?? '') === 'throws',
        ];
    }

    private function typeText(int $a, int $b): string
    {
        $s = '';
        for ($i = $a; $i < $b; $i++) {
            $s .= $this->t[$i][1];
        }
        return $s;
    }

    /** @return list<array{type:string, name:string, tok:int, text:string}> parámetros de la lista que abre $po */
    private function params(int $po): array
    {
        $T = $this->t;
        $pc = $this->m[$po] ?? $po;
        $out = [];
        $ini = $po + 1;
        $prof = 0;
        for ($i = $po + 1; $i <= $pc; $i++) {
            $x = $T[$i][1];
            if ($i < $pc && $T[$i][0] === 'p') {
                if ($x === '<') {
                    $prof++;
                } elseif ($x === '>') {
                    $prof--;
                } elseif (($x === '(' || $x === '[' || $x === '{') && isset($this->m[$i])) {
                    $i = $this->m[$i];
                    continue;
                }
            }
            if ($i === $pc || ($x === ',' && $prof <= 0)) {
                $name = null;
                $nt = -1;
                for ($q = $i - 1; $q >= $ini; $q--) {
                    if ($T[$q][0] === 'w' && !isset(self::KW[$T[$q][1]])) {
                        $name = $T[$q][1];
                        $nt = $q;
                        break;
                    }
                }
                if ($name !== null && $nt > $ini) {
                    $tipo = '';
                    $base = '';
                    for ($q = $ini; $q < $nt; $q++) {
                        if ($T[$q][1] === 'final' || $T[$q][1] === '@') {
                            continue;
                        }
                        $tipo .= $T[$q][1];
                        if ($T[$q][0] === 'w' && ($base === '' || ($T[$q - 1][1] ?? '') === '.')) {
                            $base = $T[$q][1];
                        }
                        if ($T[$q][1] === '<') {
                            break;
                        }
                    }
                    $arr = str_contains($tipo, '[') || str_contains($tipo, '...');
                    $out[] = ['type' => $base . ($arr ? '[]' : ''), 'name' => $name, 'tok' => $nt, 'text' => trim(preg_replace('/\b(final)\b/', '', $this->textOf($ini, $nt)) ?? '')];
                }
                $ini = $i + 1;
            }
        }
        return $out;
    }

    private function textOf(int $a, int $b): string
    {
        $s = '';
        for ($i = $a; $i <= $b; $i++) {
            $s .= ($i > $a && $this->t[$i][0] === 'w' && $this->t[$i - 1][0] === 'w' ? ' ' : '') . $this->t[$i][1];
        }
        return $s;
    }

    // ───────────────────────────── declaraciones de variables ─────────────────────────────

    /** Salta `<...>` de un genérico; devuelve el índice posterior al `>` o -1 si aquello no parece un genérico. */
    public function skipAngles(int $i, int $lim): int
    {
        $prof = 0;
        for ($j = $i; $j < $lim && $j < $i + 60; $j++) {
            $x = $this->t[$j];
            if ($x[1] === '<') {
                $prof++;
            } elseif ($x[1] === '>') {
                if (--$prof === 0) {
                    return $j + 1;
                }
            } elseif (!($x[0] === 'w' || in_array($x[1], [',', '.', '?', '[', ']', '&'], true))) {
                return -1;
            }
        }
        return -1;
    }

    /**
     * ¿Empieza en la ficha $i una declaración `Tipo nombre [= ...]`? Devuelve una entrada por cada declarador
     * (`int a = 1, b;` da dos): {type (nombre base, con [] si es array), init (tipo del `new X`, si lo hay), name, tok, typeTok, prev}.
     * @return ?list<array<string,mixed>>
     */
    public function declAt(int $i, int $lim, bool $campo = false): ?array
    {
        $T = $this->t;
        $w = $T[$i][1];
        if ($T[$i][0] !== 'w') {
            return null;
        }
        $esVar = $w === 'var';
        if (!$esVar && !isset(self::PRIM[$w]) && !(ctype_upper($w[0]) && !isset(self::KW[$w]))) {
            return null;
        }
        $p = $T[$i - 1][1] ?? '';
        if (!$campo && !in_array($p, ['', ';', '{', '}', '(', 'final', ':', '->'], true)) {
            return null;
        }
        $j = $i + 1;
        $base = $w;
        while (($T[$j][1] ?? '') === '.' && ($T[$j + 1][0] ?? '') === 'w') {
            $base = $T[$j + 1][1];
            $j += 2;
        }
        if (($T[$j][1] ?? '') === '<') {
            $j = $this->skipAngles($j, $lim);
            if ($j < 0) {
                return null;
            }
        }
        $arr = '';
        while (($T[$j][1] ?? '') === '[' && ($T[$j + 1][1] ?? '') === ']') {
            $j += 2;
            $arr .= '[]';
        }
        $out = [];
        while (true) {
            $n = $T[$j] ?? null;
            if ($n === null || $n[0] !== 'w' || isset(self::KW[$n[1]]) || !in_array($T[$j + 1][1] ?? '', ['=', ';', ',', ':', ')'], true)) {
                break;
            }
            $d = ['type' => $base . $arr, 'name' => $n[1], 'tok' => $j, 'typeTok' => $i, 'prev' => $p];
            $k = $j + 1;
            if (($T[$k][1] ?? '') === '=') {
                if (($T[$k + 1][1] ?? '') === 'new' && ($T[$k + 2][0] ?? '') === 'w') {
                    $q = $k + 2;
                    while (($T[$q + 1][1] ?? '') === '.' && ($T[$q + 2][0] ?? '') === 'w') {
                        $q += 2;
                    }
                    $d['init'] = $T[$q][1] . (($T[$q + 1][1] ?? '') === '[' ? '[]' : '');
                } elseif ($esVar || $base === 'var') {
                    $d['init'] = null;
                }
                // salta la expresión hasta la coma, el ';' o los ':' / ')' de su nivel
                while ($k < $lim && !in_array($T[$k][1], [',', ';', ':', ')'], true)) {
                    $k = (in_array($T[$k][1], ['(', '[', '{'], true) && isset($this->m[$k])) ? $this->m[$k] + 1 : $k + 1;
                }
            }
            if ($esVar && !isset($d['init'])) {
                $d['type'] = 'var';
            }
            $out[] = $d;
            if (($T[$k][1] ?? '') === ',' && $p !== '(' && !$campo || ($campo && ($T[$k][1] ?? '') === ',')) {
                $j = $k + 1;
                continue;
            }
            break;
        }
        return $out ?: null;
    }

    /**
     * Tipos de las variables visibles en una unidad: campos de su clase, parámetros y locales (en orden: la última
     * declaración manda). También las declaraciones locales con su ficha, para "sin usar".
     * @return array{types:array<string,string>, decls:list<array<string,mixed>>}
     */
    public function locals(array $u): array
    {
        $types = $this->classes[$u['class']]['fields'] ?? [];
        foreach ($u['params'] as $p) {
            $types[$p['name']] = $p['type'];
        }
        $decls = [];
        $T = $this->t;
        for ($i = $u['open'] + 1; $i < $u['close']; $i++) {
            if ($T[$i][0] !== 'w') {
                continue;
            }
            $c = $T[$i][1][0];
            if (!(ctype_upper($c) || $c === 'v' || $c === 'i' || $c === 'l' || $c === 'd' || $c === 'b' || $c === 'c' || $c === 'f' || $c === 's')) {
                continue;
            }
            foreach ($this->declAt($i, $u['close']) ?? [] as $d) {
                $types[$d['name']] = $d['init'] ?? $d['type'];
                $d['ctx'] = ($T[$d['typeTok'] - 1][1] ?? '') === '(' ? ($T[$d['typeTok'] - 2][1] ?? '') : '';
                $decls[] = $d;
            }
        }
        return ['types' => $types, 'decls' => $decls];
    }

    /** ¿Es un nombre de clase de usuario? */
    public function isUserClass(string $n): bool
    {
        foreach ($this->classes as $c) {
            if ($c['name'] === $n) {
                return true;
            }
        }
        return false;
    }
}
