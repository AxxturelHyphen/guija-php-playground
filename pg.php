<?php
declare(strict_types=1);

/**
 * Playground en la terminal: ejecuta un archivo con el mismo motor que el editor web
 * (errores explicados, pruebas, análisis de complejidad y comparación con la solución de referencia).
 *
 *   php pg.php archivo.(php|py|java) [--lang=php|python|java] [--analisis] [--medir] [--comparar] [--timeout=N] [--sin-color]
 *
 * El lenguaje sale de la extensión (o de --lang). El archivo puede ser una ruta o un nombre que exista en los
 * ejemplos, las prácticas o las soluciones de ese lenguaje (p. ej. 04-recursion.php, 03-recursion.py).
 * Código de salida: 0 todo bien · 1 errores, pruebas que fallan o veredicto «mejorable» · 2 uso incorrecto.
 */
if (PHP_SAPI !== 'cli') {
    exit;
}
require __DIR__ . '/app/bootstrap.php';

use Playground\Core\{Bench, Language, Languages, Report, Solutions};

// ───────────────────────────── argumentos ─────────────────────────────
$args = array_slice($argv, 1);
$flags = [];
$files = [];
foreach ($args as $a) {
    if (str_starts_with($a, '--')) {
        [$k, $v] = array_pad(explode('=', substr($a, 2), 2), 2, true);
        $flags[$k] = $v;
    } else {
        $files[] = $a;
    }
}
if (isset($flags['ayuda']) || isset($flags['help']) || $files === []) {
    fwrite($files === [] && !isset($flags['ayuda']) && !isset($flags['help']) ? STDERR : STDOUT, <<<TXT
    Uso: php pg.php archivo.(php|py|java) [opciones]

      --lang=L        php, python o java (por defecto, según la extensión)
      --analisis      tabla de complejidad ciclomática, cognitiva y O() por función
      --medir         ejecuta también los medir() y dibuja las mediciones
      --comparar      compara tu código con la solución de referencia (rendimiento y pruebas)
      --timeout=N     segundos máximos (por defecto 30; 60 con --medir/--comparar)
      --sin-color     sin colores ANSI

    El archivo puede ser una ruta, o un nombre dentro de los ejemplos, prácticas o soluciones del lenguaje.

    TXT);
    exit($files === [] && !isset($flags['ayuda']) && !isset($flags['help']) ? 2 : 0);
}

$lang = isset($flags['lang']) ? Languages::get((string) $flags['lang']) : Languages::forFile($files[0]);
if ($lang === null) {
    fwrite(STDERR, "No sé de qué lenguaje es «{$files[0]}»: usa una extensión .php, .py o .java, o --lang=php|python|java.\n");
    exit(2);
}
$path = resolvePath($lang, $files[0]);
if ($path === null) {
    fwrite(STDERR, "No encuentro el archivo «{$files[0]}» ({$lang->name()}).\n");
    exit(2);
}

// ───────────────────────────── colores ─────────────────────────────
$color = !isset($flags['sin-color']) && getenv('NO_COLOR') === false && function_exists('stream_isatty') && stream_isatty(STDOUT);
if ($color && DIRECTORY_SEPARATOR === '\\' && function_exists('sapi_windows_vt100_support')) {
    $color = @sapi_windows_vt100_support(STDOUT, true);
}
function c(string $style, string $text): string
{
    global $color;
    static $codes = ['b' => '1', 'dim' => '2', 'red' => '31', 'green' => '32', 'yellow' => '33', 'blue' => '34', 'mag' => '35', 'cyan' => '36', 'gray' => '90'];
    return $color ? "\e[" . $codes[$style] . "m{$text}\e[0m" : $text;
}

// ───────────────────────────── ejecución ─────────────────────────────
$code = (string) file_get_contents($path);
$name = basename($path);
$wantBench = isset($flags['medir']) || isset($flags['comparar']);
$timeout = max(1, min(120, (int) ($flags['timeout'] ?? ($wantBench ? 60 : 30))));
$problemExit = false;

$explainer = $lang->explainer($code);

echo c('b', "▶ {$name}"), c('gray', '  (' . number_format(strlen($code)) . " bytes)\n");

$syntax = $lang->syntaxError($code);
if ($syntax !== null) {
    $d = $explainer->explain($syntax);
    printDiag($d);
    echo c('red', "\nNo se ejecuta: corrige el error de sintaxis.\n");
    if (isset($flags['analisis'])) {
        printAnalysis($lang->analyse($code));
    }
    exit(1);
}

