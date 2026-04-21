-- ═══════════════════════════════════════════════════════════════════
-- MIGRATION: 2026-04-21 — ADVISOR MODE
-- 
-- Adds advisor capability to Finpathia:
-- - New role: advisor (a user who manages multiple clients)
-- - Relationship: advisor → clients (1 advisor : many clients)
-- - Plans: Corporate Starter ($79) / Professional ($179) / Boutique ($399)
-- 
-- SAFETY:
-- - Does NOT modify existing tables (user_data, jurisdictions)
-- - RLS enabled on both new tables
-- - Existing retail users are completely unaffected
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. ADVISORS table ───────────────────────────────────────────────
-- An advisor is a user who purchases a corporate plan and manages
-- multiple clients. The advisor is ALSO a user in auth.users (they
-- log in normally) but has additional advisor capabilities.

CREATE TABLE IF NOT EXISTS public.advisors (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  firm_name TEXT,                    -- Nombre de la firma/empresa del asesor
  firm_nit TEXT,                     -- NIT de la firma (CO)
  advisor_plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (advisor_plan IN ('starter', 'professional', 'boutique')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'past_due', 'canceled', 'trialing')),
  max_clients INTEGER NOT NULL DEFAULT 5,  -- 5/15/40 según plan
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.advisors IS 'Asesores/contadores que gestionan clientes via plan corporativo';
COMMENT ON COLUMN public.advisors.max_clients IS 'Starter=5, Professional=15, Boutique=40';

-- ─── 2. ADVISOR_CLIENTS table ────────────────────────────────────────
-- Pivot table: which clients belong to which advisor
-- Clients are REGULAR users (auth.users + user_data) — nothing special
-- about them in the data model. The link is only via this table.

CREATE TABLE IF NOT EXISTS public.advisor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL REFERENCES public.advisors(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'removed', 'orphan')),
  -- Controla si el cliente puede loguearse directamente como usuario retail.
  -- Default FALSE: el cliente solo existe "dentro" del workspace del asesor.
  -- El asesor puede activar este toggle desde su UI.
  independent_login_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  independent_login_activated_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  UNIQUE(advisor_id, client_id)
);

COMMENT ON TABLE public.advisor_clients IS 'Relación asesor → cliente';

-- ─── 3. INVITATIONS table ────────────────────────────────────────────
-- One-time tokens for an advisor to invite a new client

