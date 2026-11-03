<?php
declare(strict_types=1);

/*
 * Se precarga (auto_prepend_file) en el proceso PHP que ejecuta el código del usuario.
 *
 * - Captura warnings, excepciones y errores fatales y los manda como eventos estructurados
 *   (en vez de texto suelto) para poder explicarlos y marcarlos en el editor.
 * - Define la API que usan los ejercicios: grupo(), prueba(), comprueba(), lanza(), pendiente(), medir().
 *
 * Los eventos van por stdout entre marcas de control, mezclados con la salida normal:
 *     \x1ePG{json}\x1f
 * El Runner los separa y respeta el orden en que ocurrieron.
 *
 * Todo vive en una clase con estáticos para no ensuciar el espacio global del usuario
 * (solo las funciones de la API pública son globales).
 */

if (defined('PG_HARNESS')) {
    return;
}
define('PG_HARNESS', true);

/** Se lanza desde pendiente(): el ejercicio aún no está implementado. Extiende Error para que un `catch (Exception)` del usuario no lo trague. */
final class PorHacer extends Error
{
}

final class PgHarness
{
    public const START = "\x1ePG";
    public const END = "\x1f";

    public static string $userFile = '';
    public static int $startedAt = 0;
    public static string $group = 'general';
    public static bool $bench = false;
    public static int $benchBudgetMs = 1500;
    /** Memoria reservada que se libera para poder informar de un "memory exhausted". */
    public static ?string $reserve = null;

    public static function init(): void
    {
        self::$startedAt = hrtime(true);
        self::$userFile = (string) ($_SERVER['argv'][0] ?? $_SERVER['SCRIPT_FILENAME'] ?? '');
        self::$bench = getenv('PG_BENCH') === '1';
        $budget = getenv('PG_BENCH_BUDGET_MS');
        if ($budget !== false && ctype_digit($budget)) {
            self::$benchBudgetMs = (int) $budget;
        }
        self::$reserve = str_repeat('x', 1 << 20);

        set_error_handler(self::onError(...));
        set_exception_handler(self::onException(...));
        register_shutdown_function(static function (): void {
            self::onShutdown();
            // Una segunda función registrada durante el cierre se ejecuta la última (tras las del usuario).
            register_shutdown_function(static fn() => self::finish());
        });
    }

    // ───────────────────────────── eventos ─────────────────────────────

    public static function emit(array $ev): void
    {
        $json = json_encode($ev, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION);
        @fwrite(STDOUT, self::START . ($json === false ? '{"t":"noop"}' : $json) . self::END);
    }

    private static function isUserFile(string $file): bool
    {
        return $file !== '' && $file !== __FILE__;
    }

    /** @return list<array{fn:string, line:int}> */
    private static function frames(array $trace): array
    {
        $out = [];
        foreach ($trace as $f) {
            if (!self::isUserFile((string) ($f['file'] ?? ''))) {
                continue;
            }
            $name = ($f['class'] ?? '') . ($f['type'] ?? '') . ($f['function'] ?? '');
            if (str_starts_with($name, '{closure')) {
                $name = '{closure}';
            }
            $out[] = ['fn' => $name . '()', 'line' => (int) ($f['line'] ?? 0)];
            if (count($out) >= 20) {
                break;
            }
        }
        return $out;
    }

    // ───────────────────────────── errores ─────────────────────────────

    private static function onError(int $no, string $msg, string $file, int $line): bool
    {
        if (!(error_reporting() & $no) || !self::isUserFile($file)) {
            return true;
        }
        $kind = match ($no) {
            E_NOTICE, E_USER_NOTICE => 'notice',
            E_DEPRECATED, E_USER_DEPRECATED => 'deprecated',
            default => 'warning',
        };
        $ev = ['t' => 'err', 'kind' => $kind, 'msg' => $msg, 'line' => $line, 'file' => basename($file)];
        if (preg_match('/^Undefined property: (\S+)::\$/', $msg, $m) && class_exists($m[1])) {
            $ev['propCandidates'] = array_map(static fn($p) => $p->getName(), (new ReflectionClass($m[1]))->getProperties());
        }
        self::emit($ev);
        return true;
    }

