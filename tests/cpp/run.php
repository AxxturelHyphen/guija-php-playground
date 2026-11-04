<?php
declare(strict_types=1);

/**
 * Autotest del motor de C++ (mismo estilo que tests/java/run.php).
 *
 *   php tests/cpp/run.php            todo
 *   php tests/cpp/run.php --rapido   sin las comprobaciones lentas (timeout, clang, servidor)
 *
 * Los datos de prueba viven solo en tests/cpp/fixtures/. Código de salida 1 si algo falla.
 */
require_once dirname(__DIR__, 2) . '/app/bootstrap.php';

use Playground\Core\{Languages, Report, Solutions};

$cpp = Languages::get('cpp');
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

function runC(string $code, array $opts = []): array
{
    $c = Languages::get('cpp');
    return Report::build($c->run($code, 'tu_codigo.cpp', $opts + ['timeout' => 10]), $c->explainer($code));
}

/** Un programa con el cuerpo de main (y miembros opcionales antes). */
function mainC(string $body, string $members = ''): string
{
    return "#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n{$members}\nint main() {\n{$body}\n    return 0;\n}\n";
}

function textOf(array $r): string
{
    return implode('', array_column(array_filter($r['segments'], static fn($s) => $s['t'] === 'out'), 'text'));
}

/** Diagnósticos explicados de un programa que no compila (por compilador). */
function explicaC(string $code): array
{
    $c = Languages::get('cpp');
    $e = $c->syntaxError($code);
    return $e === null ? [] : [$c->explainer($code)->explain($e)];
}

// ═══════════════════════════════════════ 1. entorno ═══════════════════════════════════════
section('Entorno: compilador, meta() y fixtures');
$meta = $cpp->meta();
check('meta(): compilador C++ disponible (' . ($meta['version'] ?? 'sin compilador') . ')', $meta['ok'] === true, json_encode($meta['missing']));
if (!$meta['ok']) {
    echo "  Sin g++ o clang++ no se puede seguir.\n";
    exit(1);
}
check('meta() es estable entre llamadas (caché)', $cpp->meta()['version'] === $meta['version']);
$fx = file_get_contents(__DIR__ . '/fixtures/Sencillo.cpp');
check('el fixture Sencillo.cpp compila', $cpp->syntaxError($fx) === null, json_encode($cpp->syntaxError($fx)));

// ═══════════════════════════════════════ 2. ejecución ═══════════════════════════════════════
section('Ejecución: pruebas, sanitizers, excepciones, timeout, stdin y rutas');
$r = runC($fx);
$s = $r['testSummary'];
check('fixture: salida «hola» y 3 pruebas en verde', str_contains(textOf($r), 'hola') && $s['pass'] === 3 && $s['fail'] === 0 && $s['todo'] === 0 && $r['exit'] === 0, json_encode($s) . textOf($r));
$r = runC(str_replace('9, 3', '10, 3', $fx));
$byName = array_column($r['tests'], null, 'name');
check('fixture con un fallo: 2 ✓ y 1 ✗, con esperado y obtenido', $r['testSummary']['pass'] === 2 && $r['testSummary']['fail'] === 1 && ($byName['tres']['expected'] ?? '') === '10' && ($byName['tres']['actual'] ?? '') === '9', json_encode($r['testSummary']));
$r = runC(str_replace('return n * n;', 'return pendiente();', $fx));
check('fixture con pendiente(): las pruebas quedan como ⏳ y no es un error', $r['testSummary']['todo'] >= 1 && $r['testSummary']['fail'] === 0, json_encode($r['testSummary']) . json_encode($r['problems']));

$r = runC(mainC("    vector<int> v(10);\n    int s = 0;\n    for (int i = 0; i <= 10; i++) {\n        s += v[i];\n    }\n    cout << s;"));
$e = $r['problems'][0] ?? null;
check('ASan: v[10] → index-out-of-range en la línea del acceso (10) y traza', $e !== null && $e['code'] === 'index-out-of-range' && $e['line'] === 10 && $r['exit'] !== 0 && !empty($e['trace']), json_encode($e));

$r = runC(mainC("    int x = 2147483647;\n    x += 1;\n    cout << x;"));
$e = $r['problems'][0] ?? null;
check('UBSan: desbordamiento de int → overflow con su línea (8)', $e !== null && $e['code'] === 'overflow' && $e['line'] === 8, json_encode($e));

