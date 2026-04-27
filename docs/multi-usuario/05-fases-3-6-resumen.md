# 🗺️ Fases 3-6 — Resumen de roadmap

**Estado:** Diseño de alto nivel · **Pre-requisitos:** Fase 1 + 01b aplicados, Fase 2 mergeada y verificada en producción.

Este documento sintetiza las Fases 3-6 del roadmap multi-usuario para que el orden de trabajo y las dependencias queden claras. Cada fase tendrá su propio doc detallado cuando se acerque su implementación.

---

## Fase 3 — UI "Mi cuenta" + flujo de invitación

**Objetivo:** Que un admin pueda invitar a otros miembros (hasta `max_members` según plan) desde la UI, y que los invitados puedan aceptar.

### Componentes nuevos

| Archivo | Función |
|---|---|
| `src/components/MiCuenta.jsx` | Pantalla principal de gestión de cuenta. Lista miembros, plan actual, botones de invitar / cambiar rol / revocar. **Post-01c:** muestra plan vigente con badge ("managed by [advisor_firm]" si aplica), countdown de grace si `subscriptionStatus='grace'`, y deshabilita botón "Invitar" si `account_members.active >= maxMembers`. |
| `src/components/InvitarMiembro.jsx` | Modal con form de invitación: email, rol (admin/reader), mensaje opcional. **Post-01c:** valida que el slot esté disponible antes de crear `account_invitations`. |
| `src/components/AcceptFamilyInvite.jsx` | Pantalla pública (token URL) para aceptar invitación. Análoga a `AcceptInvite.jsx` pero para `account_invitations` (no `advisor_invitations`). |
| `src/components/GraceBanner.jsx` | (Si no se hizo en Fase 2) banner amarillo con countdown + CTA a Stripe checkout. |
| `src/lib/accountActions.js` | Funciones puras: `inviteMember`, `acceptInvitation`, `removeMember`, `changeRole`. Encapsulan los upserts a Supabase y las llamadas a edge functions. |

### Cambios en App.jsx

- Nueva ruta `/mi-cuenta` que renderiza `MiCuenta` (solo accesible si `accountId && isAdmin`).
- Nueva ruta `/aceptar/:token` que renderiza `AcceptFamilyInvite`. **Importante:** distinguir de `/aceptar-asesor/:token` o equivalente del sistema asesor para no colisionar.
- Item de menú "Mi cuenta" en la nav lateral, visible solo si `!isLegacy`.

### RLS adicional necesaria

Las policies ya cubren CRUD de `account_invitations` por admin. **Recomendado en Fase 3:** agregar trigger `enforce_max_members_on_insert` en `account_members` que valide a nivel BD el límite (defensa en profundidad — el cliente ya valida pero un admin puede bypassear via API directa). Trigger sugerido:

