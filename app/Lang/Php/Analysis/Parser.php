<?php
declare(strict_types=1);

namespace Playground\Lang\Php\Analysis;

use PhpToken;

defined('PG_ROOT') or exit;

/** Una función, método o el código suelto del archivo ("{main}"). */
final class Unit
{
    /** @var list<array{name:string, typed:bool, line:int, byRef:bool, variadic:bool, promoted:bool, hasDefault:bool, token:int}> */
    public array $params = [];

    public function __construct(
        public string $name,
        public string $kind,          // function | method | main
        public ?string $class,
        public int $head,             // índice del token `function` (-1 en main)
        public int $nameToken,
        public int $parenOpen,
        public int $parenClose,
        public int $open,             // `{` del cuerpo (-1 si no tiene: abstracto / interfaz)
        public int $close,
        public bool $hasReturnType,
        public int $startLine,
        public int $endLine,
    ) {
    }

    public function qname(): string
    {
        return $this->class !== null ? $this->class . '::' . $this->name : $this->name;
    }

    public function hasBody(): bool
    {
        return $this->open >= 0;
    }
}

/** Declaración de primer nivel que se puede sustituir entera: función, clase, interfaz, trait o enum. */
final class Decl
{
    public function __construct(
        public string $key,           // "function:suma" | "type:Cuenta"
        public string $kind,          // function | class | interface | trait | enum
        public string $name,
        public int $startToken,       // incluye docblock, atributos y modificadores
        public int $endToken,         // llave de cierre
        public int $startByte,
        public int $endByte,
        public ?string $doc,
        public int $line,             // línea de la palabra clave
        public int $endLine,
    ) {
    }
}

/**
 * Recorre los tokens y extrae la estructura: unidades (funciones/métodos), clases y declaraciones.
 * Tolera código con errores de sintaxis: lo que no entiende lo ignora en vez de fallar.
 */
final class Parser
{
    /** @var array<int,int> llave/paréntesis/corchete de apertura -> índice de su cierre */
    public array $braceMatch = [];
    public array $parenMatch = [];
    public array $bracketMatch = [];
    /** @var array<int,int> cierre -> apertura (solo corchetes, para localizar atributos) */
    private array $bracketOpenOf = [];

    /** @var list<Unit> */
    public array $units = [];
    /** @var list<array{name:string, kind:string, open:int, close:int, line:int, endLine:int, anonymous:bool, nameToken:int}> */
    public array $classes = [];
    /** @var list<Decl> */
    public array $decls = [];
    /** @var array<int,int> token -> índice en $units de la unidad que lo contiene (-1 = main) */
    public array $owner = [];
    /** Llaves sin cerrar / sobrantes: [tipo, índice de token] */
    public array $unbalanced = [];

    public function __construct(public readonly Source $src)
    {
        $this->matchBrackets();
        $this->scan();
        $this->assignOwners();
    }

    private function matchBrackets(): void
    {
        $braces = $parens = $brackets = [];
        foreach ($this->src->tokens as $i => $t) {
            switch (true) {
                case $t->text === '{' || $t->id === T_CURLY_OPEN || $t->id === T_DOLLAR_OPEN_CURLY_BRACES:
                    $braces[] = $i;
                    break;
                case $t->text === '}':
                    if ($braces) {
                        $this->braceMatch[array_pop($braces)] = $i;
                    } else {
                        $this->unbalanced[] = ['}', $i];
                    }
                    break;
                case $t->text === '(':
                    $parens[] = $i;
                    break;
                case $t->text === ')':
                    if ($parens) {
                        $this->parenMatch[array_pop($parens)] = $i;
                    } else {
                        $this->unbalanced[] = [')', $i];
                    }
                    break;
                case $t->text === '[' || $t->id === T_ATTRIBUTE:
                    $brackets[] = $i;
                    break;
                case $t->text === ']':
                    if ($brackets) {
                        $open = array_pop($brackets);
                        $this->bracketMatch[$open] = $i;
                        $this->bracketOpenOf[$i] = $open;
                    } else {
                        $this->unbalanced[] = [']', $i];
                    }
                    break;
            }
        }
        foreach ($braces as $i) {
            $this->unbalanced[] = ['{', $i];
        }
        foreach ($parens as $i) {
            $this->unbalanced[] = ['(', $i];
        }
        foreach ($brackets as $i) {
            $this->unbalanced[] = ['[', $i];
        }
    }

