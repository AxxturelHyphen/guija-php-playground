<?php
declare(strict_types=1);

/**
 * Autotest del motor de Java (mismo estilo que tests/python/run.php).
 *
 *   php tests/java/run.php            todo
 *   php tests/java/run.php --rapido   sin el smoke HTTP ni las mediciones de tiempo
 *
 * Los datos de prueba viven solo en tests/java/fixtures/. Código de salida 1 si algo falla.
 */
require_once dirname(__DIR__, 2) . '/app/bootstrap.php';

use Playground\Core\{Languages, Report, Process, Solutions};
use Playground\Lang\Java\JavaLanguage;

$java = Languages::get('java');
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

function runJ(string $code, array $opts = []): array
{
    $j = Languages::get('java');
    return Report::build($j->run($code, 'tu_codigo.java', $opts + ['timeout' => 10]), $j->explainer($code));
}

/** Un programa con la clase Main y el cuerpo de main (más miembros opcionales). */
function mainJ(string $body, string $members = ''): string
{
    return "import java.util.*;\n\nclass Main {\n{$members}\n    public static void main(String[] args) {\n{$body}\n    }\n}\n";
}

function textOf(array $r): string
{
    return implode('', array_column(array_filter($r['segments'], static fn($s) => $s['t'] === 'out'), 'text'));
}

/** ¿Sigue vivo el proceso con ese pid? */
function vivo(int $pid): bool
{
    if (DIRECTORY_SEPARATOR === '\\') {
        return str_contains((string) shell_exec('tasklist /FI "PID eq ' . $pid . '" 2>NUL'), (string) $pid);
    }
    return is_dir('/proc/' . $pid) && !str_contains((string) @file_get_contents('/proc/' . $pid . '/stat'), ') Z');
}

// ═══════════════════════════════════════ 1. entorno ═══════════════════════════════════════
section('Entorno: JDK, meta(), caché, harness y fixtures');
$meta = $java->meta();
check('meta(): JDK 21+ (' . ($meta['version'] ?? 'sin JDK') . ')', $meta['ok'] === true && version_compare((string) $meta['version'], '21', '>='), json_encode($meta['missing']));
if (!$meta['ok']) {
    echo "  Sin JDK 21 no se puede seguir.\n";
    exit(1);
}
check('caché var/java.json escrita', is_file(PG_VAR . '/java.json') && is_array(json_decode((string) file_get_contents(PG_VAR . '/java.json'), true)));
$t0 = microtime(true);
(new JavaLanguage())->meta();
check('meta() con caché no lanza procesos (< 30 ms)', (microtime(true) - $t0) < 0.03, round((microtime(true) - $t0) * 1000) . ' ms');
$r = runJ(mainJ('        System.out.println("hola");'));   // fuerza compilar el harness
check('el harness compila y queda en var/java/harness/', is_file(PG_VAR . '/java/harness/pg/Pg.class') && is_file(PG_VAR . '/java/harness/pg/PgMain.class') && str_contains(textOf($r), 'hola'), json_encode($r['problems']));
foreach (glob(__DIR__ . '/fixtures/*.java') ?: [] as $f) {
    $e = $java->syntaxError((string) file_get_contents($f));
    check('el fixture ' . basename($f) . ' compila', $e === null, json_encode($e));
}

// ═══════════════════════════════════════ 2. harness ═══════════════════════════════════════
section('Harness: errores, excepciones, timeout, memoria, stdin y pruebas');

$r = runJ("class Main {\n    static void f() {\n        throw new IllegalStateException(\"boom\");\n    }\n    public static void main(String[] a) {\n        System.out.println(\"antes\");\n        f();\n    }\n}\n");
$e = $r['problems'][0] ?? null;
check('excepción no capturada: error explicado con línea y traza (solo frames del usuario)', $r['exit'] === 255 && $e !== null && $e['severity'] === 'error' && $e['line'] === 3
    && str_contains($e['title'], 'boom') && count($e['trace'] ?? []) === 2 && $e['trace'][0]['line'] === 3 && $e['trace'][1]['line'] === 7 && str_contains(textOf($r), 'antes'), json_encode($e));

$r = runJ(mainJ('        String s = null;' . "\n" . '        System.out.println(s.length());'));
$e = $r['problems'][0] ?? null;
check('NullPointerException con su mensaje útil y la línea', $e !== null && $e['line'] === 7 && str_contains($e['title'], 'NullPointerException') && str_contains($e['original'], '"s" is null'), json_encode($e));

