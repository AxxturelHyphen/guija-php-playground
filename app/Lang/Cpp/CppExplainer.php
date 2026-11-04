<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp;

use Playground\Core\Explains;

defined('PG_ROOT') or exit;

/**
 * Traduce un error de C++ (de compilación, del enlazador o de ejecución) a un diagnóstico explicado en español.
 *
 * Versión base: reconoce los casos más comunes con dos tablas que se pueden ampliar sin tocar el resto:
 *  - COMPILACION: reglas [expresión regular sobre el mensaje del compilador (en inglés), código, título, explicación];
 *    en el título y la explicación, $1, $2… son los grupos de la expresión.
 *  - EJECUCION: por `kind` del evento (y `cls` cuando hace falta): timeout, stack, segfault, fpe, abort, exception,
 *    memory, asan (cls = tipo de informe: heap-buffer-overflow…), ubsan (cls = signed-integer-overflow…), leak, fatal, todo.
 *
 * Eventos de compilación (CppLanguage): {kind:'parse', severity?:'warning', code ('gcc.not-declared', 'Wunused-variable',
 * 'link.undefined'…), msg, line, col, endLine, endCol, fixits?:[{sl,sc,el,ec,text}], notes?:[{line,col,msg}], flag?}.
 * Los fix-its del compilador se convierten en arreglos rápidos (Alt+Enter).
 */
final class CppExplainer implements Explains
{
    /** @var list<array{0:string, 1:string, 2:string, 3:string}> */
    private const COMPILACION = [
        ['/^\'([^\']+)\' was not declared in this scope|^use of undeclared identifier \'([^\']+)\'/', 'undefined-variable', 'No existe «$1$2» en este punto',
            'El compilador no conoce **`$1$2`** aquí. ¿Está bien escrito (mayúsculas incluidas)? ¿Lo declaraste antes de usarlo, y en un ámbito (`{ … }`) que llegue hasta aquí? Si es de la biblioteca estándar, ¿falta `std::` o `using namespace std;`?'],
        ['/^expected \'([^\']+)\' before|^expected \'([^\']+)\'/', 'syntax', 'Falta «$1$2»',
            'El compilador esperaba **`$1$2`** en este punto. Casi siempre es un `;` olvidado al final de la línea **anterior**, o un paréntesis o llave sin cerrar.'],
        ['/no return statement in function returning non-void|non-void function does not return a value|control reaches end of non-void/', 'missing-return',
            'La función no devuelve nada en algún camino',
            'La función promete devolver un valor, pero puede terminar sin llegar a un `return`. En C++ eso es **comportamiento indefinido** (el programa puede hacer cualquier cosa). Añade el `return` que falta (o `return pendiente();` si aún no la has hecho).'],
        ['/no matching function for call to \'([^\'(]+)/', 'no-matching-function', 'Ninguna versión de «$1» acepta esos argumentos',
            'Llamas a **`$1`** con argumentos que no encajan con ninguna de sus declaraciones: revisa cuántos pasas y de qué tipo (las notas del compilador dicen qué versiones hay).'],
        ['/has no member named \'([^\']+)\'|no member named \'([^\']+)\'/', 'undefined-method', 'Ese tipo no tiene «$1$2»',
            'El objeto no tiene ningún miembro llamado **`$1$2`**. ¿Está bien escrito? Recuerda que en C++ los nombres de la biblioteca son en minúsculas: `size()`, `push_back()`, `empty()`…'],
        ['/static assertion failed: (.+)$|static assertion failed due to requirement.*?: (.+)$|static_assert failed.*?"(.+)"/', 'static-assert', '$1$2$3',
            'Lo comprueba el propio código en tiempo de compilación: **$1$2$3**'],
        ['/^undefined reference to \'([^\']+)\'/', 'link-undefined', 'Falta la definición de «$1»',
            'El código **declara** y usa `$1`, pero en ningún sitio está su **cuerpo** (la definición con `{ … }`). ¿Escribiste solo el prototipo, o el nombre o los parámetros de la definición no coinciden con los de la declaración?'],
        ['/^multiple definition of \'([^\']+)\'/', 'link-multiple', '«$1» está definido dos veces',
            'Hay dos definiciones de **`$1`**: borra o renombra una.'],
        ['/^(.+?): No such file or directory|^\'(.+?)\' file not found/', 'include-not-found', 'No existe la cabecera «$1$2»',
            'El `#include` pide **`$1$2`**, que no está en este compilador. ¿Está bien escrita? Las de la biblioteca estándar van sin `.h`: `<vector>`, `<string>`, `<algorithm>`…'],
    ];

