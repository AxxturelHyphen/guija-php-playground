<?php
declare(strict_types=1);

namespace Playground\Lang\Python;

use Playground\Core\Explains;
use Playground\Core\Language;
use Playground\Core\Process;
use Playground\Core\Protocol;

defined('PG_ROOT') or exit;

/**
 * Python: se ejecuta con un intérprete aparte (3.11+) y el harness motor/pg_harness.py.
 * Hay que buscarlo y sondearlo (versión, numpy, matplotlib…); eso lanza un proceso, así que se cachea en var/python.json.
 */
final class PythonLanguage extends Language
{
    private const CACHE_SEGUNDOS = 600;
    private const MODULOS = ['numpy', 'matplotlib', 'librosa'];

    /** @var ?array<string,mixed> */
    private ?array $info = null;

    public function id(): string
    {
        return 'python';
    }

    public function name(): string
    {
        return 'Python';
    }

    public function ext(): string
    {
        return 'py';
    }

    // ───────────────────────────── intérprete ─────────────────────────────

    /** Ruta del python del entorno virtual del proyecto (arrancar.bat / arrancar.sh lo crean), o null. */
    private static function venvPython(): ?string
    {
        foreach ([PG_ROOT . '/.venv/Scripts/python.exe', PG_ROOT . '/.venv/bin/python'] as $p) {
            if (is_file($p)) {
                return $p;
            }
        }
        return null;
    }

    /**
     * Candidatos en orden: PG_PYTHON, .venv, `py -3` (Windows), python3, python. Cada uno es el comando completo.
     * @return list<list<string>>
     */
    private static function candidatos(): array
    {
        $c = [];
        $env = getenv('PG_PYTHON');
        if (is_string($env) && trim($env) !== '') {
            $ruta = Process::which(trim($env));
            if ($ruta !== null) {
                $c[] = [$ruta];
            }
        }
        if (($v = self::venvPython()) !== null) {
            $c[] = [$v];
        }
        if (DIRECTORY_SEPARATOR === '\\' && ($py = Process::which('py')) !== null) {
            $c[] = [$py, '-3'];
        }
        foreach (['python3', 'python'] as $n) {
            if (($p = Process::which($n)) !== null) {
                $c[] = [$p];
            }
        }
        return $c;
    }

    /**
     * Lanza `python -c ...` y devuelve {version, major, minor, mods} o null si no es un Python que responda.
     * @param list<string> $cmd
     * @return ?array<string,mixed>
     */
    private static function sondear(array $cmd): ?array
    {
        $codigo = "import sys,json,importlib.util as u\n"
            . "print(json.dumps({'v':list(sys.version_info[:3]),'m':{n:u.find_spec(n) is not None for n in " . json_encode(self::MODULOS) . "}}))";
        $r = Process::run([...$cmd, '-I', '-c', $codigo], ['timeout' => 15, 'grace' => 5]);
        $j = json_decode(trim($r['raw']), true);
        if ($r['killed'] !== null || !is_array($j) || !isset($j['v'][2])) {
            return null;
        }
        return ['cmd' => $cmd, 'version' => implode('.', $j['v']), 'major' => (int) $j['v'][0], 'minor' => (int) $j['v'][1],
            'mods' => array_map('boolval', (array) $j['m'])];
    }

    /**
     * Qué Python usar y qué trae. Se cachea unos 10 min en var/python.json (la clave incluye PG_PYTHON y el .venv,
     * así que crear el entorno virtual o cambiar la variable invalida la caché al momento).
     * @return array<string,mixed> {cmd:?list<string>, version:?string, ok311:bool, mods:array<string,bool>}
     */
    private function info(): array
    {
        if ($this->info !== null) {
            return $this->info;
        }
        $venv = self::venvPython();
        $clave = (string) getenv('PG_PYTHON') . '|' . ($venv ?? '') . '|' . ($venv !== null ? (int) @filemtime($venv) : 0);
        $archivo = PG_VAR . '/python.json';
        $c = is_file($archivo) ? json_decode((string) @file_get_contents($archivo), true) : null;
        if (is_array($c) && ($c['clave'] ?? null) === $clave && time() - (int) ($c['t'] ?? 0) < self::CACHE_SEGUNDOS
            && ($c['cmd'] === null || is_file((string) $c['cmd'][0]))) {
            return $this->info = $c;
        }

        $mejor = null;       // el primero que responde pero es demasiado viejo, para poder decir su versión
        $info = ['cmd' => null, 'version' => null, 'ok311' => false, 'mods' => []];
        foreach (self::candidatos() as $cmd) {
            $s = self::sondear($cmd);
            if ($s === null) {
                continue;
            }
            if ($s['major'] > 3 || ($s['major'] === 3 && $s['minor'] >= 11)) {
                $info = ['cmd' => $cmd, 'version' => $s['version'], 'ok311' => true, 'mods' => $s['mods']];
                $mejor = null;
                break;
            }
            $mejor ??= $s;
        }
        if ($mejor !== null) {
            $info['version'] = $mejor['version'];
        }
        $info += ['clave' => $clave, 't' => time()];
        if (!is_dir(PG_VAR)) {
            @mkdir(PG_VAR, 0777, true);
        }
        @file_put_contents($archivo, json_encode($info), LOCK_EX);
        return $this->info = $info;
    }

