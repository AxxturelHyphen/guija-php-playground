<?php
declare(strict_types=1);

/**
 * Autotest del motor de Python (mismo estilo que tests/run.php).
 *
 *   php tests/python/run.php            todo
 *   php tests/python/run.php --rapido   sin el smoke HTTP ni las mediciones de tiempo
 *
 * Los datos de prueba viven solo en tests/python/fixtures/. Código de salida 1 si algo falla.
 */
require_once dirname(__DIR__, 2) . '/app/bootstrap.php';

use Playground\Core\{Languages, Report};

$py = Languages::get('python');
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

function runPy(string $code, array $opts = []): array
{
    $py = Languages::get('python');
    return Report::build($py->run($code, 'tu_codigo.py', $opts + ['timeout' => 10]), $py->explainer($code));
}

function textOf(array $r): string
{
    return implode('', array_column(array_filter($r['segments'], static fn($s) => $s['t'] === 'out'), 'text'));
}

// ═══════════════════════════════════════ 1. entorno ═══════════════════════════════════════
section('Entorno: intérprete, meta() y caché');
$meta = $py->meta();
check('meta(): Python 3.11+ con numpy y matplotlib (' . ($meta['version'] ?? 'sin Python') . ')', $meta['ok'] === true && version_compare((string) $meta['version'], '3.11', '>='), json_encode($meta['missing']));
if (!$meta['ok']) {
    echo "  Sin entorno de Python completo no se puede seguir.\n";
    exit(1);
}
check('caché var/python.json escrita', is_file(PG_VAR . '/python.json') && is_array(json_decode((string) file_get_contents(PG_VAR . '/python.json'), true)));
$t0 = microtime(true);
$py2 = new \Playground\Lang\Python\PythonLanguage();
$py2->meta();
check('meta() con caché no lanza procesos (< 30 ms)', (microtime(true) - $t0) < 0.03, round((microtime(true) - $t0) * 1000) . ' ms');

// ═══════════════════════════════════════ 2. harness ═══════════════════════════════════════
section('Harness: errores, excepciones, timeout, memoria, stdin y pruebas');

$r = runPy("import warnings\nprint('a')\nwarnings.warn('ojo', UserWarning)\nprint('b')\n");
$w = array_values(array_filter($r['problems'], static fn($p) => $p['severity'] === 'warning'));
check('warning con su línea y salida intacta', $r['exit'] === 0 && count($w) === 1 && $w[0]['line'] === 3 && str_contains(textOf($r), "a\n") && str_contains(textOf($r), "b\n"), json_encode($w[0] ?? null));

$r = runPy("def f():\n    raise RuntimeError('boom')\nf()\n");
$e = $r['problems'][0] ?? null;
check('excepción no capturada: error explicado con línea y traza', $r['exit'] !== 0 && $e !== null && $e['severity'] === 'error' && $e['line'] === 2 && !empty($e['title']) && !empty($e['trace']) && str_contains($e['title'], 'boom'), json_encode($e));

$r = runPy("def f(x: int) -> int:\n    return x + 1\nprint(f('5'))\n");
$e = $r['problems'][0] ?? null;
check('TypeError se explica', $e !== null && $e['severity'] === 'error' && str_contains($e['title'], 'TypeError') && $e['line'] === 2, (string) ($e['title'] ?? 'sin diagnóstico'));

$r = runPy("print(nombre_mal)\n");
$ev = $py->run("print(nombre_mal)\n", 'tu_codigo.py');
$errEv = null;
foreach ($ev['items'] as $it) {
    if ($it['t'] === 'ev' && ($it['ev']['t'] ?? '') === 'err') {
        $errEv = $it['ev'];
    }
}
check('NameError lleva name y candidates (para «¿quisiste decir…?»)', $errEv !== null && ($errEv['name'] ?? '') === 'nombre_mal' && in_array('print', $errEv['candidates'] ?? [], true));

$t0 = microtime(true);
$r = runPy("while True:\n    pass\n", ['timeout' => 2]);
$e = $r['problems'][0] ?? null;
check('bucle infinito: se corta y se explica (< 8 s)', $r['exit'] !== 0 && $e !== null && $e['severity'] === 'error' && $e['line'] === 1 && microtime(true) - $t0 < 8, 'tardó ' . round(microtime(true) - $t0, 1) . ' s; ' . ($e['title'] ?? 'sin diagnóstico'));

