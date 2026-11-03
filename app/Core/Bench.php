<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Lo que se hace con las mediciones de medir(), igual para todos los lenguajes:
 *  - fit(): qué modelo de complejidad explica mejor los tiempos;
 *  - series()/verdict(): «Comparar» tu versión con la de referencia.
 *
 * Los harness solo emiten los puntos [n, ms]; el ajuste se hace aquí para que PHP, Python y Java den
 * exactamente el mismo veredicto con los mismos datos.
 */
final class Bench
{
    public const ORDER = ['1', 'log', 'n', 'nlogn', 'n2', 'n3', 'exp'];

    /**
     * Elige el modelo (1, log n, n, n log n, n², n³, 2ⁿ) cuyo cociente t/f(n) es más constante.
     *
     * @param list<array{0:int|float,1:float}> $points [n, ms]
     * @return array{model:?string, label:?string, sd:?float, slope:?float}
     */
    public static function fit(array $points): array
    {
        $pts = array_values(array_filter($points, static fn($p) => is_array($p) && count($p) >= 2 && $p[0] >= 2));
        if (count($pts) < 3) {
            return ['model' => null, 'label' => null, 'sd' => null, 'slope' => null];
        }
        $models = [
            '1' => ['O(1)', static fn(float $n) => 0.0],
            'log' => ['O(log n)', static fn(float $n) => log(log($n))],
            'n' => ['O(n)', static fn(float $n) => log($n)],
            'nlogn' => ['O(n log n)', static fn(float $n) => log($n) + log(log($n))],
            'n2' => ['O(n²)', static fn(float $n) => 2 * log($n)],
            'n3' => ['O(n³)', static fn(float $n) => 3 * log($n)],
            'exp' => ['O(2ⁿ)', static fn(float $n) => $n * M_LN2],
        ];
        $best = null;
        $bestSd = INF;
        foreach ($models as $key => [$label, $lf]) {
            $r = [];
            foreach ($pts as [$n, $t]) {
                $r[] = log(max((float) $t, 1e-7)) - $lf((float) $n);
            }
            $mean = array_sum($r) / count($r);
            $sd = sqrt(array_sum(array_map(static fn($x) => ($x - $mean) ** 2, $r)) / count($r));
            // Un modelo más complejo debe ajustar claramente mejor para ganar
            if ($best === null || $sd < $bestSd * 0.85) {
                $best = $key;
                $bestSd = $sd;
            }
        }

        // Pendiente log-log: el exponente aproximado
        $xs = array_map(static fn($p) => log((float) $p[0]), $pts);
        $ys = array_map(static fn($p) => log(max((float) $p[1], 1e-7)), $pts);
        $mx = array_sum($xs) / count($xs);
        $my = array_sum($ys) / count($ys);
        $num = $den = 0.0;
        foreach ($xs as $i => $x) {
            $num += ($x - $mx) * ($ys[$i] - $my);
            $den += ($x - $mx) ** 2;
        }
        $slope = $den > 0 ? $num / $den : null;

        return [
            'model' => $best, 'label' => $models[$best][0], 'sd' => round($bestSd, 3),
            'slope' => $slope !== null ? round($slope, 2) : null,
        ];
    }

    /**
     * Empareja los medir() de ambas ejecuciones por nombre y redacta el veredicto.
     * @param list<array<string,mixed>> $mine
     * @param list<array<string,mixed>> $best
     * @return list<array<string,mixed>>
     */
    public static function series(array $mine, array $best): array
    {
        $bestBy = [];
        foreach ($best as $e) {
            $bestBy[$e['name']] = $e;
        }
        $out = [];
        foreach ($mine as $m) {
            $s = $bestBy[$m['name']] ?? null;
            $row = ['name' => $m['name'], 'mine' => $m, 'best' => $s, 'verdict' => null, 'ratio' => null, 'n' => null, 'level' => 'info'];
            if (($m['status'] ?? '') === 'todo') {
                $row['verdict'] = 'Todavía no has implementado esta función: sin ella no hay nada que medir.';
            } elseif (($m['status'] ?? '') !== 'ok' || $s === null || ($s['status'] ?? '') !== 'ok') {
                $row['verdict'] = ($m['status'] ?? '') === 'error'
                    ? 'No se pudo medir tu versión: ' . ($m['msg'] ?? '')
                    : 'No hay medición para comparar.';
                $row['level'] = 'warning';
            } else {
                [$row['verdict'], $row['ratio'], $row['n'], $row['level']] = self::verdict($m, $s);
            }
            $out[] = $row;
        }
        return $out;
    }

    /** @return array{0:string, 1:?float, 2:?int, 3:string} */
    private static function verdict(array $m, array $s): array
    {
        $mine = [];
        foreach ($m['points'] as [$n, $t]) {
            $mine[(int) $n] = (float) $t;
        }
        $best = [];
        foreach ($s['points'] as [$n, $t]) {
            $best[(int) $n] = (float) $t;
        }
        $common = array_values(array_intersect(array_keys($mine), array_keys($best)));
        sort($common);
        $mLabel = $m['label'] ?? '?';
        $sLabel = $s['label'] ?? '?';
        if (!$common) {
            return ["Tuya ~{$mLabel}, óptima {$sLabel}. No se pudo medir el mismo tamaño en ambas.", null, null, 'info'];
        }
        $n = (int) end($common);
        $tm = $mine[$n];
        $ts = $best[$n];
        $ratio = $ts > 0 ? $tm / $ts : null;
        $same = $mLabel === $sLabel;
        $head = $same ? "Misma complejidad (~{$mLabel})" : "Tuya ~{$mLabel}, óptima {$sLabel}";
        $times = 'en n=' . self::num($n) . ', ' . self::ms($tm) . ' frente a ' . self::ms($ts);
        if ($ratio === null || $ratio < 1.5) {
            $text = $same ? "{$head}: {$times}. Vas al ritmo de la solución de referencia." : "{$head}: {$times}.";
            return [$text, $ratio, $n, 'ok'];
        }
        $x = $ratio >= 10 ? self::num((int) round($ratio)) : str_replace('.', ',', (string) round($ratio, 1));
        $level = (!$same || $ratio >= 5) ? 'warning' : 'info';
        return ["{$head}: {$times}, ×{$x}.", $ratio, $n, $level];
    }

    public static function num(int $n): string
    {
        return number_format($n, 0, ',', '.');
    }

    public static function ms(float $ms): string
    {
        if ($ms < 0.001) {
            return '<1 µs';
        }
        if ($ms < 1) {
            return str_replace('.', ',', (string) round($ms * 1000, $ms * 1000 < 10 ? 1 : 0)) . ' µs';
        }
        if ($ms < 1000) {
            return str_replace('.', ',', (string) round($ms, $ms < 10 ? 1 : 0)) . ' ms';
        }
        return str_replace('.', ',', (string) round($ms / 1000, 2)) . ' s';
    }
}