    private static function onException(Throwable $e): void
    {
        if ($e instanceof PorHacer) {
            self::emit(['t' => 'todo', 'msg' => $e->getMessage(), 'line' => $e->getLine(), 'trace' => self::frames($e->getTrace())]);
            return;
        }
        $ev = [
            't' => 'err', 'kind' => 'exception', 'cls' => get_class($e), 'msg' => $e->getMessage(),
            'line' => $e->getLine(), 'file' => basename($e->getFile()), 'trace' => self::frames($e->getTrace()),
        ];
        if (preg_match('/^Call to undefined method (\S+)::/', $e->getMessage(), $m) && (class_exists($m[1]) || interface_exists($m[1]))) {
            $ev['candidates'] = get_class_methods($m[1]);
        }
        if ($e->getPrevious() !== null) {
            $ev['previous'] = get_class($e->getPrevious()) . ': ' . $e->getPrevious()->getMessage();
        }
        self::emit($ev);
        exit(255);
    }

    private static function onShutdown(): void
    {
        self::$reserve = null; // libera 1 MB para poder informar de un agotamiento de memoria
        while (ob_get_level() > 0) {
            @ob_end_flush();
        }
        $err = error_get_last();
        if ($err === null || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR], true)) {
            return;
        }
        $msg = (string) $err['message'];
        $kind = match (true) {
            $err['type'] === E_PARSE => 'parse',
            str_starts_with($msg, 'Maximum execution time') => 'timeout',
            str_starts_with($msg, 'Allowed memory size'), str_contains($msg, 'Maximum call stack size') => 'memory',
            default => 'fatal',
        };
        // La primera línea basta: el resto es la traza en texto
        $msg = trim(explode("\n", $msg)[0]);
        self::emit(['t' => 'err', 'kind' => $kind, 'msg' => $msg, 'line' => (int) $err['line'], 'file' => basename((string) $err['file'])]);
    }

    private static function finish(): void
    {
        self::emit([
            't' => 'end',
            'ms' => round((hrtime(true) - self::$startedAt) / 1e6, 2),
            'mem' => memory_get_usage(),
            'peak' => memory_get_peak_usage(true),
        ]);
    }

    // ───────────────────────────── comparación y formato ─────────────────────────────

    /** Igualdad estricta (tipo incluido); floats con tolerancia; `$sinOrden` ignora el orden de listas. */
    public static function igual(mixed $a, mixed $b, bool $sinOrden = false): bool
    {
        if ($sinOrden) {
            $a = self::normalizar($a);
            $b = self::normalizar($b);
        }
        if (is_float($a) && is_float($b)) {
            if (is_nan($a) && is_nan($b)) {
                return true;
            }
            return $a === $b || abs($a - $b) <= 1e-9 * max(1.0, abs($a), abs($b));
        }
        if (is_array($a) && is_array($b)) {
            if (count($a) !== count($b) || array_keys($a) !== array_keys($b)) {
                return false;
            }
            foreach ($a as $k => $v) {
                if (!self::igual($v, $b[$k])) {
                    return false;
                }
            }
            return true;
        }
        if (is_object($a) && is_object($b)) {
            return $a == $b;
        }
        return $a === $b;
    }

    private static function normalizar(mixed $v): mixed
    {
        if (!is_array($v)) {
            return $v;
        }
        if (array_is_list($v)) {
            $v = array_map(self::normalizar(...), $v);
            usort($v, static fn($x, $y) => strcmp(self::export($x, 1000), self::export($y, 1000)));
            return $v;
        }
        ksort($v);
        return array_map(self::normalizar(...), $v);
    }

    /** Representación corta en sintaxis PHP: [1, 2], ['a' => 1], 'texto', null... */
    public static function export(mixed $v, int $max = 300): string
    {
        $s = self::exportRec($v, 0);
        return mb_strlen($s) > $max ? mb_substr($s, 0, $max - 1) . '…' : $s;
    }

    private static function exportRec(mixed $v, int $depth): string
    {
        switch (true) {
            case $v === null:
                return 'null';
            case is_bool($v):
                return $v ? 'true' : 'false';
            case is_int($v):
                return (string) $v;
            case is_float($v):
                if (is_nan($v)) {
                    return 'NAN';
                }
                if (is_infinite($v)) {
                    return $v > 0 ? 'INF' : '-INF';
                }
                $s = (string) $v;
                return preg_match('/^-?\d+$/', $s) ? $s . '.0' : $s;
            case is_string($v):
                return "'" . str_replace(["\\", "'", "\n", "\r", "\t"], ["\\\\", "\\'", '\n', '\r', '\t'], $v) . "'";
            case is_array($v):
                if ($depth >= 4) {
                    return '[…]';
                }
                $isList = array_is_list($v);
                $parts = [];
                $i = 0;
                foreach ($v as $k => $x) {
                    if (++$i > 40) {
                        $parts[] = '…(+' . (count($v) - 40) . ')';
                        break;
                    }
                    $parts[] = ($isList ? '' : self::exportRec($k, $depth + 1) . ' => ') . self::exportRec($x, $depth + 1);
                }
                return '[' . implode(', ', $parts) . ']';
            case $v instanceof UnitEnum:
                return $v::class . '::' . $v->name;
            case $v instanceof Closure:
                return 'Closure';
            case is_object($v):
                if ($depth >= 3) {
                    return $v::class . '{…}';
                }
                $props = [];
                foreach ((array) $v as $k => $x) {
                    $name = ltrim((string) preg_replace('/^\0.*?\0/', '', (string) $k), "\0");
                    $props[] = $name . ': ' . self::exportRec($x, $depth + 1);
                }
                return $v::class . '{' . implode(', ', $props) . '}';
            case is_resource($v):
                return 'resource';
            default:
                return get_debug_type($v);
        }
    }

    // ───────────────────────────── ejecución de casos ─────────────────────────────

    public static function testEvent(string $group, string $name, string $status, array $extra = []): void
    {
        self::emit(['t' => 'test', 'group' => $group, 'name' => $name, 'status' => $status] + $extra);
    }

    /** Ejecuta una prueba y emite su evento. $fn devuelve el valor actual. */
    public static function run(string $group, string $name, callable $fn, callable $check, array $extra): bool
    {
        $t0 = hrtime(true);
        try {
            $actual = $fn();
            $ok = $check($actual);
            $ms = round((hrtime(true) - $t0) / 1e6, 3);
            self::testEvent($group, $name, $ok ? 'pass' : 'fail', $extra + ['actual' => self::export($actual), 'ms' => $ms]);
            return $ok;
        } catch (PorHacer $e) {
            throw $e; // lo anuncia quien llama (prueba() una vez por función, comprueba() por caso)
        } catch (Throwable $e) {
            self::testEvent($group, $name, 'error', $extra + [
                'msg' => get_class($e) . ': ' . $e->getMessage(), 'line' => $e->getLine(),
                'ms' => round((hrtime(true) - $t0) / 1e6, 3),
            ]);
            return false;
        }
    }
}

