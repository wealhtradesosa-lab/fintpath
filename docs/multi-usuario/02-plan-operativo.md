# 📋 Plan operativo — Multi-usuario Pro Familiar (aplicación de Fase 1)

## Estado actual
- Schema SQL listo en `01-migration-schema.sql`
- **Patches críticos** en `01b-patches.sql` (5 patches: cierran gaps de auditoría)
- Backward compatible: usuarios actuales siguen funcionando
- RLS configurado con 8 policies + 2 triggers de protección originales + patches del 01b
- **No aplicado a Supabase productivo todavía**

> ⚠️ **Importante:** Aplicar SIEMPRE `01-migration-schema.sql` seguido de `01b-patches.sql`. El 01 solo no es seguro: deja activas las policies legacy de `user_data` que permiten bypass del aislamiento multi-cuenta. Ver `03-auditoria-fase1.md` Finding 1 para detalle.

---

## 🚀 Cómo aplicar la migration (paso a paso)

### Paso 1 — Backup PRIMERO (no opcional)
1. Ir a Supabase Dashboard → Database → Backups
2. Click "Create backup now" → esperar confirmación
3. Anotar timestamp del backup para rollback de emergencia

### Paso 2 — Verificar el trigger handle_new_user actual
PATCH 5 reescribe `handle_new_user`. Antes de aplicar, copiar el bloque actual desde Supabase Dashboard → Database → Functions → `handle_new_user` para confirmar que el `jsonb_build_object` en el patch sigue siendo correcto. Si en producción el trigger se modificó (e.g., agregando campos de inicialización), actualizar el PATCH 5 en una copia local antes de ejecutar.

### Paso 3 — Ejecutar `01-migration-schema.sql`
1. Supabase Dashboard → SQL Editor → New query
2. Copiar contenido completo de `01-migration-schema.sql`
3. Click "Run" (esquina superior derecha)
4. **Si falla a mitad**: leer el error, abortar transacción si necesario, NO continuar con 01b

### Paso 4 — Validar con queries de verificación del 01
Ejecutar las 4 queries del bloque "VERIFICACIÓN POST-MIGRATION" al final del SQL.

Resultados esperados:
- `COUNT(accounts)` = cantidad de usuarios con user_data
- `COUNT(account_members WHERE status='active')` = mismo número que accounts
- `COUNT(user_data WHERE account_id IS NULL)` = **0** (todos linkeados)
- Tu usuario aparece como admin de tu cuenta personal

> Si alguna verificación falla, **NO continuar al Paso 5**. Investigar primero.

### Paso 5 — Ejecutar `01b-patches.sql`
1. Supabase Dashboard → SQL Editor → New query (nuevo, no reusar)
2. Copiar contenido completo de `01b-patches.sql`
3. Click "Run"

El 01b está envuelto en `BEGIN/COMMIT` explícito. Si algo falla, no queda en estado parcial.

### Paso 6 — Validar con queries de verificación del 01b
Ejecutar las 3 queries del bloque "VERIFICACIÓN POST-PATCH" al final.

Resultados esperados:
- 0 policies legacy en `user_data`
- Función `is_account_member` existe
- Smoke test del helper devuelve TRUE

### Paso 7 — Smoke test cliente
1. Recargar finpathia.com con `Cmd+Shift+R`
2. Login normal funciona
3. Cargar/editar un ingreso → verificar que se guarda
4. Cargar/editar un gasto → verificar que se guarda
5. Verificar que Plan Tributario muestra valores correctos
6. Si el usuario es asesor, verificar workspace + click en cliente
7. Si todo OK: ✅ migration aplicada correctamente

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

-- Restaurar policies legacy (que el 01b había eliminado)
CREATE POLICY "Users can view own data" ON public.user_data FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON public.user_data FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own data" ON public.user_data FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own data" ON public.user_data FOR DELETE USING (auth.uid() = id);
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
```
Esto vuelve al comportamiento legacy en segundos.

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
DROP FUNCTION IF EXISTS public.is_account_member(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_owner_membership() CASCADE;

-- Restaurar trigger handle_new_user original
-- (copiar el bloque que se respaldó en el Paso 2 del runbook)

-- Restaurar policies legacy de user_data (mismo SQL que en Opción A)
```

### Opción C — Restaurar backup (último recurso)
Supabase Dashboard → Database → Backups → seleccionar backup
del Paso 1 → Restore. Pierde todos los cambios desde el backup.

---

## 🧪 Cómo testear que RLS funciona (post-aplicación)