```sql
CREATE FUNCTION enforce_max_members() RETURNS TRIGGER AS $$
DECLARE v_current_count INT; v_max INT;
BEGIN
  SELECT COUNT(*) INTO v_current_count FROM account_members
    WHERE account_id = NEW.account_id AND status = 'active';
  SELECT max_members INTO v_max FROM accounts WHERE id = NEW.account_id;
  IF v_current_count >= v_max THEN
    RAISE EXCEPTION 'La cuenta ya tiene % miembros activos (límite: %)', v_current_count, v_max;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

### Decisiones a cerrar antes de implementar

1. **Diseño visual** del MiCuenta — estilo card de miembros con avatar/email/rol.
2. **Texto del email de invitación** (Fase 4 lo manda; Fase 3 lo redacta).
3. **¿Qué pasa si invito a un email que ya tiene cuenta Finpathia?** Opciones:
   - (a) La invitación lo agrega a la nueva cuenta sin tocar la actual (puede ser miembro de varias).
   - (b) Se lo "transfiere" — pierde su cuenta personal.
   **Recomendación:** opción (a). El schema lo permite (`account_members` UNIQUE es `(account_id, user_id)`, no `user_id` solo). El cliente debe mostrar account switcher cuando detecte múltiples cuentas activas (incluso si por ahora switchear no es trivial; mostrar un picker simple).

### Esfuerzo estimado

~400 LOC + UX. **2-3 sesiones de trabajo.**

---

## Fase 4 — Edge Function de email de invitación

**Objetivo:** Que invitar a un email que aún no tiene cuenta envíe un correo con link `/aceptar/:token`. Que invitar a alguien que ya tiene cuenta también notifique vía email.

### Edge function nueva

`supabase/functions/send-account-invitation/index.ts`:
- Disparada desde el cliente cuando admin crea row en `account_invitations`.
- Lee la fila, busca display_name del que invita, formatea email con template HTML.
- Envía vía proveedor (Resend o SendGrid — definir).
- Marca campo `email_sent_at` (a agregar al schema en `01c-patches.sql` si se decide llevar tracking en BD; opcional).

### Cambios al schema (opcional)

Si se decide trackear envío:
```sql
ALTER TABLE public.account_invitations
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_attempts INT DEFAULT 0;
```

Lo dejamos para definir cuando se aborde Fase 4 — no afecta Fase 1.

### Edge function de aceptación

`supabase/functions/accept-account-invitation/index.ts`:
- Recibe `token` + `auth_user_id` (del JWT del invitee).
- Valida token (no consumed, no expirado, email coincide con email del invitee).
- Crea row en `account_members` (con `role` del invitation) usando SERVICE_ROLE (bypassa el RLS del catch-22).
- Marca invitation como consumed.
- Audit log.

### Decisiones a cerrar

1. **Proveedor de email:** Resend (más simple, $20/mo) o SendGrid (más caro pero más estándar). **Recomendación:** Resend.
2. **Dominio sender:** `noreply@finpathia.com` (requiere DNS records SPF/DKIM en Netlify DNS).
3. **Template:** un solo template HTML con variables `{inviter_name}`, `{account_name}`, `{role}`, `{accept_link}`.

### Esfuerzo estimado

~150 LOC + setup de DNS + cuenta Resend. **1 sesión.**

---

## Fase 5 — Tests E2E de aislamiento

**Objetivo:** Garantizar que la RLS funciona y que un usuario nunca puede leer datos de una cuenta a la que no pertenece.

### Tipos de tests

1. **SQL puros** (más simples): scripts que se conectan con dos JWTs distintos y verifican que las queries arrojan los resultados esperados. Pueden vivir en `tests/sql/` y correrse con `psql` o un script Node.

2. **Playwright E2E** (más completos): dos browsers logueados con usuarios distintos, scenarios:
   - Admin invita reader → reader acepta → reader ve datos pero no puede editar
   - Admin remueve reader → reader pierde acceso al hacer refresh
   - Admin único intenta degradarse a reader → trigger `protect_last_admin` lo bloquea

### Archivos nuevos

- `tests/sql/test-rls-aislamiento.sql` — el set de queries de §"Cómo testear RLS" del 02-plan-operativo, parametrizado.
- `tests/e2e/multi-cuenta.spec.js` — Playwright (ya está instalado en devDependencies).
- `scripts/setup-test-accounts.sql` — crea fixtures: 2 accounts, 3 users, membresías diversas.

### Esfuerzo estimado

~500 LOC tests + fixtures. **2 sesiones.** Esta fase es la que más tarda pero la más valiosa para confianza.

---

## Fase 6 — Stripe products y plan management

**Objetivo:** Vincular el campo `accounts.plan` con productos Stripe reales y manejar webhooks. **Parte del schema ya está cubierto por `01c-patches.sql`** (subscription_status, grace_until, managed_*); Fase 6 agrega los Stripe-specific.

### Productos Stripe

| Producto | Stripe Price ID | Precio | max_members | Cuándo aplica |
|---|---|---|---|---|
| Finpathia Basic | gratis | $0 | 1 | Default. Sin asesor, sin Pro pago. |
| Finpathia Pro | `price_PRO_MONTHLY` / `price_PRO_YEARLY` | $X / $Y | 1 | Pro individual sin multi-usuario familiar |
| Finpathia Pro Familiar | `price_FAMILIAR_MONTHLY` / `price_FAMILIAR_YEARLY` | $X / $Y | 5 (o 10) | Multi-usuario familiar pagado por el cliente |
| **Managed (no pago directo)** | **n/a** | **$0** | **1/3/5** | **Cuenta provista por asesor (definido por advisor_plan)** |

> **Decisión abierta:** pricing exacto y `max_members` del Familiar. Prerequisito antes de paid Google Ads.

### Edge function webhook

`supabase/functions/stripe-account-webhook/index.ts`:
- Maneja `checkout.session.completed` → busca/crea `account` para el customer, setea `plan='pro'|'pro_familiar'`, max_members del producto, stripe_customer_id, stripe_subscription_id.
- Maneja `customer.subscription.updated` → actualiza plan si cambió.
- Maneja `customer.subscription.deleted` → downgrade. Si la cuenta era `pro_familiar`, los readers entran en grace 30 días (similar a managed) antes de bajar a basic.

### Interacción con plan 'managed' (post-01c)

Hay 2 caminos cruzados que la edge function debe manejar:

**Caso A — Cliente managed compra Pro Familiar individual:**
1. Webhook recibe checkout.session.completed con plan=pro_familiar.
2. Edge function detecta que la cuenta tenía `plan='managed'`.
3. Acción: cambia plan a `pro_familiar`, setea max_members del nuevo plan, **mantiene `managed_by_advisor_id` poblado** (el cliente sigue siendo cliente del asesor) pero el plan ya no se hereda del tier del asesor.
4. Si el asesor pierde al cliente después, el trigger `start_grace_on_advisor_disconnect` (PATCH 11) verifica que `plan='managed'` antes de actuar — como ahora es `pro_familiar`, NO entra en grace. Correcto: el cliente paga su propio plan.

**Caso B — Cliente con Pro Familiar pagado cancela su Stripe mientras tiene asesor:**
1. Webhook recibe customer.subscription.deleted.
2. Edge function detecta `managed_by_advisor_id` poblado en la cuenta.
3. Acción: en lugar de bajar a basic, llamar a una función SQL `reapply_advisor_managed(account_id)` que vuelve a setear plan=managed con tier del asesor activo. Función a diseñar en Fase 6 (no está en 01c porque solo se necesita cuando hay Stripe).
4. Si no hay asesor vinculado, baja a basic con grace 30 días para los readers de pro_familiar.

### Decisiones a cerrar

1. **Pricing exacto** (memorizable: prerequisito antes de Ads).
2. **`max_members` del Familiar individual:** 5 vs 10. Decidir junto con pricing.
3. **Trial** del Familiar: 14 días free trial estándar de Stripe, o trial específico.
4. **Política de Founding** (no aparece en `advisor_plan` CHECK del schema actual del asesor): ¿se mapea a 'professional' funcionalmente, o se agrega como tier 4?
5. **Reapply advisor managed function:** SQL en `01d-patches.sql` futuro o en migration de Fase 6.

### Cambios al schema

Aditivos al 01c, que ya cubre `subscription_status` y `grace_until`:

```sql
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_until TIMESTAMPTZ;

