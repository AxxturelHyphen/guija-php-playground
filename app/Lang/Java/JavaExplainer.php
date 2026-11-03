<?php
declare(strict_types=1);

namespace Playground\Lang\Java;

use Playground\Core\Explains;

defined('PG_ROOT') or exit;

/**
 * Explicador PROVISIONAL de Java (el definitivo, con traducción de los compiler.err.*, es del encargo 4):
 * por ahora da títulos útiles en español para los errores más comunes y deja el mensaje original.
 */
final class JavaExplainer implements Explains
{
    /** compiler.err.<código> → título */
    private const TITULOS = [
        'expected' => 'Falta algo en la sintaxis',
        'expected2' => 'Falta algo en la sintaxis',
        'expected3' => 'Falta algo en la sintaxis',
        'premature.eof' => 'El archivo termina antes de tiempo (falta cerrar una llave)',
        'illegal.start.of.expr' => 'Aquí no puede empezar una expresión',
        'illegal.start.of.type' => 'Aquí no puede empezar un tipo',
        'not.stmt' => 'Esto no es una sentencia válida',
        'cant.resolve' => 'No se encuentra un nombre (variable, método o clase)',
        'cant.resolve.location' => 'No se encuentra un nombre (variable, método o clase)',
        'cant.resolve.location.args' => 'No se encuentra ese método',
        'cant.apply.symbol' => 'Los argumentos no encajan con el método',
        'incompatible.types' => 'Tipos incompatibles',
        'prob.found.req' => 'Tipos incompatibles',
        'missing.ret.stmt' => 'Falta un return en este método',
        'var.might.not.have.been.initialized' => 'Variable sin inicializar',
        'already.defined' => 'Ese nombre ya está definido aquí',
        'unreported.exception.need.to.catch.or.throw' => 'Excepción comprobada sin tratar (falta try/catch o throws)',
        'class.public.should.be.in.file' => 'La clase pública debe estar en un archivo con su nombre',
        'non-static.cant.be.ref' => 'Un método o variable no estático no se puede usar desde un contexto estático',
    ];

    public function __construct(private readonly string $code)
    {
    }

    public function explain(array $ev): array
    {
        $kind = (string) ($ev['kind'] ?? 'exception');
        $line = max(1, (int) ($ev['line'] ?? 1));
        $msg = (string) ($ev['msg'] ?? '');
        $first = trim(explode("\n", $msg)[0]);
        $base = ['severity' => 'error', 'line' => $line, 'col' => 1, 'endLine' => $line, 'endCol' => 1000, 'explain' => '', 'original' => $msg];
        if (isset($ev['trace'])) {
            $base['trace'] = $ev['trace'];
        }
        switch ($kind) {
            case 'parse':
                $c = preg_replace('/^compiler\.(err|warn)\./', '', (string) ($ev['code'] ?? ''));
                $title = self::TITULOS[$c] ?? ($first !== '' ? $first : 'Error de compilación');
                $col = max(1, (int) ($ev['col'] ?? 1));
                return ['source' => 'syntax', 'code' => 'compile.' . $c, 'col' => $col, 'endLine' => (int) ($ev['endLine'] ?? $line),
                    'endCol' => max($col + 1, (int) ($ev['endCol'] ?? $col + 1)), 'title' => $title, 'message' => $first] + $base;
            case 'timeout':
                $s = (int) ($ev['limit'] ?? 5);
                return ['source' => 'runtime', 'code' => 'timeout', 'title' => "El programa tardó más de {$s} s y se detuvo", 'message' => $first] + $base;
            case 'stack':
                return ['source' => 'runtime', 'code' => 'stack-overflow', 'title' => 'Desbordamiento de pila (¿recursión sin caso base?)', 'message' => $first] + $base;
            case 'memory':
                return ['source' => 'runtime', 'code' => 'out-of-memory', 'title' => 'Memoria agotada (el límite es 256 MB)', 'message' => $first] + $base;
            default:
                $cls = (string) ($ev['cls'] ?? '');
                $short = str_contains($cls, '.') ? substr($cls, (int) strrpos($cls, '.') + 1) : ($cls !== '' ? $cls : 'Error');
                return ['source' => 'runtime', 'code' => 'exception.' . strtolower($short), 'title' => $short . ($first !== '' ? ': ' . $first : ''), 'message' => $first] + $base;
        }
    }
}
