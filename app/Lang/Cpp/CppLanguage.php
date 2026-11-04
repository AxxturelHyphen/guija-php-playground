<?php
declare(strict_types=1);

namespace Playground\Lang\Cpp;

use Playground\Core\Explains;
use Playground\Core\Language;
use Playground\Core\Process;
use Playground\Core\Protocol;
use Playground\Lang\Cpp\Analysis\CppAnalysis;

defined('PG_ROOT') or exit;

/**
 * C++20: una lección es UN archivo con `int main()`. Se compila con g++ (o clang++, o lo que diga PG_CXX) contra el
 * harness `motor/pg.hpp`, que se incluye solo (-include, precompilado) sin añadir líneas: las de los errores son las del
 * editor. El main del usuario se renombra con una etiqueta de ensamblador (motor/pg_main0.hpp o pg_main2.hpp) y
 * `motor/pg_main.cpp` (compilado una vez por modo) pone el main de verdad: hilo con 256 MB de pila, vigía, señales…
 *
 * Modos de compilación:
 *  - checked (Ejecutar): -O1 con AddressSanitizer + UBSan (o, si no hay sanitizers, -D_GLIBCXX_ASSERTIONS).
 *  - fast (Medir/Comparar, opts.bench): -O2 sin instrumentar, para que las mediciones sean de verdad.
 *  - lint (análisis mientras se escribe): -fsyntax-only.
 *
 * Todo lo caro se cachea en var/: el compilador y lo que sabe hacer (var/cpp.json), las cabeceras precompiladas
 * (var/cpp/pch/<firma>-<modo>/), pg_main.o (var/cpp/obj/<firma>-<modo>/), los ejecutables (var/cpp/bin/, los ~40 últimos)
 * y los diagnósticos del análisis (var/cpp/lint/).
 *
 * Después de ejecutar, los informes de ASan/UBSan/LeakSanitizer (que van a archivos de registro, no a la salida) se
 * convierten en eventos `err` (kind 'asan' / 'ubsan' / 'leak' / 'memory') y las direcciones que manda el harness (`pcs`)
 * se traducen a líneas del usuario con addr2line.
 */
final class CppLanguage extends Language
{
    private const CACHE_SEGUNDOS = 600;
    /** Nombre del archivo del usuario al compilar: en errores, trazas e informes se cambia por el que ve el usuario. */
    private const FUENTE = 'pg_fuente.cpp';
    private const MAX_BINARIOS = 40;
    private const MAX_LINT = 200;
    private const MODOS = ['checked', 'fast', 'lint'];

    /** @var ?array<string,mixed> */
    private ?array $info = null;
    /** @var array<string, ?list<array<string,mixed>>> errores de compilación por md5 del código (syntaxError) */
    private array $memoErrores = [];
    /** Cómo se hizo la última compilación ('cache' | 'compilado'), para los tests. */
    public string $ultimaVia = '';

    public function id(): string
    {
        return 'cpp';
    }

    public function name(): string
    {
        return 'C++';
    }

    public function ext(): string
    {
        return 'cpp';
    }

    // ───────────────────────────── compilador ─────────────────────────────

    private static function dirCpp(): string
    {
        return PG_VAR . DIRECTORY_SEPARATOR . 'cpp';
    }

    private static function motor(string $f = ''): string
    {
        return __DIR__ . DIRECTORY_SEPARATOR . 'motor' . ($f === '' ? '' : DIRECTORY_SEPARATOR . $f);
    }

    private static function windows(): bool
    {
        return DIRECTORY_SEPARATOR === '\\';
    }

    /** @return list<string> compiladores candidatos, en orden: PG_CXX, g++, clang++ */
    private static function candidatos(): array
    {
        $c = [];
        $pg = trim((string) getenv('PG_CXX'));
        if ($pg !== '') {
            $c[] = Process::which($pg) ?? $pg;
        }
        foreach (['g++', 'clang++'] as $n) {
            if (($p = Process::which($n)) !== null) {
                $c[] = $p;
            }
        }
        return array_values(array_unique($c));
    }

    /**
     * El compilador y lo que sabe hacer. `--version` se repasa cada 10 min (var/cpp.json); las pruebas caras (C++20,
     * sanitizers, LeakSanitizer) se guardan por compilador y versión y no se repiten mientras no cambie.
     * @return array{cxx:?string, familia:string, version:?string, completa:string, ok:bool, cxx20:bool, san:bool, lsan:bool, firma:string, addr2line:?string}
     */
    private function compilador(): array
    {
        if ($this->info !== null) {
            return $this->info;
        }
        $clave = (string) getenv('PG_CXX') . '|' . md5((string) getenv('PATH'));
        $archivo = PG_VAR . '/cpp.json';
        $c = is_file($archivo) ? json_decode((string) @file_get_contents($archivo), true) : null;
        if (is_array($c) && ($c['clave'] ?? null) === $clave && time() - (int) ($c['t'] ?? 0) < self::CACHE_SEGUNDOS
            && ($c['cxx'] === null || is_file((string) $c['cxx']))) {
            return $this->info = $c;
        }
        $previas = is_array($c) ? ($c['capacidades'] ?? []) : [];
        $mejor = null;
        foreach (self::candidatos() as $cxx) {
            $r = Process::run([$cxx, '--version'], ['timeout' => 20, 'grace' => 5]);
            $primera = trim(strtok($r['raw'], "\n") ?: '');
            if ($r['exit'] !== 0 || $primera === '') {
                continue;
            }
            $familia = stripos($r['raw'], 'clang') !== false ? 'clang' : 'gcc';
            $version = preg_match('/(\d+\.\d+(?:\.\d+)?)/', $familia === 'clang' ? (string) preg_replace('/^.*?clang version/i', '', $primera) : (string) preg_replace('/\([^)]*\)/', '', $primera), $m)
                ? $m[1] : null;
            $firma = substr(md5($cxx . '|' . $primera . '|' . (string) @filemtime($cxx)), 0, 12);
            $cap = $previas[$firma] ?? null;
            if (!is_array($cap)) {
                $cap = $this->probarCapacidades($cxx, $familia);
                $previas[$firma] = $cap;
            }
            $v = ['cxx' => $cxx, 'familia' => $familia, 'version' => $version, 'completa' => $primera, 'firma' => $firma] + $cap;
            $v['ok'] = $v['cxx20'];
            if ($v['ok']) {
                $mejor = $v;
                break;
            }
            $mejor ??= $v;
        }
        $mejor ??= ['cxx' => null, 'familia' => 'gcc', 'version' => null, 'completa' => '', 'firma' => '', 'ok' => false, 'cxx20' => false, 'san' => false,
            'lsan' => false];
        $mejor['addr2line'] = Process::which('addr2line') ?? Process::which('llvm-addr2line');
        $mejor += ['clave' => $clave, 't' => time(), 'capacidades' => array_slice($previas, -6, null, true)];
        if (!is_dir(PG_VAR)) {
            @mkdir(PG_VAR, 0777, true);
        }
        @file_put_contents($archivo, json_encode($mejor), LOCK_EX);
        return $this->info = $mejor;
    }

    /**
     * Compila y ejecuta tres programas mínimos: ¿C++20 (<source_location>)? ¿AddressSanitizer + UBSan? ¿LeakSanitizer
     * (necesita ptrace: en algunos contenedores no funciona)?
     * @return array{cxx20:bool, san:bool, lsan:bool}
     */
    private function probarCapacidades(string $cxx, string $familia): array
    {
        $dir = Process::makeTempDir('pgcpp_');
        try {
            $exe = static fn(string $n): string => $dir . DIRECTORY_SEPARATOR . $n . (self::windows() ? '.exe' : '');
            file_put_contents($dir . '/c20.cpp', "#include <source_location>\n#include <vector>\nint main() { std::vector<int> v{1}; return std::source_location::current().line() > 0 ? v[0] - 1 : 1; }\n");
            $r = Process::run([$cxx, '-std=c++20', 'c20.cpp', '-o', $exe('c20')], ['timeout' => 60, 'grace' => 5, 'cwd' => $dir]);
            $cxx20 = $r['exit'] === 0 && Process::run([$exe('c20')], ['timeout' => 10, 'cwd' => $dir])['exit'] === 0;
            $san = false;
            $lsan = false;
            if ($cxx20 && !self::windows()) {
                file_put_contents($dir . '/san.cpp', "#include <vector>\n#include <cstdio>\nint* volatile p;\nint main() { std::vector<int> v(3); p = new int[4]; p = nullptr; std::printf(\"ok%d\\n\", v[1]); return 0; }\n");
                $r = Process::run([$cxx, '-std=c++20', '-g', '-fsanitize=address,undefined', 'san.cpp', '-o', $exe('san')], ['timeout' => 60, 'grace' => 5, 'cwd' => $dir]);
                if ($r['exit'] === 0) {
                    $sin = Process::run([$exe('san')], ['timeout' => 10, 'cwd' => $dir, 'env' => ['ASAN_OPTIONS' => 'detect_leaks=0']]);
                    $san = $sin['exit'] === 0 && str_contains($sin['raw'], 'ok0');
                    if ($san) {
                        $con = Process::run([$exe('san')], ['timeout' => 20, 'cwd' => $dir, 'env' => ['ASAN_OPTIONS' => 'detect_leaks=1']]);
                        $lsan = str_contains($con['raw'], 'detected memory leaks') && !str_contains($con['raw'], 'fatal error');
                    }
                }
            }
            return ['cxx20' => $cxx20, 'san' => $san, 'lsan' => $lsan];
        } finally {
            Process::rmTree($dir);
        }
    }

