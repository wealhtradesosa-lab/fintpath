# 🤝 Cliente managed by advisor — Diseño Opción A

**Estado:** Diseño cerrado · **SQL:** `01c-patches.sql` · **Decisión:** Abril 2026.

Este documento explica por qué y cómo el plan corporativo del asesor ahora controla cuántos miembros adicionales puede tener cada cliente que el asesor gestiona.

---

## 🎯 El problema que resolvemos

Hasta antes de Opción A, FINPATHIA tenía **dos ejes ortogonales** que nunca se cruzaban:

```
Eje ASESOR ─────  advisor.advisor_plan ∈ {starter, professional, boutique}
                   advisor.max_clients ∈ {5, 15, 40}     ← CLIENTES gestionados

Eje USUARIO ────  account.plan ∈ {basic, pro, pro_familiar}
                   account.max_members ∈ {1, 1, 5}        ← MIEMBROS por cuenta
```

**Consecuencia indeseada:** un asesor que pagaba Boutique ($399/mes, 40 clientes) tenía clientes que no podían compartir el dashboard con su pareja, salvo que **además** pagaran su propio Pro Familiar. Doble pago, peor experiencia, y un argumento de venta plano para los planes corporativos (la diferencia entre tiers se reducía a "cuántos clientes podés gestionar").

## ✅ La decisión: Opción A

**El plan corporativo del asesor define cuántos miembros adicionales puede tener cada cliente.**

| Plan asesor | max_clients | max_members por cliente | Pitch comercial |
|---|---|---|---|
| Starter | 5 | 1 | Gestiona hasta 5 clientes individuales |
| Professional | 15 | 3 | Tus clientes pueden compartir el dashboard con su pareja/contador |
| Boutique | 40 | 5 | Plan familiar completo para cada cliente |

> **Nota:** `max_clients` por tier (5/15/40) sale del schema existente `20260421_advisor_mode.sql` línea 215-217. NO se modifica con esta migración.

## 🧩 Cómo se implementa técnicamente

### Schema delta (todo en `01c-patches.sql`)

```sql
-- 'managed' es un valor nuevo válido de accounts.plan
plan IN ('basic', 'pro', 'pro_familiar', 'managed')

-- 5 columnas nuevas en accounts
managed_by_advisor_id      UUID  → FK a advisors
managed_tier               TEXT  → 'starter'|'professional'|'boutique'
managed_at                 TIMESTAMPTZ
subscription_status        TEXT  → 'active'|'grace'|'past_due'|'canceled'
grace_until                TIMESTAMPTZ

-- Constraint de coherencia
accounts_managed_coherent: si plan='managed' entonces advisor_id Y tier NOT NULL
```

### Triggers (4 nuevos)

| Trigger | Cuándo dispara | Qué hace |
|---|---|---|
| `advisor_clients_promote_to_managed` | INSERT/UPDATE de `advisor_clients` con `status='active'` | Si la cuenta del cliente era `basic`, la promueve a `managed` con tier del asesor. Cuentas `pro`/`pro_familiar` NO se tocan. |
| `advisors_sync_managed_accounts` | UPDATE de `advisors.advisor_plan` | Propaga el nuevo `max_members` a todas las cuentas managed por ese asesor. NO desactiva miembros existentes si el límite baja. |
| `advisor_clients_start_grace` | UPDATE/DELETE en `advisor_clients` que termina la relación | Inicia grace 30 días en la cuenta managed (no la baja inmediatamente). |
| `accounts_create_owner_membership` (PATCH 4 del 01b) | INSERT en `accounts` | Sin cambios: sigue creando el row de admin del owner_user_id. |

### Función auxiliar `expire_managed_grace_period()`

Función pública que baja a `basic` todas las cuentas managed cuyo grace expiró. Diseñada para ejecución periódica:

- **Producción ideal:** cron diario via edge function (Fase 4+).
- **Mientras tanto:** llamada lazy desde el cliente al hacer login. Si el admin entra y su cuenta tiene `subscription_status='grace'` y `grace_until < NOW()`, el cliente llama `supabase.rpc('expire_managed_grace_period')` y la cuenta se actualiza.

### Defensa en profundidad: column-level REVOKE (PATCH 13)

```sql
REVOKE UPDATE ON accounts FROM authenticated;
GRANT UPDATE (display_name, updated_at) ON accounts TO authenticated;
```

**Razón:** aunque los triggers y RLS bloquean, el cliente con rol authenticated podría intentar `UPDATE accounts SET max_members = 100`. Sin esta restricción, RLS pasaría (es admin) y solo los triggers nos protegerían. Con el REVOKE column-level, ni siquiera el query llega a ejecutarse: Postgres devuelve `permission denied for column max_members`. Las modificaciones legítimas pasan por los triggers `SECURITY DEFINER` que corren como rol superuser.

