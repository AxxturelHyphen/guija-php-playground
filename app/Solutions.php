<?php
declare(strict_types=1);

namespace Playground;

use Playground\Analysis\Decl;
use Playground\Analysis\Parser;
use Playground\Analysis\Source;

defined('PG_ROOT') or exit;

/**
 * Soluciones de referencia (soluciones/*.php).
 *
 * Cada archivo de soluciones contiene solo declaraciones (funciones y clases) con un docblock:
 *
 *   /**
 *    * Resumen de una línea.
 *    *
 *    * @complejidad Tiempo O(n), espacio O(1).
 *    * @explicacion Por qué es la mejor forma...
 *    * @alternativas Fuerza bruta: O(n²)...
 *    * @bigo n         (1 | log | n | nlogn | n2 | n3 | exp) — lo comprueban los tests contra medir()
 *    *​/
 *
 * "Inyectar" una solución = sustituir, en el código del usuario, cada declaración por la de la solución
 * con el mismo nombre. Así se ejecutan los mismos tests y medir() con la versión óptima.
 */
final class Solutions
{
    /** Ruta del archivo de soluciones que corresponde a un archivo de ejercicios (mismo nombre). */
    public static function pathFor(string $name): ?string
    {
        if (!preg_match('/^[\w.-]+\.php$/', $name)) {
            return null;
        }
        $path = PG_SOLUCIONES . '/' . $name;
        return is_file($path) ? $path : null;
    }

    /**
     * Docblock -> {text, complejidad, explicacion, alternativas, bigo, ...}
     * @return array<string,string>
     */
    public static function parseDoc(?string $doc): array
    {
        if ($doc === null) {
            return [];
        }
        $lines = preg_split('/\R/', $doc) ?: [];
        $out = ['text' => ''];
        $current = 'text';
        foreach ($lines as $line) {
            $line = (string) preg_replace('/^\s*(\/\*\*|\*\/|\*)\s?/', '', $line);
            $line = (string) preg_replace('/\s*\*\/\s*$/', '', $line);
            if (preg_match('/^@(\w+)\s*(.*)$/', $line, $m)) {
                $current = strtolower($m[1]);
                $out[$current] = ($out[$current] ?? '') . $m[2];
            } else {
                $out[$current] = ($out[$current] ?? '') . ($out[$current] ?? '' ? "\n" : '') . $line;
            }
        }
        return array_map(static fn(string $v): string => trim((string) preg_replace("/\n{3,}/", "\n\n", $v)), $out);
    }

    /**
     * Declaraciones de un código (para emparejar usuario <-> solución).
     * @return array<string, array{decl:Decl, code:string}>
     */
    public static function declarations(string $code): array
    {
        $src = new Source($code);
        $parser = new Parser($src);
        $out = [];
        foreach ($parser->decls as $d) {
            $out[$d->key] = ['decl' => $d, 'code' => substr($code, $d->startByte, $d->endByte - $d->startByte)];
        }
        return $out;
    }

    /**
     * Lista emparejada para el panel "Solución".
     * @return list<array<string,mixed>>
     */
    public static function compare(string $userCode, string $solutionCode): array
    {
        $mine = self::declarations($userCode);
        $items = [];
        foreach (self::declarations($solutionCode) as $key => ['decl' => $sol, 'code' => $solCode]) {
            $user = $mine[$key] ?? null;
            $items[] = [
                'key' => $key,
                'name' => $sol->name . ($sol->kind === 'function' ? '()' : ''),
                'kind' => $sol->kind,
                'doc' => self::parseDoc($sol->doc),
                'solution' => ['code' => $solCode, 'line' => $sol->line],
                'mine' => $user === null ? null : [
                    'code' => $user['code'],
                    'line' => $user['decl']->line,
                    'endLine' => $user['decl']->endLine,
                ],
                'implemented' => $user !== null && !preg_match('/\bpendiente\s*\(/i', $user['code']),
                'same' => $user !== null && self::normalize($user['code']) === self::normalize($solCode),
            ];
        }
        return $items;
    }

    /** Texto del código sin espacios ni comentarios: para saber si dos versiones son la misma. */
    private static function normalize(string $code): string
    {
        $out = '';
        foreach (\PhpToken::tokenize("<?php\n" . $code) as $t) {
            if ($t->id !== T_WHITESPACE && $t->id !== T_COMMENT && $t->id !== T_DOC_COMMENT && $t->id !== T_OPEN_TAG) {
                $out .= $t->text . ' ';
            }
        }
        return $out;
    }

    /**
     * Devuelve el código del usuario con cada declaración sustituida por la de la solución.
     * Las que la solución define y el usuario no (auxiliares) se añaden al principio.
     */
    public static function splice(string $userCode, string $solutionCode): string
    {
        $src = new Source($userCode);
        $parser = new Parser($src);
        $userDecls = [];
        foreach ($parser->decls as $d) {
            $userDecls[$d->key] = $d;
        }

        $replacements = [];  // [startByte, endByte, text]
        $extras = [];
        foreach (self::declarations($solutionCode) as $key => ['code' => $solCode]) {
            if (isset($userDecls[$key])) {
                $d = $userDecls[$key];
                $replacements[] = [$d->startByte, $d->endByte, $solCode];
            } else {
                $extras[] = $solCode;
            }
        }

        usort($replacements, static fn(array $a, array $b): int => $b[0] <=> $a[0]);
        $out = $userCode;
        foreach ($replacements as [$from, $to, $text]) {
            $out = substr($out, 0, $from) . $text . substr($out, $to);
        }

        if ($extras) {
            // Tras `declare(strict_types=1);` (debe ser la primera instrucción) o tras la etiqueta de apertura
            $strict = $parser->strictTypesToken();
            $tag = $parser->openTagToken();
            $anchor = $strict ?? $tag;
            $at = $anchor === null ? 0 : $src->tokens[$anchor]->pos + strlen($src->tokens[$anchor]->text);
            // `$out` ya cambió de tamaño por las sustituciones, pero las extras van ANTES de cualquier declaración
            // (el ancla está al principio del archivo), así que el desplazamiento no afecta a esa posición.
            $out = substr($out, 0, $at) . "\n\n" . implode("\n\n", $extras) . "\n" . substr($out, $at);
        }
        return $out;
    }
}
