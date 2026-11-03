<?php
declare(strict_types=1);

// Autoload PSR-4 minimalista: Playground\Core\Api -> app/Core/Api.php, Playground\Lang\Php\Analysis\Parser -> app/Lang/Php/Analysis/Parser.php
// PG_ROOT también actúa de guarda: los archivos de app/ no hacen nada si alguien los pide por URL.

define('PG_ROOT', dirname(__DIR__));

const PG_CONTENIDO = PG_ROOT . '/contenido';    // contenido/<lenguaje>/{ejemplos,soluciones} + temario.json
const PG_PRACTICAS = PG_ROOT . '/practicas';    // practicas/<lenguaje>/  (lo que guarda el usuario)
const PG_VAR = PG_ROOT . '/var';                // artefactos de ejecución (cachés, compilados); nunca se sirve

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Playground\\')) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 11)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
