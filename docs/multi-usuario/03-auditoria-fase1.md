# 🔍 Auditoría Fase 1 — Schema multi-usuario

**Fecha:** Abril 2026
**Estado:** Pre-implementación (schema diseñado en `01-migration-schema.sql`, NO aplicado a Supabase)
**Output:** Patches consolidados en `01b-patches.sql` listos para aplicar inmediatamente después del 01.

Esta auditoría revisa el SQL de Fase 1 antes de aplicarlo en producción. Se identificaron **5 findings críticos** que requieren patches y **4 findings menores** que se documentan como decisiones operativas, sin necesidad de cambiar SQL.

---

## 🔴 Findings críticos (requieren patch)

### Finding 1 — Policies RLS legacy de user_data no se eliminan
**Severidad:** Alta · **Archivo:** `01-migration-schema.sql` · **Patch:** sí (`01b-patches.sql` PATCH 1)

`schema-simple.sql` (que está aplicado en producción hoy) define cuatro policies sobre `user_data`:

```sql
CREATE POLICY "Users can view own data"   ON user_data FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON user_data FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own data" ON user_data FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own data" ON user_data FOR DELETE USING (auth.uid() = id);
```

`01-migration-schema.sql` agrega nuevas policies multi-cuenta pero **no hace `DROP POLICY` sobre las viejas**. En PostgreSQL, las RLS permissive policies se evalúan con **OR**: basta con que UNA permita la operación para que pase. Resultado:

- Un reader que se vuelve miembro de la cuenta de otro usuario **mantiene la capacidad de UPDATE/DELETE en su `user_data` orphan** (la fila que tenía antes de aceptar la invitación), porque la policy vieja `auth.uid() = id` sigue activa.
- El cliente legacy podría escribir en esa fila orphan creyendo que son "sus datos", confundiendo el modelo (los datos reales viven en el `user_data` del admin de la cuenta).

**Patch:** PATCH 1 hace `DROP POLICY IF EXISTS` para las cuatro policies legacy.

### Finding 2 — `admins_can_insert_user_data` no fija el `id` del row
**Severidad:** Media · **Archivo:** `01-migration-schema.sql` líneas 222-231 · **Patch:** sí (`01b-patches.sql` PATCH 2)

La policy actual:

```sql
WITH CHECK (
  account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid() AND ...)
  OR (account_id IS NULL AND id = auth.uid())
)
```

En el primer brazo del `OR`, **no se valida `id = auth.uid()`**. Un admin de la cuenta A podría hacer `INSERT INTO user_data (id, account_id, ...) VALUES (otro_uid, A, ...)`, creando una fila fantasma con id de otro usuario dentro de su cuenta. Riesgo bajo en la práctica (requiere conocer un uid ajeno), pero es defensa-en-profundidad innecesaria.

**Patch:** PATCH 2 reescribe la policy poniendo `id = auth.uid()` como requisito siempre, y deja la condición de cuenta como secundaria.

Aprovechando el patch, también se agrega una policy **DELETE** (no había ninguna en Fase 1, lo cual significa que DELETE de user_data quedaba completamente bloqueado por RLS). El flujo de "borrar mi cuenta" en un futuro Fase 6+ va a necesitarla.

### Finding 3 — Falta función helper para evaluar membresía
**Severidad:** Baja (operability/mantenibilidad) · **Patch:** sí (`01b-patches.sql` PATCH 3)

El subquery `account_id IN (SELECT account_id FROM account_members WHERE user_id = auth.uid() AND status = 'active' [AND role = 'admin'])` aparece **8 veces** en el archivo. Eso:

1. Dificulta auditorías futuras (cualquier cambio requiere editar 8 lugares).
2. No se beneficia de cache de Postgres (cada subquery se planea independiente).
3. Hace que policies de Fase 2-4 (que también van a necesitarlo) dupliquen código.

**Patch:** PATCH 3 crea `public.is_account_member(account_id, role TEXT DEFAULT NULL)` con `SECURITY DEFINER STABLE`. Esto permite que las policies futuras escriban simplemente `USING (public.is_account_member(account_id, 'admin'))`.

