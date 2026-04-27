// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · RoleContext — gating de edición por rol multi-usuario (Fase 2)
// ─────────────────────────────────────────────────────────────────────────
// Provee a todo el árbol de componentes el rol activo del usuario en la
// cuenta actual. Componentes consumen via `useRole()` y handlers críticos
// usan `guardEdit()` para bloquear escrituras de readers.
//
// DISEÑO DEFENSIVO:
//   - Sin provider envolvente, useRole() devuelve { role: 'admin' } por
//     default. Esto preserva el comportamiento legacy (un usuario = admin
//     de su propia cuenta) hasta que App.jsx envuelva el árbol con el
//     RoleProvider.
//   - guardEdit() es opcional: módulos que no lo usan siguen funcionando
//     (los readers podrán hacer cambios en estado local pero no se persisten
//     porque RLS bloquea el UPDATE en Supabase). Mejor UX cuando se llama.
//
// USO TÍPICO:
//
//   // En App.jsx, después de useAccount():
//   const {accountId, role, isLegacy} = useAccount(authUser, supabase);
//   return (
//     <RoleProvider value={{role, isLegacy, accountId}}>
//       {/* árbol existente */}
//     </RoleProvider>
//   );
//
//   // En cualquier componente:
//   const {role, isReader, isAdmin} = useRole();
//   const handleAdd = () => {
//     if (!guardEdit(role, showToast)) return;
//     // ...lógica de escritura
//   };
//
// ═════════════════════════════════════════════════════════════════════════

import { createContext, useContext, useMemo } from "react";

// Default seguro: comportamiento legacy si no hay provider envolvente
const DEFAULT_VALUE = {
  role: "admin",
  isLegacy: true,
  accountId: null,
};

export const RoleContext = createContext(DEFAULT_VALUE);

/**
 * Provider que envuelve el árbol de la app. Memoiza el value para que
 * los consumidores no se re-rendericen si role/accountId no cambian.
 *
 * @param {{role: 'admin'|'reader', isLegacy: boolean, accountId: string|null}} value
 * @param {React.ReactNode} children
 */
export function RoleProvider({ value, children }) {
  const memoValue = useMemo(
    () => ({
      role: value?.role || "admin",
      isLegacy: value?.isLegacy ?? true,
      accountId: value?.accountId || null,
    }),
    [value?.role, value?.isLegacy, value?.accountId]
  );
  return <RoleContext.Provider value={memoValue}>{children}</RoleContext.Provider>;
}

/**
 * Hook principal. Devuelve el rol activo y derivados booleanos.
 * Si no hay provider, devuelve default seguro (admin/legacy).
 *
 * @returns {{
 *   role: 'admin'|'reader',
 *   isLegacy: boolean,
 *   accountId: string|null,
 *   isAdmin: boolean,
 *   isReader: boolean,
 *   canEdit: boolean
 * }}
 */
export function useRole() {
  const ctx = useContext(RoleContext);
  return {
    role: ctx.role,
    isLegacy: ctx.isLegacy,
    accountId: ctx.accountId,
    isAdmin: ctx.role === "admin",
    isReader: ctx.role === "reader",
    // canEdit: es admin de cuenta o estamos en modo legacy (sin provider)
    canEdit: ctx.role === "admin" || ctx.isLegacy,
  };
}

/**
 * Helper para handlers de escritura. Llamar al inicio de cada handler
 * que modifica datos persistidos. Si devuelve false, abortar.
 *
 * @param {string} role - el rol activo (de useRole())
 * @param {function} showToast - función de toast del componente padre (opcional)
 * @returns {boolean} - true si puede editar, false si es reader
 *
 * @example
 *   const handleAdd = () => {
 *     if (!guardEdit(role, showToast)) return;
 *     setU(u => ({...u, ingresos: [...u.ingresos, newIngreso]}));
 *   };
 */
export function guardEdit(role, showToast) {
  if (role === "reader") {
    if (typeof showToast === "function") {
      showToast("Solo lectura · pedile al admin de la cuenta que actualice este dato");
    }
    return false;
  }
  return true;
}

/**
 * HOC opcional para deshabilitar componentes enteros para readers.
 * No se usa en Fase 2 inicial, pero queda disponible para Fase 3.
 *
 * @example
 *   const EditableButton = withRoleGuard(({onClick}) => <button onClick={onClick}>Editar</button>);
 *   // Para readers, renderiza null (o el fallback que se le pase).
 */
export function withRoleGuard(Component, fallback = null) {
  return function GuardedComponent(props) {
    const { isReader } = useRole();
    if (isReader) return fallback;
    return <Component {...props} />;
  };
}
