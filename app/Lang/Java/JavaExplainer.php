<?php
declare(strict_types=1);

namespace Playground\Lang\Java;

use Playground\Core\Explains;
use Playground\Lang\Java\Analysis\JavaCode;

defined('PG_ROOT') or exit;

/**
 * Traduce un error de Java (de compilación o de ejecución) a un diagnóstico explicado en español.
 *
 * Los de compilación se reconocen por el CÓDIGO de javac (`compiler.err.cant.resolve.location`...); del texto en inglés
 * solo se sacan los datos (qué símbolo, qué tipos). Los de ejecución, por la clase de la excepción.
 * Códigos compartidos con PHP y Python cuando hay equivalente: undefined-variable, undefined-method, class-not-found,
 * member-on-null, index-out-of-range, division-by-zero, overflow, invalid-number, mutate-iter, immutable, argument-value,
 * stack-overflow, out-of-memory, timeout, generic...
 */
final class JavaExplainer implements Explains
{
    /** Clase del JDK → paquete (para el import automático y las sugerencias). */
    private const PAQUETE = [
        'ArrayList' => 'java.util', 'List' => 'java.util', 'LinkedList' => 'java.util', 'Map' => 'java.util', 'HashMap' => 'java.util',
        'TreeMap' => 'java.util', 'LinkedHashMap' => 'java.util', 'Set' => 'java.util', 'HashSet' => 'java.util', 'TreeSet' => 'java.util',
        'LinkedHashSet' => 'java.util', 'Deque' => 'java.util', 'ArrayDeque' => 'java.util', 'Queue' => 'java.util', 'PriorityQueue' => 'java.util',
        'Stack' => 'java.util', 'Arrays' => 'java.util', 'Collections' => 'java.util', 'Optional' => 'java.util', 'Scanner' => 'java.util',
        'Random' => 'java.util', 'Objects' => 'java.util', 'Iterator' => 'java.util', 'Comparator' => 'java.util', 'Collectors' => 'java.util.stream',
        'Stream' => 'java.util.stream', 'IntStream' => 'java.util.stream', 'Function' => 'java.util.function', 'Supplier' => 'java.util.function',
        'Consumer' => 'java.util.function', 'Predicate' => 'java.util.function', 'BiFunction' => 'java.util.function',
        'BufferedReader' => 'java.io', 'InputStreamReader' => 'java.io', 'IOException' => 'java.io', 'File' => 'java.io',
        'BigInteger' => 'java.math', 'BigDecimal' => 'java.math', 'LocalDate' => 'java.time', 'Duration' => 'java.time',
        'AtomicInteger' => 'java.util.concurrent.atomic', 'Pattern' => 'java.util.regex', 'Matcher' => 'java.util.regex',
    ];
    /** Clases de java.lang (no necesitan import) más habituales. */
    private const LANG = ['String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Character', 'Byte', 'Short', 'Math', 'System', 'Object',
        'StringBuilder', 'StringBuffer', 'Thread', 'Exception', 'RuntimeException', 'IllegalArgumentException', 'IllegalStateException',
        'NullPointerException', 'ArithmeticException', 'Number', 'Iterable', 'Runnable', 'Comparable', 'Record', 'Enum', 'Error'];
    /** Métodos frecuentes por tipo (para «¿quisiste decir…?»). */
    private const METODOS = [
        'String' => ['length', 'charAt', 'substring', 'indexOf', 'lastIndexOf', 'contains', 'equals', 'equalsIgnoreCase', 'compareTo', 'startsWith',
            'endsWith', 'isEmpty', 'isBlank', 'toUpperCase', 'toLowerCase', 'trim', 'strip', 'split', 'replace', 'replaceAll', 'toCharArray', 'matches',
            'concat', 'repeat', 'chars', 'format', 'valueOf', 'join', 'hashCode', 'intern'],
        'List' => ['add', 'get', 'set', 'remove', 'size', 'isEmpty', 'contains', 'indexOf', 'lastIndexOf', 'clear', 'addAll', 'sort', 'forEach', 'stream',
            'subList', 'toArray', 'iterator', 'removeIf', 'of', 'copyOf', 'equals'],
        'Map' => ['put', 'get', 'getOrDefault', 'containsKey', 'containsValue', 'remove', 'size', 'isEmpty', 'keySet', 'values', 'entrySet',
            'putIfAbsent', 'computeIfAbsent', 'merge', 'forEach', 'clear', 'putAll', 'of'],
        'Set' => ['add', 'contains', 'remove', 'size', 'isEmpty', 'clear', 'addAll', 'retainAll', 'removeAll', 'stream', 'iterator', 'of'],
        'Deque' => ['push', 'pop', 'peek', 'offer', 'poll', 'addFirst', 'addLast', 'removeFirst', 'removeLast', 'peekFirst', 'peekLast',
            'pollFirst', 'pollLast', 'isEmpty', 'size', 'add', 'remove', 'clear', 'contains'],
        'StringBuilder' => ['append', 'insert', 'reverse', 'toString', 'length', 'charAt', 'deleteCharAt', 'delete', 'setCharAt', 'setLength', 'indexOf',
            'replace', 'isEmpty'],
        'Math' => ['abs', 'max', 'min', 'pow', 'sqrt', 'cbrt', 'floor', 'ceil', 'round', 'random', 'floorDiv', 'floorMod', 'hypot', 'log', 'log10',
            'exp', 'sin', 'cos', 'tan', 'signum', 'toRadians', 'addExact', 'multiplyExact'],
        'Arrays' => ['sort', 'fill', 'toString', 'asList', 'copyOf', 'copyOfRange', 'equals', 'stream', 'binarySearch', 'deepToString'],
        'Collections' => ['sort', 'reverse', 'shuffle', 'max', 'min', 'unmodifiableList', 'emptyList', 'swap', 'frequency', 'singletonList'],
        'Integer' => ['parseInt', 'valueOf', 'toString', 'compare', 'toBinaryString', 'sum', 'max', 'min', 'bitCount', 'MAX_VALUE', 'MIN_VALUE'],
        'Scanner' => ['nextInt', 'nextLine', 'next', 'nextDouble', 'hasNext', 'hasNextInt', 'hasNextLine', 'close', 'nextLong', 'nextBoolean'],
        'PrintStream' => ['println', 'print', 'printf', 'format', 'flush'],
        'Optional' => ['of', 'ofNullable', 'empty', 'isPresent', 'isEmpty', 'get', 'orElse', 'orElseGet', 'orElseThrow', 'map', 'ifPresent'],
        'Character' => ['isDigit', 'isLetter', 'isLetterOrDigit', 'isUpperCase', 'isLowerCase', 'toUpperCase', 'toLowerCase', 'getNumericValue', 'isWhitespace'],
        'Object' => ['equals', 'hashCode', 'toString', 'getClass'],
    ];
    /** Tipo concreto → grupo de METODOS. */
    private const GRUPO = [
        'ArrayList' => 'List', 'LinkedList' => 'List', 'Collection' => 'List', 'Vector' => 'List', 'HashMap' => 'Map', 'TreeMap' => 'Map',
        'LinkedHashMap' => 'Map', 'HashSet' => 'Set', 'TreeSet' => 'Set', 'LinkedHashSet' => 'Set', 'ArrayDeque' => 'Deque', 'Queue' => 'Deque',
        'PriorityQueue' => 'Deque', 'Stack' => 'Deque', 'StringBuffer' => 'StringBuilder', 'Long' => 'Integer', 'Double' => 'Integer',
    ];
    /** Nombres de otros lenguajes → su equivalente en Java. */
    private const AJENOS = [
        'len' => 'En Java: `texto.length()`, `lista.size()` o `array.length` (sin paréntesis).', 'print' => 'En Java se imprime con `System.out.println(...)`.',
        'printf' => 'Es `System.out.printf(...)`.', 'input' => 'Para leer del teclado: `Scanner sc = new Scanner(System.in); sc.nextLine();`.',
        'str' => 'Para convertir a texto: `String.valueOf(x)` o `"" + x`.', 'int' => 'Para convertir un texto a número: `Integer.parseInt(texto)`.',
        'range' => 'Java no tiene `range`: usa `for (int i = 0; i < n; i++)` o `IntStream.range(0, n)`.', 'append' => 'En una lista es `lista.add(x)`; en un `StringBuilder`, `sb.append(x)`.',
        'push' => 'En Java: `deque.push(x)` (ArrayDeque) o `lista.add(x)`.', 'lower' => 'Es `toLowerCase()`.', 'upper' => 'Es `toUpperCase()`.',
        'strip' => 'Es `trim()` (o `strip()` en String).', 'count' => 'Para contar elementos: `lista.size()`; para contar apariciones, `Collections.frequency(lista, x)`.',
        'strlen' => 'Es `texto.length()`.', 'echo' => 'Es `System.out.println(...)`.', 'True' => 'En Java es `true` (minúscula).', 'False' => 'En Java es `false` (minúscula).',
        'None' => 'En Java es `null`.', 'Null' => 'En Java es `null` (minúscula).', 'NULL' => 'En Java es `null` (minúscula).', 'string' => 'El tipo es `String` con mayúscula.',
        'Int' => 'El tipo primitivo es `int` (minúscula); el de objeto, `Integer`.', 'Boolean' => 'El primitivo es `boolean` (minúscula).', 'bool' => 'En Java el tipo es `boolean`.',
        'array' => 'En Java: `int[] a = new int[5];` o `ArrayList<Integer>`.', 'dict' => 'El diccionario de Java es `Map<K, V>` (`HashMap`).',
        'list' => 'En Java: `List<Integer> lista = new ArrayList<>();`.', 'self' => 'En Java se usa `this`.', 'elif' => 'En Java es `else if`.',
    ];

