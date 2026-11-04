<?php
declare(strict_types=1);

/**
 * Autotest completo del playground.
 *
 *   php tests/run.php            todo (≈ 1 min: incluye medir() de las 7 soluciones)
 *   php tests/run.php --rapido   sin el contenido (ejemplos/soluciones)
 *
 * Secciones: sintaxis de todos los .php · métricas · script de pistas y de explicaciones · harness (errores, timeout,
 * memoria, stdin, pruebas) · soluciones (splice) · contenido 01-08 · seguridad HTTP real contra `php -S`.
 * Después, las mismas comprobaciones para Python y Java (tests/python/run.php, tests/java/run.php) y la paridad
 * del temario entre los tres (tests/paridad.php), si existen.
 * Código de salida 1 si algo falla.
 */
require_once dirname(__DIR__) . '/app/bootstrap.php';
require_once __DIR__ . '/content_check.php';

use Playground\Core\{Api, Languages, Report};
use Playground\Lang\Php\Analysis\{Metrics, Parser, Source};

$php = Languages::get('php');

$fast = in_array('--rapido', $argv, true);
$pass = 0;
$fail = 0;
$failed = [];

function section(string $title): void
{
    echo "\n\e[1m── {$title}\e[0m\n";
}

function check(string $label, bool $ok, string $detail = ''): void
{
    global $pass, $fail, $failed;
    if ($ok) {
        $pass++;
        echo "  \e[32m✓\e[0m {$label}\n";
    } else {
        $fail++;
        $failed[] = $label . ($detail !== '' ? " — {$detail}" : '');
        echo "  \e[31m✗ {$label}\e[0m" . ($detail !== '' ? "  \e[90m{$detail}\e[0m" : '') . "\n";
    }
}

function runCode(string $code, array $opts = []): array
{
    $php = Languages::get('php');
    return Report::build($php->run($code, 'tu_codigo.php', $opts + ['timeout' => 10]), $php->explainer($code));
}

function phpBinary(): string
{
    return PHP_BINARY;
}

// ═══════════════════════════════════════ 1. sintaxis de todos los PHP ═══════════════════════════════════════
section('Sintaxis (php -l) de todos los archivos');
$dirs = ['app', 'app/Core', 'app/Lang/Php', 'app/Lang/Php/Analysis', 'app/Lang/Php/data', 'app/Lang/Python', 'app/Lang/Java', 'app/Lang/Java/Analysis',
    'contenido/php/ejemplos', 'contenido/php/soluciones', 'tests', 'tests/python', 'tests/java'];
$all = [PG_ROOT . '/index.php', PG_ROOT . '/pg.php'];
foreach ($dirs as $d) {
    foreach (glob(PG_ROOT . "/{$d}/*.php") ?: [] as $f) {
        $all[] = $f;
    }
}
$bad = [];
$skippedSyntax = [];
foreach ($all as $f) {
    if (str_contains(str_replace('\\', '/', $f), '/contenido/php/') && ($why = content_skip('php', basename($f))) !== null) {
        $skippedSyntax[] = basename($f) . ": {$why}";
        continue;
    }
    $out = [];
    exec(escapeshellarg(phpBinary()) . ' -l ' . escapeshellarg($f) . ' 2>&1', $out, $rc);
    if ($rc !== 0) {
        $bad[] = basename($f) . ': ' . trim($out[0] ?? '');
    }
}
check((count($all) - count($skippedSyntax)) . ' archivos sin errores de sintaxis', $bad === [], implode('; ', $bad));
foreach ($skippedSyntax as $w) {
    echo "  \e[33m! omitido {$w}\e[0m\n";
}

