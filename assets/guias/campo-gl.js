// Superficie WebGL de la escena «campo» (modo 'superficie'). Sin librerías: una malla indexada con color por vértice
// (la rampa de campo.js), luz lambert + ambiente hemisférico, una malla fina de líneas, caja con marcas y rótulos x, y, z
// en HTML (KaTeX). Se importa de forma perezosa desde campo.js solo si algún paso usa 'superficie'.
//
// RENDER BAJO DEMANDA: no hay bucle; campo.js llama a `dibujar(rot, elev)` al rotar, al cambiar un parámetro o durante un
// tween. La cámara es la MISMA proyección ortográfica de campo.js (`proyectar`, CAM): las capas 2D (punto, corte,
// gradiente, camino…) se reproyectan con ella sobre un canvas transparente superpuesto y casan con la malla.
//
// La parte pura (alturas, normales, índices, matriz, caja, colores) no toca el DOM ni GL al importar: se prueba en Node
// (tests/guias/test-campo.js). Si no hay WebGL, `SuperficieGL.crear` devuelve null y campo.js usa su canvas 2D.
import { rampa, lim, ZS, CAM, TAM } from './campo.js';
import { ticks125, formatear } from './grafica.js';
import { etiqueta } from './mates.js';

// ── Lógica pura ─────────────────────────────────────────────────────────────

/** Alturas normalizadas (zn ∈ [-ZS, ZS], z acotada a [zmin, zmax]) por vértice; NaN donde f no es finita. */
export function alturas(M, zmin, zmax) {
  const n = M.z.length, out = new Float32Array(n), r = zmax - zmin || 1;
  for (let i = 0; i < n; i++) { const z = M.z[i]; out[i] = Number.isFinite(z) ? ZS * (2 * (lim(z, zmin, zmax) - zmin) / r - 1) : NaN; }
  return out;
}

/** Posiciones (nx, ny, nz) en el cubo normalizado; los vértices no finitos quedan en nz = 0 (ningún triángulo los usa). */
export function posiciones(h, N) {
  const W1 = N + 1, out = new Float32Array(W1 * W1 * 3);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * W1 + i, o = 3 * k;
    out[o] = -1 + 2 * i / N; out[o + 1] = -1 + 2 * j / N; out[o + 2] = Number.isNaN(h[k]) ? 0 : h[k];
  }
  return out;
}

/** Normales por vértice (unitarias, espacio normalizado) con diferencias centradas; en bordes o junto a huecos, laterales. */
export function normales(h, N) {
  const W1 = N + 1, out = new Float32Array(W1 * W1 * 3), paso = 2 / N;
  const dif = (k, a, b) => { // derivada en k con vecinos a (anterior) y b (siguiente), si son finitos
    const ta = a >= 0 && !Number.isNaN(h[a]), tb = b >= 0 && !Number.isNaN(h[b]), v = h[k];
    if (ta && tb) return (h[b] - h[a]) / (2 * paso);
    if (tb) return (h[b] - v) / paso;
    if (ta) return (v - h[a]) / paso;
    return 0;
  };
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const k = j * W1 + i, o = 3 * k;
    if (Number.isNaN(h[k])) { out[o + 2] = 1; continue; }
    const gx = dif(k, i > 0 ? k - 1 : -1, i < N ? k + 1 : -1), gy = dif(k, j > 0 ? k - W1 : -1, j < N ? k + W1 : -1), l = Math.hypot(gx, gy, 1);
    out[o] = -gx / l; out[o + 1] = -gy / l; out[o + 2] = 1 / l;
  }
  return out;
}

/** Color por vértice (RGB 0-255) con la rampa de campo.js sobre z real (la rampa acota sola). */
export function colores(M, zmin, zmax) {
  const out = new Uint8Array(M.z.length * 3), r = zmax - zmin || 1;
  for (let k = 0; k < M.z.length; k++) { const c = rampa((M.z[k] - zmin) / r); out[3 * k] = c[0]; out[3 * k + 1] = c[1]; out[3 * k + 2] = c[2]; }
  return out;
}

