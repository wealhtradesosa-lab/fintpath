-- ═══════════════════════════════════════════════════════════════════════════
-- FINPATHIA — MIGRATION 01c: Cliente managed by advisor (Opción A)
-- ─────────────────────────────────────────────────────────────────────────
-- EJECUTAR DESPUÉS DE: 01-migration-schema.sql + 01b-patches.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Ver diseño completo en docs/multi-usuario/07-cliente-managed-por-asesor.md
--
-- Esta migración cruza los dos ejes del producto que hasta ahora eran
-- ortogonales: el plan corporativo del asesor pasa a definir cuántos
-- miembros adicionales puede tener cada cliente.
--
-- TIERS DEFINIDOS:
--   advisor_plan='starter'      → cliente max_members=1 (sin multi-usuario)
--   advisor_plan='professional' → cliente max_members=3 (admin + 2 readers)
--   advisor_plan='boutique'     → cliente max_members=5 (admin + 4 readers)
--
-- COMPORTAMIENTO:
--   - Cuando un asesor vincula un cliente (advisor_clients.status='active'),
--     si la cuenta del cliente era 'basic', se promueve a 'managed' y
--     hereda max_members del tier del asesor.
--   - Si la cuenta del cliente ya era 'pro_familiar' (pagando él mismo),
--     NO se sobrescribe — su plan tiene prioridad.
--   - Si el asesor cambia de plan, todas sus accounts managed se ajustan.
--   - Si el asesor pierde al cliente, la cuenta entra en grace 30 días
--     antes de bajar a 'basic'.
--   - El cliente NO puede modificar managed_* ni max_members (column-level
--     REVOKE UPDATE). Solo el sistema (triggers SECURITY DEFINER).
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 6 — Agregar 'managed' al CHECK de accounts.plan                │
-- └─────────────────────────────────────────────────────────────────────┘
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_plan_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_plan_check
  CHECK (plan IN ('basic', 'pro', 'pro_familiar', 'managed'));

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 7 — Columnas nuevas en accounts para tracking de managed       │
-- └─────────────────────────────────────────────────────────────────────┘
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS managed_by_advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS managed_tier TEXT
    CHECK (managed_tier IS NULL OR managed_tier IN ('starter', 'professional', 'boutique')),
  ADD COLUMN IF NOT EXISTS managed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'grace', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS accounts_managed_by_advisor_id_idx
  ON public.accounts(managed_by_advisor_id) WHERE managed_by_advisor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounts_grace_until_idx
  ON public.accounts(grace_until) WHERE grace_until IS NOT NULL;

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_managed_coherent;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_managed_coherent
  CHECK (
    (plan = 'managed' AND managed_by_advisor_id IS NOT NULL AND managed_tier IS NOT NULL)
    OR (plan <> 'managed')
  );

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 8 — Función helper: max_members según advisor_plan             │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.max_members_for_advisor_tier(p_tier TEXT)
RETURNS INT AS $$
BEGIN
  RETURN CASE p_tier
    WHEN 'starter' THEN 1
    WHEN 'professional' THEN 3
    WHEN 'boutique' THEN 5
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 9 — Trigger: vincular advisor↔cliente promueve account a       │
-- │           'managed' si era 'basic'                                    │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.promote_account_to_managed()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_current_plan TEXT;
  v_advisor_tier TEXT;
  v_max_members INT;
BEGIN
  -- Solo procesar transiciones que llegan a status='active'
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;  -- ya estaba activo, no es transición
  END IF;

  -- Buscar la cuenta del cliente vía user_data
  SELECT a.id, a.plan
    INTO v_account_id, v_current_plan
    FROM public.accounts a
    INNER JOIN public.user_data ud ON ud.account_id = a.id
    WHERE ud.id = NEW.client_id
    LIMIT 1;

  -- Si el cliente no tiene cuenta todavía (caso muy raro: signup paralelo),
  -- no hacer nada.
  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Solo promover si la cuenta era 'basic' (cuentas pro/pro_familiar
  -- pagadas por el cliente NO se tocan: el cliente conserva su plan)
  IF v_current_plan = 'basic' THEN
    SELECT advisor_plan INTO v_advisor_tier
      FROM public.advisors WHERE id = NEW.advisor_id;
    v_max_members := public.max_members_for_advisor_tier(v_advisor_tier);

    UPDATE public.accounts SET
      plan = 'managed',
      managed_by_advisor_id = NEW.advisor_id,
      managed_tier = v_advisor_tier,
      managed_at = NOW(),
      max_members = v_max_members,
      subscription_status = 'active',
      grace_until = NULL
    WHERE id = v_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS advisor_clients_promote_to_managed ON public.advisor_clients;
CREATE TRIGGER advisor_clients_promote_to_managed
AFTER INSERT OR UPDATE OF status ON public.advisor_clients
FOR EACH ROW EXECUTE FUNCTION public.promote_account_to_managed();

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 10 — Trigger: cambio de advisor_plan → propagar a accounts     │
-- │            managed por ese asesor                                     │
-- │ Coexiste con trigger_sync_advisor_max_clients existente (ese maneja  │
-- │ advisors.max_clients, este maneja accounts.max_members).             │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.sync_managed_accounts_on_advisor_plan_change()
RETURNS TRIGGER AS $$
DECLARE
  v_max_members INT;
