r"""
TEMA 9 · AUDIO CON LIBROSA (SOLO LECTURA)
─────────────────────────────────────────────────────────────────
Código de referencia para preparar proyectos de audio e IA: forma de onda, espectrograma (STFT), MFCC y tempo.
No hay ejercicios: se lee, se ejecuta y se modifica. La señal es SINTÉTICA (generada con numpy), así que no se
descarga ni se necesita ningún archivo de audio.

CÓMO CORRERLO EN LOCAL
  · Aquí mismo: instala librosa una vez y pulsa Ejecutar (Ctrl+Enter); el playground lo corre con tu Python local.
      Windows:        .venv\Scripts\python -m pip install -r requirements-audio.txt
      Linux / macOS:  .venv/bin/python -m pip install -r requirements-audio.txt
  · Fuera del playground: copia el archivo y ejecútalo con ese mismo Python (python 09-audio-con-librosa.py).
  pg: limite=30   ← el playground le da hasta 30 s: librosa tarda unos segundos en arrancar la primera vez.
Si librosa no está instalada, el programa lo explica y termina sin error.

  Idea                 Qué es                                                   Para qué sirve en ML
  forma de onda        amplitud en cada instante (sr muestras por segundo)      entrada cruda de modelos end-to-end
  STFT                 FFT por ventanas: frecuencias que suenan en cada momento espectrograma = "imagen" para una CNN
  espectrograma mel    STFT con el eje de frecuencias en escala mel (oído)      entrada típica de clasificadores de audio
  MFCC                 resumen compacto de la forma del espectro (≈13 números)  características clásicas de voz y música
  tempo                pulsos por minuto, a partir de los ataques (onsets)      análisis musical
"""
import sys

try:
    import librosa
    import librosa.display
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError as error:
    print(f'No se pudo importar una dependencia ({error}).')
    print('Esta lección necesita librosa. Instálala en tu equipo con:')
    print('    pip install -r requirements-audio.txt')
    print('y vuelve a ejecutar el archivo. Aquí te basta con leer el código.')
    sys.exit(0)


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


# ═════════════════════════════════════════════════════════════════
# 1. UNA SEÑAL SINTÉTICA Y SU FORMA DE ONDA
# ═════════════════════════════════════════════════════════════════
titulo('1. Forma de onda')

sr = 22050                                    # frecuencia de muestreo: 22 050 muestras por segundo (el valor por defecto de librosa)
duracion = 4.0
t = np.arange(int(sr * duracion)) / sr        # instante de cada muestra, en segundos

# Una nota La4 (440 Hz) que cambia a Mi5 (660 Hz) a mitad, más un "clic" cada 0,5 s (120 pulsos por minuto) para el tempo.
nota = np.where(t < duracion / 2, np.sin(2 * np.pi * 440 * t), np.sin(2 * np.pi * 660 * t)) * 0.5
pulsos = np.zeros_like(t)
for inicio in np.arange(0, duracion, 0.5):
    i = int(inicio * sr)
    pulsos[i:i + 400] = np.hanning(800)[400:][: len(pulsos[i:i + 400])] * 0.8       # ataque corto que decae
y = (nota + pulsos).astype(np.float32)        # librosa trabaja con float32 en [-1, 1]
# Alternativas ya hechas: librosa.tone(440, sr=sr, duration=1) (seno puro) y librosa.chirp(fmin=200, fmax=2000, sr=sr, duration=2)
# (barrido de frecuencia). Con un archivo real sería: y, sr = librosa.load('ruta.wav', sr=22050)  — aquí no se descarga nada.

print(f'muestras: {y.shape[0]} · duración: {librosa.get_duration(y=y, sr=sr):.2f} s · sr: {sr} Hz')

fig, ax = plt.subplots(figsize=(8, 2.5))
ax.plot(t, y, linewidth=0.5)
ax.set_title('Forma de onda')
ax.set_xlabel('tiempo (s)')
ax.set_ylabel('amplitud')
fig.tight_layout()
plt.show()

# ═════════════════════════════════════════════════════════════════
# 2. STFT Y ESPECTROGRAMA
# ═════════════════════════════════════════════════════════════════
titulo('2. STFT / espectrograma')

# STFT: corta la señal en ventanas de n_fft muestras que avanzan hop_length y hace una FFT en cada una. Coste: O(n log n_fft).
# n_fft grande = mejor resolución en frecuencia pero peor en tiempo (y al revés). 2048/512 es un compromiso habitual.
D = librosa.stft(y, n_fft=2048, hop_length=512)     # matriz COMPLEJA (frecuencias × fotogramas)
S_db = librosa.amplitude_to_db(np.abs(D), ref=np.max)    # módulo → decibelios: el oído es logarítmico, y así se ve mejor
print('STFT:', D.shape, '(frecuencias × fotogramas) · dtype:', D.dtype)

fig, ax = plt.subplots(figsize=(8, 3))
img = librosa.display.specshow(S_db, sr=sr, hop_length=512, x_axis='time', y_axis='hz', ax=ax)
fig.colorbar(img, ax=ax, format='%+2.0f dB')
ax.set_ylim(0, 2000)
ax.set_title('Espectrograma: la nota salta de 440 Hz a 660 Hz')
fig.tight_layout()
plt.show()

# ═════════════════════════════════════════════════════════════════
# 3. MFCC
# ═════════════════════════════════════════════════════════════════
titulo('3. MFCC')

# MFCC: espectrograma mel → logaritmo → DCT. Se queda con los primeros coeficientes (la "forma" del espectro) y descarta
# el detalle fino. 13 o 20 coeficientes por fotograma es lo habitual como entrada de un clasificador.
mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
print('MFCC:', mfcc.shape, '(coeficientes × fotogramas)')
print('media de cada coeficiente (primeros 5):', mfcc.mean(axis=1)[:5].round(1))
# Para dar un clip entero a un modelo clásico se suele resumir por coeficiente (media y desviación en axis=1).

fig, ax = plt.subplots(figsize=(8, 2.8))
im = ax.imshow(mfcc, aspect='auto', origin='lower', cmap='magma')
fig.colorbar(im, ax=ax)
ax.set_title('MFCC (13 coeficientes por fotograma)')
ax.set_xlabel('fotograma')
ax.set_ylabel('coeficiente')
fig.tight_layout()
plt.show()

# ═════════════════════════════════════════════════════════════════
# 4. TEMPO
# ═════════════════════════════════════════════════════════════════
titulo('4. Tempo')

# La envolvente de ataques (onset strength) marca cuándo "pasan cosas"; beat_track busca la periodicidad dominante.
envolvente = librosa.onset.onset_strength(y=y, sr=sr)
tempo, golpes = librosa.beat.beat_track(onset_envelope=envolvente, sr=sr)
tempo = float(np.atleast_1d(tempo)[0])        # según la versión de librosa devuelve un escalar o un array de 1 elemento
print(f'tempo estimado: {tempo:.0f} BPM (real: 120) · pulsos detectados: {len(golpes)}')
# La estimación puede salir al doble o a la mitad (60 / 120 / 240): es la ambigüedad típica del tempo.
