-- ═══════════════════════════════════════════════════════════════════════════
-- Rol «contador» (30-oct-2026, Santiago: "una sección de usuarios donde uno pueda
-- ingresar hasta 3 personas con el mismo acceso y a los contadores acceso de solo
-- lectura").
--
--  · El contador NO cuenta dentro del límite de miembros del plan (máx. 3 contadores).
--  · El contador NO lee user_data completo: is_account_member(cuenta) sin rol lo
--    excluye, así que las políticas de lectura existentes no le dan acceso.
--  · Lo que ve sale de contador_datos(): solo titulares y declaraciones, ingresos,
--    bienes, deudas, los gastos que cuentan para la renta (y todos los de sociedades),
--    el estimado de renta y la TRM. Cada consulta queda en account_audit_log.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.account_members DROP CONSTRAINT IF EXISTS account_members_role_check;
ALTER TABLE public.account_members ADD CONSTRAINT account_members_role_check CHECK (role = ANY (ARRAY['admin','reader','contador']));
ALTER TABLE public.account_invitations DROP CONSTRAINT IF EXISTS account_invitations_role_check;
ALTER TABLE public.account_invitations ADD CONSTRAINT account_invitations_role_check CHECK (role = ANY (ARRAY['admin','reader','contador']));

-- Sin rol pedido = miembro de la familia (admin o reader). El contador solo cuenta si se pide explícito.
CREATE OR REPLACE FUNCTION public.is_account_member(p_account_id uuid, p_role text DEFAULT NULL::text)
 RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = p_account_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND ((p_role IS NULL AND role <> 'contador') OR role = p_role)
  );
END;
$function$;

-- Límite: los contadores van aparte (máx. 3) y no ocupan cupo de la familia.
CREATE OR REPLACE FUNCTION public.enforce_max_members()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current_count INT;
  v_max_allowed INT;
  v_already_exists BOOLEAN;
  v_es_contador BOOLEAN := (NEW.role = 'contador');
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

  IF v_es_contador THEN
    v_max_allowed := 3;
  ELSE
    SELECT max_members INTO v_max_allowed FROM public.accounts WHERE id = NEW.account_id;
    IF v_max_allowed IS NULL THEN
      RAISE EXCEPTION 'Cuenta % no encontrada (race condition?)', NEW.account_id;
    END IF;
  END IF;

  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION '%', CASE WHEN v_es_contador THEN 'Ya tienes 3 contadores con acceso' ELSE format('Cuenta llena: %s miembros activos (límite del plan: %s)', v_current_count, v_max_allowed) END
      USING HINT = 'Quita a alguien antes de invitar a otro';
  END IF;
  RETURN NEW;
END;
$function$;

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

  IF v_es_contador THEN
    v_max := 3;
  ELSE
    SELECT max_members INTO v_max FROM public.accounts WHERE id = p_account_id;
    IF v_max IS NULL THEN RAISE EXCEPTION 'Cuenta no encontrada' USING ERRCODE = '23503'; END IF;
  END IF;

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

