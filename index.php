<?php
declare(strict_types=1);

/**
 * Router del servidor integrado:  php -S 127.0.0.1:8000 index.php
 *
 *   /                          pantalla de inicio: eliges PHP, Python, Java o C++ (app/landing.php)
 *   /php  /python  /java  /cpp el IDE de ese lenguaje (app/shell.php)
 *   /assets/...                CSS y JS (se sirven a mano: nada más de esta carpeta es accesible por URL)
 *   /api?lang=…&action=...     la API (app/Core/Api.php)
 *   /guias  /guias/<id>        guías visuales interactivas (app/guias.php, contenido/guias.json, assets/guias/)
 *   cualquier otra             404   (así app/*.php, contenido/, practicas/, var/... nunca se ejecutan ni se leen por URL)
 */

require __DIR__ . '/app/bootstrap.php';

use Playground\Core\Api;
use Playground\Core\Languages;

$path = rawurldecode((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH));
$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');

function pg_send(int $status, string $type, string $body, array $extra = []): never
{
    http_response_code($status);
    header('Content-Type: ' . $type);
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    foreach ($extra as $k => $v) {
        header("{$k}: {$v}");
    }
    echo $body;
    exit;
}

function pg_json(int $status, array $data): never
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    pg_send($status, 'application/json; charset=utf-8', $json === false ? '{"error":"JSON no válido"}' : $json, ['Cache-Control' => 'no-store']);
}

const PG_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; "
    . "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' data: https://cdnjs.cloudflare.com https://fonts.gstatic.com; "
    . "img-src 'self' data:; worker-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'";

// ── API ─────────────────────────────────────────────────────────────────
if ($path === '/api') {
    if ($error = Api::authorize($_SERVER)) {
        pg_json(403, ['error' => $error]);
    }
    $body = [];
    if ($method === 'POST') {
        $raw = (string) file_get_contents('php://input', false, null, 0, 2_000_000);
        $body = json_decode($raw, true);
        if (!is_array($body)) {
            pg_json(400, ['error' => 'JSON no válido']);
        }
    }
    [$status, $data] = (new Api())->handle($method, (string) ($_GET['action'] ?? ''), $_GET, $body);
    pg_json($status, $data);
}

// ── Archivos estáticos ──────────────────────────────────────────────────
if (str_starts_with($path, '/assets/') && in_array($method, ['GET', 'HEAD'], true)) {
    $root = realpath(__DIR__ . '/assets');
    $file = $root === false ? false : realpath($root . '/' . substr($path, 8));
    if ($file !== false && str_starts_with($file, $root . DIRECTORY_SEPARATOR) && is_file($file)) {
        $types = [
            'css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'json' => 'application/json; charset=utf-8',
            'webp' => 'image/webp', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'ico' => 'image/x-icon', 'woff2' => 'font/woff2',
        ];
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (isset($types[$ext])) {
            // Librerías de terceros (KaTeX…) no cambian entre ejecuciones: caché de un día para no volver a bajar fuentes en cada guía
            $cache = str_starts_with($file, $root . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR) ? 'public, max-age=86400' : 'no-cache';
            pg_send(200, $types[$ext], (string) file_get_contents($file), ['Cache-Control' => $cache]);
        }
    }
    pg_send(404, 'text/plain; charset=utf-8', 'No encontrado');
}

// ── Guías visuales ──────────────────────────────────────────────────────
// /guias (índice) y /guias/<id>. app/guias.php solo sirve los ids de contenido/guias.json que tienen su assets/guias/data/<id>.js.
if (in_array($method, ['GET', 'HEAD'], true) && preg_match('#^/guias(?:/([a-z0-9-]+))?/?$#', $path, $m)) {
    if ($error = Api::authorize($_SERVER)) {
        pg_send(403, 'text/plain; charset=utf-8', $error);
    }
    $pgGuia = $m[1] ?? null;
    ob_start();
    require __DIR__ . '/app/guias.php';
    pg_send(200, 'text/html; charset=utf-8', (string) ob_get_clean(), ['Cache-Control' => 'no-store', 'Content-Security-Policy' => PG_CSP]);
}

// ── Interfaz ────────────────────────────────────────────────────────────
if (in_array($method, ['GET', 'HEAD'], true) && ($path === '/' || preg_match('#^/(php|python|java|cpp)/?$#', $path, $m))) {
    if ($error = Api::authorize($_SERVER)) {
        pg_send(403, 'text/plain; charset=utf-8', $error);
    }
    ob_start();
    if ($path === '/') {
        require __DIR__ . '/app/landing.php';
    } else {
        $pgLang = Languages::get($m[1]);
        require __DIR__ . '/app/shell.php';
    }
    pg_send(200, 'text/html; charset=utf-8', (string) ob_get_clean(), ['Cache-Control' => 'no-store', 'Content-Security-Policy' => PG_CSP]);
}

pg_send(404, 'text/plain; charset=utf-8', 'No encontrado');
