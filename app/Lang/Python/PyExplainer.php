<?php
declare(strict_types=1);

namespace Playground\Lang\Python;

use Playground\Core\Explains;

defined('PG_ROOT') or exit;

/**
 * Convierte un error de Python (de sintaxis, de ejecución, un aviso, un timeout...) en un diagnóstico explicado en español:
 * qué significa, por qué suele pasar, qué probar y, cuando se puede, un arreglo automático.
 *
 * Entrada (evento del harness): {kind:'parse'|'exception'|'stack'|'timeout'|'memory'|'warning'|'deprecated', cls, msg, line,
 *   col?, endLine?, endCol?, name?, candidates?, objType?, limit?, trace?}
 * Salida: {source, severity, code, line, col, endLine, endCol, title, message, explain, original, hint?, suggestions?, fixes?, trace?}
 * Los códigos coinciden con los de PHP cuando hay equivalente (undefined-variable, division-by-zero, undefined-key...).
 */
final class PyExplainer implements Explains
{
    /** Módulos habituales que se olvidan de importar: nombre usado en el código => línea de import. */
    private const IMPORTS = [
        'math' => 'import math', 'random' => 'import random', 'sys' => 'import sys', 'os' => 'import os', 're' => 'import re',
        'json' => 'import json', 'time' => 'import time', 'heapq' => 'import heapq', 'bisect' => 'import bisect',
        'itertools' => 'import itertools', 'functools' => 'import functools', 'collections' => 'import collections',
        'np' => 'import numpy as np', 'plt' => 'import matplotlib.pyplot as plt', 'deque' => 'from collections import deque',
        'Counter' => 'from collections import Counter', 'defaultdict' => 'from collections import defaultdict',
        'dataclass' => 'from dataclasses import dataclass', 'cache' => 'from functools import cache',
    ];

    /** Nombres que vienen de otros lenguajes => lo que se usa en Python. */
    private const OTROS = [
        'push' => 'append', 'length' => 'len(...)', 'size' => 'len(...)', 'add' => 'append', 'toUpperCase' => 'upper',
        'toLowerCase' => 'lower', 'substring' => '[inicio:fin]', 'contains' => 'in', 'charAt' => '[i]', 'equals' => '==',
        'println' => 'print', 'isEmpty' => 'len(x) == 0', 'trim' => 'strip', 'indexOf' => 'index o find', 'toString' => 'str(...)',
    ];

    /** @var list<string> */
    private array $lines;

    public function __construct(private readonly string $code, private readonly ?PythonLanguage $lang = null)
    {
        $this->lines = preg_split('/\R/', $code) ?: [''];
    }

    /** @param array<string,mixed> $ev */
    public function explain(array $ev): array
    {
        $kind = (string) ($ev['kind'] ?? 'exception');
        $cls = (string) ($ev['cls'] ?? '');
        $msg = trim((string) ($ev['msg'] ?? ''));
        $line = max(1, (int) ($ev['line'] ?? 1));

        $r = match (true) {
            $kind === 'parse' => $this->parse($cls, $msg, $line, $ev),
            $kind === 'timeout' => $this->timeout($line, (int) ($ev['limit'] ?? 5)),
            $kind === 'memory' => $this->memory($ev),
            $kind === 'stack' || $cls === 'RecursionError' => $this->recursion($line, $ev),
            $kind === 'warning' || $kind === 'deprecated' => $this->warning($cls, $msg, $line, $kind),
            default => $this->runtime($cls, $msg, $line, $ev),
        };

        $line = (int) ($r['line'] ?? $line);
        $range = $r['range'] ?? $this->evRange($ev, $line) ?? $this->codeRange($line);
        $title = (string) ($r['title'] ?? ($cls !== '' ? "{$cls}: {$msg}" : 'Error'));
        $severity = $r['severity'] ?? match ($kind) { 'warning' => 'warning', 'deprecated' => 'info', default => 'error' };
        $d = [
            'source' => $kind === 'parse' ? 'syntax' : 'runtime',
            'severity' => $severity,
            'code' => (string) ($r['code'] ?? 'generic'),
            'line' => $range['sl'], 'col' => $range['sc'], 'endLine' => $range['el'], 'endCol' => $range['ec'],
            'title' => $title, 'message' => $title,
            'explain' => (string) ($r['explain'] ?? ''),
            'original' => ($cls !== '' ? $cls . ': ' : '') . $msg,
        ];
        foreach (['hint', 'suggestions', 'fixes'] as $k) {
            if (!empty($r[$k])) {
                $d[$k] = $r[$k];
            }
        }
        if (!empty($ev['trace'])) {
            $d['trace'] = $ev['trace'];
        }
        return $d;
    }

    // ───────────────────────────── utilidades ─────────────────────────────

    private function text(int $n): string
    {
        return $this->lines[$n - 1] ?? '';
    }

    private static function u16(string $s): int
    {
        return (int) (strlen((string) @mb_convert_encoding($s, 'UTF-16LE', 'UTF-8')) / 2);
    }

    /** Columna (1-based, UTF-16) de un offset en bytes de la línea. */
    private function colAt(string $text, int $byteOffset): int
    {
        return self::u16(substr($text, 0, $byteOffset)) + 1;
    }

    /** @return ?array{sl:int,sc:int,el:int,ec:int} */
    private function evRange(array $ev, int $line): ?array
    {
        if (isset($ev['col'], $ev['endCol']) && (int) $ev['col'] > 0) {
            return ['sl' => $line, 'sc' => (int) $ev['col'], 'el' => (int) ($ev['endLine'] ?? $line), 'ec' => (int) $ev['endCol']];
        }
        return null;
    }

    /** @return array{sl:int,sc:int,el:int,ec:int} */
    private function codeRange(int $line): array
    {
        $text = $this->text($line);
        $trim = ltrim($text);
        $sc = $this->colAt($text, strlen($text) - strlen($trim));
        $ec = $this->colAt($text, strlen(rtrim($text)));
        return ['sl' => $line, 'sc' => $sc, 'el' => $line, 'ec' => max($ec, $sc + 1)];
    }

    /** Rango de la primera coincidencia de una expresión regular en una línea (el grupo $g). */
    private function find(int $line, string $re, int $g = 0, int $from = 0): ?array
    {
        $text = $this->text($line);
        if (!preg_match($re, $text, $m, PREG_OFFSET_CAPTURE, $from) || $m[$g][1] < 0) {
            return null;
        }
        [$s, $o] = $m[$g];
        return ['sl' => $line, 'sc' => $this->colAt($text, $o), 'el' => $line, 'ec' => $this->colAt($text, $o + strlen($s))];
    }

    /** @return array{title:string, edits:list<array<string,mixed>>} */
    private function fix(string $title, array $range, string $text): array
    {
        return ['title' => $title, 'edits' => [['range' => $range, 'text' => $text]]];
    }

    /** Línea donde insertar un import nuevo (tras docstring, __future__ e imports iniciales). */
    private function importEdit(string $stmt): ?array
    {
        $off = $this->lang?->insertionPoint($this->code, []) ?? 0;
        if ($off === 0) {
            return ['sl' => 1, 'sc' => 1, 'el' => 1, 'ec' => 1, 'text' => $stmt . "\n"];
        }
        $l = substr_count(substr($this->code, 0, $off), "\n") + 1;
        return $l < count($this->lines)
            ? ['sl' => $l + 1, 'sc' => 1, 'el' => $l + 1, 'ec' => 1, 'text' => $stmt . "\n"]
            : ['sl' => $l, 'sc' => 1000, 'el' => $l, 'ec' => 1000, 'text' => "\n" . $stmt];
    }

