<?php
declare(strict_types=1);

namespace Playground\Lang\Php;

use Playground\Lang\Php\Analysis\Hints;
use Playground\Lang\Php\Analysis\Parser;
use Playground\Lang\Php\Analysis\Source;

defined('PG_ROOT') or exit;

/**
 * Convierte un error de PHP (de sintaxis o de ejecución) en un diagnóstico explicado en español:
 * qué significa, por qué suele pasar, qué probar y, cuando se puede, un arreglo automático.
 *
 * Entrada (evento):
 *   {kind:'parse'|'warning'|'notice'|'deprecated'|'exception'|'fatal'|'timeout'|'memory',
 *    msg:string, line:int, cls?:string, trace?:list<{fn,cls,line}>, candidates?:list<string>}
 *
 * Salida (diagnóstico):
 *   {source, severity, code, line, col, endLine, endCol, title, message, explain, hint?,
 *    suggestions?:list<string>, fixes?:list<Fix>, trace?:list}
 */
final class Explainer implements \Playground\Core\Explains
{
    /** Nombre Java -> función PHP equivalente (se usa para "¿quisiste decir…?"). */
    private const JAVA_FN = [
        'length' => 'strlen', 'size' => 'count', 'println' => 'echo', 'print' => 'echo',
        'toUpperCase' => 'strtoupper', 'toLowerCase' => 'strtolower', 'substring' => 'substr',
        'indexOf' => 'strpos', 'contains' => 'str_contains', 'split' => 'explode', 'join' => 'implode',
        'parseInt' => 'intval', 'parseDouble' => 'floatval', 'valueOf' => 'strval', 'startsWith' => 'str_starts_with',
        'endsWith' => 'str_ends_with', 'replace' => 'str_replace', 'push' => 'array_push', 'pop' => 'array_pop',
        'reverse' => 'array_reverse', 'isEmpty' => 'empty', 'sqrt' => 'sqrt', 'toString' => 'strval',
        'equals' => '===', 'charAt' => '$s[$i]', 'add' => '$a[] =', 'put' => '$mapa[$k] =',
        'forEach' => 'foreach', 'stream' => 'array_map', 'sort' => 'sort', 'sum' => 'array_sum',
    ];

    private const SEVERITY = [
        'parse' => 'error', 'exception' => 'error', 'fatal' => 'error', 'timeout' => 'error', 'memory' => 'error',
        'warning' => 'warning', 'notice' => 'info', 'deprecated' => 'info',
    ];

    public function __construct(private readonly Source $src, private readonly Parser $parser)
    {
    }

    /** @param array<string,mixed> $ev */
    public function explain(array $ev): array
    {
        $kind = (string) ($ev['kind'] ?? 'fatal');
        $msg = trim((string) ($ev['msg'] ?? ''));
        $line = max(1, (int) ($ev['line'] ?? 1));
        $cls = (string) ($ev['cls'] ?? '');

        $r = match ($kind) {
            'parse' => $this->parseError($msg, $line),
            'timeout' => $this->timeout($line, (int) ($ev['limit'] ?? 5)),
            'memory' => $this->memory($msg, $line),
            default => $this->runtimeError($kind, $cls, $msg, $line, $ev),
        };

        $line = (int) ($r['line'] ?? $line);
        $range = $r['range'] ?? $this->codeRange($line);
        $title = (string) ($r['title'] ?? ($cls !== '' ? $cls : 'Error'));

        $diag = [
            'source' => $kind === 'parse' ? 'syntax' : 'runtime',
            'severity' => self::SEVERITY[$kind] ?? 'error',
            'code' => (string) ($r['code'] ?? ($kind . ($cls !== '' ? '.' . strtolower($cls) : ''))),
            'line' => $range['sl'], 'col' => $range['sc'], 'endLine' => $range['el'], 'endCol' => $range['ec'],
            'title' => $title,
            'message' => $title,
            'explain' => (string) ($r['explain'] ?? ''),
            'original' => ($cls !== '' && $kind === 'exception' ? $cls . ': ' : '') . $msg,
        ];
        foreach (['hint', 'suggestions', 'fixes'] as $k) {
            if (!empty($r[$k])) {
                $diag[$k] = $r[$k];
            }
        }
        if (!empty($ev['trace'])) {
            $diag['trace'] = $ev['trace'];
        }
        return $diag;
    }

    // ───────────────────────────── errores de sintaxis ─────────────────────────────

