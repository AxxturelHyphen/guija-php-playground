<?php
declare(strict_types=1);

defined('PG_ROOT') or exit;

// Pantalla de inicio: eliges con qué lenguaje practicar. Las tarjetas se rellenan con lo que hay instalado (api ?action=langs).
$v = static function (string $rel): string {
    $f = PG_ROOT . '/assets/' . $rel;
    return '/assets/' . $rel . '?v=' . (is_file($f) ? (string) filemtime($f) : '0');
};
$cards = [
    ['php', 'PHP', 'PHP', '#8892BF', '#4F5B93', 'El lenguaje, POO a fondo y algoritmos, explicado para quien viene de Java.'],
    ['python', 'Python', 'PY', '#4B8BBE', '#306998', 'Estructuras de datos y algoritmos, y la base para IA/ML: numpy, matplotlib y audio con librosa.'],
    ['java', 'Java', 'JAVA', '#E76F00', '#5382A1', 'Java moderno (17–21), POO y los mismos algoritmos, con el mismo enfoque que la versión PHP.'],
    ['cpp', 'C++', 'C++', '#00599C', '#004482', 'DSA a fondo en C++20: STL, grafos, DP, árboles de rangos… con AddressSanitizer vigilando tu memoria.'],
];
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guija Playground · elige lenguaje</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%234F5B93'/%3E%3Ctext x='16' y='21' font-family='monospace' font-size='13' font-weight='700' text-anchor='middle' fill='white'%3EG%3C/text%3E%3C/svg%3E">
<link rel="preload" href="/assets/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="<?= $v('css/app.css') ?>">
<style>
/* Landing: tipografía autoalojada (el IDE no se toca). Licencias OFL en assets/fonts/LICENSES.txt */
@font-face { font-family: "Atkinson Hyperlegible Next"; font-style: normal; font-weight: 400; font-display: swap; src: url(/assets/fonts/atkinson-hyperlegible-next-latin-400-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "Atkinson Hyperlegible Next"; font-style: normal; font-weight: 600; font-display: swap; src: url(/assets/fonts/atkinson-hyperlegible-next-latin-600-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "Source Serif 4"; font-style: normal; font-weight: 600; font-display: swap; src: url(/assets/fonts/source-serif-4-latin-600-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "JetBrains Mono"; font-style: normal; font-weight: 400; font-display: swap; src: url(/assets/fonts/jetbrains-mono-latin-400-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "JetBrains Mono"; font-style: normal; font-weight: 600; font-display: swap; src: url(/assets/fonts/jetbrains-mono-latin-600-normal.woff2) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
body.landing { --ui: "Atkinson Hyperlegible Next", system-ui, "Segoe UI", sans-serif; --display: "Source Serif 4", Georgia, serif; }
body.landing .landing-head h1, body.landing .lang-name { font-family: var(--display); font-weight: 600; }
</style>
</head>
<body class="landing">
<main class="landing-main">
  <header class="landing-head">
    <h1>Guija Playground</h1>
    <p class="muted">Mini-IDE local para aprender programación: ejecuta, mide la complejidad real de tu código y compáralo con la solución óptima.</p>
    <p class="landing-q">¿Con qué lenguaje quieres practicar?</p>
  </header>
  <div class="lang-cards" id="lang-cards">
<?php foreach ($cards as $i => [$id, $name, $logo, $a, $b, $desc]): ?>
    <a class="lang-card" href="/<?= $id ?>" data-lang="<?= $id ?>" style="--logo-a: <?= $a ?>; --logo-b: <?= $b ?>">
      <span class="lang-key" aria-hidden="true"><?= $i + 1 ?></span>
      <?php
              $logoFile = $logo === 'PY' ? 'PYTHON_LOGO.webp' :
                           ($logo === 'C++' ? 'cpp_LOGO.webp' : $logo . '_LOGO.webp');
          ?>
          <img src="<?= $v($logoFile) ?>" class="logo lang-logo">
      <span class="lang-name"><?= $name ?></span>
      <span class="lang-desc"><?= htmlspecialchars($desc, ENT_QUOTES, 'UTF-8') ?></span>
      <span class="lang-status" data-status>Comprobando qué hay instalado…</span>
      <span class="lang-missing" data-missing hidden></span>
      <span class="lang-last" data-last hidden>Último que usaste</span>
    </a>
<?php endforeach; ?>
  </div>
  <p class="muted landing-foot">Pulsa <kbd>1</kbd>, <kbd>2</kbd>, <kbd>3</kbd> o <kbd>4</kbd> para elegir. Desde el editor vuelves aquí haciendo clic en el logo.
    Todo se ejecuta en tu PC: el servidor solo escucha en 127.0.0.1.</p>
</main>
<script type="module" src="<?= $v('js/landing.js') ?>"></script>
</body>
</html>
