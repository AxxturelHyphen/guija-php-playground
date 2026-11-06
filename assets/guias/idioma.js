// Idioma de las guías (es | en). El <html lang> lo fija un script inline en <head> antes de pintar (sin parpadeo).
export const idioma = () => (document.documentElement.lang === 'en' ? 'en' : 'es');

export function iniciarIdioma() {
  const botones = [...document.querySelectorAll('[data-set-lang]')];
  const marcar = () => botones.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.setLang === idioma())));
  for (const b of botones) {
    b.addEventListener('click', () => {
      document.documentElement.lang = b.dataset.setLang;
      try { localStorage.setItem('pg-guia-lang', b.dataset.setLang); } catch { /* modo privado: no pasa nada */ }
      const u = new URL(location.href);
      if (u.searchParams.has('lang')) { u.searchParams.set('lang', b.dataset.setLang); history.replaceState(null, '', u); }
      marcar();
      document.dispatchEvent(new Event('idioma'));
    });
  }
  marcar();
}
