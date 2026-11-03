<?php
declare(strict_types=1);

/**
 * Tiempos de respuesta que percibe el usuario, por lección y lenguaje, frente a la versión PHP (la de referencia).
 *
 *   php tests/tiempos.php [--lang=python|java] [--veces=5] [--medir]
 *
 * Por cada lección del temario mide el p50 de:
 *   - ejecutar (lo que hace Ctrl+Enter: comprobar la sintaxis + run + Report)
 *   - lint (el análisis en vivo mientras escribes)
 *   - con --medir: Medir (Ctrl+Alt+Enter), que por diseño tarda lo mismo en todos (mismo presupuesto de tiempo)
 *
 * Objetivos (los del plan): ejecutar p50 ≤ max(1,5 × PHP, PHP + 400 ms); lint Python ≤ 300 ms; lint Java ≤ 150 ms.
 * Código de salida 1 si algún objetivo no se cumple.
 */
require_once dirname(__DIR__) . '/app/bootstrap.php';

use Playground\Core\{Languages, Report, Temario};

$only = null;
$times = 5;
$withBench = false;
foreach (array_slice($argv, 1) as $a) {
    if (str_starts_with($a, '--lang=')) {
        $only = substr($a, 7);
    } elseif (str_starts_with($a, '--veces=')) {
        $times = max(1, (int) substr($a, 8));
    } elseif ($a === '--medir') {
        $withBench = true;
    }
}

const LINT_TARGET = ['php' => 300, 'python' => 300, 'java' => 150];

function p50(array $xs): float
{
    sort($xs);
    $n = count($xs);
    return $n === 0 ? 0.0 : ($n % 2 ? $xs[intdiv($n, 2)] : ($xs[$n / 2 - 1] + $xs[$n / 2]) / 2);
}

/** @return array{run:float, lint:float, bench:?float} milisegundos */
function measure(string $langId, string $file, int $times, bool $withBench): ?array
{
    $lang = Languages::get($langId);
    $path = $lang->examplesDir() . '/' . $file;
    if (!is_file($path)) {
        return null;
    }
    $code = (string) file_get_contents($path);
    $run = $lint = [];
    // Una ejecución de calentamiento (cachés del intérprete, compilador residente de Java...) que no cuenta
    $lang->syntaxError($code);
    $lang->run($code, $lang->displayName('tu_codigo'), ['timeout' => 30]);
    for ($i = 0; $i < $times; $i++) {
        $t0 = hrtime(true);
        $lang->analyse($code);
        $lint[] = (hrtime(true) - $t0) / 1e6;

        $t0 = hrtime(true);
        if ($lang->syntaxError($code) === null) {
            Report::build($lang->run($code, $lang->displayName('tu_codigo'), ['timeout' => 30]), $lang->explainer($code));
        }
        $run[] = (hrtime(true) - $t0) / 1e6;
    }
    $bench = null;
    if ($withBench) {
        $t0 = hrtime(true);
        Report::build($lang->run($code, $lang->displayName('tu_codigo'), ['timeout' => 60, 'bench' => true]), $lang->explainer($code));
        $bench = (hrtime(true) - $t0) / 1e6;
    }
    return ['run' => p50($run), 'lint' => p50($lint), 'bench' => $bench];
}

$fail = 0;
$fmt = static fn(?float $ms): string => $ms === null ? '—' : number_format($ms, 0, ',', '.') . ' ms';
printf("%-10s %-34s %10s %10s %10s   %s\n", 'lenguaje', 'lección', 'ejecutar', 'lint', 'medir', 'frente a PHP');
foreach (Temario::data()['lecciones'] ?? [] as $l) {
    $phpFile = $l['php']['archivo'] ?? null;
    $php = $phpFile !== null ? measure('php', $phpFile, $times, $withBench) : null;
    foreach (Languages::IDS as $langId) {
        if (($only !== null && $only !== $langId && $langId !== 'php') || !isset($l[$langId]['archivo'])) {
            continue;
        }
        $m = $langId === 'php' ? $php : measure($langId, $l[$langId]['archivo'], $times, $withBench);
        if ($m === null) {
            continue;
        }
        $verdict = '';
        $ok = true;
        if ($langId !== 'php' && $php !== null) {
            $limit = max(1.5 * $php['run'], $php['run'] + 400);
            $ok = $m['run'] <= $limit;
            $verdict = sprintf('ejecutar ×%.1f (límite %s)', $php['run'] > 0 ? $m['run'] / $php['run'] : 0, $fmt($limit));
        }
        if ($m['lint'] > LINT_TARGET[$langId]) {
            $ok = false;
            $verdict .= ' · lint por encima de ' . LINT_TARGET[$langId] . ' ms';
        }
        $fail += (int) !$ok;
        printf("%-10s %-34s %10s %10s %10s   %s%s\n", $langId, $l[$langId]['archivo'], $fmt($m['run']), $fmt($m['lint']), $fmt($m['bench']), $verdict, $ok ? '' : '  ✗');
    }
}
echo $fail ? "\n{$fail} lecciones fuera de objetivo\n" : "\nTIEMPOS OK\n";
exit($fail ? 1 : 0);
