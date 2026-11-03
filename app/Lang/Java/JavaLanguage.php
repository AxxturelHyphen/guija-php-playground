<?php
declare(strict_types=1);

namespace Playground\Lang\Java;

use Playground\Core\Explains;
use Playground\Lang\Java\Analysis\{JavaCode, JavaHints, JavaMetrics};
use Playground\Core\Language;
use Playground\Core\Process;
use Playground\Core\Protocol;

defined('PG_ROOT') or exit;

/**
 * Java: una lección es UN archivo con una clase con `static void main` (JDK 21, sin package ni tipos public).
 * Se compila con javac (un compilador RESIDENTE en memoria, o `javac` como respaldo) contra el harness `pg` y se ejecuta
 * con `java pg.PgMain <Clase>`. La API de pruebas llega sola: se inyecta `import static pg.Pg.*;` al principio de la
 * LÍNEA 1 (sin añadir líneas, así que las líneas de los errores coinciden con las del editor; la columna de la línea 1
 * se corrige).
 *
 * Todo lo que se calcula con procesos se cachea en var/java*: el JDK (var/java.json), el harness compilado
 * (var/java/harness/) y el compilador residente (var/java/compilador.json).
 */
final class JavaLanguage extends Language
{
    private const CACHE_SEGUNDOS = 600;
    private const PREFIJO = 'import static pg.Pg.*; ';
    private const RESIDENTE_ESPERA_MS = 5000;

    /** @var ?array<string,mixed> */
    private ?array $info = null;
    /** 'residente' | 'javac': cómo se hizo la última compilación (para los tests). */
    public string $ultimaVia = '';
    /** @var ?array{k:string,dir:string,diags:list<array<string,mixed>>} última compilación sin errores, a la espera de run() */
    private ?array $precompilado = null;

    public function id(): string
    {
        return 'java';
    }

    public function name(): string
    {
        return 'Java';
    }

    public function ext(): string
    {
        return 'java';
    }

    // ───────────────────────────── JDK ─────────────────────────────

    /** @return array<string,?string> variables que imprimen un aviso en cada JVM: se quitan del entorno de los hijos. */
    private static function envHijos(): array
    {
        return ['JAVA_TOOL_OPTIONS' => null, '_JAVA_OPTIONS' => null, 'JDK_JAVA_OPTIONS' => null];
    }

    private static function exe(string $dir, string $nombre): ?string
    {
        $p = $dir . DIRECTORY_SEPARATOR . $nombre . (DIRECTORY_SEPARATOR === '\\' ? '.exe' : '');
        return is_file($p) ? $p : null;
    }

    /**
     * Carpetas bin candidatas, en orden: PG_JAVA_HOME, JAVA_HOME, el PATH.
     * @return list<string>
     */
    private static function candidatos(): array
    {
        $c = [];
        foreach (['PG_JAVA_HOME', 'JAVA_HOME'] as $v) {
            $h = getenv($v);
            if (is_string($h) && trim($h) !== '' && is_dir(trim($h) . DIRECTORY_SEPARATOR . 'bin')) {
                $c[] = rtrim(trim($h), '/\\') . DIRECTORY_SEPARATOR . 'bin';
            }
        }
        if (($j = Process::which('javac')) !== null) {
            $c[] = dirname($j);
        }
        return array_values(array_unique($c));
    }