    private ?JavaCode $jc = null;

    public function __construct(private readonly string $code)
    {
    }

    private function jc(): JavaCode
    {
        return $this->jc ??= new JavaCode($this->code);
    }

    /** @param array<string,mixed> $ev */
    public function explain(array $ev): array
    {
        $kind = (string) ($ev['kind'] ?? 'exception');
        $line = max(1, (int) ($ev['line'] ?? 1));
        $msg = (string) ($ev['msg'] ?? '');
        $base = ['severity' => 'error', 'line' => $line, 'col' => 1, 'endLine' => $line, 'endCol' => 1000, 'explain' => '', 'original' => $msg,
            'message' => trim(explode("\n", $msg)[0])];
        if (isset($ev['trace'])) {
            $base['trace'] = $ev['trace'];
        }
        if ($kind === 'parse') {
            $col = max(1, (int) ($ev['col'] ?? 1));
            $base = ['source' => 'syntax', 'col' => $col, 'endLine' => (int) ($ev['endLine'] ?? $line),
                'endCol' => max($col + 1, (int) ($ev['endCol'] ?? $col + 1))] + $base;
            return $this->compile(preg_replace('/^compiler\.(err|warn)\./', '', (string) ($ev['code'] ?? '')) ?? '', $msg, $base);
        }
        $base['source'] = 'runtime';
        switch ($kind) {
            case 'timeout':
                $s = (int) ($ev['limit'] ?? 5);
                return ['code' => 'timeout', 'title' => "El programa tardó más de {$s} s y se detuvo",
                    'explain' => "El programa estuvo ejecutándose más de **{$s} segundos** y el playground lo detuvo. Casi siempre es un **bucle infinito** (la condición de `while`/`for` nunca se vuelve falsa, o falta actualizar la variable) o un algoritmo demasiado lento para esa entrada (mira el `O()` en el panel de análisis).\n\nRevisa: ¿la variable del bucle cambia en cada vuelta? ¿esperas leer con `Scanner` algo que no hay en «Entrada» (se queda bloqueado)? ¿una recursión sin caso base?",
                    'hint' => 'Añade un `System.out.println` dentro del bucle para ver si avanza.'] + $base;
            case 'stack':
                return ['code' => 'stack-overflow', 'title' => 'Desbordamiento de pila (¿recursión sin caso base?)',
                    'explain' => "Un método se llamó a sí mismo (o se llamaron entre ellos) tantas veces que **se agotó la pila de llamadas** (`StackOverflowError`). Cada llamada ocupa memoria hasta que termina.\n\nCausas típicas:\n- **Falta el caso base**: el `if` que detiene la recursión (`if (n <= 1) return 1;`).\n- **El argumento no se acerca al caso base** (llamas con `n` en vez de `n - 1`).\n- Dos métodos que se llaman uno a otro sin fin, o un `toString()` que se imprime a sí mismo.\n\nSi la recursión es legítima pero muy profunda (cientos de miles), conviértela en un bucle con un `ArrayDeque` como pila.",
                    'hint' => 'Mira en la traza qué método se repite: ahí falta el caso base.'] + $base;
            case 'memory':
                return ['code' => 'out-of-memory', 'title' => 'Memoria agotada (el límite es 256 MB)',
                    'explain' => "El programa pidió más memoria de la permitida (`OutOfMemoryError`: el límite del playground es **256 MB**).\n\nCausas típicas: una colección que crece sin parar dentro de un bucle infinito, un array enorme (`new int[1_000_000_000]`), concatenar `String` en un bucle gigante o guardar todo en memoria cuando bastaría con ir procesando.",
                    'hint' => 'Procesa los datos por trozos o usa tipos más pequeños (`int` en vez de `long`, `byte[]`...).'] + $base;
        }
        return $this->runtime($ev, $base);
    }

    // ═══════════════════════════ compilación ═══════════════════════════