// ═══════════════════════════════════════ 2. métricas ═══════════════════════════════════════
section('Métricas: ciclomática, cognitiva y O() sobre fragmentos conocidos');
$fixtures = [
    // nombre => [código, CC, cognitiva, clave O()]
    'sin decisiones' => ['function f() { return 1; }', 1, 0, '1'],
    'if + && + elseif' => ['function f($x) { if ($x > 0 && $x < 10) { return 1; } elseif ($x < 0) { return 2; } return 3; }', 4, null, '1'],
    'bucles anidados con if' => ['function f(array $xs) { foreach ($xs as $x) { if ($x) { while ($x--) { echo 1; } } } }', 4, 6, null],
    'match con default' => ['function f($x) { return match (true) { $x < 0 => -1, $x > 0 => 1, default => 0 }; }', 3, null, '1'],
    '?? y ternario' => ['function f($a, $b) { return $a ?? ($b ? 1 : 2); }', 3, null, '1'],
    'dos catch' => ['function f() { try { g(); } catch (A $e) { echo 1; } catch (B $e) { echo 2; } }', 3, null, '1'],
    'switch' => ['function f($x) { switch ($x) { case 1: return 1; case 2: return 2; default: return 0; } }', 3, null, '1'],
    'dos bucles anidados' => ['function f(array $xs) { foreach ($xs as $a) { foreach ($xs as $b) { echo $a . $b; } } }', 3, null, 'n2'],
    'un bucle' => ['function f(array $xs) { $s = 0; foreach ($xs as $x) { $s += $x; } return $s; }', 2, null, 'n'],
    'in_array dentro de un bucle' => ['function f(array $xs) { $r = []; foreach ($xs as $x) { if (!in_array($x, $r, true)) { $r[] = $x; } } return $r; }', 3, null, 'n2'],
    'fibonacci ingenuo' => ['function f(int $n): int { return $n < 2 ? $n : f($n - 1) + f($n - 2); }', 2, null, 'exp'],
    'búsqueda binaria' => ['function f(array $a, int $x) { $lo = 0; $hi = count($a) - 1; while ($lo <= $hi) { $m = intdiv($lo + $hi, 2); if ($a[$m] === $x) { return $m; } if ($a[$m] < $x) { $lo = $m + 1; } else { $hi = $m - 1; } } return -1; }', 4, null, 'log'],
];
foreach ($fixtures as $name => [$body, $cc, $cog, $key]) {
    $src = new Source("<?php\n" . $body);
    $result = (new Metrics($src, $parser = new Parser($src)))->compute();
    $u = null;
    foreach ($result['units'] as $unit) {
        if ($unit['name'] === 'f') {
            $u = $unit;
        }
    }
    if ($u === null) {
        check($name, false, 'no se encontró la función f');
        continue;
    }
    $problems = [];
    if ($u['cc'] !== $cc) {
        $problems[] = "CC {$u['cc']} (esperada {$cc})";
    }
    if ($cog !== null && $u['cognitive'] !== $cog) {
        $problems[] = "cognitiva {$u['cognitive']} (esperada {$cog})";
    }
    if ($key !== null && $u['bigOKey'] !== $key) {
        $problems[] = "O() {$u['bigOKey']} (esperado {$key})";
    }
    check($name . '  [CC ' . $u['cc'] . ', cog ' . $u['cognitive'] . ', ' . $u['bigO'] . ']', $problems === [], implode(', ', $problems));
}
check('nota A–F: 5→A, 10→B, 20→C, 30→D, 40→E, 41→F', array_map([Metrics::class, 'grade'], [5, 10, 20, 30, 40, 41]) === ['A', 'B', 'C', 'D', 'E', 'F']);

// ═══════════════════════════════════════ 3. pistas y explicaciones (scripts) ═══════════════════════════════════════
section('Pistas, quick fixes y errores explicados');
foreach (['hints_check.php' => 'pistas y arreglos automáticos', 'explain_check.php' => 'errores explicados en español', 'solutions_check.php' => 'inyección de soluciones (splice)'] as $script => $label) {
    $out = [];
    exec(escapeshellarg(phpBinary()) . ' ' . escapeshellarg(__DIR__ . '/' . $script) . ' 2>&1', $out, $rc);
    $failLines = array_values(array_filter($out, static fn($l) => str_starts_with($l, 'FAIL')));
    check($label . ' (' . $script . ')', $rc === 0 && $failLines === [], $failLines ? mb_substr($failLines[0], 0, 120) : "exit {$rc}");
}

// ═══════════════════════════════════════ 4. harness ═══════════════════════════════════════
section('Harness: errores, excepciones, timeout, memoria, stdin y pruebas');

$r = runCode("<?php\necho 'a';\necho \$noExiste;\necho 'b';\n");
$w = array_values(array_filter($r['problems'], static fn($p) => $p['severity'] === 'warning'));
check('warning con su línea y salida intacta', $r['exit'] === 0 && count($w) === 1 && $w[0]['line'] === 3 && str_contains(implode('', array_column($r['segments'], 'text')), 'ab'), json_encode($w[0] ?? null));

