# Finpathia PRO Corporativo — Especificación Técnica

> **Status:** Diseño cerrado · Sprint 1 (landing) implementado · Sprints 2-5 pendientes
>
> **Última revisión:** 2026-04-21
>
> **Owner:** Santiago Sosa

---

## 1. Visión general

Finpathia PRO Corporativo es la línea B2B de Finpathia, dirigida a contadores, asesores tributarios y planificadores patrimoniales que atienden clientes con patrimonio medio-alto.

**Regla de oro:** El asesor usa el **mismo producto** que un usuario retail. No se construyen dashboards, simuladores o secciones separadas. Lo único que cambia es **quién paga** y **quién ve los datos de quién**.

## 2. Roles

| Rol | Definición | Acceso |
|---|---|---|
| `retail_user` | Usuario directo que paga su propia suscripción | Su dashboard, sin vínculo a advisor |
| `advisor` | Usuario con suscripción corporativa que gestiona clientes | Workspace con lista de clientes + dashboard de cada uno |
| `advisor_client` | Cliente gestionado por un asesor | Su dashboard. Login independiente opcional (controlado por asesor) |

**Importante:** `advisor_client` no es un rol técnico distinto — es un `retail_user` con una entrada en la tabla `advisor_clients`. La distinción es relacional, no estructural.

## 3. Planes corporativos

| Plan | Clientes max | Mensual | Anual (20% off) |
|---|---|---|---|
| Starter | 5 | $79 USD/mes | $63 USD/mes (= $756/año) |
| Professional | 15 | $179 USD/mes | $143 USD/mes (= $1,716/año) |
| Boutique | 40 | $399 USD/mes | $319 USD/mes (= $3,828/año) |

**Oferta Founding Advisors:** Primeros 10 asesores en plan Professional = $89 USD/mes forever.

**Features por plan:**
- Todos los clientes del asesor reciben **acceso Pro completo** de Finpathia, sin importar el tier corporativo
- Starter: onboarding self-service, soporte email 48h
- Professional: onboarding 1-a-1, soporte 24h
- Boutique: white-label básico (logo en reportes), hasta 3 usuarios del equipo del asesor, account manager, SLA 4h

## 4. Flujo del asesor

### 4.1. Onboarding del asesor

1. Entra a `finpathia.com/asesores`
2. Selecciona plan → Stripe Checkout
3. Después de pagar: webhook crea fila en `public.advisors` con `subscription_status = active`
4. Redirect a `/workspace` (nueva pantalla)

### 4.2. Workspace del asesor (pantalla nueva)

Ruta: `/workspace` o similar.

**Layout:**
- Header: logo + "ASESORES" badge + nombre del asesor + dropdown settings/logout
- Título: "Mis Clientes · X de N activos · Plan [tier]"
- Botón primario: "+ Invitar cliente" (disabled si en capacidad)
- Lista de tarjetas, una por cliente:
  - Avatar + nombre
  - Email + última actividad
  - Patrimonio neto + score de salud financiera (preview)
  - Toggle "Permitir login independiente" [OFF|ON]
  - Botón "Ver Dashboard →"
  - Menú ⋮: Reenviar invitación · Pausar acceso · Remover cliente

### 4.3. Invitar cliente

**Modal:**
- Input: email (obligatorio), nombre (opcional)
- Checkbox: "Permitir login independiente desde el inicio" (default OFF)
- Botón "Generar link de invitación"
- Output:
  - Link: `finpathia.com/invite/:token`
  - Botones "Copiar" y "Enviar por email"
  - Info: "Expira en 7 días"

**Backend:**
- INSERT en `public.advisor_invitations` con token único (UUID)
- Opcional: envío automático por email (Netlify function + Resend u otro)

### 4.4. Cliente acepta invitación

Ruta: `/invite/:token`.

**Flujo:**
1. Landing de aceptación muestra "[Asesor Name] te invita a Finpathia"
2. Cliente ingresa email + password → se crea cuenta en `auth.users`
3. Automáticamente se crea entrada en `public.advisor_clients` vinculando al asesor
4. Token queda marcado `used = true`
5. Redirect al dashboard del cliente

### 4.5. Asesor entra al dashboard de un cliente

**Desde el workspace, click "Ver Dashboard →":**
- App.jsx detecta `advisor_mode = true` + `active_client_id = uuid-del-cliente`
- Carga data del cliente (via `public.advisor_client_data` view)
- Renderiza el dashboard completo idéntico al retail
- **Barra de contexto arriba:** "👁 Viendo como asesor: [Nombre Cliente] · [Cambiar cliente] · [← Volver al workspace]"

**Navegación:**
- "Cambiar cliente" → dropdown con lista, click cambia `active_client_id`
- "Volver al workspace" → sale del modo contexto, vuelve a `/workspace`

