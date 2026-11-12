// Lección abierta: qué ejercicios tiene, cuáles pasan tras cada ejecución, marcas en el árbol, selector y modo enfoque.
// Todo el estado persistente vive en progreso.js; aquí solo se deriva de lo que ya devuelve la API (`temario`, `run`),
// sin tocar los motores de los lenguajes. Nada de esto se ejecuta al teclear: solo al ejecutar, abrir o cambiar de pestaña.
import { $, $$, el } from './util.js';
import { state, emit, on, activeTab } from './state.js';
import { api } from './api.js';
import { ctx } from './ctx.js';
import { LANG } from './lang.js';
import * as P from './progreso.js';

const REFRESCO_TEMARIO = 6 * 3_600_000;   // el temario casi no cambia: se reutiliza la caché unas horas

/** Pide el temario de este lenguaje (una petición pequeña) salvo que la caché sea reciente. Nunca lanza. */
export async function cargarTemario({ forzar = false } = {}) {
  if (!forzar && P.temarioDe(LANG.id).length && P.temarioEdad(LANG.id) < REFRESCO_TEMARIO) return;
  try {
    const r = await api('temario');
    P.registrarTemario(LANG.id, r.lessons);
  } catch { /* sin servidor o sin red: se usa lo que haya en caché */ }
}

// ── Pruebas ↔ ejercicios ─────────────────────────────────────
// El motor agrupa cada prueba bajo el nombre de la función («factorial()», a veces sin paréntesis o «Clase.método»).
const norm = s => String(s ?? '').trim().replace(/\(\)$/, '');

/** Clave del ejercicio al que pertenece una prueba (o null si su grupo no corresponde a ninguno). */
export function ejercicioDeTest(t, ej) {
  const g = norm(t.group);
  if (!g) return null;
  const directo = ej.find(e => e.k === g);
  if (directo) return directo.k;
  const cola = g.split(/::|\./).pop();
  const bajo = cola.toLowerCase();
  return ej.find(e => e.k === cola)?.k ?? ej.find(e => e.k.toLowerCase() === bajo)?.k ?? null;
}

/** Cuenta las pruebas por estado. `hecho` solo si hay pruebas y todas pasan (un «pendiente» o un fallo lo impiden). */
export function resumir(tests) {
  const s = { pass: 0, fail: 0, error: 0, todo: 0, total: tests.length };
  for (const t of tests) if (t.status in s) s[t.status]++;
  s.hecho = s.total > 0 && s.pass === s.total;
  return s;
}

/** {clave → {tests, resumen}} de lo ejecutado, para los ejercicios de la lección. */
export function porEjercicio(tests, ej) {
  const m = new Map(ej.map(e => [e.k, []]));
  for (const t of tests ?? []) m.get(ejercicioDeTest(t, ej))?.push(t);
  return new Map([...m].map(([k, ts]) => [k, { tests: ts, ...resumir(ts) }]));
}

/** Una línea con el veredicto de un ejercicio: pasa / qué falla / sin implementar / sin pruebas. */
export function veredicto(e, tests) {
  const r = resumir(tests);
  if (!r.total) return { tipo: 'vacio', corto: `${e.n}: sin pruebas`, texto: `${e.n}: este archivo no tiene pruebas para este ejercicio.` };
  if (r.hecho) return { tipo: 'ok', corto: `${e.n}: pasa ✓`, texto: `${e.n}: pasa ✓ (${r.pass} ${r.pass === 1 ? 'caso' : 'casos'}).` };
  const mal = tests.find(t => t.status === 'fail' || t.status === 'error');
  if (mal) {
    const det = mal.status === 'error' && mal.msg ? mal.msg : mal.expected !== undefined && mal.actual !== undefined ? `esperado ${mal.expected}, obtenido ${mal.actual}` : '';
    const linea = `${e.n}: falla «${mal.name}»${det ? ' — ' + det : ''}`.replace(/\s+/g, ' ');
    return { tipo: 'mal', corto: `${e.n}: falla`, texto: linea.length > 150 ? linea.slice(0, 149) + '…' : linea, linea: mal.line };
  }
  return { tipo: 'todo', corto: `${e.n}: pendiente`, texto: `${e.n}: sin implementar todavía (sustituye el pendiente).` };
}

// ── Estado de la lección abierta ─────────────────────────────
const idLeccion = () => state.leccion?.id ?? null;

