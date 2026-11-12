// Estado del alumno: único dueño de lo que se recuerda entre sesiones (ejercicios hechos, posición en las guías,
// repaso espaciado, racha, notas aparcadas, temporizador). Lo usan el IDE, la pantalla de inicio y /guias.
//
// Capas: `crearProgreso({ storage, ahora })` es la lógica pura (sin DOM; con almacenamiento y reloj inyectables, así se
// prueba en Node: tests/progreso.js). Al final, una instancia ligada a localStorage y Date.now exporta las funciones.
// Si localStorage no existe, falla o está lleno, todo sigue funcionando en memoria (sin persistir).
//
// ── Formato (UNA clave global, `pg:progreso`, común a todos los lenguajes y a /guias) ─────────────────────────────
// {
//   v: 1,                                        versión del formato; si es mayor que la que entiende este código se
//                                                lee pero NO se escribe (no se pisan datos de una versión más nueva)
//   ej:     { "<lang>/<leccion>": { "<clave>": <ms de la primera vez que pasó> } },   leccion = id del temario («recursion»)
//   guias:  { "<id>": { paso, max, total, resp: { "<paso>": { opcion, ok } }, ms, titulo? } },
//                                                paso/max son índices desde 0 (como `ir(n)` de guia.js; la URL usa #paso+1);
//                                                max = -1 si nunca se ha visto ningún paso
//   repaso: { "<itemId>": { tipo: 'ejercicio'|'guia', titulo, url, caja: 1..4, prox: <día>, ok, mal } }
//                                                itemId = «ej:<lang>/<leccion>/<clave>» o «guia:<id>#<paso>»; cajas de Leitner
//                                                con intervalos 1/3/7/21 días; prox = día (ver abajo) en que toca repasar
//   dias:   { "<día>": { ej, pasos } },          actividad diaria; <día> = nº de día del calendario LOCAL
//                                                (Date.UTC(año, mes, día) / 86400000), estable ante cambios de hora
//   tem:    { "<lang>": { ms, lecciones: [{ id, titulo, archivo, ej: [{ k, n }] }] } },  temario en caché (acción `temario`)
//   notas:  { "<lang>/<leccion>": [{ id, t, ms }] },   ideas aparcadas
//   tmr:    null | { dur, fin: <ms>|null, rest: <ms>|null },   temporizador: corriendo (fin) o en pausa (rest)
//   ui:     { foco: { "<lang>/<leccion>": "<clave>" } },      ejercicio en modo enfoque por lección
//   ult:    null | { lang, leccion, ms }                        última lección con la que se trabajó
// }
// Un día «cuenta» para la racha si tiene ≥ 1 ejercicio pasado o ≥ 5 pasos nuevos de guía (PASOS_RACHA).
// Si el JSON está corrupto se parte de cero y el texto original se conserva en `pg:progreso:corrupto`.

export const CLAVE = 'pg:progreso';
export const VERSION = 1;
export const INTERVALOS = [1, 3, 7, 21];   // días de la caja 1, 2, 3, 4
export const PASOS_RACHA = 5;
export const MARGEN_TRABAJO = 20 * 60_000;   // con actividad más reciente se sigue con la lección en curso antes que repasar

const DIA_MS = 86_400_000;
const MAX_DIAS = 400;
const MAX_NOTAS = 50;
const MAX_NOTA = 500;
const ID_GUIA = /^[a-z0-9][a-z0-9-]{0,59}$/;
const ID_LANG = /^[a-z]{2,10}$/;

const esObjeto = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const entero = (v, min, def) => (Number.isInteger(v) && v >= min ? v : def);
const texto = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const urlLocal = u => typeof u === 'string' && u.startsWith('/') && !u.startsWith('//') && u.length < 300;
/** Nº de día del calendario local de un instante (estable aunque el día tenga 23 o 25 horas). */
export const diaDe = ms => { const d = new Date(ms); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DIA_MS); };

