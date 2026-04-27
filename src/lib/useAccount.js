// ═════════════════════════════════════════════════════════════════════════
// FINPATHIA · Hook useAccount() — Multi-usuario Pro Familiar (Fase 2)
// ─────────────────────────────────────────────────────────────────────────
// Determina la cuenta activa del usuario, su rol (admin / reader), y los
// metadatos de plan/managed/subscription para decisiones de UI.
//
// DISEÑO DEFENSIVO con 3 niveles de fallback:
//   1. Migration 01 + 01b + 01c aplicadas: SELECT extendido devuelve todos
//      los campos (plan, max_members, managed_*, subscription_status, etc).
//   2. Migration 01 + 01b aplicadas pero NO 01c: SELECT extendido falla por
//      columna inexistente (PGRST204 / 42703). Reintenta con SELECT mínimo
//      del shape pre-01c y completa los campos nuevos con defaults.
//   3. Ninguna migration aplicada (legacy): SELECT entero falla con PGRST205
//      o 42P01. Devuelve isLegacy=true con defaults.
//
// USO:
//   const { accountId, role, isLegacy, plan, maxMembers, managedByAdvisor,
//           subscriptionStatus, graceUntil } = useAccount(authUser, supabase);
//
//   if (role === 'reader') { /* deshabilitar edición */ }
//   if (subscriptionStatus === 'grace') { /* mostrar banner de grace */ }
//   if (managedByAdvisor && account_members.length >= maxMembers) {
//     /* deshabilitar botón "Invitar miembro" */
//   }
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
 *   plan: 'basic' | 'pro' | 'pro_familiar' | 'managed' | null,
 *   maxMembers: number,
 *   displayName: string | null,
 *   managedByAdvisor: boolean,
 *   managedTier: 'starter' | 'professional' | 'boutique' | null,
 *   subscriptionStatus: 'active' | 'grace' | 'past_due' | 'canceled',
 *   graceUntil: Date | null,
 *   memberships: Array<{account_id: string, role: string, status: string, accounts: object}>,
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
    plan: null,
    maxMembers: 1,
    displayName: null,
    managedByAdvisor: false,
    managedTier: null,
    subscriptionStatus: "active",
    graceUntil: null,
    memberships: [], // lista completa de membresías activas (para AccountSwitcher)
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
        // SELECT extendido (post-01c): incluye campos de plan/managed/subscription
        // para que la UI pueda mostrar grace banners, límites de invitación, etc.
        // Si las columnas del 01c no existen aún (migración 01c no aplicada),
        // los campos llegan como undefined y el cliente cae al comportamiento
        // pre-01c (sin información extendida pero funcional).
        const { data, error } = await supabase
          .from("account_members")
          .select(`
            account_id,
            role,
            status,
            accounts (
              id,
              plan,
              display_name,
              owner_user_id,
              max_members,
              managed_by_advisor_id,
              managed_tier,
              subscription_status,
              grace_until
            )
          `)
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
              plan: null,
              maxMembers: 1,
              displayName: null,
              managedByAdvisor: false,
              managedTier: null,
              subscriptionStatus: "active",
              graceUntil: null,
              memberships: [],
              loading: false,
              error: null,
            });
            return;
          }
          // Si el error es de columnas inexistentes (PGRST204), reintentar SELECT
          // mínimo del shape pre-01c. Esto cubre el período transitorio entre
          // 01b aplicado y 01c aún no aplicado.
          if (error.code === "PGRST204" || error.code === "42703") {
            const fallback = await supabase
              .from("account_members")
              .select("account_id, role, status, accounts(id, plan, display_name, owner_user_id)")
              .eq("user_id", authUser.id)
              .eq("status", "active");
            if (cancelled) return;
            if (fallback.error) throw fallback.error;
            const fbData = fallback.data || [];
            // Aplicar misma lógica de selección que en el path happy
            const stored = (typeof localStorage !== "undefined")
              ? localStorage.getItem("fp3_active_account")
              : null;
            const storedMatch = stored && fbData.find(m => m.account_id === stored);
            const ownCuenta = fbData.find(m => m.accounts?.owner_user_id === authUser.id);
            const cuentaActiva = storedMatch || ownCuenta || fbData[0];
            if (!cuentaActiva) {
              setState(s => ({ ...s, isLegacy: true, memberships: [], loading: false, error: null }));
              return;
            }
            setState({
              accountId: cuentaActiva.account_id,
              role: cuentaActiva.role,
              isLegacy: false,
              plan: cuentaActiva.accounts?.plan || "basic",
              maxMembers: 1,
              displayName: cuentaActiva.accounts?.display_name || null,
              managedByAdvisor: false,
              managedTier: null,
              subscriptionStatus: "active",
              graceUntil: null,
              memberships: fbData,
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
            plan: null,
            maxMembers: 1,
            displayName: null,
            managedByAdvisor: false,
            managedTier: null,
            subscriptionStatus: "active",
            graceUntil: null,
            memberships: [],
            loading: false,
            error: null,
          });
          return;
        }

        // Elegir la cuenta activa:
        // 1. Si el usuario eligió una cuenta vía AccountSwitcher (persistida
        //    en localStorage.fp3_active_account) y sigue siendo miembro, usarla.
        // 2. Sino, priorizar la cuenta donde el usuario ES owner.
        // 3. Sino, primera membresía.
        const stored = (typeof localStorage !== "undefined")
          ? localStorage.getItem("fp3_active_account")
          : null;
        const storedMatch = stored && data.find(m => m.account_id === stored);
        const ownCuenta = data.find(m => m.accounts?.owner_user_id === authUser.id);
        const cuentaActiva = storedMatch || ownCuenta || data[0];
        const acc = cuentaActiva.accounts || {};

        setState({
          accountId: cuentaActiva.account_id,
          role: cuentaActiva.role, // 'admin' | 'reader'
          isLegacy: false,
          plan: acc.plan || "basic",
          maxMembers: typeof acc.max_members === "number" ? acc.max_members : 1,
          displayName: acc.display_name || null,
          managedByAdvisor: acc.plan === "managed",
          managedTier: acc.managed_tier || null,
          subscriptionStatus: acc.subscription_status || "active",
          graceUntil: acc.grace_until ? new Date(acc.grace_until) : null,
          memberships: data, // lista completa para AccountSwitcher
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
          plan: null,
          maxMembers: 1,
          displayName: null,
          managedByAdvisor: false,
          managedTier: null,
          subscriptionStatus: "active",
          graceUntil: null,
          memberships: [],
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
