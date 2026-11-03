<?php
declare(strict_types=1);

namespace Playground;

defined('PG_ROOT') or exit;

/**
 * Ejecuta código PHP en un proceso aparte (php.exe) con el harness precargado.
 *
 * La salida del hijo va a un archivo temporal y no a un pipe: en Windows los pipes de proc_open
 * no admiten lectura no bloqueante, y con un archivo basta con sondear hasta que termine o venza el plazo.
 */
final class Runner
{
    public const MAX_OUTPUT = 1_000_000;   // bytes de salida antes de cortar el proceso
    public const MAX_TIMEOUT = 120;
    private const POLL_US = 8_000;

    /**
     * @param array{timeout?:int, stdin?:string, bench?:bool, benchBudgetMs?:int} $opts
     * @return array{items:list<array<string,mixed>>, exit:int, killed:?string, wallMs:int, truncated:bool}
     */
    public function run(string $code, string $displayName, array $opts = []): array
    {
        $timeout = max(1, min(self::MAX_TIMEOUT, (int) ($opts['timeout'] ?? 5)));
        $dir = self::tempDir();
        $id = bin2hex(random_bytes(6));
        $file = "{$dir}/pg_{$id}.php";
        $stdin = "{$dir}/pg_{$id}.in";
        $stdout = "{$dir}/pg_{$id}.out";

        file_put_contents($file, $code);
        file_put_contents($stdin, (string) ($opts['stdin'] ?? ''));
        file_put_contents($stdout, '');

        $env = [];
        foreach (getenv() as $k => $v) {
            if (is_string($k) && is_string($v) && !str_starts_with($k, '=')) {
                $env[$k] = $v;
            }
        }
        $env['PG_BENCH'] = !empty($opts['bench']) ? '1' : '0';
        if (isset($opts['benchBudgetMs'])) {
            $env['PG_BENCH_BUDGET_MS'] = (string) (int) $opts['benchBudgetMs'];
        }

        if (!is_dir(PG_PRACTICAS)) {
            @mkdir(PG_PRACTICAS, 0777, true);
        }

        $cmd = [
            PHP_BINARY,
            '-d', 'display_errors=stderr', '-d', 'log_errors=0', '-d', 'html_errors=0', '-d', 'error_reporting=-1',
            '-d', 'memory_limit=128M', '-d', 'max_execution_time=' . $timeout,
            // PHP 8.5+ añade una traza a los errores fatales: con una recursión infinita (~1M de frames)
            // construirla gastaba ~800 MB y ~12 s. Medido: con esto, 46 MB y 0,3 s.
            '-d', 'fatal_error_backtraces=0',
            '-d', 'auto_prepend_file=' . __DIR__ . DIRECTORY_SEPARATOR . 'harness.php',
            $file,
        ];

        $start = hrtime(true);
        $proc = @proc_open($cmd, [0 => ['file', $stdin, 'r'], 1 => ['file', $stdout, 'w'], 2 => ['redirect', 1]], $pipes, PG_PRACTICAS, $env);
        if (!is_resource($proc)) {
            self::cleanup($file, $stdin, $stdout);
            return ['items' => [['t' => 'out', 'text' => 'No se pudo lanzar php.exe']], 'exit' => -1, 'killed' => null, 'wallMs' => 0, 'truncated' => false];
        }

        // El propio PHP corta a los $timeout s con un error bonito; esto es la red de seguridad por si no puede.
        $deadline = $start + ($timeout + 2) * 1_000_000_000;
        $exit = -1;
        $killed = null;
        while (true) {
            $st = proc_get_status($proc);
            if (!$st['running']) {
                $exit = (int) $st['exitcode'];
                break;
            }
            clearstatcache(true, $stdout);
            if ((int) @filesize($stdout) > self::MAX_OUTPUT) {
                $killed = 'output';
                proc_terminate($proc);
                break;
            }
            if (hrtime(true) > $deadline) {
                $killed = 'timeout';
                proc_terminate($proc);
                break;
            }
            usleep(self::POLL_US);
        }
        $closeExit = proc_close($proc);
        if ($killed !== null || $exit === -1) {
            $exit = $killed !== null ? 255 : $closeExit;
        }
        $wallMs = intdiv(hrtime(true) - $start, 1_000_000);

        $raw = (string) @file_get_contents($stdout, false, null, 0, self::MAX_OUTPUT + 1);
        $truncated = strlen($raw) > self::MAX_OUTPUT;
        if ($truncated) {
            $raw = substr($raw, 0, self::MAX_OUTPUT);
        }
        self::cleanup($file, $stdin, $stdout);

        $items = self::split($raw);
        $needles = array_values(array_unique([$file, str_replace('\\', '/', $file), "pg_{$id}.php"]));
        $items = self::scrub($items, $needles, $displayName);
        $items = self::absorbFatals($items, $displayName);

        return ['items' => $items, 'exit' => $exit, 'killed' => $killed, 'wallMs' => $wallMs, 'truncated' => $truncated];
    }

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
            $s = strpos($raw, "\x1ePG", $pos);
            if ($s === false) {
                $items[] = ['t' => 'out', 'text' => substr($raw, $pos)];
                break;
            }
            if ($s > $pos) {
                $items[] = ['t' => 'out', 'text' => substr($raw, $pos, $s - $pos)];
            }
            $e = strpos($raw, "\x1f", $s + 3);
            if ($e === false) {
                break; // evento cortado (proceso terminado a mitad de escritura)
            }
            $ev = json_decode(substr($raw, $s + 3, $e - $s - 3), true);
            if (is_array($ev) && ($ev['t'] ?? '') !== 'noop') {
                $items[] = ['t' => 'ev', 'ev' => $ev];
            }
            $pos = $e + 1;
        }
        return $items;
    }

    private const PHP_FATAL_LINE = '/^[ 	]*(?:PHP )?(Fatal error|Parse error):[ 	]*(.*) in (.+?) on line (\d+)[ 	]*(?:?