$r = runCode("<?php\nfunction f() {\n    throw new RuntimeException('boom');\n}\nf();\n");
$e = $r['problems'][0] ?? null;
check('excepción no capturada: error explicado con línea y traza', $r['exit'] !== 0 && $e !== null && $e['severity'] === 'error' && $e['line'] === 3 && !empty($e['title']), json_encode($e));

$r = runCode("<?php\ndeclare(strict_types=1);\nfunction f(int \$x): int { return \$x; }\necho f('5');\n");
$e = $r['problems'][0] ?? null;
check('TypeError con strict_types se explica', $e !== null && $e['severity'] === 'error' && str_contains(mb_strtolower((string) ($e['explain'] ?? '')), 'strict_types'), (string) ($e['title'] ?? 'sin diagnóstico'));

$t0 = microtime(true);
$r = runCode("<?php\nwhile (true) { }\n", ['timeout' => 2]);
$e = $r['problems'][0] ?? null;
check('bucle infinito: se corta y se explica (< 8 s)', $r['exit'] !== 0 && $e !== null && $e['severity'] === 'error' && microtime(true) - $t0 < 8, 'tardó ' . round(microtime(true) - $t0, 1) . ' s; ' . ($e['title'] ?? 'sin diagnóstico'));

$r = runCode("<?php\n\$a = [];\nwhile (true) { \$a[] = str_repeat('x', 1_000_000); }\n", ['timeout' => 20]);
$e = $r['problems'][0] ?? null;
check('memoria agotada: error explicado, el servidor sigue vivo', $e !== null && $e['severity'] === 'error' && $r['exit'] !== 0, (string) ($e['title'] ?? 'sin diagnóstico'));

$r = runCode("<?php\nwhile (true) { echo str_repeat('a', 5000); }\n", ['timeout' => 20]);
check('salida desbordada (1 MB): se corta', $r['killed'] === 'output' || array_filter($r['segments'], static fn($s) => $s['t'] === 'note') !== [], 'killed=' . var_export($r['killed'], true));

$r = runCode("<?php\n\$n = (int) trim(fgets(STDIN));\necho \$n * 2;\n", ['stdin' => "21\n"]);
check('STDIN llega al programa', str_contains(implode('', array_column($r['segments'], 'text')), '42'));

$r = runCode("<?php\nfunction x() { throw new Exception('secreto'); }\nx();\n");
$json = json_encode($r);
check('no se filtran rutas temporales del sistema', !str_contains((string) $json, str_replace('\\', '\\\\', sys_get_temp_dir())) && !str_contains((string) $json, 'pgrun_'), '');

$code = <<<'PHP'
<?php
declare(strict_types=1);
function doble(int $x): int { return $x * 2; }
function triple(int $x): int { return $x + 3; }
function pendienteFn(): int { pendiente(); }
prueba('doble', ['dos' => [[2], 4], 'cero' => [[0], 0]]);
prueba('triple', ['mal' => [[2], 6]]);
prueba('pendienteFn', ['algo' => [[], 1]]);
comprueba('lanza ok', fn() => throw new LogicException('x') ?? 1, 1);
lanza('lanza bien', fn() => throw new LogicException('x'), LogicException::class);
prueba('doble', ['sin orden' => [[1], 2]], null, true);
PHP;
$r = runCode($code);
$s = $r['testSummary'];
check("pruebas: 4 ✓, 1 ✗, 1 error, 1 ⏳ (obtenido {$s['pass']} ✓ {$s['fail']} ✗ {$s['error']} error {$s['todo']} ⏳)", $s['pass'] === 4 && $s['fail'] === 1 && $s['error'] === 1 && $s['todo'] === 1);

$r = runCode("<?php\nfunction suma(array \$xs): int { return array_sum(\$xs); }\nmedir('suma', fn(int \$n): array => [range(1, \$n)]);\n", ['bench' => true, 'benchBudgetMs' => 1500, 'timeout' => 30]);
$b = $r['benches'][0] ?? null;
check('medir(): puntos y modelo O(n)', $b !== null && $b['status'] === 'ok' && count($b['points']) >= 5 && in_array($b['model'], ['n', 'nlogn', '1'], true), json_encode($b['model'] ?? $b));

