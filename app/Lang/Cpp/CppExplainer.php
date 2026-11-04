<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp;

use Playground\Core\Explains;

defined('PG_ROOT') or exit;

/**
 * Traduce un error de C++ (de compilación, del enlazador o de ejecución) a un diagnóstico explicado en español.
 *
 * Mismo formato que JavaExplainer: {code, title, explain (markdown), hint?, fixes?, suggestions?}, con los códigos compartidos
 * con PHP, Python y Java cuando hay equivalente (undefined-variable, undefined-method, class-not-found, index-out-of-range,
 * member-on-null, division-by-zero, overflow, immutable, visibility, redeclare, type-mismatch, missing-return, stack-overflow...).
 *
 * Los de compilación se reconocen por el TEXTO del mensaje (gcc y clang dicen lo mismo con palabras distintas, así que
 * cada regla admite las dos formas); el `code` del evento solo sirve de respaldo. Los de ejecución, por `kind` y `cls`.
 *
 * Eventos de compilación (CppLanguage): {kind:'parse', severity?:'warning', code ('gcc.not-declared', 'Wsign-compare',
 * 'link.undefined'…), msg, line, col, endLine, endCol, fixits?:[{sl,sc,el,ec,text}], notes?:[{line,col,msg}], flag?}.
 * Los fix-its del compilador se convierten en arreglos rápidos (Alt+Enter) cuando no hay uno propio mejor.
 */