    /** @param list<string> $candidates @return list<string> */
    private function suggest(string $word, array $candidates, int $max = 3): array
    {
        $w = strtolower($word);
        $len = strlen($w);
        $limit = $len >= 8 ? 3 : max(1, min(3, intdiv($len, 3)));
        $scored = [];
        foreach (array_unique($candidates) as $c) {
            if (!is_string($c) || $c === '' || $c === $word) {
                continue;
            }
            $lc = strtolower($c);
            if (abs(strlen($lc) - $len) > $limit + 1) {
                continue;
            }
            $d = levenshtein($w, $lc);
            if ($d <= $limit) {
                $scored[$c] = $d;
            } elseif ($len >= 4 && (str_starts_with($lc, $w) || str_starts_with($w, $lc)) && abs(strlen($lc) - $len) <= 3) {
                $scored[$c] = $limit + 1;
            }
        }
        asort($scored);
        return array_slice(array_keys($scored), 0, $max);
    }

    private function short(string $s, int $n = 70): string
    {
        $s = trim($s);
        return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s;
    }

    private function osPip(string $req = 'requirements.txt'): string
    {
        return (DIRECTORY_SEPARATOR === '\\' ? '.venv\\Scripts\\python' : '.venv/bin/python') . ' -m pip install -r ' . $req;
    }

    // ───────────────────────────── errores de sintaxis ─────────────────────────────

