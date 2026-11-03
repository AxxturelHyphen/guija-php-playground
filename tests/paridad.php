<?php
declare(strict_types=1);

/**
 * Paridad del temario entre PHP, Python y Java (contenido/temario.json es la fuente común).
 *
 * Para cada lenguaje y lección del temario comprueba que:
 *   1. existe el archivo de la lección (y el de soluciones si tiene ejercicios);
 *   2. cada ejercicio está declarado en la lección con su pendiente() y resuelto en la solución;
 *   3. el @bigo de la solución es el del temario, y los ejercicios con medir() se miden;
 *   4. Java tiene las mismas secciones numeradas que PHP, y Python (lecciones 02–07) las mismas que su equivalente PHP;
 *   5. hay al menos tantas pruebas como en PHP (usa el recuento que deja content_check en var/pruebas-<lenguaje>.json).
 * Las diferencias justificadas están en temario.json → "paridad" y no cuentan como fallo.
 *
 * Uso: php tests/paridad.php [--lang=python|java|php]      (sin --lang: los tres)
 */
require_once dirname(__DIR__) . '/app/bootstrap.php';

use Playground\Core\{Languages, Solutions, Temario};

$only = null;
foreach (array_slice($argv, 1) as $a) {
    if (str_starts_with($a, '--lang=')) {
        $only = substr($a, 7);
    }
}

$data = Temario::data();
$lessons = $data['lecciones'] ?? [];
$exceptions = $data['paridad'] ?? [];
$fail = 0;
$okCount = 0;

$excused = static function (string $lang, string $lesson, ?string $exercise, string $what) use ($exceptions): bool {
    foreach ($exceptions as $e) {
        if (($e['lenguaje'] ?? '') !== $lang || ($e['leccion'] ?? '') !== $lesson) {
            continue;
        }
        if (isset($e['ejercicio']) && $e['ejercicio'] !== $exercise) {
            continue;
        }
        if (isset($e['comprobacion']) && $e['comprobacion'] !== $what) {
            continue;
        }
        return true;
    }
    return false;
};
$report = static function (bool $ok, string $msg) use (&$fail, &$okCount): void {
    if ($ok) {
        $okCount++;
        return;
    }
    $fail++;
    echo "FAIL {$msg}\n";
};

/** Números de las secciones principales («// 3. TÍTULO» o «# 3. TÍTULO») de una lección. */
$sections = static function (string $code, string $langId): array {
    $re = $langId === 'python' ? '/^# (\d+)\. \S/m' : '/^\/\/ (\d+)\. \S/m';
    preg_match_all($re, $code, $m);
    return array_values(array_unique(array_map('intval', $m[1])));
};
/** Texto de la parte de medir(): desde el título «── Medir» (o el primer medir() si no lo hay). */
$medirPart = static function (string $code): string {
    if (preg_match('/^\s*(?:\/\/|#)\s*─+\s*Medir/mu', $code, $m, PREG_OFFSET_CAPTURE)) {
        return substr($code, $m[0][1]);
    }
    $p = strpos($code, 'medir(');
    return $p === false ? '' : substr($code, max(0, $p - 400));
};

$totals = [];
foreach (Languages::IDS as $id) {
    $f = PG_VAR . "/pruebas-{$id}.json";
    $totals[$id] = is_file($f) ? (json_decode((string) file_get_contents($f), true)['totals'] ?? null) : null;
}