## 5. Permisos y edición

### 5.1. Modelo: edición mixta colaborativa

**Ambos (asesor y cliente) pueden editar todos los datos.** Sin bloqueos, sin conflicts resolution complejo.

**Estrategia:** last-write-wins + log de auditoría.

### 5.2. Log de auditoría

Cada registro operable (inversión, deuda, gasto, ingreso, meta) lleva:
- `created_by: uuid` (usuario que lo creó)
- `created_by_role: 'advisor' | 'client'`
- `last_edited_by: uuid`
- `last_edited_by_role: 'advisor' | 'client'`
- `updated_at: timestamptz`

**En la UI:**
- Ícono sutil al lado de cada registro: 👤 (cliente) o 🎯 (asesor)
- Tooltip: "Editado por [Nombre] · [fecha]"
- Vista de auditoría (pro): lista de cambios recientes cross-registros

### 5.3. Jurisdicción (CO vs US)

El campo `user_data.jurisdiction` sigue siendo del **cliente**. El asesor no tiene jurisdicción propia para propósitos de cálculo — ve la jurisdicción del cliente activo.

Cuando el asesor está viendo a un cliente CO, ve plan tributario CO. Cuando cambia a un cliente US, ve plan tributario US.

## 6. Login independiente del cliente

### 6.1. Default: deshabilitado

Cuando un asesor invita a un cliente, el cliente **no tiene login propio** inicialmente. Solo existe "dentro" del workspace del asesor.

Esto protege el modelo de negocio del asesor conservador (no quiere que el cliente "se vaya" con la herramienta).

### 6.2. Activación por el asesor

En la tarjeta del cliente en el workspace, hay un toggle "Permitir login independiente".

Cuando el asesor lo activa:
1. Se envía email al cliente con link "Activa tu acceso"
2. El cliente ingresa al link y crea su password
3. Desde ahí, puede entrar a `finpathia.com/login` directamente con su email + password
4. El vínculo `advisor_clients` persiste — el asesor sigue viéndolo

### 6.3. Si el asesor desactiva el toggle

La password del cliente no se borra, pero se desactiva. El cliente recibe notificación. Si el asesor reactiva, el cliente vuelve a tener acceso con su password existente.

## 7. Lifecycle: qué pasa si asesor cancela

### 7.1. Asesor cancela suscripción

1. Webhook de Stripe: `subscription_status = 'canceled'`
2. Grace period de 7 días (asesor sigue con acceso)
3. Después de 7 días:
   - Asesor: acceso bloqueado a `/workspace`. Su cuenta `auth.users` sigue existiendo pero sin rol advisor activo.
   - Clientes: todos cambian a plan `free` de Finpathia
   - Vínculo `advisor_clients` queda con `status = 'removed'`
   - Clientes reciben email: "Tu asesor ha terminado su servicio. Puedes seguir usando Finpathia gratis, o suscribirte directamente al plan Pro retail."

### 7.2. El cliente quiere pagar directo

1. Cliente entra a `finpathia.com/login` con su email
2. Si nunca tuvo password (login independiente nunca se activó), usa flujo "Olvidé mi contraseña" para establecer una
3. Ve su dashboard en modo Free
4. Paga plan Pro retail desde el mismo flujo existente de Stripe
5. Queda como `retail_user` normal

### 7.3. Un nuevo asesor quiere tomar al cliente

Cliente recibe nueva invitación → acepta → se crea nuevo vínculo en `advisor_clients` con el nuevo asesor. El cliente mantiene todos sus datos.

## 8. Schema de Supabase

Ver `supabase/migrations/20260421_advisor_mode.sql` para SQL exacto.

**Tablas nuevas:**
- `public.advisors` — registro del asesor con plan, Stripe, max_clients
- `public.advisor_clients` — pivote advisor ↔ client con status y audit
- `public.advisor_invitations` — tokens de invitación con expiración

**View:**
- `public.advisor_client_data` — acceso de lectura del asesor a data de sus clientes

**Modificaciones a tablas existentes:**
- `public.user_data.data` (jsonb): cada item de array (inv, deu, gas, etc.) debe incluir campos de auditoría (se maneja a nivel de aplicación, no de schema — el jsonb sigue flexible)

## 9. Stripe

**Productos a crear:**

| Producto | Price ID (a llenar) | Precio | Ciclo |
|---|---|---|---|
| PRO Corporativo Starter | `price_STARTER_MONTHLY` | $79 USD | mensual |
| PRO Corporativo Starter | `price_STARTER_YEARLY` | $756 USD | anual |
| PRO Corporativo Professional | `price_PROFESSIONAL_MONTHLY` | $179 USD | mensual |
| PRO Corporativo Professional | `price_PROFESSIONAL_YEARLY` | $1,716 USD | anual |
| PRO Corporativo Founding | `price_FOUNDING` | $89 USD | mensual forever |
| PRO Corporativo Boutique | `price_BOUTIQUE_MONTHLY` | $399 USD | mensual |
| PRO Corporativo Boutique | `price_BOUTIQUE_YEARLY` | $3,828 USD | anual |