    private function parseError(string $msg, int $line): array
    {
        $src = $this->src;
        $msg = (string) preg_replace('/^(PHP )?Parse error:\s*/i', '', $msg);

        // Llaves/paréntesis sin cerrar: PHP 8 lo dice explícitamente
        if (preg_match("/Unclosed '(.)' on line (\d+)/", $msg, $m) || preg_match("/Unmatched '(.)'/", $msg, $m)) {
            $isUnmatched = str_starts_with($msg, 'Unmatched');
            return $this->unclosed($m[1], $isUnmatched, $line, $msg);
        }

        // Comillas dobles abiertas: PHP espera el resto de la cadena (`${` o `{$` indican interpolación)
        if (str_contains($msg, '"${"') || str_contains($msg, '"{$"')) {
            return [
                'code' => 'parse.string', 'title' => 'Comillas sin cerrar',
                'explain' => 'Hay una cadena entre comillas dobles que empieza pero nunca termina, así que PHP sigue leyendo hasta el final del archivo. Comprueba que cada `"` tiene su pareja y que las comillas del interior están escapadas con `\\"`.',
                'line' => $line,
            ];
        }

        // Fin de archivo inesperado: casi siempre falta cerrar algo
        if (preg_match('/unexpected end of file/', $msg)) {
            $open = null;
            foreach (array_reverse($this->parser->unbalanced) as [$kind, $tok]) {
                if (in_array($kind, ['{', '(', '['], true)) {
                    $open = [$kind, $tok];
                    break;
                }
            }
            if ($open !== null) {
                return $this->unclosed($open[0], false, $line, $msg, $open[1]);
            }
            return [
                'code' => 'parse.eof', 'title' => 'El archivo termina antes de tiempo',
                'explain' => 'PHP llegó al final del archivo en mitad de una instrucción. Suele faltar un `;`, un `}` o un `)` al final.',
                'line' => $line,
            ];
        }

        // Falta `;`  ("expecting ';'" / `expecting "," or ";"`)
        $unexpected = $this->unexpectedToken($msg);
        $expectsSemi = str_contains($msg, '";"') || str_contains($msg, '","') || str_contains($msg, "';'");
        if ($unexpected !== null) {
            $startsStatement = in_array($unexpected, [
                'echo', 'return', 'if', 'foreach', 'for', 'while', 'function', 'class', 'throw', 'print', 'unset', 'global',
                'static', 'try', 'switch', 'do', 'break', 'continue', 'const', 'use', 'namespace', 'abstract', 'final',
                'interface', 'trait', 'enum', 'new',
            ], true);
            $valueLike = (bool) preg_match('/unexpected (identifier|variable|integer|double|fully qualified name|name)\b/', $msg);
            if ($expectsSemi || $startsStatement || $valueLike) {
                // Sin "expecting ;" solo se propone si lo anterior termina en la línea de arriba (el caso típico)
                $semi = $this->missingSemicolon($line, $unexpected, !$expectsSemi);
                if ($semi !== null) {
                    return $semi;
                }
            }
        }

        // Identificador inesperado justo después de un tipo: Java
        if (preg_match('/unexpected (?:identifier|token) "?(\w+)"?/', $msg, $m)) {
            $tok = $this->tokenOnLine($line, $m[1]);
            if ($tok !== null) {
                $p = $src->prev($tok);
                if ($p !== null && $src->tokens[$p]->id === T_STRING && $src->tokens[$tok]->id === T_STRING) {
                    return [
                        'code' => 'parse.java-decl', 'title' => 'Aquí falta el `$` de la variable (¿código estilo Java?)',
                        'explain' => sprintf('PHP encontró `%s %s` seguido de otro nombre. En PHP las variables **siempre** llevan `$` y no se les pone el tipo delante: `$%s = ...;`. El tipo solo va en parámetros, retornos y propiedades.', $src->tokens[$p]->text, $src->tokens[$tok]->text, $src->tokens[$tok]->text),
                        'range' => $src->range($p, $tok), 'line' => $line,
                        'fixes' => [[
                            'title' => sprintf('Cambiar por $%s', $src->tokens[$tok]->text),
                            'edits' => [['range' => $src->range($p, $tok), 'text' => '$' . $src->tokens[$tok]->text]],
                        ]],
                    ];
                }
            }
        }

        // Cadena sin cerrar
        if (str_contains($msg, 'double-quote mark') || str_contains($msg, 'unterminated') || str_contains($msg, 'string content')) {
            return [
                'code' => 'parse.string', 'title' => 'Comillas sin cerrar o mal escapadas',
                'explain' => 'Hay una cadena que empieza pero no termina donde PHP esperaba. Comprueba que cada `"` o `\'` tiene su pareja y que si dentro del texto aparece la misma comilla está escapada con `\\`. Dentro de comillas dobles, `{$var[\'clave\']}` necesita llaves.',
                'line' => $line,
            ];
        }

        // `}` o `)` inesperado
        if (preg_match('/unexpected token "([)}\]])"/', $msg, $m)) {
            return [
                'code' => 'parse.closing', 'title' => sprintf('`%s` que no corresponde', $m[1]),
                'explain' => sprintf('PHP no esperaba encontrar `%s` aquí: o sobra, o falta algo justo antes (un argumento, una expresión, un `;`). Revisa la línea anterior y que cada `(`, `{` y `[` tenga su cierre.', $m[1]),
                'line' => $line,
            ];
        }

        // `else` / `elseif` / `catch` huérfanos
        if (preg_match('/unexpected token "(else|elseif|catch|finally|case|default)"/', $msg, $m)) {
            return [
                'code' => 'parse.orphan', 'title' => sprintf('`%s` sin su estructura', $m[1]),
                'explain' => sprintf('`%s` solo puede ir justo después del bloque `if`/`try`/`switch` al que pertenece. Suele ser un `;` de más antes de él, o una llave `}` de menos o de más.', $m[1]),
                'line' => $line,
            ];
        }

        // Hay un ( o [ sin cerrar: casi seguro que es la causa
        foreach (array_reverse($this->parser->unbalanced) as [$kind, $tok]) {
            if ($kind === '(' || $kind === '[') {
                return $this->unclosed($kind, false, $line, $msg, $tok);
            }
        }

        // Genérico traducido
        return [
            'code' => 'parse.syntax', 'title' => 'Error de sintaxis',
            'explain' => $this->translateSyntax($msg) . ' Mira la línea marcada y la anterior: lo más habitual es que falte un `;`, un `)`, un `}` o una coma.',
            'line' => $line,
        ];
    }

    /** @return array<string,mixed> */
    private function unclosed(string $char, bool $unmatched, int $line, string $msg, ?int $tok = null): array
    {
        $src = $this->src;
        $closer = ['{' => '}', '(' => ')', '[' => ']'][$char] ?? $char;
        $names = ['{' => 'llave', '(' => 'paréntesis', '[' => 'corchete', '}' => 'llave', ')' => 'paréntesis', ']' => 'corchete'];
        $name = $names[$char] ?? 'símbolo';

        if ($unmatched) {
            return [
                'code' => 'parse.unmatched', 'title' => sprintf('Sobra un `%s`', $char),
                'explain' => sprintf('Hay un `%s` de cierre al que no le corresponde ninguna apertura. Revisa que cada `{` tenga exactamente un `}` (el editor resalta la pareja al poner el cursor sobre una llave).', $char),
                'line' => $line,
            ];
        }

        if ($tok === null) {
            foreach (array_reverse($this->parser->unbalanced) as [$k, $t]) {
                if ($k === $char) {
                    $tok = $t;
                    break;
                }
            }
        }
        $fixes = [];
        $r = ['code' => 'parse.unclosed', 'line' => $line];
        if ($tok !== null) {
            $r['range'] = $src->range($tok);
            $r['line'] = $src->tokens[$tok]->line;
            $last = $src->count() - 1;
            $lastSig = $last;
            while ($lastSig > 0 && !Source::isSignificant($src->tokens[$lastSig])) {
                $lastSig--;
            }
            $fixes[] = [
                'title' => sprintf('Cerrar con `%s` al final del archivo', $closer),
                'edits' => [['range' => $src->after($lastSig), 'text' => "\n" . $closer]],
            ];
        }
        $r['title'] = sprintf('Un %s `%s` no se cierra', $name, $char);
        $r['explain'] = sprintf('El `%s` de la línea %d se abre pero nunca se cierra con `%s`. PHP lo detecta al llegar al final del archivo, por eso el error aparece tan lejos. Suele faltar el cierre del bloque (`if`, `for`, función o clase) que empieza ahí, o hay una llave de menos en medio.', $char, $r['line'], $closer);
        if ($fixes) {
            $r['fixes'] = $fixes;
        }
        return $r;
    }