PgHarness::init();

// ═══════════════════════════════ API pública ═══════════════════════════════

/** Marca un ejercicio sin implementar. Las pruebas lo muestran como "pendiente", no como fallo. */
function pendiente(string $mensaje = 'Ejercicio pendiente de implementar'): never
{
    throw new PorHacer($mensaje);
}

/** Agrupa las siguientes comprobaciones (comprueba/lanza) bajo un título. */
function grupo(string $nombre): void
{
    PgHarness::$group = $nombre;
}

/**
 * Prueba una función con varios casos.
 *
 *   prueba('suma', [
 *       'suma básica' => [[2, 3], 5],       // [argumentos, resultado esperado]
 *       'con negativos' => [[-1, 1], 0],
 *   ]);
 *
 * @param string|callable $fn nombre de la función (o un callable)
 * @param array<int|string, array{0: array, 1: mixed}> $casos descripción => [argumentos, esperado]
 * @param ?callable $comparador fn($actual, $esperado): bool, si la igualdad estricta no sirve
 * @param bool $sinOrden true si el resultado es un conjunto (el orden de las listas no importa)
 */
function prueba(string|callable $fn, array $casos, ?callable $comparador = null, bool $sinOrden = false): void
{
    $group = is_string($fn) ? $fn . '()' : 'closure';
    if (is_string($fn) && !is_callable($fn)) {
        PgHarness::testEvent($group, '(existe la función)', 'error', ['msg' => "La función {$fn}() no existe: ¿la has borrado o cambiado de nombre?"]);
        return;
    }
    $n = 0;
    foreach ($casos as $desc => $caso) {
        $n++;
        $name = is_int($desc) ? "caso {$n}" : $desc;
        if (!is_array($caso) || !array_key_exists(0, $caso) || !array_key_exists(1, $caso) || !is_array($caso[0])) {
            PgHarness::testEvent($group, $name, 'error', ['msg' => 'Un caso debe ser [[argumentos...], esperado]']);
            continue;
        }
        [$args, $esperado] = $caso;
        $input = implode(', ', array_map(static fn($a) => PgHarness::export($a, 120), $args));
        try {
            PgHarness::run(
                $group, $name,
                static fn() => $fn(...$args),
                static fn($actual) => $comparador !== null ? (bool) $comparador($actual, $esperado) : PgHarness::igual($actual, $esperado, $sinOrden),
                ['input' => $input, 'expected' => PgHarness::export($esperado)],
            );
        } catch (PorHacer) {
            // un solo "pendiente" por función, no uno por caso
            PgHarness::testEvent($group, '(todos los casos)', 'todo', ['total' => count($casos)]);
            return;
        }
    }
}

