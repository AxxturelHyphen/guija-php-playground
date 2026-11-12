<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * contenido/temario.json: la fuente común del temario de los tres lenguajes.
 * Títulos para el árbol de archivos, equivalencias entre lenguajes, ejercicios y excepciones de paridad
 * (lo usan la interfaz, la pantalla de inicio y tests/paridad.php).
 */
final class Temario
{
    private static ?array $data = null;

    /** @return array<string,mixed> */
    public static function data(): array
    {
        if (self::$data === null) {
            $raw = @file_get_contents(PG_CONTENIDO . '/temario.json');
            $json = $raw === false ? null : json_decode($raw, true);
            self::$data = is_array($json) ? $json : ['lecciones' => []];
        }
        return self::$data;
    }

    /** Título visible de un archivo de ejemplos («04 · Recursión»), o null si no está en el temario. */
    public static function title(string $lang, string $file): ?string
    {
        foreach (self::data()['lecciones'] ?? [] as $l) {
            $e = $l[$lang] ?? null;
            if (is_array($e) && ($e['archivo'] ?? null) === $file) {
                return $e['titulo'] ?? null;
            }
        }
        return null;
    }

    /**
     * Lecciones de un lenguaje con sus ejercicios, para el progreso del alumno (acción `temario` de la API).
     * Solo datos públicos del temario: nada de código de soluciones. Un ejercicio solo aparece si existe en ese lenguaje.
     * @return list<array{id:string, tema:string, archivo:string, titulo:string, ejercicios:list<array{key:string, name:string, tipo:string, bigo:?string, medir:bool}>}>
     */
    public static function lessonsWithExercises(string $lang): array
    {
        $out = [];
        foreach (self::data()['lecciones'] ?? [] as $l) {
            $e = $l[$lang] ?? null;
            if (!is_array($e) || !isset($e['archivo'])) {
                continue;
            }
            $ejercicios = [];
            foreach ($l['ejercicios'] ?? [] as $x) {
                $key = is_array($x) ? ($x[$lang] ?? null) : null;
                if (!is_string($key) || $key === '') {
                    continue;
                }
                $tipo = (string) ($x['tipo'] ?? 'function');
                $ejercicios[] = [
                    'key' => $key,
                    'name' => $tipo === 'type' ? $key : $key . '()',
                    'tipo' => $tipo,
                    'bigo' => isset($x['bigo']) ? (string) $x['bigo'] : null,
                    'medir' => !empty($x['medir']),
                ];
            }
            $out[] = [
                'id' => (string) $l['id'], 'tema' => (string) ($l['tema'] ?? $l['id']),
                'archivo' => (string) $e['archivo'], 'titulo' => (string) ($e['titulo'] ?? $e['archivo']),
                'ejercicios' => $ejercicios,
            ];
        }
        return $out;
    }

    /** Lecciones de un lenguaje (las que tienen archivo propio), en orden. */
    public static function lessons(string $lang): array
    {
        $out = [];
        foreach (self::data()['lecciones'] ?? [] as $l) {
            $e = $l[$lang] ?? null;
            if (is_array($e) && isset($e['archivo'])) {
                $out[] = ['id' => $l['id'], 'tema' => $l['tema'] ?? $l['id']] + $e;
            }
        }
        return $out;
    }
}
