-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 2026-10-11 — SECUENCIA DE CORREOS DE LA PRUEBA PRO (14 DÍAS)
--
-- NO APLICADA. Se aplica a prod solo con el OK de Luis y ANTES de prender
-- LIFECYCLE_EMAILS_ENABLED. Mientras no se aplique, el cron y los eventos
-- fallan de forma controlada (lo dejan en el log) y el chat sigue igual.
--
-- 1. Columnas de ciclo de vida en accounts (fuera del blob user_data.data).
-- 2. El navegador NO puede escribirlas: se extiende protect_accounts_billing.
-- 3. Backfill de trial_end.
-- 4. Tabla lifecycle_email_sends (registro de envíos reales y de prueba).
-- Rollback al final, comentado.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Columnas ─────────────────────────────────────────────────────
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS trial_end             date,
  ADD COLUMN IF NOT EXISTS activated_at          timestamptz,
  ADD COLUMN IF NOT EXISTS advisor_first_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS simulator_first_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seq_email        text,
  ADD COLUMN IF NOT EXISTS seq_sent              jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seq_variant           text,
  ADD COLUMN IF NOT EXISTS email_unsubscribed_at timestamptz,
  ADD COLUMN IF NOT EXISTS entry_utm             jsonb,
  ADD COLUMN IF NOT EXISTS entry_angle           text;

COMMENT ON COLUMN public.accounts.trial_end IS 'Fin de la prueba Pro (fecha). Lo fija el servidor al registrarse (14 días; 30 para invitados).';
COMMENT ON COLUMN public.accounts.activated_at IS 'Primer activo cargado en Patrimonio (evento activation; el servidor comprueba user_data.data.inv). Una sola vez.';
COMMENT ON COLUMN public.accounts.advisor_first_used_at IS 'Primera pregunta al Asesor IA durante la prueba (evento advisor_used).';
COMMENT ON COLUMN public.accounts.simulator_first_used_at IS 'Primera vez que abre el simulador, sim o simf (evento simulator_used). Una sola vez. Solo analítica: ninguna variante lo usa.';
COMMENT ON COLUMN public.accounts.seq_sent IS 'Pasos de la secuencia ENVIADOS de verdad: {"d2":"<iso>", ...}. Los dry run no cuentan.';
COMMENT ON COLUMN public.accounts.last_seq_email IS 'Último correo de la secuencia enviado (ej. d10_sin_asesor).';
COMMENT ON COLUMN public.accounts.seq_variant IS 'Variante d13 asignada al azar 50/50: urgencia | valor.';
COMMENT ON COLUMN public.accounts.email_unsubscribed_at IS 'Baja de los correos de la secuencia.';
COMMENT ON COLUMN public.accounts.entry_utm IS 'UTM de entrada (solo utm_*), sin datos personales.';
COMMENT ON COLUMN public.accounts.entry_angle IS 'Ángulo de entrada (ej. renta:declaracion, pioneros).';

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_seq_variant_check;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_seq_variant_check
  CHECK (seq_variant IS NULL OR seq_variant IN ('urgencia', 'valor'));

-- ─── 2. Protección: el navegador no escribe columnas de ciclo de vida ─
-- Misma función que ya existía (definición leída de prod el 11-oct-2026),
-- con las columnas nuevas agregadas. service_role / postgres pasan igual.
CREATE OR REPLACE FUNCTION public.protect_accounts_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF current_user NOT IN ('anon', 'authenticated') THEN
 RETURN NEW;
 END IF;
 IF TG_OP = 'UPDATE' THEN
 NEW.plan := OLD.plan;
 NEW.max_members := OLD.max_members;
 NEW.subscription_status := OLD.subscription_status;
 NEW.managed_by_advisor_id := OLD.managed_by_advisor_id;
 NEW.managed_tier := OLD.managed_tier;
 NEW.managed_at := OLD.managed_at;
 NEW.grace_until := OLD.grace_until;
 NEW.owner_user_id := OLD.owner_user_id;
 -- 11-oct-2026: ciclo de vida (secuencia de la prueba)
 NEW.trial_end := OLD.trial_end;
 NEW.activated_at := OLD.activated_at;
 NEW.advisor_first_used_at := OLD.advisor_first_used_at;
 NEW.simulator_first_used_at := OLD.simulator_first_used_at;
 NEW.last_seq_email := OLD.last_seq_email;
 NEW.seq_sent := OLD.seq_sent;
 NEW.seq_variant := OLD.seq_variant;
 NEW.email_unsubscribed_at := OLD.email_unsubscribed_at;
 NEW.entry_utm := OLD.entry_utm;
 NEW.entry_angle := OLD.entry_angle;
 ELSE
 NEW.plan := 'free';
 NEW.max_members := 1;
 NEW.subscription_status := 'active';
 NEW.managed_by_advisor_id := NULL;
 NEW.managed_tier := NULL;
 NEW.managed_at := NULL;
 NEW.grace_until := NULL;
 -- 11-oct-2026: ciclo de vida
 NEW.trial_end := ((now() AT TIME ZONE 'utc') + interval '14 days')::date;
 NEW.activated_at := NULL;
 NEW.advisor_first_used_at := NULL;
 NEW.simulator_first_used_at := NULL;
 NEW.last_seq_email := NULL;
 NEW.seq_sent := '{}'::jsonb;
 NEW.seq_variant := NULL;
 NEW.email_unsubscribed_at := NULL;
 NEW.entry_utm := NULL;
 NEW.entry_angle := NULL;
 END IF;
 RETURN NEW;