$r = runC(mainC("    int* p = new int(1);\n    delete p;\n    cout << *p;"));
check('ASan: uso tras delete → use-after-free', ($r['problems'][0]['code'] ?? '') === 'use-after-free', json_encode($r['problems'][0] ?? null));
$r = runC(mainC("    int* p = new int[5];\n    p[0] = 1;"));
check('LSan: fuga de memoria → memory-leak (aviso)', ($r['problems'][0]['code'] ?? '') === 'memory-leak', json_encode($r['problems'][0] ?? null));

$r = runC("#include <stdexcept>\nvoid f() {\n    throw std::runtime_error(\"boom\");\n}\nint main() {\n    f();\n}\n");
$e = $r['problems'][0] ?? null;
check('excepción no capturada: línea del throw, título con el mensaje y traza', $e !== null && $e['line'] === 3 && str_contains($e['title'], 'boom') && $e['severity'] === 'error' && $r['exit'] !== 0, json_encode($e));
$r = runC(mainC("    vector<int> v(3);\n    cout << v.at(5);"));
check('v.at(5) → std::out_of_range explicado como index-out-of-range', ($r['problems'][0]['code'] ?? '') === 'index-out-of-range' && ($r['problems'][0]['line'] ?? 0) === 8, json_encode($r['problems'][0] ?? null));

if (!$fast) {
    $t0 = microtime(true);
    $r = runC(mainC('    while (true) { }'), ['timeout' => 2]);
    $e = $r['problems'][0] ?? null;
    check('bucle infinito: se corta, code timeout y línea de main o del bucle (< 10 s)', $e !== null && $e['code'] === 'timeout' && $e['line'] >= 6 && $e['line'] <= 7 && microtime(true) - $t0 < 10, 'tardó ' . round(microtime(true) - $t0, 1) . ' s; ' . json_encode($e));
}

$r = runC(mainC("    int n;\n    cin >> n;\n    cout << n * 2;"), ['stdin' => "21\n"]);
check('stdin con cin llega al programa', str_contains(textOf($r), '42'), textOf($r));

$r = runC(mainC("    cout << \"ñandú ✓\" << endl;\n    cerr << \"por err\" << endl;\n    throw std::runtime_error(\"secreto\");"));
$json = (string) json_encode($r);
check('no se filtran rutas temporales (sys_get_temp_dir, var/, pg_fuente) y el archivo se llama tu_codigo.cpp', !str_contains($json, str_replace('/', '\\/', sys_get_temp_dir() . '/pg')) && !str_contains($json, 'pg_fuente') && !str_contains($json, str_replace('/', '\\/', PG_VAR)) && str_contains(textOf($r), 'ñandú ✓'), substr($json, 0, 200));
$r = runC("int f(int n) {\n    return f(n + 1) + 1;\n}\nint main() {\n    return f(0);\n}\n");
check('recursión infinita → stack-overflow', ($r['problems'][0]['code'] ?? '') === 'stack-overflow' && $r['exit'] !== 0, json_encode($r['problems'][0] ?? null));

// ═══════════════════════════════════════ 3. compilación ═══════════════════════════════════════
section('Compilación: errores sin ejecutar, posición y arreglos');
$bad = "#include <iostream>\nint main() {\n    int total = 0;\n    totl = 5;\n    std::cout << total;\n}\n";
$e = $cpp->syntaxError($bad);
check('error detectado sin ejecutar: kind parse, línea 4, columnas y mensaje', $e !== null && $e['kind'] === 'parse' && $e['t'] === 'err' && $e['line'] === 4 && $e['col'] === 5 && $e['endCol'] > $e['col'] && isset($e['code'], $e['msg']), json_encode($e));
$r = runC($bad);
$p = $r['problems'][0] ?? [];
check('run() con errores: se explican y no se ejecuta (sin salida)', ($p['source'] ?? '') === 'syntax' && ($p['line'] ?? 0) === 4 && $r['exit'] !== 0 && textOf($r) === '', json_encode($p));
check('«¿quisiste decir?»: undefined-variable con arreglo «Cambiar por `total`»', ($p['code'] ?? '') === 'undefined-variable' && ($p['fixes'][0]['title'] ?? '') === 'Cambiar por `total`' && ($p['fixes'][0]['edits'][0]['text'] ?? '') === 'total', json_encode($p['fixes'] ?? null));
$fixed = $bad;
$ed = $p['fixes'][0]['edits'][0]['range'] ?? ['sl' => 4, 'sc' => 5, 'ec' => 9];
$ls = explode("\n", $fixed);
$ls[$ed['sl'] - 1] = substr($ls[$ed['sl'] - 1], 0, $ed['sc'] - 1) . 'total' . substr($ls[$ed['sl'] - 1], $ed['ec'] - 1);
check('aplicar el arreglo deja código que compila', $cpp->syntaxError(implode("\n", $ls)) === null);
$e = $cpp->syntaxError("class A { const char* s = \"😀\"; void f() { foo(); } };\nint main() {}\n");
$esp = (int) (strlen((string) mb_convert_encoding("class A { const char* s = \"😀\"; void f() { ", 'UTF-16LE', 'UTF-8')) / 2) + 1;
check("columnas en UTF-16 aunque haya emoji antes (esperada {$esp})", $e !== null && $e['line'] === 1 && $e['col'] === $esp, json_encode($e));
check('código correcto → null', $cpp->syntaxError(mainC('    cout << 1;')) === null);
$a = $cpp->analyse($bad);
check('analyse(): syntax=true con diagnósticos explicados', $a['syntax'] === true && !empty($a['diagnostics'][0]['title']));

