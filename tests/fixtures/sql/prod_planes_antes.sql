-- Esquema mínimo de prod (11-oct-2026; funciones de invitaciones, cupos y
-- Stripe copiadas tal cual de prod) para probar la migración de planes
-- en PGlite. Tablas recortadas a las columnas que usan las funciones; las
-- funciones y triggers son copia de las definiciones de prod (leídas en
-- solo lectura), salvo stubs de auth.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'basic',
  max_members integer NOT NULL DEFAULT 1,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  managed_by_advisor_id uuid, managed_tier text, managed_at timestamptz,
  subscription_status text NOT NULL DEFAULT 'active',
  grace_until timestamptz,
  CONSTRAINT accounts_plan_check CHECK (plan = ANY (ARRAY['free','basic','basico','pro','pro_familiar','managed'])),
  CONSTRAINT accounts_subscription_status_check CHECK (subscription_status = ANY (ARRAY['active','grace','past_due','canceled']))
);
CREATE TABLE public.user_data (
  id uuid PRIMARY KEY, email text, data jsonb NOT NULL DEFAULT '{}', plan text NOT NULL DEFAULT 'free',
  stripe_customer_id text, updated_at timestamptz DEFAULT now(), account_id uuid,
  CONSTRAINT user_data_plan_check CHECK (plan = ANY (ARRAY['free','basico','pro','pro_familiar']))
);
CREATE TABLE public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid NOT NULL, user_id uuid NOT NULL,
  role text NOT NULL, invited_by uuid, invited_at timestamptz DEFAULT now(), accepted_at timestamptz,
  status text NOT NULL DEFAULT 'active', display_name text, UNIQUE (account_id, user_id)
);
CREATE TABLE public.account_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_id uuid, email text, role text, invited_by uuid,
  invited_at timestamptz DEFAULT now(), expires_at timestamptz DEFAULT (now() + interval '7 days'),
  token text DEFAULT md5(random()::text), consumed_at timestamptz
);
CREATE TABLE public.account_audit_log (
  id bigserial PRIMARY KEY, account_id uuid, user_id uuid, action text, entity_type text, entity_id text,
  diff jsonb, created_at timestamptz DEFAULT now()
);

CREATE FUNCTION public.max_members_for_plan(p_plan text) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  RETURN CASE p_plan WHEN 'basic' THEN 1 WHEN 'pro' THEN 3 WHEN 'pro_familiar' THEN 10 WHEN 'managed' THEN 5 ELSE 1 END;
END; $function$;

CREATE FUNCTION public.sync_max_members_on_plan_change() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND NEW.plan <> 'managed' THEN
    NEW.max_members := public.max_members_for_plan(NEW.plan);
  END IF;
  RETURN NEW;
END; $function$;
CREATE TRIGGER sync_max_members_trigger BEFORE UPDATE OF plan ON public.accounts FOR EACH ROW EXECUTE FUNCTION sync_max_members_on_plan_change();

CREATE FUNCTION public.protect_accounts_billing() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
 IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
 NEW.plan := OLD.plan; NEW.max_members := OLD.max_members; NEW.subscription_status := OLD.subscription_status;
 NEW.managed_by_advisor_id := OLD.managed_by_advisor_id; NEW.managed_tier := OLD.managed_tier; NEW.managed_at := OLD.managed_at;
 NEW.grace_until := OLD.grace_until; NEW.owner_user_id := OLD.owner_user_id;
 ELSE
 NEW.plan := 'free'; NEW.max_members := 1; NEW.subscription_status := 'active';
 NEW.managed_by_advisor_id := NULL; NEW.managed_tier := NULL; NEW.managed_at := NULL; NEW.grace_until := NULL;
 END IF;
 RETURN NEW;
END; $function$;
CREATE TRIGGER zz_protect_accounts_billing BEFORE INSERT OR UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION protect_accounts_billing();

CREATE FUNCTION public.is_account_member(p_account_id uuid, p_role text DEFAULT NULL::text) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.account_members WHERE account_id = p_account_id AND user_id = auth.uid() AND status = 'active' AND (p_role IS NULL OR role = p_role));
END; $function$;