/**
 * Comprueba que `$fn()` devuelve `$esperado` (por defecto `true`). Pensado para clases y objetos.
 *
 *   comprueba('un depósito suma al saldo', fn() => (new Cuenta())->ingresar(5)->saldo(), 5.0);
 */
function comprueba(string $descripcion, callable $fn, mixed $esperado = true, bool $sinOrden = false): void
{
    try {
        PgHarness::run(
            PgHarness::$group, $descripcion, $fn,
            static fn($actual) => PgHarness::igual($actual, $esperado, $sinOrden),
            ['expected' => PgHarness::export($esperado)],
        );
    } catch (PorHacer) {
        PgHarness::testEvent(PgHarness::$group, $descripcion, 'todo', ['expected' => PgHarness::export($esperado)]);
    }
}

/**
 * Comprueba que `$fn()` lanza una excepción de la clase indicada (o una subclase).
 *
 *   lanza('retirar más del saldo', fn() => $cuenta->retirar(999), SaldoInsuficiente::class);
 */
function lanza(string $descripcion, callable $fn, string $excepcion = Throwable::class): void
{
    $group = PgHarness::$group;
    $t0 = hrtime(true);
    $extra = ['expected' => 'lanza ' . $excepcion];
    try {
        $fn();
        PgHarness::testEvent($group, $descripcion, 'fail', $extra + ['actual' => 'no lanzó nada', 'ms' => round((hrtime(true) - $t0) / 1e6, 3)]);
    } catch (PorHacer) {
        PgHarness::testEvent($group, $descripcion, 'todo', $extra);
    } catch (Throwable $e) {
        $ok = $e instanceof $excepcion;
        PgHarness::testEvent($group, $descripcion, $ok ? 'pass' : 'fail', $extra + [
            'actual' => 'lanzó ' . get_class($e) . ": '" . $e->getMessage() . "'",
            'ms' => round((hrtime(true) - $t0) / 1e6, 3),
        ]);
    }
}

/**
 * Mide cuánto tarda una función según crece la entrada y estima su complejidad (O(n), O(n²)...).
 * Solo se ejecuta con "Medir"/"Comparar" (en una ejecución normal se salta, porque tarda).
 *
 *   medir('buscarDuplicados', fn(int $n): array => [range(1, $n)]);         // n = 64, 128, 256...
 *   medir('fibonacci', fn(int $n): array => [$n], escala: 'lineal', tamanos: range(10, 30, 2));
 *
 * @param string|callable $fn función a medir
 * @param callable $entrada fn(int $n): array con los argumentos para un tamaño n (no se cronometra)
 * @param string $escala 'geometrica' (n = 64, 128, 256...) o 'lineal' (para algoritmos exponenciales)
 * @param ?list<int> $tamanos tamaños concretos (sustituye a los de la escala)
 */
function medir(string|callable $fn, callable $entrada, string $escala = 'geometrica', ?array $tamanos = null, ?string $etiqueta = null): void
{
    $name = $etiqueta ?? (is_string($fn) ? $fn : 'closure');
    if (!PgHarness::$bench) {
        PgHarness::emit(['t' => 'bench', 'name' => $name, 'status' => 'skipped']);
        return;
    }
    if (is_string($fn) && !is_callable($fn)) {
        PgHarness::emit(['t' => 'bench', 'name' => $name, 'status' => 'error', 'msg' => "La función {$fn}() no existe"]);
        return;
    }
    $sizes = $tamanos ?? ($escala === 'lineal' ? range(1, 40) : array_map(static fn($e) => 1 << $e, range(6, 17)));

    $points = [];
    $spent = 0.0;
    $stopped = 'done';
    foreach ($sizes as $n) {
        $t0 = hrtime(true);
        try {
            $args = $entrada($n);
            $per = PgBench::timeOne($fn, $args);
        } catch (PorHacer) {
            PgHarness::emit(['t' => 'bench', 'name' => $name, 'status' => 'todo']);
            return;
        } catch (Throwable $e) {
            PgHarness::emit(['t' => 'bench', 'name' => $name, 'status' => 'error', 'msg' => get_class($e) . ': ' . $e->getMessage(), 'line' => $e->getLine()]);
            return;
        }
        $points[] = [$n, $per];
        $spent += (hrtime(true) - $t0) / 1e6;
        if ($per > 250) {
            $stopped = 'slow';  // una sola llamada ya tarda más de 250 ms
            break;
        }
        if ($spent > PgHarness::$benchBudgetMs) {
            $stopped = 'budget';
            break;
        }
    }

    $fit = PgBench::fit($points, $escala);
    PgHarness::emit([
        't' => 'bench', 'name' => $name, 'status' => 'ok', 'scale' => $escala, 'stopped' => $stopped,
        'points' => array_map(static fn($p) => [$p[0], round($p[1], 6)], $points),
    ] + $fit);
}