$t0 = microtime(true);
$r = runJ(mainJ('        while (true) { }'), ['timeout' => 2]);
$e = $r['problems'][0] ?? null;
check('bucle infinito: se corta y se explica con su línea (< 8 s)', $r['exit'] !== 0 && $e !== null && $e['severity'] === 'error' && $e['code'] === 'timeout' && $e['line'] === 6 && microtime(true) - $t0 < 8,
    'tardó ' . round(microtime(true) - $t0, 1) . ' s; ' . ($e['title'] ?? 'sin diagnóstico'));

$t0 = microtime(true);
$r = runJ(mainJ('        try { Thread.sleep(60000); } catch (InterruptedException e) { }'), ['timeout' => 2]);
check('un sleep largo también se corta (< 8 s) y señala su línea', ($r['problems'][0]['code'] ?? '') === 'timeout' && ($r['problems'][0]['line'] ?? 0) === 6 && microtime(true) - $t0 < 8);

$r = runJ(mainJ('        System.out.println(f(0));', "    static int f(int n) {\n        return f(n + 1) + 1;\n    }"));
$e = $r['problems'][0] ?? null;
check('recursión infinita: StackOverflowError explicado', $e !== null && $e['code'] === 'stack-overflow' && $e['line'] === 5 && $r['exit'] !== 0, json_encode($e));

$r = runJ(mainJ("        List<long[]> l = new ArrayList<>();\n        while (true) {\n            l.add(new long[5_000_000]);\n        }"), ['timeout' => 20]);
$e = $r['problems'][0] ?? null;
check('memoria agotada (OOM): error explicado, el servidor sigue vivo', $e !== null && $e['code'] === 'out-of-memory' && $r['exit'] !== 0 && $e['line'] === 8, json_encode($e));

$r = runJ(mainJ("        while (true) {\n            System.out.println(\"a\".repeat(5000));\n        }"), ['timeout' => 20]);
check('salida desbordada (1 MB): se corta', $r['killed'] === 'output' || array_filter($r['segments'], static fn($s) => $s['t'] === 'note') !== [], 'killed=' . var_export($r['killed'], true));

$r = runJ(mainJ("        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        System.out.println(n * 2);"), ['stdin' => "21\n"]);
check('stdin con Scanner llega al programa', str_contains(textOf($r), '42'), textOf($r));

$r = runJ(mainJ('        System.out.println("ñandú ✓ 😀");' . "\n" . '        System.err.println("por err");'));
check('salida UTF-8 intacta y System.err en el mismo flujo, en orden', str_contains(textOf($r), "ñandú ✓ 😀\npor err\n"), textOf($r));

$r = runJ(mainJ("        System.out.println(new Throwable().getStackTrace()[0].getFileName());\n        try { throw new RuntimeException(\"x\"); } catch (Exception e) { e.printStackTrace(); }\n        throw new RuntimeException(\"secreto\");"));
$json = (string) json_encode($r);
check('no se filtran rutas temporales del sistema', !str_contains($json, str_replace('\\', '\\\\', sys_get_temp_dir())) && !str_contains($json, 'pgj_') && !str_contains($json, 'guija-playground') && str_contains($json, 'tu_codigo.java'), substr($json, 0, 200));

$r = runJ("public class Publica {\n    public static void main(String[] a) {\n        System.out.println(\"pública\");\n    }\n}\n");
check('un tipo public da nombre al archivo temporal (y compila)', str_contains(textOf($r), 'pública') && $r['problems'] === [], json_encode($r['problems']));

$r = runJ("class A {\n    static void f() { }\n}\n");
check('sin main: aviso claro, sin ejecutar', ($r['problems'][0]['severity'] ?? '') === 'error' && $r['exit'] !== 0);

$lcg = [];
$x = 12345;
for ($i = 0; $i < 6; $i++) {
    $x = ($x * 1103515245 + 12345) & 0x7fffffff;
    $lcg[] = $x % 1001;
}
$r = runJ(mainJ('        System.out.println(Arrays.toString(aleatorios(6, 1000, 12345)) + Arrays.toString(rango(2, 10, 4)) + Arrays.toString(rango(3, 1)) + lista(3));'));
check('helpers: aleatorios() con el mismo LCG que PHP; rango(); lista()', trim(textOf($r)) === '[' . implode(', ', $lcg) . '][2, 6, 10][3, 2, 1][1, 2, 3]', trim(textOf($r)));

