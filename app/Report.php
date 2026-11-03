<?php
declare(strict_types=1);

namespace Playground;

defined('PG_ROOT') or exit;

/** Convierte la salida cruda del Runner en el resultado que consume la interfaz. */
final class Report
{
    /**
     * @param array{items:list<array<string,mixed>>, exit:int, killed:?string, wallMs:int, truncated:bool} $raw
     * @return array<string,mixed>
     */
    public static function build(array $raw, Explainer $explainer): array
    {
        $segments = [];
        $problems = [];
        $tests = [];
        $benches = [];
        $end = null;
        $sawTimeout = false;

        foreach ($raw['items'] as $item) {
            if ($item['t'] === 'out') {
                $segments[] = $item;
                continue;
            }
            $ev = $item['ev'];
            switch ($ev['t'] ?? '') {
                case 'err':
                    $sawTimeout = $sawTimeout || ($ev['kind'] ?? '') === 'timeout';
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
                    $benches[] = $ev;
                    break;
                case 'end':
                    $end = $ev;
                    break;
            }
        }

        // El proceso no pudo avisar él mismo (lo mató el Runner): se explica desde fuera.
        if ($raw['killed'] === 'timeout' && !$sawTimeout) {
            $diag = $explainer->explain(['kind' => 'timeout', 'msg' => 'Maximum execution time', 'line' => 1]);
            $problems[] = $diag;
            $segments[] = ['t' => 'diag', 'diag' => $diag];
        }
        if ($raw['killed'] === 'output' || $raw['truncated']) {
            $segments[] = ['t' => 'note', 'text' => 'La salida superó 1 MB y se cortó el programa. ¿Un bucle que imprime sin parar?'];
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
            'explain' => 'El código llegó a un `pendiente();`: ese ejercicio todavía no está resuelto.' . $where . ' Sustituye el `pendiente();` por tu solución y vuelve a ejecutar.',
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
