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
import { fmt, iniciarKatex } from './mates.js'; // fórmulas y texto con formato (KaTeX local); lo comparten las escenas
import { REDUCIDO } from './movimiento.js'; // movimiento reducido: valor vivo único (sigue al media query)
import { nuevo as estadoNuevo, tipoDe, elegir, pistaDe, predecir, corregir, razonar, pedirPista, pistaPedida, guardado, desdeGuardado, puntuacion } from './respuestas.js'; // máquina de estados pura de preguntas y derivas

// ── GANCHOS DE PROGRESO ────────────────────────────────────────────────────────────────────────────────────────────────
// Punto de enganche con el almacenamiento de progreso. HOY son nulos (todo vive en memoria durante la visita); una tarea posterior
// los conectará a assets/js/progreso.js (guiaRespuesta(id, paso, opcion, ok) · guiaEstado(id)) SIN tocar el resto de este archivo.
// NO importar progreso.js aquí todavía. `paso` es siempre el ÍNDICE del paso (base 0).
//   alResponder(paso, opcion, ok, intentos)  se llama UNA vez al terminar una pregunta o deriva. opcion: índice de la opción final
//                                            (pregunta) | [predicción, razón] (deriva); ok: acertada (en el intento que sea) |
//                                            predicción y razón correctas; intentos: nº de elecciones hasta terminar (deriva: 1).
//   estadoInicial()                          → {paso, resp} guardado de esta guía, o null. paso = índice donde retomar (se ignora si hay
//                                            #hash); resp = {[paso]: {opcion, ok, intentos}} (mismo formato que alResponder).
export function alResponder(paso, opcion, ok, intentos) { /* sin almacenamiento todavía */ }
export function estadoInicial() { return null; }
// ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const MODS = { celdas: () => import('./escena.js'), barras: () => import('./barras.js'), arbol: () => import('./arbol.js'), grafica: () => import('./grafica.js'), tabla: () => import('./tabla.js'), funcion: () => import('./funcion.js'), campo: () => import('./campo.js') };
const UI = {
  es: { paso: 'Paso', ok: 'Correcto.', no: 'No exactamente.', jugar: 'Pruébalo tú', traza: 'Traza paso a paso', ant: 'Anterior', sig: 'Siguiente', play: 'Reproducir', pausa: 'Pausa', atras: 'Frame anterior', adel: 'Frame siguiente', ini: 'Al principio', vel: 'Velocidad', pos: 'Posición en la traza',
    predice: 'Predice antes de mirar', porque: '¿Por qué?', contraste: 'Contraste', tuPred: 'Tu predicción', tuRazon: 'Tu razón', cambiar: 'Cambiar', pista: 'Pista', buena: 'Correcta', bien: 'Predicción y razón correctas.', razonOtra: 'Predicción correcta, pero la razón era otra.', mal: 'La predicción no era esa.', ahoraRazon: 'Ahora elige la razón.', puntos: (a, b) => `Aciertos a la primera: ${a} de ${b}` },
  en: { paso: 'Step', ok: 'Correct.', no: 'Not quite.', jugar: 'Try it yourself', traza: 'Step-by-step trace', ant: 'Previous', sig: 'Next', play: 'Play', pausa: 'Pause', atras: 'Previous frame', adel: 'Next frame', ini: 'Restart', vel: 'Speed', pos: 'Trace position',
    predice: 'Predict before you look', porque: 'Why?', contraste: 'Contrast', tuPred: 'Your prediction', tuRazon: 'Your reason', cambiar: 'Change', pista: 'Hint', buena: 'Correct', bien: 'Prediction and reason both correct.', razonOtra: 'Right prediction, but the reason was different.', mal: 'That was not the prediction.', ahoraRazon: 'Now pick the reason.', puntos: (a, b) => `First-try correct: ${a} of ${b}` },
};
// Etiquetas de la leyenda (textos estáticos bilingües, como UI)
const LEY = {
  activo: { es: 'En uso', en: 'In use' }, compara: { es: 'Comparando', en: 'Comparing' }, hecho: { es: 'Hecho', en: 'Done' },
  mal: { es: 'Error', en: 'Error' }, camino: { es: 'Camino', en: 'Path' }, aux: { es: 'Auxiliar', en: 'Auxiliary' },
};
const $ = id => document.getElementById(id);
const L = x => (x && typeof x === 'object' && 'es' in x ? x[idioma()] : x) ?? '';
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const aparecer = e => { if (!REDUCIDO) e.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' }); };

const G = (await import(`./data/${document.body.dataset.guia}.js`)).default;
const pasos = G.pasos;
// Solo se descargan los módulos de escena que la guía usa
const claves = [...new Set(pasos.flatMap(p => Object.keys(p).filter(k => k in MODS)))];
// KaTeX solo si algún texto, pregunta o lectura lleva `$…$` (las funciones se miran por su código fuente; `${` no cuenta)
const usaMates = (() => { try { return /\$(?!\{)/.test(JSON.stringify(G, (_, v) => typeof v === 'function' ? v.toString() : v)); } catch { return true; } })();
const cargaKatex = usaMates ? iniciarKatex() : null;
const mods = Object.fromEntries(await Promise.all(claves.map(async k => [k, await MODS[k]()])));
await cargaKatex;
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
// Estado transitorio del bloque interactivo del paso actual ({v: valores de `jugar`, pos/vel: traza}); sobrevive al cambio de idioma
let memo = {};
// Respuestas de esta visita: índice de paso → estado de respuestas.js (en curso o terminado). Sobreviven a revisitar el paso y al idioma.
const resp = {};
const guardadoIni = estadoInicial();
for (const [k, g] of Object.entries(guardadoIni?.resp ?? {})) { const e = pasos[k] && desdeGuardado(pasos[k], g); if (e) resp[k] = e; }
// Región viva persistente (visualmente oculta) para anunciar el contraste de una deriva: debe existir ANTES de recibir el texto
const anuncio = el('div', 'sr'); anuncio.setAttribute('role', 'status'); document.body.append(anuncio);
const plano = x => String(L(x)).replace(/[`$*\\]/g, '');
// Puntuación discreta junto a la pista de pasos (solo si la guía tiene preguntas o derivas). Se inserta en la barra existente;
// `min-width` reserva su ancho (dígitos tabulares) para que no mueva la pista al cambiar.
const puntos = pasos.some(tipoDe) ? el('span', 'puntos') : null;
if (puntos) { puntos.setAttribute('role', 'img'); $('pista').after(puntos); }
function pintarPuntos() {
  if (!puntos) return;
  const { ok, total } = puntuacion(pasos, resp), t = UI[idioma()].puntos(ok, total);
  puntos.textContent = `✓ ${ok}/${total}`; puntos.setAttribute('aria-label', t); puntos.title = t;
}
// Una pregunta o deriva acaba de terminar: se avisa al ganchos de progreso y se actualiza la puntuación
function terminar(i) {
  const g = guardado(resp[i]);
  if (g) alResponder(i, g.opcion, g.ok, g.intentos);
  pintarPuntos();
}

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
// Escala y centra la escena activa. Sin leer layout: el tamaño del viewport llega del ResizeObserver (vpW/vpH) y aquí solo se
// escribe. En pantalla ancha la escena llena el panel; apilado (móvil) el viewport reserva UNA altura estable: la de la escena más
// alta de TODA la guía a este ancho (se miden de antemano, ver medirEscenas), así que no cambia al pasar de paso ni la primera vez
// que aparece una escena más alta. Es función solo del ancho (no acumula lo visto), por eso tampoco se desfasa al cambiar el ancho.
const apiladoMQ = matchMedia('(max-width: 900px)');
let vpW = 0, vpH = 0, reservaH = 0;
const medidas = []; // tamaños lógicos {W,H} distintos de las escenas de la guía (solo se rellena al verse apilado)
let medido = false;
// Tamaño lógico de cada escena que abre la guía: una instancia DESECHABLE por tipo (con un `stage` suelto, fuera del DOM) a la que se
// le da `fijar(def)` de cada apertura. El tamaño solo depende de `def`; así no se toca la escena real (sin restos que se desvanezcan).
function medirEscenas() {
  if (medido) return; medido = true;
  const inst = {}, vistos = new Set();
  for (const p of pasos) {
    const k = claves.find(c => p[c] !== undefined);
    if (!k) continue;
    try {
      const { def } = apertura(p, k), sc = inst[k] ??= mods[k].crear(el('div', 'stage off'), viewport);
      sc.fijar(def);
      const { W, H } = sc.tam, id = W + 'x' + H;
      if (W && H && !vistos.has(id)) { vistos.add(id); medidas.push({ W, H }); }
    } catch { /* sin medida de esta escena: encajar() la irá aceptando al verla */ }
  }
}
function encajar() {
  if (!activo || !vpW) return;
  const { W, H } = activo.sc.tam;
  if (!W) return;
  const apilado = apiladoMQ.matches, st = activo.stage.style;
  let s, top;
  if (apilado) {
    s = Math.min(1.5, vpW / W);
    let h = H * s;
    for (const m of medidas) h = Math.max(h, m.H * Math.min(1.5, vpW / m.W));
    const rh = Math.ceil(h);
    if (rh !== reservaH) { reservaH = rh; viewport.style.height = rh + 'px'; }
    top = (reservaH - H * s) / 2;
  } else {
    if (viewport.style.height) { viewport.style.height = ''; reservaH = 0; }
    s = Math.min(1.5, vpW / W, (vpH - 24) / H); top = (vpH - H * s) / 2;
  }
  st.width = W + 'px'; st.height = H + 'px'; st.transform = `scale(${s})`;
  st.left = (vpW - W * s) / 2 + 'px'; st.top = top + 'px';
}
new ResizeObserver(es => { const r = es[0].contentRect; vpW = r.width; vpH = r.height; encajar(); }).observe(viewport);
apiladoMQ.addEventListener('change', () => { if (apiladoMQ.matches) medirEscenas(); encajar(); });

const aperturas = new WeakMap();
// Estado de apertura de la escena que abre el paso `p` con la clave `k` (se guarda por paso: `def` conserva su identidad)
const apertura = (p, k) => { if (!aperturas.has(p)) aperturas.set(p, mods[k].plegar(undefined, p)); return aperturas.get(p); };
// Estado plegado en cada paso, calculado de forma incremental y guardado: navegar no vuelve a plegar 0..k (coste O(1) amortizado).
// Es seguro porque los pasos son datos fijos, `plegar` es pura (contrato de escena) y jugar/traza solo tocan copias (vista/plegar).
// No depende del idioma (los textos se resuelven al pintar), así que no hay que invalidarlo al cambiar de idioma.
const plegados = [];
function estadoEn(k) {
  for (let i = plegados.length; i <= k; i++) {
    const p = pasos[i], prev = plegados[i - 1] || { tipo: null, S: null, code: '', line: null, sec: null }, nuevo = claves.find(c => p[c] !== undefined);
    let { tipo, S, code, line, sec } = prev;
    if (nuevo) {
      // El estado de apertura se guarda por paso: así `def` conserva su identidad entre pasos y la escena anima en vez de reconstruirse
      tipo = nuevo; S = apertura(p, nuevo);
    }
    else if (tipo) S = mods[tipo].plegar(S, p);
    if (p.code !== undefined) code = p.code;
    if (p.line !== undefined) line = p.line;
    if (p.sec) sec = p.sec;
    plegados.push({ tipo, S, code, line, sec });
  }
  return plegados[k];
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
  const J = p.jugar, mod = mods[tipo], sc = activo.sc, cx = mod.ctx ? mod.ctx(S) : {}, v = memo.v ??= mod.vista(S); // v se conserva al cambiar de idioma (memo)
  const fila = el('div', 'botones'), tabla = el('div', 'lect');
  let filas = [];
  const btns = J.botones.map(d => {
    const b = el('button', 'btn mono', L(d.label));
    b.onclick = () => { d.hacer(v, cx); refrescar(); };
    fila.append(b); return [b, d];
  });
  const refrescar = () => {
    sc.pintar({ ...mod.conVista(S, v), hl: J.hl ? J.hl(v, cx) : p.hl }, true);
    for (const [b, d] of btns) b.disabled = !!(d.off && d.off(v, cx));
    // Filas persistentes: al mover un deslizador solo cambia el texto de `.res`; `expr` (con `$…$` → KaTeX) se pinta una vez
    const ls = J.lecturas(v, cx);
    if (filas.length !== ls.length) {
      filas = ls.map(() => ({ f: el('div', 'fila'), ex: el('span', 'expr'), re: el('span', 'res'), clave: null, val: null }));
      filas.forEach(r => r.f.append(r.ex, r.re));
      tabla.replaceChildren(...filas.map(r => r.f));
    }
    ls.forEach((r, i) => {
      const F = filas[i], txt = String(r.expr && typeof r.expr === 'object' ? r.expr[idioma()] : r.expr), val = String(r.valor);
      if (F.clave !== txt) { F.clave = txt; if (txt.includes('$')) F.ex.innerHTML = fmt(txt); else F.ex.textContent = txt; }
      if (F.val !== val) { F.val = val; F.re.textContent = val; }
      F.f.classList.toggle('malo', !!r.malo);
    });
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
  let pos = 0, vel = memo.vel ?? 1;
  const boton = (txt, tit) => { const b = el('button', 'btn', txt); b.title = tit; b.setAttribute('aria-label', tit); return b; };
  const bIni = boton('⏮', u.ini), bAtr = boton('◀', u.atras), bPlay = boton('▶', u.play), bAdel = boton('▶|', u.adel);
  const sel = el('select', 'vel'); sel.title = u.vel; sel.setAttribute('aria-label', u.vel);
  for (const x of [.5, 1, 2, 4, 8]) sel.append(Object.assign(el('option', '', x + '×'), { value: x, selected: x === vel }));
  const barra = Object.assign(el('input'), { type: 'range', min: 0, max: N, value: 0 }); barra.setAttribute('aria-label', u.pos);
  const subt = el('p', 'subt');
  const fila = el('div', 'repro'); fila.append(bIni, bAtr, bPlay, bAdel, sel, barra);
  caja.append(el('p', 'sub', u.traza), fila, subt);
  const mostrar = (i, ms) => {
    pos = memo.pos = Math.max(0, Math.min(N, i)); barra.value = pos; barra.setAttribute('aria-valuetext', pos + ' / ' + N);
    sc.pintar({ ...estados[pos], hl: pos ? undefined : p.hl }, REDUCIDO ? false : ms);
    pintarCodigo(estadoCodigo, lineas[pos]);
    const f = p.traza[pos - 1], t = f && f[idioma()];
    subt.innerHTML = t ? fmt(t) : '';
    bPlay.textContent = repro ? '⏸' : '▶'; bPlay.title = repro ? u.pausa : u.play; bPlay.setAttribute('aria-label', bPlay.title);
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
  sel.onchange = () => { vel = memo.vel = +sel.value; };
  barra.oninput = () => { parar(); mostrar(+barra.value, 0); };
  mostrar(memo.pos ?? 0, memo.pos ? 0 : true);
}
let estadoCodigo = '', idiPista = '';

// Pregunta con reintento (estado en resp[i]; la lógica pura está en respuestas.js): una opción mala se marca y se descarta, aparece
// una pista graduada (`pistas`, o la explicación si no hay) y se puede volver a intentar; la explicación completa llega al acertar
// o al quedar solo la correcta. Los botones se crean una vez y se actualizan en sitio (la región viva `.why` existe vacía de antemano).
function pregunta(q, caja, i) {
  const cq = el('div', 'preg'), fb = el('p', 'why'); fb.setAttribute('role', 'status');
  const bs = q.opc.map((o, j) => { const b = el('button', 'opc'); b.innerHTML = fmt(L(o)); b.onclick = () => responder(j); return b; });
  cq.append(...bs, fb); caja.append(cq);
  const pintar = anim => {
    const e = resp[i], u = UI[idioma()], pista = pistaDe(e, q);
    bs.forEach((b, j) => {
      const mala = e.malas.includes(j);
      b.disabled = e.fin || mala; b.classList.toggle('no', mala); b.classList.toggle('ok', e.fin && !!q.opc[j].ok);
    });
    if (e.fin) fb.innerHTML = `<strong>${u[e.ok ? 'ok' : 'no']}</strong> ${fmt(L(q.why))}`;
    else if (pista) fb.innerHTML = `<strong>${u.no}</strong> ${fmt(L(pista))}`;
    else fb.textContent = '';
    if (anim && fb.firstChild) aparecer(fb);
  };
  const responder = j => {
    const antes = resp[i], ahora = elegir(antes, q, j);
    if (ahora === antes) return;
    resp[i] = ahora; pintar(true);
    if (ahora.fin) { bs[j].blur(); terminar(i); } // sin foco en un botón desactivado: Espacio y flechas vuelven a navegar
    else bs.find(b => !b.disabled)?.focus(); // el foco pasa a la siguiente opción posible (operable solo con teclado)
  };
  pintar(false);
}

// Deriva (re-derivación socrática): 1) predicción 2) razón 3) solo entonces se revela el paso (ir(i, 'revelar')), contrastado con lo
// elegido. Tres capas apiladas en la MISMA celda de una rejilla: la caja mide lo que la más alta, así que revelar no mueve nada. Las
// capas inactivas llevan `inert` (fuera del orden de tabulación y del árbol de accesibilidad). «Siguiente» sigue disponible: saltarse
// la deriva la deja sin responder (no puntúa); lo ya elegido se conserva al volver o al cambiar de idioma.
function deriva(D, caja, i, modo) {
  const u = UI[idioma()], cd = el('div', 'deriva'); caja.append(cd);
  const capa = (cls, titulo) => {
    const g = el('div', 'capa ' + cls); g.setAttribute('role', 'group'); g.setAttribute('aria-label', titulo);
    g.append(el('p', 'sub', titulo)); cd.append(g); return g;
  };
  const c1 = capa('c-pred', u.predice), c2 = capa('c-razon', u.porque), c3 = capa('c-fin', u.contraste), c4 = capa('c-reserva', u.contraste);
  c4.inert = true; c4.setAttribute('aria-hidden', 'true'); // reserva de altura (ver contraste): nunca visible ni accesible
  const opcion = (o, fn) => { const b = el('button', 'opc'); b.innerHTML = fmt(L(o)); b.onclick = fn; return b; };
  const bp = D.opciones.map((o, j) => opcion(o, () => poner(predecir(resp[i], D, j), () => br[0].focus())));
  const br = D.razones.map((o, j) => opcion(o, () => poner(razonar(resp[i], D, j))));
  const chip = el('span', 'elegida'), bc = el('button', 'btn', u.cambiar);
  bc.onclick = () => { const p = resp[i].pred; poner(corregir(resp[i]), () => bp[p ?? 0].focus()); };
  const eleg = el('div', 'eleg'); eleg.append(el('span', 'k', u.tuPred), chip, bc);
  c1.append(...bp); c2.append(eleg, ...br);
  // Pistas bajo demanda (opcionales): una más por pulsación, nunca revelan el resultado
  const filas = [], N = D.pistas?.length ?? 0;
  if (N) for (const c of [c1, c2]) {
    const f = el('div', 'pista-fila'), b = el('button', 'btn'), t = el('p', 'why'); t.setAttribute('role', 'status');
    b.onclick = () => poner(pedirPista(resp[i], D));
    f.append(b, t); c.append(f); filas.push({ b, t });
  }
  const pintar = () => {
    const e = resp[i], pt = pistaPedida(e, D);
    c1.inert = e.fase !== 'pred'; c2.inert = e.fase !== 'razon'; c3.inert = e.fase !== 'revela';
    chip.innerHTML = e.pred != null ? fmt(L(D.opciones[e.pred])) : '';
    for (const { b, t } of filas) {
      b.textContent = `${u.pista} · ${e.pistas}/${N}`; b.disabled = e.pistas >= N;
      const txt = pt ? fmt(L(pt)) : ''; if (t.innerHTML !== txt) { t.innerHTML = txt; if (txt) aparecer(t); }
    }
  };
  // Contraste: lo que el alumno eligió frente a lo correcto, con marca de forma (✓ ✕ ◐: no solo color) y la explicación `revela`
  const contraste = (c, e) => {
    const bienP = e.pred === D.correcta, bienR = e.razon === D.razonCorrecta, ver = el('p', 'veredicto ' + e.resultado);
    ver.innerHTML = `<strong>${{ bien: '✓', razon: '◐', mal: '✕' }[e.resultado]} ${{ bien: u.bien, razon: u.razonOtra, mal: u.mal }[e.resultado]}</strong>`;
    const fila = (k, txt, bien, buena) => {
      const d = el('div', 'cont'); d.innerHTML = `<span class="k">${k}</span><span class="m ${bien ? 'ok' : 'no'}" aria-hidden="true">${bien ? '✓' : '✕'}</span><span>${fmt(L(txt))}</span>`;
      if (!bien) { const c = el('div', 'cont corr'); c.innerHTML = `<span class="k">${u.buena}</span><span class="m ok" aria-hidden="true">✓</span><span>${fmt(L(buena))}</span>`; return [d, c]; }
      return [d];
    };
    const rev = el('p', 'revela'); rev.innerHTML = fmt(L(D.revela));
    c.append(ver, ...fila(u.tuPred, D.opciones[e.pred], bienP, D.opciones[D.correcta]), ...fila(u.tuRazon, D.razones[e.razon], bienR, D.razones[D.razonCorrecta]), rev);
    return ver;
  };
  // La capa de contraste solo se rellena al revelar, pero la caja debe medir ya lo que mide con ella: una copia invisible del peor caso
  // (predicción y razón erróneas, las más largas entre las erróneas) ocupa la misma celda de la rejilla y reserva esa altura.
  const larga = (xs, bien) => xs.map((x, k) => k).filter(k => k !== bien).sort((a, b) => L(xs[b]).length - L(xs[a]).length)[0];
  contraste(c4, { pred: larga(D.opciones, D.correcta), razon: larga(D.razones, D.razonCorrecta), resultado: 'mal' });
  const poner = (e, foco) => {
    if (e === resp[i]) return;
    resp[i] = e;
    if (e.fin) { terminar(i); ir(i, 'revelar'); return; } // revelar rehace el paso entero (escena, texto, esta caja)
    pintar(); foco?.();
  };
  pintar();
  if (resp[i].fin) {
    const ver = contraste(c3, resp[i]);
    if (modo === 'revelar') { aparecer(c3); anuncio.textContent = `${u.contraste}. ${ver.textContent} ${plano(D.revela)}`; }
  }
}

// modo: undefined = navegar · 'idioma' = repintar los textos conservando el estado (respuestas, valores de jugar, posición de la traza)
// · 'revelar' = la deriva del paso acaba de contestarse: se muestra el paso real (escena, texto) con transición.
function ir(k, modo) {
  clearTimeout(repro); repro = 0;
  if (modo !== 'idioma') memo = {};
  if (modo !== 'revelar') anuncio.textContent = ''; // el contraste anunciado es de otro paso u otro idioma: no debe quedar en el árbol
  const previo = n, i = Math.max(0, Math.min(pasos.length - 1, k)), p = pasos[i], u = UI[idioma()];
  const D = i > 0 ? p.deriva : undefined; // (en el primer paso no habría escena anterior que mostrar: no puede ser deriva)
  if (D || p.pregunta) resp[i] ??= estadoNuevo(p);
  // Deriva sin contestar: la escena y el código son los del paso ANTERIOR (no se filtra el resultado) y en el panel de texto va la pregunta
  const oculto = !!D && !resp[i].fin, { sec } = estadoEn(i), { tipo, S, code, line } = estadoEn(oculto ? i - 1 : i), hl = oculto ? pasos[i - 1].hl : p.hl;
  n = i; estadoCodigo = code;
  document.title = `${L(G.titulo)} · Guija`;
  $('meta').replaceChildren(...(sec ? [el('span', 'sec', L(sec)), ' · '] : []), `${u.paso} ${i + 1} / ${pasos.length}`);
  const t = $('texto'); t.innerHTML = fmt(oculto ? L(D.pregunta) : p[idioma()]);
  if (previo !== i || modo === 'revelar') aparecer(t);
  pintarLeyenda(oculto ? null : p.leyenda);
  pintarCodigo(code, line);
  if (tipo) { const e = activar(tipo); e.sc.fijar(S.def); e.sc.arrastre?.(null); encajar(); }
  const caja = $('jugar'); caja.replaceChildren(); caja.hidden = !(p.jugar || p.pregunta || p.traza || D);
  if (p.jugar) jugar(p, S, tipo, caja);
  else if (p.traza) traza(p, S, line, tipo, caja);
  else if (tipo) activo.sc.pintar({ ...S, hl }, previo >= 0);
  if (D) deriva(D, caja, i, modo);
  if (p.pregunta) pregunta(p.pregunta, caja, i);
  pintarPuntos();
  // Pista: tabindex itinerante (solo el paso actual está en el orden de tabulación; flechas/Inicio/Fin la recorren) y cada botón
  // se nombra con «Paso j / N · sección» (las etiquetas dependen del idioma: solo se recalculan al cambiarlo)
  const idi = idioma(), botonesPista = [...$('pista').children];
  if (idiPista !== idi) {
    idiPista = idi;
    let s = '';
    botonesPista.forEach((b, j) => { if (pasos[j].sec) s = String(L(pasos[j].sec)).replace(/\$/g, ''); b.setAttribute('aria-label', `${u.paso} ${j + 1} / ${pasos.length}${s ? ' · ' + s : ''}`); });
  }
  botonesPista.forEach((b, j) => { b.className = (pasos[j].sec ? 'ini ' : '') + (j < i ? 'hecho' : j === i ? 'act' : ''); b.setAttribute('aria-current', j === i); b.tabIndex = j === i ? 0 : -1; });
  $('ant').disabled = i === 0; $('sig').disabled = i === pasos.length - 1;
  $('ant').title = u.ant; $('sig').title = u.sig;
  history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1));
}

$('pista').replaceChildren(...pasos.map((_, j) => { const b = el('button'); b.onclick = () => ir(j); b.setAttribute('aria-label', String(j + 1)); return b; }));
$('ant').onclick = () => ir(n - 1);
$('sig').onclick = () => ir(n + 1);
addEventListener('keydown', e => {
  const t = e.target;
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable) return;
  // Los controles enfocados del bloque interactivo y de la escena (arrastre con teclado, deslizadores, botones) se quedan con sus teclas
  if (t !== document.body && t.closest?.('#jugar, #viewport')) return;
  const k = { ArrowRight: n + 1, ArrowLeft: n - 1, Home: 0, End: pasos.length - 1 }[e.key] ?? (e.key === ' ' && t === document.body ? n + 1 : null);
  if (k == null) return;
  e.preventDefault(); ir(k);
  if (t.closest?.('#pista')) $('pista').children[n].focus(); // el foco acompaña al paso (tabindex itinerante)
});
document.addEventListener('idioma', () => { claveCodigo = null; ir(n, 'idioma'); });
iniciarIdioma();
if (apiladoMQ.matches) medirEscenas();
ir((parseInt(location.hash.slice(1), 10) || ((guardadoIni?.paso ?? 0) + 1)) - 1);
document.body.classList.add('listo');