const vacio = () => ({ v: VERSION, ej: {}, guias: {}, repaso: {}, dias: {}, tem: {}, notas: {}, tmr: null, ui: { foco: {} }, ult: null });

/** Valida y normaliza lo leído: descarta lo que no encaja en vez de fallar más tarde en la interfaz. */
function normalizar(raw) {
  const s = vacio();
  s.v = raw.v;
  if (esObjeto(raw.ej)) {
    for (const [k, m] of Object.entries(raw.ej)) {
      if (!esObjeto(m)) continue;
      const lim = {};
      for (const [c, ms] of Object.entries(m)) if (typeof ms === 'number' && Number.isFinite(ms)) lim[c] = ms;
      s.ej[k] = lim;
    }
  }
  if (esObjeto(raw.guias)) {
    for (const [id, g] of Object.entries(raw.guias)) {
      if (!ID_GUIA.test(id) || !esObjeto(g)) continue;
      const resp = {};
      if (esObjeto(g.resp)) for (const [p, r] of Object.entries(g.resp)) if (esObjeto(r)) resp[p] = { opcion: r.opcion ?? null, ok: !!r.ok };
      s.guias[id] = { paso: entero(g.paso, 0, 0), max: entero(g.max, -1, -1), total: entero(g.total, 0, 0), resp, ms: Number(g.ms) || 0, ...(g.titulo ? { titulo: texto(g.titulo) } : {}) };
    }
  }
  if (esObjeto(raw.repaso)) {
    for (const [id, r] of Object.entries(raw.repaso)) {
      if (!esObjeto(r) || !urlLocal(r.url) || (r.tipo !== 'ejercicio' && r.tipo !== 'guia')) continue;
      s.repaso[id] = { tipo: r.tipo, titulo: texto(r.titulo), url: r.url, caja: Math.min(4, entero(r.caja, 1, 1)), prox: entero(r.prox, 0, 0), ok: entero(r.ok, 0, 0), mal: entero(r.mal, 0, 0) };
    }
  }
  if (esObjeto(raw.dias)) {
    for (const [d, a] of Object.entries(raw.dias)) if (/^\d+$/.test(d) && esObjeto(a)) s.dias[d] = { ej: entero(a.ej, 0, 0), pasos: entero(a.pasos, 0, 0) };
  }
  if (esObjeto(raw.tem)) {
    for (const [lang, t] of Object.entries(raw.tem)) {
      if (!ID_LANG.test(lang) || !esObjeto(t) || !Array.isArray(t.lecciones)) continue;
      s.tem[lang] = {
        ms: Number(t.ms) || 0,
        lecciones: t.lecciones.filter(l => esObjeto(l) && typeof l.id === 'string').map(l => ({
          id: texto(l.id), titulo: texto(l.titulo), archivo: texto(l.archivo),
          ej: (Array.isArray(l.ej) ? l.ej : []).filter(e => esObjeto(e) && typeof e.k === 'string').map(e => ({ k: texto(e.k), n: texto(e.n) || texto(e.k) + '()' })),
        })),
      };
    }
  }
  if (esObjeto(raw.notas)) {
    for (const [k, l] of Object.entries(raw.notas)) {
      if (Array.isArray(l)) s.notas[k] = l.filter(n => esObjeto(n) && typeof n.id === 'string' && typeof n.t === 'string').map(n => ({ id: texto(n.id, 40), t: texto(n.t, MAX_NOTA), ms: Number(n.ms) || 0 })).slice(-MAX_NOTAS);
    }
  }
  if (esObjeto(raw.tmr) && Number.isFinite(raw.tmr.dur) && raw.tmr.dur > 0) {
    const fin = Number.isFinite(raw.tmr.fin) ? raw.tmr.fin : null;
    const rest = Number.isFinite(raw.tmr.rest) ? raw.tmr.rest : null;
    if (fin !== null || rest !== null) s.tmr = { dur: raw.tmr.dur, fin, rest };
  }
  if (esObjeto(raw.ui) && esObjeto(raw.ui.foco)) for (const [k, c] of Object.entries(raw.ui.foco)) if (typeof c === 'string') s.ui.foco[k] = texto(c);
  if (esObjeto(raw.ult) && typeof raw.ult.lang === 'string' && typeof raw.ult.leccion === 'string') s.ult = { lang: texto(raw.ult.lang, 10), leccion: texto(raw.ult.leccion), ms: Number(raw.ult.ms) || 0 };
  return s;
}