    /** Texto del token inesperado que menciona PHP (sin comillas). */
    private function unexpectedToken(string $msg): ?string
    {
        if (preg_match('/unexpected (?:token|identifier|variable|integer|double|string content|fully qualified name) "([^"]+)"/', $msg, $m)) {
            return $m[1];
        }
        return null;
    }

    private function missingSemicolon(int $line, string $unexpected, bool $requireEarlierLine = false): ?array
    {
        $src = $this->src;
        $tok = $this->tokenOnLine($line, $unexpected) ?? $src->firstTokenOnLine($line);
        if ($tok === null) {
            return null;
        }
        $p = $src->prev($tok);
        if ($p === null) {
            return null;
        }
        $pt = $src->tokens[$p];
        if ($requireEarlierLine && $pt->line >= $src->tokens[$tok]->line) {
            return null;
        }
        $endsExpression = in_array($pt->id, [T_VARIABLE, T_LNUMBER, T_DNUMBER, T_CONSTANT_ENCAPSED_STRING, T_STRING, T_NAME_QUALIFIED, T_INC, T_DEC], true)
            || in_array($pt->text, [')', ']', '"', "'"], true);
        if (!$endsExpression) {
            return null;
        }
        $where = $pt->line === $line ? 'antes de' : 'al final de la línea anterior a';
        return [
            'code' => 'parse.semicolon',
            'title' => sprintf('Falta un `;` en la línea %d', $pt->line),
            'explain' => sprintf('Cada instrucción de PHP termina en `;`. PHP lo echó en falta %s `%s` y por eso se queja ahí, no donde realmente falta. (En Java pasa lo mismo, pero el compilador suele señalar la línea correcta.)', $where, $unexpected),
            'range' => $src->range($p),
            'line' => $pt->line,
            'fixes' => [[
                'title' => sprintf('Añadir `;` en la línea %d', $pt->line),
                'edits' => [['range' => $src->after($p), 'text' => ';']],
            ]],
        ];
    }

    private function translateSyntax(string $msg): string
    {
        $t = (string) preg_replace('/^syntax error,\s*/', '', $msg);
        $replacements = [
            '/unexpected end of file/' => 'el archivo terminó',
            '/unexpected token "([^"]+)"/' => 'encontró `$1`',
            '/unexpected identifier "([^"]+)"/' => 'encontró el nombre `$1`',
            '/unexpected variable "([^"]+)"/' => 'encontró la variable `$1`',
            '/unexpected integer "([^"]+)"/' => 'encontró el número `$1`',
            '/unexpected double-quote mark/' => 'encontró unas comillas',
            '/unexpected string content "([^"]*)"/' => 'encontró el texto `$1`',
            '/unexpected/' => 'encontró algo inesperado',
            '/expecting "([^"]+)" or "([^"]+)"/' => 'esperaba `$1` o `$2`',
            '/expecting "([^"]+)"/' => 'esperaba `$1`',
            '/expecting (variable|identifier|expression)/' => 'esperaba una $1',
        ];
        $t = (string) preg_replace(array_keys($replacements), array_values($replacements), $t);
        return 'PHP ' . $t . '.';
    }

    // ───────────────────────────── errores de ejecución ─────────────────────────────

