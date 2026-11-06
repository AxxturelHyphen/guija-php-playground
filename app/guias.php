<?php
declare(strict_types=1);

defined('PG_ROOT') or exit;

/** @var ?string $pgGuia  id pedido en /guias/{id}, o null para el índice (lo fija index.php) */
$h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
$v = static function (string $rel): string {
    $f = PG_ROOT . '/assets/' . $rel;
    return '/assets/' . $rel . '?v=' . (is_file($f) ? (string) filemtime($f) : '0');
};
// Texto bilingüe estático: ambos idiomas en el HTML, el CSS muestra el que toca (sin JS ni parpadeo)
$b = static fn(array $t): string => '<span data-es>' . $h($t['es']) . '</span><span data-en>' . $h($t['en']) . '</span>';

// Solo se listan (y se sirven) las guías de contenido/guias.json cuyo assets/guias/data/<id>.js existe
$todas = json_decode((string) @file_get_contents(PG_CONTENIDO . '/guias.json'), true)['guias'] ?? [];
$guias = array_values(array_filter($todas, static fn(array $g): bool => preg_match('/^[a-z0-9-]+$/', $g['id']) === 1
    && is_file(PG_ROOT . '/assets/guias/data/' . $g['id'] . '.js')));
// Áreas con al menos una guía; las guías conservan el orden del JSON dentro de su área
$areasJson = json_decode((string) @file_get_contents(PG_CONTENIDO . '/guias.json'), true)['areas'] ?? [];
$areasVis = [];
foreach ($areasJson as $ar) {
    $ar['guias'] = array_values(array_filter($guias, static fn(array $g): bool => ($g['area'] ?? 'dsa') === $ar['id']));
    $ar['grupos'] = array_column($ar['grupos'] ?? [], 'titulo', 'id');
    if ($ar['guias']) {
        $areasVis[] = $ar;
    }
}
$areaActual = $pgGuia !== null ? (array_values(array_filter($guias, static fn(array $g): bool => $g['id'] === $pgGuia))[0]['area'] ?? 'dsa') : 'dsa';
$actual = null;
if ($pgGuia !== null) {
    foreach ($guias as $g) {
        if ($g['id'] === $pgGuia) {
            $actual = $g;
        }
    }
    $actual ?? pg_send(404, 'text/plain; charset=utf-8', 'No encontrado');
}
$title = $actual ? $actual['titulo']['es'] . ' · Guija' : 'Guías visuales · Guija';
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= $h($title) ?></title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23004482'/%3E%3Ctext x='16' y='21' font-family='monospace' font-size='13' font-weight='700' text-anchor='middle' fill='white'%3EG%3C/text%3E%3C/svg%3E">
<link rel="preload" href="/assets/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= $v('guias/guia.css') ?>">
<script>
// Idioma antes de pintar: ?lang= manda, luego lo último elegido, luego el del navegador (solo es | en)
try { var l = new URLSearchParams(location.search).get('lang') || localStorage.getItem('pg-guia-lang') || (navigator.language || 'es').slice(0, 2); document.documentElement.lang = l === 'en' ? 'en' : 'es'; } catch (e) {}
</script>
</head>
<?php if ($actual): ?>
<body class="guia-page" data-guia="<?= $h($actual['id']) ?>">
<header class="top">
  <a class="volver" href="/guias#<?= $h($areaActual) ?>">← <?= $b(['es' => 'Guías', 'en' => 'Guides']) ?></a>
  <span class="titulo"><?= $b($actual['titulo']) ?></span>
  <span class="espacio"></span>
  <div class="idioma" role="group" aria-label="Idioma / Language"><button data-set-lang="es">ES</button><button data-set-lang="en">EN</button></div>
</header>
<main class="guia">
  <section class="izq">
    <p class="meta" id="meta"></p>
    <div class="texto" id="texto" aria-live="polite"></div>
    <pre class="codigo" id="codigo" hidden></pre>
    <details class="fuentes" id="fuentes" hidden><summary><?= $b(['es' => 'Fuentes y recursos', 'en' => 'Sources and resources']) ?></summary><ol></ol></details>
  </section>
  <section class="der">
    <div class="viewport" id="viewport"><div class="stage" id="stage"></div></div>
    <div class="jugar" id="jugar" hidden></div>
  </section>
</main>
<nav class="barra">
  <button class="btn" id="ant" aria-label="Anterior / Previous">←</button>
  <div class="pista" id="pista"></div>
  <button class="btn" id="sig" aria-label="Siguiente / Next">→</button>
</nav>
<noscript><p style="padding:20px"><?= $b(['es' => 'Esta guía necesita JavaScript.', 'en' => 'This guide needs JavaScript.']) ?></p></noscript>
<script type="module" src="<?= $v('guias/guia.js') ?>"></script>
<?php else: ?>
<body>
<header class="top">
  <span class="titulo">Guija · <?= $b(['es' => 'Guías visuales', 'en' => 'Visual guides']) ?></span>
  <span class="espacio"></span>
  <div class="idioma" role="group" aria-label="Idioma / Language"><button data-set-lang="es">ES</button><button data-set-lang="en">EN</button></div>
</header>
<main class="indice">
  <h1><?= $b(['es' => 'Guías visuales', 'en' => 'Visual guides']) ?></h1>
  <p class="lead"><?= $b(['es' => 'Explicaciones paso a paso y gráficas que se mueven. Elige un área.', 'en' => 'Step-by-step explanations and graphs you can move. Pick an area.']) ?></p>
  <div class="areas">
<?php foreach ($areasVis as $ar): ?>
  <a class="area-card" href="#<?= $h($ar['id']) ?>">
    <span class="nombre"><?= $b($ar['titulo']) ?></span>
    <span class="desc"><?= $b($ar['desc']) ?></span>
    <span class="cuenta"><?= count($ar['guias']) . (count($ar['guias']) === 1 ? $b(['es' => ' guía', 'en' => ' guide']) : $b(['es' => ' guías', 'en' => ' guides'])) ?></span>
  </a>
<?php endforeach; ?>
  </div>
<?php foreach ($areasVis as $ar): ?>
  <section class="area" id="<?= $h($ar['id']) ?>">
    <h2><?= $b($ar['titulo']) ?></h2>
    <p class="sub-area"><?= $b($ar['desc']) ?></p>
<?php $grupoAct = null; foreach ($ar['guias'] as $i => $g): ?>
<?php if (!empty($g['grupo']) && $g['grupo'] !== $grupoAct): $grupoAct = $g['grupo']; ?>
    <h3><?= $b($ar['grupos'][$g['grupo']]) ?></h3>
<?php endif; ?>
    <a class="fila" href="/guias/<?= $h($g['id']) ?>">
      <span class="num"><?= sprintf('%02d', $i + 1) ?></span>
      <span class="nombre"><?= $b($g['titulo']) ?></span>
      <span class="tag"><?= empty($g['grupo']) ? $b(['es' => 'Lección ', 'en' => 'Lesson ']) . $h($g['leccion']) : $b($ar['grupos'][$g['grupo']]) . ' · ' . $h($g['leccion']) ?></span>
      <span class="desc"><?= $b($g['desc']) ?></span>
    </a>
<?php endforeach; ?>
  </section>
<?php endforeach; ?>
</main>
<script type="module">import { iniciarIdioma } from '<?= $v('guias/idioma.js') ?>'; iniciarIdioma();</script>
<?php endif; ?>
</body>
</html>
