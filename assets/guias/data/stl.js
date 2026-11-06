// Guía «STL: contenedores». Mismo formato de paso que data/punteros.js (parche sobre el paso anterior):
//   celdas / zonas / grupos / mostrar / ocultar / fantasma / val / code / line / hl / sec / jugar / pregunta
// Convenciones de esta guía:
//   · `·` = hueco reservado sin elemento · `—` = sin memoria (aún no reservada o ya liberada)
//   · las direcciones del heap empiezan por 0x55b2c… y las de la pila por 0x7ffd5e…
const cel = (id, addr, name, type, size, col = 0, grupo) => ({ id, addr, name, type, size, col, ...(grupo && { grupo }) });
// Zonas: 'datos' cuando la columna mezcla variables y bloques del heap; 'heap' cuando solo hay memoria dinámica.
// Grupos: el objeto (variables locales del contenedor) y cada bloque del heap.
const GV = { id: 'gv', titulo: 'vector<int> v' };
const gbuf = (id, es, en) => ({ id, titulo: { es, en } });
const ZMEM = [{ col: 0, titulo: { es: 'Memoria', en: 'Memory' }, tono: 'datos' }];
const d = (base, off) => '0x' + (base + off).toString(16);
const ids = (pre, n) => Array.from({ length: n }, (_, i) => pre + i);
const hs = (k, lista) => Object.fromEntries(lista.map(i => [i, k]));
const fila = (lista, valores) => Object.fromEntries(lista.map((id, i) => [id, valores[i]]));

const STK = 0x7ffd5e2c1a40;   // variables locales (pila)
const BA = 0x55b2c4e712a0;    // bloque del vector (capacidad 4)
const BB = 0x55b2c4e712d0;    // bloque del vector (capacidad 8)
const A = ids('a', 4), B = ids('b', 8);

// ── Escena V0: vector, size y capacity (una columna) ─────────────
const V0 = [
  cel('vd', d(STK, 0), 'v.data', 'int*', 8, 0, 'gv'), cel('vn', d(STK, 8), 'v.size', 'size_t', 8, 0, 'gv'), cel('vc', d(STK, 16), 'v.capacity', 'size_t', 8, 0, 'gv'),
  ...A.map((id, i) => cel(id, d(BA, 4 * i), `v[${i}]`, 'int', 4, 0, 'gb')),
];
const GV0 = [GV, gbuf('gb', 'buffer (heap)', 'buffer (heap)')];
const C0 = `vector<int> v;
v.reserve(4);
v.push_back(10);
v.push_back(20);
v.push_back(30);`;

// ── Escena V1: crecer = reservar otro bloque (dos columnas) ──────
const V1 = [
  cel('vd', d(STK, 0), 'v.data', 'int*', 8, 0, 'gv'), cel('vn', d(STK, 8), 'v.size', 'size_t', 8, 0, 'gv'), cel('vc', d(STK, 16), 'v.capacity', 'size_t', 8, 0, 'gv'),
  cel('p', d(STK, 24), 'p', 'int*', 8),
  ...A.map((id, i) => cel(id, d(BA, 4 * i), `[${i}]`, 'int', 4, 0, 'ga')),
  ...B.map((id, i) => cel(id, d(BB, 4 * i), `[${i}]`, 'int', 4, 1, 'gb')),
];
const GV1 = [GV, gbuf('ga', 'buffer antiguo (capacidad 4)', 'old buffer (capacity 4)'), gbuf('gb', 'buffer nuevo (capacidad 8)', 'new buffer (capacity 8)')];
const ZV1 = [{ col: 0, titulo: { es: 'variables y buffer antiguo', en: 'variables and old buffer' }, tono: 'datos' }, { col: 1, titulo: { es: 'buffer nuevo', en: 'new buffer' }, tono: 'heap' }];
const C1 = {
  es: `// v = {10, 20, 30}, capacidad 4
int* p = &v[0];
v.push_back(40);
v.push_back(50);
cout << *p;`,
  en: `// v = {10, 20, 30}, capacity 4
int* p = &v[0];
v.push_back(40);
v.push_back(50);
cout << *p;`,
};

// Interactivo del vector: dos bloques (4 y 8). Con capacidad 4 los datos están en `a`, con 8 en `b`.
const slotV = (v, i) => (v.vc === 4 ? 'a' : 'b') + i;
const realoca = v => {
  for (let i = 0; i < 8; i++) v['b' + i] = i < v.vn ? v['a' + i] : '·';
  for (let i = 0; i < 4; i++) v['a' + i] = '—';
  v.vc = 8; v.vd = '→b0';
};

// ── Escena V2: insertar en medio ─────────────────────────────────
const E8 = ids('e', 8);
const V2 = [
  cel('vn', d(STK, 8), 'v.size', 'size_t', 8, 0, 'gv'),
  ...E8.map((id, i) => cel(id, d(BB, 4 * i), `v[${i}]`, 'int', 4, 0, 'gb')),
];
const GV2 = [GV, gbuf('gb', 'buffer (heap)', 'buffer (heap)')];
const C2 = `// v = {10, 20, 30, 40, 50}
v.insert(v.begin() + 1, 99);`;

// ── Escena L: list frente a vector ───────────────────────────────
const W = ids('w', 4);
const NL = ids('n', 5);
const DL = [0x55b2c4e73e10, 0x55b2c4e7a1c0, 0x55b2c4e71f50, 0x55b2c4e78830, 0x55b2c4e76d20];
const DATOS = [10, 20, 30, 40, 99];
const L1 = [
  ...W.map((id, i) => cel(id, d(BA, 4 * i), `v[${i}]`, 'int', 4)),
  cel('it', d(STK, 48), 'it', { es: 'iterador', en: 'iterator' }, 8),
  ...NL.map((id, i) => cel(id, d(DL[i], 0), { es: `nodo ${i}`, en: `node ${i}` }, { es: `dato = ${DATOS[i]}`, en: `data = ${DATOS[i]}` }, 24, 1)),
];
const ZL = [{ col: 0, titulo: { es: 'vector (contiguo)', en: 'vector (contiguous)' }, tono: 'datos' }, { col: 1, titulo: { es: 'list (nodos sueltos)', en: 'list (separate nodes)' }, tono: 'heap' }];
const CL = `vector<int> v = {10, 20, 30, 40};
list<int>   l = {10, 20, 30, 40};
auto it = next(l.begin(), 2);
l.insert(it, 99);`;