-- Un contador no se vuelve miembro de la familia cambiándole el rol.
CREATE OR REPLACE FUNCTION public.update_member_role(p_account_id uuid, p_user_id uuid, p_new_role text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Sesión no autenticada' USING ERRCODE = '42501'; END IF;
  IF NOT public.is_account_member(p_account_id, 'admin') THEN
    RAISE EXCEPTION 'Solo administradores pueden cambiar roles' USING ERRCODE = '42501';
  END IF;
  IF p_new_role NOT IN ('admin', 'reader') THEN
    RAISE EXCEPTION 'Rol inválido. Use admin o reader.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_members WHERE account_id = p_account_id AND user_id = p_user_id AND role = 'contador') THEN
    RAISE EXCEPTION 'A un contador no se le cambia el rol: quítalo e invítalo de nuevo como persona de la cuenta' USING ERRCODE = '22023';
  END IF;
  UPDATE public.account_members SET role = p_new_role WHERE account_id = p_account_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Miembro no encontrado en esa cuenta'; END IF;
  RETURN jsonb_build_object('updated', TRUE, 'user_id', p_user_id, 'new_role', p_new_role);
END;
$function$;

-- Cuentas que le compartieron al contador que llama.
CREATE OR REPLACE FUNCTION public.contador_mis_clientes()
 RETURNS TABLE(account_id uuid, account_name text, owner_email text, owner_name text, accepted_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT a.id, a.display_name::text, u.email::text,
           COALESCE(u.raw_user_meta_data->>'name', SPLIT_PART(u.email, '@', 1))::text, am.accepted_at
    FROM public.account_members am
    JOIN public.accounts a ON a.id = am.account_id
    JOIN auth.users u ON u.id = a.owner_user_id
    WHERE am.user_id = auth.uid() AND am.role = 'contador' AND am.status = 'active'
    ORDER BY am.accepted_at DESC NULLS LAST;
END;
$function$;

-- Lo único que el contador ve de una cuenta. Nada de gastos del día a día, metas ni escenarios.
CREATE OR REPLACE FUNCTION public.contador_datos(p_account_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  d jsonb;
  v_jur jsonb;
  v_gas jsonb;
  v_owner uuid;
BEGIN
  IF NOT public.is_account_member(p_account_id, 'contador') THEN
    RAISE EXCEPTION 'No tienes acceso de contador a esta cuenta' USING ERRCODE = '42501';
  END IF;
  SELECT owner_user_id INTO v_owner FROM public.accounts WHERE id = p_account_id;
  SELECT ud.data INTO d FROM public.user_data ud WHERE ud.account_id = p_account_id
    ORDER BY (ud.id = v_owner) DESC, ud.updated_at DESC LIMIT 1;

  INSERT INTO public.account_audit_log (account_id, user_id, action, entity_type, entity_id)
  VALUES (p_account_id, auth.uid(), 'contador_consulta', 'user_data', p_account_id::text);

  IF d IS NULL THEN RETURN jsonb_build_object('vacio', true); END IF;
  IF jsonb_typeof(d) <> 'object' THEN RETURN jsonb_build_object('cifrado', true); END IF;

  SELECT COALESCE(jsonb_agg(o->>'id'), '[]'::jsonb) INTO v_jur
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(d->'owners') = 'array' THEN d->'owners' ELSE '[]'::jsonb END) o
    WHERE o->>'type' = 'juridica';

  SELECT COALESCE(jsonb_object_agg(cat, items), '{}'::jsonb) INTO v_gas FROM (
    SELECT c.key AS cat, jsonb_agg(e) AS items
    FROM jsonb_each(CASE WHEN jsonb_typeof(d->'gas') = 'object' THEN d->'gas' ELSE '{}'::jsonb END) c,
         jsonb_array_elements(CASE WHEN jsonb_typeof(c.value) = 'array' THEN c.value ELSE '[]'::jsonb END) e
    WHERE c.key = ANY (ARRAY['Aporte tributario', 'Inmueble arrendado', 'Impuesto', 'Seguridad Social'])
       OR (v_jur ? COALESCE(e->>'owner', ''))
    GROUP BY c.key) x;

  RETURN jsonb_build_object(
    'owners', COALESCE(d->'owners', '[]'::jsonb),
    'ingresos', COALESCE(d->'ingresos', '[]'::jsonb),
    'inv', COALESCE(d->'inv', '[]'::jsonb),
    'deu', COALESCE(d->'deu', '[]'::jsonb),
    'gas', v_gas,
    'estimadoRenta', COALESCE(d->'estimadoRenta', '{}'::jsonb),
    'calculosGO', COALESCE(d->'calculosGO', '[]'::jsonb),
    'trm', d->'trm'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.contador_datos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contador_datos(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.contador_mis_clientes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contador_mis_clientes() TO authenticated;

-- (aplicada aparte como user_data_updated_at_servidor)
-- La versión de user_data la pone el servidor, no el reloj del navegador.
CREATE OR REPLACE FUNCTION public.user_data_set_updated_at()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS user_data_updated_at ON public.user_data;
CREATE TRIGGER user_data_updated_at BEFORE INSERT OR UPDATE ON public.user_data
  FOR EACH ROW EXECUTE FUNCTION public.user_data_set_updated_at();