    /** @param array<string,mixed> $b */
    private function compile(string $c, string $msg, array $b): array
    {
        $first = trim(explode("\n", $msg)[0]);
        $r = fn(string $code, string $title, string $explain, array $x = []) => ['code' => $code, 'title' => $title, 'explain' => $explain] + $x + $b;
        $range = ['sl' => $b['line'], 'sc' => $b['col'], 'el' => $b['endLine'], 'ec' => $b['endCol']];
        $ins = static fn(int $l, int $col, string $t): array => ['range' => ['sl' => $l, 'sc' => $col, 'el' => $l, 'ec' => $col], 'text' => $t];
        $fixEdits = static fn(string $title, array ...$edits): array => ['title' => $title, 'edits' => $edits];

        switch ($c) {
            case 'expected':
            case 'expected2':
            case 'expected3':
            case 'expected4':
                if (preg_match('/^(?:\')?(.+?)(?:\')? expected$/', $first, $m)) {
                    $falta = $m[1];
                } else {
                    $falta = $first;
                }
                if ($falta === "';'" || $falta === ';' || $first === "';' expected") {
                    return $r('parse.semicolon', 'Falta un punto y coma (;)',
                        "En Java **cada sentencia termina en `;`**. javac se dio cuenta al llegar al final de esta línea, así que el `;` va justo aquí. Cuando el error señala una línea, mira también si la **anterior** acabó bien.",
                        ['fixes' => [$fixEdits('Añadir `;`', $ins($b['line'], $b['col'], ';'))]]);
                }
                $cierre = null;
                if (str_contains($first, "')'")) {
                    $cierre = ')';
                } elseif (str_contains($first, "']'")) {
                    $cierre = ']';
                }
                $x = $cierre !== null ? "\n\nLo más habitual: **falta cerrar un paréntesis** `{$cierre}` (cuenta los que abren y los que cierran en la línea) o una coma entre argumentos." : '';
                return $r('parse.expected', 'Falta algo en la sintaxis: ' . str_replace(' expected', '', $first) . ' esperado',
                    "javac esperaba {$first} en este punto y no lo encontró. Suele ser un paréntesis, llave o coma que falta, o una palabra mal escrita justo antes.{$x}");
            case 'premature.eof':
                return $r('parse.eof', 'El archivo termina antes de tiempo (falta cerrar una llave)',
                    "El archivo se acabó con algo sin cerrar: casi siempre **falta una llave `}`** (de un método, una clase, un `if` o un bucle). Cada `{` necesita su `}`.\n\nAyuda: sangra el código con cuidado y mira dónde se rompe la alineación. Quizá la llave que falta está en un bloque anterior, no en el último.");
            case 'else.without.if':
                return $r('parse.else-if', "`else` sin `if`", "Hay un `else` al que no le corresponde ningún `if`. Casi siempre es una **llave `}` de más o de menos** antes del `else`, o un `;` justo tras el `if (cond)` (`if (x > 0);` cierra el if vacío).");
            case 'orphaned':
                return $r('parse.orphan', "`$first` fuera de sitio", "Una palabra como `case` o `default` solo puede ir dentro de un `switch`. Revisa las llaves del bloque anterior.");
            case 'illegal.start.of.expr':
            case 'illegal.start.of.type':
            case 'illegal.start.of.stmt':
                return $r('parse.syntax', 'Aquí no puede empezar una expresión',
                    "javac no entiende lo que hay en este punto: se esperaba una expresión (un valor, una variable, una llamada) y encontró otra cosa.\n\nCausas típicas: un `=` o un operador sin valor al lado (`int x = ;`), una llave o paréntesis sobrante en la línea anterior, una sentencia suelta fuera de un método (el código debe estar **dentro de un método**, p. ej. `main`), o `public`/`private` dentro de un método.");
            case 'not.stmt':
                return $r('parse.not-stmt', 'Esto no es una sentencia válida',
                    "Escribiste una expresión que no hace nada por sí sola (`5;`, `x + 1;`, `a == b;`, o el nombre de una variable). En Java una sentencia debe ser una asignación, una llamada a un método, `++`/`--`, o una declaración.\n\n¿Querías **asignar**? Usa `=` (`x = x + 1;`). `==` es para comparar dentro de un `if`. ¿Querías **llamar** a un método? Faltan los paréntesis (`lista.clear();`).");
            case 'unclosed.str.lit':
                return $r('parse.string', 'Cadena de texto sin cerrar',
                    "Abriste unas comillas `\"` y no las cerraste en la misma línea. Una cadena debe empezar y acabar con `\"` en la misma línea (para varias líneas usa `\"\"\"` o concatena con `+`). Si el texto lleva comillas dentro, escápalas: `\\\"`.");
            case 'unclosed.char.lit':
            case 'empty.char.lit':
                return $r('parse.char', 'Literal de carácter mal escrito', "Un `char` va entre **comillas simples** y es un solo carácter: `'a'`. Para varios caracteres usa un `String` con comillas dobles: `\"hola\"`.");
            case 'illegal.char':
                return $r('parse.char', 'Carácter no permitido en el código',
                    "Hay un carácter que Java no admite fuera de un texto (" . $first . "). Suele ser una **comilla tipográfica** (“ ” ‘ ’) copiada de un documento, un guion largo `–` o un espacio raro. Reescríbelo con el teclado: comillas rectas `\"` y `'`.");
            case 'class.public.should.be.in.file':
                return $r('public-class-file', 'La clase pública debe estar en un archivo con su nombre',
                    "En Java una clase `public` debe vivir en un archivo con **el mismo nombre** (`public class Hola` → `Hola.java`). Aquí el archivo tiene otro nombre.\n\nEn el playground basta con quitar `public` de la clase (o renombrar el archivo).");
            case 'invalid.meth.decl.ret.type.req':
                return $r('parse.java-decl', 'Falta el tipo de retorno del método',
                    "Un método necesita declarar qué devuelve: `static int suma(int a, int b)` o `static void saluda()`. Si ves este error con el nombre de una clase, comprueba que el nombre del constructor coincida **exactamente** con el de la clase (mayúsculas incluidas), o que no hayas escrito mal `public`/`static`.");
            case 'missing.meth.body.or.decl.abstract':
                return $r('parse.syntax', 'Método sin cuerpo', "Un método con `{ ... }` necesita su cuerpo. Si lo termina un `;` (`void f();`) solo es válido en una interfaz o si el método es `abstract`. Probablemente sobra un `;` tras los paréntesis.");
            case 'ret.outside.meth':
                return $r('parse.closing', '`return` fuera de un método', "Hay un `return` que está fuera de cualquier método: se cerró una llave `}` de más antes. Revisa las llaves.");
            case 'try.without.catch.finally.or.resource.decls':
                return $r('parse.syntax', '`try` sin `catch` ni `finally`', "Un `try` necesita al menos un `catch (Excepcion e) { ... }` o un `finally { ... }` (o recursos entre paréntesis).");
            case 'int.number.too.large':
                return $r('overflow', 'Número entero demasiado grande',
                    "Un literal entero sin sufijo es un `int`, que llega hasta **2 147 483 647**. Para números mayores escribe una `L` al final: `3000000000L` (tipo `long`), o usa `long x = 3_000_000_000L;`.",
                    ['fixes' => $this->suffixFix($b, 'L')]);
            case 'cant.resolve':
            case 'cant.resolve.location':
            case 'cant.resolve.location.args':
            case 'cant.resolve.args':
            case 'cant.resolve.location.args.params':
                return $this->noEncuentra($msg, $b);
            case 'doesnt.exist':
                $pk = preg_match('/package (\S+) does not exist/', $first, $m) ? $m[1] : '?';
                $suger = [];
                $esc = ucfirst($pk);
                if ($esc !== $pk) {
                    $suger[] = $esc;
                }
                return $r('class-not-found', "El paquete `$pk` no existe",
                    "javac no encuentra el paquete `$pk`. Si ibas a usar una clase (`System`, `Math`, `String`...), **las clases se escriben con mayúscula inicial**: `System.out.println`, no `system.out.println`. Si es un `import`, comprueba la ortografía (`java.util.Scanner`)." . ($suger ? "\n\n¿Querías decir `{$suger[0]}`?" : ''),
                    ['suggestions' => $suger]);
            case 'prob.found.req':
            case 'incompatible.types':
                return $this->incompatibles($first, $b);
            case 'type.found.req':
                $prim = preg_match('/found:\s+(\w+)/', $msg, $m) ? $m[1] : 'int';
                $env = ['int' => 'Integer', 'long' => 'Long', 'double' => 'Double', 'boolean' => 'Boolean', 'char' => 'Character', 'float' => 'Float', 'byte' => 'Byte', 'short' => 'Short'][$prim] ?? null;
                return $r('type-mismatch', 'Un genérico no admite tipos primitivos',
                    "Los genéricos (`List<...>`, `Map<..., ...>`) solo aceptan **clases**, no tipos primitivos como `{$prim}`. Usa su clase envoltorio" . ($env ? ": `{$env}`" : '') . ". Java convierte solo (autoboxing) al añadir y leer valores.",
                    $env !== null && $b['line'] === $b['endLine'] ? ['fixes' => [['title' => "Usar `{$env}`", 'edits' => [['range' => $range, 'text' => $env]]]]] : []);
            case 'missing.ret.stmt':
                return $r('missing-return', 'Falta un return en este método',
                    "El método promete devolver un valor, pero **hay un camino por el que acaba sin hacer `return`** (el compilador lo señala en la llave que lo cierra). Suele pasar con un `if` sin `else`, o con un `return` solo dentro de un bucle: si la condición nunca se cumple, el método llega al final sin devolver nada.\n\nAñade un `return` al final con el valor por defecto (`return -1;`, `return null;`, `return false;`) o un `else` que también devuelva.");
            case 'var.might.not.have.been.initialized':
                $v = preg_match('/variable (\S+)/', $first, $m) ? $m[1] : 'la variable';
                return $r('uninitialized-variable', "La variable `$v` puede no tener valor todavía",
                    "En Java las variables **locales no se inicializan solas**: hay que darles un valor antes de leerlas. javac ve un camino (un `if` sin `else`, un bucle que quizá no entra, un `try`) en el que `$v` llega aquí sin valor.\n\nInicialízala al declararla: `int $v = 0;` (o `String $v = null;`), o asegúrate de asignarla en todos los caminos.");
            case 'var.not.initialized.in.default.constructor':
            case 'var.might.already.be.assigned':
                return $r('uninitialized-variable', 'Variable final sin inicializar o asignada dos veces', "Un campo `final` se debe asignar **exactamente una vez**: al declararlo o en el constructor. $first.");
            case 'already.defined':
                $v = preg_match('/^(variable|method|class|constructor) (\S+)/', $first, $m) ? $m[2] : 'ese nombre';
                $k = $m[1] ?? 'variable';
                return $r('redeclare', "`$v` ya está definido", ($k === 'variable'
                    ? "Declaraste dos veces la variable `$v` en el mismo bloque (o una dentro de otra que sigue viva). La segunda vez **no lleves el tipo**: `$v = valor;` reasigna, `int $v = valor;` declara otra nueva. O usa otro nombre."
                    : "Ya existe un $k con esa firma en esta clase. Dos métodos pueden compartir nombre solo si sus **parámetros** son distintos (sobrecarga)."));
            case 'cant.apply.symbol':
            case 'cant.apply.symbols':
            case 'cant.apply.diamond':
            case 'cant.apply.diamond.1':
                return $this->noEncajan($msg, $b);
            case 'unreported.exception.need.to.catch.or.throw':
            case 'unreported.exception.default.constructor':
            case 'unreported.exception.implicit.close':
                $ex = preg_match('/exception ([\w.]+)/', $first, $m) ? $m[1] : 'Exception';
                $corto = substr($ex, (int) strrpos('.' . $ex, '.'));
                $unit = $this->unitAt($b['line']);
                $x = ['suggestions' => ["throws $ex", "try { ... } catch ($corto e) { ... }"]];
                if ($unit !== null && !$unit['throws'] && !$this->hasLambdaBetween($unit, $b['line'], $b['col'])) {
                    $x['fixes'] = [['title' => "Añadir `throws $ex` al método {$unit['name']}", 'edits' => [$this->throwsEdit($unit, $ex)]]];
                }
                return $r('unreported-exception', "Excepción comprobada sin tratar: $corto",
                    "`$corto` es una excepción **comprobada** (*checked*): Java obliga a decidir qué hacer con ella antes de compilar. Tienes dos caminos:\n\n1. **Tratarla aquí**: envuelve la llamada en `try { ... } catch ($corto e) { ... }`.\n2. **Delegarla**: declara `throws $corto` en la firma del método (`static void f() throws $corto`) y que lo trate quien lo llame.\n\nOjo: dentro de una lambda no vale `throws` del método que la contiene; hay que usar `try/catch` dentro de la lambda.", $x);
            case 'except.never.thrown.in.try':
                return $r('unreported-exception', 'Esa excepción nunca se lanza en el `try`', "Capturas una excepción *comprobada* que ninguna de las sentencias del `try` puede lanzar, y Java lo considera un error. Quita ese `catch` o captura `Exception`. $first");
            case 'except.already.caught':
                return $r('redeclare', 'Excepción ya capturada antes', "Un `catch` anterior ya captura esta excepción (o una más general). Pon los `catch` de lo **más específico a lo más general**.");
            case 'non-static.cant.be.ref':
                $quien = preg_match('/non-static (method|variable) (\S+?)(?:\(.*?\))? cannot/', $first, $m) ? $m[2] : 'ese miembro';
                $esMetodo = ($m[1] ?? '') === 'method';
                $x = [];
                $unit = $esMetodo ? $this->unitNamed($quien) : null;
                if ($unit !== null && !$unit['static'] && !$unit['ctor']) {
                    $jc = $this->jc();
                    $tt = $jc->t[$unit['typeTok']];
                    $x['fixes'] = [['title' => "Hacer `static` el método $quien", 'edits' => [$ins($tt[3], $jc->col($tt[2], $tt[3]), 'static ')]]];
                }
                return $r('non-static-ref', 'Un miembro no estático se usa desde un contexto estático',
                    "`main` (y los métodos `static`) pertenecen a la **clase**, no a un objeto; en cambio `$quien` pertenece a cada **objeto** y necesita uno para existir. Dos soluciones:\n\n1. Marca `$quien` como `static` si no depende de ningún objeto.\n2. Crea un objeto y llámalo con él: `Main m = new Main(); m.$quien" . ($esMetodo ? '()' : '') . ";`.\n\nEn programas pequeños suele bastar con `static`.", $x);
            case 'does.not.override.abstract':
                $cl = preg_match('/^(\S+) is not abstract and does not override abstract method (\S+) in (\S+)/', $first, $m) ? [$m[1], $m[2], $m[3]] : ['La clase', 'un método', 'la interfaz'];
                return $r('abstract-not-implemented', "`{$cl[0]}` no implementa `{$cl[1]}`",
                    "`{$cl[0]}` dice que implementa (o hereda de) `{$cl[2]}`, pero **no define el método `{$cl[1]}`** que esa interfaz o clase abstracta exige. Impleméntalo con la misma firma y, si es de una interfaz, con `public`: `public void run() { ... }`. O declara `{$cl[0]}` como `abstract`.");
            case 'abstract.cant.be.instantiated':
                return $r('instantiate-abstract', 'No se puede crear un objeto de una clase abstracta', "Una clase `abstract` o una interfaz no se instancia con `new`: crea un objeto de una clase concreta que la extienda/implemente (`List<Integer> l = new ArrayList<>();`). $first");
            case 'unreachable.stmt':
                return $r('unreachable', 'Código inalcanzable',
                    "Esta sentencia **nunca se ejecutará**: justo antes hay un `return`, `break`, `continue`, `throw` o un bucle infinito que siempre sale antes. Java lo considera un error. Quita la sentencia o mueve el `return` después de ella.");
            case 'cant.deref':
                $t = preg_match('/^(\S+) cannot be dereferenced/', $first, $m) ? $m[1] : 'ese valor';
                return $r('cant-deref', "`$t` es un tipo primitivo: no tiene métodos",
                    "Los tipos primitivos (`int`, `double`, `boolean`, `char`...) **no son objetos**: no se les puede poner un punto detrás (`x.length()`, `n.toString()`). Para convertir: `String.valueOf(n)` / `Integer.toString(n)`. Para contar dígitos, conviértelo antes a texto. Si necesitas un objeto, usa su clase envoltorio (`Integer`, `Double`).");
            case 'operator.cant.be.applied':
            case 'operator.cant.be.applied.1':
                $op = preg_match("/operator '([^']+)'/", $first, $m) ? $m[1] : '?';
                $tipos = preg_match('/first type:\s+(.+)\n\s*second type:\s+(.+)/', $msg, $q) ? [trim($q[1]), trim($q[2])] : [];
                $dt = $tipos ? ' (' . $this->corto($tipos[0]) . " $op " . $this->corto($tipos[1]) . ')' : '';
                $extra = '';
                if (in_array($op, ['<', '>', '<=', '>='], true) && $tipos && (str_contains(implode($tipos), 'String') || str_contains(implode($tipos), 'Object'))) {
                    $extra = "\n\nPara ordenar o comparar `String` usa `a.compareTo(b)` (negativo, 0 o positivo).";
                } elseif (in_array($op, ['-', '*', '/', '%'], true) && $tipos && str_contains(implode($tipos), 'String')) {
                    $extra = "\n\nCon `String` solo existe `+` (concatenar). Si el texto contiene un número, conviértelo con `Integer.parseInt(...)`.";
                } elseif (in_array($op, ['&&', '||', '!'], true)) {
                    $extra = "\n\n`$op` necesita valores `boolean`. Compara explícitamente: `x != 0` en vez de `x`.";
                }
                return $r('operand-types', "El operador `$op` no sirve con esos tipos",
                    "El operador `$op` no se puede aplicar a esos dos tipos$dt. Revisa que ambos lados sean del tipo que espera el operador (números para `-`, `*`...; `boolean` para `&&`, `||`).$extra");
            case 'incomparable.types':
                return $r('comparison-types', 'No se pueden comparar esos tipos', "Comparas con `==`/`!=` dos tipos que no tienen nada que ver ($first). Convierte uno de los lados al tipo del otro.");
            case 'cant.ref.non.effectively.final.var':
            case 'local.var.accessed.from.icls.needs.final':
                return $r('effectively-final', 'Una lambda solo puede usar variables que no cambian',
                    "Una lambda (o una clase anónima) **captura una copia** de las variables locales, así que Java exige que sean *final* o *efectivamente finales* (que no se reasignen nunca después de inicializarse). La variable se modifica en alguna parte (`x++`, `x = ...`).\n\nSoluciones: copia el valor a una variable nueva (`final int copia = x;`) y usa la copia, usa un array de un elemento (`int[] cuenta = {0}; cuenta[0]++`) o un `AtomicInteger`, o cambia el bucle para no necesitar la lambda.");
            case 'cant.assign.val.to.var':
            case 'cant.assign.val.to.final.var':
                $v = preg_match('/variable (\S+)/', $first, $m) ? $m[1] : 'la variable';
                return $r('immutable', "`$v` es final: no se puede reasignar", "Declaraste `$v` como `final`, que significa «se asigna una sola vez». Quita `final` si necesitas cambiarla, o usa otra variable.");
            case 'report.access':
                return $r('visibility', 'Acceso no permitido (private)', "Intentas usar algo declarado `private` desde fuera de su clase ($first). Usa un método público (*getter*) o cambia la visibilidad si tiene sentido.");
            case 'array.req.but.found':
                $t = preg_match('/found: (\S+)|but (\S+) found/', $first, $m) ? ($m[1] ?: $m[2] ?? 'otro tipo') : 'otro tipo';
                return $r('index-type', "Los corchetes `[ ]` solo sirven con arrays", "Usas `[i]` sobre algo que no es un array (aquí es `$t`). En un `String` se usa `s.charAt(i)`; en una `List`, `lista.get(i)`; en un `Map`, `mapa.get(clave)`.");
            case 'void.not.allowed':
            case 'illegal.start.of.type.void':
                return $r('return-type', 'Un método `void` no devuelve ningún valor', "Intentas usar como valor (imprimirlo, asignarlo, sumarlo) el resultado de un método declarado `void`, que no devuelve nada. Cambia el método para que devuelva un valor, o llámalo en una línea aparte.");
            case 'not.exhaustive':
            case 'not.exhaustive.statement':
                return $r('match-unhandled', 'El switch no cubre todos los casos', "Un `switch` que devuelve un valor (o sobre un `enum`/`sealed`) debe cubrir **todos** los valores posibles. Añade una rama `default -> ...` o los casos que faltan.");
            case 'duplicate.case.label':
            case 'duplicate.default.label':
                return $r('redeclare', 'Etiqueta de `case` repetida', "El mismo valor aparece en dos `case` del mismo `switch`. Borra uno.");
            case 'call.must.be.first.stmt.in.ctor':
            case 'call.to.super.not.allowed.in.enum.ctor':
                return $r('parse.syntax', '`super(...)`/`this(...)` debe ser la primera sentencia del constructor', "En un constructor, la llamada a `super(...)` o `this(...)` tiene que ser lo primero que se ejecuta.");
            case 'cant.inherit.from.final':
                return $r('immutable', 'No se puede heredar de una clase final', "Esa clase está declarada `final`: no admite subclases ($first).");
            case 'non-static.cant.be.ref.ctor':
                break;
        }
        // genérico: título del código, mensaje original
        return $r('compile.' . $c, $this->tituloGenerico($first), "javac informa de un error de compilación. El mensaje original, en inglés: `$first`. Mira la línea marcada y las anteriores (un fallo de sintaxis arriba puede provocar errores más abajo).");
    }

