# 🛠️ Fase 2 — Refactor cliente para multi-cuenta

**Estado:** Diseño · **Pre-requisitos:** Fase 1 + patches `01b` aplicados.
**Output esperado:** App funcional con `useAccount` integrado, gating de edición por rol, lecturas/escrituras por `account_id` en lugar de `auth.uid()`.

Esta fase es la más invasiva del cliente: toca `App.jsx` (donde se carga/guarda `user_data`) y agrega gating de edición en todos los módulos que escriben. Está diseñada para ser **un solo commit grande pero acotado**, ejecutable en una sesión.

---

## 1. Cambios concretos en `src/App.jsx`

### 1.1 Función `sL(uid)` — carga inicial (línea 50-67)

**Antes:**
```js
const sL=async(uid)=>{
  const{data,error}=await supabase.from("user_data").select("data,jurisdiction").eq("id",uid).single();
  // ...
}
```

**Después:**
```js
const sL=async(uid, accountId)=>{
  // Si tenemos accountId, leer por cuenta (camino multi-usuario)
  // Sino, fallback a leer por uid (camino legacy / backward compat)
  const query = supabase.from("user_data").select("data,jurisdiction");
  const {data, error} = accountId
    ? await query.eq("account_id", accountId).maybeSingle()
    : await query.eq("id", uid).maybeSingle();
  // ...resto igual
}
```

**Notas:**
- `.single()` → `.maybeSingle()` para no romper si no hay row todavía (caso transitorio).
- `accountId` viene de `useAccount`. Si `isLegacy=true`, queda undefined y caemos en el fallback por uid.
- `localStorage` sigue siendo `fp3` (no se cambia el namespace). El cache local es por dispositivo, no por cuenta — correcto: si el usuario hace switch de cuenta, debemos invalidar el cache. Ver §1.4.

### 1.2 Función de guardado (línea 197-231)

**Antes:**
```js
const result=await supabase.from("user_data").upsert(
  {id:uid,data:d,jurisdiction:d.jurisdiction||"CO",updated_at:new Date().toISOString()},
  {onConflict:"id"}
);
```

**Después:**
```js
// Caso multi-cuenta: hacer UPDATE por account_id (NO upsert, porque no
// queremos crear filas nuevas). El row ya existe (creado por handle_new_user
// o por migración retroactiva).
let result;
if (accountId && !isLegacy) {
  result = await supabase.from("user_data")
    .update({data:d, jurisdiction:d.jurisdiction||"CO", updated_at:new Date().toISOString()})
    .eq("account_id", accountId);
} else {
  // Fallback legacy
  result = await supabase.from("user_data").upsert(
    {id:uid, data:d, jurisdiction:d.jurisdiction||"CO", updated_at:new Date().toISOString()},
    {onConflict:"id"}
  );
}
```

**Razones del cambio:**
- En modo multi-cuenta hay **una sola fila** de `user_data` por cuenta, cuyo `id` es el del owner original (no necesariamente `auth.uid()`). El upsert con `onConflict:"id"` rompería si un admin invitado intenta guardar (su `auth.uid()` ≠ `id` del row).
- `update().eq("account_id", ...)` es la operación correcta: actualiza la fila existente sin importar quién la creó. RLS valida que sea admin.
- El fallback legacy se mantiene por seguridad mientras se valida en producción.

### 1.3 Integrar `useAccount` en el árbol de App

Hoy `App.jsx` no llama a `useAccount`. Hay que:

1. Importar el hook:
   ```js
   import {useAccount, isReader, isAdmin} from "./lib/useAccount";
   ```

2. Llamarlo en el componente principal después del `useState` de `authUser`:
   ```js
   const {accountId, role, isLegacy, loading: accountLoading, refresh: refreshAccount} = useAccount(authUser, supabase);
   ```

3. Pasar `accountId` y `role` a:
   - `sL(uid, accountId)` — al cargar
   - función de save — al guardar
   - todos los módulos que renderizan UI de edición (vía contexto o props)

### 1.4 Account switcher mínimo (NUEVO, post-validación)