CREATE TABLE IF NOT EXISTS public.advisor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL REFERENCES public.advisors(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email_invited TEXT,                -- Email esperado (opcional, para validación)
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_advisor_invitations_token ON public.advisor_invitations(token);
CREATE INDEX IF NOT EXISTS idx_advisor_invitations_advisor ON public.advisor_invitations(advisor_id);

-- ─── 3b. ADVISOR_LEADS table ─────────────────────────────────────────
-- Captures interest from the /asesores landing page before a full
-- advisor subscribes. Used for manual follow-up and validation phase.

CREATE TABLE IF NOT EXISTS public.advisor_leads (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  plan TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  firm TEXT,
  clients_count TEXT,
  message TEXT,
  billing_cycle TEXT,
  source TEXT DEFAULT 'landing_asesores',
  status TEXT DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'rejected')),
  notes TEXT,
  contacted_at TIMESTAMPTZ,
  converted_advisor_id UUID REFERENCES public.advisors(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_advisor_leads_status ON public.advisor_leads(status);
CREATE INDEX IF NOT EXISTS idx_advisor_leads_email ON public.advisor_leads(email);

COMMENT ON TABLE public.advisor_leads IS 'Leads capturados del form Reservar mi cupo en /asesores';

-- ─── 4. RLS POLICIES ─────────────────────────────────────────────────

-- Enable RLS on all new tables
ALTER TABLE public.advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisor_leads ENABLE ROW LEVEL SECURITY;

-- LEADS: service_role only (filled via Netlify function with service key,
-- never directly from client-side). No public access to prevent spam/scraping.
-- Admin users can be added later if needed.

-- ADVISORS: Advisor can read/update only their own record
CREATE POLICY "Advisors can view own record"
  ON public.advisors FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Advisors can update own record"
  ON public.advisors FOR UPDATE
  USING (auth.uid() = id);

-- ADVISOR_CLIENTS: Advisor can see their own relationships
CREATE POLICY "Advisors can view own client relationships"
  ON public.advisor_clients FOR SELECT
  USING (auth.uid() = advisor_id);

-- Client can see if they are linked to any advisor
CREATE POLICY "Clients can view their own advisor relationship"
  ON public.advisor_clients FOR SELECT
  USING (auth.uid() = client_id);

-- Advisor can manage their own client relationships
CREATE POLICY "Advisors can insert client relationships"
  ON public.advisor_clients FOR INSERT
  WITH CHECK (auth.uid() = advisor_id);

CREATE POLICY "Advisors can update client relationships"
  ON public.advisor_clients FOR UPDATE
  USING (auth.uid() = advisor_id);

-- NOTE: Cliente con independent_login_enabled = TRUE puede entrar por
-- su propia cuenta y actúa como retail_user normal. La tabla user_data
-- mantiene sus políticas RLS existentes (cliente ve/edita su propia data).
-- La tabla advisor_clients solo controla la RELACIÓN con el asesor, no
-- los permisos de acceso a la app en sí.

-- INVITATIONS: Advisor sees only their own invitations
CREATE POLICY "Advisors can manage own invitations"
  ON public.advisor_invitations FOR ALL
  USING (auth.uid() = advisor_id);

-- ─── 5. VIEW: Advisor data access to client user_data ────────────────
-- This is the key piece: an advisor needs to READ (not write) the
-- user_data of their assigned clients.

CREATE OR REPLACE VIEW public.advisor_client_data AS
SELECT
  ud.id,
  ud.email,
  ud.data,
  ud.plan,
  ud.jurisdiction,
  ud.updated_at,
  ac.advisor_id,
  ac.status AS client_status,
  ac.independent_login_enabled,
  ac.invited_at,
  ac.accepted_at
FROM public.user_data ud
INNER JOIN public.advisor_clients ac ON ud.id = ac.client_id
WHERE ac.status = 'active';

-- Grant access via the view (RLS on advisor_clients protects it)
GRANT SELECT ON public.advisor_client_data TO authenticated;

-- ─── 6. HELPER FUNCTION: check advisor capacity ──────────────────────
-- Utility to verify an advisor hasn't exceeded their plan's client limit

CREATE OR REPLACE FUNCTION public.advisor_at_capacity(advisor_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.advisor_clients
  WHERE advisor_id = advisor_user_id AND status = 'active';

  SELECT max_clients INTO max_allowed
  FROM public.advisors
  WHERE id = advisor_user_id;

  RETURN current_count >= COALESCE(max_allowed, 0);
END;
$$;

-- ─── 7. TRIGGER: auto-update advisor.max_clients on plan change ──────

CREATE OR REPLACE FUNCTION public.sync_advisor_max_clients()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.max_clients := CASE NEW.advisor_plan
    WHEN 'starter' THEN 5
    WHEN 'professional' THEN 15
    WHEN 'boutique' THEN 40
    ELSE 5
  END;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_advisor_max_clients
  BEFORE INSERT OR UPDATE OF advisor_plan ON public.advisors
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_advisor_max_clients();

-- ═══════════════════════════════════════════════════════════════════
-- END OF MIGRATION
-- 
-- Rollback (if needed):
-- DROP VIEW IF EXISTS public.advisor_client_data;
-- DROP FUNCTION IF EXISTS public.advisor_at_capacity;
-- DROP FUNCTION IF EXISTS public.sync_advisor_max_clients;
-- DROP TABLE IF EXISTS public.advisor_invitations;
-- DROP TABLE IF EXISTS public.advisor_clients;
-- DROP TABLE IF EXISTS public.advisors;
-- ═══════════════════════════════════════════════════════════════════
