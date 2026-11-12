<?php
declare(strict_types=1);

defined('PG_ROOT') or exit;

/** @var \Playground\Core\Language $pgLang  lo fija index.php según la URL (/php, /python, /java, /cpp) */
$langId = $pgLang->id();
$langName = $pgLang->name();
// Marca de cada lenguaje: texto del logo, degradado y color del icono de archivo
[$logo, $colA, $colB, $icon] = [
    'php' => ['PHP', '#8892BF', '#4F5B93', '#7A86B8'],
    'python' => ['PY', '#4B8BBE', '#306998', '#4B8BBE'],
    'java' => ['JAVA', '#E76F00', '#5382A1', '#C77B3A'],
    'cpp' => ['C++', '#00599C', '#004482', '#3A7CC0'],
][$langId];
$h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');

// Versión de los assets en la URL: al editar un archivo el navegador no se queda con el viejo.
$v = static fn(string $rel): string => pg_asset($rel);
// Misma base que MONACO en assets/js/monaco-setup.js: se precargan loader y editor.main para que bajen mientras arrancan los módulos
$monaco = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min';
$favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='" . rawurlencode($colB)
    . "'/%3E%3Ctext x='16' y='21' font-family='monospace' font-size='" . (strlen($logo) > 3 ? '10' : '13') . "' font-weight='700' text-anchor='middle' fill='white'%3E{$logo}%3C/text%3E%3C/svg%3E";
?>
<!doctype html>
<html lang="es" data-lang="<?= $h($langId) ?>" style="--logo-a: <?= $colA ?>; --logo-b: <?= $colB ?>; --file-icon: <?= $icon ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guija <?= $h($langName) ?> Playground</title>
<link rel="icon" href="<?= $favicon ?>">
<link rel="preconnect" href="https://cdnjs.cloudflare.com">
<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
<link rel="preload" href="<?= $monaco ?>/vs/loader.min.js" as="script">
<link rel="preload" href="<?= $monaco ?>/vs/editor/editor.main.js" as="script">
<link rel="preload" href="<?= $v('fonts/inter-latin-wght-normal.woff2') ?>" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="<?= $v('fonts/jetbrains-mono-latin-400-normal.woff2') ?>" as="font" type="font/woff2" crossorigin>
<style>
/* Tipografía autoalojada (OFL, ver assets/fonts/LICENSES.txt): sin peticiones externas que bloqueen el primer pintado */
@font-face { font-family: Inter; font-style: normal; font-weight: 100 900; font-display: swap; src: url(<?= $v('fonts/inter-latin-wght-normal.woff2') ?>) format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-style: normal; font-weight: 400; font-display: swap; src: url(<?= $v('fonts/jetbrains-mono-latin-400-normal.woff2') ?>) format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-style: normal; font-weight: 600 700; font-display: swap; src: url(<?= $v('fonts/jetbrains-mono-latin-600-normal.woff2') ?>) format("woff2"); }
</style>
<link rel="stylesheet" href="<?= $v('css/app.css') ?>">
<?= pg_cabecera_modulos('js/main.js') ?>
<script>
// «Sin distracciones» recordado: se aplica antes del primer pintado para que no haya salto de diseño al cargar
try { if (localStorage.getItem('pg:zen') === '1') document.documentElement.classList.add('zen'); } catch (e) { /* sin almacenamiento */ }
// Monaco cancela promesas internas al cambiar de modelo y las deja sin capturar: ruido inofensivo.
// Se registra aquí, antes que cualquier módulo, para que no se escape ninguna.
addEventListener('unhandledrejection', e => { if (e.reason && (e.reason.name === 'Canceled' || e.reason.message === 'Canceled')) e.preventDefault(); });
</script>
</head>
<body>
<header class="topbar">
  <button id="btn-sidebar" class="btn btn-icon" title="Proyecto (Alt+1)" aria-label="Mostrar u ocultar el panel Proyecto">
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.5h13M1.5 8h13M1.5 12.5h13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
  </button>
  <a class="brand" href="/" title="Cambiar de lenguaje (PHP, Python, Java, C++)"><span class="logo"><?= $h($logo) ?></span><span class="brand-name">Guija <?= $h($langName) ?> Playground</span></a>
  <span class="pill" id="php-version"><?= $h($langName) ?></span>
  <div id="sesion" class="sesion" role="group" aria-label="Sesión de estudio">
    <select id="ses-dur" class="sel hide-sm" aria-label="Duración de la sesión"><option value="10">10 min</option><option value="15">15 min</option><option value="25" selected>25 min</option></select>
    <span id="ses-time" class="ses-time" role="timer" aria-live="off">25:00</span>
    <button id="ses-go" class="btn btn-sm ses-go" type="button">Empezar</button>
    <button id="ses-stop" class="btn btn-sm btn-icon ses-stop off" type="button" title="Parar la sesión" aria-label="Parar la sesión" tabindex="-1" aria-hidden="true">■</button>
    <div id="ses-aviso" class="pop ses-aviso" role="status" hidden>
      <p class="ses-aviso-t"></p>
      <p class="ses-aviso-d muted"></p>
      <button id="ses-ok" class="btn btn-primary btn-sm" type="button">Vale, descanso</button>
    </div>
  </div>
  <div class="spacer"></div>

  <label class="select-wrap hide-sm" title="Tiempo máximo de ejecución">
    <span class="muted">Límite</span>
    <select id="timeout" aria-label="Tiempo máximo de ejecución">
      <option value="5">5 s</option><option value="10">10 s</option><option value="30">30 s</option>
    </select>
  </label>
  <button id="btn-save" class="btn" title="Guardar en practicas/<?= $h($langId) ?>/ (Ctrl+S)">
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 2.5h9l2 2v9h-11z M5 2.5v4h5v-4 M5 13.5v-4h6v4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    <span class="hide-md">Guardar</span>
  </button>
  <button id="btn-measure" class="btn" title="Ejecutar y medir con medir() (Ctrl+Alt+Enter)">
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 13.5V9m4 4.5V5m4 8.5V7.5m4 6V2.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>
    <span class="hide-md">Medir</span>
  </button>
  <button id="btn-compare" class="btn" title="Comparar tu rendimiento con la solución de referencia (Ctrl+Shift+Enter)" disabled>
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l-2 3 2 3M13 7l2 3-2 3M1 6h9M15 10H6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
    <span class="hide-md">Comparar</span>
  </button>
  <button id="btn-run" class="btn btn-run" title="Ejecutar (Ctrl+Enter)">
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.2v9.6L10.5 6z" fill="currentColor"/></svg>
    <span id="run-label">Ejecutar</span>
    <span class="hide-sm"><kbd>Ctrl</kbd> <kbd>↵</kbd></span>
  </button>