    private function scan(): void
    {
        $src = $this->src;
        $tokens = $src->tokens;
        $n = count($tokens);
        $depth = 0;
        /** @var list<array{name:string, close:int}> $classStack */
        $classStack = [];

        for ($i = 0; $i < $n; $i++) {
            $t = $tokens[$i];
            while ($classStack && $classStack[array_key_last($classStack)]['close'] < $i) {
                array_pop($classStack);
            }

            if ($t->id === T_CLASS || $t->id === T_INTERFACE || $t->id === T_TRAIT || $t->id === T_ENUM) {
                $this->scanClassLike($i, $depth, $classStack);
            } elseif ($t->id === T_FUNCTION) {
                $this->scanFunction($i, $depth, $classStack);
            }

            if ($t->text === '{' || $t->id === T_CURLY_OPEN || $t->id === T_DOLLAR_OPEN_CURLY_BRACES) {
                $depth++;
            } elseif ($t->text === '}') {
                $depth = max(0, $depth - 1);
            }
        }
    }

    /** @param list<array{name:string, close:int}> $classStack */
    private function scanClassLike(int $i, int $depth, array &$classStack): void
    {
        $src = $this->src;
        $t = $src->tokens[$i];
        $prev = $src->prev($i);

        if ($t->id === T_CLASS) {
            if ($src->is($prev, T_DOUBLE_COLON)) {
                return; // Foo::class
            }
            $beforeKw = $src->is($prev, T_READONLY) ? $src->prev($prev) : $prev;
            $anonymous = $src->is($beforeKw, T_NEW);
        } else {
            $anonymous = false;
        }

        $nameTok = $anonymous ? $i : $src->next($i);
        if (!$anonymous && ($nameTok === null || $src->tokens[$nameTok]->id !== T_STRING)) {
            return;
        }
        $name = $anonymous ? 'class@anonymous' : $src->tokens[$nameTok]->text;

        // La llave de apertura: salta los argumentos del constructor anónimo y extends/implements.
        $j = $src->next($i);
        $open = null;
        while ($j !== null) {
            $tx = $src->tokens[$j]->text;
            if ($tx === '(' && isset($this->parenMatch[$j])) {
                $j = $src->next($this->parenMatch[$j]);
                continue;
            }
            if ($tx === '{') {
                $open = $j;
                break;
            }
            if ($tx === ';') {
                break;
            }
            $j = $src->next($j);
        }
        if ($open === null) {
            return;
        }
        $close = $this->braceMatch[$open] ?? ($src->count() - 1);
        $kind = match ($t->id) {
            T_CLASS => 'class',
            T_INTERFACE => 'interface',
            T_TRAIT => 'trait',
            default => 'enum',
        };
        $endLine = $src->tokens[$close]->line;
        $this->classes[] = [
            'name' => $name, 'kind' => $kind, 'open' => $open, 'close' => $close,
            'line' => $t->line, 'endLine' => $endLine, 'anonymous' => $anonymous, 'nameToken' => $nameTok,
        ];
        $classStack[] = ['name' => $name, 'close' => $close];

        if ($depth === 0 && !$anonymous && isset($this->braceMatch[$open])) {
            $start = $this->declStart($i);
            $this->decls[] = new Decl(
                'type:' . strtolower($name), $kind, $name, $start, $close,
                $src->tokens[$start]->pos, $src->tokens[$close]->pos + 1,
                $src->tokens[$start]->id === T_DOC_COMMENT ? $src->tokens[$start]->text : $this->docBefore($start),
                $t->line, $endLine,
            );
        }
    }