    /**
     * Qué JDK se usa. Se cachea 10 min en var/java.json (la clave incluye PG_JAVA_HOME, JAVA_HOME y el PATH).
     * @return array{javac:?string, java:?string, version:?string, major:int, ok:bool}
     */
    private function jdk(): array
    {
        if ($this->info !== null) {
            return $this->info;
        }
        $clave = (string) getenv('PG_JAVA_HOME') . '|' . (string) getenv('JAVA_HOME') . '|' . md5((string) getenv('PATH'));
        $archivo = PG_VAR . '/java.json';
        $c = is_file($archivo) ? json_decode((string) @file_get_contents($archivo), true) : null;
        if (is_array($c) && ($c['clave'] ?? null) === $clave && time() - (int) ($c['t'] ?? 0) < self::CACHE_SEGUNDOS
            && ($c['javac'] === null || is_file((string) $c['javac']))) {
            return $this->info = $c;
        }
        $mejor = ['javac' => null, 'java' => null, 'version' => null, 'major' => 0, 'ok' => false];
        foreach (self::candidatos() as $bin) {
            $javac = self::exe($bin, 'javac');
            $java = self::exe($bin, 'java');
            if ($javac === null || $java === null) {
                continue;
            }
            $r = Process::run([$javac, '-version'], ['timeout' => 20, 'grace' => 5, 'env' => self::envHijos()]);
            if (!preg_match('/javac\s+(\d+)(?:\.(\d+))?(?:\.(\d+))?/', $r['raw'], $m)) {
                continue;
            }
            $major = (int) $m[1] === 1 ? (int) ($m[2] ?? 0) : (int) $m[1];
            $v = ['javac' => $javac, 'java' => $java, 'version' => $m[1] . (isset($m[2]) ? '.' . $m[2] : '') . (isset($m[3]) ? '.' . $m[3] : ''),
                'major' => $major, 'ok' => $major >= 21];
            if ($v['ok']) {
                $mejor = $v;
                break;
            }
            if ($mejor['javac'] === null) {
                $mejor = $v;
            }
        }
        $mejor += ['clave' => $clave, 't' => time()];
        if (!is_dir(PG_VAR)) {
            @mkdir(PG_VAR, 0777, true);
        }
        @file_put_contents($archivo, json_encode($mejor), LOCK_EX);
        return $this->info = $mejor;
    }

    public function meta(): array
    {
        $i = $this->jdk();
        $missing = [];
        if (!$i['ok']) {
            $como = DIRECTORY_SEPARATOR === '\\'
                ? 'Instala Eclipse Temurin 21 LTS (el JDK, no el JRE) desde https://adoptium.net : en el instalador activa «Set JAVA_HOME variable» y «Add to PATH». '
                . 'Después vuelve a abrir arrancar.bat. Si ya tienes un JDK 21 en otra carpeta, apúntalo con la variable PG_JAVA_HOME.'
                : 'Instala un JDK 21 (p. ej. apt install openjdk-21-jdk, o Eclipse Temurin 21 LTS desde https://adoptium.net) y vuelve a abrir arrancar.sh. '
                . 'Si ya tienes uno en otra carpeta, apúntalo con la variable PG_JAVA_HOME.';
            $missing[] = ['what' => 'JDK 21 o superior (javac)' . ($i['version'] ? " (se encontró la {$i['version']})" : ''), 'how' => $como];
        }
        return ['version' => $i['version'], 'ok' => $missing === [], 'missing' => $missing, 'notes' => []];
    }

