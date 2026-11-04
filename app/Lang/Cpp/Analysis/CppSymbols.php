<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp\Analysis;

defined('PG_ROOT') or exit;

/**
 * Símbolos del código del usuario para el hover y el autocompletado: cada variable, parámetro, campo, función, método,
 * tipo, alias, enumerador, constante, lambda y macro que declara, con su tipo, su ámbito y una explicación en español
 * generada a partir del tipo (referencias, punteros, auto deducido, static/constexpr/const, arrays, contenedores…).
 *
 * Forma: {name, kind:'var'|'param'|'field'|'function'|'method'|'type'|'alias'|'enumerator'|'const'|'lambda',
 *         type:?string, decl:string, line, col (UTF-16, 1-based), scope:{sl,el}, cls:?string, fn:?string, doc:?string, detail}
 */
final class CppSymbols
{
    /** @var list<array<string,mixed>> */
    private array $out = [];
    private int $last;
    /** @var array<int,list<array{0:int,1:int}>> clase => rangos de líneas donde se ven sus miembros */
    private array $clsScopes = [];

    public function __construct(private readonly CppCode $c, private readonly CppMetrics $m)
    {
        $this->last = max(1, $c->lineCount());
    }

    /** @return list<array<string,mixed>> */
    public function all(): array
    {
        $c = $this->c;
        $T = $c->t;
        $todo = ['sl' => 1, 'el' => $this->last];
        // ámbitos de cada clase: su cuerpo y los métodos definidos fuera (`int Seg::query(…) {…}`)
        foreach ($c->classes as $ci => $cl) {
            $this->clsScopes[$ci] = [[$T[$cl['open']][3], $T[$cl['close']][3]]];
        }
        foreach ($c->units as $u) {
            if ($u['ci'] !== null && !$u['inClass']) {
                $this->clsScopes[$u['ci']][] = [$T[$u['first']][3], $T[$u['close']][3]];
            }
        }
        $this->macros($todo);
        $this->types($todo);
        $this->functions($todo);
        $this->variables($todo);
        foreach ($c->units as $u => $unit) {
            $this->localsOf($u, $unit);
        }
        $seen = [];
        $res = [];
        foreach ($this->out as $s) {
            $k = $s['name'] . ':' . $s['line'] . ':' . $s['col'] . ':' . $s['scope']['sl'] . ':' . $s['scope']['el'];
            if (!isset($seen[$k])) {
                $seen[$k] = true;
                $res[] = $s;
            }
        }
        usort($res, static fn(array $a, array $b): int => [$a['line'], $a['col']] <=> [$b['line'], $b['col']]);
        return $res;
    }

    // ───────────────────────────── utilidades ─────────────────────────────

    /** @param array{sl:int,el:int} $scope */
    private function add(string $name, string $kind, ?string $type, string $decl, int $tok, array $scope, ?string $cls, ?string $fn, ?string $doc, string $detail): void
    {
        if ($name === '' || $tok < 0 || !isset($this->c->t[$tok])) {
            return;
        }
        $t = $this->c->t[$tok];
        $this->out[] = ['name' => $name, 'kind' => $kind, 'type' => $type, 'decl' => $decl, 'line' => $t[3], 'col' => $this->c->col($t[2], $t[3]),
            'scope' => $scope, 'cls' => $cls, 'fn' => $fn, 'doc' => $doc, 'detail' => trim($detail)];
    }

    /** Un miembro de clase: un símbolo por cada rango donde se ve (el cuerpo y cada método definido fuera). */
    private function addMember(?int $ci, string $name, string $kind, ?string $type, string $decl, int $tok, ?string $cls, ?string $doc, string $detail): void
    {
        foreach ($ci !== null ? ($this->clsScopes[$ci] ?? []) : [[1, $this->last]] as [$sl, $el]) {
            $this->add($name, $kind, $type, $decl, $tok, ['sl' => $sl, 'el' => $el], $cls, null, $doc, $detail);
        }
    }

    /**
     * Documentación: el comentario `/** … *​/` o `///` de encima, el `//` al final de la misma línea o, si $arriba, las
     * líneas `//` justo encima.
     */
    private function doc(int $first, int $nameTok, bool $arriba): ?string
    {
        $c = $this->c;
        $d = $c->docText($c->doc[$first] ?? $c->doc[$nameTok] ?? null);
        if ($d !== null) {
            return $d;
        }
        $t = $c->t[$nameTok];
        $lc = $c->lc[$t[3]] ?? null;
        if ($lc !== null && $lc[0] > $t[2]) {
            return trim((string) preg_replace('~^//+!?\s?~', '', $lc[1])) ?: null;
        }
        if ($arriba) {
            $l = $c->t[$first][3] - 1;
            $lineas = [];
            while ($l >= 1 && isset($c->lc[$l]) && trim(substr($c->code, $c->lineStart($l), $c->lc[$l][0] - $c->lineStart($l))) === '') {
                array_unshift($lineas, trim((string) preg_replace('~^//+!?\s?~', '', $c->lc[$l][1])));
                $l--;
            }
            $s = trim(implode("\n", $lineas));
            return $s !== '' ? $s : null;
        }
        return null;
    }

    private function scopeOfTokens(int $a, int $b): array
    {
        return ['sl' => $this->c->t[$a][3], 'el' => $this->c->t[$b][3]];
    }

    // ───────────────────────────── macros y tipos ─────────────────────────────

