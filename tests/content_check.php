<?php
declare(strict_types=1);

/**
 * Comprueba el contenido didáctico de un lenguaje (PHP, Python o Java):
 *   1. cada ejemplo se ejecuta sin errores, warnings ni deprecations (los ejercicios sin hacer salen como "pendiente");
 *   2. con su solución inyectada, TODAS las pruebas pasan;
 *   3. lo que mide medir() coincide (±1 clase) con el @bigo de la solución;
 *   4. la solución tiene @complejidad y @explicacion en cada declaración.
 *
 * Uso: php tests/content_check.php [--lang=php|python|java] [prefijo, p. ej. 04]   (sin prefijo: todos)
 * Devuelve código 1 si algo falla. Lo reutiliza tests/run.php.
 */
require_once dirname(__DIR__) . '/app/bootstrap.php';

use Playground\Core\{Bench, Languages, Report, Solutions, Temario};

/** Lecciones que no se pueden comprobar con esta versión del intérprete (con el motivo), según el temario. */
function content_skip(string $langId, string $file): ?string
{
    foreach (Temario::data()['lecciones'] ?? [] as $l) {
        $e = $l[$langId] ?? null;
        if (!is_array($e) || ($e['archivo'] ?? null) !== $file) {
            continue;
        }
        if ($langId === 'php' && isset($e['requierePhp']) && version_compare(PHP_VERSION, (string) $e['requierePhp'], '<')) {
            return "necesita PHP {$e['requierePhp']} (aquí hay " . PHP_VERSION . ')';
        }
    }
    return null;
}

/**
 * @param list<string> $skipped lecciones omitidas (por la versión del intérprete), con el motivo
 * @return list<string> fallos
 */
function content_check(?string $prefix = null, bool $verbose = true, string $langId = 'php', array &$skipped = []): array
{
    $lang = Languages::get($langId) ?? throw new InvalidArgumentException("Lenguaje desconocido: {$langId}");
    $solutions = new Solutions($lang);
    $failures = [];
    $log = static function (string $s) use ($verbose): void {
        if ($verbose) {
            echo $s, "\n";
        }
    };
    $files = glob($lang->examplesDir() . '/*.' . $lang->ext()) ?: [];
    sort($files);

    $totals = [];   // pruebas por lección (con la solución): las compara tests/paridad.php entre lenguajes
    foreach ($files as $path) {
        $name = basename($path);
        if ($prefix !== null && !str_starts_with($name, $prefix)) {
            continue;
        }
        if (($why = content_skip($langId, $name)) !== null) {
            $skipped[] = "{$langId}/{$name}: {$why}";
            $log(sprintf('%-34s OMITIDO: %s', $name, $why));
            continue;
        }
        $code = (string) file_get_contents($path);
        $ex = $lang->explainer($code);

        // 1. El ejemplo tal cual
        if (($err = $lang->syntaxError($code)) !== null) {
            $failures[] = "{$name}: error de sintaxis línea " . ($err['line'] ?? '?') . ': ' . ($err['msg'] ?? '');
            continue;
        }
        $rep = Report::build($lang->run($code, $lang->displayName('tu_codigo'), ['timeout' => 20]), $ex);
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
        $solPath = $solutions->pathFor($name);
        if ($solPath === null && !preg_match('/\bpendiente\s*\(/', $code)) {
            $log(sprintf('%-34s solución: (no hace falta: es teoría sin ejercicios)', ''));
            continue;
        }
        if ($solPath === null) {
            $failures[] = "{$name}: tiene ejercicios (pendiente) pero no existe soluciones/{$name}";
            continue;
        }
        $solCode = (string) file_get_contents($solPath);
        if ($lang->id() === 'php' && ($err = $lang->syntaxError($solCode)) !== null) {
            // En Python/Java el archivo de soluciones son declaraciones sueltas: se comprueba ya empalmado.
            $failures[] = "soluciones/{$name}: error de sintaxis línea {$err['line']}: {$err['msg']}";
            continue;
        }
        $spliced = $solutions->splice($code, $solCode);
        if (($err = $lang->syntaxError($spliced)) !== null) {
            $failures[] = "{$name} (con solución): error de sintaxis línea " . ($err['line'] ?? '?') . ': ' . ($err['msg'] ?? '');
            continue;
        }
        $rep2 = Report::build($lang->run($spliced, $lang->displayName('solucion'), ['timeout' => 60, 'bench' => true, 'benchBudgetMs' => 2500]), $lang->explainer($spliced));
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
        $totals[$name] = $s2['total'];
        if ($s2['total'] < 5) {
            $failures[] = "{$name}: muy pocas pruebas ({$s2['total']})";
        }

        // @bigo frente a lo medido
        $docs = [];
        foreach ($solutions->compare($code, $solCode) as $item) {
            $docs[strtolower((string) preg_replace('/\(\)$/', '', $item['name']))] = $item['doc'];
            if (empty($item['doc']['complejidad']) || empty($item['doc']['explicacion'])) {
                $failures[] = "soluciones/{$name}: {$item['name']} sin @complejidad o @explicacion";
            }
        }
        foreach ($rep2['benches'] as $b) {
            $base = strtolower(preg_split('/::|\./', (string) $b['name'])[0]);
            $want = $docs[$base]['bigo'] ?? null;
            if ($b['status'] !== 'ok') {
                $failures[] = "{$name}: medir('{$b['name']}') con la solución → {$b['status']} " . ($b['msg'] ?? '');
                continue;
            }
            $got = $b['model'] ?? null;
            $okBench = $want !== null && $got !== null && abs(array_search($want, Bench::ORDER, true) - array_search($got, Bench::ORDER, true)) <= 1;
            $log(sprintf('%-34s   medir %-28s @bigo=%-5s medido=%-5s (%s, %d puntos) %s', '', $b['name'], (string) $want, (string) $got, (string) $b['label'], count($b['points']), $okBench ? 'ok' : 'FALLA'));
            if (!$okBench) {
                $failures[] = "{$name}: medir('{$b['name']}') da " . ($b['label'] ?? 'nada') . " pero @bigo es " . ($want ?? 'inexistente');
            }
        }
    }
    if ($prefix === null) {
        if (!is_dir(PG_VAR)) {
            @mkdir(PG_VAR, 0777, true);
        }
        @file_put_contents(PG_VAR . "/pruebas-{$langId}.json", json_encode(['at' => time(), 'totals' => $totals], JSON_PRETTY_PRINT));
    }
    return $failures;
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $langId = 'php';
    $prefix = null;
    foreach (array_slice($argv, 1) as $a) {
        if (str_starts_with($a, '--lang=')) {
            $langId = substr($a, 7);
        } else {
            $prefix = $a;
        }
    }
    $skipped = [];
    $failures = content_check($prefix, true, $langId, $skipped);
    foreach ($skipped as $s) {
        echo "AVISO: omitido {$s}\n";
    }
    echo $failures ? "\nFALLOS (" . count($failures) . "):\n - " . implode("\n - ", $failures) . "\n" : "\nCONTENIDO OK ({$langId})\n";
    exit($failures ? 1 : 0);
}