$opts = ['timeout' => $timeout, 'bench' => $wantBench] + ($wantBench ? ['benchBudgetMs' => 2500] : []);
$report = Report::build($lang->run($code, $lang->displayName('tu_codigo'), $opts), $explainer);

echo c('gray', str_repeat('─', 72) . "\n");
foreach ($report['segments'] as $seg) {
    match ($seg['t']) {
        'out' => print($seg['text']),
        'diag' => printDiag($seg['diag']),
        'note' => print(c('yellow', "\n⚠ {$seg['text']}\n")),
        'img' => print(c('gray', '[gráfica' . ($seg['title'] !== '' ? ': ' . $seg['title'] : '') . " — se ve en el editor web]\n")),
        default => null,
    };
}
if ($report['segments'] !== [] && !str_ends_with((string) (end($report['segments'])['text'] ?? "\n"), "\n")) {
    echo "\n";
}
echo c('gray', str_repeat('─', 72) . "\n");

$bad = array_filter($report['problems'], static fn($p) => $p['severity'] === 'error');
$s = $report['testSummary'];
$failed = $s['fail'] + $s['error'];
$statusText = $report['exit'] === 0 && !$bad && $failed === 0 ? c('green', '✓ correcto') : c('red', '✗ con errores');
echo sprintf("%s · exit %d · %s ms%s\n", $statusText, $report['exit'], (string) $report['ms'], $report['peak'] ? ' · pico ' . formatBytes((int) $report['peak']) : '');
$problemExit = $report['exit'] !== 0 || $bad || $failed > 0;

if ($s['total'] > 0) {
    printTests($report['tests'], $s);
}
if (isset($flags['medir']) && !isset($flags['comparar'])) {
    foreach ($report['benches'] as $b) {
        printBench($b);
    }
}

// ───────────────────────────── análisis ─────────────────────────────
if (isset($flags['analisis'])) {
    printAnalysis($lang->analyse($code));
}

// ───────────────────────────── comparación ─────────────────────────────
if (isset($flags['comparar'])) {
    $solPath = (new Solutions($lang))->pathFor($name);
    if ($solPath === null) {
        echo c('yellow', "\nEste archivo no tiene soluciones de referencia (contenido/{$lang->id()}/soluciones/{$name}).\n");
    } else {
        $problemExit = compareWithSolution($lang, $code, (string) file_get_contents($solPath), $report, $timeout) || $problemExit;
    }
}

exit($problemExit ? 1 : 0);

// ═════════════════════════════ funciones ═════════════════════════════

function resolvePath(Language $lang, string $arg): ?string
{
    foreach ([$arg, $lang->examplesDir() . '/' . $arg, $lang->practiceDir() . '/' . $arg, $lang->solutionsDir() . '/' . $arg] as $candidate) {
        if (is_file($candidate) && str_ends_with(strtolower($candidate), '.' . $lang->ext())) {
            return $candidate;
        }
    }
    return null;
}

function formatBytes(int $b): string
{
    return $b >= 1_048_576 ? round($b / 1_048_576, 1) . ' MB' : round($b / 1024) . ' KB';
}

function formatMs(float $ms): string
{
    return str_replace(".", ",", (string) match (true) {
        $ms < 0.001 => '<1 µs',
        $ms < 1 => round($ms * 1000, $ms < 0.01 ? 1 : 0) . ' µs',
        $ms < 1000 => round($ms, $ms < 10 ? 1 : 0) . ' ms',
        default => round($ms / 1000, 2) . ' s',
    });
}

/** @param array<string,mixed> $d */
function printDiag(array $d): void
{
    [$icon, $style] = match ($d['severity']) {
        'error' => ['✗', 'red'],
        'warning' => ['!', 'yellow'],
        default => ['i', 'cyan'],
    };
    echo "\n", c($style, "{$icon} " . ($d['title'] ?? 'Aviso')), c('gray', ' · línea ' . ($d['line'] ?? '?')), "\n";
    if (!empty($d['explain'])) {
        echo '  ', wrapText(stripMd((string) $d['explain']), 100, '  '), "\n";
    }
    if (!empty($d['hint'])) {
        echo '  ', c('green', '→ '), wrapText(stripMd((string) $d['hint']), 98, '    '), "\n";
    }
    foreach ($d['fixes'] ?? [] as $fix) {
        echo '  ', c('blue', '⚡ ' . ($fix['title'] ?? 'Arreglo')), "\n";
    }
    foreach (array_slice($d['trace'] ?? [], 0, 6) as $f) {
        echo c('gray', sprintf("    en %s (línea %s)\n", $f['fn'] ?? '?', $f['line'] ?? '?'));
    }
}