Setup: necesitás dos usuarios autenticados distintos. Podés usar dos browsers, o crear una cuenta de testing en otro email.

### Test 1 — Aislamiento entre cuentas
```sql
-- Como user A (con sesión Supabase activa), creá una cuenta y una entrada en user_data
-- Como user B (otra sesión), intentá leer la cuenta de A:
SELECT * FROM public.accounts WHERE owner_user_id = '<user_a_uuid>';
-- DEBE devolver 0 filas (RLS lo oculta).
```

### Test 2 — Reader no puede modificar
```sql
-- Como reader de una cuenta, intentar update de user_data:
UPDATE public.user_data SET data = '{"hack": true}' WHERE account_id = '<cuenta_a>';
-- DEBE fallar con: "new row violates row-level security policy" o equivalente
-- (la policy admins_can_modify_user_data exige role='admin').
```

### Test 3 — Trigger de protección admin único
```sql
-- Como único admin de tu cuenta, intentá quitarte:
DELETE FROM public.account_members WHERE user_id = auth.uid() AND role = 'admin';
-- DEBE fallar con: "No se puede dejar la cuenta sin admins activos"
```

### Test 4 — Helper is_account_member (introducido por 01b)
```sql
SELECT public.is_account_member(
  (SELECT account_id FROM public.user_data WHERE id = auth.uid())
);
-- DEBE devolver TRUE (sos miembro de tu propia cuenta).

SELECT public.is_account_member('00000000-0000-0000-0000-000000000000');
-- DEBE devolver FALSE.
```

### Test 5 — Bootstrap signup (introducido por 01b PATCH 5)
Crear un usuario nuevo desde la UI de Finpathia (signup). Después:
```sql
SELECT a.id, a.plan, a.display_name, am.role, ud.email
FROM public.accounts a
JOIN public.account_members am ON am.account_id = a.id
JOIN public.user_data ud ON ud.account_id = a.id
WHERE a.owner_user_id = (SELECT id FROM auth.users WHERE email = 'usuario_nuevo@test.com');
-- DEBE devolver 1 fila con plan='basic', role='admin', email del nuevo usuario.
```

---

## 📊 Métricas a monitorear post-migration

Primer día:
- [ ] Tasa de errores 401/403 en logs (no debe subir vs día anterior)
- [ ] Saves de user_data exitosos (debe seguir igual a baseline)
- [ ] Queries lentas (los index nuevos deberían mantener perf < 100ms p95)

Primera semana:
- [ ] Cantidad de cuentas que invitan miembros (proxy de adopción Pro Familiar)
- [ ] Errores en flujo de invitación (cuando se implemente Fase 3)

---

## 🔗 Decisión cerrada: asesor + Pro Familiar son compatibles

Una cuenta Pro Familiar puede tener un asesor asignado. La cuenta es **una sola** desde el punto de vista del asesor — ve la bóveda completa con los datos compartidos por toda la familia. Los miembros readers de la familia **no** aparecen como clientes adicionales en `advisor_clients`.

**Implicación operativa para Fase 4 (edge function de aceptar invitación):**
- Un usuario que es **reader** de alguna cuenta NO puede aceptar invitación de asesor (la edge function `advisor-accept-invite` debe validar que el invitee sea admin o no tenga membresía activa todavía).
- Un usuario admin de su cuenta personal o familiar puede aceptar invitación de asesor sin problema.

Validación SQL recomendada en la edge function:
```sql
SELECT 1 FROM public.account_members
WHERE user_id = $1 AND status = 'active' AND role = 'reader'
LIMIT 1;
-- Si devuelve fila → rechazar invitación de asesor con mensaje claro.
```

---

## 📋 Próximos pasos después de aplicar Fase 1 + 01b

| Fase | Trabajo | Doc |
|---|---|---|
| **Fase 2** | Refactor cliente: bootstrap lee `account_id`, hook `useAccount`, gating de edición por rol | `04-fase2-diseno.md` |
| **Fase 3** | UI "Mi cuenta" + flujo invitación cliente-side | `05-fases-3-6-resumen.md` § Fase 3 |
| **Fase 4** | Edge Function: enviar email de invitación | `05-fases-3-6-resumen.md` § Fase 4 |
| **Fase 5** | Testing E2E de aislamiento multi-cuenta | `05-fases-3-6-resumen.md` § Fase 5 |
| **Fase 6** | Stripe products: básico/pro/familiar con precios | `05-fases-3-6-resumen.md` § Fase 6 |