    private function parse(string $cls, string $msg, int $line, array $ev): array
    {
        $text = $this->text($line);
        $sinC = static fn(string $t): string => rtrim((string) preg_replace('/\s+#[^\'"]*$/', '', $t));

        // Sangría
        if ($cls === 'TabError' || str_contains($msg, 'inconsistent use of tabs')) {
            return ['code' => 'parse.indent', 'title' => 'Mezcla de tabuladores y espacios',
                'explain' => 'En esta línea la sangría mezcla tabuladores y espacios, y Python no sabe cuántos niveles son. Usa **solo espacios** (4 por nivel). En el editor puedes convertirlos con «Convertir sangría en espacios».'];
        }
        if (str_starts_with($msg, 'unexpected indent')) {
            return ['code' => 'parse.indent', 'title' => 'Sangría inesperada',
                'explain' => 'Esta línea está más metida que la anterior sin que haya un `:` que abra un bloque. Alinéala con la línea de arriba, o revisa que la línea anterior no esté sin terminar.'];
        }
        if (str_starts_with($msg, 'unindent does not match')) {
            return ['code' => 'parse.indent', 'title' => 'La sangría no coincide con ningún bloque anterior',
                'explain' => 'Al "salir" de un bloque la sangría tiene que volver exactamente a la de algún bloque anterior (por ejemplo, 4 espacios o 8, no 6). Revisa los espacios al principio de esta línea.'];
        }
        if (preg_match("/expected an indented block after (.+?)(?: on line (\d+))?$/", $msg, $m)) {
            return ['code' => 'parse.indent', 'title' => 'Falta el bloque indentado',
                'explain' => sprintf('Después de %s tiene que haber al menos una línea **con sangría** (4 espacios más). Si todavía no sabes qué poner, escribe `pass` (no hace nada) para dejarlo pendiente.', "`{$m[1]}`"),
                'line' => $line];
        }

        // Python 2: print sin paréntesis
        if (preg_match("/Missing parentheses in call to 'print'/", $msg) && preg_match('/^(\s*)print\s+(.+?)\s*$/', $text, $m)) {
            return ['code' => 'parse.print', 'title' => '`print` necesita paréntesis',
                'explain' => 'En Python 3 `print` es una función: `print("hola")`, no `print "hola"`.',
                'fixes' => [$this->fix('Añadir los paréntesis', $this->codeRange($line), $m[1] . 'print(' . $m[2] . ')')]];
        }

        // else if / i++
        if (preg_match('/^\s*else\s+if\b/', $text)) {
            $rg = $this->find($line, '/\belse\s+if\b/');
            return ['code' => 'parse.else-if', 'title' => 'En Python es `elif`, no `else if`',
                'explain' => 'Para encadenar condiciones Python usa la palabra `elif` (de «else if»). Con `else if` el `else` espera ya un `:`.',
                'fixes' => $rg ? [$this->fix('Cambiar por `elif`', $rg, 'elif')] : []];
        }
        if (preg_match('/(?<![+\-\w])([A-Za-z_][\w.\[\]]*)\s*(\+\+|--)\s*$/', $sinC($text), $m, PREG_OFFSET_CAPTURE)) {
            $op = $m[2][0] === '++' ? '+=' : '-=';
            $rg = $this->find($line, '/(?<![+\-\w])[A-Za-z_][\w.\[\]]*\s*(?:\+\+|--)/');
            return ['code' => 'parse.increment', 'title' => 'Python no tiene `' . $m[2][0] . '`',
                'explain' => sprintf('En Python no existen los operadores `++` ni `--`. Para sumar uno se escribe `%s %s 1`.', $m[1][0], $op),
                'fixes' => $rg ? [$this->fix(sprintf('Cambiar por `%s %s 1`', $m[1][0], $op), $rg, sprintf('%s %s 1', $m[1][0], $op))] : []];
        }

        // Comillas tipográficas
        if (preg_match('/invalid character .(.). \(U\+([0-9A-F]+)\)/u', $msg, $m)) {
            $mapa = ["\u{201C}" => '"', "\u{201D}" => '"', "\u{2018}" => "'", "\u{2019}" => "'", "\u{2013}" => '-', "\u{2014}" => '-', "\u{00A0}" => ' '];
            $fixes = [];
            // se cambian todos los caracteres de este tipo de la línea, no solo el primero
            if (preg_match_all('/[\x{201C}\x{201D}\x{2018}\x{2019}\x{2013}\x{2014}\x{00A0}]/u', $text, $all, PREG_OFFSET_CAPTURE)) {
                $edits = [];
                foreach ($all[0] as [$ch, $off]) {
                    $c = $this->colAt($text, $off);
                    $edits[] = ['range' => ['sl' => $line, 'sc' => $c, 'el' => $line, 'ec' => $c + 1], 'text' => $mapa[$ch]];
                }
                $fixes = [['title' => 'Cambiar por los caracteres normales del teclado', 'edits' => $edits]];
            }
            return ['code' => 'parse.char', 'title' => "Carácter no válido en el código: «{$m[1]}»",
                'explain' => 'Aparece un carácter que se parece a uno de Python pero no lo es (típico al copiar y pegar desde Word o una web: comillas «curvas» o guiones largos). Escribe el carácter normal del teclado.',
                'fixes' => $fixes];
        }

        // Cadenas
        if (preg_match('/unterminated (triple-quoted )?string literal/', $msg, $m)) {
            $fixes = [];
            if (empty($m[1]) && isset($ev['col'])) {
                // comilla de apertura: el carácter que está en la columna del error
                $chars = preg_split('//u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
                $acc = 0;
                $q = '';
                foreach ($chars as $ch) {
                    if ($acc + 1 === (int) $ev['col']) {
                        $q = $ch;
                        break;
                    }
                    $acc += self::u16($ch);
                }
                if (($q === '"' || $q === "'") && preg_match('/^(.*?)([\)\]\},:\s]*)$/u', rtrim($text), $mm) && !str_contains(mb_substr($mm[1], (int) $ev['col']), $q)) {
                    $pos = strlen($mm[1]);
                    $col = $this->colAt($text, $pos);
                    $fixes = [$this->fix("Cerrar la cadena con {$q}", ['sl' => $line, 'sc' => $col, 'el' => $line, 'ec' => $col], $q)];
                }
            }
            return ['code' => 'parse.string', 'title' => empty($m[1]) ? 'Comillas sin cerrar' : 'Cadena de triple comilla sin cerrar',
                'explain' => empty($m[1])
                    ? 'Hay una cadena de texto que se abre con una comilla pero no se cierra en la misma línea. Comprueba que cada `"` o `\'` tiene su pareja y que las comillas del interior son de otro tipo o van escapadas (`\"`). Para textos de varias líneas usa triple comilla `"""`.'
                    : 'Una cadena de triple comilla (`"""` o `\'\'\'`) se abre pero nunca se cierra, así que Python sigue leyendo hasta el final del archivo. Añade la triple comilla de cierre.',
                'fixes' => $fixes];
        }

        // Paréntesis
        if (preg_match("/'(.)' was never closed/", $msg, $m)) {
            $fixes = [];
            $close = ['(' => ')', '[' => ']', '{' => '}'][$m[1]] ?? '';
            $balance = substr_count($text, $m[1]) - substr_count($text, $close);
            $next = $this->nextCodeLine($line);
            if ($close !== '' && $balance === 1 && !preg_match('/[,:\\\\]\s*$/', $sinC($text)) && ($next === null || $this->indentOf($next) <= $this->indentOf($line))) {
                $col = $this->colAt($text, strlen($sinC($text)));
                $fixes = [$this->fix("Añadir `{$close}` al final de la línea", ['sl' => $line, 'sc' => $col, 'el' => $line, 'ec' => $col], $close)];
            }
            return ['code' => 'parse.unclosed', 'title' => "Falta cerrar `{$m[1]}`",
                'explain' => sprintf('Se abrió `%s` aquí pero nunca se cierra con `%s`. Python sigue buscando el cierre en las líneas siguientes y por eso el error suele *aparecer* más abajo. Cuenta que cada apertura tiene su cierre.', $m[1], $close),
                'fixes' => $fixes];
        }
        if (preg_match("/unmatched '(.)'/", $msg, $m)) {
            return ['code' => 'parse.unmatched', 'title' => "Sobra `{$m[1]}`",
                'explain' => sprintf('Hay un `%s` que cierra algo que no se abrió (o que ya se cerró). Quita el sobrante o añade la apertura que falta.', $m[1])];
        }
        if (preg_match("/closing parenthesis '(.)' does not match opening parenthesis '(.)'/", $msg, $m)) {
            return ['code' => 'parse.closing', 'title' => "`{$m[1]}` no cierra a `{$m[2]}`",
                'explain' => 'Los paréntesis, corchetes y llaves tienen que cerrarse en el orden inverso al que se abrieron, y cada uno con su pareja: `( )`, `[ ]`, `{ }`.'];
        }

        // = en vez de ==
        if (preg_match("/Maybe you meant '==' (or ':=' )?instead of '='/", $msg)) {
            $r = $this->evRange($ev, $line) ?? $this->codeRange($line);
            $fixes = [];
            $t = $this->text($line);
            // el primer `=` suelto (no ==, <=, >=, !=, :=) dentro del rango del error
            if (preg_match('/(?<![=<>!:+\-*\/%&|^])=(?!=)/', $t, $mm, PREG_OFFSET_CAPTURE, 0)) {
                $c = $this->colAt($t, $mm[0][1]);
                if ($c >= $r['sc'] && $c < $r['ec']) {
                    $fixes = [$this->fix('Cambiar `=` por `==`', ['sl' => $line, 'sc' => $c, 'el' => $line, 'ec' => $c + 1], '==')];
                } elseif (preg_match('/^\s*(if|elif|while)\b.*?(?<![=<>!:+\-*\/%&|^])=(?!=)/', $t, $m2, PREG_OFFSET_CAPTURE)) {
                    $c = $this->colAt($t, $mm[0][1]);
                    $fixes = [$this->fix('Cambiar `=` por `==`', ['sl' => $line, 'sc' => $c, 'el' => $line, 'ec' => $c + 1], '==')];
                }
            }
            return ['code' => 'parse.assign-eq', 'title' => 'Usa `==` para comparar, `=` es para asignar',
                'explain' => 'En una condición hay que **comparar**, y eso se escribe con dos signos: `if x == 5:`. Con uno solo (`=`) Python entiende que quieres asignar un valor, y eso no se puede hacer ahí.',
                'fixes' => $fixes];
        }

        // Falta ':'
        if ($msg === "expected ':'") {
            $code = $sinC($text);
            $col = $this->colAt($text, strlen($code));
            return ['code' => 'parse.colon', 'title' => 'Falta `:` al final de la línea',
                'explain' => 'Las líneas que abren un bloque (`if`, `elif`, `else`, `for`, `while`, `def`, `class`, `try`, `except`, `with`...) terminan siempre en dos puntos `:`, y las líneas siguientes van con sangría.',
                'fixes' => [$this->fix('Añadir `:` al final de la línea', ['sl' => $line, 'sc' => $col, 'el' => $line, 'ec' => $col], ':')]];
        }

        // Otros mensajes conocidos
        $conocidos = [
            ['/Perhaps you forgot a comma/', 'parse.comma', 'Parece que falta una coma', 'Entre dos elementos de una lista, tupla, diccionario o argumentos de una llamada tiene que haber una coma. Revisa la zona marcada.'],
            ["/'return' outside function/", 'parse.outside', '`return` fuera de una función', '`return` solo se puede usar dentro de una función (`def`). Revisa la sangría: quizá esta línea se salió del bloque.'],
            ["/'(break|continue)' outside loop/", 'parse.outside', 'Fuera de un bucle', '`break` y `continue` solo valen dentro de un `for` o un `while`. Revisa la sangría.'],
            ['/expected \'except\' or \'finally\' block/', 'parse.try', 'Un `try` necesita su `except`', 'Todo bloque `try:` va seguido de al menos un `except` (o de un `finally`) con el mismo nivel de sangría.'],
            ['/invalid decimal literal|invalid syntax\. Perhaps/', 'parse.syntax', 'Sintaxis no válida', 'Python no entiende esta parte. Revisa que no falte un operador, una coma o un espacio (por ejemplo `2x` en vez de `2 * x`).'],
            ['/leading zeros in decimal integer/', 'parse.syntax', 'Números con ceros a la izquierda', 'En Python un entero no puede empezar por 0 (`007`). Quita los ceros: `7`.'],
            ['/cannot assign to (.+?)( here)?\b/', 'parse.assign', 'No se puede asignar ahí', 'A la izquierda del `=` tiene que haber un nombre de variable (o un elemento `x[i]`, un atributo `x.a`), no una expresión ni un valor.'],
            ['/positional argument follows keyword argument/', 'parse.args', 'Un argumento posicional detrás de uno con nombre', 'En una llamada, primero van los argumentos posicionales (`f(1, 2)`) y después los que llevan nombre (`f(1, b=2)`), nunca al revés.'],
            ['/f-string/', 'parse.fstring', 'Error dentro de una f-string', 'Revisa lo que hay entre llaves `{}` en la f-string: tiene que ser una expresión válida y las comillas interiores distintas de las exteriores.'],
            ['/unexpected EOF|expected an indented|invalid non-printable/', 'parse.eof', 'El archivo termina antes de tiempo', 'Python llegó al final del archivo en mitad de una instrucción. Suele faltar cerrar un paréntesis, unas comillas o el cuerpo de una función.'],
        ];
        foreach ($conocidos as [$re, $code, $title, $explain]) {
            if (preg_match($re, $msg)) {
                return ['code' => $code, 'title' => $title, 'explain' => $explain];
            }
        }
        return ['code' => 'parse.syntax', 'title' => 'Error de sintaxis',
            'explain' => sprintf('Python no puede entender esta línea (`%s`). Mira la zona subrayada y la línea anterior: lo más habitual es que falte o sobre un `:`, un paréntesis, una comilla o una coma.', $this->short($text)),
            'hint' => 'Mensaje original de Python: ' . $msg];
    }

    private function indentOf(int $line): int
    {
        $t = $this->text($line);
        return strlen($t) - strlen(ltrim($t));
    }

    private function nextCodeLine(int $line): ?int
    {
        for ($i = $line + 1; $i <= count($this->lines); $i++) {
            $t = trim($this->text($i));
            if ($t !== '' && $t[0] !== '#') {
                return $i;
            }
        }
        return null;
    }

    // ───────────────────────────── timeout, memoria, recursión ─────────────────────────────

    private function timeout(int $line, int $limit): array
    {
        $text = trim($this->text($line));
        return [
            'code' => 'timeout', 'title' => sprintf('Tiempo agotado: el programa no termina (límite %d s)', $limit),
            'explain' => sprintf('Tu código lleva más de %d segundo%s ejecutándose y el playground lo ha parado. Casi siempre es un **bucle infinito** o una recursión sin fin. Se cortó en la línea %d%s.', $limit, $limit === 1 ? '' : 's', $line, $text !== '' ? ': `' . $this->short($text, 80) . '`' : ''),
            'hint' => 'Revisa la condición del `while` más cercano: ¿la variable que comprueba cambia dentro del bucle? Si es un cálculo muy pesado, prueba con una entrada más pequeña. También puedes subir el límite de tiempo en la configuración.',
            'line' => $line,
        ];
    }

    private function memory(array $ev): array
    {
        $mb = (int) ($ev['limitMb'] ?? 256);
        return [
            'code' => 'out-of-memory', 'title' => 'Memoria agotada',
            'explain' => sprintf('El programa pidió más memoria de la permitida (%d MB). Suele ser una lista que crece sin límite dentro de un bucle infinito, una recursión sin caso base, o un dato demasiado grande (por ejemplo `[0] * 10**10`).', $mb),
            'hint' => 'Revisa los bucles que añaden elementos (`append`) y su condición de salida. Para recorrer muchos datos sin guardarlos todos usa un generador (`yield`) o `range`.',
        ];
    }

    private function recursion(int $line, array $ev): array
    {
        $fn = null;
        for ($i = $line; $i >= 1; $i--) {
            if (preg_match('/^\s*(?:async\s+)?def\s+(\w+)/', $this->text($i), $m)) {
                $fn = $m[1];
                break;
            }
        }
        return [
            'code' => 'stack-overflow', 'title' => 'Recursión infinita (RecursionError)',
            'explain' => ($fn ? sprintf('La función `%s()` se llama a sí misma sin parar y se supera el límite de llamadas anidadas de Python (unas 1000). ', $fn) : 'Una función se llama a sí misma sin parar y se supera el límite de llamadas anidadas de Python (unas 1000). ')
                . 'Casi siempre falta el **caso base** que corta la recursión, o el argumento no se acerca a él en cada llamada.',
            'hint' => 'Comprueba el `if` del caso base (`if n <= 1: return ...`) y que la llamada recursiva usa un valor más pequeño (`n - 1`, no `n`). Si de verdad necesitas mucha profundidad, usa un bucle.',
        ];
    }

    // ───────────────────────────── avisos ─────────────────────────────

    private function warning(string $cls, string $msg, int $line, string $kind): array
    {
        if ($cls === 'SyntaxWarning' && preg_match('/"is(?: not)?" with (?:a|.+?) literal/', $msg)) {
            $t = $this->text($line);
            $fixes = [];
            if (preg_match('/\bis\s+not\b(?=\s*(?:[\d"\'\[({-]|None\b))|(?<=\s)\bis\b(?!\s+not)(?=\s*(?:[\d"\'\[({]|-\d))/', $t, $m, PREG_OFFSET_CAPTURE)) {
                $neg = str_starts_with($m[0][0], 'is not') || preg_match('/^is\s+not/', $m[0][0]);
                $c = $this->colAt($t, $m[0][1]);
                $fixes = [$this->fix('Cambiar por `' . ($neg ? '!=' : '==') . '`', ['sl' => $line, 'sc' => $c, 'el' => $line, 'ec' => $c + strlen($m[0][0])], $neg ? '!=' : '==')];
            }
            return ['code' => 'is-literal', 'title' => '`is` con un valor literal: usa `==`',
                'explain' => '`is` comprueba si dos variables son **el mismo objeto** en memoria, no si valen lo mismo. Con números y textos el resultado depende de detalles internos de Python y puede cambiar. Para comparar valores usa `==` (o `!=`); `is` se reserva para `None`, `True` y `False`.',
                'fixes' => $fixes, 'severity' => 'warning'];
        }
        if ($cls === 'RuntimeWarning' && preg_match('/(divide by zero|invalid value|overflow|underflow) encountered in (\w+)/', $msg, $m)) {
            $que = ['divide by zero' => 'una división entre cero', 'invalid value' => 'un valor no válido (por ejemplo 0/0 o la raíz de un número negativo), que da `nan`', 'overflow' => 'un número demasiado grande para el tipo (da `inf`)', 'underflow' => 'un número tan pequeño que se redondea a 0'][$m[1]];
            return ['code' => 'numpy-runtime', 'title' => "Aviso de numpy: {$m[1]} en {$m[2]}",
                'explain' => sprintf('numpy encontró %s al calcular `%s`. No detiene el programa: el resultado contiene `inf` o `nan` y los cálculos siguientes saldrán contaminados.', $que, $m[2]),
                'hint' => 'Comprueba los divisores y los argumentos de `log`/`sqrt` antes de calcular (por ejemplo con `np.where(d != 0, a / d, 0)`), o localiza los `nan` con `np.isnan(x).any()`.',
                'severity' => 'warning'];
        }
        if ($cls === 'RuntimeWarning' && str_contains($msg, 'Mean of empty slice')) {
            return ['code' => 'numpy-runtime', 'title' => 'Media de un array vacío',
                'explain' => 'Calculaste la media (o similar) de un array sin elementos, y el resultado es `nan`. Comprueba que el array no está vacío (`if len(x):`) antes de operar.', 'severity' => 'warning'];
        }
        if ($kind === 'deprecated') {
            return ['code' => 'deprecated', 'title' => 'Función obsoleta: ' . $msg,
                'explain' => 'Lo que usas está marcado como obsoleto: hoy funciona, pero en una versión futura dejará de existir. Busca en el mensaje cuál es la alternativa recomendada.', 'severity' => 'info'];
        }
        return ['code' => 'warning', 'title' => ($cls !== '' ? $cls . ': ' : 'Aviso: ') . $msg,
            'explain' => 'Python (o una biblioteca) avisa de que algo no es del todo correcto. El programa sigue ejecutándose, pero conviene entender el aviso: ' . $msg, 'severity' => 'warning'];
    }

    // ───────────────────────────── errores de ejecución ─────────────────────────────

    private function runtime(string $cls, string $msg, int $line, array $ev): array
    {
        $text = $this->text($line);
        $name = (string) ($ev['name'] ?? '');
        $cands = array_map('strval', (array) ($ev['candidates'] ?? []));

        switch ($cls) {
            case 'NameError':
                return $this->nameError($name, $msg, $line, $cands, $ev);
            case 'UnboundLocalError':
                $v = preg_match("/'(\w+)'/", $msg, $m) ? $m[1] : 'la variable';
                return ['code' => 'unbound-local', 'title' => "`{$v}` se usa antes de darle un valor",
                    'explain' => sprintf('Dentro de una función, si **asignas** a `%1$s` en cualquier punto (`%1$s = ...`, `%1$s += ...`), Python la trata como una variable **local de toda la función**. Aquí se lee antes de que esa asignación se ejecute, por eso no tiene valor todavía.', $v),
                    'hint' => sprintf('Dale un valor inicial antes de usarla, pásala como parámetro, o (si de verdad es una variable global que quieres modificar) declara `global %s` al principio de la función.', $v)];
            case 'ZeroDivisionError':
                return ['code' => 'division-by-zero', 'title' => 'División entre cero',
                    'explain' => 'Estás dividiendo (con `/`, `//` o `%`) entre un valor que vale 0. En matemáticas no existe y Python lanza este error. Pasa a menudo al calcular una media de una lista vacía: `sum(xs) / len(xs)`.',
                    'hint' => 'Comprueba el divisor antes: `if divisor != 0:` (o `if xs:` si divides entre `len(xs)`), y decide qué devolver en ese caso.'];
            case 'IndexError':
                $vacia = str_contains($msg, 'pop from empty');
                return ['code' => 'index-out-of-range', 'title' => $vacia ? 'Quitar un elemento de una lista vacía' : 'Índice fuera de rango',
                    'explain' => $vacia ? 'Llamaste a `pop()` sobre una lista que no tiene elementos. Comprueba `if lista:` antes.'
                        : 'Pides una posición que no existe. En una secuencia de `n` elementos los índices válidos van de `0` a `n - 1` (o de `-1` a `-n` contando desde el final). Un `range(len(xs) + 1)` o un `xs[len(xs)]` son los despistes típicos.',
                    'hint' => 'Comprueba `len(...)` antes de acceder, o recorre la lista directamente con `for x in xs:`. Si la lista puede estar vacía, protege el acceso con `if xs:`.'];
            case 'KeyError':
                return $this->keyError($msg, $line);
            case 'TypeError':
                return $this->typeError($msg, $line, $ev);
            case 'AttributeError':
                return $this->attributeError($msg, $line, $name, $cands, $ev);
            case 'ValueError':
                return $this->valueError($msg, $line);
            case 'ModuleNotFoundError':
                return $this->moduleNotFound($name, $msg, $cands);
            case 'ImportError':
                if ($name !== '' && preg_match("/cannot import name '(\w+)'/", $msg, $m)) {
                    $sug = $this->suggest($m[1], $cands);
                    return ['code' => 'import-name', 'title' => "No se puede importar `{$m[1]}` de `{$name}`",
                        'explain' => sprintf('El módulo `%s` existe, pero no tiene nada llamado `%s`. Suele ser una errata, o un nombre que está en otro módulo.', $name, $m[1]),
                        'suggestions' => $sug, 'hint' => $sug ? '¿Querías decir `' . $sug[0] . '`?' : 'Mira los nombres disponibles con `dir(' . $name . ')`.'];
                }
                break;
            case 'FileNotFoundError':
                return ['code' => 'file-not-found', 'title' => 'No existe el archivo',
                    'explain' => 'Python no encuentra el archivo que intentas abrir. Las rutas relativas se buscan en la carpeta de trabajo del playground (`practicas/python`), no junto a tu `.py`. Además el playground está pensado para practicar sin archivos: prueba con datos en el propio código o con `input()`.'];
            case 'EOFError':
                return ['code' => 'eof', 'title' => '`input()` no tiene datos que leer',
                    'explain' => 'El programa pide una línea con `input()` pero no hay más datos de entrada. Escribe en el cuadro **Entrada** una línea por cada `input()` que se ejecute.',
                    'hint' => 'Si el programa llama a `input()` tres veces, el cuadro Entrada necesita tres líneas.'];
            case 'NotImplementedError':
                return ['code' => 'not-implemented', 'title' => 'Esta parte todavía no está hecha',
                    'explain' => 'Se ejecutó un `raise NotImplementedError`: marca algo que falta por implementar. Sustituye ese `raise` por tu código.'];
            case 'AssertionError':
                return ['code' => 'assertion', 'title' => 'Falló un `assert`' . ($msg !== '' ? ': ' . $msg : ''),
                    'explain' => 'Un `assert` comprueba algo que el programa da por cierto y aquí no se cumple: o el dato es distinto de lo esperado, o la suposición era errónea.'];
            case 'OverflowError':
                return ['code' => 'overflow', 'title' => 'Número demasiado grande', 'explain' => 'El resultado no cabe en el tipo que se está usando (típico de `float` con potencias enormes, o `math.exp` de un número alto). Los `int` de Python no tienen límite, los `float` sí.'];
            case 'StopIteration':
                return ['code' => 'stop-iteration', 'title' => 'Se acabaron los elementos', 'explain' => 'Pediste el siguiente elemento (`next(...)`) de un iterador que ya terminó. Pasa un valor por defecto: `next(it, None)`.'];
            case 'RuntimeError':
                if (str_contains($msg, 'changed size during iteration')) {
                    return ['code' => 'mutate-iter', 'title' => 'Cambiaste el tamaño mientras lo recorrías',
                        'explain' => 'No se puede añadir ni quitar elementos de un diccionario o conjunto mientras haces un `for` sobre él. Recorre una copia (`for k in list(d):`) o construye uno nuevo.'];
                }
                break;
        }
        return ['code' => 'generic', 'title' => ($cls !== '' ? "{$cls}: " : '') . $msg,
            'explain' => sprintf('Python lanzó un `%s` en la línea %d (`%s`). Lee el mensaje original: suele decir exactamente qué valor o qué operación falla.', $cls ?: 'error', $line, $this->short($text)),
            'hint' => 'Mira también el valor de las variables de esa línea con un `print(...)` justo antes.'];
    }

    /** @param list<string> $cands */
    private function nameError(string $name, string $msg, int $line, array $cands, array $ev): array
    {
        if ($name === '' && preg_match("/'(\w+)'/", $msg, $m)) {
            $name = $m[1];
        }
        $sug = $this->suggest($name, $cands);
        $fixes = [];
        $rg = $this->evRangeOf($ev, $line, $name) ?? $this->find($line, '/(?<![\w.])' . preg_quote($name, '/') . '(?!\w)/');
        $extra = '';
        foreach ($sug as $s) {
            if ($rg) {
                $fixes[] = $this->fix("Cambiar por `{$s}`", $rg, $s);
            }
        }
        if (isset(self::IMPORTS[$name])) {
            $e = $this->importEdit(self::IMPORTS[$name]);
            $fixes[] = ['title' => 'Añadir `' . self::IMPORTS[$name] . '`', 'edits' => [['range' => ['sl' => $e['sl'], 'sc' => $e['sc'], 'el' => $e['el'], 'ec' => $e['ec']], 'text' => $e['text']]]];
            $extra = sprintf(' Parece que falta importarlo: `%s`.', self::IMPORTS[$name]);
        }
        $hint = $sug ? '¿Querías decir ' . implode(' o ', array_map(static fn($s) => "`{$s}`", $sug)) . '?' : 'Comprueba que la variable se define (se le da un valor) antes de usarla, y que está escrita igual, con las mismas mayúsculas.';
        return ['code' => 'undefined-variable', 'title' => "`{$name}` no está definido",
            'explain' => sprintf('Python no conoce ningún nombre `%s` en este punto. Las causas habituales: una errata (Python distingue mayúsculas de minúsculas), usarlo antes de asignarle un valor, definirlo dentro de otra función (las variables locales no se ven desde fuera), o no haber importado el módulo.%s', $name, $extra),
            'hint' => $hint, 'suggestions' => $sug, 'fixes' => $fixes];
    }

    /** Rango del identificador cuando el rango que da el harness es justo ese identificador. */
    private function evRangeOf(array $ev, int $line, string $word): ?array
    {
        $r = $this->evRange($ev, $line);
        if ($r !== null && $r['sl'] === $r['el'] && $r['ec'] - $r['sc'] === self::u16($word)) {
            return $r;
        }
        return null;
    }

    private function keyError(string $msg, int $line): array
    {
        $text = $this->text($line);
        $fixes = [];
        if ($msg !== '' && preg_match('/(?<![\w.])(\w+(?:\.\w+)*)\[' . preg_quote($msg, '/') . '\](?!\s*[-+*\/%&|^]?=(?!=))/', $text, $m, PREG_OFFSET_CAPTURE)) {
            $c0 = $this->colAt($text, $m[0][1]);
            $fixes[] = $this->fix('Usar `' . $m[1][0] . '.get(' . $msg . ')`', ['sl' => $line, 'sc' => $c0, 'el' => $line, 'ec' => $c0 + self::u16($m[0][0])], $m[1][0] . '.get(' . $msg . ')');
        }
        return ['code' => 'undefined-key', 'title' => "La clave {$msg} no existe en el diccionario",
            'explain' => sprintf('Buscas la clave `%s` en un diccionario que no la tiene (o la tiene escrita distinta: `"1"` y `1` son claves diferentes). Con `d[clave]` una clave que falta es un error.', $msg),
            'hint' => sprintf('Comprueba antes con `if %s in d:`, o usa `d.get(%s)` (devuelve `None` si no está) / `d.get(%s, 0)` con un valor por defecto. Para contar o agrupar, `collections.defaultdict` o `Counter`.', $msg, $msg, $msg),
            'fixes' => $fixes];
    }

    private function typeError(string $msg, int $line, array $ev): array
    {
        $text = $this->text($line);
        // concatenar str con otro tipo
        if (preg_match('/can only concatenate str \(not "(\w+)"\) to str|unsupported operand type\(s\) for \+: \'(int|float)\' and \'str\'|must be str, not (\w+)/', $msg, $m)) {
            $otro = $m[1] ?: ($m[2] ?: ($m[3] ?? 'otro tipo'));
            return ['code' => 'str-concat', 'title' => "No se puede sumar un texto con un {$otro}",
                'explain' => 'El operador `+` junta dos textos o suma dos números, pero no mezcla un `str` con otro tipo. Hay que convertir uno de los dos, o mejor: usar una f-string, que convierte sola.',
                'hint' => 'Ejemplo: en vez de `"Edad: " + edad` escribe `f"Edad: {edad}"` (o `"Edad: " + str(edad)`).',
                'fixes' => $this->fstringFix($line, $text)];
        }
        if (preg_match("/can only concatenate (list|tuple) \(not \"(\w+)\"\) to/", $msg, $m)) {
            return ['code' => 'operand-types', 'title' => "No se puede sumar una {$m[1]} con un {$m[2]}",
                'explain' => 'Con `+` solo se pueden unir dos listas (o dos tuplas). Para añadir un elemento a una lista usa `lista.append(x)`, o `lista + [x]` (con corchetes).'];
        }
        if (preg_match("/unsupported operand type\(s\) for ([^:]+): '(\w+)' and '(\w+)'/", $msg, $m)) {
            return ['code' => 'operand-types', 'title' => "El operador `{$m[1]}` no vale entre {$m[2]} y {$m[3]}",
                'explain' => sprintf('Python no sabe aplicar `%s` entre un `%s` y un `%s`. Casi siempre es un valor que no es del tipo que crees: un `input()` (siempre devuelve texto), un `None` de una función sin `return`, o una lista donde esperabas un número.', $m[1], $m[2], $m[3]),
                'hint' => $m[2] === 'NoneType' || $m[3] === 'NoneType' ? 'Uno de los valores es `None`: probablemente una función a la que le falta el `return`.' : 'Convierte con `int(...)`, `float(...)` o `str(...)`, o revisa de dónde viene cada valor con un `print(type(x))`.'];
        }
        if (preg_match("/'(<|>|<=|>=)' not supported between instances of '(\w+)' and '(\w+)'/", $msg, $m)) {
            return ['code' => 'comparison-types', 'title' => "No se puede comparar {$m[2]} con {$m[3]}",
                'explain' => 'Los operadores `<`, `>`, `<=`, `>=` solo comparan valores de tipos compatibles (número con número, texto con texto). Típico: comparar un `input()` (texto) con un número.',
                'hint' => 'Convierte antes: `int(texto) > 5`. Si hay `None` en la lista que ordenas, filtra antes los `None`.'];
        }
        if (preg_match("/'NoneType' object is not (subscriptable|iterable|callable)|object of type 'NoneType' has no len/", $msg, $m)) {
            $que = ['subscriptable' => 'acceder con `[...]` a', 'iterable' => 'recorrer con `for` (o desempaquetar)', 'callable' => 'llamar como una función a'][$m[1] ?? ''] ?? 'calcular la longitud de';
            return ['code' => 'member-on-null', 'title' => 'Se usa `None` como si tuviera valor',
                'explain' => sprintf('Intentas %s algo que vale `None` (nada). Casi siempre viene de una función a la que le **falta el `return`**, de un método que modifica "en el sitio" y devuelve `None` (`lista.sort()`, `lista.append(x)`, `lista.reverse()`), o de una búsqueda que no encontró nada.', $que),
                'hint' => 'Imprime el valor justo antes (`print(x)`) para ver de dónde sale el `None`. Recuerda: `xs = xs.sort()` deja `xs` en `None`; usa `xs.sort()` o `xs = sorted(xs)`.',
                'fixes' => $this->sortFix($line, $text)];
        }
        if (preg_match("/'(\w+)' object is not (subscriptable|iterable|callable)/", $msg, $m)) {
            $t = $m[1];
            $texto = ['subscriptable' => ["No se puede usar `[...]` con un {$t}", 'Un `' . $t . '` no es una secuencia ni un diccionario, así que no se puede indexar. Revisa qué valor tiene realmente la variable (`print(type(x))`).'],
                'iterable' => ["Un {$t} no se puede recorrer", 'El `for` (y el desempaquetado) necesitan algo que se pueda recorrer: lista, tupla, texto, diccionario, `range(...)`. Un `' . $t . '` no lo es. Si quieres repetir `n` veces usa `for i in range(n):`.'],
                'callable' => ["Un {$t} no se puede llamar como función", 'Pones paréntesis `(...)` detrás de algo que no es una función. Causas típicas: has llamado a una variable igual que una función (`list = [1,2]` y luego `list(...)`), o te falta un operador (`2(x+1)` en vez de `2 * (x+1)`).']][$m[2]];
            return ['code' => 'not-' . $m[2], 'title' => $texto[0], 'explain' => $texto[1]];
        }
        if (preg_match("/object of type '(\w+)' has no len/", $msg, $m)) {
            return ['code' => 'no-len', 'title' => "`len()` no vale para un {$m[1]}", 'explain' => '`len()` cuenta los elementos de una lista, texto, diccionario... pero no de un número. Revisa qué valor tiene la variable.'];
        }
        if (preg_match('/(\w+)\(\) missing (\d+) required (?:positional|keyword-only) arguments?: (.+)$/', $msg, $m)) {
            return ['code' => 'too-few-arguments', 'title' => sprintf('Faltan argumentos al llamar a %s()', $m[1]),
                'explain' => sprintf('La función `%s()` necesita %s más (%s) y no se los pasaste. Cuenta los argumentos de la llamada y compáralos con los parámetros de `def %s(...)`.', $m[1], $m[2] === '1' ? 'un argumento' : $m[2] . ' argumentos', $m[3], $m[1]),
                'hint' => 'Pasa el valor que falta, o dale un valor por defecto al parámetro: `def f(a, b=0):`.'];
        }
        if (preg_match('/(\w+)\(\) takes (\d+|from \d+ to \d+) positional arguments? but (\d+) (?:was|were) given/', $msg, $m)) {
            $metodo = ((int) $m[3] === (int) $m[2] + 1 || $m[2] === '0') ? ' Si `' . $m[1] . '` es un método de una clase, comprueba que su primer parámetro es `self`: Python lo pasa solo al llamar.' : '';
            return ['code' => 'too-many-arguments', 'title' => sprintf('Sobran argumentos al llamar a %s()', $m[1]),
                'explain' => sprintf('Llamas a `%s()` con %s, pero acepta %s.%s', $m[1], $m[3] . ' argumento' . ($m[3] === '1' ? '' : 's'), $m[2] . ' parámetro' . ($m[2] === '1' ? '' : 's'), $metodo),
                'hint' => 'Quita el argumento que sobra o añade el parámetro en la definición de la función.'];
        }
        if (preg_match("/(\w+)\(\) got an unexpected keyword argument '(\w+)'/", $msg, $m)) {
            return ['code' => 'argument-name', 'title' => "`{$m[1]}()` no tiene un parámetro llamado `{$m[2]}`",
                'explain' => sprintf('Llamas a `%s(%s=...)` pero esa función no tiene ningún parámetro con ese nombre. Revisa cómo se escribe en su `def`.', $m[1], $m[2])];
        }
        if (preg_match("/unhashable type: '(\w+)'/", $msg, $m)) {
            return ['code' => 'unhashable', 'title' => "Un {$m[1]} no puede ser clave de diccionario ni elemento de un set",
                'explain' => sprintf('Las claves de un `dict` y los elementos de un `set` tienen que ser **inmutables** (números, textos, tuplas). Un `%s` se puede modificar, así que Python no lo admite.', $m[1]),
                'hint' => $m[1] === 'list' ? 'Conviértela en tupla: `tuple(lista)` o escribe `(a, b)` en vez de `[a, b]`.' : 'Usa una tupla (o un `frozenset`) en su lugar.'];
        }
        if (preg_match("/'float' object cannot be interpreted as an integer/", $msg)) {
            $fixes = [];
            if (preg_match('/range\(([^()]*?)(?<!\/)\/(?!\/)/', $text, $m, PREG_OFFSET_CAPTURE)) {
                $c = $this->colAt($text, $m[0][1] + strlen($m[0][0]) - 1);
                $fixes = [$this->fix('Usar la división entera `//`', ['sl' => $line, 'sc' => $c, 'el' => $line, 'ec' => $c + 1], '//')];
            }
            return ['code' => 'float-as-int', 'title' => 'Se usa un decimal donde hace falta un entero',
                'explain' => 'En Python 3, `/` siempre devuelve un decimal (`10 / 2` es `5.0`), pero `range`, los índices y las rebanadas necesitan enteros. Para dividir y quedarte con la parte entera usa `//`.',
                'fixes' => $fixes];
        }
        if (preg_match("/(?:list|string|tuple) indices must be integers or slices, not (\w+)/", $msg, $m)) {
            return ['code' => 'index-type', 'title' => "El índice es un {$m[1]}, tiene que ser un entero",
                'explain' => 'Para acceder a una posición de una lista, tupla o texto el índice debe ser un `int`. Si viene de un `input()` conviértelo con `int(...)`; si viene de una división, usa `//`.'];
        }
        if (preg_match("/'(str|tuple|bytes)' object does not support item assignment/", $msg, $m)) {
            return ['code' => 'immutable', 'title' => "Un {$m[1]} no se puede modificar",
                'explain' => 'Los textos y las tuplas son **inmutables**: no puedes cambiar un elemento con `x[i] = ...`. Crea uno nuevo (`texto[:i] + "a" + texto[i+1:]`) o conviértelo antes en lista con `list(...)`.'];
        }
        if (preg_match("/can't multiply sequence by non-int of type '(\w+)'/", $msg, $m)) {
            return ['code' => 'sequence-times', 'title' => "No se puede repetir un texto o lista {$m[1]} veces",
                'explain' => 'Multiplicar un texto o una lista por un número la repite (`"ab" * 3`), pero el número tiene que ser entero. Si es un decimal conviértelo con `int(...)`; si es un `input()` (texto) también.'];
        }
        if (preg_match('/sequence item (\d+): expected str instance, (\w+) found/', $msg, $m)) {
            return ['code' => 'join-types', 'title' => "`join` solo une textos y hay un {$m[2]}",
                'explain' => '`"-".join(lista)` exige que todos los elementos sean `str`. Convierte los demás: `"-".join(str(x) for x in lista)`.'];
        }
        if (preg_match("/'(\w+)' object is not an iterator|argument of type '(\w+)' is not (?:iterable|a container)/", $msg, $m)) {
            return ['code' => 'not-iterable', 'title' => 'Ese valor no se puede recorrer ni usar con `in`',
                'explain' => 'El operador `in` y el `for` necesitan una colección (lista, texto, diccionario, set...). El valor de la derecha es de otro tipo (un número o `None`, por ejemplo).'];
        }
        return ['code' => 'generic', 'title' => 'TypeError: ' . $msg,
            'explain' => sprintf('Una operación recibió un valor de un tipo que no admite (`%s`). Comprueba con `print(type(x))` qué tipos tienen las variables de esa línea.', $this->short($text)),
            'hint' => 'Los orígenes más habituales de tipos inesperados son `input()` (siempre devuelve `str`) y las funciones sin `return` (devuelven `None`).'];
    }

    /** `"texto" + variable` o `variable + "texto"` → f-string, solo si el caso es sencillo. @return list<array<string,mixed>> */
    private function fstringFix(int $line, string $text): array
    {
        $lit = '(?<![\w"\'])(["\'])((?:(?!\1)[^\\\\{}\n])*)\1';
        $var = '([A-Za-z_]\w*(?:\.\w+|\[[^\]\[]*\])*)(?![\w(\[])';
        if (preg_match('/' . $lit . '\s*\+\s*' . $var . '/u', $text, $m, PREG_OFFSET_CAPTURE)) {
            $new = 'f' . $m[1][0] . $m[2][0] . '{' . $m[3][0] . '}' . $m[1][0];
        } elseif (preg_match('/(?<![\w.])' . $var . '\s*\+\s*(["\'])((?:(?!\2)[^\\\\{}\n])*)\2/u', $text, $m, PREG_OFFSET_CAPTURE)) {
            $new = 'f' . $m[2][0] . '{' . $m[1][0] . '}' . $m[3][0] . $m[2][0];
        } else {
            return [];
        }
        $c = $this->colAt($text, $m[0][1]);
        return [$this->fix('Convertir en f-string', ['sl' => $line, 'sc' => $c, 'el' => $line, 'ec' => $c + self::u16($m[0][0])], $new)];
    }

    /** `x = xs.sort()` → `x = sorted(xs)`. @return list<array<string,mixed>> */
    private function sortFix(int $line, string $text): array
    {
        $re = '/^(\s*)(\w+)\s*=\s*([\w.]+)\.sort\(([^()]*)\)\s*$/';
        for ($l = $line; $l >= max(1, $line - 40); $l--) {
            $t = $this->text($l);
            if (preg_match($re, $t, $m)) {
                $nuevo = $m[1] . $m[2] . ' = sorted(' . $m[3] . ($m[4] !== '' ? ', ' . $m[4] : '') . ')';
                return [$this->fix('Usar `sorted(...)`, que sí devuelve la lista', $this->codeRange($l), $nuevo)];
            }
        }
        return [];
    }

    /** @param list<string> $cands */
    private function attributeError(string $msg, int $line, string $name, array $cands, array $ev): array
    {
        $text = $this->text($line);
        if (preg_match("/'NoneType' object has no attribute '(\w+)'/", $msg, $m)) {
            $en = preg_match('/^\s*(\w+)\s*=\s*[\w.]+\.(sort|append|reverse|extend|remove|insert|clear)\(/m', $this->code) ? ' Fíjate: `lista.sort()`, `lista.append(x)`, `lista.reverse()`... modifican la lista **en el sitio** y devuelven `None`; si escribes `x = lista.sort()`, `x` queda en `None`.' : '';
            return ['code' => 'member-on-null', 'title' => "Se usa `.{$m[1]}` sobre `None`",
                'explain' => sprintf('La variable vale `None` (nada) y por eso no tiene `.%s`. Suele venir de una función a la que le falta el `return`, de una búsqueda que no encontró nada (`re.match`, `dict.get`...) o de guardar el resultado de un método que no devuelve nada.%s', $m[1], $en),
                'hint' => 'Imprime la variable antes de esa línea para ver cuándo se vuelve `None`; comprueba `if x is not None:` antes de usarla.',
                'fixes' => $this->sortFix($line, $text)];
        }
        $obj = (string) ($ev['objType'] ?? '');
        $nombre = $name;
        if ($nombre === '' && preg_match("/has no attribute '(\w+)'/", $msg, $m)) {
            $nombre = $m[1];
        }
        $sug = $this->suggest($nombre, $cands);
        if (isset(self::OTROS[$nombre])) {
            array_unshift($sug, self::OTROS[$nombre]);
        }
        $fixes = [];
        $rg = $this->find($line, '/(?<=\.)' . preg_quote($nombre, '/') . '(?!\w)/');
        foreach ($this->suggest($nombre, $cands) as $s) {
            if ($rg) {
                $fixes[] = $this->fix("Cambiar por `{$s}`", $rg, $s);
            }
        }
        $de = $obj !== '' ? "un `{$obj}`" : (preg_match("/module '(\w+)'/", $msg, $mm) ? "el módulo `{$mm[1]}`" : 'ese objeto');
        return ['code' => 'undefined-attribute', 'title' => "{$de} no tiene `{$nombre}`",
            'explain' => sprintf('Pides el atributo o método `.%s` a %s y no lo tiene. Causas habituales: una errata (Python distingue mayúsculas), confundirlo con el de otro tipo (las listas tienen `append`, los textos no), o tener una variable de un tipo distinto del que creías.', $nombre, $de),
            'hint' => $sug ? 'Prueba con ' . implode(' o ', array_map(static fn($s) => "`{$s}`", $sug)) . '.' : 'Lista lo que tiene el objeto con `dir(objeto)`.',
            'suggestions' => $sug, 'fixes' => $fixes];
    }

    private function valueError(string $msg, int $line): array
    {
        if (preg_match("/invalid literal for int\(\) with base (\d+): (.+)$/", $msg, $m) || preg_match('/could not convert string to float: (.+)$/', $msg, $m2)) {
            $valor = $m[2] ?? $m2[1];
            $f = isset($m2[1]);
            return ['code' => 'invalid-number', 'title' => sprintf('%s no es un %s válido', $valor, $f ? 'decimal' : 'entero'),
                'explain' => sprintf('Intentas convertir el texto %s con `%s(...)`, pero no tiene el formato de un número. %s', $valor, $f ? 'float' : 'int', "Si viene de `input()`, puede tener espacios, estar vacío o llevar decimales (`int('3.5')` falla; `int(float('3.5'))` no)."),
                'hint' => 'Limpia el texto con `.strip()` y comprueba `texto.isdigit()` antes de convertir, o captura el error con `try: ... except ValueError:`.'];
        }
        if (preg_match('/not enough values to unpack \(expected (\d+), got (\d+)\)/', $msg, $m)) {
            return ['code' => 'unpack', 'title' => "Faltan valores: esperaba {$m[1]} y hay {$m[2]}",
                'explain' => sprintf('Estás desempaquetando (`a, b = ...`) una colección en %s variables, pero solo tiene %s elementos. Comprueba la longitud de lo que hay a la derecha (por ejemplo, el resultado de un `split()` o `input().split()`).', $m[1], $m[2])];
        }
        if (preg_match('/too many values to unpack \(expected (\d+)/', $msg, $m)) {
            return ['code' => 'unpack', 'title' => "Sobran valores: solo hay {$m[1]} variables",
                'explain' => sprintf('Estás desempaquetando una colección que tiene más elementos que las %s variables de la izquierda. Añade variables, o usa `a, *resto = ...` para recoger el sobrante.', $m[1])];
        }
        if (str_contains($msg, 'not in list')) {
            return ['code' => 'not-in-list', 'title' => 'El elemento no está en la lista',
                'explain' => '`remove(x)` e `index(x)` lanzan este error cuando `x` no está en la lista. Comprueba antes con `if x in lista:`.',
                'hint' => 'Si buscas por pertenencia muchas veces, guarda los datos en un `set` (la búsqueda es instantánea).'];
        }
        if (str_contains($msg, 'math domain error')) {
            return ['code' => 'math-domain', 'title' => 'Valor fuera del dominio de la función matemática',
                'explain' => 'La función matemática no está definida para ese número: `math.sqrt` no admite negativos y `math.log` no admite 0 ni negativos. Comprueba el argumento antes.'];
        }
        if (preg_match('/(max|min)\(\) (?:arg is an empty sequence|iterable argument is empty)/', $msg, $m)) {
            return ['code' => 'empty-sequence', 'title' => "`{$m[1]}()` de una colección vacía",
                'explain' => sprintf('`%s()` no sabe qué devolver si no hay elementos. Comprueba que la colección no esté vacía, o da un valor por defecto: `%s(xs, default=0)`.', $m[1], $m[1])];
        }
        return ['code' => 'generic', 'title' => 'ValueError: ' . $msg,
            'explain' => sprintf('Una función recibió un valor del tipo correcto pero que no puede usar (`%s`). Revisa qué valor llega a esa línea con un `print`.', $this->short($this->text($line)))];
    }

    /** @param list<string> $cands */
    private function moduleNotFound(string $name, string $msg, array $cands): array
    {
        $raiz = explode('.', $name)[0];
        if (in_array($raiz, ['numpy', 'matplotlib', 'librosa'], true)) {
            $req = $raiz === 'librosa' ? 'requirements-audio.txt' : 'requirements.txt';
            return ['code' => 'module-not-found', 'title' => "Falta instalar `{$raiz}`",
                'explain' => sprintf('`%s` es una biblioteca externa que no está instalada en el entorno de Python del playground. Se instala una sola vez.', $raiz),
                'hint' => sprintf('Cierra el playground y ábrelo de nuevo con %s (instala lo necesario solo), o ejecuta a mano: `%s`. Después recarga la página.', DIRECTORY_SEPARATOR === '\\' ? 'arrancar.bat' : 'arrancar.sh', $this->osPip($req))];
        }
        $sug = $this->suggest($raiz, $cands);
        return ['code' => 'module-not-found', 'title' => "No existe el módulo `{$raiz}`",
            'explain' => sprintf('Python no encuentra ningún módulo llamado `%s`. O está mal escrito, o es una biblioteca de terceros que no viene con el playground (solo se incluyen la biblioteca estándar, numpy, matplotlib y, para audio, librosa).', $raiz),
            'hint' => $sug ? '¿Querías decir `' . $sug[0] . '`?' : 'Revisa el nombre del `import`.', 'suggestions' => $sug];
    }
}