    /** @param list<array{name:string, close:int}> $classStack */
    private function scanFunction(int $i, int $depth, array $classStack): void
    {
        $src = $this->src;
        $prev = $src->prev($i);
        if ($src->is($prev, T_USE)) {
            return; // use function foo\bar;
        }
        $a = $src->next($i);
        if ($src->is($a, '&')) {
            $a = $src->next($a);
        }
        if ($a === null || $src->is($a, '(')) {
            return; // closure
        }
        if (!preg_match('/^[A-Za-z_]\w*$/', $src->tokens[$a]->text)) {
            return;
        }
        $po = $src->next($a);
        if (!$src->is($po, '(') || !isset($this->parenMatch[$po])) {
            return;
        }
        $pc = $this->parenMatch[$po];
        $after = $src->next($pc);
        $hasReturn = $src->is($after, ':');

        $j = $after;
        while ($j !== null && $src->tokens[$j]->text !== '{' && $src->tokens[$j]->text !== ';') {
            $j = $src->next($j);
        }
        $open = $src->is($j, '{') ? $j : -1;
        $close = $open >= 0 ? ($this->braceMatch[$open] ?? $src->count() - 1) : -1;
        $class = $classStack ? $classStack[array_key_last($classStack)]['name'] : null;

        $head = $i;
        $unit = new Unit(
            $src->tokens[$a]->text, $class !== null ? 'method' : 'function', $class,
            $head, $a, $po, $pc, $open, $close, $hasReturn,
            $src->tokens[$i]->line,
            $close >= 0 ? $src->tokens[$close]->line : ($j !== null ? $src->tokens[$j]->line : $src->tokens[$i]->line),
        );
        $unit->params = $this->parseParams($po, $pc);
        $this->units[] = $unit;

        if ($class === null && $depth === 0 && $open >= 0 && $close > $open) {
            $start = $this->declStart($i);
            $this->decls[] = new Decl(
                'function:' . strtolower($unit->name), 'function', $unit->name, $start, $close,
                $src->tokens[$start]->pos, $src->tokens[$close]->pos + 1,
                $src->tokens[$start]->id === T_DOC_COMMENT ? $src->tokens[$start]->text : $this->docBefore($start),
                $src->tokens[$i]->line, $unit->endLine,
            );
        }
    }

    /** @return list<array{name:string, typed:bool, line:int, byRef:bool, variadic:bool, promoted:bool, hasDefault:bool, token:int}> */
    /** Texto del parámetro tal como está escrito (espacios normalizados). @param list<int> $seg */
    private function segmentText(array $seg): string
    {
        $first = $this->src->tokens[$seg[0]];
        $last = $this->src->tokens[$seg[array_key_last($seg)]];
        $text = substr($this->src->code, $first->pos, $last->pos + strlen($last->text) - $first->pos);
        return trim((string) preg_replace('/\s+/', ' ', $text));
    }

    private function parseParams(int $po, int $pc): array
    {
        $src = $this->src;
        $params = [];
        $segments = [[]];
        $depth = 0;
        for ($i = $src->next($po); $i !== null && $i < $pc; $i = $src->next($i)) {
            $t = $src->tokens[$i];
            if ($t->text === '(' || $t->text === '[' || $t->text === '{' || $t->id === T_ATTRIBUTE) {
                $depth++;
            } elseif ($t->text === ')' || $t->text === ']' || $t->text === '}') {
                $depth--;
            }
            if ($t->text === ',' && $depth === 0) {
                $segments[] = [];
                continue;
            }
            $segments[array_key_last($segments)][] = $i;
        }

        $modifiers = [T_PUBLIC, T_PROTECTED, T_PRIVATE, T_READONLY];
        foreach ($segments as $seg) {
            if (!$seg) {
                continue;
            }
            $typed = false;
            $promoted = false;
            $byRef = false;
            $variadic = false;
            $varTok = null;
            $hasDefault = false;
            $attrDepth = 0;
            foreach ($seg as $idx) {
                $t = $src->tokens[$idx];
                if ($t->id === T_ATTRIBUTE) {
                    $attrDepth++;
                    continue;
                }
                if ($attrDepth > 0) {
                    if ($t->text === ']') {
                        $attrDepth--;
                    }
                    continue;
                }
                if ($t->id === T_VARIABLE) {
                    $varTok = $idx;
                    continue;
                }
                if ($varTok !== null) {
                    if ($t->text === '=') {
                        $hasDefault = true;
                    }
                    continue;
                }
                if (in_array($t->id, $modifiers, true)) {
                    $promoted = true;
                } elseif ($t->text === '&') {
                    $byRef = true;
                } elseif ($t->id === T_ELLIPSIS) {
                    $variadic = true;
                } else {
                    $typed = true;
                }
            }
            if ($varTok !== null) {
                $params[] = [
                    'name' => $src->tokens[$varTok]->text, 'typed' => $typed, 'line' => $src->tokens[$varTok]->line,
                    'byRef' => $byRef, 'variadic' => $variadic, 'promoted' => $promoted, 'hasDefault' => $hasDefault,
                    'token' => $varTok,
                    'text' => $this->segmentText($seg),
                ];
            }
        }
        return $params;
    }

