<?php
declare(strict_types=1);

namespace Playground\Lang\Php;

use Playground\Core\Process;
use Playground\Core\Protocol;

defined('PG_ROOT') or exit;

/**
 * Ejecuta código PHP en un proceso aparte (php.exe) con el harness precargado (auto_prepend_file).
 * El bucle de proceso, los límites y el protocolo de eventos son los comunes (Core\Process, Core\Protocol).
 */
final class PhpRunner
{
    /**
     * @param array{timeout?:int, stdin?:string, bench?:bool, benchBudgetMs?:int} $opts
     * @return array{items:list<array<string,mixed>>, exit:int, killed:?string, wallMs:int, truncated:bool, timeout:int}
     */
    public function run(string $code, string $displayName, array $opts = []): array
    {
        $timeout = max(1, min(Process::MAX_TIMEOUT, (int) ($opts['timeout'] ?? 5)));
        $file = Process::tempDir() . DIRECTORY_SEPARATOR . 'pg_' . bin2hex(random_bytes(6)) . '.php';
        file_put_contents($file, $code);

        $env = ['PG_BENCH' => !empty($opts['bench']) ? '1' : '0'];
        if (isset($opts['benchBudgetMs'])) {
            $env['PG_BENCH_BUDGET_MS'] = (string) (int) $opts['benchBudgetMs'];
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
        // El propio PHP corta a los $timeout s con un error bonito; el reloj del Process es la red de seguridad.
        $res = Process::run($cmd, [
            'stdin' => (string) ($opts['stdin'] ?? ''), 'timeout' => $timeout, 'grace' => 2,
            'env' => $env, 'cwd' => PG_PRACTICAS . '/php',
        ]);
        @unlink($file);
        if ($res['killed'] === 'launch') {
            return ['items' => [['t' => 'out', 'text' => 'No se pudo lanzar php.exe']], 'exit' => -1, 'killed' => null, 'wallMs' => 0, 'truncated' => false, 'timeout' => $timeout];
        }

        $items = Protocol::split($res['raw']);
        $items = Protocol::scrub($items, Protocol::pathNeedles($file), $displayName);
        $items = self::absorbFatals($items, $displayName);
        return ['items' => $items, 'exit' => $res['exit'], 'killed' => $res['killed'], 'wallMs' => $res['wallMs'], 'truncated' => $res['truncated'], 'timeout' => $timeout];
    }

    private const PHP_FATAL_LINE = '/^[ 	]*(?:PHP )?(Fatal error|Parse error):[ 	]*(.*) in (.+?) on line (\d+)[ 	]*(?:
?
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

    /**
     * Comprobación de sintaxis en el mismo proceso (sin lanzar php.exe): el parser de PHP lanza ParseError.
     * @return ?array{kind:string, msg:string, line:int}
     */
    public static function syntaxError(string $code): ?array
    {
        try {
            \PhpToken::tokenize($code, TOKEN_PARSE);
            return null;
        } catch (\CompileError $e) {
            // ParseError (sintaxis) o CompileError (p. ej. sintaxis de una versión de PHP más nueva que la instalada)
            return ['kind' => 'parse', 'msg' => $e->getMessage(), 'line' => $e->getLine()];
        }
    }
}