END;
$function$;

-- ─── 3. Backfill de trial_end ────────────────────────────────────────
-- a) Blob legible con p.trialEnd ("YYYY-MM-DD" o ISO): se toma la fecha.
-- b) Blob cifrado o sin trialEnd: created_at + 14 días.
-- (Al 11-oct-2026: 81 cuentas con trialEnd legible, 16 sin él, 0 con
--  "_encrypted".) Toca updated_at de las cuentas por el trigger existente.
UPDATE public.accounts a
SET trial_end = COALESCE(
  (SELECT CASE
            WHEN NOT (u.data ? '_encrypted')
             AND (u.data -> 'p' ->> 'trialEnd') ~ '^\d{4}-\d{2}-\d{2}'
            THEN left(u.data -> 'p' ->> 'trialEnd', 10)::date
          END
     FROM public.user_data u
    WHERE u.id = a.owner_user_id),
  ((a.created_at AT TIME ZONE 'utc') + interval '14 days')::date
)
WHERE a.trial_end IS NULL;

-- Cuentas nuevas: 14 días por defecto (auth-signup lo ajusta a 30 para
-- invitados). Se pone DESPUÉS del backfill para no pisar las existentes.
ALTER TABLE public.accounts
  ALTER COLUMN trial_end SET DEFAULT ((now() AT TIME ZONE 'utc') + interval '14 days')::date;

CREATE INDEX IF NOT EXISTS accounts_trial_end_idx ON public.accounts (trial_end) WHERE plan = 'free';

-- ─── 4. Registro de envíos ───────────────────────────────────────────
-- Una fila por correo enviado (dry_run=false) o simulado (dry_run=true,
-- máximo una por persona y email_key). Analítica la cruza con quién pagó.
-- Solo service_role lee y escribe: RLS activo y SIN políticas.
CREATE TABLE IF NOT EXISTS public.lifecycle_email_sends (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_key   text NOT NULL,          -- d2_sin_activo … d10, d13_urgencia, d13_valor, d16
  utm_content text NOT NULL,          -- variante en utm_content
  d13_variant text CHECK (d13_variant IS NULL OR d13_variant IN ('urgencia', 'valor')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  dry_run     boolean NOT NULL,
  resend_id   text,
  error       text
);
COMMENT ON TABLE public.lifecycle_email_sends IS 'Correos de la secuencia de prueba: enviados (dry_run=false) y simulados (dry_run=true). user_id = dueño de la cuenta.';

CREATE INDEX IF NOT EXISTS lifecycle_email_sends_user_key_idx
  ON public.lifecycle_email_sends (user_id, email_key);
-- Un solo dry run por persona y correo (el cron además lo verifica antes).
CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_email_sends_dry_run_uniq
  ON public.lifecycle_email_sends (user_id, email_key) WHERE dry_run;

ALTER TABLE public.lifecycle_email_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lifecycle_email_sends FROM anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- ROLLBACK (manual, en este orden):
--
-- DROP TABLE IF EXISTS public.lifecycle_email_sends;
-- DROP INDEX IF EXISTS public.accounts_trial_end_idx;
-- ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_seq_variant_check;
-- CREATE OR REPLACE FUNCTION public.protect_accounts_billing()
--  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- BEGIN
--  IF current_user NOT IN ('anon', 'authenticated') THEN RETURN NEW; END IF;
--  IF TG_OP = 'UPDATE' THEN
--  NEW.plan := OLD.plan; NEW.max_members := OLD.max_members;
--  NEW.subscription_status := OLD.subscription_status;
--  NEW.managed_by_advisor_id := OLD.managed_by_advisor_id;
--  NEW.managed_tier := OLD.managed_tier; NEW.managed_at := OLD.managed_at;
--  NEW.grace_until := OLD.grace_until; NEW.owner_user_id := OLD.owner_user_id;
--  ELSE
--  NEW.plan := 'free'; NEW.max_members := 1; NEW.subscription_status := 'active';
--  NEW.managed_by_advisor_id := NULL; NEW.managed_tier := NULL;
--  NEW.managed_at := NULL; NEW.grace_until := NULL;
--  END IF;
--  RETURN NEW;
-- END;
-- $function$;
-- ALTER TABLE public.accounts
--   DROP COLUMN IF EXISTS trial_end,
--   DROP COLUMN IF EXISTS activated_at,
--   DROP COLUMN IF EXISTS advisor_first_used_at,
--   DROP COLUMN IF EXISTS simulator_first_used_at,
--   DROP COLUMN IF EXISTS last_seq_email,
--   DROP COLUMN IF EXISTS seq_sent,
--   DROP COLUMN IF EXISTS seq_variant,
--   DROP COLUMN IF EXISTS email_unsubscribed_at,
--   DROP COLUMN IF EXISTS entry_utm,
--   DROP COLUMN IF EXISTS entry_angle;
-- ═══════════════════════════════════════════════════════════════════
