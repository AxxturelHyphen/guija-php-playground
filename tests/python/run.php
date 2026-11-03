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
check('TypeError se explica', $e !== null && $e['severity'] === 'error' && $e['code'] === 'str-concat' && $e['line'] === 2, (string) ($e['title'] ?? 'sin diagnóstico'));

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
check('recursión infinita: error de pila explicado', $e !== null && $e['severity'] === 'error' && ($e['code'] ?? '') === 'stack-overflow', json_encode($e));

$r = runPy("a = []\nwhile True:\n    a.append(bytearray(20_000_000))\n", ['timeout' => 20]);
$e = $r['problems'][0] ?? null;
check('memoria agotada: error explicado, el servidor sigue vivo', $e !== null && $e['severity'] === 'error' && ($e['code'] ?? '') === 'out-of-memory' && $r['exit'] !== 0 && $e['line'] === 3, json_encode($e));

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

// ═══════════════════════════════════════ 6. sintaxis de todos los .py ═══════════════════════════════════════
section('Sintaxis (ast.parse) de todos los .py del motor, los fixtures y el contenido');
$pyFiles = [];
foreach (['app/Lang/Python/motor', 'tests/python/fixtures', 'contenido/python/ejemplos', 'contenido/python/soluciones'] as $d) {
    foreach (glob(PG_ROOT . "/{$d}/*.py") ?: [] as $f) {
        $pyFiles[] = $f;
    }
}
$mal = [];
foreach ($pyFiles as $f) {
    if ($py->syntaxError((string) file_get_contents($f)) !== null) {
        $mal[] = basename($f);
    }
}
check(count($pyFiles) . ' archivos .py sin errores de sintaxis', $mal === [] && $pyFiles !== [], implode(', ', $mal));