function leccionDe(tab) {
  if (!tab || tab.dir === 'soluciones') return null;   // la solución de referencia no cuenta como ejercicio hecho
  return P.leccionDeArchivo(LANG.id, tab.name);
}

function actualizar() {
  const lec = leccionDe(activeTab());
  const antes = state.leccion?.id ?? null;
  state.leccion = lec;
  let foco = lec ? P.enfoque(LANG.id, lec.id) : null;
  if (foco && !lec.ej.some(e => e.k === foco)) foco = null;
  state.foco = foco;
  if (lec && lec.id !== antes) P.marcarLeccion(LANG.id, lec.id);
  pintarSelector();
  marcarArbol();
  emit('leccion', lec);
}

/** Cambia el ejercicio en foco (null = todo el archivo). Con `revelar`, lleva el editor a su función. */
export function fijarFoco(k, { revelar = true } = {}) {
  const lec = state.leccion;
  if (!lec) return;
  const clave = k && lec.ej.some(e => e.k === k) ? k : null;
  state.foco = clave;
  P.enfoqueFijar(LANG.id, lec.id, clave);
  pintarSelector();
  emit('foco', clave);
  if (clave && revelar) revelarEjercicio(clave);
}

/** Primera línea donde se define el ejercicio: del análisis si ya hay, y si no por búsqueda de texto (solo al pedirlo). */
export function lineaDeEjercicio(k) {
  const tab = activeTab();
  if (!tab) return null;
  const u = state.analysis?.id === tab.id ? state.analysis.units?.find(x => x.name === k || x.qname === k) : null;
  if (u?.startLine) return u.startLine;
  const v = k.replace(/[$.*+?^()[\]{}|\\]/g, '\\$&');
  const tipo = new RegExp(String.raw`^\s*(?:export\s+)?(?:abstract\s+|final\s+|sealed\s+|public\s+)*(?:class|struct|enum|interface|record)\s+${v}\b`);
  const fn = new RegExp(String.raw`^\s*(?!return\b|else\b|throw\b|new\b|co_return\b|yield\b|print\b|echo\b|await\b)(?:def\s+|function\s+|(?:[\w:<>,&*~]+\s+)+)${v}\s*\(`);
  const lineas = ctx.editor.getText(tab.id).split('\n');
  const i = lineas.findIndex(l => tipo.test(l) || fn.test(l));
  return i < 0 ? null : i + 1;
}

function revelarEjercicio(k) {
  const l = lineaDeEjercicio(k);
  if (l) ctx.editor.reveal(l);
}

/** Abre la lección (su copia en practicas/ si la hay, si no el ejemplo) y enfoca el ejercicio. */
export async function abrirEjercicio(leccion, clave) {
  const lec = P.temarioDe(LANG.id).find(l => l.id === leccion);
  if (!lec) return false;
  const abierta = state.tabs.find(t => t.name === lec.archivo && t.dir !== 'soluciones');
  const dir = state.tree.practicas?.some(f => f.name === lec.archivo) ? 'practicas' : 'ejemplos';
  if (abierta) ctx.files.activate(abierta.id);
  else if (!(await ctx.files.openFile(dir, lec.archivo, { quiet: true }))) return false;
  fijarFoco(clave, { revelar: true });
  return true;
}

/** `/cpp?l=recursion&e=fib` (lo que enlazan la pantalla de inicio y los repasos): abre ahí y limpia la URL. */
export async function abrirDesdeUrl() {
  const q = new URLSearchParams(location.search);
  const l = q.get('l'), e = q.get('e');
  if (!l) return;
  history.replaceState(null, '', location.pathname);
  await cargarTemario();
  if (e) await abrirEjercicio(l, e);
  else {
    const lec = P.temarioDe(LANG.id).find(x => x.id === l);
    if (lec) await ctx.files.openFile('ejemplos', lec.archivo, { quiet: true });
  }
}

// ── Tras ejecutar: qué ejercicios pasan ──────────────────────
function registrar({ tab, data }) {
  const lec = leccionDe(tab);
  if (!lec || tab.readOnly || !data?.tests?.length) return;
  const vencidos = new Set(P.repasoHoy(999).map(i => i.id));
  for (const [k, r] of porEjercicio(data.tests, lec.ej)) {
    if (!r.hecho) continue;
    P.ejercicioHecho(LANG.id, lec.id, k);
    const id = `ej:${LANG.id}/${lec.id}/${k}`;
    if (vencidos.has(id)) P.repasoResultado(id, true);   // volver a resolverlo en su día de repaso cuenta como recordado
  }
  pintarSelector();
  pintarVeredicto();
}

