-- Esquema mínimo de prod (11-oct-2026) para probar la migración de planes
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

CREATE FUNCTION public.enforce_max_members() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE v_current_count INT; v_max_allowed INT; v_already_exists BOOLEAN;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS(SELECT 1 FROM public.account_members WHERE account_id = NEW.account_id AND user_id = NEW.user_id) INTO v_already_exists;
    IF v_already_exists THEN RETURN NEW; END IF;
  END IF;
  SELECT COUNT(*) INTO v_current_count FROM public.account_members WHERE account_id = NEW.account_id AND status = 'active' AND (TG_OP = 'INSERT' OR id <> NEW.id);
  SELECT max_members INTO v_max_allowed FROM public.accounts WHERE id = NEW.account_id;
  IF v_max_allowed IS NULL THEN RAISE EXCEPTION 'Cuenta % no encontrada (race condition?)', NEW.account_id; END IF;
  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Cuenta llena: % miembros activos (límite del plan: %)', v_current_count, v_max_allowed;
  END IF;
  RETURN NEW;
END; $function$;
CREATE TRIGGER enforce_max_members_trigger BEFORE INSERT OR UPDATE OF status ON public.account_members FOR EACH ROW EXECUTE FUNCTION enforce_max_members();

CREATE FUNCTION public.create_invitation(p_account_id uuid, p_email text, p_role text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE v_caller UUID := auth.uid(); v_max_members INT; v_current_members INT; v_pending INT; v_invitation_id UUID; v_norm_email TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada'; END IF;
  IF NOT public.is_account_member(p_account_id, 'admin') THEN RAISE EXCEPTION 'Solo administradores pueden invitar miembros'; END IF;
  v_norm_email := LOWER(TRIM(p_email));
  SELECT max_members INTO v_max_members FROM public.accounts WHERE id = p_account_id;
  SELECT COUNT(*) INTO v_current_members FROM public.account_members WHERE account_id = p_account_id AND status = 'active';
  SELECT COUNT(*) INTO v_pending FROM public.account_invitations WHERE account_id = p_account_id AND consumed_at IS NULL AND expires_at > NOW();
  IF v_current_members + v_pending >= v_max_members THEN
    RAISE EXCEPTION 'Cuenta llena: % miembros + % invitaciones pendientes (límite del plan: %)', v_current_members, v_pending, v_max_members;
  END IF;
  INSERT INTO public.account_invitations (account_id, email, role, invited_by) VALUES (p_account_id, v_norm_email, p_role, v_caller) RETURNING id INTO v_invitation_id;
  RETURN jsonb_build_object('invitation_id', v_invitation_id);
END; $function$;

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
