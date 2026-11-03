<?php
declare(strict_types=1);

namespace Playground\Lang\Python;

use Playground\Core\Explains;
use Playground\Core\Language;

defined('PG_ROOT') or exit;

/** ESQUELETO TEMPORAL: el motor de Python se implementa en su fase (ver el plan). */
final class PythonLanguage extends Language
{
    public function id(): string
    {
        return 'python';
    }

    public function name(): string
    {
        return 'Python';
    }

    public function ext(): string
    {
        return 'py';
    }

    public function meta(): array
    {
        return ['version' => null, 'ok' => false, 'missing' => [['what' => 'Motor de Python', 'how' => 'En construcción.']]];
    }

    public function catalog(): array
    {
        return ['functions' => [], 'classes' => [], 'keywords' => []];
    }

    public function analyse(string $code): array
    {
        return ['syntax' => false, 'diagnostics' => [], 'units' => [], 'summary' => ['loc' => 0, 'functions' => 0, 'ccTotal' => 0, 'ccMax' => 0, 'ccAvg' => 0, 'grade' => 'A', 'worst' => null, 'maxNesting' => 0]];
    }

    public function syntaxError(string $code): ?array
    {
        return null;
    }

    public function run(string $code, string $displayName, array $opts = []): array
    {
        return ['items' => [['t' => 'ev', 'ev' => ['t' => 'note', 'text' => 'El motor de Python aún no está disponible.']]], 'exit' => 1, 'killed' => null, 'wallMs' => 0, 'truncated' => false, 'timeout' => 5];
    }

    public function explainer(string $code): Explains
    {
        return new class implements Explains {
            public function explain(array $ev): array
            {
                $line = max(1, (int) ($ev['line'] ?? 1));
                return ['source' => 'runtime', 'severity' => 'error', 'code' => 'generic', 'line' => $line, 'col' => 1, 'endLine' => $line, 'endCol' => 1000,
                    'title' => (string) ($ev['msg'] ?? 'Error'), 'message' => (string) ($ev['msg'] ?? 'Error'), 'explain' => '', 'original' => (string) ($ev['msg'] ?? '')];
            }
        };
    }

    public function declarations(string $code): array
    {
        return [];
    }

    public function insertionPoint(string $code, array $decl): int
    {
        return strlen($code);
    }
}