export function crearProgreso({ storage = null, ahora = Date.now } = {}) {
  let cache = null;
  let soloLectura = false;
  const oyentes = new Set();

  const leerRaw = () => { try { return storage ? storage.getItem(CLAVE) : null; } catch { return null; } };

  function cargar() {
    if (cache) return cache;
    soloLectura = false;
    const raw = leerRaw();
    if (raw == null || raw === '') return (cache = vacio());
    let obj = null;
    try { obj = JSON.parse(raw); } catch { /* corrupto */ }
    if (!esObjeto(obj) || !Number.isInteger(obj.v) || obj.v < 1) {
      try { storage?.setItem(CLAVE + ':corrupto', raw); } catch { /* sin espacio: da igual */ }
      return (cache = vacio());
    }
    if (obj.v > VERSION) soloLectura = true;
    return (cache = normalizar(obj));
  }

  function guardar() {
    if (!soloLectura) {
      const hasta = diaDe(ahora()) - MAX_DIAS;
      for (const d of Object.keys(cache.dias)) if (Number(d) < hasta) delete cache.dias[d];
      try { storage?.setItem(CLAVE, JSON.stringify(cache)); } catch { /* modo privado o sin espacio: se queda en memoria */ }
    }
    for (const fn of oyentes) { try { fn(); } catch { /* un oyente roto no rompe a los demás */ } }
  }

  /** Aplica `fn` al estado; si devuelve false no se guarda (nada cambió). */
  function cambiar(fn) {
    const s = cargar();
    const r = fn(s);
    if (r !== false) guardar();
    return r;
  }

  const hoy = () => diaDe(ahora());
  const clave = (lang, leccion) => `${lang}/${leccion}`;
  const actividad = (s, campo, n = 1) => { const d = (s.dias[hoy()] ??= { ej: 0, pasos: 0 }); d[campo] += n; };

  // ── Temario en caché ───────────────────────────────────────
  function registrarTemario(lang, lecciones) {
    if (!ID_LANG.test(String(lang)) || !Array.isArray(lecciones)) return false;
    return cambiar(s => {
      s.tem[lang] = {
        ms: ahora(),
        lecciones: lecciones.filter(l => l && typeof l.id === 'string').map(l => ({
          id: texto(l.id), titulo: texto(l.titulo), archivo: texto(l.archivo),
          ej: (l.ejercicios ?? []).filter(e => e && typeof e.key === 'string').map(e => ({ k: texto(e.key), n: texto(e.name) || texto(e.key) + '()' })),
        })),
      };
    }) !== false;
  }
  /** Lecciones en caché de un lenguaje: [{id, titulo, archivo, ej:[{k,n}]}] (vacío si aún no se ha pedido). */
  const temarioDe = lang => cargar().tem[lang]?.lecciones ?? [];
  const temarioEdad = lang => { const t = cargar().tem[lang]; return t ? ahora() - t.ms : Infinity; };
  const leccionDeArchivo = (lang, archivo) => temarioDe(lang).find(l => l.archivo === archivo) ?? null;

  // ── Ejercicios ─────────────────────────────────────────────
  const urlEj = (lang, leccion, k) => `/${lang}?l=${encodeURIComponent(leccion)}&e=${encodeURIComponent(k)}`;
  const idEj = (lang, leccion, k) => `ej:${lang}/${leccion}/${k}`;
  const nombreEj = (s, lang, leccion, k) => s.tem[lang]?.lecciones.find(l => l.id === leccion)?.ej.find(e => e.k === k)?.n ?? k + '()';

  function aRepasar(s, id, tipo, titulo, url) {
    const r = s.repaso[id];
    if (r) { r.titulo = titulo; r.url = url; return; }
    s.repaso[id] = { tipo, titulo, url, caja: 1, prox: hoy() + INTERVALOS[0], ok: 0, mal: 0 };
  }

  /** Marca el ejercicio como superado. Devuelve true la primera vez (la actividad y el repaso solo se cuentan entonces). */
  function ejercicioHecho(lang, leccion, k) {
    if (!ID_LANG.test(String(lang)) || typeof leccion !== 'string' || typeof k !== 'string' || !leccion || !k) return false;
    let nuevo = false;
    cambiar(s => {
      const mapa = (s.ej[clave(lang, leccion)] ??= {});
      if (mapa[k]) {   // ya estaba: no cuenta otra vez; solo se refresca «última lección» (como mucho una escritura por minuto)
        if (s.ult && s.ult.lang === lang && s.ult.leccion === leccion && ahora() - s.ult.ms < 60_000) return false;
        s.ult = { lang, leccion, ms: ahora() };
        return;
      }
      s.ult = { lang, leccion, ms: ahora() };
      nuevo = true;
      mapa[k] = ahora();
      actividad(s, 'ej');
      aRepasar(s, idEj(lang, leccion, k), 'ejercicio', nombreEj(s, lang, leccion, k), urlEj(lang, leccion, k));
    });
    return nuevo;
  }
  const ejerciciosHechos = (lang, leccion) => Object.entries(cargar().ej[clave(lang, leccion)] ?? {}).sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const ejercicioEsta = (lang, leccion, k) => !!cargar().ej[clave(lang, leccion)]?.[k];
  /** Anota la lección con la que se trabaja (al abrirla): sirve para continuar donde se dejó. */
  function marcarLeccion(lang, leccion) {
    if (!ID_LANG.test(String(lang)) || typeof leccion !== 'string' || !leccion) return;
    cambiar(s => {
      if (s.ult && s.ult.lang === lang && s.ult.leccion === leccion && ahora() - s.ult.ms < 60_000) return false;
      s.ult = { lang, leccion, ms: ahora() };
    });
  }

  // ── Guías ──────────────────────────────────────────────────
  const vacioGuia = () => ({ paso: 0, max: -1, total: 0, resp: {}, ms: 0 });
  /** Posición actual (paso, desde 0) y el más lejano visto. Solo un paso NUEVO (> max) suma a la actividad del día. */
  function guiaPaso(id, paso, total, titulo) {
    if (!ID_GUIA.test(String(id)) || !Number.isInteger(paso) || paso < 0) return;
    cambiar(s => {
      const g = (s.guias[id] ??= vacioGuia());
      const t = Number.isInteger(total) && total > 0 ? total : g.total;
      const nuevo = paso > g.max;
      if (!nuevo && g.paso === paso && g.total === t && !(titulo && !g.titulo)) return false;
      g.paso = paso;
      g.total = t;
      if (titulo && typeof titulo === 'string') g.titulo = texto(titulo);
      if (nuevo) { g.max = paso; actividad(s, 'pasos'); }
      g.ms = ahora();
    });
  }
  /** Respuesta a una pregunta del paso. Un fallo mete la pregunta en la cola de repaso (caja 1, para mañana). */
  function guiaRespuesta(id, paso, opcion, ok, titulo) {
    if (!ID_GUIA.test(String(id)) || !Number.isInteger(paso) || paso < 0) return;
    cambiar(s => {
      const g = (s.guias[id] ??= vacioGuia());
      g.resp[paso] = { opcion: opcion ?? null, ok: !!ok };
      if (!ok) {
        const iid = `guia:${id}#${paso}`;
        const nombre = texto(titulo) || `Pregunta de «${g.titulo || id}», paso ${paso + 1}`;
        aRepasar(s, iid, 'guia', nombre, `/guias/${id}#${paso + 1}`);
        const r = s.repaso[iid];
        r.caja = 1; r.prox = hoy() + INTERVALOS[0]; r.mal++;
      }
    });
  }
  const guiaEstado = id => {
    const g = cargar().guias[id];
    return g ? { paso: g.paso, max: g.max, total: g.total, resp: { ...g.resp } } : { paso: 0, max: -1, total: 0, resp: {} };
  };

  // ── Repaso espaciado (Leitner) ─────────────────────────────
  const itemPublico = (id, r) => ({ id, tipo: r.tipo, titulo: r.titulo, url: r.url, caja: r.caja, prox: r.prox, atraso: Math.max(0, hoy() - r.prox) });
  /** Elementos que toca repasar hoy (los más atrasados primero), como mucho `max`. */
  function repasoHoy(max = 5) {
    const h = hoy();
    return Object.entries(cargar().repaso).filter(([, r]) => r.prox <= h)
      .sort((a, b) => a[1].prox - b[1].prox || a[1].caja - b[1].caja || (a[0] < b[0] ? -1 : 1))
      .slice(0, Math.max(0, max)).map(([id, r]) => itemPublico(id, r));
  }
  const repasoPendientes = () => { const h = hoy(); return Object.values(cargar().repaso).filter(r => r.prox <= h).length; };
  /** Acierto: sube de caja (máx. 4); fallo: vuelve a la caja 1. En ambos casos no vuelve a salir hasta su intervalo. */
  function repasoResultado(itemId, ok) {
    if (!cargar().repaso[itemId]) return null;
    cambiar(s => {
      const r = s.repaso[itemId];
      r.caja = ok ? Math.min(4, r.caja + 1) : 1;
      r.prox = hoy() + INTERVALOS[r.caja - 1];
      if (ok) r.ok++; else r.mal++;
    });
    return itemPublico(itemId, cargar().repaso[itemId]);
  }
  const repasoDe = itemId => { const r = cargar().repaso[itemId]; return r ? itemPublico(itemId, r) : null; };

  // ── Sesión: actividad y racha ──────────────────────────────
  const cuenta = d => !!d && (d.ej >= 1 || d.pasos >= PASOS_RACHA);
  /** Días consecutivos con actividad que cuenta. Hoy aún sin actividad no rompe la racha: se cuenta desde ayer. */
  function racha() {
    const dias = cargar().dias;
    let d = hoy();
    if (!cuenta(dias[d])) d--;
    let n = 0;
    while (cuenta(dias[d])) { n++; d--; }
    return n;
  }
  function sesionHoy() {
    const d = cargar().dias[hoy()] ?? { ej: 0, pasos: 0 };
    return { ejercicios: d.ej, pasos: d.pasos, actividad: d.ej + d.pasos, cuenta: cuenta(d), meta: 1, metaCumplida: d.ej >= 1, racha: racha() };
  }

  // ── Temporizador (el resto se deriva de la marca de fin: sin deriva y sobrevive a recargas) ──
  function temporizador() {
    const t = cargar().tmr;
    if (!t) return { estado: 'parado', dur: 0, resta: 0 };
    if (t.fin == null) return { estado: 'pausa', dur: t.dur, resta: t.rest };
    const resta = t.fin - ahora();
    return resta > 0 ? { estado: 'corriendo', dur: t.dur, resta } : { estado: 'fin', dur: t.dur, resta: 0 };
  }
  function temporizadorIniciar(minutos) {
    const m = Number(minutos);
    if (!Number.isFinite(m) || m < 1 || m > 180) return;
    cambiar(s => { s.tmr = { dur: m * 60_000, fin: ahora() + m * 60_000, rest: null }; });
  }
  function temporizadorPausar() {
    cambiar(s => { if (!s.tmr || s.tmr.fin == null) return false; s.tmr.rest = Math.max(0, s.tmr.fin - ahora()); s.tmr.fin = null; });
  }
  function temporizadorReanudar() {
    cambiar(s => { if (!s.tmr || s.tmr.fin != null) return false; s.tmr.fin = ahora() + s.tmr.rest; s.tmr.rest = null; });
  }
  const temporizadorParar = () => cambiar(s => { if (!s.tmr) return false; s.tmr = null; });

  // ── Notas aparcadas ────────────────────────────────────────
  let contador = 0;
  const notas = (lang, leccion) => (cargar().notas[clave(lang, leccion)] ?? []).map(n => ({ ...n }));
  function notaAgregar(lang, leccion, t) {
    const limpio = String(t ?? '').trim().slice(0, MAX_NOTA);
    if (!limpio || !ID_LANG.test(String(lang)) || typeof leccion !== 'string' || !leccion) return null;
    const nota = { id: ahora().toString(36) + (++contador).toString(36), t: limpio, ms: ahora() };
    cambiar(s => { const l = (s.notas[clave(lang, leccion)] ??= []); l.push(nota); if (l.length > MAX_NOTAS) l.splice(0, l.length - MAX_NOTAS); });
    return { ...nota };
  }
  function notaBorrar(lang, leccion, id) {
    return cambiar(s => {
      const l = s.notas[clave(lang, leccion)];
      const i = l ? l.findIndex(n => n.id === id) : -1;
      if (i < 0) return false;
      l.splice(i, 1);
      if (!l.length) delete s.notas[clave(lang, leccion)];
      return true;
    }) === true;
  }

  // ── Modo enfoque (ejercicio elegido por lección) ───────────
  const enfoque = (lang, leccion) => cargar().ui.foco[clave(lang, leccion)] ?? null;
  function enfoqueFijar(lang, leccion, k) {
    cambiar(s => {
      const kl = clave(lang, leccion);
      if ((s.ui.foco[kl] ?? null) === (k || null)) return false;
      if (k) s.ui.foco[kl] = String(k); else delete s.ui.foco[kl];
    });
  }

  // ── Siguiente paso ─────────────────────────────────────────
  function primerPendiente(s, lang, desde) {
    // desde: id de lección por la que empezar (la en curso); después, las siguientes por orden y, al final, las anteriores
    const lecs = s.tem[lang]?.lecciones ?? [];
    const i0 = Math.max(0, lecs.findIndex(l => l.id === desde));
    for (const l of [...lecs.slice(i0), ...lecs.slice(0, i0)]) {
      const hechos = s.ej[clave(lang, l.id)] ?? {};
      const e = l.ej.find(x => !hechos[x.k]);
      if (e) return { lang, leccion: l, ej: e, hechos: l.ej.filter(x => hechos[x.k]).length };
    }
    return null;
  }
  function tarjetaEjercicio(p) {
    return {
      tipo: 'ejercicio', titulo: `Ejercicio: ${p.ej.n}`,
      detalle: `${p.leccion.titulo || p.leccion.id} · ${p.hechos} de ${p.leccion.ej.length} hechos`,
      url: urlEj(p.lang, p.leccion.id, p.ej.k),
      ref: { lang: p.lang, leccion: p.leccion.id, clave: p.ej.k },
    };
  }
  /**
   * LA siguiente acción, una sola. Prioridad: 1) el siguiente ejercicio de la lección en curso si se trabajó en ella hace
   * poco (no se interrumpe); 2) repaso vencido; 3) guía a medias; 4) el siguiente ejercicio pendiente del temario.
   * `lang` solo se usa si todavía no hay lección en curso. null si no hay nada (aún no se conoce el temario).
   */
  function siguientePaso({ lang } = {}) {
    const s = cargar();
    const l = s.ult?.lang ?? lang;
    const enCurso = s.ult && l === s.ult.lang && ahora() - s.ult.ms < MARGEN_TRABAJO ? primerPendiente(s, l, s.ult.leccion) : null;
    if (enCurso && enCurso.leccion.id === s.ult.leccion) return tarjetaEjercicio(enCurso);
    const venc = repasoHoy(5);
    if (venc.length) {
      const n = repasoPendientes();
      return {
        tipo: 'repaso', titulo: 'Repaso de hoy',
        detalle: `${n} ${n === 1 ? 'pendiente' : 'pendientes'}: ${venc.slice(0, 3).map(i => i.titulo).join(' · ')}`,
        url: venc[0].url, ref: { id: venc[0].id },
      };
    }
    const abiertas = Object.entries(s.guias).filter(([, g]) => g.max >= 0 && g.total > 0 && g.max < g.total - 1).sort((a, b) => b[1].ms - a[1].ms);
    if (abiertas.length) {
      const [id, g] = abiertas[0];
      return { tipo: 'guia', titulo: `Sigue la guía «${g.titulo || id}»`, detalle: `Paso ${g.paso + 1} de ${g.total}`, url: `/guias/${id}#${g.paso + 1}`, ref: { id, paso: g.paso } };
    }
    const p = l ? primerPendiente(s, l, s.ult?.leccion) : null;
    return p ? tarjetaEjercicio(p) : null;
  }

  // ── Utilidades ─────────────────────────────────────────────
  const alCambiar = fn => { oyentes.add(fn); return () => oyentes.delete(fn); };
  /** Vuelve a leer del almacenamiento (otra pestaña lo cambió) y avisa a los oyentes. */
  const recargar = () => { cache = null; for (const fn of oyentes) { try { fn(); } catch { /* nada */ } } };
  const instantanea = () => JSON.parse(JSON.stringify(cargar()));
  const borrarTodo = () => { cache = vacio(); soloLectura = false; guardar(); };

  return {
    registrarTemario, temarioDe, temarioEdad, leccionDeArchivo,
    ejercicioHecho, ejerciciosHechos, ejercicioEsta, marcarLeccion,
    guiaPaso, guiaRespuesta, guiaEstado,
    siguientePaso, repasoHoy, repasoPendientes, repasoResultado, repasoDe,
    sesionHoy, racha,
    temporizador, temporizadorIniciar, temporizadorPausar, temporizadorReanudar, temporizadorParar,
    notas, notaAgregar, notaBorrar, enfoque, enfoqueFijar,
    alCambiar, recargar, instantanea, borrarTodo,
  };
}

// ── Instancia de la página (localStorage + reloj real) ─────────────────────────────────────────────────────────
function almacenamientoLocal() {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }   // acceder ya puede lanzar
}
const P = crearProgreso({ storage: almacenamientoLocal() });
// Otra pestaña (el IDE y /guias son pestañas distintas del mismo origen) cambió el estado: se relee y se avisa
if (typeof addEventListener === 'function') addEventListener('storage', e => { if (e.key === CLAVE || e.key === null) P.recargar(); });

export const {
  registrarTemario, temarioDe, temarioEdad, leccionDeArchivo,
  ejercicioHecho, ejerciciosHechos, ejercicioEsta, marcarLeccion,
  guiaPaso, guiaRespuesta, guiaEstado,
  siguientePaso, repasoHoy, repasoPendientes, repasoResultado, repasoDe,
  sesionHoy, racha,
  temporizador, temporizadorIniciar, temporizadorPausar, temporizadorReanudar, temporizadorParar,
  notas, notaAgregar, notaBorrar, enfoque, enfoqueFijar,
  alCambiar, recargar, instantanea, borrarTodo,
} = P;
