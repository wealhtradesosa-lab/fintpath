-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 2026-11-02 — SINCRONIZAR accounts.plan CON EL PAGO
-- (rehace el PR #36 sobre las migraciones del 26 y 30-oct-2026)
--
-- NO APLICADA. Se aplica a prod solo con el OK de Santiago, después de
-- comparar con las definiciones vivas (ver «ANTES DE APLICAR»).
--
-- PROBLEMA: al pagar Pro o Básico (Stripe o Mercado Pago), los webhooks
-- llaman a update_user_plan_after_stripe(), que solo escribía user_data.plan
-- y el blob. accounts.plan quedaba en 'free' y accounts.max_members en 1.
-- Como los cupos (enforce_max_members, create_invitation) y la cuota de IA
-- (_cuotaIA.cjs) leen accounts, un Pro pagando quedaba con 1 cupo en vez de
-- 3, con la cuota de IA del plan gratis y con «Plan free · Cuenta llena».
--
-- CAMBIOS:
--   1. max_members_for_plan: 'basico' y 'free' explícitos (=1).
--   2. _estado_desde_stripe(): active/trialing → active, past_due/unpaid →
--      past_due; cualquier otro estado (incomplete, canceled…) → NULL = no tocar.
--   3. _sync_account_plan(): pone plan, max_members y el estado mapeado en la
--      cuenta PROPIA del usuario. Nunca toca cuentas managed; solo toca una
--      pro_familiar si se pide explícitamente (bajada Pro Familiar → Pro).
--   4. update_user_plan_after_stripe (checkout Stripe y pago de Mercado Pago)
--      la llama.
--   5. handle_subscription_updated: también sincroniza cuando el plan NO
--      cambió, así que sirve para renovaciones (invoice.paid) y para reparar
--      cuentas desfasadas. Pro Familiar → Pro/Básico: la cuenta pasa a ese
--      plan; los miembros que sobran se quedan, pero no entra nadie más.
--   6. handle_subscription_canceled: Pro igual que Pro Familiar (30 días de
--      gracia; al vencer, expire_canceled_accounts la baja a free, 1 cupo).
--   7. create_invitation y enforce_max_members (versión del 30-oct con
--      contadores): con la suscripción cancelada o vencida no se invita ni
--      entra nadie nuevo de la familia. Los contadores no cambian.
--   8. activate_pro_familiar: subir de Pro/Básico a Pro Familiar mejora la
--      cuenta propia en vez de crear otra (antes solo si era 'free').
--   9. Backfill con registro en _backfill_plan_sync_20261102 para revertirlo.
--
-- YA RESUELTO EN OTRA MIGRACIÓN: el CHECK con 'expired' (20261026).
-- FUERA DE ALCANCE: cupos durante la prueba de 14 días; Básico cancelado
-- (sigue como antes: sin downgrade automático).
--
-- ANTES DE APLICAR (en el SQL editor de producción, solo lectura):
--   select proname, md5(pg_get_functiondef(oid)) from pg_proc
--    where pronamespace = 'public'::regnamespace and proname in
--    ('update_user_plan_after_stripe','handle_subscription_updated',
--     'handle_subscription_canceled','create_invitation','enforce_max_members',
--     'activate_pro_familiar','max_members_for_plan','expire_canceled_accounts');
--   Comparar con tests/fixtures/sql/prod_planes_antes.sql + 20261026 + 20261030.
--   Si alguna cambió en producción desde entonces, no aplicar: rehacer sobre
--   la definición viva.
--
-- Rollback al final, comentado.
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


-- ─── 2. Estado de Stripe → estado de la cuenta ──────────────────────
CREATE OR REPLACE FUNCTION public._estado_desde_stripe(p_status text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE p_status
    WHEN 'active'   THEN 'active'
    WHEN 'trialing' THEN 'active'
    WHEN 'past_due' THEN 'past_due'
    WHEN 'unpaid'   THEN 'past_due'
    ELSE NULL
  END;
$function$;

-- ─── 3. Auxiliar: plan pagado → cuenta propia ────────────────────────
-- Pone max_members a mano (el trigger sync_max_members_on_plan_change solo
-- actúa si el plan cambia). Devuelve el id de la cuenta o NULL si no tocó
-- nada (sin cuenta propia, cuenta managed, o estado de Stripe sin mapear).
CREATE OR REPLACE FUNCTION public._sync_account_plan(p_user_id uuid, p_plan text, p_stripe_status text DEFAULT 'active', p_desde_familiar boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_account_id UUID;
  v_estado TEXT := public._estado_desde_stripe(p_stripe_status);
BEGIN
  IF p_plan NOT IN ('basico', 'pro') THEN
    RAISE EXCEPTION '_sync_account_plan: plan inválido %', p_plan;
  END IF;
  IF v_estado IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.accounts a
  SET plan = p_plan,
      max_members = public.max_members_for_plan(p_plan),
      subscription_status = v_estado,
      grace_until = CASE WHEN v_estado = 'active' THEN NULL ELSE a.grace_until END,
      updated_at = NOW()
  FROM public.user_data ud
  WHERE ud.id = p_user_id
    AND a.id = ud.account_id
    AND a.owner_user_id = p_user_id
    AND (a.plan IN ('free', 'basic', 'basico', 'pro')
         OR (p_desde_familiar AND a.plan = 'pro_familiar'))
  RETURNING a.id INTO v_account_id;
  RETURN v_account_id;
END;
$function$;
REVOKE ALL ON FUNCTION public._sync_account_plan(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;

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

  -- 2-nov-2026 (#36): también la cuenta (cupos y cuota de IA leen accounts).
  -- Un checkout de Pro/Básico no pisa una cuenta Pro Familiar.
  IF v_found THEN
    PERFORM public._sync_account_plan(p_user_id, p_plan, 'active', false);
  END IF;

  RETURN v_found;
END;
$function$;

-- ─── 5. Webhook customer.subscription.updated / invoice.paid ─────────
-- Idempotente: se puede llamar en cada renovación con el mismo plan.
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
  v_acc UUID;
  v_estado TEXT := public._estado_desde_stripe(p_status);
BEGIN
  IF p_stripe_customer_id IS NULL OR p_new_plan IS NULL THEN
    RAISE EXCEPTION 'p_stripe_customer_id y p_new_plan son requeridos';
  END IF;
  IF p_new_plan NOT IN ('basico', 'pro', 'pro_familiar') THEN
    RAISE EXCEPTION 'plan inválido: %', p_new_plan;
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

  -- incomplete, incomplete_expired, canceled, paused…: no se toca nada.
  -- La cancelación la maneja customer.subscription.deleted.
  IF v_estado IS NULL THEN
    RETURN QUERY SELECT v_account_id, v_user_id, ('ignored_status_' || COALESCE(p_status, 'null'))::text;
    RETURN;
  END IF;

  IF p_new_plan = 'pro_familiar' THEN
    SELECT a.id INTO v_acc FROM accounts a
    WHERE a.owner_user_id = v_user_id AND a.plan = 'pro_familiar'
    ORDER BY a.created_at DESC LIMIT 1;

    IF v_acc IS NULL OR v_current_plan IS DISTINCT FROM 'pro_familiar' THEN
      v_acc := activate_pro_familiar(v_user_id, p_stripe_customer_id, 'Mi cuenta');
      UPDATE accounts SET subscription_status = v_estado, updated_at = NOW()
      WHERE id = v_acc AND subscription_status IS DISTINCT FROM v_estado;
      RETURN QUERY SELECT v_acc, v_user_id, 'upgraded_to_pro_familiar'::text;
    ELSE
      UPDATE accounts a
      SET subscription_status = v_estado,
          grace_until = CASE WHEN v_estado = 'active' THEN NULL ELSE a.grace_until END,
          max_members = GREATEST(a.max_members, public.max_members_for_plan('pro_familiar')),
          updated_at = NOW()
      WHERE a.id = v_acc;
      RETURN QUERY SELECT v_acc, v_user_id, 'synced'::text;
    END IF;
    RETURN;
  END IF;

  -- basico / pro
  UPDATE user_data
  SET plan = p_new_plan,
      data = jsonb_set(data, '{p,plan}', to_jsonb(p_new_plan), true),
      updated_at = NOW()
  WHERE id = v_user_id
    AND (plan IS DISTINCT FROM p_new_plan OR data->'p'->>'plan' IS DISTINCT FROM p_new_plan);

  -- Pro Familiar → Pro/Básico: la cuenta familiar pasa a ese plan.
  -- Los miembros que sobran se quedan; enforce_max_members y
  -- create_invitation no dejan entrar a nadie más.
  v_acc := public._sync_account_plan(v_user_id, p_new_plan, p_status, true);

  RETURN QUERY SELECT COALESCE(v_acc, v_account_id), v_user_id,
    (CASE
       WHEN v_current_plan = 'pro_familiar' THEN 'downgraded_pro_familiar_to_' || p_new_plan
       WHEN v_current_plan IS DISTINCT FROM p_new_plan THEN 'plan_changed_to_' || p_new_plan
       ELSE 'synced'
     END)::text;
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

  -- Pro Familiar y Pro (2-nov-2026 (#36)) → canceled + 30 días de gracia. Al
  -- vencer, expire_canceled_accounts la baja a free con 1 cupo. Durante la
  -- gracia y después, los miembros existentes se quedan y no entra nadie más.
  RETURN QUERY
  UPDATE accounts a
  SET subscription_status = 'canceled',
      grace_until = p_canceled_at + INTERVAL '30 days',
      updated_at = NOW()
  FROM user_data ud
  WHERE ud.stripe_customer_id = p_stripe_customer_id
    AND ud.account_id = a.id
    AND a.subscription_status <> 'canceled'
    AND (a.plan = 'pro_familiar' OR (a.plan = 'pro' AND a.owner_user_id = ud.id))
  RETURNING a.id, ud.id, (a.plan || '_marked_canceled')::text;

  -- Básico legacy → sin cambios (sin downgrade automático).

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


-- ─── 7. Sin invitaciones ni miembros nuevos con la suscripción cancelada ─
CREATE OR REPLACE FUNCTION public.create_invitation(p_account_id uuid, p_email text, p_role text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller          UUID := auth.uid();
  v_max             INT;
  v_current         INT;
  v_pending         INT;
  v_invitation_id   UUID;
  v_token           TEXT;
  v_expires_at      TIMESTAMPTZ;
  v_norm_email      TEXT;
  v_es_contador     BOOLEAN := (p_role = 'contador');
  v_status          TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_account_member(p_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden invitar' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'reader', 'contador') THEN
    RAISE EXCEPTION 'Rol inválido. Use admin, reader o contador.' USING ERRCODE = '22023';
  END IF;
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
  END IF;
  v_norm_email := LOWER(TRIM(p_email));

  SELECT max_members, subscription_status INTO v_max, v_status FROM public.accounts WHERE id = p_account_id;
  IF v_max IS NULL THEN RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = '23503'; END IF;
  -- 2-nov-2026 (#36): suscripción cancelada (en gracia) o vencida → no se
  -- invita a nadie de la familia. Los contadores sí: no ocupan cupo del plan
  -- y la persona puede necesitar a su contador justo al cerrar la cuenta.
  IF v_status IN ('canceled', 'expired') AND NOT v_es_contador THEN
    RAISE EXCEPTION 'Tu suscripción está cancelada: no puedes invitar a más personas'
      USING ERRCODE = '42501', HINT = 'Reactiva tu plan para invitar a alguien más';
  END IF;
  IF v_es_contador THEN v_max := 3; END IF;

  SELECT COUNT(*) INTO v_current FROM public.account_members
    WHERE account_id = p_account_id AND status = 'active' AND ((role = 'contador') = v_es_contador);
  SELECT COUNT(*) INTO v_pending FROM public.account_invitations
    WHERE account_id = p_account_id AND consumed_at IS NULL AND expires_at > NOW() AND ((role = 'contador') = v_es_contador);

  IF v_current + v_pending >= v_max THEN
    RAISE EXCEPTION '%', CASE WHEN v_es_contador THEN 'Ya tienes 3 contadores con acceso o invitados'
      ELSE format('Cuenta llena: %s personas + %s invitaciones pendientes (límite del plan: %s)', v_current, v_pending, v_max) END
      USING HINT = 'Revoca una invitación pendiente o quita a alguien';
  END IF;

  IF EXISTS (SELECT 1 FROM public.account_members am JOIN auth.users u ON u.id = am.user_id
             WHERE am.account_id = p_account_id AND LOWER(u.email) = v_norm_email AND am.status = 'active') THEN
    RAISE EXCEPTION 'Ese correo ya tiene acceso a la cuenta' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_invitations WHERE account_id = p_account_id AND LOWER(email) = v_norm_email
             AND consumed_at IS NULL AND expires_at > NOW()) THEN
    RAISE EXCEPTION 'Ya hay una invitación pendiente para ese correo' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.account_invitations (account_id, email, role, invited_by)
  VALUES (p_account_id, v_norm_email, p_role, v_caller)
  RETURNING id, token, expires_at INTO v_invitation_id, v_token, v_expires_at;

  RETURN jsonb_build_object('invitation_id', v_invitation_id, 'token', v_token,
    'invitation_url', 'https://finpathia.com/invite/' || v_token, 'expires_at', v_expires_at, 'email', v_norm_email, 'role', p_role);
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_max_members()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current_count INT;
  v_max_allowed INT;
  v_already_exists BOOLEAN;
  v_es_contador BOOLEAN := (NEW.role = 'contador');
  v_status TEXT;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.role = NEW.role THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS(SELECT 1 FROM public.account_members WHERE account_id = NEW.account_id AND user_id = NEW.user_id) INTO v_already_exists;
    IF v_already_exists THEN RETURN NEW; END IF;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.account_members
  WHERE account_id = NEW.account_id
    AND status = 'active'
    AND ((role = 'contador') = v_es_contador)
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  SELECT max_members, subscription_status INTO v_max_allowed, v_status FROM public.accounts WHERE id = NEW.account_id;
  IF v_max_allowed IS NULL THEN
    RAISE EXCEPTION 'Cuenta % no encontrada (race condition?)', NEW.account_id;
  END IF;
  -- 2-nov-2026 (#36): cuenta cancelada (en gracia) o vencida → nadie nuevo de
  -- la familia entra (tampoco aceptando una invitación vieja). Los miembros
  -- que ya estaban se quedan; los contadores siguen su propio tope.
  IF v_status IN ('canceled', 'expired') AND NOT v_es_contador THEN
    RAISE EXCEPTION 'La suscripción está cancelada: no se pueden sumar personas nuevas'
      USING HINT = 'Reactiva el plan para sumar a alguien más';
  END IF;
  IF v_es_contador THEN v_max_allowed := 3; END IF;

  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION '%', CASE WHEN v_es_contador THEN 'Ya tienes 3 contadores con acceso' ELSE format('Cuenta llena: %s miembros activos (límite del plan: %s)', v_current_count, v_max_allowed) END
      USING HINT = 'Quita a alguien antes de invitar a otro';
  END IF;
  RETURN NEW;
END;
$function$;


-- ─── 8. Pro/Básico → Pro Familiar mejora la cuenta propia ────────────
CREATE OR REPLACE FUNCTION public.activate_pro_familiar(p_user_id uuid, p_stripe_customer_id text, p_display_name text DEFAULT 'Mi cuenta'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing_account_id UUID;
  v_userdata_account_id UUID;
  v_userdata_account_plan TEXT;
  v_new_account_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id no puede ser NULL';
  END IF;

  -- Idempotencia path 1: ¿ya tiene account pro_familiar como owner?
  SELECT a.id INTO v_existing_account_id
  FROM accounts a
  WHERE a.owner_user_id = p_user_id
    AND a.plan = 'pro_familiar'
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_existing_account_id IS NOT NULL THEN
    -- Ya existe account pro_familiar: solo asegurar status active + member admin
    UPDATE accounts
    SET subscription_status = 'active',
        updated_at = NOW()
    WHERE id = v_existing_account_id
      AND subscription_status <> 'active';

    INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
    VALUES (v_existing_account_id, p_user_id, 'admin', 'active', NOW())
    ON CONFLICT (account_id, user_id) DO UPDATE
      SET role = 'admin', status = 'active',
          accepted_at = COALESCE(account_members.accepted_at, NOW());

    UPDATE user_data
    SET account_id = v_existing_account_id,
        plan = 'pro_familiar',
        stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
        data = jsonb_set(data, '{p,plan}', '"pro_familiar"'::jsonb, true),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_existing_account_id;
  END IF;

  -- Path 2: ¿el user tiene una account asignada en user_data? (cuenta inicial
  -- creada por handle_new_user). Si sí Y es 'free', UPGRADE en lugar de crear.
  SELECT ud.account_id, a.plan
  INTO v_userdata_account_id, v_userdata_account_plan
  FROM user_data ud
  LEFT JOIN accounts a ON a.id = ud.account_id
  WHERE ud.id = p_user_id;

  -- 2-nov-2026 (#36): también si la cuenta propia es basic/basico/pro (ahora que
  -- pagar Pro o Básico sí actualiza accounts.plan). Antes solo 'free', y un
  -- Pro que subía a Pro Familiar terminaba con una cuenta NUEVA y sus
  -- miembros quedaban en la vieja.
  IF v_userdata_account_id IS NOT NULL
     AND v_userdata_account_plan IN ('free', 'basic', 'basico', 'pro')
     AND EXISTS (SELECT 1 FROM accounts WHERE id = v_userdata_account_id AND owner_user_id = p_user_id) THEN
    -- UPGRADE in-place: cambiar plan + max_members + display_name
    UPDATE accounts
    SET plan = 'pro_familiar',
        max_members = 10,
        subscription_status = 'active',
        grace_until = NULL,
        display_name = COALESCE(NULLIF(display_name, 'Mi cuenta'), p_display_name),
        updated_at = NOW()
    WHERE id = v_userdata_account_id;

    -- Asegurar membership admin (ya existe del trigger handle_new_user, pero
    -- por idempotencia ON CONFLICT)
    INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
    VALUES (v_userdata_account_id, p_user_id, 'admin', 'active', NOW())
    ON CONFLICT (account_id, user_id) DO UPDATE
      SET role = 'admin', status = 'active',
          accepted_at = COALESCE(account_members.accepted_at, NOW());

    -- Sincronizar user_data
    UPDATE user_data
    SET plan = 'pro_familiar',
        stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
        data = jsonb_set(data, '{p,plan}', '"pro_familiar"'::jsonb, true),
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_userdata_account_id;
  END IF;

  -- Path 3: edge case — user no tiene account o tiene una con plan != free
  -- (downgrade desde otro plan o user legacy sin account_id). Crear nueva.
  INSERT INTO accounts (owner_user_id, plan, max_members, display_name, subscription_status)
  VALUES (p_user_id, 'pro_familiar', 10, p_display_name, 'active')
  RETURNING id INTO v_new_account_id;

  INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
  VALUES (v_new_account_id, p_user_id, 'admin', 'active', NOW())
  ON CONFLICT (account_id, user_id) DO UPDATE
    SET role = 'admin', status = 'active',
        accepted_at = COALESCE(account_members.accepted_at, NOW());

  UPDATE user_data
  SET account_id = v_new_account_id,
      plan = 'pro_familiar',
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      data = jsonb_set(data, '{p,plan}', '"pro_familiar"'::jsonb, true),
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_new_account_id;
END;
$function$;

-- ─── 9. Backfill (con registro para poder revertirlo) ───────────────
CREATE TABLE IF NOT EXISTS public._backfill_plan_sync_20261102 (
  account_id uuid PRIMARY KEY,
  plan text NOT NULL,
  max_members integer NOT NULL,
  subscription_status text NOT NULL,
  grace_until timestamptz,
  registrado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public._backfill_plan_sync_20261102 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._backfill_plan_sync_20261102 FROM PUBLIC, anon, authenticated;

-- a) Cuenta propia en free pero user_data dice basico/pro (pagó y el
--    webhook no sincronizó la cuenta).
-- b) Cuentas Pro con menos cupos de los que da el plan.
INSERT INTO public._backfill_plan_sync_20261102 (account_id, plan, max_members, subscription_status, grace_until)
SELECT a.id, a.plan, a.max_members, a.subscription_status, a.grace_until
FROM public.accounts a
WHERE (a.plan = 'free' AND a.subscription_status NOT IN ('canceled', 'expired') AND EXISTS (
         SELECT 1 FROM public.user_data ud
         WHERE ud.account_id = a.id AND ud.id = a.owner_user_id AND ud.plan IN ('basico', 'pro')))
   OR (a.plan = 'pro' AND a.max_members < public.max_members_for_plan('pro'))
ON CONFLICT (account_id) DO NOTHING;

UPDATE public.accounts a
SET plan = ud.plan,
    max_members = public.max_members_for_plan(ud.plan),
    updated_at = NOW()
FROM public.user_data ud
WHERE ud.account_id = a.id
  AND a.owner_user_id = ud.id
  AND a.plan = 'free'
  AND a.subscription_status NOT IN ('canceled', 'expired')  -- vencidas: expire_canceled_accounts ya las bajó
  AND ud.plan IN ('basico', 'pro');

UPDATE public.accounts
SET max_members = public.max_members_for_plan('pro'),
    updated_at = NOW()
WHERE plan = 'pro'
  AND max_members < public.max_members_for_plan('pro');

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (manual). Restaura las definiciones previas (11-oct + 30-oct).
-- NOTA: orden: 1) revierte el backfill con _backfill_plan_sync_20261102;
-- NOTA: 2) funciones como estaban (create_invitation y enforce_max_members
-- NOTA:    en su versión del 30-oct con contadores); 3) borra las auxiliares.
-- NOTA:    El CHECK con 'expired' (20261026) no se toca.
--
-- UPDATE public.accounts a
-- SET plan = b.plan, max_members = b.max_members, subscription_status = b.subscription_status,
--     grace_until = b.grace_until, updated_at = NOW()
-- FROM public._backfill_plan_sync_20261102 b
-- WHERE a.id = b.account_id;
-- DROP TABLE IF EXISTS public._backfill_plan_sync_20261102;
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
-- CREATE OR REPLACE FUNCTION public.create_invitation(p_account_id uuid, p_email text, p_role text)
--  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_caller          UUID := auth.uid();
--   v_max             INT;
--   v_current         INT;
--   v_pending         INT;
--   v_invitation_id   UUID;
--   v_token           TEXT;
--   v_expires_at      TIMESTAMPTZ;
--   v_norm_email      TEXT;
--   v_es_contador     BOOLEAN := (p_role = 'contador');
-- BEGIN
--   IF v_caller IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501'; END IF;
--   IF NOT public.is_account_member(p_account_id, 'admin') THEN
--     RAISE EXCEPTION 'Solo administradores pueden invitar' USING ERRCODE = '42501';
--   END IF;
--   IF p_role NOT IN ('admin', 'reader', 'contador') THEN
--     RAISE EXCEPTION 'Rol inválido. Use admin, reader o contador.' USING ERRCODE = '22023';
--   END IF;
--   IF p_email IS NULL OR p_email = '' OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
--     RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
--   END IF;
--   v_norm_email := LOWER(TRIM(p_email));
--
--   IF v_es_contador THEN
--     v_max := 3;
--   ELSE
--     SELECT max_members INTO v_max FROM public.accounts WHERE id = p_account_id;
--     IF v_max IS NULL THEN RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = '23503'; END IF;
--   END IF;
--
--   SELECT COUNT(*) INTO v_current FROM public.account_members
--     WHERE account_id = p_account_id AND status = 'active' AND ((role = 'contador') = v_es_contador);
--   SELECT COUNT(*) INTO v_pending FROM public.account_invitations
--     WHERE account_id = p_account_id AND consumed_at IS NULL AND expires_at > NOW() AND ((role = 'contador') = v_es_contador);
--
--   IF v_current + v_pending >= v_max THEN
--     RAISE EXCEPTION '%', CASE WHEN v_es_contador THEN 'Ya tienes 3 contadores con acceso o invitados'
--       ELSE format('Cuenta llena: %s personas + %s invitaciones pendientes (límite del plan: %s)', v_current, v_pending, v_max) END
--       USING HINT = 'Revoca una invitación pendiente o quita a alguien';
--   END IF;
--
--   IF EXISTS (SELECT 1 FROM public.account_members am JOIN auth.users u ON u.id = am.user_id
--              WHERE am.account_id = p_account_id AND LOWER(u.email) = v_norm_email AND am.status = 'active') THEN
--     RAISE EXCEPTION 'Ese correo ya tiene acceso a la cuenta' USING ERRCODE = '23505';
--   END IF;
--   IF EXISTS (SELECT 1 FROM public.account_invitations WHERE account_id = p_account_id AND LOWER(email) = v_norm_email
--              AND consumed_at IS NULL AND expires_at > NOW()) THEN
--     RAISE EXCEPTION 'Ya hay una invitación pendiente para ese correo' USING ERRCODE = '23505';
--   END IF;
--
--   INSERT INTO public.account_invitations (account_id, email, role, invited_by)
--   VALUES (p_account_id, v_norm_email, p_role, v_caller)
--   RETURNING id, token, expires_at INTO v_invitation_id, v_token, v_expires_at;
--
--   RETURN jsonb_build_object('invitation_id', v_invitation_id, 'token', v_token,
--     'invitation_url', 'https://finpathia.com/invite/' || v_token, 'expires_at', v_expires_at, 'email', v_norm_email, 'role', p_role);
-- END;
-- $function$;
-- CREATE OR REPLACE FUNCTION public.enforce_max_members()
--  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_current_count INT;
--   v_max_allowed INT;
--   v_already_exists BOOLEAN;
--   v_es_contador BOOLEAN := (NEW.role = 'contador');
-- BEGIN
--   IF NEW.status <> 'active' THEN RETURN NEW; END IF;
--   IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.role = NEW.role THEN RETURN NEW; END IF;
--
--   IF TG_OP = 'INSERT' THEN
--     SELECT EXISTS(SELECT 1 FROM public.account_members WHERE account_id = NEW.account_id AND user_id = NEW.user_id) INTO v_already_exists;
--     IF v_already_exists THEN RETURN NEW; END IF;
--   END IF;
--
--   SELECT COUNT(*) INTO v_current_count
--   FROM public.account_members
--   WHERE account_id = NEW.account_id
--     AND status = 'active'
--     AND ((role = 'contador') = v_es_contador)
--     AND (TG_OP = 'INSERT' OR id <> NEW.id);
--
--   IF v_es_contador THEN
--     v_max_allowed := 3;
--   ELSE
--     SELECT max_members INTO v_max_allowed FROM public.accounts WHERE id = NEW.account_id;
--     IF v_max_allowed IS NULL THEN
--       RAISE EXCEPTION 'Cuenta % no encontrada (race condition?)', NEW.account_id;
--     END IF;
--   END IF;
--
--   IF v_current_count >= v_max_allowed THEN
--     RAISE EXCEPTION '%', CASE WHEN v_es_contador THEN 'Ya tienes 3 contadores con acceso' ELSE format('Cuenta llena: %s miembros activos (límite del plan: %s)', v_current_count, v_max_allowed) END
--       USING HINT = 'Quita a alguien antes de invitar a otro';
--   END IF;
--   RETURN NEW;
-- END;
-- $function$;
-- CREATE OR REPLACE FUNCTION public.activate_pro_familiar(p_user_id uuid, p_stripe_customer_id text, p_display_name text DEFAULT 'Mi cuenta'::text)
--  RETURNS uuid
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_existing_account_id UUID;
--   v_userdata_account_id UUID;
--   v_userdata_account_plan TEXT;
--   v_new_account_id UUID;
-- BEGIN
--   IF p_user_id IS NULL THEN
--     RAISE EXCEPTION 'p_user_id no puede ser NULL';
--   END IF;
--
--   -- Idempotencia path 1: ¿ya tiene account pro_familiar como owner?
--   SELECT a.id INTO v_existing_account_id
--   FROM accounts a
--   WHERE a.owner_user_id = p_user_id
--     AND a.plan = 'pro_familiar'
--   ORDER BY a.created_at DESC
--   LIMIT 1;
--
--   IF v_existing_account_id IS NOT NULL THEN
--     -- Ya existe account pro_familiar: solo asegurar status active + member admin
--     UPDATE accounts
--     SET subscription_status = 'active',
--         updated_at = NOW()
--     WHERE id = v_existing_account_id
--       AND subscription_status <> 'active';
--
--     INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
--     VALUES (v_existing_account_id, p_user_id, 'admin', 'active', NOW())
--     ON CONFLICT (account_id, user_id) DO UPDATE
--       SET role = 'admin', status = 'active',
--           accepted_at = COALESCE(account_members.accepted_at, NOW());
--
--     UPDATE user_data
--     SET account_id = v_existing_account_id,
--         plan = 'pro_familiar',
--         stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
--         data = jsonb_set(data, '{p,plan}', '"pro_familiar"'::jsonb, true),
--         updated_at = NOW()
--     WHERE id = p_user_id;
--
--     RETURN v_existing_account_id;
--   END IF;
--
--   -- Path 2: ¿el user tiene una account asignada en user_data? (cuenta inicial
--   -- creada por handle_new_user). Si sí Y es 'free', UPGRADE en lugar de crear.
--   SELECT ud.account_id, a.plan
--   INTO v_userdata_account_id, v_userdata_account_plan
--   FROM user_data ud
--   LEFT JOIN accounts a ON a.id = ud.account_id
--   WHERE ud.id = p_user_id;
--
--   IF v_userdata_account_id IS NOT NULL
--      AND v_userdata_account_plan = 'free' THEN
--     -- UPGRADE in-place: cambiar plan + max_members + display_name
--     UPDATE accounts
--     SET plan = 'pro_familiar',
--         max_members = 10,
--         subscription_status = 'active',
--         display_name = COALESCE(NULLIF(display_name, 'Mi cuenta'), p_display_name),
--         updated_at = NOW()
--     WHERE id = v_userdata_account_id;
--
--     -- Asegurar membership admin (ya existe del trigger handle_new_user, pero
--     -- por idempotencia ON CONFLICT)
--     INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
--     VALUES (v_userdata_account_id, p_user_id, 'admin', 'active', NOW())
--     ON CONFLICT (account_id, user_id) DO UPDATE
--       SET role = 'admin', status = 'active',
--           accepted_at = COALESCE(account_members.accepted_at, NOW());
--
--     -- Sincronizar user_data
--     UPDATE user_data
--     SET plan = 'pro_familiar',
--         stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
--         data = jsonb_set(data, '{p,plan}', '"pro_familiar"'::jsonb, true),
--         updated_at = NOW()
--     WHERE id = p_user_id;
--
--     RETURN v_userdata_account_id;
--   END IF;
--
--   -- Path 3: edge case — user no tiene account o tiene una con plan != free
--   -- (downgrade desde otro plan o user legacy sin account_id). Crear nueva.
--   INSERT INTO accounts (owner_user_id, plan, max_members, display_name, subscription_status)
--   VALUES (p_user_id, 'pro_familiar', 10, p_display_name, 'active')
--   RETURNING id INTO v_new_account_id;
--
--   INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
--   VALUES (v_new_account_id, p_user_id, 'admin', 'active', NOW())
--   ON CONFLICT (account_id, user_id) DO UPDATE
--     SET role = 'admin', status = 'active',
--         accepted_at = COALESCE(account_members.accepted_at, NOW());
--
--   UPDATE user_data
--   SET account_id = v_new_account_id,
--       plan = 'pro_familiar',
--       stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
--       data = jsonb_set(data, '{p,plan}', '"pro_familiar"'::jsonb, true),
--       updated_at = NOW()
--   WHERE id = p_user_id;
--
--   RETURN v_new_account_id;
-- END;
-- $function$;
-- DROP FUNCTION IF EXISTS public._sync_account_plan(uuid, text, text, boolean);
-- DROP FUNCTION IF EXISTS public._estado_desde_stripe(text);
-- ═══════════════════════════════════════════════════════════════════