final class CppExplainer implements Explains
{
    /** Nombre de la biblioteca estándar → cabecera (para el `#include` que falta y el `std::`). */
    private const CABECERA = [
        'vector' => 'vector', 'string' => 'string', 'map' => 'map', 'unordered_map' => 'unordered_map', 'set' => 'set', 'unordered_set' => 'unordered_set',
        'multiset' => 'set', 'multimap' => 'map', 'list' => 'list', 'deque' => 'deque', 'stack' => 'stack', 'queue' => 'queue', 'priority_queue' => 'queue',
        'array' => 'array', 'pair' => 'utility', 'tuple' => 'tuple', 'move' => 'utility', 'swap' => 'utility', 'optional' => 'optional', 'variant' => 'variant',
        'unique_ptr' => 'memory', 'shared_ptr' => 'memory', 'weak_ptr' => 'memory', 'make_unique' => 'memory', 'make_shared' => 'memory',
        'cout' => 'iostream', 'cin' => 'iostream', 'cerr' => 'iostream', 'endl' => 'iostream', 'ostream' => 'iostream', 'istream' => 'iostream',
        'stringstream' => 'sstream', 'ostringstream' => 'sstream', 'istringstream' => 'sstream', 'ifstream' => 'fstream', 'ofstream' => 'fstream',
        'sort' => 'algorithm', 'reverse' => 'algorithm', 'find' => 'algorithm', 'min' => 'algorithm', 'max' => 'algorithm', 'count' => 'algorithm',
        'lower_bound' => 'algorithm', 'upper_bound' => 'algorithm', 'binary_search' => 'algorithm', 'unique' => 'algorithm', 'max_element' => 'algorithm',
        'min_element' => 'algorithm', 'accumulate' => 'numeric', 'iota' => 'numeric', 'gcd' => 'numeric', 'lcm' => 'numeric',
        'function' => 'functional', 'bitset' => 'bitset', 'regex' => 'regex', 'thread' => 'thread', 'mutex' => 'mutex', 'to_string' => 'string',
        'stoi' => 'string', 'stod' => 'string', 'stoll' => 'string', 'sqrt' => 'cmath', 'pow' => 'cmath', 'abs' => 'cmath', 'floor' => 'cmath', 'ceil' => 'cmath',
        'runtime_error' => 'stdexcept', 'out_of_range' => 'stdexcept', 'invalid_argument' => 'stdexcept', 'logic_error' => 'stdexcept',
        'numeric_limits' => 'limits', 'chrono' => 'chrono', 'setw' => 'iomanip', 'setprecision' => 'iomanip', 'string_view' => 'string_view',
        'span' => 'span', 'ranges' => 'ranges', 'size_t' => 'cstddef',
    ];
    /** Métodos habituales de los contenedores, para «¿quisiste decir…?» cuando el compilador no sugiere nada (clang). */
    private const METODOS = ['push_back', 'pop_back', 'size', 'empty', 'clear', 'begin', 'end', 'front', 'back', 'at', 'insert', 'erase', 'emplace_back',
        'emplace', 'resize', 'reserve', 'capacity', 'find', 'count', 'length', 'substr', 'append', 'c_str', 'push', 'pop', 'top', 'push_front', 'pop_front',
        'rbegin', 'rend', 'data', 'swap', 'assign', 'contains', 'lower_bound', 'upper_bound', 'first', 'second', 'get', 'reset', 'release', 'value', 'has_value'];

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
            $d = $this->compile($ev, $msg, $base);
            if (empty($d['fixes']) && ($f = $this->fixesCompilador($ev)) !== []) {
                $d['fixes'] = $f;
            }
            if (!empty($ev['notes'])) {
                $d['notes'] = $ev['notes'];
            }
            return $d;
        }
        $base['source'] = 'runtime';
        return $this->runtime($kind, $ev, $base);
    }

    // ═══════════════════════════ compilación ═══════════════════════════

    /**
     * @param array<string,mixed> $ev
     * @param array<string,mixed> $b
     */
    private function compile(array $ev, string $msg, array $b): array
    {
        $code = (string) ($ev['code'] ?? '');
        $m1 = trim((string) preg_replace('/\s*\[-f?[\w=+-]+\]\s*$/', '', explode("\n", $msg)[0]));
        $mk = static fn(string $c, string $title, string $explain, array $x = []): array => ['code' => $c, 'title' => $title, 'explain' => $explain] + $x + $b;
        $warning = $b['severity'] === 'warning';
        $q = static fn(string $s): string => '`' . $s . '`';

        if ($warning) {
            return $this->aviso($ev, $m1, $b);
        }
        if (str_starts_with($code, 'link.') || preg_match('/^undefined (?:reference|symbol)/', $m1)) {
            if (preg_match('/^multiple definition of [\'‘](.+?)[\'’]/u', $m1, $m)) {
                return $mk('link.multiple', "«{$m[1]}» está definido dos veces", "Hay dos definiciones de **`{$m[1]}`** (dos cuerpos). En C++ cada función o variable global se define **una sola vez** en todo el programa (*regla de una definición*): borra o renombra una de las dos.");
            }
            $nombre = preg_match('/undefined (?:reference to|symbol:?) [\'‘]?(.+?)[\'’]?$/u', $m1, $m) ? $m[1] : 'la función';
            return $mk('link.undefined', "Falta la definición de «{$nombre}»", "El código **declara** y usa `$nombre` (el compilador sí vio su prototipo), pero en ningún sitio está su **cuerpo**. Este error no lo da el compilador sino el **enlazador**, en el último paso, y por eso sale tarde.\n\nEn Java o Python una función sin cuerpo es imposible; en C++ el prototipo `int f(int);` es una promesa que hay que cumplir. Causas típicas:\n- Escribiste solo el prototipo y no el `{ … }`.\n- El nombre o los **parámetros de la definición no coinciden** con los de la declaración (son otra sobrecarga distinta).\n- Definiste un método de una clase sin el `Clase::` (`int Pila::tam() { … }`).", ['hint' => 'Busca la definición y compara nombre y tipos de los parámetros con el prototipo.']);
        }
        // ── nombres que no existen ──
        if (preg_match('/^[\'‘](.+?)[\'’] was not declared in this scope|^use of undeclared identifier [\'‘](.+?)[\'’]|^unknown type name [\'‘](.+?)[\'’]|^no template named [\'‘](.+?)[\'’]|^[\'‘](.+?)[\'’] (?:does not name a type|has not been declared)|^[\'‘]std::(.+?)[\'’] has not been declared|^[\'‘](.+?)[\'’] is not a member of [\'‘]std[\'’]/u', $m1, $m)) {
            return $this->noExiste($m1, trim(implode('', array_slice($m, 1))), $b);
        }
        if (preg_match('/^[\'‘](.+?)[\'’] is not a member of [\'‘](.+?)[\'’]/u', $m1, $m) || preg_match('/^no member named [\'‘](.+?)[\'’] in [\'‘](.+?)[\'’]/u', $m1, $m)
            || preg_match('/^[\'‘](.+?)[\'’] has no member named [\'‘](.+?)[\'’]/u', $m1, $m2) && ($m = [$m2[0], $m2[2], $m2[1]])) {
            return $this->sinMiembro($m1, $m[1], $m[2], $b);
        }
        if (preg_match('/request for member [\'‘](.+?)[\'’] in [\'‘](.+?)[\'’], which is of pointer type|member reference type [\'‘](.+?)[\'’] is a pointer/u', $m1, $m)) {
            return $mk('pointer-member', 'Es un puntero: se usa `->`, no `.`', "La variable es un **puntero** (`T*`), y con un puntero se accede a los miembros con **`->`** (`p->x`), que equivale a `(*p).x`. El punto `.` es solo para objetos y referencias.\n\nEn Java, Python o PHP no existe esta distinción: todo objeto se maneja por referencia y siempre se usa `.` (o `->` en PHP). En C++ un objeto puede vivir directamente en la variable (`P q;` → `q.x`) o detrás de un puntero (`P* p = new P;` → `p->x`).",
                ['hint' => 'Puntero → `->`; objeto o referencia → `.`.'] + $this->flechaFix($b, '->'));
        }
        if (preg_match('/base operand of [\'‘]->[\'’] has non-pointer type|member reference type [\'‘](.+?)[\'’] is not a pointer|is not a pointer; did you mean/u', $m1)) {
            return $mk('pointer-member', 'No es un puntero: se usa `.`, no `->`', "La variable es un **objeto** (o una referencia), no un puntero, así que se accede con **`.`** (`q.x`). La flecha `->` solo vale con punteros (`T*`) y punteros inteligentes (`unique_ptr`, `shared_ptr`).\n\nSi esperabas un puntero, comprueba la declaración: `P q;` crea el objeto entero; `P* q = new P;` crea un puntero.",
                ['hint' => 'Objeto o referencia → `.`; puntero → `->`.'] + $this->flechaFix($b, '.'));
        }
        // ── sintaxis ──
        if (preg_match('/^expected /', $m1)) {
            return $this->esperaba($ev, $m1, $b);
        }
        if (preg_match('/^a function-definition is not allowed here|^function definition is not allowed here/', $m1)) {
            return $mk('parse.syntax', 'No se puede definir una función dentro de otra', "En C++ no hay funciones anidadas como en Python (`def` dentro de `def`) o JavaScript. Define la función **fuera** de `main` (antes de ella), o usa una **lambda**: `auto f = [](int x) { return x + 1; };`.");
        }
        if (preg_match('/must return [\'‘]int[\'’]/', $m1)) {
            return $mk('main-int', '`main` debe devolver `int`', "En C++ `main` siempre devuelve **`int`** (el código de salida; `0` = todo bien). `void main()` no es C++ válido, aunque algunos compiladores antiguos lo toleraban. En Java sí se escribe `void main`; aquí no.",
                ['fixes' => $this->fixesCompilador($ev) ?: $this->sustituirFix($b, 'void', 'int', 'Cambiar `void` por `int`')]);
        }
        // ── tipos ──
        if (preg_match('/no return statement|non-void function does not return|control reaches end of non-void/', $m1)) {
            return $mk('missing-return', 'La función no devuelve nada en algún camino', "La función promete devolver un valor, pero puede **terminar sin llegar a un `return`** (por ejemplo, cuando no se cumple un `if`).\n\nEn Java esto es un error de compilación claro; en C++ el compilador a veces solo avisa, y si ocurre al ejecutar es **comportamiento indefinido**: el valor devuelto es basura y el programa puede hacer cualquier cosa. Añade el `return` que falta en todos los caminos.",
                ['hint' => 'Revisa el final de la función y las ramas `if`/`else`: cada una debe acabar en `return`.']);
        }
        if (preg_match('/assignment of read-only|cannot assign to variable [\'‘](.+?)[\'’] with const|read-only variable is not assignable|cannot assign to (?:return value|a const)|assignment of member .* in read-only object|increment of read-only|decrement of read-only|cannot assign to non-static data member .* const/u', $m1)) {
            return $mk('immutable', 'Intentas modificar algo que es `const`', "Esa variable (o ese elemento) es **`const`**: el compilador garantiza que nadie la cambie. Para modificar a través de un parámetro `const T&` (muy habitual: `const vector<int>& v`) tendrías que copiar el dato o quitar el `const` del parámetro.\n\nEs parecido a `final` de Java, pero **más profundo**: `const vector<int>&` impide también `push_back` y `v[i] = …`, no solo reasignar la variable. En Python y PHP no existe una garantía así.",
                ['hint' => 'Si debe cambiar, quita `const` de la declaración (o del parámetro); si no, trabaja con una copia.']);
        }
        if (preg_match('/passing [\'‘](.+?)[\'’] as [\'‘]this[\'’] argument discards qualifiers|no matching member function for call to [\'‘](.+?)[\'’]/u', $m1, $m) && (str_contains(json_encode($ev['notes'] ?? []) . $m1, 'const') || preg_match('/[\'‘](?:push_back|pop_back|clear|insert|erase|emplace_back|emplace|resize|assign|append|push|pop|push_front|pop_front)[\'’]/u', $m1))) {
            return $mk('immutable', 'Ese método modifica el objeto, pero es `const`', "Llamas a un método que **puede modificar** el objeto (como `push_back` o `clear`) sobre algo declarado `const` (típicamente un parámetro `const vector<int>&`). El compilador lo prohíbe: una referencia `const` es solo de lectura.\n\nSi la función debe cambiar el contenedor, recibe `vector<int>&` (sin `const`); si solo lee, usa métodos que no modifiquen (`size()`, `at()`, `empty()`…).");
        }
        if (preg_match('/is private within this context|is a private member|is protected within this context|is a protected member|\'(.+?)\' is private/u', $m1, $m)) {
            $miembro = preg_match('/[\'‘](.+?)[\'’]/u', $m1, $mm) ? $mm[1] : 'el miembro';
            return $mk('visibility', "`$miembro` es privado", "El miembro **`$miembro`** es `private` (o `protected`) y no se puede usar desde aquí. Las notas del compilador señalan dónde se declaró.\n\nOjo con el valor por defecto: en una `class` todo es `private` salvo que escribas `public:`; en una `struct` es al revés, todo es público. (En Java el valor por defecto es *package-private*; en Python no hay privacidad real.)",
                ['hint' => 'Añade `public:` antes del miembro, o usa un método público (getter) en su lugar.']);
        }
        if (preg_match('/redefinition of|redeclaration of|conflicting declaration|previous declaration|already defined/', $m1)) {
            $n = preg_match('/[\'‘](.+?)[\'’]/u', $m1, $mm) ? $mm[1] : 'ese nombre';
            return $mk('redeclare', "«{$n}» ya está declarado", "El nombre **`$n`** ya existe en este ámbito (la nota del compilador señala dónde). En C++ no puedes declarar dos veces una variable en el mismo bloque `{ … }`, ni definir dos funciones con la misma firma. Para cambiar su valor, **asígnalo sin repetir el tipo** (`y = 2;`); para otra cosa, usa otro nombre.\n\nLo que sí puedes es tener **sobrecargas**: mismo nombre con parámetros de distinto tipo o número.");
        }
        if (preg_match('/use of deleted function|call to deleted|is implicitly deleted|attempting to reference a deleted function/', $m1)) {
            $unique = str_contains($m1, 'unique_ptr');
            return $mk('deleted-function', $unique ? '`unique_ptr` no se puede copiar: usa `std::move`' : 'Esa operación está prohibida (función eliminada)', $unique
                ? "Un **`unique_ptr` es el único dueño** de su objeto, por eso copiarlo está prohibido (`= delete`). Lo que sí puedes es **transferir** la propiedad con `std::move`: `auto v = std::move(u);` (después `u` queda vacío, igual que `nullptr`).\n\nEn Java, Python y PHP copiar una referencia siempre es posible y el recolector de basura decide cuándo liberar. En C++ moderno, `unique_ptr` expresa en el tipo *quién libera*, y el compilador lo vigila.\n\nSi de verdad necesitas varios dueños, usa `shared_ptr`; si solo quieres mirar, pasa una referencia `*u` o el puntero crudo `u.get()`."
                : "La operación que intentas hacer (normalmente **copiar** un objeto, o llamar a un constructor) está marcada con `= delete`: la clase la prohíbe a propósito (como `unique_ptr`, `ofstream` o `thread`, que no se copian). Mira la nota del compilador para ver cuál es.\n\nPrueba a **moverlo** (`std::move(x)`) o a pasarlo por **referencia** (`T&`) en vez de por valor.",
                ['hint' => $unique ? 'Escribe `std::move(u)` donde ahora copias.' : 'Pasa el objeto por referencia (`T&`) o muévelo con `std::move`.'] + ($unique ? $this->moveFix($b) : []));
        }
        if (preg_match('/no match for [\'‘]operator(.+?)[\'’]|invalid operands to binary expression|no viable overloaded|no match for call to/u', $m1, $m)) {
            return $this->sinOperador($m1, $m[1] ?? '', $b);
        }
        if (preg_match('/too (few|many) arguments to function|requires (?:single argument|\d+ arguments?),? but|no matching (?:function|constructor|member function) for|no viable constructor|could not convert [\'‘]|no matching conversion/u', $m1, $m) && !str_contains($m1, 'could not convert')) {
            return $this->noEncaja($ev, $m1, $b);
        }
        if (preg_match('/narrowing conversion|cannot be narrowed|narrowing/', $m1)) {
            return $mk('type-mismatch', 'Conversión que pierde información dentro de `{ }`', "Dentro de llaves (`int a{3.5};`, `vector<int>{1, 2.5}`) C++ **prohíbe las conversiones que pierden datos** (de `double` a `int`, de `int` a `char` si no cabe…). Es una protección de la inicialización uniforme.\n\nLo que en Java daría «possible lossy conversion» aquí solo ocurre con llaves; con `=` o paréntesis C++ trunca en silencio. Usa el tipo correcto (`double a{3.5};`) o un cast explícito: `static_cast<int>(x)`.",
                ['hint' => 'Convierte a propósito con `static_cast<int>(valor)` o cambia el tipo de la variable.'] + (($f = $this->fixesCompilador($ev)) !== [] ? ['fixes' => $f] : []));
        }
        if (preg_match('/invalid conversion from|cannot convert|cannot initialize|no viable conversion|conversion from .* to non-scalar|could not convert|incompatible|cannot bind|invalid initialization|incompatible pointer/u', $m1)) {
            return $this->noConvierte($m1, $b);
        }
        if (preg_match('/redundant|ambiguous/', $m1) && str_contains($m1, 'ambiguous')) {
            return $mk('ambiguous', 'La llamada es ambigua', "Hay **varias sobrecargas igual de buenas** para esos argumentos y el compilador no sabe cuál elegir (las notas las listan). Haz que un argumento coincida exactamente con una de ellas con un cast (`1.0` o `static_cast<double>(x)`) o elimina una sobrecarga.");
        }
        if (preg_match('/abstract class|abstract type/', $m1)) {
            return $mk('abstract', 'No se puede crear un objeto de una clase abstracta', "La clase tiene métodos **virtuales puros** (`virtual void f() = 0;`) sin implementar: es como una `interface`/`abstract class` de Java, y no se puede instanciar directamente. Crea una clase hija que implemente todos esos métodos (`override`) y usa esa.");
        }
        if (preg_match('/deduced type [\'‘]auto[\'’] requires an initializer|has no initializer/', $m1)) {
            return $mk('auto-no-init', '`auto` necesita un valor inicial', "`auto` deduce el tipo **del valor con que se inicializa**; sin valor no hay nada que deducir. Escribe `auto x = 0;` o el tipo explícito (`int x;`).");
        }
        if (preg_match('/invalid use of non-static member function|reference to non-static member function must be called/', $m1)) {
            return $mk('missing-call', 'Falta llamar al método con `()`', "Escribiste el nombre de un método sin paréntesis (`s.length` en vez de `s.length()`). En C++ **todos** los métodos se llaman con `()`, aunque no tengan argumentos; sin ellos nombras la función, no la ejecutas.\n\nEs distinto de Java para los arrays (`a.length` sin paréntesis) y de Python/PHP donde hay propiedades; en C++ los contenedores siempre usan métodos: `v.size()`, `s.length()`.", $this->fixesCompilador($ev) ? ['fixes' => $this->fixesCompilador($ev)] : []);
        }
        if (preg_match('/uninitialized|may be used uninitialized/', $m1)) {
            return $mk('uninitialized-variable', 'Variable sin inicializar', "Usas una variable local que **nunca recibió valor**. En C++ una `int x;` local contiene **basura** (lo que hubiera en esa memoria), no `0` como en Java para los campos ni un error como en Python. Inicialízala al declarar: `int x = 0;`.");
        }
        if (preg_match('/template constraint failure|required from|in instantiation of|std::__|_Tp\b|_Alloc/', $m1)) {
            return $this->plantilla($m1, $b);
        }
        $fb = $this->generico($code, $m1, $b);
        if (strlen($m1) > 250 || preg_match('/std::__|_Tp\b/', $msg)) {
            return $this->plantilla($m1, $b);
        }
        return $fb;
    }

    /** @param array<string,mixed> $b */
    private function generico(string $code, string $m1, array $b): array
    {
        return ['code' => $code !== '' ? $code : 'compile-error', 'title' => $this->corto($m1),
            'explain' => "El compilador de C++ da este error:\n\n```\n{$m1}\n```\n\nLos mensajes de g++/clang son largos pero la **primera línea** suele decir qué pasa y la línea/columna dónde. Las *notas* (`candidate:`, `declared here`) dan contexto. Corrige siempre el **primer** error: los siguientes suelen ser consecuencia suya."] + $b;
    }

    /**
     * Avisos (el programa compila).
     * @param array<string,mixed> $ev
     * @param array<string,mixed> $b
     */
    private function aviso(array $ev, string $m1, array $b): array
    {
        $flag = ltrim((string) ($ev['flag'] ?? $ev['code'] ?? ''), '-');
        $mk = static fn(string $c, string $t, string $e, array $x = []): array => ['code' => $c, 'title' => $t, 'explain' => $e] + $x + $b;
        $flag = (string) preg_replace('/^Werror=/', '', $flag);
        $flag = (string) preg_replace('/^W(?=[a-z])/', 'W', $flag);
        switch (true) {
            case str_contains($flag, 'sign-compare') || str_contains($m1, 'comparison of integer expressions of different signedness') || str_contains($m1, 'comparison of integers of different signs'):
                return $mk('sign-compare', 'Comparas un entero con signo y otro sin signo', "`v.size()` devuelve un **`size_t`** (entero *sin signo*), pero `i` es un `int` (con signo). Al compararlos, el `int` se convierte a sin signo: un **-1 se vuelve 18 446 744 073 709 551 615**. Aquí no falla, pero con negativos da resultados absurdos (`i < v.size()` sería cierto para `i = -1`... al revés de lo esperado).\n\nEn Java o Python esto no existe (todos los enteros llevan signo). En C++ lo normal es usar `size_t` (o `auto`) en los índices que recorren contenedores: `for (size_t i = 0; i < v.size(); i++)`, o mejor un `for (int x : v)`.",
                    ['hint' => 'Declara el índice como `size_t`, o recorre con `for (const auto& x : v)`.'] + $this->signCompareFix($b));
            case str_contains($flag, 'unused-variable') || str_contains($flag, 'unused-but-set'):
                return $mk('unused-variable', 'Variable que no se usa', "Declaras una variable pero nunca la lees. No es un error (el programa compila), pero suele indicar un descuido o código sobrante. Bórrala, o úsala.");
            case str_contains($flag, 'unused-parameter'):
                return $mk('unused-parameter', 'Parámetro que no se usa', "La función recibe un parámetro que nunca usa. Si es a propósito, quita su nombre en la definición (`int f(int)`) o márcalo con `[[maybe_unused]]`.");
            case str_contains($flag, 'maybe-uninitialized') || str_contains($flag, 'uninitialized'):
                return $mk('uninitialized-variable', 'Variable que puede usarse sin inicializar', "En algún camino se **lee la variable antes de darle valor**. En C++ una variable local sin inicializar contiene basura (no `0`, no `null`): el resultado cambia de ejecución en ejecución. Inicialízala al declararla: `int x = 0;`.");
            case str_contains($flag, 'return-type'):
                return $mk('missing-return', 'La función puede terminar sin `return`', "La función promete devolver un valor pero algún camino acaba sin `return`: **comportamiento indefinido** en C++. Añade el `return` que falta.");
            case str_contains($flag, 'shadow'):
                return $mk('shadowing', 'Esta variable oculta a otra del mismo nombre', "Declaras una variable con el mismo nombre que otra de un ámbito exterior (o un parámetro). Dentro de este bloque, la de fuera deja de ser accesible, y es fácil modificar la equivocada. Usa un nombre distinto.");
            case str_contains($flag, 'parentheses') || str_contains($m1, 'suggest parentheses around assignment'):
                return $mk('assign-in-condition', 'Asignación (`=`) donde esperabas una comparación (`==`)', "Escribiste **`=`** (asignar) dentro de una condición. En C++ eso compila (es una expresión que vale lo asignado), pero casi siempre quería ser **`==`**. En Java sería un error de tipos si no es `boolean`; aquí pasa en silencio y cambia el valor.", ['hint' => 'Para comparar usa `==`.']);
            case str_contains($flag, 'reorder'):
                return $mk('init-order', 'El orden de inicialización no coincide con el de declaración', "Los miembros se inicializan en el orden en que están **declarados en la clase**, no en el de la lista `: a(…), b(…)`. Pon la lista en el mismo orden para evitar leer un miembro aún sin inicializar.");
            case str_contains($flag, 'format'):
                return $mk('format-mismatch', 'El formato de `printf` no coincide con el argumento', "El especificador (`%d`, `%s`…) no corresponde al tipo del argumento. Con `std::cout` no tienes este problema: `cout << x` elige solo.");
            case str_contains($flag, 'narrowing'):
                return $mk('type-mismatch', 'Conversión que pierde información', "El valor no cabe exacto en el tipo destino y se trunca. Usa el tipo correcto o `static_cast<…>()` si es a propósito.");
            case str_contains($flag, 'unused-result'):
                return $mk('unused-result', 'Ignoras un resultado importante', "La función marca su resultado como importante (`[[nodiscard]]`) y no lo usas. Guárdalo o compruébalo.");
        }
        return $mk('warning', $this->corto($m1), "Aviso del compilador (el programa compila, pero conviene revisarlo):\n\n```\n{$m1}\n```");
    }

    /**
     * «'x' was not declared», «unknown type name 'string'», «no template named 'vector'»…
     * @param array<string,mixed> $b
     */
    private function noExiste(string $m1, string $name, array $b): array
    {
        $name = (string) preg_replace('/^std::/', '', $name);
        $mk = static fn(string $c, string $t, string $e, array $x = []): array => ['code' => $c, 'title' => $t, 'explain' => $e] + $x + $b;
        $dym = preg_match('/did you mean [\'‘](.+?)[\'’]/u', $m1, $m) ? $m[1] : null;
        $hdr = self::CABECERA[$name] ?? null;
        $esTipo = preg_match('/\b' . preg_quote($name, '/') . '\s*(?:<[^;]*>)?[*&\s]+\w+\s*[=;({,)]|\b' . preg_quote($name, '/') . '<.*>\s*\w+/', $b['line'] > 0 ? (explode("\n", $this->code)[$b['line'] - 1] ?? '') : '') === 1 && preg_match('/^[A-Z]/', $name) === 1
            || str_contains($m1, 'type name') || str_contains($m1, 'no template named') || str_contains($m1, 'does not name a type');
        $enStd = $dym !== null && str_starts_with($dym, 'std::') || $hdr !== null && !$this->declaradoPorUsuario($name);
        if ($enStd && $hdr !== null) {
            $fixes = [];
            $tieneHdr = (bool) preg_match('/^\s*#\s*include\s*<' . preg_quote($hdr, '/') . '>/m', $this->code);
            $usingStd = (bool) preg_match('/using\s+namespace\s+std\s*;/', $this->code);
            if (!$tieneHdr) {
                $fixes[] = $this->includeFix($hdr);
            }
            if (!$usingStd) {
                $fixes[] = ['title' => "Escribir `std::$name`", 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $b['col'], 'el' => $b['line'], 'ec' => $b['col']], 'text' => 'std::']]];
            }
            $explica = "**`$name`** es de la biblioteca estándar y vive en el espacio de nombres **`std`**, así que se escribe **`std::$name`** (o se pone `using namespace std;` arriba, cosa cómoda para ejercicios pero que en proyectos grandes se evita).";
            if (!$tieneHdr) {
                $explica .= "\n\nAdemás, hay que traer su cabecera con **`#include <$hdr>`**: C++ no «importa» módulos como Java (`import`) o Python (`import`); el `#include` **copia literalmente** el archivo de cabecera en tu código, y sin él el compilador no conoce el nombre.";
            }
            $explica .= "\n\nEn PHP, Python y Java los nombres de la biblioteca ya están disponibles o se importan por nombre; en C++ hacen falta las dos cosas: la cabecera y el `std::`.";
            return $mk($tieneHdr ? 'class-not-found' : 'class-not-found', $tieneHdr ? "Falta `std::` delante de `$name`" : "Falta `#include <$hdr>` para `$name`", $explica, ['fixes' => $fixes, 'hint' => "Pon `#include <$hdr>` arriba y escribe `std::$name`."]);
        }
        $pool = array_merge($this->nombresUsuario(), array_keys(self::CABECERA));
        $sug = $dym !== null ? [$dym] : $this->sugerir($name, $pool);
        $x = $sug !== [] ? ['suggestions' => $sug] : [];
        if ($sug !== [] && ($f = $this->renameFix($b, $name, $sug[0])) !== null) {
            $x['fixes'] = [$f];
        }
        if ($esTipo) {
            return $mk('class-not-found', "No existe el tipo «{$name}»", "El compilador no conoce el tipo **`$name`**. Causas habituales:\n\n1. **Está mal escrito** (C++ distingue mayúsculas: `string` ≠ `String`, `vector` ≠ `Vector`).\n2. **Falta el `#include`** de su cabecera, o el `std::`.\n3. Es una clase tuya declarada **más abajo**: en C++ hay que declarar antes de usar (no como en Java, donde el orden da igual).\n\nEn C++ no existen `String`, `Integer` ni `ArrayList`: son `std::string`, `int` y `std::vector`." . ($sug !== [] ? "\n\n¿Querías decir `{$sug[0]}`?" : ''), $x);
        }
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        $llamada = (bool) preg_match('/\b' . preg_quote($name, '/') . '\s*\(/', $linea);
        $code = $llamada ? 'undefined-method' : 'undefined-variable';
        $ex = $llamada
            ? "No existe ninguna función llamada **`$name`** visible en este punto. ¿Está bien escrita? ¿La definiste **antes** de usarla (en C++ el orden importa: si va después de `main`, necesita un prototipo arriba)? Si es de la biblioteca estándar, falta `#include` o `std::`."
            : "El compilador no conoce **`$name`** en este punto. Causas habituales:\n\n1. **Está mal escrito** (C++ distingue mayúsculas).\n2. **No la declaraste** antes de usarla, o la declaraste en **otro ámbito** `{ … }` que ya se cerró (una variable creada dentro de un `for` o un `if` desaparece al salir). A diferencia de Python o PHP, aquí no existen variables «globales por accidente».\n3. Es de la biblioteca estándar y falta `std::`.";
        if ($sug !== []) {
            $ex .= "\n\n¿Querías decir `" . $sug[0] . '`?';
        }
        return $mk($code, $llamada ? "No existe la función «{$name}»" : "No existe «{$name}» en este punto", $ex, $x);
    }

    /**
     * «has no member named 'x'», «no member named 'x' in 'T'».
     * @param array<string,mixed> $b
     */
    private function sinMiembro(string $m1, string $a, string $c, array $b): array
    {
        // gcc: "'class std::vector<int>' has no member named 'push_bak'" → ($a = miembro, $c = tipo); clang: "no member named 'x' in 'T'" → ($a = miembro)
        $miembro = $a;
        $tipo = $c;
        $tipo = trim((string) preg_replace('/^(?:class|struct|union)\s+/', '', $tipo));
        $dym = preg_match('/did you mean [\'‘](.+?)[\'’]/u', $m1, $m) ? $m[1] : null;
        $sug = $dym !== null ? [$dym] : $this->sugerir($miembro, str_contains($tipo, '::') || str_contains($tipo, '<') ? self::METODOS : array_merge(self::METODOS, $this->miembrosUsuario()));
        $x = $sug !== [] ? ['suggestions' => $sug] : [];
        if ($sug !== [] && ($f = $this->renameFix($b, $miembro, $sug[0])) !== null) {
            $x['fixes'] = [$f];
        }
        $ex = "El tipo `" . $this->corto($tipo, 60) . "` no tiene ningún miembro llamado **`$miembro`**. ¿Está bien escrito? Recuerda que en C++ los nombres de la biblioteca son en **minúsculas y con guion bajo**: `size()`, `push_back()`, `empty()`, `substr()`, no `length` ni `pushBack`.";
        if (preg_match('/^(length|size|count|len)$/i', $miembro) === 1) {
            $ex .= "\n\nSe usa `v.size()` (y `s.length()` o `s.size()` en `string`). No hay `.length` sin paréntesis como en Java para los arrays, ni `len(x)` como en Python.";
        }
        if (str_contains($tipo, 'vector') && in_array($miembro, ['add', 'append', 'push', 'put', 'addLast'], true)) {
            $ex .= "\n\nPara añadir al final de un `vector` se usa **`push_back`** (no `add` de Java, `append` de Python ni `[]=` de PHP).";
        }
        if ($sug !== []) {
            $ex .= "\n\n¿Querías decir `" . $sug[0] . '`?';
        }
        return ['code' => 'undefined-method', 'title' => "«{$this->corto($tipo, 40)}» no tiene «{$miembro}»", 'explain' => $ex] + $x + $b;
    }

    /**
     * Errores de sintaxis «expected …».
     * @param array<string,mixed> $ev
     * @param array<string,mixed> $b
     */
    private function esperaba(array $ev, string $m1, array $b): array
    {
        $mk = static fn(string $c, string $t, string $e, array $x = []): array => ['code' => $c, 'title' => $t, 'explain' => $e] + $x + $b;
        $notas = $ev['notes'] ?? [];
        if (preg_match('/^expected [\'‘]\}[\'’](?: at end of input)?$/u', $m1) || str_contains($m1, "at end of input")) {
            return $mk('parse.eof', 'Falta cerrar una llave `}`', "El archivo termina y todavía hay una llave **`{`** sin cerrar (la nota del compilador señala cuál). Cuenta las llaves de la función, la clase o el bloque `if`/`for`: cada `{` necesita su `}`. Un buen sangrado ayuda a ver dónde falta.", $notas !== [] ? ['hint' => 'Mira la nota: indica la llave abierta que nunca se cierra.'] : []);
        }
        // «; » olvidado
        $puntoComa = preg_match('/^expected [\'‘];[\'’]/u', $m1) || preg_match('/^expected [\'‘],[\'’] or [\'‘];[\'’]/u', $m1) || preg_match('/^expected [\'‘];[\'’] (?:after|at end|before)/u', $m1);
        if ($puntoComa) {
            $fixes = $this->fixesCompilador($ev, 'Añadir `;`');
            if ($fixes === []) {
                $fixes = $this->puntoComaFix($b);
            }
            return $mk('parse.semicolon', 'Falta un punto y coma `;`', "Falta un **`;`** al final de una sentencia. En C++ **toda** sentencia termina en `;` (no es opcional como en Python, y tampoco vale el salto de línea). El compilador se da cuenta al leer la **siguiente** cosa, por eso a veces señala la línea de debajo: el `;` falta al final de la línea **anterior**.\n\nOlvidar también el `;` tras la llave de un `struct` o `class` (`struct P { int x; };`) provoca errores raros.",
                ['hint' => 'Mira el final de la línea anterior a la marcada.'] + ($fixes !== [] ? ['fixes' => $fixes] : []));
        }
        if (preg_match('/^expected (?:primary-)?expression|^expected statement/', $m1)) {
            return $mk('parse.expected', 'Falta una expresión', "El compilador esperaba **un valor o una expresión** (`3`, `x + 1`, `f(a)`) y encontró otra cosa, por ejemplo `int x = ;`, un argumento vacío `f(1, )` o un `}` justo después de un `for (…)` sin cuerpo. Revisa lo que hay justo antes de la marca.");
        }
        if (preg_match('/^expected unqualified-id|^expected declaration/', $m1)) {
            return $mk('parse.expected', 'Aquí no puede ir esto', "En este punto (normalmente **fuera de una función**) solo pueden ir declaraciones y definiciones; el compilador encontró algo que no lo es. Causas típicas: una sentencia suelta fuera de `main`, una llave `}` de más, o un `;` olvidado tras una `class`/`struct` anterior.");
        }
        $q = preg_match('/^expected [\'‘]([^\'’]+)[\'’]/u', $m1, $mm) ? $mm[1] : (preg_match('/^expected (.+?)(?: before.*)?$/', $m1, $mm) ? $mm[1] : '?');
        return $mk('parse.expected', "Falta «$q»", "El compilador esperaba **`$q`** en este punto. Casi siempre es un `;` olvidado en la línea **anterior**, o un paréntesis `)`, llave `}` o ángulo `>` sin cerrar. Mira lo que hay justo antes de la marca.");
    }

    /**
     * Conversión de tipos imposibles.
     * @param array<string,mixed> $b
     */
    private function noConvierte(string $m1, array $b): array
    {
        $de = $a = '';
        if (preg_match('/from [\'‘](.+?)[\'’] to (?:non-scalar type )?[\'‘](.+?)[\'’]/u', $m1, $m)) {
            [$de, $a] = [$m[1], $m[2]];
        } elseif (preg_match('/type [\'‘](.+?)[\'’] with an? (?:lvalue|rvalue) of type [\'‘](.+?)[\'’]/u', $m1, $m)) {
            [$a, $de] = [$m[1], $m[2]];
        }
        $de = $this->tipoCorto($de);
        $a = $this->tipoCorto($a);
        $texto = $this->exprDespuesDeIgual($b);
        $fixes = [];
        $extra = '';
        $esNum = static fn(string $t): bool => (bool) preg_match('/^(?:int|long|short|unsigned|double|float|size_t|char|bool)\b/', $t);
        $esStr = static fn(string $t): bool => str_contains($t, 'string') || str_contains($t, 'char');
        if ($texto !== null && $esNum($de) && str_contains($a, 'string')) {
            $fixes[] = $this->envolver($b, $texto, 'std::to_string(', ')', 'Convertir con `std::to_string()`');
            $extra = "\n\nUn número no se convierte solo en texto (como sí hace `\"\" + n` en Java o `str()` implícito en PHP): usa **`std::to_string(n)`**.";
        } elseif ($texto !== null && preg_match('/^"/', $texto) && $esNum($a)) {
            $conv = str_contains($a, 'double') || str_contains($a, 'float') ? 'std::stod' : 'std::stoi';
            $fixes[] = $this->envolver($b, $texto, "$conv(", ')', "Convertir con `$conv()`");
            $extra = "\n\nPara pasar un texto a número se usa **`std::stoi`** (entero) o **`std::stod`** (decimal); C++ nunca convierte un `string` en `int` por su cuenta (PHP sí lo hace, Python lanza `TypeError`).";
        } elseif (str_contains($a, '*') && $esNum($de) && $texto !== null) {
            $extra = "\n\nUn puntero guarda una **dirección**, no un número: usa `nullptr` para «sin dirección», o `&variable` para la dirección de algo.";
        } elseif ($esNum($a) && $esNum($de) && $de !== $a) {
            $extra = "\n\nSi el cambio es a propósito, hazlo explícito con `static_cast<$a>(valor)`.";
        }
        $fixes = array_values(array_filter($fixes));
        return ['code' => 'type-mismatch', 'title' => $de !== '' && $a !== '' ? "No se puede convertir «{$de}» en «{$a}»" : 'Tipos incompatibles', 'explain' =>
            "C++ es de **tipado estático y estricto**: " . ($de !== '' ? "el valor es de tipo **`$de`** pero aquí hace falta **`$a`**" : 'el tipo del valor no coincide con el esperado') . ", y no hay conversión automática entre ellos. A diferencia de PHP, que convierte casi todo sobre la marcha, o de Python, donde las variables no tienen tipo fijo, el compilador exige que los tipos encajen **antes** de ejecutar." . $extra
            , 'hint' => 'Cambia el tipo de la variable o convierte el valor a propósito.'] + ($fixes !== [] ? ['fixes' => $fixes] : []) + $b;
    }

    /**
     * «no matching function for call to», «too few arguments»…
     * @param array<string,mixed> $ev
     * @param array<string,mixed> $b
     */
    private function noEncaja(array $ev, string $m1, array $b): array
    {
        $nombre = preg_match('/(?:function|constructor|member function)(?: for call)? (?:to|for initialization of) [\'‘]([^\'’(]+?)(?:\(|[\'’])/u', $m1, $m) ? $m[1] : (preg_match('/to function [\'‘](.+?)[\'’]/u', $m1, $m) ? preg_replace('/^.*? (\w+)\(.*$/', '$1', $m[1]) : 'la función');
        $notas = implode(' | ', array_map(static fn($n) => (string) ($n['msg'] ?? ''), (array) ($ev['notes'] ?? [])));
        $pocos = str_contains($m1, 'too few') || preg_match('/requires (?:single argument [\'‘]\w+[\'’]|\d+ arguments?),? but (?:no arguments|\d+ arguments? (?:was|were))? ?(?:provided)?/', $notas . ' ' . $m1) && (str_contains($notas, 'no arguments were provided') || preg_match('/but (\d+) (?:was|were) provided/', $notas, $mp) && preg_match('/requires (\d+)/', $notas, $mr) && (int) $mp[1] < (int) $mr[1]);
        $muchos = str_contains($m1, 'too many') || str_contains($notas, 'arguments were provided') && !$pocos || (bool) preg_match('/expects \d+ argument.*\d+ provided/', $notas) && !$pocos;
        $ctor = str_contains($m1, 'constructor') || preg_match('/::(\w+)\(/', $m1, $mc) && $nombre === ($mc[1] ?? '');
        $titulo = $pocos ? "Faltan argumentos al llamar a «{$nombre}»" : ($muchos ? "Sobran argumentos al llamar a «{$nombre}»" : "Ninguna versión de «{$nombre}» acepta esos argumentos");
        $ex = $pocos || $muchos
            ? "Llamas a **`$nombre`** con " . ($pocos ? '**menos**' : '**más**') . " argumentos de los que declara (la nota del compilador, `declared here` o `candidate`, muestra la firma real)."
            : "Llamas a **`$nombre`** con argumentos que no encajan con ninguna de sus declaraciones: revisa **cuántos** pasas y de **qué tipo** (las notas `candidate:` listan las versiones que existen y por qué falla cada una).";
        $ex .= "\n\nEn C++ no hay argumentos por nombre (como en Python) ni se toleran de más (como en PHP o JavaScript); a cambio sí puedes tener **varias versiones** (*sobrecargas*) con el mismo nombre. Para tener argumentos opcionales, declara un valor por defecto: `int f(int a, int b = 0)`.";
        if ($ctor) {
            $ex .= "\n\nSi es un **constructor**: al declarar `P p;` sin argumentos hace falta un constructor sin parámetros. En cuanto defines uno tuyo (`P(int a)`), el compilador deja de crear el constructor vacío por defecto.";
        }
        return ['code' => 'argument-type', 'title' => $titulo, 'explain' => $ex, 'hint' => 'Compara los argumentos de la llamada con la firma de la nota.'] + $b;
    }

    /**
     * «no match for operator…».
     * @param array<string,mixed> $b
     */
    private function sinOperador(string $m1, string $op, array $b): array
    {
        $op = trim($op);
        $enLib = str_contains($m1, '__x') || str_contains($m1, '__a') || str_contains($m1, '__y');
        $tipo = preg_match('/operand types are [\'‘].+?[\'’](?: \{aka [^}]+\})? and [\'‘](.+?)[\'’]/u', $m1, $m) ? $m[1] : '';
        if ($op === '<<' || $op === '>>' || str_contains($m1, "'std::cout") || str_contains($m1, 'cout <<')) {
            return ['code' => 'no-operator', 'title' => 'No se sabe imprimir ese tipo con `<<`', 'explain' => "`cout << x` solo funciona con tipos que tienen su **`operator<<`**: números, texto, y poco más. " . ($tipo !== '' ? "Para tu tipo **`$tipo`**" : 'Para tus tipos') . " tienes que definirlo (no hay `toString()`, `__str__` ni `__toString` automáticos):\n\n```cpp\nstd::ostream& operator<<(std::ostream& os, const $tipo& v) {\n    return os << v.campo;\n}\n```\n\nSi lo que imprimes es un `vector`, recórrelo con un `for` e imprime cada elemento.", 'hint' => 'Define `operator<<` para tu tipo, o imprime sus campos uno a uno.'] + $b;
        }
        if ($enLib || $op === '<') {
            return ['code' => 'no-operator', 'title' => 'Falta `operator<` para ordenar o comparar ese tipo', 'explain' => "`std::map`, `std::set`, `std::sort` y `std::priority_queue` necesitan **comparar** los elementos con `<`, y tu tipo no sabe hacerlo (no hay un `compareTo` ni `__lt__` automático). Define el operador dentro del `struct`:\n\n```cpp\nbool operator<(const S& o) const { return a < o.a; }\n```\n\no pasa un comparador (una lambda) al contenedor o a `sort`.", 'hint' => 'Añade `bool operator<(const T& o) const` a tu `struct`.'] + $b;
        }
        return ['code' => 'no-operator', 'title' => $op !== '' ? "El operador «{$op}» no existe para esos tipos" : 'Esos tipos no se pueden combinar con ese operador', 'explain' => "Aplicas " . ($op !== '' ? "**`$op`**" : 'un operador') . " a dos tipos para los que no está definido (por ejemplo, comparar un `std::string` con un `char` `'a'` en vez de con `\"a\"`, o sumar dos `struct`). C++ no inventa operadores: o los define el tipo, o hay que escribir tu propia versión (`operator$op`). Fíjate en las comillas: `'a'` es un carácter y `\"a\"` un texto."] + $b;
    }

    /**
     * Cascada de errores de plantillas.
     * @param array<string,mixed> $b
     */
    private function plantilla(string $m1, array $b): array
    {
        return ['code' => 'template-cascade', 'title' => 'Error dentro de una plantilla de la biblioteca (mira solo lo que señala tu código)', 'explain' => "Un error en el uso de una plantilla (`vector`, `map`, `sort`, `cout <<`…) hace que el compilador escriba mensajes **enormes** con nombres como `_Tp` o `std::__cxx11`. No te asustes: el problema casi siempre está en **tu** línea, no en la biblioteca.\n\nQué hacer:\n1. Lee la **primera** línea del error y la línea de tu código que se señala.\n2. Busca el `required from here` o la nota que apunta a tu archivo.\n3. Causas típicas: un tipo propio sin `operator<` (para `map`/`set`/`sort`) o sin `operator<<` (para `cout`), pasar un tipo equivocado a un contenedor o un `const` que no encaja.\n\nEs la contrapartida de las plantillas: se comprueban al instanciarse, y el error se ve desde dentro.\n\n```\n" . $this->corto($m1, 200) . "\n```", 'hint' => 'Ignora el ruido y mira la línea de tu archivo que se señala.'] + $b;
    }

    // ═══════════════════════════ ejecución ═══════════════════════════

    /**
     * @param array<string,mixed> $ev
     * @param array<string,mixed> $b
     */
    private function runtime(string $kind, array $ev, array $b): array
    {
        $cls = (string) ($ev['cls'] ?? '');
        $msg = trim((string) ($ev['msg'] ?? ''));
        $mk = static fn(string $c, string $t, string $e, ?string $h = null, array $x = []): array => ['code' => $c, 'title' => $t, 'explain' => $e] + ($h !== null ? ['hint' => $h] : []) + $x + $b;
        $detalle = $msg !== '' ? "\n\n```\n{$msg}" . (isset($ev['detail']) ? "\n{$ev['detail']}" : '') . "\n```" : '';
        $alloc = isset($ev['allocLine']) ? " El bloque se reservó en la línea **{$ev['allocLine']}**." : '';
        $libre = isset($ev['freeLine']) ? " Se liberó en la línea **{$ev['freeLine']}**." : '';

        switch ($kind) {
            case 'timeout':
                $s = (int) ($ev['limit'] ?? 5);
                return $mk('timeout', "El programa tardó más de {$s} s y se detuvo", "El programa estuvo ejecutándose más de **{$s} segundos** y el playground lo detuvo. Casi siempre es un **bucle infinito** (la condición de `while`/`for` nunca se vuelve falsa, o falta actualizar la variable) o un algoritmo demasiado lento para esa entrada (mira el `O()` en el panel de análisis).\n\nRevisa: ¿la variable del bucle cambia en cada vuelta? ¿esperas leer con `cin` algo que no hay en «Entrada» (se queda bloqueado)? ¿una recursión sin caso base?", 'Imprime algo con `cout` dentro del bucle para ver si avanza.');
            case 'stack':
                return $this->pila($mk);
            case 'memory':
                return $mk('out-of-memory', 'Memoria agotada', "El programa pidió más memoria de la permitida (el límite del playground es **256 MB**): un `vector` que crece sin parar dentro de un bucle infinito, un tamaño enorme (`new int[1ull << 40]`, `vector<int> v(n)` con `n` gigante) o guardar todo en memoria cuando bastaría ir procesando.\n\nEn C++ puede lanzarse `std::bad_alloc` o abortar el programa; en Java sería `OutOfMemoryError`." . $detalle, 'Procesa los datos por trozos o usa tipos más pequeños (`int` en vez de `long long`).');
            case 'segfault':
                return $mk('member-on-null', 'Acceso a memoria no válida (segmentation fault)', "El programa leyó o escribió en una dirección de memoria que no es suya: un puntero a **`nullptr`** o sin inicializar, un índice muy fuera de rango, o memoria ya liberada. En Java esto sería una `NullPointerException` limpia con su línea; en C++ el sistema operativo mata el proceso." . $detalle, 'Comprueba `if (p != nullptr)` antes de usar un puntero y los índices contra `size()`.');
            case 'fpe':
                return $this->divisionCero($mk);
            case 'abort':
                return $this->abortar($cls, $msg, $mk);
            case 'leak':
                $bytes = (int) ($ev['bytes'] ?? 0);
                $objs = (int) ($ev['objects'] ?? 1);
                return $mk('memory-leak', 'Memoria que nunca se libera' . ($bytes > 0 ? " ({$bytes} bytes)" : ''), "Reservaste memoria con **`new`** (" . ($objs > 1 ? "$objs bloques" : 'un bloque') . ($bytes > 0 ? ", $bytes bytes en total" : '') . ") y nadie hizo el **`delete`** correspondiente, o se perdió el puntero antes de liberarlo. El programa termina igual, pero en uno largo la memoria no dejaría de crecer.\n\nJava, Python y PHP tienen recolector de basura; **C++ no**. Lo moderno es no usar `new`/`delete` a mano: usa contenedores (`vector`, `string`) o punteros inteligentes (`std::unique_ptr`, `std::make_unique<T>()`), que liberan solos al salir del ámbito.", 'Cambia `new T` por `std::make_unique<T>()`, o añade el `delete`/`delete[]` que falta.', ['severity' => 'warning']);
            case 'fatal':
                return ['code' => 'fatal', 'title' => $msg !== '' ? $this->corto($msg) : 'Error fatal', 'explain' => ''] + $b;
            case 'asan':
                return $this->asan($ev, $cls, $msg, $detalle, $alloc, $libre, $mk);
            case 'ubsan':
                return $this->ubsan($cls, $msg, $mk);
            case 'exception':
                return $this->excepcion($cls, $msg, $mk);
        }
        return ['code' => $kind !== '' ? $kind : 'runtime', 'title' => $this->corto($msg !== '' ? $msg : 'Error al ejecutar'), 'explain' => "```\n{$msg}\n```"] + $b;
    }

    private function pila(\Closure $mk): array
    {
        return $mk('stack-overflow', 'Desbordamiento de pila (¿recursión sin caso base?)', "Una función se llamó a sí misma (o se llamaron entre ellas) tantas veces que **se agotó la pila de llamadas** (256 MB). Cada llamada ocupa memoria hasta que termina.\n\nCausas típicas:\n- **Falta el caso base**: el `if` que detiene la recursión (`if (n <= 1) return 1;`).\n- **El argumento no se acerca al caso base** (llamas con `n` en vez de `n - 1`).\n- Un array grande como variable local (`int a[10000000];`) que no cabe en la pila: usa `std::vector`.\n\nEn Java sería `StackOverflowError`, en Python `RecursionError` (a ~1000 niveles); C++ aguanta más profundidad pero termina igual. Si la recursión es legítima y muy profunda, conviértela en un bucle con una `std::stack`.", 'Mira en la traza qué función se repite: ahí falta el caso base.');
    }

    private function divisionCero(\Closure $mk): array
    {
        return $mk('division-by-zero', 'División entera entre cero', "Una división (`/`) o un resto (`%`) de **enteros** tiene **0** como divisor y el programa se detiene. En C++ eso es *comportamiento indefinido* (normalmente el procesador lanza una señal y el programa muere).\n\nCon decimales (`double`) no se detiene: `1.0 / 0` da `inf`. Python y PHP lanzan una excepción (`ZeroDivisionError`, `DivisionByZeroError`); Java, `ArithmeticException`.", 'Comprueba `if (divisor != 0)` antes de dividir.');
    }

    private function abortar(string $cls, string $msg, \Closure $mk): array
    {
        if ($cls === 'assert') {
            return $mk('assert', 'Falla un `assert`', "Una comprobación **`assert(condición)`** no se cumple y el programa se abortó. `assert` es una red de seguridad para el programador: «esto *debe* ser cierto en este punto». Cuando falla, lo que se rompió es una suposición de tu código (o de los datos de entrada).\n\n```\n$msg\n```\n\nEs como `assert` de Python o `assert` de Java con `-ea`; la diferencia es que en C++ se desactiva con `-DNDEBUG` en compilaciones de producción.", 'Mira la condición escrita en el mensaje y averigua por qué es falsa.');
        }
        if ($cls === 'glibcxx-assert') {
            return $mk('index-out-of-range', 'Índice fuera de rango en un contenedor', "La biblioteca estándar detectó un uso incorrecto y abortó el programa:\n\n```\n$msg\n```\n\nLo más habitual: `v[i]` con `i >= v.size()` (o `v.front()` / `v.back()` de un `vector` vacío). **`operator[]` no comprueba nada** en C++: leer fuera del vector no lanza excepción como en Java o Python (`IndexError`); es comportamiento indefinido. Si quieres que se compruebe, usa **`v.at(i)`**, que lanza `std::out_of_range`.", 'Recorre con `i < v.size()` y usa `v.at(i)` mientras depuras.');
        }
        return $mk('abort', 'El programa se abortó', "Algo llamó a `abort()` (o a `std::terminate`): normalmente un `assert` que no se cumple, una excepción lanzada dentro de un destructor o `noexcept`, o una comprobación de la biblioteca (como un índice fuera de rango)." . ($msg !== '' ? "\n\n```\n$msg\n```" : ''), null);
    }

    /**
     * @param array<string,mixed> $ev
     */
    private function asan(array $ev, string $cls, string $msg, string $detalle, string $alloc, string $libre, \Closure $mk): array
    {
        $d = (string) ($ev['detail'] ?? '');
        $lectura = ($ev['access'] ?? '') === 'WRITE' ? 'escribió' : 'leyó';
        switch ($cls) {
            case 'heap-buffer-overflow':
            case 'stack-buffer-overflow':
            case 'global-buffer-overflow':
                $donde = $cls === 'heap-buffer-overflow' ? 'un `vector` o un bloque reservado con `new`' : ($cls === 'stack-buffer-overflow' ? 'un array local (`int a[5]`)' : 'un array global');
                return $mk('index-out-of-range', 'Índice fuera de rango: accedes más allá del final', "El programa $lectura una posición que está **fuera de los límites** de $donde" . ($d !== '' ? " ($d)" : '') . ".$alloc\n\nEn Java o Python un índice incorrecto lanza una excepción clara (`ArrayIndexOutOfBoundsException`, `IndexError`). En C++ **`v[i]` y `a[i]` no comprueban nada**: leen o escriben en la memoria vecina y el programa puede dar basura, corromper datos o cerrarse más tarde (aquí lo detectó AddressSanitizer). El error típico es `i <= v.size()` en vez de `i < v.size()`: un vector de 10 elementos tiene los índices del **0 al 9**." . $detalle, 'Comprueba el límite del bucle (`<` y no `<=`) o usa `v.at(i)`, que lanza una excepción.');
            case 'heap-use-after-free':
                return $mk('use-after-free', 'Uso de memoria ya liberada', "El programa $lectura memoria que **ya se había liberado** con `delete` (o cuyo `vector` se reasignó).$alloc$libre\n\nTras `delete p;` el puntero `p` sigue apuntando al mismo sitio, pero esa memoria ya no es tuya (*puntero colgante*). Además, guardar una referencia, un puntero o un iterador a un elemento de un `vector` y luego hacer `push_back` puede invalidarlo si el vector crece. Java/Python/PHP no tienen este problema porque el recolector no libera nada que aún se use." . $detalle, 'Tras `delete p;` pon `p = nullptr;`, o mejor usa `unique_ptr`/`vector` y no uses `delete` a mano.');
            case 'attempting':
            case 'double-free':
            case 'attempting-double-free':
                return $mk('double-free', 'Memoria liberada dos veces (double free)', "Hiciste **`delete` dos veces** sobre el mismo bloque de memoria.$alloc$libre\n\nLiberar dos veces corrompe el gestor de memoria. Suele pasar cuando dos punteros apuntan al mismo objeto y ambos hacen `delete`, o al copiar un objeto que contiene un puntero crudo (se copia la dirección, no el dato). Con `unique_ptr` (un solo dueño) o `shared_ptr` (cuenta de dueños) el problema desaparece." . $detalle, 'Un bloque, un dueño: usa `std::unique_ptr` en lugar de `new`/`delete`.');
            case 'stack-overflow':
                return $this->pila($mk);
            case 'SEGV':
                return $mk('member-on-null', 'Acceso a un puntero nulo o inválido', "El programa $lectura una dirección de memoria que no es válida: casi seguro un puntero a **`nullptr`** (o sin inicializar) que se usa con `*p` o `p->campo`. En Java sería una `NullPointerException` con la línea exacta; en C++ es comportamiento indefinido." . $detalle, 'Comprueba `if (p != nullptr)` antes de usarlo, e inicializa los punteros (`T* p = nullptr;`).');
            case 'alloc-dealloc-mismatch':
                return $mk('alloc-mismatch', '`new` y `delete` que no se corresponden', "Liberaste con una forma de `delete` que no corresponde a cómo reservaste. La regla: **`new` → `delete`**, **`new[]` → `delete[]`**, **`malloc` → `free`**. Mezclarlas es comportamiento indefinido." . $detalle, 'Si reservaste con `new int[n]`, libera con `delete[] p;`. Mejor: `std::vector<int>`.');
            case 'stack-use-after-scope':
            case 'stack-use-after-return':
                return $mk('dangling-reference', 'Usas una variable que ya no existe', "Guardaste la dirección (o una referencia) de una **variable local** y la usas después de que su función o bloque terminó. Las locales viven en la pila y desaparecen al salir del ámbito; el puntero queda apuntando a basura.\n\nEn Java, Python y PHP un objeto vive mientras alguien lo referencie; en C++ **tú** debes garantizarlo. Devuelve el valor por copia (`return v;`), no su dirección." . $detalle, 'No devuelvas punteros ni referencias a variables locales: devuelve el valor.');
            case 'out-of-memory':
            case 'allocation-size-too-big':
                return $mk('out-of-memory', 'Memoria agotada', "El programa pidió más memoria de la permitida (256 MB) o un tamaño imposible." . $detalle, 'Reduce el tamaño de la reserva o procesa por trozos.');
        }
        return $mk('asan-' . $cls, 'Error de memoria: ' . $cls, "AddressSanitizer detectó un error de memoria que en Java o Python sería una excepción clara, pero que en C++ es **comportamiento indefinido**." . $detalle);
    }

    private function ubsan(string $cls, string $msg, \Closure $mk): array
    {
        $det = "\n\n```\n$msg\n```";
        switch ($cls) {
            case 'signed-integer-overflow':
                return $mk('overflow', 'Desbordamiento de entero (el resultado no cabe en el tipo)', "Un cálculo con `int` (32 bits, máximo **2 147 483 647**) se salió del rango. En C++ el desbordamiento de enteros **con signo** es comportamiento *indefinido* (en la práctica da la vuelta a un número negativo, pero el compilador puede asumir que nunca ocurre). Python no tiene este problema (enteros de tamaño ilimitado); en Java el `int` da la vuelta sin avisar." . $det . "\n\nUsa `long long` (64 bits), o comprueba antes de operar. Para factoriales, Fibonacci o sumas grandes, cambia el tipo de todas las variables implicadas.", 'Cambia `int` por `long long` en las variables del cálculo.');
            case 'division-by-zero':
                return $this->divisionCero($mk);
            case 'out-of-bounds':
                return $mk('index-out-of-range', 'Índice fuera de los límites del array', "Accedes a una posición que no existe en un array de tamaño fijo. Los índices válidos van de **0 a n-1**. En C++ los arrays no comprueban el límite (Java lanzaría `ArrayIndexOutOfBoundsException`; Python, `IndexError`)." . $det, 'Revisa el límite del bucle: `i < n`, no `i <= n`.');
            case 'null':
                return $mk('member-on-null', 'Uso de un puntero nulo', "Usas un puntero que vale **`nullptr`** (o una referencia ligada a uno): acceso a un miembro (`p->x`), desreferencia (`*p`) o llamada a un método. En Java sería `NullPointerException`; en Python `AttributeError: 'NoneType'…`. En C++ es comportamiento indefinido (suele cerrar el programa)." . $det . "\n\nSi viene de `v.front()`, `v.back()` o `*it` sobre un contenedor **vacío**, la causa es esa: no hay elementos.", 'Comprueba `if (p)` / `!v.empty()` antes de usarlo.');
            case 'shift':
                return $mk('shift', 'Desplazamiento de bits no válido', "Un `<<` o `>>` usa un número de bits negativo o igual o mayor que el ancho del tipo (en un `int`, 32). Es comportamiento indefinido. Para valores grandes usa `1LL << n` (64 bits)." . $det);
            case 'missing-return':
                return $mk('missing-return', 'La función terminó sin devolver un valor', "Una función con tipo de retorno llegó al final **sin ejecutar `return`**: comportamiento indefinido. Añade el `return` que falta en todos los caminos." . $det);
            case 'float-cast-overflow':
                return $mk('overflow', 'El número decimal no cabe en el entero', "Conviertes un `double` a un entero y su valor queda fuera del rango del tipo destino (o es `inf`/`NaN`)." . $det);
            case 'vla-bound':
                return $mk('argument-value', 'Tamaño de array no válido', "El tamaño de un array de longitud variable es cero o negativo. Usa `std::vector<int> v(n);`, que gestiona el tamaño." . $det);
        }
        return $mk('undefined-behavior', 'Comportamiento indefinido', "UndefinedBehaviorSanitizer detectó **comportamiento indefinido**: el estándar de C++ no dice qué debe pasar, y el programa puede hacer cualquier cosa (funcionar «bien» hoy y fallar mañana)." . $det);
    }

    private function excepcion(string $cls, string $msg, \Closure $mk): array
    {
        $t = (string) preg_replace('/^std::/', '', $cls);
        $cuerpo = $msg !== '' ? "\n\n```\n{$cls}: {$msg}\n```" : '';
        $fin = "\n\nUna excepción que **nadie captura** hace que el programa termine (`terminate`). Se captura con `try { … } catch (const std::exception& e) { cout << e.what(); }`.";
        $titulo = static fn(string $t0): string => $t0 . ($msg !== '' ? ': ' . (mb_strlen($msg) > 90 ? mb_substr($msg, 0, 89) . '…' : $msg) : '');
        switch ($t) {
            case 'out_of_range':
                return $mk('index-out-of-range', $titulo('Índice fuera de rango (out_of_range)'), "Un método comprobado (`v.at(i)`, `s.substr(pos)`, `map.at(clave)`, `stoi` con un número gigante) recibió una posición o clave que **no existe**. A diferencia de `v[i]`, que no comprueba nada, `at` sí lanza `std::out_of_range`: es el equivalente al `IndexError`/`KeyError` de Python o a `IndexOutOfBoundsException` de Java." . $cuerpo . $fin, 'Comprueba `i < v.size()` o `m.count(clave)` antes de acceder.');
            case 'invalid_argument':
                $num = str_contains($msg, 'sto') || preg_match('/^(?:stoi|stol|stoll|stod|stof|stoul)/', $msg);
                return $mk($num ? 'invalid-number' : 'argument-value', $titulo($num ? 'El texto no es un número' : 'Argumento no válido (invalid_argument)'), $num
                    ? "`std::stoi`, `std::stod`… no pudieron convertir el texto en número: no empieza por dígitos (por ejemplo `\"abc\"` o `\"\"`). Es el `ValueError` de `int(\"abc\")` en Python o la `NumberFormatException` de Java; PHP, en cambio, devuelve `0` sin avisar." . $cuerpo . $fin
                    : "Una función de la biblioteca recibió un argumento que no acepta." . $cuerpo . $fin, 'Valida el texto antes de convertirlo, o captura la excepción con `try/catch`.');
            case 'bad_alloc':
                return $mk('out-of-memory', 'Memoria agotada (bad_alloc)', "Una reserva de memoria (`new`, o un `vector`/`string` que crece) falló porque se pidió más de lo disponible: un tamaño enorme o un bucle que no termina." . $cuerpo . $fin, 'Revisa el tamaño que pides y que el bucle termine.');
            case 'length_error':
                return $mk('argument-value', $titulo('Tamaño demasiado grande (length_error)'), "Se pidió un contenedor (`vector`, `string`) con más elementos de los permitidos; suele ser un tamaño **negativo convertido a `size_t`** (un `-1` se vuelve 18 trillones)." . $cuerpo . $fin);
            case 'domain_error':
            case 'logic_error':
            case 'runtime_error':
            case 'overflow_error':
            case 'underflow_error':
            case 'range_error':
                return $mk('uncaught-exception', $titulo("Excepción sin capturar ($t)"), "El código (o la biblioteca) lanzó una excepción con `throw $t(\"…\")` y nada la captura." . $cuerpo . $fin, 'Mira el mensaje y el lugar donde se lanza (traza); captura con `try/catch` si es recuperable.');
            case 'bad_optional_access':
                return $mk('null-value', 'Se pidió el valor de un `optional` vacío', "Llamaste a `.value()` sobre un `std::optional` **sin valor** (equivale a un `null`/`None`). Comprueba antes con `if (o)` o `o.has_value()`, o usa `o.value_or(valor_por_defecto)`." . $cuerpo . $fin);
            case 'bad_variant_access':
            case 'bad_function_call':
            case 'bad_cast':
            case 'bad_weak_ptr':
                return $mk('uncaught-exception', "Excepción sin capturar ($t)", match ($t) {
                    'bad_function_call' => 'Llamaste a un `std::function` vacío (sin función asignada).',
                    'bad_variant_access' => 'Pediste de un `std::variant` un tipo distinto del que contiene en este momento.',
                    'bad_weak_ptr' => 'Convertiste en `shared_ptr` un `weak_ptr` cuyo objeto ya se destruyó.',
                    default => 'Un `dynamic_cast` a referencia falló: el objeto no es del tipo pedido.',
                } . $cuerpo . $fin);
        }
        if (in_array($cls, ['int', 'long', 'double', 'char', 'float', 'bool', 'const char*', 'char const*', 'std::string', 'string'], true) || !str_contains($cls, 'std::') && $cls !== '' && !preg_match('/[A-Z_a-z]/', $cls[0])) {
            return $mk('uncaught-exception', $titulo("Excepción sin capturar (se lanzó un `$cls`)"), "Se hizo `throw` de un valor de tipo **`$cls`** (en C++ se puede lanzar cualquier tipo, no solo clases de excepción como en Java o Python) y nada lo capturó con `catch`." . $cuerpo . $fin);
        }
        return $mk('uncaught-exception', $titulo('Excepción sin capturar' . ($cls !== '' ? " ($cls)" : '')), "Se lanzó una excepción (**`$cls`**) y nada la capturó con `try { … } catch`, así que el programa terminó." . $cuerpo . $fin, 'Mira el mensaje y la traza para ver dónde se lanza.');
    }

    // ═══════════════════════════ arreglos y utilidades ═══════════════════════════

    /**
     * Los fix-its del compilador (gcc/clang -fdiagnostics-parseable-fixits) como arreglo rápido.
     * @param array<string,mixed> $ev
     * @return list<array<string,mixed>>
     */
    private function fixesCompilador(array $ev, string $titulo = 'Aplicar la sugerencia del compilador'): array
    {
        $edits = [];
        foreach ((array) ($ev['fixits'] ?? []) as $f) {
            if (!is_array($f) || !isset($f['sl'], $f['sc'], $f['el'], $f['ec'])) {
                continue;
            }
            $edits[] = ['range' => ['sl' => (int) $f['sl'], 'sc' => (int) $f['sc'], 'el' => (int) $f['el'], 'ec' => (int) $f['ec']], 'text' => (string) ($f['text'] ?? '')];
        }
        return $edits === [] ? [] : [['title' => $titulo, 'edits' => $edits]];
    }

    /** `#include <x>` tras el último `#include` (o al principio). @return array<string,mixed> */
    private function includeFix(string $hdr): array
    {
        $ultima = 0;
        foreach (explode("\n", $this->code) as $i => $l) {
            if (preg_match('/^\s*#\s*include\b/', $l)) {
                $ultima = $i + 1;
            }
        }
        $ln = $ultima + 1;
        return ['title' => "Añadir `#include <$hdr>`", 'edits' => [['range' => ['sl' => $ln, 'sc' => 1, 'el' => $ln, 'ec' => 1], 'text' => "#include <$hdr>\n"]]];
    }

    /** Renombrado de $name por $nuevo en la línea del diagnóstico. @return ?array<string,mixed> */
    private function renameFix(array $b, string $name, string $nuevo): ?array
    {
        if (str_contains($nuevo, '::') && !str_contains($name, '::') && !preg_match('/^[\w:]+$/', $nuevo)) {
            return null;
        }
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        if (!preg_match('/^[\x00-\x7f]*$/', $linea)) {
            return null;
        }
        $pos = null;
        $off = 0;
        while (($p = strpos($linea, $name, $off)) !== false) {
            if (!preg_match('/\w/', $linea[$p - 1] ?? ' ') && !preg_match('/\w/', $linea[$p + strlen($name)] ?? ' ')) {
                $pos = $p;
                if ($p + 1 >= $b['col'] - 1) {
                    break;
                }
            }
            $off = $p + 1;
        }
        if ($pos === null) {
            return null;
        }
        return ['title' => "Cambiar por `$nuevo`", 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $pos + 1, 'el' => $b['line'], 'ec' => $pos + 1 + strlen($name)], 'text' => $nuevo]]];
    }

    /** `;` al final de la última línea con texto anterior a la marcada (gcc no da fix-it con «expected ',' or ';'»). @return list<array<string,mixed>> */
    private function puntoComaFix(array $b): array
    {
        $lineas = explode("\n", $this->code);
        for ($n = $b['line'] - 1; $n >= 1; $n--) {
            $t = rtrim($lineas[$n - 1] ?? '');
            if ($t === '' || str_starts_with(ltrim($t), '//')) {
                continue;
            }
            if (!preg_match('/^[\x00-\x7f]*$/', $t) || preg_match('/[;{}:]$/', $t) || str_starts_with(ltrim($t), '#')) {
                return [];
            }
            return [['title' => 'Añadir `;`', 'edits' => [['range' => ['sl' => $n, 'sc' => strlen($t) + 1, 'el' => $n, 'ec' => strlen($t) + 1], 'text' => ';']]]];
        }
        return [];
    }

    /** `.`↔`->` en la marca del diagnóstico. @return array<string,mixed> */
    private function flechaFix(array $b, string $nuevo): array
    {
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        $antes = $nuevo === '->' ? '.' : '->';
        $p = strpos($linea, $antes, max(0, $b['col'] - 2));
        if ($p === false || !preg_match('/^[\x00-\x7f]*$/', $linea)) {
            return [];
        }
        return ['fixes' => [['title' => "Usar `$nuevo`", 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $p + 1, 'el' => $b['line'], 'ec' => $p + 1 + strlen($antes)], 'text' => $nuevo]]]]];
    }

    /** `auto v = u;` → `auto v = std::move(u);`. @return array<string,mixed> */
    private function moveFix(array $b): array
    {
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        if (preg_match('/=\s*(\w+)\s*;/', $linea, $m, PREG_OFFSET_CAPTURE) && preg_match('/^[\x00-\x7f]*$/', $linea)) {
            $p = $m[1][1];
            return ['fixes' => [['title' => "Mover con `std::move({$m[1][0]})`", 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $p + 1, 'el' => $b['line'], 'ec' => $p + 1 + strlen($m[1][0])], 'text' => "std::move({$m[1][0]})"]]]]];
        }
        return [];
    }

    /** Sustituye la primera palabra $de por $a en la línea. @return list<array<string,mixed>> */
    private function sustituirFix(array $b, string $de, string $a, string $titulo): array
    {
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        if (preg_match('/\b' . preg_quote($de, '/') . '\b/', $linea, $m, PREG_OFFSET_CAPTURE)) {
            return [['title' => $titulo, 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $m[0][1] + 1, 'el' => $b['line'], 'ec' => $m[0][1] + 1 + strlen($de)], 'text' => $a]]]];
        }
        return [];
    }

    /** `for (int i = …; i < v.size()…` → `size_t`. @return array<string,mixed> */
    private function signCompareFix(array $b): array
    {
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        if (preg_match('/for\s*\(\s*(int)\s+(\w+)\s*=/', $linea, $m, PREG_OFFSET_CAPTURE)) {
            $p = $m[1][1];
            return ['fixes' => [['title' => 'Declarar `' . $m[2][0] . '` como `size_t`', 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $p + 1, 'el' => $b['line'], 'ec' => $p + 4], 'text' => 'size_t']]]]];
        }
        return [];
    }

    /** Expresión a la derecha del primer `=` (hasta el `;`) en la línea del diagnóstico: [texto, columna inicial 1-based, columna final]. */
    private function exprDespuesDeIgual(array $b): ?string
    {
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        return preg_match('/(?<![=!<>])=(?!=)\s*(.+?)\s*;/', $linea, $m) ? $m[1] : null;
    }

    /** Envuelve la expresión tras `=` con prefijo y sufijo. @return ?array<string,mixed> */
    private function envolver(array $b, string $expr, string $pre, string $post, string $titulo): ?array
    {
        $linea = explode("\n", $this->code)[$b['line'] - 1] ?? '';
        $p = strpos($linea, $expr, (int) strpos($linea, '='));
        if ($p === false || !preg_match('/^[\x00-\x7f]*$/', $linea) || !preg_match('/^[\w."\'\s+-]+$/', $expr)) {
            return null;
        }
        return ['title' => $titulo, 'edits' => [['range' => ['sl' => $b['line'], 'sc' => $p + 1, 'el' => $b['line'], 'ec' => $p + 1 + strlen($expr)], 'text' => $pre . $expr . $post]]];
    }

    private function tipoCorto(string $t): string
    {
        $t = (string) preg_replace('/\s*\{aka [^}]*\}|\s*\(aka [^)]*\)/', '', $t);
        $t = (string) preg_replace(['/^const char\s*\[\d+\]$/', '/^const char\s*\*$/', '/std::__cxx11::/', '/^std::string$/'], ['const char*', 'const char*', 'std::', 'std::string'], trim($t));
        return $t;
    }

    private function declaradoPorUsuario(string $name): bool
    {
        return (bool) preg_match('/\b(?:struct|class|enum|using|typedef|namespace)\s+' . preg_quote($name, '/') . '\b|\b' . preg_quote($name, '/') . '\s*[=({]\s*|\b(?:int|double|auto|void|bool|char)\s+' . preg_quote($name, '/') . '\b/', $this->code)
            && !preg_match('/\b(?:std::)?' . preg_quote($name, '/') . '\s*<|\bstd::' . preg_quote($name, '/') . '\b/', $this->code);
    }

    /** @return list<string> */
    private function nombresUsuario(): array
    {
        static $cache = [];
        $k = md5($this->code);
        if (!isset($cache[$k])) {
            $limpio = (string) preg_replace('~//[^\n]*|/\*.*?\*/|"(?:\\\\.|[^"\\\\])*"~s', ' ', $this->code);
            preg_match_all('/\b(?:int|long|short|double|float|char|bool|auto|size_t|string|void|struct|class|[A-Z]\w*|\w+>|\w+\*|\w+&)\s+[*&]?([A-Za-z_]\w*)\s*(?=[=;,(){\[:])/', $limpio, $m);
            $cache[$k] = array_values(array_unique($m[1]));
        }
        return $cache[$k];
    }

    /** @return list<string> */
    private function miembrosUsuario(): array
    {
        return $this->nombresUsuario();
    }

    /** @param list<string> $pool @return list<string> */
    private function sugerir(string $name, array $pool): array
    {
        $out = [];
        $ln = strtolower($name);
        $max = strlen($name) <= 2 ? 0 : (strlen($name) <= 3 ? 1 : (strlen($name) <= 6 ? 2 : 3));
        foreach (array_unique($pool) as $cand) {
            if ($cand === $name || strlen((string) $cand) > 255 || strlen($name) > 255) {
                continue;
            }
            $lc = strtolower((string) $cand);
            $d = $lc === $ln ? 0 : levenshtein($ln, $lc);
            if ($d <= $max) {
                $out[(string) $cand] = $d;
            }
        }
        asort($out);
        return array_slice(array_keys($out), 0, 3);
    }

    private function corto(string $t, int $max = 140): string
    {
        $t = trim(explode("\n", $t)[0]);
        return mb_strlen($t) > $max ? mb_substr($t, 0, $max - 1) . '…' : $t;
    }
}