// ═══════════════════════════════════════ 7. métricas ═══════════════════════════════════════
section('Métricas: ciclomática, cognitiva y O() (los 12 fragmentos de tests/run.php portados a Python)');
$fixtures = [
    // nombre => [código, CC, cognitiva, clave O()]
    'sin decisiones' => ["def f():\n    return 1\n", 1, 0, '1'],
    'if + and + elif' => ["def f(x):\n    if x > 0 and x < 10:\n        return 1\n    elif x < 0:\n        return 2\n    return 3\n", 4, null, '1'],
    'bucles anidados con if' => ["def f(xs):\n    for x in xs:\n        if x:\n            while x:\n                x -= 1\n                print(1)\n", 4, 6, null],
    'match con comodín' => ["def f(x):\n    match x:\n        case 'a':\n            return -1\n        case 'b':\n            return 1\n        case _:\n            return 0\n", 3, null, '1'],
    'or y ternario' => ["def f(a, b):\n    return a or (1 if b else 2)\n", 3, null, '1'],
    'dos except' => ["def f():\n    try:\n        g()\n    except A:\n        print(1)\n    except B:\n        print(2)\n", 3, null, '1'],
    'match con casos' => ["def f(x):\n    match x:\n        case 1:\n            return 1\n        case 2:\n            return 2\n        case _:\n            return 0\n", 3, null, '1'],
    'dos bucles anidados' => ["def f(xs):\n    for a in xs:\n        for b in xs:\n            print(a, b)\n", 3, null, 'n2'],
    'un bucle' => ["def f(xs):\n    s = 0\n    for x in xs:\n        s += x\n    return s\n", 2, null, 'n'],
    'in sobre lista dentro de un bucle' => ["def f(xs):\n    r = []\n    for x in xs:\n        if x not in r:\n            r.append(x)\n    return r\n", 3, null, 'n2'],
    'fibonacci ingenuo' => ["def f(n: int) -> int:\n    return n if n < 2 else f(n - 1) + f(n - 2)\n", 2, null, 'exp'],
    'búsqueda binaria' => ["def f(a, x):\n    lo = 0\n    hi = len(a) - 1\n    while lo <= hi:\n        m = (lo + hi) // 2\n        if a[m] == x:\n            return m\n        if a[m] < x:\n            lo = m + 1\n        else:\n            hi = m - 1\n    return -1\n", 4, null, 'log'],
];
$unitF = static function (string $code, string $name = 'f') use ($py): ?array {
    foreach ($py->analyse($code)['units'] as $u) {
        if ($u['name'] === $name) {
            return $u;
        }
    }
    return null;
};
foreach ($fixtures as $name => [$body, $cc, $cog, $key]) {
    $u = $unitF($body);
    $problems = [];
    if ($u === null) {
        check($name, false, 'no se encontró la función f');
        continue;
    }
    $u['cc'] !== $cc && $problems[] = "CC {$u['cc']} (esperada {$cc})";
    $cog !== null && $u['cognitive'] !== $cog && $problems[] = "cognitiva {$u['cognitive']} (esperada {$cog})";
    $key !== null && $u['bigOKey'] !== $key && $problems[] = "O() {$u['bigOKey']} (esperada {$key})";
    check(sprintf('%s → CC %d, cognitiva %d, %s', $name, $u['cc'], $u['cognitive'], $u['bigO']), $problems === [], implode('; ', $problems));
}
$grades = [];
foreach ([5, 10, 20, 30, 40, 41] as $n) {
    $grades[] = $unitF("def f(x):\n" . str_repeat("    if x:\n        pass\n", $n - 1) . "    return 1\n")['grade'] ?? '?';
}
check('nota A–F: 5→A, 10→B, 20→C, 30→D, 40→E, 41→F', $grades === ['A', 'B', 'C', 'D', 'E', 'F'], implode('', $grades));
$a = $py->analyse("class C:\n    def m(self, a, b=2):\n        return a\n\nx = 1\nif x:\n    print(x)\n");
$um = array_values(array_filter($a['units'], static fn($u) => $u['name'] === 'm'))[0] ?? [];
$main = array_values(array_filter($a['units'], static fn($u) => $u['kind'] === 'main'))[0] ?? [];
check('método → qname Clase.metodo, firma sin self; código suelto → unidad main', ($um['qname'] ?? '') === 'C.m' && ($um['kind'] ?? '') === 'method' && ($um['signature'] ?? []) === ['a', 'b=2'] && ($main['cc'] ?? 0) === 2 && $a['summary']['functions'] === 1, json_encode([$um['signature'] ?? null, $main['cc'] ?? null]));
$cost = [
    'sorted → n log n' => ["def f(xs):\n    return sorted(xs)\n", 'nlogn'],
    'pop(0) en bucle → n²' => ["def f(xs):\n    while xs:\n        xs.pop(0)\n", 'n2'],
    'heapq → log' => ["import heapq\ndef f(h, x):\n    heapq.heappush(h, x)\n", 'log'],
    'merge sort → n log n' => ["def f(a):\n    if len(a) <= 1:\n        return a\n    m = len(a) // 2\n    l, r = f(a[:m]), f(a[m:])\n    return sorted(l + r)\n", 'nlogn'],
    'factorial → n' => ["def f(n):\n    return 1 if n <= 1 else n * f(n - 1)\n", 'n'],
    'recursión con @cache → n' => ["from functools import cache\n@cache\ndef f(n):\n    return n if n < 2 else f(n - 1) + f(n - 2)\n", 'n'],
    'memo en dict → n' => ["def f(n, memo={}):\n    if n in memo:\n        return memo[n]\n    memo[n] = n if n < 2 else f(n - 1, memo) + f(n - 2, memo)\n    return memo[n]\n", 'n'],
    'permutaciones (bucle + recursión) → exp' => ["def f(xs, cur=()):\n    if not xs:\n        return 1\n    for i in range(len(xs)):\n        f(xs[:i] + xs[i+1:], cur)\n", 'exp'],
    'x in set → 1 por consulta' => ["def f(xs, s):\n    s = set(s)\n    return [x for x in xs if x in s]\n", 'n'],
    'propagación entre funciones' => ["def g(xs):\n    return sorted(xs)\ndef f(xs):\n    for x in xs:\n        g(xs)\n", 'n2'],
];
foreach ($cost as $name => [$body, $key]) {
    $u = $unitF($body) ?? $unitF($body, 'f');
    check("O(): {$name}", ($u['bigOKey'] ?? '') === $key, ($u['bigOKey'] ?? 'sin f') . ' ' . ($u['bigO'] ?? ''));
}