**Webhook events a manejar:**
- `checkout.session.completed` → crear fila en `advisors`, establecer subscription_status=active, max_clients según plan
- `customer.subscription.updated` → actualizar status (si cambia de active a past_due, por ejemplo)
- `customer.subscription.deleted` → marcar canceled, activar grace period
- `invoice.payment_failed` → notificar al asesor

## 10. Sprints de desarrollo

### ✅ Sprint 1 (completo) — Landing
- [x] `LandingAsesores.jsx` con 3 tiers
- [x] Ruta `/asesores` en App.jsx
- [x] SQL migration preparado (no aplicado)
- [x] PR #1 en GitHub

### ⏳ Sprint 2 — Backend del asesor
- [ ] Aplicar SQL migration a Supabase
- [ ] Crear productos en Stripe con price IDs reales
- [ ] Netlify function: `advisor-signup` (webhook Stripe)
- [ ] Netlify function: `advisor-invite` (generar token)
- [ ] Netlify function: `advisor-accept-invite` (vincular cliente)
- [ ] Actualizar `stripe-checkout.js` para planes corporativos

### ⏳ Sprint 3 — UI del Workspace
- [ ] Componente `AdvisorWorkspace.jsx`
- [ ] Componente `ClientCard.jsx`
- [ ] Componente `InviteClientModal.jsx`
- [ ] Componente `AdvisorContextBar.jsx` (barra superior cuando ve cliente)
- [ ] Componente `ClientSwitcher.jsx` (dropdown de clientes)
- [ ] Landing de aceptación `/invite/:token`

### ⏳ Sprint 4 — Wiring con app
- [ ] Detectar rol advisor al login → redirect a `/workspace`
- [ ] Cargar data del cliente activo cuando asesor entra al dashboard
- [ ] Sistema de auditoría: agregar `created_by`/`last_edited_by` en sanitize
- [ ] Mostrar íconos de auditoría en UI de cada módulo
- [ ] Toggle "login independiente" en tarjeta de cliente

### ⏳ Sprint 5 — Stripe + lifecycle
- [ ] Customer Portal de Stripe para asesores
- [ ] Webhooks completos (subscription updated, deleted, payment failed)
- [ ] Grace period lógica (7 días)
- [ ] Email automation (bienvenida, invitación, cancelación)
- [ ] Flujo de "cliente huérfano" pasa a retail

### ⏳ Sprint 6 — QA + lanzamiento
- [ ] Testing E2E de todos los flujos
- [ ] Preview con 3 asesores piloto
- [ ] Oferta Founding Advisors activa (contador en backend)
- [ ] Landing pública anunciando

## 11. Decisiones de producto cerradas

Estas decisiones ya están tomadas y **no se reabren** salvo evidencia fuerte de que estaban mal:

| Decisión | Elección | Por qué |
|---|---|---|
| Producto para clientes de asesor | Mismo Pro retail completo | Simplicidad, coherencia, cero duplicación |
| Edición de datos del cliente | Mixta con audit log | Flexible, profesional, registrable |
| Login independiente del cliente | Controlado por asesor (toggle) | Respeta modelo de negocio de cada asesor |
| Pricing corporativo | $79/$179/$399 (intermedio) | ROI claro para asesor, margen para Finpathia |
| Qué pasa si asesor cancela | Cliente queda Free, puede pagar retail | Justo, no destruye data, upgrade path |
| Oferta Founding Advisors | Solo Professional, $89 forever, 10 cupos | Acelera adopción del tier core |
| Landing | `/asesores` dedicada, mismo diseño que retail | Coherencia + conversión B2B |

## 12. Decisiones técnicas abiertas

Pendientes de resolver en sprints correspondientes:

- [ ] ¿Cómo se implementa el email system? (Resend, SendGrid, Netlify native?)
- [ ] ¿White-label en Boutique = logo en reportes solamente, o también en dashboard?
- [ ] ¿Boutique permite 3 sub-usuarios distintos, o 1 login compartido con roles?
- [ ] ¿Necesitamos staging de Supabase separado, o el flujo de PR + testing local es suficiente?
- [ ] ¿Ofrecemos trial de 14 días para asesores también?

---

**Referencias:**
- PR inicial landing: https://github.com/wealhtradesosa-lab/fintpath/pull/1
- Supabase project: `pdwrgpskzvrjkqozfbvl` (FINPATHIA)
- Deploy: Netlify → `finpathia.com`
