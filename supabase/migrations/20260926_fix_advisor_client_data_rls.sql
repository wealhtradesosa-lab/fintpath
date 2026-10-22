-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 2026-09-26 — FIX advisor_client_data RLS bypass (CRITICAL)
--
-- Problem: public.advisor_client_data (20260421_advisor_mode.sql) was a
-- plain view owned by postgres, so it ran with the owner's privileges and
-- bypassed RLS on user_data and advisor_clients. anon/authenticated had
-- ALL privileges on it -> anyone with the publishable key could read every
-- active advisor client's user_data (email, data, plan...).
--
-- Fix:
--   1. security_invoker = true -> the view honors the caller's RLS.
--   2. Revoke everything from anon/public; authenticated keeps SELECT only.
--   3. Minimal SELECT policy on user_data so an advisor can still read the
--      user_data of his ACTIVE clients (without it advisor mode sees 0 rows).
--      advisor_clients RLS already limits rows to auth.uid() = advisor_id.
-- Does NOT touch user_data triggers.
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY advisors_can_read_active_clients_user_data
  ON public.user_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.advisor_clients ac
      WHERE ac.client_id = user_data.id
        AND ac.advisor_id = (SELECT auth.uid())
        AND ac.status = 'active'
    )
  );

ALTER VIEW public.advisor_client_data SET (security_invoker = true);

REVOKE ALL ON public.advisor_client_data FROM anon, authenticated, public;
GRANT SELECT ON public.advisor_client_data TO authenticated;

-- ─── ROLLBACK (re-opens the leak; only for emergencies) ──────────────
-- ALTER VIEW public.advisor_client_data RESET (security_invoker);
-- DROP POLICY IF EXISTS advisors_can_read_active_clients_user_data ON public.user_data;
-- GRANT ALL ON public.advisor_client_data TO anon, authenticated;
-- Safer partial rollback if advisor mode breaks (keeps anon closed):
-- ALTER VIEW public.advisor_client_data RESET (security_invoker);
-- (and optionally recreate the view with "AND ac.advisor_id = auth.uid()")
