<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Soluciones de referencia (contenido/<lenguaje>/soluciones/), comunes a todos los lenguajes.
 *
 * Cada archivo de soluciones contiene solo declaraciones (funciones, clases, métodos) con su documentación:
 *
 *   Resumen de una línea.
 *
 *   @complejidad Tiempo O(n), espacio O(1).
 *   @explicacion Por qué es la mejor forma...
 *   @alternativas Fuerza bruta: O(n²)...
 *   @bigo n         (1 | log | n | nlogn | n2 | n3 | exp): lo comprueban los tests contra medir()
 *
 * En PHP y Java va en un docblock /** … *​/ justo antes; en Python, en el docstring.
 *
 * "Inyectar" una solución = sustituir, en el código del usuario, cada declaración por la de la solución
 * con la misma clave. Así se ejecutan los mismos tests y medir() con la versión óptima.
 */
final class Solutions
{
    public function __construct(private readonly Language $lang)
    {
    }

    /** Ruta del archivo de soluciones que corresponde a un archivo de ejercicios (mismo nombre). */
    public function pathFor(string $name): ?string
    {
        if (!preg_match($this->lang->nameRegex(), $name)) {
            return null;
        }
        $path = $this->lang->solutionsDir() . '/' . $name;
        return is_file($path) ? $path : null;
    }

    /**
     * Documentación -> {text, complejidad, explicacion, alternativas, bigo, ...}
     * Acepta docblocks (/** * … *​/), docstrings de Python ya extraídos y comentarios # o //.
     * @return array<string,string>
     */
    public static function parseDoc(?string $doc): array
    {
        if ($doc === null || trim($doc) === '') {
            return [];
        }
        $lines = preg_split('/\R/', $doc) ?: [];
        $out = ['text' => ''];
        $current = 'text';
        foreach ($lines as $line) {
            $line = (string) preg_replace('/^\s*(\/\*\*|\*\/|\*(?!\*)|\/\/+|#+|"""|\'\'\')\s?/', '', $line);
            $line = (string) preg_replace('/\s*(\*\/|"""|\'\'\')\s*$/', '', $line);
            if (preg_match('/^\s*@(\w+)\s*(.*)$/', $line, $m)) {
                $current = strtolower($m[1]);
                $out[$current] = ($out[$current] ?? '') . $m[2];
            } else {
                $out[$current] = ($out[$current] ?? '') . ($out[$current] ?? '' ? "\n" : '') . $line;
            }
        }
        return array_map(static fn(string $v): string => trim((string) preg_replace("/\n{3,}/", "\n\n", $v)), $out);
    }

    /**
     * Declaraciones de un código con su texto.
     * @return array<string, array<string,mixed>>
     */
    public function declarations(string $code): array
    {
        $out = [];
        foreach ($this->lang->declarations($code) as $key => $d) {
            $d['code'] = substr($code, (int) $d['start'], (int) $d['end'] - (int) $d['start']);
            $out[$key] = $d;
        }
        return $out;
    }

    /**
     * Lista emparejada para el panel "Solución".
     * @return list<array<string,mixed>>
     */
    public function compare(string $userCode, string $solutionCode): array
    {
        $mine = $this->declarations($userCode);
        $items = [];
        foreach ($this->declarations($solutionCode) as $key => $sol) {
            $user = $mine[$key] ?? null;
            $items[] = [
                'key' => $key,
                'name' => $sol['name'] . (in_array($sol['kind'], ['function', 'method'], true) ? '()' : ''),
                'kind' => $sol['kind'],
                'doc' => self::parseDoc($sol['doc'] ?? null),
                'solution' => ['code' => $sol['code'], 'line' => $sol['line']],
                'mine' => $user === null ? null : [
                    'code' => $user['code'],
                    'line' => $user['line'],
                    'endLine' => $user['endLine'],
                ],
                'implemented' => $user !== null && !preg_match('/\bpendiente\s*\(/i', $user['code']),
                'same' => $user !== null && ($user['norm'] ?? null) === ($sol['norm'] ?? null) && ($sol['norm'] ?? '') !== '',
            ];
        }
        return $items;
    }

    /**
     * Devuelve el código del usuario con cada declaración sustituida por la de la solución.
     * Las que la solución define y el usuario no (auxiliares) se insertan donde diga el lenguaje.
     *
     * @param ?string $only clave de una sola declaración (botón «Aplicar la solución» de un ejercicio)
     */
    public function splice(string $userCode, string $solutionCode, ?string $only = null): string
    {
        $userDecls = $this->lang->declarations($userCode);
        $edits = [];  // [offset inicio, offset fin, texto, orden]
        $seq = 0;
        foreach ($this->declarations($solutionCode) as $key => $sol) {
            if ($only !== null && $key !== $only) {
                continue;
            }
            if (isset($userDecls[$key])) {
                $d = $userDecls[$key];
                $edits[] = [(int) $d['start'], (int) $d['end'], $sol['code'], $seq++];
            } else {
                $at = $this->lang->insertionPoint($userCode, $sol);
                $edits[] = [$at, $at, "\n\n" . $sol['code'] . "\n", $seq++];
            }
        }
        // De atrás hacia delante: así los offsets que aún faltan por aplicar siguen siendo válidos.
        // A igual offset se aplica antes la de mayor orden, para que al final queden en el orden de la solución.
        usort($edits, static fn(array $a, array $b): int => [$b[0], $b[1], $b[3]] <=> [$a[0], $a[1], $a[3]]);
        $out = $userCode;
        foreach ($edits as [$from, $to, $text]) {
            $out = substr($out, 0, $from) . $text . substr($out, $to);
        }
        return $out;
    }
}
