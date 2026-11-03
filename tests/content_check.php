<?php
declare(strict_types=1);

/**
 * Comprueba el contenido didáctico:
 *   1. cada ejemplo se ejecuta sin errores, warnings ni deprecations (los ejercicios sin hacer salen como "pendiente");
 *   2. con su solución inyectada, TODAS las pruebas pasan;
 *   3. lo que mide medir() coincide (±1 clase) con el @bigo de la solución;
 *   4. la solución tiene @complejidad y @explicacion en cada declaración.
 *
 * Uso: php tests/content_check.php [prefijo, p. ej. 04]   (sin argumento: todos)
 * Devuelve código 1 si algo falla. Lo reutiliza tests/run.php.
 */
require_once dirname(__DIR__) . '/app/bootstrap.php';

use Playground\{Explainer, Report, Runner, Solutions};
use Playground\Analysis\{Parser, Source};

const BIGO_ORDER = ['1', 'log', 'n', 'nlogn', 'n2', 'n3', 'exp'];

function content_check(?string $prefix = null, bool $verbose = true): array
{
    $failures = [];
    $log = static function (string $s) use ($verbose): void {
        if ($verbose) {
            echo $s, "\n";
        }
    };
    $runner = new Runner();
    $files = glob(PG_EJEMPLOS . '/*.php') ?: [];
    sort($files);

    foreach ($files as $path) {
        $name = basename($path);
        if ($prefix !== null && !str_starts_with($name, $prefix)) {
            continue;
        }
        $code = (string) file_get_contents($path);
        $src = new Source($code);
        $ex = new Explainer($src, new Parser($src));

        // 1. El ejemplo tal cual
        $rep = Report::build($runner->run($code, 'tu_codigo.php', ['timeout' => 20]), $ex);
        $bad = array_filter($rep['problems'], static fn($p) => $p['severity'] !== 'info');
        $s = $rep['testSummary'];
        $log(sprintf('%-34s ejemplo: exit=%d  problemas=%d  pruebas: %d pendientes, %d pasan, %d fallan', $name, $rep['exit'], count($bad), $s['todo'], $s['pass'], $s['fail'] + $s['error']));
        foreach ($bad as $p) {
            $failures[] = "{$name}: [{$p['severity']}] línea {$p['line']}: {$p['title']}";
        }
        if ($rep['exit'] !== 0) {
            $failures[] = "{$name}: el ejemplo termina con exit {$rep['exit']}";
        }
        if ($s['fail'] + $s['error'] > 0) {
            $failures[] = "{$name}: el ejemplo (sin solución) tiene pruebas que fallan en vez de estar pendientes";
        }

        // 2-4. Con la solución
        $solPath = Solutions::pathFor($name);
        if ($solPath === null && !str_contains($code, 'pendiente(')) {
            $log(sprintf('%-34s solución: (no hace falta: es teoría sin ejercicios)', ''));
            continue;
        }
        if ($solPath === null) {
            $failures[] = "{$name}: tiene ejercicios (pendiente) pero no existe soluciones/{$name}";
            continue;
        }
        $solCode = (string) file_get_contents($solPath);
        if (($err = Runner::syntaxError($solCode)) !== null) {
            $failures[] = "soluciones/{$name}: error de sintaxis línea {$err['line']}: {$err['msg']}";
            continue;
        }
        $spliced = Solutions::splice($code, $solCode);
        $rep2 = Report::build($runner->run($spliced, 'solucion.php', ['timeout' => 60, 'bench' => true, 'benchBudgetMs' => 2500]), $ex);
        $s2 = $rep2['testSummary'];
        $log(sprintf('%-34s solución: exit=%d  pruebas: %d/%d  ms=%s', '', $rep2['exit'], $s2['pass'], $s2['total'], (string) $rep2['ms']));
        foreach ($rep2['problems'] as $p) {
            $failures[] = "{$name} (con solución): [{$p['severity']}] línea {$p['line']}: {$p['title']} " . ($p['original'] ?? '');
        }
        foreach ($rep2['tests'] as $t) {
            if ($t['status'] !== 'pass') {
                $failures[] = "{$name} (con solución): {$t['group']} · {$t['name']} → {$t['status']} " . ($t['msg'] ?? ('esperado ' . ($t['expected'] ?? '?') . ', obtenido ' . ($t['actual'] ?? '?')));
            }
        }
        if ($s2['total'] < 5) {
            $failures[] = "{$name}: muy pocas pruebas ({$s2['total']})";
        }

        // @bigo frente a lo medido
        $docs = [];
        foreach (Solutions::compare($code, $solCode) as $item) {
            $docs[strtolower((string) preg_replace('/\(\)$/', '', $item['name']))] = $item['doc'];
            if (empty($item['doc']['complejidad']) || empty($item['doc']['explicacion'])) {
                $failures[] = "soluciones/{$name}: {$item['name']} sin @complejidad o @explicacion";
            }
        }
        foreach ($rep2['benches'] as $b) {
            $base = strtolower(explode('::', (string) $b['name'])[0]);
            $want = $docs[$base]['bigo'] ?? null;
            if ($b['status'] !== 'ok') {
                $failures[] = "{$name}: medir('{$b['name']}') con la solución → {$b['status']} " . ($b['msg'] ?? '');
                continue;
            }
            $got = $b['model'] ?? null;
            $okBench = $want !== null && $got !== null && abs(array_search($want, BIGO_ORDER, true) - array_search($got, BIGO_ORDER, true)) <= 1;
            $log(sprintf('%-34s   medir %-28s @bigo=%-5s medido=%-5s (%s, %d puntos) %s', '', $b['name'], (string) $want, (string) $got, (string) $b['label'], count($b['points']), $okBench ? 'ok' : 'FALLA'));
            if (!$okBench) {
                $failures[] = "{$name}: medir('{$b['name']}') da " . ($b['label'] ?? 'nada') . " pero @bigo es " . ($want ?? 'inexistente');
            }
        }
    }
    return $failures;
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $failures = content_check($argv[1] ?? null);
    echo $failures ? "\nFALLOS (" . count($failures) . "):\n - " . implode("\n - ", $failures) . "\n" : "\nCONTENIDO OK\n";
    exit($failures ? 1 : 0);
}
