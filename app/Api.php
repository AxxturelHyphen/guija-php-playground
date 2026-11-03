<?php
declare(strict_types=1);

namespace Playground;

use Playground\Analysis\{Hints, Metrics, Parser, Source};

defined('PG_ROOT') or exit;

/**
 * Endpoints del playground. Recibe la petición ya parseada y devuelve [estado HTTP, datos]; no toca cabeceras ni salida.
 *
 * Seguridad (el servidor ejecuta código PHP arbitrario, así que es lo más importante del proyecto):
 *  - Host: solo 127.0.0.1 / localhost (frena DNS rebinding).
 *  - Origin: si viene, tiene que ser este mismo servidor.
 *  - POST: solo JSON y con la cabecera `X-Playground: 1`. Una web ajena no puede enviarla sin pasar un preflight CORS,
 *    que este servidor nunca aprueba, así que no puede hacer que ejecutes código desde otra pestaña.
 *  - Archivos: lista blanca de carpetas y de nombres; solo se escribe en practicas/.
 */
final class Api
{
    public const MAX_CODE = 400_000;
    public const MAX_STDIN = 65_536;
    private const DIRS = ['ejemplos' => PG_EJEMPLOS, 'practicas' => PG_PRACTICAS, 'soluciones' => PG_SOLUCIONES];
    private const NAME_RE = '/^[A-Za-z0-9_-]{1,80}\.php$/';

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
        $post = ['save', 'delete', 'lint', 'run', 'compare', 'solution'];
        if (in_array($action, $post, true) !== ($method === 'POST')) {
            return [405, ['error' => 'Método no permitido']];
        }
        try {
            return match ($action) {
                'meta' => [200, $this->meta()],
                'catalog' => [200, Catalog::build()],
                'tree' => [200, $this->tree()],
                'file' => $this->file((string) ($q['dir'] ?? ''), (string) ($q['name'] ?? '')),
                'save' => $this->save($body),
                'delete' => $this->delete($body),
                'lint' => $this->lint($body),
                'run' => $this->run($body),
                'compare' => $this->compare($body),
                'solution' => $this->solution($body),
                default => [404, ['error' => 'Acción desconocida']],
            };
        } catch (\Throwable $e) {
            return [500, ['error' => get_class($e) . ': ' . $e->getMessage()]];
        }
    }

    // ───────────────────────────── proyecto ─────────────────────────────

    private function meta(): array
    {
        return ['php' => PHP_VERSION, 'os' => PHP_OS_FAMILY, 'maxCode' => self::MAX_CODE, 'timeouts' => [5, 10, 30]];
    }

    private function tree(): array
    {
        $out = [];
        foreach (self::DIRS as $dir => $path) {
            $files = [];
            foreach (glob($path . '/*.php') ?: [] as $f) {
                $name = basename($f);
                if (!preg_match(self::NAME_RE, $name)) {
                    continue;
                }
                $files[] = [
                    'name' => $name,
                    'size' => (int) filesize($f),
                    'mtime' => (int) filemtime($f),
                    'solution' => $dir !== 'soluciones' && Solutions::pathFor($name) !== null,
                ];
            }
            usort($files, static fn(array $a, array $b): int => strnatcasecmp($a['name'], $b['name']));
            $out[$dir] = $files;
        }
        return $out;
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    private function file(string $dir, string $name): array
    {
        $path = $this->resolve($dir, $name);
        if ($path === null || !is_file($path)) {
            return [404, ['error' => 'No existe ese archivo']];
        }
        return [200, [
            'dir' => $dir, 'name' => $name, 'code' => (string) file_get_contents($path), 'mtime' => (int) filemtime($path),
            'solution' => $dir !== 'soluciones' && Solutions::pathFor($name) !== null,
        ]];
    }

    /** Ruta de dir/name si ambos están en la lista blanca; null si no. */
    private function resolve(string $dir, string $name): ?string
    {
        if (!isset(self::DIRS[$dir]) || !preg_match(self::NAME_RE, $name)) {
            return null;
        }
        return self::DIRS[$dir] . '/' . $name;
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    private function save(array $b): array
    {
        $name = (string) ($b['name'] ?? '');
        $code = $b['code'] ?? null;
        if (!preg_match(self::NAME_RE, $name)) {
            return [400, ['error' => 'Nombre no válido: usa letras, números, guion y .php (p. ej. mi-ejercicio.php)']];
        }
        if (!is_string($code) || strlen($code) > self::MAX_CODE || !mb_check_encoding($code, 'UTF-8')) {
            return [400, ['error' => 'Código no válido o demasiado grande']];
        }
        if (!is_dir(PG_PRACTICAS) && !@mkdir(PG_PRACTICAS, 0777, true)) {
            return [500, ['error' => 'No se pudo crear la carpeta practicas/']];
        }
        $path = PG_PRACTICAS . '/' . $name;
        if (is_file($path) && empty($b['overwrite'])) {
            return [409, ['error' => 'exists', 'name' => $name]];
        }
        // Escritura atómica: si se corta a medias no se pierde la versión anterior
        $tmp = $path . '.tmp' . bin2hex(random_bytes(3));
        if (file_put_contents($tmp, $code) === false || !@rename($tmp, $path)) {
            @unlink($tmp);
            return [500, ['error' => 'No se pudo guardar el archivo']];
        }
        clearstatcache(true, $path);
        return [200, ['dir' => 'practicas', 'name' => $name, 'mtime' => (int) filemtime($path)]];
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    private function delete(array $b): array
    {
        $path = $this->resolve('practicas', (string) ($b['name'] ?? ''));
        if ($path === null || !is_file($path)) {
            return [404, ['error' => 'No existe ese archivo en practicas/']];
        }
        return @unlink($path) ? [200, ['ok' => true]] : [500, ['error' => 'No se pudo borrar']];
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
    private function lint(array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        return [200, $this->analyse($code)];
    }

    /**
     * Sintaxis + métricas + pistas.
     * @return array<string,mixed>
     */
    public function analyse(string $code): array
    {
        $src = new Source($code);
        $parser = new Parser($src);
        $explainer = new Explainer($src, $parser);
        $metrics = new Metrics($src, $parser);
        $result = $metrics->compute();

        $syntax = Runner::syntaxError($code);
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

    /** @return array{0:int, 1:array<string,mixed>} */
    private function run(array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        $src = new Source($code);
        $explainer = new Explainer($src, new Parser($src));
        $syntax = Runner::syntaxError($code);
        if ($syntax !== null) {
            // No se lanza el proceso: el mismo error de sintaxis, explicado, es la respuesta
            $d = $explainer->explain($syntax);
            return [200, [
                'segments' => [['t' => 'diag', 'diag' => $d]], 'problems' => [$d], 'tests' => [], 'testSummary' => Report::summary([]),
                'benches' => [], 'exit' => 255, 'killed' => null, 'wallMs' => 0, 'ms' => 0, 'mem' => null, 'peak' => null, 'syntaxOnly' => true,
            ]];
        }
        $opts = [
            'timeout' => !empty($b['bench']) ? 60 : $this->timeout($b, 30, 5),   // medir() necesita más tiempo que una ejecución normal
            'stdin' => substr((string) ($b['stdin'] ?? ''), 0, self::MAX_STDIN),
            'bench' => !empty($b['bench']),
        ];
        $raw = (new Runner())->run($code, 'tu_codigo.php', $opts);
        return [200, Report::build($raw, $explainer)];
    }

    private function timeout(array $b, int $max, int $default): int
    {
        return max(1, min($max, (int) ($b['timeout'] ?? $default)));
    }

    // ───────────────────────────── soluciones ─────────────────────────────

    /** Código de la solución que corresponde al archivo $name, o null. */
    private function solutionCode(array $b): ?string
    {
        $path = Solutions::pathFor((string) ($b['name'] ?? ''));
        return $path === null ? null : (string) file_get_contents($path);
    }

    /** @return array{0:int, 1:array<string,mixed>} */
    private function solution(array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        $sol = $this->solutionCode($b);
        if ($sol === null) {
            return [404, ['error' => 'Este archivo no tiene soluciones de referencia']];
        }
        $only = $b['only'] ?? null;
        if (is_string($only)) {
            // Aplicar una sola declaración: se reduce la solución a ella
            $decl = Solutions::declarations($sol)[$only] ?? null;
            if ($decl === null) {
                return [404, ['error' => 'Esa declaración no existe en la solución']];
            }
            return [200, ['spliced' => Solutions::splice($code, "<?php\n" . $decl['code'] . "\n")]];
        }
        return [200, ['items' => Solutions::compare($code, $sol), 'spliced' => Solutions::splice($code, $sol)]];
    }

    /**
     * Ejecuta tu código y el código con la solución inyectada, con los mismos medir(), y compara.
     * @return array{0:int, 1:array<string,mixed>}
     */
    private function compare(array $b): array
    {
        $code = $this->codeOf($b);
        if (is_array($code)) {
            return $code;
        }
        $sol = $this->solutionCode($b);
        if ($sol === null) {
            return [404, ['error' => 'Este archivo no tiene soluciones de referencia']];
        }
        if (Runner::syntaxError($code) !== null) {
            return [422, ['error' => 'Tu código tiene un error de sintaxis: arréglalo antes de comparar.']];
        }
        $spliced = Solutions::splice($code, $sol);
        $opts = ['timeout' => $this->timeout($b, 60, 30), 'bench' => true, 'benchBudgetMs' => 2500];

        $runner = new Runner();
        $mineRaw = $runner->run($code, 'tu_codigo.php', $opts);
        $bestRaw = $runner->run($spliced, 'solucion.php', $opts);

        $mineSrc = new Source($code);
        $bestSrc = new Source($spliced);
        $mine = Report::build($mineRaw, new Explainer($mineSrc, new Parser($mineSrc)));
        $best = Report::build($bestRaw, new Explainer($bestSrc, new Parser($bestSrc)));

        return [200, [
            'mine' => $mine,
            'solution' => ['testSummary' => $best['testSummary'], 'problems' => $best['problems'], 'ms' => $best['ms'], 'peak' => $best['peak']],
            'series' => self::series($mine['benches'], $best['benches']),
        ]];
    }

    /**
     * Empareja los medir() de ambas ejecuciones por nombre y redacta el veredicto.
     * @param list<array<string,mixed>> $mine
     * @param list<array<string,mixed>> $best
     * @return list<array<string,mixed>>
     */
    public static function series(array $mine, array $best): array
    {
        $bestBy = [];
        foreach ($best as $e) {
            $bestBy[$e['name']] = $e;
        }
        $out = [];
        foreach ($mine as $m) {
            $s = $bestBy[$m['name']] ?? null;
            $row = ['name' => $m['name'], 'mine' => $m, 'best' => $s, 'verdict' => null, 'ratio' => null, 'n' => null, 'level' => 'info'];
            if (($m['status'] ?? '') === 'todo') {
                $row['verdict'] = 'Todavía no has implementado esta función: sin ella no hay nada que medir.';
            } elseif (($m['status'] ?? '') !== 'ok' || $s === null || ($s['status'] ?? '') !== 'ok') {
                $row['verdict'] = ($m['status'] ?? '') === 'error'
                    ? 'No se pudo medir tu versión: ' . ($m['msg'] ?? '')
                    : 'No hay medición para comparar.';
                $row['level'] = 'warning';
            } else {
                [$row['verdict'], $row['ratio'], $row['n'], $row['level']] = self::verdict($m, $s);
            }
            $out[] = $row;
        }
        return $out;
    }

    /** @return array{0:string, 1:?float, 2:?int, 3:string} */
    private static function verdict(array $m, array $s): array
    {
        $mine = array_column($m['points'], 1, 0);
        $best = array_column($s['points'], 1, 0);
        $common = array_values(array_intersect(array_keys($mine), array_keys($best)));
        sort($common);
        $mLabel = $m['label'] ?? '?';
        $sLabel = $s['label'] ?? '?';
        if (!$common) {
            return ["Tuya ~{$mLabel}, óptima {$sLabel}. No se pudo medir el mismo tamaño en ambas.", null, null, 'info'];
        }
        $n = (int) end($common);
        $tm = (float) $mine[$n];
        $ts = (float) $best[$n];
        $ratio = $ts > 0 ? $tm / $ts : null;
        $same = $mLabel === $sLabel;
        $head = $same ? "Misma complejidad (~{$mLabel})" : "Tuya ~{$mLabel}, óptima {$sLabel}";
        $times = 'en n=' . self::num($n) . ', ' . self::ms($tm) . ' frente a ' . self::ms($ts);
        if ($ratio === null || $ratio < 1.5) {
            $text = $same ? "{$head}: {$times}. Vas al ritmo de la solución de referencia." : "{$head}: {$times}.";
            return [$text, $ratio, $n, 'ok'];
        }
        $x = $ratio >= 10 ? self::num((int) round($ratio)) : str_replace('.', ',', (string) round($ratio, 1));
        $level = (!$same || $ratio >= 5) ? 'warning' : 'info';
        return ["{$head}: {$times}, ×{$x}.", $ratio, $n, $level];
    }

    private static function num(int $n): string
    {
        return number_format($n, 0, ',', '.');
    }

    private static function ms(float $ms): string
    {
        if ($ms < 0.001) {
            return '<1 µs';
        }
        if ($ms < 1) {
            return str_replace('.', ',', (string) round($ms * 1000, $ms * 1000 < 10 ? 1 : 0)) . ' µs';
        }
        if ($ms < 1000) {
            return str_replace('.', ',', (string) round($ms, $ms < 10 ? 1 : 0)) . ' ms';
        }
        return str_replace('.', ',', (string) round($ms / 1000, 2)) . ' s';
    }
}