    /** @param array<string,mixed> $ev */
    private function runtimeError(string $kind, string $cls, string $msg, int $line, array $ev): array
    {
        $src = $this->src;

        if (preg_match('/^Undefined variable \$(\w+)/', $msg, $m)) {
            $name = '$' . $m[1];
            $near = $this->nearVariables($m[1], $line);
            return [
                'code' => 'undefined-variable',
                'title' => sprintf('La variable %s no está definida', $name),
                'explain' => sprintf('Usas `%s` pero en este punto todavía no se le ha dado ningún valor. Ojo: dentro de una función **no se ven** las variables de fuera (no existe el ámbito global implícito de otros lenguajes): hay que pasarlas como parámetro o con `use (...)` en una closure.', $name),
                'hint' => $near ? '¿Quisiste decir ' . implode(' o ', array_map(static fn($n) => "`\${$n}`", $near)) . '?' : 'Comprueba que está escrita igual que donde se asigna y que se asigna antes de usarla.',
                'suggestions' => $near,
                'fixes' => $this->replaceFixes($line, T_VARIABLE, $name, array_map(static fn($n) => '$' . $n, $near)),
            ];
        }

        if (preg_match('/^Undefined array key (?:"(.*)"|(-?\d+))/s', $msg, $m)) {
            $key = $m[1] !== '' ? $m[1] : ($m[2] ?? '');
            $isStr = $m[1] !== '';
            $shown = $isStr ? "'{$key}'" : $key;
            return [
                'code' => 'undefined-key',
                'title' => sprintf('No existe la clave %s en el array', $shown),
                'explain' => sprintf('Estás leyendo `[%s]` de un array que no tiene esa clave. En Java sería `ArrayIndexOutOfBoundsException`/`null` en un mapa; en PHP solo da un *warning* y devuelve `null`, así que el programa sigue y el fallo aparece más tarde.', $shown),
                'hint' => sprintf('Si la clave puede no existir, usa el operador `??`: `$a[%s] ?? $valorPorDefecto`, o comprueba antes con `isset($a[%s])` / `array_key_exists(%s, $a)`. Si debería existir, revisa el índice (los arrays empiezan en 0) o cómo se construyó el array.', $shown, $shown, $shown),
            ];
        }

        if (preg_match('/^Undefined property: (\S+)::\$(\w+)/', $msg, $m)) {
            $near = $this->nearest($m[2], $this->propertyCandidates($m[1], $ev));
            return [
                'code' => 'undefined-property',
                'title' => sprintf('%s no tiene la propiedad $%s', $m[1], $m[2]),
                'explain' => sprintf('Accedes a `->%s` pero la clase `%s` no declara esa propiedad. En PHP leerla da un *warning* y devuelve `null`; asignarla crearía una propiedad dinámica (deprecated desde PHP 8.2).', $m[2], $m[1]),
                'hint' => $near ? '¿Quisiste decir ' . implode(' o ', array_map(static fn($n) => "`->{$n}`", $near)) . '?' : 'Declara la propiedad en la clase (`public string $' . $m[2] . ';`) o revisa el nombre.',
                'suggestions' => $near,
                'fixes' => $this->replaceFixes($line, T_STRING, $m[2], $near),
            ];
        }

        if (preg_match('/^Call to undefined function ([\w\\\\]+)\(\)/', $msg, $m)) {
            $fn = ltrim($m[1], '\\');
            $short = substr(strrchr('\\' . $fn, '\\'), 1);
            $near = $this->nearest($short, $this->functionCandidates());
            $java = self::JAVA_FN[$short] ?? null;
            $suggestions = $near;
            if ($java !== null && !in_array($java, $suggestions, true) && preg_match('/^\w+$/', $java) && function_exists($java)) {
                array_unshift($suggestions, $java);
            }
            $hint = $java !== null
                ? sprintf('`%s` es de Java. En PHP el equivalente es `%s`.', $short, $java)
                : ($near ? '¿Quisiste decir ' . implode(' o ', array_map(static fn($n) => "`{$n}()`", $near)) . '?' : 'Comprueba el nombre; si es de una librería, que esté cargada (`require`/`use`).');
            return [
                'code' => 'undefined-function',
                'title' => sprintf('La función %s() no existe', $short),
                'explain' => sprintf('PHP no encuentra ninguna función llamada `%s`. Puede ser una errata, una función de Java/Python que en PHP se llama distinto, o una que se define más abajo dentro de un `if` (solo las funciones declaradas en el nivel principal se pueden usar antes de su definición).', $short),
                'hint' => $hint,
                'suggestions' => $suggestions,
                'fixes' => $this->replaceFixes($line, T_STRING, $short, $suggestions, '('),
            ];
        }

        if (preg_match('/^Call to undefined method (\S+)::(\w+)\(\)/', $msg, $m)) {
            $near = $this->nearest($m[2], array_merge($this->methodCandidates($m[1]), (array) ($ev['candidates'] ?? [])));
            $javaTip = Hints::JAVA_METHODS[$m[2]] ?? null;
            return [
                'code' => 'undefined-method',
                'title' => sprintf('%s no tiene el método %s()', $m[1], $m[2]),
                'explain' => sprintf('La clase `%s` no define (ni hereda) un método `%s`. Revisa la errata o declara el método.', $m[1], $m[2]),
                'hint' => $javaTip !== null
                    ? sprintf('`%s()` es un método de Java. En PHP: `%s`.', $m[2], $javaTip)
                    : ($near ? '¿Quisiste decir ' . implode(' o ', array_map(static fn($n) => "`{$n}()`", $near)) . '?' : null),
                'suggestions' => $near,
                'fixes' => $this->replaceFixes($line, T_STRING, $m[2], $near, '('),
            ];
        }

        if (preg_match('/^Call to a member function (\w+)\(\) on (null|string|int|float|bool|array|\w+)/', $msg, $m)) {
            $nullish = $m[2] === 'null';
            return [
                'code' => 'member-on-null',
                'title' => $nullish ? sprintf('Llamas a ->%s() sobre null', $m[1]) : sprintf('->%s() sobre un valor de tipo %s', $m[1], $m[2]),
                'explain' => $nullish
                    ? sprintf('Es el `NullPointerException` de PHP: la variable que usas antes de `->%s()` vale `null` (no se inicializó, una búsqueda no encontró nada o una función devolvió `null`).', $m[1])
                    : sprintf('Intentas llamar a `->%s()` sobre algo que no es un objeto, sino `%s`.', $m[1], $m[2]),
                'hint' => $nullish ? 'Si `null` es un caso posible, usa el operador *nullsafe*: `$obj?->metodo()` (devuelve `null` en vez de fallar), o comprueba `if ($obj !== null)` antes. Si no debería ser `null`, mira de dónde sale ese valor.' : 'Comprueba que la variable contiene el objeto que crees (`var_dump($x)`).',
            ];
        }

        if (preg_match('/^Attempt to (read|assign) property "(\w+)" on (\w+)/', $msg, $m)) {
            return [
                'code' => 'property-on-null',
                'title' => sprintf('Accedes a ->%s sobre %s', $m[2], $m[3]),
                'explain' => sprintf('Lees o escribes `->%s` en algo que es `%s`, no un objeto. Si es `null`, es el equivalente al `NullPointerException`.', $m[2], $m[3]),
                'hint' => 'Usa `$obj?->' . $m[2] . '` si puede ser `null`, o comprueba `$obj !== null` antes. Con `var_dump($obj)` ves qué contiene de verdad.',
            ];
        }

        if (preg_match('/^Cannot instantiate (abstract class|interface|trait|enum) (\w+)/', $msg, $m)) {
            return [
                'code' => 'instantiate-abstract',
                'title' => sprintf('No se puede hacer new %s (es %s)', $m[2], $m[1]),
                'explain' => sprintf('`%s` es %s: no se puede crear una instancia directamente. Igual que en Java, necesitas una clase **concreta** que la extienda o implemente, y hacer `new` de esa.', $m[2], $m[1]),
            ];
        }

        if (preg_match('/^(Class|Interface|Trait|Enum) "([^"]+)" not found/', $msg, $m)) {
            $near = $this->nearest($m[2], array_column($this->parser->classes, 'name'));
            return [
                'code' => 'class-not-found',
                'title' => sprintf('No existe %s "%s"', strtolower($m[1]) === 'class' ? 'la clase' : 'el tipo', $m[2]),
                'explain' => sprintf('PHP no conoce `%s`. Causas típicas: errata en el nombre (importa MAYÚSCULAS/minúsculas en clases propias), olvidaste el `use Namespace\\Clase;`, o la clase se define en otro archivo que no has cargado con `require`.', $m[2]),
                'hint' => $near ? '¿Quisiste decir ' . implode(' o ', array_map(static fn($n) => "`{$n}`", $near)) . '?' : null,
                'suggestions' => $near,
                'fixes' => $this->replaceFixes($line, T_STRING, $m[2], $near),
            ];
        }

        if (preg_match('/^(?:Class )?(\S+) contains (\d+) abstract methods? and must therefore be declared abstract or implement the remaining methods? \((.+)\)/', $msg, $m)) {
            return [
                'code' => 'abstract-not-implemented',
                'title' => sprintf('%s no implementa %d método(s) obligatorios', $m[1], (int) $m[2]),
                'explain' => sprintf('Una clase que implementa una interfaz o extiende una clase abstracta debe definir **todos** sus métodos abstractos (igual que en Java). Te faltan: %s.', '`' . str_replace(', ', '`, `', $m[3]) . '`'),
                'hint' => 'Añade esos métodos con la misma firma, o marca la clase como `abstract` si no quieres implementarlos aquí.',
            ];
        }

        if (preg_match('/^Cannot modify readonly property (\S+)::\$(\w+)/', $msg, $m)) {
            return [
                'code' => 'readonly',
                'title' => sprintf('$%s es readonly: no se puede modificar', $m[2]),
                'explain' => sprintf('La propiedad `%s::$%s` se declaró `readonly` (como un campo `final` de Java): solo se puede asignar **una vez**, dentro del constructor.', $m[1], $m[2]),
                'hint' => 'Si necesitas "cambiarla", crea un objeto nuevo con el valor modificado (patrón *wither*: `return new self(...)`), o quita `readonly` si realmente debe ser mutable.',
            ];
        }

        if (preg_match('/^(\S+)\(\): Argument #(\d+) \(\$(\w+)\) must be of type (.+?), (\S+) given(?:, called in .+? on line (\d+))?/', $msg, $m)) {
            $callLine = isset($m[6]) && $m[6] !== '' ? (int) $m[6] : $line;
            $given = $m[5];
            $strict = $this->parser->strictTypesToken() !== null;
            return [
                'code' => 'argument-type',
                'title' => sprintf('%s(): el argumento #%d (%s) debe ser %s, no %s', $m[1], (int) $m[2], '$' . $m[3], $m[4], $given),
                'explain' => sprintf('Llamas a `%s()` pasando un valor de tipo `%s` donde el parámetro `$%s` exige `%s`. %s', $m[1], $given, $m[3], $m[4], $strict
                    ? 'Con `declare(strict_types=1)` PHP **no convierte** tipos: el error es exactamente el `incompatible types` de Java, solo que se detecta al ejecutar, no al compilar.'
                    : 'Sin `declare(strict_types=1)` PHP intenta convertir el valor; aquí no ha sido posible.'),
                'hint' => $given === 'string' && str_contains($m[4], 'int') || $given === 'string' && str_contains($m[4], 'float')
                    ? 'Convierte el texto a número antes de llamar: `(int) $s`, `intval($s)` o `(float) $s`. Si viene de `$argv`, de un formulario o de un fichero, **siempre** es string.'
                    : 'Revisa qué valor le pasas (`var_dump($x)`) y de dónde viene.',
                'line' => $callLine,
            ];
        }

        if (preg_match('/^(\S+)\(\): Return value must be of type (.+?), (.+?) returned/', $msg, $m)) {
            return [
                'code' => 'return-type',
                'title' => sprintf('%s(): debe devolver %s, no %s', $m[1], $m[2], $m[3]),
                'explain' => sprintf('La función declara `: %s` como tipo de retorno pero ha devuelto `%s`. Revisa todos los caminos de la función: si alguno termina sin `return` devuelve `null` (aquí aparece como `none`).', $m[2], $m[3]),
                'hint' => $m[3] === 'none' ? 'Falta un `return` al final o en alguna rama (`if`/`else`/`switch`).' : null,
            ];
        }

        if (preg_match('/^Too few arguments to function (\S+)\(\), (\d+) passed in .+? on line (\d+) and (exactly|at least) (\d+) expected/', $msg, $m)) {
            return [
                'code' => 'too-few-arguments',
                'title' => sprintf('%s() necesita %s %d argumento(s) y recibe %d', $m[1], $m[4] === 'exactly' ? 'exactamente' : 'al menos', (int) $m[5], (int) $m[2]),
                'explain' => 'Llamas a la función con menos argumentos de los que declara y alguno no tiene valor por defecto. Pásale los que faltan, o dale un valor por defecto al parámetro (`int $n = 0`).',
                'line' => (int) $m[3],
            ];
        }

        if (preg_match('/^(Division|Modulo) by zero/', $msg, $m)) {
            return [
                'code' => 'division-by-zero',
                'title' => $m[1] === 'Division' ? 'División entre cero' : 'Módulo entre cero',
                'explain' => 'El divisor vale 0. En PHP 8 `/`, `%` e `intdiv()` lanzan `DivisionByZeroError`.',
                'hint' => 'Comprueba el divisor antes (`if ($b === 0) ...`). Si quieres el comportamiento de coma flotante (`INF`/`NAN`) usa `fdiv($a, $b)`.',
            ];
        }

        if (preg_match('/^Unsupported operand types: (\w+) ([^\s]+) (\w+)/', $msg, $m)) {
            $hasString = $m[1] === 'string' || $m[3] === 'string';
            return [
                'code' => 'operand-types',
                'title' => sprintf('No se puede hacer `%s %s %s`', $m[1], $m[2], $m[3]),
                'explain' => sprintf('El operador `%s` no admite un `%s` y un `%s`. %s', $m[2], $m[1], $m[3], $hasString && $m[2] === '+'
                    ? 'Si querías **unir textos**, en PHP el operador de concatenación es el punto: `$a . $b`. El `+` es solo aritmético.'
                    : 'Con `array` solo valen `+` entre arrays y comparaciones; con texto no numérico, aritmética no.'),
                'hint' => $hasString ? 'Concatena con `.`, o convierte el texto a número con `(int)`/`(float)`.' : 'Mira con `var_dump()` qué tipo tiene cada operando.',
            ];
        }

        if (preg_match('/^A non-numeric value encountered/', $msg)) {
            return [
                'code' => 'non-numeric',
                'title' => 'Aritmética con un texto que no es un número',
                'explain' => 'Haces una operación matemática con un string que no es numérico (por ejemplo `"abc" * 2`). Para PHP 8 eso es un error o un aviso según el caso.',
                'hint' => 'Convierte antes con `(int)`/`(float)` y valida con `is_numeric($s)`.',
            ];
        }

        if (preg_match('/^Array to string conversion/', $msg)) {
            return [
                'code' => 'array-to-string',
                'title' => 'Un array usado como texto',
                'explain' => 'Pones un `array` donde PHP espera un string (`echo $array`, `"..." . $array`). PHP lo convierte en la palabra `Array` y avisa.',
                'hint' => 'Para verlo: `print_r($array)`, `var_dump($array)` o `json_encode($array)`. Para unir sus elementos: `implode(", ", $array)`.',
            ];
        }

        if (preg_match('/^Object of class (\S+) could not be converted to (string|int|float)/', $msg, $m)) {
            return [
                'code' => 'object-to-string',
                'title' => sprintf('%s no se puede convertir a %s', $m[1], $m[2]),
                'explain' => $m[2] === 'string'
                    ? sprintf('Imprimes o concatenas un objeto `%s` como si fuera texto. Para eso la clase necesita el método mágico `__toString(): string` (el `toString()` de Java).', $m[1])
                    : sprintf('Un objeto `%s` no se puede usar como número.', $m[1]),
                'hint' => $m[2] === 'string' ? 'Añade `public function __toString(): string { return ...; }` o imprime una propiedad concreta.' : null,
            ];
        }

        if (preg_match('/^"(.*)" is not a valid backing value for enum (\S+)/s', $msg, $m)) {
            return [
                'code' => 'enum-value',
                'title' => sprintf('"%s" no es un valor de %s', $m[1], $m[2]),
                'explain' => sprintf('`%s::from()` lanza `ValueError` si el valor no existe (como `Enum.valueOf` lanza `IllegalArgumentException`).', $m[2]),
                'hint' => sprintf('Usa `%s::tryFrom($valor)`: devuelve `null` si no existe, y puedes combinarlo con `?? $porDefecto`.', $m[2]),
            ];
        }

        if (preg_match('/^Unhandled match case (.+)/s', $msg, $m)) {
            return [
                'code' => 'match-unhandled',
                'title' => sprintf('match sin brazo para %s', $m[1]),
                'explain' => 'A diferencia de `switch`, `match` es **exhaustivo**: si ningún brazo coincide lanza `UnhandledMatchError`. Y compara con `===` (tipo incluido).',
                'hint' => 'Añade un brazo `default => ...` o cubre este valor. Comprueba que el tipo coincide (`"1"` no es `1`).',
            ];
        }

        if (preg_match('/^Typed property (\S+)::\$(\w+) must not be accessed before initialization/', $msg, $m)) {
            return [
                'code' => 'uninitialized-property',
                'title' => sprintf('%s::$%s se lee antes de inicializarla', $m[1], $m[2]),
                'explain' => 'Una propiedad con tipo (`private int $x;`) y sin valor por defecto **no vale `null`**: está "sin inicializar" hasta que se asigna, y leerla lanza este error.',
                'hint' => sprintf('Asígnale valor en el constructor, dale un valor por defecto (`= 0`) o hazla nullable (`?int $%s = null`).', $m[2]),
            ];
        }

        if (preg_match('/^Cannot assign (\S+) to property (\S+)::\$(\w+) of type (\S+)/', $msg, $m)) {
            return [
                'code' => 'property-type',
                'title' => sprintf('$%s es %s: no admite %s', $m[3], $m[4], $m[1]),
                'explain' => sprintf('La propiedad `%s::$%s` tiene tipo `%s` y le asignas un `%s`. Con `strict_types` no se convierte automáticamente.', $m[2], $m[3], $m[4], $m[1]),
            ];
        }

        if (preg_match('/^(?:Call to|Cannot access) (private|protected) (method|property)?\s*(\S+)/', $msg, $m)) {
            return [
                'code' => 'visibility',
                'title' => sprintf('Acceso a algo %s desde fuera', $m[1]),
                'explain' => sprintf('`%s` es `%s`: solo se puede usar %s. Igual que en Java.', rtrim($m[3], '()'), $m[1], $m[1] === 'private' ? 'dentro de su propia clase' : 'desde su clase y sus subclases'),
                'hint' => 'Si debe ser accesible desde fuera, cámbialo a `public`; si no, usa un método público que lo exponga.',
            ];
        }

        if (preg_match('/^Using \$this when not in object context/', $msg)) {
            return [
                'code' => 'this-static',
                'title' => '$this fuera de un objeto',
                'explain' => 'Usas `$this` en un método `static` o en una función suelta. `$this` solo existe cuando el método se llama sobre una **instancia**. En métodos `static` usa `self::` / `static::`.',
            ];
        }

        if (preg_match('/^Non-static method (\S+)::(\w+)\(\) cannot be called statically/', $msg, $m)) {
            return [
                'code' => 'non-static-call',
                'title' => sprintf('%s() no es static', $m[2]),
                'explain' => sprintf('Llamas a `%s::%s()` como si fuera estático, pero es un método de instancia. Crea un objeto (`$o = new %s(); $o->%s();`) o declara el método `static`.', $m[1], $m[2], $m[1], $m[2]),
            ];
        }

        if (preg_match('/^Cannot redeclare (\S+)\(\)|^Cannot declare class (\S+), because the name is already in use/', $msg, $m)) {
            $name = $m[1] !== '' ? $m[1] : $m[2];
            return [
                'code' => 'redeclare',
                'title' => sprintf('"%s" está definido dos veces', $name),
                'explain' => 'Hay dos declaraciones con el mismo nombre. En PHP no hay sobrecarga de funciones: usa valores por defecto, tipos unión o nombres distintos.',
            ];
        }

        if (preg_match('/^Undefined constant "([^"]+)"/', $msg, $m)) {
            return [
                'code' => 'undefined-constant',
                'title' => sprintf('La constante %s no existe', $m[1]),
                'explain' => sprintf('PHP cree que `%s` es una constante (un nombre sin `$` ni comillas) y no encuentra ninguna. Si es una **variable**, le falta el `$`; si es un **texto**, le faltan las comillas.', $m[1]),
                'hint' => sprintf('¿`$%s` o `\'%s\'`?', $m[1], $m[1]),
            ];
        }

        if (preg_match('/^Unknown named parameter \$(\w+)/', $msg, $m)) {
            return [
                'code' => 'named-parameter',
                'title' => sprintf('La función no tiene un parámetro llamado $%s', $m[1]),
                'explain' => 'Los argumentos con nombre (`f(nombre: 1)`) deben coincidir exactamente con el nombre del parámetro, sin `$`.',
            ];
        }

        if (preg_match('/^(Illegal|Uninitialized) string offset/', $msg)) {
            return [
                'code' => 'string-offset',
                'title' => 'Posición fuera del texto',
                'explain' => 'Accedes a `$s[$i]` con un índice que no existe en el string (o que no es un entero). Recuerda: empiezan en 0 y el último es `strlen($s) - 1`.',
            ];
        }

        if (preg_match('/^Cannot use object of type (\S+) as array/', $msg, $m)) {
            return [
                'code' => 'object-as-array',
                'title' => sprintf('%s no se puede usar como array', $m[1]),
                'explain' => sprintf('Usas `$x[...]` sobre un objeto `%s`. Para eso la clase tendría que implementar `ArrayAccess`; si no, usa `$x->propiedad` o un método.', $m[1]),
            ];
        }

        if (preg_match('/^Implicit conversion from float (\S+) to int loses precision/', $msg, $m)) {
            return [
                'code' => 'float-to-int',
                'title' => sprintf('Se pierde precisión al convertir %s a int', $m[1]),
                'explain' => 'Usas un número con decimales donde hace falta un entero (índice de array, `%`, operaciones de bits...). PHP descarta los decimales.',
                'hint' => 'Hazlo explícito: `(int) $x`, `intdiv($a, $b)` para división entera, `floor()`/`round()` según lo que quieras.',
            ];
        }

        if (preg_match('/^(?:\w+\(\): )?Passing null to parameter #(\d+) \(\$(\w+)\) of type (\S+) is deprecated/', $msg, $m)) {
            return [
                'code' => 'null-to-param',
                'title' => sprintf('Pasas null a un parámetro %s', $m[3]),
                'explain' => sprintf('El parámetro #%d (`$%s`) de una función nativa espera `%s` y recibe `null`. Hoy funciona (se convierte), pero dejará de hacerlo en una versión futura.', (int) $m[1], $m[2], $m[3]),
                'hint' => 'Asegúrate de que el valor no es `null` o usa `?? \'\'` / `?? 0`.',
            ];
        }

        if (preg_match('/^Creation of dynamic property (\S+)::\$(\w+) is deprecated/', $msg, $m)) {
            return [
                'code' => 'dynamic-property',
                'title' => sprintf('$%s no está declarada en %s', $m[2], $m[1]),
                'explain' => sprintf('Asignas `->%s` en un objeto de `%s`, pero la clase no declara esa propiedad. Crear propiedades "al vuelo" está deprecado desde PHP 8.2 y casi siempre es una errata.', $m[2], $m[1]),
                'hint' => sprintf('Declárala en la clase (`public string $%s;`) o comprueba que el nombre está bien escrito.', $m[2]),
            ];
        }

        if (preg_match('/^(\w+)\(\): Argument #(\d+) \(\$(\w+)\) (must be .+)/', $msg, $m)) {
            return [
                'code' => 'argument-value',
                'title' => sprintf('%s(): valor no válido en $%s', $m[1], $m[3]),
                'explain' => sprintf('El argumento #%d (`$%s`) de `%s()` tiene el tipo correcto pero un valor que la función no acepta: %s.', (int) $m[2], $m[3], $m[1], $m[4]),
            ];
        }

        if (preg_match('/^Maximum call stack size/', $msg)) {
            return $this->memory($msg, $line);
        }

        // Genérico
        $title = $cls !== '' ? $cls : match ($kind) {
            'warning' => 'Aviso (warning)', 'notice' => 'Aviso (notice)', 'deprecated' => 'Función obsoleta (deprecated)', default => 'Error',
        };
        return [
            'code' => 'generic', 'title' => $title . ': ' . $this->short($msg, 90),
            'explain' => ($kind === 'exception' ? 'Se lanzó una excepción sin capturar: el programa se detiene en ese punto. ' : '') . 'Mensaje original de PHP: `' . $msg . '`.',
        ];
    }