---

## 🔄 Flujos de eventos (recorridos completos)

### Flujo 1 — Asesor Professional invita cliente nuevo

```
1. Asesor (advisor_plan='professional') crea advisor_invitations con email invitee
2. Email enviado al invitee con link /aceptar-asesor/:token
3. Invitee se registra (auth.users INSERT)
   → trigger handle_new_user (PATCH 5 del 01b) crea:
       - account (plan='basic', max_members=1)
       - account_members (admin)
       - user_data (account_id apuntando a la nueva cuenta)
4. Edge function advisor-accept-invite crea advisor_clients (advisor_id, client_id, status='active')
   → trigger advisor_clients_promote_to_managed (PATCH 9) detecta:
       - Cuenta del cliente es 'basic' → promover
       - advisor_plan='professional' → max_members=3
       - UPDATE accounts SET plan='managed', managed_*='professional', max_members=3
5. Cliente loguea por primera vez
   → useAccount() ve role='admin', plan='managed', max_members=3
   → puede invitar hasta 2 miembros adicionales (admin + 2 readers = 3)
```

### Flujo 2 — Asesor cambia de Professional a Starter (downgrade)

```
1. Webhook Stripe → UPDATE advisors SET advisor_plan='starter'
2. Trigger advisors_sync_managed_accounts (PATCH 10) dispara:
   - max_members del nuevo tier 'starter' = 1
   - UPDATE accounts SET managed_tier='starter', max_members=1
     WHERE managed_by_advisor_id = NEW.id AND plan='managed'
3. Clientes existentes con N readers (N>1) NO se desactivan automáticamente.
   - Sus readers siguen activos.
   - Si el cliente intenta invitar a otro miembro: cliente UI bloquea con
     "tu plan permite 1 pero ya tienes N. Remové miembros para invitar."
```

> **Decisión de diseño:** elegimos NO desactivar readers al downgrade porque (a) puede ser temporal (asesor por error), (b) preserva datos, (c) deja al cliente decidir conscientemente qué readers quitar. La consecuencia es que durante un período un cliente puede tener más readers que su `max_members` "oficial" — el mismo trigger lo expone via `max_members` pero los miembros existentes siguen en `account_members.status='active'`.

### Flujo 3 — Asesor pierde cliente (cliente se va, advisor borra cliente, etc.)

```
1. UPDATE advisor_clients SET status='removed' (o DELETE)
2. Trigger advisor_clients_start_grace (PATCH 11) dispara:
   - UPDATE accounts SET subscription_status='grace', grace_until=NOW()+30days
     WHERE id = (cuenta del cliente) AND plan='managed'
3. Durante los 30 días:
   - El cliente sigue viendo su cuenta normalmente con max_members del tier.
   - Sus readers siguen activos.
   - El cliente recibe email/notificación: "perdiste tu asesor, tienes 30 días
     para suscribirte a Pro Familiar antes de bajar a Basic".
4. Después de 30 días:
   - Cron/edge function llama expire_managed_grace_period()
   - O el próximo login del cliente la dispara lazy
   - Cuenta baja a plan='basic', max_members=1, managed_*=NULL
   - Readers extras siguen en account_members pero el cliente no puede invitar
     a más. La UI muestra "tienes N readers pero plan basic permite 1.
     Suscribite a Pro Familiar para mantenerlos."
```

### Flujo 4 — Cliente con Pro Familiar propio acepta invitación de asesor

```
1. Cliente paga Pro Familiar (account.plan='pro_familiar', max_members=5)
2. Asesor lo invita y el cliente acepta
3. Trigger advisor_clients_promote_to_managed (PATCH 9) verifica:
   - Cuenta del cliente NO es 'basic' (es 'pro_familiar')
   - NO hace nada → IF v_current_plan = 'basic' THEN ... END IF
4. Cliente conserva su Pro Familiar pagado, gana acceso a su asesor en paralelo.
   - Su max_members sigue en 5 (su plan), no se sobrescribe a tier del asesor.
   - Si el asesor pierde al cliente, NO entra en grace (la cuenta no era 'managed').
```

---

## 🛡️ Casos de seguridad cubiertos

| Intento del cliente | Resultado |
|---|---|
| `UPDATE accounts SET max_members = 100` | `ERROR: permission denied for column max_members` |
| `UPDATE accounts SET plan = 'pro_familiar'` | `ERROR: permission denied for column plan` |
| `UPDATE accounts SET managed_tier = 'boutique'` | `ERROR: permission denied for column managed_tier` |
| `INSERT INTO account_members ...` (cuando ya tiene max_members miembros) | RLS pasa (es admin). El **cliente debe validar a nivel UI** que no excede `max_members` antes de hacer el INSERT. Si quiere bypassear vía API directa, sí podría — agregar trigger `BEFORE INSERT account_members` en Fase 3 que valide. |
| Modificar `accounts.display_name` | ✅ permitido (es el único campo abierto a UPDATE para clientes) |

