<?php
declare(strict_types=1);

namespace Playground\Lang\Java;

defined('PG_ROOT') or exit;

/**
 * Lexer y "esqueleto" de declaraciones de Java, sin compilar nada: lo justo para saber dónde empieza y acaba cada
 * método estático y cada tipo de primer nivel (con su Javadoc y sus anotaciones), qué clase tiene `main`, etc.
 *
 * Los offsets son BYTES del código (como substr en PHP). Se reutilizará en el análisis estático.
 */
final class JavaLexer
{
    private const MODIFICADORES = ['public', 'protected', 'private', 'static', 'final', 'abstract', 'native', 'synchronized',
        'transient', 'volatile', 'strictfp', 'default', 'sealed'];

    /** @var array<string,array<string,mixed>> */
    private static array $memo = [];

    /**
     * Fichas: [tipo, texto, offset] con tipo 'w' (palabra), 's' (cadena o char), 'n' (número) o 'p' (símbolo).
     * Los comentarios no son fichas: un Javadoc `/** … *​/` queda asociado a la ficha que le sigue (doc[índice] = [ini, fin]).
     * match[i] = índice del paréntesis/llave/corchete que cierra (o abre) el de la ficha i.
     *
     * @return array{toks:list<array{0:string,1:string,2:int}>, doc:array<int,array{0:int,1:int}>, match:array<int,int>}
     */
    public static function lex(string $code): array
    {
        $re = '~/\*.*?\*/|//[^\n]*|"""(?:\\\\.|[^\\\\])*?"""|"(?:\\\\.|[^"\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\n])*\'|[A-Za-z_$\x80-\xff][\w$\x80-\xff]*|\d[\w.]*|\S~s';
        $n = preg_match_all($re, $code, $m, PREG_OFFSET_CAPTURE);
        $toks = [];
        $doc = [];
        $match = [];
        $pila = [];
        $pendiente = null;
        for ($i = 0; $i < (int) $n; $i++) {
            [$t, $off] = $m[0][$i];
            $c = $t[0];
            if ($c === '/' && isset($t[1]) && ($t[1] === '*' || $t[1] === '/')) {
                if ($t[1] === '*' && strlen($t) > 4 && $t[2] === '*') {
                    $pendiente = [$off, $off + strlen($t)];
                }
                continue;
            }
            $tipo = ($c === '"' || $c === "'") ? 's' : (ctype_digit($c) ? 'n' : (ctype_alpha($c) || $c === '_' || $c === '$' || ord($c) >= 0x80 ? 'w' : 'p'));
            $k = count($toks);
            $toks[] = [$tipo, $t, $off];
            if ($pendiente !== null) {
                $doc[$k] = $pendiente;
                $pendiente = null;
            }
            if ($tipo === 'p') {
                if ($t === '(' || $t === '{' || $t === '[') {
                    $pila[] = $k;
                } elseif (($t === ')' || $t === '}' || $t === ']') && $pila !== []) {
                    $o = array_pop($pila);
                    $match[$o] = $k;
                    $match[$k] = $o;
                }
            }
        }
        return ['toks' => $toks, 'doc' => $doc, 'match' => $match];
    }

    /**
     * Tipos de primer nivel con sus métodos.
     * @return list<array{name:string, kind:string, start:int, end:int, open:int, public:bool, ti:int, tj:int,
     *   methods:list<array{name:string, static:bool, start:int, end:int, ti:int, tj:int, params:int}>}>
     */
    public static function types(string $code): array
    {
        $k = md5($code);
        if (isset(self::$memo[$k])) {
            return self::$memo[$k]['types'];
        }
        $L = self::lex($code);
        $T = $L['toks'];
        $n = count($T);
        $types = [];
        $i = 0;
        while ($i < $n) {
            $x = $T[$i][1];
            if (($x === 'package' || $x === 'import')) {
                while ($i < $n && $T[$i][1] !== ';') {
                    $i++;
                }
                $i++;
                continue;
            }
            if ($x === ';') {
                $i++;
                continue;
            }
            $d = self::decl($L, $i, $n);
            if ($d['kind'] === 'type') {
                $d['methods'] = [];
                $o = $d['openTok'];
                $fin = $L['match'][$o] ?? $n;
                $j = $o + 1;
                while ($j < $fin) {
                    $e = self::decl($L, $j, $fin);
                    if ($e['kind'] === 'method') {
                        $d['methods'][] = $e;
                    }
                    $j = max($e['next'], $j + 1);
                }
                unset($d['openTok']);
                $types[] = $d;
            }
            $i = max($d['next'], $i + 1);
        }
        self::$memo = [$k => ['types' => $types]];     // solo se recuerda el último código
        return $types;
    }

