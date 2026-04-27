# 🔧 Fase 2 — Snippets de implementación para `App.jsx`

**Pre-requisitos:** Fase 1 + `01b-patches.sql` aplicados a Supabase. Branch nuevo `feature/multi-usuario-fase-2` creado.

Este documento contiene los **diffs exactos** que la sesión de implementación de Fase 2 debe aplicar a `src/App.jsx`. Los stubs (`useAccount.js`, `RoleContext.jsx`, `RoleBanner.jsx`) ya existen en el repo desde el commit de diseño — esta fase solo los integra.

> **Convención:** los números de línea son **referenciales al HEAD actual** (`ced1766` + diseño). Antes de aplicar, hacer `git pull` y verificar que la línea sigue siendo la misma con `grep -n` del marcador del cambio.

---

## Cambio 1 — Agregar imports

**Ubicación:** después de la línea 37 (`import { supabase, isSupabaseConfigured } from "./lib/supabase";`).

**Buscar:**
```js
import { supabase, isSupabaseConfigured } from "./lib/supabase";
```

**Reemplazar por:**
```js
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { useAccount } from "./lib/useAccount";
import { RoleProvider } from "./lib/RoleContext.jsx";
import RoleBanner from "./components/RoleBanner";
```

---

## Cambio 2 — Refactor de `sL(uid)` para aceptar `accountId`

**Ubicación:** líneas 50-67. Función actual:

```js
const sL=async(uid)=>{
  try{
    if(isSupabaseConfigured&&uid){
      const{data,error}=await supabase.from("user_data").select("data,jurisdiction").eq("id",uid).single();
      if(!error&&data?.data){
        // ... resto sin cambios
```

**Reemplazar por:**

```js
const sL=async(uid,accountId)=>{
  try{
    if(isSupabaseConfigured&&uid){
      // Multi-cuenta: leer por account_id si está disponible. Caer a uid (legacy) si no.
      const q=supabase.from("user_data").select("data,jurisdiction");
      const{data,error}=accountId
        ? await q.eq("account_id",accountId).maybeSingle()
        : await q.eq("id",uid).maybeSingle();
      if(!error&&data?.data){
        // ... resto sin cambios
```

**Notas:**
- `.single()` cambia a `.maybeSingle()` para tolerar el caso transitorio en que la fila aún no existe.
- El llamador (línea ~360 y ~570 aprox de App.jsx, donde se hace `await sL(session.user.id)`) debe pasarle también `accountId` — ver Cambio 4.

---

## Cambio 3 — Refactor del upsert (líneas 197-231)

**Buscar el bloque del upsert** (línea 207):

```js
const result=await supabase.from("user_data").upsert(
  {id:uid,data:d,jurisdiction:d.jurisdiction||"CO",updated_at:new Date().toISOString()},
  {onConflict:"id"}
);
```

**Reemplazar por:**

```js
// Multi-cuenta: si tenemos accountId, hacer UPDATE por account_id (NO upsert,
// porque la fila ya existe — la creó handle_new_user o la migración retroactiva).
// El admin invitado tiene auth.uid() distinto al `id` del row, por eso no
// podemos usar upsert con onConflict:"id".
let result;
if(accountIdRef.current && !isLegacyRef.current){
  result=await supabase.from("user_data")
    .update({data:d,jurisdiction:d.jurisdiction||"CO",updated_at:new Date().toISOString()})
    .eq("account_id",accountIdRef.current);
}else{
  // Fallback legacy: cliente pre-Fase 2 o usuario sin cuenta multi-usuario aún
  result=await supabase.from("user_data").upsert(
    {id:uid,data:d,jurisdiction:d.jurisdiction||"CO",updated_at:new Date().toISOString()},
    {onConflict:"id"}
  );
}
```

> **Importante:** `accountIdRef.current` y `isLegacyRef.current` son refs (`useRef`) para evitar cerrar sobre valores stale. Ver Cambio 4 para crearlas.