    private function macros(array $todo): void
    {
        $c = $this->c;
        foreach ($c->macros as $name => $mc) {
            $doc = null;
            if (preg_match('~//+\s?(.*)$~', explode("\n", $c->pp[$mc['pp']]['text'])[0], $mm)) {
                $doc = trim($mm[1]) ?: null;
            }
            $col = $c->col($mc['off'], $mc['line']);
            if ($mc['params'] !== null) {
                $kind = 'function';
                $detail = 'Macro con parámetros: antes de compilar, el preprocesador copia `' . $mc['value'] . '` sustituyendo los argumentos tal cual. No es una función de verdad: no comprueba tipos y un argumento como `i++` puede evaluarse dos veces. En C++ moderno, mejor una función `inline` o una lambda.';
            } elseif ($mc['type']) {
                $kind = 'alias';
                $detail = 'Macro de tipo: antes de compilar, cada `' . $name . '` se sustituye por `' . $mc['value'] . '`. Funciona, pero `using ' . $name . ' = ' . $mc['value'] . ';` es lo recomendable (respeta ámbitos y el compilador lo entiende como tipo). ' . $this->baseNote($c->info($mc['value']));
            } else {
                $kind = 'const';
                $detail = $mc['value'] === ''
                    ? 'Macro sin valor: solo existe para preguntar por ella con `#ifdef ' . $name . '`.'
                    : 'Macro: antes de compilar, cada `' . $name . '` se sustituye literalmente por `' . $mc['value'] . '`. No tiene tipo ni ámbito; en C++ moderno es preferible `constexpr` (p. ej. `constexpr int ' . $name . ' = ' . $mc['value'] . ';`).';
            }
            $this->out[] = ['name' => $name, 'kind' => $kind, 'type' => $mc['type'] ? $mc['value'] : null,
                'decl' => '#define ' . $name . ($mc['params'] ?? '') . ($mc['value'] !== '' ? ' ' . $mc['value'] : ''),
                'line' => $mc['line'], 'col' => $col, 'scope' => $todo, 'cls' => null, 'fn' => null, 'doc' => $doc, 'detail' => $detail];
        }
    }

    private function types(array $todo): void
    {
        $c = $this->c;
        $T = $c->t;
        foreach ($c->classes as $ci => $cl) {
            if ($cl['name'] === '' || $cl['nameTok'] < 0) {
                continue;
            }
            $kind = $cl['kind'];
            $decl = ($cl['tpl'] !== null ? $c->text($cl['tpl'], $c->templateAngles($cl['tpl'] + 1, $cl['open']) - 1) . ' ' : '') . ($cl['scoped'] ? 'enum class' : $kind) . ' ' . $cl['name'];
            $det = match ($kind) {
                'struct' => '`struct` definido en tu código: agrupa varios campos en un solo tipo (son públicos por defecto).',
                'class' => '`class` definida en tu código: agrupa datos y métodos (son privados por defecto: lo que uses desde fuera va tras `public:`).',
                'union' => '`union`: todos sus campos comparten la misma memoria; solo uno es válido a la vez.',
                default => $cl['scoped']
                    ? 'Enumeración con ámbito (`enum class`): sus valores se escriben `' . $cl['name'] . '::Valor` y no se convierten solos a `int` (hace falta `static_cast<int>(…)`).'
                    : 'Enumeración: constantes con nombre que en el fondo son enteros (0, 1, 2… salvo que les des valor).',
            };
            if ($kind !== 'enum') {
                if ($cl['order'] !== []) {
                    $det .= ' Campos: ' . implode(', ', array_map(static fn($f) => '`' . $f . '`', $cl['order'])) . '.';
                }
                $ops = [];
                foreach ($c->units as $u) {
                    if ($u['ci'] === $ci && $u['op']) {
                        $ops[] = $u['name'];
                    }
                }
                if (in_array('operator<', $ops, true)) {
                    $det .= ' Define `operator<`: se puede ordenar con `sort` y usar como clave de `set`/`map` o en una `priority_queue` sin pasar comparador.';
                }
                if ($cl['tpl'] !== null) {
                    $det .= ' Es una plantilla: se instancia con tipos concretos (`' . $cl['name'] . '<int>`).';
                }
            } else {
                $vals = array_map(static fn($e) => $e['name'], array_filter($c->enumerators, static fn($e) => $e['ci'] === $ci));
                if ($vals !== []) {
                    $det .= ' Valores: ' . implode(', ', array_slice($vals, 0, 8)) . (count($vals) > 8 ? '…' : '') . '.';
                }
                if ($cl['under'] !== null) {
                    $det .= ' Se guarda como `' . $cl['under'] . '`.';
                }
            }
            $this->add($cl['name'], 'type', null, $decl, $cl['nameTok'], $todo, null, null, $this->doc($cl['first'], $cl['nameTok'], true), $det);
        }
        foreach ($c->enumerators as $e) {
            $cl = $c->classes[$e['ci']];
            $q = $cl['scoped'] ? $cl['name'] . '::' . $e['name'] : $e['name'];
            $this->add($e['name'], 'enumerator', $cl['name'], $q . ' = ' . $e['value'], $e['tok'], $todo, $cl['name'], null, $this->doc($e['tok'], $e['tok'], false),
                'Valor de la enumeración `' . $cl['name'] . '`' . ($cl['scoped'] ? ' (se escribe `' . $q . '`)' : '') . '; vale ' . $e['value'] . '.');
        }
        foreach ($c->aliases as $name => $a) {
            if ($a['how'] === 'macro' || $a['tok'] < 0) {
                continue;
            }
            $inLocal = $c->unitAt($a['tok']);
            if ($inLocal !== null) {
                continue;                                       // los alias locales salen con los locales
            }
            $decl = $a['how'] === 'using' ? 'using ' . $name . ' = ' . $a['target'] : 'typedef ' . $a['target'] . ' ' . $name;
            $this->add($name, 'alias', $a['target'], $decl, $a['tok'], $todo, null, null, $this->doc($a['tok'] - ($a['how'] === 'using' ? 1 : 0), $a['tok'], true),
                'Alias de tipo: `' . $name . '` es otro nombre para `' . $a['target'] . '` (no crea un tipo nuevo, solo ahorra escribir). ' . $this->baseNote($c->info($a['target'])));
        }
        foreach ($c->tparams as $tp) {
            $esTipo = $tp['type'];
            $this->add($tp['name'], 'type', $esTipo ? null : trim(substr($tp['text'], 0, -strlen($tp['name']))), $tp['text'], $tp['tok'],
                $this->scopeOfTokens($tp['from'], max($tp['from'], $tp['to'])), null, null, null,
                $esTipo
                    ? 'Parámetro de plantilla: representa el tipo concreto con el que se use (lo deduce el compilador de los argumentos, o se indica: `f<int>(…)`). Se genera una versión del código por cada tipo.'
                    : 'Parámetro de plantilla constante: un valor conocido al compilar (por ejemplo un tamaño).');
        }
    }

