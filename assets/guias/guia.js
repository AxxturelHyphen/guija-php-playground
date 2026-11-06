// Reproductor de una guía: pasos con texto, código, escena, bloque interactivo, trazas reproducibles y preguntas.
// Un paso es un parche sobre el estado anterior (formato en data/punteros.js). El estado en el paso n se obtiene
// plegando 0..n, así saltar a cualquier paso (barra, #hash) es trivial.
//
// CONTRATO DE ESCENA. Cada tipo de escena es un módulo ES (escena.js = «celdas», barras.js, arbol.js, grafica.js):
//   export const clave = 'barras'            clave de paso que ABRE una escena de este tipo (p.ej. `barras: {...}`)
//   export function plegar(s, p)             estado nuevo = estado previo `s` + parche `p` (paso o frame). PURA: no
//                                            muta `s`. Si `p[clave]` existe devuelve un estado nuevo (s ignorado).
//                                            El estado es un objeto con `def` (identidad estable mientras no se abra
//                                            otra escena: sirve para saber si hay que reconstruir) y el resto mutable.
//   export function crear(stage, viewport)   → objeto con:
//        fijar(def)           (re)construye si `def` cambió; puede dejar un elemento con transición
//        pintar(S, animar)    S = estado + `hl` (énfasis del paso); animar = false | true | milisegundos
//        tam                  getter {W, H}: tamaño lógico en px; guia.js escala y centra el `stage` (no lo hagas tú)
//        arrastre?(ids, cb)   opcional, para `jugar.arrastrables`
//   export const vista(S), conVista(S, v), ctx(S)   (opcionales) para `jugar`: `v` = copia mutable que ven los
//        botones; conVista la devuelve a estado pintable; ctx = segundo argumento de hacer/lecturas.
// Un paso con `traza: [frames]` se reproduce con mini-controles: cada frame es un parche de la misma escena (más
// `line`, `es`/`en` como subtítulo). Los pasos con otra clave de escena la sustituyen; las anteriores se conservan.
// LEYENDA (opcional, solo en ese paso): `leyenda: ['activo', 'compara', 'hecho', 'mal', 'camino', 'aux']` (subconjunto, en este
// orden o el que se quiera) pinta chips bajo la escena con el código de color semántico común (tokens --g-* de guia.css):
// activo = en uso/foco · compara = comparando/leyendo · hecho = terminado/ordenado · mal = error/fantasma/conflicto ·
// camino = ruta/solución · aux = auxiliar/secundario. Cada chip lleva la misma forma de borde que el estado en la escena.
// Sin `leyenda` no se pinta nada; el resto del formato no cambia. Las claves se validan en tests/guias-datos.js.
// FUENTES (opcional, a nivel de guía, junto a `titulo` y `pasos`): `fuentes: ['Autor, A. (2020). *Título*. Editorial. https://…', …]`,
// cadenas APA 7 no vacías de ≤ 600 caracteres. Se pintan al final del panel izquierdo en un <details class="fuentes"> plegado
// («Fuentes y recursos» / «Sources and resources»). *…* = cursiva; las URL http(s) se vuelven enlaces (target=_blank,
// rel=noopener); todo se escapa (fuentes.js). Sin `fuentes` no se pinta nada.
import { idioma, iniciarIdioma } from './idioma.js';
import { resaltar } from './cpp.js';
import { fuenteHtml } from './fuentes.js';