    public function meta(): array
    {
        $i = $this->info();
        $missing = [];
        $notes = [];
        $nuevo = DIRECTORY_SEPARATOR === '\\'
            ? 'Instala Python 3.11 o superior desde python.org (marca «Add python.exe to PATH») y vuelve a abrir arrancar.bat: crea la carpeta .venv e instala lo necesario.'
            : 'Instala Python 3.11 o superior (p. ej. apt install python3 python3-venv) y vuelve a abrir arrancar.sh: crea la carpeta .venv e instala lo necesario.';
        if (!$i['ok311']) {
            $missing[] = ['what' => 'Python 3.11 o superior' . ($i['version'] ? " (se encontró la {$i['version']})" : ''), 'how' => $nuevo];
            return ['version' => $i['version'], 'ok' => false, 'missing' => $missing, 'notes' => $notes];
        }
        $pip = DIRECTORY_SEPARATOR === '\\' ? '.venv\\Scripts\\python -m pip install -r requirements.txt' : '.venv/bin/python -m pip install -r requirements.txt';
        foreach (['numpy', 'matplotlib'] as $m) {
            if (empty($i['mods'][$m])) {
                $missing[] = ['what' => "El paquete {$m}", 'how' => "Ejecuta arrancar.bat (lo instala solo) o, a mano: {$pip}"];
            }
        }
        if (empty($i['mods']['librosa'])) {
            $notes[] = 'librosa no está instalado: solo hace falta para la lección de audio (' . (DIRECTORY_SEPARATOR === '\\' ? '.venv\\Scripts\\python' : '.venv/bin/python') . ' -m pip install -r requirements-audio.txt).';
        }
        return ['version' => $i['version'], 'ok' => $missing === [], 'missing' => $missing, 'notes' => $notes];
    }

    public function catalog(): array
    {
        return ['functions' => [], 'classes' => [], 'keywords' => []];
    }

    // ───────────────────────────── análisis (el completo es el encargo 2) ─────────────────────────────

    public function analyse(string $code): array
    {
        $syntax = $this->syntaxError($code);
        $diags = $syntax !== null ? [$this->explainer($code)->explain($syntax)] : [];
        $loc = count(array_filter(preg_split('/\R/', $code) ?: [], static fn($l) => trim($l) !== '' && !str_starts_with(trim($l), '#')));
        return ['syntax' => $syntax !== null, 'diagnostics' => $diags, 'units' => [],
            'summary' => ['loc' => $loc, 'functions' => 0, 'ccTotal' => 0, 'ccMax' => 0, 'ccAvg' => 0, 'grade' => 'A', 'worst' => null, 'maxNesting' => 0]];
    }