    // ───────────────────────────── funciones y métodos ─────────────────────────────

    private function signature(array $f, bool $qual = true): string
    {
        $c = $this->c;
        $name = ($qual && $f['cls'] !== '' && !($f['inClass'] ?? false) ? $f['cls'] . '::' : '') . $f['name'];
        $ps = implode(', ', array_column($f['params'], 'text'));
        $quals = isset($f['quals']['const']) ? ' const' : '';
        $ret = $f['ret'] ?? '';
        $tpl = $f['tpl'] !== null ? $c->text($f['tpl'], max($f['tpl'], $c->templateAngles($f['tpl'] + 1, count($c->t)) - 1)) . ' ' : '';
        if (($f['auto'] ?? false) && $ret !== '') {
            return $tpl . 'auto ' . $name . '(' . $ps . ')' . $quals . ' -> ' . $ret;
        }
        return $tpl . ($ret !== '' ? $ret . ' ' : '') . $name . '(' . $ps . ')' . $quals;
    }

    private function functions(array $todo): void
    {
        $c = $this->c;
        $T = $c->t;
        $hechos = [];
        // métodos declarados en la clase (con o sin cuerpo fuera) y prototipos
        foreach ($c->protos as $p) {
            $key = $p['cls'] . '::' . $p['name'] . '/' . count($p['params']);
            $hechos[$key] = true;
            $def = null;
            foreach ($c->units as $u) {
                if ($u['cls'] === $p['cls'] && $u['name'] === $p['name'] && count($u['params']) === count($p['params'])) {
                    $def = $u;
                }
            }
            $sig = $this->signature($p);
            $doc = $this->doc($p['first'], $p['nameTok'], true) ?? ($def !== null ? $this->doc($def['first'], $def['nameTok'], true) : null);
            $det = $this->funcDetail($p) . ($def !== null && $p['inClass'] && !$def['inClass'] ? sprintf(' Se define fuera de la clase, en la línea %d.', $T[$def['first']][3])
                : ($def !== null && !$p['inClass'] ? sprintf(' Este es su prototipo (declaración adelantada); el cuerpo está en la línea %d.', $T[$def['first']][3]) : ''));
            if ($p['cls'] !== '') {
                $this->addMember($p['ci'], $p['name'], 'method', $sig, $sig, $p['nameTok'], $p['cls'], $doc, $det);
            } else {
                $this->add($p['name'], 'function', $sig, $sig, $p['nameTok'], $todo, null, null, $doc, $det);
            }
        }
        foreach ($c->units as $u) {
            $sig = $this->signature($u);
            $doc = $this->doc($u['first'], $u['nameTok'], true);
            $key = $u['cls'] . '::' . $u['name'] . '/' . count($u['params']);
            $det = $this->funcDetail($u);
            if ($u['cls'] !== '') {
                if (!isset($hechos[$key]) || $u['inClass']) {
                    $this->addMember($u['ci'], $u['name'], 'method', $sig, $sig, $u['nameTok'], $u['cls'], $doc, $det);
                } else {
                    // definición fuera de la clase: visible en su propio cuerpo
                    $this->add($u['name'], 'method', $sig, $sig, $u['nameTok'], $this->scopeOfTokens($u['first'], $u['close']), $u['cls'], null, $doc, $det);
                }
            } else {
                $this->add($u['name'], 'function', $sig, $sig, $u['nameTok'], $todo, null, null, $doc, $det);
            }
            // parámetros: visibles en la firma y el cuerpo
            $fn = ($u['cls'] !== '' ? $u['cls'] . '::' : '') . $u['name'];
            foreach ($u['params'] as $p) {
                if ($p['name'] === '') {
                    continue;
                }
                $info = $c->info($p['type']);
                $this->add($p['name'], 'param', $p['type'], $p['text'], $p['tok'], ['sl' => $T[$u['po']][3], 'el' => $T[$u['close']][3]], $u['cls'] !== '' ? $u['cls'] : null, $fn,
                    $this->doc($p['tok'], $p['tok'], false),
                    $this->describe($info, ['param' => true, 'def' => $p['def'], 'text' => $p['type']]));
            }
        }
    }