/** Cronometraje y ajuste de modelos de complejidad. */
final class PgBench
{
    /** Milisegundos por llamada (mínimo de varias tandas, para filtrar el ruido). */
    public static function timeOne(callable $fn, array $args): float
    {
        $t0 = hrtime(true);
        $fn(...$args);
        $first = (hrtime(true) - $t0) / 1e6;
        if ($first > 50) {
            return $first;
        }
        if ($first > 2) {
            $best = $first;
            for ($i = 0; $i < 2; $i++) {
                $t0 = hrtime(true);
                $fn(...$args);
                $best = min($best, (hrtime(true) - $t0) / 1e6);
            }
            return $best;
        }
        $k = (int) min(200000, max(1, ceil(2.0 / max($first, 0.0005))));
        $best = INF;
        for ($tanda = 0; $tanda < 5; $tanda++) {
            $t0 = hrtime(true);
            for ($i = 0; $i < $k; $i++) {
                $fn(...$args);
            }
            $best = min($best, (hrtime(true) - $t0) / 1e6 / $k);
        }
        return $best;
    }

    /**
     * Elige el modelo (1, log n, n, n log n, n², n³, 2ⁿ) cuyo cociente t/f(n) es más constante.
     *
     * @param list<array{0:int,1:float}> $points [n, ms]
     * @return array{model:?string, label:?string, sd:?float, slope:?float}
     */
    public static function fit(array $points, string $escala = 'geometrica'): array
    {
        $pts = array_values(array_filter($points, static fn($p) => $p[0] >= 2));
        if (count($pts) < 3) {
            return ['model' => null, 'label' => null, 'sd' => null, 'slope' => null];
        }
        $models = [
            '1' => ['O(1)', static fn(float $n) => 0.0],
            'log' => ['O(log n)', static fn(float $n) => log(log($n))],
            'n' => ['O(n)', static fn(float $n) => log($n)],
            'nlogn' => ['O(n log n)', static fn(float $n) => log($n) + log(log($n))],
            'n2' => ['O(n²)', static fn(float $n) => 2 * log($n)],
            'n3' => ['O(n³)', static fn(float $n) => 3 * log($n)],
            'exp' => ['O(2ⁿ)', static fn(float $n) => $n * M_LN2],
        ];
        $best = null;
        $bestSd = INF;
        foreach ($models as $key => [$label, $lf]) {
            $r = [];
            foreach ($pts as [$n, $t]) {
                $r[] = log(max($t, 1e-7)) - $lf((float) $n);
            }
            $mean = array_sum($r) / count($r);
            $sd = sqrt(array_sum(array_map(static fn($x) => ($x - $mean) ** 2, $r)) / count($r));
            // Un modelo más complejo debe ajustar claramente mejor para ganar
            if ($best === null || $sd < $bestSd * 0.85) {
                $best = $key;
                $bestSd = $sd;
            }
        }

        // Pendiente log-log: el exponente aproximado
        $xs = array_map(static fn($p) => log((float) $p[0]), $pts);
        $ys = array_map(static fn($p) => log(max($p[1], 1e-7)), $pts);
        $mx = array_sum($xs) / count($xs);
        $my = array_sum($ys) / count($ys);
        $num = $den = 0.0;
        foreach ($xs as $i => $x) {
            $num += ($x - $mx) * ($ys[$i] - $my);
            $den += ($x - $mx) ** 2;
        }
        $slope = $den > 0 ? $num / $den : null;

        return [
            'model' => $best, 'label' => $models[$best][0], 'sd' => round($bestSd, 3),
            'slope' => $slope !== null ? round($slope, 2) : null,
        ];
    }
}