    /** Primer token de una declaración: sube por modificadores, atributos y el docblock inmediato. */
    private function declStart(int $kw): int
    {
        $src = $this->src;
        $start = $kw;
        while (true) {
            $p = $src->prev($start);
            if ($p === null) {
                break;
            }
            $t = $src->tokens[$p];
            if ($t->id === T_ABSTRACT || $t->id === T_FINAL || $t->id === T_READONLY) {
                $start = $p;
                continue;
            }
            if ($t->text === ']' && isset($this->bracketOpenOf[$p]) && $src->tokens[$this->bracketOpenOf[$p]]->id === T_ATTRIBUTE) {
                $start = $this->bracketOpenOf[$p];
                continue;
            }
            break;
        }
        for ($k = $start - 1; $k >= 0; $k--) {
            $id = $src->tokens[$k]->id;
            if ($id === T_WHITESPACE) {
                continue;
            }
            if ($id === T_DOC_COMMENT) {
                return $k;
            }
            break;
        }
        return $start;
    }

    private function docBefore(int $start): ?string
    {
        for ($k = $start - 1; $k >= 0; $k--) {
            $id = $this->src->tokens[$k]->id;
            if ($id === T_WHITESPACE) {
                continue;
            }
            return $id === T_DOC_COMMENT ? $this->src->tokens[$k]->text : null;
        }
        return null;
    }

    private function assignOwners(): void
    {
        $n = $this->src->count();
        $this->owner = array_fill(0, $n, -1);
        foreach ($this->units as $u => $unit) {
            $end = $unit->close >= 0 ? $unit->close : $unit->parenClose;
            for ($i = $unit->head; $i <= $end && $i < $n; $i++) {
                $this->owner[$i] = $u;
            }
        }
    }

    /** Unidad que contiene una línea (la más interna), o null si es código suelto. */
    public function unitAtLine(int $line): ?Unit
    {
        $best = null;
        foreach ($this->units as $u) {
            if ($u->startLine <= $line && $line <= $u->endLine) {
                if ($best === null || $u->startLine >= $best->startLine) {
                    $best = $u;
                }
            }
        }
        return $best;
    }

    /** Clase (la más interna) que contiene una línea. */
    public function classAtLine(int $line): ?array
    {
        $best = null;
        foreach ($this->classes as $c) {
            if ($c['line'] <= $line && $line <= $c['endLine']) {
                if ($best === null || $c['line'] >= $best['line']) {
                    $best = $c;
                }
            }
        }
        return $best;
    }

    /** Nombres de métodos declarados en una clase (para "¿quisiste decir…?"). */
    public function methodsOf(string $class): array
    {
        $out = [];
        foreach ($this->units as $u) {
            if ($u->kind === 'method' && strcasecmp((string) $u->class, $class) === 0) {
                $out[] = $u->name;
            }
        }
        return $out;
    }

    /** Índice del `;` de `declare(strict_types=1);` si es la primera instrucción. */
    public function strictTypesToken(): ?int
    {
        $src = $this->src;
        foreach ($src->tokens as $i => $t) {
            if ($t->id === T_DECLARE) {
                $open = $src->next($i);
                if (!$src->is($open, '(') || !isset($this->parenMatch[$open])) {
                    return null;
                }
                $inner = '';
                for ($k = $open + 1; $k < $this->parenMatch[$open]; $k++) {
                    $inner .= $src->tokens[$k]->text;
                }
                if (preg_match('/^\s*strict_types\s*=\s*1\s*$/i', $inner)) {
                    $semi = $src->next($this->parenMatch[$open]);
                    return $src->is($semi, ';') ? $semi : $this->parenMatch[$open];
                }
                continue;
            }
            if ($t->id === T_FUNCTION || $t->id === T_CLASS) {
                return null;
            }
        }
        return null;
    }

    public function openTagToken(): ?int
    {
        foreach ($this->src->tokens as $i => $t) {
            if ($t->id === T_OPEN_TAG || $t->id === T_OPEN_TAG_WITH_ECHO) {
                return $i;
            }
            if ($t->id !== T_WHITESPACE) {
                return null;
            }
        }
        return null;
    }

