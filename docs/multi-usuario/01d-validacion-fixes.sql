-- ═══════════════════════════════════════════════════════════════════════════
-- FINPATHIA — MIGRATION 01d: Fixes de validación post-diseño
-- ─────────────────────────────────────────────────────────────────────────
-- EJECUTAR DESPUÉS DE: 01-migration-schema.sql + 01b-patches.sql + 01c-patches.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Origen: validación cruzada del diseño multi-usuario realizada antes de
-- aplicar SQL en Supabase productivo. Contiene 4 fixes que cierran gaps
-- detectados al re-revisar el diseño completo:
--
--   FIX 1 (CRÍTICO): handle_new_user del PATCH 5 omite el campo 'pen' de
--          parámetros del simulador de pensión que sí existe en
--          schema-simple.sql. Sin este fix, los signups posteriores
--          quedan con user_data sin 'pen' y el simulador puede fallar
--          o usar defaults silenciosos.
--
--   FIX 2 (recomendado): UNIQUE constraint en user_data.account_id.
--          La relación accounts ↔ user_data debe ser 1:1 estrictamente.
--          Sin UNIQUE: race conditions o lógica futura podrían crear
--          duplicados. Defensa en profundidad cero costo.
--
--   FIX 3 (recomendado): cancelar grace cuando un cliente vuelve de
--          paused/orphan a active. El PATCH 11 inicia grace en cualquier
--          transición desde active (incluyendo a paused). El PATCH 9
--          original NO resetea subscription_status al reactivar.
--          Resultado: pausa temporal del asesor → cliente queda en grace
--          falsamente y eventualmente baja a basic. Este fix reescribe
--          promote_account_to_managed para cancelar el grace al reactivar.
--
--   FIX 4 (defensa en profundidad): trigger enforce_max_members en
--          account_members. El doc 05 lo postergaba a Fase 3, pero entre
--          Fase 3 (UI invitar) y Fase 4 (edge function) hay ventana donde
--          un cliente puede INSERT directo en account_members vía API
--          saltándose validación cliente. Con este trigger la BD
--          garantiza el límite a nivel raíz.
--
-- IDEMPOTENCIA: todos los bloques son re-ejecutables sin romper nada.
-- ENVOLTORIO: BEGIN/COMMIT explícito. Si algo falla, no queda en estado
-- parcial.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FIX 1 — Restaurar campo 'pen' en handle_new_user                     │
-- │                                                                       │
-- │ Reescribe la función con el mismo bloque del PATCH 5 (01b) más el     │
-- │ campo 'pen' que existía en el handle_new_user original de             │
-- │ schema-simple.sql. CREATE OR REPLACE no afecta el trigger asociado.   │
-- │                                                                       │
-- │ ⚠️ Antes de ejecutar este FIX 1: verificar contra el bloque actual    │
-- │ del trigger en producción (Supabase Dashboard → Database → Functions  │
-- │ → handle_new_user) por si tiene cambios adicionales que no están      │
-- │ reflejados en schema-simple.sql del repo.                             │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_account_id UUID;
BEGIN
  -- Crear cuenta personal por default
  INSERT INTO public.accounts (owner_user_id, plan, max_members, display_name)
  VALUES (NEW.id, 'basic', 1, 'Mi cuenta')
  RETURNING id INTO new_account_id;
  -- (el trigger create_owner_membership crea automáticamente el row de admin)

  -- Crear user_data con account_id ya vinculado, incluyendo TODOS los campos
  -- del shape original (incluyendo 'pen' que el PATCH 5 omitía).
  INSERT INTO public.user_data (id, email, account_id, data)
  VALUES (
    NEW.id,
    NEW.email,
    new_account_id,
    jsonb_build_object(
      'p', jsonb_build_object('name', COALESCE(NEW.raw_user_meta_data->>'name', ''), 'email', NEW.email, 'plan', 'free'),
      'trm', 4200,
      'inv', '[]'::jsonb,
      'deu', '[]'::jsonb,
      'gas', '{}'::jsonb,
      'ibk', '[]'::jsonb,
      'ingresos', '[]'::jsonb,
      'metas', '[]'::jsonb,
      'pen', jsonb_build_object(
        'age', 35, 'rAge', 60, 'sv', 2500, 'cur', 120000,
        'ret', 7, 'inf', 3, 'des', 6000, 'btcC', 56, 'btcP', 50000
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FIX 2 — UNIQUE constraint en user_data.account_id                    │
-- │                                                                       │
-- │ La relación accounts ↔ user_data debe ser 1:1. Sin UNIQUE, dos rows  │
-- │ de user_data podrían apuntar al mismo account_id (race conditions o  │
-- │ lógica futura podría crearlos sin que se detecte).                    │
-- │                                                                       │
-- │ Usa DO block con verificación previa para:                            │
-- │   1. NO fallar si la constraint ya existe (idempotente).              │
-- │   2. Detectar duplicados ANTES de intentar agregar la constraint      │
-- │      (mensaje de error claro en vez de error genérico de Postgres).   │
-- └─────────────────────────────────────────────────────────────────────┘
DO $$
BEGIN
  -- Idempotencia: si la constraint ya existe, no hacer nada
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_data_account_id_unique'
    AND conrelid = 'public.user_data'::regclass
  ) THEN
    RAISE NOTICE 'user_data_account_id_unique ya existe — saltando FIX 2';
  ELSE
    -- Verificar que NO hay duplicados antes de agregar UNIQUE
    -- (la migración retroactiva del 01 NO debería haberlos creado, pero defensivo)
    IF EXISTS (
      SELECT account_id FROM public.user_data
      WHERE account_id IS NOT NULL
      GROUP BY account_id HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'Hay account_id duplicados en user_data. Investigar antes de aplicar UNIQUE.'
        USING HINT = 'SELECT account_id, COUNT(*) FROM user_data WHERE account_id IS NOT NULL GROUP BY account_id HAVING COUNT(*) > 1;';
    END IF;

    ALTER TABLE public.user_data
      ADD CONSTRAINT user_data_account_id_unique UNIQUE (account_id);
  END IF;
END $$;

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FIX 3 — Cancelar grace al reactivar paused/orphan                    │
-- │                                                                       │
-- │ El PATCH 9 (01c) original tenía early return cuando OLD.status =      │
-- │ 'active' en UPDATE. Eso significa que cuando un asesor pausa un       │
-- │ cliente y luego lo reactiva (paused → active), el trigger no resetea  │
-- │ el subscription_status='grace' que el PATCH 11 había seteado.         │
-- │                                                                       │
-- │ Resultado del bug: pausa temporal del asesor → cliente queda con      │
-- │ grace activo aunque el asesor sigue presente → expire_managed_grace_  │
-- │ period() lo baja a basic en 30 días aunque no debería.                │
-- │                                                                       │
-- │ Este fix reescribe la función para incluir el caso B (cancelar        │
-- │ grace al reactivar). Caso A (promover de basic a managed) sigue       │
-- │ idéntico al PATCH 9.                                                  │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.promote_account_to_managed()
RETURNS TRIGGER AS $$
DECLARE
  v_account_id UUID;
  v_current_plan TEXT;
  v_subscription_status TEXT;
  v_advisor_tier TEXT;
  v_max_members INT;
BEGIN
  -- Solo procesar transiciones que llegan a status='active'
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  -- Caso INSERT: siempre procesar.
  -- Caso UPDATE active→active: ya estaba activo, salir.
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- Buscar la cuenta del cliente vía user_data
  SELECT a.id, a.plan, a.subscription_status
    INTO v_account_id, v_current_plan, v_subscription_status
    FROM public.accounts a
    INNER JOIN public.user_data ud ON ud.account_id = a.id
    WHERE ud.id = NEW.client_id
    LIMIT 1;

  -- Si el cliente no tiene cuenta todavía (caso muy raro: signup paralelo),
  -- no hacer nada.
  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── CASO A — promover cuenta basic a managed ─────────────────────────
  -- Cuentas pro/pro_familiar pagadas por el cliente NO se tocan: el
  -- cliente conserva su plan.
  IF v_current_plan = 'basic' THEN
    SELECT advisor_plan INTO v_advisor_tier
      FROM public.advisors WHERE id = NEW.advisor_id;
    v_max_members := public.max_members_for_advisor_tier(v_advisor_tier);

    UPDATE public.accounts SET
      plan = 'managed',
      managed_by_advisor_id = NEW.advisor_id,
      managed_tier = v_advisor_tier,
      managed_at = NOW(),
      max_members = v_max_members,
      subscription_status = 'active',
      grace_until = NULL
    WHERE id = v_account_id;

  -- ── CASO B (FIX 3) — cancelar grace al reactivar paused/orphan ───────
  -- Si la cuenta ya era 'managed' y estaba en grace porque el asesor
  -- pausó al cliente, al reactivarlo cancelamos el grace.
  ELSIF v_current_plan = 'managed'
        AND TG_OP = 'UPDATE'
        AND OLD.status IN ('paused', 'orphan')
        AND NEW.status = 'active'
        AND v_subscription_status = 'grace' THEN

    UPDATE public.accounts SET
      subscription_status = 'active',
      grace_until = NULL
    WHERE id = v_account_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger advisor_clients_promote_to_managed (creado por PATCH 9) ya
-- apunta a esta función — no hay que recrearlo. CREATE OR REPLACE FUNCTION
-- actualiza la implementación in-place.

-- ┌─────────────────────────────────────────────────────────────────────┐
-- │ FIX 4 — Trigger enforce_max_members en account_members               │
-- │                                                                       │
-- │ Defensa en profundidad: aunque la edge function de Fase 4 valida     │
-- │ antes de invitar, un cliente comprometido podría hacer INSERT         │
-- │ directo en account_members vía API y exceder max_members.             │
-- │                                                                       │
-- │ Este trigger BEFORE INSERT/UPDATE garantiza el límite a nivel BD.    │
-- │ Compatible con migración retroactiva (1 miembro por cuenta nueva)    │
-- │ y con bootstrap del PATCH 4 (al INSERT en accounts el trigger crea   │
-- │ 1 miembro inicial, está dentro del límite).                          │
-- │                                                                       │
-- │ NO se aplica a status<>'active' (invites pendientes/revocados no      │
-- │ ocupan slot).                                                         │
-- └─────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION public.enforce_max_members()
RETURNS TRIGGER AS $$
DECLARE
  v_current_count INT;
  v_max_allowed INT;
BEGIN
  -- Solo evaluar al insertar membresía activa o reactivar pendiente/revoked
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;  -- ya estaba activo, no cuenta como nuevo
  END IF;

  -- Contar miembros activos actuales (excluyendo NEW si es UPDATE)
  SELECT COUNT(*) INTO v_current_count
  FROM public.account_members
  WHERE account_id = NEW.account_id
    AND status = 'active'
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  -- Leer límite del plan
  SELECT max_members INTO v_max_allowed
  FROM public.accounts WHERE id = NEW.account_id;

  IF v_max_allowed IS NULL THEN
    RAISE EXCEPTION 'Cuenta % no encontrada (race condition?)', NEW.account_id;
  END IF;

  IF v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'Cuenta llena: % miembros activos (límite del plan: %)',
      v_current_count, v_max_allowed
      USING HINT = 'Subir el plan o expulsar a un miembro existente antes de invitar a otro';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_members_trigger ON public.account_members;
CREATE TRIGGER enforce_max_members_trigger
BEFORE INSERT OR UPDATE OF status ON public.account_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_members();

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-FIX
-- ─────────────────────────────────────────────────────────────────────────
--
-- 1. Confirmar que handle_new_user incluye el campo 'pen':
--    SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
--    → Debe contener la línea con jsonb_build_object('age', 35, 'rAge', 60, ...)
--
-- 2. Confirmar que UNIQUE en account_id existe:
--    SELECT conname FROM pg_constraint
--    WHERE conrelid = 'public.user_data'::regclass
--      AND conname = 'user_data_account_id_unique';
--    → 1 fila
--
-- 3. Confirmar que promote_account_to_managed tiene CASO B:
--    SELECT prosrc FROM pg_proc WHERE proname = 'promote_account_to_managed';
--    → Debe contener "OLD.status IN ('paused', 'orphan')"
--
-- 4. Confirmar que enforce_max_members_trigger existe:
--    SELECT tgname FROM pg_trigger
--    WHERE tgname = 'enforce_max_members_trigger';
--    → 1 fila
--
-- 5. Smoke test funcional FIX 4 (con cuenta basic, max_members=1):
--    -- Como admin de tu cuenta basic (max_members=1), intentar agregar
--    -- un segundo miembro:
--    -- INSERT INTO account_members (account_id, user_id, role, status, accepted_at)
--    -- VALUES ('<tu_account_id>', gen_random_uuid(), 'reader', 'active', NOW());
--    -- → DEBE fallar con: "Cuenta llena: 1 miembros activos (límite del plan: 1)"
--
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK DE ESTOS FIXES (si algo sale mal)
-- ─────────────────────────────────────────────────────────────────────────
--
-- -- FIX 4: remover trigger de max_members
-- DROP TRIGGER IF EXISTS enforce_max_members_trigger ON public.account_members;
-- DROP FUNCTION IF EXISTS public.enforce_max_members();
--
-- -- FIX 3: revertir promote_account_to_managed a la versión PATCH 9 original
-- -- (re-ejecutar el bloque correspondiente del 01c-patches.sql)
--
-- -- FIX 2: remover UNIQUE
-- ALTER TABLE public.user_data DROP CONSTRAINT IF EXISTS user_data_account_id_unique;
--
-- -- FIX 1: re-aplicar handle_new_user del PATCH 5 sin 'pen'
-- -- (re-ejecutar el bloque PATCH 5 del 01b-patches.sql)
-- ═══════════════════════════════════════════════════════════════════════════
