"""
TEMA 16 · PROBABILIDAD Y ESTADÍSTICA PARA ML
─────────────────────────────────────────────────────────────────
Un modelo de ML es una distribución de probabilidad con parámetros, y entrenarlo es estimar esos parámetros con datos.
Esta lección junta lo que hace falta para entenderlo de verdad: calcular probabilidades exactas y comprobarlas simulando,
razonar con Bayes, ver por qué el error de una media baja como σ/√n (teorema central del límite), y llegar a la idea que
cierra el curso: máxima verosimilitud. Maximizarla da el error cuadrático en regresión y la entropía cruzada en
clasificación. Las funciones softmax e histograma son de la lección 8; la gaussiana como integral, de la lección 12.

  Concepto               Qué es                                               Trampa típica
  esperanza y            E[X] = Σ x·P(X=x), media a largo plazo; E[ΣXᵢ] =     E[g(X)] ≠ g(E[X]) (Jensen); E[XY] = E[X]E[Y]
  linealidad             ΣE[Xᵢ] aunque las Xᵢ sean DEPENDIENTES               solo si X e Y son independientes
  probabilidad exacta    contar (el complementario suele ser un producto);    simular sin semilla: cada ejecución da otro
  y simulación           simular estima con error ~ √(p(1−p)/n)               número; con pocos intentos el ruido manda
  teorema de Bayes       P(A|B) = P(B|A)·P(A) / P(B): de a priori a           falacia de la tasa base: confundir P(+|enfermo)
                         a posteriori al ver un dato                          con P(enfermo|+) cuando la enfermedad es rara
  varianza               Var X = E[(X−μ)²] = E[X²] − μ²; en una suma de       E[X²] − μ² pierde todos los dígitos si |μ| ≫ σ
                         independientes las varianzas se suman                (cancelación): resta primero la media
  LGN y TCL              la media muestral → μ; su error es ~ σ/√n y su       sin varianza finita (Cauchy) NO valen: la media
                         forma, una campana, sea cual sea la distribución     de n datos sigue siendo tan dispersa como uno
  máxima verosimilitud   θ̂ = argmax P(datos | θ); se maximiza log P (suma    σ̂² con divisor n es sesgado (E = (n−1)/n·σ²);
                         de logs, sin underflow del producto)                 la verosimilitud no es la probabilidad de θ
  entropía, entropía     H(p) = −Σ p log p; H(p,q) = −Σ p log q = H(p) +      KL no es simétrica y vale ∞ si q = 0 donde p > 0;
  cruzada y KL           KL(p‖q), con KL ≥ 0 y KL = 0 solo si p = q           log(0) da −inf: usa 0·log 0 = 0 y log-sum-exp
  regresión logística    P(y=1|x) = σ(w·x + b), entrenada minimizando la      datos linealmente separables: el máximo no
                         pérdida log con gradiente (p − y)·x                  existe (‖w‖ → ∞); σ ingenua desborda con |z| grande

Costes: simular k personas con T intentos cuesta O(T·k); la fórmula exacta, O(k). Un paso de descenso en regresión logística
cuesta O(n·d) (n datos, d variables), así que el entrenamiento completo es O(pasos·n·d). El error de cualquier estimación
Monte Carlo baja como O(n^-1/2): un dígito más exige 100 veces más datos.
"""
import math

import matplotlib.pyplot as plt
import numpy as np


def titulo(texto: str) -> None:
    print(f'\n=== {texto} ===')


rng = np.random.default_rng(16)                          # semilla fija: la salida es idéntica en cada ejecución


# ═════════════════════════════════════════════════════════════════
# 1. PROBABILIDAD EXACTA FRENTE A SIMULACIÓN, Y LA ESPERANZA
# ═════════════════════════════════════════════════════════════════
# Cumpleaños: ¿cuántas personas hacen falta para que dos compartan día con probabilidad 1/2? La intuición dice ~180, pero la
# cuenta es del COMPLEMENTARIO: P(todos distintos) = ∏ (1 − i/m) para i = 0..k−1, y P(alguna coincidencia) = 1 − eso.
# Con k personas hay k(k−1)/2 pares y cada uno coincide con probabilidad 1/m: los pares crecen como k², no como k.
titulo('1. Cumpleaños: exacta frente a simulada')


def p_coincidencia(k, m=365):
    return 1 - np.prod(1 - np.arange(k) / m)


def simula_coincidencia(k, m, intentos):
    dias = np.sort(rng.integers(0, m, (intentos, k)), axis=1)    # ordenados, un día repetido tiene un vecino igual
    return np.mean((np.diff(dias, axis=1) == 0).any(axis=1))


print(f'{"k":>4} {"exacta":>8} {"simulada":>9} {"error típico":>13}')
for k in (10, 23, 30, 50, 70):
    exacta, simulada = p_coincidencia(k), simula_coincidencia(k, 365, 20_000)
    print(f'{k:4d} {exacta:8.4f} {simulada:9.4f} {math.sqrt(exacta * (1 - exacta) / 20_000):13.4f}')
# La simulada cae dentro de ~2 errores típicos de la exacta. Con k = 23 la probabilidad ya es 0.507.

# Hashing: m casillas son m «días». Con P ≈ 1 − e^(−k(k−1)/2m) la mediana de la primera colisión está en k ≈ 1.1774·√m:
# una tabla con 2³² casillas colisiona (50 %) con ~77 000 claves, no con 2·10⁹. Por eso los hashes de 64 bits se
# consideran seguros hasta ~5·10⁹ claves, y por eso el encadenamiento o el sondeo son necesarios aunque la tabla esté vacía.
print(f'\n{"m (casillas)":>13} {"k = ⌈1.1774·√m⌉":>16} {"P exacta":>9} {"1 − e^(−k²/2m)":>15}')
for m in (365, 10 ** 4, 10 ** 6, 2 ** 32):
    k = math.ceil(1.1774 * math.sqrt(m))
    print(f'{m:13d} {k:16d} {p_coincidencia(k, m):9.4f} {1 - math.exp(-k * (k - 1) / (2 * m)):15.4f}')

# Esperanza: E[X] = Σ x·P(X=x) es el límite de la media de muchas repeticiones (ley de los grandes números, sección 3).
dado = rng.integers(1, 7, 1_000_000)
medias = np.cumsum(dado) / np.arange(1, dado.size + 1)
print('\nmedia de n tiradas de un dado (E[X] = 3.5):')
for n in (10, 100, 10_000, 1_000_000):
    print(f'  n = {n:9d}: {medias[n - 1]:.4f}   |error| = {abs(medias[n - 1] - 3.5):.4f}')

