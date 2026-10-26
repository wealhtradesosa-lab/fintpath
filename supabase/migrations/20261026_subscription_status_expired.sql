-- ═══════════════════════════════════════════════════════════════════
-- 2026-10-26 — accounts_subscription_status_check admite 'expired'
--
-- PROBLEMA (verificado en producción, no deducido del repo):
--   expire_canceled_accounts() —la RPC del cron diario— hace
--     SET subscription_status = 'expired', plan = 'free', max_members = 1
--   pero el CHECK desplegado solo permitía 4 valores:
--     active, grace, past_due, canceled
--   Así que el UPDATE viola la restricción y la función entera revienta en
--   la PRIMERA cuenta vencida. El cron corría todos los días sin hacer nada.
--
--   Al 26-oct-2026: 1 cuenta de 130 estaba atascada (cancelada, gracia
--   vencida, todavía en plan de pago). Habría pasado con cada cancelación.
--
-- POR QUÉ ESTA MIGRACIÓN Y NO EL PR #36:
--   El #36 trae este arreglo junto con una reescritura de _sync_account_plan,
--   los handlers de Stripe, create_invitation, enforce_max_members y
--   activate_pro_familiar, construida para la matriz Básico/Pro/Pro Familiar.
--   Hoy se vende UN solo plan. Esto es el arreglo aislado; el resto del #36
--   sigue abierto para decidirse aparte.
--
-- SEGURIDAD DEL CAMBIO:
--   Ampliar un CHECK no puede fallar sobre las filas existentes: ninguna
--   tiene 'expired' (es justamente lo que el CHECK impedía escribir). Los
--   4 valores anteriores se conservan.
--
-- VERIFICAR DESPUÉS DE APLICAR:
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conname = 'accounts_subscription_status_check';
--   -- debe listar los 5 valores
--   select * from expire_canceled_accounts();
--   -- debe devolver la(s) cuenta(s) atascada(s) con action='expired_to_free'
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_subscription_status_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY[
    'active'::text,
    'grace'::text,
    'past_due'::text,
    'canceled'::text,
    'expired'::text
  ]));

-- ─── REVERSA (vuelve a romper el cron; solo para emergencias) ───────
-- ALTER TABLE public.accounts DROP CONSTRAINT accounts_subscription_status_check;
-- ALTER TABLE public.accounts ADD CONSTRAINT accounts_subscription_status_check
--   CHECK (subscription_status = ANY (ARRAY['active'::text,'grace'::text,'past_due'::text,'canceled'::text]));
-- -- Ojo: fallaría si para entonces ya hay filas en 'expired'.