/** Triángulos (2 por celda) solo de celdas con las 4 esquinas finitas. */
export function indicesRelleno(h, N) {
  const W1 = N + 1, out = new Uint16Array(N * N * 6); let n = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const a = j * W1 + i, b = a + 1, d = a + W1, c = d + 1;
    if (Number.isNaN(h[a]) || Number.isNaN(h[b]) || Number.isNaN(h[c]) || Number.isNaN(h[d])) continue;
    out[n++] = a; out[n++] = b; out[n++] = c; out[n++] = a; out[n++] = c; out[n++] = d;
  }
  return out.subarray(0, n);
}

/** Segmentos de la malla fina: una línea de cada `cada` filas y columnas (la última siempre), solo entre vértices finitos. */
export function indicesMalla(h, N, cada = 6) {
  const W1 = N + 1, out = new Uint16Array(2 * 2 * W1 * (Math.ceil(N / cada) + 1)); let n = 0;
  const lineas = []; for (let t = 0; t <= N; t += cada) lineas.push(t); if (lineas[lineas.length - 1] !== N) lineas.push(N);
  const fin = (a, b) => !Number.isNaN(h[a]) && !Number.isNaN(h[b]);
  for (const t of lineas) for (let s = 0; s < N; s++) {
    const f0 = t * W1 + s, c0 = s * W1 + t; // fila t (avanza en x) y columna t (avanza en y)
    if (fin(f0, f0 + 1)) { out[n++] = f0; out[n++] = f0 + 1; }
    if (fin(c0, c0 + W1)) { out[n++] = c0; out[n++] = c0 + W1; }
  }
  return out.subarray(0, n);
}

/** Matriz 4×4 (columna mayor) que lleva (nx, ny, nz) a clip con la proyección ortográfica de campo.js y su misma
 *  posición en el canvas (CAM, TAM). La profundidad (prof/3) deja lo más cercano con menor z. */
export function matriz(rot, elev, out = new Float32Array(16)) {
  const c = Math.cos(rot), s = Math.sin(rot), ce = Math.cos(elev), se = Math.sin(elev), a = 2 * CAM.sc / TAM.W, b = 2 * CAM.sc / TAM.H;
  out[0] = a * c; out[1] = b * s * se; out[2] = s * ce / 3; out[3] = 0;
  out[4] = -a * s; out[5] = b * c * se; out[6] = c * ce / 3; out[7] = 0;
  out[8] = 0; out[9] = b * ce; out[10] = -se / 3; out[11] = 0;
  out[12] = 2 * CAM.cx / TAM.W - 1; out[13] = 1 - 2 * CAM.cy / TAM.H; out[14] = 0; out[15] = 1;
  return out;
}

/** Qué esquinas/aristas de la caja se ven: `atras` = esquina más lejana (signos ±1), `yf`/`xf` = signo de la arista del suelo
 *  más cercana al espectador en y (borde y = yf) y en x (borde x = xf), `izq` = esquina con el eje z más a la izquierda. */
export function caja(rot, elev, o = {}) {
  const c = Math.cos(rot), s = Math.sin(rot), ce = Math.cos(elev); let mejorP = -Infinity, mejorS = Infinity;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const prof = (a * s + b * c) * ce, sx = a * c - b * s;
    if (prof > mejorP) { mejorP = prof; o.ax = a; o.ay = b; }
    if (sx + prof * 1e-3 < mejorS) { mejorS = sx + prof * 1e-3; o.ix = a; o.iy = b; }
  }
  o.yf = c >= 0 ? -1 : 1; o.xf = s >= 0 ? -1 : 1; // prof(0,y) = y·cos(rot)·…; prof(x,0) = x·sin(rot)·…
  return o;
}

const SOBRE = .07; // longitud de las marcas hacia fuera (espacio normalizado)
/** Rellena `out` (Float32Array) con los segmentos de la caja: primero las PAREDES traseras, luego el SUELO y las marcas.
 *  `t` = {x:[nx…], y:[ny…], z:[nz…]} posiciones normalizadas de las marcas. Devuelve [vérticesParedes, vérticesSuelo]. */
