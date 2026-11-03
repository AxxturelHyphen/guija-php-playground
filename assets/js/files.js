// Proyecto (árbol de archivos), pestañas, guardado en disco y copia de seguridad de lo no guardado.
import { $, el, store, toast, debounce } from './util.js';
import { state, emit, on, activeTab } from './state.js';
import { api } from './api.js';
import { confirmDialog, promptDialog } from './dialog.js';

const NAME_RE = /^[A-Za-z0-9_-]{1,80}\.php$/;
const TEMPLATE = '<?php\ndeclare(strict_types=1);\n\n';
const GROUPS = [
  { dir: 'ejemplos', title: 'Ejemplos', icon: '' },
  { dir: 'practicas', title: 'Prácticas', icon: 'prac' },
  { dir: 'soluciones', title: 'Soluciones', icon: 'sol' },
];

export function createFiles(editor) {
  const treeEl = $('#tree');
  const tabsEl = $('#tabs');
  const restoreBtn = $('#btn-restore');
  const open = new Set(store.json('pg:groups', ['ejemplos', 'practicas']));
  let spoilerOk = false;
  try { spoilerOk = sessionStorage.getItem('pg:spoiler') === '1'; } catch { /* nada */ }

  const idOf = (dir, name) => `${dir}/${name}`;
  const tabById = id => state.tabs.find(t => t.id === id);
  const bufKey = id => 'pg:buf:' + id;
  const isDirty = tab => !!tab && editor.hasDoc(tab.id) && editor.getText(tab.id) !== tab.saved;

  // ── Árbol ─────────────────────────────────────────────────────
  async function refreshTree() {
    state.tree = await api('tree');
    renderTree();
    emit('tree', state.tree);
  }

  function renderTree() {
    treeEl.replaceChildren(...GROUPS.map(g => {
      const files = state.tree[g.dir] ?? [];
      const isOpen = open.has(g.dir);
      const head = el('button', {
        class: 'tree-group-head', 'aria-expanded': String(isOpen),
        onclick: () => { open.has(g.dir) ? open.delete(g.dir) : open.add(g.dir); store.set('pg:groups', JSON.stringify([...open])); renderTree(); },
      }, el('i', { class: 'chev' }), g.title, el('span', { class: 'n' }, String(files.length)));
      const items = el('div', { class: 'tree-items' });
      if (g.dir === 'soluciones' && !spoilerOk) {
        items.append(el('div', { class: 'spoiler' },
          'Las soluciones están ocultas para que no te chafen el ejercicio. Inténtalo primero: el panel «Solución» te enseña la tuya frente a la óptima cuando quieras.',
          el('div', {}, el('button', { class: 'btn', onclick: revealSolutions }, 'Mostrar soluciones'))));
      } else if (!files.length) {
        items.append(el('div', { class: 'tree-empty' }, g.dir === 'practicas' ? 'Aún no has guardado nada: Ctrl+S guarda aquí una copia.' : 'Vacío'));
      } else {
        for (const f of files) items.append(treeItem(g, f));
      }
      return el('div', { class: 'tree-group' + (isOpen ? ' open' : '') }, head, items);
    }));
  }

  function treeItem(g, f) {
    const id = idOf(g.dir, f.name);
    const dirty = isDirty(tabById(id));
    const btn = el('div', {
      class: 'tree-item' + (id === state.active ? ' active' : ''), role: 'button', tabindex: '0', title: f.name + (f.solution ? ' (tiene solución de referencia)' : ''),
      onclick: () => openFile(g.dir, f.name),
      onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFile(g.dir, f.name); } if (e.key === 'Delete' && g.dir === 'practicas') removeFile(f.name); },
    },
    el('span', { class: 'file-icon ' + g.icon }, 'PHP'),
    el('span', { class: 'name' }, f.name),
    dirty ? el('span', { class: 'badge', style: 'color:var(--blue)' }, '●') : null,
    f.solution ? el('span', { class: 'badge', title: 'Tiene solución de referencia' }, '★') : null,
    g.dir === 'practicas' ? el('button', { class: 'del', title: 'Borrar', 'aria-label': 'Borrar ' + f.name, onclick: e => { e.stopPropagation(); removeFile(f.name); } }, '×') : null);
    return btn;
  }

  async function revealSolutions() {
    const ok = await confirmDialog('Ver soluciones', 'Las soluciones de referencia **destripan** los ejercicios. ¿Seguro que quieres mostrarlas?', { ok: 'Mostrarlas' });
    if (!ok) return;
    spoilerOk = true;
    try { sessionStorage.setItem('pg:spoiler', '1'); } catch { /* nada */ }
    open.add('soluciones');
    renderTree();
  }

  // ── Pestañas ──────────────────────────────────────────────────
  function renderTabs() {
    tabsEl.replaceChildren(...state.tabs.map(t => {
      const dirty = isDirty(t);
      const node = el('div', {
        class: 'tab' + (t.id === state.active ? ' active' : '') + (t.readOnly ? ' ro' : ''), role: 'tab', tabindex: '0', 'aria-selected': String(t.id === state.active),
        title: t.id, onclick: () => activate(t.id),
        onkeydown: e => { if (e.key === 'Enter') activate(t.id); },
        onauxclick: e => { if (e.button === 1) { e.preventDefault(); close(t.id); } },
      },
      el('span', { class: 'file-icon ' + (t.dir === 'soluciones' ? 'sol' : t.dir === 'practicas' ? 'prac' : '') }, 'PHP'),
      el('span', {}, t.name),
      dirty ? el('span', { class: 'dirty', title: 'Sin guardar' }) : null,
      el('button', { class: 'close', title: 'Cerrar', 'aria-label': 'Cerrar ' + t.name, onclick: e => { e.stopPropagation(); close(t.id); } }, '×'));
      return node;
    }));
    $('.tab.active', tabsEl)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    updateRestore();
    persistSession();
  }

  function updateRestore() {
    const tab = activeTab();
    const hasOriginal = tab && tab.dir === 'practicas' && (state.tree.ejemplos ?? []).some(f => f.name === tab.name);
    const show = tab && ((tab.dir === 'ejemplos' && isDirty(tab)) || hasOriginal);
    restoreBtn.hidden = !show;
    restoreBtn.textContent = tab?.dir === 'practicas' ? 'Restaurar original' : 'Restaurar';
  }

  const persistSession = () => store.set('pg:session', JSON.stringify({ tabs: state.tabs.map(t => t.id), active: state.active }));

  function activate(id) {
    if (!tabById(id)) return;
    state.active = id;
    editor.show(id);
    $('#editor-island').classList.remove('is-empty');
    renderTabs();
    renderTree();
    emit('active', { id, tab: tabById(id) });
  }

  async function openFile(dir, name, { line, quiet = false } = {}) {
    const id = idOf(dir, name);
    if (tabById(id)) {
      activate(id);
    } else {
      let data;
      try {
        data = await api('file', { params: { dir, name } });
      } catch (e) {
        if (!quiet) toast(e.message, 'error');
        return false;
      }
      const tab = { id, dir, name, saved: data.code, hasSolution: !!data.solution, readOnly: dir === 'soluciones' };
      state.tabs.push(tab);
      let text = data.code;
      const backup = store.get(bufKey(id));
      if (backup !== null && backup !== data.code && !tab.readOnly) {
        text = backup;
        if (!quiet) toast(`Recuperados los cambios sin guardar de ${name}`);
      }
      editor.openDoc(id, text, { readOnly: tab.readOnly });
      activate(id);
    }
    if (line) editor.reveal(line);
    if (window.matchMedia('(max-width: 760px)').matches) document.body.classList.remove('sidebar-open');
    return true;
  }

  async function close(id) {
    const tab = tabById(id);
    if (!tab) return;
    if (isDirty(tab) && !tab.readOnly) {
      const ok = await confirmDialog('Cambios sin guardar', `**${tab.name}** tiene cambios sin guardar. Si lo cierras se perderán.`, { ok: 'Cerrar sin guardar' });
      if (!ok) return;
    }
    store.del(bufKey(id));
    const idx = state.tabs.indexOf(tab);
    state.tabs.splice(idx, 1);
    editor.closeDoc(id);
    if (state.active === id) {
      const next = state.tabs[Math.min(idx, state.tabs.length - 1)];
      if (next) activate(next.id);
      else { state.active = null; editor.clearView(); $('#editor-island').classList.add('is-empty'); renderTabs(); renderTree(); emit('active', { id: null, tab: null }); }
    } else {
      renderTabs();
    }
  }

  // ── Guardar / nuevo / borrar / restaurar ─────────────────────
  async function save() {
    const tab = activeTab();
    if (!tab) return false;
    if (tab.readOnly) { toast('Las soluciones son de solo lectura.'); return false; }
    const text = editor.getText(tab.id);
    try {
      if (tab.dir === 'practicas') {
        await api('save', { body: { name: tab.name, code: text, overwrite: true } });
        tab.saved = text;
        store.del(bufKey(tab.id));
        toast(`Guardado en practicas/${tab.name}`, 'ok');
        renderTabs();
        await refreshTree();
        emit('saved', { id: tab.id });
        return true;
      }
      // Un ejemplo no se toca: se guarda una copia en practicas/ y se cambia a ella
      const exists = (state.tree.practicas ?? []).some(f => f.name === tab.name);
      if (exists) {
        const ok = await confirmDialog('Sobrescribir', `Ya existe **practicas/${tab.name}**. ¿Quieres reemplazarla por esta versión?`, { ok: 'Sobrescribir' });
        if (!ok) return false;
      }
      await api('save', { body: { name: tab.name, code: text, overwrite: true } });
      const copyId = idOf('practicas', tab.name);
      if (tabById(copyId)) await close(copyId);
      store.del(bufKey(copyId));
      const data = await api('file', { params: { dir: 'practicas', name: tab.name } });
      const copy = { id: copyId, dir: 'practicas', name: tab.name, saved: data.code, hasSolution: !!data.solution, readOnly: false };
      state.tabs.push(copy);
      editor.openDoc(copyId, data.code);
      // El ejemplo no se modifica en disco; su pestaña se cierra y se descartan los cambios en memoria
      store.del(bufKey(tab.id));
      state.tabs.splice(state.tabs.indexOf(tab), 1);
      editor.closeDoc(tab.id);
      toast(`Copia guardada en practicas/${tab.name} (el ejemplo original no cambia)`, 'ok');
      activate(copyId);
      await refreshTree();
      emit('saved', { id: copyId });
      return true;
    } catch (e) {
      toast('No se pudo guardar: ' + e.message, 'error');
      return false;
    }
  }

  async function newFile() {
    const name = await promptDialog('Nuevo archivo', 'Nombre del archivo en `practicas/`:', 'mi-ejercicio.php', {
      ok: 'Crear',
      validate: v => (NAME_RE.test(v.endsWith('.php') ? v : v + '.php') ? '' : 'Usa letras, números, guion y guion bajo (máx. 80).'),
    });
    if (!name) return;
    const file = name.endsWith('.php') ? name : name + '.php';
    const res = await api('save', { body: { name: file, code: TEMPLATE }, raw: true });
    if (res.status === 409) { toast(`practicas/${file} ya existe: se abre.`); }
    else if (!res.ok) { toast(res.data?.error ?? 'No se pudo crear', 'error'); return; }
    await refreshTree();
    await openFile('practicas', file);
    editor.reveal(3);
  }

  async function removeFile(name) {
    const ok = await confirmDialog('Borrar archivo', `¿Borrar **practicas/${name}** del disco? No se puede deshacer.`, { ok: 'Borrar' });
    if (!ok) return;
    try {
      await api('delete', { body: { name } });
      const tab = tabById(idOf('practicas', name));
      if (tab) { tab.saved = editor.getText(tab.id); await close(tab.id); }
      store.del(bufKey(idOf('practicas', name)));
      await refreshTree();
      toast('Borrado ' + name);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function restore() {
    const tab = activeTab();
    if (!tab) return;
    const ok = await confirmDialog('Restaurar', `Se perderán tus cambios en **${tab.name}** y volverá la versión original del ejemplo.`, { ok: 'Restaurar' });
    if (!ok) return;
    try {
      const data = await api('file', { params: { dir: 'ejemplos', name: tab.name } });
      editor.setText(tab.id, data.code);
      if (tab.dir === 'ejemplos') store.del(bufKey(tab.id));
      toast('Versión original restaurada');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ── Copia de seguridad y avisos ───────────────────────────────
  const backup = debounce(id => {
    const tab = tabById(id);
    if (!tab || tab.readOnly) return;
    const text = editor.getText(id);
    if (text === tab.saved) store.del(bufKey(id)); else store.set(bufKey(id), text);
  }, 400);
  on('doc-change', ({ id }) => { backup(id); renderTabs(); if (id === state.active) { renderTree(); } });
  window.addEventListener('beforeunload', e => { if (state.tabs.some(t => isDirty(t) && !t.readOnly)) { e.preventDefault(); e.returnValue = ''; } });

  restoreBtn.addEventListener('click', restore);
  $('#btn-new').addEventListener('click', newFile);

  async function init() {
    await refreshTree();
    const session = store.json('pg:session', null);
    let opened = 0;
    for (const id of session?.tabs ?? []) {
      const i = id.indexOf('/');
      if (await openFile(id.slice(0, i), id.slice(i + 1), { quiet: true })) opened++;
    }
    if (session?.active && tabById(session.active)) activate(session.active);
    if (!opened) {
      const first = state.tree.ejemplos?.[0];
      if (first) await openFile('ejemplos', first.name);
      else $('#editor-island').classList.add('is-empty');
    }
  }

  return { init, openFile, close, save, newFile, refreshTree, text: id => editor.getText(id), isDirty, restore, activate };
}