    /** kind → [código, título, explicación, pista] (las de `asan`/`ubsan` dependen de `cls`, ver runtime()). */
    private const EJECUCION = [
        'timeout' => ['timeout', 'El programa tardó más de {limit} s y se detuvo',
            'El programa estuvo ejecutándose más de **{limit} segundos** y el playground lo detuvo. Casi siempre es un **bucle infinito** (la condición del `while`/`for` nunca se vuelve falsa) o un algoritmo demasiado lento para esa entrada (mira el `O()` en el análisis). ¿Esperas leer con `cin` algo que no hay en «Entrada»?',
            'Imprime algo dentro del bucle para ver si avanza.'],
        'stack' => ['stack-overflow', 'Desbordamiento de pila (¿recursión sin caso base?)',
            'Una función se llamó a sí misma (o se llamaron entre ellas) tantas veces que **se agotó la pila** (256 MB). Falta el caso base, o el argumento no se acerca a él.',
            'Mira en la traza qué función se repite: ahí falta el caso base.'],
        'segfault' => ['segfault', 'Acceso a memoria no válida (segmentation fault)',
            'El programa leyó o escribió en una dirección de memoria que no es suya: un puntero a `nullptr` o sin inicializar, un índice fuera de rango, o memoria ya liberada.',
            'Comprueba los punteros antes de usarlos y los índices contra `size()`.'],
        'fpe' => ['division-by-zero', 'División entera entre cero',
            'Una división (`/`) o un resto (`%`) de enteros tiene **0** como divisor: en C++ eso detiene el programa.', 'Comprueba el divisor antes de dividir.'],
        'abort' => ['abort', 'El programa se abortó',
            'Algo llamó a `abort()`: normalmente un `assert` que no se cumple o una comprobación de la biblioteca (como un índice fuera de rango).', null],
        'exception' => ['exception', 'Excepción sin capturar: {cls}',
            'Se lanzó una excepción (**`{cls}`**) y nada la capturó con `try { … } catch`, así que el programa terminó.', null],
        'memory' => ['out-of-memory', 'Memoria agotada',
            'El programa pidió más memoria de la que hay disponible (`std::bad_alloc`): un contenedor que crece sin parar, o un tamaño enorme.', null],
        'leak' => ['memory-leak', 'Memoria que nunca se libera',
            'Reservaste memoria con `new` y nadie hizo el `delete` correspondiente (o se perdió el puntero). En C++ moderno, usa contenedores (`vector`) o punteros inteligentes (`unique_ptr`) y no tendrás que liberar a mano.', null],
        'fatal' => ['fatal', '{msg}', '', null],
    ];

