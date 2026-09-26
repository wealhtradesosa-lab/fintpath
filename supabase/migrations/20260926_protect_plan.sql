-- ═══════════════════════════════════════════════════════════════════════════
-- FINPATHIA · 20260926_protect_plan.sql
--
-- ⚠️  BORRADOR — NO APLICADO. Lo tiene que correr el dueño en Supabase
--     (SQL Editor del proyecto de producción). Revisar antes de ejecutar.
--
-- PROBLEMA
--   La RLS de user_data deja que el usuario actualice SU fila completa. El
--   autoguardado de la app sube el blob `data` entero, así que:
--     1. Una pestaña con datos viejos pisa el data->p->plan que escribió el
--        webhook de Stripe (el usuario paga y vuelve a verse en "free").
--     2. Cualquiera puede ponerse p.plan = "pro", alargar p.trialEnd o
--        cambiar stripe_customer_id desde la consola del navegador.
--
-- SOLUCIÓN
--   Trigger BEFORE INSERT OR UPDATE en public.user_data. Si quien escribe es
--   un cliente (rol JWT 'anon' o 'authenticated'):
--     · plan (columna) y stripe_customer_id → se conservan los valores
--       anteriores (en INSERT: 'free' y NULL).
--     · data->p->plan → se conserva el anterior ('free' si no había).
--     · data->p->trialEnd → si ya existía se conserva; si no, se acepta la
--       primera vez (cuentaNueva() lo escribe al registrarse) con tope
--       created_at + 14 días (30 SOLO para los emails invitados, misma lista
--       que planEstado.js); si viene inválido o mayor, se fija en ese tope
--       (ISO exacto, igual que la app). Acepta "YYYY-MM-DD" o ISO completo.
--   service_role (webhook, RPCs update_user_plan_after_stripe /
--   handle_subscription_* / activate_pro_familiar, funciones Netlify, crons)
--   y el SQL Editor (sin JWT) NO se ven afectados.
--
-- EFECTOS A SABER
--   · El selector "Plan manual" del admin dentro de la app deja de funcionar
--     (es un cliente 'authenticated'). Cambiar planes a mano desde el SQL
--     Editor o con admin-fix-plans (usa service key).
--   · Datos cifrados (data._encrypted) no tienen `p` legible: ahí solo se
--     protegen las columnas plan y stripe_customer_id.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.protect_user_data_plan()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_claims text := current_setting('request.jwt.claims', true);
  v_role   text;
  v_created timestamptz;
  v_default_te text;
  v_old_p  jsonb;
  v_new_te text;
  v_email  text;
  v_dias   int;
begin
  v_role := coalesce(nullif(v_claims, '')::jsonb ->> 'role', auth.role(), '');

  -- Solo se protege a clientes. service_role / postgres / SQL Editor pasan.
  if v_role not in ('anon', 'authenticated') then
    return new;
  end if;

  select u.created_at, lower(trim(u.email)) into v_created, v_email from auth.users u where u.id = new.id;
  -- Prueba de 30 días SOLO para invitados. MISMA lista que INVITADOS_30D en
  -- src/lib/planEstado.js y netlify/functions/stripe-checkout.cjs.
  v_dias := case when v_email in ('andres.isaza@grupogiesas.com', 'renatomaestri76@hotmail.com') then 30 else 14 end;
  -- Mismo instante que la app (planEstado.js) y stripe-checkout: created_at +
  -- 14 (o 30) días exactos, ISO en UTC.
  v_default_te := to_char((coalesce(v_created, now()) + make_interval(days => v_dias)) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  if tg_op = 'UPDATE' then
    new.plan := old.plan;
    new.stripe_customer_id := old.stripe_customer_id;
    v_old_p := case when jsonb_typeof(old.data -> 'p') = 'object' then old.data -> 'p' else null end;
  else
    new.plan := 'free';
    new.stripe_customer_id := null;
    v_old_p := null;
  end if;

  -- Blob cifrado o sin `p`: no hay nada legible que proteger dentro de data.
  if new.data is null or new.data ? '_encrypted' or jsonb_typeof(new.data -> 'p') is distinct from 'object' then
    return new;
  end if;

  -- p.plan: siempre el valor anterior (o 'free').
  new.data := jsonb_set(new.data, '{p,plan}', coalesce(v_old_p -> 'plan', to_jsonb('free'::text)), true);

  -- p.trialEnd
  if v_old_p is not null and v_old_p ? 'trialEnd' then
    new.data := jsonb_set(new.data, '{p,trialEnd}', v_old_p -> 'trialEnd', true);
  elsif new.data -> 'p' ? 'trialEnd' then
    v_new_te := new.data -> 'p' ->> 'trialEnd';
    begin
      if v_new_te is null
         or v_new_te !~ '^\d{4}-\d{2}-\d{2}'
         -- 1 h de margen: cuentaNueva() calcula "ahora + 14 días" en el
         -- navegador unos segundos después de created_at.
         or v_new_te::timestamptz > coalesce(v_created, now()) + make_interval(days => v_dias) + interval '1 hour' then
        new.data := jsonb_set(new.data, '{p,trialEnd}', to_jsonb(v_default_te), true);
      end if;
    exception when others then
      new.data := jsonb_set(new.data, '{p,trialEnd}', to_jsonb(v_default_te), true);
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_user_data_plan on public.user_data;
create trigger protect_user_data_plan
  before insert or update on public.user_data
  for each row execute function public.protect_user_data_plan();

-- ─── Verificación (correr después, con un usuario de prueba) ──────────────
-- Como authenticated (desde la app / consola del navegador):
--   update user_data set data = jsonb_set(data, '{p,plan}', '"pro"') where id = auth.uid();
--   select data->'p'->>'plan', plan from user_data where id = auth.uid();  -- debe seguir 'free'
-- Como service_role (webhook): select update_user_plan_after_stripe(...) debe
-- seguir cambiando el plan.
--
-- ─── Rollback ─────────────────────────────────────────────────────────────
--   drop trigger if exists protect_user_data_plan on public.user_data;
--   drop function if exists public.protect_user_data_plan();
