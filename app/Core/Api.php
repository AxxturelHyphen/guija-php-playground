<?php
declare(strict_types=1);

namespace Playground\Core;

defined('PG_ROOT') or exit;

/**
 * Endpoints del playground. Recibe la petición ya parseada y devuelve [estado HTTP, datos]; no toca cabeceras ni salida.
 * Todas las acciones son por lenguaje (?lang=php|python|java) salvo `langs` (la pantalla de inicio).
 *
 * Seguridad (el servidor ejecuta código arbitrario, así que es lo más importante del proyecto):
 *  - Host: solo 127.0.0.1 / localhost (frena DNS rebinding).
 *  - Origin: si viene, tiene que ser este mismo servidor.
 *  - POST: solo JSON y con la cabecera `X-Playground: 1`. Una web ajena no puede enviarla sin pasar un preflight CORS,
 *    que este servidor nunca aprueba, así que no puede hacer que ejecutes código desde otra pestaña.
 *  - Archivos: lista blanca de lenguajes, carpetas y nombres; solo se escribe en practicas/<lenguaje>/.
 */
final class Api
{
    public const MAX_CODE = Files::MAX_CODE;
    public const MAX_STDIN = 65_536;
    private const POST = ['save', 'delete', 'lint', 'run', 'compare', 'solution'];

    /** @param array<string,mixed> $server $_SERVER */
    public static function authorize(array $server): ?string
    {
        $host = (string) ($server['HTTP_HOST'] ?? '');
        if (!preg_match('/^(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$/i', $host)) {
            return 'Host no permitido';
        }
        if (isset($server['HTTP_ORIGIN']) && $server['HTTP_ORIGIN'] !== 'http://' . $host) {
            return 'Origen no permitido';
        }
        if (($server['REQUEST_METHOD'] ?? 'GET') === 'POST') {
            if (($server['HTTP_X_PLAYGROUND'] ?? '') !== '1') {
                return 'Falta la cabecera X-Playground';
            }
            if (!str_starts_with(strtolower((string) ($server['CONTENT_TYPE'] ?? '')), 'application/json')) {
                return 'Se esperaba application/json';
            }
        }
        return null;
    }

    /**
     * @param array<string,mixed> $q parámetros de la URL
     * @param array<string,mixed> $body JSON del cuerpo (POST)
     * @return array{0:int, 1:array<string,mixed>}
     */
    public function handle(string $method, string $action, array $q, array $body): array
    {
        if (in_array($action, self::POST, true) !== ($method === 'POST')) {
            return [405, ['error' => 'Método no permitido']];
        }
        if ($action === 'langs') {
            return [200, ['langs' => self::langs(!empty($q['fresh']))]];
        }
        $langId = (string) ($q['lang'] ?? 'php');
        $lang = Languages::get($langId);
        if ($lang === null) {
            return [404, ['error' => 'Lenguaje desconocido']];
        }
        $files = new Files($lang);
        try {
            return match ($action) {
                'meta' => [200, $this->meta($lang)],
                'catalog' => [200, $lang->catalog()],
                'tree' => [200, $files->tree()],
                'file' => $files->read((string) ($q['dir'] ?? ''), (string) ($q['name'] ?? '')),
                'save' => $files->save($body),
                'delete' => $files->delete($body),
                'lint' => $this->lint($lang, $body),
                'run' => $this->run($lang, $body),
                'compare' => $this->compare($lang, $body),
                'solution' => $this->solution($lang, $body),
                default => [404, ['error' => 'Acción desconocida']],
            };
        } catch (\Throwable $e) {
            return [500, ['error' => get_class($e) . ': ' . $e->getMessage()]];
        }
    }

    // ───────────────────────────── proyecto ─────────────────────────────

    private function meta(Language $lang): array
    {
        $m = $lang->meta();
        return [
            'lang' => $lang->id(), 'name' => $lang->name(), 'ext' => $lang->ext(),
            'version' => $m['version'], 'ok' => $m['ok'], 'missing' => $m['missing'], 'notes' => $m['notes'] ?? [],
            // compatibilidad con la interfaz anterior (solo PHP)
            'php' => PHP_VERSION, 'os' => PHP_OS_FAMILY, 'maxCode' => self::MAX_CODE, 'timeouts' => [5, 10, 30],
        ];
    }

    /**
     * Estado de los tres lenguajes para la pantalla de inicio. Detectar Python o Java lanza procesos,
     * así que se guarda unos minutos en var/.
     * @return list<array<string,mixed>>
     */
    public static function langs(bool $fresh = false): array
    {
        $cacheFile = PG_VAR . '/langs.json';
        if (!$fresh && is_file($cacheFile) && filemtime($cacheFile) > time() - 300) {
            $cached = json_decode((string) file_get_contents($cacheFile), true);
            if (is_array($cached)) {
                return $cached;
            }
        }
        $out = [];
        foreach (Languages::all() as $id => $lang) {
            try {
                $m = $lang->meta();
            } catch (\Throwable $e) {
                $m = ['version' => null, 'ok' => false, 'missing' => [['what' => 'motor', 'how' => $e->getMessage()]]];
            }
            $out[] = [
                'id' => $id, 'name' => $lang->name(), 'version' => $m['version'], 'ok' => $m['ok'],
                'missing' => $m['missing'], 'notes' => $m['notes'] ?? [], 'lessons' => count(Temario::lessons($id)),
            ];
        }
        if (!is_dir(PG_VAR)) {
            @mkdir(PG_VAR, 0777, true);
        }
        @file_put_contents($cacheFile, json_encode($out, JSON_UNESCAPED_UNICODE));
        return $out;
    }