**Problema que resuelve:** un usuario puede ser miembro de varias cuentas (su cuenta personal donde es admin + cuenta familiar de su pareja donde es reader). El `useAccount.js` actual elige "la primera con prioridad de owner" — siempre la cuenta personal. **Sin un switcher, el invitado nunca puede acceder a la cuenta a la que lo invitaron.**

Originalmente el switcher se postergaba a Fase 3, pero la validación del diseño detectó que sin él, el flujo end-to-end de invitación a usuarios con cuenta existente queda roto entre Fase 2 y Fase 3. Por eso entra en Fase 2 con UX mínima.

**Diseño:**

1. **Persistencia:** clave `fp3_active_account` en localStorage. Si está y matchea una membresía activa del user, usar esa cuenta. Si no, fallback a la heurística owner-first del hook actual.

2. **Modificación a `useAccount.js`** (~15 LOC adicionales):
   ```js
   // Después de obtener `data` (lista de membresías activas):
   const stored = localStorage.getItem("fp3_active_account");
   const storedMatch = stored && data.find(m => m.account_id === stored);
   const ownCuenta = data.find(m => m.accounts?.owner_user_id === authUser.id);
   const cuentaActiva = storedMatch || ownCuenta || data[0];
   ```

3. **Componente nuevo `src/components/AccountSwitcher.jsx`** (~80 LOC):
   - Botón en header que muestra `displayName` + `role`.
   - Click abre dropdown con todas las membresías activas del user.
   - Click en otra cuenta: `localStorage.setItem("fp3_active_account", id)` + `localStorage.removeItem("fp3")` (invalidar cache de la cuenta vieja) + `refreshAccount()` + reload de `user_data`.
   - Si el user tiene **una sola cuenta**, NO renderizar el switcher (no agrega valor).

4. **Renderizado en App.jsx** (Cambio 7 actualizado):
   ```jsx
   {!isLegacy && memberships.length > 1 && viewMode !== "client" && (
     <AccountSwitcher
       memberships={memberships}
       activeAccountId={accountId}
       onSwitch={handleAccountSwitch}
     />
   )}
   ```

5. **Cache invalidation:** al cambiar de cuenta, limpiar `localStorage["fp3"]` (que es de la cuenta anterior). El próximo `sL(uid, accountId)` carga de Supabase la nueva cuenta. **Esto requiere que `useAccount` también devuelva la lista completa de membresías** (no solo la activa) para que el switcher tenga qué mostrar — extender el hook para devolver `memberships: data` además de los campos actuales.

**Decisión:** este switcher mínimo entra en Fase 2 como Cambio 10 (ver `06-fase2-snippets.md`). Refinamientos UX (avatares, último login por cuenta, ordenamiento por uso reciente) van en Fase 3.

### 1.5 Estado de loading combinado

Hoy `authLoading` es la única señal de "cargando". Fase 2 agrega `accountLoading`. Combinarlos:

```js
const ld = authLoading || accountLoading;  // ya existe ld; ahora incluye account
```

El `LoadingScreen` actual cubre ambos casos sin cambios visuales.

---

## 2. Gating de edición por rol

### 2.1 Estrategia: Context React + helper `canEdit`

Crear `src/lib/RoleContext.js`:

```js
import {createContext, useContext} from "react";

export const RoleContext = createContext({role: "admin", isReader: false, isAdmin: true});

export const useRole = () => useContext(RoleContext);

// Helper para usar en handlers: si reader, no hace nada y muestra toast
export const guardEdit = (role, showToast) => {
  if (role === "reader") {
    showToast?.("Solo lectura: pedí al admin de la cuenta que actualice este dato");
    return false;
  }
  return true;
};
```

En `App.jsx`, envolver el árbol:

```js
<RoleContext.Provider value={{role, isReader: role==="reader", isAdmin: role==="admin"}}>
  {/* árbol existente */}
</RoleContext.Provider>
```

### 2.2 Módulos a actualizar

Cada módulo que llama a `setU` (state setter) debe verificar el rol antes:

