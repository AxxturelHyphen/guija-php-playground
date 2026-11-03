<?php
declare(strict_types=1);

// Comprobación puntual de Hints (el autotest completo estará en tests/run.php).
require dirname(__DIR__) . '/app/bootstrap.php';

use Playground\Analysis\{Source, Parser, Metrics, Hints};

function hints(string $code): array
{
    $s = new Source($code);
    $p = new Parser($s);
    $m = new Metrics($s, $p);
    $r = $m->compute();
    return (new Hints($s, $p, $m, $r['units']))->all();
}

function codes(string $code): array
{
    return array_values(array_unique(array_column(hints($code), 'code')));
}

$T = [
    // [nombre, código, códigos que DEBEN salir, códigos que NO deben salir]
    ['limpio', "<?php\ndeclare(strict_types=1);\nfunction suma(int \$a, int \$b): int { return \$a + \$b; }\necho suma(1,2);\n", [], ['style.strict-types', 'types.param', 'types.return', 'eq.loose', 'java.decl', 'java.dollar', 'flow.unreachable']],
    ['sin strict', "<?php\nfunction f(int \$a): int { return \$a; }\n", ['style.strict-types'], []],
    ['sin open tag', "echo 1;\n", ['php.open-tag'], []],
    ['loose eq', "<?php\ndeclare(strict_types=1);\nif (\$a == 1 || \$b != 2) {}\n", ['eq.loose'], []],
    ['tipos', "<?php\ndeclare(strict_types=1);\nfunction f(\$x) { return \$x; }\n", ['types.param', 'types.return'], []],
    ['java decl', "<?php\nString nombre = \"x\";\nint i = 0;\n", ['java.decl'], []],
    ['java println', "<?php\nSystem.out.println(\"hola\");\n", ['java.println'], []],
    ['java this', "<?php\nclass A { private \$x; function f() { return this.x; } }\n", ['java.this'], []],
    ['java foreach', "<?php\nforeach (String s : lista) { echo s; }\n", ['java.foreach'], []],
    ['java concat', "<?php\n\$a = \"hola \" + \$b;\n", ['java.concat'], []],
    ['php concat ok', "<?php\n\$a = \"hola \" . \$b; \$c = 1 + 2;\n", [], ['java.concat']],
    ['java method', "<?php\npublic static void main(String[] args) { }\n", ['java.method'], []],
    ['java new', "<?php\n\$l = new ArrayList<>();\n\$m = new HashMap();\n", ['java.new'], []],
    ['java static', "<?php\n\$m = Math.max(1, 2);\n\$n = Integer.parseInt(\"5\");\n", ['java.static'], []],
    ['java dollar', "<?php\nfor (i = 0; i < 5; i++) { echo i; }\n", ['java.dollar'], []],
    ['java catch', "<?php\ntry { } catch (Exception e) { }\n", ['java.catch'], []],
    ['java methodcall', "<?php\n\$n = \$lista.size();\n\$m = \$s.length();\n", ['java.method-call'], []],
    ['php dot ok', "<?php\n\$a = \$x . strlen(\$y) . PHP_EOL;\n", [], ['java.method-call', 'java.length']],
    ['declare ok', "<?php\ndeclare(strict_types=1);\nconst X = 1;\nenum E { case A = 1; }\n", [], ['java.dollar', 'java.decl']],
    ['in_array loop', "<?php\nfunction f(array \$a): array { \$o=[]; foreach (\$a as \$x) { if (!in_array(\$x, \$o)) { \$o[] = \$x; } } return \$o; }\n", ['perf.in-array-loop'], []],
    ['array_shift loop', "<?php\nfunction f(array \$a): int { \$n=0; while (\$a) { array_shift(\$a); \$n++; } return \$n; }\n", ['perf.shift-loop'], []],
    ['merge loop', "<?php\nfunction f(array \$a): array { \$o=[]; foreach (\$a as \$x) { \$o = array_merge(\$o, [\$x]); } return \$o; }\n", ['perf.merge-loop'], []],
    ['recursion exp', "<?php\nfunction fib(int \$n): int { if (\$n < 2) return \$n; return fib(\$n-1) + fib(\$n-2); }\n", ['perf.recursion'], []],
    ['unreachable', "<?php\nfunction f(): int { return 1; echo 'x'; }\n", ['flow.unreachable'], []],
    ['reachable', "<?php\nfunction f(int \$x): int { if (\$x) return 1; echo 'x'; return 2; }\nswitch (1) { case 1: return 5; case 2: break; }\n", [], ['flow.unreachable']],
    ['empty catch', "<?php\ntry { f(); } catch (Exception \$e) { }\n", ['flow.empty-catch'], []],
    ['catch comentado', "<?php\ntry { f(); } catch (Exception \$e) { /* ignorado a propósito */ }\n", [], ['flow.empty-catch']],
    ['else after return', "<?php\nfunction f(int \$x): int { if (\$x > 0) { return 1; } else { return 2; } }\n", ['flow.else-after-return'], []],
    ['else normal', "<?php\nfunction f(int \$x): int { if (\$x > 0) { \$y = 1; } else { \$y = 2; } return \$y; }\n", [], ['flow.else-after-return']],
    ['global', "<?php\nfunction f() { global \$x; }\n", ['style.global'], []],
    ['unused var', "<?php\ndeclare(strict_types=1);\nfunction f(int \$a, int \$b): int { \$tmp = 5; return \$a; }\n", ['unused.var', 'unused.param'], []],
    ['compact no unused', "<?php\ndeclare(strict_types=1);\nfunction f(): array { \$a = 1; return compact('a'); }\n", [], ['unused.var']],
];

