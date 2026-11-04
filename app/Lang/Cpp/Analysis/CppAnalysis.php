<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp\Analysis;

defined('PG_ROOT') or exit;

/**
 * Análisis estático de C++ en PHP puro (sin compilador): lo que usa CppLanguage para analyse(), declarations() e
 * insertionPoint(). Memoriza por md5 (el lint lo pide a menudo con el mismo código).
 *
 *  - analyse():      {units, summary, hints, symbols}
 *  - symbols:        todo lo que declara el usuario (variables, parámetros, campos, funciones, métodos, tipos, alias,
 *                    enumeradores, constantes, lambdas, macros) con su tipo, ámbito y una explicación en español:
 *                    {name, kind, type, decl, line, col, scope:{sl,el}, cls, fn, doc, detail}
 *  - declarations(): funciones libres y tipos de primer nivel (forma de Language::declarations())
 */
final class CppAnalysis
{
    /** @var array<string,array<string,mixed>> */
    private static array $memo = [];

    private static function entry(string $code): array
    {
        $k = md5($code);
        if (!isset(self::$memo[$k])) {
            if (count(self::$memo) >= 4) {
                array_shift(self::$memo);
            }
            self::$memo[$k] = ['code' => new CppCode($code)];
        }
        return self::$memo[$k];
    }

    public static function code(string $code): CppCode
    {
        return self::entry($code)['code'];
    }

    /** @return array{units:list<array<string,mixed>>, summary:array<string,mixed>, hints:list<array<string,mixed>>, symbols:list<array<string,mixed>>} */
    public static function analyse(string $code): array
    {
        $k = md5($code);
        $e = self::entry($code);
        if (isset($e['analysis'])) {
            return $e['analysis'];
        }
        $c = $e['code'];
        $mt = new CppMetrics($c);
        $res = $mt->compute();
        $hints = (new CppHints($c, $mt))->all();
        $loc = 0;
        $enBloque = false;
        foreach (preg_split('/\R/', $code) ?: [] as $l) {
            $t = trim($l);
            if ($enBloque) {
                $enBloque = !str_contains($t, '*/');
                continue;
            }
            if ($t === '' || str_starts_with($t, '//')) {
                continue;
            }
            if (str_starts_with($t, '/*')) {
                $enBloque = !str_contains($t, '*/');
                continue;
            }
            $loc++;
        }
        $res['summary']['loc'] = max($res['summary']['loc'], $loc);
        $out = ['units' => $res['units'], 'summary' => $res['summary'], 'hints' => $hints, 'symbols' => (new CppSymbols($c, $mt))->all()];
        self::$memo[$k]['analysis'] = $out;
        return $out;
    }

    /** ¿Hay un `int main(…) { … }` de primer nivel? */
    public static function hasMain(string $code): bool
    {
        foreach (self::code($code)->top as $it) {
            if ($it['kind'] === 'main') {
                return true;
            }
        }
        return false;
    }

    /**
     * Funciones libres (`function:<nombre>`) y tipos (`type:<nombre>`: struct/class/union/enum/using/typedef) de primer
     * nivel. start..end incluye el comentario de documentación, el `template<…>` y los atributos; `norm` es el código
     * sin espacios ni comentarios. Con sobrecargas manda la primera (como en Java). main no se sustituye nunca.
     * @return array<string, array<string,mixed>>
     */
    public static function declarations(string $code): array
    {
        $c = self::code($code);
        $T = $c->t;
        $out = [];
        foreach ($c->top as $it) {
            if ($it['kind'] === 'function') {
                $key = 'function:' . strtolower($it['name']);
                $kind = 'function';
            } elseif (($it['kind'] === 'type' || $it['kind'] === 'alias') && $it['name'] !== '') {
                $key = 'type:' . strtolower($it['name']);
                $kind = 'type';
            } else {
                continue;
            }
            if (isset($out[$key])) {
                continue;
            }
            $doc = $c->doc[$it['ti']] ?? null;
            $start = $doc !== null ? $doc[0] : $T[$it['ti']][2];
            $end = $T[$it['tj']][2] + strlen($T[$it['tj']][1]);
            $norm = '';
            for ($i = $it['ti']; $i <= $it['tj']; $i++) {
                $norm .= $T[$i][1];
            }
            $out[$key] = ['key' => $key, 'name' => $it['name'], 'kind' => $kind, 'line' => substr_count($code, "\n", 0, $start) + 1,
                'endLine' => substr_count($code, "\n", 0, max(0, $end - 1)) + 1, 'start' => $start, 'end' => $end,
                'doc' => $doc === null ? null : substr($code, $doc[0], $doc[1] - $doc[0]), 'norm' => $norm];
        }
        return $out;
    }

    /**
     * Dónde insertar una declaración de la solución que el usuario no tiene. C++ exige declarar antes de usar: va justo
     * antes de la primera declaración de primer nivel que nombra a `$decl['name']`; si ninguna lo nombra, antes de
     * `int main(`; si no hay main, al final. Siempre al principio de una línea.
     * @param array<string,mixed> $decl
     */
    public static function insertionPoint(string $code, array $decl): int
    {
        $c = self::code($code);
        $T = $c->t;
        $name = (string) ($decl['name'] ?? '');
        $first = null;
        foreach ($c->top as $it) {
            if ($name !== '') {
                for ($k = $it['ti']; $k <= $it['tj']; $k++) {
                    if ($T[$k][1] === $name && $T[$k][0] === 'w' && !in_array($T[$k - 1][1] ?? '', ['.', '->'], true)) {
                        return self::lineStartOf($c, $it);
                    }
                }
            }
            if ($first === null && $it['kind'] === 'main') {
                $first = $it;
            }
        }
        return $first !== null ? self::lineStartOf($c, $first) : strlen($code);
    }

    private static function lineStartOf(CppCode $c, array $it): int
    {
        $doc = $c->doc[$it['ti']] ?? null;
        $off = $doc !== null ? $doc[0] : $c->t[$it['ti']][2];
        $nl = strrpos(substr($c->code, 0, $off), "\n");
        return $nl === false ? 0 : $nl + 1;
    }
}
