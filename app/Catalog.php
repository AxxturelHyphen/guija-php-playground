<?php
declare(strict_types=1);

namespace Playground;

use Playground\Analysis\Metrics;

defined('PG_ROOT') or exit;

/**
 * Catálogo para el editor (autocompletado, ayuda de firma y hover):
 * firmas de las funciones nativas (por Reflection, así siempre coinciden con tu versión de PHP)
 * + notas en español, coste O() y equivalente en Java.
 */
final class Catalog
{
    /** Extensiones cuyas funciones se ofrecen (las que un estudiante usa de verdad). */
    private const EXTENSIONS = ['Core', 'standard', 'mbstring', 'json', 'ctype', 'date', 'pcre', 'SPL', 'random'];

    /** @return array<string,mixed> */
    public static function build(): array
    {
        /** @var array<string, array{0:string, 1:?string}> $notes */
        $notes = require __DIR__ . '/data/funciones.php';
        /** @var array{classes: array<string, array{0:string, 1:?string}>, keywords: array<string,string>} $words */
        $words = require __DIR__ . '/data/clases_y_palabras.php';

        $functions = [];
        foreach (get_defined_functions()['internal'] as $name) {
            try {
                $rf = new \ReflectionFunction($name);
            } catch (\ReflectionException) {
                continue;
            }
            if (!in_array($rf->getExtensionName(), self::EXTENSIONS, true) || str_starts_with($name, '_')) {
                continue;
            }
            $functions[$name] = self::describe($rf, $notes[$name] ?? null, Metrics::COSTS[$name] ?? null);
        }

        // Las funciones del playground (definidas en el harness, no en una extensión)
        foreach (['pendiente', 'prueba', 'comprueba', 'lanza', 'grupo', 'medir'] as $name) {
            $functions[$name] = self::playground($name, $notes[$name]);
        }
        ksort($functions);

        $classes = [];
        foreach ($words['classes'] as $name => [$desc, $java]) {
            $classes[$name] = ['d' => $desc] + ($java !== null ? ['j' => $java] : []);
        }

        return [
            'php' => PHP_VERSION,
            'functions' => $functions,
            'classes' => $classes,
            'keywords' => $words['keywords'],
        ];
    }

    /**
     * @param array{0:string, 1:?string}|null $note
     * @param array{0:int, 1:int}|null $cost
     * @return array<string,mixed>
     */
    private static function describe(\ReflectionFunction $rf, ?array $note, ?array $cost): array
    {
        $params = [];
        $required = 0;
        foreach ($rf->getParameters() as $p) {
            $s = '';
            if ($p->hasType()) {
                $s .= $p->getType() . ' ';
            }
            $s .= ($p->isPassedByReference() ? '&' : '') . ($p->isVariadic() ? '...' : '') . '$' . $p->getName();
            if ($p->isOptional() && !$p->isVariadic()) {
                $s .= ' = ' . self::defaultOf($p);
            } elseif (!$p->isOptional()) {
                $required++;
            }
            $params[] = $s;
        }
        $ret = $rf->hasReturnType() ? ': ' . $rf->getReturnType() : '';
        $out = ['p' => $params, 'r' => $required, 'ret' => $ret];
        if ($note !== null) {
            $out['d'] = $note[0];
            if ($note[1] !== null) {
                $out['j'] = $note[1];
            }
        }
        if ($cost !== null) {
            $out['o'] = Metrics::label(['a' => $cost[0], 'b' => $cost[1], 'exp' => null]);
        }
        return $out;
    }

    private static function defaultOf(\ReflectionParameter $p): string
    {
        try {
            if ($p->isDefaultValueConstant()) {
                return (string) $p->getDefaultValueConstantName();
            }
            if ($p->isDefaultValueAvailable()) {
                $v = $p->getDefaultValue();
                return match (true) {
                    $v === null => 'null',
                    is_bool($v) => $v ? 'true' : 'false',
                    is_string($v) => "'" . addcslashes($v, "'\\\n\r") . "'",
                    is_array($v) => $v === [] ? '[]' : '[...]',
                    default => var_export($v, true),
                };
            }
        } catch (\Throwable) {
        }
        return '…';
    }

    /** @param array{0:string, 1:?string} $note */
    private static function playground(string $name, array $note): array
    {
        $sig = [
            'pendiente' => [['string $mensaje = \'…\''], 0, ': never'],
            'prueba' => [['string|callable $fn', 'array $casos', '?callable $comparador = null', 'bool $sinOrden = false'], 2, ': void'],
            'comprueba' => [['string $descripcion', 'callable $fn', 'mixed $esperado = true', 'bool $sinOrden = false'], 2, ': void'],
            'lanza' => [['string $descripcion', 'callable $fn', 'string $excepcion = Throwable::class'], 2, ': void'],
            'grupo' => [['string $nombre'], 1, ': void'],
            'medir' => [['string|callable $fn', 'callable $entrada', "string \$escala = 'geometrica'", '?array $tamanos = null', '?string $etiqueta = null'], 2, ': void'],
        ][$name];
        return ['p' => $sig[0], 'r' => $sig[1], 'ret' => $sig[2], 'd' => $note[0], 'pg' => true];
    }
}
