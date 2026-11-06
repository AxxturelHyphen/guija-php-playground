// Resaltador C++ mínimo para las guías (una línea → HTML). Colores en guia.css (.k .t .n .s .c .f), los del tema islands-dark.
const KW = new Set('if else for while do return switch case break continue new delete const auto using namespace class struct template typename nullptr true false static void sizeof constexpr noexcept public private this operator'.split(' '));
const TY = new Set('int char bool long short unsigned float double size_t string vector list map set unordered_map unordered_set priority_queue deque array pair unique_ptr shared_ptr weak_ptr cout cin endl'.split(' '));
const RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b\d[\d.']*\b)|([A-Za-z_]\w*)|([\s\S])/g;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function resaltar(linea) {
  let out = '';
  for (const m of linea.matchAll(RE)) {
    const [t, com, str, num, id] = m;
    if (com) out += `<span class="c">${esc(t)}</span>`;
    else if (str) out += `<span class="s">${esc(t)}</span>`;
    else if (num) out += `<span class="n">${t}</span>`;
    else if (id) {
      const cls = KW.has(t) ? 'k' : TY.has(t) ? 't' : linea[m.index + t.length] === '(' ? 'f' : '';
      out += cls ? `<span class="${cls}">${t}</span>` : t;
    } else out += esc(t);
  }
  return out;
}