    private function funcDetail(array $f): string
    {
        $c = $this->c;
        $cls = $f['cls'];
        $name = $f['name'];
        $s = [];
        if ($cls === '' && $name === 'main') {
            return 'Punto de entrada del programa: es lo primero que se ejecuta. Devolver 0 significa «todo ha ido bien».';
        }
        if ($f['ctor']) {
            $s[] = 'Constructor de `' . $cls . '`: se ejecuta al crear un objeto (`' . $cls . ' x(…);` o `' . $cls . '{…}`) y deja sus campos listos.';
            if (isset($f['open']) && ($c->t[$f['pc'] + 1][1] ?? '') === ':') {
                $s[] = 'La lista que va tras `:` inicializa los campos antes de entrar al cuerpo (es lo eficiente, y obligatorio para campos `const` o referencias).';
            }
            if (isset($f['spec']['explicit'])) {
                $s[] = '`explicit`: no se usa para conversiones automáticas (evita que un `int` se convierta en `' . $cls . '` sin querer).';
            }
            return implode(' ', $s);
        }
        if ($f['dtor']) {
            return 'Destructor de `' . $cls . '`: se ejecuta solo cuando el objeto se destruye (al salir de su ámbito o con `delete`); es el sitio para liberar lo que el objeto reservó (RAII).';
        }
        if ($f['op'] ?? str_starts_with($name, 'operator')) {
            $op = trim(substr($name, 8));
            $s[] = 'Sobrecarga del operador `' . $op . '`' . ($cls !== '' ? ' para `' . $cls . '`' : '') . ': define qué hace `' . match ($op) {
                '()' => 'obj(…)', '[]' => 'obj[i]', '<<' => 'cout << obj', '>>' => 'cin >> obj', default => 'a ' . $op . ' b',
            } . '` con tus objetos.';
            $s[] = match ($op) {
                '<' => 'Con él funcionan `sort`, `set`, `map` y `priority_queue` sin pasarles comparador.',
                '==' => 'Con él funcionan `==`, `find` y `count`.',
                '<<' => 'Permite imprimir el objeto con `cout << x`; devuelve el `ostream&` para poder encadenar.',
                '()' => 'El objeto se puede «llamar» como una función (un functor, p. ej. un comparador para `sort` o `priority_queue`).',
                '<=>' => 'Comparación de tres vías (C++20): de ella salen `<`, `<=`, `>`, `>=`.',
                default => '',
            };
        } elseif ($cls !== '') {
            $s[] = 'Método de `' . $cls . '`' . (isset($f['spec']['static']) ? ' (`static`: no necesita un objeto, se llama `' . $cls . '::' . $name . '(…)`).' : '.');
        } else {
            $s[] = 'Función definida en tu código.';
        }
        $ret = $f['ret'] ?? '';
        if ($ret === 'void') {
            $s[] = 'No devuelve nada (`void`).';
        } elseif ($ret !== '' && !($f['op'] ?? false)) {
            $info = $c->info($ret);
            $s[] = 'Devuelve `' . $ret . '`' . ($info['ref'] === '&' ? ' por referencia (sin copiar; quien llama puede modificar el original)' : '') . '.';
        }
        if (isset($f['quals']['const'])) {
            $s[] = 'El `const` del final promete no modificar el objeto: se puede llamar sobre objetos `const`.';
        }
        if (isset($f['spec']['virtual']) || isset($f['quals']['override'])) {
            $s[] = isset($f['quals']['override']) ? '`override`: sustituye a un método `virtual` de la clase base.' : '`virtual`: las clases hijas pueden sustituirlo.';
        }
        if (isset($f['spec']['constexpr'])) {
            $s[] = '`constexpr`: puede calcularse al compilar si recibe constantes.';
        }
        if (isset($f['spec']['inline'])) {
            $s[] = '`inline`: puede definirse en varias unidades de compilación (y sugiere al compilador copiarla en cada llamada).';
        }
        if (isset($f['spec']['static']) && $cls === '') {
            $s[] = '`static`: solo visible en este archivo.';
        }
        if ($f['tpl'] !== null) {
            $s[] = 'Es una plantilla: el compilador genera una versión por cada tipo con el que la llames.';
        }
        return implode(' ', array_filter($s));
    }

    // ───────────────────────────── variables ─────────────────────────────

    private function variables(array $todo): void
    {
        $c = $this->c;
        foreach ($c->vars as $d) {
            $ci = $d['ci'];
            $info = $c->varInfo($d, $c->globals);
            $this->varSymbol($d, $info, $ci !== null ? 'field' : null, $ci, $ci !== null ? $d['cls'] : null, null, $todo);
        }
    }

    private function localsOf(int $u, array $unit): void
    {
        $c = $this->c;
        $T = $c->t;
        $L = $c->locals($u);
        $fn = ($unit['cls'] !== '' ? $unit['cls'] . '::' : '') . $unit['name'];
        $lamVar = [];
        foreach ($L['decls'] as $d) {
            if (isset($d['init']) && $d['init'] !== null && isset($c->lambdas[$d['init'][0]])) {
                $lamVar[$d['init'][0]] = $d['name'];
            }
        }
        foreach ($L['decls'] as $d) {
            if (!empty($d['param'])) {
                $info = $c->info($d['type']);
                $owner = !empty($d['catch']) ? 'catch' : 'lambda' . (isset($lamVar[$d['lambda']]) ? ' `' . $lamVar[$d['lambda']] . '`' : '');
                $sl = $T[$d['tok']][3];
                $this->add($d['name'], 'param', $d['type'], $d['p']['text'], $d['tok'], ['sl' => $sl, 'el' => $T[$d['se']][3]], null, $owner,
                    $this->doc($d['tok'], $d['tok'], false),
                    (!empty($d['catch']) ? 'La excepción capturada por este `catch`' . (str_contains($d['type'], '&') ? ' (por referencia, sin copiarla)' : '') . '. '
                        : 'Parámetro de la lambda. ') . $this->describe($info, ['param' => true, 'text' => $d['type']]));
                continue;
            }
            $info = $L['types'][$d['name']] ?? $c->varInfo($d, $L['types']);
            $scope = ['sl' => $T[$d['tok']][3], 'el' => $T[$d['se']][3]];
            $this->varSymbol($d, $info, null, null, $unit['cls'] !== '' ? $unit['cls'] : null, $fn, $scope, $L['types']);
        }
        foreach ($L['aliases'] as $a) {
            $this->add($a['name'], 'alias', $a['target'], 'using ' . $a['name'] . ' = ' . $a['target'], $a['tok'], $this->scopeOfTokens($a['tok'], $a['se']), null, $fn, null,
                'Alias de tipo local: `' . $a['name'] . '` es otro nombre para `' . $a['target'] . '`. ' . $this->baseNote($c->info($a['target'])));
        }
    }

