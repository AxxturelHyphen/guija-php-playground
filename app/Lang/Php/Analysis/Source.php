<?php
declare(strict_types=1);

namespace Playground\Lang\Php\Analysis;

use PhpToken;

defined('PG_ROOT') or exit;

/**
 * Código fuente tokenizado. Todas las posiciones que salen de aquí son 1-based
 * y en unidades UTF-16 (lo que usa Monaco), no en bytes.
 *
 * @phpstan-type Range array{sl:int, sc:int, el:int, ec:int}
 */
final class Source
{
    /** @var list<PhpToken> */
    public readonly array $tokens;
    /** @var list<string> */
    public readonly array $lines;
    /** @var array<int, ?int> índice de token -> índice del siguiente token significativo */
    private array $next = [];
    /** @var array<int, ?int> */
    private array $prev = [];
    /** @var list<int> offset en bytes donde empieza cada línea */
    private array $lineStarts = [0];

    public function __construct(public readonly string $code)
    {
        $this->tokens = PhpToken::tokenize($code);

        $lastSig = null;
        foreach ($this->tokens as $i => $t) {
            $this->prev[$i] = $lastSig;
            if (self::isSignificant($t)) {
                $lastSig = $i;
            }
        }
        $nextSig = null;
        for ($i = count($this->tokens) - 1; $i >= 0; $i--) {
            $this->next[$i] = $nextSig;
            if (self::isSignificant($this->tokens[$i])) {
                $nextSig = $i;
            }
        }

        $offset = 0;
        foreach (explode("\n", $code) as $n => $line) {
            if ($n > 0) {
                $this->lineStarts[] = $offset;
            }
            $offset += strlen($line) + 1;
        }
        $this->lines = array_map(static fn(string $l): string => rtrim($l, "\r"), explode("\n", $code));
    }

    public static function isSignificant(PhpToken $t): bool
    {
        return $t->id !== T_WHITESPACE && $t->id !== T_COMMENT && $t->id !== T_DOC_COMMENT;
    }

    public function count(): int
    {
        return count($this->tokens);
    }

    /** Siguiente token significativo después de $i (o null). */
    public function next(int $i): ?int
    {
        return $this->next[$i] ?? null;
    }

    /** Token significativo anterior a $i (o null). */
    public function prev(int $i): ?int
    {
        return $this->prev[$i] ?? null;
    }

    public function text(?int $i): string
    {
        return $i === null ? '' : ($this->tokens[$i]->text ?? '');
    }

    public function is(?int $i, int|string $what): bool
    {
        if ($i === null || !isset($this->tokens[$i])) {
            return false;
        }
        return is_int($what) ? $this->tokens[$i]->id === $what : $this->tokens[$i]->text === $what;
    }

    public function lineText(int $line): string
    {
        return $this->lines[$line - 1] ?? '';
    }

    public function lineCount(): int
    {
        return count($this->lines);
    }

    /** Línea (1-based) de un offset en bytes. */
    public function lineOf(int $byte): int
    {
        $lo = 0;
        $hi = count($this->lineStarts) - 1;
        while ($lo < $hi) {
            $mid = ($lo + $hi + 1) >> 1;
            if ($this->lineStarts[$mid] <= $byte) {
                $lo = $mid;
            } else {
                $hi = $mid - 1;
            }
        }
        return $lo + 1;
    }

    /** @return array{0:int, 1:int} [línea, columna] 1-based, columna en UTF-16. */
    public function position(int $byte): array
    {
        $line = $this->lineOf($byte);
        $start = $this->lineStarts[$line - 1];
        $prefix = substr($this->code, $start, max(0, $byte - $start));
        return [$line, self::utf16Length($prefix) + 1];
    }

    public static function utf16Length(string $s): int
    {
        if ($s === '' || !preg_match('/[^\x00-\x7F]/', $s)) {
            return strlen($s);
        }
        return intdiv(strlen((string) mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')), 2);
    }

    /** @return array{sl:int, sc:int, el:int, ec:int} */
    public function range(int $fromToken, ?int $toToken = null): array
    {
        $toToken ??= $fromToken;
        [$sl, $sc] = $this->position($this->tokens[$fromToken]->pos);
        $last = $this->tokens[$toToken];
        [$el, $ec] = $this->position($last->pos + strlen($last->text));
        return ['sl' => $sl, 'sc' => $sc, 'el' => $el, 'ec' => $ec];
    }

    /** Rango vacío justo después de un token (para insertar). */
    public function after(int $token): array
    {
        $t = $this->tokens[$token];
        [$l, $c] = $this->position($t->pos + strlen($t->text));
        return ['sl' => $l, 'sc' => $c, 'el' => $l, 'ec' => $c];
    }

    /** Rango vacío justo antes de un token. */
    public function before(int $token): array
    {
        [$l, $c] = $this->position($this->tokens[$token]->pos);
        return ['sl' => $l, 'sc' => $c, 'el' => $l, 'ec' => $c];
    }

    /** Rango que cubre toda la línea $line (sin el salto). */
    public function lineRange(int $line): array
    {
        return ['sl' => $line, 'sc' => 1, 'el' => $line, 'ec' => self::utf16Length($this->lineText($line)) + 1];
    }

    /** Primer y último token significativo de una línea, o null si la línea no tiene código. */
    public function firstTokenOnLine(int $line): ?int
    {
        foreach ($this->tokens as $i => $t) {
            if ($t->line > $line) {
                return null;
            }
            if ($t->line === $line && self::isSignificant($t)) {
                return $i;
            }
        }
        return null;
    }
}