|$)/m';

    /**
     * PHP imprime él mismo los errores fatales (display_errors=stderr, mezclado con la salida).
     * Tras agotar la memoria no puede ni llamar a la función de cierre del harness, así que ese texto es la única
     * pista: si el harness no avisó, se convierte en evento; si ya lo hizo, se quita para no duplicarlo.
     *
     * @param list<array<string,mixed>> $items
     * @return list<array<string,mixed>>
     */
    private static function absorbFatals(array $items, string $name): array
    {
        $hasEvent = false;
        foreach ($items as $it) {
            if ($it['t'] === 'ev' && ($it['ev']['t'] ?? '') === 'err'
                && in_array($it['ev']['kind'] ?? '', ['fatal', 'parse', 'timeout', 'memory', 'exception'], true)) {
                $hasEvent = true;
                break;
            }
        }
        $synth = null;
        foreach ($items as $k => $it) {
            if ($it['t'] !== 'out') {
                continue;
            }
            $matched = false;
            $text = (string) preg_replace_callback(self::PHP_FATAL_LINE, static function (array $m) use (&$synth, &$matched): string {
                $matched = true;
                if ($synth === null) {
                    $msg = trim($m[2]);
                    $synth = [
                        'kind' => match (true) {
                            $m[1] === 'Parse error' => 'parse',
                            str_starts_with($msg, 'Maximum execution time') => 'timeout',
                            str_starts_with($msg, 'Allowed memory size'), str_contains($msg, 'Maximum call stack size') => 'memory',
                            default => 'fatal',
                        },
                        'msg' => $msg, 'line' => (int) $m[4],
                    ];
                }
                return '';
            }, $it['text']);
            if ($matched) {
                if (trim($text) === '') {
                    unset($items[$k]);
                } else {
                    $items[$k]['text'] = $text;
                }
            }
        }
        $items = array_values($items);
        if ($synth !== null && !$hasEvent) {
            $items[] = ['t' => 'ev', 'ev' => ['t' => 'err', 'file' => $name] + $synth];
        }
        return $items;
    }

    /** Cambia la ruta del archivo temporal por el nombre que ve el usuario, en texto y en eventos. */
    private static function scrub(mixed $v, array $needles, string $name): mixed
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

    public static function tempDir(): string
    {
        $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'guija-playground';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
            return $dir;
        }
        // Limpieza de restos de ejecuciones que murieron (más de 1 hora)
        foreach (glob($dir . DIRECTORY_SEPARATOR . 'pg_*') ?: [] as $f) {
            if (@filemtime($f) < time() - 3600) {
                @unlink($f);
            }
        }
        return $dir;
    }

    private static function cleanup(string ...$files): void
    {
        foreach ($files as $f) {
            @unlink($f);
        }
    }

    /**
     * Comprobación de sintaxis en el mismo proceso (sin lanzar php.exe): el parser de PHP lanza ParseError.
     * @return ?array{kind:string, msg:string, line:int}
     */
    public static function syntaxError(string $code): ?array
    {
        try {
            \PhpToken::tokenize($code, TOKEN_PARSE);
            return null;
        } catch (\ParseError $e) {
            return ['kind' => 'parse', 'msg' => $e->getMessage(), 'line' => $e->getLine()];
        }
    }
}
