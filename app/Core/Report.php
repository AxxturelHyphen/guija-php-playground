<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/** Convierte la salida cruda de un lenguaje (Language::run) en el resultado que consume la interfaz. Común a todos. */
final class Report
{
    /** Imágenes (matplotlib) por ejecución, para no inundar la interfaz. */
    public const MAX_IMAGES = 12;

    /**
     * @param array{items:list<array<string,mixed>>, exit:int, killed:?string, wallMs:int, truncated:bool, timeout?:int, maxOutput?:int} $raw
     * @return array<string,mixed>
     */
    public static function build(array $raw, Explains $explainer): array
    {
        $segments = [];
        $problems = [];
        $tests = [];
        $benches = [];
        $end = null;
        $sawTimeout = false;
        $images = 0;
        $limit = (int) ($raw['timeout'] ?? 5);

        foreach ($raw['items'] as $item) {
            if ($item['t'] === 'out') {
                $segments[] = $item;
                continue;
            }
            $ev = $item['ev'];
            switch ($ev['t'] ?? '') {
                case 'err':
                    if (($ev['kind'] ?? '') === 'timeout') {
                        $sawTimeout = true;
                        $ev['limit'] ??= $limit;
                    }
                    $diag = $explainer->explain($ev);
                    $problems[] = $diag;
                    $segments[] = ['t' => 'diag', 'diag' => $diag];
                    break;
                case 'todo':
                    $diag = self::todo($ev);
                    $problems[] = $diag;
                    $segments[] = ['t' => 'diag', 'diag' => $diag];
                    break;
                case 'test':
                    $tests[] = $ev;
                    break;
                case 'bench':
                    if (($ev['status'] ?? '') === 'ok' && !array_key_exists('model', $ev)) {
                        $ev += Bench::fit($ev['points'] ?? []);
                    }
                    $benches[] = $ev;
                    break;
                case 'img':
                    if (++$images <= self::MAX_IMAGES && is_string($ev['data'] ?? null) && preg_match('#^image/(png|svg\+xml|jpeg)$#', (string) ($ev['mime'] ?? 'image/png'))) {
                        $segments[] = ['t' => 'img', 'mime' => $ev['mime'] ?? 'image/png', 'data' => $ev['data'], 'title' => (string) ($ev['title'] ?? '')];
                    } elseif ($images === self::MAX_IMAGES + 1) {
                        $segments[] = ['t' => 'note', 'text' => 'Hay más de ' . self::MAX_IMAGES . ' gráficas: no se muestran las siguientes.'];
                    }
                    break;
                case 'note':
                    $segments[] = ['t' => 'note', 'text' => (string) ($ev['text'] ?? '')];
                    break;
                case 'end':
                    $end = $ev;
                    break;
            }
        }

        // El proceso no pudo avisar él mismo (lo mató el servidor): se explica desde fuera.
        if ($raw['killed'] === 'timeout' && !$sawTimeout) {
            $diag = $explainer->explain(['kind' => 'timeout', 'msg' => 'Maximum execution time', 'line' => (int) ($raw['lastLine'] ?? 1), 'limit' => $limit]);
            $problems[] = $diag;
            $segments[] = ['t' => 'diag', 'diag' => $diag];
        }
        if ($raw['killed'] === 'output' || $raw['truncated']) {
            $mb = max(1, (int) round(((int) ($raw['maxOutput'] ?? Process::MAX_OUTPUT)) / 1_000_000));
            $segments[] = ['t' => 'note', 'text' => "La salida superó {$mb} MB y se cortó el programa. ¿Un bucle que imprime sin parar?"];
        }
        if ($raw['killed'] === 'launch') {
            $segments[] = ['t' => 'note', 'text' => 'No se pudo lanzar el programa. ¿Está instalado el lenguaje? Mira la pantalla de inicio para ver qué falta.'];
        }

        return [
            'segments' => $segments,
            'problems' => $problems,
            'tests' => $tests,
            'testSummary' => self::summary($tests),
            'benches' => $benches,
            'exit' => $raw['exit'],
            'killed' => $raw['killed'],
            'wallMs' => $raw['wallMs'],
            'ms' => $end['ms'] ?? $raw['wallMs'],
            'mem' => $end['mem'] ?? null,
            'peak' => $end['peak'] ?? null,
        ];
    }

    /** Respuesta de `run` cuando hay un error de sintaxis (no se lanza el proceso). */
    public static function syntaxOnly(array $diag): array
    {
        return [
            'segments' => [['t' => 'diag', 'diag' => $diag]], 'problems' => [$diag], 'tests' => [], 'testSummary' => self::summary([]),
            'benches' => [], 'exit' => 255, 'killed' => null, 'wallMs' => 0, 'ms' => 0, 'mem' => null, 'peak' => null, 'syntaxOnly' => true,
        ];
    }

    /** @param array<string,mixed> $ev */
    private static function todo(array $ev): array
    {
        $line = max(1, (int) ($ev['line'] ?? 1));
        $trace = $ev['trace'] ?? [];
        $where = $trace ? ' Se llamó desde ' . ($trace[0]['fn'] ?? '?') . ' (línea ' . ($trace[0]['line'] ?? '?') . ').' : '';
        return [
            'source' => 'runtime', 'severity' => 'info', 'code' => 'todo',
            'line' => $line, 'col' => 1, 'endLine' => $line, 'endCol' => 1000,
            'title' => 'Ejercicio sin implementar',
            'message' => 'Ejercicio sin implementar',
            'explain' => 'El código llegó a un `pendiente()`: ese ejercicio todavía no está resuelto.' . $where . ' Sustituye el `pendiente()` por tu solución y vuelve a ejecutar.',
            'original' => (string) ($ev['msg'] ?? ''),
            'trace' => $trace,
        ];
    }

    /** @param list<array<string,mixed>> $tests */
    public static function summary(array $tests): array
    {
        $s = ['pass' => 0, 'fail' => 0, 'error' => 0, 'todo' => 0, 'total' => 0];
        foreach ($tests as $t) {
            $st = $t['status'] ?? '';
            if (isset($s[$st])) {
                $s[$st] += $st === 'todo' ? (int) ($t['total'] ?? 1) : 1;
            }
        }
        $s['total'] = $s['pass'] + $s['fail'] + $s['error'] + $s['todo'];
        return $s;
    }
}