---

## Cambio 4 — Integrar `useAccount` en el componente principal

**Ubicación:** la línea 267 que tiene los `useState` masivos. Aproximadamente al inicio de esa megalínea.

**Antes** (snippet conceptual):
```js
const[u,_setU]=useState(null);
// ... muchos más useStates ...
const[authUser,setAuthUser]=useState(null);
```

**Agregar después de `setAuthUser`:**

```js
// Fase 2: hook multi-cuenta. Si la migración Fase 1 + 01b + 01c está aplicada,
// devuelve accountId, role y los campos extendidos (plan, max_members,
// managed_*, subscription_status, grace_until). Si no (modo legacy),
// devuelve isLegacy=true con defaults.
const {
  accountId, role, isLegacy,
  plan, maxMembers, displayName,
  managedByAdvisor, managedTier,
  subscriptionStatus, graceUntil,
  loading: accountLoading,
  refresh: refreshAccount,
} = useAccount(authUser, supabase);

// Refs para que sL/save accedan a values frescas sin recrear callbacks
const accountIdRef=useRef(accountId);
const isLegacyRef=useRef(isLegacy);
useEffect(()=>{accountIdRef.current=accountId;isLegacyRef.current=isLegacy;},[accountId,isLegacy]);
```

**Y agregar `useRef` al import de React (línea 36):**
```js
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
```

---

## Cambio 5 — Pasar `accountId` a las llamadas de `sL()`

Hay **3 llamadas a `sL()` en App.jsx** — pero solo **2 necesitan refactor** (las que cargan datos del usuario autenticado contra Supabase). Buscarlas:

```bash
grep -n "sL(" src/App.jsx
```

Resultado esperado (3 ocurrencias):
- **Línea ~345** (load inicial al recuperar sesión): refactor SÍ — pasarle `accountId`.
- **Línea ~368** (`sL()` sin uid, fallback localStorage offline): NO tocar — no usa account.
- **Línea ~547** (load tras login exitoso): refactor SÍ — pasarle `accountId`.

**Cambio en cada una de las 2 que llevan uid:**

Antes:
```js
const sd=await sL(session.user.id);
```

Después:
```js
// Esperar a que useAccount resuelva antes de cargar (evita query con accountId vacío)
if(accountLoading)return;
const sd=await sL(session.user.id, accountId);
```

> **Caveat:** las llamadas a `sL` están dentro de `useEffect`. Agregar `accountId` y `accountLoading` a las deps del `useEffect` correspondiente. Sin esto, el effect corre con `accountId=null` la primera vez y nunca recarga cuando llega.

---

## Cambio 6 — Combinar `accountLoading` con `authLoading`

Buscar la variable `ld` (loading global) en línea 267:

```js
const[ld,setLd]=useState(true);
```

**Agregar inmediatamente después** (mismo bloque):

```js
// Loading combinado: mientras useAccount resuelve, no debemos renderizar dashboard
const ldCombined=ld||accountLoading;
```

**Y reemplazar todos los usos de `ld` en condiciones de render por `ldCombined`.** Buscar:

```bash
grep -n "if(ld)" src/App.jsx
grep -n "ld\?" src/App.jsx
grep -n "{ld " src/App.jsx
```

Cada uno de esos usos pasa a `ldCombined`. Si hay `setLd(false)` después de cargar datos, esos NO cambian — siguen apagando solo el loading de auth/data.

---

## Cambio 7 — Envolver el árbol con `RoleProvider` + banners condicionales

Buscar el `return (` principal del componente App. Probablemente alrededor de la línea 1000-1500.

**Inmediatamente dentro del fragment/div raíz**, envolver con:

```jsx
<RoleProvider value={{role, isLegacy, accountId}}>
  {/* Banner de solo lectura: cuenta multi-usuario, rol reader, NO modo asesor-cliente */}
  {!isLegacy && role === "reader" && viewMode !== "client" && (
    <RoleBanner accountName={displayName} />
  )}

  {/* Banner de grace period (post-01c): cuenta managed que perdió asesor */}
  {!isLegacy && subscriptionStatus === "grace" && graceUntil && viewMode !== "client" && (
    <GraceBanner
      accountName={displayName}
      graceUntil={graceUntil}
      onUpgrade={() => /* navegar a Stripe checkout Pro Familiar */}
    />
  )}

  {/* ...todo el árbol existente... */}
</RoleProvider>
```

> **Sobre `accountName` y `displayName`:** ya vienen del `useAccount` extendido (Cambio 4). No requiere cambios adicionales en el hook.

> **Sobre `GraceBanner`:** componente nuevo opcional. Si se prefiere postergar a Fase 3, omitir ese segundo bloque y conformarse con que el cliente vea el plan="managed" sin alerta visible. Decisión: **incluirlo en Fase 2 si es trivial (~50 LOC), postergar si surgen complicaciones**.

---

## Cambio 8 — Gating de edición en módulos

Para cada módulo de la tabla en `04-fase2-diseno.md` § 2.2, aplicar este patrón en cada handler que escribe:

**Antes:**
```js
const handleAdd = () => {
  setU(u => ({...u, ingresos: [...u.ingresos, newIngreso]}));
};
```

**Después:**
```js
import { useRole, guardEdit } from "../lib/RoleContext.jsx"; // arriba del archivo

// dentro del componente:
const {role} = useRole();

const handleAdd = () => {
  if (!guardEdit(role, showToast)) return; // showToast viene como prop o de context
  setU(u => ({...u, ingresos: [...u.ingresos, newIngreso]}));
};
```

**Lista de handlers a guardar (priorizada):**

| Módulo | Handlers a actualizar |
|---|---|
| `IngresosModule.jsx` | onAdd, onEdit, onDelete, onReorder |
| `GastosModule.jsx` | onAdd, onEdit, onDelete, onReorder, onAddCategory |
| `DeudasModule.jsx` | onAdd, onEdit, onDelete |
| `InversionesModule.jsx` | onAdd, onEdit, onDelete, onAddUnit, onEditUnit |
| `MetasModule.jsx` / `GoalsModuleUS.jsx` | onAdd, onEdit, onDelete, onMarkCompleted |
| `EditarAportesManuales.jsx` | onSave |
| `EditarDescuentosTributarios.jsx` | onSave |
| `AjustesFiscalesPersonalizados.jsx` | onSave |
| `CsvImport.jsx` | onImport (botón completo oculto si reader) |
| `DeclaracionUpload.jsx` | onUpload |

**NO tocar:**
- `SimuladorAvanzado.jsx`, `SimuladorTributario.jsx`, `SimuladorUS.jsx`, `TaxPlanningUS.jsx` — son escenarios no persistentes, readers pueden usarlos.
- `DashboardObservabilidad.jsx`, `DashboardFiscal.jsx`, `DashboardUS.jsx` — solo lectura por naturaleza.
- `AsesorIA.jsx` — chat, no escribe en `user_data`.

---

## Cambio 9 — Lazy call a `expire_managed_grace_period()` (post-01c)

Para que las cuentas con grace expirado se actualicen sin necesidad de cron diario, llamar la función SQL `expire_managed_grace_period()` cada vez que un usuario haga login. Es idempotente: si no hay cuentas que expirar, no toca nada.

**Ubicación:** dentro del componente App, en un `useEffect` separado que dispara después del login exitoso.