$r = runCode("<?php\nfunction suma(array \$xs): int { return array_sum(\$xs); }\nmedir('suma', fn(int \$n): array => [range(1, \$n)]);\n");
check('medir() sin «Medir» se omite (no ralentiza ejecutar)', ($r['benches'][0]['status'] ?? '') === 'skipped');

$syntax = $php->syntaxError("<?php\n\$x = 1\necho \$x;\n");
check('error de sintaxis detectado sin lanzar el programa', $syntax !== null && $syntax['line'] >= 2);

// ═══════════════════════════════════════ 5. contenido ═══════════════════════════════════════
if (!$fast) {
    section('Contenido: ejemplos 01–08 y sus soluciones');
    $skippedContent = [];
    $failures = content_check(null, false, 'php', $skippedContent);
    $examples = glob($php->examplesDir() . '/*.php') ?: [];
    check((count($examples) - count($skippedContent)) . ' ejemplos: sin errores, soluciones con 100 % de pruebas y O() medido = @bigo', $failures === [], implode(' | ', array_map(static fn($f) => mb_substr($f, 0, 140), array_slice($failures, 0, 3))));
    foreach ($skippedContent as $w) {
        echo "  \e[33m! omitido {$w}\e[0m\n";
    }
} else {
    section('Contenido (omitido con --rapido)');
}

// ═══════════════════════════════════════ 6. seguridad HTTP ═══════════════════════════════════════
section('Seguridad: servidor real (php -S) con peticiones hostiles');

$probe = stream_socket_server('tcp://127.0.0.1:0', $errno, $errstr);
$port = (int) substr((string) strrchr((string) stream_socket_get_name($probe, false), ':'), 1);
fclose($probe);
$proc = proc_open([phpBinary(), '-S', "127.0.0.1:{$port}", 'index.php'], [0 => ['pipe', 'r'], 1 => ['file', sys_get_temp_dir() . '/pg_http.log', 'w'], 2 => ['file', sys_get_temp_dir() . '/pg_http.log', 'a']], $pipes, PG_ROOT);

/** @return array{status:int, headers:string, body:string} */
function http(int $port, string $method, string $target, array $headers = [], ?string $body = null): array
{
    $headers += ['Host' => "127.0.0.1:{$port}"];
    $fp = @stream_socket_client("tcp://127.0.0.1:{$port}", $errno, $errstr, 3);
    if (!$fp) {
        return ['status' => 0, 'headers' => '', 'body' => $errstr];
    }
    $req = "{$method} {$target} HTTP/1.1\r\nConnection: close\r\n";
    foreach ($headers as $k => $v) {
        $req .= "{$k}: {$v}\r\n";
    }
    if ($body !== null) {
        $req .= 'Content-Length: ' . strlen($body) . "\r\n";
    }
    fwrite($fp, $req . "\r\n" . ($body ?? ''));
    stream_set_timeout($fp, 60);
    $raw = stream_get_contents($fp);
    fclose($fp);
    [$head, $content] = array_pad(explode("\r\n\r\n", (string) $raw, 2), 2, '');
    preg_match('#^HTTP/\S+ (\d{3})#', $head, $m);
    return ['status' => (int) ($m[1] ?? 0), 'headers' => $head, 'body' => $content];
}

$up = false;
for ($i = 0; $i < 50 && !$up; $i++) {
    $up = http($port, 'GET', '/api?action=meta')['status'] === 200;
    $up || usleep(100_000);
}
check('el servidor arranca y responde a /api?action=meta', $up);