    /**
     * Una declaración que empieza en la ficha $i (modificadores y anotaciones incluidos).
     * @return array<string,mixed> kind: 'type' | 'method' | 'skip'; next = índice de la ficha siguiente
     */
    private static function decl(array $L, int $i, int $lim): array
    {
        $T = $L['toks'];
        $M = $L['match'];
        $first = $i;
        $static = false;
        $public = false;
        while ($i < $lim) {
            $x = $T[$i][1];
            if ($x === '@' && ($T[$i + 1][1] ?? '') !== 'interface') {
                $i++;
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
            if ($T[$i][0] === 'w' && in_array($x, self::MODIFICADORES, true)) {
                $static = $static || $x === 'static';
                $public = $public || $x === 'public';
                $i++;
                continue;
            }
            if ($x === 'non' && ($T[$i + 1][1] ?? '') === '-' && ($T[$i + 2][1] ?? '') === 'sealed') {
                $i += 3;
                continue;
            }
            break;
        }
        if ($i >= $lim) {
            return ['kind' => 'skip', 'next' => $lim];
        }
        $start = isset($L['doc'][$first]) ? $L['doc'][$first][0] : $T[$first][2];
        $x = $T[$i][1];
        if ($x === '{') {                                  // bloque de inicialización
            return ['kind' => 'skip', 'next' => ($M[$i] ?? $i) + 1];
        }
        $anotacion = $x === '@' && ($T[$i + 1][1] ?? '') === 'interface';
        $esRecord = $x === 'record' && ($T[$i + 1][0] ?? '') === 'w' && in_array($T[$i + 2][1] ?? '', ['(', '<'], true);
        if ($x === 'class' || $x === 'interface' || $x === 'enum' || $anotacion || $esRecord) {
            $nombre = $T[$i + ($anotacion ? 2 : 1)][1] ?? '';
            $j = $i + 1;
            while ($j < $lim && $T[$j][1] !== '{') {
                $j = ($T[$j][1] === '(' && isset($M[$j])) ? $M[$j] + 1 : $j + 1;
            }
            if ($j >= $lim || !isset($M[$j])) {
                return ['kind' => 'skip', 'next' => $lim];
            }
            $cierre = $M[$j];
            return ['kind' => 'type', 'name' => $nombre, 'type' => $anotacion ? 'annotation' : ($esRecord ? 'record' : $x), 'start' => $start,
                'end' => $T[$cierre][2] + 1, 'open' => $T[$j][2], 'openTok' => $j, 'public' => $public, 'ti' => $first, 'tj' => $cierre, 'next' => $cierre + 1];
        }
        for ($j = $i; $j < $lim; $j++) {
            $y = $T[$j][1];
            if ($y === '(') {
                if ($j === $i || $T[$j - 1][0] !== 'w' || !isset($M[$j])) {
                    break;
                }
                $k = $M[$j] + 1;
                while ($k < $lim && $T[$k][1] !== '{' && $T[$k][1] !== ';') {
                    $k++;
                }
                if ($k >= $lim) {
                    break;
                }
                $cierre = $T[$k][1] === '{' ? ($M[$k] ?? $k) : $k;
                // número de parámetros: comas a profundidad 0 entre los paréntesis (cuenta genéricos <A, B> como una sola)
                $params = 0;
                $prof = 0;
                $hay = false;
                for ($q = $j + 1; $q < $M[$j]; $q++) {
                    $z = $T[$q][1];
                    if ($z === '<') {
                        $prof++;
                    } elseif ($z === '>') {
                        $prof--;
                    } elseif (($z === '(' || $z === '[' || $z === '{') && isset($M[$q])) {
                        $q = $M[$q];
                        $hay = true;
                        continue;
                    } elseif ($z === ',' && $prof === 0) {
                        $params++;
                    }
                    $hay = true;
                }
                return ['kind' => 'method', 'name' => $T[$j - 1][1], 'static' => $static, 'start' => $start, 'end' => $T[$cierre][2] + 1,
                    'ti' => $first, 'tj' => $cierre, 'params' => $hay ? $params + 1 : 0, 'next' => $cierre + 1];
            }
            if ($y === '=' || $y === ';' || $y === ',') {  // campo (o constantes de enum): hasta el ';' de su nivel
                while ($j < $lim && $T[$j][1] !== ';') {
                    $j = (in_array($T[$j][1], ['(', '{', '['], true) && isset($M[$j])) ? $M[$j] + 1 : $j + 1;
                }
                return ['kind' => 'skip', 'next' => $j + 1];
            }
            if ($y === '{') {
                return ['kind' => 'skip', 'next' => ($M[$j] ?? $j) + 1];
            }
        }
        return ['kind' => 'skip', 'next' => $lim];
    }

    /**
     * La clase que se ejecuta (la primera de primer nivel con `static void main`) o, si no hay, la que se llama Soluciones.
     * @return ?array<string,mixed>
     */
    public static function container(string $code): ?array
    {
        $types = self::types($code);
        foreach ($types as $t) {
            foreach ($t['methods'] as $m) {
                if ($m['name'] === 'main' && $m['static']) {
                    return $t + ['hasMain' => true];
                }
            }
        }
        foreach ($types as $t) {
            if ($t['name'] === 'Soluciones') {
                return $t + ['hasMain' => false];
            }
        }
        return null;
    }
}