$t0 = microtime(true);
$r = runPy("try:\n    while True:\n        pass\nexcept BaseException:\n    pass\nwhile True:\n    pass\n", ['timeout' => 2]);
check('bucle infinito que se traga la interrupción: también se corta (< 8 s)', ($r['problems'][0]['severity'] ?? '') === 'error' && microtime(true) - $t0 < 8, 'tardó ' . round(microtime(true) - $t0, 1) . ' s');

$r = runPy("def f(n):\n    return f(n + 1)\nf(0)\n");
$e = $r['problems'][0] ?? null;
check('recursión infinita: error de pila explicado', $e !== null && $e['severity'] === 'error' && ($e['code'] ?? '') === 'stack', json_encode($e));

$r = runPy("a = []\nwhile True:\n    a.append(bytearray(20_000_000))\n", ['timeout' => 20]);
$e = $r['problems'][0] ?? null;
check('memoria agotada: error explicado, el servidor sigue vivo', $e !== null && $e['severity'] === 'error' && ($e['code'] ?? '') === 'memory' && $r['exit'] !== 0 && $e['line'] === 3, json_encode($e));

$r = runPy("while True:\n    print('a' * 5000)\n", ['timeout' => 20]);
check('salida desbordada (1 MB): se corta', $r['killed'] === 'output' || array_filter($r['segments'], static fn($s) => $s['t'] === 'note') !== [], 'killed=' . var_export($r['killed'], true));

$r = runPy("n = int(input())\nprint(n * 2)\n", ['stdin' => "21\n"]);
check('stdin llega al programa', str_contains(textOf($r), '42'));

$r = runPy("print('ñandú ✓ 😀')\n");
check('salida UTF-8 intacta', str_contains(textOf($r), 'ñandú ✓ 😀'));

$r = runPy("import sys\nprint(__file__)\ndef x():\n    raise Exception('secreto')\nx()\n");
$json = (string) json_encode($r);
check('no se filtran rutas temporales del sistema', !str_contains($json, str_replace('\\', '\\\\', sys_get_temp_dir())) && !str_contains($json, 'pg_') && str_contains($json, 'tu_codigo.py'), '');

$code = <<<'PY'
def doble(x): return x * 2
def triple(x): return x + 3
def pendiente_fn():
    pendiente()
class Boom(Exception): pass
prueba('doble', {'dos': ((2,), 4), 'cero': ((0,), 0)})
prueba('triple', {'mal': ((2,), 6)})
prueba('pendiente_fn', {'algo': ((), 1)})
comprueba('lanza dentro', lambda: 1 / 0, 1)
lanza('lanza bien', lambda: (_ for _ in ()).throw(Boom('x')), Boom)
prueba('doble', {'sin orden': ((1,), 2)}, None, True)
PY;
$r = runPy($code);
$s = $r['testSummary'];
check("pruebas: 4 ✓, 1 ✗, 1 error, 1 ⏳ (obtenido {$s['pass']} ✓ {$s['fail']} ✗ {$s['error']} error {$s['todo']} ⏳)", $s['pass'] === 4 && $s['fail'] === 1 && $s['error'] === 1 && $s['todo'] === 1);

$r = runPy("def suma(xs): return sum(xs)\nmedir('suma', lambda n: (list(range(n)),))\n", ['bench' => true, 'benchBudgetMs' => 1500, 'timeout' => 30]);
$b = $r['benches'][0] ?? null;
check('medir(): puntos y modelo O(n)', $b !== null && $b['status'] === 'ok' && count($b['points']) >= 5 && in_array($b['model'], ['n', 'nlogn', '1'], true), json_encode($b['model'] ?? $b));

$r = runPy("def suma(xs): return sum(xs)\nmedir('suma', lambda n: (list(range(n)),))\n");
check('medir() sin «Medir» se omite', ($r['benches'][0]['status'] ?? '') === 'skipped');

$r = runPy("def ordena(xs):\n    xs.sort()\n    return xs\nmedir(ordena, lambda n: (list(range(n, 0, -1)),))\n", ['bench' => true, 'timeout' => 30]);
check('medir() con una función que modifica su entrada: copia por repetición', ($r['benches'][0]['status'] ?? '') === 'ok' && count($r['benches'][0]['points']) >= 5);