const MODS = { celdas: () => import('./escena.js'), barras: () => import('./barras.js'), arbol: () => import('./arbol.js'), grafica: () => import('./grafica.js'), tabla: () => import('./tabla.js'), funcion: () => import('./funcion.js'), campo: () => import('./campo.js') };
const UI = {
  es: { paso: 'Paso', ok: 'Correcto.', no: 'No exactamente.', jugar: 'Pruébalo tú', traza: 'Traza paso a paso', ant: 'Anterior', sig: 'Siguiente', play: 'Reproducir', pausa: 'Pausa', atras: 'Frame anterior', adel: 'Frame siguiente', ini: 'Al principio', vel: 'Velocidad' },
  en: { paso: 'Step', ok: 'Correct.', no: 'Not quite.', jugar: 'Try it yourself', traza: 'Step-by-step trace', ant: 'Previous', sig: 'Next', play: 'Play', pausa: 'Pause', atras: 'Previous frame', adel: 'Next frame', ini: 'Restart', vel: 'Speed' },
};
// Etiquetas de la leyenda (textos estáticos bilingües, como UI)
const LEY = {
  activo: { es: 'En uso', en: 'In use' }, compara: { es: 'Comparando', en: 'Comparing' }, hecho: { es: 'Hecho', en: 'Done' },
  mal: { es: 'Error', en: 'Error' }, camino: { es: 'Camino', en: 'Path' }, aux: { es: 'Auxiliar', en: 'Auxiliary' },
};
const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const L = x => (x && typeof x === 'object' && 'es' in x ? x[idioma()] : x) ?? '';
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
// Texto del paso → HTML seguro. Código y fórmulas se apartan antes de aplicar negrita/cursiva (llevan `*` y `_`).
const fmt = s => {
  const guardado = [];
  const aparta = h => { guardado.push(h); return `\u0000${guardado.length - 1}\u0000`; };
  return String(s).replace(/[&<>"]/g, c => ESC[c])
    .replace(/`([^`]+)`/g, (_, c) => aparta(`<code>${c}</code>`))
    .replace(/\$([^$]+)\$/g, (_, t) => aparta(`<span class="tex" data-tex="${t}">${t}</span>`))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => guardado[i]);
};

// KaTeX (cdnjs) solo se descarga la primera vez que un texto lleva fórmulas
const KATEX = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/';
let katex;
const cargarKatex = () => katex ??= new Promise((ok, ko) => {
  document.head.append(Object.assign(el('link'), { rel: 'stylesheet', href: KATEX + 'katex.min.css' }));
  document.head.append(Object.assign(el('script'), { src: KATEX + 'katex.min.js', onload: () => ok(window.katex), onerror: ko }));
});
const tex = root => {
  const xs = root.querySelectorAll('.tex');
  if (xs.length) cargarKatex().then(k => xs.forEach(x => k.render(x.dataset.tex, x, { throwOnError: false }))).catch(() => {});
};
const aparecer = e => { if (!REDUCIDO) e.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); };

const G = (await import(`./data/${document.body.dataset.guia}.js`)).default;
const pasos = G.pasos;
// Solo se descargan los módulos de escena que la guía usa
const claves = [...new Set(pasos.flatMap(p => Object.keys(p).filter(k => k in MODS)))];
const mods = Object.fromEntries(await Promise.all(claves.map(async k => [k, await MODS[k]()])));
const viewport = $('viewport'), escenas = {};
// Fila de leyenda: solo existe si algún paso la usa, y entonces reserva su alto para que la escena no cambie de escala
const ley = pasos.some(p => p.leyenda) ? el('div', 'ley') : null;
if (ley) viewport.after(ley);
// Bibliografía opcional: el <details> viene oculto en la plantilla y solo se muestra si la guía trae `fuentes`
const fuentes = $('fuentes');
if (fuentes && G.fuentes?.length) {
  fuentes.querySelector('ol').replaceChildren(...G.fuentes.map(s => { const li = el('li'); li.innerHTML = fuenteHtml(s); return li; }));
  fuentes.hidden = false;
}
const pintarLeyenda = ks => ley?.replaceChildren(...(ks || []).filter(k => k in LEY).map(k => { const c = el('span', 'ley-' + k); c.append(el('i'), L(LEY[k])); return c; }));
let n = -1, claveCodigo = null, activo = null, repro = 0;

function escenaDe(k) {
  if (!escenas[k]) {
    const stage = el('div', 'stage off'); stage.dataset.escena = k; viewport.append(stage);
    escenas[k] = { stage, sc: mods[k].crear(stage, viewport) };
  }
  return escenas[k];
}
function activar(k) {
  for (const [c, e] of Object.entries(escenas)) e.stage.classList.toggle('off', c !== k);
  activo = escenaDe(k); activo.stage.classList.remove('off');
  return activo;
}
// Escala y centra la escena activa: en pantalla ancha llena el panel; apilado (móvil) el alto sale de la escena
function encajar() {
  if (!activo) return;
  const { W, H } = activo.sc.tam, w = viewport.clientWidth;
  if (!W || !w) return;
  const apilado = matchMedia('(max-width: 900px)').matches;
  if (apilado) viewport.style.height = '';
  const h = apilado ? Infinity : viewport.clientHeight, s = Math.min(1.5, w / W, (h - 24) / H);
  const st = activo.stage.style;
  st.width = W + 'px'; st.height = H + 'px'; st.transform = `scale(${s})`;
  st.left = (w - W * s) / 2 + 'px'; st.top = (apilado ? 0 : (h - H * s) / 2) + 'px';
  if (apilado) viewport.style.height = H * s + 'px';
}
new ResizeObserver(encajar).observe(viewport);

const aperturas = new WeakMap();
function estadoEn(k) {
  let tipo = null, code = '', line = null, sec = null;
  const S = {};
  for (let i = 0; i <= k; i++) {
    const p = pasos[i], nuevo = claves.find(c => p[c] !== undefined);
    if (nuevo) {
      // El estado de apertura se guarda por paso: así `def` conserva su identidad entre pasos y la escena anima en vez de reconstruirse
      if (!aperturas.has(p)) aperturas.set(p, mods[nuevo].plegar(undefined, p));
      tipo = nuevo; S[tipo] = aperturas.get(p);
    }
    else if (tipo) S[tipo] = mods[tipo].plegar(S[tipo], p);
    if (p.code !== undefined) code = p.code;
    if (p.line !== undefined) line = p.line;
    if (p.sec) sec = p.sec;
  }
  return { tipo, S: tipo && S[tipo], code, line, sec };
}

function pintarCodigo(code, line) {
  const src = L(code), pre = $('codigo');
  pre.hidden = !src;
  if (src !== claveCodigo) {
    claveCodigo = src;
    pre.replaceChildren(el('div', 'barra-linea'));
    pre.insertAdjacentHTML('beforeend', src.split('\n').map((l, i) => `<div class="ln"><i>${i + 1}</i><span>${resaltar(l)}</span></div>`).join(''));
    if (n >= 0) aparecer(pre);
  }
  const b = pre.firstChild;
  b.style.opacity = line == null ? 0 : 1;
  if (line != null) b.style.transform = `translateY(${(line - 1) * 24}px)`;
}

function jugar(p, S, tipo, caja) {
  const J = p.jugar, mod = mods[tipo], sc = activo.sc, cx = mod.ctx ? mod.ctx(S) : {}, v = mod.vista(S);
  const fila = el('div', 'botones'), tabla = el('div', 'lect');
  const btns = J.botones.map(d => {
    const b = el('button', 'btn mono', L(d.label));
    b.onclick = () => { d.hacer(v, cx); refrescar(); };
    fila.append(b); return [b, d];
  });
  const refrescar = () => {
    sc.pintar({ ...mod.conVista(S, v), hl: J.hl ? J.hl(v, cx) : p.hl }, true);
    for (const [b, d] of btns) b.disabled = !!(d.off && d.off(v, cx));
    tabla.replaceChildren(...J.lecturas(v, cx).map(r => {
      const f = el('div', 'fila' + (r.malo ? ' malo' : ''));
      f.append(el('span', 'expr', r.expr && typeof r.expr === 'object' ? r.expr[idioma()] : r.expr), el('span', 'res', String(r.valor)));
      return f;
    }));
  };
  caja.append(el('p', 'sub', UI[idioma()].jugar), fila, tabla);
  if (J.arrastrables && sc.arrastre) sc.arrastre(J.arrastrables, (...args) => { J.soltar(v, ...args, cx); refrescar(); }); // soltar(v, …args del módulo, ctx)
  refrescar();
}

// Reproductor de trazas: frames = parches acumulativos sobre el estado del paso. pos 0 = estado inicial del paso.
function traza(p, S0, line0, tipo, caja) {
  const mod = mods[tipo], sc = activo.sc, u = UI[idioma()], N = p.traza.length;
  const estados = [S0], lineas = [line0];
  p.traza.forEach(f => { estados.push(mod.plegar(estados.at(-1), f)); lineas.push(f.line !== undefined ? f.line : lineas.at(-1)); });
  let pos = 0, vel = 1, pausa = null;
  const boton = (txt, tit) => { const b = el('button', 'btn', txt); b.title = tit; return b; };
  const bIni = boton('⏮', u.ini), bAtr = boton('◀', u.atras), bPlay = boton('▶', u.play), bAdel = boton('▶|', u.adel);
  const sel = el('select', 'vel'); sel.title = u.vel;
  for (const x of [.5, 1, 2, 4, 8]) sel.append(Object.assign(el('option', '', x + '×'), { value: x, selected: x === 1 }));
  const barra = Object.assign(el('input'), { type: 'range', min: 0, max: N, value: 0 });
  const subt = el('p', 'subt');
  const fila = el('div', 'repro'); fila.append(bIni, bAtr, bPlay, bAdel, sel, barra);
  caja.append(el('p', 'sub', u.traza), fila, subt);
  const mostrar = (i, ms) => {
    pos = Math.max(0, Math.min(N, i)); barra.value = pos;
    sc.pintar({ ...estados[pos], hl: pos ? undefined : p.hl }, REDUCIDO ? false : ms);
    pintarCodigo(estadoCodigo, lineas[pos]);
    const f = p.traza[pos - 1], t = f && f[idioma()];
    subt.innerHTML = t ? fmt(t) : ''; tex(subt);
    bPlay.textContent = repro ? '⏸' : '▶'; bPlay.title = repro ? u.pausa : u.play;
    bIni.disabled = bAtr.disabled = pos === 0; bAdel.disabled = pos === N;
  };
  const parar = () => { clearTimeout(repro); repro = 0; };
  const paso = () => {
    if (pos >= N) { parar(); mostrar(pos, 0); return; }
    const ms = 650 / vel;
    repro = setTimeout(paso, ms); mostrar(pos + 1, Math.min(520, ms * .85));
  };
  bPlay.onclick = () => { if (repro) { parar(); mostrar(pos, 0); } else { if (pos >= N) mostrar(0, 0); paso(); } };
  bAdel.onclick = () => { parar(); mostrar(pos + 1, 300); };
  bAtr.onclick = () => { parar(); mostrar(pos - 1, 300); };
  bIni.onclick = () => { parar(); mostrar(0, 300); };
  sel.onchange = () => { vel = +sel.value; };
  barra.oninput = () => { parar(); mostrar(+barra.value, 0); };
  mostrar(0, true);
}
let estadoCodigo = '';

function pregunta(q, caja) {
  const fb = el('p', 'why'); fb.hidden = true;
  for (const o of q.opc) {
    const b = el('button', 'opc'); b.innerHTML = fmt(L(o)); if (o.ok) b.dataset.ok = 1;
    b.onclick = () => {
      caja.querySelectorAll('.opc').forEach(x => { x.disabled = true; });
      b.classList.add(o.ok ? 'ok' : 'no');
      if (!o.ok) caja.querySelector('.opc[data-ok]').classList.add('ok');
      fb.hidden = false; fb.innerHTML = `<strong>${UI[idioma()][o.ok ? 'ok' : 'no']}</strong> ${fmt(L(q.why))}`; tex(fb); aparecer(fb);
    };
    caja.append(b);
  }
  caja.append(fb);
}

function ir(k) {
  clearTimeout(repro); repro = 0;
  const previo = n, i = Math.max(0, Math.min(pasos.length - 1, k)), p = pasos[i], { tipo, S, code, line, sec } = estadoEn(i), u = UI[idioma()];
  n = i; estadoCodigo = code;
  document.title = `${L(G.titulo)} · Guija`;
  $('meta').replaceChildren(...(sec ? [el('span', 'sec', L(sec)), ' · '] : []), `${u.paso} ${i + 1} / ${pasos.length}`);
  const t = $('texto'); t.innerHTML = fmt(p[idioma()]); tex(t);
  if (previo !== i) aparecer(t);
  pintarLeyenda(p.leyenda);
  pintarCodigo(code, line);
  if (tipo) { const e = activar(tipo); e.sc.fijar(S.def); e.sc.arrastre?.(null); encajar(); }
  const caja = $('jugar'); caja.replaceChildren(); caja.hidden = !(p.jugar || p.pregunta || p.traza);
  if (p.jugar) jugar(p, S, tipo, caja);
  else if (p.traza) traza(p, S, line, tipo, caja);
  else if (tipo) activo.sc.pintar({ ...S, hl: p.hl }, previo >= 0);
  if (p.pregunta) pregunta(p.pregunta, caja);
  [...$('pista').children].forEach((b, j) => { b.className = (pasos[j].sec ? 'ini ' : '') + (j < i ? 'hecho' : j === i ? 'act' : ''); b.setAttribute('aria-current', j === i); });
  $('ant').disabled = i === 0; $('sig').disabled = i === pasos.length - 1;
  $('ant').title = u.ant; $('sig').title = u.sig;
  history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1));
}

$('pista').replaceChildren(...pasos.map((_, j) => { const b = el('button'); b.onclick = () => ir(j); b.setAttribute('aria-label', String(j + 1)); return b; }));
$('ant').onclick = () => ir(n - 1);
$('sig').onclick = () => ir(n + 1);
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: pasos.length - 1 }[e.key] ?? (e.key === ' ' && e.target === document.body ? n + 1 : null);
  if (k != null) { e.preventDefault(); ir(k); }
});
document.addEventListener('idioma', () => { claveCodigo = null; ir(n); });
iniciarIdioma();
ir((parseInt(location.hash.slice(1), 10) || 1) - 1);
document.body.classList.add('listo');