| Módulo | Acciones que requieren admin |
|---|---|
| `IngresosModule.jsx` | crear/editar/eliminar ingreso, drag-reorder |
| `GastosModule.jsx` | crear/editar/eliminar gasto, drag-reorder |
| `DeudasModule.jsx` | crear/editar/eliminar deuda |
| `InversionesModule.jsx` | crear/editar/eliminar inversión |
| `MetasModule.jsx` / `GoalsModuleUS.jsx` | CRUD metas |
| `SimuladorAvanzado.jsx` | sliders escriben en estado pero NO en BD; **dejar editable para reader** (se considera escenario, no datos reales) |
| `SimuladorTributario.jsx` / `TaxPlanningUS.jsx` | similar al anterior |
| `EditarAportesManuales.jsx` | edita data del fiscal — admin only |
| `EditarDescuentosTributarios.jsx` | idem |
| `AjustesFiscalesPersonalizados.jsx` | idem |
| `CsvImport.jsx` | escritura masiva — admin only, **botón oculto para reader** |
| `DeclaracionUpload.jsx` | escritura — admin only |

> **Decisión:** los simuladores son interactivos pero no persistentes — dejarlos abiertos a readers para que puedan "explorar" escenarios sobre los datos reales.

### 2.3 Patrón de gating en componente

Dos opciones según el módulo:

**Opción A — Bloquear el handler (simple):**
```js
const {role} = useRole();
const handleAdd = () => {
  if (role === "reader") { showToast("Solo lectura"); return; }
  // ...lógica original
};
```

**Opción B — Renderizar UI distinta (mejor UX):**
```js
const {isAdmin} = useRole();
{isAdmin ? (
  <button onClick={handleAdd}>+ Agregar ingreso</button>
) : (
  <div style={{opacity:0.5}}>Solo lectura · pedí al admin que agregue</div>
)}
```

Para Fase 2 inicial, **Opción A** en todos los módulos (más rápida, menos propensa a bugs visuales). Mejorar a **Opción B** en Fase 3 cuando se haga la UI de "Mi cuenta".

### 2.4 Banner global de rol activo

En el header, debajo del logo, un banner sutil cuando `role === "reader"`:

```
[icon de ojo] Estás viendo la cuenta de Familia Sosa en modo solo lectura
```

Componente nuevo: `src/components/RoleBanner.jsx`. Se renderiza condicionalmente en App.jsx cuando `!isLegacy && isReader`.

> **Post-01c:** pasarle `accountName={displayName}` desde useAccount para personalizar el texto.

### 2.5 Banners adicionales por estado de cuenta (post-01c)

Los campos extendidos de `useAccount` (`plan`, `subscriptionStatus`, `graceUntil`, `managedByAdvisor`, `maxMembers`) habilitan UI extra que conviene tener desde Fase 2. Decisión: **renderizar solo el caso crítico (`grace`) en Fase 2; el resto en Fase 3 con la UI completa de MiCuenta**.

| Caso | Cuándo se muestra | Acción del banner |
|---|---|---|
| `subscriptionStatus === 'grace'` | Cuenta managed que perdió asesor, dentro del período de gracia (30 días) | Banner amarillo: "Tu plan asesor termina el [graceUntil]. Suscribite a Pro Familiar para mantener tus miembros." + botón a Stripe checkout |
| `plan === 'managed'` (no grace) | Cliente activo de asesor | Indicador sutil en MiCuenta (Fase 3): "Plan provisto por tu asesor [advisor_firm_name]" |
| `account_members.active >= maxMembers` | Cuenta llena | En Fase 3 deshabilitar botón "Invitar". Fase 2 no expone UI de invitación todavía. |

Componente nuevo opcional para Fase 2: `src/components/GraceBanner.jsx` (similar a RoleBanner pero amarillo, con botón CTA y countdown). Si se posterga a Fase 3, basta con que `useAccount` exponga los campos — los banners se construyen después.

### 2.6 Llamada lazy a `expire_managed_grace_period()` en login

Después del 01c, las cuentas con grace expirado (`grace_until < NOW()`) no se actualizan automáticamente — la función SQL `expire_managed_grace_period()` es la que las baja a basic. Idealmente eso lo hace un cron diario (Fase 4), pero como fallback simple en Fase 2:

```js
// En App.jsx, después de cargar el authUser y resolver useAccount:
useEffect(() => {
  if (!authUser?.id || isLegacy) return;
  // Lazy call: si esta cuenta está en grace expirado, la función la baja a basic.
  // Es idempotente: si no hay nada que expirar, no hace cambios.
  // SECURITY DEFINER permite a authenticated llamarla sin RLS.
  supabase.rpc("expire_managed_grace_period").then(({ data, error }) => {
    if (error) console.warn("[lazy grace expire]", error);
    if (data && data > 0) {
      console.log(`[lazy grace expire] ${data} cuentas bajadas a basic`);
      refreshAccount(); // forzar re-fetch del useAccount con nuevo plan
    }
  });
}, [authUser?.id, isLegacy]);
```

> **Caveat:** la función afecta TODAS las cuentas en grace expirado del sistema, no solo la del usuario actual. Eso está bien porque (a) la operación es idempotente, (b) un usuario llamándola "ayuda" al sistema completo, (c) Postgres maneja la concurrencia correctamente. Si en algún momento se quiere restringir a solo "mi cuenta", se modifica la función SQL para tomar un parámetro.

---

## 3. Coexistencia con sistema asesor↔cliente

El sistema asesor existente (`viewMode: "client"` cuando un asesor está viendo a un cliente) usa `advisor_client_data` (view) como fuente de datos. **No debe pasar por `useAccount`** — el rol del asesor sobre el cliente es distinto del rol multi-usuario.

### 3.1 Flujo decision

```
authUser disponible
├─ ¿advisorProfile && viewMode === "client"?
│  └─ SÍ  → modo asesor viendo cliente
│           Cargar via advisor_client_data (sin useAccount)
│           Editor habilitado (asesor siempre puede)
│           NO renderizar RoleBanner
│
└─ NO → modo retail
        Llamar useAccount(authUser, supabase)
        Cargar user_data via account_id
        Habilitar/deshabilitar edición según role
        Renderizar RoleBanner si reader
```

### 3.2 Caso del cliente con Pro Familiar Y asesor

Por la decisión tomada ("asesor ve la cuenta familiar como una sola cuenta"), no hay nada extra que hacer: el asesor sigue viendo `user_data` del cliente original (vía `advisor_client_data` JOIN sobre `ud.id = ac.client_id`). Como `user_data` es 1 sola fila por cuenta, esa fila contiene los datos compartidos con la familia. Los miembros readers de la familia **no aparecen** en `advisor_clients` y eso es OK — el asesor se relaciona con el admin owner.

**Restricción operativa para MVP:** un asesor solo puede invitar a usuarios que sean ADMIN de su propia cuenta (sea cuenta personal o familiar). Si un reader intenta aceptar invitación de asesor, el flujo `AcceptInvite.jsx` debe rechazar con mensaje claro. Esto se valida en la edge function `advisor-accept-invite` consultando `account_members`.

### 3.3 Stripe pricing implications

El asesor paga su plan corporativo separado. La cuenta del cliente puede ser `basic`, `pro`, o `pro_familiar`. Son ortogonales. Detalle de pricing en `05-fases-3-6-resumen.md` § Fase 6.

---

## 4. Tests manuales antes de mergear Fase 2

Lista mínima de smoke tests:

```
[ ] 1. Usuario existente login → ve sus datos como antes
[ ] 2. Usuario existente edita ingreso → guardado funciona
[ ] 3. Usuario existente refresca → datos persistidos
[ ] 4. Usuario nuevo signup → handle_new_user crea account, user_data carga limpio
[ ] 5. Usuario nuevo edita y guarda → funciona
[ ] 6. Logout → cache local limpio
[ ] 7. Asesor login → workspace carga lista de clientes
[ ] 8. Asesor entra a cliente → datos del cliente cargan
[ ] 9. Asesor edita datos del cliente → guardado funciona
[ ] 10. Asesor vuelve a workspace → lista persiste

Multi-cuenta (requiere set up manual en SQL Editor):
[ ] 11. Insertar manualmente un account_member adicional con role='reader'
        para una cuenta de testing
[ ] 12. Login con ese segundo usuario → useAccount detecta role=reader
[ ] 13. Datos cargan en modo solo lectura → RoleBanner visible
[ ] 14. Click en "+ Agregar ingreso" → toast "Solo lectura"
[ ] 15. Sliders del simulador funcionan (escenarios sí permitidos)
[ ] 16. Logout y re-login del admin original → todo igual a antes

Account switcher (post-validación, sólo si user tiene >1 membresía):
[ ] 17. User invitado a 2da cuenta + acepta → AccountSwitcher visible en header
[ ] 18. Click switcher → dropdown muestra ambas cuentas con rol
[ ] 19. Switch a cuenta 2 → localStorage.fp3 limpio, datos de cuenta 2 cargan
[ ] 20. Reload página → cuenta activa persiste (localStorage.fp3_active_account)
[ ] 21. Switch a cuenta 1 → datos correctos, sin mezcla con cuenta 2
[ ] 22. User con 1 sola membresía → switcher NO se renderiza
```

---

## 5. Riesgos y rollback

### 5.1 Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| `update().eq("account_id",...)` no encuentra row → guardado falla en silencio | El listener actual de `fp3-save-error` ya muestra toast. Reforzar log con detalle. |
| Cache local de cuenta vieja se mezcla con cuenta nueva | Logout limpia. Mientras no haya account switcher (Fase 3), no es problema. |
| RLS bloquea operación legítima por estar en estado inconsistente | Fallback legacy en sL/save (`if accountId && !isLegacy ... else upsert legacy`) cubre el caso. |
| `useAccount` bucle infinito si supabase falla | El hook ya tiene try/catch y modo defensivo. Verificar que `tick` no se incremente en error. |
| `RoleContext` re-renderiza todo el árbol cuando cambia rol | El rol cambia muy raramente (solo en login/logout). No es problema de performance. |

### 5.2 Plan de rollback de Fase 2

Si Fase 2 deploy se queda mal en producción y hay que revertir mientras se debugea:

1. `git revert <commit-fase-2>` y push → vuelve al cliente legacy.
2. El SQL de Fase 1 + 01b queda aplicado, pero la backward compat permite que el cliente legacy siga funcionando sin tocar nada.
3. Cero pérdida de datos: las nuevas tablas siguen sin uso desde el cliente, los datos viven en `user_data` como siempre.

---

## 6. Estimación de trabajo

| Tarea | LOC aprox | Esfuerzo |
|---|---|---|
| Refactor `sL` y save en App.jsx | ~30 LOC | bajo |
| Integrar `useAccount` y `RoleContext` | ~50 LOC | bajo |
| Crear `RoleContext.js` y `RoleBanner.jsx` | ~80 LOC | bajo |
| **Account switcher mínimo (post-validación):** extender `useAccount` con `memberships` + nuevo `AccountSwitcher.jsx` + lógica de switch + invalidación cache | ~120 LOC | medio |
| Gating en módulos (Opción A) | ~5 LOC × 11 módulos = 55 LOC | medio |
| Smoke tests manuales (incluye 6 nuevos del switcher) | — | medio (1.5-2 horas) |
| **Total Fase 2** | **~330 LOC** | **1-1.5 sesiones de trabajo** |

> **Recomendación:** dividir en 3 commits separados: (1) infra base (sL/save/useAccount/RoleContext), (2) switcher (AccountSwitcher + extensión useAccount), (3) gating en módulos. Permite verificar cada base antes de tocar 11 archivos.

---

## 7. Lo que NO entra en Fase 2 (queda para Fase 3+)

- UI "Mi cuenta" con lista de miembros, plan, botón de invitar.
- Flujo de invitación end-to-end con email.
- Pantalla de aceptación de invitación familiar (similar a `AcceptInvite.jsx` pero para `account_invitations`).
- Refinamiento UX del switcher (avatares, último login por cuenta, ordenamiento por uso reciente). El switcher mínimo SÍ entra en Fase 2.
- Refinamiento UX de gating (Opción B en módulos).
- Tests E2E automatizados.

Todo lo anterior se diseña en `05-fases-3-6-resumen.md`.