    /** Catálogo del editor (data/catalogo.json), cacheado en memoria y en var/java-catalog.json. */
    public function catalog(): array
    {
        static $memo = null;
        if ($memo !== null) {
            return $memo;
        }
        $fuente = __DIR__ . '/data/catalogo.json';
        $cache = PG_VAR . '/java-catalog.json';
        if (is_file($cache) && (int) @filemtime($cache) >= (int) @filemtime($fuente)) {
            $c = json_decode((string) @file_get_contents($cache), true);
            if (is_array($c) && isset($c['functions'])) {
                return $memo = $c;
            }
        }
        $c = json_decode((string) @file_get_contents($fuente), true);
        if (!is_array($c) || !isset($c['functions'])) {
            return ['functions' => [], 'classes' => [], 'keywords' => []];
        }
        if (!is_dir(PG_VAR)) {
            @mkdir(PG_VAR, 0777, true);
        }
        @file_put_contents($cache, json_encode($c, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $memo = $c;
    }

    // ───────────────────────────── harness y compilador compilados ─────────────────────────────

    private static function dirJava(): string
    {
        return PG_VAR . DIRECTORY_SEPARATOR . 'java';
    }

    private static function dirHarness(): string
    {
        return self::dirJava() . DIRECTORY_SEPARATOR . 'harness';
    }

    /**
     * Compila el harness (motor/pg/*.java) y el compilador residente (motor/PgJavac.java) en var/java/ si no están o si
     * cambió su fuente. Un cerrojo evita que dos peticiones compilen a la vez.
     */
    private function preparar(): bool
    {
        static $listo = [];
        $i = $this->jdk();
        if (!$i['ok']) {
            return false;
        }
        $clave = (string) $i['javac'];
        if (isset($listo[$clave])) {
            return $listo[$clave];
        }
        $motor = __DIR__ . DIRECTORY_SEPARATOR . 'motor';
        $pg = glob($motor . '/pg/*.java') ?: [];
        sort($pg);
        $ok = $this->compilarFuentes($pg, self::dirHarness(), 'pg/PgMain.class')
            && $this->compilarFuentes([$motor . '/PgJavac.java'], self::dirJava() . DIRECTORY_SEPARATOR . 'motor', 'PgJavac.class');
        return $listo[$clave] = $ok;
    }

    /** @param list<string> $fuentes */
    private function compilarFuentes(array $fuentes, string $destino, string $comprobar): bool
    {
        $firma = md5((string) $this->jdk()['version'] . implode('', array_map(static fn($f) => basename($f) . (string) @file_get_contents($f), $fuentes)));
        $al_dia = static fn(): bool => is_file($destino . '/.firma') && trim((string) @file_get_contents($destino . '/.firma')) === $firma
            && is_file($destino . DIRECTORY_SEPARATOR . $comprobar);
        if ($al_dia()) {
            return true;
        }
        $dir = self::dirJava();
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        $lock = @fopen($dir . DIRECTORY_SEPARATOR . 'preparar.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            return false;
        }
        try {
            if ($al_dia()) {
                return true;           // otra petición lo acaba de compilar
            }
            $tmp = $destino . '.tmp' . bin2hex(random_bytes(3));
            @mkdir($tmp, 0777, true);
            $r = Process::run([$this->jdk()['javac'], '--release', '21', '-proc:none', '-encoding', 'UTF-8', '-g', '-nowarn', '-d', $tmp, ...$fuentes],
                ['timeout' => 90, 'grace' => 10, 'env' => self::envHijos()]);
            if ($r['exit'] !== 0 || !is_file($tmp . DIRECTORY_SEPARATOR . $comprobar)) {
                Process::rmTree($tmp);
                return false;
            }
            file_put_contents($tmp . '/.firma', $firma);
            Process::rmTree($destino);
            return @rename($tmp, $destino);
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    // ───────────────────────────── compilación ─────────────────────────────

    /**
     * Nombre del archivo temporal (el del tipo `public`, si lo hay: javac lo exige) y clase que se ejecuta.
     * @return array{0:string, 1:?string}
     */
    private static function nombres(string $code): array
    {
        $publico = null;
        foreach (JavaLexer::types($code) as $t) {
            if ($t['public'] && preg_match('/^[A-Za-z_$][\w$]*$/', $t['name'])) {
                $publico = $t['name'];
                break;
            }
        }
        $main = JavaLexer::container($code);
        return [($publico ?? 'pgj_' . bin2hex(random_bytes(5))) . '.java', $main !== null && !empty($main['hasMain']) ? $main['name'] : null];
    }

    /**
     * Compila $code en $dir (que ya existe). Devuelve null si falta el JDK; si no, los diagnósticos de javac.
     * @return ?array{ok:bool, diags:list<array<string,mixed>>}
     */
    private function compilar(string $code, string $dir, string $file): ?array
    {
        if (!$this->preparar()) {
            return null;
        }
        $src = self::PREFIJO . $code;
        file_put_contents($dir . DIRECTORY_SEPARATOR . $file, $src);
        $r = null;
        if (getenv('PG_COMPILADOR') !== '0') {
            $r = $this->viaResidente($file, $src, $dir);
            $this->ultimaVia = 'residente';
        }
        if ($r === null) {
            $r = $this->viaJavac($file, $src, $dir);
            $this->ultimaVia = 'javac';
        }
        // La inyección ocupa la línea 1: se devuelve la columna que ve el usuario
        $quita = strlen(self::PREFIJO);
        foreach ($r['diags'] as &$d) {
            $d['line'] = max(1, (int) ($d['line'] ?? 1));
            $d['col'] = max(1, (int) ($d['col'] ?? 1) - ($d['line'] === 1 ? $quita : 0));
            $d['endLine'] = max($d['line'], (int) ($d['endLine'] ?? $d['line']));
            $d['endCol'] = max(1, (int) ($d['endCol'] ?? $d['col'] + 1) - ($d['endLine'] === 1 ? $quita : 0));
            if ($d['endLine'] === $d['line'] && $d['endCol'] <= $d['col']) {
                $d['endCol'] = $d['col'] + 1;
            }
            unset($d['start'], $d['end']);
        }
        unset($d);
        return $r;
    }

    /** Respaldo: `javac -XDrawDiagnostics` en la línea de comandos (~0,6 s). */
    private function viaJavac(string $file, string $src, string $dir): array
    {
        $r = Process::run([$this->jdk()['javac'], '--release', '21', '-proc:none', '-encoding', 'UTF-8', '-g', '-Xlint:none', '-XDrawDiagnostics',
            '-cp', self::dirHarness(), '-d', $dir, $dir . DIRECTORY_SEPARATOR . $file], ['timeout' => 60, 'grace' => 10, 'env' => self::envHijos()]);
        $lineas = preg_split('/\R/', $src) ?: [];
        $diags = [];
        foreach (preg_split('/\R/', $r['raw']) ?: [] as $l) {
            if (!preg_match('/^(?:.*[\/\\\\])?[^\/\\\\:]+\.java:(\d+):(\d+): (compiler\.(err|warn)\.[\w.\-]+)(?:: (.*))?$/', $l, $m)) {
                continue;
            }
            $linea = (int) $m[1];
            // javac cuenta el tabulador como hasta la siguiente columna múltiplo de 8: se vuelve a columna UTF-16 del carácter
            $chars = preg_split('//u', $lineas[$linea - 1] ?? '', -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $visual = 1;
            $col16 = 1;
            $idx = 0;
            foreach ($chars as $ch) {
                if ($visual >= (int) $m[2]) {
                    break;
                }
                $visual = $ch === "\t" ? intdiv($visual - 1, 8) * 8 + 9 : $visual + (strlen($ch) === 4 ? 2 : 1);
                $col16 += strlen($ch) === 4 ? 2 : 1;
                $idx++;
            }
            $palabra = 0;
            for ($q = $idx; $q < count($chars) && preg_match('/^[\w$]$/', $chars[$q]); $q++) {
                $palabra++;
            }
            $palabra = max(1, $palabra);
            $diags[] = ['kind' => $m[4] === 'err' ? 'error' : 'warning', 'code' => $m[3], 'msg' => $m[3] . (isset($m[5]) ? ': ' . $m[5] : ''),
                'line' => $linea, 'col' => $col16, 'endLine' => $linea, 'endCol' => $col16 + $palabra];
        }
        $errores = array_filter($diags, static fn($d) => $d['kind'] === 'error');
        if ($r['exit'] !== 0 && $errores === []) {
            $diags[] = ['kind' => 'error', 'code' => 'compiler.err.interno', 'msg' => trim(mb_substr($r['raw'], 0, 400)) ?: 'javac falló', 'line' => 1, 'col' => 1];
        }
        return ['ok' => $r['exit'] === 0, 'diags' => $diags];
    }

    // ───────────────────────────── compilador residente ─────────────────────────────

    private static function rutaResidente(): string
    {
        return self::dirJava() . DIRECTORY_SEPARATOR . 'compilador.json';
    }

    /** @return ?array{ok:bool, diags:list<array<string,mixed>>} */
    private function viaResidente(string $file, string $src, string $dir): ?array
    {
        $pet = ['op' => 'compile', 'name' => $file, 'src' => $src, 'cp' => self::dirHarness(), 'out' => $dir];
        $r = $this->hablarResidente($pet);
        if ($r === null) {
            if (!$this->arrancarResidente()) {
                return null;
            }
            $r = $this->hablarResidente($pet);
        }
        if (!is_array($r) || !isset($r['diags']) || !is_array($r['diags'])) {
            return null;
        }
        return ['ok' => (bool) ($r['ok'] ?? false), 'diags' => $r['diags']];
    }

    /** @param array<string,mixed> $pet @return ?array<string,mixed> */
    private function hablarResidente(array $pet, float $espera = 60.0): ?array
    {
        $info = json_decode((string) @file_get_contents(self::rutaResidente()), true);
        if (!is_array($info) || !isset($info['port'], $info['token'])) {
            return null;
        }
        // Residente de una versión anterior del motor (PgJavac.class recompilado después de arrancarlo): se para y se relanza
        $clase = self::dirJava() . DIRECTORY_SEPARATOR . 'motor' . DIRECTORY_SEPARATOR . 'PgJavac.class';
        if (is_file($clase) && @filemtime($clase) > @filemtime(self::rutaResidente())) {
            self::pararResidente();
            @unlink(self::rutaResidente());
            return null;
        }
        $fp = @stream_socket_client('tcp://127.0.0.1:' . (int) $info['port'], $errno, $errstr, min(0.3, $espera));
        if (!$fp) {
            return null;
        }
        stream_set_timeout($fp, (int) $espera, (int) (fmod($espera, 1.0) * 1_000_000));
        fwrite($fp, json_encode(['token' => $info['token']] + $pet, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n");
        $linea = stream_get_line($fp, 64_000_000, "\n");
        fclose($fp);
        $j = is_string($linea) ? json_decode($linea, true) : null;
        return is_array($j) && !isset($j['error']) ? $j : null;
    }

    /** Lanza el compilador residente desacoplado de PHP y espera a que publique su puerto. */
    private function arrancarResidente(): bool
    {
        $jdk = $this->jdk();
        if (!$jdk['ok'] || !$this->preparar()) {
            return false;
        }
        $dir = self::dirJava();
        $fallo = $dir . DIRECTORY_SEPARATOR . 'compilador.fallo';
        if (is_file($fallo) && time() - (int) @filemtime($fallo) < 60) {
            return false;              // falló hace poco: no se insiste en cada petición
        }
        $lock = @fopen($dir . DIRECTORY_SEPARATOR . 'compilador.lock', 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) {
            return false;
        }
        try {
            if ($this->hablarResidente(['op' => 'ping']) !== null) {
                return true;           // otro proceso lo acaba de arrancar
            }
            @unlink(self::rutaResidente());
            $motor = $dir . DIRECTORY_SEPARATOR . 'motor';
            $flags = ['-Xmx512m', '-XX:+UseSerialGC', '-XX:-UsePerfData', '-Xshare:auto'];
            if (DIRECTORY_SEPARATOR === '\\') {
                // javaw no abre ventana de consola; `start /B` + popen desacopla el proceso de PHP
                $java = (string) $jdk['java'];
                $w = preg_replace('/java\.exe$/i', 'javaw.exe', $java);
                $java = is_string($w) && is_file($w) ? $w : $java;
                $cmd = 'set "JAVA_TOOL_OPTIONS=" & set "_JAVA_OPTIONS=" & set "JDK_JAVA_OPTIONS=" & start "" /B "' . $java . '" ' . implode(' ', $flags)
                    . ' -cp "' . $motor . '" PgJavac "' . self::rutaResidente() . '"';
                $h = @popen($cmd, 'r');
                if (is_resource($h)) {
                    pclose($h);
                }
            } else {
                $pre = Process::which('setsid') !== null ? 'setsid ' : '';
                $cmd = $pre . 'nohup env -u JAVA_TOOL_OPTIONS -u _JAVA_OPTIONS -u JDK_JAVA_OPTIONS '
                    . implode(' ', array_map('escapeshellarg', [(string) $jdk['java'], ...$flags, '-cp', $motor, 'PgJavac', self::rutaResidente()]))
                    . ' </dev/null >/dev/null 2>&1 &';
                @exec($cmd);
            }
            $fin = hrtime(true) + self::RESIDENTE_ESPERA_MS * 1_000_000;
            while (hrtime(true) < $fin) {
                usleep(20_000);
                if (is_file(self::rutaResidente()) && $this->hablarResidente(['op' => 'ping']) !== null) {
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

    /** Para los tests: cierra el compilador residente si hay uno. */
    public static function pararResidente(): void
    {
        $info = json_decode((string) @file_get_contents(self::rutaResidente()), true);
        if (!is_array($info) || !isset($info['port'], $info['token'])) {
            return;
        }
        $fp = @stream_socket_client('tcp://127.0.0.1:' . (int) $info['port'], $e, $s, 0.3);
        if ($fp) {
            stream_set_timeout($fp, 2);
            fwrite($fp, json_encode(['token' => $info['token'], 'op' => 'parar']) . "\n");
            stream_get_line($fp, 100, "\n");
            fclose($fp);
        }
    }

    // ───────────────────────────── sintaxis y análisis ─────────────────────────────

    /** Evento `err` de kind 'parse' para un diagnóstico del compilador. */
    private static function evParse(array $d): array
    {
        return ['t' => 'err', 'kind' => 'parse', 'cls' => 'CompileError', 'code' => (string) $d['code'], 'msg' => (string) $d['msg'],
            'line' => $d['line'], 'col' => $d['col'], 'endLine' => $d['endLine'], 'endCol' => $d['endCol']];
    }

    /** @return list<array<string,mixed>> errores de compilación (sin ejecutar nada) */
    private function errores(string $code): ?array
    {
        static $memo = [];
        $k = md5($code);
        if (array_key_exists($k, $memo)) {
            return $memo[$k];
        }
        if (!$this->jdk()['ok']) {
            return null;
        }
        $dir = Process::makeTempDir('pgj_');
        $conservar = false;
        try {
            [$file] = self::nombres($code);
            $r = $this->compilar($code, $dir, $file);
            $errs = $r === null ? null : array_values(array_filter($r['diags'], static fn($d) => $d['kind'] === 'error'));
            if ($r !== null && $errs === []) {
                // Compila sin errores: se guardan las clases para que run() no compile otra vez (Ctrl+Enter = syntaxError + run)
                $this->limpiarPrecompilado();
                $this->precompilado = ['k' => $k, 'dir' => $dir, 'diags' => $r['diags']];
                $conservar = true;
                static $registrado = false;
                if (!$registrado) {
                    $registrado = true;
                    register_shutdown_function(fn() => $this->limpiarPrecompilado());
                }
            }
        } finally {
            if (!$conservar) {
                Process::rmTree($dir);
            }
        }
        return $memo[$k] = $errs;
    }

    private function limpiarPrecompilado(): void
    {
        if ($this->precompilado !== null) {
            Process::rmTree($this->precompilado['dir']);
            $this->precompilado = null;
        }
    }

    public function syntaxError(string $code): ?array
    {
        $e = $this->errores($code);
        return $e === null || $e === [] ? null : self::evParse($e[0]);
    }

    /**
     * Errores de javac SOLO si el compilador residente ya está en marcha y responde dentro de $limiteMs: el análisis
     * mientras se escribe no puede esperar a un arranque en frío ni al javac de la línea de comandos (0,6 s).
     * @return ?list<array<string,mixed>> null = no hay respuesta a tiempo (esa ronda va sin errores de compilación)
     */
    private function erroresRapidos(string $code, int $limiteMs): ?array
    {
        if (getenv('PG_COMPILADOR') === '0' || !is_file(self::rutaResidente()) || !$this->jdk()['ok'] || !$this->preparar()) {
            return null;
        }
        $dir = Process::makeTempDir('pgj_');
        try {
            [$file] = self::nombres($code);
            $src = self::PREFIJO . $code;
            file_put_contents($dir . DIRECTORY_SEPARATOR . $file, $src);
            $r = $this->hablarResidente(['op' => 'compile', 'name' => $file, 'src' => $src, 'cp' => self::dirHarness(), 'out' => $dir, 'solo' => '1'], $limiteMs / 1000);
            if (!is_array($r) || !isset($r['diags']) || !is_array($r['diags'])) {
                return null;
            }
            $quita = strlen(self::PREFIJO);
            $errs = [];
            foreach ($r['diags'] as $d) {
                if (($d['kind'] ?? '') !== 'error') {
                    continue;
                }
                $d['line'] = max(1, (int) ($d['line'] ?? 1));
                $d['col'] = max(1, (int) ($d['col'] ?? 1) - ($d['line'] === 1 ? $quita : 0));
                $d['endLine'] = max($d['line'], (int) ($d['endLine'] ?? $d['line']));
                $d['endCol'] = max(1, (int) ($d['endCol'] ?? $d['col'] + 1) - ($d['endLine'] === 1 ? $quita : 0));
                if ($d['endLine'] === $d['line'] && $d['endCol'] <= $d['col']) {
                    $d['endCol'] = $d['col'] + 1;
                }
                $errs[] = $d;
            }
            return $errs;
        } finally {
            Process::rmTree($dir);
        }
    }

    /**
     * Análisis estático en PHP (sin JVM, unos pocos ms): métricas por método, O() y pistas. Los errores de compilación
     * de javac se añaden solo si el compilador residente contesta en menos de 120 ms.
     */
    public function analyse(string $code): array
    {
        $jc = new JavaCode($code);
        $mt = new JavaMetrics($jc);
        $res = $mt->compute();
        $ex = $this->explainer($code);
        $diags = [];
        // Un archivo de soluciones usa tipos de su lección y solo compila empalmado: sin errores de javac al leerlo
        $errs = preg_match('/^\s*(?:final\s+)?class\s+Soluciones\b/m', $code) ? [] : ($this->erroresRapidos($code, 120) ?? []);
        foreach (array_slice($errs, 0, 20) as $d) {
            $diags[] = $ex->explain(self::evParse($d));
        }
        foreach ((new JavaHints($jc, $mt))->all() as $h) {
            $diags[] = $h;
        }
        $loc = count(array_filter(preg_split('/\R/', $code) ?: [], static fn($l) => trim($l) !== '' && !str_starts_with(trim($l), '//')));
        $res['summary']['loc'] = max($res['summary']['loc'], $loc);
        return ['syntax' => $errs !== [], 'diagnostics' => $diags, 'units' => $res['units'], 'summary' => $res['summary']];
    }

    // ───────────────────────────── ejecución ─────────────────────────────

    public function run(string $code, string $displayName, array $opts = []): array
    {
        $timeout = max(1, min(Process::MAX_TIMEOUT, (int) ($opts['timeout'] ?? 5)));
        $falla = static fn(string $texto, ?string $killed = 'launch'): array => ['items' => [['t' => 'out', 'text' => $texto]], 'exit' => -1,
            'killed' => $killed, 'wallMs' => 0, 'truncated' => false, 'timeout' => $timeout];
        $jdk = $this->jdk();
        if (!$jdk['ok']) {
            return $falla('No se encontró un JDK 21 o superior.');
        }
        [$file, $main] = self::nombres($code);
        $pre = $this->precompilado;
        $this->precompilado = null;
        $reutiliza = $pre !== null && $pre['k'] === md5($code) && is_dir($pre['dir']);
        if ($pre !== null && !$reutiliza) {
            Process::rmTree($pre['dir']);
        }
        $dir = $reutiliza ? $pre['dir'] : Process::makeTempDir('pgj_');
        try {
            $t0 = hrtime(true);
            $c = $reutiliza ? ['ok' => true, 'diags' => $pre['diags']] : $this->compilar($code, $dir, $file);
            if ($c === null) {
                return $falla('No se pudo preparar el harness de Java.');
            }
            $errs = array_values(array_filter($c['diags'], static fn($d) => $d['kind'] === 'error'));
            if ($errs !== []) {
                // Error de compilación: se cuenta sin ejecutar nada
                return ['items' => array_map(static fn($d) => ['t' => 'ev', 'ev' => self::evParse($d)], array_slice($errs, 0, 10)), 'exit' => 1, 'killed' => null,
                    'wallMs' => intdiv(hrtime(true) - $t0, 1_000_000), 'truncated' => false, 'timeout' => $timeout];
            }
            if ($main === null) {
                return ['items' => [['t' => 'ev', 'ev' => ['t' => 'err', 'kind' => 'fatal', 'msg' => 'No hay ninguna clase con «public static void main(String[] args)»: sin él no hay por dónde empezar.', 'line' => 1]]],
                    'exit' => 1, 'killed' => null, 'wallMs' => 0, 'truncated' => false, 'timeout' => $timeout];
            }
            $env = self::envHijos() + ['PG_BENCH' => !empty($opts['bench']) ? '1' : '0', 'PG_TIMEOUT' => (string) $timeout];
            if (isset($opts['benchBudgetMs'])) {
                $env['PG_BENCH_BUDGET_MS'] = (string) (int) $opts['benchBudgetMs'];
            }
            $cmd = [$jdk['java'], '-cp', self::dirHarness() . PATH_SEPARATOR . $dir, '-Xmx256m', '-XX:+UseSerialGC', '-Xshare:auto', '-XX:-UsePerfData',
                '-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8'];
            if (empty($opts['bench'])) {
                $cmd[] = '-XX:TieredStopAtLevel=1';      // C1 solo: arranca antes; para medir sí se necesita C2
            }
            array_push($cmd, 'pg.PgMain', $main);
            $res = Process::run($cmd, ['stdin' => (string) ($opts['stdin'] ?? ''), 'timeout' => $timeout, 'grace' => 2, 'env' => $env,
                'cwd' => PG_PRACTICAS . '/java']);
        } finally {
            $archivo = $dir . DIRECTORY_SEPARATOR . $file;
            $needles = Protocol::pathNeedles($archivo);
            $needles[] = $dir;
            Process::rmTree($dir);
        }
        if ($res['killed'] === 'launch') {
            return $falla('No se pudo lanzar Java');
        }
        $items = Protocol::split($res['raw']);
        $items = Protocol::scrub($items, $needles, $displayName);
        return ['items' => $items, 'exit' => $res['exit'], 'killed' => $res['killed'], 'wallMs' => $res['wallMs'], 'truncated' => $res['truncated'], 'timeout' => $timeout];
    }

    // ───────────────────────────── explicador y soluciones ─────────────────────────────

    public function explainer(string $code): Explains
    {
        return new JavaExplainer($code);
    }

    /**
     * Declaraciones sustituibles: los métodos `static` de la clase con main (o de la envoltura `Soluciones`),
     * con la clave `function:<nombre en minúsculas>`, y los demás tipos de primer nivel (`type:<nombre>`).
     * start/end son bytes e incluyen el Javadoc y las anotaciones.
     */
    public function declarations(string $code): array
    {
        $cont = JavaLexer::container($code);
        $L = JavaLexer::lex($code);
        $T = $L['toks'];
        $linea = static fn(int $off): int => substr_count($code, "\n", 0, max(0, min($off, strlen($code)))) + 1;
        $mk = static function (string $key, string $name, string $kind, array $d) use ($code, $L, $T, $linea): array {
            $norm = '';
            for ($i = $d['ti']; $i <= $d['tj'] && $i < count($T); $i++) {
                $norm .= $T[$i][1];
            }
            $doc = $L['doc'][$d['ti']] ?? null;
            return ['key' => $key, 'name' => $name, 'kind' => $kind, 'line' => $linea($d['start']), 'endLine' => $linea($d['end'] - 1),
                'start' => $d['start'], 'end' => $d['end'], 'doc' => $doc === null ? null : substr($code, $doc[0], $doc[1] - $doc[0]), 'norm' => $norm];
        };
        $out = [];
        foreach (JavaLexer::types($code) as $t) {
            if ($cont !== null && $t['name'] === $cont['name'] && $t['start'] === $cont['start']) {
                foreach ($t['methods'] as $m) {
                    $key = 'function:' . strtolower($m['name']);
                    if ($m['static'] && $m['name'] !== 'main' && !isset($out[$key])) {
                        $out[$key] = $mk($key, $m['name'], 'function', $m);
                    }
                }
                continue;
            }
            $key = 'type:' . strtolower($t['name']);
            if (!isset($out[$key])) {
                $out[$key] = $mk($key, $t['name'], 'type', $t);
            }
        }
        return $out;
    }

    /** Un método auxiliar va dentro de la clase con main (tras su «{»); un tipo auxiliar, al final del archivo. */
    public function insertionPoint(string $code, array $decl): int
    {
        if (($decl['kind'] ?? '') === 'type') {
            return strlen($code);
        }
        $cont = JavaLexer::container($code);
        return $cont === null ? strlen($code) : $cont['open'] + 1;
    }
}