    /** `ast.parse` en un proceso corto (sin ejecutar el código). Cachea por hash del código. */
    public function syntaxError(string $code): ?array
    {
        static $memo = [];
        $h = md5($code);
        if (array_key_exists($h, $memo)) {
            return $memo[$h];
        }
        $i = $this->info();
        if ($i['cmd'] === null || !$i['ok311']) {
            return null;       // sin intérprete no se puede comprobar
        }
        $dir = PG_VAR . '/sintaxis';
        $archivo = "{$dir}/{$h}.json";
        if (is_file($archivo)) {
            $c = json_decode((string) @file_get_contents($archivo), true);
            if (is_array($c) && array_key_exists('err', $c)) {
                return $memo[$h] = $c['err'];
            }
        }
        $r = Process::run([...$i['cmd'], '-X', 'utf8', '-I', '-B', '-S', __DIR__ . '/motor/pg_sintaxis.py'], ['stdin' => $code, 'timeout' => 10, 'grace' => 5]);
        $salida = trim($r['raw']);
        $err = null;
        if ($salida !== 'ok') {
            $ev = json_decode($salida, true);
            if (!is_array($ev)) {
                return $memo[$h] = null;       // el proceso falló por otra cosa: no es un error del usuario
            }
            $err = $ev;
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        // Se conservan las últimas 200 comprobaciones
        $viejos = glob($dir . '/*.json') ?: [];
        if (count($viejos) > 200) {
            usort($viejos, static fn($a, $b) => filemtime($a) <=> filemtime($b));
            foreach (array_slice($viejos, 0, 100) as $f) {
                @unlink($f);
            }
        }
        @file_put_contents($archivo, json_encode(['err' => $err]));
        return $memo[$h] = $err;
    }

    // ───────────────────────────── ejecución ─────────────────────────────

    public function run(string $code, string $displayName, array $opts = []): array
    {
        $timeout = max(1, min(Process::MAX_TIMEOUT, (int) ($opts['timeout'] ?? 5)));
        $i = $this->info();
        if ($i['cmd'] === null || !$i['ok311']) {
            return ['items' => [['t' => 'out', 'text' => 'No se encontró Python 3.11 o superior.']], 'exit' => -1, 'killed' => 'launch', 'wallMs' => 0, 'truncated' => false, 'timeout' => $timeout];
        }
        $file = Process::tempDir() . DIRECTORY_SEPARATOR . 'pg_' . bin2hex(random_bytes(6)) . '.py';
        file_put_contents($file, $code);
        $mpl = PG_VAR . DIRECTORY_SEPARATOR . 'mpl';
        if (!is_dir($mpl)) {
            @mkdir($mpl, 0777, true);
        }

        $env = [
            'PG_BENCH' => !empty($opts['bench']) ? '1' : '0',
            'PG_TIMEOUT' => (string) $timeout,
            'PG_MEMORY_MB' => '256',
            'MPLBACKEND' => 'module://pg_mpl',
            'MPLCONFIGDIR' => $mpl,
            'PYTHONPATH' => null, 'PYTHONHOME' => null,
        ];
        if (isset($opts['benchBudgetMs'])) {
            $env['PG_BENCH_BUDGET_MS'] = (string) (int) $opts['benchBudgetMs'];
        }
        // -X utf8: entrada/salida en UTF-8 también en Windows · -E: ignora PYTHON* · -B: sin .pyc · -P: sin la carpeta del script en sys.path
        $cmd = [...$i['cmd'], '-X', 'utf8', '-E', '-B', '-P', __DIR__ . DIRECTORY_SEPARATOR . 'motor' . DIRECTORY_SEPARATOR . 'pg_harness.py', $file];
        $res = Process::run($cmd, [
            'stdin' => (string) ($opts['stdin'] ?? ''), 'timeout' => $timeout, 'grace' => 2,
            'env' => $env, 'cwd' => PG_PRACTICAS . '/python',
        ]);
        @unlink($file);
        if ($res['killed'] === 'launch') {
            return ['items' => [['t' => 'out', 'text' => 'No se pudo lanzar Python']], 'exit' => -1, 'killed' => null, 'wallMs' => 0, 'truncated' => false, 'timeout' => $timeout];
        }
        $items = Protocol::split($res['raw']);
        $items = Protocol::scrub($items, Protocol::pathNeedles($file), $displayName);
        return ['items' => $items, 'exit' => $res['exit'], 'killed' => $res['killed'], 'wallMs' => $res['wallMs'], 'truncated' => $res['truncated'], 'timeout' => $timeout];
    }

    // ───────────────────────────── explicador (provisional) ─────────────────────────────

    public function explainer(string $code): Explains
    {
        return new class implements Explains {
            private const TITULOS = [
                'timeout' => 'El programa tardó demasiado y se cortó',
                'memory' => 'El programa gastó demasiada memoria',
                'stack' => 'Recursión demasiado profunda',
                'parse' => 'Error de sintaxis',
                'warning' => 'Aviso',
                'deprecated' => 'Función obsoleta',
            ];

            public function explain(array $ev): array
            {
                $kind = (string) ($ev['kind'] ?? 'exception');
                $line = max(1, (int) ($ev['line'] ?? 1));
                $cls = (string) ($ev['cls'] ?? '');
                $msg = (string) ($ev['msg'] ?? 'Error');
                $warn = in_array($kind, ['warning', 'deprecated'], true);
                $title = self::TITULOS[$kind] ?? '';
                if ($kind === 'exception' || $title === '') {
                    $title = ($cls !== '' ? $cls . ': ' : '') . $msg;
                } elseif ($kind === 'parse' || $warn) {
                    $title .= ': ' . $msg;
                } elseif ($kind === 'timeout') {
                    $title .= ' (límite: ' . (int) ($ev['limit'] ?? 5) . ' s)';
                }
                $d = ['source' => $kind === 'parse' ? 'syntax' : 'runtime', 'severity' => $warn ? 'warning' : 'error', 'code' => $kind === 'exception' && $cls !== '' ? 'py.' . $cls : $kind,
                    'line' => $line, 'col' => (int) ($ev['col'] ?? 1), 'endLine' => (int) ($ev['endLine'] ?? $line), 'endCol' => (int) ($ev['endCol'] ?? 1000),
                    'title' => $title, 'message' => $msg, 'explain' => '', 'original' => ($cls !== '' ? $cls . ': ' : '') . $msg];
                if (!empty($ev['trace'])) {
                    $d['trace'] = $ev['trace'];
                }
                return $d;
            }
        };
    }

    // ───────────────────────────── soluciones ─────────────────────────────

    public function declarations(string $code): array
    {
        return [];       // el analizador completo es el encargo 2
    }

    /**
     * Tras el docstring del módulo, los `from __future__` y los imports iniciales (con sus continuaciones).
     * Devuelve el offset (bytes) del final de la última de esas sentencias, sin su salto de línea.
     */
    public function insertionPoint(string $code, array $decl): int
    {
        preg_match_all('/[^\n]*\n|[^\n]+$/', $code, $m, PREG_OFFSET_CAPTURE);
        $lines = $m[0];
        $n = count($lines);
        $fin = 0;                 // final de lo último aceptado
        $i = 0;
        // Cabecera: shebang y línea de codificación
        while ($i < $n && $i < 2 && preg_match('/^#!|^#.*coding[:=]/', $lines[$i][0])) {
            $fin = $lines[$i][1] + strlen(rtrim($lines[$i][0], "\r\n"));
            $i++;
        }
        $saltar = static function () use (&$i, $lines, $n): void {
            while ($i < $n && (($t = trim($lines[$i][0])) === '' || $t[0] === '#')) {
                $i++;
            }
        };
        $saltar();
        // Docstring del módulo: una cadena sola en su sentencia (de una o varias líneas)
        if ($i < $n && preg_match('/\G[rRuU]{0,2}(?:"""(?:[^\\\\]|\\\\.)*?"""|\'\'\'(?:[^\\\\]|\\\\.)*?\'\'\'|"(?:[^"\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\n]|\\\\.)*\')[ \t]*(?:#[^\n]*)?(?=\r?\n|$)/s', $code, $q, 0, $lines[$i][1])) {
            $hasta = $lines[$i][1] + strlen(rtrim($q[0], " \t\r\n"));
            $fin = $hasta;
            while ($i < $n && $lines[$i][1] < $hasta) {
                $i++;
            }
        }
        $saltar();
        // Imports iniciales (una sentencia puede continuar con paréntesis o con «\»)
        while ($i < $n && preg_match('/^(import\s|from\s+\S+\s+import\b)/', $lines[$i][0])) {
            $j = $i;
            $prof = 0;
            while (true) {
                $sinComentario = preg_replace('/#.*$/', '', rtrim($lines[$j][0], "\r\n")) ?? '';
                $prof += substr_count($sinComentario, '(') - substr_count($sinComentario, ')');
                if (($prof > 0 || str_ends_with(rtrim($sinComentario), '\\')) && $j + 1 < $n) {
                    $j++;
                    continue;
                }
                break;
            }
            $fin = $lines[$j][1] + strlen(rtrim($lines[$j][0], "\r\n"));
            $i = $j + 1;
            $saltar();
        }
        return $fin;
    }
}
