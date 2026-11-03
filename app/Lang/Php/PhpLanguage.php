<?php
declare(strict_types=1);

namespace Playground\Lang\Php;

use Playground\Core\Explains;
use Playground\Core\Language;
use Playground\Lang\Php\Analysis\{Hints, Metrics, Parser, Source};

defined('PG_ROOT') or exit;

/** PHP: se ejecuta con el mismo php.exe que sirve el playground. */
final class PhpLanguage extends Language
{
    public function id(): string
    {
        return 'php';
    }

    public function name(): string
    {
        return 'PHP';
    }

    public function ext(): string
    {
        return 'php';
    }

    public function meta(): array
    {
        $notes = [];
        if (PHP_VERSION_ID < 80500) {
            $notes[] = 'La lección 01 usa sintaxis de PHP 8.4/8.5 (visibilidad asimétrica, property hooks, |>): con PHP ' . PHP_VERSION . ' esa lección da error de sintaxis. El resto funciona.';
        }
        return ['version' => PHP_VERSION, 'ok' => true, 'missing' => [], 'notes' => $notes];
    }

    public function catalog(): array
    {
        return Catalog::build();
    }

    public function analyse(string $code): array
    {
        $src = new Source($code);
        $parser = new Parser($src);
        $explainer = new Explainer($src, $parser);
        $metrics = new Metrics($src, $parser);
        $result = $metrics->compute();

        $syntax = $this->syntaxError($code);
        $diags = [];
        $syntaxLines = [];
        if ($syntax !== null) {
            $d = $explainer->explain($syntax);
            $diags[] = $d;
            $syntaxLines[(int) $d['line']] = (string) ($d['code'] ?? '');
        }
        foreach ((new Hints($src, $parser, $metrics, $result['units']))->all() as $h) {
            // El error de sintaxis ya explica el java-ismo de esa línea: no se repite como pista
            if (isset($syntaxLines[(int) $h['line']]) && str_starts_with((string) $h['code'], 'java.')
                && str_starts_with($syntaxLines[(int) $h['line']], 'parse.')) {
                continue;
            }
            $diags[] = $h;
        }
        return ['syntax' => $syntax !== null, 'diagnostics' => $diags, 'units' => $result['units'], 'summary' => $result['summary']];
    }

    public function syntaxError(string $code): ?array
    {
        return PhpRunner::syntaxError($code);
    }

    public function run(string $code, string $displayName, array $opts = []): array
    {
        return (new PhpRunner())->run($code, $displayName, $opts);
    }

    public function explainer(string $code): Explains
    {
        $src = new Source($code);
        return new Explainer($src, new Parser($src));
    }

    public function declarations(string $code): array
    {
        $parser = new Parser(new Source($code));
        $out = [];
        foreach ($parser->decls as $d) {
            $out[$d->key] = [
                'key' => $d->key, 'name' => $d->name, 'kind' => $d->kind, 'line' => $d->line, 'endLine' => $d->endLine,
                'start' => $d->startByte, 'end' => $d->endByte, 'doc' => $d->doc,
                'norm' => self::normalize(substr($code, $d->startByte, $d->endByte - $d->startByte)),
            ];
        }
        return $out;
    }

    /** Tras `declare(strict_types=1);` (debe ser la primera instrucción) o tras la etiqueta de apertura. */
    public function insertionPoint(string $code, array $decl): int
    {
        $src = new Source($code);
        $parser = new Parser($src);
        $anchor = $parser->strictTypesToken() ?? $parser->openTagToken();
        return $anchor === null ? 0 : $src->tokens[$anchor]->pos + strlen($src->tokens[$anchor]->text);
    }

    /** Texto del código sin espacios ni comentarios: para saber si dos versiones son la misma. */
    public static function normalize(string $code): string
    {
        $out = '';
        foreach (\PhpToken::tokenize("<?php\n" . $code) as $t) {
            if ($t->id !== T_WHITESPACE && $t->id !== T_COMMENT && $t->id !== T_DOC_COMMENT && $t->id !== T_OPEN_TAG) {
                $out .= $t->text . ' ';
            }
        }
        return $out;
    }
}
