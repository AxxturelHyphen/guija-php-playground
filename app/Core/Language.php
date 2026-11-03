<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Un lenguaje del playground (PHP, Python, Java). La API, el Report, las soluciones y la interfaz son comunes;
 * cada lenguaje solo aporta esto. Contrato de datos (idéntico en los tres):
 *
 *  - analyse(): {syntax:bool, diagnostics:list<Diag>, units:list<Unit>, summary:Summary}
 *      Unit    = {name, qname, kind:'function'|'method'|'main', class:?string, startLine, endLine, loc, params,
 *                 signature:list<string>, cc, cognitive, nesting, returns, grade:'A'..'F', bigO:?string,
 *                 bigOWhy:list<string>, bigOKey:?string ('1'|'log'|'n'|'nlogn'|'n2'|'n3'|'exp'), recursive:bool}
 *      Summary = {loc, functions, ccTotal, ccMax, ccAvg, grade, worst:?string, maxNesting}
 *  - run(): salida cruda para Report::build():
 *      {items:list<{t:'out',text}|{t:'ev',ev}>, exit:int, killed:?'timeout'|'output', wallMs:int, truncated:bool, timeout:int}
 *    Los eventos los emite el harness del lenguaje por stdout como "\x1ePG{json}\x1f" (ver Protocol):
 *      err {kind,msg,line,...} · todo {msg,line,trace} · test {group,name,status,...} ·
 *      bench {name,status,scale,stopped,points:[[n,ms]]} (el ajuste O() lo hace Report/Bench, igual para todos) ·
 *      img {mime,data(base64)} · end {ms,mem,peak}
 *  - declarations(): declaraciones de primer nivel que las soluciones pueden sustituir:
 *      array<key, {key, name, kind:'function'|'type'|'method', line, endLine, start, end (bytes), doc:?string, norm:string}>
 *    `start..end` incluye el comentario de documentación; `norm` es el código sin espacios ni comentarios.
 */
abstract class Language
{
    /** 'php' | 'python' | 'java' */
    abstract public function id(): string;

    /** Nombre para mostrar: 'PHP', 'Python', 'Java'. */
    abstract public function name(): string;

    /** Extensión de los archivos, sin punto. */
    abstract public function ext(): string;

    /**
     * Qué hay instalado en este PC para este lenguaje.
     * @return array{version:?string, ok:bool, missing:list<array{what:string, how:string}>, notes?:list<string>}
     */
    abstract public function meta(): array;

    /** Catálogo para autocompletado, hover y ayuda de firma: {functions, classes, keywords, ...}. */
    abstract public function catalog(): array;

    /** Sintaxis + métricas + pistas (no ejecuta nada). */
    abstract public function analyse(string $code): array;

    /**
     * Error de sintaxis como evento `err` (kind 'parse' o el que toque) o null si compila/parsea.
     * @return ?array<string,mixed>
     */
    abstract public function syntaxError(string $code): ?array;

    /**
     * Ejecuta el código con el harness del lenguaje.
     * @param array{timeout?:int, stdin?:string, bench?:bool, benchBudgetMs?:int} $opts
     * @return array<string,mixed>
     */
    abstract public function run(string $code, string $displayName, array $opts = []): array;

    /** Explicador de errores para este código (ya conoce sus líneas y declaraciones). */
    abstract public function explainer(string $code): Explains;

    /** @return array<string, array<string,mixed>> */
    abstract public function declarations(string $code): array;

    /**
     * Dónde insertar (offset en bytes del código del usuario) una declaración de la solución que el usuario no tiene
     * (una función auxiliar, por ejemplo).
     * @param array<string,mixed> $decl declaración de la solución
     */
    abstract public function insertionPoint(string $code, array $decl): int;

    /** Nombre con el que el usuario ve su archivo en errores y trazas. */
    public function displayName(string $base): string
    {
        return $base . '.' . $this->ext();
    }

    // ───────────────────────────── carpetas ─────────────────────────────

    public function examplesDir(): string
    {
        return PG_CONTENIDO . '/' . $this->id() . '/ejemplos';
    }

    public function solutionsDir(): string
    {
        return PG_CONTENIDO . '/' . $this->id() . '/soluciones';
    }

    public function practiceDir(): string
    {
        return PG_PRACTICAS . '/' . $this->id();
    }

    /** Nombre de archivo válido para este lenguaje (sin rutas, sin puntos raros). */
    public function nameRegex(): string
    {
        return '/^[A-Za-z0-9_-]{1,80}\.' . preg_quote($this->ext(), '/') . '$/';
    }
}
