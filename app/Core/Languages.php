<?php
declare(strict_types=1);

namespace Playground\Core;

use Playground\Lang\Java\JavaLanguage;
use Playground\Lang\Php\PhpLanguage;
use Playground\Lang\Python\PythonLanguage;

defined('PG_ROOT') or exit;

/** Registro de lenguajes. El id va en la URL (/php, /python, /java) y en la API (?lang=…). */
final class Languages
{
    public const IDS = ['php', 'python', 'java'];

    /** @var array<string, Language> */
    private static array $cache = [];

    public static function get(string $id): ?Language
    {
        if (!in_array($id, self::IDS, true)) {
            return null;
        }
        return self::$cache[$id] ??= match ($id) {
            'php' => new PhpLanguage(),
            'python' => new PythonLanguage(),
            'java' => new JavaLanguage(),
        };
    }

    /** Lenguaje por extensión de archivo (para pg.php). */
    public static function forFile(string $path): ?Language
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        foreach (self::IDS as $id) {
            $lang = self::get($id);
            if ($lang !== null && $lang->ext() === $ext) {
                return $lang;
            }
        }
        return null;
    }

    /** @return array<string, Language> */
    public static function all(): array
    {
        $out = [];
        foreach (self::IDS as $id) {
            $out[$id] = self::get($id);
        }
        return $out;
    }
}
