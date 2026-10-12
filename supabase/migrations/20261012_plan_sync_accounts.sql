-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 2026-10-12 — SINCRONIZAR accounts.plan CON EL PAGO EN STRIPE
--
-- NO APLICADA. Se aplica a prod solo con el OK de Luis.
--
-- PROBLEMA: al pagar Pro o Básico, el webhook llama a
-- update_user_plan_after_stripe(), que solo escribía user_data.plan y el
-- blob. accounts.plan quedaba en 'free' y accounts.max_members en 1. Como
-- los cupos (enforce_max_members, create_invitation) y la cuota de IA
-- (_cuotaIA.cjs) leen accounts, un Pro pagando quedaba con 1 cupo en vez
-- de 3, con la cuota de IA del plan gratis y con «Plan free · Cuenta llena»
-- en Mi cuenta.
--
-- CAMBIOS:
--   1. max_members_for_plan: 'basico' y 'free' explícitos (=1).
--   2. Función auxiliar _sync_account_plan(): pone accounts.plan (y
--      max_members, estado activo, sin grace) en la cuenta PROPIA del
--      usuario (user_data.account_id con owner_user_id = usuario). Nunca
--      toca cuentas pro_familiar ni managed.
--   3. update_user_plan_after_stripe y la rama basico↔pro de
--      handle_subscription_updated la llaman.
--   4. handle_subscription_canceled: Pro pasa a 'canceled' con 30 días de
--      gracia (igual que Pro Familiar). Al vencer, expire_canceled_accounts
--      (cron diario, sin cambios) lo baja a free con 1 cupo. Los miembros
--      que ya estaban se quedan (enforce_max_members solo frena altas), pero
--      create_invitation ya no deja invitar a nadie más.
--   5. CHECK de subscription_status admite 'expired'. Sin esto,
--      expire_canceled_accounts fallaba en la primera cuenta vencida.
--   6. Backfill: cuentas propias en 'free' cuyo user_data dice basico/pro,
--      y cuentas Pro con menos de 3 cupos (0 filas al 11-oct-2026).
--
-- FUERA DE ALCANCE: cupos durante la prueba (pendiente de Luis), Básico
-- cancelado (sigue como antes: sin downgrade automático), downgrade de
-- Pro Familiar a Pro/Básico (sigue dejando la cuenta intacta).
-- Rollback al final, comentado, con las definiciones de prod del 11-oct-2026.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Cupos por plan ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.max_members_for_plan(p_plan text)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN CASE p_plan
    WHEN 'free'         THEN 1
    WHEN 'basic'        THEN 1
    WHEN 'basico'       THEN 1
    WHEN 'pro'          THEN 3
    WHEN 'pro_familiar' THEN 10
    WHEN 'managed'      THEN 5  -- nominal; real depende del tier del asesor
    ELSE 1
  END;
END;
$function$;

-- ─── 2. Estado 'expired' permitido ───────────────────────────────────
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_subscription_status_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY['active'::text, 'grace'::text, 'past_due'::text, 'canceled'::text, 'expired'::text]));

