-- ═══════════════════════════════════════════════════════════════════════════
-- Trigger: sincronizar accounts.max_members con accounts.plan
--
-- Aplicado en producción como migration:
--   - multi_usuario_sync_max_members_with_plan
--
-- Cuando un user actualiza accounts.plan (típicamente vía webhook de Stripe
-- en Fase 6, o vía SQL manual en testing), este trigger automáticamente
-- ajusta max_members al valor correspondiente del plan según la tabla
-- definida en max_members_for_plan() (08-fase3-rpcs-invitations.sql):
--   basic        -> 1
--   pro          -> 3
--   pro_familiar -> 10
--   managed      -> 5  (NO se aplica, lo maneja promote_account_to_managed)
--   default      -> 1
--
-- Esto desacopla el copy de la página de planes ("hasta 3 usuarios") de
-- la implementación: cuando el flujo de billing actualice el plan, la
-- capacidad se ajusta automáticamente.
--
-- Cuentas managed están excluidas: tienen su propia lógica vía
-- promote_account_to_managed() (PATCH 6 del 01c) que setea max_members
-- según el tier del asesor (starter/professional/boutique).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_max_members_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND NEW.plan <> 'managed' THEN
    NEW.max_members := public.max_members_for_plan(NEW.plan);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_max_members_trigger ON public.accounts;
CREATE TRIGGER sync_max_members_trigger
BEFORE UPDATE OF plan ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_max_members_on_plan_change();