    /** @param array<string,array<string,mixed>> $types */
    private function varSymbol(array $d, array $info, ?string $kind, ?int $ci, ?string $cls, ?string $fn, array $scope, array $types = []): void
    {
        $c = $this->c;
        $T = $c->t;
        $type = $c->declType($d);
        $spec = $d['spec'] ?? [];
        $initTxt = $d['init'] !== null && $d['ik'] !== ':' ? $c->text($d['init'][0], $d['init'][1]) : null;
        $lam = $d['init'] !== null ? ($c->lambdas[$d['init'][0]] ?? null) : null;
        $global = $fn === null && $ci === null;
        $field = $ci !== null;
        $esConst = (isset($spec['const']) || isset($spec['constexpr'])) && ($d['ptr'] ?? '') === '' && !str_contains($type, '&');
        $kind ??= $lam !== null && ($d['bind'] ?? null) === null ? 'lambda' : ($esConst ? 'const' : 'var');
        $pre = '';
        foreach (['static', 'constexpr', 'inline', 'thread_local', 'mutable', 'extern'] as $s) {
            if (isset($spec[$s])) {
                $pre .= $s . ' ';
            }
        }
        $doc = $this->doc($d['first'] ?? $d['tok'], $d['tok'], $global || $field);
        if (($d['bind'] ?? null) !== null) {
            $names = implode(', ', array_column($d['bind'], 0));
            $declTxt = $type . ' [' . $names . ']' . ($d['ik'] === ':' ? ' : ' . $c->text($d['init'][0], $d['init'][1]) : ($initTxt !== null ? ' = ' . $initTxt : ''));
            $comp = $d['comp'] ?? null;
            $det = 'Desestructuración (`auto [' . $names . ']`, C++17): reparte en variables sueltas las partes de ' . ($d['ik'] === ':' ? 'cada elemento recorrido' : 'lo que hay a la derecha') . '. ';
            if ($comp !== null) {
                $det .= match (true) {
                    $comp[1] === 'clave' => '`' . $d['name'] . '` es la **clave** de cada entrada del map (`' . $comp[0] . '`: no se puede cambiar).',
                    $comp[1] === 'valor' => '`' . $d['name'] . '` es el **valor** asociado a la clave (`' . $comp[0] . '`)' . (str_contains($type, '&') && !str_contains($type, 'const') ? '; con `&`, cambiarlo cambia el map.' : '.'),
                    $comp[1] === 'first', $comp[1] === 'second' => '`' . $d['name'] . '` es el `.' . $comp[1] . '` del par: `' . $comp[0] . '`.',
                    str_starts_with($comp[1], 'campo ') => '`' . $d['name'] . '` es el ' . str_replace('campo ', 'campo `', $comp[1]) . '` del struct: `' . $comp[0] . '`.',
                    default => '`' . $d['name'] . '` es el ' . $comp[1] . ': `' . $comp[0] . '`.',
                };
            } else {
                $det .= 'El tipo de cada nombre lo deduce el compilador.';
            }
            if (str_contains($type, '&')) {
                $det .= str_contains($type, 'const') ? ' Con `const auto&` no se copia nada y no se puede modificar.' : ' Con `auto&` no se copia: son referencias a las partes originales.';
            } else {
                $det .= ' Sin `&` cada parte es una copia.';
            }
            $this->add($d['name'], 'var', $comp[0] ?? $type, $declTxt, $d['tok'], $scope, $cls, $fn, $doc, $det);
            return;
        }
        $base = $d['typeOf'] ?? $c->text($d['ts'], $d['te']);
        $cv = $d['cv'] ?? '';
        $declTxt = $pre . trim(($cv !== '' && !str_starts_with($base, $cv) ? $cv . ' ' : '') . $base) . ($d['ptr'] ?? '') . ' ' . $d['name'] . ($d['dims'] ?? '');
        if ($initTxt !== null && $lam === null) {
            $declTxt .= match ($d['ik']) {
                '=' => ' = ', '(' => '(', '{' => '{', default => ' ',
            } . (mb_strlen($initTxt) > 48 ? mb_substr($initTxt, 0, 45) . '…' : $initTxt) . match ($d['ik']) {
                '(' => ')', '{' => '}', default => '',
            };
        } elseif ($lam !== null) {
            $declTxt .= ' = ' . $lam['cap'] . '(' . implode(', ', array_column($lam['params'], 'text')) . ')' . ($lam['ret'] !== null ? ' -> ' . $lam['ret'] : '') . ' {…}';
        } elseif ($d['ik'] === ':' && $d['init'] !== null) {
            $declTxt .= ' : ' . $c->text($d['init'][0], $d['init'][1]);
        }
        if ($lam !== null) {
            $det = $this->lambdaDetail($d['name'], $lam, $info);
        } else {
            $reason = null;
            if ($info['base'] !== 'auto' && isset($info['deduced']) && $d['init'] !== null) {
                $reason = $d['ik'] === ':' ? 'el tipo de los elementos de `' . $c->text($d['init'][0], $d['init'][1]) . '`'
                    : ($c->infer($d['init'][0], $d['init'][1], $types ?: $c->globals)[1] ?? null);
            }
            $det = $this->describe($info, ['global' => $global, 'field' => $field, 'spec' => $spec, 'text' => $type, 'init' => $initTxt, 'reason' => $reason,
                'for' => $d['ctx'] === 'for', 'range' => $d['ik'] === ':', 'cls' => $cls]);
            if ($d['ctx'] === 'for' && $d['ik'] === ':') {
                $det = 'Variable del `for` de rango: toma uno a uno los elementos de `' . $c->text($d['init'][0], $d['init'][1]) . '`'
                    . (str_contains($type, '&') ? (str_contains($type, 'const') ? ' sin copiarlos y sin poder cambiarlos. ' : ' por referencia: cambiarla cambia el contenedor. ') : ' (cada vuelta es una copia). ') . $det;
            } elseif ($d['ctx'] === 'for') {
                $det = 'Variable del `for`: solo existe dentro del bucle. ' . $det;
            } elseif ($d['ctx'] === 'cond') {
                $det = 'Declarada en la condición: solo existe dentro de ese `if`/`while` (y su `else`). ' . $det;
            }
            if ($global && !$esConst) {
                $det .= ' Variable global: la ven todas las funciones del archivo (y empieza a cero si no se inicializa).';
            }
        }
        if ($field) {
            $det = 'Campo de `' . $cls . '`' . (isset($spec['static']) ? '' : ': cada objeto tiene el suyo') . '. ' . $det;
        }
        $this->add($d['name'], $kind, $lam !== null ? $type : $type, $declTxt, $d['tok'], $scope, $cls, $fn, $doc, $det);
    }