    private function timeout(int $line, int $limit = 5): array
    {
        $text = trim($this->src->lineText($line));
        return [
            'code' => 'timeout',
            'title' => 'Tiempo agotado: el programa no termina',
            'explain' => sprintf('Tu código lleva más de %d segundo%s ejecutándose y el playground lo ha parado. Casi siempre es un **bucle infinito** o una recursión sin fin. Se cortó en la línea %d%s.', $limit, $limit === 1 ? '' : 's', $line, $text !== '' ? ': `' . $this->short($text, 80) . '`' : ''),
            'hint' => 'Revisa la condición del `while`/`for` más cercano: ¿la variable que comprueba cambia dentro del bucle? ¿El incremento (`$i++`) está donde debe? Si es un cálculo muy pesado, prueba con una entrada más pequeña.',
            'line' => $line,
        ];
    }

    private function memory(string $msg, int $line): array
    {
        // Si el error cae dentro de una función que se llama a sí misma, es casi seguro una recursión sin fin
        $unit = $this->parser->unitAtLine($line);
        $recursive = $unit !== null && $unit->hasBody() && $this->callsItself($unit);
        $stack = $recursive || str_contains($msg, 'call stack');
        return [
            'code' => $stack ? 'stack-overflow' : 'out-of-memory',
            'title' => $stack ? 'Recursión infinita (StackOverflow)' : 'Memoria agotada',
            'explain' => $stack
                ? ($recursive ? sprintf('La función `%s()` se llama a sí misma sin parar y la pila de llamadas se llena (el `StackOverflowError` de Java). ', $unit->name) : 'Una función se llama a sí misma sin parar y se llena la pila de llamadas (el `StackOverflowError` de Java). ')
                    . 'Casi siempre falta el **caso base** que corta la recursión, o el argumento no se acerca a él en cada llamada.'
                : 'El programa pidió más memoria de la permitida (128 MB). Suele ser un array que crece sin límite dentro de un bucle infinito, una recursión sin caso base, o un dato demasiado grande.',
            'hint' => $stack
                ? 'Comprueba el `if` del caso base (`if ($n <= 1) return ...`) y que la llamada recursiva usa un valor más pequeño (`$n - 1`, no `$n`).'
                : 'Revisa los bucles que añaden elementos (`$a[] = ...`) y su condición de salida. Para recorrer muchos datos sin guardarlos usa un generador (`yield`).',
            'line' => $line,
        ];
    }