<?php if ($langId === 'cpp'): ?>
  <a id="btn-guias" class="btn" href="/guias" target="_blank" rel="noopener" title="Guías visuales: punteros, memoria, STL… (se abren en otra pestaña)">
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3c2-.8 4-.8 5.5.7 1.500-1.500 3.500-1.500 5.500-.7v9.500c-2-.8-4-.8-5.500.7-1.500-1.500-3.500-1.500-5.500-.7zM8 3.700v9.500" fill="none" stroke="currentColor" stroke-width="1.300" stroke-linejoin="round"/></svg>
    <span class="hide-md">Guías</span>
  </a>
<?php endif; ?>
  <div class="pop-wrap">
    <button id="btn-ideas" class="btn btn-sm" type="button" title="Aparcar una idea y seguir con el ejercicio (Alt+I)" aria-haspopup="dialog" aria-expanded="false" aria-controls="ideas-pop">Ideas <span id="ideas-n" class="count" hidden></span></button>
    <div id="ideas-pop" class="pop ideas-pop" role="dialog" aria-label="Aparcar idea" hidden>
      <input id="ideas-in" type="text" maxlength="500" autocomplete="off" placeholder="Anota la idea y sigue (Intro)" aria-label="Idea para aparcar">
      <ul id="ideas-list" class="ideas-list"></ul>
      <p class="muted ideas-pie">Una lista por lección, guardada en este navegador. Esc cierra.</p>
    </div>
  </div>
  <button id="btn-zen" class="btn btn-icon" type="button" title="Sin distracciones: oculta el proyecto y los resultados (Alt+Q)" aria-label="Sin distracciones" aria-pressed="false">
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <button id="btn-settings" class="btn btn-icon" title="Ajustes" aria-label="Ajustes">
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
  </button>
  <button id="btn-help" class="btn btn-icon" title="Ayuda y atajos (F1)" aria-label="Ayuda">
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.2 6.3a1.9 1.9 0 1 1 2.7 1.7c-.6.3-.9.7-.9 1.3M8 11.5v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>
  </button>
</header>