    private function lambdaDetail(string $name, array $lam, array $info): string
    {
        $cap = trim($lam['cap'], '[]');
        $s = ['Lambda (función sin nombre) guardada en `' . $name . '`; se llama como una función: `' . $name . '(' . implode(', ', array_column($lam['params'], 'name')) . ')`.'];
        if ($cap === '') {
            $s[] = 'Captura `[]`: no usa variables de fuera, solo sus parámetros (y las globales).';
        } elseif ($cap === '&') {
            $s[] = 'Captura `[&]`: usa **por referencia** las variables de fuera que nombre: ve sus valores actuales y puede cambiarlas, sin copiar nada.';
        } elseif ($cap === '=') {
            $s[] = 'Captura `[=]`: **copia** las variables de fuera que use en el momento de crearla (no ve cambios posteriores y no puede modificarlas salvo con `mutable`).';
        } else {
            $items = [];
            foreach (array_map('trim', explode(',', $cap)) as $it) {
                $items[] = match (true) {
                    $it === '&' => 'el resto por referencia',
                    $it === '=' => 'el resto por copia',
                    $it === 'this' || $it === '*this' => '`this` (los miembros del objeto)',
                    str_starts_with($it, '&') => '`' . substr($it, 1) . '` por referencia',
                    str_contains($it, '=') => '`' . trim(explode('=', $it)[0]) . '` inicializada con `' . trim(explode('=', $it, 2)[1]) . '`',
                    default => '`' . $it . '` por copia',
                };
            }
            $s[] = 'Captura: ' . implode(', ', $items) . '.';
        }
        if ($info['fam'] === 'FN') {
            $s[] = 'Se guarda en un `' . $info['text'] . '` (y no en `auto`) para que la lambda pueda llamarse a sí misma: así se escriben DFS y recursiones dentro de `main`.';
        } elseif (isset($lam['params'][0]) && str_contains($lam['params'][0]['type'], 'auto')) {
            $p0 = $lam['params'][0]['name'];
            $T = $this->c->t;
            $self = false;
            for ($k = $lam['open'] + 1; $k < $lam['close'] && $p0 !== ''; $k++) {
                if ($T[$k][1] === $p0 && ($T[$k + 1][1] ?? '') === '(' && ($T[$k + 2][1] ?? '') === $p0) {
                    $self = true;
                    break;
                }
            }
            $s[] = $self
                ? 'El primer parámetro, `' . $p0 . '`, es la propia lambda: se llama `' . $name . '(' . $name . ', …)` y dentro `' . $p0 . '(' . $p0 . ', …)` para la recursión (alternativa a `function<…>`, sin su coste).'
                : 'Sus parámetros `auto` la hacen genérica (vale para cualquier tipo).';
        }
        if ($lam['ret'] !== null) {
            $s[] = 'Devuelve `' . $lam['ret'] . '` (indicado con `->`).';
        }
        return implode(' ', $s);
    }

    // ───────────────────────────── explicaciones de tipos ─────────────────────────────

