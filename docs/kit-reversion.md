# 🛡️ Kit de Reversión FINPATHIA
**Última actualización:** 18-jul-2026 (post-Fase 1 flujo anual)

Este documento explica cómo revertir cambios si algo falla, con instrucciones paso a paso.

---

## 📍 Estado actual del proyecto

Los tags de checkpoint son puntos seguros a los que podés volver:

| Tag | Commit | Descripción | Uso |
|---|---|---|---|
| `v-stable-pre-flujo-anual` | `f20b721` | ✅ **Estado 100% probado** — Modelo family office + NumberInput + fixes PDF | Punto seguro clásico |
| `v-fase1-flujo-anual-motor` | `bdb4a3b` | ✅ Motor de frecuencia listo, UI sin cambios | Retrocompat total |

---

## 🚨 Escenario 1: "No me gusta el cambio, quiero volver a como estaba"

**Impacto:** ninguno — no perdés data de usuarios.

### Opción A — Revertir el commit específico que no te gusta
Ideal cuando **solo un cambio específico** te molesta:

```bash
# 1. Ver el historial reciente
git log --oneline -10

# 2. Identificar el commit que no te gusta (ej: bdb4a3b)
# 3. Revertir SOLO ese commit (crea un commit inverso)
git revert bdb4a3b

# 4. Push
git push
```
Netlify redeploya automáticamente en 60 segundos.

### Opción B — Volver a un estado estable anterior
Ideal cuando **querés volver a un punto seguro** completo:

```bash
# 1. Volver al último estado estable
git reset --hard v-stable-pre-flujo-anual

# 2. Force push (⚠️ solo hacer si vas a "borrar" commits posteriores)
git push --force
```

⚠️ **Force push borra historial**. Si preferís preservar todo el historial (recomendado):
```bash
# En vez de reset --hard, hacer revert de todos los commits posteriores
git revert v-stable-pre-flujo-anual..HEAD
git push
```

---

## 🚨 Escenario 2: "Un bug afecta a mis usuarios, necesito rollback YA"

**Tiempo total:** 3-5 minutos.

### Pasos:
```bash
cd /home/claude/fintpath
git reset --hard v-stable-pre-flujo-anual
git push --force https://<tu-token>@github.com/wealhtradesosa-lab/fintpath.git main
```

Netlify redeploya en 60 segundos con el bundle viejo. Tus usuarios ven el estado seguro sin siquiera notar el cambio.

---

## 🚨 Escenario 3: "Un usuario perdió data"

Los cambios de código **NUNCA borran data**. Pero si por error se corrompió algo:

### Backup automático de Supabase
Supabase hace backup diario automático. Podés recuperar el estado de cualquier día en:
```
https://supabase.com/dashboard/project/pdwrgpskzvrjkqozfbvl/database/backups
```

### Backup manual antes de cambios grandes (RECOMENDADO)
Antes de cualquier cambio que agregue campos a `user_data`, hacer este backup:

1. Ir a: https://supabase.com/dashboard/project/pdwrgpskzvrjkqozfbvl/sql/new
2. Ejecutar:
```sql
-- Exporta toda la data de user_data en formato JSON
SELECT jsonb_pretty(jsonb_agg(row_to_json(user_data)))
FROM public.user_data;
```
3. Copiar el resultado y guardarlo en un archivo local (`backup-YYYY-MM-DD.json`).

Para restaurar:
```sql
-- Sobrescribe todo user_data con el backup
DELETE FROM public.user_data;
INSERT INTO public.user_data (id, data, updated_at)
SELECT
  (elem->>'id')::uuid,
  (elem->>'data')::jsonb,
  (elem->>'updated_at')::timestamptz
FROM jsonb_array_elements(:backup_json::jsonb) AS elem;
```

---

## 📊 ¿Cómo saber si algo se rompió después de un deploy?

### Verificación automática (audit.py)
Antes de cualquier push, correr:
```bash
python3 audit.py
```
Debe decir `🟢 19 OK, 0 errores`.

### Verificación manual visual (2 min)
Después de deploy, verificar en producción:
1. **Login funciona** → https://finpathia.com/login
2. **Dashboard carga sin error** → los KPIs muestran números (no 0 ni NaN)
3. **Simulador funciona** → los sliders reaccionan
4. **Asesor IA responde** → probar una pregunta corta
5. **PDF genera** → descarga con datos correctos

### Rollback automatico via UptimeRobot / Sentry (futuro)
Podríamos configurar alertas que hagan rollback automático si detectan errores >5% de usuarios. Para agregar cuando tengamos más pioneros activos.

---

## 🗃️ Historia de cambios recientes (para contexto)

```bash
git log --oneline v-stable-pre-flujo-anual..HEAD
```

- `bdb4a3b` — FASE 1 flujo anual motor con frecuencia y estado por año
- `f20b721` — FEATURE NumberInput extendido a los 18 archivos restantes ← **STABLE**
- `d7d44d9` — FEATURE NumberInput con separadores de miles formato Colombia
- `8a2ff73` — FIX critico Asesor IA error modelo claude-sonnet-4-20250514 deprecated
- `3ee3df9` — FASE 4 exports PDF y Excel con nuevo modelo family office
- `67602f1` — FASE 3 UI Dashboard Resumen consistente con Simulador
- `d98ea94` — FASE 2 UI Simulador rediseño family office cards
- `787c3b0` — FASE 1 modelo family office refactor motor cálculo

---

## ✅ Checklist antes de cada sesión grande de cambios

1. [ ] Correr `python3 audit.py` — todo verde
2. [ ] Correr `npm run build` — sin errores
3. [ ] Crear tag de checkpoint: `git tag -a v-checkpoint-YYYY-MM-DD -m "descripción" && git push --tags`
4. [ ] Hacer backup de Supabase si vamos a agregar campos a `user_data`
5. [ ] Trabajar en fases con commits incrementales (nunca 1 commit gigante)
6. [ ] Después de deploy, verificación manual visual
