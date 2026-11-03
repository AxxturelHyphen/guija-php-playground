#!/usr/bin/env sh
# Guija Playground (PHP, Python, Java) en Linux/macOS: arranca el servidor local y abre el navegador.
# Solo escucha en 127.0.0.1. Para cerrarlo: Ctrl+C.
#   - PHP es obligatorio. Python 3.11+ y un JDK 21+ son opcionales (cada uno activa su versión del playground).
#   - La primera vez se crea .venv con numpy y matplotlib (requirements.txt).
#     Para la lección de audio: .venv/bin/python -m pip install -r requirements-audio.txt
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8000}"

if ! command -v php >/dev/null 2>&1; then
    echo "No encuentro php en el PATH. Instálalo (p. ej. apt install php-cli / brew install php)."
    exit 1
fi
mkdir -p var

# ── Python (opcional) ──────────────────────────────────────────────
if [ ! -x .venv/bin/python ]; then
    for py in python3 python; do
        if command -v "$py" >/dev/null 2>&1 && "$py" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
            echo "Preparando Python para el playground (solo la primera vez)..."
            "$py" -m venv .venv || echo "No se pudo crear .venv (¿falta python3-venv?)."
            break
        fi
    done
fi
if [ -x .venv/bin/python ]; then
    if ! .venv/bin/python -c 'import numpy, matplotlib' 2>/dev/null; then
        echo "Instalando numpy y matplotlib en .venv ..."
        .venv/bin/python -m pip install --disable-pip-version-check -q -r requirements.txt
    fi
    # La primera importación de matplotlib construye su caché de fuentes: se hace ya, en segundo plano.
    mkdir -p var/mpl
    MPLCONFIGDIR="$PWD/var/mpl" .venv/bin/python -c "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot" >/dev/null 2>&1 &
else
    echo "(Python 3.11+ no encontrado: la versión Python del playground no estará disponible.)"
fi

# ── Java (opcional) ────────────────────────────────────────────────
if ! command -v javac >/dev/null 2>&1 && [ ! -x "${JAVA_HOME:-/nonexistent}/bin/javac" ]; then
    echo "(JDK no encontrado: la versión Java del playground no estará disponible. Instala un JDK 21+.)"
fi

echo ""
echo "  Guija Playground  -  http://127.0.0.1:$PORT   (Ctrl+C para parar)"
echo ""
( sleep 1; (command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:$PORT") || (command -v open >/dev/null && open "http://127.0.0.1:$PORT") ) >/dev/null 2>&1 &
exec php -S "127.0.0.1:$PORT" index.php
