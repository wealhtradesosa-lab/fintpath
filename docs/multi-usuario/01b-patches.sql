-- ═══════════════════════════════════════════════════════════════════════════
-- FINPATHIA — MIGRATION 01b: Patches críticos a Fase 1
-- ─────────────────────────────────────────────────────────────────────────
-- EJECUTAR INMEDIATAMENTE DESPUÉS de 01-migration-schema.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Ver auditoría completa en docs/multi-usuario/03-auditoria-fase1.md
--
-- Estos patches cierran 5 gaps detectados en la revisión del schema 01:
--
--   PATCH 1 (CRÍTICO de seguridad): Las RLS policies preexistentes de
--           user_data (definidas en schema-simple.sql) NO fueron eliminadas
--           por 01-migration-schema.sql. Eso permite que un reader escriba
--           en su user_data orphan usando "auth.uid() = id" como bypass
--           de las nuevas policies multi-cuenta.
--
--   PATCH 2 (correctness): Reforzar WITH CHECK de admins_can_insert_user_data
--           para que el id del row insertado siempre coincida con auth.uid().
--           Previene que un admin malicioso cree user_data con id ajeno.
--           También agrega policy DELETE (faltante en Fase 1).
--
--   PATCH 3 (operability): Función helper is_account_member() para evitar
--           subqueries duplicados en las RLS policies y mejorar legibilidad.
--           NO cambia comportamiento, solo refactor para mantenimiento.
--
--   PATCH 4 (CRÍTICO de bootstrap): Trigger AFTER INSERT en accounts que
--           crea automáticamente el row de admin en account_members para
--           owner_user_id. Sin esto, el cliente no puede crear cuentas
--           porque la policy "admins_can_manage_members" exige ya ser admin
--           (catch-22 de bootstrap).
--
--   PATCH 5 (CRÍTICO de bootstrap): Actualiza handle_new_user para crear
--           automáticamente la cuenta personal + user_data al registrarse
--           un usuario nuevo. Sin esto, los signups posteriores a la
--           migración quedarían con account_id NULL.
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 1 — Eliminar RLS policies legacy de user_data                  │
-- │ Estas policies vivían en schema-simple.sql y son redundantes (en     │
-- │ el mejor caso) o inseguras (en el peor) tras la migración.           │
-- └─────────────────────────────────────────────────────────────────────┘
DROP POLICY IF EXISTS "Users can view own data" ON public.user_data;
DROP POLICY IF EXISTS "Users can insert own data" ON public.user_data;
DROP POLICY IF EXISTS "Users can update own data" ON public.user_data;
DROP POLICY IF EXISTS "Users can delete own data" ON public.user_data;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 2 — Reforzar admins_can_insert_user_data                       │
-- │ Validar siempre que id = auth.uid() en el row insertado, incluso     │
-- │ cuando ya hay account_id. Defensa en profundidad.                    │
-- └─────────────────────────────────────────────────────────────────────┘
DROP POLICY IF EXISTS "admins_can_insert_user_data" ON public.user_data;
CREATE POLICY "admins_can_insert_user_data" ON public.user_data FOR INSERT
  WITH CHECK (
    -- Siempre el id del row debe ser el del usuario autenticado
    id = auth.uid()
    AND (
      -- Caso normal: el usuario es admin activo de la cuenta destino
      account_id IN (
        SELECT account_id FROM public.account_members
        WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
      )
      -- Backward compat: usuarios nuevos sin cuenta todavía
      OR account_id IS NULL
    )
  );

