-- ═══════════════════════════════════════════════════════════════════
-- 2026-10-26 — auth.uid() envuelto en (select …) dentro de las políticas RLS
--
-- PROBLEMA: `supabase db advisors --type performance` reporta 13 políticas con
-- «Auth RLS Initialization Plan». Postgres evalúa `auth.uid()` UNA VEZ POR FILA
-- cuando aparece suelto en la expresión de una política. Envuelto en
-- `(select auth.uid())` pasa a ser un InitPlan: se evalúa una sola vez por
-- consulta. Es la recomendación del propio linter de Supabase.
--
-- NO CAMBIA QUIÉN VE QUÉ. `auth.uid()` es STABLE, así que dentro de una misma
-- consulta devuelve el mismo valor fila por fila; el subselect no altera el
-- resultado, solo cuántas veces se calcula. Se verificó la invariante: quitarle
-- el envoltorio a cada expresión nueva reproduce la original CARÁCTER POR
-- CARÁCTER (13 políticas, 15 ocurrencias).
--
-- Se usa ALTER POLICY y no DROP+CREATE: conserva roles y comando, así que no
-- hay ventana en la que la tabla quede sin política.
--
-- NO SE TOCA `advisors_can_read_active_clients_user_data` (user_data): ya venía
-- con `(SELECT auth.uid())` desde la migración del #29.
--
-- RESPALDO: las 21 políticas de `public`, con su definición previa, quedaron
-- volcadas antes de aplicar. Para reconstruir una: pg_policies.qual/with_check.
--
-- VERIFICAR DESPUÉS:
--   select count(*) from pg_policies where schemaname='public'
--     and (qual ~ '(?<!select )auth\.uid\(\)' or with_check ~ '(?<!select )auth\.uid\(\)');
--   -- debe dar 0
--   supabase db advisors --linked --type performance   -- sin «Auth RLS Initialization Plan»
-- ═══════════════════════════════════════════════════════════════════

ALTER POLICY "users_can_create_own_account" ON public.accounts
  WITH CHECK ((owner_user_id = (select auth.uid())));

ALTER POLICY "Advisors can insert client relationships" ON public.advisor_clients
  WITH CHECK ((((select auth.uid()) = advisor_id) AND (status = 'pending'::text)));

ALTER POLICY "Advisors can update client relationships" ON public.advisor_clients
  USING (((select auth.uid()) = advisor_id))
  WITH CHECK ((((select auth.uid()) = advisor_id) AND (status = ( SELECT s.status
   FROM advisor_clients s
  WHERE (s.id = advisor_clients.id))) AND (client_id = ( SELECT s.client_id
   FROM advisor_clients s
  WHERE (s.id = advisor_clients.id)))));

ALTER POLICY "Advisors can view own client relationships" ON public.advisor_clients
  USING (((select auth.uid()) = advisor_id));

ALTER POLICY "Clients can accept pending advisor link" ON public.advisor_clients
  USING ((((select auth.uid()) = client_id) AND (status = 'pending'::text)))
  WITH CHECK ((((select auth.uid()) = client_id) AND (status = ANY (ARRAY['active'::text, 'removed'::text]))));

ALTER POLICY "Clients can view their own advisor relationship" ON public.advisor_clients
  USING (((select auth.uid()) = client_id));

ALTER POLICY "Advisors can manage own invitations" ON public.advisor_invitations
  USING (((select auth.uid()) = advisor_id));

ALTER POLICY "Advisors can update own record" ON public.advisors
  USING (((select auth.uid()) = id));

ALTER POLICY "Advisors can view own record" ON public.advisors
  USING (((select auth.uid()) = id));

ALTER POLICY "admins_can_delete_user_data" ON public.user_data
  USING (((id = (select auth.uid())) AND (is_account_member(account_id, 'admin'::text) OR (account_id IS NULL))));

ALTER POLICY "admins_can_insert_user_data" ON public.user_data
  WITH CHECK (((id = (select auth.uid())) AND (is_account_member(account_id, 'admin'::text) OR (account_id IS NULL))));

ALTER POLICY "admins_can_modify_user_data" ON public.user_data
  USING ((is_account_member(account_id, 'admin'::text) OR ((account_id IS NULL) AND (id = (select auth.uid())))));

ALTER POLICY "members_can_read_user_data" ON public.user_data
  USING ((is_account_member(account_id) OR ((account_id IS NULL) AND (id = (select auth.uid())))));