    public function meta(): array
    {
        $c = $this->compilador();
        $missing = [];
        $notes = [];
        if (!$c['ok']) {
            $como = match (true) {
                self::windows() => 'Instala MinGW-w64 con g++ 12 o superior: el paquete de WinLibs (https://winlibs.com, «UCRT runtime», descomprímelo p. ej. en C:\\mingw64) '
                    . 'o MSYS2 (https://www.msys2.org y luego «pacman -S mingw-w64-ucrt-x86_64-gcc»). Añade su carpeta bin (C:\\mingw64\\bin o C:\\msys64\\ucrt64\\bin) al PATH '
                    . 'y vuelve a abrir arrancar.bat. Si ya tienes otro compilador, apúntalo con la variable PG_CXX.',
                PHP_OS_FAMILY === 'Darwin' => 'Instala las herramientas de línea de comandos de Xcode: «xcode-select --install» (trae clang++ con C++20). '
                    . 'O un g++ reciente con Homebrew («brew install gcc») y apúntalo con PG_CXX=g++-14.',
                default => 'Instala g++ 12 o superior: «sudo apt install g++» (Debian/Ubuntu), «sudo dnf install gcc-c++» (Fedora) o «sudo pacman -S gcc» (Arch). '
                    . 'Después vuelve a abrir arrancar.sh. Si tienes otro compilador, apúntalo con la variable PG_CXX.',
            };
            $what = $c['cxx'] === null ? 'Un compilador de C++20 (g++ o clang++)'
                : 'Un compilador con C++20 (' . basename((string) $c['cxx']) . ($c['version'] ? ' ' . $c['version'] : '') . ' no compila C++20 con <source_location>)';
            $missing[] = ['what' => $what, 'how' => $como];
        } else {
            if (!$c['san']) {
                $notes[] = 'Sin AddressSanitizer/UBSan en este compilador: los accesos fuera de rango de vector se detectan (comprobaciones de la biblioteca), '
                    . 'pero no los de arrays C, los punteros colgantes ni el desbordamiento de enteros.';
            } elseif (!$c['lsan']) {
                $notes[] = 'LeakSanitizer no funciona aquí (necesita ptrace): no se avisará de la memoria que no liberas.';
            }
            if ($c['addr2line'] === null) {
                $notes[] = 'Sin addr2line: algunos errores (excepciones, segfaults) no dirán la línea exacta.';
            }
        }
        return ['version' => $c['version'] !== null ? $c['version'] . ' (' . ($c['familia'] === 'clang' ? 'clang++' : 'g++') . ')' : null, 'ok' => $missing === [],
            'missing' => $missing, 'notes' => $notes];
    }