    /**
     * Fin (índice del último token) de la sentencia que empieza en $s.
     * Entiende bloques, if/elseif/else, bucles, switch, do-while y try/catch/finally.
     */
    public function statementEnd(int $s): int
    {
        $src = $this->src;
        $last = $src->count() - 1;
        $t = $src->tokens[$s];

        if ($t->text === '{') {
            return $this->braceMatch[$s] ?? $last;
        }

        $afterParen = function (int $kw) use ($src): ?int {
            $po = $src->next($kw);
            if (!$src->is($po, '(') || !isset($this->parenMatch[$po])) {
                return null;
            }
            return $src->next($this->parenMatch[$po]);
        };

        switch ($t->id) {
            case T_IF:
                $b = $afterParen($s);
                if ($b === null) {
                    return $s;
                }
                if ($src->is($b, ':')) {
                    return $this->altSyntaxEnd($s, $b);
                }
                $end = $this->statementEnd($b);
                while (true) {
                    $n = $src->next($end);
                    if ($n === null) {
                        break;
                    }
                    if ($src->tokens[$n]->id === T_ELSEIF) {
                        $b = $afterParen($n);
                        if ($b === null) {
                            break;
                        }
                        $end = $this->statementEnd($b);
                    } elseif ($src->tokens[$n]->id === T_ELSE) {
                        $b = $src->next($n);
                        if ($b === null) {
                            break;
                        }
                        if ($src->tokens[$b]->id === T_IF) {
                            $end = $this->statementEnd($b);
                            break; // el if interno ya consumió su cadena
                        }
                        $end = $this->statementEnd($b);
                        break;
                    } else {
                        break;
                    }
                }
                return $end;

            case T_FOR:
            case T_FOREACH:
            case T_WHILE:
            case T_SWITCH:
                $b = $afterParen($s);
                if ($b === null) {
                    return $s;
                }
                if ($src->is($b, ':')) {
                    return $this->altSyntaxEnd($s, $b);
                }
                if ($src->tokens[$b]->text === ';') {
                    return $b; // while (...);
                }
                return $this->statementEnd($b);

            case T_DO:
                $b = $src->next($s);
                if ($b === null) {
                    return $s;
                }
                $end = $this->statementEnd($b);
                $w = $src->next($end);
                if ($src->is($w, T_WHILE)) {
                    $po = $src->next($w);
                    if ($src->is($po, '(') && isset($this->parenMatch[$po])) {
                        $semi = $src->next($this->parenMatch[$po]);
                        return $src->is($semi, ';') ? $semi : $this->parenMatch[$po];
                    }
                }
                return $end;

            case T_TRY:
                $b = $src->next($s);
                if ($b === null) {
                    return $s;
                }
                $end = $this->statementEnd($b);
                while (true) {
                    $n = $src->next($end);
                    if ($n !== null && $src->tokens[$n]->id === T_CATCH) {
                        $b = $afterParen($n);
                        if ($b === null) {
                            break;
                        }
                        $end = $this->statementEnd($b);
                    } elseif ($n !== null && $src->tokens[$n]->id === T_FINALLY) {
                        $b = $src->next($n);
                        if ($b === null) {
                            break;
                        }
                        $end = $this->statementEnd($b);
                        break;
                    } else {
                        break;
                    }
                }
                return $end;
        }

        // Sentencia simple: hasta el `;` al nivel 0 (las llaves de closures y arrays cuentan como nivel).
        $depth = 0;
        for ($i = $s; $i <= $last; $i++) {
            $x = $src->tokens[$i];
            if ($x->text === '(' || $x->text === '[' || $x->text === '{' || $x->id === T_ATTRIBUTE || $x->id === T_CURLY_OPEN || $x->id === T_DOLLAR_OPEN_CURLY_BRACES) {
                $depth++;
            } elseif ($x->text === ')' || $x->text === ']' || $x->text === '}') {
                $depth--;
                if ($depth < 0) {
                    return max($s, $i - 1);
                }
            } elseif ($x->text === ';' && $depth === 0) {
                return $i;
            } elseif ($x->id === T_CLOSE_TAG && $depth === 0) {
                return $i;
            }
        }
        return $last;
    }

    /** Sintaxis alternativa: `if (...): ... endif;` */
    private function altSyntaxEnd(int $kw, int $colon): int
    {
        $src = $this->src;
        $kind = $src->tokens[$kw]->id;
        [$open, $close] = match ($kind) {
            T_IF => [T_IF, T_ENDIF],
            T_FOR => [T_FOR, T_ENDFOR],
            T_FOREACH => [T_FOREACH, T_ENDFOREACH],
            T_WHILE => [T_WHILE, T_ENDWHILE],
            default => [T_SWITCH, T_ENDSWITCH],
        };
        $depth = 0;
        for ($i = $colon; $i < $src->count(); $i++) {
            $id = $src->tokens[$i]->id;
            if ($id === $open && $i !== $kw) {
                $po = $src->next($i);
                $after = $src->is($po, '(') && isset($this->parenMatch[$po]) ? $src->next($this->parenMatch[$po]) : null;
                if ($src->is($after, ':')) {
                    $depth++;
                }
            } elseif ($id === $close) {
                if ($depth === 0) {
                    $semi = $src->next($i);
                    return $src->is($semi, ';') ? $semi : $i;
                }
                $depth--;
            }
        }
        return $src->count() - 1;
    }
}
