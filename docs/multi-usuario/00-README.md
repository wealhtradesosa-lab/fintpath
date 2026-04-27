# 📚 Multi-usuario Pro Familiar — Documentación maestra

**Estado del proyecto:** Diseño completo · Fase 1 SQL pendiente de aplicar a Supabase productivo.

Este folder contiene el diseño técnico completo del Plan Pro Familiar de FINPATHIA, que permite que una cuenta tenga múltiples usuarios con roles `admin` (puede editar) o `reader` (solo lectura).

---

## 📁 Índice de archivos

Leer en este orden si es la primera vez:

| # | Archivo | Qué contiene |
|---|---|---|
| 0 | **`00-README.md`** | Este archivo (overview + decisiones cerradas) |
| 1 | `01-migration-schema.sql` | Schema SQL original de Fase 1 (4 tablas + RLS + triggers + migración retroactiva) |
| 2 | `01b-patches.sql` | **CRÍTICO:** 5 patches que cierran gaps detectados en auditoría. Ejecutar inmediatamente después del 01 |
| 3 | `02-plan-operativo.md` | Runbook de aplicación (backup, ejecución, verificación, rollback) |
| 4 | `03-auditoria-fase1.md` | Auditoría detallada del schema con findings críticos y menores |
| 5 | `04-fase2-diseno.md` | Refactor cliente: useAccount, gating de edición, RoleContext (Fase 2 detallada) |
| 6 | `05-fases-3-6-resumen.md` | Roadmap alto nivel: UI Mi Cuenta, email invitaciones, tests E2E, Stripe |

---

## 🎯 Concepto clave

> **Una cuenta es una bóveda financiera única (`user_data`) compartida por N miembros con roles distintos.**

Modelo de datos:

```
┌─────────────┐          ┌──────────────────┐         ┌──────────────┐
│  accounts   │  ←────── │ account_members  │ ──────→ │  auth.users  │
│  (la bóveda)│  1:N     │  (rol: admin /   │   N:1   │  (usuario)   │
│             │          │   reader)        │         │              │
│  plan       │          │  account_id      │         │              │
│  max_members│          │  user_id         │         │              │
│  owner      │          │  role            │         │              │
└─────────────┘          │  status          │         └──────────────┘
       │ 1:1             └──────────────────┘
       ▼
┌─────────────┐
│  user_data  │
│  (los datos │
│   reales)   │
│  account_id │  ← columna FK agregada por Fase 1
│  data jsonb │
└─────────────┘
```

**Plan determina límites:**

| Plan | max_members | Notas |
|---|---|---|
| `basic` | 1 | Default. Comportamiento idéntico al modelo legacy de un usuario por cuenta. |
| `pro` | 1 | Pro individual. Misma cantidad de miembros que basic, pero más features. |
| `pro_familiar` | 5-10 (TBD) | Permite invitar admins/readers adicionales. |

---

## ✅ Decisiones cerradas en sesión de diseño (Abril 2026)

### Decisión 1 — Asesor + Pro Familiar son compatibles
La cuenta Familiar es **una sola cuenta** desde el punto de vista del asesor. El asesor se relaciona con el admin owner de la cuenta vía la tabla existente `advisor_clients` y tiene acceso a la cuenta completa. Los miembros readers de la familia no aparecen en `advisor_clients` — se relaciona con la cuenta unificada, no con cada miembro individual.

**Implicación operativa:** un asesor solo puede invitar a usuarios que sean **admin** de su propia cuenta. El flujo `AcceptInvite.jsx` (asesor) debe rechazar si el invitee es reader de alguna cuenta. Esto se valida en la edge function de aceptación.

### Decisión 2 — Compartición de datos entre miembros: todos ven todo (MVP)
En el MVP, todos los miembros de una cuenta ven **todos los datos** (todos los owners, ingresos, gastos, etc.). Owners "privados" se postergan a una fase futura mediante migración aditiva (campo `private_owner_ids` en `accounts` o flag por owner). El schema actual lo permite sin cambios.