```js
// Lazy maintenance: si hay cuentas en grace expirado en el sistema, esta
// función las baja a basic. Idempotente. Solo dispara cuando el usuario
// está autenticado y el modo no es legacy.
useEffect(() => {
  if (!authUser?.id || isLegacy) return;
  if (!isSupabaseConfigured) return;
  supabase.rpc("expire_managed_grace_period").then(({ data, error }) => {
    if (error) {
      // Si la función no existe (01c no aplicado), no es error fatal
      if (error.code === "PGRST202" || error.code === "42883") return;
      console.warn("[lazy grace expire]", error);
      return;
    }
    if (data && data > 0) {
      console.log(`[lazy grace expire] ${data} cuenta(s) bajadas a basic`);
      refreshAccount(); // forzar re-fetch del useAccount con nuevo plan
    }
  });
}, [authUser?.id, isLegacy]);
```

> **Nota:** la función SQL afecta TODAS las cuentas en grace expirado del sistema (no solo la del usuario actual). Eso es intencional: cualquier usuario "ayuda" al sistema completo. Postgres maneja la concurrencia. Si se llega a querer scope de "solo mi cuenta", se modifica la función SQL.

---

## Cambio 10 — Account switcher mínimo (post-validación)

**Pre-requisito:** extender `useAccount.js` para devolver también la lista completa de membresías (no solo la cuenta activa) y respetar la cuenta seleccionada en `localStorage.fp3_active_account`.

### 10.1 Extender `useAccount.js`

Agregar al state inicial:
```js
const [state, setState] = useState({
  // ...campos existentes
  memberships: [],  // NUEVO: lista completa de membresías activas del user
});
```

En el path "happy" del hook (donde `data` ya tiene la lista), reemplazar la heurística de selección de cuenta:

```js
// ANTES:
const ownCuenta = data.find(m => m.accounts?.owner_user_id === authUser.id);
const cuentaActiva = ownCuenta || data[0];

// DESPUÉS:
const stored = typeof localStorage !== "undefined"
  ? localStorage.getItem("fp3_active_account") : null;
const storedMatch = stored && data.find(m => m.account_id === stored);
const ownCuenta = data.find(m => m.accounts?.owner_user_id === authUser.id);
const cuentaActiva = storedMatch || ownCuenta || data[0];
```

Y en el `setState` final, agregar:
```js
setState({
  // ...campos existentes
  memberships: data,  // NUEVO
});
```

> Aplicar el mismo patrón al fallback pre-01c (caso `PGRST204`/`42703`): extraer la lista filtrada en una variable `memberships = fallback.data || []` y devolverla.

### 10.2 Crear `src/components/AccountSwitcher.jsx`