    /** Catálogo del editor (data/catalogo.json), cacheado en memoria y en var/cpp-catalog.json. */
    public function catalog(): array
    {
        static $memo = null;
        if ($memo !== null) {
            return $memo;
        }
        $fuente = __DIR__ . '/data/catalogo.json';
        $cache = PG_VAR . '/cpp-catalog.json';
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

    // ───────────────────────────── flags y harness precompilado ─────────────────────────────

    /** @return list<string> */
    private function flags(string $modo): array
    {
        $c = $this->compilador();
        $gcc = $c['familia'] === 'gcc';
        $f = ['-std=c++20', '-Wall', '-Wextra', '-Wshadow', '-Wno-unused-parameter', '-Werror=return-type', '-fdiagnostics-parseable-fixits', '-fmessage-length=0'];
        array_push($f, ...($gcc
            ? ['-fdiagnostics-color=never', '-fdiagnostics-column-unit=byte', '-fno-diagnostics-show-caret', '-fno-diagnostics-show-line-numbers', '-fno-diagnostics-show-labels']
            : ['-fno-color-diagnostics', '-fno-caret-diagnostics']));
        if ($modo === 'checked') {
            array_push($f, ...($c['san']
                ? ['-O1', '-g1', '-fsanitize=address,undefined', '-fno-sanitize-recover=undefined', '-fno-omit-frame-pointer']
                : ['-O1', '-g1', '-fno-omit-frame-pointer', '-D_GLIBCXX_ASSERTIONS']));
        } elseif ($modo === 'fast') {
            array_push($f, '-O2', '-g1');
        }
        return $f;
    }

    /** @return list<string> */
    private function flagsEnlace(string $modo): array
    {
        $f = [];
        if ($modo === 'checked' && $this->compilador()['san']) {
            $f[] = '-fsanitize=address,undefined';
        }
        if (self::windows()) {
            $f[] = '-Wl,--stack,268435456';
            $f[] = '-static-libgcc';
        } else {
            $f[] = '-pthread';
            if (PHP_OS_FAMILY === 'Linux') {
                $f[] = '-ldl';
            }
        }
        return $f;
    }

    /** Firma del harness para un modo: compilador + flags + fuentes del motor. */
    private function firmaHarness(string $modo): string
    {
        static $memo = [];
        $c = $this->compilador();
        $k = $c['firma'] . $modo;
        if (isset($memo[$k])) {
            return $memo[$k];
        }
        $txt = $c['firma'] . '|' . implode(' ', $this->flags($modo)) . '|' . implode(' ', $this->flagsEnlace($modo));
        foreach (['pg.hpp', 'pg_main.cpp', 'pg_main0.hpp', 'pg_main2.hpp'] as $f) {
            $txt .= '|' . md5((string) @file_get_contents(self::motor($f)));
        }
        if ($c['familia'] === 'clang') {
            $txt .= '|' . (string) @filemtime(self::motor('pg.hpp'));    // clang comprueba la fecha de la cabecera del PCH
        }
        return $memo[$k] = substr(md5($txt), 0, 12);
    }

    /**
     * Cabecera precompilada y pg_main.o para un modo (var/cpp/pch, var/cpp/obj), compilados si no están o si cambió algo.
     * Un cerrojo evita que dos peticiones compilen a la vez; se escribe en una carpeta temporal y se renombra.
     * @return ?array{include:list<string>, obj:?string}
     */
    private function preparar(string $modo): ?array
    {
        static $listo = [];
        $c = $this->compilador();
        if (!$c['ok']) {
            return null;
        }
        $firma = $this->firmaHarness($modo);
        if (isset($listo[$firma])) {
            return $listo[$firma];
        }
        $nombre = $c['firma'] . '-' . $modo;
        $dirPch = self::dirCpp() . DIRECTORY_SEPARATOR . 'pch' . DIRECTORY_SEPARATOR . $nombre;
        $dirObj = self::dirCpp() . DIRECTORY_SEPARATOR . 'obj' . DIRECTORY_SEPARATOR . $nombre;
        $obj = $dirObj . DIRECTORY_SEPARATOR . 'pg_main.o';
        $leer = static function (string $dir) use ($firma): ?array {
            $j = json_decode((string) @file_get_contents($dir . DIRECTORY_SEPARATOR . '.firma'), true);
            return is_array($j) && ($j['firma'] ?? '') === $firma ? $j : null;
        };
        $alDia = fn(): bool => $leer($dirPch) !== null && ($modo === 'lint' || ($leer($dirObj) !== null && is_file($obj)));
        if (!$alDia()) {
            if (!is_dir(self::dirCpp())) {
                @mkdir(self::dirCpp(), 0777, true);
            }
            $lock = @fopen(self::dirCpp() . DIRECTORY_SEPARATOR . 'preparar.lock', 'c');
            if ($lock === false || !flock($lock, LOCK_EX)) {
                return null;
            }
            try {
                if (!$alDia()) {
                    if ($leer($dirPch) === null && !$this->construirPch($modo, $dirPch, $firma)) {
                        return $listo[$firma] = null;
                    }
                    if ($modo !== 'lint' && ($leer($dirObj) === null || !is_file($obj)) && !$this->construirObj($modo, $dirObj, $firma)) {
                        return $listo[$firma] = null;
                    }
                }
            } finally {
                flock($lock, LOCK_UN);
                fclose($lock);
            }
        }
        $info = $leer($dirPch) ?? [];
        $include = match ($info['via'] ?? 'texto') {
            'gch' => ['-include', $dirPch . DIRECTORY_SEPARATOR . 'pg.hpp'],
            'pch' => ['-include-pch', $dirPch . DIRECTORY_SEPARATOR . 'pg.hpp.pch'],
            default => ['-include', self::motor('pg.hpp')],
        };
        return $listo[$firma] = ['include' => $include, 'obj' => $modo === 'lint' ? null : $obj];
    }

    /** Precompila pg.hpp. Si el compilador no lo acepta, se recuerda y se usa la cabecera de texto (más lento, pero va). */
    private function construirPch(string $modo, string $destino, string $firma): bool
    {
        $c = $this->compilador();
        $tmp = $destino . '.tmp' . bin2hex(random_bytes(3));
        @mkdir($tmp, 0777, true);
        $flags = $this->flags($modo);
        $via = 'texto';
        if (getenv('PG_CXX_PCH') !== '0') {
            if ($c['familia'] === 'gcc') {
                copy(self::motor('pg.hpp'), $tmp . '/pg.hpp');
                $r = Process::run([$c['cxx'], ...$flags, '-x', 'c++-header', 'pg.hpp', '-o', 'pg.hpp.gch'], ['timeout' => 120, 'grace' => 10, 'cwd' => $tmp]);
                if ($r['exit'] === 0 && is_file($tmp . '/pg.hpp.gch')) {
                    // ¿La acepta de verdad? (-Winvalid-pch avisa si la ignora)
                    file_put_contents($tmp . '/prueba.cpp', "int main() { return pg::numeros(1).size() == 1 ? 0 : 1; }\n");
                    $p = Process::run([$c['cxx'], ...array_values(array_diff($flags, ['-fsyntax-only'])), '-Winvalid-pch', '-fsyntax-only', '-include', $tmp . '/pg.hpp', 'prueba.cpp'],
                        ['timeout' => 60, 'grace' => 5, 'cwd' => $tmp]);
                    $via = $p['exit'] === 0 && !preg_match('/invalid-pch|not using|precompiled header/i', $p['raw']) ? 'gch' : 'texto';
                    @unlink($tmp . '/prueba.cpp');
                }
            } else {
                $r = Process::run([$c['cxx'], ...$flags, '-x', 'c++-header', self::motor('pg.hpp'), '-o', $tmp . '/pg.hpp.pch'], ['timeout' => 120, 'grace' => 10, 'cwd' => $tmp]);
                $via = $r['exit'] === 0 && is_file($tmp . '/pg.hpp.pch') ? 'pch' : 'texto';
            }
        }
        if ($via === 'texto') {
            @unlink($tmp . '/pg.hpp.gch');
            @unlink($tmp . '/pg.hpp.pch');
        }
        file_put_contents($tmp . '/.firma', json_encode(['firma' => $firma, 'via' => $via]));
        // La cabecera de clang guarda su propia ruta: se compila ya en su sitio definitivo
        if ($via === 'pch') {
            Process::rmTree($destino);
            if (!@rename($tmp, $destino)) {
                Process::rmTree($tmp);
                return false;
            }
            $r = Process::run([$c['cxx'], ...$flags, '-x', 'c++-header', self::motor('pg.hpp'), '-o', $destino . '/pg.hpp.pch'], ['timeout' => 120, 'grace' => 10, 'cwd' => $destino]);
            if ($r['exit'] !== 0) {
                file_put_contents($destino . '/.firma', json_encode(['firma' => $firma, 'via' => 'texto']));
            }
            return true;
        }
        Process::rmTree($destino);
        if (!@rename($tmp, $destino)) {
            Process::rmTree($tmp);
            return false;
        }
        return true;
    }

    private function construirObj(string $modo, string $destino, string $firma): bool
    {
        $c = $this->compilador();
        $tmp = $destino . '.tmp' . bin2hex(random_bytes(3));
        @mkdir($tmp, 0777, true);
        $r = Process::run([$c['cxx'], ...$this->flags($modo), '-c', self::motor('pg_main.cpp'), '-o', $tmp . DIRECTORY_SEPARATOR . 'pg_main.o'],
            ['timeout' => 180, 'grace' => 10, 'cwd' => $tmp]);
        if ($r['exit'] !== 0 || !is_file($tmp . DIRECTORY_SEPARATOR . 'pg_main.o')) {
            Process::rmTree($tmp);
            return false;
        }
        file_put_contents($tmp . '/.firma', json_encode(['firma' => $firma]));
        Process::rmTree($destino);
        return @rename($tmp, $destino);
    }

    // ───────────────────────────── compilación ─────────────────────────────

    /** El código sin comentarios (las cadenas se conservan), para las comprobaciones con expresiones regulares. */
    private static function sinComentarios(string $code): string
    {
        return (string) preg_replace_callback('~"(?:\\\\.|[^"\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\n])*\'|//[^\n]*|/\*.*?\*/~s',
            static fn($m) => $m[0][0] === '/' ? preg_replace('/[^\n]/', ' ', $m[0]) : $m[0], $code);
    }

    private static function tieneMain(string $code): bool
    {
        if (class_exists(CppAnalysis::class)) {
            return CppAnalysis::hasMain($code);
        }
        return (bool) preg_match('/\bint\s+main\s*\(/', self::sinComentarios($code));
    }

    /** pg_main2.hpp si el main del usuario recibe (argc, argv); si no, pg_main0.hpp. */
    private static function declaracionMain(string $code): string
    {
        return self::motor(preg_match('/\bint\s+main\s*\(\s*int\b/', self::sinComentarios($code)) ? 'pg_main2.hpp' : 'pg_main0.hpp');
    }

    /** Línea de `int main(` (para los errores sin línea). */
    private static function lineaMain(string $code): int
    {
        if (preg_match('/\bint\s+main\s*\(/', self::sinComentarios($code), $m, PREG_OFFSET_CAPTURE)) {
            return substr_count($code, "\n", 0, (int) $m[0][1]) + 1;
        }
        return 1;
    }

    private static function dirBin(): string
    {
        return self::dirCpp() . DIRECTORY_SEPARATOR . 'bin';
    }

    private function rutaBinario(string $code, string $modo): string
    {
        $c = $this->compilador();
        return self::dirBin() . DIRECTORY_SEPARATOR . md5($code . "\0" . $modo . "\0" . $c['firma'] . "\0" . $this->firmaHarness($modo)) . (self::windows() ? '.exe' : '');
    }

    /** Deja los MAX_BINARIOS ejecutables usados más recientemente. */
    private static function recortarBinarios(): void
    {
        $fs = glob(self::dirBin() . DIRECTORY_SEPARATOR . '*') ?: [];
        if (count($fs) <= self::MAX_BINARIOS) {
            return;
        }
        $t = [];
        foreach ($fs as $f) {
            $t[$f] = (int) @filemtime($f);
        }
        arsort($t);
        foreach (array_slice(array_keys($t), self::MAX_BINARIOS) as $f) {
            @unlink($f);
        }
    }

    /**
     * Compila $code. Modo checked/fast: compila y enlaza en $bin (si no hay errores). lint: solo diagnósticos.
     * @return ?array{ok:bool, diags:list<array<string,mixed>>} null si no hay compilador o no se pudo preparar el harness
     */
    private function compilar(string $code, string $modo, ?string $bin = null, int $timeout = 90): ?array
    {
        $p = $this->preparar($modo);
        if ($p === null) {
            return null;
        }
        $c = $this->compilador();
        $dir = Process::makeTempDir('pgcpp_');
        try {
            file_put_contents($dir . DIRECTORY_SEPARATOR . self::FUENTE, $code);
            $cmd = [$c['cxx'], ...$this->flags($modo), ...$p['include'], '-include', self::declaracionMain($code), '-ffile-prefix-map=' . $dir . DIRECTORY_SEPARATOR . '=',
                '-ffile-prefix-map=' . $dir . '=.'];
            if ($modo === 'lint') {
                $cmd[] = '-fsyntax-only';
                $cmd[] = self::FUENTE;
            } else {
                $salida = 'programa' . (self::windows() ? '.exe' : '');
                array_push($cmd, self::FUENTE, (string) $p['obj'], '-o', $salida, ...$this->flagsEnlace($modo));
            }
            $r = Process::run($cmd, ['timeout' => $timeout, 'grace' => $modo === 'lint' ? 0 : 10, 'cwd' => $dir]);
            if ($r['killed'] === 'timeout') {
                return ['ok' => false, 'diags' => [], 'timeout' => true];
            }
            $diags = self::diagnosticos($r['raw'], $code);
            $errores = array_filter($diags, static fn($d) => $d['kind'] === 'error');
            $ok = $r['exit'] === 0 && $errores === [];
            if (!$ok && $errores === []) {
                // Falló sin un error reconocible (el enlazador, un flag…): se cuenta tal cual
                $diags[] = ['kind' => 'error', 'code' => 'compilador', 'msg' => trim(mb_substr(str_replace($dir . DIRECTORY_SEPARATOR, '', $r['raw']), 0, 600)) ?: 'El compilador falló',
                    'line' => 1, 'col' => 1, 'endLine' => 1, 'endCol' => 2, 'fixits' => [], 'notes' => []];
            }
            if ($ok && $bin !== null && $modo !== 'lint') {
                if (!is_dir(self::dirBin())) {
                    @mkdir(self::dirBin(), 0777, true);
                }
                $tmpBin = $bin . '.tmp' . bin2hex(random_bytes(3));
                if (!@rename($dir . DIRECTORY_SEPARATOR . $salida, $tmpBin) || !@rename($tmpBin, $bin)) {
                    @unlink($tmpBin);
                    $ok = is_file($bin);
                }
                self::recortarBinarios();
            }
            return ['ok' => $ok, 'diags' => $diags];
        } finally {
            Process::rmTree($dir);
        }
    }

    // ───────────────────────────── diagnósticos de gcc / clang ─────────────────────────────

    /** Columna en bytes (1-based) → columna UTF-16 (1-based, la de Monaco). */
    private static function col16(string $linea, int $colBytes): int
    {
        $pre = substr($linea, 0, max(0, $colBytes - 1));
        if (!mb_check_encoding($pre, 'UTF-8')) {
            $pre = mb_convert_encoding($pre, 'UTF-8', 'UTF-8');
        }
        return (int) (strlen((string) mb_convert_encoding($pre, 'UTF-16LE', 'UTF-8')) / 2) + 1;
    }

    /** Fin (UTF-16) de la palabra o del signo que empieza en esa columna de bytes. */
    private static function finToken(string $linea, int $colBytes): int
    {
        $i = max(0, $colBytes - 1);
        $resto = substr($linea, $i);
        if (preg_match('/^(?:[\p{L}\p{N}_]+|::|->|<<=|>>=|<=>|[-+*\/%&|^!=<>]=|&&|\|\||<<|>>|\+\+|--|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|.)/u', $resto, $m)) {
            return self::col16($linea, $colBytes + strlen($m[0]));
        }
        return self::col16($linea, $colBytes) + 1;
    }

    /** Código estable a partir del texto (sin lo citado): 'gcc.not-declared', 'clang.undeclared-identifier'… */
    private static function codigo(string $msg, string $familia): string
    {
        static $conocidos = [
            '/was not declared in this scope|use of undeclared identifier/' => 'not-declared',
            '/expected .* before|expected \'.\'|expected .*;|expected expression|expected unqualified-id|expected primary-expression/' => 'expected-token',
            '/no matching function for call|no matching member function|no matching constructor/' => 'no-matching-function',
            '/cannot convert|no viable conversion|invalid conversion|cannot initialize/' => 'cannot-convert',
            '/has no member named|no member named/' => 'no-member',
            '/redeclar|redefinition of|conflicting declaration/' => 'redeclared',
            '/no return statement|non-void function does not return|control reaches end of non-void/' => 'missing-return',
            '/no match for .operator|invalid operands to binary expression/' => 'no-operator',
            '/static assertion failed|static_assert failed/' => 'static-assert',
            '/is private within this context|is a private member/' => 'private',
            '/does not name a type|unknown type name/' => 'not-a-type',
            '/too few arguments|too many arguments/' => 'arguments',
            '/No such file or directory|file not found/' => 'include-not-found',
            '/undefined reference|undefined symbol/' => 'undefined-reference',
            '/assignment of read-only|cannot assign to variable .* with const|read-only/' => 'read-only',
            '/use of deleted function|call to deleted|deleted function/' => 'deleted-function',
            '/abstract/' => 'abstract',
            '/ambiguous/' => 'ambiguous',
        ];
        foreach ($conocidos as $re => $slug) {
            if (preg_match($re, $msg)) {
                return $familia . '.' . $slug;
            }
        }
        $s = strtolower((string) preg_replace(['/[\'‘’"`«][^\'‘’"`»]*[\'‘’"`»]/u', '/\[-W[^\]]*\]/', '/[^a-z ]+/i'], ' ', $msg));
        $palabras = array_slice(array_values(array_filter(explode(' ', $s), static fn($w) => $w !== '')), 0, 6);
        return $familia . '.' . (implode('-', $palabras) ?: 'error');
    }

    /**
     * Convierte la salida de gcc/clang en diagnósticos del archivo del usuario.
     *  - Los errores dentro de cabeceras (plantillas de la biblioteca, el harness) se anclan en la línea del usuario de
     *    su cadena «required from here» (gcc, antes del error) o «in instantiation … requested here» (clang, después).
     *  - Las notas del archivo del usuario se adjuntan al error anterior; los fix-its se convierten a columnas UTF-16.
     * @return list<array{kind:string, code:string, msg:string, line:int, col:int, endLine:int, endCol:int, fixits:list<array<string,mixed>>, notes:list<array<string,mixed>>, flag?:string}>
     */
    private static function diagnosticos(string $raw, string $code): array
    {
        $lineasCodigo = preg_split('/\r\n|\n|\r/', $code) ?: [];
        $familia = 'gcc';
        $esUsuario = static fn(string $f): bool => (bool) preg_match('~(?:^|[/\\\\])' . preg_quote(self::FUENTE, '~') . '$~', $f);
        $recs = [];
        // gcc escribe los identificadores no ASCII como \U000000f1 (ñ)
        $raw = (string) preg_replace_callback('/\\\\U([0-9a-fA-F]{8})|\\\\u([0-9a-fA-F]{4})/', static fn($m) => (string) mb_chr((int) hexdec($m[1] !== '' ? $m[1] : $m[2]), 'UTF-8'), $raw);
        foreach (preg_split('/\r\n|\n|\r/', $raw) ?: [] as $l) {
            if (preg_match('/^fix-it:"(.*?)":\{(\d+):(\d+)-(\d+):(\d+)\}:"(.*)"$/', $l, $m)) {
                $recs[] = ['t' => 'fixit', 'file' => $m[1], 'sl' => (int) $m[2], 'sc' => (int) $m[3], 'el' => (int) $m[4], 'ec' => (int) $m[5],
                    'text' => stripcslashes($m[6])];
            } elseif (preg_match('/^(.+?):(\d+):(\d+):\s+(error|warning|note|fatal error):\s?(.*)$/', $l, $m)) {
                if (str_contains($m[5], 'in instantiation of') || str_contains($m[5], 'requested here') || str_contains($m[5], 'in call to')) {
                    $familia = 'clang';
                }
                $recs[] = ['t' => $m[4] === 'fatal error' ? 'error' : $m[4], 'file' => $m[1], 'line' => (int) $m[2], 'col' => (int) $m[3], 'msg' => $m[5]];
            } elseif (preg_match('/^(.+?):(\d+):(\d+):\s+(required from .*|required by .*|in .*instantiat.*|  .*)$/', $l, $m)) {
                $recs[] = ['t' => 'contexto', 'file' => $m[1], 'line' => (int) $m[2], 'col' => (int) $m[3], 'msg' => trim($m[4])];
            } elseif (preg_match('/^(?:.+?): In (?:instantiation|substitution) of/', $l)) {
                $recs[] = ['t' => 'inicio'];
            } elseif (preg_match('/undefined reference to [`\'‘](.+?)[\'’]/u', $l, $m)) {
                $linea = preg_match('/' . preg_quote(self::FUENTE, '/') . ':(\d+):/', $l, $mm) ? (int) $mm[1] : 0;
                $recs[] = ['t' => 'enlace', 'msg' => "undefined reference to '{$m[1]}'", 'line' => $linea, 'code' => 'link.undefined'];
            } elseif (preg_match('/multiple definition of [`\'‘](.+?)[\'’]/u', $l, $m)) {
                $linea = preg_match('/' . preg_quote(self::FUENTE, '/') . ':(\d+):/', $l, $mm) ? (int) $mm[1] : 0;
                $recs[] = ['t' => 'enlace', 'msg' => "multiple definition of '{$m[1]}'", 'line' => $linea, 'code' => 'link.multiple'];
            } elseif (preg_match('/^(?:.*?:\s*)?error: (?:ld returned|linker command failed)/', $l)) {
                continue;
            }
        }
        $out = [];
        $contexto = null;          // último «required from» en el archivo del usuario (gcc)
        $actual = null;            // índice en $out del último error/aviso (para notas y fix-its)
        $vistos = [];
        $n = count($recs);
        $hazDiag = function (string $kind, string $msg, int $linea, int $colB) use ($lineasCodigo, $familia): array {
            $linea = max(1, min($linea, max(1, count($lineasCodigo))));
            $texto = $lineasCodigo[$linea - 1] ?? '';
            $colB = max(1, $colB);
            $col = self::col16($texto, $colB);
            $flag = preg_match('/\[(-W[^\]]+)\]\s*$/', $msg, $mf) ? $mf[1] : null;
            $limpio = trim((string) preg_replace('/\s*\[-W[^\]]+\]\s*$/', '', $msg));
            $d = ['kind' => $kind, 'code' => $flag !== null && $kind === 'warning' ? ltrim(str_replace('=', '-', preg_replace('/^-Werror=/', '-W', $flag) ?? $flag), '-') : self::codigo($limpio, $familia),
                'msg' => $limpio, 'line' => $linea, 'col' => $col, 'endLine' => $linea, 'endCol' => max($col + 1, self::finToken($texto, $colB)), 'fixits' => [], 'notes' => []];
            if ($flag !== null) {
                $d['flag'] = $flag;
            }
            return $d;
        };
        for ($i = 0; $i < $n; $i++) {
            $r = $recs[$i];
            switch ($r['t']) {
                case 'inicio':
                    $contexto = null;
                    break;
                case 'contexto':
                    if ($esUsuario($r['file'])) {
                        $contexto = $r;
                    }
                    break;
                case 'enlace':
                    $k = 'link|' . $r['msg'];
                    if (!isset($vistos[$k])) {
                        $vistos[$k] = true;
                        $d = $hazDiag('error', $r['msg'], $r['line'] > 0 ? $r['line'] : 0, 1);
                        $d['code'] = $r['code'];
                        $d['link'] = true;
                        if ($r['line'] <= 0) {
                            $d['line'] = $d['endLine'] = self::lineaMain($code);
                            $d['col'] = 1;
                            $d['endCol'] = 1000;
                        }
                        $out[] = $d;
                    }
                    $actual = null;
                    break;
                case 'fixit':
                    if ($actual !== null && $esUsuario($r['file'])) {
                        $ls = $lineasCodigo[$r['sl'] - 1] ?? '';
                        $le = $lineasCodigo[$r['el'] - 1] ?? '';
                        $out[$actual]['fixits'][] = ['sl' => $r['sl'], 'sc' => self::col16($ls, $r['sc']), 'el' => $r['el'], 'ec' => self::col16($le, $r['ec']), 'text' => $r['text']];
                    }
                    break;
                case 'note':
                    if ($actual !== null && $esUsuario($r['file']) && !str_contains($r['msg'], 'in instantiation of') && !str_contains($r['msg'], 'requested here')) {
                        $texto = $lineasCodigo[$r['line'] - 1] ?? '';
                        $out[$actual]['notes'][] = ['line' => $r['line'], 'col' => self::col16($texto, $r['col']), 'msg' => $r['msg']];
                    }
                    break;
                case 'error':
                case 'warning':
                    $linea = $r['line'];
                    $col = $r['col'];
                    if (!$esUsuario($r['file'])) {
                        // Dentro de una cabecera: se ancla en la llamada del usuario que lo provocó
                        $ancla = $contexto;
                        if ($ancla === null) {
                            for ($j = $i + 1; $j < $n && in_array($recs[$j]['t'], ['note', 'contexto', 'fixit'], true); $j++) {
                                if (in_array($recs[$j]['t'], ['note', 'contexto'], true) && $esUsuario($recs[$j]['file'])) {
                                    $ancla = $recs[$j];
                                    break;
                                }
                            }
                        }
                        if ($ancla === null) {
                            if ($r['t'] === 'warning') {
                                $actual = null;
                                break;     // avisos de las cabeceras sin relación con el código del usuario
                            }
                            $linea = 1;
                            $col = 1;
                        } else {
                            $linea = $ancla['line'];
                            $col = $ancla['col'];
                        }
                    }
                    $contexto = null;
                    $k = $r['t'] . '|' . $linea . '|' . $col . '|' . ($esUsuario($r['file']) ? $r['msg'] : 'cabecera');
                    if (isset($vistos[$k])) {
                        $actual = null;    // el mismo error de plantilla repetido desde el mismo sitio
                        break;
                    }
                    $vistos[$k] = true;
                    $d = $hazDiag($r['t'], $r['msg'], $linea, $col);
                    if (!$esUsuario($r['file'])) {
                        $d['inHeader'] = true;
                    }
                    $out[] = $d;
                    $actual = count($out) - 1;
                    break;
            }
        }
        // Avisos que en realidad no son del usuario: la variable `n` de los generadores de medir() tapa otra `n`
        return array_values(array_filter($out, static function ($d) use ($lineasCodigo) {
            if ($d['kind'] === 'warning' && ($d['flag'] ?? '') === '-Wshadow' && str_contains($d['msg'], "'n'")) {
                return !preg_match('/\bmedir\s*\(/', $lineasCodigo[$d['line'] - 1] ?? '');
            }
            return true;
        }));
    }

    /** Evento `err` para un diagnóstico del compilador. */
    private static function evento(array $d): array
    {
        $ev = ['t' => 'err', 'kind' => 'parse', 'cls' => 'CompileError', 'code' => (string) $d['code'], 'msg' => (string) $d['msg'],
            'line' => $d['line'], 'col' => $d['col'], 'endLine' => $d['endLine'], 'endCol' => $d['endCol']];
        if ($d['kind'] === 'warning') {
            $ev['severity'] = 'warning';
        }
        if ($d['fixits'] !== []) {
            $ev['fixits'] = $d['fixits'];
        }
        if ($d['notes'] !== []) {
            $ev['notes'] = $d['notes'];
        }
        if (isset($d['flag'])) {
            $ev['flag'] = $d['flag'];
        }
        return $ev;
    }

    // ───────────────────────────── sintaxis y análisis ─────────────────────────────

    /**
     * Errores de compilación (sin ejecutar). Si compila, el ejecutable queda en var/cpp/bin y run() lo reutiliza
     * (Ctrl+Enter = syntaxError + run compila una sola vez).
     * @return ?list<array<string,mixed>> null si no hay compilador
     */
    private function errores(string $code): ?array
    {
        $k = md5($code);
        if (array_key_exists($k, $this->memoErrores)) {
            return $this->memoErrores[$k];
        }
        if (!$this->compilador()['ok']) {
            return null;
        }
        if (!self::tieneMain($code)) {
            $r = $this->compilar($code, 'lint');
        } else {
            $bin = $this->rutaBinario($code, 'checked');
            if (is_file($bin)) {
                return $this->memoErrores[$k] = [];
            }
            $r = $this->compilar($code, 'checked', $bin);
        }
        $errs = $r === null ? null : array_values(array_filter($r['diags'], static fn($d) => $d['kind'] === 'error'));
        return $this->memoErrores[$k] = $errs;
    }

    public function syntaxError(string $code): ?array
    {
        $e = $this->errores($code);
        return $e === null || $e === [] ? null : self::evento($e[0]);
    }

    /**
     * Diagnósticos de gcc/clang para el análisis mientras se escribe: -fsyntax-only con el PCH de lint (unos cientos de ms),
     * cacheados por código en var/cpp/lint/. null = no hay compilador o no contestó a tiempo.
     * @return ?list<array<string,mixed>>
     */
    private function diagnosticosLint(string $code, int $limiteS = 2): ?array
    {
        $c = $this->compilador();
        if (!$c['ok']) {
            return null;
        }
        $dir = self::dirCpp() . DIRECTORY_SEPARATOR . 'lint';
        $archivo = $dir . DIRECTORY_SEPARATOR . md5($code . "\0" . $this->firmaHarness('lint')) . '.json';
        if (is_file($archivo)) {
            $j = json_decode((string) @file_get_contents($archivo), true);
            if (is_array($j)) {
                @touch($archivo);
                return $j;
            }
        }
        $r = $this->compilar($code, 'lint', null, $limiteS);
        if ($r === null || !empty($r['timeout'])) {
            return null;
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        @file_put_contents($archivo, json_encode($r['diags'], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE), LOCK_EX);
        $fs = glob($dir . DIRECTORY_SEPARATOR . '*.json') ?: [];
        if (count($fs) > self::MAX_LINT) {
            usort($fs, static fn($a, $b) => (int) @filemtime($a) <=> (int) @filemtime($b));
            foreach (array_slice($fs, 0, count($fs) - self::MAX_LINT) as $f) {
                @unlink($f);
            }
        }
        return $r['diags'];
    }

    /** Un archivo de soluciones usa tipos de su lección y solo compila empalmado: sin errores del compilador al leerlo. */
    private static function esSoluciones(string $code): bool
    {
        return (bool) preg_match('/^\s*(?:struct|class)\s+Soluciones\b/m', $code) || (bool) preg_match('~\A\s*(?://|/\*)\s*SOLUCIONES\b~', $code);
    }

    /**
     * Análisis estático en PHP (CppAnalysis: métricas, O() y pistas, sin compilador) + errores y avisos del compilador
     * (-fsyntax-only), explicados.
     */
    public function analyse(string $code): array
    {
        $loc = count(array_filter(preg_split('/\R/', $code) ?: [], static fn($l) => trim($l) !== '' && !str_starts_with(trim($l), '//')));
        if (class_exists(CppAnalysis::class)) {
            $a = CppAnalysis::analyse($code);
        } else {
            $a = ['units' => [], 'summary' => ['loc' => $loc, 'functions' => 0, 'ccTotal' => 0, 'ccMax' => 0, 'ccAvg' => 0, 'grade' => 'A', 'worst' => null,
                'maxNesting' => 0], 'hints' => [], 'symbols' => []];
        }
        $ex = $this->explainer($code);
        $diags = [];
        $lint = self::esSoluciones($code) ? [] : ($this->diagnosticosLint($code) ?? []);
        $errores = array_values(array_filter($lint, static fn($d) => $d['kind'] === 'error'));
        $avisos = array_values(array_filter($lint, static fn($d) => $d['kind'] !== 'error'));
        foreach (array_slice([...$errores, ...$avisos], 0, 20) as $d) {
            $diags[] = $ex->explain(self::evento($d));
        }
        foreach ($a['hints'] ?? [] as $h) {
            $diags[] = $h;
        }
        $summary = $a['summary'] ?? [];
        $summary['loc'] = max((int) ($summary['loc'] ?? 0), $loc);
        return ['syntax' => $errores !== [], 'diagnostics' => $diags, 'units' => $a['units'] ?? [], 'summary' => $summary, 'symbols' => $a['symbols'] ?? []];
    }

    // ───────────────────────────── ejecución ─────────────────────────────

    public function run(string $code, string $displayName, array $opts = []): array
    {
        $timeout = max(1, min(Process::MAX_TIMEOUT, (int) ($opts['timeout'] ?? 5)));
        $falla = static fn(string $texto, ?string $killed = 'launch'): array => ['items' => [['t' => 'out', 'text' => $texto]], 'exit' => -1,
            'killed' => $killed, 'wallMs' => 0, 'truncated' => false, 'timeout' => $timeout];
        $c = $this->compilador();
        if (!$c['ok']) {
            return $falla('No se encontró un compilador de C++20 (g++ o clang++).');
        }
        $modo = !empty($opts['bench']) ? 'fast' : 'checked';
        $t0 = hrtime(true);
        $errorCompilacion = function (array $diags) use ($t0, $timeout): array {
            $errs = array_values(array_filter($diags, static fn($d) => $d['kind'] === 'error'));
            return ['items' => array_map(static fn($d) => ['t' => 'ev', 'ev' => self::evento($d)], array_slice($errs, 0, 10)), 'exit' => 1, 'killed' => null,
                'wallMs' => intdiv(hrtime(true) - $t0, 1_000_000), 'truncated' => false, 'timeout' => $timeout];
        };
        if (!self::tieneMain($code)) {
            $r = $this->compilar($code, 'lint');
            if ($r !== null && !$r['ok']) {
                return $errorCompilacion($r['diags']);
            }
            return ['items' => [['t' => 'ev', 'ev' => ['t' => 'err', 'kind' => 'fatal', 'msg' => 'No hay función «int main()»: sin ella no hay por dónde empezar.', 'line' => 1]]],
                'exit' => 1, 'killed' => null, 'wallMs' => 0, 'truncated' => false, 'timeout' => $timeout];
        }
        $bin = $this->rutaBinario($code, $modo);
        if (is_file($bin)) {
            @touch($bin);
            $this->ultimaVia = 'cache';
        } else {
            $this->ultimaVia = 'compilado';
            $r = $this->compilar($code, $modo, $bin);
            if ($r === null) {
                return $falla('No se pudo preparar el harness de C++ (pg.hpp / pg_main.cpp).');
            }
            if (!$r['ok']) {
                return $errorCompilacion($r['diags']);
            }
            if (!is_file($bin)) {
                return $falla('No se pudo guardar el programa compilado.');
            }
        }

        $logs = Process::makeTempDir('pgcpp_');
        try {
            $env = ['PG_BENCH' => $modo === 'fast' ? '1' : '0', 'PG_TIMEOUT' => (string) $timeout,
                'ASAN_OPTIONS' => implode(':', ['log_path=' . $logs . DIRECTORY_SEPARATOR . 'asan', 'detect_leaks=' . ($c['lsan'] ? '1' : '0'), 'leak_check_at_exit=0',
                    'abort_on_error=0', 'allocator_may_return_null=1', 'detect_stack_use_after_return=0', 'handle_abort=0', 'symbolize=1',
                    'hard_rss_limit_mb=2048', 'max_allocation_size_mb=2048', 'print_summary=1', 'color=never']),
                'UBSAN_OPTIONS' => 'log_path=' . $logs . DIRECTORY_SEPARATOR . 'ubsan:print_stacktrace=1:halt_on_error=1:symbolize=1:color=never',
                'LSAN_OPTIONS' => 'log_path=' . $logs . DIRECTORY_SEPARATOR . 'asan'];
            if (isset($opts['benchBudgetMs'])) {
                $env['PG_BENCH_BUDGET_MS'] = (string) (int) $opts['benchBudgetMs'];
            }
            $res = Process::run([$bin], ['stdin' => (string) ($opts['stdin'] ?? ''), 'timeout' => $timeout, 'grace' => 2, 'env' => $env,
                'cwd' => PG_PRACTICAS . DIRECTORY_SEPARATOR . 'cpp']);
            if ($res['killed'] === 'launch') {
                return $falla('No se pudo lanzar el programa compilado.');
            }
            [$raw, $informesSalida] = self::separarInformes($res['raw']);
            $items = Protocol::split($raw);
            $items = $this->completarEventos($items, $this->informesSanitizer($logs, $informesSalida), $bin, $code, (int) $res['wallMs']);
        } finally {
            Process::rmTree($logs);
        }
        $items = Protocol::scrub($items, [$bin, basename($bin)], 'programa');    // glibc pone el nombre del ejecutable en los assert
        $needles = ['./' . self::FUENTE, '.\\' . self::FUENTE, self::FUENTE, $logs];
        $items = Protocol::scrub($items, $needles, $displayName);
        return ['items' => $items, 'exit' => $res['exit'], 'killed' => $res['killed'], 'wallMs' => $res['wallMs'], 'truncated' => $res['truncated'], 'timeout' => $timeout];
    }

    /**
     * Retoques después de ejecutar: los informes de los sanitizers van delante de `end` (y se añade `end` si el proceso
     * murió sin él), las direcciones (`pcs`) se traducen a líneas y trazas del usuario, un assert() fallido toma su
     * línea del mensaje, y lo que no tenga línea va a la de main.
     * @param list<array<string,mixed>> $items
     * @param list<array<string,mixed>> $informes
     * @return list<array<string,mixed>>
     */
    private function completarEventos(array $items, array $informes, string $bin, string $code, int $wallMs): array
    {
        $fin = null;
        foreach ($items as $i => $it) {
            if ($it['t'] === 'ev' && ($it['ev']['t'] ?? '') === 'end') {
                $fin = $i;
            }
        }
        if ($informes !== []) {
            $nuevos = array_map(static fn($ev) => ['t' => 'ev', 'ev' => $ev], $informes);
            if ($fin === null) {
                array_push($items, ...$nuevos);
            } else {
                array_splice($items, $fin, 0, $nuevos);
            }
        }
        if ($fin === null) {
            $items[] = ['t' => 'ev', 'ev' => ['t' => 'end', 'ms' => $wallMs, 'mem' => null, 'peak' => null]];
        }

        // Direcciones → líneas (una sola llamada a addr2line para todos los eventos)
        $todas = [];
        foreach ($items as $it) {
            foreach ($it['t'] === 'ev' && is_array($it['ev']['pcs'] ?? null) ? $it['ev']['pcs'] : [] as $pc) {
                $todas[(string) $pc] = true;
            }
        }
        $frames = $todas !== [] ? $this->simbolizar($bin, array_keys($todas)) : [];
        $lineaMain = self::lineaMain($code);
        $textoPrevio = '';
        foreach ($items as $i => $it) {
            if ($it['t'] === 'out') {
                $textoPrevio .= $it['text'];
                continue;
            }
            $ev = $it['ev'];
            if (isset($ev['pcs'])) {
                $traza = [];
                foreach ((array) $ev['pcs'] as $pc) {
                    foreach ($frames[(string) $pc] ?? [] as $f) {
                        $traza[] = $f;
                    }
                }
                if ($traza !== []) {
                    $ev['line'] = $traza[0]['line'];
                    $ev['trace'] = array_slice($traza, 0, 12);
                }
                unset($ev['pcs']);
            }
            if (($ev['t'] ?? '') === 'err' && ($ev['kind'] ?? '') === 'abort'
                && preg_match('/' . preg_quote(self::FUENTE, '/') . ':(\d+): (?:[^\n]*?: )?Assertion [`\'](.+?)\' failed\.?\s*$/', $textoPrevio, $m)) {
                $ev['line'] = (int) $m[1];
                $ev['cls'] = 'assert';
                $ev['msg'] = "assert({$m[2]}) no se cumple";
            } elseif (($ev['t'] ?? '') === 'err' && ($ev['kind'] ?? '') === 'abort'
                && preg_match('/:\d+: (?:[^\n]*?: )?Assertion \'(.+?)\' failed\.?\s*$/', $textoPrevio, $m)) {
                $ev['cls'] = 'glibcxx-assert';    // comprobación de la biblioteca (_GLIBCXX_ASSERTIONS): vector[i] fuera de rango…
                $ev['msg'] = "comprobación de la biblioteca: {$m[1]}";
            }
            if (isset($ev['trace']) && is_array($ev['trace'])) {
                $ev['trace'] = self::comprimirTraza($ev['trace']);
            }
            if (in_array($ev['t'] ?? '', ['err', 'todo', 'bench'], true) && (int) ($ev['line'] ?? 0) <= 0) {
                $ev['line'] = $lineaMain;
            }
            $items[$i]['ev'] = $ev;
            if (($ev['t'] ?? '') !== 'end') {
                $textoPrevio = '';
            }
        }
        return $items;
    }

    /**
     * addr2line -a -f -C -i: para cada dirección, los frames que caen en el archivo del usuario (con las funciones en
     * línea, de dentro hacia fuera).
     * @param list<string> $pcs
     * @return array<string, list<array{fn:string, line:int}>>
     */
    private function simbolizar(string $bin, array $pcs): array
    {
        $a2l = $this->compilador()['addr2line'] ?? null;
        if ($a2l === null || $pcs === []) {
            return [];
        }
        $r = Process::run([$a2l, '-a', '-f', '-C', '-i', '-e', $bin, ...$pcs], ['timeout' => 10, 'grace' => 2]);
        $out = [];
        $actual = null;
        $fn = null;
        foreach (preg_split('/\r\n|\n/', $r['raw']) ?: [] as $l) {
            if (preg_match('/^0x0*([0-9a-f]+)$/i', $l, $m)) {
                $actual = null;
                foreach ($pcs as $pc) {
                    if (strtolower(ltrim(substr($pc, 2), '0')) === strtolower(ltrim($m[1], '0'))) {
                        $actual = $pc;
                        break;
                    }
                }
                $fn = null;
                continue;
            }
            if ($actual === null) {
                continue;
            }
            if ($fn === null) {
                $fn = $l;
                continue;
            }
            if (preg_match('~(?:^|[/\\\\])' . preg_quote(self::FUENTE, '~') . ':(\d+)~', $l, $m) && (int) $m[1] > 0) {
                $out[$actual][] = ['fn' => self::nombreCorto($fn), 'line' => (int) $m[1]];
            }
            $fn = null;
        }
        return $out;
    }

    /**
     * Frames repetidos seguidos (una recursión que desborda la pila) → uno solo con «(×N)».
     * @param list<array{fn:string, line:int}> $traza
     * @return list<array{fn:string, line:int}>
     */
    private static function comprimirTraza(array $traza): array
    {
        $out = [];
        foreach ($traza as $f) {
            $k = count($out) - 1;
            if ($k >= 0 && $out[$k]['fn'] === $f['fn'] && $out[$k]['line'] === $f['line']) {
                $out[$k]['rep'] = ($out[$k]['rep'] ?? 1) + 1;
                continue;
            }
            $out[] = $f;
        }
        foreach ($out as &$f) {
            if (isset($f['rep'])) {
                $f['fn'] .= ' (×' . $f['rep'] . (count($traza) >= 12 ? '+' : '') . ')';
                unset($f['rep']);
            }
        }
        return $out;
    }

    /** "buscar(std::vector<int> const&, int)" → "buscar()", "main::{lambda(int)#1}::operator()(int) const" → "main::{lambda}()". */
    private static function nombreCorto(string $fn): string
    {
        $fn = trim($fn);
        $fn = (string) preg_replace('/\{lambda\([^)]*\)#\d+\}::operator\(\)/', '{lambda}', $fn);
        $fn = (string) preg_replace('/\{lambda\([^)]*\)#\d+\}/', '{lambda}', $fn);
        $fn = (string) preg_replace('/\s+(?:const|volatile|&&|&)\s*$/', '', $fn);
        if (str_ends_with($fn, ')')) {
            $prof = 0;
            for ($i = strlen($fn) - 1; $i >= 0; $i--) {
                $ch = $fn[$i];
                if ($ch === ')') {
                    $prof++;
                } elseif ($ch === '(') {
                    $prof--;
                    if ($prof === 0) {
                        $fn = substr($fn, 0, $i);
                        break;
                    }
                }
            }
        }
        $fn = (string) preg_replace('/^.*?\b(?:std::)?__cxx11::/', 'std::', $fn);
        $fn = (string) preg_replace('/\bpg_main_usuario\b/', 'main', $fn);
        return ($fn === '' ? '?' : $fn) . '()';
    }

    // ───────────────────────────── informes de los sanitizers ─────────────────────────────

    /**
     * Lee los registros de ASan/UBSan/LeakSanitizer de la carpeta y los convierte en eventos `err`.
     * @return list<array<string,mixed>>
     */
    private function informesSanitizer(string $dir, string $deLaSalida = ''): array
    {
        $out = [];
        $fugas = 0;
        $textos = [];
        foreach ([...(glob($dir . DIRECTORY_SEPARATOR . 'ubsan.*') ?: []), ...(glob($dir . DIRECTORY_SEPARATOR . 'asan.*') ?: [])] as $f) {
            $textos[] = (string) @file_get_contents($f, false, null, 0, 400_000);
        }
        if ($deLaSalida !== '') {
            $textos[] = $deLaSalida;
        }
        foreach ($textos as $txt) {
            if (!mb_check_encoding($txt, 'UTF-8')) {
                $txt = mb_convert_encoding($txt, 'UTF-8', 'UTF-8');
            }
            foreach (self::trocearInformes($txt) as $inf) {
                $ev = self::eventoInforme($inf);
                if ($ev === null) {
                    continue;
                }
                if ($ev['kind'] === 'leak' && ++$fugas > 5) {
                    continue;
                }
                $out[] = $ev;
            }
        }
        return $out;
    }

    /**
     * La libubsan de GCC (aparte de libasan) no hace caso de log_path y escribe sus informes en stderr, mezclados con la
     * salida: se sacan de ahí (la línea «…: runtime error: …» y su traza «    #N 0x… in …»), junto con los avisos
     * «XSanitizer:DEADLYSIGNAL» que preceden a los informes que sí van al registro.
     * @return array{0:string, 1:string} [salida sin informes, informes]
     */
    private static function separarInformes(string $raw): array
    {
        if (!str_contains($raw, 'runtime error: ') && !str_contains($raw, 'Sanitizer:DEADLYSIGNAL')) {
            return [$raw, ''];
        }
        $informes = '';
        $raw = (string) preg_replace('/^[A-Za-z]+Sanitizer:DEADLYSIGNAL\r?\n/m', '', $raw);
        $raw = (string) preg_replace_callback('/^[^\n\x1e]*?:\d+:\d+: runtime error: [^\n]*\n(?:[ \t]+#\d+ [^\n]*\n)*(?:\r?\n)?(?:SUMMARY: UndefinedBehaviorSanitizer[^\n]*\n)?/m',
            static function ($m) use (&$informes) {
                $informes .= $m[0] . "\n";
                return '';
            }, $raw);
        return [$raw, $informes];
    }

    /** @return list<string> un trozo por informe (ASan/LSan empiezan por ==PID==ERROR, UBSan por «runtime error:») */
    private static function trocearInformes(string $txt): array
    {
        $trozos = [];
        $actual = '';
        foreach (preg_split('/\r\n|\n/', $txt) ?: [] as $l) {
            $nuevo = preg_match('/^==\d+==ERROR: /', $l) || preg_match('/: runtime error: /', $l)
                || preg_match('/^(?:Direct|Indirect) leak of /', $l);
            if ($nuevo && trim($actual) !== '') {
                $trozos[] = $actual;
                $actual = '';
            }
            $actual .= $l . "\n";
        }
        if (trim($actual) !== '') {
            $trozos[] = $actual;
        }
        return $trozos;
    }

    /**
     * Frames de una sección (#0 0x… in fn archivo:línea) que caen en el código del usuario.
     * @return list<array{fn:string, line:int}>
     */
    private static function framesUsuario(string $texto): array
    {
        $out = [];
        foreach (preg_split('/\n/', $texto) ?: [] as $l) {
            if (preg_match('~^\s*#\d+\s+0x[0-9a-f]+\s+in\s+(.+?)\s+(?:\S*[/\\\\])?' . preg_quote(self::FUENTE, '~') . ':(\d+)(?::\d+)?\s*$~', $l, $m)) {
                $out[] = ['fn' => self::nombreCorto($m[1]), 'line' => (int) $m[2]];
            }
        }
        return $out;
    }

    /** @return ?array<string,mixed> */
    private static function eventoInforme(string $inf): ?array
    {
        // UBSan: «archivo:L:C: runtime error: mensaje»
        if (preg_match('/^(.*?):(\d+):(\d+): runtime error: (.+)$/m', $inf, $m)) {
            $msg = trim($m[4]);
            $cls = match (true) {
                str_contains($msg, 'signed integer overflow') || str_contains($msg, 'negation of') => 'signed-integer-overflow',
                str_contains($msg, 'division by zero') || str_contains($msg, 'divide by zero') => 'division-by-zero',
                str_contains($msg, 'shift') => 'shift',
                str_contains($msg, 'null pointer') => 'null',
                (bool) preg_match('/index -?\d+ out of bounds/', $msg) => 'out-of-bounds',
                str_contains($msg, 'value-returning function') || str_contains($msg, 'end of a value-returning') => 'missing-return',
                str_contains($msg, 'unreachable') => 'unreachable',
                str_contains($msg, 'not a valid value for type') => 'invalid-value',
                str_contains($msg, 'misaligned') => 'alignment',
                str_contains($msg, 'variable length array') => 'vla-bound',
                str_contains($msg, 'outside the range of representable') => 'float-cast-overflow',
                str_contains($msg, 'pointer index expression') || str_contains($msg, 'pointer overflow') => 'pointer-overflow',
                str_contains($msg, 'which does not point to an object of type') => 'vptr',
                default => 'undefined',
            };
            $usuario = (bool) preg_match('~(?:^|[/\\\\])' . preg_quote(self::FUENTE, '~') . '$~', $m[1]);
            $traza = self::framesUsuario($inf);
            $linea = $usuario ? (int) $m[2] : ($traza[0]['line'] ?? 0);
            $ev = ['t' => 'err', 'kind' => 'ubsan', 'cls' => $cls, 'msg' => $msg, 'line' => $linea];
            if ($usuario) {
                $ev['col'] = (int) $m[3];
            }
            if ($traza !== []) {
                $ev['trace'] = array_slice($traza, 0, 12);
            }
            return $ev;
        }
        // LeakSanitizer: una fuga directa (las indirectas son consecuencia de las directas)
        if (preg_match('/^Direct leak of (\d+) byte\(s\) in (\d+) object\(s\)/m', $inf, $m)) {
            $traza = self::framesUsuario($inf);
            return ['t' => 'err', 'kind' => 'leak', 'cls' => 'memory-leak', 'msg' => "Direct leak of {$m[1]} byte(s) in {$m[2]} object(s)",
                'bytes' => (int) $m[1], 'objects' => (int) $m[2], 'line' => $traza[0]['line'] ?? 0, 'trace' => array_slice($traza, 0, 12)];
        }
        if (!preg_match('/==\d+==ERROR: AddressSanitizer: ([\w-]+)(.*)$/m', $inf, $m)) {
            return null;    // cabecera de LeakSanitizer, resúmenes…
        }
        $cls = str_starts_with($m[1] . $m[2], 'out of memory') ? 'out-of-memory' : $m[1];
        if ($cls === 'out-of-memory') {
            $m[2] = '(' . trim((string) preg_replace('/^ of memory:?/', '', $m[2])) . ')';
        }
        $resto = trim((string) preg_replace(['/\s*\(pc 0x[0-9a-f]+.*$/', '/\s*at pc 0x[0-9a-f]+.*$/', '/ on (?:unknown )?address 0x[0-9a-f]+/'], '', $m[2]));
        // Secciones: lo que falló (hasta la primera línea en blanco), y «allocated by» / «freed by» / «previously allocated by»
        $secciones = preg_split('/\n\s*\n/', $inf) ?: [$inf];
        $principal = $secciones[0];
        $traza = self::framesUsuario($principal);
        $ev = ['t' => 'err', 'kind' => 'asan', 'cls' => $cls, 'msg' => 'AddressSanitizer: ' . $cls . ($resto !== '' ? ' ' . $resto : ''), 'line' => $traza[0]['line'] ?? 0];
        if (preg_match('/^(READ|WRITE) of size (\d+)/m', $inf, $a)) {
            $ev['access'] = $a[1];
            $ev['size'] = (int) $a[2];
            $ev['msg'] .= " ({$a[1]} of size {$a[2]})";
        }
        if (preg_match('/^0x[0-9a-f]+ is located (.+?)$/m', $inf, $d)) {
            $ev['detail'] = 'located ' . preg_replace('/ \[0x[0-9a-f]+,0x[0-9a-f]+\)/', '', $d[1]);
        } elseif (preg_match('/^Address 0x[0-9a-f]+ is located (.+?)$/m', $inf, $d)) {
            $ev['detail'] = 'located ' . trim((string) preg_replace('/0x[0-9a-f]+/', '', $d[1]));
        }
        if (preg_match('/^The signal is caused by a (READ|WRITE) memory access\./m', $inf, $s)) {
            $ev['access'] = $s[1];
        }
        if (preg_match('/^Hint: (.+)$/m', $inf, $h)) {
            $ev['detail'] = trim((string) preg_replace('/0x[0-9a-f]+/', '', $h[1]));
        }
        foreach ($secciones as $sec) {
            if (preg_match('/^(?:allocated by|previously allocated by) thread/m', $sec) && ($fs = self::framesUsuario($sec)) !== []) {
                $ev['allocLine'] = $fs[0]['line'];
            } elseif (preg_match('/^freed by thread/m', $sec) && ($fs = self::framesUsuario($sec)) !== []) {
                $ev['freeLine'] = $fs[0]['line'];
            }
        }
        if (in_array($cls, ['out-of-memory', 'allocation-size-too-big', 'requested', 'rss-limit-exceeded', 'calloc-overflow', 'allocator'], true)
            || str_contains($m[2], 'allocation size') || str_contains($m[2], 'rss limit')) {
            $ev['kind'] = 'memory';
        }
        if ($traza !== []) {
            $ev['trace'] = array_slice($traza, 0, 12);
        }
        return $ev;
    }

    // ───────────────────────────── explicador y soluciones ─────────────────────────────

    public function explainer(string $code): Explains
    {
        return new CppExplainer($code);
    }

    public function declarations(string $code): array
    {
        return class_exists(CppAnalysis::class) ? CppAnalysis::declarations($code) : [];
    }

    public function insertionPoint(string $code, array $decl): int
    {
        return class_exists(CppAnalysis::class) ? CppAnalysis::insertionPoint($code, $decl) : strlen($code);
    }
}