// ═══════════════════════════════════════ 4. análisis ═══════════════════════════════════════
section('analyse(): unidades (CC y O()) y símbolos');
$casos = [
    // nombre => [cuerpo de f, CC, clave O()]
    'bucle sobre n' => ['int f(const vector<int>& v) { int s = 0; for (int x : v) { s += x; } return s; }', 2, 'n'],
    'bucles anidados' => ['int f(const vector<int>& v) { int s = 0; for (int a : v) { for (int b : v) { s += a * b; } } return s; }', 3, 'n2'],
    'búsqueda binaria' => ['int f(const vector<int>& a, int x) { int lo = 0, hi = (int) a.size() - 1; while (lo <= hi) { int m = (lo + hi) / 2; if (a[m] == x) { return m; } if (a[m] < x) { lo = m + 1; } else { hi = m - 1; } } return -1; }', 4, 'log'],
    'sort' => ['void f(vector<int>& v) { sort(v.begin(), v.end()); }', 1, 'nlogn'],
    'fibonacci ingenuo' => ['int f(int n) { return n < 2 ? n : f(n - 1) + f(n - 2); }', 2, 'exp'],
    'fibonacci con memo' => ['long long f(int n, vector<long long>& memo) { if (n < 2) return n; if (memo[n] != 0) return memo[n]; return memo[n] = f(n - 1, memo) + f(n - 2, memo); }', 3, 'n'],
    'sin decisiones' => ['int f() { return 1; }', 1, '1'],
    'i *= 2' => ['int f(int n) { int t = 0; for (int i = 1; i < n; i *= 2) { t++; } return t; }', 2, 'log'],
];
foreach ($casos as $nombre => [$fn, $cc, $key]) {
    $res = $cpp->analyse("#include <vector>\n#include <algorithm>\nusing namespace std;\n{$fn}\nint main() { }\n");
    $u = current(array_filter($res['units'], static fn($x) => $x['name'] === 'f')) ?: null;
    $pr = $u === null ? ['no se encontró f'] : [];
    if ($u !== null && $u['cc'] !== $cc) {
        $pr[] = "CC {$u['cc']} (esperada {$cc})";
    }
    if ($u !== null && $u['bigOKey'] !== $key) {
        $pr[] = "O() {$u['bigOKey']} (esperado {$key})";
    }
    check($nombre . ($u ? "  [CC {$u['cc']}, {$u['bigO']}]" : ''), $pr === [], implode(', ', $pr));
}
$res = $cpp->analyse("#include <vector>\nint suma(const std::vector<int>& v) {\n    int s = 0;\n    for (int x : v) s += x;\n    return s;\n}\nint main() { }\n");
$sym = array_column($res['symbols'], null, 'name');
check('símbolos: el parámetro `const vector<int>& v` y la local `s` con tipo, línea y ámbito', isset($sym['v'], $sym['s']) && $sym['v']['kind'] === 'param' && str_contains($sym['v']['type'], 'const std::vector<int>&') && $sym['v']['fn'] === 'suma' && $sym['s']['kind'] === 'var' && $sym['s']['line'] === 3, json_encode($sym['v'] ?? null));