BEGIN
  IF TG_OP = 'INSERT' OR (OLD.advisor_plan IS DISTINCT FROM NEW.advisor_plan) THEN
    v_max_members := public.max_members_for_advisor_tier(NEW.advisor_plan);

    UPDATE public.accounts SET
      managed_tier = NEW.advisor_plan,
      max_members = v_max_members
    WHERE managed_by_advisor_id = NEW.id
      AND plan = 'managed';

    -- NOTA: si max_members baja y la cuenta tenía más miembros activos
    -- que el nuevo límite, los readers existentes NO se desactivan.
    -- El cliente lo verá en UI ("plan permite N pero hay M") y decidirá.
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS advisors_sync_managed_accounts ON public.advisors;
CREATE TRIGGER advisors_sync_managed_accounts
AFTER INSERT OR UPDATE OF advisor_plan ON public.advisors
FOR EACH ROW EXECUTE FUNCTION public.sync_managed_accounts_on_advisor_plan_change();

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 11 — Trigger: cliente pierde asesor → grace period 30 días     │
-- │ Cubre:                                                                │
-- │   - advisor_clients UPDATE status: active → removed/orphan/paused     │
-- │   - advisor_clients DELETE                                             │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.start_grace_on_advisor_disconnect()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_old_client_id UUID;
BEGIN
  v_old_client_id := COALESCE(OLD.client_id, NEW.client_id);

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' AND NEW.status = 'active' THEN
      RETURN NEW;
    END IF;
    IF OLD.status <> 'active' THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT a.id INTO v_account_id
    FROM public.accounts a
    INNER JOIN public.user_data ud ON ud.account_id = a.id
    WHERE ud.id = v_old_client_id
    LIMIT 1;

  IF v_account_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Solo iniciar grace si la cuenta es 'managed' (no tocar pro/pro_familiar)
  UPDATE public.accounts SET
    subscription_status = 'grace',
    grace_until = NOW() + INTERVAL '30 days'
  WHERE id = v_account_id AND plan = 'managed';

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS advisor_clients_start_grace ON public.advisor_clients;
CREATE TRIGGER advisor_clients_start_grace
AFTER UPDATE OF status OR DELETE ON public.advisor_clients
FOR EACH ROW EXECUTE FUNCTION public.start_grace_on_advisor_disconnect();

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 12 — Función para downgrade lazy de cuentas en grace expirado │
-- │ NO se ejecuta automáticamente. Llamadores:                            │
-- │   - Edge function cron diaria (preferido en Fase 4+)                  │
-- │   - O lazy en login del admin (vía RPC call desde cliente)            │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.expire_managed_grace_period()
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE public.accounts SET
      plan = 'basic',
      managed_by_advisor_id = NULL,
      managed_tier = NULL,
      managed_at = NULL,
      max_members = 1,
      subscription_status = 'active',
      grace_until = NULL
    WHERE plan = 'managed'
      AND subscription_status = 'grace'
      AND grace_until IS NOT NULL
      AND grace_until < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.expire_managed_grace_period() TO authenticated;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 13 — REVOKE column-level UPDATE: cliente no puede modificar    │
-- │            campos managed_* ni plan ni max_members                    │
-- │ Defensa en profundidad: aunque los triggers y RLS protegen, también  │
-- │ restringimos el GRANT a nivel columna.                               │
-- └─────────────────────────────────────────────────────────────────────┘
REVOKE UPDATE ON public.accounts FROM authenticated;
GRANT UPDATE (display_name, updated_at) ON public.accounts TO authenticated;
-- plan, max_members, managed_by_advisor_id, managed_tier, managed_at,
-- subscription_status, grace_until: solo modificables por triggers
-- SECURITY DEFINER (que corren como rol superuser).

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-PATCH
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Confirmar que las columnas nuevas existen:
--    SELECT column_name FROM information_schema.columns
--    WHERE table_name='accounts' AND table_schema='public'
--    AND column_name IN ('managed_by_advisor_id','managed_tier','managed_at',
--                         'subscription_status','grace_until');
--    -- Debe devolver 5 filas.
--
-- 2. Confirmar que el CHECK de plan acepta 'managed':
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname='accounts_plan_check';
--    -- Debe contener 'managed'.
--
-- 3. Confirmar que los 3 triggers nuevos están instalados:
--    SELECT tgname FROM pg_trigger
--    WHERE tgname IN ('advisor_clients_promote_to_managed',
--                      'advisors_sync_managed_accounts',
--                      'advisor_clients_start_grace');
--    -- Debe devolver 3 filas.
--
-- 4. Confirmar que authenticated NO puede UPDATE columnas restringidas:
--    SELECT has_column_privilege('authenticated','public.accounts','plan','UPDATE');
--    -- Debe ser FALSE.
--    SELECT has_column_privilege('authenticated','public.accounts','display_name','UPDATE');
--    -- Debe ser TRUE.
--
-- 5. Smoke test funcional (con dos sesiones):
--    -- Sesión asesor: invitar cliente → cliente acepta
--    -- Sesión cliente: SELECT plan, max_members FROM accounts WHERE id IN (
--    --   SELECT account_id FROM user_data WHERE id = auth.uid()
--    -- );
--    -- Debe mostrar plan='managed' y max_members según tier del asesor.
-- ═══════════════════════════════════════════════════════════════════════════
