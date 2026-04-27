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
// Fase 2: hook multi-cuenta. Si la migración Fase 1 está aplicada, devuelve
// accountId + role. Si no (modo legacy), devuelve isLegacy=true.
const{accountId,role,isLegacy,loading:accountLoading,refresh:refreshAccount}=useAccount(authUser,supabase);

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

Hay **2 llamadas a `sL()`** en App.jsx que deben recibir `accountId`. Buscarlas con:

```bash
grep -n "await sL(" src/App.jsx
```

**Cambio en cada una:**

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

## Cambio 7 — Envolver el árbol con `RoleProvider`

Buscar el `return (` principal del componente App. Probablemente alrededor de la línea 1000-1500.

**Inmediatamente dentro del fragment/div raíz**, envolver con:

```jsx
<RoleProvider value={{role, isLegacy, accountId}}>
  {/* Banner solo si NO estamos en modo asesor-cliente y el rol es reader */}
  {!isLegacy && role==="reader" && viewMode!=="client" && (
    <RoleBanner accountName={/* leer de accounts.display_name si está disponible */} />
  )}
  {/* ...todo el árbol existente... */}
</RoleProvider>
```

> **Nota sobre `accountName`:** `useAccount` ya hace JOIN con `accounts(display_name)`. Para exponerlo, agregar `displayName` al return del hook (cambio menor en `useAccount.js`). Por ahora puede pasarse `undefined` y el banner usa el fallback genérico.

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

## Verificación post-implementación

```
[ ] git diff src/App.jsx | wc -l          → debería ser ~50 líneas modificadas
[ ] git diff src/components/ | wc -l       → ~100 líneas modificadas (gating en 10 módulos)
[ ] python3 audit.py                       → 19/19 OK
[ ] npm run build                          → ✓ built (warning chunk size pre-existente OK)
[ ] grep -c "guardEdit" src/components/    → ≥ 25 ocurrencias (multiple handlers × 10 módulos)
[ ] curl -sI https://finpathia.com         → tras push, esperar 90-120s y verificar HTTP 200
```

## Smoke tests post-deploy (resumen — detalle en 04-fase2-diseno.md § 4)

Mínimo: usuario existente login OK, edita y guarda OK, refresca y persiste. Con esos 3 verificados se puede dejar el resto para la sesión siguiente.

Crítico (bloquea merge si falla):
- Asesor login → workspace de clientes carga
- Asesor entra a un cliente → datos cargan
- Asesor edita cliente → guardado funciona

Estos 3 confirman que el refactor no rompió el flujo asesor existente. El Cambio 3 es el más sensible aquí: el `accountIdRef.current` debe ser `null` en modo asesor-cliente para que caiga al fallback legacy del upsert. Si la lógica está bien, esos 3 tests pasan limpio.