    // ───────────────────────────── utilidades ─────────────────────────────

    private function callsItself(\Playground\Lang\Php\Analysis\Unit $unit): bool
    {
        for ($i = $unit->open + 1; $i < $unit->close; $i++) {
            $t = $this->src->tokens[$i];
            if ($t->id === T_STRING && strcasecmp($t->text, $unit->name) === 0 && $this->src->is($this->src->next($i), '(')) {
                return true;
            }
        }
        return false;
    }

    private function short(string $s, int $max): string
    {
        $s = (string) preg_replace('/\s+/', ' ', $s);
        return mb_strlen($s) > $max ? mb_substr($s, 0, $max - 1) . '…' : $s;
    }

    /** Rango del código de una línea, sin la sangría inicial ni espacios finales. */
    private function codeRange(int $line): array
    {
        $text = $this->src->lineText($line);
        $trimmed = ltrim($text);
        $indent = strlen($text) - strlen($trimmed);
        $startCol = Source::utf16Length(substr($text, 0, $indent)) + 1;
        $endCol = Source::utf16Length(rtrim($text)) + 1;
        if ($endCol <= $startCol) {
            $endCol = $startCol + 1;
        }
        return ['sl' => $line, 'sc' => $startCol, 'el' => $line, 'ec' => $endCol];
    }