CREATE OR REPLACE FUNCTION public.enforce_max_members()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current_count INT;
  v_max_allowed INT;
  v_already_exists BOOLEAN;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- FIX 3-may-2026: si el (account_id, user_id) ya existe como miembro,
  -- skip el chequeo del límite. Este INSERT será no-op por unique
  -- constraint o por ON CONFLICT DO NOTHING en el query. Sin esto, el
  -- signup nuevo fallaba con "Cuenta llena: 1/1" porque el owner se
  -- intentaba insertar 2 veces (trigger + handle_new_user manual).
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.account_members
      WHERE account_id = NEW.account_id AND user_id = NEW.user_id
    ) INTO v_already_exists;
    IF v_already_exists THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.account_members
  WHERE account_id = NEW.account_id
    AND status = 'active'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  SELECT max_members INTO v_max_allowed
  FROM public.accounts WHERE id = NEW.account_id;

  IF v_max_allowed IS NULL THEN
    RAISE EXCEPTION 'Cuenta % no encontrada (race condition?)', NEW.account_id;
  END IF;

  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Cuenta llena: % miembros activos (límite del plan: %)',
      v_current_count, v_max_allowed
      USING HINT = 'Subir el plan o expulsar a un miembro existente antes de invitar a otro';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER enforce_max_members_trigger BEFORE INSERT OR UPDATE OF status ON public.account_members FOR EACH ROW EXECUTE FUNCTION enforce_max_members();

