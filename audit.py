#!/usr/bin/env python3
"""FINPATHIA Code Review — Run before every push"""
import re, subprocess, sys

with open('src/App.jsx', 'r') as f:
    c = f.read()

print("═══ AUDITORÍA FINPATHIA ═══\n")
ok = 0; fail = 0

for name, pat in {'auth':'const auth=','logout':'const logout=','demo':'const demo=','handleImport':'const handleImport=','showToast':'const showToast='}.items():
    if pat in c: ok+=1; print(f"  ✅ {name}()")
    else: fail+=1; print(f"  ❌ {name}() FALTANTE")

for state in ['authUser','authLoading','authError','showAuth','toast']:
    if f'[{state},' in c: ok+=1; print(f"  ✅ useState {state}")
    else: fail+=1; print(f"  ❌ useState {state} FALTANTE")

for pat, desc in [('if(ld)return','Loading'),('if(!u&&!showAuth)','Landing'),('if(!u)return','Auth form')]:
    if pat in c.replace(' ',''): ok+=1; print(f"  ✅ {desc} guard")
    else: fail+=1; print(f"  ❌ {desc} guard FALTANTE")

bad = len([m for m in re.finditer(r'(?<![\?&])u\.p\.', c)])
if bad==0: ok+=1; print(f"  ✅ Null guards OK")
else: fail+=1; print(f"  ❌ {bad} u.p sin guardia")

handlers = set(re.findall(r'onClick=\{(\w+)\}', c))
skip = {'onGetStarted','onUpdate','onImport','onClose','openAdd','openEdit','handleEdit','handleSave','startEdit','toggleSel','openForm','onClick','onForce','onSave','onCancel','onSaveAndBootstrap','onNavigate','onComplete','toggle'}
missing = [h for h in handlers-skip if f'const {h}=' not in c]
if not missing: ok+=1; print(f"  ✅ Handlers OK")
else: fail+=1; print(f"  ❌ Handlers faltantes: {missing}")

if 'sanitize(' in c: ok+=1; print(f"  ✅ sanitize()")
else: fail+=1; print(f"  ❌ sanitize() faltante")

if '_setU' in c: ok+=1; print(f"  ✅ setU wrapper")
else: fail+=1; print(f"  ❌ setU wrapper faltante")

bad_react = len(re.findall(r'React\.(use|create|memo|forward)', c))
if bad_react==0: ok+=1; print(f"  ✅ Sin React.xxx")
else: fail+=1; print(f"  ❌ {bad_react} React.xxx — usar import directo")

# ═══════════════════════════════════════════════════════════════════════════
# DERIVA DE DISEÑO (27-sep-2026)
# ─────────────────────────────────────────────────────────────────────────
# El sistema de diseño ya existía en src/lib/designTokens.js y lo importaban
# 7 de 89 componentes; los otros 52 declaraban su propia paleta. Resultado
# medido: 97 colores distintos, 32 tamaños de fuente y 15 radios, para un
# sistema que define 10 / 6 / 3.
#
# Esta verificación es un TRINQUETE, no un umbral: compara contra el máximo
# histórico y falla solo si el número SUBE. Permite migrar por etapas sin
# bloquear el trabajo, e impide que la deuda vuelva a crecer mientras tanto.
# Al bajar un tope se actualiza aquí, y ya no se puede volver atrás.
# ═══════════════════════════════════════════════════════════════════════════
import glob, os

# 'divergentes' es la medida que se mueve archivo por archivo. Los conteos
# globales (colores/fuentes/radios) solo bajan cuando cae el ÚLTIMO archivo que
# usa un valor, así que durante la migración se quedan quietos aunque se avance.
# Este cuenta los componentes cuya paleta local contradice a los tokens.
TOPES = {'colores': 90, 'fuentes': 18, 'radios': 9, 'divergentes': 0, 'crudos': 62}

# 'crudos' (27-sep-2026): lineas que suman o anualizan .mensual/.m en crudo sin
# pasar por el motor (montoDelMes, montoPromedioMensual, totalAnualItem,
# getMonto). Es la familia de errores mas repetida del dia: once fallas
# corregidas, y al medir quedaban 62 lecturas asi, veinte de ellas en taxCO.js.
# Un item vigente tres meses cuenta como doce; un variable se ignora porque su
# .mensual es residual. Se excluyen las lineas que solo leen para convertir y
# pasar al motor (mensual: ...) y las de flowHelpers, que ES el motor.
CRUDO = re.compile(r'\.(mensual|m)\b\s*(\|\|\s*0|\))')
SUMA  = re.compile(r'reduce\(|\+=|\*\s*12\b')
MOTOR = re.compile(r'montoDelMes|montoPromedioMensual|totalAnualItem|getMonto|promedioMesActivo|mensual:\s*')