// ───────────── API de pruebas (port del ejemplo de tests/run.php) ─────────────
$code = mainJ(<<<'J'
        prueba("doble", caso("dos", 4, 2), caso("cero", 0, 0));
        prueba("triple", caso("mal", 6, 2));
        prueba("pendienteFn", caso("algo", 1));
        comprueba("lanza ok", () -> { throw new IllegalStateException("x"); }, 1);
        lanza("lanza bien", () -> { throw new IllegalStateException("x"); }, IllegalStateException.class);
        pruebaSinOrden("doble", caso("sin orden", 2, 1));
J, <<<'J'
    static int doble(int x) { return x * 2; }
    static int triple(int x) { return x + 3; }
    static int pendienteFn() { return pendiente(); }
J);
$r = runJ($code);
$s = $r['testSummary'];
check("pruebas: 4 ✓, 1 ✗, 1 error, 1 ⏳ (obtenido {$s['pass']} ✓ {$s['fail']} ✗ {$s['error']} error {$s['todo']} ⏳)", $s['pass'] === 4 && $s['fail'] === 1 && $s['error'] === 1 && $s['todo'] === 1);
$byName = array_column($r['tests'], null, 'name');
check('eventos de prueba: input, expected, actual y group', ($byName['mal']['input'] ?? '') === '2' && ($byName['mal']['expected'] ?? '') === '6' && ($byName['mal']['actual'] ?? '') === '5' && ($byName['mal']['group'] ?? '') === 'triple()', json_encode($byName['mal'] ?? null));
$r = runJ(mainJ("        System.out.println(\"a\");\n        pendiente();"));
check('pendiente() sin capturar: evento todo con línea (no excepción)', ($r['problems'][0]['line'] ?? 0) === 7 && !str_contains(json_encode($r['problems']), 'PorHacer') && $r['testSummary']['error'] === 0, json_encode($r['problems']));

$r = runJ(mainJ(<<<'J'
        prueba("suma", caso("long", 5L, 2, 3));
        prueba("suma", caso("int", 5, 2, 3));
        prueba("sumaArr", caso("arrays", 6, new int[]{1, 2, 3}));
        prueba("sumaArr", caso("Integer[] → int[]", 6, (Object) new Integer[]{1, 2, 3}));
        prueba("falta", caso("no existe", 1));
        pruebaCon("suma", (a, e) -> ((Number) a).intValue() == ((Number) e).intValue(), caso("comparador", 5.0, 2, 3));
J, <<<'J'
    static int suma(int a, int b) { return a + b; }
    static int sumaArr(int[] xs) { return Arrays.stream(xs).sum(); }
J));
$st = array_column($r['tests'], 'status', 'name');
check('prueba(): boxing exacto (esperado 5L ≠ Integer 5), arrays, método inexistente y comparador propio',
    $st['long'] === 'fail' && $st['int'] === 'pass' && $st['arrays'] === 'pass' && $st['Integer[] → int[]'] === 'pass' && $st['(existe el método)'] === 'error' && $st['comparador'] === 'pass', json_encode($st));

// medir
$medir = mainJ("        medir(\"suma\", n -> args(numeros(n)));", "    static long suma(int[] xs) {\n        long s = 0;\n        for (int x : xs) s += x;\n        return s;\n    }");
$r = runJ($medir, ['bench' => true, 'benchBudgetMs' => 1500, 'timeout' => 30]);
$b = $r['benches'][0] ?? null;
check('medir(): puntos y modelo en {n, nlogn, 1}', $b !== null && $b['status'] === 'ok' && count($b['points']) >= 5 && in_array($b['model'], ['n', 'nlogn', '1'], true), json_encode($b['model'] ?? $b));
$r = runJ($medir);
check('medir() sin «Medir» se omite', ($r['benches'][0]['status'] ?? '') === 'skipped');
$r = runJ(mainJ("        medir(\"ordenar\", n -> aleatorios(n, 1000, 7), a -> Arrays.sort(a));\n        medir(\"fib\", n -> args(n), \"lineal\", rango(10, 28, 2));", "    static long fib(int n) {\n        return n < 2 ? n : fib(n - 1) + fib(n - 2);\n    }"), ['bench' => true, 'timeout' => 40]);
$b0 = $r['benches'][0] ?? [];
$b1 = $r['benches'][1] ?? [];
check('medir() tipado (ordena en el sitio, sin casts) y por nombre con escala lineal y tamaños; fib → exp',
    ($b0['status'] ?? '') === 'ok' && count($b0['points']) >= 5 && ($b1['status'] ?? '') === 'ok' && count($b1['points']) === 10 && ($b1['model'] ?? '') === 'exp' && $b1['scale'] === 'lineal', json_encode([$b0['model'] ?? $b0, $b1['model'] ?? $b1]));