<div id="workspace" class="workspace">
  <aside id="sidebar" class="island sidebar" aria-label="Proyecto">
    <div class="island-head">
      <span class="island-title">Proyecto</span>
      <div class="spacer"></div>
      <button id="btn-new" class="btn btn-sm" title="Nuevo archivo en practicas/<?= $h($langId) ?>/">+ Nuevo</button>
    </div>
    <div id="siguiente" class="sig"></div>
    <nav id="tree" class="tree" aria-label="Archivos" aria-busy="true">
      <div class="skel skel-tree" aria-hidden="true"><i style="--w:34%"></i><i style="--w:72%"></i><i style="--w:58%"></i><i style="--w:66%"></i><i style="--w:30%"></i><i style="--w:62%"></i><i style="--w:48%"></i></div>
    </nav>
  </aside>
  <div id="gutter-side" class="gutter gutter-v" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Ancho del panel Proyecto" aria-controls="sidebar" aria-valuemin="160" aria-valuemax="520" aria-valuenow="250" title="Arrastra o usa las flechas (Mayús = paso grande)"></div>

  <div class="main-col" id="main-col">
    <section id="editor-island" class="island editor-island" aria-label="Editor">
      <div class="island-head tabs-head">
        <div id="tabs" class="tabs" role="tablist" aria-label="Archivos abiertos"></div>
        <div class="spacer"></div>
        <label id="ej-wrap" class="select-wrap" title="Enfoca un ejercicio: solo verás sus pruebas y el editor te lleva a su función" hidden>
          <span class="muted hide-sm">Ejercicio</span>
          <select id="ej-select" aria-label="Ejercicio en foco"></select>
        </label>
        <button id="btn-restore" class="btn btn-sm" title="Volver a la versión original del ejemplo" hidden>Restaurar</button>
      </div>
      <div id="editor" class="editor" role="tabpanel" aria-label="Código" aria-busy="true">
        <div class="skel skel-editor" aria-hidden="true"><i style="--w:38%"></i><i style="--w:24%"></i><i style="--w:58%"></i><i style="--w:46%"></i><i style="--w:30%"></i><i style="--w:64%"></i><i style="--w:52%"></i><i style="--w:20%"></i><i style="--w:42%"></i><i style="--w:56%"></i><i style="--w:34%"></i><i style="--w:26%"></i></div>
        <span class="sr-only" role="status">Cargando editor…</span>
      </div>
      <div id="editor-banner" class="banner" hidden></div>
    </section>

    <div id="gutter-tool" class="gutter gutter-h" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="Alto de la ventana de resultados" aria-controls="tool-island" aria-valuemin="120" aria-valuemax="600" aria-valuenow="300" title="Arrastra o usa las flechas (Mayús = paso grande)"></div>

    <section id="tool-island" class="island tool-island" aria-label="Resultados">
      <div class="island-head tool-head">
        <div id="tool-tabs" class="tool-tabs" role="tablist" aria-label="Ventanas de herramientas">
          <button role="tab" id="tab-salida" data-panel="salida" class="tool-tab active" aria-selected="true" aria-controls="panel-salida" tabindex="0">Salida</button>
          <button role="tab" id="tab-problemas" data-panel="problemas" class="tool-tab" aria-selected="false" aria-controls="panel-problemas" tabindex="-1">Problemas <span class="count" data-count="problemas" hidden></span></button>
          <button role="tab" id="tab-pruebas" data-panel="pruebas" class="tool-tab" aria-selected="false" aria-controls="panel-pruebas" tabindex="-1">Pruebas <span class="count" data-count="pruebas" hidden></span></button>
          <button role="tab" id="tab-analisis" data-panel="analisis" class="tool-tab" aria-selected="false" aria-controls="panel-analisis" tabindex="-1">Análisis <span class="count" data-count="analisis" hidden></span></button>
          <button role="tab" id="tab-solucion" data-panel="solucion" class="tool-tab" aria-selected="false" aria-controls="panel-solucion" tabindex="-1" hidden>Solución</button>
        </div>
        <div class="spacer"></div>
        <div id="run-meta" class="meta"></div>
        <button id="btn-clear" class="btn btn-sm" title="Limpiar resultados">Limpiar</button>
      </div>
      <div id="panels" class="panels">
        <div class="panel" id="panel-salida" role="tabpanel" aria-labelledby="tab-salida" tabindex="-1"></div>
        <div class="panel" id="panel-problemas" role="tabpanel" aria-labelledby="tab-problemas" tabindex="-1" hidden></div>
        <div class="panel" id="panel-pruebas" role="tabpanel" aria-labelledby="tab-pruebas" tabindex="-1" hidden></div>
        <div class="panel" id="panel-analisis" role="tabpanel" aria-labelledby="tab-analisis" tabindex="-1" hidden></div>
        <div class="panel" id="panel-solucion" role="tabpanel" aria-labelledby="tab-solucion" tabindex="-1" hidden></div>
      </div>
    </section>
  </div>
</div>

<footer class="statusbar" id="statusbar" role="status">
  <span id="st-lint" class="st-item" title="Estado del análisis"><i class="dot"></i><span>Listo</span></span>
  <span id="st-fn" class="st-item st-link" title="Función actual y su complejidad ciclomática" hidden></span>
  <span id="ses-meta" class="st-item ses-meta" title="Meta de hoy">○ 1 ejercicio hoy</span>
  <button id="st-test" class="st-item st-link" type="button" title="Resultado de las pruebas (abre el panel)" hidden></button>
  <div class="spacer"></div>
  <span id="st-save" class="st-item"></span>
  <span id="st-pos" class="st-item">Ln 1, Col 1</span>
  <span class="st-item hide-sm">UTF-8</span>
  <span class="st-item hide-sm" id="st-php"><?= $h($langName) ?></span>
</footer>

<div id="toasts" class="toasts" aria-live="polite"></div>
<div id="modal-root"></div>

<script type="module" src="<?= $v('js/main.js') ?>"></script>
</body>
</html>