function stripMd(string $s): string
{
    return str_replace(['**', '`'], '', $s);
}

function wrapText(string $text, int $width, string $indent): string
{
    return str_replace("\n", "\n", wordwrap(str_replace("\n", ' ', $text), $width, "\n{$indent}", false));
}

/** @param list<array<string,mixed>> $tests @param array<string,int> $s */
function printTests(array $tests, array $s): void
{
    echo c('b', "\nPruebas") . '  ' . c('green', "{$s['pass']} ✓") . '  '
        . ($s['fail'] + $s['error'] > 0 ? c('red', ($s['fail'] + $s['error']) . ' ✗') : c('gray', '0 ✗')) . '  '
        . ($s['todo'] > 0 ? c('yellow', "{$s['todo']} ⏳ pendientes") : c('gray', '0 pendientes')) . "\n";
    $groups = [];
    foreach ($tests as $t) {
        $groups[$t['group']][] = $t;
    }
    foreach ($groups as $group => $list) {
        $pass = count(array_filter($list, static fn($t) => $t['status'] === 'pass'));
        $todo = array_sum(array_map(static fn($t) => $t['status'] === 'todo' ? (int) ($t['total'] ?? 1) : 0, $list));
        $fails = array_filter($list, static fn($t) => in_array($t['status'], ['fail', 'error'], true));
        $mark = $fails ? c('red', '✗') : ($todo > 0 && $pass === 0 ? c('yellow', '⏳') : c('green', '✓'));
        $total = count($list) - count(array_filter($list, static fn($t) => $t['status'] === 'todo')) + $todo;
        echo sprintf("  %s %-28s %s\n", $mark, $group, c('gray', $todo > 0 && $pass === 0 ? 'sin implementar' : "{$pass}/{$total}"));
        foreach ($fails as $t) {
            echo '      ', c('red', '✗ ' . $t['name']), "\n";
            if (isset($t['msg'])) {
                echo '        ', stripMd((string) $t['msg']), "\n";
            } else {
                echo '        ', c('gray', 'esperado '), (string) ($t['expected'] ?? '?'), "\n";
                echo '        ', c('gray', 'obtenido '), (string) ($t['actual'] ?? '?'), "\n";
            }
        }
    }
}

/** Mini gráfica de barras (escala logarítmica) de una medición. @param array<string,mixed> $b */
function printBench(array $b, ?array $other = null): void
{
    if (($b['status'] ?? '') !== 'ok') {
        $why = match ($b['status'] ?? '') {
            'todo' => 'sin implementar',
            'skipped' => 'omitida',
            default => (string) ($b['msg'] ?? 'no se pudo medir'),
        };
        echo c('gray', "  medir {$b['name']}: {$why}\n");
        return;
    }
    echo c('b', "\n  medir {$b['name']}"), c('gray', '  ~' . ($b['label'] ?? '?') . ($b['stopped'] ?? false ? '  (se paró al pasarse de tiempo)' : '')), "\n";
    $max = max(array_map(static fn($p) => (float) $p[1], $b['points']));
    foreach ($b['points'] as [$n, $ms]) {
        $width = $max > 0 ? max(1, (int) round(40 * log10(1 + $ms * 1000) / log10(1 + $max * 1000))) : 1;
        echo sprintf("    n=%-9s %s %s\n", number_format((int) $n, 0, ',', '.'), c('blue', str_repeat('█', $width)), c('gray', formatMs((float) $ms)));
    }
}