    /** Explicación de un tipo en su contexto. @param array<string,mixed> $o */
    private function describe(array $info, array $o): string
    {
        $text = (string) ($o['text'] ?? $info['text']);
        $spec = $o['spec'] ?? [];
        $s = [];
        if ($info['ref'] === '&' && ($info['const'] || str_starts_with($text, 'const'))) {
            $s[] = 'Referencia constante: no copia y no se puede modificar (lo típico para pasar vectores/strings a funciones).';
        } elseif ($info['ref'] === '&') {
            $s[] = 'Referencia: otro nombre para la variable original; no copia nada y los cambios se ven fuera.';
        } elseif ($info['ref'] === '&&') {
            $s[] = str_contains($text, 'auto') ? 'Referencia universal (`auto&&`): se adapta a lo que reciba sin copiarlo.'
                : 'Referencia a un temporal (rvalue, `&&`): permite «mover» su contenido en vez de copiarlo.';
        } elseif (!empty($o['param']) && $info['ptr'] === 0 && $info['arr'] === 0 && ($info['fam'] !== null && !in_array($info['fam'], ['PAIR', 'FN', 'OPT', 'SV'], true) || $info['user'])) {
            $s[] = 'Se pasa **por valor**: la función recibe una copia (cambiarla no afecta al original, y copiar un contenedor cuesta O(n)).';
        }
        if ($info['ptr'] > 0) {
            $s[] = 'Puntero' . ($info['ptr'] > 1 ? ' a puntero' : '') . ': guarda la dirección de un `' . $info['base'] . '`; se accede con `*p` o `p->campo` y puede valer `nullptr`.'
                . ($info['const'] ? ' Con `const` delante, lo apuntado no se puede cambiar a través de él.' : '');
        }
        if (str_contains($text, 'auto')) {
            if (isset($info['deduced']) && $info['deduced'] !== 'lambda') {
                $s[] = '`auto`: el compilador deduce el tipo → **`' . $info['deduced'] . '`**' . (!empty($o['reason']) ? ' (' . $o['reason'] . ').' : '.');
                if ($info['deduced'] === 'int' && preg_match('/^-?\d{10,}$/', str_replace("'", '', (string) ($o['init'] ?? '')))) {
                    $s[] = 'Ojo: ese literal no cabe en `int`; añade `LL`.';
                }
                if ($info['deduced'] === 'double' && preg_match('/^\d+(\.\d+)?e\d+$/i', (string) ($o['init'] ?? ''))) {
                    $s[] = 'Ojo: `1e9` es un `double`, no un entero.';
                }
            } elseif (!empty($o['init'])) {
                $s[] = '`auto`: el tipo lo deduce el compilador de `' . (mb_strlen((string) $o['init']) > 40 ? mb_substr((string) $o['init'], 0, 37) . '…' : $o['init']) . '`.';
            } elseif (empty($o['param'])) {
                $s[] = '`auto`: el tipo lo deduce el compilador.';
            } else {
                $s[] = 'Parámetro `auto`: vale para cualquier tipo (es una plantilla implícita).';
            }
        }
        if (isset($spec['static'])) {
            $s[] = !empty($o['field']) ? '`static`: un solo valor compartido por todos los objetos de la clase.'
                : (!empty($o['global']) ? '`static` en el archivo: solo visible en este archivo.' : '`static`: se inicializa una sola vez y conserva su valor entre llamadas.');
        }
        if (isset($spec['constexpr'])) {
            $s[] = '`constexpr`: valor conocido al compilar; se puede usar como tamaño de un array o dentro de otras constantes.';
        } elseif ($info['const'] && $info['ref'] === '' && $info['ptr'] === 0) {
            $s[] = '`const`: no se puede modificar después de inicializarla.';
        }
        if ($info['arr'] > 0) {
            $el = trim((string) preg_replace('/\[[^\]]*\]/', '', $text));
            $s[] = 'Array de C de tamaño fijo (`' . $info['dims'] . '` de `' . $el . '`): sin comprobación de límites (salirse es comportamiento indefinido).'
                . (!empty($o['global']) || isset($spec['static']) ? ' Al ser global/static empieza todo a cero.' : (empty($o['param']) && empty($o['field']) && empty($o['init']) ? ' Como variable local NO se inicializa: usa `= {}` o `memset`.' : ''))
                . (!empty($o['param']) ? ' Como parámetro llega como puntero: la función modifica el array original.' : '');
            $info2 = $this->c->info($el);
            $nota = $this->baseNote($info2);
            if ($nota !== '') {
                $s[] = $nota;
            }
            return implode(' ', $s);
        }
        $nota = $this->baseNote($info);
        if ($nota !== '') {
            $s[] = $nota;
        }
        return implode(' ', $s);
    }

