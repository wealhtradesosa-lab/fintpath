// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · Hook useAccount() — Multi-usuario Pro Familiar (Fase 2)
// ─────────────────────────────────────────────────────────────────────────
// Determina la cuenta activa del usuario y su rol (admin / reader).
//
// DISEÑO DEFENSIVO:
//   - Si la migration de schema NO está aplicada (tablas nuevas no existen),
//     devuelve { accountId: null, role: 'admin', isLegacy: true }
//   - Si SÍ está aplicada, busca account_members del usuario y devuelve el
//     primer rol activo encontrado.
//   - Si el usuario tiene múltiples cuentas (futuro), por defecto usa la
//     primera que sea suya como owner; sino la primera que encuentre.
//
// USO:
//   const { accountId, role, isLegacy, loading, refresh } = useAccount(authUser);
//   if (role === 'reader') { /* deshabilitar edición */ }
//
// ═════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";

/**
 * @param {object} authUser - usuario de Supabase Auth (auth.users row)
 * @param {object} supabase - cliente de Supabase
 * @returns {{
 *   accountId: string | null,
 *   role: 'admin' | 'reader',
 *   isLegacy: boolean,
 *   loading: boolean,
 *   error: Error | null,
 *   refresh: () => void
 * }}
 */
export function useAccount(authUser, supabase) {
  const [state, setState] = useState({
    accountId: null,
    role: "admin", // default optimista para legacy
    isLegacy: true,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      if (!authUser?.id || !supabase) {
        setState(s => ({ ...s, loading: false }));
        return;
      }

      try {
        // Intento leer account_members. Si la tabla no existe (legacy), Supabase
        // devuelve un error específico que capturamos para el modo defensivo.
        const { data, error } = await supabase
          .from("account_members")
          .select("account_id, role, status, accounts(id, plan, display_name, owner_user_id)")
          .eq("user_id", authUser.id)
          .eq("status", "active");

        if (cancelled) return;

        if (error) {
          // Tabla no existe (PGRST205) o RLS la oculta → modo legacy
          if (error.code === "PGRST205" || error.code === "42P01") {
            setState({
              accountId: null,
              role: "admin",
              isLegacy: true,
              loading: false,
              error: null,
            });
            return;
          }
          throw error;
        }

        if (!data || data.length === 0) {
          // No hay membresía activa pero la tabla existe → caso raro.
          // Probablemente migration aplicada pero falló la creación de cuenta personal.
          // Mantenemos modo legacy para que el cliente no crashee.
          setState({
            accountId: null,
            role: "admin",
            isLegacy: true,
            loading: false,
            error: null,
          });
          return;
        }

        // Elegir la cuenta activa: priorizar la cuenta donde el usuario ES owner
        const ownCuenta = data.find(m => m.accounts?.owner_user_id === authUser.id);
        const cuentaActiva = ownCuenta || data[0];

        setState({
          accountId: cuentaActiva.account_id,
          role: cuentaActiva.role, // 'admin' | 'reader'
          isLegacy: false,
          loading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        console.error("[useAccount] error loading account:", e);
        // En caso de error inesperado, modo legacy para no bloquear al usuario
        setState({
          accountId: null,
          role: "admin",
          isLegacy: true,
          loading: false,
          error: e,
        });
      }
    }

    loadAccount();
    return () => { cancelled = true; };
  }, [authUser?.id, supabase, tick]);

  return { ...state, refresh };
}

/**
 * Helper sincrónico: ¿el usuario actual es admin?
 * Útil cuando ya tenés el state del hook arriba en el árbol de componentes
 * y querés derivar permisos sin volver a hacer el query.
 */
export function isAdmin(accountState) {
  return !accountState || accountState.role === "admin";
}

/**
 * Helper sincrónico: ¿el usuario actual es solo lectura?
 */
export function isReader(accountState) {
  return accountState?.role === "reader";
}