/** @param array<string,mixed> $result */
function printAnalysis(array $result): void
{
    echo c('b', "\nAnálisis de complejidad\n");
    $rows = array_filter($result['units'], static fn($u) => $u['kind'] !== 'main');
    if ($rows === []) {
        echo c('gray', "  (no hay funciones ni métodos que analizar)\n");
    } else {
        echo c('gray', sprintf("  %-30s %5s %4s %6s %5s %4s  %s\n", 'función', 'líneas', 'CC', 'cognit', 'anid.', 'nota', 'O() estimado'));
        foreach ($rows as $u) {
            $ccStyle = $u['cc'] > 20 ? 'red' : ($u['cc'] > 10 ? 'yellow' : 'green');
            $bigO = $u['bigO'] ?? '';
            $boStyle = str_contains($bigO, '2ⁿ') || str_contains($bigO, 'n³') || str_contains($bigO, 'n²') ? 'yellow' : 'cyan';
            echo sprintf("  %-30s %5d %s %6d %5d %4s  %s\n",
                mb_strimwidth($u['qname'], 0, 30, '…'), $u['loc'], c($ccStyle, str_pad((string) $u['cc'], 4, ' ', STR_PAD_LEFT)),
                $u['cognitive'], $u['nesting'], $u['grade'], c($boStyle, $bigO));
        }
    }
    $sum = $result['summary'];
    echo c('gray', sprintf("  total: %d funciones · %d líneas · CC media %s (nota %s)%s\n", $sum['functions'], $sum['loc'], (string) $sum['ccAvg'], $sum['grade'], $sum['worst'] ? ' · más compleja: ' . $sum['worst'] : ''));
    echo c('gray', "  CC = complejidad ciclomática (1 + decisiones). O() es una estimación estática; con --medir se mide de verdad.\n");
    $hints = array_filter($result['diagnostics'], static fn($d) => ($d['source'] ?? '') !== 'syntax');
    if ($hints) {
        echo c('b', "\nSugerencias\n");
        foreach ($hints as $h) {
            $style = $h['severity'] === 'error' ? 'red' : ($h['severity'] === 'warning' ? 'yellow' : 'cyan');
            echo sprintf("  %s %s\n", c($style, str_pad('línea ' . $h['line'], 9)), $h['title']);
        }
    }
}

/** @return bool true si el veredicto sugiere que hay mejora posible o algo falla */
function compareWithSolution(Language $lang, string $code, string $solution, array $mine, int $timeout): bool
{
    $solutions = new Solutions($lang);
    $spliced = $solutions->splice($code, $solution);
    $opts = ['timeout' => $timeout, 'bench' => true, 'benchBudgetMs' => 2500];
    $best = Report::build($lang->run($spliced, $lang->displayName('solucion'), $opts), $lang->explainer($spliced));

    echo c('b', "\n\nComparación con la solución de referencia\n");
    $sm = $mine['testSummary'];
    $sb = $best['testSummary'];
    echo sprintf("  tus pruebas:      %d/%d ✓\n  con la solución:  %d/%d ✓\n", $sm['pass'], $sm['total'], $sb['pass'], $sb['total']);

    $warn = false;
    $items = $solutions->compare($code, $solution);
    if ($items) {
        echo c('b', "\n  Declaraciones\n");
        foreach ($items as $it) {
            $state = $it['same'] ? c('green', 'igual a la referencia') : ($it['implemented'] ? c('cyan', 'implementada, distinta de la referencia') : c('yellow', 'sin implementar'));
            echo sprintf("    %-32s %s\n", $it['name'], $state);
            if (!empty($it['doc']['complejidad']) && !$it['same']) {
                echo c('gray', '      referencia: ' . stripMd((string) $it['doc']['complejidad']) . "\n");
            }
        }
    }

    foreach (Bench::series($mine['benches'], $best['benches']) as $row) {
        $style = match ($row['level']) {
            'ok' => 'green', 'warning' => 'yellow', default => 'cyan',
        };
        echo c('b', "\n  {$row['name']}"), '  ', c($style, (string) $row['verdict']), "\n";
        if ($row['level'] === 'warning') {
            $warn = true;
        }
        if (is_array($row['mine']) && ($row['mine']['status'] ?? '') === 'ok' && is_array($row['best'])) {
            $mineBy = array_column($row['mine']['points'], 1, 0);
            $bestBy = array_column($row['best']['points'], 1, 0);
            echo c('gray', sprintf("    %-10s %12s %12s\n", 'n', 'tu código', 'referencia'));
            foreach (array_keys($mineBy + $bestBy) as $n) {
                echo sprintf("    %-10s %12s %12s\n", number_format((int) $n, 0, ',', '.'),
                    isset($mineBy[$n]) ? formatMs((float) $mineBy[$n]) : '—', isset($bestBy[$n]) ? formatMs((float) $bestBy[$n]) : '—');
            }
        }
    }
    foreach ($best['problems'] as $p) {
        if ($p['severity'] === 'error') {
            echo c('red', "\n  La solución inyectada dio un error: {$p['title']}\n");
            $warn = true;
        }
    }
    return $warn;
}