    /** Una línea sobre lo que es el tipo base (contenedores, enteros, tipos del usuario…). */
    private function baseNote(array $info): string
    {
        $c = $this->c;
        $b = $info['base'];
        $a = $info['args'];
        $pre = isset($info['alias']) ? '`' . $info['alias'] . '` = `' . ($c->aliases[$info['alias']]['target'] ?? $b) . '`. ' : '';
        $inner = static function (string $t): string {
            return preg_match('/^(std::)?vector\s*</', $t) ? 'vectores' : (preg_match('/^(std::)?pair\s*</', $t) ? 'pares `' . $t . '`' : '`' . $t . '`');
        };
        $n = match ($b) {
            'vector' => '`vector`: array dinámico contiguo; `v[i]` y `push_back` son O(1) (amortizado), insertar o borrar en medio O(n).'
                . (isset($a[0]) && preg_match('/^(std::)?vector\s*</', $a[0]) ? ' Aquí es un vector de vectores: una matriz o una lista de adyacencia (`g[u]` = vecinos de u).' : '')
                . (isset($a[0]) && $a[0] === 'bool' ? ' (`vector<bool>` guarda bits empaquetados: ocupa poco, pero sus elementos no son `bool&` de verdad).' : '')
                . (isset($a[0]) && preg_match('/^(std::)?pair\s*</', $a[0]) ? ' Guarda pares (`.first`, `.second`).' : ''),
            'deque' => '`deque`: cola doble; añadir o quitar por los dos extremos es O(1) y `d[i]` también.',
            'list' => '`list`: lista doblemente enlazada; insertar o borrar con un iterador es O(1), pero no hay `l[i]` (llegar a una posición es O(n)).',
            'forward_list' => '`forward_list`: lista enlazada simple (solo hacia delante).',
            'map' => '`map`: árbol ordenado por clave (rojo-negro); insertar, buscar y borrar O(log n), y se recorre en orden de clave. `m[k]` crea la clave (con valor 0) si no existe; para solo mirar usa `count`/`find`.',
            'multimap' => '`multimap`: como `map` pero admite claves repetidas; O(log n).',
            'set' => '`set`: árbol ordenado sin repetidos; insertar, buscar (`count`/`find`) y borrar O(log n). `s.lower_bound(x)` da el primer elemento ≥ x.',
            'multiset' => '`multiset`: conjunto ordenado CON repetidos; O(log n). Ojo: `erase(x)` borra TODAS las copias de x (para una sola: `s.erase(s.find(x))`).',
            'unordered_map' => '`unordered_map`: tabla hash; insertar y buscar O(1) de media (O(n) en el peor caso) y sin orden. `m[k]` crea la clave si no existe.',
            'unordered_set' => '`unordered_set`: conjunto con tabla hash; `count`/`insert` O(1) de media, sin orden.',
            'unordered_multimap', 'unordered_multiset' => '`' . $b . '`: tabla hash con repeticiones; O(1) de media.',
            'queue' => '`queue`: cola FIFO: `push` al final, `front` y `pop` por delante, todo O(1). La de los BFS.',
            'stack' => '`stack`: pila LIFO: `push`, `top` y `pop` en O(1).',
            'priority_queue' => (isset($a[2]) && str_contains($a[2], 'greater')
                ? '`priority_queue` con `greater<>`: montículo de **mínimos**: `top()` es el MENOR (lo típico en Dijkstra y Prim).'
                : '`priority_queue`: montículo (heap) de máximos: `top()` es el MAYOR.') . ' `push`/`pop` O(log n), `top` O(1).'
                . (isset($a[0]) && preg_match('/^(std::)?pair\s*</', $a[0]) ? ' Con pares compara por `.first` y, si empatan, por `.second`.' : ''),
            'pair' => '`pair`: dos valores juntos (`.first`, `.second`); se comparan por `first` y, si empatan, por `second`.',
            'tuple' => '`tuple`: varios valores juntos; se leen con `get<0>(t)` o `auto [a, b, c] = t`.',
            'string', 'wstring' => '`string`: texto que gestiona su memoria; `s[i]`, `size()` y `s += x` son O(1) (amortizado); `substr`, `find` y `s + t` son O(n).',
            'string_view' => '`string_view`: vista de solo lectura sobre un texto ajeno (no copia; cuidado con que el original siga vivo).',
            'array' => '`array<T, N>`: array de tamaño fijo como el de C, pero se puede copiar, comparar y conoce su `size()`.',
            'bitset' => '`bitset`: N bits compactos; `&`, `|`, `^`, `<<` y `count()` trabajan sobre todos a la vez (N/64 operaciones).',
            'function' => '`function<R(Args)>`: guarda cualquier cosa invocable (una función, una lambda…); con ella una lambda puede llamarse a sí misma.',
            'optional' => '`optional`: o tiene un valor o está vacío (`has_value()`, `*o`, `value_or(x)`).',
            'unique_ptr' => '`unique_ptr`: puntero inteligente con dueño único: libera el objeto solo al salir de su ámbito; no se copia, solo se mueve (`std::move`).',
            'shared_ptr' => '`shared_ptr`: puntero inteligente compartido: cuenta cuántos dueños tiene y libera el objeto cuando desaparece el último.',
            'iterator', 'const_iterator', 'reverse_iterator' => 'Iterador: apunta a un elemento del contenedor; `*it` lo lee, `++it` avanza y compararlo con `.end()` dice si se ha llegado al final (o si una búsqueda no encontró nada).',
            'int' => '`int`: entero de 32 bits con signo, hasta ±2.147.483.647 (≈ 2·10⁹). Si los valores o sus productos pueden pasar de ahí, usa `long long`.',
            'long long' => '`long long`: entero de 64 bits, hasta ≈ 9,2·10¹⁸.',
            'unsigned long long' => '`unsigned long long`: entero de 64 bits sin signo (0 … ≈ 1,8·10¹⁹).',
            'long' => '`long`: entero de al menos 32 bits (64 en Linux, 32 en Windows): para 64 bits seguro, `long long`.',
            'unsigned int', 'unsigned long', 'unsigned' => '`' . $b . '`: entero sin signo: nunca es negativo, y restar por debajo de 0 da la vuelta a un número enorme.',
            'size_t' => '`size_t`: entero sin signo para tamaños (lo que devuelve `size()`). Cuidado: `v.size() - 1` con el vector vacío no es -1 sino un número enorme.',
            'short' => '`short`: entero de 16 bits (±32.767).',
            'char' => '`char`: un carácter (1 byte); en el fondo es un número pequeño: `c - \'a\'` da su posición en el alfabeto y `c - \'0\'` el valor de un dígito.',
            'bool' => '`bool`: `true` o `false`.',
            'double' => '`double`: número con decimales de 64 bits (~15 cifras significativas). No compares con `==`: usa `fabs(a - b) < 1e-9`.',
            'float' => '`float`: decimales de 32 bits (~7 cifras); casi siempre es mejor `double`.',
            'long double' => '`long double`: decimales con más precisión que `double` (80 bits en x86).',
            'void' => '',
            'auto' => '',
            '__int128' => '`__int128`: entero de 128 bits (extensión de GCC); no se puede imprimir con `cout` directamente.',
            'int64_t', 'uint64_t', 'int32_t', 'uint32_t' => '`' . $b . '`: entero de ancho exacto (' . (str_contains($b, '64') ? '64' : '32') . ' bits' . ($b[0] === 'u' ? ', sin signo' : '') . ').',
            'mt19937', 'mt19937_64' => '`' . $b . '`: generador de números aleatorios (Mersenne Twister); mucho mejor que `rand()`.',
            'lambda' => '',
            default => '',
        };
        if ($n === '' && $info['user']) {
            $k = $c->typeNames[$b] ?? '';
            $linea = '';
            foreach ($c->classes as $cl) {
                if ($cl['name'] === $b) {
                    $linea = ' (línea ' . $cl['line'] . ')';
                }
            }
            $n = match ($k) {
                'struct', 'class' => '`' . $b . '`: ' . $k . ' definido en tu código' . $linea . '.',
                'enum' => '`' . $b . '`: enumeración definida en tu código' . $linea . '.',
                'tparam' => '`' . $b . '`: parámetro de plantilla (el tipo concreto lo pone quien llama).',
                default => '',
            };
        }
        unset($inner);
        return trim($pre . $n);
    }
}