```jsx
// Ubicación: src/components/AccountSwitcher.jsx
// Renderizado solo cuando memberships.length > 1.
import { useState, useRef, useEffect } from "react";

const C = {
  bg: "rgba(255,255,255,0.04)",
  border: "rgba(255,255,255,0.1)",
  txt: "#fafafa",
  txt2: "#a1a1aa",
  accent: "#3b82f6",
  hover: "rgba(255,255,255,0.06)",
};

export default function AccountSwitcher({ memberships, activeAccountId, onSwitch }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = memberships.find(m => m.account_id === activeAccountId) || memberships[0];
  if (!active) return null;
  const activeName = active.accounts?.display_name || "Cuenta sin nombre";
  const activeRole = active.role;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 6, padding: "6px 12px",
          color: C.txt, fontSize: 13, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <span>{activeName}</span>
        <span style={{ color: C.txt2, fontSize: 11 }}>· {activeRole}</span>
        <span style={{ color: C.txt2, fontSize: 10, marginLeft: 4 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 4,
          minWidth: 240, background: "#1a1a1d",
          border: `1px solid ${C.border}`, borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)", zIndex: 100,
        }}>
          {memberships.map(m => {
            const isActive = m.account_id === activeAccountId;
            return (
              <button
                key={m.account_id}
                onClick={() => { setOpen(false); if (!isActive) onSwitch(m.account_id); }}
                style={{
                  width: "100%", textAlign: "left",
                  background: isActive ? C.hover : "transparent",
                  border: "none", padding: "10px 14px",
                  color: C.txt, fontSize: 13, cursor: isActive ? "default" : "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = C.hover; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div>
                  <div>{m.accounts?.display_name || "Sin nombre"}</div>
                  <div style={{ color: C.txt2, fontSize: 11 }}>{m.role}</div>
                </div>
                {isActive && <span style={{ color: C.accent, fontSize: 12 }}>● activo</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### 10.3 Integrar en App.jsx

Agregar al import (junto a RoleBanner):
```js
import AccountSwitcher from "./components/AccountSwitcher";
```

Extender el destructuring de `useAccount` (modifica el Cambio 4):
```js
const {
  accountId, role, isLegacy,
  plan, maxMembers, displayName,
  managedByAdvisor, managedTier,
  subscriptionStatus, graceUntil,
  memberships,                       // NUEVO
  loading: accountLoading,
  refresh: refreshAccount,
} = useAccount(authUser, supabase);
```

Handler de switch (función nueva en App.jsx, junto a otros handlers):
```js
const handleAccountSwitch = useCallback((newAccountId) => {
  // Persistir elección y limpiar cache de la cuenta vieja
  localStorage.setItem("fp3_active_account", newAccountId);
  localStorage.removeItem("fp3");  // invalida cache local
  // Limpiar también el state local de datos para forzar reload visible
  setU(null);
  // Disparar refetch del hook (volverá a leer con la nueva cuenta seleccionada)
  refreshAccount();
}, [refreshAccount]);
```

Renderizar el switcher en el header (modifica el Cambio 7):
```jsx
{!isLegacy && memberships?.length > 1 && viewMode !== "client" && (
  <AccountSwitcher
    memberships={memberships}
    activeAccountId={accountId}
    onSwitch={handleAccountSwitch}
  />
)}
```

> **Ubicación recomendada del switcher:** en el topbar, cerca del menú de usuario / logout. Mantenerlo discreto. Si solo hay 1 membresía, NO se renderiza (la condición `memberships?.length > 1` lo cubre).

### 10.4 Verificación específica del switcher

```
[ ] User con 1 cuenta → AccountSwitcher NO se renderiza
[ ] User con 2 cuentas → switcher visible en header
[ ] Click switcher → dropdown muestra ambas cuentas con role
[ ] Click en cuenta inactiva → cache fp3 limpio, datos nuevos cargan
[ ] Reload página → cuenta seleccionada persiste vía fp3_active_account
[ ] Modo asesor (viewMode='client') → switcher NO se renderiza
```

---

## Verificación post-implementación

```
[ ] git diff src/App.jsx | wc -l          → debería ser ~70 líneas modificadas
[ ] git diff src/components/ | wc -l       → ~180 líneas modificadas (gating + AccountSwitcher)
[ ] git diff src/lib/useAccount.js | wc -l → ~15 líneas (extender memberships + storedMatch)
[ ] python3 audit.py                       → 19/19 OK
[ ] npm run build                          → ✓ built (warning chunk size pre-existente OK)
[ ] grep -c "guardEdit" src/components/    → ≥ 25 ocurrencias (multiple handlers × 10 módulos)
[ ] grep -c "AccountSwitcher" src/         → ≥ 2 (componente + import en App.jsx)
[ ] curl -sI https://finpathia.com         → tras push, esperar 90-120s y verificar HTTP 200
```

## Smoke tests post-deploy (resumen — detalle en 04-fase2-diseno.md § 4)

Mínimo: usuario existente login OK, edita y guarda OK, refresca y persiste. Con esos 3 verificados se puede dejar el resto para la sesión siguiente.

Crítico (bloquea merge si falla):
- Asesor login → workspace de clientes carga
- Asesor entra a un cliente → datos cargan
- Asesor edita cliente → guardado funciona

Estos 3 confirman que el refactor no rompió el flujo asesor existente. El Cambio 3 es el más sensible aquí: el `accountIdRef.current` debe ser `null` en modo asesor-cliente para que caiga al fallback legacy del upsert. Si la lógica está bien, esos 3 tests pasan limpio.