### Decisión 3 — Bootstrap automático de cuenta personal en signup
El trigger `handle_new_user` se actualiza para crear automáticamente: (a) la cuenta personal `basic`, (b) el row de admin en `account_members`, (c) el `user_data` con `account_id` ya seteado. Todo atomic en la transacción del signup. Ver PATCH 5 en `01b-patches.sql`.

### Decisión 4 — Backward compatibility durante transición
Las RLS policies de Fase 1 incluyen un brazo `OR (account_id IS NULL AND id = auth.uid())` que permite al cliente legacy seguir funcionando entre la aplicación de Fase 1 y la de Fase 2. Una vez que Fase 2 esté en producción y todos los `user_data` tengan `account_id`, en una `01d-cleanup.sql` futura se elimina ese brazo.

---

## 🚧 Decisiones abiertas (no bloquean Fase 1, se cierran en su fase)

| Decisión | Fase donde se cierra | Notas |
|---|---|---|
| Pricing exacto de Pro y Pro Familiar | Fase 6 | Prerequisito antes de paid Google Ads (memoria del proyecto). |
| `max_members` del plan Familiar (5 vs 10) | Fase 6 | Definir junto con pricing. |
| Email provider (Resend vs SendGrid) | Fase 4 | Recomendación: Resend. |
| Comportamiento al downgrade de Familiar a Pro/Basic con miembros activos | Fase 6 | Recomendación: grace period 7 días → desactivar readers. |
| Owners privados (visible solo para admin) | Post-MVP | Migración aditiva, no compromete schema actual. |

---

## 🚀 Próximos pasos en orden

```
[ ] Sesión actual:  Validar este diseño (Santiago revisa los 6 docs)
[ ] Sesión N+1:     Aplicar 01-migration-schema.sql + 01b-patches.sql en Supabase
                    Smoke tests cliente legacy (no debe romper nada)
[ ] Sesión N+2:     Implementar Fase 2 (refactor cliente con useAccount + gating)
                    Verificar 16 smoke tests de §4 en 04-fase2-diseno.md
[ ] Sesión N+3:     Implementar Fase 3 (UI MiCuenta + flujo invitación cliente-side)
[ ] Sesión N+4:     Implementar Fase 4 (Edge function email invitación)
[ ] Sesión N+5:     Tests E2E (Fase 5)
[ ] Sesión N+6+7:   Stripe products + webhook + pricing UI (Fase 6)
```

**Estimación total:** ~10-12 sesiones de trabajo, distribuidas en 2-4 semanas.

---

## 📊 Estado actual del repo

```
docs/multi-usuario/
├── 00-README.md                    ← este archivo
├── 01-migration-schema.sql         ← schema Fase 1 (323 LOC, NO aplicado)
├── 01b-patches.sql                 ← 5 patches críticos (NO aplicado)
├── 02-plan-operativo.md            ← runbook
├── 03-auditoria-fase1.md           ← auditoría con 5 findings críticos + 4 menores
├── 04-fase2-diseno.md              ← diseño detallado refactor cliente
└── 05-fases-3-6-resumen.md         ← roadmap fases siguientes

src/lib/useAccount.js               ← hook defensivo (escrito, no integrado todavía)
```

**Audit:** 19/19 OK · **Build:** OK · **HEAD:** ced1766 (Tarea 3 cerrada).

---

## 📝 Convenciones de los archivos SQL

- Todos los SQL son **idempotentes**: re-ejecutables sin romper nada (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`).
- Todos llevan bloques de **VERIFICACIÓN POST-** al final con queries para confirmar éxito.
- Comentarios en SQL son la fuente de verdad. Si hay discrepancia entre comentarios y los `.md`, prevalece el SQL.
- Los `.md` se mantienen en español. Los identificadores SQL se mantienen en inglés snake_case (estándar Postgres).