if ($up) {
    $json = static fn(array $data): string => (string) json_encode($data);
    $ok = ['Content-Type' => 'application/json', 'X-Playground' => '1'];
    $post = static fn(string $action, array $data, array $h = []) => http($port, 'POST', "/api?action={$action}", $h + $ok, $json($data));

    $r = $post('lint', ['code' => '<?php echo 1;']);
    check('POST legítimo (JSON + X-Playground) → 200', $r['status'] === 200);
    $r = http($port, 'POST', '/api?action=run', ['Content-Type' => 'application/json'], $json(['code' => '<?php echo 1;']));
    check('POST sin X-Playground → 403 (CSRF desde otra pestaña)', $r['status'] === 403);
    $r = http($port, 'POST', '/api?action=run', ['Content-Type' => 'text/plain', 'X-Playground' => '1'], $json(['code' => '<?php echo 1;']));
    check('POST con Content-Type text/plain (formulario cruzado) → 403', $r['status'] === 403);
    $r = $post('run', ['code' => '<?php echo 1;'], ['Origin' => 'http://evil.example']);
    check('POST con Origin ajeno → 403', $r['status'] === 403);
    $r = $post('run', ['code' => '<?php echo 1;'], ['Host' => 'evil.example']);
    check('Host ajeno (DNS rebinding) → 403', $r['status'] === 403);
    $r = http($port, 'GET', '/api?action=tree', ['Host' => 'attacker.test:' . $port]);
    check('GET con Host ajeno → 403', $r['status'] === 403);
    $r = http($port, 'GET', '/api?action=run');
    check('acción de escritura por GET → 405', $r['status'] === 405);

    foreach (['/app/Core/Api.php', '/app/Lang/Php/harness.php', '/assets/../app/Core/Api.php', '/assets/%2e%2e/app/Core/Api.php', '/practicas/t.php', '/practicas/php/t.php',
        '/contenido/php/ejemplos/01-java-a-php.php', '/contenido/temario.json', '/var/langs.json', '/index.php', '/tests/run.php', '/assets/js/../../pg.php', '/.git/config',
        '/php/../app/Core/Api.php', '/ruby'] as $url) {
        $r = http($port, 'GET', $url);
        check("GET {$url} → 404 y sin código fuente", $r['status'] === 404 && !str_contains($r['body'], '<?php'), "status {$r['status']}");
    }
    $r = http($port, 'GET', '/assets/css/app.css');
    check('GET /assets/css/app.css → 200 (estático permitido)', $r['status'] === 200 && str_contains($r['headers'], 'text/css'));
    $r = http($port, 'GET', '/');
    check('GET / → selector de lenguaje con Content-Security-Policy', $r['status'] === 200 && str_contains($r['headers'], 'Content-Security-Policy') && str_contains($r['headers'], "frame-ancestors 'none'") && str_contains($r['body'], 'lang-card'));
    foreach (['php', 'python', 'java', 'cpp'] as $l) {
        $r = http($port, 'GET', "/{$l}");
        check("GET /{$l} → IDE de ese lenguaje con CSP", $r['status'] === 200 && str_contains($r['headers'], "frame-ancestors 'none'") && str_contains($r['body'], "data-lang=\"{$l}\""));
    }
    $r = http($port, 'GET', '/api?action=langs');
    $langs = json_decode($r['body'], true)['langs'] ?? [];
    check('GET /api?action=langs → los 4 lenguajes con su estado', $r['status'] === 200 && array_column($langs, 'id') === ['php', 'python', 'java', 'cpp']);
    foreach (['ruby', '..%2F..%2Fapp', '', 'PHP'] as $badLang) {
        $r = http($port, 'GET', "/api?lang={$badLang}&action=tree");
        check("lang «{$badLang}» desconocido → 404", $badLang === '' ? $r['status'] === 404 || $r['status'] === 200 : $r['status'] === 404, "status {$r['status']}");
    }
    $r = http($port, 'POST', '/api?lang=python&action=save', $ok, $json(['name' => 'x.php', 'code' => 'print(1)']));
    check('guardar un .php en practicas/python/ → 400 (extensión de otro lenguaje)', $r['status'] === 400);
    $r = http($port, 'GET', '/api?lang=java&action=file&dir=ejemplos&name=..%2F..%2Fphp%2Fejemplos%2F04-recursion.php');
    check('leer otro lenguaje con ../ desde java → 404', $r['status'] === 404);

    // Escritura de archivos
    $name = 'zz-autotest-' . bin2hex(random_bytes(2)) . '.php';
    $r = $post('save', ['name' => $name, 'code' => "<?php\necho 1;\n"]);
    check('guardar en practicas/php/ → 200 y el archivo existe', $r['status'] === 200 && is_file($php->practiceDir() . '/' . $name));
    $r = $post('save', ['name' => $name, 'code' => '<?php echo 2;']);
    check('guardar sobre uno existente sin overwrite → 409', $r['status'] === 409);
    $r = $post('save', ['name' => $name, 'code' => "<?php\necho 3;\n", 'overwrite' => true]);
    check('guardar con overwrite → 200', $r['status'] === 200 && str_contains((string) file_get_contents($php->practiceDir() . '/' . $name), 'echo 3'));
    $ej01 = $php->examplesDir() . '/01-java-a-php.php';
    $before = md5_file($ej01);
    foreach (['../ejemplos/01-java-a-php.php', '..\\ejemplos\\01-java-a-php.php', '../app/Api.php', 'x.txt', 'sin-extension', '.htaccess.php', str_repeat('a', 90) . '.php', 'a/b.php', "a\0b.php"] as $bad) {
        $r = $post('save', ['name' => $bad, 'code' => '<?php echo "pwned";', 'overwrite' => true, 'dir' => 'ejemplos']);
        check('guardar «' . addcslashes(mb_substr($bad, 0, 30), "\0") . '» se rechaza', $r['status'] === 400, "status {$r['status']}");
    }
    check('los ejemplos siguen intactos tras los ataques', md5_file($ej01) === $before);
    $r = $post('delete', ['name' => '../ejemplos/01-java-a-php.php']);
    check('borrar fuera de practicas/ → 404', $r['status'] === 404 && is_file($ej01));
    $r = $post('delete', ['name' => $name]);
    check('borrar de practicas/ → 200', $r['status'] === 200 && !is_file($php->practiceDir() . '/' . $name));
    $r = http($port, 'GET', '/api?action=file&dir=app&name=Api.php');
    check('leer app/Api.php por la API (dir no permitido) → 404', $r['status'] === 404);
    $r = http($port, 'GET', '/api?action=file&dir=ejemplos&name=..%2Fapp%2FApi.php');
    check('leer con ../ en el nombre → 404', $r['status'] === 404);
    $r = http($port, 'GET', '/api?action=file&dir=ejemplos&name=01-java-a-php.php');
    check('leer un ejemplo → 200', $r['status'] === 200);

    $r = $post('run', ['code' => '<?php echo 6 * 7;']);
    $body = json_decode($r['body'], true);
    check('ejecutar por la API devuelve la salida (42)', $r['status'] === 200 && str_contains(json_encode($body['segments'] ?? []), '42'));
    $r = $post('run', ['code' => str_repeat('a', Api::MAX_CODE + 1)]);
    check('código gigante → 413', $r['status'] === 413);
    $r = $post('run', ['code' => "<?php echo 'caf\xe9';"]);
    check('código no UTF-8 → 400', $r['status'] === 400);
    $r = http($port, 'POST', '/api?action=run', $ok, '{no es json');
    check('cuerpo que no es JSON → 400', $r['status'] === 400);
}