// ═══════════════════════════════════════ 5. declaraciones y soluciones ═══════════════════════════════════════
section('declarations(), insertionPoint() y Solutions (empalme sin duplicar)');
$d = $cpp->declarations($fx);
check('declarations(): type:punto y function:cuadrado (main fuera) con start/end, doc y línea', array_keys($d) === ['type:punto', 'function:cuadrado'] && $d['function:cuadrado']['line'] === 10 && $d['type:punto']['kind'] === 'type' && str_starts_with($d['type:punto']['doc'] ?? '', '/**'), implode(',', array_keys($d)));
$cod = substr($fx, $d['function:cuadrado']['start'], $d['function:cuadrado']['end'] - $d['function:cuadrado']['start']);
check('start/end de la función abarcan exactamente su definición', str_starts_with($cod, 'int cuadrado') && str_ends_with($cod, '}'), $cod);
$ip = $cpp->insertionPoint($fx, ['kind' => 'function']);
check('insertionPoint(): una función nueva va antes de main', $ip > 0 && $ip <= strpos($fx, 'int main'), (string) $ip);
check('código vacío: sin declaraciones y punto de inserción 0', $cpp->declarations('') === [] && $cpp->insertionPoint('', ['kind' => 'function']) === 0);

$solutions = new Solutions($cpp);
$user = <<<'C'
#include <iostream>
#include <vector>

/** Mi versión: todavía sin hacer. */
int fibonacci(int n) {
    return pendiente();
}

int otra() { return 7; }

int main() {
    std::cout << fibonacci(5) << " " << otra() << std::endl;
    prueba(fibonacci, caso("cinco", 5, 5), caso("diez", 55, 10));
}
C;
$sol = <<<'C'
#include <iostream>

/** Fibonacci iterativo. */
int fibonacci(int n) {
    int a = 0, b = 1;
    for (int i = 0; i < n; i++) {
        int t = a + b;
        a = b;
        b = t;
    }
    return a;
}

int ayuda(int x) {
    return x * 2;
}

int main() { }
C;
$spliced = $solutions->splice($user, $sol);
check('splice(): el resultado compila y fibonacci ya no es pendiente()', $cpp->syntaxError($spliced) === null && !str_contains($spliced, 'pendiente()') && str_contains($spliced, 'int t = a + b;'), json_encode($cpp->syntaxError($spliced)));
check('splice(): la auxiliar se añade una vez y lo no tocado se conserva', substr_count($spliced, 'int ayuda') === 1 && str_contains($spliced, 'int otra() { return 7; }') && substr_count($solutions->splice($spliced, $sol), 'int ayuda') === 1 && substr_count($solutions->splice($spliced, $sol), 'int fibonacci') === 1);
$run = runC($spliced);
check('el código empalmado se ejecuta: «5 7» y las 2 pruebas en verde', str_contains(textOf($run), '5 7') && $run['testSummary']['pass'] === 2 && $run['problems'] === [], textOf($run) . json_encode($run['problems']));
$byKey = array_column($solutions->compare($user, $sol), null, 'key');
check('compare(): fibonacci no implementada y distinta; ayuda no existe', ($byKey['function:fibonacci']['implemented'] ?? null) === false && ($byKey['function:fibonacci']['same'] ?? null) === false && array_key_exists('mine', $byKey['function:ayuda'] ?? []) && $byKey['function:ayuda']['mine'] === null, json_encode($byKey['function:fibonacci'] ?? null));