// ═══════════════════════════════════════ 3. igual() ═══════════════════════════════════════
section('igual(): reglas de la igualdad estricta');
$code = <<<'PY'
import numpy as np
import pg_harness as h
casos = [
    ('int != float', h.igual(1, 1.0), False), ('int != bool', h.igual(1, True), False),
    ('float con tolerancia', h.igual(0.1 + 0.2, 0.3), True), ('NaN == NaN', h.igual(float('nan'), float('nan')), True),
    ('list != tuple', h.igual([1], (1,)), False), ('dict con orden', h.igual({'a': 1, 'b': 2}, {'b': 2, 'a': 1}), False),
    ('dict sin_orden', h.igual({'a': 1, 'b': 2}, {'b': 2, 'a': 1}, True), True),
    ('set como conjunto', h.igual({1, 2}, {2, 1}), True), ('set != frozenset', h.igual({1}, frozenset({1})), True),
    ('lista sin_orden', h.igual([3, 1, 2], [1, 2, 3], True), True), ('lista con orden', h.igual([3, 1, 2], [1, 2, 3]), False),
    ('ndarray allclose', h.igual(np.array([1.0, 2.0]), np.array([1.0, 2.0 + 1e-12])), True),
    ('ndarray shape', h.igual(np.zeros((2, 2)), np.zeros(4)), False), ('np.float64 == float', h.igual(np.float64(2.5), 2.5), True),
    ('anidado', h.igual({'x': [1, (2, 3)]}, {'x': [1, (2, 3)]}), True),
]
for nombre, obtenido, esperado in casos:
    print('OK' if obtenido == esperado else 'MAL', nombre)
PY;
$r = runPy($code);
$txt = textOf($r);
check('15 reglas de igual() (int/float/bool, tolerancia, NaN, list/tuple, dict, set, ndarray, sin_orden)', substr_count($txt, 'OK ') === 15 && !str_contains($txt, 'MAL'), trim($txt) . ' ' . json_encode($r['problems'][0]['title'] ?? ''));

// ═══════════════════════════════════════ 4. sintaxis, numpy y matplotlib ═══════════════════════════════════════
section('Sintaxis, numpy y matplotlib');
$t0 = microtime(true);
$syntax = $py->syntaxError("x = 1\nprint(x\nprint('é😀')\n");
$ms1 = (microtime(true) - $t0) * 1000;
check('error de sintaxis detectado sin lanzar el programa', $syntax !== null && $syntax['kind'] === 'parse' && $syntax['line'] >= 2 && isset($syntax['col'], $syntax['endLine'], $syntax['endCol'], $syntax['cls']), json_encode($syntax));
$s2 = $py->syntaxError("print('😀' ,, 1)\n");
check('columnas en UTF-16 (un emoji ocupa 2)', $s2 !== null && $s2['col'] === 13, json_encode($s2));
check('código correcto → null (y la segunda vez sale de la caché)', $py->syntaxError("x = 1\n") === null && $py->syntaxError("x = 1\n") === null);
$r = runPy("def f(:\n    pass\n");
check('un SyntaxError al ejecutar también se explica con línea', ($r['problems'][0]['line'] ?? 0) === 1 && $r['exit'] !== 0);

$r = runPy("import numpy as np\na = np.arange(6).reshape(2, 3)\nprint(a.sum(), a.shape)\nprueba(lambda: a.tolist(), {'ok': ((), [[0, 1, 2], [3, 4, 5]])})\ncomprueba('array', lambda: a, np.arange(6).reshape(2, 3))\n", ['timeout' => 20]);
check('numpy funciona (y los ndarray se comparan)', str_contains(textOf($r), '15 (2, 3)') && $r['testSummary']['pass'] === 2, json_encode($r['problems']));

$r = runPy("import matplotlib.pyplot as plt\nplt.plot([1, 2, 3], [1, 4, 9])\nplt.title('Cuadrados')\nplt.show()\nplt.figure()\nplt.bar([1, 2], [3, 4])\n", ['timeout' => 30]);
$imgs = array_values(array_filter($r['segments'], static fn($s) => $s['t'] === 'img'));
check('matplotlib: plt.show() y la figura sin mostrar → 2 segmentos img PNG', count($imgs) === 2 && str_starts_with(base64_decode($imgs[0]['data']), "\x89PNG") && $imgs[0]['title'] === 'Cuadrados' && $r['exit'] === 0, count($imgs) . ' imágenes; ' . json_encode($r['problems']));