    // ───────────────────────────── análisis y ejecución ─────────────────────────────

    /** @return string|array{0:int, 1:array<string,mixed>} el código, o la respuesta de error */
    private function codeOf(array $b): string|array
    {
        $code = $b['code'] ?? null;
        if (!is_string($code)) {
            return [400, ['error' => 'Falta el código']];
        }
        if (strlen($code) > self::MAX_CODE) {
            return [413, ['error' => 'El código es demasiado grande']];
        }
        if (!mb_check_encoding($code, 'UTF-8')) {
            return [400, ['error' => 'El código no es UTF-8 válido']];
        }
        return $code;
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    private function lint(Language $lang, array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        return [200, $lang->analyse($code)];
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    private function run(Language $lang, array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        $explainer = $lang->explainer($code);
        $syntax = $lang->syntaxError($code);
        if ($syntax !== null) {
            // No se lanza el proceso: el mismo error de sintaxis, explicado, es la respuesta
            return [200, Report::syntaxOnly($explainer->explain($syntax))];
        }
        $opts = [
            'timeout' => !empty($b['bench']) ? 60 : max($this->timeout($b, 30, 5), self::minTimeout($code)),   // medir() necesita más tiempo
            'stdin' => substr((string) ($b['stdin'] ?? ''), 0, self::MAX_STDIN),
            'bench' => !empty($b['bench']),
        ];
        $raw = $lang->run($code, $lang->displayName('tu_codigo'), $opts);
        return [200, Report::build($raw, $explainer)];
    }

    /**
     * Una lección puede pedir más tiempo con «pg: limite=30» en su cabecera (p. ej. la de librosa, que tarda en arrancar).
     * Como mucho 30 s; nunca reduce lo que el usuario eligió.
     */
    private static function minTimeout(string $code): int
    {
        return preg_match('/pg:\s*limite\s*=\s*(\d+)/', substr($code, 0, 3000), $m) ? min(30, (int) $m[1]) : 0;
    }

    private function timeout(array $b, int $max, int $default): int
    {
        return max(1, min($max, (int) ($b['timeout'] ?? $default)));
    }

    // ───────────────────────────── soluciones ─────────────────────────────

    /** Código de la solución que corresponde al archivo $name, o null. */
    private function solutionCode(Language $lang, array $b): ?string
    {
        $path = (new Solutions($lang))->pathFor((string) ($b['name'] ?? ''));
        return $path === null ? null : (string) file_get_contents($path);
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    private function solution(Language $lang, array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        $sol = $this->solutionCode($lang, $b);
        if ($sol === null) {
            return [404, ['error' => 'Este archivo no tiene soluciones de referencia']];
        }
        $solutions = new Solutions($lang);
        $only = $b['only'] ?? null;
        if (is_string($only)) {
            // Aplicar una sola declaración
            if (!isset($lang->declarations($sol)[$only])) {
                return [404, ['error' => 'Esa declaración no existe en la solución']];
            }
            return [200, ['spliced' => $solutions->splice($code, $sol, $only)]];
        }
        return [200, ['items' => $solutions->compare($code, $sol), 'spliced' => $solutions->splice($code, $sol)]];
    }

    /**
     * Ejecuta tu código y el código con la solución inyectada, con los mismos medir(), y compara.
     * @return array{0:int, 1:array<string,mixed>}
     */
    private function compare(Language $lang, array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        $sol = $this->solutionCode($lang, $b);
        if ($sol === null) {
            return [404, ['error' => 'Este archivo no tiene soluciones de referencia']];
        }
        if ($lang->syntaxError($code) !== null) {
            return [422, ['error' => 'Tu código tiene un error de sintaxis: arréglalo antes de comparar.']];
        }
        $spliced = (new Solutions($lang))->splice($code, $sol);
        $opts = ['timeout' => $this->timeout($b, 60, 30), 'bench' => true, 'benchBudgetMs' => 2500];

        $mine = Report::build($lang->run($code, $lang->displayName('tu_codigo'), $opts), $lang->explainer($code));
        $best = Report::build($lang->run($spliced, $lang->displayName('solucion'), $opts), $lang->explainer($spliced));

        return [200, [
            'mine' => $mine,
            'solution' => ['testSummary' => $best['testSummary'], 'problems' => $best['problems'], 'ms' => $best['ms'], 'peak' => $best['peak']],
            'series' => Bench::series($mine['benches'], $best['benches']),
        ]];
    }
}