> **Nota:** PATCH 3 NO modifica las policies de 01 (las deja con sus subqueries). Solo introduce la función. Las policies de Fase 2-4 sí la usarán. Esto evita tocar 01 más allá de lo estrictamente necesario.

### Finding 8 — Catch-22 en bootstrap de cuenta personal
**Severidad:** Crítica (bloquea Fase 2) · **Patch:** sí (`01b-patches.sql` PATCH 4)

La policy `admins_can_manage_members` exige que el usuario ya sea admin activo de la cuenta para poder hacer INSERT en `account_members`. Pero al crear una **nueva** cuenta, todavía no hay miembros — bootstrap imposible desde cliente.

```
Usuario nuevo → INSERT accounts (owner_user_id=auth.uid()) → ✅ permitido
              → INSERT account_members (admin)            → ❌ RLS: no es admin todavía
```

Las opciones eran (a) Edge Function con SERVICE_ROLE, (b) trigger AFTER INSERT en accounts. La opción (b) es más simple y mantiene el flujo end-to-end en el cliente sin dependencias externas.

**Patch:** PATCH 4 introduce trigger `accounts_create_owner_membership` con SECURITY DEFINER que crea automáticamente el row de admin en account_members al insertar una cuenta. Idempotente vía `ON CONFLICT DO NOTHING`.

### Finding 9 — `handle_new_user` no integra con el modelo multi-cuenta
**Severidad:** Crítica (rompe signups post-migración) · **Patch:** sí (`01b-patches.sql` PATCH 5)

El trigger `handle_new_user` (definido en `schema-simple.sql`) se dispara en `auth.users.AFTER INSERT` y crea automáticamente un row en `user_data`. Después de la migración Fase 1, ese row tiene `account_id = NULL`. Aunque la backward compat lo mantiene leíble, deja al usuario en estado inconsistente:

- No tiene cuenta donde invitar a nadie.
- El cliente (Fase 2) tendría que detectar esto y crear la cuenta post-hoc.
- Riesgo de que el flujo de cliente falle silenciosamente y deje al usuario "limbo".

**Patch:** PATCH 5 reescribe `handle_new_user` para crear atomicamente: (a) la cuenta personal, (b) el row de admin (vía trigger del PATCH 4), (c) `user_data` con `account_id` ya seteado. Todo dentro de la misma transacción del signup.

> **Importante:** PATCH 5 reproduce el `jsonb_build_object` actual de `schema-simple.sql`. Si el trigger en producción se modificó (e.g., por agregar campos de inicialización), copiar el bloque actual desde Supabase Dashboard antes de aplicar.

---

## 🟡 Findings menores (decisiones operativas, no requieren patch)

### Finding 4 — Migración retroactiva sin transacción explícita
El bloque `DO $$ ... $$` en PASO 6 no tiene `BEGIN/COMMIT` envolvente. Si falla a mitad de loop, queda inconsistente.

**Mitigación operativa:** Ejecutar `01-migration-schema.sql` **completo de una vez** desde el SQL Editor de Supabase (no línea por línea). Supabase agrupa el run completo en una transacción implícita.

**Decisión:** No agregar BEGIN/COMMIT al archivo (bloquea ejecución segmentada para debugging). Documentar en `02-plan-operativo.md` la necesidad de ejecutar completo.

### Finding 5 — `accounts.plan` sin CHECK consistente con `max_members`
Una cuenta `basic` con `max_members = 10` sería válida en el schema actual. No hay constraint que enlace ambos campos.

**Decisión:** Mantener flexibilidad hasta que el pricing de Stripe esté definido en Fase 6. El acoplamiento `plan → max_members` se controla a nivel aplicación: el webhook de Stripe es el único path autorizado para modificar ambos campos. Documentar esto en `05-fases-3-6-resumen.md`.