foreach (Languages::IDS as $langId) {
    if ($only !== null && $only !== $langId) {
        continue;
    }
    $lang = Languages::get($langId);
    if (!is_dir($lang->examplesDir())) {
        echo "AVISO {$langId}: todavía no hay contenido (" . substr($lang->examplesDir(), strlen(PG_ROOT) + 1) . ")\n";
        continue;
    }
    $solutions = new Solutions($lang);
    $byId = [];
    foreach ($lessons as $l) {
        $byId[$l['id']] = $l;
    }

    foreach ($lessons as $l) {
        $entry = $l[$langId] ?? null;
        if (!is_array($entry)) {
            continue;   // la lección no existe en este lenguaje (p. ej. numpy solo en Python)
        }
        // ¿Dónde viven los ejercicios de esta lección en este lenguaje?
        $hostId = $entry['fusionadaEn'] ?? $l['id'];
        $host = $byId[$hostId][$langId] ?? null;
        if (!is_array($host) || !isset($host['archivo'])) {
            $report(false, "{$langId}: la lección «{$l['id']}» no tiene archivo ni lección donde fundirse");
            continue;
        }
        $file = $host['archivo'];
        $path = $lang->examplesDir() . '/' . $file;
        if (!is_file($path)) {
            $report(false, "{$langId}: falta la lección {$file} («{$l['id']}»)");
            continue;
        }
        $report(true, '');
        $code = (string) file_get_contents($path);
        $exercises = array_values(array_filter($l['ejercicios'] ?? [], static fn($e) => ($e[$langId] ?? null) !== null));
        if (!$exercises) {
            if (!isset($entry['fusionadaEn'])) {
                $report(true, '');
            }
        } else {
            $solPath = $solutions->pathFor($file);
            if ($solPath === null) {
                $report(false, "{$langId}: {$file} tiene ejercicios pero no existe soluciones/{$file}");
                continue;
            }
            $solCode = (string) file_get_contents($solPath);
            $mine = $solutions->declarations($code);
            $sol = $solutions->declarations($solCode);
            $medir = $medirPart($code);
            foreach ($exercises as $ex) {
                $name = (string) $ex[$langId];
                $key = (($ex['tipo'] ?? 'function') === 'type' ? 'type:' : 'function:') . strtolower($name);
                if ($excused($langId, $l['id'], $name, 'ejercicio')) {
                    continue;
                }
                $d = $mine[$key] ?? null;
                $report($d !== null, "{$langId}: {$file} no declara el ejercicio {$name} (clave {$key})");
                if ($d !== null) {
                    $report((bool) preg_match('/\bpendiente\s*\(/', $d['code']), "{$langId}: {$file}: {$name} no tiene pendiente() en el ejemplo");
                }
                $s = $sol[$key] ?? null;
                $report($s !== null, "{$langId}: soluciones/{$file} no resuelve {$name}");
                if ($s !== null) {
                    $doc = Solutions::parseDoc($s['doc'] ?? null);
                    $want = $ex['bigo'] ?? null;
                    if ($want !== null && !$excused($langId, $l['id'], $name, 'bigo')) {
                        $report(($doc['bigo'] ?? null) === $want, "{$langId}: soluciones/{$file}: {$name} tiene @bigo " . ($doc['bigo'] ?? 'ninguno') . " y el temario dice {$want}");
                    }
                    $report(!empty($doc['complejidad']) && !empty($doc['explicacion']), "{$langId}: soluciones/{$file}: {$name} sin @complejidad o @explicacion");
                }
                if (!empty($ex['medir']) && !$excused($langId, $l['id'], $name, 'medir')) {
                    $report((bool) preg_match('/["\']' . preg_quote($name, '/') . '(?:["\']|::|\.)/', $medir), "{$langId}: {$file} no mide {$name} con medir()");
                }
            }
        }

        // Secciones numeradas frente a la lección equivalente de PHP
        $php = $l['php'] ?? null;
        if ($langId !== 'php' && is_array($php) && isset($php['archivo']) && !isset($entry['fusiona']) && !isset($entry['fusionadaEn'])
            && !$excused($langId, $l['id'], null, 'secciones')) {
            $phpCode = (string) @file_get_contents(Languages::get('php')->examplesDir() . '/' . $php['archivo']);
            $a = $sections($phpCode, 'php');
            $b = $sections($code, $langId);
            $report($a === $b, "{$langId}: {$file} tiene las secciones [" . implode(',', $b) . '] y PHP ' . $php['archivo'] . ' tiene [' . implode(',', $a) . ']');
        }

        // Número de pruebas frente a PHP
        if ($langId !== 'php' && is_array($php) && isset($php['archivo']) && !isset($entry['fusionadaEn']) && !isset($entry['fusiona'])
            && !$excused($langId, $l['id'], null, 'pruebas')) {
            $mineTotal = $totals[$langId][$file] ?? null;
            $phpTotal = $totals['php'][$php['archivo']] ?? null;
            if ($mineTotal === null || $phpTotal === null) {
                echo "AVISO {$langId}: sin recuento de pruebas para {$file} (ejecuta antes tests/content_check.php --lang={$langId} y el de php)\n";
            } else {
                $report($mineTotal >= $phpTotal, "{$langId}: {$file} tiene {$mineTotal} pruebas y PHP {$php['archivo']} tiene {$phpTotal}");
            }
        }
    }
}

echo $fail ? "\n{$fail} FALLOS de paridad ({$okCount} comprobaciones bien)\n" : "PARIDAD OK ({$okCount} comprobaciones)\n";
exit($fail ? 1 : 0);
