<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Archivos de un lenguaje: ejemplos y soluciones (solo lectura, en contenido/<lenguaje>/) y prácticas
 * (lo que guarda el usuario, en practicas/<lenguaje>/). Lista blanca de carpetas y de nombres: nunca se sale de ahí.
 */
final class Files
{
    public const MAX_CODE = 400_000;

    public function __construct(private readonly Language $lang)
    {
        self::migrateLegacy($lang);
    }

    /** @return array<string,string> carpeta lógica => ruta */
    public function dirs(): array
    {
        return ['ejemplos' => $this->lang->examplesDir(), 'practicas' => $this->lang->practiceDir(), 'soluciones' => $this->lang->solutionsDir()];
    }

    public function validName(string $name): bool
    {
        return (bool) preg_match($this->lang->nameRegex(), $name);
    }

    /** Ruta de dir/name si ambos están en la lista blanca; null si no. */
    public function resolve(string $dir, string $name): ?string
    {
        $dirs = $this->dirs();
        if (!isset($dirs[$dir]) || !$this->validName($name)) {
            return null;
        }
        return $dirs[$dir] . '/' . $name;
    }

    public function tree(): array
    {
        $solutions = new Solutions($this->lang);
        $out = [];
        foreach ($this->dirs() as $dir => $path) {
            $files = [];
            foreach (glob($path . '/*.' . $this->lang->ext()) ?: [] as $f) {
                $name = basename($f);
                if (!$this->validName($name)) {
                    continue;
                }
                $files[] = [
                    'name' => $name,
                    'title' => $dir === 'practicas' ? null : Temario::title($this->lang->id(), $name),
                    'size' => (int) filesize($f),
                    'mtime' => (int) filemtime($f),
                    'solution' => $dir !== 'soluciones' && $solutions->pathFor($name) !== null,
                ];
            }
            usort($files, static fn(array $a, array $b): int => strnatcasecmp($a['name'], $b['name']));
            $out[$dir] = $files;
        }
        return $out;
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    public function read(string $dir, string $name): array
    {
        $path = $this->resolve($dir, $name);
        if ($path === null || !is_file($path)) {
            return [404, ['error' => 'No existe ese archivo']];
        }
        return [200, [
            'dir' => $dir, 'name' => $name, 'code' => (string) file_get_contents($path), 'mtime' => (int) filemtime($path),
            'title' => $dir === 'practicas' ? null : Temario::title($this->lang->id(), $name),
            'solution' => $dir !== 'soluciones' && (new Solutions($this->lang))->pathFor($name) !== null,
        ]];
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    public function save(array $b): array
    {
        $name = (string) ($b['name'] ?? '');
        $code = $b['code'] ?? null;
        $ext = $this->lang->ext();
        if (!$this->validName($name)) {
            return [400, ['error' => "Nombre no válido: usa letras, números, guion y .{$ext} (p. ej. mi-ejercicio.{$ext})"]];
        }
        if (!is_string($code) || strlen($code) > self::MAX_CODE || !mb_check_encoding($code, 'UTF-8')) {
            return [400, ['error' => 'Código no válido o demasiado grande']];
        }
        $dir = $this->lang->practiceDir();
        if (!is_dir($dir) && !@mkdir($dir, 0777, true)) {
            return [500, ['error' => 'No se pudo crear la carpeta practicas/' . $this->lang->id() . '/']];
        }
        $path = $dir . '/' . $name;
        if (is_file($path) && empty($b['overwrite'])) {
            return [409, ['error' => 'exists', 'name' => $name]];
        }
        // Escritura atómica: si se corta a medias no se pierde la versión anterior
        $tmp = $path . '.tmp' . bin2hex(random_bytes(3));
        if (file_put_contents($tmp, $code) === false || !@rename($tmp, $path)) {
            @unlink($tmp);
            return [500, ['error' => 'No se pudo guardar el archivo']];
        }
        clearstatcache(true, $path);
        return [200, ['dir' => 'practicas', 'name' => $name, 'mtime' => (int) filemtime($path)]];
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    public function delete(array $b): array
    {
        $path = $this->resolve('practicas', (string) ($b['name'] ?? ''));
        if ($path === null || !is_file($path)) {
            return [404, ['error' => 'No existe ese archivo en practicas/']];
        }
        return @unlink($path) ? [200, ['ok' => true]] : [500, ['error' => 'No se pudo borrar']];
    }

    /**
     * Antes había un solo lenguaje y las prácticas vivían en practicas/*.php: se mueven a practicas/php/
     * la primera vez (sin pisar nada que ya exista allí).
     */
    private static function migrateLegacy(Language $lang): void
    {
        static $done = false;
        if ($done || $lang->id() !== 'php') {
            return;
        }
        $done = true;
        $legacy = glob(PG_PRACTICAS . '/*.php') ?: [];
        if (!$legacy) {
            return;
        }
        $target = PG_PRACTICAS . '/php';
        if (!is_dir($target)) {
            @mkdir($target, 0777, true);
        }
        foreach ($legacy as $f) {
            $to = $target . '/' . basename($f);
            if (!file_exists($to)) {
                @rename($f, $to);
            }
        }
    }
}