$r = runJ(mainJ("        medir(\"noExiste\", n -> args(n));"), ['bench' => true]);
check('medir() de un método inexistente: error claro', ($r['benches'][0]['status'] ?? '') === 'error');

// ═══════════════════════════════════════ 3. igual() ═══════════════════════════════════════
section('igual(): reglas de la igualdad estricta');
$code = mainJ(<<<'J'
        comprueba("Integer != Long [fail]", () -> 1, 1L);
        comprueba("Integer != Double [fail]", () -> 1, 1.0);
        comprueba("tolerancia relativa 1e-9 [pass]", () -> 0.1 + 0.2, 0.3);
        comprueba("NaN == NaN [pass]", () -> Double.NaN, Double.NaN);
        comprueba("lejos [fail]", () -> 1.0, 1.001);
        comprueba("arrays en profundidad [pass]", () -> new int[][]{{1, 2}, {3}}, new int[][]{{1, 2}, {3}});
        comprueba("int[] != long[] [fail]", () -> new int[]{1}, new long[]{1});
        comprueba("List en orden [fail]", () -> List.of(1, 2), List.of(2, 1));
        comprueba("List == ArrayList [pass]", () -> new ArrayList<>(List.of(1, 2)), List.of(1, 2));
        comprueba("Set como conjunto [pass]", () -> new HashSet<>(List.of(1, 2)), Set.of(2, 1));
        comprueba("Map como mapa [pass]", () -> new LinkedHashMap<>(Map.of("a", 1)), new HashMap<>(Map.of("a", 1)));
        comprueba("SequencedMap esperado: con orden [fail]", () -> new LinkedHashMap<>(new TreeMap<>(Map.of("b", 1, "a", 2)).reversed()), new LinkedHashMap<>(new TreeMap<>(Map.of("b", 1, "a", 2))));
        comprueba("SequencedMap esperado: mismo orden [pass]", () -> new TreeMap<>(Map.of("b", 1, "a", 2)), new LinkedHashMap<>(new TreeMap<>(Map.of("b", 1, "a", 2))));
        comprueba("null == null [pass]", () -> (Object) null, (Object) null);
        comprueba("null != valor [fail]", () -> (Object) null, "x");
        comprueba("String por equals [pass]", () -> "ho" + "la", "hola");
        comprueba("record por equals [pass]", () -> new P(1, 2), new P(1, 2));
        comprueba("Character != String [fail]", () -> 'a', "a");
        comprueba("lista anidada con decimales [pass]", () -> List.of(List.of(0.1 + 0.2)), List.of(List.of(0.3)));
        compruebaSinOrden("sin orden: listas [pass]", () -> List.of(3, 1, 2), List.of(1, 2, 3));
        compruebaSinOrden("sin orden: arrays [pass]", () -> new int[]{3, 1, 2}, new int[]{1, 2, 3});
        compruebaSinOrden("sin orden: otro contenido [fail]", () -> List.of(3, 1, 2), List.of(1, 2, 4));
J, "    record P(int x, int y) { }");
$r = runJ($code);
$bad = [];
foreach ($r['tests'] as $t) {
    preg_match('/\[(pass|fail)\]$/', $t['name'], $m);
    if (($m[1] ?? '') !== $t['status']) {
        $bad[] = $t['name'] . ' → ' . $t['status'] . ' ' . ($t['msg'] ?? ($t['actual'] ?? ''));
    }
}
check('22 reglas de igual() (boxing, tolerancia, NaN, arrays, List, Set, Map, SequencedMap, sin orden)', count($r['tests']) === 22 && $bad === [], implode(' | ', $bad));
$r = runJ(mainJ(<<<'J'
        comprueba("export", () -> 1, 2L);
        comprueba("export2", () -> List.of("a", 'b'), Map.of(1.5f, new int[]{1, 2}));
        comprueba("export3", () -> new P(1, "x"), Optional.empty());
J, "    record P(int x, String s) { }"));
$a = array_column($r['tests'], null, 'name');
check('export(): estilo Java (2L, 1.5f, "a", \'b\', int[]{…}, P[x=1, s="x"])', ($a['export']['actual'] ?? '') === '1' && ($a['export']['expected'] ?? '') === '2L'
    && ($a['export2']['actual'] ?? '') === '["a", \'b\']' && ($a['export2']['expected'] ?? '') === '{1.5f=int[]{1, 2}}' && ($a['export3']['actual'] ?? '') === 'P[x=1, s="x"]', json_encode([$a['export']['expected'] ?? '', $a['export2']['actual'] ?? '', $a['export2']['expected'] ?? '', $a['export3']['actual'] ?? '']));
