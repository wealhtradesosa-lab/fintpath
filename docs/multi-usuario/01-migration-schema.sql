-- ═══════════════════════════════════════════════════════════════════════════
-- FINPATHIA — MIGRATION 01: Schema multi-usuario (Plan Pro Familiar)
-- ─────────────────────────────────────────────────────────────────────────
-- EJECUTAR EN: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────
-- Esta migration introduce el concepto de "cuenta" (account) que puede
-- tener múltiples usuarios miembros. Cada cuenta tiene UNA bóveda de datos
-- financieros (user_data) y N miembros con rol admin o reader.
--
-- BACKWARD COMPATIBLE: Para cada usuario existente en user_data,
-- creamos automáticamente una cuenta personal con él como único admin.
-- El cliente sigue funcionando con cuentas personales hasta que el usuario
-- invite a otros miembros.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 1: Crear tabla 'accounts'                                       │
-- │ Cada cuenta representa una bóveda financiera compartida.             │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Usuario que CREÓ la cuenta (no necesariamente el único admin)
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Plan suscrito determina max_members
  plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'pro_familiar')),
  max_members INT NOT NULL DEFAULT 1,
  -- Nombre opcional de la cuenta (ej: "Familia Sosa")
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accounts_owner_user_id_idx ON public.accounts(owner_user_id);

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 2: Crear tabla 'account_members'                                │
-- │ Un usuario puede ser miembro de varias cuentas con roles distintos.  │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.account_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'reader')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked')),
  -- Nombre visible en la cuenta (puede diferir del email)
  display_name TEXT,
  -- Un usuario solo puede tener UNA membresía activa por cuenta
  CONSTRAINT account_members_unique UNIQUE(account_id, user_id)
);

