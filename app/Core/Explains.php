<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Traduce un evento de error del harness (`{t:'err', kind, msg, line, ...}`) a un diagnóstico explicado en español:
 *
 *   {source:'syntax'|'runtime'|'analysis', severity:'error'|'warning'|'info'|'hint', code,
 *    line, col, endLine, endCol (1-based, columnas en UTF-16 como Monaco), title, message, explain (markdown),
 *    original?, hint?, suggestions?:list<string>, fixes?:list<{title, edits:list<{range:{sl,sc,el,ec}, text}>}>, trace?}
 *
 * Cada lenguaje tiene el suyo (PHP, Python, Java). Kinds comunes: parse, warning, notice, deprecated, exception,
 * fatal, timeout (con `limit` en segundos), memory, stack.
 */
interface Explains
{
    /** @param array<string,mixed> $ev */
    public function explain(array $ev): array;
}