# Linealidad: E[X₁ + … + X_N] = E[X₁] + … + E[X_N] SIEMPRE, sin independencia. El truco es descomponer en INDICADORAS
# (1 si ocurre, 0 si no), cuya esperanza es la probabilidad. Nº de pares con el mismo día entre k personas = Σ de C(k,2)
# indicadoras, cada una con E = 1/m, y aunque no sean independientes (A=B y B=C implican A=C) la suma de esperanzas vale:
k, m = 30, 365


def pares_iguales(k, m):
    c = np.bincount(rng.integers(0, m, k), minlength=m)         # c[d] = personas con cumpleaños el día d
    return int(np.sum(c * (c - 1) // 2))


print(f'\nE[pares con el mismo día], k = 30: C(30,2)/365 = {k * (k - 1) / 2 / m:.4f} · simulado {np.mean([pares_iguales(k, m) for _ in range(5000)]):.4f}')
# E[pares] = 1 cuando k ≈ √(2m): ese es el umbral de colisión en una tabla hash (con m = 365, k ≈ 27).


# Quicksort con pivote aleatorio: ¿cuántas comparaciones hace en media? Los elementos de rango i < j se comparan si y solo si
# el PRIMER pivote elegido entre los de rangos i..j es i o j: probabilidad 2/(j−i+1). Sumando indicadoras (linealidad):
def comparaciones_quicksort(v):
    if len(v) < 2:
        return 0
    pivote = v[rng.integers(len(v))]
    return len(v) - 1 + comparaciones_quicksort(v[v < pivote]) + comparaciones_quicksort(v[v > pivote])


n_q = 100
una_linea = sum(2 / (j - i + 1) for i in range(n_q) for j in range(i + 1, n_q))
armonico = sum(1 / i for i in range(1, n_q + 1))
simuladas = np.mean([comparaciones_quicksort(rng.permutation(n_q)) for _ in range(300)])
print(f'\nquicksort aleatorio, n = {n_q}: E[comparaciones] = Σ 2/(j−i+1) = {una_linea:.2f} = 2(n+1)Hₙ − 4n = '
      f'{2 * (n_q + 1) * armonico - 4 * n_q:.2f} · simulado {simuladas:.2f} (≈ 1.39·n·log₂n = {1.39 * n_q * math.log2(n_q):.0f})')


# ═════════════════════════════════════════════════════════════════
# 2. BAYES: DE LA A PRIORI A LA A POSTERIORI
# ═════════════════════════════════════════════════════════════════
# P(enfermo | +) = P(+ | enfermo)·P(enfermo) / P(+), con P(+) = sens·prev + (1 − esp)·(1 − prev) (probabilidad total).
# Un test con sensibilidad 95 % y especificidad 90 % parece fiable, pero si la enfermedad afecta al 1 % ocurre lo siguiente:
titulo('2. Bayes: test diagnóstico con prevalencia baja')
prev, sens, esp = 0.01, 0.95, 0.90
enfermos = round(10_000 * prev)
verdaderos, falsos = enfermos * sens, (10_000 - enfermos) * (1 - esp)
print(f'en 10 000 personas: {enfermos} enfermas ({verdaderos:.0f} dan +) y {10_000 - enfermos} sanas ({falsos:.0f} dan + por error)')
print(f'de {verdaderos + falsos:.0f} positivos solo {verdaderos:.0f} están enfermos: P(enfermo | +) = {verdaderos / (verdaderos + falsos):.4f}')
# Las «frecuencias naturales» (contar personas) dan la intuición; la fórmula, el mismo número. Y una simulación lo confirma:
enfermo = rng.random(1_000_000) < prev
positivo = np.where(enfermo, rng.random(1_000_000) < sens, rng.random(1_000_000) < 1 - esp)
print(f'simulado (1e6 personas): {np.mean(enfermo[positivo]):.4f}')


def posterior(prior, sens, esp):
    return prior * sens / (prior * sens + (1 - prior) * (1 - esp))


print('\nprevalencia → P(enfermo | +):', {p: round(posterior(p, sens, esp), 3) for p in (0.001, 0.01, 0.1, 0.5)})
# La a posteriori depende MUCHÍSIMO de la a priori (la tasa base): el mismo test es casi inútil para una enfermedad rara.
# Actualización secuencial: la a posteriori de un test es la a priori del siguiente (si los tests son independientes dado el estado).
p = prev
for k in (1, 2, 3):
    p = posterior(p, sens, esp)
    print(f'  tras {k} positivo(s) seguidos: {p:.4f}')
# En cocientes de apuestas (odds = p/(1−p)): odds a posteriori = odds a priori × (sens / (1 − esp)). Cada positivo MULTIPLICA
# las odds por 9.5, es decir, SUMA log 9.5 al log-odds. Esa «evidencia que se suma» es la regresión logística (sección 5).
logit = lambda q: math.log(q / (1 - q))
print(f'log-odds: {logit(posterior(prev, sens, esp)):.4f} = {logit(prev):.4f} + log({sens / (1 - esp):.1f}) = {logit(prev) + math.log(sens / (1 - esp)):.4f}')


# ═════════════════════════════════════════════════════════════════
# 3. VARIANZA, LEY DE LOS GRANDES NÚMEROS Y TEOREMA CENTRAL DEL LÍMITE
# ═════════════════════════════════════════════════════════════════
# Var(X) = E[(X − μ)²] mide la dispersión: Var(aX + b) = a²·Var(X), y para X, Y independientes Var(X + Y) = Var X + Var Y.
# Luego la media de n independientes tiene Var = σ²/n: su desviación típica es σ/√n. La LGN dice que la media tiende a μ;
# el TCL dice más: (media − μ)/(σ/√n) tiende a N(0,1) PARTIENDO DE CUALQUIER distribución con varianza finita.
# Prueba con X ~ exponencial(1) (μ = 1, σ = 1, asimetría 2: nada que ver con una campana):
titulo('3. Teorema central del límite (X exponencial)')
muestras = rng.exponential(1.0, (20_000, 64))                   # 20 000 muestras de 64 datos cada una
print(f'{"n":>3} {"σ/√n teórica":>13} {"desv. de las medias":>20} {"asimetría teórica 2/√n":>23} {"asimetría medida":>17}')
for n in (1, 4, 16, 64):
    m_n = muestras[:, :n].mean(axis=1)                          # 20 000 medias de las primeras n columnas
    asimetria = np.mean(((m_n - m_n.mean()) / m_n.std()) ** 3)
    print(f'{n:3d} {1 / math.sqrt(n):13.4f} {m_n.std():20.4f} {2 / math.sqrt(n):23.3f} {asimetria:17.3f}')
# Cuadruplicar n reduce el error a la mitad: es el 1/√n de Monte Carlo (lección 12, sección 3). Y la forma se vuelve simétrica.
fig, ejes = plt.subplots(1, 4, figsize=(11, 2.8), sharey=True)
for eje, n in zip(ejes, (1, 2, 8, 64)):
    eje.hist(muestras[:, :n].mean(axis=1), bins=40, range=(0, 3), density=True, color='tab:blue', alpha=0.6)
    xs = np.linspace(0, 3, 200)
    eje.plot(xs, np.exp(-(xs - 1) ** 2 * n / 2) * math.sqrt(n / (2 * math.pi)), color='tab:red', linewidth=1.5)
    eje.set_title(f'media de n = {n}', fontsize=9)
fig.suptitle('Histograma de medias de exponenciales y la gaussiana N(1, 1/n) del TCL (roja)', fontsize=10)
plt.tight_layout()
plt.show()                                                      # la gráfica aparece en el panel Salida

# Trampa: sin varianza finita ni media (Cauchy), la media de n datos tiene EXACTAMENTE la misma dispersión que un dato.
cauchy = rng.standard_cauchy((200, 10_000))
for n in (1, 100, 10_000):
    q75, q25 = np.percentile(cauchy[:, :n].mean(axis=1), [75, 25])
    print(f'Cauchy: rango intercuartílico de la media de n = {n:5d} datos: {q75 - q25:.2f}  (no baja: ni LGN ni TCL)')


# ═════════════════════════════════════════════════════════════════
# 4. MÁXIMA VEROSIMILITUD: DE LA GAUSSIANA AL ERROR CUADRÁTICO
# ═════════════════════════════════════════════════════════════════
# Con datos x₁..xₙ independientes de N(μ, σ²), P(datos | μ, σ) = ∏ f(xᵢ). Se maximiza el LOG (sube a la vez, el producto de
# n densidades pequeñas haría underflow, y los productos se vuelven sumas):
#   ℓ(μ, σ) = Σ [ −log σ − ½ log 2π − (xᵢ − μ)² / 2σ² ]
#   ∂ℓ/∂μ = Σ (xᵢ − μ)/σ² = 0  →  μ̂ = media       ∂ℓ/∂σ = −n/σ + Σ (xᵢ − μ)²/σ³ = 0  →  σ̂² = (1/n)·Σ (xᵢ − μ̂)²
titulo('4. Máxima verosimilitud (gaussiana)')
datos = rng.normal(5.0, 2.0, 50)                                # verdad: μ = 5, σ = 2


def log_verosimilitud(mu, sigma, x):
    return np.sum(-np.log(sigma) - 0.5 * np.log(2 * np.pi) - (x - mu) ** 2 / (2 * sigma ** 2))


mus, sigmas = np.linspace(3, 7, 4001), np.linspace(0.5, 4, 3501)
mu_gorro = mus[np.argmax([log_verosimilitud(mu, datos.std(), datos) for mu in mus])]
sigma_gorro = sigmas[np.argmax([log_verosimilitud(datos.mean(), s, datos) for s in sigmas])]
print(f'búsqueda en rejilla de ℓ: μ̂ = {mu_gorro:.3f} (media {datos.mean():.3f}) · σ̂ = {sigma_gorro:.3f} (np.std con divisor n: {datos.std():.3f})')
# np.std divide por n por defecto (ddof=0): es el estimador de máxima verosimilitud. Pero es SESGADO: tiende a quedarse corto.
pequenas = rng.normal(0.0, 1.0, (100_000, 5))                   # 100 000 muestras de n = 5 con σ² = 1
print(f'E[σ̂²] con n = 5: divisor n → {pequenas.var(axis=1).mean():.3f} (teoría (n−1)/n = 0.8) · divisor n−1 → {pequenas.var(axis=1, ddof=1).mean():.3f}')

# Regresión: y = w·x + b + ε con ε ~ N(0, σ²) significa y | x ~ N(w·x + b, σ²), y entonces
#   −ℓ(w, b) = (n/2σ²)·ECM(w, b) + n·log σ + (n/2)·log 2π     con ECM = media de (yᵢ − w·xᵢ − b)²
# Con σ fijo la verosimilitud es una función DECRECIENTE del ECM (misma pendiente, mismo mínimo): minimizar el error
# cuadrático ES máxima verosimilitud bajo ruido gaussiano. (Con ruido de Laplace saldría el error absoluto.)
x_r = rng.uniform(-1, 1, 40)
y_r = 2 * x_r + 1 + rng.normal(0.0, 0.5, 40)
ws = np.linspace(0, 4, 801)
ecm = np.array([np.mean((y_r - (w * x_r + 1)) ** 2) for w in ws])                       # b = 1 conocido
nll = np.array([-log_verosimilitud(w * x_r + 1, 0.5, y_r) for w in ws])
resto = nll - 40 / (2 * 0.5 ** 2) * ecm
print(f'\nmejor w por ECM: {ws[np.argmin(ecm)]:.3f} · por −ℓ: {ws[np.argmin(nll)]:.3f} · −ℓ − (n/2σ²)·ECM varía {np.ptp(resto):.1e} (constante)')


# ═════════════════════════════════════════════════════════════════
# 5. ENTROPÍA, ENTROPÍA CRUZADA, KL Y REGRESIÓN LOGÍSTICA
# ═════════════════════════════════════════════════════════════════
# H(p) = −Σ p log p mide la sorpresa media (en nats con log natural; en bits con log₂). La entropía cruzada
# H(p, q) = −Σ p log q es la sorpresa media cuando la realidad es p y el modelo cree q, y siempre es H(p, q) = H(p) + KL(p‖q)
# con KL(p‖q) = Σ p log(p/q) ≥ 0 (desigualdad de Gibbs), nula solo si q = p. Por eso H(p, q) se minimiza en q = p.
titulo('5. Entropía, entropía cruzada y KL')


def entropia(p):
    p = np.asarray(p, dtype=float)
    return -np.sum(p[p > 0] * np.log(p[p > 0]))                 # la máscara aplica la convención 0·log 0 = 0 sin avisos


for q in (0.5, 0.9, 0.99, 1.0):
    print(f'moneda con P(cara) = {q}: H = {entropia([q, 1 - q]) / math.log(2):.3f} bits')
# Máxima incertidumbre en p = 1/2 (1 bit) y ninguna en p = 1. Ahora con realidad p = 0.3 y un modelo q de Bernoulli:
p_real = 0.3
print(f'\n{"q":>5} {"H(p, q)":>9} {"H(p) + KL(p‖q)":>15} {"KL(p‖q)":>9} {"KL(q‖p)":>9}')
for q in (0.1, 0.2, 0.3, 0.4, 0.6):
    cruzada = -(p_real * math.log(q) + (1 - p_real) * math.log(1 - q))
    kl_pq = p_real * math.log(p_real / q) + (1 - p_real) * math.log((1 - p_real) / (1 - q))
    kl_qp = q * math.log(q / p_real) + (1 - q) * math.log((1 - q) / (1 - p_real))
    print(f'{q:5.2f} {cruzada:9.4f} {entropia([p_real, 1 - p_real]) + kl_pq:15.4f} {kl_pq:9.4f} {kl_qp:9.4f}')
# La cruzada es mínima en q = 0.3 (= H(p) = 0.6109) y KL(p‖q) ≠ KL(q‖p): no es una distancia, es una divergencia dirigida.

# Pérdida de clasificación = −log-verosimilitud. Para una etiqueta y ∈ {0, 1} y p̂ = P(y = 1 | x): P(y | x) = p̂^y·(1 − p̂)^(1−y), luego
# −log P(y | x) = −[y·log p̂ + (1 − y)·log(1 − p̂)]: la entropía cruzada entre la etiqueta (p = «todo en y») y el modelo (p̂, 1 − p̂).
# Con k clases es −log softmax(z)[y] = log Σ exp(zⱼ) − z_y (softmax: lección 8). Se calcula así, sin exponenciar logits grandes:
logits = np.array([1000.0, 0.0, -1000.0])
log_suma = logits.max() + np.log(np.sum(np.exp(logits - logits.max())))                 # log-sum-exp estable
print(f'\npérdida de cada clase con logits {logits.tolist()}: {[float(log_suma - z) for z in logits]} (exp(1000) sería inf)')
with np.errstate(all='ignore'):
    print(f'log σ(−800): ingenuo log(1/(1 + e^800)) = {np.log(1 / (1 + np.exp(800.0)))} · estable −logaddexp(0, 800) = {-np.logaddexp(0, 800.0)}')


# Regresión logística: p̂ = σ(z) con z = w·x + b. Pérdida media L = (1/n)·Σ [softplus(zᵢ) − yᵢ·zᵢ] (equivale a la entropía
# cruzada con log σ(z) = −softplus(−z)). Gradiente por la regla de la cadena, para UN dato:
#   ∂ℓ/∂p̂ = −y/p̂ + (1 − y)/(1 − p̂) = (p̂ − y) / (p̂(1 − p̂))        ∂p̂/∂z = σ'(z) = p̂(1 − p̂)        ∂z/∂w = x
#   ⇒ ∂ℓ/∂z = p̂ − y (el p̂(1 − p̂) se CANCELA)   ⇒   ∂ℓ/∂w = (p̂ − y)·x ,  ∂ℓ/∂b = p̂ − y
# La pérdida log con la sigmoide da un gradiente sin factor σ' que se anule: con el error cuadrático, un modelo muy seguro y
# muy equivocado (p̂ ≈ 1, y = 0) tendría gradiente (p̂ − y)·p̂(1 − p̂) ≈ 0 y apenas aprendería.
def sig(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))              # el recorte evita el desbordamiento (el ejercicio 6 la hace exacta)


def perdida_logistica(w, b, X, y):
    z = X @ w + b
    return float(np.mean(np.logaddexp(0, z) - y * z))


def gradiente_logistico(w, b, X, y):
    error = sig(X @ w + b) - y                                   # (p̂ − y) de cada dato
    return X.T @ error / len(y), float(np.mean(error))


# Datos 2D sintéticos: dos nubes gaussianas N(±(1, 1), I) que se solapan. Aquí el modelo verdadero (sección 2: Bayes con
# gaussianas de igual covarianza) tiene log-odds = 2·x₁ + 2·x₂ + 0, es decir w = (2, 2), b = 0: el entrenamiento debe rondarlo.
X = np.vstack([rng.normal(-1.0, 1.0, (100, 2)), rng.normal(1.0, 1.0, (100, 2))])
y = np.r_[np.zeros(100), np.ones(100)]
w0, b0 = rng.normal(size=2), 0.3
g_w, g_b = gradiente_logistico(w0, b0, X, y)
paso = 1e-6
numerico = [(perdida_logistica(w0 + paso * e, b0, X, y) - perdida_logistica(w0 - paso * e, b0, X, y)) / (2 * paso) for e in np.eye(2)]
print(f'\ngradiente analítico {np.round(g_w, 6)} frente a diferencias centrales {np.round(numerico, 6)} (error {np.max(np.abs(g_w - numerico)):.1e})')


def entrenar_traza(X, y, tasa, pasos):
    """Descenso de gradiente con la historia de la pérdida. Solo para mirar: el ejercicio `regresion_logistica` es la versión completa."""
    w, b, historia = np.zeros(X.shape[1]), 0.0, []
    for _ in range(pasos):
        historia.append(perdida_logistica(w, b, X, y))
        g_w, g_b = gradiente_logistico(w, b, X, y)
        w, b = w - tasa * g_w, b - tasa * g_b
    return w, b, historia


w, b, historia = entrenar_traza(X, y, 0.5, 1000)
for k in (0, 10, 100, 999):
    print(f'paso {k:4d}: pérdida {historia[k]:.4f}')
print(f'w = {np.round(w, 2)}, b = {b:.2f} · precisión {np.mean((X @ w + b > 0) == y):.3f} · pérdida de la solución verdadera (2, 2, 0): {perdida_logistica(np.array([2.0, 2.0]), 0.0, X, y):.4f}')
# Con 200 datos solapados el máximo de verosimilitud ronda la verdad con ruido, y la precisión máxima posible es Φ(√2) ≈ 0.92.

fig, (eje_perdida, eje_datos) = plt.subplots(1, 2, figsize=(10, 3.6))
eje_perdida.plot(historia, color='tab:blue')
eje_perdida.set_xlabel('paso')
eje_perdida.set_ylabel('pérdida log (entropía cruzada media)')
eje_perdida.set_title('Entrenamiento', fontsize=10)
rejilla = np.linspace(-4, 4, 120)
u, v = np.meshgrid(rejilla, rejilla)
prob = sig(w[0] * u + w[1] * v + b)
eje_datos.contourf(u, v, prob, levels=np.linspace(0, 1, 11), cmap='RdBu_r', alpha=0.35)
eje_datos.contour(u, v, prob, levels=[0.5], colors='black', linewidths=1.5)
eje_datos.scatter(X[:, 0], X[:, 1], c=y, cmap='RdBu_r', edgecolors='black', linewidths=0.4, s=18)
eje_datos.set_title('Frontera w·x + b = 0 (P = 0.5) y probabilidad', fontsize=10)
eje_datos.set_xlabel('x₁')
eje_datos.set_ylabel('x₂')
plt.tight_layout()
plt.show()


# ═════════════════════════════════════════════════════════════════
# EJERCICIOS
# ═════════════════════════════════════════════════════════════════

# ── Ejercicio 1 · prob_cumpleanos ───────────────────────────────
def prob_cumpleanos(k: int, dias: int = 365) -> float:
    """
    Probabilidad EXACTA (sin simular) de que, entre k personas con cumpleaños uniforme en `dias` días, al menos dos coincidan.
    Devuelve float. Especificación exacta:
      - k < 0 o dias < 1 → ValueError. k <= 1 → 0.0. k > dias → 1.0 exacto (principio del palomar).
      - En el resto, 1 − ∏ (1 − i/dias) con i = 0..k−1, pero calculada ESTABLE: con sumas de logs (np.log1p) y np.expm1,
        porque 1 − (algo muy cercano a 1) pierde todos los dígitos si la probabilidad es diminuta.
      prob_cumpleanos(23)  →  0.5072972343239857       prob_cumpleanos(3, 2 ** 60)  →  ≈ 3 / 2 ** 60 (con error relativo ~1e-16)
    Coste: O(k) tiempo y memoria (un array vectorizado).
    """
    pendiente()


# ── Ejercicio 2 · bayes ─────────────────────────────────────────
def bayes(prior: float, sensibilidad: float, especificidad: float) -> float:
    """
    P(enfermo | positivo) por el teorema de Bayes. `prior` = P(enfermo), `sensibilidad` = P(+ | enfermo),
    `especificidad` = P(− | sano). Devuelve float.
      - Cada argumento debe estar en [0, 1]; si no → ValueError.
      - P(+) = sens·prior + (1 − esp)·(1 − prior). Si P(+) == 0 (un positivo imposible) → ValueError, no ZeroDivisionError.
      bayes(0.01, 0.95, 0.90)  →  0.0875576...      (un test «bueno», pero la enfermedad es rara)
    Coste: O(1).
    """
    pendiente()


# ── Ejercicio 3 · media_varianza ────────────────────────────────
def media_varianza(valores, probs) -> tuple:
    """
    Esperanza y varianza de una variable aleatoria DISCRETA que toma `valores[i]` con probabilidad `probs[i]`. Devuelve la
    tupla (esperanza, varianza) de floats. Acepta listas o arrays.
      - Longitudes distintas, alguna probabilidad negativa o |Σ probs − 1| > 1e-9 → ValueError.
      - Varianza = Σ pᵢ·(xᵢ − μ)² (resta la media ANTES de elevar: E[X²] − μ² pierde todas las cifras si |μ| ≫ σ).
      media_varianza([1, 2, 3, 4, 5, 6], [1/6] * 6)  →  (3.5, 2.9166666666666665)
    Coste: O(n).
    """
    pendiente()


# ── Ejercicio 4 · mle_gaussiana ─────────────────────────────────
def mle_gaussiana(datos) -> tuple:
    """
    Estimador de máxima verosimilitud (μ̂, σ̂) de una gaussiana a partir de una muestra. Devuelve la tupla de floats.
      - μ̂ = media; σ̂ = √( (1/n)·Σ (xᵢ − μ̂)² ) con divisor n (el de máxima verosimilitud, SESGADO; NO n − 1).
      - Muestra vacía → ValueError. Con un solo dato devuelve (dato, 0.0). Calcula con dos pasadas (resta la media).
      mle_gaussiana([1, 2, 3, 4, 5])  →  (3.0, 1.4142135623730951)
    Coste: O(n).
    """
    pendiente()


# ── Ejercicio 5 · entropia_cruzada ──────────────────────────────
def entropia_cruzada(p, q) -> float:
    """
    H(p, q) = −Σ pᵢ·log qᵢ en nats (log natural) para dos distribuciones discretas de igual longitud (listas o arrays). Float.
      - Longitudes distintas o algún valor negativo → ValueError. No se comprueba que sumen 1.
      - Convención 0·log 0 = 0: si pᵢ == 0 el término vale 0 AUNQUE qᵢ sea 0.
      - Si algún pᵢ > 0 tiene qᵢ == 0 devuelve math.inf (el límite es +∞: el modelo declara imposible lo que ocurre), sin
        warnings ni nan.
      entropia_cruzada([0.5, 0.25, 0.25], [1/3, 1/3, 1/3])  →  1.0986122886681098 (= log 3)
    Coste: O(n).
    """
    pendiente()


# ── Ejercicio 6 · kl ────────────────────────────────────────────
def kl(p, q) -> float:
    """
    Divergencia de Kullback-Leibler KL(p‖q) = Σ pᵢ·log(pᵢ/qᵢ) en nats. Mismas reglas que `entropia_cruzada`
    (longitudes, negativos, 0·log 0 = 0, math.inf si pᵢ > 0 y qᵢ == 0).
      - Calcúlala como Σ pᵢ·log(pᵢ/qᵢ) directamente, no como H(p, q) − H(p): así kl(p, p) es 0.0 exacto y no ±1e-17.
      kl([0.5, 0.25, 0.25], [1/3, 1/3, 1/3])  →  0.0588915178281919       kl([0.5, 0.5], [1.0, 0.0])  →  inf
    Coste: O(n).
    """
    pendiente()


# ── Ejercicio 7 · sigmoide ──────────────────────────────────────
def sigmoide(z):
    """
    σ(z) = 1 / (1 + e^(−z)), numéricamente estable. Acepta un escalar (devuelve float) o un array de cualquier forma
    (devuelve un ndarray float de la misma forma).
      - Sin overflow ni warnings para |z| enorme: σ(−1000) = 0.0 y σ(1000) = 1.0, sin evaluar e^1000.
      - Pista: exponencia solo −|z| (siempre ≤ 0, no desborda) y elige la fórmula según el signo de z.
      sigmoide(2)  →  0.8807970779778823        sigmoide(np.array([-1000.0, 0.0, 1000.0]))  →  [0., 0.5, 1.]
    Coste: O(tamaño de z).
    """
    pendiente()


# ── Ejercicio 8 · regresion_logistica ───────────────────────────
def regresion_logistica(X, y, tasa: float, pasos: int) -> tuple:
    """
    Regresión logística binaria por descenso de gradiente sobre la pérdida log MEDIA. X: (n, d) con una fila por dato;
    y: (n,) con etiquetas 0 o 1. Devuelve la tupla (w, b): w ndarray (d,) de float y b float.
      - Pesos iniciales w = 0 y b = 0. Exactamente `pasos` iteraciones (pasos = 0 → (ceros, 0.0)).
      - Cada paso: p = σ(X·w + b); w ← w − tasa·Xᵀ(p − y)/n; b ← b − tasa·media(p − y), con ambos gradientes calculados
        ANTES de actualizar. Usa tu `sigmoide` (con |z| grande no puede dar warnings).
      - X no 2D, y de otra longitud que X, y con valores fuera de {0, 1} o pasos < 0 → ValueError. No modifica X ni y.
      regresion_logistica([[1], [2], [3], [4]], [0, 0, 1, 1], 1.0, 1)  →  (array([0.5]), 0.0)
    Coste: O(pasos·n·d) tiempo, O(n) memoria extra.
    """
    pendiente()


# ═════════════════════════════════════════════════════════════════
# PRUEBAS (los resultados aproximados se comparan con una tolerancia explícita)
# ═════════════════════════════════════════════════════════════════

def _plano(v):
    """Aplana un número, un array o una tupla de ellos (como (w, b)) a un vector de float."""
    if isinstance(v, tuple):
        return np.concatenate([np.ravel(np.asarray(t, dtype=float)) for t in v])
    return np.asarray(v, dtype=float)


def _cerca(tolerancia: float):
    """Comparador para `prueba`: misma forma y |actual - esperado| <= tolerancia en cada elemento. No acepta bool ni None."""
    def comparar(actual, esperado) -> bool:
        if isinstance(actual, (bool, str)) or actual is None:
            return False
        try:
            a, e = _plano(actual), _plano(esperado)
        except (TypeError, ValueError):
            return False
        return a.shape == e.shape and bool(np.allclose(a, e, rtol=0.0, atol=tolerancia))
    return comparar


def _estricto(f):
    """Ejecuta f() y convierte en excepción cualquier overflow, división por cero o nan que numpy iba a avisar."""
    with np.errstate(over='raise', divide='raise', invalid='raise'):
        return f()


prueba('prob_cumpleanos', {
    'k = 23: la paradoja (50.7 %)': ((23,), 0.5072972343239857),
    'k = 70: casi seguro': ((70,), 0.9991595759651571),
    'k = 2: 1/365': ((2,), 1 / 365),
    'k = 0 y k = 1: nadie coincide': ((1,), 0.0),
    'una sola persona con un día': ((1, 1), 0.0),
    'k = 366: palomar → 1.0': ((366,), 1.0),
    'k = dias + 1 con pocos días': ((4, 3), 1.0),
    'k = 3 en 3 días: 1 − 3!/3³': ((3, 3), 1 - 6 / 27),
    'dado de 6 caras, dos tiradas': ((2, 6), 1 / 6),
    'hash de 32 bits con ~77 163 claves: ≈ 1/2': ((77163, 2 ** 32), 0.4999998905173483),
}, comparador=_cerca(1e-8))
grupo('prob_cumpleanos (estabilidad y errores)')
comprueba('k = 0 devuelve 0.0', lambda: prob_cumpleanos(0), 0.0)
comprueba('probabilidad diminuta (k = 3, 2⁶⁰ días): error RELATIVO < 1e-9', lambda: abs(prob_cumpleanos(3, 2 ** 60) / (3 / 2 ** 60) - 1) < 1e-9, True)
comprueba('crece con k (monótona hasta 366)', lambda: bool(np.all(np.diff([prob_cumpleanos(k) for k in range(0, 367)]) >= 0)), True)
comprueba('devuelve float', lambda: type(prob_cumpleanos(23)).__name__, 'float')
lanza('k negativo', lambda: prob_cumpleanos(-1), ValueError)
lanza('dias = 0', lambda: prob_cumpleanos(2, 0), ValueError)

prueba('bayes', {
    '1 % de prevalencia, test 95 % / 90 %': ((0.01, 0.95, 0.90), 0.0875576036866359),
    'prevalencia 50 %: posterior = sensibilidad con test simétrico': ((0.5, 0.99, 0.99), 0.99),
    'test sin información (sens = 1 − esp): no cambia nada': ((0.2, 0.7, 0.3), 0.2),
    'prevalencia 0: nunca hay enfermos': ((0.0, 0.95, 0.90), 0.0),
    'prevalencia 1: siempre enfermos': ((1.0, 0.95, 0.90), 1.0),
    'test perfecto': ((0.001, 1.0, 1.0), 1.0),
    'enfermedad muy común: el + casi confirma': ((0.9, 0.95, 0.90), 0.9884393063583815),
}, comparador=_cerca(1e-12))
grupo('bayes (errores)')
lanza('prior fuera de [0, 1]', lambda: bayes(1.5, 0.9, 0.9), ValueError)
lanza('sensibilidad negativa', lambda: bayes(0.1, -0.1, 0.9), ValueError)
lanza('un positivo imposible: prior 0 y especificidad 1', lambda: bayes(0.0, 0.9, 1.0), ValueError)

prueba('media_varianza', {
    'dado justo': (([1, 2, 3, 4, 5, 6], [1 / 6] * 6), (3.5, 35 / 12)),
    'moneda sesgada 0/1 con P(1) = 0.3': (([0, 1], [0.7, 0.3]), (0.3, 0.21)),
    'constante: varianza 0': (([5], [1.0]), (5.0, 0.0)),
    'arrays de numpy': ((np.array([-1.0, 1.0]), np.array([0.5, 0.5])), (0.0, 1.0)),
    'valores con probabilidad 0 no cuentan': (([1, 2, 1000], [0.5, 0.5, 0.0]), (1.5, 0.25)),
    'cancelación: 10⁹ + {0, 1} → varianza 0.25 (no 0)': (([1e9, 1e9 + 1], [0.5, 0.5]), (1e9 + 0.5, 0.25)),
}, comparador=_cerca(1e-9))
grupo('media_varianza (tipos y errores)')
comprueba('devuelve una tupla de dos float', lambda: [type(v).__name__ for v in media_varianza([0, 1], [0.5, 0.5])] + [type(media_varianza([0, 1], [0.5, 0.5])).__name__], ['float', 'float', 'tuple'])
lanza('no suma 1', lambda: media_varianza([1, 2], [0.5, 0.4]), ValueError)
lanza('probabilidad negativa (aunque sume 1)', lambda: media_varianza([1, 2, 3], [-0.5, 0.75, 0.75]), ValueError)
lanza('longitudes distintas', lambda: media_varianza([1, 2, 3], [0.5, 0.5]), ValueError)

_azar = np.random.default_rng(3).normal(10.0, 3.0, 500)


def _maximiza_ll() -> bool:
    mu, s = mle_gaussiana(_azar)
    mejor = log_verosimilitud(mu, s, _azar)
    return all(mejor >= log_verosimilitud(mu + dm, s * ds, _azar) for dm in (-0.1, 0, 0.1) for ds in (0.95, 1, 1.05))


prueba('mle_gaussiana', {
    '1..5': (([1, 2, 3, 4, 5],), (3.0, math.sqrt(2))),
    'divisor n y no n − 1: [0, 2]': (([0, 2],), (1.0, 1.0)),
    'un solo dato: σ = 0': (([7.5],), (7.5, 0.0)),
    'datos constantes': (([2, 2, 2],), (2.0, 0.0)),
    'cancelación: 10⁹ + {0, 1, 2, 3}': (([1e9, 1e9 + 1, 1e9 + 2, 1e9 + 3],), (1e9 + 1.5, math.sqrt(1.25))),
    'array de numpy': ((np.array([-2.0, 0.0, 2.0]),), (0.0, math.sqrt(8 / 3))),
}, comparador=_cerca(1e-9))
grupo('mle_gaussiana (propiedades)')
comprueba('coincide con np.mean y np.std (ddof = 0) en 500 datos', lambda: _cerca(1e-9)(mle_gaussiana(_azar), (_azar.mean(), _azar.std())), True)
comprueba('maximiza la log-verosimilitud frente a sus vecinos', _maximiza_ll, True)
comprueba('devuelve una tupla', lambda: type(mle_gaussiana([1.0, 2.0])).__name__, 'tuple')
lanza('muestra vacía', lambda: mle_gaussiana([]), ValueError)

_p3, _u3 = [0.5, 0.25, 0.25], [1 / 3] * 3
prueba('entropia_cruzada', {
    'con q uniforme: log 3': ((_p3, _u3), math.log(3)),
    'q = p: es la entropía de p (1.5 bits)': ((_p3, _p3), 1.5 * math.log(2)),
    'moneda justa: log 2': (([0.5, 0.5], [0.5, 0.5]), math.log(2)),
    'p determinista, q uniforme': (([1.0, 0.0], [0.5, 0.5]), math.log(2)),
    'p = 0 con q = 0: 0·log 0 = 0': (([1.0, 0.0], [1.0, 0.0]), 0.0),
    'p = 0 con q = 0 en medio': (([0.5, 0.0, 0.5], [0.5, 0.0, 0.5]), math.log(2)),
    'q = 0 donde p > 0: infinito': (([0.5, 0.5], [1.0, 0.0]), math.inf),
    'arrays de numpy': ((np.array([0.9, 0.1]), np.array([0.5, 0.5])), math.log(2)),
    'modelo muy seguro y equivocado: p = (0, 1), q = (0.99, 0.01)': (([0.0, 1.0], [0.99, 0.01]), -math.log(0.01)),
}, comparador=_cerca(1e-12))
grupo('entropia_cruzada (sin avisos y errores)')
comprueba('q = 0 donde p > 0: sin warnings de numpy', lambda: _estricto(lambda: entropia_cruzada([0.5, 0.5], [1.0, 0.0])), math.inf)
comprueba('p = 0 con q = 0: sin warnings de numpy', lambda: _estricto(lambda: entropia_cruzada([1.0, 0.0], [1.0, 0.0])), 0.0)
comprueba('devuelve float', lambda: type(entropia_cruzada([0.5, 0.5], [0.5, 0.5])).__name__, 'float')
lanza('longitudes distintas', lambda: entropia_cruzada([0.5, 0.5], [1.0]), ValueError)
lanza('probabilidad negativa', lambda: entropia_cruzada([1.5, -0.5], [0.5, 0.5]), ValueError)

_p9 = [0.9, 0.1]
prueba('kl', {
    'p y q uniformes: 0': (([0.5, 0.5], [0.5, 0.5]), 0.0),
    'ejemplo de la sección 5': ((_p3, _u3), math.log(3) - 1.5 * math.log(2)),
    'KL(p‖q) con p = (0.9, 0.1), q = (0.5, 0.5)': ((_p9, [0.5, 0.5]), 0.36806420717),
    'KL(q‖p): NO es simétrica': (([0.5, 0.5], _p9), 0.5108256237659907),
    'p = 0 con q = 0': (([1.0, 0.0], [1.0, 0.0]), 0.0),
    'p = 0 con q > 0: ese término vale 0': (([1.0, 0.0], [0.5, 0.5]), math.log(2)),
    'q = 0 donde p > 0: infinito': (([0.5, 0.5], [1.0, 0.0]), math.inf),
}, comparador=_cerca(1e-9))


def _gibbs() -> bool:
    azar = np.random.default_rng(8)
    pares = [(azar.dirichlet(np.ones(5)), azar.dirichlet(np.ones(5))) for _ in range(200)]
    return all(kl(p, q) >= 0.0 and abs(entropia_cruzada(p, q) - entropia(p) - kl(p, q)) < 1e-12 for p, q in pares)


grupo('kl (propiedades y errores)')
comprueba('kl(p, p) es 0.0 EXACTO con una distribución cualquiera', lambda: kl([0.1, 0.2, 0.3, 0.4], [0.1, 0.2, 0.3, 0.4]), 0.0)
comprueba('Gibbs: KL ≥ 0 y H(p, q) = H(p) + KL en 200 pares aleatorios', _gibbs, True)
comprueba('q = 0 donde p > 0: sin warnings de numpy', lambda: _estricto(lambda: kl([0.5, 0.5], [1.0, 0.0])), math.inf)
comprueba('devuelve float', lambda: type(kl([0.5, 0.5], [0.4, 0.6])).__name__, 'float')
lanza('longitudes distintas', lambda: kl([0.5, 0.5], [1.0]), ValueError)
lanza('probabilidad negativa', lambda: kl([0.5, 0.5], [1.5, -0.5]), ValueError)

prueba('sigmoide', {
    'σ(0) = 1/2': ((0,), 0.5),
    'σ(2)': ((2.0,), 0.8807970779778823),
    'σ(−2) = 1 − σ(2)': ((-2.0,), 0.11920292202211755),
    'σ(1000) = 1': ((1000.0,), 1.0),
    'σ(−1000) = 0': ((-1000.0,), 0.0),
    'σ(−30) sigue siendo positiva (e⁻³⁰ ≈ 9.4e-14)': ((-30.0,), 9.357622968840175e-14),
    'array': ((np.array([-1000.0, -1.0, 0.0, 1.0, 1000.0]),), np.array([0.0, 0.2689414213699951, 0.5, 0.7310585786300049, 1.0])),
    'matriz 2×2: conserva la forma': ((np.array([[0.0, 1e4], [-1e4, 0.0]]),), np.array([[0.5, 1.0], [0.0, 0.5]])),
}, comparador=_cerca(1e-15))
grupo('sigmoide (estabilidad y tipos)')
comprueba('σ(−z) = 1 − σ(z) en un array de −40 a 40', lambda: bool(np.allclose(sigmoide(-np.linspace(-40, 40, 81)), 1 - sigmoide(np.linspace(-40, 40, 81)), atol=1e-15)), True)
comprueba('±1e5 y ±1e308 sin overflow ni warnings', lambda: _estricto(lambda: sigmoide(np.array([-1e5, 1e5, -1e308, 1e308])).tolist()), [0.0, 1.0, 0.0, 1.0])
comprueba('un escalar devuelve float', lambda: type(sigmoide(1.0)).__name__, 'float')
comprueba('un array devuelve ndarray', lambda: type(sigmoide(np.zeros(3))).__name__, 'ndarray')
comprueba('no modifica el array de entrada', lambda: (lambda z: (sigmoide(z), z.tolist())[1])(np.array([-1.0, 2.0])), [-1.0, 2.0])


def _referencia_logistica(X, y, tasa, pasos):
    """Versión lenta y literal: un dato cada vez, con math.exp (los datos de estas pruebas no saturan la sigmoide)."""
    n, d = len(X), len(X[0])
    w, b = [0.0] * d, 0.0
    for _ in range(pasos):
        gw, gb = [0.0] * d, 0.0
        for xi, yi in zip(X, y):
            p = 1 / (1 + math.exp(-(sum(wj * xj for wj, xj in zip(w, xi)) + b)))
            gw = [g + (p - yi) * xj / n for g, xj in zip(gw, xi)]
            gb += (p - yi) / n
        w, b = [wj - tasa * g for wj, g in zip(w, gw)], b - tasa * gb
    return w, b


def _error_gradiente() -> float:
    w, b = regresion_logistica(X, y, 0.5, 6000)
    g_w, g_b = gradiente_logistico(w, b, X, y)
    return float(np.max(np.abs(np.append(g_w, g_b))))


prueba('regresion_logistica', {
    'un paso desde 0: p = 1/2 en todos': (([[1.0], [2.0], [3.0], [4.0]], [0, 0, 1, 1], 1.0, 1), (np.array([0.5]), 0.0)),
    'pasos = 0: (ceros, 0.0)': ((X[:5], y[:5], 0.5, 0), (np.zeros(2), 0.0)),
    'dos pasos a mano (d = 1)': (([[0.0], [2.0]], [0, 1], 1.0, 2), (np.array([0.7689414213699951]), -0.11552928931500245)),
    'con sesgo: un paso con 3 datos de la misma clase': (([[1.0], [1.0], [1.0]], [1, 1, 1], 1.0, 1), (np.array([0.5]), 0.5)),
}, comparador=_cerca(1e-5))
grupo('regresion_logistica (frente a una referencia y propiedades)')
comprueba('coincide con la versión lenta (40 datos, 30 pasos)', lambda: _cerca(1e-9)(regresion_logistica(X[::5], y[::5], 0.3, 30), _referencia_logistica(X[::5].tolist(), y[::5].tolist(), 0.3, 30)), True)
comprueba('separa las nubes: precisión >= 0.85 con 500 pasos', lambda: float(np.mean((X @ regresion_logistica(X, y, 0.5, 500)[0] + regresion_logistica(X, y, 0.5, 500)[1] > 0) == y)) >= 0.85, True)
comprueba('la pérdida baja respecto a w = 0', lambda: perdida_logistica(*regresion_logistica(X, y, 0.5, 200), X, y) < perdida_logistica(np.zeros(2), 0.0, X, y), True)
comprueba('en el óptimo el gradiente es ≈ 0 (< 1e-3 tras 6000 pasos)', lambda: _error_gradiente() < 1e-3, True)
comprueba('X en escala enorme (×1000): sin overflow ni warnings', lambda: _estricto(lambda: bool(np.all(np.isfinite(regresion_logistica(X * 1000, y, 0.1, 50)[0])))), True)
comprueba('devuelve (ndarray de forma (2,), float)', lambda: (lambda r: (type(r).__name__, r[0].shape, type(r[1]).__name__))(regresion_logistica(X, y, 0.5, 3)), ('tuple', (2,), 'float'))
comprueba('no modifica X ni y', lambda: (lambda X2, y2: (regresion_logistica(X2, y2, 0.5, 5), np.array_equal(X2, X) and np.array_equal(y2, y))[1])(X.copy(), y.copy()), True)
lanza('X no es 2D', lambda: regresion_logistica([1.0, 2.0], [0, 1], 0.5, 1), ValueError)
lanza('y con otra longitud que X', lambda: regresion_logistica([[1.0], [2.0]], [0], 0.5, 1), ValueError)
lanza('etiquetas fuera de {0, 1}', lambda: regresion_logistica([[1.0], [2.0]], [0, 2], 0.5, 1), ValueError)
lanza('pasos negativo', lambda: regresion_logistica([[1.0], [2.0]], [0, 1], 0.5, -1), ValueError)

# ── Medir (pulsa «Medir» o Ctrl+Alt+Enter) ──────────────────────────────────
# Solo se mide el entrenamiento, en función de `pasos` (cada paso cuesta lo mismo: O(n·d) con n = 200 fijo y d = 2).
# prob_cumpleanos y sigmoide son una sola llamada vectorizada demasiado rápida para ver una curva por encima del ruido, y
# bayes, media_varianza, mle_gaussiana, entropia_cruzada y kl cuestan microsegundos: no hay nada que medir.
medir('regresion_logistica', lambda n: (X, y, 0.1, n), tamanos=[2 ** e for e in range(6, 13)])      # O(pasos)
