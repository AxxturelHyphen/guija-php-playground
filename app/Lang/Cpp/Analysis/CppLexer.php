<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp\Analysis;

defined('PG_ROOT') or exit;

/**
 * Lexer de C++ con UNA sola expresión regular (como JavaLexer): sin compilador y en ~1 ms para 500 líneas.
 *
 * Fichas: [tipo, texto, offset en bytes, línea 1-based] con tipo 'w' (palabra), 's' (cadena o carácter, con prefijos
 * u8/L/u/U y cadenas crudas R"delim( … )delim"), 'n' (número: 1'000'000, 0x1F, 0b101, 10ULL, 1e9, 2.5f) o 'p' (símbolo).
 * Los operadores de varios caracteres (`::`, `->`, `<=>`, `...`, `++`, `&&`, `<<=`, `>>=`, `==`, `+=`…) son una sola
 * ficha; `>>` NO se funde (cerraría dos plantillas: `vector<vector<int>>`), igual que los genéricos de Java.
 *
 * Las líneas del preprocesador (`#include <…>`, `#define …` con continuaciones `\`) son fichas de tipo 'pp' que van
 * aparte (lista `pp`), para que no estorben al analizar el código. Los comentarios no son fichas: un comentario de
 * documentación (`/** … *​/` o líneas `///`) queda asociado a la ficha que le sigue si está justo encima (sin línea en
 * blanco entre medias); los `//` normales se guardan por línea (`lc`) para usarlos como documentación de lo declarado.
 */
final class CppLexer
{
    private const OPS = '<<=|>>=|<=>|\.\.\.|->\*?|::|\+\+|--|&&|\|\||<<|[-+*/%&|^!=<>]=|\S';
    private const BASE = '/\*.*?\*/|//[^\n]*|^[ \t]*\#(?:\\\\\r?\n|[^\n])*+|(?:u8|[uUL])?"(?:\\\\.|[^"\\\\\n])*"|(?:u8|[uUL])?\'(?:\\\\.|[^\'\\\\\n])*\''
        . '|[A-Za-z_\x80-\xff][\w\x80-\xff]*|\.?\d(?:[eEpP][+-]|\'(?=\w)|[\w.])*|';
    private const RAW = '(?:u8|[uUL])?R"(?<d>[^()\\\\\s"]{0,16})\(.*?\)\k<d>"|';

    /**
     * @return array{toks:list<array{0:string,1:string,2:int,3:int}>, match:array<int,int>, doc:array<int,array{0:int,1:int}>,
     *   pp:list<array{text:string, off:int, line:int, doc:?array{0:int,1:int}}>, lc:array<int,array{0:int,1:string}>, ls:list<int>}
     */
    public static function lex(string $code): array
    {
        $re = '~' . (str_contains($code, 'R"') ? self::RAW : '') . self::BASE . self::OPS . '~ms';
        preg_match_all($re, $code, $m, PREG_OFFSET_CAPTURE);
        $ls = [0];
        $p = -1;
        while (($p = strpos($code, "\n", $p + 1)) !== false) {
            $ls[] = $p + 1;
        }
        $nls = count($ls);
        $toks = [];
        $match = [];
        $doc = [];
        $pp = [];
        $lc = [];
        $pila = [];
        $pend = null;          // [ini, fin, esTriple]
        $linea = 1;
        $k = 0;
        $clase = self::clases();
        foreach ($m[0] as [$t, $off]) {
            while ($linea < $nls && $ls[$linea] <= $off) {
                $linea++;
            }
            $c = $t[0];
            $ty = $clase[$c] ?? 'p';
            if ($ty === 'w') {
                if (isset($t[1]) && ($t[-1] === '"' || $t[-1] === "'")) {
                    $ty = 's';                                   // u8"…", L'x', R"(…)"
                }
            } elseif ($ty === '/') {
                if (isset($t[1]) && ($t[1] === '*' || $t[1] === '/')) {
                    $fin = $off + strlen($t);
                    if ($t[1] === '*') {
                        if (strlen($t) > 4 && $t[2] === '*') {
                            $pend = [$off, $fin, false];
                        }
                    } elseif (isset($t[2]) && $t[2] === '/' && ($t[3] ?? '') !== '/') {
                        // `///` seguidos: un solo bloque de documentación
                        $pend = ($pend !== null && $pend[2] && !preg_match('/\n[ \t]*\r?\n/', substr($code, $pend[1], $off - $pend[1])))
                            ? [$pend[0], $fin, true] : [$off, $fin, true];
                    } else {
                        $lc[$linea] = [$off, $t];
                    }
                    continue;
                }
                $ty = 'p';
            } elseif ($ty === '#') {
                $lead = strspn($t, " \t");
                $off += $lead;
                $pp[] = ['text' => substr($t, $lead), 'off' => $off, 'line' => $linea, 'doc' => $pend !== null ? self::near($code, $pend, $off) : null];
                $pend = null;
                continue;
            } elseif ($ty === '.') {
                $ty = isset($t[1]) && $t[1] !== '.' ? 'n' : 'p';
            } elseif ($ty === 'p') {
                if ($c === '(' || $c === '{' || $c === '[') {
                    $pila[] = $k;
                } elseif (($c === ')' || $c === '}' || $c === ']') && $pila !== []) {
                    $o = array_pop($pila);
                    $match[$o] = $k;
                    $match[$k] = $o;
                }
            }
            $toks[] = [$ty, $t, $off, $linea];
            if ($pend !== null) {
                $d = self::near($code, $pend, $off);
                if ($d !== null) {
                    $doc[$k] = $d;
                }
                $pend = null;
            }
            $k++;
        }
        return ['toks' => $toks, 'match' => $match, 'doc' => $doc, 'pp' => $pp, 'lc' => $lc, 'ls' => $ls];
    }

    /** Clase de ficha por su primer carácter. @return array<string,string> */
    private static function clases(): array
    {
        static $t = null;
        if ($t === null) {
            $t = [];
            foreach (array_merge(range('a', 'z'), range('A', 'Z'), ['_']) as $ch) {
                $t[$ch] = 'w';
            }
            for ($i = 0x80; $i <= 0xff; $i++) {
                $t[chr($i)] = 'w';
            }
            foreach (range('0', '9') as $ch) {
                $t[(string) $ch] = 'n';
            }
            $t['"'] = 's';
            $t["'"] = 's';
            $t['/'] = '/';
            $t['#'] = '#';
            $t[' '] = '#';
            $t["\t"] = '#';
            $t['.'] = '.';
        }
        return $t;
    }

    /** El comentario de documentación pendiente, si está justo encima de $off (sin una línea en blanco por medio). */
    private static function near(string $code, ?array $pend, int $off): ?array
    {
        if ($pend === null || preg_match('/\n[ \t]*\r?\n/', substr($code, $pend[1], $off - $pend[1]))) {
            return null;
        }
        return [$pend[0], $pend[1]];
    }
}
