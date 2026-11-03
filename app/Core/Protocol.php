<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Protocolo harness → servidor, idéntico en PHP, Python y Java:
 * los eventos van por stdout entre marcas de control, mezclados con la salida normal del programa:
 *
 *     \x1ePG{json}\x1f
 *
 * Así se conserva el orden real en que ocurrieron (un print, luego un error, luego otro print…).
 */
final class Protocol
{
    public const START = "\x1ePG";
    public const END = "\x1f";

    /**
     * Separa la salida en texto y eventos del harness, conservando el orden.
     * @return list<array<string,mixed>>
     */
    public static function split(string $raw): array
    {
        $items = [];
        $pos = 0;
        $len = strlen($raw);
        while ($pos < $len) {
            $s = strpos($raw, self::START, $pos);
            if ($s === false) {
                $items[] = ['t' => 'out', 'text' => substr($raw, $pos)];
                break;
            }
            if ($s > $pos) {
                $items[] = ['t' => 'out', 'text' => substr($raw, $pos, $s - $pos)];
            }
            $e = strpos($raw, self::END, $s + 3);
            if ($e === false) {
                break; // evento cortado (proceso terminado a mitad de escritura)
            }
            $ev = json_decode(substr($raw, $s + 3, $e - $s - 3), true);
            if (is_array($ev) && ($ev['t'] ?? '') !== 'noop') {
                $items[] = ['t' => 'ev', 'ev' => $ev];
            }
            $pos = $e + 1;
        }
        // El texto puede no ser UTF-8 válido (un programa que imprime bytes): se sanea para el JSON
        foreach ($items as $k => $it) {
            if ($it['t'] === 'out' && !mb_check_encoding($it['text'], 'UTF-8')) {
                $items[$k]['text'] = mb_convert_encoding($it['text'], 'UTF-8', 'UTF-8');
            }
        }
        return $items;
    }

    /**
     * Cambia las rutas temporales por el nombre que ve el usuario, en texto y en eventos.
     * @param list<string> $needles
     */
    public static function scrub(mixed $v, array $needles, string $name): mixed
    {
        if (is_string($v)) {
            return str_replace($needles, $name, $v);
        }
        if (is_array($v)) {
            foreach ($v as $k => $x) {
                $v[$k] = self::scrub($x, $needles, $name);
            }
        }
        return $v;
    }

    /** Variantes de una ruta que pueden aparecer en mensajes (con / o \, y solo el nombre). */
    public static function pathNeedles(string $file): array
    {
        $real = realpath($file) ?: $file;
        return array_values(array_unique(array_filter([
            $file, $real, str_replace('\\', '/', $file), str_replace('\\', '/', $real), str_replace('/', '\\', $file), basename($file),
        ], static fn($s) => $s !== '')));
    }
}