export function lineasCaja(cj, t, out) {
  let n = 0;
  const seg = (a, b, c, d, e, f) => { out[n++] = a; out[n++] = b; out[n++] = c; out[n++] = d; out[n++] = e; out[n++] = f; };
  const { ax, ay } = cj, T = ZS;
  for (const [x, y] of [[ax, ay], [-ax, ay], [ax, -ay]]) seg(x, y, -T, x, y, T); // aristas verticales de las dos paredes del fondo
  seg(ax, ay, T, -ax, ay, T); seg(ax, ay, T, ax, -ay, T); // y sus bordes superiores
  const paredes = n / 3;
  seg(-1, -1, -T, 1, -1, -T); seg(1, -1, -T, 1, 1, -T); seg(1, 1, -T, -1, 1, -T); seg(-1, 1, -T, -1, -1, -T); // suelo
  const yf = cj.yf, xf = cj.xf;
  for (const v of t.x) seg(v, yf, -T, v, yf * (1 + SOBRE), -T);
  for (const v of t.y) seg(xf, v, -T, xf * (1 + SOBRE), v, -T);
  for (const v of t.z) seg(cj.ix, cj.iy, v, cj.ix * (1 + SOBRE), cj.iy * (1 + SOBRE), v);
  return [paredes, n / 3 - paredes];
}
export const MAX_VERT_CAJA = 2 * (5 + 4 + 3 * 9); // paredes + suelo + hasta 9 marcas por eje

/** Color CSS (#rgb, #rrggbb, #rrggbbaa, rgb[a]()) → [r,g,b,a] en 0..1; `def` si no se entiende. */
export function colorGL(css, def = [.6, .6, .6, 1]) {
  const s = String(css ?? '').trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map(h => parseInt(h + h, 16) / 255).concat(1);
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).concat(m[2] ? parseInt(m[2], 16) / 255 : 1);
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+))?/i.exec(s);
  if (m) return [m[1] / 255, m[2] / 255, m[3] / 255, m[4] === undefined ? 1 : +m[4]];
  return def;
}

// ── Rótulos de ejes (HTML sobre el canvas) ──────────────────────────────────
/** Marcas y títulos x, y, z como <div> con transform; solo se tocan al rotar. Los textos se fijan en `fijar` (una vez por
 *  apertura o cambio de idioma): las fórmulas KaTeX nunca se renderizan por fotograma. */
export class Ejes {
  constructor(el) { this.el = el; this.rot = []; this.t = { x: [], y: [], z: [] }; this.u = { x: [], y: [], z: [] }; this.tit = {}; this.lang = null; }

  fijar(win, zmin, zmax, lang) {
    this.lang = lang; const [x0, x1, y0, y1] = win, nodos = [];
    const marcas = (lo, hi, k, norm) => ticks125(lo, hi, k).filter(v => v >= lo - 1e-9 && v <= hi + 1e-9).slice(0, 9).map(v => [v, norm(v)]);
    const def = {
      x: marcas(x0, x1, 5, v => 2 * (v - x0) / (x1 - x0) - 1), y: marcas(y0, y1, 5, v => 2 * (v - y0) / (y1 - y0) - 1),
      z: marcas(zmin, zmax, 5, v => ZS * (2 * (v - zmin) / (zmax - zmin) - 1)),
    };
    this.rot = [];
    for (const e of ['x', 'y', 'z']) {
      this.t[e] = def[e].map(([, n]) => n); this.u[e] = def[e].map(([v]) => v);
      for (const [v] of def[e]) { const d = document.createElement('div'); d.className = 'eje-marca'; d.textContent = formatear(v, lang); nodos.push(d); this.rot.push({ d, e, i: this.rot.length, titulo: false, s: '' }); }
    }
    for (const e of ['x', 'y', 'z']) { const d = document.createElement('div'); d.className = 'eje-titulo'; etiqueta(d, `$${e}$`); nodos.push(d); this.rot.push({ d, e, titulo: true, s: '' }); }
    this.el.replaceChildren(...nodos);
    let k = { x: 0, y: 0, z: 0 }; for (const r of this.rot) if (!r.titulo) r.k = k[r.e]++;
  }

