-- ═══════════════════════════════════════════════════════════════════════════
-- FINPATHIA — FASE 3 Commit 3: validate_invitation_token RPC
--
-- Aplicado en producción como migration:
--   - multi_usuario_validate_invitation_token
--
-- Permite que un usuario NO autenticado (anon) consulte la información
-- pública de una invitación antes de hacer signup/login. Devuelve null
-- si el token no existe / expirada / consumida — el cliente puede
-- caer limpiamente a otros flujos (ej: advisor invitations).
--
-- USADO POR: src/components/AcceptInvite.jsx en Step 1 (validar token).
-- Si la RPC devuelve null, AcceptInvite cae al netlify function existente
-- /.netlify/functions/advisor-accept-invite (flujo legacy intacto).
--
-- Después de signup/login, el cliente llama accept_invitation(token)
-- (definida en 08-fase3-rpcs-invitations.sql) que matchea email del
-- caller con email de la invitación y crea la membership.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_inv            RECORD;
  v_account_name   TEXT;
  v_inviter_email  TEXT;
  v_inviter_name   TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_inv
    FROM public.account_invitations
    WHERE token = p_token
      AND consumed_at IS NULL
      AND expires_at > NOW()
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT display_name INTO v_account_name
    FROM public.accounts WHERE id = v_inv.account_id;

  SELECT
    email,
    COALESCE(raw_user_meta_data->>'name', SPLIT_PART(email, '@', 1))
  INTO v_inviter_email, v_inviter_name
    FROM auth.users WHERE id = v_inv.invited_by;

  RETURN jsonb_build_object(
    'type',              'family',
    'invitation_id',     v_inv.id,
    'account_id',        v_inv.account_id,
    'account_name',      v_account_name,
    'email_invited',     v_inv.email,
    'role',              v_inv.role,
    'invited_by_email',  v_inviter_email,
    'invited_by_name',   v_inviter_name,
    'expires_at',        v_inv.expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.validate_invitation_token(TEXT) TO anon, authenticated;
