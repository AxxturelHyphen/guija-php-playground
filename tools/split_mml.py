# Prepara el libro MML como referencia local para el agente.
# Uso (desde la raíz del repo):  python tools/split_mml.py "C:/Users/<tu>/Downloads/mml-book.pdf"
# Requiere: pip install pypdf
import shutil
import sys
from pathlib import Path

from pypdf import PdfReader

OFFSET = 6  # página PDF = página del libro + 6 (draft 2024-01-15)
src = Path(sys.argv[1])
out = Path("ref/mml")
out.mkdir(parents=True, exist_ok=True)

shutil.copy(src, out / "mml-book.pdf")  # el agente lo lee por páginas para ver las fórmulas bien
r = PdfReader(src)

# Texto completo con marcador de página: sirve para hacer grep, no para copiar fórmulas
with open(out / "mml.txt", "w", encoding="utf-8") as f:
    for i, page in enumerate(r.pages, start=1):
        f.write(f"\n=== PDF p.{i} | libro p.{i - OFFSET} ===\n")
        f.write(page.extract_text() or "")

# Índice capítulo/sección -> página PDF
def walk(items, depth=0):
    for it in items:
        if isinstance(it, list):
            yield from walk(it, depth + 1)
        else:
            yield depth, it.title, r.get_destination_page_number(it) + 1

with open(out / "toc.txt", "w", encoding="utf-8") as f:
    for depth, title, p in walk(r.outline):
        f.write(f"{'  ' * depth}{title}  -> PDF p.{p}\n")

print(f"ok -> {out}/ (mml-book.pdf, mml.txt, toc.txt)")
