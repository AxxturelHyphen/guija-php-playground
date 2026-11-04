// Lenguaje activo de esta página (lo fija el servidor en <html data-lang="…">). Todos los módulos leen LANG
// para lo que cambia entre PHP, Python, Java y C++: extensión, plantillas, resaltado, textos de ayuda…
import php from './lang/php.js';
import python from './lang/python.js';
import java from './lang/java.js';
import cpp from './lang/cpp.js';

export const LANGS = { php, python, java, cpp };
export const LANG = LANGS[document.documentElement.dataset.lang] ?? php;
