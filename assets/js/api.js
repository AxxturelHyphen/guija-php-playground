// Cliente de la API. Todos los POST llevan X-Playground: 1 (el servidor rechaza los que no).
// Cada petición va al lenguaje de esta página (?lang=php|python|java).

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

/**
 * api('lint', { body: {...}, signal }) -> datos JSON.
 * Con { raw: true } devuelve {status, data} sin lanzar para 4xx (p. ej. 409 "ya existe").
 */
export async function api(action, { params = {}, body, signal, raw = false } = {}) {
  const qs = new URLSearchParams({ lang: document.documentElement.dataset.lang || 'php', action, ...params });
  const init = { signal, cache: 'no-store' };
  if (body !== undefined) {
    init.method = 'POST';
    init.headers = { 'Content-Type': 'application/json', 'X-Playground': '1' };
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch('/api?' + qs, init);
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('No hay conexión con el servidor del playground. ¿Sigue abierta la ventana de arrancar.bat?', 0, null);
  }
  let data = null;
  try { data = await res.json(); } catch { /* cuerpo vacío o no JSON */ }
  if (raw) return { status: res.status, ok: res.ok, data };
  if (!res.ok) throw new ApiError(data?.error ?? `Error ${res.status}`, res.status, data);
  return data;
}
