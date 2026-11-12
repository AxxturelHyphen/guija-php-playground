<?php
declare(strict_types=1);

/**
 * Acción `temario` de la API (progreso del alumno), sin servidor HTTP:  php tests/temario_api.php
 * Comprueba la forma de los datos, que no hay código de soluciones, la lista blanca de lenguajes y las mismas
 * barreras (Host, Origin, método) que el resto de acciones. Código de salida 1 si algo falla.
 */
require_once dirname(__DIR__) . '/app/bootstrap.php';

use Playground\Core\{Api, Temario};

$pass = 0;
$fail = 0;
function check(string $label, bool $ok, string $detail = ''): void
{
    global $pass, $fail;
    if ($ok) {
        $pass++;
        echo "  \e[32m✓\e[0m {$label}\n";
    } else {
        $fail++;
        echo "  \e[31m✗ {$label}\e[0m" . ($detail !== '' ? "  \e[90m{$detail}\e[0m" : '') . "\n";
    }
}

$api = new Api();
echo "\n\e[1m── Acción temario\e[0m\n";
foreach (['php', 'python', 'java', 'cpp'] as $l) {
    [$status, $data] = $api->handle('GET', 'temario', ['lang' => $l], []);
    $lessons = $data['lessons'] ?? [];
    check("{$l}: 200 y mismas lecciones que Temario::lessons()", $status === 200 && array_column($lessons, 'id') === array_column(Temario::lessons($l), 'id') && $lessons !== []);

    $shapeOk = true;
    $nEj = 0;
    foreach ($lessons as $lec) {
        $shapeOk = $shapeOk && array_keys($lec) === ['id', 'tema', 'archivo', 'titulo', 'ejercicios'] && is_string($lec['archivo']) && $lec['archivo'] !== '';
        foreach ($lec['ejercicios'] as $e) {
            $nEj++;
            $shapeOk = $shapeOk && array_keys($e) === ['key', 'name', 'tipo', 'bigo', 'medir']
                && is_string($e['key']) && $e['key'] !== '' && is_string($e['name']) && is_bool($e['medir']) && ($e['bigo'] === null || is_string($e['bigo']));
        }
    }
    check("{$l}: forma exacta (solo id/tema/archivo/titulo/ejercicios y key/name/tipo/bigo/medir), {$nEj} ejercicios", $shapeOk && $nEj > 0);
    check("{$l}: la clave es el nombre en ese lenguaje", $shapeOk && array_reduce($lessons, static fn(bool $a, array $lec): bool => $a && array_reduce($lec['ejercicios'], static fn(bool $b, array $e): bool => $b && str_starts_with($e['name'], $e['key']), true), true));

    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    check("{$l}: sin código de soluciones (ni «return», ni rutas de contenido/)", !str_contains($json, 'return ') && !str_contains($json, 'soluciones'));
}

[$status] = $api->handle('GET', 'temario', ['lang' => 'ruby'], []);
check('lenguaje desconocido → 404', $status === 404);
[$status] = $api->handle('GET', 'temario', ['lang' => '../../app'], []);
check('lenguaje con ../ → 404', $status === 404);
[$status] = $api->handle('POST', 'temario', ['lang' => 'cpp'], []);
check('por POST → 405 (es de solo lectura)', $status === 405);
[$status] = $api->handle('GET', 'temario', [], []);
check('sin lang usa php (como el resto de acciones)', $status === 200);

// Las mismas barreras que el resto de GET viven en Api::authorize (index.php la ejecuta antes de handle)
$get = ['REQUEST_METHOD' => 'GET', 'HTTP_HOST' => '127.0.0.1:8000'];
check('Host local → permitido', Api::authorize($get) === null);
check('Host ajeno → rechazado', Api::authorize(['HTTP_HOST' => 'evil.example'] + $get) !== null);
check('Origin ajeno → rechazado', Api::authorize(['HTTP_ORIGIN' => 'http://evil.example'] + $get) !== null);
check('mismo Origin → permitido', Api::authorize(['HTTP_ORIGIN' => 'http://127.0.0.1:8000'] + $get) === null);

echo "\n" . ($fail === 0 ? "\e[32m{$pass} comprobaciones OK\e[0m\n" : "\e[31m{$fail} FALLOS\e[0m de " . ($pass + $fail) . "\n");
exit($fail === 0 ? 0 : 1);