    private function tokenOnLine(int $line, string $text): ?int
    {
        foreach ($this->src->tokens as $i => $t) {
            if ($t->line > $line) {
                break;
            }
            if ($t->line === $line && Source::isSignificant($t) && $t->text === $text) {
                return $i;
            }
        }
        return null;
    }

    /** @return list<string> variables (sin $) del ámbito de esa línea, parecidas a $word */
    private function nearVariables(string $word, int $line): array
    {
        $unit = $this->parser->unitAtLine($line);
        $names = [];
        foreach ($this->src->tokens as $i => $t) {
            if ($t->id !== T_VARIABLE) {
                continue;
            }
            $owner = $this->parser->owner[$i];
            $same = $unit === null ? $owner === -1 : ($owner >= 0 && $this->parser->units[$owner] === $unit);
            if ($same) {
                $names[ltrim($t->text, '$')] = true;
            }
        }
        unset($names[$word], $names['this']);
        return $this->nearest($word, array_keys($names));
    }

    /** @return list<string> */
    private function functionCandidates(): array
    {
        static $internal = null;
        $internal ??= get_defined_functions()['internal'];
        $user = [];
        foreach ($this->parser->units as $u) {
            if ($u->kind === 'function') {
                $user[] = $u->name;
            }
        }
        return array_merge($user, $internal);
    }

