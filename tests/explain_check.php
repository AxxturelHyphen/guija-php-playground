<?php
declare(strict_types=1);

// Ejecuta errores reales de PHP a través de Runner + Explainer y comprueba el código de diagnóstico.
require dirname(__DIR__) . '/app/bootstrap.php';

use Playground\Analysis\{Parser, Source};
use Playground\{Explainer, Report, Runner};

$S = 'declare(strict_types=1);';
$cases = [
    // [nombre, código, código esperado del primer problema, [comprobaciones extra: texto que debe aparecer en el JSON del diagnóstico]]
    ['var typo', "<?php\n{$S}\nfunction f(int \$total): int {\n    return \$totl;\n}\necho f(1);\n", 'undefined-variable', ['total']],
    ['clave', "<?php\n\$a = ['x' => 1];\necho \$a['y'];\n", 'undefined-key', ["'y'"]],
    ['java fn', "<?php\necho length('abc');\n", 'undefined-function', ['strlen']],
    ['typo fn', "<?php\necho strtoupr('a');\n", 'undefined-function', ['strtoupper']],
    ['metodo', "<?php\nclass A { function hola(): void {} }\n(new A())->hole();\n", 'undefined-method', ['hola']],
    ['metodo java', "<?php\nclass A { }\n(new A())->size();\n", 'undefined-method', ['count']],
    ['null->m()', "<?php\n\$x = null;\n\$x->foo();\n", 'member-on-null', ['?->']],
    ['null->prop', "<?php\n\$x = null;\necho \$x->nombre;\n", 'property-on-null', []],
    ['abstract new', "<?php\nabstract class A {}\nnew A();\n", 'instantiate-abstract', []],
    ['clase no existe', "<?php\nclass Cuenta {}\nnew Cuentta();\n", 'class-not-found', ['Cuenta']],
    ['abstractos', "<?php\ninterface I { function a(); function b(); }\nclass C implements I { function a() {} }\n", 'abstract-not-implemented', ['I::b']],
    ['readonly', "<?php\nfinal class P { function __construct(public readonly int \$x) {} }\n\$p = new P(1);\n\$p->x = 2;\n", 'readonly', []],
    ['arg tipo', "<?php\n{$S}\nfunction s(int \$a): int { return \$a; }\necho s('2');\n", 'argument-type', ['(int)']],
    ['retorno', "<?php\n{$S}\nfunction f(): int { return 'a'; }\nf();\n", 'return-type', []],
    ['pocos args', "<?php\nfunction f(\$a, \$b) {}\nf(1);\n", 'too-few-arguments', []],
    ['intdiv 0', "<?php\necho intdiv(1, 0);\n", 'division-by-zero', ['fdiv']],
    ['modulo 0', "<?php\necho 1 % 0;\n", 'division-by-zero', []],
    ['array + int', "<?php\necho [] + 1;\n", 'operand-types', []],
    ['string + int', "<?php\n{$S}\necho 'a' + 1;\n", null, []],
    ['array a string', "<?php\n\$a = [1];\necho 'x' . \$a;\n", 'array-to-string', ['implode']],
    ['objeto a string', "<?php\nclass A {}\necho new A();\n", 'object-to-string', ['__toString']],
    ['enum from', "<?php\nenum E: string { case A = 'a'; }\nE::from('z');\n", 'enum-value', ['tryFrom']],
    ['match', "<?php\necho match(5) { 1 => 'a' };\n", 'match-unhandled', ['default']],
    ['prop sin init', "<?php\nclass A { public int \$x; }\necho (new A())->x;\n", 'uninitialized-property', []],
    ['tipo prop', "<?php\n{$S}\nclass A { public int \$x = 0; }\n\$a = new A();\n\$a->x = 'a';\n", 'property-type', []],
    ['privado', "<?php\nclass A { private function f() {} }\n(new A())->f();\n", 'visibility', []],
    ['this static', "<?php\nclass A { static function f() { return \$this; } }\nA::f();\n", 'this-static', []],
    ['constante', "<?php\necho FOO;\n", 'undefined-constant', ['$FOO']],
    ['float->int', "<?php\n\$a = [1, 2];\necho \$a[1.5];\n", 'float-to-int', []],
    ['null param', "<?php\necho strlen(null);\n", 'null-to-param', []],
    ['excepcion generica', "<?php\nthrow new LogicException('algo raro');\n", 'generic', ['algo raro']],
    ['todo fuera de prueba', "<?php\nfunction f(): int { pendiente(); }\necho f();\n", 'todo', []],
    ['timeout', "<?php\nwhile (true) {}\n", 'timeout', []],
    ['recursion', "<?php\nfunction f(int \$n): int { return f(\$n + 1); }\nf(1);\n", 'stack-overflow', ['f()']],
    ['memoria array', "<?php\n\$a = [];\nwhile (true) { \$a[] = str_repeat('x', 1000); }\n", 'out-of-memory', []],
    // errores de sintaxis
    ['falta ;', "<?php\n\$a = 1\n\$b = 2;\n", 'parse.semicolon', []],
    ['llave sin cerrar', "<?php\nfunction f() {\n    echo 1;\n", 'parse.unclosed', []],
    ['java decl', "<?php\nint x = 5;\n", 'parse.java-decl', []],
    ['llave de mas', "<?php\necho 1;\n}\n", null, []],
    ['else suelto', "<?php\nif (1) { echo 1; } ; else { echo 2; }\n", 'parse.orphan', []],
    ['string sin cerrar', "<?php\necho \"abc;\n", null, []],
    ['catch java', "<?php\ntry { } catch (Exception e) { }\n", null, []],
    ['foreach java', "<?php\nforeach (String s : \$lista) { }\n", null, []],
    ['parentesis', "<?php\necho (1 + 2;\n", null, []],
];

$fail = 0;
$runner = new Runner();
foreach ($cases as [$name, $code, $expect, $mustContain]) {
    $src = new Source($code);
    $parser = new Parser($src);
    $ex = new Explainer($src, $parser);
    $raw = $runner->run($code, 'tu_codigo.php', ['timeout' => 2]);
    $rep = Report::build($raw, $ex);
    $p = $rep['problems'][0] ?? null;

    // Lo mismo por el camino de la comprobación en vivo (solo errores de sintaxis)
    $syntax = Runner::syntaxError($code);
    $liveCode = $syntax !== null ? $ex->explain($syntax)['code'] : '-';

    $got = $p['code'] ?? '(sin problema)';
    $json = json_encode($p, JSON_UNESCAPED_UNICODE);
    $ok = $expect === null || $got === $expect;
    foreach ($mustContain as $needle) {
        $ok = $ok && str_contains((string) $json, $needle);
    }
    $fail += (int) !$ok;
    printf("%s %-22s %-26s L%-3s %s%s\n", $ok ? 'ok  ' : 'FAIL', $name, $got, $p['line'] ?? '?', mb_substr((string) ($p['title'] ?? ''), 0, 70), $syntax ? "   [en vivo: {$liveCode}]" : '');
    if (!$ok || $expect === null) {
        echo '       original: ' . ($p['original'] ?? '-') . "\n";
        if ($p && !empty($p['hint'])) {
            echo '       hint: ' . mb_substr((string) $p['hint'], 0, 110) . "\n";
        }
    }
}
echo $fail ? "\n{$fail} FALLOS\n" : "\nTODO OK\n";
exit($fail ? 1 : 0);