-- Función para re-aplicar tier de asesor cuando cliente cancela Pro propio
CREATE FUNCTION reapply_advisor_managed(p_account_id UUID) ...
```

Se aplicaría como `01d-patches.sql` cuando se aborde Fase 6 (NO antes — depende de productos Stripe creados).

### Esfuerzo estimado

~300 LOC backend + setup Stripe + tests webhook. **2 sesiones.**

---

## Diagrama de dependencias entre fases

```
Fase 1 (schema)        Fase 2 (cliente)        Fase 3 (UI)             Fase 4 (email)
     │                       │                      │                       │
     ├──aplicar SQL──────────►                      │                       │
     │                       ├──useAccount───────────►                      │
     │                       ├──gating role          │                      │
     │                       │                       ├──MiCuenta UI         │
     │                       │                       ├──invitations CRUD    │
     │                       │                       │                      ├──Edge fn email
     │                       │                       │                      ├──accept flow
     │                       │                       ▼                      │
     │                       │                  Fase 5 (tests)              │
     │                       │                       │                      │
     │                       │                       ├──tests SQL           │
     │                       │                       ├──tests E2E           │
     │                       │                       ▼                      ▼
     │                       │                  Fase 6 (Stripe)
     │                       │                       │
     │                       │                       ├──products
     │                       │                       ├──webhook
     │                       │                       └──pricing UI
     ▼                       ▼                       ▼
   listo                  listo                   listo
```

**Camino crítico:** Fase 1 → Fase 2 → Fase 3 → Fase 4. Fases 5 y 6 pueden hacerse en paralelo después de Fase 4.

**Tiempo total estimado:** ~10-12 sesiones de trabajo distribuidas en 2-4 semanas según ritmo.