    /** @return list<string> */
    private function methodCandidates(string $class): array
    {
        $names = $this->parser->methodsOf($class);
        if (class_exists($class, false) || interface_exists($class, false)) {
            $names = array_merge($names, get_class_methods($class));
        }
        return array_values(array_unique($names));
    }

    /** @return list<string> */
    private function propertyCandidates(string $class, array $ev): array
    {
        $names = (array) ($ev['propCandidates'] ?? []);
        foreach ($this->src->tokens as $i => $t) {
            if ($t->id === T_VARIABLE && ($this->parser->classAtLine($t->line)['name'] ?? null) === $class
                && $this->parser->owner[$i] === -1) {
                $names[] = ltrim($t->text, '$');
            }
        }
        return array_values(array_unique($names));
    }

    /**
     * Los candidatos más parecidos a $word (distancia de edición pequeña).
     * @param list<string> $candidates
     * @return list<string>
     */
    public function nearest(string $word, array $candidates, int $max = 3): array
    {
        $w = strtolower($word);
        $len = strlen($w);
        if ($len === 0) {
            return [];
        }
        $limit = max(1, min(3, intdiv($len, 3) + ($len <= 4 ? 0 : 0)));
        if ($len >= 8) {
            $limit = 3;
        }
        $scored = [];
        foreach (array_unique($candidates) as $c) {
            if (!is_string($c) || $c === '' || strcasecmp($c, $word) === 0) {
                continue;
            }
            $lc = strtolower($c);
            if (abs(strlen($lc) - $len) > $limit + 1) {
                continue;
            }
            $d = levenshtein($w, $lc);
            if ($d <= $limit) {
                $scored[$c] = $d;
            } elseif ($len >= 4 && (str_starts_with($lc, $w) || str_starts_with($w, $lc)) && abs(strlen($lc) - $len) <= 3) {
                $scored[$c] = $limit + 1; // un prefijo del otro: probable
            }
        }
        asort($scored);
        return array_slice(array_keys($scored), 0, $max);
    }

    /**
     * Arreglos "cambiar X por Y" para la primera aparición del token en la línea.
     * @param list<string> $replacements
     * @return list<array<string,mixed>>
     */
    private function replaceFixes(int $line, int $tokenId, string $from, array $replacements, ?string $followedBy = null): array
    {
        $src = $this->src;
        $found = null;
        foreach ($src->tokens as $i => $t) {
            if ($t->line > $line) {
                break;
            }
            if ($t->line === $line && $t->id === $tokenId && strcasecmp($t->text, $from) === 0) {
                if ($followedBy !== null && !$src->is($src->next($i), $followedBy)) {
                    continue;
                }
                $found = $i;
                break;
            }
        }
        if ($found === null) {
            return [];
        }
        $out = [];
        foreach ($replacements as $r) {
            $out[] = ['title' => sprintf('Cambiar por `%s`', $r), 'edits' => [['range' => $src->range($found), 'text' => $r]]];
        }
        return $out;
    }
}
