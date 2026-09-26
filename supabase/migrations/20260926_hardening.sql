-- ═══════════════════════════════════════════════════════════════════════════
-- 20260926_hardening — endurecimiento de seguridad (Supabase prod pdwrgpskzvrjkqozfbvl)
-- ═══════════════════════════════════════════════════════════════════════════
-- Contexto: la app (navegador) usa la anon key + JWT del usuario y SOLO llama
-- estas RPC: validate_invitation_token, accept_invitation, list_account_members,
-- list_pending_invitations, remove_member, update_member_role,
-- revoke_invitation, create_invitation. Esas NO se tocan (grants intactos).
-- Todo lo demás (Stripe, cuota IA, recover activation, advisor accept-invite,
-- crons) corre en Netlify con SUPABASE_SERVICE_KEY (service_role).
--
-- 1. REVOKE EXECUTE (anon/authenticated/PUBLIC) de RPC SECURITY DEFINER solo
--    server-side y de todas las funciones trigger.
-- 2. accounts / advisors: trigger que restaura en silencio los campos de
--    facturación si el cambio viene de anon/authenticated (como
--    protect_user_data_plan). Se usa current_user: dentro de una función
--    SECURITY DEFINER (RPC legítima, trigger interno) current_user = owner, así
--    que esos flujos no se ven afectados; PostgREST con JWT de usuario corre
--    como authenticated y queda bloqueado; service_role pasa.
-- 3. advisor_clients: default 'pending'; un asesor ya no puede crear vínculos
--    'active' ni cambiar status/client_id; solo el cliente (client_id =
--    auth.uid()) puede aceptar un vínculo pending, o service_role
--    (advisor-accept-invite.cjs).
-- 4. Tablas: anon sin INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER;
--    authenticated sin TRUNCATE/REFERENCES/TRIGGER.
-- 5. search_path fijo (public, pg_temp) en las funciones marcadas por el linter.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. RPC server-side: solo service_role ───────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.recover_pending_activation(uuid, text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.incrementar_uso_ia(uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consultar_uso_ia(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_managed_grace_period()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advisor_at_capacity(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_pro_familiar(uuid, text, text)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_plan_after_stripe(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_subscription_updated(text, text, text)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_subscription_canceled(text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_canceled_accounts()               FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.recover_pending_activation(uuid, text)   TO service_role;
GRANT EXECUTE ON FUNCTION public.incrementar_uso_ia(uuid)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.consultar_uso_ia(uuid)                   TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_managed_grace_period()            TO service_role;
GRANT EXECUTE ON FUNCTION public.advisor_at_capacity(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_pro_familiar(uuid, text, text)  TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_plan_after_stripe(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_subscription_updated(text, text, text)   TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_subscription_canceled(text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_canceled_accounts()               TO service_role;

-- Funciones trigger: nadie las llama por RPC (disparar un trigger no requiere EXECUTE).
REVOKE EXECUTE ON FUNCTION public.create_owner_membership()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_account_to_managed()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_user_data_plan()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.start_grace_on_advisor_disconnect()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_managed_accounts_on_advisor_plan_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_max_members()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_last_admin()                           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_advisor_max_clients()                     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_max_members_on_plan_change()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_accounts_updated_at()                   FROM PUBLIC, anon, authenticated;

-- ── 2a. accounts: campos de facturación solo los cambia service_role / RPC ──
CREATE OR REPLACE FUNCTION public.protect_accounts_billing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- SECURITY INVOKER a propósito: current_user es el rol real de la sentencia
  -- (authenticated/anon vía PostgREST; owner dentro de RPC SECURITY DEFINER).
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.plan                  := OLD.plan;
    NEW.max_members           := OLD.max_members;
    NEW.subscription_status   := OLD.subscription_status;
    NEW.managed_by_advisor_id := OLD.managed_by_advisor_id;
    NEW.managed_tier          := OLD.managed_tier;
    NEW.managed_at            := OLD.managed_at;
    NEW.grace_until           := OLD.grace_until;
    NEW.owner_user_id         := OLD.owner_user_id;
  ELSE
    NEW.plan                  := 'free';
    NEW.max_members           := 1;
    NEW.subscription_status   := 'active';
    NEW.managed_by_advisor_id := NULL;
    NEW.managed_tier          := NULL;
    NEW.managed_at            := NULL;
    NEW.grace_until           := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_accounts_billing() FROM PUBLIC, anon, authenticated;

-- prefijo zz_ => corre DESPUÉS de sync_max_members_trigger (orden alfabético)
DROP TRIGGER IF EXISTS zz_protect_accounts_billing ON public.accounts;
CREATE TRIGGER zz_protect_accounts_billing
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.protect_accounts_billing();

-- ── 2b. advisors ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protect_advisors_billing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.advisor_plan           := OLD.advisor_plan;
    NEW.max_clients            := OLD.max_clients;
    NEW.subscription_status    := OLD.subscription_status;
    NEW.stripe_customer_id     := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.id                     := OLD.id;
  ELSE
    NEW.advisor_plan           := 'starter';
    NEW.max_clients            := 5;
    NEW.subscription_status    := 'inactive';
    NEW.stripe_customer_id     := NULL;
    NEW.stripe_subscription_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.protect_advisors_billing() FROM PUBLIC, anon, authenticated;

-- zz_ => corre DESPUÉS de trigger_sync_advisor_max_clients
DROP TRIGGER IF EXISTS zz_protect_advisors_billing ON public.advisors;
CREATE TRIGGER zz_protect_advisors_billing
  BEFORE INSERT OR UPDATE ON public.advisors
  FOR EACH ROW EXECUTE FUNCTION public.protect_advisors_billing();

-- ── 3. advisor_clients ──────────────────────────────────────────────────────
ALTER TABLE public.advisor_clients DROP CONSTRAINT IF EXISTS advisor_clients_status_check;
ALTER TABLE public.advisor_clients ADD CONSTRAINT advisor_clients_status_check
  CHECK (status = ANY (ARRAY['pending','active','paused','removed','orphan']));
ALTER TABLE public.advisor_clients ALTER COLUMN status SET DEFAULT 'pending';

CREATE OR REPLACE FUNCTION public.guard_advisor_clients_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- service_role (advisor-accept-invite.cjs) y RPC SECURITY DEFINER pasan.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'advisor_clients: un vínculo nuevo solo puede crearse en estado pending'
        USING ERRCODE = '42501';
    END IF;
    NEW.accepted_at := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.advisor_id IS DISTINCT FROM OLD.advisor_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'advisor_clients: advisor_id/client_id no se pueden modificar'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Única transición permitida al usuario: el CLIENTE acepta (o rechaza)
    -- un vínculo pending.
    IF auth.uid() IS NOT NULL
       AND auth.uid() = OLD.client_id
       AND OLD.status = 'pending'
       AND NEW.status IN ('active', 'removed') THEN
      IF NEW.status = 'active' THEN
        NEW.accepted_at := now();
      ELSE
        NEW.removed_at := now();
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'advisor_clients: no tenés permiso para cambiar el estado del vínculo'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_advisor_clients_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aa_guard_advisor_clients_write ON public.advisor_clients;
CREATE TRIGGER aa_guard_advisor_clients_write
  BEFORE INSERT OR UPDATE ON public.advisor_clients
  FOR EACH ROW EXECUTE FUNCTION public.guard_advisor_clients_write();

-- Políticas: el asesor solo puede crear vínculos pending propios, y al
-- actualizar no puede cambiar status ni client_id (WITH CHECK contra la fila
-- almacenada; el trigger de arriba es la segunda capa).
DROP POLICY IF EXISTS "Advisors can insert client relationships" ON public.advisor_clients;
CREATE POLICY "Advisors can insert client relationships" ON public.advisor_clients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = advisor_id AND status = 'pending');

DROP POLICY IF EXISTS "Advisors can update client relationships" ON public.advisor_clients;
CREATE POLICY "Advisors can update client relationships" ON public.advisor_clients
  FOR UPDATE TO authenticated
  USING (auth.uid() = advisor_id)
  WITH CHECK (
    auth.uid() = advisor_id
    AND status    = (SELECT s.status    FROM public.advisor_clients s WHERE s.id = advisor_clients.id)
    AND client_id = (SELECT s.client_id FROM public.advisor_clients s WHERE s.id = advisor_clients.id)
  );

DROP POLICY IF EXISTS "Clients can accept pending advisor link" ON public.advisor_clients;
CREATE POLICY "Clients can accept pending advisor link" ON public.advisor_clients
  FOR UPDATE TO authenticated
  USING (auth.uid() = client_id AND status = 'pending')
  WITH CHECK (auth.uid() = client_id AND status IN ('active', 'removed'));

-- ── 4. Privilegios de tabla ─────────────────────────────────────────────────
-- Ningún flujo sin sesión escribe tablas (signup => trigger handle_new_user;
-- advisor-lead / support-ticket => service_role). SELECT de anon se mantiene
-- (RLS decide; jurisdictions es lectura pública).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ── 5. search_path fijo ─────────────────────────────────────────────────────
ALTER FUNCTION public.protect_last_admin()                           SET search_path = public, pg_temp;
ALTER FUNCTION public.update_accounts_updated_at()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.is_account_member(uuid, text)                  SET search_path = public, pg_temp;
ALTER FUNCTION public.create_owner_membership()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.max_members_for_advisor_tier(text)             SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_managed_accounts_on_advisor_plan_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.start_grace_on_advisor_disconnect()            SET search_path = public, pg_temp;
ALTER FUNCTION public.expire_managed_grace_period()                  SET search_path = public, pg_temp;
ALTER FUNCTION public.promote_account_to_managed()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.advisor_at_capacity(uuid)                      SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_advisor_max_clients()                     SET search_path = public, pg_temp;
ALTER FUNCTION public.max_members_for_plan(text)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.remove_member(uuid, uuid)                      SET search_path = public, pg_temp;
ALTER FUNCTION public.update_member_role(uuid, uuid, text)           SET search_path = public, pg_temp;
ALTER FUNCTION public.create_invitation(uuid, text, text)            SET search_path = public, pg_temp;
ALTER FUNCTION public.accept_invitation(text)                        SET search_path = public, pg_temp;
ALTER FUNCTION public.revoke_invitation(uuid)                        SET search_path = public, pg_temp;
ALTER FUNCTION public.list_account_members(uuid)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.list_pending_invitations(uuid)                 SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_max_members_on_plan_change()              SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_invitation_token(text)                SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_max_members()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.incrementar_uso_ia(uuid)                       SET search_path = public, pg_temp;
ALTER FUNCTION public.consultar_uso_ia(uuid)                         SET search_path = public, pg_temp;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK (ejecutar manualmente si hiciera falta):
-- ═══════════════════════════════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS zz_protect_accounts_billing ON public.accounts;
-- DROP TRIGGER IF EXISTS zz_protect_advisors_billing ON public.advisors;
-- DROP TRIGGER IF EXISTS aa_guard_advisor_clients_write ON public.advisor_clients;
-- DROP FUNCTION IF EXISTS public.protect_accounts_billing();
-- DROP FUNCTION IF EXISTS public.protect_advisors_billing();
-- DROP FUNCTION IF EXISTS public.guard_advisor_clients_write();
-- DROP POLICY IF EXISTS "Clients can accept pending advisor link" ON public.advisor_clients;
-- DROP POLICY IF EXISTS "Advisors can insert client relationships" ON public.advisor_clients;
-- CREATE POLICY "Advisors can insert client relationships" ON public.advisor_clients
--   FOR INSERT TO public WITH CHECK (auth.uid() = advisor_id);
-- DROP POLICY IF EXISTS "Advisors can update client relationships" ON public.advisor_clients;
-- CREATE POLICY "Advisors can update client relationships" ON public.advisor_clients
--   FOR UPDATE TO public USING (auth.uid() = advisor_id);
-- ALTER TABLE public.advisor_clients ALTER COLUMN status SET DEFAULT 'active';
-- -- (solo si no hay filas 'pending':)
-- ALTER TABLE public.advisor_clients DROP CONSTRAINT advisor_clients_status_check;
-- ALTER TABLE public.advisor_clients ADD CONSTRAINT advisor_clients_status_check
--   CHECK (status = ANY (ARRAY['active','paused','removed','orphan']));
-- GRANT EXECUTE ON FUNCTION public.recover_pending_activation(uuid, text) TO authenticated;
-- GRANT EXECUTE ON FUNCTION public.incrementar_uso_ia(uuid), public.consultar_uso_ia(uuid),
--   public.expire_managed_grace_period(), public.advisor_at_capacity(uuid),
--   public.create_owner_membership(), public.handle_new_user(), public.promote_account_to_managed(),
--   public.protect_user_data_plan(), public.start_grace_on_advisor_disconnect(),
--   public.sync_managed_accounts_on_advisor_plan_change(), public.enforce_max_members(),
--   public.protect_last_admin(), public.sync_advisor_max_clients(),
--   public.sync_max_members_on_plan_change(), public.update_accounts_updated_at()
--   TO PUBLIC, anon, authenticated;
-- GRANT INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO anon;
-- GRANT TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public TO authenticated;
-- -- (estado previo: anon tenía INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER en
-- --  todas las tablas public; authenticated en accounts NO tenía UPDATE de tabla,
-- --  solo UPDATE(display_name, updated_at) por columna — ese grant no se toca aquí)
-- -- search_path: ALTER FUNCTION public.<fn>(...) RESET search_path;  (las 24 de la sección 5)