$r = runJ(mainJ('        comprueba("largo", () -> "x".repeat(1000), "y");'));
check('export(): como mucho 300 caracteres', mb_strlen((string) ($r['tests'][0]['actual'] ?? '')) <= 300 && str_ends_with((string) ($r['tests'][0]['actual'] ?? ''), '…'));

// ═══════════════════════════════════════ 4. compilación ═══════════════════════════════════════
section('Compilación: errores sin ejecutar, posiciones en UTF-16 y corrección de la línea 1');
$t0 = microtime(true);
$bad = "class A {\n    void f() {\n        int x = \"a\";\n    }\n    static void g() { foo(); }\n}\n";
$e = $java->syntaxError($bad);
check('error de compilación detectado sin ejecutar: kind parse, code, línea y columnas', $e !== null && $e['kind'] === 'parse' && $e['t'] === 'err' && $e['line'] === 3 && str_starts_with($e['code'], 'compiler.err.')
    && $e['col'] === 17 && $e['endCol'] > $e['col'] && isset($e['endLine'], $e['cls'], $e['msg']), json_encode($e));
$r = runJ($bad);
check('run() con errores: se explican y no se ejecuta nada (sin evento end)', count($r['problems']) === 2 && $r['problems'][0]['source'] === 'syntax' && $r['problems'][0]['line'] === 3 && $r['exit'] !== 0 && $r['ms'] === $r['wallMs'] && textOf($r) === '');
$c1 = "class A { String s = \"😀\"; void f() { foo(); } }";
$esp = (int) (strlen((string) mb_convert_encoding(substr($c1, 0, (int) strpos($c1, 'foo')), 'UTF-16LE', 'UTF-8')) / 2) + 1;
$e = $java->syntaxError($c1);
check("línea 1: la columna no cuenta la inyección y está en UTF-16 (esperada {$esp})", $e !== null && $e['line'] === 1 && $e['col'] === $esp && $e['endCol'] === $esp + 3, json_encode($e));
putenv('PG_COMPILADOR=0');
$e2 = (new JavaLanguage())->syntaxError($c1 . ' ');
$e3 = (new JavaLanguage())->syntaxError("class A {\n\tvoid f() {\n\t\tString x = \"😀\"; foo();\n\t}\n}\n");
putenv('PG_COMPILADOR');
check('el respaldo (javac por línea de comandos) da la misma posición, y entiende tabuladores', $e2 !== null && $e2['col'] === $esp && $e2['code'] === $e['code'] && $e3 !== null && $e3['line'] === 3 && $e3['col'] === 20, json_encode([$e2, $e3]));
check('código correcto → null', $java->syntaxError("class A { }") === null && $java->syntaxError("class A { }") === null);
$a = $java->analyse($bad);
check('analyse(): syntax=false con diagnósticos explicados', $a['syntax'] === false && count($a['diagnostics']) === 2 && !empty($a['diagnostics'][0]['title']));
$e = $java->syntaxError("class A {\n    void f() {\n        int x = 1\n    }\n}\n");
check('falta un «;»: se señala en la línea correcta', $e !== null && $e['line'] === 3 && $e['code'] === 'compiler.err.expected', json_encode($e));

// ═══════════════════════════════════════ 5. declaraciones, insertionPoint ═══════════════════════════════════════
section('declarations() e insertionPoint(): lexer de Java');
$src = <<<'J'
import java.util.*;

class Leccion {
    static final String LLAVE = "}{ // no es un comentario";

    /** Mayor de una lista. */
    @SuppressWarnings("unchecked")
    static <T extends Comparable<T>> T maximo(List<T> xs) {
        String txt = """
            }
            """;
        return xs.get(0);
    }

    int noEstatico() { return 1; }

    static int[] sinDoc() { return new int[]{1, 2}; }

    public static void main(String[] args) {
        System.out.println("}");
    }
}

record Par(int a, int b) { }
enum Color { ROJO, VERDE; static int n() { return 2; } }
interface Forma { double area(); }
@interface Marca { }
J;
$d = $java->declarations($src);
check('claves: static de la clase con main (sin main ni no estáticos) y los tipos de primer nivel', array_keys($d) === ['function:maximo', 'function:sindoc', 'type:par', 'type:color', 'type:forma', 'type:marca'], implode(',', array_keys($d)));
$m = $d['function:maximo'] ?? [];
$codigo = substr($src, $m['start'] ?? 0, ($m['end'] ?? 0) - ($m['start'] ?? 0));
check('start/end incluyen el Javadoc y la anotación; doc, kind, line y norm', str_starts_with($codigo, '/** Mayor de una lista. */') && str_ends_with($codigo, "return xs.get(0);\n    }") && ($m['doc'] ?? '') === '/** Mayor de una lista. */'
    && $m['kind'] === 'function' && $m['line'] === 6 && $m['endLine'] === 13 && !preg_match('/\s/', str_replace(['"""', ' no es'], '', preg_replace('/"""[\s\S]*?"""/', '', $m['norm']))) && str_contains($m['norm'], '@SuppressWarnings("unchecked")static<T'), json_encode($m));