// ═══════════════════════════════════════ 5. insertionPoint ═══════════════════════════════════════
section('insertionPoint(): tras docstring, __future__ e imports iniciales');
$ip = static fn(string $c): string => substr($c, 0, $py->insertionPoint($c, []));
check('sin nada → 0', $py->insertionPoint("x = 1\n", []) === 0);
check('docstring + from __future__ + imports', $ip("\"\"\"Doc\n varias líneas\"\"\"\nfrom __future__ import annotations\nimport os\nfrom a import (b,\n   c)\n\nx = 1\n") === "\"\"\"Doc\n varias líneas\"\"\"\nfrom __future__ import annotations\nimport os\nfrom a import (b,\n   c)");
check('shebang y comentarios iniciales', $ip("#!/usr/bin/env python\n# hola\nimport sys\n\ndef f(): pass\n") === "#!/usr/bin/env python\n# hola\nimport sys");
check('un import tras código no cuenta', $ip("x = 1\nimport os\n") === '');

if (!$fast) {
    // ═══════════════════════════════════════ 6. smoke HTTP ═══════════════════════════════════════
    section('Servidor real (php -S): /api?lang=python&action=run');
    $port = random_int(20000, 60000);
    $log = sys_get_temp_dir() . '/pg_http_py.log';
    $proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:{$port}", 'index.php'], [0 => ['pipe', 'r'], 1 => ['file', $log, 'w'], 2 => ['file', $log, 'a']], $pipes, PG_ROOT);
    $http = static function (string $method, string $target, array $headers = [], ?string $body = null) use ($port): array {
        $headers += ['Host' => "127.0.0.1:{$port}"];
        $fp = @stream_socket_client("tcp://127.0.0.1:{$port}", $errno, $errstr, 3);
        if (!$fp) {
            return ['status' => 0, 'body' => $errstr];
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
        return ['status' => (int) ($m[1] ?? 0), 'body' => $content];
    };
    $up = false;
    for ($i = 0; $i < 50 && !$up; $i++) {
        $up = $http('GET', '/api?action=meta')['status'] === 200;
        $up || usleep(100_000);
    }
    check('servidor arrancado', $up);
    if ($up) {
        $r = $http('POST', '/api?lang=python&action=run', ['Content-Type' => 'application/json', 'X-Playground' => '1'], json_encode(['code' => 'print(6*7)']));
        $j = json_decode($r['body'], true);
        check('POST run con print(6*7) → 42', $r['status'] === 200 && str_contains(json_encode($j), '42') && str_contains(implode('', array_column($j['segments'] ?? [], 'text')), '42'), "status {$r['status']} " . mb_substr($r['body'], 0, 200));
    }
    if (is_resource($proc)) {
        proc_terminate($proc);
        proc_close($proc);
    }
    @unlink($log);

    // ═══════════════════════════════════════ 7. tiempos ═══════════════════════════════════════
    section('Tiempos (informativo; objetivo del archivo de ~400 líneas: p50 ≤ 400 ms)');
    $p50 = static function (string $code): float {
        $t = [];
        for ($i = 0; $i < 5; $i++) {
            $t0 = hrtime(true);
            runPy($code);
            $t[] = (hrtime(true) - $t0) / 1e6;
        }
        sort($t);
        return $t[2];
    };
    $hola = $p50("print('hola')\n");
    $medio = $p50((string) file_get_contents(__DIR__ . '/fixtures/medio_400.py'));
    $r = runPy((string) file_get_contents(__DIR__ . '/fixtures/medio_400.py'));
    echo sprintf("  hola mundo: p50 %.0f ms · fixture %d líneas, %d pruebas: p50 %.0f ms\n", $hola, substr_count((string) file_get_contents(__DIR__ . '/fixtures/medio_400.py'), "\n"), $r['testSummary']['pass'], $medio);
    check('fixture de ~400 líneas: pruebas en verde y p50 ≤ 400 ms', $r['testSummary']['pass'] === 60 && $r['testSummary']['fail'] === 0 && $medio <= 400, sprintf('%.0f ms', $medio));
}

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