-- También endurecer DELETE — si bien no había policy DELETE explícita,
-- agregamos una para completitud (sin esto, RLS deniega DELETE total,
-- lo cual rompe el flujo de "borrar mi cuenta" futuro).
DROP POLICY IF EXISTS "admins_can_delete_user_data" ON public.user_data;
CREATE POLICY "admins_can_delete_user_data" ON public.user_data FOR DELETE
  USING (
    id = auth.uid()
    AND (
      account_id IN (
        SELECT account_id FROM public.account_members
        WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
      )
      OR account_id IS NULL
    )
  );

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 3 — Helper is_account_member() (opcional pero recomendado)     │
-- │ Centraliza la verificación de pertenencia a cuenta. Las RLS de       │
-- │ Fase 2/3/4 pueden usarla en lugar de duplicar el subquery.           │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.is_account_member(p_account_id UUID, p_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = p_account_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND (p_role IS NULL OR role = p_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- SECURITY DEFINER + STABLE permite que la función sea cacheada por query
-- sin recursión RLS. Le damos permisos a authenticated:
GRANT EXECUTE ON FUNCTION public.is_account_member(UUID, TEXT) TO authenticated;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 4 — Trigger AFTER INSERT en accounts: crear membership owner  │
-- │ Sin esto, el cliente no puede crear su cuenta personal: la policy   │
-- │ "admins_can_manage_members" exige ya ser admin para INSERT en       │
-- │ account_members → catch-22 de bootstrap.                             │
-- │ Con el trigger (SECURITY DEFINER), al INSERT en accounts se crea    │
-- │ automáticamente el row de admin para owner_user_id.                  │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.create_owner_membership()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.account_members (account_id, user_id, role, status, accepted_at)
  VALUES (NEW.id, NEW.owner_user_id, 'admin', 'active', NOW())
  ON CONFLICT (account_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS accounts_create_owner_membership ON public.accounts;
CREATE TRIGGER accounts_create_owner_membership
AFTER INSERT ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.create_owner_membership();

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ PATCH 5 — Actualizar handle_new_user para crear cuenta + user_data  │
-- │ El trigger original (schema-simple.sql) solo creaba user_data sin    │
-- │ account_id. Después de la migración, usuarios nuevos quedaban con    │
-- │ account_id NULL (cubierto por backward compat, pero no ideal).      │
-- │ Esta versión crea automáticamente la cuenta personal y la liga.     │
-- │                                                                       │
-- │ NOTA: El bloque jsonb_build_object replica EXACTAMENTE el del        │
-- │ schema-simple.sql original. Si ese trigger se modificó posteriormente│
-- │ en producción, copiar el bloque actual antes de aplicar este patch.  │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_account_id UUID;
BEGIN
  -- Crear cuenta personal por default
  INSERT INTO public.accounts (owner_user_id, plan, max_members, display_name)
  VALUES (NEW.id, 'basic', 1, 'Mi cuenta')
  RETURNING id INTO new_account_id;
  -- (el trigger create_owner_membership crea automáticamente el row de admin)

  -- Crear user_data con account_id ya vinculado
  INSERT INTO public.user_data (id, email, account_id, data)
  VALUES (
    NEW.id,
    NEW.email,
    new_account_id,
    jsonb_build_object(
      'p', jsonb_build_object('name', COALESCE(NEW.raw_user_meta_data->>'name', ''), 'email', NEW.email, 'plan', 'free'),
      'trm', 4200,
      'inv', '[]'::jsonb,
      'deu', '[]'::jsonb,
      'gas', '{}'::jsonb,
      'ibk', '[]'::jsonb,
      'ingresos', '[]'::jsonb,
      'metas', '[]'::jsonb
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- El trigger sobre auth.users.AFTER INSERT ya existe (definido en schema-simple.sql),
-- y al ser CREATE OR REPLACE FUNCTION queda automáticamente actualizado.

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-PATCH
-- ─────────────────────────────────────────────────────────────────────────
-- 1. Confirmar que NO existen policies legacy:
--    SELECT polname FROM pg_policy
--    WHERE polrelid = 'public.user_data'::regclass
--      AND polname IN ('Users can view own data','Users can insert own data',
--                       'Users can update own data','Users can delete own data');
--    -- Debe devolver 0 filas.
--
-- 2. Confirmar que la función helper existe:
--    SELECT proname FROM pg_proc WHERE proname = 'is_account_member';
--    -- Debe devolver 1 fila.
--
-- 3. Smoke test rápido:
--    SELECT public.is_account_member(
--      (SELECT account_id FROM public.user_data WHERE id = auth.uid())
--    );
--    -- Debe devolver TRUE.
-- ═══════════════════════════════════════════════════════════════════════════
