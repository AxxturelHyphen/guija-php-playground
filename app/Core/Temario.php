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
