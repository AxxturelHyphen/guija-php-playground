<?php
declare(strict_types=1);

// Autoload PSR-4 minimalista: Playground\Analysis\Parser -> app/Analysis/Parser.php
// PG_ROOT también actúa de guarda: los archivos de app/ no hacen nada si alguien los pide por URL.

define('PG_ROOT', dirname(__DIR__));

const PG_EJEMPLOS = PG_ROOT . '/ejemplos';
const PG_PRACTICAS = PG_ROOT . '/practicas';
const PG_SOLUCIONES = PG_ROOT . '/soluciones';

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Playground\\')) {
        return;
    }
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 11)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