if (is_resource($proc)) {
    proc_terminate($proc);
    proc_close($proc);
}
@unlink(sys_get_temp_dir() . '/pg_http.log');

// ═══════════════════════════════════════ 7. Python, Java y paridad ═══════════════════════════════════════
// Cada lenguaje tiene su propio autotest con la misma estructura; aquí se lanzan y se cuenta su resultado.
foreach (['tests/python/run.php' => 'Python', 'tests/java/run.php' => 'Java', 'tests/paridad.php' => 'Paridad del temario (PHP · Python · Java)'] as $script => $label) {
    if (!is_file(PG_ROOT . '/' . $script)) {
        continue;
    }
    section($label);
    $out = [];
    exec(escapeshellarg(phpBinary()) . ' ' . escapeshellarg(PG_ROOT . '/' . $script) . ($fast ? ' --rapido' : '') . ' 2>&1', $out, $rc);
    foreach ($out as $line) {
        echo '  ', $line, "\n";
    }
    check($label . ': todo en verde', $rc === 0, "exit {$rc}");
}

// ═══════════════════════════════════════ resumen ═══════════════════════════════════════
echo "\n" . str_repeat('═', 60) . "\n";
if ($fail === 0) {
    echo "\e[32m{$pass} comprobaciones OK\e[0m\n";
    exit(0);
}
echo "\e[31m{$fail} FALLOS\e[0m de " . ($pass + $fail) . ":\n";
foreach ($failed as $f) {
    echo "  - {$f}\n";
}
exit(1);
