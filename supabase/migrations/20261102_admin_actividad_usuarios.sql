-- 2-nov-2026 — Panel «Cómo va el negocio»: ¿los que se registran vuelven?
-- (Santiago: "los clientes que ingresan, ¿están cargando y regresan a la
-- página?" y "¿cuál es el cliente más curioso, el que más regresa?").
--
-- La app no guarda visitas por persona (los eventos van anónimos a GA4). Lo que
-- sí queda es la renovación de la sesión: Supabase Auth crea un refresh token
-- cada vez que una sesión abierta se renueva (al abrir la app, y cada hora
-- mientras está abierta). Los días distintos con renovación = días que la
-- persona tuvo la app abierta. Aproximado: una pestaña que se queda abierta
-- en segundo plano también renueva.
--
-- Solo la llama admin-metrics con la service key. Nadie más puede ejecutarla.
create or replace function public.admin_actividad_usuarios()
returns table (user_id uuid, dias_activos int, dias_que_volvio int, ultima_vez date)
language sql
security definer
set search_path = public, auth, pg_temp
as $$
  with act as (
    select s.user_id, (rt.created_at at time zone 'America/Bogota')::date d
    from auth.refresh_tokens rt join auth.sessions s on s.id = rt.session_id
    union
    select s.user_id, (s.created_at at time zone 'America/Bogota')::date from auth.sessions s
  )
  select u.id,
         count(distinct a.d)::int,
         (count(distinct a.d) filter (where a.d > (u.created_at at time zone 'America/Bogota')::date))::int,
         max(a.d)
  from auth.users u
  left join act a on a.user_id = u.id
  group by u.id;
$$;

revoke all on function public.admin_actividad_usuarios() from public;
revoke all on function public.admin_actividad_usuarios() from anon, authenticated;
grant execute on function public.admin_actividad_usuarios() to service_role;

-- Rollback:
-- drop function if exists public.admin_actividad_usuarios();
