#!/usr/bin/env node
'use strict';
/**
 * Pruebas Node del formato de `fuentes` (assets/guias/fuentes.js) y de su validación en tests/guias-datos.js, sin navegador:
 *   node tests/guias/test-fuentes.js
 * Escape total, cursiva *…*, enlaces solo http/https (rel=noopener), puntuación final fuera del enlace, intentos de inyección.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..', '..');
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); n++; };

(async () => {
  const { fuenteHtml, esc } = await import(pathToFileURL(path.join(ROOT, 'assets/guias/fuentes.js')).href);

  eq(esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;', 'esc: los cinco caracteres');
  eq(fuenteHtml('Texto simple.'), 'Texto simple.', 'texto plano intacto');
  eq(fuenteHtml('Knuth, D. (1998). *The art of computer programming*. Addison-Wesley.'),
    'Knuth, D. (1998). <em>The art of computer programming</em>. Addison-Wesley.', 'cursiva APA');
  eq(fuenteHtml('A <b>negrita</b> & "comillas"'), 'A &lt;b&gt;negrita&lt;/b&gt; &amp; &quot;comillas&quot;', 'HTML escapado');

  const a = fuenteHtml('Autor. (2020). Título. https://example.org/a?x=1&y=2');
  eq(a, 'Autor. (2020). Título. <a href="https://example.org/a?x=1&amp;y=2" target="_blank" rel="noopener">https://example.org/a?x=1&amp;y=2</a>', 'enlace: & escapado en href y texto');
  eq(fuenteHtml('Ver https://example.org/guia.'), 'Ver <a href="https://example.org/guia" target="_blank" rel="noopener">https://example.org/guia</a>.', 'punto final fuera del enlace');
  eq(fuenteHtml('(https://example.org/x), y http://a.b/c;'),
    '(<a href="https://example.org/x" target="_blank" rel="noopener">https://example.org/x</a>), y <a href="http://a.b/c" target="_blank" rel="noopener">http://a.b/c</a>;', 'paréntesis y punto y coma fuera');
  eq(fuenteHtml('*En cursiva* y https://example.org/a_b_c_*d*'), '<em>En cursiva</em> y <a href="https://example.org/a_b_c_*d" target="_blank" rel="noopener">https://example.org/a_b_c_*d</a>*', 'asteriscos de la cola no abren cursiva dentro de la URL');
  eq((fuenteHtml('http://uno.org y https://dos.org').match(/<a /g) || []).length, 2, 'dos enlaces');
  eq(fuenteHtml('HTTPS://EXAMPLE.ORG/X').includes('<a href="HTTPS://EXAMPLE.ORG/X"'), true, 'esquema en mayúsculas también es http(s)');

  // Esquemas que NO se vuelven enlace
  for (const mal of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'ftp://example.org/x', 'file:///etc/passwd', '//example.org/x', 'vbscript:x']) {
    const h = fuenteHtml('Ref ' + mal);
    ok(!h.includes('<a '), `sin enlace para ${mal}`);
    ok(!/<script/i.test(h) && !h.includes('<s'), `sin etiquetas vivas en ${mal}`);
  }
  // Inyección dentro de una URL real
  const inj = fuenteHtml('https://example.org/"><img src=x onerror=alert(1)>');
  ok(!/<img/i.test(inj), 'la URL no puede cerrar el atributo ni abrir etiquetas');
  ok(!/"\s*onerror/i.test(inj), 'sin atributos inyectados');
  eq(fuenteHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;', 'etiqueta suelta escapada');
  eq(fuenteHtml(undefined), '', 'undefined → vacío');
  eq(fuenteHtml('https://'), 'https://', 'esquema sin host no es enlace');

  // Validador de datos: fuentes bien y mal formadas (guía temporal fuera de contenido/guias.json → se valida por id)
  const dir = path.join(ROOT, 'assets/guias/data'), id = 'zz-test-fuentes';
  const file = path.join(dir, id + '.js');
  const guia = fuentes => `export default { titulo: { es: 'a', en: 'a' }, ${fuentes === undefined ? '' : `fuentes: ${JSON.stringify(fuentes)},`}
    pasos: [{ sec: { es: 'a', en: 'a' }, celdas: [{ id: 'x', addr: '0x1', name: 'x', type: 'int' }], es: 'x', en: 'x', code: '' }] };`;
  const valida = fuentes => {
    fs.writeFileSync(file, guia(fuentes));
    try { execFileSync('node', [path.join(ROOT, 'tests/guias-datos.js'), id], { encoding: 'utf8', stdio: 'pipe' }); return ''; }
    catch (e) { return String(e.stdout); }
  };
  try {
    ok(!/fuentes/.test(valida(undefined)), 'sin fuentes: válido');
    ok(!/fuentes/.test(valida(['Una *ref* https://example.org'])), 'fuentes válidas');
    ok(/fuentes/.test(valida([])), 'lista vacía: error');
    ok(/fuentes/.test(valida('texto')), 'no es lista: error');
    ok(/fuentes\[1\]/.test(valida(['ok', '  '])), 'cadena vacía: error');
    ok(/fuentes\[0\]/.test(valida([5])), 'no es cadena: error');
    ok(/fuentes\[0\].*601/.test(valida(['x'.repeat(601)])), '601 caracteres: error');
    ok(!/fuentes/.test(valida(['x'.repeat(600)])), '600 caracteres: válido');
  } finally { fs.rmSync(file, { force: true }); }
  console.log(`✓ test-fuentes: ${n} comprobaciones`);
})().catch(e => { console.error(e); process.exitCode = 1; });