> **TODO Fase 3:** agregar trigger `enforce_max_members_on_insert` en `account_members` para que la validación sea a nivel BD y no solo UI. No es crítico ahora porque el flujo de invitación va por edge function que ya valida.

---

## 📊 Implicaciones para Fase 2 (cliente)

`useAccount.js` no cambia — sigue devolviendo `accountId, role, isLegacy`. Pero la UI sí gana detalle nuevo:

```js
// Hoy useAccount() devuelve:
{ accountId, role, isLegacy, loading, error, refresh }

// Después de Fase 2 + Opción A debería extender:
{
  accountId, role, isLegacy, loading, error, refresh,
  plan,                  // 'basic'|'pro'|'pro_familiar'|'managed'
  maxMembers,            // del accounts.max_members
  managedByAdvisor,      // boolean: plan === 'managed'
  subscriptionStatus,    // 'active'|'grace'|'past_due'|'canceled'
  graceUntil,            // Date or null
  displayName,           // accounts.display_name
}
```

Esto permite componentes nuevos:

- **Banner de grace en MiCuenta:** "Tu cuenta queda en modo asesor por 25 días más. Suscribite a Pro Familiar para mantener tus miembros."
- **Botón "Invitar miembro" deshabilitado** cuando ya hay `max_members` activos.
- **RoleBanner** ya soporta `accountName` — pasarle `displayName`.

Estos cambios son aditivos al `useAccount.js` actual y se hacen en Fase 2 implementación junto con la lectura por `account_id`.

## 📊 Implicaciones para Fase 6 (Stripe)

Pricing del cliente:

| Plan cliente | Price ID | Precio | max_members | Cuándo aplica |
|---|---|---|---|---|
| Basic | gratis | $0 | 1 | Default. Sin asesor, sin Pro. |
| Pro | `price_PRO_*` | TBD | 1 | Pro individual, sin multi-usuario familiar |
| Pro Familiar | `price_FAMILIAR_*` | TBD | 5 | Multi-usuario familiar, paga el cliente |
| **Managed** | **no se paga directo** | **$0** | **1/3/5** | **Asesor lo paga implícito en su plan corporativo** |

Webhook flows:

- **Cliente compra Pro Familiar mientras está managed:** la cuenta pasa de `managed` a `pro_familiar` (su plan pagado tiene prioridad). `managed_by_advisor_id` se mantiene **null**: el cliente sigue siendo cliente del asesor (vía `advisor_clients`), pero el plan ya no se hereda del asesor.
- **Cliente cancela Pro/Familiar mientras tiene asesor:** la cuenta vuelve a `managed` automáticamente vía trigger? **No se hace automático.** Tiene que ejecutarse explícitamente vía edge function porque el trigger del 01c solo se dispara desde el lado de `advisor_clients`. Decisión: la edge function de cancelación de Stripe revisa si el cliente tiene `advisor_clients` activo y, en ese caso, llama una función que vuelve a aplicar tier del asesor. Esta función se diseña en Fase 6.

---

## 🚧 Decisiones pendientes (para Fase 4-6)

| Decisión | Cuándo se cierra | Notas |
|---|---|---|
| Pricing exacto de Pro vs Pro Familiar | Fase 6 | Prerequisito antes de Ads. |
| Texto del email "perdiste tu asesor, tenés 30 días" | Fase 4 | Template + CTA a checkout Pro Familiar. |
| Trigger de validación `max_members` en `account_members` INSERT | Fase 3 | No crítico ahora. |
| Política para Founding (no está en CHECK del advisor_plan actual) | Fase 6 | Mapear a tier funcional (probablemente 'professional'). |
| Cron diario para `expire_managed_grace_period` | Fase 4 | Por ahora lazy en login del admin. |

---

## ✅ Checklist final del diseño

- [x] Schema delta documentado y SQL ejecutable (`01c-patches.sql`)
- [x] 4 flujos completos cubiertos (invitar, downgrade, perder cliente, cliente con plan propio)
- [x] Triggers cubren transiciones bidireccionales (status active/inactive)
- [x] Grace period definido (30 días)
- [x] Defensa en profundidad: trigger + RLS + column-level REVOKE
- [x] Implicaciones para Fase 2 (cliente) documentadas
- [x] Implicaciones para Fase 6 (Stripe) documentadas
- [x] Casos edge identificados (cliente con pro_familiar propio, downgrade del asesor con readers existentes)
- [x] Idempotencia preservada (todos los `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP IF EXISTS`)

**Riesgo técnico:** BAJO. Schema aditivo al 01b ya auditado, sin tocar policies existentes.
**Impacto comercial:** ALTO. Convierte Professional/Boutique en upgrade tangible vs. Starter.