// ── Escenas M: unordered_map (4 cubos y, tras el rehash, 8) ──────
const NODOS = [
  cel('n12', d(0x55b2c4e8f3a0, 0), { es: 'nodo 12', en: 'node 12' }, '12 → "Ana"', 0, 1),
  cel('n9', d(0x55b2c4e8fa10, 0), { es: 'nodo 9', en: 'node 9' }, '9 → "Eva"', 0, 1),
  cel('n7', d(0x55b2c4e8f3d0, 0), { es: 'nodo 7', en: 'node 7' }, '7 → "Luis"', 0, 1),
  cel('n19', d(0x55b2c4e8f9b0, 0), { es: 'nodo 19', en: 'node 19' }, '19 → "Rosa"', 0, 1),
  cel('n6', d(0x55b2c4e8f430, 0), { es: 'nodo 6', en: 'node 6' }, '6 → "Leo"', 0, 1),
];
NODOS.forEach(c => { delete c.size; });
const cubo = (id, base, i) => cel(id, d(base, 8 * i), { es: `cubo [${i}]`, en: `bucket [${i}]` }, { es: '→ nodo', en: '→ node' }, 8);
const K = ids('k', 4), R = ids('r', 8);
const M1 = [...K.map((id, i) => cubo(id, 0x55b2c4e90100, i)), ...NODOS];
const M2 = [...R.map((id, i) => cubo(id, 0x55b2c4e90180, i)), ...NODOS];
const ZM = [{ col: 0, titulo: { es: 'cubos (array)', en: 'buckets (array)' }, tono: 'heap' }, { col: 1, titulo: { es: 'nodos', en: 'nodes' }, tono: 'heap' }];
const CM = {
  es: `unordered_map<int, string> m;   // 4 cubos (de ejemplo)
m[12] = "Ana"; m[9] = "Eva"; m[7] = "Luis";
m[19] = "Rosa";
auto it = m.find(19);
m[6] = "Leo";`,
  en: `unordered_map<int, string> m;   // 4 buckets (just an example)
m[12] = "Ana"; m[9] = "Eva"; m[7] = "Luis";
m[19] = "Rosa";
auto it = m.find(19);
m[6] = "Leo";`,
};

// ── Escena P: claves ordenadas y búsqueda binaria ────────────────
const KEYS = [3, 8, 15, 21, 27, 34, 40];
const Q = ids('q', 7);
const P = Q.map((id, i) => cel(id, d(0x55b2c4e7b010, 4 * i), `#${i}`, { es: 'clave', en: 'key' }, 4));
const ZP1 = [{ col: 0, titulo: { es: 'claves ordenadas', en: 'sorted keys' }, tono: 'datos' }];
const CP1 = `map<int, string> m = {{3,"a"}, {8,"b"}, {15,"c"}, {21,"d"}, {27,"e"}, {34,"f"}, {40,"g"}};
auto it = m.find(27);
auto lb = m.lower_bound(20);
for (auto& [k, v] : m) cout << k;`;
const CP2 = {
  es: `int lo = 0, hi = 6;             // claves ordenadas
while (lo <= hi) {
    int mid = (lo + hi) / 2;
    if (k[mid] == 27) break;      // encontrada
    if (k[mid] < 27) lo = mid + 1;
    else             hi = mid - 1;
}`,
  en: `int lo = 0, hi = 6;             // sorted keys
while (lo <= hi) {
    int mid = (lo + hi) / 2;
    if (k[mid] == 27) break;      // found
    if (k[mid] < 27) lo = mid + 1;
    else             hi = mid - 1;
}`,
};

// ── Escena H: montículo (priority_queue) ─────────────────────────
const HP = ids('h', 8);
const H = [
  cel('hn', d(STK, 8), 'pq.size()', 'size_t', 8, 0, 'gq'),
  ...HP.map((id, i) => cel(id, d(0x55b2c4e7c0a0, 4 * i), `h[${i}]`, 'int', 4, 0, 'gb')),
];
const GH = [{ id: 'gq', titulo: 'priority_queue<int> pq' }, gbuf('gb', 'vector interno (heap)', 'inner vector (heap)')];
const CH = {
  es: `priority_queue<int> pq;   // 50 30 40 10 20 35 15
pq.top();                  // 50
pq.push(45);
pq.pop();`,
  en: `priority_queue<int> pq;   // 50 30 40 10 20 35 15
pq.top();                 // 50
pq.push(45);
pq.pop();`,
};
const leer = v => HP.slice(0, v.hn).map(k => v[k]);
const poner = (v, a) => { HP.forEach((k, i) => { v[k] = i < a.length ? a[i] : '·'; }); v.hn = a.length; };
const subir = (a, x) => {
  a.push(x);
  let i = a.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (a[p] >= a[i]) break;
    [a[p], a[i]] = [a[i], a[p]]; i = p;
  }
  return a;
};
const bajar = a => {
  const ult = a.pop();
  if (!a.length) return a;
  a[0] = ult;
  let i = 0;
  for (;;) {
    const l = 2 * i + 1, r = l + 1;
    let m = i;
    if (l < a.length && a[l] > a[m]) m = l;
    if (r < a.length && a[r] > a[m]) m = r;
    if (m === i) break;
    [a[m], a[i]] = [a[i], a[m]]; i = m;
  }
  return a;
};

