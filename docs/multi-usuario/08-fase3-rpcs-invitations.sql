-- ═══════════════════════════════════════════════════════════════════════════
-- FINPATHIA — FASE 3 Commit 1: RPCs de invitaciones Pro Familiar
--
-- Ya aplicado en producción como migrations:
--   - multi_usuario_fase3_rpcs_invitations  (las 6 RPCs principales)
--   - multi_usuario_fase3_list_rpcs         (2 RPCs lectoras para UI)
--
-- Este archivo es el código fuente versionado. Si hay que reaplicar/migrar
-- a otra DB, ejecutar este SQL completo (es idempotente: usa CREATE OR REPLACE).
--
-- API resultante (callable desde authenticated):
--
--   • max_members_for_plan(plan TEXT) RETURNS INT
--     basic=1, pro=3, pro_familiar=10, managed=5, default=1
--
--   • create_invitation(account_id UUID, email TEXT, role TEXT) RETURNS JSONB
--     -> { invitation_id, token, invitation_url, expires_at, email, role }
--     Errores típicos:
--       42501 = no sos admin
--       22023 = role/email inválido
--       23505 = email ya es miembro o ya tiene invitación pendiente
--       custom = "Cuenta llena: ..." si excede max_members
--
--   • accept_invitation(token TEXT) RETURNS JSONB
--     -> { account_id, account_name, role }
--     Email del caller debe matchear el de la invitación.
--
--   • revoke_invitation(invitation_id UUID) RETURNS JSONB
--     -> { revoked: true, invitation_id }
--
--   • remove_member(account_id UUID, user_id UUID) RETURNS JSONB
--     -> { removed: true, user_id }
--     No te podés autoexpulsar; trigger protect_last_admin protege el último admin.
--
--   • update_member_role(account_id UUID, user_id UUID, new_role TEXT) RETURNS JSONB
--     -> { updated: true, user_id, new_role }
--
--   • list_account_members(account_id UUID) RETURNS TABLE(...)
--     Solo si sos miembro. Ordenado: owner -> admins -> readers.
--
--   • list_pending_invitations(account_id UUID) RETURNS TABLE(...)
--     Solo si sos admin. Excluye consumidas y expiradas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: capacity por plan ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.max_members_for_plan(p_plan TEXT)
RETURNS INT AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'basic'        THEN 1
    WHEN 'pro'          THEN 3
    WHEN 'pro_familiar' THEN 10
    WHEN 'managed'      THEN 5
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── RPC: create_invitation ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_account_id UUID,
  p_email      TEXT,
  p_role       TEXT
)
RETURNS JSONB AS $$
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
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_account_member(p_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden invitar miembros' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'reader') THEN
    RAISE EXCEPTION 'Rol inválido. Use admin o reader.' USING ERRCODE = '22023';
  END IF;
  IF p_email IS NULL OR p_email = '' OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido' USING ERRCODE = '22023';
  END IF;
  v_norm_email := LOWER(TRIM(p_email));

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

  INSERT INTO public.account_invitations (account_id, email, role, invited_by)
  VALUES (p_account_id, v_norm_email, p_role, v_caller)
  RETURNING id, token, expires_at INTO v_invitation_id, v_token, v_expires_at;

  RETURN jsonb_build_object(
    'invitation_id',  v_invitation_id,
    'token',          v_token,
    'invitation_url', 'https://finpathia.com/invite/' || v_token,
    'expires_at',     v_expires_at,
    'email',          v_norm_email,
    'role',           p_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: accept_invitation ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS JSONB AS $$
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

  SELECT LOWER(email) INTO v_caller_email FROM auth.users WHERE id = v_caller;

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

  IF LOWER(v_invitation.email) <> v_caller_email THEN
    RAISE EXCEPTION 'Esta invitación es para % pero estás logueado como %',
      v_invitation.email, v_caller_email
      USING HINT = 'Cerrá sesión y entrá con el email correcto';
  END IF;

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

  UPDATE public.account_invitations
  SET consumed_at = NOW()
  WHERE id = v_invitation.id;

  SELECT display_name INTO v_account_name
    FROM public.accounts WHERE id = v_invitation.account_id;

  RETURN jsonb_build_object(
    'account_id',   v_invitation.account_id,
    'account_name', v_account_name,
    'role',         v_invitation.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: revoke_invitation ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller     UUID := auth.uid();
  v_account_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501';
  END IF;

  SELECT account_id INTO v_account_id
    FROM public.account_invitations WHERE id = p_invitation_id;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Invitación no encontrada';
  END IF;

  IF NOT public.is_account_member(v_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden revocar invitaciones' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.account_invitations WHERE id = p_invitation_id;

  RETURN jsonb_build_object('revoked', TRUE, 'invitation_id', p_invitation_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: remove_member ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_member(
  p_account_id UUID,
  p_user_id    UUID
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_account_member(p_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden expulsar miembros' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'No podés expulsarte a vos mismo'
      USING HINT = 'Pedile a otro admin que te quite, o degradá tu cuenta a un plan menor';
  END IF;
  DELETE FROM public.account_members
  WHERE account_id = p_account_id AND user_id = p_user_id;

  RETURN jsonb_build_object('removed', TRUE, 'user_id', p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: update_member_role ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_member_role(
  p_account_id UUID,
  p_user_id    UUID,
  p_new_role   TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_account_member(p_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden cambiar roles' USING ERRCODE = '42501';
  END IF;
  IF p_new_role NOT IN ('admin', 'reader') THEN
    RAISE EXCEPTION 'Rol inválido. Use admin o reader.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.account_members
  SET role = p_new_role
  WHERE account_id = p_account_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Miembro no encontrado en esa cuenta';
  END IF;

  RETURN jsonb_build_object('updated', TRUE, 'user_id', p_user_id, 'new_role', p_new_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: list_account_members (lectura para UI Mi Cuenta) ─────────────
CREATE OR REPLACE FUNCTION public.list_account_members(p_account_id UUID)
RETURNS TABLE(
  user_id      UUID,
  email        TEXT,
  display_name TEXT,
  role         TEXT,
  status       TEXT,
  invited_at   TIMESTAMPTZ,
  accepted_at  TIMESTAMPTZ,
  is_owner     BOOLEAN
) AS $$
BEGIN
  IF NOT public.is_account_member(p_account_id) THEN
    RAISE EXCEPTION 'No tenés acceso a esta cuenta' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      am.user_id,
      u.email::TEXT,
      COALESCE(u.raw_user_meta_data->>'name', SPLIT_PART(u.email, '@', 1))::TEXT AS display_name,
      am.role,
      am.status,
      am.invited_at,
      am.accepted_at,
      (a.owner_user_id = am.user_id) AS is_owner
    FROM public.account_members am
    JOIN auth.users u ON u.id = am.user_id
    JOIN public.accounts a ON a.id = am.account_id
    WHERE am.account_id = p_account_id
    ORDER BY
      (a.owner_user_id = am.user_id) DESC,
      am.role = 'admin' DESC,
      am.accepted_at NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RPC: list_pending_invitations (lectura para UI Mi Cuenta) ─────────
CREATE OR REPLACE FUNCTION public.list_pending_invitations(p_account_id UUID)
RETURNS TABLE(
  invitation_id  UUID,
  email          TEXT,
  role           TEXT,
  invited_at     TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  invited_by     UUID,
  invitation_url TEXT
) AS $$
BEGIN
  IF NOT public.is_account_member(p_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden ver invitaciones pendientes' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      inv.id AS invitation_id,
      inv.email,
      inv.role,
      inv.invited_at,
      inv.expires_at,
      inv.invited_by,
      ('https://finpathia.com/invite/' || inv.token)::TEXT AS invitation_url
    FROM public.account_invitations inv
    WHERE inv.account_id = p_account_id
      AND inv.consumed_at IS NULL
      AND inv.expires_at > NOW()
    ORDER BY inv.invited_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── GRANTs ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.max_members_for_plan(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invitation(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_account_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_invitations(UUID) TO authenticated;