DIVERGENTES = re.compile(
    r'bg2: *"#(?:18181b|16161a|141414)"'
    r'|bg3: *"#(?:27272a|222228|1f1f23|1a1a1a)"'
    r'|card: *"#111113"'
    r'|txt2: *"#(?:d4d4d8|b8bcc4|a3a3a3)"'
    r'|txt3: *"#(?:a1a1aa|6b7280|737373)"'
    r'|txt: *"#(?:ffffff|e8eaed)"'
)

fuentes_ui = ['src/App.jsx'] + sorted(glob.glob('src/components/*.jsx'))
blob = ''
divergentes = 0
for ruta in fuentes_ui:
    with open(ruta, 'r') as f:
        texto = f.read()
    blob += texto
    if DIVERGENTES.search(texto):
        divergentes += 1

crudos = 0
for ruta in fuentes_ui + sorted(glob.glob('src/lib/*.js')):
    if ruta.endswith('flowHelpers.js'):
        continue
    with open(ruta, 'r') as f:
        for linea in f:
            if linea.lstrip().startswith(('//', '*', '/*')):
                continue
            if CRUDO.search(linea) and SUMA.search(linea) and not MOTOR.search(linea):
                crudos += 1

medido = {
    'colores': len(set(m.lower() for m in re.findall(r'#[0-9a-fA-F]{6}\b', blob))),
    # 27-sep-2026 — Cuentan las DOS formas. La primera pasada solo miraba
    # fontSize: 12.5 (objeto JS) y se saltaba fontSize="12.5" (atributo SVG).
    # Dos medios puntos sobrevivieron a la etapa 3 y aparecieron recién al
    # revisar el bundle desplegado. Un trinquete con un punto ciego da una
    # falsa sensación de que el problema quedó cerrado.
    'fuentes': len(set(re.findall(r'fontSize(?:: *|=\{?")([0-9.]+)', blob))),
    'radios':  len(set(re.findall(r'borderRadius(?:: *|=\{?")([0-9]+)', blob))),
    'divergentes': divergentes,
    'crudos': crudos,
}

for clave, tope in TOPES.items():
    n = medido[clave]
    if n > tope:
        fail += 1
        print(f"  ❌ Deriva de diseño: {n} {clave} distintos, el tope es {tope}")
    elif n < tope:
        ok += 1
        print(f"  ✅ {clave.capitalize()}: {n} (tope {tope} — bajá el tope en audit.py)")
    else:
        ok += 1
        print(f"  ✅ {clave.capitalize()}: {n} en el tope")

# Los tokens viven en dos archivos por necesidad (ver el comentario en
# index.html). Si se separan, el que manda deja de ser evidente.
with open('index.html', 'r') as f:
    raiz = f.read()
with open('src/lib/designTokens.js', 'r') as f:
    tokens_js = f.read()

PAREJAS = [('--fp-bg', 'bg'), ('--fp-surface', 'surface'), ('--fp-raised', 'raised'),
           ('--fp-text', 'text'), ('--fp-muted', 'muted'), ('--fp-subtle', 'subtle'),
           ('--fp-accent', 'accent'), ('--fp-ok', 'ok'), ('--fp-warn', 'warn'),
           ('--fp-danger', 'danger'), ('--fp-purple', 'purple')]

desalineados = []
for var_css, clave_js in PAREJAS:
    mc = re.search(re.escape(var_css) + r': *(#[0-9a-fA-F]{6})', raiz)
    mj = re.search(r'\b' + re.escape(clave_js) + r': *"(#[0-9a-fA-F]{6})"', tokens_js)
    if not mc or not mj:
        desalineados.append(f"{var_css}/{clave_js} no encontrado")
    elif mc.group(1).lower() != mj.group(1).lower():
        desalineados.append(f"{clave_js}: CSS {mc.group(1)} vs JS {mj.group(1)}")

if not desalineados:
    ok += 1; print("  ✅ Tokens CSS ↔ JS alineados")
else:
    fail += 1; print(f"  ❌ Tokens desalineados: {desalineados}")

r = subprocess.run(['npx','vite','build'], capture_output=True, text=True)
if r.returncode==0: ok+=1; print(f"  ✅ Build exitoso")
else: fail+=1; print(f"  ❌ Build FALLA")

print(f"\n{'🟢' if fail==0 else '🔴'} {ok} OK, {fail} errores")
sys.exit(0 if fail==0 else 1)