CREATE OR REPLACE FUNCTION public.create_invitation(p_account_id uuid, p_email text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller          UUID := auth.uid();
  v_max_members     INT;
  v_current_members INT;
  v_pending         INT;
  v_invitation_id   UUID;
  v_token           TEXT;
  v_expires_at      TIMESTAMPTZ;
  v_norm_email      TEXT;
BEGIN
  -- Auth
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501';
  END IF;
  -- Caller debe ser admin de la cuenta
  IF NOT public.is_account_member(p_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden invitar miembros' USING ERRCODE = '42501';
  END IF;
  -- Validar role
  IF p_role NOT IN ('admin', 'reader') THEN
    RAISE EXCEPTION 'Rol inválido. Use admin o reader.' USING ERRCODE = '22023';
  END IF;
  -- Validar email (sanity check, no full RFC)
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
  END IF;
  v_norm_email := LOWER(TRIM(p_email));

  -- Capacidad: max_members - (miembros activos + invitaciones pendientes vivas)
  SELECT max_members INTO v_max_members FROM public.accounts WHERE id = p_account_id;
  IF v_max_members IS NULL THEN
    RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = '23503';
  END IF;

  SELECT COUNT(*) INTO v_current_members
    FROM public.account_members
    WHERE account_id = p_account_id AND status = 'active';

  SELECT COUNT(*) INTO v_pending
    FROM public.account_invitations
    WHERE account_id = p_account_id
      AND consumed_at IS NULL
      AND expires_at > NOW();

  IF v_current_members + v_pending >= v_max_members THEN
    RAISE EXCEPTION 'Cuenta llena: % miembros + % invitaciones pendientes (límite del plan: %)',
      v_current_members, v_pending, v_max_members
      USING HINT = 'Sube el plan, revoca una invitación pendiente o expulsa a un miembro';
  END IF;

  -- Email no debe ser ya miembro activo
  IF EXISTS (
    SELECT 1
    FROM public.account_members am
    JOIN auth.users u ON u.id = am.user_id
    WHERE am.account_id = p_account_id
      AND LOWER(u.email) = v_norm_email
      AND am.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Ese email ya es miembro de la cuenta' USING ERRCODE = '23505';
  END IF;

  -- Email no debe tener invitación viva pendiente
  IF EXISTS (
    SELECT 1 FROM public.account_invitations
    WHERE account_id = p_account_id
      AND LOWER(email) = v_norm_email
      AND consumed_at IS NULL
      AND expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'Ya hay una invitación pendiente para ese email'
      USING ERRCODE = '23505',
            HINT = 'Revoca la invitación anterior o esperá a que el invitado la acepte';
  END IF;

  -- Crear invitación (token y expires_at vienen por DEFAULT)
  INSERT INTO public.account_invitations (account_id, email, role, invited_by)
  VALUES (p_account_id, v_norm_email, p_role, v_caller)
  RETURNING id, token, expires_at INTO v_invitation_id, v_token, v_expires_at;

  RETURN jsonb_build_object(
    'invitation_id',   v_invitation_id,
    'token',           v_token,
    'invitation_url',  'https://finpathia.com/invite/' || v_token,
    'expires_at',      v_expires_at,
    'email',           v_norm_email,
    'role',            p_role
  );
END;
$function$;

CREATE FUNCTION public.expire_canceled_accounts() RETURNS TABLE(account_id uuid, owner_user_id uuid, action text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE accounts a SET subscription_status = 'expired', plan = 'free', max_members = 1, updated_at = NOW()
    WHERE a.subscription_status = 'canceled' AND a.grace_until IS NOT NULL AND a.grace_until < NOW()
    RETURNING a.id, a.owner_user_id
  ),
  user_sync AS (
    UPDATE user_data ud SET plan = 'free', data = jsonb_set(ud.data, '{p,plan}', '"free"'::jsonb, true), updated_at = NOW()
    WHERE ud.id IN (SELECT e.owner_user_id FROM expired e) RETURNING ud.id
  )
  SELECT e.id, e.owner_user_id, 'expired_to_free'::text FROM expired e;
  INSERT INTO account_audit_log (account_id, user_id, action, entity_type)
  SELECT a.id, a.owner_user_id, 'grace_expired_downgrade_free', 'subscription' FROM accounts a
  WHERE a.subscription_status = 'expired' AND a.updated_at >= NOW() - INTERVAL '1 minute';
END; $function$;

-- Definiciones de prod de las funciones que la migración reemplaza.
CREATE FUNCTION public.update_user_plan_after_stripe(p_user_id uuid, p_plan text, p_stripe_customer_id text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  IF p_user_id IS NULL OR p_plan NOT IN ('basico', 'pro') THEN RAISE EXCEPTION 'plan inválido: % (debe ser basico o pro)', p_plan; END IF;
  UPDATE user_data SET plan = p_plan, stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    data = jsonb_set(data, '{p,plan}', to_jsonb(p_plan), true), updated_at = NOW() WHERE id = p_user_id;
  RETURN FOUND;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_subscription_updated(p_stripe_customer_id text, p_new_plan text, p_status text)
 RETURNS TABLE(account_id uuid, user_id uuid, action text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_current_plan TEXT;
  v_account_id UUID;
BEGIN
  IF p_stripe_customer_id IS NULL OR p_new_plan IS NULL THEN
    RAISE EXCEPTION 'p_stripe_customer_id y p_new_plan son requeridos';
  END IF;
  SELECT ud.id, ud.plan, ud.account_id INTO v_user_id, v_current_plan, v_account_id
  FROM user_data ud WHERE ud.stripe_customer_id = p_stripe_customer_id LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user_data found for stripe_customer_id %', p_stripe_customer_id;
    RETURN;
  END IF;
  IF p_status = 'active' AND v_account_id IS NOT NULL THEN
    UPDATE accounts SET subscription_status = 'active', grace_until = NULL, updated_at = NOW()
    WHERE id = v_account_id AND subscription_status = 'canceled';
  END IF;
  IF v_current_plan IS DISTINCT FROM p_new_plan THEN
    IF p_new_plan = 'pro_familiar' AND (v_current_plan IS NULL OR v_current_plan <> 'pro_familiar') THEN
      v_account_id := activate_pro_familiar(v_user_id, p_stripe_customer_id, 'Mi cuenta');
      RETURN QUERY SELECT v_account_id, v_user_id, 'upgraded_to_pro_familiar'::text;
    ELSIF v_current_plan = 'pro_familiar' AND p_new_plan IN ('basico', 'pro') THEN
      UPDATE user_data SET plan = p_new_plan, data = jsonb_set(data, '{p,plan}', to_jsonb(p_new_plan), true), updated_at = NOW()
      WHERE id = v_user_id;
      RETURN QUERY SELECT v_account_id, v_user_id, 'downgraded_keep_account'::text;
    ELSIF p_new_plan IN ('basico', 'pro') THEN
      UPDATE user_data SET plan = p_new_plan, data = jsonb_set(data, '{p,plan}', to_jsonb(p_new_plan), true), updated_at = NOW()
      WHERE id = v_user_id;
      RETURN QUERY SELECT v_account_id, v_user_id, ('plan_changed_to_' || p_new_plan)::text;
    END IF;
  ELSE
    RETURN QUERY SELECT v_account_id, v_user_id, 'no_change'::text;
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_subscription_canceled(p_stripe_customer_id text, p_canceled_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(account_id uuid, user_id uuid, action text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_stripe_customer_id IS NULL THEN
    RAISE EXCEPTION 'p_stripe_customer_id no puede ser NULL';
  END IF;
  RETURN QUERY
  UPDATE accounts a
  SET subscription_status = 'canceled', grace_until = p_canceled_at + INTERVAL '30 days', updated_at = NOW()
  FROM user_data ud
  WHERE ud.stripe_customer_id = p_stripe_customer_id AND ud.account_id = a.id
    AND a.plan = 'pro_familiar' AND a.subscription_status <> 'canceled'
  RETURNING a.id, ud.id, 'pro_familiar_marked_canceled'::text;
  INSERT INTO account_audit_log (account_id, user_id, action, entity_type, diff)
  SELECT a.id, ud.id, 'subscription_canceled', 'subscription',
    jsonb_build_object('stripe_customer_id', p_stripe_customer_id, 'grace_until', p_canceled_at + INTERVAL '30 days')
  FROM accounts a JOIN user_data ud ON ud.account_id = a.id
  WHERE ud.stripe_customer_id = p_stripe_customer_id AND a.plan = 'pro_familiar';
END;
$function$;
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

  IF v_userdata_account_id IS NOT NULL
     AND v_userdata_account_plan = 'free' THEN
    -- UPGRADE in-place: cambiar plan + max_members + display_name
    UPDATE accounts
    SET plan = 'pro_familiar',
        max_members = 10,
        subscription_status = 'active',
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

CREATE OR REPLACE FUNCTION public.recover_pending_activation(p_user_id uuid, p_stripe_customer_id text)
 RETURNS TABLE(recovered boolean, account_id uuid, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_existing_account_id UUID;
  v_recovered_account_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_stripe_customer_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id y p_stripe_customer_id son requeridos';
  END IF;

  -- ¿Ya tiene account pro_familiar?
  SELECT a.id INTO v_existing_account_id
  FROM accounts a
  WHERE a.owner_user_id = p_user_id
    AND a.plan = 'pro_familiar'
  LIMIT 1;

  IF v_existing_account_id IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, v_existing_account_id, 'already_active'::text;
    RETURN;
  END IF;

  -- No tiene account → activar (esto también verifica que el user existe)
  v_recovered_account_id := activate_pro_familiar(p_user_id, p_stripe_customer_id, 'Mi cuenta');
  RETURN QUERY SELECT TRUE, v_recovered_account_id, 'recovered'::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller        UUID := auth.uid();
  v_caller_email  TEXT;
  v_invitation    RECORD;
  v_account_name  TEXT;
  v_existing_id   UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Tenés que iniciar sesión para aceptar la invitación' USING ERRCODE = '42501';
  END IF;

  -- Email del caller (para matchear contra invitación)
  SELECT LOWER(email) INTO v_caller_email FROM auth.users WHERE id = v_caller;

  -- Buscar invitación viva
  SELECT * INTO v_invitation
    FROM public.account_invitations
    WHERE token = p_token
      AND consumed_at IS NULL
      AND expires_at > NOW()
    LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitación inválida o expirada'
      USING HINT = 'Pedile a quien te invitó que la genere de nuevo';
  END IF;

  -- El email del invitado debe matchear (case-insensitive)
  IF LOWER(v_invitation.email) <> v_caller_email THEN
    RAISE EXCEPTION 'Esta invitación es para % pero estás logueado como %',
      v_invitation.email, v_caller_email
      USING HINT = 'Cerrá sesión y entrá con el email correcto';
  END IF;

  -- Si ya existe membership (caso raro: invitación duplicada o user previo),
  -- reactivar/actualizar en vez de duplicar
  SELECT id INTO v_existing_id
    FROM public.account_members
    WHERE account_id = v_invitation.account_id AND user_id = v_caller
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.account_members
    SET role = v_invitation.role,
        status = 'active',
        accepted_at = COALESCE(accepted_at, NOW())
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.account_members (account_id, user_id, role, status, accepted_at)
    VALUES (v_invitation.account_id, v_caller, v_invitation.role, 'active', NOW());
  END IF;

  -- Marcar invitación como consumida
  UPDATE public.account_invitations
  SET consumed_at = NOW()
  WHERE id = v_invitation.id;

  -- Nombre cuenta para retornar
  SELECT display_name INTO v_account_name
    FROM public.accounts WHERE id = v_invitation.account_id;

  RETURN jsonb_build_object(
    'account_id',   v_invitation.account_id,
    'account_name', v_account_name,
    'role',         v_invitation.role
  );
END;
$function$;
