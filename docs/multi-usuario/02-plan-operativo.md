# 📋 Plan operativo — Multi-usuario Pro Familiar (Fase 1: Backend)

## Estado actual
- Schema SQL listo en `01-migration-schema.sql`
- Backward compatible: usuarios actuales siguen funcionando
- RLS configurado con 8 policies + 2 triggers de protección

---

## 🚀 Cómo aplicar la migration (paso a paso)

### Paso 1 — Backup PRIMERO (no opcional)
1. Ir a Supabase Dashboard → Database → Backups
2. Click "Create backup now" → esperar confirmación
3. Anotar timestamp del backup para rollback de emergencia

### Paso 2 — Ejecutar migration en staging (si tenés branch)
```bash
# Si usás branches de Supabase (recomendado para schema changes):
# Crear branch primero, ejecutar migration ahí, validar, mergear
```

### Paso 3 — Ejecutar en producción
1. Supabase Dashboard → SQL Editor → New query
2. Copiar contenido completo de `01-migration-schema.sql`
3. Click "Run" (esquina superior derecha)
4. **Si falla**: leer el error, abortar transacción si necesario, NO continuar

### Paso 4 — Validar con queries de verificación
Ejecutar las 4 queries del bloque "VERIFICACIÓN POST-MIGRATION" al final del SQL.

Resultados esperados:
- `COUNT(accounts)` = cantidad de usuarios con user_data
- `COUNT(account_members WHERE status='active')` = mismo número que accounts
- `COUNT(user_data WHERE account_id IS NULL)` = **0** (todos linkeados)
- Tu usuario aparece como admin de tu cuenta personal

### Paso 5 — Smoke test cliente
1. Recargar finpathia.com con `Cmd+Shift+R`
2. Verificar que la app sigue funcionando exactamente igual
3. Cargar un ingreso → verificar que se guarda
4. Si todo OK: ✅ migration aplicada correctamente

---

## 🔥 Rollback de emergencia

Si algo sale mal y el cliente deja de funcionar:

### Opción A — Rollback rápido (mantiene tablas nuevas pero desactiva RLS)
```sql
ALTER TABLE public.user_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_audit_log DISABLE ROW LEVEL SECURITY;
```
Esto vuelve al comportamiento legacy en segundos. Las tablas nuevas
quedan creadas pero sin policies — el cliente legacy puede seguir
leyendo user_data como antes.

### Opción B — Rollback completo (borra todo lo nuevo)
```sql
-- ⚠️ DESTRUCTIVO: borra cuentas y membresías. Usar SOLO si no se llegó
-- a usar productivamente y querés volver al estado pre-migration.
DROP TABLE IF EXISTS public.account_audit_log CASCADE;
DROP TABLE IF EXISTS public.account_invitations CASCADE;
DROP TABLE IF EXISTS public.account_members CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
ALTER TABLE public.user_data DROP COLUMN IF EXISTS account_id;
DROP FUNCTION IF EXISTS public.protect_last_admin() CASCADE;
DROP FUNCTION IF EXISTS public.update_accounts_updated_at() CASCADE;
```

### Opción C — Restaurar backup (último recurso)
Supabase Dashboard → Database → Backups → seleccionar backup
del Paso 1 → Restore.

---

## 🧪 Cómo testear que RLS funciona

### Test 1 — Aislamiento entre cuentas
```sql
-- Como user A, creá una cuenta y una entrada en user_data
-- Como user B (otra sesión), intentá leer la cuenta de A:
SELECT * FROM public.accounts WHERE owner_user_id = '<user_a_uuid>';
-- DEBE devolver 0 filas.
```

### Test 2 — Reader no puede modificar
```sql
-- Como reader de una cuenta, intentar update de user_data:
UPDATE public.user_data SET data = '{"hack": true}' WHERE account_id = '<cuenta_a>';
-- DEBE fallar con permission denied.
```

### Test 3 — Trigger de protección admin único
```sql
-- Como único admin de tu cuenta, intentá quitarte:
DELETE FROM public.account_members WHERE user_id = auth.uid() AND role = 'admin';
-- DEBE fallar con: "No se puede dejar la cuenta sin admins activos"
```

---

## 📊 Métricas a monitorear post-migration

Primer día:
- [ ] Tasa de errores 401/403 en logs (no debe subir)
- [ ] Saves de user_data exitosos (debe seguir igual)
- [ ] Queries lentas (los index nuevos deberían mantener perf)

Primera semana:
- [ ] Cantidad de cuentas que invitan miembros (proxy de adopción Pro Familiar)
- [ ] Errores en flujo de invitación (cuando se implemente)

---

## 📋 Próximos pasos después de aplicar Fase 1

| Fase | Trabajo |
|---|---|
| **Fase 2** | Refactor cliente: bootstrap lee account_id en lugar de user_id directo. Hook `useAccount()` con rol activo. |
| **Fase 3** | UI "Mi cuenta" + flujo invitación |
| **Fase 4** | Edge Function: enviar email de invitación |
| **Fase 5** | Testing E2E de seguridad multi-cuenta |
| **Fase 6** | Stripe products: básico/pro/familiar con precios |

---

## ⚠️ Decisiones que quedan abiertas (no bloquean Fase 1)

1. **Pricing exacto** — El SQL solo define el campo `plan`, los precios viven en Stripe.
2. **Email de invitación** — Diseño del template (mañana o cuando arranquemos Fase 4).
3. **Owners "privados"** — Por ahora todos los miembros ven todos los owners de la cuenta. Si más adelante necesitás owners privados (que solo el admin original vea), se agrega columna `private_owners_ids` en `accounts` o flag en cada owner.

Estas decisiones se pueden tomar progresivamente sin romper la Fase 1.