// ── Selector de ejercicio (modo enfoque) ─────────────────────
const marca = (hecho, r) => (hecho ? '✓' : r && (r.fail || r.error) ? '✗' : '○');

function pintarSelector() {
  const wrap = $('#ej-wrap');
  const sel = $('#ej-select');
  if (!wrap || !sel) return;
  const lec = state.leccion;
  wrap.hidden = !lec || !lec.ej.length;
  if (wrap.hidden) return;
  const hechos = new Set(P.ejerciciosHechos(LANG.id, lec.id));
  const res = state.run ? porEjercicio(state.run.tests, lec.ej) : new Map();
  const n = lec.ej.filter(e => hechos.has(e.k)).length;
  const opciones = [el('option', { value: '' }, `Todo el archivo · ${n}/${lec.ej.length}`),
    ...lec.ej.map(e => el('option', { value: e.k }, `${marca(hechos.has(e.k), res.get(e.k))} ${e.n}`))];
  sel.replaceChildren(...opciones);
  sel.value = state.foco ?? '';
}

function siguienteDe(k) {
  const lec = state.leccion;
  if (!lec) return null;
  const hechos = new Set(P.ejerciciosHechos(LANG.id, lec.id));
  const i = lec.ej.findIndex(e => e.k === k);
  return [...lec.ej.slice(i + 1), ...lec.ej.slice(0, Math.max(0, i))].find(e => !hechos.has(e.k)) ?? null;
}

/** Siguiente ejercicio sin hacer (para el botón del veredicto). */
export const siguienteEjercicio = () => (state.foco ? siguienteDe(state.foco) : null);

// ── Veredicto en la barra de estado (visible también sin el panel de pruebas) ──
function pintarVeredicto() {
  const item = $('#st-test');
  if (!item) return;
  const lec = state.leccion;
  const tests = state.run?.tests ?? [];
  if (!tests.length) { item.hidden = true; return; }
  let texto;
  if (lec && state.foco) {
    const e = lec.ej.find(x => x.k === state.foco);
    texto = veredicto(e, tests.filter(t => ejercicioDeTest(t, lec.ej) === state.foco)).corto;
  } else {
    const s = state.run.testSummary;
    texto = `Pruebas ${s.pass}/${s.total}`;
  }
  item.textContent = texto;
  item.hidden = false;
}

// ── Marcas en el árbol (se parchean los nodos existentes: no se reconstruye nada) ──
export function marcarArbol() {
  const lecs = P.temarioDe(LANG.id);
  if (!lecs.length) return;
  const porArchivo = new Map(lecs.map(l => [l.archivo, l]));
  for (const it of $$('.tree-item[data-name]')) {
    if (it.dataset.dir === 'soluciones') continue;
    const l = porArchivo.get(it.dataset.name);
    if (!l || !l.ej.length) continue;
    const hechos = new Set(P.ejerciciosHechos(LANG.id, l.id));
    const n = l.ej.filter(e => hechos.has(e.k)).length;
    let m = it.querySelector(':scope > .prog');
    if (!m) {
      m = el('span', { class: 'prog' });
      it.querySelector(':scope > .name')?.after(m);
    }
    const completa = n === l.ej.length;
    const texto = completa ? '✓ ' + n : `${n}/${l.ej.length}`;
    if (m.textContent !== texto) m.textContent = texto;
    m.classList.toggle('done', completa);
    m.classList.toggle('cero', n === 0);
    m.title = completa ? 'Lección completa' : `${n} de ${l.ej.length} ejercicios hechos`;
  }
}

export function initLeccion() {
  on('active', actualizar);
  on('ran', registrar);
  on('run', () => { pintarSelector(); pintarVeredicto(); });
  on('tree-render', marcarArbol);
  P.alCambiar(() => { marcarArbol(); pintarSelector(); });
  $('#ej-select')?.addEventListener('change', e => fijarFoco(e.target.value || null));
  $('#st-test')?.addEventListener('click', () => { if (document.documentElement.classList.contains('zen')) ctx.zen?.(false); ctx.showPanel?.('pruebas'); });
  on('foco', pintarVeredicto);
  // El temario llega después del primer arranque: cuando esté, se resuelve la lección de la pestaña abierta
  P.alCambiar(() => { if (!state.leccion && activeTab()) actualizar(); });
  actualizar();
}