    public function __construct(private readonly string $code)
    {
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
            $base = ['source' => 'syntax', 'severity' => ($ev['severity'] ?? 'error') === 'warning' ? 'warning' : 'error', 'col' => $col,
                'endLine' => (int) ($ev['endLine'] ?? $line), 'endCol' => max($col + 1, (int) ($ev['endCol'] ?? $col + 1))] + $base;
            $d = $this->compilacion((string) ($ev['code'] ?? ''), $msg, $base);
            $fixes = $this->fixes($ev);
            if ($fixes !== []) {
                $d['fixes'] = $fixes;
            }
            if (!empty($ev['notes'])) {
                $d['notes'] = $ev['notes'];
            }
            return $d;
        }
        $base['source'] = 'runtime';
        return $this->runtime($kind, $ev, $base);
    }

    /** @param array<string,mixed> $b */
    private function compilacion(string $code, string $msg, array $b): array
    {
        foreach (self::COMPILACION as [$re, $c, $titulo, $explica]) {
            if (preg_match($re, $msg, $m)) {
                $sust = static function (string $t) use ($m): string {
                    return (string) preg_replace_callback('/\$(\d)/', static fn($x) => (string) ($m[(int) $x[1]] ?? ''), $t);
                };
                return ['code' => $c, 'title' => $sust($titulo), 'explain' => $sust($explica)] + $b;
            }
        }
        $warning = $b['severity'] === 'warning';
        return ['code' => $code !== '' ? $code : 'compile-error', 'title' => $this->corto($msg),
            'explain' => ($warning ? 'Aviso del compilador (el programa compila, pero conviene revisarlo)' : 'Error del compilador') . ":\n\n```\n{$msg}\n```"] + $b;
    }

    /**
     * Los fix-its del compilador (gcc/clang -fdiagnostics-parseable-fixits) como arreglo rápido.
     * @param array<string,mixed> $ev
     * @return list<array<string,mixed>>
     */
    private function fixes(array $ev): array
    {
        $edits = [];
        foreach ((array) ($ev['fixits'] ?? []) as $f) {
            if (!is_array($f) || !isset($f['sl'], $f['sc'], $f['el'], $f['ec'])) {
                continue;
            }
            $edits[] = ['range' => ['sl' => (int) $f['sl'], 'sc' => (int) $f['sc'], 'el' => (int) $f['el'], 'ec' => (int) $f['ec']], 'text' => (string) ($f['text'] ?? '')];
        }
        return $edits === [] ? [] : [['title' => 'Aplicar la sugerencia del compilador', 'edits' => $edits]];
    }

    /**
     * @param array<string,mixed> $ev
     * @param array<string,mixed> $b
     */
    private function runtime(string $kind, array $ev, array $b): array
    {
        $cls = (string) ($ev['cls'] ?? '');
        $msg = trim((string) ($ev['msg'] ?? ''));
        $sust = static fn(string $t): string => strtr($t, ['{limit}' => (string) (int) ($ev['limit'] ?? 5), '{cls}' => $cls, '{msg}' => $msg]);
        if ($kind === 'asan') {
            return ['code' => 'asan-' . $cls, 'title' => match ($cls) {
                'heap-buffer-overflow', 'stack-buffer-overflow', 'global-buffer-overflow' => 'Acceso fuera de los límites de un array o vector',
                'heap-use-after-free' => 'Uso de memoria ya liberada',
                'double-free' => 'Memoria liberada dos veces',
                'stack-overflow' => 'Desbordamiento de pila (¿recursión sin caso base?)',
                'SEGV' => 'Acceso a memoria no válida (¿un puntero nulo?)',
                'alloc-dealloc-mismatch' => 'new/delete que no se corresponden (new[] con delete, o malloc con delete)',
                'stack-use-after-scope', 'stack-use-after-return' => 'Uso de una variable que ya no existe',
                default => 'Error de memoria: ' . $cls,
            }, 'explain' => "AddressSanitizer detectó un error de memoria:\n\n```\n{$msg}" . (isset($ev['detail']) ? "\n{$ev['detail']}" : '') . "\n```"] + $b;
        }
        if ($kind === 'ubsan') {
            return ['code' => 'ubsan-' . $cls, 'title' => match ($cls) {
                'signed-integer-overflow' => 'Desbordamiento de entero (el resultado no cabe en el tipo)',
                'division-by-zero' => 'División entera entre cero',
                'out-of-bounds' => 'Índice fuera de los límites del array',
                'null' => 'Uso de un puntero nulo',
                'shift' => 'Desplazamiento de bits no válido',
                'missing-return' => 'La función terminó sin devolver un valor',
                default => 'Comportamiento indefinido',
            }, 'explain' => "UndefinedBehaviorSanitizer detectó **comportamiento indefinido**:\n\n```\n{$msg}\n```"] + $b;
        }
        if ($kind === 'leak') {
            $b['severity'] = 'warning';
        }
        $t = self::EJECUCION[$kind] ?? null;
        if ($t === null) {
            return ['code' => $kind !== '' ? $kind : 'runtime', 'title' => $this->corto($msg !== '' ? $msg : 'Error al ejecutar'),
                'explain' => "```\n{$msg}\n```"] + $b;
        }
        $d = ['code' => $t[0], 'title' => $sust($t[1]), 'explain' => $sust($t[2]) . ($msg !== '' && $kind !== 'fatal' ? "\n\n```\n" . ($cls !== '' && $kind === 'exception' ? "{$cls}: " : '') . "{$msg}\n```" : '')] + $b;
        if ($t[3] !== null) {
            $d['hint'] = $t[3];
        }
        return $d;
    }

    private function corto(string $t): string
    {
        $t = trim(explode("\n", $t)[0]);
        return mb_strlen($t) > 140 ? mb_substr($t, 0, 139) . '…' : $t;
    }
}