// ═══════════════════════════════════════ 8. pistas y arreglos ═══════════════════════════════════════
section('Pistas y arreglos automáticos (cada arreglo debe dar código que pasa ast.parse)');

/** Aplica un arreglo ({edits:[{range:{sl,sc,el,ec}, text}]}) a un código; las columnas son UTF-16 como en Monaco. */
function applyFix(string $code, array $fix): string
{
    $lines = explode("\n", $code);
    $off = static function (int $l, int $c) use ($lines, $code): int {
        if ($l > count($lines)) {
            return strlen($code);
        }
        $base = 0;
        for ($i = 0; $i < $l - 1; $i++) {
            $base += strlen($lines[$i]) + 1;
        }
        $t = $lines[$l - 1];
        $u = 0;
        $b = 0;
        foreach (preg_split('//u', $t, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $ch) {
            if ($u >= $c - 1) {
                break;
            }
            $u += strlen($ch) === 4 ? 2 : 1;
            $b += strlen($ch);
        }
        return $base + $b;
    };
    $edits = [];
    foreach ($fix['edits'] as $e) {
        $r = $e['range'];
        $edits[] = [$off($r['sl'], $r['sc']), $off($r['el'], $r['ec']), $e['text']];
    }
    usort($edits, static fn($a, $b) => [$b[0], $b[1]] <=> [$a[0], $a[1]]);
    foreach ($edits as [$a, $b, $t]) {
        $code = substr($code, 0, $a) . $t . substr($code, $b);
    }
    return $code;
}

$hintCases = [
    // nombre => [código, código de la pista, ¿lleva arreglo?]
    'in sobre lista en bucle' => ["def f(xs):\n    r = []\n    for x in xs:\n        if x in r:\n            print(x)\n        r.append(x)\n", 'perf.in-array-loop', false],
    'pop(0) en bucle' => ["def f(xs):\n    while xs:\n        xs.pop(0)\n", 'perf.shift-loop', false],
    'insert(0) en bucle' => ["def f(xs):\n    r = []\n    for x in xs:\n        r.insert(0, x)\n    return r\n", 'perf.shift-loop', false],
    'lista = lista + [x] en bucle' => ["def f(xs):\n    r = []\n    for x in xs:\n        r = r + [x * 2]\n    return r\n", 'perf.merge-loop', true],
    'sorted dentro de un bucle' => ["def f(xs):\n    for x in xs:\n        print(sorted(xs))\n", 'perf.sort-loop', false],
    'recursión exponencial sin memo' => ["def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n", 'perf.recursion', true],
    'recursión exponencial con import previo' => ["import os\n\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\nprint(os.name)\n", 'perf.recursion', true],
    'recursión exponencial en un método' => ["class A:\n    def fib(self, n):\n        return n if n < 2 else self.fib(n - 1) + self.fib(n - 2)\n", 'perf.recursion', true],
    'código inalcanzable' => ["def f():\n    return 1\n    print('x')\n", 'flow.unreachable', true],
    'inalcanzable dentro de un if' => ["def f(x):\n    if x:\n        return 1\n        print('x')\n    return 2\n", 'flow.unreachable', true],
    'else tras return' => ["def f(x):\n    if x:\n        return 1\n    else:\n        return 2\n", 'flow.else-after-return', false],
    'except desnudo' => ["try:\n    x = 1\nexcept:\n    print('e')\n", 'flow.bare-except', true],
    'except vacío' => ["try:\n    x = 1\nexcept ValueError:\n    pass\n", 'flow.empty-catch', false],
    '== None' => ["x = 1\nif x == None:\n    print(x)\n", 'style.eq-none', true],
    '!= None con emoji delante' => ["s = '😀'\nif s != None:\n    print(s)\n", 'style.eq-none', true],
    'None == x' => ["x = 1\nprint(None == x)\n", 'style.eq-none', true],
    'argumento mutable (lista)' => ["def f(x, ys=[]):\n    ys.append(x)\n    return ys\n", 'style.mutable-default', true],
    'argumento mutable con docstring' => ["def f(x, d={}):\n    \"\"\"Doc.\"\"\"\n    d[x] = 1\n    return d\n", 'style.mutable-default', true],
    'argumento mutable en método' => ["class A:\n    def f(self, x, ys=[]):\n        ys.append(x)\n        return ys\n", 'style.mutable-default', true],
    'range(len(x))' => ["def f(xs):\n    for i in range(len(xs)):\n        print(xs[i])\n", 'style.range-len', false],
    'nombre que tapa un builtin' => ["def f(list):\n    return len(list)\n", 'style.shadow-builtin', false],
    'variable sin usar' => ["def f():\n    a = 1\n    return 2\n", 'unused.var', false],
    'parámetro sin usar' => ["def f(x, y):\n    return x\n", 'unused.param', false],
    'import sin usar (una línea)' => ["import os\nx = 1\n", 'unused.import', true],
    'import sin usar (uno de varios)' => ["import sys, re\nprint(sys.argv)\n", 'unused.import', true],
    'from import sin usar' => ["from math import sqrt, floor\nprint(floor(1.5))\n", 'unused.import', true],
    'ciclomática alta' => ["def f(x):\n" . str_repeat("    if x == 1:\n        return 1\n", 12) . "    return 0\n", 'cx.cyclomatic', false],
    'función sin anotaciones' => ["def f(x):\n    return x\n", 'types.missing', false],
];
foreach ($hintCases as $name => [$code, $want, $hasFix]) {
    $diags = array_values(array_filter($py->analyse($code)['diagnostics'], static fn($d) => $d['code'] === $want));
    $d = $diags[0] ?? null;
    if ($d === null) {
        check("pista {$name} → {$want}", false, 'no apareció');
        continue;
    }
    $okFix = true;
    $detail = '';
    if ($hasFix) {
        $fixed = null;
        if (empty($d['fixes'])) {
            $okFix = false;
            $detail = 'sin arreglo';
        } else {
            $fixed = applyFix($code, $d['fixes'][0]);
            $okFix = $py->syntaxError($fixed) === null;
            $quedan = array_filter($py->analyse($fixed)['diagnostics'], static fn($x) => $x['code'] === $want && $x['line'] === $d['line']);
            $okFix = $okFix && $quedan === [];
            $detail = $okFix ? '' : "tras el arreglo: " . str_replace("\n", '⏎', $fixed);
        }
    } elseif (!empty($d['fixes'])) {
        $okFix = false;
        $detail = 'no debería ofrecer arreglo';
    }
    check("pista {$name} → {$want}" . ($hasFix ? ' (arreglo válido)' : ''), $okFix && !preg_match('/java/i', json_encode($d)), $detail);
}
check('un código limpio no produce pistas de rendimiento ni de flujo', array_filter($py->analyse("def suma(xs: list[int]) -> int:\n    total = 0\n    for x in xs:\n        total += x\n    return total\n")['diagnostics'], static fn($d) => $d['severity'] !== 'hint') === []);
$e = $py->analyse("def f(x):\n    s = '😀😀'\n    if x == None:\n        return s\n")['diagnostics'];
$d = array_values(array_filter($e, static fn($d) => $d['code'] === 'style.eq-none'))[0] ?? null;
check('columnas en UTF-16 en las pistas (== tras dos emojis: columna 10)', $d !== null && $d['line'] === 3 && $d['col'] === 10, json_encode([$d['line'] ?? null, $d['col'] ?? null]));

// ═══════════════════════════════════════ 9. explicaciones ═══════════════════════════════════════
section('Errores explicados: cada caso se ejecuta de verdad (y los arreglos se vuelven a ejecutar)');
$expl = [
    // nombre => [código, código esperado, trozo del título/explicación (o null), ¿arreglo?, opciones]
    'NameError con errata' => ["contador = 1\nprint(contadro)\n", 'undefined-variable', 'contadro', true],
    'NameError: falta import math' => ["print(math.sqrt(4))\n", 'undefined-variable', 'math', true],
    'UnboundLocalError' => ["x = 1\ndef f():\n    x += 1\nf()\n", 'unbound-local', null, false],
    'int + str' => ["print(1 + '2')\n", 'str-concat', null, false],
    'str + int → f-string' => ["edad = 5\nprint('Edad: ' + edad)\n", 'str-concat', null, true],
    'int + str (variable primero)' => ["edad = 5\nprint(edad + ' años')\n", 'str-concat', null, true],
    'None[0]' => ["x = None\nprint(x[0])\n", 'member-on-null', null, false],
    'for sobre None' => ["for i in None:\n    pass\n", 'member-on-null', null, false],
    'None()' => ["x = None\nx()\n", 'member-on-null', null, false],
    'faltan argumentos' => ["def f(a, b):\n    pass\nf(1)\n", 'too-few-arguments', null, false],
    'sobran argumentos' => ["def f(a):\n    pass\nf(1, 2)\n", 'too-many-arguments', null, false],
    'método sin self' => ["class A:\n    def m():\n        pass\nA().m()\n", 'too-many-arguments', 'self', false],
    'argumento con nombre inexistente' => ["def f(a):\n    pass\nf(b=1)\n", 'argument-name', null, false],
    'unhashable list' => ["d = {[1]: 2}\n", 'unhashable', null, false],
    'objeto no iterable' => ["for i in 5:\n    pass\n", 'not-iterable', null, false],
    'range con decimal → //' => ["for i in range(10 / 2):\n    pass\n", 'float-as-int', null, true],
    'índice que no es entero' => ["xs = [1, 2]\nprint(xs['a'])\n", 'index-type', null, false],
    'str inmutable' => ["s = 'abc'\ns[0] = 'x'\n", 'immutable', null, false],
    '.sort() devuelve None' => ["xs = [3, 1]\nxs = xs.sort()\nxs.append(1)\n", 'member-on-null', 'sort', true],
    'atributo con errata' => ["xs = [1]\nxs.apend(2)\n", 'undefined-attribute', null, true],
    'push en vez de append' => ["xs = [1]\nxs.push(2)\n", 'undefined-attribute', 'append', false],
    'IndexError' => ["xs = [1, 2]\nprint(xs[5])\n", 'index-out-of-range', null, false],
    'KeyError → get' => ["d = {'a': 1}\nprint(d['b'])\n", 'undefined-key', null, true],
    'ZeroDivisionError' => ["print(1 / 0)\n", 'division-by-zero', null, false],
    'int() con texto' => ["int('abc')\n", 'invalid-number', 'abc', false],
    'unpacking' => ["a, b = [1]\n", 'unpack', null, false],
    'remove inexistente' => ["[1].remove(5)\n", 'not-in-list', null, false],
    'RecursionError' => ["def f(n):\n    return f(n + 1)\nf(0)\n", 'stack-overflow', 'f()', false],
    'módulo que no existe' => ["import modulo_inventado\n", 'module-not-found', null, false],
    'input() sin datos' => ["input()\n", 'eof', null, false],
    'falta ":"' => ["if True\n    print(1)\n", 'parse.colon', null, true],
    'paréntesis sin cerrar' => ["print((1 + 2)\nx = 1\n", 'parse.unclosed', null, true],
    '= en vez de ==' => ["x = 1\nif x = 5:\n    pass\n", 'parse.assign-eq', null, true],
    'cadena sin cerrar' => ["print(\"hola)\n", 'parse.string', null, true],
    'else if' => ["x = 1\nif x:\n    pass\nelse if x:\n    pass\n", 'parse.else-if', null, true],
    'i++' => ["i = 0\ni++\n", 'parse.increment', null, true],
    'IndentationError' => ["def f():\nreturn 1\n", 'parse.indent', null, false],
    'comillas tipográficas' => ["print(“hola”)\n", 'parse.char', null, true],
    'print sin paréntesis' => ["print 'hola'\n", 'parse.print', null, true],
    'excepción genérica' => ["raise Exception('mi error')\n", 'generic', 'mi error', false],
    'SyntaxWarning: is con literal' => ["x = 5\nif x is 5:\n    print(x)\n", 'is-literal', null, true],
    'RuntimeWarning de numpy' => ["import numpy as np\nprint(np.array([1.0]) / 0)\n", 'numpy-runtime', null, false],
];
foreach ($expl as $name => [$code, $want, $needle, $hasFix]) {
    $r = runPy($code, ['timeout' => 20]);
    $p = $r['problems'][0] ?? null;
    if ($p === null || $p['code'] !== $want) {
        check("explicación {$name} → {$want}", false, 'obtenido: ' . json_encode([$p['code'] ?? null, $p['title'] ?? null], JSON_UNESCAPED_UNICODE));
        continue;
    }
    $ok = trim($p['explain']) !== '' && str_contains($p['original'], $r['problems'][0]['original']) && ($needle === null || stripos(json_encode($p, JSON_UNESCAPED_UNICODE), $needle) !== false);
    $detail = $ok ? '' : 'falta «' . $needle . '» o la explicación está vacía';
    if ($hasFix && $ok) {
        if (empty($p['fixes'])) {
            $ok = false;
            $detail = 'sin arreglo';
        } else {
            $fixed = applyFix($code, $p['fixes'][0]);
            $r2 = runPy($fixed, ['timeout' => 20]);
            $ok = $py->syntaxError($fixed) === null && array_filter($r2['problems'], static fn($x) => $x['code'] === $want) === [];
            $detail = $ok ? '' : 'tras el arreglo: ' . str_replace("\n", '⏎', $fixed) . ' → ' . ($r2['problems'][0]['code'] ?? '');
        }
    }
    check("explicación {$name} → {$want}" . ($hasFix ? ' (arreglo)' : ''), $ok, $detail);
}
$r = runPy("while True:\n    pass\n", ['timeout' => 2]);
$p = $r['problems'][0] ?? [];
check('timeout: usa el límite (2 s) en el título', ($p['code'] ?? '') === 'timeout' && str_contains($p['title'], '2 s'), $p['title'] ?? '');
$r = runPy("a = []\nwhile True:\n    a.append(bytearray(20_000_000))\n", ['timeout' => 20]);
check('memoria: code out-of-memory', ($r['problems'][0]['code'] ?? '') === 'out-of-memory', $r['problems'][0]['code'] ?? '');
$ex = (new \Playground\Lang\Python\PyExplainer("import librosa\n", $py))->explain(['kind' => 'exception', 'cls' => 'ModuleNotFoundError', 'name' => 'librosa', 'msg' => "No module named 'librosa'", 'line' => 1]);
check('ModuleNotFoundError de librosa: cómo instalarlo con requirements-audio.txt', str_contains($ex['hint'], 'requirements-audio.txt') && str_contains($ex['hint'], 'pip install'), $ex['hint'] ?? '');
$ex = (new \Playground\Lang\Python\PyExplainer("import numpy\n", $py))->explain(['kind' => 'exception', 'cls' => 'ModuleNotFoundError', 'name' => 'numpy', 'msg' => "No module named 'numpy'", 'line' => 1]);
check('ModuleNotFoundError de numpy: requirements.txt', str_contains($ex['hint'], 'requirements.txt') && $ex['code'] === 'module-not-found');

// ═══════════════════════════════════════ 10. soluciones ═══════════════════════════════════════
section('Soluciones: empalmar (splice), no duplicar, conservar y comparar');
$solutions = new \Playground\Core\Solutions($py);
$user = <<<'PY'
from __future__ import annotations

# Teoría: esto no se toca
LIMITE = 10


# Mi versión: todavía sin hacer
def fibonacci(n: int) -> int:
    """Mi versión."""
    pendiente()


class Pila:
    def __init__(self):
        self.items = []


def otra() -> str:
    return 'intacta'


print(fibonacci(5), otra())
PY;
$sol = <<<'PY'
from __future__ import annotations


def fibonacci(n: int) -> int:
    """Fibonacci iterativo.

    @complejidad Tiempo O(n), espacio O(1).
    @explicacion Guarda solo los dos
    últimos valores.
    @alternativas Recursiva ingenua: O(2^n).
    @bigo n
    """
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


def ayuda(x: int) -> int:
    return x * 2


class Pila:
    def __init__(self):
        self.items = []

    def push(self, x):
        self.items.append(x)
PY;
$decls = $py->declarations($sol);
check('declarations(): claves function:<nombre> y type:<clase>', array_keys($decls) === ['function:fibonacci', 'function:ayuda', 'type:pila'], implode(',', array_keys($decls)));
$d = $py->declarations($user)['function:fibonacci'] ?? [];
check('declarations(): start/end en bytes incluyen el comentario pegado; doc y norm', str_starts_with(substr($user, $d['start'], 30), '# Mi versión') && str_ends_with(substr($user, $d['start'], $d['end'] - $d['start']), 'pendiente()') && $d['doc'] === 'Mi versión.' && $d['kind'] === 'function', json_encode($d, JSON_UNESCAPED_UNICODE));
$spliced = $solutions->splice($user, $sol);
check('el resultado no tiene errores de sintaxis', $py->syntaxError($spliced) === null);
check('fibonacci sustituida (ya no hay pendiente())', !str_contains($spliced, 'pendiente()') && str_contains($spliced, 'a, b = b, a + b'));
check('auxiliar añadida tras los imports', str_contains($spliced, 'def ayuda') && strpos($spliced, 'def ayuda') > strpos($spliced, 'from __future__'));
check('clase sustituida (no duplicada)', substr_count($spliced, 'class Pila') === 1 && str_contains($spliced, 'def push'));
check('no se duplica al empalmar dos veces', substr_count($solutions->splice($spliced, $sol), 'def ayuda') === 1);
check('teoría y funciones no tocadas se conservan', str_contains($spliced, 'LIMITE = 10') && str_contains($spliced, "return 'intacta'") && str_contains($spliced, '# Teoría'));
$run = runPy($spliced);
check('el código empalmado se ejecuta y da «5 intacta»', trim(textOf($run)) === '5 intacta' && $run['problems'] === [], trim(textOf($run)) . ' ' . json_encode($run['problems'][0]['title'] ?? ''));
$cmp = $solutions->compare($user, $sol);
$byKey = array_column($cmp, null, 'key');
check('compare() antes: fibonacci no implementada y distinta', $byKey['function:fibonacci']['implemented'] === false && $byKey['function:fibonacci']['same'] === false);
check('compare() antes: ayuda no existe; Pila implementada pero distinta', $byKey['function:ayuda']['mine'] === null && $byKey['type:pila']['implemented'] === true && $byKey['type:pila']['same'] === false);
$cmp2 = array_column($solutions->compare($spliced, $sol), null, 'key');
check('compare() después: todo implemented y same', $cmp2 !== [] && !in_array(false, array_merge(array_column($cmp2, 'implemented'), array_column($cmp2, 'same')), true));
$doc = $byKey['function:fibonacci']['doc'];
check('el docstring documenta la solución: @complejidad, @explicacion (varias líneas), @alternativas, @bigo', ($doc['bigo'] ?? '') === 'n' && str_starts_with($doc['complejidad'] ?? '', 'Tiempo O(n)') && str_contains($doc['explicacion'] ?? '', "dos\núltimos") && ($doc['text'] ?? '') === 'Fibonacci iterativo.', json_encode($doc, JSON_UNESCAPED_UNICODE));

// ═══════════════════════════════════════ 11. analizador residente ═══════════════════════════════════════
section('Analizador residente: arranque, protocolo, seguridad, respaldo y velocidad');
$py->analyse("x = 1\n");
$infoFile = PG_VAR . '/python/analizador.json';
$info = json_decode((string) @file_get_contents($infoFile), true);
check('arranca bajo demanda y publica {port, token, pid}', is_array($info) && isset($info['port'], $info['token'], $info['pid']) && strlen($info['token']) >= 16);
$send = static function (string $raw) use ($info): string {
    $fp = @stream_socket_client('tcp://127.0.0.1:' . $info['port'], $en, $es, 2);
    if (!$fp) {
        return 'SIN CONEXIÓN';
    }
    stream_set_timeout($fp, 2);
    fwrite($fp, $raw);
    $out = (string) stream_get_contents($fp);
    fclose($fp);
    return $out;
};
$out = $send(json_encode(['modo' => 'analyse', 'codigo' => 'x = 1']) . "\n");
check('rechaza una petición sin token', str_contains($out, '"error"') && !str_contains($out, 'units'), $out);
$out = $send(json_encode(['token' => 'mal', 'modo' => 'analyse', 'codigo' => 'x = 1']) . "\n");
check('rechaza una petición con token incorrecto', str_contains($out, '"error"') && !str_contains($out, 'units'), $out);
$out = $send("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
check('no habla HTTP: lo que no empieza por «{» se cierra sin contestar', $out === '', substr($out, 0, 60));
$out = $send(json_encode(['token' => $info['token'], 'modo' => 'analyse', 'codigo' => "def f(x):\n    return x\n"]) . "\n");
check('con token válido contesta una línea JSON con units (tras los rechazos sigue vivo)', str_contains($out, '"units"') && str_ends_with($out, "\n"), substr($out, 0, 80));
$fixture = (string) file_get_contents(__DIR__ . '/fixtures/medio_400.py');
$t = [];
for ($i = 0; $i < 21; $i++) {
    $c = $fixture . "\n# variante {$i}\n";
    $t0 = hrtime(true);
    $py2 = new \Playground\Lang\Python\PythonLanguage();
    $r = $py2->analyse($c);
    $t[] = (hrtime(true) - $t0) / 1e6;
}
sort($t);
echo sprintf("  lint del fixture de %d líneas con el analizador caliente: p50 %.1f ms · p95 %.1f ms · %d unidades\n", substr_count($fixture, "\n"), $t[10], $t[19], count($r['units']));
check('lint (analyse) con el analizador caliente: p50 ≤ 30 ms', $t[10] <= 30, sprintf('%.1f ms', $t[10]));
// Respaldo: sin analizador residente se usa un proceso por petición
putenv('PG_ANALIZADOR=0');
$t0 = hrtime(true);
$rb = (new \Playground\Lang\Python\PythonLanguage())->analyse($fixture . "\n# respaldo\n");
$msFallback = (hrtime(true) - $t0) / 1e6;
putenv('PG_ANALIZADOR');
echo sprintf("  respaldo (un proceso por petición): %.0f ms\n", $msFallback);
check('el respaldo da el mismo resultado que el residente', count($rb['units']) === count($r['units']) && $rb['summary']['ccTotal'] === $r['summary']['ccTotal']);
// Se mata el analizador: la siguiente petición sigue funcionando (arranca otro o usa el respaldo)
if (DIRECTORY_SEPARATOR === '\\') {
    exec('taskkill /F /PID ' . (int) $info['pid'] . ' >NUL 2>&1');
} else {
    exec('kill -9 ' . (int) $info['pid'] . ' 2>/dev/null');
}
usleep(200_000);
putenv('PG_ANALIZADOR=0');
$rk = (new \Playground\Lang\Python\PythonLanguage())->analyse("def f():\n    return 1\n");
putenv('PG_ANALIZADOR');
check('analizador muerto + sin residente: cae al proceso por petición', count($rk['units']) === 1);
$rk = (new \Playground\Lang\Python\PythonLanguage())->analyse("def g():\n    return 2\n");
$info2 = json_decode((string) @file_get_contents($infoFile), true);
check('analizador muerto: la siguiente petición se atiende (se relanza otro, con otro pid)', count($rk['units']) === 1 && is_array($info2) && $info2['pid'] !== $info['pid'], json_encode($info2));

// ═══════════════════════════════════════ 12. contenido ═══════════════════════════════════════
if (is_dir($py->examplesDir())) {
    require_once __DIR__ . '/../content_check.php';
    section('Contenido: ejemplos y soluciones de Python');
    $skipped = [];
    $fails = content_check(null, false, 'python', $skipped);
    check('ejemplos y soluciones de contenido/python', $fails === [], implode(' | ', array_slice($fails, 0, 3)));
}

if (!$fast) {
    // ═══════════════════════════════════════ 13. smoke HTTP ═══════════════════════════════════════
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

    // ═══════════════════════════════════════ 14. tiempos ═══════════════════════════════════════
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

\Playground\Lang\Python\PythonLanguage::pararResidente();
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