CREATE INDEX IF NOT EXISTS account_members_user_id_idx ON public.account_members(user_id);
CREATE INDEX IF NOT EXISTS account_members_account_id_idx ON public.account_members(account_id);
CREATE INDEX IF NOT EXISTS account_members_status_idx ON public.account_members(status);

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 3: Crear tabla 'account_invitations' (invitaciones pendientes) │
-- │ Cuando un admin invita un email que aún no tiene cuenta en Finpathia │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'reader')),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  -- Token único enviado por email (UUID base64)
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64'),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS account_invitations_email_idx ON public.account_invitations(email);
CREATE INDEX IF NOT EXISTS account_invitations_token_idx ON public.account_invitations(token);

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 4: Crear tabla 'account_audit_log' (historial de cambios)       │
-- │ Cada cambio importante queda registrado para auditoría y reversión.  │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS public.account_audit_log (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 'create_ingreso' / 'update_owner' / 'invite_member' / etc.
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  -- Detalle JSON del cambio (valores antes/después)
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_audit_log_account_id_idx ON public.account_audit_log(account_id);
CREATE INDEX IF NOT EXISTS account_audit_log_created_at_idx ON public.account_audit_log(created_at DESC);

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 5: Agregar account_id a user_data existente                     │
-- │ Esta es la columna crítica. Sin esto, los datos no pueden compartirse│
-- └─────────────────────────────────────────────────────────────────────┘
ALTER TABLE public.user_data
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_data_account_id_idx ON public.user_data(account_id);

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 6: MIGRACIÓN RETROACTIVA — crear una cuenta personal por        │
-- │         cada usuario existente que tiene user_data                   │
-- │ ESTO ES CRÍTICO: ejecutarlo UNA SOLA VEZ. Idempotente: si ya existe  │
-- │ una cuenta para ese user, no crea duplicado.                         │
-- └─────────────────────────────────────────────────────────────────────┘
DO $$
DECLARE
  rec RECORD;
  new_account_id UUID;
BEGIN
  FOR rec IN
    SELECT ud.id AS user_id, ud.jurisdiction
    FROM public.user_data ud
    LEFT JOIN public.account_members am ON am.user_id = ud.id AND am.status = 'active'
    WHERE am.id IS NULL  -- solo usuarios que NO tienen ya membresía activa
  LOOP
    -- Crear cuenta personal
    INSERT INTO public.accounts (owner_user_id, plan, max_members, display_name)
    VALUES (rec.user_id, 'basic', 1, 'Mi cuenta')
    RETURNING id INTO new_account_id;

    -- Vincular usuario como admin único
    INSERT INTO public.account_members (account_id, user_id, role, status, accepted_at)
    VALUES (new_account_id, rec.user_id, 'admin', 'active', NOW());

    -- Apuntar user_data a la cuenta nueva
    UPDATE public.user_data
    SET account_id = new_account_id
    WHERE id = rec.user_id AND account_id IS NULL;
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 7: ROW LEVEL SECURITY — la pieza más crítica                    │
-- │ Esto garantiza que un usuario NUNCA pueda leer/modificar datos de    │
-- │ una cuenta de la cual no es miembro activo.                          │
-- └─────────────────────────────────────────────────────────────────────┘

-- Activar RLS en todas las tablas nuevas + user_data
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_audit_log ENABLE ROW LEVEL SECURITY;

-- accounts: solo miembros activos pueden ver la cuenta
DROP POLICY IF EXISTS "members_can_read_account" ON public.accounts;
CREATE POLICY "members_can_read_account" ON public.accounts FOR SELECT
  USING (
    id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- accounts: solo admins pueden modificar plan/display_name
DROP POLICY IF EXISTS "admins_can_update_account" ON public.accounts;
CREATE POLICY "admins_can_update_account" ON public.accounts FOR UPDATE
  USING (
    id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- accounts: cualquier usuario autenticado puede crear su propia cuenta personal
DROP POLICY IF EXISTS "users_can_create_own_account" ON public.accounts;
CREATE POLICY "users_can_create_own_account" ON public.accounts FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

-- account_members: usuario ve los miembros de las cuentas a las que pertenece
DROP POLICY IF EXISTS "members_can_read_members" ON public.account_members;
CREATE POLICY "members_can_read_members" ON public.account_members FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- account_members: solo admins pueden invitar/expulsar
DROP POLICY IF EXISTS "admins_can_manage_members" ON public.account_members;
CREATE POLICY "admins_can_manage_members" ON public.account_members FOR ALL
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- user_data: SOLO miembros activos pueden leer
DROP POLICY IF EXISTS "members_can_read_user_data" ON public.user_data;
CREATE POLICY "members_can_read_user_data" ON public.user_data FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    -- Backward compat: usuarios sin account_id pueden leer su propio user_data
    OR (account_id IS NULL AND id = auth.uid())
  );

-- user_data: SOLO admins pueden insertar/actualizar
DROP POLICY IF EXISTS "admins_can_modify_user_data" ON public.user_data;
CREATE POLICY "admins_can_modify_user_data" ON public.user_data FOR UPDATE
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
    -- Backward compat
    OR (account_id IS NULL AND id = auth.uid())
  );

DROP POLICY IF EXISTS "admins_can_insert_user_data" ON public.user_data;
CREATE POLICY "admins_can_insert_user_data" ON public.user_data FOR INSERT
  WITH CHECK (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
    -- Backward compat: usuarios nuevos sin account_id pueden crear su propio user_data
    OR (account_id IS NULL AND id = auth.uid())
  );

-- account_audit_log: solo admins ven el historial
DROP POLICY IF EXISTS "admins_can_read_audit_log" ON public.account_audit_log;
CREATE POLICY "admins_can_read_audit_log" ON public.account_audit_log FOR SELECT
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- account_invitations: admins ven y crean invitaciones de su cuenta
DROP POLICY IF EXISTS "admins_can_manage_invitations" ON public.account_invitations;
CREATE POLICY "admins_can_manage_invitations" ON public.account_invitations FOR ALL
  USING (
    account_id IN (
      SELECT account_id FROM public.account_members
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 8: TRIGGER de protección — siempre debe haber ≥1 admin activo  │
-- │ Evita que un admin se desactive a sí mismo y la cuenta quede sin él. │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.protect_last_admin()
RETURNS TRIGGER AS $$
DECLARE
  active_admins_count INT;
BEGIN
  -- Solo evaluar si la operación está cambiando role o status de un admin activo
  IF (TG_OP = 'UPDATE' AND OLD.role = 'admin' AND OLD.status = 'active'
      AND (NEW.role <> 'admin' OR NEW.status <> 'active'))
     OR
     (TG_OP = 'DELETE' AND OLD.role = 'admin' AND OLD.status = 'active')
  THEN
    SELECT COUNT(*) INTO active_admins_count
    FROM public.account_members
    WHERE account_id = OLD.account_id
      AND role = 'admin'
      AND status = 'active'
      AND id <> OLD.id;

    IF active_admins_count = 0 THEN
      RAISE EXCEPTION 'No se puede dejar la cuenta sin admins activos. Promoví otro miembro a admin antes de continuar.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_last_admin_trigger ON public.account_members;
CREATE TRIGGER protect_last_admin_trigger
BEFORE UPDATE OR DELETE ON public.account_members
FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin();

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PASO 9: TRIGGER updated_at para accounts                             │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS accounts_updated_at_trigger ON public.accounts;
CREATE TRIGGER accounts_updated_at_trigger
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_accounts_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-MIGRATION
-- Después de ejecutar todo, correr estos queries para confirmar:
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Cantidad de cuentas creadas (debe = cantidad de usuarios con user_data):
--    SELECT COUNT(*) FROM public.accounts;
--
-- 2. Cantidad de membresías activas (debe = cantidad de cuentas):
--    SELECT COUNT(*) FROM public.account_members WHERE status = 'active';
--
-- 3. Cantidad de user_data sin account_id (debe ser 0):
--    SELECT COUNT(*) FROM public.user_data WHERE account_id IS NULL;
--
-- 4. Verificar que tu usuario es admin de tu cuenta:
--    SELECT a.display_name, am.role, am.status
--    FROM public.account_members am
--    JOIN public.accounts a ON a.id = am.account_id
--    WHERE am.user_id = auth.uid();
-- ═══════════════════════════════════════════════════════════════════════════