  /** Posiciona cada rótulo según la cámara. Solo escribe `transform` y solo si cambió. */
  colocar(rot, elev, cj) {
    const c = Math.cos(rot), s = Math.sin(rot), ce = Math.cos(elev), se = Math.sin(elev), { sc, cx, cy } = CAM, T = ZS;
    for (const r of this.rot) {
      let x, y, z;
      if (r.titulo) {
        if (r.e === 'x') { x = 0; y = cj.yf * 1.42; z = -T; } else if (r.e === 'y') { x = cj.xf * 1.42; y = 0; z = -T; } else { x = cj.ix * 1.24; y = cj.iy * 1.24; z = T + .16; }
      } else {
        const v = this.t[r.e][r.k];
        if (r.e === 'x') { x = v; y = cj.yf * 1.2; z = -T; } else if (r.e === 'y') { x = cj.xf * 1.2; y = v; z = -T; } else { x = cj.ix * 1.24; y = cj.iy * 1.24; z = v; }
      }
      const yr = x * s + y * c, px = cx + (x * c - y * s) * sc, py = cy - (z * ce + yr * se) * sc;
      const str = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,-50%)`;
      if (r.s !== str) { r.s = str; r.d.style.transform = str; }
    }
  }
}

// ── Renderizador WebGL ──────────────────────────────────────────────────────
const VS_MALLA = `
attribute vec3 p; attribute vec3 n; attribute vec3 c;
uniform mat4 m; uniform vec4 cam; // cam = cos(rot), sin(rot), cos(elev), sin(elev)
varying vec3 vc;
void main() {
  float xr = n.x * cam.x - n.y * cam.y, yr = n.x * cam.y + n.y * cam.x;
  vec3 v = vec3(xr, n.z * cam.z + yr * cam.w, n.z * cam.w - yr * cam.z); // normal en el espacio de la vista (z hacia el espectador)
  if (v.z < 0.) v = -v;                                                   // la superficie se ve por las dos caras
  float lam = max(dot(v, normalize(vec3(-.42, .55, .72))), 0.);
  float amb = .62 + .18 * abs(n.z);                                       // ambiente hemisférico: más claro mirando arriba
  vc = c * (amb + (1. - amb) * lam);                                      // nunca supera el color de la rampa
  gl_Position = m * vec4(p, 1.);
}`;
const FS_MALLA = 'precision mediump float; varying vec3 vc; void main() { gl_FragColor = vec4(vc, 1.); }';
const VS_LINEA = 'attribute vec3 p; uniform mat4 m; void main() { gl_Position = m * vec4(p, 1.); }';
const FS_LINEA = 'precision mediump float; uniform vec4 col; void main() { gl_FragColor = col; }';

export class SuperficieGL {
  /** → instancia o null (sin WebGL). `cv` es un <canvas> propio. */
  static crear(cv) {
    let gl = null;
    try { gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, depth: true, stencil: false, powerPreference: 'default' }); } catch { /* sin WebGL */ }
    if (!gl) return null;
    try { return new SuperficieGL(cv, gl); } catch { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* nada */ } return null; }
  }

  constructor(cv, gl) {
    this.cv = cv; this.gl = gl;
    this.pm = this.programa(VS_MALLA, FS_MALLA, ['p', 'n', 'c']); this.pl = this.programa(VS_LINEA, FS_LINEA, ['p']);
    this.um = { m: gl.getUniformLocation(this.pm, 'm'), cam: gl.getUniformLocation(this.pm, 'cam') };
    this.ul = { m: gl.getUniformLocation(this.pl, 'm'), col: gl.getUniformLocation(this.pl, 'col') };
    this.m = new Float32Array(16); this.cajaV = new Float32Array(MAX_VERT_CAJA * 3); this.cj = {};
    this.buf = { pos: gl.createBuffer(), nor: gl.createBuffer(), col: gl.createBuffer(), tri: gl.createBuffer(), mal: gl.createBuffer(), caja: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf.caja); gl.bufferData(gl.ARRAY_BUFFER, this.cajaV.byteLength, gl.DYNAMIC_DRAW);
    this.nTri = this.nMal = 0; this.t = { x: [], y: [], z: [] };
    this.cSuelo = [.5, .52, .56, .9]; this.cPared = [.3, .32, .35, .6]; this.cMalla = [.02, .02, .03, .3];
    gl.clearColor(0, 0, 0, 0); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  programa(vs, fs, atributos) {
    const gl = this.gl, sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    atributos.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'enlace');
    return p;
  }

  /** Colores del tema: suelo/marcas, paredes y malla fina. Premultiplicados (el canvas usa alfa premultiplicado). */
  tema(suelo, pared) {
    const pm = ([r, g, b, a]) => [r * a, g * a, b * a, a];
    this.cSuelo = pm(colorGL(suelo, [.55, .57, .6, 1])); this.cPared = pm(colorGL(pared, [.3, .32, .35, 1]).map((v, i) => (i === 3 ? .7 : v)));
  }

  /** Sube la malla (una vez por apertura). `ticks` = {x,y,z} normalizados para las marcas del suelo. */
  cargar(M, zmin, zmax, ticks) {
    const gl = this.gl, N = M.N, h = alturas(M, zmin, zmax), sube = (b, d, tipo = gl.ARRAY_BUFFER, uso = gl.STATIC_DRAW) => { gl.bindBuffer(tipo, b); gl.bufferData(tipo, d, uso); };
    sube(this.buf.pos, posiciones(h, N)); sube(this.buf.nor, normales(h, N)); sube(this.buf.col, colores(M, zmin, zmax));
    const tri = indicesRelleno(h, N), mal = indicesMalla(h, N, 6);
    sube(this.buf.tri, tri, gl.ELEMENT_ARRAY_BUFFER); sube(this.buf.mal, mal, gl.ELEMENT_ARRAY_BUFFER);
    this.nTri = tri.length; this.nMal = mal.length; this.t = ticks;
  }

  tamano(w, h) { if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; } }

  get perdido() { return this.gl.isContextLost(); }

  /** Un fotograma. `cj` = caja(rot, elev) ya calculada (la comparte Ejes.colocar). */
  dibujar(rot, elev, cj) {
    const gl = this.gl, b = this.buf;
    if (gl.isContextLost()) return;
    matriz(rot, elev, this.m);
    gl.viewport(0, 0, this.cv.width, this.cv.height); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 1) malla rellena
    gl.useProgram(this.pm); gl.uniformMatrix4fv(this.um.m, false, this.m); gl.uniform4f(this.um.cam, Math.cos(rot), Math.sin(rot), Math.cos(elev), Math.sin(elev));
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.nor); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.col); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.tri); gl.drawElements(gl.TRIANGLES, this.nTri, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    // 2) malla fina (mismos vértices) y 3) caja con marcas
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    gl.useProgram(this.pl); gl.uniformMatrix4fv(this.ul.m, false, this.m);
    gl.uniform4fv(this.ul.col, this.cMalla); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.mal); gl.drawElements(gl.LINES, this.nMal, gl.UNSIGNED_SHORT, 0);
    const [vp, vs] = lineasCaja(cj, this.t, this.cajaV);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.caja); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.cajaV); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.uniform4fv(this.ul.col, this.cPared); gl.drawArrays(gl.LINES, 0, vp);
    gl.uniform4fv(this.ul.col, this.cSuelo); gl.drawArrays(gl.LINES, vp, vs);
    gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
  }

  /** Libera GPU (buffers, programas y el contexto). Tras esto el objeto no sirve. */
  liberar() {
    const gl = this.gl; if (!gl) return;
    try {
      for (const k in this.buf) gl.deleteBuffer(this.buf[k]);
      gl.deleteProgram(this.pm); gl.deleteProgram(this.pl);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* contexto ya perdido */ }
    this.gl = null;
  }
}
