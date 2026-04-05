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
skip = {'onGetStarted','onUpdate','onImport','onClose','openAdd','openEdit','handleEdit','handleSave','startEdit','toggleSel','openForm','onClick'}
missing = [h for h in handlers-skip if f'const {h}=' not in c]
if not missing: ok+=1; print(f"  ✅ Handlers OK")
else: fail+=1; print(f"  ❌ Handlers faltantes: {missing}")

if 'sanitize(' in c: ok+=1; print(f"  ✅ sanitize()")
else: fail+=1; print(f"  ❌ sanitize() faltante")

if '_setU' in c: ok+=1; print(f"  ✅ setU wrapper")
else: fail+=1; print(f"  ❌ setU wrapper faltante")

r = subprocess.run(['npx','vite','build'], capture_output=True, text=True)
if r.returncode==0: ok+=1; print(f"  ✅ Build exitoso")
else: fail+=1; print(f"  ❌ Build FALLA")

print(f"\n{'🟢' if fail==0 else '🔴'} {ok} OK, {fail} errores")
sys.exit(0 if fail==0 else 1)
