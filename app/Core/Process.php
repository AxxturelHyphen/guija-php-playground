<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Lanza un proceso hijo (php, python, java…) con límites de tiempo y de salida. Común a todos los lenguajes.
 *
 * La salida del hijo va a un archivo temporal y no a un pipe: en Windows los pipes de proc_open no admiten lectura
 * no bloqueante, y con un archivo basta con sondear hasta que termine o venza el plazo. stderr se mezcla con stdout
 * (los harness escriben sus eventos por stdout, y así el orden se conserva).
 */
final class Process
{
    public const MAX_OUTPUT = 1_000_000;   // bytes de salida antes de cortar el proceso
    public const MAX_TIMEOUT = 120;
    private const POLL_US = 8_000;

    /**
     * @param list<string> $cmd
     * @param array{stdin?:string, timeout?:int, grace?:int, env?:array<string,?string>, cwd?:string, maxOutput?:int} $o
     *        timeout: segundos de reloj; grace: margen extra (el propio harness corta antes con un error bonito)
     * @return array{raw:string, exit:int, killed:?string, wallMs:int, truncated:bool}
     */
    public static function run(array $cmd, array $o = []): array
    {
        $timeout = max(1, min(self::MAX_TIMEOUT, (int) ($o['timeout'] ?? 5)));
        $grace = max(0, (int) ($o['grace'] ?? 2));
        $maxOutput = (int) ($o['maxOutput'] ?? self::MAX_OUTPUT);
        $dir = self::tempDir();
        $id = bin2hex(random_bytes(6));
        $stdin = "{$dir}/pgio_{$id}.in";
        $stdout = "{$dir}/pgio_{$id}.out";
        file_put_contents($stdin, (string) ($o['stdin'] ?? ''));
        file_put_contents($stdout, '');

        $cwd = $o['cwd'] ?? null;
        if ($cwd !== null && !is_dir($cwd)) {
            @mkdir($cwd, 0777, true);
        }
        $env = self::env($o['env'] ?? []);

        $start = hrtime(true);
        $proc = @proc_open($cmd, [0 => ['file', $stdin, 'r'], 1 => ['file', $stdout, 'w'], 2 => ['redirect', 1]], $pipes, $cwd, $env, ['bypass_shell' => true]);
        if (!is_resource($proc)) {
            @unlink($stdin);
            @unlink($stdout);
            return ['raw' => '', 'exit' => -1, 'killed' => 'launch', 'wallMs' => 0, 'truncated' => false];
        }

        $deadline = $start + ($timeout + $grace) * 1_000_000_000;
        $exit = -1;
        $killed = null;
        while (true) {
            $st = proc_get_status($proc);
            if (!$st['running']) {
                $exit = (int) $st['exitcode'];
                break;
            }
            clearstatcache(true, $stdout);
            if ((int) @filesize($stdout) > $maxOutput) {
                $killed = 'output';
                self::kill($proc, (int) $st['pid']);
                break;
            }
            if (hrtime(true) > $deadline) {
                $killed = 'timeout';
                self::kill($proc, (int) $st['pid']);
                break;
            }
            usleep(self::POLL_US);
        }
        $closeExit = proc_close($proc);
        if ($killed !== null || $exit === -1) {
            $exit = $killed !== null ? 255 : $closeExit;
        }
        $wallMs = intdiv(hrtime(true) - $start, 1_000_000);

        $raw = (string) @file_get_contents($stdout, false, null, 0, $maxOutput + 1);
        $truncated = strlen($raw) > $maxOutput;
        if ($truncated) {
            $raw = substr($raw, 0, $maxOutput);
        }
        @unlink($stdin);
        @unlink($stdout);
        return ['raw' => $raw, 'exit' => $exit, 'killed' => $killed, 'wallMs' => $wallMs, 'truncated' => $truncated];
    }

    /**
     * Mata el proceso y, en Windows, también sus hijos (java.exe lanzado por un .cmd, por ejemplo).
     * @param resource $proc
     */
    private static function kill($proc, int $pid): void
    {
        if (DIRECTORY_SEPARATOR === '\\' && $pid > 0) {
            @exec('taskkill /F /T /PID ' . $pid . ' >NUL 2>&1');
        }
        @proc_terminate($proc, 9);
    }

    /**
     * Entorno heredado + variables extra (una variable a null se quita del entorno del hijo).
     * @param array<string,?string> $extra
     * @return array<string,string>
     */
    public static function env(array $extra = []): array
    {
        $env = [];
        foreach (getenv() as $k => $v) {
            if (is_string($k) && is_string($v) && !str_starts_with($k, '=')) {
                $env[$k] = $v;
            }
        }
        foreach ($extra as $k => $v) {
            if ($v === null) {
                unset($env[$k]);
            } else {
                $env[$k] = $v;
            }
        }
        return $env;
    }

    /** Carpeta temporal del playground (se limpian restos de más de 1 hora). */
    public static function tempDir(): string
    {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'guija-playground';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
            return $dir;
        }
        static $cleaned = false;
        if (!$cleaned) {
            $cleaned = true;
            foreach (glob($dir . DIRECTORY_SEPARATOR . 'pg*') ?: [] as $f) {
                if (@filemtime($f) < time() - 3600) {
                    is_dir($f) ? self::rmTree($f) : @unlink($f);
                }
            }
        }
        return $dir;
    }

    /** Carpeta temporal propia para una ejecución (p. ej. para compilar Java). */
    public static function makeTempDir(string $prefix = 'pgdir_'): string
    {
        $d = self::tempDir() . DIRECTORY_SEPARATOR . $prefix . bin2hex(random_bytes(6));
        @mkdir($d, 0777, true);
        return $d;
    }

    public static function rmTree(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $f) {
            if ($f === '.' || $f === '..') {
                continue;
            }
            $p = $dir . DIRECTORY_SEPARATOR . $f;
            is_dir($p) && !is_link($p) ? self::rmTree($p) : @unlink($p);
        }
        @rmdir($dir);
    }

    /**
     * Busca un ejecutable en el PATH (y prueba .exe/.cmd/.bat en Windows). Devuelve la ruta o null.
     */
    public static function which(string $name): ?string
    {
        $exts = DIRECTORY_SEPARATOR === '\\' ? ['.exe', '.cmd', '.bat', ''] : [''];
        if (str_contains($name, '/') || str_contains($name, '\\')) {
            foreach ($exts as $e) {
                if (is_file($name . $e)) {
                    return $name . $e;
                }
            }
            return null;
        }
        foreach (explode(PATH_SEPARATOR, (string) getenv('PATH')) as $dir) {
            if ($dir === '') {
                continue;
            }
            foreach ($exts as $e) {
                $p = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $name . $e;
                if (is_file($p) && (DIRECTORY_SEPARATOR === '\\' || is_executable($p))) {
                    return $p;
                }
            }
        }
        return null;
    }
}
