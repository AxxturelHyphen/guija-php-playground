<?php
declare(strict_types=1);
require dirname(__DIR__) . '/app/bootstrap.php';
use Playground\Core\{Languages, Solutions};

$solutions = new Solutions(Languages::get('php'));

$user = <<<'PHP'
<?php
declare(strict_types=1);

// Teoría: esto no se toca
const LIMITE = 10;

/** Mi versión: todavía sin hacer */
function fibonacci(int $n): int
{
    pendiente();
}

final class Pila
{
    public function __construct(private array $items = [])
    {
    }
}

function otra(): string { return 'intacta'; }

echo fibonacci(5), otra(), "\n";
PHP;

$sol = <<<'PHP'
<?php
declare(strict_types=1);

/**
 * Fibonacci iterativo.
 *
 * @complejidad Tiempo O(n), espacio O(1).
 * @explicacion Guarda solo los dos
 * últimos valores.
 * @alternativas Recursiva ingenua: O(2^n).
 * @bigo n
 */
function fibonacci(int $n): int
{
    [$a, $b] = [0, 1];
    for ($i = 0; $i < $n; $i++) {
        [$a, $b] = [$b, $a + $b];
    }
    return $a;
}

function ayuda(int $x): int { return $x * 2; }

final class Pila
{
    private array $items = [];
    public function push(mixed $x): void { $this->items[] = $x; }
}
PHP;

$spliced = $solutions->splice($user, $sol);
file_put_contents(sys_get_temp_dir() . '/pgsplice.php', $spliced);
exec(escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg(sys_get_temp_dir() . '/pgsplice.php') . ' 2>&1', $o, $rc);
echo "php -l del resultado: ", $o[0] ?? '', "\n";
$run = shell_exec(escapeshellarg(PHP_BINARY) . ' -d auto_prepend_file=' . escapeshellarg(PG_ROOT . '/app/Lang/Php/harness.php') . ' ' . escapeshellarg(sys_get_temp_dir() . '/pgsplice.php') . ' 2>&1');
$runText = trim((string) preg_replace('/\x1ePG.*?\x1f/s', '', (string) $run));
echo "ejecución: ", $runText, "  (esperado: 5intacta)\n";
echo $runText === '5intacta' ? "ok   el código empalmado se ejecuta y da 5intacta\n" : "FAIL el código empalmado no da 5intacta\n";
echo $rc === 0 ? "ok   el resultado no tiene errores de sintaxis\n" : "FAIL el resultado tiene errores de sintaxis\n";
echo str_contains($spliced, 'LIMITE = 10') && str_contains($spliced, "'intacta'") ? "ok   teoría y funciones no tocadas se conservan\n" : "FAIL se perdió código del usuario\n";
echo !str_contains($spliced, 'pendiente()') ? "ok   fibonacci sustituida\n" : "FAIL sigue el pendiente()\n";
echo str_contains($spliced, 'function ayuda') ? "ok   auxiliar añadida\n" : "FAIL falta la auxiliar\n";
echo substr_count($spliced, 'class Pila') === 1 ? "ok   clase sustituida (no duplicada)\n" : "FAIL clase duplicada\n";

$cmp = $solutions->compare($user, $sol);
foreach ($cmp as $i) {
    printf("  %-14s implementada=%s igual=%s bigo=%s | %s\n", $i['name'], var_export($i['implemented'], true), var_export($i['same'], true), $i['doc']['bigo'] ?? '-', str_replace("\n", ' ', $i['doc']['explicacion'] ?? ''));
}
unlink(sys_get_temp_dir() . '/pgsplice.php');
