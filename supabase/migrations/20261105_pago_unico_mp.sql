-- ═══════════════════════════════════════════════════════════════════════════
-- 5-nov-2026 · Pago único por Mercado Pago (PSE, Efecty, tarjeta, saldo MP)
--
-- Santiago: "¿podemos crear un pago único anual que puedan pagar por PSE?".
-- Las suscripciones automáticas de Mercado Pago solo aceptan tarjeta. El pago
-- único (Checkout Pro) acepta PSE y Efecty, pero no se renueva solo.
--
-- Modelo: el plan queda activo y la cuenta en subscription_status='canceled'
-- con grace_until = fecha hasta la que pagó. El cron diario existente
-- (expire_canceled_accounts) la baja a free al vencer, igual que una
-- suscripción cancelada. accounts.pago_unico distingue este caso para que la
-- app diga "pagado hasta…" y no "tu plan fue cancelado".
--
-- Renovar antes de vencer suma los meses desde la fecha de vencimiento, no
-- desde hoy. Idempotente por payment_id (Mercado Pago reintenta los avisos).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS pago_unico boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.activar_pago_unico(p_user_id uuid, p_plan text, p_payment_id text, p_meses int)
 RETURNS timestamptz
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente text := 'mp_pago_' || p_payment_id;
  v_previo jsonb;
  v_acc uuid;
  v_estado text;
  v_gracia timestamptz;
  v_era_unico boolean;
  v_base timestamptz;
  v_hasta timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_payment_id IS NULL OR p_meses NOT IN (1, 12)
     OR p_plan NOT IN ('basico', 'pro', 'pro_familiar') THEN
    RAISE EXCEPTION 'activar_pago_unico: parámetros inválidos';
  END IF;

  -- Ya procesado: devolver la misma fecha sin volver a sumar.
  SELECT diff INTO v_previo FROM account_audit_log
   WHERE action = 'pago_unico' AND diff->>'payment_id' = p_payment_id LIMIT 1;
  IF v_previo IS NOT NULL THEN
    RETURN (v_previo->>'hasta')::timestamptz;
  END IF;

  SELECT a.id, a.subscription_status, a.grace_until, a.pago_unico
    INTO v_acc, v_estado, v_gracia, v_era_unico
    FROM user_data ud JOIN accounts a ON a.id = ud.account_id AND a.owner_user_id = ud.id
   WHERE ud.id = p_user_id;

  v_base := CASE WHEN v_era_unico AND v_estado = 'canceled' AND v_gracia > NOW() THEN v_gracia ELSE NOW() END;
  v_hasta := v_base + make_interval(months => p_meses);

  IF p_plan = 'pro_familiar' THEN
    PERFORM public.activate_pro_familiar(p_user_id, v_cliente, 'Mi cuenta');
  ELSE
    PERFORM public.update_user_plan_after_stripe(p_user_id, p_plan, v_cliente);
  END IF;

  -- La cuenta pudo crearse en activate_pro_familiar: se vuelve a leer.
  SELECT a.id INTO v_acc
    FROM user_data ud JOIN accounts a ON a.id = ud.account_id AND a.owner_user_id = ud.id
   WHERE ud.id = p_user_id;

  UPDATE accounts
     SET subscription_status = 'canceled', grace_until = v_hasta, pago_unico = true, updated_at = NOW()
   WHERE id = v_acc;

  INSERT INTO account_audit_log (account_id, user_id, action, entity_type, entity_id, diff)
  VALUES (v_acc, p_user_id, 'pago_unico', 'subscription', p_payment_id,
          jsonb_build_object('payment_id', p_payment_id, 'plan', p_plan, 'meses', p_meses, 'hasta', v_hasta));

  RETURN v_hasta;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.activar_pago_unico(uuid, text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activar_pago_unico(uuid, text, text, int) TO service_role;

-- Cuando una suscripción automática se activa, la cuenta deja de ser de pago único.
CREATE OR REPLACE FUNCTION public._limpiar_pago_unico() RETURNS trigger
 LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $f$
BEGIN
  IF NEW.subscription_status = 'active' AND NEW.pago_unico THEN NEW.pago_unico := false; END IF;
  RETURN NEW;
END; $f$;
DROP TRIGGER IF EXISTS trg_limpiar_pago_unico ON public.accounts;
CREATE TRIGGER trg_limpiar_pago_unico BEFORE UPDATE OF subscription_status ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public._limpiar_pago_unico();
