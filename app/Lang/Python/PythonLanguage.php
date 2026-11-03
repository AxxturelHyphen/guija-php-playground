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

    /** Catálogo del editor: firmas de la biblioteca estándar + data/catalogo.json. Se cachea en var/python-catalog.json. */
    public function catalog(): array
    {
        $cache = PG_VAR . '/python-catalog.json';
        $mtime = max((int) @filemtime(__DIR__ . '/data/catalogo.json'), (int) @filemtime(__DIR__ . '/motor/pg_analisis.py'));
        if (is_file($cache) && (int) @filemtime($cache) >= $mtime) {
            $c = json_decode((string) file_get_contents($cache), true);
            if (is_array($c) && isset($c['functions'])) {
                return $c;
            }
        }
        $c = $this->analizador('catalog', '');
        if (!is_array($c) || !isset($c['functions'])) {
            return ['functions' => [], 'classes' => [], 'keywords' => []];
        }
        if (!is_dir(PG_VAR)) {
            @mkdir(PG_VAR, 0777, true);
        }
        @file_put_contents($cache, json_encode($c, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $c;
    }

    // ───────────────────────────── análisis: analizador residente ─────────────────────────────
    //
    // Todo el análisis estático lo hace motor/pg_analisis.py (con `ast`, sin ejecutar el código). Arrancar Python
    // cuesta ~25 ms por petición, demasiado para un lint mientras se escribe; por eso hay un analizador RESIDENTE:
    // un proceso Python que escucha en 127.0.0.1 (puerto aleatorio, con token) y contesta en ~1 ms. Se arranca bajo
    // demanda, desacoplado de PHP, y se cierra solo tras 30 min sin uso. Si no responde se usa un proceso por petición.

    private const RESIDENTE_ESPERA_MS = 2500;

    /** @return string ruta del JSON {port, token, pid} del analizador residente */
    private static function rutaResidente(): string
    {
        return PG_VAR . DIRECTORY_SEPARATOR . 'python' . DIRECTORY_SEPARATOR . 'analizador.json';
    }

    /** Ejecuta un modo de pg_analisis.py y devuelve su JSON decodificado (o null si algo falla). Cachea por hash en la petición. */
    private function analizador(string $modo, string $code): ?array
    {
        static $memo = [];
        $k = $modo . md5($code);
        if (array_key_exists($k, $memo)) {
            return $memo[$k];
        }
        $r = null;
        if (getenv('PG_ANALIZADOR') !== '0') {
            $r = $this->viaResidente($modo, $code);
        }
        $r ??= $this->viaProceso($modo, $code);
        return $memo[$k] = $r;
    }

    /** Una petición al analizador residente; lo arranca si hace falta. */
    private function viaResidente(string $modo, string $code): ?array
    {
        $r = $this->hablarResidente($modo, $code);
        if ($r !== null) {
            return $r;
        }
        if (!$this->arrancarResidente()) {
            return null;
        }
        return $this->hablarResidente($modo, $code);
    }

    private function hablarResidente(string $modo, string $code): ?array
    {
        $info = json_decode((string) @file_get_contents(self::rutaResidente()), true);
        if (!is_array($info) || !isset($info['port'], $info['token'])) {
            return null;
        }
        // Analizador arrancado con una versión anterior de pg_analisis.py: se para y se relanza
        if (@filemtime(__DIR__ . '/motor/pg_analisis.py') > @filemtime(self::rutaResidente())) {
            self::pararResidente();
            @unlink(self::rutaResidente());
            return null;
        }
        $fp = @stream_socket_client('tcp://127.0.0.1:' . (int) $info['port'], $errno, $errstr, 0.3);
        if (!$fp) {
            return null;
        }
        stream_set_timeout($fp, 10);
        fwrite($fp, json_encode(['token' => $info['token'], 'modo' => $modo, 'codigo' => $code], JSON_UNESCAPED_UNICODE) . "\n");
        $linea = stream_get_line($fp, 64_000_000, "\n");
        fclose($fp);
        $j = is_string($linea) ? json_decode($linea, true) : null;
        return is_array($j) && !is_string($j['error'] ?? null) ? $j : null;
    }

    /** Lanza el analizador residente desacoplado de este proceso y espera a que publique su puerto. */
    private function arrancarResidente(): bool
    {
        $i = $this->info();
        if ($i['cmd'] === null || !$i['ok311']) {
            return false;
        }
        $dir = PG_VAR . DIRECTORY_SEPARATOR . 'python';
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        $fallo = $dir . DIRECTORY_SEPARATOR . 'analizador.fallo';
        if (is_file($fallo) && time() - (int) @filemtime($fallo) < 60) {
            return false;              // falló hace poco: no se insiste en cada pulsación
        }
        // Con un cerrojo, dos peticiones simultáneas no lanzan dos analizadores
        $lock = @fopen($dir . DIRECTORY_SEPARATOR . 'analizador.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            return false;
        }
        try {
            if ($this->hablarResidente('ping', '') !== null) {
                return true;           // otro proceso lo acaba de arrancar
            }
            @unlink(self::rutaResidente());
            $script = __DIR__ . DIRECTORY_SEPARATOR . 'motor' . DIRECTORY_SEPARATOR . 'pg_analisis.py';
            $py = $i['cmd'];
            if (DIRECTORY_SEPARATOR === '\\') {
                // pythonw.exe no abre ventana de consola; `start /B` + popen desacopla el proceso de PHP
                $exe = $py[0];
                $w = preg_replace('/python\.exe$/i', 'pythonw.exe', $exe);
                $exe = is_string($w) && is_file($w) ? $w : $exe;
                $args = array_slice($py, 1);
                $cmd = 'start "" /B "' . $exe . '" ' . implode(' ', array_map(static fn($a) => '"' . $a . '"', $args)) . ' -X utf8 -I -B -S "' . $script . '" --servidor "' . self::rutaResidente() . '"';
                $h = @popen($cmd, 'r');
                if (is_resource($h)) {
                    pclose($h);
                }
            } else {
                $pre = Process::which('setsid') !== null ? 'setsid ' : '';
                $cmd = $pre . 'nohup ' . implode(' ', array_map('escapeshellarg', [...$py, '-X', 'utf8', '-I', '-B', '-S', $script, '--servidor', self::rutaResidente()]))
                    . ' </dev/null >/dev/null 2>&1 &';
                @exec($cmd);
            }
            $fin = hrtime(true) + self::RESIDENTE_ESPERA_MS * 1_000_000;
            while (hrtime(true) < $fin) {
                usleep(15_000);
                if (is_file(self::rutaResidente()) && $this->hablarResidente('ping', '') !== null) {
                    return true;
                }
            }
            @touch($fallo);
            return false;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    /** Respaldo: un proceso Python por petición (el código va por stdin, nunca por la línea de comandos). */
    private function viaProceso(string $modo, string $code): ?array
    {
        $i = $this->info();
        if ($i['cmd'] === null || !$i['ok311']) {
            return null;
        }
        $r = Process::run([...$i['cmd'], '-X', 'utf8', '-I', '-B', '-S', __DIR__ . '/motor/pg_analisis.py', $modo],
            ['stdin' => json_encode(['codigo' => $code], JSON_UNESCAPED_UNICODE), 'timeout' => 20, 'grace' => 5]);
        $j = json_decode(trim($r['raw']), true);
        return is_array($j) ? $j : null;
    }

    /** Para los tests: cierra el analizador residente si hay uno. */
    public static function pararResidente(): void
    {
        $info = json_decode((string) @file_get_contents(self::rutaResidente()), true);
        if (!is_array($info) || !isset($info['port'], $info['token'])) {
            return;
        }
        $fp = @stream_socket_client('tcp://127.0.0.1:' . (int) $info['port'], $e, $s, 0.3);
        if ($fp) {
            stream_set_timeout($fp, 2);
            fwrite($fp, json_encode(['token' => $info['token'], 'modo' => 'parar']) . "\n");
            stream_get_line($fp, 100, "\n");
            fclose($fp);
        }
    }

    public function analyse(string $code): array
    {
        $r = $this->analizador('analyse', $code);
        if ($r === null) {       // sin Python no hay análisis, pero el editor sigue funcionando
            $loc = count(array_filter(preg_split('/\R/', $code) ?: [], static fn($l) => trim($l) !== '' && !str_starts_with(trim($l), '#')));
            return ['syntax' => false, 'diagnostics' => [], 'units' => [],
                'summary' => ['loc' => $loc, 'functions' => 0, 'ccTotal' => 0, 'ccMax' => 0, 'ccAvg' => 0, 'grade' => 'A', 'worst' => null, 'maxNesting' => 0]];
        }
        if (!empty($r['error'])) {
            $r['diagnostics'] = [$this->explainer($code)->explain($r['error'])];
        }
        unset($r['error']);
        return $r;
    }

    /** `ast.parse` sin ejecutar nada. */
    public function syntaxError(string $code): ?array
    {
        $r = $this->analizador('syntax', $code);
        return is_array($r) && !empty($r['error']) ? $r['error'] : null;
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
        // -X utf8: entrada/salida en UTF-8 también en Windows · -E: ignora PYTHON* · -P: sin la carpeta del script en sys.path
        // El harness se importa (no se ejecuta como script) para que su .pyc se reutilice: compilarlo en cada ejecución costaba ~15 ms.
        // Los .pyc van a var/pyc (pycache_prefix), no junto al código del usuario ni al del proyecto.
        $arranque = "import sys;d=sys.argv.pop(1);sys.path.insert(0,d);import pg_harness;sys.path.remove(d);sys.exit(pg_harness._main())";
        $cmd = [...$i['cmd'], '-X', 'utf8', '-E', '-P', '-X', 'pycache_prefix=' . PG_VAR . DIRECTORY_SEPARATOR . 'pyc', '-c', $arranque,
            __DIR__ . DIRECTORY_SEPARATOR . 'motor', $file];
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

    // ───────────────────────────── explicador y soluciones ─────────────────────────────

    public function explainer(string $code): Explains
    {
        return new PyExplainer($code, $this);
    }


    /**
     * Declaraciones de primer nivel (funciones y clases) con la clave `function:<nombre en minúsculas>` o `type:<clase>`.
     * start/end son bytes UTF-8 e incluyen los decoradores y los comentarios `#` pegados encima.
     * El docstring de una solución documenta el ejercicio:  Resumen. / @complejidad / @explicacion / @alternativas / @bigo
     */
    public function declarations(string $code): array
    {
        $r = $this->analizador('decls', $code);
        return is_array($r) ? $r : [];
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