check('tipos: record, enum, interface y @interface con su nombre', ($d['type:par']['kind'] ?? '') === 'type' && substr($src, $d['type:par']['start'], 6) === 'record' && str_ends_with(substr($src, $d['type:color']['start'], $d['type:color']['end'] - $d['type:color']['start']), 'return 2; } }'));
check('insertionPoint(): método → tras el «{» de la clase con main; tipo → al final', substr($src, 0, $java->insertionPoint($src, ['kind' => 'function'])) === substr($src, 0, strpos($src, '{', strpos($src, 'class Leccion')) + 1) && $java->insertionPoint($src, ['kind' => 'type']) === strlen($src));
check('sin ninguna clase: declaraciones vacías e insertionPoint al final', $java->declarations('') === [] && $java->insertionPoint('', ['kind' => 'function']) === 0);

// ═══════════════════════════════════════ 6. soluciones ═══════════════════════════════════════
section('Soluciones: empalmar (splice), no duplicar, conservar y comparar');
$solutions = new Solutions($java);
$user = <<<'J'
import java.util.*;

/** Teoría: esto no se toca. */
class Leccion {
    static final int LIMITE = 10;

    /** Mi versión: todavía sin hacer. */
    static int fibonacci(int n) {
        return pendiente();
    }

    static String otra() { return "intacta"; }

    public static void main(String[] args) {
        System.out.println(fibonacci(5) + " " + otra() + " " + new Pila().tam());
        prueba("fibonacci", caso("cinco", 5, 5), caso("diez", 55, 10));
    }
}

class Pila {
    int tam() { return -1; }
}
J;
$sol = <<<'J'
import java.util.*;

class Soluciones {
    /**
     * Fibonacci iterativo.
     *
     * @complejidad Tiempo O(n), espacio O(1).
     * @explicacion Guarda solo los dos
     * últimos valores.
     * @alternativas Recursiva ingenua: O(2^n).
     * @bigo n
     */
    static int fibonacci(int n) {
        int a = 0, b = 1;
        for (int i = 0; i < n; i++) {
            int t = a + b;
            a = b;
            b = t;
        }
        return a;
    }

    static int ayuda(int x) {
        return x * 2;
    }
}

class Pila {
    private final List<Integer> items = new ArrayList<>();
    int tam() { return items.size(); }
}
J;
$decls = $java->declarations($sol);
check('declarations(): function:fibonacci, function:ayuda y type:pila (Soluciones es solo la envoltura)', array_keys($decls) === ['function:fibonacci', 'function:ayuda', 'type:pila'], implode(',', array_keys($decls)));
$spliced = $solutions->splice($user, $sol);
check('el resultado compila', $java->syntaxError($spliced) === null, json_encode($java->syntaxError($spliced)));
check('fibonacci sustituida (ya no hay pendiente())', !str_contains($spliced, 'pendiente()') && str_contains($spliced, 'int t = a + b;'));
$ini = strpos($spliced, 'class Leccion');
check('auxiliar añadida dentro de la clase con main, antes de lo demás', ($p = strpos($spliced, 'static int ayuda')) !== false && $p > $ini && $p < strpos($spliced, 'public static void main'));
check('tipo sustituido (no duplicado)', substr_count($spliced, 'class Pila') === 1 && str_contains($spliced, 'items.size()') && !str_contains($spliced, 'return -1'));
check('no se duplica al empalmar dos veces', substr_count($solutions->splice($spliced, $sol), 'static int ayuda') === 1 && substr_count($solutions->splice($spliced, $sol), 'class Pila') === 1);
check('teoría y métodos no tocados se conservan', str_contains($spliced, 'LIMITE = 10') && str_contains($spliced, 'return "intacta"') && str_contains($spliced, '/** Teoría'));
$run = runJ($spliced);
check('el código empalmado se ejecuta: «5 intacta 0» y las 2 pruebas en verde', str_contains(textOf($run), '5 intacta 0') && $run['testSummary']['pass'] === 2 && $run['problems'] === [], textOf($run) . json_encode($run['problems']));
$only = $solutions->splice($user, $sol, 'function:ayuda');
check('splice() de una sola clave solo toca esa', str_contains($only, 'static int ayuda') && str_contains($only, 'return pendiente();') && str_contains($only, 'return -1'));
$cmp = $solutions->compare($user, $sol);
$byKey = array_column($cmp, null, 'key');
check('compare() antes: fibonacci no implementada y distinta; ayuda no existe; Pila implementada pero distinta',
    $byKey['function:fibonacci']['implemented'] === false && $byKey['function:fibonacci']['same'] === false && $byKey['function:ayuda']['mine'] === null && $byKey['type:pila']['implemented'] === true && $byKey['type:pila']['same'] === false);