### Finding 6 — Sin rate-limit de creación de `accounts`
La policy `users_can_create_own_account` permite a cualquier usuario autenticado crear N accounts sin límite.

**Decisión:** Riesgo bajo (rows vacíos consumen mínimo). Si Fase 2 detecta abuso, agregar trigger que limite a `(N) accounts por usuario`. Por ahora documentar y monitorear.

### Finding 7 — Validación de email en `account_invitations` queda en Edge Function
El schema permite invitar a cualquier email. La validación de que el `auth.users.email` del invitee coincide con `account_invitations.email` se hace a nivel aplicación.

**Decisión:** Correcto — validar en Edge Function de Fase 4 (`accept-account-invite`). Documentar requisito.

---

## 🟢 Aspectos del diseño que pasan limpio

| Aspecto | Comentario |
|---|---|
| Backward compat con `account_id IS NULL` en SELECT | Necesario para período transitorio entre Fase 1 aplicada y Fase 2 en producción. Eliminar la condición OR backward compat cuando Fase 2 esté en producción y todos los usuarios tengan account_id. |
| Trigger `protect_last_admin` | Cubre UPDATE y DELETE de account_members. No cubre DELETE de accounts (que cascadea a members) — eso es OK, borrar cuenta es flujo intencional del owner. |
| Token de invitación (`encode(gen_random_bytes(32),'base64')`) | 256 bits de entropía, suficiente. |
| Audit log con `JSONB diff` | Permite reversión granular. Se aprovecha en Fase 5 para audit UI. |
| Trigger `update_accounts_updated_at` | Estándar, sin issues. |
| Migración retroactiva idempotente (`LEFT JOIN ... WHERE am.id IS NULL`) | Correcto. Re-ejecutar el archivo no genera duplicados. |
| RLS sobre `account_audit_log` (solo admins SELECT) | Apropiado. Inserts pueden hacerlos cualquier miembro vía aplicación con SECURITY DEFINER si fuera necesario; en Fase 5 se decide. |

---

## 📋 Checklist de aplicación (próxima sesión)

```
[ ] 1. Backup Supabase Dashboard → Database → Backups → Create backup now
[ ] 2. Anotar timestamp del backup
[ ] 3. SQL Editor → ejecutar 01-migration-schema.sql COMPLETO de una vez
[ ] 4. Validar con las 4 queries de "VERIFICACIÓN POST-MIGRATION" del 01
[ ] 5. SQL Editor → ejecutar 01b-patches.sql COMPLETO
[ ] 6. Validar con las 3 queries de "VERIFICACIÓN POST-PATCH" del 01b
[ ] 7. Smoke test cliente: Cmd+Shift+R en finpathia.com
       - Login normal funciona
       - Cargar/editar ingresos funciona
       - Cargar/editar owners funciona
       - Plan Tributario funciona
[ ] 8. Si todo OK: marcar Fase 1 como aplicada en commit y avanzar Fase 2
[ ] 9. Si algo falla: aplicar Opción A de rollback en 02-plan-operativo.md
```

> **Importante:** El `01b-patches.sql` está diseñado para ser idempotente (todos los `DROP POLICY IF EXISTS` y `CREATE OR REPLACE FUNCTION`). Re-ejecutarlo no rompe nada.

---

## 📊 Riesgo residual después de aplicar 01 + 01b

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Cliente legacy escribe user_data orphan después del migración | Baja (Fase 2 va inmediato) | Medio (datos en lugar incorrecto) | Aplicar Fase 2 en ≤1 semana después de 01+01b |
| Usuario nuevo se registra entre 01+01b y Fase 2 | Media | Bajo | Backward compat policies cubren el caso |
| RLS bloquea operación legítima de admin | Baja | Alto (UI rota) | Smoke test exhaustivo en checklist paso 7 |
| Trigger `protect_last_admin` bloquea flujo de UI | Muy baja | Medio | Solo dispara en escenario edge; monitorear logs |

**Total:** riesgo BAJO una vez aplicados ambos archivos. El gap más relevante (Finding 1) queda cerrado por PATCH 1.