$fail = 0;
foreach ($T as [$name, $code, $must, $mustNot]) {
    $got = codes($code);
    $missing = array_diff($must, $got);
    $extra = array_intersect($mustNot, $got);
    $bad = $missing || $extra;
    echo ($bad ? 'FAIL ' : 'ok   ') . str_pad($name, 20) . ' ' . implode(',', $got)
        . ($missing ? '   FALTAN: ' . implode(',', $missing) : '')
        . ($extra ? '   SOBRAN: ' . implode(',', $extra) : '') . "\n";
    $fail += (int) (bool) $bad;
}

/** Aplica un quick fix al código (rangos 1-based en caracteres; aquí todo es ASCII). */
function applyFix(string $code, array $fix): string
{
    $edits = $fix['edits'];
    usort($edits, static fn($a, $b) => [$b['range']['sl'], $b['range']['sc']] <=> [$a['range']['sl'], $a['range']['sc']]);
    foreach ($edits as $e) {
        $r = $e['range'];
        $lines = explode("\n", $code);
        $off = static fn(int $l, int $c): int => array_sum(array_map(static fn($x) => strlen($x) + 1, array_slice($lines, 0, $l - 1))) + $c - 1;
        $code = substr($code, 0, $off($r['sl'], $r['sc'])) . $e['text'] . substr($code, $off($r['el'], $r['ec']));
    }
    return $code;
}

$fixCases = [
    "<?php\nif (\$a == 1) { echo 'x'; }\n",
    "<?php\nfunction f(): int { return 1; echo 'x'; }\n",
    "<?php\nString nombre = \"x\";\n",
    "<?php\n\$m = Math.max(1, 2);\n",
    "<?php\nforeach (String s : \$lista) { echo \$s; }\n",
    "<?php\nfunction f() { return \"a\" + \"b\"; }\n",
    "<?php\nclass A { public \$x = 1; function f() { return this.x; } }\n",
    "<?php\nfor (i = 0; \$i < 3; \$i++) { }\n",
    "<?php\ntry { } catch (Exception e) { }\n",
    "echo 1;\n",
];
$tmp = sys_get_temp_dir() . '/pgfix.php';
foreach ($fixCases as $code) {
    foreach (hints($code) as $h) {
        foreach ($h['fixes'] as $fx) {
            if (in_array($h['code'], ['style.strict-types', 'types.return'], true)) {
                continue;
            }
            $res = applyFix($code, $fx);
            file_put_contents($tmp, $res);
            $out = [];
            exec('php -l ' . escapeshellarg($tmp) . ' 2>&1', $out, $rc);
            echo ($rc === 0 ? 'ok   ' : 'FAIL ') . 'fix ' . str_pad($h['code'], 16) . ' -> ' . json_encode(substr($res, 0, 70), JSON_UNESCAPED_UNICODE)
                . ($rc !== 0 ? '  [' . trim($out[0] ?? '') . ']' : '') . "\n";
            $fail += (int) ($rc !== 0);
        }
    }
}
@unlink($tmp);
echo $fail ? "\n$fail FALLOS\n" : "\nTODO OK\n";
exit($fail ? 1 : 0);
