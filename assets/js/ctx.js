// Referencias compartidas que main.js rellena al arrancar (editor, archivos, acciones).
// Los paneles las usan para saltar a una línea, aplicar arreglos, etc., sin importarse entre sí.
export const ctx = {
  editor: null,
  files: null,
  actions: {},          // run, measure, compare, lint...
  showPanel: () => {},  // se sustituye por panels.js
};