-- ─── 3. Auxiliar: plan pagado → cuenta propia ────────────────────────
-- Solo cuentas propias en free/basic/basico/pro. Pone max_members a mano
-- (el trigger sync_max_members_on_plan_change solo actúa si el plan cambia).
CREATE OR REPLACE FUNCTION public._sync_account_plan(p_user_id uuid, p_plan text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_account_id UUID;
BEGIN
  IF p_plan NOT IN ('basico', 'pro') THEN
    RAISE EXCEPTION '_sync_account_plan: plan inválido %', p_plan;
  END IF;
  UPDATE public.accounts a
  SET plan = p_plan,
      max_members = public.max_members_for_plan(p_plan),
      subscription_status = 'active',
      grace_until = NULL,
      updated_at = NOW()
  FROM public.user_data ud
  WHERE ud.id = p_user_id
    AND a.id = ud.account_id
    AND a.owner_user_id = p_user_id
    AND a.plan IN ('free', 'basic', 'basico', 'pro')
  RETURNING a.id INTO v_account_id;
  RETURN v_account_id;
END;
$function$;
REVOKE ALL ON FUNCTION public._sync_account_plan(uuid, text) FROM PUBLIC, anon, authenticated;

-- ─── 4. Webhook checkout.session.completed (Básico / Pro) ────────────
CREATE OR REPLACE FUNCTION public.update_user_plan_after_stripe(p_user_id uuid, p_plan text, p_stripe_customer_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_found BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_plan NOT IN ('basico', 'pro') THEN
    RAISE EXCEPTION 'plan inválido: % (debe ser basico o pro)', p_plan;
  END IF;

  UPDATE user_data
  SET plan = p_plan,
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      data = jsonb_set(data, '{p,plan}', to_jsonb(p_plan), true),
      updated_at = NOW()
  WHERE id = p_user_id;
  v_found := FOUND;

  -- 12-oct-2026: también la cuenta (cupos y cuota de IA leen accounts).
  IF v_found THEN
    PERFORM public._sync_account_plan(p_user_id, p_plan);
  END IF;

  RETURN v_found;
END;
$function$;

-- ─── 5. Webhook customer.subscription.updated ────────────────────────
-- Igual que en prod, salvo la rama basico↔pro, que ahora también
-- sincroniza la cuenta.
CREATE OR REPLACE FUNCTION public.handle_subscription_updated(p_stripe_customer_id text, p_new_plan text, p_status text)
 RETURNS TABLE(account_id uuid, user_id uuid, action text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_plan TEXT;
  v_account_id UUID;
BEGIN
  IF p_stripe_customer_id IS NULL OR p_new_plan IS NULL THEN
    RAISE EXCEPTION 'p_stripe_customer_id y p_new_plan son requeridos';
  END IF;

  SELECT ud.id, ud.plan, ud.account_id
  INTO v_user_id, v_current_plan, v_account_id
  FROM user_data ud
  WHERE ud.stripe_customer_id = p_stripe_customer_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user_data found for stripe_customer_id %', p_stripe_customer_id;
    RETURN;
  END IF;

  IF p_status = 'active' AND v_account_id IS NOT NULL THEN
    UPDATE accounts
    SET subscription_status = 'active',
        grace_until = NULL,
        updated_at = NOW()
    WHERE id = v_account_id
      AND subscription_status = 'canceled';
  END IF;

  IF v_current_plan IS DISTINCT FROM p_new_plan THEN
    IF p_new_plan = 'pro_familiar' AND (v_current_plan IS NULL OR v_current_plan <> 'pro_familiar') THEN
      v_account_id := activate_pro_familiar(v_user_id, p_stripe_customer_id, 'Mi cuenta');
      RETURN QUERY SELECT v_account_id, v_user_id, 'upgraded_to_pro_familiar'::text;

    ELSIF v_current_plan = 'pro_familiar' AND p_new_plan IN ('basico', 'pro') THEN
      UPDATE user_data
      SET plan = p_new_plan,
          data = jsonb_set(data, '{p,plan}', to_jsonb(p_new_plan), true),
          updated_at = NOW()
      WHERE id = v_user_id;
      RETURN QUERY SELECT v_account_id, v_user_id, 'downgraded_keep_account'::text;

    ELSIF p_new_plan IN ('basico', 'pro') THEN
      UPDATE user_data
      SET plan = p_new_plan,
          data = jsonb_set(data, '{p,plan}', to_jsonb(p_new_plan), true),
          updated_at = NOW()
      WHERE id = v_user_id;
      -- 12-oct-2026: la cuenta también (Pro → 3 cupos, Básico → 1; si baja
      -- de Pro a Básico con más miembros, se quedan pero no entra nadie más).
      PERFORM public._sync_account_plan(v_user_id, p_new_plan);
      RETURN QUERY SELECT v_account_id, v_user_id, ('plan_changed_to_' || p_new_plan)::text;
    END IF;
  ELSE
    RETURN QUERY SELECT v_account_id, v_user_id, 'no_change'::text;
  END IF;
END;
$function$;

-- ─── 6. Webhook customer.subscription.deleted ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_subscription_canceled(p_stripe_customer_id text, p_canceled_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(account_id uuid, user_id uuid, action text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_stripe_customer_id IS NULL THEN
    RAISE EXCEPTION 'p_stripe_customer_id no puede ser NULL';
  END IF;

  -- Caso 1: Pro Familiar → canceled + 30 días de gracia.
  RETURN QUERY
  UPDATE accounts a
  SET subscription_status = 'canceled',
      grace_until = p_canceled_at + INTERVAL '30 days',
      updated_at = NOW()
  FROM user_data ud
  WHERE ud.stripe_customer_id = p_stripe_customer_id
    AND ud.account_id = a.id
    AND a.plan = 'pro_familiar'
    AND a.subscription_status <> 'canceled'
  RETURNING a.id, ud.id, 'pro_familiar_marked_canceled'::text;

  -- Caso 2 (12-oct-2026): Pro → igual que Pro Familiar. Al vencer la
  -- gracia, expire_canceled_accounts lo baja a free con 1 cupo; los
  -- miembros existentes se quedan y no se puede invitar a nadie más.
  RETURN QUERY
  UPDATE accounts a
  SET subscription_status = 'canceled',
      grace_until = p_canceled_at + INTERVAL '30 days',
      updated_at = NOW()
  FROM user_data ud
  WHERE ud.stripe_customer_id = p_stripe_customer_id
    AND ud.account_id = a.id
    AND a.owner_user_id = ud.id
    AND a.plan = 'pro'
    AND a.subscription_status <> 'canceled'
  RETURNING a.id, ud.id, 'pro_marked_canceled'::text;

  -- Caso 3: Básico legacy → sin cambios (sin downgrade automático).

  INSERT INTO account_audit_log (account_id, user_id, action, entity_type, diff)
  SELECT
    a.id, ud.id, 'subscription_canceled', 'subscription',
    jsonb_build_object(
      'stripe_customer_id', p_stripe_customer_id,
      'grace_until', p_canceled_at + INTERVAL '30 days'
    )
  FROM accounts a
  JOIN user_data ud ON ud.account_id = a.id
  WHERE ud.stripe_customer_id = p_stripe_customer_id
    AND a.plan IN ('pro_familiar', 'pro');
END;
$function$;

-- ─── 7. Backfill ─────────────────────────────────────────────────────
-- a) Cuenta propia en free pero user_data dice basico/pro (pagó y el
--    webhook no sincronizó la cuenta). 0 filas al 11-oct-2026.
UPDATE public.accounts a
SET plan = ud.plan,
    max_members = public.max_members_for_plan(ud.plan),
    updated_at = NOW()
FROM public.user_data ud
WHERE ud.account_id = a.id
  AND a.owner_user_id = ud.id
  AND a.plan = 'free'
  AND ud.plan IN ('basico', 'pro');

-- b) Cuentas Pro con menos cupos de los que da el plan. 0 filas al 11-oct-2026.
UPDATE public.accounts
SET max_members = public.max_members_for_plan('pro'),
    updated_at = NOW()
WHERE plan = 'pro'
  AND max_members < public.max_members_for_plan('pro');

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (manual). Restaura las definiciones de prod del 11-oct-2026.
-- NOTA: el backfill no se revierte (solo corrige cuentas que ya pagaban).
--
-- ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_subscription_status_check;
-- ALTER TABLE public.accounts ADD CONSTRAINT accounts_subscription_status_check
--   CHECK (subscription_status = ANY (ARRAY['active'::text, 'grace'::text, 'past_due'::text, 'canceled'::text]));
-- CREATE OR REPLACE FUNCTION public.max_members_for_plan(p_plan text)
--  RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- BEGIN
--   RETURN CASE p_plan
--     WHEN 'basic'        THEN 1
--     WHEN 'pro'          THEN 3
--     WHEN 'pro_familiar' THEN 10
--     WHEN 'managed'      THEN 5
--     ELSE 1
--   END;
-- END;
-- $function$;
-- CREATE OR REPLACE FUNCTION public.update_user_plan_after_stripe(p_user_id uuid, p_plan text, p_stripe_customer_id text)
--  RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- BEGIN
--   IF p_user_id IS NULL OR p_plan NOT IN ('basico', 'pro') THEN
--     RAISE EXCEPTION 'plan inválido: % (debe ser basico o pro)', p_plan;
--   END IF;
--   UPDATE user_data
--   SET plan = p_plan,
--       stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
--       data = jsonb_set(data, '{p,plan}', to_jsonb(p_plan), true),
--       updated_at = NOW()
--   WHERE id = p_user_id;
--   RETURN FOUND;
-- END;
-- $function$;
-- CREATE OR REPLACE FUNCTION public.handle_subscription_updated(p_stripe_customer_id text, p_new_plan text, p_status text)
--  RETURNS TABLE(account_id uuid, user_id uuid, action text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_user_id UUID;
--   v_current_plan TEXT;
--   v_account_id UUID;
-- BEGIN
--   IF p_stripe_customer_id IS NULL OR p_new_plan IS NULL THEN
--     RAISE EXCEPTION 'p_stripe_customer_id y p_new_plan son requeridos';
--   END IF;
--   SELECT ud.id, ud.plan, ud.account_id INTO v_user_id, v_current_plan, v_account_id
--   FROM user_data ud WHERE ud.stripe_customer_id = p_stripe_customer_id LIMIT 1;
--   IF v_user_id IS NULL THEN
--     RAISE NOTICE 'No user_data found for stripe_customer_id %', p_stripe_customer_id;
--     RETURN;
--   END IF;
--   IF p_status = 'active' AND v_account_id IS NOT NULL THEN
--     UPDATE accounts SET subscription_status = 'active', grace_until = NULL, updated_at = NOW()
--     WHERE id = v_account_id AND subscription_status = 'canceled';
--   END IF;
--   IF v_current_plan IS DISTINCT FROM p_new_plan THEN
--     IF p_new_plan = 'pro_familiar' AND (v_current_plan IS NULL OR v_current_plan <> 'pro_familiar') THEN
--       v_account_id := activate_pro_familiar(v_user_id, p_stripe_customer_id, 'Mi cuenta');
--       RETURN QUERY SELECT v_account_id, v_user_id, 'upgraded_to_pro_familiar'::text;
--     ELSIF v_current_plan = 'pro_familiar' AND p_new_plan IN ('basico', 'pro') THEN
--       UPDATE user_data SET plan = p_new_plan, data = jsonb_set(data, '{p,plan}', to_jsonb(p_new_plan), true), updated_at = NOW()
--       WHERE id = v_user_id;
--       RETURN QUERY SELECT v_account_id, v_user_id, 'downgraded_keep_account'::text;
--     ELSIF p_new_plan IN ('basico', 'pro') THEN
--       UPDATE user_data SET plan = p_new_plan, data = jsonb_set(data, '{p,plan}', to_jsonb(p_new_plan), true), updated_at = NOW()
--       WHERE id = v_user_id;
--       RETURN QUERY SELECT v_account_id, v_user_id, ('plan_changed_to_' || p_new_plan)::text;
--     END IF;
--   ELSE
--     RETURN QUERY SELECT v_account_id, v_user_id, 'no_change'::text;
--   END IF;
-- END;
-- $function$;
-- CREATE OR REPLACE FUNCTION public.handle_subscription_canceled(p_stripe_customer_id text, p_canceled_at timestamp with time zone DEFAULT now())
--  RETURNS TABLE(account_id uuid, user_id uuid, action text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- BEGIN
--   IF p_stripe_customer_id IS NULL THEN
--     RAISE EXCEPTION 'p_stripe_customer_id no puede ser NULL';
--   END IF;
--   RETURN QUERY
--   UPDATE accounts a
--   SET subscription_status = 'canceled', grace_until = p_canceled_at + INTERVAL '30 days', updated_at = NOW()
--   FROM user_data ud
--   WHERE ud.stripe_customer_id = p_stripe_customer_id AND ud.account_id = a.id
--     AND a.plan = 'pro_familiar' AND a.subscription_status <> 'canceled'
--   RETURNING a.id, ud.id, 'pro_familiar_marked_canceled'::text;
--   INSERT INTO account_audit_log (account_id, user_id, action, entity_type, diff)
--   SELECT a.id, ud.id, 'subscription_canceled', 'subscription',
--     jsonb_build_object('stripe_customer_id', p_stripe_customer_id, 'grace_until', p_canceled_at + INTERVAL '30 days')
--   FROM accounts a JOIN user_data ud ON ud.account_id = a.id
--   WHERE ud.stripe_customer_id = p_stripe_customer_id AND a.plan = 'pro_familiar';
-- END;
-- $function$;
-- DROP FUNCTION IF EXISTS public._sync_account_plan(uuid, text);
-- ═══════════════════════════════════════════════════════════════════