// ═══════════════════════════════════════ 6. errores explicados ═══════════════════════════════════════
section('Errores explicados en español: compilación y ejecución');
$compila = [
    // [nombre, código, code esperado, texto que debe aparecer en título/explicación, ¿arreglo?]
    ['variable mal escrita', mainC("    int total = 0;\n    totl = 1;"), 'undefined-variable', 'total', true],
    ['método de vector mal escrito', mainC("    vector<int> v;\n    v.push_bak(1);"), 'undefined-method', 'push_back', true],
    ['falta std::', "#include <iostream>\n#include <vector>\nint main() {\n    vector<int> v;\n}\n", 'class-not-found', 'std::vector', true],
    ['falta ;', mainC('    int x = 1'), 'parse.semicolon', 'punto y coma', true],
    ['falta }', "int main() {\n    int x = 1;\n", 'parse.eof', 'llave', false],
    ['int = "a"', mainC('    int x = "a";'), 'type-mismatch', 'tipado', false],
    ['string = int (to_string)', mainC('    string s = 5;'), 'type-mismatch', 'to_string', true],
    ['sin return', "int f(int a) { if (a) return 1; }\nint main() { return f(1); }\n", 'missing-return', 'indefinido', false],
    ['asignar a const', mainC("    const int k = 1;\n    k = 2;"), 'immutable', 'const', false],
    ['miembro privado', "class A { int s; };\nint main() {\n    A a;\n    a.s = 1;\n}\n", 'visibility', 'private', false],
    ['variable redeclarada', mainC("    int y = 1;\n    int y = 2;"), 'redeclare', 'ámbito', false],
    ['`.` con un puntero', "struct P { int x; };\nint main() {\n    P* p = new P;\n    p.x = 1;\n}\n", 'pointer-member', '->', true],
    ['copiar un unique_ptr', "#include <memory>\nint main() {\n    std::unique_ptr<int> u(new int(1));\n    auto v = u;\n}\n", 'deleted-function', 'std::move', true],
    ['definición que falta (enlazador)', "int g(int);\nint main() { return g(1); }\n", 'link.undefined', 'enlazador', false],
    ['argumentos de menos', "int g(int a, int b);\nint main() { g(1); }\n", 'argument-type', 'argumentos', false],
    ['cout << struct', "#include <iostream>\nstruct S { int a; };\nint main() {\n    S s;\n    std::cout << s;\n}\n", 'no-operator', 'operator<<', false],
];
$ok = 0;
foreach ($compila as [$nombre, $code, $esperado, $texto, $conArreglo]) {
    $d = explicaC($code)[0] ?? null;
    $todo = $d === null ? '' : $d['title'] . ' ' . $d['explain'] . ' ' . json_encode($d['fixes'] ?? [], JSON_UNESCAPED_UNICODE) . json_encode($d['suggestions'] ?? []);
    $bien = $d !== null && $d['code'] === $esperado && str_contains($todo, $texto) && mb_strlen($d['title']) > 8 && mb_strlen($d['explain']) > 80 && (!$conArreglo || !empty($d['fixes']));
    check("{$nombre} → {$esperado}", $bien, $d === null ? 'compila sin error' : $d['code'] . ' | ' . $d['title']);
    $ok += $bien ? 1 : 0;
}
$w = Languages::get('cpp')->explainer('')->explain(['kind' => 'parse', 'severity' => 'warning', 'code' => 'Wsign-compare', 'flag' => '-Wsign-compare', 'msg' => 'comparison of integer expressions of different signedness', 'line' => 1, 'col' => 1]);
check('aviso sign-compare con aviso (no error) y explicación de size_t', $w['code'] === 'sign-compare' && $w['severity'] === 'warning' && str_contains($w['explain'], 'size_t'));
$ex = Languages::get('cpp')->explainer('');
$cat = [
    ['asan', 'heap-use-after-free', 'use-after-free'], ['asan', 'attempting', 'double-free'], ['asan', 'stack-overflow', 'stack-overflow'], ['asan', 'SEGV', 'member-on-null'],
    ['ubsan', 'division-by-zero', 'division-by-zero'], ['ubsan', 'null', 'member-on-null'], ['memory', 'out-of-memory', 'out-of-memory'], ['abort', 'assert', 'assert'],
    ['exception', 'std::bad_alloc', 'out-of-memory'], ['exception', 'std::invalid_argument', 'argument-value'], ['exception', 'std::out_of_range', 'index-out-of-range'],
    ['fpe', '', 'division-by-zero'], ['timeout', '', 'timeout'], ['exception', 'int', 'uncaught-exception'],
];
$mal = [];
foreach ($cat as [$k, $c, $code]) {
    $d = $ex->explain(['kind' => $k, 'cls' => $c, 'msg' => 'x', 'line' => 3]);
    if ($d['code'] !== $code || mb_strlen($d['title']) < 8 || mb_strlen($d['explain']) < 60) {
        $mal[] = "$k/$c → {$d['code']}";
    }
}
check('eventos de ejecución sintéticos (' . count($cat) . '): código compartido, título y explicación', $mal === [], implode('; ', $mal));
check('ningún error comparado se explica con el título genérico del compilador', $ok === count($compila), "$ok/" . count($compila));

// ═══════════════════════════════════════ 7. catálogo y otros compiladores ═══════════════════════════════════════
section('Catálogo del editor y clang');
$cat = $cpp->catalog();
$n = array_sum(array_map('count', $cat));
check("catalog(): más de 300 entradas ({$n}) en functions, classes y keywords", $n > 300 && isset($cat['functions'], $cat['classes'], $cat['keywords']));
if (!$fast && trim((string) shell_exec('command -v clang++ 2>/dev/null')) !== '') {
    putenv('PG_CXX=clang++');
    $l2 = new \Playground\Lang\Cpp\CppLanguage();
    $e = $l2->syntaxError($bad);
    $d2 = $e === null ? null : $l2->explainer($bad)->explain($e);
    putenv('PG_CXX');
    check('con clang++ el mismo error se explica igual (undefined-variable + «Cambiar por `total`»)', $d2 !== null && $d2['code'] === 'undefined-variable' && ($d2['fixes'][0]['title'] ?? '') === 'Cambiar por `total`', json_encode($d2));
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