    private function tituloGenerico(string $first): string
    {
        return $first !== '' ? 'Error de compilación: ' . $first : 'Error de compilación';
    }

    /** @param array<string,mixed> $b */
    private function suffixFix(array $b, string $suf): array
    {
        if ($b['line'] !== $b['endLine']) {
            return [];
        }
        // el rango que da javac solo cubre el primer carácter del literal: se mide el literal entero en la línea
        $l = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        $fin = $b['col'] - 1 + (preg_match('/^[\w.]+/', substr($l, $b['col'] - 1), $mm) ? strlen($mm[0]) : 1);
        return [['title' => "Añadir `$suf`", 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $fin + 1, 'el' => $b['line'], 'ec' => $fin + 1], 'text' => $suf]]]];
    }

    // ── cannot find symbol ──

    /** @param array<string,mixed> $b */
    private function noEncuentra(string $msg, array $b): array
    {
        $kind = preg_match('/symbol:\s+(\w+)\s+([^\n(]+)(\(.*\))?/', $msg, $m) ? $m[1] : 'variable';
        $name = trim($m[2] ?? '');
        $args = $m[3] ?? '';
        $loc = preg_match('/location:\s+(.+)/', $msg, $q) ? trim($q[1]) : '';
        $recvType = null;
        $recvVar = null;
        if (preg_match('/^variable (\S+) of type (\S+)/', $loc, $q)) {
            $recvVar = $q[1];
            $recvType = $this->corto($q[2]);
        } elseif (preg_match('/^(?:class|interface|enum) (\S+)/', $loc, $q)) {
            $recvType = $this->corto($q[1]);
        }
        $enEstaClase = $recvVar === null && $this->jc()->isUserClass((string) $recvType);
        $mk = fn(string $code, string $title, string $explain, array $x = []) => ['code' => $code, 'title' => $title, 'explain' => $explain] + $x + $b;

        if ($kind === 'class') {
            $pkg = self::PAQUETE[$name] ?? null;
            $sug = $this->sugerir($name, array_merge(array_keys(self::PAQUETE), self::LANG, $this->nombresUsuario('class')));
            $x = ['suggestions' => $sug];
            $ex = "javac no encuentra la clase `$name`. Hay tres causas habituales:\n\n1. **Falta el `import`**" . ($pkg ? ": `$name` está en `$pkg` → `import $pkg.$name;` (o `import $pkg.*;`)" : '') . ".\n2. **Está mal escrita** (Java distingue mayúsculas: `String`, no `string`).\n3. No la has definido en tu código.";
            if ($pkg !== null) {
                $x['fixes'] = [$this->importFix($pkg, $name)];
            }
            if ($sug) {
                $ex .= "\n\n¿Querías decir `" . $sug[0] . '`?';
            }
            if (isset(self::AJENOS[$name])) {
                $ex .= "\n\n" . self::AJENOS[$name];
            }
            return $mk('class-not-found', "No se encuentra la clase `$name`", $ex, $x);
        }
        if ($kind === 'method') {
            $grupo = $recvType !== null ? (self::METODOS[$recvType] ?? self::METODOS[self::GRUPO[$recvType] ?? ''] ?? null) : null;
            $pool = $grupo ?? array_merge($enEstaClase || $recvType === null ? $this->nombresUsuario('method') : [], self::METODOS['String'], self::METODOS['List']);
            $sug = $this->sugerir($name, $pool);
            $ex = $recvVar !== null
                ? "El tipo `$recvType` no tiene un método `$name$args`. Revisa el nombre (Java distingue mayúsculas: `toUpperCase`, no `touppercase`) y los argumentos."
                : ($enEstaClase || $recvType === null
                    ? "No hay ningún método `$name$args` en esta clase. Revisa la ortografía, que lo hayas declarado, y que los parámetros coincidan."
                    : "La clase `$recvType` no tiene un método estático `$name$args`. Revisa el nombre.");
            // confusiones típicas entre arrays, listas y textos
            $t = $recvType ?? '';
            if ($name === 'length' && (str_ends_with($t, '[]'))) {
                $ex .= "\n\n**En un array `length` es un campo, sin paréntesis**: `{$recvVar}.length`. (`length()` con paréntesis es de `String`; en listas es `size()`.)";
                $sug = ["$recvVar.length"];
            } elseif ($name === 'size' && (str_ends_with($t, '[]') || $t === 'String')) {
                $ex .= "\n\n" . (str_ends_with($t, '[]') ? "En un array es `$recvVar.length` (campo, sin paréntesis)." : "En un `String` es `$recvVar.length()`. `size()` es de las colecciones.");
            } elseif ($name === 'length' && in_array(self::GRUPO[$t] ?? $t, ['List', 'Map', 'Set', 'Deque'], true)) {
                $ex .= "\n\nLas colecciones usan `size()`: `$recvVar.size()`.";
                $sug = ["$recvVar.size()"];
            } elseif ($name === 'get' && ($t === 'String' || str_ends_with($t, '[]'))) {
                $ex .= "\n\n" . ($t === 'String' ? "Para el carácter de la posición i: `$recvVar.charAt(i)`." : "En un array se accede con corchetes: `$recvVar" . '[i]`.');
            } elseif (in_array($name, ['add', 'push', 'append'], true) && str_ends_with($t, '[]')) {
                $ex .= "\n\nUn array tiene tamaño fijo y no tiene `add`: asigna por posición (`a[i] = x;`) o usa un `ArrayList` si el tamaño cambia.";
            } elseif ($name === 'equal') {
                $sug = ['equals'];
            }
            if (isset(self::AJENOS[$name]) && $recvVar === null) {
                $ex .= "\n\n" . self::AJENOS[$name];
            }
            if ($sug) {
                $ex .= "\n\n¿Querías decir `" . $sug[0] . ($recvVar !== null && !str_contains($sug[0], '.') ? '()' : '') . '`?';
            }
            return $mk('undefined-method', "No se encuentra el método `$name`", $ex, ['suggestions' => $sug] + $this->renameFix($b, $name, $sug));
        }
        // variable / campo
        if ($recvVar !== null) {                                           // x.campo
            $t = $recvType ?? '';
            $ex = "El tipo `$t` no tiene un campo o atributo `$name`.";
            $sug = $this->sugerir($name, self::METODOS[$t] ?? self::METODOS[self::GRUPO[$t] ?? ''] ?? []);
            if ($name === 'length' && $t === 'String') {
                $ex .= "\n\nEn un `String` la longitud es un **método**: `$recvVar.length()` (con paréntesis). Solo los arrays usan `length` sin paréntesis.";
                $sug = ["$recvVar.length()"];
            } elseif ($name === 'length' && in_array(self::GRUPO[$t] ?? $t, ['List', 'Map', 'Set', 'Deque'], true)) {
                $ex .= "\n\nLas colecciones usan el método `size()`.";
                $sug = ["$recvVar.size()"];
            } elseif ($sug) {
                $ex .= "\n\n¿Querías decir `" . $sug[0] . "()`?";
            }
            return $mk('undefined-property', "`$recvType` no tiene `$name`", $ex, ['suggestions' => $sug]);
        }
        if ($recvType !== null && !$enEstaClase) {                         // Clase.constante
            $sug = $this->sugerir($name, self::METODOS[$recvType] ?? []);
            return $mk('undefined-property', "`$recvType` no tiene `$name`", "La clase `$recvType` no tiene un miembro llamado `$name`." . ($sug ? "\n\n¿Querías decir `{$sug[0]}`?" : ''), ['suggestions' => $sug]);
        }
        $disp = $this->nombresVisibles($b['line']);
        $pool = array_merge($disp['visibles'], array_keys(self::PAQUETE), self::LANG);
        $sug = $this->sugerir($name, $pool);
        $ex = "javac no sabe qué es `$name` en este punto. Causas habituales:\n\n- **Está mal escrita** (Java distingue mayúsculas: `Total` y `total` son nombres distintos).\n- **No la declaraste**: falta `int $name = ...;`.\n- **Está fuera de alcance**: una variable declarada dentro de un `{ }` (un `if`, un bucle) solo existe ahí dentro.\n- Es un **texto sin comillas** (`\"$name\"`) o un nombre de clase sin `import`.";
        if (in_array($name, $disp['otros'], true)) {
            $ex .= "\n\n`$name` **sí está declarada en otro bloque de este método**, pero no es visible desde aquí: declárala antes, fuera del bloque.";
        }
        if (isset(self::AJENOS[$name])) {
            $ex .= "\n\n" . self::AJENOS[$name];
        }
        if (ctype_upper($name[0] ?? 'a') && isset(self::PAQUETE[$name])) {
            $ex .= "\n\nFalta `import " . self::PAQUETE[$name] . ".$name;`.";
            return $mk('class-not-found', "No se encuentra `$name`", $ex, ['suggestions' => $sug, 'fixes' => [$this->importFix(self::PAQUETE[$name], $name)]]);
        }
        if ($sug) {
            $ex .= "\n\n¿Querías decir `{$sug[0]}`?";
        }
        return $mk('undefined-variable', "No se encuentra la variable `$name`", $ex, ['suggestions' => $sug] + $this->renameFix($b, $name, $sug));
    }

    /** Arreglo «cambiar por la sugerencia» cuando hay una sola muy parecida. */
    private function renameFix(array $b, string $name, array $sug): array
    {
        if (count($sug) < 1 || $b['line'] !== $b['endLine'] || str_contains($sug[0], '.') || levenshtein(strtolower($name), strtolower($sug[0])) > 2) {
            return [];
        }
        $lineaTxt = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        // la columna marcada puede ser la del receptor (`s.lenght()`): se busca el nombre en la línea
        $pos = null;
        $off = 0;
        while (($p = strpos($lineaTxt, $name, $off)) !== false) {
            if (!preg_match('/[\w$]/', $lineaTxt[$p - 1] ?? ' ') && !preg_match('/[\w$]/', $lineaTxt[$p + strlen($name)] ?? ' ')) {
                $pos = $p;
                if ($p + 1 >= $b['col'] - 1) {
                    break;
                }
            }
            $off = $p + 1;
        }
        if ($pos === null || !preg_match('/^[\x00-\x7f]*$/', substr($lineaTxt, 0, $pos))) {
            return [];
        }
        return ['fixes' => [['title' => "Cambiar por `{$sug[0]}`", 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $pos + 1, 'el' => $b['line'], 'ec' => $pos + 1 + strlen($name)], 'text' => $sug[0]]]]]];
    }

    // ── incompatible types ──

    /** @param array<string,mixed> $b */
    private function incompatibles(string $first, array $b): array
    {
        $mk = fn(string $code, string $title, string $explain, array $x = []) => ['code' => $code, 'title' => $title, 'explain' => $explain] + $x + $b;
        $range = ['sl' => $b['line'], 'sc' => $b['col'], 'el' => $b['endLine'], 'ec' => $b['endCol']];
        $envuelve = function (string $title, string $pre, string $post) use ($b): array {
            if ($b['line'] !== $b['endLine']) {
                return [];
            }
            return [['title' => $title, 'edits' => [
                ['range' => ['sl' => $b['line'], 'sc' => $b['col'], 'el' => $b['line'], 'ec' => $b['col']], 'text' => $pre],
                ['range' => ['sl' => $b['line'], 'sc' => $b['endCol'], 'el' => $b['line'], 'ec' => $b['endCol']], 'text' => $post],
            ]]];
        };
        if (preg_match('/possible lossy conversion from (\w+) to (\w+)/', $first, $m)) {
            [, $de, $a] = $m;
            $x = ['fixes' => $envuelve("Convertir con `($a)`", "($a) (", ')')];
            $extra = '';
            if ($de === 'double' && $a === 'float') {
                $extra = "\n\nPara un literal decimal añade `f`: `float x = 3.14f;`.";
                $txt = $this->textoRango($b);
                $x['fixes'] = $txt !== null && preg_match('/^[\d.]+$/', $txt) ? $this->suffixFix($b, 'f') : $x['fixes'];
            } elseif ($de === 'int' && $a === 'long' || $de === 'long' && $a === 'int') {
                $extra = "\n\n`long` guarda números mucho más grandes que `int`: al convertir se pueden perder cifras (desbordamiento).";
            } elseif ($de === 'double' && in_array($a, ['int', 'long'], true)) {
                $extra = "\n\nSi quieres **redondear** en vez de truncar, usa `Math.round(x)` (devuelve `long`; para `int`: `(int) Math.round(x)`). Si el resultado de `Math.sqrt`/`Math.pow` es exacto, `(int)` basta.";
            }
            return $mk('lossy-conversion', "Pérdida de precisión: de $de a $a",
                "Intentas guardar un `$de` en una variable `$a`, y `$a` es más pequeño: **se perdería información** (los decimales, o las cifras altas). Java no lo hace solo; te obliga a decirlo con una conversión explícita (*cast*): `($a) valor`. El valor se **trunca** (3.9 → 3), no se redondea.$extra", $x);
        }
        if (preg_match('/^incompatible types: (.+) cannot be converted to (.+)$/', $first, $m)) {
            $de = $this->corto($m[1]);
            $a = $this->corto($m[2]);
            $conv = ['int' => 'Integer.parseInt', 'long' => 'Long.parseLong', 'double' => 'Double.parseDouble', 'boolean' => 'Boolean.parseBoolean', 'float' => 'Float.parseFloat'];
            if ($de === 'String' && isset($conv[$a])) {
                return $mk('type-mismatch', "Un String no se convierte solo en $a",
                    "Una cadena de texto (`String`) no es un número, aunque contenga cifras (`\"5\"` ≠ `5`). Para convertirla: `{$conv[$a]}(texto)`. Si el texto no es un número válido lanzará `NumberFormatException` (mira el `try/catch`).\n\nSi el texto viene de `Scanner`, también puedes leer directamente con `sc.nextInt()`.",
                    ['fixes' => $envuelve("Convertir con `{$conv[$a]}()`", "{$conv[$a]}(", ')')]);
            }
            if ($a === 'String' && in_array($de, ['int', 'long', 'double', 'float', 'boolean', 'char', 'Integer', 'Long', 'Double'], true)) {
                return $mk('type-mismatch', "Un $de no se convierte solo en String",
                    "No puedes guardar un `$de` en una variable `String`. Conviértelo: `String.valueOf(x)` (o `Integer.toString(x)`), o concatena con un texto: `\"\" + x`.",
                    ['fixes' => $envuelve('Convertir con `String.valueOf()`', 'String.valueOf(', ')')]);
            }
            if ($a === 'boolean' && in_array($de, ['int', 'long', 'double'], true)) {
                return $mk('type-mismatch', "Se esperaba boolean y hay $de",
                    "Una condición (`if`, `while`) debe ser un `boolean` (`true`/`false`). En Java **un número no vale como condición**. Compara de forma explícita: `x != 0`, `x > 0`. Y cuidado: `if (x = 5)` **asigna**; para comparar es `==`.");
            }
            if ($de === 'boolean' && in_array($a, ['int', 'long', 'double'], true)) {
                return $mk('type-mismatch', "Un boolean no se convierte en $a", "`true`/`false` no son números en Java. Usa un `if`: `int n = cond ? 1 : 0;`.");
            }
            if ($a === 'char' && $de === 'String') {
                return $mk('type-mismatch', 'String no cabe en un char', "Un `char` es **un solo carácter entre comillas simples** (`'a'`); `\"a\"` es un `String`. Para sacar un carácter de un texto: `s.charAt(i)`.");
            }
            if ($a === 'String' && $de === 'char') {
                return $mk('type-mismatch', 'char no cabe en un String', "`'a'` es un `char`, no un `String`. Usa comillas dobles (`\"a\"`) o `String.valueOf(c)`.");
            }
            return $mk('type-mismatch', "Tipos incompatibles: $de no es $a",
                "Java comprueba los tipos al compilar: aquí hay un `$de` donde se espera un `$a`, y no hay conversión automática." . $this->consejoTipos($de, $a));
        }
        if (str_contains($first, 'unexpected return value')) {
            return $mk('return-type', 'Un método void no devuelve nada', "El método está declarado `void` (no devuelve nada) pero tiene un `return valor;`. Cambia `void` por el tipo que devuelves (`int`, `String`...) o quita el valor del `return`.");
        }
        if (str_contains($first, 'missing return value')) {
            return $mk('return-type', 'Falta el valor que se devuelve', "El método declara que devuelve un valor, pero este `return;` no devuelve nada. Escribe `return valor;`.");
        }
        return $mk('type-mismatch', 'Tipos incompatibles', "Java comprueba los tipos al compilar y aquí no encajan. Mensaje original: `$first`.");
    }

    private function consejoTipos(string $de, string $a): string
    {
        if (str_ends_with($de, '[]') && !str_ends_with($a, '[]')) {
            return "\n\nTienes un array donde se espera un solo valor: falta indexarlo (`a[i]`).";
        }
        if (str_starts_with($a, 'List') || str_starts_with($a, 'ArrayList')) {
            return "\n\nUn array (`int[]`) no es una `List`: usa `Arrays.asList(...)` / `List.of(...)`, o construye un `ArrayList` y añade los elementos.";
        }
        if ($a === 'int' && in_array($de, ['Object', 'T'], true)) {
            return "\n\nHaz una conversión explícita `(int) valor` o usa genéricos para que el tipo se conozca.";
        }
        return '';
    }

    // ── cant.apply.symbol ──

    /** @param array<string,mixed> $b */
    private function noEncajan(string $msg, array $b): array
    {
        $first = trim(explode("\n", $msg)[0]);
        $mk = fn(string $code, string $title, string $explain, array $x = []) => ['code' => $code, 'title' => $title, 'explain' => $explain] + $x + $b;
        $nombre = preg_match('/^(?:method|constructor) (\S+?)(?: in (?:class|interface|enum|record) (\S+))? cannot be applied/', $first, $m) ? $m[1] : (preg_match('/found for (\S+?)\(/', $first, $q) ? $q[1] : 'el método');
        $esCtor = str_contains($first, 'constructor');
        if (preg_match('/no suitable (method|constructor) found for (\S+?)\((.*)\)/', $first, $m)) {
            $nombre = $m[2];
            $found = $m[3];
            $cands = preg_match_all('/(?:method|constructor) (\S+) is not applicable/', $msg, $cm) ? $cm[1] : [];
            $lista = $cands ? "\n\nFirmas disponibles:\n" . implode("\n", array_map(static fn($c) => '- `' . $c . '`', array_slice($cands, 0, 6))) : '';
            $tuyos = $found === 'no arguments' ? 'sin argumentos' : "con `($found)`";
            return $mk($esCtor ? 'argument-type' : 'argument-type', "Los argumentos no encajan con `$nombre`",
                "Llamas a `$nombre` $tuyos, pero ninguna de sus versiones acepta esos argumentos (ni en **número** ni en **tipo**). Revisa cuántos parámetros espera y de qué tipo es cada uno.$lista");
        }
        $req = preg_match('/required:\s+(.+)/', $msg, $r) ? trim($r[1]) : '';
        $fnd = preg_match('/found:\s+(.+)/', $msg, $r) ? trim($r[1]) : '';
        $razon = preg_match('/reason:\s+(.+)/', $msg, $r) ? trim($r[1]) : '';
        $cuenta = static fn(string $s): int => in_array($s, ['no arguments', ''], true) ? 0 : substr_count($s, ',') + 1;
        $nr = $cuenta($req);
        $nf = $cuenta($fnd);
        $sig = $req === 'no arguments' ? '()' : "($req)";
        if (str_contains($razon, 'differ in length')) {
            $code = $nf < $nr ? 'too-few-arguments' : 'too-many-arguments';
            return $mk($code, $nf < $nr ? "Faltan argumentos al llamar a `$nombre`" : "Sobran argumentos al llamar a `$nombre`",
                "`$nombre` espera **$nr** argumento" . ($nr === 1 ? '' : 's') . " (`$sig`) y le pasas **$nf** (`" . ($fnd === 'no arguments' ? 'ninguno' : $fnd) . "`). Ajusta la llamada o la declaración del método.");
        }
        $arg = preg_match('/argument mismatch;\s*(.+)/', $razon, $r) ? $r[1] : $razon;
        $x = '';
        if (str_contains($arg, 'lossy')) {
            $x = "\n\nUn `double` no cabe en un `int` sin perder decimales: convierte con `(int)` o cambia el tipo del parámetro.";
        }
        return $mk('argument-type', "El tipo de un argumento no encaja con `$nombre`",
            "`$nombre` espera `$sig` y recibe `($fnd)`. Un argumento es de un tipo que el parámetro no acepta.\n\nDetalle de javac: `$arg`.$x");
    }

    // ═══════════════════════════ ejecución ═══════════════════════════

    /**
     * @param array<string,mixed> $ev
     * @param array<string,mixed> $b
     */
    private function runtime(array $ev, array $b): array
    {
        $cls = (string) ($ev['cls'] ?? '');
        $msg = trim((string) ($ev['msg'] ?? ''));
        $short = str_contains($cls, '.') ? substr($cls, (int) strrpos($cls, '.') + 1) : ($cls !== '' ? $cls : 'Error');
        $mk = fn(string $code, string $title, string $explain, array $x = []) => ['code' => $code, 'title' => $title, 'explain' => $explain] + $x + $b;

        switch ($short) {
            case 'NullPointerException':
                return $this->npe($msg, $mk);
            case 'ArrayIndexOutOfBoundsException':
            case 'StringIndexOutOfBoundsException':
            case 'IndexOutOfBoundsException':
                $lista = $short === 'IndexOutOfBoundsException';
                $tipo = $short[0] === 'A' ? 'array' : ($lista ? 'lista' : 'String');
                $idx = null;
                $len = null;
                if (preg_match('/Index (-?\d+) out of bounds for length (\d+)/', $msg, $m) || preg_match('/index (-?\d+), length (\d+)/', $msg, $m)) {
                    [, $idx, $len] = $m;
                } elseif (preg_match('/begin (-?\d+), end (-?\d+), length (\d+)/', $msg, $m) || preg_match('/Range \[(-?\d+), (-?\d+)\) out of bounds for length (\d+)/', $msg, $m)) {
                    return $mk('index-out-of-range', 'Rango de substring fuera del texto',
                        "Pediste `substring({$m[1]}, {$m[2]})` en un texto de **{$m[3]}** caracteres. Debe cumplirse `0 <= inicio <= fin <= length()` (el `fin` es exclusivo).",
                        ['hint' => 'Comprueba `s.length()` antes de cortar, o usa `Math.min(fin, s.length())`.']);
                } elseif (preg_match('/String index out of range: (-?\d+)/', $msg, $m)) {
                    $idx = $m[1];
                }
                $de = $tipo === 'array' ? 'array' : ($tipo === 'lista' ? 'lista' : 'texto');
                $ex = $idx !== null
                    ? "Usaste la posición **$idx** en un $de que" . ($len !== null ? " tiene **$len** elemento" . ((int) $len === 1 ? '' : 's') . ($tipo === 'String' ? ' (caracteres)' : '') . ", así que las posiciones válidas son **0 a " . ((int) $len - 1) . '**.' : ' es más corto.')
                    : 'Usaste una posición que no existe.';
                if ($idx !== null && $len !== null) {
                    $ex .= (int) $idx === (int) $len ? "\n\nEs el clásico **error por uno**: la última posición válida es `length - 1`. Revisa si en el bucle usas `i <= " . ($tipo === 'array' ? 'a.length' : 'n') . '` en vez de `i < …`.'
                        : ((int) $idx < 0 ? "\n\nLas posiciones negativas no existen en Java (a diferencia de Python). Para «el último» usa `length - 1` o `size() - 1`." : '');
                    if ($tipo === 'lista' && (int) $len === 0) {
                        $ex .= "\n\nLa lista está **vacía**: comprueba `if (!lista.isEmpty())` antes de leer.";
                    }
                }
                return $mk('index-out-of-range', "Posición fuera de rango" . ($idx !== null ? " ($idx)" : ''), $ex,
                    ['hint' => $tipo === 'array' ? 'Usa `for (int i = 0; i < a.length; i++)` o un for-each para no salirte.' : 'Comprueba el tamaño antes de acceder.']);
            case 'ArithmeticException':
                if (str_contains($msg, 'by zero')) {
                    return $mk('division-by-zero', 'División por cero',
                        "Dividiste un número **entero** entre 0 (`/` o `%`), y con enteros eso lanza `ArithmeticException`. (Con `double`, en cambio, da `Infinity` o `NaN`, sin error.)\n\nComprueba el divisor antes: `if (b != 0) { ... }`, o decide qué hacer cuando es 0 (devolver 0, lanzar tu propia excepción con un mensaje claro...).",
                        ['hint' => 'El valor 0 puede venir de una lista vacía (`sumas / lista.size()`).']);
                }
                if (str_contains($msg, 'overflow')) {
                    return $mk('overflow', 'Desbordamiento aritmético (overflow)',
                        "Una operación con `Math.addExact`/`multiplyExact`/`toIntExact`... se salió del rango del tipo (`int`: ±2 147 483 647). Sin la versión «Exact», Java **da la vuelta en silencio** (el resultado sale negativo). Usa `long` (±9·10¹⁸) o `BigInteger` para números muy grandes.");
                }
                return $mk('generic', 'ArithmeticException' . ($msg !== '' ? ": $msg" : ''), 'Una operación aritmética no es válida. ' . ($msg !== '' ? "Mensaje: `$msg`." : ''));
            case 'ClassCastException':
                $de = preg_match('/class (\S+) cannot be cast to class (\S+)/', $msg, $m) ? [$this->corto($m[1]), $this->corto($m[2])] : ['un objeto', 'otro tipo'];
                return $mk('class-cast', "No se puede convertir $de[0] en $de[1]",
                    "Intentas tratar un objeto de tipo **{$de[0]}** como si fuera **{$de[1]}** (una conversión `(Tipo) objeto` o un genérico sin tipo). Esos tipos no son compatibles, así que falla al ejecutar.\n\nComprueba antes con `if (obj instanceof {$de[1]} x) { ... }`, y declara las colecciones con su tipo (`List<Integer>`) para que el compilador lo vigile por ti.");
            case 'NumberFormatException':
                $texto = preg_match('/For input string: "(.*)"/s', $msg, $m) ? $m[1] : null;
                $ex = $texto !== null
                    ? ($texto === '' ? "Intentas convertir un texto **vacío** en número." : "Intentas convertir el texto `\"$texto\"` en número y **no tiene formato numérico**.") . " `Integer.parseInt` solo acepta cifras con un `-` o `+` opcional delante: sin espacios, sin decimales (`\"3.5\"` no vale para `int`), sin separadores de miles."
                    : ($msg === 'null' || str_contains($msg, 'Cannot parse null') ? 'Pasaste `null` a `parseInt`/`parseDouble`: la variable no tiene texto.' : "El texto no tiene formato numérico: `$msg`.");
                return $mk('invalid-number', 'El texto no es un número válido', $ex . "\n\nPuedes limpiar con `texto.trim()`, probar con `try { ... } catch (NumberFormatException e) { ... }` o, si viene de `Scanner`, preguntar antes con `sc.hasNextInt()`.");
            case 'ConcurrentModificationException':
                return $mk('mutate-iter', 'Modificaste la colección mientras la recorrías',
                    "Dentro de un `for (x : lista)` (o de un `forEach`) llamaste a `lista.add(...)` o `lista.remove(...)`. El recorrido detecta que la colección cambió «por debajo» y lanza esta excepción.\n\nSoluciones:\n- `lista.removeIf(x -> condición);` para borrar elementos.\n- Un `Iterator` y `it.remove()`.\n- Recorrer una **copia** (`new ArrayList<>(lista)`) o recorrer con un índice hacia atrás.\n- Guardar lo que quieres añadir/quitar en otra lista y aplicarlo después.");
            case 'UnsupportedOperationException':
                return $mk('immutable', 'Esa colección no se puede modificar',
                    "Llamaste a `add`, `remove`, `set`... sobre una colección **inmutable** o de tamaño fijo. Las crean `List.of(...)`, `Set.of(...)`, `Map.of(...)`, `stream.toList()`, `Collections.unmodifiableList(...)`, y `Arrays.asList(...)` (que permite `set` pero no `add`/`remove`).\n\nPara poder cambiarla, haz una copia mutable: `List<Integer> l = new ArrayList<>(List.of(1, 2, 3));`.");
            case 'NoSuchElementException':
                if (str_contains($msg, 'No value present')) {
                    return $mk('empty-sequence', 'El Optional está vacío',
                        "Llamaste a `get()` (u `orElseThrow()`) sobre un `Optional` sin valor. Comprueba antes con `isPresent()`, o usa `orElse(valorPorDefecto)`, `ifPresent(...)` o `map(...)`.");
                }
                if (str_contains($msg, 'No line found') || str_contains($msg, 'No such element') && $msg === 'No line found') {
                    return $mk('no-such-element', 'No hay más líneas que leer', "`nextLine()` no encontró otra línea en la entrada. Comprueba antes con `sc.hasNextLine()`, o rellena el cuadro «Entrada» del playground con una línea por cada lectura.");
                }
                return $mk('no-such-element', 'No hay más elementos', "Pediste el siguiente elemento (`next()`, `getFirst()`, `pop()`, `element()`, `Collections.max`...) de algo **que está vacío o ya se terminó**. Comprueba antes con `hasNext()`, `isEmpty()` o `hasNextInt()`/`hasNextLine()` si lees con `Scanner`.");
            case 'InputMismatchException':
                return $mk('input-mismatch', 'La entrada no tiene el tipo esperado',
                    "El `Scanner` esperaba un número (`nextInt()`, `nextDouble()`) y encontró otra cosa" . ($msg !== '' ? " (`$msg`)" : '') . ". Mira el cuadro «Entrada»: debe haber un número en cada lectura, separados por espacios o saltos de línea; los decimales llevan la coma o el punto según la configuración regional.\n\nComprueba antes con `sc.hasNextInt()`, o lee todo como texto con `nextLine()` y conviértelo tú.");
            case 'IllegalArgumentException':
                return $mk('argument-value', 'Argumento no válido' . ($msg !== '' ? ": $msg" : ''),
                    "Se llamó a un método con un valor que no acepta" . ($msg !== '' ? ": «{$msg}»" : '') . ". " . $this->consejoArgumento($msg));
            case 'IllegalStateException':
                return $mk('illegal-state', 'Operación no permitida en este momento' . ($msg !== '' ? ": $msg" : ''),
                    "El objeto no está en un estado que permita esta operación" . ($msg !== '' ? ": «{$msg}»" : '') . ". Típicos: usar un `Scanner` o `Stream` ya cerrado/consumido, llamar a `iterator.remove()` sin `next()` antes, o `Queue.add` en una cola llena.");
            case 'NegativeArraySizeException':
                return $mk('argument-value', "Tamaño de array negativo ($msg)", "`new int[n]` con `n` negativo. Comprueba el valor de `n` antes de crear el array.");
            case 'EmptyStackException':
                return $mk('empty-sequence', 'La pila está vacía', "Hiciste `pop()` o `peek()` sobre una `Stack` sin elementos. Comprueba `!pila.isEmpty()` antes.");
            case 'ArrayStoreException':
                return $mk('class-cast', 'Tipo incorrecto al guardar en el array', "Intentas guardar un `$msg` en un array de otro tipo. El array «recuerda» su tipo real al ejecutar.");
            case 'AssertionError':
                return $mk('assertion', 'Falló una aserción' . ($msg !== '' ? ": $msg" : ''), "Un `assert` (o una prueba) no se cumplió. Revisa el valor que esperabas y el que hay.");
            case 'FileNotFoundException':
            case 'NoSuchFileException':
                return $mk('file-not-found', 'No se encuentra el archivo', "Java no encontró el archivo `$msg`. En el playground los archivos relativos se buscan en la carpeta de trabajo del programa; comprueba el nombre y la ruta.");
            case 'StackOverflowError':
                return $mk('stack-overflow', 'Desbordamiento de pila (¿recursión sin caso base?)', "Demasiadas llamadas anidadas: revisa el caso base de la recursión.");
            case 'OutOfMemoryError':
                return $mk('out-of-memory', 'Memoria agotada (el límite es 256 MB)', "El programa pidió más memoria de la permitida.");
        }
        return $mk('generic', $short . ($msg !== '' ? ': ' . $msg : ''),
            "El programa lanzó una excepción **`$short`**" . ($msg !== '' ? ": «{$msg}»" : '') . " y no la capturó, así que terminó. La traza de abajo dice en qué método y línea ocurrió: empieza por la primera línea de **tu** código.\n\nSi esperas que pueda ocurrir, captúrala: `try { ... } catch ($short e) { ... }`.");
    }

    private function consejoArgumento(string $msg): string
    {
        if (str_contains($msg, 'bound must be positive')) {
            return 'Es `Random.nextInt(n)`: `n` debe ser mayor que 0 (¿lista vacía?).';
        }
        if (str_contains($msg, 'Comparison method violates')) {
            return 'Tu `Comparator` no es coherente (por ejemplo devuelve siempre 1, o resta enteros que pueden desbordarse). Usa `Integer.compare(a, b)`.';
        }
        if (str_contains($msg, 'Illegal Capacity') || str_contains($msg, 'capacity')) {
            return 'La capacidad inicial no puede ser negativa.';
        }
        return 'Mira en la traza qué método lo lanzó y qué valor le pasaste.';
    }

    /** @param \Closure $mk @return array<string,mixed> */
    private function npe(string $msg, \Closure $mk): array
    {
        $porque = null;
        if (preg_match('/because (?:the return value of )?"([^"]+)" is null/', $msg, $m)) {
            $porque = $m[1];
        }
        $esRet = str_contains($msg, 'the return value of');
        $quien = $porque !== null ? ($esRet ? "el resultado de `$porque`" : '`' . preg_replace('/^<local\d+>$/', 'una variable local', $porque) . '`') : 'una referencia';
        if ($porque !== null && preg_match('/^<local\d+>$/', $porque)) {
            $quien = 'una variable local';
        }
        $acc = '';
        $hint = 'Comprueba `if (x != null)` antes de usarla, o inicialízala (`String s = "";`).';
        if (preg_match('/Cannot invoke "([^"]+)"/', $msg, $m)) {
            $met = preg_replace('/^.*\.([^.(]+\()/', '$1', $m[1]);
            $unbox = preg_match('/(Integer|Long|Double|Boolean|Character)\.\w+Value\(\)/', $m[1], $u);
            $acc = $unbox ? "Se intentó **desempaquetar** (`{$u[0]}`) un `{$u[1]}` que vale `null` hacia un tipo primitivo (autounboxing)." : "Se intentó llamar al método `$met` sobre ese valor.";
            $code = 'member-on-null';
        } elseif (preg_match('/Cannot read field "([^"]+)"/', $msg, $m)) {
            $acc = "Se intentó leer el campo `{$m[1]}` de ese objeto.";
            $code = 'property-on-null';
        } elseif (preg_match('/Cannot assign field "([^"]+)"/', $msg, $m)) {
            $acc = "Se intentó asignar el campo `{$m[1]}` de ese objeto.";
            $code = 'property-on-null';
        } elseif (str_contains($msg, 'array length')) {
            $acc = 'Se intentó leer `.length` de un **array que es null** (nunca se creó con `new`).';
            $hint = 'Crea el array antes: `int[] a = new int[n];`.';
            $code = 'member-on-null';
        } elseif (preg_match('/Cannot (load from|store to) (\w+) array/', $msg, $m)) {
            $acc = "Se intentó " . ($m[1] === 'load from' ? 'leer' : 'escribir') . " un elemento de un **array `{$m[2]}[]` que es null** (declarado pero sin `new`).";
            $hint = 'Crea el array antes: `int[] a = new int[n];`. En un array de arrays, crea también cada fila.';
            $code = 'member-on-null';
        } elseif (str_contains($msg, 'synchronized')) {
            $acc = 'Se intentó sincronizar sobre `null`.';
            $code = 'member-on-null';
        } else {
            $acc = $msg !== '' ? "Detalle: `$msg`." : 'Se usó una referencia nula.';
            $code = 'member-on-null';
        }
        $titulo = 'NullPointerException: ' . ($porque !== null && !preg_match('/^<local\d+>$/', $porque) ? ($esRet ? "el resultado de `$porque` es null" : "`$porque` es null") : 'se usó un valor null');
        $causas = "\n\nCausas típicas:\n- Declaraste la variable pero **nunca le diste valor** (`String s;` o `= null`).\n- Un método devolvió `null` (`map.get(clave)` si la clave no existe; `Optional` mal usado).\n- Un campo del objeto no se inicializó en el constructor.\n- Un array de objetos se crea con `null` en cada posición (`new String[3]` → `[null, null, null]`).";
        return $mk($code, $titulo, "En Java, una variable de tipo objeto puede valer `null` («no apunta a nada»), y entonces cualquier acceso con `.` falla con `NullPointerException`. Aquí $quien vale `null`. $acc$causas", ['hint' => $hint]);
    }

    // ═══════════════════════════ utilidades ═══════════════════════════

    /** java.lang.String → String, java.util.List<java.lang.Integer> → List<Integer> */
    private function corto(string $t): string
    {
        return (string) preg_replace('/\b(?:[a-z_][a-z0-9_]*\.)+(?=[A-Z])/', '', $t);
    }

    /** Hasta 3 nombres parecidos (Levenshtein, o solo mayúsculas distintas). */
    private function sugerir(string $name, array $pool): array
    {
        $out = [];
        $ln = strtolower($name);
        $max = strlen($name) <= 3 ? 1 : (strlen($name) <= 6 ? 2 : 3);
        foreach (array_unique($pool) as $cand) {
            if ($cand === $name) {
                continue;
            }
            $lc = strtolower((string) $cand);
            $d = $lc === $ln ? 0 : levenshtein($ln, $lc);
            if ($d <= $max) {
                $out[(string) $cand] = $d;
            }
        }
        asort($out);
        return array_slice(array_keys($out), 0, 3);
    }

    /** Nombres declarados en el código: 'class' | 'method' */
    private function nombresUsuario(string $que): array
    {
        $jc = $this->jc();
        if ($que === 'class') {
            return array_column($jc->classes, 'name');
        }
        return array_values(array_unique(array_column($jc->units, 'name')));
    }

    /** Variables visibles en el método de la línea, y las que solo existen en otros bloques de él. */
    private function nombresVisibles(int $line): array
    {
        $jc = $this->jc();
        $u = $this->unitAt($line);
        $vis = [];
        $otros = [];
        foreach ($jc->classes as $c) {
            $vis = array_merge($vis, array_keys($c['fields']));
        }
        if ($u !== null) {
            $loc = $jc->locals($u);
            foreach ($loc['decls'] as $d) {
                $otros[] = $d['name'];
            }
            $vis = array_merge($vis, array_keys($loc['types']), array_column($jc->units, 'name'));
        }
        return ['visibles' => array_values(array_unique($vis)), 'otros' => $otros];
    }

    /** @return ?array<string,mixed> el método que contiene la línea */
    private function unitAt(int $line): ?array
    {
        $jc = $this->jc();
        foreach ($jc->units as $u) {
            if ($jc->t[$u['first']][3] <= $line && $jc->t[$u['close']][3] >= $line) {
                return $u;
            }
        }
        return null;
    }

    private function unitNamed(string $name): ?array
    {
        foreach ($this->jc()->units as $u) {
            if ($u['name'] === $name) {
                return $u;
            }
        }
        return null;
    }

    private function hasLambdaBetween(array $u, int $line, int $col): bool
    {
        $jc = $this->jc();
        for ($i = $u['open']; $i < $u['close']; $i++) {
            $t = $jc->t[$i];
            if ($t[3] > $line || ($t[3] === $line && $jc->col($t[2], $t[3]) > $col)) {
                break;
            }
            if ($t[1] === '->') {
                return true;
            }
        }
        return false;
    }

    /** Inserta ` throws X` justo antes de la `{` del método. */
    private function throwsEdit(array $u, string $ex): array
    {
        $jc = $this->jc();
        $t = $jc->t[$u['open']];
        $c = $jc->col($t[2], $t[3]);
        return ['range' => ['sl' => $t[3], 'sc' => $c, 'el' => $t[3], 'ec' => $c], 'text' => "throws $ex "];
    }

    /** @return array{title:string, edits:list<array<string,mixed>>} */
    private function importFix(string $pkg, string $cls): array
    {
        $ultima = 0;
        foreach (explode("\n", $this->code) as $i => $l) {
            if (preg_match('/^\s*(import|package)\s/', $l)) {
                $ultima = $i + 1;
            }
        }
        $ln = $ultima + 1;
        return ['title' => "Añadir `import $pkg.$cls;`", 'edits' => [['range' => ['sl' => $ln, 'sc' => 1, 'el' => $ln, 'ec' => 1], 'text' => "import $pkg.$cls;\n"]]];
    }

    /** Texto de un rango de una sola línea (solo ASCII), o null. */
    private function textoRango(array $b): ?string
    {
        if ($b['line'] !== $b['endLine']) {
            return null;
        }
        $l = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        return preg_match('/^[\x00-\x7f]*$/', $l) ? substr($l, $b['col'] - 1, $b['endCol'] - $b['col']) : null;
    }
}