$cmp2 = array_column($solutions->compare($spliced, $sol), null, 'key');
check('compare() después: todo implemented y same', $cmp2 !== [] && !in_array(false, array_merge(array_column($cmp2, 'implemented'), array_column($cmp2, 'same')), true));
$doc = $byKey['function:fibonacci']['doc'];
check('el Javadoc documenta la solución: @complejidad, @explicacion (varias líneas), @alternativas, @bigo', ($doc['bigo'] ?? '') === 'n' && str_starts_with($doc['complejidad'] ?? '', 'Tiempo O(n)')
    && str_contains($doc['explicacion'] ?? '', "dos\núltimos") && ($doc['text'] ?? '') === 'Fibonacci iterativo.', json_encode($doc, JSON_UNESCAPED_UNICODE));

// ═══════════════════════════════════════ 7. compilador residente ═══════════════════════════════════════
section('Compilador residente: arranque, protocolo, seguridad, respaldo y velocidad');
$java->syntaxError("class Calentar { }");
$infoFile = PG_VAR . '/java/compilador.json';
$info = json_decode((string) @file_get_contents($infoFile), true);
check('arranca bajo demanda y publica {port, token, pid}', is_array($info) && isset($info['port'], $info['token'], $info['pid']) && strlen($info['token']) >= 16 && vivo((int) $info['pid']));
$send = static function (string $raw) use ($info): string {
    $fp = @stream_socket_client('tcp://127.0.0.1:' . $info['port'], $en, $es, 2);
    if (!$fp) {
        return 'SIN CONEXIÓN';
    }
    stream_set_timeout($fp, 5);
    fwrite($fp, $raw);
    $out = (string) stream_get_contents($fp);
    fclose($fp);
    return $out;
};
$tmpDir = Process::makeTempDir('pgjt_');
$pet = ['op' => 'compile', 'name' => 'Zeta.java', 'src' => 'class Zeta { int x = ; }', 'cp' => '', 'out' => $tmpDir];
$out = $send(json_encode($pet) . "\n");
check('rechaza una petición sin token', str_contains($out, '"error"') && !str_contains($out, 'diags'), $out);
$out = $send(json_encode(['token' => 'mal'] + $pet) . "\n");
check('rechaza una petición con token incorrecto', str_contains($out, '"error"') && !str_contains($out, 'diags'), $out);
$out = $send("GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
check('no habla HTTP: lo que no empieza por «{» se cierra sin contestar', $out === '', substr($out, 0, 60));
$out = $send(json_encode(['token' => $info['token']] + $pet) . "\n");
$j = json_decode(trim($out), true);
check('con token válido contesta una línea JSON con diags, código compiler.err.* y posiciones (tras los rechazos sigue vivo)', is_array($j) && $j['ok'] === false && str_starts_with($j['diags'][0]['code'] ?? '', 'compiler.err.') && ($j['diags'][0]['line'] ?? 0) === 1 && isset($j['diags'][0]['endCol']) && str_ends_with($out, "\n"), substr($out, 0, 160));
$out = $send(json_encode(['token' => $info['token']] + $pet) . "\n");
$bien = $send(json_encode(['token' => $info['token'], 'op' => 'compile', 'name' => 'Zeta.java', 'src' => 'class Zeta { int x = 1; }', 'cp' => '', 'out' => $tmpDir]) . "\n");
check('compila y escribe los .class en la carpeta pedida', str_contains($bien, '"ok":true') && is_file($tmpDir . '/Zeta.class'), $bien);
$out = $send(json_encode(['token' => $info['token'], 'op' => 'compile', 'name' => '../x.java', 'src' => '', 'cp' => '', 'out' => $tmpDir]) . "\n");
check('rechaza nombres de archivo con rutas', str_contains($out, '"error"'), $out);
Process::rmTree($tmpDir);

$fixture = (string) file_get_contents(__DIR__ . '/fixtures/Medio400.java');
$r = runJ($fixture);
check('fixture de ~' . substr_count($fixture, "\n") . ' líneas: 60 pruebas en verde', $r['testSummary']['pass'] === 60 && $r['testSummary']['fail'] === 0 && $r['problems'] === [], json_encode($r['testSummary']));

// Se mata el compilador: el respaldo (javac) atiende, y después se relanza otro
$pid = (int) $info['pid'];
DIRECTORY_SEPARATOR === '\\' ? exec('taskkill /F /PID ' . $pid . ' >NUL 2>&1') : exec('kill -9 ' . $pid . ' 2>/dev/null');
usleep(300_000);
@touch(PG_VAR . '/java/compilador.fallo');           // simula «el residente no arranca»: no se relanza
$jk = new JavaLanguage();
$e = $jk->syntaxError("class K { void f() { bar(); } }");
check('compilador muerto y sin poder relanzarse: cae a javac por línea de comandos y sigue funcionando', $jk->ultimaVia === 'javac' && $e !== null && $e['line'] === 1, $jk->ultimaVia . json_encode($e));
@unlink(PG_VAR . '/java/compilador.fallo');
$jk = new JavaLanguage();
$e = $jk->syntaxError("class K2 { void f() { baz(); } }");
$info2 = json_decode((string) @file_get_contents($infoFile), true);
check('compilador muerto: la siguiente petición se atiende y se relanza otro (otro pid)', $jk->ultimaVia === 'residente' && is_array($info2) && $info2['pid'] !== $info['pid'] && $e !== null, json_encode($info2));
$info = $info2;

if (!$fast) {
    // ═══════════════════════════════════════ 8. smoke HTTP ═══════════════════════════════════════
    section('Servidor real (php -S): /api?lang=java&action=run');
    $port = random_int(20000, 60000);
    $log = sys_get_temp_dir() . '/pg_http_java.log';
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
        $r = $http('POST', '/api?lang=java&action=run', ['Content-Type' => 'application/json', 'X-Playground' => '1'], json_encode(['code' => mainJ('        System.out.println(6 * 7);')]));
        $j = json_decode($r['body'], true);
        check('POST run con println(6 * 7) → 42', $r['status'] === 200 && str_contains(implode('', array_column($j['segments'] ?? [], 'text')), '42'), "status {$r['status']} " . mb_substr($r['body'], 0, 200));
    }
    if (is_resource($proc)) {
        proc_terminate($proc);
        proc_close($proc);
    }
    @unlink($log);

    // ═══════════════════════════════════════ 9. tiempos ═══════════════════════════════════════
    section('Tiempos (objetivo con el residente caliente: archivo de ~400 líneas p50 ≤ 700 ms)');
    $p50 = static function (string $code, int $veces = 7): float {
        $t = [];
        for ($i = 0; $i < $veces; $i++) {
            $t0 = hrtime(true);
            runJ($code . "\n// v{$i}\n");
            $t[] = (hrtime(true) - $t0) / 1e6;
        }
        sort($t);
        return $t[intdiv($veces, 2)];
    };
    $hola = $p50(mainJ('        System.out.println("hola");'));
    $medio = $p50($fixture);
    echo sprintf("  hola mundo: p50 %.0f ms · fixture %d líneas, 60 pruebas: p50 %.0f ms (residente caliente)\n", $hola, substr_count($fixture, "\n"), $medio);
    check('fixture de ~' . substr_count($fixture, "\n") . ' líneas con el residente caliente: p50 ≤ 700 ms', $medio <= 700, sprintf('%.0f ms', $medio));
    putenv('PG_COMPILADOR=0');
    $respaldo = $p50($fixture, 5);
    putenv('PG_COMPILADOR');
    echo sprintf("  respaldo (javac por línea de comandos): p50 %.0f ms\n", $respaldo);
    check('el respaldo también funciona con el fixture (informativo: p50 ≤ 3000 ms)', $respaldo <= 3000, sprintf('%.0f ms', $respaldo));
}

// ═══════════════════════════════════════ fin: nada vivo ═══════════════════════════════════════
JavaLanguage::pararResidente();
$pidFinal = (int) ($info['pid'] ?? 0);
$fin = microtime(true) + 3;
while ($pidFinal > 0 && vivo($pidFinal) && microtime(true) < $fin) {
    usleep(50_000);
}
check('al terminar no queda ningún compilador residente vivo', $pidFinal === 0 || !vivo($pidFinal));

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
