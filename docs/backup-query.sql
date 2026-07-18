-- ═══════════════════════════════════════════════════════════════════════════
-- BACKUP FINPATHIA — ejecutar ANTES de cambios grandes
-- Fecha uso: 18-jul-2026 (antes de Fase 2 flujo anual)
--
-- INSTRUCCIONES:
-- 1. Ir a: https://supabase.com/dashboard/project/pdwrgpskzvrjkqozfbvl/sql/new
-- 2. Pegar TODA esta query
-- 3. Ejecutar ("Run")
-- 4. Descargar el resultado como CSV/JSON (botón download en el resultado)
-- 5. Guardar el archivo con nombre: backup-2026-07-18-pre-flujo-anual.json
-- ═══════════════════════════════════════════════════════════════════════════

-- Backup completo de user_data
SELECT
  id,
  data,
  updated_at,
  -- Metadata útil para auditoría
  jsonb_array_length(COALESCE(data->'ingresos', '[]'::jsonb)) AS n_ingresos,
  jsonb_array_length(COALESCE(data->'inv', '[]'::jsonb)) AS n_activos,
  jsonb_array_length(COALESCE(data->'deu', '[]'::jsonb)) AS n_deudas,
  (SELECT COUNT(*) FROM jsonb_object_keys(COALESCE(data->'gas', '{}'::jsonb))) AS n_cats_gastos,
  pg_column_size(data) AS tamaño_bytes
FROM public.user_data
ORDER BY updated_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- CÓMO RESTAURAR (solo si algo sale mal)
-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Ir al mismo lugar (SQL editor de Supabase)
-- 2. Ejecutar esta query PERO reemplazando <ID_USUARIO> y <JSON_BACKUP>
--
-- UPDATE public.user_data
-- SET data = '<JSON_BACKUP>'::jsonb,
--     updated_at = NOW()
-- WHERE id = '<ID_USUARIO>';
-- ═══════════════════════════════════════════════════════════════════════════