// ── Escena R: qué contenedor elijo (una «tarjeta» por contenedor) ─
const RES = [
  cel('cv', '#1', 'vector', { es: 'v[i] · por defecto', en: 'v[i] · default' }, 0),
  cel('cu', '#2', 'unordered_map', { es: 'buscar clave · sin orden', en: 'find key · unordered' }, 0),
  cel('cm', '#3', 'map', { es: 'buscar clave · ordenado', en: 'find key · ordered' }, 0),
  cel('cp', '#4', 'priority_queue', { es: 'top() · el mayor ahora', en: 'top() · the max now' }, 0),
  cel('cl', '#5', 'list', { es: 'insertar · casi nunca', en: 'insert · rarely' }, 0),
];
RES.forEach(c => { delete c.size; });

export default {
  titulo: { es: 'STL: contenedores', en: 'STL: containers' },
  fuentes: [
    '*std::list*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/list',
    '*std::map*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/map',
    '*std::priority_queue*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/priority_queue',
    '*std::unordered_map*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/unordered_map',
    '*std::vector*. (n.d.). cppreference.com. Retrieved November 6, 2026, from https://en.cppreference.com/w/cpp/container/vector',
    'Stroustrup, B. (2022). *A tour of C++* (3rd ed.). Addison-Wesley.',
  ],
  pasos: [
    // ── vector: memoria contigua ──
    { sec: { es: 'vector: memoria contigua', en: 'vector: contiguous memory' }, leyenda: ['activo', 'hecho'], celdas: V0, zonas: ZMEM, grupos: GV0, code: C0, line: 2,
      mostrar: ['vd', 'vn', 'vc', ...A], val: { vd: '→a0', vn: 0, vc: 4, ...fila(A, ['·', '·', '·', '·']) }, hl: hs('a', A),
      es: '`vector<int>` es un array dinámico: sus elementos viven juntos en un bloque del heap. El objeto `v` guarda, conceptualmente, un puntero al bloque, `size` (cuántos hay) y `capacity` (cuántos caben); libstdc++ usa tres punteros, la idea es la misma. `reserve(4)` reserva sitio para 4 `int` sin crear ninguno: `·` es un hueco sin elemento.',
      en: '`vector<int>` is a dynamic array: its elements live together in one heap block. The object `v` holds, conceptually, a pointer to the block, `size` (how many there are) and `capacity` (how many fit); libstdc++ uses three pointers, the idea is the same. `reserve(4)` sets aside room for 4 `int` without creating any: `·` is a slot with no element.' },
    { line: 5, val: { vn: 3, ...fila(A, [10, 20, 30, '·']) }, hl: { ...hs('b', A.slice(0, 3)), vn: 'a' },
      es: 'Tras tres `push_back`, `size` vale 3 y `capacity` sigue en 4. Cada `push_back` escribe en el primer hueco libre y sube `size`: coste constante mientras quede sitio, sin memoria nueva ni movimientos.',
      en: 'After three `push_back` calls, `size` is 3 and `capacity` is still 4. Each `push_back` writes into the first free slot and bumps `size`: constant cost while there is room, with no new memory and no moving.' },
    { line: null, hl: { vd: 'a', a2: 'b' },
      es: 'Los elementos están **pegados**: las direcciones suben de 4 en 4 (`sizeof(int)`). Por eso `v[i]` es una cuenta, $\\text{dir}(v[i]) = \\text{data} + i \\cdot \\text{sizeof}(T)$, y cuesta $O(1)$. Y recorrerlo en orden es lo más amable con la caché del procesador.',
      en: 'The elements sit **side by side**: addresses go up by 4 (`sizeof(int)`). That is why `v[i]` is just arithmetic, $\\text{addr}(v[i]) = \\text{data} + i \\cdot \\text{sizeof}(T)$, and costs $O(1)$. Walking it in order is also the friendliest pattern for the CPU cache.' },

    // ── vector: crecer ──
    { celdas: V1, zonas: ZV1, grupos: GV1, code: C1, line: 2, mostrar: ['vd', 'vn', 'vc', 'p', ...A],
      val: { vd: '→a0', vn: 3, vc: 4, p: '→a0', ...fila(A, [10, 20, 30, '·']) }, hl: { p: 'a', a0: 'b' },
      es: 'Mismo vector, ahora en dos columnas: a la izquierda las variables y el buffer actual; a la derecha, donde irá un buffer nuevo si hace falta crecer. Guardamos también `p = &v[0]`, la dirección del primer elemento (`p` es un puntero normal).',
      en: 'Same vector, now in two columns: on the left the variables and the current buffer; on the right, where a new buffer will go if it has to grow. We also keep `p = &v[0]`, the address of the first element (`p` is a plain pointer).' },
    { line: 3, val: { vn: 4, a3: 40 }, hl: { a3: 'b', vn: 'a' },
      es: '`push_back(40)` ocupa el último hueco: `size` = 4 = `capacity`. Sigue sin haber memoria nueva. El vector está **lleno**.',
      en: '`push_back(40)` takes the last slot: `size` = 4 = `capacity`. Still no new memory. The vector is **full**.' },
    { line: 4, mostrar: B, val: fila(B, B.map(() => '·')), hl: { vn: 'c', vc: 'c', ...hs('a', B) },
      es: 'Ahora `size == capacity`: no hay hueco, así que `push_back` tiene que crecer. **1)** Reservar un bloque mayor. libstdc++ y libc++ duplican (8 `int` = 32 B); MSVC multiplica por 1,5. El estándar no fija el factor: exige coste amortizado constante.',
      en: 'Now `size == capacity`: there is no room, so `push_back` has to grow. **1)** Reserve a bigger block. libstdc++ and libc++ double it (8 `int` = 32 B); MSVC multiplies by 1.5. The standard does not fix the factor: it requires constant amortized cost.' },
    { line: 4, val: fila(B.slice(0, 5), [10, 20, 30, 40, 50]), hl: { ...hs('a', A), ...hs('b', B.slice(0, 5)) },
      es: '**2)** Se copian (o se mueven, si el tipo tiene constructor de movimiento `noexcept`) los 4 elementos al bloque nuevo y se escribe el 50 en el hueco siguiente. Con `int` son 4 copias: realocar cuesta $O(n)$.',
      en: '**2)** The 4 elements are copied (or moved, if the type has a `noexcept` move constructor) into the new block and the 50 is written in the next slot. With `int` that is 4 copies: reallocating costs $O(n)$.' },
    { line: 4, fantasma: A, val: { vd: '→b0', vn: 5, vc: 8 }, hl: { vd: 'a', vn: 'a', vc: 'a' },
      es: '**3)** Se actualizan `data`, `size` y `capacity`, y se libera el bloque antiguo (`operator delete`). Los 4 huecos de la izquierda ya no son nuestros: aparecen discontinuos. Fíjate en que la dirección de `v[0]` ha cambiado: de `0x…12a0` a `0x…12d0`.',
      en: '**3)** `data`, `size` and `capacity` are updated and the old block is freed (`operator delete`). The 4 slots on the left are no longer ours: they appear dashed. Note that the address of `v[0]` has changed: from `0x…12a0` to `0x…12d0`.' },
    { line: 5, hl: { p: 'c', a0: 'c' },
      es: '`p` sigue guardando la dirección vieja: es un **puntero colgante**, y `*p` es comportamiento indefinido. Lo mismo vale para referencias a elementos e iteradores (`begin()`…): si `push_back` realoca, **todos** quedan invalidados. Si no realoca, solo `end()`.',
      en: '`p` still holds the old address: it is a **dangling pointer**, and `*p` is undefined behavior. The same goes for references to elements and iterators (`begin()`…): if `push_back` reallocates, **all** of them are invalidated. If it does not, only `end()` is.' },
    { line: null,
      es: 'Un `push_back` suelto puede costar $O(n)$, pero casi todos cuestan $O(1)$. Con capacidad que se duplica, las copias de todas las realocaciones suman $1+2+4+\\dots+2^k<2n$. Así, $n$ inserciones cuestan menos de $3n$ operaciones: $O(1)$ **amortizado** por inserción.',
      en: 'A single `push_back` can cost $O(n)$, but almost all cost $O(1)$. With a capacity that doubles, the copies of all reallocations add up to $1+2+4+\\dots+2^k<2n$. So $n$ insertions cost fewer than $3n$ operations: $O(1)$ **amortized** per insertion.' },
    { line: null,
      es: 'Si sabes cuántos elementos vas a guardar, `v.reserve(n)` reserva el bloque de una vez: no habrá realocaciones y los punteros a elementos seguirán válidos mientras `size <= capacity`. Ojo: `reserve` cambia `capacity`, no `size` (eso es `resize`). Crecer sumando una constante, en vez de multiplicar, saldría a $O(n)$ por inserción.',
      en: 'If you know how many elements you will store, `v.reserve(n)` reserves the block up front: no reallocations later, and pointers to elements stay valid while `size <= capacity`. Careful: `reserve` changes `capacity`, not `size` (that is `resize`). Growing by adding a constant instead of multiplying would cost $O(n)$ per insertion.' },
    { line: null, hl: { p: 'c' },
      es: 'Imagina que antes de `int* p = &v[0];` hubiéramos llamado a `v.reserve(8);`. Tras los dos `push_back`, ¿seguiría siendo válido `*p`?',
      en: 'Imagine that before `int* p = &v[0];` we had called `v.reserve(8);`. After the two `push_back` calls, would `*p` still be valid?',
      pregunta: {
        opc: [
          { es: 'Sí: con capacidad 8 no hay realocación y el bloque no se mueve', en: 'Yes: with capacity 8 there is no reallocation and the block does not move', ok: 1 },
          { es: 'No: `push_back` siempre invalida los punteros', en: 'No: `push_back` always invalidates pointers' },
          { es: 'Depende del compilador', en: 'It depends on the compiler' },
        ],
        why: {
          es: 'Con `reserve(8)` el estándar garantiza que no hay realocación mientras `size` no supere `capacity`: `p` sigue apuntando a `v[0]`. Sin `reserve`, el segundo `push_back` realoca y `p` cuelga.',
          en: 'With `reserve(8)` the standard guarantees no reallocation while `size` does not exceed `capacity`: `p` still points to `v[0]`. Without `reserve`, the second `push_back` reallocates and `p` dangles.',
        },
      } },
    { line: null, ocultar: ['p'], mostrar: [...A, ...B],
      val: { vd: '→a0', vn: 3, vc: 4, ...fila(A, [10, 20, 30, '·']), ...fila(B, B.map(() => '—')) },
      es: 'Pruébalo: añade elementos y mira `size`, `capacity` y la dirección de `data()`: solo cambia al realocar. Pasar de 4 a 5 copia 4 elementos. `pop_back` nunca reduce `capacity`. Con `size` y `capacity` en rojo, el siguiente `push_back` realoca. `—` = sin memoria.',
      en: 'Try it: add elements and watch `size`, `capacity` and the address of `data()`: it only changes on reallocation. Going from 4 to 5 copies 4 elements. `pop_back` never shrinks `capacity`. With `size` and `capacity` in red, the next `push_back` reallocates. `—` = no memory.',
      jugar: {
        botones: [
          { label: 'push_back', hacer: v => { if (v.vn === v.vc) realoca(v); v[slotV(v, v.vn)] = 10 * (v.vn + 1); v.vn++; }, off: v => v.vn >= 8 },
          { label: 'pop_back', hacer: v => { v.vn--; v[slotV(v, v.vn)] = '·'; }, off: v => v.vn <= 0 },
          { label: 'reserve(8)', hacer: v => realoca(v), off: v => v.vc === 8 },
        ],
        lecturas: (v, { cel }) => [
          { expr: 'v.size()', valor: v.vn },
          { expr: 'v.capacity()', valor: v.vc },
          { expr: 'v.data()', valor: cel[v.vc === 4 ? 'a0' : 'b0'].addr },
        ],
        hl: v => {
          const h = { vd: 'a' };
          if (v.vn === v.vc) { h.vn = 'c'; h.vc = 'c'; } else h[slotV(v, v.vn)] = 'a';
          return h;
        },
      } },

    // ── vector: insertar en medio ──
    { celdas: V2, zonas: ZMEM, grupos: GV2, code: C2, line: 2, mostrar: ['vn', ...E8], val: { vn: 5, ...fila(E8, [10, 20, 30, 40, 50, '·', '·', '·']) }, hl: hs('a', E8.slice(1, 5)),
      es: 'Insertar en medio: `v.insert(v.begin() + 1, 99)`. Como los elementos son contiguos, hay que abrir hueco en la posición 1: los 4 elementos desde ahí (en azul) se desplazan una posición a la derecha, empezando por el último.',
      en: 'Inserting in the middle: `v.insert(v.begin() + 1, 99)`. Since the elements are contiguous, a gap has to be opened at position 1: the 4 elements from there (in blue) shift one position to the right, starting with the last one.' },
    { val: { vn: 6, ...fila(E8, [10, 99, 20, 30, 40, 50, '·', '·']) }, hl: { e1: 'b', ...hs('a', E8.slice(2, 6)) },
      es: 'Se desplazaron 4 elementos y el 99 ocupa `v[1]`. Coste: $O(n-i)$ movimientos; al final es $O(1)$ amortizado y al principio $O(n)$. `erase` es simétrico. Los iteradores desde la posición de inserción quedan invalidados (todos, si hubo realocación).',
      en: '4 elements were shifted and the 99 now sits at `v[1]`. Cost: $O(n-i)$ moves; at the end it is $O(1)$ amortized and at the front $O(n)$. `erase` is symmetric. Iterators from the insertion point onward are invalidated (all of them if it reallocated).' },

    // ── list frente a vector ──
    { sec: { es: 'list frente a vector', en: 'list vs vector' }, celdas: L1, zonas: ZL, code: CL, line: 2,
      mostrar: [...W, ...NL.slice(0, 4)],
      val: { ...fila(W, [10, 20, 30, 40]), n0: '→n1', n1: '→n2', n2: '→n3', n3: '→∅' },
      es: 'Mismos cuatro datos, dos estructuras. `vector`: un bloque con los elementos pegados. `list`: cada elemento es un **nodo** aparte (una asignación por elemento; 24 B para un `int`: dato más `prev` y `next`) y los nodos pueden estar en cualquier sitio. Dibujamos solo `next`; la `list` real también guarda `prev` y es circular.',
      en: 'The same four values, two structures. `vector`: one block with the elements side by side. `list`: each element is a separate **node** (one allocation per element; 24 B for an `int`: data plus `prev` and `next`) and nodes may be anywhere. We draw only `next`; the real `list` also stores `prev` and is circular.' },
    { line: 3, mostrar: ['it'], val: { it: '→n2' }, hl: { w2: 'b', n0: 'a', n1: 'a', n2: 'b', it: 'a' },
      es: 'Para llegar al tercer elemento de una `list` hay que seguir los `next` uno a uno: `next(l.begin(), 2)` salta 2 nodos, $O(n)$. No existe `l[2]`. En el vector, `v[2]` es una cuenta de direcciones: $O(1)$.',
      en: 'To reach the third element of a `list` you must follow the `next` pointers one by one: `next(l.begin(), 2)` hops over 2 nodes, $O(n)$. There is no `l[2]`. In the vector, `v[2]` is address arithmetic: $O(1)$.' },
    { line: 4, mostrar: ['n4'], val: { n4: '→n2', n1: '→n4' }, hl: { n4: 'b', n1: 'a', it: 'a' },
      es: '`l.insert(it, 99)` crea un nodo y re-enlaza solo a sus vecinos (`next` y `prev`): unos pocos punteros, sin mover ningún dato. $O(1)$ con el iterador en la mano. Los demás nodos no se mueven, así que sus iteradores y referencias siguen válidos.',
      en: '`l.insert(it, 99)` creates a node and re-links only its neighbors (`next` and `prev`): a few pointers, no data moved. $O(1)$ with the iterator in hand. The other nodes do not move, so their iterators and references stay valid.' },
    { line: null,
      es: 'Entonces, ¿gana `list`? Casi nunca en la práctica. Cada nodo es una asignación y los saltos entre nodos dispersos fallan en la caché; además, para insertar en medio primero hay que **llegar** ($O(n)$). Con tamaños habituales el vector suele ganar incluso insertando en medio. Mídelo con `medir()`.',
      en: 'So does `list` win? Almost never in practice. Each node is an allocation and jumping between scattered nodes misses the cache; besides, to insert in the middle you first have to **get there** ($O(n)$). At typical sizes the vector often wins even when inserting in the middle. Measure it with `medir()`.' },

    // ── unordered_map ──
    { sec: { es: 'unordered_map: tabla hash', en: 'unordered_map: hash table' }, celdas: M1, zonas: ZM, code: CM, line: 1,
      mostrar: K, val: fila(K, K.map(() => '→∅')),
      es: 'Una tabla hash es un array de **cubos**; cada cubo guarda una cadena de nodos (o `nullptr` si está vacío). Aquí hay 4 cubos, todos vacíos. Dibujamos el modelo clásico de cadenas: cada implementación organiza los nodos a su manera, pero la idea es esta.',
      en: 'A hash table is an array of **buckets**; each bucket holds a chain of nodes (or `nullptr` if empty). Here there are 4 buckets, all empty. We draw the classic chained model: each implementation arranges the nodes its own way, but this is the idea.' },
    { line: 2, mostrar: ['n12', 'n9', 'n7'], val: { k0: '→n12', k1: '→n9', k3: '→n7', n12: '→∅', n9: '→∅', n7: '→∅' }, hl: { k0: 'a', k1: 'a', k3: 'a', n12: 'b', n9: 'b', n7: 'b' },
      es: 'Para insertar se calcula el cubo: $i = h(k) \\bmod m$. En libstdc++ el hash de un `int` es el propio número, así que con $m=4$: $12 \\bmod 4=0$, $9 \\bmod 4=1$, $7 \\bmod 4=3$. Cada nodo se enlaza en su cubo. (4 cubos es solo para poder dibujarlo.)',
      en: 'To insert, the bucket is computed: $i = h(k) \\bmod m$. In libstdc++ the hash of an `int` is the number itself, so with $m=4$: $12 \\bmod 4=0$, $9 \\bmod 4=1$, $7 \\bmod 4=3$. Each node is linked into its bucket. (4 buckets is just so we can draw it.)' },
    { line: 3, mostrar: ['n19'], val: { n7: '→n19', n19: '→∅' }, hl: { k3: 'a', n7: 'c', n19: 'b' },
      es: '**Colisión**: $19 \\bmod 4=3$, el mismo cubo que el 7. Dos claves distintas en el mismo cubo se **encadenan**. El nodo nuevo se engancha a la cadena (en qué posición exacta depende de la implementación).',
      en: '**Collision**: $19 \\bmod 4=3$, the same bucket as 7. Two different keys in one bucket get **chained**. The new node is attached to the chain (exactly where depends on the implementation).' },
    { line: 4, hl: { k3: 'a', n7: 'a', n19: 'b' },
      es: '`find(19)`: se calcula el cubo (3) y se recorre su cadena comparando claves: `7 != 19`, siguiente, `19 == 19`. Cuesta lo que mida la cadena. Con pocas claves por cubo, $O(1)$ **de media**. Si casi todas cayeran en un cubo (mal hash), sería $O(n)$.',
      en: '`find(19)`: the bucket is computed (3) and its chain is walked comparing keys: `7 != 19`, next, `19 == 19`. The cost is the chain length. With few keys per bucket, $O(1)$ **on average**. If nearly all fell into one bucket (bad hash), it would be $O(n)$.' },
    { line: 5, hl: { k0: 'a', k1: 'a', k2: 'a', k3: 'a' },
      es: 'El **factor de carga** es $\\alpha = n/m$: ahora $4/4=1$. Por defecto `max_load_factor()` vale 1: insertar el 5.º elemento daría $5/4>1$, así que la tabla hace **rehash**: reserva más cubos (aproximadamente el doble; libstdc++ usa un número primo) y recoloca los nodos con el nuevo módulo.',
      en: 'The **load factor** is $\\alpha = n/m$: now $4/4=1$. By default `max_load_factor()` is 1: inserting the 5th element would give $5/4>1$, so the table does a **rehash**: it reserves more buckets (roughly double; libstdc++ uses a prime number) and places the nodes again using the new modulus.' },
    { celdas: M2, zonas: ZM, line: 5, mostrar: [...R, ...NODOS.map(c => c.id)],
      val: { ...fila(R, R.map(() => '→∅')), r4: '→n12', r1: '→n9', r7: '→n7', r3: '→n19', r6: '→n6', n12: '→∅', n9: '→∅', n7: '→∅', n19: '→∅', n6: '→∅' }, hl: { r7: 'b', r3: 'b' },
      es: 'Tras el rehash: 8 cubos y $h \\bmod 8$. El 7 va al cubo 7 y el 19 al 3: ya no colisionan. Los **nodos no se han movido** (mira sus direcciones): punteros y referencias a elementos siguen válidos, aunque los iteradores se invalidan. Rehash cuesta $O(n)$, pero es raro: $O(1)$ amortizado.',
      en: 'After the rehash: 8 buckets and $h \\bmod 8$. The 7 goes to bucket 7 and the 19 to 3: they no longer collide. The **nodes did not move** (look at their addresses): pointers and references to elements stay valid, though iterators are invalidated. Rehash costs $O(n)$, but it is rare: $O(1)$ amortized.' },
    { line: null, hl: {},
      es: 'Un mal `hash` hace que las 1000 claves de un `unordered_map` caigan en el mismo cubo. ¿Cuánto cuesta entonces un `find`?',
      en: 'A bad `hash` makes all 1000 keys of an `unordered_map` land in the same bucket. How much does a `find` cost then?',
      pregunta: {
        opc: [
          { es: '`O(1)`, como siempre', en: '`O(1)`, as always' },
          { es: '`O(log n)`', en: '`O(log n)`' },
          { es: '`O(n)`: recorre una cadena de 1000 nodos', en: '`O(n)`: it walks a chain of 1000 nodes', ok: 1 },
        ],
        why: {
          es: 'Una sola cadena larga se recorre en tiempo lineal. Por eso importa una buena función hash, y por eso el peor caso de `unordered_map` es `O(n)` aunque el caso medio sea `O(1)`.',
          en: 'A single long chain is walked in linear time. That is why a good hash function matters, and why the worst case of `unordered_map` is `O(n)` even though the average case is `O(1)`.',
        },
      } },

    // ── map ──
    { sec: { es: 'map: claves ordenadas', en: 'map: ordered keys' }, celdas: P, zonas: ZP1, code: CP1, line: 2, mostrar: Q, val: fila(Q, KEYS),
      es: 'Un `map` guarda sus claves **ordenadas**: recorrerlo da las claves de menor a mayor y permite `lower_bound`. En las implementaciones habituales es un árbol rojo-negro; aquí no lo dibujamos, llegará en la guía de árboles. Para ver por qué buscar cuesta $O(\\log n)$ ponemos las mismas claves en fila.',
      en: 'A `map` keeps its keys **sorted**: walking it gives the keys from smallest to largest and enables `lower_bound`. In the usual implementations it is a red-black tree; we do not draw it here, it will come in the trees guide. To see why searching costs $O(\\log n)$ we lay the same keys out in a row.' },
    { code: CP2, line: 3, hl: { q3: 'a' },
      es: 'Buscamos el 27 con una búsqueda binaria. Primer sondeo, el del medio: `k[3] = 21`. Como $21<27$, el 27 solo puede estar a la derecha: se descarta la mitad izquierda de golpe.',
      en: 'We look for 27 with a binary search. First probe, the middle one: `k[3] = 21`. Since $21<27$, the 27 can only be on the right: the whole left half is discarded at once.' },
    { line: 3, hl: { q5: 'a', q3: 'c' },
      es: 'Quedan 3 claves a la derecha. Sondeo del medio: `k[5] = 34`. Como $34>27$, se descarta la derecha. Cada sondeo parte por la mitad lo que queda.',
      en: 'Three keys remain on the right. Probe the middle: `k[5] = 34`. Since $34>27$, the right side is discarded. Each probe halves what is left.' },
    { line: 4, hl: { q4: 'b', q3: 'c', q5: 'c' },
      es: 'Queda un solo candidato: `k[4] = 27`. Tres sondeos para 7 claves; en general unos $\\lceil \\log_2 (n+1) \\rceil$: con un millón de claves, 20. El árbol rojo-negro garantiza una altura $O(\\log n)$, y por eso `find`, `insert` y `erase` cuestan $O(\\log n)$.',
      en: 'One candidate left: `k[4] = 27`. Three probes for 7 keys; in general about $\\lceil \\log_2 (n+1) \\rceil$: with a million keys, 20. The red-black tree guarantees a height of $O(\\log n)$, which is why `find`, `insert` and `erase` cost $O(\\log n)$.' },
    { code: CP1, line: 4, hl: { q0: 'a', q1: 'a', q2: 'a', q3: 'a', q4: 'a', q5: 'a', q6: 'a' },
      es: '`map` frente a `unordered_map`: `map` cuesta $O(\\log n)$ y recorre en orden (`lower_bound`, rangos); `unordered_map` cuesta $O(1)$ de media ($O(n)$ en el peor caso) y recorre en orden arbitrario. Si no necesitas el orden, no lo pagues. Las claves de `map` necesitan `<`; las de `unordered_map`, hash e igualdad.',
      en: '`map` versus `unordered_map`: `map` costs $O(\\log n)$ and iterates in order (`lower_bound`, ranges); `unordered_map` costs $O(1)$ on average ($O(n)$ worst case) and iterates in arbitrary order. If you do not need the order, do not pay for it. `map` keys need `<`; `unordered_map` keys need a hash and equality.' },

    // ── priority_queue ──
    { sec: { es: 'priority_queue: el montículo', en: 'priority_queue: the heap' }, celdas: H, zonas: ZMEM, grupos: GH, code: CH, line: 2, mostrar: ['hn', ...HP],
      val: { hn: 7, ...fila(HP, [50, 30, 40, 10, 20, 35, 15, '·']) }, hl: { h0: 'b' },
      es: 'Una `priority_queue<int>` es un **montículo** (heap) máximo guardado en un `vector`: cada elemento es mayor o igual que sus dos hijos, así que el mayor está siempre en `h[0]`. `top()` solo lee esa posición: $O(1)$.',
      en: 'A `priority_queue<int>` is a max-**heap** stored in a `vector`: every element is greater than or equal to its two children, so the largest is always at `h[0]`. `top()` just reads that slot: $O(1)$.' },
    { line: null, hl: { h1: 'b', h0: 'a', h3: 'a', h4: 'a' },
      es: 'No hay punteros: el árbol está implícito en los **índices**. Para el elemento `i`: padre $\\lfloor (i-1)/2 \\rfloor$, hijos $2i+1$ y $2i+2$. Para $i=1$ (el 30): padre 0 (el 50), hijos 3 y 4 (10 y 20). Todo el montículo es un array compacto.',
      en: 'There are no pointers: the tree is implicit in the **indices**. For element `i`: parent $\\lfloor (i-1)/2 \\rfloor$, children $2i+1$ and $2i+2$. For $i=1$ (the 30): parent 0 (the 50), children 3 and 4 (10 and 20). The whole heap is one compact array.' },
    { line: 3, val: { hn: 8, h7: 45 }, hl: { h7: 'a', h3: 'b' },
      es: '`push(45)`: se añade al final del array (`h[7]`), el primer hueco libre del árbol. Puede romper la regla: su padre es $\\lfloor (7-1)/2 \\rfloor=3$, que vale 10, menor que 45. Hay que **subir** el 45 (*sift-up*).',
      en: '`push(45)`: it is appended at the end of the array (`h[7]`), the first free spot of the tree. It may break the rule: its parent is $\\lfloor (7-1)/2 \\rfloor=3$, which holds 10, less than 45. The 45 has to **move up** (*sift-up*).' },
    { val: { h7: 10, h3: 45 }, hl: { h3: 'a', h7: 'a', h1: 'b' },
      es: '$45>10$: se **intercambian** `h[7]` y `h[3]`. Ahora el 45 está en el índice 3 y su nuevo padre es $\\lfloor (3-1)/2 \\rfloor=1$, con el 30. Sigue siendo mayor: hay que seguir subiendo.',
      en: '$45>10$: `h[7]` and `h[3]` are **swapped**. Now the 45 is at index 3 and its new parent is $\\lfloor (3-1)/2 \\rfloor=1$, holding 30. Still larger: keep moving up.' },
    { val: { h3: 30, h1: 45 }, hl: { h1: 'a', h3: 'a', h0: 'b' },
      es: '$45>30$: nuevo intercambio, el 45 queda en el índice 1. Su padre es el 50 y $45<50$: la regla se cumple y se **para**. Se sube como mucho un nivel por intercambio y la altura es $\\lfloor \\log_2 n \\rfloor$: `push` cuesta $O(\\log n)$.',
      en: '$45>30$: another swap, the 45 lands at index 1. Its parent is 50 and $45<50$: the rule holds and it **stops**. It moves up at most one level per swap and the height is $\\lfloor \\log_2 n \\rfloor$: `push` costs $O(\\log n)$.' },
    { line: 4, val: { hn: 7, h0: 10, h7: '·' }, hl: { h0: 'c', h7: 'a' },
      es: '`pop()` quita el mayor (la raíz). El hueco se rellena con el **último** elemento (10), que pasa a la raíz, y `size` baja a 7. El array sigue compacto, pero el 10 en la raíz rompe la regla: hay que **bajarlo** (*sift-down*).',
      en: '`pop()` removes the largest (the root). The hole is filled with the **last** element (10), which moves to the root, and `size` drops to 7. The array stays compact, but the 10 at the root breaks the rule: it has to **move down** (*sift-down*).' },
    { val: { h0: 45, h1: 30, h3: 10 }, hl: { h0: 'a', h1: 'a', h3: 'a' },
      es: 'El 10 baja eligiendo siempre el **hijo mayor**: 45 (frente a 40) y luego 30 (frente a 20); ahí ya no tiene hijos dentro del array y termina. El 45 es la nueva raíz y la regla se cumple. También $O(\\log n)$: como mucho un intercambio por nivel.',
      en: 'The 10 moves down, always picking the **larger child**: 45 (over 40) and then 30 (over 20); there it has no children inside the array and stops. The 45 is the new root and the rule holds. Also $O(\\log n)$: at most one swap per level.' },
    { line: null, val: { hn: 4, ...fila(HP, [45, 30, 40, 10, '·', '·', '·', '·']) },
      es: 'Prueba tú, con un heap pequeño (45, 30, 40, 10). Añade valores y mira cómo el nuevo sube hasta que su padre es mayor; haz `pop()` y mira cómo el último baja. `·` es un hueco libre del array. Tope de la escena: 8 elementos.',
      en: 'Your turn, with a small heap (45, 30, 40, 10). Add values and watch the new one climb until its parent is larger; call `pop()` and watch the last one sink. `·` is a free slot of the array. Scene limit: 8 elements.',
      jugar: {
        botones: [
          { label: 'push(60)', hacer: v => poner(v, subir(leer(v), 60)), off: v => v.hn >= 8 },
          { label: 'push(35)', hacer: v => poner(v, subir(leer(v), 35)), off: v => v.hn >= 8 },
          { label: 'push(5)', hacer: v => poner(v, subir(leer(v), 5)), off: v => v.hn >= 8 },
          { label: 'pop()', hacer: v => poner(v, bajar(leer(v))), off: v => v.hn <= 0 },
        ],
        lecturas: v => [
          { expr: 'pq.top()', valor: v.hn ? v.h0 : '—' },
          { expr: 'pq.size()', valor: v.hn },
          { expr: '⌊log₂ n⌋', valor: v.hn ? Math.floor(Math.log2(v.hn)) : '—' },
        ],
        hl: v => ({ ...(v.hn ? { h0: 'b' } : {}), ...(v.hn > 1 ? { ['h' + (v.hn - 1)]: 'a' } : {}) }),
      } },

    // ── cierre ──
    { sec: { es: 'Qué contenedor elijo', en: 'Which container do I pick' }, celdas: RES, code: '', line: null, mostrar: RES.map(c => c.id),
      val: { cv: 'O(1)', cu: 'O(1)', cm: 'O(log n)', cp: 'O(1)', cl: 'O(1)' }, hl: { cv: 'b' },
      es: '`vector` por defecto: memoria contigua, `v[i]` en $O(1)$, `push_back` en $O(1)$ amortizado y la mejor caché. Cámbialo solo cuando un requisito concreto lo pida, y mide si dudas.',
      en: '`vector` by default: contiguous memory, `v[i]` in $O(1)$, `push_back` in $O(1)$ amortized and the best cache behavior. Switch only when a concrete requirement asks for it, and measure if in doubt.' },
    { hl: { cu: 'a', cm: 'a', cp: 'a', cl: 'c' },
      es: '`unordered_map` para buscar por clave sin orden: $O(1)$ de media. `map` si necesitas las claves ordenadas o `lower_bound`: $O(\\log n)$. `priority_queue` para «el mayor (o menor) ahora»: `push` y `pop` en $O(\\log n)$, `top` en $O(1)$. `list` casi nunca: solo con iteradores estables o `splice`.',
      en: '`unordered_map` to look up by key without order: $O(1)$ on average. `map` if you need the keys sorted or `lower_bound`: $O(\\log n)$. `priority_queue` for “the largest (or smallest) right now”: `push` and `pop` in $O(\\log n)$, `top` in $O(1)$. `list` almost never: only for stable iterators or `splice`.' },
    { hl: { cu: 'a' },
      es: 'Debes contar cuántas veces aparece cada palabra de un texto largo. Al final solo necesitas el total por palabra, sin ningún orden. ¿Qué contenedor eliges?',
      en: 'You must count how many times each word appears in a long text. At the end you only need the total per word, in no particular order. Which container do you pick?',
      pregunta: {
        opc: [
          { es: '`vector` de pares, buscando la palabra una a una', en: '`vector` of pairs, searching for the word one by one' },
          { es: '`unordered_map<string, int>`', en: '`unordered_map<string, int>`', ok: 1 },
          { es: '`priority_queue<string>`', en: '`priority_queue<string>`' },
        ],
        why: {
          es: 'Buscar por clave sin orden es el caso de `unordered_map`: `O(1)` de media por palabra. El vector sería `O(n)` por búsqueda. `map` también funcionaría, pero pagarías `O(log n)` por un orden que no necesitas.',
          en: 'Lookup by key with no order is the case for `unordered_map`: `O(1)` on average per word. The vector would be `O(n)` per lookup. `map` would also work, but you would pay `O(log n)` for an order you do not need.',
        },
      } },
  ],
};
